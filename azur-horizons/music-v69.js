/* AZUR v69 — musique du jeu.
 *  - SALON : un vrai morceau (ré majeur, 104 BPM) en deux parties qui
 *    alternent — couplet (accords, basse, charleston) puis refrain (grosse
 *    caisse, mélodie, arpèges) — au lieu de l'ancienne petite boucle de notes.
 *  - SAUT DU BUS : un thème énergique (la mineur, 128 BPM) pendant le trajet du
 *    bus, la chute libre et le planeur, qui s'éteint à l'atterrissage.
 * Tout passe par le bus « Musique » du jeu (curseur de volume respecté) et se
 * tait pendant l'événement, qui a sa propre partition. */
(function (root) {
  'use strict';
  const A = root.AZAudio?.prototype;
  if (!A || !A.update) return;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SONGS = {
    lobby: { bpm: 104, root: 62, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 7], [-3, 2, 4, 7]],
      kickA: 'x.......x.......', kickB: 'x...x...x...x...', snare: '....x.......x...', hatA: '..x...x...x...x.', hatB: 'x.x.x.x.x.x.x.xx',
      lead: [[12, 14, null, 16, null, 14, 12, null, 9, null, 11, 12, null, null, 7, null], [12, 14, null, 16, 19, null, 16, 14, 12, null, 14, null, 11, null, 9, null]],
      bass: [0, null, 0, 7, null, 0, 12, null], lead2: 'triangle', pad: 'sawtooth', cut: 1800 },
    drop: { bpm: 128, root: 57, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 5], [-2, 2, 5, 9]],
      kickA: 'x...x...x...x...', kickB: 'x...x...x...x.x.', snare: '....x.......x...', hatA: '..x...x...x...x.', hatB: 'xxxxxxxxxxxxxxxx',
      lead: [[12, null, 15, null, 19, null, 17, 15, 12, null, 10, null, 12, 15, null, null], [24, null, 22, null, 19, 17, null, 15, 17, null, 19, null, 22, null, 24, null]],
      bass: [0, 0, 12, 0, null, 0, 10, 12], lead2: 'square', pad: 'sawtooth', cut: 2600 }
  };
  let P = null;
  function audio() { const a = root.AZUR?.audio; return a && a.ctx && a.ctx.state === 'running' && a.musicBus ? a : null; }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function start(name) {
    const a = audio(); if (!a) return;
    const ctx = a.ctx, out = ctx.createGain(), comp = ctx.createDynamicsCompressor(), verb = ctx.createConvolver(), wet = ctx.createGain();
    out.gain.value = .0001; out.gain.setTargetAtTime(name === 'drop' ? .5 : .42, ctx.currentTime, .6);
    comp.threshold.value = -18; comp.ratio.value = 3.5; comp.connect(out); out.connect(a.musicBus);
    if (a.reverb && a.reverb.buffer) { verb.buffer = a.reverb.buffer; wet.gain.value = .35; verb.connect(wet); wet.connect(out); }
    P = { name, a, ctx, out, comp, verb, song: SONGS[name], step: 0, next: ctx.currentTime + .1, timer: setInterval(schedule, 40) };
  }
  function stop(fade) {
    if (!P) return; const p = P; P = null; clearInterval(p.timer);
    try { p.out.gain.setTargetAtTime(.0001, p.ctx.currentTime, fade || .4); setTimeout(() => { try { p.out.disconnect(); } catch (e) { /* déjà débranché */ } }, 3000); } catch (e) { /* contexte fermé */ }
  }
  function voice(type, f, t, dur, vol, cut, wetAmt) {
    const { ctx } = P, o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f, t); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.Q.value = 2;
    env(g, t, .008, vol, dur); o.connect(fl); fl.connect(g); g.connect(P.comp);
    if (wetAmt && P.verb.buffer) { const w = ctx.createGain(); w.gain.value = wetAmt; g.connect(w); w.connect(P.verb); }
    o.start(t); o.stop(t + dur + .08);
  }
  function kick(t, v) { const { ctx } = P, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + .13); env(g, t, .002, v, .22); o.connect(g); g.connect(P.comp); o.start(t); o.stop(t + .3); }
  function noise(t, dur, vol, type, f) {
    const { ctx, a } = P; if (!a.noiseBuffer) return;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = a.noiseBuffer; fl.type = type; fl.frequency.value = f; env(g, t, .002, vol, dur); s.connect(fl); fl.connect(g); g.connect(P.comp); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  function schedule() {
    if (!P) return;
    const { ctx, song } = P, sx = 60 / song.bpm / 4;
    while (P.next < ctx.currentTime + .15) {
      const t = P.next, i = P.step % 16, bar = Math.floor(P.step / 16), ci = bar % 4, sec = Math.floor(bar / 8) % 2, r = song.root, ch = song.chords[ci];
      const kickPat = sec ? song.kickB : song.kickA, hatPat = sec ? song.hatB : song.hatA;
      if (kickPat[i] === 'x') kick(t, .75);
      if (song.snare[i] === 'x' && (sec || P.name === 'drop')) { noise(t, .14, .32, 'bandpass', 1900); voice('triangle', 200, t, .07, .12, 1500); }
      if (hatPat[i] === 'x') noise(t, .035, .1, 'highpass', 7500);
      if (i % 2 === 0) { const b = song.bass[(i / 2) % 8]; if (b !== null) voice('sawtooth', hz(r - 24 + ch[0] + b), t, sx * 1.6, .26, 420); }
      if (i === 0 || (i === 8 && P.name === 'drop')) for (const n of ch) voice(song.pad, hz(r + n), t, sx * (P.name === 'drop' ? 7 : 14), .035, song.cut * .7, .5);
      if (i % 4 === 2 && P.name === 'lobby') for (const n of ch.slice(1)) voice('triangle', hz(r + 12 + n), t, sx * .8, .03, 3000, .3);
      if (sec || P.name === 'drop') { const l = song.lead[bar % 2][i]; if (l !== null) voice(song.lead2, hz(r + l), t, sx * 1.4, .085, 3600, .45); }
      else if (i % 2 === 0) voice('sine', hz(r + 12 + ch[(i / 2) % 4]), t, sx * 1.2, .05, 4000, .5);
      if (P.name === 'drop' && i === 12 && bar % 4 === 3) noise(t, sx * 4, .18, 'highpass', 2000);
      P.step++; P.next += sx;
    }
  }
  function wanted() {
    const g = root.AZUR; if (!g) return null;
    if (root.AZEvent?.active) return null;
    if (g.screen === 'menu') return 'lobby';
    if (g.screen !== 'game') return null;
    const p = g.player && g.player(), w = g.world;
    if (!p || !w) return null;
    if ((w.phase === 'transport' && !p.deployed) || p.falling || p.gliding) return 'drop';
    return null;
  }
  setInterval(() => {
    const a = audio(); if (!a) { if (P) stop(.2); return; }
    const want = a.settings.music > 0 ? wanted() : null;
    if (!want) { if (P) stop(P.name === 'drop' ? 1.2 : .5); return; }
    if (!P || P.name !== want) { stop(.6); start(want); }
  }, 200);
  // L'ancienne petite boucle du salon et les bips d'émote laissent la place.
  const previousUpdate = A.update;
  A.update = function () {
    const m = this.settings.music; this.settings.music = 0;
    try { return previousUpdate.apply(this, arguments); } finally { this.settings.music = m; }
  };
})(window);
