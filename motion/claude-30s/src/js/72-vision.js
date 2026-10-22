// =====================================================================================================
//  Scene 7 (15 - 18.75 s), breakdown: "Je vois." A picture built from four parallax layers in a frame,
//  a scan line reads it, boxes and labels pop, a one-line description is typed underneath.
// =====================================================================================================
const SEE = sceneGroup();
const C7 = [0, 120, 0], PIC_W = 3.6, PIC_H = 2.4, PW = 1200, PH = 800;
const LAYERS = [];
const ridge = (seed, base, amp, x) => { let y = base; for (let o = 0; o < 4; o++) y += amp / (1 + o * 1.7) * noise3(x * .0035 * (1 + o * 2.1), seed + o * 3.3, 0); return y; };
function paintLayer(k, g) {
  if (k === 0) {   // sky with the sun, a few long clouds and birds
    const s = g.createLinearGradient(0, 0, 0, 520);
    [[0, '#1d1b4f'], [.35, '#5b2f78'], [.62, '#c2506e'], [.82, '#f08a5d'], [1, '#ffcf8f']].forEach(([p, c]) => s.addColorStop(p, c));
    g.fillStyle = s; g.fillRect(0, 0, PW, 520);
    const sun = g.createRadialGradient(760, 430, 0, 760, 430, 300);
    sun.addColorStop(0, 'rgba(255,240,205,1)'); sun.addColorStop(.18, 'rgba(255,214,150,0.95)'); sun.addColorStop(.24, 'rgba(255,170,110,0.45)'); sun.addColorStop(1, 'rgba(255,140,90,0)');
    g.fillStyle = sun; g.fillRect(0, 0, PW, 520);
    g.fillStyle = 'rgba(255,190,160,0.28)';
    [[300, 180, 260, 9], [620, 250, 340, 7], [980, 150, 220, 8], [470, 320, 300, 5]].forEach(([x, y, w, h]) => { g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill(); });
    g.strokeStyle = 'rgba(40,20,50,0.85)'; g.lineWidth = 3; g.lineCap = 'round';
    [[900, 240, 16], [940, 220, 12], [975, 250, 10], [1010, 230, 8]].forEach(([x, y, w]) => { g.beginPath(); g.moveTo(x - w, y - w * .4); g.quadraticCurveTo(x - w * .4, y - w * .55, x, y); g.quadraticCurveTo(x + w * .4, y - w * .55, x + w, y - w * .4); g.stroke(); });
  } else if (k === 1 || k === 2) {   // far and near mountain ridges, with haze
    const far = k === 1;
    g.beginPath(); g.moveTo(0, 560);
    for (let x = 0; x <= PW; x += 6) g.lineTo(x, ridge(far ? 11 : 23, far ? 330 : 400, far ? 150 : 170, x + (far ? 0 : 500)));
    g.lineTo(PW, 560); g.closePath();
    const f = g.createLinearGradient(0, 220, 0, 540);
    if (far) { f.addColorStop(0, '#8a4f86'); f.addColorStop(1, '#c46d78'); } else { f.addColorStop(0, '#2c1e48'); f.addColorStop(1, '#4a2a52'); }
    g.fillStyle = f; g.fill();
  } else {   // the lake: the sky mirrored, darker, with ripples
    const l = g.createLinearGradient(0, 520, 0, PH);
    [[0, '#f0936a'], [.25, '#a9476d'], [.6, '#3d2560'], [1, '#141331']].forEach(([p, c]) => l.addColorStop(p, c));
    g.fillStyle = l; g.fillRect(0, 520, PW, PH - 520);
    g.fillStyle = 'rgba(255,225,180,0.55)';
    for (let i = 0; i < 26; i++) { const y = 530 + i * i * .42, w = 70 - i * 2; g.fillRect(760 - w / 2 + Math.sin(i * 2.3) * 10, y, Math.max(6, w), 2); }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) g.fillRect((i * 271) % PW, 560 + (i * 97) % 230, 60 + (i * 37) % 90, 1.5);
  }
}
const PIC = group(SEE);
(() => {
  [0, 1, 2, 3].forEach(k => {
    const c = mk(PW, PH); paintLayer(k, c.g);
    const tex = new THREE.CanvasTexture(c.c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PIC_W, PIC_H), new THREE.MeshBasicMaterial({ map: tex, transparent: k > 0, toneMapped: false }));
    m.position.z = k * .11; PIC.add(m); LAYERS.push(m);
  });
  const outer = rrShape(PIC_W + .36, PIC_H + .36, .12), hole = rrShape(PIC_W - .02, PIC_H - .02, .03);
  outer.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .12, bevelEnabled: true, bevelThickness: .025, bevelSize: .02, bevelSegments: 4, curveSegments: 8 }), MAT.cream);
  frame.position.z = .3; PIC.add(frame);
  const back = new THREE.Mesh(slab(PIC_W + .36, PIC_H + .36, .12, .1), MAT.ink); back.position.z = -.08; PIC.add(back);
})();
const OV = mk(PW, PH), ovx = OV.g;
const OVT = new THREE.CanvasTexture(OV.c); OVT.colorSpace = THREE.SRGBColorSpace; OVT.anisotropy = 4;
const OVM = new THREE.Mesh(new THREE.PlaneGeometry(PIC_W, PIC_H), new THREE.MeshBasicMaterial({ map: OVT, transparent: true, depthWrite: false, toneMapped: false }));
OVM.position.z = .47; PIC.add(OVM);
const BOXES = [   // [x, y, w, h, label, time]
  [690, 360, 140, 140, 'Soleil couchant', T_SEE + .95],
  [40, 230, 560, 300, 'Montagnes', T_SEE + 1.2],
  [870, 190, 170, 90, 'Oiseaux', T_SEE + 1.45],
  [30, 540, 1140, 230, 'Lac', T_SEE + 1.7],
];
function drawOverlay(t) {
  withCtx(ovx, () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, PW, PH);
    const u = io(seg(t, T_SEE + .2, T_SEE + .9));
    if (u > 0 && u < 1) {   // scan line with a soft trail and a dot grid behind it
      const x = u * PW, g = ctx.createLinearGradient(x - 220, 0, x, 0);
      g.addColorStop(0, 'rgba(255,190,140,0)'); g.addColorStop(1, 'rgba(255,190,140,0.28)');
      ctx.fillStyle = g; ctx.fillRect(x - 220, 0, 220, PH);
      ctx.fillStyle = 'rgba(255,240,220,0.95)'; ctx.fillRect(x - 2, 0, 4, PH);
      ctx.fillStyle = 'rgba(255,240,220,0.35)';
      for (let gx = 20; gx < x; gx += 40) for (let gy = 20; gy < PH; gy += 40) if (x - gx < 260) ctx.fillRect(gx - 1.5, gy - 1.5, 3, 3);
    }
    BOXES.forEach(([x, y, w, h, label, t0]) => {
      const p = o5(seg(t, t0, t0 + .3)), a = ss(seg(t, t0, t0 + .15));
      if (p <= 0) return;
      const L = Math.min(w, h) * .28 * p;
      ctx.strokeStyle = rgb(BR.cream, a); ctx.lineWidth = 4; ctx.lineCap = 'round';
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy); ctx.stroke();
      });
      ctx.fillStyle = rgb(BR.cream, .08 * a); ctx.fillRect(x, y, w, h);
      const f = SANS(26, 600), lw = tw(label, f) + 44, ly = y - 16 > 40 ? y - 16 : y + h + 44;
      ctx.save(); ctx.translate(x, ly); ctx.scale(.8 + .2 * spring(t - t0 - .05, 260, .7), .8 + .2 * spring(t - t0 - .05, 260, .7));
      rr(0, -34, lw, 44, 22); ctx.fillStyle = rgb(BR.ink, .82 * a); ctx.fill(); ctx.strokeStyle = rgb(BR.clay, a); ctx.lineWidth = 2; ctx.stroke();
      circ(18, -12, 6); ctx.fillStyle = rgb(BR.clay, a); ctx.fill();
      txt(label, 32, -3, f, BR.cream, { alpha: a });
      ctx.restore();
    });
  });
  OVT.needsUpdate = true;
}
const CAPTION = 'Un coucher de soleil sur un lac de montagne, avec quelques oiseaux.';
function setupSee(t) {
  SEE.visible = true;
  const a = t - T_SEE, inP = spring(a, 90, .8), out_ = inn(seg(t, bt(39.5), bt(40)));
  PIC.position.set(C7[0] + 1.2, C7[1] + .2 + .04 * Math.sin(t * 1.2) + (1 - inP) * -1.2, C7[2] - out_ * 3);
  PIC.rotation.set(-.05 + (1 - inP) * .35, -.32 + .28 * ss(seg(a, 0, 3.75)), .01);
  PIC.updateMatrixWorld();
  drawOverlay(t);
  // the spark is the eye: it follows the scan along the top edge, then rests on the corner
  const u = io(seg(t, T_SEE + .2, T_SEE + .9)), e = V3(lerp(-PIC_W / 2, PIC_W / 2, u) * (u < 1 ? 1 : 0) + (u >= 1 ? PIC_W / 2 + .1 : 0), PIC_H / 2 + .32, .55).applyMatrix4(PIC.matrixWorld);
  const settle = ss(seg(t, T_SEE + .9, T_SEE + 1.3));
  const s0 = V3(-PIC_W / 2, PIC_H / 2 + .32, .55).applyMatrix4(PIC.matrixWorld);
  const p = t < T_SEE + .2 ? s0 : e;
  setSparkMat('clay');
  sparkAt(p.x, p.y, p.z, (.2 + .05 * settle) * clamp(a / .25), .2, .3 * Math.sin(t), -t * 2.2, 1, 0);
}
function camSee(t) {
  const a = t - T_SEE, yaw = -.22 + .3 * ss(seg(a, 0, 3.75));
  const tgt = [C7[0] + .25, C7[1] + .05, C7[2]], d = 8.4 - .5 * a / 3.75;
  return { p: [tgt[0] + Math.sin(yaw) * d, tgt[1] + .55, tgt[2] + Math.cos(yaw) * d], tgt, roll: .01 };
}
function bgSee(t) {
  ground('dusk', t);
  glow(SOFT.rose, 1300, 560, 900, .18, 'lighter');
  vignette(.55);
}
function fgSee(t) {
  flash(.85 * pulse(t, T_SEE, 1, .08), BR.white);
  const a = t - T_SEE, out_ = seg(t, bt(39.3), bt(39.9));
  rise('Je vois.', 160, 560, FR(150), BR.cream, spring(a - .1, 170, .8), out_, { lh: 170, ls: -3 });
  rise('Photos, schémas, captures d’écran.', 168, 650, SANS(30, 500), BR.cream, spring(a - .3, 170, .8), out_, { lh: 44, alpha: .6, rot: 0 });
  // the description, typed in a chat bubble under the picture
  const b = proj(C7[0] + 1.2, C7[1] + .2 - PIC_H / 2 - .45, 0), k = clamp((t - T_SEE - 2.05) / .9) * CAPTION.length;
  const ap = ss(seg(t, T_SEE + 1.95, T_SEE + 2.15)) * (1 - out_);
  if (ap > 0) {
    const f = SANS(25, 500), w = Math.min(1040, tw(CAPTION, f) + 70), x0 = b.x - w / 2, y0 = b.y + 6 + (1 - ap) * 14;
    ctx.save(); ctx.globalAlpha = ap;
    rr(x0, y0, w, 58, 29); ctx.fillStyle = rgb(BR.cream, .96); ctx.fill();
    circ(x0 + 30, y0 + 29, 7); ctx.fillStyle = rgb(BR.clay); ctx.fill();
    const s = CAPTION.slice(0, Math.floor(k));
    txt(s, x0 + 50, y0 + 38, f, BR.ink);
    if (k < CAPTION.length) { ctx.fillStyle = rgb(BR.clay); ctx.fillRect(x0 + 52 + tw(s, f), y0 + 16, 2.5, 28); }
    ctx.restore();
  }
}
SCENES.push({ t0: T_SEE, cam: camSee, setup: setupSee, bg: bgSee, fg: fgSee });
CUTS.push(T_SEE);
SUBS.push([T_SEE, T_SEE + .6, 6], [T_SEE + .6, bt(40), 3]);
