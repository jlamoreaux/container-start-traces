export const UI_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#ff4801" />
<meta name="description" content="Trace where Cloudflare Containers start time goes, with Workers traces and custom spans." />
<title>Container start-time traces</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23ff4801'/%3E%3Cpath d='M12 9l12 7-12 7z' fill='%23fff'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    color-scheme: light;
    --page: #f5f1eb;
    --panel: #fffdfb;
    --panel-2: #fffbf5;
    --wash: #fef7ed;
    --line: #ebd5c1;
    --line-soft: rgba(235, 213, 193, 0.55);
    --ink: #521000;
    --muted: rgba(82, 16, 0, 0.74);
    --faint: rgba(82, 16, 0, 0.62);
    --orange: #ff4801;
    --orange-hover: #ff7038;
    --accent-ink: #c4470f;
    --amber: #ffb834;
    --green: #16794a;
    --error: #dc2626;
    --sans: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --mono: "JetBrains Mono", "SF Mono", "Fira Code", Consolas, monospace;
    --ease: cubic-bezier(0.16, 1, 0.3, 1);
  }
  * { box-sizing: border-box; }
  html { background: var(--page); }
  body {
    margin: 0;
    min-height: 100vh;
    color: var(--ink);
    font: 16px/1.6 var(--sans);
    -webkit-font-smoothing: antialiased;
    background-color: var(--page);
    background-image: radial-gradient(circle, var(--line) 0.75px, transparent 0.75px);
    background-size: 24px 24px;
  }
  ::selection { background: var(--orange); color: #fff; }
  a { color: inherit; }
  :focus-visible { outline: 2px solid var(--orange); outline-offset: 3px; }

  /* top bar */
  .bar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: 14px;
    height: 52px; padding: 0 clamp(16px, 3vw, 40px);
    background: rgba(245, 241, 235, 0.88);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .mark { display: block; width: 22px; height: 22px; flex: none; }
  .crumbs { font: 500 13px/1 var(--mono); letter-spacing: 0.02em; display: flex; gap: 10px; align-items: center; white-space: nowrap; overflow: hidden; }
  .crumbs b { font-weight: 600; }
  .crumbs i { font-style: normal; color: var(--faint); }
  .bar .spacer { flex: 1; }
  .bar a.link { font: 500 12px/1 var(--mono); text-decoration: none; padding: 8px 10px; border: 1px solid var(--line); background: var(--panel); transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease); white-space: nowrap; }
  .bar a.link:hover { border-color: var(--orange); background: var(--wash); }

  main { max-width: 1120px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 40px) 96px; }

  /* hero */
  .hero { padding: clamp(40px, 8vw, 84px) 0 clamp(24px, 4vw, 40px); }
  .tag {
    display: inline-flex; align-items: center; height: 22px; padding: 0 8px;
    background: var(--accent-ink); color: #fff;
    font: 600 11px/1 var(--mono); letter-spacing: 0.09em; text-transform: uppercase; white-space: nowrap;
  }
  .tag.quiet { background: transparent; color: var(--accent-ink); box-shadow: inset 0 0 0 1px var(--accent-ink); }
  .tag.ok { background: transparent; color: var(--green); box-shadow: inset 0 0 0 1px var(--green); }
  .tag.err { background: var(--error); }
  .tag.plain { background: var(--wash); color: var(--muted); box-shadow: inset 0 0 0 1px var(--line); }
  h1 {
    margin: 18px 0 14px;
    font-weight: 600; letter-spacing: -0.035em; line-height: 0.98;
    font-size: clamp(2.5rem, 7.2vw, 5.4rem);
    max-width: 16ch;
    text-wrap: balance;
  }
  h1 em { font-style: normal; color: var(--orange); }
  .sub { margin: 0; max-width: 62ch; font-size: clamp(1rem, 0.5vw + 0.85rem, 1.2rem); color: var(--muted); }
  .sub code, .how code { font: 500 0.86em var(--mono); background: var(--wash); border: 1px solid var(--line); padding: 1px 6px; color: var(--accent-ink); }

  /* hairline-grid panels */
  .panel { background: var(--panel); border: 1px solid var(--line); margin-bottom: 20px; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line); background: var(--panel-2); }
  h2 { margin: 0; font: 600 12px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }
  .panel-body { padding: 20px; }

  /* controls */
  .controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1px; background: var(--line); }
  .controls > * { background: var(--panel); }
  .delay { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; }
  .delay-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .delay label { font: 600 13px/1.3 var(--sans); }
  .delay .hint { font-size: 13px; color: var(--faint); }
  .delay output { font: 600 22px/1 var(--mono); color: var(--orange); letter-spacing: -0.02em; }
  input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 24px; background: transparent; cursor: pointer; margin: 0; }
  input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: linear-gradient(to right, var(--orange) var(--fill, 10%), var(--line) var(--fill, 10%)); }
  input[type="range"]::-moz-range-track { height: 4px; background: var(--line); }
  input[type="range"]::-moz-range-progress { height: 4px; background: var(--orange); }
  input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 22px; margin-top: -9px; background: var(--ink); border: 0; border-radius: 0; transition: background-color 0.2s var(--ease); }
  input[type="range"]::-moz-range-thumb { width: 14px; height: 22px; background: var(--ink); border: 0; border-radius: 0; }
  input[type="range"]:hover::-webkit-slider-thumb { background: var(--orange); }
  .actions { display: flex; flex-wrap: wrap; align-items: stretch; gap: 1px; background: var(--line); }
  .actions > button { border-width: 0; }
  button {
    font: 600 14px/1 var(--sans); letter-spacing: -0.005em;
    height: 100%; min-height: 56px; padding: 0 20px;
    color: var(--ink); background: var(--panel);
    border: 0; border-radius: 0; cursor: pointer;
    transition: background-color 0.2s var(--ease), color 0.2s var(--ease);
  }
  button:hover:not(:disabled) { background: var(--wash); }
  button:active:not(:disabled) { background: var(--line-soft); }
  button:disabled { cursor: progress; color: var(--faint); }
  button.primary { background: var(--orange); }
  button.primary:hover:not(:disabled) { background: var(--orange-hover); }

  /* stats */
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--line); }
  .stat { background: var(--panel); padding: 18px 20px 20px; }
  .stat .k { font: 500 11px/1.3 var(--mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--faint); }
  .stat .v { margin-top: 10px; font: 600 clamp(1.6rem, 3.2vw, 2.4rem)/1 var(--mono); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  .stat.hot .v { color: var(--orange); }
  .stat .note { margin-top: 8px; font-size: 12.5px; color: var(--faint); }

  /* legend + runs */
  .legend { display: flex; flex-wrap: wrap; gap: 6px 22px; padding: 14px 20px; border-bottom: 1px solid var(--line); font: 500 12px/1.2 var(--mono); color: var(--muted); }
  .legend i { display: inline-block; width: 10px; height: 10px; margin-right: 8px; vertical-align: -1px; }
  .sw-p { background: var(--orange); } .sw-a { background: var(--amber); } .sw-r { background: var(--ink); }
  .sw-j { background: repeating-linear-gradient(135deg, var(--orange) 0 3px, #fff 3px 6px); box-shadow: inset 0 0 0 1px var(--orange); }
  .empty { padding: 44px 20px; text-align: center; color: var(--faint); }
  .empty b { color: var(--ink); }
  .run { display: grid; grid-template-columns: 118px minmax(0, 1fr) 84px; gap: 6px 18px; align-items: center; padding: 16px 20px; border-top: 1px solid var(--line-soft); }
  .run:first-child { border-top: 0; }
  .run.enter { animation: rise 0.5s var(--ease) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .track { height: 20px; background: var(--wash); box-shadow: inset 0 0 0 1px var(--line-soft); }
  .seg { display: flex; height: 100%; }
  .seg div { min-width: 2px; }
  .seg .p { background: var(--orange); } .seg .a { background: var(--amber); } .seg .r { background: var(--ink); }
  .seg .j { background: repeating-linear-gradient(135deg, var(--orange) 0 5px, var(--orange-hover) 5px 10px); }
  .track.pending { overflow: hidden; }
  .track.pending div { height: 100%; background: repeating-linear-gradient(135deg, var(--amber) 0 10px, var(--line) 10px 20px); background-size: 28px 28px; animation: slide 0.9s linear infinite; opacity: 0.55; }
  @keyframes slide { to { background-position: 28px 0; } }
  .total { font: 600 17px/1 var(--mono); text-align: right; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .meta { grid-column: 2 / 4; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; font: 400 12px/1.5 var(--mono); color: var(--faint); }
  .meta b { color: var(--ink); font-weight: 500; }
  .meta button { min-height: 0; height: 22px; padding: 0 8px; margin-left: 4px; font: 500 11px/1 var(--mono); color: var(--accent-ink); background: transparent; box-shadow: inset 0 0 0 1px var(--line); }
  .meta button:hover { box-shadow: inset 0 0 0 1px var(--orange); background: var(--wash); }
  .err-text { grid-column: 2 / 4; font: 400 13px/1.5 var(--mono); color: var(--error); word-break: break-word; }

  /* how to read */
  .how { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--line); counter-reset: n; }
  .how li { counter-increment: n; background: var(--panel); padding: 18px 20px 20px 56px; position: relative; color: var(--muted); font-size: 14.5px; }
  .how li::before { content: counter(n, decimal-leading-zero); position: absolute; left: 20px; top: 19px; font: 600 12px/1 var(--mono); color: var(--orange); letter-spacing: 0.04em; }
  .how li b { color: var(--ink); font-weight: 600; }
  .how li.wide { grid-column: 1 / -1; }

  footer { padding: 8px 0 0; font: 400 12px/1.6 var(--mono); color: var(--faint); display: flex; flex-wrap: wrap; gap: 6px 18px; }
  footer a { color: var(--accent-ink); }

  /* load-in */
  .hero > *, .reveal { animation: rise 0.7s var(--ease) both; }
  .hero > :nth-child(2) { animation-delay: 0.06s; }
  .hero > :nth-child(3) { animation-delay: 0.12s; }
  .reveal:nth-of-type(1) { animation-delay: 0.18s; }
  .reveal:nth-of-type(2) { animation-delay: 0.24s; }
  .reveal:nth-of-type(3) { animation-delay: 0.30s; }
  .reveal:nth-of-type(4) { animation-delay: 0.36s; }

  @media (max-width: 760px) {
    .controls { grid-template-columns: 1fr; }
    .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .actions > button { height: auto; min-height: 52px; }
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .panel-head { flex-wrap: wrap; }
    .run { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "tag total" "track track" "meta meta"; gap: 10px 12px; padding: 14px 16px; }
    .run > .tag { grid-area: tag; justify-self: start; }
    .run > .track { grid-area: track; }
    .run > .total { grid-area: total; }
    .run > .meta, .run > .err-text { grid-area: meta; grid-column: auto; }
    .run.err-row { grid-template-areas: "tag tag" "meta meta"; }
    .how { grid-template-columns: 1fr; }
    .bar a.link { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
</style>
</head>
<body>
<header class="bar">
  <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#ff4801"/><path d="M12 9l12 7-12 7z" fill="#fff"/></svg>
  <div class="crumbs"><b>Containers</b><i>/</i><span>Start-time traces</span></div>
  <div class="spacer"></div>
  <a class="link" href="https://developers.cloudflare.com/workers/observability/traces/" target="_blank" rel="noopener">Workers traces &#8599;</a>
</header>

<main>
  <section class="hero">
    <span class="tag">Workers traces &middot; Containers</span>
    <h1>Where does container <em>start time</em> go?</h1>
    <p class="sub">Every start is traced end to end. Each run maps to a <code>container.start</code> span with child spans for
    provisioning, port polling and the first request. Copy a trace ID to open the waterfall in Workers Observability.</p>
  </section>

  <section class="panel reveal" aria-label="Controls">
    <div class="controls">
      <div class="delay">
        <div class="delay-top">
          <label for="delay">App init delay</label>
          <output id="delayLabel" for="delay">1.00 s</output>
        </div>
        <input id="delay" type="range" min="0" max="10000" step="250" value="1000" />
        <span class="hint">Simulated app boot time. Applies when a new container boots; ignored for an already-running warm instance.</span>
      </div>
      <div class="actions">
        <button class="primary" id="cold">Cold start</button>
        <button id="burst">Burst &times;5</button>
        <button id="warm">Warm request</button>
        <button id="stop">Stop warm instance</button>
      </div>
    </div>
  </section>

  <section class="panel reveal" aria-label="Cold start summary">
    <div class="panel-head"><h2>Cold start summary</h2><span class="tag plain">cold_first + cold_restart</span></div>
    <div class="stats">
      <div class="stat"><div class="k">Cold runs</div><div class="v" id="sN">0</div></div>
      <div class="stat hot"><div class="k">p50 start</div><div class="v" id="sP50">&ndash;</div></div>
      <div class="stat"><div class="k">p95 start</div><div class="v" id="sP95">&ndash;</div></div>
      <div class="stat"><div class="k">Platform overhead p50</div><div class="v" id="sPlat">&ndash;</div><div class="note">Start time minus app init</div></div>
    </div>
  </section>

  <section class="panel reveal" aria-label="Runs">
    <div class="panel-head"><h2>Runs</h2><span class="tag quiet" id="runCount">0 runs</span></div>
    <div class="legend">
      <span><i class="sw-p"></i>platform (placement, image, VM, probing)</span>
      <span><i class="sw-a"></i>app init (reported by the container)</span>
      <span><i class="sw-r"></i>container.first_request</span>
      <span><i class="sw-j"></i>waited on another request's start (cold_joined)</span>
    </div>
    <div id="runs" aria-live="polite"><div class="empty">No runs yet. Hit <b>Cold start</b>.</div></div>
  </section>

  <section class="panel reveal" aria-label="How to read this">
    <div class="panel-head"><h2>How to read this</h2></div>
    <ol class="how">
      <li><b>Cold start</b> uses a brand-new container every time, then destroys it. This is the worst case: placement, image load, VM boot, then your app.</li>
      <li><b>Warm request</b> reuses one shared container. The first call is a cold start; later calls skip provisioning. <b>Stop warm instance</b> makes the next call a <code>cold_restart</code> (same Durable Object, container gone).</li>
      <li><code>cold_joined</code> means your request arrived while another request's cold start was already in flight. It waited for that start rather than triggering its own, so it has no app-init or platform split.</li>
      <li><b>Platform overhead</b> = total start &minus; the app's own init time (reported by the container). It is the part you don't control from your code.</li>
      <li>The trace has <code>container.provision</code> and <code>container.wait_for_port</code> spans for the same window. Where the boundary falls depends on when the platform's first port probe returns, so use <code>platform_overhead_ms</code> and <code>app_init_ms</code> for the reliable split.</li>
      <li>In the dashboard: <b>Workers &amp; Pages &rarr; your Worker &rarr; Observability &rarr; Traces</b>. Filter on <code>container.start.kind</code>, or group <code>container.start.total_ms</code> by <code>container.location</code>.</li>
    </ol>
  </section>

  <footer>
    <span>Built with Cloudflare Workers, Durable Objects and Containers.</span>
    <a href="https://developers.cloudflare.com/containers/" target="_blank" rel="noopener">Containers docs</a>
    <a href="https://developers.cloudflare.com/workers/observability/traces/custom-spans/" target="_blank" rel="noopener">Custom spans</a>
  </footer>
</main>

<script>
  const $ = (id) => document.getElementById(id);
  const runs = [];
  let nextId = 1;

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COLD_KINDS = ["cold_first", "cold_restart"];
  const fmt = (ms) => ms == null ? "\\u2013" : ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : Math.round(ms) + " ms";
  const pct = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
  };

  const delay = $("delay");
  const syncDelay = () => {
    $("delayLabel").textContent = fmt(+delay.value);
    delay.style.setProperty("--fill", (+delay.value / +delay.max * 100) + "%");
  };
  delay.addEventListener("input", syncDelay);
  syncDelay();

  async function start(mode) {
    const run = { id: nextId++, mode, pending: true, fresh: true, began: performance.now() };
    runs.unshift(run);
    render();
    try {
      const res = await fetch("/api/start?mode=" + mode + "&delay=" + delay.value, { method: "POST" });
      const body = await res.json();
      Object.assign(run, body, { pending: false, kind: res.ok ? body.kind : "error", clientMs: Math.round(performance.now() - run.began) });
    } catch (e) {
      Object.assign(run, { pending: false, kind: "error", error: String(e) });
    }
    render();
  }

  $("cold").onclick = () => start("cold");
  $("warm").onclick = () => start("warm");
  $("burst").onclick = () => { for (let i = 0; i < 5; i++) start("cold"); };
  $("stop").onclick = async () => {
    const btn = $("stop");
    btn.disabled = true;
    try {
      const res = await fetch("/api/stop", { method: "POST" });
      if (!res.ok) throw new Error("HTTP " + res.status);
    } catch (e) {
      btn.textContent = "Stop failed";
      setTimeout(() => { btn.textContent = "Stop warm instance"; }, 2000);
    }
    btn.disabled = false;
  };

  function renderSummary() {
    const cold = runs.filter((r) => !r.pending && COLD_KINDS.includes(r.kind));
    const totals = cold.map((r) => r.totalStartMs);
    $("sN").textContent = cold.length;
    $("sP50").textContent = fmt(pct(totals, 50));
    $("sP95").textContent = fmt(pct(totals, 95));
    $("sPlat").textContent = fmt(pct(cold.map((r) => r.platformOverheadMs).filter((v) => v != null), 50));
    $("runCount").textContent = runs.length + (runs.length === 1 ? " run" : " runs");
  }

  function tagClass(kind) {
    if (kind === "warm") return "tag ok";
    if (kind === "cold_joined") return "tag quiet";
    if (kind === "error") return "tag err";
    return "tag";
  }

  function renderRun(r, scale) {
    const enter = r.fresh ? " enter" : "";
    r.fresh = false;
    if (r.pending) {
      return '<div class="run' + enter + '"><span class="tag plain">' + esc(r.mode) + '</span><div class="track pending"><div></div></div><div class="total">&hellip;</div></div>';
    }
    if (r.kind === "error") {
      return '<div class="run err-row' + enter + '"><span class="tag err">error</span><div class="err-text">' + esc(r.error || "failed") +
        (r.traceId ? " &middot; trace " + esc(r.traceId) : "") + '</div></div>';
    }
    const total = r.totalStartMs + r.firstRequestMs;
    const app = r.appInitMs || 0;
    const joined = r.kind === "cold_joined";
    const warm = r.kind === "warm";
    const platform = r.platformOverheadMs != null ? r.platformOverheadMs : r.totalStartMs;
    const w = (ms) => (ms / scale * 100).toFixed(2) + "%";
    const bar = '<div class="track"><div class="seg" style="width:' + w(total) + '">' +
      '<div class="' + (joined ? "j" : "p") + '" style="flex:' + platform + '" title="' + (joined ? "waited on in-flight start " : warm ? "readiness check " : "platform ") + platform + ' ms"></div>' +
      '<div class="a" style="flex:' + app + '" title="app init ' + app + ' ms"></div>' +
      '<div class="r" style="flex:' + r.firstRequestMs + '" title="first request ' + r.firstRequestMs + ' ms"></div></div></div>';
    const meta = [
      (joined ? "waited on in-flight start <b>" : warm ? "readiness check <b>" : "platform <b>") + fmt(platform) + "</b>",
      r.appInitMs != null ? "app init <b>" + fmt(r.appInitMs) + "</b>" : null,
      "1st req <b>" + fmt(r.firstRequestMs) + "</b>",
      joined || warm ? null : "provision <b>" + fmt(r.provisionMs) + "</b> + wait_for_port <b>" + fmt(r.waitForPortMs) + "</b>",
      r.location ? esc(r.location) + (r.country ? ", " + esc(r.country) : "") : null,
    ].filter(Boolean).map((s) => "<span>" + s + "</span>").join("");
    return '<div class="run' + enter + '"><span class="' + tagClass(r.kind) + '">' + esc(r.kind) + '</span>' + bar +
      '<div class="total">' + fmt(r.totalStartMs) + '</div>' +
      '<div class="meta">' + meta + '<span>trace ' + esc(r.traceId.slice(0, 8)) + '\\u2026<button data-trace="' + esc(r.traceId) + '">copy</button></span></div></div>';
  }

  function render() {
    renderSummary();
    if (!runs.length) return;
    const done = runs.filter((r) => !r.pending && r.kind !== "error");
    const scale = Math.max(1, ...done.map((r) => r.totalStartMs + r.firstRequestMs));
    $("runs").innerHTML = runs.map((r) => renderRun(r, scale)).join("");
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button[data-trace]");
    if (!t) return;
    navigator.clipboard.writeText(t.dataset.trace);
    t.textContent = "copied";
    setTimeout(() => { t.textContent = "copy"; }, 1200);
  });
</script>
</body>
</html>
`;
