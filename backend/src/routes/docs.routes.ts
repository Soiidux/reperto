import { Router } from "express";
import { API_ROUTES } from "./index";
import { buildOpenApiDocument } from "../openapi/generate";
import logger from "../utils/logger";

/**
 * Live API documentation, generated from the routes as they are mounted.
 *
 * `GET /openapi.json` is the machine-readable contract; `GET /` is a small
 * self-contained viewer so the docs need no CDN and no build step. The spec is
 * built once at module load: it is derived from the route table, which does not
 * change at runtime, so rebuilding it per request would only waste CPU.
 */
const router = Router();

const document = buildOpenApiDocument({ mounts: API_ROUTES });

router.get("/openapi.json", (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json(document);
});

router.get("/", (_req, res) => {
  res.type("html").send(viewerHtml);
});

/**
 * Deliberately minimal and dependency-free.
 *
 * A React/Scalar/Swagger bundle would mean shipping a third-party script into
 * a health-data application for a convenience feature; a plain HTML page that
 * fetches the same spec has no such supply chain, and degrades to readable
 * text if the fetch fails.
 */
const viewerHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reperto API</title>
<style>
  :root { color-scheme: light dark; --fg:#1a1a1a; --bg:#fbfbfa; --muted:#6b6b6b; --line:#e3e3e0; --accent:#0f766e; --card:#fff; }
  @media (prefers-color-scheme: dark) { :root { --fg:#e8e8e6; --bg:#161615; --muted:#9a9a96; --line:#2e2e2c; --accent:#5eead4; --card:#1e1e1d; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1.25rem 5rem; font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; color:var(--fg); background:var(--bg); }
  .wrap { max-width: 68rem; margin: 0 auto; }
  h1 { font-size:1.6rem; margin:0 0 .25rem; letter-spacing:-.02em; }
  .sub { color:var(--muted); margin:0 0 1.5rem; }
  .stats { display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:1.75rem; }
  .stat { border:1px solid var(--line); background:var(--card); border-radius:.5rem; padding:.5rem .75rem; font-size:.82rem; }
  .stat b { display:block; font-size:1.1rem; font-weight:600; }
  .stat span { color:var(--muted); }
  nav { display:flex; flex-wrap:wrap; gap:.4rem; margin-bottom:2rem; }
  nav a { color:var(--accent); text-decoration:none; border:1px solid var(--line); background:var(--card); border-radius:999px; padding:.25rem .7rem; font-size:.82rem; }
  nav a:hover { border-color:var(--accent); }
  h2 { font-size:1.05rem; margin:2.25rem 0 .75rem; padding-bottom:.35rem; border-bottom:1px solid var(--line); }
  details { border:1px solid var(--line); background:var(--card); border-radius:.5rem; margin-bottom:.4rem; }
  details[open] { border-color:color-mix(in srgb, var(--accent) 45%, var(--line)); }
  summary { cursor:pointer; padding:.6rem .8rem; display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
  summary::-webkit-details-marker { display:none; }
  .m { font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; padding:.3rem .45rem; border-radius:.25rem; border:1px solid; }
  .GET { color:#0e7490; border-color:#0e749055; background:#0e749014; }
  .POST { color:#15803d; border-color:#15803d55; background:#15803d14; }
  .PATCH, .PUT { color:#b45309; border-color:#b4530955; background:#b4530914; }
  .DELETE { color:#b91c1c; border-color:#b91c1c55; background:#b91c1c14; }
  .p { font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--fg); word-break:break-all; }
  .body { padding:0 .8rem .8rem; }
  .body p { margin:.25rem 0 .5rem; color:var(--muted); font-size:.88rem; }
  code { font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; background:color-mix(in srgb, var(--accent) 8%, transparent); padding:.1rem .3rem; border-radius:.25rem; }
  .tag { display:inline-block; font-size:11px; color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:.1rem .5rem; }
  .lock { font-size:11px; color:var(--muted); }
  .warn { border-left:3px solid #b45309; background:color-mix(in srgb, #b45309 8%, transparent); padding:.5rem .75rem; margin:.5rem 0; font-size:.84rem; border-radius:0 .25rem .25rem 0; }
  table { border-collapse:collapse; width:100%; font-size:.84rem; }
  th,td { text-align:left; padding:.35rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:500; }
  pre { background:var(--card); border:1px solid var(--line); border-radius:.5rem; padding:.75rem; overflow:auto; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; max-height:26rem; }
  .err { color:var(--muted); padding:3rem 0; text-align:center; }
</style>
</head>
<body>
<div class="wrap" id="app"><p class="err">Loading specification…</p></div>
<script type="module">
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

try {
  const res = await fetch("./openapi.json");
  if (!res.ok) throw new Error("HTTP " + res.status);
  const spec = await res.json();
  const stats = spec["x-documentation"] ?? {};
  const groups = new Map();

  for (const [path, ops] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push({ path, method, op });
    }
  }

  const nav = [...groups.keys()].sort()
    .map((t) => \`<a href="#\${encodeURIComponent(t)}">\${esc(t)}</a>\`).join("");

  const sections = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, items]) => {
    const rows = items.map(({ path, method, op }) => {
      const params = (op.parameters ?? []).map((p) =>
        \`<tr><td><code>\${esc(p.name)}</code></td><td>\${esc(p.in)}</td><td>\${p.required ? "required" : "optional"}</td><td>\${esc(JSON.stringify(p.schema ?? {}))}</td></tr>\`).join("");
      const perm = op["x-required-permission"]
        ? '<span class="tag"><code>' + esc(op["x-required-permission"]) + "</code></span>"
        : "";
      const lock = op.security ? '<span class="lock">auth</span>' : '<span class="lock">public</span>';
      const notes = [];
      if (op["x-query-params-documented-only"]) notes.push("Query parameters below are <b>documented but not validated</b> by the server.");
      if (op["x-response-schema-pending"]) notes.push("Response body is <b>not schema-validated</b>; see the summary for its shape.");
      return \`<details>
        <summary><span class="m \${method.toUpperCase()}">\${method.toUpperCase()}</span><span class="p">\${esc(path)}</span>\${lock}\${perm}</summary>
        <div class="body">
          <p>\${esc(op.summary ?? "")}</p>
          \${op.description ? \`<p>\${esc(op.description)}</p>\` : ""}
          \${notes.map((n) => \`<div class="warn">\${n}</div>\`).join("")}
          \${params ? \`<table><thead><tr><th>Parameter</th><th>In</th><th>Req</th><th>Schema</th></tr></thead><tbody>\${params}</tbody></table>\` : ""}
          \${op.requestBody ? \`<p>Request body:</p><pre>\${esc(JSON.stringify(Object.values(op.requestBody.content ?? {})[0]?.schema ?? {}, null, 2))}</pre>\` : ""}
          <p>Responses: \${Object.entries(op.responses ?? {}).map(([c, r]) => \`<code>\${c}</code> \${esc(r.description ?? "")}\`).join(" · ")}</p>
        </div>
      </details>\`;
    }).join("");
    return \`<h2 id="\${encodeURIComponent(tag)}">\${esc(tag)} <span class="tag">\${items.length}</span></h2>\${rows}\`;
  }).join("");

  document.getElementById("app").innerHTML = \`
    <h1>\${esc(spec.info?.title ?? "API")}</h1>
    <p class="sub">Generated from the live Express route stack — paths, capabilities and request schemas are read off the middleware that serves them.</p>
    <div class="stats">
      <div class="stat"><b>\${stats.totalOperations ?? "—"}</b><span>operations</span></div>
      <div class="stat"><b>\${stats.withHumanSummary ?? "—"}</b><span>with a written summary</span></div>
      <div class="stat"><b>\${stats.withResponseSchema ?? "—"}</b><span>with a described response</span></div>
      <div class="stat"><b>\${esc(spec.openapi)}</b><span>OpenAPI</span></div>
    </div>
    <nav>\${nav}</nav>
    \${sections}\`;
} catch (err) {
  document.getElementById("app").innerHTML = \`<p class="err">Could not load the specification: \${esc(err.message)}</p>\`;
}
</script>
</body>
</html>`;

logger.info("OpenAPI document generated", {
  operations: document["x-documentation"]?.totalOperations,
});

export default router;