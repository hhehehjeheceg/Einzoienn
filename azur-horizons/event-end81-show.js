/* AZUR v81 — THE END, refonte complète · le spectacle.
 * Chaque élément de la vidéo de référence, à la seconde près (horloge vidéo
 * E.tVideo : 0 = premier nuage de fumée, 303 = trou noir seul) :
 *   0-33   base de lancement (dépôt, tour, fusée), fumée, décollage, colonne
 *   20-60  faille « méduse », éclair sphérique, anneaux, rayon, aurores
 *   54-117 fusées des failles (traînées), météorite fumante, portail arc-en-ciel
 *   118-157 météorite chargée d'énergie, boucles, impact, sol brûlé
 *   158-183 ciel noir, étoile-faille au zénith, lasers rouges, dôme du Point Zéro
 *   183-223 bulle d'onde de choc, ciel rouge, sphère bleue, météorite + escorte,
 *           plongée des fusées dans le dôme, chute de la météorite
 *   223-254 explosion, rayons, espace, tourbillon qui aspire l'île, flash
 *   254-303 noir, point lumineux, trou noir.
 * Tout est une fonction déterministe du temps : on peut rejoindre l'événement
 * en cours de route, tout est déjà à sa place. Le joueur reste libre. */
(function (root) {
  'use strict';
  var E = root.AZEvent, T = root.THREE, L = root.AZEnd81;
  if (!E || !T || !L || !E.register) return;
  var U = L.u, cl = U.cl, sm = U.sm, ramp = U.ramp, win = U.win, lerp = U.lerp, hsh = U.hsh;
  var D2R = Math.PI / 180, UP = new T.Vector3(0, 1, 0);
  var api = null, G = null, view = null, grp = null, X = null, O = {}, on = false, low = false, built = false;
  var P = new T.Vector3(), BASE = new T.Vector3(), F = new T.Vector3(), R = new T.Vector3();
  var ZP = new T.Vector3(), IMPACT = new T.Vector3(), STAR = new T.Vector3(), MOON = new T.Vector3();
  var MET_A = new T.Vector3(), MET_A2 = new T.Vector3(), MET_B = new T.Vector3(), MDIR = new T.Vector3();
  var SPOT = { px: -515, pz: -135, bx: -540, bz: -255 };
  /* v85 — disposition mesurée image par image sur la vidéo (caméra Fortnite = 80° horizontal) :
   * depuis la colline, le dépôt est droit devant (lacet 0), la lune 35,8° à droite et 25° de haut,
   * la météorite 71° à droite et 6° de haut, l'impact au sol 62° à droite à ~300 m.
   * L'île flottante est à 46° à droite de la météorite dans la vidéo ; ici on la décale un peu pour
   * ne pas la cacher derrière le dôme du Point Zéro (centre de la carte, 116,5° à droite). */
  var LAY = { moon: [35.8, 25], met: [71, 6, 560], isl: [92, 8, 760], imp: [67, 500] }; // impact : au sol JUSTE SOUS la météorite (vidéo), visible par-dessus le bord du plateau
  var HEMI_BR = new T.Color(.55, .85, 1);
  var tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3(), camPos = new T.Vector3(), camFwd = new T.Vector3();
  var RIFTS = [], TRAILS = [], FLASHES = [], BOOMS = [], STRIKES = [], frame = 0, lastT = -999;
  L.S = { P: P, BASE: BASE, F: F, R: R, ZP: ZP, IMPACT: IMPACT, STAR: STAR };

  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 20; } }
  function dirYP(yaw, pitch, out) {
    yaw *= D2R; pitch *= D2R; var h = Math.cos(pitch);
    return (out || new T.Vector3()).copy(F).multiplyScalar(Math.cos(yaw) * h).addScaledVector(R, Math.sin(yaw) * h).addScaledVector(UP, Math.sin(pitch));
  }
  function skyPos(yaw, pitch, dist, out) { out = out || new T.Vector3(); dirYP(yaw, pitch, out).multiplyScalar(dist); out.x += P.x; out.y += P.y + 1.7; out.z += P.z; return out; }
  function sp(a) { return a.isVector3 ? a.clone() : skyPos(a[0], a[1], a[2]); }
  L.skyPos = skyPos;

  /* =============================================================== construction */
  function mat(c, o) { o = o || {}; var m = new T.MeshStandardMaterial({ color: c, roughness: o.r == null ? .8 : o.r, metalness: o.m || 0, flatShading: !!o.flat }); if (o.e) { m.emissive = new T.Color(o.e); m.emissiveIntensity = o.ei || 1; } return m; }
  function box(parent, w, h, d, m, x, y, z, ry) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (ry) b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; }
  /* tôle striée (plateforme de la vidéo B) : losanges en relief, joints de panneaux sombres */
  function diamondPlate() {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    g.fillStyle = '#8f9bad'; g.fillRect(0, 0, 128, 128);
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var cx = x * 16 + 8, cy = y * 16 + 8, a = (x + y) % 2 ? .785 : -.785;
      g.save(); g.translate(cx + .8, cy + .8); g.rotate(a); g.fillStyle = 'rgba(70,80,96,.75)'; g.beginPath(); g.ellipse(0, 0, 5.4, 1.5, 0, 0, 6.283); g.fill(); g.restore();
      g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = 'rgba(214,222,232,.9)'; g.beginPath(); g.ellipse(0, 0, 5.2, 1.3, 0, 0, 6.283); g.fill(); g.restore();
    }
    g.strokeStyle = 'rgba(40,46,58,.9)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  /* Base de lancement : fusée sombre, tour rouge en treillis, trois entrepôts bleus. */
  function buildBase() {
    var g = new T.Group(); g.name = 'end81-base';
    g.position.copy(BASE); g.rotation.y = Math.atan2(-F.x, -F.z); // +z local = vers le joueur, +x = droite
    var concrete = mat(0x6d7684, { r: .95 }), red = mat(0xc8402e, { r: .6, m: .3 }), steel = mat(0x8a96a8, { r: .5, m: .5 });
    var pad = new T.Mesh(new T.CylinderGeometry(15, 17, 2.2, 28), concrete); pad.position.y = -.4; pad.receiveShadow = true; g.add(pad);
    var ring = new T.Mesh(new T.TorusGeometry(10.5, .35, 6, 40), mat(0xe8c54a, { r: .6 })); ring.rotation.x = Math.PI / 2; ring.position.y = .75; g.add(ring);
    // tour en treillis
    var tw = new T.Group(); tw.position.set(-6.2, 0, 0); g.add(tw);
    for (var i = 0; i < 4; i++) { var leg = new T.Mesh(new T.BoxGeometry(.55, 34, .55), red); leg.position.set((i % 2 ? 1.6 : -1.6), 17, (i > 1 ? 1.6 : -1.6)); leg.castShadow = true; tw.add(leg); }
    for (var j = 0; j < 11; j++) {
      var y = 2 + j * 3;
      [[0, 1.6, 3.4, .25, .25], [0, -1.6, 3.4, .25, .25], [1.6, 0, .25, .25, 3.4], [-1.6, 0, .25, .25, 3.4]].forEach(function (b) { box(tw, b[2], b[3], b[4], red, b[0], y, b[1]); });
      var dg = new T.Mesh(new T.BoxGeometry(.2, 4.4, .2), red); dg.position.set(0, y + 1.5, 1.6); dg.rotation.z = (j % 2 ? .78 : -.78); tw.add(dg);
      var dg2 = dg.clone(); dg2.position.z = -1.6; tw.add(dg2);
    }
    box(tw, 5.5, .4, 4.2, steel, 2, 24, 0); box(tw, 5.5, .4, 4.2, steel, 2, 14, 0); // bras de service
    var beacon = L.sprite(tw, X.glow, 0xff4030, 3, true, .9); beacon.position.set(0, 34.6, 0); O.beacon = beacon;
    // entrepôts : murs bleus, toits blancs à deux pans, portes roulantes
    var blue = mat(0x2f6fd6, { r: .75 }), roof = mat(0xdfe6ee, { r: .7 }), door = mat(0x9aa8bb, { r: .6, m: .3 }), trim = mat(0x1d3d78, { r: .8 });
    function hangar(x, z, ry, L2, W, Hh) {
      var h = new T.Group(); h.position.set(x, 0, z); h.rotation.y = ry; g.add(h);
      box(h, W, Hh, L2, blue, 0, Hh / 2 - .6, 0);
      var shape = new T.Shape(); shape.moveTo(-W / 2 - .6, 0); shape.lineTo(0, W * .32); shape.lineTo(W / 2 + .6, 0); shape.lineTo(-W / 2 - .6, 0);
      var rg = new T.ExtrudeGeometry(shape, { depth: L2 + 1.2, bevelEnabled: false }); rg.translate(0, 0, -(L2 + 1.2) / 2);
      var rf = new T.Mesh(rg, roof); rf.position.y = Hh - .6; rf.castShadow = true; h.add(rf);
      box(h, W * .62, Hh * .7, .3, door, 0, Hh * .35 - .6, L2 / 2 + .1); box(h, W * .62, Hh * .7, .3, door, 0, Hh * .35 - .6, -L2 / 2 - .1);
      for (var s = -2; s <= 2; s++) box(h, .25, Hh, .25, trim, W / 2 + .05, Hh / 2 - .6, s * L2 / 5);
      for (var s2 = -2; s2 <= 2; s2++) box(h, .25, Hh, .25, trim, -W / 2 - .05, Hh / 2 - .6, s2 * L2 / 5);
      var lamp = L.sprite(h, X.glow, 0xffd59a, 2.2, true, .8); lamp.position.set(0, Hh * .8, L2 / 2 + .8);
      return h;
    }
    hangar(16, 26, .55, 30, 13, 9.5); hangar(35, 12, .55, 30, 13, 9.5); hangar(28, 46, .55, 26, 12, 8.5);
    // citernes et caisses
    var tank = mat(0xd9dee6, { r: .5, m: .4 });
    [[-22, 10], [-26, 18]].forEach(function (p) { var c = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 9, 18), tank); c.position.set(p[0], 4, p[1]); c.castShadow = true; g.add(c); });
    for (var k = 0; k < 6; k++) box(g, 2.4, 2.4, 4.8, mat([0xd8613a, 0x3b7bd8, 0xe0b23a][k % 3], { r: .7 }), -14 + k * 2.8, 1.1, 34 + (k % 2) * 3, .1);
    // projecteurs
    O.padLight = new T.PointLight(0xffb070, 0, 260, 1.4); O.padLight.position.set(0, 6, 0); g.add(O.padLight);
    // sol bétonné qui suit le terrain (dalle légère sous le dépôt)
    var slab = new T.Mesh(new T.PlaneGeometry(90, 90, 18, 18), mat(0x5d6672, { r: 1 }));
    slab.rotation.x = -Math.PI / 2; slab.position.set(14, .02, 22); slab.receiveShadow = true; g.add(slab);
    // v85 — détails de la base vus dans les vidéos : gyrophares rouges et feux jaune-orangé, manche à air
    O.beacons = [];
    [[-13.9, 1.95, -8.3, 0xff2a20], [13.9, 1.95, -8.3, 0xff2a20], [-13.2, 1.95, 9.4, 0xffb21e], [13.2, 1.95, 9.4, 0xffb21e], [16, 10.5, 26, 0xff2a20], [35, 10.5, 12, 0xffb21e], [-6.2, 35.6, 0, 0xff2a20], [0, 1.95, -16.2, 0xffb21e]].forEach(function (b, i) {
      var cap = new T.Mesh(new T.CylinderGeometry(.55, .65, .9, 12), mat(b[3], { r: .3, e: b[3], ei: 1.2 })); cap.position.set(b[0], b[1] + .45, b[2]); g.add(cap);
      var gl = L.sprite(g, X.glow, b[3], 7, true, 0); gl.position.set(b[0], b[1] + .6, b[2]); O.beacons.push({ s: gl, cap: cap, ph: i * 1.3, red: b[3] === 0xff2a20 });
    });
    var pole = new T.Mesh(new T.CylinderGeometry(.12, .16, 7, 8), steel); pole.position.set(38, 13.5, 4); g.add(pole);
    var sockGeo = new T.CylinderGeometry(.75, .3, 3.6, 12, 6, true); sockGeo.rotateZ(Math.PI / 2); sockGeo.translate(1.8, 0, 0);
    var sc = document.createElement('canvas'); sc.width = 128; sc.height = 16; var sg = sc.getContext('2d'); for (var q = 0; q < 5; q++) { sg.fillStyle = q % 2 ? '#f4f4f4' : '#e8352a'; sg.fillRect(q * 25.6, 0, 25.6, 16); }
    var stex = new T.CanvasTexture(sc); stex.colorSpace = T.SRGBColorSpace;
    O.sock = new T.Mesh(sockGeo, new T.MeshStandardMaterial({ map: stex, roughness: .8, side: T.DoubleSide })); O.sock.position.set(38, 16.8, 4); g.add(O.sock);
    O.sockGeo0 = Float32Array.from(sockGeo.attributes.position.array);
    // faisceau de lumière orange qui monte de la base (vidéo A)
    var bc = document.createElement('canvas'); bc.width = 4; bc.height = 256; var bg = bc.getContext('2d'), gr = bg.createLinearGradient(0, 256, 0, 0);
    gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(.06, 'rgba(255,170,70,.9)'); gr.addColorStop(.4, 'rgba(255,140,50,.45)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    bg.fillStyle = gr; bg.fillRect(0, 0, 4, 256); var btex = new T.CanvasTexture(bc); btex.colorSpace = T.SRGBColorSpace;
    var beamGeo = new T.CylinderGeometry(2.2, 3.4, 1, 16, 1, true); beamGeo.translate(0, .5, 0);
    O.baseBeam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ map: btex, color: 0xffffff, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    // il sort du sommet de la fusée (vidéo A, 0-9 s) puis reste planté sur le pas de tir après le décollage
    O.baseBeam.material.toneMapped = false; O.baseBeam.position.set(0, .5, 0); O.baseBeam.scale.set(.6, 720, .6); O.baseBeam.frustumCulled = false; g.add(O.baseBeam);
    O.baseBeamCore = new T.Mesh(beamGeo, O.baseBeam.material.clone()); O.baseBeamCore.material.color.setHex(0xfff0c8); O.baseBeamCore.scale.set(.2, 640, .2); O.baseBeamCore.position.copy(O.baseBeam.position); O.baseBeamCore.frustumCulled = false; g.add(O.baseBeamCore);
    O.baseBeamGlow = L.sprite(g, X.soft, 0xffa040, 40, true, .6); O.baseBeamGlow.position.set(0, 3, 0);
    // projecteur blanc qui balaie le ciel depuis le haut de la tour (vidéo B, compte à rebours)
    var sgeo = new T.CylinderGeometry(.6, 9, 1, 14, 1, true); sgeo.translate(0, .5, 0);
    var stx = document.createElement('canvas'); stx.width = 4; stx.height = 128; var sx = stx.getContext('2d'), sgr = sx.createLinearGradient(0, 128, 0, 0);
    sgr.addColorStop(0, 'rgba(255,255,255,1)'); sgr.addColorStop(.25, 'rgba(220,235,255,.5)'); sgr.addColorStop(1, 'rgba(200,225,255,0)'); sx.fillStyle = sgr; sx.fillRect(0, 0, 4, 128);
    var stt = new T.CanvasTexture(stx); stt.colorSpace = T.SRGBColorSpace;
    O.search = new T.Mesh(sgeo, new T.MeshBasicMaterial({ map: stt, color: 0xe8f2ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    O.search.material.toneMapped = false; O.search.position.set(-6.2, 35.2, 0); O.search.scale.set(1, 420, 1); O.search.frustumCulled = false; g.add(O.search);
    // plateforme façon vidéo B : tôle striée, garde-corps jaunes (ouverts côté colline)
    var plate = mat(0xffffff, { r: .45, m: .55 }); plate.map = diamondPlate(); plate.map.repeat.set(9, 9);
    pad.material = [concrete, plate, concrete];
    var yel = mat(0xe3d21c, { r: .5, m: .35 }), RR = 16.2, gap = .26, st = Math.PI / 2 + gap;
    [1.25, 1.85].forEach(function (hy) {
      var rg2 = new T.TorusGeometry(RR, .085, 6, 96, Math.PI * 2 - gap * 2); rg2.rotateX(Math.PI / 2); rg2.rotateY(-st);
      var rl = new T.Mesh(rg2, yel); rl.position.y = hy; g.add(rl);
    });
    for (var pp = 0; pp < 30; pp++) {
      var pa2 = st + pp / 29 * (Math.PI * 2 - gap * 2), rpost = new T.Mesh(new T.CylinderGeometry(.08, .08, 1.25, 6), yel);
      rpost.position.set(Math.cos(pa2) * RR, 1.3, Math.sin(pa2) * RR); g.add(rpost);
    }
    // hologramme d'alerte : grand triangle rouge « ! » au-dessus du pas de tir (compte à rebours, vidéo B)
    var hc = document.createElement('canvas'); hc.width = hc.height = 256; var hg = hc.getContext('2d');
    var hr = hg.createRadialGradient(128, 150, 10, 128, 150, 128); hr.addColorStop(0, 'rgba(255,40,40,.55)'); hr.addColorStop(1, 'rgba(255,0,0,0)'); hg.fillStyle = hr; hg.fillRect(0, 0, 256, 256);
    hg.beginPath(); hg.moveTo(128, 30); hg.lineTo(236, 218); hg.lineTo(20, 218); hg.closePath(); hg.fillStyle = 'rgba(255,36,30,.95)'; hg.fill();
    hg.lineWidth = 8; hg.strokeStyle = 'rgba(255,150,140,.9)'; hg.stroke();
    hg.fillStyle = 'rgba(70,0,0,.95)'; hg.fillRect(116, 92, 24, 74); hg.beginPath(); hg.arc(128, 190, 13, 0, 6.3); hg.fill();
    var htex = new T.CanvasTexture(hc); htex.colorSpace = T.SRGBColorSpace;
    O.holo = new T.Sprite(new T.SpriteMaterial({ map: htex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0, fog: false })); O.holo.material.toneMapped = false;
    O.holo.position.set(0, 110, -6); O.holo.scale.setScalar(56); O.holo.frustumCulled = false; g.add(O.holo);
    O.holoGlow = L.sprite(g, X.soft, 0xff2020, 190, true, 0); O.holoGlow.position.set(0, 110, -6);
    grp.add(g); g.updateMatrixWorld(true);
    // la dalle épouse le relief
    var pa = slab.geometry.attributes.position, wp = new T.Vector3();
    for (var v = 0; v < pa.count; v++) { wp.set(pa.getX(v), pa.getY(v), 0); slab.localToWorld(wp); var hy = H(wp.x, wp.z) - BASE.y + .15; pa.setZ(v, hy); }
    pa.needsUpdate = true; slab.geometry.computeVertexNormals();
    O.base = g;
  }

  /* La fusée du lancement (sombre, bandes claires). */
  function bigRocket() {
    var g = new T.Group(), dark = mat(0x2a3140, { r: .55, m: .35 }), white = mat(0xe5e9f0, { r: .5, m: .2 }), black = mat(0x16191f, { r: .6 });
    var body = new T.Mesh(new T.CylinderGeometry(2.2, 2.4, 20, 24), dark); body.position.y = 12; body.castShadow = true; g.add(body);
    var nose = new T.Mesh(new T.ConeGeometry(2.2, 7, 24), white); nose.position.y = 25.5; nose.castShadow = true; g.add(nose);
    [5, 13, 19].forEach(function (y) { var b = new T.Mesh(new T.CylinderGeometry(2.3, 2.3, 1, 24), white); b.position.y = y; g.add(b); });
    for (var k = 0; k < 4; k++) { var fin = new T.Mesh(new T.BoxGeometry(.35, 6, 3.6), black); fin.position.set(Math.cos(k * Math.PI / 2) * 2.7, 4, Math.sin(k * Math.PI / 2) * 2.7); fin.rotation.y = -k * Math.PI / 2; g.add(fin); }
    var noz = new T.Mesh(new T.CylinderGeometry(1.3, 1.9, 2.2, 18), black); noz.position.y = 1; g.add(noz);
    var flame = new T.Mesh(new T.ConeGeometry(2.0, 14, 18, 1, true), new T.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    flame.rotation.x = Math.PI; flame.position.y = -7; g.add(flame); g.userData.flame = flame;
    var core = new T.Mesh(new T.ConeGeometry(1.1, 8, 14, 1, true), new T.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    core.rotation.x = Math.PI; core.position.y = -4; g.add(core); g.userData.core = core;
    g.userData.glow = L.sprite(g, X.glow, 0xffa64a, 60, true, 0); g.userData.glow.position.y = -4;
    g.userData.glow2 = L.sprite(g, X.soft, 0xff7a30, 160, true, 0); g.userData.glow2.position.y = -8;
    return g;
  }

  /* Forêt décorative (instanciée) autour du dépôt + herbes hautes autour de la colline. */
  function buildFlora() {
    var RN = U.rng(812), trunkGeo = new T.CylinderGeometry(.35, .55, 1, 6), canGeo = new T.IcosahedronGeometry(1, 1);
    var n = low ? 110 : 220, trunks = new T.InstancedMesh(trunkGeo, mat(0x4a3526, { r: 1 }), n), cans = new T.InstancedMesh(canGeo, mat(0xffffff, { r: .95, flat: true }), n * 2);
    var dmy = new T.Object3D(), c = new T.Color(), ti = 0, ci = 0, objs = [];
    try { var w = api.world(); objs = (w && w.objects || []).filter(function (o) { return o.type === 'house' && Math.hypot(o.x - BASE.x, o.z - BASE.z) < 420; }); } catch (e) {}
    for (var a = 0; a < n * 6 && ti < n; a++) {
      var ang = RN() * 6.283, rad = 40 + Math.pow(RN(), .7) * 330, x = BASE.x + Math.cos(ang) * rad, z = BASE.z + Math.sin(ang) * rad;
      var toP = Math.hypot(x - P.x, z - P.z); if (toP < 34) continue;
      var lx = (x - BASE.x) * F.x + (z - BASE.z) * F.z, lr = (x - BASE.x) * R.x + (z - BASE.z) * R.z;
      if (lx > -60 && lx < 30 && lr > -40 && lr < 70) continue; // dépôt dégagé
      if (Math.abs(((x - P.x) * R.x + (z - P.z) * R.z)) < 14 && ((x - P.x) * F.x + (z - P.z) * F.z) > 0 && ((x - P.x) * F.x + (z - P.z) * F.z) < 125) continue; // vue dégagée vers la fusée
      var yawP = Math.atan2((x - P.x) * R.x + (z - P.z) * R.z, (x - P.x) * F.x + (z - P.z) * F.z) / D2R;
      if (toP < 60 || (yawP > 15 && yawP < 140)) continue; // v85 : vue dégagée vers la météorite / l'impact (comme la vidéo)
      var blocked = false; for (var q = 0; q < objs.length; q++) if (Math.abs(objs[q].x - x) < 14 && Math.abs(objs[q].z - z) < 14) { blocked = true; break; }
      if (blocked) continue;
      var b = root.AZSim.biomeAt ? root.AZSim.biomeAt(x, z) : 'grass'; if (b === 'water' || b === 'sand') continue;
      var y = H(x, z), s = 3.2 + RN() * 3.4, th = 3 + RN() * 3;
      dmy.position.set(x, y + th / 2, z); dmy.scale.set(s * .18, th, s * .18); dmy.rotation.set(0, RN() * 6, 0); dmy.updateMatrix(); trunks.setMatrixAt(ti++, dmy.matrix);
      for (var bl = 0; bl < 2 && ci < n * 2; bl++) {
        dmy.position.set(x + (RN() - .5) * s * .5, y + th + s * (.55 + bl * .45), z + (RN() - .5) * s * .5); dmy.scale.set(s * (1 - bl * .25), s * (.8 - bl * .15), s * (1 - bl * .25)); dmy.rotation.set(RN(), RN() * 6, RN()); dmy.updateMatrix();
        cans.setMatrixAt(ci, dmy.matrix); c.setHSL(.29 + RN() * .07, .55 + RN() * .2, .26 + RN() * .12); cans.setColorAt(ci, c); ci++;
      }
    }
    trunks.count = ti; cans.count = ci; trunks.castShadow = cans.castShadow = true; trunks.receiveShadow = cans.receiveShadow = true;
    if (cans.instanceColor) cans.instanceColor.needsUpdate = true;
    grp.add(trunks); grp.add(cans); O.trees = [trunks, cans];
    // herbes hautes (lames instanciées, vent) autour de la colline du joueur
    var bladeGeo = new T.BufferGeometry();
    bladeGeo.setAttribute('position', new T.Float32BufferAttribute([-.045, 0, 0, .045, 0, 0, .0, 1, 0, -.035, 0, 0, .035, 0, 0, .05, .82, .06], 3));
    bladeGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, .5, 1, 0, 0, 1, 0, .5, 1], 2));
    var gn = low ? 7000 : 22000, grass = new T.InstancedMesh(bladeGeo, new T.ShaderMaterial({
      side: T.DoubleSide, fog: true, lights: false,
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { time: { value: 0 }, tint: { value: new T.Color(1, 1, 1) }, center: { value: new T.Vector3() } }]),
      vertexShader: '#include <fog_pars_vertex>\nuniform float time;uniform vec3 center;varying float vH;varying float vF;varying vec3 vW;void main(){vec4 w=instanceMatrix*vec4(position,1.);vec3 a=instanceMatrix[3].xyz;float sw=sin(time*1.6+a.x*.21+a.z*.17)*.35+sin(time*2.7+a.x*.5)*.12;w.x+=sw*position.y*.5;w.z+=sw*position.y*.3;vH=position.y;vW=a;vF=1.-smoothstep(52.,68.,length(a.xz-center.xz));vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: '#include <fog_pars_fragment>\nuniform vec3 tint;varying float vH;varying float vF;varying vec3 vW;void main(){if(vF<.02)discard;float n=fract(sin(dot(floor(vW.xz*.7),vec2(12.9,78.2)))*43758.5);vec3 base=mix(vec3(.03,.14,.05),vec3(.05,.22,.08),n);vec3 tip=mix(vec3(.16,.62,.18),vec3(.24,.78,.26),n);vec3 c=mix(base,tip,smoothstep(.0,1.,vH))*tint;gl_FragColor=vec4(c,1.);\n#include <fog_fragment>\n}'
    }), gn);
    var gi = 0;
    for (var a2 = 0; a2 < gn * 2 && gi < gn; a2++) {
      var rr = Math.sqrt(RN()) * 66, aa = RN() * 6.283, gx = P.x + Math.cos(aa) * rr, gz = P.z + Math.sin(aa) * rr;
      var bb = root.AZSim.biomeAt ? root.AZSim.biomeAt(gx, gz) : 'grass'; if (bb === 'water' || bb === 'sand' || bb === 'snow') continue;
      var hgt = .32 + RN() * .45;
      dmy.position.set(gx, H(gx, gz) - .05, gz); dmy.rotation.set((RN() - .5) * .35, RN() * 6.283, (RN() - .5) * .35); dmy.scale.set(1 + RN() * .6, hgt, 1); dmy.updateMatrix();
      grass.setMatrixAt(gi++, dmy.matrix);
    }
    grass.count = gi; grass.frustumCulled = false; grass.material.uniforms.center.value.copy(P); grp.add(grass); O.grass = grass;
  }

  /* Fissures de lave sur les pentes du volcan derrière le dépôt. */
  function buildLava() {
    O.lava = [];
    if (root.AZSim && root.AZSim.s8) return; // v94 : la vraie coulée du volcan est sur la carte
    var paths = [[[150, -40], [175, -25], [190, -38], [215, -20]], [[200, 20], [222, 34], [240, 22], [262, 40]], [[260, -60], [280, -48], [292, -66]], [[120, 60], [138, 74], [150, 64]]];
    paths.forEach(function (pp, idx) {
      var pts = pp.map(function (q) { var x = BASE.x + F.x * q[0] + R.x * q[1], z = BASE.z + F.z * q[0] + R.z * q[1]; return new T.Vector3(x, H(x, z) + .6, z); });
      var curve = new T.CatmullRomCurve3(pts), seg = 40, pos = [], uv = [], ix = [], p = new T.Vector3(), tg = new T.Vector3(), side = new T.Vector3();
      for (var i = 0; i <= seg; i++) {
        var u = i / seg; curve.getPointAt(u, p); curve.getTangentAt(u, tg); side.crossVectors(tg, UP).normalize().multiplyScalar(1.3);
        var a = p.clone().add(side), b = p.clone().sub(side); a.y = H(a.x, a.z) + .7; b.y = H(b.x, b.z) + .7;
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(u, 0, u, 1);
        if (i < seg) { var k = i * 2; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(ix);
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: X.lava, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, color: 0xff8a50, side: T.DoubleSide }));
      m.material.toneMapped = false; grp.add(m);
      var glow = L.sprite(grp, X.soft, 0xff6a20, 60, true, .5); curve.getPointAt(.5, glow.position); glow.position.y += 6;
      O.lava.push({ mesh: m, glow: glow, seed: idx });
    });
  }

  /* Ciel nocturne, étoiles, lune. */
  function buildSky() {
    O.sky = new T.Mesh(new T.SphereGeometry(3000, 32, 16), L.skyMaterial()); O.sky.renderOrder = -10; O.sky.frustumCulled = false; grp.add(O.sky);
    O.stars = L.starField(low ? 1500 : 2800, 2900, 7); grp.add(O.stars);
    O.stars2 = L.starField(low ? 1200 : 2600, 2900, 19); O.stars2.material.uniforms.amt.value = 0; grp.add(O.stars2); // ciel d'espace
    skyPos(LAY.moon[0], LAY.moon[1], 2500, MOON);
    O.moon = L.sprite(grp, X.moon, 0xffffff, 300, true, 1); O.moonHalo = L.sprite(grp, X.soft, 0x5fc4ff, 1500, true, .55);
    O.sky.material.uniforms.moonDir.value.copy(dirYP(LAY.moon[0], LAY.moon[1]));
  }

  /* =============================================================== failles */
  function addRift(pos, size, a, b, opts) {
    opts = opts || {};
    var sd = opts.seed || (RIFTS.length * 1.73 + .4);
    var m = new T.Mesh(new T.PlaneGeometry(1, 1), opts.wing && L.wingMaterial ? L.wingMaterial(sd, opts.droop || 0, opts.nw || 3) : L.riftMaterial(sd, opts.narrow));
    m.frustumCulled = false; m.visible = false; m.renderOrder = 4; grp.add(m);
    var r = { m: m, pos: pos.clone(), size: size, a: a, b: b, fi: opts.fi || 1.2, fo: opts.fo || 1.5, flash: opts.flash || null, curl: opts.curl == null ? 1 : opts.curl, grow: opts.grow || null, op: opts.op || 1, cap: !!opts.cap };
    m.material.uniforms.curl.value = r.curl;
    RIFTS.push(r); return r;
  }
  function updateRifts(t, cam) {
    for (var i = 0; i < RIFTS.length; i++) {
      var r = RIFTS[i], op = win(t, r.a, r.b, r.fi, r.fo) * r.op;
      r.m.visible = op > .004; if (!r.m.visible) continue;
      r.m.position.copy(r.pos); if (r.cap) r.m.position.add(MOFF); r.m.quaternion.copy(cam.quaternion);
      var open = ramp(t, r.a, r.a + r.fi * 1.6), fl = 0;
      if (r.flash) for (var f = 0; f < r.flash.length; f++) fl = Math.max(fl, win(t, r.flash[f], r.flash[f] + 1.2, .12, .9));
      var gs = r.grow ? lerp(r.grow[2], 1, ramp(t, r.grow[0], r.grow[1])) : 1;
      var dc = r.pos.distanceTo(cam.position); r.m.scale.setScalar(Math.min(r.size, dc * .5) * (.55 + .45 * open) * (1 + .15 * fl) * gs);
      var u = r.m.material.uniforms; u.time.value = t; u.open.value = .25 + .75 * open; u.amt.value = op * (.85 + .15 * Math.sin(t * 7 + i)); u.flash.value = fl;
    }
  }

  /* ============================================================ traînées */
  /* v89 : trajectoire HORODATÉE — chaque point [t, lacet, tangage, distance] est un passage relevé sur la vidéo :
   * la tête y passe exactement à cet instant (accélérations et ralentissements compris). */
  function arcFracs(curve, n) {
    var div = 600, Ls = curve.getLengths(div), tot = Ls[div] || 1, out = [];
    for (var i = 0; i < n; i++) { var f = i / (n - 1) * div, i0 = Math.floor(f), i1 = Math.min(div, i0 + 1); out.push((Ls[i0] + (Ls[i1] - Ls[i0]) * (f - i0)) / tot); }
    return out;
  }
  function keyK(tr, t) {
    var tp = tr.spec.tp, fr = tr.fr, n = tp.length;
    if (t <= tp[0]) return 0; if (t >= tp[n - 1]) return 1;
    for (var i = 0; i < n - 1; i++) if (t < tp[i + 1]) { var u = (t - tp[i]) / (tp[i + 1] - tp[i]); u = u * u * (3 - 2 * u) * .25 + u * .75; return fr[i] + (fr[i + 1] - fr[i]) * u; }
    return 1;
  }
  // v93 : la fin d'une trajectoire est-elle déjà dans la faille de l'île (122° ; 28°) ?
  function near122(p) { return O.b3p && p.distanceTo(O.b3p) < 60; }
  function addTrail(spec) {
    if (spec.path) { spec.tp = spec.path.map(function (q) { return q[0]; }); spec.pts = spec.path.map(function (q) { return [q[1], q[2], q[3]]; }); spec.a = spec.tp[0]; spec.b = spec.tp[spec.tp.length - 1]; }
    var pts = spec.pts.map(sp);
    var near = pts.some(function (p) { return p.distanceTo(P) < 700; });
    var tr = new L.Trail(grp, pts, (spec.radius || 3) * 1.45, spec.col || 0x79c4ff, spec.core || 0xffffff, X.star, { headSize: (spec.headSize || 70) * 1.5, headColor: 0xd8f2ff, rocket: near ? (L.models ? L.models.riftRocket(X, 1.5) : L.riftRocket(1.6)) : null, grow: spec.grow, segs: spec.segs || 120 });
    tr.spec = spec; TRAILS.push(tr);
    if (spec.tp) tr.fr = arcFracs(tr.curve, pts.length);
    var p0 = pts[0], p1 = pts[pts.length - 1];
    if (spec.exit) addRift(p0, Math.max(70, p0.distanceTo(P) * .13), spec.a - 1.3, spec.a + 1.4, { fi: .6, fo: 1, flash: [spec.a - .2], curl: 1.4, narrow: true });
    if (!spec.entry && !spec.flashEnd && !spec.cap && !spec.noEntry && !near122(p1)) spec.entry = true; // v93 : jamais de disparition sans faille
    if (spec.entry) addRift(p1, Math.max(70, p1.distanceTo(P) * .13), spec.b - 1.5, spec.b + 1.3, { fi: .7, fo: .9, flash: [spec.b - .1], curl: 1.4, narrow: true });
    if (spec.flashEnd) FLASHES.push({ pos: p1, t: spec.b, size: spec.flashSize || 260 });
    if ((spec.flashEnd && !spec.cap && !spec.noBoom) || spec.boom) addBoom(p1, spec.b, spec.boomSize || 1, H(p1.x, p1.z) > p1.y - 25);
    return tr;
  }
  function updateTrails(t) {
    for (var i = 0; i < TRAILS.length; i++) {
      var tr = TRAILS[i], s = tr.spec, k = (t - s.a) / (s.b - s.a), fade = s.fade || 1.6;
      if (t < s.a - .1 || t > s.b + fade + .2) { if (tr.mesh.visible) tr.set(0, 0, 0, t); continue; }
      var alpha = (k > 0 ? 1 : 0) * (1 - ramp(t, s.b, s.b + fade)) * (s.alpha || 1);
      if (s.cap) tr.off = MOFF;
      if (s.tp) { var kk = keyK(tr, t), ln = s.tail ? Math.max(.015, kk - keyK(tr, t - s.tail)) : (s.len || .5); if (t > s.b) ln = s.tail ? Math.max(.015, 1 - keyK(tr, Math.min(s.b, t - s.tail))) : ln; tr.set(kk, ln, alpha, t); }
      else tr.set(cl(k) * 1.0, s.len || .5, alpha, t);
      if (k >= 1 && tr.rocket) tr.rocket.visible = false;
      if (tr === O.rA && tr.head) { E.anchors = E.anchors || {}; E.anchors.rA = tr.head.position; }
    }
    for (var f = 0; f < FLASHES.length; f++) {
      var fl = FLASHES[f], s2 = O.flashPool[f % O.flashPool.length], op = win(t, fl.t - .05, fl.t + .9, .08, .7);
      if (op > .003) { s2.position.copy(fl.pos); s2.scale.setScalar(fl.size * .55 * (1 + .6 * ramp(t, fl.t, fl.t + .6))); L.setOp(s2, op * .75); s2.userData.used = frame; }
      else if (s2.userData.used !== frame) L.setOp(s2, 0);
    }
  }
  /* ================================================ v93 : explosions et villes frappées */
  /* Chaque fusée qui se brise explose : boule de feu, cœur blanc, onde au sol, débris qui retombent,
   * fumée qui monte. Trois fusées sortent d'une faille et piquent sur trois villes visibles depuis la
   * colline : les maisons touchées sont détruites (simulation) et brûlent jusqu'à la fin. */
  var boomGeo = null, boomMat = null, ringGeo = null, RUBBLE = null;
  function addBoom(pos, t, size, ground) {
    if (!grp) return null;
    if (!boomGeo) { boomGeo = new T.IcosahedronGeometry(1, 0); boomMat = mat(0x2b2523, { r: 1, flat: true }); ringGeo = new T.RingGeometry(.86, 1, 64, 1); }
    var b = { pos: pos.clone(), t: t, k: size || 1, ground: !!ground, seed: BOOMS.length * 7.3 + 1 };
    b.fire = L.sprite(grp, X.soft, 0xff7a2a, 60, true, 0); b.core = L.sprite(grp, X.glow, 0xfff0c8, 40, true, 0);
    b.fire.position.copy(b.pos); b.core.position.copy(b.pos);
    var n = low ? 8 : 14; b.deb = new T.InstancedMesh(boomGeo, boomMat, n); b.deb.visible = false; b.deb.frustumCulled = false; grp.add(b.deb);
    b.v = []; for (var i = 0; i < n; i++) { var a = hsh(b.seed + i) * 6.283, up = .4 + hsh(b.seed + i * 3) * .9, sp = (18 + hsh(b.seed + i * 5) * 26) * b.k; b.v.push([Math.cos(a) * sp, up * sp * (ground ? 1.3 : .8), Math.sin(a) * sp, .5 + hsh(b.seed + i * 7) * 1.4]); }
    if (ground) { b.ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide })); b.ring.rotation.x = -Math.PI / 2; b.ring.position.set(b.pos.x, H(b.pos.x, b.pos.z) + 1.5, b.pos.z); b.ring.visible = false; b.ring.frustumCulled = false; grp.add(b.ring); }
    BOOMS.push(b); return b;
  }
  var dm4 = new T.Object3D();
  function updateBooms(t) {
    var sys = O.smoke;
    for (var i = 0; i < BOOMS.length; i++) {
      var b = BOOMS[i], age = t - b.t, k = b.k, on = age > 0 && age < 14 && t < 223.4;
      if (!on) { if (b.deb.visible) { b.deb.visible = false; L.setOp(b.fire, 0); L.setOp(b.core, 0); if (b.ring) b.ring.visible = false; } continue; }
      var fb = 1 - ramp(age, .25, 2.6);
      L.setOp(b.fire, fb * .95); b.fire.scale.setScalar((40 + 150 * U.easeOut(cl(age / .7))) * k); b.fire.material.color.setRGB(1, .45 + .3 * (1 - cl(age)), .16);
      L.setOp(b.core, (1 - ramp(age, .05, .9)) * 1); b.core.scale.setScalar((30 + 90 * cl(age / .3)) * k);
      if (b.ring) { var rk = cl(age / 1.5); b.ring.visible = rk < 1; b.ring.material.opacity = (1 - rk) * .75; b.ring.scale.setScalar((6 + 170 * U.easeOut(rk)) * k); }
      // débris balistiques
      var gy = b.ground ? H(b.pos.x, b.pos.z) : -1e9; b.deb.visible = age < 5;
      if (b.deb.visible) for (var j = 0; j < b.v.length; j++) {
        var v = b.v[j], x = b.pos.x + v[0] * age, z = b.pos.z + v[2] * age, y = Math.max(gy + .5, b.pos.y + v[1] * age - 11 * age * age);
        dm4.position.set(x, y, z); dm4.rotation.set(age * 3 + j, age * 2 + j * .7, 0); dm4.scale.setScalar(v[3] * k * (1 - ramp(age, 3.5, 5))); dm4.updateMatrix(); b.deb.setMatrixAt(j, dm4.matrix);
      }
      if (b.deb.visible) b.deb.instanceMatrix.needsUpdate = true;
      // fumée : panache sombre qui monte et s'élargit
      if (sys) for (var p = 0; p < 10; p++) {
        var u = p / 9, pa = age - u * 1.4; if (pa < 0) continue;
        var rise = (8 + 34 * u) * Math.min(pa, 6) * .5 * k, spread = (6 + 26 * u) * k, a2 = hsh(b.seed + p) * 6.283;
        var al = cl(pa * 2) * (1 - ramp(age, 8, 14)) * .75;
        sys.add(b.pos.x + Math.cos(a2) * spread * .5, b.pos.y + rise + 4, b.pos.z + Math.sin(a2) * spread * .5, (24 + 30 * u + pa * 6) * k, .22, .2, .22, al, a2 + t * .05, p % 4, 0, (1 - cl(pa / 1.5)) * .9);
      }
    }
    // maisons en feu dans les villes frappées
    for (var s2 = 0; s2 < STRIKES.length; s2++) {
      var S2 = STRIKES[s2];
      if (t >= S2.t && !S2.done) { S2.done = true; destroyTown(S2); }
      if (!S2.done || !S2.fires) continue;
      var fa = t - S2.t, burn = fa > 0 && t < 223.4;
      for (var h = 0; h < S2.fires.length; h++) {
        var F2 = S2.fires[h], fl = .75 + .25 * Math.sin(t * (9 + h) + h * 2);
        L.setOp(F2.s, burn ? .7 * fl * cl(fa) : 0); F2.s.scale.setScalar(F2.size * (1 + .15 * Math.sin(t * 7 + h)));
        if (burn && sys && h < 8) for (var q = 0; q < 3; q++) { var qa = ((t * .6 + q / 3 + h * .13) % 1); sys.add(F2.x + Math.sin(h + q) * 3, F2.y + 4 + qa * 46, F2.z + Math.cos(h * 2 + q) * 3, 12 + qa * 26, .2, .19, .21, (1 - qa) * .55, h + q, q % 4, 0, (1 - qa) * .4); }
      }
    }
  }
  function yawOf(x, z) { var dx = x - P.x, dz = z - P.z; return Math.atan2(dx * R.x + dz * R.z, dx * F.x + dz * F.z) / D2R; }
  function buildStrikes() {
    var w = null; try { w = api.world(); } catch (e) {} if (!w || !w.objects) return;
    var cells = {};
    w.objects.forEach(function (o) {
      if (o.type !== 'house' || o.dead) return; var d = Math.hypot(o.x - P.x, o.z - P.z); if (d < 250 || d > 820) return;
      var y = yawOf(o.x, o.z), zy = yawOf(ZP.x, ZP.z), zd = Math.hypot(ZP.x - P.x, ZP.z - P.z);
      if (y < -75 || y > 150 || Math.hypot(o.x - ZP.x, o.z - ZP.z) < 260) return; // pas les tours décoratives du Point Zéro
      if (Math.abs(y - zy) < 16 && d > zd - 120) return; // ni une ville cachée derrière la bulle
      var key = Math.round(o.x / 90) + ',' + Math.round(o.z / 90); (cells[key] = cells[key] || []).push(o);
    });
    var list = Object.keys(cells).map(function (k) { return cells[k]; }).filter(function (c) { return c.length >= 2; }).sort(function (a, b) { return b.length - a.length; });
    var picks = [];
    for (var i = 0; i < list.length && picks.length < 3; i++) {
      var c = list[i], cx = 0, cz = 0; c.forEach(function (o) { cx += o.x; cz += o.z; }); cx /= c.length; cz /= c.length;
      var y = yawOf(cx, cz); if (picks.some(function (p) { return Math.abs(p.yaw - y) < 32; })) continue;
      picks.push({ x: cx, z: cz, yaw: y, d: Math.hypot(cx - P.x, cz - P.z), houses: c });
    }
    var TIMES = [97.6, 105.2, 113.9];
    picks.forEach(function (p, i) {
      var tI = TIMES[i], gy = H(p.x, p.z), gp = Math.atan2(gy + 3 - (P.y + 1.7), p.d) / D2R, side = i % 2 ? 1 : -1;
      addTrail({ path: [[tI - 3.0, p.yaw - 28 * side, 50, 1000], [tI - 1.7, p.yaw - 12 * side, 30, p.d * .95 + 40], [tI - .7, p.yaw - 3 * side, 12, p.d], [tI, p.yaw, gp, p.d]], tail: 1.4, radius: 3.4, exit: true, noEntry: true });
      var tgt = new T.Vector3(p.x, gy + 3, p.z);
      addBoom(tgt, tI, 2.1, true);
      STRIKES.push({ t: tI, x: p.x, z: p.z, houses: p.houses, done: false, fires: null });
    });
    E.v93strikes = STRIKES;
  }
  function destroyTown(S2) {
    var w = null; try { w = api.world(); } catch (e) {}
    S2.fires = [];
    S2.houses.forEach(function (o) {
      if (Math.hypot(o.x - S2.x, o.z - S2.z) > 70) return;
      try { if (w && w._damageHit && !o.dead) w._damageHit({ object: o }, null, 1e6, o.x, o.y + 2, o.z); else o.dead = true; } catch (e) { o.dead = true; }
      var gy = H(o.x, o.z), fs = L.sprite(grp, X.soft, 0xff6a20, 30, true, 0); fs.position.set(o.x, gy + 5, o.z);
      S2.fires.push({ s: fs, x: o.x, y: gy, z: o.z, size: 26 + (o.w || 6) * 2.2 });
      // décombres : tas de gravats sombres à la place de la maison
      for (var r2 = 0; r2 < 3; r2++) {
        var rb = new T.Mesh(boomGeo || new T.IcosahedronGeometry(1, 0), RUBBLE || (RUBBLE = mat(0x3a3330, { r: 1, flat: true })));
        var sw = (o.w || 6) * (.55 - r2 * .12), sd = (o.d || o.w || 6) * (.5 - r2 * .1);
        rb.scale.set(sw, 1.4 + r2 * .5, sd); rb.position.set(o.x + (hsh(r2 + o.x) - .5) * sw, gy + .4, o.z + (hsh(r2 * 3 + o.z) - .5) * sd); rb.rotation.y = hsh(o.x + r2) * 6;
        grp.add(rb);
      }
    });
  }
  function buildTrails() {
    var Y = function (a, b, c) { return [a, b, c]; };
    /* v85 — trajectoires relevées seconde par seconde sur la vidéo de référence (46 → 126 s).
     * Lacet : 0 = le dépôt, + = vers la droite (lune 36°, météorite 71°, île ~117° dans la vidéo). */
    // 53,9 → 62,4 (MESURÉ toutes les 0,25 s, caméra reconstituée par gyroscope visuel) : UNE fusée sort de l'étoile au cône
    // de lumière derrière le joueur, tombe presque à la verticale, vire au ras de l'horizon (59 s), balaie tout l'horizon
    // vers la gauche en passant à ~110 m devant le joueur (60,5 s) et file exploser au loin sur le « boum » (62,38 s)
    O.rA = addTrail({ path: [[53.9, -170, 47, 1300], [54.6, -172.5, 43, 1250], [55.6, -173, 38.8, 1150], [56.6, -174, 31.5, 1000], [57.25, -174.3, 26, 900], [57.75, -174.3, 17.8, 780],
      [58.25, -176.4, 12.8, 680], [58.75, -178.6, 6.8, 580], [59.0, 180, 6.0, 520], [59.25, 175.8, 4.8, 440], [59.5, 171.5, 4.8, 380], [59.75, 162.9, 5.0, 300], [60.0, 149.9, 6.3, 210],
      [60.25, 123.7, 8.8, 135], [60.5, 93.8, 10, 112], [60.75, 66.9, 8.2, 140], [61.0, 53.7, 6.6, 190], [61.25, 45, 5.3, 240], [61.5, 40.2, 4.3, 290], [61.75, 36.6, 3.3, 340], [62.0, 33.6, 2.5, 385], [62.38, 31.3, 1.8, 430]],
      tail: 1.6, radius: 3.4, exit: true, boom: true, noEntry: true, boomSize: 1.3 }); // v93 : elle explose au loin (« boum » de 62,4 s)
    /* v89 — relevé image par image sur la vidéo (caméra recalée sur la lune et la météorite, champ 80°) :
     * chaque point = [instant, lacet, tangage, distance]. Les failles-méduses sont à (46,59) (110,56) (76,46) (96,43). */
    // 64,9 → 66,1 (MESURÉ) : passage EN RASE-MOTTE : elle tombe du ciel derrière le joueur à droite (crochet vers 203°),
    // file vers la gauche à ~50 m au-dessus de lui (65,4-65,7 s) et plonge vers la météorite (66 s)
    addTrail({ path: [[64.9, 212, 30, 260], [65.15, 204, 12, 150], [65.3, 185, 10, 80], [65.4, 160.5, 10.6, 55], [65.55, 148, 12, 46], [65.7, 128, 17, 50], [65.8, 108, 20, 90], [65.9, 72, 16, 260], [66.1, 68.6, 9, 420]], tail: 1.3, radius: 2.9, exit: true, entry: true });
    // 66,85 → 72,8 (MESURÉ) : elle jaillit de la faille-méduse de gauche, tombe en biais jusque sous la météorite (68,8 s),
    // fait un crochet et repart vers la gauche à ~28° de hauteur, frôle la lune (71,5 s) et file loin à gauche
    addTrail({ path: [[66.85, 46.5, 58.3, 1150], [67.25, 48.1, 49.3, 1050], [67.5, 55.5, 44.1, 980], [68.0, 60.5, 37.6, 900], [68.75, 63.2, 31.3, 830], [69.0, 62.5, 30.0, 810],
      [69.25, 59.0, 28.7, 790], [69.5, 54.6, 28.1, 770], [69.75, 48.5, 28.1, 760], [70.0, 41.8, 28.8, 750], [70.25, 34.7, 30.1, 750], [71.25, -13.7, 33.5, 780], [71.5, -22.5, 32.5, 790],
      [71.75, -32.4, 31.7, 800], [72.0, -34.2, 30.2, 800], [72.25, -41.3, 27.1, 820], [72.5, -56, 24.9, 860], [72.75, -63.1, 23.6, 900], [73.1, -72, 21, 960]], tail: 1.8, radius: 2.9, entry: true });
    // 67,6 → 71,6 (MESURÉ) : de la faille-méduse de droite, elle file vers la gauche puis descend lentement en biais vers la météorite
    addTrail({ path: [[67.6, 96, 43, 1050], [67.75, 98.4, 41, 1000], [68.0, 87.1, 41, 950], [68.75, 70.7, 27.4, 850], [69.0, 68.8, 25.4, 830], [69.25, 66.9, 23.6, 815], [69.5, 65.9, 22.5, 800],
      [69.75, 63.9, 20.2, 790], [70.0, 63.0, 18.8, 780], [70.5, 59.8, 16.3, 760], [70.75, 59.1, 15.3, 750], [71.0, 57.4, 14.2, 740], [71.25, 57.0, 11.4, 730], [71.6, 55, 7, 700]], tail: 1.3, radius: 2.7, entry: true });
    // 67,75 → 69,45 (MESURÉ) : une petite, basse, qui part du côté de la météorite et monte vers la lune, où elle éclate (69,5 s)
    addTrail({ path: [[67.75, 52, 8, 650], [68.0, 44, 11, 620], [68.25, 36.5, 14.1, 600], [68.5, 36.1, 14.9, 580], [68.75, 34.9, 16.0, 560], [69.0, 35.6, 17.0, 540], [69.45, 37.5, 18.9, 520]], tail: .9, radius: 2.4, flashEnd: true, flashSize: 320 });
    // 69,95 → 71,5 (MESURÉ) : deux fusées tombent des failles de droite et se croisent en X (70,75 s)
    addTrail({ path: [[69.95, 99, 48, 1000], [70.25, 100.9, 27.1, 900], [70.5, 101.6, 24.9, 860], [70.8, 102.8, 21.8, 840], [71.0, 104, 19.5, 830], [71.5, 108, 13, 800]], tail: .9, radius: 2.6, entry: true });
    addTrail({ path: [[69.95, 109.5, 41, 1000], [70.25, 105.8, 28.1, 900], [70.5, 104.2, 24.6, 860], [70.75, 102.7, 22.2, 840], [71.0, 100.6, 19.6, 830], [71.4, 98, 14, 800]], tail: .9, radius: 2.6, entry: true });
    // 71,9 → 73,1 (MESURÉ) : deux fusées tombent à la verticale à gauche, pendant que la grande traînée passe
    addTrail({ path: [[71.9, -62, 33, 800], [72.25, -62, 16.1, 760], [72.5, -62.2, 14.1, 750], [72.85, -62.4, 8, 740]], tail: .8, radius: 2.4, entry: true });
    addTrail({ path: [[72.45, -51, 28, 800], [72.75, -53.8, 13.4, 760], [73.05, -55, 7, 740]], tail: .8, radius: 2.4, entry: true });
    // 72,8 → 75,9 : elle descend de la droite vers la montagne (sphère rouge 75,2, gerbe 76)
    addTrail({ path: [[73.6, 38, 44, 900], [74.4, 18, 30, 520], [75.1, -4, 16, 260], [75.6, -12, 8.5, 150], [75.85, -14, 7, 130]], tail: 1.2, radius: 3.0, exit: true });
    /* v89 — 87 → 111 s RELEVÉ IMAGE PAR IMAGE (caméra reconstituée : gyroscope visuel + lune / feu de la météorite). */
    // 87 → 90,9 : la fusée jaillit du portail, monte vers la droite, passe par-dessus et PLONGE droit sur la météorite
    addTrail({ path: [[87.0, -28, 21, 430], [87.5, -20, 31, 450], [87.9, -10, 43, 480], [88.3, 2, 52, 520], [88.6, 22, 50, 600], [88.9, 45.3, 40.3, 620], [89.4, 61.2, 27.2, 600], [89.9, 66.3, 19.2, 580], [90.4, 68.9, 14.8, 565], [90.9, 70.7, 13.5, 560]], tail: 1.6, radius: 3.2, entry: true, flashEnd: true, flashSize: 300 });
    // 89,3 → 92,4 : un éclat de foudre s'allume à gauche sous la lune (28,9° ; 14°) ; deux fusées en sortent :
    // l'une file droit dans la météorite (92,2 s)…
    O.b4p = skyPos(28.9, 14, 520);
    addTrail({ path: [[90.25, 29, 14.5, 520], [90.6, 41.9, 15.4, 530], [91.0, 49.3, 13, 540], [91.4, 52, 12.3, 545], [91.8, 60.3, 11.4, 550], [92.2, 70.5, 9.4, 560]], tail: 1.2, radius: 2.7, flashEnd: true, flashSize: 180 });
    // …l'autre rase l'horizon vers la droite, remonte en chandelle (92,4 s), passe par-dessus (93,4 s) et redescend vers
    // l'île en croisant la frénésie en X (94,8 s)
    addTrail({ path: [[90.4, 24, 12, 520], [90.8, 28.1, 9.4, 500], [91.2, 36.7, 9.1, 480], [91.6, 42.3, 10.3, 470], [92.0, 49, 13.7, 480], [92.4, 52.7, 23.4, 520], [92.9, 62.7, 35.5, 580],
      [93.4, 93, 43, 650], [93.9, 126, 32.8, 700], [94.4, 138.5, 23.3, 720], [94.6, 142.6, 19.3, 720], [95.0, 152, 14.7, 730], [95.4, 158.8, 14.9, 740], [95.8, 166.4, 11.2, 760], [96.3, 175, 6, 800]], tail: 1.6, radius: 3.0 });
    // 94,2 → 96,6 : la frénésie (mesurée) — la grande descendante de droite qui fait le X avec la précédente…
    addTrail({ path: [[94.2, 168, 32, 720], [94.6, 154.9, 22, 720], [95.0, 142.5, 16.6, 720], [95.4, 135.4, 15.8, 720], [95.8, 129.8, 12.1, 720], [96.2, 125, 6.7, 720], [96.6, 121, 3, 720]], tail: 1.6, radius: 3.0, exit: true });
    // …et les traînées horizontales qui se croisent devant l'île
    addTrail({ path: [[94.0, 100, 19, 750], [94.6, 117.5, 18.1, 750], [95.0, 126.5, 16.7, 750], [95.6, 138, 15, 750], [96.2, 150, 13, 750], [96.8, 160, 12, 750]], tail: 1.2, radius: 2.6, exit: true });
    addTrail({ path: [[94.0, 131, 13, 700], [94.6, 120.1, 12.8, 700], [95.2, 110, 13.5, 700], [95.8, 100, 14, 700], [96.4, 91, 14.5, 700]], tail: 1.1, radius: 2.5, exit: true });
    addTrail({ path: [[94.2, 164, 15, 650], [94.6, 157.1, 10.2, 650], [95.0, 152.3, 7.8, 650], [95.4, 145.9, 9.3, 650], [95.8, 139.9, 9.2, 650], [96.2, 132.3, 6.4, 650], [96.7, 124, 5, 650]], tail: 1.1, radius: 2.5, exit: true });
    addTrail({ path: [[95.0, 170, 20, 800], [95.4, 162, 19.3, 800], [95.8, 155.1, 18.4, 800], [96.2, 148.6, 20.7, 800], [96.8, 140, 21, 800], [97.4, 131, 21, 800]], tail: 1.1, radius: 2.5, exit: true });
    addTrail({ path: [[95.9, 165, 26, 820], [96.5, 150, 24, 820], [97.1, 136, 22, 820], [97.7, 122, 20, 820], [98.3, 108, 18, 820]], tail: 1.1, radius: 2.5, exit: true });
    addTrail({ path: [[96.4, 100, 9, 700], [97.0, 113, 10, 700], [97.6, 126, 12, 700], [98.2, 139, 13, 700], [98.8, 152, 14, 700]], tail: 1.1, radius: 2.5, exit: true });
    // 98,3 → 102,6 : la caméra suit vers la gauche plusieurs fusées qui longent l'horizon de droite à gauche
    addTrail({ path: [[98.3, 131, 14, 750], [98.9, 91, 10.1, 650], [99.5, 62, 9.5, 620], [100.2, 38, 10, 650], [100.9, 18, 11, 720], [101.6, 0, 12, 800]], tail: 1.3, radius: 2.8, exit: true });
    addTrail({ path: [[98.4, 116, 4, 500], [98.9, 99.7, 3.1, 460], [99.4, 92.7, 4.2, 450], [99.9, 84, 6, 450], [100.4, 62, 7.5, 420], [100.9, 52, 8, 430], [101.4, 40, 8.5, 450], [101.9, 18.4, 9.5, 480], [102.4, 0, 10, 520]], tail: 1.3, radius: 2.8, exit: true });
    addTrail({ path: [[98.9, 125, 10, 700], [99.4, 84.2, 9.6, 600], [99.9, 66, 11.5, 600], [100.4, 48.9, 12.8, 600], [101.0, 30, 13, 650], [101.6, 12, 13, 700]], tail: 1.2, radius: 2.6, exit: true });
    addTrail({ path: [[99.3, 30, 12.5, 1100], [99.9, 18.2, 13.1, 1100], [100.4, 13.3, 13.7, 1100], [100.9, 10.9, 13.6, 1100], [101.4, 5.5, 13.7, 1100], [101.9, 2.2, 13.9, 1100], [102.6, -3, 14, 1100]], tail: 1.0, radius: 2.4 });
    // 101,6 → 103,9 : passage RASANT tout près devant le joueur (102,4 s), de droite à gauche
    addTrail({ path: [[101.6, 40, 10, 300], [102.0, 8, 11, 150], [102.4, -33, 12.3, 90], [102.9, -65, 10, 95], [103.4, -90.8, 7.5, 140], [103.9, -105, 6, 240]], tail: 1.4, radius: 3.0, exit: true, entry: true });
    // v93 — 103 → 111,6 (vidéo 108-111 s) : la formation se regroupe. Toutes les fusées partent de la gauche, prennent
    // LA MÊME direction (en montant vers la droite), se rassemblent en haut à droite et plongent ensemble dans la même
    // faille, l'étoile qui éclate au-dessus de l'île (122° ; 28°), juste avant que la faille s'ouvre derrière la météorite.
    addTrail({ path: [[103.0, -100, 16, 900], [104.4, -80, 24, 900], [105.6, -40, 34, 920], [106.8, 10, 44, 940], [108.0, 70, 52, 970], [109.0, 125, 55, 1000], [109.9, 145, 47, 990], [110.5, 132, 36, 965], [111.0, 122.3, 28.4, 950]], tail: 1.4, radius: 2.7, exit: true });
    addTrail({ path: [[103.1, -92, 15, 900], [104.5, -76, 22.5, 900], [105.7, -36, 32.5, 920], [106.9, 13, 42.5, 940], [108.1, 73, 50.5, 970], [109.1, 128, 53.5, 1000], [110.0, 147, 45.5, 990], [110.6, 133, 35, 965], [111.12, 122.5, 28.3, 950]], tail: 1.3, radius: 2.6 });
    addTrail({ path: [[103.9, -5, 21, 900], [105.0, 15, 30, 920], [106.3, 45, 40, 940], [107.6, 85, 50, 970], [108.8, 120, 54, 1000], [109.8, 142, 48, 990], [110.5, 131, 36, 965], [111.2, 122, 28.2, 950]], tail: 1.3, radius: 2.6, exit: true });
    addTrail({ path: [[106.9, -5, 15, 800], [107.7, 30, 28, 860], [108.5, 80, 44, 930], [109.4, 125, 52, 990], [110.1, 140, 45, 985], [110.7, 130, 35, 965], [111.3, 122.4, 28.6, 950]], tail: 1.1, radius: 2.4, exit: true });
    addTrail({ path: [[107.6, 10, 19, 820], [108.4, 50, 34, 880], [109.2, 100, 48, 950], [109.9, 135, 50, 990], [110.5, 136, 40, 975], [111.0, 128, 33, 960], [111.45, 122, 28.3, 950]], tail: 1.0, radius: 2.4, exit: true });
    addTrail({ path: [[107.7, -30, 15, 760], [108.5, 20, 30, 840], [109.3, 75, 46, 920], [110.0, 118, 52, 980], [110.6, 138, 44, 980], [111.1, 129, 34, 960], [111.6, 122.2, 28.5, 950]], tail: 1.0, radius: 2.4 });
    // 108,8 → 111,2 : la grosse fusée (et deux autres dans son sillage) plonge du haut à droite sur l'étoile qui explose
    // au-dessus de l'île (122° ; 28°) à 110,9 s
    addTrail({ path: [[108.8, 158, 52, 1000], [109.6, 145, 43, 980], [110.3, 131, 34, 960], [110.9, 122, 28, 950]], tail: 1.6, radius: 3.6 });
    addTrail({ path: [[109.2, 160, 54, 1000], [110.0, 146, 44, 980], [110.6, 133, 35, 960], [111.15, 122.5, 28.3, 950]], tail: 1.4, radius: 3.0 });
    addTrail({ path: [[109.4, 163, 52, 1000], [110.2, 148, 42, 980], [110.8, 135, 34, 960], [111.3, 122.2, 28.6, 950]], tail: 1.4, radius: 3.0 });
    // 181 → 183 : la fusée remonte le laser rouge jusqu'à l'étoile du zénith (absolu)
    // v85 : elle descend le laser jusqu'au CONTACT avec le sommet du dôme (183 s) : éclat + onde de choc
    var a1 = STAR.clone().add(new T.Vector3(0, -40, 0)), a2 = ZP.clone().lerp(STAR, .45), a3 = ZP.clone().add(new T.Vector3(0, DOME_TOP, 0));
    addTrail({ pts: [a1, a2, a3], a: 180.6, b: 183.0, len: .14, radius: 2.4, headSize: 70, flashEnd: true, flashSize: 300, fade: .5, noBoom: true });
    buildStrikes();
  }

  /* v85 — spirale d'éclats de la vidéo B : lambeaux blanc-lavande déchirés, enroulés en
   * spirale autour du point où la fusée va entrer (vue d'en dessous, 22 → 37 s). */
  function spiralTex() {
    var c = document.createElement('canvas'); c.width = c.height = 512; var g = c.getContext('2d'), R2 = U.rng(4242);
    g.translate(256, 256);
    for (var arm = 0; arm < 3; arm++) for (var j = 0; j < 15; j++) {
      var u = j / 14, rr = 40 + u * 200 + (R2() - .5) * 18, a0 = arm * 2.094 + u * 4.6 + (R2() - .5) * .25, len = .2 + R2() * .35 + u * .2, w = 3 + R2() * 6 * (1 - u * .4);
      g.beginPath(); var n = 9;
      for (var k = 0; k <= n; k++) { var aa = a0 + len * k / n, r3 = rr + k * 3 + (k % 2 ? 4 : -3) * R2(); g.lineTo(Math.cos(aa) * r3, Math.sin(aa) * r3); }
      for (var k2 = n; k2 >= 0; k2--) { var ab = a0 + len * k2 / n, r4 = rr + k2 * 3 + w * Math.sin(k2 / n * Math.PI) + (k2 % 2 ? 3 : -2) * R2(); g.lineTo(Math.cos(ab) * r4, Math.sin(ab) * r4); }
      g.closePath(); g.fillStyle = 'rgba(' + (228 + R2() * 27 | 0) + ',' + (214 + R2() * 30 | 0) + ',255,' + (.75 + R2() * .25).toFixed(2) + ')'; g.fill();
    }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  /* ======================================== éclairs, anneaux, portail, rayon */
  function buildBursts() {
    O.flashPool = []; for (var i = 0; i < 6; i++) O.flashPool.push(L.sprite(grp, X.star, 0xdff3ff, 200, true, 0));
    // v85 — l'énorme explosion de foudre (38,6 s) part exactement du point où la fusée a disparu
    // (vidéo de référence 33-41 s, vidéos A et B : même endroit)
    O.b1p = rocketPos(33.3, new T.Vector3());
    O.b1x = BASE.clone().addScaledVector(UP, 800); // vidéo : explosion à 81° de hauteur vue de la colline, à la verticale du dépôt
    O.sparkPos = O.b1p.clone();
    O.b1Shell = L.sprite(grp, X.shell[0], 0x6f9cff, 800, true, 0); O.b1Bolts = L.sprite(grp, X.burstBig[0], 0x9cc6ff, 900, true, 0); O.b1Core = L.sprite(grp, X.star, 0xffffff, 400, true, 0);
    // le petit point bleu qui reste à l'endroit de l'entrée (34-38,6 s), avec un bout de traînée dessous
    O.spark = L.sprite(grp, X.star, 0xbfe6ff, 60, true, 0); O.sparkHalo = L.sprite(grp, X.soft, 0x3f8cff, 220, true, 0);
    O.sparkTail = new L.Trail(grp, [O.b1p.clone().add(new T.Vector3(0, -22, 0)), O.b1p.clone().add(new T.Vector3(.4, -10, .3)), O.b1p.clone()], .6, 0x7fc8ff, 0xffffff, null, {});
    // spirale d'éclats autour de l'entrée (vidéo B)
    O.spiral = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: spiralTex(), transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false, color: 0xf2eaff }));
    O.spiral.material.toneMapped = false; O.spiral.rotation.x = Math.PI / 2; O.spiral.position.copy(O.b1p).add(new T.Vector3(0, 6, 0)); O.spiral.frustumCulled = false; O.spiral.visible = false; O.spiral.renderOrder = 3; grp.add(O.spiral);
    O.spiralCore = L.sprite(grp, X.soft, 0xff7a3a, 90, true, 0); O.spiralCore.position.copy(O.spiral.position);
    // nuage sombre en volute (35-46)
    O.darkCloud = L.sprite(grp, X.soft, 0x05070f, 900, false, 0); skyPos(-22, 52, 1700, O.darkCloud.position);
    // anneaux bleus (42-47)
    O.ringA = L.sprite(grp, X.ring, 0x7fa8ff, 300, true, 0); skyPos(113, 53, 1300, O.ringA.position);
    O.ringAs = L.sprite(grp, X.star, 0xcfeaff, 160, true, 0); O.ringAs.position.copy(O.ringA.position);
    O.ringB = L.sprite(grp, X.ring, 0x7fa8ff, 160, true, 0); skyPos(52, 57, 1400, O.ringB.position);
    // rayon de lumière sous la faille R2 (46-51)
    O.r2p = skyPos(-170, 48, 1350);
    var cc = document.createElement('canvas'); cc.width = 128; cc.height = 128; var cg = cc.getContext('2d'), R3 = U.rng(77);
    for (var cx = 0; cx < 128; cx++) { var vv = .35 + .65 * Math.pow(R3(), 2); var gr2 = cg.createLinearGradient(0, 128, 0, 0); gr2.addColorStop(0, 'rgba(255,255,255,0)'); gr2.addColorStop(.55, 'rgba(255,255,255,' + (vv * .55).toFixed(2) + ')'); gr2.addColorStop(1, 'rgba(255,255,255,' + vv.toFixed(2) + ')'); cg.fillStyle = gr2; cg.fillRect(cx, 0, 1, 128); }
    var ctex = new T.CanvasTexture(cc); ctex.colorSpace = T.SRGBColorSpace;
    O.beam = new T.Mesh(new T.CylinderGeometry(9, 70, 1, 32, 1, true), new T.MeshBasicMaterial({ map: ctex, color: 0xa8dcff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    O.beam.material.toneMapped = false;
    O.beam.frustumCulled = false; grp.add(O.beam);
    O.r2Glow = L.sprite(grp, X.star, 0xffffff, 300, true, 0); O.r2Glow.position.copy(O.r2p);
    // gerbe proche de la montagne (76-80) + sphère rouge
    O.b2p = skyPos(-14, 7, 130); O.b2hi = skyPos(2, 20, 140);
    O.b2Bolts = L.sprite(grp, X.burstBig[1], 0xa8ceff, 600, true, 0); O.b2Core = L.sprite(grp, X.star, 0xffffff, 300, true, 0); O.b2Crack = L.sprite(grp, X.crack[1], 0xffffff, 300, true, 0);
    O.redSphere = L.sprite(grp, X.soft, 0xff2a3a, 70, true, 0); O.redArcs = L.sprite(grp, X.arcs[0], 0xffffff, 90, true, 0);
    // portail arc-en-ciel (81,6-87,6)
    O.portal = L.sprite(grp, X.ring, 0xffffff, 330, false, 0); skyPos(-28, 21, 430, O.portal.position);
    O.portalCrack = L.sprite(grp, X.crack[0], 0xffffff, 160, true, 0); O.portalCrack.position.copy(O.portal.position);
    O.portalFlash = L.sprite(grp, X.soft, 0xffd8f4, 260, true, 0); O.portalFlash.position.copy(O.portal.position);
    O.portalBeam = L.sprite(grp, X.burst ? X.burst : X.bursts[2], 0xd0a0ff, 340, true, 0); O.portalBeam.position.copy(O.portal.position);
    O.portal2 = L.sprite(grp, X.ring, 0xffffff, 110, false, 0); skyPos(-43, 5, 400, O.portal2.position);
    O.portal2Crack = L.sprite(grp, X.crack[1], 0xffffff, 60, true, 0); O.portal2Crack.position.copy(O.portal2.position);
    O.shards = []; for (var s = 0; s < 14; s++) O.shards.push(L.sprite(grp, X.shard, 0xe8f6ff, 6, true, 0));
    // éclair à l'horizon quand la 2e fusée rentre dans sa faille (63 s)
    // v89 : la « frénésie » (vidéo 75,8 → 77,5) : une rafale d'éclats de foudre tout près du joueur, calée sur les coups de la musique
    O.frenzy = [[75.85, 40, 22, 150, 150], [76.1, -25, 17, 110, 120], [76.3, 28, 13, 95, 170], [76.6, -40, 10, 120, 150], [76.82, 6, 15, 100, 190], [77.1, -18, 11, 110, 160], [77.35, 24, 24, 140, 130]].map(function (f) {
      var sp = L.sprite(grp, X.burstBig[0], 0xa8d4ff, f[4], true, 0), co = L.sprite(grp, X.star, 0xffffff, f[4] * .5, true, 0), pos = skyPos(f[1], f[2], f[3]);
      sp.position.copy(pos); co.position.copy(pos); return { t: f[0], s: f[4], sp: sp, co: co };
    });
    O.b0p = skyPos(31.3, 1.8, 430); O.b0Bolts = L.sprite(grp, X.burstBig[1], 0xb8d8ff, 420, true, 0); O.b0Bolts.position.copy(O.b0p);
    // gerbe finale de la frénésie (110,5-117)
    O.b4Bolts = L.sprite(grp, X.burstBig[0], 0xb8d8ff, 200, true, 0); O.b4Core = L.sprite(grp, X.star, 0xffffff, 80, true, 0);
    O.b4Bolts.position.copy(skyPos(28.9, 14, 520)); O.b4Core.position.copy(O.b4Bolts.position);
    O.b3p = skyPos(122, 28, 950); // v89 : mesuré (vidéo 111,2 s)
    O.b3Bolts = L.sprite(grp, X.burstBig[0], 0xa8ceff, 700, true, 0); O.b3Core = L.sprite(grp, X.star, 0xffffff, 380, true, 0); O.b3Crack = L.sprite(grp, X.crack[0], 0xe8d8ff, 420, true, 0);
    [O.b1Shell, O.b1Bolts, O.b1Core].forEach(function (s2) { s2.position.copy(O.b1x); });
    [O.b2Bolts, O.b2Core, O.b2Crack, O.redSphere, O.redArcs].forEach(function (s2) { s2.position.copy(O.b2p); });
    [O.b3Bolts, O.b3Core, O.b3Crack].forEach(function (s2) { s2.position.copy(O.b3p); });
    // failles fixes
    addRift(skyPos(46, 59, 1500), 1000, -42, 47.6, { fi: 2.5, fo: 3, seed: 9.9, wing: true, nw: 3, grow: [19.5, 23.5, .45] });
    addRift(rocketPos(33.3, new T.Vector3()), 70, 32.8, 36.6, { fi: .4, fo: 1.4, flash: [33.3], seed: 8.1 });
    addRift(O.b1x, 1700, 39.2, 52, { fi: 1.2, fo: 3, seed: 5.7, curl: 1.6 });
    addRift(O.r2p, 540, 45.4, 57.6, { fi: 1, fo: 2.4, flash: [48.2], seed: 12.4 });
    // v89 : les quatre failles-méduses, relevées sur la vidéo (63 → 72 s) ; chaque éclat = une fusée qui en sort
    addRift(skyPos(46, 59, 1150), 430, 46.6, 72, { seed: 2.2, wing: true, droop: 1, nw: 3, flash: [66.6, 66.85] });
    addRift(skyPos(107, 52.5, 1100), 420, 63.2, 72.4, { seed: 6.6, wing: true, droop: .55, nw: 3, flash: [66.8, 69.6] });
    addRift(skyPos(74, 43, 1000), 360, 63.6, 71.6, { seed: 9.9, wing: true, droop: 1, nw: 2, flash: [66.2, 68.9] });
    addRift(skyPos(95, 42.2, 1050), 380, 64.2, 71.2, { seed: 14.1, wing: true, droop: .8, nw: 3, flash: [67.55] });
    addRift(O.b3p, 480, 108.4, 117.5, { fi: 1, fo: 3, flash: [110.9, 111.2, 111.45, 111.65], seed: 17.7 }); // v93 : un éclat à chaque fusée de la formation qui s'y engouffre
    addRift(O.b2p, 260, 74.6, 80.4, { fi: .6, fo: 2, flash: [76], seed: 4.4, curl: 1.8 });
  }

  /* ========================================================== aurores */
  function buildAurora() {
    O.aur = [];
    var defs = [[-125, -35, 6, 1800, 11, 1.1], [-60, 25, 9, 2000, 13, 2.3], [-15, 70, 5, 1700, 10, 3.7], [35, 125, 8, 2100, 14, 4.9], [100, 195, 6, 1900, 12, 6.1], [165, 255, 8, 2050, 13, 7.4], [-50, 50, 17, 2300, 9, 8.8], [60, 150, 18, 2200, 9, 9.9]];
    defs.forEach(function (d, i) {
      var seg = 90, geo = new T.PlaneGeometry(1, 1, seg, 1), pos = geo.attributes.position;
      for (var v = 0; v < pos.count; v++) {
        var u = pos.getX(v) + .5, w = pos.getY(v) + .5, yaw = lerp(d[0], d[1], u);
        var wob = Math.sin(u * 6.5 + d[5]) * 5 + Math.sin(u * 15 + d[5] * 2) * 1.6, dist = d[3] + Math.sin(u * 5 + d[5]) * 220;
        skyPos(yaw + wob * .25, d[2] + w * d[4] + Math.sin(u * 4.3 + d[5]) * 2.5, dist, tmp);
        pos.setXYZ(v, tmp.x, tmp.y, tmp.z);
      }
      geo.computeBoundingSphere();
      var m = new T.Mesh(geo, L.auroraMaterial(d[5])); m.material.uniforms.len.value = (d[1] - d[0]) / 3.2; m.frustumCulled = false; m.renderOrder = -2; grp.add(m); O.aur.push(m);
    });
  }

  /* ================================================== île flottante (v85) */
  /* Visible dans les 3 vidéos du début à la fin : petite île herbeuse avec une
   * cabane et une antenne, cône de roche dessous et gros cristal magenta lumineux.
   * Elle flotte loin, bien au-dessus des arbres ; le tourbillon final l'aspire. */
  var ISL_S = 45;
  function buildIsland() {
    if (!L.models || !L.models.floatingIsland) return;
    var g = L.models.floatingIsland(X); g.scale.setScalar(ISL_S);
    skyPos(LAY.isl[0], LAY.isl[1], LAY.isl[2], g.position);
    var gy = Math.max(H(g.position.x, g.position.z), 0); g.position.y = Math.max(g.position.y, gy + 1.75 * ISL_S + 55);
    O.isl = g; O.islHome = g.position.clone(); grp.add(g);
    O.islLight = new T.PointLight(0xff4fd8, 0, 260, 1.5); O.islLight.position.copy(g.position).add(new T.Vector3(0, -1.3 * ISL_S, 0)); grp.add(O.islLight);
  }
  function updateIsland(t) {
    var g = O.isl; if (!g) return;
    var vis = t < 254.5; g.visible = vis; if (!vis) { O.islLight.intensity = 0; return; }
    var suck = ramp(t, 237, 250.5), a0 = Math.atan2(O.islHome.z - ZP.z, O.islHome.x - ZP.x), r0 = Math.hypot(O.islHome.x - ZP.x, O.islHome.z - ZP.z);
    var rr = r0 * (1 - U.easeIn(suck)), aa = a0 + suck * suck * 4.2;
    g.position.set(ZP.x + Math.cos(aa) * rr, lerp(O.islHome.y, ZP.y + 60, suck) + 2.2 * Math.sin(t * .55), ZP.z + Math.sin(aa) * rr);
    g.rotation.set(Math.sin(t * .3) * .025 + suck * Math.sin(t * 2) * .4, t * .02 + suck * suck * 6, Math.cos(t * .23) * .02);
    g.scale.setScalar(ISL_S * (1 - .9 * ramp(t, 247, 250.8)));
    var pul = .82 + .18 * Math.sin(t * 1.7) + .06 * Math.sin(t * 5.1), ud = g.userData;
    if (ud.glow) L.setOp(ud.glow, .55 * pul); if (ud.glow2) L.setOp(ud.glow2, .7 * pul);
    if (ud.crystals) ud.crystals.rotation.y = t * .05;
    O.islLight.position.copy(g.position).y -= 1.3 * g.scale.x; O.islLight.intensity = 3.5 * pul * (1 - suck);
  }

  /* ======================================================== météorite */
  var ROCK_FS = [
    'varying vec3 vN;varying vec3 vP;uniform vec3 lightDir,front;uniform float heat,time,pale;', L.NOISE,
    'void main(){vec3 n=normalize(vN);float d=max(dot(n,normalize(lightDir)),0.);',
    'float k=fbm(vP.xy*1.7+vP.z*1.3+time*.05);float crack=smoothstep(.56,.62,k)-smoothstep(.62,.7,k);',
    'float fr=smoothstep(-.1,.75,dot(normalize(vP),normalize(front)));',
    'vec3 base=mix(vec3(.16,.13,.16),vec3(.32,.26,.3),k)*(.22+.85*d);',
    'vec3 lava=vec3(1.,.42,.1)*crack*(.4+fr)*heat*2.2+vec3(1.,.62,.22)*pow(fr,3.)*heat*1.4;',
    'vec3 c=base+lava;c=mix(c,vec3(.95,.86,.96),pale*.6);gl_FragColor=vec4(c,1.);}'
  ].join('\n');
  function rockMesh(scale, seed) {
    var geo = new T.IcosahedronGeometry(1, 3), pa = geo.attributes.position, v = new T.Vector3();
    for (var i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i); var n = L.fbm2(v.x * 1.8 + seed, v.y * 1.8 + v.z * 1.3, seed, 4);
      v.multiplyScalar(.78 + n * .5 + (v.y > .3 ? -.08 : 0)); pa.setXYZ(i, v.x * 1.15, v.y * .85, v.z);
    }
    geo.computeVertexNormals();
    var m = new T.Mesh(geo, new T.ShaderMaterial({ uniforms: { lightDir: { value: new T.Vector3(0, 1, 0) }, front: { value: new T.Vector3(0, -1, 0) }, heat: { value: 1 }, time: { value: 0 }, pale: { value: 0 } },
      vertexShader: 'varying vec3 vN;varying vec3 vP;void main(){vP=position;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: ROCK_FS }));
    m.scale.setScalar(scale); m.frustumCulled = false; return m;
  }
  /* v85 — taille mesurée sur la vidéo avec la vraie caméra (80°) : roche ~3,7° de large, panache
   * ~6,5° d'épaisseur et ~32° de long. MS = échelle de la roche et de la fumée, PLEN = longueur du panache. */
  var MS = .8, PLEN = 1.5;
  function buildMeteor() {
    var M = O.met = { g: new T.Group() }; grp.add(M.g); M.g.visible = false; M.g.scale.setScalar(MS);
    M.rock = L.models ? L.models.meteorRock(26, 2.7, low ? 4 : 5) : rockMesh(26, 2.7); M.g.add(M.rock);
    M.fire = []; for (var i = 0; i < 6; i++) M.fire.push(L.sprite(M.g, i < 2 ? X.glow : X.soft, i < 2 ? 0xffe2a0 : 0xff7a2a, 40, true, 0));
    M.flames = [];
    if (L.flame) [[42, 48, 0], [30, 30, .5], [58, 22, 1]].forEach(function (d, i) { var f = L.flame(d[0], d[1], 0xff4a10, 0xffa035, 0xfff2c0); f.userData.k = d[2]; f.material.uniforms.speed.value = 5 + i * 2; M.g.add(f); M.flames.push(f); });
    M.crystals = []; if (L.models) for (var cc = 0; cc < 9; cc++) { var cr = L.models.crystal(); cr.scale.setScalar(3 + hsh(cc * 3) * 5); M.g.add(cr); M.crystals.push(cr); }
    M.glow = L.sprite(M.g, X.soft, 0xff6a2a, 300, true, 0);
    M.arcs = []; for (var a = 0; a < 7; a++) M.arcs.push(L.sprite(M.g, X.arcs[a % 3], 0xbfe4ff, 80, true, 0));
    M.debris = []; var dgeo = new T.IcosahedronGeometry(1, 0), dmat = mat(0x2c2630, { r: 1, flat: true });
    for (var d = 0; d < 14; d++) { var dm = new T.Mesh(dgeo, dmat); dm.scale.setScalar(1.5 + hsh(d) * 3); M.g.add(dm); M.debris.push(dm); }
    M.shards = []; for (var s = 0; s < 10; s++) M.shards.push(L.sprite(M.g, X.shard, 0xe0f4ff, 8, true, 0));
    M.puffs = []; var R2 = U.rng(55);
    for (var p = 0; p < 84; p++) { var u = p / 83; M.puffs.push({ u: u, off: new T.Vector3((R2() - .5) * 2, (R2() - .5) * 2, (R2() - .5) * 2), s: (38 + 62 * Math.pow(u, .6)) * (.75 + R2() * .5), v: p % 4, rot: R2() * 6.28, sp: (R2() - .5) * .2 }); }
    // v81b : les anciennes boucles / rubans sont remplacés par la capture (buildCapture)
    M.loops = []; M.ribbons = [];
    // lueur au sol du point d'impact + lumière cyan
    O.gGlow = L.sprite(grp, X.soft, 0x5fe4ff, 260, true, 0); O.gGlow.position.copy(IMPACT).add(new T.Vector3(0, 14, 0));
    O.gGlow2 = L.sprite(grp, X.star, 0xe0fbff, 120, true, 0); O.gGlow2.position.copy(IMPACT).add(new T.Vector3(0, 8, 0));
    // rayon blanc-cyan du sol vers la météorite (vidéo 140 → 151 s)
    O.capBeam = laser(0xd8f8ff, 2.2, 13); O.capBeam2 = laser(0x7fe0ff, 6, 26);
    O.gLight = new T.PointLight(0x7fe6ff, 0, 420, 1.3); O.gLight.position.copy(IMPACT).add(new T.Vector3(0, 25, 0)); grp.add(O.gLight);
    // éclairs verticaux à l'impact
    O.vbolts = []; for (var vb = 0; vb < 6; vb++) { var q = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: X.boltV[vb % 4], transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide, opacity: 0 })); q.material.toneMapped = false; q.frustumCulled = false; q.visible = false; grp.add(q); O.vbolts.push(q); }
    // explosion d'impact
    O.ex1 = L.sprite(grp, X.soft, 0xb8eeff, 600, true, 0); O.ex2 = L.sprite(grp, X.burstBig[1], 0xc0dcff, 700, true, 0); O.ex3 = L.sprite(grp, X.flare, 0xd0f0ff, 900, true, 0);
    [O.ex1, O.ex2, O.ex3].forEach(function (s2) { s2.position.copy(IMPACT).add(new T.Vector3(0, 22, 0)); });
    O.shock = new T.Mesh(new T.RingGeometry(.86, 1, 96, 1), new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    O.shock.rotation.x = -Math.PI / 2; O.shock.position.copy(IMPACT).add(new T.Vector3(0, 3, 0)); O.shock.visible = false; grp.add(O.shock);
    // sol brûlé
    O.scorch = [];
    var sc = [[IMPACT.x, IMPACT.z, 70], [P.x + F.x * 4 + R.x * 3, P.z + F.z * 4 + R.z * 3, 14], [P.x - F.x * 9 - R.x * 6, P.z - F.z * 9 - R.z * 6, 10], [P.x + F.x * 16 - R.x * 10, P.z + F.z * 16 - R.z * 10, 12], [P.x + R.x * 15, P.z + R.z * 15, 9]];
    sc.forEach(function (s3, i) {
      var g2 = new T.PlaneGeometry(1, 1, 8, 8), pa = g2.attributes.position, m2 = new T.Mesh(g2, new T.MeshBasicMaterial({ map: X.scorch, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
      m2.rotation.x = -Math.PI / 2; m2.scale.setScalar(s3[2]); m2.position.set(s3[0], 0, s3[1]); m2.rotation.z = hsh(i) * 6;
      m2.updateMatrixWorld(true); var w = new T.Vector3();
      for (var v = 0; v < pa.count; v++) { w.set(pa.getX(v), pa.getY(v), 0).applyMatrix4(m2.matrixWorld); pa.setZ(v, (H(w.x, w.z) + .12) / s3[2]); }
      pa.needsUpdate = true; m2.visible = false; grp.add(m2); O.scorch.push(m2);
    });
  }
  var MOFF = new T.Vector3(), DOME_TOP = 92; // sommet du dôme du Point Zéro au-dessus de ZP (centre −22, rayon 110 × 1,05)
  function meteorOff(t, out) { return out.copy(IMPACT).sub(MET_B).multiplyScalar(.08 * ramp(t, 125, 150.8)); }
  function meteorPos(t, out) {
    // immobile jusqu'à la capture, puis elle descend petit à petit (126 → 151) avant la chute finale
    // vidéo : elle s'enfonce dans la lumière du sol de 150,6 à ~153,3 (le panache reste en l'air et s'efface)
    if (t < 150.6) return meteorOff(t, out).add(MET_B);
    var k = cl((t - 150.6) / 2.7); meteorOff(150.6, out).add(MET_B); return out.lerp(IMPACT, k * k);
  }
  function updateMeteor(t, cam) {
    var M = O.met, vis = t < 154.6;
    M.g.visible = vis; if (!vis) { M.ribbons.forEach(function (r) { r.set(0, 0, 0, t); }); return; }
    meteorPos(t, M.g.position);
    E.meteorPos = E.meteorPos || new T.Vector3(); E.meteorPos.copy(M.g.position); E.meteorVisible = true;
    var appear = 1 - ramp(t, 153, 153.4), energ = ramp(t, 121, 126), pale = ramp(t, 139, 148) * .5 * (1 - ramp(t, 150.6, 151.6)), heat = (1 - .75 * pale);
    // orientation : la roche mène vers le bas-gauche, le panache file vers le haut-droite
    var dir = MDIR;
    var ru = M.rock.material.uniforms; ru.front.value.copy(dir); ru.heat.value = heat * appear; ru.time.value = t; ru.pale.value = pale;
    if (ru.camPos) { ru.camPos.value.copy(cam.position); ru.energy.value = energ * (.6 + .4 * Math.sin(t * 6)); }
    ru.lightDir.value.copy(MOON).sub(M.g.position).normalize();
    M.rock.rotation.set(.4, 1.1, .2); M.rock.scale.setScalar(26); M.rock.visible = t < 153.3;
    var back = tmp.copy(dir).negate();
    for (var i = 0; i < M.fire.length; i++) {
      var f = M.fire[i], fk = i / M.fire.length, fl = .82 + .18 * Math.sin(t * 23 + i * 2.1);
      f.position.copy(back).multiplyScalar(14 + fk * 70).add(tmp2.set(Math.sin(i * 2.3) * 8, Math.cos(i * 1.7) * 8, Math.sin(i * 3.1) * 8));
      f.scale.setScalar((i < 2 ? 46 - i * 8 : 40 + fk * 50) * fl);
      L.setOp(f, appear * heat * (i < 2 ? .55 : .3 * (1 - fk * .6)));
    }
    M.glow.position.copy(back).multiplyScalar(26); M.glow.scale.setScalar(190 + 25 * Math.sin(t * 3)); L.setOp(M.glow, appear * (.22 + .12 * heat));
    M.flames.forEach(function (f, i) {
      f.quaternion.setFromUnitVectors(UP, back); f.position.copy(back).multiplyScalar(10 + f.userData.k * 6);
      var u = f.material.uniforms; u.time.value = t; u.amt.value = appear * heat * (i === 2 ? .4 : .62); f.visible = u.amt.value > .01;
    });
    M.crystals.forEach(function (c, i) {
      var a4 = i * 2.39, rr = 50 + hsh(i * 5) * 50; c.position.copy(back).multiplyScalar((170 + hsh(i) * 110) * PLEN).add(tmp2.set(Math.cos(a4) * rr, Math.sin(a4 * 1.3) * rr * .7, Math.sin(a4) * rr));
      c.rotation.set(i, i * .7 + t * .05, i * 1.3); c.material.opacity = (.35 + .5 * energ) * (.7 + .3 * Math.sin(t * 3 + i));
    });
    // panache de fumée violette
    var sys = O.smoke;
    var c1r = .66, c1g = .48, c1b = .70;
    for (var p = 0; p < M.puffs.length; p++) {
      var q = M.puffs[p], u = q.u, d = 6 + u * 235; // v93 : le panache colle à la roche (vidéo 117-123 s), plus épais
      tmp2.copy(back).multiplyScalar(d * PLEN).addScaledVector(q.off, 14 + u * 44); tmp2.multiplyScalar(MS);
      tmp2.x += Math.sin(t * .3 + p) * .6 * u; tmp2.y += Math.cos(t * .25 + p * 1.3) * .6 * u;
      var x = M.g.position.x + tmp2.x, y = M.g.position.y + tmp2.y, z = M.g.position.z + tmp2.z;
      var a = appear * (u < .02 ? .55 + u / .02 * .45 : 1) * .92 * (1 - .25 * u);
      var rr = lerp(c1r, .95, pale), gg = lerp(c1g, .86, pale), bb = lerp(c1b, .98, pale);
      var warm = Math.max(0, 1 - u * 1.6) * heat; // base orangée qui enveloppe la roche
      if (t > 153.2) a *= 1 - ramp(t, 153.2, 154.6);
      sys.add(x, y, z, q.s * MS * (.95 + .25 * (1 - u)) * (1 + u * .2) * (1 + .03 * Math.sin(t + p)), rr, gg, bb, a, q.rot + t * q.sp, q.v, .15, warm);
    }
    // arcs électriques bleus (scintillement)
    var flick = Math.floor((t + 600) * 12);
    for (var a2 = 0; a2 < M.arcs.length; a2++) {
      var s = M.arcs[a2], u2 = .45 + (a2 / M.arcs.length) * .6;
      s.material.map = X.arcs[(flick + a2) % 3]; s.material.rotation = hsh(flick * 7 + a2) * 6.28;
      s.position.copy(back).multiplyScalar((30 + u2 * 220) * PLEN).add(tmp2.set(hsh(a2 + flick) * 60 - 30, hsh(a2 * 3 + flick) * 60 - 30, hsh(a2 * 5 + flick) * 60 - 30));
      s.scale.setScalar(70 + 50 * u2 + energ * 40);
      L.setOp(s, appear * (.55 + .45 * hsh(flick + a2 * 9)) * (.6 + .4 * energ));
    }
    for (var dd = 0; dd < M.debris.length; dd++) {
      var db = M.debris[dd], ang = dd * 1.9, rad = 40 + dd * 9;
      db.position.copy(back).multiplyScalar((40 + dd * 14) * PLEN).add(tmp2.set(Math.cos(ang) * rad * .5, Math.sin(ang * 1.3) * rad * .4, Math.sin(ang) * rad * .5));
      db.rotation.set(dd, dd * .7, dd); db.visible = appear > .3;
    }
    for (var sh = 0; sh < M.shards.length; sh++) {
      var ss = M.shards[sh], a3 = t * .5 + sh * .63;
      ss.position.copy(back).multiplyScalar((180 + sh * 12) * PLEN).add(tmp2.set(Math.cos(a3) * 50, Math.sin(a3 * 1.4) * 40, Math.sin(a3) * 50));
      ss.material.rotation = t * 2 + sh; L.setOp(ss, appear * (.4 + .6 * energ) * (.5 + .5 * Math.sin(t * 6 + sh)));
    }
    // boucles d'énergie (fusées qui tournent autour) 122 → 140
    M.loops.forEach(function (lp, i) {
      var a0 = 122.5 + i * 3.6, k = (t - a0) / 7.5;
      lp.mesh.quaternion.setFromUnitVectors(UP, back);
      if (lp.head) { /* la tête suit le maillage : position locale -> monde gérée par set */ }
      lp.set(cl(k), .32, (k > 0 ? 1 : 0) * (1 - ramp(t, a0 + 7.5, a0 + 9)) * energ, t);
      if (lp.head && lp.head.visible) lp.head.position.applyQuaternion(lp.mesh.quaternion);
    });
    // rubans d'énergie vers le sol
    var pulses = [[125.4, 127.6], [131.8, 134.4], [135.8, 139.2], [140.4, 146.2], [147, 150.6]];
    M.ribbons.forEach(function (rb, i) {
      var best = 0, kk = 0;
      pulses.forEach(function (pp) { var w2 = win(t, pp[0] + i * .25, pp[1], .3, .8); if (w2 > best) { best = w2; kk = cl((t - pp[0] - i * .25) / 1.2); } });
      rb.set(kk, .9, best * (i === 0 ? 1 : .6), t);
    });
  }
  /* v81b — LA CAPTURE (vidéo 121 → 150 s) : pour chaque passage, une faille
   * s'ouvre tout derrière la météorite (au bout de la fumée), une fusée en sort,
   * longe la météorite en s'enroulant autour jusqu'à l'avant, puis plonge dans
   * une faille qui s'ouvre devant, près du sol. Puis la suivante, et ainsi de
   * suite, de plus en plus vite : les traînées s'accumulent en cage de lumière. */
  function buildCapture() {
    /* v85 — LA CAPTURE refaite d'après la vidéo (relevé demi-seconde par demi-seconde, 118 → 151 s) :
     * une faille à éclairs s'ouvre au bout du panache (121,5) et reste ouverte. Une à une, les fusées
     * en sortent, décrivent un grand arc autour du panache puis longent son flanc, dépassent la tête
     * de la météorite et plongent toutes vers LE MÊME point au sol (le futur point d'impact), devant le
     * joueur, où elles s'engouffrent dans un éclat bleu. Les premières font de grandes boucles
     * (124-126 : boucle par-dessus ; 128-130 : traversée vers la gauche puis chute verticale ; 130,5-132 :
     * boucle au-dessus puis plongée), puis elles s'enchaînent de plus en plus vite et leurs traînées,
     * qui restent, tissent un cocon de lumière autour du panache, jusqu'au sol. */
    var H0 = MET_B.clone(), back = MDIR.clone().negate(), Tl = MET_B.clone().addScaledVector(back, 245 * MS * PLEN);
    var ax = Tl.clone().sub(H0), Lx = ax.length(); ax.normalize();
    var eye = P.clone(); eye.y += 1.7;
    var v = H0.clone().sub(eye).normalize(), sr = new T.Vector3().crossVectors(v, UP).normalize(), su = new T.Vector3().crossVectors(sr, v).normalize();
    var u1 = new T.Vector3().crossVectors(ax, v).normalize(); if (u1.dot(sr) > 0) u1.negate(); // φ = 0 : flanc gauche (côté joueur / lune)
    var u2 = new T.Vector3().crossVectors(ax, u1).normalize();
    var G = IMPACT.clone(); G.y += 1.5;
    var Rm = 62;
    function C(sAx, phi, r) { return H0.clone().addScaledVector(ax, sAx * Lx).addScaledVector(u1, Math.cos(phi) * r).addScaledVector(u2, Math.sin(phi) * r); }
    function Tp(a, b, c2) { return Tl.clone().addScaledVector(sr, a).addScaledVector(su, b).addScaledVector(ax, c2 || 0); }
    function dive(from) { var d = from.clone().lerp(G, .45); d.y += 18; return [d, G.clone().lerp(from, .12), G.clone()]; }
    var exits = [], entries = []; O.capture = [];
    function add(pts, a, b, o) {
      o = o || {};
      addTrail({ pts: pts, a: a, b: b, len: 1, fade: o.fade || 4, radius: o.radius || 3.2, headSize: 64, col: 0x8fd0ff, core: 0xeaf8ff, grow: .45, flashEnd: !o.quiet || o.flash > 0, flashSize: (o.quiet ? 38 : (o.flash || 90)) * 1.1, alpha: o.alpha || .8, cap: true, segs: 160 });
      exits.push(a - .05); if (!o.quiet) entries.push(b); O.capture.push({ a: a, b: b });
      if (o.entry) addRift(G, o.entry * 1.3, b - .35, b + .7, { fi: .2, fo: .5, flash: [b], seed: 40 + O.capture.length * 1.3, curl: 1.6, narrow: true });
    }
    // 1) 123,9 → 126,5 : grande boucle par-dessus le bout du panache, puis le long du flanc gauche jusqu'au sol
    add([Tl.clone(), Tp(110, 25), Tp(165, 55), Tp(140, 95), Tp(40, 100), C(.8, 0, Rm * 1.1), C(.5, 0, Rm * .95), C(.2, 0, Rm * .8)].concat(dive(C(-.06, 0, Rm * .5))), 123.9, 126.5, { alpha: 1, fade: 1.3, flash: 210, entry: 120, radius: 3.6 });
    // 2) 127,9 → 130,2 : traversée vers la gauche à hauteur du bout du panache, crochet, chute verticale sur le point d'impact
    var top = G.clone(); top.y = Tl.y - .32 * (Tl.y - H0.y);
    var t0b = Tl.clone().addScaledVector(UP, -.18 * (Tl.y - top.y));
    add([Tl.clone(), t0b, t0b.clone().lerp(top, .5), top.clone().addScaledVector(sr, 26), top.clone().addScaledVector(UP, -26), G.clone().addScaledVector(UP, (top.y - G.y) * .4), G.clone()], 127.7, 129.85, { alpha: 1, fade: 1.3, flash: 170, entry: 100, radius: 3.4 });
    // 3) 130,4 → 132,5 : boucle au-dessus du panache vers la gauche, puis plongée le long du flanc
    add([Tl.clone(), Tp(45, 60), Tp(0, 95), Tp(-90, 70), Tp(-130, 35, -40), C(.5, .1, Rm * 1.5), C(.2, 0, Rm), ].concat(dive(C(-.06, 0, Rm * .55))), 130.2, 132.2, { alpha: .95, fade: 1.6, flash: 150, entry: 90 });
    // 4) le cocon : méridiens autour du panache, de plus en plus serrés dans le temps
    function meridian(phi, k, a, b, alpha, quiet) {
      var pts = [Tl.clone(), C(.9, phi, Rm * .6 * k), C(.72, phi, Rm * .95 * k), C(.5, phi, Rm * k), C(.28, phi, Rm * .88 * k), C(.1, phi, Rm * .62 * k)];
      add(pts.concat(dive(C(-.07, phi, Rm * .36 * k))), a, b, { alpha: alpha, fade: 2.4 + 1.2 * hsh(a), flash: quiet ? 0 : 115, radius: quiet ? 2.4 : 2.8, quiet: quiet });
    }
    // v89 : chaque grand éclat au point d'impact tombe sur un flash de la vidéo (= un « boum » de la musique)
    var HITS = CAPF.filter(function (h) { return h > 132.5; }).concat([147.3, 148.2, 148.9]).sort(function (a, b) { return a - b; });
    HITS.forEach(function (h, j) { var dur = Math.max(1.15, 1.8 - j * .03); meridian(j * 2.39996 + .35, .85 + .35 * hsh(j * 3.7), h - dur, h, Math.max(.55, .88 - j * .01), false); });
    // et entre deux, des fusées plus discrètes tissent le cocon (sans grand éclat)
    var t0 = 134.0, i = 0, step = .7, dur = 1.7;
    while (t0 < 149.8 && i < 30) {
      meridian(i * 2.39996 + 1.6, .78 + .4 * hsh(i * 5.1), t0, t0 + dur, Math.max(.45, .7 - i * .008), true);
      t0 += step; step = Math.max(.32, step * .95); dur = Math.max(1.05, dur * .975); i++;
    }
    // quelques traînées remontent du point d'impact vers le bout du panache (139-142)
    [138.6, 139.5, 140.7].forEach(function (a, j) {
      var m1 = G.clone().lerp(Tl, .3).addScaledVector(sr, -40 - 25 * j), m2 = G.clone().lerp(Tl, .7).addScaledVector(su, 30 + 15 * j);
      addTrail({ pts: [G.clone(), m1, m2, Tl.clone()], a: a, b: a + 1.5, len: .6, fade: 1.6, radius: 1.8, headSize: 40, col: 0x8fd0ff, core: 0xeaf8ff, grow: .4, alpha: .7, cap: true });
    });
    // la faille à éclairs au bout du panache, ouverte pendant toute la capture (un éclat à chaque sortie)
    addRift(Tl, 240, 121.4, 151.4, { fi: 1.4, fo: .9, flash: [121.6].concat(exits), seed: 20.5, cap: true, curl: 1.3, op: .8 });
    // la faille au sol, au point d'impact : des éclairs qui rampent sur le sol (vidéo B), un éclat à chaque fusée qui s'y engouffre
    addRift(G.clone().add(new T.Vector3(0, 8, 0)), 190, 126.3, 151.8, { fi: .5, fo: .8, flash: entries, seed: 60.6, curl: 1.7 });
    O.capG = G;
  }
  function updateImpact(t) {
    // lueur au sol qui enfle avec l'énergie
    var gk = ramp(t, 124, 127) * .35 + ramp(t, 135, 141) * .4 + ramp(t, 145, 150) * .5;
    var pulse = .8 + .2 * Math.sin(t * 9), ge = gk * pulse * (1 - ramp(t, 153, 154.5));
    // v85 : comme les 3 vidéos, une lueur cyan éblouissante qui grossit au point d'impact pendant toute la capture
    L.setOp(O.gGlow, ge * .34); O.gGlow.scale.setScalar(110 + 260 * gk);
    L.setOp(O.gGlow2, ge * .6); O.gGlow2.scale.setScalar(50 + 130 * gk);
    O.gLight.intensity = ge * 10 + win(t, 152.7, 156, .1, 2.2) * 40;
    // rayon du sol vers la météorite
    var cb = win(t, 140.5, 151.4, 3, .35) * (.45 + .55 * ramp(t, 146.5, 150.6)) * (.8 + .2 * Math.sin(t * 23));
    if (cb > .004 && O.met) { var ca = O.capA || (O.capA = new T.Vector3()), cbp = O.capB || (O.capB = new T.Vector3()); cbp.copy(O.met.g.position); ca.copy(IMPACT); ca.y += 2; placeBeam(O.capBeam, ca, cbp, cb * .55); placeBeam(O.capBeam2, ca, cbp, cb * .2); }
    else { O.capBeam.visible = O.capBeam2.visible = false; }
    // éclairs verticaux
    var bw = win(t, 150.4, 152.9, .15, .3) + win(t, 152.8, 157.6, .1, 1.4) * 1.2 + win(t, 155.42, 156.6, .05, .8) * .8, flick = Math.floor((t + 600) * 14), cam = api.camera();
    for (var i = 0; i < O.vbolts.length; i++) {
      var q = O.vbolts[i], on2 = bw > .01 && (hsh(flick * 3 + i) > .25 || t > 152.8);
      q.visible = on2; if (!on2) continue;
      var hgt = (t > 152.8 ? 420 : 260) * (.7 + hsh(i * 7) * .6), ox = (hsh(i * 5 + flick) - .5) * 60, oz = (hsh(i * 11 + flick) - .5) * 60;
      q.position.set(IMPACT.x + ox, IMPACT.y + hgt / 2, IMPACT.z + oz);
      // éventail d'éclairs fins qui partent du point d'impact (vidéo 150,4 → 156)
      var tilt = ((i + .5) / O.vbolts.length - .5) * 1.3 + (hsh(i + flick) - .5) * .25;
      var ya = cam ? Math.atan2(cam.position.x - IMPACT.x, cam.position.z - IMPACT.z) : 0, lx = Math.cos(ya), lz = -Math.sin(ya);
      q.position.set(IMPACT.x + ox * .3 - lx * Math.sin(tilt) * hgt * .5, IMPACT.y + Math.cos(tilt) * hgt * .5, IMPACT.z + oz * .3 - lz * Math.sin(tilt) * hgt * .5);
      q.scale.set(hgt * .1, hgt, 1); q.rotation.set(0, ya, 0); q.rotateZ(tilt);
      q.material.map = X.boltV[(flick + i) % 4]; q.material.opacity = Math.min(1, bw) * .5;
    }
    // explosion
    var ex = win(t, 152.8, 156.6, .25, 2.4);
    L.setOp(O.ex1, ex * .45); O.ex1.scale.setScalar(80 + 320 * ramp(t, 152.8, 153.6));
    // 2e déflagration (vidéo 155,4–156,9 : étoile d'éclairs au sol, synchro avec le second « boum » de la musique)
    var e2b = win(t, 155.42, 156.9, .06, 1.1), e2a = win(t, 152.8, 155.4, .1, 1.4);
    L.setOp(O.ex2, Math.max(e2a * .55, e2b * .75)); O.ex2.scale.setScalar(e2b > e2a ? 300 + 420 * ramp(t, 155.42, 156.2) : 260 + 360 * ramp(t, 152.8, 153.8)); O.ex2.material.map = X.burstBig[Math.floor((t + 600) * 12) % 2]; O.ex2.material.rotation = Math.floor((t + 600) * 12) * .7;
    L.setOp(O.ex3, win(t, 152.8, 154.8, .1, 1.5) * .6); O.ex3.scale.set(1800, 150, 1);
    var sk = cl((t - 152.9) / 3.2); O.shock.visible = sk > 0 && sk < 1; O.shock.material.opacity = (1 - sk) * .7; O.shock.scale.setScalar(10 + 520 * U.easeOut(sk));
    // nuages roses de l'explosion
    var sys = O.smoke;
    if (false) {
      for (var p = 0; p < 34; p++) {
        var age = t - 152.9 - (p % 6) * .05, ang = hsh(p) * 6.283, rr = 10 + age * (5 + hsh(p + 3) * 9) * (1 - Math.exp(-age * .6)) * 2.2;
        var x = IMPACT.x + Math.cos(ang) * rr, z = IMPACT.z + Math.sin(ang) * rr, y = IMPACT.y + 8 + age * (2 + hsh(p + 5) * 6) + hsh(p + 9) * 40;
        var a = cl(age * 3) * (1 - ramp(t, 156, 160.5)) * .8;
        sys.add(x, y, z, 30 + age * 8 + hsh(p) * 20, .86, .58, .78, a, hsh(p) * 6 + age * .1, p % 4, .2, (1 - cl(age / 2)) * .8);
      }
    }
    // sol brûlé
    O.scorch.forEach(function (s, i) { var op = i ? 0 : ramp(t, 153.2, 155.2) * (1 - ramp(t, 176, 178)); s.visible = op > .01; s.material.opacity = op * .7; });
  }

  /* ===================================================== fusée du lancement */
  /* v86 — LE DÉCOLLAGE : la fusée monte TOUT DROIT, sans bouger de son pas de tir (ni à gauche, ni à droite,
   * ni vers l'avant). Elle accélère doucement et atteint ~230 m quand elle entre dans la faille (33,3 s) :
   * vue depuis la colline, elle est alors à ~59° de hauteur, comme dans la vidéo. */
  var RK_H = 268;
  /* v89 : altitude MESURÉE sur la vidéo (élévation de la flamme vue depuis la colline, image par image) :
   * décollage à 10 s, montée quasi régulière ~11,9 m/s, ~268 m quand elle entre dans la faille (33,6 s). */
  function rkAlt(t) { var u = t - 10; return u <= 0 ? 0 : u < 2 ? 2.75 * u * u : 11 + 11.9 * (u - 2); }
  function rocketPos(t, out) {
    return out.copy(BASE).addScaledVector(UP, 1.2 + rkAlt(Math.min(t, 33.6)));
  }
  /* distance de la caméra de référence (colline) au point d'entrée : sert à dimensionner les effets */
  function rkScale() { return 1; }
  function buildLaunch() {
    O.rocket = L.models ? L.models.launchRocket(X) : bigRocket(); grp.add(O.rocket);
    O.launchPuffs = []; var R2 = U.rng(31);
    for (var i = 0; i < (low ? 46 : 78); i++) {
      var side = R2() < .5 ? -1 : 1, ang = Math.atan2(F.z, F.x) + side * (Math.PI / 2 + (R2() - .5) * 1.4) + (R2() < .2 ? Math.PI : 0);
      O.launchPuffs.push({ tb: 3.0 + R2() * 6.5 + (i % 5 === 0 ? 5 : 0), ang: ang, v: 12 + R2() * 22, up: .5 + R2() * 1.6, s: 7 + R2() * 9, rot: R2() * 6.28, var: i % 4, h: R2() * 5 });
    }
    O.column = []; var N = low ? 130 : 230;
    for (var j = 0; j < N; j++) { var k = j / (N - 1); O.column.push({ k: k, te: 9.6 + k * 23.7, off: new T.Vector3((R2() - .5), (R2() - .5) * .5, (R2() - .5)), rot: R2() * 6.28, var: j % 4, s: .8 + R2() * .5 }); }
    O.e1 = rocketPos(33.3, new T.Vector3());
    O.e1Flash = L.sprite(grp, X.star, 0xbfe6ff, 300, true, 0); O.e1Flash.position.copy(O.e1);
    O.rLight = new T.PointLight(0xffa860, 0, 600, 1.2); grp.add(O.rLight);
  }
  function updateLaunch(t) {
    var rk = O.rocket, flying = t >= 9.6;
    rk.visible = t < 33.3;
    if (!flying) rk.position.copy(BASE).addScaledVector(UP, 1.2); else rocketPos(t, rk.position);
    if (flying && rk.visible) { rocketPos(t + .05, tmp); tmp.sub(rk.position); if (tmp.lengthSq() > 1e-6) rk.quaternion.setFromUnitVectors(UP, tmp.normalize()); } else rk.quaternion.identity();
    var ign = ramp(t, 8.3, 9.6), fl = .88 + .12 * Math.sin(t * 41) + .06 * Math.sin(t * 67);
    var fm = rk.userData.flame, core = rk.userData.core, fon = t > 8.2 && rk.visible;
    if (rk.userData.flames) {
      rk.userData.flames.forEach(function (f, i) {
        f.visible = fon; if (!fon) return; var u = f.material.uniforms; u.time.value = t; u.amt.value = ign * (.9 + .1 * Math.sin(t * 37 + i));
        var main = f === fm, cr = f === core, len = main ? 26 : cr ? 12 : 9, wid = main ? 4.6 : cr ? 2.2 : 2.1;
        f.scale.set(wid * (.7 + .3 * ign) * (1 + .25 * ramp(t, 10, 16)), len * (.25 + .75 * ign) * fl * (1 + ramp(t, 10, 16) * .7), 1);
      });
      (rk.userData.lights || []).forEach(function (l, i) { l.material.opacity = (Math.sin(t * 5 + i * 2) > .2 ? .95 : .1) * (rk.visible ? 1 : 0); l.visible = rk.visible; });
    } else {
      fm.visible = core.visible = fon;
      fm.scale.set(.6 + .5 * ign, (.3 + 1.6 * ign) * fl * (1 + ramp(t, 10, 16) * .6), .6 + .5 * ign); core.scale.copy(fm.scale);
    }
    L.setOp(rk.userData.glow, ign * fl * (rk.visible ? 1 : 0)); L.setOp(rk.userData.glow2, ign * .8 * (rk.visible ? 1 : 0));
    var far = ramp(t, 12, 30); rk.userData.glow.scale.setScalar(12 + 4 * far); rk.userData.glow2.scale.setScalar(26 + 10 * far); rk.userData.glow2.material.opacity *= .35;
    rk.scale.setScalar(1); // taille réelle (on peut monter dessus)
    O.rLight.position.copy(rk.position); O.rLight.intensity = rk.visible ? ign * fl * (6 - 4 * far) : 0;
    O.padLight.intensity = win(t, 8.0, 18, 1, 6) * 7 * fl;
    O.beacon.material.opacity = (Math.sin(t * 4) > 0 ? .95 : .25);
    // fumée de lancement (blanche, s'étale au sol)
    var sys = O.smoke, lp = O.launchPuffs;
    if (t > 2.9 && t < 60) for (var i = 0; i < lp.length; i++) {
      var q = lp[i], age = t - q.tb; if (age <= 0) continue;
      var dist = q.v * 2.2 * (1 - Math.exp(-age / 2.6)) + age * .6, x = BASE.x + Math.cos(q.ang) * dist, z = BASE.z + Math.sin(q.ang) * dist;
      var y = BASE.y + 2 + q.h + q.up * age * 1.1 + Math.min(age, 6) * 1.2;
      var s = q.s + age * 2.3; if (s > 46) s = 46;
      var a = cl(age * 1.6) * (1 - ramp(t, q.tb + 14, q.tb + 34)) * .95;
      var warm = win(t, 8.3, 20, 1, 6) * cl(1 - dist / 60) * 1.2;
      sys.add(x, y, z, s, .93, .94, 1.0, a, q.rot + age * .05, q.var, .35, warm);
    }
    // colonne de fumée rose de la fusée
    var col = O.column;
    if (t > 9.6 && t < 62) for (var j = 0; j < col.length; j++) {
      var c = col[j], age2 = t - c.te; if (age2 <= 0) continue;
      rocketPos(c.te, tmp); var size = (6 + 7 * c.k) * c.s * (1 + age2 * .14); // v85 : traînée fine près de la fusée, qui s'élargit en vieillissant (vidéo)
      tmp.addScaledVector(c.off, size * .3); tmp.x += R.x * age2 * .15; tmp.z += R.z * age2 * .15; tmp.y -= 2 + age2 * .2;
      var dis = ramp(t, 33.6 + (1 - c.k) * 1.5, 36.2 + (1 - c.k) * 3.2); // v85 : la traînée se disloque vite après l'entrée dans la faille (vidéo 34-39 s)
      var a2 = cl(age2 * 2.5) * (1 - dis) * .9;
      var hot = cl(1 - age2 / 1.6);
      sys.add(tmp.x, tmp.y, tmp.z, size, .98, .84 + .06 * c.k, .95, a2, c.rot + age2 * .03, c.var, .25, hot * 1.6 + .25);
    }
    // entrée dans la faille : éclair bleu
    L.setOp(O.e1Flash, win(t, 33.2, 35.4, .15, 1.6)); O.e1Flash.scale.setScalar(30 + 75 * ramp(t, 33.2, 34.4));
    E.anchors = E.anchors || {}; if (!E.anchors.rocket1) E.anchors.rocket1 = new T.Vector3(); E.anchors.rocket1.copy(rk.visible ? rk.position : O.e1);
  }

  /* v85 — la base vit : gyrophares qui tournent, feux orange qui clignotent, manche à air
   * dans le vent, faisceau orange (du compte à rebours jusqu'à l'explosion finale),
   * projecteur qui balaie le ciel et hologramme d'alerte pendant le compte à rebours. */
  function updateBase(t, cam) {
    var live = 1 - ramp(t, 222.8, 223.4);
    for (var i = 0; i < O.beacons.length; i++) {
      var b = O.beacons[i], k = b.red ? Math.pow(.5 + .5 * Math.sin(t * 8.4 + b.ph), 4) : (((t * 1.6 + b.ph) % 1) < .45 ? 1 : .12);
      L.setOp(b.s, live * (b.red ? .2 + .8 * k : .3 + .6 * k)); b.s.scale.setScalar(b.red ? 5 + 7 * k : 4 + 2.5 * k);
      b.cap.material.emissiveIntensity = .35 + 1.8 * k;
    }
    if (O.sock && (frame & 1) === 0) {
      var pa = O.sock.geometry.attributes.position, s0 = O.sockGeo0, gust = .75 + .25 * Math.sin(t * .37);
      for (var v = 0; v < pa.count; v++) {
        var x = s0[v * 3], u = x / 3.6;
        pa.setXYZ(v, x * (.92 + .08 * gust), s0[v * 3 + 1] + Math.sin(t * 4.4 - u * 5.5) * .2 * u - .55 * u * u * (1 - gust), s0[v * 3 + 2] + Math.sin(t * 2.7 - u * 3.3 + 1) * .3 * u);
      }
      pa.needsUpdate = true; O.sock.rotation.y = .35 * Math.sin(t * .21) + .1 * Math.sin(t * .9);
    }
    // éteint pendant le décollage (sinon il fait une 2e traînée), il revient vers 82-88 s (vidéo A : visible à 93, 102, 111, 162 s)
    var bo = live * (1 - win(t, 9.8, 88, 1.5, 6)) * (.84 + .1 * Math.sin(t * 2.1) + .06 * Math.sin(t * 5.3));
    O.baseBeam.visible = O.baseBeamCore.visible = bo > .01;
    O.baseBeam.material.opacity = .16 * bo; O.baseBeamCore.material.opacity = .3 * bo; L.setOp(O.baseBeamGlow, .2 * bo);
    // projecteur : balayage lent jusqu'au décollage
    var so = win(t, -60, 9.8, 1, 1.4);
    O.search.visible = so > .01;
    if (O.search.visible) { O.search.material.opacity = .32 * so; O.search.rotation.set(0, 0, 0); O.search.rotateY(t * .45); O.search.rotateZ(-.62 - .12 * Math.sin(t * .31)); }
    // hologramme d'alerte (triangle rouge « ! ») au-dessus du pas de tir
    var ho = win(t, -60, 1.6, 2, 1.4), hp = .78 + .22 * Math.sin(t * 5.2);
    L.setOp(O.holo, ho * hp * .95); L.setOp(O.holoGlow, ho * hp * .32); O.holo.position.y = 110 + 1.6 * Math.sin(t * 1.25); O.holoGlow.position.y = O.holo.position.y;
  }

  /* ============================================== séquences du ciel 35-117 */
  function updateSkyShow(t, cam) {
    var flick = Math.floor((t + 600) * 13);
    // v85 — le point bleu laissé par la fusée reste en place (34,2 → 38,8), puis l'explosion part de là
    O.sparkTail.set(1, .55, win(t, 33.6, 38.4, .3, 1.2) * .55, t);
    var rise = U.sm(ramp(t, 33.9, 38.85)); O.sparkPos.copy(O.b1p).lerp(O.b1x, rise); var rs = 1 + 2.3 * rise;
    O.spark.position.copy(O.sparkPos); L.setOp(O.spark, win(t, 34, 39, .3, .4)); O.spark.scale.setScalar((8 + 1.8 * Math.sin(t * 9)) * rs);
    O.sparkHalo.position.copy(O.sparkPos); L.setOp(O.sparkHalo, win(t, 33.4, 38.9, .2, .5) * (.35 + .65 * win(t, 33.4, 35.6, .1, 1.6))); O.sparkHalo.scale.setScalar((24 + 40 * win(t, 33.4, 35.6, .1, 1.6)) * rs);
    if (O.sparkTail) { O.sparkTail.off = O.sparkTail.off || new T.Vector3(); O.sparkTail.off.copy(O.sparkPos).sub(O.b1p); }
    E.anchors = E.anchors || {}; E.anchors.b1 = t < 38.85 ? O.sparkPos : O.b1x;
    // spirale d'éclats : s'ouvre pendant la montée (21 → 27), tourne, puis se referme en petit anneau (33,3 → 36,5)
    var spo = win(t, 20.8, 38.8, 2.2, 2.2) * (1 - ramp(cam.position.distanceTo(BASE), 45, 90)), spk = lerp(.35, 1, U.easeOut(ramp(t, 20.8, 27.5))) * lerp(1, .16, U.easeIn(ramp(t, 33.2, 36.2)));
    O.spiral.visible = spo > .005;
    if (O.spiral.visible) { O.spiral.material.opacity = .6 * spo; O.spiral.scale.setScalar(150 * spk); O.spiral.rotation.z = -t * .09 - 2.2 * ramp(t, 33.2, 36.5); O.spiral.material.color.setHex(t < 33.3 ? 0xf2eaff : 0xd8e6ff); }
    L.setOp(O.spiralCore, win(t, 20.8, 33.6, 2, .3) * .55); O.spiralCore.scale.setScalar(12 + 2 * Math.sin(t * 11));
    // explosion de foudre sphérique
    var b1 = win(t, 38.6, 42.6, .25, 2.2), g1 = U.easeOut((t - 38.6) / 1.8);
    L.setOp(O.b1Shell, b1 * .62 * ramp(t, 39.4, 40.3)); O.b1Shell.scale.setScalar((55 + 125 * g1) * 3.3); O.b1Shell.material.map = X.shell[flick % 2]; O.b1Shell.material.rotation = t * .1;
    L.setOp(O.b1Bolts, b1 * .85); O.b1Bolts.scale.setScalar((80 + 160 * g1) * 3.3); O.b1Bolts.material.map = X.burstBig[flick % 2]; O.b1Bolts.material.rotation = (flick % 5) * .4;
    var fl1 = win(t, 38.75, 39.6, .06, .55); L.setOp(O.b1Core, Math.max(win(t, 38.5, 41.8, .1, 1.6) * .75, fl1)); O.b1Core.scale.setScalar((36 + 40 * g1 + 70 * fl1) * 3.3);
    O.darkCloud.material.opacity = win(t, 34.5, 47, 2, 3) * .55; O.darkCloud.visible = O.darkCloud.material.opacity > .01;
    // anneaux
    L.setOp(O.ringA, win(t, 42.1, 46.4, .6, 1)); O.ringA.scale.setScalar(260 + 30 * Math.sin(t * 3)); L.setOp(O.ringAs, win(t, 42.3, 46, .4, 1) * (.7 + .3 * Math.sin(t * 9)));
    L.setOp(O.ringB, win(t, 44.4, 47.5, .5, 1)); O.ringB.scale.setScalar(200);
    // rayon de la faille R2
    var bk = win(t, 46.3, 51.6, 1, 1.4);
    O.beam.visible = bk > .01; O.beam.material.opacity = bk * (.62 + .08 * Math.sin(t * 6)); O.beam.rotation.y = t * .05;
    if (O.beam.visible) { var top = O.r2p, bot = tmp.copy(top); bot.y = P.y - 40; O.beam.position.copy(top).lerp(bot, .5); O.beam.scale.set(1, top.y - bot.y, 1); }
    L.setOp(O.r2Glow, win(t, 47.6, 52, .8, 2)); O.r2Glow.scale.setScalar(260 + 380 * win(t, 47.6, 51, 1, 1));
    // sphère rouge + gerbe près de la montagne (75,5-80)
    L.setOp(O.redSphere, win(t, 75.2, 76.3, .3, .2)); O.redSphere.scale.setScalar(34 + 14 * Math.sin(t * 20));
    L.setOp(O.redArcs, win(t, 75.2, 76.3, .2, .2)); O.redArcs.material.map = X.arcs[flick % 3];
    L.setOp(O.b2Bolts, win(t, 76, 79.4, .1, 2) * .8); O.b2Bolts.scale.setScalar(120 + 260 * U.easeOut((t - 76) / 1.2)); O.b2Bolts.position.copy(O.b2p).lerp(O.b2hi, ramp(t, 76.6, 77.8)); O.b2Bolts.material.map = X.burstBig[(flick + 1) % 2]; O.b2Bolts.material.rotation = flick * .5;
    L.setOp(O.b2Core, win(t, 76, 78.6, .08, 1.8) * .8); O.b2Core.scale.setScalar(60 + 90 * ramp(t, 76, 77)); O.b2Core.position.copy(O.b2p).lerp(O.b2hi, ramp(t, 76.6, 77.8));
    L.setOp(O.b2Crack, win(t, 77.4, 81.0, .3, 1.8)); O.b2Crack.scale.setScalar(210); O.b2Crack.position.copy(O.b2hi);
    // portail arc-en-ciel
    var po = win(t, 81.6, 87.7, 1, .5), opn = U.easeOut((t - 81.6) / 1.6) * (1 - ramp(t, 87.1, 87.7));
    L.setOp(O.portal, po); O.portal.scale.setScalar(40 + 300 * opn); O.portal.material.rotation = t * .05;
    L.setOp(O.portalCrack, po * (.7 + .3 * hsh(flick))); O.portalCrack.scale.setScalar(70 + 120 * opn); O.portalCrack.material.map = X.crack[flick % 2]; O.portalCrack.material.rotation = flick * .3;
    L.setOp(O.portalFlash, win(t, 85.5, 87.3, .4, .6)); O.portalFlash.scale.setScalar(140 + 260 * ramp(t, 85.5, 86.6));
    L.setOp(O.portalBeam, win(t, 86.6, 87.9, .1, .6)); O.portalBeam.material.map = X.bursts[flick % 3]; O.portalBeam.scale.setScalar(300);
    var po2 = win(t, 83, 87.4, .8, .5); L.setOp(O.portal2, po2); O.portal2.scale.setScalar(110 * U.easeOut((t - 83) / 1.2)); L.setOp(O.portal2Crack, po2 * (.6 + .4 * hsh(flick + 3))); O.portal2Crack.material.map = X.crack[(flick + 1) % 2];
    // éclats de verre quand la fusée traverse
    var sk2 = cl((t - 87.2) / 2.4);
    for (var i = 0; i < O.shards.length; i++) {
      var s = O.shards[i]; if (sk2 <= 0 || sk2 >= 1) { L.setOp(s, 0); continue; }
      tmp.set(hsh(i) - .5, hsh(i + 4) - .3, hsh(i + 8) - .5).normalize();
      s.position.copy(O.portal.position).addScaledVector(tmp, 30 + 140 * sk2); s.position.y += 30 * sk2;
      s.material.rotation = t * 3 + i; s.scale.setScalar(7 + hsh(i + 2) * 8); L.setOp(s, (1 - sk2) * .95);
    }
    if (O.frenzy) O.frenzy.forEach(function (f, i) {
      var w = win(t, f.t, f.t + .8, .04, .55), g = U.easeOut(cl((t - f.t) / .6));
      L.setOp(f.sp, w * .9); L.setOp(f.co, w * (1 - g * .6)); if (w <= 0) return;
      f.sp.scale.setScalar(f.s * (.55 + .7 * g)); f.co.scale.setScalar(f.s * (.35 + .25 * g)); f.sp.material.map = X.burstBig[(flick + i) % 2]; f.sp.material.rotation = (flick + i) * .5;
    });
    L.setOp(O.b0Bolts, win(t, 62.3, 64.6, .1, 1.3) * .8); O.b0Bolts.scale.setScalar(160 + 300 * U.easeOut((t - 62.3) / 1)); O.b0Bolts.material.map = X.burstBig[flick % 2]; O.b0Bolts.material.rotation = flick * .45;
    // gerbe finale (110,5)
    var b4 = win(t, 89.3, 92.6, .12, .8); L.setOp(O.b4Bolts, b4 * .8 * (.75 + .25 * hsh(flick))); O.b4Bolts.scale.setScalar(70 + 50 * ramp(t, 89.3, 90.4)); O.b4Bolts.material.map = X.burstBig[flick % 2]; O.b4Bolts.material.rotation = flick * .4;
    L.setOp(O.b4Core, b4 * .9); O.b4Core.scale.setScalar(26 + 14 * win(t, 90.2, 90.8, .1, .3));
    L.setOp(O.b3Bolts, win(t, 110.85, 115, .08, 2.6) * .8); O.b3Bolts.scale.setScalar(220 + 480 * U.easeOut((t - 110.85) / 1.4)); O.b3Bolts.material.map = X.burstBig[flick % 2]; O.b3Bolts.material.rotation = flick * .37;
    L.setOp(O.b3Core, win(t, 110.85, 114.2, .08, 2.2) * .85); O.b3Core.scale.setScalar(170 + 150 * ramp(t, 110.85, 111.8));
    L.setOp(O.b3Crack, win(t, 113.8, 117.6, .8, 2)); O.b3Crack.scale.setScalar(440);
  }

  /* ===================================== zénith, lasers, dôme, bulle (158-224) */
  function laser(color, r, glowR) {
    var g = new T.Group();
    var c = new T.Mesh(new T.CylinderGeometry(r, r, 1, 6, 1, true), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    var w = new T.Mesh(new T.CylinderGeometry(glowR, glowR, 1, 8, 1, true), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    c.material.toneMapped = w.material.toneMapped = false;
    g.add(c); g.add(w); g.userData.c = c; g.userData.w = w; g.visible = false; c.frustumCulled = w.frustumCulled = false; grp.add(g); return g;
  }
  function placeBeam(g, a, b, op) {
    g.visible = op > .004; if (!g.visible) return;
    g.position.copy(a).lerp(b, .5); g.scale.set(1, a.distanceTo(b), 1); g.quaternion.setFromUnitVectors(UP, tmp3.copy(b).sub(a).normalize());
    g.userData.c.material.opacity = op; g.userData.w.material.opacity = op * .14;
  }
  function buildZenith() {
    O.zRing = L.sprite(grp, X.hole, 0xffffff, 70, false, 0); O.zRing.position.copy(STAR);
    O.zStar = L.sprite(grp, X.star, 0xe8f6ff, 80, true, 0); O.zStar.position.copy(STAR);
    O.zHalo = L.sprite(grp, X.ring, 0x9fffd8, 160, false, 0); O.zHalo.position.copy(STAR);
    O.zCrack = L.sprite(grp, X.crack[0], 0xffffff, 300, true, 0); O.zCrack.position.copy(STAR);
    O.zGlow = L.sprite(grp, X.soft, 0x3d7dff, 1500, true, 0); O.zGlow.position.copy(STAR);
    O.zSphere = L.sprite(grp, X.globe, 0x6f8cff, 2600, true, 0); O.zSphere.position.copy(STAR);
    O.zFlash = L.sprite(grp, X.star, 0xf0d8ff, 600, true, 0); O.zFlash.position.copy(STAR);
    O.zBolts = []; for (var i = 0; i < 4; i++) { var q = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: X.boltV[i], transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide, opacity: 0 })); q.material.toneMapped = false; q.frustumCulled = false; q.visible = false; grp.add(q); O.zBolts.push(q); }
    O.zStarBurst = L.sprite(grp, X.burstBig[0], 0x8fb8ff, 900, true, 0); O.zStarBurst.position.copy(STAR);
    // lasers rouges
    O.lH = laser(0xff0a18, 1.4, 5); O.lV = laser(0xff0a18, 1.4, 5);
    O.lasers = []; for (var l = 0; l < 5; l++) O.lasers.push(laser(0xff0c1c, 1.1, 4));
    O.laserPts = [[-140, 60], [110, -90], [60, 150], [-90, -130], [190, 40]].map(function (d) { var x = ZP.x + d[0], z = ZP.z + d[1]; return [new T.Vector3(x, H(x, z), z), new T.Vector3(x + d[0] * .3, ZP.y + 2400, z + d[1] * .3)]; });
    // dôme du Point Zéro + bulle
    O.dome = new T.Mesh(new T.SphereGeometry(1, 64, 28, 0, Math.PI * 2, 0, Math.PI / 2), L.domeMaterial()); O.dome.position.copy(ZP); O.dome.position.y = ZP.y - 22; O.dome.frustumCulled = false; O.dome.visible = false; O.dome.renderOrder = 7; grp.add(O.dome);
    O.domeCore = L.sprite(grp, X.star, 0xffffff, 120, true, 0); O.domeCore.position.copy(ZP).add(new T.Vector3(0, 6, 0));
    O.domeGlow = L.sprite(grp, X.soft, 0xb070ff, 400, true, 0); O.domeGlow.position.copy(ZP).add(new T.Vector3(0, 20, 0));
    O.bubble = new T.Mesh(new T.SphereGeometry(1, 64, 32), L.domeMaterial()); O.bubble.position.copy(O.dome.position); O.bubble.frustumCulled = false; O.bubble.visible = false; O.bubble.renderOrder = 8; grp.add(O.bubble);
    O.bubble.material.uniforms.cyan.value = 1;
    // le Point Zéro visible dès le début : orbe d'énergie flottante, halo, arcs
    O.orb = new T.Mesh(new T.SphereGeometry(1, 48, 32), L.domeMaterial()); O.orb.position.copy(ZP).add(new T.Vector3(0, 22, 0)); O.orb.frustumCulled = false; O.orb.renderOrder = 7; grp.add(O.orb);
    O.orb.material.uniforms.cyan.value = .85;
    O.orbIn = new T.Mesh(new T.SphereGeometry(1, 32, 20), L.domeMaterial()); O.orbIn.position.copy(O.orb.position); O.orbIn.frustumCulled = false; O.orbIn.renderOrder = 7; grp.add(O.orbIn);
    O.orbIn.material.uniforms.cyan.value = .2;
    O.orbCore = L.sprite(grp, X.star6, 0xf4fbff, 60, true, 1); O.orbCore.position.copy(O.orb.position);
    O.orbHalo = L.sprite(grp, X.soft, 0x6fc8ff, 190, true, .6); O.orbHalo.position.copy(O.orb.position);
    O.orbArcs = []; for (var oa = 0; oa < 3; oa++) { var sa = L.sprite(grp, X.arcs[oa], 0xcfeaff, 46, true, 0); sa.position.copy(O.orb.position); O.orbArcs.push(sa); }
    O.orbBeam = new T.Mesh(new T.CylinderGeometry(3, 10, 1, 14, 1, true), new T.MeshBasicMaterial({ color: 0xc8b0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    O.orbBeam.frustumCulled = false; grp.add(O.orbBeam);
    O.zpLight = new T.PointLight(0xc080ff, 0, 700, 1.2); O.zpLight.position.copy(ZP).add(new T.Vector3(0, 40, 0)); grp.add(O.zpLight);
  }
  function updateZenith(t, cam) {
    var flick = Math.floor((t + 600) * 13);
    L.setOp(O.zRing, win(t, 161.5, 165, .5, .5) * (.75 + .25 * hsh(flick))); O.zRing.scale.setScalar(70 + 15 * Math.sin(t * 5));
    L.setOp(O.zStar, win(t, 164.6, 168.4, .4, 1) + win(t, 189.4, 192, .2, 1.5) + win(t, 167.4, 211, .8, 3) * .55); O.zStar.scale.setScalar(110 + 240 * ramp(t, 164.6, 167));
    L.setOp(O.zHalo, win(t, 166.4, 168, .3, .5)); O.zHalo.scale.setScalar(200);
    var cr = win(t, 167.3, 211, .8, 3);
    L.setOp(O.zCrack, cr * (.85 + .15 * hsh(flick))); O.zCrack.scale.setScalar(320 + 80 * ramp(t, 189, 192)); O.zCrack.material.map = X.crack[Math.floor((t + 600) * 4) % 2]; O.zCrack.material.rotation = Math.floor((t + 600) * 4) * .2;
    L.setOp(O.zGlow, Math.min(1, win(t, 167.25, 177.4, .5, 1.2) * 1.15 + win(t, 190, 211, 1, 3) * .7)); O.zGlow.scale.setScalar(560 + 40 * Math.sin(t * 1.4));
    L.setOp(O.zSphere, win(t, 190.5, 199.5, 1.2, 3) * .5); O.zSphere.scale.setScalar(1100 + 900 * U.easeOut(ramp(t, 190.5, 195)));
    L.setOp(O.zFlash, win(t, 189.6, 191.6, .2, 1.2) * .6); O.zFlash.scale.setScalar(500 + 900 * ramp(t, 189.6, 190.6));
    L.setOp(O.zStarBurst, win(t, 190.4, 209, .6, 3) * .55); O.zStarBurst.material.map = X.burstBig[flick % 2]; O.zStarBurst.material.rotation = flick * .6; O.zStarBurst.scale.setScalar(900);
    // éclairs qui descendent de l'étoile
    var bw = win(t, 191, 208.5, .5, 2);
    for (var i = 0; i < O.zBolts.length; i++) {
      var q = O.zBolts[i], on2 = bw > .01 && hsh(flick * 5 + i) > .3; q.visible = on2; if (!on2) continue;
      var hgt = 500 + hsh(i * 3) * 400;
      q.position.copy(STAR); q.position.y -= hgt / 2; q.position.x += (hsh(i + flick) - .5) * 120; q.position.z += (hsh(i * 2 + flick) - .5) * 120;
      q.scale.set(hgt * .22, hgt, 1); q.rotation.set(0, Math.atan2(cam.position.x - q.position.x, cam.position.z - q.position.z), (hsh(i + flick * 2) - .5) * .4);
      q.material.map = X.boltV[(flick + i) % 4]; q.material.opacity = bw * .7; q.material.color.setHex(0xa8c8ff);
    }
    // lasers rouges
    var lz = win(t, 175.8, 183.6, .25, .6);
    placeBeam(O.lH, tmp.copy(STAR).addScaledVector(R, -3500), tmp2.copy(STAR).addScaledVector(R, 3500), win(t, 175.8, 177.6, .2, .5));
    placeBeam(O.lV, STAR, ZP, lz);
    O.lasers.forEach(function (g, i) { var lp = O.laserPts[i]; placeBeam(g, lp[0], lp[1], win(t, 177.7 + i * .1, 179.0, .15, .35) * (.8 + .2 * Math.sin(t * 30 + i))); }); // vidéo : rafale de lasers fins 178-179, puis un seul
    // dôme
    var du = O.dome.material.uniforms, amt = Math.max(ramp(t, 177.3, 179), .11 * (1 - ramp(t, 176.8, 177.6))) * (1 - ramp(t, 223.2, 223.7));
    O.dome.visible = amt > .004; du.time.value = t; du.amt.value = amt;
    du.flash.value = win(t, 182.95, 184.6, .1, 1.4) * .8 + win(t, 215.8, 218, .2, 1.5) * .22 + win(t, 222.6, 223.5, .5, .2) * .55;
    du.cyan.value = .55 * (1 - ramp(t, 176.6, 178)) + .25 * ramp(t, 210.5, 214); du.hot.value = win(t, 216, 223.4, .5, .3) * .38;
    var rp = t > 216.2 && t < 223.2 ? ((t - 216.2) % 1.4) / 1.4 : 0; du.ripple.value = rp > 0 ? (1 - rp) * .45 : 0; du.ripT.value = rp * 1.6;
    var RD = 110 * (1 + .03 * Math.sin(t * 2.2)) * (1 + .12 * win(t, 216, 223.4, 1, .3));
    O.dome.scale.set(RD, RD * 1.05, RD);
    // v93 — la météorite de la fin appuie sur le haut de la bulle (creux), la traverse (la membrane tremble) et brûle dedans
    var mk = ramp(t, 216.2, 217.6), rel = ramp(t, 217.6, 218.6);
    du.dentDir.value.set(0, 1, 0); du.ripDir.value.set(0, 1, 0);
    du.dent.value = t > 216.2 && t < 218.6 ? .38 * U.easeOut(mk) * (1 - rel) : 0; du.dentW.value = .36 + .22 * mk;
    du.wob.value = t > 217.6 && t < 223.2 ? 1.3 * (1 - ramp(t, 217.6, 222.2)) : 0;
    du.touch.value = win(t, 215.9, 222.8, .3, .6) * (.22 + .05 * Math.sin(t * 19));
    du.flash.value = Math.max(du.flash.value, ramp(t, 219, 223) * (1 - ramp(t, 223, 223.4)) * .55); // elle s'illumine blanc-rose avant d'exploser
    L.setOp(O.domeCore, amt * (.12 + .05 * Math.sin(t * 6)) + win(t, 182.8, 184.6, .2, 1) * .6); O.domeCore.scale.setScalar(30 + 8 * Math.sin(t * 4) + 40 * win(t, 182.8, 184.6, .2, 1));
    L.setOp(O.domeGlow, amt * .1); O.domeGlow.material.color.setHex(du.cyan.value > .5 ? 0x7fe4ff : 0xb070ff);
    O.zpLight.intensity = amt * (2 + 3 * du.flash.value);
    // bulle de l'onde de choc (183 → 185,6)
    var bk = cl((t - 183.05) / 2.6), bu = O.bubble.material.uniforms; O.bubble.visible = bk > 0 && bk < 1;
    if (O.bubble.visible) { var rr = 110 + 1450 * U.easeOut(bk); O.bubble.scale.setScalar(rr); bu.amt.value = (1 - bk) * .9; bu.time.value = t; bu.flash.value = (1 - bk) * .25; }
    // orbe du Point Zéro (présent depuis le début) — v93 : il reste dans la bulle quand la fusée du laser le frappe (183 s), plus discret ensuite, jusqu'à l'explosion
    var ov = (1 - .45 * ramp(t, 184.6, 187.5)) * (1 - ramp(t, 222.6, 223.4)), ofl = Math.floor((t + 600) * 11), pul = 1 + .06 * Math.sin(t * 2.7) + .03 * Math.sin(t * 7.1);
    O.orb.visible = O.orbIn.visible = ov > .004;
    if (O.orb.visible) {
      var ou = O.orb.material.uniforms; ou.time.value = t; ou.amt.value = .35 * ov; ou.flash.value = .12 + .1 * Math.sin(t * 3);
      var iu = O.orbIn.material.uniforms; iu.time.value = t * 1.7; iu.amt.value = .25 * ov;
      O.orb.scale.setScalar(42 * pul); O.orb.rotation.y = t * .3; O.orbIn.scale.setScalar(25 * pul); O.orbIn.rotation.y = -t * .5;
    }
    L.setOp(O.orbCore, ov * (.28 + .05 * Math.sin(t * 9))); O.orbCore.scale.setScalar(130 * pul);
    L.setOp(O.orbHalo, ov * .12); O.orbHalo.scale.setScalar(480 * pul);
    O.orbArcs.forEach(function (a3, i) { a3.material.map = X.arcs[(ofl + i) % 3]; a3.material.rotation = hsh(ofl + i * 7) * 6.28; a3.scale.setScalar(70 + 24 * hsh(ofl + i)); L.setOp(a3, ov * (hsh(ofl * 3 + i) > .45 ? .4 : 0)); });
    var obk = win(t, 73.4, 78.4, .8, 1.6) * .22;
    O.orbBeam.visible = obk > .01; if (O.orbBeam.visible) { O.orbBeam.position.copy(O.orb.position).add(tmp.set(0, 400, 0)); O.orbBeam.scale.set(.9, 800, .9); O.orbBeam.material.opacity = obk * (.7 + .3 * Math.sin(t * 1.3)); }
    if (amt < .2 && t < 177.3) O.zpLight.intensity = ov * 1.2;
    E.zeroPointPos = E.zeroPointPos || new T.Vector3(); E.zeroPointPos.copy(ZP); E.zeroPointVisR = 0;
  }

  /* ===================================== météorite n°2, escorte, plongée (190-224) */
  function buildMeteor2() {
    var M = O.met2 = { g: new T.Group() }; grp.add(M.g); M.g.visible = false;
    M.rock = L.models ? L.models.meteorRock(14, 7.3, 4) : rockMesh(14, 7.3); M.g.add(M.rock);
    M.flame = L.flame ? L.flame(70, 34, 0xff3a10, 0xff9a30, 0xfff0c0) : null; if (M.flame) M.g.add(M.flame);
    M.glow = L.sprite(M.g, X.soft, 0xff4a20, 260, true, 0); M.core = L.sprite(M.g, X.glow, 0xffc060, 80, true, 0);
    M.tail = []; for (var i = 0; i < 6; i++) M.tail.push(L.sprite(M.g, X.soft, 0xff6a2a, 60, true, 0));
    O.escort = [];
    var start = met2Pos(205, new T.Vector3());
    for (var e = 0; e < 6; e++) {
      /* v85 — vidéo 204,8 → 216 : les six fusées sortent autour de la météorite, descendent tout droit en
       * parallèle, s'ouvrent en corolle sous le joueur puis plongent vers le sol tout autour du dôme. */
      /* v89 (3 vidéos, 205 → 214 s) : elles descendent EN ÉVENTAIL juste sous la météorite, à sa vitesse, jusqu'à ~209 s ;
       * puis elles la devancent, s'écartent et piquent vers le sol tout autour du dôme (213,5 s). */
      var a = e / 6 * Math.PI * 2 + .3, off = new T.Vector3(Math.cos(a) * 26, -30 - (e % 2) * 18, Math.sin(a) * 26);
      var p0 = start.clone().add(off), pm = met2Pos(209.2, new T.Vector3()).add(off.clone().multiplyScalar(1.35)), p1 = pm.clone(); p1.y = ZP.y + 420; p1.x += Math.cos(a) * 45; p1.z += Math.sin(a) * 45;
      var p2 = ZP.clone().add(new T.Vector3(Math.cos(a) * 400, 230, Math.sin(a) * 400));
      var gx = ZP.x + Math.cos(a) * 680, gz = ZP.z + Math.sin(a) * 680, p3 = new T.Vector3(gx, Math.max(H(gx, gz), 0) + 3, gz);
      var tr = new L.Trail(grp, [p0, pm, p1, p2, p3], 2.3, 0x8fd2ff, 0xffffff, X.star, { headSize: 70, rocket: L.models ? L.models.riftRocket(X, 1.9) : L.riftRocket(1.8), grow: 1.5 }); // v89 : traînées fines comme la vidéo
      tr.spec = { tp: [204.8 + e * .1, 209.2 + e * .08, 211.0 + e * .1, 212.6 + e * .12, 213.6 + e * .2], tail: 1.6 }; tr.fr = arcFracs(tr.curve, 5);
      tr.a = tr.spec.tp[0]; tr.b = tr.spec.tp[4]; O.escort.push(tr); FLASHES.push({ pos: p3.clone().add(new T.Vector3(0, 6, 0)), t: tr.b, size: 160 }); addBoom(p3, tr.b, 1.4, true); // v93 : elles s'écrasent et explosent
    }
    O.fireCol = new T.Mesh(new T.CylinderGeometry(9, 15, 1, 16, 1, true), new T.MeshBasicMaterial({ color: 0xff5a24, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    O.fireCol.frustumCulled = false; O.fireCol.visible = false; grp.add(O.fireCol);
    // éclats au contact avec le dôme : la fusée du laser (183 s) et la météorite (216,2 s)
    O.zHit = L.sprite(grp, X.star, 0xe8f6ff, 300, true, 0); O.zHit.position.set(ZP.x, ZP.y + DOME_TOP, ZP.z);
    O.zHitGlow = L.sprite(grp, X.soft, 0x9fdcff, 500, true, 0); O.zHitGlow.position.copy(O.zHit.position);
    O.mHit = L.sprite(grp, X.star, 0xfff0d0, 300, true, 0); O.mHit.position.copy(O.zHit.position);
    O.mHitGlow = L.sprite(grp, X.soft, 0xff9a50, 600, true, 0); O.mHitGlow.position.copy(O.zHit.position);
    O.fireCore = new T.Mesh(new T.CylinderGeometry(4, 7, 1, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    O.fireCore.frustumCulled = false; O.fireCore.visible = false; grp.add(O.fireCore);
    // v93 (vidéo 217,5 s) : éclair plat blanc-cyan posé sur le haut de la bulle au contact
    O.mFlat = L.sprite(grp, X.flare, 0xc8f6ff, 600, true, 0); O.mFlat.position.set(ZP.x, ZP.y + DOME_TOP + 4, ZP.z);
    O.mFlatCore = L.sprite(grp, X.soft, 0xeafcff, 260, true, 0); O.mFlatCore.position.copy(O.mFlat.position);
    // v93 (vidéo 218-224 s) : le sol rougeoie tout autour du pied de la bulle pendant que la météorite s'y enfonce
    var rg = new T.RingGeometry(.72, 1.25, 72, 1); O.mGround = new T.Mesh(rg, new T.MeshBasicMaterial({ map: X.soft, color: 0xff7a2a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
    O.mGround.rotation.x = -Math.PI / 2; O.mGround.position.set(ZP.x, H(ZP.x, ZP.z) + 2, ZP.z); O.mGround.scale.setScalar(DOME_TOP + 22); O.mGround.frustumCulled = false; O.mGround.visible = false; grp.add(O.mGround);
  }
  // v85 : elle heurte le SOMMET du dôme à 216,2 s (vidéo), s'y enfonce en brûlant pendant que la colonne de feu jaillit
  // v93 : la membrane résiste (216,2 → 217,6 : creux sous la roche), puis l'avale ; la roche continue de
  // s'enfoncer lentement dans la bulle en brûlant jusqu'au grand éclair (222,8)
  function met2Pos(t, out) {
    if (t > 216.2) return out.set(ZP.x, ZP.y + DOME_TOP - 40 * U.easeOut(ramp(t, 216.2, 217.6)) - 62 * U.easeOut(ramp(t, 217.6, 222.6)), ZP.z);
    var k = cl((t - 192.6) / (216.2 - 192.6)), e = Math.pow(k, 1.7);
    return out.copy(STAR).lerp(tmp2.set(ZP.x, ZP.y + DOME_TOP, ZP.z), e);
  }
  function updateMeteor2(t) {
    var M = O.met2, vis = t > 192.6 && t < 222.8;
    M.g.visible = vis;
    if (vis) {
      met2Pos(t, M.g.position); var ap = ramp(t, 192.6, 194.5) * (1 - ramp(t, 221.8, 222.8));
      M.rock.scale.setScalar(22 * ap * (1 - .4 * ramp(t, 217.6, 222.4))); M.rock.rotation.set(t * .3, t * .2, 0);
      var u = M.rock.material.uniforms; u.front.value.set(0, -1, 0); u.heat.value = 1.4; u.time.value = t; u.lightDir.value.set(0, 1, 0);
      if (u.camPos) { var cm = api.camera(); if (cm) u.camPos.value.copy(cm.position); u.energy.value = .6; }
      if (M.flame) { M.flame.position.set(0, 8, 0); var fu = M.flame.material.uniforms; fu.time.value = t; fu.amt.value = ap; }
      L.setOp(M.glow, ap * .95); M.glow.scale.setScalar(320 + 60 * Math.sin(t * 8)); L.setOp(M.core, ap); M.core.scale.setScalar(120);
      M.tail.forEach(function (s, i) { s.position.set(0, 18 + i * 22, 0); s.scale.setScalar(50 + i * 14); L.setOp(s, ap * (.6 - i * .08) * (.85 + .15 * Math.sin(t * 17 + i))); });
      E.meteorPos = E.meteorPos || new T.Vector3(); E.meteorPos.copy(M.g.position); E.meteorVisible = true;
    }
    // escorte : six fusées qui plongent dans le dôme
    O.escort.forEach(function (tr) {
      if (t < tr.a - .1 || t > tr.b + 1.6) { if (tr.mesh.visible) tr.set(0, 0, 0, t); return; }
      var kk = keyK(tr, t), ln = Math.max(.015, kk - keyK(tr, t - tr.spec.tail)); tr.set(kk, ln, (t > tr.a ? 1 : 0) * (1 - ramp(t, tr.b, tr.b + 1.4)), t);
    });
    var zh = win(t, 182.95, 184.6, .06, 1.3); L.setOp(O.zHit, zh * .75); O.zHit.scale.setScalar(130 + 330 * U.easeOut(ramp(t, 182.95, 183.8))); L.setOp(O.zHitGlow, zh * .28); O.zHitGlow.scale.setScalar(220 + 260 * ramp(t, 182.95, 184));
    var mh = win(t, 216.15, 218.2, .06, 1.4); L.setOp(O.mHit, mh * .22); O.mHit.scale.setScalar(120 + 300 * U.easeOut(ramp(t, 216.15, 217))); L.setOp(O.mHitGlow, mh * .07); O.mHitGlow.scale.setScalar(200 + 260 * ramp(t, 216.15, 217.4));
    // v93 : éclair plat au contact, sol qui rougeoie, la bulle s'illumine jusqu'à l'explosion
    var mf = win(t, 216.15, 217.9, .05, 1.3), mfk = U.easeOut(ramp(t, 216.15, 216.9));
    L.setOp(O.mFlat, mf * .9); O.mFlat.scale.set(380 + 900 * mfk, 60 + 40 * mfk, 1); O.mFlat.material.rotation = 0;
    L.setOp(O.mFlatCore, mf * .55); O.mFlatCore.scale.setScalar(160 + 220 * mfk);
    var mgk = win(t, 216.6, 223.6, 1.2, .5); O.mGround.visible = mgk > .004;
    if (O.mGround.visible) { O.mGround.material.opacity = mgk * (.55 + .15 * Math.sin(t * 6)); O.mGround.scale.setScalar((DOME_TOP + 22) * (1 + .1 * ramp(t, 217, 223))); }
    // colonne de feu puis de fumée sombre au sommet du dôme
    var fc = win(t, 215.9, 221, .3, 2.5);
    O.fireCol.visible = O.fireCore.visible = fc > .004;
    if (fc > .004) {
      var base = Math.min(ZP.y + DOME_TOP - 6, O.met2.g.position.y), top = ZP.y + DOME_TOP + 514, hgt = top - base; // v93 : la colonne suit la météorite dans la bulle
      O.fireCol.position.set(ZP.x, base + hgt / 2, ZP.z); O.fireCol.scale.set(1, hgt, 1); O.fireCol.material.opacity = fc * .55 * (.85 + .15 * Math.sin(t * 25));
      O.fireCore.position.copy(O.fireCol.position); O.fireCore.scale.set(1, hgt, 1); O.fireCore.material.opacity = fc * .6;
    }
    var sys = O.smoke;
    if (t > 216.6 && t < 246) {
      for (var p = 0; p < 30; p++) {
        var k2 = p / 29, y = ZP.y + DOME_TOP + 20 + k2 * 520, age = t - 216.6 - k2 * .8; if (age < 0) continue;
        var a = cl(age * 1.5) * (1 - ramp(t, 226, 236)) * .85;
        sys.add(ZP.x + Math.sin(p * 2.1 + t * .2) * (8 + k2 * 20), y, ZP.z + Math.cos(p * 1.7) * (8 + k2 * 20), 46 + k2 * 60, .2, .2, .25, a * .7, p + t * .05, p % 4, 0, cl(1 - age / 2) * .8);
      }
    }
  }

  /* ===================================== explosion, rayons, tourbillon (223-255) */
  var VMAX = 980;
  function vortexGeometry(maxR) {
    var rings = low ? 32 : 56, segs = low ? 72 : 128, pos = [], uv = [], idx = [];
    for (var i = 0; i <= rings; i++) {
      var r = maxR * Math.pow(i / rings, 1.35);
      for (var j = 0; j <= segs; j++) {
        var a = j / segs * Math.PI * 2, x = ZP.x + Math.cos(a) * r, z = ZP.z + Math.sin(a) * r, y = Math.max(H(x, z), 0) + 3.5;
        pos.push(x - ZP.x, y - ZP.y, z - ZP.z); uv.push(.5 + .5 * Math.cos(a) * r / maxR, .5 + .5 * Math.sin(a) * r / maxR);
      }
    }
    for (var i2 = 0; i2 < rings; i2++) for (var j2 = 0; j2 < segs; j2++) { var a0 = i2 * (segs + 1) + j2, b0 = a0 + segs + 1; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
  }
  function buildFinale() {
    O.fx = { core: L.sprite(grp, X.star, 0xffffff, 400, true, 0), flare: L.sprite(grp, X.flare, 0xe0f2ff, 2000, true, 0), soft: L.sprite(grp, X.soft, 0x9fdcff, 1200, true, 0),
      rays: L.sprite(grp, X.raysM, 0xffffff, 3000, true, 0), rays2: L.sprite(grp, X.rays, 0xcfe4ff, 2200, true, 0), big: L.sprite(grp, X.soft, 0xffffff, 3000, true, 0) };
    var c = ZP.clone().add(new T.Vector3(0, 30, 0)); Object.keys(O.fx).forEach(function (k) { O.fx[k].position.copy(c); });
    O.fxC = c;
    O.mlines = [];
    for (var i = 0; i < (low ? 10 : 18); i++) {
      var col = i % 3 === 0 ? 0xff40e0 : i % 3 === 1 ? 0x8f6bff : 0x7fd0ff, g = laser(col, .9, 4);
      var dir = new T.Vector3(hsh(i * 3) - .5, (hsh(i * 7) - .25) * .9, hsh(i * 11) - .5).normalize();
      g.userData.dir = dir; g.userData.len = 1600 + hsh(i) * 1800; O.mlines.push(g);
    }
    O.vortex = new T.Mesh(vortexGeometry(VMAX), L.vortexMaterial()); O.vortex.position.copy(ZP);
    O.vortex.frustumCulled = false; O.vortex.visible = false; O.vortex.renderOrder = 6; grp.add(O.vortex);
    O.debris = []; var dgeo = new T.IcosahedronGeometry(1, 0), dg2 = new T.BoxGeometry(1, 1, 1), dmA = mat(0x5a5f6e, { r: 1, flat: true }), dmB = mat(0x7d6b58, { r: 1, flat: true }), dmC = mat(0x355a3a, { r: 1, flat: true });
    for (var d = 0; d < (low ? 24 : 46); d++) {
      var m = new T.Mesh(d % 5 === 0 ? dg2 : dgeo, [dmA, dmB, dmC][d % 3]); var s = 1 + hsh(d) * 2.4 + (d % 11 === 0 ? 3 : 0); m.scale.set(s, s * (.6 + hsh(d + 1) * .8), s);
      m.userData = { a0: hsh(d * 3) * 6.283, r0: 160 + hsh(d * 5) * 520, h0: 10 + hsh(d * 7) * 60, spd: .6 + hsh(d * 9), t0: 236 + hsh(d * 13) * 10 };
      m.visible = false; grp.add(m); O.debris.push(m);
    }
    // le Bus de combat, aspiré par le tourbillon (vidéo 241 → 251 s)
    O.fBus = null;
    try {
      if (L.models && L.models.battleBus) { O.fBus = new T.Group(); O.fBus.add(L.models.battleBus(X)); }
      else if (root.AZArt && root.AZArt.aircraft) O.fBus = root.AZArt.aircraft();
      if (O.fBus) {
        O.fBus.visible = false; O.fBus.traverse(function (o) { o.frustumCulled = false; }); grp.add(O.fBus);
        // v93 : sa propre lumière — à contre-jour du tourbillon il paraissait tout noir
        var bl = new T.PointLight(0xbcd8ff, 4, 70, 1.2); bl.position.set(0, 6, 0); O.fBus.add(bl);
        var bl2 = new T.PointLight(0x8fb4ff, 2.5, 50, 1.2); bl2.position.set(0, 2, -8); O.fBus.add(bl2);
      }
    } catch (e) { O.fBus = null; }
    O.mstreaks = [];
    for (var k = 0; k < 4; k++) {
      var pts = []; for (var j = 0; j <= 30; j++) { var a = j / 30 * Math.PI * 2.4 + k * 1.57, r = 420 * (1 - j / 34); pts.push(ZP.clone().add(new T.Vector3(Math.cos(a) * r, 60 + 80 * Math.sin(j * .3 + k), Math.sin(a) * r))); }
      O.mstreaks.push(new L.Trail(grp, pts, 2.2, 0xff4ad8, 0xffb0f0, null, { grow: .6 }));
    }
  }
  function updateFinale(t, cam) {
    var fx = O.fx, c = O.fxC;
    var ex = win(t, 223.3, 254.6, .4, .3), kd = cl(c.distanceTo(cam.position) / 420) * .88 + .12;
    L.setOp(fx.core, ex * (.8 + .15 * Math.sin(t * 7))); fx.core.scale.setScalar((90 + 110 * win(t, 223.3, 228, .3, 3) + 40 * ramp(t, 244, 252.5)) * kd);
    L.setOp(fx.flare, ex * .35); fx.flare.scale.set((600 + 900 * ramp(t, 247, 253)) * kd, (30 + 20 * ramp(t, 247, 253)) * kd, 1);
    L.setOp(fx.soft, ex * (.09 + .03 * ramp(t, 238, 250))); fx.soft.scale.setScalar((320 + 300 * ramp(t, 238, 252)) * kd);
    L.setOp(fx.rays, (win(t, 223.6, 254.4, .6, .4) * (.035 + .015 * Math.sin(t * 1.7)) + win(t, 223.6, 228.5, .3, 2.5) * .1 + win(t, 243, 253, 3, .8) * .06)); fx.rays.material.rotation = t * .04; fx.rays.scale.setScalar(kd * 1300 + 500 * win(t, 223.6, 229, .5, 4) + 700 * ramp(t, 244, 252));
    L.setOp(fx.rays2, win(t, 224, 254.4, 1, .4) * .04 + win(t, 244, 253, 3, .8) * .05); fx.rays2.material.rotation = -t * .06; fx.rays2.scale.setScalar((2000 + 800 * Math.sin(t * .8)) * kd);
    L.setOp(fx.big, win(t, 223.2, 225.0, .3, 1.2) * .2 + win(t, 250.5, 253.2, 1.5, 1.2) * .06); fx.big.scale.setScalar((900 + 900 * ramp(t, 223.2, 224.2) + 600 * ramp(t, 251.5, 254)) * kd);
    O.mlines.forEach(function (g, i) {
      var op = (win(t, 223.8 + (i % 4) * .2, 230.5, .3, 3) * (.6 + .4 * Math.sin(t * 3 + i)) + win(t, 229, 251, 2, 3) * .18 + win(t, 245, 253, 1, .8) * .25) * .5;
      var d = tmp.copy(g.userData.dir).applyAxisAngle(UP, t * .03 * (i % 2 ? 1 : -1));
      placeBeam(g, c, tmp2.copy(c).addScaledVector(d, g.userData.len), op);
    });
    // tourbillon qui avale l'île
    var vk = ramp(t, 234, 240), vu = O.vortex.material.uniforms; O.vortex.visible = vk > .004 && t < 254.6;
    if (O.vortex.visible) { var rad = 140 + 820 * U.easeIn(ramp(t, 234, 252)); vu.rad.value = rad / VMAX; vu.time.value = t; vu.amt.value = vk * .38; vu.core.value = ramp(t, 242, 252) * .14; vu.twist.value = 5 + 3 * ramp(t, 240, 252); }
    O.debris.forEach(function (m) {
      var ud = m.userData, k = cl((t - ud.t0) / (252.5 - ud.t0)); m.visible = t > ud.t0 && t < 253.4 && k < .98;
      if (!m.visible) return;
      var r = ud.r0 * (1 - U.easeIn(k)), a = ud.a0 + k * k * 9 * ud.spd + (t - ud.t0) * .25;
      m.position.set(ZP.x + Math.cos(a) * r, ZP.y + ud.h0 + 60 * Math.sin(k * Math.PI) - 20 * k, ZP.z + Math.sin(a) * r);
      m.rotation.set(t * ud.spd, t * .7 * ud.spd, 0);
      if (m.position.distanceTo(cam.position) < 170) m.visible = false;
    });
    if (O.fBus) {
      var bk = (t - 240.5) / 10.5; O.fBus.visible = bk > 0 && bk < 1;
      if (O.fBus.visible) {
        // v85 : il passe devant le joueur, un peu à gauche, vers 246 s (vidéo), puis spirale jusqu'au centre
        // v93 : l'angle de départ est pris UNE fois (à son apparition) — avant il suivait la caméra et restait collé au joueur
        if (O.fBusA0 == null || t < 240.6) O.fBusA0 = Math.atan2(cam.position.z - ZP.z, cam.position.x - ZP.x) + .9;
        var sp2 = (t - 246) * .32, rr = 300 * (1 - U.easeIn(bk)) + 6, aa = O.fBusA0 + sp2 + bk * bk * 2.5;
        O.fBus.position.set(ZP.x + Math.cos(aa) * rr, ZP.y + 34 + 120 * (1 - bk) * (1 - bk), ZP.z + Math.sin(aa) * rr);
        O.fBus.rotation.set(Math.sin(t * .9) * .5 * bk + .2, aa + 1.2 + t * .4 * bk, Math.cos(t * .7) * .6 * bk);
        O.fBus.scale.setScalar(1.35 * (1 - ramp(t, 249.4, 251)) + .01);
      }
    }
    O.mstreaks.forEach(function (tr, i) { var a0 = 238 + i * 2.6, k = (t - a0) / 4; tr.set(cl(k), .55, (k > 0 ? 1 : 0) * (1 - ramp(t, a0 + 4, a0 + 5.5)) * .9, t); });
    E.anchors = E.anchors || {}; if (!E.anchors.blackhole) E.anchors.blackhole = new T.Vector3(); E.anchors.blackhole.copy(c);
  }

  /* ============================================================ écran noir */
  function buildEnd() {
    O.endScene = new T.Scene(); O.endScene.background = new T.Color(0x000000);
    O.endStar = L.sprite(O.endScene, X.star, 0xe8f6ff, 30, true, 0); O.endFlare = L.sprite(O.endScene, X.flare, 0xcfe8ff, 200, true, 0);
    O.hole = L.sprite(O.endScene, X.hole, 0xffffff, 16, false, 0); O.holeGlow = L.sprite(O.endScene, X.soft, 0x1f3cff, 40, true, 0);
    O.endCam = new T.PerspectiveCamera(60, 1, .1, 1000);
  }
  function updateEnd(t, aspect) {
    var c = O.endCam; c.aspect = aspect; c.updateProjectionMatrix(); c.position.set(0, 0, 0); c.lookAt(0, 0, -1);
    var sd = win(t, 254.3, 266.5, .1, 6);
    O.endStar.position.set(0, -2, -100); O.endFlare.position.set(0, -2, -100.1);
    L.setOp(O.endStar, sd); O.endStar.scale.setScalar(26 * (1 - .8 * ramp(t, 254.5, 262)) + 3);
    L.setOp(O.endFlare, win(t, 254.3, 260, .1, 3) * .8); O.endFlare.scale.set(160 * (1 - .7 * ramp(t, 254.5, 259)), 12, 1);
    var hk = ramp(t, 270.6, 275.5);
    O.hole.position.set(0, 0, -100); O.holeGlow.position.set(0, 0, -100.2);
    L.setOp(O.hole, hk); O.hole.scale.setScalar(15 + .8 * Math.sin(t * 1.3)); O.hole.material.rotation = -t * .25;
    L.setOp(O.holeGlow, hk * (.22 + .06 * Math.sin(t * 2))); O.holeGlow.scale.setScalar(34 + 3 * Math.sin(t * .9));
  }

  /* ===================================================== voile plein écran */
  function veil() {
    if (O.veil) return O.veil;
    var d = document.createElement('div'); d.id = 'azend-veil';
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:#e9f6ff;transition:none;';
    document.body.appendChild(d); O.veil = d; return d;
  }
  /* Flashs rouges de la vidéo B (−20,7 / −19,9 / −17,5 / −16,8 / −3,3 / −2,5 / −1,75 s) : c'est le
   * faisceau tournant d'un gyrophare qui balaie la caméra quand on est tout près (1 tour = 0,75 s). */
  function beaconFlash(t, cam) {
    var best = 0;
    if (!O.beacons || t > 223.3) return 0;
    for (var i = 0; i < O.beacons.length; i++) {
      var b = O.beacons[i]; if (!b.red) continue;
      if (!b.wp) { b.wp = new T.Vector3(); b.s.getWorldPosition(b.wp); }
      var d = b.wp.distanceTo(cam.position); if (d > 26) continue;
      var az = Math.atan2(cam.position.z - b.wp.z, cam.position.x - b.wp.x), al = Math.cos(t * 8.4 + b.ph * 2.1 - az);
      if (al <= 0) continue;
      best = Math.max(best, Math.pow(al, 26) * (1 - ramp(d, 7, 26)));
    }
    return best;
  }
  var CAPF = [129.85, 132.2, 133.0, 133.9, 134.55, 135.15, 135.85, 137.15, 138.65, 139.65, 140.9, 141.8, 142.65, 143.2, 143.7, 144.5, 145.35, 146.45, 149.5, 150.25, 150.95, 151.95];
  function updateVeil(t, cam) {
    var v = veil(), col = '#e6f6ff', op = 0;
    // v89 : éclairs d'écran calés sur les flashs de la vidéo (et donc sur les « boums » de la musique)
    op = Math.max(op, win(t, 33.25, 34.6, .12, 1.1) * .06, win(t, 38.75, 39.7, .07, .6) * .3, win(t, 62.3, 63.0, .06, .5) * .1, win(t, 110.6, 111.6, .1, .9) * .08);
    op = Math.max(op, win(t, 75.05, 75.55, .05, .35) * .12, win(t, 75.8, 76.3, .05, .35) * .16, win(t, 76.15, 76.95, .06, .5) * .22, win(t, 77.4, 77.9, .05, .35) * .1);
    for (var cf = 0; cf < CAPF.length; cf++) { var c0 = CAPF[cf]; if (t > c0 - .1 && t < c0 + .6) op = Math.max(op, win(t, c0 - .05, c0 + .5, .05, .4) * .09); }
    op = Math.max(op, win(t, 152.6, 155.0, .12, 1.6) * .16, win(t, 155.4, 156.3, .06, .6) * .1, win(t, 183, 184.6, .15, 1.3) * .12, win(t, 216.05, 216.9, .06, .6) * .14);
    op = Math.max(op, win(t, 223.38, 225.4, .1, 1.6) * .55);
    var red = win(t, 188.7, 190.9, .55, .75);
    if (red * .22 > op) { col = '#d0304a'; op = red * .22; }
    var bf = cam ? beaconFlash(t, cam) * .62 : 0;
    if (bf > op) { col = '#ff2a3c'; op = bf; }
    if (t >= 254.5) op = 0;
    v.style.background = col; v.style.opacity = op.toFixed(3);
  }

  /* ========================================================== construction */
  function build() {
    low = !!(api.isMobile || api.quality === 'low');
    X = L.makeTextures(low);
    // v94 : île de référence — point de vue sur la colline au sud de la base, base de lancement près de
    // la Citadelle, météorite suspendue au-dessus de son cratère (près de la Méga Galerie), Point Zéro sur Loot Lake
    var s8 = root.AZSim && root.AZSim.s8, LK = root.AZSim && root.AZSim.LAKE;
    if (s8) { SPOT.px = s8.spot.px; SPOT.pz = s8.spot.pz; SPOT.bx = s8.launch.x; SPOT.bz = s8.launch.z; }
    P.set(SPOT.px, H(SPOT.px, SPOT.pz), SPOT.pz); BASE.set(SPOT.bx, H(SPOT.bx, SPOT.bz) + .4, SPOT.bz);
    F.set(BASE.x - P.x, 0, BASE.z - P.z).normalize(); R.crossVectors(F, UP).normalize();
    if (s8 && LK) ZP.set(LK.x, H(LK.x, LK.z) + 20, LK.z); else ZP.set(0, H(0, 0) + 20, 0);
    skyPos(LAY.imp[0], 0, LAY.imp[1], IMPACT); IMPACT.y = H(IMPACT.x, IMPACT.z);
    if (s8) { IMPACT.set(s8.meteor.x, 0, s8.meteor.z); IMPACT.y = H(IMPACT.x, IMPACT.z); }
    STAR.copy(ZP).add(new T.Vector3(0, 1350, 0));
    skyPos(LAY.met[0], LAY.met[1], LAY.met[2], MET_B);
    if (s8) MET_B.set(IMPACT.x, IMPACT.y + 115, IMPACT.z);
    MET_A.copy(MET_B); MET_A2.copy(MET_B);
    // la météorite file vers le bas-gauche de l'écran (panache vers le haut-droite, ~47°) quand on la regarde
    var my = LAY.met[0] * D2R; tmp.copy(F).multiplyScalar(Math.sin(my)).addScaledVector(R, -Math.cos(my));
    MDIR.copy(tmp).multiplyScalar(.68).addScaledVector(UP, -.73).addScaledVector(dirYP(LAY.met[0], 0, tmp2), .12).normalize();
    grp = new T.Group(); grp.name = 'end81'; api.scene().add(grp);
    O.smoke = new L.SmokeSystem(low ? 420 : 720, X.smoke); grp.add(O.smoke.mesh);
    buildSky(); buildBase(); buildFlora(); buildLava(); buildLaunch(); buildBursts(); buildAurora(); buildIsland(); buildMeteor(); buildZenith(); buildMeteor2(); buildFinale(); buildEnd(); buildTrails(); buildCapture();
    O.hemi = new T.HemisphereLight(0x6f9fff, 0x1d4a2a, 0); grp.add(O.hemi);
    built = true;
  }

  /* ============================================================== rendu */
  var hooked = null, post = null, saved = null, black = false;
  function lightsNight(t, cam) {
    var v = view; if (!v) return;
    var dark = ramp(t, 157.6, 160) * (1 - ramp(t, 176.4, 177.8)), space = ramp(t, 223.3, 224.6);
    var red = win(t, 188.7, 190.9, .55, .75), bright = win(t, 140.5, 153.4, 6, 1.2);
    var glowGround = O.gLight ? O.gLight.intensity : 0;
    if (v.hemi) { v.hemi.color.set(0x8ab8ff); v.hemi.groundColor.set(0x2a6a3c); v.hemi.intensity = (lerp(1.42, .45, dark) + .7 * bright) * (1 - .42 * space); v.hemi.color.lerp(HEMI_BR, Math.max(bright * .5, space * .6)); }
    if (v.sun) {
      v.sun.color.set(space > .5 ? 0x6f8cff : 0xc4dcff); v.sun.intensity = lerp(1.25, .3, dark) * (1 - .7 * space);
      var p = api.player(); if (p) { v.sun.position.set(p.x, p.y, p.z).addScaledVector(dirYP(LAY.moon[0], LAY.moon[1], tmp), 160); v.sun.target.position.set(p.x, p.y, p.z); v.sun.target.updateMatrixWorld(); }
    }
    if (v.skyFill) { v.skyFill.color.set(0x5f9cff); v.skyFill.intensity = .25 * (1 - space); }
    O.hemi.intensity = 0;
    var sc = v.scene; if (sc.fog) { sc.fog.color.setRGB(lerp(lerp(.12, .02, dark), .01, space), lerp(lerp(.33, .06, dark), .015, space), lerp(lerp(.50, .12, dark), .04, space)); sc.fog.density = lerp(.00042, .00028, space); }
    v.renderer.toneMappingExposure = lerp(lerp(1.3, .95, dark), .92, space) + .18 * bright;
    var su = O.sky.material.uniforms; su.time.value = t; su.red.value = red; su.space.value = space; su.dark.value = dark; su.glow.value = 1 - .7 * dark; su.bright.value = bright * .35;
    O.sky.position.copy(cam.position); O.stars.position.copy(cam.position); O.stars2.position.copy(cam.position);
    O.stars.material.uniforms.time.value = t; O.stars.material.uniforms.amt.value = 1 - .3 * red;
    O.stars2.material.uniforms.time.value = t; O.stars2.material.uniforms.amt.value = space * 1.2;
    var px = v.renderer.getPixelRatio(); O.stars.material.uniforms.px.value = px; O.stars2.material.uniforms.px.value = px;
    O.moon.position.copy(cam.position).addScaledVector(dirYP(LAY.moon[0], LAY.moon[1], tmp), 2500); O.moon.scale.setScalar(720); O.moonHalo.position.copy(O.moon.position);
    L.setOp(O.moon, (1 - space) * (1 - .8 * dark)); L.setOp(O.moonHalo, (1 - space) * (.34 - .26 * dark) * (1 - red)); O.moonHalo.scale.setScalar(2600);
    var ab = Math.max(ramp(t, 44.5, 51) * (1 - ramp(t, 70, 79)), win(t, 90, 119, 3, 2.5) * .45, win(t, 158.4, 177, 1.5, 1.5) * .55, win(t, 200, 223, 2, 1) * .5);
    O.aur.forEach(function (m, i) { m.material.uniforms.time.value = t + i * 7; m.material.uniforms.alpha.value = ab * (i >= 6 ? .26 : .4); m.visible = ab > .003; });
    O.lava.forEach(function (l) { l.mesh.material.opacity = (.55 + .2 * Math.sin(t * 2 + l.seed)) * (1 - space * .6); L.setOp(l.glow, .22 * (1 - space)); });
    O.grass.material.uniforms.time.value = t;
    var gt = O.grass.material.uniforms.tint.value; gt.setRGB(1, 1, 1).multiplyScalar(lerp(lerp(1, .55, dark), .35, space)); gt.g += .25 * cl(glowGround / 9) * 0;
    return { dark: dark, space: space };
  }
  var TAN65 = Math.tan(32.5 * D2R);
  function fovFor(f, aspect) {
    var vt = 2 * Math.atan(Math.tan(40 * D2R) / Math.max(.3, aspect || 1.78)) / D2R; vt = Math.max(42, Math.min(72, vt));
    return Math.min(80, 2 * Math.atan(Math.tan(f * D2R / 2) * Math.tan(vt * D2R / 2) / TAN65) / D2R);
  }
  function hookRender() {
    var v = view, r = v && v.renderer; if (!r || hooked) return;
    var inner = r.render;
    // v85 : le halo lumineux aussi en qualité basse / mobile (version légère), dès que WebGL2 est là
    if (r.capabilities && r.capabilities.isWebGL2) { try { post = new L.Post(r, low); } catch (e) { post = null; } }
    var wrapped = function (scene, cam) {
      if (on && built && scene === v.scene && cam === v.camera && r.getRenderTarget() === null) {
        // v85 — caméra Fortnite : 80° d'angle horizontal (mesuré sur la vidéo) au lieu des 97° du jeu,
        // le temps du rendu seulement (le jeu garde ses propres valeurs, visée comprise).
        var f0 = cam.fov, pl = null; try { pl = api.player(); } catch (e) {}
        var narrow = !!(pl && pl.deployed);
        if (narrow) { cam.fov = fovFor(f0, cam.aspect); cam.updateProjectionMatrix(); }
        try { return renderEvent.call(this, scene, cam, arguments); }
        finally { if (narrow) { cam.fov = f0; cam.updateProjectionMatrix(); } }
      }
      return inner.apply(this, arguments);
    };
    var renderEvent = function (scene, cam, args) {
      var t = VT();
      try { prepare(t, cam); } catch (e) { if (!wrapped.err) { wrapped.err = 1; console.error('[AZUR end81] prepare', e); } }
      if (t >= 254.5 && !black) black = true; else if (t < 254.5 && black) black = false;
      if (black) { updateEnd(t, cam.aspect); return inner.call(this, O.endScene, O.endCam); }
      if (post && !post.failed) {
        try {
          var cu = post.comp.uniforms; cu.time.value = t;
          cu.warp.value = win(t, 223.5, 227.5, .3, 2.5) * .42 + win(t, 246, 252.6, 2, .5) * .12;
          cu.strength.value = .75; cu.wide.value = .42; cu.vig.value = .32 + .25 * ramp(t, 224, 230);
          if (cu.grade) { cu.grade.value = ramp(t, 223.4, 226) * .6; cu.squash.value = Math.pow(ramp(t, 252.3, 254.45), 1.6); }
          tmp.copy(O.fxC || ZP).project(cam); cu.warpC.value.set(tmp.x * .5 + .5, tmp.y * .5 + .5);
          post.render(inner, scene, cam); return;
        } catch (e) { post.failed = true; r.setRenderTarget(null); console.error('[AZUR end81] post', e); }
      }
      return inner.apply(this, args);
    };
    wrapped.__end81 = true; r.render = wrapped; hooked = { r: r, inner: inner, wrapped: wrapped };
  }
  function unhookRender() {
    if (!hooked) return;
    if (hooked.r.render === hooked.wrapped) hooked.r.render = hooked.inner;
    if (post) { try { post.dispose(); } catch (e) {} post = null; }
    hooked = null;
  }
  function hideWorldSky(on2) {
    var v = view; if (!v) return;
    var w2 = v.worldV2 || (v.environment && v.environment.worldV2);
    if (on2) {
      saved = saved || {};
      if (w2 && w2.sky && saved.v2sky === undefined) { saved.v2sky = w2.sky.visible; }
      if (w2 && w2.clouds && saved.v2clouds === undefined) { saved.v2clouds = w2.clouds.visible; }
    } else if (saved) {
      if (w2 && w2.sky && saved.v2sky !== undefined) w2.sky.visible = saved.v2sky;
      if (w2 && w2.clouds && saved.v2clouds !== undefined) w2.clouds.visible = saved.v2clouds;
      saved = null;
    }
  }
  /* Les arbres de l'île (couleur matériau × couleur d'instance, très sombres la
   * nuit) ressortaient en silhouettes noires : pendant l'événement on éclaircit
   * leur teinte de base, comme les arbres bien verts de la vidéo. */
  function brightenFlora() {
    if (O.floraDone) return;
    var v = view, w2 = v && (v.worldV2 || (v.environment && v.environment.worldV2)); if (!w2) return;
    O.floraDone = true; O.floraSaved = [];
    [w2.flora, w2.palms].forEach(function (g) {
      (g && g.userData && g.userData.meshes || []).forEach(function (m) {
        var mt = m && m.material; if (!mt || !mt.color) return;
        O.floraSaved.push([mt, mt.color.clone()]); mt.color.lerp(new T.Color(1, 1, 1), .72);
      });
    });
  }
  function prepare(t, cam) {
    frame++;
    if (!O.floraDone) { try { brightenFlora(); } catch (e) { O.floraDone = true; } }
    camPos.copy(cam.position); cam.getWorldDirection(camFwd);
    var v = view, w2 = v.worldV2 || (v.environment && v.environment.worldV2);
    if (w2) { if (w2.sky) w2.sky.visible = false; if (w2.clouds) w2.clouds.visible = false; }
    if (v.environment && v.environment.clouds) v.environment.clouds.visible = false;
    if (v.environment && v.environment.sky) v.environment.sky.visible = false;
    if (v.environment && v.environment.stars) v.environment.stars.visible = false;
    lightsNight(t, cam);
    O.smoke.begin(); meteorOff(t, MOFF);
    updateLaunch(t); updateBase(t, cam); updateIsland(t); updateSkyShow(t, cam); updateRifts(t, cam); updateTrails(t); updateMeteor(t, cam); updateImpact(t); updateBooms(t);
    updateZenith(t, cam); updateMeteor2(t); updateFinale(t, cam); updateVeil(t, cam);
    if (t > 153.2 && t < 192.5) E.meteorVisible = false;
    if (t > 216.4) E.meteorVisible = false;
    O.smoke.mat.uniforms.lightCol.value.setRGB(1, 1, 1); O.smoke.mat.uniforms.shadeCol.value.setRGB(.42, .46, .62);
    O.smoke.end(cam);
    lastT = t;
  }

  /* ============================================================ cycle de vie */
  function init(a) {
    api = a; G = api.game(); view = api.view(); on = true; frame = 0; black = false;
    RIFTS = []; TRAILS = []; FLASHES = []; BOOMS = []; STRIKES = []; O = {};
    try { build(); } catch (e) { console.error('[AZUR end81] build', e); }
    if (G) { O.prevTOD = G.timeOfDay; G.timeOfDay = 'night'; }
    hideWorldSky(true); hookRender();
    O.volcHidden = []; try { api.scene().traverse(function (o) { if (o.isPoints && o.visible && o.material && o.material.vertexShader && o.material.vertexShader.indexOf('t*320.') >= 0) { O.volcHidden.push(o); o.visible = false; } }); } catch (e) {}
    E.end81 = { S: L.S, skyPos: skyPos, O: O, TRAILS: TRAILS, FLASHES: FLASHES, RIFTS: RIFTS, meteorPos: meteorPos };
  }
  function update() {
    if (!on) return;
    if (G) G.timeOfDay = 'night';
    if (!hooked) hookRender();
  }
  function dispose() {
    on = false; unhookRender(); hideWorldSky(false);
    (O.volcHidden || []).forEach(function (o) { o.visible = true; });
    (O.floraSaved || []).forEach(function (f) { f[0].color.copy(f[1]); });
    if (grp && grp.parent) grp.parent.remove(grp);
    grp = null; built = false;
    if (O.veil && O.veil.parentNode) O.veil.parentNode.removeChild(O.veil);
    if (G && O.prevTOD) G.timeOfDay = O.prevTOD;
    E.meteorVisible = false; E.meteorPos = null; E.zeroPointPos = null; E.end81 = null;
    O = {}; RIFTS = []; TRAILS = []; FLASHES = []; BOOMS = []; STRIKES = [];
  }
  root.__end81Seek = function () { return { t: VT(), frame: frame, black: black, post: !!(post && !post.failed) }; };
  E.register('end81', { init: init, update: update, dispose: dispose });
})(window);
