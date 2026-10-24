/* AZUR v116 — les os sont réécrits à chaque image.
 * three.js (PropertyMixer.apply) ne réécrit un os que si sa valeur animée a changé depuis l'image précédente. Les couches de
 * mouvements (ch1-moves-v105, ch1-moves-v107, ch1-models-v93) ajoutent chaque image des rotations par-dessus la pose du clip :
 * quand un os ne bougeait pas dans le clip (personnage à l'arrêt, image sans avance de temps sur téléphone), il n'était pas remis
 * en place et ces rotations s'empilaient — le corps se tordait et finissait par tourner sur lui-même. On réécrit donc toujours
 * la valeur mixée : chaque couche repart d'une pose propre. Chargé juste après three.js. */
(function (root) {
  "use strict";
  var T = root.THREE, PM = T && T.PropertyMixer;
  if (!PM || !PM.prototype || PM.prototype.__azAlways) return;
  var apply0 = PM.prototype.apply;
  PM.prototype.apply = function (accuIndex) {
    apply0.call(this, accuIndex);
    var stride = this.valueSize;
    this.binding.setValue(this.buffer, accuIndex * stride + stride); // même tampon que l'original, sans la comparaison
  };
  PM.prototype.__azAlways = true;
})(typeof globalThis !== "undefined" ? globalThis : this);
