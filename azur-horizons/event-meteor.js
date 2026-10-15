/* ============================================================================
 * event-meteor.js — La MÉTÉORITE de l'événement "THE END" (v10).
 * Reproduction du live Fortnite Chapitre 1 Saison X (13/10/2019).
 *
 * VISIBILITÉ = PRIORITÉ #1 (la v4 la rendait invisible : bug critique).
 * Garanties de visibilité :
 *   1. Rocher GRAND : ~60 m de diamètre (ROCK_RADIUS = 30, v9).
 *   2. Matériaux ÉMISSIFS FORTS : le rocher lui-même a une émissive orange
 *      intense (indépendante des lumières de la scène) + flammes, halo et
 *      traînée en blending ADDITIF, donc lumineux par construction.
 *   3. fog:false sur tous les sprites additifs : ni le brouillard ni la
 *      distance ne les atténuent.
 *   4. Placée sur l'axe de l'île (api.center), sur le chemin des caméras
 *      d'event.
 *   5. Fort contraste : orange/rouge vif + bleu incandescent sur ciel noir
 *      étoilé. En cas de doute, tout est surdimensionné.
 *
 * États (pilotés par les événements de phase du séquenceur, JAMAIS de temps
 * absolus en dur) :
 *   - 'frozen'     countdown UNIQUEMENT : VISIBLE dès le départ, très haut
 *                    dans le ciel (800 m), en feu. v23 : elle n'est plus
 *                    JAMAIS figée — dérive orbitale lente, respiration
 *                    amplifiée, battement de cœur qui s'accélère vers T-0 :
 *                    la bête DORT mais elle VIT (exigence utilisateur :
 *                    « figée dans le ciel » -> TERMINÉ).
 *                    v24 — GRANDS BALAYAGES LISIBLES (l'utilisateur a raison :
 *                    la « dérive » v23 de 12 m à 800 m d'altitude était
 *                    INVISIBLE depuis le sol). Désormais : VASTES arcs dans
 *                    le ciel, orbite de ~320 m de rayon (~640 m d'envergure,
 *                    ~43° de champ vu du sol — impossible à rater sur un
 *                    téléphone), qui se RESSERRE vers T-0 (320 -> 240 m) ;
 *                    balancement vertical ±45 m ; respiration ±6 % -> ±15 % ;
 *                    pulsation LUMINEUSE qui grandit avec le réveil. Règle
 *                    d'or : tout mouvement est perceptible à ~800 m —
 *                    quand on doute, on amplifie. Interdit : les
 *                    micro-dérives de 12-22 m.
 *   - 'menace'     v23 : firstrocket -> fin d'acceleration — APPROCHE
 *                    MENACANTE : dérive lente vers l'axe de l'île en
 *                    descendant doucement + orbite menaçante + pulsation
 *                    qui s'intensifie. Jamais statique, toujours grande,
 *                    haute et visible. Puis 'unfreezing' (fin acceleration).
 *                    v24 — ORBITE MENACANTE GIGANTESQUE : rayon 380 m
 *                    (~760 m d'envergure) autour de la dérive d'approche +
 *                    vagues verticales ±70 m (elle FONCE et REMONTE,
 *                    menaçante) + pulsation d'échelle ±7 % -> ±15 % +
 *                    pulsation lumineuse qui s'intensifie. Toujours haute
 *                    (> 600 m), grande et visible.
 *   - 'unfreezing' FIN d'acceleration : elle se DÉFIGE — VIBRE en crescendo
 *                    (secousse croissante), des FRAGMENTS et des BRAISES se
 *                    détachent. Déclenché AU CHOIX par le groupe A :
 *                      1. bus 'meteor:unfreeze' (mécanisme recommandé), ou
 *                      2. AZEvent.meteorUnfrozen = true (lu chaque frame), ou
 *                      3. REPLI automatique : fin de la phase 'acceleration'
 *                         (relatif : tState >= durée(acceleration) - 9.5 s).
 *   - 'falling'    chute ACCÉLÉRÉE (ease-in) vers la faille AVANT, y entre,
 *                    disparaît en fondu dedans. Émet 'meteor:gone'
 *                    (event-rift.js referme tout dessus — contrat existant).
 *                    v17 — COHÉRENCE (demande critique utilisateur : « elle
 *                    n'y entre pas ») : la chute vise le CENTRE RÉEL de la
 *                    faille avant (position live lue dans AZ.rifts) ;
 *                    rétrécissement vers le centre + flash d'engloutissement
 *                    — on la voit disparaître DEDANS. Émet 'meteor:gone'
 *                    avec {pos, swallowed:true}.
 *                    La faille d'entrée elle-même est du ressort du module
 *                    des failles (autre groupe) ; ce module publie la cible
 *                    via AZEvent.meteorPos chaque frame.
 *   - 'hidden'     strike, thrown : INVISIBLE (la météorite est partie dans
 *                    la faille ; elle ne descend PAS pendant strike).
 *   - 'emerging'   greatrift : ÉMERGE de la GRANDE faille au-dessus du Point
 *                    Zéro en ease-out (croissance easeOutBack : pas
 *                    d'apparition sèche), puis commence à tomber.
 *                    v17 — COHÉRENCE : émerge AU CENTRE de la grande faille
 *                    (ancrée au-dessus du Point Zéro — même formule que
 *                    event-rift.js openGreatRift, ordre des écouteurs sans
 *                    effet) ; flash de naissance + bus 'meteor:emerging'
 *                    (event-rift.js : éclairs de sortie).
 *   - 'descending' meteorsix / descent / veeroff : descente continue vers le
 *                    Point Zéro (les 6 fusées l'escortent : event-rockets.js).
 *   - 'impacting'  impact : plongeon final vers le Point Zéro, LONGUE
 *                    traînée de feu.
 *   - 'gone'       après 'meteor:hit' (émis par event-impact.js).
 *   - 'rebound'    v11 : au flash d'impact, PLONGE dans le Point Zéro (~2 s)
 *                    puis ÉRUPTION balistique TRÈS HAUTE et TRÈS LOIN
 *                    (v14 : apogée 4016 m à t=8,55 s, fin à +3360 m, 2,4 km
 *                    au loin, 14 s au total — tient dans 'impact'
 *                    après le flash à 44 % de la phase, bornes relatives).
 *                    v17 : cycle PLUS NERVEUX — apogée 3402 m à t=6,0 s, fin
 *                    à +1890 m, 2,2 km au loin, 12 s au total (tient dans
 *                    'impact' après le contact à ~40 % de la phase).
 *
 * Publie chaque frame :
 *   AZEvent.meteorPos     (THREE.Vector3, position COURANTE)
 *   AZEvent.meteorVisible (booléen)
 * ========================================================================== */
(function (root) {
'use strict';

// Rien à faire si le séquenceur n'est pas chargé.
if (!root.AZEvent) return;
var AZ = root.AZEvent;

/* ---------------------------------------------------------------------------
 * PAS de temps absolus en dur : les transitions viennent du bus
 * ('phase:*', 'meteor:unfreeze', 'meteor:hit'), les progressions intra-phase
 * d'AZ.tState rapporté à la durée de la phase lue dynamiquement sur
 * AZ.TIMELINE, et les sous-chronos internes (vibration, chute, émergence)
 * s'accumulent en dt (relatifs).
 * ------------------------------------------------------------------------- */

/* ---------- Constantes ---------- */

var ROCK_RADIUS = 30;      // v9 : ~60 m de diamètre : TRÈS visible (était 22)
var ROCK_SEED = 1337;      // graine fixe : forme stable

// Sous-durées RELATIVES (secondes, accumulées en dt) de la séquence de
// défigeage en fin de phase 'acceleration'.
var VIB_DUR = 3.5;         // vibration crescendo avant la chute
var FALL_DUR = 4.0;        // chute accélérée vers la faille avant
var EMERGE_DUR = 3.0;      // émergence de la grande faille (greatrift)
// v17 — ALTITUDE D'ÉMERGENCE au-dessus du Point Zéro : miroir partagé avec
// event-rift.js (openGreatRift) — la faille ET la météorite utilisent la
// même formule, la cohérence faille/météorite est garantie.
var V17_EMERGE_ALT = 1300;

// v23 — PLONGÉE FULGURANTE : fraction de la phase 'impact' au bout de
// laquelle la trajectoire atteint le Point Zéro (k=1). 0,265 : le contact
// visuel réel tombe juste après la porte tState >= dur*0,25 de
// event-impact.js shouldFireFlash (le flash ne peut pas partir avant 25 %
// de la phase — AUCUN autre fichier n'est touché) : ~1137 m en ~10,3 s,
// soit ~110 m/s de moyenne (x2,2 par rapport aux ~50 m/s de la v20),
// pointe ~186 m/s. Relatif à la durée lue sur AZ.TIMELINE (aucun temps
// absolu en dur).
var IMPACT_CONTACT_FRAC = 0.265;
// v23 — phases couvertes par l'approche menaçante ('menace'), lues sur
// AZ.TIMELINE (aucun temps absolu en dur).
var MENACE_PHASES = ['firstrocket', 'sixrockets', 'convergence', 'loop', 'acceleration'];

// Phases pendant lesquelles la météorite descend (ordre chronologique).
// NOTE v10 : 'strike' et 'thrown' n'en font PLUS partie — la météorite est
// partie dans la faille en fin d'acceleration et n'en ressort qu'en greatrift.
var DESCENT_PHASES = ['meteorsix', 'descent', 'veeroff'];

/* ---------- État interne ---------- */

var M = {
  api: null, T: null,
  group: null,
  rock: null, rockMat: null, rockGeo: null,
  flames: null, flameTex: null,       // flammes orange/rouge vives
  smoke: null, smokeTex: null, smokeRand: null, // fumée grise/noire
  frags: null, fragTex: null,        // fragments bleus incandescents (+ détachement)
  embers: null, emberGeo: null, emberMat: null, emberTex: null, // BRAISES (v10)
  emberData: null, emberAcc: 0,
  halo: null, haloMat: null, haloTex: null,     // halo chaud orange-rouge
  haloLayers: null, fissureTex: null,            // v12 : halo 3 couches + fissures
  trail: null, trailMat: null, trailTex: null, // traînée de feu ÉNORME
  trailCore: null, trailCoreMat: null,       // v13 : noyau interne de la traînée
  points: null,      // Vector3[6] : jalons de la trajectoire
  emergePos: null,   // position de la grande faille (greatrift, dynamique)
  emergeEnd: null,   // fin d'émergence = début de meteorsix (pas de saut)
  fallFrom: null, fallTo: null,     // chute vers la faille avant
  curPhase: null,    // phase de descente courante ('meteorsix'..'impact')
  subT: 0,           // sous-chrono relatif (vibration / chute / émergence)
  detachK: 0,        // 0->1 : détachement des fragments pendant unfreezing
  diveV0: 1.0, diveA: 2.5, divePrev: null, // v23 : chaînage des vitesses de plongée (fulgurante)
  unfreezePos: null,                        // v23 : ancrage du défigeage (aucun snap vers points[0])
  menaceFrom: null, menaceTo: null,        // v23 : dérive de l'approche menaçante
  frozenK: 0, menaceK: 0,                    // v24 : progression du réveil (0->1) — pilote la pulsation lumineuse
  fade: 0, fadeTarget: 0,
  state: 'hidden',   // hidden|frozen|unfreezing|falling|emerging|descending|impacting|gone
  shakeAmp: 0,
  lastT: -1,
  disposed: false,
  busBound: false, // v23 : le bus n'a pas de off() — les écouteurs ne sont branchés qu'une fois
  // v21 : nouveautés — anneau de stase (gel), arcs de corona (descente),
  // anneau d'engloutissement (entrée de faille), anneaux soniques (plongée)
  lowQ: false,
  stasisRing: null, stasisMat: null,
  corona: null,
  swallowRing: null, swallowMat: null,
  diveRingT: 0, frozRumbleT: 5, frozBurstT: 2.5,
  rebApogeeDone: false,
  // v22 : dôme de chaleur (plongée), anneaux de déformation, 2e anneau de
  // stase (gel), 2e anneau d'engloutissement + claquement (faille),
  // implosion à l'apogée du rebond
  heatDome: null, heatDomeMat: null,
  warpA: null, warpB: null, warpMatA: null, warpMatB: null,
  stasisRing2: null, stasisMat2: null,
  swallowRing2: null, swallowMat2: null, clapT: -1,
  implSpr: null, implMat: null, implT: -1, apogeeImplodeDone: false
};

/* ---------------------------------------------------------------------------
 * Utilitaires
 * ------------------------------------------------------------------------- */

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function smooth(p) { p = clamp01(p); return p * p * (3 - 2 * p); }
function easeIn(p) { p = clamp01(p); return p * p; }
// easeOutBack : croissance avec léger dépassement — émergence organique,
// pas d'apparition sèche.
function easeOutBack(p) {
  p = clamp01(p);
  var c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
// easeOutElastic : dépassement oscillant — impacts et éruptions spectaculaires.
function easeOutElastic(p) {
  p = clamp01(p);
  if (p === 0 || p === 1) return p;
  return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}

// v13 — Battement de cœur « lub-dub » : double impulsion par période
// (~1,1 s). Pilote l'émissivité des fissures, le halo et les flammes de
// façon SYNCHRONISÉE : la météorite VIT.
function heartBeat(t) {
  var p = (t * 0.9) % 1;
  var a = Math.exp(-Math.pow((p - 0.12) * 9, 2));
  var b = 0.65 * Math.exp(-Math.pow((p - 0.34) * 9, 2));
  return Math.min(1, a + b);
}

// Générateur pseudo-aléatoire à graine fixe (mulberry32).
function seededRandom(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Durée d'une phase lue sur la timeline du séquenceur (repli : valeur spec).
function phaseDuration(name, fallback) {
  try {
    var b = AZ.TIMELINE && AZ.TIMELINE[name];
    if (b && isFinite(b[1] - b[0]) && (b[1] - b[0]) > 0) return b[1] - b[0];
  } catch (e) { /* repli sur la valeur par défaut */ }
  return fallback;
}

// Hauteur du Point Zéro (miroir de event-zeropoint.js : centre + 25 m).
function zeroY() {
  var c = (M.api && M.api.center) || { y: 30 };
  return c.y + 25;
}

// v14 — Coefficient de visibilité à grande distance : la météorite doit
// rester visible quand elle est TRÈS HAUT/LOIN (descente de super haut,
// éruption du rebond à ~4000 m). 0 au niveau du Point Zéro, 1 à 3500 m
// et plus. Pilote le grossissement du modèle, le glow du halo, les
// braises et la traînée — sans jamais toucher aux positions.
function altBoostK() {
  var gy = (M.group && isFinite(M.group.position.y)) ? M.group.position.y : zeroY();
  var k = (gy - zeroY()) / 3500;
  return k < 0 ? 0 : (k > 1 ? 1 : k);
}

// v15 — Proximité de l'impact : 0 au-dessus de 900 m, 1 au sol.
// Pilote le grossissement dramatique à l'approche (la chute ÉCRASE
// L'ÉCRAN), la secousse d'écran et le rugissement — crescendo avec la
// proximité. Positions intactes (ne touche qu'aux visuels).
function proxK() {
  var gy = (M.group && isFinite(M.group.position.y)) ? M.group.position.y : zeroY();
  var k = 1 - (gy - zeroY()) / 900;
  return k < 0 ? 0 : (k > 1 ? 1 : k);
}

// v13 — Position du Point Zéro pour le rebond : LIVE si publiée
// (AZEvent.zeroPointPos par event-zeropoint.js), repli calculé sinon.
// Corrige un bug v11/v12 : ZERO_FALLBACK n'était jamais défini ->
// ReferenceError au 'meteor:hit' (le rebond ne partait jamais).
function reboundZeroPos(T, out) {
  var zp = (root.AZEvent && (root.AZEvent.zeroPointPos || root.AZEvent.zeroPoint)) || null;
  if (zp && isFinite(zp.x) && isFinite(zp.y) && isFinite(zp.z)) return out.set(zp.x, zp.y, zp.z);
  var c = (M.api && M.api.center) || { x: 0, z: 0 };
  return out.set(c.x, zeroY(), c.z);
}

// Rang de progression (on ne recule jamais ; inconnu -> 0 = 'hidden').
function stateRank(s) {
  switch (s) {
    case 'hidden': return 0;
    case 'frozen': return 1;
    case 'menace': return 1; // v23 : approche menaçante — même rang que 'frozen' (pré-chute)
    case 'unfreezing': return 2;
    case 'falling': return 3;
    case 'emerging': return 4;
    case 'descending': return 5;
    case 'impacting': return 6;
    case 'rebound': return 6; // v11 : plongeon dans le Point Zéro puis éruption au-delà de la map
    case 'gone': return 7;
    default: return 0;
  }
}

/* ---------------------------------------------------------------------------
 * Textures procédurales (aucun asset externe)
 * ------------------------------------------------------------------------- */

// Sprite radial doux : cœur blanc -> fondu. La couleur vient du matériau.
function makeRadialTexture(T, size, innerAlpha) {
  var c = document.createElement('canvas');
  c.width = c.height = size;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,' + innerAlpha + ')');
  g.addColorStop(0.35, 'rgba(255,255,255,' + (innerAlpha * 0.5) + ')');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new T.CanvasTexture(c);
}

// Traînée de feu : dégradé vertical + fondu latéral (texture allongée).
function makeStreakTexture(T) {
  var c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  var ctx = c.getContext('2d');
  var g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in';
  var h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  return new T.CanvasTexture(c);
}

// Fumée : bouffée grise irrégulière, bords très diffus.
function makeSmokeTexture(T, size) {
  var c = document.createElement('canvas');
  c.width = c.height = size;
  var ctx = c.getContext('2d');
  var lobes = [[0.5, 0.5, 0.5], [0.38, 0.55, 0.34], [0.62, 0.5, 0.36],
               [0.5, 0.38, 0.3], [0.45, 0.62, 0.28]];
  for (var i = 0; i < lobes.length; i++) {
    var lx = lobes[i][0] * size, ly = lobes[i][1] * size, lr = lobes[i][2] * size;
    var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new T.CanvasTexture(c);
}

// v12 — FISSURES INCANDESCENTES : texture canvas (roche sombre + fissures
// orange incandescentes) utilisée en emissiveMap du rocher. Le fond garde
// une lueur de braise chaude, les fissures brillent très fort ; l'intensité
// globale pulse avec le battement de cœur (voir update).
function makeFissureTexture(T) {
  var size = 512;
  var c = document.createElement('canvas');
  c.width = c.height = size;
  var ctx = c.getContext('2d');
  // Fond : braise sombre (lueur de fond du rocher).
  ctx.fillStyle = '#2a1208';
  ctx.fillRect(0, 0, size, size);
  // Marbrures de roche chaude.
  var rand = seededRandom(4242);
  for (var i = 0; i < 60; i++) {
    var gx = rand() * size, gy = rand() * size, gr = 20 + rand() * 70;
    var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    if (rand() > 0.5) g.addColorStop(0, 'rgba(96,38,12,0.55)');
    else g.addColorStop(0, 'rgba(40,20,10,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  // Fissures incandescentes : lignes brisées orange, halo + cœur clair.
  // v13 : 48 fissures (étaient 30), plus longues et plus larges — densité
  // qui impressionne de près ; le pulse vient de l'émissivité (heartBeat).
  ctx.lineCap = 'round';
  for (var f = 0; f < 48; f++) {
    var x = rand() * size, y = rand() * size;
    var ang = rand() * Math.PI * 2;
    var segs = 5 + Math.floor(rand() * 6);
    ctx.shadowColor = 'rgba(255,110,20,0.9)';
    ctx.shadowBlur = 16;
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? 'rgba(255,122,26,0.95)' : 'rgba(255,228,175,0.95)';
      ctx.lineWidth = pass === 0 ? 6.5 : 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      var px = x, py = y, pa = ang;
      for (var sgm = 0; sgm < segs; sgm++) {
        var ln = 30 + rand() * 70;
        pa += (rand() - 0.5) * 1.1;
        px += Math.cos(pa) * ln; py += Math.sin(pa) * ln;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  return new T.CanvasTexture(c);
}

// v12 — Bruit directionnel déterministe : identique pour les vertices
// dupliqués d'un même point de la sphère, donc le relief ne déchire pas
// la surface (l'ancien rand() par index créait des micro-déchirures).
function dirNoise(nx, ny, nz) {
  return Math.sin(nx * 5.3 + 1.2) * Math.sin(ny * 4.7 + 2.9) * Math.sin(nz * 6.1 + 0.4) +
         0.5 * Math.sin(nx * 11.7 + ny * 9.1 + 3.3) * Math.sin(nz * 10.3 + nx * 7.7 + 1.1) +
         0.25 * Math.sin(nx * 23.1 + ny * 19.7 + 2.2) * Math.sin(nz * 21.3 + nx * 17.9 + 1.5); // v13 : grain fin
}

// v13 — CRATÈRES : 12 majeurs PLUS MARQUÉS et variés (taille 0.22..0.84 rad,
// profondeur 0.18..0.45) + 16 micro-cratères (détail de près). Centres fixes
// sur la sphère (graine stable), cuvette + rebord relevé.
var CRATERS = (function () {
  var r = seededRandom(ROCK_SEED + 99);
  var list = [];
  var i, th, ph;
  for (i = 0; i < 12; i++) {
    th = r() * Math.PI * 2;
    ph = Math.acos(2 * r() - 1);
    list.push({
      nx: Math.sin(ph) * Math.cos(th),
      ny: Math.cos(ph),
      nz: Math.sin(ph) * Math.sin(th),
      cosA: Math.cos(0.22 + r() * 0.62), // rayon angulaire du cratère
      depth: 0.18 + r() * 0.27           // profondeur relative au rayon
    });
  }
  for (i = 0; i < 16; i++) {
    th = r() * Math.PI * 2;
    ph = Math.acos(2 * r() - 1);
    list.push({
      nx: Math.sin(ph) * Math.cos(th),
      ny: Math.cos(ph),
      nz: Math.sin(ph) * Math.sin(th),
      cosA: Math.cos(0.08 + r() * 0.16),
      depth: 0.06 + r() * 0.08
    });
  }
  return list;
})();

function craterRelief(nx, ny, nz) {
  var d = 0;
  for (var i = 0; i < CRATERS.length; i++) {
    var cr = CRATERS[i];
    var cosA = nx * cr.nx + ny * cr.ny + nz * cr.nz;
    if (cosA > cr.cosA) {
      var p = (cosA - cr.cosA) / (1 - cr.cosA); // 1 = centre, 0 = bord
      var bowl = p * p * (3 - 2 * p);
      d -= cr.depth * bowl; // cuvette
      var rimBand = 1 - Math.min(1, Math.abs(p - 0.08) / 0.14);
      d += cr.depth * 0.35 * rimBand * rimBand; // rebord relevé
    }
  }
  return d;
}

/* ---------------------------------------------------------------------------
 * Construction
 * ------------------------------------------------------------------------- */

// Rocher sombre irrégulier, MAIS fortement émissif : sa lueur orange se voit
// même sans aucune lumière de scène et contraste avec le ciel noir.
// v12 : relief à cratères marqués (bruit directionnel + cuvettes à rebords),
// fissures incandescentes en emissiveMap (pulsent avec le battement de cœur).
function buildRock(T, lowQ) {
  var geo = new T.IcosahedronGeometry(ROCK_RADIUS, lowQ ? 1 : 2);
  var pos = geo.attributes.position;
  var v = new T.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    var len = v.length() || 1;
    var nx = v.x / len, ny = v.y / len, nz = v.z / len;
    // v13 : relief multi-échelle basé sur la DIRECTION (pas de déchirure)
    // + 12 cratères majeurs marqués + 16 micro-cratères.
    var relief = 1 + dirNoise(nx, ny, nz) * 0.18 + craterRelief(nx, ny, nz);
    v.multiplyScalar(relief);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  var fissureTex = makeFissureTexture(T); // v12 : fissures incandescentes
  var mat = new T.MeshStandardMaterial({
    color: 0x1b1512,            // basalte presque noir
    roughness: 1.0,
    metalness: 0.0,
    flatShading: true,
    emissive: 0xff4400,         // ÉMISSIVE FORTE : orange incandescent
    emissiveIntensity: 1.6,     // se voit sur fond de ciel étoilé, garanti
    emissiveMap: fissureTex     // v12 : les fissures brillent (pulse via emissiveIntensity)
  });
  var mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = false;
  M.rockGeo = geo;
  M.rockMat = mat;
  M.fissureTex = fissureTex;
  return mesh;
}

// FLAMMES : sprites ADDITIFS orange/rouge/jaune qui lèchent tout le rocher
// (lumineux par construction, jamais atténués par le fog).
function buildFlames(T, lowQ) {
  var tex = makeRadialTexture(T, lowQ ? 64 : 128, 1.0);
  var count = lowQ ? 36 : 60;
  var rand = seededRandom(20261013);
  var colors = [0xff6a00, 0xff8c1a, 0xffa83f, 0xff3d00, 0xffc860];
  M.flameTex = tex;
  M.flames = [];
  for (var i = 0; i < count; i++) {
    var mat = new T.SpriteMaterial({
      map: tex,
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false                // PLEINE intensité malgré la distance
    });
    var spr = new T.Sprite(mat);
    spr.frustumCulled = false;
    spr.visible = false;
    var ang = rand() * Math.PI * 2;
    var elev = (rand() - 0.35) * Math.PI; // surtout bas/avant du rocher
    var rr = ROCK_RADIUS * (0.7 + rand() * 0.5);
    M.group.add(spr);
    M.flames.push({
      spr: spr, mat: mat, seed: rand() * 100,
      bx: Math.cos(ang) * Math.cos(elev) * rr,
      by: Math.sin(elev) * rr - ROCK_RADIUS * 0.25,
      bz: Math.sin(ang) * Math.cos(elev) * rr,
      s0: ROCK_RADIUS * (0.55 + rand() * 0.75) // flammes de ~12 à 30 m
    });
  }
}

// FUMÉE : longue traînée grise/noire derrière la météorite (au-dessus,
// elle descend). Blending normal, semi-transparent.
function buildSmoke(T, lowQ) {
  var tex = makeSmokeTexture(T, lowQ ? 64 : 128);
  var count = lowQ ? 40 : 72;
  M.smokeRand = seededRandom(60606);
  M.smokeTex = tex;
  M.smoke = [];
  for (var i = 0; i < count; i++) {
    var mat = new T.SpriteMaterial({
      map: tex,
      color: 0x3a3a40,          // gris sombre
      transparent: true,
      opacity: 0,
      blending: T.NormalBlending,
      depthWrite: false
    });
    var spr = new T.Sprite(mat);
    spr.frustumCulled = false;
    spr.visible = false;
    M.group.add(spr);
    var p = { spr: spr, mat: mat, age: 0, life: 1, x: 0, y: 0, z: 0,
              vx: 0, vy: 0, vz: 0, s0: 1, shade: 0 };
    resetSmokePuff(p, M.smokeRand, true);
    M.smoke.push(p);
  }
}

// Réinitialise une bouffée de fumée au-dessus du rocher (derrière le
// sens de chute) : elle monte, s'étale et s'estompe.
function resetSmokePuff(p, rand, scatter) {
  var r = rand || Math.random;
  p.age = scatter ? r() * 4 : 0;
  p.life = 3 + r() * 3;
  p.x = (r() - 0.5) * ROCK_RADIUS * 2.2;
  p.y = ROCK_RADIUS * (0.8 + r() * 2.5);   // au-dessus : la traînée
  p.z = (r() - 0.5) * ROCK_RADIUS * 2.2;
  p.vx = (r() - 0.5) * 10;
  p.vy = 22 + r() * 18;                     // monte vite : longue traînée
  p.vz = (r() - 0.5) * 10;
  p.s0 = ROCK_RADIUS * (1.2 + r() * 1.6);   // bouffées de ~25 à 60 m
  p.shade = r();
}

// FRAGMENTS BLEUS : petits éclats incandescents bleus qui orbitent le rocher.
// v10 : pendant le défigeage, ils SE DÉTACHENT (spirale vers l'extérieur).
function buildFrags(T, lowQ) {
  var tex = makeRadialTexture(T, lowQ ? 32 : 64, 1.0);
  var count = lowQ ? 8 : 14;
  var rand = seededRandom(777001);
  M.fragTex = tex;
  M.frags = [];
  for (var i = 0; i < count; i++) {
    var mat = new T.SpriteMaterial({
      map: tex,
      color: 0x9fd8ff,          // bleu incandescent
      transparent: true,
      opacity: 0,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    var spr = new T.Sprite(mat);
    spr.frustumCulled = false;
    spr.visible = false;
    var s = ROCK_RADIUS * (0.28 + rand() * 0.2);
    spr.scale.set(s, s, 1);
    M.group.add(spr);
    M.frags.push({
      spr: spr, mat: mat,
      seed: rand() * 100,
      rad0: ROCK_RADIUS * (1.6 + rand() * 1.4), // rayon d'orbite de base
      rad: ROCK_RADIUS * 1.6,
      spd: 0.8 + rand() * 1.6,
      yOff: (rand() - 0.5) * ROCK_RADIUS * 2
    });
  }
}

// BRAISES (v10) : étincelles orange/rouge qui se détachent de la surface du
// rocher pendant le défigeage, la chute et l'émergence — mouvement
// secondaire qui vend la violence de la séquence. Points additifs.
// v13 : 260 braises (étaient 160), plus grosses, vitesse d'éjection
// réglable (boost) — elles se DÉTACHENT en vol pendant la chute/l'éruption.
var N_EMBERS = 260;
function buildEmbers(T, lowQ) {
  var count = lowQ ? 110 : N_EMBERS;
  var tex = makeRadialTexture(T, 32, 1.0);
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);
  var ages = new Float32Array(count);
  var life = new Float32Array(count);
  var vel = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) { ages[i] = 1e9; life[i] = 1; positions[i * 3 + 1] = -99999; }
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  var mat = new T.PointsMaterial({
    size: 3.4, vertexColors: true, transparent: true,
    blending: T.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true, fog: false
  });
  var points = new T.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  M.group.add(points);
  M.embers = points;
  M.emberGeo = geo;
  M.emberMat = mat;
  M.emberTex = tex;
  M.emberData = { ages: ages, life: life, vel: vel, count: count };
  M.emberAcc = 0;
}

// Fait naître une braise à la surface du rocher, éjectée vers l'extérieur.
function spawnEmber(rand) {
  var D = M.emberData;
  if (!D) return;
  var n = D.count, i3;
  // Cherche une particule libre (la plus vieille).
  var idx = 0, best = -1;
  for (var i = 0; i < n; i++) {
    if (D.ages[i] >= D.life[i]) { idx = i; best = i; break; }
    if (D.ages[i] > best) { best = D.ages[i]; idx = i; }
  }
  var r = rand || Math.random;
  var th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
  var dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
  i3 = idx * 3;
  var posAttr = M.emberGeo.getAttribute('position');
  posAttr.setXYZ(idx, dx * ROCK_RADIUS, dy * ROCK_RADIUS, dz * ROCK_RADIUS);
  var sp = (6 + r() * 14) * (M._emberBoost || 1); // v13 : éjection boostée en vol
  D.vel[i3] = dx * sp; D.vel[i3 + 1] = dy * sp - 5; D.vel[i3 + 2] = dz * sp;
  D.ages[idx] = 0;
  D.life[idx] = 1 + r() * 1.4;
  posAttr.needsUpdate = true;
}

function updateEmbers(dt, shedRate, boost) {
  var D = M.emberData;
  if (!D || !M.embers) return;
  M._emberBoost = boost || 1; // v13 : vitesse d'éjection des braises en vol
  var posAttr = M.emberGeo.getAttribute('position');
  var colAttr = M.emberGeo.getAttribute('color');
  // Émission.
  M.emberAcc += dt * shedRate;
  while (M.emberAcc >= 1) { M.emberAcc -= 1; spawnEmber(Math.random); }
  // Vieillissement.
  var dirty = false;
  for (var i = 0; i < D.count; i++) {
    if (D.ages[i] >= D.life[i]) continue;
    D.ages[i] += dt;
    var i3 = i * 3;
    var k = D.ages[i] / D.life[i];
    if (k >= 1) { colAttr.setXYZ(i, 0, 0, 0); dirty = true; continue; }
    D.vel[i3 + 1] -= 6 * dt; // retombe doucement
    posAttr.setXYZ(i,
      posAttr.getX(i) + D.vel[i3] * dt,
      posAttr.getY(i) + D.vel[i3 + 1] * dt,
      posAttr.getZ(i) + D.vel[i3 + 2] * dt);
    // Orange vif -> rouge sombre -> noir (invisible en additif).
    var f = Math.pow(1 - k, 1.5);
    colAttr.setXYZ(i, f * 1.0, f * f * 0.42, f * f * f * 0.08);
    dirty = true;
  }
  if (dirty) { colAttr.needsUpdate = true; }
  M.embers.visible = M.fade > 0.02;
}

// HALO RICHE (v12/v13) : 5 sprites ADDITIFS superposés en dégradé —
// externe rouge profond, orange-rouge, médian orange, cœur chaud,
// noyau blanc incandescent. Ils respirent au rythme du battement de cœur,
// légèrement déphasés.
function buildHalo(T, lowQ) {
  var tex = makeRadialTexture(T, lowQ ? 64 : 128, 0.9);
  M.haloTex = tex;
  M.haloLayers = [];
  var defs = [
    { scale: ROCK_RADIUS * 9.5, color: 0xcc2200, op: 0.42 }, // v13 : externe profond rouge
    { scale: ROCK_RADIUS * 7.0, color: 0xff5a00, op: 0.55 }, // externe
    { scale: ROCK_RADIUS * 4.2, color: 0xff7a1a, op: 0.60 }, // médian
    { scale: ROCK_RADIUS * 2.4, color: 0xffd9a0, op: 0.70 }, // cœur chaud
    { scale: ROCK_RADIUS * 1.5, color: 0xfff3d8, op: 0.80 }, // v13 : noyau blanc incandescent
    { scale: ROCK_RADIUS * 12, color: 0xffb066, op: 0.30 }  // v15 : COURONNE externe (enrichit, ne remplace pas)
  ];
  for (var i = 0; i < defs.length; i++) {
    var mat = new T.SpriteMaterial({
      map: tex,
      color: defs[i].color,
      transparent: true,
      opacity: 0,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    var spr = new T.Sprite(mat);
    var s = defs[i].scale;
    spr.scale.set(s, s, 1);
    spr.frustumCulled = false;
    M.group.add(spr);
    M.haloLayers.push({
      spr: spr, mat: mat,
      base: defs[i].scale, op: defs[i].op,
      seed: i * 2.1
    });
  }
  M.halo = M.haloLayers[0].spr;
  M.haloMat = M.haloLayers[0].mat;
  return M.halo;
}

// TRAÎNÉE DE FEU : immense lame de feu additive au-dessus du rocher
// (derrière le sens de chute), LONGUE de plusieurs centaines de mètres.
// v13 : DOUBLE traînée — lame large externe + noyau interne brillant
// (plus chaud, plus dense), visibles pendant la chute ET l'éruption.
function buildTrail(T) {
  var tex = makeStreakTexture(T);
  var mat = new T.SpriteMaterial({
    map: tex,
    color: 0xff7a10,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  var spr = new T.Sprite(mat);
  spr.frustumCulled = false;
  var w = ROCK_RADIUS * 4.2; // v15 : traînée MONUMENTALE (était 3.2)
  var h = ROCK_RADIUS * 16;     // ~700 m de traînée de feu
  spr.scale.set(w, h, 1);
  spr.position.set(0, ROCK_RADIUS * 9.5, 0);
  M.trailTex = tex;
  M.trailMat = mat;
  // v13 : noyau interne de la traînée — lame fine, quasi blanche, très chaude.
  var cmat = new T.SpriteMaterial({
    map: tex,
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  var cspr = new T.Sprite(cmat);
  cspr.frustumCulled = false;
  cspr.scale.set(ROCK_RADIUS * 1.6, h * 0.92, 1); // v15 : noyau élargi (était 1.3)
  cspr.position.set(0, ROCK_RADIUS * 9.2, 0);
  M.trailCore = cspr;
  M.trailCoreMat = cmat;
  return spr;
}

// v21 — ANNEAU DE STASE : la météorite est FIGÉE dans le temps — un anneau
// d'énergie froide tourne lentement autour d'elle et pulse : la stase se
// VOIT. Pendant le défigeage il s'emballe puis se brise.
function buildStasisRing(T) {
  M.stasisMat = new T.MeshBasicMaterial({
    color: 0x9fd8ff,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
    fog: false
  });
  M.stasisRing = new T.Mesh(new T.TorusGeometry(ROCK_RADIUS * 3.4, 1.4, 8, 72), M.stasisMat);
  M.stasisRing.rotation.x = Math.PI / 2.4;
  M.stasisRing.frustumCulled = false;
  M.stasisRing.visible = false;
  M.group.add(M.stasisRing);
  // v22 : SECOND anneau de stase, en CONTRE-ROTATION — la stase se voit double.
  M.stasisMat2 = new T.MeshBasicMaterial({
    color: 0xbfe9ff,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
    fog: false
  });
  M.stasisRing2 = new T.Mesh(new T.TorusGeometry(ROCK_RADIUS * 4.6, 1.0, 8, 72), M.stasisMat2);
  M.stasisRing2.rotation.x = Math.PI / 1.6;
  M.stasisRing2.frustumCulled = false;
  M.stasisRing2.visible = false;
  M.group.add(M.stasisRing2);
}

// v21 — ARCS DE CORONA : éclairs bleus qui crépitent entre le rocher et les
// fragments pendant la descente et la plongée finale (l'air se déchire
// autour d'elle). Lignes additives, zéro allocation par frame.
var N_CORONA = 8;
function buildCorona(T, lowQ) {
  var n = lowQ ? 4 : N_CORONA; // v21 : densité réduite sur mobile
  M.corona = [];
  for (var i = 0; i < n; i++) {
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(8 * 3), 3));
    var mat = new T.LineBasicMaterial({
      color: 0xbfe6ff,
      transparent: true,
      opacity: 0,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    var line = new T.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    M.group.add(line);
    var th = (i / n) * Math.PI * 2;
    M.corona.push({
      line: line, mat: mat, geo: geo, seed: i * 1.7 + 0.5,
      ax: Math.cos(th), ay: 0.3 + (i % 3) * 0.2, az: Math.sin(th)
    });
  }
}

// Met à jour les arcs de corona (k : 0..1 = intensité). Appelée depuis la
// branche descente/plongée uniquement.
function updateCorona(dt, t, k) {
  if (!M.corona) return;
  for (var i = 0; i < M.corona.length; i++) {
    var c = M.corona[i];
    var on = k > 0.02 && M.fade > 0.02;
    c.line.visible = on;
    if (!on) continue;
    var fr = (M.frags && M.frags.length) ? M.frags[i % M.frags.length] : null;
    var attr = c.geo.getAttribute('position');
    var x0 = c.ax * ROCK_RADIUS, y0 = c.ay * ROCK_RADIUS * 0.5, z0 = c.az * ROCK_RADIUS;
    var x1, y1, z1;
    if (fr && fr.spr.visible) {
      x1 = fr.spr.position.x; y1 = fr.spr.position.y; z1 = fr.spr.position.z;
    } else {
      x1 = c.ax * ROCK_RADIUS * 2.2; y1 = c.ay * ROCK_RADIUS; z1 = c.az * ROCK_RADIUS * 2.2;
    }
    var j = ROCK_RADIUS * 0.35;
    for (var s = 0; s < 8; s++) {
      var p = s / 7;
      var env = Math.sin(Math.PI * p);
      attr.setXYZ(s,
        x0 + (x1 - x0) * p + (Math.random() - 0.5) * j * env,
        y0 + (y1 - y0) * p + (Math.random() - 0.5) * j * env,
        z0 + (z1 - z0) * p + (Math.random() - 0.5) * j * env);
    }
    attr.needsUpdate = true;
    var fl = 0.4 + 0.6 * Math.abs(Math.sin(t * (23 + c.seed * 7) + c.seed * 9));
    c.mat.opacity = M.fade * k * 0.85 * fl;
  }
}

// v21 — ANNEAU D'ENGLOUTISSEMENT : anneau d'énergie froide centré sur la
// faille avant, qui grandit pendant que la météorite est happée vers le
// centre puis claque à l'engloutissement. Contre-échelle du rétrécissement
// du groupe : sa taille MONDE reste lisible.
function buildSwallowRing(T) {
  var tex = M.haloTex || makeRadialTexture(T, 64, 0.9);
  M.swallowMat = new T.SpriteMaterial({
    map: tex,
    color: 0xbfe9ff,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  M.swallowRing = new T.Sprite(M.swallowMat);
  M.swallowRing.frustumCulled = false;
  M.swallowRing.visible = false;
  M.group.add(M.swallowRing);
  // v22 : SECOND anneau d'engloutissement, plus large et plus froid — la
  // faille AVALE la météorite (double anneau qui se referme).
  M.swallowMat2 = new T.SpriteMaterial({
    map: tex,
    color: 0xeaf7ff,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  M.swallowRing2 = new T.Sprite(M.swallowMat2);
  M.swallowRing2.frustumCulled = false;
  M.swallowRing2.visible = false;
  M.group.add(M.swallowRing2);
}

// v22 — DÔME DE CHALEUR : l'AIR SE DÉFORME autour de la météorite en
// plongée — halo additif dense qui gonfle avec la proximité (aucun
// post-traitement : la déformation se LIT comme un mirage de chaleur).
function buildHeatDome(T) {
  var tex = M.haloTex || makeRadialTexture(T, 64, 0.9);
  M.heatDomeMat = new T.SpriteMaterial({
    map: tex,
    color: 0xff9a40,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  M.heatDome = new T.Sprite(M.heatDomeMat);
  M.heatDome.frustumCulled = false;
  M.heatDome.visible = false;
  M.group.add(M.heatDome);
}

// v22 — ANNEAUX DE DÉFORMATION : deux anneaux fins en CONTRE-ROTATION
// autour du rocher pendant la plongée — l'air tourbillonne, la vitesse se LIT.
function buildWarpRings(T) {
  var n = M.lowQ ? 1 : 2; // v22 : densité réduite sur mobile
  var defs = [
    { r: ROCK_RADIUS * 4.2, tube: 0.9, color: 0xffb066, tilt: [1.2, 0.4, 0.3] },
    { r: ROCK_RADIUS * 5.4, tube: 0.7, color: 0x9fd8ff, tilt: [1.5, 2.1, 0.8] }
  ];
  for (var i = 0; i < n; i++) {
    var d = defs[i];
    var mat = new T.MeshBasicMaterial({
      color: d.color, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var ring = new T.Mesh(new T.TorusGeometry(d.r, d.tube, 8, 64), mat);
    ring.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
    ring.frustumCulled = false;
    ring.visible = false;
    M.group.add(ring);
    if (i === 0) { M.warpA = ring; M.warpMatA = mat; }
    else { M.warpB = ring; M.warpMatB = mat; }
  }
}

// v22 — IMPLOSION à l'apogée du rebond : sprite de succion posé dans la
// SCÈNE (pas dans le groupe : il reste au point d'apogée pendant que la
// météorite repart) — l'air est ASPIRÉ avant que le sommet ne claque.
function buildImplosionSprite(T) {
  var tex = M.haloTex || makeRadialTexture(T, 64, 0.9);
  M.implMat = new T.SpriteMaterial({
    map: tex,
    color: 0x9fc4ff,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  M.implSpr = new T.Sprite(M.implMat);
  M.implSpr.frustumCulled = false;
  M.implSpr.visible = false;
  try { var sc = M.api.scene(); if (sc) sc.add(M.implSpr); } catch (e) {}
}

// Jalons de la trajectoire (relatifs au centre de l'île).
// v10 : la météorite ne descend PLUS pendant strike/thrown — elle est partie
// dans la faille en fin d'acceleration et n'en ressort qu'en greatrift,
// au-dessus du Point Zéro, pour une descente finale VERS le Point Zéro.
// v13 : altitudes de vol/croisière RELEVÉES (demande utilisateur : PLUS HAUT).
// v17 : altitudes REVUES (demandes utilisateur : figée UN PEU PLUS BAS,
// descente DE PLUS HAUT). Jalons exprimés en zy+NNN (hauteur du Point Zéro
// + offset), strictement décroissants et CONTINUS : aucune téléportation,
// la trajectoire reste lisible de très loin.
function buildPath(T, center) {
  var cx = center.x, cz = center.z, zy = zeroY();
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  M.points = [
    V(cx + 420, 800, cz + 420),  // 0 : A — v17 : FIGÉE UN PEU PLUS BAS (800 m, était 950) — toujours haute et visible
    V(cx + 420, 800, cz + 420),  // 1 : (réservé — la chute est spéciale)
    // v23 — ARC DE PLONGÉE : la descente ne tombe plus à la verticale sur
    // l'axe — elle DÉCRIT UN GRAND ARC LATÉRAL, comme happée en biais vers
    // le Point Zéro. Ça ALLONGE la trajectoire (~1137 m sur le plongeon
    // final au lieu de 550 m) : à durée de phase égale, la vitesse MOYENNE
    // du plongeon final passe de ~50 m/s à ~110 m/s (x2,2), pointe ~186 m/s.
    // Jalons strictement continus (aucun saut) ; la cible finale reste le
    // Point Zéro (homing liveZeroTarget intact). Les lasers/fusées suivent
    // la position live (AZ.meteorPos) : ils restent cohérents.
    V(cx + 120, zy + 1120, cz + 50),   // 2 : fin de meteorsix — l'arc s'amorce en biais
    V(cx + 620, zy + 820, cz + 230),   // 3 : fin de descent — l'arc s'évase
    V(cx + 900, zy + 600, cz + 350),   // 4 : fin de veeroff — départ du plongeon final : LOIN et HAUT
    V(cx, zy,  cz)               // 5 : impact — LE POINT ZÉRO (inchangé, plongeon final raide)
  ];
  M.emergePos = new T.Vector3(cx, zy + V17_EMERGE_ALT, cz);  // v17 : émergence zy+1300 (était zy+800) — DE PLUS HAUT
  M.emergeEnd = new T.Vector3(cx, zy + V17_EMERGE_ALT - 70, cz);  // v17 : fin d'émergence zy+1230 — continu avec meteorsix (zy+1100)
  M.fallFrom = new T.Vector3();
  M.fallTo = new T.Vector3();
}

// Position de la GRANDE faille (greatrift) : ANCRÉE AU-DESSUS DU POINT ZÉRO.
// v17 — COHÉRENCE FAILLE (demande critique utilisateur : « elle n'y entre
// pas ») : l'émergence se fait AU CENTRE de la grande faille, calculée ICI
// à partir du Point Zéro live (même formule que event-rift.js openGreatRift)
// — l'ordre d'exécution des écouteurs 'phase:greatrift' ne peut plus
// désynchroniser la faille et la météorite. Repli calculé sinon.
function greatRiftPos(out) {
  var zp = (root.AZEvent && (root.AZEvent.zeroPointPos || root.AZEvent.zeroPoint)) || null;
  if (zp && isFinite(zp.x) && isFinite(zp.y) && isFinite(zp.z))
    return out.set(zp.x, zp.y + V17_EMERGE_ALT, zp.z);
  var c = M.api.center;
  return out.set(c.x, zeroY() + V17_EMERGE_ALT, c.z);
}

// Cible de la chute : le CENTRE RÉEL de la faille AVANT.
// v17 — COHÉRENCE FAILLE (demande critique utilisateur : « la météorite va
// vers la faille mais n'y entre pas, elle descend juste en bas ») : la chute
// vise la position LIVE de la faille avant (kind 'great', publiée par
// event-rift.js dans AZ.rifts) — la météorite ENTRE VISIBLEMENT dedans
// (rétrécissement vers le centre + flash d'engloutissement, voir l'état
// 'falling'), elle ne descend plus « juste en bas ». Repli calculé si la
// faille est introuvable.
function frontRiftTarget(out) {
  var rs = AZ.rifts;
  if (rs) {
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (r && r.kind === 'great' && r.pos &&
          isFinite(r.pos.x) && isFinite(r.pos.y) && isFinite(r.pos.z) &&
          r.pos.y > 0) {
        return out.copy(r.pos); // centre réel de la faille avant
      }
    }
  }
  var P0 = M.points[0];
  var c = M.api.center;
  var dx = c.x - P0.x, dz = c.z - P0.z;
  var l = Math.sqrt(dx * dx + dz * dz) || 1;
  return out.set(P0.x + dx / l * 170, P0.y - 150, P0.z + dz / l * 170);
}

/* ---------------------------------------------------------------------------
 * Cycle de vie
 * ------------------------------------------------------------------------- */

function init(api) {
  M.api = api;
  M.T = api.T || root.THREE || null;
  M.disposed = false; // un dispose() précédent ne doit pas tuer le redémarrage
  var T = M.T;
  if (!T) return;
  var lowQ = api.quality === 'low' || api.isMobile;

  var center = api.center || { x: 0, y: 0, z: 0 };
  buildPath(T, center);

  M.group = new T.Group();
  M.group.position.copy(M.points[0]); // point d'apparition (invisible tant que fade=0)
  M.group.visible = false;

  M.rock = buildRock(T, lowQ);
  M.halo = buildHalo(T, lowQ);
  M.trail = buildTrail(T);
  buildFlames(T, lowQ);
  buildSmoke(T, lowQ);
  buildFrags(T, lowQ);
  buildEmbers(T, lowQ);
  M.lowQ = lowQ; // v21 : densité réduite sur mobile
  buildStasisRing(T);  // v21 : anneau de stase (météorite figée)
  buildCorona(T, lowQ); // v21 : arcs de corona (descente/plongée)
  buildSwallowRing(T); // v21 : anneau d'engloutissement (entrée de faille)
  buildHeatDome(T);    // v22 : dôme de chaleur (l'air se déforme en plongée)
  buildWarpRings(T);   // v22 : anneaux de déformation en contre-rotation
  buildImplosionSprite(T); // v22 : implosion à l'apogée du rebond

  M.group.add(M.rock);
  M.group.add(M.halo);
  M.group.add(M.trail);
  M.group.add(M.trailCore); // v13 : noyau interne de la traînée de feu

  attachToScene();

  M.state = 'hidden';
  M.curPhase = null;
  M.subT = 0;
  M.detachK = 0;
  M.fade = 0;
  M.fadeTarget = 0;
  M.shakeAmp = 0;
  M.lastT = -1;

  // Publications inter-modules (position + visibilité, à jour chaque frame).
  if (!AZ.meteorPos || !(AZ.meteorPos instanceof T.Vector3)) {
    AZ.meteorPos = M.group.position.clone();
  }
  AZ.meteorVisible = false;

  // Transitions pilotées par les phases (bus) — aucun temps absolu en dur.
  // v23 : garde anti-doublon (le bus n'expose pas off()) — branchés une seule fois,
  // les handlers travaillent sur l'état courant de M et sont neutralisés par M.disposed.
  if (!M.busBound) {
    M.busBound = true;
  api.on('phase:countdown', onReset); // redémarrage complet de l'event
  api.on('phase:countdown', onFrozen); // puis la météorite devient visible
  api.on('phase:firstrocket', onMenace); // v23 : l'approche menaçante commence (jamais figée)
  api.on('phase:strike', onStrikeGone); // repli : elle est déjà partie
  api.on('phase:thrown', onStrikeGone);
  api.on('phase:greatrift', onEmerging);
  api.on('phase:meteorsix', onDescentPhase);
  api.on('phase:descent', onDescentPhase);
  api.on('phase:veeroff', onDescentPhase);
  api.on('phase:impact', onImpact);
  api.on('phase:contraction', onGone); // repli si 'meteor:hit' n'est pas reçu
  // v11 : au flash d'impact, la météorite ne disparaît plus — elle PLONGE
  // dans le Point Zéro puis RESSORT plus haut et plus loin, AU-DELÀ de la
  // map (état 'rebound'). Émise par event-impact.js : le flash.
  api.on('meteor:hit', onRebound);
  // Défigeage : mécanisme AU CHOIX du groupe A (voir en-tête).
  api.on('meteor:unfreeze', onUnfreeze);
  }

  // Rattrapage si l'init a lieu alors que l'event tourne déjà.
  syncWithPhase();
}

function attachToScene() {
  if (!M.group || M.group.parent) return;
  var scene = null;
  try { scene = M.api.scene(); } catch (e) { scene = null; }
  if (scene) scene.add(M.group);
}

// Remet la météorite à son état initial (redémarrage de l'event).
function onReset() {
  if (!M.api || M.disposed || !M.group) return;
  M.state = 'hidden';
  M.curPhase = null;
  M.subT = 0;
  M.detachK = 0;
  M.fade = 0;
  M.fadeTarget = 0;
  M.shakeAmp = 0;
  M.pulseT = 0; // v11
  M.anticipK = 0; M.flashK = 0; M.transT = 0; M._emberBoost = 1; // v13 : anticipation/flash/transitions
  M._swallowFlash = false; // v17 : flash d'engloutissement (état 'falling')
  M.rebFrom = null; M.rebZero = null; M.rebDir = null; M.rebErupted = false; // v11
  M.roarT = 0; M.echoT = -1; M.zeroBeamT = 0; // v15 : rugissement / écho / colonne d'énergie
  M.rebApogeeDone = false; M.diveRingT = 0; M.frozRumbleT = 5; M.frozBurstT = 2.5; // v21
  M.unfreezePos = null; M.menaceFrom = null; M.menaceTo = null; // v23 : ancrage / dérive réarmés
  M.frozenK = 0; M.menaceK = 0; // v24 : progression du réveil réarmée
  M.diveV0 = 1.0; M.diveA = 2.5; M.divePrev = null; // v23 : chaînage des vitesses réarmé
  M.clapT = -1; M.implT = -1; M.apogeeImplodeDone = false; // v22 : claquement / implosion réarmés
  if (M.implSpr) M.implSpr.visible = false; // v22
  if (M.implMat) M.implMat.opacity = 0; // v22
  if (M.heatDome) M.heatDome.visible = false; // v22
  if (M.heatDomeMat) M.heatDomeMat.opacity = 0; // v22
  if (M.warpA) M.warpA.visible = false; // v22
  if (M.warpB) M.warpB.visible = false; // v22
  if (M.warpMatA) M.warpMatA.opacity = 0; // v22
  if (M.warpMatB) M.warpMatB.opacity = 0; // v22
  if (M.stasisRing2) M.stasisRing2.visible = false; // v22
  if (M.stasisMat2) M.stasisMat2.opacity = 0; // v22
  if (M.swallowRing2) M.swallowRing2.visible = false; // v22
  if (M.swallowMat2) M.swallowMat2.opacity = 0; // v22
  if (M.zeroBeam) M.zeroBeam.visible = false; // v15 : la colonne d'énergie s'éteint
  M.group.visible = false;
  M.group.scale.set(1, 1, 1);
  M.group.position.copy(M.points[0]);
  // v11 : restaure le culling et le brouillard (coupés pendant le rebound).
  M.group.traverse(function (o) { o.frustumCulled = true; });
  if (M.rockMat) M.rockMat.fog = true;
  AZ.meteorPos.copy(M.points[0]);
  AZ.meteorVisible = false;
  AZ.meteorVisR = null; // v18 : réarmé (pas de rayon périmé d'un run précédent)
  hideAllFx();
}

function hideAllFx() {
  var i;
  if (M.flames) for (i = 0; i < M.flames.length; i++) {
    M.flames[i].spr.visible = false; M.flames[i].mat.opacity = 0;
  }
  if (M.smoke) for (i = 0; i < M.smoke.length; i++) {
    M.smoke[i].spr.visible = false; M.smoke[i].mat.opacity = 0;
  }
  if (M.frags) for (i = 0; i < M.frags.length; i++) {
    M.frags[i].spr.visible = false; M.frags[i].mat.opacity = 0;
  }
  if (M.embers) M.embers.visible = false;
  if (M.haloLayers) {
    for (var hi2 = 0; hi2 < M.haloLayers.length; hi2++) M.haloLayers[hi2].mat.opacity = 0;
  } else if (M.haloMat) M.haloMat.opacity = 0;
  if (M.trailMat) M.trailMat.opacity = 0;
  M.trail.visible = false;
  if (M.trailCoreMat) M.trailCoreMat.opacity = 0; // v13
  if (M.trailCore) M.trailCore.visible = false;
  if (M.stasisRing) M.stasisRing.visible = false; // v21
  if (M.stasisMat) M.stasisMat.opacity = 0; // v21
  if (M.swallowRing) M.swallowRing.visible = false; // v21
  if (M.swallowMat) M.swallowMat.opacity = 0; // v21
  if (M.swallowRing2) M.swallowRing2.visible = false; // v22
  if (M.swallowMat2) M.swallowMat2.opacity = 0; // v22
  if (M.stasisRing2) M.stasisRing2.visible = false; // v22
  if (M.stasisMat2) M.stasisMat2.opacity = 0; // v22
  if (M.heatDome) M.heatDome.visible = false; // v22
  if (M.heatDomeMat) M.heatDomeMat.opacity = 0; // v22
  if (M.warpA) M.warpA.visible = false; // v22
  if (M.warpB) M.warpB.visible = false; // v22
  if (M.warpMatA) M.warpMatA.opacity = 0; // v22
  if (M.warpMatB) M.warpMatB.opacity = 0; // v22
  if (M.implSpr) M.implSpr.visible = false; // v22 : sprite scène, pas groupe
  if (M.corona) { // v21
    for (var ci = 0; ci < M.corona.length; ci++) {
      M.corona[ci].line.visible = false;
      M.corona[ci].mat.opacity = 0;
    }
  }
}

/* ----- Transitions (bus) ----- */

// 'phase:countdown' : la météorite est VISIBLE DÈS LE DÉPART, figée très
// haut dans le ciel, en feu (flammes orange + fumée). Exigence utilisateur :
// « la météorite est même pas là » -> elle doit être énorme et visible
// dès le compte à rebours.
function onFrozen() {
  if (!M.api || M.disposed || !M.group || stateRank(M.state) >= 1) return;
  M.state = 'frozen';
  M.curPhase = 'frozen';
  M.subT = 0;
  M.frozenAge = 0; // v25 : rampe d'apparition (pas de téléportation sur le côté)
  M.detachK = 0;
  M.fadeTarget = 1;
  M.shakeAmp = 0.6;
  M.group.scale.set(1, 1, 1);
  M.group.position.copy(M.points[0]);
  AZ.meteorPos.copy(M.points[0]);
  AZ.meteorVisible = true;
  M.transT = 0; // v13 : apparition en easeOutBack (pas d'apparition sèche)
}

// v24 — 'phase:firstrocket' : l'APPROCHE MENACANTE commence. La météorite
// quitte son poste d'observation : dérive lente vers l'axe de l'île en
// descendant doucement, ORBITE GIGANTESQUE (380 m de rayon — lisible à
// 800 m sur mobile), vagues verticales ±70 m, pulsation qui s'intensifie —
// elle ne reste JAMAIS immobile, tout en restant grande, haute et visible.
// Le défigeage (fin d'acceleration) partira d'où qu'elle soit
// (M.unfreezePos : aucun snap).
function onMenace() {
  if (!M.api || M.disposed || !M.group) return;
  if (M.state !== 'frozen') return; // une seule fois, depuis l'état figé
  var T = M.T || root.THREE;
  if (!T) return;
  var c = (M.api && M.api.center) || { x: 0, z: 0 };
  M.menaceFrom = M.group.position.clone();
  M.menaceTo = new T.Vector3(c.x + 300, 720, c.z + 300);
  M.state = 'menace';
  M.curPhase = 'menace';
  M.subT = 0;
  M.fadeTarget = 1;
  M.shakeAmp = 1.0;
  if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = true; }
}

// 'meteor:unfreeze' (groupe A) : la météorite SE DÉFIGE — elle n'est plus
// parfaitement immobile. La vibration monte en crescendo, des fragments et
// des braises se détachent, puis elle tombe vers la faille avant.
function onUnfreeze() {
  if (!M.api || M.disposed || !M.group) return;
  if (stateRank(M.state) !== 1) return; // v23 : une seule fois, depuis 'frozen' OU 'menace'
  M.unfreezePos = M.group.position.clone(); // v23 : la vibration part d'ICI (aucun snap vers points[0])
  M.state = 'unfreezing';
  M.subT = 0;
  M.detachK = 0;
  M.flashK = 0.8; // v13 : flash de défigeage (halo + émissive)
  // v15 : RUGISSEMENT du défigeage — via le bus (event-audio.js, 'shockwave'
  // existant). Aucun son joué directement ici.
  try { M.api.emit('shockwave', { force: 0.5, phase: 'meteor-unfreeze' }); } catch (e) {}
}

// Repli : si le groupe A n'a rien émis, le défigeage part quand même à la
// FIN de la phase 'acceleration' (tState relatif à la durée de phase).
function checkUnfreezeFallback() {
  if (stateRank(M.state) !== 1) return; // v23 : 'frozen' ou 'menace' (pré-chute)
  if (AZ.meteorUnfrozen === true) { // mécanisme 2 : drapeau du groupe A
    AZ.meteorUnfrozen = false;
    onUnfreeze();
    return;
  }
  if (AZ.state === 'acceleration') {
    var dur = phaseDuration('acceleration', 56);
    if (AZ.tState >= dur - VIB_DUR - FALL_DUR - 1.5) onUnfreeze();
  }
}

// 'phase:strike' / 'phase:thrown' : la météorite est DÉJÀ partie (tombée dans
// la faille en fin d'acceleration). Sécurité : si elle est encore là, elle
// disparaît discrètement (jamais de descente pendant strike/thrown).
function onStrikeGone() {
  if (!M.api || M.disposed || !M.group) return;
  var r = stateRank(M.state);
  if (r >= 4) return; // déjà en émergence / descente : on ne touche à rien
  if (r > 0 && r < 4 && M.state !== 'falling') {
    // Elle n'aurait jamais dû être encore visible : on la fait disparaître.
    // ('falling' a déjà émis 'meteor:gone' à l'entrée dans la faille.)
    try { M.api.emit('meteor:gone', { forced: true }); } catch (e) {}
  }
  M.state = 'hidden';
  M.curPhase = null;
  M.fade = 0;
  M.fadeTarget = 0;
  M.group.visible = false;
  AZ.meteorVisible = false;
  hideAllFx();
}

// 'phase:greatrift' : la MÉTÉORITE RESSORT de la GRANDE faille au-dessus du
// Point Zéro — émergence en ease-out (pas d'apparition sèche).
function onEmerging() {
  if (!M.api || M.disposed || !M.group) return;
  if (stateRank(M.state) >= 4 && M.state !== 'hidden') return;
  greatRiftPos(M.emergePos);
  M.emergeEnd.copy(M.emergePos); M.emergeEnd.y -= 70;
  M.state = 'emerging';
  M.curPhase = 'greatrift';
  M.subT = 0;
  M.detachK = 0;
  M.fadeTarget = 1;
  M.shakeAmp = 1.4;
  M.group.scale.set(0.01, 0.01, 0.01);
  M.group.position.copy(M.emergePos);
  AZ.meteorPos.copy(M.emergePos);
  AZ.meteorVisible = true;
  M.flashK = Math.max(M.flashK, 1.2); // v17 : flash de naissance — elle JAILLIT de la faille
  // v17 : la météorite RESSORT de la grande faille — event-rift.js répond
  // par des éclairs de sortie (aucune ambiguïté : sortir = sortir).
  try { M.api.emit('meteor:emerging', { pos: M.emergePos.clone() }); } catch (e) {}
  // v21 : SOUFFLE DE NAISSANCE — la sortie de faille claque (anneaux + flash) : grandiose et lisible.
  try {
    M.api.emit('shockwave:burst', {
      pos: M.emergePos.clone(),
      opts: { radius: 900, duration: 2.5, rings: 5, color: 0xffcf99, flash: true }
    });
  } catch (e) {}
}

// Phases meteorsix/descent/veeroff : descente continue vers le Point Zéro.
function onDescentPhase(data) {
  if (!M.api || M.disposed || !M.group) return;
  if (stateRank(M.state) === 7) return; // partie : on ne revient pas
  if (stateRank(M.state) < 4) {
    // Arrivée tardive (init en cours de phase) : on émerge d'abord, sans
    // transition sèche — l'interpolation intra-phase fera le reste.
    onEmerging();
    M.subT = EMERGE_DUR; // émergence déjà terminée
    M.group.scale.set(1, 1, 1);
  }
  var ph = (data && data.phase) ? data.phase : (AZ.state || 'descent');
  if (DESCENT_PHASES.indexOf(ph) < 0) ph = 'descent';
  M.state = 'descending';
  M.curPhase = ph;
  setupDiveChain(ph, false); // v23 : PLONGÉE FULGURANTE — v0 chaînée (sans à-coup)
  M.fadeTarget = 1;
  M.shakeAmp = 1.2 + 1.6 * clamp01(DESCENT_PHASES.indexOf(ph) / 2);
}

// 'phase:impact' : plongeon final vers le Point Zéro, LONGUE traînée de feu.
function onImpact() {
  if (!M.api || M.disposed || !M.group || stateRank(M.state) >= 6) return;
  if (stateRank(M.state) < 4) { onEmerging(); M.subT = EMERGE_DUR; M.group.scale.set(1, 1, 1); }
  M.state = 'impacting';
  M.curPhase = 'impact';
  // v23 — PLONGÉE FULGURANTE : le plongeon final part à la vitesse de fin
  // de veeroff (pas de démarrage lent) et accélère jusqu'au contact :
  // ~1137 m en 26,5 % de la phase, ~110 m/s de moyenne (x2,2 vs v20),
  // pointe ~186 m/s. Homing liveZeroTarget intact.
  setupDiveChain('impact', true);
  M.fadeTarget = 1;
  M.shakeAmp = 1.0; // v23 : secousse d'entrée de plongée (le cataclysme est réservé au vrai contact)
  M.flashK = 0.45; // v23 : simple embrasement d'entrée — le FLASH cataclysmique part au vrai contact (meteor:hit)
  // v23 : grondement d'annonce de la plongée (pas une détonation — l'explosion
  // n'a lieu qu'au contact réel, via event-impact.js). Aucun son joué directement ici.
  try { M.api.emit('shockwave', { force: 0.35, phase: 'meteor-dive' }); } catch (e) {}
}

// 'meteor:hit' (event-impact.js) ou repli 'phase:contraction' :
// disparaît dans le flash d'impact.
function onGone() {
  if (!M.api || M.disposed || !M.group || stateRank(M.state) >= 7) return;
  M.state = 'gone';
  M.curPhase = null;
  M.fadeTarget = 0;
  M.group.visible = false;
  AZ.meteorVisible = false;
  hideAllFx();
}

/* ---------------------------------------------------------------------------
 * v11 — REBOND du Point Zéro (demande 6) : au flash d'impact ('meteor:hit'),
 * la météorite ne disparaît plus. Elle PLONGE dans le Point Zéro (~2 s, en
 * rétrécissant), puis RESSORT en ÉRUPTION sur un arc balistique TRÈS HAUT
 * et TRÈS LOIN, qui DÉPASSE la map — avec rotation rapide, traînée de feu
 * maximale et pulsation. Fondu au loin avant 'contraction'.
 * Anti-culling : frustumCulled=false + fog=false sur le rocher (visible à
 * plusieurs kilomètres, là où le brouillard l'effacerait sinon).
 * v17 — balistique NERVEUSE (vérifiée : simulation v17, bornes relatives) :
 *   vy0 = 1134 m/s, g = 189 m/s² -> apogée 3402 m à t = 6,0 s ;
 *   fin du vol à t2 = 10 s : +1890 m au-dessus du Point Zéro, 2,2 km au loin
 *   (jamais sous le sol) ; durée totale 12 s << temps restant dans 'impact'
 *   après le contact réel ('meteor:hit' à ~40 % de la phase — bornes relatives).
 *   Anticipation avant l'éruption : tremblement + flash + halo en surpuissance.
 * ------------------------------------------------------------------------- */
var REB_DIVE = 2;        // plongeon dans le Point Zéro (s)
var REB_FLY = 10;        // v17 : vol d'éruption PLUS NERVEUX (était 12)
var REB_HSPEED = 220;    // v17 : vitesse horizontale (m/s) -> ~2,2 km au loin (était 200)
var REB_VY0 = 1134;      // v17 : vitesse verticale initiale (m/s) — apogée spectaculaire, cycle nerveux (était 940)
var REB_GRAV = 189;      // v17 : gravité de l'arc (m/s²) — relevée pour un cycle nerveux (était 110)
// v17 — balistique vérifiée numériquement (simulation v17, bornes relatives) :
//   apogée = VY0²/(2g) = 3402 m à t = 6,0 s ; fin du vol à t2 = 10 s :
//   y = +1890 m au-dessus du Point Zéro, x = 2,2 km (jamais sous le sol).
//   Durée totale = 2 + 10 = 12 s << temps restant dans 'impact' après le
//   contact réel ('meteor:hit' émis à ~40 % de la phase — event-impact.js) :
//   condition relative : impactDur × 0,60 ≥ 12 s, soit impactDur ≥ 20 s
//   (v17 : impactDur = 39 s -> 23,4 s restants, largement OK).
//   Bornes de phases JAMAIS déplacées (aucun temps absolu en dur).

function onRebound() {
  if (!M.api || M.disposed || !M.group) return;
  if (M.state !== 'impacting' && M.state !== 'rebound') return; // une seule fois
  var T = M.T || root.THREE;
  if (!T) return;
  // v13 : position du Point Zéro LIVE (repli calculé) — corrige le bug
  // ZERO_FALLBACK indéfini (ReferenceError au 'meteor:hit').
  var zero = reboundZeroPos(T, new T.Vector3());
  M.state = 'rebound';
  M.subT = 0;
  M.fadeTarget = 1;
  M.anticipK = 0; // v13 : anticipation (tremblement + halo) avant l'éruption
  M.rebFrom = M.group.position.clone();
  M.rebZero = zero.clone();
  // Direction de sortie : azimut fixe, vers l'horizon (spectaculaire et lisible).
  M.rebDir = new T.Vector3(0.5, 0, -0.866).normalize();
  M.rebErupted = false;
  M.echoT = -1; // v15 : écho de l'éruption (armé à l'éruption)
  M.zeroBeamT = 0;
  M.rebApogeeDone = false; // v21 : flash d'apogée réarmé
  // v21 : IMPLOSION au plongeon — l'air est ASPIRÉ dans le Point Zéro avant
  // l'éruption (cause -> effet : d'abord l'aspiration, puis l'explosion).
  try {
    M.api.emit('shockwave:burst', {
      pos: M.rebZero.clone(),
      opts: { radius: 900, duration: 2.0, rings: 4, color: 0x9fe4ff, flash: false }
    });
  } catch (e) {}
  // v15 : COLONNE D'ÉNERGIE au Point Zéro — pilier incandescent qui jaillit
  // pendant le plongeon et l'éruption. Ajouté à la SCÈNE (pas au groupe :
  // il reste planté au sol pendant que la météorite s'envole).
  if (!M.zeroBeam) {
    var bGeo = new T.CylinderGeometry(45, 80, 1400, 12, 1, true);
    bGeo.translate(0, 0.5, 0); // base à l'origine
    M.zeroBeamMat = new T.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    M.zeroBeam = new T.Mesh(bGeo, M.zeroBeamMat);
    M.zeroBeam.frustumCulled = false;
  }
  M.zeroBeam.position.copy(M.rebZero);
  M.zeroBeam.scale.set(0.001, 0.001, 0.001);
  M.zeroBeam.visible = true;
  try { var bsc = M.api.scene(); if (bsc && !M.zeroBeam.parent) bsc.add(M.zeroBeam); } catch (e) {}
  M.group.traverse(function (o) { o.frustumCulled = false; });
  if (M.rockMat) M.rockMat.fog = false;
  M.api.emit('meteor:rebound', { pos: M.rebZero.clone() });
}

// Rattrapage à l'init si l'event tourne déjà (init tardive).
function syncWithPhase() {
  if (!AZ.active || !M.api || M.disposed || !M.group) return;
  var st = AZ.state || '';
  if (st === 'countdown' || st === 'firstrocket' || st === 'sixrockets' ||
      st === 'convergence' || st === 'loop' || st === 'acceleration' ||
      st === 'silence') { onReset(); onFrozen(); if (st !== 'countdown') onMenace(); return; } // v23 : menace si déjà après le countdown
  if (st === 'strike' || st === 'thrown') { onStrikeGone(); return; }
  if (st === 'greatrift') { onEmerging(); M.subT = EMERGE_DUR; M.group.scale.set(1, 1, 1); return; }
  if (DESCENT_PHASES.indexOf(st) >= 0) {
    onEmerging(); M.subT = EMERGE_DUR; M.group.scale.set(1, 1, 1);
    M.state = 'descending'; M.curPhase = st; // position rattrapée par l'interpolation
    setupDiveChain(st, false); // v23 : chaînage des vitesses même en init tardive
  }
  else if (st === 'impact') { onImpact(); }
  else { onGone(); }
}

/* ---------------------------------------------------------------------------
 * Mise à jour (chaque frame)
 * ------------------------------------------------------------------------- */

// Interpolation intra-phase : position entre les jalons de la phase courante,
// pilotée par AZ.tState rapporté à la durée de la phase (AUCUN temps en dur).
// v10 : meteorsix part de la FIN D'ÉMERGENCE (pas de saut), la descente
// finit SUR le Point Zéro.
function pathPosition(out) {
  var P = M.points;
  var from, to;
  if (M.curPhase === 'descent') { from = P[2]; to = P[3]; }
  else if (M.curPhase === 'veeroff') { from = P[3]; to = P[4]; }
  else if (M.curPhase === 'impact') {
    // v23 : HOMING sur le CENTRE LIVE de l'orbe (position live chaque frame,
    // pas la cible figée à l'init) — la plongée ne peut pas rater sa cible.
    // (acquis v20, conservé).
    from = P[4]; to = liveZeroTarget(_tgt);
  }
  else { from = M.emergeEnd; to = P[2]; } // 'meteorsix' / repli
  var dur = phaseDuration(M.curPhase, 14);
  // v23 — PLONGÉE FULGURANTE : diveK = vitesse initiale NON NULLE (v0
  // chaînée sur la fin du segment précédent) + accélération continue.
  // Fini la « rampe » (smooth/ease-in démarraient à vitesse nulle).
  // En 'impact', k=1 est atteint à 26,5 % de la phase : le contact visuel
  // réel (chevauchement mesuré par event-impact.js) tombe juste après la
  // porte tState >= dur*0,25 — ~1137 m en ~10,3 s, ~110 m/s de moyenne.
  // k reste à 1 ensuite (la météorite est DANS le Point Zéro).
  var tMax = (M.curPhase === 'impact') ? Math.max(0.5, dur * IMPACT_CONTACT_FRAC)
                                       : Math.max(0.5, dur);
  var k = diveK(AZ.tState / tMax, (M.diveV0 > 0 ? M.diveV0 : 1.0),
                (M.diveA > 0 ? M.diveA : 2.5));
  out.lerpVectors(from, to, k);
  return out;
}

var _pp = null;
var _tgt = null; // v20 : cible live du plongeon final (homing sur l'orbe)

// v20 : cible LIVE du plongeon final — le centre RÉEL de l'orbe, lu chaque
// frame (AZEvent.zeroPointPos, publié par event-zeropoint.js). Repli : le
// jalon figé à l'init (M.points[5]) si la position live est inexploitable.
function liveZeroTarget(out) {
  try {
    var zp = AZ.zeroPointPos;
    if (zp && isFinite(zp.x) && isFinite(zp.y) && isFinite(zp.z)) {
      if (out) return out.copy(zp);
      return zp;
    }
  } catch (e) { /* repli */ }
  if (out) return out.copy(M.points[5]);
  return M.points[5].clone();
}

// v23 — COURBE DE PLONGÉE « FULGURANTE » : vitesse initiale NON NULLE +
// accélération CONTINUE. v(p) = v0 + a·p (p : 0 -> 1), position normalisée
// k(p) = (v0·p + ½·a·p²) / (v0 + ½·a). Contrairement à smooth() / ease-in
// (vitesse nulle au départ — la « rampe » que l'utilisateur déteste), la
// plongée part VITE DÈS LE DÉPART et accélère jusqu'au contact.
function diveK(p, v0, a) {
  p = clamp01(p);
  var den = v0 + 0.5 * a;
  if (!(den > 0)) return p;
  return (v0 * p + 0.5 * a * p * p) / den;
}

// Distance euclidienne entre deux points (chaînage des vitesses).
function segDist(from, to) {
  var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// v23 — prépare le chaînage des vitesses pour un segment de descente.
// isImpact : la traversée s'achève à IMPACT_CONTACT_FRAC de la phase.
// Utilisé par onDescentPhase, onImpact et l'init tardive (syncWithPhase).
function setupDiveChain(ph, isImpact) {
  var T = M.T || root.THREE;
  var dur = phaseDuration(isImpact ? 'impact' : ph, 14);
  var eff = isImpact ? Math.max(0.5, dur * IMPACT_CONTACT_FRAC) : Math.max(0.5, dur);
  var a = isImpact ? 3.0 : (ph === 'descent' ? 2.2 : 2.5);
  var from, to;
  if (isImpact) {
    from = M.points[4];
    to = T ? liveZeroTarget(new T.Vector3()) : M.points[5];
  }
  else if (ph === 'descent') { from = M.points[2]; to = M.points[3]; }
  else if (ph === 'veeroff') { from = M.points[3]; to = M.points[4]; }
  else { from = M.emergeEnd; to = M.points[2]; } // 'meteorsix' / repli
  var dist = segDist(from, to);
  M.diveA = a;
  M.diveV0 = chainDiveV0(dist, eff);
  M.divePrev = { v0: M.diveV0, a: a, dist: dist, dur: eff };
}

// v23 — CHAÎNAGE DES VITESSES : la v0 d'un segment de descente = la vitesse
// de FIN du segment précédent. La descente entière (meteorsix -> impact)
// devient UNE SEULE accélération continue (~11 -> ~186 m/s), sans à-coup
// aux bornes de phases. Premier segment : v0 = 1,0 (départ déjà franc).
function chainDiveV0(dist, dur) {
  var prev = M.divePrev;
  if (!prev || !(prev.dist > 0) || !(prev.dur > 0)) return 1.0;
  var prevAvg = prev.dist / prev.dur;
  var prevDen = prev.v0 + 0.5 * prev.a;
  var prevEndV = prevDen > 0 ? prevAvg * (prev.v0 + prev.a) / prevDen : prevAvg;
  var avg = dist / Math.max(0.5, dur);
  if (!(avg > 0)) return 1.0;
  return prevEndV / avg;
}

// v23 — APPROCHE MENACANTE : durée totale et temps écoulé, lus sur
// AZ.TIMELINE (aucun temps absolu en dur). L'écoulement utilise AZ.state /
// AZ.tState : robuste au redémarrage comme à l'init tardive.
function menaceTotal() {
  var tot = 0;
  for (var i = 0; i < MENACE_PHASES.length; i++)
    tot += phaseDuration(MENACE_PHASES[i], 20);
  return tot;
}
function menaceElapsed() {
  var el = 0;
  for (var i = 0; i < MENACE_PHASES.length; i++) {
    if (AZ.state === MENACE_PHASES[i]) { el += Math.max(0, AZ.tState || 0); break; }
    el += phaseDuration(MENACE_PHASES[i], 20);
  }
  return el;
}

function update(dt, t) {
  if (!AZ.active) {
    if (M.group && M.group.visible) M.group.visible = false;
    if (AZ) AZ.meteorVisible = false;
    return;
  }
  if (M.disposed || !M.group) return;
  attachToScene();
  if (!M.group.parent) return;

  // Redémarrage de l'event (le temps recule) : retour à l'état caché.
  if (t < M.lastT - 0.5) onReset();
  M.lastT = t;

  var T = M.T;
  if (!_pp) _pp = new T.Vector3();
  if (!_tgt) _tgt = new T.Vector3(); // v20 : cible live du plongeon final

  // Mécanismes de défigeage (groupe A) + repli automatique.
  checkUnfreezeFallback();

  /* ----- Position ----- */

  if (M.state === 'frozen') {
    // v24 — GRANDS BALAYAGES LISIBLES (exigence utilisateur : la « dérive »
    // v23 de 12 m à 800 m d'altitude était INVISIBLE depuis le sol — il a
    // raison). La météorite décrit de VASTES arcs dans le ciel : orbite de
    // ~320 m de rayon (~640 m d'envergure), soit ~43° de champ vu du sol à
    // 800 m — IMPOSSIBLE à rater, même sur un écran de téléphone. L'orbite
    // se RESSERRE vers T-0 (320 -> 240 m) : la bête se concentre, elle va
    // frapper. Balancement vertical ±45 m : elle reste haute et visible.
    var cdDur = phaseDuration('countdown', 60);
    var cdK = clamp01(AZ.tState / Math.max(0.5, cdDur)); // 0 -> 1 vers T-0
    M.frozenK = cdK; // v24 : pilote la pulsation lumineuse (émissive + halo)
    var fR = 320 - 80 * cdK; // v24 : rayon du balayage, en MÈTRES (pas 12)
    // v25 : PAS DE TÉLÉPORTATION à l'apparition — le rayon part de 0 et grandit
    // en ~4 s (avant, la météorite sautait de 320 m sur le côté dès la 1re frame :
    // onFrozen la posait sur points[0], puis l'orbite l'envoyait à +320 m en x).
    M.frozenAge = (M.frozenAge || 0) + dt;
    var appearK = smooth(clamp01(M.frozenAge / 4));
    fR *= appearK;
    var fAng = t * 0.30;     // v25 : ~21 s par tour (était ~45 s) — le mouvement SE VOIT
    // v25 : elle DESCEND lentement vers l'île pendant le compte à rebours
    // (800 → 660 m) : on VOIT qu'elle arrive. Le défigeage partira d'où
    // qu'elle soit (unfreezePos live — aucun snap).
    var fDesc = 140 * cdK;
    M.group.position.set(
      M.points[0].x + Math.cos(fAng) * fR,
      M.points[0].y - fDesc + (Math.sin(t * 0.35) * 45 + Math.sin(fAng * 2) * 15) * appearK,
      M.points[0].z + Math.sin(fAng) * fR
    );
    // v13 : APPARITION en easeOutBack — croissance avec léger dépassement,
    // pas d'apparition sèche.
    if (M.transT < 1.2) {
      M.transT += dt;
      var as = 0.55 + 0.45 * easeOutBack(M.transT / 1.2);
      M.group.scale.set(as, as, as);
    } else {
      // v24 : RESPIRATION AMPLIFIÉE — ±6 % au début, ±15 % à T-0 : la
      // pulsation d'échelle SE VOIT (rocher de 60 m -> ±9 m de diamètre).
      var br24 = 1 + (0.06 + cdK * 0.09) * heartBeat(t * (0.55 + cdK * 0.9));
      M.group.scale.set(br24, br24, br24);
    }
    M.rock.rotation.y += dt * (0.10 + cdK * 0.25); // v23 : rotation qui s'anime vers T-0
    updateEmbers(dt, 3 + cdK * 22, 1 + cdK * 0.4); // v23 : les braises s'intensifient vers T-0
    // v21 — GEL IMPOSANT : anneau de stase qui pulse lentement (la stase se
    // VOIT), grondement sourd périodique, rafales de braises — la bête dort,
    // mais elle VIT. Chaque seconde compte.
    if (M.stasisRing) {
      M.stasisRing.visible = true;
      M.stasisRing.rotation.z += dt * 0.35;
      var stP = 0.7 + 0.3 * Math.sin(t * 2.6);
      M.stasisMat.opacity = M.fade * 0.45 * stP;
      var stS = 1 + 0.05 * Math.sin(t * 2.6 + 1);
      M.stasisRing.scale.set(stS, stS, 1);
    }
    // v22 : SECOND anneau de stase, en CONTRE-ROTATION — la stase se voit double.
    if (M.stasisRing2) {
      M.stasisRing2.visible = true;
      M.stasisRing2.rotation.z -= dt * 0.22;
      M.stasisMat2.opacity = M.fade * 0.30 * stP;
      M.stasisRing2.scale.set(stS, stS, 1);
    }
    M.frozRumbleT -= dt;
    if (M.frozRumbleT <= 0) {
      M.frozRumbleT = 4 + Math.random() * 3; // v23 : grondements plus fréquents (la stase gronde)
      try { M.api.emit('shockwave', { force: 0.30, phase: 'meteor-frozen' }); } catch (e) {}
    }
    M.frozBurstT -= dt;
    if (M.frozBurstT <= 0) {
      M.frozBurstT = 3.5 + Math.random() * 2.5;
      for (var eb = 0; eb < 18; eb++) spawnEmber(Math.random);
    }
    if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = true; }
  }
  else if (M.state === 'menace') {
    // v24 — APPROCHE MENACANTE GIGANTESQUE : la météorite ne reste JAMAIS
    // immobile. ORBITE de 380 m de rayon (~760 m d'envergure) autour de la
    // dérive d'approche vers l'axe de l'île + VAGUES VERTICALES ±70 m
    // (elle FONCE et REMONTE, lentement, menaçante) + pulsation qui
    // s'intensifie : la bête SE RÉVEILLE et on le VOIT. Toujours grande,
    // haute (> 600 m) et visible (aucun rétrécissement).
    var mEl = menaceElapsed();
    var mTot = menaceTotal();
    var mk = clamp01(mEl / Math.max(1, mTot));
    M.menaceK = mk; // v24 : pilote la pulsation lumineuse (émissive + halo)
    var mfx = M.menaceFrom ? M.menaceFrom.x : M.points[0].x;
    var mfy = M.menaceFrom ? M.menaceFrom.y : M.points[0].y;
    var mfz = M.menaceFrom ? M.menaceFrom.z : M.points[0].z;
    var mtx = M.menaceTo ? M.menaceTo.x : mfx;
    var mty = M.menaceTo ? M.menaceTo.y : mfy;
    var mtz = M.menaceTo ? M.menaceTo.z : mfz;
    var mR = 380;        // v24 : rayon de l'orbite, en MÈTRES (pas 22)
    var mAng = t * 0.16; // v24 : ~39 s par tour : lent, massif, inexorable
    // v24 : l'orbite et les vagues verticales GRANDISSENT progressivement
    // (~8 s) depuis la position exacte de fin de countdown : AUCUN saut à
    // la transition (menaceFrom = position réelle capturée dans onMenace).
    var mRamp = smooth(clamp01(mEl / 8));
    var mSwoop = (Math.sin(t * 0.45) * 70 + Math.sin(mAng * 2) * 20) * mRamp;
    M.group.position.set(
      mfx + (mtx - mfx) * mk + Math.cos(mAng) * mR * mRamp,
      mfy + (mty - mfy) * mk + mSwoop,
      mfz + (mtz - mfz) * mk + Math.sin(mAng) * mR * mRamp
    );
    // Rotation qui s'accélère : elle se réveille.
    M.rock.rotation.y += dt * (0.12 + mk * 0.55);
    M.rock.rotation.x += dt * mk * 0.2;
    // v24 : PULSATION MENACANTE AMPLIFIÉE — ±7 % au début, ±15 % en fin
    // d'approche : on VOIT la bête respirer de plus en plus fort.
    var mBsc = 1 + (0.07 + mk * 0.08) * heartBeat(t * (0.8 + mk * 0.9));
    M.group.scale.set(mBsc, mBsc, mBsc);
    // Les anneaux de stase SE FISSURENT et s'éteignent : la stase cède.
    var ringFade = 1 - clamp01(mEl / 12);
    if (M.stasisRing) {
      M.stasisRing.visible = ringFade > 0.02;
      M.stasisRing.rotation.z += dt * (0.35 + mk * 4);
      M.stasisMat.opacity = M.fade * 0.45 * ringFade;
    }
    if (M.stasisRing2) {
      M.stasisRing2.visible = ringFade > 0.02;
      M.stasisRing2.rotation.z -= dt * (0.22 + mk * 3);
      M.stasisMat2.opacity = M.fade * 0.30 * ringFade;
    }
    // Braises continues + grondements : elle gronde en approchant.
    updateEmbers(dt, 22 + mk * 30, 1.1 + mk * 0.5);
    M.frozRumbleT -= dt;
    if (M.frozRumbleT <= 0) {
      M.frozRumbleT = 4 + Math.random() * 3;
      try { M.api.emit('shockwave', { force: 0.35, phase: 'meteor-menace' }); } catch (e) {}
    }
    M.frozBurstT -= dt;
    if (M.frozBurstT <= 0) {
      M.frozBurstT = 3 + Math.random() * 2;
      for (var mb = 0; mb < 22; mb++) spawnEmber(Math.random);
    }
    if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = true; }
  }
  else if (M.state === 'unfreezing') {
    // VIBRATION CRESCENDO : elle se défige — secousse haute fréquence qui
    // monte en puissance (ease-in sur la durée relative VIB_DUR).
    M.subT += dt;
    var uk = clamp01(M.subT / VIB_DUR);
    var amp = 0.6 + easeIn(uk) * 5.4;
    M.shakeAmp = amp;
    // v23 : la vibration part de la position RÉELLE (M.unfreezePos, capturée
    // dans onUnfreeze) — aucun snap vers points[0] après la dérive 'menace'.
    var ax = M.unfreezePos ? M.unfreezePos.x : M.points[0].x;
    var ay = M.unfreezePos ? M.unfreezePos.y : M.points[0].y;
    var az = M.unfreezePos ? M.unfreezePos.z : M.points[0].z;
    M.group.position.set(
      ax + Math.sin(t * 47) * amp + Math.sin(t * 31 + 1.2) * amp * 0.5,
      ay + Math.cos(t * 53 + 0.7) * amp,
      az + Math.sin(t * 41 + 2.1) * amp + Math.cos(t * 37) * amp * 0.5
    );
    // Le rocher s'anime : il n'est plus parfaitement immobile.
    M.rock.rotation.y += dt * (0.05 + uk * 0.9);
    M.rock.rotation.x += dt * uk * 0.4;
    // Les fragments SE DÉTACHENT (spirale vers l'extérieur, 0 -> 1).
    M.detachK = smooth(uk);
    // v21 : l'anneau de stase S'EMBALLE puis se brise (la stase cède).
    if (M.stasisRing) {
      M.stasisRing.visible = M.detachK < 0.9;
      M.stasisRing.rotation.z += dt * (0.35 + uk * 9);
      M.stasisMat.opacity = M.fade * 0.45 * (1 - uk);
    }
    // v22 : le second anneau cède aussi (contre-rotation qui s'emballe).
    if (M.stasisRing2) {
      M.stasisRing2.visible = M.detachK < 0.9;
      M.stasisRing2.rotation.z -= dt * (0.22 + uk * 7);
      M.stasisMat2.opacity = M.fade * 0.30 * (1 - uk);
    }
    // Les braises s'échappent de plus en plus vite.
    updateEmbers(dt, 5 + uk * 55, 1 + uk * 0.8); // v13 : plus nombreuses, éjection boostée
    if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = true; }
    if (M.subT >= VIB_DUR) {
      // Fin de la vibration : CHUTE vers la faille avant.
      M.state = 'falling';
      M.subT = 0;
      M._swallowFlash = false; // v17 : flash d'engloutissement (une seule fois par chute)
      M.fallFrom.copy(M.group.position);
      frontRiftTarget(M.fallTo); // v17 : le CENTRE RÉEL de la faille avant (cohérence)
    }
  }
  else if (M.state === 'falling') {
    // CHUTE ACCÉLÉRÉE (ease-in) vers la faille avant, puis disparition
    // en fondu dedans.
    // v17 — ENTRÉE LIMPID DANS LA FAILLE (demande critique utilisateur :
    // « la météorite va vers la faille mais n'y entre pas ») : la chute
    // converge EXACTEMENT vers le centre de la faille avant (frontRiftTarget
    // = position live de la faille) ; sur les 30 derniers %, la météorite
    // est HAPPÉE vers le centre et RÉTRÉCIT — on la voit disparaître DEDANS,
    // pas « juste en bas ».
    M.subT += dt;
    var fk = easeIn(M.subT / FALL_DUR);
    _pp.lerpVectors(M.fallFrom, M.fallTo, fk);
    var fox = Math.sin(t * 29) * 1.2, foy = Math.cos(t * 35) * 1.2, foz = Math.sin(t * 41 + 1.7) * 1.2;
    M.group.position.set(_pp.x + fox, _pp.y + foy, _pp.z + foz);
    M.rock.rotation.y += dt * (0.9 + fk * 2.2); // v17 : tourbillonne en étant happée
    M.rock.rotation.x += dt * (0.45 + fk * 1.1);
    M.detachK = 1;
    // v13 : ÉTIREMENT de vitesse (stretch conservant le volume) + braises
    // qui se détachent en vol.
    // v17 : étirement renforcé + RÉTRÉCISSEMENT vers le centre sur la fin
    // (elle est ENGLOUTIE par la faille).
    var fst = 1 + 0.3 * fk;
    var suckK = smooth(clamp01((fk - 0.7) / 0.3)); // v17 : 0 -> 1 sur les 30 derniers %
    var shrink = 1 - suckK * 0.92; // v17 : -> 0.08 : la météorite ENTRE dans la faille
    M.group.scale.set(shrink / Math.sqrt(fst), fst * shrink, shrink / Math.sqrt(fst));
    // v21 : ANNEAU D'ENGLOUTISSEMENT — anneau d'énergie froide au centre de
    // la faille, qui grandit pendant que la météorite est happée (taille
    // monde constante malgré le rétrécissement du groupe).
    if (M.swallowRing) {
      var shkS = shrink > 0.02 ? shrink : 0.02;
      var sS = (60 + suckK * 220) / shkS;
      M.swallowRing.scale.set(sS, sS, 1);
      M.swallowRing.visible = suckK > 0.02 && M.fade > 0.02;
      M.swallowMat.opacity = M.fade * suckK * 0.85;
    }
    // v22 : SECOND anneau d'engloutissement, plus large et plus froid.
    if (M.swallowRing2) {
      var shkS2 = shrink > 0.02 ? shrink : 0.02;
      var sS2 = (140 + suckK * 520) / shkS2;
      M.swallowRing2.scale.set(sS2, sS2, 1);
      M.swallowRing2.visible = suckK > 0.02 && M.fade > 0.02;
      M.swallowMat2.opacity = M.fade * suckK * 0.60;
    }
    // v22 : CLAQUEMENT d'engloutissement — les anneaux se REFERMENT sur la
    // météorite pendant qu'elle est avalée (la faille AVALE visiblement).
    if (M.clapT >= 0) {
      M.clapT += dt;
      var ck22 = clamp01(M.clapT / 0.55);
      var clapS = Math.max(0.04, 1 - ck22 * 0.96);
      if (M.swallowRing) M.swallowRing.scale.multiplyScalar(clapS);
      if (M.swallowRing2) M.swallowRing2.scale.multiplyScalar(clapS);
      if (M.swallowMat) M.swallowMat.opacity = Math.min(1, M.swallowMat.opacity + ck22 * 0.5);
    }
    if (M.stasisRing) M.stasisRing.visible = false; // v21 : la stase a cédé
    updateEmbers(dt, 75, 1.6);
    if (fk > 0.9 && !M._swallowFlash) { // v17 : flash d'engloutissement au contact
      M._swallowFlash = true;
      M.flashK = 1.5;
      M.clapT = 0; // v22 : le CLAQUEMENT part — les anneaux se referment sur elle
      try { M.api.emit('camera:shake', { force: 0.5, duration: 1.2, source: 'meteor-swallowed' }); } catch (e) {}
      // v21 : CLAQUEMENT d'engloutissement — la faille AVALE la météorite (anneaux + flash).
      try {
        M.api.emit('shockwave:burst', {
          pos: M.fallTo.clone(),
          opts: { radius: 520, duration: 2.0, rings: 4, color: 0x9fe4ff, flash: true }
        });
      } catch (e) {}
    }
    if (fk > 0.82) M.fadeTarget = 0; // absorbée par la faille : fondu
    if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = M.fade > 0.05; }
    if (M.subT >= FALL_DUR) {
      // v17 : ENTRÉE DANS LA FAILLE — flash d'engloutissement au centre de
      // la faille ; event-rift.js referme la faille DESSUS (implosion).
      try { M.api.emit('meteor:gone', { pos: M.fallTo.clone(), swallowed: true }); } catch (e) {}
      onStrikeGone(); // -> 'hidden' (réutilise la transition)
    }
  }
  else if (M.state === 'emerging') {
    // ÉMERGENCE de la grande faille (greatrift) : croissance en ease-out,
    // pas d'apparition sèche, puis début de chute.
    M.subT += dt;
    var ek = clamp01(M.subT / EMERGE_DUR);
    var es = Math.max(0.01, easeOutBack(ek));
    M.group.scale.set(es, es, es);
    M.group.position.set(
      M.emergePos.x + Math.sin(t * 29) * 0.8,
      M.emergePos.y - 70 * easeIn(ek) + Math.cos(t * 35) * 0.8,
      M.emergePos.z + Math.sin(t * 41 + 1.7) * 0.8
    );
    M.emergeEnd.set(M.emergePos.x, M.emergePos.y - 70, M.emergePos.z);
    M.rock.rotation.y += dt * 0.35;
    updateEmbers(dt, 30, 1.1); // v13 : plus de braises à l'émergence
    if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = true; }
  }
  else if (M.state === 'descending' || M.state === 'impacting') {
    pathPosition(_pp);
    // v14 : ANTICIPATION avant la plongée finale — pendant la fin de veeroff,
    // la météorite TREMBLE (secousse ajoutée ci-dessous) et son HALO GONFLE
    // (via M.anticipK, consommé par les formules halo/émissive existantes).
    // En 'impact', anticipation à fond : le plongeon final est en cours.
    var antDur = phaseDuration(M.curPhase, 14);
    var antProg = smooth(clamp01(AZ.tState / Math.max(0.5, antDur)));
    var ant = (M.curPhase === 'veeroff') ? smooth(clamp01((antProg - 0.6) / 0.4)) : 0;
    if (M.state === 'impacting') ant = 1;
    M.anticipK = ant;
    // v14 : VISIBILITÉ À GRANDE DISTANCE — le modèle grossit avec l'altitude
    // (jusqu'à ×2,2 à 3500 m et plus) : la descente de super haut reste lisible.
    // v15 : GROSSISSEMENT DRAMATIQUE À L'APPROCHE — la chute ÉCRASE L'ÉCRAN
    // quand la météorite fond sur l'île (proximité du sol).
    var pk15 = proxK();
    var visScale = 1 + altBoostK() * 1.6 + pk15 * 0.9;
    M.group.scale.set(visScale, visScale, visScale);
    // v18 — RAYON VISUEL LIVE publié : event-impact.js calcule le contact
    // sur les RAYONS VISUELS RÉELS (dist < R_m + R_z), jamais sur un seuil
    // fixe. ROCK_RADIUS × échelle live : inclut altBoostK (×2,6 max) ET
    // proxK (×1,9) — TOUTE la mise à l'échelle compte, comme exigé.
    if (AZ) AZ.meteorVisR = ROCK_RADIUS * visScale;
    // Secousse croissante : la descente est violente.
    // v13 : le FLASH d'impact (M.flashK) ajoute une secousse brutale.
    // v14 : le tremblement d'anticipation s'ajoute avant la plongée finale.
    var shk = M.shakeAmp * 0.5 + M.flashK * 2.5 + ant * 6;
    var ox = Math.sin(t * 29) * shk;
    var oy = Math.cos(t * 35) * shk;
    var oz = Math.sin(t * 41 + 1.7) * shk;
    M.group.position.set(_pp.x + ox, _pp.y + oy, _pp.z + oz);
    // Rotation lente du rocher en chute.
    M.rock.rotation.y += dt * 0.25;
    M.rock.rotation.x += dt * 0.12;
    // v15 : à l'impact, le rocher TOURBILLONNE (culbute) — chute cataclysmique.
    if (M.state === 'impacting') {
      M.rock.rotation.z += dt * 1.1;
      M.rock.rotation.x += dt * 0.9;
    }
    // v15 : SECOUSSE D'ÉCRAN + RUGISSEMENT qui grandissent avec la proximité
    // (bus existants : 'camera:shake' -> event-cinedir.js, 'shockwave' ->
    // event-audio.js). Aucun son joué directement ici.
    // v17 : IMPACT CATACLYSMIQUE — tout près du sol, la météorite s'embrase
    // en continu (flash soutenu) : la chute ÉCRASE l'écran.
    if (M.state === 'impacting' && pk15 > 0.8) M.flashK = Math.max(M.flashK, 0.9);
    M.roarT = (M.roarT || 0) - dt;
    // v21 : la chute SE FAIT SENTIR dès la descente — tremblements d'air et
    // sifflement montant (forces réduites, intervalle allongé) : on SENT la chute.
    var roarDesc = (M.state === 'descending' && M.curPhase !== 'meteorsix' && pk15 > 0.45);
    if (M.roarT <= 0 && (M.state === 'impacting' ||
        (M.curPhase === 'veeroff' && pk15 > 0.35) || roarDesc)) {
      var rf = roarDesc ? 0.45 : 1;
      M.roarT = roarDesc ? 2.4 : 1.05; // v22 : le grondement MONTE plus vite (était 1.4)
      try { M.api.emit('camera:shake', { force: (0.28 + pk15 * 0.70) * rf, source: 'meteor-fall' }); } catch (e) {} // v22 : plus fort (était 0.18+0.55)
      try { M.api.emit('shockwave', { force: (0.35 + pk15 * 0.75) * rf, phase: 'meteor-fall' }); } catch (e) {} // v22 : plus fort (était 0.25+0.6)
    }
    if (M.state === 'impacting') {
      // v21 : ANNEAUX SONIQUES — la plongée finale déchire l'air : des
      // anneaux de choc traînent derrière la météorite (la vitesse se LIT).
      M.diveRingT -= dt;
      if (M.diveRingT <= 0) {
        M.diveRingT = M.lowQ ? 2.0 : 1.1; // v22 : anneaux plus fréquents (était 2.6/1.5)
        try {
          M.api.emit('shockwave:burst', {
            pos: M.group.position.clone(),
            opts: { radius: 520 + pk15 * 520, duration: 1.6, rings: 3, color: 0xffb066, flash: false } // v22 : plus larges (était 420+380)
          });
        } catch (e) {}
      }
      updateCorona(dt, t, 1); // v21 : arcs de corona à pleine puissance
    } else {
      updateCorona(dt, t, 0.55); // v21 : arcs de corona pendant la descente
    }
    // v22 : l'AIR SE DÉFORME autour de la météorite — dôme de chaleur qui
    // gonfle avec la proximité (mirage de chaleur, sans post-traitement).
    if (M.heatDome) {
      var hdOn = M.fade * pk15;
      M.heatDome.visible = hdOn > 0.02;
      if (M.heatDome.visible) {
        var hdF = 0.75 + 0.25 * Math.sin(t * 31) * Math.sin(t * 17.3);
        var hdS = ROCK_RADIUS * (7 + pk15 * 5) * (1 + 0.06 * Math.sin(t * 23));
        M.heatDome.scale.set(hdS, hdS, 1);
        M.heatDomeMat.opacity = hdOn * 0.30 * hdF;
      }
    }
    // v22 : ANNEAUX DE DÉFORMATION en contre-rotation — l'air tourbillonne,
    // la vitesse de la plongée se LIT.
    if (M.warpA) {
      var wrOn = M.fade * (M.state === 'impacting' ? 1 : 0.6) * (0.25 + pk15 * 0.75);
      var wrVis = wrOn > 0.03;
      M.warpA.visible = wrVis;
      if (M.warpB) M.warpB.visible = wrVis;
      if (wrVis) {
        M.warpA.rotation.z += dt * (4 + pk15 * 9);
        if (M.warpB) M.warpB.rotation.z -= dt * (3 + pk15 * 7);
        var wrS = 1 + 0.08 * Math.sin(t * 19);
        M.warpA.scale.set(wrS, wrS, 1);
        if (M.warpB) M.warpB.scale.set(wrS, wrS, 1);
        M.warpMatA.opacity = wrOn * 0.55;
        if (M.warpMatB) M.warpMatB.opacity = wrOn * 0.45;
      }
    }
    updateEmbers(dt, M.state === 'impacting' ? 150 : (22 + ant * 60), // v15 : 150 à l'impact (était 120)
      M.state === 'impacting' ? 2.0 : (1 + ant * 0.5)); // v15 : braises cataclysmiques à l'impact
  }
  else if (M.state === 'rebound') {
    // v11/v13 — REBOND : plongeon dans le Point Zéro puis ÉRUPTION au-delà
    // de la map. v17 : balistique NERVEUSE (apogée 3402 m à t=6,0 s, fin à
    // +1890 m à 2,2 km, 12 s au total — tient dans 'impact').
    M.subT += dt;
    reboundZeroPos(T, _pp); // v13 : live, repli calculé (fix ZERO_FALLBACK)
    var zx = _pp.x, zy = _pp.y, zz = _pp.z;
    if (M.subT < REB_DIVE) {
      // PHASE A (2 s) : la météorite PLONGE dans le Point Zéro en rétrécissant.
      var kA = easeIn(clamp01(M.subT / REB_DIVE));
      M.group.position.lerpVectors(M.rebFrom, M.rebZero, kA);
      var scA = Math.max(1 - kA * 0.95, 0.05);
      M.group.scale.set(scA, scA, scA);
      // v13 : ANTICIPATION avant l'éruption — les 0,9 dernières secondes :
      // TREMBLEMENT violent + FLASH + MONTÉE EN PUISSANCE du halo.
      var ant = smooth(clamp01((M.subT - (REB_DIVE - 0.9)) / 0.9));
      M.anticipK = ant;
      M.shakeAmp = 4 + ant * 14;
      M.group.position.x += Math.sin(t * 61) * ant * 4;
      M.group.position.y += Math.cos(t * 67 + 1.3) * ant * 4;
      M.group.position.z += Math.sin(t * 55 + 2.6) * ant * 4;
      updateEmbers(dt, 60 + ant * 80, 1.2 + ant);
      // v15 : la COLONNE D'ÉNERGIE JAILLIT du Point Zéro (overshoot).
      if (M.zeroBeam && M.zeroBeamMat) {
        M.zeroBeamT += dt;
        var zbk = easeOutBack(clamp01(M.zeroBeamT / 1.1));
        M.zeroBeam.scale.set(1 + 0.15 * Math.sin(t * 11), Math.max(0.001, zbk),
                             1 + 0.15 * Math.cos(t * 9.3));
        M.zeroBeamMat.opacity = Math.min(1, M.zeroBeamT * 2) * 0.75 *
          (0.8 + 0.2 * Math.sin(t * 23));
        M.zeroBeam.rotation.y += dt * 1.1;
      }
    } else {
      // PHASE B : ÉRUPTION — ressort PLUS HAUT et PLUS LOIN, au-delà de la map.
      if (M.anticipK > 0) M.anticipK = Math.max(0, M.anticipK - dt * 1.2);
      if (!M.rebErupted) {
        M.rebErupted = true;
        M.flashK = 2.6; // v22 : FLASH cataclysmique à l'éruption (était 2.0)
        M.echoT = 2.2; // v15 : écho de l'éruption dans 2,2 s
        M.api.emit('shockwave:burst', {
          pos: M.rebZero.clone(),
          opts: { radius: 1500, duration: 3.2, rings: 7, color: 0xffb066, flash: true } // v22 : cataclysmique (était 1200 / 6 anneaux)
        });
        try { M.api.emit('shockwave', { force: 1.0, phase: 'meteor-rebound' }); } catch (e) {} // audio + ciel
        try { M.api.emit('camera:shake', { force: 1.0, source: 'meteor-eruption' }); } catch (e) {} // v15 : l'éruption SECOUE l'écran
      }
      // v15 : ÉCHO de l'éruption — seconde onde de choc retardée (bus existants).
      if (M.echoT > 0) {
        M.echoT -= dt;
        if (M.echoT <= 0) {
          M.api.emit('shockwave:burst', {
            pos: M.rebZero.clone(),
            opts: { radius: 1600, duration: 3.5, rings: 5, color: 0xffcf99, flash: false }
          });
          try { M.api.emit('shockwave', { force: 0.9, phase: 'meteor-rebound-echo' }); } catch (e) {}
        }
      }
      var t2 = M.subT - REB_DIVE;
      // v22 : IMPLOSION à l'apogée — 0,45 s avant le sommet, l'air est
      // ASPIRÉ (anneau de succion qui se referme sur la météorite)...
      if (!M.apogeeImplodeDone && t2 >= 5.55) {
        M.apogeeImplodeDone = true;
        M.implT = 0;
        if (M.implSpr) {
          M.implSpr.position.copy(M.group.position);
          M.implSpr.visible = true;
        }
      }
      if (M.implT >= 0 && M.implT < 0.45) {
        M.implT += dt;
        var ik22 = clamp01(M.implT / 0.45);
        var is22 = 1400 * (1 - ik22 * 0.93);
        if (M.implSpr) {
          M.implSpr.scale.set(is22, is22, 1);
          M.implMat.opacity = 0.75 * (1 - ik22 * 0.4);
        }
      }
      // ...PUIS le sommet CLAQUE (v21 : chaque temps fort a son effet).
      if (!M.rebApogeeDone && t2 >= 6.0) {
        M.rebApogeeDone = true;
        if (M.implSpr) M.implSpr.visible = false; // v22 : la succion cède à l'explosion
        try {
          M.api.emit('shockwave:burst', {
            pos: M.group.position.clone(),
            opts: { radius: 2200, duration: 2.5, rings: 7, color: 0xffd9a0, flash: true } // v22 : cataclysmique (était 1500 / 5 anneaux)
          });
        } catch (e) {}
        try { M.api.emit('camera:shake', { force: 0.8, duration: 1.8, source: 'meteor-apogee' }); } catch (e) {} // v22 : plus fort (était 0.7/1.5)
      }
      // v13 : POP ÉLASTIQUE — la météorite explose hors du Point Zéro avec
      // un dépassement oscillant (spectaculaire), puis se stabilise.
      var kB = easeOutElastic(clamp01(t2 / 1.0));
      var scB = Math.max(kB * 1.3, 0.05) * (1 + altBoostK() * 1.2); // v13 : ressort ENCORE PLUS GROSSE ; v14 : grossit avec l'altitude (visible à 4000 m)
      M.group.scale.set(scB, scB, scB);
      // Arc balistique : file vers l'horizon, très haut, très loin.
      var hd = REB_HSPEED * t2;
      var vy = REB_VY0 * t2 - 0.5 * REB_GRAV * t2 * t2;
      M.group.position.set(
        zx + M.rebDir.x * hd,
        zy + vy,
        zz + M.rebDir.z * hd
      );
      // Rotation rapide + secousse pendant l'éruption.
      M.rock.rotation.y += dt * 4.2; // v22 : tourbillon frénétique (était 3.2)
      M.rock.rotation.z += dt * 1.1; // v22 (était 0.8)
      M.shakeAmp = 8; // v22 : l'éruption SECOUE (était 6)
      updateEmbers(dt, 260, 3.2); // v22 : tempête de braises maximale (était 200/2.8)
      // v15 : la colonne d'énergie tourne puis s'éteint avec le vol.
      if (M.zeroBeam && M.zeroBeamMat) {
        M.zeroBeam.rotation.y += dt * 1.4;
        var zbf = t2 > 5 ? Math.max(0, 1 - (t2 - 5) / 4) : 1;
        M.zeroBeamMat.opacity = 0.75 * zbf * (0.8 + 0.2 * Math.sin(t * 23));
        if (zbf <= 0) M.zeroBeam.visible = false;
      }
      if (t2 >= REB_FLY - 2.5) M.fadeTarget = 0; // v17 : fondu au loin APRÈS l'apogée (était REB_FLY-4), avant 'contraction'
      if (t2 >= REB_FLY) { onGone(); return; }
    }
  }

  /* ----- v13 : décroissance du flash (impact / défigeage / éruption) ----- */

  if (M.flashK > 0) M.flashK = Math.max(0, M.flashK - dt * 1.4);

  /* ----- Fondu d'apparition / disparition ----- */

  var fSpeed = (M.state === 'gone' || M.state === 'hidden') ? 4 : 1.8;
  if (M.fade < M.fadeTarget) M.fade = Math.min(M.fadeTarget, M.fade + dt * fSpeed);
  else if (M.fade > M.fadeTarget) M.fade = Math.max(M.fadeTarget, M.fade - dt * fSpeed);

  var show = M.fade > 0.02 &&
    (M.state === 'frozen' || M.state === 'menace' || M.state === 'unfreezing' || M.state === 'falling' ||
     M.state === 'emerging' || M.state === 'descending' || M.state === 'impacting' ||
     M.state === 'rebound'); // v11 : le rebond reste visible au-delà de la map
  M.group.visible = show;
  if (!show) {
    if (AZ) { AZ.meteorPos.copy(M.group.position); AZ.meteorVisible = false; }
    return;
  }

  /* ----- Rocher : émissive orange incandescente, flicker ----- */

  // v14 : coefficient d'altitude pour la visibilité à grande distance
  // (0 au Point Zéro, 1 à 3500 m et plus) — voir altBoostK().
  var altK = altBoostK();

  // v11/v13 — PULSATION « battement de cœur » (lub-dub, synchronisé) :
  // la météorite VIT. Le battement s'intensifie pendant l'impact et le
  // rebond (spectaculaire, lisible).
  M.pulseT = (M.pulseT || 0) + dt;
  var beat = heartBeat(M.pulseT); // v13 : double impulsion lub-dub, sync fissures+halo+flammes
  // v24 : en 'frozen' et 'menace', la pulsation LUMINEUSE grandit avec le
  // réveil (M.frozenK / M.menaceK : 0 -> 1) : l'émissive ET le halo
  // respirent de plus en plus fort — la bête se réveille et on le VOIT.
  var beatAmp = (M.state === 'impacting' || M.state === 'rebound') ? 0.5 :
                (M.state === 'falling') ? 0.35 :
                (M.state === 'menace') ? 0.30 + 0.25 * (M.menaceK || 0) :
                (M.state === 'frozen') ? 0.20 + 0.30 * (M.frozenK || 0) : 0.2;

  var flick = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 11.3);
  // En défigeage, elle chauffe de plus en plus (crescendo lumineux).
  var heat = (M.state === 'unfreezing') ? (1 + M.detachK * 0.8) : 1;
  // v13 : les fissures pulsent EN SYNC avec le battement de cœur ;
  // anticipation et flash surchargent l'émissive.
  M.rockMat.emissiveIntensity = 1.6 * M.fade * flick * heat *
    (1 + 1.15 * beatAmp * beat + M.anticipK * 0.9 + M.flashK * 0.7) *
    (1 + altK * 0.7); // v15 : incandescence renforcée à haute altitude (était 0.5)
  // En phase d'impact, elle brûle encore plus fort.
  if (M.state === 'impacting') M.rockMat.emissiveIntensity *= 1.35;
  if (M.state === 'rebound') M.rockMat.emissiveIntensity *= 1.6; // éruption : incandescente

  /* ----- Flammes : flicker rapide, tout autour du rocher ----- */

  var i, f;
  if (M.flames) {
    for (i = 0; i < M.flames.length; i++) {
      f = M.flames[i];
      f.spr.visible = true;
      var fl = 0.6 + 0.4 * Math.sin(t * 21 + f.seed) * Math.sin(t * 12.7 + f.seed * 1.3);
      f.mat.opacity = M.fade * fl;
      var jit = 1 + 0.16 * Math.sin(t * 18 + f.seed * 2.1);
      f.spr.position.set(f.bx * jit, f.by * jit, f.bz * jit);
      var fsz = f.s0 * (1 + 0.3 * Math.sin(t * 25 + f.seed));
      f.spr.scale.set(fsz, fsz * 1.4, 1);
    }
  }

  /* ----- Fumée : longue traînée grise/noire derrière (au-dessus) ----- */

  if (M.smoke) {
    for (i = 0; i < M.smoke.length; i++) {
      var sp = M.smoke[i];
      sp.age += dt;
      if (sp.age >= sp.life) resetSmokePuff(sp, M.smokeRand, false);
      var sk = sp.age / sp.life;
      sp.spr.position.set(sp.x + sp.vx * sp.age, sp.y + sp.vy * sp.age, sp.z + sp.vz * sp.age);
      var ssz = sp.s0 * (1 + sk * 2.6);
      sp.spr.scale.set(ssz, ssz, 1);
      var env = Math.sin(Math.PI * clamp01(sk));
      // Gris -> presque noir selon la bouffée (contraste avec le ciel).
      var g = 0.10 + 0.14 * sp.shade;
      sp.mat.color.setRGB(g, g, g * 1.1);
      sp.mat.opacity = M.fade * 0.5 * env;
      sp.spr.visible = sp.mat.opacity > 0.01;
    }
  }

  /* ----- Fragments bleus : orbite + DÉTACHEMENT pendant le défigeage ----- */

  // v11 : l'orbite des fragments s'accélère en chute et pendant le rebond.
  var fragBoost = (M.state === 'rebound') ? 1.5 :
                  (M.state === 'impacting') ? 0.8 :
                  (M.state === 'falling') ? 0.3 : 0;

  if (M.frags) {
    for (i = 0; i < M.frags.length; i++) {
      var fr = M.frags[i];
      fr.spr.visible = true;
      var fa = t * fr.spd * (1 + fragBoost) + fr.seed; // v11 : orbite accélérée
      // Détachement : spirale vers l'extérieur quand detachK monte.
      var rad = fr.rad0 * (1 + M.detachK * 3.0);
      fr.spr.position.set(
        Math.cos(fa) * rad,
        fr.yOff + Math.sin(t * 2.3 + fr.seed) * ROCK_RADIUS * 0.4,
        Math.sin(fa) * rad
      );
      var fblink = 0.65 + 0.35 * Math.sin(t * 14 + fr.seed * 3.1);
      fr.mat.opacity = M.fade * fblink * (1 - M.detachK * 0.75);
    }
  }

  /* ----- Halo riche : 5 couches en dégradé, pulsation ----- */

  // v11 : le halo « respire » au rythme du battement de cœur.
  // v12 : les couches respirent légèrement déphasées (dégradé vivant).
  // v13 : 5 couches ; anticipation et flash surchargent le halo.
  if (M.haloLayers) {
    for (var hi = 0; hi < M.haloLayers.length; hi++) {
      var hl = M.haloLayers[hi];
      var hph = t * 2.4 + hl.seed;
      var hp2 = 1 + 0.12 * Math.sin(hph) + 0.22 * beatAmp * beat +
                M.anticipK * 0.9 + M.flashK * 0.6 + altK * 0.9; // v15 : glow renforcé à haute altitude (était 0.7)
      hl.mat.opacity = M.fade * hl.op * hp2;
      var hs2 = hl.base * (1 + altK * 1.6) * // v15 : le halo gonfle à haute altitude (était 1.2)
                (1 + 0.04 * Math.sin(hph) + 0.10 * beatAmp * beat + M.anticipK * 0.25);
      hl.spr.scale.set(hs2, hs2, 1);
    }
  }

  /* ----- Traînée de feu : ÉNORME pendant l'impact, la chute et le rebond ----- */

  // v15 : la traînée de feu rugit pendant la descente de super haut ('descending').
  // v17 : traînée MONUMENTALE — encore renforcée en chute ('falling') et en
  // descente ('descending') : la chute ÉCRASE.
  // v22 : traînée MONUMENTALE — la plongée finale est un BRASIER (2,6).
  var trailBoost = (M.state === 'rebound') ? 2.4 :
                   (M.state === 'impacting') ? 2.6 :
                   (M.state === 'descending') ? 2.0 :
                   (M.state === 'menace') ? 1.3 : // v23 : la traînée s'anime pendant l'approche
                   (M.state === 'falling' ? 2.1 : 1.0);
  var trFlick15 = 0.85 + 0.15 * Math.sin(t * 29) * Math.sin(t * 13.7); // v15 : la traînée rugit
  var trTarget = M.fade * 0.85 * trailBoost * trFlick15;
  var trOp = M.trailMat.opacity;
  M.trailMat.opacity = trOp + (trTarget - trOp) * Math.min(1, dt * 4);
  M.trail.visible = M.trailMat.opacity > 0.01;
  // v13 : noyau interne de la traînée — plus brillant, même dynamique.
  var tcOp = M.trailCoreMat.opacity;
  var tcTarget = Math.min(1, trTarget * 1.25);
  M.trailCoreMat.opacity = tcOp + (tcTarget - tcOp) * Math.min(1, dt * 4);
  M.trailCore.visible = M.trailCoreMat.opacity > 0.01;
  // La traînée s'allonge en phase d'impact (descente finale vers l'île).
  // v14 : elle s'allonge aussi avec l'altitude — visible de très loin.
  // v15 : traînée MONUMENTALE — encore plus longue, et elle ONDULE.
  var th = ROCK_RADIUS * (1 + altK * 0.7) *
    (M.state === 'rebound' ? 32 : (M.state === 'impacting' ? 30 :
     (M.state === 'descending' ? 26 : (M.state === 'falling' ? 22 : 18))));
  // v22 : la traînée de la plongée finale est un BRASIER (plus large).
  var trW = ROCK_RADIUS * (M.state === 'impacting' ? 6.2 : (M.state === 'rebound' ? 5.0 : 4.2));
  M.trail.scale.set(trW, th, 1);
  M.trailCore.scale.set(ROCK_RADIUS * 1.6, th * 0.92, 1);
  var swayAmp = ROCK_RADIUS * (M.state === 'impacting' ? 1.4 : (M.state === 'rebound' ? 1.2 : 0.7));
  M.trail.position.x = Math.sin(t * 6.3) * swayAmp;
  M.trailCore.position.x = Math.sin(t * 6.3 + 0.6) * swayAmp * 0.7;

  /* ----- Publications inter-modules ----- */

  AZ.meteorPos.copy(M.group.position); // position COURANTE, chaque frame
  AZ.meteorVisible = true;              // visible à l'écran
  AZ.meteorSolidR = ROCK_RADIUS;        // v32 : rayon SOLIDE du rocher (joueur)
  // v35 : rayon VISUEL live (toutes phases) — la collision suit le rocher
  // visible exact, jamais une sphère invisible dedans/dehors.
  try {
    var _ms = M.group.scale;
    AZ.meteorVisR = ROCK_RADIUS * Math.max(_ms.x, _ms.y, _ms.z);
  } catch (e) { AZ.meteorVisR = ROCK_RADIUS; }
  AZ.meteorSolidR = ROCK_RADIUS;        // v32 : rayon SOLIDE du rocher (joueur)
}

/* ---------------------------------------------------------------------------
 * Nettoyage : TOUT est libéré.
 * ------------------------------------------------------------------------- */

function dispose() {
  M.disposed = true;

  if (M.group && M.group.parent) M.group.parent.remove(M.group);

  if (M.rockGeo) M.rockGeo.dispose();
  if (M.rockMat) M.rockMat.dispose();
  if (M.fissureTex) M.fissureTex.dispose(); // v12 : fissures incandescentes
  if (M.haloLayers) { // v12 : 3 couches de halo
    for (var hli = 0; hli < M.haloLayers.length; hli++) M.haloLayers[hli].mat.dispose();
  }
  if (M.haloTex) M.haloTex.dispose();
  if (M.stasisRing) M.stasisRing.geometry.dispose(); // v21
  if (M.stasisMat) M.stasisMat.dispose(); // v21
  if (M.stasisRing2) M.stasisRing2.geometry.dispose(); // v22
  if (M.stasisMat2) M.stasisMat2.dispose(); // v22
  if (M.swallowMat2) M.swallowMat2.dispose(); // v22 (texture partagée : pas de double dispose)
  if (M.heatDomeMat) M.heatDomeMat.dispose(); // v22 (texture partagée)
  if (M.warpA) M.warpA.geometry.dispose(); // v22
  if (M.warpMatA) M.warpMatA.dispose(); // v22
  if (M.warpB) M.warpB.geometry.dispose(); // v22
  if (M.warpMatB) M.warpMatB.dispose(); // v22
  if (M.implSpr && M.implSpr.parent) M.implSpr.parent.remove(M.implSpr); // v22
  if (M.implMat) M.implMat.dispose(); // v22 (texture partagée)
  if (M.swallowMat) M.swallowMat.dispose(); // v21 (texture partagée : pas de double dispose)
  if (M.corona) { // v21
    for (var ci2 = 0; ci2 < M.corona.length; ci2++) {
      M.corona[ci2].geo.dispose();
      M.corona[ci2].mat.dispose();
    }
  }
  if (M.trailMat) M.trailMat.dispose();
  if (M.trailCoreMat) M.trailCoreMat.dispose(); // v13 : noyau interne
  if (M.trailTex) M.trailTex.dispose();
  if (M.emberGeo) M.emberGeo.dispose();
  if (M.emberMat) M.emberMat.dispose();
  if (M.emberTex) M.emberTex.dispose();
  if (M.zeroBeam && M.zeroBeam.parent) M.zeroBeam.parent.remove(M.zeroBeam); // v15
  if (M.zeroBeamMat) M.zeroBeamMat.dispose(); // v15 : colonne d'énergie
  if (M.zeroBeam) M.zeroBeam.geometry.dispose(); // v15
  if (M.flames) { for (var fi = 0; fi < M.flames.length; fi++) M.flames[fi].mat.dispose(); }
  if (M.flameTex) M.flameTex.dispose();
  if (M.smoke) { for (var si = 0; si < M.smoke.length; si++) M.smoke[si].mat.dispose(); }
  if (M.smokeTex) M.smokeTex.dispose();
  if (M.frags) { for (var gi = 0; gi < M.frags.length; gi++) M.frags[gi].mat.dispose(); }
  if (M.fragTex) M.fragTex.dispose();

  if (AZ) {
    AZ.meteorPos = null;     // ne pas laisser de position périmée
    AZ.meteorVisR = null;    // v18 : rayon visuel live (ne pas laisser périmer)
    AZ.meteorVisible = false;
  }

  M.group = null; M.rock = null; M.halo = null; M.haloLayers = null;
  M.fissureTex = null; M.trail = null; M.trailCore = null; M.trailCoreMat = null; // v13
  M.stasisRing = null; M.stasisMat = null; M.corona = null; // v21
  M.stasisRing2 = null; M.stasisMat2 = null; // v22
  M.swallowRing = null; M.swallowMat = null; // v21
  M.swallowRing2 = null; M.swallowMat2 = null; M.clapT = -1; // v22
  M.heatDome = null; M.heatDomeMat = null; // v22
  M.warpA = null; M.warpB = null; M.warpMatA = null; M.warpMatB = null; // v22
  M.implSpr = null; M.implMat = null; M.implT = -1; M.apogeeImplodeDone = false; // v22
  M.zeroBeam = null; M.zeroBeamMat = null; M.zeroBeamT = 0; // v15
  M.flames = null; M.smoke = null; M.smokeRand = null; M.frags = null;
  M.embers = null; M.emberGeo = null; M.emberMat = null; M.emberTex = null;
  M.emberData = null;
  M.points = null; M.emergePos = null; M.emergeEnd = null;
  M.fallFrom = null; M.fallTo = null; M.curPhase = null;
  M.api = null; M.T = null;
}

AZ.register('meteor', {
  init: init,
  update: update,
  dispose: dispose
});

})(window);
