/* event-mode.js — module "THE END" : la carte "ÉVÉNEMENT · THE END" dans le
   sélecteur de modes d'AZUR Horizons v1.8 "Graphismes 2.0".
   - l'entrée `event` existe nativement dans les MODES (client.js, game.js) :
     ce module ne la crée pas, il la rend ÉVIDENTE — titre
     "ÉVÉNEMENT · THE END", sous-titre "SANS DÉGÂTS · ÉVÉNEMENT JOUABLE"
     (réécriture du DOM via MutationObserver : les MODES sont des constantes
     de closure, inaccessibles depuis l'extérieur) ;
   - injecte le CSS de la carte (dégradé violet / bleu électrique) avec
     halo pulsant, pop à la sélection, et bandeau animé ;
   - sécurise le HUD en partie : game.js lit MODES[w.mode][0] ; on masque
     temporairement le mode du monde pendant updateHUD puis on réécrit le
     libellé affiché avec "ÉVÉNEMENT · mm:ss" ;
   - affiche le bandeau "C'EST LA FIN." dans le salon quand le mode event
     est sélectionné ;
   - ne démarre JAMAIS l'event tout seul : le séquenceur (event-sequencer.js)
     auto-détecte AZUR.mode==='event' && AZUR.screen==='game' ; ce module
     expose en plus AZEvent.modeStart()/AZEvent.modeStop(), API explicite
     de démarrage/arrêt avec gardes strictes (init dans l'ordre canonique,
     dispose dans l'ordre inverse, AZEvent.active strict).
   IIFE, 'use strict', aucun import, aucun réseau. Inactif hors chargement :
   pas de preUpdate/update, donc aucun coût par frame (le MutationObserver
   seul reste actif, comme autorisé). */
(function(root){
'use strict';

// ---------------------------------------------------------------------------
// Garde : ne rien faire si le séquenceur (window.AZEvent, défini par
// event-sequencer.js chargé en premier) ou le jeu ne sont pas là.
// Contrat §4.2.
// ---------------------------------------------------------------------------
if(!root.AZEvent || !root.AZURHorizons || !root.AZURHorizons.prototype) return;

// ---------------------------------------------------------------------------
// Textes officiels de la carte (interface en français).
// ---------------------------------------------------------------------------
var MODE_TITLE = 'ÉVÉNEMENT · THE END';
var MODE_SUB   = '6 MINUTES · RECRÉATION LIBRE · SANS DÉGÂTS';
var BANNER_TXT = 'C\'EST LA FIN.';

// ---------------------------------------------------------------------------
// 1. CSS injecté : carte du mode dans le dialogue "Ton prochain départ"
//    (.v7-mode-option[data-id="event"]) et bandeau du salon.
// ---------------------------------------------------------------------------
var STYLE_ID = 'azevent-mode-style';
var CSS = [
  /* Carte du mode dans le dialogue "Ton prochain départ" : impossible à rater.
     v12 : halo qui respire en continu + pop franc à la sélection. */
  '@keyframes azevent-card-glow{',
  '  0%,100%{box-shadow:0 0 14px rgba(122,111,240,.30),inset 0 0 24px rgba(80,120,255,.12);}',
  '  50%{box-shadow:0 0 26px rgba(140,130,255,.55),inset 0 0 30px rgba(80,120,255,.22);}',
  '}',
  '@keyframes azevent-card-select{',
  '  0%{transform:scale(1);}',
  '  45%{transform:scale(1.045);}',
  '  75%{transform:scale(.99);}',
  '  100%{transform:scale(1);}',
  '}',
  '.v7-mode-option[data-id="event"]{',
  '  background:linear-gradient(150deg,#46308f 0%,#232a68 55%,#101a3d 100%);',
  '  border:1px solid #7a6ff0;',
  '  box-shadow:0 0 18px rgba(122,111,240,.35),inset 0 0 24px rgba(80,120,255,.12);',
  '  transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease;',
  '  animation:azevent-card-glow 3.4s ease-in-out infinite;',
  '}',
  '.v7-mode-option[data-id="event"] strong{color:#e8e4ff;}',
  '.v7-mode-option[data-id="event"] small{color:#cfc6ff;}',
  '.v7-mode-option[data-id="event"] em{color:#b9b3e8;}',
  '.v7-mode-option[data-id="event"]:hover{',
  '  border-color:#a79dff;',
  '  box-shadow:0 0 26px rgba(140,130,255,.55),inset 0 0 24px rgba(80,120,255,.18);',
  '  transform:translateY(-3px);',
  '}',
  '.v7-mode-option[data-id="event"].selected-mode{',
  '  border:2px solid #c9bfff;',
  '  box-shadow:0 0 0 3px rgba(150,140,255,.18),0 0 30px rgba(122,111,240,.5);',
  '  animation:azevent-card-select .5s cubic-bezier(.2,1.7,.35,1),',
  '    azevent-card-glow 3.4s ease-in-out .5s infinite;',
  '}',
  /* Bandeau du salon (événement jouable). v12 : entrée franche puis pulsation. */
  '@keyframes azevent-banner-in{',
  '  0%{opacity:0; transform:translateX(-50%) translateY(-10px) scale(.94);}',
  '  60%{opacity:1; transform:translateX(-50%) translateY(2px) scale(1.02);}',
  '  100%{opacity:1; transform:translateX(-50%) translateY(0) scale(1);}',
  '}',
  '.azevent-lobby-banner{',
  '  position:fixed;top:84px;left:50%;transform:translateX(-50%);',
  '  z-index:60;pointer-events:none;white-space:nowrap;',
  '  font:800 clamp(20px,2.6vw,34px)/1 BarlowCondensed,Impact,sans-serif;',
  '  letter-spacing:.45em;text-indent:.45em;color:#efeaff;',
  '  text-shadow:0 0 18px rgba(140,130,255,.9),0 2px 12px rgba(4,10,30,.9);',
  '  animation:azevent-banner-in .6s cubic-bezier(.2,1.5,.35,1),',
  '    azevent-banner-pulse 2.6s ease-in-out .6s infinite;',
  '}',
  '@keyframes azevent-banner-pulse{',
  '  0%,100%{opacity:.82; text-shadow:0 0 14px rgba(140,130,255,.7),0 2px 12px rgba(4,10,30,.9);}',
  '  50%{opacity:1; text-shadow:0 0 26px rgba(160,150,255,1),0 2px 12px rgba(4,10,30,.9);}',
  '}',
  '@media(max-width:620px){',
  '  .azevent-lobby-banner{top:112px;letter-spacing:.25em;text-indent:.25em;}',
  '}'
].join('\n');

var styleEl = null;
if(typeof document !== 'undefined'){
  styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
}

// ---------------------------------------------------------------------------
// 2. Carte "ÉVÉNEMENT · THE END" évidente dans le sélecteur de modes.
//    Les MODES de client.js / game.js sont des constantes de closure :
//    on réécrit le DOM rendu (idempotent : on ne touche un élément qu'une
//    fois, et on vérifie le contenu avant d'écrire pour ne pas boucler).
// ---------------------------------------------------------------------------
function syncModeCard(){
  if(typeof document === 'undefined') return;

  // 2a. Dialogue "Ton prochain départ" (client.js) : titre + sous-titre.
  var cards = document.querySelectorAll('.v7-mode-option[data-id="event"]');
  for(var i = 0; i < cards.length; i++){
    var card = cards[i];
    if(card._azeventFixed) continue;
    // v48 : la carte doit garder icône, titre, accroche et détail.
    if(!card.querySelector('strong')){
      var icon = root.AZIcons && root.AZIcons.icon ? root.AZIcons.icon('star') : '';
      card.innerHTML = '<span>' + icon + '</span><strong></strong><small>La faille s\u2019ouvre. Le monde bascule.</small><em></em>';
    }
    var strong = card.querySelector('strong');
    var em = card.querySelector('em');
    if(strong && strong.textContent !== MODE_TITLE) strong.textContent = MODE_TITLE;
    if(em && em.textContent !== MODE_SUB) em.textContent = MODE_SUB;
    card._azeventFixed = true;
  }

  // 2b. Grille des modes du salon (game.js, lobbyHTML) : même libellé.
  //     Les cartes riches du dialogue ont leur propre structure (2a).
  var btns = document.querySelectorAll('button[data-act="mode"][data-id="event"]:not(.v7-mode-option)');
  for(var j = 0; j < btns.length; j++){
    var b = btns[j];
    if(b.textContent !== MODE_TITLE) b.textContent = MODE_TITLE;
  }

  // 2c. Bandeau du salon (visible seulement en mode event).
  syncBanner();
}

// ---------------------------------------------------------------------------
// 3. Sécurisation du HUD en partie.
//    game.js lit MODES[w.mode][0] (lignes 622 et 1235) ; l'entrée `event`
//    existe dans game.js donc pas de TypeError. Par sécurité on masque
//    quand même temporairement le mode du monde ('solo', synchrone,
//    restauré en finally), puis on réécrit le libellé avec le vrai nom.
// ---------------------------------------------------------------------------
function fmtClock(t){
  t = Math.max(0, Math.floor(t || 0));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

var Proto = root.AZURHorizons && root.AZURHorizons.prototype;
var baseUpdateHUD = Proto && Proto.updateHUD;
var patchedUpdateHUD = null;

if(Proto && typeof baseUpdateHUD === 'function' && !baseUpdateHUD._azeventMode){
  patchedUpdateHUD = function(){
    var w = this.world;
    if(w && w.mode === 'event'){
      // Masque temporaire : l'appel ci-dessous est 100 % synchrone, aucun
      // autre code ne s'exécute entre le masquage et la restauration.
      w.mode = 'solo';
      try { baseUpdateHUD.call(this); }
      finally { w.mode = 'event'; }
      // Corrige le libellé de phase avec le vrai nom du mode.
      try {
        var p = (typeof this.player === 'function') ? this.player() : null;
        var namedBranch = p && w.phase !== 'waiting' &&
          !(w.phase === 'transport' && !p.deployed) &&
          !p.falling && !p.gliding;
        if(namedBranch && typeof document !== 'undefined'){
          var el = document.getElementById('phase-detail');
          if(el) el.textContent = MODE_TITLE + ' · ' + fmtClock(w.elapsed);
        }
        if (p && p._eventFloat && !p.gliding) {
          var phaseTitle = document.getElementById('phase-title'), phaseDetail = document.getElementById('phase-detail');
          if (phaseTitle) { phaseTitle.textContent = 'APESANTEUR'; phaseTitle.parentElement.hidden = false; }
          if (phaseDetail) phaseDetail.textContent = 'GRAVITÉ SUSPENDUE · DÉPLACEMENT LIBRE';
          var flightLabel = document.querySelector('#flight-speed span'); if (flightLabel) flightLabel.textContent = 'km/h · FLOTTE';
        }
        var netLabel = document.getElementById('net-label'); if (netLabel) netLabel.textContent = w.eventVariant === 'flight' ? 'ÉVÉNEMENT 2 · VOL SANS FIN · SANS CRASH' : 'THE END · SANS DÉGÂTS';
      } catch(_){ /* le HUD ne doit jamais faire planter la boucle */ }
      return;
    }
    return baseUpdateHUD.call(this);
  };
  patchedUpdateHUD._azeventMode = true;
  Proto.updateHUD = patchedUpdateHUD;
}

// ---------------------------------------------------------------------------
// 4. Bandeau du salon.
//    Affiché uniquement quand AZUR.mode==='event' && AZUR.screen==='menu'.
// ---------------------------------------------------------------------------
var BANNER_ID = 'azevent-lobby-banner';
var bannerEl = null;
var observer = null;

function bannerShouldShow(){
  var g = root.AZUR;
  return !!(g && g.mode === 'event' && g.screen === 'menu');
}

function syncBanner(){
  if(typeof document === 'undefined') return;
  var show = bannerShouldShow();
  if(show && !bannerEl){
    bannerEl = document.createElement('div');
    bannerEl.id = BANNER_ID;
    bannerEl.className = 'azevent-lobby-banner';
    bannerEl.setAttribute('aria-hidden', 'true');
    bannerEl.textContent = BANNER_TXT;
    document.body.appendChild(bannerEl);
  } else if(!show && bannerEl){
    if(bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
  }
}

if(typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'){
  observer = new MutationObserver(syncModeCard);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  syncModeCard();
}

// ---------------------------------------------------------------------------
// 5. Orchestration explicite start() / stop().
//    Le séquenceur (event-sequencer.js) reste le seul exécutant : il appelle
//    init() dans l'ordre d'enregistrement et dispose() dans l'ordre inverse.
//    Ce module expose l'API publique explicite avec des gardes STRICTES pour
//    que le mode event ne perturbe JAMAIS le mode normal :
//    - modeStart() refuse de démarrer si l'event est déjà actif, si le jeu
//      n'est pas réellement en mode 'event', ou si un module manque
//      (event partiel = event refusé) ;
//    - modeStop() est idempotent et garantit AZEvent.active === false même
//      si un dispose() a levé (bloc finally).
// ---------------------------------------------------------------------------

// Ordre canonique des 19 modules (dépendances d'abord). Le séquenceur
// initialise dans l'ordre d'enregistrement (ordre des <script>) et libère
// dans l'ordre inverse ; cette liste documente l'ordre attendu et sert à
// vérifier l'intégrité avant tout démarrage explicite.
var MODULE_ORDER = [
  'particles',  // AZEvent.fx partagé : requis par tous les effets
  'arena',      // pas de tir + balisage
  'sky',        // ciel de l'événement (sauvegarde l'original pour restauration)
  'countdown',  // horloge holographique 3D
  'hud',        // minuteur + titres discrets
  'zeropoint',  // Point Zéro : coquilles, anneaux, rochers
  'meteor',     // météorite figée, visible dès t=0
  'rift',       // failles (publie AZEvent.rifts)
  'rockets',    // les 7 fusées (traversent les failles)
  'camera',     // plans cinéma (ne traverse jamais fusée ni météorite)
  'cinedir',    // v10 : directeur cinématique (CINÉ/LIBRE, patch renderer.render)
  'player',     // joueur projeté puis aspiré, sans dégâts
  'shockwave',  // ondes de choc
  'impact',     // explosion finale + contraction
  'suction',    // tornade d'aspiration + destruction progressive
  'blackhole',  // formation, disque d'accrétion bleu, nombres
  'finale',     // écran final + bouton QUITTER
  'audio',      // musique + bruitages 100 % Web Audio (en dernier)
  'mode'        // ce module : carte, HUD, bandeau
  // + 'sequencer' : l'orchestrateur lui-même (ni init ni dispose).
];

MODULE_ORDER = ['mode', 'countdown', 'coherence', 'impactdetail', 'suction', 'blackhole', 'cinedir', 'audio', 'particles', 'sky', 'player', 'arena', 'hud', 'finale'];
function modulesMissing(){
  var missing = [];
  var mods = root.AZEvent && root.AZEvent.mods;
  for(var i = 0; i < MODULE_ORDER.length; i++){
    if(!mods || !mods[MODULE_ORDER[i]]) missing.push(MODULE_ORDER[i]);
  }
  return missing;
}

// Démarrage explicite. Retourne true si l'event est actif après l'appel,
// false si le démarrage a été refusé (garde stricte).
function modeStart(){
  var AZE = root.AZEvent;
  if(!AZE) return false;
  if(AZE.active) return true; // déjà actif : pas de double init
  var g = root.AZUR;
  if(!g || (g.mode !== 'event' && g.mode !== 'eventflight')) return false;
  if(modulesMissing().length > 0) return false; // event partiel refusé
  AZE.start(); // le séquenceur : init() dans l'ordre, puis phase countdown
  return AZE.active === true;
}

// Arrêt explicite. Idempotent ; garantit AZEvent.active === false pour que
// le mode normal reparte sur un état strictement sain.
function modeStop(){
  var AZE = root.AZEvent;
  if(!AZE) return false;
  if(!AZE.active) return true; // déjà arrêté : rien à faire
  try {
    AZE.stop(); // le séquenceur : dispose() dans l'ordre inverse
  } finally {
    AZE.active = false; // strict : aucun résidu d'état event en mode normal
  }
  return AZE.active === false;
}

root.AZEvent.modeStart = modeStart;
root.AZEvent.modeStop = modeStop;
root.AZEvent.MODULE_ORDER = MODULE_ORDER.slice();

// ---------------------------------------------------------------------------
// 6. Enregistrement auprès du séquenceur. Pas de preUpdate/update : ce
//    module agit au chargement, il n'a aucun travail par frame.
//    dispose() restaure tout (patch HUD, bandeau, observer, CSS).
// ---------------------------------------------------------------------------
root.AZEvent.register('mode', {
  init: function(){
    if (Proto && patchedUpdateHUD) Proto.updateHUD = patchedUpdateHUD;
    // Tout est déjà en place au chargement du script ; on resynchronise
    // la carte au cas où le jeu existait déjà.
    // v23 : dispose() retire le <style> et déconnecte l'observateur — on
    // les recrée ici, sinon la carte perd son style et sa synchro live
    // dès le deuxième passage (restart).
    if (!styleEl && typeof document !== 'undefined') {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
    syncModeCard();
    if (!observer && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      observer = new MutationObserver(syncModeCard);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  },
  dispose: function(){
    if(Proto && patchedUpdateHUD && Proto.updateHUD === patchedUpdateHUD){
      Proto.updateHUD = baseUpdateHUD;
    }
    if(observer){ try { observer.disconnect(); } catch(_){} observer = null; }
    if(bannerEl){
      if(bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
      bannerEl = null;
    }
    if(styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    styleEl = null;
  }
});

})(window);
