/* AZUR v93 — event-v93.js : retouches de « La Fin » d'après la vidéo de référence du 17/10.
 *  - Début dans le bus de combat, BUS_PRE secondes avant le décollage (au lieu de 54 s) : il traverse l'île
 *    vers la colline, le joueur saute quand il veut (largage automatique à T-4 s) et la descente le guide
 *    vers la pente face au dépôt de la fusée. Une fois au sol il marche, saute, construit, émote.
 *    Filet de sécurité : s'il n'est toujours pas posé au décollage, il est posé sur la colline.
 *  - Le joueur reste libre de bouger pendant tout l'événement : en lévitation et pendant
 *    l'aspiration, les commandes de déplacement le font dériver (l'événement garde la main
 *    sur la hauteur et la trajectoire générale, jamais sur l'immobilité).
 *  - Expose E.v93.floating (0..1) pour les nouveaux personnages (pose bras écartés).
 * Enrobe le module play81 (event-end81-play.js) : la liste des modules actifs du séquenceur
 * est privée, donc on ne s'enregistre pas comme module séparé. */
(function (root) {
  "use strict";
  var E = root.AZEvent, L = root.AZEnd81;
  if (!E || !E.mods || !E.mods.play81 || E.mods.play81.__v93) return;
  var M = E.mods.play81;
  M.__v93 = true;
  var BUS_PRE = 30; // secondes de bus avant le décollage de la fusée (le cœur en prévoyait 54)
  var FWD = 30; // mètres en avant du sommet : la pente laisse voir le dépôt en contrebas (vidéo, 0 s)
  var V = (E.v93 = { floating: 0, placed: false, started: false, FWD: FWD, busSpeed: loadSpeed() });

  /* Événement 2 « Vol sans fin » : on conduit le bus (event-end81-play.js, flightBus). Ce panneau règle la vitesse
   * max (×1 à ×30 : boutons − / +, touches − / +) et l'altitude (boutons ▲ ▼ maintenus, touches R / F ou flèches). */
  var SPEED_MAX = 30;
  function loadSpeed() { try { var v = +root.localStorage.getItem("azur.v93.busSpeed"); if (v >= 1 && v <= SPEED_MAX) return v; } catch (e) {} return 4; }
  function saveSpeed(v) { try { root.localStorage.setItem("azur.v93.busSpeed", String(v)); } catch (e) {} }
  function setSpeed(v) { V.busSpeed = Math.max(1, Math.min(SPEED_MAX, Math.round(v))); saveSpeed(V.busSpeed); paintSpeed(); }
  var climbKeys = { up: false, down: false, bUp: false, bDown: false };
  function paintClimb() { V.busClimb = (climbKeys.up || climbKeys.bUp ? 1 : 0) - (climbKeys.down || climbKeys.bDown ? 1 : 0); }
  var speedEl = null;
  function speedUi() {
    if (speedEl || !root.document) return speedEl;
    var d = root.document, st = d.createElement("style");
    st.textContent = "#azv93-speed{position:fixed;left:50%;top:96px;transform:translateX(-50%);z-index:45;display:none;align-items:center;gap:10px;padding:8px 12px;border-radius:999px;background:rgba(6,14,32,.62);border:1px solid rgba(140,180,255,.4);font:700 12px/1 Barlow,system-ui,sans-serif;letter-spacing:.12em;color:#e6efff;text-transform:uppercase;pointer-events:auto;touch-action:manipulation}" +
      "#azv93-speed.on{display:flex}#azv93-speed button{width:34px;height:34px;border-radius:50%;border:0;background:#ffd23a;color:#14223a;font:800 20px/1 Barlow,system-ui,sans-serif;cursor:pointer}#azv93-speed b{min-width:44px;text-align:center;font-size:16px;color:#ffd23a}" +
      "#azv93-speed .alt{background:#7fd3ff}#azv93-speed i{font-style:normal;opacity:.8;font-size:11px;letter-spacing:.06em;margin-left:4px}#azv93-speed small{display:block;position:absolute;left:0;right:0;top:100%;margin-top:6px;text-align:center;font:600 11px/1.3 Barlow,system-ui,sans-serif;letter-spacing:.06em;color:#dce7ff;text-shadow:0 1px 3px #000;text-transform:none}" +
      "@media (max-width:700px){#azv93-speed{top:auto;bottom:150px;gap:6px;padding:6px 9px}#azv93-speed span,#azv93-speed small{display:none}#azv93-speed button{width:42px;height:42px}}";
    d.head.appendChild(st);
    speedEl = d.createElement("div"); speedEl.id = "azv93-speed";
    speedEl.innerHTML = '<span>Vitesse max</span><button type="button" data-d="-1" aria-label="Moins vite">−</button><b>×4</b><button type="button" data-d="1" aria-label="Plus vite">+</button>' +
      '<span>Altitude</span><button type="button" class="alt" data-c="1" aria-label="Monter">▲</button><button type="button" class="alt" data-c="-1" aria-label="Descendre">▼</button><i></i>' +
      '<small>Z accélérer · S freiner · Q / D tourner · R / F monter / descendre · Espace sauter</small>';
    speedEl.style.position = "fixed";
    speedEl.addEventListener("pointerdown", function (ev) {
      var b = ev.target.closest && ev.target.closest("button"); if (!b) return; ev.preventDefault(); ev.stopPropagation();
      if (b.hasAttribute("data-d")) setSpeed(V.busSpeed + (+b.getAttribute("data-d")));
      else { var c = +b.getAttribute("data-c"); climbKeys.bUp = c > 0; climbKeys.bDown = c < 0; paintClimb(); }
    });
    var stopBtn = function () { climbKeys.bUp = climbKeys.bDown = false; paintClimb(); };
    speedEl.addEventListener("pointerup", stopBtn); speedEl.addEventListener("pointercancel", stopBtn); speedEl.addEventListener("pointerleave", stopBtn);
    d.body.appendChild(speedEl); paintSpeed();
    var climbKey = function (ev, down) {
      if (ev.code === "KeyR" || ev.code === "ArrowUp" || ev.code === "PageUp") { climbKeys.up = down; paintClimb(); return true; }
      if (ev.code === "KeyF" || ev.code === "ArrowDown" || ev.code === "PageDown") { climbKeys.down = down; paintClimb(); return true; }
      return false;
    };
    root.addEventListener("keyup", function (ev) { climbKey(ev, false); });
    root.addEventListener("keydown", function (ev) {
      if (!speedEl || !speedEl.classList.contains("on")) return;
      if (climbKey(ev, true)) return;
      if (ev.code === "Equal" || ev.code === "NumpadAdd" || ev.key === "+") setSpeed(V.busSpeed + 1);
      else if (ev.code === "Minus" || ev.code === "Digit6" && ev.key === "-" || ev.code === "NumpadSubtract" || ev.key === "-") setSpeed(V.busSpeed - 1);
    });
    return speedEl;
  }
  function paintSpeed() { if (speedEl) { var b = speedEl.querySelector("b"); if (b) b.textContent = "×" + V.busSpeed; } }
  function showSpeed(on) {
    var el = speedUi(); if (!el) return; el.classList.toggle("on", !!on);
    if (!on) { climbKeys.up = climbKeys.down = climbKeys.bUp = climbKeys.bDown = false; paintClimb(); return; }
    var f = E.v93flight, i = el.querySelector("i"); if (f && i) i.textContent = Math.round(f.speed * 3.6) + " km/h · " + f.alt + " m";
  }
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 0; } }
  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  function game() { return root.AZUR; }
  function me() { var g = game(), w = g && g.world; return w ? w.players.find(function (q) { return q.id === g.myId; }) : null; }

  function placeOnHill(w, p) {
    var s = L && L.S; if (!s || !s.P) return false;
    try { if (!p.deployed && w._deployFromBus) w._deployFromBus(p, false); } catch (e) {}
    p.deployed = true; p.airborneFromBus = false; p.autoGlider = false; p.gliding = false; p.falling = false; p.jumping = false; p.flying = false;
    var ahead = s.F ? FWD : 0; p.x = s.P.x + (s.F ? s.F.x * ahead : 0); p.z = s.P.z + (s.F ? s.F.z * ahead : 0); p.y = H(p.x, p.z) + 0.05; p._lastX = p.x; p._lastZ = p.z; p._vy = 0; p._vx = 0; p._vz = 0; p.grounded = true;
    if (s.F) { var yaw = Math.atan2(-s.F.x, -s.F.z); p.yaw = yaw; var g = game(); if (g) { g.yaw = yaw; g.pitch = -0.15; } }
    return true;
  }

  // commandes de déplacement du joueur (clavier, joystick) → dérive horizontale quand l'événement le porte
  function steer(p, dt, speed) {
    var i = p._input || {}, mx = +i.moveX || 0, mz = +i.moveZ || 0;
    if (Math.abs(mx) + Math.abs(mz) < 0.05) return;
    var yaw = p.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    var vx = (fx * mz + rx * mx) * speed * dt, vz = (fz * mz + rz * mx) * speed * dt;
    p.x += vx; p.z += vz; p._lastX = p.x; p._lastZ = p.z;
  }

  var prevInit = M.init;
  M.init = function () {
    V.placed = false; V.started = false; V.floating = 0; V.suckOff = null; showSpeed(false);
    return prevInit.apply(this, arguments);
  };

  var prevDispose = M.dispose;
  M.dispose = function () { showSpeed(false); return prevDispose ? prevDispose.apply(this, arguments) : undefined; };

  var prevPre = M.preUpdate;
  M.preUpdate = function (dt) {
    var w = game() && game().world, p = me();
    if (E.active && w && p && !V.started) { V.started = true; if (E.tVideo < -BUS_PRE) E.tVideo = -BUS_PRE; }
    if (E.active && w && p && !V.placed) {
      if (p.deployed && p.grounded) V.placed = true;                                   // posé après le saut
      else if (w.eventVariant !== "flight" && VT() > 9.5 && (!p.deployed || p.y - H(p.x, p.z) > 30) && placeOnHill(w, p)) V.placed = true; // filet : jamais rater le décollage (pas en « Vol sans fin »)
    }
    showSpeed(!!(E.active && w && p && w.eventVariant === "flight" && !p.deployed));
    var beforeX = p ? p.x : 0, beforeZ = p ? p.z : 0;
    var r = prevPre.apply(this, arguments);
    if (!p || !E.active) return r;
    var mode = E.playerInfo && E.playerInfo.mode, t = VT(), d = Math.min(0.1, +dt || 0);
    var floating = mode === "zeroshock" || mode === "float" || mode === "blast" || mode === "drift" || mode === "suck";
    V.floating += ((floating ? 1 : 0) - V.floating) * Math.min(1, d * 3);
    if (floating && t < 253.6) {
      if (mode === "suck") {
        // l'aspiration pose la position chaque image : on garde un décalage que le joueur pilote
        V.suckOff = V.suckOff || { x: 0, z: 0 };
        var bx = p.x, bz = p.z; steer(p, d, 9);
        V.suckOff.x = (V.suckOff.x + (p.x - bx)) * (1 - d * 0.6); V.suckOff.z = (V.suckOff.z + (p.z - bz)) * (1 - d * 0.6);
        p.x = bx + V.suckOff.x; p.z = bz + V.suckOff.z; p._lastX = p.x; p._lastZ = p.z;
      } else {
        // la lévitation n'empêche pas de se déplacer : nage dans les airs
        var moved = Math.hypot(p.x - beforeX, p.z - beforeZ);
        if (moved < 0.02 * Math.max(1, d * 60)) steer(p, d, 11);
      }
    } else V.suckOff = null;
    return r;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
