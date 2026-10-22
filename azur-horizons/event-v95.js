/* AZUR v95 — event-v95.js : le joueur dans « La Fin », version Saison X.
 *  - La météorite est SOLIDE : on peut se poser dessus (comme sur la vraie météorite figée de la saison),
 *    on ne la traverse plus à pied, en planant ou en lévitation ; si elle glisse sur le joueur, elle le pousse.
 *    Pareil pour la météorite de la fin qui plonge dans le Point Zéro.
 *  - Réactions du personnage : sursaut aux grands éclats quand il est au sol et immobile, coup de souffle quand
 *    une onde de choc passe sur lui (petit saut, recul), bras et jambes qui battent l'air quand l'onde du Point
 *    Zéro l'arrache du sol, culbutes dans le tourbillon. Les poses sont lues par ch1-models-v93.js (E.v95.pose).
 * Enrobe le module play81 (comme event-v93.js). À charger après event-v93.js. */
(function (root) {
  "use strict";
  var E = root.AZEvent;
  if (!E || !E.mods || !E.mods.play81 || E.mods.play81.__v95) return;
  var M = E.mods.play81;
  M.__v95 = true;
  var V = (E.v95 = { pose: null, poseT: 0, hop: -99 });
  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 0; } }
  function me() { var g = root.AZUR, w = g && g.world; return w ? w.players.find(function (q) { return q.id === g.myId; }) : null; }

  /* ------------------------------------------------------------ météorite solide */
  // ellipsoïde : rayon horizontal Re, demi-hauteur .85 Re (la roche est aplatie)
  function rock() {
    if (!E.active || !E.meteorVisible || !E.meteorPos) return null;
    var t = VT(), r = t < 170 ? (E.meteorRadius || 9) : 21;
    return { x: E.meteorPos.x, y: E.meteorPos.y, z: E.meteorPos.z, Re: r * .95, Hy: r * .95 * .85 };
  }
  function topAt(c, d) { return d >= c.Re ? null : c.y + c.Hy * Math.sqrt(1 - (d / c.Re) * (d / c.Re)); }
  var hook = null;
  function install() {
    var Wp = root.AZSim && root.AZSim.World && root.AZSim.World.prototype;
    if (!Wp || hook || !Wp.supportAt || !Wp._blocked) return;
    var sup = Wp.supportAt, blk = Wp._blocked;
    var mySup = function (x, z, cy) {
      var best = sup.apply(this, arguments);
      try {
        var c = rock(); if (!c) return best;
        var top = topAt(c, Math.hypot(x - c.x, z - c.z));
        if (top != null && top > best && (cy == null || cy > top - 4)) best = top;
      } catch (e) {}
      return best;
    };
    var myBlk = function (x, z, r, y) {
      if (blk.apply(this, arguments)) return true;
      try {
        var c = rock(); if (!c || y == null) return false;
        var d = Math.hypot(x - c.x, z - c.z), rr = r || .45; if (d > c.Re + rr) return false;
        var dd = Math.min(d, c.Re - 1e-3), h = c.Hy * Math.sqrt(1 - (dd / c.Re) * (dd / c.Re)), top = c.y + h, bot = c.y - h;
        return y < top - .35 && y + 1.7 > bot;
      } catch (e) { return false; }
    };
    Wp.supportAt = mySup; Wp._blocked = myBlk; hook = { Wp: Wp, sup: sup, blk: blk, mySup: mySup, myBlk: myBlk };
  }
  function uninstall() {
    if (!hook) return; var Wp = hook.Wp;
    if (Wp.supportAt === hook.mySup) Wp.supportAt = hook.sup; if (Wp._blocked === hook.myBlk) Wp._blocked = hook.blk;
    hook = null;
  }
  // si la roche (qui bouge) recouvre le joueur, on le sort par le chemin le plus court
  function pushOut(p) {
    var c = rock(); if (!c || !p) return;
    var cx = p.x - c.x, cy = (p.y + .9) - c.y, cz = p.z - c.z, ex = c.Re + .45, ey = c.Hy + .9;
    var n = Math.sqrt((cx * cx + cz * cz) / (ex * ex) + (cy * cy) / (ey * ey));
    if (n >= 1 || n < 1e-4) return;
    var k = 1 / n;
    p.x = c.x + cx * k; p.z = c.z + cz * k; var ny = c.y + cy * k - .9;
    if (cy > 0) { p.y = Math.max(p.y, ny); if (!p._eventFloat) { p.grounded = true; p._vy = 0; } } else p.y = Math.min(p.y, ny);
    p._lastX = p.x; p._lastZ = p.z;
  }

  /* ---------------------------------------------------------------- réactions */
  var GASP = [[38.7, 40.3], [62.4, 63.4], [75.9, 77.4], [110.95, 112.2], [152.9, 154.6], [155.45, 156.8], [183.05, 183.5], [223.35, 224.2]];
  function pose(p, t, dt) {
    var info = E.playerInfo || {}, mode = info.mode || "none", inp = p._input || {}, idle = Math.abs(+inp.moveX || 0) + Math.abs(+inp.moveZ || 0) < .05;
    var next = null;
    if (mode === "zeroshock" || mode === "blast") next = "fall";
    else if (mode === "suck") next = "tumble";
    else if (p.grounded && !(p.emote > 0)) {
      // le souffle d'une onde qui passe : petit saut et recul
      if ((E.shake || 0) > .42 && t - V.hop > 2.5 && mode === "none") {
        V.hop = t; p.grounded = false; p.jumping = true; p._vy = 5.5;
        var c = E.rc, dx = c ? p.x - c.x : 0, dz = c ? p.z - c.z : 0, dl = Math.hypot(dx, dz) || 1;
        p._vx = (p._vx || 0) + dx / dl * 4; p._vz = (p._vz || 0) + dz / dl * 4;
      }
      if (t - V.hop < .5) next = "hit";
      else if (idle) for (var i = 0; i < GASP.length; i++) if (t > GASP[i][0] && t < GASP[i][1]) { next = "surprise"; break; }
    }
    if (next !== V.pose) { V.pose = next; V.poseT = 0; } else V.poseT += dt;
  }

  var prevInit = M.init;
  M.init = function () { V.pose = null; V.hop = -99; var r = prevInit.apply(this, arguments); install(); return r; };
  var prevDispose = M.dispose;
  M.dispose = function () { uninstall(); V.pose = null; return prevDispose ? prevDispose.apply(this, arguments) : undefined; };
  var prevPre = M.preUpdate;
  M.preUpdate = function (dt) {
    var r = prevPre.apply(this, arguments);
    try {
      if (E.active) {
        if (!hook) install();
        var p = me(), t = VT();
        if (p && p.alive && p.deployed) { pushOut(p); pose(p, t, Math.min(.1, +dt || 0)); }
      }
    } catch (e) { if (!V.err) { V.err = 1; if (root.console) console.warn("[AZUR v95]", e); } }
    return r;
  };
  void H;
})(typeof globalThis !== "undefined" ? globalThis : this);
