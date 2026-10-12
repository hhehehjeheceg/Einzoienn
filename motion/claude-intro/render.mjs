// Frame-exact renderer for claude-intro.html (Playwright + ffmpeg).
//   node render.mjs stills 0 1.5 3.6 ...      -> out/stills/t_<s>.png + out/stills/sheet.png
//   node render.mjs chunk <a> <b> <name>      -> out/<name>.mkv (lossless, frames a..b-1, motion blur)
//   node render.mjs draft                     -> out/draft.mp4 (30 fps, no blur, half size)
//   node render.mjs cues                      -> out/cues.json
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const URL_ = 'file://' + path.join(HERE, 'claude-intro.html') + '?render=1';
const FPS = 60, TOTAL = 40 * FPS;
const ARGS = ['--run-all-compositor-stages-before-draw', '--disable-threaded-animation',
  '--disable-checker-imaging', '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-gpu'];

async function open() {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  return { browser, page, canvas: await page.$('#c') };
}
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// read the canvas pixels directly (lossless PNG, ~8x faster than a page screenshot)
async function grab(page, canvas, f) {
  const url = await page.evaluate(f => { window.renderFrame(f); return document.getElementById('c').toDataURL('image/png'); }, f);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

const [mode, ...rest] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const { browser, page, canvas } = await open();

if (mode === 'cues') {
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(await page.evaluate(() => window.CUES), null, 1));
} else if (mode === 'stills') {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const s of rest) {
    const f = Math.min(TOTAL - 1, Math.round(parseFloat(s) * FPS));
    const file = path.join(dir, `t_${(f / FPS).toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(file, await grab(page, canvas, f)); files.push(file);
  }
  const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap(f => ['-i', f]);
  const lbl = files.map((f, i) => `[${i}:v]scale=640:-1,drawtext=text='${path.basename(f, '.png').slice(2)} s':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';');
  const pad = Array.from({ length: cols * rows - files.length }, (_, i) => `color=c=black:s=640x360:d=1[p${i}]`).join(';');
  const all = files.map((_, i) => `[v${i}]`).join('') + Array.from({ length: cols * rows - files.length }, (_, i) => `[p${i}]`).join('');
  const layout = Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${lbl}${pad ? ';' + pad : ''};${all}xstack=inputs=${cols * rows}:layout=${layout}[o]`, '-map', '[o]', '-frames:v', '1', path.join(dir, 'sheet.png')], { stdio: 'inherit' });
} else if (mode === 'chunk' || mode === 'draft') {
  const draft = mode === 'draft';
  const a = draft ? 0 : +rest[0], b = draft ? TOTAL : +rest[1], step = draft ? 2 : 1;
  const name = draft ? 'draft.mp4' : `${rest[2]}.mkv`;
  const enc = draft
    ? ['-vf', 'scale=960:-2,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast']
    : ['-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast'];
  if (draft) await page.evaluate(() => { window.__subN = window.renderFrame; window.renderFrame = f => window.seek(f / 60); });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS / step), '-i', '-', ...enc, path.join(OUT, name)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f += step) {
    const buf = await grab(page, canvas, f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 120 === 0) console.log(`${name} frame ${f}/${b} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`${name} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
