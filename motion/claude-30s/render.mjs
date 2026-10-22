// Frame-exact renderer for claude-30s.html (Playwright + ffmpeg). WebGL runs on SwiftShader in headless Chromium.
//   node render.mjs stills 0 1.5 3.6 ...      -> out/stills/t_<s>.png + out/stills/sheet.png
//   node render.mjs chunk <a> <b> <name>      -> out/<name>.mkv (lossless, frames a..b-1, motion blur)
//   node render.mjs draft [a b]               -> out/draft.mp4 (30 fps, one sample per frame, 960 wide)
//   node render.mjs cues                      -> out/cues.json
//   node render.mjs bench <frame>             -> time of one full frame (all its sub-frames)
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const URL_ = 'file://' + path.join(HERE, 'claude-30s.html') + '?render=1&noaa';
const FPS = 60, TOTAL = 30 * FPS;
const ARGS = ['--run-all-compositor-stages-before-draw', '--disable-threaded-animation', '--disable-checker-imaging',
  '--font-render-hinting=none', '--force-color-profile=srgb', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function open() {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  return { browser, page };
}
// read the canvas pixels directly (lossless PNG)
async function grab(page, f) {
  const url = await page.evaluate(f => { window.renderFrame(f); return document.getElementById('c').toDataURL('image/png'); }, f);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

const [mode, ...rest] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const { browser, page } = await open();

if (mode === 'cues') {
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(await page.evaluate(() => window.CUES), null, 1));
} else if (mode === 'bench') {
  const f = +rest[0];
  const r = await page.evaluate(f => { const t0 = performance.now(); const n = window.renderFrame(f); return [n, performance.now() - t0]; }, f);
  const r2 = await page.evaluate(f => { const t0 = performance.now(); const n = window.renderFrame(f); return [n, performance.now() - t0]; }, f);
  console.log(`frame ${f}: ${r2[0]} sub-frames, ${r2[1].toFixed(0)} ms (first call ${r[1].toFixed(0)} ms)`);
} else if (mode === 'stills') {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const s of rest) {
    const f = Math.min(TOTAL - 1, Math.round(parseFloat(s) * FPS));
    const file = path.join(dir, `t_${(f / FPS).toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(file, await grab(page, f)); files.push(file);
  }
  const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap(f => ['-i', f]);
  const lbl = files.map((f, i) => `[${i}:v]scale=640:-1,drawtext=text='${path.basename(f, '.png').slice(2)} s':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';');
  const pad = Array.from({ length: cols * rows - files.length }, (_, i) => `color=c=black:s=640x360:d=1[p${i}]`).join(';');
  const all = files.map((_, i) => `[v${i}]`).join('') + Array.from({ length: cols * rows - files.length }, (_, i) => `[p${i}]`).join('');
  const layout = Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
  if (files.length > 1) spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${lbl}${pad ? ';' + pad : ''};${all}xstack=inputs=${cols * rows}:layout=${layout}[o]`, '-map', '[o]', '-frames:v', '1', path.join(dir, 'sheet.png')], { stdio: 'inherit' });
} else if (mode === 'chunk' || mode === 'draft') {
  const draft = mode === 'draft';
  const a = rest.length >= 2 ? +rest[0] : 0, b = rest.length >= 2 ? +rest[1] : TOTAL, step = draft ? 2 : 1;
  const name = draft ? (rest[2] || 'draft') + '.mp4' : `${rest[2]}.mkv`;
  const enc = draft
    ? ['-vf', 'scale=1280:-2,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast']
    : ['-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast'];
  if (draft) await page.evaluate(() => { window.renderFrame = f => window.seek(f / 60); });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS / step), '-i', '-', ...enc, path.join(OUT, name)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f += step) {
    const buf = await grab(page, f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 60 === 0) console.log(`${name} frame ${f}/${b} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`${name} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
