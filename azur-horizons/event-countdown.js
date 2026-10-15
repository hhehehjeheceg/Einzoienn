/* event-countdown.js — module "THE END" : compte à rebours discret + triangle
   d'avertissement.
   - Pendant la phase 'countdown' (timeline [0,60], bornes lues depuis
     AZEvent.TIMELINE, jamais en dur) : affiche un PETIT compte à rebours
     élégant en haut de l'écran (pastille discrète, pas de minuteur géant).
     Chaque seconde : émission 'countdown:tick' {remaining, pitch} — le pitch
     monte à mesure que zéro approche. Le son est joué par event-audio.js
     (seule autorité sonore, aucun AudioContext local ici).
   - À la FIN du compte à rebours (transition vers 'firstrocket') : émission
     'countdown:alarm' (jouée par event-audio.js), puis affichage d'un
     TRIANGLE ROUGE avec « ! » pendant ~2,5 s (entrée franche : anticipation
     + overshoot, sortie en retrait + fondu, JAMAIS clignotant), accompagné
     d'un flash rouge bref sur les bords de l'écran, puis il disparaît.
     Ensuite : plus aucun texte.
   - v12 : chaque seconde du minuteur "claque" (pop avec overshoot) et les
     3 dernières secondes passent en rouge (urgence visuelle).
   - v14 : le compte à rebours dure 60 s — l'affichage passe au format M:SS
     (« 1:00 » → « 0:01 »), élégant pour une minute entière. Le lancement de
     la fusée n°1 reste immédiat à zéro via 'countdown:alarm' + la transition
     vers 'firstrocket' (aucune durée codée en dur).
   - v15 : anticipation montante — les ticks s'intensifient à mesure que zéro
     approche (halo de la pastille qui grandit avec la tension, secousse
     légère de la pastille les 10 dernières secondes, pitch qui grimpe ENCORE
     plus vite sur la fin), le ciel s'assombrit PROGRESSIVEMENT pendant la
     minute (voile sombre subtil propre au module, opacity 0 -> 0.34 ;
     event-sky.js lit déjà 'countdown:tick' et suit tickRemaining).
     'countdown:tick' est enrichi d'un champ 'urgency' (0..1, compatible avec
     les écouteurs existants). Triangle + 'countdown:alarm' + transition
     immédiate vers firstrocket INCHANGÉS. Marqueur 'T-1:00' et format M:SS
     conservés.
   - v22 : JALONS — 'countdown:milestone' émis à T-0:45 / T-0:15 / T-0:10
     (T-0:30 = gong 'countdown:half', acquis) : la pastille claque PLUS FORT
     (pop dédié) et un ANNEAU DE TIC pulse à chaque seconde (le temps « bat »
     autour de la pastille). prefers-reduced-motion respecté (animations
     coupées, information lisible).
   - Piloté par AZEvent.state / AZEvent.tTotal et les événements bus
     'phase:countdown' / 'phase:firstrocket'. Inactif quand !AZEvent.active.
   IIFE 'use strict', aucun import, aucun appel réseau. dispose() retire tout
   le DOM ajouté par le module.
*/
(function (root) {
  'use strict';
  if (!root.AZEvent) return;

  var CONTAINER_ID = 'azevent-countdown';
  var STYLE_ID = 'azevent-countdown-style';

  var WARN_HOLD = 2.5;        // durée d'affichage du triangle (secondes, relative)
  var TICK_BASE_PITCH = 700;  // Hz au début du compte à rebours
  var TICK_TOP_PITCH = 1400;  // Hz à zéro (pitch montant)

  var api = null;
  var container = null;
  var styleEl = null;
  var timerEl = null;
  var textEl = null;     // v21 : texte du minuteur (span — la barre est un enfant)
  var duskEl = null;      // v15 : voile d'assombrissement progressif du ciel
  var warnEl = null;
  var barFill = null;    // v21 : remplissage de la barre de progression
  var ringEl = null;      // v22 : anneau de tic (le temps « bat »)
  var milesFired = {};    // v22 : jalons déjà émis pour ce passage
  var lastWhole = -1;     // pour n'émettre qu'un tick par seconde
  var warned = false;     // triangle déjà déclenché pour ce passage
  var halfFired = false;  // v21 : 'countdown:half' émis une seule fois par passage
  var warnT = 0;          // temps restant d'affichage du triangle
  var warnLeaving = false;// sortie du triangle en cours (retrait + fondu)
  var warnLeaveT = 0;     // temps restant avant masquage définitif
  var alarmFired = false; // 'countdown:alarm' émis une seule fois par passage
  var disposed = false;
  var busBound = false;  // v23 : écouteurs du bus branchés une seule fois (pas de off())

  // CSS injecté : polices système uniquement, aucun réseau.
  var CSS = [
    '#azevent-countdown{',
    '  position:fixed; inset:0; z-index:2147482999;',
    '  pointer-events:none;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
    '  user-select:none; -webkit-user-select:none;',
    '}',
    '#azevent-countdown .azevent-hidden{display:none !important;}',
    /* Petit compte à rebours discret : pastille fine en haut, jamais géante. */
    '#azevent-countdown .azevent-cd-timer{',
    '  position:absolute; top:12px; left:50%; transform:translateX(-50%);',
    '  padding:4px 16px; border-radius:999px;',
    '  background:rgba(2,10,20,.45); border:1px solid rgba(130,220,255,.28);',
    '  font-size:clamp(12px,1.6vw,19px); font-weight:600;',
    '  letter-spacing:0.28em; text-indent:0.28em;',
    '  color:rgba(190,242,255,.92);',
    '  text-shadow:0 0 10px rgba(90,200,255,.55);',
    '  white-space:nowrap;',
    '}',
    /* v12 — chaque seconde "claque" : pop franc avec overshoot (re-déclenché
       en JS à chaque tick). Les 3 dernières secondes passent en rouge. */
    '@keyframes azevent-cd-tickpop{',
    '  0%{transform:translateX(-50%) scale(1);}',
    '  35%{transform:translateX(-50%) scale(1.24);}',
    '  70%{transform:translateX(-50%) scale(0.96);}',
    '  100%{transform:translateX(-50%) scale(1);}',
    '}',
    '#azevent-countdown .azevent-cd-timer.azevent-tick-pop{',
    '  animation:azevent-cd-tickpop .3s cubic-bezier(.2,1.4,.4,1);',
    '}',
    /* v13 — les 3 dernières secondes "claquent" PLUS FORT : pop plus large
       (1.42) qui se pose à 1.02 (urgence maximale avant zéro). */
    '@keyframes azevent-cd-tickpop-hot{',
    '  0%{transform:translateX(-50%) scale(1);}',
    '  30%{transform:translateX(-50%) scale(1.42);}',
    '  60%{transform:translateX(-50%) scale(0.94);}',
    '  100%{transform:translateX(-50%) scale(1.02);}',
    '}',
    '#azevent-countdown .azevent-cd-timer.azevent-tick-pop-hot{',
    '  animation:azevent-cd-tickpop-hot .36s cubic-bezier(.2,1.3,.3,1);',
    '}',
    '#azevent-countdown .azevent-cd-timer.azevent-urgent{',
    '  color:#ffd9d2; border-color:rgba(255,90,70,.55);',
    '  text-shadow:0 0 14px rgba(255,70,50,.85);',
    '  background:rgba(40,6,4,.55);',
    '}',
    /* v21 — BARRE DE PROGRESSION : le temps qui reste se lit sous la
       pastille (cyan -> rouge à mesure que l'urgence monte). Mise à jour
       une fois par seconde (tick), jamais par frame. */
    '#azevent-countdown .azevent-cd-bar{',
    '  position:absolute; left:14px; right:14px; bottom:-6px; height:3px;',
    '  border-radius:2px; background:rgba(120,200,255,.16); overflow:hidden;',
    '}',
    '#azevent-countdown .azevent-cd-bar i{',
    '  display:block; height:100%; width:100%; border-radius:2px;',
    '  background:linear-gradient(90deg,#37c8ff,#7fe8ff);',
    '  transition:width .3s linear;',
    '}',
    /* v21 — MI-PARCOURS (T-0:30) : la pastille claque plus fort que les
       ticks normaux (le gong sonore est joué par event-audio.js). */
    '@keyframes azevent-cd-halfpop{',
    '  0%{transform:translateX(-50%) scale(1);}',
    '  35%{transform:translateX(-50%) scale(1.35);}',
    '  70%{transform:translateX(-50%) scale(.97);}',
    '  100%{transform:translateX(-50%) scale(1);}',
    '}',
    '#azevent-countdown .azevent-cd-timer.azevent-half-pop{',
    '  animation:azevent-cd-halfpop .45s cubic-bezier(.2,1.4,.35,1);',
    '}',
    /* v22 — ANNEAU DE TIC : à chaque seconde, un anneau cyan s'étend autour
       de la pastille (le temps « bat » ; re-déclenché en JS à chaque tick). */
    '#azevent-countdown .azevent-cd-ring{',
    '  position:absolute; top:12px; left:50%; width:110px; height:30px;',
    '  transform:translateX(-50%); border-radius:999px;',
    '  border:2px solid rgba(120,220,255,0); pointer-events:none;',
    '}',
    '@keyframes azevent-cd-ringpulse{',
    '  0%{opacity:.85; transform:translateX(-50%) scale(.7); border-color:rgba(120,220,255,.8);}',
    '  100%{opacity:0; transform:translateX(-50%) scale(1.55); border-color:rgba(120,220,255,0);}',
    '}',
    '#azevent-countdown .azevent-cd-ring.azevent-ring-pop{',
    '  animation:azevent-cd-ringpulse .6s ease-out;',
    '}',
    /* v22 — JALON : aux quarts de la minute, la pastille claque PLUS FORT
       (elle marque le temps ; aucun texte ajouté). */
    '@keyframes azevent-cd-milepop{',
    '  0%{transform:translateX(-50%) scale(1);}',
    '  30%{transform:translateX(-50%) scale(1.5);}',
    '  62%{transform:translateX(-50%) scale(.95);}',
    '  100%{transform:translateX(-50%) scale(1.04);}',
    '}',
    '#azevent-countdown .azevent-cd-timer.azevent-mile-pop{',
    '  animation:azevent-cd-milepop .5s cubic-bezier(.2,1.3,.3,1);}',
    '}',
    /* v21 — mouvement réduit : les animations DOM du minuteur sont coupées
       (l'information reste lisible, sans mouvement). */
    '@media (prefers-reduced-motion: reduce){',
    '  #azevent-countdown .azevent-cd-timer.azevent-tick-pop,',
    '  #azevent-countdown .azevent-cd-timer.azevent-tick-pop-hot,',
    '  #azevent-countdown .azevent-cd-timer.azevent-half-pop,',
    '  #azevent-countdown .azevent-cd-timer.azevent-mile-pop,',
    '  #azevent-countdown .azevent-cd-ring.azevent-ring-pop,',
    '  #azevent-countdown .azevent-cd-warn.azevent-on{animation:none !important;}',
    '  #azevent-countdown .azevent-cd-alarmflash{animation-duration:.01s !important;}',
    '}',
    /* Triangle d'avertissement rouge avec « ! » : centré, taille modeste,
       JAMAIS clignotant. v12 : entrée franche — anticipation (resserrement)
       puis overshoot qui se pose ; sortie en retrait + fondu. */
    '@keyframes azevent-cd-warnin{',
    '  0%{opacity:0; transform:translate(-50%,-50%) scale(.55);}',
    '  55%{opacity:1; transform:translate(-50%,-50%) scale(1.08);}',
    '  78%{transform:translate(-50%,-50%) scale(.97);}',
    '  100%{opacity:1; transform:translate(-50%,-50%) scale(1);}',
    '}',
    '#azevent-countdown .azevent-cd-warn{',
    '  position:absolute; top:34%; left:50%; transform:translate(-50%,-50%);',
    '  width:0; height:0;',
    '  border-left:44px solid transparent;',
    '  border-right:44px solid transparent;',
    '  border-bottom:76px solid #d61f12;',
    '  filter:drop-shadow(0 0 18px rgba(230,50,30,.75));',
    '  opacity:0; transition:opacity .35s ease, transform .35s ease;',
    '}',
    '#azevent-countdown .azevent-cd-warn.azevent-leave{',
    '  opacity:0 !important; transform:translate(-50%,-50%) scale(.72);',
    '}',
    '#azevent-countdown .azevent-cd-warn .azevent-cd-mark{',
    '  position:absolute; top:30px; left:-14px; width:28px; text-align:center;',
    '  font-size:44px; font-weight:900; line-height:1; color:#fff;',
    '}',
    '#azevent-countdown .azevent-cd-warn.azevent-on{opacity:1;',
    '  animation:azevent-cd-warnin .5s cubic-bezier(.2,1.4,.35,1);}',
    /* v12 — flash rouge bref sur les bords de l'écran au moment de l'alarme
       (un seul passage, fondu rapide ; aucun texte ajouté). */
    '@keyframes azevent-cd-alarmflash{',
    '  0%{opacity:.55;}',
    '  100%{opacity:0;}',
    '}',
    '#azevent-countdown .azevent-cd-alarmflash{',
    '  position:absolute; inset:0; pointer-events:none;',
    '  background:radial-gradient(ellipse at center, rgba(255,40,20,0) 55%,',
    '    rgba(255,45,25,.5) 100%);',
    '  animation:azevent-cd-alarmflash .55s ease-out forwards;',
    '}',
    /* v15 — voile d'assombrissement PROGRESSIF du ciel pendant la minute
       (opacity pilotée en JS : 0 -> 0.34). Subtil et propre au module :
       event-sky.js lit déjà 'countdown:tick' (tickRemaining) en parallèle. */
    '#azevent-countdown .azevent-cd-dusk{',
    '  position:absolute; inset:0; pointer-events:none;',
    '  background:rgba(2,6,18,1); opacity:0;',
    '}'
  ].join('\n');

  // Borne de fin de la phase countdown, lue depuis la timeline officielle
  // (contrat : [0,60] en v14 ; repli 60 si la timeline est indisponible).
  function countdownEnd() {
    try {
      var tl = root.AZEvent.TIMELINE;
      if (tl && tl.countdown && typeof tl.countdown[1] === 'number') return tl.countdown[1];
    } catch (e) { /* repli */ }
    return 60;
  }

  // Construit le DOM du module (appelé une fois à l'init).
  function buildDom() {
    var doc = root.document;
    if (!doc) return false;

    styleEl = doc.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);

    container = doc.createElement('div');
    container.id = CONTAINER_ID;

    // v15 : voile sombre subtil (derrière le minuteur) pour l'assombrissement
    // progressif du ciel pendant la minute.
    duskEl = doc.createElement('div');
    duskEl.className = 'azevent-cd-dusk';
    container.appendChild(duskEl);

    // v22 : anneau de tic (pulse à chaque seconde, derrière la pastille).
    ringEl = doc.createElement('div');
    ringEl.className = 'azevent-cd-ring';
    container.appendChild(ringEl);

    timerEl = doc.createElement('div');
    timerEl.className = 'azevent-cd-timer azevent-hidden';
    // v21 : le texte vit dans un span (la barre de progression est un
    // enfant de la pastille : textContent sur le parent l'écraserait).
    textEl = doc.createElement('span');
    textEl.textContent = 'T-1:00'; // v14 : format M:SS pour 60 s
    timerEl.appendChild(textEl);
    // v21 : barre de progression sous la pastille (le temps qui reste).
    var bar = doc.createElement('div');
    bar.className = 'azevent-cd-bar';
    barFill = doc.createElement('i');
    bar.appendChild(barFill);
    timerEl.appendChild(bar);
    container.appendChild(timerEl);

    warnEl = doc.createElement('div');
    warnEl.className = 'azevent-cd-warn azevent-hidden';
    var mark = doc.createElement('div');
    mark.className = 'azevent-cd-mark';
    mark.textContent = '!';
    warnEl.appendChild(mark);
    container.appendChild(warnEl);

    container.style.display = 'none'; // inactif tant que l'event ne tourne pas
    doc.body.appendChild(container);
    return true;
  }

  // Fin du compte à rebours : alarme (bus, jouée par event-audio.js) puis
  // triangle rouge pendant ~2,5 s. v12 : entrée franche (anticipation +
  // overshoot) + flash rouge bref sur les bords de l'écran.
  function startWarn() {
    if (warned || disposed) return;
    warned = true;
    warnT = WARN_HOLD;
    warnLeaving = false;
    if (timerEl) {
      timerEl.classList.add('azevent-hidden');
      timerEl.classList.remove('azevent-tick-pop', 'azevent-tick-pop-hot', 'azevent-half-pop', 'azevent-mile-pop', 'azevent-urgent'); // v22 : + mile-pop
    }
    clearTense(); // v15 : nettoie halo/vibration/voile de l'anticipation
    if (warnEl) {
      warnEl.classList.remove('azevent-hidden', 'azevent-leave');
      // Forcer le reflow pour que l'animation d'entrée se rejoue.
      void warnEl.offsetWidth;
      warnEl.classList.add('azevent-on');
    }
    // Flash rouge bref sur les bords (un seul passage, auto-retiré).
    if (container) {
      var fl = root.document.createElement('div');
      fl.className = 'azevent-cd-alarmflash';
      container.appendChild(fl);
      setTimeout(function () {
        if (fl.parentNode) fl.parentNode.removeChild(fl);
      }, 700);
    }
    // L'alarme sonore est jouée par event-audio.js (seule autorité sonore).
    if (!alarmFired) {
      alarmFired = true;
      try { root.AZEvent.emit('countdown:alarm', { atZero: true }); } catch (e) { /* bus indisponible */ }
    }
  }

  // Le triangle se retire : retrait + fondu, puis masquage définitif.
  function hideWarn() {
    if (!warnEl) return;
    warnLeaving = true;
    warnLeaveT = 0.35;
    warnEl.classList.add('azevent-leave');
    warnEl.classList.remove('azevent-on');
  }

  // Réarmement si l'event redémarre (nouveau passage en 'countdown').
  function resetCycle() {
    warned = false;
    halfFired = false; // v21 : le gong de mi-parcours se rejoue au redémarrage
    milesFired = {};   // v22 : les jalons se rejouent au redémarrage
    warnT = 0;
    warnLeaving = false;
    warnLeaveT = 0;
    alarmFired = false;
    lastWhole = -1;
    clearTense(); // v15 : nettoie halo/vibration/voile
    if (warnEl) {
      warnEl.classList.remove('azevent-on', 'azevent-leave');
      warnEl.classList.add('azevent-hidden');
    }
    if (timerEl) {
      timerEl.classList.add('azevent-hidden');
      timerEl.classList.remove('azevent-tick-pop', 'azevent-tick-pop-hot', 'azevent-half-pop', 'azevent-mile-pop', 'azevent-urgent'); // v22 : + mile-pop
    }
  }

  // v15 — nettoie les intensifications visuelles de fin de compte à rebours
  // (halo inline, vibration, voile sombre). Ne retire rien d'autre.
  function clearTense() {
    if (timerEl) {
      timerEl.style.boxShadow = '';
      timerEl.style.marginLeft = '';
    }
    if (duskEl) duskEl.style.opacity = '0';
  }

  function init(a) {
    api = a;
    disposed = false;
    if (!buildDom()) return;
    // v23 : le bus n'expose pas de off() — brancher à chaque init()
    // dupliquerait les écouteurs à chaque redémarrage (les anciens restaient
    // actifs via l'état module partagé). Branché une seule fois.
    if (busBound) return;
    busBound = true;
    // À zéro (entrée en 'firstrocket') : triangle d'avertissement.
    api.on('phase:firstrocket', function () {
      if (disposed || !root.AZEvent.active) return;
      startWarn();
    });
    // Réarmement à chaque (re)démarrage du compte à rebours.
    api.on('phase:countdown', function () {
      if (disposed) return;
      resetCycle();
    });
  }

  function update(dt, t) {
    if (!container || disposed) return;

    // Inactif hors event : tout est masqué.
    if (!root.AZEvent.active) {
      if (container.style.display !== 'none') container.style.display = 'none';
      return;
    }
    if (container.style.display === 'none') container.style.display = '';

    var state = root.AZEvent.state;

    // Phase countdown : petit minuteur discret + tic-tac au pitch montant.
    if (state === 'countdown') {
      var total = countdownEnd();
      var remaining = Math.max(0, total - t);
      if (timerEl) {
        timerEl.classList.remove('azevent-hidden');
        var whole = Math.ceil(remaining);
        // v14 : affichage élégant M:SS (« 1:00 » → « 0:01 ») pour 60 s.
        var mins = Math.floor(whole / 60);
        var secs = whole % 60;
        var txt = 'T-' + mins + ':' + (secs < 10 ? '0' : '') + secs;
        // v21 : le texte vit dans un span (la barre de progression est un
        // enfant de la pastille — textContent sur le parent l'écraserait).
        if (textEl && textEl.textContent !== txt) textEl.textContent = txt;
        if (whole !== lastWhole) {
          var prevWhole = lastWhole; // v23 : seuils par CROISEMENT (voir ci-dessous)
          lastWhole = whole;
          // v12 : chaque seconde "claque" — pop avec overshoot (re-déclenché),
          // et les 3 dernières secondes passent en rouge.
          // v13 : les 3 dernières secondes claquent PLUS FORT (pop élargi).
          // v21 : à MI-PARCOURS (T-0:30), la pastille claque PLUS FORT que
          // les ticks normaux et 'countdown:half' est émis (gong sonore
          // joué par event-audio.js) — la minute « bascule ».
          // v22 : JALONS — à T-0:45 / T-0:15 / T-0:10, la pastille claque
          // PLUS FORT (pop dédié) et 'countdown:milestone' est émis
          // (tension sonore montante jouée par event-audio.js) : chaque
          // quart de minute PÈSE.
          // v23 : les seuils sont détectés par CROISEMENT descendant, pas par
          // égalité stricte — si une frame saute une seconde (à-coup iPhone),
          // le jalon/gong part quand même au lieu d'être manqué à jamais.
          var crossMile = (prevWhole > 45 && whole <= 45) ? 45 :
                          ((prevWhole > 15 && whole <= 15) ? 15 :
                          ((prevWhole > 10 && whole <= 10) ? 10 : 0));
          var isMile = (whole === 45 || whole === 15 || whole === 10) || crossMile > 0;
          if (crossMile > 0 && !milesFired[crossMile]) {
            milesFired[crossMile] = true;
            try { root.AZEvent.emit('countdown:milestone', { remaining: crossMile }); } catch (e) { /* bus indisponible */ }
          }
          if (remaining <= 3) timerEl.classList.add('azevent-urgent');
          timerEl.classList.remove('azevent-tick-pop', 'azevent-tick-pop-hot', 'azevent-half-pop', 'azevent-mile-pop');
          void timerEl.offsetWidth; // reflow : rejoue l'animation
          if ((whole === 30 || (prevWhole > 30 && whole <= 30)) && !halfFired) {
            halfFired = true;
            timerEl.classList.add('azevent-half-pop');
            try { root.AZEvent.emit('countdown:half', { remaining: 30 }); } catch (e) { /* bus indisponible */ }
          } else if (isMile) {
            timerEl.classList.add('azevent-mile-pop');
          } else {
            timerEl.classList.add(remaining <= 3 ? 'azevent-tick-pop-hot' : 'azevent-tick-pop');
          }
          // v22 : l'ANNEAU DE TIC pulse à chaque seconde (le temps bat
          // autour de la pastille ; re-déclenché, pur DOM, aucun coût 3D).
          if (ringEl) {
            ringEl.classList.remove('azevent-ring-pop');
            void ringEl.offsetWidth; // reflow : rejoue l'animation
            ringEl.classList.add('azevent-ring-pop');
          }
          // v21 : BARRE DE PROGRESSION — le temps qui reste se lit sous la
          // pastille (cyan -> rouge sur les 10 dernières secondes).
          if (barFill) {
            barFill.style.width = (Math.max(0, remaining / total) * 100).toFixed(1) + '%';
            barFill.style.background = (remaining <= 10) ?
              'linear-gradient(90deg,#ff5a3c,#ffb03c)' : 'linear-gradient(90deg,#37c8ff,#7fe8ff)';
          }
          // Pitch montant : 700 Hz → 1400 Hz quand zéro approche.
          // v15 : sur les 10 dernières secondes le pitch grimpe ENCORE plus
          // vite (tension maximale : +400 Hz à zéro).
          // Le tic-tac est joué par event-audio.js (aucun doublon sonore ici).
          var pitch = TICK_BASE_PITCH +
            (1 - remaining / total) * (TICK_TOP_PITCH - TICK_BASE_PITCH);
          if (remaining <= 10) pitch += (10 - remaining) * 40;
          try {
            // v15 : 'urgency' (0..1) ajouté au payload — compatible avec les
            // écouteurs existants (event-sky.js ne lit que 'remaining').
            root.AZEvent.emit('countdown:tick', {
              remaining: whole, pitch: pitch,
              urgency: Math.min(1, Math.max(0, 1 - remaining / total))
            });
          } catch (e) { /* bus indisponible */ }
        }
        // v15 — anticipation MONTANTE (chaque frame) : le halo de la pastille
        // s'intensifie à mesure que zéro approche (20 dernières secondes).
        // Inline box-shadow : ne perturbe ni la pop (transform) ni les
        // classes existantes.
        var tenseK = Math.min(1, Math.max(0, 1 - remaining / 20));
        if (tenseK > 0) {
          var tg = Math.round(10 + 30 * tenseK);
          timerEl.style.boxShadow = '0 0 ' + tg + 'px rgba(255,120,80,' +
            (0.25 + 0.6 * tenseK).toFixed(2) + ')';
        } else {
          timerEl.style.boxShadow = '';
        }
        // v15 — vibration LÉGÈRE de la pastille les 10 dernières secondes
        // (margin-left : ne perturbe pas l'animation de pop en transform).
        if (remaining <= 10 && remaining > 0) {
          var shAmp = 2.2 * (1 - remaining / 10);
          timerEl.style.marginLeft = ((Math.random() * 2 - 1) * shAmp).toFixed(1) + 'px';
        } else {
          timerEl.style.marginLeft = '';
        }
        // v15 — le ciel s'assombrit PROGRESSIVEMENT pendant la minute
        // (voile sombre subtil propre au module : opacity 0 -> 0.34).
        // v32 : désactivé — jour demandé par l'utilisateur, pas d'assombrissement.
        if (duskEl) {
          duskEl.style.opacity = '0';
        }
      }
      // Sécurité : si la borne est dépassée sans transition de phase.
      if (remaining <= 0) startWarn();
      return;
    }

    // Triangle d'avertissement : compte à rebours relatif, puis retrait net
    // (retrait + fondu en deux temps pour que la sortie soit visible).
    if (warned && warnT > 0) {
      warnT -= dt;
      // v15 : le voile sombre se dissipe doucement après l'alarme.
      if (duskEl) {
        var dop = parseFloat(duskEl.style.opacity) || 0;
        if (dop > 0) duskEl.style.opacity = Math.max(0, dop - dt * 0.3).toFixed(3);
      }
      if (warnT <= 0) hideWarn();
      return;
    }
    if (warnLeaving && warnEl) {
      warnLeaveT -= dt;
      if (warnLeaveT <= 0) {
        warnLeaving = false;
        warnEl.classList.remove('azevent-on', 'azevent-leave');
        warnEl.classList.add('azevent-hidden');
      }
      return;
    }

    // Hors countdown / avertissement : rien à afficher.
    if (timerEl) timerEl.classList.add('azevent-hidden');
    if (warnEl && !warnEl.classList.contains('azevent-hidden')) {
      warnEl.classList.remove('azevent-on');
      warnEl.classList.add('azevent-hidden');
    }
  }

  function dispose() {
    disposed = true;
    // Les écouteurs du bus deviennent inertes via le drapeau 'disposed'.
    if (container && container.parentNode) {
      try { container.parentNode.removeChild(container); } catch (e) { /* déjà retiré */ }
    }
    if (styleEl && styleEl.parentNode) {
      try { styleEl.parentNode.removeChild(styleEl); } catch (e) { /* déjà retiré */ }
    }
    container = null;
    styleEl = null;
    timerEl = null;
    textEl = null;   // v21
    barFill = null;  // v21
    ringEl = null;   // v22
    milesFired = {}; // v22
    duskEl = null;
    warnEl = null;
    lastWhole = -1;
    warned = false;
    halfFired = false; // v21
    warnT = 0;
    warnLeaving = false;
    warnLeaveT = 0;
    alarmFired = false;
    api = null;
  }

  root.AZEvent.register('countdown', {
    init: init,
    update: update,
    dispose: dispose
  });
})(window);
