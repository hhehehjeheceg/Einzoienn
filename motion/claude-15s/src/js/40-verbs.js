// =====================================================================================================
//  Scene 3 (3.52 - 6.5625 s): J'écris. / Je code. / J'analyse.
//  Three stations in the dark, joined by whip pans. The spark is the tool each time: the pen, the caret, the tracer.
// =====================================================================================================
const VERB = sceneGroup();
const C1 = [14, 0, 0], C2 = [14, -9, 0], C3 = [25, -9, 0];   // station centres
const WH = [[3.52, 3.8], [4.47, 4.72], [5.4, 5.66]];          // whip pans into station k
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ------------------------------------------------------------------ ambient dust (shared by the dark scenes)
const AMB = new Cloud(700);
const AMBP = [];
(() => { const r = mulberry32(808); for (let i = 0; i < AMB.n; i++) AMBP.push({ x: -6 + r() * 40, y: -15 + r() * 21, z: -7 + r() * 9, s: .015 + r() * .04, c: r() < .5 ? BR.clay : BR.cream, a: .15 + r() * .45, ph: r() * TAU, v: .05 + r() * .12 }); })();
function setAmb(t, a = 1) {
  AMB.obj.visible = a > .01;
  AMBP.forEach((p, i) => AMB.set(i, p.x + Math.sin(t * .3 + p.ph) * .2, p.y + ((t * p.v + p.ph) % 1.5), p.z, p.s, p.c, p.a * a * (.6 + .4 * Math.sin(t * 2.3 + p.ph))));
  AMB.commit();
}

// ------------------------------------------------------------------ station 1: the page
const PAGE_W = 2.3, PAGE_H = 3.0;
const PG = mk(736, 960), pgx = PG.g;
const PGT = new THREE.CanvasTexture(PG.c); PGT.colorSpace = THREE.SRGBColorSpace; PGT.anisotropy = 4;
const pageGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 24, 30);
const PAGE0 = pageGeo.attributes.position.array.slice();
const PAGE = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({ map: PGT, emissiveMap: PGT, emissive: 0xffffff, emissiveIntensity: .16, roughness: .82, side: THREE.DoubleSide }));
VERB.add(PAGE);
const PAGE_LINES = ['Il était une fois un phare', 'qui rêvait de voyager.', 'Chaque nuit, il envoyait', 'sa lumière au large,', 'pour voir le monde.'];
const PAGE_N = PAGE_LINES.join('').length;
function pageBend(x, y, t) {   // a gentle arch plus a curl on the lower right corner, breathing
  const xn = x / (PAGE_W / 2), yn = y / (PAGE_H / 2), c = Math.max(0, xn - yn * .9 - 1.05);
  return .09 * (1 - xn * xn) + .5 * c * c + .025 * Math.sin(t * 2 + yn * 2);
}
const pageK = t => clamp((t - T_V[0] - .16) / .74) * PAGE_N;
function pageCaret(t) {   // pen position on the page canvas at time t
  const k = pageK(t);
  if (k <= 0) return [70 + tw('Le phare', FR(76, 600)) * clamp((t - T_V[0] - .02) / .14), 170];
  let n = 0;
  for (let li = 0; li < PAGE_LINES.length; li++) {
    const L = PAGE_LINES[li];
    if (k <= n + L.length || li === PAGE_LINES.length - 1) return [70 + tw(L.slice(0, Math.ceil(clamp(k - n, 0, L.length))), ISER(54)), 300 + li * 84 - 18];
    n += L.length;
  }
}
function drawPage(t) {
  const t0 = T_V[0] + .02, k = pageK(t);
  withCtx(pgx, () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#faf8f2'; ctx.fillRect(0, 0, 736, 960);
    const g = ctx.createLinearGradient(0, 0, 736, 960); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(1, 'rgba(214,200,180,0.25)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 736, 960);
    ctx.fillStyle = rgb(BR.line, .7);
    for (let y = 300; y < 900; y += 84) ctx.fillRect(70, y + 14, 596, 1.5);
    txt('Le phare', 70, 190, FR(76, 600), BR.ink, { alpha: ss(seg(t, t0, t0 + .12)) });
    const ul = o5(seg(t, t0 + .08, t0 + .3));
    if (ul > 0) { ctx.strokeStyle = rgb(BR.clay); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(72, 222); ctx.quadraticCurveTo(170, 214, 72 + 300 * ul, 226 - 6 * ul); ctx.stroke(); }
    let n = 0;
    PAGE_LINES.forEach((L, li) => {
      const y = 300 + li * 84, vis = clamp(k - n, 0, L.length);
      if (vis > 0) {
        const full = Math.floor(vis), s0 = L.slice(0, full);
        txt(s0, 70, y, ISER(54), BR.ink);
        if (full < L.length) { txt(L[full], 70 + tw(s0, ISER(54)), y, ISER(54), BR.ink, { alpha: vis - full }); }
      }
      n += L.length;
    });
  });
  PGT.needsUpdate = true;
}
function placePage(t) {
  const P = add3(C1, [1.3, .08 + .05 * Math.sin(t * 1.7), 0]);
  PAGE.position.set(P[0], P[1], P[2]);
  PAGE.rotation.set(-.1 + .03 * Math.sin(t * 1.3), -.36 + .05 * Math.sin(t * .9), .045);
  const pos = pageGeo.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) pos[i + 2] = pageBend(PAGE0[i], PAGE0[i + 1], t);
  pageGeo.attributes.position.needsUpdate = true; pageGeo.computeVertexNormals();
  PAGE.updateMatrixWorld();
}
function pagePoint(u, v, t) {   // texture coordinates -> world (on the bent page)
  const x = (u - .5) * PAGE_W, y = (.5 - v) * PAGE_H;
  return V3(x, y, pageBend(x, y, t) + .05).applyMatrix4(PAGE.matrixWorld);
}

// ------------------------------------------------------------------ station 2: the code panel
const CODE_W = 3.3, CODE_H = 2.15;
const PANEL = new THREE.Mesh(slab(CODE_W, CODE_H, .16, .09, .03), MAT.ink); VERB.add(PANEL);
const CD = mk(1024, 668), cdx = CD.g;
const CDT = new THREE.CanvasTexture(CD.c); CDT.colorSpace = THREE.SRGBColorSpace; CDT.anisotropy = 4;
const SCREEN = new THREE.Mesh(new THREE.PlaneGeometry(CODE_W - .14, CODE_H - .14), new THREE.MeshBasicMaterial({ map: CDT, toneMapped: false }));
SCREEN.position.z = .079; PANEL.add(SCREEN);
const CODE = [   // [text, colour] runs per line
  [['def ', 'kw'], ['saluer', 'fn'], ['(nom):', 'p']],
  [['    return ', 'kw'], ['f"Bonjour, {nom} !"', 'str']],
  [],
  [['print', 'kw'], ['(', 'p'], ['saluer', 'fn'], ['(', 'p'], ['"vous"', 'str'], ['))', 'p']],
];
const CODE_N = CODE.reduce((n, L) => n + L.reduce((m, r) => m + r[0].length, 0), 0);
const SYN = { kw: HU.coral, fn: HU.amber, str: HU.mint, p: BR.cream };
const codeK = t => clamp((t - T_V[1] - .06) / .62) * CODE_N;
function codeCaret(t) {   // caret position on the code canvas at time t
  const k = codeK(t);
  let n = 0;
  for (let li = 0; li < CODE.length; li++) {
    const L = CODE[li], len = L.reduce((m, r) => m + r[0].length, 0), y = 150 + li * 64;
    if (k <= n + len && (len > 0 || k >= n)) return [92 + tw(L.map(r => r[0]).join('').slice(0, Math.floor(clamp(k - n, 0, len))), MONO(30)), y];
    n += len;
  }
  return [92 + tw('print(saluer("vous"))', MONO(30)), 150 + 3 * 64];
}
function drawCode(t) {
  const t0 = T_V[1] + .06, k = codeK(t), outA = ss(seg(t, T_V[1] + .74, T_V[1] + .86));
  withCtx(cdx, () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#161513'; ctx.fillRect(0, 0, 1024, 668);
    ctx.fillStyle = '#1f1d1a'; ctx.fillRect(0, 0, 1024, 70);
    [[HU.coral, 44], [HU.amber, 76], [HU.mint, 108]].forEach(([c, x]) => { circ(x, 35, 9); ctx.fillStyle = rgb(c, .9); ctx.fill(); });
    txt('bonjour.py', 512, 44, MONO(22), BR.mute, { align: 'center' });
    let n = 0;
    const caret = codeCaret(t);
    CODE.forEach((L, li) => {
      const y = 150 + li * 64;
      txt(String(li + 1), 52, y, MONO(26), BR.dim, { align: 'right' });
      let x = 92;
      for (const [s, c] of L) {
        const vis = clamp(Math.floor(k - n), 0, s.length);
        if (vis > 0) txt(s.slice(0, vis), x, y, MONO(30), SYN[c]);
        x += tw(s, MONO(30)); n += s.length;
      }
    });
    const blink = t > t0 + .62 ? (Math.floor((t - t0) / BEAT * 2) % 2 === 0 ? 1 : 0) : 1;
    if (outA < .5) { ctx.fillStyle = rgb(BR.clay, blink); ctx.fillRect(caret[0] + 2, caret[1] - 26, 3, 34); }
    ctx.fillStyle = rgb(BR.dim, .5); ctx.fillRect(40, 440, 944 * o5(seg(t, T_V[1] + .7, T_V[1] + .9)), 1.5);
    if (outA > 0) {
      txt('›', 52, 512, MONO(30), HU.mint, { alpha: outA });
      txt('Bonjour, vous !', 92, 512, MONO(30), BR.cream, { alpha: outA });
      const ck = o5(seg(t, T_V[1] + .82, T_V[1] + .98));
      if (ck > 0) {
        circ(960, 500, 20 * ck); ctx.fillStyle = rgb(HU.mint, .9); ctx.fill();
        ctx.strokeStyle = '#161513'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(950, 500); ctx.lineTo(957, 507); ctx.lineTo(971, 492); ctx.stroke();
      }
    }
  });
  CDT.needsUpdate = true;
}
const BRACES = ['{', '}'].map(ch => {
  const { shapes } = glyphShapes(ch, 1.25);
  const g = new THREE.ExtrudeGeometry(shapes, { depth: .16, bevelEnabled: true, bevelThickness: .03, bevelSize: .018, bevelSegments: 4, curveSegments: 10 });
  g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -.08);
  const m = new THREE.Mesh(g, MAT.mint); VERB.add(m); return m;
});
function placeCode(t) {
  const P = add3(C2, [1.3, .02 + .04 * Math.sin(t * 1.5), 0]);
  PANEL.position.set(P[0], P[1], P[2]);
  PANEL.rotation.set(-.06 + .02 * Math.sin(t * 1.1), -.3 + .04 * Math.sin(t * .8), 0);
  PANEL.updateMatrixWorld();
  [[-.38, .82, .55, T_V[1] + .1], [2.92, -.8, .7, T_V[1] + .2]].forEach(([dx, dy, dz, t0], i) => {
    const p = spring(t - t0, 150, .66), m = BRACES[i];
    m.position.set(C2[0] + dx, C2[1] + dy + .06 * Math.sin(t * 2 + i), C2[2] + dz);
    m.rotation.set(.2 * Math.sin(t + i), (i ? -1 : 1) * (.5 + t * .9) + (1 - p) * 2, (i ? .15 : -.15));
    m.scale.setScalar(Math.max(.001, p * .9));
  });
}
function codePoint(px, py) {   // code canvas pixels -> world
  return V3((px / 1024 - .5) * (CODE_W - .14), (.5 - py / 668) * (CODE_H - .14), .12).applyMatrix4(PANEL.matrixWorld);
}

// ------------------------------------------------------------------ station 3: the chart (example data)
const BARS_H = [.55, .92, .72, 1.22, 1.04, 1.62];
const CHART = group(VERB);
const BASE = new THREE.Mesh(slab(3.7, 2.0, .16, .07, .025), MAT.ink); BASE.rotation.x = -Math.PI / 2; CHART.add(BASE);
const barGeo = (() => { const g = new THREE.ExtrudeGeometry(rrShape(.3, .3, .07), { depth: 1, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 3, curveSegments: 8 }); g.rotateX(-Math.PI / 2); return g; })();
const BARS = BARS_H.map((h, i) => { const m = new THREE.Mesh(barGeo, i === 5 ? MAT.clay : MAT.cream); CHART.add(m); return m; });
const barX = i => -1.35 + i * .54;
const LINE_PTS = BARS_H.map((h, i) => V3(barX(i), h + .32, 0));
const CURVE = new THREE.CatmullRomCurve3(LINE_PTS, false, 'centripetal');
const TUBE = new THREE.Mesh(new THREE.TubeGeometry(CURVE, 160, .02, 8, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf2b45a).multiplyScalar(1.3) }));
CHART.add(TUBE);
const DOTS = LINE_PTS.map(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(.055, 20, 12), MAT.cream); m.position.copy(p); CHART.add(m); return m; });
const lineU = t => o5(seg(t, T_V[2] + .3, T_V[2] + .78));
function placeChart(t) {
  CHART.position.set(C3[0] + 1.1, C3[1] - .78 + .03 * Math.sin(t * 1.4), C3[2]);
  CHART.rotation.set(0, -.42 + .1 * seg(t, T_V[2], T_BURST[0]), 0);
  BARS.forEach((m, i) => {
    const p = clamp(spring(t - T_V[2] - .06 - i * .05, 160, .72), 0, 1.2);
    m.position.set(barX(i), .04, 0); m.scale.set(1, Math.max(.001, BARS_H[i] * p), 1);
  });
  const u = lineU(t);
  TUBE.geometry.setDrawRange(0, Math.floor(u * 160) * 8 * 6);
  DOTS.forEach((m, i) => { const p = spring(t - T_V[2] - .3 - i / 5 * .38, 220, .6); m.scale.setScalar(Math.max(.001, clamp(p, 0, 1.3))); });
  CHART.updateMatrixWorld();
}

// ------------------------------------------------------------------ camera: station poses and whips
function stationPose(k, t) {
  const u = t - [3.8, 4.72, 5.66][k];
  if (k === 0) return { p: add3(C1, [-1.0 + .12 * u, .65 - .05 * u, 7.3 - .3 * u]), tgt: add3(C1, [.2 + .05 * u, .08, 0]), roll: -.01 };
  if (k === 1) return { p: add3(C2, [-.85 + .1 * u, .3, 7.2 - .3 * u]), tgt: add3(C2, [.22, -.02, 0]), roll: .012 };
  return { p: add3(C3, [-1.1 + .15 * u, 2.3 - .1 * u, 7.0 - .3 * u]), tgt: add3(C3, [.25, -.15, 0]), roll: -.015 };
}
function camVerb(t) {
  const blend = (A, B, e) => ({ p: A.p.map((v, i) => lerp(v, B.p[i], e)), tgt: A.tgt.map((v, i) => lerp(v, B.tgt[i], e)), roll: lerp(A.roll || 0, B.roll || 0, e) + Math.sin(Math.PI * e) * (B === null ? 0 : .06) });
  const [a0, a1] = WH[0], [b0, b1] = WH[1], [c0, c1] = WH[2];
  if (t < a1) return blend(camOpen(a0), stationPose(0, a1), ioq(seg(t, a0, a1)));
  if (t < b0) return stationPose(0, t);
  if (t < b1) return blend(stationPose(0, b0), stationPose(1, b1), ioq(seg(t, b0, b1)));
  if (t < c0) return stationPose(1, t);
  if (t < c1) return blend(stationPose(1, c0), stationPose(2, c1), ioq(seg(t, c0, c1)));
  return stationPose(2, t);
}

// ------------------------------------------------------------------ the spark: pen, caret, tracer (and its flights between stations)
function sparkVerbPos(t) {
  const lt = Math.max(0, t);
  if (t < WH[1][0]) { const c = pageCaret(t); return pagePoint(c[0] / 736, c[1] / 960, lt); }
  if (t < WH[2][0]) { const c = codeCaret(t); return codePoint(c[0] + 34, c[1] - 52); }
  const u = lineU(t); const p = CURVE.getPoint(Math.max(.001, u)); return p.applyMatrix4(CHART.matrixWorld);
}
function setupVerb(t) {
  VERB.visible = true; setAmb(t);
  placePage(t); drawPage(t); placeCode(t); drawCode(t); placeChart(t);
  if (t < 3.8) { setupOpen(t); OPEN.visible = true; }   // the letters fall away during the whip
  let p = sparkVerbPos(t);
  // flights: from the previous station's last tool position to the next one's first
  const fly = (t0, t1, from, to) => { const e = ioq(seg(t, t0, t1)); return V3(lerp(from.x, to.x, e), lerp(from.y, to.y, e) + Math.sin(Math.PI * e) * .6, lerp(from.z, to.z, e) + Math.sin(Math.PI * e) * .8); };
  if (t < 3.86) {
    p = fly(3.5, 3.86, V3(SP2.x + 2.4, SP2.y, .3), pagePoint(70 / 736, 170 / 960, 3.86));
  } else if (t >= WH[1][0] - .05 && t < WH[1][1] + .06) {
    const c = pageCaret(WH[1][0] - .05);
    p = fly(WH[1][0] - .05, WH[1][1] + .06, pagePoint(c[0] / 736, c[1] / 960, WH[1][0] - .05), codePoint(92 + 34, 98));
  } else if (t >= WH[2][0] - .05 && t < WH[2][1] + .1) {
    const c = codeCaret(WH[2][0] - .05);
    p = fly(WH[2][0] - .05, WH[2][1] + .1, codePoint(c[0] + 34, c[1] - 52), CURVE.getPoint(.001).applyMatrix4(CHART.matrixWorld));
  }
  const s = (t >= WH[1][1] && t < WH[2][0] ? .13 : .17) + .015 * Math.sin(t * 9);
  sparkAt(p.x, p.y, p.z, s, .3, .2 * Math.sin(t * 2), -t * 5.5, 1, 0);
}
function bgVerb(t) {
  ctx.fillStyle = '#080706'; ctx.fillRect(0, 0, W, H);
  flowBG('night', LUT.night, { sx: 1.4, sp: .05, gain: 1.1, bias: -.12 }, .85);
  const sp = sparkScreen();
  glow(SOFT.clay, sp.x, sp.y, 260, .3, 'lighter');
  glow(SOFT.clay, 1300, 560, 900, .12, 'lighter');
}
const VERB_SUB = ['Textes, e-mails, histoires.', 'Python, JavaScript, SQL…', 'Documents, données, images.'];
function fgVerb(t) {
  if (t < 3.65) fgOpen(t);
  const sp = sparkScreen();
  glow(GLOW.amber, sp.x, sp.y, 70, .55);
  // ink sparks left behind by the pen / caret / tracer
  for (let i = 1; i <= 6; i++) {
    const tp = t - i * .035; if (tp < 3.88 || Math.abs(tp - WH[1][0]) < .32 || Math.abs(tp - WH[2][0]) < .32) continue;
    const q = sparkVerbPos(tp), s = proj(q.x, q.y, q.z);
    sparkle(s.x, s.y, 9 - i, t * 3 + i, .55 * (1 - i / 7), i % 2 ? BR.cream : HU.amber);
  }
  // the verbs
  for (let k = 0; k < 3; k++) {
    const t0 = T_V[k], tEnd = k < 2 ? T_V[k + 1] - .16 : 99;
    if (t < t0 - .05 || t > tEnd + .3) continue;
    const pin = spring(t - t0 - .02, 190, .78), pout = io(seg(t, tEnd, tEnd + .24));
    rise(['01', '02', '03'][k] + '  /  03', 168, 426, MONO(20), BR.clay, spring(t - t0, 220, .9), pout, { lh: 30, ls: 4, rot: 0 });
    rise(VERBS[k], 160, 600, FR(150), BR.cream, pin, pout, { lh: 170, ls: -3 });
    rise(VERB_SUB[k], 168, 690, SANS(30, 500), BR.cream, spring(t - t0 - .14, 190, .8), pout, { lh: 44, alpha: .6, rot: 0 });
  }
  // honest label under the chart
  if (t > T_V[2]) {
    const b = proj(C3[0] + 1.1, C3[1] - .78, 1.15), a = ss(seg(t, T_V[2] + .5, T_V[2] + .7));
    txt('DONNÉES D’EXEMPLE', b.x, b.y + 52, SANS(18, 600), BR.cream, { align: 'center', ls: 4, alpha: .5 * a });
  }
  vignette(.55);
}
SCENES.push({ t0: 3.52, cam: camVerb, setup: setupVerb, bg: bgVerb, fg: fgVerb });
SUBS.push([3.52, 3.86, 14], [3.86, 4.47, 5], [4.47, 4.76, 14], [4.76, 5.4, 5], [5.4, 5.7, 14], [5.7, 6.5625, 5]);
