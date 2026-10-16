/* event-sky.js — projet "THE END" (AZUR Horizons v1.8).
 *
 * TRANSITIONS DU CIEL pendant l'événement live Fortnite Chapitre 1 Saison X
 * (13 octobre 2019), 23 phases.
 * SEUL module autorisé à toucher ciel / fog / lumières.
 *
 * Arc cinématique (piloté par les états de phase + le bus, JAMAIS de temps
 * absolus en dur) :
 * - countdown / firstrocket : JOUR — ciel bleu clair et lumineux, soleil,
 *   nuages légers.
 * - sixrockets    : le ciel S'ASSOMBRIT progressivement pendant le décollage
 *   (transition jour -> nuit).
 * - convergence -> end : NUIT — ciel noir étoilé dense + PLEINE LUNE
 *   brillante.
 * - loop -> meteorsix : AURORES vertes/bleues en rideaux ondulants qui
 *   balaient le ciel (vert émeraude + bleu cyan, JAMAIS violet).
 * - impact : flash blanc/bleu (bus 'meteor:hit'), mais le fond reste un ciel
 *   étoilé.
 * v12 (passe animation globale) : éclairs qui vibrent (double frappe),
 * tremblement de tension plus piqué, flash 'strike' à l'attaque plus franche,
 * lune qui APPARAÎT avec un pop (overshoot), aurores qui respirent chacune
 * à leur rythme. L'arc cinématique (jour → nuit → noir) est inchangé.
 * v15 (passe animation maximale) : éclairs RAMIFIÉS en double frappe, plus
 * fréquents pendant les phases critiques (strike, greatrift, meteorsix,
 * descent, veeroff) ; la lune DÉRIVE et GROSSIT légèrement pendant la nuit ;
 * les aurores RESPIRENT plus fort (chaque rideau à son rythme) ; les étoiles
 * SCINTILLENT plus fort pendant le trou noir ; la transition
 * lumineux → sombre → noir est plus progressive et dramatique (fondus
 * allongés, frémissement avant le noir). Le ciel reste LUMINEUX hors
 * événement (état normal et dispose() intacts).
 * - contraction -> collapse : assombrissement progressif vers le noir.
 * - growth -> numbers : noir quasi absolu, légère respiration bleue
 *   lointaine.
 * - end : noir total.
 * INTERDIT : teintes violettes/mauves, tourbillons violets.
 *
 * Hors event : ciel et eau CLairs et lumineux (jamais sombre hors cinématique)
 * -> tout est restauré EXACTEMENT dans dispose().
 *
 * Principe : view.update() réécrit les lumières, le fog, le dôme de ciel
 * (environment.skyUniforms), les étoiles et l'exposition À CHAQUE FRAME.
 * Ce module calcule l'état du ciel dans update(), puis le ré-applique via
 * un wrapper réversible posé sur view.update() (retiré dans dispose()).
 * Toutes les valeurs d'origine sont sauvegardées à l'init et restaurées
 * dans dispose(). Inactif quand !AZEvent.active.
 *
 * Contrat : IIFE 'use strict', THREE global, aucun import, aucun réseau,
 * inactif si !AZEvent.active, dispose() restaure TOUT (ciel, fog, lumières).
 */
(function (root) {
'use strict';

if (!root.AZEvent) return; // AZEvent absent : ne rien faire

// ---------------- variables internes ----------------
var T = null;             // THREE (global)
var api = null;           // api AZEvent passée à init()
var view = null;          // window.AZUR.view
var disposed = false;     // true après dispose()
var wired = false;        // écouteurs du bus déjà posés

var cur = null;           // état de ciel courant (point de départ des fondus)
var blendFrom = null;     // état de départ du fondu en cours
var blendTo = null;       // état cible du fondu en cours
var blendT = 1;           // 0..1 : progression du fondu
var blendDur = 4;         // durée du fondu (secondes)
var applied = null;       // état final (courant + effets), appliqué sur la scène
var origState = null;     // état "jeu normal" = valeurs d'origine (calme, clair)

var flash = null;         // { t, dur, kind: 'white'|'strike' } ou null
var calmT = 999;          // secondes écoulées depuis le dernier 'calm'
var fxMode = null;        // effet continu de phase (voir update)
var lightningT = 0;       // minuteur d'éclairs lointains
var lightningFlash = 0;   // éclair en cours (0 = aucun)
var tensionK = 0;         // tension du compte à rebours (0..1, pilotée par countdown:tick)
var firstTick = 0;        // premier 'remaining' vu (référence de la phase)
var tickRemaining = -1;   // dernier 'remaining' reçu
var glowPulse = 0;        // lueur chaude des explosions (shockwave), décroît vite
var glowWarm = false;     // v16 : teinte chaude si l'événement est de la famille FEU (météorite)
var beatPulse = 0;        // pulsation bleue (suction:beat)
var auroraKick = 0;      // v20 : impulsion des aurores aux temps forts (ondes, battements)
var bhBlue = false;       // respiration bleue active après blackhole:formed
var contractK = 0;        // progression de la contraction (0..1, rythme propre)
var darkenK = 0;          // progression du noir (0..1, rythme propre)

var orig = null;          // sauvegarde brute des valeurs d'origine
var origUpdate = null;    // view.update d'origine
var wrappedUpdate = null; // notre view.update wrappé
var WHITE_STATE = null;   // état du flash blanc (construit à l'init)

// Effets visuels propres au module (étoiles denses + lune + aurores boréales)
var starField = null;     // THREE.Points : champ d'étoiles dense (nuit)
var moonSprite = null;    // Sprite : pleine lune brillante
var moonTex = null;       // texture générée (canvas local, aucun réseau)
var moonK = 0;            // visibilité de la lune 0..1 (fondu doux)
var moonTarget = 0;       // cible de visibilité de la lune (pilotée par phase)
var moonPopT = 1;         // v12 : 0 → 1 pendant le pop d'apparition de la lune
var auroraGroup = null;   // groupe des rubans d'aurores
var auroraMats = [];      // ShaderMaterials des aurores (uniforms animés)
var auroraK = 0;          // visibilité aurores 0..1 (fondu doux)
var auroraTarget = 0;     // cible de visibilité aurores (pilotée par phase)
// v15 : passe animation maximale.
var phaseName = '';       // phase courante (éclairs critiques, étoiles)
var moonGrow = 0;         // 0..1 : la lune grossit pendant la nuit
// v17 : la lune RÉAGIT AU TROU NOIR — 0..1 : étirement (spaghettification),
// glissement vers le Point Zéro et rougissement pendant contraction ->
// collapse (cause : la gravité du trou noir qui se forme ; la lune est le
// dernier astre englouti).
var moonPull = 0;
var moonPullTarget = 0;
var stormK = 0;           // intensité orageuse courante 0..1
var boltGroup = null;     // éclairs ramifiés (meshs additifs)
var boltMeshes = [];      // [{mesh, mat, age, dur}] éclairs en cours
var boltClock = 0;        // minuteur de déclenchement des éclairs
var boltFlash = 0;        // flash global synchronisé aux éclairs (0..1)
var boltVolley = 0;       // v20 : volée d'éclairs forcée (meteor:hit)
// v21 : PLUIE D'ÉTOILES FILANTES — pendant 'blackhole'/'numbers', des
// traînées lumineuses tombent du ciel vers le trou noir (le cosmos se
// vide). Poolé, zéro allocation par frame, < 50 particules.
// v22 (passe « frissons ») : teinte de TENSION qui monte phase par phase
// (l'horizon rougeoie doucement, jamais violet), éclairs CHORÉGRAPHIÉS
// (balayage gauche->droite sur les temps forts + à l'entrée de 'strike'),
// étoiles filantes étendues à 'collapse'/'growth' et ASPIRÉES vers le Point
// Zéro, embrasement LENT du ciel après le décollage (braise ~25 s), lune
// AVALÉE plus violemment (étirement/rougissement/tremblement amplifiés +
// flare à 'blackhole:formed'), le ciel RÉPOND à chaque nombre
// ('number:show' : pouls bleu lointain).
var streakSys = null;    // {points, mat, pos, vel, life, cursor}
var streakAcc = 0;
var STREAK_N = 48;
var phaseHeat = 0;       // v22 : teinte de tension courante (0..1)
var heatTarget = 0;      // v22 : cible de tension (pilotée par la phase)
var burnK = 0;           // v22 : embrasement lent du ciel après le décollage
var moonFlare = 0;       // v22 : dernier sursaut de la lune avalée
var numSkyPulse = 0;     // v22 : le ciel répond à chaque nombre affiché
var boltQueue = [];      // v22 : éclairs chorégraphiés ({t, idx}, alloué sur événement)
var streakTarget = { x: 0, y: 25, z: 0 }; // v22 : les étoiles filantes visent le Point Zéro

// v12 : overshoot franc pour les apparitions célestes.
function easeOutBack12(p) {
  p = p < 0 ? 0 : (p > 1 ? 1 : p);
  var c1 = 1.20158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

var tmpA = null, tmpB = null; // couleurs temporaires (évite les allocations)

// ---------------- état de ciel ----------------
// Un état regroupe tout ce que ce module pilote.
function newState() {
  return {
    fog: new T.Color(0xb7e4ea), fogD: 0.00095,          // FogExp2
    sun: new T.Color(0xfff0cf), sunI: 2.65,             // DirectionalLight
    hSky: new T.Color(0xd9f5ff), hGnd: new T.Color(0x718450), hemiI: 2.05, // HemisphereLight
    fill: new T.Color(0x79d8e6), fillI: 0.34,           // skyFill (DirectionalLight)
    top: new T.Color(0x268cce), bot: new T.Color(0xd5eff0), // dôme de ciel (uniforms)
    day: 1, dusk: 0,                                    // uniforms daylight / dusk
    stars: 0, starTint: new T.Color(0xdbeaff),           // étoiles (Points)
    water: 1,                                           // waterUniforms.light
    clouds: 0.77,                                       // cloudMaterial.opacity
    exposure: 1.1,                                      // renderer.toneMappingExposure
    bg: new T.Color(0x8fc3d4)                            // scene.background
  };
}

function copyState(dst, src) {
  dst.fog.copy(src.fog); dst.fogD = src.fogD;
  dst.sun.copy(src.sun); dst.sunI = src.sunI;
  dst.hSky.copy(src.hSky); dst.hGnd.copy(src.hGnd); dst.hemiI = src.hemiI;
  dst.fill.copy(src.fill); dst.fillI = src.fillI;
  dst.top.copy(src.top); dst.bot.copy(src.bot);
  dst.day = src.day; dst.dusk = src.dusk;
  dst.stars = src.stars; dst.starTint.copy(src.starTint);
  dst.water = src.water; dst.clouds = src.clouds;
  dst.exposure = src.exposure; dst.bg.copy(src.bg);
  return dst;
}

// Interpolation douce entre deux états (couleurs + nombres).
function lerpState(a, b, t, out) {
  out.fog.copy(a.fog).lerp(b.fog, t);
  out.fogD = a.fogD + (b.fogD - a.fogD) * t;
  out.sun.copy(a.sun).lerp(b.sun, t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hSky.copy(a.hSky).lerp(b.hSky, t);
  out.hGnd.copy(a.hGnd).lerp(b.hGnd, t);
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  out.fill.copy(a.fill).lerp(b.fill, t);
  out.fillI = a.fillI + (b.fillI - a.fillI) * t;
  out.top.copy(a.top).lerp(b.top, t);
  out.bot.copy(a.bot).lerp(b.bot, t);
  out.day = a.day + (b.day - a.day) * t;
  out.dusk = a.dusk + (b.dusk - a.dusk) * t;
  out.stars = a.stars + (b.stars - a.stars) * t;
  out.starTint.copy(a.starTint).lerp(b.starTint, t);
  out.water = a.water + (b.water - a.water) * t;
  out.clouds = a.clouds + (b.clouds - a.clouds) * t;
  out.exposure = a.exposure + (b.exposure - a.exposure) * t;
  out.bg.copy(a.bg).lerp(b.bg, t);
  return out;
}

// ---------------- cibles par phase ----------------
var TARGETS = {
  // countdown / firstrocket : JOUR — ciel bleu clair et lumineux, soleil,
  // nuages légers. (tension chaude ambrée gérée par fxMode, jamais violet)
  day: { fog: '#b5ddec', fogD: 0.00038, sun: '#fff3d6', sunI: 2.35,
    hSky: '#d9f5ff', hGnd: '#718450', hemiI: 2.05, fill: '#79d8e6', fillI: 0.34,
    top: '#2a8cd6', bot: '#d8f2f5', day: 1.00, dusk: 0.02,
    stars: 0.0, water: 1.00, clouds: 0.77, exposure: 1.10, bg: '#8fc3d4' },
  // sixrockets : le ciel S'ASSOMBRIT progressivement (transition jour->nuit).
  daynight: { fog: '#2a3a66', fogD: 0.0012, sun: '#ffd9a8', sunI: 2.00,
    hSky: '#5a7ab8', hGnd: '#2a3040', hemiI: 1.50, fill: '#5a7ab8', fillI: 0.25,
    top: '#0e1e44', bot: '#4a5a8a', day: 0.35, dusk: 0.55,
    stars: 0.18, starTint: '#dbeaff', water: 0.60, clouds: 0.50,
    exposure: 1.00, bg: '#16244a' },
  // convergence -> meteorsix : NUIT — ciel noir étoilé dense + pleine lune.
  // La lumière directionnelle devient un clair de lune bleu-blanc froid.
  night: { fog: '#05070f', fogD: 0.0008, sun: '#e8f0ff', sunI: 1.15,
    hSky: '#2a3a66', hGnd: '#060a14', hemiI: 0.85, fill: '#4a6aa8', fillI: 0.14,
    top: '#02040a', bot: '#0a1226', day: 0.00, dusk: 0.00,
    stars: 1.00, starTint: '#dbeaff', water: 0.50, clouds: 0.15,
    exposure: 1.05, bg: '#02040a' },
  // impact : le fond reste un ciel étoilé (le flash blanc/bleu est géré
  // à part via 'meteor:hit').
  impactnight: { fog: '#05070f', fogD: 0.0008, sun: '#e8f0ff', sunI: 1.15,
    hSky: '#2a3a66', hGnd: '#060a14', hemiI: 0.85, fill: '#4a6aa8', fillI: 0.14,
    top: '#02040a', bot: '#0a1226', day: 0.00, dusk: 0.00,
    stars: 1.00, starTint: '#dbeaff', water: 0.50, clouds: 0.15,
    exposure: 1.05, bg: '#02040a' },
  // contraction : assombrissement progressif.
  contraction: { fog: '#04060c', fogD: 0.0012, sun: '#c8d8f0', sunI: 0.80,
    hSky: '#1a2440', hGnd: '#04060c', hemiI: 0.55, fill: '#2a3a66', fillI: 0.08,
    top: '#010208', bot: '#060a18', day: 0.00, dusk: 0.00,
    stars: 0.70, starTint: '#dbeaff', water: 0.30, clouds: 0.08,
    exposure: 0.85, bg: '#010208' },
  // collapse : vers le noir.
  collapse: { fog: '#010102', fogD: 0.0018, sun: '#8899bb', sunI: 0.25,
    hSky: '#0a0e1c', hGnd: '#010102', hemiI: 0.25, fill: '#1a2440', fillI: 0.04,
    top: '#000000', bot: '#030408', day: 0.00, dusk: 0.00,
    stars: 0.30, starTint: '#dbeaff', water: 0.10, clouds: 0.00,
    exposure: 0.55, bg: '#000000' },
  // growth -> numbers : noir quasi absolu (respiration bleue lointaine
  // ajoutée par fxMode 'bhblue', le trou noir gère sa propre lueur).
  black: { fog: '#000000', fogD: 0.0022, sun: '#000000', sunI: 0.00,
    hSky: '#000000', hGnd: '#000000', hemiI: 0.00, fill: '#000000', fillI: 0.00,
    top: '#000000', bot: '#000000', day: 0.00, dusk: 0.00,
    stars: 0.06, starTint: '#dbeaff', water: 0.05, clouds: 0.00,
    exposure: 0.30, bg: '#000000' },
  // end : noir total.
  voidblack: { fog: '#000000', fogD: 0.0022, sun: '#000000', sunI: 0.00,
    hSky: '#000000', hGnd: '#000000', hemiI: 0.00, fill: '#000000', fillI: 0.00,
    top: '#000000', bot: '#000000', day: 0.00, dusk: 0.00,
    stars: 0.00, starTint: '#dbeaff', water: 0.00, clouds: 0.00,
    exposure: 0.25, bg: '#000000' }
};

// Flash blanc total de l'impact (~1,5 s) : tout blanc, sun x5.
var WHITE_FLASH = { fog: '#ffffff', fogD: 0.0006, sun: '#ffffff', sunI: 13.0,
  hSky: '#ffffff', hGnd: '#ffffff', hemiI: 4.00, fill: '#ffffff', fillI: 1.50,
  top: '#ffffff', bot: '#ffffff', day: 1.00, dusk: 0.00,
  stars: 0.00, water: 1.00, clouds: 0.70, exposure: 3.00, bg: '#ffffff' };

var COLOR_KEYS = ['fog', 'sun', 'hSky', 'hGnd', 'fill', 'top', 'bot', 'bg', 'starTint'];
var NUM_KEYS = ['fogD', 'sunI', 'hemiI', 'fillI', 'day', 'dusk', 'stars', 'water', 'clouds', 'exposure'];

// Construit un état complet à partir d'une définition partielle.
function makeTarget(def) {
  var s = newState();
  for (var i = 0; i < COLOR_KEYS.length; i++) {
    var k = COLOR_KEYS[i];
    if (def[k] !== undefined) s[k].set(def[k]);
  }
  for (var j = 0; j < NUM_KEYS.length; j++) {
    var k2 = NUM_KEYS[j];
    if (def[k2] !== undefined) s[k2] = def[k2];
  }
  return s;
}

// Lance un fondu doux vers la cible (pas de coupure brutale).
function lerpSky(target, dur) {
  if (disposed || !cur || !target) return;
  blendFrom = newState();
  copyState(blendFrom, cur);
  blendTo = target;
  blendT = 0;
  blendDur = Math.max(0.1, dur || 4);
}

// ---------------- champ d'étoiles dense + lune + aurores boréales ----------------
// Visibilité des aurores par phase (pas de temps absolu en dur) :
// loop -> meteorsix en rideaux ondulants qui balaient le ciel,
// vert émeraude + bleu cyan, JAMAIS violet.
var AURORA_PHASES = {
  countdown: 0, firstrocket: 0, sixrockets: 0.15, convergence: 0.35,
  loop: 0.9, acceleration: 0.7, silence: 0.15, strike: 0.55,
  thrown: 0, greatrift: 1.0, meteorsix: 0.7, descent: 0.4, veeroff: 0.2,
  impact: 0.3, contraction: 0, collapse: 0, black: 0, end: 0
};

// Visibilité de la pleine lune par phase : apparaît avec la nuit,
// disparaît dans le noir final.
var MOON_PHASES = {
  countdown: 0, firstrocket: 0, sixrockets: 0.5, convergence: 1.0,
  loop: 1.0, acceleration: 1.0, silence: 1.0, strike: 1.0,
  thrown: 1.0, greatrift: 1.0, meteorsix: 1.0, descent: 1.0, veeroff: 1.0,
  impact: 1.0, contraction: 0.6, collapse: 0.35, black: 0, end: 0
};

// Shader des rubans d'aurores : bandes vert émeraude / bleu cyan ondulant
// lentement et balayant le ciel.
var AURORA_VERT = [
  'varying vec2 vUv;',
  'uniform float uTime;',
  'uniform float uSeed;',
  'void main() {',
  '  vUv = uv;',
  '  vec3 p = position;',
  '  float w = sin(uv.x * 9.0 + uTime * 0.7 + uSeed)',
  '          + 0.5 * sin(uv.x * 23.0 - uTime * 1.1 + uSeed * 2.0);',
  '  p.y += w * 55.0;',
  '  p.z += 0.4 * sin(uv.x * 14.0 + uTime * 0.9 + uSeed) * 60.0;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
  '}'
].join('\n');

var AURORA_FRAG = [
  'varying vec2 vUv;',
  'uniform float uTime;',
  'uniform float uIntensity;',
  'uniform float uSeed;',
  'uniform vec3 uColorLow;',
  'uniform vec3 uColorHigh;',
  'void main() {',
  '  float wave = 0.5 + 0.5 * sin(vUv.x * 11.0 + uTime * 0.8 + uSeed',
  '      + 1.6 * sin(vUv.x * 4.0 - uTime * 0.55 + uSeed));',
  '  float band = smoothstep(0.02, 0.30, vUv.y) * (1.0 - smoothstep(0.52, 0.98, vUv.y));',
  '  float rays = 0.60 + 0.40 * sin(vUv.x * 46.0 + uTime * 1.4 + uSeed * 3.0 + wave * 4.0);',
  '  float edge = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));',
  '  float a = band * (0.30 + 0.70 * wave) * rays * edge * uIntensity * 0.60;',
  '  vec3 col = mix(uColorLow, uColorHigh, clamp(vUv.y * 1.4, 0.0, 1.0));',
  '  gl_FragColor = vec4(col, a);',
  '}'
].join('\n');

function buildStarField() {
  var N = 400; // < 500 particules, pas de post-processing
  var pos = new Float32Array(N * 3);
  var col = new Float32Array(N * 3);
  var R = 1600;
  var c = new T.Color();
  for (var i = 0; i < N; i++) {
    var az = Math.random() * Math.PI * 2;
    var el = (10 + Math.random() * 75) * Math.PI / 180; // 10°..85° d'élévation
    var r = R * (0.96 + Math.random() * 0.08);
    pos[i * 3] = Math.cos(az) * Math.cos(el) * r;
    pos[i * 3 + 1] = Math.sin(el) * r;
    pos[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
    // teintes blanc / bleu clair / blanc chaud
    var pick = Math.random();
    if (pick < 0.55) c.set(0xffffff);
    else if (pick < 0.85) c.set(0xd8eaff);
    else c.set(0xfff2dc);
    c.multiplyScalar(0.7 + Math.random() * 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  var g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  var m = new T.PointsMaterial({
    size: 2.6, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0, depthWrite: false, fog: false
  });
  starField = new T.Points(g, m);
  starField.frustumCulled = false;
  starField.renderOrder = 90;
  starField.visible = false;
  view.scene.add(starField);
}

// Pleine lune brillante : sprite généré localement (canvas, aucun réseau).
function buildMoon() {
  var size = 128;
  var cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  var ctx = cv.getContext('2d');
  var grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.10,
    size / 2, size / 2, size * 0.50);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(240,246,255,1)');
  grd.addColorStop(0.45, 'rgba(220,232,255,0.9)');
  grd.addColorStop(0.65, 'rgba(180,205,255,0.25)');
  grd.addColorStop(1.0, 'rgba(160,190,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  moonTex = new T.CanvasTexture(cv);
  var mat = new T.SpriteMaterial({
    map: moonTex, transparent: true, opacity: 0,
    depthWrite: false, fog: false
  });
  moonSprite = new T.Sprite(mat);
  moonSprite.position.set(700, 1150, -1400);
  moonSprite.scale.set(300, 300, 1);
  moonSprite.renderOrder = 89;
  moonSprite.visible = false;
  view.scene.add(moonSprite);
}

function buildAuroras() {
  auroraGroup = new T.Group();
  var defs = [
    { x: 0,     y: 620, z: -1500, seed: 0.0, low: '#2bff9d', high: '#3fb6ff' },
    { x: 1400,  y: 700, z: 400,   seed: 2.1, low: '#37f5a0', high: '#4ad0ff' },
    { x: -1350, y: 660, z: 700,   seed: 4.4, low: '#2bff9d', high: '#35c8ff' }
  ];
  for (var i = 0; i < defs.length; i++) {
    var d = defs[i];
    var mat = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: Math.random() * 100 },
        uIntensity: { value: 0 },
        uSeed: { value: d.seed },
        uColorLow: { value: new T.Color(d.low) },
        uColorHigh: { value: new T.Color(d.high) }
      },
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide
    });
    var mesh = new T.Mesh(new T.PlaneGeometry(2600, 460, 72, 6), mat);
    mesh.position.set(d.x, d.y, d.z);
    mesh.lookAt(0, 300, 0);
    mesh.frustumCulled = false;
    mesh.renderOrder = 91;
    auroraMats.push(mat);
    auroraGroup.add(mesh);
  }
  auroraGroup.visible = false;
  view.scene.add(auroraGroup);
}

// v15 : ÉCLAIRS RAMIFIÉS — tronc en zigzag + branches, ruban additif
// blanc-bleu, déclenchés en DOUBLE FRAPPE pendant les phases critiques.
function boltGeometry() {
  var posArr = [], idx = [], vbase = 0;
  function ribbon(pts, w) {
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var q = pts[Math.min(pts.length - 1, i + 1)];
      var r = pts[Math.max(0, i - 1)];
      var dx = q[0] - r[0], dy = q[1] - r[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len * w / 2, ny = dx / len * w / 2;
      posArr.push(p[0] + nx, p[1] + ny, 0, p[0] - nx, p[1] - ny, 0);
      if (i < pts.length - 1) {
        var a = vbase + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    vbase += pts.length * 2;
  }
  // tronc : zigzag vertical descendant
  var trunk = [], x = 0, y = 1500;
  trunk.push([x, y]);
  for (var i = 0; i < 7; i++) {
    x += (Math.random() - 0.5) * 260;
    y -= 150 + Math.random() * 80;
    trunk.push([x, y]);
  }
  ribbon(trunk, 16);
  // 2 branches latérales
  for (var b = 0; b < 2; b++) {
    var s0 = trunk[2 + b * 2];
    var br = [[s0[0], s0[1]]];
    var bx = s0[0], by = s0[1];
    var dir = (b === 0) ? 1 : -1;
    for (var j = 0; j < 4; j++) {
      bx += dir * (60 + Math.random() * 90);
      by -= 70 + Math.random() * 60;
      br.push([bx, by]);
    }
    ribbon(br, 8);
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(posArr), 3));
  geo.setIndex(idx);
  return geo;
}

function buildBolts() {
  boltGroup = new T.Group();
  boltMeshes = [];
  var spots = [
    { x: -900, y: 0, z: -1200, ry: 0.4 },
    { x: 1100, y: 0, z: -600, ry: -0.5 },
    { x: 200, y: 0, z: 1300, ry: 2.6 }
  ];
  for (var i = 0; i < spots.length; i++) {
    var mat = new T.MeshBasicMaterial({
      color: 0xd8e8ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false,
      side: T.DoubleSide
    });
    var mesh = new T.Mesh(boltGeometry(), mat);
    mesh.position.set(spots[i].x, spots[i].y, spots[i].z);
    mesh.rotation.y = spots[i].ry;
    mesh.frustumCulled = false;
    mesh.renderOrder = 92;
    mesh.visible = false;
    boltGroup.add(mesh);
    boltMeshes.push({ mesh: mesh, mat: mat, age: 99, dur: 0.5 });
  }
  boltGroup.visible = true;
  view.scene.add(boltGroup);
}

// Intensité orageuse par phase critique (pas de temps absolu en dur).
var STORM_PHASES = {
  strike: 1.0, greatrift: 0.9, meteorsix: 0.7, descent: 0.6,
  veeroff: 0.5, impact: 0.45, loop: 0.35, acceleration: 0.3,
  convergence: 0.25
};

// v22 : TEINTE DE TENSION phase par phase — le ciel RACONTE la montée de
// l'événement : l'horizon rougeoie de plus en plus (braise, jamais violet)
// jusqu'à l'impact, puis retombe dans le noir. Piloté par les transitions
// de phase uniquement (aucun temps absolu).
var HEAT_PHASES = {
  countdown: 0, firstrocket: 0.45, sixrockets: 0.65, convergence: 0.35,
  loop: 0.3, acceleration: 0.5, silence: 0.08, strike: 0.55,
  thrown: 0.75, greatrift: 0.6, meteorsix: 0.65, descent: 0.85,
  veeroff: 1.0, impact: 1.0, contraction: 0.3, collapse: 0.12,
  growth: 0, destruction: 0, playersucked: 0, allgone: 0,
  blackhole: 0, numbers: 0, end: 0
};

// v22 : ÉCLAIRS CHORÉGRAPHIÉS — un balayage de 3 éclairs (gauche -> droite,
// 0,13 s d'intervalle) déclenché sur les temps forts (entrée de 'strike',
// ondes de choc majeures). La file est allouée uniquement sur événement,
// jamais par frame.
function queueBoltSweep() {
  if (!boltGroup || boltMeshes.length < 3) return;
  for (var i = 0; i < 3 && i < boltMeshes.length; i++) {
    boltQueue.push({ t: i * 0.13, idx: i });
  }
  boltFlash = Math.max(boltFlash, 0.75);
}

function updateBoltQueue(dt) {
  if (!boltQueue.length || !boltGroup) return;
  for (var i = boltQueue.length - 1; i >= 0; i--) {
    var q = boltQueue[i];
    q.t -= dt;
    if (q.t <= 0) {
      var b = boltMeshes[q.idx % boltMeshes.length];
      b.age = 0;
      b.dur = 0.42 + Math.random() * 0.2;
      boltQueue.splice(i, 1);
    }
  }
}

// v15 : orage critique — les éclairs ramifiés frappent en DOUBLE FRAPPE,
// de plus en plus fréquents quand l'intensité monte ; le ciel flashe en sync.
function updateStorm(dt) {
  var target = STORM_PHASES[phaseName] || 0;
  stormK += (target - stormK) * Math.min(1, dt * 1.2);
  if (Math.abs(target - stormK) < 0.01) stormK = target;
  boltFlash = Math.max(0, boltFlash - dt * 3.2);
  if (stormK > 0.03 && boltGroup) {
    boltClock -= dt;
    // v20 — VOLÉE D'ÉCLAIRS (meteor:hit) : les 3 éclairs ramifiés frappent
    // EN MÊME TEMPS (triple frappe) — la décharge est massive, pas isolée.
    if (boltVolley > 0) {
      for (var vi = 0; vi < boltMeshes.length; vi++) {
        boltMeshes[vi].age = 0;
        boltMeshes[vi].dur = 0.42 + Math.random() * 0.2;
      }
      boltFlash = Math.min(1, 0.7 + stormK * 0.3);
      boltVolley--;
    } else if (boltClock <= 0) {
      // déclenche 1 à 2 éclairs en double frappe
      var n = (stormK > 0.7 && Math.random() < 0.5) ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var b = boltMeshes[Math.floor(Math.random() * boltMeshes.length)];
        b.age = 0;
        b.dur = 0.42 + Math.random() * 0.2;
      }
      boltFlash = Math.min(1, 0.45 + stormK * 0.55);
      boltClock = (2.6 - 2.1 * stormK) * (0.6 + Math.random() * 0.8);
    }
  }
  updateBoltQueue(dt); // v22 : balayages chorégraphiés (temps forts)
  var peak = 0;
  for (var j = 0; j < boltMeshes.length; j++) {
    var bj = boltMeshes[j];
    if (bj.age >= bj.dur) { bj.mesh.visible = false; bj.mat.opacity = 0; continue; }
    bj.age += dt;
    var k = Math.min(1, bj.age / bj.dur);
    // DOUBLE FRAPPE : flash franc, micro-coupure, second flash, extinction.
    var op;
    if (k < 0.18) op = 1;
    else if (k < 0.30) op = 0.12;
    else if (k < 0.52) op = 0.9;
    else op = 0.9 * (1 - (k - 0.52) / 0.48);
    bj.mat.opacity = op * (0.5 + 0.5 * stormK);
    bj.mesh.visible = op > 0.01;
    if (op > peak) peak = op;
  }
  // le ciel flashe en synchronisation avec les éclairs
  if (peak > 0.01 || boltFlash > 0.01) {
    var fk = Math.max(peak, boltFlash * 0.8) * (0.4 + 0.6 * stormK);
    if (reduceFlashes) fk *= 0.1;
    applied.exposure *= (1 + 0.35 * fk);
    applied.sunI *= (1 + 0.6 * fk);
    applied.top.lerp(tmpA.set('#cfe0ff'), 0.08 * fk);
    applied.fog.lerp(tmpB.set('#9fb4e8'), 0.07 * fk);
  }
}

// v21 : pluie d'étoiles filantes (phases 'blackhole'/'numbers').
function buildStreaks() {
  if (streakSys || !view || !view.scene) return;
  var pos = new Float32Array(STREAK_N * 3);
  for (var i = 0; i < STREAK_N; i++) pos[i * 3 + 1] = -10000; // hors vue
  var g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  var m = new T.PointsMaterial({
    color: 0xcfe4ff, size: 3.4, sizeAttenuation: false,
    transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });
  var p = new T.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 93;
  p.visible = false;
  view.scene.add(p);
  streakSys = {
    points: p, mat: m, pos: pos,
    vel: new Float32Array(STREAK_N * 3),
    life: new Float32Array(STREAK_N),
    cursor: 0
  };
}

function spawnStreak() {
  var s = streakSys;
  if (!s) return;
  var i = s.cursor;
  s.cursor = (s.cursor + 1) % STREAK_N;
  var i3 = i * 3;
  var az = Math.random() * Math.PI * 2;
  var el = (25 + Math.random() * 55) * Math.PI / 180;
  var R = 1400;
  var sx = Math.cos(az) * Math.cos(el) * R;
  var sy = Math.sin(el) * R;
  var sz = Math.sin(az) * Math.cos(el) * R;
  s.pos[i3] = sx;
  s.pos[i3 + 1] = sy;
  s.pos[i3 + 2] = sz;
  // v22 : la traînée PLONGE vers le Point Zéro (le cosmos se vide DANS le
  // trou noir), pas simplement vers le bas.
  var dx = streakTarget.x - sx, dy = streakTarget.y - sy, dz = streakTarget.z - sz;
  var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  var spd = 260 + Math.random() * 260;
  s.vel[i3] = dx / dl * spd;
  s.vel[i3 + 1] = dy / dl * spd;
  s.vel[i3 + 2] = dz / dl * spd;
  s.life[i] = 0.7 + Math.random() * 0.5;
}

function updateStreaks(dt) {
  if (!streakSys) return;
  var s = streakSys;
  // v22 : étendues à 'collapse'/'growth' — le cosmos se vide dès que le
  // trou noir naît ; elles visent le Point Zéro (api.center, repli origine).
  var show = (phaseName === 'collapse' || phaseName === 'growth' ||
              phaseName === 'blackhole' || phaseName === 'numbers');
  if (api && api.center && isFinite(api.center.x)) {
    streakTarget.x = api.center.x;
    streakTarget.y = api.center.y + 25;
    streakTarget.z = api.center.z;
  }
  if (show) {
    streakAcc += dt;
    // v22 : cadence réduite sur mobile ; le vide s'accélère pendant 'numbers'.
    var rate = (api && api.isMobile) ? 0.30 : 0.16;
    if (phaseName === 'numbers') rate *= 0.6;
    while (streakAcc > rate) {
      streakAcc -= rate;
      spawnStreak();
    }
  } else {
    streakAcc = 0;
  }
  var any = false;
  for (var i = 0; i < STREAK_N; i++) {
    if (s.life[i] <= 0) continue;
    s.life[i] -= dt;
    var i3 = i * 3;
    if (s.life[i] <= 0) { s.pos[i3 + 1] = -10000; continue; }
    s.pos[i3] += s.vel[i3] * dt;
    s.pos[i3 + 1] += s.vel[i3 + 1] * dt;
    s.pos[i3 + 2] += s.vel[i3 + 2] * dt;
    any = true;
  }
  s.points.geometry.attributes.position.needsUpdate = true;
  s.points.visible = any;
  var target = (show && any) ? 0.9 : 0;
  var op = s.mat.opacity + (target - s.mat.opacity) * Math.min(1, dt * 3);
  s.mat.opacity = op;
}

function disposeStreaks() {
  if (streakSys && view && view.scene) view.scene.remove(streakSys.points);
  if (streakSys) {
    streakSys.points.geometry.dispose();
    streakSys.points.material.dispose();
  }
  streakSys = null;
  streakAcc = 0;
}

// Crée les effets visuels propres au module (appelé une fois, dans setupView).
function buildSkyFx() {
  if (starField || moonSprite || auroraGroup || boltGroup || !view || !view.scene) return;
  buildStarField();
  buildMoon();
  buildAuroras();
  buildBolts(); // v15 : éclairs ramifiés (phases critiques)
  buildStreaks(); // v21 : étoiles filantes (trou noir)
}

// Supprime les effets visuels propres au module (restauration exacte).
function disposeSkyFx() {
  disposeStreaks(); // v21 : étoiles filantes
  if (auroraGroup && view && view.scene) view.scene.remove(auroraGroup);
  if (auroraGroup) {
    for (var i = 0; i < auroraMats.length; i++) auroraMats[i].dispose();
    auroraGroup.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  }
  auroraGroup = null; auroraMats = [];
  // v15 : éclairs ramifiés.
  if (boltGroup && view && view.scene) view.scene.remove(boltGroup);
  if (boltGroup) {
    for (var bi = 0; bi < boltMeshes.length; bi++) {
      boltMeshes[bi].mesh.geometry.dispose();
      boltMeshes[bi].mat.dispose();
    }
  }
  boltGroup = null; boltMeshes = [];
  if (moonSprite && view && view.scene) view.scene.remove(moonSprite);
  if (moonSprite && moonSprite.material) moonSprite.material.dispose();
  if (moonTex) moonTex.dispose();
  moonSprite = null; moonTex = null;
  if (starField && view && view.scene) view.scene.remove(starField);
  if (starField) { starField.geometry.dispose(); starField.material.dispose(); }
  starField = null;
  auroraK = 0; auroraTarget = 0;
  moonK = 0; moonTarget = 0; moonPopT = 1;
  moonPull = 0; moonPullTarget = 0; // v17 : réarmé (restart propre)
}

// ---------------- sauvegarde / restauration ----------------
function saveOriginals() {
  var s = view.scene;
  orig = {
    fog: s.fog ? s.fog.color.clone() : null, fogD: s.fog ? s.fog.density : 0,
    sun: view.sun ? view.sun.color.clone() : null, sunI: view.sun ? view.sun.intensity : 0,
    hSky: view.hemi ? view.hemi.color.clone() : null,
    hGnd: view.hemi ? view.hemi.groundColor.clone() : null,
    hemiI: view.hemi ? view.hemi.intensity : 0,
    fill: view.skyFill ? view.skyFill.color.clone() : null,
    fillI: view.skyFill ? view.skyFill.intensity : 0,
    exposure: view.renderer ? view.renderer.toneMappingExposure : 1,
    bg: s.background && s.background.isColor ? s.background.clone() : null,
    bgRaw: ('background' in s) ? s.background : null,
    env: null, stars: null, water: undefined, clouds: undefined
  };
  var env = view.environment;
  if (env && env.skyUniforms) {
    var sunV = env.skyUniforms.sun.value;
    orig.env = {
      top: env.skyUniforms.top.value.clone(),
      bot: env.skyUniforms.bottom.value.clone(),
      day: env.skyUniforms.daylight.value,
      dusk: env.skyUniforms.dusk.value,
      // clone défensif : au cas où ce ne serait pas un Vector3
      sunDir: (sunV && typeof sunV.clone === 'function') ? sunV.clone() : { x: sunV.x, y: sunV.y, z: sunV.z }
    };
  }
  if (env && env.stars) {
    orig.stars = { op: env.stars.material.opacity, tint: env.stars.material.color.clone() };
  }
  if (env && env.waterUniforms) orig.water = env.waterUniforms.light.value;
  if (env && env.cloudMaterial) orig.clouds = env.cloudMaterial.opacity;
}

// État "jeu normal" : valeurs d'origine, ciel et eau CLairs et lumineux.
function buildOrigState() {
  var s = newState();
  if (orig.fog) { s.fog.copy(orig.fog); s.fogD = orig.fogD; }
  if (orig.sun) { s.sun.copy(orig.sun); s.sunI = orig.sunI; }
  if (orig.hSky) { s.hSky.copy(orig.hSky); s.hemiI = orig.hemiI; }
  if (orig.hGnd) s.hGnd.copy(orig.hGnd);
  if (orig.fill) { s.fill.copy(orig.fill); s.fillI = orig.fillI; }
  s.exposure = orig.exposure;
  if (orig.bg) s.bg.copy(orig.bg);
  if (orig.env) {
    s.top.copy(orig.env.top); s.bot.copy(orig.env.bot);
    s.day = orig.env.day; s.dusk = orig.env.dusk;
  }
  if (orig.stars) { s.stars = orig.stars.op; s.starTint.copy(orig.stars.tint); }
  if (orig.water !== undefined) s.water = orig.water;
  if (orig.clouds !== undefined) s.clouds = orig.clouds;
  return s;
}

function restoreOriginals() {
  if (!view || !orig) return;
  var s = view.scene;
  if (s.fog && orig.fog) { s.fog.color.copy(orig.fog); s.fog.density = orig.fogD; }
  if (view.sun && orig.sun) { view.sun.color.copy(orig.sun); view.sun.intensity = orig.sunI; }
  if (view.hemi && orig.hSky) {
    view.hemi.color.copy(orig.hSky);
    if (orig.hGnd) view.hemi.groundColor.copy(orig.hGnd);
    view.hemi.intensity = orig.hemiI;
  }
  if (view.skyFill && orig.fill) { view.skyFill.color.copy(orig.fill); view.skyFill.intensity = orig.fillI; }
  if (view.renderer) view.renderer.toneMappingExposure = orig.exposure;
  // Restauration EXACTE du background : l'objet d'origine lui-même
  // (identité préservée — texture ou Color), jamais null par défaut.
  s.background = orig.bgRaw;
  var env = view.environment;
  if (env && env.worldV2 && orig.v27Art) {
    env.sky.visible = orig.v27Art.originalSky;
    env.worldV2.sky.visible = orig.v27Art.artSky;
    env.worldV2.ridges.visible = orig.v27Art.ridges;
    env.worldV2.clouds.visible = orig.v27Art.cloudsVisible;
    env.worldV2.clouds.material.opacity = orig.v27Art.clouds;
    env.worldV2Water.day.value = orig.v27Art.water;
    env.water.material.fragmentShader = orig.v27Art.waterShader;
    env.water.material.needsUpdate = true;
  }
  if (env && env.skyUniforms && orig.env) {
    env.skyUniforms.top.value.copy(orig.env.top);
    env.skyUniforms.bottom.value.copy(orig.env.bot);
    env.skyUniforms.daylight.value = orig.env.day;
    env.skyUniforms.dusk.value = orig.env.dusk;
    var sv = env.skyUniforms.sun.value, sd = orig.env.sunDir;
    if (sv && typeof sv.copy === 'function') sv.copy(sd);
    else if (sv) { sv.x = sd.x; sv.y = sd.y; sv.z = sd.z; }
  }
  if (env && env.stars && orig.stars) {
    env.stars.material.opacity = orig.stars.op;
    env.stars.material.color.copy(orig.stars.tint);
  }
  if (env && env.waterUniforms && orig.water !== undefined) env.waterUniforms.light.value = orig.water;
  if (env && env.cloudMaterial && orig.clouds !== undefined) env.cloudMaterial.opacity = orig.clouds;
}

// ---------------- application sur la scène ----------------
// Appelé depuis le wrapper view.update(), juste après que le jeu a écrit
// ses valeurs du jour et juste avant le rendu.
function applySky() {
  var s = view.scene;
  if (!s || !applied) return;
  if (s.fog) { s.fog.color.copy(applied.fog); s.fog.density = applied.fogD; }
  if (view.sun) { view.sun.color.copy(applied.sun); view.sun.intensity = applied.sunI; }
  if (view.hemi) {
    view.hemi.color.copy(applied.hSky);
    view.hemi.groundColor.copy(applied.hGnd);
    view.hemi.intensity = applied.hemiI;
  }
  if (view.skyFill) { view.skyFill.color.copy(applied.fill); view.skyFill.intensity = applied.fillI; }
  s.background = applied.bg;
  var env = view.environment;
  if (env && env.worldV2 && env.sky) {
    if (!orig.v27Art) {
      orig.v27Art = {
        originalSky: env.sky.visible,
        artSky: env.worldV2.sky.visible,
        ridges: env.worldV2.ridges.visible,
        cloudsVisible: env.worldV2.clouds.visible,
        clouds: env.worldV2.clouds.material.opacity,
        water: env.worldV2Water.day.value,
        waterShader: env.water.material.fragmentShader
      };
      env.water.material.fragmentShader = orig.v27Art.waterShader.replace(
        'smoothstep(481.,505.,shore)',
        'smoothstep(481.,505.,shore)*(1.-smoothstep(550.,640.,shore))'
      );
      env.water.material.needsUpdate = true;
    }
    env.sky.visible = true;
    env.worldV2.sky.visible = false;
    env.worldV2.ridges.visible = false;
    env.worldV2.clouds.visible = applied.day > 0.1;
    env.worldV2.clouds.material.opacity = applied.clouds * 0.48;
    env.worldV2Water.day.value = applied.water;
  }
  if (env && env.skyUniforms) {
    env.skyUniforms.top.value.copy(applied.top);
    env.skyUniforms.bottom.value.copy(applied.bot);
    env.skyUniforms.daylight.value = applied.day;
    env.skyUniforms.dusk.value = applied.dusk;
  }
  if (env && env.stars) {
    env.stars.material.opacity = applied.stars;
    env.stars.material.color.copy(applied.starTint);
  }
  if (env && env.waterUniforms) env.waterUniforms.light.value = applied.water;
  if (env && env.cloudMaterial) env.cloudMaterial.opacity = applied.clouds;
  if (view.renderer) view.renderer.toneMappingExposure = applied.exposure;
}

root.AZEvent.applyEventSky = function () {
  if (!disposed && view && root.AZEvent.active) applySky();
};

function installWrapper() {
  if (!view || wrappedUpdate) return;
  origUpdate = view.update;
  var self = view;
  wrappedUpdate = function (w, p, dt, opts) {
    var r = origUpdate.call(self, w, p, dt, opts);
    if (!disposed && root.AZEvent && root.AZEvent.active) applySky();
    return r;
  };
  view.update = wrappedUpdate;
}

function removeWrapper() {
  // Retrait prudent : si un autre module a wrappé par-dessus le nôtre,
  // on ne casse pas sa chaîne (notre wrapper est de toute façon inerte
  // grâce au drapeau `disposed`).
  if (view && wrappedUpdate && view.update === wrappedUpdate) view.update = origUpdate;
  wrappedUpdate = null;
  origUpdate = null;
}

// ---------------- handlers du bus ----------------
function onPhase(s) {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  fxMode = null;
  phaseName = s; // v15 : phase courante (orage critique, étoiles du trou noir)
  lightningFlash = 0;
  glowPulse = 0; beatPulse = 0;
  contractK = 0; darkenK = 0;
  tensionK = 0; firstTick = 0; tickRemaining = -1;
  if (s === 'countdown') bhBlue = false; // redémarrage éventuel
  if (s === 'countdown') { moonPull = 0; moonPullTarget = 0; } // v17 : réarmé
  if (s === 'countdown' || s === 'firstrocket') {
    // JOUR : ciel bleu clair et lumineux, soleil, nuages légers.
    lerpSky(makeTarget(TARGETS.day), 4);
    fxMode = 'day';
    auroraTarget = AURORA_PHASES.countdown;
    moonTarget = MOON_PHASES.countdown;
  } else if (s === 'sixrockets') {
    // Le ciel S'ASSOMBRIT progressivement (transition jour -> nuit).
    lerpSky(makeTarget(TARGETS.daynight), 6);
    fxMode = 'nightfall';
    auroraTarget = AURORA_PHASES.sixrockets;
    moonTarget = MOON_PHASES.sixrockets;
  } else if (s === 'convergence' || s === 'loop' || s === 'acceleration') {
    // NUIT : ciel noir étoilé dense + pleine lune brillante.
    lerpSky(makeTarget(TARGETS.night), 5);
    fxMode = 'night';
    auroraTarget = (s === 'loop') ? AURORA_PHASES.loop :
                   (s === 'acceleration') ? AURORA_PHASES.acceleration :
                   AURORA_PHASES.convergence;
    moonTarget = MOON_PHASES.convergence;
  } else if (s === 'silence') {
    // Nuit calme et claire : étoiles + pleine lune, aurores qui s'effacent.
    lerpSky(makeTarget(TARGETS.night), 5);
    fxMode = 'night';
    auroraTarget = AURORA_PHASES.silence;
    moonTarget = MOON_PHASES.silence;
  } else if (s === 'strike') {
    // Tension maximale avant le CONTACT : nuit, clair de lune qui tremble.
    lerpSky(makeTarget(TARGETS.night), 4);
    fxMode = 'tension';
    auroraTarget = AURORA_PHASES.strike;
    moonTarget = MOON_PHASES.strike;
  } else if (s === 'thrown') {
    // Nuit, vue longue pendant que les joueurs flottent.
    lerpSky(makeTarget(TARGETS.night), 5);
    fxMode = 'nightbright';
    auroraTarget = AURORA_PHASES.thrown;
    moonTarget = MOON_PHASES.thrown;
  } else if (s === 'greatrift') {
    // Distorsion massive : nuit, aurores au maximum.
    lerpSky(makeTarget(TARGETS.night), 4);
    fxMode = 'vortex';
    auroraTarget = AURORA_PHASES.greatrift;
    moonTarget = MOON_PHASES.greatrift;
  } else if (s === 'meteorsix' || s === 'descent' || s === 'veeroff') {
    // Ciel de nuit lourd, pression oppressante.
    lerpSky(makeTarget(TARGETS.night), 5);
    fxMode = 'pressure';
    auroraTarget = (s === 'meteorsix') ? AURORA_PHASES.meteorsix :
                   (s === 'descent') ? AURORA_PHASES.descent :
                   AURORA_PHASES.veeroff;
    moonTarget = MOON_PHASES.meteorsix;
  } else if (s === 'impact') {
    // Le fond reste un ciel étoilé (flash géré à part via 'meteor:hit').
    lerpSky(makeTarget(TARGETS.impactnight), 2);
    fxMode = 'energynight';
    auroraTarget = AURORA_PHASES.impact;
    moonTarget = MOON_PHASES.impact;
  } else if (s === 'contraction') {
    // Assombrissement progressif vers le noir.
    lerpSky(makeTarget(TARGETS.contraction), 8); // v15 : fondu allongé
    fxMode = 'contract';
    auroraTarget = AURORA_PHASES.contraction;
    moonTarget = MOON_PHASES.contraction;
    moonPullTarget = 0.35; // v17 : le trou noir commence à tirer la lune
  } else if (s === 'collapse') {
    // Noir progressif.
    lerpSky(makeTarget(TARGETS.collapse), 9); // v15 : fondu allongé
    fxMode = 'darken';
    auroraTarget = AURORA_PHASES.collapse;
    moonTarget = MOON_PHASES.collapse;
    moonPullTarget = 0.8; // v17 : la lune s'étire vers le trou noir
  } else if (s === 'growth' || s === 'destruction' || s === 'playersucked' ||
             s === 'allgone' || s === 'blackhole' || s === 'numbers') {
    // Noir quasi absolu (le trou noir gère sa propre lueur).
    lerpSky(makeTarget(TARGETS.black), 10); // v15 : fondu allongé
    auroraTarget = AURORA_PHASES.black;
    moonTarget = MOON_PHASES.black;
    moonPullTarget = 1.0; // v17 : la lune est engloutie (invisible, cible 0)
  } else if (s === 'end') {
    // Noir total.
    lerpSky(makeTarget(TARGETS.voidblack), 8); // v15 : fondu allongé
    bhBlue = false;
    auroraTarget = AURORA_PHASES.end;
    moonTarget = MOON_PHASES.end;
    moonPullTarget = 0; // v17 : réarmé
  }
  // v22 : teinte de TENSION phase par phase (l'horizon rougeoie à mesure
  // que l'événement monte) + à l'entrée de 'strike', le ciel « charge » :
  // balayage chorégraphié de 3 éclairs avant le CONTACT.
  var daylight = s === 'countdown' || s === 'firstrocket';
  if (daylight) {
    lerpSky(makeTarget(TARGETS.day), s === 'countdown' ? 0.4 : 1.6);
    fxMode = s === 'countdown' || s === 'firstrocket' ? 'day' : 'daylight';
    auroraTarget = moonTarget = moonPullTarget = 0;
    bhBlue = false;
  } else if (s === 'allgone') {
    lerpSky(makeTarget(TARGETS.black), 2.8);
    fxMode = null;
  }
  // v32 : JOUR PARTOUT — demande utilisateur (pas de nuit). On force le ciel
  // de jour pour toutes les phases d'action ; seule la finale du trou noir
  // (blackhole / numbers / end) reste noire, le trou noir y est la lumière.
  if (s !== 'blackhole' && s !== 'numbers' && s !== 'end') {
    lerpSky(makeTarget(TARGETS.day), 2.5);
    fxMode = 'day';
    auroraTarget = moonTarget = moonPullTarget = 0;
    bhBlue = false;
  }
  heatTarget = (HEAT_PHASES[s] || 0) * (daylight ? 0.18 : 0.5);
  if (s === 'strike') queueBoltSweep();
}

// CONTACT : flash lumineux bref, bleu-blanc froid (lune électrique).
var reduceFlashes = typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
function onRocketImpact() {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  flash = reduceFlashes ? null : { t: 0, dur: 0.42, kind: 'strike' };
}

// IMPACT FINAL : flash blanc aveuglant, puis ciel d'énergie étoilé.
function onMeteorHit() {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  flash = reduceFlashes ? null : { t: 0, dur: 0.22, kind: 'white' };
  // v20 — VOLÉE D'ÉCLAIRS : à l'impact, les 3 éclairs ramifiés frappent en
  // même temps (triple frappe) et les aurores surréagissent — le ciel
  // ENTIER réagit au contact météorite/Point Zéro.
  boltVolley = 3;
  auroraKick = Math.max(auroraKick, 1.5);
}

function onCalm() {
  if (disposed) return;
  calmT = 0; // adoucit temporairement (géré dans update)
}

// Lueur des explosions : le ciel réagit aux ondes de choc (strike, mega).
function onShockwave(data) {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  var f = (data && typeof data.force === 'number') ? data.force : 0.5;
  glowPulse = Math.max(glowPulse, Math.max(0, Math.min(1, f)));
  auroraKick = Math.max(auroraKick, Math.max(0, Math.min(1.2, f))); // v20 : les aurores surréagissent aux ondes de choc
  // v16 : la TEINTE de la lueur suit la famille de l'événement — CHAUD
  // (feu) pour la météorite, FROID électrique pour le Point Zéro / failles.
  glowWarm = !!(data && typeof data.phase === 'string' && data.phase.indexOf('meteor') === 0);
  // v22 : sur les temps FORTS, le ciel « charge » — balayage chorégraphié
  // de 3 éclairs (phases orageuses uniquement, jamais dans le noir final).
  if (f >= 0.7 && (stormK > 0.05 || STORM_PHASES[phaseName])) queueBoltSweep();
}

// Un éclair lointain déchire la nuit à chaque traversée de faille.
// v21 : étendu à toutes les phases nocturnes (le ciel réagit aux failles
// même sous tension/pression — le ciel VIT avec l'événement).
function onRiftCross() {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  if (fxMode === 'nightfall' || fxMode === 'night' || fxMode === 'vortex' ||
      fxMode === 'tension' || fxMode === 'pressure' || fxMode === 'energynight' ||
      fxMode === 'nightbright') {
    lightningFlash = Math.max(lightningFlash, 0.30);
  }
}

// v21 : au décollage, le ciel S'EMBRASE brièvement — la lueur chaude du
// départ se lit sur tout le ciel (cause -> effet, jamais de coupure).
function onLiftoff() {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  glowPulse = Math.max(glowPulse, 1);
  glowWarm = true;
  burnK = Math.max(burnK, 1); // v22 : embrasement LENT du ciel (~25 s de braise)
}

// Pulsation bleue synchronisée aux battements d'aspiration.
function onSuctionBeat() {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  beatPulse = 1;
  auroraKick = 1; // v20 : les aurores PULSENT sur chaque temps d'aspiration
}

// Le trou noir est formé : le ciel respire en bleu jusqu'à la fin.
function onBlackholeFormed() {
  if (disposed) return;
  bhBlue = true;
  moonFlare = 1; // v22 : la lune est AVALÉE — dernier sursaut bleu-blanc dans le ciel
}

// v22 : chaque nombre affiché fait RÉPONDRE le ciel — un pouls bleu
// lointain (le cosmos accuse le coup, un par un, jamais expliqué).
function onNumberShow() {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  numSkyPulse = 1;
}

// Tension du compte à rebours pilotée par les ticks (aucun temps absolu).
function onCountdownTick(data) {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return;
  if (!data || typeof data.remaining !== 'number') return;
  if (firstTick <= 0) firstTick = Math.max(1, data.remaining);
  tickRemaining = Math.max(0, data.remaining);
}

// ---------------- API du module ----------------
function setupView() {
  if (view || !api) return;
  var v = (typeof api.view === 'function') ? api.view() : null;
  if (!v || !v.scene) return;
  view = v;
  saveOriginals();
  origState = buildOrigState();
  cur = buildOrigState(); // départ = valeurs live -> aucune coupure
  applied = newState();
  copyState(applied, cur);
  blendFrom = null; blendTo = null; blendT = 1;
  installWrapper();
  buildSkyFx(); // champ d'étoiles dense + pleine lune + aurores (nuit seulement)
}

function init(a) {
  disposed = false;
  api = a || {};
  T = api.T || root.THREE;
  if (!T) return; // THREE introuvable : module inerte
  tmpA = new T.Color();
  tmpB = new T.Color();
  WHITE_STATE = makeTarget(WHITE_FLASH);
  flash = null; calmT = 999; fxMode = null;
  phaseName = ''; moonGrow = 0; stormK = 0; boltClock = 0; boltFlash = 0; boltVolley = 0; // v15 (+v20)
  phaseHeat = 0; heatTarget = 0; burnK = 0; moonFlare = 0; numSkyPulse = 0; boltQueue.length = 0; // v22
  lightningT = 0; lightningFlash = 0;
  tensionK = 0; firstTick = 0; tickRemaining = -1;
  glowPulse = 0; beatPulse = 0; bhBlue = false;
  contractK = 0; darkenK = 0;
  setupView();
  if (view) installWrapper();
  if (!wired) {
    wired = true;
    var AZ = root.AZEvent;
    var phases = ['countdown', 'firstrocket', 'sixrockets', 'convergence',
      'loop', 'acceleration', 'silence', 'strike', 'thrown', 'greatrift',
      'meteorsix', 'descent', 'veeroff', 'impact', 'contraction',
      'collapse', 'growth', 'destruction', 'playersucked', 'allgone',
      'blackhole', 'numbers', 'end'];
    for (var i = 0; i < phases.length; i++) {
      (function (s) { AZ.on('phase:' + s, function () { onPhase(s); }); })(phases[i]);
    }
    AZ.on('rocket:impact', onRocketImpact);
    AZ.on('meteor:hit', onMeteorHit);
    AZ.on('calm', onCalm);
    AZ.on('shockwave', onShockwave);       // lueur des explosions -> ciel
    AZ.on('rift:cross', onRiftCross);       // éclairs synchronisés aux failles
    AZ.on('suction:beat', onSuctionBeat);   // pulsation bleue du trou noir
    AZ.on('blackhole:formed', onBlackholeFormed);
    AZ.on('countdown:tick', onCountdownTick);
    AZ.on('launchpad:liftoff', onLiftoff); // v21 : le ciel s'embrase au décollage
    AZ.on('number:show', onNumberShow); // v22 : le ciel répond à chaque nombre
  }
}

function update(dt, t) {
  if (disposed || !root.AZEvent || !root.AZEvent.active) return; // inactif hors event
  if (!view) { setupView(); if (!view) return; }
  dt = Math.min(dt || 0, 0.1);
  t = t || 0;

  // --- flashs (prioritaires, durées courtes) ---
  if (flash) {
    flash.t += dt;
    // v16 : le flash blanc d'impact RETOMBE PROGRESSIVEMENT (1,4 s de fondu
    // vers l'état courant) — jamais de coupure nette blanc -> nuit.
    if (flash.t >= flash.dur) {
      if (flash.kind === 'white') {
        flash.fade = (flash.fade || 0) + dt;
        if (flash.fade >= 1.4) flash = null;
      } else flash = null; // la cible de phase prend le relais
    }
  }

  // --- fondu doux vers la cible de phase (easing, ~2-8 s) ---
  if (blendT < 1 && blendFrom && blendTo) {
    blendT = Math.min(1, blendT + dt / blendDur);
    var e = blendT * blendT * (3 - 2 * blendT);
    lerpState(blendFrom, blendTo, e, cur);
  }

  calmT += dt;

  // v22 : la teinte de tension suit sa cible de phase en douceur, la
  // braise du décollage retombe lentement, le flare et le pouls décroissent.
  if (phaseHeat !== heatTarget) {
    phaseHeat += (heatTarget - phaseHeat) * Math.min(1, dt * 0.7);
    if (Math.abs(heatTarget - phaseHeat) < 0.004) phaseHeat = heatTarget;
  }
  burnK = Math.max(0, burnK - dt * 0.04);       // ~25 s de braise
  moonFlare = Math.max(0, moonFlare - dt * 2.5);
  numSkyPulse = Math.max(0, numSkyPulse - dt * 2.2);

  // --- état appliqué = courant + effets continus de phase ---
  copyState(applied, cur);

  if (fxMode === 'day') {
    // JOUR : tension chaude ambrée pilotée par les ticks du compte à rebours
    // (0 au premier tick, ~1 à zéro). Repli : rampe douce sur tState.
    var tickTarget = 0;
    if (firstTick > 0 && tickRemaining >= 0) {
      tickTarget = 1 - tickRemaining / firstTick;
    } else {
      tickTarget = Math.min(1, (root.AZEvent.tState || 0) / 10);
    }
    tickTarget = Math.max(0, Math.min(1, tickTarget));
    tensionK += (tickTarget - tensionK) * Math.min(1, dt * 2.5);
    var ck = tensionK * tensionK * (3 - 2 * tensionK);
    // Chaleur dorée qui monte doucement : jamais violet.
    applied.sun.lerp(tmpA.set('#ffdf9e'), ck * 0.35);
    applied.sunI += ck * 0.45;
    applied.dusk += ck * 0.15;
  } else if (fxMode === 'nightfall') {
    // Transition jour->nuit : le ciel s'assombrit progressivement pendant
    // le décollage, éclairs lointains bleu-blanc synchronisés aux failles.
    lightningT -= dt;
    if (lightningT <= 0) {
      lightningFlash = 0.22 + Math.random() * 0.15;
      lightningT = 1.2 + Math.random() * 3.2;
    }
    if (lightningFlash > 0) {
      lightningFlash -= dt;
      // v12 : l'éclair vibre (double frappe) au lieu d'un simple fondu.
      var lk = Math.max(0, lightningFlash / 0.3) * (0.65 + 0.35 * Math.sin(lightningFlash * 47));
      applied.exposure *= (1 + 1.1 * lk);
      applied.sunI *= (1 + 1.6 * lk);
      applied.top.lerp(tmpA.set('#dfe8ff'), 0.55 * lk);
      applied.fog.lerp(tmpB.set('#a8b8e8'), 0.35 * lk);
    }
  } else if (fxMode === 'night') {
    // Nuit calme et étoilée : léger scintillement lunaire.
    var np = (Math.sin(t * 1.3) + 1) / 2;
    applied.sunI += np * 0.12;
    applied.stars = Math.min(1, applied.stars + np * 0.05);
  } else if (fxMode === 'nightbright') {
    // Nuit légèrement plus lumineuse (vue longue, joueurs flottant).
    applied.exposure += 0.10;
    applied.sunI += 0.25;
  } else if (fxMode === 'tension') {
    // Tension maximale : le clair de lune "tremble" avant le CONTACT.
    // v12 : tremblement plus piqué (pics francs, creux marqués).
    var tk = Math.pow((Math.sin(t * 11) + 1) / 2, 1.5);
    applied.exposure += tk * 0.10;
    applied.sunI += tk * 0.45;
    applied.fog.lerp(tmpA.set('#16283e'), tk * 0.25); // bleu nuit froid
  } else if (fxMode === 'vortex') {
    // Tourbillons d'énergie BLEUS (jamais violets) : teinte qui tourne
    // lentement + pulsations.
    var vh = 0.05 * Math.sin(t * 0.9);
    applied.fog.offsetHSL(vh * 0.4, 0, 0);
    applied.top.offsetHSL(vh * 0.3, 0, 0);
    applied.bot.offsetHSL(vh * 0.3, 0, 0);
    var vp = (Math.sin(t * 3.1) + 1) / 2;
    applied.sunI += vp * 0.8;
    applied.hemiI += vp * 0.4;
    applied.stars = Math.min(1, applied.stars + vp * 0.15);
  } else if (fxMode === 'pressure') {
    // Ciel de nuit lourd : pulsation lente et oppressante.
    var pk = (Math.sin(t * 1.2) + 1) / 2;
    applied.sunI -= pk * 0.30;
    applied.exposure -= pk * 0.07;
    applied.fogD *= (1 + pk * 0.25);
    // v21 : pendant 'descent'/'veeroff', des LASERS ROUGES fins montent du
    // sol et se croisent sur la météorite — le ciel prend une teinte rouge
    // sombre (chaque phase a son identité, sans nouvelle histoire).
    if (phaseName === 'descent' || phaseName === 'veeroff') {
      var rk = pk * 0.38;
      applied.fog.lerp(tmpA.set('#3a0d12'), rk);
      applied.top.lerp(tmpB.set('#26060c'), rk);
    }
  } else if (fxMode === 'energynight') {
    // Le fond reste un ciel étoilé : scintillement intense, étoiles partout.
    var bk = (Math.sin(t * 7) + 1) / 2;
    applied.sunI += bk * 0.9;
    applied.exposure += bk * 0.25;
    applied.stars = 1.0;
    applied.starTint.lerp(tmpA.set('#ffffff'), 0.5 + bk * 0.5);
  } else if (fxMode === 'contract') {
    // La lumière se concentre puis s'assombrit progressivement
    // (rythme propre à la phase, pas de durée absolue héritée).
    // v15 : encore plus progressif + frémissement dramatique avant le noir.
    contractK = Math.min(1, contractK + dt / 8);
    var qk = contractK * contractK * (3 - 2 * contractK);
    applied.fog.lerp(tmpA.set('#0a0812'), qk * 0.7);
    applied.top.lerp(tmpB.set('#0a0812'), qk * 0.7);
    applied.sunI *= (1 - qk * 0.55);
    applied.exposure *= (1 - qk * 0.35);
    applied.exposure *= 1 + 0.035 * Math.sin(t * 13.7); // frémissement
  } else if (fxMode === 'darken') {
    // Noir progressif vers le noir absolu (rythme propre à la phase).
    // v15 : encore plus progressif (la nuit "s'enfonce").
    darkenK = Math.min(1, darkenK + dt / 8);
    var dk = darkenK * darkenK * (3 - 2 * darkenK);
    applied.fog.lerp(tmpA.set('#000000'), dk * 0.85);
    applied.top.lerp(tmpB.set('#000000'), dk * 0.85);
    applied.bot.lerp(tmpB, dk * 0.85);
    applied.sunI *= (1 - dk * 0.8);
    applied.hemiI *= (1 - dk * 0.8);
    applied.exposure *= (1 - dk * 0.55);
    applied.stars *= (1 - dk * 0.6);
  }

  // v15 : orage critique (éclairs ramifiés en double frappe).
  updateStorm(dt);

  // --- l'éclairage suit l'action ---
  if (glowPulse > 0) {
    // Lueur chaude des explosions (ondes de choc) : boost bref et décroissant.
    glowPulse = Math.max(0, glowPulse - dt * 0.9);
    var gk = glowPulse * glowPulse;
    applied.exposure *= (1 + 0.7 * gk);
    applied.sunI *= (1 + 1.0 * gk);
    // v16 : la TEINTE de la lueur suit la famille de l'événement — chaude
    // (feu) pour la météorite, froide électrique pour le Point Zéro / failles.
    applied.fog.lerp(tmpA.set(glowWarm ? '#ffd9b0' : '#cfe4ff'), 0.30 * gk);
    applied.top.lerp(tmpB.set(glowWarm ? '#e8c8a8' : '#d8e8ff'), 0.25 * gk);
  }
  // v22 : TENSION qui monte phase par phase — l'horizon rougeoie doucement
  // (braise, jamais violet), le soleil prend une teinte chaude : le ciel
  // RACONTE la montée de l'événement.
  if (phaseHeat > 0.01) {
    var hk = phaseHeat * phaseHeat;
    applied.bot.lerp(tmpA.set('#521a0c'), 0.38 * hk);
    applied.fog.lerp(tmpB.set('#6a2a18'), 0.14 * hk);
    applied.sun.lerp(tmpA.set('#ffcf9e'), 0.22 * hk);
    applied.sunI += 0.28 * hk;
  }
  // v22 : BRAISE du décollage — le ciel reste chaud longtemps après le
  // départ des fusées (cause -> effet, jamais de coupure nette).
  if (burnK > 0.01) {
    var bk = burnK * burnK;
    applied.sun.lerp(tmpA.set('#ffc37e'), 0.30 * bk);
    applied.fog.lerp(tmpB.set('#8a4a28'), 0.18 * bk);
    applied.top.lerp(tmpA.set('#3a2418'), 0.12 * bk);
    applied.exposure *= (1 + 0.12 * bk);
  }
  if (bhBlue && (phaseName === 'allgone' || phaseName === 'blackhole' || phaseName === 'numbers')) {
    // Bleu lointain du trou noir : respiration lente + pulsation sur les
    // battements (growth -> numbers : noir quasi absolu, bleu distant).
    beatPulse = Math.max(0, beatPulse - dt * 1.4);
    var bb = 0.5 + 0.5 * Math.sin(t * 1.05);
    applied.fog.lerp(tmpA.set('#0a1430'), 0.10 + 0.06 * bb);
    applied.top.lerp(tmpB.set('#0a1228'), 0.08 + 0.06 * bb);
    applied.hemiI += 0.05 * bb + 0.25 * beatPulse;
    applied.fill.lerp(tmpA.set('#2a4a9a'), 0.30 * beatPulse + 0.08 * bb);
    applied.stars = Math.min(0.5, applied.stars + 0.08 * bb + 0.20 * beatPulse);
  }

  if (flash) {
    if (flash.kind === 'white') {
      // FLASH BLANC total de l'impact final (~1,5 s), puis RETOMBÉE
      // PROGRESSIVE vers l'état courant (v16 : jamais de coupure nette).
      var wfk = flash.fade ? Math.min(1, flash.fade / 1.4) : 0;
      var wfe = wfk * wfk * (3 - 2 * wfk);
      copyState(applied, WHITE_STATE);
      lerpState(WHITE_STATE, cur, wfe, applied);
    } else {
      // 'strike' : flash bleu-blanc bref au CONTACT — sun x3, expo boostée.
      // v12 : attaque plus franche (décroissance en racine) + vibration.
      var k = Math.pow(Math.max(0, 1 - flash.t / flash.dur), 0.55);
      k *= 0.82 + 0.18 * Math.sin(flash.t * 34);
      applied.sunI *= (1 + 2 * k);
      applied.exposure *= (1 + 1.4 * k);
      applied.fog.lerp(tmpA.set('#eaf4ff'), 0.45 * k);
      applied.top.lerp(tmpB.set('#eaf4ff'), 0.45 * k);
      applied.bot.lerp(tmpB, 0.45 * k);
    }
  }

  // --- champ d'étoiles dense + pleine lune + aurores boréales ---
  // Étoiles : pilotées par la phase via applied.stars (0 le jour -> invisible).
  // v13 : les étoiles SCINTILLENT (taille légèrement ondulante).
  if (starField) {
    var so = Math.max(0, Math.min(1, applied.stars));
    starField.visible = so > 0.01;
    starField.material.opacity = so;
    // v15 : pendant le trou noir, les étoiles SCINTILLENT plus fort.
    var blackSet = (phaseName === 'blackhole' || phaseName === 'growth' || phaseName === 'numbers');
    var twAmp = blackSet ? 0.45 : 0.14;
    var twSpd = blackSet ? 6.2 : 3.1;
    starField.material.size = 2.6 * (1 + twAmp * Math.sin(t * twSpd));
  }
  // Pleine lune : fondu doux vers la cible de phase + pop d'apparition franc.
  if (moonK !== moonTarget) {
    moonK += (moonTarget - moonK) * Math.min(1, dt * 0.8);
    if (Math.abs(moonTarget - moonK) < 0.002) moonK = moonTarget;
  }
  // v12 : la lune APPARAÎT avec un overshoot (elle "claque" dans le ciel).
  if (moonTarget > moonK + 0.002 && moonPopT >= 1) moonPopT = 0;
  if (moonPopT < 1) moonPopT = Math.min(1, moonPopT + dt / 0.9);
  if (moonSprite) {
    moonSprite.visible = moonK > 0.01;
    moonSprite.material.opacity = moonK;
    // v13 : la lune dérive lentement dans le ciel + respire doucement
    // (le ciel de nuit est vivant, même dans le calme).
    moonSprite.position.x = 700 + Math.sin(t * 0.012) * 50;
    moonSprite.position.y = 1150 + Math.cos(t * 0.009) * 25;
    // v17 : le trou noir ATTIRE LA LUNE — la cible glisse en douceur, la
    // lune tremble pendant qu'elle est tiraillée.
    // v22 : tremblement TRIPLÉ — la lune est secouée violemment.
    if (moonPull !== moonPullTarget) {
      moonPull += (moonPullTarget - moonPull) * Math.min(1, dt * 0.9);
      if (Math.abs(moonPullTarget - moonPull) < 0.003) moonPull = moonPullTarget;
    }
    moonSprite.position.x += -260 * moonPull + Math.sin(t * 31) * 21 * moonPull;
    moonSprite.position.y += -430 * moonPull + Math.cos(t * 37 + 1.2) * 21 * moonPull;
    // v15 : la lune GROSSIT légèrement pendant la nuit (elle se rapproche).
    if (moonTarget > 0.5) moonGrow = Math.min(1, moonGrow + dt * 0.02);
    else moonGrow = Math.max(0, moonGrow - dt * 0.05);
    var ms = 300 * easeOutBack12(moonPopT) * (1 + 0.012 * Math.sin(t * 0.9)) * (1 + 0.18 * moonGrow);
    // v17 : ÉTIREMENT (spaghettification) vers le trou noir + rougissement
    // (lentille gravitationnelle) avant l'engloutissement.
    // v22 : AMPLIFIÉ — étirement x1.8, écrasement vertical marqué,
    // rougissement profond : la lune est tiraillée avant d'être avalée.
    var mp2 = moonPull * moonPull;
    moonSprite.scale.set(ms * (1 + 1.8 * moonPull), ms * (1 - 0.62 * mp2), 1);
    moonSprite.material.color.setRGB(1, 1 - 0.45 * moonPull, 1 - 0.55 * moonPull);
    // v22 : pendant l'effondrement, le clair de lune VACILLE — la source
    // de lumière elle-même est aspirée par le trou noir.
    if (moonPull > 0.25) {
      var mfl = 0.5 + 0.5 * Math.sin(t * 29 + Math.sin(t * 7.3) * 2);
      applied.sunI *= (1 - 0.35 * moonPull * mfl);
    }
  }
  // v22 : FLARE de la lune avalée — un dernier sursaut bleu-blanc dans le
  // ciel quand le trou noir l'engloutit (blackhole:formed).
  if (moonFlare > 0.01) {
    var mfk = moonFlare * moonFlare;
    applied.fog.lerp(tmpA.set('#dfe9ff'), 0.35 * mfk);
    applied.top.lerp(tmpB.set('#cfe0ff'), 0.30 * mfk);
    applied.exposure *= (1 + 0.9 * mfk);
  }
  // v22 : le ciel RÉPOND à chaque nombre — un pouls bleu lointain (le
  // cosmos accuse le coup, un par un, jamais expliqué).
  if (numSkyPulse > 0.01) {
    var nsk = numSkyPulse * numSkyPulse;
    applied.fill.lerp(tmpA.set('#3a5adf'), 0.45 * nsk);
    applied.top.lerp(tmpB.set('#101c44'), 0.30 * nsk);
    applied.stars = Math.min(1, applied.stars + 0.25 * nsk);
  }
  // Aurores : fondu doux vers la cible de phase, ondulation pilotée par t,
  // le groupe balaie lentement le ciel (rotation horizontale lente).
  // v20 : auroraKick — les aurores PULSENT sur les temps forts (ondes de
  // choc, battements d'aspiration, impact météorite) même si elles sont
  // invisibles en phase (visible forcé pendant l'impulsion).
  auroraKick = Math.max(0, auroraKick - dt * 2.2);
  if (auroraK !== auroraTarget) {
    auroraK += (auroraTarget - auroraK) * Math.min(1, dt * 0.8);
    if (Math.abs(auroraTarget - auroraK) < 0.002) auroraK = auroraTarget;
  }
  if (auroraGroup) {
    auroraGroup.visible = auroraK > 0.01 || auroraKick > 0.02;
    auroraGroup.rotation.y = t * 0.008 + 0.02 * Math.sin(t * 0.05); // v15 : balayage vivant
    auroraGroup.scale.y = 1 + 0.08 * Math.sin(t * 0.4); // v15 : les rideaux gonflent
    for (var ai = 0; ai < auroraMats.length; ai++) {
      var am = auroraMats[ai];
      am.uniforms.uTime.value = t;
      // v15 : respiration AMPLIFIÉE — chaque rideau a son rythme propre,
      // avec des vagues lentes qui le traversent.
      var breathe = 0.70 + 0.30 * Math.sin(t * (0.55 + ai * 0.13) + ai * 2.1) *
        (0.7 + 0.3 * Math.sin(t * 0.21 + ai));
      am.uniforms.uIntensity.value = auroraK * breathe + auroraKick * 0.85 * breathe;
    }
  }

  // --- 'calm' : adoucit temporairement vers les valeurs d'origine ---
  if (calmT < 6 && origState) {
    var c = Math.sin(Math.min(1, calmT / 6) * Math.PI) * 0.4;
    lerpState(applied, origState, c, applied);
  }
  // v21 : pluie d'étoiles filantes (le cosmos se vide pendant le trou noir).
  updateStreaks(dt);
  // L'application réelle sur la scène se fait dans le wrapper view.update(),
  // juste après que le jeu a écrit ses valeurs du jour, avant le rendu.
}

function dispose() {
  disposed = true;
  removeWrapper();
  disposeSkyFx(); // retire étoiles + lune + aurores, libère géométries/matériaux
  restoreOriginals(); // restaure TOUTES les valeurs d'origine, EXACTEMENT
  view = null;
  api = null;
  cur = null; applied = null; origState = null;
  phaseName = ''; stormK = 0; moonGrow = 0; boltClock = 0; boltFlash = 0; boltVolley = 0; auroraKick = 0; // v15 (+v20)
  phaseHeat = 0; heatTarget = 0; burnK = 0; moonFlare = 0; numSkyPulse = 0; boltQueue.length = 0; // v22
  blendFrom = null; blendTo = null; flash = null; fxMode = null;
  // Le bus n'expose pas de off() : les handlers restants sont neutralisés
  // par le drapeau `disposed` et le test `root.AZEvent.active`.
  // Aucun DOM/CSS ajouté par ce module ; les meshes créés sont nettoyés ci-dessus.
}

root.AZEvent.register('sky', { init: init, update: update, dispose: dispose });

})(window);
