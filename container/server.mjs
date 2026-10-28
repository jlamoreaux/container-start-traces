import http from "node:http";

const initDelayMs = Number(process.env.STARTUP_DELAY_MS ?? 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Simulates real app init (loading a model, running migrations, warming caches).
// The port isn't open until this finishes, so it shows up as time in the
// Worker-side `container.wait_for_port` span.
await sleep(initDelayMs);

let listeningAfterMs = 0;

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/boot-info")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        initDelayMs,
        listeningAfterMs,
        processUptimeMs: Math.round(process.uptime() * 1000),
        node: process.version,
        location: process.env.CLOUDFLARE_LOCATION ?? null,
        region: process.env.CLOUDFLARE_REGION ?? null,
        country: process.env.CLOUDFLARE_COUNTRY_A2 ?? null,
      }),
    );
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
});

server.listen(8080, "0.0.0.0", () => {
  // process.uptime() covers runtime boot + our init delay, i.e. everything
  // inside the container before it could accept a connection.
  listeningAfterMs = Math.round(process.uptime() * 1000);
  console.log(JSON.stringify({ event: "listening", listeningAfterMs, initDelayMs }));
});

// Node as PID 1 ignores SIGTERM unless handled; exit promptly on stop.
process.on("SIGTERM", () => process.exit(0));
