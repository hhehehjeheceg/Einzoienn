// =====================================================================================================
//  Scene 10, DROP 2 (22.5 - 26.25 s): the world melts into full colour. A big glazed spark turns
//  behind three words on half bars: Utile. Honnête. Bienveillant. Then it rushes at the camera.
// =====================================================================================================
const DROP2 = sceneGroup();
const C9 = [0, 180, 0];
const VAL_SUB = ['Pour vous aider à avancer.', 'Même quand la réponse est « je ne sais pas ».', 'Avec soin, et dans le respect de vos choix.'];
const VAL_POS = [[-1.55, .35], [1.6, -.25], [0, 1.25]];   // the spark moves for each word
const RUSH = bt(54.5);
const DROPP = new Cloud(1100, DROP2), DROPPP = [];
(() => {
  const r = mulberry32(4711), cols = [BR.white, HU.amber, BR.cream, HU.rose, [255, 214, 170]];
  for (let i = 0; i < DROPP.n; i++) {
    const u = r() * 2 - 1, ph = r() * TAU, s = Math.sqrt(1 - u * u), sp = 3 + Math.pow(r(), 1.4) * 13;
    DROPPP.push({ vx: s * Math.cos(ph) * sp, vy: u * sp * .6, vz: s * Math.sin(ph) * sp, sz: .02 + r() * .06, c: cols[Math.floor(r() * 5)], ph: r() * TAU, fl: r() });
  }
})();
const CONF2 = new Confetti(320, DROP2, 2024, [0xfff4e6, 0xd97757, 0xffc56b, 0x8f6bff, 0xff8fb5, 0x141413]);
const valIdx = t => t < T_VALUES[1] ? 0 : t < T_VALUES[2] ? 1 : 2;
function setupDrop2(t) {
  DROP2.visible = true;
  const a = t - T_DROP2, k = valIdx(t), rush = inn(seg(t, RUSH, T_FLOOD));
  const prev = VAL_POS[Math.max(0, k - 1)], cur = VAL_POS[k], m = k ? spring(t - T_VALUES[k], 120, .78) : 1;
  const x = lerp(prev[0], cur[0], m) * (1 - rush), y = lerp(prev[1], cur[1], m) * (1 - rush);
  const s = clamp(spring(a, 140, .6), 0, 1.3) * (.95 + .12 * pulse(t, T_VALUES[k], 1, .2)) * (1 + 6 * rush * rush);
  setSparkMat('clay');
  sparkAt(C9[0] + x, C9[1] + y, C9[2] - .4 + rush * 2.5, s, .35 * Math.sin(t * .9), .5 * Math.sin(t * .7) + rush * .8, -a * 1.2 - 2.4 * (1 - spring(a, 30, .85)) - k * .5 - rush * 3, 1, 0);
  DROPPP.forEach((p, i) => {
    const kk = 1.8, f = (1 - Math.exp(-kk * Math.max(0, a))) / kk, drift = a * .25;
    const fl = .55 + .45 * Math.sin(t * (5 + 7 * p.fl) + p.ph);
    DROPP.set(i, C9[0] + p.vx * f + Math.sin(p.ph + a) * drift, C9[1] + p.vy * f + drift * .5, C9[2] + p.vz * f, p.sz * (1 + 2 * pulse(t, T_DROP2, 1, .3)), p.c, .85 * fl * (1 - .3 * seg(a, 1, 3.5)));
  });
  DROPP.commit();
  CONF2.burst(t, T_DROP2, [C9[0], C9[1] - .2, C9[2] - .5], 1);
}
function camDrop2(t) {
  const a = t - T_DROP2, k = valIdx(t), u = t - T_VALUES[k], kick = 1 - o5(u / .45);
  const d = 6.4 - .35 * a / 3.75 + .5 * kick * (k ? 1 : 0), roll = [-.05, .05, -.02][k] * (1 - .6 * o5(u / .9));
  return { p: [C9[0] + .3 * Math.sin(a * .7), C9[1] + .15, C9[2] + d], tgt: [C9[0], C9[1], C9[2]], roll };
}
function bgDrop2(t) {
  ground('melt', t);
  const sp = sparkScreen();
  glow(SOFT.white, sp.x, sp.y, 700, .25, 'lighter');
  godrays(sp.x, sp.y, 1400, .25 * pulse(t, T_DROP2, 1, .6) + .08 + .1 * kickEnv(t), t * .15, [255, 236, 210], 22);
  bokeh(t, ['white', 'amber', 'rose'], 1);
}
function fgDrop2(t) {
  const sp = sparkScreen(), k = valIdx(t);
  flash(1 * pulse(t, T_DROP2, 1, .08), BR.white);
  flare(sp.x, sp.y, 200, 1.0 * pulse(t, T_DROP2, 1, .25), 'amber');
  shock(t, T_DROP2, sp.x, sp.y, { R: 1400, w: 6, life: .9, col: BR.white, col2: BR.cream });
  streaks(sp.x, sp.y, t, T_DROP2, .8, false, { n: 100, R: 1600, L: 360, a: .8, seed: 71, col: BR.white });
  lasers(t, T_DROP2 + .02, RUSH + .2, [BR.white, HU.amber, HU.rose, HU.violet], { n: 8, a: .6 });
  lasers(t, T_VALUES[1], RUSH + .2, [HU.amber, BR.white], { n: 6, a: .45, top: true });
  bokeh(t, ['white', 'amber'], .8, true);
  for (let j = 0; j < 3; j++) shock(t, T_VALUES[j], 960, 560, { R: 760, w: 3, life: .55, a: .4, col: BR.ink, col2: BR.ink });
  // the words: ink on the melted colour, letter by letter, with their line underneath
  for (let j = 0; j < 3; j++) {
    const t0 = T_VALUES[j], te = j < 2 ? T_VALUES[j + 1] - .17 : RUSH - .05;
    if (t < t0 - .02 || t > te + .45) continue;
    const xw = j === 0 ? 1180 : j === 1 ? 760 : 960;
    ctx.save(); ctx.shadowColor = 'rgba(80,20,40,0.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    riseLetters(VALUES[j], xw, j === 2 ? 720 : 640, FR(210), BR.ink, t, t0 + .01, .035, { lh: 240, ls: -6, te, est: .02, ed: .3, k: 210, z: .76 });
    ctx.restore();
    rise(VAL_SUB[j], xw, j === 2 ? 810 : 730, SANS(30, 500), BR.ink, spring(t - t0 - .18, 180, .82), io(seg(t, te, te + .25)), { lh: 44, align: 'center', alpha: .72, rot: 0 });
    rise(`0${j + 1}  /  03`, xw, j === 2 ? 870 : 430, MONO(20), BR.ink, spring(t - t0, 220, .9), io(seg(t, te, te + .25)), { lh: 30, align: 'center', ls: 4, alpha: .6, rot: 0 });
  }
  // the rush: the spark's light whites the frame just before the cream flood
  glow(GLOW.white, sp.x, sp.y, 300 + 1800 * inn(seg(t, RUSH + .3, T_FLOOD)), .9 * inn(seg(t, RUSH + .4, T_FLOOD)));
}
SCENES.push({ t0: T_DROP2, cam: camDrop2, setup: setupDrop2, bg: bgDrop2, fg: fgDrop2 });
CUTS.push(T_DROP2);
SUBS.push([T_DROP2, T_DROP2 + .9, 10], [T_DROP2 + .9, RUSH, 5], [T_VALUES[1] - .05, T_VALUES[1] + .4, 8], [T_VALUES[2] - .05, T_VALUES[2] + .4, 8], [RUSH, T_FLOOD, 12]);
