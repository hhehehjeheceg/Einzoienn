/* event-animation.js — THE END : le personnage VIT l'événement.
 * Couche d'animation posée par-dessus toutes les autres (y compris la nage
 * d'event-player.js), uniquement pour le joueur local et seulement pendant
 * l'event :
 *  - REGARD : la tête (puis le buste) suit ce qui se passe dans le ciel —
 *    la météorite figée, la fusée qui décolle, le Point Zéro, le trou noir ;
 *  - SOUFFLE : à chaque projection (onde de choc, évacuation, impact) le
 *    corps est cueilli — bras rejetés, dos cambré, salto arrière amorti —
 *    avant de retomber en douceur dans la nage aérienne ;
 *  - DÉRIVE : attiré vers le centre, le personnage résiste, penché en
 *    arrière, bras tendus pour se protéger de la lumière ;
 *  - ASPIRATION : il perd pied et part en vrille, bras tendus vers le haut,
 *    jambes qui battent dans le vide.
 * Uniquement des rotations du squelette existant : aucun maillage ajouté. */
(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;

var api = null, view = null, previous = null, wrapper = null;
var lastMode = 'none', modeSince = 0, spinAngle = 0, blastAt = -99, blastPow = 0;
var target = new T.Vector3(), headPos = new T.Vector3(), localDir = new T.Vector3(), inverse = new T.Quaternion();
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var smooth = function (v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
var damp = function (rate, dt) { return 1 - Math.exp(-rate * dt); };
var BLAST = { thrown: 1, zeroshock: 1.15, veer: 0.9, blast: 1.35 };

/* Ce qu'un spectateur regarderait à cet instant précis de l'event. */
function lookTarget(out) {
  var s = E.state, a = E.anchors || {};
  if (s === 'firstrocket' && a.rocket1) return out.copy(a.rocket1);
  if ((s === 'countdown' || s === 'sixrockets' || s === 'convergence' || s === 'loop' || s === 'acceleration') && E.meteorVisible && E.meteorPos) return out.copy(E.meteorPos);
  if ((s === 'greatrift' || s === 'meteorsix' || s === 'descent' || s === 'veeroff' || s === 'impact') && E.meteorVisible && E.meteorPos) return out.copy(E.meteorPos);
  if (a.blackhole && (s === 'growth' || s === 'destruction' || s === 'playersucked')) return out.copy(a.blackhole);
  if (E.zeroPointPos) return out.copy(E.zeroPointPos);
  return null;
}

function pose(model, player, dt) {
  var u = model.userData, info = E.playerInfo || {}, mode = info.mode || 'none', t = E.tTotal;
  if (!u || !u.limbs || !u.knees || !u.elbows || !u.torso || !u.head) return;
  if (mode !== lastMode) { lastMode = mode; modeSince = t; if (BLAST[mode]) { blastAt = t; blastPow = BLAST[mode]; } }
  var age = t - modeSince;
  u.evW = u.evW || { hx: 0, hy: 0, blast: 0, drift: 0, suck: 0 };
  var w = u.evW;

  // 1. Regard vers l'action (désactivé sur la météorite et pendant l'aspiration).
  var wantLook = !player._meteorRide && mode !== 'suck' && !player.emote;
  var hy = 0, hx = 0;
  if (wantLook && lookTarget(target)) {
    headPos.set(model.position.x, model.position.y + 1.7, model.position.z);
    localDir.subVectors(target, headPos);
    inverse.copy(model.quaternion).invert(); localDir.applyQuaternion(inverse);
    var flat = Math.hypot(localDir.x, localDir.z);
    hy = Math.atan2(-localDir.x, -localDir.z); hx = Math.atan2(localDir.y, Math.max(1e-3, flat));
    if (Math.abs(hy) > 2.3) { hy = 0; hx *= 0.4; } // cible dans le dos : on ne se tord pas le cou
  }
  w.hy += (clamp(hy, -1.15, 1.15) - w.hy) * damp(3.2, dt);
  w.hx += (clamp(hx, -0.35, 0.95) - w.hx) * damp(3.2, dt);
  var headY = clamp(w.hy, -0.8, 0.8), bodyY = (w.hy - headY) * 0.6;
  u.head.rotation.y += headY; u.head.rotation.x += w.hx * 0.75;
  u.torso.rotation.y += bodyY; u.torso.rotation.x += w.hx * 0.14;

  // 2. Projection : enveloppe d'impact qui décroît en ~1,6 s.
  var since = t - blastAt, blastK = since >= 0 && since < 4 ? blastPow * Math.exp(-since * 2.2) * smooth(since / 0.08) : 0;
  w.blast += (blastK - w.blast) * damp(18, dt);
  if (w.blast > 0.01) {
    var b = Math.min(1, w.blast);
    u.limbs[1].rotation.x += (-2.7 - u.limbs[1].rotation.x) * b; u.limbs[1].rotation.z += (-0.95 - u.limbs[1].rotation.z) * b;
    u.limbs[3].rotation.x += (-2.5 - u.limbs[3].rotation.x) * b; u.limbs[3].rotation.z += (0.95 - u.limbs[3].rotation.z) * b;
    u.elbows[0].rotation.x += (-0.15 - u.elbows[0].rotation.x) * b; u.elbows[1].rotation.x += (-0.15 - u.elbows[1].rotation.x) * b;
    u.limbs[0].rotation.x += (0.75 - u.limbs[0].rotation.x) * b; u.limbs[2].rotation.x += (0.35 - u.limbs[2].rotation.x) * b;
    u.knees[0].rotation.x += (-1.1 - u.knees[0].rotation.x) * b; u.knees[1].rotation.x += (-0.6 - u.knees[1].rotation.x) * b;
    u.torso.rotation.x += 0.42 * b; u.head.rotation.x += 0.35 * b;
    // Salto arrière amorti : un tour partiel qui revient à plat.
    var flip = Math.sin(clamp(since / 1.5, 0, 1) * Math.PI) * 1.1 * Math.min(1, blastPow);
    model.rotation.x += flip;
  }

  // 3. Dérive vers le centre : on résiste, penché en arrière, bras en bouclier.
  var driftK = mode === 'drift' ? smooth(age / 1.2) : 0;
  w.drift += (driftK - w.drift) * damp(4, dt);
  if (w.drift > 0.01) {
    var d = w.drift, shiver = Math.sin(t * 23) * 0.04 * d;
    u.torso.rotation.x += 0.28 * d + shiver; u.head.rotation.x -= 0.18 * d;
    u.limbs[1].rotation.x += (-1.55 + Math.sin(t * 3.1) * 0.12 - u.limbs[1].rotation.x) * d * 0.85; u.limbs[1].rotation.z += (-0.25 - u.limbs[1].rotation.z) * d * 0.85;
    u.limbs[3].rotation.x += (-1.75 + Math.sin(t * 2.7 + 1) * 0.12 - u.limbs[3].rotation.x) * d * 0.85; u.limbs[3].rotation.z += (0.2 - u.limbs[3].rotation.z) * d * 0.85;
    u.elbows[0].rotation.x += (-0.85 - u.elbows[0].rotation.x) * d * 0.8; u.elbows[1].rotation.x += (-1.0 - u.elbows[1].rotation.x) * d * 0.8;
    u.limbs[0].rotation.x += Math.sin(t * 2.2) * 0.25 * d; u.limbs[2].rotation.x -= Math.sin(t * 2.2) * 0.25 * d;
  }

  // 4. Aspiration : vrille qui accélère, bras vers le haut, jambes qui battent.
  var suckK = mode === 'suck' ? smooth(age / 0.5) : 0;
  w.suck += (suckK - w.suck) * damp(6, dt);
  if (w.suck > 0.01) {
    var k = w.suck, rate = 2 + age * 4.5;
    spinAngle += dt * rate * k;
    u.limbs[1].rotation.set(-2.9 + Math.sin(t * 11) * 0.35, 0, -0.55 + Math.sin(t * 8.3) * 0.4);
    u.limbs[3].rotation.set(-2.7 + Math.sin(t * 10 + 2) * 0.35, 0, 0.55 + Math.sin(t * 7.7 + 1) * 0.4);
    u.elbows[0].rotation.x = -0.2 + Math.sin(t * 9) * 0.25; u.elbows[1].rotation.x = -0.2 + Math.sin(t * 9.5 + 1) * 0.25;
    u.limbs[0].rotation.x = Math.sin(t * 13) * 0.7; u.limbs[2].rotation.x = -Math.sin(t * 13) * 0.7;
    u.knees[0].rotation.x = -0.4 - Math.max(0, Math.sin(t * 13)) * 0.8; u.knees[1].rotation.x = -0.4 - Math.max(0, -Math.sin(t * 13)) * 0.8;
    u.torso.rotation.x += Math.sin(t * 4) * 0.15 * k; u.head.rotation.x += 0.3 * k;
    model.rotation.x += Math.sin(spinAngle * 0.7) * 0.9 * k;
    model.rotation.z += spinAngle * 0.6 * k;
  } else spinAngle = 0;
  if (u.gun) u.gun.visible = false;
}

function install() {
  view = api && api.view && api.view();
  if (!view || typeof view.animateAvatar !== 'function' || wrapper) return;
  previous = view.animateAvatar;
  wrapper = function (model, player, dt, options) {
    var r = previous.call(this, model, player, dt, options);
    if (E.active && options && options.local && model && player) {
      try { pose(model, player, Math.min(0.1, Math.max(0, dt || 0))); } catch (e) { /* jamais bloquant */ }
    }
    return r;
  };
  view.animateAvatar = wrapper;
}
function init(a) { api = a; lastMode = 'none'; modeSince = 0; spinAngle = 0; blastAt = -99; blastPow = 0; install(); }
function update() { if (!wrapper) install(); }
function dispose() {
  if (view && wrapper && view.animateAvatar === wrapper) view.animateAvatar = previous;
  view = previous = wrapper = null; api = null;
}
E.register('animation', { init: init, update: update, dispose: dispose });
})(window);
