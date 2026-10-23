// ---- boot: fonts, optional gameplay clips, preview HUD (Space play/pause, arrows frame step, R replay)
window.seek = async t => { await prefetchClips(t); frame(t); };
window.renderFrame = renderFrame;
(async () => {
  await document.fonts.ready;
  await Promise.all(['Anton', 'InterV', 'Unbounded', 'JBM'].map(f => document.fonts.load(`40px ${f}`)));
  try {
    const r = await fetch('assets/gameplay/clips.json'); if (r.ok) { const j = await r.json(); CLIP_A = j.A || null; CLIP_B = j.B || null; }
  } catch (e) { /* no clips: the coded 3D shots play instead */ }
  await window.seek(0);
  window.ready = true;
  if (RENDER) return;
  const au = document.getElementById('au'), sc = document.getElementById('sc'), tc = document.getElementById('tc'), pp = document.getElementById('pp');
  let playing = false, t0 = 0, tStart = 0, cur = 0;
  const show = async t => { cur = clamp(t, 0, T - 1 / FPS); sc.value = Math.round(cur * FPS); tc.textContent = cur.toFixed(2) + ' s'; await window.seek(cur); };
  const loop = async now => { if (!playing) return; const t = tStart + (now - t0) / 1000; if (t >= T) { playing = false; pp.textContent = '▶'; return; } await show(t); requestAnimationFrame(loop); };
  const play = () => { playing = true; pp.textContent = '❚❚'; t0 = performance.now(); tStart = cur; au.currentTime = cur; au.play().catch(() => {}); requestAnimationFrame(loop); };
  const pause = () => { playing = false; pp.textContent = '▶'; au.pause(); };
  pp.onclick = () => playing ? pause() : play();
  sc.oninput = () => { pause(); show(sc.value / FPS); };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    if (e.code === 'ArrowRight') { pause(); show(cur + 1 / FPS); }
    if (e.code === 'ArrowLeft') { pause(); show(cur - 1 / FPS); }
    if (e.code === 'KeyR') { pause(); cur = 0; play(); }
  });
})();
