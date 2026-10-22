// =====================================================================================================
//  Scene 6 (11.25 - 15 s): the reasoning graph. Step by step a path grows, the spark rides its head,
//  two other leads open at every step and fade. "Je réfléchis avant de répondre."
// =====================================================================================================
const THINK = sceneGroup();
const C6 = [0, 90, 0];
const NODES = [[0, 0, 0], [2.3, .75, -1.1], [4.7, -.35, -.5], [7.0, .55, -1.5], [9.3, -.05, -.7]].map(p => V3(C6[0] + p[0], C6[1] + p[1], C6[2] + p[2]));
const STEP_L = ['COMPRENDRE', 'EXPLORER', 'VÉRIFIER', 'RÉPONDRE'];
const HOT = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb27a).multiplyScalar(1.5) });
function linkCurve(A, B, bend) {
  const M = A.clone().lerp(B, .5).add(V3(0, bend[0], bend[1]));
  return new THREE.QuadraticBezierCurve3(A.clone(), M, B.clone());
}
const LINKS = [], ALTS = [];
(() => {
  const r = mulberry32(2024);
  for (let k = 1; k < NODES.length; k++) {
    const A = NODES[k - 1], B = NODES[k], cv_ = linkCurve(A, B, [.35, .5]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(cv_, 64, .022, 8, false), HOT); THINK.add(tube);
    const node = new THREE.Mesh(new THREE.SphereGeometry(.15, 32, 16), MAT.cream); node.position.copy(B); THINK.add(node);
    LINKS.push({ cv: cv_, tube, node });
    for (const sgn of [-1, 1]) {   // two leads that are explored, then dropped
      const E = B.clone().add(V3(-.35 + r() * .5, sgn * (1.25 + r() * .5), sgn * (-.6 + r() * 1.2)));
      const c2 = linkCurve(A, E, [sgn * .3, .4]);
      const mat = new THREE.MeshBasicMaterial({ color: 0xbab3a6, transparent: true, opacity: .8, depthWrite: false });
      const tb = new THREE.Mesh(new THREE.TubeGeometry(c2, 48, .012, 6, false), mat); THINK.add(tb);
      const nd = new THREE.Mesh(new THREE.SphereGeometry(.085, 24, 12), mat); nd.position.copy(E); THINK.add(nd);
      ALTS.push({ k: k - 1, cv: c2, tube: tb, node: nd, mat, E });
    }
  }
})();
const THINKP = new Cloud(420, THINK), THINKPP = [];
(() => { const r = mulberry32(77); for (let i = 0; i < THINKP.n; i++) THINKPP.push({ x: -3 + r() * 16, y: -3 + r() * 6, z: -6 + r() * 7, s: .015 + r() * .04, c: r() < .5 ? HU.amber : BR.cream, ph: r() * TAU }); })();
const stepU = (t, k) => o5(seg(t, T_STEPS[k], T_STEPS[k] + .36));
function thinkHead(t) {   // where the thought is: the head of the last growing link
  let p = NODES[0].clone();
  for (let k = 0; k < 4; k++) { const u = stepU(t, k); if (u <= 0) break; p = LINKS[k].cv.getPoint(u); }
  return p;
}
function setupThink(t) {
  THINK.visible = true;
  LINKS.forEach((L, k) => {
    const u = stepU(t, k);
    L.tube.visible = u > 0; L.tube.geometry.setDrawRange(0, Math.floor(u * 64) * 8 * 6);
    const p = spring(t - T_STEPS[k] - .3, 200, .6);
    L.node.visible = p > .002; L.node.scale.setScalar(Math.max(.001, p));
    L.node.material = t > T_STEPS[k] + .34 ? MAT.clay : MAT.cream;
  });
  ALTS.forEach(A => {
    const t0 = T_STEPS[A.k] - .08, u = .78 * o5(seg(t, t0, t0 + .3)), fade = seg(t, t0 + .42, t0 + .8);
    A.tube.visible = u > 0; A.tube.geometry.setDrawRange(0, Math.floor(u / .78 * 48) * 6 * 6);
    A.mat.opacity = .75 * (1 - .78 * fade);
    const p = spring(t - t0 - .28, 220, .7);
    A.node.visible = p > .002; A.node.scale.setScalar(Math.max(.001, p * (1 - .3 * fade)));
  });
  THINKPP.forEach((p, i) => THINKP.set(i, C6[0] + p.x + .15 * Math.sin(t * .5 + p.ph), C6[1] + p.y + .1 * Math.sin(t * .7 + p.ph), C6[2] + p.z, p.s, p.c, .5 * (.6 + .4 * Math.sin(t * 2 + p.ph))));
  THINKP.commit();
  const h = thinkHead(t), push = inn(seg(t, bt(31), bt(32)));
  setSparkMat('clay');
  sparkAt(h.x, h.y, h.z + .05, .2 + .05 * pulse(t, T_STEPS[3] + .34, 1, .3) + .25 * push, .3, .3 * Math.sin(t * 1.4), -t * 2.4, 1, 0);
}
function camThink(t) {
  const a = t - T_THINK;
  // the target trails the thought with a soft lag (closed form: the head time is delayed and eased)
  const h = thinkHead(t - .12), x = lerp(C6[0] - .2, h.x - .7, ss(seg(a, 0, .5))), push = inn(seg(t, bt(31), bt(32)));
  const tgt = [x, C6[1] + .4 + .2 * Math.sin(a * .6), C6[2] - .8];
  const dist = 8.2 - .25 * a - 4.5 * push;
  return { p: [tgt[0] - 1.3 + .25 * a, tgt[1] + 1.0, tgt[2] + dist], tgt: [lerp(tgt[0], h.x, push), lerp(tgt[1], h.y, push), lerp(tgt[2], h.z, push)], roll: -.03 + .02 * Math.sin(a) };
}
function bgThink(t) {
  ground('think', t);
  const sp = sparkScreen();
  glow(SOFT.amber, sp.x, sp.y, 380, .32, 'lighter');
  vignette(.5);
}
function fgThink(t) {
  const sp = sparkScreen();
  flash(.9 * pulse(t, T_THINK, 1, .06), BR.white);
  glow(GLOW.amber, sp.x, sp.y, 90, .7);
  LINKS.forEach((L, k) => {
    const tk = T_STEPS[k] + .3, s = proj(L.node.position.x, L.node.position.y, L.node.position.z);
    shock(t, tk, s.x, s.y, { R: 150, w: 2, life: .5, a: .7, col: HU.amber });
    rise(STEP_L[k], s.x + 30, s.y + 58, SANS(19, 700), BR.cream, spring(t - tk, 220, .85), 0, { lh: 30, ls: 5, alpha: .8, rot: 0 });
    const ck = o5(seg(t, tk + .3, tk + .5));
    if (ck > 0) txt('✓', s.x + 30 + tw(STEP_L[k], SANS(19, 700), 5) + 12, s.y + 58, SANS(19, 700), HU.amber, { alpha: ck });
  });
  ALTS.forEach(A => {   // dropped leads get a small cross
    const t0 = T_STEPS[A.k] - .08 + .5, s = proj(A.E.x, A.E.y, A.E.z), a = o5(seg(t, t0, t0 + .2)) * (1 - seg(t, t0 + .5, t0 + .9));
    if (a > 0) { ctx.strokeStyle = rgb(BR.cream, .5 * a); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x + 14, s.y - 6); ctx.lineTo(s.x + 26, s.y + 6); ctx.moveTo(s.x + 26, s.y - 6); ctx.lineTo(s.x + 14, s.y + 6); ctx.stroke(); }
  });
  const out_ = seg(t, bt(30.6), bt(31.3));
  rise('Je réfléchis', 150, 240, FR(104), BR.cream, spring(t - T_THINK - .08, 170, .78), out_, { lh: 124, ls: -2 });
  rise('avant de répondre.', 150, 362, FR(104), BR.cream, spring(t - bt(27), 170, .78), out_, { lh: 124, ls: -2 });
  // the last node swallows the screen into the next scene
  glow(GLOW.white, sp.x, sp.y, 200 + 1600 * inn(seg(t, bt(31.4), bt(32))), inn(seg(t, bt(31.2), bt(32))));
}
SCENES.push({ t0: T_THINK, cam: camThink, setup: setupThink, bg: bgThink, fg: fgThink });
CUTS.push(T_THINK);
SUBS.push([T_THINK, bt(32), 5], [bt(31), bt(32), 9]);
