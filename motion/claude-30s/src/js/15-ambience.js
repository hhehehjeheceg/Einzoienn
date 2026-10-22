// =====================================================================================================
//  Ambience shared by every scene: the beat (kick envelope, camera punches), bokeh, light leaks, lasers,
//  zoom blur and glitch on the cuts. All of it follows the score's grid, so picture and music breathe together.
// =====================================================================================================

// ------------------------------------------------------------------ kicks, as written in audio.py
const KICK_T = (() => {
  const k = [];
  for (let b = 4; b < 8; b++) k.push([bt(b), .35]);
  for (let b = 8; b < 14; b++) k.push([bt(b), .7]);
  for (let b = 16; b < 32; b++) k.push([bt(b), b < 24 ? 1 : .75]);
  for (let b = 44; b < 46; b++) k.push([bt(b), .6]);
  for (let b = 46; b < 47; b += .5) k.push([bt(b), .7]);
  for (let b = 47; b < 47.75; b += .25) k.push([bt(b), .8]);
  for (let b = 48; b < 56; b++) k.push([bt(b), 1]);
  k.push([bt(56), 1]);
  return k;
})();
function kickEnv(t, tau = .11) {
  let e = 0;
  for (const [k, a] of KICK_T) if (t >= k && t < k + .6) e = Math.max(e, a * Math.exp(-(t - k) / tau));
  return e;
}
const inDrop = t => (t >= T_DROP && t < T_THINK + BAR * 2) || (t >= T_DROP2 && t < T_FLOOD);

// ------------------------------------------------------------------ bokeh: soft discs with a brighter rim, drifting with depth
function makeBokeh(col, size = 200) {
  const { c, g } = mk(size, size), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, rgb(col, .22)); gr.addColorStop(.72, rgb(col, .32)); gr.addColorStop(.88, rgb(col, .7)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
const BOKEH = {};
for (const k of Object.keys(HU)) BOKEH[k] = makeBokeh(HU[k]);
BOKEH.cream = makeBokeh(BR.cream); BOKEH.white = makeBokeh(BR.white);
const BOKP = [];
(() => { const r = mulberry32(5150); for (let i = 0; i < 70; i++) BOKP.push({ x: r(), y: r(), z: r(), ph: r() * TAU, k: r() }); })();
function bokeh(t, hues, a = 1, near = false, drift = [0, 0]) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  BOKP.forEach((p, i) => {
    if (near !== (p.z > .82)) return;
    const z = near ? 1.4 + p.z : .4 + p.z, R = (near ? 90 : 16) + (near ? 110 : 60) * p.k;
    const x = ((p.x * (W + 400) + t * (14 + 24 * z) + drift[0] * z) % (W + 400)) - 200, y = ((p.y * (H + 300) - t * (6 + 10 * z) + drift[1] * z + 9000) % (H + 300)) - 150;
    const al = a * (near ? .1 : .16) * (.55 + .45 * Math.sin(t * 1.3 + p.ph));
    if (al <= .003) return;
    ctx.globalAlpha = al; ctx.drawImage(BOKEH[hues[i % hues.length]], x - R, y - R, 2 * R, 2 * R);
  });
  ctx.restore();
}

// ------------------------------------------------------------------ light leak: a warm blob of light crossing the frame
function lightLeak(t, t0, dur, col = HU.amber, dir = 1, a = .45) {
  const u = (t - t0) / dur; if (u <= 0 || u >= 1) return;
  const x = dir > 0 ? lerp(-500, W + 500, ss(u)) : lerp(W + 500, -500, ss(u)), y = 380 + 220 * Math.sin(u * 3);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 1000);
  g.addColorStop(0, rgb(col, a * Math.sin(Math.PI * u))); g.addColorStop(.45, rgb(col, a * .4 * Math.sin(Math.PI * u))); g.addColorStop(1, rgb(col, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------------ lasers: beams from the floor (or the ceiling), sweeping on the beat
function laser(x0, y0, ang, len, col, a, w = 1) {
  if (a <= .004) return;
  const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len;
  ctx.lineCap = 'round';
  [[46 * w, .05], [16 * w, .12], [5 * w, .45], [1.6 * w, 1]].forEach(([lw, k]) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgb(k === 1 ? BR.white : col, a * k)); g.addColorStop(.7, rgb(col, a * k * .5)); g.addColorStop(1, rgb(col, 0));
    ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  });
  glow(GLOW.white, x0, y0, 30 * w, a * .8);
}
function lasers(t, t0, t1, cols, o = {}) {
  if (t < t0 || t > t1) return;
  const fade = ss(seg(t, t0, t0 + .15)) * (1 - ss(seg(t, t1 - .3, t1))), n = o.n || 8, top = !!o.top;
  const beat = (t - T_DROP) / BEAT, k = kickEnv(t, .2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const src = [140, 620, 1300, 1780];   // four projectors, each fanning beams that cross the frame
  for (let i = 0; i < n; i++) {
    const j = i % 4, x0 = src[j], side = x0 < W / 2 ? 1 : -1;
    const sweep = side * (.25 + .3 * Math.sin(beat * Math.PI / 2 + i * 1.3)) + (i >= 4 ? -side * .45 : 0);
    const on = .5 + .5 * (Math.floor(beat * 2 + i) % 2 === 0 ? 1 : .3);
    laser(x0, top ? -20 : H + 20, top ? Math.PI - sweep : sweep, 2200, cols[i % cols.length], (o.a || .55) * fade * on * (.65 + .6 * k), 1.5);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ post effects on the composited frame: zoom blur and glitch slices
const ZB = mk(W, H), zbx = ZB.g;
function zoomBlur(amt, cx = 960, cy = 540) {
  if (amt <= .002) return;
  zbx.globalCompositeOperation = 'copy'; zbx.drawImage(cv, 0, 0);
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 1; i <= 6; i++) {
    const s = 1 + amt * i / 6;
    main.globalAlpha = 1 / (i + 1);
    main.setTransform(s, 0, 0, s, cx * (1 - s), cy * (1 - s)); main.drawImage(ZB.c, 0, 0);
  }
  main.restore();
}
function glitch(amt, seed) {
  if (amt <= .01) return;
  zbx.globalCompositeOperation = 'copy'; zbx.drawImage(cv, 0, 0);
  const r = mulberry32(seed);
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 9; i++) {
    const y = r() * H, h = 8 + r() * 70, dx = (r() - .5) * 160 * amt;
    main.drawImage(ZB.c, 0, y, W, h, dx, y, W, h);
    if (r() < .4) { main.globalCompositeOperation = 'lighter'; main.globalAlpha = .25 * amt; main.fillStyle = r() < .5 ? '#ff3d6e' : '#3dd8ff'; main.fillRect(0, y, W, h * .3); main.globalAlpha = 1; main.globalCompositeOperation = 'source-over'; }
  }
  main.restore();
}
const ZOOM_HITS = [[T_IGN, .05], [T_DROP, .14], [T_THINK, .06], [T_SEE, .05], [T_HONEST, .03], [T_DROP2, .16], [T_FLOOD, .08]];
const zoomAmt = t => { let a = 0; for (const [b, k] of ZOOM_HITS) a += pulse(t, b, k, .12); for (const w of WH_T) a += .035 * Math.sin(Math.PI * clamp((t - w[0]) / (w[1] - w[0]))); return a; };
const WH_T = [[3.52, 3.8], [4.47, 4.72], [5.4, 5.66]];
function glitchAmt(t) { let a = 0; for (const w of T_BURST) a += t >= w && t < w + .09 ? 1 - (t - w) / .09 : 0; if (t >= T_DROP && t < T_DROP + .06) a += 1; if (t >= T_DROP2 && t < T_DROP2 + .06) a += 1; return a; }

// ------------------------------------------------------------------ 3D confetti: an instanced cloud of little glazed papers that flutter
const _m = new THREE.Matrix4(), _s3 = V3(1, 1, 1), _p3 = V3();
class Confetti {
  constructor(n, parent, seed, cols) {
    const g = new THREE.PlaneGeometry(.07, .11);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: .45, metalness: .1, side: THREE.DoubleSide }), n);
    this.mesh.frustumCulled = false; parent.add(this.mesh);
    const r = mulberry32(seed), c = new THREE.Color();
    this.P = [];
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, ph = r() * TAU, s = Math.sqrt(1 - u * u), sp = 2 + r() * 7;
      this.P.push({ vx: s * Math.cos(ph) * sp, vy: Math.abs(u) * sp * .9 + 1.5, vz: s * Math.sin(ph) * sp * .6, rx: r() * TAU, ry: r() * TAU, w: 4 + r() * 8, sw: r() * TAU, sc: .7 + r() * .7, x0: r() * 2 - 1, y0: r(), z0: r() * 2 - 1 });
      c.set(cols[Math.floor(r() * cols.length)]); this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  // burst from a point: falls with drag and gravity, flutters
  burst(t, t0, origin, scale = 1) {
    const a = t - t0; this.mesh.visible = a > 0;
    if (a <= 0) return;
    this.P.forEach((p, i) => {
      const k = 2.2, f = (1 - Math.exp(-k * a)) / k;
      _p3.set(origin[0] + p.vx * f * scale + Math.sin(a * 2 + p.sw) * .15, origin[1] + p.vy * f * scale - .55 * a * a, origin[2] + p.vz * f * scale);
      _q.setFromEuler(_e.set(p.rx + a * p.w, p.ry + a * p.w * .7, a * 3));
      _s3.setScalar(p.sc * scale);
      this.mesh.setMatrixAt(i, _m.compose(_p3, _q, _s3));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // a gentle fall through a box (w, h, d) centred on c
  fall(t, c, w, h, d, speed = .35, scale = 1) {
    this.mesh.visible = true;
    this.P.forEach((p, i) => {
      const y = c[1] + h / 2 - ((p.y0 * h + t * speed * (.7 + .5 * p.sc)) % h);
      _p3.set(c[0] + p.x0 * w / 2 + Math.sin(t * 1.3 + p.sw) * .25, y, c[2] + p.z0 * d / 2);
      _q.setFromEuler(_e.set(p.rx + t * p.w * .4, p.ry + t * p.w * .3, t));
      _s3.setScalar(p.sc * scale);
      this.mesh.setMatrixAt(i, _m.compose(_p3, _q, _s3));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
