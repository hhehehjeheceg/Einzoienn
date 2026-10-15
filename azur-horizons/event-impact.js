/* event-impact.js — projet "THE END" (AZUR Horizons v1.8, vague v10).
 *
 * IMPACT (réf. frame f3_028) : pendant la phase 'impact', vers la fin de
 * celle-ci (~250-281 dans la timeline, calculé en RELATIF à la phase) :
 * - énorme FLASH BLANC/BLEU AVEUGLANT : plein écran BREF, puis halo ;
 * - point d'impact INCANDESCENT sur l'île ;
 * - RAYONS LUMINEUX qui irradient depuis l'impact (comme f3_028) ;
 * - ciel étoilé en fond (géré par event-sky.js).
 * Le joueur flotte très haut (géré par event-player.js).
 * Après le flash : lueur RÉSIDUELLE qui s'estompe vers 'contraction'.
 *
 * v10 — EXPLOSION GIGANTESQUE À L'ÉCHELLE DE TOUTE L'ÎLE (plusieurs couches) :
 * - flash plein écran au MAXIMUM ;
 * - onde de choc SPHÉRIQUE immense ('shockwave:burst', rayon 2600 m,
 *   7 anneaux, 5 s) via event-shockwave.js ;
 * - COLONNE D'ÉNERGIE verticale géante au point d'impact ;
 * - PLUIE DE PARTICULES + champ d'énergie dans tout le ciel (étoiles et
 *   particules partout, blanc/bleu uniquement — pas de violet) ;
 * - lumière extrêmement intense sur l'île (PointLight 60, portée 9000 m).
 * Au moment du flash, ce module émet :
 * - 'meteor:hit' (propriétaire unique, une fois) — écouté par
 *   event-zeropoint.js (qui émet 'zeropoint:destroyed'), event-sky,
 *   event-camera et event-audio ;
 * - 'impact:playerblast' {pos, power:1.0, source:'meteor-impact'} — le
 *   joueur est projeté plus loin (groupe C : event-player.js) ;
 * - 'camera:shake' {force:1.0, duration:4.0, source:'meteor-impact'} —
 *   la caméra tremble fortement (directeur caméra, groupe E).
 *
 * v12 (passe animation globale) : ANTICIPATION avant le flash (le point
 * incandescent se resserre et s'affole dans les derniers 10 % de la charge),
 * flash à DOUBLE SOUFFLE, explosion des halos en ease-out franc, colonne
 * d'énergie qui JAILLIT avec overshoot, anneaux qui claquent (overshoot +
 * extinction rapide), rayons qui explosent au flash, pic de lumière violent.
 * v14 (passe animation) : ANTICIPATION chauffée — le point d'impact
 * ROUGIT avant le flash (cœur rougeoyant + halos qui virent au rouge) ;
 * flash en PLUSIEURS COUCHES (blanc-bleu aveuglant + halo chaud retardé) ;
 * colonne à double paroi (manteau en contre-rotation) ; ONDE QUI BALAIE
 * L'ÎLE au sol (anneau géant + écho) ; BRAISES RETOMBANTES orange.
 * Comptes réduits sur mobile via api.quality / api.isMobile.
 * Pilotage : 'phase:impact' / 'phase:contraction' + AZEvent.state / tState.
 * Durées relatives aux phases (via AZEvent.TIMELINE) — jamais de temps
 * absolus en dur.
 *
 * Contrat : IIFE 'use strict', THREE global, aucun import, aucun réseau,
 * inactif si !AZEvent.active, dispose() nettoie tout (meshs, DOM, textures,
 * écouteurs).
 */
(function (root) {
'use strict';

if (!root.AZEvent) return; // contrat : ne rien faire si AZEvent absent

var MODULE = 'impact';
var api = null;
var bus = null;
var T = null;              // THREE
var disposed = false;
var busBound = false;

var grp = null;            // groupe des visuels d'impact
var glowTex = null;        // texture radiale blanc-bleu partagée
var rayGeo = null;         // géométrie partagée des rayons
var ringGeo = null;        // géométrie partagée des anneaux
var glows = [];            // sprites incandescents {sp, base, grow, seed}
var rays = [];             // {mesh, mat, dir:Vector3, seed}
var rings = [];            // {mesh, mat, delay, maxR, age}
var blast = null;          // PointLight de l'impact
var impactPos = null;
// v10 : couches supplémentaires de l'explosion à l'échelle de l'île.
var column = null;         // colonne d'énergie verticale géante
var columnMat = null;
var parts = null;          // pluie de particules + champ d'énergie du ciel
var partGeo = null, partMat = null, partData = null;
var N_PARTS = 450;         // < 500
// v14 : anticipation chauffee, flash multi-couches, colonne a double
// paroi, onde qui balaie l'ile, braises retombantes.
var lowQ = false;            // mobile : comptes reduits
var heatTex = null;          // texture radiale chaude (anticipation)
var heatCore = null;         // coeur rougeoyant avant le flash
var heatCoreMat = null;
var heatC = null;            // couleur chaude cible (THREE.Color)
var flashEl2 = null;         // 2e couche du flash (halo chaud retarde)
var flash2Fired = false;
var flash2Age = -1;
var FLASH2_LIFE = 0.55;
var FLASH2_DELAY = 0.22;     // retard relatif apres le flash principal
var FLASH2_FADE = 0.35;
var column2 = null;          // manteau exterieur de la colonne
var column2Mat = null;
var sweep = null, sweepMat = null;     // onde qui balaie l'ile
var sweep2 = null, sweep2Mat = null;   // traine de l'onde (echo)
var SWEEP_R = 3200;          // l'onde depasse l'ile
var SWEEP_DUR = 6;           // duree relative (depuis le flash)
var embers = null, emberGeo = null, emberMat = null, emberData = null;
var N_EMBERS = 180;
var emberGY = 0;
// v15 : second souffle lumineux, éclairs de sol, écho de l'onde.
var bolts = [];            // éclairs de sol qui zèbrent l'île
var sweep3 = null, sweep3Mat = null; // écho de l'onde qui balaie l'île
var rebreathFired = false; // second souffle déjà déclenché
var rebreathAge = -1;      // chrono du second souffle (overlay DOM)
var REBREATH_LIFE = 0.8;
var echoFired = false;     // écho de l'onde déjà émis (bus)
// v21 : TRIPLE FRAPPE D'ÉCLAIRS — 3 éclairs titanesques ciel->sol qui
// claquent en séquence au contact (le climax frappe 3 fois).
var boltSky = [];          // {line, mat, delay, strikeT, maxLife}
// v21 : ONDE DE CHOC CÉLESTE — l'explosion déchire le CIEL : anneau géant
// à 1200 m d'altitude qui balaie les cieux + dôme de flash céleste.
var skyRing = null, skyRingMat = null;
var skyDome = null, skyDomeMat = null;
// v21 : CŒUR SUPERNOVA — sphère de lumière blanche qui AVALE le point
// d'impact au contact (croissance explosive puis dissipation).
var novaCore = null, novaMat = null;
// v21 : SUB-SLAM retardé — 0,35 s après le flash, le grave FRAPPE.
var subSlamFired = false;
// v22 : RÉMANENCE (3e couche de flash, lente), SECOUSSE dosée retardée,
// ÉCHO de grondement, ANNEAUX CÉLESTES (le ciel se déchire en hauteur)
var afterEl = null, afterAge = -1, afterKick = 0;
var AFTER_LIFE = 1.0, AFTER_FADE = 5.0;
var aftershockFired = false, rumbleFired = false;
var skyRings = [];

var impactFired = false;   // séquence démarrée (une seule fois)
var meteorHitSent = false; // 'meteor:hit' déjà émis
var flashFired = false;    // flash plein écran déjà déclenché
var fading = false;        // lueur résiduelle en fondu
var fadeAge = 0;
var FADE_LIFE = 2.5;       // fondu relatif
var fadeOp = 1;            // multiplicateur global pendant le fondu
var impactT = 0;           // v12 : temps écoulé depuis startImpact (relatif)
var flashT = -1;           // v12 : temps écoulé depuis le flash (-1 = pas encore)

// v12 : eases expressifs.
function easeOutBurst12(p) { p = p < 0 ? 0 : (p > 1 ? 1 : p); return 1 - Math.pow(1 - p, 3); }
function easeOutBack12(p) {
  p = p < 0 ? 0 : (p > 1 ? 1 : p);
  var c1 = 1.20158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

// Overlay DOM du flash blanc-bleu (bref, au MAXIMUM en v10).
var flashEl = null;
var flashAge = -1;
var FLASH_LIFE = 0.9;      // v10 : plein écran aveuglant (était 0.6)
var FLASH_FADE = 0.7;      // v16 : retombée PROGRESSIVE allongée (était 0.35 : coupait net)

var RAY_COUNT = 24;   // v10 : 24 faisceaux (était 12)
var UP = null;

// Fraction RELATIVE de la phase 'impact' où le flash se déclenche
// (durée de phase lue dans AZEvent.TIMELINE, jamais en dur).
var FLASH_FRACTION = 0.44;

// ---------- utilitaires DOM ----------
function injectStyle() {
  if (document.getElementById('azevent-impactv5-style')) return;
  var s = document.createElement('style');
  s.id = 'azevent-impactv5-style';
  // Flash blanc-bleu aveuglant : cœur blanc pur, pourtour bleu.
  s.textContent =
    '#azevent-impactv5-flash{position:fixed;inset:0;opacity:0;' +
    'pointer-events:none;z-index:999999;transition:none;' +
    'background:radial-gradient(circle at 50% 48%, #ffffff 0%, #f2f8ff 34%,' +
    ' #cfe4ff 66%, #8fb8ff 100%);}';
  // v14 : 2e couche du flash — halo CHAUD (retarde de FLASH2_DELAY).
  s.textContent +=
    '#azevent-impactv5-flash2{position:fixed;inset:0;opacity:0;' +
    'pointer-events:none;z-index:999998;transition:none;' +
    'background:radial-gradient(circle at 50% 48%, #ffffff 0%, #fff6e6 40%,' +
    ' #ffe3b0 70%, rgba(255,200,120,0.55) 100%);}';
  // v22 : RÉMANENCE — voile bleu-blanc TRÈS lent qui s'estompe sur ~6 s
  // (l'écran "garde" l'impact en mémoire).
  s.textContent +=
    '#azevent-impactv5-after{position:fixed;inset:0;opacity:0;' +
    'pointer-events:none;z-index:999997;transition:none;' +
    'background:radial-gradient(circle at 50% 48%, rgba(255,255,255,0.85) 0%,' +
    ' rgba(220,235,255,0.5) 45%, rgba(160,195,255,0.22) 75%, rgba(140,180,255,0) 100%);}';
  document.head.appendChild(s);
}
function removeStyle() {
  var s = document.getElementById('azevent-impactv5-style');
  if (s && s.parentNode) s.parentNode.removeChild(s);
}
function fireFlash() {
  if (flashFired) return;
  flashFired = true;
  flashT = 0; // v12 : départ du chrono post-flash (montées franches)
  flash2Fired = false; // v14 : la 2e couche du flash repart aussi
  flash2Age = -1;
  injectStyle();
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.id = 'azevent-impactv5-flash';
    document.body.appendChild(flashEl);
  }
  flashEl.style.opacity = '1';
  flashAge = 0;
  // C'est l'instant de l'impact : on prévient les autres modules.
  if (!meteorHitSent) {
    meteorHitSent = true;
    bus.emit('meteor:hit', { pos: impactPos ? impactPos.clone() : null });
  }
  // v10 — explosion à l'échelle de l'île, plusieurs couches :
  // 1. ÉNORME onde de choc sphérique (event-shockwave.js) : coquille +
  //    7 anneaux dans toutes les directions, 5 secondes.
  bus.emit('shockwave:burst', {
    pos: impactPos ? impactPos.clone() : null,
    opts: { radius: 2600, duration: 5.0, rings: 7, color: 0xffffff, flash: true }
  });
  // 2. Le joueur est projeté plus loin (groupe C : event-player.js).
  bus.emit('impact:playerblast', {
    pos: impactPos ? impactPos.clone() : null, power: 1.0, source: 'meteor-impact'
  });
  // 3. La caméra tremble fortement (directeur caméra, groupe E).
  bus.emit('camera:shake', { force: 1.0, duration: 4.0, source: 'meteor-impact' });
  // v22 : RÉMANENCE — 3e couche du flash, lente : l'écran garde l'impact.
  fireAfterglow();
}

// v22 : RÉMANENCE — 3e couche du flash, TRÈS lente : l'écran garde
// l'impact en mémoire (~6 s de retombée douce).
function fireAfterglow() {
  if (afterAge >= 0) return;
  injectStyle();
  if (!afterEl) {
    afterEl = document.createElement('div');
    afterEl.id = 'azevent-impactv5-after';
    document.body.appendChild(afterEl);
  }
  afterEl.style.opacity = '0.4';
  afterAge = 0;
  afterKick = 0;
}

// v14 : 2e COUCHE du flash — halo CHAUD qui part avec un leger retard
// (le flash a plusieurs couches : blanc-bleu aveuglant puis coeur chaud).
function fireFlash2() {
  if (flash2Fired) return;
  flash2Fired = true;
  injectStyle();
  if (!flashEl2) {
    flashEl2 = document.createElement('div');
    flashEl2.id = 'azevent-impactv5-flash2';
    document.body.appendChild(flashEl2);
  }
  flashEl2.style.opacity = '1';
  flash2Age = 0;
}

// ---------- textures ----------
function radialTexture(stops) {
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (var i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], stops[i][1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  var tex = new T.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
function makeTextures() {
  if (glowTex) return;
  glowTex = radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.3, 'rgba(240,248,255,0.9)'],
    [0.6, 'rgba(180,215,255,0.45)'],
    [1, 'rgba(120,170,255,0)']
  ]);
}

// v14 : hauteur du sol sous un point (repli : centre).
function groundYImp(x, z) {
  try {
    if (root.AZSim && typeof root.AZSim.heightAt === 'function') {
      var h = root.AZSim.heightAt(x, z);
      if (isFinite(h)) return h;
    }
  } catch (e) { /* repli */ }
  var c = api ? api.center : null;
  return (c && isFinite(c.y)) ? c.y : 0;
}

// ---------- durée de phase (relative, lue dans TIMELINE) ----------
function impactDuration() {
  var TL = root.AZEvent.TIMELINE;
  if (TL && TL.impact && TL.impact.length === 2) {
    var d = TL.impact[1] - TL.impact[0];
    if (d > 0) return d;
  }
  return 0; // inconnu : le flash ne part pas (TIMELINE toujours fournie par le séquenceur)
}

// v17 : distance² LIVE météorite <-> Point Zéro (Infinity si inexploitable).
// Extraite pour être testable (/tmp/v17-bug-check.js) — aucun timer, que du live.
function liveMeteorDist2(AZ) {
  try {
    var mp = AZ && AZ.meteorPos, zp = AZ && AZ.zeroPointPos;
    if (mp && zp && isFinite(mp.x) && isFinite(mp.y) && isFinite(mp.z) &&
        isFinite(zp.x) && isFinite(zp.y) && isFinite(zp.z)) {
      var dx = mp.x - zp.x, dy = mp.y - zp.y, dz = mp.z - zp.z;
      return dx * dx + dy * dy + dz * dz;
    }
  } catch (e) { /* positions indisponibles */ }
  return Infinity;
}

// v18 — CONTACT SUR LES RAYONS VISUELS RÉELS (miroirs des modules).
function clamp01i(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
// Miroir d'event-meteor.js zeroY() : hauteur du centre du Point Zéro.
function zeroLevelYI() {
  var c = api && api.center;
  return (c && isFinite(c.y) ? c.y : 0) + 25;
}
// Rayon visuel live de la MÉTÉORITE : 30 (ROCK_RADIUS) × échelle live du
// groupe (1 + altBoostK×1.6 + proxK×0.9 — miroir d'event-meteor.js).
// Priorité à la valeur publiée par event-meteor.js (AZ.meteorVisR).
function meteorVisualRadiusI(AZ) {
  var pub = AZ && AZ.meteorVisR;
  if (isFinite(pub) && pub > 0) return pub;
  var mp = AZ && AZ.meteorPos;
  if (!mp || !isFinite(mp.y)) return -1;
  var zy = zeroLevelYI();
  var altK = clamp01i((mp.y - zy) / 3500);
  var pk = clamp01i(1 - (mp.y - zy) / 900);
  return 30 * (1 + altK * 1.6 + pk * 0.9);
}
// Rayon visuel live du POINT ZÉRO : 15 (cœur) × échelle live de l'orbe.
// Priorité à la valeur publiée par event-zeropoint.js (AZ.zeroPointVisR).
function zeroPointVisualRadiusI(AZ) {
  var pub = AZ && AZ.zeroPointVisR;
  if (isFinite(pub) && pub > 0) return pub;
  return 15 * 1.5; // repli : orbe révélée (×1.5)
}
// v18 — Rayon de contact visuel : R_météorite + R_PointZéro (-1 si inconnu).
function visualContactRadiusI(AZ) {
  var rm = meteorVisualRadiusI(AZ), rz = zeroPointVisualRadiusI(AZ);
  if (!(rm > 0) || !(rz > 0)) return -1;
  return rm + rz;
}

// v23 — FRAÎCHEUR DE LA POSITION MÉTÉORITE : pendant la phase 'impact'
// la météorite PLONGE — sa position publiée (AZ.meteorPos, écrite chaque
// frame par event-meteor.js, secousse incluse) change donc à chaque frame.
// Si elle est FIGÉE alors que le temps de l'event avance, le module
// météorite est en panne : tirer sur cette valeur périmée, c'est risquer
// le « Point Zéro explose sans que la météorite le touche ». Le flash
// exige une position qui bouge vraiment.
var _prevMP = null;  // {x,y,z} : dernière position vue qui bougeait
var _prevMPt = -1;   // tState correspondant
function meteorPosIsFresh(AZ) {
  try {
    var mp = AZ && AZ.meteorPos;
    if (!mp || !isFinite(mp.x) || !isFinite(mp.y) || !isFinite(mp.z)) return false;
    var tS = AZ.tState;
    if (!_prevMP) {
      _prevMP = { x: mp.x, y: mp.y, z: mp.z };
      _prevMPt = tS;
      return true; // premier échantillon : aucune preuve de péremption
    }
    var fdx = mp.x - _prevMP.x, fdy = mp.y - _prevMP.y, fdz = mp.z - _prevMP.z;
    if (fdx * fdx + fdy * fdy + fdz * fdz > 1e-6) { // > 1 mm : ça bouge vraiment
      _prevMP.x = mp.x; _prevMP.y = mp.y; _prevMP.z = mp.z;
      _prevMPt = tS;
      return true;
    }
    // Position figée : tolérable uniquement si le temps de l'event n'a
    // quasiment pas avancé depuis (micro-saccade sur la même frame).
    return isFinite(tS) && isFinite(_prevMPt) && (tS - _prevMPt) < 0.5;
  } catch (e) { return false; }
}
function resetMeteorFreshness() { _prevMP = null; _prevMPt = -1; }

// v18 : DÉCISION DE TIR DU FLASH — INCONTESTABLE.
// v20 : CHEVAUCHEMENT VISUEL RÉEL — le flash (donc 'meteor:hit', la
// destruction du Point Zéro et toute l'explosion) ne part QUE quand la
// météorite a VRAIMENT PÉNÉTRÉ le Point Zéro : distance live <
// (R_météorite + R_PointZéro) × 0,5. Le rocher (~57 m de rayon) est alors
// enfoncé d'une quarantaine de mètres dans l'orbe (son bas ~17-20 m SOUS
// le centre de l'orbe) : le toucher se VOIT, même sur un écran de
// téléphone, même avec la secousse.
// CAUSE RACINE du bug v16→v19 : l'ancien seuil (dist < R_m + R_z) partait
// à la TANGENCE EXACTE des deux corps (chevauchement ~0 m — la sim v20
// mesure 0,8 m au flash, et la secousse ±9,5 m incluse dans la distance
// pouvait même faire tirer avec quelques mètres de VIDE). Sur l'iPhone :
// « explosion AVANT le toucher », 4 versions de suite. Le flash plein
// écran + la disparition instantanée de l'orbe + le rétrécissement du
// rebond faisaient qu'AUCUNE image de chevauchement n'était jamais visible.
// v23 : CAUSE RACINE du « explose SANS TOUCHER » persistant (v20→v22) —
// le « DERNIER RECOURS » (flash dans la dernière seconde de phase quand
// AUCUNE position n'était exploitable) partait sur un simple TIMER, sans
// aucun contact visuel : si le module météorite ne publiait plus ses
// positions, le Point Zéro explosait tout seul dans le ciel. SUPPRIMÉ :
// sans chevauchement vérifié, PAS DE FLASH — la phase 'contraction' puis
// 'collapse' prennent le relais (l'orbe est masquée par la séquence
// d'effondrement), l'event ne se bloque jamais. Le garde temporel
// « tState >= dur × 0,25 » est REMPLACÉ par le test de fraîcheur
// (meteorPosIsFresh) : il retardait le flash et pouvait le faire RATER
// avec une météorite très rapide qui chevauche avant 25 % de la phase.
// Règle d'or v23 : le flash ne part QUE sur chevauchement visuel réel
// avec des positions fraîches — jamais sur un timer, jamais sur une
// valeur périmée.
function shouldFireFlash(dur, dist2, contactR, fresh) {
  if (!(dur > 0)) return false;
  if (!fresh) return false; // v23 : positions périmées/figées -> pas de tir
  if (contactR > 0 && dist2 < contactR * contactR * 0.25) return true; // chevauchement réel
  return false;
}

// ---------- construction ----------
function buildImpact() {
  var scene = api.scene();
  if (!scene || grp) return;
  makeTextures();
  UP = new T.Vector3(0, 1, 0);
  lowQ = !!(api && (api.quality === 'low' || api.isMobile)); // v14

  // v16 : POINT D'IMPACT = LE POINT ZÉRO (position live), la cible RÉELLE
  // du plongeon final. Avant, c'était la position de la météorite à
  // l'entrée de phase (390 m au-dessus) : le flash et l'explosion partaient
  // dans le vide pendant que la météorite était encore en l'air. Maintenant
  // tout (flash, onde, colonne, anneaux, braises) est centré là où la
  // météorite TOUCHE vraiment.
  var AZ = root.AZEvent;
  var c = api.center;
  impactPos = new T.Vector3(c.x, c.y + 40, c.z);
  if (AZ.zeroPointPos && AZ.zeroPointPos.clone) {
    impactPos.copy(AZ.zeroPointPos);
  } else if (AZ.meteorPos && AZ.meteorPos.clone) {
    impactPos.copy(AZ.meteorPos);
    if (!(impactPos.y > 0)) impactPos.y = c.y + 40;
  }

  grp = new T.Group();

  // POINT INCANDESCENT : 5 couches de halo blanc-bleu, à l'échelle de
  // l'île (v10 : bien plus grandes qu'en v5).
  var layers = [
    { size: 150, tint: 0xffffff, grow: 500 },
    { size: 300, tint: 0xf2f8ff, grow: 900 },
    { size: 520, tint: 0xd8ecff, grow: 1400 },
    { size: 820, tint: 0xbcd8ff, grow: 2000 },
    { size: 1200, tint: 0x9cc4ff, grow: 2800 }
  ];
  for (var li = 0; li < layers.length; li++) {
    (function (L) {
      var m = new T.SpriteMaterial({
        map: glowTex, transparent: true, depthWrite: false,
        blending: T.AdditiveBlending, fog: false, color: L.tint
      });
      var sp = new T.Sprite(m);
      sp.scale.set(L.size, L.size, 1);
      sp.position.copy(impactPos);
      grp.add(sp);
      glows.push({ sp: sp, base: L.size, grow: L.grow, seed: Math.random() * 10,
                   c0: new T.Color(L.tint) }); // v14 : teinte d'origine
    })(layers[li]);
  }

  // v14 : ANTICIPATION — le point d'impact CHAUFFE et ROUGIT avant le
  // flash : coeur rougeoyant qui grandit pendant la charge.
  heatC = new T.Color(0xff5a1a);
  if (!heatTex) {
    heatTex = radialTexture([
      [0, 'rgba(255,240,220,1)'],
      [0.35, 'rgba(255,150,60,0.85)'],
      [0.7, 'rgba(255,80,20,0.35)'],
      [1, 'rgba(255,60,10,0)']
    ]);
  }
  heatCoreMat = new T.SpriteMaterial({
    map: heatTex, transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, fog: false, color: 0xff8a3a, opacity: 0
  });
  heatCore = new T.Sprite(heatCoreMat);
  heatCore.position.copy(impactPos);
  heatCore.scale.set(80, 80, 1);
  grp.add(heatCore);

  // LUMIÈRE extrêmement intense sur l'île (v10 : 60, portée 9000 m).
  blast = new T.PointLight(0xeaf2ff, 60, 9000, 1.6);
  blast.position.copy(impactPos);
  blast.position.y += 60;
  grp.add(blast);

  // RAYONS LUMINEUX qui irradient depuis l'impact (comme f3_028) :
  // faisceaux fins blancs-bleus, cône large vers le ciel.
  rayGeo = new T.CylinderGeometry(1.6, 0.7, 1, 6, 1, true);
  rayGeo.translate(0, 0.5, 0); // base à l'origine
  for (var ri = 0; ri < RAY_COUNT; ri++) {
    var az = (ri / RAY_COUNT) * Math.PI * 2 + (ri * 0.22);
    var elev = 0.25 + ((ri * 0.73) % 1) * 1.05; // ~14° à ~74°
    var dir = new T.Vector3(
      Math.cos(az) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(az) * Math.cos(elev)
    ).normalize();
    var len = 800 + ((ri * 0.37) % 1) * 900; // 800 -> 1700 m (v10)
    var m2 = new T.MeshBasicMaterial({
      color: (ri % 3 === 0) ? 0x9fc8ff : 0xeaf4ff,
      transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var mesh = new T.Mesh(rayGeo, m2);
    mesh.position.copy(impactPos);
    mesh.quaternion.setFromUnitVectors(UP, dir);
    mesh.scale.set(1, len, 1);
    mesh.frustumCulled = false;
    grp.add(mesh);
    rays.push({ mesh: mesh, mat: m2, dir: dir, len: len, seed: Math.random() * 10, baseOp: 0.65 + ((ri * 0.29) % 1) * 0.3 });
  }

  // ANNEAUX au sol en crescendo (décalés, relatifs au déclenchement).
  // v10 : 5 anneaux, jusqu'à 2800 m (échelle de l'île).
  ringGeo = new T.RingGeometry(0.82, 1.0, 96);
  var delays = [0, 0.35, 0.7, 1.1, 1.6];
  for (var gi = 0; gi < delays.length; gi++) {
    var m3 = new T.MeshBasicMaterial({
      color: 0xd6e8ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var ring = new T.Mesh(ringGeo, m3);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(impactPos.x, impactPos.y - 30, impactPos.z);
    ring.visible = false;
    grp.add(ring);
    rings.push({ mesh: ring, mat: m3, delay: delays[gi], maxR: 1200 + gi * 400, age: -delays[gi] });
  }

  // COLONNE D'ÉNERGIE (v10) : pilier vertical géant blanc-bleu qui monte
  // du point d'impact vers le ciel — le ciel est rempli d'énergie.
  columnMat = new T.MeshBasicMaterial({
    color: 0xdceeff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var colGeo = new T.CylinderGeometry(55, 95, 1500, 12, 1, true);
  colGeo.translate(0, 0.5, 0); // base à l'origine
  column = new T.Mesh(colGeo, columnMat);
  column.position.copy(impactPos);
  column.frustumCulled = false;
  grp.add(column);

  // v14 : MANTEAU de la colonne — seconde paroi plus large et plus
  // diffuse, en contre-rotation (la colonne a de la profondeur).
  if (!lowQ) {
    column2Mat = new T.MeshBasicMaterial({
      color: 0xbcd8ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var col2Geo = new T.CylinderGeometry(120, 170, 1500, 12, 1, true);
    col2Geo.translate(0, 0.5, 0);
    column2 = new T.Mesh(col2Geo, column2Mat);
    column2.position.copy(impactPos);
    column2.frustumCulled = false;
    grp.add(column2);
  }

  // v14 : ONDE QUI BALAIE L'ILE — anneau plat geant au sol, parti du
  // point d'impact, qui traverse toute l'ile et au-dela (relatif au flash).
  emberGY = groundYImp(impactPos.x, impactPos.z);
  sweepMat = new T.MeshBasicMaterial({
    color: 0xeaf4ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  sweep = new T.Mesh(new T.RingGeometry(0.92, 1.0, lowQ ? 64 : 128), sweepMat);
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.set(impactPos.x, emberGY + 3, impactPos.z);
  sweep.visible = false;
  sweep.frustumCulled = false;
  grp.add(sweep);
  if (!lowQ) {
    sweep2Mat = new T.MeshBasicMaterial({
      color: 0xcfe4ff, transparent: true, opacity: 0, // v16 : unifié blanc/bleu (était chaud)
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    sweep2 = new T.Mesh(new T.RingGeometry(0.94, 1.0, 96), sweep2Mat);
    sweep2.rotation.x = -Math.PI / 2;
    sweep2.position.set(impactPos.x, emberGY + 4, impactPos.z);
    sweep2.visible = false;
    sweep2.frustumCulled = false;
    grp.add(sweep2);
  }

  // v14 : BRAISES RETOMBANTES — pluie d'escarbilles orange autour de
  // l'impact, qui tombent en oscillant puis renaissent en haut.
  var nEmb = lowQ ? 80 : N_EMBERS;
  emberData = [];
  var ePos = new Float32Array(nEmb * 3);
  var eCol = new Float32Array(nEmb * 3);
  for (var ei = 0; ei < nEmb; ei++) {
    var ea = Math.random() * Math.PI * 2;
    var er = 60 + Math.random() * 940;
    ePos[ei * 3] = impactPos.x + Math.cos(ea) * er;
    ePos[ei * 3 + 1] = impactPos.y + 200 + Math.random() * 800;
    ePos[ei * 3 + 2] = impactPos.z + Math.sin(ea) * er;
    var eb = 0.6 + Math.random() * 0.4;
    eCol[ei * 3] = eb;
    eCol[ei * 3 + 1] = eb * (0.35 + Math.random() * 0.3);
    eCol[ei * 3 + 2] = eb * 0.12;
    emberData.push({
      vy: -(80 + Math.random() * 160),
      tw: Math.random() * Math.PI * 2,
      sw: 0.6 + Math.random() * 1.4
    });
  }
  emberGeo = new T.BufferGeometry();
  emberGeo.setAttribute('position', new T.BufferAttribute(ePos, 3));
  emberGeo.setAttribute('color', new T.BufferAttribute(eCol, 3));
  emberMat = new T.PointsMaterial({
    size: 3.2, vertexColors: true, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true, fog: false
  });
  embers = new T.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  grp.add(embers);

  // v15 : ÉCHO DE L'ONDE — second anneau géant qui balaie l'île en retard
  // (réverbération de l'onde principale).
  sweep3Mat = new T.MeshBasicMaterial({
    color: 0xbfe0ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  sweep3 = new T.Mesh(new T.RingGeometry(0.96, 1.0, lowQ ? 64 : 128), sweep3Mat);
  sweep3.rotation.x = -Math.PI / 2;
  sweep3.position.set(impactPos.x, emberGY + 5, impactPos.z);
  sweep3.visible = false;
  sweep3.frustumCulled = false;
  grp.add(sweep3);

  // v22 : ANNEAUX CÉLESTES — le ciel se déchire EN HAUTEUR : des anneaux
  // horizontaux à +300/+600/+900/+1200 m qui balaient les cieux en séquence.
  var nSR = lowQ ? 2 : 4; // v22 : densité réduite sur mobile
  for (var sri = 0; sri < nSR; sri++) {
    var srMat = new T.MeshBasicMaterial({
      color: 0xcfe4ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var srMesh = new T.Mesh(new T.RingGeometry(0.9, 1.0, lowQ ? 64 : 128), srMat);
    srMesh.rotation.x = -Math.PI / 2;
    srMesh.position.set(impactPos.x, impactPos.y + 300 + sri * 300, impactPos.z);
    srMesh.visible = false;
    srMesh.frustumCulled = false;
    grp.add(srMesh);
    skyRings.push({ mesh: srMesh, mat: srMat, delay: sri * 0.35, maxR: 1500 + sri * 400 });
  }

  // v15 : ÉCLAIRS DE SOL — zigzags incandescents qui ZÈBRENT l'île au sol
  // après le flash (chaque éclair frappe par intermittence).
  var nB = lowQ ? 6 : 12; // v15 : réduction mobile conservée
  for (var bi = 0; bi < nB; bi++) {
    var baz = Math.random() * Math.PI * 2;
    var bpts = [];
    var blen = 400 + Math.random() * 1000;
    var bseg = 7 + Math.floor(Math.random() * 3);
    for (var bsi = 0; bsi <= bseg; bsi++) {
      var bk2 = bsi / bseg;
      var br2 = 80 + bk2 * blen;
      var ba2 = baz + (Math.random() - 0.5) * 0.35 * bk2;
      var bx = impactPos.x + Math.cos(ba2) * br2;
      var bz = impactPos.z + Math.sin(ba2) * br2;
      bpts.push(new T.Vector3(bx, groundYImp(bx, bz) + 6 + Math.random() * 10, bz));
    }
    var bGeo = new T.BufferGeometry().setFromPoints(bpts);
    var bMat = new T.LineBasicMaterial({
      color: 0xd8ecff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var bLine = new T.Line(bGeo, bMat);
    bLine.frustumCulled = false;
    grp.add(bLine);
    bolts.push({ line: bLine, mat: bMat, nextT: 0.5 + Math.random() * 1.5, life: 0, maxLife: 0.2 });
  }

  // v21 : TRIPLE FRAPPE D'ÉCLAIRS — 3 éclairs titanesques qui tombent du
  // ciel sur le point d'impact et claquent EN SÉQUENCE (0,05 s / 0,23 s /
  // 0,41 s après le flash). Chacun secoue l'écran et claque dans le grave.
  for (var tli = 0; tli < 3; tli++) {
    var tlaz = (tli / 3) * Math.PI * 2 + 0.7;
    var tlx0 = impactPos.x + Math.cos(tlaz) * (120 + tli * 90);
    var tlz0 = impactPos.z + Math.sin(tlaz) * (120 + tli * 90);
    var tlgy = groundYImp(tlx0, tlz0);
    var tlpts = [];
    for (var tlsi = 0; tlsi <= 12; tlsi++) {
      var tlk = tlsi / 12; // 0 = sol, 1 = ciel (1500 m)
      var tenv = Math.sin(Math.PI * tlk);
      var tljx = (Math.random() - 0.5) * 110 * tenv;
      var tljz = (Math.random() - 0.5) * 110 * tenv;
      tlpts.push(new T.Vector3(
        tlx0 + (impactPos.x - tlx0) * tlk + tljx,
        tlgy + 10 + tlk * 1490 + tljz * 0.3,
        tlz0 + (impactPos.z - tlz0) * tlk + tljz
      ));
    }
    var tlGeo = new T.BufferGeometry().setFromPoints(tlpts);
    var tlMat = new T.LineBasicMaterial({
      color: tli === 1 ? 0xffffff : 0xd8ecff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var tlLine = new T.Line(tlGeo, tlMat);
    tlLine.frustumCulled = false;
    tlLine.visible = false;
    grp.add(tlLine);
    boltSky.push({ line: tlLine, mat: tlMat, delay: 0.05 + tli * 0.18, strikeT: -1, maxLife: 0.5 });
  }

  // v21 : ONDE DE CHOC CÉLESTE — anneau géant à 1200 m d'altitude qui
  // balaie le ciel en 3 s (l'explosion déchire les cieux, pas seulement le sol).
  skyRingMat = new T.MeshBasicMaterial({
    color: 0xcfe4ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  skyRing = new T.Mesh(new T.RingGeometry(0.9, 1.0, lowQ ? 64 : 128), skyRingMat);
  skyRing.rotation.x = -Math.PI / 2;
  skyRing.position.set(impactPos.x, impactPos.y + 1200, impactPos.z);
  skyRing.visible = false;
  skyRing.frustumCulled = false;
  grp.add(skyRing);
  // Dôme de flash céleste (halo du ciel qui s'embrase).
  skyDomeMat = new T.SpriteMaterial({
    map: glowTex, color: 0xdceeff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });
  skyDome = new T.Sprite(skyDomeMat);
  skyDome.position.set(impactPos.x, impactPos.y + 1200, impactPos.z);
  skyDome.scale.set(2000, 2000, 1);
  skyDome.visible = false;
  grp.add(skyDome);

  // v21 : CŒUR SUPERNOVA — sphère de lumière blanche qui AVALE le point
  // d'impact au contact (croissance explosive 0 -> 900 m en 0,6 s).
  novaMat = new T.SpriteMaterial({
    map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });
  novaCore = new T.Sprite(novaMat);
  novaCore.position.copy(impactPos);
  novaCore.scale.set(1, 1, 1);
  novaCore.visible = false;
  grp.add(novaCore);

  // PLUIE DE PARTICULES + CHAMP D'ÉNERGIE DU CIEL (v10) : 450 particules
  // blanc/bleu sur toute l'île — 60 % tombent du ciel (pluie), 40 %
  // tourbillonnent (étoiles d'énergie). Palette bleu/blanc uniquement.
  partData = [];
  var nP = lowQ ? 220 : N_PARTS; // v14 : champ d'energie reduit sur mobile
  var pPos = new Float32Array(nP * 3);
  var pCol = new Float32Array(nP * 3);
  for (var pi = 0; pi < nP; pi++) {
    var pa = Math.random() * Math.PI * 2;
    var pr = 80 + Math.random() * 1420;
    var px = impactPos.x + Math.cos(pa) * pr;
    var pz = impactPos.z + Math.sin(pa) * pr;
    var py = impactPos.y - 40 + Math.random() * 1040;
    pPos[pi * 3] = px; pPos[pi * 3 + 1] = py; pPos[pi * 3 + 2] = pz;
    var rain = Math.random() < 0.6;
    var bright = 0.55 + Math.random() * 0.45;
    if (rain) { pCol[pi * 3] = bright * 0.85; pCol[pi * 3 + 1] = bright * 0.93; pCol[pi * 3 + 2] = bright; }
    else { pCol[pi * 3] = bright * 0.7; pCol[pi * 3 + 1] = bright * 0.85; pCol[pi * 3 + 2] = bright; }
    partData.push({
      rain: rain,
      vy: rain ? -(60 + Math.random() * 90) : 0,       // pluie : chute
      swirl: rain ? 0 : (0.25 + Math.random() * 0.6),  // tourbillon : vitesse angulaire
      ang: pa, rad: pr,
      tw: Math.random() * Math.PI * 2,                 // scintillement
      y0: py
    });
  }
  partGeo = new T.BufferGeometry();
  partGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
  partGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
  partMat = new T.PointsMaterial({
    size: 2.6, vertexColors: true, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true, fog: false
  });
  parts = new T.Points(partGeo, partMat);
  parts.frustumCulled = false;
  grp.add(parts);

  scene.add(grp);
}

function clearImpact() {
  var scene = api ? api.scene() : null;
  if (grp && scene) scene.remove(grp);
  var i;
  for (i = 0; i < glows.length; i++) glows[i].sp.material.dispose();
  for (i = 0; i < rays.length; i++) rays[i].mat.dispose();
  for (i = 0; i < rings.length; i++) rings[i].mat.dispose();
  if (columnMat) columnMat.dispose();
  if (column) column.geometry.dispose();
  if (column2Mat) column2Mat.dispose(); // v14
  if (column2) column2.geometry.dispose(); // v14
  if (sweepMat) sweepMat.dispose(); // v14
  if (sweep) sweep.geometry.dispose(); // v14
  if (sweep2Mat) sweep2Mat.dispose(); // v14
  if (sweep2) sweep2.geometry.dispose(); // v14
  if (sweep3Mat) sweep3Mat.dispose(); // v15 : écho de l'onde
  if (sweep3) sweep3.geometry.dispose(); // v15
  sweep3 = null; sweep3Mat = null; // v15
  for (i = 0; i < skyRings.length; i++) { // v22 : anneaux célestes
    skyRings[i].mat.dispose();
    skyRings[i].mesh.geometry.dispose();
  }
  skyRings.length = 0; // v22
  for (i = 0; i < bolts.length; i++) { // v15 : éclairs de sol
    bolts[i].mat.dispose();
    bolts[i].line.geometry.dispose();
  }
  bolts.length = 0; // v15
  for (i = 0; i < boltSky.length; i++) { // v21 : triple frappe d'éclairs
    boltSky[i].mat.dispose();
    boltSky[i].line.geometry.dispose();
  }
  boltSky.length = 0; // v21
  if (skyRingMat) skyRingMat.dispose(); // v21
  if (skyRing) skyRing.geometry.dispose(); // v21
  skyRing = null; skyRingMat = null; // v21
  if (skyDomeMat) skyDomeMat.dispose(); // v21
  skyDome = null; skyDomeMat = null; // v21
  if (novaMat) novaMat.dispose(); // v21
  novaCore = null; novaMat = null; // v21
  subSlamFired = false; // v21
  if (emberMat) emberMat.dispose(); // v14
  if (emberGeo) emberGeo.dispose(); // v14
  if (heatCoreMat) heatCoreMat.dispose(); // v14
  // heatTex est partagee au module : liberee dans dispose()
  if (partMat) partMat.dispose();
  if (partGeo) partGeo.dispose();
  if (rayGeo) rayGeo.dispose();
  if (ringGeo) ringGeo.dispose();
  grp = null;
  rayGeo = null;
  ringGeo = null;
  glows.length = 0;
  rays.length = 0;
  rings.length = 0;
  blast = null;
  impactPos = null;
  UP = null;
  column = null; columnMat = null;
  column2 = null; column2Mat = null; // v14
  sweep = null; sweepMat = null; sweep2 = null; sweep2Mat = null; // v14
  embers = null; emberGeo = null; emberMat = null; emberData = null; // v14
  heatCore = null; heatCoreMat = null; // v14
  parts = null; partGeo = null; partMat = null; partData = null;
  fading = false;
  fadeAge = 0;
  fadeOp = 1;
}

// ---------- entrées de phase ----------
function startImpact() {
  if (disposed || impactFired || !api) return;
  if (!root.AZEvent.active) return;
  impactFired = true;
  impactT = 0;
  flashT = -1;
  rebreathFired = false; // v15 : second souffle
  rebreathAge = -1; // v15
  echoFired = false; // v15 : écho de l'onde
  subSlamFired = false; // v21 : sub-slam retardé
  aftershockFired = false; rumbleFired = false; // v22 : secousse dosée / écho
  afterAge = -1; afterKick = 0; // v22 : rémanence réarmée
  for (var sr2 = 0; sr2 < skyRings.length; sr2++) { // v22 : anneaux célestes réarmés
    skyRings[sr2].mesh.visible = false;
    skyRings[sr2].mat.opacity = 0;
  }
  for (var tlr = 0; tlr < boltSky.length; tlr++) { // v21 : triple frappe réarmée
    boltSky[tlr].strikeT = -1;
    boltSky[tlr].mat.opacity = 0;
    boltSky[tlr].line.visible = false;
  }
  buildImpact();
}

function beginResidualFade() {
  if (!grp || fading) return;
  fading = true;
  fadeAge = 0;
}

// ---------- boucle ----------
function update(dt, t) {
  if (disposed) return;
  if (!root.AZEvent.active) return;
  if (!dt || dt <= 0) return;

  var AZ = root.AZEvent;
  var st = AZ.state;
  ensureTmp();
  var freshMP = meteorPosIsFresh(AZ); // v23 : suivi de fraîcheur (chaque frame)

  // Repli : phase démarrée sans passer par le bus.
  if (st === 'impact' && !impactFired) startImpact();
  // Vers 'contraction' : la lueur résiduelle s'estompe.
  if ((st === 'contraction' || st === 'collapse') && grp && !fading) beginResidualFade();
  // Sécurité : phase dépassée sans contraction (jamais de temps absolu).
  if (grp && !fading && st !== 'impact' && st !== 'contraction' && st !== 'collapse') beginResidualFade();

  // Flash plein écran : bref, avec un SECOND SOUFFLE (double-hit : le flash
  // retombe à moitié puis repart — l'impact "claque" deux fois), puis fondu
  // rapide vers le halo.
  // v15 : dès que le SECOND SOUFFLE (rebreath) part, ce bloc cesse d'écrire
  // l'overlay (il prend le relais).
  if (flashAge >= 0 && flashEl && !rebreathFired) {
    flashAge += dt;
    if (flashAge >= FLASH_LIFE + FLASH_FADE) {
      flashEl.style.opacity = '0';
      flashAge = -1;
    } else if (flashAge < FLASH_LIFE) {
      var fph = flashAge / FLASH_LIFE;
      var fop = (fph > 0.30 && fph < 0.46) ? 0.55 : 1; // v12 : second souffle
      flashEl.style.opacity = String(fop);
    } else {
      // v16 : retombée PROGRESSIVE — courbe douce, jamais de coupure nette.
      var fk = (flashAge - FLASH_LIFE) / FLASH_FADE;
      var ff = Math.max(0, 1 - fk);
      flashEl.style.opacity = String(ff * ff * (3 - 2 * ff));
    }
  }

  // v14 : 2e COUCHE du flash — halo chaud retarde (le flash a plusieurs couches).
  if (!flash2Fired && flashAge >= FLASH2_DELAY) fireFlash2();
  if (flash2Age >= 0 && flashEl2) {
    flash2Age += dt;
    if (flash2Age >= FLASH2_LIFE + FLASH2_FADE) {
      flashEl2.style.opacity = '0';
      flash2Age = -1;
    } else if (flash2Age < FLASH2_LIFE) {
      flashEl2.style.opacity = '1';
    } else {
      // v16 : retombée PROGRESSIVE (même courbe que le flash principal).
      var f2k = (flash2Age - FLASH2_LIFE) / FLASH2_FADE;
      var ff2 = Math.max(0, 1 - f2k);
      flashEl2.style.opacity = String(ff2 * ff2 * (3 - 2 * ff2));
    }
  }

  // v15 : SECOND SOUFFLE lumineux — après le flash initial, une seconde
  // vague de lumière balaie l'écran (~1 s après le flash, plus douce).
  if (!rebreathFired && flashT >= 1.0 && flashEl) {
    rebreathFired = true;
    rebreathAge = 0;
    flashAge = -1; // le flash initial a fini d'écrire l'overlay
    flashEl.style.opacity = '0.55';
  }
  if (rebreathAge >= 0 && flashEl) {
    rebreathAge += dt;
    if (rebreathAge >= REBREATH_LIFE) { flashEl.style.opacity = '0'; rebreathAge = -1; }
    else flashEl.style.opacity = String(0.55 * (1 - rebreathAge / REBREATH_LIFE));
  }

  // v22 : RÉMANENCE — 3e couche du flash, TRÈS lente : l'écran garde
  // l'impact en mémoire (~6 s de retombée douce).
  if (afterAge >= 0 && afterEl) {
    afterAge += dt;
    afterKick = Math.max(0, afterKick - dt * 0.5);
    if (afterAge >= AFTER_LIFE + AFTER_FADE) {
      afterEl.style.opacity = '0';
      afterAge = -1;
    } else if (afterAge < AFTER_LIFE) {
      afterEl.style.opacity = String(0.4 * (afterAge / AFTER_LIFE) + afterKick);
    } else {
      var ak22 = (afterAge - AFTER_LIFE) / AFTER_FADE;
      var af22 = Math.max(0, 1 - ak22);
      afterEl.style.opacity = String(0.4 * af22 * af22 + afterKick);
    }
  }

  if (!grp) return;

  // v12 : chronos relatifs de la séquence (aucun temps absolu).
  impactT += dt;
  if (flashT >= 0) flashT += dt;

  // v16 : DÉCLENCHEMENT SUR CONTACT RÉEL — le flash (et 'meteor:hit' :
  // destruction du Point Zéro, rebond de la météorite) ne part QUE quand
  // la météorite TOUCHE VRAIMENT le Point Zéro (positions live). Fini le
  // timer aveugle à 44 % qui faisait exploser le Point Zéro alors que la
  // météorite était encore à ~200 m au-dessus.
  // v17 : INCONTESTABLE — le repli de sécurité n'est PLUS un timer aveugle
  // à 94 % : il VÉRIFIE la proximité réelle de la météorite (via
  // AZEvent.meteorPos) avant de jouer l'explosion. Voir shouldFireFlash().
  // v18 : le « contact » est calculé sur les RAYONS VISUELS RÉELS
  // (dist < R_météorite + R_PointZéro, live) : l'explosion part à l'INSTANT
  // EXACT du toucher visuel — ni avant, ni après.
  // v20 : le « contact » exige le CHEVAUCHEMENT ((R_m + R_z) × 0,5) : la
  // tangence exacte (v18) ne se VOIT pas sur téléphone — le flash part
  // quand le rocher est déjà enfoncé dans l'orbe. Voir shouldFireFlash().
  if (!flashFired && st === 'impact') {
    var dur = impactDuration();
    var dist2 = liveMeteorDist2(AZ);
    var contactR = visualContactRadiusI(AZ); // v18 : R_m + R_z live
    if (shouldFireFlash(dur, dist2, contactR, freshMP)) fireFlash();
  }

  // Fondu de la lueur résiduelle (relatif).
  if (fading) {
    fadeAge += dt;
    fadeOp = Math.max(0, 1 - fadeAge / FADE_LIFE);
    if (fadeOp <= 0) { clearImpact(); return; }
  }

  // Résidu : après le flash, la lueur décroît doucement jusqu'à la fin
  // de la phase (tState relatif), puis le fondu prend le relais.
  var residual = 1;
  if (flashFired && st === 'impact') {
    var d2 = impactDuration();
    if (d2 > 0) residual = Math.max(0.15, 1 - (AZ.tState / d2) * 0.85);
  } else if (!flashFired) {
    residual = 0.7; // montée avant le flash
  }

  var op = fadeOp * residual;
  var i, k;

  // v12 : le point incandescent EXPLOSE (ease-out franc sur impactT) avec
  // une ANTICIPATION — il se resserre et s'affole juste avant le flash.
  var chargeK = 0;
  if (!flashFired && st === 'impact') {
    var d0 = impactDuration();
    if (d0 > 0) chargeK = Math.min(1, Math.max(0, AZ.tState / (d0 * FLASH_FRACTION)));
  }
  var anticip = Math.max(0, (chargeK - 0.9) / 0.1); // 0 → 1 dans les derniers 10 %
  var ge = easeOutBurst12(Math.min(1, impactT / 2.2));
  // v15 : SECOND SOUFFLE — les halos REGONFLENT une seconde fois après le
  // flash (l'impact « respire » une deuxième vague de lumière).
  var br2 = 0;
  if (flashT >= 1.0) {
    var b2k = (flashT - 1.0) / 1.2;
    if (b2k < 1) br2 = Math.sin(b2k * Math.PI);
  }
  for (i = 0; i < glows.length; i++) {
    var G = glows[i];
    var pulse = 0.9 + 0.1 * Math.sin(t * (18 + anticip * 16) + G.seed * 6.28);
    var s = (G.base + ge * G.grow) * pulse * (1 - 0.16 * anticip) * (1 + br2 * 0.35);
    G.sp.scale.set(s, s, 1);
    G.sp.material.opacity = op * pulse * (1 + 0.25 * anticip) * (1 + br2 * 0.6);
    // v14 : le point d'impact ROUGIT pendant la charge (retour au
    // blanc-bleu juste apres le flash).
    var heatK = chargeK * chargeK * ((flashT >= 0) ? Math.max(0, 1 - flashT * 1.5) : 1);
    if (G.c0 && heatC) G.sp.material.color.copy(G.c0).lerp(heatC, Math.min(1, heatK));
  }
  // v14 : COEUR ROUGEOYANT — grandit avec la charge, meurt au flash.
  if (heatCore) {
    var hc = Math.min(1, chargeK * 1.15);
    var hs = 80 + 260 * hc;
    heatCore.scale.set(hs, hs, 1);
    var hfade = (flashT >= 0) ? Math.max(0, 1 - flashT * 2) : 1;
    heatCoreMat.opacity = op * 0.9 * hc * hfade * (0.85 + 0.15 * Math.sin(t * 21));
    heatCore.visible = heatCoreMat.opacity > 0.01;
  }
  // v10 : extrêmement intense — v12 : pic violent juste après le flash.
  // v13 : SECOND SOUFFLE — la lumière "re-claque" une seconde fois (~0,9 s
  // après le flash, écho du double souffle du flash plein écran).
  var fte = (flashT >= 0) ? flashT : 99;
  var secondBreath = Math.exp(-Math.pow((fte - 0.9) * 4, 2));
  if (blast) blast.intensity = 60 * op * (1 + 2 * Math.exp(-fte * 5) + 1.2 * secondBreath);

  // COLONNE D'ÉNERGIE : pulse et ondule — v12 : elle JAILLIT vers le ciel
  // juste après le flash (overshoot), le ciel est rempli d'énergie.
  if (column) {
    var cpulse = 0.75 + 0.25 * Math.sin(t * 16);
    columnMat.opacity = op * 0.55 * cpulse;
    var cw = 1 + 0.12 * Math.sin(t * 9);
    var cr = (flashT >= 0) ? easeOutBack12(Math.min(1, flashT / 1.0)) : 0.001;
    column.scale.set(cw, Math.max(0.001, cr * (1 + 0.06 * Math.sin(t * 5.3))), cw);
    column.rotation.y += dt * 0.8; // v14 : la colonne tourne (energie)
  }
  // v14 : MANTEAU exterieur — contre-rotation, plus diffus.
  if (column2) {
    column2Mat.opacity = op * 0.22 * (0.75 + 0.25 * Math.sin(t * 13 + 2));
    var cr2 = (flashT >= 0) ? easeOutBurst12(Math.min(1, flashT / 1.4)) : 0.001;
    column2.scale.set(1, Math.max(0.001, cr2), 1);
    column2.rotation.y -= dt * 0.5;
  }

  // PLUIE DE PARTICULES + CHAMP D'ÉNERGIE : la pluie tombe, le reste
  // tourbillonne et scintille (ciel rempli d'énergie, partout).
  if (parts && partData) {
    var pAttr = partGeo.getAttribute('position');
    var pDirty = false;
    for (var pi2 = 0; pi2 < partData.length; pi2++) {
      var PD = partData[pi2];
      var px2 = pAttr.getX(pi2), py2 = pAttr.getY(pi2), pz2 = pAttr.getZ(pi2);
      if (PD.rain) {
        py2 += PD.vy * dt;
        if (py2 < impactPos.y - 60) py2 = impactPos.y + 1000; // boucle
      } else {
        PD.ang += PD.swirl * dt;
        px2 = impactPos.x + Math.cos(PD.ang) * PD.rad;
        pz2 = impactPos.z + Math.sin(PD.ang) * PD.rad;
        py2 = PD.y0 + Math.sin(t * 1.7 + PD.tw) * 24;
      }
      pAttr.setXYZ(pi2, px2, py2, pz2);
      pDirty = true;
    }
    if (pDirty) pAttr.needsUpdate = true;
    // Scintillement global du champ d'énergie.
    partMat.opacity = op * (0.7 + 0.3 * Math.sin(t * 12));
  }

  // v14 : ONDE QUI BALAIE L'ILE — anneau geant au sol, parti du flash,
  // qui traverse toute l'ile et au-dela (duree relative SWEEP_DUR).
  if (sweep && flashT >= 0) {
    sweep.visible = true;
    var swk = Math.min(1, flashT / SWEEP_DUR);
    var swr = (1 - Math.pow(1 - swk, 2)) * SWEEP_R;
    sweep.scale.set(swr, swr, 1);
    sweepMat.opacity = op * 0.85 * Math.pow(1 - swk, 1.2);
    if (sweep2) {
      sweep2.visible = true;
      var swk2 = Math.min(1, Math.max(0, (flashT - 0.6) / SWEEP_DUR));
      var swr2 = (1 - Math.pow(1 - swk2, 2)) * SWEEP_R * 0.82;
      sweep2.scale.set(swr2, swr2, 1);
      sweep2Mat.opacity = op * 0.5 * Math.pow(1 - swk2, 1.2);
    }
  }

  // v15 : ÉCHO de l'onde — une seconde vague balaie l'île en retard
  // (réverbération de l'onde principale).
  if (sweep3 && flashT >= 1.5) {
    sweep3.visible = true;
    var e3k = Math.min(1, (flashT - 1.5) / 7);
    var e3r = (1 - Math.pow(1 - e3k, 2)) * SWEEP_R * 0.9;
    sweep3.scale.set(e3r, e3r, 1);
    sweep3Mat.opacity = op * 0.6 * Math.pow(1 - e3k, 1.4);
  }
  // v15 : réverbération — l'onde repart une seconde fois via le bus
  // (event-shockwave.js, 'shockwave:burst' existant).
  if (!echoFired && flashT >= 2.0) {
    echoFired = true;
    bus.emit('shockwave:burst', {
      pos: impactPos ? impactPos.clone() : null,
      opts: { radius: 2000, duration: 4.0, rings: 5, color: 0xbfe0ff, flash: false }
    });
  }

  // v15 : les ÉCLAIRS DE SOL frappent par intermittence après le flash.
  if (flashT >= 0.5) {
    for (var bo = 0; bo < bolts.length; bo++) {
      var B = bolts[bo];
      if (B.life > 0) {
        B.life -= dt;
        B.mat.opacity = op * 0.95 * Math.max(0, B.life / B.maxLife);
        if (B.life <= 0) { B.mat.opacity = 0; B.nextT = 0.4 + Math.random() * 1.8; }
      } else {
        B.nextT -= dt;
        if (B.nextT <= 0) { B.life = B.maxLife = 0.12 + Math.random() * 0.14; }
      }
    }
  }

  // v21 : TRIPLE FRAPPE D'ÉCLAIRS — les 3 éclairs titanesques claquent en
  // séquence après le flash ; chacun secoue l'écran et claque dans le grave.
  if (flashT >= 0) {
    for (var tli2 = 0; tli2 < boltSky.length; tli2++) {
      var SB = boltSky[tli2];
      if (SB.strikeT === -1 && flashT >= SB.delay) {
        SB.strikeT = 0;
        try { bus.emit('camera:shake', { force: 0.8, duration: 0.8, source: 'meteor-lightning' }); } catch (e) {}
        try { bus.emit('shockwave', { force: 0.9, phase: 'meteor-lightning' }); } catch (e) {}
        // v22 : chaque éclair RE-FRAPPE le cœur supernova et la rémanence.
        if (novaCore) {
          var nsk22 = novaCore.scale.x * 1.18;
          novaCore.scale.set(nsk22, nsk22, 1);
        }
        afterKick = Math.min(0.3, afterKick + 0.18);
      }
      if (SB.strikeT >= 0) {
        SB.strikeT += dt;
        var slk = SB.strikeT / SB.maxLife;
        if (slk >= 1) { SB.mat.opacity = 0; SB.line.visible = false; SB.strikeT = -2; }
        else {
          SB.line.visible = true;
          var sfl = 0.5 + 0.5 * Math.sin(SB.strikeT * 120);
          SB.mat.opacity = op * (1 - slk) * (1 - slk) * sfl;
        }
      }
    }
    // v21 : ONDE DE CHOC CÉLESTE — l'anneau balaie le ciel en 3 s.
    if (skyRing) {
      var ck = Math.min(1, flashT / 3.0);
      if (ck < 1) {
        skyRing.visible = true;
        var cr3 = (1 - Math.pow(1 - ck, 2)) * 4200;
        skyRing.scale.set(cr3, cr3, 1);
        skyRingMat.opacity = op * 0.7 * Math.pow(1 - ck, 1.3);
      } else { skyRing.visible = false; skyRingMat.opacity = 0; }
    }
    if (skyDome) {
      skyDome.visible = flashT < 2.5;
      if (skyDome.visible) {
        var dk = Math.min(1, flashT / 2.5);
        var ds = 2000 + dk * 1600;
        skyDome.scale.set(ds, ds, 1);
        skyDomeMat.opacity = op * 0.5 * Math.exp(-flashT * 1.4);
      } else skyDomeMat.opacity = 0;
    }
    // v21 : CŒUR SUPERNOVA — croissance explosive 0 -> 900 m en 0,6 s, puis dissipation.
    if (novaCore) {
      var nf2 = Math.max(0, 1 - flashT / 1.8);
      novaCore.visible = nf2 > 0;
      if (novaCore.visible) {
        var nk = Math.min(1, flashT / 0.6);
        var ne = 1 - Math.pow(1 - nk, 3);
        var ns = 1 + ne * 900;
        novaCore.scale.set(ns, ns, 1);
        novaMat.opacity = op * nf2 * nf2;
      } else novaMat.opacity = 0;
    }
    // v21 : SUB-SLAM retardé — 0,35 s après le flash, le grave FRAPPE
    // (la lumière d'abord, le sol qui tremble juste après : cause -> effet).
    if (!subSlamFired && flashT >= 0.35) {
      subSlamFired = true;
      try { bus.emit('shockwave', { force: 1.0, phase: 'meteor-subslam' }); } catch (e) {}
      try { bus.emit('camera:shake', { force: 0.7, duration: 2.0, source: 'meteor-subslam' }); } catch (e) {}
    }
    // v22 : SECOUSSE DOSÉE retardée — 1,2 s après le flash, l'écran
    // re-tremble (l'impact "résonne").
    if (!aftershockFired && flashT >= 1.2) {
      aftershockFired = true;
      try { bus.emit('camera:shake', { force: 0.45, duration: 2.5, source: 'meteor-aftershock' }); } catch (e) {}
    }
    // v22 : ÉCHO DE GRONDEMENT — 2,5 s après le flash, le grave repart une
    // troisième fois (couches : flash -> sub-slam -> résonance -> écho).
    if (!rumbleFired && flashT >= 2.5) {
      rumbleFired = true;
      try { bus.emit('shockwave', { force: 0.6, phase: 'meteor-rumble-echo' }); } catch (e) {}
    }
    // v22 : ANNEAUX CÉLESTES — le ciel se déchire en hauteur, en séquence.
    for (var sru = 0; sru < skyRings.length; sru++) {
      var SR = skyRings[sru];
      if (flashT >= SR.delay) {
        SR.mesh.visible = true;
        var srk = Math.min(1, (flashT - SR.delay) / 3.0);
        var srr = (1 - Math.pow(1 - srk, 2)) * SR.maxR;
        SR.mesh.scale.set(srr, srr, 1);
        SR.mat.opacity = op * 0.55 * Math.pow(1 - srk, 1.2);
      } else { SR.mesh.visible = false; SR.mat.opacity = 0; }
    }
  }

  // v14 : BRAISES RETOMBANTES — escarbilles orange qui pleuvent autour
  // de l'impact en oscillant, puis renaissent en haut.
  if (embers && emberData && flashT >= 0) {
    var eAttr = emberGeo.getAttribute('position');
    var eDirty = false;
    for (var ei2 = 0; ei2 < emberData.length; ei2++) {
      var ED = emberData[ei2];
      var ex2 = eAttr.getX(ei2), ey2 = eAttr.getY(ei2), ez2 = eAttr.getZ(ei2);
      ey2 += ED.vy * dt;
      ex2 += Math.sin(t * 2.5 + ED.tw) * 22 * ED.sw * dt;
      ez2 += Math.cos(t * 2.1 + ED.tw * 1.3) * 18 * ED.sw * dt;
      if (ey2 < emberGY - 40) {
        var nea = Math.random() * Math.PI * 2;
        var ner = 60 + Math.random() * 940;
        ex2 = impactPos.x + Math.cos(nea) * ner;
        ez2 = impactPos.z + Math.sin(nea) * ner;
        ey2 = impactPos.y + 600 + Math.random() * 400;
      }
      eAttr.setXYZ(ei2, ex2, ey2, ez2);
      eDirty = true;
    }
    if (eDirty) eAttr.needsUpdate = true;
    emberMat.opacity = op * (0.15 + 0.85 * Math.exp(-Math.max(0, flashT) * 0.22));
  }

  // Rayons : scintillement + légère oscillation (ils "irradient").
  // v12 : faibles pendant la charge (anticipation), ils EXPLOSENT au flash.
  var surge = (flashT >= 0) ? easeOutBurst12(Math.min(1, flashT / 0.45)) : 0;
  var rayBoost = 0.35 + 0.65 * surge;
  for (i = 0; i < rays.length; i++) {
    var R = rays[i];
    var shim = 0.75 + 0.25 * Math.sin(t * 22 + R.seed * 6.28);
    R.mat.opacity = op * R.baseOp * shim * rayBoost;
    if (!_wob) continue; // sécurité : T indisponible
    // Petite oscillation d'angle : le faisceau vibre autour de sa direction.
    var wob = 0.012 * Math.sin(t * 9 + R.seed * 4.2);
    var ddx = R.dir.x + wob, ddz = R.dir.z - wob;
    k = 1 / Math.sqrt(ddx * ddx + R.dir.y * R.dir.y + ddz * ddz);
    _wob.set(ddx * k, R.dir.y * k, ddz * k);
    R.mesh.quaternion.setFromUnitVectors(UP, _wob);
  }

  // Anneaux : expansion décalée — v12 : chaque anneau CLAQUE avec un léger
  // overshoot puis s'éteint vite (plus percutant que l'expansion linéaire).
  for (i = 0; i < rings.length; i++) {
    var Rn = rings[i];
    Rn.age += dt;
    if (Rn.age < 0) continue;
    Rn.mesh.visible = true;
    var rk = Math.min(1, Rn.age / 2.4);
    var rr = easeOutBack12(rk) * Rn.maxR;
    Rn.mesh.scale.set(rr, rr, 1);
    Rn.mat.opacity = op * 0.85 * (1 - Math.pow(rk, 1.5));
  }
}

var _wob = null;
function ensureTmp() {
  if (!_wob && T) _wob = new T.Vector3();
}

// ---------- enregistrement ----------
function init(a) {
  api = a;
  bus = root.AZEvent;
  T = (a && a.T) || root.THREE;
  disposed = false;
  resetMeteorFreshness(); // v23 : base de fraîcheur réarmée
  ensureTmp();
  if (!busBound) {
    busBound = true;
    bus.on('phase:impact', function () { startImpact(); });
    bus.on('phase:contraction', function () {
      if (root.AZEvent.active) beginResidualFade();
    });
    // Repli : si un autre module émet 'meteor:hit' en premier, on orchestre
    // quand même les visuels une unique fois (jamais de doublon).
    // v18 : aligné sur le contact visuel — si les positions sont
    // exploitables et qu'il n'y a pas encore toucher visuel, on n'orchestre
    // PAS tout de suite : update() tirera le flash à l'instant exact du
    // contact. Si aucune position n'est exploitable, on ne bloque pas.
    // v20 : même seuil de chevauchement ((R_m + R_z) × 0,5) que
    // shouldFireFlash() — cohérence stricte entre les deux chemins.
    // v23 : JAMAIS de flash sans chevauchement visuel vérifié sur des
    // positions fraîches — même si un autre module émettait 'meteor:hit'
    // en premier. Positions inexploitables ou figées = pas de tir
    // (update() retentera quand elles reviendront).
    bus.on('meteor:hit', function (data) {
      if (!impactFired) {
        startImpact();
        if (!flashFired) {
          var AZR = root.AZEvent;
          var d2r = liveMeteorDist2(AZR);
          var crr = visualContactRadiusI(AZR);
          if (crr > 0 && meteorPosIsFresh(AZR) && d2r < crr * crr * 0.25) fireFlash();
        }
      }
      else if (!meteorHitSent) { meteorHitSent = true; }
    });
  }
}

function dispose() {
  disposed = true;
  clearImpact();
  if (flashEl && flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
  flashEl = null;
  flashAge = -1;
  if (flashEl2 && flashEl2.parentNode) flashEl2.parentNode.removeChild(flashEl2); // v14
  flashEl2 = null; // v14
  flash2Fired = false; // v14
  flash2Age = -1; // v14
  if (afterEl && afterEl.parentNode) afterEl.parentNode.removeChild(afterEl); // v22
  afterEl = null; // v22
  afterAge = -1; afterKick = 0; // v22
  removeStyle();
  if (glowTex) glowTex.dispose();
  glowTex = null;
  if (heatTex) heatTex.dispose(); // v14
  heatTex = null; // v14
  heatC = null; // v14
  lowQ = false; // v14
  impactFired = false;
  meteorHitSent = false;
  flashFired = false;
  resetMeteorFreshness(); // v23 : base de fraîcheur réarmée
  rebreathFired = false; // v15
  rebreathAge = -1; // v15
  echoFired = false; // v15
  subSlamFired = false; // v21
  aftershockFired = false; rumbleFired = false; // v22
  impactT = 0;
  flashT = -1;
  _wob = null;
  api = null;
  bus = null;
  T = null;
  busBound = false;
  // Le bus n'expose pas forcément off() : les handlers restants sont
  // neutralisés par `disposed` et le test `root.AZEvent.active`.
}

root.AZEvent.register(MODULE, {
  init: init,
  update: update,
  dispose: dispose
});

})(window);
