// Rendu image par image de pch3.html (Playwright + ffmpeg).
//   node render.mjs stills 0.5 3.6 9 ...        -> out/stills/*.png + out/stills/sheet.png
//   node render.mjs chunk <i> <n> <fps>         -> out/chunks/c<i>.mkv (morceau i sur n)
//   node render.mjs video <fps> [n]             -> lance n morceaux en parallèle puis assemble out/video.mkv
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const ARGS = ['--run-all-compositor-stages-before-draw', '--disable-threaded-animation', '--disable-checker-imaging',
  '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-gpu', '--disable-gpu-compositing'];

async function open() {
  const browser = await chromium.launch({ args: ARGS });
  const W = Number(process.env.W || 1080);
  const page = await browser.newPage({ viewport: { width: W, height: Math.round(W * 16 / 9) }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto('file://' + path.join(HERE, 'pch3.html') + '?render=1&w=' + (process.env.W || 1080));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  return { browser, page };
}
const shot = async (page, t, type = 'png') => {
  await page.evaluate(t => { window.seek(t); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))); }, t);
  return page.screenshot({ type, quality: type === 'jpeg' ? 94 : undefined });
};

// capture vérifiée : on refait la capture jusqu'à obtenir deux images identiques (évite les ratés d'affichage)
const shotSafe = async (page, t) => {
  let a = await shot(page, t, 'png');
  for (let i = 0; i < 6; i++) { const b = await shot(page, t, 'png'); if (a.equals(b)) return a; a = b; }
  console.error('capture instable à', t);
  return a;
};
const [mode, ...rest] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

if (mode === 'stills') {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await open();
  const files = [];
  for (const s of rest) {
    const f = path.join(dir, `t_${parseFloat(s).toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, await shotSafe(page, parseFloat(s))); files.push(f);
  }
  await browser.close();
  const cols = Math.min(5, files.length), rows = Math.ceil(files.length / cols), tw = 324, th = 576;
  const inputs = files.flatMap(f => ['-i', f]);
  const lbl = files.map((f, i) => `[${i}:v]scale=${tw}:${th},drawtext=text='${path.basename(f, '.png').slice(2)}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
  const padN = cols * rows - files.length;
  const pad = Array.from({ length: padN }, (_, i) => `color=c=black:s=${tw}x${th}:d=1[p${i}]`).join(';');
  const all = files.map((_, i) => `[v${i}]`).join('') + Array.from({ length: padN }, (_, i) => `[p${i}]`).join('');
  const layout = Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|');
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${lbl}${pad ? ';' + pad : ''};${all}xstack=inputs=${cols * rows}:layout=${layout}[o]`, '-map', '[o]', '-frames:v', '1', path.join(dir, 'sheet.png')], { stdio: 'inherit' });
  console.log('ok', files.length);
} else if (mode === 'chunk') {
  const [i, n, fps] = rest.map(Number);
  const DUR = Number(process.env.DUR || 55.0), total = Math.round(DUR * fps), a = Math.floor(total * i / n), b = Math.floor(total * (i + 1) / n);
  const dir = path.join(OUT, 'chunks'); fs.mkdirSync(dir, { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '4', '-pix_fmt', 'yuv444p', path.join(dir, `c${i}.mkv`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const { browser, page } = await open();
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    const buf = await shotSafe(page, f / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 120 === 0) console.log(`chunk ${i}: ${f - a}/${b - a} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log(`chunk ${i} done ${b - a} frames`);
} else if (mode === 'video') {
  const fps = Number(rest[0] || 30), n = Number(rest[1] || 4);
  const procs = Array.from({ length: n }, (_, i) => new Promise(res => {
    const p = spawn('node', [path.join(HERE, 'render.mjs'), 'chunk', String(i), String(n), String(fps)], { stdio: 'inherit' });
    p.on('close', res);
  }));
  await Promise.all(procs);
  const list = Array.from({ length: n }, (_, i) => `file '${path.join(OUT, 'chunks', `c${i}.mkv`)}'`).join('\n');
  fs.writeFileSync(path.join(OUT, 'chunks', 'list.txt'), list);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'chunks', 'list.txt'), '-c', 'copy', path.join(OUT, 'video.mkv')], { stdio: 'inherit' });
  console.log('video ok');
}
