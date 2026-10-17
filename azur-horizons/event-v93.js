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
  var V = (E.v93 = { floating: 0, placed: false, started: false, FWD: FWD });
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
    V.placed = false; V.started = false; V.floating = 0; V.suckOff = null;
    return prevInit.apply(this, arguments);
  };

  var prevPre = M.preUpdate;
  M.preUpdate = function (dt) {
    var w = game() && game().world, p = me();
    if (E.active && w && p && !V.started) { V.started = true; if (E.tVideo < -BUS_PRE) E.tVideo = -BUS_PRE; }
    if (E.active && w && p && !V.placed) {
      if (p.deployed && p.grounded) V.placed = true;                                   // posé après le saut
      else if (VT() > 9.5 && (!p.deployed || p.y - H(p.x, p.z) > 30) && placeOnHill(w, p)) V.placed = true; // filet : jamais rater le décollage
    }
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
