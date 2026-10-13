// =====================================================================================================
//  E (part 2): the 3D world, 16.0 - 28.0 s.
//  A real little 3D engine on a 2D canvas: camera with yaw / pitch / roll, perspective projection,
//  perspective-correct textured quads (cards, with mirror reflections on the floor), wireframe solids,
//  light ribbons, stars, bokeh, a glowing floor grid, speed lines. Everything is a function of t.
// =====================================================================================================
const FOC = 1100, FLOOR = 300, ZDOT = 12400, DF = 860;
const WS = {};   // world state built at init (stations, objects, ribbons, stars...)

// ------------------------------------------------------------------ camera
function mkCam(x, y, z, yaw, pitch, roll) { return { x, y, z, yaw, pitch, roll, cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), cr: Math.cos(roll), sr: Math.sin(roll) }; }
function proj(px, py, pz, c, o) {
  const dx = px - c.x, dy = py - c.y, dz = pz - c.z;
  const xc = dx * c.cy - dz * c.sy, z0 = dx * c.sy + dz * c.cy, yc = dy * c.cp - z0 * c.sp, zc = dy * c.sp + z0 * c.cp;
  o.d = zc; if (zc < 1) { o.x = o.y = 0; o.s = 0; return o; }
  const sx = FOC * xc / zc, sy = FOC * yc / zc;
  o.x = 960 + sx * c.cr - sy * c.sr; o.y = 540 + sx * c.sr + sy * c.cr; o.s = FOC / zc; return o;
}
const depthOf = (px, py, pz, c) => { const dx = px - c.x, dy = py - c.y, dz = pz - c.z, z0 = dx * c.sy + dz * c.cy; return dy * c.sp + z0 * c.cp; };
function stationOf(k) {
  const c = CARDS[k], n = [Math.sin(c.yaw), -Math.cos(c.yaw)];
  return { x: c.x + n[0] * DF, y: c.y + 8, z: c.z + n[1] * DF, yaw: -c.yaw, pitch: 0, roll: 0 };
}
function driftOf(k, t) {
  const s = WS.st[k], u = io(seg(t, ARR[k], LEAVE[k])), d = k % 2 ? -1 : 1, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  return { x: s.x + rx * d * 30 * u + fx * 90 * u, y: s.y + 6 * u, z: s.z + rz * d * 30 * u + fz * 90 * u, yaw: s.yaw + d * .03 * u, pitch: -.012 * u, roll: d * .014 * Math.sin(Math.PI * u) + .006 * Math.sin(t * 1.3 + k) };
}
function camAt(t) {
  let c;
  if (t < ARR[0]) {
    const u = seg(t, T_DIVE, ARR[0]), uz = ioq(u), ux = io(u), s0 = { x: 420, y: -180, z: -1400, yaw: .35, pitch: .12, roll: -.11 }, S = WS.st[0];
    c = { x: lerp(s0.x, S.x, ux), y: lerp(s0.y, S.y, uz), z: lerp(s0.z, S.z, uz), yaw: lerp(s0.yaw, S.yaw, ux), pitch: lerp(s0.pitch, 0, ux), roll: lerp(s0.roll, 0, ux) };
  } else {
    for (let k = 0; k < 6 && !c; k++) {
      if (t < LEAVE[k]) c = driftOf(k, t);
      else if (k < 5 && t < ARR[k + 1]) {
        const u = io(seg(t, LEAVE[k], ARR[k + 1])), a = driftOf(k, LEAVE[k]), b = driftOf(k + 1, ARR[k + 1]), sg = k % 2 ? -1 : 1, yaw = a.yaw + wrapAng(b.yaw - a.yaw) * u;
        const bulge = 240 * Math.sin(Math.PI * u) * -sg;
        c = { x: lerp(a.x, b.x, u) + Math.cos(yaw) * bulge, y: lerp(a.y, b.y, u) - 46 * Math.sin(Math.PI * u), z: lerp(a.z, b.z, u) - Math.sin(yaw) * bulge, yaw, pitch: -.05 * Math.sin(Math.PI * u), roll: sg * .085 * Math.sin(Math.PI * u) };
      }
    }
    if (!c) {   // dive into the far dot: its on-screen radius grows exponentially until it fills the frame
      const p = driftOf(5, LEAVE[5]), ux = out(seg(t, LEAVE[5], LEAVE[5] + .45)), u1 = Math.pow(seg(t, LEAVE[5], T_DOT), 1.6);
      const r0 = 30 * FOC / (ZDOT - p.z), r = r0 * Math.pow(1300 / r0, u1);
      c = { x: lerp(p.x, 0, ux), y: lerp(p.y, 0, ux), z: ZDOT - 30 * FOC / r, yaw: lerp(p.yaw, 0, ux), pitch: lerp(p.pitch, 0, ux), roll: .6 * inn(seg(t, LEAVE[5], T_DOT)) };
    }
  }
  for (let b = 16.5; b < 27.2; b += .5) c.z += 14 * pulse(t, b, 1, .14);
  return mkCam(c.x, c.y, c.z, c.yaw, c.pitch, c.roll);
}
const camSpeed = t => { const a = camAt(t - .012), b = camAt(t + .012); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / .024; };

// ------------------------------------------------------------------ perspective-correct textured quads
function drawTri(img, a, b, c, s0, s1, s2, u0, v0, uw, vh) {
  const du1 = b[0] - a[0], dv1 = b[1] - a[1], du2 = c[0] - a[0], dv2 = c[1] - a[1], det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-6) return;
  const dx1 = s1.x - s0.x, dy1 = s1.y - s0.y, dx2 = s2.x - s0.x, dy2 = s2.y - s0.y;
  const m0 = (dx1 * dv2 - dx2 * dv1) / det, m2 = (dx2 * du1 - dx1 * du2) / det, m1 = (dy1 * dv2 - dy2 * dv1) / det, m3 = (dy2 * du1 - dy1 * du2) / det;
  const e = s0.x - m0 * a[0] - m2 * a[1], f = s0.y - m1 * a[0] - m3 * a[1];
  const cx = (s0.x + s1.x + s2.x) / 3, cy = (s0.y + s1.y + s2.y) / 3, ex = (p, q) => { const dx = p - cx, dy = q - cy, l = Math.hypot(dx, dy) || 1; return [p + dx / l * .8, q + dy / l * .8]; };
  ctx.save(); ctx.beginPath();
  [s0, s1, s2].forEach((s, i) => { const [x, y] = ex(s.x, s.y); ctx[i ? 'lineTo' : 'moveTo'](x, y); });
  ctx.closePath(); ctx.clip(); ctx.setTransform(m0, m1, m2, m3, e, f);
  ctx.drawImage(img, u0 - 1.2, v0 - 1.2, uw + 2.4, vh + 2.4, u0 - 1.2, v0 - 1.2, uw + 2.4, vh + 2.4);
  ctx.restore();
}
const _v = [];
function drawCardQuad(k, img, psi, sc, cam, mirror, alpha) {
  const c = CARDS[k], par = Math.abs(psi + cam.yaw) < .006 && Math.abs(cam.pitch) < .006 && !mirror, gx = par ? 1 : 8, gy = par ? 1 : (mirror ? 8 : 5);
  const cp = Math.cos(psi), sp = Math.sin(psi), W_ = img.width, H_ = img.height;
  for (let j = 0; j <= gy; j++) for (let i = 0; i <= gx; i++) {
    const lx = (i / gx - .5) * CW * sc, ly = (j / gy - .5) * CH * sc, y = c.y + ly;
    const o = _v[j * 9 + i] || (_v[j * 9 + i] = {}); proj(c.x + lx * cp, mirror ? 2 * FLOOR - y : y, c.z + lx * sp, cam, o);
    if (o.d < 30) return;
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  for (let j = 0; j < gy; j++) {
    const row = mirror ? alpha * Math.pow((j + .5) / gy, 1.7) : alpha; if (row < .004) continue;
    ctx.globalAlpha = row;
    for (let i = 0; i < gx; i++) {
      const v00 = _v[j * 9 + i], v10 = _v[j * 9 + i + 1], v01 = _v[(j + 1) * 9 + i], v11 = _v[(j + 1) * 9 + i + 1];
      const u0 = i / gx * W_, u1 = (i + 1) / gx * W_, w0 = j / gy * H_, w1 = (j + 1) / gy * H_;
      drawTri(img, [u0, w0], [u1, w0], [u0, w1], v00, v10, v01, u0, w0, u1 - u0, w1 - w0);
      drawTri(img, [u1, w0], [u1, w1], [u0, w1], v10, v11, v01, u0, w0, u1 - u0, w1 - w0);
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ world content
function wireGeom(type) {
  if (type === 'cube') { const V = []; for (let i = 0; i < 8; i++) V.push([(i & 1) * 2 - 1, ((i >> 1) & 1) * 2 - 1, ((i >> 2) & 1) * 2 - 1]); const E = []; for (let i = 0; i < 8; i++) for (let b = 0; b < 3; b++) if (!(i & (1 << b))) E.push([i, i | (1 << b)]); return { V, E }; }
  if (type === 'octa') return { V: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => v.map(x => x * 1.3)), E: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]] };
  if (type === 'ico') { const p = (1 + Math.sqrt(5)) / 2, V = []; [[0, 1, p], [0, -1, p], [0, 1, -p], [0, -1, -p]].forEach(([a, b, c]) => { V.push([a, b, c], [b, c, a], [c, a, b]); }); V.forEach(v => { const l = Math.hypot(...v); v[0] /= l; v[1] /= l; v[2] /= l; }); const E = []; for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) < 1.08) E.push([i, j]); return { V: V.map(v => v.map(x => x * 1.25)), E }; }
  const V = [], E = []; for (let i = 0; i < 48; i++) { const a = i * TAU / 48; V.push([Math.cos(a), 0, Math.sin(a)]); E.push([i, (i + 1) % 48]); } for (let i = 0; i < 48; i++) { const a = i * TAU / 48; V.push([Math.cos(a) * .72, Math.sin(a) * .72, 0]); E.push([48 + i, 48 + (i + 1) % 48]); } return { V, E };
}
function initLayoutE() {
  initLayoutCards();
  WS.st = CARDS.map((_, k) => stationOf(k));
  const r = mulberry32(2024);
  WS.geo = { cube: wireGeom('cube'), octa: wireGeom('octa'), ico: wireGeom('ico'), ring: wireGeom('ring') };
  WS.wire = []; const types = ['ico', 'cube', 'ring', 'octa'];
  for (let i = 0; i < 20 && WS.wire.length < 16; i++) {
    const z = 600 + i * 640 + r() * 300, side = i % 2 ? 1 : -1, o = { type: types[i % 4], x: side * (880 + r() * 700), y: -520 + r() * 1000, z, s: 90 + r() * 110, rx: r() * 6, ry: r() * 6, vx: .2 + r() * .5, vy: .3 + r() * .6, hue: HN[i % 6] };
    if (CARDS.some(c => Math.hypot(c.x - o.x, c.z - o.z) < 700)) continue; WS.wire.push(o);
  }
  WS.rib = Array.from({ length: 9 }, (_, i) => ({ hue: HN[i % 6], x0: (r() - .5) * 700, y0: (r() - .5) * 420, ph: r() * TAU, z0: -800 + i * 1450, dz: 90 + r() * 30 }));
  WS.stars = Array.from({ length: 560 }, () => ({ x: (r() - .5) * 8000, y: (r() - .5) * 4600, z: -600 + r() * 14400, ph: r() * TAU, hue: r() < .22 ? HN[Math.floor(r() * 6)] : null, s: .7 + r() * 1.8 }));
  WS.bokeh = Array.from({ length: 30 }, (_, i) => { let x, y; do { x = (r() - .5) * 3000; y = (r() - .5) * 1700; } while (Math.abs(x) < 380 && Math.abs(y) < 300); return { x, y, z: 300 + i * 430 + r() * 300, rad: 60 + r() * 130, hue: HN[Math.floor(r() * 6)], ph: r() * TAU }; });
  WS.ghost = []; while (WS.ghost.length < 30) { const g = { x: -2100 + r() * 4200, y: -1150 + r() * 2000, z: 300 + r() * 12000, w: 300 + r() * 380 }; g.h = g.w * (.56 + r() * .14); g.l = [.4 + r() * .5, .3 + r() * .5, .5 + r() * .4]; g.hue = HN[Math.floor(r() * 6)]; g.yaw = (g.x < 0 ? 1 : -1) * (.2 + r() * .25); if (Math.abs(g.x) < 900 && Math.abs(g.y) < 600) continue; if (CARDS.some(c => Math.hypot(c.x - g.x, c.z - g.z) < 900)) continue; WS.ghost.push(g); }
  WS.glyphs = []; const GL = '{}()<>/;=+*#@&%?!λπ∑∫√é§01'; while (WS.glyphs.length < 90) { const g = { x: -2300 + r() * 4600, y: -1300 + r() * 2300, z: 150 + r() * 13200, ch: GL[Math.floor(r() * GL.length)], s: 40 + r() * 80, r: (r() - .5) * .8, v: (r() - .5) * .5, c: r() < .5, hue: HN[Math.floor(r() * 6)] }; if (Math.abs(g.x) < 1150 && Math.abs(g.y) < 520) continue; WS.glyphs.push(g); }
  WS.speed = Array.from({ length: 70 }, () => ({ a: r() * TAU, r0: 120 + r() * 400, hue: r() < .5 ? null : HN[Math.floor(r() * 6)] }));
  // sparks when the camera locks onto a card
  CARDS.forEach((c, k) => addBurst({ t0: ARR[k] - .02, x: 960, y: 540, n: 30, speed: 900, life: .8, size: 5, shape: k % 2 ? 'star' : 'dot', hues: [c.hue, HN[(HN.indexOf(c.hue) + 1) % 6], 'amber'], light: true, tag: 'E', seed: 5100 + k, drag: 3 }));
}

// ------------------------------------------------------------------ environment layers
function curCard(t) { let k = 0; ARR.forEach((a, i) => { if (t >= a - .6) k = i; }); return k; }
function worldBG(t, cam) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(960, 500, 0, 960, 540, 1300); g.addColorStop(0, '#201e2b'); g.addColorStop(1, '#0a090e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  flowBG(CUR_F, 'world', LUT.world, { sx: 1.0, sp: .03, warp: 1.3, gain: 1.2, shade: .2, off: cam.yaw * .5 + cam.x * .00025 }, .85, 'lighter');
  flowBG(CUR_F, 'world2', LUT.teal, { sx: 1.3, sp: .027, warp: 1.1, gain: 1.15, shade: .15, off: 9 - cam.yaw * .4 - cam.x * .0002 }, .75, 'lighter');
  const k = curCard(t), h1 = CARDS[k].hue, h2 = CARDS[Math.min(5, k + 1)].hue, ox = -cam.yaw * 700, oy = cam.pitch * 500;
  glow(SOFT[h1], 520 + ox, 380 + oy, 900, .26, 'lighter'); glow(SOFT[h2], 1480 + ox, 760 + oy, 820, .2, 'lighter'); glow(SOFT.violet, 960 + ox * .5, 160, 700, .16, 'lighter');
}
function drawStars(t, cam) {
  const buckets = {};
  for (const s of WS.stars) {
    const o = proj(s.x, s.y, s.z, cam, _p); if (o.d < 80 || o.d > 9500 || o.x < -20 || o.x > W + 20 || o.y < -20 || o.y > H + 20) continue;
    const sz = clamp(s.s * 900 / o.d, .7, 3.6), a = (.35 + .5 * Math.sin(t * 2.1 + s.ph) * .5 + .25) * (1 - o.d / 11000);
    (buckets[s.hue || 'w'] || (buckets[s.hue || 'w'] = [])).push(o.x, o.y, sz, a);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const key in buckets) { const b = buckets[key], col = key === 'w' ? BR.cream : HU[key]; for (let i = 0; i < b.length; i += 4) { ctx.fillStyle = rgb(col, clamp(b[i + 3])); ctx.fillRect(b[i] - b[i + 2], b[i + 1] - b[i + 2], b[i + 2] * 2, b[i + 2] * 2); } }
  ctx.globalCompositeOperation = 'source-over';
}
const _p = { x: 0, y: 0, d: 0, s: 0 }, _q = { x: 0, y: 0, d: 0, s: 0 };
function clipSeg(ax, ay, az, bx, by, bz, cam) {
  let da = depthOf(ax, ay, az, cam), db = depthOf(bx, by, bz, cam); const N = 40;
  if (da < N && db < N) return null;
  if (da < N) { const u = (N - da) / (db - da); ax += (bx - ax) * u; ay += (by - ay) * u; az += (bz - az) * u; } else if (db < N) { const u = (N - db) / (da - db); bx += (ax - bx) * u; by += (ay - by) * u; bz += (az - bz) * u; }
  proj(ax, ay, az, cam, _p); proj(bx, by, bz, cam, _q); return [_p.x, _p.y, _q.x, _q.y];
}
function drawFloor(t, cam) {
  const fa = seg(t, 16.1, 16.7); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const zN = cam.z - 300, zF = cam.z + 9500;
  for (let x = -3200; x <= 3200; x += 240) {
    const s = clipSeg(x, FLOOR, zN, x, FLOOR, zF, cam); if (!s) continue;
    const g = ctx.createLinearGradient(s[0], s[1], s[2], s[3]); const c = mixc(HU.violet, HU.sky, (x + 3200) / 6400); g.addColorStop(0, rgb(c, .55 * fa)); g.addColorStop(.35, rgb(c, .2 * fa)); g.addColorStop(1, rgb(c, 0));
    ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
  }
  const z0 = Math.ceil(zN / 360) * 360;
  for (let z = z0; z < zF; z += 360) {
    const s = clipSeg(-3200, FLOOR, z, 3200, FLOOR, z, cam); if (!s) continue;
    const d = depthOf(0, FLOOR, z, cam), a = clamp(1 - d / 9000) * .5 * fa; if (a < .01) continue;
    ctx.strokeStyle = rgb(mixc(HU.pink, HU.coral, clamp(d / 6000)), a); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
  }
  // horizon glow at the vanishing point of the floor
  const hp = proj(cam.x, FLOOR, cam.z + 30000, cam, _p);
  if (_p.d > 1) { ctx.setTransform(1400, 0, 0, 120, _p.x, _p.y); ctx.globalAlpha = .55 * fa; ctx.drawImage(SOFT.violet, -1, -1, 2, 2); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }
  ctx.globalCompositeOperation = 'source-over';
}
function drawRibbons(t, cam) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const fa = seg(t, 16.3, 17);
  for (const rb of WS.rib) {
    const pts = [];
    for (let s = 0; s <= 72; s++) {
      const z = rb.z0 + s * rb.dz * 3, x = rb.x0 + 380 * Math.sin(z * .0021 + rb.ph + t * .5) + 120 * Math.sin(z * .0057 + t * .8 + rb.ph * 2), y = rb.y0 + 260 * Math.cos(z * .0017 + rb.ph * 1.3 + t * .4) + 90 * Math.sin(z * .0049 + t * .7);
      const o = proj(x, y, z, cam, {}); pts.push(o);
    }
    for (let c = 0; c < 72; c += 6) {
      const seg_ = pts.slice(c, c + 7); if (seg_.some(p => p.d < 60)) continue; const d = seg_[3].d, a = clamp(1 - d / 8500) * clamp((d - 60) / 400) * fa; if (a < .02) continue;
      const lw = clamp(26 * seg_[3].s, 1.5, 12);
      [[lw * 3, .05], [lw * 1.4, .16], [lw * .5, .8]].forEach(([w, al], pass) => { ctx.strokeStyle = pass === 2 ? rgb(mixc(HU[rb.hue], [255, 255, 255], .45), al * a) : rgb(HU[rb.hue], al * a); ctx.lineWidth = w; ctx.beginPath(); seg_.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y)); ctx.stroke(); });
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawWire(o, t, cam) {
  const g = WS.geo[o.type], ax = o.rx + o.vx * t, ay = o.ry + o.vy * t, ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), P = [];
  for (const v of g.V) { let x = v[0], y = v[1] * ca - v[2] * sa, z = v[1] * sa + v[2] * ca; const x2 = x * cb + z * sb, z2 = -x * sb + z * cb; P.push(proj(o.x + x2 * o.s, o.y + y * o.s, o.z + z2 * o.s, cam, {})); }
  if (P.some(p => p.d < 40)) return;
  const d = P[0].d, a = clamp(1 - d / 9000) * clamp((d - 100) / 400) * .9 * seg(t, 16.3, 17); if (a < .02) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  [[5, .1], [1.8, .85]].forEach(([w, al]) => { ctx.strokeStyle = rgb(HU[o.hue], al * a); ctx.lineWidth = clamp(w * P[0].s * 6, 1, w * 2.2); ctx.beginPath(); for (const [i, j] of g.E) { ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[j].x, P[j].y); } ctx.stroke(); });
  ctx.globalCompositeOperation = 'source-over';
}
function drawGhost(g, t, cam) {
  const cp = Math.cos(g.yaw), sp = Math.sin(g.yaw), C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => proj(g.x + a * g.w / 2 * cp, g.y + b * g.h / 2, g.z + a * g.w / 2 * sp, cam, {}));
  if (C.some(p => p.d < 60)) return;
  const d = C[0].d, on = spring(t - (16.1 + .01 * (g.z % 20)), 150, .85), a = clamp(on) * clamp((d - 80) / 380) * (1 - .8 * clamp((d - 1000) / 11500)); if (a < .02) return;
  ctx.globalAlpha = a; ctx.beginPath(); C.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y)); ctx.closePath();
  ctx.fillStyle = 'rgba(240,238,230,0.06)'; ctx.fill(); ctx.strokeStyle = rgb(HU[g.hue], .35); ctx.lineWidth = clamp(1.6 * C[0].s * 10, 1, 3); ctx.stroke();
  g.l.forEach((f, j) => { const v = -.5 + (.18 + j * .16), ax = -.5 + .06, bx = ax + (1 - .12) * f; const p0 = proj(g.x + (ax) * g.w * cp, g.y + v * g.h, g.z + ax * g.w * sp, cam, _p), x0 = _p.x, y0 = _p.y; proj(g.x + bx * g.w * cp, g.y + v * g.h, g.z + bx * g.w * sp, cam, _q); ctx.strokeStyle = 'rgba(240,238,230,0.1)'; ctx.lineWidth = clamp(8 * C[0].s, 1, 8); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(_q.x, _q.y); ctx.stroke(); });
  const dotp = proj(g.x + (-.5 + .07) * g.w * cp, g.y - (.5 - .08) * g.h, g.z + (-.5 + .07) * g.w * sp, cam, _p); circ(_p.x, _p.y, clamp(7 * _p.s * 3, 1.5, 9)); ctx.fillStyle = rgb(HU[g.hue], .9); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawGlyph(g, t, cam) {
  const o = proj(g.x, g.y - 30 * t, g.z, cam, _p); if (o.d < 80 || o.x < -200 || o.x > W + 200 || o.y < -200 || o.y > H + 200) return;
  const a = .6 * seg(t, 16.15, 16.6) * clamp((o.d - 80) / 300) * (1 - .85 * clamp((o.d - 800) / 12000)), s = o.s * g.s / 60;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(g.r + g.v * t + cam.roll); ctx.scale(s, s); ctx.font = MONO(60); ctx.letterSpacing = '0px'; ctx.textAlign = 'center';
  ctx.fillStyle = g.c ? rgb(HU[g.hue], a) : rgb(BR.cream, a * .6); ctx.fillText(g.ch, 0, 20); ctx.restore();
}
function drawBokeh(t, cam, front) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
  for (const b of WS.bokeh) {
    const o = proj(b.x, b.y, b.z, cam, _p); if (o.d < 120) continue;
    const near = o.d < 2400; if (near !== front) continue;
    const a = (front ? .26 : .1) * clamp((o.d - 120) / 500) * (1 - clamp((o.d - 1700) / 800)) * seg(t, 16.3, 17) * (.7 + .3 * Math.sin(t * 1.2 + b.ph)); if (a < .01) continue;
    const r = b.rad * o.s; ctx.globalAlpha = a; ctx.drawImage(BOKEH[b.hue], o.x - r, o.y - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawSpeedLines(t, cam) {
  const sp = camSpeed(t), a = clamp((sp - 1200) / 3600) * seg(t, 16.3, 16.8); if (a < .02) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  WS.speed.forEach((s, i) => {
    const r0 = (s.r0 + (t * 900 + i * 53) % 900) * (1 + a), L_ = 40 + 360 * a * (.4 + .6 * ((i * 37) % 10) / 10);
    ctx.strokeStyle = s.hue ? rgb(HU[s.hue], .5 * a) : rgb(BR.cream, .4 * a); ctx.lineWidth = 1.4 + 1.6 * a;
    ctx.beginPath(); ctx.moveTo(960 + Math.cos(s.a) * r0, 540 + Math.sin(s.a) * r0 * .6); ctx.lineTo(960 + Math.cos(s.a) * (r0 + L_), 540 + Math.sin(s.a) * (r0 + L_) * .6); ctx.stroke();
  });
  ctx.globalCompositeOperation = 'source-over';
}
function drawWorldHUD(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const k = curCard(t), fa = seg(t, 16.5, 17);
  CARDS.forEach((c, i) => {
    const y = 420 + i * 44, on = i === k;
    ctx.fillStyle = rgb(on ? HU[c.hue] : BR.cream, (on ? .95 : .3) * fa); ctx.fillRect(66, y, on ? 30 : 16, 3);
    if (on) { glow(GLOW[c.hue], 80, y + 1, 30, .6 * fa); txt(String(i + 1).padStart(2, '0') + '  ' + c.name.toUpperCase(), 108, y + 6, MONO(15), HU[c.hue], { ls: 3, alpha: fa }); }
  });
}
function drawFarDot(t, cam, M) {
  const o = proj(0, 0, ZDOT, cam, _p); if (o.d < 40) return;
  const s = o.s, a = seg(t, 26.9, 27.2);
  ctx.globalAlpha = a; glow(GLOW.clay, o.x, o.y, 140 * s, .7); glow(GLOW.amber, o.x, o.y, 300 * s, .25);
  circ(o.x, o.y, 30 * s); ctx.fillStyle = rgb(BR.clay); ctx.fill(); ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ the world frame
function world3D(t) {
  const cam = camAt(t);
  worldBG(t, cam); drawStars(t, cam); drawFloor(t, cam); drawRibbons(t, cam); drawBokeh(t, cam, false);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // reflections of the near cards on the floor
  CARDS.forEach((c, k) => {
    const on = spring(t - (16.1 + .05 * k), 150, .82), psi = c.yaw + .035 * Math.sin(1.3 * t + k), d = depthOf(c.x, c.y, c.z, cam);
    if (on <= 0 || d < 300 || d > 5200) return;
    drawCardQuad(k, cardTexUpdate(k, d < 5200), psi, .72 + .28 * clamp(on), cam, true, .22 * clamp(on) * ss(clamp((d - 300) / 540)) * (1 - .6 * clamp((d - 1700) / 3500)));
  });
  const items = [];
  WS.ghost.forEach(g => items.push({ d: depthOf(g.x, g.y, g.z, cam), f: () => drawGhost(g, t, cam) }));
  WS.glyphs.forEach(g => items.push({ d: depthOf(g.x, g.y, g.z, cam), f: () => drawGlyph(g, t, cam) }));
  WS.wire.forEach(o => items.push({ d: depthOf(o.x, o.y, o.z, cam), f: () => drawWire(o, t, cam) }));
  CARDS.forEach((c, k) => items.push({ d: depthOf(c.x, c.y, c.z, cam), f: () => {
    const on = spring(t - (16.1 + .05 * k), 150, .82), d = depthOf(c.x, c.y, c.z, cam); if (on <= 0 || d < 60) return;
    const psi = c.yaw + .035 * Math.sin(1.3 * t + k), near = ss(clamp((d - 300) / 540)), fog = .72 * clamp((d - 1700) / 9000), sc = .72 + .28 * clamp(on);
    // outer glow in the card's hue
    const o = proj(c.x, c.y, c.z, cam, _p); glow(GLOW[c.hue], o.x, o.y, 640 * o.s, .2 * near * clamp(on), 'lighter');
    drawCardQuad(k, cardTexUpdate(k, d < 5200), psi, sc, cam, false, clamp(on) * near * (1 - fog));
  } }));
  if (t > 26.9) items.push({ d: ZDOT - cam.z, f: () => drawFarDot(t, cam) });
  items.sort((a, b) => b.d - a.d).forEach(it => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; it.f(); });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  drawBokeh(t, cam, true); drawSpeedLines(t, cam); drawEmitters(t, 'E');
  // anamorphic flare as the camera locks onto each card
  ARR.forEach((a, k) => { const u = t - a; if (u > -.05 && u < .55) flare(960 + (k % 2 ? 260 : -260), 380, 260, .5 * Math.exp(-Math.max(0, u) / .16) * ss(clamp((u + .05) / .05)), CARDS[k].hue); });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(960, 540, 420, 960, 540, 1180); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.46 * (1 - ss(seg(t, 27.55, 27.95)))})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawWorldHUD(t);
}
