// =====================================================================================================
//  Gameplay clips (optional), compositor, post (punch, shake, whip blur, bloom, vignette, grain),
//  motion-blur accumulation and the sound cue list.
// =====================================================================================================
// ---- gameplay clips: assets/gameplay/clips.json = {"A": {"dir": "...", "n": 180, "fps": 30}, "B": {...}}
const clipCache = new Map();
function clipImg(clip, k) {
  const i = clamp(Math.floor(k * clip.fps), 0, clip.n - 1);
  return clipCache.get(`${clip.dir}/f_${String(i + 1).padStart(4, '0')}.jpg`);
}
async function prefetchClips(t) {
  const want = [];
  if (CLIP_A && inS(t, 'og')) want.push([CLIP_A, lt(t, 'og')]);
  if (CLIP_B && inS(t, 'top1')) want.push([CLIP_B, lt(t, 'top1')]);
  await Promise.all(want.map(([clip, k]) => {
    const i = clamp(Math.floor(k * clip.fps), 0, clip.n - 1), src = `${clip.dir}/f_${String(i + 1).padStart(4, '0')}.jpg`;
    if (clipCache.has(src)) return null;
    return new Promise(res => { const im = new Image(); im.onload = () => { clipCache.set(src, im); if (clipCache.size > 400) clipCache.delete(clipCache.keys().next().value); res(); }; im.onerror = res; im.src = src; });
  }));
}
function clipFrame(clip, k, x, y, w, h, rot, a) {
  const im = clipImg(clip, k); if (!im || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.scale(lerp(.92, 1, a), lerp(.92, 1, a));
  ctx.shadowColor = 'rgba(123,92,255,.7)'; ctx.shadowBlur = 60; rr(-w / 2, -h / 2, w, h, 36); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.save(); rr(-w / 2, -h / 2, w, h, 36); ctx.clip();
  const s = Math.max(w / im.width, h / im.height) * (1.04 + k * .01);
  ctx.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s); ctx.restore();
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, rgb(C.violet)); g.addColorStop(1, rgb(C.cyan));
  ctx.lineWidth = 6; ctx.strokeStyle = g; rr(-w / 2, -h / 2, w, h, 36); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---- hits: [time, strength] drive shake, chroma and flashes; cuts get a whip zoom-blur
const HITS = [[S.secret[0], 1], [DROP, 1.3], [S.top1[0] + .9, .8], [S.jump[0], .5], [S.sides[0] + .28, .3], [S.sides[0] + 1.0, .3], [S.midas[0], .4], [S.end[0], .4], [S.og[0] + 3.0, .25]]
  .concat(PIECES.map(p => [S.build[0] + p[5], .22]));
const CUTS = [S.bus[0], S.secret[0], S.sides[0], S.fade[0], S.logo[0], S.og[0], S.feat[0], S.jump[0], S.build[0], S.top1[0], S.isle[0], S.end[0]];
const hitAt = t => HITS.reduce((s, [b, a]) => s + a * pulse(t, b, .16), 0);
const whipAt = t => CUTS.reduce((s, c) => s + Math.exp(-Math.abs(t - c) / .05), 0);

const COMP = mk(PW, PH), BL = mk(PW / 4, PH / 4), VIG = mk(PW, PH);
{ const g = VIG.g, gr = g.createRadialGradient(PW / 2, PH * .48, PH * .25, PW / 2, PH / 2, PH * .75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, 0, PW, PH); }

function frame(t) {
  const glRes = glShot(t);
  const c = COMP.g; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  if (glRes) c.drawImage(glc, 0, 0); else { c.fillStyle = rgb(C.night); c.fillRect(0, 0, PW, PH); }
  L2D.g.setTransform(1, 0, 0, 1, 0, 0); L2D.g.clearRect(0, 0, PW, PH); L2D.g.setTransform(RS, 0, 0, RS, 0, 0);
  ctx = L2D.g; draw2D(t, glc);
  c.drawImage(L2D.c, 0, 0);
  // camera on the composite
  const h = hitAt(t), z = 1 + beatPunch(t) + h * .05, sx = (hash(Math.floor(t * 60) * 3 + 1) - .5) * 46 * h * RS, sy = (hash(Math.floor(t * 60) * 3 + 2) - .5) * 46 * h * RS;
  main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1; main.globalCompositeOperation = 'source-over'; main.filter = 'none';
  main.fillStyle = '#000'; main.fillRect(0, 0, PW, PH);
  main.save(); main.translate(PW / 2 + sx, PH / 2 + sy); main.rotate((hash(Math.floor(t * 60) * 7) - .5) * .02 * h); main.scale(z, z); main.drawImage(COMP.c, -PW / 2, -PH / 2); main.restore();
  // whip zoom-blur around cuts
  const wp = Math.min(1, whipAt(t));
  if (wp > .02) for (let j = 1; j <= 4; j++) { const s = 1 + j * .028 * wp; main.globalAlpha = .22 * wp; main.drawImage(COMP.c, PW / 2 - PW * s / 2, PH / 2 - PH * s / 2, PW * s, PH * s); }
  main.globalAlpha = 1;
  // chroma ghost on hits
  if (h > .05) { main.globalCompositeOperation = 'screen'; main.globalAlpha = Math.min(.35, h * .3); main.drawImage(COMP.c, 14 * h * RS, 0); main.drawImage(COMP.c, -14 * h * RS, 0); main.globalAlpha = 1; main.globalCompositeOperation = 'source-over'; }
  // bloom
  BL.g.filter = `blur(${10 * RS}px)`; BL.g.drawImage(main.canvas, 0, 0, PW / 4, PH / 4); BL.g.filter = 'none';
  main.globalCompositeOperation = 'screen'; main.globalAlpha = .28; main.drawImage(BL.c, 0, 0, PW, PH);
  main.globalAlpha = 1; main.globalCompositeOperation = 'source-over';
  main.drawImage(VIG.c, 0, 0);
  // grain
  main.globalCompositeOperation = 'overlay'; main.globalAlpha = .1;
  const gt = GRAIN[((Math.floor(t * FPS) % 8) + 8) % 8]; for (let y = 0; y < PH; y += 256) for (let x = 0; x < PW; x += 256) main.drawImage(gt, x, y);
  main.globalAlpha = 1; main.globalCompositeOperation = 'source-over';
}

// ---- motion blur: SUB samples spread over a 180 deg shutter, never across a hard cut
const ACC = mk(PW, PH);
const SUB = +(new URLSearchParams(location.search).get('sub') || 3), SHUT = .5;
async function renderFrame(f) {
  const tc = f / FPS;
  if (SUB <= 1) { await prefetchClips(tc); frame(tc); return; }
  const cut = CUTS.find(c => Math.abs(c - tc) < 1 / FPS);
  for (let i = 0; i < SUB; i++) {
    let t = Math.max(0, (f + ((i + .5) / SUB - .5) * SHUT) / FPS);
    if (cut !== undefined) t = tc >= cut ? Math.max(t, cut) : Math.min(t, cut - 1e-4);
    await prefetchClips(t); frame(t);
    ACC.g.globalAlpha = 1 / (i + 1); ACC.g.drawImage(out_cv, 0, 0);
  }
  ACC.g.globalAlpha = 1; main.drawImage(ACC.c, 0, 0);
}

// ---- sound cues (read by audio.py through render.mjs cues)
const CUES = [];
{
  const q = (t, type, g = 1) => CUES.push({ t: +t.toFixed(4), type, g });
  for (let i = 0; i < 4; i++) q(.8 + i * .14 + .55, 'flap', .7);
  q(2.0, 'shimmer', .45);
  q(3.0, 'riser_short', .8); q(S.bus[0], 'whoosh_big', 1); q(S.bus[0] + .1, 'wind', .6);
  q(S.bus[0] + .25, 'pop', .5); q(S.bus[0] + 1.7, 'whoosh', .55); q(S.bus[0] + 1.85, 'pop', .55); q(S.bus[0] + 3.1, 'whoosh', .5); q(S.bus[0] + 3.4, 'impact_soft', .45);
  q(S.secret[0] - .3, 'swipe', .8); q(S.secret[0], 'stamp', 1);
  for (let i = 0; i < 26; i++) q(S.secret[0] + .55 + i * .9 / 26, 'type', .3);
  q(S.secret[0] + 1.6, 'liquid', .8); q(S.midas[0], 'shimmer', 1); q(S.midas[0] + .05, 'impact_soft', .7);
  CARD_T.forEach(c => { q(S.poi[0] + c, 'whoosh', .5); q(S.poi[0] + c + .12, 'pop', .7); });
  q(S.sides[0], 'whoosh_big', .9); q(S.sides[0] + .28, 'impact_soft', .7); q(S.sides[0] + .82, 'pop', .8); q(S.sides[0] + 1.0, 'impact_soft', .7); q(S.sides[0] + 1.8, 'pop', .5);
  q(S.sides[1] - .3, 'swipe', .6);
  q(S.fade[0] + 3.0, 'shatter', .9); q(DROP, 'riser', 1); q(DROP, 'impact_big', 1.2); q(DROP + .1, 'shimmer', .9);
  q(S.og[0], 'whoosh_big', .8); q(S.og[0] + .1, 'pop', .6); q(S.og[0] + 3.0, 'impact_soft', .6); q(S.og[0] + 4.2, 'impact_soft', .55); q(S.og[0] + 5.65, 'impact_soft', .55);
  for (let i = 0; i < 3; i++) q(S.feat[0] + FEAT_T[i], 'whoosh', .7);
  q(S.feat[0] + 1.3, 'success', .7); q(S.feat[0] + 2 + 1.05, 'tap', .9);
  for (let j = 0; j < 4; j++) q(S.feat[0] + 4 + .25 + j * .16, 'pop', .6);
  q(S.jump[0], 'whoosh_big', 1); q(S.jump[0], 'wind', 1);
  PIECES.forEach(p => q(S.build[0] + p[5], 'build', .9));
  q(S.top1[0], 'whoosh', .6); q(S.top1[0] + .9, 'impact_big', 1); q(S.top1[0] + .93, 'confetti', .8);
  q(S.isle[0], 'whoosh_soft', .6); q(S.isle[0] + .2, 'waves', .6);
  q(S.end[0], 'impact_soft', .8); q(S.end[0] + .1, 'shimmer', .8); q(S.end[0] + 1.62, 'pop', .5);
}
window.CUES = CUES; window.VO = VO; window.S = S;
