// Frame-exact renderer for stellar.html (Playwright + ffmpeg), served over HTTP (ES module + three.js).
//   node render.mjs stills 0 1.5 3.6 ...   -> out/stills/t_<s>.png + out/stills/sheet.png
//   node render.mjs chunk <a> <b> <name>   -> out/<name>.mkv (lossless, frames a..b-1, motion blur)
//   node render.mjs draft <a> <b> <name>   -> out/<name>.mp4 (no blur, 540 wide, quick rhythm check)
//   node render.mjs cues                   -> out/cues.json
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const PORT = process.env.PORT || 8765, FPS = 30, TOTAL = 60 * FPS;
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--run-all-compositor-stages-before-draw',
  '--disable-threaded-animation', '--disable-checker-imaging', '--font-render-hinting=none', '--force-color-profile=srgb'];
const [mode, ...rest] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ARGS });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/stellar.html?render=1&sub=${process.env.SUB || 3}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function grab(f, blur = true) {
  const url = await page.evaluate(async ([f, blur]) => { if (blur) await window.renderFrame(f); else await window.seek(f / 30); return document.getElementById('c').toDataURL('image/png'); }, [f, blur]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
if (mode === 'cues') {
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(await page.evaluate(() => ({ cues: window.CUES, vo: window.VO, S: window.S })), null, 1));
} else if (mode === 'stills') {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const s of rest) {
    const f = Math.min(TOTAL - 1, Math.round(parseFloat(s) * FPS));
    const file = path.join(dir, `t_${(f / FPS).toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(file, await grab(f, process.env.BLUR === '1')); files.push(file);
  }
  const cols = Math.min(4, files.length), rows = Math.ceil(files.length / cols), tw_ = 360, th = 640;
  const inputs = files.flatMap(f => ['-i', f]);
  const lbl = files.map((f, i) => `[${i}:v]scale=${tw_}:${th},drawtext=text='${path.basename(f, '.png').slice(2)}s':x=10:y=10:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
  const npad = cols * rows - files.length;
  const pad = Array.from({ length: npad }, (_, i) => `color=c=black:s=${tw_}x${th}:d=1[p${i}]`).join(';');
  const all = files.map((_, i) => `[v${i}]`).join('') + Array.from({ length: npad }, (_, i) => `[p${i}]`).join('');
  const layout = Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * tw_}_${Math.floor(i / cols) * th}`).join('|');
  const fc = files.length === 1 ? `${lbl};[v0]null[o]` : `${lbl}${pad ? ';' + pad : ''};${all}xstack=inputs=${cols * rows}:layout=${layout}[o]`;
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', path.join(dir, process.env.SHEET || 'sheet.png')], { stdio: 'inherit' });
} else if (mode === 'chunk' || mode === 'draft') {
  const draft = mode === 'draft', a = +rest[0], b = +rest[1], name = rest[2];
  const enc = draft ? ['-vf', 'scale=540:-2,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', path.join(OUT, name + '.mp4')]
    : ['-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', path.join(OUT, name + '.mkv')];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...enc], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    const buf = await grab(f, !draft);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 60 === 0) console.log(`${name} ${f}/${b} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`${name} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
