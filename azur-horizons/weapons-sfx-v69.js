/* AZUR v69 — bruitages d'armes refaits.
 * Chaque tir est composé en couches : claquement (transitoire très court),
 * corps (bruit filtré au timbre de l'arme), coup sourd dans les graves et queue
 * d'écho qui s'éloigne. Les tirs lointains perdent leurs aigus. Bruits
 * mécaniques : pompe du fusil à pompe, culasse du fusil de précision, chargeur
 * qui sort et rentre au rechargement. Volume réglé par le curseur « Effets ». */
(function (root) {
  'use strict';
  const A = root.AZAudio?.prototype;
  if (!A || !A.report) return;
  // [fréquence du corps, durée, grave, claquement, écho, mécanique]
  const SPEC = {
    pistol: [1700, .09, 120, .9, .35], revolver: [1150, .2, 85, 1.1, .7], smg: [2100, .06, 140, .7, .25], rifle: [1500, .1, 100, 1, .45],
    burst: [1800, .09, 110, .9, .4], tactical: [900, .16, 70, 1.1, .6, 'pump'], shotgun: [700, .22, 58, 1.3, .8, 'pump'],
    dmr: [1300, .16, 80, 1.2, .8, 'bolt'], sniper: [1100, .26, 62, 1.5, 1.2, 'bolt'], launcher: [380, .32, 45, .8, 1, 'tube']
  };
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  A.v69Noise = function (t, dur, vol, type, freq, q, pan, wet, far) {
    if (!this.noiseBuffer) return;
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (!this.configureVoice(src)) return;
    src.buffer = this.noiseBuffer; f.type = type; f.frequency.setValueAtTime(freq * far, t); f.Q.value = q || .7;
    env(g, t, .002, vol, dur); src.connect(f); f.connect(g); this.route(g, pan, this.sfxBus);
    if (wet && this.reverb) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.reverb); }
    src.start(t, Math.random() * 1.2); src.stop(t + dur + .05);
  };
  A.v69Thump = function (t, f0, dur, vol, pan) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    if (!this.configureVoice(o)) return;
    o.frequency.setValueAtTime(f0 * 2.2, t); o.frequency.exponentialRampToValueAtTime(f0 * .45, t + dur);
    env(g, t, .003, vol, dur); o.connect(g); this.route(g, pan, this.sfxBus); o.start(t); o.stop(t + dur + .05);
  };
  A.v69Click = function (t, f, vol, pan) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    if (!this.configureVoice(o)) return;
    o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .5, t + .03);
    env(g, t, .001, vol, .035); o.connect(g); this.route(g, pan, this.sfxBus); o.start(t); o.stop(t + .06);
  };
  A.report = function (kind, v) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.settings.sfx) return;
    const s = SPEC[kind] || SPEC.pistol, t = this.ctx.currentTime + .002, vol = Math.min(1, v.vol) * .8, pan = v.pan || 0;
    const far = Math.max(.25, 1 - (v.d || 0) / 260), det = 1 + (Math.random() - .5) * .06;
    this.v69Noise(t, .012, vol * s[3] * far, 'highpass', 3500, .5, pan, 0, 1);
    this.v69Noise(t, s[1], vol * .9, 'bandpass', s[0] * det, .9, pan, s[4] * .35, far);
    this.v69Noise(t + .004, s[1] * 1.6, vol * .45, 'lowpass', 900, .5, pan, s[4] * .5, far);
    this.v69Thump(t, s[2] * det, s[1] * 1.4 + .05, vol * .75 * (.6 + far * .4), pan);
    // Écho du décor qui revient un peu plus tard.
    this.v69Noise(t + .09 + Math.random() * .05, s[1] * 2.5, vol * .12 * s[4], 'lowpass', 700, .4, -pan * .6, .6, far);
    if (v.d < 40 && s[5]) {
      const m = s[5], at = t + (m === 'bolt' ? .55 : m === 'pump' ? .32 : .5);
      if (m === 'pump') { this.v69Noise(at, .06, vol * .35, 'bandpass', 1800, 2, pan, 0, 1); this.v69Noise(at + .13, .05, vol * .4, 'bandpass', 2400, 2, pan, 0, 1); }
      else if (m === 'bolt') { this.v69Click(at, 900, vol * .18, pan); this.v69Noise(at + .05, .08, vol * .25, 'bandpass', 2600, 3, pan, 0, 1); this.v69Click(at + .2, 1300, vol * .2, pan); }
      else this.v69Noise(at, .25, vol * .2, 'bandpass', 500, 1, pan, .2, 1);
    }
  };
  // Rechargement : chargeur qui sort, qui rentre, armement.
  const previousEvent = A.event;
  A.event = function (e, p) {
    if (e && e.type === 'reload' && this.ctx && this.ctx.state === 'running' && this.settings.sfx) {
      const v = this.distance(e, p), t = this.ctx.currentTime, vol = Math.min(1, v.vol), pan = v.pan;
      this.v69Click(t, 700, .16 * vol, pan); this.v69Noise(t + .02, .05, .18 * vol, 'bandpass', 1500, 2, pan, 0, 1);
      this.v69Noise(t + .42, .06, .26 * vol, 'bandpass', 1100, 2, pan, 0, 1); this.v69Click(t + .44, 520, .2 * vol, pan);
      this.v69Click(t + .7, 1200, .16 * vol, pan); this.v69Noise(t + .72, .07, .2 * vol, 'bandpass', 2600, 2.5, pan, 0, 1);
      return;
    }
    return previousEvent.apply(this, arguments);
  };
})(window);
