// =====================================================================================================
//  Boot: load every font, compute the layouts, expose the sound cues, start the preview player.
// =====================================================================================================
(async () => {
  const faces = [SANS(100, 600), SANS(100, 450), SANS(100, 700), SANS(100, 800), SER(100), MONO(20), FRA(100), UNB(100), SYN(100), BRI(100), ANT(100), CAV(100)];
  await Promise.all(faces.map(f => document.fonts.load(f, 'BonjourÉé’²−0123456789')));
  await document.fonts.ready;
  initLayoutABC();
  if (typeof initLayoutD === 'function') initLayoutD();
  if (typeof initLayoutE === 'function') initLayoutE();
  if (typeof initLayoutFGH === 'function') initLayoutFGH();
  window.CUES = typeof buildCues === 'function' ? buildCues() : [];
  window.ready = true;
  if (!RENDER) { const q = new URLSearchParams(location.search).get('t'); if (q) tcur = +q; requestAnimationFrame(tick); }
})();
