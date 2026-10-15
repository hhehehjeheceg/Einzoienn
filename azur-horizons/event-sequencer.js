/* event-sequencer.js — MODULE 1/19 du projet "THE END".
   Cœur du système d'event : définit window.AZEvent (machine à états,
   timeline, bus d'événements, registre de modules) et patche la boucle
   du jeu pour exécuter les modules d'event autour de la simulation.
   Aucun import, THREE est global, aucun appel réseau. */
(function(root){
'use strict';

// ---------------------------------------------------------------------------
// Timeline v17 — 23 états, 300 s (5 minutes) EXACTEMENT.
// v17 : RESSERREMENT narratif (336 s -> 300 s) à la demande de
// l'utilisateur — FINI les segments qui tournent en boucle (impression de
// boucle d'1 minute). Chaque phase a une fonction narrative claire :
// anticipation -> climax -> résolution, jamais de remplissage.
//   - 'loop' (7 s) devient un passage DYNAMIQUE court : survol/balayage
//     unique près de la météorite, PAS de cercles répétitifs.
//   - 'acceleration' (26 s) reste une montée en puissance CONTINUE vers la
//     chute dans la faille, sans répétition.
//   - 'numbers' >= 7 s (nombres un par un), 'blackhole' >= 8 s,
//     'impact' >= 35 s, 'destruction' >= 8 s, 'countdown' = 60 s.
//   - 'descent' + 'veeroff' = 28 s inchangés (le diviseur 28 de
//     event-zeropoint.js pressureK() reste valide tel quel).
// v14 : le compte à rebours passe de 12 s à 60 s — l'événement démarre
// 1 minute après le lancement ; toutes les phases suivantes sont décalées
// de 48 s plus tard. Le timing intra-phase reste relatif à l'entrée de
// phase (tState) dans les 19 modules.
// v12 : séquence « prise de la météorite » COMPRESSÉE de 88 s à 48 s
// (convergence 8 s + loop 10 s + acceleration 30 s) ; toutes les phases
// suivantes décalées de 40 s plus tôt. La capture compressée v12 reste
// inchangée dans v14.
// Recréation du live Fortnite Chapitre 1 Saison X (13/10/2019) en 22 phases
// utilisateur + finale. MAPPING états -> phases utilisateur :
//   countdown    = Phase 1      | firstrocket  = Phase 1 (fin)
//   sixrockets   = Phases 2-3    | convergence  = Phase 4
//   loop         = Phase 5       | acceleration = Phase 6
//   silence      = Phase 7       | strike       = Phase 8
//   thrown       = Phase 9       | greatrift    = Phase 10
//   meteorsix    = Phase 11      | descent      = Phase 12
//   veeroff      = Phase 13      | impact       = Phase 14
//   contraction  = Phase 15      | collapse     = Phase 16
//   growth       = Phase 17      | destruction  = Phase 18
//   playersucked = Phase 19      | allgone      = Phase 20
//   blackhole    = Phase 21      | numbers      = Phase 22
//   end          = Finale (noir + point bleu, RIEN après)
// BORNES EN SECONDES : ne jamais les changer ici sans valider avec les
// 19 modules (tout le timing intra-phase est relatif à l'entrée de phase).
// ---------------------------------------------------------------------------
// v31 : 360 s. Les séquences de vol et de contact gardent leur vitesse ;
// les secondes ajoutées servent à l’allumage, aux passages et aux résonances.
var TIMELINE = {
  countdown:    [0, 60],
  firstrocket:  [60, 90],
  sixrockets:   [90, 118],
  convergence:  [118, 130],
  loop:         [130, 141],
  acceleration: [141, 177],
  silence:      [177, 182],
  strike:       [182, 195],
  thrown:       [195, 208],
  greatrift:    [208, 218],
  meteorsix:    [218, 225],
  descent:      [225, 245],
  veeroff:      [245, 253],
  impact:       [253, 302],
  contraction:  [302, 309],
  collapse:     [309, 312],
  growth:       [312, 318],
  destruction:  [318, 331],
  playersucked: [331, 335],
  allgone:      [335, 339],
  blackhole:    [339, 347],
  numbers:      [347, 360],
  end:          [360, Infinity]
};
// v75 : en mode film, seuls ces modules tournent (les autres restent chargés mais inactifs)
// v78 : l'événement de la v75 (film calé sur la vidéo) + le gameplay demandé :
// bus et déplacement libre (player), anciennes failles / météorite solide /
// Point Zéro (coherence), monde des failles (rift-world), lasers (zerorage).
// Les anciens habillages (ciels roses, flashs, fumées…) restent coupés.
// v81 : refonte complète calée sur la vidéo — end81 (spectacle) + play81 (joueur libre, bus,
// interface). Les anciens habillages (film75, cohérence, colère du Point Zéro, monde des
// failles…) restent chargés mais ne tournent plus.
var FILM_MODS = { end81: 1, play81: 1, music75: 1, music86: 1, countdown: 1, mode: 1, animation: 1 };
function runs(name){ return !AZEvent.FILM || !!FILM_MODS[name]; }

// v78 : HORLOGE VIDÉO. Le temps réel fait avancer le temps de la vidéo de
// référence (5 min 03, précédé de 54 s de compte à rebours dans le bus).
// Les modules de gameplay gardent leurs phases d'origine (TIMELINE) : leur
// horloge tTotal est déduite du temps vidéo phase par phase.
var FILM_PRE = 54;
var VIDEO_AT = { countdown: -54, firstrocket: 6, sixrockets: 38, convergence: 90, loop: 118, acceleration: 130, silence: 150, strike: 151, thrown: 156,
  greatrift: 176, meteorsix: 188, descent: 210, veeroff: 218, impact: 224, contraction: 240, collapse: 244, growth: 248, destruction: 250,
  playersucked: 252, allgone: 254, blackhole: 258, numbers: 296, end: 303 };

// Ordre strict des phases (sans 'idle' : jamais actif dans cet état).
var PHASE_ORDER = ['countdown','firstrocket','sixrockets','convergence','loop',
                   'acceleration','silence','strike','thrown','greatrift',
                   'meteorsix','descent','veeroff','impact','contraction',
                   'collapse','growth','destruction','playersucked','allgone',
                   'blackhole','numbers','end'];

// ---------------------------------------------------------------------------
// Objet global window.AZEvent — contrat §1
// ---------------------------------------------------------------------------
var AZEvent = {
  state: 'idle',        // état courant de la machine à états
  tState: 0,           // secondes écoulées dans l'état courant
  tTotal: 0,           // secondes écoulées depuis start()
  active: false,       // true quand l'event tourne (mode "event" en partie)
  mods: {},            // nom -> module enregistré
  api: null,           // rempli à start() (contrat §3)
  TIMELINE: TIMELINE,  // bornes de phases en secondes
  duration: TIMELINE.end[0],
  rifts: [],           // publié par event-rift.js : [{pos:Vector3, open:bool}]
  fx: null,            // publié par event-particles.js : helpers de particules
  FILM: true,           // v78 : événement de la v75 (film) rendu jouable
  FILM_PLAY: true,      // v78 : caméra et déplacements libres, horloge vidéo
  tVideo: -54,         // v78 : temps de la vidéo de référence (s)
  suctionActive: false, // drapeau lu par event-player.js
  meteorUnfrozen: false // v10 : mis à true par event-rockets.js quand la météorite
                        // doit vibrer puis tomber dans la faille avant (phase 6) ;
                        // consommé par event-meteor.js (avec le bus 'meteor:unfreeze')

  // register/start/stop/setState/on/emit ajoutés plus bas.
};

// Ordre d'enregistrement des modules (pour init() dans l'ordre,
// dispose() dans l'ordre inverse).
var modOrder = [];

// ---------------------------------------------------------------------------
// Bus d'événements : on(evt, fn) / emit(evt, data)
// ---------------------------------------------------------------------------
var listeners = {};

function busOn(evt, fn){
  if (typeof fn !== 'function') return;
  if (!listeners[evt]) listeners[evt] = [];
  listeners[evt].push(fn);
}

function busEmit(evt, data){
  var list = listeners[evt];
  if (!list) return;
  for (var i = 0; i < list.length; i++){
    try { list[i](data); } catch (e) { reportError('bus:' + evt + ':' + i, e); }
  }
}

// ---------------------------------------------------------------------------
// Enregistrement d'un module (contrat §4 règle 2)
// ---------------------------------------------------------------------------
function register(name, mod){
  if (!name || !mod) return;
  AZEvent.mods[name] = mod;
  if (modOrder.indexOf(name) === -1) modOrder.push(name);
  // Si l'event est déjà actif, le module démarre tout de suite.
  if (AZEvent.active && AZEvent.api && typeof mod.init === 'function' && runs(name)){
    try { mod.init(AZEvent.api); } catch (e) { /* init isolée */ }
  }
}

// ---------------------------------------------------------------------------
// Construction de l'objet api (contrat §3) — appelé à chaque start()
// ---------------------------------------------------------------------------
function buildApi(){
  var T = root.THREE;
  var G = root.AZUR || null;

  // Qualité : mobile -> 'low', sinon depuis view.quality (ultra -> 'high').
  var isMobile = !!(G && G.view && G.view.mobileRenderer);
  var quality = 'medium';
  if (isMobile){
    quality = 'low';
  } else {
    var vq = G && G.view && G.view.quality;
    if (vq === 'low') quality = 'low';
    else if (vq === 'high' || vq === 'ultra') quality = 'high';
  }

  // Centre de la map = position du Point Zéro (0, h, 0).
  var groundH = 30; // estimation de secours
  try {
    if (root.AZSim && typeof root.AZSim.heightAt === 'function'){
      var h = root.AZSim.heightAt(0, 0);
      if (isFinite(h)) groundH = h;
    }
  } catch (e) { /* on garde l'estimation */ }
  var center = new T.Vector3(0, groundH, 0);

  return {
    T: T,
    game: function(){ return root.AZUR || null; },
    view: function(){ var g = root.AZUR; return (g && g.view) || null; },
    scene: function(){ var g = root.AZUR; return (g && g.view && g.view.scene) || null; },
    camera: function(){ var g = root.AZUR; return (g && g.view && g.view.camera) || null; },
    renderer: function(){ var g = root.AZUR; return (g && g.view && g.view.renderer) || null; },
    world: function(){ var g = root.AZUR; return (g && g.world) || null; },
    player: function(){
      try { var g = root.AZUR; return (g && typeof g.player === 'function') ? g.player() : null; }
      catch (e) { return null; }
    },
    players: function(){
      try { var g = root.AZUR; return (g && g.world && g.world.players) || []; }
      catch (e) { return []; }
    },
    center: center,
    on: busOn,
    emit: busEmit,
    rand: function(a, b){ return a + Math.random() * (b - a); },
    clamp: function(v, a, b){ return v < a ? a : (v > b ? b : v); },
    lerp: function(a, b, t){ return a + (b - a) * t; },
    hud: function(){
      return (typeof document !== 'undefined')
        ? document.getElementById('azevent-hud')
        : null;
    },
    quality: quality,
    isMobile: isMobile
  };
}

// ---------------------------------------------------------------------------
// Démarrage de l'event
// ---------------------------------------------------------------------------
function start(){
  if (AZEvent.active) return; // déjà lancé
  AZEvent.api = buildApi();
  AZEvent.active = true;
  AZEvent.tState = 0;
  AZEvent.tTotal = 0;
  AZEvent.tVideo = VIDEO_AT.countdown;
  AZEvent.meteorUnfrozen = false; // réarmé à chaque démarrage (contrat v10)
  AZEvent.hold = false;
  AZEvent.state = 'idle';
  AZEvent.anchors = {};
  AZEvent.suctionActive = false;
  AZEvent.errors = [];
  var game = root.AZUR;
  if (game) game.__azeventLast = undefined;
  // init() de chaque module dans l'ordre d'enregistrement.
  for (var i = 0; i < modOrder.length; i++){
    var mod = AZEvent.mods[modOrder[i]];
    if (mod && typeof mod.init === 'function' && runs(modOrder[i])){
try { mod.init(AZEvent.api); } catch (e) { reportError('init:' + modOrder[i], e); }
    }
  }
  // Passage en phase countdown (émet 'phase:countdown').
  setState('countdown');
}

// ---------------------------------------------------------------------------
// Arrêt de l'event + nettoyage
// ---------------------------------------------------------------------------
function stop(){
  if (!AZEvent.active) return;
  // dispose() dans l'ordre inverse d'enregistrement.
  for (var i = modOrder.length - 1; i >= 0; i--){
    var mod = AZEvent.mods[modOrder[i]];
    if (mod && typeof mod.dispose === 'function' && runs(modOrder[i])){
      try { mod.dispose(); } catch (e) { /* dispose isolée */ }
    }
  }
  AZEvent.active = false;
  AZEvent.state = 'idle';
  busEmit('event:stopped');
}

// ---------------------------------------------------------------------------
// Transition d'état (émet 'phase:<état>')
// ---------------------------------------------------------------------------
function setState(s){
  AZEvent.state = s;
  AZEvent.tState = 0;
  busEmit('phase:' + s);
}

// v78 : correspondances temps vidéo <-> temps des phases d'origine.
function oldFromVideo(tv){
  for (var i = 0; i < PHASE_ORDER.length - 1; i++){
    var a = PHASE_ORDER[i], b = PHASE_ORDER[i + 1];
    if (tv < VIDEO_AT[b]){
      var k = (tv - VIDEO_AT[a]) / Math.max(.001, VIDEO_AT[b] - VIDEO_AT[a]);
      return TIMELINE[a][0] + Math.max(0, k) * (TIMELINE[b][0] - TIMELINE[a][0]);
    }
  }
  return TIMELINE.end[0] + (tv - VIDEO_AT.end);
}
function videoFromOld(t){
  for (var i = 0; i < PHASE_ORDER.length - 1; i++){
    var a = PHASE_ORDER[i], b = TIMELINE[a];
    if (t < b[1]){
      var k = (t - b[0]) / Math.max(.001, b[1] - b[0]);
      return VIDEO_AT[a] + Math.max(0, k) * (VIDEO_AT[PHASE_ORDER[i + 1]] - VIDEO_AT[a]);
    }
  }
  return VIDEO_AT.end + (t - TIMELINE.end[0]);
}
AZEvent.oldFromVideo = oldFromVideo;
AZEvent.videoFromOld = videoFromOld;
AZEvent.FILM_PRE = FILM_PRE;
// Temps de la vidéo (0 = début de la vidéo ; négatif pendant le compte à rebours).
AZEvent.filmVideoTime = function(){ return AZEvent.FILM_PLAY ? AZEvent.tVideo : AZEvent.tTotal; };

// Retrouve la phase correspondant à tTotal selon la TIMELINE.
function phaseForTime(t){
  for (var i = 0; i < PHASE_ORDER.length; i++){
    var name = PHASE_ORDER[i];
    var b = TIMELINE[name];
    if (t >= b[0] && t < b[1]) return name;
  }
  return 'end';
}

function advance(delta) {
  if (!AZEvent.active || !isFinite(delta) || delta < 0) return;
  if (AZEvent.hold) return;
  var destination = Math.min(AZEvent.duration, AZEvent.tTotal + delta);
  if (AZEvent.FILM_PLAY) {
    // v89 : la bande-son est l'horloge maîtresse. Quand elle joue, le temps de
    // l'événement suit sa position (correction douce, recalage si l'écart est
    // grand) : un ralentissement ou une saccade ne décale plus jamais l'image
    // par rapport à la musique.
    var nt = AZEvent.tVideo + delta, mc = typeof AZEvent.musicClock === 'function' ? AZEvent.musicClock() : null;
    if (mc != null && isFinite(mc)) {
      var err = mc - nt;
      if (Math.abs(err) > .5) nt = mc; else nt += err * Math.min(1, delta * 4);
      if (nt < AZEvent.tVideo) nt = AZEvent.tVideo;
    }
    AZEvent.tVideo = Math.min(VIDEO_AT.end + 10, nt);
    destination = Math.max(AZEvent.tTotal, Math.min(AZEvent.duration, oldFromVideo(AZEvent.tVideo)));
  }
  for (var i = 0; i < PHASE_ORDER.length; i++) {
    var name = PHASE_ORDER[i], startAt = TIMELINE[name][0];
    if (startAt > AZEvent.tTotal && startAt <= destination) {
      AZEvent.tTotal = startAt;
      setState(name);
    }
  }
  AZEvent.tTotal = destination;
  var phase = phaseForTime(destination);
  if (phase !== AZEvent.state) setState(phase);
  AZEvent.tState = destination - TIMELINE[phase][0];
}

function reportError(context, error) {
  var errors = AZEvent.errors || (AZEvent.errors = []);
  if (errors.some(function (item) { return item.context === context; })) return;
  errors.push({ context: context, message: String(error && error.message || error) });
  console.error('[AZUR événement] ' + context, error);
}

// Exposition des méthodes sur l'objet global.
AZEvent.beforeView = function (dt) {
  if (!AZEvent.active) return;
  for (var i = 0; i < modOrder.length; i++) {
    var mod = AZEvent.mods[modOrder[i]];
    if (mod && typeof mod.beforeRender === 'function' && runs(modOrder[i])) { // v81b : seuls les modules actifs
      try { mod.beforeRender(dt, AZEvent.tTotal); } catch (e) { reportError('beforeRender:' + modOrder[i], e); }
    }
  }
};
AZEvent.advance = advance;
AZEvent.register = register;
AZEvent.start = start;
AZEvent.stop = stop;
AZEvent.setState = setState;
AZEvent.on = busOn;
AZEvent.emit = busEmit;
root.AZEvent = AZEvent;

// ---------------------------------------------------------------------------
// Patch de la boucle du jeu (même technique que engine-v2.js)
// preUpdate(dt, t) des modules AVANT la loop originale, update(dt, t) APRÈS.
// ---------------------------------------------------------------------------
function patchLoop(){
  var Ctor = root.AZURHorizons;
  if (!Ctor || !Ctor.prototype || typeof Ctor.prototype.loop !== 'function'){
    return false; // constructeur pas encore chargé
  }
  var P = Ctor.prototype;
  if (P.__azeventPatched) return true; // déjà patché, pas de double wrapper
  P.__azeventPatched = true;
  var orig = P.loop;

  P.loop = function(t){
    var G = root.AZUR;

    // --- Détection automatique de démarrage / arrêt -------------------
    var _w = G && G.world;
    var _eventMode = G && (G.mode === 'event' || G.mode === 'eventflight');
    var _departed = _w && (_w.phase === 'transport' || _w.phase === 'active');
    if (!AZEvent.active && _eventMode && G.screen === 'game' && _departed){
      start();
    } else if (AZEvent.active &&
               G && (G.screen !== 'game' || !_eventMode)){
      stop();
    }

    // --- Hors event : comportement 100 % d'origine --------------------
    if (!AZEvent.active){
      orig.call(this, t);
      return;
    }

    // --- Horloge de l'event : dt clampé à 0.1s ------------------------
    var dt = 1 / 60;
    if (typeof t === 'number' && isFinite(t)){
      var last = this.__azeventLast;
      if (typeof last === 'number' && isFinite(last)){
        dt = (t - last) / 1000;
      }
      this.__azeventLast = t;
    }
    if (!isFinite(dt) || dt < 0) dt = 1 / 60;
    // v66 : l'horloge de l'event avance au même pas (plafonné) que la
    // simulation. Sur un appareil lent, l'event ne prend plus d'avance sur le
    // jeu (bus abattu après le décollage, joueur encore dans le bus…).
    if (dt > 0.1) dt = 0.1;
    var elapsed = dt;

    var hidden = typeof document !== 'undefined' && document.hidden;
    if (!hidden && !G.paused) advance(elapsed);
    else dt = 0;

    // --- preUpdate AVANT la simulation du jeu -------------------------
    for (var i = 0; i < modOrder.length; i++){
      var pre = AZEvent.mods[modOrder[i]];
      if (pre && typeof pre.preUpdate === 'function' && runs(modOrder[i])){
        try { pre.preUpdate(dt, AZEvent.tTotal); } catch (e) { reportError('preUpdate:' + modOrder[i], e); }
      }
    }

    // --- Boucle originale du jeu (simulation + rendu) -----------------
    orig.call(this, t);

    // --- update APRÈS le rendu -----------------------------------------
    for (var j = 0; j < modOrder.length; j++){
      var upd = AZEvent.mods[modOrder[j]];
      if (upd && typeof upd.update === 'function' && runs(modOrder[j])){
        try { upd.update(dt, AZEvent.tTotal); } catch (e) { reportError('update:' + modOrder[j], e); }
      }
    }
  };

  return true;
}

// Le constructeur peut ne pas exister encore au chargement de ce fichier
// (ordre des scripts) : on réessaie via un intervalle, max 10 secondes,
// puis on abandonne silencieusement.
if (!patchLoop()){
  var attempts = 0;
  var retryTimer = setInterval(function(){
    attempts++;
    if (patchLoop() || attempts >= 20){
      clearInterval(retryTimer);
    }
  }, 500);
}

})(window);
