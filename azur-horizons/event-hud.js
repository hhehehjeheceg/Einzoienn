// event-hud.js — module "THE END" v7 : HUD DOM minimal de l'événement.
// ÉVÉNEMENT JOUABLE : le HUD du jeu reste visible (le joueur joue).
// SEUL module autorisé à créer le HUD DOM de l'event (avec event-countdown.js
// pour ses propres éléments, retirés à son dispose).
// - TOUT PETIT indicateur de phase en coin (bas-gauche) à chaque transition
//   (bus 'phase:<nom>') : entrée franche avec overshoot, jamais au centre ;
// - v10 : bouton discret CINÉ/LIBRE (bas-droite, + touche C) synchronisé avec
//   le directeur cinématique via 'camera:mode' / 'camera:mode:set' ;
// - à 'end' : écran noir total, aucun HUD.
// RIEN ne couvre l'action au centre de l'écran. Aucun bouton de téléchargement.
// Pas de bandes cinéma (ce n'est pas une cinématique).
// - v22 : flèche « où regarder » teintée PAR PHASE (cyan le jour, rouge
//   électrique sur les dangers, bleu profond sur le trou noir, blanc pâle
//   sur les nombres), vignette de bord étendue ('strike' électrique,
//   'silence' à peine perceptible) + teinte PONCTUELLE sur chaque nombre
//   ('number:show') et chaque jalon du compte à rebours
//   ('countdown:milestone'). Pur DOM : zéro coût 3D.
(function (root) {
  'use strict';

  // Ne rien faire si le séquenceur n'est pas chargé.
  if (!root.AZEvent) return;

  var CONTAINER_ID = 'azevent-hud';
  var STYLE_ID = 'azevent-hud-style';

  // Libellés courts, un par phase — en français.
  // 'numbers' : aucun (les chiffres sont affichés par event-finale.js).
  // 'end'     : aucun (écran noir total).
  var PHASE_LABELS = {
    countdown:    'COMPTE À REBOURS FINAL',
    firstrocket:  'DÉCOLLAGE',
    sixrockets:   'SIX AUTRES FUSÉES',
    convergence:  'CONVERGENCE',
    loop:         'LA BOUCLE',
    acceleration: 'ACCÉLÉRATION',
    silence:      'SILENCE',
    strike:       'IMPACT IMMINENT',
    thrown:       'ONDE DE CHOC',
    greatrift:    'LA GRANDE FAILLE',
    meteorsix:    'LE RETOUR DE LA MÉTÉORITE',
    descent:      'DESCENTE',
    veeroff:      'ÉVACUATION',
    impact:       'IMPACT FINAL',
    contraction:  'CONTRACTION',
    collapse:     'EFFONDREMENT',
    growth:       'LE TROU NOIR GRANDIT',
    destruction:  "DESTRUCTION DE L'ÎLE",
    playersucked: 'ASPIRÉ',
    allgone:      'TOUT DISPARAÎT',
    blackhole:    'TROU NOIR'
  };

  var PILL_DURATION = 2.5; // secondes d'affichage de l'indicateur de phase

  var api = null;
  var container = null;
  var styleEl = null;
  var letterTop = null;
  var letterBot = null;
  var phaseEl = null;
  var blackEl = null;
  var camBtn = null;      // v10 : bouton discret CINÉ/LIBRE
  var camMode = 'free';   // v10.1 : reflète le défaut du directeur (LIBRE) ; sync via 'camera:mode'
  var pillTimer = 0;   // secondes écoulées depuis l'affichage de l'indicateur courant
  var pillActive = false;
  var pillHot = false; // la pastille courante est une phase critique (pulsation)
  var pillHotT = 0;    // temps écoulé depuis le début de la pulsation (s)
  var pillSwap = null; // {label, hot, t} : pastille en attente pendant le retrait
  var disposed = false;

  // v16 — pastille d'alerte (télégraphes 'warn:*') + flèche de direction.
  var warnEl = null;     // pastille d'alerte (haut de l'écran)
  var warnTimer = 0;     // temps écoulé depuis l'affichage de l'alerte (s)
  var warnVisible = false;
  var focusEl = null;    // flèche pulsante « où regarder »
  var focusV = null;     // {t,p,c} : Vector3 temporaires (zéro allocation par frame)
  var focusColor = '';   // v21 : dernier état teinté sur la flèche (anti-churn de style)
  // v17 — VIGNETTE DE BORD : l'écran « respire » la couleur du danger
  // (rouge pulsant pendant la plongée, flash blanc à l'impact, bleu
  // d'aspiration pendant l'effondrement). Pur DOM : aucun coût 3D.
  var edgeEl = null;
  var flashEl = null;    // v20 : flash d'écran franc (impact majeur)
  var flashT = 0;        // v20 : temps restant du flash (s)
  var flashDur = 0.25;   // v20 : durée totale du flash
  var edgeBoost = 0;     // v20 : sursaut de la vignette sur les ondes de choc
  var edgeTint = null;   // v22 : teinte d'alerte ponctuelle de la vignette ('r,g,b')
  var edgeTintT = 0;     // v22 : temps restant de la teinte ponctuelle (s)
  var busBound = false;  // v23 : écouteurs du bus branchés une seule fois (pas de off())

  // v16 — libellés des alertes (émis par event-player.js ~2 s avant chaque
  // impulsion subie). Courts, français, jamais au centre de l'écran.
  var WARN_LABELS = {
    'warn:zeroshock': '⚠ ONDE DE CHOC — ACCROCHE-TOI',
    'warn:thrown':    "⚠ L'ONDE ARRIVE",
    'warn:veer':      '⚠ PROJECTION IMMINENTE',
    'warn:blast':     '⚠ IMPACT — ACCROCHE-TOI',
    'warn:suck':      '⚠ ASPIRATION IMMINENTE'
  };
  var WARN_DURATION = 2.4; // secondes d'affichage de la pastille d'alerte

  // CSS injecté : polices système uniquement, aucun réseau.
  var CSS = [
    '#azevent-hud{',
    '  position:fixed; inset:0; z-index:2147483000;',
    '  pointer-events:none;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
    '  user-select:none; -webkit-user-select:none;',
    '}',
    '#azevent-hud .azevent-hidden{display:none !important;}',
    /* Letterbox cinéma discrète. */
    '#azevent-hud .azevent-letter{',
    '  position:absolute; left:0; width:100%; height:7vh;',
    '  background:#000; opacity:0; transition:opacity 1.2s ease;',
    '}',
    '#azevent-hud .azevent-letter.azevent-on{opacity:1;}',
    '#azevent-hud .azevent-letter-top{top:0;}',
    '#azevent-hud .azevent-letter-bot{bottom:0;}',
    /* v17 : VIGNETTE DE BORD — halo coloré pulsé par JS (box-shadow
       inset), sous les pastilles mais au-dessus du jeu. */
    '#azevent-hud .azevent-edge{',
    '  position:absolute; inset:0; pointer-events:none; opacity:0;',
    '}',
    /* v20 : FLASH D'ÉCRAN — écran de couleur pleine 1 frame-synced (opacity
       pilotée par JS), au-dessus du jeu mais sous les pastilles/boutons.
       Pur DOM, pensé iPhone. */
    '#azevent-hud .azevent-flash{',
    '  position:absolute; inset:0; pointer-events:none; opacity:0;',
    '  background:#fff;',
    '}',
    /* Indicateur de phase : tout petit, en coin (bas-gauche).
       v12 : entrée franche — montée avec overshoot qui se pose ;
       sortie : léger retrait + fondu. */
    '@keyframes azevent-pillin{',
    '  0%{opacity:0; transform:translateY(12px) scale(.9);}',
    '  55%{opacity:1; transform:translateY(-3px) scale(1.04);}',
    '  80%{transform:translateY(1px) scale(.99);}',
    '  100%{opacity:1; transform:translateY(0) scale(1);}',
    '}',
    '#azevent-hud .azevent-phase{',
    '  position:absolute; left:14px; bottom:calc(7vh + 10px);',
    '  max-width:60vw; padding:3px 12px; border-radius:999px;',
    '  background:rgba(2,6,18,.5); border:1px solid rgba(140,200,255,.22);',
    '  font-size:11px; font-weight:600;',
    '  letter-spacing:0.22em; text-indent:0.22em;',
    '  color:rgba(225,240,250,.85);',
    '  text-shadow:0 0 8px rgba(120,200,255,.5);',
    '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
    '  opacity:0; transform:translateY(6px);',
    '  transition:opacity .3s ease, transform .3s ease;',
    '}',
    '#azevent-hud .azevent-phase.azevent-show{opacity:1; transform:none;',
    '  animation:azevent-pillin .45s cubic-bezier(.2,1.4,.35,1);}',
    /* v13 : phases CRITIQUES — la pastille bat (pulsation rouge) pendant
       qu'elle est visible (IMPACT IMMINENT, IMPACT FINAL, CONTRACTION...).
       v15 : la pulsation est pilotée en JS (update) et S'ACCÉLÈRE pendant
       les 2,5 s d'affichage — le CSS ne porte que les couleurs chaudes ;
       la box-shadow est modulée en ligne (transition douce). */
    '#azevent-hud .azevent-phase.azevent-hot{',
    '  color:#ffe2da; border-color:rgba(255,90,70,.45);',
    '  text-shadow:0 0 10px rgba(255,70,50,.7);',
    '  transition:box-shadow .12s linear;',
    '}',
    /* v15 : entrée des AVERTISSEMENTS — pop franc avec overshoot marqué
       (les phases critiques CLAQUENT). */
    '@keyframes azevent-pillwarn{',
    '  0%{opacity:0; transform:translateY(14px) scale(.72);}',
    '  50%{opacity:1; transform:translateY(-4px) scale(1.12);}',
    '  75%{transform:translateY(2px) scale(.98);}',
    '  100%{opacity:1; transform:translateY(0) scale(1);}',
    '}',
    '#azevent-hud .azevent-phase.azevent-hot.azevent-show{',
    '  animation:azevent-pillwarn .5s cubic-bezier(.2,1.5,.35,1);}',
    /* v15 : sortie rapide quand une pastille en chasse une autre
       (transition douce entre états : retrait + fondu, 0,15 s). */
    '#azevent-hud .azevent-phase.azevent-swapout{',
    '  opacity:0 !important; transform:translateY(8px) scale(.96) !important;',
    '  transition:opacity .15s ease, transform .15s ease;',
    '}',
    /* Bouton discret CINÉ/LIBRE (v10, bas-droite) : apparition en pop. */
    '@keyframes azevent-campop{',
    '  0%{opacity:0; transform:scale(.7);}',
    '  60%{opacity:1; transform:scale(1.08);}',
    '  100%{opacity:1; transform:scale(1);}',
    '}',
    /* Bouton discret CINÉ/LIBRE (v10, bas-droite) : apparition en fondu. */
    '#azevent-hud .azevent-cammode{',
    '  position:absolute; right:12px; bottom:calc(7vh + 10px);',
    '  padding:4px 12px; border-radius:999px;',
    '  background:rgba(2,6,18,.55); border:1px solid rgba(140,200,255,.25);',
    '  color:rgba(225,240,250,.9); font-size:11px; font-weight:600;',
    '  letter-spacing:0.14em; text-indent:0.14em;',
    '  pointer-events:auto; cursor:pointer;',
    '  opacity:0; transition:opacity .5s ease;',
    '}',
    '#azevent-hud .azevent-cammode.azevent-show{opacity:1;',
    '  animation:azevent-campop .4s cubic-bezier(.2,1.6,.4,1);}',
    /* Écran noir total à 'end' : aucun HUD, aucun texte. */
    '#azevent-hud .azevent-black{',
    '  position:absolute; inset:0; background:#000;',
    '  opacity:0; transition:opacity 1.5s ease;',
    '}',
    '#azevent-hud .azevent-black.azevent-on{opacity:1;}',
    /* v16 — PASTILLE D'ALERTE (télégraphes 'warn:*', event-player.js) :
       plus grande et plus chaude que la pastille de phase, jamais au centre
       (haut de l'écran), pulsation qui s'emballe ; disparaît seule après
       ~2,4 s. Elle PRÉVIENT, elle ne force jamais la caméra. */
    '@keyframes azevent-warnpulse{',
    '  0%,100%{transform:translateX(-50%) scale(1);}',
    '  50%{transform:translateX(-50%) scale(1.07);}',
    '}',
    '#azevent-hud .azevent-warn{',
    '  position:absolute; top:16%; left:50%; transform:translateX(-50%);',
    '  padding:8px 22px; border-radius:999px;',
    '  background:rgba(60,8,4,.72); border:2px solid rgba(255,120,60,.85);',
    '  font-size:15px; font-weight:800;',
    '  letter-spacing:0.18em; text-indent:0.18em;',
    '  color:#ffe9dc; text-shadow:0 0 12px rgba(255,90,40,.9);',
    '  white-space:nowrap; pointer-events:none;',
    '  opacity:0; transition:opacity .25s ease;',
    '}',
    '#azevent-hud .azevent-warn.azevent-show{',
    '  opacity:1; animation:azevent-warnpulse .5s ease-in-out infinite;',
    '}',
    /* v16 — FLÈCHE DE DIRECTION (« où regarder ») : pendant les phases clés,
       une flèche pulsante en bord d'écran pointe vers le prochain événement
       (fusée n°1, Point Zéro, météorite, trou noir...). Pure SUGGESTION : elle
       disparaît dès que le joueur regarde déjà la cible (cible au centre de
       l'écran) et ne touche jamais à sa caméra. */
    '@keyframes azevent-focuspulse{',
    '  0%,100%{opacity:.5;}',
    '  50%{opacity:1;}',
    '}',
    '#azevent-hud .azevent-focus{',
    '  position:absolute; width:0; height:0;',
    '  border-left:16px solid transparent;',
    '  border-right:16px solid transparent;',
    '  border-bottom:30px solid rgba(255,200,120,.95);',
    '  filter:drop-shadow(0 0 10px rgba(255,160,60,.8));',
    '  pointer-events:none;',
    '  opacity:0; transition:opacity .4s ease;',
    '}',
    '#azevent-hud .azevent-focus.azevent-on{',
    '  animation:azevent-focuspulse .8s ease-in-out infinite;',
    '}',
    /* v21 — mouvement réduit : les animations DOM du HUD sont coupées
       (l'information reste lisible, sans mouvement). */
    '@media (prefers-reduced-motion: reduce){',
    '  #azevent-hud .azevent-phase.azevent-show{animation:none !important;}',
    '  #azevent-hud .azevent-phase.azevent-hot.azevent-show{animation:none !important;}',
    '  #azevent-hud .azevent-cammode.azevent-show{animation:none !important;}',
    '  #azevent-hud .azevent-warn.azevent-show{animation:none !important;}',
    '  #azevent-hud .azevent-focus.azevent-on{animation:none !important;}',
    '}'
  ].join('\n');

  // Construit le DOM du HUD (appelé une fois à l'init).
  function buildDom() {
    var doc = root.document;
    if (!doc) return false;

    styleEl = doc.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);

    container = doc.createElement('div');
    container.id = CONTAINER_ID;

    // Letterbox cinéma.
    letterTop = doc.createElement('div');
    letterTop.className = 'azevent-letter azevent-letter-top';
    container.appendChild(letterTop);
    letterBot = doc.createElement('div');
    letterBot.className = 'azevent-letter azevent-letter-bot';
    container.appendChild(letterBot);

    // Tout petit indicateur de phase en coin.
    phaseEl = doc.createElement('div');
    phaseEl.className = 'azevent-phase';
    container.appendChild(phaseEl);

    // Écran noir total (phase 'end').
    blackEl = doc.createElement('div');
    blackEl.className = 'azevent-black';
    container.appendChild(blackEl);

    // v16 — pastille d'alerte (télégraphes 'warn:*' : ~2 s avant chaque
    // impulsion subie) + flèche de direction « où regarder ».
    warnEl = doc.createElement('div');
    warnEl.className = 'azevent-warn';
    container.appendChild(warnEl);
    focusEl = doc.createElement('div');
    focusEl.className = 'azevent-focus';
    container.appendChild(focusEl);

    // v17 — VIGNETTE DE BORD (sous les pastilles, au-dessus du jeu) :
    // insérée juste après les letterbox pour rester sous les pastilles.
    edgeEl = doc.createElement('div');
    edgeEl.className = 'azevent-edge';
    container.insertBefore(edgeEl, phaseEl);

    // v20 — FLASH D'ÉCRAN franc : inséré sous la vignette (sous les
    // pastilles et le bouton), déclenché sur les impacts majeurs.
    flashEl = doc.createElement('div');
    flashEl.className = 'azevent-flash';
    container.insertBefore(flashEl, edgeEl);

    // v10 : bouton discret CINÉ/LIBRE (bas-droite) — bascule la caméra du
    // directeur cinématique. Seul élément cliquable du HUD (pointer-events).
    camBtn = doc.createElement('button');
    camBtn.className = 'azevent-cammode';
    camBtn.type = 'button';
    camBtn.title = 'Basculer caméra cinématique / libre (touche C)';
    camBtn.addEventListener('click', function () {
      if (disposed || !root.AZEvent.active) return;
      var other = (camMode === 'cine') ? 'free' : 'cine';
      try { root.AZEvent.emit('camera:mode:set', { mode: other }); } catch (e) { /* ignore */ }
    });
    container.appendChild(camBtn);

    container.style.display = 'none'; // inactif tant que l'event ne tourne pas
    doc.body.appendChild(container);
    return true;
  }

  // Affiche la pastille immédiatement (pop d'entrée).
  function showPhaseNow(label, hot) {
    if (disposed || !phaseEl) return;
    phaseEl.textContent = label;
    phaseEl.classList.remove('azevent-show', 'azevent-hot', 'azevent-swapout');
    phaseEl.style.boxShadow = '';
    phaseEl.style.transform = '';
    void phaseEl.offsetWidth; // reflow : rejoue l'animation d'entrée
    if (hot) phaseEl.classList.add('azevent-hot');
    phaseEl.classList.add('azevent-show');
    pillActive = true;
    pillTimer = 0;
    pillHot = !!hot;
    pillHotT = 0;
  }

  // Affiche l'indicateur de phase 2,5 secondes. v12 : entrée franche
  // (montée + overshoot), re-déclenchée à chaque transition même si la
  // précédente est encore visible.
  // v13 : phases critiques -> pastille "chaude" qui pulse en rouge.
  // v15 : transition DOUCE entre états — si une pastille est visible, elle
  // se retire en 0,15 s (fondu + retrait) avant que la nouvelle claque :
  // jamais de coupure sèche entre deux états.
  var HOT_PHASES = ['strike', 'impact', 'contraction', 'collapse',
                    'destruction', 'playersucked', 'greatrift'];
  function showPhase(label, hot) {
    if (disposed || !phaseEl) return;
    if (pillActive && phaseEl.classList.contains('azevent-show')) {
      pillSwap = { label: label, hot: !!hot, t: 0 };
      phaseEl.classList.add('azevent-swapout');
      phaseEl.style.boxShadow = '';
      phaseEl.style.transform = '';
      return;
    }
    pillSwap = null;
    showPhaseNow(label, hot);
  }

  // v7 — ÉVÉNEMENT JOUABLE : le HUD normal du jeu n'est JAMAIS masqué
  // (le joueur joue : barres de vie, inventaire, minimap...). setGameHud
  // ne fait que restaurer d'éventuels éléments masqués (sécurité).
  var gameHudHidden = [];
  function setGameHud(hidden) {
    if (hidden) return; // v7 : on ne masque plus le HUD du jeu pendant l'event
    for (var j = 0; j < gameHudHidden.length; j++) {
      try { gameHudHidden[j].style.display = gameHudHidden[j].__azeventPrevDisplay || ''; } catch (e) {}
    }
    gameHudHidden = [];
  }

  // v16 — affiche la pastille d'alerte ~2,4 s (pop + pulsation), puis elle
  // disparaît seule. Ne force jamais la caméra : elle PRÉVIENT.
  function showWarn(label) {
    if (disposed || !warnEl) return;
    warnEl.textContent = label;
    warnEl.classList.remove('azevent-show');
    void warnEl.offsetWidth; // reflow : rejoue la pulsation
    warnEl.classList.add('azevent-show');
    warnVisible = true;
    warnTimer = 0;
  }
  function hideWarn() {
    warnVisible = false;
    warnTimer = 0;
    if (warnEl) warnEl.classList.remove('azevent-show');
  }

  // v16 — point du monde vers lequel la flèche doit pointer, selon la phase
  // (pure suggestion visuelle). null = pas de flèche (countdown, numbers,
  // end). Lecture DÉFENSIVE : tout peut manquer, jamais de throw.
  function focusTarget() {
    var A = root.AZEvent;
    if (!A) return null;
    var st = A.state;
    if (!st || st === 'countdown' || st === 'numbers' || st === 'end') return null;
    var anc = A.anchors || {};
    function anch(n) {
      var a = anc[n];
      return (a && typeof a.x === 'number' && typeof a.y === 'number' &&
              typeof a.z === 'number') ? a : null;
    }
    function riftPos() {
      var rs = A.rifts;
      if (rs && rs.length) {
        for (var i = 0; i < rs.length; i++) {
          if (rs[i] && rs[i].open && rs[i].pos &&
              typeof rs[i].pos.x === 'number') return rs[i].pos;
        }
        if (rs[0] && rs[0].pos && typeof rs[0].pos.x === 'number') return rs[0].pos;
      }
      return null;
    }
    function meteor() {
      var m = A.meteorPos; // event-meteor.js : Vector3 live
      return (m && typeof m.x === 'number') ? m : null;
    }
    function zero() {
      var c = (api && api.center) ? api.center : null;
      return (c && typeof c.x === 'number') ? c : null;
    }
    if (st === 'firstrocket') return anch('rocket1');
    if (st === 'sixrockets') return riftPos() || anch('rocket1');
    if (st === 'convergence' || st === 'loop' || st === 'acceleration') return meteor();
    if (st === 'silence' || st === 'strike' || st === 'thrown') return zero();
    if (st === 'greatrift') return riftPos() || meteor();
    if (st === 'meteorsix' || st === 'descent' || st === 'veeroff' ||
        st === 'impact') return meteor();
    if (st === 'contraction') return zero();
    if (st === 'collapse' || st === 'growth' || st === 'destruction' ||
        st === 'playersucked' || st === 'allgone' || st === 'blackhole') {
      return anch('blackhole') || zero();
    }
    return null;
  }

  // v16 — met à jour la flèche de direction : projette la cible sur l'écran
  // avec la caméra DU JOUEUR (jamais touchée). Si la cible est déjà au
  // centre de l'écran, la flèche disparaît (le joueur regarde déjà).
  // v21 : focusSt — la flèche prend la couleur de l'état courant.
  function updateFocus(focusSt) {
    if (!focusEl || disposed) return;
    var show = false;
    try {
      var tgt = focusTarget();
      var cam = (api && typeof api.camera === 'function') ? api.camera() : null;
      if (tgt && cam && cam.matrixWorldInverse) {
        if (!focusV) {
          var T = (api && api.T) || root.THREE;
          focusV = { t: new T.Vector3(), p: new T.Vector3(), c: new T.Vector3() };
        }
        focusV.t.set(tgt.x, tgt.y, tgt.z);
        // Derrière la caméra ? (espace caméra : z > 0 = derrière)
        focusV.c.copy(focusV.t).applyMatrix4(cam.matrixWorldInverse);
        var behind = focusV.c.z > 0;
        focusV.p.copy(focusV.t).project(cam);
        var nx = focusV.p.x, ny = focusV.p.y;
        if (behind) { nx = -nx; ny = -ny; } // miroir : pointe dans la vraie direction
        if (behind || Math.abs(nx) > 0.72 || Math.abs(ny) > 0.72) {
          var w = root.innerWidth || 800, h = root.innerHeight || 600;
          var sx = (nx * 0.5 + 0.5) * w, sy = (-ny * 0.5 + 0.5) * h;
          var m = 70; // marge de bord d'écran
          sx = Math.max(m, Math.min(w - m, sx));
          sy = Math.max(m, Math.min(h - m, sy));
          var ang = Math.atan2(sx - w / 2, -(sy - h / 2)) * 180 / Math.PI;
          focusEl.style.left = sx.toFixed(0) + 'px';
          focusEl.style.top = sy.toFixed(0) + 'px';
          focusEl.style.transform = 'translate(-50%,-50%) rotate(' + ang.toFixed(1) + 'deg)';
          show = true;
        }
      }
    } catch (e) { show = false; /* jamais bloquant */ }
    // v21 : la flèche prend la couleur de l'état — ROUGE sur les phases
    // destructrices (elle pointe un danger), ambre ailleurs. Appliqué
    // seulement au changement d'état (aucun style churn par frame).
    // v22 : teinte PAR PHASE — la flèche raconte où on en est : cyan le
    // jour du compte à rebours, rouge électrique sur les dangers, rouge
    // profond sur la descente, bleu profond sur le trou noir, blanc pâle
    // sur les nombres. Appliqué seulement au changement d'état.
    if (focusSt !== focusColor) {
      focusColor = focusSt;
      var fc = 'rgba(255,200,120,.95)', fg = 'drop-shadow(0 0 10px rgba(255,160,60,.8))'; // ambre : défaut
      if (focusSt === 'countdown' || focusSt === 'firstrocket' || focusSt === 'sixrockets') {
        fc = 'rgba(140,225,255,.95)'; fg = 'drop-shadow(0 0 10px rgba(90,200,255,.8))'; // cyan : le jour
      } else if (focusSt === 'strike' || focusSt === 'impact' || focusSt === 'contraction' ||
                 focusSt === 'destruction' || focusSt === 'playersucked') {
        fc = 'rgba(255,110,80,.95)'; fg = 'drop-shadow(0 0 10px rgba(255,60,40,.8))'; // rouge : danger
      } else if (focusSt === 'descent' || focusSt === 'veeroff') {
        fc = 'rgba(255,70,60,.95)'; fg = 'drop-shadow(0 0 10px rgba(255,40,30,.85))'; // rouge profond : la chute
      } else if (focusSt === 'collapse' || focusSt === 'growth' || focusSt === 'blackhole' ||
                 focusSt === 'allgone') {
        fc = 'rgba(130,180,255,.95)'; fg = 'drop-shadow(0 0 10px rgba(80,130,255,.8))'; // bleu profond : le trou noir
      } else if (focusSt === 'numbers') {
        fc = 'rgba(235,242,255,.95)'; fg = 'drop-shadow(0 0 10px rgba(200,220,255,.8))'; // blanc pâle : les nombres
      }
      try {
        focusEl.style.borderBottomColor = fc;
        focusEl.style.filter = fg;
      } catch (e2) { /* ignore */ }
    }
    if (show) focusEl.classList.add('azevent-on');
    else focusEl.classList.remove('azevent-on');
  }

  // v17 : VIGNETTE DE BORD — l'écran « respire » la couleur du danger :
  // rouge pulsant pendant la plongée de la météorite (s'accélère en
  // 'veeroff' : l'impact approche), flash blanc à l'impact, bleu
  // d'aspiration pendant collapse/growth, bleu sombre sur le trou noir.
  // Pur DOM : aucun coût 3D (pensé iPhone).
  function updateEdge(t, state) {
    if (!edgeEl) return;
    var col = null, amp = 0, speed = 0;
    if (state === 'strike') {
      col = '120,170,255'; amp = 0.35; speed = 5; // v22 : tension électrique aux bords
    } else if (state === 'silence') {
      col = '70,90,150'; amp = 0.12; speed = 1.2; // v22 : le calme respire à peine
    } else if (state === 'descent' || state === 'veeroff') {
      col = '255,60,40'; amp = 0.5; speed = (state === 'veeroff') ? 7 : 4;
    } else if (state === 'impact') {
      col = '255,240,220'; amp = 0.55; speed = 2.2;
    } else if (state === 'collapse' || state === 'growth') {
      col = '60,140,255'; amp = 0.45; speed = 3;
    } else if (state === 'destruction' || state === 'blackhole') {
      col = '40,90,200'; amp = 0.22; speed = 1.6;
    }
    // v22 : teinte d'alerte PONCTUELLE (ex : chaque nombre affiché, chaque
    // jalon du compte à rebours) — la vignette « accuse » l'événement
    // dans sa couleur, puis s'éteint seule.
    if (!col && edgeTint) { col = edgeTint; amp = 0.1; speed = 6; }
    // v20 — BOOST D'ONDE DE CHOC : à chaque 'shockwave' {force}, la vignette
    // S'ENFLAMME dans la couleur du moment (ou bleu-blanc si aucun état
    // coloré) — chaque temps fort tape visuellement aux bords de l'écran.
    // v23 : placé AVANT la sortie anticipée — la branche était inatteignable
    // (le `return` ci-dessous la tuait : le boost ne s'affichait jamais
    // hors des phases colorées).
    if (!col && edgeBoost > 0.02) { col = '150,190,255'; amp = 0; speed = 6; }
    if (!col) { edgeEl.style.opacity = '0'; return; }
    amp += edgeBoost * 0.8;
    var pulse = 0.55 + 0.45 * Math.sin(t * speed);
    var spread = 90 + 60 * pulse; // le halo s'étend et se rétracte
    edgeEl.style.boxShadow = 'inset 0 0 ' + spread.toFixed(0) + 'px rgba(' +
      col + ',' + (amp * pulse).toFixed(3) + ')';
    edgeEl.style.opacity = '1';
  }

  // v20 — FLASH D'ÉCRAN : flash franc 1 frame-synced sur les impacts
  // majeurs (explosion r >= 900, contact météorite, contact fusée). Montée
  // instantanée, retombée rapide (~0,25 s) — l'écran « claque ». Pur DOM.
  function flashScreen(color, dur) {
    if (!flashEl || disposed) return;
    flashEl.style.background = color;
    flashT = dur; flashDur = Math.max(0.05, dur);
  }
  function updateFlash(dt) {
    if (!flashEl) return;
    if (flashT > 0) {
      flashT -= dt;
      var k = Math.max(0, flashT / flashDur);
      flashEl.style.opacity = (k * k * 0.85).toFixed(3);
    } else if (flashEl.style.opacity !== '0') {
      flashEl.style.opacity = '0';
    }
  }

  // Passage à l'écran noir total : aucun HUD.
  function enterEnd() {
    if (blackEl) blackEl.classList.add('azevent-on');
    if (letterTop) letterTop.classList.remove('azevent-on');
    if (letterBot) letterBot.classList.remove('azevent-on');
    if (phaseEl) {
      phaseEl.classList.remove('azevent-show', 'azevent-swapout');
      phaseEl.style.boxShadow = '';
      phaseEl.style.transform = '';
    }
    if (camBtn) camBtn.classList.remove('azevent-show'); // v10 : rien à 'end'
    hideWarn(); // v16 : aucune alerte à 'end'
    if (focusEl) focusEl.classList.remove('azevent-on'); // v16 : pas de flèche à 'end'
    pillActive = false;
    pillTimer = 0;
    pillHot = false;   // v15
    pillHotT = 0;      // v15
    pillSwap = null;   // v15 : une pastille en attente ne doit pas réapparaître
    // v23 : un flash d'écran ou une teinte de vignette en cours ne doit
    // jamais rester figé sur le noir final — update() ne tourne plus ici
    // (retour anticipé sur 'end'), donc on les éteint explicitement.
    flashT = 0;
    if (flashEl) flashEl.style.opacity = '0';
    edgeBoost = 0;
    edgeTint = null; edgeTintT = 0;
  }

  // v10 : libellé du bouton selon le mode courant du directeur.
  function updateCamLabel() {
    if (!camBtn) return;
    camBtn.textContent = (camMode === 'cine') ? '🎬 CINÉ' : '🕹 LIBRE';
  }

  var mod = {
    init: function (a) {
      api = a;
      disposed = false;
      if (!buildDom()) return;

      // v23 : le bus n'expose pas de off() — brancher à chaque init()
      // dupliquerait les ~30 écouteurs à chaque redémarrage (les anciens
      // restaient actifs via l'état module partagé). Branché une seule fois.
      if (!busBound) {
      busBound = true;

      // Indicateurs de phase discrets (en coin) sur chaque transition.
      Object.keys(PHASE_LABELS).forEach(function (phase) {
        api.on('phase:' + phase, function () {
          if (!root.AZEvent.active || disposed) return;
          showPhase(PHASE_LABELS[phase], HOT_PHASES.indexOf(phase) >= 0);
        });
      });

      // 'end' : écran noir total, aucun HUD.
      api.on('phase:end', function () {
        if (!root.AZEvent.active || disposed) return;
        enterEnd();
      });

      // v16 — télégraphes d'avertissement (event-player.js) : ~2 s avant
      // chaque impulsion subie, la pastille d'alerte claque en haut de
      // l'écran. Les écouteurs deviennent inertes via 'disposed'.
      // v21 : chaque alerte fait aussi réagir la VIGNETTE « couleur du
      // danger » (boost de pulsation aux bords) + un flash AMBRÉ bref —
      // l'alerte se LIT partout sur l'écran, sans forcer la caméra.
      Object.keys(WARN_LABELS).forEach(function (evt) {
        api.on(evt, function () {
          if (!root.AZEvent.active || disposed) return;
          showWarn(WARN_LABELS[evt]);
          try {
            edgeBoost = Math.max(edgeBoost, 0.55);
            flashScreen('rgba(255,150,70,0.55)', 0.18);
          } catch (e) { /* jamais bloquant */ }
        });
      });

      // v10 : bascule caméra CINÉ/LIBRE — le directeur (event-cinedir.js)
      // est la source de vérité, le HUD ne fait que refléter 'camera:mode'.
      // Branché une seule fois (garde busBound, ci-dessus).
      api.on('camera:mode', function (d) {
        if (disposed) return;
        if (d && (d.mode === 'cine' || d.mode === 'free')) camMode = d.mode;
        updateCamLabel();
      });

      // v20 — FLASH D'ÉCRAN sur les impacts majeurs + sursaut de la vignette
      // « couleur du danger » sur chaque onde de choc. Les écouteurs
      // deviennent inertes via 'disposed'.
      api.on('shockwave:burst', function (d) {
        if (!root.AZEvent.active || disposed) return;
        var r = (d && d.opts && typeof d.opts.radius === 'number') ? d.opts.radius : 0;
        if (r >= 900) flashScreen('#ffffff', 0.28); // explosion majeure : l'écran claque
      });
      api.on('shockwave', function (d) {
        if (!root.AZEvent.active || disposed) return;
        var f = (d && typeof d.force === 'number') ? d.force : 0.5;
        edgeBoost = Math.max(edgeBoost, Math.min(1, f)); // la vignette s'enflamme
      });
      api.on('meteor:hit', function () {
        if (!root.AZEvent.active || disposed) return;
        flashScreen('#eaf2ff', 0.35); // contact météorite/Point Zéro
      });
      api.on('rocket:impact', function () {
        if (!root.AZEvent.active || disposed) return;
        flashScreen('#ffe8cf', 0.28); // contact fusée/Point Zéro
      });
      // v22 : chaque nombre affiché fait réagir la VIGNETTE — pouls blanc
      // froid aux bords de l'écran (le cosmos accuse le coup, un par un).
      api.on('number:show', function () {
        if (!root.AZEvent.active || disposed) return;
        edgeTint = '200,220,255';
        edgeTintT = 0.5;
        edgeBoost = Math.max(edgeBoost, 0.5);
      });
      // v22 : aux jalons du compte à rebours, la vignette respire en cyan
      // (le temps bat aussi aux bords de l'écran).
      api.on('countdown:milestone', function () {
        if (!root.AZEvent.active || disposed) return;
        edgeTint = '120,220,255';
        edgeTintT = 0.4;
        edgeBoost = Math.max(edgeBoost, 0.3);
      });
      } // v23 : fin du branchement unique des écouteurs du bus

      // v10 : le libellé du bouton CINÉ/LIBRE se resynchronise à chaque
      // init (hors garde : le mode a pu changer entre deux passages).
      try {
        if (typeof root.AZEvent.cineMode === 'function') camMode = root.AZEvent.cineMode();
      } catch (e) { /* ignore */ }
      updateCamLabel();
    },

    update: function (dt, t) {
      if (!container || disposed) return;

      // Inactif hors event : le conteneur reste masqué, le HUD du jeu n'est pas touché.
      if (!root.AZEvent.active) {
        if (container.style.display !== 'none') container.style.display = 'none';
        setGameHud(false);
        return;
      }
      if (container.style.display === 'none') container.style.display = '';
      // Cinématique : le HUD normal du jeu est masqué.
      setGameHud(true);

      var state = root.AZEvent.state;

      // 'end' : écran noir total, rien d'autre.
      if (state === 'end') {
        enterEnd();
        return;
      }
      if (blackEl && blackEl.classList.contains('azevent-on')) {
        blackEl.classList.remove('azevent-on');
      }

      // v10 : bouton CINÉ/LIBRE visible en fondu pendant l'event,
      // masqué à 'end' (noir total, aucun bandeau/titre/bouton).
      if (camBtn) {
        if (state === 'end') camBtn.classList.remove('azevent-show');
        else camBtn.classList.add('azevent-show');
      }

      // v7 : pas de letterbox cinéma (ce n'est plus une cinématique).
      if (letterTop && letterTop.classList.contains('azevent-on')) {
        letterTop.classList.remove('azevent-on');
        letterBot.classList.remove('azevent-on');
      }

      // Fin de l'indicateur de phase après 2,5 secondes (fondu de sortie CSS).
      // v15 : une pastille en chasse une autre — retrait rapide (0,15 s)
      // puis pop de la nouvelle ; pulsation des phases critiques qui
      // S'ACCÉLÈRE (période 1,15 s → 0,35 s sur la durée d'affichage).
      if (pillSwap) {
        pillSwap.t += dt;
        if (pillSwap.t >= 0.16) {
          var sw = pillSwap;
          pillSwap = null;
          showPhaseNow(sw.label, sw.hot);
        }
      } else if (pillActive) {
        pillTimer += dt;
        if (pillHot && phaseEl) {
          pillHotT += dt;
          var hk = Math.min(1, pillHotT / PILL_DURATION);
          var hperiod = 1.15 - 0.80 * hk; // la pulsation s'accélère
          var hph = (pillHotT / hperiod) * Math.PI * 2;
          var hbeat = Math.pow((Math.sin(hph - Math.PI / 2) + 1) / 2, 1.6);
          phaseEl.style.boxShadow = '0 0 ' + (6 + 16 * hbeat).toFixed(1) +
            'px rgba(255,' + Math.round(80 - 20 * hbeat) + ',60,' +
            (0.25 + 0.55 * hbeat).toFixed(2) + ')';
          phaseEl.style.transform = 'scale(' + (1 + 0.045 * hbeat).toFixed(3) + ')';
        }
        if (pillTimer >= PILL_DURATION) {
          pillActive = false;
          pillTimer = 0;
          pillHot = false;
          pillHotT = 0;
          phaseEl.classList.remove('azevent-show');
          phaseEl.style.boxShadow = '';
          phaseEl.style.transform = '';
        }
      }

      // v16 — la pastille d'alerte disparaît seule après ~2,4 s.
      if (warnVisible) {
        warnTimer += dt;
        if (warnTimer >= WARN_DURATION) hideWarn();
      }

      // v16 — flèche de direction « où regarder » (suggestion, jamais de
      // prise de contrôle de la caméra).
      // v21 : l'état courant teinte la flèche (rouge sur les phases
      // destructrices).
      updateFocus(state);

      // v17 — vignette de bord (couleur du danger).
      // v20 — le boost d'onde de choc retombe, le flash d'écran aussi.
      edgeBoost = Math.max(0, edgeBoost - dt * 1.6);
      if (edgeTintT > 0) { // v22 : la teinte ponctuelle s'éteint seule
        edgeTintT -= dt;
        if (edgeTintT <= 0) { edgeTintT = 0; edgeTint = null; }
      }
      updateEdge(t, state);
      updateFlash(dt);
    },

    dispose: function () {
      disposed = true;
      // Restaure le HUD normal du jeu.
      setGameHud(false);
      // Les écouteurs du bus deviennent inertes via le drapeau 'disposed'.
      if (container && container.parentNode) {
        try { container.parentNode.removeChild(container); } catch (e) { /* déjà retiré */ }
      }
      if (styleEl && styleEl.parentNode) {
        try { styleEl.parentNode.removeChild(styleEl); } catch (e) { /* déjà retiré */ }
      }
      container = null;
      styleEl = null;
      letterTop = null;
      letterBot = null;
      phaseEl = null;
      blackEl = null;
      camBtn = null; // v10
      pillActive = false;
      pillHot = false; pillHotT = 0; pillSwap = null; // v15
      warnEl = null; focusEl = null; // v16
      warnVisible = false; warnTimer = 0; focusV = null; // v16
      edgeEl = null; // v17
      flashEl = null; flashT = 0; edgeBoost = 0; // v20
      edgeTint = null; edgeTintT = 0; // v22
      api = null;
    }
  };

  root.AZEvent.register('hud', mod);
})(window);
