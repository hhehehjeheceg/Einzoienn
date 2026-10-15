/* event-particles.js — MODULE "THE END" v5 : PARTICULES PARTAGÉES.
 * Pass v5 : toolkit de particules partagé, pools poolés (un seul draw call
 * par pool, < 500 particules par système), matériaux additifs (+ un pool
 * fumée en blending normal pour une vraie fumée blanche volumineuse).
 * Niveaux de qualité : api.quality ('low'/'medium'/'high') et api.isMobile
 * réduisent le nombre de particules (mobile = ~45 %).
 * Publie AZEvent.fx après init (signatures compatibles avec les appelants
 * existants — event-shockwave.js, event-impact.js, event-meteor.js,
 * event-zeropoint.js) :
 *   burst(p| x,y,z, opts) — explosion sphérique (accepte Vector3 OU x,y,z)
 *   trail(p, color|opts)  — traînée
 *   embers(p, opts)       — braises lentes qui montent
 *   ring(p, opts)         — anneau en expansion
 *   vortex(p, opts)       — spirale aspirante
 *   sparkle(p, opts)      — étincelles scintillantes, courtes et brillantes
 *   implosion(p, opts)    — particules qui convergent vers un point
 *   smoke(p, opts)        — NOUVEAU : fumée blanche volumineuse (décollage),
 *                           grossit en montant, blending normal
 *   fire(p, opts)         — NOUVEAU : feu orange (jaune→orange→rouge)
 *   beam(p, opts)         — v22 : colonne d'énergie verticale (naissance du
 *                           trou noir, impact de la météorite)
 *   distort(p, opts)      — v22 : lentille de distorsion (étincelles à forte
 *                           turbulence + double anneau de choc)
 *   clear()               — vide tous les pools
 * Les appels avant init sont mis en file (40 max) puis rejoués.
 * Pilotage : AZEvent.state / tState / tTotal — aucun temps absolu en dur.
 * v15 (passe animation maximale) : comportements plus riches — TURBULENCE
 * (dérive sinusoïdale), TRAÎNÉES (échos derrière les particules),
 * variation de TAILLE (pulsation) et de COULEUR dans le temps
 * (refroidissement vers une couleur de fin), RAFALES synchronisées sur les
 * temps forts (bus 'shockwave', 'meteor:hit', 'rocket:impact', 'suction:beat'
 * écoutés — aucun son émis). Comptes augmentés ; mobile = 45 % (soit /2.2),
 * réduction mobile conservée. Fondu doux du champ d'étoiles conservé.
 * v22 (passe « frissons ») : 2 NOUVEAUX FX partagés réutilisables — beam
 * (colonne d'énergie verticale : naissance du trou noir, impact) et distort
 * (lentille de distorsion : étincelles à forte turbulence + double anneau) ;
 * ashfall ENRICHIE (opts.ember : cendres encore incandescentes, opts.wind :
 * dérive horizontale) ; shockring ENRICHI (opts.double : second anneau plus
 * petit et plus rapide). Câblés en interne sur les bus existants
 * (meteor:hit, blackhole:formed, shockwave >= 0.7) — aucun autre module à
 * toucher. Densités mobiles conservées (QUALITY_COUNT partout).
 * Contrat : root.AZEvent.register('particles', {init, update, dispose}).
 */
(function (root) {
'use strict';

if (!root.AZEvent) return;

// ---------------------------------------------------------------------------
// État interne du module
// ---------------------------------------------------------------------------
var api = null;            // objet api fourni par init()
var ready = false;         // true quand les pools + la scène existent
var disposed = false;      // passé à true par dispose()
var listenersBound = false; // 'rocket:rift-enter' branché une seule fois (pas de off())
// v17 : PLUIE DE BRAISES — après l'impact (contraction/collapse), les
// débris incandescents de l'explosion à l'échelle de l'île retombent sur
// l'île en nappes irrégulières (cause : la retombée de l'explosion).
var rainAcc = 0;   // accumulateur de cadence
var rainOn = false; // pluie active ?
var T = null;              // alias THREE

var QUALITY_COUNT = 1;     // facteur de densité selon api.quality / api.isMobile

// ---------------------------------------------------------------------------
// Pool de particules (THREE.Points, 1 draw call par pool)
// ---------------------------------------------------------------------------
var pools = []; // [{mesh, geo, cap, cursor, pos, vel, col, size0, life, maxLife, grav, grow, alpha0, ...}]

// Indices des pools : 0 étincelles, 1 traînées/braises, 2 effets (ring,
// vortex, implosion), 3 débris, 4 fumée (blending normal).
var POOL_SPARKS = 0;
var POOL_TRAIL  = 1;
var POOL_FX     = 2;
var POOL_DEBRIS = 3;
var POOL_SMOKE  = 4;
var POOL_CAP = 450; // < 500 particules par système (consigne)

var VERT_SHADER = [
  'attribute vec3 aColor;',
  'attribute float aSize;',
  'attribute float aAlpha;',
  'varying vec3 vColor;',
  'varying float vAlpha;',
  'void main() {',
  '  vColor = aColor;',
  '  vAlpha = aAlpha;',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  gl_PointSize = min(aSize * (320.0 / max(1.0, -mv.z)), 200.0);', /* v77 : plus de particule géante qui blanchit l\'écran */
  '  vAlpha *= smoothstep(3.0, 30.0, -mv.z);',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');

var FRAG_SHADER = [
  'varying vec3 vColor;',
  'varying float vAlpha;',
  'void main() {',
  '  vec2 uv = gl_PointCoord - vec2(0.5);',
  '  float d = length(uv);',
  '  if (d > 0.5) discard;',
  '  float a = smoothstep(0.5, 0.08, d) * vAlpha;',
  '  gl_FragColor = vec4(vColor, a);',
  '}'
].join('\n');

// Crée un pool de `cap` particules et l'ajoute à la scène.
// additive=false -> blending normal (fumée), sinon additif.
function createPool(cap, additive) {
  var geo = new T.BufferGeometry();
  var pos = new Float32Array(cap * 3);
  var col = new Float32Array(cap * 3);
  var size = new Float32Array(cap);
  var alpha = new Float32Array(cap);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('aColor', new T.BufferAttribute(col, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('aSize', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new T.BufferAttribute(alpha, 1).setUsage(T.DynamicDrawUsage));

  var mat = new T.ShaderMaterial({
    vertexShader: VERT_SHADER,
    fragmentShader: FRAG_SHADER,
    transparent: true,
    depthWrite: false,
    blending: (additive === false) ? T.NormalBlending : T.AdditiveBlending
  });

  var mesh = new T.Points(geo, mat);
  mesh.frustumCulled = false; // les particules bougent partout : pas de culling
  mesh.visible = true;
  api.scene().add(mesh);

  var pool = {
    mesh: mesh, geo: geo, cap: cap, cursor: 0,
    pos: pos, vel: new Float32Array(cap * 3),
    col: col, size0: new Float32Array(cap),
    life: new Float32Array(cap), maxLife: new Float32Array(cap),
    grav: new Float32Array(cap),
    grow: new Float32Array(cap),     // croissance de la taille (unités/s)
    drag: new Float32Array(cap),     // v12 : frottement (vitesse qui s'éteint)
    flick: new Float32Array(cap),    // v12 : scintillement (étincelles)
    alpha0: new Float32Array(cap),   // alpha de départ (fade vers 0)
    turb: new Float32Array(cap),     // v15 : amplitude de turbulence
    colA: new Float32Array(cap * 3), // v15 : couleur de départ (mélange temporel)
    colB: new Float32Array(cap * 3), // v15 : couleur de fin (mélange temporel)
    useColB: new Uint8Array(cap),    // v15 : 1 si couleur de fin active
    pulse: new Float32Array(cap),    // v15 : amplitude de pulsation de taille
    pulseF: new Float32Array(cap),   // v15 : fréquence de pulsation
    aSize: size, aAlpha: alpha,
    aPos: geo.getAttribute('position'), aCol: geo.getAttribute('aColor'),
    aSizeAttr: geo.getAttribute('aSize'), aAlphaAttr: geo.getAttribute('aAlpha')
  };
  pools.push(pool);
  return pool;
}

// Convertit une couleur (hex number, string '#rrggbb' ou [r,g,b]) en [r,g,b] 0..1.
function toRGB(c) {
  if (typeof c === 'number') {
    return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }
  if (typeof c === 'string' && c.charAt(0) === '#') {
    var n = parseInt(c.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  if (c && typeof c.length === 'number' && c.length >= 3) return [c[0], c[1], c[2]];
  return [1, 1, 1];
}

// Émet une particule dans le pool (ring buffer : écrase les plus anciennes).
// grow : croissance de taille en unités/s (fumée volumineuse) ; alpha0 :
// alpha de départ (le fade va vers 0 en fin de vie) ; drag : frottement qui
// éteint la vitesse (explosions franches) ; flicker : scintillement 0/1 ;
// turbAmp : amplitude de turbulence (dérive sinusoïdale) ; endRgb : couleur
// de fin (la couleur dérive vers elle avec l'âge) ; pulseAmp/pulseFreq :
// pulsation de taille. (v15 : paramètres optionnels en fin de signature.)
function emit(pool, x, y, z, vx, vy, vz, rgb, size, life, grav, grow, alpha0, drag, flicker,
              turbAmp, endRgb, pulseAmp, pulseFreq) {
  var i = pool.cursor;
  pool.cursor = (pool.cursor + 1) % pool.cap;
  var i3 = i * 3;
  pool.pos[i3] = x; pool.pos[i3 + 1] = y; pool.pos[i3 + 2] = z;
  pool.vel[i3] = vx; pool.vel[i3 + 1] = vy; pool.vel[i3 + 2] = vz;
  // légère variation de teinte pour un rendu moins uniforme
  var v = 0.85 + Math.random() * 0.3;
  pool.col[i3] = Math.min(1, rgb[0] * v);
  pool.col[i3 + 1] = Math.min(1, rgb[1] * v);
  pool.col[i3 + 2] = Math.min(1, rgb[2] * v);
  pool.colA[i3] = pool.col[i3];       // v15 : couleur de départ mémorisée
  pool.colA[i3 + 1] = pool.col[i3 + 1];
  pool.colA[i3 + 2] = pool.col[i3 + 2];
  if (endRgb) {                        // v15 : couleur de fin
    pool.colB[i3] = Math.min(1, endRgb[0]);
    pool.colB[i3 + 1] = Math.min(1, endRgb[1]);
    pool.colB[i3 + 2] = Math.min(1, endRgb[2]);
    pool.useColB[i] = 1;
  } else {
    pool.useColB[i] = 0;
  }
  pool.turb[i] = turbAmp || 0;         // v15
  pool.pulse[i] = pulseAmp || 0;       // v15
  pool.pulseF[i] = pulseFreq || 0;     // v15
  pool.size0[i] = size;
  pool.aSize[i] = size;
  pool.life[i] = life;
  pool.maxLife[i] = life;
  pool.grav[i] = grav;
  pool.grow[i] = grow || 0;
  pool.drag[i] = drag || 0;
  pool.flick[i] = flicker ? 1 : 0;
  pool.alpha0[i] = (alpha0 === undefined) ? 1 : alpha0;
  pool.aAlpha[i] = pool.alpha0[i];
}

// Met à jour un pool (physique simple : gravité + croissance + fade alpha).
function updatePool(pool, dt) {
  var i, i3, cap = pool.cap;
  for (i = 0; i < cap; i++) {
    if (pool.life[i] <= 0) continue;
    pool.life[i] -= dt;
    i3 = i * 3;
    if (pool.life[i] <= 0) {
      pool.aAlpha[i] = 0;
      pool.pos[i3 + 1] = -10000; // hors vue, évite un point fantôme
      continue;
    }
    pool.vel[i3 + 1] -= pool.grav[i] * dt;
    // v12 : frottement — la vitesse s'éteint vite (claquement initial franc,
    // puis la particule se pose au lieu de dériver mollement).
    var dr = pool.drag[i];
    if (dr > 0) {
      var dk = Math.max(0, 1 - dr * dt);
      pool.vel[i3] *= dk; pool.vel[i3 + 1] *= dk; pool.vel[i3 + 2] *= dk;
    }
    // v15 : TURBULENCE — dérive sinusoïdale qui rend le champ vivant.
    var age = pool.maxLife[i] - pool.life[i];
    var tb = pool.turb[i];
    if (tb > 0) {
      var ta = age * 3.1 + i * 2.39;
      pool.vel[i3] += Math.sin(ta) * tb * dt;
      pool.vel[i3 + 1] += Math.cos(ta * 0.83) * tb * 0.6 * dt;
      pool.vel[i3 + 2] += Math.sin(ta * 1.13 + 1.7) * tb * dt;
    }
    pool.pos[i3] += pool.vel[i3] * dt;
    pool.pos[i3 + 1] += pool.vel[i3 + 1] * dt;
    pool.pos[i3 + 2] += pool.vel[i3 + 2] * dt;
    // la taille grandit avec l'âge (fumée volumineuse).
    // v15 : + PULSATION de taille (le champ "respire").
    var pa = pool.pulse[i];
    pool.aSize[i] = pool.size0[i] + pool.grow[i] * age +
      (pa > 0 ? pa * Math.sin(age * pool.pulseF[i] + i * 1.3) : 0);
    // v15 : la COULEUR dérive vers la couleur de fin avec l'âge
    // (refroidissement : blanc chaud -> braise sombre, etc.).
    if (pool.useColB[i]) {
      var ck = age / pool.maxLife[i];
      ck = ck * ck * (3 - 2 * ck);
      pool.col[i3] = pool.colA[i3] + (pool.colB[i3] - pool.colA[i3]) * ck;
      pool.col[i3 + 1] = pool.colA[i3 + 1] + (pool.colB[i3 + 1] - pool.colA[i3 + 1]) * ck;
      pool.col[i3 + 2] = pool.colA[i3 + 2] + (pool.colB[i3 + 2] - pool.colA[i3 + 2]) * ck;
    }
    // v12 : l'alpha reste vive longtemps puis chute vite (plus de punch
    // qu'un fondu linéaire mou).
    var lf = pool.life[i] / pool.maxLife[i];
    var a = pool.alpha0[i] * Math.pow(lf, 0.7);
    // v12 : scintillement des étincelles (vie courte, très brillantes).
    if (pool.flick[i] > 0) a *= 0.45 + 0.55 * Math.abs(Math.sin(age * 36 + i * 1.7));
    pool.aAlpha[i] = a;
  }
  pool.aPos.needsUpdate = true;
  pool.aCol.needsUpdate = true;
  pool.aSizeAttr.needsUpdate = true;
  pool.aAlphaAttr.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// API publique AZEvent.fx
// ---------------------------------------------------------------------------

// Explosion sphérique (biais vers le haut).
// Signatures : burst({x,y,z}, opts) OU burst(x, y, z, opts)
// (event-shockwave.js appelle en x,y,z séparés).
function realBurst(a, b, c, d) {
  if (!ready) return;
  var p, o;
  if (typeof a === 'number') { p = { x: a, y: b, z: c }; o = d; }
  else { p = a; o = b; }
  if (!p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 28) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0xffffff);
  var speed = o.speed !== undefined ? o.speed : 60;
  var life = o.life !== undefined ? o.life : 1.2;
  var size = o.size !== undefined ? o.size : 6;
  var gravity = o.gravity !== undefined ? o.gravity : 40;
  // v12 : frottement fort par défaut — l'explosion claque puis se pose.
  var drag = o.drag !== undefined ? o.drag : 1.7;
  var pool = pools[POOL_SPARKS];
  var i, th, ph, sp;
  // v15 : refroidissement — la couleur dérive vers une braise sombre.
  var cool = [rgb[0] * 0.35, rgb[1] * 0.18, rgb[2] * 0.22];
  for (i = 0; i < count; i++) {
    th = Math.random() * Math.PI * 2;
    ph = Math.acos(2 * Math.random() - 1); // direction aléatoire sur la sphère
    sp = speed * (0.3 + Math.random() * 0.9);
    var vx = Math.cos(th) * Math.sin(ph) * sp;
    var vy = Math.abs(Math.sin(ph) * Math.sin(th)) * sp + speed * 0.25;
    var vz = Math.cos(ph) * sp;
    var sz = size * (0.6 + Math.random() * 0.8);
    var lf = life * (0.5 + Math.random() * 0.8);
    emit(pool, p.x, p.y, p.z, vx, vy, vz,
      rgb, sz, lf, gravity, 0, 1, drag, 0,
      34, cool, sz * 0.25, 8 + Math.random() * 8); // v15 : turbulence + pulsation
    // v15 : TRAÎNÉES — 2 échos derrière chaque particule (vie courte).
    emit(pool, p.x - vx * 0.035, p.y - vy * 0.035, p.z - vz * 0.035,
      vx * 0.85, vy * 0.85, vz * 0.85,
      rgb, sz * 0.7, lf * 0.45, gravity, 0, 0.7, drag, 0, 20, cool, 0, 0);
    emit(pool, p.x - vx * 0.07, p.y - vy * 0.07, p.z - vz * 0.07,
      vx * 0.7, vy * 0.7, vz * 0.7,
      rgb, sz * 0.5, lf * 0.3, gravity, 0, 0.5, drag, 0, 12, cool, 0, 0);
  }
}

// Traînée : quelques particules lentes autour du point (couleur ou options).
function realTrail(p, colorOrOpts) {
  if (!ready || !p) return;
  var o = (colorOrOpts && typeof colorOrOpts === 'object') ? colorOrOpts : {};
  var rgb = toRGB(o.color !== undefined ? o.color :
    (colorOrOpts !== undefined && typeof colorOrOpts !== 'object' ? colorOrOpts : 0xffcc66));
  var pool = pools[POOL_TRAIL];
  var n = Math.max(1, Math.round((o.count || 3) * QUALITY_COUNT)); // v15 : densifié
  var spread = o.spread !== undefined ? o.spread : 4;
  var life = o.life !== undefined ? o.life : 0.5;
  for (var i = 0; i < n; i++) {
    emit(pool,
      p.x + (Math.random() - 0.5) * spread,
      p.y + (Math.random() - 0.5) * spread,
      p.z + (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12,
      rgb, (o.size || 4) + Math.random() * 3,
      life * (0.6 + Math.random() * 0.8),
      o.gravity !== undefined ? o.gravity : 6,
      0, 1, 0, 0, 10, null, (o.size || 4) * 0.2, 6); // v15 : turbulence + pulsation
  }
}

// Braises : particules lentes qui montent (gravité négative), longue vie.
function realEmbers(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 36) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0xff7733);
  var spread = o.spread !== undefined ? o.spread : 60;
  var pool = pools[POOL_TRAIL];
  for (var i = 0; i < count; i++) {
    var esz = (o.size || 5) * (0.6 + Math.random() * 0.8);
    emit(pool,
      p.x + (Math.random() - 0.5) * spread,
      p.y + (Math.random() - 0.5) * spread * 0.4,
      p.z + (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * 8,
      12 + Math.random() * 22, // montée lente
      (Math.random() - 0.5) * 8,
      rgb, esz,
      (o.life || 3) * (0.5 + Math.random() * 0.8),
      -18, // gravité négative : les braises montent
      0, 1, 0, 0, 10, [0.55, 0.08, 0.02], esz * 0.3, 5); // v15 : refroidit en braise sombre
  }
}

// Anneau en expansion : particules sur un cercle, vitesse radiale vers
// l'extérieur. opts.plane : 'xz' (défaut, anneau horizontal) ou 'xy'.
function realRing(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 80) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0x88ccff);
  var radius = o.radius !== undefined ? o.radius : 60;
  var speed = o.speed !== undefined ? o.speed : 140;
  var life = o.life !== undefined ? o.life : 1.4;
  var size = o.size !== undefined ? o.size : 7;
  var plane = o.plane || 'xz';
  var up = o.up !== undefined ? o.up : 0;
  var drag = o.drag !== undefined ? o.drag : 1.3; // v12 : l'anneau claque puis freine
  var pool = pools[POOL_FX];
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var r = radius * (0.9 + Math.random() * 0.2);
    var ca = Math.cos(a), sa = Math.sin(a);
    var px, py, pz, vx, vy, vz;
    if (plane === 'xy') {
      px = p.x + ca * r; py = p.y + sa * r; pz = p.z;
      vx = ca * speed; vy = sa * speed; vz = 0;
    } else { // 'xz' : anneau horizontal
      px = p.x + ca * r; py = p.y; pz = p.z + sa * r;
      vx = ca * speed; vy = up; vz = sa * speed;
    }
    emit(pool, px, py, pz, vx, vy, vz,
      rgb, size * (0.7 + Math.random() * 0.6),
      life * (0.7 + Math.random() * 0.6), 0, 0, 1, drag,
      0, 24, null, size * 0.2, 7); // v15 : turbulence + pulsation
  }
}

// Spirale aspirante : particules en orbite autour du point avec une
// composante de vitesse vers le centre (convergent en spiralant).
function realVortex(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 96) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0x66aaff);
  var radius = o.radius !== undefined ? o.radius : 90;
  var height = o.height !== undefined ? o.height : 70;
  var tang = o.speed !== undefined ? o.speed : 70;   // vitesse tangentielle
  var inward = o.inward !== undefined ? o.inward : 45; // aspiration vers le centre
  var life = o.life !== undefined ? o.life : 2.4;
  var size = o.size !== undefined ? o.size : 6;
  var pool = pools[POOL_FX];
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var r = radius * (0.35 + Math.random() * 0.65);
    var ca = Math.cos(a), sa = Math.sin(a);
    emit(pool,
      p.x + ca * r, p.y + (Math.random() - 0.5) * height, p.z + sa * r,
      -sa * tang - ca * inward,   // tangentiel + vers le centre
      (Math.random() - 0.5) * 12 - (o.down || 0),
      ca * tang - sa * inward,
      rgb, size * (0.6 + Math.random() * 0.8),
      life * (0.6 + Math.random() * 0.8), 0,
      0, 1, 0, 0, 30, null, size * 0.25, 5); // v15 : turbulence + pulsation
  }
}

// Étincelles scintillantes : peu nombreuses, petites, très brillantes,
// vie très courte. v12 : scintillement actif (flicker).
function realSparkle(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 18) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0xcfeaff);
  var spread = o.spread !== undefined ? o.spread : 30;
  var pool = pools[POOL_SPARKS];
  for (var i = 0; i < count; i++) {
    var svx = (Math.random() - 0.5) * 30, svy = (Math.random() - 0.5) * 30, svz = (Math.random() - 0.5) * 30;
    var ssz = (o.size || 4) * (0.7 + Math.random() * 0.6);
    var slf = (o.life || 0.5) * (0.5 + Math.random() * 0.8);
    emit(pool,
      p.x + (Math.random() - 0.5) * spread,
      p.y + (Math.random() - 0.5) * spread,
      p.z + (Math.random() - 0.5) * spread,
      svx, svy, svz,
      rgb, ssz, slf,
      8, 0, 1, 0.6, 1, 26, null, ssz * 0.3, 14); // v15 : turbulence + pulsation
    // v15 : traînée courte derrière l'étincelle.
    emit(pool, p.x - svx * 0.03, p.y - svy * 0.03, p.z - svz * 0.03,
      svx * 0.8, svy * 0.8, svz * 0.8, rgb, ssz * 0.6, slf * 0.4,
      8, 0, 0.6, 0.6, 1, 14, null, 0, 0);
  }
}

// Implosion : particules émises sur une coquille sphérique autour du point,
// avec une vitesse dirigée VERS le point — elles convergent vers le centre
// (pour la phase 'contraction'). La durée de vie est calée pour qu'elles
// meurent en arrivant au centre.
function realImplosion(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 140) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0x99ccff);
  var radius = o.radius !== undefined ? o.radius : 160;
  var speed = o.speed !== undefined ? o.speed : 130;
  var size = o.size !== undefined ? o.size : 7;
  var pool = pools[POOL_FX];
  var travel = radius / Math.max(1, speed); // temps pour atteindre le centre
  for (var i = 0; i < count; i++) {
    // direction aléatoire sur la sphère
    var th = Math.random() * Math.PI * 2;
    var ph = Math.acos(2 * Math.random() - 1);
    var dx = Math.cos(th) * Math.sin(ph);
    var dy = Math.sin(ph) * Math.sin(th);
    var dz = Math.cos(ph);
    emit(pool,
      p.x + dx * radius, p.y + dy * radius, p.z + dz * radius,
      -dx * speed, -dy * speed, -dz * speed, // vers le point
      rgb, size * (0.6 + Math.random() * 0.8),
      travel * (0.9 + Math.random() * 0.25), // meurt au centre
      0, 0, 1, 0, 0, 18, null, size * 0.2, 6); // v15 : turbulence + pulsation
  }
}

// FUMÉE blanche volumineuse (décollage, destruction) : grosses particules
// lentes qui montent en GROSSISSANT, blending normal (vraie fumée, pas un
// halo). opts : count, color (défaut blanc-gris), spread, size (défaut 30),
// life (défaut 4.5 s), rise (vitesse de montée), grow (croissance/s),
// alpha (alpha de départ).
function realSmoke(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 34) * QUALITY_COUNT)); // v15 : densifié
  var rgb = toRGB(o.color !== undefined ? o.color : 0xdde1e8);
  var spread = o.spread !== undefined ? o.spread : 24;
  var size = o.size !== undefined ? o.size : 30;
  var life = o.life !== undefined ? o.life : 4.5;
  var rise = o.rise !== undefined ? o.rise : 16;
  var out = o.out !== undefined ? o.out : 20;
  var grow = o.grow !== undefined ? o.grow : 14;
  var alpha = o.alpha !== undefined ? o.alpha : 0.5;
  var pool = pools[POOL_SMOKE];
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var r = Math.random() * spread;
    var smsz = size * (0.7 + Math.random() * 0.6);
    emit(pool,
      p.x + Math.cos(a) * r,
      p.y + (Math.random() - 0.5) * spread * 0.5,
      p.z + Math.sin(a) * r,
      Math.cos(a) * out * (0.4 + Math.random() * 0.6),
      rise * (0.5 + Math.random() * 0.8),
      Math.sin(a) * out * (0.4 + Math.random() * 0.6),
      rgb, smsz,
      life * (0.6 + Math.random() * 0.8),
      -3,    // légère poussée vers le haut
      grow, alpha,
      0, 0, 8, // drag 0, flicker 0, turbulence 8 (v15 : la fumée dérive)
      [Math.min(1, rgb[0] * 1.15), Math.min(1, rgb[1] * 1.15), Math.min(1, rgb[2] * 1.15)],
      smsz * 0.12, 3); // v15 : s'éclaircit et pulse doucement
  }
}

// FEU orange : flammes vives qui montent vite, teinte jaune→orange→rouge
// tirée au hasard par particule. opts : count, spread, size, life, up.
function realFire(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 30) * QUALITY_COUNT)); // v15 : densifié
  var spread = o.spread !== undefined ? o.spread : 12;
  var size = o.size !== undefined ? o.size : 11;
  var life = o.life !== undefined ? o.life : 0.9;
  var up = o.up !== undefined ? o.up : 45;
  var pool = pools[POOL_SPARKS];
  for (var i = 0; i < count; i++) {
    // dégradé jaune chaud -> orange -> rouge profond
    var fr = Math.random();
    var rgb = (fr < 0.35) ? [1, 0.82, 0.25] : (fr < 0.7) ? [1, 0.48, 0.08] : [1, 0.25, 0.02];
    var fsz = size * (0.6 + Math.random() * 0.8);
    emit(pool,
      p.x + (Math.random() - 0.5) * spread,
      p.y + (Math.random() - 0.5) * spread * 0.6,
      p.z + (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * 14,
      up * (0.6 + Math.random() * 0.8),
      (Math.random() - 0.5) * 14,
      rgb, fsz,
      life * (0.5 + Math.random() * 0.9),
      -12,   // les flammes continuent de monter
      3, 1, 0, 0, 14, [0.45, 0.06, 0.01], fsz * 0.35, 11); // v15 : refroidit en braise
  }
}

function realClear() {
  for (var k = 0; k < pools.length; k++) {
    var pool = pools[k];
    pool.life.fill(0);
    pool.aAlpha.fill(0);
    pool.cursor = 0;
    pool.aPos.needsUpdate = true;
    pool.aAlphaAttr.needsUpdate = true;
  }
  clearHalos(); // v20 : les halos d'anticipation aussi
}

// ---------------------------------------------------------------------------
// v20 — GERBE D'ÉTINCELLES DIRECTIONNELLE (sparkJet) : cône d'étincelles
// brillantes qui scintillent, orienté le long d'une direction. Cause ->
// effet visible et LOCALISÉ : traversées de faille, ouvertures, décollage
// des fusées, temps d'aspiration. Zéro allocation par frame (emit() seul).
// Signatures : sparkJet({x,y,z}, opts) ; opts :
//   count, dir:{x,y,z} (défaut +Y) ou azim/elev (rad), spread (rad,
//   défaut 0.35), speed (m/s, défaut 90), color (défaut 0xbfe0ff),
//   size (défaut 5), life (défaut 0.9 s), gravity (défaut 60), up
//   (dérive verticale ajoutée, défaut 0), trail (bool, défaut false :
//   v21 — un écho plus petit et plus lent suit chaque étincelle).
// ---------------------------------------------------------------------------
function realSparkJet(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 24) * QUALITY_COUNT));
  var spread = (o.spread === undefined) ? 0.35 : o.spread;
  var speed = (o.speed === undefined) ? 90 : o.speed;
  var size = (o.size === undefined) ? 5 : o.size;
  var life = (o.life === undefined) ? 0.9 : o.life;
  var grav = (o.gravity === undefined) ? 60 : o.gravity;
  var up = o.up || 0;
  var trailOn = !!o.trail; // v21 : écho derrière chaque étincelle
  var dx = 0, dy = 1, dz = 0;
  if (o.dir && typeof o.dir.x === 'number') { dx = o.dir.x; dy = o.dir.y; dz = o.dir.z; }
  else if (o.azim !== undefined || o.elev !== undefined) {
    var az = o.azim || 0, el = o.elev || 0;
    dx = Math.cos(el) * Math.cos(az); dy = Math.sin(el); dz = Math.cos(el) * Math.sin(az);
  }
  var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  var rgb = toRGB(o.color === undefined ? 0xbfe0ff : o.color);
  var pool = pools[POOL_SPARKS];
  for (var i = 0; i < count; i++) {
    // direction perturbée dans le cône (spread en radians, approx. gaussien)
    var gx = (Math.random() - 0.5) * 2 * spread;
    var gz = (Math.random() - 0.5) * 2 * spread;
    var vx = dx + gx, vy = dy + (Math.random() - 0.5) * spread, vz = dz + gz;
    var vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    var sp = speed * (0.55 + Math.random() * 0.9);
    emit(pool,
      p.x + (Math.random() - 0.5) * 4, p.y + (Math.random() - 0.5) * 4,
      p.z + (Math.random() - 0.5) * 4,
      (vx / vl) * sp, (vy / vl) * sp + up, (vz / vl) * sp,
      rgb, size * (0.6 + Math.random() * 0.8),
      life * (0.6 + Math.random() * 0.8), grav,
      0, 1, 1.6, 1, null, 0, 0); // v12 : scintillement + léger frottement, v15 : turbulence
    if (trailOn) {
      // v21 : TRAIL — un écho plus petit, plus lent et plus long suit
      // chaque étincelle (la traînée « fume » derrière le jet).
      emit(pool,
        p.x + (Math.random() - 0.5) * 4, p.y + (Math.random() - 0.5) * 4,
        p.z + (Math.random() - 0.5) * 4,
        (vx / vl) * sp * 0.55, (vy / vl) * sp * 0.55 + up, (vz / vl) * sp * 0.55,
        rgb, size * 0.35 * (0.6 + Math.random() * 0.8),
        life * 1.3, grav,
        0, 1, 1.6, 1, null, 0, 0);
    }
  }
}

// ---------------------------------------------------------------------------
// v20 — HALO D'ANTICIPATION (halo) : anneau plat poolé qui « inspire »
// (se resserre et monte en intensité pendant `anticip` s — télégraphe
// lisible : quelque chose arrive ICI) puis CLAQUE (expansion rapide +
// fondu). Utilisé avant chaque gros événement : ouvertures de faille,
// frappes, impacts, temps d'aspiration.
// Signatures : halo({x,y,z}, opts) ; opts : {anticip (s, défaut 1.2),
// dur (s d'expansion, défaut 0.5), radius (m, défaut 120), color
// (défaut 0x9fd0ff), y (décalage vertical, défaut 4),
// double (bool, défaut false : v21 — second anneau plus petit qui
// claque 0,35 s plus tard, pour les gros impacts)}.
// ---------------------------------------------------------------------------
var HALO_MAX = 8;
var haloGroup = null;
var haloGeo = null;
var halos = []; // {mesh, mat, age, anticip, dur, maxR, state} (0=inspire, 1=snap)

function ensureHaloPool() {
  if (haloGroup || disposed || !ready) return;
  var scene = null;
  try { scene = api.scene(); } catch (e) { scene = null; }
  if (!scene || !T) return;
  haloGeo = new T.RingGeometry(0.9, 1.0, 72);
  haloGroup = new T.Group();
  haloGroup.name = 'azevent-halos';
  for (var i = 0; i < HALO_MAX; i++) {
    var mat = new T.MeshBasicMaterial({
      color: 0x9fd0ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var mesh = new T.Mesh(haloGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.frustumCulled = false;
    mesh.visible = false;
    haloGroup.add(mesh);
    halos.push({ mesh: mesh, mat: mat, age: 0, anticip: 1.2, dur: 0.5,
                 maxR: 120, state: 0, busy: false });
  }
  scene.add(haloGroup);
}

function realHalo(p, o) {
  if (!ready || !p || disposed) return;
  o = o || {};
  var h = acquireHalo();
  if (!h) return;
  setupHalo(h, p, o);
  // v21 : 'double' — un SECOND anneau plus petit (radius x 0,65) qui claque
  // 0,35 s plus tard (anticip + 0,35) : le double choc se lit mieux sur
  // les gros impacts.
  if (o.double) {
    var h2 = acquireHalo();
    if (h2) {
      var o2 = {};
      for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) o2[k] = o[k]; }
      o2.radius = ((o.radius !== undefined) ? o.radius : 120) * 0.65;
      o2.anticip = ((o.anticip !== undefined) ? Math.max(0.2, o.anticip) : 1.2) + 0.35;
      setupHalo(h2, p, o2);
    }
  }
}

// v21 : acquiert un anneau libre du pool (interne au module) — refactor
// sans changement de comportement pour realHalo.
function acquireHalo() {
  if (!ready || disposed) return null;
  ensureHaloPool();
  if (!haloGroup) return null;
  for (var i = 0; i < halos.length; i++) {
    if (!halos[i].busy) return halos[i];
  }
  return null;
}

// v21 : configure un anneau acquis (interne au module).
function setupHalo(h, p, o) {
  h.busy = true;
  h.state = 0; // inspire
  h.age = 0;
  h.anticip = (o.anticip !== undefined) ? Math.max(0.2, o.anticip) : 1.2;
  h.dur = (o.dur !== undefined) ? Math.max(0.15, o.dur) : 0.5;
  h.maxR = (o.radius !== undefined) ? Math.max(4, o.radius) : 120;
  h.mesh.position.set(p.x, p.y + ((o.y !== undefined) ? o.y : 4), p.z);
  h.mat.color.setHex((o.color === undefined) ? 0x9fd0ff : o.color);
  h.mesh.visible = true;
}

function updateHalos(dt) {
  if (!haloGroup) return;
  for (var i = 0; i < halos.length; i++) {
    var h = halos[i];
    if (!h.busy) continue;
    h.age += dt;
    if (h.state === 0) {
      // INSPIRE : l'anneau se resserre et s'intensifie (télégraphe).
      var k = Math.min(1, h.age / h.anticip);
      var ke = k * k * (3 - 2 * k);
      var sc = h.maxR * (1 - 0.45 * ke);
      h.mesh.scale.set(sc, sc, 1);
      var pulse = 0.7 + 0.3 * Math.sin(h.age * (6 + 18 * k)); // s'accélère
      h.mat.opacity = (0.22 + 0.73 * ke) * pulse;
      if (k >= 1) { h.state = 1; h.age = 0; }
    } else {
      // CLAQUEMENT : expansion rapide + fondu franc.
      var k2 = Math.min(1, h.age / h.dur);
      var e2 = 1 - Math.pow(1 - k2, 3); // ease-out : claque vite
      var sc2 = h.maxR * (0.55 + 1.15 * e2);
      h.mesh.scale.set(sc2, sc2, 1);
      h.mat.opacity = 0.95 * (1 - e2);
      if (k2 >= 1) {
        h.busy = false;
        h.mesh.visible = false;
        h.mat.opacity = 0;
      }
    }
  }
}

function clearHalos() {
  for (var i = 0; i < halos.length; i++) {
    halos[i].busy = false;
    halos[i].mesh.visible = false;
    halos[i].mat.opacity = 0;
  }
}

function disposeHalos() {
  if (haloGroup) {
    var scene = (api && api.scene) ? api.scene() : null;
    if (scene) scene.remove(haloGroup);
    for (var i = 0; i < halos.length; i++) halos[i].mat.dispose();
    if (haloGeo) haloGeo.dispose();
    haloGroup = null;
    haloGeo = null;
    halos.length = 0;
  }
}

// ---------------------------------------------------------------------------
// v21 — ANNEAU DE CHOC (shockring) : anneau de particules qui claque en
// s'étendant au ras du sol (via realRing) + poussière horizontale
// soulevée (POOL_SPARKS) — l'onde de choc « tape » le sol.
// Signature : shockring({x,y,z}, opts) ; opts : {radius (m de départ,
// défaut 12), reach (m d'expansion, défaut 140), color (défaut 0xdfe9ff),
// dust (bool, défaut true), dustCount (défaut 26), y (hauteur, défaut 2),
// double (bool, défaut false : v22 — un SECOND anneau plus petit et plus
// rapide claque avec le premier : le double choc se lit sur les gros
// impacts)}.
// ---------------------------------------------------------------------------
function realShockRing(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var radius = (o.radius !== undefined) ? o.radius : 12;
  var reach = (o.reach !== undefined) ? o.reach : 140;
  var col = (o.color === undefined) ? 0xdfe9ff : o.color;
  realRing(p, {
    count: 90, radius: radius, speed: reach / 1.0, life: 1.0,
    size: 8, color: col, drag: 2.4, up: 2, plane: 'xz'
  });
  // v22 : 'double' — second anneau plus petit et plus rapide (il rattrape
  // le premier) : le double choc se lit sur les gros impacts.
  if (o.double) {
    realRing(p, {
      count: 60, radius: radius * 0.55, speed: reach / 0.62, life: 0.8,
      size: 6, color: 0xffffff, drag: 2.0, up: 3, plane: 'xz'
    });
  }
  if (o.dust === false) return;
  var n = Math.max(1, Math.round((o.dustCount || 26) * QUALITY_COUNT));
  var pool = pools[POOL_SPARKS];
  var rgb = toRGB(col);
  var y0 = (p.y || 0) + ((o.y !== undefined) ? o.y : 2);
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = 14 + Math.random() * 30;
    emit(pool,
      p.x + Math.cos(a) * 4, y0 + Math.random() * 3, p.z + Math.sin(a) * 4,
      Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp,
      rgb, 4 + Math.random() * 4, 1.1 + Math.random() * 0.7, 26,
      0, 1, 2.5, 0, null, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// v21 — PLUIE DE CENDRES (ashfall) : cendres grises qui retombent lentement
// (POOL_SMOKE, dérive douce) — l'air reste chargé après les explosions.
// Signature : ashfall({x,y,z}, opts) ; opts : {count (défaut 40),
// area (côté m de la zone, défaut 60), height (m de chute, défaut 40),
// color (défaut 0x9a938c), size (défaut 6), life (s, défaut 4),
// ember (bool, défaut false : v22 — 30 % des cendres sont encore
// INCANDESCENTES : orange, scintillent, refroidissent en braise sombre),
// wind ({x,z}, défaut 0 : v22 — dérive horizontale de la retombée)}.
// ---------------------------------------------------------------------------
function realAshfall(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 40) * QUALITY_COUNT));
  var area = (o.area !== undefined) ? o.area : 60;
  var hgt = (o.height !== undefined) ? o.height : 40;
  var rgb = toRGB((o.color === undefined) ? 0x9a938c : o.color);
  var pool = pools[POOL_SMOKE];
  var size = (o.size !== undefined) ? o.size : 6;
  var life = (o.life !== undefined) ? o.life : 4;
  var emberOn = !!o.ember; // v22
  var wind = (o.wind && typeof o.wind.x === 'number') ? o.wind : null; // v22
  var wx = wind ? wind.x : 0, wz = wind ? wind.z : 0;
  for (var i = 0; i < count; i++) {
    var isEmber = emberOn && Math.random() < 0.3; // v22 : cendre incandescente
    var argb = isEmber ? toRGB(0xff8a2a) : rgb;
    emit(pool,
      p.x + (Math.random() - 0.5) * area, p.y + Math.random() * hgt,
      p.z + (Math.random() - 0.5) * area,
      (Math.random() - 0.5) * 4 + wx, -(6 + Math.random() * 8), (Math.random() - 0.5) * 4 + wz,
      argb, size * (0.7 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.6), 3,
      0, 0.5, 1.2, isEmber ? 1 : 0, 14,
      isEmber ? [0.4, 0.06, 0.01] : null, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// v21 — RAFALE (gust) : poussière horizontale DIRECTIONNELLE (POOL_SMOKE)
// qui balaie le sol — l'onde de choc « pousse » l'air devant elle.
// Signature : gust({x,y,z}, opts) ; opts : {count (défaut 30),
// dir:{x,y,z} (défaut +X), speed (m/s, défaut 40), spread (m, défaut 30),
// color (défaut 0xb8a98f), size (défaut 9), life (s, défaut 2.2)}.
// ---------------------------------------------------------------------------
function realGust(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 30) * QUALITY_COUNT));
  var dx = 1, dy = 0, dz = 0;
  if (o.dir && typeof o.dir.x === 'number') { dx = o.dir.x; dy = o.dir.y; dz = o.dir.z; }
  var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  var speed = (o.speed !== undefined) ? o.speed : 40;
  var spread = (o.spread !== undefined) ? o.spread : 30;
  var rgb = toRGB((o.color === undefined) ? 0xb8a98f : o.color);
  var pool = pools[POOL_SMOKE];
  var size = (o.size !== undefined) ? o.size : 9;
  var life = (o.life !== undefined) ? o.life : 2.2;
  for (var i = 0; i < count; i++) {
    var off = (Math.random() - 0.5) * spread;
    var sp = speed * (0.6 + Math.random() * 0.8);
    emit(pool,
      p.x + (Math.random() - 0.5) * spread - dx * 20,
      p.y + 2 + Math.random() * 6,
      p.z + off - dz * 20,
      dx * sp, 1 + Math.random() * 3, dz * sp + (Math.random() - 0.5) * 10,
      rgb, size * (0.7 + Math.random() * 0.7), life * (0.7 + Math.random() * 0.6), -4,
      1.5, 0.7, 2.2, 0, null, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// v22 — COLONNE D'ÉNERGIE (beam) : colonne verticale de particules qui
// fusent vers le ciel dans un cylindre étroit — naissance du trou noir,
// impact de la météorite, frappes majeures. Réutilisable par tous les
// modules via AZEvent.fx.beam.
// Signature : beam({x,y,z}, opts) ; opts : {height (m, défaut 400),
// radius (m du cylindre, défaut 26), count (défaut 90, plafond 220),
// color (défaut 0xbfe0ff), color2 (couleur en haut de la colonne, défaut
// blanc/color), speed (m/s, défaut 260), size (défaut 7), life (s,
// défaut 2.2), flicker (bool, défaut true), ring (bool, défaut true :
// anneau de choc au pied de la colonne)}.
// ---------------------------------------------------------------------------
function realBeam(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.min(220, Math.round((o.count || 90) * QUALITY_COUNT)));
  var height = (o.height !== undefined) ? o.height : 400;
  var radius = (o.radius !== undefined) ? o.radius : 26;
  var speed = (o.speed !== undefined) ? o.speed : 260;
  var size = (o.size !== undefined) ? o.size : 7;
  var life = (o.life !== undefined) ? o.life : 2.2;
  var rgb = toRGB((o.color === undefined) ? 0xbfe0ff : o.color);
  var rgb2 = toRGB((o.color2 === undefined) ?
    ((o.color === undefined) ? 0xffffff : o.color) : o.color2);
  var flick = (o.flicker === false) ? 0 : 1;
  var pool = pools[POOL_SPARKS];
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var rr = Math.sqrt(Math.random()) * radius; // disque uniforme
    var h0 = Math.random() * height * 0.25;     // départs échelonnés
    var hk = h0 / height;                       // 0 bas -> 1 haut
    // la couleur « chauffe » vers color2 avec l'altitude
    var cr = rgb[0] + (rgb2[0] - rgb[0]) * hk;
    var cg = rgb[1] + (rgb2[1] - rgb[1]) * hk;
    var cb = rgb[2] + (rgb2[2] - rgb[2]) * hk;
    var sp = speed * (0.6 + Math.random() * 0.8);
    var bsz = size * (0.7 + Math.random() * 0.6);
    emit(pool,
      p.x + Math.cos(a) * rr, p.y + h0, p.z + Math.sin(a) * rr,
      (Math.random() - 0.5) * 14, sp, (Math.random() - 0.5) * 14,
      [cr, cg, cb], bsz,
      life * (0.6 + Math.random() * 0.8), -30,
      0, 1, 1.8, flick, 22, null, bsz * 0.3, 9);
  }
  // Anneau de choc au pied de la colonne (l'énergie « tape » le sol).
  if (o.ring !== false) {
    realRing(p, { count: 60, radius: radius * 1.6, speed: 220, life: 1.0,
      size: 7, color: o.color === undefined ? 0xbfe0ff : o.color,
      drag: 2.2, plane: 'xz' });
  }
}

// ---------------------------------------------------------------------------
// v22 — DISTORSION (distort) : « lentille » de particules — des étincelles
// à FORTE turbulence oscillent comme de la lumière réfractée (vitesse
// quasi nulle, dérive lente vers le centre) + double anneau de choc :
// l'espace lui-même semble se plier. Réutilisable via AZEvent.fx.distort.
// Signature : distort({x,y,z}, opts) ; opts : {count (défaut 70),
// radius (m, défaut 90), color (défaut 0xa8ccff), dur (s, défaut 1.6)}.
// ---------------------------------------------------------------------------
function realDistort(p, o) {
  if (!ready || !p) return;
  o = o || {};
  var count = Math.max(1, Math.round((o.count || 70) * QUALITY_COUNT));
  var radius = (o.radius !== undefined) ? o.radius : 90;
  var dur = (o.dur !== undefined) ? o.dur : 1.6;
  var rgb = toRGB((o.color === undefined) ? 0xa8ccff : o.color);
  var pool = pools[POOL_FX];
  for (var i = 0; i < count; i++) {
    // coquille sphérique : la lumière « prise » dans la lentille
    var th = Math.random() * Math.PI * 2;
    var ph = Math.acos(2 * Math.random() - 1);
    var dx = Math.cos(th) * Math.sin(ph), dy = Math.cos(ph), dz = Math.sin(th) * Math.sin(ph);
    var r = radius * (0.75 + Math.random() * 0.5);
    var dsz = 5 + Math.random() * 5;
    emit(pool,
      p.x + dx * r, p.y + dy * r, p.z + dz * r,
      -dx * 12, -dy * 12, -dz * 12,   // dérive lente vers le centre
      rgb, dsz, dur * (0.7 + Math.random() * 0.6),
      0, 0, 1, 0.4, 1, 90, null, dsz * 0.5, 13); // TURBULENCE FORTE = réfraction
  }
  // Double anneau : l'onde de la distorsion.
  var dc = (o.color === undefined) ? 0xa8ccff : o.color;
  realRing(p, { count: 50, radius: radius * 0.8, speed: radius * 1.6, life: 1.1,
    size: 6, color: dc, drag: 1.8, plane: 'xz' });
  realRing(p, { count: 34, radius: radius * 0.45, speed: radius * 2.4, life: 0.8,
    size: 5, color: 0xffffff, drag: 1.8, plane: 'xz' });
}

// ---------------------------------------------------------------------------
// File d'attente provisoire : si un module appelle fx avant init(), les
// appels sont rejoués à l'init (limité à 40 pour rester léger).
// ---------------------------------------------------------------------------
var FX_NAMES = ['burst', 'trail', 'embers', 'ring', 'vortex', 'sparkle',
                'implosion', 'smoke', 'fire', 'clear',
                'sparkJet', 'halo', // v20 : gerbe directionnelle + halo d'anticipation
                'shockring', 'ashfall', 'gust', // v21 : anneau de choc, cendres, rafale
                'beam', 'distort']; // v22 : colonne d'énergie, distorsion
var FX_REAL = {
  burst: realBurst, trail: realTrail, embers: realEmbers, ring: realRing,
  vortex: realVortex, sparkle: realSparkle, implosion: realImplosion,
  smoke: realSmoke, fire: realFire, clear: realClear,
  sparkJet: realSparkJet, halo: realHalo, // v20
  shockring: realShockRing, ashfall: realAshfall, gust: realGust, // v21
  beam: realBeam, distort: realDistort // v22
};
var pendingFx = []; // [name, argsArray]

function queueFx(name, args) {
  if (pendingFx.length < 40) pendingFx.push([name, args]);
}

function makeQueuedFx() {
  var stub = {};
  for (var i = 0; i < FX_NAMES.length; i++) {
    (function (name) {
      stub[name] = function () { queueFx(name, arguments); };
    })(FX_NAMES[i]);
  }
  return stub;
}

root.AZEvent.fx = makeQueuedFx();

// ---------------------------------------------------------------------------
// Capsules bleues orbitales (phases 'firstrocket' / 'sixrockets')
// ---------------------------------------------------------------------------
var capsuleGroup = null;
var capsules = [];   // {mesh, halo, radius, angle, speed, y, bobPhase}
var haloTexture = null;
var CAPSULE_COUNT = 24;
var capsuleReveal = 1;      // v12 : 0 → 1 pendant le pop d'apparition
var capsulesWereShown = false;

// v12 : overshoot franc pour les apparitions (capsules, etc.).
function easeOutBack12(p) {
  p = p < 0 ? 0 : (p > 1 ? 1 : p);
  var c1 = 1.30158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

function makeHaloTexture() {
  // sprite radial bleu : dessiné en canvas, aucun réseau
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(180,235,255,1)');
  grad.addColorStop(0.35, 'rgba(80,180,255,0.55)');
  grad.addColorStop(1, 'rgba(40,120,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}

function buildCapsules() {
  var scene = api.scene();
  capsuleGroup = new T.Group();
  haloTexture = makeHaloTexture();
  var octGeo = new T.OctahedronGeometry(3);
  var coreMat = new T.MeshBasicMaterial({ color: 0x66d9ff });
  var i, mesh, halo, haloMat;
  for (i = 0; i < CAPSULE_COUNT; i++) {
    mesh = new T.Mesh(octGeo, coreMat);
    haloMat = new T.SpriteMaterial({
      map: haloTexture, color: 0x55bbff,
      transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, depthWrite: false
    });
    halo = new T.Sprite(haloMat);
    halo.scale.set(22, 22, 1);
    mesh.add(halo);
    capsuleGroup.add(mesh);
    capsules.push({
      mesh: mesh, halo: halo,
      radius: 300 + Math.random() * 220,       // orbites autour de la map
      angle: Math.random() * Math.PI * 2,
      speed: (0.12 + Math.random() * 0.15) * (Math.random() < 0.5 ? 1 : -1),
      y: 140 + Math.random() * 30,             // y ≈ 150
      bobPhase: Math.random() * Math.PI * 2
    });
  }
  capsuleGroup.visible = false;
  scene.add(capsuleGroup);
}

function updateCapsules(dt, t) {
  if (!capsuleGroup) return; // sécurité : update entre dispose() et ré-init
  var st = root.AZEvent.state;
  var show = (st === 'firstrocket' || st === 'sixrockets');
  if (show && !capsulesWereShown) capsuleReveal = 0; // v12 : pop d'apparition
  capsulesWereShown = show;
  capsuleGroup.visible = show;
  if (!show) return;
  capsuleReveal = Math.min(1, capsuleReveal + dt / 0.6);
  var cx = api.center ? api.center.x : 0;
  var cz = api.center ? api.center.z : 0;
  for (var i = 0; i < capsules.length; i++) {
    var c = capsules[i];
    c.angle += c.speed * dt;
    c.mesh.position.set(
      cx + Math.cos(c.angle) * c.radius,
      c.y + Math.sin(t * 1.4 + c.bobPhase) * 6,
      cz + Math.sin(c.angle) * c.radius
    );
    c.mesh.rotation.y += dt * 2.2;   // la capsule tourne sur elle-même
    c.mesh.rotation.x += dt * 1.1;
    // v12 : apparition en cascade — chaque capsule "claque" avec un overshoot.
    var ck = Math.min(1, Math.max(0, capsuleReveal * 1.5 - (i / capsules.length) * 0.5));
    var ce = easeOutBack12(ck);
    c.mesh.scale.set(ce, ce, ce);
    c.halo.material.opacity = 0.85 * Math.min(1, ck * 1.3);
    var pulse = 1 + Math.sin(t * 3 + c.bobPhase) * 0.12; // halo qui respire
    c.halo.scale.set(22 * pulse, 22 * pulse, 1);
  }
}

// ---------------------------------------------------------------------------
// Champ d'étoiles (phases 'allgone' → 'end')
// ---------------------------------------------------------------------------
var starPoints = null;
var starMat = null;
var starFade = 0;      // v13 : fondu doux du champ d'étoiles (0..1)
var STAR_COUNT = 500; // < 500 particules par système (contrainte permanente)
var STAR_RADIUS = 1500;
var STAR_VERT = [
  'attribute float aPhase;',
  'uniform float uTime;',
  'varying float vTw;',
  'void main() {',
  '  vTw = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 2.2 + aPhase));',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  gl_PointSize = 2.4;',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');
var STAR_FRAG = [
  'varying float vTw;',
  'uniform float uFade;', // v13 : fondu d'apparition/disparition du champ
  'void main() {',
  '  vec2 uv = gl_PointCoord - vec2(0.5);',
  '  if (length(uv) > 0.5) discard;',
  '  gl_FragColor = vec4(0.85, 0.92, 1.0, vTw * uFade);',
  '}'
].join('\n');

function buildStars() {
  var geo = new T.BufferGeometry();
  var pos = new Float32Array(STAR_COUNT * 3);
  var phase = new Float32Array(STAR_COUNT);
  var i, th, ph, r;
  for (i = 0; i < STAR_COUNT; i++) {
    th = Math.random() * Math.PI * 2;
    ph = Math.acos(2 * Math.random() - 1); // sphère uniforme
    r = STAR_RADIUS * (0.95 + Math.random() * 0.1);
    pos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
    pos[i * 3 + 1] = Math.abs(Math.cos(ph)) * r * 0.9 + 40; // plutôt vers le haut
    pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
    phase[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new T.BufferAttribute(phase, 1));
  starMat = new T.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 } }, // v13 : fondu doux
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending
  });
  starPoints = new T.Points(geo, starMat);
  starPoints.frustumCulled = false;
  starPoints.visible = false;
  api.scene().add(starPoints);
}

function updateStars(dt, t) {
  if (!starPoints || !starMat) return; // sécurité : update entre dispose() et ré-init
  var s = root.AZEvent.state;
  var show = (s === 'allgone' || s === 'blackhole' || s === 'numbers' || s === 'end');
  // v13 : fondu doux d'apparition/disparition (pas de bascule visible).
  starFade += ((show ? 1 : 0) - starFade) * Math.min(1, dt * 1.6);
  if (Math.abs((show ? 1 : 0) - starFade) < 0.01) starFade = show ? 1 : 0;
  starPoints.visible = starFade > 0.01;
  starMat.uniforms.uFade.value = starFade;
  if (starPoints.visible) starMat.uniforms.uTime.value = t;
}

// ---------------------------------------------------------------------------
// Débris de faille : ~40 morceaux lumineux qui tombent ('rocket:rift-enter')
// ---------------------------------------------------------------------------
function onRiftEnter(data) {
  if (disposed || !ready) return;
  var p = (data && data.pos) ? data.pos : null;
  var sx = p ? p.x : (api.center ? api.center.x : 0);
  var sy = p ? p.y : 420;
  var sz = p ? p.z : (api.center ? api.center.z : 0);
  var pool = pools[POOL_DEBRIS];
  var rgb = [0.45, 0.8, 1.0];
  var n = Math.round(40 * QUALITY_COUNT);
  for (var i = 0; i < n; i++) {
    emit(pool,
      sx + (Math.random() - 0.5) * 120, sy + (Math.random() - 0.5) * 40, sz + (Math.random() - 0.5) * 120,
      (Math.random() - 0.5) * 20, -30 - Math.random() * 60, (Math.random() - 0.5) * 20,
      rgb, 5 + Math.random() * 6, 2.5 + Math.random() * 2, 60);
  }
}

// ---------------------------------------------------------------------------
// v15 : rafales synchronisées sur les temps forts (écoute les bus existants)
// ---------------------------------------------------------------------------
// Centre de la rafale : pos du bus si fournie, sinon le centre de l'arène.
function gustCenter(d) {
  var p = (d && d.pos) ? d.pos : null;
  var c = (api && api.center) ? api.center : null;
  return {
    x: (p && isFinite(p.x)) ? p.x : (c ? c.x : 0),
    y: (p && isFinite(p.y)) ? p.y : (c ? c.y + 40 : 40),
    z: (p && isFinite(p.z)) ? p.z : (c ? c.z : 0)
  };
}

// 'shockwave' {force, pos} : rafale de poussière radiale + braises qui
// montent, ampleur proportionnelle à la force (0.32 -> 0.77 sur les 7 temps).
function onShockGust(d) {
  if (disposed || !ready || !root.AZEvent.active) return;
  var f = (d && typeof d.force === 'number') ? d.force : 0.5;
  var c = gustCenter(d);
  try {
    // v16 : grammaire unifiée — la famille BLEU électrique pour les ondes
    // de choc (le bus 'shockwave' sert aussi le Point Zéro et les failles).
    realBurst(c.x, c.y, c.z, {
      count: Math.round(14 + f * 30), color: 0xd8e8ff,
      speed: 40 + f * 60, life: 1.8, size: 7, gravity: 25, drag: 2.2
    });
    realEmbers(c, {
      count: Math.round(10 + f * 26), spread: 90,
      size: 6, life: 3.2, color: 0x9fd0ff
    });
    // v22 : sur les derniers temps (force >= 0.7), l'espace se PLIE —
    // distorsion autour du centre (les temps finaux sont cosmiques).
    if (f >= 0.7) realDistort(c, { radius: 120, count: 50, dur: 1.4 });
  } catch (e) { /* ignore */ }
}

// 'meteor:hit' : grosse rafale de braises + étincelles + fumée à l'impact.
function onMeteorGust(d) {
  if (disposed || !ready || !root.AZEvent.active) return;
  var c = gustCenter(d);
  try {
    realEmbers(c, { count: 60, spread: 160, size: 8, life: 4, color: 0xff7a2a });
    realSparkle(c, { count: 30, spread: 120, size: 5, life: 0.8, color: 0xffe9c4 });
    realSmoke(c, { count: 30, spread: 60, size: 30, life: 5, color: 0x8a8f98, rise: 14, alpha: 0.5 });
    // v22 : la colonne d'énergie FUSE du point d'impact + la distorsion
    // plie l'espace autour (cause -> effet : l'impact se LIT en entier).
    realBeam(c, { height: 700, radius: 40, count: 110, color: 0xffd9a0,
      color2: 0xfff6e8, speed: 320, life: 2.4 });
    realDistort(c, { radius: 160, count: 80, dur: 1.8 });
  } catch (e) { /* ignore */ }
}

// 'rocket:impact' (contact phase 8) : rafale bleue électrique + anneau.
function onRocketGust(d) {
  if (disposed || !ready || !root.AZEvent.active) return;
  var c = gustCenter(d);
  try {
    realBurst(c.x, c.y, c.z, {
      count: 44, color: 0xbfe0ff, speed: 120, life: 1.4,
      size: 6, gravity: 30, drag: 2.0
    });
    realRing(c, { count: 60, color: 0x9fd0ff, radius: 60, speed: 160, life: 1.2, size: 6 });
  } catch (e) { /* ignore */ }
}

// 'suction:beat' : pulsation de particules aspirées vers le centre.
function onSuctionGust() {
  if (disposed || !ready || !root.AZEvent.active) return;
  var c = gustCenter(null);
  try {
    realVortex(c, { count: 50, color: 0x66aaff, radius: 110, height: 80, speed: 80, inward: 60, life: 2.0, size: 6 });
    realSparkle(c, { count: 16, spread: 80, size: 4, life: 0.6, color: 0xcfe8ff });
  } catch (e) { /* ignore */ }
}

// v17 : PLUIE DE BRAISES — appelée chaque frame depuis update() : pendant
// 'contraction'/'collapse', des braises incandescentes TOMBENT du ciel sur
// toute l'île (gravité positive, refroidissement en braise sombre en fin
// de vie). Les nappes sont irrégulières (rafales), pas un rideau uniforme.
function updateEmberRain(dt) {
  var st = root.AZEvent.state;
  if (st !== 'contraction' && st !== 'collapse') { rainOn = false; rainAcc = 0; return; }
  if (!ready || disposed || !root.AZEvent.active) return;
  if (!rainOn) { rainOn = true; rainAcc = 0; }
  var pool = pools[POOL_TRAIL];
  var cx = 0, cz = 0;
  try {
    var c = api.center;
    if (c && isFinite(c.x)) cx = c.x;
    if (c && isFinite(c.z)) cz = c.z;
  } catch (e) { /* centre par défaut */ }
  rainAcc += dt;
  while (rainAcc > 0.03) {
    rainAcc -= 0.03;
    var n = 1 + Math.floor(Math.random() * 3); // nappes irrégulières
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = 150 + Math.random() * 1500; // toute l'île
      var bx = cx + Math.cos(a) * r, bz = cz + Math.sin(a) * r;
      var by = 500 + Math.random() * 800; // tombent du ciel
      var rgb = toRGB(Math.random() < 0.7 ? 0xff8a2a : 0xffd9a0);
      emit(pool, bx, by, bz,
        (Math.random() - 0.5) * 16, -30 - Math.random() * 45, (Math.random() - 0.5) * 16,
        rgb, 4 + Math.random() * 5, 6 + Math.random() * 5,
        55, 0, 1, 0.6, 1, 1, [0.35, 0.05, 0.01], 0, 0);
    }
  }
}

// ---------------------------------------------------------------------------
// Construction (appelée à init, réessayée sur update si la scène manquait)
// ---------------------------------------------------------------------------
function build() {
  if (ready || disposed) return true;
  if (!api || !api.scene || !api.scene()) return false;
  T = api.T || root.THREE;
  if (!T) return false;

  // Niveaux de qualité : mobile/low -> ~45 %, medium -> 75 %, high -> 100 %.
  QUALITY_COUNT = (api.quality === 'low' || api.isMobile) ? 0.45 :
    (api.quality === 'high' ? 1 : 0.75);

  // 5 pools de 450 (< 500 par système) : étincelles / traînées-braises /
  // effets (ring, vortex, implosion) / débris / fumée (blending normal).
  createPool(POOL_CAP, true);
  createPool(POOL_CAP, true);
  createPool(POOL_CAP, true);
  createPool(POOL_CAP, true);
  createPool(POOL_CAP, false);

  buildCapsules();
  buildStars();

  // AZEvent.off n'existe pas (bus on/emit seulement) : l'écouteur reste
  // branché à vie du module et survit au restart via les variables de
  // portée module (pools reconstruits). Sans ce garde, chaque restart
  // ajouterait un écouteur -> double émission des débris de faille.
  if (!listenersBound) {
    listenersBound = true;
    api.on('rocket:rift-enter', onRiftEnter);
    // v15 : RAFALES synchronisées sur les temps forts — les champs de
    // particules existants répondent aux bus (aucun son émis ici).
    api.on('shockwave', onShockGust);
    api.on('meteor:hit', onMeteorGust);
    api.on('rocket:impact', onRocketGust);
    api.on('suction:beat', onSuctionGust);
    // v22 : à la naissance du trou noir, une colonne d'énergie bleue FUSE
    // vers le ciel + la distorsion plie l'espace (le cosmos s'ouvre) —
    // câblé en interne, aucun autre module à toucher.
    api.on('blackhole:formed', function () {
      if (disposed || !ready || !root.AZEvent.active) return;
      var c = gustCenter(null);
      try {
        realBeam({ x: c.x, y: c.y - 20, z: c.z }, {
          height: 900, radius: 30, count: 120, color: 0x6fa8ff,
          color2: 0xeaf4ff, speed: 380, life: 2.8
        });
        realDistort({ x: c.x, y: c.y, z: c.z }, { radius: 130, count: 70, dur: 2.0 });
      } catch (e) { /* ignore */ }
    });
  }

  // Publie la vraie API puis rejoue les appels mis en file avant init.
  ready = true;
  root.AZEvent.fx = {
    burst: realBurst, trail: realTrail, embers: realEmbers, ring: realRing,
    vortex: realVortex, sparkle: realSparkle, implosion: realImplosion,
    smoke: realSmoke, fire: realFire, clear: realClear,
    sparkJet: realSparkJet, halo: realHalo, // v20
    shockring: realShockRing, ashfall: realAshfall, gust: realGust, // v21
    beam: realBeam, distort: realDistort // v22
  };
  for (var i = 0; i < pendingFx.length; i++) {
    var q = pendingFx[i];
    try { FX_REAL[q[0]].apply(null, q[1]); } catch (e) { /* ignore */ }
  }
  pendingFx.length = 0;
  return true;
}

// ---------------------------------------------------------------------------
// Enregistrement du module
// ---------------------------------------------------------------------------
root.AZEvent.register('particles', {
  init: function (a) {
    api = a;
    // Restart (stop -> start) : l'état post-dispose() interdisait toute
    // reconstruction (build() sortait immédiatement, crash sur capsuleGroup
    // null à la frame suivante). On autorise la reconstruction complète.
    disposed = false;
    ready = false;
    build();
  },

  update: function (dt, t) {
    if (!root.AZEvent.active) return;   // inactif hors event
    if (disposed) return;
    if (!build()) return;               // scène pas encore prête : réessaie
    dt = Math.min(dt, 0.05);            // borne anti-spike
    var i;
    for (i = 0; i < pools.length; i++) updatePool(pools[i], dt);
    updateCapsules(dt, t);
    updateStars(dt, t);
    updateEmberRain(dt); // v17 : pluie de braises après l'impact
    updateHalos(dt); // v20 : halos d'anticipation
  },

  dispose: function () {
    disposed = true;
    var scene = (api && api.scene) ? api.scene() : null;
    var i;
    for (i = 0; i < pools.length; i++) {
      if (scene) scene.remove(pools[i].mesh);
      pools[i].geo.dispose();
      pools[i].mesh.material.dispose();
    }
    pools.length = 0;
    if (capsuleGroup) {
      if (scene) scene.remove(capsuleGroup);
      // géométrie et matériaux partagés : on dispose une fois
      if (capsules.length) {
        capsules[0].mesh.geometry.dispose();
        capsules[0].mesh.material.dispose();
      }
      for (i = 0; i < capsules.length; i++) capsules[i].halo.material.dispose();
      if (haloTexture) haloTexture.dispose();
      capsuleGroup = null;
      capsules.length = 0;
      haloTexture = null;
    }
    if (starPoints) {
      if (scene) scene.remove(starPoints);
      starPoints.geometry.dispose();
      starPoints.material.dispose();
      starPoints = null;
      starMat = null;
      starFade = 0; // v13 : réarmé (restart propre)
    }
    // Retire l'écouteur si le bus le permet.
    if (root.AZEvent && typeof root.AZEvent.off === 'function') {
      root.AZEvent.off('rocket:rift-enter', onRiftEnter);
    }
    pendingFx.length = 0;
    ready = false;
    rainOn = false; rainAcc = 0; // v17 : réarmé (restart propre)
    disposeHalos(); // v20 : halos d'anticipation retirés (restart propre)
    if (root.AZEvent.fx && root.AZEvent.fx.burst === realBurst) {
      root.AZEvent.fx = makeQueuedFx();
    }
    api = null;
  }
});

})(window);
