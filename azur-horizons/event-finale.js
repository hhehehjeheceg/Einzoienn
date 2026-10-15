/* event-finale.js — MODULE "THE END" : PHASE FINALE ('end') (AZUR Horizons v9).
 * État 'end' [328,infini] (état final du séquenceur) : l'écran est
 * TOTALEMENT NOIR avec juste un minuscule point bleu lumineux au centre
 * (géré par event-blackhole.js). Ce module n'ajoute RIEN d'autre par-dessus
 * cette image finale : aucun bouton, aucun texte — demande explicite de
 * l'utilisateur : rien après le noir final sauf le minuscule point bleu.
 * Pas de texte « THE END » sur l'image finale. AUCUNE animation, AUCUN
 * texte après la fin.
 * Contrat : root.AZEvent.register('finale', {init, update, dispose}).
 */
(function (root) {
'use strict';

if (!root.AZEvent) return;

// ---------------------------------------------------------------- état local
var bound = false;    // écouteur 'phase:end' branché une seule fois (pas de off())
                      // l'abonnement survit au stop()/dispose() et suffit
                      // pour les redémarrages — pas de doublon d'écouteur

// ---------------------------------------------------------------- cycle de vie
// Réception de la fin : le séquenceur émet 'phase:end' à l'entrée dans
// l'état final. Abonnement unique : le bus n'a pas de off(), l'écouteur
// reste enregistré d'un redémarrage à l'autre.
function onPhaseEnd() {
  // v9 : aucun bouton QUITTER (interdit par l'utilisateur) — le point bleu
  // final reste seul sur noir.
}

function init(a) {
  if (!bound) { bound = true; a.on('phase:end', onPhaseEnd); }
}

function update(dt, t) {
  if (!root.AZEvent.active) return;
  // Le point bleu final reste seul sur noir : rien d'autre à faire ici
  // (event-blackhole.js maintient le minuscule point bleu centré —
  // l'image finale de l'event).
}

function dispose() {
  // 'bound' reste vrai : l'abonnement 'phase:end' survit au stop() et
  // suffit pour les redémarrages (pas de doublon d'écouteur).
}

root.AZEvent.register('finale', {
  init: init,
  update: update,
  dispose: dispose
});

})(window);
