// =====================================================================================================
//  The frame: which scene is on screen at time t, then the post (motion blur, shake, bloom, chroma, grain)
//  and the preview player. The render only ever calls renderFrame(f); the player calls seek(t).
// =====================================================================================================
let JIT = [0, 0];   // sub-pixel camera jitter per sub-frame: the sub-frame average is also the anti-aliasing
const HALTON = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
function sceneAt(t) { let s = SCENES[0]; for (const S of SCENES) if (t >= S.t0) s = S; return s; }

function draw(t) {
  CUR_T = t; AURA_A = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  for (const g of GROUPS) g.visible = false;
  const S = sceneAt(t), c = S.cam(t);
  camLook(c.p, c.tgt, c.roll || 0, c.fov || 30);
  if (JIT[0] || JIT[1]) CAM.setViewOffset(W, H, JIT[0], JIT[1], W, H); else if (CAM.view && CAM.view.enabled) CAM.clearViewOffset();
  setLook(false); setSparkMat('clay');
  S.setup(t);
  paintBG(() => S.bg(t));
  render3D();
  S.fg(t);
}

// ------------------------------------------------------------------ post
function shake(t) {
  let dx = 0, dy = 0;
  for (const [b, a] of IMPACTS) if (t >= b && t < b + .6) { const e = a * Math.exp(-(t - b) / .09); dx += e * Math.sin(TAU * 23 * (t - b)); dy += e * Math.cos(TAU * 17 * (t - b) + 1); }
  for (const w of T_BURST) if (t >= w && t < w + .2) { const e = 5 * Math.exp(-(t - w) / .05); dx += e * Math.sin(TAU * 29 * (t - w)); dy += e * Math.cos(TAU * 31 * (t - w)); }
  return { dx, dy };
}
const bloomAmt = t => (t < T_FLOOD ? .5 - .22 * ss(seg(t, T_CLAUDE, T_CLAUDE + .5)) * (1 - seg(t, 3.6, 3.8)) : .16) + .5 * pulse(t, T_IGN, 1, .4) + .6 * pulse(t, T_DROP, 1, .5) + .4 * pulse(t, T_FLOOD, 1, .3);
function caAmt(t) {
  let a = pulse(t, T_IGN, .008, .18) + pulse(t, T_DROP, .016, .25) + pulse(t, T_FLOOD, .008, .2);
  for (const w of T_BURST) a += pulse(t, w, .006, .07);
  return a;
}
const BA = mk(480, 270), bax = BA.g, BB = mk(480, 270), bbx = BB.g;
function bloom(amt) {
  if (amt <= .001) return;
  bax.globalCompositeOperation = 'copy'; bax.drawImage(cv, 0, 0, 480, 270);
  bbx.globalCompositeOperation = 'copy'; bbx.filter = 'brightness(0.9) contrast(2.4) saturate(1.3) blur(8px)'; bbx.drawImage(BA.c, 0, 0); bbx.filter = 'none';
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalCompositeOperation = 'screen'; main.globalAlpha = Math.min(1, amt);
  main.drawImage(BB.c, 0, 0, W, H); main.restore();
}
const CA1 = mk(W, H), ca1 = CA1.g, CA2 = mk(W, H), ca2 = CA2.g;
function chroma(a) {
  if (a < .0006) return;
  ca1.globalCompositeOperation = 'copy'; ca1.drawImage(cv, 0, 0);
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalCompositeOperation = 'copy'; main.fillStyle = '#000'; main.fillRect(0, 0, W, H);
  main.globalCompositeOperation = 'lighter';
  [[2, '#ff0000'], [1, '#00ff00'], [0, '#0000ff']].forEach(([m, col]) => {
    const s = 1 + a * m;
    ca2.setTransform(s, 0, 0, s, 960 * (1 - s), 540 * (1 - s)); ca2.globalCompositeOperation = 'copy'; ca2.drawImage(CA1.c, 0, 0);
    ca2.setTransform(1, 0, 0, 1, 0, 0); ca2.globalCompositeOperation = 'multiply'; ca2.fillStyle = col; ca2.fillRect(0, 0, W, H);
    main.drawImage(CA2.c, 0, 0);
  });
  main.restore();
}
const GR = [0, 1, 2].map(k => {
  const { c, g } = mk(256, 256), im = g.createImageData(256, 256), r = mulberry32(100 + k);
  for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - .5) * 200; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
});
let GRP = null;
function grain(f, a) {
  if (!GRP) GRP = GR.map(c => main.createPattern(c, 'repeat'));
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = 'overlay'; main.globalAlpha = a;
  main.translate(-((f * 53) % 256), -((f * 97) % 256));
  main.fillStyle = GRP[f % 3]; main.fillRect(0, 0, W + 256, H + 256);
  main.restore();
}
function composite(ts, alpha) {
  const { dx, dy } = shake(ts), s = (1 + Math.max(Math.abs(dx) / 960, Math.abs(dy) / 540) * 1.2) * (1 + kickEnv(ts) * (inDrop(ts) ? .018 : .008));
  main.globalAlpha = alpha; main.globalCompositeOperation = 'source-over';
  main.setTransform(s, 0, 0, s, 960 * (1 - s) + dx, 540 * (1 - s) + dy);
  main.drawImage(scr, 0, 0);
  main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1;
}
function post(t, f) { zoomBlur(zoomAmt(t)); glitch(glitchAmt(t), f); bloom(bloomAmt(t) + (inDrop(t) ? .18 * kickEnv(t) : 0)); chroma(caAmt(t) + (inDrop(t) ? .002 * kickEnv(t) : 0)); grain(f, t < T_FLOOD ? .065 : .04); }

// motion-blur budget: sub-frames per output frame, more where things move fast; never blur across a hard cut
const SUBQ = new URLSearchParams(location.search), SUB_MIN = +(SUBQ.get('submin') || 3), SUB_MAX = +(SUBQ.get('submax') || 9);   // small renders need fewer samples
function subN(t) { let n = SUB_MIN; for (const [a, b, k] of SUBS) if (t >= a && t < b) n = Math.max(n, k); return Math.min(n, SUB_MAX); }
window.renderFrame = f => {
  CUR_F = f; const t0 = f / FPS, N = subN(t0);
  let lo = 0, hi = T - 1e-6;
  for (const c of CUTS) { if (c <= t0 + 1e-9) lo = Math.max(lo, c); else hi = Math.min(hi, c - 1e-4); }
  for (let i = 0; i < N; i++) {
    const ts = clamp(t0 + ((i + .5) / N - .5) * SHUTTER / FPS, lo, hi);
    JIT = [HALTON(i + 1, 2) - .5, HALTON(i + 1, 3) - .5];
    draw(ts); composite(ts, 1 / (i + 1));
  }
  JIT = [0, 0];
  post(t0, f);
  return N;
};
window.seek = t => { t = clamp(t, 0, T - 1e-6); CUR_F = Math.round(t * FPS); draw(t); composite(t, 1); post(t, CUR_F); };

// ------------------------------------------------------------------ preview player (not used while rendering)
let playing = false, tcur = 0, last = null;
const pp = document.getElementById('pp'), sc = document.getElementById('sc'), tc = document.getElementById('tc'), au = document.getElementById('au');
let audioOk = false; au.addEventListener('canplay', () => { audioOk = true; }); au.addEventListener('error', () => { audioOk = false; });
function setPlay(v) {
  playing = v; pp.textContent = v ? '❚❚' : '▶';
  if (audioOk) { if (v) { au.currentTime = tcur; au.play().catch(() => {}); } else au.pause(); }
}
function tick(now) {
  if (playing) {
    if (audioOk && !au.paused) tcur = au.currentTime;
    else if (last !== null) tcur += (now - last) / 1000;
    if (tcur >= T) { tcur = 0; if (audioOk) { au.currentTime = 0; au.play().catch(() => {}); } }
  }
  last = now;
  window.seek(tcur);
  sc.value = Math.round(tcur * FPS); tc.textContent = tcur.toFixed(2) + ' s / ' + T + ' s';
  requestAnimationFrame(tick);
}
function jump(t) { tcur = clamp(t, 0, T - 1 / FPS); if (audioOk) au.currentTime = tcur; }
pp.onclick = () => setPlay(!playing);
sc.oninput = () => jump(sc.value / FPS);
addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); setPlay(!playing); }
  else if (e.code === 'ArrowRight') jump(tcur + (e.shiftKey ? .5 : 1 / FPS));
  else if (e.code === 'ArrowLeft') jump(tcur - (e.shiftKey ? .5 : 1 / FPS));
  else if (e.code === 'KeyR') { jump(0); setPlay(true); }
});
