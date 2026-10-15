/* AZUR v67 — musique des émotes.
 * Chaque danse a son propre petit morceau synthétisé (batterie, basse, accords,
 * mélodie) au tempo exact de la chorégraphie d'anim-v67.js. La musique démarre
 * avec l'émote du joueur local et s'arrête dès qu'il bouge. Passe par le bus
 * musique du jeu (réglage de volume « Musique » respecté). */
(function (root) {
  'use strict';
  // Motifs sur 16 doubles-croches : x = coup, . = silence. Notes en demi-tons depuis la tonique.
  const SONGS = {
    salut:    { bpm: 100, root: 57, kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: [0, null, null, 7, 0, null, 5, null], chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: [12, null, 16, 14, 12, null, 9, null, 7, null, 9, 12, 14, null, null, null], wave: 'triangle' },
    danse:    { bpm: 116, root: 52, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: [0, 12, 0, 12, 3, 15, 3, 15], chords: [[0, 3, 7], [0, 3, 7], [5, 8, 12], [7, 10, 14]], lead: [15, null, 12, null, 10, 12, null, 15, 17, null, 15, null, 12, null, 10, null], wave: 'square' },
    victoire: { bpm: 128, root: 60, kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: '..x...x...x...xx', bass: [0, 0, 7, 7, 5, 5, 7, 7], chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], lead: [12, 12, 16, null, 19, null, 16, null, 24, null, 19, null, 21, 19, 16, null], wave: 'sawtooth' },
    robot:    { bpm: 108, root: 45, kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: [0, null, 0, 3, null, 0, 7, 5], chords: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-2, 2, 5]], lead: [24, null, 24, null, 22, null, 19, null, 24, 27, null, 24, 22, null, 19, null], wave: 'square' },
    etoile:   { bpm: 132, root: 62, kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.xx..xx..xx..xx.', bass: [0, 7, 12, 7, 5, 12, 17, 12], chords: [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]], lead: [12, 14, 16, 19, 16, 14, 12, null, 14, 16, 19, 21, 19, null, 16, null], wave: 'triangle' },
    toupie:   { bpm: 112, root: 50, kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', bass: [0, null, 0, 10, null, 7, null, 5], chords: [[0, 3, 7, 10], [0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14]], lead: [null, 12, null, 15, 17, null, 15, 12, null, 10, 12, null, 7, null, null, null], wave: 'sawtooth' }
  };
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  let player = null;

  function audio() { const a = root.AZUR?.audio; return a && a.ctx && a.ctx.state === 'running' && a.musicBus ? a : null; }

  function start(style) {
    const a = audio(); if (!a) return;
    const song = SONGS[style] || SONGS.salut, ctx = a.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(.55, ctx.currentTime, .05); out.connect(a.musicBus);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(out);
    player = { style, a, ctx, out, comp, song, step: 0, next: ctx.currentTime + .05, timer: null };
    player.timer = setInterval(schedule, 40);
    schedule();
  }
  function stop() {
    if (!player) return;
    const p = player; player = null; clearInterval(p.timer);
    try { p.out.gain.setTargetAtTime(0, p.ctx.currentTime, .08); setTimeout(() => { try { p.out.disconnect(); } catch (e) { /* déjà débranché */ } }, 600); } catch (e) { /* contexte fermé */ }
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function voice(type, f, t, dur, vol, cutoff, dest) {
    const { ctx } = player, o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f, t); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.Q.value = 3;
    env(g, t, .006, vol, dur); o.connect(fl); fl.connect(g); g.connect(dest || player.comp); o.start(t); o.stop(t + dur + .05);
  }
  function kick(t) {
    const { ctx } = player, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
    env(g, t, .002, .9, .22); o.connect(g); g.connect(player.comp); o.start(t); o.stop(t + .3);
  }
  function noise(t, dur, vol, type, freq) {
    const { ctx, a } = player; if (!a.noiseBuffer) return;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = a.noiseBuffer; f.type = type; f.frequency.value = freq; env(g, t, .002, vol, dur);
    s.connect(f); f.connect(g); g.connect(player.comp); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }
  function schedule() {
    if (!player) return;
    const { ctx, song } = player, sixteenth = 60 / song.bpm / 4;
    while (player.next < ctx.currentTime + .14) {
      const t = player.next, i = player.step % 16, bar = Math.floor(player.step / 16) % 4, r = song.root;
      if (song.kick[i] === 'x') kick(t);
      if (song.snare[i] === 'x') { noise(t, .16, .45, 'bandpass', 1800); voice('triangle', 190, t, .08, .18, 1200); }
      if (song.hat[i] === 'x') noise(t, .04, .16, 'highpass', 7000);
      if (i % 2 === 0) { const b = song.bass[(i / 2) % 8]; if (b !== null) voice('sawtooth', hz(r - 12 + b + song.chords[bar][0]), t, sixteenth * 1.7, .32, 520); }
      if (i === 0 || i === 6 || i === 10) for (const n of song.chords[bar]) voice(song.wave === 'sawtooth' ? 'sawtooth' : 'square', hz(r + n), t, sixteenth * (i === 0 ? 3 : 1.5), .05, 2400);
      const l = song.lead[i]; if (l !== null && bar % 2 === 1) voice(song.wave, hz(r + l), t, sixteenth * .9, .12, 3800);
      player.step++; player.next += sixteenth;
    }
  }
  function tick() {
    const game = root.AZUR, p = game && game.screen === 'game' && game.player && game.player();
    const style = p && p.emote > 0 ? (p.emoteStyle || 'salut') : null;
    if (!style) { if (player) stop(); return; }
    if (!player || player.style !== style) { stop(); start(style); }
  }
  setInterval(tick, 100);
})(window);
