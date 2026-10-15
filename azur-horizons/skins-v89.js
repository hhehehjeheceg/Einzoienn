/* AZUR v89 — NOUVEAUX PERSONNAGES (créations originales), refaits de zéro.
 * Kai (éclaireur) et Lyra (pilote des failles), plus deux variantes de couleur.
 *  - proportions héroïques : tête plus petite (≈ 6,3 têtes), épaules larges,
 *    taille marquée, vraies mains (paume, 4 doigts, pouce), vraies chaussures ;
 *  - VISAGE PEINT en haute définition sur la tête (sourcils, ombres d'orbites,
 *    nez, lèvres, joues, taches de rousseur, dégradé des cheveux courts) et
 *    YEUX EN 3D : globe, iris peint (anneau, fibres, pupille, reflets),
 *    paupière supérieure avec trait de cils, paupière inférieure ;
 *  - VÊTEMENTS TEXTURÉS : coutures, surpiqûres, fermeture éclair, poches à
 *    rabat, bord-côte, empiècements, écusson, logo dans le dos, plis, grain ;
 *  - volumes sculptés : mèches de cheveux, col, bandoulière, ceinture, poches
 *    cargo, genouillères, bottes avec semelle, languette et lacets.
 * Toutes les pièces sont posées sur le MÊME squelette que l'ancien modèle
 * (bassin, buste, tête, épaules, coudes, hanches, genoux) : course, saut, visée,
 * planeur, emotes et flottement de l'événement restent intacts. Une texture
 * (atlas 1024²) et un matériau par tenue, partagés par tous les joueurs. */
(function (root) {
  'use strict';
  var T = root.THREE, A = root.AZArt, M = root.AZMeta;
  if (!T || !A || typeof A.avatar !== 'function' || !M || !M.catalog) return;

  var LOOKS = {
    'char-kai': { name: 'Kai, éclaireur', rarity: 3, price: 0, desc: 'Le héros d’AZUR : blouson d’éclaireur, bandoulière, casque-micro', color: '#2b5aa8', secondary: '#ff8a2a', icon: '✦',
      body: 'm', hair: 'quiff', top: 'jacket', seed: 11,
      skin: '#c98a62', skinD: '#a5684a', blush: '#d97f68', hairC: '#231d21', hairH: '#4a3c40', brow: '#231d21', eye: '#6b4426', lip: '#a3604f', lash: '#1d1517',
      jacket: '#24437f', jacket2: '#3d7fe0', jacketD: '#18305c', shirt: '#e6eaee', shirtArt: '#ff8a2a', accent: '#ff8a2a',
      pants: '#3c4556', pants2: '#2d3442', boots: '#7a4e32', boots2: '#56361f', sole: '#efe6d4', soleD: '#3a2c24', lace: '#eadcc2',
      strap: '#6e4b33', glove: '#24272f', metal: '#d3d9df', gear: '#2b303a', sleeves: 'rolled', headset: true },
    'char-lyra': { name: 'Lyra, pilote des failles', rarity: 4, price: 1500, desc: 'Combinaison de vol sarcelle et blanche, queue-de-cheval rousse', color: '#13838c', secondary: '#ffd04a', icon: '✧',
      body: 'f', hair: 'pony', top: 'suit', seed: 23, freckles: true,
      skin: '#f0c5a5', skinD: '#d39a7c', blush: '#f08f84', hairC: '#b83f2a', hairH: '#ec7a50', brow: '#8a3222', eye: '#2c8a7b', lip: '#c35b62', lash: '#24161a',
      jacket: '#12808a', jacket2: '#eef4f4', jacketD: '#0b5c64', shirt: '#1d2630', shirtArt: '#ffd04a', accent: '#ffd04a',
      pants: '#27313f', pants2: '#1d2531', boots: '#eef1f3', boots2: '#12808a', sole: '#2a2f38', soleD: '#171b21', lace: '#12808a',
      strap: '#2a2f38', glove: '#eef1f3', metal: '#ffd04a', gear: '#2a2f38', sleeves: 'full', headset: false },
    'char-kai-nuit': { name: 'Kai « Nuit »', rarity: 4, price: 1200, desc: 'Variante furtive : blouson noir, liserés cyan', color: '#1a1d26', secondary: '#4fe3ff', icon: '✦',
      body: 'm', hair: 'quiff', top: 'jacket', seed: 37,
      skin: '#9a6544', skinD: '#7c4c32', blush: '#b0624e', hairC: '#16131a', hairH: '#2c2a36', brow: '#16131a', eye: '#4a2c18', lip: '#83483c', lash: '#120c0e',
      jacket: '#1b1e27', jacket2: '#2c3240', jacketD: '#111319', shirt: '#2a2f3a', shirtArt: '#4fe3ff', accent: '#4fe3ff',
      pants: '#23262f', pants2: '#191b22', boots: '#22252c', boots2: '#15171c', sole: '#4fe3ff', soleD: '#1b1e25', lace: '#4fe3ff',
      strap: '#2c3240', glove: '#121419', metal: '#4fe3ff', gear: '#16181e', sleeves: 'rolled', headset: true },
    'char-lyra-corail': { name: 'Lyra « Corail »', rarity: 4, price: 1200, desc: 'Variante corail et crème, cheveux noirs', color: '#ff7a5c', secondary: '#fff1d6', icon: '✧',
      body: 'f', hair: 'pony', top: 'suit', seed: 41,
      skin: '#93603f', skinD: '#73472d', blush: '#b5604d', hairC: '#1b1619', hairH: '#463a42', brow: '#1b1619', eye: '#4a3020', lip: '#8a4038', lash: '#120c0e',
      jacket: '#ff7a5c', jacket2: '#fff1d6', jacketD: '#d1553b', shirt: '#2a2f38', shirtArt: '#2fd0c0', accent: '#2fd0c0',
      pants: '#3a2f3a', pants2: '#2a2230', boots: '#fff1d6', boots2: '#ff7a5c', sole: '#2a2f38', soleD: '#181a20', lace: '#ff7a5c',
      strap: '#2a2f38', glove: '#fff1d6', metal: '#2fd0c0', gear: '#2a2f38', sleeves: 'full', headset: false }
  };
  var DEFAULT = 'char-kai';

  Object.keys(LOOKS).forEach(function (id) {
    if (M.catalog.some(function (c) { return c.id === id; })) return;
    var s = LOOKS[id];
    M.catalog.push({ id: id, name: s.name, type: 'character', rarity: s.rarity, price: s.price, description: s.desc, color: s.color, secondary: s.secondary, icon: s.icon, palette: 'hero89', model: 'scout' });
  });
  // Kai est offert et porté une fois automatiquement (le joueur peut changer ensuite dans le casier)
  if (typeof M.normalize === 'function' && !M.normalize.__v89) {
    var norm = M.normalize;
    M.normalize = function () {
      var out = norm.apply(this, arguments);
      try {
        if (out && out.owned && out.owned.indexOf(DEFAULT) < 0) out.owned.push(DEFAULT);
        out.migrations = out.migrations || {};
        if (!out.migrations.kai089 && out.equipment) { out.equipment.character = DEFAULT; delete out.equipment.variant; out.migrations.kai089 = true; }
      } catch (e) {}
      return out;
    };
    M.normalize.__v89 = true;
  }
  // au démarrage, le salon peut garder l'ancien équipement en mémoire : on le resynchronise une fois
  (function () {
    var tries = 0, timer = setInterval(function () {
      var g = root.AZUR; if (++tries > 120) return clearInterval(timer);
      if (!g || !g.profile || !g.profile.equipment || g.screen !== 'menu') return;
      clearInterval(timer);
      var eq = g.profile.equipment, ch = eq.character;
      try { var p = g.player && g.player(); if (p && p.equipment && p.equipment.character !== ch) p.equipment = Object.assign({}, eq); } catch (e) {}
      try { if (g.tab === 'play' && (!g.previewEquipment || g.previewEquipment.character !== ch) && g.renderMenu) g.renderMenu(); } catch (e) {}
    }, 500);
  })();

  /* =================================================================== outils */
  var S = 1024;
  var REG = { head: [0, 0, 512, 512], torso: [512, 0, 512, 512], arm: [0, 512, 256, 256], fore: [0, 768, 256, 256], thigh: [256, 512, 256, 256], shin: [256, 768, 256, 256],
    pelvis: [512, 512, 256, 128], iris: [768, 512, 128, 128], white: [896, 512, 128, 128] };
  var WHITE = [(896 + 64) / S, 1 - (512 + 64) / S];
  function uvOf(r, ul, vl) { vl = .006 + vl * .988; return [(r[0] + ul * r[2]) / S, 1 - (r[1] + (1 - vl) * r[3]) / S]; }
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(v) { v = cl(v, 0, 1); return v * v * (3 - 2 * v); }
  function sp(v, e) { return v < 0 ? -Math.pow(-v, e) : Math.pow(v, e); }
  function rng(seed) { var a = seed | 0; return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hx(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { v = Math.round(cl(v, 0, 255)).toString(16); return v.length < 2 ? '0' + v : v; }).join(''); }
  function mix(a, b, k) { a = hx(a); b = hx(b); return hex([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); }
  function shade(h, k) { return k < 0 ? mix(h, '#000000', -k) : mix(h, '#ffffff', k); }
  function rgba(h, a) { var c = hx(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }

  /* anneau : [y, demi-largeur, z avant, z arrière, z du plus large, exposant, levée avant, descente arrière, centre x] */
  function zwOf(r) { return r[4] == null ? (r[2] + r[3]) / 2 : r[4]; }
  function ringPt(r, th, out) {
    var s = Math.sin(th), c = Math.cos(th), e = 2 / (r[5] || 2), zw = zwOf(r);
    var x = (r[8] || 0) + r[1] * sp(s, e);
    var z = c >= 0 ? zw - (zw - r[2]) * sp(c, e) : zw + (r[3] - zw) * sp(-c, e);
    var y = r[0] + (r[6] || 0) * Math.pow(Math.max(0, c), 2) + (r[7] || 0) * Math.pow(Math.max(0, -c), 2);
    return out.set(x, y, z);
  }
  function ringAt(rings, y) {
    var n = rings.length; if (y <= rings[0][0]) return rings[0]; if (y >= rings[n - 1][0]) return rings[n - 1];
    for (var i = 0; i < n - 1; i++) if (y <= rings[i + 1][0]) {
      var a = rings[i], b = rings[i + 1], k = (y - a[0]) / (b[0] - a[0]), o = [];
      for (var j = 0; j < 9; j++) {
        var va = j === 4 ? zwOf(a) : j === 5 ? (a[5] || 2) : (a[j] || 0), vb = j === 4 ? zwOf(b) : j === 5 ? (b[5] || 2) : (b[j] || 0);
        o.push(va + (vb - va) * k);
      }
      return o;
    }
  }
  function thetaOf(r, x, back) {
    var n = r[5] || 2, q = cl((x - (r[8] || 0)) / r[1], -1, 1), s = (q < 0 ? -1 : 1) * Math.pow(Math.abs(q), n / 2), th = Math.asin(cl(s, -1, 1));
    return back ? (th >= 0 ? Math.PI - th : -Math.PI - th) : th;
  }
  function tOfTheta(th) { var t = .5 - th / (Math.PI * 2); return t - Math.floor(t); }
  // point et normale (horizontale) sur une surface lissée
  var _v = new T.Vector3();
  function surf(rings, y, x, back, off) {
    var r = ringAt(rings, y), th = thetaOf(r, x, back), p = ringPt(r, th, new T.Vector3()), zw = zwOf(r);
    var rz = p.z < zw ? zw - r[2] : r[3] - zw, n = new T.Vector3((p.x - (r[8] || 0)) / (r[1] * r[1]), 0, (p.z - zw) / (rz * rz)).normalize();
    if (off) p.addScaledVector(n, off);
    return { p: p, n: n };
  }

  var _e = new T.Euler(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3();
  function mx(x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _p.set(x || 0, y || 0, z || 0);
    var a = sx == null ? 1 : sx; _s.set(a, sy == null ? a : sy, sz == null ? a : sz);
    return new T.Matrix4().compose(_p, _q, _s);
  }

  /* accumulateur de géométrie indexée (position, normale, uv d'atlas, couleur) */
  function Geo(lo) { this.lo = lo; this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  function mk(lo) { var G = new Geo(lo); G.d = new Geo(lo); G.d.d = G.d; return G; } // G : liseré cartoon ; G.d : petits détails sans liseré
  Geo.prototype.push = function (g, col, mat) {
    var pos = g.attributes.position, nor = g.attributes.normal, uv = g.userData.atlas ? g.attributes.uv : null, ca = g.attributes.color;
    var base = this.p.length / 3, v = new T.Vector3(), nm = mat ? new T.Matrix3().getNormalMatrix(mat) : null, c = new T.Color(col || '#ffffff'), k;
    for (k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k); if (mat) v.applyMatrix4(mat); this.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, k); if (nm) v.applyMatrix3(nm); v.normalize(); this.n.push(v.x, v.y, v.z);
      if (uv) this.u.push(uv.getX(k), uv.getY(k)); else this.u.push(WHITE[0], WHITE[1]);
      if (ca) this.c.push(ca.getX(k), ca.getY(k), ca.getZ(k)); else this.c.push(c.r, c.g, c.b);
    }
    if (g.index) for (k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k));
    else for (k = 0; k < pos.count; k++) this.i.push(base + k);
    g.dispose(); return this;
  };
  Geo.prototype.geometry = function () {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); return g;
  };
  function seamFix(g, W, rows) {
    var n = g.attributes.normal;
    for (var j = 0; j < rows; j++) {
      var a = j * W, b = j * W + W - 1, x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  function capFan(ringPts, center, normalSign) { // couvercle plat (sommets dupliqués)
    var pos = [center.x, center.y, center.z], idx = [], m = ringPts.length;
    ringPts.forEach(function (p) { pos.push(p.x, p.y, p.z); });
    for (var i = 0; i < m - 1; i++) idx.push(0, 1 + i, 2 + i);
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // orientation
    var n = g.attributes.normal, sum = 0; for (var k = 0; k < n.count; k++) sum += n.getY(k) * normalSign.y + n.getX(k) * normalSign.x + n.getZ(k) * normalSign.z;
    if (sum < 0) { for (i = 0; i < idx.length; i += 3) { var t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    return g;
  }
  /* volume lissé texturé : o = { reg, mirror, v0, v1, seg, col, mat, caps } */
  function loft(G, rings, o) {
    o = o || {};
    rings = rings.slice().sort(function (a, b) { return a[0] - b[0]; });
    var seg = G.lo ? Math.max(8, Math.round((o.seg || 20) * .55)) : (o.seg || 20), W = seg + 1, nR = rings.length;
    var y0 = o.v0 != null ? o.v0 : rings[0][0], y1 = o.v1 != null ? o.v1 : rings[nR - 1][0];
    var pos = [], uv = [], v = new T.Vector3(), i, j, firstRing = [], lastRing = [];
    for (j = 0; j < nR; j++) for (i = 0; i <= seg; i++) {
      var t = i / seg, th = (.5 - t) * Math.PI * 2; ringPt(rings[j], th, v); pos.push(v.x, v.y, v.z);
      if (j === 0) firstRing.push(v.clone()); if (j === nR - 1) lastRing.push(v.clone());
      var q = o.reg ? uvOf(o.reg, o.mirror ? 1 - t : t, cl((rings[j][0] - y0) / (y1 - y0), 0, 1)) : WHITE; uv.push(q[0], q[1]);
    }
    var idx = [];
    for (j = 0; j < nR - 1; j++) for (i = 0; i < seg; i++) { var a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); seamFix(g, W, nR); if (o.reg) g.userData.atlas = true;
    G.push(g, o.reg ? '#ffffff' : o.col, o.mat);
    if (o.caps !== false) {
      var r0 = rings[0], r1 = rings[nR - 1];
      if (r0[1] > .004) { var c0 = new T.Vector3(r0[8] || 0, r0[0], zwOf(r0)); G.push(capFan(firstRing, c0, new T.Vector3(0, -1, 0)), o.capCol || o.col || '#ffffff', o.mat); }
      if (r1[1] > .004) { var c1 = new T.Vector3(r1[8] || 0, r1[0], zwOf(r1)); G.push(capFan(lastRing, c1, new T.Vector3(0, 1, 0)), o.capCol || o.col || '#ffffff', o.mat); }
    }
    return G;
  }
  /* tube balayé le long d'une courbe : o = { r:[l,h] | fn(t), up:[x,y,z] | fn(P,t,out), col, col2, colFn, steps, seg, closed, mat } */
  function sweep(G, pts, o) {
    var curve = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }), !!o.closed, 'catmullrom', .5);
    var steps = G.lo ? Math.max(3, Math.round((o.steps || 12) * .5)) : (o.steps || 12), seg = G.lo ? Math.max(5, Math.round((o.seg || 10) * .6)) : (o.seg || 10), W = seg + 1;
    var pos = [], cols = [], P = new T.Vector3(), Tn = new T.Vector3(), up = new T.Vector3(), side = new T.Vector3(), nrm = new T.Vector3(), cc = new T.Color();
    var c0 = new T.Color(o.col || '#ffffff'), c1 = new T.Color(o.col2 || o.col || '#ffffff'), ends = [], k, i;
    for (k = 0; k <= steps; k++) {
      var t = k / steps; curve.getPointAt(Math.min(t, .99999), P); curve.getTangentAt(Math.min(t, .99999), Tn);
      if (typeof o.up === 'function') o.up(P, t, up); else if (o.up) up.set(o.up[0], o.up[1], o.up[2]); else up.set(0, 1, 0);
      side.crossVectors(up, Tn); if (side.lengthSq() < 1e-9) side.set(1, 0, 0); side.normalize(); nrm.crossVectors(Tn, side).normalize();
      var r = typeof o.r === 'function' ? o.r(t) : o.r, w = r.length ? r[0] : r, h = r.length ? r[1] : r;
      if (o.colFn) cc.set(o.colFn(t)); else cc.copy(c0).lerp(c1, Math.pow(t, o.cp || 1));
      var ring = [];
      for (i = 0; i <= seg; i++) {
        var a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        var x = P.x + side.x * ca * w + nrm.x * sa * h, y = P.y + side.y * ca * w + nrm.y * sa * h, z = P.z + side.z * ca * w + nrm.z * sa * h;
        pos.push(x, y, z); cols.push(cc.r, cc.g, cc.b); if (k === 0 || k === steps) ring.push(new T.Vector3(x, y, z));
      }
      if (k === 0 || k === steps) ends.push({ ring: ring, c: P.clone(), t: Tn.clone(), col: cc.clone() });
    }
    var idx = [];
    for (k = 0; k < steps; k++) for (i = 0; i < seg; i++) { var A0 = k * W + i, B0 = A0 + 1, C0 = A0 + W, D0 = C0 + 1; idx.push(A0, C0, B0, B0, C0, D0); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
    // orientation : la normale doit sortir du tube
    var mid = Math.floor(steps / 2) * W + Math.floor(seg / 4), np = g.attributes.normal, pp = g.attributes.position;
    curve.getPointAt(Math.floor(steps / 2) / steps, P);
    var out = new T.Vector3(pp.getX(mid) - P.x, pp.getY(mid) - P.y, pp.getZ(mid) - P.z);
    if (out.x * np.getX(mid) + out.y * np.getY(mid) + out.z * np.getZ(mid) < 0) { for (i = 0; i < idx.length; i += 3) { var tt = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tt; } g.setIndex(idx); g.computeVertexNormals(); }
    seamFix(g, W, steps + 1);
    G.push(g, null, o.mat);
    if (!o.closed && o.caps !== false) ends.forEach(function (e, n) {
      var cap = capFan(e.ring, e.c, e.t.clone().multiplyScalar(n ? 1 : -1)), cn = cap.attributes.position.count, ca = [];
      for (var q = 0; q < cn; q++) ca.push(e.col.r, e.col.g, e.col.b);
      cap.setAttribute('color', new T.Float32BufferAttribute(ca, 3)); G.push(cap, null, o.mat);
    });
    return G;
  }
  function ell(G, r, col, x, y, z, sx, sy, sz, rx, ry, rz) {
    var g = new T.SphereGeometry(r, G.lo ? 10 : 20, G.lo ? 7 : 14);
    return G.push(g, col, mx(x, y, z, rx, ry, rz, sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz));
  }
  // boîte aux arêtes arrondies (pochettes, boucles, rabats)
  function rbox(G, w, h, d, col, x, y, z, rx, ry, rz) {
    var e = Math.min(w, h, d) * .22, n = 4.5;
    loft(G, [[-h / 2, w / 2 - e, -(d / 2 - e), d / 2 - e, 0, n], [-h / 2 + e * .45, w / 2 - e * .25, -(d / 2 - e * .25), d / 2 - e * .25, 0, n], [-h / 2 + e, w / 2, -d / 2, d / 2, 0, n],
      [h / 2 - e, w / 2, -d / 2, d / 2, 0, n], [h / 2 - e * .45, w / 2 - e * .25, -(d / 2 - e * .25), d / 2 - e * .25, 0, n], [h / 2, w / 2 - e, -(d / 2 - e), d / 2 - e, 0, n]],
      { col: col, seg: 16, mat: mx(x, y, z, rx, ry, rz) });
    return G;
  }
  // calotte sphérique (pôle +Y) : paupières, iris
  function shell(G, r, phiMax, mat, colFn, uvFn) {
    var g = new T.SphereGeometry(r, G.lo ? 12 : 24, G.lo ? 4 : 9, 0, Math.PI * 2, 0, phiMax), p = g.attributes.position, cols = [], uvs = [];
    for (var k = 0; k < p.count; k++) {
      var x = p.getX(k), y = p.getY(k), z = p.getZ(k), phi = Math.acos(cl(y / r, -1, 1)), c = new T.Color(colFn(phi, x, y, z)); cols.push(c.r, c.g, c.b);
      if (uvFn) { var q = uvFn(x, y, z); uvs.push(q[0], q[1]); }
    }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    if (uvFn) { g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.userData.atlas = true; }
    return G.push(g, null, mat);
  }

  /* ================================================================ formes */
  function headRings(L) {
    var f = L.body === 'f', jw = f ? .92 : 1;
    // [y, demi-largeur, z avant, z arrière, z du plus large, exposant]
    return [
      [-.153, .02 * jw, -.079, -.046, -.062],
      [-.143, .042 * jw, -.097, -.02, -.05],
      [-.126, .06 * jw, -.11, .016, -.034],
      [-.1, .077 * jw, -.119, .046, -.02, 2.1],
      [-.07, .088 * (f ? .95 : 1), -.124, .071, -.01, 2.1],
      [-.04, .095 * (f ? .97 : 1), -.126, .093, 0, 2.05],
      [-.01, .099, -.124, .108, .005],
      [.015, .101, -.122, .118, .008],
      [.045, .102, -.122, .124, .01],
      [.075, .1, -.118, .126, .012],
      [.105, .093, -.108, .12, .014],
      [.13, .08, -.092, .108, .016],
      [.15, .06, -.068, .088, .018],
      [.163, .036, -.04, .056, .018],
      [.171, .008, -.01, .018, .018]
    ];
  }
  var HV0 = -.153, HV1 = .171;
  function torsoRings(L) {
    var f = L.body === 'f';
    var R = [
      [1.0, .172, -.118, .112, -.004, 2.3],
      [1.03, .168, -.115, .109, -.004, 2.3],
      [1.08, .169, -.116, .109, -.004, 2.3],
      [1.15, .178, -.124, .112, -.004, 2.3],
      [1.22, .194, -.136, .116, -.006, 2.3],
      [1.3, .21, -.146, .12, -.006, 2.3],
      [1.37, .222, -.148, .122, -.006, 2.3],
      [1.43, .226, -.14, .121, -.005, 2.3],
      [1.475, .222, -.126, .114, -.004, 2.3],
      [1.51, .2, -.108, .102, -.003, 2.3],
      [1.54, .145, -.09, .09, 0, 2.2],
      [1.565, .095, -.072, .074, 0, 2.1],
      [1.58, .062, -.058, .062, .002]
    ];
    if (f) R = R.map(function (r) {
      var y = r[0], k = y < 1.16 ? .85 + (y - 1.0) * .3 : y < 1.4 ? .9 : .9, fz = (y > 1.24 && y < 1.4) ? -.014 * Math.sin((y - 1.24) / .16 * Math.PI) : 0;
      return [y, r[1] * k, r[2] * (y < 1.16 ? .93 : .97) + fz, r[3] * .95, r[4], r[5]];
    });
    return R;
  }
  var TV0 = 1.0, TV1 = 1.58;
  function pelvisRings(L) {
    var k = L.body === 'f' ? 1.04 : 1;
    return [[.765, .055 * k, -.04, .035], [.8, .13 * k, -.082, .09], [.85, .178 * k, -.112, .12, -.002, 2.2], [.92, .183 * k, -.113, .122, -.002, 2.2], [.98, .174 * (L.body === 'f' ? .95 : 1), -.11, .114, -.003, 2.2], [1.03, .164 * (L.body === 'f' ? .9 : 1), -.106, .106, -.003, 2.2]];
  }
  function armRings(L, s) {
    var k = L.body === 'f' ? .88 : 1, c = function (v) { return s * v; };
    return [[.062, .016 * k, -.016, .016, 0, 2, 0, 0, c(.004)], [.052, .046 * k, -.046 * k, .046 * k, 0, 2, 0, 0, c(.006)], [.034, .065 * k, -.064 * k, .064 * k, 0, 2, 0, 0, c(.007)],
      [.006, .074 * k, -.071 * k, .071 * k, 0, 2, 0, 0, c(.006)], [-.04, .073 * k, -.069 * k, .069 * k, 0, 2, 0, 0, c(.004)], [-.09, .069 * k, -.065 * k, .065 * k, 0, 2, 0, 0, c(.002)],
      [-.15, .066 * k, -.062 * k, .062 * k], [-.23, .062 * k, -.06 * k, .06 * k], [-.3, .058 * k, -.057 * k, .057 * k], [-.345, .055 * k, -.055 * k, .055 * k]];
  }
  function foreRings(L) {
    var k = L.body === 'f' ? .88 : 1;
    return [[.03, .05 * k, -.05 * k, .05 * k], [0, .056 * k, -.054 * k, .054 * k], [-.06, .058 * k, -.052 * k, .054 * k], [-.13, .052 * k, -.046 * k, .048 * k], [-.2, .044 * k, -.04 * k, .04 * k], [-.245, .04 * k, -.036 * k, .036 * k], [-.258, .038 * k, -.034 * k, .034 * k]];
  }
  function thighRings(L) {
    var f = L.body === 'f';
    return [[.1, .07, -.07, .07], [.05, .098 * (f ? 1.04 : 1), -.098, .1], [-.02, .104 * (f ? 1.02 : 1), -.104, .104], [-.12, .1, -.1, .1], [-.22, .092 * (f ? .97 : 1), -.092, .092], [-.32, .084 * (f ? .95 : 1), -.084, .084], [-.4, .078 * (f ? .94 : 1), -.08, .078], [-.45, .074 * (f ? .94 : 1), -.076, .074]];
  }
  function shinRings(L) {
    var k = L.body === 'f' ? .93 : 1;
    return [[.04, .08 * k, -.08 * k, .08 * k], [0, .085 * k, -.085 * k, .085 * k], [-.08, .083 * k, -.082 * k, .09 * k], [-.16, .078 * k, -.075 * k, .086 * k], [-.24, .07 * k, -.068 * k, .074 * k], [-.32, .064 * k, -.062 * k, .066 * k], [-.36, .062 * k, -.06 * k, .062 * k]];
  }

  /* ============================================================ peinture */
  function Reg(r) { return { r: r, x: r[0], y: r[1], w: r[2], h: r[3], X: function (u) { return r[0] + u * r[2]; }, Y: function (v) { return r[1] + (1 - (.006 + v * .988)) * r[3]; } }; }
  function clip(g, R) { g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip(); }
  function noise(g, R, col, n, a, seed, sz) {
    var rnd = rng(seed); clip(g, R);
    for (var i = 0; i < n; i++) { g.fillStyle = rgba(rnd() < .5 ? '#ffffff' : '#000000', a * rnd()); var x = R.x + rnd() * R.w, y = R.y + rnd() * R.h; g.fillRect(x, y, (sz || 2) * (.5 + rnd()), (sz || 2) * (.3 + rnd() * .5)); }
    g.restore();
  }
  function star4(g, x, y, r, col, rot) { // étoile-boussole AZUR à 4 branches
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.fillStyle = col; g.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * .3 : r; g.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr); }
    g.closePath(); g.fill(); g.restore();
  }
  function badge(g, x, y, r, L, dark) {
    g.fillStyle = dark || '#141822'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = r * .14; g.strokeStyle = L.accent; g.beginPath(); g.arc(x, y, r * .86, 0, Math.PI * 2); g.stroke();
    star4(g, x, y, r * .66, L.accent); star4(g, x, y, r * .3, '#ffffff', Math.PI / 4);
  }
  function stitch(g, pts, col, w, dash) {
    g.save(); g.strokeStyle = col; g.lineWidth = w || 1.4; g.setLineDash(dash || [4, 3]); g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke(); g.restore();
  }
  function line(g, pts, col, w) { g.save(); g.strokeStyle = col; g.lineWidth = w || 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke(); g.restore(); }
  function poly(g, pts, fill) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fillStyle = fill; g.fill(); }
  function blob(g, x, y, rx, ry, col, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
  }

  /* --------------------------------------------------------------- tête */
  function paintHead(g, L) {
    var R = Reg(REG.head), HR = headRings(L), f = L.body === 'f', rnd = rng(L.seed);
    function P(x, y) { var r = ringAt(HR, y); return [R.X(tOfTheta(thetaOf(r, x, false))), R.Y((y - HV0) / (HV1 - HV0))]; }
    function PB(x, y) { var r = ringAt(HR, y); return [R.X(tOfTheta(thetaOf(r, x, true))), R.Y((y - HV0) / (HV1 - HV0))]; }
    g.fillStyle = L.skin; g.fillRect(R.x, R.y, R.w, R.h);
    // modelé général : front plus clair, mâchoire et cou plus chauds
    var gr = g.createLinearGradient(0, R.y, 0, R.y + R.h); gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(L.skinD, .55));
    g.fillStyle = gr; g.fillRect(R.x, R.y, R.w, R.h);
    // côtés et arrière légèrement plus sombres (volume)
    var gs = g.createLinearGradient(R.x, 0, R.x + R.w, 0); gs.addColorStop(0, rgba(L.skinD, .35)); gs.addColorStop(.3, rgba(L.skinD, 0)); gs.addColorStop(.7, rgba(L.skinD, 0)); gs.addColorStop(1, rgba(L.skinD, .35));
    g.fillStyle = gs; g.fillRect(R.x, R.y, R.w, R.h);
    for (var s = -1; s <= 1; s += 2) {
      var e = P(s * .043, .009), cheek = P(s * .062, -.04), sock = P(s * .046, .024);
      blob(g, cheek[0], cheek[1], 26, 18, L.blush, f ? .42 : .26);                          // joues
      blob(g, sock[0], sock[1], 26, 17, L.skinD, .55);                                       // orbite sous l'arcade
      blob(g, P(s * .016, .012)[0], P(s * .016, .012)[1], 9, 14, L.skinD, .45);              // coin interne de l'œil
      var lo = [P(s * .022, -.008), P(s * .043, -.0135), P(s * .064, -.006)];              // paupière inférieure
      line(g, lo, rgba(L.skinD, .55), 3);
      blob(g, P(s * .043, -.022)[0], P(s * .043, -.022)[1], 20, 7, L.skinD, .22);         // cerne léger
      // sourcils : épais, arqués, poils dessinés
      var bw = f ? .62 : 1, b0 = P(s * .013, .037), b1 = P(s * .036, .049 + (f ? .004 : 0)), b2 = P(s * .058, .05 + (f ? .004 : 0)), b3 = P(s * .077, .04);
      var t0 = P(s * .013, .028 + (f ? .004 : 0)), t1 = P(s * .036, .038 + (f ? .007 : 0)), t2 = P(s * .058, .041 + (f ? .006 : 0));
      g.beginPath(); g.moveTo(t0[0], t0[1]); g.lineTo(b0[0], b0[1]);
      g.quadraticCurveTo(b1[0], b1[1] - 2 * bw, b2[0], b2[1]); g.lineTo(b3[0], b3[1]);
      g.quadraticCurveTo(t2[0], t2[1], t1[0], t1[1]); g.closePath(); g.fillStyle = L.brow; g.fill();
      g.save(); g.clip(); for (var hh = 0; hh < 26; hh++) { var k = hh / 26, px = b0[0] + (b3[0] - b0[0]) * k, py = b0[1] + (b3[1] - b0[1]) * k; line(g, [[px, py + 8], [px + s * -5, py - 4]], rgba(shade(L.brow, .25), .5), 1.2); } g.restore();
      // arête du nez : ombre latérale
      line(g, [P(s * .013, .02), P(s * .016, -.01), P(s * .02, -.036)], rgba(L.skinD, .35), 5);
      // plis nasogéniens discrets
      line(g, [P(s * .026, -.045), P(s * .035, -.07), P(s * .033, -.09)], rgba(L.skinD, .3), 3);
    }
    // dessous du nez, philtrum
    blob(g, P(0, -.055)[0], P(0, -.055)[1], 24, 8, L.skinD, .55);
    line(g, [P(-.006, -.058), P(-.007, -.074)], rgba(L.skinD, .35), 3); line(g, [P(.006, -.058), P(.007, -.074)], rgba(L.skinD, .35), 3);
    // bouche
    var lw = f ? 1.08 : 1, smile = f ? .0025 : .0015;
    var cL = P(-.025 * lw, -.084 + smile), cR = P(.025 * lw, -.083 + smile * 1.6), mU = P(0, -.0785), mL = P(0, -.0865), bowL = P(-.008, -.0775), bowR = P(.008, -.0775), lowB = P(0, -.098 - (f ? .003 : 0));
    g.beginPath(); g.moveTo(cL[0], cL[1]); g.quadraticCurveTo(P(-.016, -.079)[0], P(-.016, -.079)[1], bowL[0], bowL[1]); g.lineTo(mU[0], mU[1] + 1.5); g.lineTo(bowR[0], bowR[1]);
    g.quadraticCurveTo(P(.016, -.079)[0], P(.016, -.079)[1], cR[0], cR[1]); g.quadraticCurveTo(mL[0], mL[1] + 2, cL[0], cL[1]); g.fillStyle = shade(L.lip, -.12); g.fill();
    g.beginPath(); g.moveTo(cL[0], cL[1]); g.quadraticCurveTo(mL[0], mL[1] + 2, cR[0], cR[1]); g.quadraticCurveTo(P(.013, -.097)[0], P(.013, -.097)[1], lowB[0], lowB[1]);
    g.quadraticCurveTo(P(-.013, -.097)[0], P(-.013, -.097)[1], cL[0], cL[1]); g.fillStyle = L.lip; g.fill();
    blob(g, P(.004, -.092)[0], P(.004, -.092)[1], 9, 3.5, '#ffffff', .35);                   // reflet de lèvre
    line(g, [cL, [mL[0], mL[1] + 2], cR], rgba('#3a1a17', .85), 2.6);                          // commissure
    blob(g, cL[0] - 2, cL[1], 4, 4, '#3a1a17', .35); blob(g, cR[0] + 2, cR[1], 4, 4, '#3a1a17', .35);
    blob(g, P(0, -.106)[0], P(0, -.106)[1], 18, 6, L.skinD, .4);                              // ombre sous la lèvre
    blob(g, P(0, -.128)[0], P(0, -.128)[1], 16, 10, '#ffffff', .07);                          // menton
    if (L.freckles) for (var fr = 0; fr < 46; fr++) {
      var fx = (rnd() * 2 - 1) * .07, fy = -.012 - rnd() * .035; if (Math.abs(fx) < .012 && fy > -.03) continue;
      var q = P(fx, fy); g.fillStyle = rgba(shade(L.skinD, -.15), .35 + rnd() * .3); g.beginPath(); g.arc(q[0], q[1], 1 + rnd() * 1.3, 0, Math.PI * 2); g.fill();
    }
    // implantation des cheveux (dégradé sur les tempes, la nuque, au-dessus des oreilles)
    var hl = L.hair === 'quiff'
      ? [[0, .095], [.55, .095], [.95, .062], [1.08, .03], [1.14, -.022], [1.24, -.02], [1.3, .035], [1.72, .035], [1.85, -.01], [2.1, -.045], [2.6, -.07], [Math.PI, -.075]]
      : [[0, .092], [.55, .088], [.95, .068], [1.12, .05], [1.28, .036], [1.72, .036], [1.9, .0], [2.2, -.045], [2.7, -.068], [Math.PI, -.072]];
    function yH(th) { th = Math.abs(th); for (var i = 0; i < hl.length - 1; i++) if (th <= hl[i + 1][0]) { var k = (th - hl[i][0]) / (hl[i + 1][0] - hl[i][0]); return hl[i][1] + (hl[i + 1][1] - hl[i][1]) * sm(k); } return hl[hl.length - 1][1]; }
    var path = [], N = 128, top = R.Y(1);
    for (var i = 0; i <= N; i++) { var t = i / N, th = (.5 - t) * Math.PI * 2, y = yH(th); path.push([R.X(t), R.Y((y - HV0) / (HV1 - HV0))]); }
    clip(g, R);
    g.save(); g.filter = 'blur(5px)'; poly(g, [[R.x - 4, top - 10]].concat(path.map(function (p) { return [p[0], p[1] + 4]; })).concat([[R.x + R.w + 4, top - 10]]), rgba(L.hairC, .55)); g.restore();
    poly(g, [[R.x - 4, top - 10]].concat(path.map(function (p) { return [p[0], p[1] - 3]; })).concat([[R.x + R.w + 4, top - 10]]), L.hairC);
    for (i = 0; i < 900; i++) { var u = rnd(), th2 = (.5 - u) * Math.PI * 2, yy = yH(th2) + .006 + rnd() * .09, px2 = R.X(u), py2 = R.Y((yy - HV0) / (HV1 - HV0)); line(g, [[px2, py2], [px2 + (rnd() - .5) * 3, py2 - 6 - rnd() * 6]], rgba(L.hairH, .22 + rnd() * .25), 1.1); }
    g.restore();
    noise(g, R, '#000', 2200, .022, L.seed + 3, 1.2);
  }
  function paintIris(g, L) {
    var R = REG.iris, cx = R[0] + 64, cy = R[1] + 64;
    g.fillStyle = '#f3efe9'; g.fillRect(R[0], R[1], R[2], R[3]);
    var gr = g.createRadialGradient(cx, cy + 6, 4, cx, cy, 64); gr.addColorStop(0, shade(L.eye, .35)); gr.addColorStop(.45, L.eye); gr.addColorStop(.85, shade(L.eye, -.3)); gr.addColorStop(1, shade(L.eye, -.65));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 63, 0, Math.PI * 2); g.fill();
    var rnd = rng(L.seed + 9);
    for (var i = 0; i < 70; i++) { var a = rnd() * Math.PI * 2, r0 = 24 + rnd() * 6, r1 = 44 + rnd() * 16; line(g, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], rgba(rnd() < .5 ? shade(L.eye, .5) : shade(L.eye, -.4), .35), 1.5); }
    g.lineWidth = 6; g.strokeStyle = rgba(shade(L.eye, -.75), .9); g.beginPath(); g.arc(cx, cy, 60, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#07080c'; g.beginPath(); g.arc(cx, cy, 25, 0, Math.PI * 2); g.fill();
    var sh = g.createLinearGradient(0, cy - 64, 0, cy); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(cx - 64, cy - 64, 128, 64);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx - 17, cy - 19, 13, 11, -.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 20, cy + 18, 5.5, 0, Math.PI * 2); g.fill();
  }

  /* --------------------------------------------------------------- buste */
  function paintTorso(g, L) {
    var R = Reg(REG.torso), TR = torsoRings(L), rnd = rng(L.seed + 1), suit = L.top === 'suit';
    function V(y) { return (y - TV0) / (TV1 - TV0); }
    function P(x, y, back) { var r = ringAt(TR, y); return [R.X(tOfTheta(thetaOf(r, x, back))), R.Y(V(y))]; }
    function colY(t) { var th = (.5 - t) * Math.PI * 2; return th; }
    g.fillStyle = L.jacket; g.fillRect(R.x, R.y, R.w, R.h);
    var gv = g.createLinearGradient(0, R.y, 0, R.y + R.h); gv.addColorStop(0, 'rgba(255,255,255,.07)'); gv.addColorStop(.6, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = gv; g.fillRect(R.x, R.y, R.w, R.h);
    clip(g, R);
    // flancs plus sombres (empiècements latéraux), aisselles
    [.25, .75].forEach(function (t) {
      var x0 = R.X(t), gr = g.createLinearGradient(x0 - 40, 0, x0 + 40, 0); gr.addColorStop(0, rgba(L.jacketD, 0)); gr.addColorStop(.3, rgba(L.jacketD, .9)); gr.addColorStop(.7, rgba(L.jacketD, .9)); gr.addColorStop(1, rgba(L.jacketD, 0));
      g.fillStyle = gr; g.fillRect(x0 - 40, R.Y(V(1.41)), 80, R.Y(V(1.0)) - R.Y(V(1.41)));
      blob(g, x0, R.Y(V(1.42)), 40, 26, '#000000', .35);
      stitch(g, [[x0 - 22, R.Y(V(1.4))], [x0 - 22, R.Y(V(1.0))]], rgba(shade(L.jacket, .35), .6)); stitch(g, [[x0 + 22, R.Y(V(1.4))], [x0 + 22, R.Y(V(1.0))]], rgba(shade(L.jacket, .35), .6));
    });
    // empiècement d'épaules (devant : ligne courbe, dos : droite)
    var yoke = [];
    for (var i = 0; i <= 64; i++) { var t = i / 64, th = (.5 - t) * Math.PI * 2, front = Math.cos(th) > 0, y = front ? 1.462 - .035 * Math.abs(Math.sin(th)) : 1.405 + .02 * Math.abs(Math.sin(th)); yoke.push([R.X(t), R.Y(V(y))]); }
    poly(g, [[R.x - 2, R.y - 2]].concat(yoke).concat([[R.x + R.w + 2, R.y - 2]]), suit ? L.jacket2 : L.jacket2);
    line(g, yoke, rgba('#000000', .35), 3); stitch(g, yoke.map(function (p) { return [p[0], p[1] + 6]; }), rgba(suit ? L.accent : shade(L.jacket2, .45), .8));
    if (!suit) {
      // bord-côte du bas
      g.fillStyle = L.jacketD; g.fillRect(R.x, R.Y(V(1.035)), R.w, R.Y(V(1.0)) - R.Y(V(1.035)) + 4);
      for (var rb = 0; rb < R.w; rb += 5) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(R.x + rb, R.Y(V(1.035)), 2, 30); }
      line(g, [[R.x, R.Y(V(1.035))], [R.x + R.w, R.Y(V(1.035))]], rgba('#000000', .35), 2);
      // ouverture : tee-shirt, fermetures éclair, revers
      var op = [], opR = [];
      for (var y = 1.0; y <= 1.585; y += .01) { var w = .046 + (y > 1.46 ? (y - 1.46) * .35 : 0); op.push(P(-w, y)); opR.push(P(w, y)); }
      poly(g, op.concat(opR.slice().reverse()), L.shirt);
      var sg = g.createLinearGradient(op[0][0], 0, opR[0][0], 0); sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(.2, 'rgba(0,0,0,0)'); sg.addColorStop(.8, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.35)');
      g.save(); g.beginPath(); op.concat(opR.slice().reverse()).forEach(function (p, k) { if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.clip(); g.fillStyle = sg; g.fillRect(R.x, R.y, R.w, R.h);
      // motif du tee-shirt : chevron et étoile
      var c = P(0, 1.28); g.lineWidth = 7; g.strokeStyle = L.shirtArt; g.beginPath(); g.moveTo(c[0] - 26, c[1] - 14); g.lineTo(c[0], c[1] + 6); g.lineTo(c[0] + 26, c[1] - 14); g.stroke();
      star4(g, c[0], c[1] - 34, 13, L.shirtArt); g.restore();
      // col du tee-shirt
      line(g, [P(-.052, 1.56), P(0, 1.535), P(.052, 1.56)], rgba(shade(L.shirt, -.3), .9), 4);
      [op, opR].forEach(function (edge, side) {
        line(g, edge, shade(L.jacket, .25), 3);
        for (var k = 0; k < edge.length - 1; k++) { var p = edge[k]; g.fillStyle = k % 2 ? L.metal : shade(L.metal, -.35); g.fillRect(p[0] + (side ? -1 : -3), p[1] - 3, 4, 3); }
        var ex = edge.map(function (p) { return [p[0] + (side ? 9 : -9), p[1]]; }); stitch(g, ex, rgba(shade(L.jacket, .45), .75));
      });
      // poches de poitrine à rabat et pression
      [-1, 1].forEach(function (s) {
        var a = P(s * .075, 1.36), b = P(s * .155, 1.28);
        var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
        g.fillStyle = rgba('#000000', .18); g.fillRect(x0 + 2, a[1] + 3, x1 - x0, b[1] - a[1]);
        g.fillStyle = shade(L.jacket, .05); g.fillRect(x0, a[1], x1 - x0, b[1] - a[1]);
        stitch(g, [[x0 + 4, a[1] + 4], [x0 + 4, b[1] - 4], [x1 - 4, b[1] - 4], [x1 - 4, a[1] + 4]], rgba(shade(L.jacket, .5), .8));
        g.fillStyle = L.jacket2; g.fillRect(x0 - 2, a[1] - 4, x1 - x0 + 4, 22); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x0 - 2, a[1] + 16, x1 - x0 + 4, 4);
        g.fillStyle = L.metal; g.beginPath(); g.arc((x0 + x1) / 2, a[1] + 9, 4.5, 0, Math.PI * 2); g.fill();
        // poche passepoilée du bas
        var c0 = P(s * .07, 1.09), c1 = P(s * .135, 1.16); line(g, [c0, c1], rgba('#000000', .55), 5); line(g, [[c0[0], c0[1] + 5], [c1[0], c1[1] + 5]], rgba(shade(L.jacket, .3), .6), 2);
      });
      // écusson à l'emblème sur le cœur (côté gauche du personnage)
      var ec = P(-.12, 1.405); badge(g, ec[0], ec[1], 13, L);
    } else {
      // combinaison : plastron clair en V, liseré, fermeture centrale, écusson
      var pl = [P(-.155, 1.47), P(-.12, 1.38), P(-.05, 1.2), P(0, 1.12), P(.05, 1.2), P(.12, 1.38), P(.155, 1.47), P(.07, 1.56), P(-.07, 1.56)];
      poly(g, pl, L.jacket2);
      g.save(); g.beginPath(); pl.forEach(function (p, k) { if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.clip();
      var pg = g.createLinearGradient(0, pl[0][1], 0, pl[3][1]); pg.addColorStop(0, 'rgba(255,255,255,0)'); pg.addColorStop(1, 'rgba(0,0,0,.14)'); g.fillStyle = pg; g.fillRect(R.x, R.y, R.w, R.h); g.restore();
      line(g, pl.slice(0, 7), L.accent, 5); stitch(g, pl.slice(0, 7).map(function (p) { return [p[0], p[1] + 8]; }), rgba(shade(L.jacket2, -.35), .7));
      // bande de taille
      g.fillStyle = L.jacketD; g.fillRect(R.x, R.Y(V(1.06)), R.w, R.Y(V(1.0)) - R.Y(V(1.06)) + 4);
      line(g, [[R.x, R.Y(V(1.06))], [R.x + R.w, R.Y(V(1.06))]], L.accent, 3);
      var zt = P(0, 1.57), zb = P(0, 1.0); line(g, [zt, zb], shade(L.metal, -.2), 5);
      for (var zy = zt[1]; zy < zb[1]; zy += 5) { g.fillStyle = shade(L.metal, .3); g.fillRect(zt[0] - 3, zy, 6, 2); }
      g.fillStyle = L.metal; g.fillRect(zt[0] - 5, P(0, 1.47)[1], 10, 18);
      var eb = P(-.115, 1.33); badge(g, eb[0], eb[1], 15, L);
      var rk = P(.11, 1.36); g.fillStyle = '#141822'; g.fillRect(rk[0] - 16, rk[1] - 7, 32, 14); for (var k2 = 0; k2 < 3; k2++) { g.fillStyle = L.accent; g.fillRect(rk[0] - 12 + k2 * 9, rk[1] - 3, 6, 6); }
    }
    // dos : grand emblème et coutures de dos
    [0, 1].forEach(function (t) {
      var x0 = R.X(t), y0 = R.Y(V(1.3));
      if (suit) { poly(g, [[x0 - 70, R.Y(V(1.405))], [x0 + 70, R.Y(V(1.405))], [x0 + 40, R.Y(V(1.15))], [x0 - 40, R.Y(V(1.15))]], L.jacket2); line(g, [[x0 - 70, R.Y(V(1.405))], [x0 - 40, R.Y(V(1.15))], [x0 + 40, R.Y(V(1.15))], [x0 + 70, R.Y(V(1.405))]], L.accent, 4); }
      g.fillStyle = rgba('#000000', .25); g.beginPath(); g.arc(x0 + 2, y0 + 3, 40, 0, Math.PI * 2); g.fill();
      badge(g, x0, y0, 38, L, suit ? L.jacketD : '#10141c');
      stitch(g, [[x0 - 56, R.Y(V(1.05))], [x0 - 48, R.Y(V(1.4))]], rgba(shade(L.jacket, .4), .6)); stitch(g, [[x0 + 56, R.Y(V(1.05))], [x0 + 48, R.Y(V(1.4))]], rgba(shade(L.jacket, .4), .6));
    });
    // plis à la taille
    for (i = 0; i < 18; i++) { var tt = rnd(), yy = 1.06 + rnd() * .12, p0 = [R.X(tt), R.Y(V(yy))]; line(g, [p0, [p0[0] + 10 + rnd() * 18, p0[1] - 3 - rnd() * 6]], rgba('#000000', .14), 3); }
    g.restore();
    noise(g, R, '#000', 6000, .06, L.seed + 5, 2.2);
  }
  /* ---------------------------------------------------------- membres */
  function paintArm(g, L) {
    var R = Reg(REG.arm), suit = L.top === 'suit', V = function (y) { return (y + .345) / .423; };
    g.fillStyle = L.jacket; g.fillRect(R.x, R.y, R.w, R.h);
    clip(g, R);
    var gr = g.createLinearGradient(R.x, 0, R.x + R.w, 0); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(.25, 'rgba(0,0,0,.28)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(.75, 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = gr; g.fillRect(R.x, R.y, R.w, R.h);
    // épaule (empiècement), liseré
    g.fillStyle = suit ? shade(L.jacket, .08) : L.jacket2; g.fillRect(R.x, R.y, R.w, R.Y(V(.004)) - R.y);
    line(g, [[R.x, R.Y(V(.004))], [R.x + R.w, R.Y(V(.004))]], rgba('#000', .35), 3);
    stitch(g, [[R.x, R.Y(V(.004)) + 6], [R.x + R.w, R.Y(V(.004)) + 6]], rgba(suit ? L.accent : shade(L.jacket2, .45), .8));
    // bande colorée
    g.fillStyle = L.accent; g.fillRect(R.x, R.Y(V(-.13)), R.w, suit ? 4 : 7);
    // écusson extérieur
    var px = R.X(.75), py = R.Y(V(-.06));
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px - 21, py - 22, 44, 48); g.fillStyle = '#141822'; g.fillRect(px - 22, py - 24, 44, 48);
    g.strokeStyle = L.accent; g.lineWidth = 3; g.strokeRect(px - 18, py - 20, 36, 40); star4(g, px, py - 2, 13, L.accent); g.fillStyle = '#ffffff'; g.fillRect(px - 12, py + 12, 24, 3);
    // coude : plis

    for (var i = 0; i < 4; i++) line(g, [[R.X(.18 + i * .03), R.Y(V(-.29)) + i * 3], [R.X(.3 + i * .03), R.Y(V(-.31)) + i * 3]], rgba('#000', .22), 3);
    g.restore(); noise(g, R, '#000', 1600, .06, L.seed + 7, 2);
  }
  function paintFore(g, L) {
    var R = Reg(REG.fore), V = function (y) { return (y + .258) / .288; };
    if (L.sleeves === 'rolled') {
      g.fillStyle = L.skin; g.fillRect(R.x, R.y, R.w, R.h);
      var gr = g.createLinearGradient(0, R.y, 0, R.y + R.h); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(.25, 'rgba(255,255,255,.05)'); gr.addColorStop(1, rgba(L.skinD, .45)); g.fillStyle = gr; g.fillRect(R.x, R.y, R.w, R.h);
      blob(g, R.X(.5), R.Y(V(-.06)), 40, 60, '#ffffff', .08);
      clip(g, R); var rnd = rng(L.seed + 2); for (var i = 0; i < 160; i++) { var x = R.x + rnd() * R.w, y = R.y + rnd() * R.h * .8; line(g, [[x, y], [x + 1, y + 4]], rgba(L.skinD, .25), 1); } g.restore();
    } else {
      g.fillStyle = L.jacket; g.fillRect(R.x, R.y, R.w, R.h);
      g.fillStyle = L.accent; g.fillRect(R.x, R.Y(V(-.17)) - 4, R.w, 3);
      stitch(g, [[R.X(.75), R.y], [R.X(.75), R.Y(V(-.17))]], rgba(shade(L.jacket, .4), .7));
      noise(g, R, '#000', 1200, .06, L.seed + 8, 2);
    }
  }
  function paintPants(g, L, reg, v0, v1, part) {
    var R = Reg(reg), V = function (y) { return (y - v0) / (v1 - v0); }, suit = L.top === 'suit', rnd = rng(L.seed + (part === 'shin' ? 31 : 17));
    g.fillStyle = L.pants; g.fillRect(R.x, R.y, R.w, R.h);
    clip(g, R);
    var gr = g.createLinearGradient(R.x, 0, R.x + R.w, 0); gr.addColorStop(0, 'rgba(0,0,0,.2)'); gr.addColorStop(.3, 'rgba(0,0,0,.22)'); gr.addColorStop(.5, 'rgba(255,255,255,.05)'); gr.addColorStop(.7, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = gr; g.fillRect(R.x, R.y, R.w, R.h);
    // couture extérieure (t = .75 après symétrie) et intérieure, pli avant
    line(g, [[R.X(.75), R.y], [R.X(.75), R.y + R.h]], rgba('#000', .4), 3); stitch(g, [[R.X(.75) + 5, R.y], [R.X(.75) + 5, R.y + R.h]], rgba(shade(L.pants, .4), .7));
    if (suit) { g.fillStyle = L.jacket; g.fillRect(R.X(.75) - 9, R.y, 7, R.h); g.fillStyle = L.accent; g.fillRect(R.X(.75) - 2, R.y, 2, R.h); }
    line(g, [[R.X(.25), R.y], [R.X(.25), R.y + R.h]], rgba('#000', .3), 2);
    line(g, [[R.X(.5), R.y], [R.X(.5), R.y + R.h]], rgba('#ffffff', .06), 4);
    // plis (genou / bas de jambe froncé dans la botte)
    var yk = part === 'shin' ? [.0, -.05] : [-.36, -.44];
    for (var i = 0; i < 9; i++) { var t = .38 + rnd() * .24, y = yk[0] + (yk[1] - yk[0]) * rnd(), p = [R.X(t), R.Y(V(y))]; line(g, [[p[0] - 14, p[1]], [p[0], p[1] + 4], [p[0] + 14, p[1] - 2]], rgba('#000', .2), 2.5); }
    if (part === 'shin') for (i = 0; i < 10; i++) { var t2 = rnd(), y2 = -.3 - rnd() * .06, q = [R.X(t2), R.Y(V(y2))]; line(g, [[q[0] - 12, q[1]], [q[0] + 12, q[1] + 3]], rgba('#000', .25), 3); }
    g.restore(); noise(g, R, '#000', 1500, .07, L.seed + 13, 2);
  }
  function paintPelvis(g, L) {
    var R = Reg(REG.pelvis), V = function (y) { return (y - .76) / .27; };
    g.fillStyle = L.pants; g.fillRect(R.x, R.y, R.w, R.h); clip(g, R);
    // braguette surpiquée, poches arrière, coutures latérales
    var fx = R.X(.5); line(g, [[fx, R.Y(V(1.0))], [fx, R.Y(V(.8))]], rgba('#000', .45), 2);
    stitch(g, [[fx + 9, R.Y(V(1.0))], [fx + 9, R.Y(V(.84))], [fx + 2, R.Y(V(.8))]], rgba(shade(L.pants, .45), .8));
    [.09, .91].forEach(function (t) { var x = R.X(t), y = R.Y(V(.94)); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - 15, y, 30, 26); stitch(g, [[x - 13, y], [x - 13, y + 24], [x + 13, y + 24], [x + 13, y]], rgba(shade(L.pants, .45), .7)); });
    [.25, .75].forEach(function (t) { line(g, [[R.X(t), R.y], [R.X(t), R.y + R.h]], rgba('#000', .35), 2); });
    var gr = g.createLinearGradient(0, R.y, 0, R.y + R.h); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; g.fillRect(R.x, R.y, R.w, R.h);
    g.restore(); noise(g, R, '#000', 800, .07, L.seed + 19, 2);
  }
  function paintAtlas(L) {
    var cv = document.createElement('canvas'); cv.width = cv.height = S; var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    paintHead(g, L); paintTorso(g, L); paintArm(g, L); paintFore(g, L);
    paintPants(g, L, REG.thigh, -.45, .1, 'thigh'); paintPants(g, L, REG.shin, -.36, .04, 'shin'); paintPelvis(g, L); paintIris(g, L);
    g.fillStyle = '#ffffff'; g.fillRect(REG.white[0], REG.white[1], REG.white[2], REG.white[3]);
    return cv;
  }
  var MATS = {};
  function lookMat(id) {
    if (MATS[id]) return MATS[id];
    var tex = new T.CanvasTexture(paintAtlas(LOOKS[id])); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    var mat = new T.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: .74, metalness: 0 });
    // liseré de lumière sur les contours (lecture du personnage, style battle royale)
    mat.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float azRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\n  gl_FragColor.rgb += vec3(0.62, 0.8, 1.0) * azRim * 0.2;');
    };
    mat.customProgramCacheKey = function () { return 'az89-hero-rim'; };
    MATS[id] = mat; return mat;
  }
  var outline = new T.MeshBasicMaterial({ color: '#131826', side: T.BackSide });
  outline.onBeforeCompile = function (sh) { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.0105;'); };
  outline.customProgramCacheKey = function () { return 'azur-outline-89b'; };

  /* =========================================================== construction */
  function radialUp(cx, cy, cz) { return function (P, t, out) { return out.set(P.x - cx, P.y - cy, P.z - cz).normalize(); }; }

  function buildHead(L, lo) {
    var G = mk(lo), f = L.body === 'f', HR = headRings(L);
    loft(G, HR, { reg: REG.head, seg: 30, v0: HV0, v1: HV1, capCol: L.skin });
    // nez (sans liseré : volume lisse)
    var D = G.d;
    sweep(D, [[0, .028, -.113], [0, .003, -.123], [0, -.021, -.134], [0, -.032, -.138]], { r: function (t) { return [(f ? .0058 : .0068) + .0055 * t, .0065 + .004 * t]; }, up: [0, 0, -1], col: L.skin, steps: 8, seg: 10 });
    ell(D, f ? .0118 : .0138, L.skin, 0, -.034, -.132, 1.05, .9, 1);
    for (var s = -1; s <= 1; s += 2) {
      ell(D, f ? .0082 : .0095, L.skin, s * (f ? .0128 : .0145), -.041, -.124, 1, .85, 1);
      ell(D, .0042, '#4a2a22', s * .0075, -.0465, -.1295, 1.3, .45, 1);
      // oreilles
      ell(G, .031, L.skin, s * .098, -.012, .014, .33, 1.02, .64, 0, s * .22, 0);
      ell(D, .017, L.skinD, s * .107, -.01, .012, .2, .78, .5, 0, s * .22, 0);
      ell(D, .008, L.skin, s * .102, -.034, .016, .4, .9, .7);
    }
    // cheveux
    var hc = L.hairC;
    if (L.hair === 'quiff') {
      // calotte courte + mèches épaisses relevées et rabattues sur le côté (coupe « texturée »)
      loft(G, [[.042, .105, -.116, .119, .01, 2, .052, -.035], [.08, .107, -.122, .134, .012, 2, .028, -.012], [.115, .101, -.117, .132, .015], [.145, .088, -.1, .117, .017], [.165, .066, -.077, .095, .018], [.18, .038, -.045, .06, .018], [.186, .008, -.01, .016, .018]],
        { col: hc, seg: 28, caps: false });
      var up = radialUp(0, -.01, .01), rq = rng(L.seed + 77);
      var lock = function (pts, wd, th, tipK) { sweep(G, pts, { r: function (t) { var a = Math.sin(cl(t * 1.6 + .2, 0, 1) * Math.PI * .5 + Math.PI * .5 * cl(t * 1.6 - .5, 0, 1)); var tp = 1 - Math.pow(t, 1.4) * (tipK || .85); return [Math.max(.0035, wd * tp * (.75 + .25 * a)), Math.max(.003, th * (1 - t * .55))]; }, up: up, col: hc, col2: L.hairH, cp: 2.2, steps: 16, seg: 9 }); };
      // frange relevée, légèrement rabattue vers la gauche du personnage
      for (var k = 0; k < 6; k++) {
        var x0 = .05 - k * .02, j = (rq() - .5) * .006, hk = 1 - Math.abs(x0 + .01) * 7;
        lock([[x0, .09 + Math.abs(x0) * .1, -.114 + Math.abs(x0) * .1], [x0 - .003 + j, .125 + .006 * hk, -.124], [x0 - .012, .158 + .008 * hk, -.113 + j], [x0 - .022, .174 + .006 * hk, -.084], [x0 - .03, .178, -.045]], .022 + .007 * hk, .013, .9);
      }
      // dessus : couches qui partent vers l'arrière
      for (k = 0; k < 7; k++) {
        var x1 = .06 - k * .02, z0 = -.07 + (rq() - .5) * .02;
        lock([[x1, .168, z0], [x1 - .006, .181, z0 + .045], [x1 - .01, .178, z0 + .095], [x1 - .012, .155, z0 + .15], [x1 - .012, .128, z0 + .178]], .022, .01, .8);
      }
    } else {
      loft(G, [[.028, .107, -.11, .13, .01, 2, .066, -.1], [.06, .108, -.12, .135, .012, 2, .038, -.06], [.1, .1, -.115, .134, .014, 2, 0, -.02], [.135, .087, -.099, .121, .016], [.16, .065, -.075, .099, .018], [.178, .037, -.043, .063, .018], [.187, .008, -.01, .016, .018]],
        { col: hc, seg: 28, caps: false });
      var up2 = radialUp(0, .0, .01);
      var onHead = function (y, x, off) { var r = ringAt(HR, y), xx = cl(x, -r[1] * .86, r[1] * .86); return surf(HR, y, xx, false, off).p.toArray(); };
      // frange balayée vers la gauche du personnage, posée sur le front
      for (k = 0; k < 5; k++) {
        var xs = .046 - k * .022, pts = [];
        [.15, .13, .108, .088, .07].forEach(function (y, n) { pts.push(onHead(y, xs - (.15 - y) * .55, .014 - n * .0015)); });
        sweep(G, pts, { r: function (t) { return [Math.max(.004, .025 * (1 - t * .75)), .0085 * (1 - t * .45)]; }, up: up2, col: hc, col2: L.hairH, cp: 2, steps: 14, seg: 8 });
      }
      // mèches qui encadrent le visage, devant les oreilles
      for (s = -1; s <= 1; s += 2) {
        var sp2 = [];
        [.095, .055, .015, -.025, -.06].forEach(function (y, n) { var r = ringAt(HR, y); sp2.push(onHead(y, s * r[1] * .8, .011 - n * .001)); });
        sweep(G.d, sp2, { r: function (t) { return [Math.max(.005, .021 * (1 - t * .65)), .0075 * (1 - t * .4)]; }, up: up2, col: hc, col2: L.hairH, cp: 1.5, steps: 12, seg: 8 });
      }
      // élastique et queue-de-cheval haute, épaisse
      G.push(new T.TorusGeometry(.028, .01, 8, 18), L.accent, mx(0, .128, .136, -.35, 0, 0));
      sweep(G, [[0, .134, .118], [0, .134, .16], [.002, .1, .198], [.005, .03, .214], [.008, -.05, .206], [.01, -.12, .188], [.01, -.175, .172]],
        { r: function (t) { var a = t < .1 ? .75 + t * 2.5 : 1 - (t - .1) * .85; return [Math.max(.007, .052 * a), Math.max(.006, .04 * a)]; }, up: [0, 0, 1], col: hc, col2: L.hairH, cp: 1.6, steps: 24, seg: 12 });
      for (s = -1; s <= 1; s += 2) sweep(G, [[s * .012, .12, .17], [s * .034, .05, .207], [s * .04, -.03, .205], [s * .032, -.11, .185]], { r: function (t) { return [Math.max(.004, .018 * (1 - t)), .014 * (1 - t * .6)]; }, up: [0, 0, 1], col: hc, col2: L.hairH, steps: 12, seg: 8 });
    }
    if (L.headset) {
      ell(G, .027, L.gear, .107, -.012, .012, .45, 1, 1); ell(G, .017, L.accent, .119, -.012, .012, .3, .9, .9);
      sweep(G.d, [[.104, .015, .02], [.112, .1, .03], [.07, .19, .05], [0, .222, .058], [-.07, .19, .05], [-.112, .1, .03], [-.104, .015, .02]], { r: [.0065, .004], up: radialUp(0, 0, .02), col: L.gear, steps: 18, seg: 8 });
      ell(G, .02, L.gear, -.105, -.005, .015, .35, .9, .9);
      sweep(G.d, [[.1, -.03, -.012], [.09, -.06, -.06], [.066, -.08, -.1], [.036, -.09, -.12]], { r: .0042, up: [0, 1, 0], col: L.gear, steps: 10, seg: 6 });
      ell(G.d, .0085, L.accent, .033, -.09, -.122, 1.2, 1, 1);
    }
    return G;
  }
  function eyeCenter(L, s) {
    var HR = headRings(L), y = .009, r = ringAt(HR, y), p = ringPt(r, thetaOf(r, s * .043, false), new T.Vector3()), rE = L.body === 'f' ? .0242 : .0235;
    return { c: new T.Vector3(s * .043, y, p.z + rE - .0058), r: rE };
  }
  function buildEyes(L, lo) {
    var G = mk(lo), f = L.body === 'f';
    for (var s = -1; s <= 1; s += 2) {
      var E = eyeCenter(L, s), c = E.c, r = E.r;
      ell(G, r, '#f1ede6', c.x, c.y, c.z);
      var rI = r * 1.006, pm = .6, rp = rI * Math.sin(pm);
      shell(G, rI, pm, mx(c.x, c.y, c.z, -Math.PI / 2, s * .04, 0), function () { return '#ffffff'; }, function (x, y, z) { return uvOf(REG.iris, .5 + x / (2 * rp), .5 + z / (2 * rp)); });
      // paupière supérieure avec trait de cils
      var lidMax = f ? .8 : .86;
      shell(G, r * 1.055, lidMax, mx(c.x, c.y, c.z, -.28, 0, s * -.08), function (phi) { return phi > lidMax - (f ? .22 : .17) ? L.lash : phi > lidMax - .32 ? shade(L.skin, -.08) : L.skin; });
      // paupière inférieure
      shell(G, r * 1.035, .8, mx(c.x, c.y, c.z, Math.PI + .3, 0, 0), function (phi) { return phi > .7 ? shade(L.skinD, -.1) : L.skin; });
      if (f) sweep(G, [[c.x + s * r * .78, c.y + r * .32, c.z - r * .4], [c.x + s * r * 1.05, c.y + r * .5, c.z - r * .1], [c.x + s * r * 1.22, c.y + r * .72, c.z + r * .1]], { r: function (t) { return [.0028 * (1 - t * .7), .0018]; }, up: [0, 0, -1], col: L.lash, steps: 6, seg: 6 });
    }
    return G;
  }
  function buildLids(L, lo) {
    var G = mk(lo);
    for (var s = -1; s <= 1; s += 2) {
      var E = eyeCenter(L, s);
      shell(G, E.r * 1.07, 1.5, mx(E.c.x, E.c.y, E.c.z, -Math.PI / 2, 0, 0), function (phi, x, y, z) { return z < -.0012 && z > -.0052 && phi > .35 ? L.lash : L.skin; });
    }
    return G;
  }
  function buildTorso(L, lo) {
    var G = mk(lo), f = L.body === 'f', TR = torsoRings(L), suit = L.top === 'suit';
    loft(G, TR, { reg: REG.torso, seg: 32, v0: TV0, v1: TV1, capCol: L.jacketD });
    // cou
    var nk = f ? .88 : 1;
    loft(G, [[1.5, .052 * nk, -.05 * nk, .068, .008], [1.6, .05 * nk, -.048 * nk, .066, .008], [1.69, .047 * nk, -.042 * nk, .06, .01]], { col: L.skin, seg: 16, caps: false });
    ell(G.d, .03, L.skinD, 0, 1.565, -.035, 1.2, .5, .6);
    if (!suit) {
      // col montant en bord-côte, ouvert devant
      var col = [];
      for (var i = 0; i <= 14; i++) { var a = -2.55 + i * 5.1 / 14, y = 1.6 - .028 * (1 - Math.cos(a)) / 2; col.push([Math.sin(a) * .078, y, .006 + Math.cos(a) * .074]); }
      sweep(G, col, { r: [.0075, .02], up: [0, 1, 0], col: L.jacketD, steps: 24, seg: 8 });
      // revers de l'ouverture (épaisseur)
      for (var s = -1; s <= 1; s += 2) {
        var pts = [];
        for (var y2 = 1.03; y2 <= 1.56; y2 += .05) { var w = .046 + (y2 > 1.46 ? (y2 - 1.46) * .35 : 0); pts.push(surf(TR, y2, s * w, false, .003).p.toArray()); }
        sweep(G.d, pts, { r: [.011, .0045], up: function (P, t, out) { var r0 = ringAt(TR, P.y); return out.set(P.x - (r0[8] || 0), 0, P.z - zwOf(r0)).normalize(); }, col: shade(L.jacket, .06), steps: 16, seg: 8 });
      }
      // bord-côte du bas en relief
      var hem = []; for (i = 0; i < 16; i++) { var th = i / 16 * Math.PI * 2; hem.push(surf(TR, 1.016, .168 * Math.sin(th) * .999, Math.cos(th) < 0, .003).p.toArray()); }
      sweep(G.d, hem, { r: [.005, .017], up: [0, 1, 0], col: L.jacketD, closed: true, steps: 40, seg: 8 });
      // bandoulière (épaule droite → hanche gauche), pochettes, anneau
      var bp = [surf(TR, 1.4, .12, true, .007).p, surf(TR, 1.5, .145, true, .007).p, new T.Vector3(.15, 1.545, -.005), surf(TR, 1.5, .135, false, .007).p,
        surf(TR, 1.4, .1, false, .007).p, surf(TR, 1.27, .03, false, .007).p, surf(TR, 1.14, -.06, false, .007).p, surf(TR, 1.04, -.14, false, .007).p];
      sweep(G, bp.map(function (p) { return p.toArray(); }), { r: [.021, .005], up: function (P, t, out) { var r0 = ringAt(TR, Math.min(1.5, P.y)); return out.set(P.x - (r0[8] || 0), P.y > 1.52 ? .9 : 0, P.z - zwOf(r0)).normalize(); }, col: L.strap, steps: 34, seg: 8 });
      [[.06, 1.31, .062], [-.075, 1.12, .052]].forEach(function (q) {
        var sp0 = surf(TR, q[1], q[0], false, .02), ang = Math.atan2(sp0.n.x, -sp0.n.z);
        rbox(G, q[2], .062, .034, L.strap, sp0.p.x, sp0.p.y, sp0.p.z, 0, -ang, .62);
        rbox(G.d, q[2] * 1.04, .022, .038, shade(L.strap, -.25), sp0.p.x + .006, sp0.p.y + .02, sp0.p.z - .002, 0, -ang, .62);
        ell(G.d, .0055, L.metal, sp0.p.x + .006, sp0.p.y + .02, sp0.p.z - .02);
      });
      var rg = surf(TR, 1.385, .095, false, .012).p; G.d.push(new T.TorusGeometry(.016, .0045, 8, 18), L.metal, mx(rg.x, rg.y, rg.z, 0, .5, .3));
    } else {
      // col montant fermé, harnais de vol, boucle
      var cr = []; for (i = 0; i < 16; i++) { var a2 = i / 16 * Math.PI * 2; cr.push([Math.sin(a2) * .068, 1.598 - .012 * Math.cos(a2), .006 + Math.cos(a2) * .066]); }
      sweep(G, cr, { r: [.008, .026], up: [0, 1, 0], col: L.jacket2, closed: true, steps: 36, seg: 8 });
      var upT = function (P, t, out) { var r0 = ringAt(TR, Math.min(1.5, P.y)); return out.set(P.x - (r0[8] || 0), P.y > 1.52 ? .9 : 0, P.z - zwOf(r0)).normalize(); };
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var hp = [surf(TR, 1.05, s2 * .1, true, .007).p, surf(TR, 1.3, s2 * .11, true, .007).p, surf(TR, 1.5, s2 * .125, true, .007).p, new T.Vector3(s2 * .13, 1.548, 0), surf(TR, 1.5, s2 * .12, false, .007).p,
          surf(TR, 1.38, s2 * .09, false, .009).p, surf(TR, 1.22, s2 * .035, false, .009).p];
        sweep(G, hp.map(function (p) { return p.toArray(); }), { r: [.017, .005], up: upT, col: L.strap, steps: 30, seg: 8 });
        var lp = [surf(TR, 1.2, s2 * .03, false, .009).p, surf(TR, 1.1, s2 * .1, false, .008).p, surf(TR, 1.02, s2 * .15, false, .007).p];
        sweep(G, lp.map(function (p) { return p.toArray(); }), { r: [.016, .005], up: upT, col: L.strap, steps: 10, seg: 8 });
      }
      var bk = surf(TR, 1.205, 0, false, .014).p; rbox(G, .07, .055, .022, L.gear, bk.x, bk.y, bk.z); ell(G.d, .016, L.metal, bk.x, bk.y, bk.z - .012, 1, 1, .35);
    }
    return G;
  }
  function buildPelvis(L, lo) {
    var G = mk(lo), PR = pelvisRings(L), f = L.body === 'f';
    loft(G, PR, { reg: REG.pelvis, seg: 26, v0: .76, v1: 1.03, capCol: L.pants });
    var belt = [];
    for (var i = 0; i < 16; i++) { var th = i / 16 * Math.PI * 2, r = ringAt(PR, .968), x = Math.sin(th) * (r[1] + .006), z = Math.cos(th) > 0 ? zwOf(r) - (zwOf(r) - r[2] + .006) * Math.cos(th) : zwOf(r) - (r[3] - zwOf(r) + .006) * Math.cos(th); belt.push([x, .968, z]); }
    sweep(G, belt, { r: [.0065, .022], up: [0, 1, 0], col: L.strap, closed: true, steps: 44, seg: 8 });
    rbox(G, .064, .046, .014, L.metal, 0, .968, -.124); rbox(G.d, .036, .022, .01, L.strap, 0, .968, -.13);
    for (var s = -1; s <= 1; s += 2) {
      rbox(G, .075, .08, .042, s < 0 ? L.gear : L.strap, s * .17, .935, -.035, 0, s * -.35, 0);
      rbox(G, .079, .028, .046, shade(s < 0 ? L.gear : L.strap, -.2), s * .17, .968, -.035, 0, s * -.35, 0);
      for (var k = 0; k < 2; k++) rbox(G.d, .014, .034, .012, L.strap, s * (.07 + k * .12), .968, k ? -.07 : -.112, 0, s * (k ? -.9 : -.35), 0);
    }
    if (f) rbox(G, .05, .03, .03, L.accent, -.14, .99, .07);
    return G;
  }
  function buildUpperArm(L, s, lo) {
    var G = mk(lo);
    loft(G, armRings(L, s), { reg: REG.arm, mirror: s > 0, seg: 22, v0: -.345, v1: .078, capCol: L.jacket2 });
    if (L.sleeves === 'rolled') {
      for (var k = 0; k < 2; k++) {
        var ring = []; for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; ring.push([Math.sin(a) * (.064 - k * .002), -.305 - k * .024, Math.cos(a) * (.062 - k * .002)]); }
        sweep(G, ring, { r: [.011, .014], up: [0, 1, 0], col: k ? L.jacket : L.jacket2, closed: true, steps: 30, seg: 8 });
      }
    }
    return G;
  }
  function buildForearm(L, s, lo) {
    var G = mk(lo), f = L.body === 'f', bare = L.sleeves === 'rolled', k = f ? .9 : 1;
    loft(G, foreRings(L), { reg: REG.fore, mirror: s > 0, seg: 20, v0: -.258, v1: .03, capCol: bare ? L.skin : L.jacket });
    if (bare) {
      if (s < 0) { rbox(G.d, .07, .03, .07, L.gear, 0, -.228, 0); rbox(G.d, .036, .006, .03, L.accent, s * -.005, -.228, -.036); }
      else { var w = []; for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; w.push([Math.sin(a) * .042, -.232, Math.cos(a) * .039]); } sweep(G.d, w, { r: [.004, .01], up: [0, 1, 0], col: L.accent, closed: true, steps: 28, seg: 6 }); }
    } else {
      var cuff = []; for (var j = 0; j < 12; j++) { var b = j / 12 * Math.PI * 2; cuff.push([Math.sin(b) * .045, -.225, Math.cos(b) * .042]); }
      sweep(G, cuff, { r: [.008, .014], up: [0, 1, 0], col: L.glove, closed: true, steps: 28, seg: 8 });
    }
    // main : paume, doigts, pouce
    var gl = L.glove, sk = L.skin, palm = mx(0, 0, 0, 0, s * .3, 0);
    loft(G, [[-.25, .032 * k, -.017, .017, 0, 2.6], [-.272, .039 * k, -.02, .021, 0, 2.6], [-.3, .043 * k, -.021, .022, 0, 2.6], [-.324, .041 * k, -.018, .019, 0, 2.6], [-.336, .035 * k, -.012, .013, 0, 2.6]], { col: gl, seg: 16, mat: palm });
    rbox(G.d, .074 * k, .016, .012, bare ? L.gear : shade(gl, -.08), 0, -.318, -.02, 0, s * .3, 0);
    var lens = [.06, .066, .062, .05];
    for (var fi = 0; fi < 4; fi++) {
      var fx = -s * (.027 - fi * .018) * k, Lf = lens[fi] * (f ? .94 : 1), fr = (fi === 3 ? .0088 : .0102) * k;
      var pts = [[fx, -.328, -.002], [fx * 1.02, -.328 - Lf * .4, .004], [fx * 1.03, -.328 - Lf * .78, .014], [fx * 1.03, -.328 - Lf, .028]].map(function (p) { return new T.Vector3(p[0], p[1], p[2]).applyMatrix4(palm).toArray(); });
      sweep(G.d, pts, { r: function (t) { return [fr * (1 - t * .18), fr * .92 * (1 - t * .15)]; }, up: [0, 0, -1], colFn: bare ? function (t) { return t < .42 ? gl : sk; } : null, col: gl, steps: 8, seg: 9 });
    }
    var th = [[-s * .033, -.268, -.012], [-s * .049, -.292, -.022], [-s * .054, -.318, -.03], [-s * .05, -.338, -.034]].map(function (p) { return new T.Vector3(p[0] * k, p[1], p[2]).applyMatrix4(palm).toArray(); });
    sweep(G.d, th, { r: function (t) { return [.0125 * k * (1 - t * .25), .0115 * k * (1 - t * .2)]; }, up: [0, 0, -1], colFn: bare ? function (t) { return t < .5 ? gl : sk; } : null, col: gl, steps: 8, seg: 9 });
    return G;
  }
  function buildThigh(L, s, lo) {
    var G = mk(lo), TH = thighRings(L);
    loft(G, TH, { reg: REG.thigh, mirror: s > 0, seg: 22, v0: -.45, v1: .1, capCol: L.pants });
    if (L.top !== 'suit') {
      var sp0 = surf(TH, -.21, s * .1, false, 0), ox = s * .099;
      rbox(G, .03, .12, .1, L.pants2, ox, -.21, .004, 0, 0, s * -.05);
      rbox(G.d, .036, .034, .106, shade(L.pants2, -.15), ox + s * .004, -.15, .004, 0, 0, s * -.05);
      ell(G.d, .006, L.metal, ox + s * .02, -.152, -.03);
      var st = []; for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; st.push([Math.sin(a) * .104, -.085, Math.cos(a) * .104]); }
      sweep(G.d, st, { r: [.004, .012], up: [0, 1, 0], col: L.strap, closed: true, steps: 28, seg: 6 });
      rbox(G.d, .02, .028, .022, L.metal, s * .1, -.085, -.04);
    } else {
      rbox(G, .026, .1, .08, L.pants2, s * .098, -.2, .0, 0, 0, s * -.05);
      rbox(G.d, .03, .012, .084, L.accent, s * .1, -.152, 0, 0, 0, s * -.05);
    }
    return G;
  }
  function buildShin(L, s, lo) {
    var G = mk(lo), f = L.body === 'f', suit = L.top === 'suit';
    loft(G, shinRings(L), { reg: REG.shin, mirror: s > 0, seg: 22, v0: -.36, v1: .04, capCol: L.pants });
    // genouillère
    ell(G, f ? .056 : .066, suit ? L.jacket2 : L.gear, 0, -.032, f ? -.068 : -.064, 1.02, 1.18, .46, -.1, 0, 0);
    rbox(G.d, .07, .014, .012, L.accent, 0, -.045, -.098, -.1, 0, 0);
    if (!suit) { var kr = []; for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; kr.push([Math.sin(a) * .086, -.06, .004 + Math.cos(a) * .086]); } sweep(G.d, kr, { r: [.004, .01], up: [0, 1, 0], col: L.gear, closed: true, steps: 28, seg: 6 }); }
    // botte : tige, revers, pied, semelle, languette, lacets
    var bk = f ? .94 : 1;
    loft(G, [[-.47, .072 * bk, -.084, .072], [-.42, .074 * bk, -.08, .074], [-.36, .072 * bk, -.074, .074], [-.3, .069 * bk, -.07, .07]], { col: L.boots, seg: 20 });
    var cf = []; for (i = 0; i < 12; i++) { var b = i / 12 * Math.PI * 2; cf.push([Math.sin(b) * .072 * bk, -.302, Math.cos(b) * .072]); }
    sweep(G, cf, { r: [.008, .016], up: [0, 1, 0], col: L.boots2, closed: true, steps: 28, seg: 8 });
    var foot = mx(0, -.452, 0, -Math.PI / 2, 0, 0);
    var FR = [[-.088, .02, -.026, .028, 0], [-.074, .052, -.044, .052, 0, 2.2], [-.035, .066, -.05, .068, 0, 2.2], [.025, .07, -.05, .06, -.004, 2.3], [.085, .07, -.05, .042, -.01, 2.4], [.135, .066, -.05, .032, -.015, 2.4], [.172, .056, -.048, .024, -.02, 2.3], [.198, .036, -.042, .014, -.022], [.208, .01, -.034, -.004, -.02]];
    loft(G, FR.map(function (r) { return [r[0], r[1] * bk, r[2], r[3], r[4], r[5]]; }), { col: L.boots, seg: 22, mat: foot });
    // pare-pierres (bout renforcé)
    var TC = [.112, .14, .165, .185, .2, .21].map(function (yl) { var r = ringAt(FR, Math.min(yl, .208)); return [yl, r[1] * bk + .003, r[2] - .002, r[3] + .003, r[4], r[5]]; });
    loft(G, TC, { col: L.boots2, seg: 22, mat: foot });
    var SR = FR.map(function (r) { return [r[0] * 1.03, (r[1] + .008) * bk, -.074, -.046, -.06, 3.2]; });
    loft(G, SR, { col: L.sole, seg: 22, mat: foot });
    loft(G.d, FR.map(function (r) { return [r[0] * 1.025, (r[1] + .005) * bk, -.078, -.068, -.073, 3.2]; }), { col: L.soleD, seg: 22, mat: foot });
    rbox(G.d, .052, .075, .014, L.boots2, 0, -.39, -.064, -.38, 0, 0);
    for (var k = 0; k < 4; k++) {
      var zz = -.04 - k * .026, yy = -.385 - k * .013;
      sweep(G.d, [[-.03 * bk, yy - .003, zz + .006], [0, yy + .002, zz - .004], [.03 * bk, yy - .003, zz + .006]], { r: .0045, up: [0, 1, 0], col: L.lace, steps: 6, seg: 6 });
      ell(G.d, .0055, L.metal, -.034 * bk, yy - .004, zz + .01); ell(G.d, .0055, L.metal, .034 * bk, yy - .004, zz + .01);
    }
    return G;
  }

  /* sac à dos refait (pour le sac de base « Sac Balise » et ses déclinaisons de couleur) */
  function buildPack(L, c1, c2, lo) {
    var G = mk(lo), D = G.d, f = L.body === 'f', TR = torsoRings(L);
    var upT = function (P, t, out) { var r0 = ringAt(TR, Math.min(1.5, P.y)); return out.set(P.x - (r0[8] || 0), P.y > 1.52 ? .9 : 0, P.z - zwOf(r0)).normalize(); };
    if (L.top !== 'suit') {
      // sac d'éclaireur : corps, rabat, poche avant, poches latérales, sac de couchage roulé, antenne
      rbox(G, .3, .33, .125, c1, 0, 1.265, .2);
      rbox(G, .312, .085, .14, shade(c1, -.14), 0, 1.405, .202);
      rbox(G, .22, .135, .05, shade(c1, -.05), 0, 1.2, .282);
      rbox(D, .228, .04, .056, c2, 0, 1.262, .284);
      for (var s = -1; s <= 1; s += 2) {
        rbox(G, .05, .15, .1, c2, s * .166, 1.2, .2);
        rbox(D, .026, .27, .012, c2, s * .085, 1.28, .272);
        rbox(D, .034, .026, .016, L.metal, s * .085, 1.235, .304);
        // bretelles : du haut du sac, par-dessus l'épaule, jusque sous le bras
        var bp = [new T.Vector3(s * .088, 1.43, .135), new T.Vector3(s * .1, 1.553, .018), surf(TR, 1.47, s * .11, false, .008).p, surf(TR, 1.37, s * .135, false, .008).p, surf(TR, 1.3, s * .19, false, .008).p];
        sweep(G, bp.map(function (p) { return p.toArray(); }), { r: [.021, .006], up: upT, col: c2, steps: 22, seg: 8 });
        rbox(D, .03, .036, .012, L.metal, bp[3].x, bp[3].y + .02, bp[3].z - .004, 0, s * .4, 0);
      }
      G.push(new T.CylinderGeometry(.046, .046, .36, lo ? 10 : 20), '#c7b089', mx(0, 1.488, .198, 0, 0, Math.PI / 2));
      G.push(new T.CylinderGeometry(.03, .03, .362, lo ? 8 : 16), shade('#c7b089', -.25), mx(0, 1.488, .198, 0, 0, Math.PI / 2));
      for (s = -1; s <= 1; s += 2) D.push(new T.TorusGeometry(.048, .006, 6, 18), c2, mx(s * .11, 1.488, .198, 0, Math.PI / 2, 0));
      sweep(D, [[.13, 1.42, .25], [.138, 1.55, .262], [.145, 1.68, .272]], { r: .004, col: L.gear, steps: 6, seg: 6 });
      ell(D, .011, L.accent, .145, 1.69, .272);
    } else {
      // sac de vol : coque lisse, ailettes, deux tuyères et bande lumineuse
      loft(G, [[1.1, .1, -.04, .045, 0, 3], [1.13, .125, -.05, .055, 0, 3], [1.3, .132, -.055, .06, 0, 3], [1.42, .118, -.05, .052, 0, 3], [1.46, .085, -.04, .04, 0, 3]], { col: L.jacket2, seg: 24, mat: mx(0, 0, .19) });
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        rbox(G, .03, .26, .09, c1, s2 * .132, 1.28, .2);
        rbox(G, .012, .16, .07, c1, s2 * .158, 1.3, .2, 0, 0, s2 * -.15);
        G.push(new T.CylinderGeometry(.034, .04, .08, lo ? 10 : 18), L.gear, mx(s2 * .065, 1.075, .2));
        D.push(new T.CylinderGeometry(.026, .026, .006, lo ? 10 : 18), L.accent, mx(s2 * .065, 1.033, .2));
      }
      rbox(D, .022, .22, .01, L.accent, 0, 1.29, .252);
      rbox(D, .1, .03, .012, c1, 0, 1.42, .246);
    }
    return G;
  }

  /* ============================================================== habillage */
  function part(parent, geo, mat, detail, noOutline, tag) {
    if (geo && geo.main) { var o1 = part(parent, geo.main, mat, detail, noOutline, tag); if (geo.det) part(parent, geo.det, mat, detail, true, tag + '-d'); return o1; }
    var o = new T.Mesh(geo, mat); o.userData.v89 = tag || true; o.userData.shared = true; o.castShadow = true; o.receiveShadow = true;
    if (detail !== 'low' && !noOutline) { var h = new T.Mesh(geo, outline); h.userData.outline = true; h.userData.v89 = true; h.userData.shared = true; h.raycast = function () {}; h.renderOrder = -1; h.castShadow = false; o.add(h); }
    parent.add(o); return o;
  }
  function hideOldDeep(node) { node.traverse(function (c) { if (c.isMesh && !c.userData.v89 && !c.userData.outline) c.visible = false; }); }
  var GEO = {};
  function geoFor(key, fn) {
    var g = GEO[key]; if (g) return g;
    var G = fn(); g = GEO[key] = { main: G.geometry(), det: G.d && G.d.i.length ? G.d.geometry() : null };
    return g;
  }

  function dress(avatar, id, detail, eq) {
    var u = avatar.userData, L = LOOKS[id];
    if (!u || !u.torso || !u.head || !u.limbs || !u.knees || !u.elbows) return avatar;
    detail = detail === 'low' ? 'low' : 'high';
    var lo = detail === 'low', mat = lookMat(id), K = id + '|' + detail + '|';
    // l'ancien modèle disparaît (le sac, les effets d'emote, l'arme, l'outil et le planeur restent)
    if (u.torso.children[0] && u.torso.children[0].isMesh) u.torso.children[0].visible = false;
    u.torso.traverse(function (c) { if (c.isMesh && c.userData.v81armor) c.visible = false; });
    hideOldDeep(u.head);
    u.limbs.forEach(hideOldDeep); u.knees.forEach(hideOldDeep);
    if (u.pelvis && u.pelvis.isMesh) u.pelvis.visible = false;
    part(u.torso, geoFor(K + 'torso', function () { return buildTorso(L, lo); }), mat, detail, false, 'torso');
    var pel = new T.Group(); pel.userData.v89 = 'pelvis'; avatar.add(pel);
    part(pel, geoFor(K + 'pelvis', function () { return buildPelvis(L, lo); }), mat, detail, false, 'pelvis');
    u.pelvis = pel;
    part(u.head, geoFor(K + 'head', function () { return buildHead(L, lo); }), mat, detail, false, 'head');
    part(u.head, geoFor(K + 'eyes', function () { return buildEyes(L, lo); }), mat, detail, true, 'eyes');
    for (var i = 0; i < 2; i++) {
      var s = i ? 1 : -1, sh = u.limbs[i * 2 + 1], hip = u.limbs[i * 2], kn = u.knees[i], el = u.elbows[i];
      part(sh, geoFor(K + 'arm' + s, function () { return buildUpperArm(L, s, lo); }), mat, detail, false, 'arm');
      part(el, geoFor(K + 'fore' + s, function () { return buildForearm(L, s, lo); }), mat, detail, false, 'forearm');
      part(hip, geoFor(K + 'thigh' + s, function () { return buildThigh(L, s, lo); }), mat, detail, false, 'thigh');
      part(kn, geoFor(K + 'shin' + s, function () { return buildShin(L, s, lo); }), mat, detail, false, 'shin');
    }
    // sac de base remplacé par un sac sculpté (l'orbe et la voile gardent leur forme)
    var back = eq && eq.back || '';
    if (back !== 'back-orbe' && back !== 'back-voile') {
      var old = null;
      u.torso.children.forEach(function (c, k) { if (k && c.isMesh && !c.userData.v89 && c.geometry && c.geometry.boundingSphere) { var bs = c.geometry.boundingSphere; if (bs.center.z > .15 && bs.center.y > 1.1 && bs.center.y < 1.5) old = c; } });
      if (old) {
        old.visible = false;
        var bc = (A.cosmetic && back) ? A.cosmetic(back, { color: '#f0a35a', secondary: '#5b3242' }) : { color: '#f0a35a', secondary: '#5b3242' };
        var c1 = /^#[0-9a-f]{6}$/i.test(bc.color || '') ? bc.color : '#f0a35a', c2 = /^#[0-9a-f]{6}$/i.test(bc.secondary || '') ? bc.secondary : '#5b3242';
        part(u.torso, geoFor(K + 'pack|' + c1 + c2, function () { return buildPack(L, c1, c2, lo); }), mat, detail, false, 'pack');
      }
    }
    if (u.lids) {
      // le clignement peut écrire « undefined » (traité comme visible par three.js) : on force un booléen
      if (!u.lids.__v89vis) { var lv = false; Object.defineProperty(u.lids, 'visible', { get: function () { return lv; }, set: function (v) { lv = v === true; }, configurable: true }); u.lids.__v89vis = true; }
      hideOldDeep(u.lids); part(u.lids, geoFor(K + 'lids', function () { return buildLids(L, lo); }), mat, detail, true, 'lids'); }
    u.v89hero = id;
    return avatar;
  }

  var base = A.avatar;
  A.avatar = function (eq, detail) {
    var g = base.apply(this, arguments);
    try { var id = eq && eq.character; if (id && LOOKS[id]) dress(g, id, detail || (eq && eq.detail), eq); } catch (e) { console.error('[AZUR heroes89]', e); }
    return g;
  };
  if (root.AZView) root.AZView.avatar = A.avatar;
  root.AZHeroes89 = { LOOKS: LOOKS, dress: dress, paintAtlas: paintAtlas };
})(window);
