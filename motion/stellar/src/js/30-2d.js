// =====================================================================================================
//  2D layer: kinetic type, cards, stamps, split screens, particles. Drawn on L2D over the 3D pass.
// =====================================================================================================
const CX = W / 2;
// stacked "extruded" display word (Anton) with a gradient face, a darker depth and an optional glow
function slab(s, cx, y, size, face, o = {}) {
  const font = ANT(size), ls = o.ls ?? size * .02, w = tw(s, font, ls), depth = o.depth ?? Math.round(size * .06);
  ctx.save();
  ctx.translate(cx, y); if (o.rot) ctx.rotate(o.rot); if (o.sc) ctx.scale(o.sc, o.sc);
  ctx.font = font; ctx.letterSpacing = ls + 'px'; ctx.textAlign = 'center'; ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowB || 60; }
  for (let d = depth; d > 0; d -= 2) { ctx.fillStyle = rgb(o.side || [20, 18, 60]); ctx.fillText(s, d * .35, d); }
  ctx.shadowBlur = 0;
  if (Array.isArray(face) && Array.isArray(face[0])) {
    const g = ctx.createLinearGradient(0, -size * .8, 0, 0);
    face.forEach(([p, c]) => g.addColorStop(p, rgb(c))); ctx.fillStyle = g;
  } else ctx.fillStyle = rgb(face);
  ctx.fillText(s, 0, 0);
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = rgb(o.strokeCol || C.white, .9); ctx.strokeText(s, 0, 0); }
  ctx.restore(); ctx.globalAlpha = 1;
  return w;
}
// moving light band clipped to the glyphs of a centred word
const SHB = mk(W, 700);
function sheen(s, cx, y, font, ls, p, col = [255, 255, 255], a = .85, band = 220) {
  if (p <= 0 || p >= 1) return;
  const g = SHB.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, 700);
  g.font = font; g.letterSpacing = ls + 'px'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(s, CX, 520);
  g.globalCompositeOperation = 'source-in';
  const w = tw(s, font, ls), x = CX - w / 2 - band + (w + band * 2) * p, gr = g.createLinearGradient(x - band / 2, 0, x + band / 2, 0);
  gr.addColorStop(0, rgb(col, 0)); gr.addColorStop(.5, rgb(col, a)); gr.addColorStop(1, rgb(col, 0));
  g.setTransform(1, 0, -.35, 1, 0, 0); g.fillStyle = gr; g.fillRect(-400, 0, W + 800, 700);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(SHB.c, cx - CX, y - 520); ctx.globalCompositeOperation = 'source-over';
}
// glass card
function glass(x, y, w, h, r, a = 1, tint = C.deep, border = [C.violet, C.cyan]) {
  ctx.save(); ctx.globalAlpha = a;
  rr(x, y, w, h, r); ctx.fillStyle = rgb(tint, .62); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, rgb(border[0], .95)); g.addColorStop(1, rgb(border[1], .95));
  ctx.lineWidth = 3; ctx.strokeStyle = g; ctx.stroke();
  const hl = ctx.createLinearGradient(0, y, 0, y + h * .5); hl.addColorStop(0, 'rgba(255,255,255,.10)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  rr(x + 3, y + 3, w - 6, h * .5, r - 3); ctx.fillStyle = hl; ctx.fill();
  ctx.restore();
}
function pill(s, cx, y, a, col = C.violet) {
  const font = SANS(30, 700), w = tw(s, font, 4) + 90, h = 66;
  ctx.save(); ctx.globalAlpha = a;
  rr(cx - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(10,12,40,.72)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgb(col, .9); ctx.stroke();
  circ(cx - w / 2 + 34, y, 8); ctx.fillStyle = rgb(col); ctx.fill(); glow(GLOW.violet, cx - w / 2 + 34, y, 30, a * .8);
  ctx.globalAlpha = a; txt(s, cx + 18, y + 11, font, C.white, { ls: 4, align: 'center' });
  ctx.restore();
}
// seeded burst of sparkles around a point (t = seconds since the burst)
function sparkBurst(seed, x, y, t, n = 18, R0 = 260, col = C.white) {
  if (t < 0 || t > 1.6) return;
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, sp = .4 + r() * .6, d = R0 * sp * o5(seg(t, 0, 1.2)), life = 1 - seg(t, .2 + r() * .4, 1.3 + r() * .3);
    sparkle(x + Math.cos(a) * d, y + Math.sin(a) * d * .8, (8 + r() * 18) * life, life, col, r() * 3 + t * 2);
  }
}

// --------------------------------------------------------------------------------------------- icons
function icon(kind, x, y, s, col = C.white) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.fillStyle = rgb(col); ctx.strokeStyle = rgb(col); ctx.lineWidth = 6; ctx.lineJoin = 'round';
  if (kind === 'agency') {
    ctx.fillRect(-46, -6, 92, 40); ctx.fillRect(-60, 6, 14, 28); ctx.fillRect(46, 6, 14, 28);
    ctx.beginPath(); ctx.arc(0, -6, 22, Math.PI, 0); ctx.fill(); ctx.fillRect(-2, -42, 4, 14);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * 12 - 4, 6, 7, 10);
  } else if (kind === 'yacht') {
    ctx.beginPath(); ctx.moveTo(-60, 4); ctx.lineTo(56, 4); ctx.lineTo(40, 30); ctx.lineTo(-48, 30); ctx.closePath(); ctx.fill();
    ctx.fillRect(-36, -14, 64, 14); ctx.fillRect(-24, -30, 36, 14);
    ctx.beginPath(); ctx.moveTo(-70, 42); for (let i = 0; i <= 7; i++) ctx.quadraticCurveTo(-60 + i * 20, 34 + (i % 2 ? -8 : 8), -50 + i * 20, 42); ctx.stroke();
  } else if (kind === 'shark') {
    ctx.beginPath(); ctx.moveTo(-40, 26); ctx.quadraticCurveTo(-6, -10, 20, -46); ctx.quadraticCurveTo(14, -6, 40, 26); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-70, 34); for (let i = 0; i <= 7; i++) ctx.quadraticCurveTo(-60 + i * 20, 26 + (i % 2 ? -8 : 8), -50 + i * 20, 34); ctx.stroke();
  } else if (kind === 'rig') {
    ctx.fillRect(-50, -4, 100, 12); ctx.fillRect(-30, -26, 30, 22);
    ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(28, -58); ctx.lineTo(42, -4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(20, -28); ctx.lineTo(36, -28); ctx.stroke();
    for (const lx of [-40, -14, 14, 40]) ctx.fillRect(lx - 4, 8, 8, 30);
    ctx.beginPath(); ctx.moveTo(-70, 42); for (let i = 0; i <= 7; i++) ctx.quadraticCurveTo(-60 + i * 20, 34 + (i % 2 ? -8 : 8), -50 + i * 20, 42); ctx.stroke();
  } else if (kind === 'check') {
    ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-34, 2); ctx.lineTo(-10, 26); ctx.lineTo(36, -24); ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================================ SCENES
function d_intro(t) {
  // FÉVRIER / 2020 (split-flap digits) / TU TE SOUVIENS ?
  const w = io(seg(t, 3.0, 4.0)), z = 1 + w * w * 2.6;
  ctx.save(); ctx.translate(CX, 900); ctx.scale(z, z); ctx.translate(-CX, -900); ctx.globalAlpha = 1 - io(seg(t, 3.35, 3.9));
  riseC('FÉVRIER', CX, 690, ANT(120), C.lilac, o5(seg(t, .55, 1.1)), 0, { ls: 26, lh: 140 });
  const font = ANT(400), digits = '2020', dw = 210, x0 = CX - dw * 1.5;
  for (let i = 0; i < 4; i++) {
    const t0 = .8 + i * .14, land = t0 + .55;
    if (t < t0) continue;
    const x = x0 + i * dw, y = 1080, spin = t < land;
    const ch = spin ? String(Math.floor(hash(i * 977 + Math.floor(t * 30)) * 10)) : digits[i];
    const k = spin ? 0 : spring(t - land, 420, .5);
    // tile
    rr(x - 92, y - 330, 184, 400, 26); ctx.fillStyle = 'rgba(16,18,52,.78)'; ctx.fill();
    ctx.strokeStyle = rgb(C.violet, .7); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x - 92, y - 132, 184, 4);
    const g = ctx.createLinearGradient(0, y - 300, 0, y + 40); g.addColorStop(0, '#ffffff'); g.addColorStop(1, rgb(C.lilac));
    ctx.save(); ctx.beginPath(); ctx.rect(x - 92, y - 330, 184, 400); ctx.clip();
    ctx.translate(x, y - 130); ctx.scale(1, spin ? .78 + .22 * Math.abs(Math.sin(t * 40 + i)) : lerp(1.18, 1, k)); txt(ch, 0, 150, font, g, { align: 'center' });
    ctx.restore();
    if (!spin) sparkBurst(40 + i, x, y - 130, t - land, 8, 170, C.ice);
  }
  wordsC('TU TE SOUVIENS ?', CX, 1340, SANS(78, 800), C.white, 2.0, t, undefined, { stag: .09, lh: 90 });
  ctx.restore(); ctx.globalAlpha = 1;
}

function d_bus(t) {
  const k = lt(t, 'bus');
  // label 1, linked to the bus by a thin leader line
  const b = busAt(t), p = proj(isleCam, b.p.clone().add(V(0, 2, 0)));
  const a1 = o5(seg(k, .25, .7)) * (1 - io(seg(k, 1.4, 1.7)));
  if (a1 > 0) {
    ctx.save(); ctx.globalAlpha = a1;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CX, 520); ctx.lineTo(lerp(CX, p[0], o5(seg(k, .35, .9))), lerp(520, p[1] - 60, o5(seg(k, .35, .9)))); ctx.stroke();
    circ(p[0], p[1] - 60, 10 + 6 * Math.sin(t * 6)); ctx.fillStyle = rgb(C.gold); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  const out1 = io(seg(k, 1.4, 1.72));
  riseC('LE BUS', CX, 330, ANT(150), C.white, o5(seg(k, .2, .65)), out1, { ls: 6, lh: 170, shadow: 'rgba(20,40,120,.6)', blur: 30 });
  riseC('DE COMBAT', CX, 490, ANT(150), C.gold, o5(seg(k, .32, .77)), out1, { ls: 6, lh: 170, shadow: 'rgba(80,40,0,.5)', blur: 30 });
  // label 2
  const out2 = io(seg(k, 2.95, 3.25));
  riseC("L'ÎLE DU", CX, 1470, ANT(130), C.white, o5(seg(k, 1.7, 2.15)), out2, { ls: 8, lh: 150, shadow: 'rgba(0,30,80,.7)', blur: 30 });
  const pc = o5(seg(k, 1.85, 2.35));
  if (pc > 0 && out2 < 1) {
    const sc = lerp(1.25, 1, spring(k - 1.85, 260, .6));
    slab('CHAPITRE 2', CX, 1680, 200, [[0, C.white], [1, C.ice]], { sc, alpha: pc * (1 - out2), glow: 'rgba(57,208,255,.7)', glowB: 50, side: [10, 40, 110] });
    sheen('CHAPITRE 2', CX, 1680, ANT(200), 4, seg(k, 2.2, 2.9), [255, 255, 255], .9);
  }
  // label 3: "une saison qui a tout changé"
  const out3 = io(seg(k, 4.75, 5.0));
  riseC('UNE SAISON', CX, 1420, ANT(120), C.white, o5(seg(k, 3.1, 3.5)), out3, { ls: 10, lh: 140, shadow: 'rgba(0,30,80,.7)', blur: 30 });
  const p3 = spring(k - 3.4, 240, .7);
  if (p3 > 0 && out3 < 1) {
    slab('QUI A TOUT CHANGÉ', CX, 1600, Math.min(150, fitSize('QUI A TOUT CHANGÉ', 960, ANT, 3)), [[0, [255, 236, 160]], [1, C.gold]], { sc: lerp(1.2, 1, p3), alpha: clamp(p3 * 2) * (1 - out3), side: [90, 50, 0], glow: 'rgba(0,20,60,.6)' });
  }
  // redaction bar wipe into the dossier
  const wp = io5(seg(k, 5.0, 5.333));
  if (wp > 0) { ctx.fillStyle = rgb(C.ink); ctx.fillRect(-20, 0, (W + 40) * wp, H); }
}

const DOSSIER = mk(W, H);
{ // the paper texture of the dossier is static: draw once
  const g = DOSSIER.g, r = mulberry32(5);
  g.fillStyle = '#e9dfc7'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(90,70,40,${r() * .05})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
  const v = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,40,10,.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,60,30,.35)'; g.lineWidth = 2; g.strokeRect(70, 140, W - 140, H - 280);
  g.font = '500 34px JBM, monospace'; g.fillStyle = '#3a3226'; g.letterSpacing = '2px';
  g.fillText('DOSSIER  C2-S2', 110, 230); g.fillText('OBJET : L\'AGENCE', 110, 290);
  g.fillStyle = '#16130e'; for (const [x, y, w] of [[110, 1330, 620], [110, 1400, 820], [110, 1470, 540], [110, 1540, 760], [110, 1610, 480]]) g.fillRect(x, y, w, 38);
  g.font = '500 30px JBM, monospace'; g.fillStyle = '#3a3226'; g.fillText('AGENT : ██████', 110, 1270);
}
function d_secret(t) {
  const k = lt(t, 'secret');
  ctx.drawImage(DOSSIER.c, 0, 0);
  // fingerprint-ish photo frame with a question mark (the season's mystery agent)
  ctx.save(); ctx.translate(780, 300); ctx.rotate(.06);
  ctx.fillStyle = '#fff'; ctx.fillRect(-130, -110, 260, 300); ctx.fillStyle = '#20232f'; ctx.fillRect(-112, -92, 224, 230);
  txt('?', 0, 90, ANT(200), C.gold, { align: 'center' });
  ctx.restore();
  // typed line
  const typed = 'CLASSIFIÉ  ·  FÉVRIER 2020', n = Math.floor(clamp((k - .55) / .9) * typed.length);
  txt(typed.slice(0, n) + (n < typed.length && Math.floor(k * 6) % 2 ? '▌' : ''), 110, 1180, MONO(40), [40, 30, 20]);
  // the stamp slams on the beat (k = 0)
  const land = spring(k - .02, 520, .55), sc = lerp(2.6, 1, clamp(land, 0, 1.3)), a = clamp(k / .06);
  ctx.save(); ctx.translate(CX, 860); ctx.rotate(-.21); ctx.scale(sc, sc); ctx.globalAlpha = a * .95;
  ctx.strokeStyle = rgb(C.red); ctx.lineWidth = 16; rr(-420, -150, 840, 300, 26); ctx.stroke();
  ctx.lineWidth = 5; rr(-396, -126, 792, 252, 16); ctx.stroke();
  txt('TOP SECRET', 0, 80, ANT(200), C.red, { align: 'center', ls: 8 });
  // ink speckle mask: punch small holes for the rubber-stamp texture
  ctx.globalCompositeOperation = 'destination-out';
  const r = mulberry32(19); for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(0,0,0,${.3 + r() * .7})`; circ(-430 + r() * 860, -160 + r() * 320, 1 + r() * 4); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // ink splatter flying out at impact
  const r2 = mulberry32(23), ip = seg(k, .08, .5);
  if (ip > 0 && ip < 1) for (let i = 0; i < 26; i++) {
    const ang = r2() * TAU, d = (260 + r2() * 360) * o5(ip); ctx.fillStyle = rgb(C.red, (1 - ip) * .8);
    circ(CX + Math.cos(ang) * d * 1.3, 860 + Math.sin(ang) * d * .6, (2 + r2() * 8) * (1 - ip * .5)); ctx.fill();
  }
  // the Midas gold floods up from the bottom (wave)
  const gp = io5(seg(k, 1.62, 2.0));
  if (gp > 0) goldFlood(gp, t);
}
function goldFlood(p, t) {
  const top = H - (H + 220) * p;
  const g = ctx.createLinearGradient(0, top, 0, top + 900); g.addColorStop(0, '#fff3b0'); g.addColorStop(.08, rgb(C.gold)); g.addColorStop(1, rgb(C.goldD));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, top + Math.sin(x * .012 + t * 9) * 40 + Math.sin(x * .031 - t * 5) * 18);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
function d_midas(t) {
  const k = lt(t, 'midas'), drain = io5(seg(k, 1.0, 1.33));
  // gold tint over the 3D island, draining down at the end
  ctx.drawImage(glc, 0, 0);   // tint the 3D island itself
  if (drain < 1) {
    ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.fillStyle = rgb(C.gold, .85 * (1 - drain)); ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(90,52,8,${.75 * (1 - drain)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    const cover = 1 - o5(seg(k, 0, .35));   // the solid gold flood thins into the tint
    if (cover > 0) { ctx.globalAlpha = cover; goldFlood(1, t); ctx.globalAlpha = 1; }
  }
  const sc = lerp(1.3, 1, spring(k - .05, 220, .7)), a = clamp(k / .1) * (1 - io(seg(k, .95, 1.2)));
  slab('MIDAS', CX, 1060, 330, [[0, [255, 246, 196]], [.45, C.gold], [1, C.goldD]], { sc, alpha: a, side: [92, 52, 6], glow: 'rgba(255,190,60,.8)', glowB: 70, ls: 14 });
  sheen('MIDAS', CX, 1060, ANT(330), 14, seg(k, .25, .95), [255, 255, 255], 1, 260);
  const r = mulberry32(61);
  for (let i = 0; i < 60; i++) { // rising gold dust
    const x = r() * W, sp = 120 + r() * 240, y = H + 40 - fract(r() + k * sp / H) * (H + 80);
    sparkle(x, y, (5 + r() * 12) * a, a * (.4 + r() * .6), C.gold, k * 3 + i);
  }
  txt("LE TOUCHER D'OR", CX, 1200, SANS(42, 800), [255, 236, 170], { align: 'center', ls: 10, alpha: a * .9 });
}
const POIS = [['agency', "L'AGENCE"], ['yacht', 'LE YACHT'], ['shark', 'LE REQUIN'], ['rig', 'LA PLATEFORME']];
function d_poi(t) {
  const k = lt(t, 'poi'); let i = 0; while (i < 3 && k >= CARD_T[i + 1]) i++;
  const f = k - CARD_T[i], next = i < 3 ? CARD_T[i + 1] - CARD_T[i] : 9;
  // map pin on the 3D POI
  const p = proj(isleCam, POI_POS(POIS[i][0]));
  const pin = spring(f - .12, 300, .55);
  if (pin > 0) {
    ctx.save(); ctx.translate(p[0], p[1] - 40 * pin); ctx.scale(pin, pin);
    ctx.fillStyle = rgb(C.violet); ctx.beginPath(); ctx.arc(0, -40, 34, Math.PI * .85, Math.PI * .15); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
    circ(0, -40, 13); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    for (let j = 0; j < 2; j++) { const q = fract(f * 1.4 + j * .5); ctx.strokeStyle = rgb(C.violet, (1 - q) * .8); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p[0], p[1], 30 + q * 90, (30 + q * 90) * .45, 0, 0, TAU); ctx.stroke(); }
  }
  // the card: one per beat, the previous one folds away as the new one unfolds (shared position)
  const y0 = 1380, cw = 860, ch = 300;
  const unfold = o5(seg(f, 0, .22)), fold = i < 3 ? io(seg(f, next - .14, next)) : io(seg(f, 0.75, 1.0));
  const sx = Math.max(0.001, unfold * (1 - fold));
  ctx.save(); ctx.translate(CX, y0); ctx.scale(1, sx); ctx.translate(-CX, -y0);
  glass(CX - cw / 2, y0 - ch / 2, cw, ch, 40, 1);
  rr(CX - cw / 2 + 34, y0 - 110, 220, 220, 30); const ig = ctx.createLinearGradient(0, y0 - 110, 0, y0 + 110); ig.addColorStop(0, rgb(C.violet)); ig.addColorStop(1, rgb(C.indigo)); ctx.fillStyle = ig; ctx.fill();
  icon(POIS[i][0], CX - cw / 2 + 144, y0 + 6, 150, C.white);
  txt(`POI 0${i + 1}`, CX - cw / 2 + 300, y0 - 50, MONO(32), C.cyan, { ls: 6 });
  const name = POIS[i][1], fs = Math.min(130, fitSize(name, cw - 340, ANT));
  txt(name, CX - cw / 2 + 296, y0 + 80, ANT(fs), C.white, { ls: 2 });
  ctx.restore();
  // progress dots
  for (let j = 0; j < 4; j++) { circ(CX - 60 + j * 40, y0 + ch / 2 + 70, j === i ? 11 : 7); ctx.fillStyle = j === i ? rgb(C.white) : 'rgba(255,255,255,.4)'; ctx.fill(); }
  // headline
  txt('LES LIEUX', CX, 300, ANT(110), C.white, { align: 'center', ls: 14, alpha: o5(seg(k, 0, .3)) * (1 - io(seg(k, 3.0, 3.3))) });
}
function d_sides(t) {
  const k = lt(t, 'sides');
  // diagonal seam: line through the centre, angle -20 deg; offset swings (tug of war) then settles
  const inA = o5(seg(k, 0, .45)), tug = Math.sin(k * 7) * 70 * win(k, 1.3, 2.6, .3), fin = io5(seg(k, 2.9, 3.333));
  const off = tug + fin * 1500;
  const ang = -.36, nx = Math.sin(ang), ny = Math.cos(ang);
  // white half (top): slides down from top-left; black half (bottom): from bottom-right
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-(1 - inA) * 900, -(1 - inA) * 1200);
  ctx.beginPath(); const c0 = H / 2 + off;
  ctx.moveTo(-200, -200); ctx.lineTo(W + 200, -200); ctx.lineTo(W + 200, c0 - (W / 2 + 200) * Math.tan(ang) * -1); ctx.lineTo(-200, c0 + (W / 2 + 200) * Math.tan(ang) * -1); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd8ff'); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  // type
  const s1 = spring(k - .28, 240, .7), s2 = spring(k - 1.0, 240, .7);
  slab('FANTÔME', CX, 640 + off * .3, 230, [[0, [30, 30, 48]], [1, [10, 10, 20]]], { sc: lerp(1.3, 1, s1), alpha: clamp(s1 * 2), side: [170, 180, 220], rot: ang * .5, depth: 10 });
  slab('OMBRE', CX, 1500 + off * .3, 260, [[0, C.white], [1, [200, 200, 220]]], { sc: lerp(1.3, 1, s2), alpha: clamp(s2 * 2), side: [60, 60, 90], rot: ang * .5, depth: 10 });
  // "OU" badge on the seam
  const ou = spring(k - .82, 300, .55);
  if (ou > 0) {
    ctx.save(); ctx.translate(CX, H / 2 + off); ctx.scale(ou, ou);
    circ(0, 0, 92); ctx.fillStyle = rgb(C.red); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
    txt('OU', 0, 30, ANT(90), C.white, { align: 'center' }); ctx.restore();
  }
  // "CHOISIS TON CAMP"
  const cp = o5(seg(k, 1.8, 2.1)) * (1 - io(seg(k, 2.85, 3.1)));
  if (cp > 0) { ctx.save(); ctx.globalAlpha = cp; rr(CX - 330, 1840 - 120 - 60, 660, 84, 42); ctx.fillStyle = rgb(C.red); ctx.fill(); txt('CHOISIS TON CAMP', CX, 1840 - 120 - 4, SANS(40, 800), C.white, { align: 'center', ls: 6 }); ctx.restore(); }
}

// ---- the memory: polaroid of the island that shatters into stars, which converge into the drop
const POL = mk(760, 900);
const SHARDS = (() => {
  const r = mulberry32(808), nx = 10, ny = 12, pts = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const edge = i === 0 || j === 0 || i === nx || j === ny;
    pts.push([(i + (edge ? 0 : (r() - .5) * .7)) / nx * 760, (j + (edge ? 0 : (r() - .5) * .7)) / ny * 900]);
  }
  const tris = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    tris.push([pts[a], pts[b], pts[d]], [pts[a], pts[d], pts[c]]);
  }
  return tris.map(tr => ({ tr, cx: (tr[0][0] + tr[1][0] + tr[2][0]) / 3, cy: (tr[0][1] + tr[1][1] + tr[2][1]) / 3, d: r(), sp: r(), rot: (r() - .5) * 6, ang: r() * TAU }));
})();
function d_fade(t, glImg) {
  const k = lt(t, 'fade');
  ctx.fillStyle = rgb(C.night); ctx.fillRect(0, 0, W, H);
  // build the polaroid (photo = live 3D island render, cropped)
  const g = POL.g; g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, 760, 900);
  const desat = io(seg(k, 1.6, 3.0));
  g.filter = `saturate(${1 - desat * .85}) sepia(${desat * .35}) brightness(${1 - desat * .1})`;
  g.drawImage(glImg, 140, 420, 800, 800, 40, 40, 680, 680); g.filter = 'none';
  g.font = '500 34px JBM, monospace'; g.fillStyle = '#4a4438'; g.textAlign = 'left'; g.letterSpacing = '2px'; g.fillText('fév. 2020', 52, 800);
  const drift = io(seg(k, 0, 4.67)), sc = lerp(1.0, .78, drift), rot = lerp(-.05, .04, drift);
  const sh = seg(k, 3.0, 4.4);   // shatter progress
  const cx = CX, cy = 900;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-380, -450);
  if (sh <= 0) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50; ctx.drawImage(POL.c, 0, 0); ctx.shadowBlur = 0; }
  ctx.restore();
  if (sh > 0) {
    for (const s of SHARDS) {
      const a = clamp((sh - s.d * .35) / .65); if (a >= 1) continue;
      const e = o5(a), dx = Math.cos(s.ang) * 420 * e + (s.cx - 380) * .6 * e, dy = Math.sin(s.ang) * 420 * e + (s.cy - 450) * .6 * e - 120 * e;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-380 + dx, -450 + dy);
      ctx.translate(s.cx, s.cy); ctx.rotate(s.rot * e); ctx.scale(1 - e, 1 - e); ctx.translate(-s.cx, -s.cy);
      ctx.beginPath(); ctx.moveTo(...s.tr[0]); ctx.lineTo(...s.tr[1]); ctx.lineTo(...s.tr[2]); ctx.closePath(); ctx.clip();
      ctx.globalAlpha = 1 - a * a; ctx.drawImage(POL.c, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
    }
    // every shard leaves a star that swirls, then all stars converge to the centre before the drop
    const conv = io5(seg(k, 4.0, 4.667));
    SHARDS.forEach((s, i) => {
      const a = clamp((sh - s.d * .35) / .65); if (a <= 0) return;
      const e = o5(a), r0 = 380 + s.sp * 380, ang = s.ang + e * 1.4 + k * .6 * (s.sp - .5);
      let x = cx + Math.cos(ang) * r0 * e, y = cy + Math.sin(ang) * r0 * e * 1.25;
      x = lerp(x, CX, conv); y = lerp(y, 900, conv);
      sparkle(x, y, (6 + s.sp * 10) * (1 - conv * .5), clamp(a * 2) * .9, i % 3 ? C.ice : C.lilac, k + i);
    });
    glow(GLOW.violet, CX, 900, 80 + 600 * pulse(t, DROP - .08, .2), io(seg(k, 4.1, 4.667)));
  }
  // words
  const tout = 3.55;
  wordsC('CETTE ÉPOQUE,', CX, 1470, SANS(46, 500), C.ice, .45, k, tout, { ls: 10, stag: .08, lh: 70 });
  wordsC('TU PENSAIS NE JAMAIS', CX, 1570, SANS(58, 300), C.white, 1.38, k, tout, { ls: 6, stag: .1, lh: 80 });
  wordsC('LA REVOIR.', CX, 1660, SANS(58, 800), C.lilac, 2.45, k, tout, { ls: 6, stag: .1, lh: 80 });
}

function d_logo(t) {
  const k = lt(t, 'logo');
  // flash + shockwave rings + rays
  ctx.fillStyle = `rgba(255,255,255,${.95 * Math.exp(-k / .12)})`; ctx.fillRect(0, 0, W, H);
  const cy = 620;
  for (let j = 0; j < 3; j++) {
    const q = o5(seg(k, j * .1, .9 + j * .1));
    if (q > 0 && q < 1) { ctx.strokeStyle = rgb(j === 1 ? C.cyan : C.lilac, (1 - q) * .9); ctx.lineWidth = 18 * (1 - q) + 2; circ(CX, cy, 60 + q * 900); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(CX, cy); ctx.rotate(k * .15); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU, L = 1300, wdt = .05 + .04 * hash(i * 13);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); g.addColorStop(0, rgb(C.violet, .28 * clamp(k * 3))); g.addColorStop(1, rgb(C.violet, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - wdt) * L, Math.sin(a - wdt) * L); ctx.lineTo(Math.cos(a + wdt) * L, Math.sin(a + wdt) * L); ctx.closePath(); ctx.fill();
  }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  glow(GLOW.violet, CX, cy, 520, .55); glow(GLOW.cyan, CX, cy, 260, .35);
  wordmark(t, k, 1270);
  sparkBurst(91, CX, cy, k - .05, 26, 520, C.ice);
}
// PROJECT / STELLAR wordmark with per-letter slam
function wordmark(t, k, y, o = {}) {
  const top = 'PROJECT', word = 'STELLAR';
  const ps = o5(seg(k, .35, .8));
  riseC(top, CX, y - 285, UNB(60, 700), C.ice, ps, 0, { ls: 34, lh: 90 });
  const fs = 300, font = ANT(fs), ls = 10, total = tw(word, font, ls);
  let x = CX - total / 2;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i], cw = tw(ch, font, ls), t0 = .12 + i * .05, s = spring(k - t0, 340, .62);
    if (s > 0) {
      const g = ctx.createLinearGradient(0, y - fs * .75, 0, y); g.addColorStop(0, '#ffffff'); g.addColorStop(.55, rgb(C.lilac)); g.addColorStop(1, rgb(C.violet));
      ctx.save(); ctx.translate(x + cw / 2, y); ctx.scale(lerp(1.8, 1, Math.min(1, s)), lerp(1.8, 1, Math.min(1, s))); ctx.globalAlpha = clamp(s * 2.5);
      ctx.shadowColor = 'rgba(123,92,255,.9)'; ctx.shadowBlur = 50;
      txt(ch, 0, 0, font, g, { align: 'center', ls: 0 }); ctx.restore(); ctx.globalAlpha = 1;
    }
    x += cw;
  }
  sheen(word, CX, y, font, ls, seg(k, .9, 1.9), [255, 255, 255], .9, 240);
}

let CLIP_A = null, CLIP_B = null;   // set by the clip loader when gameplay footage is present
function d_og(t) {
  const k = lt(t, 'og');
  if (CLIP_A) clipFrame(CLIP_A, k, 70, 560, 940, 860, -.035, o5(seg(k, .15, .6)) * (1 - io(seg(k, 6.3, 6.667))));
  pill('PROJET INDÉPENDANT · NON OFFICIEL', CX, 300, o5(seg(k, .1, .45)) * (1 - io(seg(k, 6.2, 6.6))));
  const out = io(seg(k, 3.95, 4.2));
  wordsC('REVIVRE LE', CX, CLIP_A ? 1560 : 760, SANS(70, 600), C.white, 2.65, k, 3.95, { stag: .08, lh: 90 });
  const s = spring(k - 3.0, 240, .72);
  if (s > 0 && out < 1) {
    const y = CLIP_A ? 1760 : 1000;
    slab('FORTNITE OG', CX, y, Math.min(220, fitSize('FORTNITE OG', 900, ANT, 4.4)), [[0, C.white], [1, C.lilac]], { sc: lerp(1.25, 1, s), alpha: clamp(s * 2) * (1 - out), glow: 'rgba(123,92,255,.9)', glowB: 60, side: [40, 20, 110] });
    sheen('FORTNITE OG', CX, y, ANT(Math.min(220, fitSize('FORTNITE OG', 900, ANT, 4.4))), Math.min(220, fitSize('FORTNITE OG', 900, ANT, 4.4)) * .02, seg(k, 3.2, 3.95));
  }
  // C2 · S2 block
  const c = spring(k - 4.2, 220, .7), co = io(seg(k, 6.3, 6.667));
  if (c > 0 && co < 1) {
    const y = CLIP_A ? 1700 : 1050;
    ctx.save(); ctx.globalAlpha = clamp(c * 2) * (1 - co);
    txt('CHAPITRE', CX - 250, y - 340, SANS(48, 700), C.ice, { align: 'center', ls: 12 });
    txt('SAISON', CX + 250, y - 340, SANS(48, 700), C.ice, { align: 'center', ls: 12 });
    ctx.restore();
    slab('2', CX - 250, y + 80, 420, [[0, C.white], [1, C.cyan]], { sc: lerp(1.4, 1, c), alpha: clamp(c * 2) * (1 - co), side: [10, 60, 120], glow: 'rgba(57,208,255,.8)' });
    slab('2', CX + 250, y + 80, 420, [[0, C.white], [1, C.pink]], { sc: lerp(1.4, 1, spring(k - 5.65, 220, .7)), alpha: clamp(spring(k - 5.65, 220, .7) * 2) * (1 - co), side: [110, 20, 70], glow: 'rgba(255,79,163,.8)' });
    ctx.fillStyle = rgb(C.white, .7 * (1 - co)); ctx.fillRect(CX - 3, y - 380, 6, 500 * o5(seg(k, 4.4, 4.9)));
  }
}

const FEATS = ['INSTALLATION RAPIDE', 'LAUNCHER SIMPLE', 'DES SERVEURS POUR TA SQUAD'];
function d_feat(t) {
  const k = lt(t, 'feat'), i = k < FEAT_T[1] ? 0 : k < FEAT_T[2] ? 1 : 2, f = k - FEAT_T[i], dur = FEAT_T[i + 1] - FEAT_T[i];
  txt(`0${i + 1} / 03`, CX, 250, MONO(36), C.cyan, { align: 'center', ls: 8, alpha: o5(seg(k, 0, .3)) * (1 - io(seg(k, 5.95, 6.3))) });
  // card transition: slide + skew like a 3D swing, shared centre
  const enter = o5(seg(f, 0, .4)), leave = i < 2 ? io5(seg(f, dur - .28, dur)) : io(seg(f, dur - .35, dur));
  const dx = (1 - enter) * 1100 - leave * 1100, sk = ((1 - enter) - leave) * .5;
  ctx.save(); ctx.translate(CX + dx, 1000); ctx.transform(1 - Math.abs(sk) * .3, sk * .25, 0, 1, 0, 0); ctx.translate(-CX, -1000);
  ctx.globalAlpha = 1 - (i === 2 ? leave : 0);
  const title = FEATS[i].split(' ').length > 3 ? ['DES SERVEURS', 'POUR TA SQUAD'] : [FEATS[i]];
  title.forEach((s, j) => { const fs = Math.min(118, fitSize(s, 940, ANT, 4)); txt(s, CX, 470 + j * 130 - (title.length - 1) * 60, ANT(fs), C.white, { align: 'center', ls: 4 }); });
  glass(110, 640, 860, 860, 56, 1);
  if (i === 0) featInstall(f); else if (i === 1) featLauncher(f); else featSquad(f);
  ctx.restore(); ctx.globalAlpha = 1;
}
function featInstall(f) {
  const p = io(seg(f, .25, 1.25)), cx = CX, cy = 1020, R0 = 250;
  ctx.lineWidth = 34; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; circ(cx, cy, R0); ctx.stroke();
  const g = ctx.createLinearGradient(cx - R0, cy - R0, cx + R0, cy + R0); g.addColorStop(0, rgb(C.violet)); g.addColorStop(1, rgb(C.cyan));
  ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R0, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.001, p)); ctx.stroke(); ctx.lineCap = 'butt';
  glow(GLOW.cyan, cx + Math.cos(-Math.PI / 2 + TAU * p) * R0, cy + Math.sin(-Math.PI / 2 + TAU * p) * R0, 70, p > 0 && p < 1 ? .9 : 0);
  const done = spring(f - 1.3, 300, .6);
  if (done <= 0) txt(`${Math.round(p * 100)}%`, cx, cy + 50, ANT(170), C.white, { align: 'center' });
  else { ctx.save(); ctx.translate(cx, cy); ctx.scale(done, done); icon('check', 0, 0, 380, C.white); ctx.restore(); sparkBurst(301, cx, cy, f - 1.3, 14, 330, C.ice); }
  txt('INSTALLATION', cx, 1390, MONO(30), C.ice, { align: 'center', ls: 8, alpha: .8 });
}
function featLauncher(f) {
  // a recreated, illustrative launcher window (not a screenshot of the real one)
  const x = 170, y = 700, w = 740, h = 680;
  rr(x, y, w, h, 30); ctx.fillStyle = '#0c0f26'; ctx.fill();
  rr(x, y, 110, h, 30); ctx.fillStyle = '#121640'; ctx.fill();
  for (let j = 0; j < 4; j++) { rr(x + 30, y + 40 + j * 90, 50, 50, 14); ctx.fillStyle = j === 0 ? rgb(C.violet) : 'rgba(255,255,255,.12)'; ctx.fill(); }
  const hg = ctx.createLinearGradient(x + 140, y, x + w, y + 330); hg.addColorStop(0, '#3b2b9a'); hg.addColorStop(.6, '#7b5cff'); hg.addColorStop(1, '#ff4fa3');
  rr(x + 140, y + 30, w - 170, 330, 24); ctx.fillStyle = hg; ctx.fill();
  starPath(x + w - 120, y + 120, 60, 26); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  txt('CHAPITRE 2', x + 180, y + 270, ANT(66), C.white); txt('SAISON 2', x + 180, y + 330, ANT(50), C.ice);
  for (let j = 0; j < 3; j++) { rr(x + 140 + j * 192, y + 390, 172, 110, 18); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); }
  // the big PLAY button, tapped at f = 1.05
  const press = pulse(f, 1.05, .12), bx = x + 140, by = y + 540, bw = w - 170, bh = 110;
  ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(1 - press * .06, 1 - press * .06);
  rr(-bw / 2, -bh / 2, bw, bh, 26); ctx.fillStyle = rgb(C.gold); ctx.fill();
  txt('JOUER', 0, 26, ANT(70), [30, 20, 0], { align: 'center', ls: 10 }); ctx.restore();
  // finger tap ripple
  const tp = seg(f, 1.05, 1.6);
  if (f > .5) {
    const fx = lerp(x + w + 60, bx + bw * .62, o5(seg(f, .5, 1.0))), fy = lerp(y + h + 120, by + bh * .62, o5(seg(f, .5, 1.0)));
    if (tp > 0 && tp < 1) { ctx.strokeStyle = rgb(C.white, 1 - tp); ctx.lineWidth = 6; circ(fx, fy, 20 + tp * 120); ctx.stroke(); }
    circ(fx, fy, 30 - press * 6); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  }
  txt('Illustration', x + w - 10, y + h + 52, SANS(26, 500), C.ice, { align: 'right', alpha: .6 });
}
function featSquad(f) {
  const cx = CX, cy = 940, cols = [C.violet, C.cyan, C.pink, C.gold];
  for (let j = 0; j < 4; j++) {
    const x = cx - 285 + j * 190, s = spring(f - .25 - j * .16, 320, .6);
    circ(x, cy, 74); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
    if (s > 0) {
      ctx.save(); ctx.translate(x, cy); ctx.scale(s, s);
      circ(0, 0, 74); const g = ctx.createLinearGradient(0, -74, 0, 74); g.addColorStop(0, rgb(mixc(cols[j], C.white, .3))); g.addColorStop(1, rgb(cols[j])); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = 'rgba(10,10,30,.8)'; circ(0, -16, 24); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 40, 42, 30, 0, Math.PI, 0); ctx.fill();
      ctx.restore();
    }
  }
  let n = 0; for (let j = 0; j < 4; j++) if (spring(f - .25 - j * .16, 320, .6) > .5) n++;
  txt(`SQUAD ${n}/4`, cx, 1140, ANT(110), C.white, { align: 'center', ls: 6 });
  // connection bars (no numbers: they would be invented)
  for (let j = 0; j < 4; j++) { const on = f > .9 + j * .12; rr(cx - 70 + j * 40, 1300 - j * 26 - 30, 26, 30 + j * 26, 6); ctx.fillStyle = on ? rgb(C.cyan) : 'rgba(255,255,255,.15)'; ctx.fill(); }
  txt('EN LIGNE', cx + 110, 1300, MONO(34), C.cyan, { ls: 6, alpha: f > 1.4 ? 1 : 0 });
  txt('Illustration', 960, 1552, SANS(26, 500), C.ice, { align: 'right', alpha: .6 });
}

function d_jump(t) {
  const k = lt(t, 'jump');
  // speed lines streaking upward (we fall)
  const r = mulberry32(71);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const x = r() * W, sp = 2200 + r() * 2600, len = 120 + r() * 380, y = H + 400 - fract(r() + k * sp / (H + 800)) * (H + 800);
    const g = ctx.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${.25 + r() * .3})`);
    ctx.fillStyle = g; ctx.fillRect(x, y, 3, len);
  }
  ctx.restore();
  const s1 = spring(k - .05, 300, .6), s2 = spring(k - .18, 300, .6), out = io(seg(k, 1.45, 1.67));
  slab('SAUTE', CX, 560, 300, [[0, C.white], [1, C.ice]], { sc: lerp(1.6, 1, s1) * (1 + out * .6), alpha: clamp(s1 * 2) * (1 - out), side: [20, 50, 120], glow: 'rgba(0,30,80,.6)' });
  slab('DU BUS', CX, 820, 230, [[0, C.gold], [1, [255, 150, 40]]], { sc: lerp(1.6, 1, s2) * (1 + out * .6), alpha: clamp(s2 * 2) * (1 - out), side: [90, 40, 0], glow: 'rgba(0,30,80,.6)' });
}
function d_build(t) {
  const k = lt(t, 'build');
  // HUD-like blueprint frame + hit flashes for every piece
  PIECES.forEach((pc, i) => { const a = k - pc[5]; if (a > 0 && a < .3) { ctx.fillStyle = `rgba(47,168,255,${.18 * (1 - a / .3)})`; ctx.fillRect(0, 0, W, H); } });
  const s1 = spring(k - .02, 300, .6), s2 = spring(k - .15, 300, .6), out = io(seg(k, 1.75, 2.0));
  slab('POSE', CX, 430, 260, [[0, C.white], [1, C.ice]], { sc: lerp(1.5, 1, s1), alpha: clamp(s1 * 2) * (1 - out), side: [10, 50, 110], glow: 'rgba(47,168,255,.7)' });
  slab('TES MURS', CX, 650, 200, [[0, [190, 230, 255]], [1, C.build]], { sc: lerp(1.5, 1, s2), alpha: clamp(s2 * 2) * (1 - out), side: [10, 40, 90], glow: 'rgba(47,168,255,.7)' });
  // corner brackets
  ctx.strokeStyle = rgb(C.build, .8); ctx.lineWidth = 6;
  for (const [x, y, sx, sy] of [[80, 1180, 1, 1], [W - 80, 1180, -1, 1], [80, 1760, 1, -1], [W - 80, 1760, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * 70); ctx.lineTo(x, y); ctx.lineTo(x + sx * 70, y); ctx.stroke(); }
}
function d_top1(t) {
  const k = lt(t, 'top1');
  if (CLIP_B) clipFrame(CLIP_B, k, 90, 980, 900, 700, .03, o5(seg(k, .2, .6)) * (1 - io(seg(k, 2.7, 3.0))));
  // golden rays
  const cy = CLIP_B ? 640 : 900;
  ctx.save(); ctx.translate(CX, cy); ctx.rotate(k * .2); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU, L = 1400, g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    g.addColorStop(0, rgb(C.gold, .3 * clamp(k * 3))); g.addColorStop(1, rgb(C.gold, 0)); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - .06) * L, Math.sin(a - .06) * L); ctx.lineTo(Math.cos(a + .06) * L, Math.sin(a + .06) * L); ctx.closePath(); ctx.fill();
  }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  wordsC('VA CHERCHER LE', CX, cy - 330, SANS(64, 700), C.white, .0, k, 2.7, { stag: .08, lh: 90 });
  const s = spring(k - .9, 260, .6), out = io(seg(k, 2.65, 3.0));
  slab('TOP 1', CX, cy + 170, 400, [[0, [255, 250, 210]], [.5, C.gold], [1, C.goldD]], { sc: lerp(1.8, 1, s) * (1 + out * .3), alpha: clamp(s * 2) * (1 - out), side: [100, 55, 5], glow: 'rgba(255,190,60,.85)', glowB: 80, depth: 30 });
  sheen('TOP 1', CX, cy + 170, ANT(400), 8, seg(k, 1.3, 2.2), [255, 255, 255], 1, 260);
  // confetti burst on the beat (closed-form ballistic)
  const r = mulberry32(404), tc = k - .9;
  if (tc > 0) for (let i = 0; i < 140; i++) {
    const ang = -Math.PI / 2 + (r() - .5) * 2.6, v = 900 + r() * 1300, vx = Math.cos(ang) * v, vy = Math.sin(ang) * v, drag = 1.6;
    const e = (1 - Math.exp(-drag * tc)) / drag, x = CX + vx * e, y = cy + 100 + vy * e + 520 * tc * tc;
    const col = [C.gold, C.violet, C.cyan, C.pink, C.white][i % 5], sz = 10 + r() * 14, sp = r() * 12;
    if (y > H + 50) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sp * tc + i); ctx.scale(1, Math.cos(tc * (6 + sp))); ctx.fillStyle = rgb(col, 1 - out); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
  }
}
function d_isle(t) {
  const k = lt(t, 'isle');
  // letterbox breathing in, lens flare along the sun line
  const lb = io(seg(k, 0, 1)) * 120 * (1 - io(seg(k, 3.25, 3.667)));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
  const sp = proj(isleCam, isleCam.position.clone().add(skyMat.uniforms.uSun.value.clone().normalize().multiplyScalar(1000)));
  if (sp[2] < 1) {
    const vx = CX - sp[0], vy = 960 - sp[1];
    glow(SOFT.gold, sp[0], sp[1], 420, .5);
    [[.3, 40, C.pink], [.55, 70, C.violet], [.8, 26, C.cyan], [1.2, 110, C.gold], [1.5, 50, C.cyan]].forEach(([q, r, c]) => glow(SOFT[Object.keys(C).find(n => C[n] === c)], sp[0] + vx * q * 2, sp[1] + vy * q * 2, r, .35));
  }
  wordsC("L'ÎLE", CX, 1380, ANT(210), C.white, .3, k, 3.25, { ls: 20, lh: 230, shadow: 'rgba(80,20,60,.6)', blur: 40 });
  wordsC("T'ATTEND.", CX, 1600, ANT(210), [255, 200, 150], .55, k, 3.25, { ls: 20, lh: 230, shadow: 'rgba(80,20,60,.6)', blur: 40 });
}
function d_end(t) {
  const k = lt(t, 'end');
  ctx.fillStyle = `rgba(255,255,255,${.6 * Math.exp(-k / .15)})`; ctx.fillRect(0, 0, W, H);
  glow(GLOW.violet, CX, 576, 420, .45 + .05 * Math.sin(k * 2));
  wordmark(t, k, 1180);
  const tag = o5(seg(k, 1.62, 2.2));
  if (tag > 0) {
    riseC('LE OG EST DE RETOUR.', CX, 1380, SANS(64, 800), C.white, tag, 0, { ls: 6, lh: 90 });
    const lw = 520 * o5(seg(k, 1.9, 2.6)); ctx.fillStyle = rgb(C.violet); ctx.fillRect(CX - lw / 2, 1430, lw, 5);
  }
  pill('CHAPITRE 2 · SAISON 2', CX, 1560, o5(seg(k, 2.6, 3.1)), C.cyan);
  const d = o5(seg(k, 3.2, 4.0)) * .75;
  txt('Projet fan indépendant et non officiel, non affilié à Epic Games.', CX, 1760, SANS(27, 500), C.ice, { align: 'center', alpha: d });
  txt("Fortnite est une marque d'Epic Games, Inc.", CX, 1800, SANS(27, 500), C.ice, { align: 'center', alpha: d });
  // drifting sparkles around the star, never fully still
  const r = mulberry32(1212);
  for (let i = 0; i < 22; i++) { const a = r() * TAU + k * (.1 + r() * .2), rad = 260 + r() * 260; sparkle(CX + Math.cos(a) * rad, 576 + Math.sin(a) * rad * .7, 6 + r() * 10, (.3 + .7 * Math.abs(Math.sin(k * (1 + r()) + i))) * o5(seg(k, .8, 1.6)), i % 2 ? C.ice : C.lilac, k); }
  // fade to black
  const fb = io(seg(t, 58.6, 60)); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

function draw2D(t, glImg) {
  if (t < S.intro[1]) return d_intro(t);
  if (t < S.bus[1]) return d_bus(t);
  if (t < S.secret[1]) return d_secret(t);
  if (t < S.midas[1]) return d_midas(t);
  if (t < S.poi[1]) return d_poi(t);
  if (t < S.sides[1]) return d_sides(t);
  if (t < S.fade[1]) return d_fade(t, glImg);
  if (t < S.logo[1]) return d_logo(t);
  if (t < S.og[1]) return d_og(t);
  if (t < S.feat[1]) return d_feat(t);
  if (t < S.jump[1]) return d_jump(t);
  if (t < S.build[1]) return d_build(t);
  if (t < S.top1[1]) return d_top1(t);
  if (t < S.isle[1]) return d_isle(t);
  return d_end(t);
}
