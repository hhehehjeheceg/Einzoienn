/* AZUR v82 — nouveau Bus des Horizons (création originale).
 * Car rétro à carrosserie arrondie bleu nuit et crème, grandes vitres, calandre
 * chromée, phares ronds, pare-chocs, roues à enjoliveurs, porte pliante, échelle,
 * galerie de toit chargée (malles, valises, roue de secours), quatre turbines
 * carénées, et un grand ballon à fuseaux alternés turquoise / crème avec
 * couronne dorée, emblème boussole, gouvernes de queue et gréement.
 * L'interface publique du modèle est conservée (balloon, thrusters, turbines,
 * cabinPanes, navLights, headlights, energyCore, interior, caméra) : la vue, le
 * salon et les effets existants l'animent sans modification. */
(function (root) {
  'use strict';
  var T = root.THREE, A = root.AZArt;
  if (!T || !A || typeof A.aircraft !== 'function' || !A.Model) return;
  var Model = A.Model, previous = A.aircraft;
  /* v92 « Chapitre 1 » : bus bleu vif sous un ballon turquoise et blanc à couronne jaune (design/azur-reference-spec.md §3.4). */
  var BUS_BLUE = '#2d63d8', BUS_LOW = '#1a2f6a', BUS_ROOF = '#2b3f70', BUS_BELT = '#d6e4ff', B_TEAL = '#15a6b8', B_TEAL2 = '#1192a3', B_WHITE = '#eef8f8', B_YELLOW = '#ffd23a', B_SEAM = '#0d5f6b';
  var NAVY = '#173a6e', BLUE = '#2368c4', CREAM = '#f3ead6', CHROME = '#c9d4de', DARK = '#151b24', GLASS = '#173750', GOLD = '#e8b54a', TEAL = '#1fb5c6', WOOD = '#a8703c', RED = '#d8473c';

  function std(color, o) {
    o = o || {}; var m = new T.MeshStandardMaterial({ color: color, roughness: o.r == null ? .5 : o.r, metalness: o.m || 0, vertexColors: !!o.vc, flatShading: !!o.flat });
    if (o.e) { m.emissive = new T.Color(o.e); m.emissiveIntensity = o.ei || 1; }
    return m;
  }
  function roundedRect(w, h, rTop, rBot) {
    var s = new T.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    s.moveTo(x0 + rBot, y0); s.lineTo(x1 - rBot, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rBot);
    s.lineTo(x1, y1 - rTop); s.quadraticCurveTo(x1, y1, x1 - rTop, y1); s.lineTo(x0 + rTop, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rTop);
    s.lineTo(x0, y0 + rBot); s.quadraticCurveTo(x0, y0, x0 + rBot, y0);
    return s;
  }
  function canvasTex(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
  function signTex() {
    return canvasTex(512, 96, function (g, w, h) {
      g.fillStyle = '#0b1a2e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7ff3ff'; g.font = '800 64px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#3fd8ff'; g.shadowBlur = 14; g.fillText('HORIZONS', w / 2, h / 2 + 3);
    });
  }
  function emblemTex() {
    return canvasTex(256, 256, function (g) {
      g.translate(128, 128);
      g.fillStyle = '#f3ead6'; g.beginPath(); g.arc(0, 0, 122, 0, 6.3); g.fill();
      g.strokeStyle = '#e8b54a'; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, 112, 0, 6.3); g.stroke();
      g.strokeStyle = '#173a6e'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 94, 0, 6.3); g.stroke();
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4, L = k % 2 ? 54 : 88, wdt = k % 2 ? 12 : 18;
        g.save(); g.rotate(a); g.fillStyle = k % 2 ? '#1fb5c6' : (k === 0 ? '#d8473c' : '#173a6e');
        g.beginPath(); g.moveTo(0, -L); g.lineTo(wdt, 0); g.lineTo(0, 10); g.lineTo(-wdt, 0); g.closePath(); g.fill(); g.restore();
      }
      g.fillStyle = '#e8b54a'; g.beginPath(); g.arc(0, 0, 13, 0, 6.3); g.fill();
    });
  }

  function aircraft() {
    var g = new T.Group(), L = 10.2, W = 4.8, H = 2.7, m = new Model();
    // carrosserie arrondie (extrusion d'une section à toit bombé)
    var shell = new T.ExtrudeGeometry(roundedRect(W, H, .78, .22), { depth: L, bevelEnabled: true, bevelThickness: .14, bevelSize: .1, bevelSegments: 3, curveSegments: 8 });
    shell.translate(0, .2, -L / 2); shell.computeVertexNormals();
    // deux tons : bas bleu, ceinture crème, toit crème (couleur par hauteur)
    shell = shell.toNonIndexed(); var pos = shell.attributes.position, col = new Float32Array(pos.count * 3), c = new T.Color();
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i); c.set(y > 1.12 ? BUS_ROOF : y > -.02 && y < .18 ? BUS_BELT : y < -.86 ? BUS_LOW : BUS_BLUE); /* v92 : carrosserie bleue comme le bus de la référence */
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    shell.setAttribute('color', new T.BufferAttribute(col, 3));
    var body = new T.Mesh(shell, std('#ffffff', { vc: true, r: .42, m: .15 })); body.castShadow = body.receiveShadow = true; g.add(body);
    // vitres latérales + montants
    for (var s = -1; s <= 1; s += 2) {
      m.box(.06, .92, 8.6, GLASS, s * (W / 2 + .08), .7, .25);
      for (var z = -4.05; z <= 4.6; z += 1.43) m.box(.1, .98, .14, CREAM, s * (W / 2 + .11), .7, z);
      m.box(.08, .1, 8.75, CHROME, s * (W / 2 + .12), .2, .25).box(.08, .08, 8.75, CHROME, s * (W / 2 + .12), 1.18, .25);
      // passages de roue
      for (var wz = -3.35; wz <= 3.4; wz += 6.7) m.add(new T.CylinderGeometry(.86, .86, .3, 18, 1, false, 0, Math.PI), DARK, s * (W / 2 + .03), -1.05, wz, 0, 0, Math.PI / 2 * s);
    }
    // porte pliante (côté droit) et échelle (arrière)
    m.box(.08, 2.05, 1.25, NAVY, W / 2 + .1, -.05, -3.3).box(.06, .8, .5, GLASS, W / 2 + .14, .55, -3.6).box(.06, .8, .5, GLASS, W / 2 + .14, .55, -3.0).box(.07, 2.0, .05, CHROME, W / 2 + .15, -.05, -3.3);
    for (var r = 0; r < 7; r++) m.box(.7, .06, .06, CHROME, 1.25, -.75 + r * .38, L / 2 + .3);
    m.box(.06, 2.6, .06, CHROME, .95, .4, L / 2 + .3).box(.06, 2.6, .06, CHROME, 1.55, .4, L / 2 + .3);
    // avant : pare-brise, calandre, pare-chocs, enseigne
    var fz = -L / 2 - .16;
    m.box(W - .5, 1.05, .07, GLASS, 0, .7, fz).box(.12, 1.1, .1, CREAM, 0, .7, fz - .02)
      .box(2.3, .62, .1, CHROME, 0, -.42, fz - .02);
    for (var gs = 0; gs < 5; gs++) m.box(2.1, .05, .12, DARK, 0, -.64 + gs * .11, fz - .05);
    m.box(W + .14, .3, .34, CHROME, 0, -1.08, fz - .12).box(W + .1, .08, .36, DARK, 0, -1.25, fz - .1)
      .box(.5, .5, .2, CHROME, -1.65, -.35, fz - .02).box(.5, .5, .2, CHROME, 1.65, -.35, fz - .02)
      .box(.14, .12, .5, DARK, -2.55, .95, -4.25).box(.14, .12, .5, DARK, 2.55, .95, -4.25)
      .box(.06, .55, .06, DARK, -2.5, .78, -4.3, 0, 0, .4).box(.06, .55, .06, DARK, 2.5, .78, -4.3, 0, 0, -.4);
    // arrière : vitre, feux, pare-chocs, tuyères
    var rz = L / 2 + .16;
    m.box(W - 1.2, .8, .07, GLASS, -.2, .75, rz).box(W + .14, .3, .34, CHROME, 0, -1.08, rz + .12)
      .box(.35, .5, .12, RED, -2.0, -.35, rz).box(.35, .5, .12, RED, 2.0, -.35, rz);
    // galerie de toit chargée
    var ry = 1.78;
    for (var sx2 = -1; sx2 <= 1; sx2 += 2) m.box(.08, .08, L - 1.2, CHROME, sx2 * 1.9, ry + .22, 0);
    for (var rz2 = -4; rz2 <= 4; rz2 += 2) m.box(3.9, .06, .08, CHROME, 0, ry + .22, rz2).box(.08, .25, .08, CHROME, -1.9, ry + .08, rz2).box(.08, .25, .08, CHROME, 1.9, ry + .08, rz2);
    m.box(1.3, .8, 1.1, WOOD, -1.1, ry + .62, -2.6).box(1.32, .08, 1.12, '#6e4626', -1.1, ry + .9, -2.6)
      .box(1.0, .6, 1.4, '#c8462f', .9, ry + .52, -2.3).box(.2, .12, .5, DARK, .9, ry + .86, -2.3)
      .box(1.6, .7, 1.0, '#4f8b56', .2, ry + .57, .2).box(1.0, .5, .8, '#e2c06a', -1.0, ry + .47, 2.4)
      .add(new T.TorusGeometry(.62, .2, 8, 18), DARK, 1.0, ry + .45, 2.8, Math.PI / 2, 0, 0)
      .cyl(.3, .3, .32, CHROME, 1.0, ry + .45, 2.8, 12);
    // roues
    for (var ws = -1; ws <= 1; ws += 2) for (var wz2 = -3.35; wz2 <= 3.4; wz2 += 6.7) {
      m.cyl(.68, .68, .5, DARK, ws * (W / 2 - .05), -1.2, wz2, 20, 0, Math.PI / 2)
        .cyl(.36, .36, .54, CHROME, ws * (W / 2 - .05), -1.2, wz2, 16, 0, Math.PI / 2)
        .cyl(.12, .12, .58, GOLD, ws * (W / 2 - .05), -1.2, wz2, 10, 0, Math.PI / 2);
    }
    var detailMesh = m.mesh(); g.add(detailMesh);
    // enseigne lumineuse
    var sign = new T.Mesh(new T.PlaneGeometry(2.6, .42), new T.MeshBasicMaterial({ map: signTex() }));
    sign.position.set(0, 1.42, fz - .06); sign.rotation.y = Math.PI; g.add(sign);
    // phares (lentilles animées par la vue)
    var headlights = [];
    for (var hx = -1.65; hx <= 1.66; hx += 3.3) {
      var lamp = new T.Mesh(new T.CircleGeometry(.2, 20), new T.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: .92, depthWrite: false, side: T.DoubleSide }));
      lamp.position.set(hx, -.35, fz - .14); g.add(lamp); headlights.push(lamp);
    }
    // vitres éclairées de l'intérieur (animées par la vue)
    var cabinPanes = [], paneGeo = new T.PlaneGeometry(1.2, .78);
    for (var pz = -3.33; pz <= 4.0; pz += 1.43) for (var px = -1; px <= 1; px += 2) {
      var pane = new T.Mesh(paneGeo, new T.MeshBasicMaterial({ color: '#9fe7ff', transparent: true, opacity: .35, depthWrite: false }));
      pane.position.set(px * (W / 2 + .12), .7, pz); pane.rotation.y = px < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(pane); cabinPanes.push(pane);
    }
    // turbines carénées (rotors animés par la vue)
    var turbines = [], navLights = [];
    for (var tx = -1; tx <= 1; tx += 2) for (var tz = -1; tz <= 1; tz += 2) {
      var tb = new T.Group(); tb.position.set(tx * 3.35, .45, tz * 2.9);
      tb.add(new Model().add(new T.TorusGeometry(.66, .16, 10, 22), NAVY, 0, 0, 0, 0, Math.PI / 2, 0)
        .add(new T.CylinderGeometry(.66, .66, .5, 22, 1, true), '#22303f', 0, 0, 0, 0, 0, Math.PI / 2)
        .box(1.0, .14, .14, CHROME, -tx * .6, 0, 0).box(.14, .9, .14, CHROME, -tx * 1.0, -.35, 0)
        .ball(.16, GOLD, 0, 0, 0, 1.6, 1, 1, 1).mesh());
      var glowRing = new T.Mesh(new T.TorusGeometry(.5, .04, 6, 22), new T.MeshBasicMaterial({ color: '#7ff3ff' })); glowRing.rotation.y = Math.PI / 2; glowRing.position.x = tx * .27; tb.add(glowRing);
      var rotor = new T.Group(); rotor.rotation.y = Math.PI / 2; rotor.position.x = tx * .05;
      var blades = new Model().cyl(.12, .12, .12, GOLD, 0, 0, 0, 10, Math.PI / 2);
      for (var bl = 0; bl < 7; bl++) blades.box(.14, .5, .035, '#e7f4f6', Math.sin(bl * Math.PI * 2 / 7) * .27, Math.cos(bl * Math.PI * 2 / 7) * .27, 0, 0, 0, -bl * Math.PI * 2 / 7 + .25);
      rotor.add(blades.mesh()); tb.add(rotor); g.add(tb); turbines.push(rotor);
      if (tz < 0) { var nl = new T.Mesh(new T.SphereGeometry(.12, 8, 6), new T.MeshBasicMaterial({ color: tx < 0 ? '#ff7b6b' : '#6df0ee' })); nl.position.set(tx * 4.15, .45, tz * 2.9); g.add(nl); navLights.push(nl); }
    }
    // tuyères arrière (lampes animées par la vue)
    var thrusters = [];
    for (var nx = -1.4; nx <= 1.41; nx += 2.8) {
      g.add(new Model().cyl(.34, .46, .55, '#2b3542', nx, -.62, rz + .3, 16, Math.PI / 2).mesh());
      var tl = new T.Mesh(new T.CylinderGeometry(.24, .3, .2, 14), new T.MeshBasicMaterial({ color: '#8df6ff' }));
      tl.rotation.x = Math.PI / 2; tl.position.set(nx, -.62, rz + .55); g.add(tl); thrusters.push(tl);
    }
    // cœur d'énergie sous le car (animé par la vue)
    var energyCore = new T.Group(); energyCore.position.set(0, -1.9, 0);
    var coreRing = new T.Mesh(new T.TorusGeometry(.72, .09, 8, 28), new T.MeshBasicMaterial({ color: '#77f6ee' })); coreRing.rotation.x = Math.PI / 2;
    var coreOrb = new T.Mesh(new T.IcosahedronGeometry(.36, 1), new T.MeshBasicMaterial({ color: '#fff0a8' })); energyCore.add(coreRing, coreOrb); g.add(energyCore);
    var interior = new T.Group(); interior.visible = false;
    var seats = new Model(); for (var sz = -3.4; sz <= 3.4; sz += 1.35) for (var sx3 = -1; sx3 <= 1; sx3 += 2) seats.box(.72, .42, .55, '#d49b63', sx3 * 1.15, -.25, sz).box(.72, .08, .55, '#f1d59a', sx3 * 1.15, .01, sz);
    interior.add(seats.mesh()); g.add(interior);

    // ---------------------------------------------------------------- ballon
    var balloon = new T.Group();
    var prof = [], N = 26;
    for (var k = 0; k <= N; k++) {
      var u = k / N, yb = 7.2 + u * 15.2, rr;
      if (u < .18) rr = 1.25 + (u / .18) * 2.4;
      else if (u < .62) { var q = (u - .18) / .44; rr = 3.65 + Math.sin(q * Math.PI / 2) * 3.75; }
      else { var q2 = (u - .62) / .38; rr = 7.4 * Math.sqrt(Math.max(0, 1 - q2 * q2 * .98)); }
      prof.push(new T.Vector2(Math.max(.02, rr), yb));
    }
    var env = new T.LatheGeometry(prof, 32).toNonIndexed(); env.computeVertexNormals();
    var ep = env.attributes.position, ec = new Float32Array(ep.count * 3), c1 = new T.Color(TEAL), c2 = new T.Color(CREAM), cg = new T.Color(GOLD), cn = new T.Color(NAVY); var bT = new T.Color(B_TEAL), bT2 = new T.Color(B_TEAL2), bW = new T.Color(B_WHITE), bY = new T.Color(B_YELLOW), bS = new T.Color(B_SEAM);
    for (var f = 0; f < ep.count; f += 3) {
      var mx = (ep.getX(f) + ep.getX(f + 1) + ep.getX(f + 2)) / 3, my = (ep.getY(f) + ep.getY(f + 1) + ep.getY(f + 2)) / 3, mz = (ep.getZ(f) + ep.getZ(f + 1) + ep.getZ(f + 2)) / 3;
      var ang = Math.atan2(mz, mx), gore = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2;
      var cc = my > 21.5 ? bY : (my > 12.9 && my < 13.35) ? bS : my > 13.35 ? (gore ? bT : bT2) : my > 8.7 ? bW : (gore ? bT : bT2); /* v92 : turquoise en haut, blanc en bas, couronne jaune */
      for (var vv = 0; vv < 3; vv++) { ec[(f + vv) * 3] = cc.r; ec[(f + vv) * 3 + 1] = cc.g; ec[(f + vv) * 3 + 2] = cc.b; }
    }
    env.setAttribute('color', new T.BufferAttribute(ec, 3));
    var envMesh = new T.Mesh(env, std('#ffffff', { vc: true, r: .55 })); envMesh.castShadow = true; balloon.add(envMesh);
    // emblèmes boussole sur les deux flancs
    var emb = emblemTex();
    for (var es = -1; es <= 1; es += 2) {
      var disc = new T.Mesh(new T.CircleGeometry(2.1, 32), new T.MeshStandardMaterial({ map: emb, roughness: .6, transparent: true }));
      disc.position.set(es * 7.42, 15.4, 0); disc.rotation.y = es * Math.PI / 2; disc.visible = false; /* v92 : ballon uni comme la référence */ balloon.add(disc);
    }
    // gouvernes de queue, anneau de charge, jupe, brûleur, gréement
    var fin = new T.Shape(); fin.moveTo(0, 0); fin.lineTo(3.6, .6); fin.lineTo(3.9, 2.8); fin.lineTo(.4, 1.6); fin.closePath();
    var finGeo = new T.ExtrudeGeometry(fin, { depth: .16, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 1 });
    var bm = new Model();
    bm.add(new T.TorusGeometry(1.55, .12, 8, 28), GOLD, 0, 7.05, 0, Math.PI / 2, 0, 0)
      .cyl(1.3, 1.0, .9, NAVY, 0, 6.6, 0, 20)
      .cyl(.55, .7, .5, '#2b3542', 0, 6.0, 0, 14)
      .cyl(1.9, 1.9, .18, GOLD, 0, 22.3, 0, 22);
    var ropes = [[-2.1, 1.9, -4.6], [2.1, 1.9, -4.6], [-2.1, 1.9, 4.6], [2.1, 1.9, 4.6], [-2.3, 1.9, 0], [2.3, 1.9, 0]];
    ropes.forEach(function (p) {
      var a0 = new T.Vector3(p[0], p[1], p[2]), ang2 = Math.atan2(p[2], p[0]), b0 = new T.Vector3(Math.cos(ang2) * 1.55, 7.05, Math.sin(ang2) * 1.55);
      var d = b0.clone().sub(a0), len = d.length(), mid = a0.clone().add(b0).multiplyScalar(.5);
      var cylg = new T.CylinderGeometry(.035, .035, len, 5); var qq = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      cylg.applyQuaternion(qq); bm.add(cylg, '#d9cfb8', mid.x, mid.y, mid.z);
    });
    balloon.add(bm.mesh());
    var burner = new T.Mesh(new T.ConeGeometry(.42, 1.2, 12, 1, true), new T.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: .75, blending: T.AdditiveBlending, depthWrite: false }));
    burner.position.set(0, 7.0, 0); balloon.add(burner);
    g.add(balloon);

    g.userData.balloon = balloon; g.userData.body = body; g.userData.thrusters = thrusters; g.userData.turbines = turbines;
    g.userData.cabinPanes = cabinPanes; g.userData.navLights = navLights; g.userData.headlights = headlights; g.userData.energyCore = energyCore;
    g.userData.interior = interior; g.userData.baseY = 0; g.userData.burner = burner;
    g.scale.setScalar(2.7);
    g.userData.modelVersion = '2.0.0'; g.userData.cameraTarget = [0, 26, 0]; g.userData.cameraRadius = 86; g.userData.cameraRadiusPortrait = 106;
    g.traverse(function (o) { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
    g.updateMatrixWorld(true);
    return g;
  }
  A.aircraft = function () { try { return aircraft(); } catch (e) { console.error('[AZUR bus82]', e); return previous.apply(this, arguments); } };
})(window);
