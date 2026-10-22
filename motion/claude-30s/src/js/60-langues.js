// =====================================================================================================
//  Scene 5, DROP 1 (7.5 - 11.25 s): the spark explodes, two rings of greetings in eighteen languages open
//  around it like a planet's rings. "Je parle votre langue."
// =====================================================================================================
const LANG = sceneGroup();
const C5 = [0, 60, 0];
const GREET_A = [['Bonjour', 'fr'], ['Hello', 'en'], ['Hola', 'es'], ['こんにちは', 'ja'], ['Ciao', 'it'], ['مرحبا', 'ar'], ['Hallo', 'de'], ['नमस्ते', 'hi'], ['Olá', 'pt'], ['你好', 'zh']];
const GREET_B = [['Привет', 'ru'], ['안녕하세요', 'ko'], ['Merhaba', 'tr'], ['Γειά σου', 'el'], ['שלום', 'he'], ['Hej', 'sv'], ['Xin chào', 'vi'], ['Cześć', 'pl']];
const RINGS = [];
function initLangTextures() {   // fonts must be loaded: called from boot
  [[GREET_A, 3.05, .52, 0], [GREET_B, 2.15, .36, 1]].forEach(([list, R, hgt, k]) => {
    const g = group(LANG), items = [];
    const torus = new THREE.Mesh(new THREE.TorusGeometry(R, .006, 6, 240), new THREE.MeshBasicMaterial({ color: 0xf0eee6, transparent: true, opacity: .32, depthWrite: false }));
    torus.rotation.x = Math.PI / 2; g.add(torus);
    list.forEach(([word, code], i) => {
      const font = GREETF(84), w = Math.ceil(tw(word, font) + 150), c = mk(w, 128), x = c.g;
      withCtx(x, () => {
        txt(code.toUpperCase(), 8, 50, MONO(22), BR.clay, { ls: 2 });
        txt(word, 60, 92, font, i === 0 && k === 0 ? BR.clay : BR.cream);
      });
      const tex = new THREE.CanvasTexture(c.c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(hgt * w / 128, hgt), mat);
      const a = i / list.length * TAU;
      m.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); m.rotation.y = a;
      g.add(m); items.push({ m, mat, a });
    });
    RINGS.push({ g, items, torus, R, k });
  });
}
const LANGP = new Cloud(900, LANG), LANGPP = [];
(() => {
  const r = mulberry32(606), cols = [BR.clay, HU.amber, HU.rose, HU.violet, BR.cream];
  for (let i = 0; i < LANGP.n; i++) {
    const u = r() * 2 - 1, ph = r() * TAU, s = Math.sqrt(1 - u * u), sp = 2 + Math.pow(r(), 1.5) * 11;
    LANGPP.push({ vx: s * Math.cos(ph) * sp, vy: u * sp * .55, vz: s * Math.sin(ph) * sp, sz: .025 + r() * .07, c: cols[Math.floor(r() * 5)], ph: r() * TAU, w: .2 + r() * .5 });
  }
})();
const _cp = V3(), _n = V3();
function setupLang(t) {
  LANG.visible = true;
  const a = t - T_DROP, open = spring(a - .02, 70, .74), exit = inn(seg(t, 10.95, 11.25));
  RINGS.forEach((Rg, k) => {
    const sc = Math.max(.001, open * (1 + 1.6 * exit));
    Rg.g.position.set(C5[0], C5[1] + (k ? .05 : -.05), C5[2]);
    Rg.g.scale.setScalar(sc);
    Rg.g.rotation.set(k ? .32 : -.12, (k ? -1 : 1) * (a * .42 + (1 - open) * 1.2), k ? .28 : -.06);
    Rg.g.updateMatrixWorld();
    Rg.torus.material.opacity = .3 * (1 - exit);
    Rg.items.forEach(it => {   // a greeting fades as it turns away from the camera
      it.m.getWorldPosition(_v); _n.set(0, 0, 1).applyQuaternion(it.m.getWorldQuaternion(_q));
      const facing = _n.dot(_cp.copy(CAM.position).sub(_v).normalize());
      it.mat.opacity = clamp((facing - .05) * 2.2) * (1 - exit) * clamp(open * 1.4);
    });
  });
  // explosion particles, then a slow orbit
  LANGPP.forEach((p, i) => {
    const k = 2.4, f = (1 - Math.exp(-k * Math.max(0, a))) / k, an = p.ph + a * p.w;
    const x = p.vx * f, z = p.vz * f, r = Math.hypot(x, z);
    LANGP.set(i, C5[0] + Math.cos(an) * r * Math.sign(p.vx || 1), C5[1] + p.vy * f, C5[2] + Math.sin(an) * r, p.sz * (1 + 1.5 * pulse(t, T_DROP, 1, .25)), p.c, (a < 0 ? 0 : .9) * (1 - .5 * seg(a, 1, 3.5)) * (1 - exit));
  });
  LANGP.commit();
  setSparkMat('clay');
  const s = .58 * clamp(spring(a, 120, .62), 0, 1.3) * (1 - .4 * exit) + .02;
  sparkAt(C5[0], C5[1], C5[2], s, .25 + .1 * Math.sin(t), .3 * Math.sin(t * .7), -a * 1.4 - 2 * (1 - spring(a, 40, .8)), 1, 0);
}
function camLang(t) {
  const a = t - T_DROP, pull = o5(seg(a, 0, 1.15)), yaw = -.25 + .5 * seg(a, 0, 3.75) + .25 * (1 - pull), dive = inn(seg(t, 10.95, 11.25));
  const dist = lerp(2.4, 9.0, pull) - 4 * dive, h = lerp(.2, 3.1, pull);
  return { p: [C5[0] + Math.sin(yaw) * dist, C5[1] + h, C5[2] + Math.cos(yaw) * dist], tgt: [C5[0], C5[1] - .35 * pull, C5[2]], roll: lerp(-.16, .02, pull) };
}
function bgLang(t) {
  ground('aurora', t);
  const sp = sparkScreen(), a = t - T_DROP;
  glow(SOFT.clay, sp.x, sp.y, 500 + 300 * spring(a, 30, .9), .55 + .4 * pulse(t, T_DROP, 1, .4), 'lighter');
  godrays(sp.x, sp.y, 1300, .35 * pulse(t, T_DROP, 1, .7) + .1 + .12 * kickEnv(t), t * .1, HU.amber, 22);
  bokeh(t, ['violet', 'rose', 'amber', 'clay'], 1.1);
  vignette(.55);
}
function fgLang(t) {
  const sp = sparkScreen();
  flash(.95 * pulse(t, T_DROP, 1, .07), BR.white);
  flare(sp.x, sp.y, 180, 1.1 * pulse(t, T_DROP, 1, .25), 'amber');
  shock(t, T_DROP, sp.x, sp.y, { R: 1300, w: 6, life: .9 });
  shock(t, T_DROP + .12, sp.x, sp.y, { R: 900, w: 3, life: .8, a: .5 });
  streaks(sp.x, sp.y, t, T_DROP, .7, false, { n: 90, R: 1500, L: 340, a: .9, seed: 31, col: HU.amber });
  for (let k = 1; k < 8; k++) shock(t, T_DROP + k * BEAT, sp.x, sp.y, { R: 420, w: 1.5, life: .45, a: .25 });
  lasers(t, T_DROP + .02, 11.2, [BR.clay, HU.violet, HU.amber, HU.rose], { n: 8, a: .75 });
  bokeh(t, ['amber', 'rose'], .9, true);
  const t0 = bt(17), out_ = seg(t, 10.9, 11.15);
  rise('Je parle votre langue.', 960, 968, FR(92), BR.cream, spring(t - t0, 170, .78), out_, { lh: 110, align: 'center', ls: -1.5 });
  rise('ET DES DIZAINES D’AUTRES', 960, 1024, SANS(18, 600), BR.cream, spring(t - t0 - .3, 170, .8), out_, { lh: 30, align: 'center', ls: 6, alpha: .55, rot: 0 });
}
INITS.push(initLangTextures);
SCENES.push({ t0: T_DROP, cam: camLang, setup: setupLang, bg: bgLang, fg: fgLang });
SUBS.push([T_DROP, T_DROP + .9, 10], [T_DROP + .9, 10.95, 4], [10.95, 11.25, 10]);
