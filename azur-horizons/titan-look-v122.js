/* AZUR v122 — le Colosse, Titan du mode « Gant du Titan ». Design original : un colosse massif à la peau de basalte
 * veinée de magma, torse nu, épaulières de roche, couronne d'éclats de pierre, et le Gant du Titan (obsidienne, bronze et
 * un gros cristal de magma) à la main droite.
 * Le corps est vraiment épais : le maillage du personnage est gonflé autour de chaque os (bras, cuisses, torse, cou —
 * la tête garde sa taille), les épaules et les hanches sont élargies. Tout est fait une seule fois sur le gabarit du
 * personnage (ch1-models-v93) : chaque Titan créé ensuite en hérite et garde toutes les animations du jeu.
 * Chargé AVANT ch1-models-v93.js (la tenue s'ajoute à la liste) ; AZTitanLook.install() est appelé ensuite. */
(function (root) {
  "use strict";
  var T = root.THREE; if (!T) return;
  var ID = "char-titan-colosse", RAW = ID + "-brut";
  // réglages : la tenue (peau de basalte, pantalon d'armure sombre, bottes, ceinture de bronze)
  var LOOK = { body: "m", skin: "#4b3e37", hair: null, t: null, b: { c: "#1d1b1f", c2: "#2c282b", pat: "armor" }, s: { c: "#18161a", sole: "#ff6a1a" }, g: { c: "#211d1f" }, belt: "#3d2918", buckle: "#ff8a2a", gear: ["boots"], acc: [] };
  var L0 = {}; L0[ID] = LOOK; L0[RAW] = LOOK;
  root.AZ_EXTRA_LOOKS = Object.assign(root.AZ_EXTRA_LOOKS || {}, L0);
  // réglages : épaisseur du corps (facteur appliqué à l'écart de la peau autour de l'os ; torse = [côtés, avant-arrière])
  var K = { pelvis: [1.42, 1.32], spine_01: [1.46, 1.4], spine_02: [1.6, 1.45], spine_03: [1.74, 1.5], neck_01: [1.62, 1.55],
    clavicle: 1.55, upperarm: 1.8, lowerarm: 1.64, hand: 1.34, finger: 1.26, thigh: 1.56, calf: 1.5, foot: 1.2, ball: 1.12 };
  var TORSO = { pelvis: 1, spine_01: 1, spine_02: 1, spine_03: 1, neck_01: 1 };
  var SHOULDER = .055, HIP = .028; // élargissement des épaules et des hanches (m, avant l'échelle du Titan)
  var SCALE = 1.75; // taille du Titan par rapport à un joueur
  var C = { rock: 0x2a2523, rockHi: 0x4a403b, bronze: 0xb07a3a, bronzeDark: 0x6b4522, obsidian: 0x141217, magma: 0xff6a1a, magmaHot: 0xffc070 };

  var MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      rock: new T.MeshStandardMaterial({ color: C.rock, roughness: .92, metalness: .05, flatShading: true }),
      rockHi: new T.MeshStandardMaterial({ color: C.rockHi, roughness: .85, metalness: .05, flatShading: true }),
      bronze: new T.MeshStandardMaterial({ color: C.bronze, roughness: .34, metalness: .85 }),
      bronzeDark: new T.MeshStandardMaterial({ color: C.bronzeDark, roughness: .45, metalness: .8 }),
      obsidian: new T.MeshStandardMaterial({ color: C.obsidian, roughness: .22, metalness: .35 }),
      magma: new T.MeshStandardMaterial({ color: C.magma, emissive: C.magma, emissiveIntensity: 2.2, roughness: .4, metalness: 0 }),
      crystal: new T.MeshStandardMaterial({ color: C.magmaHot, emissive: C.magma, emissiveIntensity: 2.8, roughness: .12, metalness: .1, transparent: true, opacity: .95, flatShading: true })
    };
    Object.keys(MAT).forEach(function (k) { MAT[k].userData.shared = true; });
    return MAT;
  }
  function mesh(g, m) { var o = new T.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; o.userData.shared = true; o.userData.azTitanPart = true; return o; }
  function rockGeo(r, seed, detail) { // éclat de roche anguleux
    var g = new T.IcosahedronGeometry(r, detail || 0), p = g.attributes.position, v = new T.Vector3();
    for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); var n = .82 + .36 * Math.abs(Math.sin(v.x * 9.1 + seed) * Math.cos(v.y * 7.3 + seed * 1.7) + .3 * Math.sin(v.z * 13 + seed)); p.setXYZ(i, v.x * n, v.y * n, v.z * n); }
    g.computeVertexNormals(); return g;
  }

  /* Le Gant du Titan, dans son repère : doigts vers -Y, dos de la main vers +Z. Utilisé aussi pour le gant posé au sol. */
  function gauntlet(scale) {
    var m = mats(), g = new T.Group(); g.name = "titan-gauntlet";
    var cuff = mesh(new T.CylinderGeometry(.068, .054, .17, 14), m.bronze); cuff.position.y = .08; g.add(cuff);
    var ring = mesh(new T.TorusGeometry(.064, .013, 8, 22), m.bronzeDark); ring.rotation.x = Math.PI / 2; ring.position.y = .16; g.add(ring);
    var ring2 = mesh(new T.TorusGeometry(.056, .011, 8, 22), m.bronzeDark); ring2.rotation.x = Math.PI / 2; g.add(ring2);
    var palm = mesh(new T.SphereGeometry(1, 16, 12), m.obsidian); palm.scale.set(.06, .07, .036); palm.position.y = -.06; g.add(palm);
    var back = mesh(new T.SphereGeometry(1, 16, 12), m.bronze); back.scale.set(.058, .062, .02); back.position.set(0, -.058, .026); g.add(back);
    var core = mesh(new T.OctahedronGeometry(.032, 0), m.crystal); core.name = "tg-core"; core.scale.set(1, 1.35, .6); core.position.set(0, -.056, .046); g.add(core);
    // doigts articulés (pivot à la jointure) : le poing peut se serrer (titan-fx-v123.js les plie, rotation.x > 0 = vers la paume)
    for (var i = 0; i < 4; i++) {
      var x = -.039 + i * .026, pv = new T.Group(); pv.name = "tg-finger"; pv.position.set(x, -.112, .004); g.add(pv);
      var f = mesh(new T.CapsuleGeometry(.0115, .058, 4, 8), m.obsidian); f.position.set(0, -.043, 0); pv.add(f);
      var tip = mesh(new T.ConeGeometry(.008, .016, 6), m.bronze); tip.position.set(0, -.083, 0); tip.rotation.x = Math.PI; pv.add(tip);
      var kn = mesh(new T.ConeGeometry(.009, .03, 6), m.bronze); kn.position.set(x, -.112, .036); kn.rotation.x = Math.PI / 2; g.add(kn);
    }
    var tp = new T.Group(); tp.name = "tg-thumb"; tp.position.set(.05, -.06, .014); g.add(tp);
    var th = mesh(new T.CapsuleGeometry(.013, .04, 4, 8), m.obsidian); th.position.set(.014, -.02, 0); th.rotation.z = -.6; tp.add(th);
    for (var v = 0; v < 3; v++) { var ln = mesh(new T.BoxGeometry(.005, .08, .004), m.magma); ln.position.set(-.024 + v * .024, .08, .066); g.add(ln); }
    if (scale) g.scale.setScalar(scale);
    return g;
  }

  /* ---------------------------------------------------------------- gabarit : corps épaissi + armure */
  var _v = new T.Vector3(), _a = new T.Vector3(), _c = new T.Vector3(), _o = new T.Vector3(), _p = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3();
  function boneKind(n) {
    if (TORSO[n]) return n;
    if (/^clavicle/.test(n)) return "clavicle"; if (/^upperarm/.test(n)) return "upperarm"; if (/^lowerarm/.test(n)) return "lowerarm";
    if (/^hand_/.test(n)) return "hand"; if (/^(index|middle|ring|pinky|thumb)_/.test(n)) return "finger";
    if (/^thigh/.test(n)) return "thigh"; if (/^calf/.test(n)) return "calf"; if (/^foot/.test(n)) return "foot"; if (/^ball/.test(n)) return "ball";
    return null;
  }
  var CHILD = { pelvis: "spine_01", spine_03: "neck_01", hand_l: "middle_01_l", hand_r: "middle_01_r" };
  function buildFrame(body) {
    var sk = body.skeleton, F = { P: {}, W: {}, seg: {} };
    sk.bones.forEach(function (b, i) { var w = new T.Matrix4().copy(sk.boneInverses[i]).invert(); F.W[b.name] = w; F.P[b.name] = new T.Vector3().setFromMatrixPosition(w); });
    var P = F.P; F.up = P.neck_01.clone().sub(P.pelvis).normalize();
    F.lat = P.upperarm_l.clone().sub(P.upperarm_r); F.lat.addScaledVector(F.up, -F.lat.dot(F.up)).normalize();
    F.fwd = new T.Vector3().crossVectors(F.lat, F.up).normalize();
    sk.bones.forEach(function (b) {
      var kind = boneKind(b.name); if (!kind) return;
      var cn = CHILD[b.name] || ((b.children.filter(function (c) { return c.isBone; })[0] || {}).name), a = P[b.name], e = cn && P[cn];
      if (!e) { var par = b.parent && P[b.parent.name]; e = a.clone().add(par ? a.clone().sub(par).normalize().multiplyScalar(.06) : F.up.clone().multiplyScalar(.06)); }
      var d = e.clone().sub(a), len2 = Math.max(1e-6, d.lengthSq());
      var k = K[kind], torso = !!TORSO[kind];
      F.seg[b.name] = { a: a, d: d, len2: len2, u: d.clone().normalize(), k1: torso ? k[0] : k, k2: torso ? k[1] : k, torso: torso };
    });
    return F;
  }
  function displace(F, name, p, out) {
    var s = F.seg[name]; if (!s) return out.copy(p);
    _a.copy(p).sub(s.a); var t = Math.min(1, Math.max(0, _a.dot(s.d) / s.len2));
    _c.copy(s.a).addScaledVector(s.d, t); _o.copy(p).sub(_c);
    var along = _o.dot(s.u); _p.copy(_o).addScaledVector(s.u, -along);
    if (s.torso) { var pl = _p.dot(F.lat), pf = _p.dot(F.fwd); _p.addScaledVector(F.lat, pl * (s.k1 - 1)).addScaledVector(F.fwd, pf * (s.k2 - 1)); }
    else _p.multiplyScalar(s.k1);
    return out.copy(_c).addScaledVector(s.u, along).add(_p);
  }
  function inflateMesh(F, m, keep0) {
    var g = m.geometry.clone(), pa = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = m.skeleton.bones;
    if (!pa || !si || !sw) return;
    if (keep0) g.setAttribute("position0", pa.clone());
    var bm = m.bindMatrix, bmi = m.bindMatrixInverse, acc = new T.Vector3(), one = new T.Vector3(), vb = new T.Vector3();
    var get = [function (a, i) { return a.getX(i); }, function (a, i) { return a.getY(i); }, function (a, i) { return a.getZ(i); }, function (a, i) { return a.getW(i); }];
    for (var i = 0; i < pa.count; i++) {
      vb.fromBufferAttribute(pa, i).applyMatrix4(bm); acc.set(0, 0, 0); var ws = 0;
      for (var q = 0; q < 4; q++) { var w = get[q](sw, i); if (!(w > 0)) continue; var b = bones[get[q](si, i)]; displace(F, b ? b.name : "", vb, one); acc.addScaledVector(one, w); ws += w; }
      if (ws > 0) acc.multiplyScalar(1 / ws); else acc.copy(vb);
      acc.applyMatrix4(bmi); pa.setXYZ(i, acc.x, acc.y, acc.z);
    }
    pa.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); g.userData.ch1Keep = true;
    m.geometry = g;
    if (m.boundingSphere) m.boundingSphere.radius *= 1.45;
  }
  // veines de magma sur la peau (torse, bras, cou) : fissures lumineuses qui palpitent doucement
  var VEIN_DECL = "\nuniform float tvTime;\nfloat tvH(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat tvN(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(tvH(i),tvH(i+vec3(1,0,0)),f.x),mix(tvH(i+vec3(0,1,0)),tvH(i+vec3(1,1,0)),f.x),f.y),mix(mix(tvH(i+vec3(0,0,1)),tvH(i+vec3(1,0,1)),f.x),mix(tvH(i+vec3(0,1,1)),tvH(i+vec3(1,1,1)),f.x),f.y),f.z);}\n";
  var VEIN_FRAG = "\n{ vec3 tb=vBind; if(tb.y>bodyL2.x+.035&&tb.y<bodyL2.w-.01&&abs(tb.x)<tvWrist){ float n=tvN(tb*13.)*.62+tvN(tb*29.+3.1)*.38; float cr=1.-smoothstep(.0,.022,abs(n-.5)); cr*=smoothstep(.3,.7,tvN(tb*5.+7.)); float pul=.72+.28*sin(tvTime*2.3+tb.y*9.); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.34,.06),cr*.8); ch1Emit+=vec3(1.,.3,.04)*cr*1.35*pul; } }\n";
  var veinUniform = { value: 0 };
  function patchBodyMaterial(mat, wristX) {
    if (!mat || mat.userData.azTitanPatched || typeof mat.onBeforeCompile !== "function") return;
    // world-split.js fait de onBeforeCompile un accesseur (sa fonction appelle celle de la matière, rangée dans _azUser) :
    // on part de la fonction de la matière elle-même, sinon les deux s'appelleraient sans fin
    var base = mat._azUser || mat.onBeforeCompile;
    mat.onBeforeCompile = function (sh, r) {
      base.call(this, sh, r);
      sh.uniforms.tvTime = veinUniform;
      sh.vertexShader = sh.vertexShader.replace("attribute vec4 aZone;", "attribute vec4 aZone; attribute vec3 position0;").replace("vBind = position;", "vBind = position0;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>" + VEIN_DECL + "\nconst float tvWrist=" + (wristX - .03).toFixed(3) + ";")
        .replace("#include <roughnessmap_fragment>", VEIN_FRAG + "#include <roughnessmap_fragment>");
    };
    mat.customProgramCacheKey = function () { return "ch1paint-titan-v122"; };
    mat.userData.azTitanPatched = true; mat.needsUpdate = true;
  }
  function shiftBone(F, bone, dWorld) {
    var pw = bone.parent && F.W[bone.parent.name]; if (!pw) return;
    pw.decompose(_v, _q, _s); var loc = dWorld.clone().applyQuaternion(_q.clone().invert()); loc.x /= _s.x || 1; loc.y /= _s.y || 1; loc.z /= _s.z || 1;
    bone.position.add(loc); bone.updateMatrix();
  }
  // une pièce d'armure posée dans l'espace de liaison et rattachée à un os (elle suit l'os dans toutes les animations)
  function attachBind(F, sk, boneName, obj, pos, quat, scale) {
    var i = sk.bones.findIndex(function (b) { return b.name === boneName; }); if (i < 0) return null;
    var place = new T.Matrix4().compose(pos, quat || new T.Quaternion(), new T.Vector3(scale || 1, scale || 1, scale || 1));
    obj.matrixAutoUpdate = false; obj.matrix.copy(sk.boneInverses[i]).multiply(place); obj.userData.azTitanPart = true;
    sk.bones[i].add(obj); return obj;
  }
  function qFromTo(a, b) { return new T.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); }
  // point de la peau (gonflée) le plus loin dans une direction, près d'un point donné : sert à poser l'armure contre le corps
  function surfaceExtent(body, center, dir, radius) {
    var pa = body.geometry.attributes.position, best = -1e9, v = new T.Vector3(), bm = body.bindMatrix;
    for (var i = 0; i < pa.count; i += 2) { v.fromBufferAttribute(pa, i).applyMatrix4(bm); if (v.distanceTo(center) > radius) continue; var d = v.clone().sub(center).dot(dir); if (d > best) best = d; }
    return best > -1e8 ? best : 0;
  }
  function armour(F, body, sk, L) {
    var m = mats(), P = F.P, up = F.up, lat = F.lat, fwd = F.fwd;
    // épaulières de roche (une coque bombée, un liseré de bronze, trois pointes de roche aux bouts de magma)
    [1, -1].forEach(function (s) {
      var bn = s > 0 ? "clavicle_l" : "clavicle_r", sh = P[s > 0 ? "upperarm_l" : "upperarm_r"], out = lat.clone().multiplyScalar(s);
      var lift = surfaceExtent(body, sh, up, .16), side = surfaceExtent(body, sh, out, .14);
      var c = sh.clone().addScaledVector(up, Math.max(.04, lift - .02)).addScaledVector(out, Math.max(0, side * .35));
      var g = new T.Group();
      var dome = mesh(new T.SphereGeometry(.15, 16, 9, 0, Math.PI * 2, 0, Math.PI * .56), m.rock); dome.scale.set(1.08, .78, 1.15); g.add(dome);
      var rim = mesh(new T.TorusGeometry(.142, .016, 8, 26), m.bronze); rim.rotation.x = Math.PI / 2; rim.scale.set(1.08, 1.15, 1); rim.position.y = .006; g.add(rim);
      for (var k = 0; k < 3; k++) {
        var sp = mesh(rockGeo(.05, k * 3 + s, 0), m.rockHi); sp.scale.set(.55, 1.6 - k * .25, .55); sp.position.set((k - 1) * .065, .1 - Math.abs(k - 1) * .025, -.01); sp.rotation.z = (k - 1) * -.35; g.add(sp);
        var tip = mesh(new T.OctahedronGeometry(.018, 0), m.crystal); tip.position.set((k - 1) * .08, .17 - Math.abs(k - 1) * .045, -.01); g.add(tip);
      }
      // la coque regarde vers le haut et un peu vers l'extérieur
      var q = qFromTo(new T.Vector3(0, 1, 0), up.clone().multiplyScalar(.8).addScaledVector(out, .45));
      attachBind(F, sk, bn, g, c, q, 1);
    });
    // couronne d'éclats de roche et cristal frontal
    var hc = new T.Vector3(0, L.headTop - .035, L.headZ), crown = new T.Group(), n = 7;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.PI / 2, r = (L.headRX || .085) * 1.02, sh2 = mesh(rockGeo(.03, i * 1.7, 0), i % 2 ? m.rock : m.rockHi);
      sh2.scale.set(.6, 1.9 + (i === 0 ? .8 : 0) - (i % 2) * .5, .6); sh2.position.set(Math.cos(a) * r, .03, Math.sin(a) * r);
      sh2.rotation.set(Math.sin(a) * .45, 0, -Math.cos(a) * .45); crown.add(sh2);
    }
    var band = mesh(new T.TorusGeometry((L.headRX || .085) * 1.04, .012, 8, 28), m.bronzeDark); band.rotation.x = Math.PI / 2; crown.add(band);
    attachBind(F, sk, "Head", crown, hc, qFromTo(new T.Vector3(0, 1, 0), up), 1);
    var gem = mesh(new T.OctahedronGeometry(.017, 0), m.crystal); gem.scale.set(.8, 1.3, .5);
    attachBind(F, sk, "Head", gem, new T.Vector3(0, L.eyeY + .055, (L.headFront || L.eyeZ) - .002), null, 1);
    // plaque de ceinture avec son cœur de magma
    var wc = new T.Vector3(0, L.waistY - .015, 0), front = surfaceExtent(body, wc, fwd, .2);
    var plate = new T.Group(), disc = mesh(new T.CylinderGeometry(.07, .075, .03, 8), m.bronze); disc.rotation.x = Math.PI / 2; plate.add(disc);
    var heart = mesh(new T.OctahedronGeometry(.03, 0), m.crystal); heart.scale.set(1, 1.2, .55); heart.position.z = .02; plate.add(heart);
    attachBind(F, sk, "pelvis", plate, wc.clone().addScaledVector(fwd, front + .005), qFromTo(new T.Vector3(0, 0, 1), fwd), 1);
    // brassard de roche à l'avant-bras gauche
    var la = P.lowerarm_l, lh = P.hand_l, mid = la.clone().lerp(lh, .55), dir = lh.clone().sub(la);
    var br = new T.Group(), cyl = mesh(new T.CylinderGeometry(.075, .068, .17, 9), m.rock); br.add(cyl);
    [-.06, .06].forEach(function (y) { var b2 = mesh(new T.TorusGeometry(.073, .01, 6, 20), m.bronze); b2.rotation.x = Math.PI / 2; b2.position.y = y; br.add(b2); });
    attachBind(F, sk, "lowerarm_l", br, mid, qFromTo(new T.Vector3(0, 1, 0), dir), 1);
    // le Gant du Titan à la main droite : dans l'axe de l'avant-bras, dos de la main vers le haut (pose de liaison en T)
    var ra = P.lowerarm_r, rh = P.hand_r, dr = rh.clone().sub(ra).normalize(), gl = gauntlet(1);
    var gq = qFromTo(new T.Vector3(0, -1, 0), dr), backNow = new T.Vector3(0, 0, 1).applyQuaternion(gq), backWant = up.clone().addScaledVector(dr, -up.dot(dr)).normalize();
    var ang = Math.atan2(new T.Vector3().crossVectors(backNow, backWant).dot(dr), backNow.dot(backWant));
    gq.premultiply(new T.Quaternion().setFromAxisAngle(dr, ang));
    attachBind(F, sk, "hand_r", gl, rh.clone().addScaledVector(dr, .045), gq, 1.42);
  }
  function makeTitan(tpl) {
    var meshes = [], body = null;
    // le corps est le seul maillage qui porte les zones de peinture (aZone) — les sourcils ont aussi un matériau « rigide »
    tpl.root.traverse(function (o) { if (o.isSkinnedMesh) { meshes.push(o); if (o.geometry && o.geometry.attributes.aZone && !body) body = o; } });
    if (!body) body = meshes[0]; if (!body) return tpl;
    var F = buildFrame(body), sk = body.skeleton;
    meshes.forEach(function (m) { if (!/Eye|eye/.test(m.name || "") && (m.material && !/Eyes/.test(m.material.name || ""))) inflateMesh(F, m, m === body); });
    patchBodyMaterial(body.material, (tpl.L && tpl.L.wristX) || .7);
    // épaules et hanches élargies (seuls les os du bassin bougent dans les animations : on peut déplacer les autres)
    sk.bones.forEach(function (b) {
      if (b.name === "clavicle_l") shiftBone(F, b, F.lat.clone().multiplyScalar(SHOULDER));
      if (b.name === "clavicle_r") shiftBone(F, b, F.lat.clone().multiplyScalar(-SHOULDER));
      if (b.name === "thigh_l") shiftBone(F, b, F.lat.clone().multiplyScalar(HIP));
      if (b.name === "thigh_r") shiftBone(F, b, F.lat.clone().multiplyScalar(-HIP));
    });
    armour(F, body, sk, tpl.L || {});
    tpl.titan = true;
    return tpl;
  }
  /* Le gabarit du Colosse est fabriqué à la demande : on prépare l'entrée de ch1-models pour qu'elle construise d'abord
   * la tenue brute, puis la transforme (corps épaissi + armure) avant le premier affichage. */
  function install() {
    var M = root.AZCh1Models; if (!M || !M.templates || !M.getTemplate) return false;
    if (M.templates[ID]) return true;
    var lazy = { ready: null, _p: null };
    lazy.then = function (a, b) { if (!this._p) this._p = M.getTemplate(RAW).then(makeTitan); return this._p.then(a, b); };
    lazy.catch = function (b) { return this.then(null, b); };
    M.templates[ID] = lazy;
    return true;
  }
  var t0 = (root.performance && performance.now()) || 0;
  function tick() { veinUniform.value = (((root.performance && performance.now()) || 0) - t0) / 1000; root.requestAnimationFrame && root.requestAnimationFrame(tick); }
  if (root.requestAnimationFrame) root.requestAnimationFrame(tick);
  root.AZTitanLook = { ID: ID, SCALE: SCALE, install: install, gauntlet: gauntlet, colors: C, makeTitan: makeTitan };
})(typeof globalThis !== "undefined" ? globalThis : this);
