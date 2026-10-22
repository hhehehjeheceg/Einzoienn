// =====================================================================================================
//  2D effects: masked type, per-letter rises, light sweeps, rings, sparkles, flares, flashes, vignettes.
//  Pure functions of the time: they only read their arguments.
// =====================================================================================================

// masked rise: a word rises into its own line box (pin 0..1) and leaves through the top (pout 0..1)
function rise(s, x, y, font, col, pin, pout, o = {}) {
  if (pin <= 0.0005 || pout >= 0.9995) return;
  const lh = o.lh || 100, ls = o.ls || 0, rot = o.rot === undefined ? .05 : o.rot, align = o.align || 'left';
  const w = tw(s, font, ls), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - lh * .5, y - lh * 1.05, w + lh, lh * 1.42); ctx.clip();
  ctx.translate(x0, y + (1 - pin) * lh * 1.15 - pout * lh * 1.45);
  ctx.rotate((1 - pin) * rot - pout * rot * .5);
  txt(s, 0, 0, font, col, { ls, alpha: o.alpha });
  ctx.restore();
}
// per-letter rise with a spring each (t0 = first letter, st = stagger), optional exit (te = first letter leaves)
function riseLetters(s, x, y, font, col, t, t0, st, o = {}) {
  const ls = o.ls || 0, lh = o.lh || 120, w = tw(s, font, ls), align = o.align || 'center';
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const chars = [...s];
  let pre = '';
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - lh, y - lh * 1.08, w + 2 * lh, lh * 1.45); ctx.clip();
  chars.forEach((ch, i) => {
    const xi = x0 + tw(pre, font, ls); pre += ch;
    const p = spring(t - t0 - i * st, o.k || 190, o.z || .74);
    const q = o.te === undefined ? 0 : inn(seg(t, o.te + i * (o.est || st * .6), o.te + i * (o.est || st * .6) + (o.ed || .28)));
    if (p <= .001 || q >= .999 || ch === ' ') return;
    ctx.save();
    ctx.translate(xi, y + (1 - p) * lh * 1.1 - q * lh * 1.3);
    ctx.rotate((1 - p) * (o.rot === undefined ? .18 : o.rot));
    txt(ch, 0, 0, font, col, { ls, alpha: (o.alpha === undefined ? 1 : o.alpha) * clamp(p * 1.4) });
    ctx.restore();
  });
  ctx.restore();
}
// a diagonal light sweep clipped to the shape of a line of text (drawn over it)
const SH = mk(2000, 560), shx = SH.g;
function sheen(s, x, y, font, ls, p, col = BR.white, a = .85, band = 300) {
  if (p <= 0 || p >= 1) return;
  shx.setTransform(1, 0, 0, 1, 0, 0); shx.globalCompositeOperation = 'source-over'; shx.clearRect(0, 0, 2000, 560);
  shx.font = font; shx.letterSpacing = ls + 'px'; shx.textAlign = 'left'; shx.fillStyle = '#000'; shx.fillText(s, 60, 400);
  shx.globalCompositeOperation = 'source-in';
  const w = tw(s, font, ls), cx = 60 - band + (w + 2 * band) * p;
  const g = shx.createLinearGradient(cx - band / 2, 0, cx + band / 2, 0);
  g.addColorStop(0, rgb(col, 0)); g.addColorStop(.5, rgb(col, a)); g.addColorStop(1, rgb(col, 0));
  shx.setTransform(1, 0, -.4, 1, 0, 0); shx.fillStyle = g; shx.fillRect(-500, 0, 3000, 560);
  ctx.drawImage(SH.c, x - 60, y - 400);
}

// ------------------------------------------------------------------ rings, sparkles, flares, flashes
function ring(x, y, r, w, col, a) {
  if (a <= .003 || r <= 0) return;
  ctx.lineWidth = w; ctx.strokeStyle = rgb(col, a); circ(x, y, r); ctx.stroke();
}
function shock(t, t0, x, y, o = {}) {   // expanding double ring, thin and fast
  const a = t - t0; if (a < 0 || a > (o.life || .7)) return;
  const u = a / (o.life || .7), R = (o.R || 600) * o5(u);
  ring(x, y, R, (o.w || 3) * (1 - u) + .5, o.col || BR.cream, (o.a || .8) * Math.pow(1 - u, 1.6));
  ring(x, y, R * .82, (o.w || 3) * .5 * (1 - u) + .3, o.col2 || BR.clay, (o.a || .8) * .6 * Math.pow(1 - u, 2));
}
function sparkle(x, y, s, rot, a, col = BR.cream) {   // four-point star + a soft core
  if (a <= .004 || s <= .2) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .16 : s, an = i * Math.PI / 4; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); }
  ctx.closePath(); ctx.fillStyle = rgb(col, a); ctx.fill();
  ctx.restore();
  glow(GLOW.cream, x, y, s * 1.3, a * .5);
}
function flare(x, y, size, a, hue = 'amber') {   // anamorphic streak + core + ghosts toward the centre
  if (a <= .004) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.translate(x, y); ctx.scale(size * 7, size * .05); ctx.drawImage(GLOW[hue], -1, -1, 2, 2);
  ctx.restore(); ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.translate(x, y); ctx.scale(size * 3.2, size * .018); ctx.drawImage(GLOW.white, -1, -1, 2, 2);
  ctx.restore();
  glow(GLOW.white, x, y, size * .9, a);
  [[.5, .2, 'sky'], [.95, .12, 'rose'], [1.5, .22, 'mint'], [2.05, .09, 'amber']].forEach(([k, s2, h2]) => {
    glow(GLOW[h2], lerp(x, 960, k), lerp(y, 540, k), size * s2 * 1.4, Math.min(1, a) * .3);
  });
}
function flash(a, col = BR.white) {
  if (a <= .003) return;
  ctx.fillStyle = rgb(col, Math.min(1, a)); ctx.fillRect(0, 0, W, H);
}
function vignette(a = .6, col = [0, 0, 0]) {
  const g = ctx.createRadialGradient(960, 540, 380, 960, 540, 1180);
  g.addColorStop(0, rgb(col, 0)); g.addColorStop(1, rgb(col, a));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// volumetric god rays behind a light source (painted in the background)
function godrays(x, y, R, a, rot, col = BR.clay, n = 18) {
  if (a <= .004) return;
  const r = mulberry32(4242);
  ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const an = rot * (r() < .5 ? 1 : -.6) + i / n * TAU + r() * .2, wdt = .02 + r() * .05, len = R * (.55 + r() * .6);
    const g = ctx.createLinearGradient(0, 0, Math.cos(an) * len, Math.sin(an) * len);
    g.addColorStop(0, rgb(col, a * (.25 + .35 * r()))); g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, an - wdt, an + wdt); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// shooting streak lines converging on / leaving a point (implosion, drop)
function streaks(x, y, t, t0, dur, inward, o = {}) {
  const u = (t - t0) / dur; if (u < 0 || u > 1) return;
  const r = mulberry32(o.seed || 77), n = o.n || 60;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const an = r() * TAU, sp = .6 + r() * .8, d0 = (o.R || 1300) * (inward ? 1 - Math.pow(u, .7 + .5 * r()) * sp : Math.pow(u, .6) * sp);
    const L = (o.L || 240) * (.4 + r()) * Math.sin(Math.PI * u), d1 = inward ? d0 + L : d0 - L;
    if (d0 < 0) continue;
    ctx.strokeStyle = rgb(r() < .5 ? BR.cream : (o.col || BR.clay), (o.a || .7) * Math.sin(Math.PI * u));
    ctx.lineWidth = 1 + r() * 2.5;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * d0, y + Math.sin(an) * d0); ctx.lineTo(x + Math.cos(an) * Math.max(0, d1), y + Math.sin(an) * Math.max(0, d1)); ctx.stroke();
  }
  ctx.restore();
}
