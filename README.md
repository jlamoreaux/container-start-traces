# Container start-time traces

A small Worker + [Cloudflare Containers](https://developers.cloudflare.com/containers/) demo whose point is to
make **container start time observable** with
[Workers traces](https://developers.cloudflare.com/workers/observability/traces/) and
[custom spans](https://developers.cloudflare.com/workers/observability/traces/custom-spans/).

A page lets you trigger cold and warm starts, with a configurable "app init" delay, and shows where each start's
time went. Every start is also a trace you can open in Workers Observability.

## Run it

Requirements: Node 20+, Docker running locally, and a Cloudflare account with Containers enabled.

```sh
npm install
npm run dev      # local; builds the image with Docker. Spans are captured locally too (see below).
npm run deploy   # builds and pushes the image, then deploys. Wait a few minutes after the first deploy.
```

Open the Worker URL, pick an app init delay, and use **Cold start**, **Burst x5** or **Warm request**.

## What gets traced

Each `POST /api/start` produces one trace, shared by the Worker and the Durable Object:

```
POST (Worker root span)                      carries queryable container.* attributes
└─ demo.start_request                        custom span
   └─ durable_object_subrequest > jsRpcSession > jsRpcCall      auto-instrumented, caller side

jsRpcCall (Durable Object, callee side)      same trace
├─ container.start                           custom span; the numbers live here
│  ├─ container.provision                    start() issued -> the platform has an instance for us
│  ├─ container.wait_for_port                instance up, waiting for the app to accept connections
│  └─ container.first_request                first real request into the container
└─ container.destroy                         cold mode only; cleans up the instance
```

With `npm run dev` you can inspect the same spans locally through wrangler's local observability API
(the dev server prints the URL on startup), for example:

```sh
curl -s -X POST http://localhost:8787/cdn-cgi/local/explorer/api/local/observability/query \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT name, duration_ms FROM spans ORDER BY start_ms DESC LIMIT 20"}'
```

Attributes on `container.start` (also set on the Worker's root span so you can query them):

| Attribute | Meaning |
| --- | --- |
| `container.start.kind` | `cold_first` (new Durable Object), `cold_restart` (same Durable Object, container had stopped), `cold_joined` (arrived during another request's cold start), `warm` |
| `container.start.total_ms` | Wall time from the start request until the app answered a probe |
| `container.start.app_init_ms` | Time the app spent booting, reported by the container itself (`cold_first` / `cold_restart` only) |
| `container.start.platform_overhead_ms` | `total_ms - app_init_ms`: placement, image load, VM boot, probing |
| `container.start.provision_ms`, `wait_for_port_ms`, `first_request_ms` | Span timings, same as the waterfall |
| `container.start.probes` | Number of readiness probes issued |
| `container.location`, `container.region` | Where the container was placed |

`container.provision` ends when the platform has an instance for us: the first probe answers "the container is
not listening", or succeeds. `container.wait_for_port` is the rest. In local dev the probe errors don't carry that
message, so `provision` ends only once the app answers and absorbs app init. `app_init_ms` and
`platform_overhead_ms` are the split that holds everywhere.

## Finding it in the dashboard

Workers & Pages -> your Worker -> Observability -> Traces. Paste a trace ID from the UI (also returned in the
`x-trace-id` response header), or use the query builder:

- Filter `container.start.kind = cold_first`, calculate P50/P95 of `container.start.total_ms`.
- Group by `container.location` to compare placement.
- Group by `container.start.kind` to compare cold vs restart vs warm.
- Sort by `container.start.platform_overhead_ms` to find slow platform starts independent of your app.

## How it works

- `src/index.ts`: Worker routes, and `DemoContainer`, a plain Durable Object that drives `ctx.container` directly
  with the `durable_object` [scheduling policy](https://developers.cloudflare.com/containers/configuration/scheduling-policy/)
  (beta). It calls `start()` and runs its own readiness probe loop so each phase can be its own span.
  The `Container` class from `@cloudflare/containers` doesn't support this policy.
- `src/ui.ts`: single-page UI, inline HTML.
- `container/`: a Node app whose startup is delayed by `STARTUP_DELAY_MS` to simulate heavy app init.
- `wrangler.jsonc`: tracing enabled with `observability.traces`, and the container image under `containers[].images`.

Notes:

- Spans can't be back-dated, so phases are only emitted for work the Worker actually awaits.
- Cold mode uses a brand-new instance each time and destroys it afterwards. The shared `warm` instance stops after
  30 s idle (`setInactivityTimeout`).
- The app-init slider only affects a container that is booting; it is ignored for an already-running warm instance.

## Cost and abuse

The `durable_object` policy has no `max_instances`, and `/api/start` starts a new container per cold request, so
running instances count against your account limits and can bill. The endpoints are unauthenticated. Before sharing
a deployed URL, put it behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/)
(or add your own auth or rate limiting), or delete the Worker when you're done:

```sh
npx wrangler delete
```

## License

MIT. See [LICENSE](LICENSE).
