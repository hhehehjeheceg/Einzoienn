// =====================================================================================================
//  Project Stellar trailer (9:16): core. Canvases, maths, palette, type helpers, seeded noise, sprites.
//  Every frame is computed from the time alone: no timers, no state between frames, seeded randomness.
// =====================================================================================================
const W = 1080, H = 1920, FPS = 30, T = 60, TAU = Math.PI * 2;
const RENDER = new URLSearchParams(location.search).has('render');
if (RENDER) document.body.classList.add('render');
const out_cv = document.getElementById('c');
const main = out_cv.getContext('2d');
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }
const L2D = mk(W, H);            // 2D layer (type, cards, fx), composited over the 3D layer
let ctx = L2D.g;
function withCtx(g, fn) { const p = ctx; ctx = g; try { fn(); } finally { ctx = p; } }

// ------------------------------------------------------------------ maths
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const io = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const io5 = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
const out = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
const o5 = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 5);
const expo = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const inn = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * x;
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const fract = x => x - Math.floor(x);
// closed-form spring step response (stiffness k, damping ratio z)
function spring(t, k = 170, z = .78) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t)); }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
// an exponential "hit" envelope: 0 before b, peaks right after, decays with tau
const pulse = (t, b, tau = .18) => t < b ? 0 : (1 - Math.exp(-(t - b) / .02)) * Math.exp(-(t - b) / tau);
// value that is 1 inside [a,b] with eased edges of length e
const win = (t, a, b, e = .3) => Math.min(io(seg(t, a - e, a)), 1 - io(seg(t, b - e, b)));

// ------------------------------------------------------------------ palette ("stellar night" + Top Secret accents)
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
  night: hex('#05060f'), deep: hex('#0b0f2e'), indigo: hex('#1a1f5c'), violet: hex('#7b5cff'), lilac: hex('#b9a8ff'),
  cyan: hex('#39d0ff'), ice: hex('#bff3ff'), pink: hex('#ff4fa3'), gold: hex('#ffc93c'), goldD: hex('#b07a12'),
  red: hex('#ff2e3f'), paper: hex('#efe6d2'), ink: hex('#141218'), white: hex('#ffffff'), sky: hex('#5aa9ff'),
  build: hex('#2fa8ff'),
};
const rgb = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a <= 0 ? 0 : a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ------------------------------------------------------------------ type
const ANT = s => `400 ${s}px Anton, sans-serif`;                 // condensed display, the "battle royale" voice
const SANS = (s, w = 700) => `${w} ${s}px InterV, sans-serif`;
const UNB = (s, w = 800) => `${w} ${s}px Unbounded, sans-serif`;
const MONO = s => `500 ${s}px JBM, monospace`;
const BRI = (s, w = 800) => `${w} ${s}px Bricolage, sans-serif`;
const meas = mk(8, 8).g, mcache = new Map();
function tw(s, font, ls = 0) {
  const k = font + '|' + ls + '|' + s; let v = mcache.get(k);
  if (v === undefined) { meas.font = font; meas.letterSpacing = ls + 'px'; v = meas.measureText(s).width; mcache.set(k, v); }
  return v;
}
function txt(s, x, y, font, col, o = {}) {
  ctx.font = font; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = typeof col === 'string' || col instanceof CanvasGradient ? col : rgb(col, o.alpha === undefined ? 1 : o.alpha);
  ctx.fillText(s, x, y);
}
// fit a font size so the string fills width w
const fitSize = (s, w, fontFn, ls = 0) => w / tw(s, fontFn(100), ls * 1) * 100;
// masked rise of one line (pin 0..1 enters from below, pout 0..1 leaves through the top). centred on cx.
function riseC(s, cx, y, font, col, pin, pout, o = {}) {
  if (pin <= 0.0005 || pout >= 0.9995) return;
  const lh = o.lh || 120, ls = o.ls || 0, w = tw(s, font, ls), x = cx - w / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - lh, y - lh * 1.05, w + lh * 2, lh * 1.4); ctx.clip();
  ctx.translate(cx, y + (1 - pin) * lh * 1.15 - pout * lh * 1.3);
  ctx.rotate((1 - pin) * (o.rot ?? .05));
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 30; }
  txt(s, 0, 0, font, col, { ls, align: 'center', alpha: o.alpha });
  ctx.restore();
}
// word-by-word rise (stagger in seconds) for a centred line; returns nothing
function wordsC(line, cx, y, font, col, t0, t, tout, o = {}) {
  const ws = line.split(' '), ls = o.ls || 0, sp = tw(' ', font, ls), total = ws.reduce((a, w) => a + tw(w, font, ls), 0) + sp * (ws.length - 1);
  let x = cx - total / 2;
  ws.forEach((w, i) => {
    const ww = tw(w, font, ls), pin = o5(seg(t, t0 + i * (o.stag || .07), t0 + i * (o.stag || .07) + (o.dur || .45)));
    const pout = tout === undefined ? 0 : io(seg(t, tout + i * .03, tout + i * .03 + .35));
    riseC(w, x + ww / 2, y, font, (o.colAt ? o.colAt(i) : col), pin, pout, o);
    x += ww + sp;
  });
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }

// ------------------------------------------------------------------ glow sprites
function makeGlow(col, size = 200, core = true) {
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  if (core) gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(core ? .08 : 0, rgb(col, .85)); gr.addColorStop(.35, rgb(col, .25)); gr.addColorStop(.7, rgb(col, .05)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
const GLOW = {}, SOFT = {};
for (const k of Object.keys(C)) { GLOW[k] = makeGlow(C[k]); SOFT[k] = makeGlow(C[k], 200, false); }
function glow(sp, x, y, r, a = 1, comp = 'lighter') {
  if (a <= .003 || r <= .3) return;
  ctx.globalAlpha = Math.min(1, a); ctx.globalCompositeOperation = comp;
  ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// 4-point twinkle star (the film's recurring "stellar" glyph)
function sparkle(x, y, r, a, col = C.white, rot = 0) {
  if (a <= .003 || r <= .2) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rad = i % 2 ? r * .16 : r; ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); }
  ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  glow(GLOW.white, x, y, r * .8, a * .6);
}
// star polygon path (n points)
function starPath(x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}

// ------------------------------------------------------------------ grain tiles (seeded, 8 variants)
const GRAIN = Array.from({ length: 8 }, (_, k) => {
  const { c, g } = mk(256, 256), id = g.createImageData(256, 256), r = mulberry32(777 + k);
  for (let i = 0; i < 256 * 256; i++) { const v = 128 + (r() - .5) * 90; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
});
