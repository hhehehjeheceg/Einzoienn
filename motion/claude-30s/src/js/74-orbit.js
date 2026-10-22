// =====================================================================================================
//  Scenes 8-9 (18.75 - 22.5 s): "Quand je ne sais pas, je vous le dis." over a hesitant spark,
//  then six cards (the abilities) fly in and orbit it faster and faster until everything implodes: drop 2.
// =====================================================================================================
const ORB = sceneGroup();
const C8 = [0, 150, 0];
const ABIL = [['Écrire', HU.coral], ['Coder', HU.mint], ['Analyser', HU.amber], ['Voir', HU.violet], ['Traduire', HU.rose], ['Raisonner', HU.sky]];
const CARDS = [];
function initCards() {
  ABIL.forEach(([label, hue], i) => {
    const c = mk(560, 320), g = c.g;
    withCtx(g, () => {
      const gr = ctx.createLinearGradient(0, 0, 560, 320); gr.addColorStop(0, '#fbf8f2'); gr.addColorStop(1, '#ece6dc');
      rr(0, 0, 560, 320, 36); ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = rgb(hue, .9); rr(1.5, 1.5, 557, 317, 35); ctx.stroke();
      const hl = ctx.createLinearGradient(0, 0, 0, 160); hl.addColorStop(0, 'rgba(255,255,255,0.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      rr(0, 0, 560, 160, 36); ctx.fillStyle = hl; ctx.fill();
      txt('0' + (i + 1), 44, 70, MONO(24), mixc(hue, BR.ink, .35), { ls: 3 });
      circ(500, 62, 12); ctx.fillStyle = rgb(hue); ctx.fill();
      txt(label, 44, 238, SANS(72, 650), BR.ink, { ls: -2 });
    });
    const tex = new THREE.CanvasTexture(c.c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    const back = new THREE.Mesh(slab(1.44, .84, .1, .04, .015), MAT.cream); back.position.z = -.035;
    const card = new THREE.Group(); card.add(back, m); ORB.add(card);
    CARDS.push(card);
  });
}
INITS.push(initCards);
const ORBP = new Cloud(500, ORB), ORBPP = [];
(() => { const r = mulberry32(919), cols = [BR.clay, HU.amber, HU.violet, BR.cream, HU.rose]; for (let i = 0; i < ORBP.n; i++) ORBPP.push({ r: 1.5 + Math.pow(r(), .6) * 6, a: r() * TAU, y: (r() - .5) * 2.4, s: .015 + r() * .045, c: cols[Math.floor(r() * 5)], w: .3 + r() }); })();
const orbitU = t => seg(t, T_ORBIT, T_DROP2);
const orbitAng = t => { const u = orbitU(t); return 1.2 * u + 6 * u ** 4; };
const SUCK2 = bt(47.4);
function setupOrbit(t) {
  ORB.visible = true;
  const a = t - T_HONEST, suck = inn(seg(t, SUCK2, T_DROP2 - .01)), u = orbitU(t);
  // the hesitant spark: its rays breathe unevenly while it "doesn't know"; then it speeds up with the orbit
  const unsure = 1 - ss(seg(t, bt(42.5), bt(43.5)));
  setSparkMat('clay');
  sparkAt(C8[0], C8[1] + .55 * (1 - ss(seg(t, bt(43), T_ORBIT + .3))), C8[2], (.32 + .2 * ss(seg(t, bt(43), T_ORBIT + .4))) * (1 - suck) + .002,
    .25, .3 * Math.sin(t * .8), -a * .6 - orbitAng(t) * 1.6 - suck * 8, i => unsure * (.82 + .18 * Math.sin(t * 7 + i * 1.9)) + (1 - unsure), 0);
  CARDS.forEach((card, i) => {
    const t0 = T_ORBIT - .25 + i * .06, p = clamp(spring(t - t0, 90, .8), 0, 1.1);
    card.visible = t > t0;
    const R = lerp(9, 2.75, p) * (1 - suck), an = i / 6 * TAU + orbitAng(t) - (1 - p) * 1.2;
    _v.set(Math.cos(an) * R, Math.sin(an * 2 + i) * .25 * (1 - suck), Math.sin(an) * R).applyEuler(_e.set(.38, 0, -.12));
    card.position.set(C8[0] + _v.x, C8[1] + _v.y, C8[2] + _v.z);
    card.lookAt(CAM.position);
    card.scale.setScalar(Math.max(.001, (.75 + .25 * p) * (1 - suck)));
  });
  ORBPP.forEach((q, i) => {
    const an = q.a + orbitAng(t) * q.w * 1.5 + t * .1, R = q.r * (1 - .9 * suck);
    ORBP.set(i, C8[0] + Math.cos(an) * R, C8[1] + q.y * (1 - suck), C8[2] + Math.sin(an) * R, q.s * (1 + 2 * u), q.c, (.25 + .6 * u) * (1 - suck * .5));
  });
  ORBP.commit();
}
function camOrbit(t) {
  const a = t - T_HONEST, u = orbitU(t), d = lerp(8.2, 7.4, ss(seg(a, 0, 1.875))) - 1.4 * u * u, yaw = .12 * Math.sin(a * .4) + .9 * u * u;
  const tgt = [C8[0], C8[1] + .15 * (1 - u), C8[2]];
  return { p: [tgt[0] + Math.sin(yaw) * d, tgt[1] + .7 + .9 * u, tgt[2] + Math.cos(yaw) * d], tgt, roll: .14 * u * u };
}
function bgOrbit(t) {
  ground('think', t);
  ground('aurora', t, .55 * ss(orbitU(t)));
  const sp = sparkScreen();
  glow(SOFT.clay, sp.x, sp.y, 300 + 400 * orbitU(t), .25 + .4 * orbitU(t), 'lighter');
  vignette(.5);
}
function fgOrbit(t) {
  const sp = sparkScreen(), suck = inn(seg(t, SUCK2, T_DROP2 - .01));
  flash(.6 * pulse(t, T_HONEST, 1, .06), BR.white);
  // honesty
  const out1 = seg(t, bt(43.2), bt(43.9));
  rise('Quand je ne sais pas,', 960, 640, FR(112), BR.cream, spring(t - T_HONEST - .06, 170, .8), out1, { lh: 130, align: 'center', ls: -2 });
  rise('je vous le dis.', 960, 770, ISER(132), BR.clay, spring(t - bt(42), 170, .8), out1, { lh: 140, align: 'center' });
  // a small honest bubble: three dots, then the words
  const bA = ss(seg(t, bt(41), bt(41.3))) * (1 - out1), dots = t < bt(42.3);
  if (bA > 0) {
    const f = SANS(24, 500), msg = 'Je ne suis pas certain. Voici ce que je sais :', w = dots ? 110 : tw(msg, f) + 70, x0 = 960 - w / 2, y0 = 860;
    ctx.save(); ctx.globalAlpha = bA;
    rr(x0, y0, w, 56, 28); ctx.fillStyle = rgb(BR.cream, .1); ctx.fill(); ctx.strokeStyle = rgb(BR.cream, .28); ctx.lineWidth = 1.5; ctx.stroke();
    if (dots) for (let k = 0; k < 3; k++) { circ(960 - 22 + k * 22, y0 + 28, 6); ctx.fillStyle = rgb(BR.cream, .35 + .65 * Math.max(0, Math.sin(t * 9 - k * .9))); ctx.fill(); }
    else txt(msg.slice(0, Math.floor(clamp((t - bt(42.3)) / .55) * msg.length)), x0 + 35, y0 + 36, f, BR.cream, { alpha: .9 });
    ctx.restore();
  }
  // the orbit line
  const u = orbitU(t);
  rise('Tout ça, dans une seule conversation.', 960, 980, FR(64), BR.cream, spring(t - T_ORBIT - .15, 170, .8), seg(t, SUCK2 - .25, SUCK2), { lh: 80, align: 'center', ls: -1 });
  for (let k = 0; k < 8; k++) shock(t, T_ORBIT + k * BEAT * (k < 4 ? 1 : .5), sp.x, sp.y, { R: 380, w: 1.5, life: .4, a: .2 * u + .1 });
  streaks(sp.x, sp.y, t, SUCK2 - .05, T_DROP2 - SUCK2 + .05, true, { n: 90, R: 1300, L: 320, a: .85, seed: 13, col: HU.violet });
  glow(GLOW.amber, sp.x, sp.y, 40 + 300 * suck, .9 * suck);
  glow(GLOW.white, sp.x, sp.y, 20 + 40 * suck, suck);
}
SCENES.push({ t0: T_HONEST, cam: camOrbit, setup: setupOrbit, bg: bgOrbit, fg: fgOrbit });
CUTS.push(T_HONEST);
SUBS.push([T_HONEST, T_ORBIT - .3, 3], [T_ORBIT - .3, T_ORBIT + .6, 8], [T_ORBIT + .6, T_DROP2, 10]);
