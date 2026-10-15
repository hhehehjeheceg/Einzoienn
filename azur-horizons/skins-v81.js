/* AZUR v81 — nouveaux skins blindés (créations originales).
 * Chaque skin remplace la tenue d'origine par une armure complète posée sur le
 * MÊME squelette (bassin, genoux, épaules, coudes, buste, tête) : marche,
 * visée, planeur, emotes et animations de l'événement restent intactes.
 *  - Sentinelle Azur : plaques bleu acier, combinaison sombre, casque intégral
 *    à visière cyan (offerte pour The End, équipée une fois automatiquement) ;
 *  - Éclipse, garde du vide : carapace noire mate, coutures violettes lumineuses ;
 *  - Aurore, chevalière solaire : armure blanche et or, visière ambre ;
 *  - Récif, plongeur des failles : combinaison corail et turquoise, casque bulle. */
(function (root) {
  'use strict';
  var T = root.THREE, A = root.AZArt, M = root.AZMeta;
  if (!T || !A || typeof A.avatar !== 'function' || !M || !M.catalog) return;

  var SKINS = {
    'char-sentinelle': { name: 'Sentinelle Azur', rarity: 4, price: 0, desc: 'Armure de veille des failles · offerte pour The End', color: '#2f6fd6', secondary: '#7fe8ff', icon: '⛨',
      armor: 0x2f6fd6, armor2: 0x1f4fa8, suit: 0x1a2232, trim: 0x9fb4c8, glow: 0x6fe8ff, visor: 0x0c1a2c, emit: 0x37c8ff, metal: .55, rough: .34 },
    'char-eclipse': { name: 'Éclipse, garde du vide', rarity: 4, price: 2000, desc: 'Carapace noire, coutures de lumière violette', color: '#2a1f44', secondary: '#c08cff', icon: '◐',
      armor: 0x1c1d26, armor2: 0x2a2440, suit: 0x0f1016, trim: 0x4b3d6e, glow: 0xb46bff, visor: 0x09060f, emit: 0xa45cff, metal: .7, rough: .28 },
    'char-aurore': { name: 'Aurore, chevalière solaire', rarity: 4, price: 2000, desc: 'Armure blanche et or, visière d’ambre', color: '#f3efe6', secondary: '#ffc44d', icon: '☀',
      armor: 0xeeeae2, armor2: 0xd8cdb4, suit: 0x3b3d48, trim: 0xe0a93a, glow: 0xffb340, visor: 0x2a1606, emit: 0xff9c2a, metal: .45, rough: .3 },
    'char-recif': { name: 'Récif, plongeur des failles', rarity: 3, price: 1200, desc: 'Combinaison étanche corail et turquoise', color: '#ff7a6b', secondary: '#38e0d0', icon: '◍',
      armor: 0xff7a6b, armor2: 0xe0574f, suit: 0x173a44, trim: 0x38e0d0, glow: 0x6ffff0, visor: 0x9fe9ff, emit: 0x38e0d0, metal: .25, rough: .45, bubble: true }
  };
  Object.keys(SKINS).forEach(function (id) {
    if (M.catalog.some(function (c) { return c.id === id; })) return;
    var s = SKINS[id];
    M.catalog.push({ id: id, name: s.name, type: 'character', rarity: s.rarity, price: s.price, description: s.desc, color: s.color, secondary: s.secondary, icon: s.icon, palette: 'armor', model: 'scout', armored: true });
  });
  // la Sentinelle est offerte et portée une fois automatiquement (le joueur peut changer ensuite)
  if (typeof M.normalize === 'function' && !M.normalize.__v81) {
    var norm = M.normalize;
    M.normalize = function (p) {
      var out = norm.apply(this, arguments);
      try {
        if (out && out.owned && out.owned.indexOf('char-sentinelle') < 0) out.owned.push('char-sentinelle');
        out.migrations = out.migrations || {};
        if (!out.migrations.sentinelle081 && out.equipment) { out.equipment.character = 'char-sentinelle'; delete out.equipment.variant; out.migrations.sentinelle081 = true; }
      } catch (e) {}
      return out;
    };
    M.normalize.__v81 = true;
  }

  /* ------------------------------------------------------------ matériaux */
  var mats = {};
  function matsFor(id) {
    if (mats[id]) return mats[id];
    var s = SKINS[id];
    mats[id] = {
      armor: new T.MeshStandardMaterial({ color: s.armor, metalness: s.metal, roughness: s.rough }),
      armor2: new T.MeshStandardMaterial({ color: s.armor2, metalness: s.metal, roughness: s.rough + .08 }),
      suit: new T.MeshStandardMaterial({ color: s.suit, metalness: .1, roughness: .82 }),
      trim: new T.MeshStandardMaterial({ color: s.trim, metalness: .7, roughness: .3 }),
      glow: new T.MeshStandardMaterial({ color: s.glow, emissive: s.emit, emissiveIntensity: 1.6, roughness: .4 }),
      visor: new T.MeshStandardMaterial({ color: s.visor, metalness: .9, roughness: .08, emissive: s.emit, emissiveIntensity: .18, transparent: !!s.bubble, opacity: s.bubble ? .45 : 1 })
    };
    return mats[id];
  }
  var outline = new T.MeshBasicMaterial({ color: '#141a2a', side: T.BackSide });
  outline.onBeforeCompile = function (sh) { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.014;'); };
  outline.customProgramCacheKey = function () { return 'azur-outline-81'; };
  var G = {};
  function geo(key, make) { return G[key] || (G[key] = make()); }
  function roundBox(w, h, d, r) {
    var s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    var g = new T.ExtrudeGeometry(s, { depth: Math.max(.001, d - r * 1.2), bevelEnabled: true, bevelThickness: r * .6, bevelSize: r * .6, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(d - r * 1.2) / 2); g.computeVertexNormals(); return g;
  }
  function part(parent, g, m, x, y, z, rx, ry, rz, sx, sy, sz, hi) {
    var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sx != null) o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    o.castShadow = true; o.receiveShadow = true; o.userData.v81armor = true; parent.add(o);
    if (hi && !(m.emissive && m.emissiveIntensity > .5)) { var h = new T.Mesh(g, outline); h.userData.outline = true; h.raycast = function () {}; o.add(h); }
    return o;
  }
  function hideBase(group) {
    group.children.forEach(function (c) { if (c.isMesh && !c.userData.v81armor) c.visible = false; });
  }

  /* --------------------------------------------------------- l'armure */
  function dress(avatar, id, detail) {
    var u = avatar.userData, s = SKINS[id], m = matsFor(id), hi = detail !== 'low';
    if (!u || !u.torso || !u.head || !u.limbs || !u.knees || !u.elbows) return avatar;
    var torso = u.torso, head = u.head;
    // la tenue d'origine disparaît (le sac, les effets d'emote et l'arme restent)
    torso.children.forEach(function (c, i) { if (c.isMesh && i === 0) c.visible = false; });
    head.children.forEach(function (c) { if (c.isMesh) c.visible = false; });
    u.limbs.forEach(hideBase); u.knees.forEach(hideBase); u.elbows.forEach(hideBase);
    var cyl = function (a, b, h, n) { return geo('c' + a + b + h + n, function () { return new T.CylinderGeometry(a, b, h, n || 14); }); };
    var sph = function (r, ws, hs) { return geo('s' + r + ws + hs, function () { return new T.SphereGeometry(r, ws || 18, hs || 12); }); };
    var rb = function (w, h, d, r) { return geo('r' + [w, h, d, r].join('_'), function () { return roundBox(w, h, d, r); }); };
    // --- buste
    part(torso, cyl(.2, .17, .62, 16), m.suit, 0, 1.22, 0, 0, 0, 0, null, null, null, hi);
    part(torso, rb(.5, .34, .2, .05), m.armor, 0, 1.36, -.06, -.06, 0, 0, null, null, null, hi);          // plastron
    part(torso, rb(.44, .3, .14, .045), m.armor2, 0, 1.34, .13, .05, 0, 0, null, null, null, hi);        // dossière
    part(torso, rb(.34, .085, .17, .03), m.armor2, 0, 1.15, -.04, 0, 0, 0, null, null, null, hi);        // abdomen
    part(torso, rb(.31, .08, .16, .03), m.armor2, 0, 1.065, -.03, 0, 0, 0, null, null, null, hi);
    part(torso, cyl(.215, .215, .07, 18), m.trim, 0, .985, 0, 0, 0, 0, null, null, null, hi);            // ceinture
    part(torso, rb(.11, .07, .05, .015), m.glow, 0, .985, -.215);                                     // boucle lumineuse
    part(torso, rb(.18, .04, .03, .01), m.glow, 0, 1.43, -.17);                                       // bande du plastron
    part(torso, cyl(.12, .14, .1, 14), m.suit, 0, 1.56, 0);                                            // col
    part(torso, rb(.26, .06, .12, .025), m.trim, 0, 1.52, -.03, 0, 0, 0, null, null, null, hi);
    if (hi) {
      [-1, 1].forEach(function (sd) {
        part(torso, rb(.13, .2, .05, .02), m.armor2, sd * .18, 1.3, -.15, 0, 0, sd * .12);                // flancs
        part(torso, rb(.05, .03, .02, .008), m.glow, sd * .15, 1.24, -.205);
        part(torso, rb(.12, .11, .09, .02), m.trim, sd * .19, 1.0, -.13, 0, 0, 0);                         // poches de ceinture
      });
      part(torso, rb(.2, .26, .11, .03), m.armor2, 0, 1.3, .24, 0, 0, 0, null, null, null, hi);          // module dorsal
      part(torso, rb(.12, .04, .02, .008), m.glow, 0, 1.36, .305);
    }
    // --- casque
    if (s.bubble) {
      part(head, sph(.215, 22, 16), m.suit, 0, .03, .01, 0, 0, 0, 1, 1.02, 1);
      part(head, sph(.27, 24, 18), m.visor, 0, .04, -.01);
      part(head, geo('ring', function () { return new T.TorusGeometry(.2, .03, 8, 22); }), m.armor, 0, -.17, 0, Math.PI / 2);
      part(head, rb(.1, .05, .06, .02), m.glow, 0, .24, .05);
    } else {
      part(head, sph(.215, 24, 18), m.armor, 0, .045, .01, 0, 0, 0, 1.08, 1.1, 1.12, hi);
      part(head, geo('visor', function () { return new T.SphereGeometry(.222, 22, 10, -Math.PI * .37, Math.PI * .74, Math.PI * .42, Math.PI * .2); }), m.visor, 0, .045, .005, 0, Math.PI, 0, 1.06, 1.06, 1.1);
      part(head, rb(.27, .022, .03, .008), m.glow, 0, .045, -.226, 0, 0, 0);                           // fente lumineuse
      part(head, rb(.07, .16, .2, .03), m.armor2, -.22, .0, .0, 0, 0, 0, null, null, null, hi);          // oreillettes
      part(head, rb(.07, .16, .2, .03), m.armor2, .22, .0, .0, 0, 0, 0, null, null, null, hi);
      part(head, rb(.05, .07, .3, .02), m.trim, 0, .26, .02, 0, 0, 0, null, null, null, hi);             // crête
      part(head, rb(.2, .09, .1, .03), m.armor2, 0, -.135, -.12, .35, 0, 0, null, null, null, hi);       // mentonnière
      if (hi) { part(head, cyl(.012, .012, .2, 6), m.trim, -.2, .2, .08, -.4, 0, .2); part(head, sph(.02, 8, 6), m.glow, -.235, .29, .12); }
    }
    // --- bras et jambes
    for (var i = 0; i < 2; i++) {
      var sd = i ? 1 : -1, sh = u.limbs[i * 2 + 1], hip = u.limbs[i * 2], kn = u.knees[i], el = u.elbows[i];
      part(sh, sph(.15, 18, 12), m.armor, sd * .025, -.02, 0, 0, 0, sd * .25, 1.12, .78, 1.08, hi);
      part(sh, rb(.06, .16, .2, .02), m.armor2, sd * .13, -.06, 0, 0, 0, sd * .2);
      part(sh, rb(.05, .02, .14, .008), m.glow, sd * .165, -.05, 0, 0, 0, sd * .2);
      part(sh, cyl(.072, .066, .3, 12), m.suit, 0, -.18, 0, 0, 0, 0, null, null, null, hi);
      part(sh, rb(.13, .16, .13, .035), m.armor2, 0, -.2, -.01, 0, 0, 0, null, null, null, hi);
      part(el, cyl(.07, .062, .26, 12), m.suit, 0, -.12, 0);
      part(el, rb(.14, .19, .14, .04), m.armor, 0, -.12, -.005, 0, 0, 0, null, null, null, hi);
      part(el, rb(.1, .02, .02, .006), m.glow, 0, -.09, -.077);
      part(el, rb(.1, .1, .085, .03), m.suit, 0, -.29, -.015, 0, 0, 0, null, null, null, hi);
      part(el, rb(.105, .045, .09, .015), m.armor2, 0, -.255, -.02);
      part(hip, cyl(.11, .095, .44, 14), m.suit, 0, -.2, 0, 0, 0, 0, null, null, null, hi);
      part(hip, rb(.2, .26, .1, .035), m.armor, 0, -.17, -.075, -.05, 0, 0, null, null, null, hi);
      part(hip, rb(.12, .2, .16, .03), m.armor2, sd * .09, -.12, 0, 0, 0, sd * .08);
      part(kn, sph(.095, 14, 10), m.armor, 0, -.01, -.06, 0, 0, 0, 1.05, 1, .75, hi);
      part(kn, cyl(.085, .075, .38, 12), m.suit, 0, -.2, 0);
      part(kn, rb(.16, .26, .1, .035), m.armor, 0, -.2, -.07, .05, 0, 0, null, null, null, hi);
      part(kn, rb(.06, .02, .02, .006), m.glow, 0, -.15, -.125);
      part(kn, rb(.2, .14, .3, .04), m.armor2, 0, -.44, -.07, 0, 0, 0, null, null, null, hi);
      part(kn, rb(.21, .04, .32, .015), m.suit, 0, -.515, -.07);
    }
    u.v81skin = id;
    return avatar;
  }

  var base = A.avatar;
  A.avatar = function (eq, detail) {
    var g = base.apply(this, arguments);
    try { var id = eq && eq.character; if (id && SKINS[id]) dress(g, id, detail || (eq && eq.detail)); } catch (e) { console.error('[AZUR skins81]', e); }
    return g;
  };
  if (root.AZView) root.AZView.avatar = A.avatar;
  root.AZSkins81 = { SKINS: SKINS, dress: dress };
})(window);
