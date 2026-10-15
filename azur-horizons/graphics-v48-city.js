/* AZUR v48 — façades de la ville vue de loin.
   Les immeubles lointains (une seule instance de boîte pour ~600 bâtiments)
   étiraient une texture grise sur toute leur hauteur et la plaquaient aussi
   sur les toits. Le shader ci-dessous découpe chaque face en vrais étages
   de 4 m et en travées de ~3,6 m : fenêtres à reflets, quelques fenêtres
   allumées qui brillent la nuit, boutiques à auvents rayés au rez-de-chaussée,
   et un vrai toit avec acrotère. Toujours un seul appel de dessin.
   Chargé avant le démarrage de la vue (view.js lit root.AZCityFacade). */
(function (root) {
  'use strict';
  var T = root.THREE;
  if (!T || root.AZCityFacade) return;

  var atlas = null;
  function noise(ctx, x, y, w, h, n, dark) {
    for (var i = 0; i < n; i++) {
      var a = 0.025 + Math.random() * 0.05;
      ctx.fillStyle = dark ? 'rgba(60,50,40,' + a + ')' : 'rgba(255,255,255,' + a + ')';
      ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  }
  /* Atlas 256×256 — gauche : travée d'étage ; droite : boutique du rez-de-chaussée ;
     bas : gravier du toit. Bleu pur = vitre, rouge pur = toile d'auvent : le shader
     remplace ces marqueurs par des couleurs propres à chaque bâtiment. */
  function getAtlas() {
    if (atlas) return atlas;
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 128, 192);
    noise(x, 0, 0, 128, 192, 260, true); noise(x, 0, 0, 128, 192, 160, false);
    x.fillStyle = '#d8d1c3'; x.fillRect(26, 32, 76, 8);
    x.fillStyle = '#ffffff'; x.fillRect(30, 40, 68, 110);
    x.fillStyle = '#0000ff'; x.fillRect(36, 46, 56, 98);
    x.fillStyle = '#ffffff'; x.fillRect(62, 46, 4, 98); x.fillRect(36, 80, 56, 4);
    x.fillStyle = '#e1dacd'; x.fillRect(24, 150, 80, 8);
    x.fillStyle = '#b8b0a2'; x.fillRect(26, 158, 76, 4);
    x.fillStyle = '#ffffff'; x.fillRect(0, 176, 128, 3);
    x.fillStyle = '#cbc3b5'; x.fillRect(0, 179, 128, 13);

    x.fillStyle = '#e9e4da'; x.fillRect(128, 0, 128, 192);
    noise(x, 128, 0, 128, 192, 220, true);
    for (var s = 0; s < 7; s++) { x.fillStyle = s % 2 ? '#ffffff' : '#ff0000'; x.fillRect(136 + s * 16, 22, 16, 36); }
    x.fillStyle = '#ff0000'; for (var k = 0; k < 7; k++) { x.beginPath(); x.arc(144 + k * 16, 58, 8, 0, Math.PI); x.fill(); }
    x.fillStyle = '#a39b8e'; x.fillRect(136, 66, 112, 6);
    x.fillStyle = '#34444f'; x.fillRect(140, 72, 104, 106);
    x.fillStyle = '#0000ff'; x.fillRect(146, 78, 56, 94); x.fillRect(208, 78, 30, 94);
    x.fillStyle = '#9e978b'; x.fillRect(128, 178, 128, 14);

    x.fillStyle = '#b4bdbb'; x.fillRect(0, 192, 256, 64);
    for (var g = 0; g < 900; g++) {
      var v = 140 + Math.random() * 70 | 0;
      x.fillStyle = 'rgba(' + v + ',' + (v + 6) + ',' + (v + 4) + ',0.5)';
      x.fillRect(Math.random() * 256, 192 + Math.random() * 64, 2, 2);
    }
    atlas = new T.CanvasTexture(c);
    atlas.colorSpace = T.SRGBColorSpace;
    atlas.anisotropy = 4;
    return atlas;
  }

  var VERT_HEAD = 'varying vec2 vFacadeUv;\nvarying vec2 vCapUv;\nvarying vec2 vCapSize;\nvarying vec4 vFacadeInfo;\n';
  var VERT_BODY = [
    '#ifdef USE_INSTANCING',
    '  mat4 fM = instanceMatrix;',
    '#else',
    '  mat4 fM = mat4(1.0);',
    '#endif',
    '  vec3 fScale = vec3(length(fM[0].xyz), length(fM[1].xyz), length(fM[2].xyz));',
    '  float fCap = step(0.5, abs(normal.y));',
    '  float fFaceW = abs(normal.x) > 0.5 ? fScale.z : fScale.x;',
    '  float fFloors = max(1.0, floor(fScale.y / 4.0 + 0.5));',
    '  float fBays = max(1.0, floor(fFaceW / 3.6 + 0.5));',
    '  vFacadeUv = vec2(uv.x * fBays, uv.y * fFloors);',
    '  vCapUv = uv;',
    '  vCapSize = vec2(fScale.x, fScale.z);',
    '  float fSeed = fract(sin(dot(fM[3].xz, vec2(12.9898, 78.233))) * 43758.5453);',
    '  vFacadeInfo = vec4(fCap, fFloors, fSeed, dot(normal, vec3(1.0, 2.0, 3.0)));'
  ].join('\n');

  var FRAG_HEAD = 'varying vec2 vFacadeUv;\nvarying vec2 vCapUv;\nvarying vec2 vCapSize;\nvarying vec4 vFacadeInfo;\n' +
    'float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n';
  var FRAG_MAP = [
    'vec3 fCol;',
    'float fGlow = 0.0;',
    'float fSeed = vFacadeInfo.z;',
    'if (vFacadeInfo.x > 0.5) {',
    '  vec2 cu = vCapUv * vCapSize / 6.0;',
    '  vec2 ra = vec2(fract(cu.x), fract(cu.y) * 0.24 + 0.005);',
    '  vec4 rt = textureGrad(map, ra, dFdx(cu) * vec2(1.0, 0.24), dFdy(cu) * vec2(1.0, 0.24));',
    '  float edgeM = min(min(vCapUv.x, 1.0 - vCapUv.x) * vCapSize.x, min(vCapUv.y, 1.0 - vCapUv.y) * vCapSize.y);',
    '  float parapet = 1.0 - smoothstep(0.32, 0.5, edgeM);',
    '  vec2 cc = abs(vCapUv - vec2(0.5 + (fSeed - 0.5) * 0.3, 0.5)) * vCapSize;',
    '  float unit = (1.0 - step(1.1, max(cc.x, cc.y))) * step(0.25, fSeed);',
    '  vec3 roof = rt.rgb * mix(vec3(0.42, 0.55, 0.56), vec3(0.62, 0.50, 0.42), step(0.7, fSeed));',
    '  fCol = mix(roof, vec3(0.55, 0.60, 0.62), unit * 0.85);',
    '  fCol = mix(fCol, vec3(0.86, 0.84, 0.79), parapet);',
    '} else {',
    '  vec2 fu = vFacadeUv;',
    '  vec2 tl = fract(fu);',
    '  float ground = step(fu.y, 1.0) * step(1.5, vFacadeInfo.y);',
    '  vec2 au = vec2((tl.x + ground) * 0.5, 0.25 + tl.y * 0.75);',
    '  vec4 tx = textureGrad(map, au, dFdx(fu) * vec2(0.5, 0.75), dFdy(fu) * vec2(0.5, 0.75));',
    '  float glass = smoothstep(0.3, 0.7, tx.b - tx.r);',
    '  float cloth = smoothstep(0.3, 0.7, tx.r - tx.b) * smoothstep(0.3, 0.7, tx.r - tx.g);',
    '  float pick = floor(fSeed * 5.0);',
    '  vec3 paint = pick < 1.0 ? vec3(0.96, 0.86, 0.68) : pick < 2.0 ? vec3(0.94, 0.66, 0.52) : pick < 3.0 ? vec3(0.64, 0.80, 0.86) : pick < 4.0 ? vec3(0.76, 0.84, 0.64) : vec3(0.95, 0.78, 0.60);',
    '  float apick = floor(fract(fSeed * 7.13) * 4.0);',
    '  vec3 awning = apick < 1.0 ? vec3(0.72, 0.13, 0.09) : apick < 2.0 ? vec3(0.03, 0.32, 0.31) : apick < 3.0 ? vec3(0.90, 0.50, 0.08) : vec3(0.06, 0.18, 0.50);',
    '  float wh = fHash(floor(fu) + vec2(fSeed * 91.7, vFacadeInfo.w * 13.1));',
    '  vec3 glassDay = mix(vec3(0.03, 0.08, 0.13), vec3(0.36, 0.56, 0.70), smoothstep(0.25, 0.95, tl.y + 0.12 * sin(tl.x * 4.0 + wh * 6.0)));',
    '  float streak = 1.0 - smoothstep(0.0, 0.06, abs(fract(tl.x * 1.4 - tl.y * 0.9 + wh) - 0.5) - 0.36);',
    '  glassDay += vec3(0.10, 0.13, 0.15) * streak;',
    '  float lit = step(0.84, wh) * (1.0 - ground) + ground * step(0.45, wh) * 0.6;',
    '  vec3 warm = vec3(1.0, 0.62, 0.22) * (0.75 + 0.25 * fract(wh * 17.0));',
    '  vec3 glassCol = mix(glassDay, warm, lit * 0.85);',
    '  fCol = tx.rgb * mix(vec3(1.0), paint, 0.8);',
    '  fCol = mix(fCol, glassCol, glass);',
    '  fCol = mix(fCol, awning, cloth);',
    '  fGlow = glass * lit;',
    '}',
    'diffuseColor.rgb *= fCol;'
  ].join('\n');

  function material() {
    var m = new T.MeshStandardMaterial({ color: '#ffffff', map: getAtlas(), roughness: 0.84, metalness: 0.02 });
    m.name = 'v48-facade';
    m.onBeforeCompile = function (s) {
      s.vertexShader = VERT_HEAD + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
      s.fragmentShader = FRAG_HEAD + s.fragmentShader
        .replace('#include <map_fragment>', FRAG_MAP)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.66, 0.30) * fGlow * 0.7;');
    };
    m.customProgramCacheKey = function () { return 'v48-facade'; };
    return m;
  }

  /* Correctif : une dizaine de maillages instanciés (arbres, buissons, rochers)
     activent vertexColors sans attribut « color ». WebGL lit alors (0,0,0) pour
     l'attribut absent : les feuillages sortaient NOIRS. On leur ajoute une
     couleur blanche neutre — la teinte reste celle de la matière × instance. */
  var checked = new WeakSet();
  function ensureVertexColor(geometry, material) {
    if (!geometry || checked.has(geometry)) return;
    var mats = Array.isArray(material) ? material : [material];
    var needs = mats.some(function (m) { return m && m.vertexColors; });
    // Le passage d'ombre arrive en premier avec une matière de profondeur (sans
    // vertexColors) : on n'enregistre la géométrie qu'une fois vue avec sa vraie
    // matière, sinon elle restait noire dès que les ombres étaient actives.
    if (!needs) return;
    checked.add(geometry);
    var attrs = geometry.attributes;
    if (!attrs || attrs.color || !attrs.position) return false;
    var white = new Float32Array(attrs.position.count * 3); white.fill(1);
    geometry.setAttribute('color', new T.BufferAttribute(white, 3));
    return true;
  }
  /* v71 : l'attribut ajouté pendant le rendu n'avait pas encore de tampon GPU ;
     le VAO mémorisé l'ignorait pour toujours (objets noirs). On le pose donc dès
     l'ajout à la scène, et si un objet passe quand même entre les mailles, sa
     géométrie est libérée pour être reconstruite proprement à l'image suivante. */
  var baseAdd = T.Object3D.prototype.add;
  T.Object3D.prototype.add = function () {
    for (var i = 0; i < arguments.length; i++) {
      var o = arguments[i];
      if (o && o.traverse) o.traverse(function (c) { if (c.isMesh && c.geometry && c.material) ensureVertexColor(c.geometry, c.material); });
    }
    return baseAdd.apply(this, arguments);
  };
  var baseBeforeRender = T.Mesh.prototype.onBeforeRender;
  T.Mesh.prototype.onBeforeRender = function (renderer, scene, camera, geometry, material) {
    if (ensureVertexColor(geometry, material) === true) geometry.dispose();
    if (baseBeforeRender) baseBeforeRender.apply(this, arguments);
  };

  root.AZCityFacade = { material: material, atlas: getAtlas };
})(typeof window !== 'undefined' ? window : globalThis);
