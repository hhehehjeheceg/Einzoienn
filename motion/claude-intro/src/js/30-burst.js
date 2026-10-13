// =====================================================================================================
//  D: the word burst (14.0 - 15.75) and the drop-in (15.75 - 16.5)
//  Ten words, ten colour fields, ten typefaces, ten little pictograms. Hard cuts on the beat, with a
//  circular colour wipe so the eye can follow, a strobe, a slam (spring) and a confetti pop on every cut.
// =====================================================================================================
const BURST = [
  { t: 14.0, w: 'Résumer', bg: BR.ink, fg: BR.cream, ac: HU.amber, font: s => SANS(s, 800), size: 290, ls: -12, deco: 'lines' },
  { t: 14.25, w: 'Traduire', bg: BR.cream, fg: BR.ink, ac: HU.pink, font: s => FRA(s, 600), size: 320, ls: -3, deco: 'glyphs' },
  { t: 14.5, w: 'Expliquer', bg: HU.coral, fg: BR.ink, ac: BR.cream, font: s => BRI(s, 800), size: 270, ls: -9, deco: 'rings' },
  { t: 14.75, w: 'Rédiger', bg: HU.violet, fg: BR.cream, ac: HU.amber, font: s => CAV(s), size: 370, ls: 0, deco: 'pen' },
  { t: 15.0, w: 'Calculer', bg: HU.sky, fg: BR.ink, ac: BR.cream, font: s => MONO(s), size: 230, ls: -7, deco: 'math' },
  { t: 15.125, w: 'Planifier', bg: HU.mint, fg: BR.ink, ac: BR.cream, font: s => SYN(s, 800), size: 250, ls: -7, deco: 'calendar' },
  { t: 15.25, w: 'Corriger', bg: BR.cream, fg: BR.ink, ac: HU.coral, font: s => ANT(s), size: 350, ls: 2, deco: 'strike' },
  { t: 15.375, w: 'Imaginer', bg: hex('#1a1033'), fg: BR.cream, ac: HU.pink, font: s => FRA(s, 500), size: 310, ls: -2, deco: 'stars', grad: 'night' },
  { t: 15.5, w: 'Analyser', bg: HU.amber, fg: BR.ink, ac: BR.cream, font: s => UNB(s, 800), size: 185, ls: -5, deco: 'bars' },
  { t: 15.625, w: 'Créer', bg: HU.pink, fg: BR.cream, ac: BR.ink, font: s => SANS(s, 900), size: 430, ls: -18, deco: 'rays', grad: 'pink' },
];
function initLayoutD() {
  BURST.forEach((b, i) => {
    let size = b.size, fnt = b.font(size), wv = tw(b.w, fnt, b.ls) - b.ls;
    if (wv > 1480) { size = size * 1480 / wv; fnt = b.font(size); wv = tw(b.w, fnt, b.ls) - b.ls; }
    b.sz = size; b.fnt = fnt; b.wv = wv; b.dr = size * .1; b.gap = size * .06;
    const total = wv + b.gap + 2 * b.dr;
    b.x0 = 960 - total / 2; b.base = 540 + size * .36; b.dotx = b.x0 + wv + b.gap + b.dr; b.doty = b.base - b.dr;
    BURST_T.push(b.t);
    ripple(b.t, b.dotx, b.doty, 16, HN[i % 6]);
    const pal = HN.filter(h => HU[h] !== b.bg);
    addBurst({ t0: b.t, x: b.dotx, y: b.doty, n: 32, speed: 1300, life: .62, size: 12, shape: i % 2 ? 'star' : 'conf', hues: pal, grav: 1500, drag: 3, tag: 'D', light: false, seed: 4000 + i });
  });
  L.bl = Array.from({ length: 9 }, (_, i) => 230 + ((i * 53) % 7) * 24);
  const r = mulberry32(31); L.stars = Array.from({ length: 22 }, () => ({ x: 120 + r() * 1680, y: 120 + r() * 840, s: 14 + r() * 38, h: ['pink', 'amber', 'violet', 'sky'][Math.floor(r() * 4)], ph: r() * TAU }));
  L.mathPos = Array.from({ length: 16 }, (_, i) => ({ s: '+−×÷=π√∑%²'[i % 10], x: 120 + ((i * 131) % 1680), y: i % 2 ? 130 + ((i * 47) % 120) : 860 + ((i * 61) % 120), z: 70 + (i % 3) * 30 }));
}
const BARS_H = [.3, .45, .38, .62, .5, .74, .6, .86, .7, .95, .82, 1.0];
const DECO = {
  lines(b, a, t) {   // nine lines of text collapse into three: "résumer"
    const e = spring(a - .02, 110, .85);
    for (const side of [0, 1]) for (let i = 0; i < 9; i++) {
      const len = L.bl[i], x = side ? 1810 - lerp(len, 330, e * (i % 3 === 0)) : 110, y = lerp(380 + i * 40, 540 + (Math.floor(i / 3) - 1) * 66, e);
      const main_ = i % 3 === 0, w = main_ ? lerp(len, 330, e) : len;
      rr(side ? 1810 - w : 110, y, w, 11, 5.5);
      ctx.fillStyle = main_ ? rgb(mixc(b.fg, b.ac, e), .3 + .65 * e) : rgb(b.fg, .3 * (1 - e)); ctx.fill();
    }
  },
  glyphs(b, a, t) {   // two scripts: "traduire"
    const e = spring(a - .02, 90, .75);
    ctx.textAlign = 'center';
    ctx.save(); ctx.translate(330, 800 - 60 * (1 - e)); ctx.rotate(-.12 + .02 * Math.sin(t * 2)); ctx.font = FRA(620, 500); ctx.fillStyle = rgb(b.fg, .07); ctx.fillText('A', 0, 0); ctx.strokeStyle = rgb(b.ac, .55); ctx.lineWidth = 3; ctx.strokeText('A', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(1610, 600 + 60 * (1 - e)); ctx.rotate(.1); ctx.font = SANS(540, 600); ctx.fillStyle = rgb(b.fg, .07); ctx.fillText('あ', 0, 0); ctx.strokeStyle = rgb(b.ac, .55); ctx.lineWidth = 3; ctx.strokeText('あ', 0, 0); ctx.restore();
    ctx.textAlign = 'left';
  },
  rings(b, a, t) {   // a question radiates: "expliquer"
    for (let i = 0; i < 6; i++) { const r = (a * 1700 + i * 210) % 1400; ctx.strokeStyle = rgb(b.ac, (1 - r / 1400) * .55); ctx.lineWidth = 5; circ(b.dotx, b.doty, r); ctx.stroke(); }
    const e = spring(a - .02, 200, .6); ctx.font = SANS(520, 800); ctx.textAlign = 'center'; ctx.fillStyle = rgb(b.ac, .13 * e); ctx.fillText('?', 250, 780); ctx.fillText('!', 1680, 460); ctx.textAlign = 'left';
  },
  pen(b, a, t) {   // a handwritten underline: "rédiger"
    const p = o5(seg(a, .02, .21)), x0 = b.x0, x1 = b.x0 + b.wv, y = b.base + 52;
    ctx.strokeStyle = rgb(b.ac); ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    let ex = x0, ey = y;
    for (let k = 0; k <= 48 * p; k++) { ex = lerp(x0, x1, k / 48); ey = y + 12 * Math.sin(k * .55) - k * .25; ctx[k ? 'lineTo' : 'moveTo'](ex, ey); }
    ctx.stroke();
    if (p > .02 && p < 1) { ctx.save(); ctx.translate(ex + 6, ey - 4); ctx.rotate(-.9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -70); ctx.lineTo(18, -70); ctx.closePath(); ctx.fillStyle = rgb(BR.cream); ctx.fill(); ctx.fillStyle = rgb(b.ac); ctx.fillRect(-18, -92, 36, 22); ctx.restore(); }
  },
  math(b, a, t) {   // operators pop around: "calculer"
    L.mathPos.forEach((m, i) => {
      const e = spring(a - i * .008, 320, .65); if (e <= 0) return;
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(((i % 5) - 2) * .12); ctx.scale(e, e); ctx.font = MONO(m.z * 2); ctx.textAlign = 'center'; ctx.fillStyle = rgb(b.fg, .2); ctx.fillText(m.s, 0, 0); ctx.restore();
    });
  },
  calendar(b, a, t) {   // a month fills in: "planifier"
    const cw = 62, gp = 14, x0 = 960 - (7 * cw + 6 * gp) / 2, y0 = 800;
    for (let n = 0; n < 21; n++) {
      const cx = n % 7, cy = Math.floor(n / 7), e = spring(a - .018 * cx - .012 * cy, 280, .7); if (e <= 0) continue;
      const x = x0 + cx * (cw + gp) + cw / 2, y = y0 + cy * (cw + gp) + cw / 2, hl = n === 10;
      rr(x - cw / 2 * e, y - cw / 2 * e, cw * e, cw * e, 16 * e); ctx.fillStyle = hl ? rgb(b.ac) : rgb(b.fg, .17); ctx.fill();
      if (hl && e > .6) { ctx.strokeStyle = rgb(HU.mint); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 15, y + 1); ctx.lineTo(x - 4, y + 12); ctx.lineTo(x + 17, y - 12); ctx.stroke(); }
    }
  },
  strike(b, a, t) {   // a typo is underlined, then fixed: "corriger"
    const p = o5(seg(a, .02, .17)), x0 = b.x0, x1 = b.x0 + b.wv, y = b.base + 36;
    ctx.strokeStyle = rgb(b.ac); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let k = 0; k <= 70 * p; k++) { const x = lerp(x0, x1, k / 70), yy = y + (k % 2 ? 9 : -9); ctx[k ? 'lineTo' : 'moveTo'](x, yy); }
    ctx.stroke();
    const e = spring(a - .08, 260, .6);
    if (e > 0) { ctx.save(); ctx.translate(1660, 330); ctx.scale(e, e); circ(0, 0, 92); ctx.fillStyle = rgb(HU.mint); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-38, 4); ctx.lineTo(-10, 32); ctx.lineTo(42, -26); ctx.stroke(); ctx.restore(); }
  },
  stars(b, a, t) {   // sparkles: "imaginer"
    glow(SOFT.violet, 960, 540, 900, .35, 'lighter');
    L.stars.forEach((s, i) => {
      const e = spring(a - i * .006, 240, .6); if (e <= 0) return;
      const tw_ = .65 + .35 * Math.sin(t * 9 + s.ph); starPath(s.x, s.y, s.s * e * tw_, t * .4 + s.ph, .22); ctx.fillStyle = rgb(HU[s.h], .95); ctx.fill(); glow(GLOW[s.h], s.x, s.y, s.s * 2.4 * e, .55);
    });
  },
  bars(b, a, t) {   // a chart grows: "analyser"
    const bw = 96, gp = 40, x0 = 960 - (12 * bw + 11 * gp) / 2, yb = 1010, tops = [];
    BARS_H.forEach((h, i) => {
      const e = spring(a - i * .01, 220, .7), hh = h * 250 * e, x = x0 + i * (bw + gp);
      rr(x, yb - hh, bw, hh, 14); ctx.fillStyle = i === 11 ? rgb(b.ac) : rgb(b.fg, .2); ctx.fill(); tops.push([x + bw / 2, yb - hh - 22]);
    });
    ctx.strokeStyle = rgb(b.fg, .55); ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath(); tops.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke();
  },
  rays(b, a, t) {   // a sunburst: "créer"
    ctx.save(); ctx.translate(960, 540); ctx.rotate(t * .7);
    for (let i = 0; i < 24; i++) { ctx.rotate(TAU / 24); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1500, -64); ctx.lineTo(1500, 64); ctx.closePath(); ctx.fillStyle = rgb(b.fg, .13); ctx.fill(); }
    ctx.restore();
  },
};
function burstBG(b) {
  if (b.grad === 'night') { const g = ctx.createRadialGradient(960, 540, 0, 960, 540, 1200); g.addColorStop(0, '#2d1b5e'); g.addColorStop(1, '#0d0a1c'); ctx.fillStyle = g; }
  else if (b.grad === 'pink') { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, rgb(HU.pink)); g.addColorStop(1, rgb(HU.coral)); ctx.fillStyle = g; }
  else ctx.fillStyle = rgb(b.bg);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, W, H);
}
function wordScene(i, a, t) {
  const b = BURST[i];
  burstBG(b);
  drawGrid(t, b.fg, .07, { hotMax: .4 });
  DECO[b.deco](b, a, t);
  const sp = spring(a, 480, .62), sc = 1 + .2 * (1 - sp), rt = (i % 2 ? 1 : -1) * .04 * (1 - spring(a, 400, .7));
  ctx.save(); ctx.translate(960, 540); ctx.rotate(rt); ctx.scale(sc, sc); ctx.translate(-960, -540 + 26 * (1 - sp));
  const so = 10 * sp;
  txt(b.w, b.x0 + so, b.base + so, b.fnt, b.ac, { ls: b.ls, alpha: .9 });
  txt(b.w, b.x0, b.base, b.fnt, b.fg, { ls: b.ls });
  const dp = spring(a - .01, 900, .6);
  circ(b.dotx + so, b.doty + so, b.dr * dp); ctx.fillStyle = rgb(b.fg === b.ac ? BR.ink : b.ac, .9); ctx.fill();
  circ(b.dotx, b.doty, b.dr * dp); ctx.fillStyle = rgb(b.ac === BR.cream || b.ac === BR.ink ? HU.coral : b.ac); ctx.fill();
  ctx.restore();
  // frame furniture: header, counter, progress
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  txt('CE QUE JE PEUX FAIRE', 80, 96, MONO(20), b.fg, { ls: 4, alpha: .6 });
  txt(String(i + 1).padStart(2, '0') + ' / 10', 1840, 96, MONO(20), b.fg, { ls: 2, alpha: .6, align: 'right' });
  ctx.fillStyle = rgb(b.fg, .2); ctx.fillRect(80, 1000, 1760, 2); ctx.fillStyle = rgb(b.ac === BR.ink ? b.fg : b.ac); ctx.fillRect(80, 999, 1760 * seg(t, 14.0, 15.75), 4);
}
function drawBurst(t) {
  let i = 0; while (i < BURST.length - 1 && t >= BURST[i + 1].t) i++;
  const b = BURST[i], a = t - b.t, WIPE = i < 4 ? .11 : .08, prog = a < WIPE ? o5(a / WIPE) : 1;
  if (prog < 1) {
    if (i === 0) sceneABC(t); else wordScene(i - 1, t - BURST[i - 1].t, t);
    ctx.save(); ctx.beginPath(); ctx.arc(b.dotx, b.doty, 1950 * prog + 20, 0, TAU); ctx.clip(); wordScene(i, a, t); ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = rgb(b.ac === BR.ink ? b.fg : b.ac, .8 * (1 - prog)); ctx.lineWidth = 16 * (1 - prog) + 2; circ(b.dotx, b.doty, 1950 * prog + 20); ctx.stroke();
  } else wordScene(i, a, t);
  drawEmitters(t, 'D');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,255,255,${.3 * Math.exp(-a / .035)})`; ctx.fillRect(0, 0, W, H);
}
// ------------------------------------------------------------------ drop-in: the colour field implodes into a white-hot orb, then the world explodes open
const RF = Math.hypot(960, 540) * 1.06;
function drawDropIn(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0a10'; ctx.fillRect(0, 0, W, H);
  const iris = inn(seg(t, 15.75, 15.94)), u = seg(t, 15.8, 16.0);
  if (t < 16.0) {
    // streaks converge on the centre
    for (let k = 0; k < 44; k++) {
      const ang = k * TAU / 44 + .13 * Math.sin(k * 5.1), r1 = lerp(1300, 80, ioq(clamp(u * 1.15 - (k % 5) * .04))), r0 = r1 + 90 + 260 * u;
      ctx.strokeStyle = rgb(hueAt(k), .15 + .6 * u); ctx.lineWidth = 2 + 3 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(960 + Math.cos(ang) * r0, 540 + Math.sin(ang) * r0); ctx.lineTo(960 + Math.cos(ang) * r1, 540 + Math.sin(ang) * r1); ctx.stroke();
    }
    if (iris < 1) { ctx.save(); ctx.beginPath(); ctx.arc(960, 540, RF * (1 - iris), 0, TAU); ctx.clip(); wordScene(BURST.length - 1, t - BURST[BURST.length - 1].t, t); ctx.restore(); }
    glow(GLOW.white, 960, 540, 20 + 150 * u * u, .5 + .5 * u); glow(GLOW.clay, 960, 540, 60 + 380 * u * u, .7 * u);
  } else {
    const rc = lerp(18, RF, o5(seg(t, 16.0, 16.32)));
    circ(960, 540, rc); ctx.fillStyle = rgb(BR.clay); ctx.fill();
    const ri = RF * o5(seg(t, 16.1, 16.46));
    if (ri > 0) { ctx.save(); circ(960, 540, ri); ctx.clip(); world3D(t); ctx.restore(); }
    // wavefront: a thick rainbow ring just ahead of the reveal
    const wr = RF * o5(seg(t, 16.0, 16.34)); ctx.lineWidth = 26 * (1 - seg(t, 16.0, 16.4)) + 2;
    const cg = ctx.createConicGradient(t * 3, 960, 540); RAINBOW.forEach(([p, c]) => cg.addColorStop(p, rgb(c))); cg.addColorStop(1, rgb(HU.coral));
    ctx.strokeStyle = cg; ctx.globalAlpha = .9 * (1 - seg(t, 16.15, 16.42)); circ(960, 540, wr); ctx.stroke(); ctx.globalAlpha = 1;
    flare(960, 540, 330 * (1 - seg(t, 16.0, 16.5)), .9 * (1 - seg(t, 16.0, 16.5)), 'amber');
    ctx.fillStyle = `rgba(255,255,255,${.95 * Math.exp(-(t - 16.0) / .045)})`; ctx.fillRect(0, 0, W, H);
  }
}
