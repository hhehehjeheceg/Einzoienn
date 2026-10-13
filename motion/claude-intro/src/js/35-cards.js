// =====================================================================================================
//  E (part 1): the six capability cards. Each card is drawn into its own texture (780 x 480 layout units,
//  at 1.5x), then projected in perspective by the 3D engine. Every card has its own hue.
// =====================================================================================================
const CW = 780, CH = 480, TS = 1.5;
const CARDS = [
  { x: -560, y: -20, z: 1500, yaw: .30, tag: 'ILLUSTRATION' },
  { x: 560, y: 30, z: 3100, yaw: -.30, tag: 'ILLUSTRATION' },
  { x: -540, y: -10, z: 4700, yaw: .28, tag: 'DONNÉES D’EXEMPLE' },
  { x: 560, y: -40, z: 6300, yaw: -.28, tag: 'ILLUSTRATION' },
  { x: -540, y: 20, z: 7900, yaw: .28, tag: 'EXEMPLE' },
  { x: 560, y: -20, z: 9500, yaw: -.30, tag: 'ILLUSTRATION' },
].map((c, k) => Object.assign(c, CAPS[k], { tex: mk(Math.round(CW * TS), Math.round(CH * TS)), key: -2 }));
const LANGS = ['Hello', 'Hola', 'Ciao', 'Привет', 'Olá', 'Γεια σου', 'Hallo', 'こんにちは', 'Bonjour'];
const LCODE = ['EN', 'ES', 'IT', 'RU', 'PT', 'EL', 'DE', 'JA', 'FR'];
const LANG_T = [ARR[5] - .18]; [0.075, 0.075, 0.08, 0.09, 0.1, 0.11, 0.13, 0.16].forEach(d => LANG_T.push(LANG_T[LANG_T.length - 1] + d));
const BARS = [42, 55, 49, 68, 74, 91];

function initLayoutCards() {
  const af = SANS(24, 450), ans = 'Imagine un endroit où la gravité est si forte que même la lumière ne peut pas s’en échapper. C’est ça, un trou noir.'.split(' ');
  L.chat = { q: 'Explique-moi les trous noirs simplement.', qf: SANS(24, 500), af, words: [] };
  L.chat.qw = tw(L.chat.q, L.chat.qf);
  let x = 0, line = 0; const sp = tw(' ', af);
  for (const w of ans) { const ww = tw(w, af); if (x + ww > 590 && x > 0) { x = 0; line++; } L.chat.words.push({ s: w, x, line }); x += ww + sp; }
  const cf = SANS(27, 500), cap = 'Un coucher de soleil sur un lac de montagne.'.split(' ');
  L.vis = { f: cf, words: [] }; x = 0; line = 0; const sp2 = tw(' ', cf);
  for (const w of cap) { const ww = tw(w, cf); if (x + ww > 300 && x > 0) { x = 0; line++; } L.vis.words.push({ s: w, x, line }); x += ww + sp2; }
  L.math = { f: SANS(40, 500), fb: SANS(40, 700) }; L.math.w3 = tw('x = 2  ou  x = 3', L.math.fb, -1);
  L.lang = { f: SANS(104, 600) }; L.lang.wB = tw('Bonjour', L.lang.f, -3) + 3;
}

// ------------------------------------------------------------------ card chrome
function cardChrome(c, t) {
  const h = HU[c.hue];
  rr(-CW / 2, -CH / 2, CW, CH, 30);
  const g = ctx.createLinearGradient(0, -CH / 2, 0, CH / 2); g.addColorStop(0, rgb(mixc([60, 56, 72], h, .16))); g.addColorStop(1, '#1b1922'); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(-CW / 2, -CH / 2, CW, CH, 30); ctx.clip();
  let rg = ctx.createRadialGradient(-300, -230, 0, -300, -230, 620); rg.addColorStop(0, rgb(h, .4)); rg.addColorStop(1, rgb(h, 0)); ctx.fillStyle = rg; ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
  const h2 = HU[HN[(HN.indexOf(c.hue) + 2) % 6]]; rg = ctx.createRadialGradient(380, 250, 0, 380, 250, 420); rg.addColorStop(0, rgb(h2, .1)); rg.addColorStop(1, rgb(h2, 0)); ctx.fillStyle = rg; ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
  const sh = (t * 90) % 1300 - 400; ctx.save(); ctx.transform(1, 0, -.5, 1, 0, 0); const sg = ctx.createLinearGradient(sh - 90, 0, sh + 90, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,0.045)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(-1000, -CH / 2, 2400, CH); ctx.restore();
  ctx.restore();
  rr(-CW / 2, -CH / 2, CW, CH, 30);
  const bg = ctx.createLinearGradient(-CW / 2, -CH / 2, CW / 2, CH / 2); bg.addColorStop(0, rgb(h, .95)); bg.addColorStop(.3, rgb(h, .3)); bg.addColorStop(1, 'rgba(255,255,255,0.07)');
  ctx.lineWidth = 2.2; ctx.strokeStyle = bg; ctx.stroke();
  glow(GLOW[c.hue], -CW / 2 + 44, -CH / 2 + 52, 26, .8); circ(-CW / 2 + 44, -CH / 2 + 52, 6.5); ctx.fillStyle = rgb(h); ctx.fill();
  txt(c.name, -CW / 2 + 64, -CH / 2 + 62, SANS(30, 600), BR.cream, { ls: -.5 });
  txt(c.tag, CW / 2 - 38, -CH / 2 + 58, MONO(14), BR.dim, { align: 'right', ls: 2.5 });
  ctx.fillStyle = 'rgba(240,238,230,0.07)'; ctx.fillRect(-CW / 2, -CH / 2 + 92, CW, 1.5);
}
const lightText = (s, x, y, f, hue, a = 1) => txt(s, x, y, f, hue ? HU[hue] : BR.cream, { alpha: a });

// ------------------------------------------------------------------ card bodies
function cardBody(k, t) {
  const A = ARR[k], h = HU[CARDS[k].hue];
  if (k === 0) {   // Discuter: a chat
    const bp = spring(t - (A - .55), 220, .78);
    if (bp > 0) {
      const bw = L.chat.qw + 46, bh = 54, bx = CW / 2 - 40;
      ctx.save(); ctx.translate(bx, -88); const s = .9 + .1 * bp; ctx.scale(s, s); ctx.globalAlpha = clamp(bp * 1.4);
      rr(-bw, -bh / 2, bw, bh, 22); ctx.fillStyle = '#403c4b'; ctx.fill(); txt(L.chat.q, -bw + 23, 8, L.chat.qf, BR.cream);
      txt('09:41  ✓✓', 0, 42, MONO(12), BR.dim, { align: 'right' }); ctx.restore();
    }
    const ap = spring(t - (A - .2), 260, .8);
    if (ap > 0) { drawOrb(-CW / 2 + 52, -22, 15 * ap, t, { dark: true, glow: .5 }); }
    const dots = seg(t, A - .2, A - .02) * (1 - seg(t, A - .02, A + .04));
    if (dots > 0) for (let i = 0; i < 3; i++) { circ(-CW / 2 + 96 + i * 16, -22 - 5 * Math.max(0, Math.sin(t * 14 - i * 1.1)), 4.5); ctx.fillStyle = rgb(h, dots); ctx.fill(); }
    let last = null;
    L.chat.words.forEach((w, i) => {
      const t0 = A - .02 + .03 * i, a = clamp((t - t0) / .1); if (a <= 0) return;
      txt(w.s, -CW / 2 + 84 + w.x, -12 + 38 * w.line + 6 * (1 - out(a)), L.chat.af, BR.cream, { alpha: .93 * a }); last = { x: -CW / 2 + 84 + w.x + tw(w.s, L.chat.af), y: -12 + 38 * w.line };
    });
    if (last && t < A + 1.05 && ((t * 3.2) % 1) < .62) { ctx.fillStyle = rgb(h); ctx.fillRect(last.x + 5, last.y - 20, 3, 26); }
    const done = seg(t, A + 1.0, A + 1.2);
    if (done > 0) { const lw = tw('un trou noir.', L.chat.af); rr(-CW / 2 + 84, -12 + 38 * 2 + 8, lw * done, 3, 1.5); ctx.fillStyle = rgb(h); ctx.fill(); }
    ['Copier', 'Régénérer', 'Utile'].forEach((s, i) => {   // reaction chips
      const e = spring(t - (A + 1.0 + .1 * i), 260, .7); if (e <= 0) return;
      const w = tw(s, SANS(15, 600)) + 30, x0 = -CW / 2 + 84 + [0, 96, 214][i];
      ctx.save(); ctx.translate(x0 + w / 2, 104); ctx.scale(e, e); rr(-w / 2, -15, w, 30, 15); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.3; ctx.stroke(); txt(s, -w / 2 + 15, 5, SANS(15, 600), BR.cream, { alpha: .85 }); ctx.restore();
    });
    // input bar
    rr(-CW / 2 + 34, 164, CW - 68, 58, 29); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.4; ctx.stroke();
    txt('Écrire un message…', -CW / 2 + 70, 200, SANS(20, 450), BR.dim);
    const sp_ = 1 + .16 * pulse(t, A + 1.2, 1, .2) * 3; ctx.save(); ctx.translate(CW / 2 - 66, 193); ctx.scale(sp_, sp_); circ(0, 0, 22); ctx.fillStyle = rgb(h); ctx.fill();
    ctx.strokeStyle = BR.ink; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -8); ctx.moveTo(-8, 0); ctx.lineTo(0, -8); ctx.lineTo(8, 0); ctx.stroke(); ctx.restore();
  } else if (k === 1) {   // Coder: code + tests
    const x0 = -CW / 2 + 40;
    rr(x0 - 4, -126, 124, 34, 10); ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill(); txt('tests.js', x0 + 12, -103, MONO(16), BR.cream); ctx.fillStyle = rgb(h); ctx.fillRect(x0 - 4, -94, 124, 3);
    txt('app.js', x0 + 150, -103, MONO(16), BR.dim);
    const code = [[['test', HU.sky], ['(', BR.dim], ['"connexion"', HU.amber], [', () => {', BR.dim]], [[' ', BR.dim], ['  expect', HU.sky], ['(', BR.dim], ['login', HU.mint], ['("léa")', HU.amber], [').toBe(', BR.dim], ['true', HU.coral], [');', BR.dim]], [[' ', BR.dim], ['});', BR.dim]]];
    code.forEach((ln, i) => { let xx = x0; ln.forEach(([s, c]) => { txt(s, xx, -54 + i * 30, MONO(20), c); xx += tw(s, MONO(20)); }); });
    const rp = spring(t - (A - .5), 300, .7);   // run button
    ctx.save(); ctx.translate(CW / 2 - 90, -74); ctx.scale(1 - .06 * Math.max(0, pulse(t, A - .42, 1, .12)) * 3 + (rp - 1) * 0, 1 - .06 * Math.max(0, pulse(t, A - .42, 1, .12)) * 3); rr(-50, -18, 100, 36, 18); ctx.fillStyle = rgb(h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, -8); ctx.lineTo(-26, 8); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fillStyle = BR.ink; ctx.fill(); txt('Run', -4, 6, SANS(16, 700), BR.ink); ctx.restore();
    rr(-CW / 2 + 28, 10, CW - 56, 222, 16); ctx.fillStyle = 'rgba(8,8,12,0.55)'; ctx.fill();
    txt('TERMINAL', x0, 36, MONO(12), BR.dim, { ls: 2.5 });
    const n = clamp(Math.floor((t - (A - .42)) / .04) + 1, 0, 8), typed = 'npm test'.slice(0, n);
    txt('$', x0, 66, MONO(21), h); txt(typed, x0 + 26, 66, MONO(21), BR.cream);
    if (t < A + .06 && (n < 8 || ((t - A) % .4) < .25)) { ctx.fillStyle = rgb(BR.cream, .85); ctx.fillRect(x0 + 28 + tw(typed, MONO(21)), 48, 12, 24); }
    const R = [['connexion de l’utilisateur', '12 ms'], ['calcul du panier', '8 ms'], ['envoi de l’e-mail de confirmation', '21 ms']];
    R.forEach(([s, ms], i) => {
      const a = o5(seg(t, A + .02 + .15 * i, A + .27 + .15 * i)); if (a <= 0) return; const y = 100 + 34 * i, dx = 14 * (1 - a);
      ctx.globalAlpha = a; ctx.strokeStyle = rgb(h); ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x0 + 2 + dx, y - 6); ctx.lineTo(x0 + 9 + dx, y + 1); ctx.lineTo(x0 + 21 + dx, y - 13); ctx.stroke();
      txt(s, x0 + 36 + dx, y, MONO(18), BR.cream, { alpha: .9 }); txt(ms, CW / 2 - 50, y, MONO(16), BR.dim, { align: 'right' }); ctx.globalAlpha = 1;
    });
    const pr = io(seg(t, A + .02, A + .62)); rr(x0, 206, CW - 120, 7, 3.5); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); rr(x0, 206, (CW - 120) * pr, 7, 3.5); ctx.fillStyle = rgb(h); ctx.fill();
    const sm = o5(seg(t, A + .55, A + .8));
    if (sm > 0) { ctx.save(); ctx.globalAlpha = sm; ctx.translate(CW / 2 - 156, 211 - 4 * (1 - sm)); const w1 = tw('3 tests réussis', SANS(16, 700)) + 28; rr(-w1 / 2, -15, w1, 30, 15); ctx.fillStyle = rgb(h, .2); ctx.fill(); txt('3 tests réussis', -w1 / 2 + 14, 6, SANS(16, 700), h); ctx.restore(); }
  } else if (k === 2) {   // Analyser: a KPI + chart
    const e = io(seg(t, A - .45, A + .45)), val = Math.round(91 * e);
    txt(String(val), -CW / 2 + 40, -52, UNB(84, 700), BR.cream, { ls: -2 }); const vw = tw(String(val), UNB(84, 700), -2); txt('%', -CW / 2 + 44 + vw, -52, UNB(38, 600), h);
    txt('CROISSANCE', -CW / 2 + 42, -20, MONO(14), BR.dim, { ls: 3 });
    const dc = spring(t - (A + .35), 260, .7); if (dc > 0) { ctx.save(); ctx.translate(CW / 2 - 110, -66); ctx.scale(dc, dc); rr(-52, -17, 104, 34, 17); ctx.fillStyle = rgb(h, .22); ctx.fill(); ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(-24, -7); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fillStyle = rgb(h); ctx.fill(); txt('+24', -4, 6, SANS(17, 700), h); ctx.restore(); }
    const left = -CW / 2 + 74, right = CW / 2 - 40, b0 = 206, step = (right - left) / 6, gh = 170;
    [0, 50, 100].forEach((v, i) => { const y = b0 - v / 100 * gh; ctx.fillStyle = 'rgba(240,238,230,0.1)'; ctx.fillRect(left - 6, y, right - left + 6, 1.5); txt(String(v), left - 16, y + 5, MONO(13), BR.dim, { align: 'right' }); });
    const tops = [];
    BARS.forEach((v, i) => {
      const hh = v / 100 * gh, gp = spring(t - (A - .4 + .05 * i), 200, .8), x = left + step * i + step / 2 - 30;
      tops.push({ x: x + 30, y: b0 - hh - 10 });
      if (gp > 0) { const gr = ctx.createLinearGradient(0, b0 - hh, 0, b0); gr.addColorStop(0, rgb(i === 5 ? HU.coral : h, i === 5 ? 1 : .55)); gr.addColorStop(1, rgb(h, i === 5 ? .65 : .1)); rr(x, b0 - hh * gp, 60, hh * gp, 9); ctx.fillStyle = gr; ctx.fill(); }
      txt(['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN'][i], x + 30, b0 + 24, MONO(13), BR.dim, { align: 'center', ls: 1 });
    });
    const lp = io(seg(t, A, A + .5));
    if (lp > 0) {
      const segs = tops.length - 1, f = lp * segs, n = Math.floor(f);
      ctx.strokeStyle = rgb(BR.cream, .9); ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tops[0].x, tops[0].y);
      for (let i = 1; i <= Math.min(n, segs); i++) ctx.lineTo(tops[i].x, tops[i].y);
      if (n < segs) ctx.lineTo(lerp(tops[n].x, tops[n + 1].x, f - n), lerp(tops[n].y, tops[n + 1].y, f - n));
      ctx.stroke(); tops.forEach((p, i) => { if (i <= f && i < 5) { circ(p.x, p.y, 4.5); ctx.fillStyle = rgb(BR.cream); ctx.fill(); } });
    }
    const ep = spring(t - (A + .48), 260, .75);
    if (ep > 0) {
      const p = tops[5], rp = seg(t, A + .48, A + 1.1); circ(p.x, p.y, 9 * ep); ctx.fillStyle = rgb(HU.coral); ctx.fill(); glow(GLOW.coral, p.x, p.y, 40 * ep, .7);
      if (rp < 1) { circ(p.x, p.y, 9 + 34 * o5(rp)); ctx.strokeStyle = rgb(HU.coral, .5 * (1 - rp)); ctx.lineWidth = 2.5; ctx.stroke(); }
      const tp_ = spring(t - (A + .62), 240, .7); if (tp_ > 0) { ctx.save(); ctx.translate(p.x - 48, p.y - 44); ctx.scale(tp_, tp_); rr(-62, -19, 124, 38, 12); ctx.fillStyle = BR.cream; ctx.fill(); txt('juin · 91', -48, 6, SANS(17, 700), BR.ink); ctx.restore(); }
    }
  } else if (k === 3) {   // Voir: image + detection
    const ix = -CW / 2 + 40, iy = -126, iw = 340, ih = 330, hz = iy + 190;
    ctx.save(); rr(ix, iy, iw, ih, 16); ctx.clip();
    let g = ctx.createLinearGradient(0, iy, 0, hz); g.addColorStop(0, '#2a2321'); g.addColorStop(.6, '#8a4c3a'); g.addColorStop(1, '#e8956f'); ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, 190);
    circ(ix + 210, iy + 166, 44); ctx.fillStyle = '#f6d2ae'; ctx.fill();
    ctx.fillStyle = '#4a302a'; ctx.beginPath(); ctx.moveTo(ix, hz); [[0, 150], [70, 122], [130, 156], [196, 100], [262, 146], [340, 116], [340, 190]].forEach(([a, b]) => ctx.lineTo(ix + a, iy + b)); ctx.fill();
    ctx.fillStyle = '#1e1917'; ctx.beginPath(); ctx.moveTo(ix, hz); [[0, 160], [44, 140], [96, 106], [150, 168], [176, 190]].forEach(([a, b]) => ctx.lineTo(ix + a, iy + b)); ctx.fill();
    g = ctx.createLinearGradient(0, hz, 0, iy + ih); g.addColorStop(0, '#6b3f33'); g.addColorStop(1, '#1d1816'); ctx.fillStyle = g; ctx.fillRect(ix, hz, iw, ih - 190);
    for (let j = 0; j < 6; j++) { const w = 74 - j * 11; rr(ix + 210 - w / 2, hz + 10 + j * 17, w, 4, 2); ctx.fillStyle = `rgba(246,210,174,${.6 - j * .08})`; ctx.fill(); }
    const sp = seg(t, A - .38, A + .25);
    if (sp > 0 && sp < 1) { const y = iy + ih * io(sp), sg = ctx.createLinearGradient(0, y - 70, 0, y); sg.addColorStop(0, rgb(h, 0)); sg.addColorStop(1, rgb(h, .4)); ctx.fillStyle = sg; ctx.fillRect(ix, y - 70, iw, 70); ctx.fillStyle = rgb(h); ctx.fillRect(ix, y - 1.5, iw, 3); }
    ctx.restore();
    [[ix, iy], [ix + iw, iy], [ix, iy + ih], [ix + iw, iy + ih]].forEach(([cx, cy], i) => { ctx.strokeStyle = rgb(h); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); const sx = i % 2 ? -1 : 1, sy = i > 1 ? -1 : 1; ctx.moveTo(cx + sx * 4, cy + sy * 28); ctx.lineTo(cx + sx * 4, cy + sy * 4); ctx.lineTo(cx + sx * 28, cy + sy * 4); ctx.stroke(); });
    [['soleil 98 %', ix + 160, iy + 116, 100, 100], ['montagne 96 %', ix + 12, iy + 96, 156, 96], ['lac 94 %', ix + 14, hz + 8, 312, 124]].forEach(([lab, x, y, w, hh], i) => {
      const s = spring(t - (A + .2 + .1 * i), 260, .72); if (s <= 0) return;
      ctx.save(); ctx.translate(x + w / 2, y + hh / 2); ctx.scale(.85 + .15 * s, .85 + .15 * s); ctx.globalAlpha = clamp(s * 1.5);
      rr(-w / 2, -hh / 2, w, hh, 6); ctx.strokeStyle = rgb(HU.amber); ctx.lineWidth = 2.5; ctx.stroke();
      const lw = tw(lab, MONO(13), .5) + 14; rr(-w / 2, -hh / 2 - 24, lw, 21, 5); ctx.fillStyle = rgb(HU.amber); ctx.fill(); txt(lab, -w / 2 + 7, -hh / 2 - 9, MONO(13), BR.ink, { ls: .5 }); ctx.restore();
    });
    txt('DESCRIPTION', 36, -96, MONO(13), BR.dim, { ls: 2.5 });
    L.vis.words.forEach((w, i) => { const t0 = A + .45 + .035 * i, a = clamp((t - t0) / .1); if (a <= 0) return; txt(w.s, 36 + w.x, -52 + 36 * w.line + 6 * (1 - out(a)), L.vis.f, BR.cream, { alpha: a }); });
    txt('PALETTE', 36, 96, MONO(13), BR.dim, { ls: 2.5 });
    ['#2a2321', '#8a4c3a', '#e8956f', '#f6d2ae', '#1d1816'].forEach((c, i) => { const s = spring(t - (A + .7 + .07 * i), 300, .65); if (s <= 0) return; rr(36 + i * 62, 112, 52 * s, 52 * s, 14 * s); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); });
    const tg = o5(seg(t, A + 1.0, A + 1.25)); if (tg > 0) { ctx.globalAlpha = tg; ['paysage', 'soir'].forEach((s, i) => { const w = tw(s, SANS(15, 600)) + 28, x = 36 + (i ? 100 : 0); rr(x, 184, w, 28, 14); ctx.strokeStyle = rgb(h, .7); ctx.lineWidth = 1.4; ctx.stroke(); txt(s, x + 14, 204, SANS(15, 600), h); }); ctx.globalAlpha = 1; }
  } else if (k === 4) {   // Calculer: steps + a parabola
    const x0 = -CW / 2 + 44;
    rise('x² − 5x + 6 = 0', x0, -78, L.math.f, BR.cream, spring(t - (A - .38), 200, .8), 0, { lh: 52, ls: -1, rot: .02 });
    const c1 = o5(seg(t, A + .02, A + .28)), c2 = o5(seg(t, A + .42, A + .66));
    if (c1 > 0) { ctx.fillStyle = BR.dim; ctx.fillRect(x0 + 6, -64, 2, 24 * c1); txt('factoriser', x0 + 22, -44, MONO(14), BR.dim, { alpha: c1, ls: 1 }); }
    rise('(x − 2)(x − 3) = 0', x0, 6, L.math.f, BR.cream, spring(t - (A + .15), 200, .8), 0, { lh: 52, ls: -1, rot: .02 });
    if (c2 > 0) { ctx.fillStyle = BR.dim; ctx.fillRect(x0 + 6, 18, 2, 24 * c2); txt('donc', x0 + 22, 38, MONO(14), BR.dim, { alpha: c2, ls: 1 }); }
    const hp = o5(seg(t, A + .7, A + .95)); if (hp > 0) { rr(x0 - 14, 78, (L.math.w3 + 28) * hp, 58, 14); ctx.fillStyle = rgb(h, .2); ctx.fill(); }
    rise('x = 2  ou  x = 3', x0, 122, L.math.fb, h, spring(t - (A + .55), 200, .8), 0, { lh: 52, ls: -1, rot: .02 });
    // plot
    const px0 = 40, px1 = 360, py0 = 200, py1 = -120, X = v => px0 + (px1 - px0) * v / 5, Y = v => py0 + (py1 - py0) * (v + 1) / 8;
    ctx.strokeStyle = 'rgba(240,238,230,0.1)'; ctx.lineWidth = 1.3; for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(X(i), py0); ctx.lineTo(X(i), py1); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(240,238,230,0.38)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px0, Y(0)); ctx.lineTo(px1, Y(0)); ctx.stroke();
    const cp = io(seg(t, A - .3, A + .5)); ctx.strokeStyle = rgb(h); ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    let first = true, lx = 0, ly = 0; for (let i = 0; i <= 60 * cp; i++) { const v = .15 + 4.7 * i / 60, y = v * v - 5 * v + 6; lx = X(v); ly = Y(y); ctx[first ? 'moveTo' : 'lineTo'](lx, ly); first = false; } ctx.stroke(); if (cp > 0 && cp < 1) glow(GLOW.sky, lx, ly, 26, .9);
    [[2, 0], [3, 0]].forEach(([vx, vy], i) => { const s = spring(t - (A + .55 + .15 * i), 300, .65); if (s <= 0) return; ctx.setLineDash([4, 5]); ctx.strokeStyle = rgb(HU.amber, .5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(vx), Y(vy)); ctx.lineTo(X(vx), py0); ctx.stroke(); ctx.setLineDash([]); circ(X(vx), Y(vy), 9 * s); ctx.fillStyle = rgb(HU.amber); ctx.fill(); glow(GLOW.amber, X(vx), Y(vy), 34 * s, .6); txt(String(vx), X(vx), py0 + 22, MONO(15), HU.amber, { align: 'center' }); });
    const vs = spring(t - (A + .85), 300, .65); if (vs > 0) { circ(X(2.5), Y(-.25), 7 * vs); ctx.fillStyle = rgb(HU.pink); ctx.fill(); txt('min', X(2.5), Y(-.25) + 26, MONO(13), HU.pink, { align: 'center' }); }
  } else if (k === 5) {   // Traduire: languages
    const cur = Math.max(0, LANG_T.filter(v => t >= v).length - 1);
    LCODE.forEach((cd, i) => { const on = i === cur && t >= LANG_T[0], x = -CW / 2 + 40 + i * 77.5, e = spring(t - (A - .5 + .02 * i), 260, .75); if (e <= 0) return; ctx.save(); ctx.translate(x + 32, -112); ctx.scale(e, e); rr(-32, -15, 64, 30, 15); if (on) { ctx.fillStyle = rgb(h); ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.3; ctx.stroke(); } txt(cd, 0, 5, MONO(14), on ? BR.ink : BR.dim, { align: 'center', ls: 1 }); ctx.restore(); });
    ctx.save(); ctx.beginPath(); ctx.rect(-CW / 2 + 20, -86, CW - 40, 170); ctx.clip();
    LANGS.forEach((w, i) => {
      const sk = LANG_T[i]; if (t < sk) return;
      const inY = (1 - (i ? spring(t - sk, 700, .9) : spring(t - sk, 300, .85))) * 135, outY = i < 8 ? spring(t - LANG_T[i + 1], 700, .9) * 135 : 0; if (outY > 134) return;
      const fin = i === 8; if (fin) gtxt(w, -L.lang.wB / 2 + 3, 40 + inY - outY, L.lang.f, [[0, HU.pink], [1, HU.amber]], { ls: -3 }); else txt(w, 0, 40 + inY - outY, L.lang.f, BR.cream, { align: 'center', ls: -3 });
    });
    ctx.restore();
    const u = o5(seg(t, LANG_T[8] + .02, LANG_T[8] + .36)); if (u > 0) { rr(-L.lang.wB / 2, 70, L.lang.wB * u, 7, 3.5); ctx.fillStyle = rgb(h); ctx.fill(); }
    const wv = clamp((t - (A - .2)) / .3); for (let i = 0; i < 30; i++) { const amp = (.25 + .75 * Math.abs(Math.sin(i * 1.7 + t * 11))) * (.35 + .65 * Math.abs(Math.sin(i * .37 + t * 3.1))) * wv, x = -CW / 2 + 70 + i * 22; rr(x, 190 - 34 * amp, 10, 68 * amp, 5); ctx.fillStyle = rgb(h, .35 + .5 * amp); ctx.fill(); }
  }
}
// draw / refresh the texture of card k (once per output frame)
function cardTexUpdate(k, near) {
  const c = CARDS[k], key = near ? CUR_F : -1;
  if (c.key === key) return c.tex.c; c.key = key;
  const g = c.tex.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.tex.c.width, c.tex.c.height);
  withCtx(g, () => {
    g.setTransform(TS, 0, 0, TS, c.tex.c.width / 2, c.tex.c.height / 2);
    const t = CUR_F / FPS; cardChrome(c, t);
    g.save(); rr(-CW / 2, -CH / 2, CW, CH, 30); g.clip(); if (near) cardBody(k, t); g.restore();
  });
  return c.tex.c;
}
