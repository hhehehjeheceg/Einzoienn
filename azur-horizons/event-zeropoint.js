/* event-zeropoint.js — projet "THE END" (AZUR Horizons v5).
 *
 * LE POINT ZÉRO — grande orbe bleu électrique au centre de la map, entourée
 * de 4 coquilles d'énergie PULSANTES ALTERNÉES, d'une bulle anti-gravité
 * (12 rochers en lévitation), de 3 anneaux tourbillonnants, de vrilles
 * d'énergie et de filaments. Reproduction de l'événement live
 * Fortnite Chapitre 1 Saison X (13 octobre 2019).
 *
 * Comportements par phase (timeline v5 — pilotés par AZEvent.state,
 * jamais par des temps absolus) :
 * v14 : bornes documentaires décalées de +48 s (le compte à rebours passe
 * de 12 s à 60 s, toutes les phases suivantes décalées de +48 s).
 * v15 (passe "animation maximale", bornes/timeline intactes) :
 *  - cœur : BATTEMENT (lub-dub) qui s'accélère à l'approche des phases
 *    critiques (révélation -> pression) ;
 *  - bandes : 5 bandes en contre-rotation alternée, illumination en
 *    opposition de phase, resserrement marqué sous pression ;
 *  - distorsion de l'espace : 2 dômes striés en contre-rotation (effet de
 *    lentille/ondulation, sans post-traitement) ;
 *  - point de non-retour : anneau fin qui SE RESSERRE sous pression, et
 *    pendant l'effondrement liseré du cœur sombre + flash blanc à ~2,9 s.
 * - countdown→silence [0,204]    : dormant mais visible, calme, pulsation lente.
 * - strike [204,218]             : sur 'rocket:impact' la bulle BRILLE
 *                                  et scintille (la fusée a percuté la bulle).
 * - thrown [218,226]             : agitation modérée, l'orbe se tend.
 * - greatrift/meteorsix [226,246]: RÉVÉLATION : l'orbe grandit (x1.5),
 *                                  pulsations fortes.
 * - descent/veeroff [246,274]    : la bulle SE DÉFORME et RÉSISTE à la
 *                                  météorite ; ÉNORME DISTORSION CIRCULAIRE
 *                                  autour du Point Zéro ; la pression monte
 *                                  (pulsations de plus en plus rapides) ;
 *                                  en veeroff la météorite TRAVERSE la bulle.
 *                                  (v10 : régime 'pressure' RENFORCÉ — pulsations
 *                                  extrêmes, flashs fréquents, déformation
 *                                  ÉLASTIQUE de la bulle à double harmonique,
 *                                  distorsion agrandie.)
 * - impact [274,329]             : sur 'meteor:hit' l'orbe est
 *                                  DÉTRUITE -> émet 'zeropoint:destroyed'.
 * - contraction [329,334]        : rien (l'orbe a été détruite).
 * - collapse [334,338]           : le Point Zéro S'EFFONDRE sur lui-même
 *                                  (un résidu d'énergie réapparaît au centre) :
 *                                  distorsion immense, la matière tourne, le
 *                                  centre devient extrêmement sombre, la
 *                                  lumière est aspirée, puis UN TROU NOIR SE
 *                                  FORME -> émet 'blackhole:formed' puis
 *                                  'zeropoint:collapse'. Ensuite le module ne
 *                                  montre plus rien (trou noir géré par
 *                                  event-blackhole.js).
 *                                  (chrono interne relatif ~3 s : l'effondrement
 *                                  tient dans la fenêtre collapse [334,338] ;
 *                                  les émissions restent uniques, le bus pilote
 *                                  la suite.)
 *
 * INTERDIT : tourbillons violets, teintes mauves (palette bleu/cyan/blanc).
 * Contrat : IIFE 'use strict', THREE global, aucun import, aucun réseau,
 * inactif si !AZEvent.active, dispose() nettoie tout.
 */
(function (root) {
'use strict';

if (!root.AZEvent) return; // le séquenceur doit être chargé avant

var T = null;             // THREE (résolu à l'init via api.T)
var api = null;
var disposed = false;
var busBound = false;     // écouteurs du bus branchés une seule fois (pas de off())

// ---- Visuels de l'orbe (dormant -> pression) ----
var group = null;         // racine : orbe + halo + anneaux + vrilles + bulle
var core = null;          // sphère bleu électrique
var coreInner = null;     // v12 : cœur blanc incandescent interne
var coreGlow = null;      // v12 : lueur blanche du cœur (sprite dense)
var shells = [];          // 4 coquilles d'énergie pulsantes alternées
var halo = null;          // sprite radial lumineux
var rings = [];           // 3 tores tourbillonnants
var bands = [];           // v12 : 3 bandes d'énergie rotatives serrées
var tendrils = [];        // 8 vrilles d'énergie (Line)
// v17 : ÉVENTS CÉLESTES — jets d'énergie verticaux qui relient le Point
// Zéro au ciel pendant la pression (cause visible : l'orbe ÉVENTE son
// énergie vers le haut en résistant à la météorite).
var skyVent = [];        // lignes verticales (Line), 24 segments
var N_SKYVENT = 5;
var ventK = 0;           // 0..1 : intensité fondue des évents (jamais figés)
// v21 : GEYSERS D'ÉNERGIE — piliers verticaux qui jaillissent du sol autour
// de la bulle pendant la pression et l'approche finale (le Point Zéro
// ÉVENTE sa puissance dans toutes les directions).
var geysers = [];
var N_GEYSERS = 8;
var geyserK = 0;         // 0..1 : intensité fondue des geysers (jamais figés)
var baseZ = 0;           // v21 : position de référence Z (tremblement pré-impact)
var bubble = null;        // bulle anti-gravité transparente
var debris = [];          // rochers en lévitation dans la bulle
var filaments = null;     // particules filamenteuses rapides (Points)
var filData = [];         // paramètres d'orbite des filaments
var influx = null;        // v12 : particules aspirées VERS le centre
var influxData = [];      // paramètres d'aspiration
var pulseWaves = [];      // v12 : ondes de pulsation (anneaux expansifs)
var groundCracks = null;  // v12 : fissures lumineuses au sol
var groundCrackTex = null;// v12 : texture des fissures au sol
// ---- Distorsion de la descente (phase descent/veeroff) ----
var distortA = null;      // énorme anneau de distorsion circulaire
var distortB = null;      // second anneau, contre-rotation
// ---- Effondrement (phase collapse) ----
var residue = null;       // résidu d'énergie qui réapparaît au centre
var darkCore = null;      // centre extrêmement sombre qui grandit
var spiral = null;        // matière qui tourne et est aspirée (Points)
var spiralData = [];      // paramètres des particules spirales
var bigRing = null;       // immense distorsion circulaire de l'effondrement

var destroyed = false;    // true une fois la météorite tombée (phase impact)
// v17 : CONTACT CONFIRMÉ — true UNIQUEMENT quand 'meteor:hit' (contact
// RÉEL, event-impact.js) a été reçu. Chaque visuel d'explosion/destruction
// de l'orbe est conditionné à ce drapeau : jamais d'explosion avant que
// la météorite ne touche VRAIMENT.
var contactConfirmed = false;
var collapseT = -1;       // chrono d'effondrement (<0 = inactif)
var pressureT = -1;       // chrono RELATIF de pression (<0 = hors descent/veeroff)
// v17 : bornes de la timeline officielle — descent [189,209] (20 s) +
// veeroff [209,217] (8 s) : 20 s + 8 s = 28 s, diviseur de pressureK()
// INCHANGÉ (la saturation reste exactement la même qu'en v14).
// Ce n'est pas un temps absolu : pressureT s'accumule dans update() pendant
// le régime 'pressure', et pressureK() sature à 1 si la phase dure plus long.
// ---------------------------------------------------------------------------
// v17 — Miroir local de la timeline officielle (secondes) — DOCUMENTAIRE
// UNIQUEMENT : le code ne branche JAMAIS sur ces temps, seulement sur les
// régimes de phase (contrainte permanente). Les bornes sont lues depuis
// AZEvent.TIMELINE quand elle existe — ce miroir n'est qu'un repli.
// ---------------------------------------------------------------------------
var TL = {
  countdown:   [0, 60],    firstrocket: [60, 86],   sixrockets: [86, 106],
  convergence: [106, 114], loop:        [114, 121], acceleration: [121, 147],
  silence:     [147, 152], strike:      [152, 165], thrown:      [165, 172],
  greatrift:   [172, 182], meteorsix:   [182, 189], descent:    [189, 209],
  veeroff:     [209, 217], impact:      [217, 256], contraction: [256, 260],
  collapse:    [260, 263], growth:      [263, 266], destruction: [266, 275],
  playersucked:[275, 279], allgone:    [279, 283], blackhole:  [283, 293],
  numbers:     [293, 300], end:         [300, Infinity]
};
var PHASE_NAMES = [
  'countdown','firstrocket','sixrockets','convergence','loop','acceleration',
  'silence','strike','thrown','greatrift','meteorsix','descent','veeroff',
  'impact','contraction','collapse','growth','destruction','playersucked',
  'allgone','blackhole','numbers','end'
];
// ---------------------------------------------------------------------------
var collapseDone = false; // true une fois le trou noir formé
var strikeFlash = 0;      // scintillement de la bulle après 'rocket:impact'
var flash = 0;            // flash intense aléatoire (instabilité)
var orbY = 0;             // hauteur de l'orbe
var baseX = 0;            // position de référence pour le tremblement
// v18 : rayon visuel live de l'orbe = 15 (cœur) × échelle live, publié sur
// AZEvent.zeroPointVisR pour le contact visuel réel (event-impact.js).
var orbVisR = 22.5;       // défaut : orbe révélée (15 × 1.5)
var coreBlue = null;      // couleur bleue de référence
var coreRed = null;       // couleur rouge (instabilité)

var N_FILAMENTS = 150;    // < 500 particules par système
var N_SPIRAL = 150;       // < 500 particules par système
var N_INFLUX = 120;       // < 500 particules par système (v12 : afflux)
var N_TENDRILS = 8;
// ---- v15 : passe "animation maximale" ----
var mirage = null;        // dôme de distorsion (lentille) : strie l'espace autour
var mirage2 = null;       // second dôme, contre-rotation (sauf mobile)
var mirageTex = null;     // texture striée des dômes
var fateRing = null;      // anneau du point de non-retour (pression) : se resserre
var nrFlash = null;       // flash blanc du point de non-retour (collapse ~2,9 s)
var nrFlashDone = false;  // flash déjà déclenché ?
var nrFlashT = 0;         // chrono du flash
var darkRim = null;       // liseré brillant autour du cœur sombre (collapse)
var lowQ = false;         // qualité réduite (mobile) : particules allégées
var hbNow = 0;            // battement de cœur courant (0..1.4)
var critNow = 0;          // criticité de phase courante (0..1)
var approachK = 0;        // v22 : proximité live de la météorite (0..1) — amplifie la réaction

// Groupes de phases -> régime de comportement (timeline v5).
var DORMANT = { countdown: 1, firstrocket: 1, sixrockets: 1, convergence: 1,
                loop: 1, acceleration: 1, silence: 1 };
var REVEALED = { greatrift: 1, meteorsix: 1 };
var PRESSURE = { descent: 1, veeroff: 1 };
var GONE = { growth: 1, destruction: 1, playersucked: 1, allgone: 1,
             blackhole: 1, numbers: 1, end: 1 };

function regime(state) {
  if (DORMANT[state]) return 'dormant';
  if (state === 'strike') return 'strike';
  if (state === 'thrown') return 'agitated';
  if (REVEALED[state]) return 'revealed';
  if (PRESSURE[state]) return 'pressure';
  if (state === 'impact') return 'impact';
  if (state === 'contraction') return 'quiet';
  if (state === 'collapse') return 'collapse';
  if (GONE[state]) return 'gone';
  // GARDE-FOU : tout état inconnu — 'idle' à l'init, ou un futur état du
  // séquenceur — retombe sur 'dormant' : l'orbe reste visible et calme.
  // Seuls les régimes 'impact'/'quiet'/'gone' la cachent, et ils ne sont
  // atteints que pour des phases connues.
  return 'dormant';
}

// ------------------------------------------------------------ textures ---
// Sprite radial généré en canvas : aucun asset réseau, aucune image.
function makeHaloTexture() {
  var c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(180,220,255,0.85)');
  g.addColorStop(0.55, 'rgba(90,150,255,0.35)');
  g.addColorStop(1.0, 'rgba(60,90,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

// v12 — Texture des fissures lumineuses au sol : fissures cyan rayonnant
// depuis le centre (fond noir = invisible en blending additif).
// Palette bleu/cyan/blanc UNIQUEMENT (pas de violet/mauve).
function makeGroundCrackTexture() {
  var c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  var cx = 128, cy = 128;
  for (var b = 0; b < 22; b++) {
    var ang = (b / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    ctx.shadowColor = 'rgba(80,200,255,0.9)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(150,225,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    var x = cx + Math.cos(ang) * 12, y = cy + Math.sin(ang) * 12;
    ctx.moveTo(x, y);
    for (var s = 0; s < 4; s++) {
      ang += (Math.random() - 0.5) * 0.6;
      var ln = 18 + Math.random() * 22;
      x += Math.cos(ang) * ln; y += Math.sin(ang) * ln;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  return new T.CanvasTexture(c);
}

// v15 — Texture des dômes de distorsion : stries horizontales ondulées
// (fond transparent = invisible en blending additif). L'espace lui-même
// semble se plisser quand les deux dômes tournent en sens inverse.
// Palette bleu/cyan/blanc UNIQUEMENT (pas de violet/mauve).
function makeMirageTexture() {
  var c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  for (var i = 0; i < 26; i++) {
    var y = Math.random() * 256;
    ctx.strokeStyle = 'rgba(160,220,255,' + (0.05 + Math.random() * 0.12).toFixed(3) + ')';
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    for (var x = 0; x <= 256; x += 16) {
      var yy = y + Math.sin(x * 0.05 + i * 1.7) * 8;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  return new T.CanvasTexture(c);
}

// ------------------------------------------------------------------ init ---
function init(a) {
  api = a;
  T = (a && a.T) || root.THREE;
  disposed = false;
  contactConfirmed = false; // v17 : réarmé à chaque démarrage
  lowQ = !!(a && (a.quality === 'low' || a.isMobile)); // v15 : mobile -> particules allégées
  if (!T) return;
  var scene = api.scene();
  if (!scene) return;

  // Position : centre de la map, ~25 m au-dessus du sol.
  var c = api.center || new T.Vector3(0, 0, 0);
  orbY = c.y + 20; // v76 : même hauteur que le Point Zéro de event-coherence (un seul Point Zéro)

  group = new T.Group();
  group.position.set(c.x, orbY, c.z);
  baseX = c.x;
  baseZ = c.z; // v21 : référence Z (tremblement pré-impact)
  scene.add(group);
  // INVARIANT : l'orbe est visible dès le démarrage.
  group.visible = true;
  // Publication inter-modules : le laser de visée de la fusée n°1
  // (event-rockets.js, phase strike) et la météorite (event-meteor.js,
  // phase impact) ciblent cette position en direct.
  root.AZEvent.zeroPointPos = group.position.clone();
  root.AZEvent.zeroPointVisR = 15; // v18 : rayon visuel live (cœur r=15, échelle 1 au repos)

  coreBlue = new T.Color(0x2a7fff); // bleu électrique
  coreRed = new T.Color(0xff2a2a);  // rouge (instabilité)

  // ---- Cœur de l'orbe : sphère parfaite bleu électrique (v9 : plus grande).
  core = new T.Mesh(
    new T.SphereGeometry(15, 40, 28),
    new T.MeshBasicMaterial({ color: coreBlue.clone(), fog: false })
  );
  group.add(core);

  // ---- 4 coquilles d'énergie : pulsations ALTERNÉES (déphasées de PI/2),
  // rayons croissants, de plus en plus transparentes vers l'extérieur.
  // Très visibles à la révélation, chaotiques à l'impact de la fusée.
  // Palette bleu/cyan/blanc UNIQUEMENT (pas de violet/mauve).
  // v9 : coquilles agrandies (cœur = 15).
  var shellDefs = [
    { r: 17.3, color: 0x66aaff, op: 0.34, phase: 0.0 },            // bleu
    { r: 20.3, color: 0x33ddff, op: 0.28, phase: Math.PI * 0.5 },  // cyan
    { r: 23.8, color: 0x99eeff, op: 0.24, phase: Math.PI },        // cyan pâle
    { r: 28.0, color: 0xbfe6ff, op: 0.18, phase: Math.PI * 1.5 }   // blanche
  ];
  for (var sdi = 0; sdi < shellDefs.length; sdi++) {
    var sd = shellDefs[sdi];
    var shellMesh = new T.Mesh(
      new T.SphereGeometry(sd.r, 40, 28),
      new T.MeshBasicMaterial({
        color: sd.color, transparent: true, opacity: sd.op,
        blending: T.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    shellMesh.userData = {
      ratio: sd.r / 15,   // v9 : rayon relatif au coeur (coeur = 15)
      baseOp: sd.op,      // opacite de reference
      phase: sd.phase,    // dephasage de la pulsation (alternance)
      spin: (sdi % 2 === 0 ? 1 : -1) * (0.25 + sdi * 0.12) // sens alternes
    };
    group.add(shellMesh);
    shells.push(shellMesh);
  }

  // ---- Halo radial (sprite).
  halo = new T.Sprite(new T.SpriteMaterial({
    map: makeHaloTexture(), color: 0x88bbff,
    transparent: true, opacity: 0.75,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  }));
  halo.scale.set(68, 68, 1); // v9 : halo agrandi (était 52)
  group.add(halo);

  // ---- v12 : CŒUR INCANDESCENT — sphère blanche interne : le cœur BRÛLE,
  // de plus en plus blanc quand l'intensité monte (rév/pression).
  coreInner = new T.Mesh(
    new T.SphereGeometry(8, 28, 20),
    new T.MeshBasicMaterial({
      color: 0xeaf6ff, transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  group.add(coreInner);

  // ---- v12 : lueur blanche dense du cœur (sprite interne, plus concentré
  // que le halo externe).
  coreGlow = new T.Sprite(new T.SpriteMaterial({
    map: makeHaloTexture(), color: 0xd6ecff,
    transparent: true, opacity: 0.6,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  }));
  coreGlow.scale.set(40, 40, 1);
  group.add(coreGlow);

  // ---- Anneaux tourbillonnants : 3 tores inclinés sur des axes différents.
  var ringColors = [0x33ddff, 0x66aaff, 0x55f0ff]; // bleus/cyan uniquement
  for (var i = 0; i < 3; i++) {
    var ring = new T.Mesh(
      new T.TorusGeometry(18 + i * 2.5, 0.55, 8, 72),
      new T.MeshBasicMaterial({
        color: ringColors[i], transparent: true, opacity: 0.55,
        blending: T.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    ring.rotation.set(1.1 + i * 0.55, i * 1.9, 0.4 * i);
    ring.userData.speed = 0.5 + i * 0.28;
    group.add(ring);
    rings.push(ring);
  }

  // ---- v12 : BANDES D'ÉNERGIE ROTATIVES — 3 bandes plates serrées autour
  // de l'orbe, rapides, axes variés (distinctes des 3 anneaux orbitaux :
  // plus fines, plus proches, contre-rotations rapides).
  // v15 : 5 bandes — la chaîne de contre-rotation est complète (+,-,+,-,+) :
  // le sens alterné se LIT d'un coup d'œil.
  var bandDefs = [
    { r: 21.5, tube: 1.1, color: 0x9ff3ff, tilt: [1.35, 0.3, 0.2], spd: 2.6 },
    { r: 26.5, tube: 0.9, color: 0x6fc4ff, tilt: [1.05, 2.2, 0.5], spd: -3.1 },
    { r: 31.5, tube: 0.7, color: 0xd8f4ff, tilt: [1.50, 4.1, 0.9], spd: 3.8 },
    { r: 36.5, tube: 0.55, color: 0x86d9ff, tilt: [1.20, 5.3, 1.2], spd: -4.6 },
    { r: 41.0, tube: 0.45, color: 0xe2f4ff, tilt: [1.42, 1.1, 1.7], spd: 5.4 }
  ];
  for (var bi = 0; bi < bandDefs.length; bi++) {
    var bd = bandDefs[bi];
    var band = new T.Mesh(
      new T.TorusGeometry(bd.r, bd.tube, 8, 96),
      new T.MeshBasicMaterial({
        color: bd.color, transparent: true, opacity: 0.6,
        blending: T.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    band.rotation.set(bd.tilt[0], bd.tilt[1], bd.tilt[2]);
    band.userData.spin = bd.spd;
    group.add(band);
    bands.push(band);
  }

  // ---- Vrilles d'énergie : lignes courbes cyan/bleu pâle.
  for (var k = 0; k < N_TENDRILS; k++) {
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array((32 + 1) * 3), 3));
    var line = new T.Line(geo, new T.LineBasicMaterial({
      color: k % 2 === 0 ? 0x33eeff : 0x99ddff,
      transparent: true, opacity: 0.8,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    }));
    line.userData = {
      phase: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 1.6,
      theta: (k / N_TENDRILS) * Math.PI * 2,
      phi: 0.4 + Math.random() * 1.0
    };
    group.add(line);
    tendrils.push(line);
  }

  // ---- v17 : ÉVENTS CÉLESTES — 5 jets d'énergie verticaux vers le ciel.
  // Pendant descent/veeroff, le Point Zéro résiste à la météorite et ÉVENTE
  // son énergie vers le haut : les jets relient visiblement l'orbe au ciel.
  for (var sv = 0; sv < N_SKYVENT; sv++) {
    var sgeo = new T.BufferGeometry();
    sgeo.setAttribute('position', new T.BufferAttribute(new Float32Array((24 + 1) * 3), 3));
    var sline = new T.Line(sgeo, new T.LineBasicMaterial({
      color: sv % 2 === 0 ? 0x66f6ff : 0xbfe9ff,
      transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    }));
    var sang = (sv / N_SKYVENT) * Math.PI * 2 + 0.4;
    sline.userData = {
      ang: sang,
      r0: 10 + Math.random() * 8,      // ancrage sur la surface de l'orbe
      h: 480 + Math.random() * 420,    // hauteur du jet (480 à 900 m)
      speed: 2.2 + Math.random() * 2.0,
      phase: Math.random() * Math.PI * 2,
      wob: 26 + Math.random() * 30     // ondulation croissante vers le haut
    };
    sline.visible = false;
    sline.frustumCulled = false;
    group.add(sline);
    skyVent.push(sline);
  }

  // ---- v21 : GEYSERS D'ÉNERGIE — 8 piliers d'énergie verticaux ancrés au
  // sol sur le pourtour de la bulle (r ~44-54 m), qui jaillissent pendant
  // la pression et l'approche finale : le Point Zéro ÉVENTE sa puissance
  // dans toutes les directions. Palette bleu/cyan/blanc UNIQUEMENT.
  var nGey = lowQ ? 4 : N_GEYSERS; // v21 : densité réduite sur mobile
  for (var gy = 0; gy < nGey; gy++) {
    var ggeo = new T.BufferGeometry();
    ggeo.setAttribute('position', new T.BufferAttribute(new Float32Array((16 + 1) * 3), 3));
    var gline = new T.Line(ggeo, new T.LineBasicMaterial({
      color: gy % 2 === 0 ? 0x77f0ff : 0xd6f4ff,
      transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    }));
    var gang = (gy / nGey) * Math.PI * 2 + 0.2;
    gline.userData = {
      ang: gang,
      r0: 44 + Math.random() * 10,    // pourtour de la bulle (r=40)
      h: 260 + Math.random() * 160,   // hauteur du pilier (260 à 420 m)
      speed: 2.6 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      wob: 14 + Math.random() * 16
    };
    gline.visible = false;
    gline.frustumCulled = false;
    group.add(gline);
    geysers.push(gline);
  }

  // ---- Bulle anti-gravité : sphère transparente autour de l'orbe.
  bubble = new T.Mesh(
    new T.SphereGeometry(40, 32, 24),
    new T.MeshBasicMaterial({
      color: 0x66aaff, transparent: true, opacity: 0.15,
      side: T.DoubleSide, depthWrite: false, fog: false
    })
  );
  group.add(bubble);

  // ---- Débris flottants dans la bulle : petits rochers en lévitation.
  for (var d = 0; d < 12; d++) {
    var rock = new T.Mesh(
      new T.DodecahedronGeometry(0.7 + Math.random() * 1.4, 0),
      new T.MeshBasicMaterial({ color: 0x556078, fog: false })
    );
    var ang = Math.random() * Math.PI * 2;
    var rad = 16 + Math.random() * 20;
    rock.position.set(Math.cos(ang) * rad, (Math.random() - 0.5) * 40, Math.sin(ang) * rad);
    rock.userData = {
      baseX: rock.position.x, // ancrage radial (secousse sans derive)
      baseY: rock.position.y,
      baseZ: rock.position.z,
      amp: 1.5 + Math.random() * 2.5,
      speed: 0.6 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.5
    };
    group.add(rock);
    debris.push(rock);
  }

  // ---- Particules filamenteuses rapides (Points, < 500).
  // v15 : compte réduit sur mobile (lowQ).
  var nFil = lowQ ? 70 : N_FILAMENTS;
  var fgeo = new T.BufferGeometry();
  fgeo.setAttribute('position', new T.BufferAttribute(new Float32Array(nFil * 3), 3));
  filaments = new T.Points(fgeo, new T.PointsMaterial({
    color: 0x99ddff, size: 1.4, transparent: true, opacity: 0.85,
    blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
  }));
  for (var f = 0; f < nFil; f++) {
    filData.push({
      ang: Math.random() * Math.PI * 2,
      rad: 14 + Math.random() * 12,
      h: (Math.random() - 0.5) * 50,
      speed: 2 + Math.random() * 4
    });
  }
  group.add(filaments);

  // ---- v12 : AFFLUX — le Point Zéro ATTIRE la matière : 120 particules
  // naissent en périphérie et sont aspirées VERS le centre, où elles
  // meurent au contact du cœur (puis renaissent en périphérie).
  // v15 : compte réduit sur mobile (lowQ).
  var nInflux = lowQ ? 60 : N_INFLUX;
  var igeo = new T.BufferGeometry();
  igeo.setAttribute('position', new T.BufferAttribute(new Float32Array(nInflux * 3), 3));
  influx = new T.Points(igeo, new T.PointsMaterial({
    color: 0xbdeaff, size: 2.0, transparent: true, opacity: 0.8,
    blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
  }));
  for (var ii = 0; ii < nInflux; ii++) {
    influxData.push({
      ang: Math.random() * Math.PI * 2,
      rad: 45 + Math.random() * 45,
      h: (Math.random() - 0.5) * 60,
      spd: 10 + Math.random() * 14,   // vitesse d'aspiration (m/s)
      spin: 1.5 + Math.random() * 2.5
    });
  }
  group.add(influx);

  // ---- Anneaux de distorsion (phase descent/veeroff) : cachés par défaut.
  distortA = new T.Mesh(
    new T.TorusGeometry(55, 2.6, 10, 96),
    new T.MeshBasicMaterial({
      color: 0x77e8ff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  distortA.rotation.x = Math.PI / 2;
  distortA.visible = false;
  group.add(distortA);
  distortB = new T.Mesh(
    new T.TorusGeometry(68, 1.8, 10, 96),
    new T.MeshBasicMaterial({
      color: 0x55ccff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  distortB.rotation.x = Math.PI / 2 + 0.35;
  distortB.visible = false;
  group.add(distortB);

  // ---- v15 : DÔMES DE DISTORSION — l'espace lui-même se déforme autour du
  // Point Zéro : deux dômes striés en CONTRE-ROTATION (effet de lentille /
  // ondulation, sans post-traitement). Visibles dès la révélation, violents
  // sous pression. Cachés par défaut.
  mirageTex = makeMirageTexture();
  mirage = new T.Mesh(
    new T.SphereGeometry(95, 32, 24),
    new T.MeshBasicMaterial({
      map: mirageTex, color: 0x9fdcff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide, fog: false
    })
  );
  mirage.visible = false;
  group.add(mirage);
  if (!lowQ) {
    mirage2 = new T.Mesh(
      new T.SphereGeometry(115, 32, 24),
      new T.MeshBasicMaterial({
        map: mirageTex, color: 0x6fc4ff, transparent: true, opacity: 0.0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide, fog: false
      })
    );
    mirage2.visible = false;
    group.add(mirage2);
  }
  // ---- v15 : ANNEAU DU POINT DE NON-RETOUR — fin et brillant, il SE
  // RESSERRE autour de l'orbe à mesure que la pression monte
  // (descent/veeroff). Caché par défaut.
  fateRing = new T.Mesh(
    new T.TorusGeometry(1, 0.025, 8, 96), // tube fin : à l'échelle 26-80 -> anneau fin mais bien visible
    new T.MeshBasicMaterial({
      color: 0xeaf7ff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  fateRing.rotation.x = Math.PI / 2;
  fateRing.visible = false;
  group.add(fateRing);

  // ---- v12 : ONDES DE PULSATION — 3 anneaux qui partent du cœur en
  // rythme, synchronisés sur la pulsation de l'orbe (l'énergie rayonne).
  for (var wi = 0; wi < 3; wi++) {
    var wmesh = new T.Mesh(
      new T.RingGeometry(15.5, 17.5, 72),
      new T.MeshBasicMaterial({
        color: 0x9fe4ff, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false,
        side: T.DoubleSide, fog: false
      })
    );
    wmesh.rotation.x = Math.PI / 2 + wi * 0.3;
    wmesh.visible = false;
    group.add(wmesh);
    pulseWaves.push({ mesh: wmesh, off: wi / 3 });
  }

  // ---- v12 : FISSURES LUMINEUSES AU SOL — le sol autour du Point Zéro
  // se fissure et luit en cyan (plan horizontal sous l'orbe).
  groundCrackTex = makeGroundCrackTexture();
  groundCracks = new T.Mesh(
    new T.PlaneGeometry(260, 260),
    new T.MeshBasicMaterial({
      map: groundCrackTex, transparent: true, opacity: 0.3,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    })
  );
  groundCracks.rotation.x = -Math.PI / 2;
  groundCracks.position.y = -orbY + 2; // 2 m au-dessus du sol
  group.add(groundCracks);

  // ---- Visuels d'effondrement (phase collapse) : cachés par défaut.
  // Résidu d'énergie qui réapparaît au centre.
  residue = new T.Mesh(
    new T.SphereGeometry(6, 24, 18),
    new T.MeshBasicMaterial({
      color: 0xbfd9ff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  residue.visible = false;
  group.add(residue);
  // Centre extrêmement sombre qui grandit.
  darkCore = new T.Mesh(
    new T.SphereGeometry(1, 24, 18),
    new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, fog: false })
  );
  darkCore.visible = false;
  group.add(darkCore);
  // ---- v15 : LISERÉ du cœur sombre — anneau brillant qui se resserre et
  // s'embrase autour du noir pendant le point de non-retour. Caché par défaut.
  darkRim = new T.Mesh(
    new T.TorusGeometry(1, 0.35, 8, 72),
    new T.MeshBasicMaterial({
      color: 0xcfeaff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  darkRim.visible = false;
  group.add(darkRim);
  // ---- v15 : FLASH du point de non-retour — sprite blanc qui claque à
  // ~2,9 s d'effondrement, juste avant la naissance du trou noir.
  nrFlash = new T.Sprite(new T.SpriteMaterial({
    map: makeHaloTexture(), color: 0xffffff,
    transparent: true, opacity: 0.0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  }));
  nrFlash.scale.set(10, 10, 1);
  nrFlash.visible = false;
  group.add(nrFlash);
  // Matière qui tourne et est aspirée vers le centre (spirale, < 500).
  // v15 : compte réduit sur mobile (lowQ).
  var nSpiral = lowQ ? 70 : N_SPIRAL;
  var sgeo = new T.BufferGeometry();
  sgeo.setAttribute('position', new T.BufferAttribute(new Float32Array(nSpiral * 3), 3));
  spiral = new T.Points(sgeo, new T.PointsMaterial({
    color: 0xaaddff, size: 2.2, transparent: true, opacity: 0.0,
    blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
  }));
  for (var s = 0; s < nSpiral; s++) {
    spiralData.push({
      ang: Math.random() * Math.PI * 2,
      rad: 25 + Math.random() * 40,
      h: (Math.random() - 0.5) * 30,
      speed: 1.5 + Math.random() * 2.5
    });
  }
  spiral.visible = false;
  group.add(spiral);
  // Immense distorsion circulaire de l'effondrement.
  bigRing = new T.Mesh(
    new T.TorusGeometry(42, 3.2, 10, 96),
    new T.MeshBasicMaterial({
      color: 0x8fd0ff, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  bigRing.rotation.x = Math.PI / 2;
  bigRing.visible = false;
  group.add(bigRing);

  // ---- Écoute du bus.
  // Branchés UNE SEULE FOIS (le bus n'a pas de off()).
  if (!busBound) {
    busBound = true;
    api.on('rocket:impact', onRocketImpact);   // phase strike : la fusée percute la bulle
    api.on('meteor:hit', onMeteorHit);        // phase impact : la météorite détruit l'orbe
    api.on('phase:strike', onStrikePhase);     // sécurité si 'rocket:impact' absent
  }

  // Si le module démarre en cours d'event, on se cale sur la phase en cours.
  syncToState();
}

// -------------------------------------------------------------- événements -
// La fusée n°1 frappe le Point Zéro (laser de visée + percussion) :
// la bulle BRILLE et scintille violemment.
function onRocketImpact() {
  if (disposed || destroyed) return;
  strikeFlash = 2.8; // ~2,8 s de scintillement intense (v10 : renforcé)
}

// Sécurité : passage en phase 'strike' sans 'rocket:impact' du module fusées.
function onStrikePhase() {
  if (disposed || destroyed) return;
  if (strikeFlash <= 0) strikeFlash = 1.2;
}

// La météorite percute le Point Zéro : l'orbe est DÉTRUITE.
// v17 : seul le CONTACT RÉEL ('meteor:hit', distance live < 130 m dans
// event-impact.js) pose le drapeau « contact confirmé » — rien d'autre.
function onMeteorHit() {
  if (disposed || destroyed) return;
  contactConfirmed = true; // v17 : le contact a VRAIMENT eu lieu
  destroyed = true;
  group.visible = false;
  api.emit('zeropoint:destroyed', {});
}

// v17 : proximité RÉELLE de la météorite (positions live publiées par
// event-meteor.js). Le repli de syncToState() ne conclut JAMAIS sur un
// timer ou une entrée de phase : seulement sur la distance réelle.
function meteorIsClose(radiusM) {
  try {
    var AZE = root.AZEvent;
    var mp = AZE && AZE.meteorPos, zp = AZE && AZE.zeroPointPos;
    if (!mp || !zp) return false;
    if (!isFinite(mp.x) || !isFinite(mp.y) || !isFinite(mp.z)) return false;
    if (!isFinite(zp.x) || !isFinite(zp.y) || !isFinite(zp.z)) return false;
    var dx = mp.x - zp.x, dy = mp.y - zp.y, dz = mp.z - zp.z;
    return (dx * dx + dy * dy + dz * dz) < radiusM * radiusM;
  } catch (e) { return false; }
}

// v18 : CONTACT VISUEL — la MÊME condition qu'event-impact.js : la distance
// live centres < R_météorite + R_PointZéro (rayons visuels live publiés ;
// replis miroirs si indisponibles). Le repli de syncToState() ne conclut
// plus sur un seuil fixe (150 m) : il attend le toucher visuel réel.
// v20 : CHEVAUCHEMENT — même seuil qu'event-impact.js : dist <
// (R_m + R_z) × 0,5 (la tangence exacte ne se voit pas sur téléphone).
function meteorTouchesVisually() {
  try {
    var AZE = root.AZEvent;
    var mp = AZE && AZE.meteorPos, zp = AZE && AZE.zeroPointPos;
    if (!mp || !zp) return false;
    if (!isFinite(mp.x) || !isFinite(mp.y) || !isFinite(mp.z)) return false;
    if (!isFinite(zp.x) || !isFinite(zp.y) || !isFinite(zp.z)) return false;
    var dx = mp.x - zp.x, dy = mp.y - zp.y, dz = mp.z - zp.z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var rm = AZE.meteorVisR, rz = AZE.zeroPointVisR;
    if (!isFinite(rm) || rm <= 0) {
      // v23 : repli MIROIR EXACT d'event-meteor.js (au lieu du 57 fixe qui
      // pouvait faire conclure ~4 m trop tôt à haute altitude) :
      // 30 × (1 + altK×1.6 + proxK×0.9), altK/proxK sur la hauteur live
      // au-dessus du centre de l'orbe.
      var hAbove = mp.y - zp.y;
      var altK = hAbove / 3500; altK = altK < 0 ? 0 : (altK > 1 ? 1 : altK);
      var prxK = 1 - hAbove / 900; prxK = prxK < 0 ? 0 : (prxK > 1 ? 1 : prxK);
      rm = 30 * (1 + altK * 1.6 + prxK * 0.9);
    }
    if (!isFinite(rz) || rz <= 0) rz = 15 * 1.5; // repli : orbe révélée (×1.5)
    var cr = (rm + rz) * 0.5; // v20 : chevauchement, pas tangence
    return d2 < cr * cr;
  } catch (e) { return false; }
}
// v17 : DÉCISION D'ÉTAT DE L'ORBE à l'init tardive — INCONTESTABLE et
// testable (/tmp/v17-bug-check.js).
//   'destroy'  : contact confirmé, ou phase déjà dépassée (l'impact est
//                derrière nous : l'orbe est détruite) ;
//   'wait'     : phase 'impact' EN COURS sans contact confirmé et sans
//                proximité réelle -> l'orbe RESTE VISIBLE et attend
//                'meteor:hit'. JAMAIS d'explosion avant le contact réel ;
//   'collapse' : l'effondrement démarre (résidu -> trou noir).
function decideOrbFate(r, confirmed, close) {
  if (r === 'impact') return (confirmed || close) ? 'destroy' : 'wait';
  if (r === 'quiet' || r === 'gone') return 'destroy';
  if (r === 'collapse') return 'collapse';
  return 'wait';
}

// Recalage si init() arrive en cours d'event (enregistrement tardif).
// v17 : INCONTESTABLE — avant, l'orbe était détruite sur la SEULE entrée
// en phase 'impact'/'quiet' (init tardive en pleine phase 'impact' AVANT
// le contact = « le Point Zéro explose avant que la météorite ne touche »).
// v18 : le repli vérifie le CONTACT VISUEL RÉEL (meteorTouchesVisually :
// dist live < R_m + R_z), pas un seuil fixe — aligné sur event-impact.js.
function syncToState() {
  if (!root.AZEvent.active || !group) return;
  var r = regime(root.AZEvent.state);
  var fate = decideOrbFate(r, contactConfirmed, meteorTouchesVisually());
  if (fate === 'destroy') {
    destroyed = true;
    group.visible = false;
  } else if (fate === 'collapse') {
    if (!collapseDone && collapseT < 0) startCollapse();
  }
  // 'wait' : on ne touche à rien — l'orbe reste visible jusqu'au contact réel.
}

// Démarre la séquence d'effondrement (phase collapse).
function startCollapse() {
  collapseT = 0;
  destroyed = true; // l'orbe "normale" ne revient plus
  group.visible = true;
  // On cache les visuels de l'orbe : seul le résidu réapparaît.
  core.visible = false;
  for (var ci = 0; ci < shells.length; ci++) shells[ci].visible = false;
  halo.visible = false;
  bubble.visible = false;
  distortA.visible = false;
  distortB.visible = false;
  mirage.visible = false;                 // v15
  if (mirage2) mirage2.visible = false;   // v15
  fateRing.visible = false;               // v15
  nrFlash.visible = false;                // v15 (claquera à ~2,9 s)
  nrFlashDone = false; nrFlashT = 0;      // v15 : réarmé
  darkRim.visible = true;                 // v15
  darkRim.material.opacity = 0.0;
  for (var i = 0; i < rings.length; i++) rings[i].visible = false;
  for (var bi2 = 0; bi2 < bands.length; bi2++) bands[bi2].visible = false; // v12
  coreInner.visible = false;  // v12
  coreGlow.visible = false;   // v12
  for (var j = 0; j < tendrils.length; j++) tendrils[j].visible = false;
  for (var sv2 = 0; sv2 < skyVent.length; sv2++) skyVent[sv2].visible = false; // v17
  ventK = 0; // v17 : les évents meurent avec l'orbe
  for (var gy2 = 0; gy2 < geysers.length; gy2++) geysers[gy2].visible = false; // v21
  geyserK = 0; // v21 : les geysers meurent avec l'orbe
  approachK = 0; // v22 : la réaction meurt avec l'orbe
  for (var d = 0; d < debris.length; d++) debris[d].visible = false;
  filaments.visible = false;
  influx.visible = false;     // v12
  groundCracks.visible = false; // v12
  for (var pw2 = 0; pw2 < pulseWaves.length; pw2++) pulseWaves[pw2].mesh.visible = false; // v12
  // Visuels d'effondrement.
  residue.visible = true;
  darkCore.visible = true;
  spiral.visible = true;
  bigRing.visible = true;
}

// --------------------------------------------------------------- update ---
function update(dt, t) {
  if (disposed || !api || !group) return;
  // Inactif hors event : le jeu normal ne doit jamais être affecté.
  if (!root.AZEvent.active) return;
  if (dt <= 0) return;
  // Position publiée en direct (le groupe ne bouge pas, mais la référence
  // reste fraîche pour les modules qui la lisent).
  if (root.AZEvent.zeroPointPos) root.AZEvent.zeroPointPos.copy(group.position);
  // v18 : rayon visuel live de l'orbe publié (event-impact.js : contact
  // visuel réel dist < R_m + R_z). Pendant 'impact' l'update retourne
  // avant (voir ci-dessous) : la valeur reste figée sur la taille réelle
  // de l'orbe au moment du contact — c'est exactement ce qu'on veut.
  if (root.AZEvent) root.AZEvent.zeroPointVisR = orbVisR;

  // ---- Effondrement : priorité sur tout.
  if (collapseT >= 0 && !collapseDone) {
    collapseT += dt;
    updateCollapse(dt, t);
    return;
  }
  if (collapseDone) return;

  var r = regime(root.AZEvent.state);
  // L'effondrement démarre même si l'orbe a été détruite à l'impact :
  // un résidu d'énergie réapparaît au centre.
  if (r === 'collapse' && !collapseDone) { startCollapse(); return; }
  // Régimes sans visuel (l'orbe est détruite ou l'event est terminé).
  // v17 : les évents célestes s'éteignent en fondu (jamais figés).
  // v21 : pendant 'impact' AVANT le contact, l'orbe ne se fige plus : elle
  // RÉAGIT à la météorite qui fond sur elle (updatePreImpact, cause->effet).
  if (r === 'gone' || r === 'quiet' || destroyed) {
    approachK = Math.max(0, approachK - dt * 0.6); // v22 : la réaction retombe en fondu
    fadeSkyVent(dt); fadeGeysers(dt); return;
  }
  if (r === 'impact') { updatePreImpact(dt, t); return; }
  approachK = Math.max(0, approachK - dt * 0.6); // v22 : hors impact, la réaction retombe en fondu

  // v17 : les évents célestes suivent la pression en fondu doux.
  // v21 : les geysers d'énergie aussi.
  var wantVent = (r === 'pressure') ? pressureK() : 0;
  ventK += (wantVent - ventK) * Math.min(1, dt * 2.5);
  geyserK += (wantVent - geyserK) * Math.min(1, dt * 2.5);

  // ---- Chrono de pression : accumulation RELATIVE pendant 'pressure'
  // (descent -> veeroff). Réinitialisé hors pression pour un restart propre.
  if (r === 'pressure') {
    if (pressureT < 0) pressureT = 0;
    pressureT += dt;
  } else {
    pressureT = -1;
  }

  // ---- Intensité selon le régime.
  var intensity, pulsSpeed, pulsAmp, targetOrb, targetBubble;
  if (r === 'dormant') {
    intensity = 0.35; pulsSpeed = 1.2; pulsAmp = 0.08;
    targetOrb = 1.0; targetBubble = 1.0;
  } else if (r === 'strike') {
    intensity = 0.9; pulsSpeed = 4.0; pulsAmp = 0.10;
    targetOrb = 1.05; targetBubble = 1.0;
  } else if (r === 'agitated') {
    intensity = 1.0; pulsSpeed = 3.2; pulsAmp = 0.12;
    targetOrb = 1.15; targetBubble = 1.05;
  } else if (r === 'revealed') {
    // RÉVÉLATION : l'orbe grandit (x1.5), pulsations fortes.
    intensity = 1.9; pulsSpeed = 5.5; pulsAmp = 0.18;
    targetOrb = 1.5; targetBubble = 1.3;
  } else { // 'pressure' : descent / veeroff — v10 : EXTRÊMEMENT instable
    // La bulle résiste : pulsations de plus en plus rapides et intenses.
    var press = pressureK(); // 0 -> 1 sur descent+veeroff
    intensity = 1.6 + press * 2.2;
    pulsSpeed = 6.0 + press * 12.0;
    pulsAmp = 0.16 + press * 0.16;
    targetOrb = 1.5; targetBubble = 1.3;
  }
  var pressure = (r === 'pressure');

  // ---- v15 : BATTEMENT DE CŒUR — la pulsation S'ACCÉLÈRE à l'approche des
  // phases critiques : lent en dormant, qui s'emballe en révélation, et
  // frénétique sous pression (descent/veeroff). Double-thump (lub-dub).
  var shChaos = strikeFlash > 0 ? Math.min(1, strikeFlash / 2.8) : 0;
  var critK = pressure ? pressureK()
    : (r === 'revealed' ? 0.55 : (shChaos > 0 ? 0.5 : (r === 'strike' ? 0.35 : 0.12)));
  var hbRate = 1.5 + critK * 4.5; // battements/s : ~1,7 -> ~6
  var hbPh = (t * hbRate) % 1;
  var hb = Math.exp(-hbPh * 14) + 0.65 * Math.exp(-Math.abs(hbPh - 0.30) * 26);
  hbNow = Math.min(1.4, hb);
  critNow = critK;

  // ---- Instabilité : flashs intenses aléatoires (v10 : bien plus
  // fréquents sous pression — le Point Zéro est EXTRÊMEMENT instable).
  if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
  else if (Math.random() < dt * (r === 'revealed' ? 1.8 : (pressure ? 2.6 : 0.25))) {
    flash = 0.5 + Math.random() * 0.5;
    if (root.AZEvent.fx && root.AZEvent.fx.burst) {
      try {
        root.AZEvent.fx.burst(group.position, {
          count: 40, color: 0xbfe6ff, speed: 42, life: 0.6
        });
      } catch (e) { /* helper indisponible : on ignore */ }
    }
  }

  // ---- Pulsation de l'orbe (v15 : le battement de cœur s'y superpose —
  // le cœur "cogne" d'autant plus fort que la phase est critique).
  var puls = 1 + Math.sin(t * pulsSpeed) * pulsAmp;
  var orbS = core.scale.x + (targetOrb * puls * (1 + hbNow * 0.07 * (0.4 + critNow)) - core.scale.x) * Math.min(1, dt * 3);
  core.scale.set(orbS, orbS, orbS);
  orbVisR = 15 * orbS; // v18 : rayon visuel live = cœur (r=15) × échelle live

  // ---- Les 4 coquilles : pulsations ALTERNÉES (déphasées de PI/2).
  // (v15 : shChaos est calculé plus haut, avec le battement de cœur.)
  var shVis = 1.0; // facteur de visibilité selon le régime
  if (r === 'dormant') shVis = 0.75;
  else if (r === 'strike') shVis = 1.1;
  else if (r === 'agitated') shVis = 1.2;
  else if (r === 'revealed') shVis = 1.8;
  else if (pressure) shVis = 1.7 + pressureK() * 0.9;
  for (var si = 0; si < shells.length; si++) {
    var shm = shells[si];
    var shu = shm.userData;
    // Alternance : chaque coquille pulse à contre-temps de la précédente.
    var shAlt = 1 + Math.sin(t * pulsSpeed * 1.6 + shu.phase) * (pulsAmp * 1.6);
    var shSc = orbS * shu.ratio * shAlt;
    if (shChaos > 0) {
      // DÉSTABILISATION chaotique à l'impact de la fusée (phase strike) :
      // les coquilles se déforment et tremblent autour du coeur.
      var shJit = 1 + (Math.random() - 0.5) * 0.22 * shChaos;
      shm.scale.set(shSc * shJit, shSc * (2 - shJit), shSc * shJit);
      shm.position.set(
        (Math.random() - 0.5) * 6 * shChaos,
        (Math.random() - 0.5) * 6 * shChaos,
        (Math.random() - 0.5) * 6 * shChaos
      );
    } else if (pressure) {
      // La coquille résiste : écrasement asymétrique sous la pression.
      var pkS = pressureK();
      var wobS = Math.sin(t * (10 + pkS * 14) + shu.phase) * (0.08 + pkS * 0.12);
      shm.scale.set(shSc * (1 + wobS), shSc * (1 - wobS * 1.5), shSc * (1 + wobS * 0.5));
      shm.position.set(0, 0, 0);
    } else {
      shm.scale.set(shSc, shSc, shSc);
      shm.position.set(0, 0, 0);
    }
    shm.material.opacity = Math.min(0.95,
      shu.baseOp * shVis + flash * 0.35 + shChaos * 0.25);
  }

  // ---- Bulle : en pression elle SE DÉFORME ÉLASTIQUEMENT (résiste à la
  // météorite). v10 : double harmonique — la bulle "respire" comme une
  // membrane sous la pression, écrasement vertical marqué.
  if (pressure) {
    var pk = pressureK();
    var wob = Math.sin(t * (10 + pk * 16)) * (0.10 + pk * 0.14)
            + 0.5 * Math.sin(t * (23 + pk * 22) + 1.3) * (0.05 + pk * 0.08);
    bubble.scale.set(
      targetBubble + wob,
      targetBubble - wob * 1.9,
      targetBubble + wob * 0.6
    );
    bubble.material.opacity = 0.24 + Math.abs(wob) * 2.6 + flash * 0.35;
  } else {
    var curB = bubble.scale.x;
    var bubS = curB + (targetBubble - curB) * Math.min(1, dt * 2.5);
    bubble.scale.set(bubS, bubS, bubS);
    bubble.material.opacity = 0.15 + flash * 0.2;
  }

  // ---- Scintillement de la bulle après l'impact de la fusée.
  if (strikeFlash > 0) {
    strikeFlash -= dt;
    var flick = 0.5 + 0.5 * Math.sin(t * 45);
    bubble.material.opacity = Math.max(bubble.material.opacity,
      0.15 + flick * 0.55 + flash * 0.3);
  }

  // ---- Teinte : du bleu vers le rouge par moments (instabilité).
  var wobC = 0.5 + 0.5 * Math.sin(t * 2.2 + Math.sin(t * 7.3) * 1.7);
  var hot = (r === 'revealed' || pressure);
  var redMix = hot ? wobC * wobC * 0.85 + flash * 0.4 : flash * 0.3;
  core.material.color.copy(coreBlue).lerp(coreRed, Math.min(1, redMix));

  // ---- Halo : suit la pulsation et les flashs.
  // RÉVÉLATION : la sphère devient très visible (greatrift/meteorsix, pression).
  halo.material.opacity = (r === 'dormant' ? 0.45 : (hot ? 1.0 : 0.8)) + flash * 0.5;
  var hs = 52 * (0.9 + (puls - 1) * 2) + flash * 18;
  halo.scale.set(hs, hs, 1);

  // ---- Distorsion circulaire (descent/veeroff) : anneaux animés.
  updateDistortion(dt, t, pressure);
  updateMirage(dt, t, hot, pressure); // v15 : l'espace se déforme autour

  // ---- v12 : cœur incandescent, bandes, afflux, ondes, fissures au sol.
  updateCoreGlow(dt, t, intensity, puls, hot);
  animateBands(dt, t, intensity, pressure);
  animateInflux(dt, hot);
  updatePulseWaves(dt, t, pulsSpeed, intensity);
  updateGroundCracks(t, hot);

  animateAmbient(dt, t, intensity);
  animateTendrils(dt, t, intensity);
  animateSkyVent(dt, t); // v17 : évents célestes (pression uniquement)
  animateGeysers(dt, t); // v21 : geysers d'énergie (pression uniquement)
  animateDebris(dt, t);
  animateFilaments(dt, t, hot);
}

// v21 — PRÉ-IMPACT : la météorite FOND sur le Point Zéro — l'orbe RÉAGIT
// (cause -> effet) : battement de cœur frénétique qui s'accélère avec la
// proximité live de la météorite, cœur qui blanchit, coquilles qui se
// resserrent, évents célestes et geysers en surpuissance, fissures au sol
// embrasées. L'orbe reste VISIBLE et ANIMÉE jusqu'au contact réel
// ('meteor:hit' -> destroyed) — jamais d'explosion avant le toucher.
function updatePreImpact(dt, t) {
  // Proximité live de la météorite (0 = loin, 1 = contact), positions live.
  var prox = 0.5;
  try {
    var AZE = root.AZEvent;
    var mp = AZE && AZE.meteorPos;
    if (mp && isFinite(mp.x) && isFinite(mp.y) && isFinite(mp.z)) {
      var dx = mp.x - group.position.x, dy = mp.y - group.position.y, dz = mp.z - group.position.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      prox = d >= 1200 ? 0 : 1 - d / 1200;
    }
  } catch (e) { /* repli : prox = 0.5 */ }
  approachK = prox; // v22 : la réaction suit la proximité LIVE (retombe en fondu hors impact)
  // Battement de cœur frénétique, qui s'accélère avec la proximité.
  var hbRate = 3 + prox * 9; // v22 : 3 -> 12 battements/s — le cœur S'AFFOLE (était 3+6)
  var hbPh = (t * hbRate) % 1;
  var hb = Math.exp(-hbPh * 12) + 0.65 * Math.exp(-Math.abs(hbPh - 0.30) * 24);
  hbNow = Math.min(1.4, hb);
  critNow = 0.7 + prox * 0.3;
  // Le cœur BLANCHIT (cause -> effet : il encaisse l'approche).
  core.material.color.copy(coreBlue).lerp(coreRed, 0.15 * (1 - prox));
  var cp = 1 + hbNow * 0.10;
  coreInner.scale.set(cp, cp, cp);
  coreInner.material.opacity = Math.min(1, 0.80 + prox * 0.15 + hbNow * 0.15);
  coreGlow.material.opacity = Math.min(1, 0.80 + hbNow * 0.20);
  var gs = (44 + prox * 26) * (1 + hbNow * 0.08);
  coreGlow.scale.set(gs, gs, 1);
  // L'orbe gonfle légèrement ; les coquilles SE RESSERRENT (elle se tend).
  var orbS = core.scale.x + ((1.5 + prox * 0.25) * (1 + hbNow * 0.06) - core.scale.x) * Math.min(1, dt * 3);
  core.scale.set(orbS, orbS, orbS);
  orbVisR = 15 * orbS; // v18 : rayon visuel live tenu à jour jusqu'au contact
  var sq = 1 - prox * 0.16;
  for (var si = 0; si < shells.length; si++) {
    var shm = shells[si];
    var shu = shm.userData;
    var shAlt = 1 + Math.sin(t * (10 + prox * 10) + shu.phase) * 0.10;
    var shSc = orbS * shu.ratio * shAlt * sq;
    // v22 : SPASMES de contraction — à très haute proximité, les coquilles
    // tressaillent (l'orbe encaisse l'approche).
    if (prox > 0.7) shSc *= 1 + Math.sin(t * 61 + si * 7) * 0.035 * prox;
    shm.scale.set(shSc, shSc, shSc);
    shm.material.opacity = Math.min(1, shu.baseOp * 2.4 + prox * 0.25);
  }
  // Halo en surpuissance.
  halo.material.opacity = Math.min(1.2, 1.0 + prox * 0.2 + hbNow * 0.15);
  var hs = (52 + prox * 30) * (1 + hbNow * 0.07);
  halo.scale.set(hs, hs, 1);
  // v22 : l'ESPACE SE DÉCHIRE autour de l'orbe à l'approche — les anneaux
  // de distorsion se rallument avec la proximité (cause -> effet).
  if (distortA && distortB) {
    var dOn22 = prox > 0.02;
    distortA.visible = dOn22;
    distortB.visible = dOn22;
    if (dOn22) {
      distortA.rotation.z += dt * (2 + prox * 7);
      distortB.rotation.z -= dt * (1.6 + prox * 5.5);
      var dg22 = 1 + prox * 0.55;
      var dp22 = 1 + Math.sin(t * (9 + prox * 14)) * (0.05 + prox * 0.10);
      distortA.scale.set(dp22 * dg22, dp22 * dg22, 1);
      distortB.scale.set((2 - dp22) * dg22, (2 - dp22) * dg22, 1);
      distortA.material.opacity = prox * 0.75 * (0.8 + 0.2 * Math.sin(t * 33));
      distortB.material.opacity = prox * 0.60 * (0.8 + 0.2 * Math.cos(t * 29));
    }
  }
  // Évents célestes + geysers en surpuissance (fondu doux, jamais figés).
  ventK += (1 - ventK) * Math.min(1, dt * 3);
  animateSkyVent(dt, t);
  geyserK += (1 - geyserK) * Math.min(1, dt * 3);
  animateGeysers(dt, t);
  // Ondes de pulsation frénétiques, bandes embrasées, sol qui se fissure de lumière.
  updatePulseWaves(dt, t, 8 + prox * 10, 2.5 + prox * 2);
  animateBands(dt, t, 2.5 + prox * 2, false);
  updateGroundCracks(t, true);
  groundCracks.material.opacity = Math.min(1, groundCracks.material.opacity + prox * 0.4);
  // L'orbe FRÉMIT (tremblement ancré, sans dérive).
  var tr = prox * 1.6;
  group.position.x = baseX + Math.sin(t * 41) * tr;
  group.position.z = baseZ + Math.cos(t * 37) * tr;
}

// v21 : GEYSERS D'ÉNERGIE — piliers ondulants qui jaillissent du sol autour
// de la bulle. Intensité pilotée par geyserK (0..1), en fondu doux.
function animateGeysers(dt, t) {
  for (var i = 0; i < geysers.length; i++) {
    var line = geysers[i];
    var u = line.userData;
    line.visible = geyserK > 0.02;
    if (!line.visible) continue;
    var attr = line.geometry.getAttribute('position');
    var baseY = -orbY + 8; // groupe-local : ~8 m au-dessus du sol
    var bx = Math.cos(u.ang) * u.r0, bz = Math.sin(u.ang) * u.r0;
    for (var s = 0; s <= 16; s++) {
      var k = s / 16;
      var wob = Math.sin(t * u.speed + u.phase + k * 4.0) * u.wob * k;
      var wob2 = Math.cos(t * u.speed * 0.85 + u.phase * 1.6 + k * 3.0) * u.wob * 0.7 * k;
      attr.setXYZ(s, bx * (1 - k * 0.25) + wob, baseY + k * u.h, bz * (1 - k * 0.25) + wob2);
    }
    attr.needsUpdate = true;
    var pulse = 0.55 + 0.45 * Math.sin(t * 4.1 + u.phase * 2.0);
    line.material.opacity = geyserK * (0.4 + 0.55 * pulse) * (1 + approachK * 0.8); // v22 : surpuissance à l'approche
  }
}

// v21 : quand la pression retombe, les geysers s'éteignent en fondu —
// jamais figés en l'air.
function fadeGeysers(dt) {
  if (geyserK <= 0) return;
  geyserK = Math.max(0, geyserK - dt * 2.2);
  for (var i = 0; i < geysers.length; i++) {
    geysers[i].material.opacity = geyserK * 0.6;
    if (geyserK <= 0.02) geysers[i].visible = false;
  }
}

// Progression de la pression sur descent + veeroff, pilotée par le RÉGIME
// (aucun temps absolu) : pressureT s'accumule dans update() tant que le
// régime est 'pressure', puis sature à 1 (pression maximale à la traversée).
function pressureK() {
  if (pressureT < 0) return 0;
  return Math.min(1, pressureT / 28); // v17 : 28 s = 20 s (descent) + 8 s (veeroff), diviseur inchangé
}

// ÉNORME DISTORSION CIRCULAIRE autour du Point Zéro pendant la descente.
// v10 : anneaux agrandis avec la pression, rotation et pulsation extrêmes.
function updateDistortion(dt, t, pressure) {
  var show = pressure && !destroyed;
  distortA.visible = show;
  distortB.visible = show;
  if (!show) return;
  var pk = pressureK();
  // Les anneaux tournent en sens inverse, de plus en plus vite.
  distortA.rotation.z += dt * (1.6 + pk * 4.2);
  distortB.rotation.z -= dt * (1.2 + pk * 3.2);
  // La distorsion GRANDIT avec la pression : l'espace se déchire.
  var grow = 1 + pk * 0.65;
  // Pulsation de la distorsion : l'espace "respire" sous la pression.
  var pulse = 1 + Math.sin(t * (8 + pk * 12)) * (0.06 + pk * 0.12);
  distortA.scale.set(pulse * grow, pulse * grow, 1);
  distortB.scale.set((2 - pulse) * grow, (2 - pulse) * grow, 1);
  distortA.material.opacity = 0.40 + pk * 0.50 + Math.sin(t * 30) * 0.12;
  distortB.material.opacity = 0.30 + pk * 0.40 + Math.cos(t * 26) * 0.10;
  // v15 : l'ANNEAU DU POINT DE NON-RETOUR se resserre autour de l'orbe à
  // mesure que la pression monte — fin, brillant, de plus en plus rapide.
  if (fateRing) {
    fateRing.visible = show;
    if (show) {
      var fr = 80 - pk * 54; // 80 -> 26 m : resserrement dramatique
      fateRing.scale.set(fr, fr, 1);
      fateRing.rotation.z -= dt * (2.5 + pk * 6.0);
      fateRing.material.opacity = Math.min(1, 0.25 + pk * 0.65 + Math.sin(t * 40) * 0.08 * pk);
    }
  }
}

// v15 — Dômes de distorsion : l'espace ONULE autour du Point Zéro.
// Les deux dômes striés tournent en sens inverse (contre-rotation) et
// respirent en opposition de phase : effet de lentille / déformation
// visuelle de l'espace, sans post-traitement.
function updateMirage(dt, t, hot, pressure) {
  var show = (hot || pressure) && !destroyed && mirage;
  if (mirage) mirage.visible = !!show;
  if (mirage2) mirage2.visible = !!show;
  if (!show) return;
  var pk = pressureK();
  mirage.material.opacity = Math.min(0.5,
    ((hot ? 0.10 : 0) + pk * 0.22 + flash * 0.15) * (0.75 + 0.25 * Math.sin(t * 9.1)));
  mirage.rotation.y += dt * (0.25 + pk * 1.1);
  mirage.rotation.z += dt * 0.10 * pk;
  var ms = 1 + Math.sin(t * (6 + pk * 10)) * (0.015 + pk * 0.03);
  mirage.scale.set(ms, 2 - ms, ms);
  if (mirage2) {
    mirage2.material.opacity = Math.min(0.4, pk * 0.20 * (0.7 + 0.3 * Math.sin(t * 7.7 + 2)));
    mirage2.rotation.y -= dt * (0.35 + pk * 1.4); // CONTRE-ROTATION
    mirage2.rotation.x += dt * 0.12 * pk;
    var ms2 = 1 + Math.cos(t * (6 + pk * 10)) * (0.015 + pk * 0.03);
    mirage2.scale.set(ms2, 2 - ms2, ms2);
  }
}

// Anneaux, coquilles et halo : rotation continue, vitesse selon l'état.
function animateAmbient(dt, t, intensity) {
  var chaosA = strikeFlash > 0 ? Math.min(1, strikeFlash / 2.8) : 0;
  for (var i = 0; i < rings.length; i++) {
    var r = rings[i];
    r.rotation.z += r.userData.speed * dt * (0.6 + intensity);
    r.rotation.x += r.userData.speed * 0.3 * dt * intensity;
    if (chaosA > 0) {
      // Impact de la fusée : les 3 anneaux orbitaux tremblent violemment.
      r.rotation.x += Math.sin(t * 31 + i * 2.4) * chaosA * dt * 3;
      r.rotation.y += Math.cos(t * 27 + i * 1.9) * chaosA * dt * 3;
    }
  }
  // Les 4 coquilles tournent en sens alternés (contre-rotation lisible).
  for (var ambJ = 0; ambJ < shells.length; ambJ++) {
    var shm2 = shells[ambJ];
    shm2.rotation.y += shm2.userData.spin * dt * (0.6 + intensity);
    shm2.rotation.x += shm2.userData.spin * 0.3 * dt * intensity;
  }
  halo.material.rotation += dt * 0.2 * intensity;
}

// Vrilles : ondule les points de contrôle des courbes de Bézier.
function animateTendrils(dt, t, intensity) {
  for (var i = 0; i < tendrils.length; i++) {
    var line = tendrils[i];
    var u = line.userData;
    var attr = line.geometry.getAttribute('position');
    var th = u.theta + t * 0.35 * (0.5 + intensity);
    // Point d'ancrage : glisse sur la surface de l'orbe.
    var p0x = Math.cos(th) * 12 * Math.sin(u.phi);
    var p0y = Math.cos(u.phi) * 12;
    var p0z = Math.sin(th) * 12 * Math.sin(u.phi);
    // Points de contrôle : ondulation sinusoïdale.
    var w1 = Math.sin(t * u.speed + u.phase) * 6;
    var w2 = Math.cos(t * u.speed * 0.7 + u.phase * 1.3) * 6;
    var p1x = p0x * 1.7 + w1, p1y = p0y * 1.7 + w2, p1z = p0z * 1.7 - w1;
    var p2x = p0x * 2.6 + w2, p2y = p0y * 2.6 + w1, p2z = p0z * 2.6 + w2;
    for (var s = 0; s <= 32; s++) {
      var k = s / 32;
      var ik = 1 - k;
      // Courbe de Bézier quadratique : (1-k)²·P0 + 2(1-k)k·P1 + k²·P2.
      attr.setXYZ(s,
        ik * ik * p0x + 2 * ik * k * p1x + k * k * p2x,
        ik * ik * p0y + 2 * ik * k * p1y + k * k * p2y,
        ik * ik * p0z + 2 * ik * k * p1z + k * k * p2z
      );
    }
    attr.needsUpdate = true;
    line.material.opacity = 0.35 + 0.45 * intensity;
  }
}

// v17 : ÉVENTS CÉLESTES — les jets ondulent comme des flammes verticales :
// l'ondulation grandit avec l'altitude, une pulsation lumineuse monte
// le long de chaque jet (déphasée par jet).
function animateSkyVent(dt, t) {
  for (var i = 0; i < skyVent.length; i++) {
    var line = skyVent[i];
    var u = line.userData;
    line.visible = ventK > 0.02;
    if (!line.visible) continue;
    var attr = line.geometry.getAttribute('position');
    var bx = Math.cos(u.ang) * u.r0, bz = Math.sin(u.ang) * u.r0;
    for (var s = 0; s <= 24; s++) {
      var k = s / 24;
      var wob = Math.sin(t * u.speed + u.phase + k * 5.0) * u.wob * k;
      var wob2 = Math.cos(t * u.speed * 0.8 + u.phase * 1.7 + k * 3.0) * u.wob * 0.6 * k;
      attr.setXYZ(s,
        bx * (1 - k * 0.4) + wob,
        12 + k * u.h,
        bz * (1 - k * 0.4) + wob2
      );
    }
    attr.needsUpdate = true;
    var pulse = 0.55 + 0.45 * Math.sin(t * 3.2 + u.phase * 2.0);
    line.material.opacity = ventK * (0.35 + 0.5 * pulse) * (1 + approachK * 0.8); // v22 : surpuissance à l'approche
  }
}

// v17 : quand la pression retombe (entrée en 'impact', destruction de
// l'orbe), les évents s'éteignent en fondu — jamais figés en l'air.
function fadeSkyVent(dt) {
  if (ventK <= 0) return;
  ventK = Math.max(0, ventK - dt * 2.2);
  for (var i = 0; i < skyVent.length; i++) {
    var line = skyVent[i];
    line.material.opacity = ventK * 0.6;
    if (ventK <= 0.02) line.visible = false;
  }
}

// Débris : lévitation sinusoïdale + rotation lente ; secoués à l'impact.
function animateDebris(dt, t) {
  var chaosD = strikeFlash > 0 ? Math.min(1, strikeFlash / 2.8) : 0;
  for (var i = 0; i < debris.length; i++) {
    var rock = debris[i];
    var u = rock.userData;
    rock.position.y = u.baseY + Math.sin(t * u.speed + u.phase) * u.amp;
    if (chaosD > 0) {
      // Impact de la fusée : les 12 rochers sont secoués autour de leur
      // ancrage (mouvement déterministe, sans dérive permanente).
      rock.position.x = u.baseX + Math.sin(t * 23 + i * 2.1) * 5 * chaosD;
      rock.position.z = u.baseZ + Math.cos(t * 19 + i * 1.7) * 5 * chaosD;
    } else {
      rock.position.x = u.baseX;
      rock.position.z = u.baseZ;
    }
    rock.rotation.x += u.spin * dt * (1 + chaosD * 4);
    rock.rotation.y += u.spin * 0.7 * dt * (1 + chaosD * 4);
  }
}

// Filaments : orbitent vite autour de l'orbe, dérive verticale.
function animateFilaments(dt, t, hot) {
  var attr = filaments.geometry.getAttribute('position');
  var spd = hot ? 2.2 : 1.0;
  for (var i = 0; i < filData.length; i++) {
    var f = filData[i];
    f.ang += dt * f.speed * spd;
    var rr = f.rad + Math.sin(t * 3 + i) * 2.5;
    var hh = f.h + Math.sin(t * 1.4 + i * 0.7) * 4;
    attr.setXYZ(i, Math.cos(f.ang) * rr, hh, Math.sin(f.ang) * rr);
  }
  attr.needsUpdate = true;
  filaments.material.opacity = hot ? 1.0 : 0.6;
}

// v12 — Cœur incandescent : la sphère blanche interne pulse avec l'orbe et
// devient de plus en plus opaque quand l'intensité monte (rév/pression) ;
// la lueur blanche dense suit la pulsation + les flashs.
// v15 : le BATTEMENT DE CŒUR (hbNow, qui s'accélère vers les phases
// critiques) fait "cogner" le cœur blanc — sursauts d'opacité et d'échelle.
function updateCoreGlow(dt, t, intensity, puls, hot) {
  var whiteK = Math.min(1, intensity / 2.2);
  var cp = 1 + Math.sin(t * 4.4) * 0.06 + hbNow * 0.05 * (0.4 + critNow);
  coreInner.scale.set(cp, cp, cp);
  coreInner.material.opacity = Math.min(1,
    0.5 + 0.4 * whiteK + flash * 0.4 + hbNow * 0.28 * (0.3 + critNow));
  coreInner.rotation.y += dt * (0.8 + intensity * 0.6);
  coreGlow.material.opacity = Math.min(1, (hot ? 0.75 : 0.5) + flash * 0.4 + hbNow * 0.22 * critNow);
  var gs = 34 * puls * (1 + hbNow * 0.06 * (0.5 + critNow)) + flash * 10;
  coreGlow.scale.set(gs, gs, 1);
}

// v12 — Bandes d'énergie : rotations rapides alternées, opacité liée à
// l'intensité, resserrement autour du cœur sous pression.
// v15 : contre-rotation MARQUÉE — les 5 bandes s'illuminent EN OPPOSITION
// de phase (quand l'une s'embrase, sa voisine s'éteint) et se resserrent
// plus fort sous pression.
function animateBands(dt, t, intensity, pressure) {
  for (var i = 0; i < bands.length; i++) {
    var b = bands[i];
    b.rotation.z += b.userData.spin * dt * (0.7 + intensity * 0.8);
    b.rotation.z += b.userData.spin * dt * approachK * 1.5; // v22 : les bandes s'emballent à l'approche
    var alt = 0.5 + 0.5 * Math.sin(t * 7 + i * Math.PI); // opposition
    b.material.opacity = Math.min(1,
      (0.30 + 0.45 * Math.min(1, intensity / 2) * (0.55 + 0.45 * alt)) + flash * 0.3);
    var squeeze = pressure ? (1 - pressureK() * 0.18) : 1;
    b.scale.set(squeeze, squeeze, 1);
  }
}

// v12 — Afflux : les particules sont aspirées VERS le centre (le Point Zéro
// attire la matière). Aspirées plus vite quand l'orbe est chaude.
function animateInflux(dt, hot) {
  var attr = influx.geometry.getAttribute('position');
  var suck = hot ? 1.6 : 1.0;
  for (var i = 0; i < influxData.length; i++) {
    var p = influxData[i];
    p.rad -= dt * p.spd * suck;
    p.ang += dt * p.spin * (0.5 + suck * 0.5);
    if (p.rad < 13) { // aspirée par le cœur : renaît en périphérie
      p.rad = 70 + Math.random() * 25;
      p.h = (Math.random() - 0.5) * 60;
      p.ang = Math.random() * Math.PI * 2;
    }
    var hh = p.h * (p.rad / 90);
    attr.setXYZ(i, Math.cos(p.ang) * p.rad, hh, Math.sin(p.ang) * p.rad);
  }
  attr.needsUpdate = true;
  influx.material.opacity = (hot ? 0.95 : 0.55) + flash * 0.3;
}

// v12 — Ondes de pulsation : 3 anneaux déphasés qui partent du cœur en
// rythme, synchronisés sur la pulsation de l'orbe (l'énergie rayonne).
function updatePulseWaves(dt, t, pulsSpeed, intensity) {
  var period = (Math.PI * 2) / Math.max(0.5, pulsSpeed);
  for (var i = 0; i < pulseWaves.length; i++) {
    var w = pulseWaves[i];
    var k = ((t / period) + w.off) % 1;
    var r = 16 + k * 46;
    w.mesh.scale.set(r / 16.5, r / 16.5, 1);
    w.mesh.material.opacity = (1 - k) * 0.55 * Math.min(1, intensity / 1.5);
    w.mesh.visible = w.mesh.material.opacity > 0.02;
    w.mesh.rotation.z += dt * 0.6;
  }
}

// v12 — Fissures lumineuses au sol : s'illuminent avec l'instabilité
// (pression + flashs), scintillement lent en régime dormant.
function updateGroundCracks(t, hot) {
  var gk = hot ? 1.0 : 0.5;
  var flick = 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  groundCracks.material.opacity =
    (0.22 + (pressureK() > 0 ? pressureK() * 0.55 : 0)) * gk * flick + flash * 0.35;
}

// ---- Effondrement (phase collapse [334,338], v14 : +48 s) :
// le Point Zéro s'effondre sur lui-même. Un résidu d'énergie réapparaît,
// l'espace autour se déforme (immense distorsion circulaire), la matière
// commence à tourner, le centre devient extrêmement sombre, la lumière est
// aspirée vers le centre, puis UN TROU NOIR SE FORME.
// Chrono interne RELATIF ~3 s (tient dans la fenêtre collapse, 4 s).
function updateCollapse(dt, t) {
  var k = collapseT; // secondes depuis le début de l'effondrement

  // Le résidu d'énergie apparaît (0-1 s), le centre s'assombrit.
  var kRes = Math.min(1, k / 1.0);
  residue.material.opacity = 0.85 * kRes * (0.75 + 0.25 * Math.sin(t * 18));
  var rs = 1 + Math.sin(t * 9) * 0.12 * kRes;
  residue.scale.set(rs, rs, rs);

  // Le centre devient extrêmement sombre et grandit (1-2,2 s).
  var kDark = Math.max(0, Math.min(1, (k - 1.0) / 1.2));
  var darkR = 2 + kDark * 16;
  darkCore.scale.set(darkR, darkR, darkR);
  darkCore.material.opacity = 0.92 * kDark;

  // Immense distorsion circulaire : tourne de plus en plus vite.
  var spin = 0.8 + k * 1.6;
  bigRing.rotation.z += dt * spin;
  var bs = 1 + k * 0.10;
  bigRing.scale.set(bs, bs, 1);
  bigRing.material.opacity = Math.min(0.9, 0.25 + k * 0.22);

  // La matière commence à tourner et est aspirée vers le centre.
  spiral.material.opacity = Math.min(0.95, k * 0.6);
  var sAttr = spiral.geometry.getAttribute('position');
  var pull = 1 + k * 2.4; // aspiration de plus en plus forte
  for (var i = 0; i < spiralData.length; i++) {
    var p = spiralData[i];
    p.ang += dt * p.speed * (1.2 + k * 1.6);
    p.rad -= dt * (6 + k * 16) * pull * 0.35;
    if (p.rad < 3) { // aspirée : renaît en périphérie
      p.rad = 55 + Math.random() * 15;
      p.h = (Math.random() - 0.5) * 30;
    }
    var rr = p.rad + Math.sin(t * 4 + i) * 2;
    sAttr.setXYZ(i, Math.cos(p.ang) * rr, p.h * (p.rad / 65), Math.sin(p.ang) * rr);
  }
  sAttr.needsUpdate = true;

  // La lumière est aspirée : le résidu rétrécit vers le centre sombre.
  if (k > 2.0) {
    var suck = Math.max(0.05, 1 - (k - 2.0) / 1.0);
    residue.scale.set(suck * rs, suck * rs, suck * rs);
    residue.material.opacity *= 0.94;
    spiral.material.opacity = Math.min(spiral.material.opacity, suck + 0.1);
  }

  // v13 : POINT DE NON-RETOUR — dans les derniers instants (~2,65-3,0 s),
  // tout se resserre BRUTALEMENT vers le centre (l'énergie s'écrase avant
  // de disparaître : anticipation de la naissance du trou noir).
  // v15 : rendu plus DRAMATIQUE — liseré brillant qui se resserre autour
  // du cœur sombre en s'embrasant, puis FLASH BLANC à ~2,9 s.
  if (k > 2.65) {
    var nrk = Math.min(1, (k - 2.65) / 0.35);
    var snap = 1 - 0.6 * nrk * nrk; // écrasement franc
    bigRing.scale.set(bs * snap, bs * snap, 1);
    bigRing.material.opacity = Math.min(1, 0.25 + k * 0.22 + nrk * 0.4);
    var suck2 = Math.max(0.05, 1 - (k - 2.0) / 1.0);
    residue.scale.set(suck2 * rs * snap, suck2 * rs * snap, suck2 * rs * snap);
    // Le liseré se resserre sur le cœur sombre et S'EMBRASE.
    if (darkRim) {
      darkRim.visible = true;
      var rimR = darkR * (1.30 - nrk * 0.30);
      darkRim.scale.set(rimR, rimR, 1);
      darkRim.material.opacity = Math.min(1, 0.30 + nrk * 0.70);
      darkRim.rotation.z -= dt * (3 + nrk * 9);
    }
  }
  // v15 : FLASH du point de non-retour (~2,9 s) — l'écran claque en blanc
  // un bref instant avant la naissance du trou noir.
  if (k >= 2.9 && !nrFlashDone && nrFlash) {
    nrFlashDone = true;
    nrFlashT = 0;
    nrFlash.visible = true;
  }
  if (nrFlash && nrFlash.visible) {
    nrFlashT += dt;
    var nf = Math.max(0, 1 - nrFlashT / 0.28);
    nrFlash.material.opacity = nf * nf;
    var nfs = 30 + (1 - nf) * 130;
    nrFlash.scale.set(nfs, nfs, 1);
    if (nf <= 0) nrFlash.visible = false;
  }

  // Formation du trou noir (~3 s après le début de l'effondrement).
  if (k >= 3.0 && !collapseDone) {
    collapseDone = true;
    group.visible = false; // le module ne montre plus rien après
    api.emit('blackhole:formed', {});   // le trou noir prend le relais
    api.emit('zeropoint:collapse', {}); // compatibilité (audio, autres modules)
  }
}

// ---------------------------------------------------------------- dispose -
function dispose() {
  disposed = true;
  // Le bus n'expose pas de off() : les handlers restants sont neutralisés
  // par le drapeau `disposed` et le test `root.AZEvent.active`.
  if (group && group.parent) group.parent.remove(group);
  if (group) {
    group.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (var i = 0; i < mats.length; i++) {
          if (mats[i].map) mats[i].map.dispose();
          mats[i].dispose();
        }
      }
    });
  }
  group = null;
  core = null;
  coreInner = null;   // v12
  coreGlow = null;    // v12
  shells = [];
  halo = null;
  rings = [];
  bands = [];         // v12
  tendrils = [];
  bubble = null;
  debris = [];
  filaments = null;
  filData = [];
  influx = null;      // v12
  influxData = [];    // v12
  pulseWaves = [];    // v12
  groundCracks = null;    // v12
  groundCrackTex = null;  // v12
  distortA = null;
  distortB = null;
  mirage = null;      // v15
  mirage2 = null;     // v15
  mirageTex = null;   // v15
  fateRing = null;    // v15
  nrFlash = null;     // v15
  nrFlashDone = false; nrFlashT = 0; // v15
  darkRim = null;     // v15
  hbNow = 0; critNow = 0; // v15
  lowQ = false;       // v15
  residue = null;
  darkCore = null;
  spiral = null;
  spiralData = [];
  bigRing = null;
  skyVent = [];      // v17 : réarmé (restart propre)
  ventK = 0;         // v17
  geysers = [];      // v21 : réarmé (restart propre)
  geyserK = 0;       // v21
  approachK = 0;     // v22 : réarmé (restart propre)
  baseZ = 0;         // v21 : réarmé (restart propre)
  orbVisR = 22.5;    // v18 : réarmé (restart propre)
  destroyed = false;
  contactConfirmed = false; // v17 : réarmé (restart propre)
  collapseT = -1;
  collapseDone = false;
  pressureT = -1;
  strikeFlash = 0;
  flash = 0;
  if (root.AZEvent) root.AZEvent.zeroPointPos = null;
  if (root.AZEvent) root.AZEvent.zeroPointVisR = null; // v18 : rayon visuel live
  api = null;
  T = null;
}

root.AZEvent.register('zeropoint', { init: init, update: update, dispose: dispose });

})(window);
