// =====================================================================================================
//  Scene 4 (6.5625 - 7.5 s): the word burst on 8th notes, then everything implodes into a point before the drop.
//  Hard cut in. Each word owns a full-frame colour, a typeface and a place for the spark.
// =====================================================================================================
const C4 = [0, 30, 0];
const BW = [   // background, text colour, font, spark material, spark offset (world), spin direction
  { bg: BR.clay, fg: BR.ink, font: FR(250), mat: 'cream', off: [2.35, 1.05], dir: 1 },
  { bg: BR.cream, fg: BR.clay, font: SANS(230, 800), mat: 'clay', off: [-2.5, -1.0], dir: -1 },
  { bg: BR.ink, fg: BR.cream, font: ISER(300), mat: 'clay', off: [2.75, 1.0], dir: 1 },
  { bg: null, fg: BR.cream, font: FR(250), mat: 'clay', off: [0, 0], dir: -1 },
];
const SPARK_MATS = { clay: MAT.clay, cream: MAT.cream };
let sparkMat = 'clay';
function setSparkMat(k) {
  if (k === sparkMat) return;
  sparkMat = k; RAYS.forEach(R => { R.m.material = SPARK_MATS[k]; }); HUB.material = SPARK_MATS[k];
}
const burstIdx = t => t < T_BURST[1] ? 0 : t < T_BURST[2] ? 1 : t < T_BURST[3] ? 2 : 3;
const T_SUCK = T_BURST[3] + .12;   // the collapse starts

function camBurst(t) {
  const k = burstIdx(t), u = t - T_BURST[k];
  const z = 7.2 - .5 * o5(u / .22) - 1.4 * inn(seg(t, T_SUCK, T_DROP));
  return { p: [C4[0] + .2 * (k % 2 ? -1 : 1) * (1 - o5(u / .2)), C4[1], C4[2] + z], tgt: C4, roll: (k % 2 ? -1 : 1) * .03 * (1 - o5(u / .2)) };
}
function setupBurst(t) {
  const k = burstIdx(t), B = BW[k], u = t - T_BURST[k], suck = inn(seg(t, T_SUCK, T_DROP - .02));
  setSparkMat(B.mat);
  const p = spring(u, 260, .7);
  const ox = lerp(BW[Math.max(0, k - 1)].off[0], B.off[0], k ? p : 1) * (1 - suck), oy = lerp(BW[Math.max(0, k - 1)].off[1], B.off[1], k ? p : 1) * (1 - suck);
  const s = (k === 3 ? .75 : .58) * (1 + .18 * pulse(t, T_BURST[k], 1, .1)) * (1 - suck);
  sparkAt(C4[0] + ox, C4[1] + oy, C4[2] + .3, s, .25 * Math.sin(t * 3), .4 * Math.sin(t * 2.2), B.dir * (t - T_BURST[0]) * 4.2 + suck * 6, 1, 0);
}
function bgBurst(t) {
  const k = burstIdx(t), B = BW[k], suck = seg(t, T_SUCK, T_DROP - .03);
  if (B.bg) { ctx.fillStyle = rgb(B.bg); ctx.fillRect(0, 0, W, H); }
  else {   // last word: a warm radial ground that collapses to black with the implosion
    const g = ctx.createRadialGradient(960, 540, 0, 960, 540, 1200 * (1 - .85 * inn(suck)) + 1);
    g.addColorStop(0, rgb(mixc(BR.clay, HU.amber, .4))); g.addColorStop(.45, rgb(BR.clay)); g.addColorStop(1, rgb(mixc(BR.clay, BR.ink, .65)));
    ctx.fillStyle = '#050404'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1 - ss(seg(suck, .55, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  // a thin frame of the previous colour wipes off on each cut (the new colour grows from the centre line)
  if (k > 0 && k < 3) {
    const u = o5(seg(t, T_BURST[k], T_BURST[k] + .09)), P = BW[k - 1].bg;
    ctx.fillStyle = rgb(P); ctx.fillRect(0, 0, W, H * .5 * (1 - u)); ctx.fillRect(0, H - H * .5 * (1 - u), W, H * .5 * (1 - u));
  }
}
function fgBurst(t) {
  const k = burstIdx(t), B = BW[k], u = t - T_BURST[k], suck = inn(seg(t, T_SUCK, T_DROP - .02));
  const s = (1 + .16 * (1 - o5(u / .14))) * (1 - .97 * suck), word = BURSTW[k];
  ctx.save(); ctx.translate(960, 560); ctx.scale(s, s); ctx.rotate(B.dir * .02 * (1 - o5(u / .14)));
  if (k === 3) ctx.filter = `blur(${(suck * 14).toFixed(1)}px)`;
  txt(word, 0, B.font.includes('InstrSerif') ? 70 : 85, B.font, B.fg, { align: 'center', ls: B.font.includes('InterV') ? -9 : -4, alpha: 1 - ss(seg(suck, .7, 1)) });
  ctx.filter = 'none';
  ctx.restore();
  // little marks: the counter and a tick under the word
  txt(`0${k + 4}`, 960, 820, MONO(22), B.fg, { align: 'center', ls: 4, alpha: .55 * (1 - suck) });
  const lw = 160 * o5(u / .15) * (1 - suck);
  ctx.fillStyle = rgb(B.fg, .7); ctx.fillRect(960 - lw / 2, 790, lw, 3);
  shock(t, T_BURST[k], 960, 560, { R: 1100, w: 6, life: .3, a: .35, col: B.fg, col2: B.fg });
  // implosion: streaks converge, a hot dot remains
  streaks(960, 540, t, T_SUCK - .02, T_DROP - T_SUCK, true, { n: 80, R: 1250, L: 300, a: .8, seed: 9 });
  glow(GLOW.amber, 960, 540, 40 + 260 * suck, .9 * suck);
  glow(GLOW.white, 960, 540, 18 + 30 * suck, suck);
}
SCENES.push({ t0: T_BURST[0], cam: camBurst, setup: setupBurst, bg: bgBurst, fg: fgBurst });
CUTS.push(T_BURST[0], T_BURST[1], T_BURST[2], T_BURST[3], T_DROP);
SUBS.push([T_BURST[0], T_SUCK, 6], [T_SUCK, T_DROP, 12]);
