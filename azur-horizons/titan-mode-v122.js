/* AZUR v122 — mode « Gant du Titan » (bataille royale solo, 100 participants).
 * Peu après le début de la partie, un météore tombe du ciel avec le Gant du Titan. Celui qui le ramasse (E) devient le
 * Titan : un colosse de 700 PV et 300 de bouclier, sans armes ni constructions, avec six pouvoirs. Tout le monde peut
 * l'attaquer ; quand il tombe, le gant reste à terre et le premier qui le ramasse devient le nouveau Titan.
 * Pouvoirs : 1 / clic = coup de poing (repousse, casse les constructions) · 2 = rayon du gant · 3 = saut écrasant (onde
 * au sol à l'atterrissage) · 4 = bond éclair (téléportation courte) · 5 = bouclier d'énergie (-75 % de dégâts) ·
 * 6 = attraction (tire les ennemis proches vers lui). Chaque élimination lui rend du bouclier et de la vie.
 * v123 — quand on ramasse le gant : il s'élève à 200 m, lève le gant, serre le poing (il grandit d'un coup), puis
 * tombe en chute libre et s'écrase au sol (onde de choc). Intouchable pendant toute la séquence.
 * Le fichier enveloppe la simulation (AZSim.World, seulement quand world.titanMode) et ajoute l'interface (annonces,
 * repère, barre des pouvoirs). Les effets visuels et les animations sont dans titan-fx-v123.js. */
(function (root) {
  "use strict";
  var S = root.AZSim, T = root.THREE;
  if (!S || !S.World || root.__azTitanMode) return;
  root.__azTitanMode = true;
  var Wp = S.World.prototype;
  var LOOK = (root.AZTitanLook && root.AZTitanLook.ID) || "char-titan-colosse", SCALE = (root.AZTitanLook && root.AZTitanLook.SCALE) || 1.75;
  if (root.AZTitanLook && root.AZTitanLook.install) root.AZTitanLook.install();

  // réglages du mode
  var CFG = {
    dropAt: 40, fall: 12,              // le gant touche le sol 40 s après le début de la partie, après 12 s de chute (on le voit venir)
    hp: 700, shield: 300, killShield: 75, killHp: 25,
    pickR: 3.6, regrab: 1.5,
    // course au gant : les IA connaissent la carte par cœur, alors le joueur part avec une vraie chance —
    // le gant tombe à 45-85 m de lui (là où aucune IA n'est plus près), les IA ne le voient qu'une fois au sol
    // (3 à 9 s de réaction, seulement les 4 plus proches) et ne peuvent pas le prendre pendant 12 s (7 s quand un Titan tombe)
    race: { near: [45, 85], wait: 75, lock: 12, relock: 7, react: [3, 9], notice: 70, grow: 9, seekers: 4, humanR: 4.6, autoR: 2.2 },
    cd: [0, .75, 7, 8, 6, 16, 12],     // recharge des pouvoirs 1 → 6 (s)
    punch: { dmg: 80, range: 5.8, cone: .55, build: 450 },
    beam: { dps: 75, len: 90, width: 2.6, time: 1.8, charge: .4, build: 360 }, // charge : le gant se charge avant de tirer
    slam: { vy: 16.5, fwd: 10.5, dmg: 70, r: 12, build: 600 }, // fwd : vitesse du bond vers l'avant (m/s) — ~16 m par saut
    blink: 24, guard: { time: 5, k: .25 },
    pull: { r: 34, dmg: 25, time: .85, speed: 22 },
    // la transformation : il s'élève, lève le gant, serre le poing, puis chute libre jusqu'au sol
    asc: { lift: .45, rise: 2.8, hover: .8, clench: .8, height: 200, g: 34, vmax: 85, steer: 10, drift: 30 },
    landing: { r: 17, dmg: 90, build: 900 }
  };
  var POWERS = [null,
    { key: "1", name: "Coup de poing", ico: "✊" }, { key: "2", name: "Rayon du gant", ico: "☄" }, { key: "3", name: "Saut écrasant", ico: "⬆" },
    { key: "4", name: "Bond éclair", ico: "⚡" }, { key: "5", name: "Bouclier", ico: "◈" }, { key: "6", name: "Attraction", ico: "◎" }];
  root.AZTitanMode = { CFG: CFG, POWERS: POWERS };

  /* ================================================================ simulation */
  function fwd(yaw) { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; }
  function aim(p) { var cp = Math.cos(p.pitch || 0); return { x: -Math.sin(p.yaw) * cp, y: Math.sin(p.pitch || 0), z: -Math.cos(p.yaw) * cp }; }
  function H(x, z) { try { return S.heightAt(x, z); } catch (e) { return 0; } }
  function foe(p, q) { return q && q !== p && q.alive && q.deployed && !q.downed && q.team !== p.team; }
  function st(w) { return w.titan || (w.titan = { phase: "pending", x: 0, y: 0, z: 0, holder: null, t0: 0, fallStart: 0, from: null, fx: [], seq: 0, news: [], nseq: 0 }); }
  function fx(w, type, x, y, z, more) { var G = st(w), e = { seq: ++G.seq, type: type, x: x, y: y, z: z, t: w.elapsed }; if (more) for (var k in more) e[k] = more[k]; G.fx.push(e); if (G.fx.length > 48) G.fx.shift(); return e; }
  function news(w, text, kind) { var G = st(w); G.news.push({ seq: ++G.nseq, text: text, kind: kind || "", t: w.elapsed }); if (G.news.length > 8) G.news.shift(); }
  function holder(w) { var G = w.titan; if (!G || G.phase !== "held") return null; var p = w._find(G.holder); return p && p.alive ? p : null; }

  // les joueurs humains encore en jeu (en solo : toi)
  function humans(w) { return w.players.filter(function (q) { return !q.bot && q.alive && q.deployed && !q.downed; }); }
  function contender(w) { return humans(w).some(function (q) { return !q._titan; }); }
  function airborne(q) { return !q.deployed || q.airborneFromBus || q.gliding || q.autoGlider || (!q.grounded && q.y - H(q.x, q.z) > 25); }
  function openGround(w, x, z) {
    var y = H(x, z);
    if (y < 1.5 || (S.isWater && S.isWater(x, z))) return null;
    if (w._blocked(x, z, 2.2, y + .2)) return null;
    for (var oi = 0; oi < w.objects.length; oi++) { var ob = w.objects[oi]; if (!ob.dead && ob.type === "house" && Math.hypot(ob.x - x, ob.z - z) < 14 + Math.max(ob.w || 0, ob.d || 0)) return null; }
    if (Math.abs(H(x + 3, z) - y) > 2 || Math.abs(H(x, z + 3) - y) > 2) return null;
    return y;
  }
  function nearRegion(x, z) { var b = "", bd = 260; (S.regions || []).forEach(function (r) { var d = Math.hypot(r.x - x, r.z - z); if (d < bd) { bd = d; b = r.name || ""; } }); return b; }
  // où tombe le gant : à 45-85 m du joueur, sur la terre ferme, à découvert, dans la zone sûre, là où les IA sont le plus loin
  function pickSpot(w, G) {
    var hs = humans(w).filter(function (q) { return !q._titan && !airborne(q); }), R = CFG.race;
    if (hs.length) {
      var me = hs[Math.floor(w.rng.next() * hs.length) % hs.length], best = null, bs = -1e9;
      var safe = Math.min(w.storm.radius, w.storm.nextRadius || w.storm.radius) * .85;
      // d'abord à 45-85 m ; en pleine ville (aucun terrain dégagé), un peu plus loin
      for (var t = 0; t < 150 && !(best && t >= 90); t++) {
        var lo = t < 90 ? R.near[0] : R.near[1], hi = t < 90 ? R.near[1] : R.near[1] + 55;
        var a = w.rng.next() * Math.PI * 2, d = lo + w.rng.next() * (hi - lo), x = me.x + Math.cos(a) * d, z = me.z + Math.sin(a) * d;
        if (Math.hypot(x - w.storm.x, z - w.storm.z) > safe) continue;
        var y = openGround(w, x, z); if (y == null) continue;
        var nb = 1e9; w.players.forEach(function (q) { if (q.bot && q.alive && q.deployed) nb = Math.min(nb, Math.hypot(q.x - x, q.z - z)); });
        var sc = Math.min(nb, 160) - d; if (sc > bs) { bs = sc; best = { x: x, y: y, z: z }; }
      }
      if (best) { G.x = best.x; G.y = best.y; G.z = best.z; G.region = nearRegion(best.x, best.z); G.forX = me.x; G.forZ = me.z; return; }
    }
    pickRegionSpot(w, G);
  }
  // sans joueur au sol : près d'un lieu nommé
  function pickRegionSpot(w, G) {
    var sx = w.storm.x, sz = w.storm.z, rad = Math.min(w.storm.radius, w.storm.nextRadius || w.storm.radius) * .62, R = S.regions || [];
    var cand = R.filter(function (r) { return Math.hypot(r.x - sx, r.z - sz) < rad && H(r.x, r.z) > 1.5; });
    if (!cand.length) cand = R.length ? R : [{ x: 0, z: 0 }];
    for (var tries = 0; tries < 120; tries++) {
      var r = cand[Math.floor(w.rng.next() * cand.length) % cand.length], a = w.rng.next() * Math.PI * 2, d = 35 + w.rng.next() * 70 + tries;
      var x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d, y = H(x, z);
      if (y < 1.5 || (S.isWater && S.isWater(x, z))) continue;
      if (w._blocked(x, z, 2.2, y + .2)) continue;
      // à découvert : aucune maison à moins de 14 m (on doit voir le gant et pouvoir s'en approcher de partout)
      var housed = false; for (var oi = 0; oi < w.objects.length && !housed; oi++) { var ob = w.objects[oi]; if (!ob.dead && ob.type === "house" && Math.hypot(ob.x - x, ob.z - z) < 14 + Math.max(ob.w || 0, ob.d || 0)) housed = true; }
      if (housed) continue;
      if (Math.abs(H(x + 3, z) - y) > 2 || Math.abs(H(x, z + 3) - y) > 2) continue;
      G.x = x; G.z = z; G.y = y; G.region = r.name || ""; return;
    }
    G.x = sx; G.z = sz; G.y = H(sx, sz);
  }
  function becomeTitan(w, p) {
    var G = st(w);
    w._cancelEmote && w._cancelEmote(p);
    w._dropAll(p); p.selected = 0; p.reload = 0; p.useTime = 0; p._useId = null; p._burstLeft = 0; p.aim = false;
    p._titanEq = p.equipment; p.equipment = Object.assign({}, p.equipment || {}, { character: LOOK, back: "", variant: "" });
    p._titan = true; p.hp = CFG.hp; p.shield = CFG.shield; p.maxHp = CFG.hp; p.maxShield = CFG.shield;
    p._tcd = [0, 0, 0, 0, 0, 0, 0]; p._tq = []; p._tGuard = 0; p._tBeam = 0; p._tSlam = false; p._tBeamAcc = 0;
    G.phase = "held"; G.holder = p.id; G.since = w.elapsed; G.titans = (G.titans || 0) + 1;
    p._tAsc = { phase: "lift", t: 0, x: p.x, z: p.z, y0: p.y, vy: 0 };
    p.grounded = false; p.jumping = true; p.gliding = false; p.falling = false; p.airborneFromBus = false; p.vehicleId = null;
    fx(w, "pickup", p.x, p.y, p.z, { id: p.id });
    news(w, p.bot ? p.name + " a ramassé le Gant du Titan !" : "Tu as ramassé le Gant du Titan !", "pickup");
  }
  function sm(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function nextPhase(A, ph) { A.phase = ph; A.t = 0; }
  function ascStep(w, p, dt) {
    var A = p._tAsc, C = CFG.asc, i = p._input || {}; A.t += dt;
    if (i.yaw != null) p.yaw = i.yaw; if (i.pitch != null) p.pitch = i.pitch;
    p.grounded = false; p.jumping = true; p.gliding = false; p.autoGlider = false; p.falling = false; p.airborneFromBus = false; p.swimming = false; p.crouching = false;
    p._vy = 0; p._vx = 0; p._vz = 0; p._edge.length = 0; if (p._tq) p._tq.length = 0; p.emote = 0;
    var top = A.y0 + C.height;
    if (A.phase === "lift") { p.y = A.y0 + .8 * sm(A.t / C.lift); if (A.t >= C.lift) nextPhase(A, "rise"); }
    else if (A.phase === "rise") { var k = sm(A.t / C.rise); p.y = A.y0 + .8 + (C.height - .8) * k; if (A.t >= C.rise) nextPhase(A, "hover"); }
    else if (A.phase === "hover") { p.y = top + Math.sin(A.t * 3) * .25; if (A.t >= C.hover) { nextPhase(A, "clench"); fx(w, "clench", p.x, p.y, p.z, { id: p.id }); news(w, p.bot ? p.name + " est devenu le Titan !" : "Tu es devenu le Titan !", "titan"); if (!p.bot) w._emit("message", p.x, p.y, p.z, { playerId: p.id, text: "Tu es le Titan ! Clic : coup de poing · 2 à 6 : pouvoirs" }); } }
    else if (A.phase === "clench") { p.y = top + .25 * Math.sin(A.t * 9) * (1 - A.t / C.clench); if (A.t >= C.clench) { nextPhase(A, "fall"); A.vy = 4; fx(w, "dive", p.x, p.y, p.z, { id: p.id }); } }
    else if (A.phase === "fall") {
      A.vy = Math.min(C.vmax, A.vy + C.g * dt);
      // on peut se diriger un peu pendant la chute (sans s'éloigner de plus de 30 m : on retombe toujours sur la terre ferme)
      var mx = Math.max(-1, Math.min(1, +i.moveX || 0)), mz = Math.max(-1, Math.min(1, +i.moveZ || 0)), f = fwd(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      var nx = p.x + (f.x * mz + rx * mx) * C.steer * dt, nz = p.z + (f.z * mz + rz * mx) * C.steer * dt, dd = Math.hypot(nx - A.x, nz - A.z);
      if (dd > C.drift) { nx = A.x + (nx - A.x) * C.drift / dd; nz = A.z + (nz - A.z) * C.drift / dd; }
      if (S.isWater && S.isWater(nx, nz) && H(nx, nz) < .8) { nx = p.x; nz = p.z; }
      p.x = nx; p.z = nz;
      var ny = p.y - A.vy * dt, ground = w.supportAt ? w.supportAt(p.x, p.z, p.y + .5) : H(p.x, p.z);
      if (!isFinite(ground)) ground = H(p.x, p.z);
      if (ny <= ground + .05) land(w, p, ground); else p.y = ny;
    }
    p._lastX = p.x; p._lastZ = p.z;
  }
  function land(w, p, ground) {
    var A = p._tAsc, L = CFG.landing; p.y = ground; p._tAsc = null;
    p.grounded = true; p.falling = false; p.jumping = false; p._vy = 0; p._tLandAt = w.elapsed;
    w.players.forEach(function (q) {
      if (!foe(p, q)) return; var dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > L.r || Math.abs(q.y - p.y) > 8) return; var k = 1 - d / (L.r * 1.1);
      w._damage(q, p, L.dmg * k, "Titan", {}); knock(q, dx / (d || 1), dz / (d || 1), 8 + 12 * k, 5 + 8 * k);
    });
    smash(w, p.x, p.y + 1, p.z, 11, L.build, p);
    fx(w, "landing", p.x, p.y, p.z, { id: p.id, speed: A ? A.vy : 0 });
  }
  function dropGauntlet(w, p) {
    var G = st(w), x = p ? p.x : G.x, z = p ? p.z : G.z, y = Math.max(H(x, z), p ? Math.min(p.y, H(x, z) + 40) : G.y);
    if (S.isWater && S.isWater(x, z)) { var safe = null; for (var a = 0; a < 16 && !safe; a++) for (var d = 8; d < 120 && !safe; d += 8) { var tx = x + Math.cos(a * .4) * d, tz = z + Math.sin(a * .4) * d; if (!S.isWater(tx, tz) && H(tx, tz) > 1) safe = { x: tx, z: tz }; } if (safe) { x = safe.x; z = safe.z; } }
    y = w.supportAt ? w.supportAt(x, z, y + 1) : H(x, z);
    G.phase = "ground"; G.x = x; G.y = y; G.z = z; G.t0 = w.elapsed; G.regrab = CFG.regrab; G.holder = null; G.lock = w.elapsed + CFG.race.relock; G.seq2 = (G.seq2 || 0) + 1;
    if (p) { p._titan = false; p._tBeam = 0; p._tGuard = 0; p._tAsc = null; if (p._titanEq) p.equipment = p._titanEq; delete p.maxHp; delete p.maxShield; }
    fx(w, "drop", x, y, z, {});
    news(w, "Le Titan est tombé ! Le gant est à terre.", "drop");
  }
  function tryPickup(w, p) {
    var G = w.titan; if (!G || G.phase !== "ground" || p._titan || !p.alive || !p.deployed || p.downed || p.vehicleId) return false;
    if (w.elapsed < G.t0 + (G.regrab || 0)) return false;
    if (p.bot && w.elapsed < (G.lock || 0) && contender(w)) return false; // le joueur a quelques secondes d'avance
    if (Math.hypot(p.x - G.x, p.z - G.z) > (p.bot ? CFG.pickR : CFG.race.humanR) || Math.abs(p.y - G.y) > 4) return false;
    becomeTitan(w, p); return true;
  }
  function knock(q, nx, nz, sp, vy) {
    if (!q.alive || q.vehicleId) return;
    q.grounded = false; q.jumping = true; q.falling = false; q.gliding = false; q.swimming = false;
    q._vy = Math.max(q._vy || 0, vy); q._vx = nx * sp; q._vz = nz * sp; q._jumpTime = 0;
  }
  var SMASH = { tree: 1, rock: 1, crate: 1, fence: 1, lamp: 1, container: 1 };
  function smash(w, x, y, z, r, dmg, src) {
    var i, b, o;
    for (i = 0; i < w.builds.length; i++) { b = w.builds[i]; if (!b.dead && Math.hypot(b.x - x, b.y - y, b.z - z) < r + 2) w._damageHit({ build: b }, src, dmg, b.x, b.y, b.z); }
    for (i = 0; i < w.objects.length; i++) { o = w.objects[i]; if (!o.dead && SMASH[o.type] && Math.hypot(o.x - x, o.z - z) < r && Math.abs(o.y - y) < r + 3) w._damageHit({ object: o }, src, dmg, o.x, o.y, o.z); }
  }
  function punch(w, p) {
    if ((p._tcd[1] || 0) > 0) return false;
    p._tcd[1] = CFG.cd[1]; p._cool = CFG.cd[1]; p._tPunchAt = w.elapsed; p._tPunchN = (p._tPunchN || 0) + 1;
    var f = fwd(p.yaw), hit = 0;
    w.players.forEach(function (q) {
      if (!foe(p, q)) return; var dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > CFG.punch.range || Math.abs(q.y - p.y) > 4) return;
      if (d > .6 && (dx * f.x + dz * f.z) / d < CFG.punch.cone) return;
      w._damage(q, p, CFG.punch.dmg, "Titan", {}); knock(q, dx / (d || 1), dz / (d || 1), 15, 6.5); hit++;
    });
    smash(w, p.x + f.x * 3, p.y + 1, p.z + f.z * 3, 3.8, CFG.punch.build, p);
    fx(w, "punch", p.x + f.x * 2.8, p.y + 1.7, p.z + f.z * 2.8, { id: p.id, hit: hit });
    return true;
  }
  function beamTick(w, p, dt) {
    p._tBeam = Math.max(0, p._tBeam - dt);
    if (p._tBeamCharge > 0) { p._tBeamCharge = Math.max(0, p._tBeamCharge - dt); p._tBeamAcc = 0; }
    else p._tBeamAcc = (p._tBeamAcc || 0) + dt;
    var d = aim(p), f = fwd(p.yaw), ox = p.x + f.x * 1.1, oy = p.y + 2.5, oz = p.z + f.z * 1.1, len = CFG.beam.len;
    for (var s = 4; s < CFG.beam.len; s += 2) { if (oy + d.y * s < H(ox + d.x * s, oz + d.z * s) - .3) { len = s; break; } }
    p._tBeamEnd = { x: ox + d.x * len, y: oy + d.y * len, z: oz + d.z * len, len: len, ground: len < CFG.beam.len };
    if (p._tBeamCharge > 0 || (p._tBeamAcc < .2 && p._tBeam > 0)) return;
    var tick = p._tBeamAcc; p._tBeamAcc = 0;
    w.players.forEach(function (q) {
      if (!foe(p, q)) return;
      var vx = q.x - ox, vy = q.y + 1.1 - oy, vz = q.z - oz, t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0 || t > len) return;
      var px = vx - d.x * t, py = vy - d.y * t, pz = vz - d.z * t;
      if (Math.hypot(px, py, pz) > CFG.beam.width) return;
      w._damage(q, p, CFG.beam.dps * tick, "Titan", {});
    });
    for (var i = 0; i < w.builds.length; i++) {
      var b = w.builds[i]; if (b.dead) continue; var bx = b.x - ox, by = b.y - oy, bz = b.z - oz, tb = bx * d.x + by * d.y + bz * d.z;
      if (tb < 0 || tb > len) continue; if (Math.hypot(bx - d.x * tb, by - d.y * tb, bz - d.z * tb) < 3) w._damageHit({ build: b }, p, CFG.beam.build * tick, b.x, b.y, b.z);
    }
  }
  function slam(w, p) {
    w.players.forEach(function (q) {
      if (!foe(p, q)) return; var dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > CFG.slam.r || Math.abs(q.y - p.y) > 5) return; var k = 1 - d / (CFG.slam.r * 1.15);
      w._damage(q, p, CFG.slam.dmg * k, "Titan", {}); knock(q, dx / (d || 1), dz / (d || 1), 6 + 10 * k, 3 + 7 * k);
    });
    smash(w, p.x, p.y + 1, p.z, 8, CFG.slam.build, p);
    p._tSlamAt = w.elapsed; fx(w, "slam", p.x, p.y, p.z, { id: p.id });
  }
  function blink(w, p) {
    if (p.vehicleId || p.swimming) return false;
    var f = fwd(p.yaw), x = p.x, z = p.z, y = p.y, ok = 0;
    for (var s = 1; s <= CFG.blink; s++) {
      var nx = p.x + f.x * s, nz = p.z + f.z * s, gy = w.supportAt ? w.supportAt(nx, nz, y + 3) : H(nx, nz);
      if (!isFinite(gy) || gy > y + 3.2) break;
      if (S.isWater && S.isWater(nx, nz) && gy < .6) break;
      if (w._blocked(nx, nz, .46, gy + .05)) break;
      x = nx; z = nz; y = gy; ok = s;
    }
    if (ok < 3) return false;
    fx(w, "blink", p.x, p.y, p.z, { id: p.id, tx: x, ty: y, tz: z });
    p.x = x; p.z = z; p.y = y; p._lastX = x; p._lastZ = z; p._vy = 0; p._vx = 0; p._vz = 0;
    p.grounded = true; p.jumping = false; p.falling = false; p.gliding = false; p._tcd[4] = CFG.cd[4]; p._tBlinkAt = w.elapsed;
    return true;
  }
  function pull(w, p) {
    var n = 0;
    w.players.forEach(function (q) {
      if (!foe(p, q)) return; var d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > CFG.pull.r || d < 2.5 || Math.abs(q.y - p.y) > 14) return;
      w._damage(q, p, CFG.pull.dmg, "Titan", {}); q._tPull = { id: p.id, t: CFG.pull.time }; n++;
    });
    p._tcd[6] = CFG.cd[6]; p._tPullAt = w.elapsed; fx(w, "pull", p.x, p.y, p.z, { id: p.id, n: n });
    return true;
  }
  function usePower(w, p, k) {
    if (!p._titan || !p.alive || !p.deployed || p._tAsc || (p._tcd[k] || 0) > 0) return false;
    if (k === 1) return punch(w, p);
    if (k === 2) { p._tBeam = CFG.beam.time + CFG.beam.charge; p._tBeamCharge = CFG.beam.charge; p._tBeamAcc = 0; p._tcd[2] = CFG.cd[2]; p._tBeamAt = w.elapsed; fx(w, "beam", p.x, p.y, p.z, { id: p.id, time: CFG.beam.time }); return true; }
    if (k === 3) {
      if (!p.grounded || p.swimming || p.vehicleId) return false;
      var f = fwd(p.yaw); p._vy = CFG.slam.vy; p.grounded = false; p.jumping = true; p._jumpTime = 0; p._vx = f.x * 9; p._vz = f.z * 9;
      p._tSlam = true; p._tLeap = { x: f.x * CFG.slam.fwd, z: f.z * CFG.slam.fwd }; p._tcd[3] = CFG.cd[3]; fx(w, "leap", p.x, p.y, p.z, { id: p.id }); return true;
    }
    if (k === 4) return blink(w, p);
    if (k === 5) { p._tGuard = CFG.guard.time; p._tcd[5] = CFG.cd[5]; p._tGuardAt = w.elapsed; fx(w, "guard", p.x, p.y, p.z, { id: p.id, time: CFG.guard.time }); return true; }
    if (k === 6) return pull(w, p);
    return false;
  }
  function stepTitan(w, dt) {
    var G = st(w); if (w.phase !== "active") return;
    var e = w.elapsed;
    if (G.phase === "pending" && e >= CFG.dropAt - CFG.fall && (e >= CFG.race.wait || !humans(w).some(airborne))) {
      pickSpot(w, G); G.phase = "falling"; G.fallStart = e;
      // il arrive en biais (25°) et de côté par rapport au joueur : sa traînée traverse le ciel devant lui
      var a = w.rng.next() * Math.PI * 2;
      if (G.forX != null) a = Math.atan2(G.z - G.forZ, G.x - G.forX) + (w.rng.next() < .5 ? -1 : 1) * (.7 + w.rng.next() * .5);
      G.from = { x: G.x + Math.cos(a) * 1500, y: G.y + 700, z: G.z + Math.sin(a) * 1500 };
      fx(w, "meteor", G.x, G.y, G.z, {}); news(w, "Un météore tombe du ciel : le Gant du Titan arrive" + (G.region ? " près de " + G.region : "") + " !", "meteor");
    }
    if (G.phase === "falling" && e >= G.fallStart + CFG.fall) {
      G.phase = "ground"; G.t0 = e; G.regrab = 0; G.lock = e + CFG.race.lock; G.seq2 = (G.seq2 || 0) + 1;
      fx(w, "impact", G.x, G.y, G.z, {}); news(w, contender(w) ? "Le Gant du Titan est tombé ! Les IA ne peuvent pas le prendre avant " + CFG.race.lock + " s : fonce (E) !" : "Le Gant du Titan est tombé !", "ground");
      w.players.forEach(function (q) { if (!q.alive || !q.deployed) return; var d = Math.hypot(q.x - G.x, q.z - G.z); if (d < 16) { w._damage(q, null, 30 * (1 - d / 16), "météore", {}); knock(q, (q.x - G.x) / (d || 1), (q.z - G.z) / (d || 1), 10, 7); } });
      smash(w, G.x, G.y, G.z, 10, 800, null);
    }
    if (G.phase === "held") { var h = holder(w); if (!h) dropGauntlet(w, w._find(G.holder)); else { G.x = h.x; G.y = h.y; G.z = h.z; } }
  }

  // --- enveloppes de la simulation (actives seulement en mode Titan)
  var ctor0 = S.World;
  var step0 = Wp.step;
  Wp.step = function (dt) { var r = step0.apply(this, arguments); if (this.titanMode) { try { stepTitan(this, Math.min(.05, Math.max(0, +dt || 0))); } catch (e) { if (!Wp.__tErr) { Wp.__tErr = 1; console.warn("[Titan]", e); } } } return r; };
  var cmd0 = Wp.command;
  Wp.command = function (id, input) {
    if (this.titanMode && input && typeof input === "object" && Number.isInteger(input.titanPower) && input.titanPower >= 1 && input.titanPower <= 6) {
      var p = this._find(id); if (p && p._titan) { (p._tq || (p._tq = [])).push(input.titanPower); if (p._tq.length > 6) p._tq.shift(); }
    }
    return cmd0.apply(this, arguments);
  };
  var up0 = Wp._updatePlayer;
  Wp._updatePlayer = function (p, dt) {
    if (!this.titanMode) return up0.apply(this, arguments);
    // attraction en cours : la victime glisse vers le Titan
    if (p._tPull && p._tPull.t > 0 && p.alive) {
      var tt = this._find(p._tPull.id); p._tPull.t -= dt;
      if (tt && tt.alive) { var dx = tt.x - p.x, dz = tt.z - p.z, d = Math.hypot(dx, dz); if (d > 3) { var stp = Math.min(d - 3, CFG.pull.speed * dt), nx = p.x + dx / d * stp, nz = p.z + dz / d * stp; if (!this._blocked(nx, nz, .46, p.y)) { p.x = nx; p.z = nz; } if (p.grounded) { var gy = this.supportAt(p.x, p.z, p.y + 1.2); if (isFinite(gy)) p.y = gy; } } }
      if (p._tPull.t <= 0) p._tPull = null;
    }
    if (!p._titan) {
      var r0 = up0.apply(this, arguments), G0 = this.titan;
      if (!p.bot && G0 && G0.phase === "ground" && p.alive && Math.hypot(p.x - G0.x, p.z - G0.z) < CFG.race.autoR && Math.abs(p.y - G0.y) < 3) tryPickup(this, p);
      return r0;
    }
    if (p._tAsc && p.alive) { ascStep(this, p, dt); return; }
    for (var i = 1; i < 7; i++) if (p._tcd[i] > 0) p._tcd[i] = Math.max(0, p._tcd[i] - dt);
    if (p._tGuard > 0) p._tGuard = Math.max(0, p._tGuard - dt);
    if (p.inventory.length) p.inventory.length = 0; // le Titan n'a jamais d'armes
    if (p._input) p._input.sprint = true;            // il court toujours
    var r = up0.apply(this, arguments);
    if (!p.alive || !p._titan) return r;
    var q = p._tq; while (q && q.length) usePower(this, p, q.shift());
    if (p._tBeam > 0) beamTick(this, p, dt); else p._tBeamEnd = null;
    // le bond du saut écrasant : il garde son élan vers l'avant jusqu'à l'atterrissage (les murs l'arrêtent)
    if (p._tSlam && p._tLeap && (p.jumping || p.falling)) { var lx = p.x + p._tLeap.x * dt, lz = p.z + p._tLeap.z * dt; if (!this._blocked(lx, lz, .46, p.y)) { p.x = lx; p.z = lz; } else p._tLeap = null; }
    if (p._tSlam && p.grounded && !p.jumping) { p._tSlam = false; p._tLeap = null; slam(this, p); }
    return r;
  };
  var fire0 = Wp._fire;
  Wp._fire = function (p) { if (this.titanMode && p && p._titan) { punch(this, p); return; } return fire0.apply(this, arguments); };
  ["_melee", "_harvest"].forEach(function (k) { var f0 = Wp[k]; if (typeof f0 !== "function") return; Wp[k] = function (p) { if (this.titanMode && p && p._titan) { punch(this, p); return; } return f0.apply(this, arguments); }; });
  ["_build", "_edit", "_demolish", "_startUse", "_startReload", "_craftVehicle", "_drop", "_startEmote"].forEach(function (k) { var f0 = Wp[k]; if (typeof f0 !== "function") return; Wp[k] = function (p) { if (this.titanMode && p && p._titan) return false; return f0.apply(this, arguments); }; });
  var int0 = Wp._interact;
  Wp._interact = function (p) { if (this.titanMode) { if (p && p._titan) return; if (tryPickup(this, p)) return; } return int0.apply(this, arguments); };
  // dégâts : le Titan encaisse comme un joueur (sans les réductions entre IA, sinon il serait presque immortel), bouclier d'énergie à -75 %
  function builtIn(src, v, why, meta) {
    var f = 1;
    if (src && src.bot && v.bot && (meta.weapon || /tir|explosion|véhicule|corps à corps/.test(why || ""))) f = .2;
    else if (src && !src.bot && v.bot && meta.weapon) f = .3;
    else if (!src && v.bot) f = .72;
    if (src && src.bot && !v.bot) f *= .48;
    return f;
  }
  var dmg0 = Wp._damage;
  Wp._damage = function (v, src, amount, why, meta) {
    if (this.titanMode && v && v._tAsc) return; // la transformation ne s'interrompt pas
    if (this.titanMode && v && ((v._titan) || (src && src._titan))) {
      meta = meta || {}; var f = builtIn(src, v, why, meta), want = f;
      if (v._titan) { want = src ? (src.bot ? (v.bot ? .45 : .42) : 1) : f; if (v._tGuard > 0) want *= CFG.guard.k; }
      else if (src && src._titan) want = v.bot ? 1 : .4; // un Titan IA reste battable : ~30 par coup sur un joueur
      amount = amount * want / Math.max(.01, f);
      return dmg0.call(this, v, src, amount, why, meta);
    }
    return dmg0.apply(this, arguments);
  };
  var elim0 = Wp._eliminate;
  Wp._eliminate = function (p, killer, reason) {
    var wasTitan = !!(this.titanMode && p && p._titan && p.alive);
    var r = elim0.apply(this, arguments);
    if (this.titanMode) {
      if (wasTitan) dropGauntlet(this, p);
      if (killer && killer !== p && killer._titan && killer.alive) { killer.shield = Math.min(CFG.shield, killer.shield + CFG.killShield); killer.hp = Math.min(CFG.hp, killer.hp + CFG.killHp); }
      if (wasTitan && killer && killer !== p) news(this, (killer.bot ? killer.name : "Tu") + (killer.bot ? " a abattu le Titan !" : " as abattu le Titan !"), "kill");
    }
    return r;
  };
  // IA : on vise le Titan en priorité, on court vers le gant tombé ; un Titan IA chasse et utilise ses pouvoirs
  var near0 = Wp._nearestEnemy;
  Wp._nearestEnemy = function (p, max) {
    if (this.titanMode && p && !p._titan) { var h = holder(this); if (h && h !== p && h.deployed && Math.hypot(h.x - p.x, h.z - p.z) < (max || 120) * 1.35) return h; }
    return near0.apply(this, arguments);
  };
  function hash01(id, n) { var s = String(id) + ":" + n, h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
  // seulement les quelques IA les plus proches courent vers le gant (pas toute la carte d'un coup)
  function seeker(w, G, p) {
    if (!G._sk || w.elapsed - G._sk.t > 1 || G._sk.seq !== G.seq2) {
      var list = w.players.filter(function (q) { return q.bot && q.alive && q.deployed && !q.downed && !q._titan; }).map(function (q) { return { id: q.id, d: Math.hypot(q.x - G.x, q.z - G.z) }; });
      list.sort(function (a, b) { return a.d - b.d; });
      G._sk = { t: w.elapsed, seq: G.seq2, ids: list.slice(0, CFG.race.seekers).map(function (o) { return o.id; }) };
    }
    return G._sk.ids.indexOf(p.id) >= 0;
  }
  function seekGauntlet(w, p) {
    // pendant la chute, les IA ne savent pas où il va tomber : elles réagissent quelques secondes après l'impact
    var G = w.titan; if (!G || G.phase !== "ground" || p.falling || p.gliding || p.vehicleId) return;
    var R = CFG.race, since = w.elapsed - G.t0, react = R.react[0] + hash01(p.id, G.seq2 || 0) * (R.react[1] - R.react[0]);
    if (since < react) return;
    var d = Math.hypot(G.x - p.x, G.z - p.z); if (d > Math.min(240, R.notice + R.grow * (since - react))) return;
    if (!seeker(w, G, p)) return;
    var locked = w.elapsed < (G.lock || 0) && contender(w);
    if (locked && d < 20) return; // elle ne peut pas encore le prendre : elle se bat autour au lieu d'attendre dessus
    var inp = p._input || (p._input = {}), goal = w._routeGoal ? w._routeGoal(p, { x: G.x, z: G.z }) : { x: G.x, z: G.z }, gx = goal.x - p.x, gz = goal.z - p.z;
    p.yaw = inp.yaw = Math.atan2(-gx, -gz); inp.moveZ = 1; inp.moveX = w._aiSteer ? w._aiSteer(p, gx, gz) : 0; inp.sprint = true; inp.fire = false; inp.aim = false;
    if (!locked && d < CFG.pickR - .4) p._edge.push({ interact: true });
  }
  function titanBrain(w, p) {
    var inp = p._input || (p._input = {}), best = null, bd = 1e9, crowd = 0;
    w.players.forEach(function (q) { if (!foe(p, q)) return; var d = Math.hypot(q.x - p.x, q.z - p.z); if (d < 30) crowd++; if (d < bd) { bd = d; best = q; } });
    if (!best || bd > 170) return;
    var sd = Math.hypot(p.x - w.storm.x, p.z - w.storm.z); if (sd > w.storm.radius - 40) return; // la tempête d'abord
    var dx = best.x - p.x, dz = best.z - p.z, goal = w._routeGoal ? w._routeGoal(p, { x: best.x, z: best.z }) : best, gx = goal.x - p.x, gz = goal.z - p.z;
    p.yaw = inp.yaw = Math.atan2(-(bd < 8 ? dx : gx), -(bd < 8 ? dz : gz)); p.pitch = inp.pitch = Math.max(-.5, Math.min(.5, (best.y - p.y) / Math.max(bd, 1)));
    inp.moveZ = bd > 3.4 ? 1 : 0; inp.moveX = 0; inp.sprint = true; inp.fire = bd < 5; inp.aim = false;
    var cd = p._tcd || [], rnd = w.rng.next(), q = p._tq || (p._tq = []);
    var vis = w._lineClear(p.x, p.y + 2.6, p.z, best.x, best.y + 1.2, best.z);
    if (p.hp < CFG.hp * .55 && !(cd[5] > 0) && (p._aiLastDamage || -9) > w.elapsed - 2) q.push(5);
    if (crowd >= 2 && !(cd[6] > 0) && rnd < .5) q.push(6);
    else if (bd < 5) q.push(1);
    else if (vis && bd < 60 && !(cd[2] > 0) && rnd < .4) q.push(2);
    else if (bd > 8 && bd < 22 && !(cd[3] > 0) && p.grounded && rnd < .45) q.push(3);
    else if (bd > 26 && bd < 70 && !(cd[4] > 0) && rnd < .35) q.push(4);
  }
  var bot0 = Wp._bot;
  Wp._bot = function (p, dt) {
    var before = p._aiLastThink, r = bot0.apply(this, arguments);
    if (!this.titanMode || !p.alive || !p.deployed || this.phase !== "active" || p._aiLastThink === before) return r;
    try { if (p._tAsc) return r; if (p._titan) titanBrain(this, p); else seekGauntlet(this, p); } catch (e) {}
    return r;
  };
  void ctor0;

  /* ================================================================ interface */
  var UI = null, lastNews = 0;
  function css() {
    var s = document.createElement("style"); s.id = "az-titan-css";
    s.textContent = [
      "#az-titan-ui{position:fixed;inset:0;pointer-events:none;z-index:60;font-family:BarlowCondensed,'Arial Narrow',system-ui,sans-serif;color:#fff}",
      "#az-titan-ui .tt-banner{position:absolute;left:50%;top:calc(14% + env(safe-area-inset-top,0px));transform:translateX(-50%);max-width:min(92vw,760px);padding:10px 22px;border-radius:6px;background:linear-gradient(90deg,rgba(40,14,4,.0),rgba(60,20,6,.88) 18%,rgba(60,20,6,.88) 82%,rgba(40,14,4,0));text-align:center;font-weight:800;font-size:clamp(17px,2.6vw,27px);letter-spacing:.04em;text-transform:uppercase;text-shadow:0 2px 6px rgba(0,0,0,.7);opacity:0;transition:opacity .35s}",
      "#az-titan-ui .tt-banner.on{opacity:1}#az-titan-ui .tt-banner b{color:#ffb35c}",
      "#az-titan-ui .tt-prompt{position:absolute;left:50%;bottom:calc(30% + env(safe-area-inset-bottom,0px));transform:translateX(-50%);padding:8px 16px;border-radius:6px;background:rgba(12,10,14,.78);border:1px solid rgba(255,150,60,.65);font-weight:800;font-size:18px;letter-spacing:.05em;display:none;pointer-events:auto}",
      "#az-titan-ui .tt-prompt kbd{display:inline-block;min-width:22px;margin-right:8px;padding:1px 6px;border-radius:4px;background:#ffb35c;color:#1a0d04;text-align:center}",
      "#az-titan-ui .tt-mark{position:absolute;transform:translate(-50%,-50%);display:none;text-align:center;white-space:pre-line;font-weight:800;font-size:13px;letter-spacing:.06em;text-shadow:0 1px 3px #000}",
      "#az-titan-ui .tt-mark i{display:block;width:26px;height:26px;margin:0 auto 2px;border-radius:50%;background:radial-gradient(circle,#fff2d0 0,#ff9a40 45%,rgba(255,90,20,0) 72%);box-shadow:0 0 14px #ff8a2a}",
      "#az-titan-ui .tt-edge{position:absolute;transform:translate(-50%,-50%);display:none;text-align:center;font-weight:800;font-size:12px;letter-spacing:.08em;color:#ffd09a;text-shadow:0 1px 3px #000}#az-titan-ui .tt-edge b{display:block;font-size:26px;line-height:1;color:#ff8a2a;filter:drop-shadow(0 0 6px #ff6a1a)}",
      "#az-titan-ui .tt-mark.enemy i{background:radial-gradient(circle,#fff 0,#ff4a2a 45%,rgba(255,40,20,0) 72%);box-shadow:0 0 14px #ff3a1a}",
      "#az-titan-ui .tt-pw{position:absolute;left:50%;bottom:calc(168px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:none;gap:8px;pointer-events:auto}",
      "#az-titan-ui .tt-pw.on{display:flex}",
      "#az-titan-ui .tt-b{position:relative;width:62px;height:62px;border-radius:10px;border:2px solid rgba(255,170,90,.75);background:linear-gradient(160deg,#3a1e10,#140c0a);color:#ffd9a8;font:800 25px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;touch-action:manipulation;-webkit-user-select:none;user-select:none}",
      "#az-titan-ui .tt-b small{position:absolute;left:5px;top:3px;font:800 12px/1 system-ui,sans-serif;color:#ffb35c}",
      "#az-titan-ui .tt-b em{position:absolute;left:0;right:0;bottom:3px;font:700 9px/1 system-ui,sans-serif;font-style:normal;text-align:center;color:#f3dcc4;letter-spacing:.02em;white-space:nowrap}",
      "#az-titan-ui .tt-b .cd{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.66);height:0}",
      "#az-titan-ui .tt-b .cdt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 19px/1 system-ui,sans-serif;color:#fff}",
      "#az-titan-ui .tt-b.ready{box-shadow:0 0 12px rgba(255,140,50,.55)}",
      "#az-titan-ui .tt-tag{position:absolute;left:50%;bottom:calc(240px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:none;font-weight:800;font-size:15px;letter-spacing:.2em;color:#ffb35c;text-shadow:0 1px 4px #000}",
      "@media (pointer:coarse){#az-titan-ui .tt-pw{left:auto;right:calc(14px + env(safe-area-inset-right,0px));bottom:auto;top:30%;transform:none;display:none;flex-wrap:wrap;width:150px;justify-content:flex-end}#az-titan-ui .tt-pw.on{display:flex}#az-titan-ui .tt-b{width:44px;height:44px;font-size:19px;border-radius:50%}#az-titan-ui .tt-b em{display:none}#az-titan-ui .tt-tag{bottom:auto;top:24%;left:auto;right:18px;transform:none}#az-titan-ui .tt-prompt{bottom:38%}}"
    ].join("\n");
    document.head.appendChild(s);
  }
  function send(input) { var g = root.AZUR; if (g && typeof g.send === "function") g.send(input); }
  function buildUi() {
    css();
    var d = document.createElement("div"); d.id = "az-titan-ui";
    d.innerHTML = '<div class="tt-banner"></div><div class="tt-prompt"><kbd>E</kbd>Ramasser le Gant du Titan</div><div class="tt-mark gl"><i></i><span></span></div><div class="tt-mark enemy ti"><i></i><span></span></div><div class="tt-edge"><b>➤</b><span>GANT</span></div><div class="tt-tag">TITAN</div><div class="tt-pw"></div>';
    document.body.appendChild(d);
    var pw = d.querySelector(".tt-pw"), btns = [];
    for (var k = 1; k <= 6; k++) {
      var b = document.createElement("button"); b.className = "tt-b"; b.type = "button"; b.setAttribute("aria-label", POWERS[k].name);
      b.innerHTML = "<small>" + POWERS[k].key + "</small>" + POWERS[k].ico + "<em>" + POWERS[k].name + "</em><div class=\"cd\"></div><div class=\"cdt\"></div>";
      (function (kk) { var go = function (ev) { ev.preventDefault(); ev.stopPropagation(); send({ titanPower: kk }); }; b.addEventListener("pointerdown", go); })(k);
      pw.appendChild(b); btns.push({ el: b, cd: b.querySelector(".cd"), cdt: b.querySelector(".cdt"), k: k });
    }
    d.querySelector(".tt-prompt").addEventListener("pointerdown", function (ev) { ev.preventDefault(); send({ interact: true }); });
    UI = { root: d, edge: d.querySelector(".tt-edge"), banner: d.querySelector(".tt-banner"), prompt: d.querySelector(".tt-prompt"), mGl: d.querySelector(".tt-mark.gl"), mTi: d.querySelector(".tt-mark.ti"), pw: pw, btns: btns, tag: d.querySelector(".tt-tag"), bannerUntil: 0 };
  }
  var _pv = null;
  function mark(el, cam, x, y, z, label, W, Hh) {
    _pv = _pv || new T.Vector3(); _pv.set(x, y, z).project(cam);
    var behind = _pv.z > 1, sx = (_pv.x * .5 + .5) * W, sy = (-_pv.y * .5 + .5) * Hh;
    if (behind) { sx = W - sx; sy = Hh - 40; }
    sx = Math.max(30, Math.min(W - 30, sx)); sy = Math.max(60, Math.min(Hh - 90, sy));
    el.style.display = "block"; el.style.left = sx + "px"; el.style.top = sy + "px"; el.lastChild.textContent = label;
  }
  function edgeMark(el, cam, x, y, z, W, Hh) {
    _pv = _pv || new T.Vector3(); _pv.set(x, y, z).project(cam);
    var behind = _pv.z > 1, nx = behind ? -_pv.x : _pv.x, ny = behind ? -_pv.y : _pv.y;
    if (!behind && Math.abs(nx) < .92 && Math.abs(ny) < .9) { el.style.display = "none"; return; }
    var m = Math.max(Math.abs(nx) / .9, Math.abs(ny) / .82, 1e-3); nx /= m; ny /= m;
    var ang = Math.atan2(-ny, nx) * 180 / Math.PI; // ➤ pointe vers la droite : on le tourne vers le météore
    el.style.display = "block"; el.style.left = ((nx * .5 + .5) * W) + "px"; el.style.top = ((-ny * .5 + .5) * Hh) + "px"; el.firstChild.style.transform = "rotate(" + ang.toFixed(0) + "deg)";
  }
  function glTag(w, G) {
    if (G.phase === "falling") return "\nimpact dans " + Math.max(0, Math.ceil(G.fallStart + CFG.fall - w.elapsed)) + " s";
    var l = (G.lock || 0) - w.elapsed; return l > 0 ? "\nles IA attendent encore " + Math.ceil(l) + " s" : "";
  }
  function uiTick() {
    root.requestAnimationFrame(uiTick);
    var g = root.AZUR, w = g && g.world;
    if (!w || !w.titanMode || g.screen !== "game") { if (UI) UI.root.style.display = "none"; return; }
    if (!UI) buildUi(); UI.root.style.display = "block";
    var G = w.titan || {}, p = g.player && g.player(), now = performance.now() / 1000, cam = g.view && g.view.camera;
    // annonces
    var nw = G.news && G.news[G.news.length - 1];
    if (nw && nw.seq !== lastNews) { lastNews = nw.seq; UI.banner.innerHTML = nw.text.replace(/(Titan|gant|Gant du Titan)/g, "<b>$1</b>"); UI.bannerUntil = now + 4.5; }
    UI.banner.classList.toggle("on", now < UI.bannerUntil);
    if (!p) return;
    var meT = !!(p._titan && p.alive), W = innerWidth, Hh = innerHeight;
    // invite à ramasser
    var near = G.phase === "ground" && p.alive && !meT && Math.hypot(p.x - G.x, p.z - G.z) < CFG.race.humanR + 1.5 && Math.abs(p.y - G.y) < 5;
    UI.prompt.style.display = near ? "block" : "none";
    // repères : le gant (au sol ou en chute) et le Titan
    if (cam && (G.phase === "ground" || G.phase === "falling") && !meT) mark(UI.mGl, cam, G.x, G.y + 8.5, G.z, "GANT " + Math.round(Math.hypot(p.x - G.x, p.z - G.z)) + " m" + glTag(w, G), W, Hh); else UI.mGl.style.display = "none";
    // le météore lui-même : s'il est hors du champ, une flèche au bord de l'écran montre où regarder
    if (cam && G.phase === "falling" && G.from && !meT) {
      var k = Math.min(1, Math.max(0, (w.elapsed - G.fallStart) / CFG.fall)), kk = k * k;
      edgeMark(UI.edge, cam, G.from.x + (G.x - G.from.x) * kk, G.from.y + (G.y + 3 - G.from.y) * kk, G.from.z + (G.z - G.from.z) * kk, W, Hh);
    } else UI.edge.style.display = "none";
    var h = G.phase === "held" ? w._find(G.holder) : null;
    if (cam && h && h.alive && h !== p) mark(UI.mTi, cam, h.x, h.y + 4.6, h.z, "TITAN " + Math.round(Math.hypot(p.x - h.x, p.z - h.z)) + " m", W, Hh); else UI.mTi.style.display = "none";
    // barre des pouvoirs
    var ready = meT && !p._tAsc;
    UI.pw.classList.toggle("on", ready); UI.tag.style.display = ready ? "block" : "none";
    if (ready) UI.btns.forEach(function (b) {
      var c = (p._tcd && p._tcd[b.k]) || 0, full = CFG.cd[b.k] || 1, active = (b.k === 2 && p._tBeam > 0) || (b.k === 5 && p._tGuard > 0);
      b.cd.style.height = (c > 0 ? Math.min(100, c / full * 100) : 0) + "%"; b.cdt.textContent = c > 0 && !active ? Math.ceil(c) : "";
      b.el.classList.toggle("ready", !(c > 0)); b.el.style.borderColor = active ? "#fff2c8" : "";
    });
  }
  function onKey(e) {
    var g = root.AZUR, w = g && g.world; if (!w || !w.titanMode || g.screen !== "game" || g.modal) return;
    var p = g.player && g.player(); if (!p || !p._titan || !p.alive) return;
    var m = /^Digit([1-6])$/.exec(e.code || ""); if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) send({ titanPower: +m[1] });
  }
  if (root.addEventListener) root.addEventListener("keydown", onKey, true);
  if (root.requestAnimationFrame) root.requestAnimationFrame(uiTick);
  root.AZTitanMode.becomeTitan = becomeTitan; root.AZTitanMode.state = st; root.AZTitanMode.usePower = usePower; root.AZTitanMode.holder = holder;
  root.AZTitanMode.fwd = fwd; root.AZTitanMode.aim = aim;
})(typeof globalThis !== "undefined" ? globalThis : this);
