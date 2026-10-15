// Pure helpers: every value is a function of time, every random value is seeded.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const io = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const out3 = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const out5 = (x) => 1 - Math.pow(1 - clamp(x), 5);
export const in3 = (x) => Math.pow(clamp(x), 3);
export const outExpo = (x) => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const inExpo = (x) => { x = clamp(x); return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); };
export const ioExpo = (x) => {
  x = clamp(x);
  if (x <= 0) return 0; if (x >= 1) return 1;
  return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
};
// soft overshoot (back) with a small, controlled amplitude
export const outBack = (x, s = 1.2) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };

// closed-form damped spring step response from 0 to 1 (damping ratio z < 1), t in seconds since start
export function spring(t, f = 2.2, z = 0.72) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}

// value that moves through keys [[t, v], ...] with an easing per segment
export function keys(t, ks, ease = io) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      const e = (ks[i][2] || ease)((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], e)) : lerp(v0, v1, e);
    }
  }
  return ks[ks.length - 1][1];
}

// fade window: 0 before a, ramps up over fin, holds, ramps down over fout before b
export const win = (t, a, b, fin = 0.2, fout = 0.2) => Math.min(smooth((t - a) / fin), smooth((b - t) / fout));

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth 1D value noise, deterministic
export function noise1(x, seed = 0) {
  const h = (i) => { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

export const TAU = Math.PI * 2;
export const deg = (d) => (d * Math.PI) / 180;
