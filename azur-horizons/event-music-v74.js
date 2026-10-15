/* AZUR v74 — THE END · nouvelle musique d'ambiance de l'événement.
 * Électro cinématique en ré mineur, 120 BPM, 100 % Web Audio (aucun fichier).
 * Calée sur la timeline officielle (secondes de l'événement) :
 *   compte à rebours : nappe sombre qui s'ouvre, arpège, pouls, montée
 *   60 s lancement : le groove entre · 141 s accélération · 177 s silence
 *   182 s frappe : drop lourd · 226 s lasers · 253 s impact puis accalmie
 *   302–331 s effondrement · 339 s trou noir : bourdon · 347 s nombres : presque rien.
 * Planification à 0,8 s d'avance sur une grille de doubles-croches ; peu de
 * nœuds (chaque note se libère seule), un seul écho et une seule réverbe. */
(function (root) {
  'use strict';
  var E = root.AZEvent;
  if (!E || !E.register) return;
  var BPM = 120, BEAT = 60 / BPM, STEP = BEAT / 4, BAR = BEAT * 4, LOOK = 0.8;
  var ctx = null, out = null, duck = null, verb = null, echo = null, noiseBuf = null;
  var nextStep = -1, started = false, lastT = -1, holds = [];

  /* ---------------------------------------------------------------- sections */
  // niveau d'intensité 0..7 et progression d'accords selon le temps de l'événement
  var SECTIONS = [
    [0, 20, 1, 'calm'], [20, 40, 2, 'calm'], [40, 60, 3, 'calm'],
    [60, 90, 4, 'main'], [90, 118, 5, 'main'], [118, 141, 5, 'main'], [141, 177, 6, 'main'],
    [177, 182, 0, 'none'],
    [182, 208, 7, 'dark'], [208, 221.5, 5, 'dark'], [221.5, 226, 6, 'dark'], [226, 245, 7, 'dark'], [245, 253, 6, 'dark'],
    [253, 262, 1, 'calm'], [262, 302, 3, 'after'],
    [302, 331, 6, 'dark'], [331, 339, 2, 'calm'], [339, 347, 1, 'void'], [347, 360, 1, 'void'], [360, 1e9, 0, 'none']
  ];
  var HITS = [60, 141, 182, 191, 226, 233.5, 236.5, 239.5, 242.5, 253, 309, 312, 318];
  var RISERS = [[52, 60], [133, 141], [170, 177], [186, 191], [221.5, 226], [245, 253], [302, 309], [341, 347]];
  var PROG = {
    calm: [[50, 53, 57, 64], [46, 50, 53, 60], [41, 48, 53, 57], [48, 52, 55, 62]],      // Dm9 Bb F C
    main: [[50, 53, 57, 62], [46, 50, 53, 58], [41, 45, 48, 53], [48, 52, 55, 60]],
    dark: [[46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57], [50, 53, 57, 62]],      // Bb Gm A Dm
    after: [[50, 53, 57, 64], [43, 46, 50, 57], [46, 50, 53, 60], [45, 49, 52, 57]],
    void: [[38, 45, 52, 57]], none: [[38, 45, 50, 57]]
  };
  function section(t) {
    for (var i = 0; i < SECTIONS.length; i++) if (t >= SECTIONS[i][0] && t < SECTIONS[i][1]) return SECTIONS[i];
    return SECTIONS[SECTIONS.length - 1];
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function vol() {
    var s = root.AZUR && root.AZUR.profile && root.AZUR.profile.settings;
    var v = s && typeof s.music === 'number' ? s.music : 0.8;
    return Math.max(0, Math.min(1, v));
  }

  /* ---------------------------------------------------------------- moteur audio */
  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    out = ctx.createGain(); out.gain.value = 0; out.connect(comp); comp.connect(ctx.destination);
    duck = ctx.createGain(); duck.connect(out);
    // réverbe courte générée (2,2 s)
    verb = ctx.createConvolver(); var n = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    verb.buffer = ir; var vg = ctx.createGain(); vg.gain.value = .32; verb.connect(vg); vg.connect(out);
    // écho pointé (3/16) pour l'arpège et les cloches
    echo = ctx.createDelay(1); echo.delayTime.value = STEP * 3; var fb = ctx.createGain(); fb.gain.value = .38;
    var ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 3200;
    echo.connect(ef); ef.connect(fb); fb.connect(echo); var eg = ctx.createGain(); eg.gain.value = .45; ef.connect(eg); eg.connect(duck); eg.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    var resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, resume, {passive: true}); });
    return ctx;
  }
  function at(tm) { return ctx.currentTime + (tm - E.tTotal); }
  function env(g, t0, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.setValueAtTime(peak, t0 + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a, dur) + rel);
  }
  function voice(type, freq, t0, dur, peak, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0); if (o.detune) osc.detune.value = o.detune;
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + (o.glideT || .1));
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.cut || 2000, t0); f.Q.value = o.q || .7;
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(o.cutTo, t0 + (o.cutT || dur));
    osc.connect(f); f.connect(g); g.connect(o.dest || duck); if (o.verb) g.connect(verb); if (o.echo) g.connect(echo);
    env(g, t0, o.a || .005, peak, dur, o.rel || .08);
    osc.start(t0); osc.stop(t0 + dur + (o.rel || .08) + .05);
    return {osc: osc, g: g, f: f};
  }
  function noiseHit(t0, dur, peak, type, freq, q, dest) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q || .7;
    s.connect(f); f.connect(g); g.connect(dest || out);
    g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.start(t0, Math.random() * .5); s.stop(t0 + dur + .02);
    return {s: s, f: f, g: g};
  }

  /* ---------------------------------------------------------------- instruments */
  function kick(t0, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(44, t0 + .12);
    o.connect(g); g.connect(out); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + .42);
    o.start(t0); o.stop(t0 + .45);
    // pompage : la nappe et la basse s'effacent sous le kick
    duck.gain.cancelScheduledValues(t0); duck.gain.setValueAtTime(.35, t0); duck.gain.linearRampToValueAtTime(1, t0 + .22);
  }
  function clap(t0, v) { noiseHit(t0, .18, v, 'bandpass', 1500, .9); noiseHit(t0 + .012, .12, v * .7, 'bandpass', 2200, .9); }
  function hat(t0, v, open) { noiseHit(t0, open ? .22 : .045, v, 'highpass', 7500, .7); }
  function boom(t0, v, f0) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0 || 110, t0); o.frequency.exponentialRampToValueAtTime(30, t0 + 1.2);
    o.connect(g); g.connect(out); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    o.start(t0); o.stop(t0 + 2.5);
    var n = noiseHit(t0, 2.2, v * .35, 'lowpass', 1800, .5, verb); n.f.frequency.exponentialRampToValueAtTime(200, t0 + 2);
  }
  function riser(t0, t1, v) {
    var d = Math.max(.5, t1 - t0), n = noiseHit(t0, d + .05, v, 'bandpass', 400, 2.5, duck);
    n.g.gain.cancelScheduledValues(t0); n.g.gain.setValueAtTime(0.0001, t0); n.g.gain.exponentialRampToValueAtTime(v, t1 - .02); n.g.gain.linearRampToValueAtTime(0.0001, t1 + .04);
    n.f.frequency.setValueAtTime(400, t0); n.f.frequency.exponentialRampToValueAtTime(7000, t1);
    var s = voice('sawtooth', 110, t0, d, v * .25, {cut: 600, cutTo: 5000, cutT: d, glideTo: 880, glideT: d, a: d * .9, rel: .05});
  }
  function bass(t0, m, d, v, dark) {
    voice('sawtooth', mtof(m), t0, d, v, {cut: dark ? 260 : 420, cutTo: dark ? 1400 : 900, cutT: d * .5, q: dark ? 6 : 2, a: .004, rel: .05});
    voice('sine', mtof(m - 12), t0, d, v * .9, {cut: 300, a: .004, rel: .05});
  }
  function padChord(t0, ch, d, v, cut) {
    for (var i = 0; i < ch.length; i++) {
      for (var k = -1; k <= 1; k += 2) voice('sawtooth', mtof(ch[i]), t0, d, v / ch.length, {detune: k * 9, cut: cut, cutTo: cut * 1.6, cutT: d, a: Math.min(1.2, d * .3), rel: 1.2, verb: true});
    }
  }
  function stab(t0, ch, v) {
    for (var i = 0; i < ch.length; i++) voice('sawtooth', mtof(ch[i] + 12), t0, .09, v / ch.length, {detune: (i - 1.5) * 7, cut: 4200, cutTo: 900, cutT: .15, a: .002, rel: .12, verb: true});
  }
  function pluck(t0, m, v) { voice('triangle', mtof(m), t0, .05, v, {cut: 5000, cutTo: 700, cutT: .3, a: .002, rel: .35, echo: true}); }
  function bell(t0, m, v) { voice('sine', mtof(m), t0, .02, v, {cut: 9000, a: .002, rel: 2.2, echo: true, verb: true}); voice('sine', mtof(m) * 2.76, t0, .01, v * .25, {cut: 9000, a: .002, rel: .9}); }
  function drone(t0, d, m, v) { voice('sine', mtof(m), t0, d, v, {cut: 400, a: 2, rel: 2}); voice('triangle', mtof(m + 7), t0, d, v * .35, {cut: 600, a: 3, rel: 2, verb: true}); }

  /* ---------------------------------------------------------------- partition */
  var ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  var LEAD = [[0, 74, 2], [2, 77, 2], [4, 81, 3], [7, 79, 1], [8, 77, 2], [10, 76, 2], [12, 74, 4]];
  function stepAt(i) {
    var tm = i * STEP, sec = section(tm), lvl = sec[2], mode = sec[3];
    if (lvl === 0) return;
    var t0 = at(tm); if (t0 < ctx.currentTime - .01) return;
    var s16 = i % 16, beat = Math.floor(s16 / 4), bar = Math.floor(i / 16);
    var prog = PROG[mode] || PROG.calm, chordLen = mode === 'calm' || mode === 'void' ? 2 : 1;
    var ch = prog[Math.floor(bar / chordLen) % prog.length];
    var dark = mode === 'dark';
    // nappe : une par accord
    if (s16 === 0 && bar % chordLen === 0) padChord(t0, ch, BAR * chordLen, (mode === 'void' ? .1 : .16) * (lvl >= 6 ? .8 : 1), mode === 'void' ? 420 : 900 + lvl * 300);
    if (mode === 'void') { if (s16 === 0 && bar % 2 === 0) drone(t0, BAR * 2, 26, .22); if (s16 === 8 && Math.random() < .5) bell(t0, ch[3] + 24, .05); return; }
    // cloches éparses (calme)
    if (lvl <= 3 && s16 === 0 && bar % 2 === 1) bell(t0, ch[(bar >> 1) % 4] + 24, .07);
    // arpège
    if (lvl >= 2 && (lvl >= 5 || s16 % 2 === 0)) pluck(t0, ch[ARP[(i >> (lvl >= 5 ? 0 : 1)) % 8]] + 12, .07 + .012 * lvl);
    // pouls de basse
    if (lvl >= 3 && s16 % 2 === 0) bass(t0, ch[0] - 12 - (ch[0] > 47 ? 12 : 0), STEP * 1.6, (s16 % 4 === 0 ? .16 : .1) * (lvl >= 6 ? 1.2 : 1), dark);
    // batterie
    if (lvl >= 4 && s16 % 4 === 0) kick(t0, lvl >= 7 ? .9 : .7);
    if (lvl === 3 && tm >= 50 && s16 % 4 === 0) kick(t0, .45);
    if (lvl >= 4 && s16 % 4 === 2) hat(t0, .16 + .02 * lvl, true);
    if (lvl >= 5 && s16 % 2 === 1) hat(t0, .11, false);
    if (lvl >= 5 && (s16 === 4 || s16 === 12)) clap(t0, lvl >= 7 ? .5 : .36);
    if (lvl >= 7 && s16 % 4 === 3) stab(t0, ch, .1);
    // thème
    if (lvl >= 5 && mode !== 'calm') {
      var ph = i % 64;
      for (var k = 0; k < LEAD.length; k++) if (LEAD[k][0] * 4 === ph % 64 && bar % 8 < 4) voice('square', mtof(LEAD[k][1] - (dark ? 2 : 0) - 12), t0, LEAD[k][2] * BEAT * .9, .045, {cut: 2600, a: .01, rel: .25, echo: true, verb: true});
    }
    // roulement dans les 2 dernières secondes avant une frappe
    for (var h = 0; h < HITS.length; h++) { var dt = HITS[h] - tm; if (dt > 0 && dt <= 2 && lvl >= 4 && (dt <= 1 ? true : s16 % 2 === 0)) noiseHit(t0, .08, .06 + .1 * (1 - dt / 2), 'bandpass', 1800, .8); }
  }
  function schedule() {
    var tm = E.tTotal; if (nextStep < 0 || Math.abs(tm - lastT) > 1.5) nextStep = Math.ceil(tm / STEP);  // saut de temps : on se recale
    lastT = tm;
    var horizon = tm + LOOK;
    while (nextStep * STEP < horizon) {
      var ts = nextStep * STEP;
      stepAt(nextStep);
      for (var h = 0; h < HITS.length; h++) if (HITS[h] >= ts && HITS[h] < ts + STEP) { var tt = at(HITS[h]); if (tt >= ctx.currentTime - .01) { boom(tt, .55, 120); kick(tt, 1); noiseHit(tt, 2.5, .12, 'highpass', 5000, .5, verb); } }
      for (var r = 0; r < RISERS.length; r++) if (RISERS[r][0] >= ts && RISERS[r][0] < ts + STEP) { var a0 = at(RISERS[r][0]); if (a0 >= ctx.currentTime - .01) riser(a0, at(RISERS[r][1]), .08); }
      nextStep++;
    }
  }

  /* ---------------------------------------------------------------- cycle de vie */
  function init() { started = false; nextStep = -1; }
  function update() {
    if (!E.active) return;
    if (!ensure()) return;
    if (!started) { started = true; out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(.8 * vol(), ctx.currentTime + 2); }
    if (ctx.state !== 'running') return;
    schedule();
  }
  function dispose() {
    started = false; nextStep = -1;
    if (ctx && out) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + .8); }
  }
  E.register('music74', {init: init, update: update, dispose: dispose});
})(typeof window !== 'undefined' ? window : this);
