/* event-arena.js — MODULE "THE END" v5 : BASE DE LANCEMENT.
 * Pass v5 (langage visuel ref vidéo Fortnite Season X, ref3/f3_001-f3_013) :
 *  - firstrocket (JOUR) : plateforme de lancement + 3 HANGARS au sol
 *    (murs gris-bleu, toits bleu clair, porte de hangar), FAISCEAU ORANGE
 *    vertical IMMENSE qui monte de la base vers le ciel (colonne lumineuse
 *    orange bien visible), COULÉES DE LAVE orange incandescentes qui
 *    serpentent sur la colline derrière la base (rubans lumineux posés sur
 *    le terrain, pulsation incandescente).
 *  - sixrockets : la lave reste visible, le faisceau s'estompe au décollage
 *    (fondu piloté par tState, aucun temps absolu).
 *  - convergence → acceleration : la lave reste INCANDESCENTE en bas
 *    (visible la nuit, comme f3_008/f3_013) — pulsation lumineuse.
 *  - impact → destruction : la base (pas de tir + hangars) est DÉTRUITE par
 *    l'onde de choc — s'enfonce et bascule sur quelques secondes relatives
 *    (tState), gerbes de débris/feu/fumée via AZEvent.fx, puis disparaît.
 *  - phase allgone : le BATTLE BUS (prop basse-poly : corps + ballon)
 *    apparaît (pop franc avec overshoot), vole (trajectoire posée + virage
 *    qui penche), puis est ASPIRÉ violemment (ease-in + secousses)
 *    (durées relatives à l'entrée de phase).
 *    Il ne doit rester ABSOLUMENT RIEN après.
 * v10 (groupe C) : le bus de ce module est désormais l'UNIQUE Battle Bus
 * d'allgone (le doublon d'event-suction.js est supprimé) ; séquence
 * rescalée vol 2 s + aspiration 2 s pour tenir dans la phase [308,312].
 * v14 (passe animation) : le FAISCEAU monte en énergie par PALIERS pendant
 * le countdown (sursauts, colonne qui respire, impulsion lumineuse qui
 * remonte le faisceau de plus en plus vite) ; la LAVE monte en énergie
 * PROGRESSIVEMENT et PULSE en synchronisation avec les temps forts
 * (bus 'shockwave' — même courbe que les 7 temps de destruction) ; le SOL
 * SE FISSURE à 'impact' autour du pas de tir, avec une lueur CROISSANTE
 * sur les temps forts. Comptes réduits sur mobile (api.quality/api.isMobile).
 * v15 (passe animation maximale) : le FAISCEAU respire plus fort (double
 * onde + palpitations à haute charge), CRÉPITE (sursauts aléatoires) et
 * lance une DOUBLE impulsion qui le remonte ; la LAVE s'embrase plus
 * violemment aux temps forts et crache des rafales de braises (bus
 * 'shockwave' / 'meteor:hit' conservés) ; les FISSURES se révèlent en
 * séquence avec des BRANCHES secondaires qui claquent, une lueur qui pulse
 * fort et un flash blanc sur les temps forts.
 * v22 (worker FUSÉES — spectacle maximum, ajouts uniquement) : le pas de
 * tir VIT — la COURONNE LUMINEUSE S'EMBRASE au décollage (flare 1 -> 0,
 * pulsation d'échelle) ; l'ÉNERGIE AMBIANTE continue pendant 'firstrocket'
 * (plus dense) + FONTAINE DE BRAISES au pied de la table ; RÉACTION AU
 * DÉCOLLAGE : ANNEAU DE POUSSIÈRE qui s'étend au sol + mur de poussière
 * circulaire (8 bouffées) + secousse grave (canal 'camera:shake' existant —
 * la caméra reste LIBRE). Bornes/timeline et destructions v5-v21 inchangées.
 * Conventions (coordonné avec event-rockets.js) :
 *  - AZEvent.launchPad = Vector3, .y = hauteur de la BASE de la fusée au
 *    repos (dessus de la table de lancement) ; remis à null dans dispose().
 *  - 'launchpad:liftoff' émis au décollage (écouté par event-rockets.js).
 * Pilotage : AZEvent.state / tState / tTotal + bus 'phase:<nom>' — JAMAIS
 * de temps absolus en dur.
 * Discret hors event : rien n'est construit ni visible tant que
 * !AZEvent.active ; dispose() retire tout et libère les ressources.
 * Contrat : root.AZEvent.register('arena', {init, update, dispose}).
 */
(function (root) {
'use strict';

var T = root.THREE;
if (!T || !root.AZEvent) return;

// ---------------------------------------------------------------- constantes
// (positions relatives au monde ; aucun temps absolu ici)
var PAD_X = -180, PAD_Z = 140; // pas de tir (~228 m du centre)
var PAD_TOP_Y = 5;             // dessus de la table = base de la fusée au repos
var PUFF_WINDOW = 6;           // bouffées de fumée après chaque décollage (s)
var DESTROY_DUR = 4.5;         // destruction de la base à 'impact' (s)
var BUS_FLY_DUR = 2.0;         // vol du battle bus après 'phase:allgone'
var BUS_SUCK_DUR = 2.0;        // aspiration du battle bus (durées relatives)
// v10 : 5,5 s + 2,5 s = 8 s ne rentrent PAS dans la phase allgone [308,312]
// (4 s — bornes TIMELINE immuables), et le bus était supprimé à mi-vol par
// le handler 'phase:blackhole'. Rescale proportionnel : vol 2 s puis
// aspiration 2 s = 4 s exactement, la chorégraphie en 2 temps est préservée
// ('bus:appear' au décollage, 'bus:sucked' à l'absorption).

// ---------------------------------------------------------------- état local
var api = null;
var built = false;
var busBound = false;    // écouteurs du bus branchés une seule fois (pas de off())
var group = null;        // racine de tout ce que le module ajoute
var baseGroup = null;    // pas de tir + hangars + passerelle (détruit à 'impact')
var beamGroup = null;    // faisceau orange
var lavaGroup = null;    // coulées de lave
var disposables = [];    // géométries/matériaux/textures à libérer
var beacons = [];        // {mat, phase} balises rouges clignotantes
var alarmOn = false;     // true UNIQUEMENT pendant la phase 'countdown'
var tickPulse = 0;       // v20 : impulsion vive des balises à chaque tick (1 -> 0)
var tickUrgency = 0;     // v20 : urgence du tick (0 -> 1, accélère le clignotement)
var joltT = -1;          // v20 : temps restant de secousse du portique (< 0 = inactif)
var JOLT_DUR = 1.2;      // v20 : durée de la secousse au décollage (s)
var joltWas = false;     // v20 : le portique a été secoué (restaurer sa position)
var beamMats = [];       // [{mat, base}] matériaux du faisceau (fondu)
var lavaMats = [];       // [{mat, base, phase}] matériaux de lave (pulsation)
var lavaGlows = [];      // [{mat, phase, s0}] halos le long des coulées
var glowTex = null;      // texture radiale partagée des halos
var liftoffDone = false; // garde d'idempotence (countdown:alarm + phase:firstrocket)
var puffUntil = -1;      // tTotal : fin des bouffées de fumée de décollage
var puffAcc = 0;
var lavaFlare = 0;       // v13 : 1 juste après une onde de choc, décroît (lave qui s'embrase)
// v14 : passe animation — montées d'énergie, sync temps forts, fissures.
var lowQ = false;        // mobile : moins de fissures
var beatPulse = 0;       // 1 à chaque temps fort (bus 'shockwave'), décroît
var lavaAge = 0;         // montée d'énergie PROGRESSIVE de la lave
var beamPulse = null;    // impulsion lumineuse qui remonte le faisceau
var beamPulse2 = null;   // v15 : seconde impulsion (décalée, plus chaude)
var beamCrackle = 0;     // v15 : sursaut aléatoire (crépitement), décroît
var beamSurge = 0;       // v15 : sursaut franc périodique, décroît
var lavaSources = [];    // v15 : {x,y,z} sources des coulées (rafales de braises)
var beatFlash15 = 0;     // v15 : flash blanc des fissures sur les temps forts
var branchGlows = [];    // v15 : [{mat, phase, d15}] branches des fissures
var branchBaseMats = []; // v15 : [{mat, d15}]
var crackPaths = [];     // v15 : tracés des fissures (pour les branches)
var beamCharge = 0;      // charge du faisceau pendant 'countdown'
var crackGroup = null;   // fissures du sol (révélées à 'impact')
var crackGlows = [];     // [{mat, phase}] lueur des fissures
var crackBaseMats = [];  // [{mat}] fissures sombres
var crackK = 0;          // 0 -> 1 : le sol se fissure
var impactT0 = -1;       // tTotal au déclenchement de la destruction (flash, -1 = pas encore)
var baseGone = false;
var bus = null;          // {group} battle bus
var busState = 0;        // 0 absent, 1 vol, 2 aspiration, 3 parti
// v21 : COURONNE LUMINEUSE du pas de tir — points lumineux qui CHASSENT
// autour de la table pendant le compte à rebours (la base est vivante).
var padLights = [];      // [SpriteMaterial] (parents : baseGroup)
var ambAcc = 0;          // v21 : accumulateur d'énergie ambiante (étincelles)
// v22 — le pas de tir VIT : surbrillance de la couronne au décollage,
// anneau de poussière au sol, fontaine de braises.
var crownFlare = 0;      // surbrillance de la couronne (1 -> 0 après décollage)
var padLightSprites = [];// sprites de la couronne (pulsation d'échelle)
var dustRing = null, dustRingMat = null; // anneau de poussière (réaction au décollage)
var dustRingT = -1;      // chrono de l'anneau de poussière (< 0 = inactif)
var ambAcc2 = 0;         // accumulateur de la fontaine de braises (firstrocket)

// ---------------------------------------------------------------- utilitaires
function track(x) { disposables.push(x); return x; }

// v12 : overshoot franc pour les apparitions et les bascules.
function easeOutBack12(p) {
  p = p < 0 ? 0 : (p > 1 ? 1 : p);
  var c1 = 1.20158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

function groundY(x, z) {
  try {
    if (root.AZSim && typeof root.AZSim.heightAt === 'function') {
      var h = root.AZSim.heightAt(x, z);
      if (isFinite(h)) return h;
    }
  } catch (e) { /* repli */ }
  return 0;
}

function addMesh(geo, mat, x, y, z, parent) {
  var m = new T.Mesh(track(geo), track(mat));
  m.position.set(x, y, z);
  (parent || group).add(m);
  return m;
}

// Texture radiale blanche partagée pour tous les halos lumineux.
function makeGlowTexture() {
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return track(new T.CanvasTexture(c));
}

// Damier noir/blanc (base de la fusée façon Fortnite), dessiné sur canvas.
function makeCheckerTexture(nx) {
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var cell = 8;
  for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
    g.fillStyle = ((x + y) % 2 === 0) ? '#f2f2f2' : '#101014';
    g.fillRect(x * cell, y * cell, cell, cell);
  }
  var tex = track(new T.CanvasTexture(c));
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(nx || 20, 1);
  return tex;
}

// Halo lumineux (sprite additif). parent optionnel (défaut : group).
function addGlow(x, y, z, color, size, opacity, parent) {
  var m = track(new T.SpriteMaterial({
    map: glowTex, color: color, transparent: true, opacity: opacity,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  }));
  var s = new T.Sprite(m);
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  (parent || group).add(s);
  return s;
}

// Balise rouge clignotante (animée dans update()).
function addBeacon(x, y, z, color, size, parent) {
  var s = addGlow(x, y, z, color, size, 1, parent);
  beacons.push({ mat: s.material, phase: Math.random() * 6.283 });
  return s;
}

// Raccourci vers les helpers partagés (garde si event-particles pas prêt).
function fx() { return root.AZEvent.fx || null; }

// ---------------------------------------------------------------- construction
function build() {
  var scene = api && api.scene ? api.scene() : null;
  if (!scene) return;

  group = new T.Group();
  group.name = 'azevent-arena';
  glowTex = makeGlowTexture();
  beacons = [];
  beamMats = [];
  lavaMats = [];
  lavaGlows = [];
  crackGroup = null;   // v14 : reconstruites avec le groupe
  crackGlows = [];
  crackBaseMats = [];
  crackPaths = [];     // v15
  branchGlows = [];    // v15
  branchBaseMats = []; // v15
  lavaSources = [];    // v15
  crackK = 0;

  var py = groundY(PAD_X, PAD_Z);

  // --- Publication du pas de tir (ne dépend pas de la scène) ---
  publishLaunchPad();

  // baseGroup : tout ce qui est DÉTRUIT à 'impact' (coordonnées relatives
  // au centre du pas de tir, pour que la bascule pivote sur la base).
  baseGroup = new T.Group();
  baseGroup.name = 'azevent-base';
  baseGroup.position.set(PAD_X, py, PAD_Z);
  baseGroup.userData.baseY = py; // repère pour l'enfoncement à 'impact'
  group.add(baseGroup);

  buildPad();        // dalle + table de lancement + carneau + plots
  buildHangars();    // 3 hangars (murs gris-bleu, toits bleu clair)
  buildGantry();     // petite passerelle de service
  buildRails();      // garde-corps JAUNES autour du tablier
  buildAlarmBeacons(); // gyrophares rouges (clignotent pendant 'countdown')

  buildBeam(py);     // FAISCEAU ORANGE immense vers le ciel
  buildLava();       // COULÉES DE LAVE sur la colline derrière la base
  buildCracks();     // v14 : FISSURES DU SOL (révélées à 'impact')

  scene.add(group);
  built = true;
}

// Publication du pas de tir : convention event-rockets.js —
// launchPad.y = hauteur de la BASE de la fusée au repos (dessus de la table).
// Un Vector3 satisfait les lectures launchPad.pos puis launchPad.
function publishLaunchPad() {
  if (!root.AZEvent.launchPad) {
    var py = groundY(PAD_X, PAD_Z);
    root.AZEvent.launchPad = new T.Vector3(PAD_X, py + PAD_TOP_Y, PAD_Z);
  }
}

// --- Plateforme : dalle, table de lancement, carneau, plots de maintien ---
// Coordonnées RELATIVES au centre du pas de tir (parent = baseGroup).
function buildPad() {
  var concrete = track(new T.MeshBasicMaterial({ color: 0x878d94, fog: true }));
  var metal = track(new T.MeshBasicMaterial({ color: 0x6b7480, fog: true }));
  var dark = track(new T.MeshBasicMaterial({ color: 0x14161a, fog: true }));
  var red = track(new T.MeshBasicMaterial({ color: 0xc62f2f, fog: true }));
  var checker = track(new T.MeshBasicMaterial({ map: makeCheckerTexture(20), fog: true }));
  var P = baseGroup;

  // Tablier (dessus à y=0)
  addMesh(new T.BoxGeometry(30, 2, 30), concrete, 0, -1, 0, P);
  // Table de lancement (dessus = PAD_TOP_Y = 5)
  addMesh(new T.BoxGeometry(16, PAD_TOP_Y, 16), metal, 0, PAD_TOP_Y / 2, 0, P);
  // Collerette DAMIER noir/blanc à la base de la fusée (façon Fortnite).
  var collar = addMesh(new T.CylinderGeometry(5.4, 5.4, 1.4, 24, 1, true), checker,
    0, PAD_TOP_Y - 0.7, 0, P);
  collar.material.side = T.DoubleSide;
  // Ouverture d'échappement + collerette métallique
  var hole = addMesh(new T.CircleGeometry(4.2, 24), dark, 0, PAD_TOP_Y + 0.06, 0, P);
  hole.rotation.x = -Math.PI / 2;
  var rim = addMesh(new T.TorusGeometry(4.2, 0.45, 8, 32), metal, 0, PAD_TOP_Y + 0.1, 0, P);
  rim.rotation.x = Math.PI / 2;
  // Sorties latérales du carneau
  addMesh(new T.BoxGeometry(7, 2.2, 5), dark, -10.5, 1.1, 0, P);
  addMesh(new T.BoxGeometry(7, 2.2, 5), dark, 10.5, 1.1, 0, P);
  // 4 plots de maintien + bras rouges vers la base de la fusée
  var px = [-4.5, 4.5];
  for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
    addMesh(new T.BoxGeometry(1.6, 1.5, 1.6), metal, px[i], PAD_TOP_Y + 0.75, px[j], P);
    var arm = addMesh(new T.BoxGeometry(3.2, 0.6, 0.6), red,
      px[i] * 0.72, PAD_TOP_Y + 1.3, px[j] * 0.72, P);
    arm.rotation.y = Math.atan2(px[j], -px[i]);
  }
  // Marquage au sol : 4 bandes de sécurité autour de la table
  var mark = track(new T.MeshBasicMaterial({ color: 0xd8b13a, fog: true }));
  addMesh(new T.BoxGeometry(6, 0.12, 1), mark, 0, 0.06, -11, P);
  addMesh(new T.BoxGeometry(6, 0.12, 1), mark, 0, 0.06, 11, P);
  addMesh(new T.BoxGeometry(1, 0.12, 6), mark, -11, 0.06, 0, P);
  addMesh(new T.BoxGeometry(1, 0.12, 6), mark, 11, 0.06, 0, P);
  // v21 : COURONNE LUMINEUSE — 10 points lumineux autour de la table, qui
  // CHASSENT pendant le compte à rebours (le lancement approche).
  padLights = [];
  padLightSprites = []; // v22 : pulsation d'échelle au décollage
  for (var pl = 0; pl < 10; pl++) {
    var pa = pl / 10 * Math.PI * 2;
    var pls = addGlow(Math.cos(pa) * 9.5, PAD_TOP_Y + 1.2, Math.sin(pa) * 9.5,
      0x7fd8ff, 4.5, 0, P);
    padLights.push(pls.material);
    padLightSprites.push(pls);
  }
}

// --- 3 HANGARS (ref f3_001/f3_004 : murs gris-bleu, toits bleu clair) ---
function buildHangars() {
  var P = baseGroup;
  // (dx, dz, rotation) relatifs au pas de tir
  buildHangar(P, -44, 20, 0.45);
  buildHangar(P, 42, 32, -0.4);
  buildHangar(P, -8, -50, Math.PI + 0.15);
}

function buildHangar(P, dx, dz, rotY) {
  var wallM = track(new T.MeshBasicMaterial({ color: 0x5f7183, fog: true }));
  var roofM = track(new T.MeshBasicMaterial({ color: 0xa9c9e6, fog: true }));
  var doorM = track(new T.MeshBasicMaterial({ color: 0x23272d, fog: true }));
  var winM = track(new T.MeshBasicMaterial({ color: 0xbfe0f5, fog: true }));
  var W = 24, H = 7, D = 15;

  var g = new T.Group();
  g.position.set(dx, groundY(PAD_X + dx, PAD_Z + dz) - groundY(PAD_X, PAD_Z), dz);
  g.rotation.y = rotY;
  P.add(g);

  addMesh(new T.BoxGeometry(W, H, D), wallM, 0, H / 2, 0, g); // murs
  // Toit à 2 pans (panneaux inclinés bleu clair)
  var ang = 0.45, pw = W * 0.62;
  var rise = Math.sin(ang) * pw / 2, run = Math.cos(ang) * pw / 2;
  var p1 = addMesh(new T.BoxGeometry(pw, 0.4, D + 1.4), roofM, -run / 2, H + rise / 2, 0, g);
  p1.rotation.z = ang;
  var p2 = addMesh(new T.BoxGeometry(pw, 0.4, D + 1.4), roofM, run / 2, H + rise / 2, 0, g);
  p2.rotation.z = -ang;
  addMesh(new T.BoxGeometry(1.4, 0.5, D + 1.4), roofM, 0, H + rise + 0.1, 0, g); // faîtage
  // Porte de hangar + bandeau de fenêtres
  addMesh(new T.BoxGeometry(9, 5.6, 0.6), doorM, 0, 2.8, D / 2 + 0.05, g);
  addMesh(new T.BoxGeometry(W * 0.8, 1, 0.3), winM, 0, 5.6, D / 2 + 0.05, g);
}

// --- Petite passerelle de service (treillis + bras ombilical) ---
function buildGantry() {
  var P = baseGroup;
  var steel = track(new T.MeshBasicMaterial({ color: 0x8b939c, fog: true }));
  var darkM = track(new T.MeshBasicMaterial({ color: 0x2a2e34, fog: true }));
  var white = track(new T.MeshBasicMaterial({ color: 0xdfe3e8, fog: true }));
  var gx = 21, gz = 2, H = 26;
  var lx = [-1.4, 1.4];
  for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++)
    addMesh(new T.BoxGeometry(0.7, H, 0.7), steel, gx + lx[i], H / 2, gz + lx[j], P);
  for (var h = 5; h <= 22; h += 5.5) {
    addMesh(new T.BoxGeometry(3.5, 0.5, 0.5), darkM, gx, h, gz, P);
    addMesh(new T.BoxGeometry(0.5, 0.5, 3.5), darkM, gx, h, gz, P);
  }
  addMesh(new T.BoxGeometry(4, 2.6, 4), white, gx, H + 1.3, gz, P); // cabine
  addMesh(new T.BoxGeometry(11, 1, 1), steel, gx - 6.5, 21, gz, P); // bras ombilical
  addBeacon(gx, H + 3.4, gz, 0xff2222, 5, P);
}

// --- Garde-corps JAUNES autour du tablier ---
function buildRails() {
  var P = baseGroup;
  var yellow = track(new T.MeshBasicMaterial({ color: 0xffc400, fog: true }));
  var e = 15, H = 1.2, step = 3.75;
  for (var side = 0; side < 4; side++) {
    for (var d = -e + 1; d <= e - 1; d += step) {
      var px = 0, pz = 0;
      if (side === 0) { px = d; pz = -e + 0.25; }
      else if (side === 1) { px = d; pz = e - 0.25; }
      else if (side === 2) { px = -e + 0.25; pz = d; }
      else { px = e - 0.25; pz = d; }
      addMesh(new T.BoxGeometry(0.22, H, 0.22), yellow, px, H / 2, pz, P);
    }
  }
  var len = 2 * (e - 0.25);
  var heights = [H, H * 0.55];
  for (var h = 0; h < heights.length; h++) {
    var y = heights[h];
    addMesh(new T.BoxGeometry(len, 0.16, 0.16), yellow, 0, y, -e + 0.25, P);
    addMesh(new T.BoxGeometry(len, 0.16, 0.16), yellow, 0, y, e - 0.25, P);
    addMesh(new T.BoxGeometry(0.16, 0.16, len), yellow, -e + 0.25, y, 0, P);
    addMesh(new T.BoxGeometry(0.16, 0.16, len), yellow, e - 0.25, y, 0, P);
  }
}

// --- 4 gyrophares d'ALARME ROUGES aux coins (clignotent pendant 'countdown') ---
function buildAlarmBeacons() {
  var P = baseGroup;
  var poleM = track(new T.MeshBasicMaterial({ color: 0x2a2e34, fog: true }));
  var domeM = track(new T.MeshBasicMaterial({ color: 0xd41a1a, fog: true }));
  var c = [-13, 13];
  for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
    var ax = c[i], az = c[j];
    addMesh(new T.CylinderGeometry(0.15, 0.2, 3, 8), poleM, ax, 1.5, az, P);
    addMesh(new T.SphereGeometry(0.55, 10, 8), domeM, ax, 3.2, az, P);
    addBeacon(ax, 3.9, az, 0xff2020, 7, P);
  }
}

// --- FAISCEAU ORANGE immense : colonne lumineuse de la base vers le ciel ---
function buildBeam(py) {
  beamGroup = new T.Group();
  beamGroup.name = 'azevent-beam';
  beamGroup.position.set(PAD_X, py, PAD_Z);
  group.add(beamGroup);

  var BH = 650; // le faisceau monte très haut (ref f3_001 : hors cadre)
  var outer = track(new T.MeshBasicMaterial({
    color: 0xff7a1a, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false,
    side: T.DoubleSide
  }));
  var core = track(new T.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false,
    side: T.DoubleSide
  }));
  var o = new T.Mesh(track(new T.CylinderGeometry(7, 9, BH, 16, 1, true)), outer);
  o.position.y = BH / 2;
  beamGroup.add(o);
  var co = new T.Mesh(track(new T.CylinderGeometry(2.8, 3.6, BH, 12, 1, true)), core);
  co.position.y = BH / 2;
  beamGroup.add(co);
  beamMats.push({ mat: outer, base: 0.32 });
  beamMats.push({ mat: core, base: 0.7 });
  // Halo orange à la base du faisceau
  var gl = addGlow(0, 2, 0, 0xff8a2a, 46, 0, beamGroup);
  beamMats.push({ mat: gl.material, base: 0.85 });
  // v14 : impulsion lumineuse qui REMONTE le faisceau (montée d'énergie).
  beamPulse = addGlow(0, 10, 0, 0xffd27a, 34, 0, beamGroup);
  beamPulse2 = addGlow(0, 10, 0, 0xff9a3a, 26, 0, beamGroup); // v15 : 2e impulsion
  beamGroup.visible = false;
}

// --- COULÉES DE LAVE : rubans incandescents sur la colline derrière la base ---
function buildLava() {
  lavaGroup = new T.Group();
  lavaGroup.name = 'azevent-lava';
  group.add(lavaGroup);

  // 3 coulées : sources en hauteur derrière/autour du pas de tir,
  // elles serpentent vers le bas en direction de la base.
  var streams = [
    { sx: -268, sz: 38,  tx: -198, tz: 112, seed: 1.7 },
    { sx: -252, sz: 238, tx: -196, tz: 168, seed: 4.2 },
    { sx: -305, sz: 148, tx: -214, tz: 142, seed: 7.9 }
  ];
  for (var s = 0; s < streams.length; s++) {
    buildLavaStream(streams[s], s);
  }
}

// --- v14 : FISSURES DU SOL — le sol se craquelle autour du pas de tir
// quand l'onde de choc de l'impact le frappe ; la lueur croît avec les
// temps forts (bus 'shockwave'). Pas de décor inventé : c'est le sol
// existant qui se fissure.
function buildCracks() {
  if (crackGroup) return;
  crackGroup = new T.Group();
  crackGroup.name = 'azevent-cracks';
  group.add(crackGroup);
  crackGlows = [];
  crackBaseMats = [];
  var nC = lowQ ? 2 : 4;
  for (var ci = 0; ci < nC; ci++) {
    var a0 = ci * (Math.PI * 2 / nC) + 0.5 + ci * 0.3;
    var N = 10, pts = [];
    for (var i = 0; i < N; i++) {
      var k = i / (N - 1);
      var rr = 20 + k * 58;
      var aa = a0 + Math.sin(k * 9 + ci * 2.4) * 0.22 * (1 - k * 0.4);
      var x = PAD_X + Math.cos(aa) * rr, z = PAD_Z + Math.sin(aa) * rr;
      pts.push(new T.Vector3(x, groundY(x, z) + 0.5, z));
    }
    var dark = track(new T.MeshBasicMaterial({
      color: 0x140b06, transparent: true, opacity: 0, fog: true,
      side: T.DoubleSide
    }));
    var dm = new T.Mesh(track(ribbonGeometry(pts, 4.6, 2.0)), dark);
    dm.frustumCulled = false;
    crackGroup.add(dm);
    crackBaseMats.push({ mat: dark, d15: ci * 0.12 }); // v15 : révélation en séquence
    var glowM = track(new T.MeshBasicMaterial({
      color: 0xff7a1a, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: true,
      side: T.DoubleSide
    }));
    var gm = new T.Mesh(track(ribbonGeometry(pts, 2.2, 1.0)), glowM);
    gm.position.y = 0.25;
    gm.frustumCulled = false;
    crackGroup.add(gm);
    crackGlows.push({ mat: glowM, phase: ci * 1.7, d15: ci * 0.12 }); // v15
    crackPaths.push(pts); // v15 : tracé pour les branches
  }
  buildCrackBranches(); // v15 : branches secondaires
}

// v15 : BRANCHES SECONDAIRES — petites fissures latérales qui partent du
// milieu de chaque fissure principale et CLAQUENT quand le sol est bien
// fissuré (crackK > 0.45), avec overshoot. Même langage visuel que les
// fissures (base sombre + lueur incandescente).
function buildCrackBranches() {
  branchGlows = [];
  branchBaseMats = [];
  for (var ci = 0; ci < crackPaths.length; ci++) {
    var path = crackPaths[ci];
    var mid = path[Math.floor(path.length / 2)];
    var nxt = path[Math.min(path.length - 1, Math.floor(path.length / 2) + 1)];
    // direction perpendiculaire à la fissure principale
    var dx = nxt.x - mid.x, dz = nxt.z - mid.z;
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    var px = -dz / len, pz = dx / len;
    if (ci % 2) { px = -px; pz = -pz; }
    var bpts = [];
    for (var i = 0; i <= 4; i++) {
      var k = i / 4;
      var bx = mid.x + px * k * 34 + Math.sin(k * 6 + ci) * 5 * k;
      var bz = mid.z + pz * k * 34 + Math.cos(k * 5 + ci * 2) * 5 * k;
      bpts.push(new T.Vector3(bx, groundY(bx, bz) + 0.5, bz));
    }
    var dark = track(new T.MeshBasicMaterial({
      color: 0x140b06, transparent: true, opacity: 0, fog: true,
      side: T.DoubleSide
    }));
    var dm = new T.Mesh(track(ribbonGeometry(bpts, 3.0, 1.2)), dark);
    dm.frustumCulled = false;
    crackGroup.add(dm);
    branchBaseMats.push({ mat: dark, d15: ci * 0.1 });
    var glowM = track(new T.MeshBasicMaterial({
      color: 0xff9a2a, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: true,
      side: T.DoubleSide
    }));
    var gm = new T.Mesh(track(ribbonGeometry(bpts, 1.4, 0.6)), glowM);
    gm.position.y = 0.25;
    gm.frustumCulled = false;
    crackGroup.add(gm);
    branchGlows.push({ mat: glowM, phase: ci * 2.3, d15: ci * 0.1 });
  }
}

// v15 : RAFALE DE BRAISES — aux temps forts (bus 'shockwave'/'meteor:hit'),
// les coulées de lave crachent des braises via AZEvent.fx (niveaux de
// qualité gérés par event-particles).
function lavaGust() {
  var F = fx();
  if (!F || !lavaSources.length || typeof F.embers !== 'function') return;
  try {
    for (var i = 0; i < lavaSources.length; i++) {
      if (Math.random() < 0.7)
        F.embers(lavaSources[i], { count: 26, spread: 30, size: 7, life: 2.6, color: 0xffa63d });
    }
  } catch (e) { /* helpers indisponibles : pas de crash */ }
}

// Ruban de lave : chemin sinueux échantillonné sur le terrain.
function buildLavaStream(st, idx) {
  var N = 16;
  var pts = [];
  for (var i = 0; i < N; i++) {
    var k = i / (N - 1);
    var x = st.sx + (st.tx - st.sx) * k
      + Math.sin(k * 7 + st.seed) * 14 * (1 - k * 0.5);
    var z = st.sz + (st.tz - st.sz) * k
      + Math.cos(k * 5.2 + st.seed * 2) * 12 * (1 - k * 0.5);
    pts.push(new T.Vector3(x, groundY(x, z) + 0.45, z));
  }
  var geo = track(ribbonGeometry(pts, 5.5, 3));
  var mat = track(new T.MeshBasicMaterial({
    color: 0xff6a1a, transparent: true, opacity: 0.9,
    blending: T.AdditiveBlending, depthWrite: false, fog: true,
    side: T.DoubleSide
  }));
  var mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = false;
  lavaGroup.add(mesh);
  lavaMats.push({ mat: mat, base: 0.9, phase: idx * 2.1 });

  // Halos incandescents le long de la coulée (visibles la nuit).
  for (var g = 2; g < N - 1; g += 4) {
    var p = pts[g];
    var gl = addGlow(p.x, p.y + 1.5, p.z, 0xff7a1a, 13, 0.55, lavaGroup);
    lavaGlows.push({ sprite: gl, mat: gl.material, phase: idx * 1.3 + g * 0.7, s0: 13 });
  }
  // Source : mare de lave incandescente en haut de la coulée.
  var src = pts[0];
  var pool = addGlow(src.x, src.y + 1, src.z, 0xff8a2a, 26, 0.7, lavaGroup);
  lavaGlows.push({ sprite: pool, mat: pool.material, phase: idx * 3.1, s0: 26 });
  lavaSources.push({ x: src.x, y: src.y + 1, z: src.z }); // v15 : rafales de braises
}

// Géométrie de ruban : bande de largeur w0→w1 suivant des points.
function ribbonGeometry(pts, w0, w1) {
  var n = pts.length;
  var posArr = new Float32Array(n * 2 * 3);
  var idx = [];
  for (var i = 0; i < n; i++) {
    var p = pts[i];
    var q = pts[Math.min(n - 1, i + 1)];
    var r = pts[Math.max(0, i - 1)];
    var dx = q.x - r.x, dz = q.z - r.z;
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    var nx = -dz / len, nz = dx / len;
    var w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    var o = i * 6;
    posArr[o]     = p.x + nx * w; posArr[o + 1] = p.y; posArr[o + 2] = p.z + nz * w;
    posArr[o + 3] = p.x - nx * w; posArr[o + 4] = p.y; posArr[o + 5] = p.z - nz * w;
    if (i < n - 1) {
      var a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(posArr, 3));
  geo.setIndex(idx);
  return geo;
}

// ---------------------------------------------------------------- décollage
// Bouffée de fumée blanche volumineuse + feu orange au décollage,
// via les helpers partagés (niveaux de qualité gérés par event-particles).
function spawnLiftoffPuff(big) {
  var F = fx();
  if (!F) return;
  var pad = root.AZEvent.launchPad;
  if (!pad) return;
  var jx = (Math.random() - 0.5) * 14, jz = (Math.random() - 0.5) * 14;
  try {
    if (typeof F.smoke === 'function') {
      F.smoke({ x: pad.x + jx, y: pad.y - 3, z: pad.z + jz }, {
        count: big ? 60 : 22, spread: big ? 26 : 16,
        size: big ? 34 : 26, life: big ? 5 : 3.6,
        color: 0xe4e8ee, rise: 15, alpha: 0.5
      });
    }
    if (big && typeof F.fire === 'function') {
      F.fire({ x: pad.x, y: pad.y - 1, z: pad.z }, {
        count: 46, spread: 12, size: 13, life: 1.1
      });
    }
    if (big && typeof F.sparkle === 'function') {
      F.sparkle({ x: pad.x, y: pad.y + 2, z: pad.z }, { count: 40, color: 0xffc46a });
    }
  } catch (e) { /* helpers indisponibles : pas de crash */ }
}

// Décollage (alarme à zéro ou entrée en 'firstrocket') — idempotent.
function onLiftoff() {
  if (!root.AZEvent.active) return;
  if (liftoffDone) return;
  liftoffDone = true;
  if (!built) build();
  alarmOn = false;
  puffUntil = root.AZEvent.tTotal + PUFF_WINDOW;
  puffAcc = 0;
  spawnLiftoffPuff(true);
  joltT = JOLT_DUR; // v20 : le portique TREMBLE au décollage (1,2 s de jitter)
  // v22 — le pas de tir RÉAGIT au décollage : la couronne S'EMBRASE,
  // un ANNEAU DE POUSSIÈRE s'étend au sol, un mur de poussière circulaire
  // est projeté, secousse grave (caméra toujours LIBRE).
  crownFlare = 1;
  startDustRing();
  var F2 = fx();
  if (F2 && typeof F2.smoke === 'function') {
    try {
      var py2 = groundY(PAD_X, PAD_Z);
      for (var dr = 0; dr < 8; dr++) {
        var da = dr / 8 * Math.PI * 2;
        F2.smoke({ x: PAD_X + Math.cos(da) * 22, y: py2 + 2, z: PAD_Z + Math.sin(da) * 22 },
          { count: 14, spread: 8, size: 30, life: 4.5, color: 0xd8cfc0, rise: 8, alpha: 0.5 });
      }
    } catch (e2) { /* ignore */ }
  }
  try { api.emit('camera:shake', { force: 0.35, duration: 1.2, source: 'pad-liftoff-blast' }); } catch (e3) { /* ignore */ }
  try { api.emit('launchpad:liftoff', {}); } catch (e) { /* ignore */ }
}

// v22 — ANNEAU DE POUSSIÈRE : le souffle du décollage balaye le sol —
// anneau gris qui S'ÉTEND (2,5 s). Créé paresseusement (zéro allocation
// par frame), vieilli dans update(), nettoyé dans dispose().
function startDustRing() {
  if (!group) return;
  if (!dustRing) {
    dustRingMat = track(new T.MeshBasicMaterial({
      color: 0xd8cfc0, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    }));
    dustRing = new T.Mesh(track(new T.TorusGeometry(1, 0.04, 8, 64)), dustRingMat);
    dustRing.rotation.x = -Math.PI / 2; // anneau à plat sur le sol
    dustRing.frustumCulled = false;
    dustRing.visible = false;
    group.add(dustRing);
  }
  var py = groundY(PAD_X, PAD_Z);
  dustRing.position.set(PAD_X, py + 2, PAD_Z);
  dustRing.scale.set(1, 1, 1);
  dustRingMat.opacity = 0.8;
  dustRing.visible = true;
  dustRingT = 0;
}

// sixrockets : le faisceau s'estompe (géré dans update via tState),
// nouvelle salve de fumée au décollage des 6 fusées.
function onSixRockets() {
  if (!root.AZEvent.active || !built) return;
  puffUntil = root.AZEvent.tTotal + PUFF_WINDOW;
  spawnLiftoffPuff(true);
}

// ---------------------------------------------------------------- destruction
// 'impact' : la base est DÉTRUITE par l'ONDE DE CHOC de l'impact — pas avant.
// v16 (cohérence spectacle) : la chorégraphie destructive démarre à
// l'INSTANT DU FLASH (bus 'meteor:hit', émis par event-impact.js), avec un
// repli tState (fraction miroir de event-impact.js). Avant v16, la base
// tombait à l'entrée de phase, ~24 s AVANT le flash : cause après l'effet.
var IMPACT_FLASH_FRACTION = 0.44; // miroir de FLASH_FRACTION (event-impact.js)

// v17 : proximité RÉELLE de la météorite (positions live, event-meteor.js).
// Le repli de destruction ne conclut JAMAIS sur un timer seul : seulement
// sur la distance réelle au Point Zéro.
function meteorNearZero(radiusM) {
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

function beginDestruction() {
  if (impactT0 >= 0) return; // une seule fois
  if (!root.AZEvent.active) return;
  if (!built) build();
  impactT0 = root.AZEvent.tTotal;
  var pad = root.AZEvent.launchPad;
  var F = fx();
  if (F && pad) {
    try {
      if (typeof F.burst === 'function') {
        F.burst({ x: pad.x, y: pad.y + 3, z: pad.z },
          { count: 130, color: 0xffa63d, speed: 70, life: 2.2, size: 8 });
        F.burst({ x: pad.x, y: pad.y + 6, z: pad.z },
          { count: 80, color: 0xffffff, speed: 45, life: 1.6, size: 7 });
      }
      if (typeof F.fire === 'function')
        F.fire({ x: pad.x, y: pad.y, z: pad.z }, { count: 70, spread: 22, size: 14, life: 1.6 });
      if (typeof F.smoke === 'function')
        F.smoke({ x: pad.x, y: pad.y, z: pad.z },
          { count: 90, spread: 30, size: 36, life: 6, color: 0x9aa0a8, rise: 12, alpha: 0.55 });
    } catch (e) { /* ignore */ }
  }
}

// L'entrée en phase prépare seulement : la destruction démarre au flash.
function onImpact() {
  if (!root.AZEvent.active) return;
  if (impactT0 >= 0) return; // destruction déjà déclenchée
  if (!built) build();
  impactT0 = -1;
}

// ---------------------------------------------------------------- battle bus
// Prop simple basse-poly : corps de bus + ballon, reliés par des cordages.
function buildBus() {
  var b = new T.Group();
  b.name = 'azevent-battlebus';

  var bodyMat = track(new T.MeshBasicMaterial({ color: 0x2f6fd6, fog: true }));
  var darkMat = track(new T.MeshBasicMaterial({ color: 0x182c4a, fog: true }));
  var balloonMat = track(new T.MeshBasicMaterial({ color: 0xd64545, fog: true }));
  var ropeMat = track(new T.MeshBasicMaterial({ color: 0x3a3a3a, fog: true }));

  var body = new T.Mesh(track(new T.BoxGeometry(6, 2.4, 3)), bodyMat);
  b.add(body);
  var nose = new T.Mesh(track(new T.BoxGeometry(1.4, 1.8, 2.8)), darkMat);
  nose.position.set(3.4, -0.2, 0);
  b.add(nose);
  var roof = new T.Mesh(track(new T.BoxGeometry(5, 0.5, 2.6)), darkMat);
  roof.position.y = 1.45;
  b.add(roof);

  var balloon = new T.Mesh(track(new T.SphereGeometry(4.2, 14, 10)), balloonMat);
  balloon.position.y = 8.5;
  balloon.scale.y = 1.15;
  b.add(balloon);

  for (var i = 0; i < 4; i++) {
    var rope = new T.Mesh(track(new T.CylinderGeometry(0.08, 0.08, 7.4, 6)), ropeMat);
    var sx = (i < 2) ? -2.2 : 2.2, sz = (i % 2) ? -1.1 : 1.1;
    rope.position.set(sx * 0.7, 4.6, sz * 0.7);
    rope.rotation.z = sx > 0 ? -0.28 : 0.28;
    rope.rotation.x = sz > 0 ? 0.18 : -0.18;
    b.add(rope);
  }

  var c = api.center;
  var a0 = 0.6;
  b.position.set(c.x + Math.cos(a0) * 280, c.y + 110, c.z + Math.sin(a0) * 280);
  b.userData = { a0: a0, t0: root.AZEvent.tTotal, appearT0: root.AZEvent.tTotal };
  b.scale.set(0.001, 0.001, 0.001); // v12 : le bus "claque" à l'apparition
  group.add(b);
  bus = { group: b };
  busState = 1;
  try { api.emit('bus:appear', {}); } catch (e) { /* ignore */ }
}

function updateBus(dt, t) {
  if (!bus || busState === 0 || busState === 3) return;
  var c = api.center;
  var g = bus.group;
  var u = g.userData;
  var holeY = c.y + 25;

  if (busState === 1) {
    // VOL : traverse le ciel vers le centre (durée relative à 'phase:allgone').
    // v12 : pop d'apparition (overshoot) + trajectoire en ease franc + virage
    // qui penche (bank).
    var ak = api.clamp((t - u.appearT0) / 0.6, 0, 1);
    var ae = easeOutBack12(ak);
    g.scale.set(ae, ae, ae);
    var k = api.clamp((t - u.t0) / BUS_FLY_DUR, 0, 1);
    var ke = k * k * (3 - 2 * k); // ease franc : départ et arrivée posés
    var a = u.a0 + ke * 1.6;
    var rad = 280 - 160 * ke;
    g.position.set(
      c.x + Math.cos(a) * rad,
      c.y + 110 - 20 * ke + Math.sin(t * 2) * 1.5,
      c.z + Math.sin(a) * rad
    );
    g.rotation.y = -a;
    g.rotation.x = 0.10 * Math.sin(ke * Math.PI); // pique du nez en virage
    g.rotation.z = Math.sin(t * 1.4) * 0.06;
    if (k >= 1) { busState = 2; u.suckT0 = t; }
  } else if (busState === 2) {
    // ASPIRATION : spirale vers le trou noir, rétrécit (durée relative).
    // v12 : départ retenu puis VIOLENT (ease-in), secousses qui montent.
    var k2 = api.clamp((t - u.suckT0) / BUS_SUCK_DUR, 0, 1);
    var k2e = k2 * k2;
    var ang = u.a0 + 1.6 + k2e * 5.5;
    var r2 = Math.max(2, 120 * (1 - k2e));
    g.position.set(
      c.x + Math.cos(ang) * r2,
      g.position.y + (holeY - g.position.y) * dt * 3,
      c.z + Math.sin(ang) * r2
    );
    g.rotation.y += dt * (2 + 10 * k2e);
    g.rotation.z = Math.sin(t * 28) * 0.12 * k2e; // secousses aspirées
    var s = Math.max(0.001, 1 - k2e);
    g.scale.set(s, s, s);
    if (k2 >= 1 || r2 <= 4) {
      removeBus();
      try { api.emit('bus:sucked', {}); } catch (e) { /* ignore */ }
    }
  }
}

function removeBus() {
  if (bus && bus.group.parent) bus.group.parent.remove(bus.group);
  bus = null;
  busState = 3;
}

// ---------------------------------------------------------------- cycle de vie
function init(a) {
  api = a;
  lowQ = !!(api && (api.quality === 'low' || api.isMobile)); // v14
  busState = 0;
  alarmOn = false;
  liftoffDone = false;
  puffUntil = -1;
  puffAcc = 0;
  padLights = [];  // v21 : reconstruits dans buildPad()
  ambAcc = 0;      // v21 : réarmé à chaque démarrage
  padLightSprites = []; // v22 : reconstruits dans buildPad()
  crownFlare = 0; dustRingT = -1; ambAcc2 = 0; // v22 : réarmés à chaque démarrage
  lavaFlare = 0;         // v13 : réarmé à chaque démarrage (restart OK)
  beatPulse = 0;         // v14 : réarmé à chaque démarrage
  beamCrackle = 0; beamSurge = 0; beatFlash15 = 0; // v15 : réarmés à chaque démarrage
  lavaAge = 0;           // v14 : réarmé à chaque démarrage
  crackK = 0;            // v14 : réarmé à chaque démarrage
  beamCharge = 0;        // v14 : réarmé à chaque démarrage
  impactT0 = -1;
  baseGone = false;
  // Le pas de tir est publié dès l'init (ne dépend pas de la scène) pour
  // que event-rockets.js le lise même si la scène n'est pas encore prête.
  publishLaunchPad();
  // Branchés UNE SEULE FOIS (le bus n'a pas de off()).
  if (!busBound) {
    busBound = true;
    api.on('phase:countdown', function () { alarmOn = true; });
    // v20 : les balises CLAQUENT sur chaque tick du compte à rebours —
    // l'urgence (0 -> 1) accélère aussi leur clignotement.
    api.on('countdown:tick', function (d) {
      tickPulse = 1;
      if (d && typeof d.urgency === 'number') tickUrgency = d.urgency;
    });
    api.on('countdown:alarm', onLiftoff);
    api.on('phase:firstrocket', onLiftoff);
    api.on('phase:sixrockets', onSixRockets);
    api.on('phase:impact', onImpact);
    // v13 : la lave S'EMBRASE à chaque onde de choc et à l'impact
    // (flare bref, décroissant).
    api.on('shockwave', function (d) {
      if (!root.AZEvent.active) return;
      var f = (d && typeof d.force === 'number') ? d.force : 0.5;
      lavaFlare = Math.max(lavaFlare, Math.min(1.5, f * 1.4));
      beatPulse = 1; // v14 : temps fort — lave et fissures pulsent en sync
      beatFlash15 = 1; // v15 : les fissures flashent en blanc
      lavaGust(); // v15 : rafale de braises aux temps forts
    });
    api.on('meteor:hit', function () {
      if (!root.AZEvent.active) return;
      lavaFlare = 1.5;
      beatPulse = 1; // v14 : temps fort maximal
      beatFlash15 = 1; // v15
      lavaGust(); // v15
      // v16 : le flash frappe — la base est détruite PAR l'onde de choc.
      if (root.AZEvent.state === 'impact') beginDestruction();
    });
    api.on('phase:allgone', function () {
      if (root.AZEvent.active && built && busState === 0) buildBus();
    });
    api.on('phase:blackhole', function () {
      // sécurité : plus aucun prop ne doit subsister
      removeBus();
      puffUntil = -1;
      if (lavaGroup) lavaGroup.visible = false;
    });
  }
}

function update(dt, t) {
  // Discret hors event : rien du module ne doit être visible si !active.
  if (!root.AZEvent.active) { if (group) group.visible = false; return; }
  if (!built) build();
  if (!built) return;
  group.visible = true;

  var st = root.AZEvent.state;
  var ts = root.AZEvent.tState;

  // Balises rouges : clignotement UNIQUEMENT pendant 'countdown'.
  // v20 : sur chaque tick, les balises CLAQUENT (impulsion vive qui
  // retombe), et le clignotement s'accélère avec l'urgence — la fin du
  // compte à rebours se LIT sur les balises elles-mêmes.
  tickPulse = Math.max(0, tickPulse - dt * (2.2 + 4 * tickUrgency));
  for (var bi = 0; bi < beacons.length; bi++) {
    var bc = beacons[bi];
    if (alarmOn) {
      var blink = (Math.sin(t * (3.5 + 5 * tickUrgency) + bc.phase) > 0.2) ? 1 : 0.12;
      bc.mat.opacity = Math.min(1, blink + tickPulse * (0.6 + 0.6 * tickUrgency));
    }
    else bc.mat.opacity = 0.12;
  }

  // v21 : COURONNE LUMINEUSE — les points CHASSENT pendant le compte à
  // rebours (le lancement approche), restent vifs à 'firstrocket',
  // s'éteignent après (la base sera détruite à 'impact' de toute façon).
  // v22 : au décollage, la couronne S'EMBRASE (flare 1 -> 0, pulsation
  // d'échelle) — le pas de tir vit. Zéro allocation : 10 matériaux +
  // 10 sprites, modulés en place.
  crownFlare = Math.max(0, crownFlare - dt * 0.8);
  var chaseOn = (st === 'countdown' || st === 'firstrocket');
  for (var pli = 0; pli < padLights.length; pli++) {
    var chase = chaseOn ? Math.pow(0.5 + 0.5 * Math.sin(t * 9 - pli * 0.63), 3) : 0;
    var base = chaseOn ? (0.12 + 0.88 * chase) : 0;
    padLights[pli].opacity = Math.min(1, base + crownFlare * 0.95);
    if (padLightSprites[pli]) {
      var psc = 4.5 * (1 + crownFlare * 1.6 + 0.25 * chase);
      padLightSprites[pli].scale.set(psc, psc, 1);
    }
  }

  // v21 : ÉNERGIE AMBIANTE — pendant le countdown, le faisceau crache de
  // petites étincelles qui montent (l'air vibre avant le lancement).
  // Compte minimal (2 par 1,6 s), niveaux de qualité gérés par
  // event-particles.
  // v22 : l'énergie continue pendant 'firstrocket' (plus dense) + FONTAINE
  // DE BRAISES au pied de la table — le pas de tir est VIVANT.
  if ((st === 'countdown' || st === 'firstrocket') && beamGroup && beamGroup.visible) {
    ambAcc += dt;
    var ambPeriod = (st === 'firstrocket') ? 1.0 : 1.6;
    while (ambAcc > ambPeriod) {
      ambAcc -= ambPeriod;
      var F = fx();
      if (F && typeof F.trail === 'function') {
        try {
          F.trail({
            x: PAD_X + (Math.random() - 0.5) * 16,
            y: groundY(PAD_X, PAD_Z) + 8,
            z: PAD_Z + (Math.random() - 0.5) * 16
          }, { count: 2, color: 0xffb35c, size: 5, life: 1.6, gravity: -30, spread: 6 });
        } catch (e) { /* helpers indisponibles : pas de crash */ }
      }
    }
    if (st === 'firstrocket') {
      ambAcc2 += dt;
      if (ambAcc2 > 2.5) {
        ambAcc2 = 0;
        var F3 = fx();
        if (F3 && typeof F3.embers === 'function') {
          try {
            F3.embers({ x: PAD_X, y: groundY(PAD_X, PAD_Z) + PAD_TOP_Y + 1, z: PAD_Z },
              { count: 20, spread: 12, size: 6, life: 1.8, color: 0xffb35c });
          } catch (e3) { /* helpers indisponibles : pas de crash */ }
        }
      }
    } else {
      ambAcc2 = 0;
    }
  } else {
    ambAcc = 0;
    ambAcc2 = 0;
  }

  // v20 — SECOUSSE DU PORTIQUE au décollage : le portique TREMBLE pendant
  // 1,2 s (jitter décroissant autour de sa base) quand la fusée quitte le
  // pad — la puissance du départ se lit sur la structure.
  if (joltT > 0 && baseGroup && impactT0 < 0) {
    joltT -= dt;
    joltWas = true;
    var jk = Math.max(0, joltT / JOLT_DUR);
    baseGroup.position.x = PAD_X + (Math.random() - 0.5) * 6 * jk;
    baseGroup.position.y = baseGroup.userData.baseY + (Math.random() - 0.5) * 3.5 * jk;
    baseGroup.position.z = PAD_Z + (Math.random() - 0.5) * 6 * jk;
  } else if (joltWas && baseGroup && impactT0 < 0) {
    baseGroup.position.set(PAD_X, baseGroup.userData.baseY, PAD_Z);
    joltWas = false;
  }

  // FAISCEAU : visible DÈS 'countdown' (exigence : le faisceau orange
  // est là dès le début), s'estompe à 'sixrockets' au décollage.
  // v12 : allumage franc (snap ease-out), extinction qui s'accélère.
  // v13 : allumage avec FLAIR (overshoot — le faisceau "claque" en
  // s'allumant), extinction en CRÉPITEMENT (le faisceau meurt en sputtant).
  // v14 : montée d'énergie en PALIERS pendant le countdown — la colonne
  // s'épaissit par sursauts, RESPIRE, et une impulsion lumineuse la
  // remonte de plus en plus vite (le décollage approche).
  var bop = 0;
  beamCharge = 0;
  if (st === 'countdown' || st === 'firstrocket') {
    var bk = api.clamp(ts / 1.2, 0, 1);
    beamCharge = (st === 'firstrocket') ? 1 : api.clamp(ts / 9, 0, 1);
    var surge = Math.pow(0.5 + 0.5 * Math.sin(ts * 2.4), 3);
    bop = easeOutBack12(bk) * (0.45 + 0.55 * beamCharge) * (0.9 + 0.35 * surge * beamCharge);
  } else if (st === 'sixrockets') {
    var ek = Math.pow(Math.max(0, 1 - ts / 5), 1.4);
    if (ek < 0.45) ek *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 43)); // crépite en mourant
    bop = ek;
  }
  if (beamGroup) {
    beamGroup.visible = false;
    if (beamGroup.visible) {
      beamGroup.rotation.y += dt * 0.35; // la colonne tourne lentement
      // v15 : respiration AMPLIFIÉE — double onde (lente + rapide), le
      // faisceau "palpite" quand la charge est haute.
      var bb = 1 + (0.10 + 0.08 * beamCharge) * Math.sin(t * 6.3)
                 + 0.05 * beamCharge * Math.sin(t * 17.7);
      beamGroup.scale.x = bb;
      beamGroup.scale.z = bb;
      // v15 : CRÉPITEMENT — sursauts aléatoires d'énergie (le faisceau
      // crachote), plus fréquents et violents à haute charge.
      beamCrackle = Math.max(0, beamCrackle - dt * 3);
      if (Math.random() < dt * (2 + 9 * beamCharge)) beamCrackle = 0.4 + Math.random() * 0.6;
      // v15 : SURSAUT franc périodique pendant 'firstrocket' (palier d'énergie).
      beamSurge = Math.max(0, beamSurge - dt * 2.2);
      if (st === 'firstrocket' && Math.random() < dt * 0.9) beamSurge = 1;
      var bBoost = 1 + 1.1 * beamCrackle + 0.9 * beamSurge;
      for (var mi = 0; mi < beamMats.length; mi++) {
        var bm = beamMats[mi];
        bm.mat.opacity = Math.min(1.6, bm.base * bop * (0.92 + 0.08 * Math.sin(t * 9 + mi * 2)) * bBoost);
      }
      // v14 : impulsion lumineuse qui REMONTE le faisceau, de plus en
      // plus vite à mesure que la charge monte.
      var period = 2.4 - 1.7 * beamCharge;
      if (beamPulse) {
        var pk = (t % period) / period;
        beamPulse.position.y = 10 + pk * 620;
        var ps = 26 + 16 * beamCharge;
        beamPulse.scale.set(ps, ps, 1);
        beamPulse.material.opacity = 0.85 * bop * Math.sin(Math.PI * pk) * (1 + 0.6 * beamSurge);
      }
      // v15 : SECONDE impulsion — décalée, plus rapide, couleur plus chaude.
      if (beamPulse2) {
        var period2 = period * 0.62;
        var pk2 = ((t + period * 0.37) % period2) / period2;
        beamPulse2.position.y = 10 + pk2 * 620;
        var ps2 = 20 + 12 * beamCharge;
        beamPulse2.scale.set(ps2, ps2, 1);
        beamPulse2.material.opacity = 0.7 * bop * Math.sin(Math.PI * pk2) * Math.min(1, beamCharge * 1.5);
      }
    }
  }

  // LAVE : pulsation incandescente (visible la nuit, ref f3_008/f3_013).
  // v13 : flare d'embrasement après chaque onde de choc (lavaFlare).
  // v14 : montée d'énergie PROGRESSIVE (lavaAge, ~25 s) + pulsations
  // SYNCHRONISÉES avec les temps forts (beatPulse, bus 'shockwave' -
  // la lave s'affole à chaque temps, comme les 7 temps de destruction).
  lavaFlare = Math.max(0, lavaFlare - dt * 1.1);
  beatPulse = Math.max(0, beatPulse - dt * 0.9);
  if (lavaGroup && lavaGroup.visible) {
    lavaAge += dt;
    var lavaCharge = Math.min(1, lavaAge / 25);
    // v15 : embrasement AMPLIFIÉ aux temps forts.
    var flareK = (0.8 + 0.6 * lavaCharge) * (1 + 1.8 * lavaFlare) * (1 + 1.3 * beatPulse);
    var lavaFreq = 5.5 + 11 * beatPulse;
    for (var li = 0; li < lavaMats.length; li++) {
      var lm = lavaMats[li];
      lm.mat.opacity = Math.min(1, lm.base * (0.72 + 0.28 * Math.sin(t * lavaFreq + lm.phase)) * flareK);
    }
    for (var gi = 0; gi < lavaGlows.length; gi++) {
      var lg = lavaGlows[gi];
      var sc = lg.s0 * (1 + 0.22 * Math.sin(t * (6 + 6 * beatPulse) + lg.phase)) *
        (1 + 0.7 * lavaFlare + 1.0 * beatPulse); // v15 : halos qui s'affolent
      lg.sprite.scale.set(sc, sc, 1);
      lg.mat.opacity = Math.min(1, (0.45 + 0.25 * Math.sin(t * lavaFreq + lg.phase)) * flareK);
    }
  }

  // Bouffées de fumée de décollage (fenêtre relative après chaque décollage).
  if (puffUntil >= 0 && t < puffUntil) {
    puffAcc += dt;
    while (puffAcc > 0.28) {
      puffAcc -= 0.28;
      spawnLiftoffPuff(false);
    }
  } else {
    puffAcc = 0;
  }

  // v22 — ANNEAU DE POUSSIÈRE au décollage : le souffle balaye le sol
  // (2,5 s, vieillit seul).
  if (dustRingT >= 0 && dustRing) {
    dustRingT += dt;
    var dk = api.clamp(dustRingT / 2.5, 0, 1);
    var ds = 12 + 250 * easeOutBack12(dk);
    dustRing.scale.set(ds, 1, ds);
    dustRingMat.opacity = 0.8 * (1 - dk);
    if (dk >= 1) { dustRing.visible = false; dustRingT = -1; }
  }

  // DESTRUCTION à l'instant du flash : la base s'enfonce et bascule, puis
  // disparaît (durée relative DESTROY_DUR, calée sur le choc, pas sur l'entrée).
  // v16 : repli — si 'meteor:hit' a été manqué, on démarre à l'instant du
  // flash (fraction RELATIVE de la phase, jamais en dur).
  // v17 : repli VÉRIFIÉ (jamais aveugle) — la destruction ne démarre à 44 %
  // que si la météorite est VRAIMENT imminente (< 400 m du Point Zéro,
  // via AZEvent.meteorPos) ; sinon on attend 'meteor:hit' (le contact réel).
  if (impactT0 < 0 && st === 'impact' && built && baseGroup) {
    var TL16 = root.AZEvent.TIMELINE;
    var dur16 = (TL16 && TL16.impact) ? (TL16.impact[1] - TL16.impact[0]) : 0;
    if (dur16 > 0 && ts >= dur16 * IMPACT_FLASH_FRACTION && meteorNearZero(400)) beginDestruction();
  }
  // v12 : la bascule "donne un coup" (overshoot franc), l'enfoncement accélère.
  if (impactT0 >= 0 && !baseGone && baseGroup) {
    var k = api.clamp((t - impactT0) / DESTROY_DUR, 0, 1);
    // v23 : si la destruction démarre pendant la secousse du portique (jolt),
    // la base est reposée sur ses coordonnées exactes — sinon le x/z du
    // jitter restait figé (la branche de restauration exige impactT0 < 0).
    baseGroup.position.x = PAD_X;
    baseGroup.position.z = PAD_Z;
    joltWas = false;
    baseGroup.position.y = baseGroup.userData.baseY - 16 * k * k;
    baseGroup.rotation.z = 0.16 * easeOutBack12(Math.min(1, k * 1.12));
    baseGroup.rotation.x = -0.08 * easeOutBack12(Math.min(1, k * 1.12));
    if (k >= 1) { baseGroup.visible = false; baseGone = true; }
  }

  // v14 : le sol SE FISSURE à 'impact' - révélation progressive, lueur
  // CROISSANTE synchronisée avec les temps forts (beatPulse).
  // v15 : révélation EN SÉQUENCE (chaque fissure à son tour), branches
  // secondaires qui claquent, lueur qui pulse fort + flash blanc.
  beatFlash15 = Math.max(0, beatFlash15 - dt * 2.4);
  if (impactT0 >= 0 && crackGroup) {
    crackK = Math.min(1, crackK + dt / (DESTROY_DUR * 1.6));
    for (var cb = 0; cb < crackBaseMats.length; cb++) {
      var cbk = api.clamp(crackK * 1.5 - crackBaseMats[cb].d15, 0, 1);
      crackBaseMats[cb].mat.opacity = 0.9 * cbk;
    }
    for (var cg2 = 0; cg2 < crackGlows.length; cg2++) {
      var cg = crackGlows[cg2];
      var rev = api.clamp(crackK * 1.5 - cg.d15, 0, 1);
      cg.mat.opacity = Math.min(1, rev *
        (0.4 + 0.35 * Math.sin(t * (4 + 6 * beatPulse) + cg.phase)) *
        (1 + 2.0 * beatPulse + 1.5 * beatFlash15));
      // v15 : flash blanc sur les temps forts.
      cg.mat.color.setHex(beatFlash15 > 0.25 ? 0xfff3dd : 0xff7a1a);
    }
    // v15 : BRANCHES — claquent quand le sol est bien fissuré (overshoot).
    var brk = api.clamp((crackK - 0.45) / 0.55, 0, 1);
    for (var br = 0; br < branchBaseMats.length; br++) {
      var be = easeOutBack12(Math.min(1, Math.max(0, brk * 1.4 - branchBaseMats[br].d15)));
      branchBaseMats[br].mat.opacity = 0.9 * be;
    }
    for (var brg = 0; brg < branchGlows.length; brg++) {
      var bgr = branchGlows[brg];
      var bre = easeOutBack12(Math.min(1, Math.max(0, brk * 1.4 - bgr.d15)));
      bgr.mat.opacity = Math.min(1, bre *
        (0.45 + 0.35 * Math.sin(t * 7 + bgr.phase)) * (1 + 2.2 * beatPulse));
    }
  }

  // Battle bus : vol puis aspiration.
  updateBus(dt, t);
}

function dispose() {
  removeBus();
  if (group && group.parent) group.parent.remove(group);
  for (var i = 0; i < disposables.length; i++) {
    var d = disposables[i];
    if (d && typeof d.dispose === 'function') { try { d.dispose(); } catch (e) { /* ignore */ } }
  }
  group = null; baseGroup = null; beamGroup = null; lavaGroup = null;
  glowTex = null;
  beacons = []; beamMats = []; lavaMats = []; lavaGlows = [];
  crackGroup = null; crackGlows = []; crackBaseMats = []; crackK = 0; // v14
  crackPaths = []; branchGlows = []; branchBaseMats = []; lavaSources = []; // v15
  beatPulse = 0; lavaAge = 0; beamPulse = null; beamCharge = 0; lowQ = false; // v14
  beamPulse2 = null; beamCrackle = 0; beamSurge = 0; beatFlash15 = 0; // v15
  alarmOn = false;
  liftoffDone = false;
  puffUntil = -1; puffAcc = 0;
  padLights = [];  // v21 : reconstruits dans buildPad()
  ambAcc = 0;      // v21 : réarmé à chaque démarrage
  padLightSprites = []; // v22 : reconstruits dans buildPad()
  crownFlare = 0; dustRingT = -1; ambAcc2 = 0; // v22 : réarmés
  dustRing = null; dustRingMat = null; // v22 : dans disposables (libérés ci-dessus)
  impactT0 = -1; baseGone = false;
  busState = 0;
  disposables = [];
  built = false;
  root.AZEvent.launchPad = null; // ne pas laisser de position périmée
  api = null;
}

root.AZEvent.register('arena', { init: init, update: update, dispose: dispose });

})(window);
