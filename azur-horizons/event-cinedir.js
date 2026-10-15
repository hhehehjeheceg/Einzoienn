/* event-cinedir.js — MODULE "THE END" v10.2 : DIRECTEUR CINÉMATOGRAPHIQUE.
 * v10.2 : mode LIBRE par défaut PARTOUT (déclaration + init + dispose) —
 * le joueur joue, la cinématique est opt-in.
 * Groupe E (directeur cinématique NOUVEAU + audio + fx + hud).
 *
 * ÉVÉNEMENT JOUABLE : le joueur garde TOUJOURS le contrôle de son
 * personnage (bouger / sauter / planeur / construire), SANS DÉGÂTS, dans
 * les DEUX modes caméra. Ce module ne touche JAMAIS aux entrées ni au
 * personnage : il ne pilote que la caméra.
 *
 * Deux modes :
 *  - LIBRE (défaut v10.1, le joueur joue) : comportement v7, caméra 100 %
 *    joueur (le patch ne touche à rien) ;
 *  - CINÉ (opt-in, fidélité à l'original) : le directeur choisit les plans
 *    selon la phase (voir table SHOTS plus bas), avec transitions en fondu
 *    de position (ease in-out / smootherstep), jamais de coupure sèche
 *    sauf à l'impact ;
 * Bascule à tout moment via le bouton discret du HUD (event-hud.js) ou la
 * touche "C". Le directeur est la source de vérité : il émet
 * 'camera:mode' {mode:'cine'|'free'} à chaque changement et consomme
 * 'camera:mode:set' {mode} (bouton HUD).
 *
 * CHOIX D'ORIENTATION (documenté) : en CINÉ, les entrées de mouvement
 * s'appliquent au PERSONNAGE, inchangées — W = avant du personnage selon
 * son propre yaw, exactement comme en LIBRE (sim.js : forward(p.yaw)).
 * On ne réoriente PAS les touches vers la caméra : avec une caméra
 * cinématique découplée, un mapping "relatif caméra" serait désorientant
 * et casserait les réflexes du joueur. Le personnage reste donc pilotable
 * à l'identique dans les deux modes.
 *
 * Technique : patch de renderer.render (comme en v6), installé une fois à
 * l'init. Le wrapper n'agit que si l'event est actif, le mode est CINÉ, et
 * l'appel concerne la caméra/scène du jeu. La pose est calculée dans
 * preUpdate (AVANT la boucle du jeu) à partir de l'état live
 * (joueur, AZEvent.anchors['rocket1'..'rocket7'], AZEvent.meteorPos,
 * AZEvent.rifts, ancre 'blackhole') puis appliquée juste avant le rendu :
 * zéro frame de retard, et la mise à jour caméra du jeu (view.js) tourne
 * normalement avant — on la surcharge proprement, sans la casser.
 *
 * Secousses : répond au bus 'camera:shake' {force} (émis par
 * event-impact.js à l'impact — groupe B) ; repli : déclenchement sur
 * l'entrée en phase 'impact' (+ 'thrown', 'collapse', 'strike',
 * 'destruction'). Oscillation amortie (poids : forte secousse qui décroît).
 * Phases 21-22 ('blackhole', 'numbers') : caméra PARFAITEMENT STABLE
 * (pose figée, ni dérive ni secousse).
 *
 * Pilotage : AZEvent.state / tState / tTotal uniquement — JAMAIS de temps
 * absolus en dur (les bornes de TIMELINE ne sont pas modifiées).
 * Contrat : root.AZEvent.register('cinedir', {init, preUpdate, update, dispose}).
 */
(function (root) {
'use strict';
if (!root.AZEvent) return;
var AZE = root.AZEvent;

var MODE_CINE = 'cine';
var MODE_FREE = 'free';

/* ------------------------------------------------------------------ */
/* État local                                                           */
/* ------------------------------------------------------------------ */
var api = null;
var T = null;
var mode = MODE_FREE;          // v10.1 : LIBRE par défaut — le joueur joue ; CINÉ en opt-in (bouton/touche C)
var disposed = false;
var busBound = false;

// --- patch du rendu ---
var origRender = null;
var renderPatched = false;

// --- pose caméra (Vector3 alloués à l'init, zéro alloc par frame) ---
var curPos = null, curTgt = null;       // pose appliquée (blend ease in-out)
var trackPos = null, trackTgt = null;   // suivi amorti du plan (lag ciné)
var wantPos = null, wantTgt = null;     // cible brute du plan courant
var fromPos = null, fromTgt = null;     // départ de la transition
var _v1 = null, _v2 = null, _v3 = null; // temporaires

var shotId = '';               // identifiant du plan courant
var blend = 1;                 // 0..1 : progression de la transition
var fastCut = false;          // v20 : coupe rapide d'impact (meteor:hit) — blend accéléré à 0,35 s
var transDur = 1.6;            // durée de la transition (s)
var trackLambda = 3;           // amortissement du suivi (1/s)
var locked = false;            // phases 21-22 : pose figée
var lastPhase = '';
var driftT = 0;

// --- secousse : oscillation amortie ---
var shAmp = 0;                 // amplitude (mètres, à force 1)
var shDur = 1;
var shT = 1e9;
var SHAKE_M = 9;               // mètres d'amplitude pour force = 1

/* ------------------------------------------------------------------ */
/* Utilitaires                                                           */
/* ------------------------------------------------------------------ */
function smootherstep(x) {
  x = x < 0 ? 0 : (x > 1 ? 1 : x);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function center() { return (api && api.center) ? api.center : { x: 0, y: 30, z: 0 }; }

// Joueur local vivant (repli : premier non-bot vivant non caché).
function playerInto(out) {
  var p = null;
  try { p = api.player(); } catch (e) { p = null; }
  if (!p || p.bot || !p.alive || p._eventHidden) {
    p = null;
    var ps = [];
    try { ps = api.players() || []; } catch (e) { ps = []; }
    for (var i = 0; i < ps.length; i++) {
      var q = ps[i];
      if (q && !q.bot && q.alive && !q._eventHidden && typeof q.x === 'number') { p = q; break; }
    }
  }
  if (p && typeof p.x === 'number') { out.set(p.x, p.y, p.z); return true; }
  return false;
}

function rocketInto(i, out) {
  var A = AZE.anchors;
  var a = A && A['rocket' + i];
  if (a && typeof a.x === 'number') { out.set(a.x, a.y, a.z); return true; }
  return false;
}

function meteorInto(out) {
  var m = AZE.meteorPos;
  if (m && typeof m.x === 'number') { out.set(m.x, m.y, m.z); return true; }
  var c = center();
  out.set(c.x + 420, 780, c.z + 420); // repli (miroir de event-meteor.js)
  return false;
}

function holeInto(out) {
  var A = AZE.anchors || {};
  var b = A.blackhole;
  if (b && typeof b.x === 'number') { out.set(b.x, b.y, b.z); return true; }
  var c = center();
  out.set(c.x, c.y + 150, c.z); // repli
  return false;
}

// Première faille ouverte (repli : météorite).
function riftInto(out) {
  var rs = AZE.rifts || [];
  for (var i = 0; i < rs.length; i++) {
    var r = rs[i];
    if (r && r.pos && typeof r.pos.x === 'number' && r.open !== false) {
      out.set(r.pos.x, r.pos.y, r.pos.z);
      return true;
    }
  }
  return meteorInto(out);
}

/* ------------------------------------------------------------------ */
/* Secousses                                                             */
/* ------------------------------------------------------------------ */
function addShake(force, dur) {
  var st = AZE.state;
  // Phases 21-22 + finale : caméra PARFAITEMENT STABLE, aucune secousse.
  if (st === 'blackhole' || st === 'numbers' || st === 'end') return;
  force = clamp(typeof force === 'number' && isFinite(force) ? force : 0.5, 0, 2);
  var remain = shT < shDur ? shAmp * (1 - shT / shDur) : 0;
  shAmp = Math.max(remain, force * SHAKE_M);
  shT = 0;
  shDur = dur > 0 ? dur : 1.6;
}

function updateShake(dt) {
  if (shT < shDur) shT += dt;
}

/* ------------------------------------------------------------------ */
/* Plans par phase (SHOTS)                                               */
/* Chaque plan : id, pos/tgt (remplis dans wantPos/wantTgt), lambda      */
/* (vitesse du suivi amorti), trans (durée du fondu de position),       */
/* lock (phases 21-22 : figé), drift (travelling vivant, 0 = aucun).     */
/* ------------------------------------------------------------------ */
function computeShot(st, dt) {
  var c = center();
  var hasP = playerInto(_v3);

  switch (st) {
    // --- Ph1 : lancement fusée — large sur la base ---
    case 'countdown': {
      if (!rocketInto(1, _v1)) _v1.set(c.x, c.y + 40, c.z);
      wantPos.set(c.x + 150, c.y + 95, c.z + 200);
      wantTgt.copy(_v1);
      return { id: 'countdown', lambda: 2, trans: 2.0, drift: 0.7 };
    }
    // --- Ph2 : la fusée décolle — suivi ---
    case 'firstrocket': {
      if (!rocketInto(1, _v1)) _v1.set(c.x, c.y + 200, c.z);
      wantPos.set(_v1.x + 70, _v1.y + 30, _v1.z + 70);
      wantTgt.copy(_v1);
      return { id: 'firstrocket', lambda: 5, trans: 1.6, drift: 0.5 };
    }
    // --- Ph3 [40,62] : 5 vues en cycle ~4 s, mouvements vivants ---
    case 'sixrockets': {
      var vi = Math.floor(AZE.tState / 4) % 5;
      var rk = 1 + (Math.floor(AZE.tState / 4) % 7);
      var id = 'sixrockets:v' + vi;
      if (vi === 0) {
        // vue 1/5 : TRÈS LARGE — plusieurs fusées dans le champ
        wantPos.set(c.x + 300, c.y + 220, c.z + 300);
        wantTgt.set(c.x, c.y + 260, c.z);
        return { id: id, lambda: 2, trans: 1.4, drift: 1.0 };
      } else if (vi === 1) {
        // vue 2/5 : SUIVI d'une fusée (travelling latéral)
        if (!rocketInto(rk, _v1)) _v1.set(c.x, c.y + 300, c.z);
        _v2.set(_v1.x - c.x, 0, _v1.z - c.z);
        if (_v2.lengthSq() > 1) _v2.normalize(); else _v2.set(1, 0, 0);
        wantPos.set(_v1.x - _v2.z * 75, _v1.y + 22, _v1.z + _v2.x * 75);
        wantTgt.copy(_v1);
        return { id: id, lambda: 6, trans: 1.2, drift: 0.4 };
      } else if (vi === 2) {
        // vue 3/5 : DEPUIS LE SOL — contre-plongée vers le ciel
        if (!rocketInto(((rk + 2) % 7) + 1, _v1)) _v1.set(c.x, c.y + 400, c.z);
        wantPos.set(c.x + 90, c.y + 14, c.z + 60);
        wantTgt.copy(_v1);
        return { id: id, lambda: 2.5, trans: 1.4, drift: 0.6 };
      } else if (vi === 3 || vi === 4) {
        // vues 4-5/5 : VERS LE CIEL — trajectoires qui se croisent
        var ra = (vi === 3) ? 2 : 5, rb = (vi === 3) ? 4 : 7;
        var oka = rocketInto(ra, _v1), okb = rocketInto(rb, _v2);
        if (oka && okb) {
          wantTgt.set((_v1.x + _v2.x) / 2, (_v1.y + _v2.y) / 2 + 60, (_v1.z + _v2.z) / 2);
        } else {
          wantTgt.set(c.x, c.y + 350, c.z);
        }
        if (vi === 3) wantPos.set(c.x - 160, c.y + 130, c.z + 190);
        else wantPos.set(c.x + 200, c.y + 160, c.z - 140);
        return { id: id, lambda: 3, trans: 1.4, drift: 0.9 };
      }
      break;
    }
    // --- Ph4 : zone météorite / première faille ---
    case 'convergence': {
      riftInto(_v1);
      wantPos.set(c.x + 200, c.y + 150, c.z - 200);
      wantTgt.copy(_v1);
      return { id: 'convergence', lambda: 2, trans: 1.8, drift: 0.8 };
    }
    // --- Ph5 : orbite lente autour des failles ---
    case 'loop': {
      var ang = driftT * 0.06;
      wantPos.set(c.x + Math.cos(ang) * 320, c.y + 210, c.z + Math.sin(ang) * 320);
      wantTgt.set(c.x, c.y + 200, c.z);
      return { id: 'loop', lambda: 2, trans: 1.8, drift: 0.5 };
    }
    // --- Ph6 : coupes dynamiques entre fusées ---
    case 'acceleration': {
      var rk2 = 1 + (Math.floor(AZE.tState / 3) % 7);
      if (!rocketInto(rk2, _v1)) _v1.set(c.x, c.y + 300, c.z);
      wantPos.set(_v1.x + 85, _v1.y + 30, _v1.z - 60);
      wantTgt.copy(_v1);
      return { id: 'acceleration:' + rk2, lambda: 6, trans: 1.0, drift: 0.4 };
    }
    // --- Ph7 : calme — large bas sur l'île ---
    case 'silence': {
      wantPos.set(c.x + 130, c.y + 70, c.z + 130);
      wantTgt.set(c.x, c.y + 90, c.z);
      return { id: 'silence', lambda: 1.5, trans: 2.0, drift: 0.5 };
    }
    // --- Ph8 : la météorite plonge — suivi ---
    case 'strike': {
      meteorInto(_v1);
      wantPos.set(_v1.x + 200, _v1.y + 80, _v1.z + 200);
      wantTgt.copy(_v1);
      return { id: 'strike', lambda: 5, trans: 1.4, drift: 0.5 };
    }
    // --- Ph9 : SUIVI du joueur projeté (smooth follow, léger retard) ---
    case 'thrown': {
      if (!hasP) return null;
      wantPos.set(_v3.x - 42, _v3.y + 24, _v3.z - 42);
      wantTgt.set(_v3.x, _v3.y + 10, _v3.z);
      return { id: 'thrown', lambda: 3.2, trans: 1.2, drift: 0.3 };
    }
    // --- Ph10 : la GRANDE faille — large ---
    case 'greatrift': {
      meteorInto(_v1); // la grande faille s'ouvre devant la météorite
      wantPos.set(_v1.x + 230, _v1.y + 130, _v1.z + 230);
      wantTgt.copy(_v1);
      return { id: 'greatrift', lambda: 2.5, trans: 1.6, drift: 0.7 };
    }
    // --- Ph11 : descente de la météorite ---
    case 'meteorsix': {
      meteorInto(_v1);
      wantPos.set(_v1.x + 260, _v1.y + 120, _v1.z + 260);
      wantTgt.copy(_v1);
      return { id: 'meteorsix', lambda: 4, trans: 1.6, drift: 0.6 };
    }
    // --- Ph12 : contre-plongée — météorite + lasers ---
    case 'descent': {
      meteorInto(_v1);
      wantPos.set(c.x + 140, c.y + 18, c.z + 140);
      wantTgt.copy(_v1);
      return { id: 'descent', lambda: 2.5, trans: 1.6, drift: 0.5 };
    }
    // --- Ph13 : joueur projeté vers le haut — suivi (comme Ph9) ---
    // v20 : DÉRIVE RELEVÉE — la caméra MONTE avec le joueur projeté (+90 m
    // de dérive verticale progressive sur la phase) : le plan s'élève avec
    // la propulsion au lieu de rester collé au sol. CINÉ uniquement.
    case 'veeroff': {
      if (!hasP) return null;
      var rise = Math.min(1, (AZE.tState || 0) / 6) * 90;
      wantPos.set(_v3.x - 46, _v3.y + 26 + rise, _v3.z - 46);
      wantTgt.set(_v3.x, _v3.y + 8 + rise * 0.5, _v3.z);
      return { id: 'veeroff', lambda: 3.2, trans: 1.2, drift: 0.3 };
    }
    // --- Ph14 : TRÈS LARGE sur l'île (+ grosse secousse) ---
    case 'impact': {
      wantPos.set(c.x + 560, c.y + 340, c.z + 560);
      wantTgt.set(c.x, c.y + 60, c.z);
      return { id: 'impact', lambda: 1.5, trans: 2.0, drift: 0.4 };
    }
    // --- Ph15 : resserrement sur le Point Zéro ---
    case 'contraction': {
      wantPos.set(c.x + 170, c.y + 130, c.z + 170);
      wantTgt.set(c.x, c.y + 50, c.z);
      return { id: 'contraction', lambda: 2, trans: 1.4, drift: 0.3 };
    }
    // --- Ph16 : formation du trou noir — large ---
    case 'collapse': {
      holeInto(_v1);
      wantPos.set(c.x + 400, c.y + 270, c.z + 400);
      wantTgt.copy(_v1);
      return { id: 'collapse', lambda: 2, trans: 1.6, drift: 0.6 };
    }
    // --- Ph17 : le trou noir grandit — resserrement lent ---
    case 'growth': {
      holeInto(_v1);
      wantPos.set(_v1.x + 330, _v1.y + 180, _v1.z + 330);
      wantTgt.copy(_v1);
      return { id: 'growth', lambda: 2, trans: 1.8, drift: 0.4 };
    }
    // --- Ph18 : large sur l'île / destruction ---
    case 'destruction': {
      wantPos.set(c.x + 480, c.y + 320, c.z + 480);
      wantTgt.set(c.x, c.y + 80, c.z);
      return { id: 'destruction', lambda: 1.5, trans: 1.8, drift: 0.5 };
    }
    // --- Ph19 : SUIVI du joueur aspiré (smooth follow, léger retard) ---
    case 'playersucked': {
      if (!hasP) return null;
      wantPos.set(_v3.x - 40, _v3.y + 22, _v3.z - 40);
      wantTgt.set(_v3.x, _v3.y + 12, _v3.z);
      return { id: 'playersucked', lambda: 3.0, trans: 1.2, drift: 0.3 };
    }
    // --- Ph20 : RECUL — tout disparaît ---
    case 'allgone': {
      wantPos.set(c.x + 650, c.y + 400, c.z + 650);
      wantTgt.set(c.x, c.y + 100, c.z);
      return { id: 'allgone', lambda: 1.5, trans: 2.0, drift: 0.3 };
    }
    // --- Ph21-22 : PARFAITEMENT STABLE — pose figée sur le trou noir ---
    case 'blackhole':
    case 'numbers': {
      holeInto(_v1);
      wantPos.set(_v1.x, _v1.y + 120, _v1.z + 430);
      wantTgt.copy(_v1);
      return { id: 'blackhole-lock', lambda: 4, trans: 1.2, drift: 0, lock: true };
    }
    // --- Finale : on garde la dernière pose stable (écran noir de toute façon) ---
    case 'end': {
      return { id: 'end-lock', lambda: 4, trans: 1.0, drift: 0, lock: true, hold: true };
    }
    default:
      return null;
  }
  return null;
}

// Dérive vivante : léger travelling permanent (pas de plans figés).
function addDrift(out, amp) {
  if (!amp) return;
  out.x += Math.sin(driftT * 0.23) * 10 * amp;
  out.y += Math.sin(driftT * 0.31 + 1.3) * 5 * amp;
  out.z += Math.cos(driftT * 0.19 + 0.5) * 10 * amp;
}

// Cœur du directeur : exécuté dans preUpdate, AVANT la boucle du jeu.
function updateDirector(dt) {
  var st = AZE.state || '';
  var s = computeShot(st, dt);
  if (!s) return; // état inconnu : on garde la pose (pas de saut)
  if (s.id !== shotId) {
    // Nouveau plan : transition en FONDU DE POSITION (ease in-out),
    // jamais de coupure sèche (sauf secousse d'impact, séparée).
    fromPos.copy(curPos);
    fromTgt.copy(curTgt);
    shotId = s.id;
    blend = 0;
    // v20 : coupe rapide d'impact — le passage au plan d'impact claque
    // (0,35 s) au lieu du fondu lent : le contact se voit NET.
    if (fastCut) { transDur = 0.35; fastCut = false; }
    else transDur = s.trans || 1.6;
    trackLambda = s.lambda || 3;
    locked = !!s.lock;
    // Le suivi repart de la pose courante : pas de saut à la reprise.
    trackPos.copy(curPos);
    trackTgt.copy(curTgt);
    // 'end' : on fige sur place (hold).
    if (s.hold) {
      wantPos.copy(curPos);
      wantTgt.copy(curTgt);
    }
  }
  if (!s.hold) {
    // Dérive vivante sauf plans verrouillés (Ph21-22 : stabilité parfaite).
    if (!locked) addDrift(wantPos, s.drift);
    // Suivi amorti : lag cinématographique, fluide.
    var k = 1 - Math.exp(-dt * trackLambda);
    trackPos.lerp(wantPos, k);
    trackTgt.lerp(wantTgt, k);
  }
  if (blend < 1) {
    blend = Math.min(1, blend + dt / transDur);
    var e = smootherstep(blend); // ease in-out
    curPos.lerpVectors(fromPos, trackPos, e);
    curTgt.lerpVectors(fromTgt, trackTgt, e);
  } else {
    curPos.copy(trackPos);
    curTgt.copy(trackTgt);
  }
  // Plans verrouillés (Ph21-22) : une fois la transition terminée, la pose
  // est FIGÉE sur la cible (stabilité parfaite, pas de queue exponentielle).
  if (locked && blend >= 1 && !s.hold) {
    curPos.copy(wantPos);
    curTgt.copy(wantTgt);
  }
}

// Appliquée dans le wrapper de renderer.render, JUSTE AVANT le rendu.
function applyCineCamera(camera) {
  _v1.copy(curPos);
  _v2.copy(curTgt);
  // Secousse : oscillation amortie (poids : forte puis décroît).
  if (shT < shDur) {
    var kk = shT / shDur;
    var env = shAmp * Math.exp(-3.0 * kk) * (1 - kk);
    var w = Math.PI * 2;
    _v1.x += env * (Math.sin(w * 23 * shT) + 0.55 * Math.sin(w * 41 * shT + 1.7));
    _v1.y += env * 0.7 * (Math.sin(w * 19 * shT + 0.6) + 0.55 * Math.sin(w * 47 * shT + 2.9));
    _v1.z += env * (Math.cos(w * 21 * shT + 1.1) + 0.55 * Math.sin(w * 43 * shT + 0.4));
    _v2.x += env * 0.35 * Math.sin(w * 29 * shT + 2.2);
    _v2.y += env * 0.3 * Math.sin(w * 31 * shT + 0.9);
  }
  camera.position.copy(_v1);
  camera.lookAt(_v2);
}

/* ------------------------------------------------------------------ */
/* Patch du rendu (même technique qu'en v6)                             */
/* ------------------------------------------------------------------ */
function wrappedRender(scene, camera) {
  try {
    if (!disposed && AZE.active && mode === MODE_CINE && api &&
        camera && scene && api.camera() && api.scene() &&
        camera === api.camera() && scene === api.scene()) {
      applyCineCamera(camera);
    }
  } catch (e) { /* le rendu d'origine ne doit jamais casser */ }
  return origRender.apply(this, arguments);
}

function patchRender() {
  var r = null;
  try { r = api.renderer(); } catch (e) { r = null; }
  if (!r || typeof r.render !== 'function') return;
  if (r.render === wrappedRender) { renderPatched = true; return; } // déjà patché
  origRender = r.render;
  r.render = wrappedRender;
  renderPatched = true;
}

function unpatchRender() {
  var r = null;
  try { r = api ? api.renderer() : null; } catch (e) { r = null; }
  if (r && origRender && r.render === wrappedRender) {
    try { r.render = origRender; } catch (e) { /* ignore */ }
  }
  origRender = null;
  renderPatched = false;
}

/* ------------------------------------------------------------------ */
/* Modes CINÉ / LIBRE                                                    */
/* ------------------------------------------------------------------ */
function syncFromGame() {
  var cam = null;
  try { cam = api.camera(); } catch (e) { cam = null; }
  if (!cam) return;
  curPos.copy(cam.position);
  trackPos.copy(cam.position);
  wantPos.copy(cam.position);
  fromPos.copy(cam.position);
  cam.getWorldDirection(_v1);
  _v1.multiplyScalar(140).add(cam.position);
  curTgt.copy(_v1);
  trackTgt.copy(_v1);
  wantTgt.copy(_v1);
  fromTgt.copy(_v1);
  blend = 1;
  shotId = ''; // le plan courant se réinstallera en fondu
}

function setMode(m) {
  if (m !== MODE_CINE && m !== MODE_FREE) return;
  if (mode === m || disposed) return;
  mode = m;
  if (m === MODE_CINE) syncFromGame(); // pas de saut en revenant en CINÉ
  try { AZE.emit('camera:mode', { mode: mode }); } catch (e) { /* ignore */ }
}

function onKey(e) {
  if (disposed || !AZE.active) return;
  try {
    var ae = root.document && root.document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  } catch (err) { /* ignore */ }
  var k = e && e.key;
  if (k === 'c' || k === 'C') {
    setMode(mode === MODE_CINE ? MODE_FREE : MODE_CINE);
  }
}

/* ------------------------------------------------------------------ */
/* Entrées de phase (secousses de repli)                                 */
/* ------------------------------------------------------------------ */
function onPhaseEnter(st) {
  if (st === 'impact') addShake(1.0, 2.4);       // TREMBLEMENT FORT
  else if (st === 'thrown') addShake(0.35, 1.2);
  else if (st === 'collapse') addShake(0.5, 1.6);
  else if (st === 'destruction') addShake(0.4, 1.4);
  else if (st === 'strike') addShake(0.25, 1.0);
}

/* ------------------------------------------------------------------ */
/* Bus                                                                    */
/* ------------------------------------------------------------------ */
function bindBusOnce() {
  if (busBound) return;
  busBound = true;
  // 'camera:shake' {force} — émis par event-impact.js (groupe B) à l'impact.
  AZE.on('camera:shake', function (d) {
    if (disposed || !AZE.active) return;
    var f = (d && typeof d.force === 'number' && isFinite(d.force)) ? d.force : 0.5;
    addShake(f, 1.6 + f);
  });
  // Bascule demandée par le bouton HUD (event-hud.js).
  AZE.on('camera:mode:set', function (d) {
    if (disposed || !AZE.active) return;
    var m = d && d.mode;
    if (m === 'cine' || m === 'free') setMode(m);
  });
  // L'impact réel de la météorite renforce la secousse (poids).
  // v20 : COUPE RAPIDE D'IMPACT — la caméra COUPE net sur le plan d'impact
  // (blend 0,35 s au lieu du fondu lent de 2 s) : le contact se voit NET,
  // pas dissous. CINÉ uniquement (opt-in) — la caméra libre n'est pas touchée.
  AZE.on('meteor:hit', function () {
    if (disposed || !AZE.active) return;
    if (AZE.state === 'impact') {
      addShake(0.8, 2.0);
      fastCut = true;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                           */
/* ------------------------------------------------------------------ */
function init(a) {
  api = a;
  T = a.T;
  disposed = false;
  mode = MODE_FREE; // v10.1 : LIBRE par défaut — le joueur joue
  if (!curPos) {
    curPos = new T.Vector3(); curTgt = new T.Vector3();
    trackPos = new T.Vector3(); trackTgt = new T.Vector3();
    wantPos = new T.Vector3(); wantTgt = new T.Vector3();
    fromPos = new T.Vector3(); fromTgt = new T.Vector3();
    _v1 = new T.Vector3(); _v2 = new T.Vector3(); _v3 = new T.Vector3();
  }
  shotId = '';
  blend = 1;
  locked = false;
  lastPhase = '';
  driftT = 0;
  shAmp = 0; shT = 1e9; shDur = 1;
  syncFromGame(); // départ = pose caméra du jeu (aucun saut)
  patchRender();
  bindBusOnce();
  if (!init._keyBound) {
    init._keyBound = true;
    try { root.addEventListener('keydown', onKey); } catch (e) { /* ignore */ }
  }
  try { AZE.emit('camera:mode', { mode: mode }); } catch (e) { /* ignore */ }
}

function preUpdate(dt) {
  if (disposed || !api || !AZE.active) return;
  if (!(dt > 0)) return;
  var st = AZE.state || '';
  if (st !== lastPhase) { onPhaseEnter(st); lastPhase = st; }
  driftT += dt;
  updateShake(dt);
  if (mode === MODE_CINE) updateDirector(dt);
}

function update() { /* tout se joue dans preUpdate + le wrapper de rendu */ }

function dispose() {
  disposed = true;
  unpatchRender();
  try { root.removeEventListener('keydown', onKey); } catch (e) { /* ignore */ }
  init._keyBound = false;
  api = null;
  T = null;
  mode = MODE_FREE;
  shotId = '';
}

// Source de vérité exposée dès le chargement du script (le HUD s'y fie).
AZE.cineMode = function () { return mode; };
AZE.setCineMode = setMode;

AZE.register('cinedir', {
  init: init,
  preUpdate: preUpdate,
  update: update,
  dispose: dispose
});

})(window);
