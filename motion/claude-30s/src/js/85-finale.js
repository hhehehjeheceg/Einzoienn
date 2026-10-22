// =====================================================================================================
//  Scene 11 (26.25 - 30 s): cream flood from the spark, the lockup (spark + "Claude"), the prompt box
//  where "Comment puis-je vous aider ?" is typed, a light sweep on the final chord. Nothing freezes.
// =====================================================================================================
const C10 = [0, 210, 0];
const LOCK = { word: 'Claude', font: FR(200), y: 470, r: 96, gap: 44 };
function lockLayout() {
  const ww = tw(LOCK.word, LOCK.font, -4), total = 2 * LOCK.r + LOCK.gap + ww, x0 = 960 - total / 2;
  return { sx: x0 + LOCK.r, wx: x0 + 2 * LOCK.r + LOCK.gap, ww };
}
function camFinale(t) {
  const a = t - T_FLOOD;
  return { p: [C10[0], C10[1], C10[2] + 9 - .25 * a / 3.75], tgt: C10, roll: 0 };
}
function setupFinale(t) {
  setLook(true);
  const a = t - T_FLOOD, L = lockLayout(), ppu = pxPerUnit(CAM.position.z - C10[2]);
  const land = spring(a - .05, 70, .8);
  // the spark arrives from the centre of the flood (where the rush left it) to its place in the lockup
  const sx = lerp(960, L.sx, land), sy = lerp(540, LOCK.y - 70, land);
  const s = lerp(1.6, LOCK.r / (.93 * ppu), clamp(land, 0, 1.05));
  const kick = 1 - spring(t - T_FINAL, 60, .8);
  setSparkMat('clay');
  sparkAt(C10[0] + (sx - 960) / ppu, C10[1] - (sy - 540) / ppu, C10[2], s, .12 * Math.sin(t * .9), .22 * Math.sin(t * .7), -a * .35 - (1 - land) * 2 - (t > T_FINAL ? (1 - kick) * 1.05 : 0), 1, 0);
}
function bgFinale(t) {
  const a = t - T_FLOOD;
  if (a < .5) {   // the flood: cream disc from the spark over the melted drop, cleared past the farthest corner
    ground('melt', t);
    const R = 2300 * o5(seg(a, 0, .38));
    ctx.save(); circ(960, 540, R); ctx.clip(); ground('cream', t); ctx.restore();
    ring(960, 540, R, 10 * (1 - seg(a, 0, .38)), BR.white, .8 * (1 - seg(a, 0, .38)));
  } else ground('cream', t);
  // soft shadow of the spark on the paper
  const L = lockLayout(), land = spring(a - .05, 70, .8), sx = lerp(960, L.sx, land), sy = lerp(540, LOCK.y - 70, land);
  ctx.save(); ctx.filter = 'blur(26px)'; ctx.globalAlpha = .22 * land;
  ctx.beginPath(); ctx.ellipse(sx + 26, sy + 120, 88, 22, 0, 0, TAU); ctx.fillStyle = rgb([90, 50, 30]); ctx.fill();
  ctx.restore();
}
function fgFinale(t) {
  const a = t - T_FLOOD, L = lockLayout();
  flash(.85 * pulse(t, T_FLOOD, 1, .1), BR.white);
  // wordmark
  riseLetters(LOCK.word, L.wx, LOCK.y, LOCK.font, BR.ink, t, T_FLOOD + .28, .045, { lh: 220, ls: -4, align: 'left', k: 170, z: .8, rot: .12 });
  sheen(LOCK.word, L.wx, LOCK.y, LOCK.font, -4, seg(t, T_FINAL + .02, T_FINAL + .75), [255, 250, 240], .9, 260);
  sheen(LOCK.word, L.wx, LOCK.y, LOCK.font, -4, seg(t, T_FINAL + .02, T_FINAL + .75), BR.clay, .35, 520);
  // prompt box
  const p = spring(t - T_PROMPT, 120, .8), bw = 980, bh = 104, bx = 960 - bw / 2, by = 690 + (1 - p) * 70;
  if (p > .002) {
    ctx.save(); ctx.globalAlpha = clamp(p * 1.3);
    ctx.shadowColor = 'rgba(80,50,30,0.14)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    rr(bx, by, bw, bh, 30); ctx.fillStyle = '#fffdf9'; ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgb(BR.line); ctx.stroke();
    const f = SANS(34, 450), n = Math.floor(clamp((t - T_TYPE0) / (T_TYPE1 - T_TYPE0)) * PROMPT.length), s = PROMPT.slice(0, n);
    if (n === 0) txt('Écrivez votre message…', bx + 44, by + 64, f, BR.mute, { alpha: .8 });
    txt(s, bx + 44, by + 64, f, BR.ink);
    const blink = t < T_TYPE1 || Math.floor((t - T_TYPE1) / BEAT * 2) % 2 === 0;
    if (blink) { ctx.fillStyle = rgb(BR.clay); ctx.fillRect(bx + 46 + tw(s, f), by + 30, 3, 46); }
    // send button: lights up when the text is complete, then a soft ripple on the final chord
    const on = o5(seg(t, T_TYPE1, T_TYPE1 + .2)), cx = bx + bw - 58, cy = by + bh / 2;
    circ(cx, cy, 30); ctx.fillStyle = rgb(mixc(BR.line, BR.clay, on)); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy - 11); ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx, cy - 12); ctx.lineTo(cx + 10, cy - 2); ctx.stroke();
    ring(cx, cy, 30 + 60 * o5(seg(t, T_FINAL, T_FINAL + .7)), 2, BR.clay, .6 * (1 - seg(t, T_FINAL, T_FINAL + .7)));
    ctx.restore();
  }
  rise('CLAUDE.AI', 960, 868, SANS(20, 600), BR.mute, spring(t - T_TYPE1 + .2, 170, .85), 0, { lh: 30, align: 'center', ls: 8, rot: 0 });
  // sparkles around the spark on the final chord
  const sp = sparkScreen(), r = mulberry32(62);
  for (let i = 0; i < 7; i++) {
    const an = r() * TAU, d = 120 + r() * 70, t0 = T_FINAL + .05 + r() * .5;
    sparkle(sp.x + Math.cos(an) * d, sp.y + Math.sin(an) * d, 10 + r() * 8, t * 1.2 + i, .9 * Math.sin(Math.PI * seg(t, t0, t0 + .55)), BR.clay);
  }
  vignette(.12, [120, 80, 50]);
}
SCENES.push({ t0: T_FLOOD, cam: camFinale, setup: setupFinale, bg: bgFinale, fg: fgFinale });
CUTS.push(T_FLOOD);
SUBS.push([T_FLOOD, T_FLOOD + .7, 10], [T_FLOOD + .7, T, 3], [T_FINAL, T_FINAL + .7, 6]);
