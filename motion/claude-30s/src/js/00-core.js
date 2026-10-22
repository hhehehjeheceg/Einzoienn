'use strict';
// =====================================================================================================
//  Claude, 30 s: core (canvases, math, palette, type helpers, noise, sprites)
//  Every frame is computed from the time alone: no state between frames, no timers, every random value is seeded.
// =====================================================================================================
const W = 1920, H = 1080, FPS = 60, T = 30, SHUTTER = 0.5, TAU = Math.PI * 2;
const RENDER = new URLSearchParams(location.search).has('render');
if (RENDER) document.body.classList.add('render');
const cv = document.getElementById('c');
const main = cv.getContext('2d');
const scr = document.createElement('canvas'); scr.width = W; scr.height = H;
let ctx = scr.getContext('2d');   // every layer draws here, then it is composited (blur, shake, bloom, chroma, grain)
function withCtx(g, fn) { const prev = ctx; ctx = g; try { fn(); } finally { ctx = prev; } }   // same helpers, another canvas (textures)
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
const expo = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const inn = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * x;
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const fract = x => x - Math.floor(x);
// closed-form spring step response (stiffness k, damping ratio z, unit mass): 0 -> 1 with a small overshoot
function spring(t, k = 170, z = .8) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pulse = (t, b, a, tau = .16) => t < b ? 0 : a * (1 - Math.exp(-(t - b) / .025)) * Math.exp(-(t - b) / tau);
// keyframe track: keys = [[t, v], ...], eased per segment
function track(t, keys, ease = io) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i], e = (keys[i][2] || ease)((t - t0) / (t1 - t0));
    return Array.isArray(v0) ? v0.map((v, k) => lerp(v, v1[k], e)) : lerp(v0, v1, e);
  }
  return keys[keys.length - 1][1];
}

// ------------------------------------------------------------------ palette
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BR = {
  cream: hex('#f0eee6'), paper: hex('#faf9f5'), ink: hex('#141413'), clay: hex('#d97757'), night: hex('#0c0b0a'),
  mute: hex('#87847b'), line: hex('#d6d2c6'), dim: hex('#5e5b54'), deep: hex('#1c1a17'), white: [255, 255, 255],
};
const HU = { clay: BR.clay, coral: hex('#ff8a65'), amber: hex('#f2b45a'), mint: hex('#5fd3a6'), sky: hex('#7cb8ff'), violet: hex('#a99bff'), rose: hex('#f28fae') };
const rgb = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a <= 0 ? 0 : a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ------------------------------------------------------------------ type
const FR = (s, w = 600) => `${w} ${s}px Fraunces, serif`;
const SANS = (s, w = 600) => `${w} ${s}px InterV, Inter, sans-serif`;
const MONO = s => `500 ${s}px JBM, "JetBrains Mono", monospace`;
const ISER = s => `italic 400 ${s}px InstrSerif, serif`;
const GREETF = s => `500 ${s}px InterV, NotoJP, NotoKR, NotoSC, NotoAR, NotoDV, NotoHE, sans-serif`;

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
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }

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

// ------------------------------------------------------------------ glow sprites (additive light)
function makeGlow(col, size = 160) {
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(.1, rgb(col, .8)); gr.addColorStop(.4, rgb(col, .24));
  gr.addColorStop(.75, rgb(col, .05)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
function makeSoft(col, size = 160) {   // no white core: broad stains of colour
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, rgb(col, .9)); gr.addColorStop(.45, rgb(col, .32)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
const GLOW = {}, SOFT = {};
for (const k of Object.keys(HU)) { GLOW[k] = makeGlow(HU[k]); SOFT[k] = makeSoft(HU[k]); }
GLOW.white = makeGlow(BR.white); SOFT.white = makeSoft(BR.white); GLOW.cream = makeGlow(BR.cream); SOFT.cream = makeSoft(BR.cream);
SOFT.ink = makeSoft(BR.ink);
function glow(sp, x, y, r, a = 1, comp = 'lighter') {   // a sprite centred on (x, y), radius r
  if (a <= 0.003 || r <= 0.3) return;
  ctx.globalAlpha = a > 1 ? 1 : a; ctx.globalCompositeOperation = comp;
  ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------ slow flowing colour field (domain-warped simplex through a LUT)
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
  night: makeLUT([[0, hex('#070606')], [.45, hex('#0e0c0b')], [.7, hex('#1d1512')], [.88, hex('#3a2016')], [1, hex('#5a2c1c')]]),
  // melted colour fields: dark grounds with veins of wine, clay and amber, then brighter mixes for the drops
  ember: makeLUT([[0, hex('#050409')], [.38, hex('#0d0a17')], [.56, hex('#26123a')], [.7, hex('#5a1f47')], [.82, hex('#a8443e')], [.92, hex('#e9824a')], [1, hex('#ffc98f')]]),
  aurora: makeLUT([[0, hex('#06061a')], [.3, hex('#120f3d')], [.5, hex('#33207a')], [.66, hex('#7b2f8f')], [.8, hex('#d9536e')], [.91, hex('#ff9a5c')], [1, hex('#ffe0b0')]]),
  dusk: makeLUT([[0, hex('#0a0b1f')], [.35, hex('#1b1d4a')], [.55, hex('#3d2a6e')], [.72, hex('#8a3f7d')], [.86, hex('#e07a6e')], [1, hex('#ffcf9e')]]),
  melt: makeLUT([[0, hex('#3a1460')], [.18, hex('#7b2fa0')], [.36, hex('#e0507a')], [.52, hex('#ff7a4f')], [.68, hex('#ffb35c')], [.82, hex('#f28fae')], [1, hex('#9c8cff')]]),
  cream: makeLUT([[0, hex('#efe9df')], [.3, hex('#f5ede3')], [.55, hex('#f8e3d6')], [.75, hex('#efe2f0')], [.9, hex('#e3eef0')], [1, hex('#fbefd8')]]),
};
const FBW = 160, FBH = 90, FB = mk(FBW, FBH, true), fbImg = FB.g.createImageData(FBW, FBH), fbVal = new Float32Array(FBW * FBH);
function flowField(t, lut, o = {}) {
  const sx = o.sx || 1.6, sy = sx * .56, sp = o.sp || .06, wp = o.warp === undefined ? 1.5 : o.warp, sh = o.shade === undefined ? .5 : o.shade;
  const d = fbImg.data;
  for (let y = 0; y < FBH; y++) for (let x = 0; x < FBW; x++) {
    const nx = x / FBW * sx, ny = y / FBH * sy, z = t * sp;
    const qx = noise3(nx, ny, z), qy = noise3(nx + 5.2, ny + 1.3, z);
    fbVal[y * FBW + x] = noise3(nx + wp * qx, ny + wp * qy, z * 1.3 + 7.7) * .78 + noise3(nx * 2.3 - wp * qy, ny * 2.3 + wp * qx, z * 1.7) * .22;
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
let CUR_F = 0;   // output frame being rendered (per-frame caches: every motion-blur sub-frame reuses them)
function flowBG(name, lut, o, alpha = 1) {
  let e = FLOWCACHE[name]; if (!e) e = FLOWCACHE[name] = { key: -1, c: mk(FBW, FBH).c };
  if (e.key !== CUR_F) { flowField(CUR_F / FPS, lut, o); e.c.getContext('2d').drawImage(FB.c, 0, 0); e.key = CUR_F; }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = alpha; ctx.drawImage(e.c, 0, 0, W, H); ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ melted colour grounds: large soft blobs drifting on slow Lissajous paths,
// mixed at low resolution then upscaled (a mesh gradient). blobs: [hex, radius (x W), x, y, amp x, amp y, speed, phase, alpha]
const MG = mk(192, 108), mgx = MG.g, MGCACHE = {};
function meshGrad(name, t, base, blobs, alpha = 1) {
  let e = MGCACHE[name]; if (!e) e = MGCACHE[name] = { key: -1, c: mk(192, 108).c };
  if (e.key !== CUR_F) {
    mgx.globalCompositeOperation = 'source-over'; mgx.globalAlpha = 1; mgx.fillStyle = base; mgx.fillRect(0, 0, 192, 108);
    for (const [col, r, x, y, ax, ay, w, ph, a] of blobs) {
      const cx = (x + ax * Math.sin(t * w + ph)) * 192, cy = (y + ay * Math.cos(t * w * .83 + ph * 1.7)) * 108, R = r * 192;
      const c = hex(col), g = mgx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, rgb(c, a)); g.addColorStop(.5, rgb(c, a * .55)); g.addColorStop(1, rgb(c, 0));
      mgx.fillStyle = g; mgx.fillRect(0, 0, 192, 108);
    }
    const g2 = e.c.getContext('2d'); g2.filter = 'blur(6px)'; g2.drawImage(MG.c, -12, -12, 216, 132); g2.filter = 'none';
    e.key = CUR_F;
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = alpha; ctx.drawImage(e.c, 0, 0, W, H); ctx.globalAlpha = 1;
}
const GROUND = {   // the colour story of the film: dark embers -> violet night -> dusk -> full melt -> cream
  ember: ['#07060a', [['#3a1440', .55, .2, .3, .12, .15, .21, 0, .8], ['#6b2140', .45, .8, .75, .1, .12, .17, 2, .55], ['#a8443e', .35, .65, .2, .15, .1, .25, 4, .35], ['#1b1f5a', .6, .1, .9, .1, .1, .13, 1, .6], ['#d97757', .22, .5, .55, .2, .15, .31, 3, .18]]],
  aurora: ['#0b0820', [['#5b2a9a', .6, .25, .35, .15, .12, .35, 0, .85], ['#c2407a', .45, .75, .3, .12, .15, .42, 2, .7], ['#ff8a4c', .35, .6, .8, .18, .1, .5, 4, .6], ['#2a2a8a', .55, .1, .85, .1, .12, .3, 1, .8], ['#ffb35c', .2, .45, .55, .2, .2, .6, 5, .35]]],
  think: ['#060510', [['#1d1850', .6, .2, .3, .1, .1, .2, 0, .9], ['#4a1d4a', .45, .8, .7, .12, .1, .17, 2, .7], ['#8a3a2a', .3, .6, .4, .15, .12, .23, 4, .35], ['#13173f', .5, .5, .95, .1, .1, .15, 1, .7]]],
  dusk: ['#0b0c22', [['#3d2a6e', .6, .2, .3, .1, .1, .15, 0, .9], ['#8a3f7d', .45, .85, .35, .1, .12, .18, 2, .6], ['#e07a6e', .3, .7, .85, .12, .08, .2, 4, .35], ['#1b1d4a', .5, .3, .9, .1, .1, .12, 1, .8]]],
  melt: ['#e8604f', [['#ff9a5c', .55, .2, .3, .18, .15, .55, 0, .9], ['#f28fae', .5, .8, .3, .15, .18, .6, 2, .85], ['#8f6bff', .5, .7, .85, .2, .12, .5, 4, .8], ['#ffcf7a', .32, .4, .7, .2, .2, .7, 1, .75], ['#c2407a', .45, .1, .9, .15, .12, .45, 3, .7], ['#fff1dc', .18, .55, .45, .25, .2, .8, 5, .4]]],
  cream: ['#f3eee6', [['#f8d9c4', .5, .15, .25, .1, .1, .2, 0, .8], ['#e6dcf3', .5, .85, .3, .1, .12, .18, 2, .75], ['#d8ece6', .45, .75, .9, .12, .1, .22, 4, .7], ['#f8ecc8', .4, .25, .85, .1, .1, .16, 1, .7]]],
};
const ground = (name, t, a = 1) => meshGrad(name, t, GROUND[name][0], GROUND[name][1], a);
