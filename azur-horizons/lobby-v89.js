/* AZUR v89 — SALON retravaillé (« Le Dernier Horizon », 2e version).
 *  - éclairage de studio sur le personnage : lumière principale chaude,
 *    remplissage froid, deux contre-jours (cyan et rose) qui détachent la
 *    silhouette du ciel ;
 *  - podium refait : disque gravé à l'emblème AZUR, anneau lumineux animé,
 *    halo au sol et ombre de contact sous le personnage ;
 *  - météorite figée retravaillée : vraie traînée de feu (dégradé), cœur
 *    incandescent, fumée et bulle de temps qui ondule ;
 *  - l'île prend vie : touffes d'herbe et fleurs (un seul appel de rendu
 *    chacune), pétales et lucioles qui dérivent, rayons du soleil couchant ;
 *  - cadrage plus serré sur le personnage (géré dans graphics-v200-world). */
(function (root) {
  'use strict';
  var T = root.THREE, V = root.AZView && root.AZView.View && root.AZView.View.prototype;
  if (!T || !V || !V.drawMenu) return;
  var rnd = (function () { var s = 8989; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; })();

  function canvasTex(w, h, draw) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; }
  function star4(g, x, y, r, col, rot) { g.save(); g.translate(x, y); g.rotate(rot || 0); g.fillStyle = col; g.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * .3 : r; g.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr); } g.closePath(); g.fill(); g.restore(); }

  function padTexture() {
    return canvasTex(512, 512, function (g, w) {
      var c = w / 2;
      var gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, '#2f3570'); gr.addColorStop(.7, '#232856'); gr.addColorStop(1, '#171a3c');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(120,210,255,.35)'; g.lineWidth = 2;
      [.94, .8, .62].forEach(function (k) { g.beginPath(); g.arc(c, c, c * k, 0, Math.PI * 2); g.stroke(); });
      for (var i = 0; i < 72; i++) { var a = i / 72 * Math.PI * 2, r0 = c * (i % 6 ? .88 : .84), r1 = c * .92; g.strokeStyle = i % 6 ? 'rgba(120,210,255,.3)' : 'rgba(255,210,90,.8)'; g.lineWidth = i % 6 ? 2 : 4; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke(); }
      for (i = 0; i < 4; i++) { var b = i * Math.PI / 2 + Math.PI / 4; g.fillStyle = 'rgba(255,210,90,.75)'; g.beginPath(); g.arc(c + Math.cos(b) * c * .71, c + Math.sin(b) * c * .71, 7, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = .16; star4(g, c, c, c * .55, '#7fe9ff'); g.globalAlpha = .22; star4(g, c, c, c * .25, '#ffd25a', Math.PI / 4); g.globalAlpha = 1;
    });
  }
  function glowTex(inner, outer) {
    return canvasTex(128, 128, function (g, w) { var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  }
  function streakTex() {
    return canvasTex(256, 64, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.08, 'rgba(255,220,140,.95)'); gr.addColorStop(.3, 'rgba(255,130,50,.7)'); gr.addColorStop(.65, 'rgba(220,70,60,.3)'); gr.addColorStop(1, 'rgba(120,40,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var mask = g.createLinearGradient(0, 0, 0, h); mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(.5, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = mask; g.fillRect(0, 0, w, h);
    });
  }
  function ringTex() {
    return canvasTex(512, 32, function (g, w, h) { for (var i = 0; i < 24; i++) { var x = i / 24 * w; g.fillStyle = i % 3 ? 'rgba(111,246,255,.85)' : 'rgba(255,210,90,.95)'; g.fillRect(x + 4, 4, w / 24 - 10, h - 8); } });
  }
  function bladeGeometry() {
    // touffe : trois lames effilées croisées
    var pos = [], col = [], c0 = new T.Color('#3f8f3a'), c1 = new T.Color('#9be06a');
    for (var k = 0; k < 3; k++) {
      var a = k * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a), lean = (k - 1) * .18;
      var w = .06, h = .34 + k * .05;
      var p = [[-w * ca, 0, -w * sa], [w * ca, 0, w * sa], [lean * sa, h, -lean * ca]];
      p.forEach(function (q, i) { pos.push(q[0], q[1], q[2]); var c = i === 2 ? c1 : c0; col.push(c.r, c.g, c.b); });
    }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }

  function upgrade(view) {
    var L = view.v2Lobby, x = L && L.v66, scene = view.menuScene;
    if (!x || L.v89) return;
    var up = L.v89 = { t0: 0 };
    // ---------------------------------------------------------------- lumières
    scene.traverse(function (o) {
      if (o.isHemisphereLight) o.intensity = 1.0;
      else if (o.isSpotLight) o.intensity *= .8;
    });
    var keyL = new T.DirectionalLight('#ffe4c8', 1.5); keyL.position.set(3.2, 4.5, 6.5); keyL.target.position.set(0, 1.1, 0); scene.add(keyL, keyL.target);
    var fill = new T.DirectionalLight('#9fb8ff', .55); fill.position.set(-4, 1.6, 5); fill.target.position.set(0, 1, 0); scene.add(fill, fill.target);
    var rimC = new T.DirectionalLight('#7ff0ff', 2.6); rimC.position.set(-4.5, 3.6, -5); rimC.target.position.set(0, 1.2, 0); scene.add(rimC, rimC.target);
    var rimP = new T.DirectionalLight('#ff86c8', 1.5); rimP.position.set(4.8, 3.2, -4.2); rimP.target.position.set(0, 1.2, 0); scene.add(rimP, rimP.target);
    up.lights = { keyL: keyL, rimC: rimC, rimP: rimP };
    // ---------------------------------------------------------------- podium
    var pad = new T.Group(); L.root.add(pad); up.pad = pad;
    var top = new T.Mesh(new T.CircleGeometry(1.79, 64), new T.MeshStandardMaterial({ map: padTexture(), roughness: .35, metalness: .45, emissive: '#2a3a7a', emissiveIntensity: .35 }));
    top.rotation.x = -Math.PI / 2; top.position.y = .279; pad.add(top);
    var ringMat = new T.MeshBasicMaterial({ map: ringTex(), transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide });
    ringMat.map.wrapS = T.RepeatWrapping;
    var band = new T.Mesh(new T.CylinderGeometry(2.08, 2.08, .07, 72, 1, true), ringMat); band.position.y = .16; pad.add(band); up.band = band;
    var halo = new T.Mesh(new T.RingGeometry(2.1, 3.4, 72), new T.MeshBasicMaterial({ color: '#6ff6ff', transparent: true, opacity: .16, depthWrite: false, blending: T.AdditiveBlending }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = .02; pad.add(halo); up.halo = halo;
    var shadow = new T.Mesh(new T.CircleGeometry(.75, 40), new T.MeshBasicMaterial({ map: glowTex('rgba(0,0,0,.75)', 'rgba(0,0,0,.35)'), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, .283, .08); shadow.scale.set(1, .8, 1); pad.add(shadow);
    // colonne de lumière douce derrière le personnage
    var shaft = new T.Mesh(new T.PlaneGeometry(3.4, 9), new T.MeshBasicMaterial({ map: canvasTex(64, 256, function (g, w, h) { var gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,230,190,.55)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); var gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); }),
      transparent: true, opacity: .32, depthWrite: false, blending: T.AdditiveBlending }));
    shaft.position.set(0, 4.3, -1.6); pad.add(shaft); up.shaft = shaft;
    if (L.beam) L.beam.visible = false;
    // ---------------------------------------------------------------- météorite figée
    if (x.tail) x.tail.visible = false;
    // plus loin et plus haut : elle ne se coupe plus sous la barre du haut ; roche plus sombre aux fissures incandescentes
    x.meteor.position.set(-26, 17.5, -64); x.meteor.scale.setScalar(.8);
    x.meteor.children.forEach(function (c) { if (c.isMesh && c.material && c.material.emissive && !c.material.transparent) { c.material.color.set('#3a2b27'); c.material.emissive.set('#ff5418'); c.material.emissiveIntensity = .32; c.material.flatShading = false; c.material.needsUpdate = true; c.geometry.computeVertexNormals(); } });
    var trail = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: streakTex(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide, toneMapped: false }));
    trail.geometry.translate(.5, 0, 0); trail.scale.set(46, 9, 1); trail.rotation.set(0, 0, .62); x.meteor.add(trail); up.trail = trail;
    var trail2 = trail.clone(); trail2.material = trail.material.clone(); trail2.material.opacity = .55; trail2.scale.set(30, 15, 1); trail2.rotation.z = .66; x.meteor.add(trail2); up.trail2 = trail2;
    var core = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,250,220,1)', 'rgba(255,150,60,.55)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, toneMapped: false })); core.scale.setScalar(13); x.meteor.add(core); up.core = core;
    var smokeMat = new T.SpriteMaterial({ map: glowTex('rgba(150,90,130,.55)', 'rgba(120,70,110,.25)'), transparent: true, depthWrite: false, fog: false });
    up.smoke = [];
    for (var i = 0; i < 9; i++) { var sp = new T.Sprite(smokeMat); var d = 6 + i * 4.2; sp.position.set(Math.cos(.62) * d, Math.sin(.62) * d, -2); sp.scale.setScalar(7 + i * 1.6); x.meteor.add(sp); up.smoke.push(sp); }
    // ---------------------------------------------------------------- herbe et fleurs
    var island = L.root.children.find(function (c) { return c.isGroup && c !== pad && c.children.length > 10; });
    var parent = island || L.root;
    var blades = new T.InstancedMesh(bladeGeometry(), new T.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: T.DoubleSide }), 520);
    var dmy = new T.Object3D(), n = 0;
    while (n < 520) {
      var a = rnd() * Math.PI * 2, r = 2.45 + Math.pow(rnd(), .8) * 6.6, px = Math.cos(a) * r, pz = Math.sin(a) * r;
      if (pz > 1.8 && Math.abs(px) < 5.5) continue; // le devant (vers la caméra) reste dégagé
      dmy.position.set(px, 0, pz); dmy.rotation.set(0, rnd() * 6.28, 0); var s2 = .38 + rnd() * .45; dmy.scale.set(s2, s2 * (.8 + rnd() * .6), s2); dmy.updateMatrix(); blades.setMatrixAt(n++, dmy.matrix);
    }
    blades.instanceMatrix.needsUpdate = true; parent.add(blades); up.blades = blades;
    var fg = new T.CircleGeometry(.055, 5); fg.rotateX(-Math.PI / 2);
    var flowers = new T.InstancedMesh(fg, new T.MeshStandardMaterial({ roughness: .7, side: T.DoubleSide, emissive: '#2a1420', emissiveIntensity: .25 }), 70), fc = ['#fff4c2', '#ffd75a', '#ffffff', '#ffb3cf'];
    for (i = 0; i < 70; i++) {
      var a2 = rnd() * Math.PI * 2, r2 = 2.6 + rnd() * 6.2, fx = Math.cos(a2) * r2, fz = Math.sin(a2) * r2; if (fz > 1.8 && Math.abs(fx) < 5.5) fz = -fz;
      dmy.position.set(fx, .1 + rnd() * .12, fz); dmy.rotation.set((rnd() - .5) * .4, rnd() * 6, (rnd() - .5) * .4); dmy.scale.setScalar(.7 + rnd() * .7); dmy.updateMatrix(); flowers.setMatrixAt(i, dmy.matrix); flowers.setColorAt(i, new T.Color(fc[i % fc.length]));
    }
    flowers.instanceMatrix.needsUpdate = true; if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true; parent.add(flowers);
    // pétales qui dérivent
    var petals = new T.InstancedMesh(new T.PlaneGeometry(.07, .045), new T.MeshBasicMaterial({ color: '#ffc4dc', transparent: true, opacity: .85, side: T.DoubleSide, depthWrite: false }), 40);
    up.petals = []; for (i = 0; i < 40; i++) up.petals.push({ x: (rnd() - .5) * 12, y: rnd() * 5, z: -6 + rnd() * 9, s: .3 + rnd() * .5, ph: rnd() * 6.28 });
    L.root.add(petals); up.petalMesh = petals;
  }

  var prev = V.drawMenu;
  V.drawMenu = function (world, player, dt, options) {
    if (this.v2Lobby && this.v2Lobby.v66 && !this.v2Lobby.v89) { try { upgrade(this); } catch (e) { console.error('[AZUR salon v89]', e); if (this.v2Lobby) this.v2Lobby.v89 = { failed: true }; } }
    var up = this.v2Lobby && this.v2Lobby.v89, t = this.time || 0;
    if (up && !up.failed) {
      if (up.band) up.band.material.map.offset.x = (t * .05) % 1;
      if (up.halo) up.halo.material.opacity = .13 + Math.sin(t * 1.6) * .04;
      if (up.shaft) up.shaft.material.opacity = .26 + Math.sin(t * .8) * .05;
      if (up.core) up.core.material.opacity = .85 + Math.sin(t * 3.1) * .12;
      if (up.trail) { up.trail.scale.x = 46 + Math.sin(t * 2.3) * 1.5; up.trail2.material.opacity = .45 + Math.sin(t * 1.7) * .1; }
      if (up.smoke) up.smoke.forEach(function (s, i) { s.material.rotation = t * .05 + i; });
      if (up.petalMesh) {
        var d = up._d || (up._d = new T.Object3D());
        up.petals.forEach(function (p, i) {
          var yy = ((p.y - t * p.s * .35) % 5 + 5) % 5;
          d.position.set((((p.x + 6 + t * .25) % 12) + 12) % 12 - 6 + Math.sin(t * .7 + p.ph) * .6, yy + .2, p.z + Math.cos(t * .5 + p.ph) * .4);
          d.rotation.set(t * 1.3 + p.ph, t * .9 + i, t * .7); d.updateMatrix(); up.petalMesh.setMatrixAt(i, d.matrix);
        });
        up.petalMesh.instanceMatrix.needsUpdate = true;
      }
    }
    return prev.call(this, world, player, dt, options);
  };
})(window);
