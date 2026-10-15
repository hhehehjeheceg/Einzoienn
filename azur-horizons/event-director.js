/* AZUR v67 — THE END · caméra assistée.
 * Pendant l'événement, la caméra se tourne doucement vers ce qui se passe
 * (Point Zéro, fusées, météorite, faille) dès que le joueur ne la manipule
 * pas lui-même depuis 2,5 s. Quand le joueur est projeté dans les airs
 * (souffle, suspension, aspiration), l'assistance est plus ferme.
 * Toucher la souris, l'écran ou la manette rend aussitôt la main.
 * Aux grands moments (frappe, projection, impact, destruction), l'image passe
 * en mode cinéma : bandes noires et HUD secondaire effacé. */
(function (root) {
  'use strict';
  var E = root.AZEvent, T = root.THREE;
  if (!E || !T) return;
  var userAt = -1e9, hooked = null, previousLook = null, assist = 0;
  var focus = new T.Vector3(), tmp = new T.Vector3();
  var AIR = { thrown: 1, suspend: 1, veer: 1, blast: 1, drift: 1, suck: 1, zeroshock: 1 };
  var ROCKETS = { firstrocket: 1, sixrockets: 1 };
  var METEOR = { convergence: 1, loop: 1, acceleration: 1, silence: 1, strike: 1, thrown: 1, greatrift: 1, meteorsix: 1, descent: 1, veeroff: 1 };
  var ZERO = { countdown: 1, impact: 1, contraction: 1, collapse: 1, growth: 1, destruction: 1, playersucked: 1 };

  function hook(game) {
    if (!game || hooked === game || typeof game.look !== 'function') return;
    previousLook = game.look; hooked = game;
    game.look = function (dx, dy) { if (Math.abs(dx) + Math.abs(dy) > .5) userAt = performance.now(); return previousLook.apply(this, arguments); };
  }
  function unhook() { if (hooked && previousLook) hooked.look = previousLook; hooked = null; previousLook = null; }

  function worldPos(obj, out) { if (!obj) return false; obj.updateWorldMatrix(true, false); out.setFromMatrixPosition(obj.matrixWorld); return true; }
  function pickFocus(state) {
    var v = E.eventVisuals || {};
    if (ROCKETS[state] && v.rockets && v.rockets.length) {
      var n = 0; focus.set(0, 0, 0);
      for (var i = 0; i < v.rockets.length; i++) { var r = v.rockets[i]; if (r && r.group && r.group.visible && r.group.parent && worldPos(r.group, tmp)) { focus.add(tmp); n++; } }
      if (n) { focus.multiplyScalar(1 / n); return true; }
    }
    if ((METEOR[state] || ROCKETS[state]) && v.meteor && v.meteor.group && v.meteor.group.visible && worldPos(v.meteor.group, focus)) return true;
    if (METEOR[state] && E.meteorPos) { focus.copy(E.meteorPos); return true; }
    if ((ZERO[state] || ROCKETS[state] || METEOR[state]) && E.zeroPointPos) { focus.copy(E.zeroPointPos); if (state === 'countdown') focus.y += 20; return true; }
    return false;
  }
  var wrap = function (a) { return Math.atan2(Math.sin(a), Math.cos(a)); };

  var bars = null, cine = false;
  var CINE = { strike: 1, thrown: 1, greatrift: 1, veeroff: 1, collapse: 1, growth: 1, destruction: 1, playersucked: 1 };
  function setCine(on) {
    if (on === cine) return; cine = on;
    if (!bars) { bars = document.createElement('div'); bars.className = 'v67-letterbox'; bars.innerHTML = '<i></i><i></i>'; bars.setAttribute('aria-hidden', 'true'); document.body.appendChild(bars); }
    document.body.classList.toggle('v67-cine', on);
  }
  function update(dt) {
    var game = root.AZUR; hook(game);
    var st = E.state, md = E.playerInfo && E.playerInfo.mode;
    setCine(!!(CINE[st] || (st === 'impact' && E.tState < 14) || (md && AIR[md] && md !== 'drift')));
    if (!game || game.screen !== 'game' || game.paused || game.modal || game.editing) return;
    var p = game.player && game.player(); if (!p || !p.alive) return;
    var w = game.world; if (w && w.phase === 'transport' && !p.deployed) return;
    var mode = E.playerInfo && E.playerInfo.mode, air = !!AIR[mode], state = E.state;
    if (state === 'blackhole' || state === 'numbers' || state === 'allgone' || state === 'end') return;
    if (p._meteorRide || (E.riftWorld && E.riftWorld.active)) return;
    // Caméra plus reculée au sol pendant les grandes phases (on voit par-dessus les toits).
    var zoomGoal = !air && !game.aim && state !== 'countdown' ? 2.1 : 1;
    E.cameraZoom = (E.cameraZoom || 1) + (zoomGoal - (E.cameraZoom || 1)) * (1 - Math.exp(-dt * 1.2));
    var idle = (performance.now() - userAt) / 1000;
    var wantAssist = air ? (idle > 1.2 ? 1 : 0) : (idle > 2.5 && !game.fire && !game.aim && !game.buildType ? 1 : 0);
    assist += (wantAssist - assist) * (1 - Math.exp(-dt * 2.5));
    if (assist < .02 || !pickFocus(state)) return;
    var dx = focus.x - p.x, dy = focus.y - (p.y + 1.6), dz = focus.z - p.z, flat = Math.hypot(dx, dz);
    if (flat < 2 && Math.abs(dy) < 2) return;
    var yaw = Math.atan2(-dx, -dz);
    // Le joueur reste dans le bas de l'image : on vise un peu au-dessus de la cible.
    var pitch = Math.max(-1.1, Math.min(1.12, Math.atan2(dy, Math.max(1, flat)) + .1));
    var rate = (air ? 2.6 : 1.4) * assist, k = 1 - Math.exp(-dt * rate);
    game.yaw += wrap(yaw - game.yaw) * k;
    game.pitch += (pitch - game.pitch) * k;
  }
  function dispose() { E.cameraZoom = 1; unhook(); setCine(false); if (bars) { bars.remove(); bars = null; } }
  E.register('director', { init: function () { userAt = -1e9; assist = 0; hook(root.AZUR); }, update: update, dispose: dispose });
})(window);
