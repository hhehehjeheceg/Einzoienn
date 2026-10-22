// =====================================================================================================
//  Boot: load every font, compile the shaders once, expose the sound cues, start the preview player.
// =====================================================================================================
(async () => {
  const faces = [FR(100, 600), FR(100, 400), SANS(100, 600), SANS(100, 800), MONO(20), ISER(100), GREETF(100)];
  await Promise.all(faces.map(f => document.fonts.load(f, 'BonjourÉé’àç0123456789')));
  await Promise.all(['こんにちは', '안녕하세요', '你好', 'مرحبا', 'नमस्ते', 'שלום', 'Привет', 'Γειά σου'].map(s => document.fonts.load(GREETF(100), s)));
  await document.fonts.ready;
  if (typeof initTextures === 'function') initTextures();
  R3.compile(S3, CAM);
  window.CUES = typeof buildCues === 'function' ? buildCues() : [];
  window.ready = true;
  if (!RENDER) { const q = new URLSearchParams(location.search).get('t'); if (q) tcur = +q; requestAnimationFrame(tick); }
})();
