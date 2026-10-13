// =====================================================================================================
//  Scenes A (Bonjour), B (Je suis Claude), C (verbs + the object that morphs)
// =====================================================================================================
const B = { size: 200, ls: -9, y: 612 };
const L = {};          // layout, computed once the fonts are loaded
const OS = 1.2;        // scale of the morphing object in scene C
const GREET = ['HELLO', 'HOLA', 'CIAO', 'HALLO', 'OLÁ', 'こんにちは', '你好', 'ПРИВЕТ', 'NAMASTE', 'MERHABA', 'BONJOUR'];
const TRAITS = [['curieux', 'mint'], ['précis', 'sky'], ['honnête', 'amber'], ['bienveillant', 'pink']];
const CODE = [
  [['function', 'kw'], [' ', 'p'], ['saluer', 'fn'], ['(', 'p'], ['nom', 'var'], [') {', 'p']],
  [['  return ', 'kw'], ['`Bonjour, ${', 'str'], ['nom', 'var'], ['} !`', 'str'], [';', 'p']],
  [['}', 'p']],
  [],
  [['saluer', 'fn'], ['(', 'p'], ['"monde"', 'str'], [');', 'p']],
  [['// "Bonjour, monde !"', 'cm']],
];
const CODE_COL = { kw: HU.coral, fn: HU.sky, var: HU.mint, str: HU.amber, p: hex('#9b988f'), cm: BR.dim };

function initLayoutABC() {
  // A
  const bf = SANS(B.size, 600);
  L.b = { font: bf, pre: [], adv: [] };
  for (let i = 0; i <= 7; i++) L.b.pre.push(i ? tw('Bonjour'.slice(0, i), bf, B.ls) : 0);
  for (let i = 0; i < 7; i++) L.b.adv.push(L.b.pre[i + 1] - L.b.pre[i]);
  L.b.wv = L.b.pre[7] - B.ls; L.b.pw = 46;
  const lx = 960 - (L.b.pre[7] + L.b.pw) / 2;
  L.P1 = { x: lx + L.b.wv + 10 + 18, y: B.y - 18 };
  L.lbl = '// 01 · PRÉSENTATION'; L.lblW = tw(L.lbl, MONO(22), 3);
  L.greet = GREET.join('   ·   ') + '   ·   '; L.greetW = tw(L.greet, MONO(21), 4);
  // B
  const s2 = L.s2 = { fa: SANS(150, 600), lsa: -6, fb: SER(244), lsb: -2, y: 618 };
  const wa = tw('Je suis', s2.fa, s2.lsa) - s2.lsa, wb = tw('Claude', s2.fb, s2.lsb) - s2.lsb;
  const total = wa + 46 + wb + 14 + 34;
  s2.x0 = 960 - total / 2; s2.xJe = s2.x0; s2.xSuis = s2.x0 + tw('Je ', s2.fa, s2.lsa);
  s2.xC = s2.x0 + wa + 46; s2.wC = wb; s2.preC = [];
  for (let k = 0; k < 6; k++) s2.preC.push(k ? tw('Claude'.slice(0, k), s2.fb, s2.lsb) : 0);
  L.P2 = { x: s2.xC + wb + 14 + 17, y: s2.y - 17 };
  s2.sub = 'Une IA conçue par Anthropic'; s2.fs = SANS(40, 500); s2.wSub = tw(s2.sub, s2.fs, -.5);
  // C
  L.ph = { font: SANS(124, 600) };
  const r = mulberry32(11);
  L.page = { lis: [], ecr: [] };
  for (let j = 0; j < 9; j++) L.page.lis.push(j === 8 ? 150 : 236 + r() * 76);
  for (let j = 0; j < 7; j++) L.page.ecr.push(j === 6 ? 130 : 220 + r() * 92);
  L.code = CODE.map(line => { let x = 0; const parts = line.map(([s, k]) => { const o = { s, k, x }; x += tw(s, MONO(23)); return o; }); return { parts, w: x }; });
  L.codeT = []; { let t0 = 11.3; L.code.forEach(l => { L.codeT.push(l.w ? t0 : -1); if (l.w) t0 += .12; }); }
  // fibonacci sphere (46 nodes) + 3 nearest neighbours
  const NS = 46; L.sph = [];
  for (let i = 0; i < NS; i++) { const y = 1 - 2 * (i + .5) / NS, rad = Math.sqrt(1 - y * y), th = i * 2.399963; L.sph.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, hue: HN[i % 6] }); }
  const es = new Set(); L.sphE = [];
  L.sph.forEach((p, i) => {
    const d = L.sph.map((q, j) => [j, (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2]).filter(a => a[0] !== i).sort((a, b) => a[1] - b[1]);
    for (let n = 0; n < 3; n++) { const j = d[n][0], key = Math.min(i, j) + '-' + Math.max(i, j); if (!es.has(key)) { es.add(key); L.sphE.push([Math.min(i, j), Math.max(i, j)]); } }
  });
  L.tags = ['contexte', 'logique', 'mémoire', 'doute'].map((s, i) => ({ s, w: tw(s, SANS(21, 600), -.2), hue: HN[(i * 2 + 1) % 6], a: -.5 + i * 1.6 }));
  // ripples on the dot grid: every keystroke, every change of state
  TT.forEach((t, i) => ripple(t, 960 + (i - 3) * 90, B.y - 74, 5, hueAt(i)));
  ripple(PT, L.P1.x, L.P1.y, 14, 'coral'); ripple(4.16, s2.xC + wb / 2, s2.y - 80, 15, 'violet');
  VT.forEach((t, i) => ripple(t, OC.x, OC.y, 11, VHUE[i]));
  // bursts of colour
  TT.forEach((t, i) => addBurst({ t0: t, x: 960 + (i - 3) * 95, y: B.y - 70, n: 7, speed: 330, spread: 2.2, dir: -Math.PI / 2, life: .7, size: 4.5, hues: [HN[i % 6], HN[(i + 2) % 6]], light: false, grav: 600, tag: 'A' }));
  addBurst({ t0: PT, x: L.P1.x, y: L.P1.y, n: 26, speed: 520, life: 1.0, size: 5, light: false, shape: 'star', tag: 'A' });
  addBurst({ t0: 4.16, x: s2.xC + wb / 2, y: s2.y - 120, n: 30, speed: 600, spread: 3.0, dir: -Math.PI / 2, life: 1.1, size: 5, light: false, shape: 'conf', grav: 700, tag: 'B' });
  addBurst({ t0: 5.0, x: s2.xC + wb, y: s2.y + 34, n: 14, speed: 280, spread: 2.4, dir: -Math.PI / 2, life: .8, size: 4, light: false, tag: 'B' });
  VT.forEach((t, i) => addBurst({ t0: t, x: OC.x, y: OC.y, n: 20, speed: 520, life: .9, size: 4.5, hues: [VHUE[i], 'amber', 'pink'], light: false, shape: i % 2 ? 'star' : 'dot', tag: 'C', jitter: 40 }));
}

// ------------------------------------------------------------------ the aurora under scenes A-C (pastel cream, tinted by the current verb)
function auroraCream(t, z, f) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rgb(BR.cream); ctx.fillRect(0, 0, W, H);
  const k = ss(seg(t, 0, 3)) * .55 + .35 * ss(seg(t, 4, 6)) + .3 * ss(seg(t, 8, 9));
  flowBG(f, 'pastel', LUT.pastelHot, { sx: 1.05, sp: .04, warp: 1.1, gain: 1.0, shade: .1 }, clamp(k, .3, .9));
  // a stain of the current verb's colour behind the object
  if (t >= 7.6 && t < 14.2) {
    for (let i = 0; i < 4; i++) {
      const on = seg(t, VT[i] - .1, VT[i] + .5) * (i < 3 ? 1 - seg(t, VT[i + 1] - .1, VT[i + 1] + .5) : 1 - seg(t, 13.5, 14));
      if (on > 0) { glow(SOFT[VHUE[i]], OC.x + 20 * Math.sin(t * .6), OC.y, 640, .55 * on, 'source-over'); glow(SOFT[VHUE[i]], 330, 700, 520, .22 * on, 'source-over'); }
    }
  }
  setCam(z);
  drawGrid(t, BR.ink, .07);
}
function setCam(z) { ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), H / 2 * (1 - z)); }
function camZ(t) {
  let z = 1 + .10 * io(seg(t, 0, 14));
  const P2D = [[2.0, .008], [4.16, .009], [8.0, .007], [9.5, .006], [11.0, .006], [12.5, .006]];
  for (const [b, a] of P2D) z *= 1 + pulse(t, b, a);
  return z;
}
function vignetteLight() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(960, 540, 420, 960, 540, 1180);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(70,45,25,0.08)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ the protagonist (caret -> period -> orb -> object)
function lineX(t) {
  let x = 960;
  for (let i = 0; i < 7; i++) x -= L.b.adv[i] / 2 * spring(t - TT[i], 220, .9);
  return x - L.b.pw / 2 * spring(t - PT, 220, .9);
}
function caretState(t) {
  const lx = lineX(t);
  let typed = 0; for (let i = 0; i < 7; i++) if (t >= TT[i]) typed += L.b.adv[i];
  const m = spring(t - PT, 300, .82);
  const cx = lx + typed + 12, cy = B.y - 74, px = lx + L.b.wv + 10 + 18, py = B.y - 18;
  let a = ss(seg(t, .1, .16));
  if (t > .45 && t < .67) a *= 1 - ss(seg(t, .45, .5)) + ss(seg(t, .62, .67));
  const pop = spring(t - .1, 420, .55);
  return { x: lerp(cx, px, m), y: lerp(cy, py, m), w: lerp(12, 36, m), h: lerp(150 * pop, 36, m), a, m };
}
function arcMove(p, q, t, t0, k, z, arc) {
  if (t <= t0) return p;
  const m = spring(t - t0, k, z);
  return { x: lerp(p.x, q.x, m), y: lerp(p.y, q.y, m) + arc * Math.sin(Math.PI * clamp(m)) };
}
function dotXY(t) {
  let p = t < 3.62 ? caretState(t) : L.P1;
  p = arcMove(p, L.P2, t, 3.62, 150, .8, -70);
  p = arcMove(p, OC, t, 7.55, 170, .8, 70);
  return p;
}
function objGeom(t) {
  const g = { w: 36, h: 36, r: 18, fill: BR.clay };
  const a = spring(t - 8.0, 170, .8);
  g.w = lerp(36, 400, a); g.h = lerp(36, 500, a); g.r = lerp(18, 26, a); g.fill = mixc(BR.clay, BR.paper, clamp(a * 1.6));
  const b = spring(t - 11.0, 170, .8);
  g.w = lerp(g.w, 600, b); g.h = lerp(g.h, 430, b); g.r = lerp(g.r, 20, b); g.fill = mixc(g.fill, hex('#1d1b22'), ss(clamp(b * 2.2)));
  const c = spring(t - 12.5, 240, .85);
  g.w = lerp(g.w, 40, c); g.h = lerp(g.h, 40, c); g.r = lerp(g.r, 20, c); g.fill = mixc(g.fill, BR.clay, clamp(c * 1.3));
  const s = lerp(1, .55, inn(seg(t, 13.7, 13.97)));
  g.w *= s; g.h *= s; g.r *= s;
  return g;
}
function drawDot(t) {
  const p = dotXY(t);
  if (t < 3.62) {
    const c = caretState(t);
    if (c.a <= 0) return;
    if (c.m < .5) {   // the caret: a gradient bar that turns into the period
      const g = ctx.createLinearGradient(0, p.y - c.h / 2, 0, p.y + c.h / 2); g.addColorStop(0, rgb(HU.amber)); g.addColorStop(1, rgb(HU.coral));
      ctx.globalAlpha = c.a; rr(p.x - c.w / 2, p.y - c.h / 2, c.w, c.h, Math.min(c.w, c.h) / 2); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
      glow(SOFT.coral, p.x, p.y, 70, .35 * c.a, 'source-over');
    } else drawOrb(p.x, p.y, Math.max(c.w, c.h) / 2, t, { glow: .8 });
    return;
  }
  const r = 18 * (1 + pulse(t, 4.16, .16, .12));
  drawOrb(p.x, p.y, r, t, { ring: ss(seg(t, 4.3, 4.8)) * (1 - seg(t, 7.4, 7.7)), sat: 3, ringR: 2.6 });
}

// ------------------------------------------------------------------ A: "Bonjour."
function drawA(t) {
  if (t > 4.0) return;
  const lx = lineX(t);
  for (let i = 0; i < 7; i++) {
    const tt = TT[i]; if (t < tt) continue;
    const o0 = 3.42 + .028 * i, po = inn(seg(t, o0, o0 + .3));
    if (po >= 1) continue;
    const x = lx + L.b.pre[i], a = clamp((t - tt) / .045), sp = spring(t - tt, 520, .76);
    ctx.save();
    if (po > 0) { ctx.beginPath(); ctx.rect(x - 70, B.y - 232, L.b.adv[i] + 140, 300); ctx.clip(); }
    const s = .8 + .2 * sp, cx = x + L.b.adv[i] / 2;
    ctx.translate(cx, B.y + 16 * (1 - sp) - po * 310); ctx.rotate(-po * .06); ctx.scale(s, s);
    ctx.globalAlpha = a;
    // each letter lands with a hard drop shadow in its own hue that folds back into the letter
    const off = 14 * Math.exp(-(t - tt) / .13);
    if (off > .6) txt('Bonjour'[i], -L.b.adv[i] / 2 + off, off, L.b.font, hueAt(i), { ls: B.ls });
    txt('Bonjour'[i], -L.b.adv[i] / 2, 0, L.b.font, BR.ink, { ls: B.ls });
    ctx.restore();
  }
  // mono label types itself above
  const n = Math.floor(seg(t, 2.3, 2.75) * L.lbl.length + .001);
  if (n > 0) {
    const po = inn(seg(t, 3.36, 3.62));
    ctx.globalAlpha = 1 - po;
    txt(L.lbl.slice(0, n), 960 - L.lblW / 2, B.y - 236 - 30 * po, MONO(22), BR.mute, { ls: 3 });
    if (t < 3.3 && (n < L.lbl.length || ((t - 2.75) % .5) < .3)) {
      const cx = 960 - L.lblW / 2 + tw(L.lbl.slice(0, n), MONO(22), 3) + 4;
      ctx.fillStyle = rgb(BR.clay); ctx.fillRect(cx, B.y - 256, 12, 26);
    }
    ctx.globalAlpha = 1;
  }
  // greetings marquee, low on the page
  const ma = ss(seg(t, 1.9, 2.5)) * (1 - ss(seg(t, 3.3, 3.7)));
  if (ma > 0) {
    ctx.save(); ctx.globalAlpha = .5 * ma;
    const sc = -((t - 1.9) * 140) % L.greetW;
    for (let k = 0; k < 3; k++) {
      let x = sc + k * L.greetW;
      GREET.forEach((g, i) => { const s = g + '   ·   '; txt(g, x, 848, MONO(21), mixc(BR.mute, hueAt(i), .75), { ls: 4 }); x += tw(s, MONO(21), 4); });
    }
    ctx.restore();
  }
}
// ------------------------------------------------------------------ B: "Je suis Claude."
function drawB(t) {
  if (t < 3.95 || t > 8.0) return;
  const g = L.s2;
  [['Je', g.xJe], ['suis', g.xSuis]].forEach(([w, x], j) => {
    const sp = spring(t - (4.0 + .07 * j), 170, .8), o = 7.3 + .03 * j;
    const wt = Math.round(lerp(220, 600, ss(clamp(sp))));
    rise(w, x, g.y, SANS(150, wt), BR.ink, sp, inn(seg(t, o, o + .32)), { ls: g.lsa, lh: 160 });
  });
  for (let k = 0; k < 6; k++) {
    const o = 7.36 + .03 * k;
    rise('Claude'[k], g.xC + g.preC[k], g.y, g.fb, BR.ink, spring(t - (4.16 + .032 * k), 170, .8), inn(seg(t, o, o + .32)), { ls: g.lsb, lh: 250, rot: .09 });
  }
  sheen('Claude', g.xC, g.y, g.fb, g.lsb, io(seg(t, 5.15, 5.85)));
  // underline draws itself in the rainbow, then leaves
  const u = o5(seg(t, 5.0, 5.5)), ur = inn(seg(t, 7.18, 7.44));
  if (u > 0 && ur < 1) {
    const x0 = g.xC + 6 + (g.wC - 6) * ur, x1 = g.xC + 6 + (g.wC - 6) * u, gr = ctx.createLinearGradient(g.xC, 0, g.xC + g.wC, 0);
    RAINBOW.forEach(([p, c]) => gr.addColorStop(p, rgb(c)));
    rr(x0, g.y + 30, x1 - x0, 8, 4); ctx.fillStyle = gr; ctx.fill();
  }
  rise(g.sub, 960 - g.wSub / 2, g.y + 118, g.fs, BR.mute, spring(t - 5.75, 170, .8), inn(seg(t, 7.24, 7.52)), { ls: -.5, lh: 48, rot: .02 });
  // the four traits float around the title
  const pos = [[600, 400], [1330, 372], [660, 872], [1260, 884]];
  TRAITS.forEach(([lab, h], i) => {
    const t0 = 5.3 + .15 * i, e = spring(t - t0, 200, .62), x = pos[i][0] + 10 * Math.sin(t * 1.1 + i * 1.7), y = pos[i][1] + 9 * Math.sin(t * 1.3 + i * 2.3), out_ = inn(seg(t, 7.1 + .04 * i, 7.4 + .04 * i));
    if (e > 0 && out_ < 1) chip(x, y - 60 * out_, lab, h, { scale: (.55 + .45 * e) * (1 - .3 * out_), alpha: clamp(e * 1.4) * (1 - out_), size: 30, h: 66, pad: 70 });
  });
}
// ------------------------------------------------------------------ C: verbs + the morphing object
function drawC(t) {
  if (t < 7.9 || t > 14.0) return;
  circ(236 + 4, 427, 5); ctx.fillStyle = rgb(HU[VHUE[Math.min(3, Math.max(0, VT.filter(v => t >= v).length - 1))]]); ctx.fill();
  rise('CE QUE JE FAIS', 256, 432, SANS(22, 600), BR.mute, spring(t - 8.0, 170, .8), inn(seg(t, 13.62, 13.88)), { ls: 5, lh: 30, rot: 0 });
  for (let i = 0; i < 4; i++) {
    const po = i < 3 ? io(seg(t, VT[i + 1] - .03, VT[i + 1] + .25)) : inn(seg(t, 13.62, 13.92));
    const sp = spring(t - VT[i], 190, .8);
    rise(PH[i], 232, 590, L.ph.font, BR.ink, sp, po, { ls: -5, lh: 132, rot: .035 });
    // a hue underline sweeps under the verb
    const u = o5(seg(t, VT[i] + .1, VT[i] + .55)), uo = po;
    if (u > 0 && uo < 1) { const w = tw(PH[i], L.ph.font, -5) * .98; rr(236 + w * uo, 626, w * (u - uo), 9, 4.5); ctx.fillStyle = rgb(HU[VHUE[i]]); ctx.fill(); }
  }
}
function drawObject(t) {
  const p = dotXY(t), g = objGeom(t);
  if (t >= 12.55) drawSphere(t, p, false);
  const big = clamp((g.w - 60) / 200);
  if (big > 0) {   // contact shadow under the object
    ctx.save(); ctx.translate(p.x, p.y + g.h / 2 * OS + 56); ctx.scale(g.w * OS / 260, .16); glow(SOFT.ink, 0, 0, 130, .22 * big, 'source-over'); ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(OS, OS);
  if (big > 0) { ctx.shadowColor = `rgba(60,38,20,${.2 * big})`; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26; }
  const mw = Math.min(g.w, g.h), orbA = 1 - ss(seg(mw, 56, 120));   // small: the glossy orb; large: the flat object (cross-fade in between)
  if (orbA < 1) { ctx.globalAlpha = 1 - orbA * 0; rr(-g.w / 2, -g.h / 2, g.w, g.h, g.r); ctx.globalAlpha = 1 - orbA; ctx.fillStyle = rgb(g.fill); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (orbA > 0) { ctx.save(); ctx.globalAlpha = orbA; drawOrb(0, 0, Math.max(10, mw / 2), t, { glow: .8 }); ctx.restore(); }
  if (t > 8.1 && t < 12.75) {
    ctx.save(); rr(-g.w / 2, -g.h / 2, g.w, g.h, g.r); ctx.clip();
    pageContents(t); editorContents(t, g);
    ctx.restore();
  }
  ctx.restore();
  if (t >= 12.55) drawSphere(t, p, true);
  // multiplayer cursor named "Claude" travelling over the page
  if (t > 8.5 && t < 11.1) {
    const e = ss(seg(t, 8.5, 8.8)) * (1 - ss(seg(t, 10.85, 11.05)));
    let cx, cy;
    if (t < 9.6) { const u = io(seg(t, 8.55, 9.3)); cx = p.x + OS * lerp(-120, 140, u); cy = p.y + OS * lerp(-205, 150, u); }
    else { const j = Math.min(6, Math.max(0, Math.floor((t - 9.86) / .145))), pr = clamp((t - 9.86 - j * .145) / (L.page.ecr[j] / 1800)); cx = p.x + OS * (-156 + L.page.ecr[j] * (t < 9.86 ? 0 : pr) + 12); cy = p.y + OS * (-150 + 36 * j + 20); }
    drawCursor(cx, cy, t < 9.6 ? 'sky' : 'coral', 'Claude', e, 1);
  }
}
function pageContents(t) {
  const left = -156, fade = 1 - seg(t, 11.0, 11.12);
  if (fade <= 0) return;
  ctx.globalAlpha = fade;
  // header strip: page title chip + three dots
  rr(-176, -238, 352, 30, 10); ctx.fillStyle = 'rgba(20,20,19,0.04)'; ctx.fill();
  for (let i = 0; i < 3; i++) { circ(-160 + i * 16, -223, 4.5); ctx.fillStyle = rgb([HU.coral, HU.amber, HU.mint][i], .9); ctx.fill(); }
  // "lis": lines appear, a scan band reads them, one sentence gets highlighted
  const ys = lerp(-222, 178, io(seg(t, 8.55, 9.3)));
  const sa = .22 * Math.sin(Math.PI * seg(t, 8.5, 9.38));
  const lis = L.page.lis;
  const hp = o5(seg(t, 9.0, 9.25)) * (1 - seg(t, 9.42, 9.55));
  if (hp > 0) { rr(left - 6, -150 + 36 * 4 - 9, (lis[4] + 12) * hp, 30, 8); ctx.fillStyle = rgb(HU.amber, .5); ctx.fill(); }
  if (sa > 0) {
    const sg = ctx.createLinearGradient(0, ys - 40, 0, ys + 6); sg.addColorStop(0, rgb(HU.sky, 0)); sg.addColorStop(1, rgb(HU.sky, sa * 1.6));
    ctx.fillStyle = sg; ctx.fillRect(-200, ys - 40, 400, 46);
    ctx.fillStyle = rgb(HU.sky, Math.min(1, sa * 4.2)); ctx.fillRect(-200, ys + 4, 400, 3);
  }
  for (let j = -1; j < 9; j++) {
    const y = j < 0 ? -190 : -150 + 36 * j, h = j < 0 ? 20 : 12, w = j < 0 ? 210 : lis[j];
    const tj = 8.2 + .03 * (j + 1), sx = o5(seg(t, tj, tj + .24));
    const rj = 9.42 + .018 * (9 - j), sr = inn(seg(t, rj, rj + .2));
    const ww = w * clamp(sx - sr); if (ww <= .5) continue;
    const read = clamp((ys - y) / 30);
    rr(left, y, ww, h, h / 2); ctx.fillStyle = rgb(mixc(BR.line, BR.ink, read * (j < 0 ? 1 : .82))); ctx.fill();
  }
  // margin notes pop in while it reads
  [[8.75, -60, 'mint'], [9.0, 22, 'violet']].forEach(([tn, yn, hn]) => {
    const e = spring(t - tn, 260, .7) * (1 - seg(t, 9.5, 9.62)); if (e <= 0) return;
    ctx.save(); ctx.translate(176, yn); ctx.scale(e, e); circ(0, 0, 15); ctx.fillStyle = rgb(HU[hn]); ctx.fill();
    ctx.fillStyle = BR.ink; ctx.fillRect(-6, -5, 12, 2.6); ctx.fillRect(-6, 1, 8, 2.6); ctx.restore();
  });
  // "écris": lines are written one after the other by a coral caret; a mini toolbar appears
  if (t > 9.6) {
    const tp = o5(seg(t, 9.66, 9.86));
    if (tp > 0) { rr(left, -190, 230 * tp, 20, 10); ctx.fillStyle = rgb(BR.ink, .9); ctx.fill(); }
    let head = null;
    L.page.ecr.forEach((w, j) => {
      const sj = 9.86 + .145 * j, pr = Math.pow(seg(t, sj, sj + w / 1800), .9);
      if (pr <= 0) return;
      const y = -150 + 36 * j;
      rr(left, y, w * pr, 12, 6); ctx.fillStyle = rgb(BR.ink, .8); ctx.fill();
      if (j === 2 && pr > .6) { rr(left + w * .35, y - 2, w * .3 * Math.min(1, (pr - .6) * 2.5), 16, 5); ctx.fillStyle = rgb(HU.coral, .4); ctx.fill(); }
      if (pr < 1) head = { x: left + w * pr, y };
    });
    if (!head && t < 9.86) head = { x: left + 230 * tp, y: -190 };
    if (head) { rr(head.x + 5, head.y - 7, 4, 26, 2); ctx.fillStyle = rgb(HU.coral); ctx.fill(); }
    const tb = spring(t - 10.4, 240, .75) * (1 - seg(t, 10.85, 10.98));
    if (tb > 0) {   // floating formatting toolbar
      ctx.save(); ctx.translate(20, -34 - 10 * (1 - tb)); ctx.scale(tb, tb); rr(-92, -19, 184, 38, 19); ctx.fillStyle = BR.ink; ctx.fill();
      txt('B', -66, 7, SANS(17, 800), BR.cream, { align: 'center' }); txt('I', -36, 7, SER(21), BR.cream, { align: 'center' }); txt('U', -8, 7, SANS(17, 600), BR.cream, { align: 'center' });
      ctx.fillStyle = BR.cream; ctx.fillRect(-14, 10, 12, 2);
      HN.slice(0, 4).forEach((h, i) => { circ(24 + i * 18, 0, 6); ctx.fillStyle = rgb(HU[h]); ctx.fill(); });
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}
function editorContents(t, g) {
  if (t < 11.05) return;
  const fade = 1 - seg(t, 12.48, 12.6); if (fade <= 0) return;
  const left = -g.w / 2 + 62, top = -g.h / 2, cw = g.w, ch = g.h;
  ctx.globalAlpha = seg(t, 11.18, 11.32) * fade;
  // title bar with traffic lights + tabs
  for (let i = 0; i < 3; i++) { circ(-cw / 2 + 28 + 22 * i, top + 26, 6.5); ctx.fillStyle = rgb([HU.coral, HU.amber, HU.mint][i]); ctx.fill(); }
  rr(-cw / 2 + 118, top + 10, 118, 34, 9); ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill();
  txt('salut.js', -cw / 2 + 134, top + 33, MONO(16), BR.cream);
  circ(-cw / 2 + 224, top + 27, 3.4, 0, TAU); ctx.fillStyle = rgb(HU.amber); ctx.fill();
  txt('style.css', -cw / 2 + 262, top + 33, MONO(16), BR.dim);
  ctx.fillStyle = 'rgba(240,238,230,0.07)'; ctx.fillRect(-cw / 2, top + 54, cw, 1.5);
  // gutter + line numbers + current line highlight
  ctx.fillStyle = 'rgba(240,238,230,0.03)'; ctx.fillRect(-cw / 2, top + 55, 46, ch - 55);
  for (let i = 0; i < 6; i++) txt(String(i + 1), -cw / 2 + 28, top + 104 + 40 * i, MONO(15), i === 4 ? BR.cream : BR.chrome, { align: 'right' });
  // minimap on the right
  for (let i = 0; i < 18; i++) { const w = 20 + ((i * 37) % 7) * 7; if (t > 11.3 + i * .025) { ctx.fillStyle = rgb(hueAt(i), .35); ctx.fillRect(cw / 2 - 20 - w * .5, top + 74 + i * 9, w * .5, 4); } }
  ctx.globalAlpha = fade;
  let head = null;
  L.code.forEach((line, i) => {
    const ti = L.codeT[i]; if (ti < 0 || t < ti) return;
    const pr = seg(t, ti, ti + .1), y = top + 104 + 40 * i;
    ctx.save(); ctx.beginPath(); ctx.rect(left - 6, y - 30, line.w * pr + 2, 44); ctx.clip();
    line.parts.forEach(o => txt(o.s, left + o.x, y, MONO(23), CODE_COL[o.k]));
    ctx.restore();
    if (pr < 1) head = { x: left + line.w * pr, y };
  });
  if (!head && t > 11.3) { const last = L.code[5]; if (((t - 12.0) % .5) < .3) head = { x: left + last.w, y: top + 104 + 200 }; }
  if (head) { rr(head.x + 3, head.y - 22, 3, 28, 1.5); ctx.fillStyle = rgb(HU.coral); ctx.fill(); }
  // autocomplete popup + status bar
  const ap = spring(t - 11.95, 300, .75) * (1 - seg(t, 12.3, 12.4));
  if (ap > 0) {
    ctx.save(); ctx.translate(left + 150, top + 270); ctx.scale(ap, ap); rr(0, 0, 190, 64, 10); ctx.fillStyle = '#2b2933'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.2; ctx.stroke();
    rr(6, 6, 178, 26, 6); ctx.fillStyle = rgb(HU.sky, .28); ctx.fill(); txt('saluer()', 16, 25, MONO(15), BR.cream); txt('salutation', 16, 52, MONO(15), BR.dim);
    circ(168, 19, 5, 0, TAU); ctx.fillStyle = rgb(HU.sky); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(-cw / 2, ch / 2 - 34, cw, 34);
  const sb = o5(seg(t, 12.05, 12.3)); if (sb > 0) { ctx.globalAlpha = fade * sb; rr(-cw / 2 + 14, ch / 2 - 28, 116, 22, 11); ctx.fillStyle = rgb(HU.mint, .22); ctx.fill(); circ(-cw / 2 + 28, ch / 2 - 17, 4.5); ctx.fillStyle = rgb(HU.mint); ctx.fill(); txt('0 erreur', -cw / 2 + 40, ch / 2 - 12, MONO(14), HU.mint); ctx.globalAlpha = fade; }
  txt('UTF-8   JS', cw / 2 - 16, ch / 2 - 12, MONO(14), BR.dim, { align: 'right' });
  ctx.globalAlpha = 1;
}
// a rotating sphere of connected, colourful nodes ("Je raisonne") with orbiting tags
function drawSphere(t, c, front) {
  const k = inn(seg(t, 13.66, 13.95));
  if (k >= 1) return;
  const ry = .9 * (t - 12.5) + 5 * inn(seg(t, 13.3, 13.95)), rx = .42 + .14 * Math.sin(t * 1.3);
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), R = 238 * OS;
  const pts = L.sph.map((p, i) => {
    const s = spring(t - (12.58 + .009 * i), 170, .74) * (1 - k);
    const x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy;
    const y2 = p.y * cx - z * sx, z2 = p.y * sx + z * cx;
    const f = 1 / (1 - .3 * z2);
    return { X: c.x + x * R * s * f, Y: c.y + y2 * R * s * f, d: (z2 + 1) / 2, s };
  });
  ctx.lineCap = 'round'; ctx.lineWidth = 2;
  for (const [a, b] of L.sphE) {
    const pa = pts[a], pb = pts[b], d = (pa.d + pb.d) / 2;
    if ((d >= .5) !== front || pa.s <= 0 || pb.s <= 0) continue;
    const gr = ctx.createLinearGradient(pa.X, pa.Y, pb.X, pb.Y); gr.addColorStop(0, rgb(HU[L.sph[a].hue], .1 + .5 * d)); gr.addColorStop(1, rgb(HU[L.sph[b].hue], .1 + .5 * d));
    ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(pa.X, pa.Y); ctx.lineTo(pb.X, pb.Y); ctx.stroke();
  }
  if (front && t > 12.75) {
    for (let j = 0; j < 16; j++) {
      const [a, b] = L.sphE[(j * 7) % L.sphE.length], u = ((t - 12.7) * 1.6 + j * .29) % 1;
      const al = Math.sin(Math.PI * u) * seg(t, 12.75, 12.9) * (1 - k), hc = L.sph[a].hue;
      const px = lerp(pts[a].X, pts[b].X, u), py = lerp(pts[a].Y, pts[b].Y, u);
      glow(SOFT[hc], px, py, 18, al * .7, 'source-over'); circ(px, py, 4.2); ctx.fillStyle = rgb(HU[hc], al); ctx.fill();
    }
  }
  pts.map((p, i) => [p, i]).filter(([p]) => (p.d >= .5) === front && p.s > 0).sort((a, b) => a[0].d - b[0].d).forEach(([p, i]) => {
    const hc = L.sph[i].hue, rr_ = (3 + 6.5 * p.d) * clamp(p.s * 1.2);
    if (p.d > .55) glow(SOFT[hc], p.X, p.Y, rr_ * 3.4, .4 * p.d, 'source-over');
    circ(p.X, p.Y, rr_); ctx.fillStyle = rgb(mixc(BR.ink, HU[hc], .25 + .75 * p.d), .35 + .65 * p.d); ctx.fill();
  });
  if (front && t > 12.9) {   // tags orbit the sphere on an inclined ellipse
    const kk = (1 - k) * ss(seg(t, 12.9, 13.2));
    L.tags.forEach((tg, i) => {
      const a = tg.a + (t - 12.5) * .85, ex = c.x + Math.cos(a) * 330 * OS, ey = c.y + (Math.sin(a) * 120 - 20 + 38 * Math.sin(a * 2)) * OS, dep = (Math.sin(a) + 1) / 2;
      ctx.save(); ctx.translate(ex, ey); const s = (.75 + .35 * dep) * kk; ctx.scale(s, s); ctx.globalAlpha = (.45 + .55 * dep) * kk;
      rr(-tg.w / 2 - 22, -19, tg.w + 44, 38, 19); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); ctx.strokeStyle = rgb(HU[tg.hue], .7); ctx.lineWidth = 1.5; ctx.stroke();
      circ(-tg.w / 2 - 8, 0, 4.5); ctx.fillStyle = rgb(HU[tg.hue]); ctx.fill(); txt(tg.s, -tg.w / 2 + 2, 7, SANS(21, 600), BR.ink, { ls: -.2 });
      ctx.restore();
    });
  }
}
