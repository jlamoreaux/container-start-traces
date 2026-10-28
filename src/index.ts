import { DurableObject, tracing } from "cloudflare:workers";
import { UI_HTML } from "./ui";

const APP_PORT = 8080;
const POLL_INTERVAL_MS = 100;
const READY_TIMEOUT_MS = 60_000;
const PROBE_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 30_000;

// Error strings the Containers runtime returns while probing a port during start.
const NO_INSTANCE_ERROR = "there is no container instance that can be provided to this durable object";
const NOT_LISTENING_ERROR = "the container is not listening";

// cold_first: new Durable Object. cold_restart: same Durable Object, container had stopped.
// cold_joined: arrived while another request's cold start was in flight. warm: already healthy.
type StartKind = "cold_first" | "cold_restart" | "cold_joined" | "warm";

interface Phases {
	provisionMs: number;
	waitForPortMs: number;
	probes: number;
}

export interface StartReport {
	kind: StartKind;
	totalStartMs: number;
	provisionMs: number;
	waitForPortMs: number;
	firstRequestMs: number;
	probes: number;
	appInitMs: number | null;
	platformOverheadMs: number | null;
	location: string | null;
	region: string | null;
	country: string | null;
	traceId: string;
}

interface BootInfo {
	initDelayMs: number;
	listeningAfterMs: number;
	processUptimeMs: number;
	location: string | null;
	region: string | null;
	country: string | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).toLowerCase();

export class DemoContainer extends DurableObject<Env> {
	// Set while a cold start is in flight so concurrent callers join it instead of being
	// reported as warm (`container.running` flips to true as soon as start() is called).
	private starting?: Promise<Phases>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// The inactivity timeout is per Durable Object instance and is lost on restart.
		const container = ctx.container;
		if (container?.running) {
			void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(IDLE_TIMEOUT_MS));
		}
	}

	/**
	 * Start the container (if needed) and report where the time went.
	 *
	 * Span tree produced (all children of `container.start`):
	 *   container.provision      start() issued -> the platform has an instance for us
	 *                            (first probe answers "not listening", or succeeds)
	 *   container.wait_for_port  instance is up, waiting for the app to accept connections
	 *   container.first_request  first real request into the container
	 */
	async measureStart(opts: { delayMs: number; destroyAfter: boolean }): Promise<StartReport> {
		const container = this.ctx.container;
		if (!container) throw new Error("No container is configured for this Durable Object");

		const joining = container.running && this.starting !== undefined;
		const wasRunning = container.running && !joining;
		const priorStarts = this.ctx.storage.kv.get<number>("demo:starts") ?? 0;
		const kind: StartKind = joining
			? "cold_joined"
			: wasRunning
				? "warm"
				: priorStarts === 0
					? "cold_first"
					: "cold_restart";

		let report: StartReport;
		try {
			report = await tracing.enterSpan("container.start", async (span) => {
				span.setAttributes({
					"container.start.kind": kind,
					"container.start.configured_init_delay_ms": opts.delayMs,
					"container.poll_interval_ms": POLL_INTERVAL_MS,
					"container.port": APP_PORT,
				});

				const startedAt = Date.now();
				let phases: Phases;
				if (joining) {
					const inFlight = this.starting!;
					phases = await tracing.enterSpan("container.join_inflight_start", async () => {
						await inFlight;
						return { provisionMs: 0, waitForPortMs: Date.now() - startedAt, probes: 0 };
					});
				} else {
					const run = this.bootAndWait(wasRunning, opts.delayMs, startedAt, priorStarts);
					if (!wasRunning) {
						this.starting = run;
						const clear = () => {
							if (this.starting === run) this.starting = undefined;
						};
						run.then(clear, clear);
					}
					phases = await run;
				}
				const totalStartMs = Date.now() - startedAt;

				const firstReqStart = Date.now();
				const info = await tracing.enterSpan("container.first_request", async (reqSpan) => {
					const res = await container.getTcpPort(APP_PORT).fetch("http://container/boot-info");
					reqSpan.setAttribute("http.response.status_code", res.status);
					return (await res.json()) as BootInfo;
				});
				const firstRequestMs = Date.now() - firstReqStart;

				// Time the app itself spent booting. Only meaningful for the request that triggered the
				// start; the rest of the start is platform work (placement, image load, VM boot, polling).
				const ownsStart = kind === "cold_first" || kind === "cold_restart";
				const appInitMs = ownsStart ? info.listeningAfterMs : null;
				const platformOverheadMs = appInitMs === null ? null : Math.max(0, totalStartMs - appInitMs);

				span.setAttributes({
					"container.start.total_ms": totalStartMs,
					"container.start.provision_ms": phases.provisionMs,
					"container.start.wait_for_port_ms": phases.waitForPortMs,
					"container.start.first_request_ms": firstRequestMs,
					"container.start.probes": phases.probes,
					"container.start.app_init_ms": appInitMs ?? undefined,
					"container.start.platform_overhead_ms": platformOverheadMs ?? undefined,
					"container.location": info.location ?? undefined,
					"container.region": info.region ?? undefined,
				});

				return {
					kind,
					totalStartMs,
					provisionMs: phases.provisionMs,
					waitForPortMs: phases.waitForPortMs,
					firstRequestMs,
					probes: phases.probes,
					appInitMs,
					platformOverheadMs,
					location: info.location,
					region: info.region,
					country: info.country,
					traceId: span.spanContext().traceId,
				} satisfies StartReport;
			});
		} catch (err) {
			// Don't leave a half-started container behind, and let the next attempt start clean.
			await this.safeDestroy();
			throw err;
		}

		if (opts.destroyAfter) await this.safeDestroy();
		return report;
	}

	async stopNow(): Promise<void> {
		await this.safeDestroy();
	}

	// Issues start() (unless already running) and probes the port until the app answers.
	private async bootAndWait(
		wasRunning: boolean,
		delayMs: number,
		startedAt: number,
		priorStarts: number,
	): Promise<Phases> {
		const container = this.ctx.container!;
		const provisionSpan = tracing.startSpan("container.provision");
		let waitSpan: Span | undefined;
		let provisionEndedAt: number | undefined;
		let probes = 0;
		let noInstanceErrors = 0;
		let notListeningErrors = 0;

		const instanceIsUp = () => {
			if (provisionEndedAt !== undefined) return;
			provisionEndedAt = Date.now();
			provisionSpan.setAttribute("container.provision_ms", provisionEndedAt - startedAt);
			provisionSpan.setAttribute("container.probe.no_instance_errors", noInstanceErrors);
			provisionSpan.end();
			waitSpan = tracing.startSpan("container.wait_for_port");
		};

		try {
			if (!wasRunning) {
				const image = (container as unknown as { images?: Record<string, string> }).images?.base;
				if (!image) {
					throw new Error('No "base" image on ctx.container.images; check containers[].images in wrangler.jsonc');
				}
				container.start({
					image,
					enableInternet: false,
					env: { STARTUP_DELAY_MS: String(delayMs) },
				});
				await container.setInactivityTimeout(IDLE_TIMEOUT_MS);
				this.ctx.storage.kv.put("demo:starts", priorStarts + 1);
			}

			const port = container.getTcpPort(APP_PORT);
			for (;;) {
				if (Date.now() - startedAt > READY_TIMEOUT_MS) {
					throw new Error(`container not ready after ${READY_TIMEOUT_MS}ms`);
				}
				probes++;
				try {
					await port.fetch("http://container/", { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
					instanceIsUp();
					break;
				} catch (err) {
					if (!container.running) {
						throw new Error(`container exited while starting: ${errorText(err)}`);
					}
					const text = errorText(err);
					if (text.includes(NOT_LISTENING_ERROR)) {
						notListeningErrors++;
						instanceIsUp();
					} else if (text.includes(NO_INSTANCE_ERROR)) {
						noInstanceErrors++;
					}
					await sleep(POLL_INTERVAL_MS);
				}
			}
		} catch (err) {
			if (provisionEndedAt === undefined) provisionSpan.end();
			waitSpan?.recordException(err as Error);
			waitSpan?.end();
			throw err;
		}

		const readyAt = Date.now();
		const provisionMs = (provisionEndedAt ?? readyAt) - startedAt;
		const waitForPortMs = readyAt - (provisionEndedAt ?? readyAt);
		waitSpan?.setAttributes({
			"container.wait_for_port_ms": waitForPortMs,
			"container.probe.attempts": probes,
			"container.probe.not_listening_errors": notListeningErrors,
		});
		waitSpan?.end();
		return { provisionMs, waitForPortMs, probes };
	}

	private async safeDestroy(): Promise<void> {
		const container = this.ctx.container;
		if (!container?.running) return;
		try {
			await tracing.enterSpan("container.destroy", () => container.destroy("demo cleanup"));
		} catch (err) {
			console.error(JSON.stringify({ event: "container.destroy_failed", error: String(err) }));
		}
	}
}

function json(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: { "content-type": "application/json", ...init.headers },
	});
}

async function handleStart(request: Request, env: Env): Promise<Response> {
	// The invocation's root span: attributes set here are what you filter/group on in the
	// Workers Observability query builder.
	const root = tracing.getActiveSpan();
	const traceId = root?.spanContext().traceId ?? "";

	const url = new URL(request.url);
	const mode = url.searchParams.get("mode") === "warm" ? "warm" : "cold";
	const delayMs = Math.min(30_000, Math.max(0, Number(url.searchParams.get("delay") ?? 0) || 0));
	const name = mode === "warm" ? "warm" : `cold-${crypto.randomUUID().slice(0, 8)}`;

	root?.setAttributes({ "demo.mode": mode, "demo.container_name": name });

	return tracing.enterSpan("demo.start_request", async (span) => {
		span.setAttributes({ "demo.mode": mode, "demo.container_name": name, "demo.init_delay_ms": delayMs });
		const stub = env.DEMO_CONTAINER.getByName(name);
		const began = Date.now();
		try {
			const report = await stub.measureStart({ delayMs, destroyAfter: mode === "cold" });
			const endToEndMs = Date.now() - began;

			root?.setAttributes({
				"container.start.kind": report.kind,
				"container.start.total_ms": report.totalStartMs,
				"container.start.provision_ms": report.provisionMs,
				"container.start.wait_for_port_ms": report.waitForPortMs,
				"container.start.app_init_ms": report.appInitMs ?? undefined,
				"container.start.platform_overhead_ms": report.platformOverheadMs ?? undefined,
				"container.location": report.location ?? undefined,
			});
			console.log(JSON.stringify({ event: "container.start", name, endToEndMs, ...report }));

			return json({ name, endToEndMs, ...report, traceId }, { headers: { "x-trace-id": traceId } });
		} catch (err) {
			span.recordException(err as Error);
			span.setStatus({ code: "error", message: "start failed" });
			root?.setAttribute("container.start.error", String(err));
			return json({ error: String(err), traceId }, { status: 502, headers: { "x-trace-id": traceId } });
		}
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (request.method === "GET" && pathname === "/") {
			return new Response(UI_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
		}
		if (request.method === "POST" && pathname === "/api/start") {
			return handleStart(request, env);
		}
		if (request.method === "POST" && pathname === "/api/stop") {
			await env.DEMO_CONTAINER.getByName("warm").stopNow();
			return json({ stopped: true });
		}
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
