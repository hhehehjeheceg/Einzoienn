// =====================================================================================================
//  F  28 - 33.3  "Je vérifie mon travail. Et je dis quand je ne sais pas."   (sunset gradient)
//  G  33.3 - 36  the six capabilities orbit the orb, then collapse into it
//  H  36 - 48    the finale: white-out, particle wordmark, glossy logo orb, the prompt box
// =====================================================================================================
const S6 = {}, S7 = {};
const FIN = { gw: 0, particles: null };

function initLayoutFGH() {
  // F
  const s6 = S6; s6.f1 = SANS(112, 600); s6.ls1 = -4.5; s6.y1 = 600; s6.f3 = SER(178); s6.y2 = 500; s6.y3 = 676;
  const placeWords = (str, font, ls, cx, extra) => {
    const wv = tw(str, font, ls) - ls, x0 = cx - (wv + extra) / 2, words = [];
    let pos = 0; for (const w of str.split(' ')) { words.push({ s: w, x: x0 + tw(str.slice(0, pos), font, ls), w: tw(w, font, ls) - ls }); pos += w.length + 1; }
    return { words, x0, wv };
  };
  const a1 = placeWords('Je vérifie mon travail', s6.f1, s6.ls1, 960, 12 + 30);
  s6.w1 = a1.words; s6.x1 = a1.x0; s6.wv1 = a1.wv; L.P6a = { x: a1.x0 + a1.wv + 12 + 15, y: s6.y1 - 15 };
  s6.w2 = placeWords('Et je dis quand', s6.f1, s6.ls1, 960, 0).words;
  const a3 = placeWords('je ne sais pas', s6.f3, -1, 960, 10 + 30);
  s6.w3 = a3.words; s6.x3 = a3.x0; s6.wv3 = a3.wv; L.P6b = { x: a3.x0 + a3.wv + 10 + 15, y: s6.y3 - 15 };
  const r = mulberry32(606); s6.float = Array.from({ length: 16 }, (_, i) => ({ x: 80 + r() * 1760, y: 120 + r() * 840, s: 60 + r() * 120, v: 10 + r() * 22, ph: r() * TAU, k: i % 2 ? 'q' : 'c', rot: (r() - .5) * .6 }));
  // G
  L.orb = CAPS.map(c => ({ s: c.name, hue: c.hue }));
  // H: wordmark layout + particle targets sampled from the real glyphs
  const f = SER(250), s7 = S7; s7.f = f; s7.y = 470; s7.wC = tw('Claude', f, -2) + 2;
  const total = 92 + 34 + s7.wC, gx = 960 - total / 2; s7.gx = gx; s7.xC = gx + 126; L.P7 = { x: gx + 46, y: s7.y - 80 };
  s7.tag = 'On construit quoi ?'; s7.ft = SANS(36, 500); s7.wTag = tw(s7.tag, s7.ft, -.5);
  const cw = Math.ceil(s7.wC) + 80, ch = 340, sm = mk(cw, ch, true); sm.g.font = f; sm.g.letterSpacing = '-2px'; sm.g.fillStyle = '#000'; sm.g.textAlign = 'left'; sm.g.fillText('Claude', 40, 260);
  const img = sm.g.getImageData(0, 0, cw, ch).data, pts = [];
  for (let y = 0; y < ch; y += 3) for (let x = 0; x < cw; x += 3) if (img[(y * cw + x) * 4 + 3] > 140) pts.push([x - 40 + s7.xC, y - 260 + s7.y]);
  const rr_ = mulberry32(777); while (pts.length > 6200) pts.splice(Math.floor(rr_() * pts.length), 1);
  FIN.minX = s7.xC; FIN.wX = s7.wC;
  FIN.P = pts.map(([tx, ty], i) => {
    const a = rr_() * TAU, sp = 600 + rr_() * 1500, rad = 10 + rr_() * 60;
    return { tx, ty, sx: 960 + Math.cos(a) * rad, sy: 540 + Math.sin(a) * rad, vx: Math.cos(a + .5) * sp, vy: Math.sin(a + .5) * sp, w: 5 + rr_() * 4.5, dl: rr_() * .35, u: clamp((tx - FIN.minX) / FIN.wX), s: 2 + rr_() * 1.3 };
  });
  FIN.buckets = Array.from({ length: 24 }, () => []); FIN.P.forEach(p => FIN.buckets[Math.min(23, Math.floor(p.u * 24))].push(p));
  // prompt box + chips layout
  S7.px = 960; S7.py = 668; S7.pw = 900; S7.ph = 104;
  S7.chips = [['Écrire', 'coral'], ['Apprendre', 'amber'], ['Coder', 'mint'], ['Analyser', 'sky'], ['Imaginer', 'violet']].map(([s, h]) => ({ s, h, w: tw(s, SANS(31, 600), -.3) + 70 }));
  const tot = S7.chips.reduce((a, c) => a + c.w, 0) + (S7.chips.length - 1) * 20; let x = 960 - tot / 2; S7.chips.forEach(c => { c.x = x + c.w / 2; x += c.w + 20; }); S7.cy = 806;
  // ripples + bursts
  ripple(28.0, 960, 540, 26, 'coral'); ripple(29.0, S6.w1[1].x + S6.w1[1].w / 2, S6.y1 - 40, 9, 'amber'); ripple(30.82, 960, S6.y3 - 50, 10, 'pink');
  ripple(36.0, 960, 540, 40, 'coral'); ripple(36.38, L.P7.x, L.P7.y, 12, 'violet'); ripple(38.4, 960, 440, 14, 'sky'); ripple(39.2, 960, 720, 10, 'mint');
  addBurst({ t0: 28.0, x: 960, y: 540, n: 60, speed: 1100, life: 1.0, size: 6, hues: HN, light: true, shape: 'dot', tag: 'F', seed: 2801 });
  addBurst({ t0: 29.02, x: S6.w1[1].x + S6.w1[1].w / 2, y: S6.y1 - 30, n: 18, speed: 380, spread: 2.8, dir: -Math.PI / 2, life: .8, size: 5, hues: ['amber', 'pink', 'mint'], light: true, shape: 'star', tag: 'F', seed: 2900, grav: 400 });
  addBurst({ t0: 36.0, x: 960, y: 540, n: 160, speed: 1700, life: 1.6, size: 9, hues: HN, light: false, shape: 'conf', grav: 900, drag: 2.4, tag: 'H', seed: 3600, spread: TAU });
  addBurst({ t0: 36.0, x: 960, y: 540, n: 70, speed: 2300, life: 1.0, size: 7, hues: HN, light: false, shape: 'star', grav: 200, drag: 2.8, tag: 'H', seed: 3601 });
  addBurst({ t0: 36.0, x: 960, y: 540, n: 50, speed: 1500, life: 1.1, size: 5, hues: HN, light: false, shape: 'streak', grav: 0, drag: 2.2, tag: 'H', seed: 3602 });
  [38.6, 40.0, 42.0, 44.0, 46.0].forEach((tt, i) => addBurst({ t0: tt, x: 960 + (i % 2 ? 280 : -280), y: 430 + (i % 3) * 40, n: 14, speed: 300, life: 1.1, size: 6, hues: HN, light: false, shape: 'star', grav: -60, drag: 2, tag: 'H', seed: 3700 + i }));
}

// ------------------------------------------------------------------ the orb in scenes F-H
function dotB(t) {
  let p = { x: 960, y: 540 };
  p = arcMove(p, L.P6a, t, 28.36, 160, .8, -50);
  p = arcMove(p, L.P6b, t, 30.66, 160, .8, -40);
  p = arcMove(p, { x: 960, y: 540 }, t, 33.22, 170, .8, -30);
  p = arcMove(p, L.P7, t, 36.25, 150, .8, 0);
  let r = lerp(17.5, 15, spring(t - 28.36, 170, .8));
  r = lerp(r, 38, spring(t - 33.3, 170, .8));
  r = lerp(r, 10, inn(seg(t, 35.7, 35.97)));
  r = lerp(r, 46, spring(t - 36.0, 140, .7));
  r *= 1 + pulse(t, 29.0, .12, .12) + pulse(t, 30.82, .12, .12) + pulse(t, 34, .1, .12) + pulse(t, 34.5, .1, .12) + pulse(t, 35, .12, .12) + pulse(t, 35.5, .14, .12);
  if (t > 37.5) r *= 1 + .025 * Math.sin((t - 37.5) * 3.2);
  return { x: p.x, y: p.y, r };
}
// ------------------------------------------------------------------ F + G
function sunsetBG(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  flowBG(CUR_F, 'sunset', LUT.sunset, { sx: .85, sp: .04, warp: 1.15, gain: .85, shade: .06, bias: -.04 }, 1);
  glow(SOFT.amber, 960, 1240, 1350, .3, 'lighter'); glow(SOFT.coral, 300, 1050, 800, .16, 'lighter'); glow(SOFT.violet, 1700, 200, 800, .2, 'lighter');
  // soft god rays from above
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const a = -.55 + i * .18 + .05 * Math.sin(t * .3 + i), w = .05 + .02 * Math.sin(t * .5 + i * 2);
    const g = ctx.createLinearGradient(1100, -100, 1100 + Math.sin(a) * 1400, 1100); g.addColorStop(0, 'rgba(255,230,200,0.10)'); g.addColorStop(1, 'rgba(255,230,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1100 - 20, -100); ctx.lineTo(1100 + 20, -100); ctx.lineTo(1100 + Math.sin(a + w) * 1500 + 40, 1100); ctx.lineTo(1100 + Math.sin(a - w) * 1500 - 40, 1100); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // drifting check marks and question marks, very faint
  const fa = seg(t, 28.2, 29.2) * (1 - seg(t, 35.5, 35.9));
  S6.float.forEach((f, i) => {
    const y = ((f.y - f.v * (t - 28)) % 1160 + 1160) % 1160 - 40, x = f.x + 18 * Math.sin(t * .6 + f.ph);
    ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot + .1 * Math.sin(t * .5 + f.ph)); ctx.globalAlpha = .1 * fa;
    if (f.k === 'q') { ctx.font = SER(f.s * 2); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('?', 0, 0); }
    else { ctx.strokeStyle = '#fff'; ctx.lineWidth = f.s * .12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-f.s * .45, 0); ctx.lineTo(-f.s * .12, f.s * .35); ctx.lineTo(f.s * .5, -f.s * .38); ctx.stroke(); }
    ctx.restore();
  });
  drawDust(t, true, .9);
}
function drawF(t) {
  const g = S6;
  // marker highlight behind "vérifie": the word flips to ink inside the amber band
  const v = g.w1[1], hp = o5(seg(t, 29.0, 29.38)), hr = inn(seg(t, 30.22, 30.4));
  g.w1.forEach((w, j) => { const o = 30.3 + .035 * j; rise(w.s, w.x, g.y1, g.f1, BR.cream, spring(t - (28.22 + .07 * j), 170, .8), inn(seg(t, o, o + .3)), { ls: g.ls1, lh: 122 }); });
  if (hp > 0 && hr < 1) {
    const base = ctx.getTransform(), bx = v.x - 12 + .12 * (g.y1 - 20), bw = v.w + 24, x0 = bx + bw * hr, w_ = bw * (hp - hr);
    ctx.save(); ctx.transform(1, 0, -.12, 1, 0, 0);
    rr(x0, g.y1 - 86, w_, 104, 10); ctx.fillStyle = rgb(HU.amber, .96); ctx.fill();
    ctx.beginPath(); ctx.rect(x0, g.y1 - 86, w_, 104); ctx.clip();
    ctx.setTransform(base);   // the word itself, in ink, clipped to the skewed band
    rise(v.s, v.x, g.y1, g.f1, BR.ink, spring(t - (28.22 + .07), 170, .8), 0, { ls: g.ls1, lh: 122 });
    ctx.restore();
  }
  // a mint check badge pops after the highlight
  const cb = spring(t - 29.55, 240, .6) * (1 - inn(seg(t, 30.25, 30.5)));
  if (cb > 0) { const bx = g.x1 + g.wv1 + 150, by = g.y1 - 120; ctx.save(); ctx.translate(bx, by); ctx.scale(cb, cb); ctx.rotate(-.12); glow(GLOW.mint, 0, 0, 90, .6); circ(0, 0, 44); ctx.fillStyle = rgb(HU.mint); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-18, 2); ctx.lineTo(-5, 15); ctx.lineTo(19, -14); ctx.stroke(); ctx.restore(); }
  g.w2.forEach((w, j) => { const o = 33.1 + .03 * j; rise(w.s, w.x, g.y2, g.f1, BR.cream, spring(t - (30.58 + .06 * j), 170, .8), inn(seg(t, o, o + .3)), { ls: g.ls1, lh: 122 }); });
  g.w3.forEach((w, j) => { const o = 33.16 + .03 * j; rise(w.s, w.x, g.y3, g.f3, BR.cream, spring(t - (30.82 + .06 * j), 170, .8), inn(seg(t, o, o + .3)), { ls: -1, lh: 186, rot: .08, stops: [[0, BR.paper], [1, HU.amber]] }); });
  // hand-drawn wavy underline under "je ne sais pas" + a bobbing question mark
  const u = o5(seg(t, 31.5, 31.95)), ur = inn(seg(t, 33.0, 33.25));
  if (u > 0 && ur < 1) { ctx.strokeStyle = rgb(HU.pink); ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); const n0 = Math.floor(70 * ur), n1 = Math.floor(70 * u); for (let k = n0; k <= n1; k++) { const x = g.x3 + g.wv3 * k / 70, y = g.y3 + 34 + 7 * Math.sin(k * .55); ctx[k === n0 ? 'moveTo' : 'lineTo'](x, y); } ctx.stroke(); }
  const q = spring(t - 31.2, 220, .6) * (1 - inn(seg(t, 33.05, 33.3)));
  if (q > 0) { ctx.save(); ctx.translate(g.x3 + g.wv3 + 150, g.y3 - 150 + 10 * Math.sin(t * 2.3)); ctx.rotate(.18 + .06 * Math.sin(t * 1.7)); ctx.scale(q, q); ctx.font = SER(230); ctx.textAlign = 'center'; ctx.fillStyle = rgb(HU.amber); ctx.fillText('?', 0, 0); glow(GLOW.amber, 0, -70, 150, .35); ctx.restore(); }
}
function drawOrbit(t, d, front) {
  const R = 560 * spring(t - 33.4, 120, .8) * (1 - inn(seg(t, 35.3, 35.96)));
  if (R <= 1) return;
  if (!front) {
    const pr = o5(seg(t, 33.4, 33.95)); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, R, R * .3, 0, -Math.PI / 2, -Math.PI / 2 + TAU * pr); ctx.stroke();
    ctx.setLineDash([3, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, R * .62, R * .62 * .3, 0, Math.PI / 2, Math.PI / 2 + TAU * pr); ctx.stroke(); ctx.setLineDash([]);
  }
  const phi = TAU * (.28 * (t - 33.4) + 1.1 * Math.pow(seg(t, 34.9, 35.96), 2.2)), col = seg(t, 35.45, 35.95);
  L.orb.map((o, i) => { const th = phi + i * Math.PI / 3, sn = Math.sin(th); return { o, i, th, x: d.x + R * Math.cos(th), y: d.y + R * .3 * sn, dep: (sn + 1) / 2 }; })
    .filter(p => (p.dep >= .5) === front).sort((a, b) => a.dep - b.dep).forEach(p => {
      const e = spring(t - (33.55 + .07 * p.i), 220, .78); if (e <= 0) return;
      const s = (.72 + .42 * p.dep) * clamp(e) * (1 - .8 * col);
      if (front || true) { // comet trail along the ellipse
        ctx.lineWidth = 3 * s; ctx.strokeStyle = rgb(HU[p.o.hue], .5 * (.4 + .6 * p.dep) * (1 - col)); ctx.beginPath(); ctx.ellipse(d.x, d.y, R, R * .3, 0, p.th - .5, p.th); ctx.stroke();
      }
      chip(p.x, p.y, p.o.s, p.o.hue, { dark: true, scale: s, alpha: (.45 + .55 * p.dep) * clamp(e * 1.5) * (1 - col * col), size: 40, h: 78, pad: 84 });
    });
}
function drawSunset(t) {
  sunsetBG(t);
  const z = 1 + .035 * io(seg(t, 28, 33.2)) - .035 * io(seg(t, 33.2, 34.2));
  setCam(z);
  drawEmitters(t, 'F'); drawF(t);
  const d = dotB(t);
  if (t >= 33.3 && t < 36.0) drawOrbit(t, d, false);
  drawOrb(d.x, d.y, d.r, t, { dark: true, ring: ss(seg(t, 28.5, 29)) * (1 - ss(seg(t, 35.4, 35.8))), sat: 3, ringR: 2.6 });
  if (t >= 33.3 && t < 36.0) drawOrbit(t, d, true);
  // clay field around the iris at the start: the dot we dived into opens onto the sunset
  if (t < 28.45) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const Rh = lerp(17.5, RF, o5(seg(t, 28.0, 28.4)));
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(960, 540, Rh, 0, TAU, true); ctx.fillStyle = rgb(BR.clay); ctx.fill('evenodd');
    ctx.lineWidth = 18 * (1 - seg(t, 28.0, 28.4)) + 2; const cg = ctx.createConicGradient(t * 4, 960, 540); RAINBOW.forEach(([p, c]) => cg.addColorStop(p, rgb(c))); cg.addColorStop(1, rgb(HU.coral)); ctx.strokeStyle = cg; ctx.globalAlpha = .9 * (1 - seg(t, 28.15, 28.45)); circ(960, 540, Rh); ctx.stroke(); ctx.globalAlpha = 1;
  }
  vignetteDark(.28);
}
function vignetteDark(k) { ctx.setTransform(1, 0, 0, 1, 0, 0); const g = ctx.createRadialGradient(960, 540, 480, 960, 540, 1200); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(20,5,40,${k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

// ------------------------------------------------------------------ H: finale
function finaleBG(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rgb(BR.cream); ctx.fillRect(0, 0, W, H);
  flowBG(CUR_F, 'fin', LUT.vivid, { sx: .95, sp: .07, warp: 1.3, gain: 1.15, shade: .1 }, 1);
  // colourful light leaks drifting across
  for (let i = 0; i < 5; i++) {
    const a = t * (.22 + .05 * i) + i * 1.3, x = 960 + 700 * Math.cos(a), y = 540 + 380 * Math.sin(a * 1.2 + i), k = ss(seg(t, 36.1, 37.2));
    glow(SOFT[HN[i % 6]], x, y, 560 + 80 * Math.sin(t + i), .4 * k, 'source-over');
  }
}
function particleWordmark(t) {
  const t0 = 36.02, tau0 = t - t0; if (tau0 < 0 || tau0 > 2.2) return;
  const mixInk = ss(seg(t, 36.95, 37.55)), fade = 1 - ss(seg(t, 37.45, 37.95)); if (fade <= 0) return;
  FIN.buckets.forEach((b, bi) => {
    const col = mixc(rainbow(bi / 23), BR.ink, mixInk); ctx.fillStyle = rgb(col, .95 * fade);
    for (const p of b) {
      const tau = tau0 - p.dl; if (tau < 0) continue;
      const e = Math.exp(-p.w * tau), ax = p.sx - p.tx, ay = p.sy - p.ty;
      const x = p.tx + (ax + (p.vx + p.w * ax) * tau) * e, y = p.ty + (ay + (p.vy + p.w * ay) * tau) * e;
      ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
  });
}
function drawPrompt(t) {
  const e = spring(t - 39.0, 130, .8); if (e <= 0) return;
  const { px, py, pw, ph } = S7, ang = t * 1.1;
  ctx.save(); ctx.translate(px, py + (1 - e) * 140); ctx.globalAlpha = clamp(e * 1.5);
  // soft coloured halo behind the box
  const cg = ctx.createConicGradient(ang, 0, 0); RAINBOW.forEach(([p, c]) => cg.addColorStop(p, rgb(c, .85))); cg.addColorStop(1, rgb(HU.coral, .85));
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.save(); ctx.globalAlpha *= .55; ctx.filter = 'blur(26px)'; rr(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.lineWidth = 12; ctx.strokeStyle = cg; ctx.stroke(); ctx.filter = 'none'; ctx.restore();
  ctx.shadowColor = 'rgba(60,35,20,0.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; rr(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fillStyle = rgb(BR.paper); ctx.fill(); ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  rr(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.lineWidth = 3.5; ctx.strokeStyle = cg; ctx.stroke();
  // + button, typed line, send button
  circ(-pw / 2 + 56, 0, 27); ctx.strokeStyle = 'rgba(20,20,19,0.18)'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(20,20,19,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-pw / 2 + 56 - 10, 0); ctx.lineTo(-pw / 2 + 56 + 10, 0); ctx.moveTo(-pw / 2 + 56, -10); ctx.lineTo(-pw / 2 + 56, 10); ctx.stroke();
  const n = Math.floor(seg(t, 40.1, 41.2) * S7.tag.length + .001), txs = -pw / 2 + 118, typed = S7.tag.slice(0, n);
  txt(typed, txs, 15, SANS(44, 500), BR.ink, { ls: -.5 });
  if (n === 0) txt('Écrire à Claude…', txs, 15, SANS(44, 450), BR.mute, { ls: -.5, alpha: .8 });
  const blink = ((t * 1.7) % 1) < .62; if (t > 39.6 && (blink || n < S7.tag.length)) { ctx.fillStyle = rgb(BR.clay); ctx.fillRect(txs + tw(typed, SANS(44, 500), -.5) + 4, -30, 4, 60); }
  const sp_ = 1 + .14 * Math.max(0, pulse(t, 41.3, 1, .25)) * 2.2 + (t > 41.6 ? .035 * Math.sin((t - 41.6) * 4) : 0);
  ctx.save(); ctx.translate(pw / 2 - 58, 0); ctx.scale(sp_, sp_); const sg = ctx.createLinearGradient(-30, -30, 30, 30); sg.addColorStop(0, rgb(HU.coral)); sg.addColorStop(1, rgb(HU.amber)); circ(0, 0, 33); ctx.fillStyle = sg; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -12); ctx.moveTo(-12, -1); ctx.lineTo(0, -13); ctx.lineTo(12, -1); ctx.stroke(); ctx.restore();
  ctx.restore();
  S7.chips.forEach((c, i) => { const ce = spring(t - (41.5 + .09 * i), 190, .66); if (ce <= 0) return; chip(c.x, S7.cy + 7 * Math.sin(t * 1.4 + i * 1.3) + (1 - ce) * 40, c.s, c.h, { scale: (.6 + .4 * ce) * (1 + .05 * Math.max(0, Math.sin((t - 44 - i * .12) * 3.1)) * (t > 44 ? 1 : 0)), alpha: clamp(ce * 1.4), size: 31, h: 66, pad: 70 }); });
}
function drawFinale(t) {
  const z = 1 + .03 * seg(t, 38, 48) + pulse(t, 36.0, .05, .3);
  finaleBG(t); setCam(z); drawGrid(t, BR.ink, .07);
  drawDust(t, false, .9);
  const d = dotB(t), s7 = S7;
  // shockwave rings + rays
  [36.0, 36.13, 36.26].forEach((b, j) => { const rp = seg(t, b, b + 1.1); if (rp > 0 && rp < 1) { const cg = ctx.createConicGradient(t * 2 + j, 960, 540); RAINBOW.forEach(([p, c]) => cg.addColorStop(p, rgb(c, .8 * (1 - rp)))); cg.addColorStop(1, rgb(HU.coral, .8 * (1 - rp))); ctx.strokeStyle = cg; ctx.lineWidth = 3 + 7 * (1 - rp); circ(960, 540, 30 + [1000, 760, 520][j] * o5(rp)); ctx.stroke(); } });
  const u = seg(t, 36.0, 36.8);
  if (u > 0 && u < 1) { ctx.lineCap = 'round'; for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + TAU / 32, r2 = 70 + (i % 2 ? 460 : 620) * o5(seg(t, 36.0, 36.5)), r1 = 70 + (i % 2 ? 350 : 470) * o5(seg(t, 36.06, 36.75)); if (r2 <= r1) continue; ctx.strokeStyle = rgb(hueAt(i), 1 - u * u); ctx.lineWidth = 3 + 6 * (1 - u); ctx.beginPath(); ctx.moveTo(960 + Math.cos(a) * r1, 540 + Math.sin(a) * r1); ctx.lineTo(960 + Math.cos(a) * r2, 540 + Math.sin(a) * r2); ctx.stroke(); } }
  drawEmitters(t, 'H');
  // the real wordmark replaces the particles; a rainbow sheen sweeps over it
  const rv = ss(seg(t, 37.2, 37.9));
  if (rv > 0) {
    ctx.save(); ctx.globalAlpha = rv; txt('Claude', s7.xC, s7.y, s7.f, BR.ink, { ls: -2 }); ctx.restore();
    sheen('Claude', s7.xC, s7.y, s7.f, -2, io(seg(t, 38.3, 39.1)));
    if (t > 39.2) { const sw = io(seg(t, 44.2, 45.0)); sheen('Claude', s7.xC, s7.y, s7.f, -2, sw); }
  }
  particleWordmark(t);
  // the logo orb with its orbit ring: it carries the identity of the whole film
  ctx.setTransform(1, 0, 0, 1, 0, 0); setCam(z);
  drawOrb(d.x, d.y, d.r, t, { ring: ss(seg(t, 36.8, 37.4)), sat: 3, ringR: 2.3, spin: 1.8 });
  drawPrompt(t);
  // small credit line
  const ca = ss(seg(t, 42.6, 43.3)); if (ca > 0) txt('UNE IA CONÇUE PAR ANTHROPIC', 960, 950, MONO(16), BR.mute, { align: 'center', ls: 5, alpha: .8 * ca });
  vignetteLight();
}
function drawEnding(t) {
  if (t < 36.0) { drawSunset(t); drawHUD(t, true); }
  else { drawFinale(t); drawHUD(t, false, 1 - ss(seg(t, 46.4, 47.2))); }
  // white-out into the finale
  if (t >= 35.84 && t < 36.0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,252,246,${io(seg(t, 35.84, 36.0))})`; ctx.fillRect(0, 0, W, H); }
  else if (t >= 36.0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,252,246,${Math.exp(-(t - 36.0) / .12)})`; ctx.fillRect(0, 0, W, H); flare(960, 540, 420 * Math.exp(-(t - 36) / .6), .9 * Math.exp(-(t - 36) / .5), 'amber'); }
}
