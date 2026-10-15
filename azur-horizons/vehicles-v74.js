/* AZUR v74 — nouvelle gamme de véhicules.
 * Carrosseries galbées (profils extrudés à bords arrondis, passages de roues
 * découpés), habitacle vitré teinté, toit couleur caisse, phares et feux
 * lumineux, jantes à branches avec étriers, pneus à flancs, rétroviseurs,
 * poignées, bas de caisse, aileron. Berline, sport, fourgon et buggy
 * entièrement redessinés ; le bateau garde son modèle.
 * Un seul maillage fusionné par carrosserie (+ 1 pour les feux, + 4 roues) :
 * aussi léger qu'avant en nombre d'appels de dessin. */
(function (root) {
  'use strict';
  var T = root.THREE, A = root.AZArt;
  if (!T || !A || !A.Model || !A.vehicleModel) return;
  var Model = A.Model, legacy = A.vehicleModel;
  var GLASS = '#1b2b3a', DARK = '#121a22', TRIM = '#232f3a', CHROME = '#cfd8dc', RUBBER = '#15191d', SIDEWALL = '#2a3036';
  var lightMat = new T.MeshBasicMaterial({vertexColors: true, toneMapped: false});
  function shade(hex, k) { var c = new T.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

  // Profil latéral (u = longueur, avant vers +u ; v = hauteur) extrudé sur la largeur.
  function profile(pts, arches) {
    var s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i];
      if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]);
    }
    return s;
  }
  // Ajoute un profil extrudé centré sur x, l'avant du véhicule vers -Z.
  function extrude(m, shape, width, col, bevel, y0) {
    var b = bevel == null ? .06 : bevel;
    var g = new T.ExtrudeGeometry(shape, {depth: Math.max(.02, width - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * .85, bevelSegments: 3, curveSegments: 10});
    g.translate(0, y0 || 0, -(width - 2 * b) / 2);
    return m.add(g, col, 0, 0, 0, 0, Math.PI / 2, 0);
  }
  // Bas de caisse avec deux passages de roue en arc (avant +u).
  function lowerBody(len, h0, h1, fw, rw, r, frontPts, rearPts) {
    var s = new T.Shape();
    s.moveTo(rearPts[0][0], rearPts[0][1]);
    for (var i = 1; i < rearPts.length; i++) { var p = rearPts[i]; if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]); }
    for (var j = 0; j < frontPts.length; j++) { var q = frontPts[j]; if (q.length === 4) s.quadraticCurveTo(q[2], q[3], q[0], q[1]); else s.lineTo(q[0], q[1]); }
    // dessous : de l'avant vers l'arrière en contournant les roues
    s.lineTo(fw + r + .04, h0); s.absarc(fw, h0 + .02, r + .04, 0, Math.PI, false);
    s.lineTo(rw + r + .04, h0); s.absarc(rw, h0 + .02, r + .04, 0, Math.PI, false);
    s.lineTo(rearPts[0][0], rearPts[0][1]);
    return s;
  }
  function wheel(radius, width, rim, caliper, spokes) {
    var m = new Model();
    m.cyl(radius, radius, width, RUBBER, 0, 0, 0, 22, 0, Math.PI / 2);
    m.cyl(radius * .93, radius * .93, width + .02, SIDEWALL, 0, 0, 0, 22, 0, Math.PI / 2);
    m.cyl(radius * .68, radius * .68, width + .03, shade(rim, .55), 0, 0, 0, 20, 0, Math.PI / 2);
    m.cyl(radius * .3, radius * .3, width * .5, shade(rim, .8), 0, 0, 0, 14, 0, Math.PI / 2);   // disque
    for (var side = -1; side <= 1; side += 2) {
      var x = side * (width / 2 + .012);
      for (var k = 0; k < spokes; k++) {
        var a = k * Math.PI * 2 / spokes;
        m.box(.035, radius * .58, radius * .13, rim, x, Math.cos(a) * radius * .36, Math.sin(a) * radius * .36, a, 0, 0);
      }
      m.cyl(radius * .15, radius * .15, .03, rim, x, 0, 0, 10, 0, Math.PI / 2);
      m.cyl(radius * .66, radius * .66, .02, rim, x * .99, 0, 0, 20, 0, Math.PI / 2);
      m.cyl(radius * .6, radius * .6, .03, shade(rim, .35), x * 1.01, 0, 0, 20, 0, Math.PI / 2);
    }
    return m.mesh();
  }
  function addWheels(g, type, axleX, fz, rz, radius, width, rim, caliper, spokes) {
    g.userData.wheels = []; g.userData.steeringWheels = [];
    [[-axleX, fz], [axleX, fz], [-axleX, rz], [axleX, rz]].forEach(function (p) {
      var pivot = new T.Group(); pivot.position.set(p[0], radius, p[1]);
      var w = wheel(radius, width, rim, caliper, spokes); pivot.add(w); g.add(pivot); g.userData.wheels.push(w);
      if (caliper) pivot.add(new Model().box(.08, radius * .3, radius * .24, caliper, -Math.sign(p[0]) * .02, radius * .26, -radius * .22).mesh());
      if (p[1] < 0) g.userData.steeringWheels.push(pivot);
    });
  }
  function lights(front, rear) {
    var m = new Model();
    front.forEach(function (b) { m.box(b[0], b[1], b[2], b[6] || '#fff6d8', b[3], b[4], b[5]); });
    rear.forEach(function (b) { m.box(b[0], b[1], b[2], b[6] || '#ff2a3a', b[3], b[4], b[5]); });
    var mesh = m.mesh(); mesh.material = lightMat; mesh.castShadow = false; mesh.receiveShadow = false; return mesh;
  }

  /* ------------------------------------------------------------ BERLINE */
  function sedan(col) {
    var g = new T.Group(), m = new Model(), W_ = 1.96, r = .42;
    var low = lowerBody(4.3, .28, .92, 1.3, -1.28, r,
      [[-1.55, .98], [-.2, 1.0], [1.2, .96, .6, 1.0], [1.98, .78, 1.85, .93], [2.15, .52, 2.16, .66], [2.02, .28, 2.14, .32]],
      [[-2.06, .3], [-2.16, .62, -2.18, .4], [-2.02, .95, -2.16, .9], [-1.55, .98]]);
    extrude(m, low, W_, col, .05);
    // habitacle vitré + toit couleur caisse
    var cab = profile([[-1.42, .96], [-.82, 1.4, -1.2, 1.32], [.32, 1.45, -.3, 1.48], [1.02, .97, .7, 1.25]]);
    extrude(m, cab, W_ - .26, GLASS, .05);
    var roof = profile([[-.84, 1.38], [-.3, 1.475, -.62, 1.46], [.34, 1.475, 0, 1.49], [.5, 1.4], [-.7, 1.37]]);
    extrude(m, roof, W_ - .22, col, .04);
    // montants, bas de caisse, ligne de porte, poignées, rétros, calandre
    for (var s = -1; s <= 1; s += 2) {
      var x = s * (W_ / 2 - .1);
      m.box(.06, .5, .12, col, x, 1.18, .02, -.15, 0, 0);                       // pied milieu
      m.box(.05, .1, 2.5, TRIM, s * (W_ / 2 + .005), .4, 0);                    // bas de caisse
      m.box(.02, .5, .02, shade(col, .6), s * (W_ / 2 + .01), .68, .05);        // joint de porte
      m.box(.03, .04, .16, CHROME, s * (W_ / 2 + .02), .84, -.35);              // poignées
      m.box(.03, .04, .16, CHROME, s * (W_ / 2 + .02), .84, .62);
      m.box(.22, .12, .1, col, s * (W_ / 2 + .1), 1.0, -.86);                   // rétroviseur
      m.box(.2, .1, .02, GLASS, s * (W_ / 2 + .12), 1.0, -.81);
    }
    m.box(1.15, .22, .06, DARK, 0, .6, -2.185).box(1.1, .04, .07, CHROME, 0, .72, -2.19).box(1.3, .1, .06, DARK, 0, .38, -2.15);   // calandre, prise d'air
    m.box(1.7, .12, .1, TRIM, 0, .34, -2.1).box(1.7, .12, .1, TRIM, 0, .36, 2.1);        // boucliers
    m.box(.5, .12, .03, '#e8e8e8', 0, .52, 2.18);                                         // plaque
    g.add(m.mesh());
    g.add(lights([[.48, .09, .06, -.62, .78, -2.12], [.48, .09, .06, .62, .78, -2.12], [1.5, .025, .04, 0, .86, -2.06, '#bfefff']],
                 [[.55, .08, .05, -.62, .86, 2.15], [.55, .08, .05, .62, .86, 2.15], [.5, .03, .05, 0, .86, 2.16]]));
    addWheels(g, 'car', .9, -1.3, 1.28, r, .3, '#c9d2d6', '#e8423a', 5);
    g.userData.seat = [0, 1.0, -.05];
    return g;
  }
  /* ------------------------------------------------------------ SPORT */
  function sport(col) {
    var g = new T.Group(), m = new Model(), W_ = 2.04, r = .4;
    var low = lowerBody(4.3, .24, .8, 1.34, -1.3, r,
      [[-1.2, .86], [.2, .84], [1.4, .78, .9, .84], [2.1, .5, 2.0, .7], [2.0, .24, 2.18, .3]],
      [[-2.1, .28], [-2.18, .62, -2.2, .4], [-2.04, .86, -2.2, .86], [-1.2, .86]]);
    extrude(m, low, W_, col, .09);
    // ailes arrière bombées
    for (var s = -1; s <= 1; s += 2) m.ball(.5, col, s * (W_ / 2 - .14), .7, 1.25, .5, .55, 1.25, 1);
    var cab = profile([[-1.75, .84], [-.5, 1.2, -1.2, 1.12], [.2, 1.22, -.2, 1.25], [.95, .84, .65, 1.05]]);
    extrude(m, cab, W_ - .36, GLASS, .05);
    var roof = profile([[-.5, 1.17], [-.1, 1.235, -.35, 1.24], [.24, 1.21, .05, 1.245], [.2, 1.16], [-.45, 1.14]]);
    extrude(m, roof, W_ - .4, col, .035);
    m.box(1.9, .06, .32, DARK, 0, 1.08, 2.0).box(.06, .26, .1, DARK, -.6, .95, 1.98).box(.06, .26, .1, DARK, .6, .95, 1.98);   // aileron
    m.box(1.8, .1, .3, DARK, 0, .26, -2.0);                                                                           // lame avant
    m.box(1.6, .14, .2, DARK, 0, .3, 2.12).box(.14, .1, .1, CHROME, -.4, .3, 2.24).box(.14, .1, .1, CHROME, .4, .3, 2.24);  // diffuseur, échappements
    m.box(.9, .02, 1.0, shade(col, .75), 0, .845, -1.0);                                                              // nervure de capot
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      m.box(.05, .1, 2.4, TRIM, s2 * (W_ / 2 + .005), .34, 0);
      m.box(.2, .1, .1, col, s2 * (W_ / 2 + .08), .98, -.72);
      m.box(.04, .18, .5, DARK, s2 * (W_ / 2 + .005), .62, -.5);                                                       // ouïe latérale
    }
    g.add(m.mesh());
    g.add(lights([[.5, .06, .06, -.66, .68, -2.06], [.5, .06, .06, .66, .68, -2.06]],
                 [[1.7, .05, .05, 0, .8, 2.16], [.3, .07, .05, -.72, .78, 2.15], [.3, .07, .05, .72, .78, 2.15]]));
    addWheels(g, 'sport', .92, -1.34, 1.3, r, .34, '#2a2f35', '#ffcf3a', 10);
    g.userData.seat = [0, .92, .05];
    return g;
  }
  /* ------------------------------------------------------------ FOURGON */
  function van(col) {
    var g = new T.Group(), m = new Model(), W_ = 2.04, r = .44;
    var low = lowerBody(4.5, .3, 2.2, 1.4, -1.45, r,
      [[-2.18, 2.08], [1.0, 2.12, -.2, 2.14], [1.55, 1.38, 1.4, 1.95], [2.15, .95, 1.98, 1.1], [2.22, .55, 2.25, .75], [2.1, .3, 2.22, .33]],
      [[-2.2, .32], [-2.24, 1.2], [-2.22, 1.95, -2.26, 2.0], [-2.18, 2.08]]);
    extrude(m, low, W_, col, .1);
    // vitres : pare-brise incliné, vitres latérales, bandeau
    for (var s = -1; s <= 1; s += 2) {
      m.box(.03, .55, .8, GLASS, s * (W_ / 2 + .006), 1.66, -.95);
      m.box(.03, .45, 1.6, GLASS, s * (W_ / 2 + .006), 1.62, .65);
      m.box(.05, .12, 3.6, TRIM, s * (W_ / 2 + .005), .42, 0);
      m.box(.02, 1.1, .02, shade(col, .6), s * (W_ / 2 + .01), 1.2, -.62);
      m.box(.04, .03, 1.5, shade(col, .55), s * (W_ / 2 + .01), 1.0, .6);                                // rail de porte coulissante
      m.box(.22, .2, .1, DARK, s * (W_ / 2 + .1), 1.55, -1.5);
    }
    m.box(W_ - .34, .74, .04, GLASS, 0, 1.72, -1.47, .6, 0, 0);
    m.box(1.4, .5, .05, GLASS, 0, 1.55, 2.24);
    m.box(.02, 1.5, .02, shade(col, .6), 0, 1.15, 2.26);
    m.box(1.3, .26, .06, DARK, 0, .7, -2.22).box(1.9, .14, .12, TRIM, 0, .38, -2.2).box(1.9, .14, .12, TRIM, 0, .4, 2.24);
    for (var k = -1; k <= 1; k += 2) m.box(.07, .07, 3.0, CHROME, k * .72, 2.25, .1);                     // barres de toit
    for (var z = -1; z <= 1; z++) m.box(1.5, .05, .07, CHROME, 0, 2.28, z * 1.2);
    g.add(m.mesh());
    g.add(lights([[.36, .14, .06, -.74, 1.0, -2.2], [.36, .14, .06, .74, 1.0, -2.2]],
                 [[.12, .5, .05, -.92, 1.2, 2.25], [.12, .5, .05, .92, 1.2, 2.25]]));
    addWheels(g, 'van', .92, -1.4, 1.45, r, .3, '#d5dcdf', null, 6);
    g.userData.seat = [0, 1.3, -.9];
    return g;
  }
  /* ------------------------------------------------------------ BUGGY */
  function tube(m, a, b, rad, col) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    var g = new T.CylinderGeometry(rad, rad, len, 8); g.translate(0, len / 2, 0);
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / len, dy / len, dz / len));
    g.applyQuaternion(q); g.translate(a[0], a[1], a[2]); m.add(g, col);
  }
  function buggy(col) {
    var g = new T.Group(), m = new Model(), r = .52;
    var tub = profile([[-1.5, .42], [1.3, .42], [1.75, .7, 1.7, .45], [1.2, .86], [-.2, .82], [-1.4, .86], [-1.62, .6, -1.66, .8]]);
    extrude(m, tub, 1.5, col, .07);
    m.box(1.3, .12, 2.6, DARK, 0, .36, 0);                                                                    // plancher
    for (var s = -1; s <= 1; s += 2) {
      m.box(.5, .5, .5, DARK, s * .34, .95, .15).box(.5, .12, .55, TRIM, s * .34, .74, .12);                 // baquets
      m.box(.42, .34, .9, col, s * .98, .78, -1.3, 0, 0, s * .2).box(.42, .34, .9, col, s * .98, .78, 1.3, 0, 0, s * .2);  // garde-boue
    }
    var C_ = '#e9eef0';
    [[-.7, .8, .75], [.7, .8, .75]].forEach(function (p) { tube(m, p, [p[0] * .8, 1.75, .55], .05, C_); tube(m, [p[0], .8, -.6], [p[0] * .8, 1.6, -.25], .05, C_); });
    tube(m, [-.56, 1.75, .55], [.56, 1.75, .55], .05, C_); tube(m, [-.56, 1.6, -.25], [.56, 1.6, -.25], .05, C_);
    tube(m, [-.56, 1.75, .55], [-.56, 1.6, -.25], .05, C_); tube(m, [.56, 1.75, .55], [.56, 1.6, -.25], .05, C_);
    tube(m, [-.56, 1.75, .55], [.56, 1.6, -.25], .04, C_);
    m.box(1.2, .1, .1, DARK, 0, 1.66, -.27);                                                                   // rampe de phares
    m.box(.6, .3, .35, '#3a4048', 0, .82, 1.45).box(.12, .12, .3, CHROME, .2, .9, 1.7);                       // moteur, échappement
    m.box(1.6, .12, .14, DARK, 0, .5, -1.78);                                                                  // pare-buffle
    g.add(m.mesh());
    g.add(lights([[.18, .1, .06, -.42, 1.67, -.34, '#fffbe0'], [.18, .1, .06, -.14, 1.67, -.34, '#fffbe0'], [.18, .1, .06, .14, 1.67, -.34, '#fffbe0'], [.18, .1, .06, .42, 1.67, -.34, '#fffbe0'], [.3, .1, .05, -.5, .62, -1.66], [.3, .1, .05, .5, .62, -1.66]],
                 [[.2, .1, .05, -.5, .72, 1.68], [.2, .1, .05, .5, .72, 1.68]]));
    addWheels(g, 'buggy', 1.08, -1.3, 1.3, r, .44, '#3b4148', '#ff6a2a', 6);
    // pneus tout-terrain : crampons
    g.userData.wheels.forEach(function (w) {
      var t = new Model(); for (var k = 0; k < 14; k++) { var a = k * Math.PI * 2 / 14; t.box(.46, .07, .1, RUBBER, 0, Math.cos(a) * r, Math.sin(a) * r, a, 0, 0); }
      w.add(t.mesh());
    });
    g.userData.seat = [0, 1.05, .1];
    return g;
  }

  var builders = {car: sedan, sport: sport, van: van, buggy: buggy};
  A.vehicleModel = function (v) {
    var b = builders[v && v.type];
    if (!b) return legacy(v);
    var fallback = v.type === 'buggy' ? '#f6c356' : v.type === 'van' ? '#43b8bd' : v.type === 'sport' ? '#db5570' : '#ed8768';
    var col = /^#[0-9a-f]{6}$/i.test(v.paint || '') ? v.paint : fallback;
    try {
      var g = b(col); g.userData.rotors = []; g.userData.type = v.type; g.userData.v74 = true; return g;
    } catch (e) { return legacy(v); }
  };
})(window);
