/* event-suction.js — MODULE "THE END" : ASPIRATION (AZUR Horizons v10, groupe C).
 * v8 : ondes de choc au sol à chaque temps de destruction.
 * v10 :
 *  - le Battle Bus d'allgone est SUPPRIMÉ de ce module (doublon) : géré
 *    uniquement par event-arena.js (vol 2 s puis aspiration 2 s,
 *    'bus:appear'/'bus:sucked'). 'suction:busgone' disparaît (aucun écouteur).
 *  - destruction : les 7 temps ont des ondes de choc DISTINCTES (couleur
 *    bleu/blanc + rayon propres) ; les débris ont du POIDS (gravité
 *    d'abord, aspiration progressive ensuite — rampe smoothstep).
 * Timeline v5 (séquence finale) :
 *  - contraction  [281,286] : PAS de trou noir. L'énergie de l'impact
 *    REVIENT vers son centre : tout est aspiré vers le Point Zéro, la
 *    lumière se concentre, le centre rétrécit. Anneaux de contraction +
 *    particules convergentes. Émet 'suction:start'. Durée RELATIVE 5 s.
 *  - collapse/growth [286,294] : l'aspiration continue (le trou noir, géré
 *    par event-blackhole.js, prend le relais comme centre d'attraction).
 *  - destruction  [294,303] : destruction PROGRESSIVE de l'île en 7 temps
 *    LISIBLES mais ENCHAÎNÉS SANS LONGUEUR (~1,3 s/temps), avec des
 *    débris proxys basse-poly (le vrai monde n'est JAMAIS modifié),
 *    < 500 particules. Timing 100 % RELATIF à l'entrée de phase (aucun
 *    temps absolu en dur) : le séquenceur pilote les bornes réelles.
 *  - playersucked [303,308] : le JOUEUR est aspiré dans le trou noir —
 *    AZEvent.suctionActive = true (le module player le lit). Les proxys
 *    de joueurs tournoient vers le centre.
 *  - allgone      [308,312] : TOUT disparaît ; le BATTLE BUS est aspiré à
 *    son tour par event-arena.js (vol 2 s puis spirale 2 s vers le trou
 *    noir, 'bus:appear'/'bus:sucked'). AZEvent.suctionActive reste true.
 * Émet 'suction:end' au début de la phase 'blackhole'.
 * CONTRAT : ce module met AZEvent.suctionActive à true UNIQUEMENT pendant
 * 'playersucked' et 'allgone' (le module player le lit pour bloquer les
 * entrées et tirer la caméra vers le trou noir).
 * INTERDIT : tourbillons violets, teintes mauves (bleu/blanc uniquement).
 * v12 : l'aspiration des constructions passe par preUpdate() (AVANT la
 * simulation et le resync de view.js) — update() ne l'appelle plus.
 * v15 (passe "animation maximale", mécanismes v13/v14 intacts) :
 *  - traînées : sillage lumineux derrière chaque pièce aspirée (quad
 *    orienté le long du mouvement, opacité = vitesse), sauf mobile ;
 *  - étirement : la pièce s'allonge dans le sens de l'aspiration
 *    (spaghettification) en approchant du centre ;
 *  - accélération VISIBLE : ease-in vers le centre (la pièce est aspirée
 *    de plus en plus vite) ;
 *  - engloutissement : flash + IMPLOSION locale (anneau qui se contracte)
 *    quand une pièce disparaît — piscine de 10 effets.
 * Contrat : root.AZEvent.register('suction', {init, preUpdate, update, dispose}).
 * v21 — ASPIRATION À FOND :
 *  - COURANTS D'ASPIRATION : 6 rubans spiraux qui matérialisent le
 *    tourbillon (l'air lui-même spirale vers le centre), intensité par phase ;
 *  - COLONNE DU TOURBILLON : axe lumineux vertical et tournant au centre
 *    pendant playersucked/allgone (le « pilier » vers lequel tout converge) ;
 *  - les PROXYS DE JOUEURS laissent un sillage lumineux (traînées réutilisées) ;
 *  - le BATTLE BUS (event-arena.js) : anneau d'apparition sur 'bus:appear',
 *    implosion d'absorption sur 'bus:sucked' ;
 *  - front d'aspiration VISIBLE : un anneau balaie l'île quand la vague de
 *    détachement des constructions démarre ;
 *  - les ondes de choc des temps (beatRings) sont animées en continu
 *    (plus seulement pendant 'destruction') — la propulsion visuelle du
 *    joueur ('rocket:zeroshock') vit dans event-shockwave.js.
 * v22 — VERTIGE : le moment où tout s'envole doit donner le vertige —
 *  - courants spiraux PLUS DENSES (8 rubans, 5 sur mobile, plus lumineux) ;
 *  - les DÉBRIS en aspiration forte (état 2) laissent un sillage lumineux
 *    comme les pièces construites (traînées paresseuses, mêmes temps partagés) ;
 *  - le BATTLE BUS : triplet d'anneaux décalés à son apparition (il TANGUE
 *    dans le tourbillon), DOUBLE implosion décalée + spirale d'étincelles
 *    quand il est happé ;
 *  - COLONNE EXTERNE : second axe lumineux, plus large et pâle, qui tourne
 *    en SENS INVERSE + GEYSERS D'ÉNERGIE qui crachent vers le ciel ;
 *  - chaque temps de destruction CLAQUE un dôme de lumière dans sa couleur
 *    (signature propre, crescendo 1 -> 7) en plus du pré-halo 0,25 s ;
 *  - à l'entrée de 'playersucked' : GERBE ASCENDANTE MASSIVE + triple
 *    anneau (le vertige du décollage général).
 * Rien n'est supprimé/renommé : ajouts et enrichissements uniquement.
 */
(function (root) {
'use strict';

if (!root.AZEvent) return;

// ---------------------------------------------------------------- constantes
var N_PARTICLES = 400;           // < 500 : particules convergentes
var N_DEBRIS = 140;              // débris proxys (piscine réutilisée)
var MIN_RADIUS = 6;              // on ne traverse jamais le centre
var CONTRACT_SPAN = 5;           // durée RELATIVE de contraction [281,286] (s)

// Destruction [294,303] (9 s v5) : 7 temps, 100 % RELATIFS à l'entrée de
// phase (destructT0). BEAT_ENDS = fin de chaque temps (s), BEAT_RATE =
// génération continue de débris (débris/s) pendant le temps en cours.
var N_BEATS = 7;
var BEAT_ENDS = [1.3, 2.6, 3.9, 5.2, 6.5, 7.8, 9.0];
var BEAT_RATE = [4, 6, 8, 5, 7, 5, 10];

// Phases où les VISUELS du module vivent (contraction -> allgone).
var ACTIVE_PHASES = ['contraction', 'collapse', 'growth', 'destruction', 'playersucked', 'allgone'];

// Phases où le JOUEUR est aspiré (CONTRAT : suctionActive = true).
var SUCK_PHASES = ['playersucked', 'allgone'];

// ---------------------------------------------------------------- état local
var api = null;
var T = null;
function attractionCenter() { return root.AZEvent.zeroPointPos || (api && api.center) || { x: 0, y: 30, z: 0 }; }
var busBound = false;      // écouteurs du bus branchés une seule fois (pas de off())
var active = false;        // aspiration en cours (contraction -> blackhole)
var group = null;          // racine de tous les visuels du module
var rings = [];            // anneaux de contraction {mesh, mat}
var beatRings = [];        // v8 : ondes de choc des temps de destruction {mesh, mat}
var glow = null;           // halo central qui rétrécit (contraction)
var glowMat = null;
var pGeo = null, pMat = null, pPts = null; // système de particules
var pPos = null, pVel = null, pLife = null;
var debris = [];           // piscine de débris proxys {mesh, vel, spin, life, maxLife, kind}
var debrisGroup = null;
var playerProxys = [];     // "joueurs" proxys des temps 5 / playersucked {group, ...}
var beatIdx = -1;          // temps de destruction en cours (-1 = aucun)
var destructT0 = -1;       // t d'entrée en phase 'destruction' (référence RELATIVE)
var spawnAcc = 0;          // accumulateur de génération continue pendant le temps en cours
var preBeatArmed = [];    // v20 : pré-temps télégraphiés (anneau d'anticipation), un par temps
var contractT = 0;         // temps écoulé dans la phase 'contraction' (s) — jamais un absolu
// v10 : allgoneT supprimé (ne servait qu'au bus en double, voir ci-dessus).
var dimOverlay = null;     // voile léger pendant la contraction (lumière qui se concentre)
// v11 : ASPIRATION DES CONSTRUCTIONS — pendant playersucked/allgone, les
// pièces construites par le joueur (view.builds UNIQUEMENT, jamais le décor
// naturel view.objects) se détachent et sont ASPIRÉES vers le Point Zéro :
// soulèvement, spirale, disparition dedans. Plafond perf : 150 pièces.
var BUILD_SUCK_MAX = 150;   // plafond de pièces aspirées (perf)
var BUILD_SUCK_DUR = 2.6;   // durée de l'aspiration d'une pièce (s)
var buildSuck = [];         // v12 : [{mesh,id,dataRef,ox,oy,oz,ry,sx,sy,sz,delay,t,spin,done}]
var buildSucked = [];       // v12 : pièces restées aspirées (flux normal vers 'blackhole')
var buildSuckIds = {};      // id -> true : pièces déjà suivies
var buildSuckDoneIds = {};  // id -> true : pièces déjà aspirées
var buildSuckPhase = '';    // phase pour laquelle on a complété la liste
// v13 — durcissement aspiration des constructions :
//  - guards + try/catch partout (une pièce récalcitrante ne bloque jamais
//    les autres, et le balayage ne casse jamais la frame — le séquenceur
//    avale les exceptions par module, un throw ici sauterait TOUTE
//    l'animation de la frame) ;
//  - le balayage part des DONNÉES MONDE (world.builds, source de vérité),
//    pas seulement de la vue ;
//  - repli PROXY : si le mesh n'est pas trouvable en vue, la donnée est
//    quand même marquée morte et un proxy visible est animé à la place —
//    la construction DOIT visiblement partir vers le Point Zéro ;
//  - visible FORCÉ à la prise de contrôle (la vue a pu élaguer le mesh
//    au-delà de distLimit : il restait invisible pendant l'animation) ;
//  - re-balayage périodique : les constructions posées PENDANT la phase
//    sont aussi aspirées.
var BUILD_SUCK_RECOLLECT = 1.0; // re-balaye les constructions chaque seconde
var buildSuckLastCollect = -10; // dernier balayage (tTotal)
var proxyGeo = null;            // géométrie partagée des proxys de repli
var proxyMatShared = null;      // matériau partagé des proxys de repli
// v15 — passe "animation maximale" (RENDU UNIQUEMENT : les mécanismes
// v13/v14 ci-dessus sont intacts) :
var lowQ = false;        // mobile : particules allégées, pas de traînées
var trailGeo = null;     // quad unitaire partagé des traînées
var trailTex = null;     // texture dégradée des traînées (sillage lumineux)
var gobbles = [];        // piscine d'engloutissements {flash, ring, age, active}
var GOBBLE_N = 10;
// v21 — COURANTS D'ASPIRATION + COLONNE DU TOURBILLON (rendu uniquement) :
// des rubans spiraux matérialisent le tourbillon (l'air lui-même spirale
// vers le centre) et un axe lumineux tournant marque le centre pendant
// playersucked/allgone. Zéro allocation par frame.
var streamers = [];      // {mesh, mat, seed}
var vortexCol = null;    // cylindre lumineux vertical au centre
var vortexColMat = null;
var vortexCol2 = null;   // v22 : colonne externe (sens inverse, plus large et pâle)
var vortexColMat2 = null;
var geyserT = 0;         // v22 : minuteur des geysers d'énergie
var prevSt = '';         // v22 : état précédent (détection de l'entrée en playersucked)
// Temps de calcul des traînées (évite les allocations par frame).
var _tDir = null, _tN = null, _tY = null, _tM = null, _tMid = null;
function getProxyGeo() {
  if (!proxyGeo) proxyGeo = new T.BoxGeometry(2, 2, 2);
  return proxyGeo;
}
function getProxyMat() {
  if (!proxyMatShared) proxyMatShared = new T.MeshBasicMaterial({ color: 0x9adcff, fog: true });
  return proxyMatShared;
}

/* ---------------------------------------------------------------------------
 * v15 — TRAÎNÉES et ENGLOUTISSEMENTS (rendu uniquement).
 * - Chaque pièce aspirée laisse un SILLAGE LUMINEUX : un quad additif orienté
 *   le long de son mouvement (base orthonormée calculée par frame, sans
 *   allocation), opacité proportionnelle à la vitesse. Sauf mobile.
 * - Quand une pièce disparaît : ENGLOUTISSEMENT — flash + IMPLOSION locale
 *   (un anneau qui se CONTRACTE vers le point de disparition).
 * ------------------------------------------------------------------------- */

// Texture de traînée : dégradé blanc -> transparent (tête lumineuse à droite).
function makeTrailTexture() {
  var c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  var g = c.getContext('2d');
  var grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(190,230,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 16);
  return new T.CanvasTexture(c);
}

function getTrailGeo() {
  if (!trailGeo) trailGeo = new T.PlaneGeometry(1, 1);
  return trailGeo;
}

function getTrailTex() {
  if (!trailTex) trailTex = makeTrailTexture();
  return trailTex;
}

function ensureTrailTemps() {
  if (_tM) return;
  _tDir = new T.Vector3();
  _tN = new T.Vector3();
  _tY = new T.Vector3();
  _tM = new T.Matrix4();
  _tMid = new T.Vector3();
  _tUpVec = new T.Vector3(0, 1, 0);
  _tX = new T.Vector3(1, 0, 0);
}
var _tUpVec = null, _tX = null;

// Crée (une fois) la traînée d'une pièce qui entre en spirale.
function ensurePieceTrail(s) {
  if (s.trail || lowQ) return;
  try {
    ensureTrailTemps();
    var mat = new T.MeshBasicMaterial({
      map: getTrailTex(), color: 0xcfeaff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide
    });
    var mesh = new T.Mesh(getTrailGeo(), mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    if (group) group.add(mesh); // group est à l'origine : coordonnées monde directes
    s.trail = mesh;
    s.px = s.ox; s.py = s.oy + 14; s.pz = s.oz; // position précédente (début phase 2)
  } catch (e) { s.trail = null; }
}

// Met à jour la traînée : orientée le long du mouvement, longueur et
// opacité pilotées par la vitesse (plus la pièce file, plus le sillage claque).
function updatePieceTrail(s, dt) {
  var tr = s.trail, m = s.mesh;
  if (!tr || !m) return;
  try {
    _tDir.set(m.position.x - s.px, m.position.y - s.py, m.position.z - s.pz);
    var len = _tDir.length();
    var speed = dt > 0 ? len / dt : 0;
    if (len < 0.5 || speed < 4) {
      tr.visible = false;
    } else {
      tr.visible = true;
      _tDir.multiplyScalar(1 / len);
      // base orthonormée : X = direction du mouvement, Z = normale
      // (si le mouvement est quasi vertical, on prend X comme référence)
      _tN.crossVectors(_tDir, Math.abs(_tDir.y) > 0.94 ? _tX : _tUpVec).normalize();
      _tY.crossVectors(_tN, _tDir).normalize();
      _tM.makeBasis(_tDir, _tY, _tN);
      tr.quaternion.setFromRotationMatrix(_tM);
      var trailLen = Math.min(len * 2.2, 42);
      _tMid.set((m.position.x + s.px) / 2, (m.position.y + s.py) / 2, (m.position.z + s.pz) / 2);
      tr.position.copy(_tMid).addScaledVector(_tDir, -trailLen * 0.22); // le sillage traîne derrière
      tr.scale.set(trailLen, 2.4, 1);
      tr.material.opacity = Math.min(0.75, speed / 160);
    }
    s.px = m.position.x; s.py = m.position.y; s.pz = m.position.z;
  } catch (e) { /* la traînée ne casse jamais l'aspiration */ }
}

// Retire la traînée d'une pièce (fin d'animation ou restauration).
function killPieceTrail(s) {
  if (s.trail) {
    try {
      if (s.trail.parent) s.trail.parent.remove(s.trail);
      if (s.trail.material) s.trail.material.dispose(); // matériau par pièce ; géométrie/texture partagées
    } catch (e) { /* ignore */ }
    s.trail = null;
  }
}

// v22 — SILLAGES DES DÉBRIS ASPIRÉS : les débris en aspiration forte
// (état 2) laissent une traînée lumineuse comme les pièces construites
// (v15). Création paresseuse (jamais à la frame), animation via
// updatePieceTrail() (générique : mêmes temps partagés, zéro allocation
// par frame), retrait via killPieceTrail() (générique). Sauf mobile.
function ensureDebrisTrail(d) {
  if (d.trail || lowQ || !d.mesh) return;
  try {
    ensureTrailTemps();
    var mat = new T.MeshBasicMaterial({
      map: getTrailTex(), color: 0xcfeaff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide
    });
    var mesh = new T.Mesh(getTrailGeo(), mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    if (group) group.add(mesh); // group est à l'origine : coordonnées monde directes
    d.trail = mesh;
    d.px = d.mesh.position.x; d.py = d.mesh.position.y; d.pz = d.mesh.position.z;
  } catch (e) { d.trail = null; }
}

// Une pièce vient d'être engloutie : flash + IMPLOSION locale (l'anneau se
// CONTRACTE vers le point de disparition en s'embrasant).
function fireGobble(x, y, z) {
  for (var i = 0; i < gobbles.length; i++) {
    var g = gobbles[i];
    if (g.active) continue;
    g.active = true; g.age = 0;
    g.flash.position.set(x, y, z);
    g.flash.visible = true;
    g.flash.material.opacity = 0.95;
    g.flash.scale.set(6, 6, 1);
    g.ring.position.set(x, y, z);
    g.ring.visible = true;
    g.ring.scale.set(16, 16, 1);
    g.ring.material.opacity = 0.85;
    return;
  }
}

function updateGobble(dt) {
  for (var i = 0; i < gobbles.length; i++) {
    var g = gobbles[i];
    if (!g.active) continue;
    g.age += dt;
    var k = g.age / 0.45;
    if (k >= 1) {
      g.active = false;
      g.flash.visible = false;
      g.ring.visible = false;
      continue;
    }
    // flash : pop puis fondu rapide
    var fo = 1 - k;
    g.flash.material.opacity = 0.95 * fo * fo;
    var fs = 6 + (1 - fo) * 26;
    g.flash.scale.set(fs, fs, 1);
    // IMPLOSION : l'anneau se contracte vers le centre en s'embrasant
    var rr = 16 * (1 - k) * (1 - k) + 0.5;
    g.ring.scale.set(rr, rr, 1);
    g.ring.material.opacity = 0.85 * (1 - k * 0.5);
    g.ring.rotation.z -= dt * 9;
  }
}
// v10 : le Battle Bus de 'allgone' est géré UNIQUEMENT par event-arena.js
// (prop bus + ballon, vol puis aspiration, 'bus:appear'/'bus:sucked') :
// le proxy en double de ce module est SUPPRIMÉ (deux bus visibles sinon).

// ---------------------------------------------------------------- utilitaires
function isActivePhase() {
  var s = root.AZEvent.state;
  for (var i = 0; i < ACTIVE_PHASES.length; i++) if (ACTIVE_PHASES[i] === s) return true;
  return false;
}

// CONTRAT : suctionActive = true UNIQUEMENT pendant playersucked/allgone.
// Le module player le lit (blocage des entrées, tirage de la caméra).
function syncSuctionFlag() {
  var s = root.AZEvent.state;
  root.AZEvent.suctionActive = (s === 'playersucked' || s === 'allgone');
}

// Texture radiale douce (halo), dessinée sur canvas, aucun réseau.
function makeGlowTexture() {
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(220,240,255,1)');
  grad.addColorStop(0.35, 'rgba(140,200,255,0.55)');
  grad.addColorStop(0.7, 'rgba(80,140,255,0.18)');
  grad.addColorStop(1.0, 'rgba(60,120,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

// Monde du jeu (mêmes données que la vue resync : sim.js y lit b.dead
// pour les collisions — marquer dead=true supprime aussi le blocage).
function world() { var g = root.AZUR; return (g && g.world) ? g.world : null; }

// ---------------------------------------------------------------- construction
function build() {
  var scene = (api && typeof api.scene === 'function') ? api.scene() : null; // v13 : garde anti api nul
  if (!scene) return;
  disposeVisuals();

  group = new T.Group();
  group.name = 'azevent-suction';
  var center = attractionCenter();

  // --- Anneaux de contraction : tores horizontaux qui se resserrent ---
  rings = [];
  for (var i = 0; i < 5; i++) {
    var mat = new T.MeshBasicMaterial({
      color: (i % 2) ? 0x66ccff : 0x99ddff,
      transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var mesh = new T.Mesh(new T.TorusGeometry(1, 0.012, 6, 80), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, center.y + 12 + i * 10, center.z);
    var r0 = 170 - i * 28;
    mesh.userData = { r: r0, rMax: r0, speed: 70 + i * 18, dir: (i % 2 === 0) ? 1 : -1 };
    mesh.scale.set(r0, r0, 1);
    group.add(mesh);
    rings.push({ mesh: mesh, mat: mat });
  }

  // --- v8 : ondes de choc des temps de destruction (piscine de 8 anneaux plats) ---
  beatRings = [];
  for (var bi = 0; bi < 8; bi++) {
    var bmat = new T.MeshBasicMaterial({
      color: 0xbfe4ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false,
      side: T.DoubleSide
    });
    var bmesh = new T.Mesh(new T.RingGeometry(0.984, 1.0, 80), bmat);
    bmesh.rotation.x = -Math.PI / 2;
    bmesh.visible = false;
    bmesh.userData = { active: false, age: 0, maxR: 120 };
    group.add(bmesh);
    beatRings.push({ mesh: bmesh, mat: bmat });
  }

  // --- Halo central : la lumière se concentre, le centre rétrécit ---
  glowMat = new T.SpriteMaterial({
    map: makeGlowTexture(), transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });
  glow = new T.Sprite(glowMat);
  glow.position.set(center.x, center.y + 18, center.z);
  glow.scale.set(120, 120, 1);
  group.add(glow);

  // --- Particules convergentes : tout est aspiré vers le Point Zéro ---
  // v15 : compte réduit sur mobile (lowQ).
  var nPart = lowQ ? 200 : N_PARTICLES;
  pGeo = new T.BufferGeometry();
  pPos = new Float32Array(nPart * 3);
  pVel = new Float32Array(nPart * 3);
  pLife = new Float32Array(nPart);
  for (var p = 0; p < nPart; p++) respawnParticle(p, true);
  pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
  pMat = new T.PointsMaterial({
    color: 0x9adcff, size: 2.2, transparent: true, opacity: 0.85,
    blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
  });
  pPts = new T.Points(pGeo, pMat);
  pPts.frustumCulled = false;
  group.add(pPts);

  // --- Piscine de débris proxys (basse-poly, monde réel jamais touché) ---
  debrisGroup = new T.Group();
  debrisGroup.name = 'azevent-debris';
  group.add(debrisGroup);
  debris = [];
  var boxGeo = new T.BoxGeometry(1, 1, 1);
  var tetGeo = new T.TetrahedronGeometry(1);
  var mats = [
    new T.MeshBasicMaterial({ color: 0x8a7f6a, fog: true }),   // roche
    new T.MeshBasicMaterial({ color: 0x6f7f6a, fog: true }),   // terre/verdure
    new T.MeshBasicMaterial({ color: 0x9aa4ad, fog: true }),   // béton
    new T.MeshBasicMaterial({ color: 0x7fb2d9, fog: true })    // métal clair
  ];
  for (var d = 0; d < (lowQ ? 70 : N_DEBRIS); d++) { // v15 : allégé sur mobile
    var geo = (d % 3 === 0) ? tetGeo : boxGeo;
    var m = new T.Mesh(geo, mats[d % mats.length]);
    m.visible = false;
    m.scale.setScalar(0.001);
    debrisGroup.add(m);
    debris.push({ mesh: m, vel: new T.Vector3(), spin: new T.Vector3(),
                  life: 0, maxLife: 1, size: 1, state: 0 });
  }
  // Les géométries/matériaux partagés sont libérés dans disposeVisuals via userData.
  group.userData.shared = { geos: [boxGeo, tetGeo], mats: mats };

  // --- v15 : piscine d'ENGLOUTISSEMENTS — flash + IMPLOSION locale quand
  // une pièce construite disparaît dans le Point Zéro.
  gobbles = [];
  for (var gb = 0; gb < GOBBLE_N; gb++) {
    var gFlash = new T.Sprite(new T.SpriteMaterial({
      map: makeGlowTexture(), color: 0xeaf6ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    }));
    gFlash.scale.set(2, 2, 1);
    gFlash.visible = false;
    group.add(gFlash);
    var gRing = new T.Mesh(
      new T.RingGeometry(0.92, 1.0, 48),
      new T.MeshBasicMaterial({
        color: 0xd6ecff, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide
      })
    );
    gRing.rotation.x = -Math.PI / 2;
    gRing.visible = false;
    group.add(gRing);
    gobbles.push({ flash: gFlash, ring: gRing, age: 0, active: false });
  }

  // --- v21 : COURANTS D'ASPIRATION — 6 rubans spiraux qui matérialisent le
  // tourbillon (l'air lui-même spirale vers le centre). Géométrie partagée,
  // opacité pilotée par phase dans updateStreamers().
  // v22 : 8 rubans (5 sur mobile) — le tourbillon est plus DENSE.
  streamers = [];
  var streamGeo = new T.PlaneGeometry(1, 1);
  var nStream = lowQ ? 5 : 8; // v22 : allégé sur mobile
  for (var st = 0; st < nStream; st++) {
    var smat = new T.MeshBasicMaterial({
      map: getTrailTex(), color: 0x9fd4ff,
      transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false,
      side: T.DoubleSide
    });
    var smesh = new T.Mesh(streamGeo, smat);
    smesh.frustumCulled = false;
    smesh.visible = false;
    group.add(smesh);
    streamers.push({ mesh: smesh, mat: smat, seed: st / nStream });
  }

  // --- v21 : COLONNE DU TOURBILLON — axe lumineux vertical et tournant au
  // centre de l'aspiration (le « pilier » vers lequel tout converge).
  vortexColMat = new T.MeshBasicMaterial({
    color: 0xaed6ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var vcGeo = new T.CylinderGeometry(9, 22, 260, 20, 1, true);
  vortexCol = new T.Mesh(vcGeo, vortexColMat);
  vortexCol.position.set(center.x, center.y + 130, center.z);
  vortexCol.frustumCulled = false;
  vortexCol.visible = false;
  group.add(vortexCol);
  // v22 : COLONNE EXTERNE — second axe lumineux, plus large et plus pâle,
  // qui tourne en SENS INVERSE (le tourbillon a deux couches, comme un
  // vrai cyclone). Géométrie partagée enregistrée pour disposeVisuals().
  vortexColMat2 = new T.MeshBasicMaterial({
    color: 0x8fbfff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var vcGeo2 = new T.CylinderGeometry(16, 34, 200, 16, 1, true);
  vortexCol2 = new T.Mesh(vcGeo2, vortexColMat2);
  vortexCol2.position.set(center.x, center.y + 100, center.z);
  vortexCol2.frustumCulled = false;
  vortexCol2.visible = false;
  group.add(vortexCol2);
  // v21 : géométries partagées enregistrées pour disposeVisuals().
  if (group.userData.shared) {
    group.userData.shared.geos.push(streamGeo);
    group.userData.shared.geos.push(vcGeo);
    group.userData.shared.geos.push(vcGeo2); // v22
  }

  scene.add(group);

  // --- Voile léger : l'écran se concentre sur le centre (pas un trou noir) ---
  if (typeof document !== 'undefined') {
    dimOverlay = document.createElement('div');
    dimOverlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;' +
      'background:radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(2,6,20,0.12) 100%);' +
      'opacity:0;transition:opacity 2s;';
    document.body.appendChild(dimOverlay);
    setTimeout(function () { if (dimOverlay) dimOverlay.style.opacity = '1'; }, 50);
  }
}

function disposeVisuals() {
  if (dimOverlay && dimOverlay.parentNode) dimOverlay.parentNode.removeChild(dimOverlay);
  dimOverlay = null;
  // détruit les "joueurs" proxys (groupes composites)
  for (var i = 0; i < playerProxys.length; i++) {
    var pg = playerProxys[i].group;
    if (pg.parent) pg.parent.remove(pg);
    pg.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  playerProxys = [];
  // v10 : bus supprimé (géré par event-arena.js uniquement).
  if (group) {
    if (group.parent) group.parent.remove(group);
    group.traverse(function (o) {
      if (o === pPts) return; // traité ci-dessous
      if (o.geometry && !(group.userData.shared && group.userData.shared.geos.indexOf(o.geometry) >= 0)) o.geometry.dispose();
      if (o.material && !(group.userData.shared && group.userData.shared.mats.indexOf(o.material) >= 0)) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    var sh = group.userData.shared;
    if (sh) {
      for (var g = 0; g < sh.geos.length; g++) sh.geos[g].dispose();
      for (var m = 0; m < sh.mats.length; m++) sh.mats[m].dispose();
    }
    if (pGeo) pGeo.dispose();
    if (pMat) pMat.dispose();
  }
  group = null; rings = []; beatRings = []; glow = null; glowMat = null; // v8 : beatRings
  pGeo = null; pMat = null; pPts = null; pPos = null; pVel = null; pLife = null;
  debris = []; debrisGroup = null; beatIdx = -1; destructT0 = -1; spawnAcc = 0;
  if (proxyGeo) { try { proxyGeo.dispose(); } catch (e) { /* ignore */ } proxyGeo = null; } // v13
  if (proxyMatShared) { try { proxyMatShared.dispose(); } catch (e) { /* ignore */ } proxyMatShared = null; } // v13
  // v15 : les traînées (enfants de group) sont libérées par le traverse ;
  // on réarme les partagés (la texture a pu être disposée via un matériau).
  gobbles = [];
  trailGeo = null;
  trailTex = null;
  _tDir = _tN = _tY = _tM = _tMid = null;
  _tUpVec = null; _tX = null;
  // v21 : courants d'aspiration + colonne du tourbillon (enfants de group,
  // libérés par le traverse) — on réinitialise les références.
  streamers = [];
  vortexCol = null; vortexColMat = null;
  vortexCol2 = null; vortexColMat2 = null; // v22 : colonne externe
  geyserT = 0; // v22 : minuteur des geysers
  prevSt = ''; // v22 : détection d'entrée en playersucked
  _stW = null; _stM = null;
}

// ---------------------------------------------------------------- particules
// Replace une particule sur un anneau lointain (vitesse initiale vers le centre).
function respawnParticle(i, randomAge) {
  var c = attractionCenter();
  var ang = Math.random() * Math.PI * 2;
  var rad = 60 + Math.random() * 200;
  pPos[i * 3] = c.x + Math.cos(ang) * rad;
  pPos[i * 3 + 1] = c.y - 10 + Math.random() * 150;
  pPos[i * 3 + 2] = c.z + Math.sin(ang) * rad;
  pVel[i * 3] = 0; pVel[i * 3 + 1] = 0; pVel[i * 3 + 2] = 0;
  pLife[i] = randomAge ? Math.random() * 3.2 : 3.2; // durée de vie (s) — convergence rapide
}

function updateParticles(dt, pull) {
  if (!pPts) return;
  var c = attractionCenter();
  var nP = pLife.length; // v15 : compte réel (allégé sur mobile)
  for (var i = 0; i < nP; i++) {
    pLife[i] -= dt;
    var ix = i * 3;
    var dx = c.x - pPos[ix], dy = (c.y + 10) - pPos[ix + 1], dz = c.z - pPos[ix + 2];
    var dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    if (pLife[i] <= 0 || dist < MIN_RADIUS) { respawnParticle(i, false); continue; }
    // accélération radiale (vers le centre) + tangentielle (tourbillon bleu)
    var nx = dx / dist, nz = dz / dist;
    var ax = nx * pull + (-nz) * pull * 0.95;
    var az = nz * pull + (nx) * pull * 0.95;
    pVel[ix] += ax * dt; pVel[ix + 2] += az * dt;
    pVel[ix + 1] += (dy * 0.4 - pVel[ix + 1] * 0.3) * dt;
    // amortissement léger pour une spirale stable
    pVel[ix] *= (1 - 0.06 * dt); pVel[ix + 2] *= (1 - 0.06 * dt);
    pPos[ix] += pVel[ix] * dt;
    pPos[ix + 1] += pVel[ix + 1] * dt;
    pPos[ix + 2] += pVel[ix + 2] * dt;
  }
  pGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- débris proxys
// Active un débris de la piscine à une position donnée.
function spawnDebris(x, y, z, size, vx, vy, vz, life) {
  for (var i = 0; i < debris.length; i++) {
    var d = debris[i];
    if (d.life > 0) continue;
    d.mesh.visible = true;
    d.mesh.position.set(x, y, z);
    d.mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    d.mesh.scale.set(size * (0.7 + Math.random() * 0.6), size * (0.5 + Math.random() * 0.8), size * (0.7 + Math.random() * 0.6));
    d.vel.set(vx, vy, vz);
    d.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    d.life = life; d.maxLife = life; d.size = size; d.state = 1;
    d.trail = null; // v22 : la traînée éventuelle du slot précédent est morte avec lui
    return d;
  }
  return null; // piscine épuisée : on ne dépasse jamais le budget
}

// Un "joueur" proxy : capsule basse-poly (corps + tête) qui sera aspirée.
function spawnPlayerProxy(x, y, z) {
  var g = new T.Group();
  var suit = new T.MeshBasicMaterial({ color: 0xd9e2ec, fog: true });
  var body = new T.Mesh(new T.CylinderGeometry(0.45, 0.55, 1.3, 8), suit);
  body.position.y = 0.85;
  var head = new T.Mesh(new T.SphereGeometry(0.32, 8, 6), suit);
  head.position.y = 1.85;
  g.add(body); g.add(head);
  g.position.set(x, y, z);
  debrisGroup.add(g);
  var pr = { group: g, life: 6, ang: Math.atan2(z - api.center.z, x - api.center.x),
             rad: Math.hypot(x - api.center.x, z - api.center.z), y: y, spin: 2 + Math.random() * 3,
             ox: x, oy: y, oz: z, trail: null, mesh: g }; // v21 : sillage du proxy (mesh = le groupe, pour les traînées)
  playerProxys.push(pr);
  return pr;
}

// v10 : spawnBus()/updateBus() SUPPRIMÉS — le Battle Bus d'allgone est géré
// uniquement par event-arena.js (vol 2 s puis aspiration 2 s, 'bus:appear'/
// 'bus:sucked'). L'ancien doublon émettait 'suction:busgone' (aucun écouteur).

// v10 : chaque temps a son onde de choc DISTINCTE (couleur bleu/blanc +
// rayon propres) — les 7 temps se lisent visuellement.
var BEAT_RING_R = [150, 170, 190, 210, 230, 270, 330];
var BEAT_RING_COLOR = [0xeaf4ff, 0xbfe4ff, 0x9adcff, 0xffffff, 0x8fd0ff, 0xd6e8ff, 0xffffff];

// Déclenche un temps de destruction (index 0..6).
function triggerBeat(b) {
  var c = attractionCenter();
  var i, ang, rad, x, z, y;
  // v8 : onde de choc au sol à chaque temps (l'île tremble).
  // v10 : couleur + rayon distincts par temps.
  fireBeatRing(c.x, c.y + 3, c.z, BEAT_RING_R[b], BEAT_RING_COLOR[b]);
  // v20 — GERBE ASCENDANTE par temps : des étincelles bleu-blanches FUSENT
  // vers le ciel depuis le centre (plus vite à chaque temps) — le ciel
  // participe au temps de destruction.
  try {
    var fx20 = (root.AZEvent && root.AZEvent.fx) || null;
    if (fx20 && fx20.sparkJet) fx20.sparkJet({ x: c.x, y: c.y + 5, z: c.z },
      { count: 26, dir: { x: 0, y: 1, z: 0 }, spread: 0.28,
        speed: 150 + b * 22, color: BEAT_RING_COLOR[b], size: 6,
        life: 1.0, gravity: 40 });
  } catch (e) { /* jamais bloquant */ }
  // v22 — SIGNATURE DU TEMPS : un dôme de lumière CLAQUE au déclenchement,
  // dans la couleur propre du temps (le temps est télégraphié par le
  // pré-halo 0,25 s, puis frappé avec sa signature — crescendo 1 -> 7).
  try {
    var fx22b = (root.AZEvent && root.AZEvent.fx) || null;
    if (fx22b && fx22b.halo) fx22b.halo({ x: c.x, y: c.y + 5, z: c.z },
      { anticip: 0.12, dur: 0.5, radius: BEAT_RING_R[b] * 0.9,
        color: BEAT_RING_COLOR[b], y: 4 });
  } catch (e) { /* jamais bloquant */ }
  if (b === 0) {
    // TEMPS 1 : premiers morceaux qui se détachent (bord de l'île, soulèvement)
    for (i = 0; i < 22; i++) {
      ang = Math.random() * Math.PI * 2; rad = 130 + Math.random() * 60;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad; y = c.y + 2 + Math.random() * 8;
      spawnDebris(x, y, z, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 6 + Math.random() * 10, (Math.random() - 0.5) * 6, 9);
    }
  } else if (b === 1) {
    // TEMPS 2 : objets aspirés (petits, spirale rapide vers le centre)
    for (i = 0; i < 26; i++) {
      ang = Math.random() * Math.PI * 2; rad = 90 + Math.random() * 90;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad; y = c.y + Math.random() * 30;
      var d = spawnDebris(x, y, z, 0.8 + Math.random() * 1.2, 0, 2, 0, 8);
      if (d) d.state = 2; // état "aspiration forte"
    }
  } else if (b === 2) {
    // TEMPS 3 : structures qui se désagrègent (éclatement sur place puis aspiration)
    for (i = 0; i < 30; i++) {
      ang = Math.random() * Math.PI * 2; rad = 60 + Math.random() * 80;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad; y = c.y + 4 + Math.random() * 26;
      var d2 = spawnDebris(x, y, z, 1.5 + Math.random() * 2.5,
        (Math.random() - 0.5) * 22, 4 + Math.random() * 12, (Math.random() - 0.5) * 22, 9);
      if (d2) { d2.state = 2; d2.spin.multiplyScalar(2); }
    }
  } else if (b === 3) {
    // TEMPS 4 : morceaux de terrain qui se SOULÈVENT (grandes dalles, lentes)
    for (i = 0; i < 14; i++) {
      ang = Math.random() * Math.PI * 2; rad = 80 + Math.random() * 80;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad; y = c.y + 1;
      var d3 = spawnDebris(x, y, z, 7 + Math.random() * 7, 0, 5 + Math.random() * 4, 0, 12);
      if (d3) d3.state = 3; // état "soulèvement" : monte, bascule, puis aspiré
    }
  } else if (b === 4) {
    // TEMPS 5 : joueurs aspirés (proxys capsules, tournoient vers le centre)
    for (i = 0; i < 8; i++) {
      ang = Math.random() * Math.PI * 2; rad = 55 + Math.random() * 55;
      spawnPlayerProxy(c.x + Math.cos(ang) * rad, c.y + 8 + Math.random() * 25, c.z + Math.sin(ang) * rad);
    }
    for (i = 0; i < 12; i++) {
      ang = Math.random() * Math.PI * 2; rad = 100 + Math.random() * 60;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad;
      var d4 = spawnDebris(x, c.y + Math.random() * 20, z, 1 + Math.random() * 1.5, 0, 3, 0, 8);
      if (d4) d4.state = 2;
    }
  } else if (b === 5) {
    // TEMPS 6 : GRANDES portions de terrain qui disparaissent (s'enfoncent/rétrécissent)
    for (i = 0; i < 12; i++) {
      ang = (i / 12) * Math.PI * 2 + Math.random() * 0.4; rad = 60 + Math.random() * 90;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad;
      var d5 = spawnDebris(x, c.y + 3, z, 10 + Math.random() * 10, 0, -2, 0, 7);
      if (d5) d5.state = 4; // état "disparition" : rétrécit sur place
    }
  } else {
    // TEMPS 7 : l'île ENTIÈRE se désintègre (tout converge et s'évanouit)
    for (i = 0; i < 44; i++) {
      ang = Math.random() * Math.PI * 2; rad = 20 + Math.random() * 160;
      x = c.x + Math.cos(ang) * rad; z = c.z + Math.sin(ang) * rad; y = c.y + Math.random() * 50;
      var d6 = spawnDebris(x, y, z, 1 + Math.random() * 4, 0, 6 + Math.random() * 8, 0, 7);
      if (d6) d6.state = 2;
    }
  }
  api.emit('suction:beat', { beat: b + 1 }); // pour info (audio/hud)
}

// v8 : active une onde de choc de destruction au point (x,y,z).
// v10 : couleur propre à chaque temps (bleu/blanc uniquement).
function fireBeatRing(x, y, z, maxR, color) {
  for (var i = 0; i < beatRings.length; i++) {
    var br = beatRings[i], u = br.mesh.userData;
    if (u.active) continue;
    u.active = true; u.age = 0; u.maxR = maxR || 150;
    br.mesh.position.set(x, y, z);
    br.mesh.scale.set(6, 6, 1);
    br.mesh.visible = true;
    br.mat.color.setHex(color || 0xbfe4ff);
    br.mat.opacity = 0.85;
    return;
  }
}

// v8 : expansion + fondu des ondes de choc (appelée en phase destruction).
function updateBeatRings(dt) {
  for (var i = 0; i < beatRings.length; i++) {
    var br = beatRings[i], u = br.mesh.userData;
    if (!u.active) continue;
    u.age += dt;
    var k = u.age / 1.15; // ~1,15 s d'expansion
    if (k >= 1) { u.active = false; br.mesh.visible = false; br.mat.opacity = 0; continue; }
    var e = 1 - Math.pow(1 - k, 2); // easeOut
    var rr = 6 + (u.maxR - 6) * e;
    br.mesh.scale.set(rr, rr, 1);
    br.mat.opacity = 0.85 * (1 - k);
  }
}

// Génération continue pendant un temps de destruction : quelques débris par
// appel, dans le thème du temps en cours (b : 0..6). Complète le burst initial
// de triggerBeat pour que chaque temps (~1,3 s) reste vivant du début à la fin.
function trickleBeat(b) {
  var c = attractionCenter();
  var ang = Math.random() * Math.PI * 2;
  var rad, d;
  if (b === 0) {
    // morceaux qui se détachent du bord de l'île
    rad = 130 + Math.random() * 60;
    spawnDebris(c.x + Math.cos(ang) * rad, c.y + 2 + Math.random() * 8, c.z + Math.sin(ang) * rad,
      2 + Math.random() * 3, (Math.random() - 0.5) * 6, 6 + Math.random() * 10, (Math.random() - 0.5) * 6, 7);
  } else if (b === 1) {
    // petits objets aspirés en spirale rapide
    rad = 90 + Math.random() * 90;
    d = spawnDebris(c.x + Math.cos(ang) * rad, c.y + Math.random() * 30, c.z + Math.sin(ang) * rad,
      0.8 + Math.random() * 1.2, 0, 2, 0, 6);
    if (d) d.state = 2;
  } else if (b === 2) {
    // éclats de structures qui se désagrègent
    rad = 60 + Math.random() * 80;
    d = spawnDebris(c.x + Math.cos(ang) * rad, c.y + 4 + Math.random() * 26, c.z + Math.sin(ang) * rad,
      1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 22, 4 + Math.random() * 12, (Math.random() - 0.5) * 22, 7);
    if (d) { d.state = 2; d.spin.multiplyScalar(2); }
  } else if (b === 3) {
    // dalles de terrain qui se soulèvent
    rad = 80 + Math.random() * 80;
    d = spawnDebris(c.x + Math.cos(ang) * rad, c.y + 1, c.z + Math.sin(ang) * rad,
      7 + Math.random() * 7, 0, 5 + Math.random() * 4, 0, 10);
    if (d) d.state = 3;
  } else if (b === 4) {
    // joueurs aspirés (un proxy de temps en temps) + débris
    if (playerProxys.length < 6 && Math.random() < 0.25) {
      rad = 55 + Math.random() * 55;
      spawnPlayerProxy(c.x + Math.cos(ang) * rad, c.y + 8 + Math.random() * 25, c.z + Math.sin(ang) * rad);
    } else {
      rad = 100 + Math.random() * 60;
      d = spawnDebris(c.x + Math.cos(ang) * rad, c.y + Math.random() * 20, c.z + Math.sin(ang) * rad,
        1 + Math.random() * 1.5, 0, 3, 0, 6);
      if (d) d.state = 2;
    }
  } else if (b === 5) {
    // grandes portions de terrain qui disparaissent
    rad = 60 + Math.random() * 90;
    d = spawnDebris(c.x + Math.cos(ang) * rad, c.y + 3, c.z + Math.sin(ang) * rad,
      10 + Math.random() * 10, 0, -2, 0, 6);
    if (d) d.state = 4;
  } else {
    // désintégration totale : tout converge vers le centre
    rad = 20 + Math.random() * 160;
    d = spawnDebris(c.x + Math.cos(ang) * rad, c.y + Math.random() * 50, c.z + Math.sin(ang) * rad,
      1 + Math.random() * 4, 0, 6 + Math.random() * 8, 0, 6);
    if (d) d.state = 2;
  }
}

function updateDebris(dt) {
  var c = attractionCenter();
  var pullBase = 26;
  for (var i = 0; i < debris.length; i++) {
    var d = debris[i];
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) { killPieceTrail(d); d.mesh.visible = false; d.state = 0; continue; } // v22 : la traînée meurt avec le débris
    var m = d.mesh.position;
    var dx = c.x - m.x, dz = c.z - m.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    var k = 1 - d.life / d.maxLife; // 0 -> 1 au fil de la vie

    if (d.state === 3) {
      // soulèvement : monte en basculant, puis bascule vers l'aspiration
      d.vel.y += (k < 0.45 ? 6 : -4) * dt;
      d.vel.x += dx / dist * pullBase * 0.35 * k * dt;
      d.vel.z += dz / dist * pullBase * 0.35 * k * dt;
    } else if (d.state === 4) {
      // disparition : rétrécit sur place en s'enfonçant légèrement
      var s = d.size * Math.max(0.001, 1 - k * 1.15);
      d.mesh.scale.set(s, s * 0.7, s);
      d.vel.y -= 3 * dt;
    } else {
      // états 1 et 2 (v10) : les débris ont du POIDS — d'abord balistiques
      // (gravité : ils retombent en arc), puis l'aspiration prend
      // progressivement le dessus (rampe smoothstep sur la vie du débris).
      var wRamp = k * k * (3 - 2 * k); // 0 → 1 : le poids d'abord, l'aspiration ensuite
      var pull = pullBase * wRamp * (d.state === 2 ? (0.8 + k * 2.2) : (0.25 + k * 0.9));
      var nx = dx / dist, nz = dz / dist;
      d.vel.x += (nx * pull + (-nz) * pull * 0.5) * dt;
      d.vel.z += (nz * pull + (nx) * pull * 0.5) * dt;
      d.vel.y += (((c.y + 12 - m.y) * 0.12) * wRamp - 24 * (1 - wRamp)) * dt;
    }
    m.x += d.vel.x * dt; m.y += d.vel.y * dt; m.z += d.vel.z * dt;
    d.mesh.rotation.x += d.spin.x * dt;
    d.mesh.rotation.y += d.spin.y * dt;
    d.mesh.rotation.z += d.spin.z * dt;
    // v22 : les débris en aspiration forte laissent un sillage lumineux
    // (le vertige : on voit l'air qui les emporte vers le centre).
    if (!lowQ && d.state === 2 && d.life > 0.5) {
      try { ensureDebrisTrail(d); updatePieceTrail(d, dt); } catch (e) { /* ignore */ }
    }
    // près du centre : rétrécit et disparaît (aspiré)
    if (dist < 14 && d.state !== 4) {
      var f = Math.max(0.001, dist / 14);
      d.mesh.scale.set(d.size * f, d.size * f, d.size * f);
      if (dist < MIN_RADIUS + 1) { killPieceTrail(d); d.life = 0; d.mesh.visible = false; d.state = 0; } // v22 : traînée retirée
    }
  }
  // "joueurs" proxys : spirale vers le centre en tournoyant, puis aspirés
  for (var j = playerProxys.length - 1; j >= 0; j--) {
    var pr = playerProxys[j];
    pr.life -= dt;
    pr.ang += dt * pr.spin;
    pr.rad = Math.max(0, pr.rad - dt * (10 + (60 - pr.rad) * 0.35));
    pr.y += ((c.y + 14) - pr.y) * dt * 0.8;
    pr.group.position.set(c.x + Math.cos(pr.ang) * pr.rad, pr.y, c.z + Math.sin(pr.ang) * pr.rad);
    pr.group.rotation.y += dt * pr.spin * 1.6;
    pr.group.rotation.z = Math.sin(pr.ang * 2) * 0.5; // tournoie, désarticulé
    // v21 : les proxys aspirés laissent un sillage lumineux (la trajectoire
    // spirale devient visible).
    try {
      ensurePieceTrail(pr);
      if (pr.trail) updatePieceTrail(pr, dt);
    } catch (e) { /* jamais bloquant */ }
    if (pr.rad < MIN_RADIUS + 2 || pr.life <= 0) {
      try { killPieceTrail(pr); } catch (e2) { /* ignore */ } // v21 : la traînée meurt avec le proxy
      debrisGroup.remove(pr.group);
      pr.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      playerProxys.splice(j, 1);
    }
  }
}

// ---------------------------------------------------------------- cycle de vie
/* ---------------------------------------------------------------------------
 * v11 — ASPIRATION DES CONSTRUCTIONS (playersucked / allgone).
 * Les pièces construites par le joueur (view.builds : UNIQUEMENT les
 * constructions, jamais le décor naturel qui vit dans view.objects) se
 * DÉTACHENT : soulèvement avec léger tremblement, puis SPIRALE vers le
 * Point Zéro en rétrécissant, et disparition dedans.
 * - On n'anime que le MESH (position/rotation/échelle) : la vue ne réécrit
 *   jamais la position des builds par frame, donc pas de conflit ; les
 *   données monde (world.builds) ne sont JAMAIS modifiées.
 * - Les plus proches partent en premier (vague spectaculaire), plafond de
 *   150 pièces pour la perf.
 * -------------------------------------------------------------------------
 * v12 — FIX DU BUG D'ANIMATION (diagnostic confirmé) : la vue RÉÉCRIT en
 * fait chaque frame, AVANT le rendu, pour chaque mesh de view.builds :
 *   m.visible = !b.dead && dist < distLimit
 *   m.scale.y = <animation de construction>
 * L'animation v11 tournait dans update() (APRÈS le rendu) et était donc
 * écrasée avant chaque rendu : invisible à l'écran. Correction :
 *  - collectBuildSuction() RETIRE chaque pièce de view.builds (Map.delete)
 *    et marque sa donnée monde dead=true (sim.js ignore b.dead pour les
 *    collisions, et la vue ne recrée pas de mesh pour une pièce morte) ;
 *  - updateBuildSuction() tourne dans preUpdate() (AVANT la simulation et
 *    le resync de la vue) : contrôle total du mesh (position/rotation/
 *    scale/visible), plus aucun écrasement ;
 *  - dispose() (arrêt anticipé) RESTAURE tout : meshes remis dans
 *    view.builds, dead=false, transforms d'origine, visible=true ;
 *  - exitSuction() (flux normal vers 'blackhole') : les pièces aspirées
 *    RESTENT aspirées (registre buildSucked) ; enterSuction() restaure
 *    tout pour qu'un redémarrage reparte d'un état propre.
 * ------------------------------------------------------------------------- */

// Constitue (ou complète) la liste des pièces à aspirer pour la phase en cours.
// v13 : guards + try/catch partout, balayage depuis les DONNÉES MONDE
// (world.builds, source de vérité), repli PROXY si le mesh est introuvable,
// visible forcé à la prise de contrôle, re-balayage périodique (les
// constructions posées PENDANT la phase sont aussi aspirées).
function collectBuildSuction(force) {
  try {
    var now = (root.AZEvent && root.AZEvent.tTotal) || 0;
    if (!force && now - buildSuckLastCollect < BUILD_SUCK_RECOLLECT) return;
    buildSuckLastCollect = now;
    var vw = null, w = null;
    try { vw = api.view(); } catch (e0) { vw = null; }
    try { w = world(); } catch (e1) { w = null; }
    if (!w || !w.builds || !w.builds.length) return;
    var c = attractionCenter();
    var arr = [];
    for (var bi = 0; bi < w.builds.length; bi++) {
      var bb = w.builds[bi];
      if (!bb || bb.dead) continue;
      if (bb.owner === 'waiting-island') continue; // plates-formes d'attente : décor, pas des constructions joueur
      if (buildSuckIds[bb.id] || buildSuckDoneIds[bb.id]) continue; // déjà suivie/aspirée
      var mesh = null;
      try { mesh = (vw && vw.builds && vw.builds.get) ? vw.builds.get(bb.id) : null; }
      catch (e2) { mesh = null; }
      var mx = bb.x, my = bb.y, mz = bb.z;
      if (mesh && mesh.position) { mx = mesh.position.x; my = mesh.position.y; mz = mesh.position.z; }
      var dx = mx - c.x, dz = mz - c.z;
      arr.push({ data: bb, mesh: mesh, d: Math.sqrt(dx * dx + dz * dz) });
    }
    arr.sort(function (a, b) { return a.d - b.d; }); // les proches d'abord
    var room = BUILD_SUCK_MAX - buildSuck.length - buildSucked.length;
    var n = Math.min(arr.length, room < 0 ? 0 : room);
    for (var i = 0; i < n; i++) {
      var e = arr[i], m = e.mesh, dataRef = e.data;
      var proxy = false;
      if (m) {
        // v12 : la pièce SORT de la vue (la vue ne la gère plus du tout).
        try { vw.builds.delete(dataRef.id); } catch (e3) { /* ignore */ }
      } else {
        // v13 — REPLI : aucun mesh en vue — on anime un proxy VISIBLE à la
        // place (la construction DOIT visiblement partir vers le Point Zéro).
        try {
          m = new T.Mesh(getProxyGeo(), getProxyMat());
          m.position.set(dataRef.x, dataRef.y + 1, dataRef.z);
          m.rotation.y = dataRef.yaw || 0;
          if (group) group.add(m);
          proxy = true;
        } catch (e4) { m = null; }
      }
      // La donnée MEURT dans tous les cas (plus de collisions sim.js, et la
      // vue ne recrée jamais de mesh pour b.dead) — même sans mesh animable.
      try { dataRef.dead = true; } catch (e5) { /* ignore */ }
      if (!m) continue; // sans mesh ni proxy : au moins marquée morte
      // v13 : on PREND le contrôle visuel — visible forcé (la vue a pu
      // élaguer le mesh au-delà de distLimit : il restait invisible sinon).
      try { m.visible = true; } catch (e6) { /* ignore */ }
      buildSuck.push({
        mesh: m, id: dataRef.id, dataRef: dataRef, proxy: proxy,
        ox: m.position.x, oy: m.position.y, oz: m.position.z,
        ry: m.rotation.y,
        sx: m.scale.x, sy: m.scale.y, sz: m.scale.z,
        delay: Math.min(2.2, e.d / 260), // vague : les lointaines partent après
        t: 0,
        spin: (Math.random() - 0.5) * 3,
        done: false
      });
      buildSuckIds[dataRef.id] = true;
    }
  } catch (e) { /* le balayage ne doit jamais casser la frame */ }
}

// v12 : appelée depuis preUpdate() (AVANT la simulation et le resync de
// la vue). Les meshes ne sont plus dans view.builds : contrôle total
// (position/rotation/scale/visible), plus aucun écrasement par la vue.
// v13 : try/catch par pièce + re-balayage périodique.
// v21 — COURANTS D'ASPIRATION : les rubans spiraux tournent autour du
// centre en scintillant ; k = intensité (0..1, par phase). Zéro allocation
// par frame (temps pré-alloués).
var _stW = null, _stM = null;
function updateStreamers(dt, t, k) {
  if (!_stW) { _stW = new T.Vector3(); _stM = new T.Matrix4(); }
  var c = attractionCenter();
  var visible = k > 0.01;
  for (var i = 0; i < streamers.length; i++) {
    var s = streamers[i];
    if (!visible) { s.mesh.visible = false; continue; }
    // Angle propre (éventail régulier) + rotation temporelle accélérée par k.
    var ang = s.seed * Math.PI * 2 + t * (0.5 + 1.6 * k);
    // Le rayon oscille doucement (respiration du tourbillon) ; la longueur
    // suit l'intensité.
    var rad = 175 * (0.72 + 0.28 * Math.sin(t * 1.7 + s.seed * 9.0));
    _stW.set(
      c.x + Math.cos(ang) * rad,
      c.y + 60 + Math.sin(t * 2.3 + s.seed * 12.0) * 40,
      c.z + Math.sin(ang) * rad
    );
    s.mesh.position.copy(_stW);
    // rotation.y = pi - ang (normale de la texture, cf. updateDebris).
    s.mesh.rotation.set(0, Math.PI - ang, 0);
    s.mesh.scale.set(230 * (0.35 + 0.65 * k), 22, 1);
    // La tête du ruban brille plus (le centre aspire).
    // v22 : plus lumineux — le tourbillon se voit de loin.
    s.mat.opacity = k * (0.22 + 0.12 * Math.sin(t * 6 + s.seed * 20.0));
    s.mat.color.setHSL(0.585 - 0.05 * k, 0.9, 0.62 + 0.08 * Math.sin(t * 5 + s.seed * 14.0));
    s.mesh.visible = true;
  }
}

// v22 — GEYSER D'ÉNERGIE : la colonne du tourbillon crache vers le ciel
// (le vertige : l'énergie du centre fuse en gerbes verticales). Densité
// réduite sur mobile, toolkit partagé défensif, jamais bloquant.
function fireGeyser22() {
  try {
    var fxg = (root.AZEvent && root.AZEvent.fx) || null;
    if (!fxg || !fxg.sparkJet || !api || !api.center) return;
    var cc = api.center;
    fxg.sparkJet({ x: cc.x, y: cc.y + 10, z: cc.z },
      { count: lowQ ? 10 : 24, dir: { x: 0, y: 1, z: 0 }, spread: 0.25,
        speed: 260, color: 0xcfe8ff, size: 6, life: 1.1, gravity: 60 });
  } catch (e) { /* jamais bloquant */ }
}
function updateBuildSuction(dt) {
  var state = root.AZEvent.state;
  try {
    if (buildSuckPhase !== state) {
      buildSuckPhase = state;
      collectBuildSuction(true);
      // v21 : FRONT D'ASPIRATION — un anneau balaie l'île quand la vague de
      // détachement des constructions démarre (cause : le changement de
      // phase, effet : la vague visible qui part du centre).
      try {
        var cwf = (api && api.center) || { x: 0, y: 30, z: 0 };
        fireBeatRing(cwf.x, cwf.y + 4, cwf.z, 260, 0x9fd4ff);
      } catch (e) { /* ignore */ }
    }
    else collectBuildSuction(false); // v13 : attrape les constructions tardives
    if (!buildSuck.length) return;
    var c = attractionCenter();
    for (var i = 0; i < buildSuck.length; i++) {
      var s = buildSuck[i];
      if (s.done) continue;
      try { stepBuildSuckPiece(s, c, dt); }
      catch (e) {
        // v13 : une pièce récalcitrante ne bloque JAMAIS les autres —
        // elle est marquée aspirée (sa donnée monde est déjà morte).
        try {
          s.done = true;
          buildSuckDoneIds[s.id] = true;
          delete buildSuckIds[s.id];
          if (s.mesh) {
            if (s.proxy && s.mesh.parent) s.mesh.parent.remove(s.mesh);
            else s.mesh.visible = false;
          }
        } catch (e2) { /* ignore */ }
      }
    }
  } catch (e) { /* l'aspiration des constructions ne casse jamais la frame */ }
}

// v13 : animation d'UNE pièce (détachement -> spirale -> disparition).
// v15 : rendu spectaculaire — traînée lumineuse, étirement dans le sens de
// l'aspiration, accélération VISIBLE vers le centre, engloutissement
// (flash + implosion locale) à la disparition. Mécanismes intacts.
function stepBuildSuckPiece(s, c, dt) {
  if (s.delay > 0) { s.delay -= dt; return; }
  s.t += dt;
  var m = s.mesh;
  if (!m) { s.done = true; return; }
  var k = s.t / BUILD_SUCK_DUR;
  if (k >= 1) {
    // DISPARUE DANS le Point Zéro.
    s.done = true;
    // v15 : ENGLOUTISSEMENT spectaculaire — flash + implosion locale.
    try { fireGobble(m.position.x, m.position.y, m.position.z); } catch (e) { /* ignore */ }
    killPieceTrail(s); // v15 : la traînée meurt avec la pièce
    buildSuckDoneIds[s.id] = true;
    delete buildSuckIds[s.id];
    if (s.proxy) {
      if (m.parent) m.parent.remove(m); // v13 : le proxy disparaît avec la pièce
    } else {
      m.position.set(c.x, c.y, c.z);
      m.scale.set(0.001, 0.001, 0.001);
      m.visible = false;
    }
    return;
  }
  m.visible = true; // v13 : reste visible pendant TOUTE l'animation
  if (k < 0.25) {
    // PHASE 1 — la pièce SE DÉTACHE : se soulève en tremblant légèrement.
    var k1 = k / 0.25;
    m.position.set(
      s.ox + (Math.random() - 0.5) * 1.2 * k1,
      s.oy + k1 * k1 * 14,
      s.oz + (Math.random() - 0.5) * 1.2 * k1
    );
    m.rotation.y = s.ry + k1 * 0.4;
    m.scale.set(s.sx, s.sy, s.sz);
  } else {
    // PHASE 2 — SPIRALE vers le Point Zéro, en rétrécissant.
    ensurePieceTrail(s); // v15 : le sillage lumineux naît avec la spirale
    var k2 = (k - 0.25) / 0.75;
    // v15 : accélération VISIBLE — ease-in : la pièce est aspirée de plus
    // en plus VITE à l'approche du centre (au lieu de ralentir).
    var e2 = Math.pow(k2, 2.4);
    var dx0 = s.ox - c.x, dz0 = s.oz - c.z;
    var r0 = Math.sqrt(dx0 * dx0 + dz0 * dz0) || 1;
    var ang = Math.atan2(dz0, dx0) + e2 * 4.5; // ~3/4 de tour en spirale
    var rr = Math.max(0.001, 1 - e2);
    var sy = s.oy + 14;
    m.position.set(
      c.x + Math.cos(ang) * r0 * rr,
      sy + (c.y - sy) * e2 + Math.sin(e2 * 12) * 3 * (1 - e2),
      c.z + Math.sin(ang) * r0 * rr
    );
    m.rotation.y = s.ry + e2 * 4.5 + s.spin * s.t;
    var sc = Math.max(0.001, 1 - e2 * 0.999);
    // v15 : ÉTIREMENT — la pièce s'allonge dans le sens de l'aspiration
    // (spaghettification) pendant que le sillage lumineux la suit.
    var spag = 1 + e2 * 1.1;
    m.scale.set(s.sx * sc * spag, s.sy * sc / (1 + e2 * 0.4), s.sz * sc * spag);
    updatePieceTrail(s, dt); // v15 : sillage lumineux (opacité = vitesse)
  }
}

// Restauration.
// - dispose() (arrêt anticipé) : RESTAURE TOUT — meshes remis dans
//   view.builds, dead=false, transforms d'origine, visible=true.
// - exitSuction() (flux normal vers 'blackhole', clearOnly=true) : les
//   pièces aspirées RESTENT aspirées (registre buildSucked conservé) ;
//   un redémarrage d'event ultérieur les restaurera via le full-restore
//   de enterSuction().
function restoreBuildSuction(clearOnly) {
  var vw = api && api.view && api.view();
  var canPutBack = !!(vw && vw.builds);
  function putBack(s) {
    var m = s.mesh;
    killPieceTrail(s); // v15 : la traînée ne survit pas à la restauration
    if (s.proxy) {
      // v13 : le proxy n'a jamais appartenu à la vue — on le retire, c'est tout.
      if (m && m.parent) m.parent.remove(m);
    } else {
      if (m) {
        m.position.set(s.ox, s.oy, s.oz);
        m.rotation.y = s.ry;
        m.scale.set(s.sx, s.sy, s.sz);
        m.visible = true;
      }
      if (canPutBack && m) vw.builds.set(s.id, m); // la vue reprend la pièce
    }
    if (s.dataRef) s.dataRef.dead = false;        // collisions sim.js restaurées
  }
  if (!clearOnly) {
    for (var i = 0; i < buildSuck.length; i++) putBack(buildSuck[i]);
    for (var j = 0; j < buildSucked.length; j++) putBack(buildSucked[j]);
    buildSucked = [];
  }
  buildSuck = [];
  buildSuckIds = {};
  buildSuckDoneIds = {};
  buildSuckPhase = '';
  buildSuckLastCollect = -10; // v13 : réarme le balayage
}

function enterSuction() {
  active = true;
  beatIdx = -1; destructT0 = -1; spawnAcc = 0;
  contractT = 0;
  prevSt = ''; // v22 : détection d'entrée en playersucked
  geyserT = 0; // v22 : minuteur des geysers
  restoreBuildSuction(); // v12 : réarme l'aspiration des constructions (restaure aussi un flux normal précédent)
  build();
  var c = attractionCenter(); // v13 : garde anti api nul
  if (api && typeof api.emit === 'function') { // v13 : garde anti api nul
    try { api.emit('suction:start', { center: { x: c.x, y: c.y, z: c.z } }); } catch (e) { /* ignore */ }
  }
}

function exitSuction() {
  disposeVisuals();
  // v12 : les pièces aspirées RESTENT aspirées — on force la fin de leur
  // animation et on les range dans buildSucked (dead=true, hors
  // view.builds, invisibles). Un redémarrage d'event les restaurera via
  // restoreBuildSuction() dans enterSuction() (état propre).
  var c = api.center || { x: 0, y: 30, z: 0 };
  for (var i = 0; i < buildSuck.length; i++) {
    var s = buildSuck[i], m = s.mesh;
    s.done = true;
    killPieceTrail(s); // v15 : la traînée meurt avec la pièce
    if (m) {
      if (s.proxy) { if (m.parent) m.parent.remove(m); } // v13 : proxy retiré
      else {
        m.position.set(c.x, c.y, c.z);
        m.scale.set(0.001, 0.001, 0.001);
        m.visible = false;
      }
    }
    buildSucked.push(s);
    delete buildSuckIds[s.id];
  }
  buildSuck = [];
  buildSuckDoneIds = {};
  buildSuckPhase = '';
  buildSuckLastCollect = -10; // v13 : réarme le balayage
  active = false;
  root.AZEvent.suctionActive = false; // CONTRAT : plus aucune aspiration
  api.emit('suction:end', {});
}

var islandBuildings = null, islandBodies = null, islandRoofs = null, islandTrails = null, islandEntries = [], islandResources = [], islandHidden = new Map();
var islandDummy, islandColor, islandTotal = 0, islandGone = 0, islandFinished = false;
var islandTrailDirection, islandTrailNormal, islandTrailUp, islandTrailMatrix, islandTrailPosition;
function buildIslandSuction() {
  var w = api.world(), v = api.view();
  if (islandBuildings || !w || !v || !v.houseLOD) return;
  var houses = w.objects.filter(function (o) { return o.type === 'house' && !o.dead; });
  if (!houses.length) return;
  var bodyGeo = new T.BoxGeometry(1, 1, 1), roofGeo = new T.ConeGeometry(0.71, 1, 4);
  var bodyMat = root.AZCityFacade ? root.AZCityFacade.material() : v.houseLOD.material.clone(), roofMat = new T.MeshStandardMaterial({ color: 0x54787b, roughness: 0.85, metalness: 0.08 });
  islandResources = [bodyGeo, roofGeo, bodyMat, roofMat];
  islandBuildings = new T.Group(); islandBuildings.name = 'azevent-island-buildings'; api.scene().add(islandBuildings);
  islandBodies = new T.InstancedMesh(bodyGeo, bodyMat, houses.length);
  islandRoofs = new T.InstancedMesh(roofGeo, roofMat, houses.length);
  islandBodies.frustumCulled = islandRoofs.frustumCulled = false;
  islandBodies.instanceMatrix.setUsage(T.DynamicDrawUsage); islandRoofs.instanceMatrix.setUsage(T.DynamicDrawUsage);
  islandBuildings.add(islandBodies, islandRoofs); islandDummy = new T.Object3D(); islandColor = new T.Color();
  if (!lowQ) {
    var trailGeometry = new T.PlaneGeometry(1, 1), trailMaterial = new T.MeshBasicMaterial({ color: 0xa3daff, map: getTrailTex(), transparent: true, opacity: 0.32, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false });
    islandResources.push(trailGeometry, trailMaterial); islandTrails = new T.InstancedMesh(trailGeometry, trailMaterial, houses.length);
    islandTrails.instanceMatrix.setUsage(T.DynamicDrawUsage); islandTrails.frustumCulled = false; islandBuildings.add(islandTrails);
    islandTrailDirection = new T.Vector3(); islandTrailNormal = new T.Vector3(); islandTrailUp = new T.Vector3(); islandTrailMatrix = new T.Matrix4(); islandTrailPosition = new T.Vector3();
  }
  islandTotal = houses.length; islandGone = 0; islandFinished = false;
  islandEntries = houses.map(function (o, i) {
    var radius = Math.hypot(o.x, o.z), tint = v.houseLODColors[o.region] || v.houseLODColors[0];
    islandBodies.setColorAt(i, tint); islandRoofs.setColorAt(i, islandColor.setHex(i % 3 ? 0x466e76 : 0xa47653));
    return { x: o.x, y: o.y + o.h / 2, z: o.z, width: o.w * 2, height: o.h, depth: o.d * 2, yaw: o.yaw || 0,
      radius: radius, angle: Math.atan2(o.z, o.x), delay: Math.min(3.1, radius / 240) + (i % 5) * 0.08, duration: 4.1 + (i % 4) * 0.17,
      previous: new T.Vector3(o.x, o.y + o.h / 2, o.z), swallowed: false };
  });
  root.AZEvent.emit('buildings:lift', { count: islandTotal });
}
function updateIslandSuction() {
  var E = root.AZEvent, state = E.state;
  if (state !== 'destruction' && state !== 'playersucked' && state !== 'allgone') return;
  buildIslandSuction(); if (!islandBuildings) return;
  var elapsed = E.tTotal - E.TIMELINE.destruction[0], c = E.zeroPointPos || api.center;
  islandGone = 0;
  for (var i = 0; i < islandEntries.length; i++) {
    var b = islandEntries[i], p = Math.max(0, Math.min(1, (elapsed - b.delay) / b.duration)), lift = Math.min(1, p / 0.27);
    var pull = Math.max(0, (p - 0.18) / 0.82), fall = Math.pow(pull, 2.1), radius = b.radius * (1 - fall);
    var angle = b.angle + Math.pow(pull, 1.6) * 3.7, size = 1 - Math.pow(Math.max(0, (p - 0.66) / 0.34), 1.6);
    var tremble = p > 0 && p < 0.2 ? Math.sin(elapsed * 42 + i) * 0.6 : 0;
    var x = c.x + Math.cos(angle) * radius + tremble, z = c.z + Math.sin(angle) * radius;
    var y = b.y + (c.y - b.y) * fall + Math.sin(p * Math.PI) * (65 + b.radius * 0.13);
    islandDummy.position.set(x, y, z); islandDummy.rotation.set(Math.sin(i * 1.7) * lift * pull * 1.3, b.yaw + pull * 3.5, Math.cos(i) * lift * pull * 1.2);
    var stretch = 1 + Math.pow(pull, 3) * 0.6;
    islandDummy.scale.set(b.width * size / Math.sqrt(stretch), b.height * size * stretch, b.depth * size / Math.sqrt(stretch)); islandDummy.updateMatrix(); islandBodies.setMatrixAt(i, islandDummy.matrix);
    islandDummy.translateY((b.height * 0.5 * stretch + b.width * 0.1) * size);
    islandDummy.rotateY(Math.PI / 4); islandDummy.scale.set(b.width * size, b.width * 0.23 * size, b.depth * size); islandDummy.updateMatrix(); islandRoofs.setMatrixAt(i, islandDummy.matrix);
    if (islandTrails) {
      islandTrailPosition.set(x, y, z); islandTrailDirection.subVectors(islandTrailPosition, b.previous);
      var length = Math.min(110, islandTrailDirection.length() * 22), camera = api.camera();
      if (islandTrailDirection.lengthSq() > 0.00001 && camera) {
        islandTrailDirection.normalize(); islandTrailNormal.subVectors(camera.position, islandTrailPosition).normalize();
        islandTrailUp.crossVectors(islandTrailNormal, islandTrailDirection).normalize(); islandTrailNormal.crossVectors(islandTrailDirection, islandTrailUp).normalize();
        islandTrailMatrix.makeBasis(islandTrailDirection, islandTrailUp, islandTrailNormal); islandDummy.quaternion.setFromRotationMatrix(islandTrailMatrix);
        islandDummy.position.copy(islandTrailPosition).addScaledVector(islandTrailDirection, -length * 0.48);
        islandDummy.scale.set(p > 0.2 && p < 1 ? length : 0, Math.min(b.width * 0.2, 5) * size, 1);
      } else islandDummy.scale.set(0, 0, 0);
      islandDummy.updateMatrix(); islandTrails.setMatrixAt(i, islandDummy.matrix); b.previous.copy(islandTrailPosition);
    }
    if (p >= 1) { islandGone++; if (!b.swallowed) { b.swallowed = true; if (i % 13 === 0) fireGobble(c.x, c.y, c.z); } }
  }
  islandBodies.instanceMatrix.needsUpdate = islandRoofs.instanceMatrix.needsUpdate = true;
  if (islandTrails) islandTrails.instanceMatrix.needsUpdate = true;
  if (islandGone === islandTotal && !islandFinished) { islandFinished = true; E.emit('buildings:sucked', { count: islandTotal }); }
  E.islandSuctionSnapshot = { total: islandTotal, swallowed: islandGone, remaining: islandTotal - islandGone, playerStage: state !== 'destruction' };
}
function hideIslandObject(o) {
  if (!o) return;
  if (!islandHidden.has(o)) islandHidden.set(o, o.visible);
  o.visible = false;
}
function applyIslandSuction() {
  if (!api || !root.AZEvent.active || root.AZEvent.tTotal < root.AZEvent.TIMELINE.destruction[0]) return;
  var v = api.view(); if (!v) return;
  hideIslandObject(v.houseLOD);
  v.objects.forEach(function (m) { if (m.userData.type === 'house') hideIslandObject(m); });
  if (root.AZEvent.tTotal >= root.AZEvent.TIMELINE.allgone[0]) {
    hideIslandObject(v.worldRoot); hideIslandObject(v.farActors);
    var env = v.environment; if (env) { hideIslandObject(env.water); var art = env.worldV2;
      if (art) ['flora', 'palms', 'coast', 'landmarks', 'ridges'].forEach(function (key) { hideIslandObject(art[key]); }); }
  }
}
function restoreIslandSuction() {
  islandHidden.forEach(function (visible, o) { o.visible = visible; }); islandHidden.clear();
  if (islandBuildings && islandBuildings.parent) islandBuildings.parent.remove(islandBuildings);
  islandResources.forEach(function (r) { r.dispose(); }); islandResources = []; islandEntries = [];
  islandBuildings = islandBodies = islandRoofs = islandTrails = islandDummy = islandColor = null;
  islandTrailDirection = islandTrailNormal = islandTrailUp = islandTrailMatrix = islandTrailPosition = null;
  islandTotal = islandGone = 0; islandFinished = false;
  root.AZEvent.applyBuildingSuction = null; root.AZEvent.islandSuctionSnapshot = null;
}
function init(a) {
  api = a;
  root.AZEvent.applyBuildingSuction = applyIslandSuction;
  T = a.T;
  lowQ = !!(a && (a.quality === 'low' || a.isMobile)); // v15 : mobile -> allégé
  var timeline = root.AZEvent.TIMELINE;
  CONTRACT_SPAN = timeline.contraction[1] - timeline.contraction[0];
  BEAT_ENDS = [1.3, 2.6, 3.9, 5.2, 6.5, 7.8, 9.0].map(function (time) { return time * (timeline.destruction[1] - timeline.destruction[0]) / 9; });
  active = false;
  beatIdx = -1;
  // Branchés UNE SEULE FOIS : le bus ne purge pas ses écouteurs au stop(),
  // un re-branchement à chaque init() les dupliquerait au redémarrage
  // (double enterSuction / double 'suction:start').
  if (!busBound) {
    busBound = true;
    // Le séquenceur émet 'phase:<nom>' automatiquement à chaque transition.
    api.on('phase:contraction', function () {
      if (root.AZEvent.active && !active) enterSuction();
    });
    api.on('phase:blackhole', function () {
      if (active) exitSuction();
    });
    // v21 — BATTLE BUS (event-arena.js) : il apparaît puis est aspiré — la
    // cause est claire (le bus, le tourbillon), l'effet doit l'être aussi :
    // anneau d'apparition à sa venue, implosion d'absorption à sa disparition.
    api.on('bus:appear', function () {
      if (!active || !root.AZEvent.active) return;
      var c = attractionCenter();
      try {
        // v22 : le bus TANGUE dans le tourbillon — triplet d'anneaux
        // décalés (la cause : le tourbillon, l'effet : le tangage visible).
        fireBeatRing(c.x, c.y + 4, c.z, 200, 0xaed6ff);
        fireBeatRing(c.x, c.y + 7, c.z, 150, 0xd6ecff);
        fireBeatRing(c.x, c.y + 10, c.z, 110, 0xffffff);
        var fx = (root.AZEvent && root.AZEvent.fx) || null;
        if (fx && fx.sparkJet) fx.sparkJet({ x: c.x, y: c.y + 8, z: c.z },
          { count: 30, dir: { x: 0, y: 1, z: 0 }, spread: 0.9,
            speed: 90, color: 0xd6ecff, size: 6, life: 1.0, gravity: 20 });
        if (fx && fx.halo) fx.halo({ x: c.x, y: c.y + 6, z: c.z },
          { anticip: 0.1, dur: 0.5, radius: 170, color: 0xbfe0ff, y: 2 });
      } catch (e) { /* jamais bloquant */ }
    });
    api.on('bus:sucked', function () {
      if (!active || !root.AZEvent.active) return;
      var c = attractionCenter();
      try {
        fireGobble(c.x, c.y + 12, c.z);
        // v22 : le bus est HAPPÉ — DOUBLE implosion décalée (le tourbillon
        // l'avale en deux temps) + spirale d'étincelles.
        fireGobble(c.x + 12, c.y + 18, c.z - 10);
        var fx = (root.AZEvent && root.AZEvent.fx) || null;
        if (fx && fx.implosion) fx.implosion({ x: c.x, y: c.y + 12, z: c.z },
          { count: 40, radius: 60, speed: 120, size: 6, color: 0x9fd4ff });
        if (fx && fx.implosion) fx.implosion({ x: c.x + 12, y: c.y + 18, z: c.z - 10 },
          { count: 26, radius: 40, speed: 140, size: 5, color: 0xd6ecff });
        if (fx && fx.sparkJet) fx.sparkJet({ x: c.x, y: c.y + 12, z: c.z },
          { count: lowQ ? 12 : 30, dir: { x: 0, y: 0.8, z: 0 }, spread: 0.8,
            speed: 120, color: 0xbfe8ff, size: 6, life: 0.8, gravity: 40 });
      } catch (e) { /* jamais bloquant */ }
    });
  }
}

function update(dt, t) {
  if (!root.AZEvent.active) return;

  // Sécurité : si la phase a changé sans passer par le bus (reprise), on suit.
  if (!active && root.AZEvent.state === 'contraction') enterSuction();
  if (active && !isActivePhase()) { exitSuction(); return; }
  if (!active) return;
  // v23 : repli — si la scène manquait à l'entrée en 'contraction', le
  // groupe n'a jamais été construit (build() sortait tôt) : on retente
  // ici au lieu de rester mort pour tout le passage (cf. event-blackhole.js).
  if (!group) { build(); if (!group) return; }

  // CONTRAT : suctionActive = true UNIQUEMENT pendant playersucked/allgone.
  syncSuctionFlag();

  // v22 : le moment où TOUT s'envole — détecté UNE fois à l'entrée de
  // 'playersucked' : GERBE ASCENDANTE MASSIVE + triple anneau (le vertige
  // du décollage général, jamais sec).
  var stNow22 = root.AZEvent.state;
  if (stNow22 === 'playersucked' && prevSt !== 'playersucked') {
    try {
      var lc22 = (api && api.center) || { x: 0, y: 30, z: 0 };
      var fxv = (root.AZEvent && root.AZEvent.fx) || null;
      if (fxv && fxv.sparkJet) fxv.sparkJet({ x: lc22.x, y: lc22.y + 5, z: lc22.z },
        { count: lowQ ? 40 : 90, dir: { x: 0, y: 1, z: 0 }, spread: 0.5,
          speed: 340, color: 0xeaf6ff, size: 7, life: 1.3, gravity: 80 });
      fireBeatRing(lc22.x, lc22.y + 4, lc22.z, 260, 0xbfe4ff);
      fireBeatRing(lc22.x, lc22.y + 8, lc22.z, 180, 0xffffff);
      fireBeatRing(lc22.x, lc22.y + 12, lc22.z, 120, 0x9fd0ff);
    } catch (e) { /* jamais bloquant */ }
  }
  prevSt = stNow22;

  // v21 : les ondes de choc des temps s'animent en CONTINU pendant tous les
  // états actifs (plus seulement 'destruction') — l'île vibre sans arrêt.
  updateBeatRings(dt);

  var state = root.AZEvent.state;

  // --- contraction [281,286] : l'énergie REVIENT au centre, PAS de trou noir ---
  if (state === 'contraction') {
    contractT += dt;
    var k = api.clamp(contractT / CONTRACT_SPAN, 0, 1); // 5 s, durée RELATIVE
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i], u = r.mesh.userData;
      r.mat.opacity = 0.3 + 0.6 * k + 0.1 * Math.sin(t * 7 + i * 1.7);
      u.r -= u.speed * (1.4 + k * 2.4) * dt;
      if (u.r < 12) u.r = u.rMax; // boucle : nouvel anneau lointain
      r.mesh.scale.set(u.r, u.r, 1);
      r.mesh.rotation.z += u.dir * dt * (2.6 + k * 3.2);
    }
    // le centre devient de plus en plus petit, la lumière se concentre
    var gs = 120 - 100 * k;
    glow.scale.set(gs, gs, 1);
    glowMat.opacity = 0.35 + 0.55 * k;
    updateParticles(dt, 80 + 220 * k);
    updateStreamers(dt, t, 0.35 * (0.4 + 0.6 * k)); // v21 : courants d'aspiration (l'énergie revient)
    if (vortexCol) vortexCol.visible = false; // v21 : colonne cachée hors playersucked/allgone
    if (vortexCol2) vortexCol2.visible = false; // v22 : colonne externe cachée aussi
    return;
  }

  // --- collapse/growth [286,294] : le trou noir se forme (event-blackhole.js) ---
  // L'aspiration s'intensifie autour du centre, les anneaux se resserrent.
  if (state === 'collapse' || state === 'growth') {
    for (var j = 0; j < rings.length; j++) {
      var r2 = rings[j], u2 = r2.mesh.userData;
      r2.mat.opacity = Math.max(0, r2.mat.opacity - dt * 0.3);
      u2.r -= u2.speed * 3.2 * dt;
      if (u2.r < 10) u2.r = u2.rMax * 0.6;
      r2.mesh.scale.set(u2.r, u2.r, 1);
      r2.mesh.rotation.z += u2.dir * dt * 4.2;
    }
    glowMat.opacity = Math.max(0, glowMat.opacity - dt * 0.8);
    updateParticles(dt, 260);
    updateDebris(dt);
    updateStreamers(dt, t, state === 'collapse' ? 0.5 : 0.75); // v21 : le tourbillon se resserre
    if (vortexCol) vortexCol.visible = false; // v21 : colonne cachée hors playersucked/allgone
    if (vortexCol2) vortexCol2.visible = false; // v22 : colonne externe cachée aussi
    return;
  }

  // --- destruction [294,303] (v5, 9 s) : les 7 temps, 100 % relatifs ---
  if (state === 'destruction') {
    if (destructT0 < 0) {
      destructT0 = root.AZEvent.TIMELINE.destruction[0]; beatIdx = -1; spawnAcc = 0;
      preBeatArmed = [false, false, false, false, false, false, false]; // v20
    }
    var rel = Math.max(0, t - destructT0); // temps relatif dans la phase (s)
    // v20 — ANNEAU DE PRÉ-TEMPS : 0,25 s AVANT chaque temps, un anneau
    // s'INSPIRE (se resserre, monte en intensité) puis CLAQUE pile au
    // déclenchement — le temps est télégraphié, jamais sec.
    for (var qb = 0; qb < N_BEATS; qb++) {
      if (!preBeatArmed[qb] && rel >= BEAT_ENDS[qb] - 0.25) {
        preBeatArmed[qb] = true;
        try {
          var fx3 = (root.AZEvent && root.AZEvent.fx) || null;
          if (fx3 && fx3.halo) fx3.halo(api.center,
            { anticip: 0.25, dur: 0.3, radius: BEAT_RING_R[qb] * 1.1,
              color: BEAT_RING_COLOR[qb], y: 6 });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    var b = N_BEATS - 1;
    for (var q = 0; q < N_BEATS; q++) { if (rel < BEAT_ENDS[q]) { b = q; break; } }
    if (b !== beatIdx) { beatIdx = b; triggerBeat(b); spawnAcc = 0; }
    // Génération CONTINUE pendant le temps : il reste vivant, enchaîné sans longueur.
    spawnAcc += dt * BEAT_RATE[beatIdx];
    while (spawnAcc >= 1) { spawnAcc -= 1; trickleBeat(beatIdx); }
    for (var w = 0; w < rings.length; w++) rings[w].mat.opacity = Math.max(0, rings[w].mat.opacity - dt * 0.3);
    glowMat.opacity = 0;
    // L'aspiration s'intensifie à chaque temps : la progression reste lisible.
    updateParticles(dt, 170 + beatIdx * 18);
    updateDebris(dt);
    updateStreamers(dt, t, 0.4 + Math.max(0, beatIdx) * 0.06); // v21 : le tourbillon grandit avec les temps
    if (vortexCol) vortexCol.visible = false; // v21 : colonne cachée hors playersucked/allgone
    if (vortexCol2) vortexCol2.visible = false; // v22 : colonne externe cachée aussi
    return;
  }

  // --- playersucked [303,308] : le JOUEUR est aspiré (suctionActive = true) ---
  // Des proxys de joueurs supplémentaires tournoient vers le trou noir ;
  // l'aspiration résiduelle est à son maximum.
  if (state === 'playersucked') {
    if (playerProxys.length < 8 && Math.random() < dt * 2.5) {
      var c2 = api.center;
      var ang = Math.random() * Math.PI * 2;
      var rad = 45 + Math.random() * 45;
      spawnPlayerProxy(c2.x + Math.cos(ang) * rad, c2.y + 8 + Math.random() * 20, c2.z + Math.sin(ang) * rad);
    }
    for (var w2 = 0; w2 < rings.length; w2++) rings[w2].mat.opacity = Math.max(0, rings[w2].mat.opacity - dt * 0.5);
    updateParticles(dt, 300);
    updateDebris(dt);
    updateGobble(dt); // v15 : engloutissements (flash + implosion locale)
    updateStreamers(dt, t, 1); // v21 : le tourbillon à son paroxysme
    if (vortexCol) { // v21 : COLONNE DU TOURBILLON — axe lumineux et tournant
      vortexCol.visible = true;
      vortexCol.rotation.y += dt * 1.8;
      vortexColMat.opacity = 0.28 + 0.12 * Math.sin(t * 6);
    }
    if (vortexCol2) { // v22 : COLONNE EXTERNE — tourne en SENS INVERSE
      vortexCol2.visible = true;
      vortexCol2.rotation.y -= dt * 1.2;
      vortexColMat2.opacity = 0.18 + 0.08 * Math.sin(t * 4.5);
    }
    // v22 : GEYSERS D'ÉNERGIE — la colonne crache vers le ciel (vertige).
    geyserT += dt;
    if (geyserT > 0.7) { geyserT = 0; fireGeyser22(); }
    // v12 : l'aspiration des constructions tourne dans preUpdate() (AVANT le
    // resync de la vue), plus ici (update = APRÈS le rendu, écrasé avant).
    return;
  }

  // --- allgone [308,312] : TOUT disparaît ---
  // v10 : le BATTLE BUS est géré par event-arena.js (vol 2 s puis aspiration
  // 2 s, 'bus:appear'/'bus:sucked'). Ici : particules + débris résiduels.
  if (state === 'allgone') {
    for (var w3 = 0; w3 < rings.length; w3++) rings[w3].mat.opacity = 0;
    glowMat.opacity = 0;
    updateParticles(dt, 320);
    updateDebris(dt);
    updateGobble(dt); // v15 : engloutissements (flash + implosion locale)
    updateStreamers(dt, t, 1); // v21 : le tourbillon à son paroxysme
    if (vortexCol) { // v21 : COLONNE DU TOURBILLON — axe lumineux et tournant
      vortexCol.visible = true;
      vortexCol.rotation.y += dt * 1.8;
      vortexColMat.opacity = 0.28 + 0.12 * Math.sin(t * 6);
    }
    if (vortexCol2) { // v22 : COLONNE EXTERNE — tourne en SENS INVERSE
      vortexCol2.visible = true;
      vortexCol2.rotation.y -= dt * 1.2;
      vortexColMat2.opacity = 0.18 + 0.08 * Math.sin(t * 4.5);
    }
    // v22 : GEYSERS D'ÉNERGIE — la colonne crache vers le ciel (vertige).
    geyserT += dt;
    if (geyserT > 0.7) { geyserT = 0; fireGeyser22(); }
    // v12 : voir branche 'playersucked' (preUpdate).
    return;
  }
}

// v12 — preUpdate : AVANT la simulation du jeu (donc AVANT le resync des
// builds de view.js qui a lieu dans la boucle du jeu, et AVANT le rendu).
// L'aspiration des constructions y tourne : les meshes ne sont plus dans
// view.builds, on a le contrôle total (position/rotation/scale/visible).
function preUpdate(dt, t) {
  if (!root.AZEvent.active || !active) return;
  var state = root.AZEvent.state;
  updateIslandSuction();
  if (state === 'destruction' || state === 'playersucked' || state === 'allgone') {
    // v13 : jamais de throw vers le séquenceur — en dernier repli, les
    // constructions restantes sont au moins marquées mortes (disparaissent).
    try { updateBuildSuction(dt); }
    catch (e) {
      try {
        var w = world();
        if (w && w.builds) for (var i = 0; i < w.builds.length; i++) {
          var b = w.builds[i];
          if (b && !b.dead && b.owner !== 'waiting-island') b.dead = true;
        }
      } catch (e2) { /* ignore */ }
    }
  }
}

function dispose() {
  restoreIslandSuction();
  disposeVisuals();
  restoreBuildSuction(); // v12 : arrêt anticipé — les constructions retrouvent leur place (view.builds, dead=false)
  active = false;
  beatIdx = -1;
  if (root.AZEvent) root.AZEvent.suctionActive = false;
  api = null;
  T = null;
}

root.AZEvent.register('suction', {
  init: init,
  preUpdate: preUpdate,
  update: update,
  dispose: dispose
});

})(window);
