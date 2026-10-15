/* v55 : Point Zéro VISUEL en vraie partie (pas en event).
 * Capture la scène THREE et y ajoute un Point Zéro flottant au centre de la map.
 * Le sim (sim.js) gère la destruction des bâtiments ; ici c'est le visuel. */
(function () {
'use strict';
var scene = null, zeroMesh = null, glowMesh = null, T = null;
var ZP_X = 0, ZP_Z = 0, ZP_Y = 120;

// Intercepte la création de la scène pour la capturer.
function hookScene() {
  if (!window.THREE || !window.THREE.Scene) { setTimeout(hookScene, 500); return; }
  T = window.THREE;
  var OrigScene = T.Scene;
  window.THREE.Scene = function () {
    var s = new OrigScene();
    if (!scene) { scene = s; setTimeout(buildZeroPoint, 1000); }
    return s;
  };
  // Si la scène existe déjà (script chargé après), on la cherche.
  setTimeout(findScene, 2000);
}
function findScene() {
  if (scene) return;
  // La scène est déjà créée, on ne peut pas la capturer — on abandonne.
  // (Le visuel ne s'affichera pas, mais la destruction des bâtiments marche.)
}
function buildZeroPoint() {
  if (!scene || !T || zeroMesh) return;
  try {
    // Sphère du Point Zéro : bleu énergétique, émissive.
    var geo = new T.SphereGeometry(18, 24, 18);
    var mat = new T.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 });
    zeroMesh = new T.Mesh(geo, mat);
    zeroMesh.position.set(ZP_X, ZP_Y, ZP_Z);
    scene.add(zeroMesh);
    // Halo extérieur.
    var glowGeo = new T.SphereGeometry(28, 24, 18);
    var glowMat = new T.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.25, side: T.BackSide });
    glowMesh = new T.Mesh(glowGeo, glowMat);
    glowMesh.position.copy(zeroMesh.position);
    scene.add(glowMesh);
    // Animation.
    var t = 0;
    (function animate() {
      var visible = shouldRun();
      zeroMesh.visible = glowMesh.visible = visible;
      if (!visible) { requestAnimationFrame(animate); return; }
      t += 0.016;
      if (zeroMesh) {
        zeroMesh.rotation.y += 0.01;
        zeroMesh.position.y = ZP_Y + Math.sin(t * 1.2) * 8;
        var s = 1 + Math.sin(t * 2.5) * 0.08;
        zeroMesh.scale.set(s, s, s);
      }
      if (glowMesh && zeroMesh) {
        glowMesh.position.copy(zeroMesh.position);
        var gs = 1 + Math.sin(t * 2.5 + 1) * 0.12;
        glowMesh.scale.set(gs, gs, gs);
      }
      requestAnimationFrame(animate);
    })();
  } catch (e) { /* visuel optionnel, la logique sim continue */ }
}
// Ne pas afficher pendant l'event (le vrai Point Zéro de l'event s'en charge).
function shouldRun() {
  try {
    if (window.AZEvent && window.AZEvent.active) return false;
  } catch (e) {}
  return true;
}
if (shouldRun()) hookScene();
})();
