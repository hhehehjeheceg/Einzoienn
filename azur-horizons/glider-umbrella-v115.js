/* AZUR v115 — le planeur devient un parapluie.
 * Les anciens planeurs (aile delta de 5,5 m, ailes, navette…) étaient bien trop gros à l'écran. Chaque personnage
 * plane maintenant sous un parapluie : toile à huit pans aux deux couleurs du planeur équipé, baleines, manche et
 * poignée en crochet ; les deux mains tiennent le manche. Chargé en dernier : il enveloppe la fabrique d'avatars
 * (AZArt.avatar) quelle que soit la couche qui l'a remplacée avant lui, et convertit aussi les avatars déjà créés. */
(function (root) {
  "use strict";
  var T = root.THREE;
  if (!T) return;
  var RADIUS = 1.2, APEX = 0.86, RIM = 0.3, PANELS = 8; // réglages : rayon de la toile, hauteur du sommet et du bord (repère du planeur)
  var HANDLES = { left: [-0.035, -0.58, 0], right: [0.035, -0.76, 0] }; // prises des mains sur le manche (repère du planeur)
  var INK = "#22262e";

  function colorsFor(eq) {
    var cat = root.AZMeta && root.AZMeta.catalog, c = cat && eq && eq.glider ? cat.find(function (x) { return x.id === eq.glider; }) : null;
    return [c && c.color || "#ff7a6b", c && c.secondary || "#fff1e6"];
  }
  /** Construit le parapluie (repère du planeur : le manche descend jusqu'aux mains, vers y = -0,82). */
  function umbrella(col, sec) {
    var A = root.AZArt, g = new T.Group(); g.name = "azur-umbrella";
    var h = APEX - RIM, step = Math.PI * 2 / PANELS;
    var canopy = new A.Model();
    for (var i = 0; i < PANELS; i++) {
      // un pan de toile = un morceau de cône ; les pans alternent les deux couleurs
      canopy.add(new T.ConeGeometry(RADIUS, h, 3, 1, true, i * step, step), i % 2 ? sec : col, 0, RIM + h / 2, 0);
    }
    var cm = canopy.mesh(); cm.material = cm.material.clone(); cm.material.side = T.DoubleSide; g.add(cm); // visible aussi par-dessous
    var frame = new A.Model();
    for (var k = 0; k < PANELS; k++) { // baleines (pointes au bord) et petites billes
      var a = k * step, x = Math.sin(a) * RADIUS, z = Math.cos(a) * RADIUS;
      frame.sphere(0.035, INK, x, RIM - 0.01, z);
    }
    frame.sphere(0.06, sec, 0, APEX + 0.03, 0).cyl(0.02, 0.02, 0.16, INK, 0, APEX + 0.1, 0, 6); // embout
    frame.cyl(0.022, 0.022, APEX + 0.8, INK, 0, (APEX - 0.8) / 2, 0, 8); // manche
    frame.cyl(0.04, 0.04, 0.3, sec, 0, -0.67, 0, 10); // poignée
    frame.add(new T.TorusGeometry(0.08, 0.022, 6, 12, Math.PI), sec, 0.08, -0.82, 0, 0, 0, Math.PI); // crochet
    g.add(frame.mesh());
    return g;
  }
  /** Remplace le contenu du planeur d'un avatar par le parapluie (une seule fois par avatar). */
  function swap(avatar, eq) {
    var u = avatar && avatar.userData, gl = u && u.glider; if (!gl || gl.userData.azUmbrella) return;
    var c = colorsFor(eq || (u && u.equipment && (typeof u.equipment === "string" ? JSON.parse(u.equipment) : u.equipment)));
    while (gl.children.length) gl.remove(gl.children[0]);
    gl.add(umbrella(c[0], c[1]));
    gl.userData.handles = { left: HANDLES.left.slice(), right: HANDLES.right.slice() };
    gl.userData.azUmbrella = true;
    if (u.handTargets) {
      var p = gl.position;
      u.handTargets.gliderLeft = [p.x + HANDLES.left[0], p.y + HANDLES.left[1], p.z + HANDLES.left[2]];
      u.handTargets.gliderRight = [p.x + HANDLES.right[0], p.y + HANDLES.right[1], p.z + HANDLES.right[2]];
    }
  }
  var mine = null; // notre enveloppe, une fois posée
  function wrap() {
    var A = root.AZArt; if (!A || typeof A.avatar !== "function" || !A.Model) return false;
    if (A.avatar.__azUmbrella) return true;
    // AZArt.avatar peut être un accesseur qui garde notre enveloppe dans sa chaîne et renvoie la sienne : déjà posé
    var d = Object.getOwnPropertyDescriptor(A, "avatar"); if (mine && d && d.get) return true;
    var base = A.avatar;
    var w = function (eq) {
      var g = base.apply(this, arguments);
      try { swap(g, eq); } catch (e) { if (root.console) console.warn("[AZUR parapluie]", e); }
      return g;
    };
    w.__azUmbrella = true; A.avatar = w; mine = w;
    // les avatars déjà créés (salon, partie en cours)
    try {
      var v = root.AZUR && root.AZUR.view;
      if (v && v.actors) v.actors.forEach(function (m) { swap(m); });
      if (v && v.menuAvatar) swap(v.menuAvatar);
    } catch (e) {}
    return true;
  }
  // une autre couche peut encore envelopper AZArt.avatar après nous : on se remet par-dessus pendant le chargement
  wrap();
  var n = 0, tm = setInterval(function () { wrap(); if (++n > 120) clearInterval(tm); }, 500); // une minute
  root.AZUmbrella = { build: umbrella, swap: swap, version: 115 };
})(typeof globalThis !== "undefined" ? globalThis : this);
