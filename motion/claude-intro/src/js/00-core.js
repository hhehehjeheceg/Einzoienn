'use strict';
// =====================================================================================================
//  Claude intro v3: core (canvases, math, palette, type helpers, noise, sprites)
//  Every frame is computed from the time alone: no state, no timers, every random value is seeded.
// =====================================================================================================
const W = 1920, H = 1080, FPS = 60, T = 48, SHUTTER = 0.5, TAU = Math.PI * 2;
const RENDER = new URLSearchParams(location.search).has('render');
if (RENDER) document.body.classList.add('render');
const cv = document.getElementById('c');
const main = cv.getContext('2d');
const scr = document.createElement('canvas'); scr.width = W; scr.height = H;
let ctx = scr.getContext('2d');   // every scene draws here, then it is composited (blur, shake, bloom, chroma, grain)
const SCR_CTX = ctx;
function withCtx(g, fn) { const prev = ctx; ctx = g; try { fn(); } finally { ctx = prev; } }   // draw with the same helpers onto another canvas (card textures)
function mk(w, h, read) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d', read ? { willReadFrequently: true } : undefined) };
}

// ------------------------------------------------------------------ math
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const io = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const ioq = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
const out = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
const o5 = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 5);
const inn = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * x;
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const fract = x => x - Math.floor(x);
// closed-form spring step response (stiffness k, damping ratio z, unit mass)
function spring(t, k = 170, z = .8) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
// critically damped spring from x0 (initial velocity v0) to 0: used by the particle wordmark
const crit = (tau, w, A, v0) => (A + (v0 + w * A) * tau) * Math.exp(-w * tau);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pulse = (t, b, a, tau = .16) => t < b ? 0 : a * (1 - Math.exp(-(t - b) / .025)) * Math.exp(-(t - b) / tau);
const wrapAng = a => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };

// ------------------------------------------------------------------ palette
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BR = {
  cream: hex('#f0eee6'), paper: hex('#faf9f5'), ink: hex('#141413'), clay: hex('#d97757'), card: hex('#22211e'),
  mute: hex('#87847b'), line: hex('#d6d2c6'), bubble: hex('#34322e'), sand: hex('#cdbb9f'), warm: hex('#ead2bd'),
  dim: hex('#77746c'), chrome: hex('#4a4843'), night: hex('#0d0c12'),
};
// one hue per capability: the colour travels with the idea through the whole film
const HU = {
  coral: hex('#ff7a5a'), amber: hex('#ffb43c'), mint: hex('#3fd6a3'), sky: hex('#4fb3ff'),
  violet: hex('#9a7bff'), pink: hex('#ff6fae'), lime: hex('#b6e24a'), teal: hex('#2fd0d0'),
};
const HN = ['coral', 'amber', 'mint', 'sky', 'violet', 'pink'];
const CAP = { discuter: 'coral', coder: 'mint', analyser: 'amber', voir: 'violet', calculer: 'sky', traduire: 'pink' };
const rgb = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a <= 0 ? 0 : a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const RAINBOW = [[0, HU.coral], [.2, HU.amber], [.4, HU.mint], [.6, HU.sky], [.8, HU.violet], [1, HU.pink]];
function rainbow(u) {   // u in 0..1 along the six capability hues
  const f = clamp(u) * (HN.length - 1), i = Math.min(HN.length - 2, Math.floor(f));
  return mixc(HU[HN[i]], HU[HN[i + 1]], f - i);
}
const hueAt = i => HU[HN[((i % 6) + 6) % 6]];

// ------------------------------------------------------------------ type
const SANS = (s, w = 600) => `${w} ${s}px InterV, Inter, "IPAGothic", sans-serif`;
const SER = s => `italic 400 ${s}px InstrSerif, serif`;
const MONO = s => `500 ${s}px JBM, "DejaVu Sans Mono", monospace`;
const FRA = (s, w = 600) => `italic ${w} ${s}px Fraunces, InstrSerif, serif`;
const UNB = (s, w = 800) => `${w} ${s}px Unbounded, InterV, sans-serif`;
const SYN = (s, w = 800) => `${w} ${s}px Syne, InterV, sans-serif`;
const BRI = (s, w = 800) => `${w} ${s}px Bricolage, InterV, sans-serif`;
const ANT = s => `400 ${s}px Anton, InterV, sans-serif`;
const CAV = s => `700 ${s}px Caveat, cursive`;

const mcache = new Map();
const meas = mk(8, 8).g;
function tw(s, font, ls = 0) {
  const k = font + '|' + ls + '|' + s;
  let v = mcache.get(k);
  if (v === undefined) { meas.font = font; meas.letterSpacing = ls + 'px'; v = meas.measureText(s).width; mcache.set(k, v); }
  return v;
}
function txt(s, x, y, font, col, o = {}) {
  ctx.font = font; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = o.align || 'left';
  ctx.fillStyle = typeof col === 'string' ? col : rgb(col, o.alpha === undefined ? 1 : o.alpha);
  ctx.fillText(s, x, y);
}
function gtxt(s, x, y, font, stops, o = {}) {   // text filled with a horizontal gradient: stops = [[pos, [r,g,b], alpha?], ...]
  const w = tw(s, font, o.ls || 0), g = ctx.createLinearGradient(x, 0, x + w, 0);
  stops.forEach(([p, c, a]) => g.addColorStop(p, rgb(c, a === undefined ? (o.alpha === undefined ? 1 : o.alpha) : a)));
  ctx.font = font; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = 'left'; ctx.fillStyle = g; ctx.fillText(s, x, y);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
// masked rise: a word rises into its own line box (pin 0..1) and leaves through the top (pout 0..1)
function rise(s, x, y, font, col, pin, pout, o = {}) {
  if (pin <= 0.0005 || pout >= 0.9995) return;
  const lh = o.lh || 100, ls = o.ls || 0, rot = o.rot === undefined ? .06 : o.rot;
  const w = tw(s, font, ls);
  ctx.save();
  ctx.beginPath(); ctx.rect(x - lh * .45, y - lh * 1.02, w + lh * .9, lh * 1.36); ctx.clip();
  ctx.translate(x, y + (1 - pin) * lh * 1.12 - pout * lh * 1.4);
  ctx.rotate((1 - pin) * rot - pout * rot * .5);
  if (o.stops) gtxt(s, 0, 0, font, o.stops, { ls, alpha: o.alpha }); else txt(s, 0, 0, font, col, { ls, alpha: o.alpha });
  ctx.restore();
}
// a diagonal light sweep clipped to the shape of a word (drawn on top of the word); stops = gradient across the band
const SH = mk(1800, 560), shx = SH.g;
const SHEEN_BOW = [[0, HU.coral, 0], [.12, HU.coral, .95], [.3, HU.amber, .95], [.48, HU.mint, .95], [.66, HU.sky, .95], [.84, HU.violet, .95], [1, HU.pink, 0]];
function sheen(s, x, y, font, ls, p, stops = SHEEN_BOW, band = 340) {
  if (p <= 0 || p >= 1) return;
  shx.setTransform(1, 0, 0, 1, 0, 0); shx.globalCompositeOperation = 'source-over'; shx.clearRect(0, 0, 1800, 560);
  shx.font = font; shx.letterSpacing = ls + 'px'; shx.textAlign = 'left'; shx.fillStyle = '#000'; shx.fillText(s, 60, 400);
  shx.globalCompositeOperation = 'source-in';
  const w = tw(s, font, ls), cx = 60 - band + (w + 2 * band) * p;
  const g = shx.createLinearGradient(cx - band / 2, 0, cx + band / 2, 0);
  stops.forEach(([q, c, a]) => g.addColorStop(q, rgb(c, a)));
  shx.setTransform(1, 0, -.42, 1, 0, 0); shx.fillStyle = g; shx.fillRect(-500, 0, 2800, 560);
  ctx.drawImage(SH.c, x - 60, y - 400);
}

// ------------------------------------------------------------------ simplex noise (3D, seeded)
const noise3 = (() => {
  const G = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  const r = mulberry32(90210), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = perm[i] % 12; }
  const F3 = 1 / 3, G3 = 1 / 6;
  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3, x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0, tt = .6 - x0 * x0 - y0 * y0 - z0 * z0, g;
    if (tt > 0) { g = G[pm[ii + perm[jj + perm[kk]]]]; tt *= tt; n0 = tt * tt * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
    tt = .6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (tt > 0) { g = G[pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; tt *= tt; n1 = tt * tt * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
    tt = .6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (tt > 0) { g = G[pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; tt *= tt; n2 = tt * tt * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
    tt = .6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (tt > 0) { g = G[pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; tt *= tt; n3 = tt * tt * (g[0] * x3 + g[1] * y3 + g[2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };
})();

// ------------------------------------------------------------------ glow sprites (additive light), bokeh discs
function makeGlow(col, size = 160) {
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(.1, rgb(col, .8)); gr.addColorStop(.4, rgb(col, .24));
  gr.addColorStop(.75, rgb(col, .05)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
function makeSoft(col, size = 160) {   // no white core: for broad stains of colour
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, rgb(col, .9)); gr.addColorStop(.45, rgb(col, .32)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
function makeBokeh(col, size = 200) {
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, rgb(col, .30)); gr.addColorStop(.78, rgb(col, .42)); gr.addColorStop(.9, rgb(col, .8)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
const GLOW = {}, SOFT = {}, BOKEH = {};
for (const k of Object.keys(HU)) { GLOW[k] = makeGlow(HU[k]); SOFT[k] = makeSoft(HU[k]); BOKEH[k] = makeBokeh(HU[k]); }
GLOW.white = makeGlow([255, 255, 255]); SOFT.white = makeSoft([255, 255, 255]); GLOW.clay = makeGlow(BR.clay); SOFT.clay = makeSoft(BR.clay);
GLOW.cream = makeGlow(BR.cream); SOFT.ink = makeSoft(BR.ink);
function glow(sp, x, y, r, a = 1, comp = 'lighter') {   // draw a sprite centred, radius r
  if (a <= 0.003 || r <= 0.3) return;
  ctx.globalAlpha = a > 1 ? 1 : a; ctx.globalCompositeOperation = comp;
  ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------ colour LUTs (256 entries) for the flowing backgrounds
function makeLUT(stops) {
  const L = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const u = i / 255; let k = 0; while (k < stops.length - 2 && u > stops[k + 1][0]) k++;
    const [p0, c0] = stops[k], [p1, c1] = stops[k + 1], f = clamp((u - p0) / (p1 - p0)), c = mixc(c0, c1, f * f * (3 - 2 * f));
    L[i * 3] = c[0]; L[i * 3 + 1] = c[1]; L[i * 3 + 2] = c[2];
  }
  return L;
}
const LUT = {
  pastel: makeLUT([[0, hex('#f3efe6')], [.28, hex('#f9e3d5')], [.5, hex('#e9e1f9')], [.72, hex('#d9f1ee')], [1, hex('#fbf0d0')]]),
  pastelHot: makeLUT([[0, hex('#f6efe4')], [.25, hex('#fbe1d0')], [.5, hex('#ebe3fb')], [.75, hex('#d8eef3')], [1, hex('#fdf1cc')]]),
  world: makeLUT([[0, hex('#0b0a10')], [.42, hex('#110f22')], [.62, hex('#1e1649')], [.78, hex('#3a2086')], [.9, hex('#7a2a8f')], [1, hex('#c4466e')]]),
  teal: makeLUT([[0, hex('#000000')], [.5, hex('#02121a')], [.7, hex('#07303b')], [.86, hex('#12606b')], [1, hex('#1fa3a0')]]),
  sunset: makeLUT([[0, hex('#0f0a36')], [.28, hex('#241470')], [.52, hex('#5a1f8e')], [.72, hex('#b3338a')], [.88, hex('#f2566f')], [1, hex('#ff9a62')]]),
  vivid: makeLUT([[0, hex('#fff1e6')], [.22, hex('#ffcfb4')], [.45, hex('#d8caff')], [.68, hex('#b4ecf2')], [.86, hex('#ffe69a')], [1, hex('#ffd0e6')]]),
};
const FBW = 176, FBH = 99, FB = mk(FBW, FBH, true), fbImg = FB.g.createImageData(FBW, FBH), fbVal = new Float32Array(FBW * FBH);
// domain-warped simplex field mapped through a LUT: silky, slowly moving colour (cached per frame by the callers)
function flowField(t, lut, o = {}) {
  const sx = o.sx || 1.6, sy = (o.sy || sx * .56), sp = o.sp || .06, wp = o.warp === undefined ? 1.5 : o.warp, off = o.off || 0, sh = o.shade === undefined ? .5 : o.shade;
  const d = fbImg.data;
  for (let y = 0; y < FBH; y++) for (let x = 0; x < FBW; x++) {
    const nx = x / FBW * sx + off, ny = y / FBH * sy, z = t * sp;
    const qx = noise3(nx, ny, z), qy = noise3(nx + 5.2, ny + 1.3, z);
    const v = noise3(nx + wp * qx, ny + wp * qy, z * 1.3 + 7.7) * .78 + noise3(nx * 2.3 - wp * qy, ny * 2.3 + wp * qx, z * 1.7) * .22;
    fbVal[y * FBW + x] = v;
  }
  for (let y = 0; y < FBH; y++) for (let x = 0; x < FBW; x++) {
    const i = y * FBW + x, v = fbVal[i];
    const a = fbVal[Math.min(FBH - 1, y + 1) * FBW + Math.min(FBW - 1, x + 1)], b = fbVal[Math.max(0, y - 1) * FBW + Math.max(0, x - 1)];
    const li = 1 + (b - a) * sh * 1.6, idx = clamp(v * (o.gain || 1.25) * .5 + .5 + (o.bias || 0)) * 255 | 0, j = i * 4;
    d[j] = clamp(lut[idx * 3] * li, 0, 255); d[j + 1] = clamp(lut[idx * 3 + 1] * li, 0, 255); d[j + 2] = clamp(lut[idx * 3 + 2] * li, 0, 255); d[j + 3] = 255;
  }
  FB.g.putImageData(fbImg, 0, 0);
  return FB.c;
}
const FLOWCACHE = {};
function flowBG(f, name, lut, o, alpha = 1, comp = 'source-over') {   // computed once per output frame, reused by every motion-blur sub-frame
  let e = FLOWCACHE[name]; if (!e) e = FLOWCACHE[name] = { key: -1, c: mk(FBW, FBH).c };
  if (e.key !== f) { flowField(f / FPS, lut, o); e.c.getContext('2d').drawImage(FB.c, 0, 0); e.key = f; }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = comp;
  ctx.drawImage(e.c, 0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
let CUR_F = 0;   // output frame being rendered (for per-frame caches)
