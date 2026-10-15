/* event-camera.js — MODULE "THE END" v7 : LA CAMÉRA (désactivée).
 *
 * ÉVÉNEMENT JOUABLE (v7) : la caméra reste CELLE DU JOUEUR à 100 %, du
 * début à la fin de l'event. AUCUN patch du renderer, AUCUNE caméra
 * cinématique, AUCUN masquage du Battle Bus : le joueur voit l'événement
 * avec sa propre caméra (bus, troisième personne, planeur...).
 *
 * Ce module existe uniquement pour garder le contrat d'enregistrement
 * (les autres modules ne dépendent pas de lui). init/preUpdate/update/
 * dispose sont des no-op.
 */
(function (root) {
'use strict';
if (!root.AZEvent) return;

root.AZEvent.register('camera', {
  init: function () {},
  preUpdate: function () {},
  update: function () {},
  dispose: function () {}
});

})(window);
