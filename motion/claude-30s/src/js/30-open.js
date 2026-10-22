// =====================================================================================================
//  Scenes 1-2 (0 - 3.75 s): the ember in the dark, the twelve rays burst out, "Bonjour.",
//  then the spark slides left and the 3D letters of "Claude" stand up next to it.
// =====================================================================================================
const OPEN = sceneGroup();
const SP1 = { x: 0, y: .16, s: .6 };                    // the spark in scene 1
const LET_EM = 1.15;                                     // em of the 3D letters (world units)
const SP2 = { x: -1.86, y: .2, s: .43 };                 // the spark next to the word
const BASE_Y = -.2;                                      // baseline of the word

// ------------------------------------------------------------------ dust vortex (sucked into the ember) and the ignition sparks
const DUST = new Cloud(1300, OPEN), SPARKS = new Cloud(520, OPEN);
const DUSTP = [], SPARKP = [];
(() => {
  const r = mulberry32(31);
  for (let i = 0; i < DUST.n; i++) {
    const r0 = .7 + Math.pow(r(), .7) * 6.2;
    DUSTP.push({ r0, th: r() * TAU, y: (r() - .5) * .5 * Math.sqrt(r0), s: .018 + r() * .05, c: r() < .55 ? BR.clay : r() < .6 ? HU.amber : BR.cream, a: .25 + r() * .6, w: .5 + r() * .7, tw: r() * TAU });
  }
  for (let i = 0; i < SPARKS.n; i++) {
    const u = r() * 2 - 1, ph = r() * TAU, s = Math.sqrt(1 - u * u), sp = 1.8 + Math.pow(r(), 1.6) * 6.5;
    SPARKP.push({ vx: s * Math.cos(ph) * sp, vy: u * sp * .8, vz: s * Math.sin(ph) * sp, life: .5 + r() * 1.1, sz: .02 + r() * .05, c: r() < .5 ? BR.clay : r() < .5 ? HU.amber : BR.cream, d: r() * .05 });
  }
})();
const DISK = new THREE.Euler(1.18, 0, .22);   // the dust disk is seen inclined
const _m4 = new THREE.Matrix4().makeRotationFromEuler(DISK);
function setDust(t) {
  const inflow = t < T_IGN ? Math.pow(seg(t, 0, T_IGN), 1.35) : 1, after = Math.max(0, t - T_IGN);
  const blast = 1 - Math.exp(-after / .22), fadeOut = 1 - ss(seg(t, 3.35, 3.75));
  DUSTP.forEach((p, i) => {
    let r = p.r0 * (1 - .62 * inflow);
    if (t >= T_IGN) r += 1.9 * blast / (r * .6 + .35) + after * .18;
    const th = p.th + t * p.w * 1.25 / Math.sqrt(r + .2) + (t >= T_IGN ? blast * .6 : 0);
    _v.set(Math.cos(th) * r, p.y * (1 + after * .25), Math.sin(th) * r).applyMatrix4(_m4);
    const near = clamp((r - .35) / .6), tw_ = .65 + .35 * Math.sin(t * 3.1 + p.tw);
    DUST.set(i, _v.x + SP1.x, _v.y + SP1.y, _v.z, p.s * (1 + .8 * pulse(t, T_IGN, 1, .3)), p.c, p.a * near * tw_ * fadeOut * clamp(t / .25 + .35));
  });
  DUST.commit();
  const a0 = t - T_IGN;
  SPARKP.forEach((p, i) => {
    const a = a0 - p.d;
    if (a < 0 || a > p.life) { SPARKS.set(i, 0, 0, 0, 0, BR.cream, 0); return; }
    const k = 3.6, f = (1 - Math.exp(-k * a)) / k, u = a / p.life;
    SPARKS.set(i, SP1.x + p.vx * f, SP1.y + p.vy * f - .35 * a * a, p.vz * f, p.sz * (1 - .5 * u), p.c, Math.pow(1 - u, 1.3) * 1.4);
  });
  SPARKS.commit();
}

// ------------------------------------------------------------------ the 3D word
const LETTERS = [];
let WORD_W = 0;
(() => {
  let x = 0;
  const gap = [0, -.02, .0, -.01, -.01, -.02];   // a touch of optical kerning
  [...'Claude'].forEach((ch, i) => {
    const { shapes, adv } = glyphShapes(ch, LET_EM);
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: .26, bevelEnabled: true, bevelThickness: .03, bevelSize: .016, bevelSegments: 4, curveSegments: 12 });
    geo.translate(0, 0, -.13);
    geo.computeBoundingBox();
    const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
    geo.translate(-cx, 0, 0);
    const mesh = new THREE.Mesh(geo, [MAT.cream, MAT.claySide]);
    const pv = new THREE.Group(); pv.add(mesh); OPEN.add(pv);
    x += gap[i];
    LETTERS.push({ pv, mesh, x: x + cx, top: bb.max.y });
    x += adv;
  });
  WORD_W = x;
})();
const WORD_X0 = SP2.x + SP2.s * 1.0 + .3;   // the word starts right of the spark
const SWEEP = new THREE.PointLight(0xfff3e6, 0, 9, 2); OPEN.add(SWEEP);
const letterT = i => T_CLAUDE + .1 + i * .065;
function setLetters(t) {
  LETTERS.forEach((L, i) => {
    const p = spring(t - letterT(i), 150, .7), q = inn(seg(t, 3.42 + i * .028, 3.7 + i * .028));
    L.pv.visible = p > .002 && q < .999;
    L.pv.position.set(WORD_X0 + L.x, BASE_Y + (1 - p) * -.35 - q * .2, (1 - p) * .4 + q * -.5);
    L.pv.rotation.set(1.5 * (1 - p) - 1.6 * q, (1 - p) * .25, 0);
    L.pv.scale.setScalar(Math.max(.001, (.72 + .28 * p) * (1 - .3 * q)));
  });
  const u = seg(t, 2.45, 3.45);
  SWEEP.position.set(lerp(WORD_X0 - 2.5, WORD_X0 + WORD_W + 2, io(u)), BASE_Y + 1.6, 1.6);
  SWEEP.intensity = 14 * Math.sin(Math.PI * u);
}

// ------------------------------------------------------------------ the spark across scenes 1-2
const growOrder = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
function sparkOpen(t) {
  const m = io(seg(t, T_CLAUDE - .1, T_CLAUDE + .5)), x = lerp(SP1.x, SP2.x, m), y = lerp(SP1.y, SP2.y, m);
  const s = lerp(SP1.s, SP2.s, m) * (1 + .1 * pulse(t, T_IGN, 1, .2) - .06 * ss(seg(t, T_IGN - .22, T_IGN)) * (t < T_IGN ? 1 : 0));
  const spin = -1.1 * (1 - spring(t - T_IGN, 60, .78)) + .16 * t + .9 * m;
  const grow = i => t < T_IGN ? 0 : clamp(spring(t - T_IGN - growOrder.indexOf(i) * .016, 320, .62), 0, 1.25);
  let ember = 0;
  if (t < T_IGN + .15) ember = (.35 + .65 * ss(t / .3)) * (1 + .55 * pulse(t, bt(1), 1, .16) + .3 * pulse(t, .02, 1, .2)) * (1 - .35 * ss(seg(t, T_IGN - .2, T_IGN))) * (1 - seg(t, T_IGN, T_IGN + .15)) * 1.2;
  // the exit: the spark leans and darts to the right with the whip
  const ex = inn(seg(t, 3.5, 3.75));
  sparkAt(x + ex * 2.4, y, ex * .3, s, -.2 + .12 * Math.sin(t * 1.3), .35 * Math.sin(t * .8) - .5 * m + 1.2 * ex, spin, grow, ember);
}

// ------------------------------------------------------------------ camera (scenes 1-2): one orbit around a moving target, no zoom reversal
function camOpen(t) {
  const tgt = track(t, [[0, [0, .14, 0]], [T_CLAUDE - .1, [0, .14, 0]], [T_CLAUDE + .6, [(SP2.x - SP2.s + WORD_X0 + WORD_W) / 2 + .08, .12, 0]]]);
  const dist = track(t, [[0, 7.9], [T_CLAUDE + .7, 6.95, out], [3.75, 6.75]]);
  const yaw = track(t, [[0, .05], [T_CLAUDE - .05, -.02], [T_CLAUDE + .65, -.34, io], [3.75, .14, x => x]]);
  const pitch = track(t, [[0, .06], [T_CLAUDE, .05], [T_CLAUDE + .65, .17], [3.75, .1]]);
  const p = [tgt[0] + dist * Math.sin(yaw) * Math.cos(pitch), tgt[1] + dist * Math.sin(pitch), tgt[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
  return { p, tgt, roll: .02 * Math.sin(t * .9) };
}

function setupOpen(t) {
  OPEN.visible = true;
  setDust(t); setLetters(t); sparkOpen(t);
}
function bgOpen(t) {
  ctx.fillStyle = '#080706'; ctx.fillRect(0, 0, W, H);
  ground('ember', t);
  flowBG('night', LUT.night, { sx: 1.4, sp: .05, gain: 1.1, bias: -.12 }, .18);
  const sp = sparkScreen(), ign = t >= T_IGN ? 1 : 0;
  const pre = ss(t / .4) * (.35 + .3 * pulse(t, bt(1), 1, .2));
  glow(SOFT.clay, sp.x, sp.y, 300 + 500 * ign * spring(t - T_IGN, 40, .9), (pre * (1 - ign) + ign * (.42 + .4 * pulse(t, T_IGN, 1, .35))) * (1 - .4 * seg(t, 2, 3.5)), 'lighter');
  godrays(sp.x, sp.y, 1100, ign * (.5 * pulse(t, T_IGN, 1, .5) + .16) * (1 - .6 * seg(t, 1.9, 3.5)), t * .12);
  bokeh(t, ['clay', 'amber', 'rose', 'violet'], ss(t / 1.2) * (.6 + .6 * ign));
}
function fgOpen(t) {
  const sp = sparkScreen();
  // the ember's own little flare before the ignition, then the ignition: flash, flare, shock rings
  if (t < T_IGN) flare(sp.x, sp.y, 70 + 25 * pulse(t, bt(1), 1, .2), .28 * ss(t / .4) + .3 * pulse(t, bt(1), 1, .2), 'amber');
  flare(sp.x, sp.y, 150, 1.25 * pulse(t, T_IGN, 1, .2), 'amber');
  glow(GLOW.white, sp.x, sp.y, 700, .55 * pulse(t, T_IGN, 1, .1));
  shock(t, T_IGN, sp.x, sp.y, { R: 900, w: 4, life: .8 });
  shock(t, bt(1), sp.x, sp.y, { R: 220, w: 2, life: .45, a: .35 });
  // twinkles around the young spark
  const r = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    const an = r() * TAU, d = 170 + r() * 230, t0 = T_IGN + .15 + r() * 1.3, a = Math.sin(Math.PI * seg(t, t0, t0 + .45));
    sparkle(sp.x + Math.cos(an) * d, sp.y + Math.sin(an) * d * .8, 9 + r() * 10, t * 1.5 + i, a * .9 * (1 - seg(t, 1.9, 2.1)));
  }
  // each 3D letter lands with a small shock and two sparkles
  LETTERS.forEach((L, i) => {
    const tl = letterT(i) + .1, s = proj(WORD_X0 + L.x, BASE_Y, 0);
    shock(t, tl, s.x, s.y, { R: 120, w: 2, life: .4, a: .6, col: BR.cream, col2: BR.clay });
    for (let j = 0; j < 3; j++) { const a = Math.sin(Math.PI * seg(t, tl + j * .05, tl + .4 + j * .05)); sparkle(s.x + (j - 1) * 46, s.y - 20 - j * 34, 8 + 4 * j, t * 2 + i, a * .9, j === 1 ? HU.amber : BR.cream); }
  });
  lightLeak(t, T_CLAUDE - .25, 1.3, HU.amber, 1, .35);
  lightLeak(t, 3.3, .7, BR.clay, 1, .4);
  bokeh(t, ['amber', 'clay'], .8 * ss(seg(t, .5, 1.5)), true);
  // "Bonjour."
  riseLetters('Bonjour.', 960, 860, FR(124), BR.cream, t, T_HELLO, .042, { lh: 140, ls: -2, te: T_CLAUDE - .14, est: .02, ed: .26 });
  // "Je suis", attached to the 3D word, and the caption
  const a = proj(WORD_X0, BASE_Y + LET_EM * .78, 0), b = proj(WORD_X0, BASE_Y - .28, 0);
  const out_ = seg(t, 3.38, 3.6);
  rise('Je suis', a.x + 6, a.y - 22, ISER(72), BR.cream, spring(t - T_CLAUDE - .02, 170, .8), out_, { lh: 80, alpha: .92 });
  const capT = T_CLAUDE + .5;
  rise('L’ASSISTANT IA D’ANTHROPIC', b.x + 8, b.y + 46, SANS(22, 600), BR.cream, spring(t - capT, 170, .8), out_, { lh: 34, ls: 5, alpha: .62, rot: 0 });
  const lw = 420 * o5(seg(t, capT + .05, capT + .55)) * (1 - out_);
  if (lw > 1) { ctx.fillStyle = rgb(BR.clay, .9); ctx.fillRect(b.x + 8, b.y + 64, lw, 2); }
}

SCENES.push({ t0: 0, cam: camOpen, setup: setupOpen, bg: bgOpen, fg: fgOpen });
SUBS.push([T_IGN - .05, T_IGN + .5, 8], [T_HELLO, T_HELLO + .5, 5], [T_CLAUDE - .2, T_CLAUDE + .8, 8], [3.4, 3.75, 10]);
