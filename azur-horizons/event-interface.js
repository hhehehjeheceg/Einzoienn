(function (root) {
'use strict';
var E = root.AZEvent; if (!E) return;
var panel, title, subtitle, caption, bar, timer, flash, lastPhase = '', controls;
var chapters = {
  countdown: ['PROLOGUE', 'Le dernier départ', 'Le ciel attend. Les moteurs se préparent.'],
  firstrocket: ['01 · DÉCOLLAGE', 'Une brèche dans le ciel', 'Allumage. Ascension. Premier passage.'],
  sixrockets: ['02 · LES SEPT', 'Des trajectoires qui se répondent', 'Sept fusées. Un seul objectif.'],
  convergence: ['03 · CONVERGENCE', 'Le rendez-vous', 'Toutes les trajectoires convergent vers la même faille.'],
  loop: ['04 · CAPTURE', 'Un passage, puis un autre', 'Une fusée surgit derrière, dépasse la météorite et plonge dans la faille avant.'],
  acceleration: ['05 · TRANSFERT', 'Toujours plus vite', 'Gauche. Droite. Les passages se multiplient et accélèrent.'],
  silence: ['06 · SILENCE', 'Le calme ne durera pas', 'Plus de fusées. Plus de météorite.'],
  strike: ['07 · FRACTURE', 'Le Point Zéro est visé', 'La première fusée verrouille sa cible.'],
  thrown: ['08 · ONDE DE CHOC', 'La gravité cède', 'Le Point Zéro a été fissuré.'],
  greatrift: ['09 · LE RETOUR', 'Le ciel se déchire', 'La météorite revient par la grande faille.'],
  meteorsix: ['10 · L’ESCORTE', 'Les six dernières fusées', 'La première fusée est détruite. Les six autres escortent la météorite.'],
  descent: ['11 · DESCENTE', 'Un équilibre impossible', 'La zone du Point Zéro s’étend face à la météorite.'],
  veeroff: ['12 · ÉVACUATION', 'Les derniers passages', 'Les six fusées quittent la trajectoire d’impact.'],
  impact: ['13 · IMPACT', 'Le point de non-retour', 'La météorite poursuit sa trajectoire jusqu’au Point Zéro.'],
  contraction: ['14 · CONTRACTION', 'Tout revient au centre', 'La lumière se replie sur elle-même.'],
  collapse: ['15 · EFFONDREMENT', 'Une singularité naît', 'Le Point Zéro disparaît.'],
  growth: ['16 · SINGULARITÉ', 'L’attraction devient totale', 'Le trou noir prend sa place.'],
  destruction: ['17 · DESTRUCTION', 'L’île se défait', 'La matière converge vers le centre.'],
  playersucked: ['18 · ASPIRATION', 'Aucun point d’appui', 'La singularité emporte les derniers témoins.'],
  allgone: ['19 · DISPARITION', 'Le dernier horizon', 'Même le dernier transport disparaît.'],
  blackhole: ['20 · LE VIDE', 'Après la lumière', 'Il ne reste que la singularité.'],
  numbers: ['21 · LES NOMBRES', 'Une dernière transmission', 'Une trace subsiste dans le silence.'],
  end: ['', '', '']
};
function element(tag, className, text) { var el = document.createElement(tag); el.className = className; if (text) el.textContent = text; return el; }
function init() {
  lastPhase = ''; document.body.dataset.eventActive = 'true'; panel = element('section', 'event-v27'); panel.setAttribute('aria-label', 'Événement The End');
  var header = element('header', 'event-v27-header'), identity = element('div', 'event-v27-identity'); identity.appendChild(element('span', 'event-v27-eyebrow', 'AZUR HORIZONS / THE END'));
  title = element('strong', 'event-v27-title'); subtitle = element('span', 'event-v27-subtitle'); identity.append(title, subtitle); header.appendChild(identity);
  controls = element('div', 'event-v27-controls'); timer = element('span', 'event-v27-time'); controls.appendChild(timer);
  header.appendChild(controls);
  var footer = element('footer', 'event-v27-footer'); caption = element('p', 'event-v27-caption'); caption.setAttribute('role', 'status'); footer.appendChild(caption);
  bar = element('div', 'event-v27-progress'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'Progression de l’événement'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(E.duration));
  flash = element('div', 'event-v27-flash'); flash.setAttribute('aria-hidden', 'true'); panel.append(flash, header, footer, bar); document.body.appendChild(panel);
  identity.style.display = 'none'; // pas de titres de chapitres : timer seul
  footer.style.display = 'none';   // pas de légendes : timer seul
  update(0);
}
function update() {
  if (!panel || !E.active) return;
  var state = E.state, chapter = chapters[state] || chapters.countdown;
  if (lastPhase !== state) { lastPhase = state; title.textContent = chapter[1]; subtitle.textContent = chapter[0]; caption.textContent = chapter[2]; panel.dataset.phase = state; }
  if (E.riftWorld && E.riftWorld.active) {
    subtitle.textContent = 'MONDE DE LA FAILLE'; title.textContent = 'Entre les réalités';
    caption.textContent = (E.riftWorld.exitProgress || 0) > .72 ? 'La météorite plonge dans la faille de sortie : téléportation au-dessus de l\u2019île.' : E.riftWorld.rocketStage === 'entering-exit-rift' ? 'La fusée traverse la faille de sortie pour plonger vers le Point Zéro.' : E.riftWorld.rocketStage === 'zero-point-contact' ? 'Le Point Zéro est touché. La météorite reste avec vous dans la faille.' : 'Vous voyagez sur la météorite. La fenêtre de sortie révèle le monde extérieur.';
  } else { subtitle.textContent = chapter[0]; title.textContent = chapter[1]; caption.textContent = chapter[2]; }
  if (state === 'impact' && E.meteorContactTime !== null) caption.textContent = 'Contact confirmé. Le Point Zéro libère son énergie.';
  if (state === 'acceleration' && E.tState >= 29 && !(E.riftWorld && E.riftWorld.active)) caption.textContent = E.meteorAbsorbedTime === null ? 'Les fusées ont ouvert le passage. La météorite est aspirée.' : 'La météorite a disparu dans la faille.';
  var t = state === 'countdown' ? Math.ceil(Math.max(0, 60 - E.tTotal)) : Math.floor(E.tTotal); timer.textContent = (state === 'countdown' ? 'T−' : '') + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  bar.style.setProperty('--event-progress', Math.min(100, E.tTotal / E.duration * 100) + '%'); bar.setAttribute('aria-valuenow', Math.min(E.duration, Math.floor(E.tTotal)));
  panel.dataset.quiet = String(state !== 'countdown' && E.tState > 4.5);
  var reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches; flash.style.opacity = String(reduced ? Math.min(0.12, E.screenFlash || 0) : E.screenFlash || 0);
}
function dispose() { if (panel) panel.remove(); panel = null; delete document.body.dataset.eventActive; }
E.register('hud', { init: init, update: update, dispose: dispose });
if (new URLSearchParams(root.location.search).get('mode') === 'event') {
  var lobbyAttempts = 0;
  function selectEventLobby() {
    var game = root.AZUR;
    if (game && game.screen === 'menu') { game.mode = 'event'; game.renderMenu(); return; }
    if (++lobbyAttempts < 180) root.requestAnimationFrame(selectEventLobby);
  }
  root.requestAnimationFrame(selectEventLobby);
}
if (new URLSearchParams(root.location.search).get('event-preview') === '1') {
  var attempts = 0;
  function openEventPreview() {
    var game = root.AZUR;
    if (game && game.screen === 'menu') { game.mode = 'event'; game.startMatch(); return; }
    if (++attempts < 120) root.requestAnimationFrame(openEventPreview);
  }
  root.requestAnimationFrame(openEventPreview);
}
})(window);
