/* ==========================================================================
 * event-audio.js — MODULE 13/19 du projet "THE END" (v5, réécriture)
 * Tous les sons de l'event, 100 % synthétisés en Web Audio.
 * Aucun asset, aucun appel réseau, aucun import. Limiteur anti-saturation.
 * ==========================================================================
 * Direction sonore : musique d'ambiance COHÉRENTE, style cinématique
 * épique / orchestral synthétisé (cordes graves, ostinato montant,
 * timbales, cuivres doux, nappes cristallines). PAS de métal. v10 : le
 * zéro du compte à rebours est marqué par une ALARME SONORE orchestrée
 * (cor d'alerte deux tons, pas strident) QUI MONTE en puissance, doublée
 * d'un roulement de timbales + un accord orchestral (le triangle "!"
 * visuel est géré par un autre module).
 * ==========================================================================
 * Architecture :
 *  - un AudioContext propre au module, créé à l'init, repris (resume) au
 *    premier geste utilisateur (pointerdown / keydown, une seule fois) ;
 *  - master GainNode -> limiteur (DynamicsCompressor) -> destination ;
 *  - partition orchestrale continue (score) : nappe de cordes en la
 *    mineur (Am–F–C–G) + ostinato rythmique + timbales, intensité 1→5
 *    pilotée par les phases firstrocket→acceleration ;
 *  - bruitages 100 % Web Audio : tic-tac, rugissements, whooshes,
 *    scintillements de failles, sifflement, lasers, booms, déchirements,
 *    aspirations, craquements, blips, piano épars ;
 *  - update(dt) pilote les déclenchements selon AZEvent.state et les
 *    événements du bus ('phase:<nom>' + 'countdown:tick',
 *    'countdown:alarm', 'rocket:launch', 'rocket:rift-enter',
 *    'rocket:impact', 'rocket:zeroshock', 'rocket:pass', 'shockwave',
 *    'shockwave:burst', 'meteor:hit', 'meteor:rebound', 'meteor:unfreeze',
 *    'zeropoint:collapse', 'zeropoint:destroyed', 'blackhole:formed',
 *    'number:show', 'player:sucked', 'impact:playerblast', 'suction:start',
 *    'suction:end', 'suction:beat', 'rift:cross', 'camera:shake', 'calm')
 *    — JAMAIS de temps absolus en dur ;
 *  - le volume du jeu est baissé pendant l'event via window.AZUR.audio.mute()
 *    (null-safe) et RESTAURÉ dans dispose() ;
 *  - inactif quand !AZEvent.active ; dispose() STOPPE tous les sons.
 *  - v22 : SILENCE DRAMATIQUE avant les nombres (le master plonge 1,8 s à
 *    l'entrée de 'numbers', puis remonte doucement), FRÉMISSEMENT montant
 *    dans les 2,5 dernières secondes de 'blackhole' (bornes lues depuis la
 *    timeline officielle, jamais en dur), blips des nombres PLUS FORTS à
 *    chaque chiffre + ÉCHO dans le vide (+ sub-grave dès le 6e nombre),
 *    coups de TIMBALE des JALONS ('countdown:milestone' : T-0:45 / T-0:15 /
 *    T-0:10 — d'autant plus graves et forts que zéro approche).
 * ========================================================================== */
(function (root) {
'use strict';

// Rien à faire si le séquenceur n'est pas chargé.
if (!root.AZEvent) return;
var AZE = root.AZEvent;
// v74 : toute la musique de l'event passe par event-music-v74.js ; ce module ne garde que les bruitages.
var MUSIC_V74 = true;

/* ------------------------------------------------------------------ */
/* Utilitaires                                                          */
/* ------------------------------------------------------------------ */

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}

/* ------------------------------------------------------------------ */
/* Ordre strict des 23 phases (miroir du séquenceur, jamais de temps)   */
/* ------------------------------------------------------------------ */

var PHASES = ['countdown', 'firstrocket', 'sixrockets', 'convergence', 'loop',
  'acceleration', 'silence', 'strike', 'thrown', 'greatrift', 'meteorsix',
  'descent', 'veeroff', 'impact', 'contraction', 'collapse', 'growth',
  'destruction', 'playersucked', 'allgone', 'blackhole', 'numbers', 'end'];

/* ------------------------------------------------------------------ */
/* État interne du module                                               */
/* ------------------------------------------------------------------ */

var S = {
  inited: false,       // init() déjà appelée (idempotence)
  ctx: null,           // AudioContext du module
  master: null,        // GainNode maître (avant le limiteur)
  noiseBuf: null,      // tampon de bruit blanc partagé
  space: null,
  lastPortalTone: -10,
  lastPassTone: -10,
  lastFractureTone: -10,
  hold: {},            // sons continus en cours : {gain, nodes[]}
  curPhase: '',        // phase entrée (via 'phase:<nom>' ou suivi d'état)
  countdownHeard: false, // un 'countdown:tick' a été reçu (phase countdown)
  zeroHeard: false,      // 'countdown:alarm' reçu (zéro du compte à rebours)
  lastZeroT: -10,        // dernier instant du signal zéro (anti-doublon)
  countBase: 0,          // 'remaining' du premier tic : référence de progression
  countRiserOn: false,   // montée dramatique déjà lancée (phase countdown)
  whooshT: 0,          // prochain chuintement de fusée
  pulseT: 0,           // prochaine pulsation de faille
  shimmerT: 0,         // prochain scintillement cristallin
  crackleT: 0,         // prochain craquement (destruction)
  blipT: 0,            // prochain blip discret (phase numbers)
  pianoT: 0,           // prochaine note de piano éparse (trou noir)
  voidT: 0,            // v21 : prochain pouls de vide (sub-grave discret, trou noir)
  numAnticip: false,   // v22 : frémissement avant les nombres déjà joué
  rumbleIn: -1,        // délai (s) avant le grondement, relatif à l'entrée en 'silence'
  hardCut: false,      // master coupé brutalement (contraction)
  busBound: false,     // écouteurs du bus enregistrés une seule fois
  pending: [],         // timeouts en attente, annulés au dispose
  gameMuted: false,    // le jeu a-t-il été coupé par nous ?
  duckTimer: 0,        // timeout de restauration après 'calm'
  resumeHandler: null, // écouteur de geste utilisateur
  // v15 : battement de cœur de la météorite — S.beatT accumule dt depuis
  // l'init exactement comme M.pulseT (event-meteor.js), même période :
  // le son bat EN PHASE avec la pulsation lumineuse des fissures.
  beatT: 0,           // horloge du battement de cœur (s)
  riftXT: 0,         // anti-doublon 'rift:cross' (s restantes)
  passWT: 0,         // anti-doublon 'rocket:pass' (s restantes)
  // Partition orchestrale (score) — état de l'ordonnanceur.
  sc: {
    on: false, level: 0, step: 0, nextT: 0,
    bus: null, filt: null,
    gStacc: null, gTimp: null, gPad: null,
    chordIdx: 0, chordT: 0
  }
};

/* ------------------------------------------------------------------ */
/* Contexte audio + graphe de base (avec limiteur anti-saturation)      */
/* ------------------------------------------------------------------ */

// Crée le contexte et le graphe. Appelé une fois à l'init.
function ensureCtx() {
  if (S.ctx) return;
  var AC = root.AudioContext || root.webkitAudioContext;
  if (!AC) return; // navigateur sans Web Audio : le module reste muet
  S.ctx = new AC();

  // Master : tout le module passe par ici…
  S.master = S.ctx.createGain();
  S.master.gain.value = 0.85;

  // …puis par le limiteur anti-saturation avant la sortie.
  var comp = S.ctx.createDynamicsCompressor();
  comp.threshold.value = -18;   // commence à compresser à -18 dB
  comp.knee.value = 12;
  comp.ratio.value = 12;        // compression forte au-delà du seuil
  comp.attack.value = 0.002;    // attaque très rapide (pics d'explosion)
  comp.release.value = 0.25;
  S.master.connect(comp);
  comp.connect(S.ctx.destination);
  var delay = S.ctx.createDelay(0.5), feedback = S.ctx.createGain(), damping = S.ctx.createBiquadFilter(), wet = S.ctx.createGain();
  delay.delayTime.value = 0.19; feedback.gain.value = 0.21; damping.type = 'lowpass'; damping.frequency.value = 1900; wet.gain.value = 0.16;
  delay.connect(damping); damping.connect(feedback); feedback.connect(delay); damping.connect(wet); wet.connect(S.master); S.space = delay;

  // Tampon de bruit blanc de 2 secondes, réutilisé partout.
  var len = Math.floor(S.ctx.sampleRate * 2);
  S.noiseBuf = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
  var data = S.noiseBuf.getChannelData(0);
  for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}

function now() {
  return S.ctx.currentTime;
}

// Source de bruit prête à l'emploi (oneshot ou boucle).
function noiseSource(loop) {
  var src = S.ctx.createBufferSource();
  src.buffer = S.noiseBuf;
  src.loop = !!loop;
  return src;
}

// true si le contexte tourne (garde-fou avant chaque son).
function running() {
  return S.ctx && S.ctx.state === 'running';
}

// Monte le master à v avec une constante de temps tc (restauration douce).
function masterTo(v, tc) {
  if (!S.ctx) return;
  try {
    var t = now();
    S.master.gain.cancelScheduledValues(t);
    S.master.gain.setTargetAtTime(v, t, tc == null ? 0.4 : tc);
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Volume du jeu                                                        */
/* ------------------------------------------------------------------ */

// Baisse le son du jeu pendant l'event (null-safe, ne touche à rien d'autre).
// Le jeu expose window.AZUR.audio.mute(on) (cf. audio.js : master 0 / .42).
function lowerGameVolume() {
  try {
    var g = root.AZUR;
    if (g && g.audio && typeof g.audio.mute === 'function') {
      g.audio.mute(true);
      S.gameMuted = true;
    }
  } catch (e) { /* le jeu reste audible, pas bloquant */ }
}

// Restaure le son du jeu (dispose()).
function restoreGameVolume() {
  try {
    var g = root.AZUR;
    if (S.gameMuted && g && g.audio && typeof g.audio.mute === 'function') {
      g.audio.mute(false);
    }
  } catch (e) { /* ignore */ }
  S.gameMuted = false;
}

/* ------------------------------------------------------------------ */
/* Gestion des sons continus ("hold")                                   */
/* ------------------------------------------------------------------ */

// Arrête un son continu avec un fondu.
function holdStop(name, fade) {
  var h = S.hold[name];
  if (!h) return;
  if (!S.ctx) { S.hold[name] = null; return; }
  var t = now(), d = fade == null ? 1.5 : fade;
  try {
    if (h.gain) {
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setTargetAtTime(0.0001, t, Math.max(0.05, d / 3));
    }
    var stopAt = t + d + 0.3;
    for (var i = 0; i < h.nodes.length; i++) {
      try { h.nodes[i].stop(stopAt); } catch (e) { /* déjà arrêté */ }
    }
  } catch (e) { /* ignore */ }
  S.hold[name] = null;
}

// Tue un son continu IMMÉDIATEMENT, sans fondu (coupure brutale).
function holdKill(name) {
  var h = S.hold[name];
  if (!h) return;
  try {
    for (var i = 0; i < h.nodes.length; i++) {
      try { h.nodes[i].stop(); } catch (e) { /* ignore */ }
    }
    if (h.gain) h.gain.disconnect();
  } catch (e) { /* ignore */ }
  S.hold[name] = null;
}

// Tue TOUS les sons continus immédiatement (coupure brutale).
function killAllHolds() {
  for (var name in S.hold) {
    if (Object.prototype.hasOwnProperty.call(S.hold, name)) holdKill(name);
  }
}

/* ================================================================== */
/* SCORE — partition orchestrale cinématique (la mineur)                */
/* ================================================================== */
// La musique d'ambiance de l'event est une partition orchestrale
// synthétisée, COHÉRENTE du décollage au trou noir :
//   - nappe de cordes graves : progression Am – F – C – G, attaques
//     lentes, passe-bas doux (aucune batterie rock/métal) ;
//   - ostinato de cordes en staccato : densité et tempo montent avec
//     l'intensité 1→5 (firstrocket → acceleration) ;
//   - timbales : coups graves sur les temps forts (niveaux 3+) ;
//   - cuivres doux : accords tenus aux moments clés (zéro du countdown,
//     entrée du strike).
// Pilotage : scoreStart(niveau) / scoreSetLevel(niveau) / scoreStop(),
// appelés aux transitions de phase — aucun temps absolu en dur.

function mtof(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// Progression en la mineur : Am – F – C – G.
// bass = fondamentale grave (MIDI), arp = arpège tendu, pad = nappe.
var SC_CHORDS = [
  { bass: 33, arp: [57, 60, 64, 69], pad: [57, 60, 64] }, // Am
  { bass: 29, arp: [53, 57, 60, 65], pad: [53, 57, 60] }, // F
  { bass: 36, arp: [55, 60, 64, 67], pad: [55, 60, 64] }, // C
  { bass: 31, arp: [55, 59, 62, 67], pad: [55, 59, 62] }  // G
];
// Tempo FIXE : changer de tempo en cours d'ostinato faisait glisser les
// accents hors des temps. L'intensité joue sur la densité, jamais sur la
// pulsation, et chaque changement attend la prochaine barre de mesure.
var SC_BPM = 112;
var SC_STEP = 60 / SC_BPM / 2;           // croche
var SC_BAR_STEPS = 8;                    // mesure 4/4
var SC_CHORD_STEPS = SC_BAR_STEPS * 4;   // un accord = 4 mesures
var SC_CHORD_DUR = SC_CHORD_STEPS * SC_STEP;
var SC_EIGHTH = [0, SC_STEP, SC_STEP, SC_STEP, SC_STEP, SC_STEP];
// Thème original (degrés de l'arpège courant, -1 = silence) : 2 mesures.
var SC_THEME = [0, -1, 2, 3, -1, 2, 1, -1, 0, -1, 3, 4, -1, 3, 2, -1];
var SC_CUT    = [0, 900, 1400, 2000, 2600, 3200]; // filtre passe-bas (Hz) par niveau
var SC_VOL    = [0, 0.55, 0.7, 0.85, 0.95, 1.0];  // volume global par niveau

// Réponse impulsionnelle stéréo d'une grande salle (3,4 s), mise en cache.
function hallImpulse() {
  if (S.hallIR && S.hallIR.sampleRate === S.ctx.sampleRate) return S.hallIR;
  var rate = S.ctx.sampleRate, len = Math.floor(rate * 3.4), buf = S.ctx.createBuffer(2, len, rate);
  for (var c = 0; c < 2; c++) {
    var d = buf.getChannelData(c);
    for (var i = 0; i < len; i++) {
      var k = i / len, early = i < rate * 0.08 ? (Math.random() < 0.004 ? 0.8 : 0) : 0;
      d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - k, 3.2) * (0.6 + 0.4 * Math.exp(-k * 6)) + early) * (c ? 0.97 : 1);
    }
  }
  S.hallIR = buf; return buf;
}
// Démarre la partition (idempotent). Entrée douce : la nappe de cordes
// attaque pendant que le rugissement du décollage est encore présent.
function scoreStart(level) { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running() || S.sc.on) return;
  var t = now();
  var sc = S.sc;
  var bus = S.ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  var filt = S.ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = SC_CUT[1];
  filt.Q.value = 0.9;
  var gStacc = S.ctx.createGain(); gStacc.gain.value = 0.5;
  var gTimp = S.ctx.createGain(); gTimp.gain.value = 0.6;
  var gPad = S.ctx.createGain(); gPad.gain.value = 0.5;
  var gChoir = S.ctx.createGain(); gChoir.gain.value = 0.42;
  var gDrum = S.ctx.createGain(); gDrum.gain.value = 0.7;
  gStacc.connect(filt); gTimp.connect(filt); gPad.connect(filt); gChoir.connect(filt);
  // Salle de concert : réverbération à convolution (réponse générée une fois)
  // — la partition sonne dans un grand espace au lieu d'un synthé sec.
  var verb = S.ctx.createConvolver(); verb.buffer = hallImpulse();
  var wet = S.ctx.createGain(); wet.gain.value = 0.38;
  filt.connect(bus); filt.connect(verb); gDrum.connect(bus); gDrum.connect(verb); verb.connect(wet); wet.connect(bus); bus.connect(S.master);
  sc.verb = verb; sc.gChoir = gChoir; sc.gDrum = gDrum;
  bus.gain.setTargetAtTime(SC_VOL[1] * 0.9, t, 1.6);
  S.hold.score = { gain: bus, nodes: [] };
  sc.bus = bus; sc.filt = filt;
  sc.gStacc = gStacc; sc.gTimp = gTimp; sc.gPad = gPad;
  sc.on = true;
  sc.step = 0;
  sc.nextT = t + 0.15;
  sc.chordIdx = 0;
  sc.level = Math.max(1, Math.min(5, level || 1));
  sc.pendingLevel = 0;
  sc.accent = 0;
  filt.frequency.value = SC_CUT[sc.level];
  bus.gain.setTargetAtTime(SC_VOL[sc.level] * 0.9, t, 1.6);
}

// Accent orchestral (cuivres + timbale) posé sur le prochain temps fort.
function scoreAccent(vol) { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running()) return;
  if (!S.sc.on) { scoreBrassHit(S.sc.chordIdx || 0, vol); return; }
  S.sc.accent = Math.max(S.sc.accent || 0, vol || 0.16);
}

// Change le niveau d'intensité (1..5). Le tempo monte via l'ordonnanceur,
// le filtre s'ouvre et le volume pousse — transitions douces.
function scoreSetLevel(lvl) { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running()) return;
  if (lvl < 1) lvl = 1;
  if (lvl > 5) lvl = 5;
  if (!S.sc.on) { scoreStart(lvl); return; }
  if (lvl === S.sc.level && !S.sc.pendingLevel) return;
  S.sc.pendingLevel = lvl;
}

function applyScoreLevel(lvl, t) {
  var sc = S.sc;
  sc.level = lvl;
  sc.pendingLevel = 0;
  try {
    sc.filt.frequency.setTargetAtTime(SC_CUT[lvl], t, 0.35);
    sc.bus.gain.setTargetAtTime(SC_VOL[lvl] * 0.9, t, 0.35);
  } catch (e) { /* ignore */ }
}

// Stoppe la partition en fondu (transition vers le quasi-silence).
function scoreStop(fade) {
  S.sc.on = false;
  holdStop('score', fade == null ? 2.5 : fade);
}

// --- Accord de cordes : voix à attaque lente, meurt seul après l'accord.
function scorePadChord(idx, at) {
  if (!running() || !S.sc.on) return;
  var t = Math.max(at || 0, now());
  var ch = SC_CHORDS[idx % SC_CHORDS.length];
  var dur = SC_CHORD_DUR;
  // Vibrato lent partagé par les cordes : la nappe respire.
  var lfo = S.ctx.createOscillator(); lfo.frequency.value = 4.6;
  var vib = S.ctx.createGain(); vib.gain.value = 6;
  lfo.connect(vib); lfo.start(t); lfo.stop(t + dur + 0.7);
  if ((S.sc.level || 1) >= 3) scoreChoir(ch, t, dur, S.sc.level >= 5 ? 0.06 : 0.04);
  // Fondamentale grave (octave en dessous) + accord.
  var notes = [ch.bass, ch.pad[0], ch.pad[1], ch.pad[2]];
  for (var n = 0; n < notes.length; n++) {
    for (var d = 0; d < 2; d++) {
      var o = S.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(notes[n]);
      o.detune.value = d === 0 ? -7 : 7; // désaccord : les cordes "battent"
      vib.connect(o.detune);
      var f = S.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 750;
      var g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.075, t + 2.5); // attaque lente
      g.gain.setValueAtTime(0.075, t + Math.max(2.5, dur - 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
      o.connect(f); f.connect(g); g.connect(S.sc.gPad);
      o.start(t); o.stop(t + dur + 0.7);
    }
  }
  // v7 : SUB-BASS profond sous la nappe (sine, une octave sous la
  // fondamentale) — le socle épique de la partition, attaque très lente.
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = mtof(ch.bass - 12);
  var sg = S.ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.11, t + 4);
  sg.gain.setValueAtTime(0.11, t + Math.max(4, dur - 4));
  sg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  sub.connect(sg); sg.connect(S.sc.gPad);
  sub.start(t); sub.stop(t + dur + 0.7);
}

// --- Staccato de cordes : note courte, attaque franche mais filtrée.
function scoreStacc(t, midi, eighth, v) {
  var o = S.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = mtof(midi);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1700;
  var g = S.ctx.createGain();
  var dur = Math.min(0.22, eighth * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(S.sc.gStacc);
  o.start(t); o.stop(t + dur + 0.05);
}

// --- Chœur « aah » : dents de scie filtrées par deux formants de voyelle,
// vibrato léger, attaque très lente. Entre aux niveaux 3+.
function scoreChoir(ch, t, dur, vol) {
  var notes = [ch.pad[0] + 12, ch.pad[1] + 12, ch.pad[2] + 12];
  var out = S.ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vol, t + 3.5);
  out.gain.setValueAtTime(vol, t + Math.max(3.5, dur - 3));
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
  var f1 = S.ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 760; f1.Q.value = 6;
  var f2 = S.ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 7;
  f1.connect(out); f2.connect(out); out.connect(S.sc.gChoir);
  var lfo = S.ctx.createOscillator(); lfo.frequency.value = 5.3; var depth = S.ctx.createGain(); depth.gain.value = 9; lfo.connect(depth);
  lfo.start(t); lfo.stop(t + dur + 0.8);
  for (var n = 0; n < notes.length; n++) for (var v = 0; v < 3; v++) {
    var o = S.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(notes[n]); o.detune.value = (v - 1) * 9;
    depth.connect(o.detune); o.connect(f1); o.connect(f2); o.start(t); o.stop(t + dur + 0.8);
  }
}

// --- Tambour de guerre (taiko) : coup grave et sec, peau + résonance.
function scoreTaiko(t, v) {
  var o = S.ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  var g = S.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g); g.connect(S.sc.gDrum); o.start(t); o.stop(t + 1);
  var n = noiseSource(false), nf = S.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 220; nf.Q.value = 1.2;
  var ng = S.ctx.createGain(); ng.gain.setValueAtTime(v * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  n.connect(nf); nf.connect(ng); ng.connect(S.sc.gDrum); n.start(t); n.stop(t + 0.22);
}

// --- Montée de cymbale (souffle aigu qui enfle jusqu'au temps fort).
function scoreSwell(t, len, v) {
  var n = noiseSource(false), f = S.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(7000, t + len);
  var g = S.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.25);
  n.connect(f); f.connect(g); g.connect(S.sc.gDrum); n.start(t); n.stop(t + len + 0.3);
}

// --- Timbale : sine grave qui chute, coup orchestral (pas de batterie rock).
function scoreTimpani(t, v) {
  var o = S.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(105, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.22);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g); g.connect(S.sc.gTimp);
  o.start(t); o.stop(t + 0.8);
  // Léger "tac" d'attaque (peau).
  var n = noiseSource(false);
  var nf = S.ctx.createBiquadFilter();
  nf.type = 'lowpass'; nf.frequency.value = 500;
  var ng = S.ctx.createGain();
  ng.gain.setValueAtTime(v * 0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  n.connect(nf); nf.connect(ng); ng.connect(S.sc.gTimp);
  n.start(t); n.stop(t + 0.12);
}

// --- v7 : appel de cor héroïque — 4 notes ascendantes (tonique,
// tierce, quinte, octave de l'accord courant), cuivres francs.
function scoreHornCall(t, ch, eighth) {
  if (!running() || !S.sc.on) return;
  var root = ch.bass + 24; // tonique à l'octave des cuivres
  var motif = [0, 4, 7, 12]; // majeur héroïque (relatif)
  // En la mineur, on reste sur les degrés de l'accord : on prend
  // tonique / tierce / quinte de l'arpège + octave.
  var notes = [ch.arp[0] + 12, ch.arp[1] + 12, ch.arp[2] + 12, ch.arp[3] + 12];
  for (var i = 0; i < notes.length; i++) {
    var nt = t + i * eighth * 2;
    var o = S.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(notes[i]);
    var o2 = S.ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = mtof(notes[i]);
    o2.detune.value = 8;
    var f = S.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, nt);
    f.frequency.exponentialRampToValueAtTime(2600, nt + 0.12);
    var g = S.ctx.createGain();
    var dur = eighth * 2.4;
    g.gain.setValueAtTime(0.0001, nt);
    g.gain.exponentialRampToValueAtTime(0.22, nt + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, nt + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(S.sc.gStacc);
    o.start(nt); o.stop(nt + dur + 0.05);
    o2.start(nt); o2.stop(nt + dur + 0.05);
  }
  void root; void motif;
}

// --- Cuivres doux : accord tenu, attaque lente (moments clés).
function scoreBrassHit(chordIdx, vol, at) { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)  if (!running()) return;
  var t = Math.max(at || 0, now()), dur = 5.5;
  var ch = SC_CHORDS[chordIdx % SC_CHORDS.length];
  var notes = [ch.bass + 12, ch.bass + 19, ch.bass + 24]; // fond., quinte, octave
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 1.4); // attaque lente
  g.gain.setValueAtTime(vol || 0.16, t + dur - 2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1050;
  f.connect(g); g.connect(S.master); if (S.sc.on && S.sc.verb) g.connect(S.sc.verb);
  for (var i = 0; i < notes.length; i++) {
    for (var d = 0; d < 2; d++) {
      var o = S.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(notes[i]);
      o.detune.value = d === 0 ? -5 : 5;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
}

// Ordonnanceur : appelé à chaque frame d'update() pendant les phases
// musicales. Planifie ~0,25 s à l'avance sur une grille de croches ;
// fait aussi tourner les accords de la nappe (un accord par durée musicale).
function scheduleScore(dt) { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  var sc = S.sc;
  if (!sc.on || !running()) return;
  void dt;
  var eighth = SC_STEP;
  var horizon = now() + 0.25;
  if (sc.nextT < now() - 0.5) sc.nextT = now() + 0.05; // onglet en veille : on recale
  var guard = 0;
  while (sc.nextT < horizon && guard < 64) {
    guard++;
    var t = sc.nextT, s = sc.step;
    var onBar = s % SC_BAR_STEPS === 0;
    if (onBar && sc.pendingLevel) applyScoreLevel(sc.pendingLevel, t);
    if (s % SC_CHORD_STEPS === 0) {
      if (s > 0) sc.chordIdx = (sc.chordIdx + 1) % SC_CHORDS.length;
      scorePadChord(sc.chordIdx, t);
    }
    var lvl = sc.level;
    var ch = SC_CHORDS[sc.chordIdx % SC_CHORDS.length];
    if (onBar && sc.accent) {
      scoreBrassHit(sc.chordIdx, sc.accent, t);
      scoreTimpani(t, 0.55);
      sc.accent = 0;
    }
    if (lvl < 2) { sc.step++; sc.nextT += eighth; continue; }
    var st16 = s % 16;
    // Thème : entre au niveau 4, doublé à l'octave au niveau 5.
    if (lvl >= 4 && (s % 64) < 16) {
      var deg = SC_THEME[st16];
      if (deg >= 0) {
        var note = deg < 4 ? ch.arp[deg] + 12 : ch.arp[0] + 24;
        scoreStacc(t, note, eighth * 1.8, 0.34);
        if (lvl >= 5) scoreStacc(t, note + 12, eighth * 1.8, 0.18);
      }
    }
    // Ostinato : motif d'arpège montant/descendant, densité selon le niveau.
    var playIt = lvl === 2 ? st16 % 4 === 0
      : lvl === 3 ? st16 % 2 === 0
      : true;
    if (playIt) {
      var an = ch.arp[st16 % 4];
      if (lvl >= 5 && st16 % 2 === 1) an += 12; // octave doublée au maximum
      if (lvl >= 4 && st16 === 14) an = 58;     // Si bémol : tension mineure
      scoreStacc(t, an, eighth, lvl >= 4 ? 0.5 : 0.38);
      // Contre-chant grave sur les temps (niveaux 4+).
      if (lvl >= 4 && st16 % 8 === 0) scoreStacc(t, ch.bass + 12, eighth, 0.4);
    }
    // Timbales sur les temps forts (niveaux 3+) : pulsation orchestrale.
    if (lvl === 3 ? (st16 === 0 || st16 === 8)
        : lvl >= 4 && st16 % 4 === 0) {
      scoreTimpani(t, lvl >= 5 ? 0.5 : 0.38);
    }
    // Tambours de guerre : motif syncopé aux niveaux 4+, roulement au 5.
    if (lvl >= 4 && (st16 === 0 || st16 === 3 || st16 === 6 || st16 === 10 || (lvl >= 5 && (st16 === 12 || st16 === 14)))) scoreTaiko(t, st16 === 0 ? 0.75 : 0.45);
    // Souffle de cymbale qui enfle sur la dernière mesure d'un accord.
    if (lvl >= 3 && s % SC_CHORD_STEPS === SC_CHORD_STEPS - SC_BAR_STEPS) scoreSwell(t, SC_STEP * SC_BAR_STEPS, lvl >= 5 ? 0.08 : 0.05);
    // v7 : APPEL DE COR héroïque au niveau max — motif ascendant
    // (tonique, tierce, quinte, octave) toutes les 2 mesures.
    if (lvl >= 5 && st16 === 0 && (s % 32) === 0) {
      scoreHornCall(t, ch, eighth);
    }
    sc.step++;
    sc.nextT += eighth;
  }
}

/* ================================================================== */
/* COUNTDOWN — tic-tac discret + montée de tension                      */
/* ================================================================== */
// Le zéro du compte à rebours : ALARME SONORE orchestrée (v10, demandée —
// cor d'alerte deux tons qui monte, PAS strident) + roulement de timbales
// qui débouche sur un accord orchestral.
// (Le triangle "!" visuel est géré par un autre module.)

// Un "tic" : impulsion triangulaire très courte et filtrée, discrète.
function playTick(freq) {
  playTickAt(freq, now(), 0.14);
}

// Variante planifiable (attaque à tCtx sur l'horloge audio, volume réglable) :
// sert les sous-divisions rythmiques qui ACCÉLÈRENT vers le zéro.
// v12 : transitoire d'attaque ("clic") — chaque tick claque plus franchement.
function playTickAt(freq, tCtx, vol) {
  if (!running()) return;
  var t = Math.max(tCtx, now());
  var v = (typeof vol === 'number' && isFinite(vol)) ? vol : 0.14;
  var osc = S.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2600;
  osc.connect(f); f.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + 0.1);
  // Clic d'attaque : carré bref à 3x la fréquence, décroissance ultra-rapide.
  var ck = S.ctx.createOscillator();
  ck.type = 'square';
  ck.frequency.value = freq * 3;
  var cg = S.ctx.createGain();
  cg.gain.setValueAtTime(v * 0.35, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
  var cf = S.ctx.createBiquadFilter();
  cf.type = 'highpass';
  cf.frequency.value = 1800;
  ck.connect(cf); cf.connect(cg); cg.connect(S.master);
  ck.start(t); ck.stop(t + 0.04);
}

// Roulement de timbales + accord orchestral doux : marque le zéro du
// compte à rebours SANS alarme (cinématique, pas strident).
function playZeroHit() {
  if (!running()) return;
  var t = now();
  // Roulement : 9 coups de timbale qui accélèrent et montent.
  for (var i = 0; i < 9; i++) {
    var ti = t + i * (0.22 - i * 0.016);
    var o = S.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95 + i * 4, ti);
    o.frequency.exponentialRampToValueAtTime(42, ti + 0.25);
    var g = S.ctx.createGain();
    var v = 0.10 + i * 0.035;
    g.gain.setValueAtTime(v, ti);
    g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.5);
    o.connect(g); g.connect(S.master);
    o.start(ti); o.stop(ti + 0.6);
  }
  // L'accord de la mineur qui s'ouvre (cuivres doux).
  var hitT = t + 1.55;
  var notes = [45, 52, 57, 60, 64]; // A2 E3 A3 C4 E4
  var bg = S.ctx.createGain();
  bg.gain.setValueAtTime(0.0001, hitT);
  bg.gain.exponentialRampToValueAtTime(0.2, hitT + 0.9);
  bg.gain.setValueAtTime(0.2, hitT + 2.6);
  bg.gain.exponentialRampToValueAtTime(0.0001, hitT + 5);
  var bf = S.ctx.createBiquadFilter();
  bf.type = 'lowpass';
  bf.frequency.setValueAtTime(500, hitT);
  bf.frequency.exponentialRampToValueAtTime(2600, hitT + 1.2);
  bf.connect(bg); bg.connect(S.master);
  for (var j = 0; j < notes.length; j++) {
    for (var d = 0; d < 2; d++) {
      var bo = S.ctx.createOscillator();
      bo.type = 'sawtooth';
      bo.frequency.value = mtof(notes[j]);
      bo.detune.value = d === 0 ? -6 : 6;
      bo.connect(bf);
      bo.start(hitT); bo.stop(hitT + 5.2);
    }
  }
  // Nappe de cymbale douce (bruit filtré, attaque lente) : ampleur.
  var n = noiseSource(false);
  var hp = S.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4500;
  var ng = S.ctx.createGain();
  ng.gain.setValueAtTime(0.0001, hitT);
  ng.gain.exponentialRampToValueAtTime(0.07, hitT + 1.1);
  ng.gain.exponentialRampToValueAtTime(0.0001, hitT + 4.5);
  n.connect(hp); hp.connect(ng); ng.connect(S.master);
  n.start(hitT); n.stop(hitT + 4.7);
}

// v10 — ALARME SONORE du zéro (demandée) : cor d'alerte deux tons orchestré
// (392/523 Hz, 3 appels), QUI MONTE en puissance. Timbre de cuivre filtré :
// reconnaissable comme une alarme, sans stridence métallique.
function playZeroAlarm() {
  if (!running()) return;
  var t = now(), dur = 2.9;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.30, t + 1.6); // l'alarme MONTE
  g.gain.setValueAtTime(0.30, t + 2.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1600;
  f.Q.value = 0.8;
  f.connect(g); g.connect(S.master);
  var tones = [392, 523.25, 392, 523.25, 392, 523.25]; // 3 appels deux tons
  for (var i = 0; i < tones.length; i++) {
    (function (fr, ts) {
      var o = S.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = -4;
      var o2 = S.ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = fr / 2; // fondamentale grave : corps de cor
      var og = S.ctx.createGain();
      og.gain.setValueAtTime(0.0001, ts);
      og.gain.exponentialRampToValueAtTime(1, ts + 0.06);
      og.gain.setValueAtTime(1, ts + 0.30);
      og.gain.exponentialRampToValueAtTime(0.0001, ts + 0.40);
      o.connect(og); o2.connect(og); og.connect(f);
      o.start(ts); o2.start(ts);
      o.stop(ts + 0.5); o2.stop(ts + 0.5);
    })(tones[i], t + i * 0.42);
  }
}

// Signal zéro COMPLET (v10) : alarme sonore + roulement + accord.
// Anti-doublon partagé (4 s) : bus 'countdown:alarm' ET repli firstrocket.
function playZeroSignalOnce() {
  if (!running()) return;
  if (now() - S.lastZeroT < 4) return;
  S.lastZeroT = now();
  playZeroAlarm(); // l'alarme demandée : retentit VRAIMENT
  playZeroHit();   // roulement de timbales + accord orchestral
}

/* ------------------------------------------------------------------ */
/* COUNTDOWN — nappe de TENSION MONTANTE (musique d'ambiance)            */
/* ------------------------------------------------------------------ */
// 100 % pilotée par le bus 'countdown:tick' {remaining} : aucune durée
// absolue en dur.
//  - startCountdownPad() : nappe grave immédiate (cordes désaccordées
//    + sub sine, filtre passe-bas qui s'ouvre avec la progression) ;
//  - updateCountdownTension(remaining) : ouvre le filtre, resserre le LFO ;
//  - scheduleCountdownSubTicks() : subdivisions rythmiques qui ACCÉLÈRENT
//    vers le zéro (contre-temps, pas de tic-tac local en parallèle) ;
//  - startCountdownRiser(dur) : montée dramatique (bruit + ton montant,
//    crescendo sur les dernières secondes, dur = remaining au déclenchement) ;
//  - à 'countdown:alarm' (zéro) : la nappe meurt en fondu, le roulement de
//    timbales + l'accord orchestral prennent le relais (PAS d'alarme).

var COUNT_PAD_FMIN = 170;   // filtre fermé : nappe sourde, grave
var COUNT_PAD_FMAX = 4200;  // filtre ouvert à zéro : nappe brillante, tendue

// Nappe de tension : 4 cordes graves désaccordées + sub sine 36 Hz,
// passe-bas qui s'ouvre avec la progression, LFO lent de mouvement.
// Démarre dès l'entrée en 'countdown' : la musique se fait sentir aussitôt.
function startCountdownPad() { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running() || S.hold.countpad) return;
  var t = now();

  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(COUNT_PAD_FMIN, t);

  // LFO lent : la nappe "respire" dès les premières secondes.
  var lfo = S.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.18;
  var lg = S.ctx.createGain();
  lg.gain.value = 60; // profondeur de modulation du filtre
  lfo.connect(lg); lg.connect(f.frequency);

  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 2.2); // entrée immédiate, swell doux

  var nodes = [lfo];
  // Accord grave tendu : fondamentale 55 Hz (A1) désaccordée + quinte + octave.
  var parts = [
    { type: 'sawtooth', freq: 55,   det: -9 },
    { type: 'sawtooth', freq: 55,   det: 9  },
    { type: 'sawtooth', freq: 82.4, det: 5  }, // E2 : la quinte crée la tension
    { type: 'triangle', freq: 110,  det: -4 }  // A2 : l'octave donne du corps
  ];
  for (var i = 0; i < parts.length; i++) {
    var o = S.ctx.createOscillator();
    o.type = parts[i].type;
    o.frequency.value = parts[i].freq;
    o.detune.value = parts[i].det;
    o.connect(f);
    o.start(t);
    nodes.push(o);
  }
  // Sub sine 36 Hz : le grave qui se fait sentir physiquement.
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 36;
  var subg = S.ctx.createGain();
  subg.gain.value = 0.5;
  sub.connect(subg); subg.connect(g);
  sub.start(t);
  nodes.push(sub);

  f.connect(g); g.connect(S.master);
  S.hold.countpad = { gain: g, nodes: nodes, filter: f, lfoGain: lg };
}

// Ouvre le filtre passe-bas selon la progression (0 → 1) déduite du bus.
// Appelée à chaque 'countdown:tick' : aucun temps absolu en dur.
function updateCountdownTension(remaining) {
  var h = S.hold.countpad;
  if (!h || !h.filter || !running()) return;
  // Référence = premier 'remaining' vu ; repli relatif si inconnu.
  var base = S.countBase > 0 ? S.countBase : (remaining > 0 ? remaining : 1);
  var k = 1 - remaining / base;
  k = clamp(k, 0, 1);
  var t = now();
  // Ouverture exponentielle du filtre : 170 Hz → 4200 Hz.
  var fc = COUNT_PAD_FMIN * Math.pow(COUNT_PAD_FMAX / COUNT_PAD_FMIN, k);
  try {
    h.filter.frequency.cancelScheduledValues(t);
    h.filter.frequency.setTargetAtTime(fc, t, 0.5);
    // Le LFO respire plus vite et plus fort quand la tension monte.
    h.lfoGain.gain.setTargetAtTime(60 + k * 160, t, 0.5);
  } catch (e) { /* ignore */ }
}

// Subdivisions rythmiques qui ACCÉLÈRENT vers le zéro, planifiées sur
// l'horloge audio à partir du tic principal (contre-temps, pas de doublon).
function scheduleCountdownSubTicks(remaining, pitch) {
  if (!running()) return;
  var t = now();
  if (remaining <= 8 && remaining > 5) {
    // Demi-temps : un contre-tic discret.
    playTickAt(pitch * 1.06, t + 0.5, 0.08);
  } else if (remaining <= 5 && remaining > 3) {
    // Quarts : le rythme se resserre.
    playTickAt(pitch * 1.06, t + 0.25, 0.08);
    playTickAt(pitch * 1.12, t + 0.5, 0.09);
    playTickAt(pitch * 1.06, t + 0.75, 0.08);
  } else if (remaining <= 3 && remaining > 0) {
    // Rafale finale : 4 frappes montantes dans la seconde.
    playTickAt(pitch * 1.06, t + 0.2, 0.09);
    playTickAt(pitch * 1.14, t + 0.4, 0.10);
    playTickAt(pitch * 1.22, t + 0.6, 0.11);
    playTickAt(pitch * 1.30, t + 0.8, 0.12);
  }
}

// v21 : TIC SUB — sous les 5 derniers tics du compte à rebours, un sub-grave
// (58 → 40 Hz, 0,5 s) bat SOUS le tic audible : chaque seconde « pèse ».
// Joué par onCountdownTick quand remaining <= 5.
function playTickSub() {
  if (!running()) return;
  var t = now(), dur = 0.5;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(58, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

// Montée dramatique : bruit filtré qui balaie vers l'aigu + ton montant,
// crescendo sur 'dur' secondes (dur = remaining au déclenchement).
function startCountdownRiser(dur) {
  if (!running() || S.hold.countriser) return;
  dur = clamp(dur || 4, 1.5, 8); // bornes de sécurité, pas un temps d'event
  var t = now();

  // 1) Bruit : passe-bande qui monte 400 → 6000 Hz.
  var src = noiseSource(true);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.3;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + dur);

  // 2) Ton montant : scie 110 → 440 Hz (deux octaves), désaccordée.
  var tone = S.ctx.createOscillator();
  tone.type = 'sawtooth';
  tone.frequency.setValueAtTime(110, t);
  tone.frequency.exponentialRampToValueAtTime(440, t + dur);
  tone.detune.value = 6;
  var tf = S.ctx.createBiquadFilter();
  tf.type = 'lowpass';
  tf.frequency.setValueAtTime(900, t);
  tf.frequency.exponentialRampToValueAtTime(7000, t + dur);

  // 3) Crescendo commun : 0 → 0.45, qui culmine exactement à zéro.
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + dur);

  src.connect(bp); bp.connect(g);
  tone.connect(tf); tf.connect(g);
  g.connect(S.master);
  src.start(t); tone.start(t);
  S.hold.countriser = { gain: g, nodes: [src, tone] };
}

// Stoppe la musique du countdown (nappe + riser).
function stopCountdownMusic(fade) {
  holdStop('countpad', fade == null ? 1.5 : fade);
  holdStop('countriser', 0.4);
}

// event-countdown.js émet 'countdown:tick' {remaining, pitch} chaque seconde
// pendant le compte à rebours : on joue le tic-tac discret au pitch fourni
// (700 → 1300 Hz), on ouvre la nappe de tension, on resserre le rythme
// (subdivisions qui accélèrent) et on lance la montée dramatique finale.
// PAS de tic-tac local en parallèle : tout est dérivé du bus.
function onCountdownTick(d) {
  if (!AZE.active) return;
  S.countdownHeard = true;
  var remaining = (d && typeof d.remaining === 'number' && isFinite(d.remaining)) ? d.remaining : -1;
  // Référence de progression = premier 'remaining' vu (pas de durée en dur).
  if (S.countBase <= 0 && remaining > 0) S.countBase = remaining;
  var pitch = 700;
  if (d && typeof d.pitch === 'number' && isFinite(d.pitch)) {
    pitch = d.pitch;
  } else if (remaining >= 0 && S.countBase > 0) {
    pitch = 700 + clamp(1 - remaining / S.countBase, 0, 1) * 600; // 700 → 1300 Hz
  }
  // v15 : la progression s'AMPLIFIE — le volume des tics monte avec le
  // pitch (0.14 → 0.36) : chaque seconde tape plus fort que la précédente.
  var progK = (remaining >= 0 && S.countBase > 0) ? clamp(1 - remaining / S.countBase, 0, 1) : 0;
  var tickVol = 0.14 + progK * 0.22;
  playTickAt(pitch, now(), tickVol);
  if (remaining >= 0) {
    updateCountdownTension(remaining);           // la nappe s'ouvre
    scheduleCountdownSubTicks(remaining, pitch); // le rythme accélère
    // v21 : sous les 5 derniers tics, un sub-grave bat SOUS le tic audible —
    // chaque seconde « pèse » avant le zéro.
    if (remaining <= 5 && remaining > 0) playTickSub();
    if (remaining <= 3 && remaining > 0) {
      // v15 : les 3 dernières secondes battent DEUX fois par seconde —
      // le cœur du compte à rebours s'emballe.
      playTickAt(pitch * 1.02, now() + 0.5, tickVol * 0.75);
    }
    if (!S.countRiserOn && remaining <= 4 && remaining > 0) {
      S.countRiserOn = true;
      startCountdownRiser(remaining);            // montée dramatique : ~'remaining' s
    }
  }
}

// event-countdown.js émet 'countdown:alarm' à zéro : ALARME SONORE (v10,
// demandée — cor deux tons qui monte) + nappe de tension qui meurt en
// fondu + roulement de timbales + accord orchestral.
function onZeroCue() {
  if (!AZE.active) return;
  S.zeroHeard = true;
  holdStop('countriser', 0.25);
  holdStop('countpad', 1.0);
  S.countRiserOn = false;
  playZeroSignalOnce();
}

/* ================================================================== */
/* DÉCOLLAGE — allumage, rugissement, vrombissement de faille            */
/* ================================================================== */

// Allumage : grondement grave qui démarre sec (attaque rapide).
function startIgnition() {
  if (!running() || S.hold.ignition) return;
  var t = now();
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 140;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 1.2);
  src.connect(f); f.connect(g); g.connect(S.master);
  src.start(t);
  S.hold.ignition = { gain: g, nodes: [src] };
}

// Rugissement du décollage : bruit bouclé + passe-bas qui s'ouvre (crescendo).
// 'dur' = durée RELATIVE à la phase d'appel (pas un temps absolu d'event).
function startLaunchRoar(dur) {
  if (!running() || S.hold.roar) return;
  dur = dur || 24;
  var t = now();
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(90, t);
  f.frequency.exponentialRampToValueAtTime(950, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.38, t + dur);
  src.connect(f); f.connect(g); g.connect(S.master);
  src.start(t);
  S.hold.roar = { gain: g, nodes: [src] };
  // v7 : SUB physique sous le rugissement (55 → 28 Hz) — on le SENT.
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, t);
  sub.frequency.exponentialRampToValueAtTime(28, t + dur);
  var subg = S.ctx.createGain();
  subg.gain.setValueAtTime(0.0001, t);
  subg.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.7);
  sub.connect(subg); subg.connect(g); // suit le fondu du rugissement
  sub.start(t);
  S.hold.roar.nodes.push(sub);
}

// Vrombissement de la faille : scie grave 55 Hz + LFO + souffle, doux.
function startRiftHum() {
  if (!running() || S.hold.rifthum) return;
  var t = now();
  var osc = S.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 55;
  var lfo = S.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.6;
  var lg = S.ctx.createGain();
  lg.gain.value = 14;
  lfo.connect(lg); lg.connect(osc.frequency);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 320;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 3);
  osc.connect(f); f.connect(g); g.connect(S.master);
  osc.start(t); lfo.start(t);
  S.hold.rifthum = { gain: g, nodes: [osc, lfo] };
}

/* ================================================================== */
/* FUSÉES & FAILLES — whooshes, scintillements, pulsations              */
/* ================================================================== */

// Chuintement : bruit en passe-bande qui balaie vers le haut (passage).
function spatialPan(pos) {
  var cam = root.AZUR && root.AZUR.view && root.AZUR.view.camera;
  if (!cam || !pos) return 0;
  var dx = pos.x - cam.position.x, dy = pos.y - cam.position.y, dz = pos.z - cam.position.z, elements = cam.matrixWorld.elements;
  return clamp((dx * elements[0] + dy * elements[1] + dz * elements[2]) / Math.max(1, Math.hypot(dx, dy, dz)), -0.85, 0.85);
}
function playWorldAccent(kind, data) {
  if (!running()) return;
  data = data || {}; var t = now(), strength = clamp(data.strength || 0.5, 0.1, 1), duration = kind === 'resonance' ? 2.1 : kind === 'stage' ? 0.55 : 1.15;
  var g = S.ctx.createGain(), filter = S.ctx.createBiquadFilter(), src = noiseSource(false), nodes = [src, filter, g];
  filter.type = kind === 'resonance' ? 'lowpass' : 'bandpass'; filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(kind === 'resonance' ? 420 : 1200, t); filter.frequency.exponentialRampToValueAtTime(kind === 'resonance' ? 150 : 2800, t + duration * 0.3); filter.frequency.exponentialRampToValueAtTime(220, t + duration);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((kind === 'resonance' ? 0.085 : 0.11) * strength, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter); filter.connect(g);
  var pan = typeof S.ctx.createStereoPanner === 'function' ? S.ctx.createStereoPanner() : null;
  if (pan) { pan.pan.value = spatialPan(data.pos); g.connect(pan); pan.connect(S.master); if (S.space) pan.connect(S.space); nodes.push(pan); }
  else { g.connect(S.master); if (S.space) g.connect(S.space); }
  var voices = kind === 'resonance' ? [55, 82.41, 110] : [110, 164.81];
  voices.forEach(function (frequency, index) { var tone = S.ctx.createOscillator(), gain = S.ctx.createGain(); tone.type = kind === 'rift' ? 'triangle' : 'sine'; tone.frequency.setValueAtTime(frequency * (1 + strength * 0.15), t); tone.frequency.exponentialRampToValueAtTime(frequency * 0.65, t + duration); gain.gain.value = 0.24 / (index + 1); tone.connect(gain); gain.connect(g); tone.start(t); tone.stop(t + duration + 0.02); nodes.push(tone, gain); });
  src.onended = function () { nodes.forEach(function (node) { try { node.disconnect(); } catch (e) {} }); }; src.start(t); src.stop(t + duration + 0.04);
}
function playWhoosh(options) {
  if (!running()) return;
  options = options || {};
  var t = now(), dur = options.duration ? clamp(options.duration * 0.45, 0.45, 1.2) : rand(0.7, 1.2);
  var src = noiseSource(false);
  src.playbackRate.value = rand(0.9, 1.3);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.6;
  bp.frequency.setValueAtTime(rand(500, 900), t);
  bp.frequency.exponentialRampToValueAtTime(rand(3500, 5000), t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime((options.pos ? 0.13 : rand(0.13, 0.2)) * (options.strength || 1), t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  var pan = null;
  if (typeof S.ctx.createStereoPanner === 'function') {
    pan = S.ctx.createStereoPanner();
    var startPan = options.pos ? spatialPan(options.pos) : rand(-0.85, 0.85);
    pan.pan.setValueAtTime(startPan, t);
    pan.pan.linearRampToValueAtTime(options.end ? spatialPan(options.end) : -startPan, t + dur);
  }
  src.connect(bp); bp.connect(g);
  if (pan) { g.connect(pan); pan.connect(S.master); }
  else g.connect(S.master);
  src.onended = function () { src.disconnect(); bp.disconnect(); g.disconnect(); if (pan) pan.disconnect(); };
  src.start(t); src.stop(t + dur + 0.05);
}

// Scintillement cristallin des failles : partiels de sine aigus, attaque
// lente, volume doux — la magie des failles, jamais agressive.
function playRiftShimmer() {
  if (!running()) return;
  var t = now(), dur = rand(2.2, 3.2);
  // Registre cristallin doux (G6 → E7).
  var bases = [1567.98, 1760.0, 2093.0, 2349.3, 2637.0];
  var f0 = bases[Math.floor(Math.random() * bases.length)];
  var parts = [
    { m: 1, v: 1.0 },
    { m: 2, v: 0.35 },
    { m: 3, v: 0.15 }
  ];
  var peak = rand(0.05, 0.085);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.7); // attaque lente : doux
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(S.master);
  for (var i = 0; i < parts.length; i++) {
    var o = S.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f0 * parts[i].m;
    var og = S.ctx.createGain();
    og.gain.value = parts[i].v;
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + dur + 0.1);
  }
}

// Pulsation de faille : battement grave bref (bus 'rocket:rift-enter').
function playRiftPulse() {
  if (!running()) return;
  var t = now(), dur = 0.5;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(72, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

/* ================================================================== */
/* MÉTÉORITE — grondement grave, sifflement, lasers                     */
/* ================================================================== */

// Grondement grave de la météorite : sine très basse + bruit très filtré.
function startMeteorRumble() {
  if (!running() || S.hold.meteorrumble) return;
  var t = now();
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(26, t);
  osc.frequency.linearRampToValueAtTime(40, t + 8);
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 90;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 6);
  osc.connect(g);
  src.connect(f); f.connect(g);
  g.connect(S.master);
  osc.start(t); src.start(t);
  S.hold.meteorrumble = { gain: g, nodes: [osc, src] };
}

// Sifflement de descente : sine qui chute, doux puis menaçant.
// v15 : paramétré (fréquences + volume) pour les plongées de la fusée et
// de la météorite — playWhistle garde son comportement d'origine.
function playDiveWhistle(dur, f0, f1, vol) {
  if (!running()) return;
  var t = now();
  dur = dur || 12; // durée relative à la phase d'appel
  f0 = f0 || 1400; f1 = f1 || 280;
  vol = (typeof vol === 'number' && isFinite(vol)) ? vol : 0.1;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  // v15 : léger vibrato — le sifflement "tremble" comme une chute réelle.
  var vib = S.ctx.createOscillator();
  vib.type = 'sine';
  vib.frequency.value = 5.5;
  var vg = S.ctx.createGain();
  vg.gain.value = f0 * 0.03;
  vib.connect(vg); vg.connect(osc.frequency);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(2, dur * 0.25));
  g.gain.setValueAtTime(vol, t + Math.max(dur * 0.25, dur - 1));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); vib.start(t);
  osc.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
}
function playWhistle(dur) {
  playDiveWhistle(dur || 12, 1400, 280, 0.1);
}

// Bourdonnement des lasers : scie 180 Hz modulée en amplitude, contenu.
function startLaserBuzz() {
  if (!running() || S.hold.laser) return;
  var t = now();
  var osc = S.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 180;
  var am = S.ctx.createOscillator();
  am.type = 'sine';
  am.frequency.value = 25;
  var amg = S.ctx.createGain();
  amg.gain.value = 0.5;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 1.5);
  am.connect(amg); amg.connect(g.gain);
  osc.connect(g); g.connect(S.master);
  osc.start(t); am.start(t);
  S.hold.laser = { gain: g, nodes: [osc, am] };
}

/* ================================================================== */
/* DÉTONATIONS — booms, implosion, impact                               */
/* ================================================================== */

// Détonation : burst de bruit + sine grave qui décroît. power = échelle.
// v47 — montée de charge du Point Zéro : scie filtrée qui grimpe en hurlant.
function playBusLaserCharge() {
  if (!running()) return;
  var t = now(), dur = 2.4;
  var osc = S.ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t); osc.frequency.exponentialRampToValueAtTime(1500, t + dur);
  var bp = S.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5;
  bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(3400, t + dur);
  var g = S.ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  osc.connect(bp); bp.connect(g); g.connect(S.master); osc.start(t); osc.stop(t + dur + 0.1);
}

// v47 — le rayon : deux carrés désaccordés modulés très vite + souffle aigu.
function playBusLaser() {
  if (!running()) return;
  var t = now(), dur = 1.9;
  [0, 9].forEach(function (detune) {
    var o = S.ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(240 + detune, t); o.frequency.exponentialRampToValueAtTime(130 + detune, t + dur);
    var lfo = S.ctx.createOscillator(); lfo.frequency.value = 36 + detune; var depth = S.ctx.createGain(); depth.gain.value = 55;
    lfo.connect(depth); depth.connect(o.frequency);
    var lp = S.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
    var g = S.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
    g.gain.setValueAtTime(0.08, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(S.master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  });
  var n = noiseSource(false), hp = S.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
  var ng = S.ctx.createGain(); ng.gain.setValueAtTime(0.13, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(hp); hp.connect(ng); ng.connect(S.master); n.start(t); n.stop(t + dur + 0.1);
}

function playBoom(power) {
  if (!running()) return;
  power = power || 1;
  var t = now();

  // 0) v12 : CRAC d'attaque — bruit aigu très bref qui claque AVANT le corps
  // de l'explosion (attaque franche, pas de montée molle).
  var csrc = noiseSource(false);
  var chp = S.ctx.createBiquadFilter();
  chp.type = 'highpass';
  chp.frequency.value = 2800;
  var chg = S.ctx.createGain();
  chg.gain.setValueAtTime(0.38 * power, t);
  chg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  csrc.connect(chp); chp.connect(chg); chg.connect(S.master);
  csrc.start(t); csrc.stop(t + 0.12);

  // 1) Burst de bruit : l'attaque de l'explosion.
  var nDur = 1.2 * power;
  var nsrc = noiseSource(false);
  var nf = S.ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.setValueAtTime(2500, t);
  nf.frequency.exponentialRampToValueAtTime(60, t + nDur);
  var ng = S.ctx.createGain();
  ng.gain.setValueAtTime(0.6 * power, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + nDur);
  nsrc.connect(nf); nf.connect(ng); ng.connect(S.master);
  nsrc.start(t); nsrc.stop(t + nDur + 0.1);

  // 2) Sine grave (~48 Hz) qui décroît : le "poids" de la détonation.
  var sDur = 2.8 * power;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(48, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + sDur);
  var sg = S.ctx.createGain();
  sg.gain.setValueAtTime(0.58 * power, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + sDur);
  osc.connect(sg); sg.connect(S.master);
  osc.start(t); osc.stop(t + sDur + 0.1);

  // 3) Sub-bass supplémentaire pour les grosses explosions (power > 1.2).
  if (power > 1.2) {
    var sub = S.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(34, t);
    sub.frequency.exponentialRampToValueAtTime(22, t + sDur * 1.4);
    var subg = S.ctx.createGain();
    subg.gain.setValueAtTime(0.48, t);
    subg.gain.exponentialRampToValueAtTime(0.0001, t + sDur * 1.4);
    sub.connect(subg); subg.connect(S.master);
    sub.start(t); sub.stop(t + sDur * 1.4 + 0.1);
  }

  // 4) v13 : SECOND SOUFFLE — un "coup de poitrine" grave retardé (~0,32 s
  // après l'attaque) qui double la détonation : le boom "re-claque".
  if (power >= 0.6) {
    var t2 = t + 0.32;
    var th = S.ctx.createOscillator();
    th.type = 'sine';
    th.frequency.setValueAtTime(62, t2);
    th.frequency.exponentialRampToValueAtTime(30, t2 + 0.55);
    var thg = S.ctx.createGain();
    thg.gain.setValueAtTime(0.0001, t2);
    thg.gain.linearRampToValueAtTime(0.34 * power, t2 + 0.015);
    thg.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.55);
    th.connect(thg); thg.connect(S.master);
    th.start(t2); th.stop(t2 + 0.65);
  }
}

// Implosion de la grande faille : boom grave énorme + fracas + résonance
// (écho long qui meurt seul). Reste LE moment le plus fort, sous le limiteur.
function playImplosion() {
  if (!running()) return;
  var t = now();

  playBoom(1.8);

  // Fracas — salve de bruit aigu qui claque.
  var nsrc = noiseSource(false);
  var hp = S.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  var hg = S.ctx.createGain();
  hg.gain.setValueAtTime(0.36, t);
  hg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  nsrc.connect(hp); hp.connect(hg); hg.connect(S.master);
  nsrc.start(t); nsrc.stop(t + 1.8);

  // Résonance — le boom reboucle dans un écho long.
  var delay = S.ctx.createDelay(2.0);
  delay.delayTime.value = 0.55;
  var fb = S.ctx.createGain();
  fb.gain.value = 0.55;
  var wet = S.ctx.createGain();
  wet.gain.value = 0.32;
  delay.connect(fb); fb.connect(delay);
  delay.connect(wet); wet.connect(S.master);
  var rsrc = noiseSource(false);
  var rf = S.ctx.createBiquadFilter();
  rf.type = 'lowpass';
  rf.frequency.value = 400;
  var rg = S.ctx.createGain();
  rg.gain.setValueAtTime(0.42, t);
  rg.gain.exponentialRampToValueAtTime(0.0001, t + 4);
  rsrc.connect(rf); rf.connect(rg); rg.connect(delay);
  rsrc.start(t); rsrc.stop(t + 4.1);
  // L'écho meurt seul : on coupe le graphe après 8 s (timeout suivi).
  S.pending.push(setTimeout(function () {
    try { delay.disconnect(); fb.disconnect(); wet.disconnect(); } catch (e) { /* ignore */ }
  }, 8000));
}

// IMPACT — coup MASSIF : sub-bass profond qui descend, crash saturé,
// nappe d'énergie en la mineur. Puis le calme (startImpactCalm).
function playImpactHit() {
  if (!running()) return;
  var t = now();

  // 1) Sub-bass profond qui descend : sine 90 → 18 Hz sur ~7 s, très présent.
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(90, t);
  sub.frequency.exponentialRampToValueAtTime(18, t + 7);
  var sg = S.ctx.createGain();
  sg.gain.setValueAtTime(0.9, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 7);
  sub.connect(sg); sg.connect(S.master);
  sub.start(t); sub.stop(t + 7.2);

  // 2) Crash saturé : bruit blanc écrasé par saturation (waveshaper tanh).
  var nsrc = noiseSource(false);
  var cf = S.ctx.createBiquadFilter();
  cf.type = 'lowpass';
  cf.frequency.setValueAtTime(9000, t);
  cf.frequency.exponentialRampToValueAtTime(280, t + 3.5);
  var cg = S.ctx.createGain();
  cg.gain.setValueAtTime(0.55, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  if (typeof S.ctx.createWaveShaper === 'function') {
    var curve = new Float32Array(256);
    for (var i = 0; i < 256; i++) {
      var x = i / 128 - 1;
      curve[i] = Math.tanh(14 * x);
    }
    var shaper = S.ctx.createWaveShaper();
    shaper.curve = curve;
    nsrc.connect(shaper); shaper.connect(cf);
  } else {
    nsrc.connect(cf);
  }
  cf.connect(cg); cg.connect(S.master);
  nsrc.start(t); nsrc.stop(t + 3.7);

  // 3) Nappe d'énergie : accord large en la mineur, montée douce puis extinction.
  var padG = S.ctx.createGain();
  padG.gain.setValueAtTime(0.0001, t + 0.3);
  padG.gain.exponentialRampToValueAtTime(0.18, t + 3);
  padG.gain.exponentialRampToValueAtTime(0.0001, t + 10);
  padG.connect(S.master);
  var notes = [55, 82.41, 110, 164.81, 220]; // A1 E2 A2 E3 A3
  for (var j = 0; j < notes.length; j++) {
    var o = S.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = notes[j];
    o.detune.value = rand(-7, 7);
    var pf = S.ctx.createBiquadFilter();
    pf.type = 'lowpass';
    pf.frequency.value = 850;
    o.connect(pf); pf.connect(padG);
    o.start(t + 0.3); o.stop(t + 10.2);
  }
}

// Après le BOOM : le calme. Nappe basse douce en la mineur, très contenue.
function startImpactCalm() {
  if (!running() || S.hold.impactcalm) return;
  var t = now();
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 520;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 5); // montée très lente
  var nodes = [];
  var notes = [55, 82.41, 110, 130.81]; // A1 E2 A2 C3
  for (var i = 0; i < notes.length; i++) {
    var o = S.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = notes[i];
    o.detune.value = rand(-6, 6);
    o.connect(f);
    o.start(t);
    nodes.push(o);
  }
  f.connect(g); g.connect(S.master);
  S.hold.impactcalm = { gain: g, nodes: nodes };
}

/* ================================================================== */
/* v15 — SYNCHRONISATION ÉVÉNEMENTIELLE (chaque temps fort visuel = son)  */
/* ================================================================== */
// Ces sons répondent aux événements du bus que les autres modules
// émettent RÉELLEMENT (vérifiés par grep des emit() le 2026-10-01) :
//   'shockwave:burst' {opts:{radius}} — impact.js (r=2600, échelle de
//     l'île), meteor.js (éruption du rebond, r=800), rockets.js
//     (dégel r=520, zeroshock r=1300) ;
//   'meteor:rebound' / 'meteor:unfreeze' — event-meteor.js / event-rockets.js ;
//   'rocket:zeroshock' — la fusée ENTRE dans le Point Zéro (propulsion) ;
//   'rocket:pass' — une fusée frôle la météorite (anti-doublon 3 s) ;
//   'zeropoint:destroyed' — l'orbe est détruite par la météorite ;
//   'impact:playerblast' — le joueur est projeté (vent, pas de boom :
//     le boom vient déjà de 'shockwave:burst') ;
//   'suction:start' / 'suction:end' — event-suction.js ;
//   'rift:cross' kind 'escape' — les fusées fuient par les failles (anti-doublon).
// Règle : JAMAIS de boom là où un 'shockwave:burst' est émis dans le même
// tick (sinon triplé) — chaque écoute apporte une COUCHE DISTINCTE.

// Détonation PROFONDE en couches + réverbération : la réponse sonore de
// 'shockwave:burst'. power déduit de opts.radius (2600 → ~2.2, 520 → ~1).
function playDeepBoom(power) {
  if (!running()) return;
  power = clamp(power || 1, 0.6, 2.2);
  var t = now();

  playBoom(power); // les 5 couches existantes (crac + burst + sine + sub + 2e souffle)

  // v15 : RÉVERBÉRATION — le boom reboucle dans un écho court qui meurt
  // seul (graphe coupé par timeout suivi, dispose-safe).
  var delay = S.ctx.createDelay(1.0);
  delay.delayTime.value = 0.34;
  var fb = S.ctx.createGain();
  fb.gain.value = 0.45;
  var wet = S.ctx.createGain();
  wet.gain.value = 0.22 * Math.min(1, power);
  delay.connect(fb); fb.connect(delay);
  delay.connect(wet); wet.connect(S.master);
  var rsrc = noiseSource(false);
  var rf = S.ctx.createBiquadFilter();
  rf.type = 'lowpass';
  rf.frequency.setValueAtTime(900, t);
  rf.frequency.exponentialRampToValueAtTime(120, t + 2.2);
  var rg = S.ctx.createGain();
  rg.gain.setValueAtTime(0.3 * power, t);
  rg.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  rsrc.connect(rf); rf.connect(rg); rg.connect(delay);
  rsrc.start(t); rsrc.stop(t + 2.4);
  S.pending.push(setTimeout(function () {
    try { delay.disconnect(); fb.disconnect(); wet.disconnect(); } catch (e) { /* ignore */ }
  }, 6000));

  // v15 : couche SUB supplémentaire très profonde (32 → 20 Hz) — le boom
  // se SENT autant qu'il s'entend.
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(32, t);
  sub.frequency.exponentialRampToValueAtTime(20, t + 3.2);
  var subg = S.ctx.createGain();
  subg.gain.setValueAtTime(0.5 * Math.min(1, power), t);
  subg.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  sub.connect(subg); subg.connect(S.master);
  sub.start(t); sub.stop(t + 3.4);
}

// Éruption du REBOND ('meteor:rebound', début de l'émergence) : grondement
// qui MONTE + scintillement ascendant. Le boom de l'éruption arrive juste
// après via 'shockwave:burst' — ici, l'ANTICIPATION qui monte.
function playReboundEruption() {
  if (!running()) return;
  var t = now(), dur = 2.6;
  // Grondement qui monte (30 → 70 Hz).
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(30, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + dur);
  var og = S.ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.34, t + dur);
  osc.connect(og); og.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.1);
  // Scintillement ASCENDANT : partiels qui glissent vers l'aigu (l'éruption
  // monte très haut, au-delà de la carte).
  var bases = [660, 880, 1174.7];
  for (var i = 0; i < bases.length; i++) {
    (function (f0) {
      var o = S.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 4, t + dur);
      var g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(S.master);
      o.start(t); o.stop(t + dur + 0.1);
    })(bases[i]);
  }
}

// Réveil de la météorite ('meteor:unfreeze') : la glace craque — grondement
// sourd qui enfle + sifflement de CHUTE (elle plonge dans la faille avant).
// Le boom vient déjà de 'shockwave:burst' (r=520) : pas de doublon.
function playUnfreezeAwaken() {
  if (!running()) return;
  var t = now(), dur = 3.2;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(26, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + dur);
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(90, t);
  f.frequency.exponentialRampToValueAtTime(500, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + dur);
  osc.connect(g);
  src.connect(f); f.connect(g);
  g.connect(S.master);
  osc.start(t); src.start(t);
  S.pending.push(setTimeout(function () {
    try { osc.stop(); src.stop(); } catch (e) { /* ignore */ }
  }, Math.ceil((dur + 0.5) * 1000)));
  // La météorite PLONGE : sifflement de chute.
  playDiveWhistle(9, 1500, 260, 0.11);
}

// La fusée ENTRE dans le Point Zéro ('rocket:zeroshock') : le joueur est
// PROPULSÉ — vent ascendant violent + crac d'attaque + sub qui claque.
// L'explosion elle-même vient de 'shockwave:burst' (r=1300) : ici, la
// SENSATION d'être projeté très haut et très loin.
function playZeroShockWind() {
  if (!running()) return;
  var t = now(), dur = 1.7;
  // Crac d'attaque : le contact claque.
  var csrc = noiseSource(false);
  var chp = S.ctx.createBiquadFilter();
  chp.type = 'highpass';
  chp.frequency.value = 2400;
  var chg = S.ctx.createGain();
  chg.gain.setValueAtTime(0.4, t);
  chg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  csrc.connect(chp); chp.connect(chg); chg.connect(S.master);
  csrc.start(t); csrc.stop(t + 0.14);
  // Vent ascendant : balaie 300 → 7000 Hz, fort — on est HAPPÉ vers le haut.
  var src = noiseSource(false);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(S.master);
  src.start(t); src.stop(t + dur + 0.1);
  // Sub qui claque sous le vent (70 → 30 Hz).
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, t);
  sub.frequency.exponentialRampToValueAtTime(30, t + 1.1);
  var sg = S.ctx.createGain();
  sg.gain.setValueAtTime(0.5, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  sub.connect(sg); sg.connect(S.master);
  sub.start(t); sub.stop(t + 1.2);
}

// Le Point Zéro est DÉTRUIT ('zeropoint:destroyed') : l'orbe meurt —
// scintillement cristallin qui DESCEND et s'éteint + coup sourd. Pas de
// boom : l'explosion de l'impact est déjà jouée ('shockwave:burst' r=2600).
function playZeroPointDestroyed() {
  if (!running()) return;
  var t = now(), dur = 2.4;
  var bases = [2093.0, 1760.0, 1318.5];
  for (var i = 0; i < bases.length; i++) {
    (function (f0) {
      var o = S.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.25, t + dur);
      var g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(S.master);
      o.start(t); o.stop(t + dur + 0.1);
    })(bases[i]);
  }
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, t);
  sub.frequency.exponentialRampToValueAtTime(30, t + 0.8);
  var sg = S.ctx.createGain();
  sg.gain.setValueAtTime(0.3, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  sub.connect(sg); sg.connect(S.master);
  sub.start(t); sub.stop(t + 0.9);
}

// Le joueur est PROJETÉ ('impact:playerblast') : souffle d'air énorme,
// pas de boom (déjà joué par 'shockwave:burst' dans le même tick).
function playPlayerBlastWind() {
  if (!running()) return;
  var t = now(), dur = 2.0;
  var src = noiseSource(false);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(180, t);
  bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.48, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(S.master);
  src.start(t); src.stop(t + dur + 0.1);
}

/* ================================================================== */
/* v16 — TÉLÉGRAPHES D'AVERTISSEMENT ('warn:*', event-player.js)        */
/* ================================================================== */
// Montée d'alerte ~2 s AVANT chaque impulsion subie (zéroschock, onde de
// 'thrown', projection 'veeroff', blast d'impact, aspiration) : ton montant
// + couche grave qui enfle, ATTAQUE PROGRESSIVE (pas d'apparition sèche) et
// retombée propre. Le grand moment arrive ensuite — il est toujours AMENÉ.
function playWarnRiser(dur) {
  if (!running()) return;
  dur = dur || 2;
  var t = now();
  // Ton montant : 520 → 1040 Hz, l'urgence monte.
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(1040, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.6); // attaque progressive
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15); // retombée
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.25);
  // Couche grave qui enfle : le corps sent la charge (55 → 110 Hz).
  var sub = S.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, t);
  sub.frequency.exponentialRampToValueAtTime(110, t + dur);
  var sg = S.ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.7); // attaque progressive
  sg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15); // retombée
  sub.connect(sg); sg.connect(S.master);
  sub.start(t); sub.stop(t + dur + 0.25);
}

// v20 — DREAD RISER : 'meteor:emerging' — la météorite ÉMERGE dans le ciel
// avant de tomber : deux sourdines graves légèrement désaccordées (55 /
// 58,3 Hz) qui enflent sans relâche + grondement de bruit filtré — le
// malaise monte AVANT la chute (anticipation sonore, ~4 s).
function playDreadRiser(dur) {
  if (!running()) return;
  dur = dur || 4;
  var t = now();
  for (var i = 0; i < 2; i++) {
    var o = S.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(i === 0 ? 55 : 58.3, t);
    var lp = S.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + dur); // s'assombrit en montant
    var g = S.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur); // enfle sans relâche
    o.connect(lp); lp.connect(g); g.connect(S.master);
    o.start(t); o.stop(t + dur + 0.3);
  }
  var src = noiseSource(true);
  var blp = S.ctx.createBiquadFilter();
  blp.type = 'lowpass';
  blp.frequency.setValueAtTime(120, t);
  blp.frequency.exponentialRampToValueAtTime(400, t + dur);
  var ng = S.ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.16, t + dur);
  src.connect(blp); blp.connect(ng); ng.connect(S.master);
  src.start(t); src.stop(t + dur + 0.3);
}

// v20 — SUB-SLAM : 'meteor:hit' — la détonation du contact est ACCOMPAGNÉE
// d'un sub-grave franc (38 -> 28 Hz, 0,9 s, plus un claquement d'attaque)
// que le corps ressent : le contact météorite/Point Zéro a un POIDS sonore.
function playSubSlam() {
  if (!running()) return;
  var t = now();
  var o = S.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(38, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g); g.connect(S.master);
  o.start(t); o.stop(t + 1.0);
  // Claquement d'attaque (transitoire) pour la franchise du coup.
  var src = noiseSource(false);
  var hp = S.ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1200;
  var hg = S.ctx.createGain();
  hg.gain.setValueAtTime(0.18, t);
  hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(hp); hp.connect(hg); hg.connect(S.master);
  src.start(t); src.stop(t + 0.2);
}

// v21 — ÉCHO D'IMPACT : 3,2 s APRÈS le contact de la météorite
// ('meteor:hit'), un grondement lointain revient (l'onde a fait le tour de
// l'île) : la cause et l'effet se répondent, jamais de coupure sèche.
function playImpactEcho() {
  if (!running()) return;
  var t = now(), dur = 2.8;
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(120, t);
  f.frequency.exponentialRampToValueAtTime(45, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(S.master);
  src.start(t); src.stop(t + dur + 0.1);
}

// v20 — CRÉPITEMENT D'ALLUMAGE : 'launchpad:liftoff' — les allumeurs du pad
// crachent une salve de crépitements électriques qui montent en densité et
// en hauteur (1,5 s) : le décollage GRÉSILLE avant de rugir.
function playIgniterCrackle() {
  if (!running()) return;
  var t = now();
  for (var i = 0; i < 12; i++) {
    var at = t + i * 0.11 + rand(-0.03, 0.03);
    var src = noiseSource(false);
    src.playbackRate.setValueAtTime(rand(0.9, 1.2) + i * 0.06, at);
    var bp = S.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = rand(3, 6);
    bp.frequency.setValueAtTime(rand(1400, 2200) + i * 130, at);
    var g = S.ctx.createGain();
    var v = rand(0.05, 0.11) * (1 + i / 12);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + rand(0.06, 0.12));
    src.connect(bp); bp.connect(g); g.connect(S.master);
    src.start(at); src.stop(at + 0.25);
  }
}

// Secousse caméra ('camera:shake') : on la SENT — sub très grave bref,
// discret (les booms sont déjà joués par ailleurs).
function playShakeThud(force) {
  if (!running()) return;
  var t = now();
  var f = clamp(force || 0.5, 0, 1.2);
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(44, t);
  osc.frequency.exponentialRampToValueAtTime(22, t + 0.7);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14 + f * 0.12, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + 0.8);
}

// Couche grave DÉDIÉE aux temps de l'onde de choc ('shockwave' {force}) :
// coup de sub qui tape, gain ∝ force — le crescendo des 7 temps de
// destruction se SENT temps après temps.
function playBeatThump(f) {
  if (!running()) return;
  var t = now(), dur = 0.55;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(64, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 + f * 0.38, t + 0.012); // attaque franche
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

/* ================================================================== */
/* v15 — BATTEMENT DE CŒUR de la météorite (lub-dub, SYNCHRONISÉ)        */
/* ================================================================== */
// Miroir EXACT du visuel (event-meteor.js : heartBeat) : période 1/0.9 s
// (~1,11 s), lub à 12 % de la période, dub à 34 %. S.beatT accumule dt
// depuis l'init comme M.pulseT depuis le reset du module — même origine
// (début de l'event), même période, même forme : le son bat EN PHASE avec
// la pulsation lumineuse des fissures, du halo et des flammes.
// (Limite assumée : si le module météorite démarre sa mise à jour quelques
// frames après l'audio, le décalage de phase reste borné à cet écart,
// inaudible sur une période de 1,1 s.)
var HEART_PERIOD = 1 / 0.9; // s — identique au visuel

// Intensité du battement selon la phase (le visuel bat plus fort à
// l'impact et au rebond) — 0 = la météorite est cachée/absente.
function heartBeatAmpForPhase(st) {
  switch (st) {
    case 'acceleration': return 0.10; // dégel : à peine perceptible
    case 'strike':       return 0.22; // chute vers la faille
    case 'greatrift':    return 0.16; // émergence
    case 'meteorsix':    return 0.20;
    case 'descent':      return 0.26;
    case 'veeroff':      return 0.30;
    case 'impact':       return 0.40; // impact + rebond : plein régime
    default: return 0;
  }
}

// Un temps du cœur : coup sourd grave, attaque franche, décroissance courte.
function playHeartThump(vol) {
  if (!running()) return;
  var t = now(), dur = 0.42;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(58, t);
  osc.frequency.exponentialRampToValueAtTime(34, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.014); // le cœur TAPE
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

// Détecte les passages du lub (12 %) et du dub (34 %) entre deux frames
// et joue les temps. Appelée depuis update() — S.beatT est déjà avancé.
function updateHeartbeat(prevBeat) {
  var amp = heartBeatAmpForPhase(S.curPhase);
  if (amp <= 0 || !running()) return;
  var P = HEART_PERIOD;
  var n0 = Math.floor(prevBeat / P), n1 = Math.floor(S.beatT / P);
  for (var n = n0; n <= n1; n++) {
    var tl = n * P + 0.12 * P; // lub
    var td = n * P + 0.34 * P; // dub
    if (prevBeat < tl && S.beatT >= tl) playHeartThump(amp);
    if (prevBeat < td && S.beatT >= td) playHeartThump(amp * 0.65);
  }
}

/* ================================================================== */
/* ONDE DE CHOC, DÉCHIREMENT, PRESSION                                  */
/* ================================================================== */

// Grondement qui s'éloigne : passe-bas qui se referme + volume qui baisse.
function startRecede() {
  if (!running() || S.hold.recede) return;
  var t = now(), dur = 16; // durée relative à la phase d'appel
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur); // s'éloigne
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.03, t + dur);
  src.connect(f); f.connect(g); g.connect(S.master);
  src.start(t);
  S.hold.recede = { gain: g, nodes: [src] };
}

// Déchirement de la grande faille : bruit dont le pitch chute + coup grave.
function playTear() {
  if (!running()) return;
  var t = now(), dur = 4;
  var src = noiseSource(false);
  src.playbackRate.setValueAtTime(1.6, t);
  src.playbackRate.exponentialRampToValueAtTime(0.22, t + dur); // déchirure
  var f = S.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.5;
  f.frequency.setValueAtTime(3000, t);
  f.frequency.exponentialRampToValueAtTime(110, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.34, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(S.master);
  src.start(t); src.stop(t + dur + 0.1);
  playBoom(0.7); // le déchirement s'accompagne d'un coup grave
}

// Pression montante : bruit en passe-bande qui monte (descente).
function startPressure(dur) {
  if (!running() || S.hold.pressure) return;
  dur = dur || 18; // durée relative à la phase d'appel
  var t = now();
  var src = noiseSource(true);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + dur);
  src.connect(bp); bp.connect(g); g.connect(S.master);
  src.start(t);
  S.hold.pressure = { gain: g, nodes: [src] };
}

/* ================================================================== */
/* SILENCE — quasi-silence, respiration, puis grondement sourd          */
/* ================================================================== */

// Respiration : souffle très doux modulé lentement (le calme avant la frappe).
function startBreath() {
  if (!running() || S.hold.breath) return;
  var t = now();
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 320;
  var lfo = S.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.14; // ~7 s par respiration
  var lg = S.ctx.createGain();
  lg.gain.value = 0.028;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.035, t + 2);
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(S.master);
  src.start(t); lfo.start(t);
  S.hold.breath = { gain: g, nodes: [src, lfo] };
}

// Grondement sourd : sine 30 Hz + bruit très filtré, crescendo.
function startSilenceRumble() {
  if (!running() || S.hold.deeprumble) return;
  var t = now(), dur = 5; // durée relative (jusqu'à la phase suivante)
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(30, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + dur);
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 70;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + dur);
  osc.connect(g);
  src.connect(f); f.connect(g);
  g.connect(S.master);
  osc.start(t); src.start(t);
  S.hold.deeprumble = { gain: g, nodes: [osc, src] };
}

// v17 : GÉMISSEMENT GRAVITATIONNEL (collapse) — le Point Zéro s'effondre :
// sub ultra-grave (30 Hz) dont le pitch DESCEND (aspiré par la gravité),
// avec une pulsation lente d'amplitude (le « gémissement » de l'espace-temps).
// Cause : la formation du trou noir. S'éteint à la sortie de 'collapse'.
function startGravityGroan() {
  if (!running() || S.hold.gravitygroan) return;
  var t = now(), dur = 7;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(30, t);
  osc.frequency.exponentialRampToValueAtTime(21, t + dur); // le pitch est ASPIRÉ
  var lfo = S.ctx.createOscillator(); // pulsation lente du gémissement
  lfo.type = 'sine';
  lfo.frequency.value = 0.55;
  var lfoG = S.ctx.createGain();
  lfoG.gain.value = 0.45;
  lfo.connect(lfoG);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.30, t + 1.2);
  lfoG.connect(g.gain); // la pulsation module l'amplitude
  osc.connect(g); g.connect(S.master);
  osc.start(t); lfo.start(t);
  S.hold.gravitygroan = { gain: g, nodes: [osc, lfo] };
}

/* ================================================================== */
/* CONTRACTION — COUPURE BRUTALE : silence quasi total                  */
/* ================================================================== */

// Coupe TOUT immédiatement : le master tombe à zéro sans fondu.
function hardCut() {
  killAllHolds();
  S.hardCut = true; // le master est coupé : duckAll ne doit pas le restaurer à 0.85
  if (S.duckTimer) { clearTimeout(S.duckTimer); S.duckTimer = 0; }
  if (!S.ctx) return;
  try {
    var t = now();
    S.master.gain.cancelScheduledValues(t);
    S.master.gain.setValueAtTime(0.0001, t); // silence quasi total
  } catch (e) { /* ignore */ }
}

// Bref "aspiré" qui marque la coupure brutale, puis le silence.
// v15 : AMPLIFIÉ — plus long, plus présent, doublé d'un ton descendant :
// on ENTEND l'air se faire aspirer avant que tout meure.
function playVacuumCut() {
  if (!running()) return;
  var t = now(), dur = 0.95;
  var src = noiseSource(false);
  src.playbackRate.setValueAtTime(1.2, t);
  src.playbackRate.exponentialRampToValueAtTime(0.22, t + dur); // aspiré vers l'intérieur
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(2600, t);
  bp.frequency.exponentialRampToValueAtTime(150, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(S.master);
  src.start(t); src.stop(t + dur + 0.05);
  // Ton descendant : 320 → 55 Hz — le "glou" de l'aspiration.
  var o = S.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(55, t + dur);
  var og = S.ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(og); og.connect(S.master);
  o.start(t); o.stop(t + dur + 0.05);
}

/* ================================================================== */
/* TROU NOIR — aspiration, drones profonds, craquements                 */
/* ================================================================== */

// Grondement sourd qui monte (effondrement / aspiration).
function startDeepRumble() {
  if (!running() || S.hold.deeprumble) return;
  S.hardCut = false; // la coupure brutale est terminée : le master peut remonter
  masterTo(0.85, 0.5); // le master remonte après la coupure
  var t = now(), dur = 7; // durée relative à la phase d'appel
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(28, t);
  osc.frequency.exponentialRampToValueAtTime(52, t + dur); // monte
  var src = noiseSource(true);
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(60, t);
  f.frequency.exponentialRampToValueAtTime(220, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + dur);
  osc.connect(g);
  src.connect(f); f.connect(g);
  g.connect(S.master);
  osc.start(t); src.start(t);
  S.hold.deeprumble = { gain: g, nodes: [osc, src] };
}

// Drone du trou noir (growth/destruction) : grave, lent, avec battement.
function startBlackholeDrone() {
  if (!running() || S.hold.bhdrone) return;
  var t = now();
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 6);
  var nodes = [];
  var freqs = [27, 27.6, 54.5]; // le battement 27/27.6 Hz = pulsation lente
  for (var i = 0; i < freqs.length; i++) {
    var o = S.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freqs[i];
    o.connect(g);
    o.start(t);
    nodes.push(o);
  }
  g.connect(S.master);
  S.hold.bhdrone = { gain: g, nodes: nodes };
}

// Drone GRAVE minimal (phase blackhole) : sines très basses qui battent
// lentement, volume modulé par un LFO très lent. Le SILENCE domine.
function startDeepDrone() {
  if (!running() || S.hold.deepdrone) return;
  var t = now();
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 8); // montée très lente, volume minimal
  var lfo = S.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.05; // pulsation très lente (~20 s)
  var lg = S.ctx.createGain();
  lg.gain.value = 0.05;
  lfo.connect(lg); lg.connect(g.gain);
  var nodes = [lfo];
  var freqs = [22, 22.45, 44.2]; // très grave, battement très lent
  for (var i = 0; i < freqs.length; i++) {
    var o = S.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freqs[i];
    o.connect(g);
    o.start(t);
    nodes.push(o);
  }
  g.connect(S.master);
  S.hold.deepdrone = { gain: g, nodes: nodes };
}

// Craquement : burst de bruit filtré au pitch qui chute (destruction).
function playCrackle() {
  if (!running()) return;
  var t = now(), dur = rand(0.15, 0.4);
  var src = noiseSource(false);
  src.playbackRate.setValueAtTime(rand(1.1, 1.5), t);
  src.playbackRate.exponentialRampToValueAtTime(rand(0.3, 0.5), t + dur);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = rand(2, 4);
  bp.frequency.setValueAtTime(rand(900, 1600), t);
  bp.frequency.exponentialRampToValueAtTime(rand(180, 320), t + dur);
  var g = S.ctx.createGain();
  var v = rand(0.08, 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(S.master);
  src.start(t); src.stop(t + dur + 0.05);
}

// Riser aspirant (le joueur est happé vers le trou noir).
function startSuckRiser(dur) {
  if (!running() || S.hold.suckriser) return;
  dur = dur || 13; // durée relative à la phase d'appel
  var t = now();
  var src = noiseSource(true);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(4500, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + dur);
  src.connect(bp); bp.connect(g); g.connect(S.master);
  src.start(t);
  S.hold.suckriser = { gain: g, nodes: [src] };
}

// Battement sourd de l'aspiration (bus 'suction:beat') : pulsation grave.
// v12 : attaque plus franche (le battement "tape" au lieu de s'installer).
function playSuctionBeat() {
  if (!running()) return;
  var t = now(), dur = 0.6;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(58, t);
  osc.frequency.exponentialRampToValueAtTime(36, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.24, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

/* ================================================================== */
/* NUMBERS & FIN — blips doux, piano épars, silence                     */
/* ================================================================== */

// Blip discret : sine courte, douce, légèrement voilée (un par nombre).
// v12 : harmonique "ping" discrète — le nombre sonne plus cristallin.
// v21 : 'idx' (1-based, fourni par 'number:show') fait MONTER le pitch —
// chaque nombre sonne plus marquant que le précédent (880 → ~1240 Hz).
function playBlip(idx) {
  if (!running()) return;
  var t = now(), dur = 0.7;
  var n = (typeof idx === 'number' && isFinite(idx)) ? Math.max(1, Math.min(12, Math.floor(idx))) : 1;
  var f0 = 880 + (n - 1) * 45; // 880 -> ~1375 Hz
  // v22 : chaque nombre sonne PLUS FORT que le précédent (pas seulement
  // plus aigu) — le volume monte avec l'index, un par un.
  var vol = 0.10 + (n - 1) * 0.012;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
  // Ping cristallin : octave brève, décroissance rapide.
  var o2 = S.ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(f0 * 2, t);
  o2.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.3);
  var g2 = S.ctx.createGain();
  g2.gain.setValueAtTime(0.045, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o2.connect(g2); g2.connect(S.master);
  o2.start(t); o2.stop(t + 0.35);
  // v22 : ÉCHO — le nombre résonne une fois dans le vide (même hauteur,
  // discret, 0,19 s plus tard) : il « flotte » avant de mourir.
  var et = t + 0.19;
  var eo = S.ctx.createOscillator();
  eo.type = 'sine';
  eo.frequency.value = f0;
  var eg = S.ctx.createGain();
  eg.gain.setValueAtTime(0.0001, et);
  eg.gain.exponentialRampToValueAtTime(vol * 0.45, et + 0.03);
  eg.gain.exponentialRampToValueAtTime(0.0001, et + 0.5);
  eo.connect(eg); eg.connect(S.master);
  eo.start(et); eo.stop(et + 0.55);
  // v22 : à partir du 6e nombre, un sub-grave (f0/4) ancre le blip — les
  // derniers nombres ont un POIDS physique.
  if (n >= 6) {
    var so = S.ctx.createOscillator();
    so.type = 'sine';
    so.frequency.value = f0 / 4;
    var sg = S.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    so.connect(sg); sg.connect(S.master);
    so.start(t); so.stop(t + 0.95);
  }
}

// v21 : GONG DE MI-PARCOURS — joué sur 'countdown:half' (T-0:30) : un gong
// grave (98/147/196/294 Hz), long fondu 4,5 s — la minute « bascule ».
// Volume modéré : il marque, sans écraser les tics du compte à rebours.
function playHalfGong() {
  if (!running()) return;
  var t = now(), dur = 4.5;
  var freqs = [98, 147, 196, 294];
  var gains = [0.14, 0.10, 0.07, 0.045];
  for (var i = 0; i < freqs.length; i++) {
    var osc = S.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqs[i], t);
    var g = S.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gains[i], t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(S.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
}

// v22 : TIMBALE DES JALONS — jouée sur 'countdown:milestone' (T-0:45 /
// T-0:15 / T-0:10, émis par event-countdown.js) : un coup de timbale grave
// qui S'ALOURDIT à mesure que zéro approche (plus grave ET plus fort) —
// chaque quart de minute PÈSE.
function playMilestoneDrum(remaining) {
  if (!running()) return;
  var t = now();
  var k = clamp(1 - remaining / 60, 0, 1); // 0.25 -> 0.83
  var f0 = 95 - k * 35;      // 86 -> 66 Hz : ça s'alourdit
  var vol = 0.16 + k * 0.22; // 0.22 -> 0.34 : ça tape plus fort
  var o = S.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.35);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(g); g.connect(S.master);
  o.start(t); o.stop(t + 1.2);
  // Attaque de peau (bruit grave bref).
  var n = noiseSource(false);
  var nf = S.ctx.createBiquadFilter();
  nf.type = 'lowpass'; nf.frequency.value = 320;
  var ng = S.ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  n.connect(nf); nf.connect(ng); ng.connect(S.master);
  n.start(t); n.stop(t + 0.12);
}

// v22 : FRÉMISSEMENT AVANT LES NOMBRES — dans les 2,5 dernières secondes
// de 'blackhole', un scintillement montant (bruit filtré qui s'ouvre +
// sine qui monte 300 -> 1200 Hz, discret) tend le silence : quelque chose
// arrive, sans jamais le nommer.
function playNumbersAnticip() {
  if (!running()) return;
  var t = now(), dur = 2.4;
  var src = noiseSource(true);
  var bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
  var tone = S.ctx.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(300, t);
  tone.frequency.exponentialRampToValueAtTime(1200, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  src.connect(bp); bp.connect(g);
  tone.connect(g); g.connect(S.master);
  src.start(t); tone.start(t);
  src.stop(t + dur + 0.2); tone.stop(t + dur + 0.2);
}

// v21 : POULS DE VIDE — sub-grave très discret (34 → 26 Hz, 2,2 s), joué
// toutes les 6 à 9 s pendant 'blackhole'/'numbers' : le trou noir « respire »
// aussi dans le son. Volume bas : le silence domine.
function playVoidPulse() {
  if (!running()) return;
  var t = now(), dur = 2.2;
  var osc = S.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(34, t);
  osc.frequency.exponentialRampToValueAtTime(26, t + dur);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(S.master);
  osc.start(t); osc.stop(t + dur + 0.05);
}

// Notes en la mineur pour le piano épars (A2 → E4, registre mélancolique).
var PIANO_AMINOR = [110.00, 123.47, 130.81, 146.83, 164.81, 196.00,
                    220.00, 246.94, 261.63, 329.63];

// Une note de piano : triangle + octave discrète, attaque douce,
// très longue décroissance. Volume volontairement bas (silence presque total).
function playPianoNote() { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running()) return;
  var t = now(), dur = 5;
  var f = PIANO_AMINOR[Math.floor(Math.random() * PIANO_AMINOR.length)];
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  var o1 = S.ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  var o2 = S.ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2;
  var g2 = S.ctx.createGain();
  g2.gain.value = 0.25; // octave discrète
  o1.connect(g);
  o2.connect(g2); g2.connect(g);
  g.connect(S.master);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}

/* ------------------------------------------------------------------ */
/* 'calm' — le bus demande une baisse générale brève                    */
/* ------------------------------------------------------------------ */

function duckAll(sec) {
  if (!running()) return;
  sec = sec || 4;
  var t = now();
  try {
    if (S.duckTimer) { clearTimeout(S.duckTimer); S.duckTimer = 0; }
    S.master.gain.cancelScheduledValues(t);
    S.master.gain.setTargetAtTime(0.05, t, 0.25);
    S.duckTimer = setTimeout(function () {
      S.duckTimer = 0;
      if (!S.ctx) return;
      // Si le master a été coupé brutalement (contraction), on ne le restaure PAS.
      try { masterTo(S.hardCut ? 0.012 : 0.85, 0.8); } catch (e) { /* ignore */ }
    }, sec * 1000);
  } catch (e) { /* ignore */ }
}

/* ================================================================== */
/* Transitions d'état (23 phases)                                       */
/* ================================================================== */

// Appelée quand on ENTRE dans un état.
function enterState(st) {
  switch (st) {
    case 'countdown':
      S.countdownHeard = false;
      S.zeroHeard = false;
      S.countBase = 0;
      S.countRiserOn = false;
      // Les tics viennent du bus 'countdown:tick', pas de tic-tac local.
      startCountdownPad(); // la nappe de tension démarre dès la 1re seconde
      break;
    case 'firstrocket':
      // Le signal zéro vient du bus 'countdown:alarm'.
      // Repli : si event-countdown.js ne l'a pas émis, on le joue ici
      // (alarme sonore + roulement de timbales + accord).
      if (!S.zeroHeard) playZeroSignalOnce();
      S.zeroHeard = false;
      startIgnition();      // allumage
      // Le rugissement démarre au signal rocket:launch, après la préparation.
      startRiftHum();       // vrombissement de la faille
      scoreStart(1);        // la partition entre, discrète : nappe de cordes
      break;
    case 'sixrockets':
      S.whooshT = 0.3;
      S.pulseT = 0.8;
      scoreSetLevel(2);     // l'ostinato s'installe, discret
      break;
    case 'convergence':
      holdStop('ignition', 2);
      holdStop('roar', 3);
      S.shimmerT = 0.5;
      scoreSetLevel(3);     // timbales + ostinato : la tension monte
      scoreAccent(0.14);
      break;
    case 'loop':
      scoreSetLevel(4);     // le thème entre sur la barre suivante
      scoreAccent(0.16);
      break;
    case 'acceleration':
      scoreSetLevel(5);     // intensité maximale avant le silence
      S.whooshT = 0.8;
      break;
    case 'silence':
      scoreStop(3);         // la partition s'éteint en fondu…
      holdStop('rifthum', 3);
      startBreath();        // …ne reste qu'une respiration…
      S.rumbleIn = 4.0;     // …puis un grondement sourd (relatif à l'entrée)
      // v23 — 'calm' : le bus demande une baisse générale brève (duck du
      // master via l'écouteur 'calm' ci-dessous + adoucissement du ciel via
      // event-sky.js). L'événement était écouté mais JAMAIS émis : il ne se
      // déclenchait jamais. Émis une seule fois par passage — enterPhase()
      // ne rejoue jamais le même état deux fois de suite.
      try { AZE.emit('calm', { duration: 4 }); } catch (e) { /* ignore */ }
      break;
    case 'strike':
      holdStop('breath', 1);
      holdStop('deeprumble', 1);
      startMeteorRumble();  // grondement grave de la météorite
      playWhistle(12);      // sifflement de la descente
      startLaserBuzz();     // bourdonnement des lasers
      scoreBrassHit(0, 0.14); // accord de cuivres doux : la frappe
      break;
    case 'thrown':
      holdStop('laser', 2);
      holdStop('meteorrumble', 2);
      startRecede();        // grondement de l'onde de choc qui s'éloigne
      break;
    case 'greatrift':
      holdStop('recede', 2);
      playTear();           // déchirement grave
      break;
    case 'meteorsix':
      S.shimmerT = 0.6;
      startFormPad();       // nappe basse de formation + scintillements
      scoreStart(3);        // reprise du thème pendant la chevauchée
      scoreSetLevel(4);
      break;
    case 'descent':
      holdStop('formpad', 1);
      startPressure(12);    // drone de pression montant (durée relative)
      scoreSetLevel(5);
      scoreAccent(0.18);
      break;
    case 'veeroff':
      holdStop('pressure', 1);
      scoreAccent(0.2);
      playWhoosh();
      // Timeouts suivis : annulés dans dispose() si stop() survient avant.
      S.pending.push(setTimeout(playWhoosh, 700));
      S.pending.push(setTimeout(playWhoosh, 1500)); // les fusées s'échappent par les failles
      break;
    case 'impact':
      // Le choc est déclenché par meteor:hit, pas par l’entrée dans la phase.
      break;
    case 'contraction':
      // v13 : l'aspiré se fait entendre AVANT la coupure brutale (avant, le
      // master était déjà coupé quand il jouait : on ne l'entendait presque
      // pas). La coupure tombe 0,55 s plus tard, timeout suivi (dispose-safe).
      scoreStop(0.4);
      playVacuumCut();      // bref "aspiré" qui marque la coupure...
      S.pending.push(setTimeout(function () {
        if (!AZE.active || S.curPhase !== 'contraction') return;
        hardCut();          // ...PUIS COUPURE BRUTALE : silence quasi total
      }, 550));
      break;
    case 'collapse':
      startDeepRumble();    // aspiration grave qui monte (le master remonte)
      startGravityGroan();  // v17 : gémissement gravitationnel (le trou noir se forme)
      break;
    case 'growth':
      startBlackholeDrone(); // drone du trou noir (grave, lent)
      break;
    case 'destruction':
      S.crackleT = 0.5;     // craquements, puis le vide
      break;
    case 'playersucked':
      startSuckRiser(9);    // aspiré vers le trou noir (durée relative)
      break;
    case 'allgone':
      holdStop('suckriser', 2);
      holdStop('deeprumble', 2);
      holdStop('bhdrone', 3); // tout disparaît : le son s'éteint
      break;
    case 'blackhole':
      startDeepDrone();     // drone GRAVE minimal : le SILENCE domine
      S.pianoT = 2.5;       // première note de piano éparse
      S.voidT = 4;          // v21 : premier pouls de vide 4 s après l'entrée
      S.numAnticip = false; // v22 : le frémissement avant les nombres est réarmé
      break;
    case 'numbers':
      // v13 : les blips sont émis par le bus 'number:show' (un par nombre).
      S.voidT = 5;          // v21 : le pouls continue, discret
      // v22 : SILENCE DRAMATIQUE — le master plonge 1,8 s quand les nombres
      // commencent : le vide AVANT que le premier nombre ne claque. Puis
      // le son remonte doucement (les blips percent le vide, un par un).
      if (running()) {
        masterTo(0.03, 0.15);
        S.pending.push(setTimeout(function () {
          if (!AZE.active || S.curPhase !== 'numbers') return;
          masterTo(0.85, 1.2);
        }, 1800));
      }
      break;
    case 'end':
      holdStop('deepdrone', 4); // silence total
      break;
    default:
      break;
  }
}

// Nappe basse de formation (meteorsix) : cordes graves + sub, discrète.
function startFormPad() {
  if (!running() || S.hold.formpad) return;
  var t = now();
  var f = S.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 3);
  var nodes = [];
  var notes = [55, 65.41, 82.41, 110]; // A1 C2 E2 A2
  for (var i = 0; i < notes.length; i++) {
    var o = S.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = notes[i];
    o.detune.value = rand(-6, 6);
    o.connect(f);
    o.start(t);
    nodes.push(o);
  }
  f.connect(g); g.connect(S.master);
  S.hold.formpad = { gain: g, nodes: nodes };
}

// Appelée quand on QUITTE un état.
function exitState(st) {
  switch (st) {
    case 'countdown':
      stopCountdownMusic(1.2); // la nappe s'efface derrière le zéro orchestral
      S.countBase = 0;
      S.countRiserOn = false;
      break;
    case 'firstrocket':
      holdStop('ignition', 3);
      holdStop('roar', 4);
      holdStop('rifthum', 4);
      break;
    case 'silence':
      holdStop('breath', 1.5);
      holdStop('deeprumble', 2);
      S.rumbleIn = -1;
      break;
    case 'strike':
      holdStop('laser', 2);
      break;
    case 'thrown':
      holdStop('recede', 3);
      break;
    case 'descent':
      holdStop('pressure', 2);
      break;
    case 'meteorsix':
      holdStop('formpad', 2);
      break;
    case 'acceleration':
      // La partition s'éteint déjà en fondu à l'entrée de 'silence'.
      break;
    case 'impact':
      holdStop('impactcalm', 2);
      break;
    case 'playersucked':
      holdStop('suckriser', 2);
      break;
    case 'destruction':
      holdStop('bhdrone', 4); // le vide s'installe avant 'allgone'
      break;
    case 'collapse':
      holdStop('gravitygroan', 2.5); // v17 : le gémissement s'éteint avec l'effondrement
      break;
    default:
      break;
  }
}

// Entrée de phase idempotente : appelée par les événements 'phase:<nom>'
// ET par le suivi d'état dans update() (repli si l'event a été raté).
function enterPhase(st) {
  if (!AZE.active) return;
  if (!st || st === S.curPhase) return;
  if (S.curPhase) exitState(S.curPhase);
  S.curPhase = st;
  enterState(st);
}

/* ================================================================== */
/* Module enregistré                                                    */
/* ================================================================== */

function init(api) {
  if (S.inited) return;
  S.inited = true;

  ensureCtx();

  // Sur un redémarrage le contexte est recréé à l'état 'suspendu' : on tente
  // une reprise immédiate (l'activation du clic "JOUER" est généralement
  // encore valide). En cas d'échec, le gestionnaire de geste prend le relais.
  if (S.ctx && S.ctx.state === 'suspended' && typeof S.ctx.resume === 'function') {
    try {
      var pr = S.ctx.resume();
      if (pr && typeof pr.catch === 'function') pr.catch(function () {});
    } catch (e) { /* reste suspendu jusqu'au prochain geste */ }
  }

  // État propre à chaque passage : compteurs et déclencheurs réinitialisés.
  S.curPhase = '';
  S.lastZeroT = -10;
  S.lastPortalTone = S.lastPassTone = S.lastFractureTone = -10;
  S.countdownHeard = false;
  S.zeroHeard = false;
  S.countBase = 0;
  S.countRiserOn = false;
  S.whooshT = 0;
  S.pulseT = 0;
  S.shimmerT = 0;
  S.crackleT = 0;
  S.blipT = 0;
  S.pianoT = 0;
  S.voidT = 0; // v21
  S.numAnticip = false; // v22
  S.rumbleIn = -1;
  S.hardCut = false;
  S.dreadHeard = false; // v20 : montée dread (meteor:emerging)
  S.ignHeard = false;   // v20 : crépitement d'allumage (launchpad:liftoff)
  // v15 : horloge du battement de cœur (repartie comme M.pulseT au reset
  // du module météorite) + anti-doublons des passages de fusées/failles.
  S.beatT = 0;
  S.riftXT = 0;
  S.passWT = 0;
  var sc = S.sc;
  sc.on = false; sc.level = 0; sc.step = 0; sc.nextT = 0;
  sc.bus = null; sc.filt = null;
  sc.gStacc = null; sc.gTimp = null; sc.gPad = null;
  sc.chordIdx = 0; sc.chordT = 0;

  // Reprise du contexte au premier geste utilisateur (clic "JOUER").
  S.resumeHandler = function () {
    if (S.ctx && S.ctx.state === 'suspended') {
      S.ctx.resume().catch(function () {});
    }
  };
  root.addEventListener('pointerdown', S.resumeHandler, { once: true });
  root.addEventListener('keydown', S.resumeHandler, { once: true });

  // Baisse le volume du jeu pendant l'event (restauré au dispose).
  lowerGameVolume();

  // Événements du bus — enregistrés UNE SEULE FOIS pour toute la vie du module :
  // le bus n'expose pas de 'off', se réinscrire au restart doublerait chaque son.
  if (!S.busBound) {
  S.busBound = true;
  // Transitions de phase (le séquenceur émet 'phase:<nom>' à chaque setState).
  for (var pi = 0; pi < PHASES.length; pi++) {
    (function (name) {
      AZE.on('phase:' + name, function () { enterPhase(name); });
    })(PHASES[pi]);
  }
  // Countdown : piloté par event-countdown.js (pas de synthèse locale là-bas).
  AZE.on('phase:countdown', function () { if (AZE.active && AZE.tTotal < 8) themeCountdown(); });
  AZE.on('phase:firstrocket', function () { holdStop('theme', 4); });
  AZE.on('phase:blackhole', function () { if (AZE.active) themeEnding(); });
  AZE.on('countdown:tick', onCountdownTick);
  AZE.on('countdown:alarm', onZeroCue); // zéro : ALARME SONORE + roulement + accord
  AZE.on('rocket:launch', function () {
    if (!AZE.active) return;
    holdStop('ignition', 0.7); startLaunchRoar(AZE.TIMELINE.firstrocket[1] - AZE.tTotal); playWhoosh();
  });
  AZE.on('rocket:stage', function (data) { if (AZE.active) playWorldAccent('stage', data); });
  AZE.on('rift:open', function (data) {
    if (!AZE.active || AZE.tTotal - S.lastFractureTone < 0.25) return;
    S.lastFractureTone = AZE.tTotal; playWorldAccent('rift', { pos: data.pos, strength: clamp(data.radius / 160, 0.25, 0.9) });
  });
  AZE.on('zeropoint:resonance', function (data) { if (AZE.active) playWorldAccent('resonance', data); });
  AZE.on('capture:pass', function (data) {
    if (!AZE.active || data.stage !== 'behind' || AZE.tTotal - S.lastPassTone < 0.30) return;
    S.lastPassTone = AZE.tTotal; playWhoosh(data);
  });
  AZE.on('rocket:rift-enter', function (data) {
    if (!AZE.active || AZE.tTotal - S.lastPortalTone < 0.14) return;
    S.lastPortalTone = AZE.tTotal; playRiftPulse();
    if (data.rift === 'launch' && !data.exit) holdStop('roar', 0.65);
  });
  AZE.on('rocket:impact', function () {
    if (!AZE.active) return;
    playBoom(1.0); // BOOM du CONTACT
  });
  // v47 — le Point Zéro abat le Battle Bus : charge, rayon, explosions.
  AZE.on('bus:laser-charge', function () { if (AZE.active) playBusLaserCharge(); });
  AZE.on('bus:laser', function () { if (AZE.active) playBusLaser(); });
  AZE.on('bus:hit', function () { if (AZE.active) playBoom(0.9); });
  AZE.on('bus:secondary', function () { if (AZE.active) playBoom(0.75); });
  AZE.on('bus:crash', function () { if (AZE.active) { playBoom(1.5); playBeatThump(1); } });
  AZE.on('shockwave', function (d) {
    if (!AZE.active) return;
    // v15 : crescendo AMPLIFIÉ — courbe raide : chaque temps frappe
    // nettement plus fort que le précédent (7 temps de destruction :
    // force 0.32 → 0.77 sur le bus) + couche grave dédiée ∝ force.
    var f = (d && typeof d.force === 'number') ? d.force : 0.5;
    f = clamp(f, 0, 1.2);
    playBoom(0.3 + Math.pow(f, 1.35) * 1.25); // détonation échelonnée, raide
    playBeatThump(f); // le temps TAPE dans le grave, de plus en plus fort
  });
  // v15 — 'shockwave:burst' {opts:{radius}} : la réponse sonore des grosses
  // explosions visuelles (impact échelle de l'île r=2600, zeroshock r=1300,
  // éruption du rebond r=800, dégel r=520) — détonation profonde + réverb.
  AZE.on('shockwave:burst', function (d) {
    if (!AZE.active) return;
    var r = d && d.opts && typeof d.opts.radius === 'number' ? d.opts.radius : 800;
    playDeepBoom(0.45 + r / 1000); // 520 → ~1.0, 1300 → ~1.75, 2600 → 2.2 (plafond)
  });
  // v15 — la météorite ÉCLOT du Point Zéro : grondement qui monte +
  // scintillement ascendant (le boom vient juste après, via 'shockwave:burst').
  AZE.on('meteor:rebound', function () {
    if (!AZE.active) return;
    playReboundEruption();
  });
  // v15 — la météorite se DÉGÈLE : grondement qui enfle + sifflement de
  // chute (elle plonge dans la faille). Le boom vient de 'shockwave:burst'.
  AZE.on('meteor:unfreeze', function () {
    if (!AZE.active) return;
    playUnfreezeAwaken();
  });
  // v15 — la fusée ENTRE dans le Point Zéro : le joueur est PROPULSÉ —
  // vent ascendant violent + crac + sub. L'explosion vient de
  // 'shockwave:burst' (r=1300) dans le même tick : pas de boom ici.
  AZE.on('rocket:zeroshock', function () {
    if (!AZE.active) return;
    playZeroShockWind();
  });
  // v15 — une fusée frôle la météorite : chuintement (anti-doublon 3 s,
  // les passages se répètent pendant les boucles).
  AZE.on('rocket:pass', function (data) {
    if (!AZE.active || !running() || AZE.tTotal - S.lastPassTone < 0.32) return;
    S.lastPassTone = AZE.tTotal;
    playWhoosh(data);
  });
  // v15 — le Point Zéro est DÉTRUIT : l'orbe meurt — scintillement qui
  // descend et s'éteint + coup sourd (pas de boom : déjà joué à l'impact).
  AZE.on('zeropoint:destroyed', function () {
    if (!AZE.active) return;
    playZeroPointDestroyed();
  });
  // v15 — le joueur est PROJETÉ : souffle d'air énorme (le boom de
  // l'impact est déjà joué par 'shockwave:burst' dans le même tick).
  AZE.on('impact:playerblast', function () {
    if (!AZE.active) return;
    playPlayerBlastWind();
  });
  // v15 — secousse caméra : on la SENT (sub très grave discret).
  AZE.on('camera:shake', function (d) {
    if (!AZE.active) return;
    playShakeThud(d && typeof d.force === 'number' ? d.force : 0.5);
  });
  // v15 — l'aspiration commence / se termine (event-suction.js).
  AZE.on('suction:start', function () {
    if (!AZE.active) return;
    startSuckRiser(10); // idempotent : ne double pas le riser de la phase
  });
  AZE.on('suction:end', function () {
    if (!AZE.active) return;
    holdStop('suckriser', 2);
  });
  // v15 — une fusée S'ÉCHAPPE par une faille : scintillement + aspiration
  // brève (anti-doublon 2,5 s : les 7 fusées partent en rafale).
  AZE.on('rift:cross', function (d) {
    if (!AZE.active || !running()) return;
    if (!d || d.kind !== 'escape') return; // 'strike'/'launch'/... déjà sonorisés
    if (S.riftXT > 0) return;
    S.riftXT = 2.5;
    playRiftShimmer();
    playWhoosh();
  });
  // v20 — la météorite ÉMERGE dans le ciel (event-meteor.js) : la montée
  // « dread » AMÈNE sa chute (~4 s avant le contact : anticipation sonore).
  AZE.on('meteor:emerging', function () {
    if (!AZE.active) return;
    if (S.dreadHeard) return;
    S.dreadHeard = true;
    playDreadRiser(4);
  });
  // v20 — le pas de tir ALLUME ses moteurs (event-arena.js) : salve de
  // crépitements électriques avant le rugissement du décollage.
  AZE.on('launchpad:liftoff', function () {
    if (!AZE.active) return;
    if (S.ignHeard) return;
    S.ignHeard = true;
    playIgniterCrackle();
  });
  AZE.on('meteor:hit', function () {
    if (!AZE.active) return;
    playImplosion(); playImpactHit(); startImpactCalm();
    playBoom(0.5);
    playSubSlam(); // v20 : le contact a un POIDS (sub-grave franc)
    // v21 : 3,2 s plus tard, le grondement lointain REVIENT (l'onde a fait
    // le tour de l'île) — différé via S.pending (annulé au dispose).
    S.pending.push(setTimeout(function () {
      if (AZE.active) playImpactEcho();
    }, 3200));
  });
  AZE.on('zeropoint:collapse', function () {
    if (!AZE.active) return;
    playTear();
    startDeepRumble();
  });
  AZE.on('blackhole:formed', function () {
    if (!AZE.active) return;
    playBoom(0.6);
    startBlackholeDrone();
  });
  AZE.on('number:show', function (d) {
    if (!AZE.active) return;
    // v21 : 'idx' (fourni par event-blackhole.js) fait monter le pitch du
    // blip — chaque nombre sonne plus marquant, un par un.
    playBlip(d && typeof d.idx === 'number' ? d.idx : 1);
  });
  // v21 : gong de mi-parcours (T-0:30) — la minute du compte à rebours
  // « bascule » (émis par event-countdown.js).
  AZE.on('countdown:half', function () {
    if (!AZE.active) return;
    playHalfGong();
  });
  // v22 : JALONS du compte à rebours (T-0:45 / T-0:15 / T-0:10, émis par
  // event-countdown.js) — un coup de timbale grave qui s'alourdit à mesure
  // que zéro approche : la tension sonore MONTE, chaque quart de minute pèse.
  AZE.on('countdown:milestone', function (d) {
    if (!AZE.active) return;
    var r = (d && typeof d.remaining === 'number') ? d.remaining : 30;
    playMilestoneDrum(r);
  });
  AZE.on('player:sucked', function () {
    if (!AZE.active) return;
    startSuckRiser(8); // idempotent : ne double pas le riser de la phase
  });
  AZE.on('suction:beat', function () {
    if (!AZE.active) return;
    playSuctionBeat(); // pulsation grave douce de l'aspiration
  });
  AZE.on('calm', function (d) {
    if (!AZE.active) return;
    duckAll(d && d.duration > 0 ? d.duration : 4);
  });
  // v16 ��� télégraphes d'avertissement (event-player.js) : ~2 s AVANT chaque
  // impulsion subie, une montée d'alerte AMÈNE le grand moment (attaque
  // progressive, pas d'apparition sèche). Le joueur est prévenu avant
  // d'être propulsé / projeté / aspiré.
  AZE.on('warn:zeroshock', function () {
    if (!AZE.active) return;
    playWarnRiser(2.0); // ~2 s avant le contact fusée/Point Zéro
  });
  AZE.on('warn:thrown', function () {
    if (!AZE.active) return;
    playWarnRiser(1.6); // ~1,5 s avant que l'onde de choc ne frappe
  });
  AZE.on('warn:veer', function () {
    if (!AZE.active) return;
    playWarnRiser(2.0); // ~2 s avant la projection de 'veeroff'
  });
  AZE.on('warn:blast', function () {
    if (!AZE.active) return;
    playWarnRiser(3.0); // ~3 s avant le flash/blast de l'impact
  });
  AZE.on('warn:suck', function () {
    if (!AZE.active) return;
    playWarnRiser(2.5); // ~2,5 s avant l'aspiration du joueur
  });
  } // fin du bloc d'enregistrement unique des écouteurs
}

function update(dt, t) {
  // Hors event : le mode normal du jeu ne doit JAMAIS être affecté.
  if (!AZE.active) return;
  // v15 : l'horloge du battement de cœur avance TOUJOURS (même contexte
  // suspendu) — le visuel (M.pulseT, event-meteor.js) accumule dès l'init :
  // même origine, même période → le son reste EN PHASE avec la pulsation
  // lumineuse des fissures. Idem pour les anti-doublons.
  var prevBeat = S.beatT;
  S.beatT += dt;
  if (S.riftXT > 0) S.riftXT -= dt;
  if (S.passWT > 0) S.passWT -= dt;
  if (!running()) return;
  // v15 : battement de cœur lub-dub synchronisé avec la météorite.
  updateHeartbeat(prevBeat);

  // Suivi d'état (repli si un 'phase:<nom>' a été raté, ex. init en cours d'event).
  var st = AZE.state || '';
  if (st && st !== S.curPhase) enterPhase(st);

  // Déclenchements continus selon la phase courante.
  if (st === 'convergence' || st === 'loop' || st === 'meteorsix') {
    // Scintillements cristallins des failles (~toutes les 2 s), doux.
    S.shimmerT -= dt;
    if (S.shimmerT <= 0) {
      playRiftShimmer();
      S.shimmerT = rand(1.4, 2.8);
    }
  } else if (st === 'silence') {
    // Grondement sourd après le début du calme (relatif à l'entrée en phase).
    if (S.rumbleIn > 0) {
      S.rumbleIn -= dt;
      if (S.rumbleIn <= 0) {
        S.rumbleIn = -1;
        startSilenceRumble();
      }
    }
  } else if (st === 'destruction') {
    // Craquements qui s'espacent (~toutes les 0,4 à 1,2 s), puis le vide.
    S.crackleT -= dt;
    if (S.crackleT <= 0) {
      playCrackle();
      S.crackleT = rand(0.4, 1.2);
    }
  } else if (st === 'blackhole' || st === 'numbers') {
    // Piano épars mélancolique (la mineur) : une note toutes les 4 à 9 s.
    // v13 : les blips des nombres viennent du bus 'number:show' (un par
    // nombre, joué par event-blackhole.js) — plus de blip minuteur ici
    // (il doublait les blips entre les nombres).
    // v21 : POULS DE VIDE — sub-grave discret toutes les 6 à 9 s : le trou
    // noir « respire » aussi dans le son (le silence domine, le vide vit).
    // v22 : dans les 2,5 dernières secondes de 'blackhole', un FRÉMISSEMENT
    // montant tend le silence avant les nombres (bornes lues depuis la
    // timeline officielle, jamais en dur).
    S.pianoT -= dt;
    if (S.pianoT <= 0) {
      playPianoNote();
      S.pianoT = rand(4, 9);
    }
    S.voidT -= dt;
    if (S.voidT <= 0) {
      playVoidPulse();
      S.voidT = rand(6, 9);
    }
    if (st === 'blackhole' && !S.numAnticip) {
      var bhDur = 10;
      try {
        var _tl = AZE.TIMELINE;
        if (_tl && _tl.blackhole && isFinite(_tl.blackhole[1]) && isFinite(_tl.blackhole[0]))
          bhDur = Math.max(3, _tl.blackhole[1] - _tl.blackhole[0]);
      } catch (e) { /* repli 10 s */ }
      if ((AZE.tState || 0) >= bhDur - 2.5) {
        S.numAnticip = true;
        playNumbersAnticip();
      }
    }
  }

  // Partition orchestrale : ordonnancement pendant les phases musicales
  // (piloté par la phase, pas par le temps).
  if (S.sc.on && (st === 'firstrocket' || st === 'sixrockets' ||
                  st === 'convergence' || st === 'loop' ||
                  st === 'acceleration' || st === 'meteorsix' || st === 'descent' ||
  st === 'veeroff' || st === 'impact')) {
    scheduleScore(dt);
  }
}

function dispose() {
  // Stoppe tous les sons continus (coupure rapide).
  killAllHolds();

  // Annule le 'calm' en attente.
  if (S.duckTimer) { clearTimeout(S.duckTimer); S.duckTimer = 0; }
  // Annule les timeouts différés en attente (whooshes, nettoyage d'écho).
  for (var pi = 0; pi < S.pending.length; pi++) clearTimeout(S.pending[pi]);
  S.pending = [];

  // Retire l'écouteur de geste s'il n'a jamais servi.
  if (S.resumeHandler) {
    try {
      root.removeEventListener('pointerdown', S.resumeHandler);
      root.removeEventListener('keydown', S.resumeHandler);
    } catch (e) { /* ignore */ }
    S.resumeHandler = null;
  }

  // Ferme le contexte (les oscillateurs meurent avec lui).
  if (S.ctx) {
    try {
      var p = S.ctx.close();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {
      try { S.ctx.suspend(); } catch (e2) { /* ignore */ }
    }
    S.ctx = null;
  }
  S.master = null;
  S.noiseBuf = null;
  S.space = null;
  S.hold = {};
  S.sc.on = false; // l'ordonnanceur de la partition s'arrête (pas de fuite au restart)
  S.curPhase = '';
  S.hardCut = false;
  S.inited = false;

  // RESTAURE le volume du jeu.
  restoreGameVolume();
}


/* ================================================================== */
/* THÈME AU PIANO — le leitmotiv de « The End »                          */
/* ================================================================== */
// Un motif de piano en la mineur, sur la nappe du compte à rebours, puis
// rejoué lentement au célesta quand il ne reste que le trou noir.
var THEME_MOTIF = [[0, 69, 1], [1, 76, 1], [2, 74, .5], [2.5, 72, .5], [3, 71, 1], [4, 72, 1.5], [5.5, 71, .5], [6, 69, 2],
  [8, 67, 1], [9, 72, 1], [10, 71, .5], [10.5, 69, .5], [11, 67, 1], [12, 64, 1], [13, 69, 3]];
var THEME_BASS = [[0, 45], [4, 41], [8, 48], [12, 43]];
function themeBus() {
  if (S.hold.theme) return S.hold.theme;
  var g = S.ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.5, now(), 0.4);
  var verb = S.ctx.createConvolver(); verb.buffer = hallImpulse();
  var wet = S.ctx.createGain(); wet.gain.value = 0.55;
  var dry = S.ctx.createGain(); dry.gain.value = 0.8;
  g.connect(dry); g.connect(verb); verb.connect(wet); dry.connect(S.master); wet.connect(S.master);
  S.hold.theme = { gain: g, nodes: [] };
  return S.hold.theme;
}
function themeNote(t, midi, dur, vel, bell) {
  var bus = themeBus().gain, f0 = mtof(midi), decay = Math.max(.9, (bell ? 2.6 : 3.2) - (midi - 48) * .03);
  var partials = bell ? [[1, 1], [4.01, .22], [2.0, .12]] : [[1, 1], [2.003, .32], [3.01, .12], [4.02, .05]];
  var lp = S.ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(9000, f0 * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f0 * 2.2), t + decay * .6);
  var g = S.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .006);
  g.gain.exponentialRampToValueAtTime(vel * .35, t + .25); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, .3) + decay);
  for (var i = 0; i < partials.length; i++) {
    var o = S.ctx.createOscillator(); o.type = i ? 'sine' : (bell ? 'sine' : 'triangle');
    o.frequency.value = f0 * partials[i][0]; o.detune.value = (i % 2 ? 3 : -2);
    var pg = S.ctx.createGain(); pg.gain.value = partials[i][1];
    o.connect(pg); pg.connect(lp); o.start(t); o.stop(t + dur + decay + .1);
  }
  lp.connect(g); g.connect(bus);
}
function themePhrase(t0, beat, opts) {
  opts = opts || {};
  var vel = opts.vel || .16, shift = opts.shift || 0;
  for (var i = 0; i < THEME_MOTIF.length; i++) {
    var n = THEME_MOTIF[i];
    themeNote(t0 + n[0] * beat, n[1] + shift, n[2] * beat, vel * (i === 0 ? 1.15 : 1), !!opts.bell);
    if (opts.octave) themeNote(t0 + n[0] * beat, n[1] + shift + 12, n[2] * beat, vel * .45, !!opts.bell);
  }
  if (!opts.noBass) for (var b = 0; b < THEME_BASS.length; b++) {
    themeNote(t0 + THEME_BASS[b][0] * beat, THEME_BASS[b][1] + shift, beat * 3.5, vel * .7, false);
    themeNote(t0 + THEME_BASS[b][0] * beat + beat * 2, THEME_BASS[b][1] + shift + 7, beat * 1.5, vel * .4, false);
  }
}
function themeCountdown() { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running()) return;
  var t = now() + 1.2, beat = 60 / SC_BPM;
  // 16 temps ≈ 8,6 s : trois passages (le dernier doublé à l'octave), puis le tic-tac final prend le relais.
  themePhrase(t, beat, { vel: .12 });
  themePhrase(t + 16 * beat, beat, { vel: .14 });
  themePhrase(t + 32 * beat, beat, { vel: .15, octave: true });
  themePhrase(t + 48 * beat, beat, { vel: .13, octave: true, noBass: true });
}
function themeEnding() { if (MUSIC_V74) return; // v74 : ancienne musique retirée (event-music-v74.js)
  if (!running()) return;
  holdKill('theme');
  var t = now() + .6, beat = 60 / SC_BPM * 1.9;
  themePhrase(t, beat, { vel: .1, bell: true, shift: 12, noBass: true });
}

AZE.register('audio', {
  init: init,
  update: update,
  dispose: dispose
});

})(window);
