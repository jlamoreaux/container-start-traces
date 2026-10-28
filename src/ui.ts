export const UI_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Container start-time traces</title>
<style>
  :root {
    --bg: #0e1013; --panel: #161a20; --line: #262c35; --text: #e6e8eb; --dim: #8b94a1;
    --provision: #f6821f; --wait: #4c9ffe; --request: #3fcf8e; --bad: #ff5d5d;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h1 span { color: var(--provision); }
  .sub { color: var(--dim); margin: 0 0 28px; max-width: 70ch; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px; margin-bottom: 18px; }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .delay { display: flex; align-items: center; gap: 10px; margin-right: auto; color: var(--dim); font-size: 13px; }
  .delay input { width: 160px; accent-color: var(--provision); }
  .delay b { color: var(--text); font-family: var(--mono); min-width: 6ch; display: inline-block; }
  button { font: inherit; font-weight: 600; background: #20262f; color: var(--text); border: 1px solid var(--line); border-radius: 7px; padding: 8px 14px; cursor: pointer; }
  button:hover { border-color: #3a4351; background: #262d38; }
  button.primary { background: var(--provision); border-color: var(--provision); color: #1a0f05; }
  button.primary:hover { filter: brightness(1.08); }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .stat .k { color: var(--dim); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
  .stat .v { font: 600 24px var(--mono); margin-top: 2px; }
  .stat .v small { font-size: 12px; color: var(--dim); font-weight: 400; }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; color: var(--dim); font-size: 12px; margin-bottom: 14px; font-family: var(--mono); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
  .run { display: grid; grid-template-columns: 96px 1fr 84px; gap: 14px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
  .run:first-child { border-top: 0; }
  .badge { font: 600 11px var(--mono); padding: 3px 7px; border-radius: 5px; text-align: center; background: #232a34; color: var(--dim); }
  .badge.cold_first, .badge.cold_restart, .badge.cold_joined { background: rgba(246,130,31,.15); color: var(--provision); }
  .badge.warm { background: rgba(63,207,142,.14); color: var(--request); }
  .badge.error { background: rgba(255,93,93,.15); color: var(--bad); }
  .bar { display: flex; height: 18px; border-radius: 4px; overflow: hidden; background: #1c222a; }
  .bar div { min-width: 2px; }
  .bar .p { background: var(--provision); } .bar .w { background: var(--wait); } .bar .r { background: var(--request); }
  .bar.pending div { width: 100%; background: repeating-linear-gradient(45deg, #232a34 0 8px, #1c222a 8px 16px); animation: slide 1s linear infinite; background-size: 22px 22px; }
  @keyframes slide { to { background-position: 22px 0; } }
  .total { font: 600 15px var(--mono); text-align: right; }
  .meta { grid-column: 2 / 4; color: var(--dim); font: 12px var(--mono); display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: -4px; }
  .meta button { padding: 0 6px; font: 11px var(--mono); font-weight: 400; border-radius: 4px; background: transparent; color: var(--dim); }
  .empty { color: var(--dim); text-align: center; padding: 28px 0; }
  code { font-family: var(--mono); background: #20262f; padding: 1px 6px; border-radius: 4px; font-size: 12.5px; }
  ol.how { margin: 8px 0 0; padding-left: 20px; color: var(--dim); }
  ol.how li { margin: 4px 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); margin: 0 0 12px; }
  @media (max-width: 640px) { .stats { grid-template-columns: repeat(2, 1fr); } .run { grid-template-columns: 80px 1fr 70px; } }
</style>
</head>
<body>
<main>
  <h1><span>&#9654;</span> Container start-time traces</h1>
  <p class="sub">Every start is traced end to end. Each run below maps to a <code>container.start</code> span with
  child spans for provisioning, port polling and the first request. Use the trace ID to open the waterfall in
  Workers Observability.</p>

  <div class="panel">
    <div class="controls">
      <label class="delay" title="Applies when a new container boots; ignored for an already-running warm instance">App init delay
        <input id="delay" type="range" min="0" max="10000" step="250" value="1000" />
        <b id="delayLabel">1.0 s</b>
      </label>
      <button class="primary" id="cold">Cold start</button>
      <button id="burst">Burst &times;5</button>
      <button id="warm">Warm request</button>
      <button id="stop">Stop warm instance</button>
    </div>
  </div>

  <div class="panel">
    <h2>Cold start summary</h2>
    <div class="stats">
      <div class="stat"><div class="k">Runs</div><div class="v" id="sN">0</div></div>
      <div class="stat"><div class="k">p50</div><div class="v" id="sP50">&ndash;</div></div>
      <div class="stat"><div class="k">p95</div><div class="v" id="sP95">&ndash;</div></div>
      <div class="stat"><div class="k">Platform overhead p50</div><div class="v" id="sPlat">&ndash;</div></div>
    </div>
  </div>

  <div class="panel">
    <h2>Runs</h2>
    <div class="legend">
      <span><i style="background:var(--provision)"></i>platform (placement, image, VM, probing)</span>
      <span><i style="background:var(--wait)"></i>app init (reported by the container)</span>
      <span><i style="background:var(--request)"></i>container.first_request</span>
    </div>
    <div id="runs"><div class="empty">No runs yet. Hit <b>Cold start</b>.</div></div>
  </div>

  <div class="panel">
    <h2>How to read this</h2>
    <ol class="how">
      <li><b>Cold start</b> uses a brand-new container every time, then destroys it. This is the worst case: placement, image load, VM boot, then your app.</li>
      <li><b>Warm request</b> reuses one shared container. The first call is a cold start; later calls skip provisioning. <b>Stop warm instance</b> then makes the next call a <code>cold_restart</code> (same Durable Object, container gone).</li>
      <li><code>cold_joined</code> means your request arrived while another request's cold start was already in flight. It waited for that start rather than triggering its own, so it has no app-init or platform split.</li>
      <li><b>Platform overhead</b> = total start &minus; the app's own init time (reported by the container). It is the part you don't control from your code.</li>
      <li>The trace has <code>container.provision</code> and <code>container.wait_for_port</code> spans for the same window. Where the boundary between them falls depends on when the platform's first port probe returns, so use <code>platform_overhead_ms</code> and <code>app_init_ms</code> for the reliable split.</li>
      <li>In the dashboard: <b>Workers &amp; Pages &rarr; your Worker &rarr; Observability &rarr; Traces</b>. Filter on <code>container.start.kind</code>, or group <code>container.start.total_ms</code> by <code>container.location</code>.</li>
    </ol>
  </div>
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

  $("delay").addEventListener("input", () => { $("delayLabel").textContent = fmt(+$("delay").value); });
  $("delayLabel").textContent = fmt(+$("delay").value);

  async function start(mode) {
    const run = { id: nextId++, mode, pending: true, began: performance.now() };
    runs.unshift(run);
    render();
    try {
      const res = await fetch("/api/start?mode=" + mode + "&delay=" + $("delay").value, { method: "POST" });
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
  }

  function renderRun(r, scale) {
    if (r.pending) {
      return '<div class="run"><span class="badge">' + r.mode + '</span><div class="bar pending"><div></div></div><div class="total">&hellip;</div></div>';
    }
    if (r.kind === "error") {
      return '<div class="run"><span class="badge error">error</span><div class="meta" style="grid-column:2/4;margin:0">' + esc(r.error || "failed") +
        (r.traceId ? " &middot; trace " + esc(r.traceId) : "") + '</div></div>';
    }
    const total = r.totalStartMs + r.firstRequestMs;
    const app = r.appInitMs || 0;
    const platform = r.platformOverheadMs != null ? r.platformOverheadMs : r.totalStartMs;
    const w = (ms) => (ms / scale * 100).toFixed(2) + "%";
    const bar = '<div class="bar" style="width:' + w(total) + '">' +
      '<div class="p" style="flex:' + platform + '" title="platform ' + platform + ' ms"></div>' +
      '<div class="w" style="flex:' + app + '" title="app init ' + app + ' ms"></div>' +
      '<div class="r" style="flex:' + r.firstRequestMs + '" title="first request ' + r.firstRequestMs + ' ms"></div></div>';
    const meta = [
      "platform " + fmt(platform),
      r.appInitMs != null ? "app init " + fmt(r.appInitMs) : null,
      "1st req " + fmt(r.firstRequestMs),
      "spans: provision " + fmt(r.provisionMs) + " + wait_for_port " + fmt(r.waitForPortMs),
      r.location ? esc(r.location) + (r.country ? ", " + esc(r.country) : "") : null,
    ].filter(Boolean).map((s) => "<span>" + s + "</span>").join("");
    return '<div class="run"><span class="badge ' + esc(r.kind) + '">' + esc(r.kind) + '</span>' + bar +
      '<div class="total">' + fmt(r.totalStartMs) + '</div>' +
      '<div class="meta">' + meta + '<span>trace ' + esc(r.traceId.slice(0, 8)) + '\\u2026 <button data-trace="' + esc(r.traceId) + '">copy</button></span></div></div>';
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
