// Debug probe: render single frames of the 3D layer straight from src/main.js (no HyperFrames runtime).
//   node tools/probe.mjs out_dir t1 t2 ...
import { createRequire } from "module";
import http from "http"; import fs from "fs"; import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".js": "text/javascript", ".html": "text/html", ".woff2": "font/woff2", ".wav": "audio/wav" };
const srv = http.createServer((q, s) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s); }).listen(8813);
const [out, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console", m.type(), m.text().slice(0, 300)); });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await p.addInitScript(() => { window.__timelines = {}; });
await p.goto("http://localhost:8813/index.html");
await p.waitForFunction(() => window.__hf && window.__hf.buildReady && window.__hf.buildReady.trailer, null, { timeout: 60000 });
await p.evaluate(() => window.__hf.buildReady.trailer);
for (const t of ts) {
  const stats = await p.evaluate((t) => {
    window.__trailer.renderAt(+t);
    const c = document.getElementById("gl");
    const gl = c.getContext("webgl2");
    const px = new Uint8Array(4 * 64);
    let sum = 0; const w = c.width, h = c.height;
    for (let i = 0; i < 64; i++) { gl.readPixels(Math.floor((i % 8 + 0.5) * w / 8), Math.floor((Math.floor(i / 8) + 0.5) * h / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px.subarray(i * 4, i * 4 + 4)); }
    for (let i = 0; i < 64; i++) sum += px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2];
    return { mean: sum / 192, url: c.toDataURL("image/png") };
  }, t);
  fs.writeFileSync(path.join(out, `t${(+t).toFixed(2)}.png`), Buffer.from(stats.url.split(",")[1], "base64"));
  console.log(t, "mean", stats.mean.toFixed(1), JSON.stringify(await p.evaluate((t) => window.__trailer.debug(+t), t)));
}
await b.close(); srv.close();
