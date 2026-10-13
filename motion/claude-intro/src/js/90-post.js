// =====================================================================================================
//  Frame composition + post: motion blur, camera shake, bloom, chromatic aberration, grain.
// =====================================================================================================
const IMPACTS = [[16.0, 14], [28.0, 10], [36.0, 22]];    // [time, shake in px]
function shake(t) {
  let dx = 0, dy = 0;
  for (const [b, a] of IMPACTS) if (t >= b && t < b + .7) { const e = a * Math.exp(-(t - b) / .1); dx += e * Math.sin(TAU * 23 * (t - b)); dy += e * Math.cos(TAU * 17 * (t - b) + 1); }
  for (const w of BURST_T) if (t >= w && t < w + .2) { const e = 4 * Math.exp(-(t - w) / .05); dx += e * Math.sin(TAU * 29 * (t - w)); dy += e * Math.cos(TAU * 31 * (t - w)); }
  return { dx, dy };
}
const bloomAmt = t => .5 * seg(t, 16.05, 16.5) * (1 - seg(t, 27.8, 28.0)) + .3 * ss(seg(t, 28, 29)) * (1 - seg(t, 35.9, 36.0)) + .4 * ss(seg(t, 36, 36.3)) * (1 - ss(seg(t, 36.4, 38.5))) + .07 * ss(seg(t, 38.5, 39));
function caAmt(t) {
  let a = pulse(t, 16.0, .011, .2) + pulse(t, 28.0, .009, .2) + pulse(t, 36.0, .016, .25);
  for (const w of BURST_T) a += pulse(t, w, .005, .07);
  return a;
}
const BA = mk(480, 270), bax = BA.g, BB = mk(480, 270), bbx = BB.g;
function bloom(amt) {
  if (amt <= .001) return;
  bax.globalCompositeOperation = 'copy'; bax.drawImage(cv, 0, 0, 480, 270);
  bbx.globalCompositeOperation = 'copy'; bbx.filter = 'contrast(2.0) brightness(1.1) saturate(1.35) blur(7px)'; bbx.drawImage(BA.c, 0, 0); bbx.filter = 'none';
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalCompositeOperation = 'screen'; main.globalAlpha = amt;
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
function grain(f) {
  if (!GRP) GRP = GR.map(c => main.createPattern(c, 'repeat'));
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = 'overlay'; main.globalAlpha = .07;
  main.translate(-((f * 53) % 256), -((f * 97) % 256));
  main.fillStyle = GRP[f % 3]; main.fillRect(0, 0, W + 256, H + 256);
  main.restore();
}
function composite(ts, alpha) {
  const { dx, dy } = shake(ts), s = 1 + Math.max(Math.abs(dx) / 960, Math.abs(dy) / 540);
  main.globalAlpha = alpha; main.globalCompositeOperation = 'source-over';
  main.setTransform(s, 0, 0, s, 960 * (1 - s) + dx, 540 * (1 - s) + dy);
  main.drawImage(scr, 0, 0);
  main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1;
}
function post(t, f) { bloom(bloomAmt(t)); chroma(caAmt(t)); grain(f); }
// motion-blur budget: more sub-frames where things move fast
function subN(t) {
  for (const [a, b, n] of SUBS) if (t >= a && t < b) return n;
  return 4;
}
window.renderFrame = f => {
  CUR_F = f; const t0 = f / FPS, N = subN(t0);
  for (let i = 0; i < N; i++) {
    const ts = clamp(t0 + ((i + .5) / N - .5) * SHUTTER / FPS, 0, T - 1e-6);
    draw(ts); composite(ts, 1 / (i + 1));
  }
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
