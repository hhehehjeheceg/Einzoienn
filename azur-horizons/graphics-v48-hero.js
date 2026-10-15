/* AZUR v48 — personnage.
   Les avatars partageaient la matière mate du décor : ils se fondaient dans
   la carte. Ils reçoivent maintenant une matière « héros » unique (satinée,
   jamais noire dans l'ombre, liseré de lumière sur la silhouette) — un seul
   programme GPU partagé, donc aucun appel de dessin en plus.
   Chargé après graphics-v200-art.js. */
(function (root) {
  'use strict';
  var T = root.THREE, A = root.AZArt;
  if (!T || !A || typeof A.avatar !== 'function' || A._v48Hero) return;
  A._v48Hero = true;

  var shared = A.material;
  var rimColor = new T.Color(0xdff5ff);
  var hero = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.05 });
  hero.name = 'v48-hero';
  hero.onBeforeCompile = function (s) {
    s.uniforms.uRimColor = { value: rimColor };
    s.fragmentShader = 'uniform vec3 uRimColor;\n' + s.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n' +
      '{\n' +
      '  float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n' +
      '  float rim = smoothstep(0.42, 0.95, 1.0 - facing);\n' +
      '  float top = 0.65 + 0.35 * clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);\n' +
      '  totalEmissiveRadiance += (uRimColor * 0.42 + diffuseColor.rgb * 0.5) * rim * top * 0.62;\n' +
      '  totalEmissiveRadiance += diffuseColor.rgb * 0.055;\n' +
      '}');
  };
  hero.customProgramCacheKey = function () { return 'v48-hero'; };

  function isShared(m) {
    if (!m || !m.isMeshStandardMaterial || !m.vertexColors || m.transparent) return false;
    return shared ? m === shared : m.metalness < 0.2;
  }
  function apply(group) {
    if (!group || !group.traverse) return group;
    group.traverse(function (o) {
      if (o.isMesh && isShared(o.material)) { o.material = hero; o.userData.shared = true; }
    });
    return group;
  }

  /* Chargé tôt (avant le démarrage asynchrone du client) : les couches
     suivantes réassignent AZArt.avatar / AZArt.weapon ; l'accesseur garde
     la dernière version et l'enveloppe toujours. */
  function wrapProperty(key) {
    /* Une couche qui capture l'ancienne fonction puis la réassigne rappellera
       « wrapped » : chaque niveau d'appel descend d'un cran dans la chaîne. */
    var chain = [A[key]], level = 0;
    function wrapped() {
      var fn = chain[Math.max(0, chain.length - 1 - level)], out;
      level++;
      try { out = fn.apply(this, arguments); } finally { level--; }
      return level === 0 ? apply(out) : out;
    }
    Object.defineProperty(A, key, {
      configurable: true, enumerable: true,
      get: function () { return wrapped; },
      set: function (fn) { if (typeof fn === 'function' && fn !== wrapped) chain.push(fn); }
    });
  }
  wrapProperty('avatar');
  if (typeof A.weapon === 'function') wrapProperty('weapon');
  A.heroMaterial = hero;
})(typeof window !== 'undefined' ? window : globalThis);
