/* AZUR v75 — musique originale du film « THE END ».
 * Partition d'ambiance cinématique (aucun échantillon, 100 % Web Audio), écrite
 * pour suivre la même dramaturgie que la vidéo de référence : registre très grave,
 * nappes lentes sans batterie, montées avant chaque choc, quasi-silence avant le
 * trou noir puis bourdon sub-grave jusqu'à la fin.
 *  - nappes tenues (cordes graves, choeur, sub) dont le volume et le filtre
 *    suivent une courbe d'intensité calée seconde par seconde ;
 *  - évènements planifiés : grondement du décollage, impacts, montées, cloches. */
(function (root) {
  'use strict';
  var E = root.AZEvent;
  if (!E || !E.register) return;
  var ctx = null, master = null, verb = null, noiseBuf = null, layers = null, started = false, lastT = -1, done = {};

  /* courbe d'intensité (dB relatifs) : [temps, niveau] — suit la vidéo */
  var INT = [[0, -8], [6, -6], [12, -4], [25, -3], [33, -4], [36, -9], [38.6, -2], [46, -3], [52, -4], [56, -8], [60, -5], [66, -4],
    [72, -6], [76, -1], [82, -4], [86, -3], [92, -5], [96, -10], [106, -7], [110.5, -2], [116, -10], [121, -4], [130, -3], [140, 0],
    [149, 1], [151, 0], [155, -6], [158, -12], [161, -14], [164, -4], [170, -6], [176, -6], [180, 0], [184, -3], [189, -2], [195, -5],
    [205, -5], [212, -4], [218, -2], [223.5, 1], [226, -2], [235, -1], [240, 1], [252, 2], [255, -2], [258.5, -14], [262, -30], [269.5, -40],
    [270.2, 3], [276, 1], [281, -4], [303, -3], [305, -60]];
  /* accords (midi) par section : basse, puis nappe */
  var CH = [[0, [26, 38, 45, 50, 53]], [38, [22, 34, 46, 50, 53]], [54, [26, 38, 45, 50, 53]], [66, [19, 31, 43, 46, 50]], [80, [21, 33, 45, 49, 52]],
    [90, [19, 31, 43, 46, 50]], [104, [26, 38, 45, 50, 53]], [118, [22, 34, 46, 50, 53]], [132, [21, 33, 45, 49, 52]], [150, [26, 38, 39, 45, 51]],
    [164, [26, 38, 45, 50, 57]], [176, [26, 38, 45, 50, 53]], [190, [22, 34, 46, 50, 53]], [202, [24, 36, 43, 48, 52]], [212, [21, 33, 45, 49, 52]],
    [224, [26, 38, 45, 50, 54]], [240, [26, 38, 45, 52, 57]], [256, [26, 38, 45, 50, 53]], [270, [26, 38, 33, 45, 50]]];
  var CHOIR = [[46, 90, .9], [160, 178, 1], [190, 210, .7], [226, 256, .8]];
  var HITS = [[9, 'launch'], [38.6, 'hit'], [76, 'hit'], [85, 'hit'], [110.5, 'hit'], [150.5, 'big'], [153.2, 'hit'], [183, 'big'], [188.6, 'hit'],
    [191, 'big'], [224, 'big'], [252.6, 'big'], [270.2, 'sub']];
  var RISERS = [[29, 38.6], [70, 76], [104, 110.5], [138, 150.5], [178, 183], [215, 224], [244, 252.6], [263, 270.2]];
  var BELLS = [[2, 74], [14, 81], [27, 77], [47, 86], [51, 81], [57, 84], [63, 77], [71, 86], [79, 81], [88, 79], [97, 74], [101, 81],
    [119, 77], [127, 86], [163, 86], [167, 81], [171, 89], [174, 84], [196, 74], [203, 81], [207, 77], [256, 86], [258, 81], [285, 74], [295, 69]];

  function interp(tab, t) {
    if (t <= tab[0][0]) return tab[0][1];
    for (var i = 0; i < tab.length - 1; i++) if (t < tab[i + 1][0]) { var k = (t - tab[i][0]) / (tab[i + 1][0] - tab[i][0]); return tab[i][1] + (tab[i + 1][1] - tab[i][1]) * k; }
    return tab[tab.length - 1][1];
  }
  function chordAt(t) { var c = CH[0][1]; for (var i = 0; i < CH.length; i++) if (t >= CH[i][0]) c = CH[i][1]; return c; }
  function choirAt(t) { for (var i = 0; i < CHOIR.length; i++) { var c = CHOIR[i]; if (t >= c[0] && t < c[1]) return c[2] * Math.min(1, (t - c[0]) / 4, (c[1] - t) / 3); } return 0; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function vol() { var s = root.AZUR && root.AZUR.profile && root.AZUR.profile.settings; var v = s && typeof s.music === 'number' ? s.music : .8; return Math.max(0, Math.min(1, v)); }

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp); comp.connect(ctx.destination);
    verb = ctx.createConvolver(); var n = Math.floor(ctx.sampleRate * 4), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    verb.buffer = ir; var vg = ctx.createGain(); vg.gain.value = .5; verb.connect(vg); vg.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function () { if (ctx.state === 'suspended') ctx.resume(); }, {passive: true}); });
    return ctx;
  }
  /* nappes tenues : 5 voix (basse sub + 4 voix de cordes graves désaccordées) + choeur + grondement */
  function buildLayers() {
    var L = {voices: [], choir: [], bus: ctx.createGain(), filt: ctx.createBiquadFilter(), choirBus: ctx.createGain(), rumble: null};
    L.filt.type = 'lowpass'; L.filt.frequency.value = 500; L.filt.Q.value = .5; L.bus.gain.value = 0; L.filt.connect(L.bus); L.bus.connect(master); L.bus.connect(verb);
    for (var i = 0; i < 5; i++) {
      var g = ctx.createGain(); g.gain.value = i === 0 ? .5 : .14; g.connect(i === 0 ? L.bus : L.filt);
      var oscs = [];
      (i === 0 ? ['sine', 'triangle'] : ['sawtooth', 'sawtooth']).forEach(function (type, k) { var o = ctx.createOscillator(); o.type = type; o.detune.value = i === 0 ? 0 : (k ? 7 : -7); if (i === 0 && k) o.detune.value = 1200; o.connect(g); o.start(); oscs.push(o); });
      L.voices.push(oscs);
    }
    L.choirBus.gain.value = 0; var f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.frequency.value = 650; f2.frequency.value = 1080; f1.Q.value = f2.Q.value = 4;
    f1.connect(L.choirBus); f2.connect(L.choirBus); L.choirBus.connect(verb); L.choirBus.connect(master);
    for (var c = 0; c < 3; c++) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = (c - 1) * 9; o.connect(f1); o.connect(f2); o.start(); L.choir.push(o); }
    var rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true; var rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 90; var rg = ctx.createGain(); rg.gain.value = 0;
    rs.connect(rf); rf.connect(rg); rg.connect(master); rs.start(); L.rumble = rg;
    return L;
  }
  function setLayers(t) {
    var now = ctx.currentTime, lvl = interp(INT, t), amp = Math.pow(10, lvl / 20), ch = chordAt(t), tc = .35;
    layers.voices.forEach(function (oscs, i) { oscs.forEach(function (o) { o.frequency.setTargetAtTime(mtof(ch[i]), now, .8); }); });
    layers.bus.gain.setTargetAtTime(.32 * amp, now, tc);
    layers.filt.frequency.setTargetAtTime(250 + 900 * Math.min(1.4, amp), now, tc);
    var c = choirAt(t); layers.choir.forEach(function (o, k) { o.frequency.setTargetAtTime(mtof(ch[2 + k] + 12), now, .8); });
    layers.choirBus.gain.setTargetAtTime(.05 * c * Math.min(1.2, amp + .3), now, .6);
    var rum = (t > 150 && t < 158 ? .6 : 0) + (t > 224 && t < 255 ? .5 : 0) + (t > 270 ? .55 : 0) + (t > 9 && t < 30 ? .35 * (1 - (t - 9) / 21) : 0);
    layers.rumble.gain.setTargetAtTime(rum * amp * .5, now, .5);
  }
  /* évènements ponctuels */
  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }   // v78 : temps de la vidéo
  function at(tm) { return ctx.currentTime + (tm - VT()); }
  function boom(t0, v, f0, dur) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(26, t0 + dur * .6);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + .04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); g.connect(verb); o.start(t0); o.stop(t0 + dur + .1);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + dur * .7);
    ng.gain.setValueAtTime(v * .35, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(ng); ng.connect(verb); ng.connect(master); s.start(t0); s.stop(t0 + dur + .1);
  }
  function riser(t0, t1, v) {
    var d = t1 - t0, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(120, t0); f.frequency.exponentialRampToValueAtTime(1800, t1); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t1 - .05); g.gain.linearRampToValueAtTime(0.0001, t1 + .1);
    s.connect(f); f.connect(g); g.connect(verb); g.connect(master); s.start(t0); s.stop(t1 + .2);
    var o = ctx.createOscillator(), og = ctx.createGain(), of = ctx.createBiquadFilter(); o.type = 'sawtooth'; of.type = 'lowpass'; of.frequency.value = 900;
    o.frequency.setValueAtTime(55, t0); o.frequency.exponentialRampToValueAtTime(220, t1); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(v * .5, t1 - .05); og.gain.linearRampToValueAtTime(0.0001, t1 + .1);
    o.connect(of); of.connect(og); og.connect(verb); og.connect(master); o.start(t0); o.stop(t1 + .2);
  }
  function bell(t0, m, v) {
    [1, 2.76, 5.4].forEach(function (r, k) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = mtof(m) * r; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v / (k + 1), t0 + .01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4 / (k + 1)); o.connect(g); g.connect(verb); g.connect(master); o.start(t0); o.stop(t0 + 4.2); });
  }
  function launch(t0) {   // grondement du décollage : bruit grave qui enfle puis s'éloigne
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 300;
    g.gain.setValueAtTime(0.0001, t0 - 3); g.gain.exponentialRampToValueAtTime(.5, t0 + 1.5); g.gain.exponentialRampToValueAtTime(.2, t0 + 12); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 26);
    f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + 26); s.connect(f); f.connect(g); g.connect(master); s.start(Math.max(ctx.currentTime, t0 - 3)); s.stop(t0 + 27);
  }
  function schedule(t) {
    var horizon = t + 1.0;
    function due(key, tm, fn) { if (done[key] || tm < t - .05 || tm > horizon) return; done[key] = true; fn(at(tm)); }
    HITS.forEach(function (h, i) { due('h' + i, h[0], function (a) {
      if (h[1] === 'launch') launch(a); else if (h[1] === 'sub') boom(a, .9, 70, 9); else boom(a, h[1] === 'big' ? .75 : .45, h[1] === 'big' ? 140 : 110, h[1] === 'big' ? 6 : 4);
    }); });
    RISERS.forEach(function (r, i) { if (done['r' + i] || r[0] > horizon || r[1] < t) return; done['r' + i] = true; riser(at(Math.max(r[0], t)), at(r[1]), .14); });
    BELLS.forEach(function (b, i) { due('b' + i, b[0], function (a) { bell(a, b[1], .05); }); });
  }

  function init() { started = false; done = {}; lastT = -1; }
  function update() {
    if (!E.active || !ensure()) return;
    if (!layers) layers = buildLayers();
    var t = VT();
    if (!started) { started = true; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0, ctx.currentTime); master.gain.linearRampToValueAtTime(.9 * vol(), ctx.currentTime + 1.5); }
    if (ctx.state !== 'running') return;
    // v86 : dès que la vraie bande-son de la vidéo joue (music86), la partition synthétique se tait
    var dim = E.realMusic ? 0 : 1; if (dim !== update.dim) { update.dim = dim; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(.9 * vol() * dim, ctx.currentTime, .35); }
    if (!dim) { lastT = VT(); return; }
    if (lastT >= 0 && Math.abs(t - lastT) > 1.5) done = {};   // saut dans le temps : on réarme ce qui reste à venir
    lastT = t;
    setLayers(t); schedule(t);
  }
  function dispose() {
    started = false; done = {};
    if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1); }
  }
  E.register('music75', {init: init, update: update, dispose: dispose});
})(window);
