/* AZUR v81 — THE END, refonte · le joueur LIBRE dans le film.
 *  - Le bus traverse l'île au-dessus de la colline de la vidéo pendant le
 *    compte à rebours ; le joueur saute quand il veut,
 *    la descente est guidée vers la colline s'il ne touche à rien.
 *    (v83 : le bus traverse toute l'île, largage auto seulement au bout, à T-4 s)
 *  - Déplacements libres pendant tout l'événement, sans dégâts.
 *  - Comme dans la vidéo : soufflé par l'impact (157 s) puis reposé au sol,
 *    soulevé par l'onde du Point Zéro (183 s) et laissé flotter bras écartés
 *    au-dessus de l'île, dérive puis aspiration dans le tourbillon (246 s),
 *    écran noir, trou noir, puis bouton de retour au salon.
 *  - Interface masquée pendant le spectacle (touche H pour l'afficher). */
(function (root) {
  'use strict';
  var E = root.AZEvent, T = root.THREE, L = root.AZEnd81;
  if (!E || !T || !L || !E.register) return;
  var U = L.u, cl = U.cl, sm = U.sm, ramp = U.ramp, win = U.win, lerp = U.lerp;
  var api = null, G = null, view = null, on = false, hudShown = false, styleEl = null, hintEl = null, endEl = null;
  var dmg = null, bot = null, animPrev = null, animWrap = null, hiddenBots = {}, busOwn = false, BUS_Y = 0, autoDropped = false;
  var st = { mode: 'none', float: 0, liftY: 0, hoverBase: 0, hidden: false, suckFrom: null, landedSeen: false, kick: -99 };
  var HIDE_Y = -10000, FAR = 1100; // v93 : au-delà, le trou noir n'aspire pas le joueur
  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 0; } }
  function S() { return L.S; }

  /* ---------------------------------------------------------- invulnérable */
  function wrapWorld(w) {
    if (!w) return;
    if (!dmg && typeof w._damage === 'function') { var real = w._damage; dmg = { w: w, real: real, fn: function () { if (E.active) return; return real.apply(this, arguments); } }; w._damage = dmg.fn; }
    if (!bot && typeof w._bot === 'function') {
      var rb = w._bot; bot = { w: w, real: rb, fn: function (p, dt) { if (E.active && p && p.bot) { p._input = { moveX: 0, moveZ: 0, yaw: p.yaw, pitch: p.pitch, fire: false, sprint: false, aim: false }; return; } return rb.call(this, p, dt); } }; w._bot = bot.fn;
    }
  }
  function unwrapWorld() {
    if (dmg && dmg.w._damage === dmg.fn) dmg.w._damage = dmg.real; dmg = null;
    if (bot && bot.w._bot === bot.fn) bot.w._bot = bot.real; bot = null;
  }

  /* -------------------------------------------------------------- le bus */
  /* v83 : le bus TRAVERSE TOUTE L'ÎLE pendant le compte à rebours, d'une côte à
   * l'autre en passant au-dessus du Point Zéro puis de la colline de la vidéo.
   * Le joueur saute quand il veut ; il n'est éjecté qu'au bout de la traversée
   * (juste après la colline), comme dans une vraie partie. */
  var ROUTE = null;
  function route() {
    if (ROUTE) return ROUTE;
    var s = S(), isl = E.end81 && E.end81.O && E.end81.O.isl, dx, dz, dl, D, A0, B0, deck = 0;
    if (isl) {
      // v93 : le bus passe juste au-dessus de l'île volante puis au-dessus de la colline — on peut sauter et s'y poser
      var I = isl.position; dx = s.P.x - I.x; dz = s.P.z - I.z; dl = Math.hypot(dx, dz) || 1; D = { x: dx / dl, z: dz / dl };
      A0 = { x: I.x - D.x * 620, z: I.z - D.z * 620 }; B0 = { x: s.P.x + D.x * 210, z: s.P.z + D.z * 210 }; deck = I.y + .08 * isl.scale.x;
    } else {
      dx = s.P.x; dz = s.P.z; dl = Math.hypot(dx, dz) || 1; D = { x: dx / dl, z: dz / dl };
      A0 = { x: -D.x * 840, z: -D.z * 840 }; B0 = { x: s.P.x + D.x * 210, z: s.P.z + D.z * 210 };
    }
    var len = Math.hypot(B0.x - A0.x, B0.z - A0.z), top = 0;
    for (var i = 0; i <= 40; i++) { var k = i / 40; top = Math.max(top, H(A0.x + (B0.x - A0.x) * k, A0.z + (B0.z - A0.z) * k)); }
    ROUTE = { D: D, A: A0, B: B0, len: len, y: Math.max(Math.max(top, 0) + 175, deck + 70), t0: -54, t1: -4 };
    return ROUTE;
  }
  /* v93 — ÉVÉNEMENT 2 « Vol sans fin » (w.eventVariant === 'flight') : le bus ne s'arrête jamais et
   * n'éjecte personne ; le joueur le CONDUIT comme une voiture volante tant qu'il est à bord :
   *   avancer (Z / joystick haut) = accélérer jusqu'à la vitesse max (30 m/s × réglage E.v93.busSpeed, ×1 à ×100),
   *   reculer (S) = freiner (il ne descend jamais sous sa vitesse de croisière), gauche/droite (Q/D) = tourner,
   *   E.v93.busClimb (+1 / −1 : touches R/F, flèches, boutons ▲▼) = monter / descendre (35 m au-dessus du sol → 1 800 m).
   * Sans commande il garde son cap et sa vitesse, aussi loin qu'on veut (pas de limite de carte).
   * La caméra suit le cap du bus (comme une caméra de poursuite) tant que le joueur ne la tourne pas. */
  var FB = null;
  function angDiff(a, b) { var d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
  function flightBus(t, w, p, dt) {
    var s = S(); if (!s || !s.P || !s.ZP) return;
    dt = Math.min(.1, Math.max(0, +dt || 0));
    if (!FB) {
      var C = { x: s.ZP.x, z: s.ZP.z }, Rr = Math.max(380, Math.hypot(s.P.x - C.x, s.P.z - C.z)), a0 = Math.atan2(s.P.z - C.z, s.P.x - C.x) - 2.2, top = 0;
      for (var i = 0; i < 48; i++) { var a = i / 48 * Math.PI * 2; top = Math.max(top, H(C.x + Math.cos(a) * Rr, C.z + Math.sin(a) * Rr)); }
      var isl = E.end81 && E.end81.O && E.end81.O.isl, deck = isl ? isl.position.y + .08 * isl.scale.x + 70 : 0;
      var tx0 = -Math.sin(a0), tz0 = Math.cos(a0);
      FB = { C: C, x: C.x + Math.cos(a0) * Rr, z: C.z + Math.sin(a0) * Rr, y: Math.max(Math.max(top, 0) + 175, deck), yaw: Math.atan2(-tx0, -tz0), speed: 0, roll: 0 };
    }
    var aboard = !!(p && !p.deployed), inp = (aboard && p._input) || {}, mx = +inp.moveX || 0, mz = +inp.moveZ || 0;
    var mult = Math.max(1, Math.min(100, +(E.v93 && E.v93.busSpeed) || 4)), vmax = 30 * mult, vmin = Math.min(25, vmax * .5);
    if (!FB.speed) FB.speed = vmax * .7;
    // gaz / frein, puis direction
    var target = mz > .15 ? vmax : mz < -.15 ? vmin : Math.min(FB.speed, vmax), acc = Math.max(30, vmax * .7) * (mz < -.15 ? 1.6 : 1);
    FB.speed += Math.max(-acc * dt, Math.min(acc * dt, target - FB.speed)); FB.speed = Math.max(vmin, FB.speed);
    var turn = (aboard ? mx : 0) * 1.25 / (1 + FB.speed / 600);
    FB.yaw -= turn * dt; FB.roll += ((-turn * .45) - FB.roll) * Math.min(1, dt * 4);
    FB.x += -Math.sin(FB.yaw) * FB.speed * dt; FB.z += -Math.cos(FB.yaw) * FB.speed * dt;
    // altitude
    var climb = aboard ? (+(E.v93 && E.v93.busClimb) || 0) : 0;
    FB.y += climb * (25 + FB.speed * .3) * dt;
    var ahead = Math.max(H(FB.x, FB.z), H(FB.x - Math.sin(FB.yaw) * 60, FB.z - Math.cos(FB.yaw) * 60), 0) + 35;
    FB.y = Math.min(1800, Math.max(ahead, FB.y));
    w._azBusOverride = { x: FB.x, y: FB.y, z: FB.z, yaw: FB.yaw, lockId: null, release: false }; busOwn = true; // release:false → pas d'éjection forcée
    if (w.aircraft) { w.aircraft.x = FB.x; w.aircraft.y = FB.y; w.aircraft.z = FB.z; w.aircraft.yaw = FB.yaw; w.aircraft.roll = FB.roll; }
    if (aboard) {
      p.x = FB.x; p.y = FB.y; p.z = FB.z;
      // caméra de poursuite : elle se recale derrière le bus si le joueur ne la tourne pas depuis 1,5 s
      if (G && VT() - steerUser > 1.5) G.yaw += angDiff(FB.yaw, G.yaw) * Math.min(1, dt * 2.2);
    }
    E.v93flight = { speed: Math.round(FB.speed), mult: mult, aboard: aboard, alt: Math.round(FB.y - Math.max(0, H(FB.x, FB.z))), x: Math.round(FB.x), z: Math.round(FB.z), yaw: +FB.yaw.toFixed(2) };
  }
  function busRoute(t, w, p, dt) {
    var s = S(); if (!s || !s.P) return;
    if (w.eventVariant === 'flight') { flightBus(t, w, p, dt); return; }
    if (w.phase === 'transport' && t < 30) {
      var r = route(), k = (t - r.t0) / (r.t1 - r.t0), x = r.A.x + (r.B.x - r.A.x) * k, z = r.A.z + (r.B.z - r.A.z) * k;
      var y = r.y + (k > 1 ? (k - 1) * (k - 1) * 900 : 0);
      w._azBusOverride = { x: x, y: y, z: z, lockId: null, release: true }; busOwn = true;
      if (w.aircraft) { w.aircraft.x = x; w.aircraft.y = y; w.aircraft.z = z; w.aircraft.yaw = Math.atan2(-r.D.x, -r.D.z); }
      if (t >= r.t1 && p && !p.deployed && !autoDropped) {
        autoDropped = true;
        try { w._deployFromBus(p, false); } catch (e) {}
        faceBase(p);
      }
    } else if (busOwn) {
      busOwn = false; if (w._azBusOverride && w._azBusOverride.release) delete w._azBusOverride;
    }
  }
  function faceBase(p) {
    var s = S(); if (!s || !p) return;
    var yaw = Math.atan2(-s.F.x, -s.F.z); p.yaw = yaw; if (G) { G.yaw = yaw; G.pitch = -.05; }
  }
  /* Descente guidée : si le joueur ne pilote pas, il glisse vers la colline et touche le sol avant le lancement. */
  function guideDescent(p, dt, t) {
    var s = S(); if (!s || !p.deployed || p.grounded || t > 18) return;
    var inp = p._input || {}, idle = Math.abs(+inp.moveX || 0) + Math.abs(+inp.moveZ || 0) < .05;
    var fw = (E.v93 && E.v93.FWD) || 0, dx = s.P.x + s.F.x * fw - p.x, dz = s.P.z + s.F.z * fw - p.z, d = Math.hypot(dx, dz); // v93 : vers la pente face au dépôt
    // v98 : plus de traction vers la colline quand on lâche les commandes (en planeur on partait « en arrière »)
    void d;
    if (p.gliding && t < 16 && idle) { var g = H(p.x, p.z); if (p.y - g > 3) p.y -= Math.min(p.y - g - 2, 9 * dt); }
    // v97 : plus de recadrage forcé de la caméra pendant la descente (elle tournait toute seule en planeur)
  }

  /* -------------------------------------------------------- chorégraphie */
  function floatTo(p, targetY, maxUp, maxDown) {
    p.deployed = true; p.grounded = false; p.falling = true; p.gliding = false; p.autoGlider = false; p.jumping = false; p.swimming = false; p.airborneFromBus = false;
    p._eventFloat = true;
    if (E.__snap) p.y = targetY;
    var v = (targetY - p.y) * 2.6; v = Math.max(-(maxDown || 30), Math.min(maxUp || 45, v));
    p._eventVerticalVelocity = v; p._vy = v;
  }
  function release(p) { p._eventFloat = false; p._eventVerticalVelocity = 0; }
  function setMode(m, t) { if (st.mode !== m) { st.mode = m; st.since = t; if (m === 'thrown' || m === 'zeroshock' || m === 'blast') st.kick = t; } }
  function publish(p, t) {
    var I = E.playerInfo || (E.playerInfo = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, airborne: false, mode: 'none', phase: '' });
    I.x = p.x; I.y = p.y; I.z = p.z; I.vy = p._vy || 0; I.airborne = !p.grounded; I.mode = st.mode; I.phase = E.state;
  }
  function choreo(p, dt, t) {
    var s = S(); if (!s || !s.ZP) return;
    // v93 : vol libre (resté dans le bus ou loin au moment de l'explosion) → plus aucune chorégraphie de fin
    if (E.v93 && E.v93.freeRoam) { if (st.mode !== 'none' && st.mode !== 'gone') { release(p); setMode('none', t); } return; }
    var ground = H(p.x, p.z);
    if (p.vehicleId) { try { var w = api.world(); if (w._exitVehicle) w._exitVehicle(p); } catch (e) {} }
    st.float = 0;
    // v81b : plus d'envol après l'impact de la météorite — on reste au sol jusqu'à ce que
    // la fusée fonce dans le Point Zéro (183 s) : c'est SON onde qui soulève le joueur.
    if (t >= 183.5 && t < 224) {
      // l'onde du Point Zéro soulève tout le monde ; on flotte bras écartés au-dessus de l'île
      if (st.mode !== 'zeroshock' && st.mode !== 'float') { st.liftFrom = p.y; }
      // v105 (vidéo 183 → 186,5 s) : l'onde arrache le joueur d'un coup — on voit toute l'île dès 186 s — puis il flotte
      // en apesanteur et dérive lentement plus haut jusqu'à la plongée des fusées (≈ 490 m au-dessus du sol à 212 s)
      var lk = U.easeOut(cl((t - 183.5) / 2.8)), target = Math.max(ground, st.liftFrom || p.y) + 340 * lk + 150 * U.sm(ramp(t, 187, 212)) + 4 * Math.sin(t * .7);
      floatTo(p, target, t < 187 ? 240 : 60, 40); setMode(t < 189 ? 'zeroshock' : 'float', t); st.float = ramp(t, 183.6, 185);
      var dx = s.ZP.x - p.x, dz = s.ZP.z - p.z, d = Math.hypot(dx, dz), want = 300;
      if (d > want) { var pull = Math.min(6, (d - want) * .05) * dt; p.x += dx / d * pull; p.z += dz / d * pull; }
      return;
    }
    if (t >= 224 && t < 253.6) {
      var c = s.ZP, dx2 = c.x - p.x, dz2 = c.z - p.z, d2 = Math.hypot(dx2, dz2) || 1;
      // v93 : trop loin du Point Zéro (> FAR m, mesuré au début du souffle) → ni soufflé ni aspiré, on reste libre
      if (st.far == null) st.far = d2 > FAR;
      if (st.far) { if (st.mode !== 'none' && st.mode !== 'gone') { release(p); setMode('none', t); } return; }
      if (t < 246.2) {
        // souffle de l'explosion puis lente dérive vers la lumière
        // v105 (vidéo 224,5 → 246 s) : le souffle projette le joueur dans l'espace (l'île n'est plus qu'un disque sous lui),
        // puis il dérive lentement vers la lumière au centre de l'île
        var base = Math.max(H(p.x, p.z), c.y) + 300 + 1350 * U.easeOut(cl((t - 224.3) / 3.2)) - 900 * U.sm(ramp(t, 229, 246));
        floatTo(p, base, 650, 70); setMode(t < 228 ? 'blast' : 'drift', t); st.float = 1;
        var spd = lerp(3, 42, ramp(t, 228, 246)) * dt; if (d2 > 30) { p.x += dx2 / d2 * spd; p.z += dz2 / d2 * spd; }
        st.suckFrom = null;
      } else {
        // aspiré en spirale dans le tourbillon
        if (!st.suckFrom) st.suckFrom = { x: p.x, y: p.y, z: p.z, r: d2, a: Math.atan2(p.z - c.z, p.x - c.x) };
        var k = cl((t - 246.2) / 7.2), rem = 1 - Math.pow(k, 1.8), ang = st.suckFrom.a + Math.pow(k, 1.6) * 3.4;
        p.x = c.x + Math.cos(ang) * st.suckFrom.r * rem; p.z = c.z + Math.sin(ang) * st.suckFrom.r * rem;
        p.y = lerp(c.y + 45, st.suckFrom.y, rem) + Math.sin(k * Math.PI) * 25;
        p._lastX = p.x; p._lastZ = p.z; p._vy = 0; p._eventFloat = true; p._eventVerticalVelocity = 0;
        p.grounded = false; p.falling = true; p.gliding = false; p.autoGlider = false;
        p.yaw += (1.2 + 7 * k) * dt; setMode('suck', t); st.float = 0;
      }
      return;
    }
    if (st.mode !== 'none' && st.mode !== 'gone') { release(p); setMode('none', t); }
  }
  function hideAll(p, w) {
    if (!p) return;
    if (!st.hidden) { st.hidden = true; st.saved = { x: p.x, y: p.y, z: p.z }; }
    // v83 : jusqu'à l'écran noir, la caméra reste au cœur du tourbillon (on voit l'île s'écraser en une ligne)
    if (VT() < 254.5) { p.x = st.saved.x; p.z = st.saved.z; p.y = st.saved.y; p._lastX = p.x; p._lastZ = p.z; } else p.y = HIDE_Y; p._vy = 0; p._eventFloat = true; p._eventVerticalVelocity = 0; p.grounded = false; p.falling = true; p.gliding = false; p.autoGlider = false;
    var v = api.view(); if (v && v.actorRoot) v.actorRoot.visible = false;
    setMode('gone', VT());
  }

  /* ------------------------------------------- caméra guidée (v83) */
  /* Pendant la fin (183 → 254 s), si le joueur ne touche pas à la souris depuis
   * quelques secondes, la caméra se tourne doucement vers ce que montre la
   * vidéo : le dôme du Point Zéro, puis le ciel (zénith rouge, étoile, météorite),
   * puis la lumière et le tourbillon. Un mouvement de souris reprend la main. */
  var steerUser = -999, lookPrev = null;
  function wrapLook() {
    if (!G || lookPrev || typeof G.look !== 'function') return;
    lookPrev = G.look; G.look = function () { steerUser = VT(); return lookPrev.apply(this, arguments); };
  }
  function unwrapLook() { if (G && lookPrev) G.look = lookPrev; lookPrev = null; }
  function steerCam(t, p, dt) {
    var s = S(); if (!G || !s || !s.ZP || !s.STAR || p.vehicleId) return;
    // v97 : jamais en vol (planeur, chute) ni quand le joueur se déplace : la caméra donne la direction
    var mi = p._input || {}; if (p.gliding || (p.falling && !p._eventFloat) || Math.abs(+mi.moveX || 0) + Math.abs(+mi.moveZ || 0) > .05) { steerUser = Math.max(steerUser, VT() - 1.5); return; }
    var tgt = null, pk = .8, O2 = E.end81 && E.end81.O, an = E.anchors || {};
    // v85 — quand le joueur ne touche à rien, la caméra suit l'action comme dans la vidéo
    var ride = E.v96 && E.v96.phase; // v96 : debout sur la météorite → on regarde où elle va (la faille, puis le dôme)
    if (ride === 'rk') return; // debout sur la fusée : la caméra reste libre
    if (ride === 'm1' && E.rc) { tgt = E.rc; pk = .9; }
    else if (ride === 'm2' || ride === 'thrown') tgt = s.ZP;
    else if (t >= 9 && t < 33.6 && an.rocket1) { tgt = an.rocket1; pk = .9; }
    else if (t >= 33.6 && t < 45.5 && (an.b1 || (O2 && O2.b1p))) { tgt = an.b1 || O2.b1p; pk = .95; }
    else if (t >= 45.5 && t < 54.2 && O2 && O2.r2p) { tgt = O2.r2p; pk = .85; }
    else if (t >= 54.2 && t < 62.6 && an.rA) { tgt = an.rA; pk = .9; }   // v89 : on suit la fusée comme la vidéo
    else if (t >= 62.6 && t < 64 && O2 && O2.b0p) { tgt = O2.b0p; pk = .9; }
    else if (t >= 119 && t < 153.5 && E.meteorPos && E.meteorVisible) { tgt = E.meteorPos; pk = .9; }
    else if (t >= 157.8 && t < 176.8) { tgt = s.STAR; pk = 1; }
    else if (t >= 176.8 && t < 183.5) tgt = s.ZP;
    else if (t >= 183.5 && t < 188.6) tgt = s.ZP;
    else if (t >= 188.6 && t < 212.5) { tgt = s.STAR; pk = 1; }
    else if (t >= 212.5 && t < 254.5) tgt = s.ZP;
    if (!tgt) return;
    var idle = ramp(t - steerUser, 2.5, 4.5); if (idle <= 0) return;
    var dx = tgt.x - p.x, dz = tgt.z - p.z, dy = tgt.y + 25 - (p.y + 1.8), hd = Math.hypot(dx, dz) || 1;
    var yawGoal = Math.atan2(-dx, -dz), pitchGoal = Math.max(-1.05, Math.min(1.12, Math.atan2(dy, hd) * pk));
    if (t >= 183.5 && t < 188.6 && !ride) pitchGoal = -.2; // v105 (vidéo 184-188 s) : derrière le joueur, l'horizon en haut de l'image, pas une plongée sur le dôme
    var k = E.__snapCam ? 1 : (1 - Math.exp(-Math.min(.1, dt || .016) * 1.6)) * idle; // __snapCam : outil de comparaison avec la vidéo (cadrage immédiat)
    var dyaw = yawGoal - G.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    G.yaw += dyaw * k; G.pitch += (pitchGoal - G.pitch) * k;
  }

  /* ------------------------------------------- v86 : la fusée est SOLIDE */
  /* On ne traverse plus la fusée du lancement (ni ses boosters, ni la tour), on peut se poser
   * sur sa coiffe, son épaulement ou le haut des boosters… et l'on monte avec elle au décollage.
   * Le pas de tir est un sol. Tout disparaît dès que la fusée entre dans la faille (33,3 s). */
  var colHook = null;
  // v98 : position de la fusée à l'instant présent (celle du rendu a une image de retard : on passait au travers quand elle accélère)
  var rkNow = new T.Vector3();
  function rkK() { var t = VT(); return E.end81 && E.end81.rocketScale && t < 38.6 ? E.end81.rocketScale(t) : 1; } // v100 : la fusée grandit en montant
  function rocketC() { var o = E.end81 && E.end81.O, rk = o && o.rocket; if (!rk || !rk.visible) return null; var t = VT(); if (E.end81.rocketPose && t < 38.6) return E.end81.rocketPose(t, rkNow); return rk.position; }
  // v93 : point (x, z) dans le repère de l'île volante (elle tourne lentement sur elle-même)
  function islLocal(x, z) {
    var isl = E.end81 && E.end81.O && E.end81.O.isl; if (!isl || !isl.visible) return null;
    var sc = isl.scale.x, wx = x - isl.position.x, wz = z - isl.position.z, c = Math.cos(isl.rotation.y), s = Math.sin(isl.rotation.y);
    var lx = (wx * c - wz * s) / sc, lz = (wx * s + wz * c) / sc;
    return { x: lx, z: lz, r: Math.hypot(lx, lz), sc: sc, y0: isl.position.y };
  }
  function installColliders() {
    var Wp = root.AZSim && root.AZSim.World && root.AZSim.World.prototype; if (!Wp || colHook || !Wp.supportAt || !Wp._blocked) return;
    var sup = Wp.supportAt, blk = Wp._blocked;
    function lim(cy, h) { return cy == null ? Infinity : (cy > h - 4 ? cy + 3 : cy + .8); } // marge large : elle monte vite
    var mySup = function (x, z, cy) {
      var best = sup.apply(this, arguments);
      try {
        if (!E.active) return best; var s = S();
        // v93 : l'île volante est un sol (on peut s'y poser en sautant du bus)
        var il = islLocal(x, z);
        if (il) {
          var itop = il.y0 + il.sc * (.08 + .05 * Math.max(0, 1 - il.r)) + .05; // dessus herbeux bombé (event-end81-models.js)
          if (il.r < .92 && itop <= lim(cy, itop) && itop > best) best = itop;
          var htop = il.y0 + .26 * il.sc; // toit de la cabane
          if (Math.abs(il.x - .12) < .16 && Math.abs(il.z + .05) < .12 && htop <= lim(cy, htop) && htop > best) best = htop;
        }
        if (s && s.BASE) { var pad = s.BASE.y + .7; if (Math.hypot(x - s.BASE.x, z - s.BASE.z) < 15.2 && pad <= lim(cy, pad - 9) && pad > best) best = pad; }
        var c = rocketC(); if (!c) return best;
        var kk = rkK(), d = Math.hypot(x - c.x, z - c.z), top = c.y + 27.6 * kk, sh = c.y + 25.6 * kk;
        if (d < 1.3 * kk && top <= lim(cy, top) && top > best) best = top;
        else if (d < 2.75 * kk && sh <= lim(cy, sh) && sh > best) best = sh;
        for (var i = 0; i < 2; i++) { var bt = c.y + 15.6 * kk, bd = Math.hypot(x - c.x, z - (c.z + (i ? -3.9 : 3.9) * kk)); if (bd < 1.1 * kk && bt <= lim(cy, bt) && bt > best) best = bt; }
      } catch (e) {}
      return best;
    };
    var myBlk = function (x, z, r, y) {
      if (blk.apply(this, arguments)) return true;
      try {
        if (!E.active || y == null) return false; var rr = r || .4, s = S();
        var il = islLocal(x, z);
        if (il) { // murs de la cabane et mât de l'île volante
          var pad = rr / il.sc, hb = il.y0 + .08 * il.sc, ht = il.y0 + .26 * il.sc;
          if (y > hb - 1 && y < ht - .3 && Math.abs(il.x - .12) < .16 + pad && Math.abs(il.z + .05) < .12 + pad) return true;
          if (y > hb - 1 && y < il.y0 + .58 * il.sc && Math.hypot(il.x + .18, il.z - .1) < .016 + pad) return true;
        }
        if (s && s.BASE && s.R) { var tx = s.BASE.x - s.R.x * 6.2, tz = s.BASE.z - s.R.z * 6.2; if (y < s.BASE.y + 34 && Math.hypot(x - tx, z - tz) < 2.2 + rr) return true; } // tour de lancement
        var c = rocketC(); if (!c) return false;
        var kk = rkK();
        if (y < c.y + 25.4 * kk && y + 1.7 > c.y + 1.2 * kk && Math.hypot(x - c.x, z - c.z) < 3.0 * kk + rr) return true;              // fuselage
        for (var i = 0; i < 2; i++) { if (y < c.y + 15.2 * kk && y + 1.7 > c.y + 1.2 * kk && Math.hypot(x - c.x, z - (c.z + (i ? -3.9 : 3.9) * kk)) < 1.2 * kk + rr) return true; } // boosters
      } catch (e) {}
      return false;
    };
    Wp.supportAt = mySup; Wp._blocked = myBlk; colHook = { Wp: Wp, sup: sup, blk: blk, mySup: mySup, myBlk: myBlk };
  }
  function removeColliders() {
    if (!colHook) return; var Wp = colHook.Wp;
    if (Wp.supportAt === colHook.mySup) Wp.supportAt = colHook.sup; if (Wp._blocked === colHook.myBlk) Wp._blocked = colHook.blk;
    colHook = null;
  }

  /* -------------------------------------------------- pose « flottement » */
  function installPose() {
    view = api.view(); if (!view || typeof view.animateAvatar !== 'function' || animWrap) return;
    animPrev = view.animateAvatar;
    animWrap = function (model, player, dt, options) {
      var r = animPrev.call(this, model, player, dt, options);
      if (E.active && options && options.local && model && player && st.float > .01) {
        try { floatPose(model, Math.min(.1, dt || 0)); } catch (e) {}
      }
      return r;
    };
    view.animateAvatar = animWrap;
  }
  function floatPose(model, dt) {
    var u = model.userData; if (!u || !u.limbs || !u.knees || !u.elbows) return;
    var k = st.float, t = VT(), br = Math.sin(t * 1.7) * .08, br2 = Math.sin(t * 1.3 + 1) * .06;
    function to(o, ax, v) { o.rotation[ax] += (v - o.rotation[ax]) * k; }
    to(u.limbs[1], 'x', -.35 + br); to(u.limbs[1], 'z', -1.25 - br2);
    to(u.limbs[3], 'x', -.35 - br); to(u.limbs[3], 'z', 1.25 + br2);
    to(u.elbows[0], 'x', -.25); to(u.elbows[1], 'x', -.25);
    to(u.limbs[0], 'x', .18 + br * .6); to(u.limbs[0], 'z', .2);
    to(u.limbs[2], 'x', -.08 - br * .6); to(u.limbs[2], 'z', -.2);
    to(u.knees[0], 'x', -.45 + br); to(u.knees[1], 'x', -.25 - br);
    if (u.torso) u.torso.rotation.x += (.12 - u.torso.rotation.x * .2) * k * .5;
    if (u.gun) u.gun.visible = false;
  }
  function removePose() { if (view && animWrap && view.animateAvatar === animWrap) view.animateAvatar = animPrev; animWrap = animPrev = null; }

  /* --------------------------------------------------------- interface */
  var CSS = [
    'body.azend-cine .hud>*:not(.touch-controls):not(.game-toolbar){opacity:0!important;transition:opacity .9s ease;pointer-events:none!important}',
    'body.azend-cine .hud>.game-toolbar{opacity:.28;transition:opacity .9s ease}',
    'body.azend-cine .hud>.game-toolbar:hover{opacity:1}',
    'body.azend-cine [class*="hud-v67"],body.azend-cine .v67-hud,body.azend-cine .azevent-hud{opacity:0!important;transition:opacity .9s ease}',
    'body.azend-black .hud,body.azend-black #azevent-countdown,body.azend-black .azevent-hud{opacity:0!important;pointer-events:none!important}',
    'body.azend-black .touch-controls{opacity:.15}',
    '#azevent-countdown .azevent-cd-warn,#azevent-countdown .azevent-cd-alarmflash,#azevent-countdown .azevent-cd-dusk,.azevent-cd-warn,.azevent-cd-alarmflash,.azevent-cd-dusk{display:none!important}',
    '#azend-hint{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:30;font:600 12px/1 Barlow,system-ui,sans-serif;letter-spacing:.14em;color:#dceaff;background:rgba(6,14,32,.55);border:1px solid rgba(140,180,255,.35);border-radius:999px;padding:9px 16px;pointer-events:none;opacity:0;transition:opacity .8s ease;text-transform:uppercase}',
    '#azend-hint.on{opacity:1}',
    '#azend-end{position:fixed;left:50%;bottom:9vh;transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0;transition:opacity 2.4s ease;pointer-events:none;text-align:center}',
    '#azend-end.on{opacity:1;pointer-events:auto}',
    '#azend-end p{margin:0;font:600 13px/1.4 Barlow,system-ui,sans-serif;letter-spacing:.32em;color:rgba(190,210,255,.75);text-transform:uppercase}',
    '#azend-end button{font:800 15px/1 BarlowCondensed,Impact,sans-serif;letter-spacing:.2em;color:#0b1430;background:linear-gradient(180deg,#e8f0ff,#a9c2ff);border:0;border-radius:6px;padding:13px 26px;cursor:pointer;box-shadow:0 0 30px rgba(90,130,255,.45)}',
    '#azend-end button.ghost{background:transparent;color:#cfe0ff;border:1px solid rgba(150,180,255,.45);box-shadow:none}',
    '#azend-end .row{display:flex;gap:12px}'
  ].join('\n');
  function ensureDom() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'azend-style'; styleEl.textContent = CSS; document.head.appendChild(styleEl); }
    if (!hintEl) { hintEl = document.createElement('div'); hintEl.id = 'azend-hint'; hintEl.textContent = 'H · afficher l’interface'; document.body.appendChild(hintEl); }
    if (!endEl) {
      endEl = document.createElement('div'); endEl.id = 'azend-end';
      endEl.innerHTML = '<p>Le Chapitre se referme. Il ne reste que le trou noir.</p><div class="row"><button type="button" data-end="lobby">RETOUR AU SALON</button><button type="button" class="ghost" data-end="replay">REVIVRE L’ÉVÉNEMENT</button></div>';
      endEl.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button'); if (!b) return;
        var g = api && api.game(); if (!g) return;
        if (b.getAttribute('data-end') === 'lobby') { try { g.leaveToLobby ? g.leaveToLobby() : g.closeModal && g.closeModal(); } catch (er) {} }
        else { try { g.mode = 'event'; g.startMatch(); } catch (er) {} }
      });
      document.body.appendChild(endEl);
    }
  }
  function onKey(e) {
    if (!on || e.repeat) return;
    if ((e.key === 'h' || e.key === 'H') && !/input|textarea/i.test((e.target && e.target.tagName) || '')) { hudShown = !hudShown; }
  }
  function updateUi(t) {
    var free = !!(E.v93 && E.v93.freeRoam), b = document.body, cine = !free && t > -2 && t < 254.5 && !hudShown, blk = !free && t >= 254.5;
    b.classList.toggle('azend-cine', cine); b.classList.toggle('azend-black', blk);
    if (hintEl) hintEl.classList.toggle('on', (t > -1 && t < 7) || (hudShown && t > -2 && t < 254.5 && Math.floor(t) % 30 < 3));
    if (endEl) endEl.classList.toggle('on', !free && t > 284);
  }

  /* ------------------------------------------------------------ cycle */
  function preUpdate(dt, tt) {
    if (!on || !E.active) return;
    var w = api.world(), p = api.player(), t = VT();
    wrapWorld(w);
    if (!w) return;
    // bots parqués hors champ et figés (pas de combat pendant le film)
    for (var i = 0; i < w.players.length; i++) {
      var q = w.players[i]; if (!q || !q.bot) continue;
      q.y = HIDE_Y; q._eventHidden = true; q.deployed = true; q.grounded = false; q.falling = false; q.gliding = false; q._vy = 0; hiddenBots[q.id] = true;
    }
    if (!p) return;
    if (p.alive) { p.hp = Math.max(p.hp, 100); if (typeof p.shield === 'number') p.shield = Math.max(p.shield, 100); p.downed = false; }
    busRoute(t, w, p, dt);
    // v93 : à bord du bus (Vol sans fin) ou resté loin, le trou noir ne l'avale pas
    if (t >= 253.6) { st.spared = !!((E.v93 && E.v93.freeRoam) || (p.deployed ? st.far : w.eventVariant === 'flight')); if (!st.spared) hideAll(p, w); publish(p, t); return; }
    if (t < 224) { st.far = null; st.spared = false; }
    if (st.hidden && t < 253.6) { st.hidden = false; var vv = api.view(); if (vv && vv.actorRoot) vv.actorRoot.visible = true; if (st.saved) { p.x = st.saved.x; p.z = st.saved.z; p.y = H(p.x, p.z) + 1; } }
    if (p.deployed && p.alive) {
      if (p.grounded && t > -25) st.landedSeen = true;
      guideDescent(p, dt, t);
      choreo(p, dt, t);
      steerCam(t, p, dt);
    }
    // v85 — distance caméra mesurée sur la vidéo : ~4,4 m au sol (au lieu de 3,7), tout près du joueur
    // quand il flotte (~2,8 m, 183,5 → 223), puis elle reste proche dans le tourbillon (~8 m à 246 s) puis recule (~24 m à 251,5 s).
    var air = !!(p.gliding || p.falling || p.flying), zg = air ? 1 : 4.4 / 3.7;
    var zf = lerp(.45, 1, ramp(t, 223, 226)) + .35 * ramp(t, 236, 246) + 2.6 * ramp(t, 247, 251.5);
    E.cameraZoom = t < 183.5 ? zg : lerp(zg, zf, ramp(t, 183.5, 185.2));
    // caméra par-dessus l'épaule comme Fortnite (personnage à gauche de l'écran, ~0,9 m de décalage)
    E.cameraShoulder = 1.8 * (1 - ramp(t, 236, 250));
    publish(p, t);
  }
  function update(dt) {
    if (!on || !E.active) return;
    var p = api.player(), t = VT();
    if (p && t >= 253.6 && !st.spared) { if (t >= 254.5 || !st.saved) p.y = HIDE_Y; else { p.x = st.saved.x; p.y = st.saved.y; p.z = st.saved.z; } }
    if (p && st.mode !== 'none' && st.mode !== 'gone' && p._eventFloat && t < 253.6) {
      // garde-fou : jamais sous le relief pendant les phases aériennes
      var g = H(p.x, p.z); if (p.y < g + .5) { p.y = g + .5; }
    }
    updateUi(t);
    if (!animWrap) installPose();
  }
  function init(a) {
    api = a; G = api.game(); on = true; hudShown = false; autoDropped = false; busOwn = false; BUS_Y = 0; hiddenBots = {}; ROUTE = null; FB = null;
    st = { mode: 'none', float: 0, hidden: false, suckFrom: null, landedSeen: false, kick: -99 };
    ensureDom(); installPose(); installColliders(); root.addEventListener('keydown', onKey); steerUser = -999; wrapLook();
    E.cameraZoom = 1; E.cameraShoulder = 1;
  }
  function dispose() {
    on = false; unwrapWorld(); removePose(); removeColliders(); unwrapLook(); root.removeEventListener('keydown', onKey);
    var b = document.body; b.classList.remove('azend-cine'); b.classList.remove('azend-black');
    if (hintEl && hintEl.parentNode) hintEl.parentNode.removeChild(hintEl); hintEl = null;
    if (endEl && endEl.parentNode) endEl.parentNode.removeChild(endEl); endEl = null;
    E.cameraZoom = 1; E.cameraShoulder = 1;
    var v = api && api.view(); if (v && v.actorRoot) v.actorRoot.visible = true;
    var w = api && api.world(); if (w && busOwn && w._azBusOverride) delete w._azBusOverride;
    api = null;
  }
  E.register('play81', { init: init, preUpdate: preUpdate, update: update, dispose: dispose });
})(window);
