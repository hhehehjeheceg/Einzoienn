/* AZUR v122 — mode « Gant du Titan » (bataille royale solo, 100 participants).
 * Peu après le début de la partie, un météore tombe du ciel avec le Gant du Titan. Celui qui le ramasse (E) devient le
 * Titan : un colosse de 700 PV et 300 de bouclier, sans armes ni constructions, avec six pouvoirs. Tout le monde peut
 * l'attaquer ; quand il tombe, le gant reste à terre et le premier qui le ramasse devient le nouveau Titan.
 * Pouvoirs : 1 / clic = coup de poing (repousse, casse les constructions) · 2 = rayon du gant · 3 = saut écrasant (onde
 * au sol à l'atterrissage) · 4 = bond éclair (téléportation courte) · 5 = bouclier d'énergie (-75 % de dégâts) ·
 * 6 = attraction (tire les ennemis proches vers lui). Chaque élimination lui rend du bouclier et de la vie.
 * v123 — quand on ramasse le gant : il s'élève à 200 m, lève le gant, serre le poing (il grandit d'un coup), puis
 * tombe en chute libre et s'écrase au sol (onde de choc). Intouchable pendant toute la séquence.
 * v124 — des contrôles qu'on comprend : clic = enchaînement de 3 coups de poing (le 3e fait décoller) ; clic droit ou 2
 * MAINTENU = rayon qui suit la visée tant qu'il reste de l'énergie ; saut = appui court pour sauter, appui long pour
 * s'accroupir, se charger et bondir très haut (onde de choc à l'atterrissage) ; accroupi (C) ou 3 en l'air =
 * écrasement, plongeon poing en avant. Mode créatif : l'atelier donne le gant ou le fait tomber du ciel.
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
    cd: [0, .38, 0, 1.2, 6, 16, 12],    // recharge (s) : 1 entre deux coups · 2 rayon (jauge) · 3 super saut · 4 bond · 5 bouclier · 6 attraction
    // coups de poing : un enchaînement de 3 (direct, crochet, uppercut qui fait décoller) ; après le 3e, une courte pause
    punch: { dmg: [55, 55, 95], range: 6, cone: .5, build: 450, combo: 1, gap: .38, end: .75 },
    // rayon : maintenu, il suit la visée ; il vide une jauge (100 → 0 en ~3,3 s) qui se remplit dès qu'on arrête
    beam: { dps: 80, len: 95, width: 2.8, charge: .25, energy: 100, drain: 30, regen: 22, delay: .5, min: 18, burst: 1.2, bot: 1.6, build: 380 },
    // saut : tap = 3 m ; maintenu 0,9 s = 21 m (gravité 16) ; au-delà de 30 % de charge, onde de choc à l'atterrissage
    jump: { tap: 10, max: 26, charge: .9, hold: 1.5, fwd: 12, slamMin: .3, slow: .35 },
    pound: { vy: 46, minH: 3.5 },        // écrasement : plongeon à 46 m/s depuis au moins 3,5 m
    slam: { vy: 16.5, fwd: 10.5, dmg: 75, r: 12, build: 600 },
    blink: 24, guard: { time: 5, k: .25 },
    pull: { r: 34, dmg: 25, time: .85, speed: 22 },
    // la transformation : il s'élève, lève le gant, serre le poing, puis chute libre jusqu'au sol
    asc: { lift: .45, rise: 2.8, hover: .8, clench: .8, height: 200, g: 34, vmax: 85, steer: 10, drift: 30 },
    landing: { r: 17, dmg: 90, build: 900 }
  };
  var POWERS = [null,
    { key: "1", name: "Coups de poing", ico: "✊", pc: "Clic" }, { key: "2", name: "Rayon", ico: "☄", pc: "Clic droit" }, { key: "3", name: "Super saut", ico: "⬆", pc: "Espace" },
    { key: "4", name: "Bond éclair", ico: "⚡", pc: "4" }, { key: "5", name: "Bouclier", ico: "◈", pc: "5" }, { key: "6", name: "Attraction", ico: "◎", pc: "6" }];
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
    p._tcd = [0, 0, 0, 0, 0, 0, 0]; p._tq = []; p._tGuard = 0; p._tBeam = 0; p._tSlam = false; p._tBeamAcc = 0; p.flying = false;
    p._tEnergy = CFG.beam.energy; p._tBeamOn = false; p._tBeamHold = false; p._tBeamBot = 0; p._tCombo = 0; p._tJc = null; p._tSuper = null; p._tPound = false; p._tLeap = null;
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
    else if (A.phase === "hover") { p.y = top + Math.sin(A.t * 3) * .25; if (A.t >= C.hover) { nextPhase(A, "clench"); fx(w, "clench", p.x, p.y, p.z, { id: p.id }); news(w, p.bot ? p.name + " est devenu le Titan !" : "Tu es devenu le Titan !", "titan"); } }
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
    if (p) { p._titan = false; p._tBeam = 0; p._tGuard = 0; p._tAsc = null; p._tBeamOn = false; p._tBeamHold = false; p._tBeamBot = 0; p._tJc = null; p._tSuper = null; p._tPound = false; p._tLeap = null; p._tSlam = false; if (p._titanEq) p.equipment = p._titanEq; delete p.maxHp; delete p.maxShield; }
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
  // coups de poing : direct, crochet, puis un uppercut qui fait décoller (un clic maintenu enchaîne tout seul)
  function punch(w, p) {
    if ((p._tcd[1] || 0) > 0 || p._tJc) return false;
    var P = CFG.punch, e = w.elapsed, n = (p._tPunchAt != null && e - p._tPunchAt < P.combo && (p._tCombo || 0) < 3) ? (p._tCombo || 0) + 1 : 1, up = n === 3;
    p._tCombo = n; p._tcd[1] = up ? P.end : P.gap; p._cool = p._tcd[1]; p._tPunchAt = e; p._tPunchN = (p._tPunchN || 0) + 1;
    var f = fwd(p.yaw), hit = 0, dmg = P.dmg[n - 1];
    w.players.forEach(function (q) {
      if (!foe(p, q)) return; var dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > P.range + (up ? .8 : 0) || Math.abs(q.y - p.y) > 4.5) return;
      if (d > .8 && (dx * f.x + dz * f.z) / d < (up ? .2 : P.cone)) return;
      w._damage(q, p, dmg, "Titan", {}); knock(q, dx / (d || 1), dz / (d || 1), up ? 8 : 15, up ? 13 : 6.5); hit++;
    });
    smash(w, p.x + f.x * 3, p.y + 1, p.z + f.z * 3, up ? 4.6 : 3.8, P.build, p);
    fx(w, "punch", p.x + f.x * 2.8, p.y + 1.7, p.z + f.z * 2.8, { id: p.id, hit: hit, n: n });
    return true;
  }
  function beamTick(w, p, dt) {
    if (p._tBeamCharge > 0) { p._tBeamCharge = Math.max(0, p._tBeamCharge - dt); p._tBeamAcc = 0; }
    else p._tBeamAcc = (p._tBeamAcc || 0) + dt;
    var d = aim(p), f = fwd(p.yaw), ox = p.x + f.x * 1.1, oy = p.y + 2.5, oz = p.z + f.z * 1.1, len = CFG.beam.len;
    for (var s = 4; s < CFG.beam.len; s += 2) { if (oy + d.y * s < H(ox + d.x * s, oz + d.z * s) - .3) { len = s; break; } }
    p._tBeamEnd = { x: ox + d.x * len, y: oy + d.y * len, z: oz + d.z * len, len: len, ground: len < CFG.beam.len };
    if (p._tBeamCharge > 0 || p._tBeamAcc < .2) return;
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
  // le rayon reste allumé tant qu'on le maintient (clic droit, 2, bouton) et qu'il reste de l'énergie ; il suit la visée
  function beamStep(w, p, dt) {
    var B = CFG.beam;
    if (p._tEnergy == null) p._tEnergy = B.energy;
    if (p._tBeamBot > 0) p._tBeamBot = Math.max(0, p._tBeamBot - dt);
    var want = !!(p._tBeamHold || p._tBeamBot > 0) && !p._tJc;
    if (want && !p._tBeamOn && p._tEnergy >= B.min) { p._tBeamOn = true; p._tBeamCharge = B.charge; p._tBeamAcc = 0; p._tBeamAt = w.elapsed; fx(w, "beam", p.x, p.y, p.z, { id: p.id }); }
    if (p._tBeamOn && (!want || p._tEnergy <= 0)) {
      p._tBeamOn = false; p._tBeamCharge = 0; p._tEnergyWait = p._tEnergy <= 0 ? B.delay * 2.4 : B.delay;
      if (p._tEnergy <= 0) { p._tBeamHold = false; p._tBeamBot = 0; if (!p.bot) w._emit("message", p.x, p.y, p.z, { playerId: p.id, text: "Rayon à plat : la jauge se recharge" }); }
    }
    if (p._tBeamOn) { if (!(p._tBeamCharge > 0)) p._tEnergy = Math.max(0, p._tEnergy - B.drain * dt); p._tBeam = 1; beamTick(w, p, dt); }
    else { p._tBeam = 0; p._tBeamEnd = null; if (p._tEnergyWait > 0) p._tEnergyWait -= dt; else p._tEnergy = Math.min(B.energy, p._tEnergy + B.regen * dt); }
  }
  // saut : appui court = saut ; appui long = il s'accroupit, se charge, puis bondit (jusqu'à ~21 m) avec son élan
  function hAbove(w, p) { var g = w.supportAt ? w.supportAt(p.x, p.z, p.y + .3) : H(p.x, p.z); return p.y - (isFinite(g) ? g : H(p.x, p.z)); }
  function jumpPress(w, p, auto) {
    if (p._tAsc || p._tJc || !p.grounded || p.jumping || p.falling || p.swimming || p.vehicleId) return;
    if ((p._tcd[3] || 0) > 0) { launch(w, p, 0); return; } // pendant la recharge du super saut : un saut simple
    p._tJc = { t: 0, rel: false, auto: !!auto };
  }
  function jumpRelease(w, p) { if (p._tJc) p._tJc.rel = true; }
  function launch(w, p, c) {
    var J = CFG.jump, i = p._input || {}, f = fwd(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), mx = +i.moveX || 0, mz = +i.moveZ || 0;
    c = Math.max(0, Math.min(1, c)); p._tJc = null;
    p._vy = J.tap + (J.max - J.tap) * c; p.grounded = false; p.jumping = true; p.falling = false; p.crouching = false; p._jumpTime = 0;
    var dx = f.x * mz + rx * mx, dz = f.z * mz + rz * mx, dl = Math.hypot(dx, dz);
    p._tLeap = dl > .2 && c > .15 ? { x: dx / dl * J.fwd * c, z: dz / dl * J.fwd * c } : null;
    p._tSuper = c >= J.slamMin ? { c: c } : null; p._tPound = false;
    if (c >= J.slamMin) p._tcd[3] = CFG.cd[3];
    p._tJumpAt = w.elapsed; p._tJumpC = c;
    fx(w, c >= J.slamMin ? "superjump" : "jump", p.x, p.y, p.z, { id: p.id, c: c });
    w._emit("jump", p.x, p.y, p.z, { playerId: p.id, ordinary: c < J.slamMin });
  }
  function chargeStep(w, p, dt) {
    var C = p._tJc; if (!C) return;
    if (!p.grounded || p._tAsc || p.swimming || p.vehicleId) { p._tJc = null; return; }
    C.t += dt;
    var J = CFG.jump;
    if (C.rel || C.t >= J.hold || (C.auto && C.t >= .1) || (p.bot && C.t >= J.charge)) launch(w, p, C.t / J.charge);
  }
  // écrasement : en l'air, il plonge poing en avant et frappe le sol
  function pound(w, p) {
    if (p._tPound || p.grounded || hAbove(w, p) < CFG.pound.minH) return false;
    p._tPound = true; p._tLeap = null; p.jumping = true; p.falling = false; p.gliding = false; p._vy = -CFG.pound.vy; p._tPoundAt = w.elapsed;
    fx(w, "pound", p.x, p.y, p.z, { id: p.id }); return true;
  }
  // l'atterrissage d'un super saut ou d'un écrasement : onde de choc (plus forte si le saut était chargé)
  function slam(w, p) {
    var big = !!p._tPound, c = big ? 1 : (p._tSuper ? p._tSuper.c : 1), S2 = CFG.slam, r = S2.r * (big ? 1.25 : .6 + .5 * c), dmg = S2.dmg * (big ? 1.3 : .5 + .6 * c);
    p._tSuper = null; p._tPound = false; p._tLeap = null; p._tSlam = false;
    w.players.forEach(function (q) {
      if (!foe(p, q)) return; var dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > r || Math.abs(q.y - p.y) > 6) return; var k = 1 - d / (r * 1.15);
      w._damage(q, p, dmg * k, "Titan", {}); knock(q, dx / (d || 1), dz / (d || 1), 6 + 10 * k, 3 + 8 * k);
    });
    smash(w, p.x, p.y + 1, p.z, big ? 10 : 6 + 3 * c, S2.build, p);
    p._tSlamAt = w.elapsed; fx(w, "slam", p.x, p.y, p.z, { id: p.id, c: c, big: big, r: r });
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
    if (!p._titan || !p.alive || !p.deployed || p._tAsc) return false;
    // 3 : au sol, super saut chargé à fond ; en l'air, écrasement
    if (k === 3) { if (!p.grounded) return pound(w, p); if ((p._tcd[3] || 0) > 0 || p.swimming || p.vehicleId || p._tJc) return false; launch(w, p, p.bot && p._tAiJc ? p._tAiJc : 1); return true; }
    if ((p._tcd[k] || 0) > 0) return false;
    if (k === 1) return punch(w, p);
    // 2 sans maintien (ancienne touche, IA) : une rafale courte qui suit la visée
    if (k === 2) { p._tBeamBot = Math.max(p._tBeamBot || 0, p.bot ? CFG.beam.bot : CFG.beam.burst); return true; }
    if (k === 4) return blink(w, p);
    if (k === 5) { p._tGuard = CFG.guard.time; p._tcd[5] = CFG.cd[5]; p._tGuardAt = w.elapsed; fx(w, "guard", p.x, p.y, p.z, { id: p.id, time: CFG.guard.time }); return true; }
    if (k === 6) return pull(w, p);
    return false;
  }
  function stepTitan(w, dt) {
    var G = st(w); if (w.phase !== "active" && !w.titanCreative) return;
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
    if (input && typeof input === "object") {
      // mode créatif / entraînement : l'atelier donne le gant ou le fait tomber du ciel
      if ((input.titanGive === true || input.titanMeteor === true) && (this.mode === "creative" || this.mode === "training")) { var pc = this._find(id); if (pc && pc.alive) creativeGauntlet(this, pc, input.titanMeteor === true); }
      if (this.titanMode) {
        var p = this._find(id);
        if (p && p._titan) {
          if (Number.isInteger(input.titanPower) && input.titanPower >= 1 && input.titanPower <= 6) { (p._tq || (p._tq = [])).push(input.titanPower); if (p._tq.length > 6) p._tq.shift(); }
          if (typeof input.titanBeam === "boolean") p._tBeamHold = input.titanBeam;
          if (input.titanJump === 1) { p._tJclient = true; jumpPress(this, p, false); } else if (input.titanJump === 0) { p._tJclient = true; jumpRelease(this, p); }
        }
      }
    }
    return cmd0.apply(this, arguments);
  };
  // le saut du jeu (Espace, bouton, manette) : pour le Titan, il passe par le saut chargé
  var edge0 = Wp._edge;
  Wp._edge = function (p, e) {
    if (this.titanMode && p && p._titan && e && e.jump) {
      var rest = {}; for (var k in e) if (k !== "jump") rest[k] = e[k];
      if (!p._tAsc && !p._tJc) jumpPress(this, p, !p._tJclient || p.bot);
      return edge0.call(this, p, rest);
    }
    return edge0.apply(this, arguments);
  };
  function creativeGauntlet(w, p, meteor) {
    w.titanMode = true; w.titanCreative = true;
    var G = st(w); if (G.phase === "pending") G.phase = "idle";
    if (meteor) {
      var h = holder(w); if (h) dropGauntlet(w, h);
      var f = fwd(p.yaw), best = null;
      for (var t = 0; t < 40 && !best; t++) { var a = Math.atan2(f.z, f.x) + (t % 2 ? 1 : -1) * Math.floor(t / 2) * .35, d = 40 + (t % 3) * 8, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, y = openGround(w, x, z); if (y != null) best = { x: x, y: y, z: z }; }
      if (!best) best = { x: p.x + f.x * 40, z: p.z + f.z * 40, y: H(p.x + f.x * 40, p.z + f.z * 40) };
      G.x = best.x; G.y = best.y; G.z = best.z; G.region = ""; G.phase = "falling"; G.fallStart = w.elapsed; G.holder = null;
      var a2 = Math.atan2(G.z - p.z, G.x - p.x) + .9; G.from = { x: G.x + Math.cos(a2) * 1500, y: G.y + 700, z: G.z + Math.sin(a2) * 1500 };
      fx(w, "meteor", G.x, G.y, G.z, {}); news(w, "Le Gant du Titan tombe du ciel devant toi !", "meteor");
      return;
    }
    if (p._titan) { dropGauntlet(w, p); news(w, "Tu as rendu le Gant du Titan.", "drop"); return; }
    var h2 = holder(w); if (h2 && h2 !== p) dropGauntlet(w, h2);
    p.flying = false; becomeTitan(w, p);
  }
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
    var inp = p._input || (p._input = {});
    inp.sprint = true;                               // il court toujours
    // accroupi : en l'air, c'est l'écrasement ; au sol le Titan ne s'accroupit jamais
    // (la touche accroupi bascule un état : chaque changement compte comme un appui)
    var cr = !!inp.crouch; if (cr !== !!p._tCrouchState) { p._tCrouchState = cr; if (!p.grounded) pound(this, p); }
    var crKeep = inp.crouch; inp.crouch = false;
    // pendant la charge du saut, il avance lentement, accroupi
    var mxKeep = inp.moveX, mzKeep = inp.moveZ;
    if (p._tJc) { inp.moveX = (+inp.moveX || 0) * CFG.jump.slow; inp.moveZ = (+inp.moveZ || 0) * CFG.jump.slow; inp.sprint = false; }
    var r = up0.apply(this, arguments);
    inp.crouch = crKeep; if (p._tJc) { inp.moveX = mxKeep; inp.moveZ = mzKeep; }
    if (!p.alive || !p._titan) return r;
    var q = p._tq; while (q && q.length) usePower(this, p, q.shift());
    chargeStep(this, p, dt);
    beamStep(this, p, dt);
    // l'élan du super saut : il continue vers l'avant jusqu'à l'atterrissage (les murs l'arrêtent)
    if (p._tLeap && (p.jumping || p.falling)) { var lx = p.x + p._tLeap.x * dt, lz = p.z + p._tLeap.z * dt; if (!this._blocked(lx, lz, .46, p.y)) { p.x = lx; p.z = lz; } else p._tLeap = null; }
    if ((p._tSuper || p._tPound) && p.grounded && !p.jumping) slam(this, p);
    if (p.grounded && !p.jumping && p._tLeap) p._tLeap = null;
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
      if (killer && killer !== p && killer._titan && killer.alive) { killer.shield = Math.min(CFG.shield, killer.shield + CFG.killShield); killer.hp = Math.min(CFG.hp, killer.hp + CFG.killHp); killer._tTauntAt = this.elapsed; fx(this, "taunt", killer.x, killer.y, killer.z, { id: killer.id }); }
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
    else if (vis && bd < 60 && (p._tEnergy == null || p._tEnergy > 45) && !p._tBeamOn && rnd < .4) q.push(2);
    else if (bd > 8 && bd < 22 && !(cd[3] > 0) && p.grounded && rnd < .45) { p._tAiJc = Math.min(1, Math.max(.35, (bd - 4) / 30)); q.push(3); } // un bond dosé pour retomber sur sa cible
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
  var UI = null, lastNews = 0, helpUntil = 0, wasReady = false;
  var TOUCH = !!(root.matchMedia && root.matchMedia("(pointer:coarse)").matches);
  // l'aide qui s'affiche quand on devient le Titan (H pour la revoir)
  var HELP = TOUCH ? [
    ["Bouton tir", "Coups de poing : 3 à la suite, le 3e fait décoller"],
    ["☄ maintenu", "Rayon : il suit ta visée tant que la jauge n'est pas vide"],
    ["Saut maintenu", "Super saut, onde de choc à l'atterrissage"],
    ["Accroupi en l'air", "Écrasement : plongeon poing en avant"],
    ["⚡  ◈  ◎", "Bond éclair · Bouclier · Attraction"]
  ] : [
    ["Clic gauche", "Coups de poing : 3 à la suite, le 3e fait décoller"],
    ["Clic droit / 2 maintenu", "Rayon : il suit ta visée tant que la jauge n'est pas vide"],
    ["Espace maintenu", "Super saut, onde de choc à l'atterrissage (appui court : saut simple)"],
    ["C ou 3 en l'air", "Écrasement : plongeon poing en avant"],
    ["4 · 5 · 6", "Bond éclair · Bouclier · Attraction"],
    ["H", "Revoir cette aide"]
  ];
  var SHORT = [null, "Clic", "Clic dr.", "Espace", "4", "5", "6"];
  function css() {
    var s = document.createElement("style"); s.id = "az-titan-css";
    s.textContent = [
      "#az-titan-ui{position:fixed;inset:0;pointer-events:none;z-index:60;font-family:BarlowCondensed,'Arial Narrow',system-ui,sans-serif;color:#fff}",
      "#az-titan-ui .tt-banner{position:absolute;left:50%;top:calc(14% + env(safe-area-inset-top,0px));transform:translateX(-50%);max-width:min(92vw,760px);padding:10px 22px;border-radius:6px;background:linear-gradient(90deg,rgba(40,14,4,.0),rgba(60,20,6,.88) 18%,rgba(60,20,6,.88) 82%,rgba(40,14,4,0));text-align:center;font-weight:800;font-size:clamp(17px,2.6vw,27px);letter-spacing:.04em;text-transform:uppercase;text-shadow:0 2px 6px rgba(0,0,0,.7);opacity:0;transition:opacity .35s}",
      "#az-titan-ui .tt-banner.on{opacity:1}#az-titan-ui .tt-banner b{color:#ffb35c}",
      "#az-titan-ui .tt-help{position:absolute;left:50%;top:calc(9% + env(safe-area-inset-top,0px));transform:translateX(-50%);width:min(470px,90vw);padding:9px 14px 8px;border-radius:10px;background:rgba(14,9,6,.88);border:1px solid rgba(255,160,80,.55);box-shadow:0 8px 30px rgba(0,0,0,.45);opacity:0;transition:opacity .4s;pointer-events:none}",
      "#az-titan-ui .tt-help.on{opacity:1}",
      "#az-titan-ui .tt-help h4{margin:0 0 5px;font-size:clamp(14px,1.9vw,19px);letter-spacing:.14em;color:#ffb35c;text-align:center}",
      "#az-titan-ui .tt-help div{display:flex;gap:8px;align-items:baseline;margin:3px 0;font-size:clamp(11px,1.35vw,13.5px);font-weight:700;letter-spacing:.02em}",
      "#az-titan-ui .tt-help kbd{flex:0 0 auto;min-width:128px;padding:0 6px;border-radius:4px;background:#ffb35c;color:#1a0d04;font:800 10.5px/1.6 system-ui,sans-serif;text-align:center}",
      "#az-titan-ui .tt-help p{margin:5px 0 0;text-align:center;font-size:10.5px;color:#f3dcc4;opacity:.85}",
      "#az-titan-ui .tt-prompt{position:absolute;left:50%;bottom:calc(30% + env(safe-area-inset-bottom,0px));transform:translateX(-50%);padding:8px 16px;border-radius:6px;background:rgba(12,10,14,.78);border:1px solid rgba(255,150,60,.65);font-weight:800;font-size:18px;letter-spacing:.05em;display:none;pointer-events:auto}",
      "#az-titan-ui .tt-prompt kbd{display:inline-block;min-width:22px;margin-right:8px;padding:1px 6px;border-radius:4px;background:#ffb35c;color:#1a0d04;text-align:center}",
      "#az-titan-ui .tt-mark{position:absolute;transform:translate(-50%,-50%);display:none;text-align:center;white-space:pre-line;font-weight:800;font-size:13px;letter-spacing:.06em;text-shadow:0 1px 3px #000}",
      "#az-titan-ui .tt-mark i{display:block;width:26px;height:26px;margin:0 auto 2px;border-radius:50%;background:radial-gradient(circle,#fff2d0 0,#ff9a40 45%,rgba(255,90,20,0) 72%);box-shadow:0 0 14px #ff8a2a}",
      "#az-titan-ui .tt-edge{position:absolute;transform:translate(-50%,-50%);display:none;text-align:center;font-weight:800;font-size:12px;letter-spacing:.08em;color:#ffd09a;text-shadow:0 1px 3px #000}#az-titan-ui .tt-edge b{display:block;font-size:26px;line-height:1;color:#ff8a2a;filter:drop-shadow(0 0 6px #ff6a1a)}",
      "#az-titan-ui .tt-mark.enemy i{background:radial-gradient(circle,#fff 0,#ff4a2a 45%,rgba(255,40,20,0) 72%);box-shadow:0 0 14px #ff3a1a}",
      // pouvoirs : petits boutons en bas à gauche (le centre de l'écran reste libre)
      "#az-titan-ui .tt-pw{position:absolute;left:calc(14px + env(safe-area-inset-left,0px));bottom:calc(74px + env(safe-area-inset-bottom,0px));display:none;gap:6px;pointer-events:none;align-items:flex-end}",
      "#az-titan-ui .tt-pw.on{display:flex}",
      "#az-titan-ui .tt-b{pointer-events:auto;position:relative;width:48px;height:48px;padding:0;border-radius:9px;border:2px solid rgba(255,170,90,.7);background:linear-gradient(160deg,rgba(58,30,16,.92),rgba(20,12,10,.92));color:#ffd9a8;font:800 19px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}",
      "#az-titan-ui .tt-b small{position:absolute;left:4px;top:2px;font:800 9px/1 system-ui,sans-serif;color:#ffb35c;white-space:nowrap}",
      "#az-titan-ui .tt-b em{position:absolute;left:0;right:0;bottom:2px;font:700 8px/1 system-ui,sans-serif;font-style:normal;text-align:center;color:#f3dcc4;white-space:nowrap}",
      "#az-titan-ui .tt-b .cd{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.66);height:0}",
      "#az-titan-ui .tt-b .cdt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 16px/1 system-ui,sans-serif;color:#fff}",
      "#az-titan-ui .tt-b .en{position:absolute;left:4px;right:4px;bottom:11px;height:3px;border-radius:2px;background:rgba(0,0,0,.55);overflow:hidden}",
      "#az-titan-ui .tt-b .en i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff7a1e,#ffd27a)}",
      "#az-titan-ui .tt-b.ready{box-shadow:0 0 9px rgba(255,140,50,.45)}",
      "#az-titan-ui .tt-b.on{border-color:#fff2c8;box-shadow:0 0 14px rgba(255,200,120,.9)}",
      "#az-titan-ui .tt-b.help{width:26px;height:26px;font-size:14px;border-radius:50%}",
      // jauges près du viseur : charge du saut (anneau), énergie du rayon (barre)
      "#az-titan-ui .tt-ring{position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;display:none;overflow:visible}",
      "#az-titan-ui .tt-ring circle{fill:none;stroke-width:4}",
      "#az-titan-ui .tt-ring text{fill:#ffe0b0;font:800 9px system-ui,sans-serif;letter-spacing:.1em}",
      "#az-titan-ui .tt-en{position:absolute;left:50%;top:calc(50% + 34px);width:120px;margin-left:-60px;height:6px;border-radius:3px;background:rgba(0,0,0,.5);border:1px solid rgba(255,190,120,.6);overflow:hidden;display:none}",
      "#az-titan-ui .tt-en i{display:block;height:100%;background:linear-gradient(90deg,#ff6a1a,#ffe0a0)}",
      "#az-titan-ui .tt-en.low i{background:#ff3a2a}",
      // la vie du Titan, en haut de l'écran, pour ceux qui le chassent
      "#az-titan-ui .tt-boss{position:absolute;left:50%;top:calc(6px + env(safe-area-inset-top,0px));transform:translateX(-50%);width:min(340px,60vw);display:none;text-align:center;font-weight:800;font-size:12px;letter-spacing:.12em;color:#ffb35c;text-shadow:0 1px 3px #000}",
      "#az-titan-ui .tt-boss .bb{height:7px;margin-top:3px;border-radius:4px;background:rgba(0,0,0,.55);border:1px solid rgba(255,140,60,.6);overflow:hidden;display:flex}",
      "#az-titan-ui .tt-boss .bh{background:linear-gradient(#ff7a4a,#e04a22);height:100%}#az-titan-ui .tt-boss .bs{background:linear-gradient(#7ac8ff,#3a92e8);height:100%}",
      // vision du Titan : les ennemis proches, même derrière les murs
      "#az-titan-ui .tt-vis{position:absolute;width:0;height:0;display:none}",
      "#az-titan-ui .tt-vis b{position:absolute;left:-7px;top:-12px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid #ff3a2a;filter:drop-shadow(0 0 3px #ff2010)}",
      "#az-titan-ui .tt-vis span{position:absolute;left:-20px;top:-25px;width:40px;text-align:center;font:800 10px/1 system-ui,sans-serif;color:#ffb0a0;text-shadow:0 1px 2px #000}",
      // pendant une partie Titan, la barre de vie du jeu est plus petite ; pour le Titan, plus de nom d'objet tenu
      "body.az-titan-match .ch1-vitals{width:13vw!important;min-width:150px!important;left:50%!important;transform:translateX(-50%)!important;bottom:4vh!important;gap:3px!important}",
      "body.az-titan-match .ch1v-row{height:clamp(9px,1.45vh,12px)!important}body.az-titan-match .ch1v-txt{font-size:clamp(8px,1.25vh,10.5px)!important}",
      "body.az-titan-match .ch1v-ico{width:clamp(9px,1.4vh,12px)!important;height:clamp(9px,1.4vh,12px)!important}",
      "body.az-titan-me #ui .hud #ammo{display:none!important}",
      // atelier créatif
      ".tt-crea .tt-crea-p{margin:4px 0 10px;opacity:.85}.tt-crea .tt-crea-a{display:flex;flex-wrap:wrap;gap:8px}",
      "@media (pointer:coarse){#az-titan-ui .tt-pw{left:auto;right:calc(8px + env(safe-area-inset-right,0px));bottom:auto;top:calc(22% + env(safe-area-inset-top,0px));flex-direction:column;flex-wrap:wrap;height:150px;align-content:flex-end}#az-titan-ui .tt-b{width:40px;height:40px;border-radius:50%;font-size:17px}#az-titan-ui .tt-b em,#az-titan-ui .tt-b small{display:none}#az-titan-ui .tt-prompt{bottom:38%}body.az-titan-match .ch1-vitals{width:min(170px,30vw)!important;min-width:0!important;bottom:56px!important}}"
    ].join("\n");
    document.head.appendChild(s);
  }
  function send(input) { var g = root.AZUR; if (g && typeof g.send === "function") g.send(input); }
  function clock() { return (root.performance ? root.performance.now() : Date.now()) / 1000; }
  // le Titan local, prêt à agir (pas pendant la montée)
  function titanReady() { var g = root.AZUR, w = g && g.world; if (!w || !w.titanMode || g.screen !== "game" || g.modal) return null; var p = g.player && g.player(); return p && p._titan && p.alive && !p._tAsc ? p : null; }
  var held = { beamK: false, beamM: false, beamT: null, jumpK: false, jumpT: null, jumpB: null };
  var beamSent = false;
  function beamState() { var on = !!(held.beamK || held.beamM || held.beamT != null); if (on !== beamSent || on) { beamSent = on; send({ titanBeam: on }); } }
  function releaseAll() {
    if (held.jumpK || held.jumpT != null || held.jumpB != null) send({ titanJump: 0 });
    held.beamK = held.beamM = held.jumpK = false; held.beamT = held.jumpT = held.jumpB = null;
    if (beamSent) { beamSent = false; send({ titanBeam: false }); }
  }
  function buildUi() {
    css();
    var d = document.createElement("div"); d.id = "az-titan-ui";
    d.innerHTML = '<div class="tt-banner"></div><div class="tt-help"><h4>TU ES LE TITAN</h4>' + HELP.map(function (r) { return "<div><kbd>" + r[0] + "</kbd><span>" + r[1] + "</span></div>"; }).join("") + '<p>Chaque élimination te rend de la vie et du bouclier · tu vois les ennemis proches à travers les murs</p></div>' +
      '<div class="tt-prompt"><kbd>E</kbd>Ramasser le Gant du Titan</div><div class="tt-mark gl"><i></i><span></span></div><div class="tt-mark enemy ti"><i></i><span></span></div><div class="tt-edge"><b>➤</b><span>GANT</span></div>' +
      '<div class="tt-pw"></div><svg class="tt-ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" stroke="rgba(0,0,0,.45)"/><circle class="arc" cx="30" cy="30" r="26" stroke="#ffb35c" stroke-dasharray="163.4" stroke-dashoffset="163.4" transform="rotate(-90 30 30)"/><text x="30" y="72" text-anchor="middle">SUPER SAUT</text></svg>' +
      '<div class="tt-en"><i></i></div><div class="tt-boss"><span></span><div class="bb"><div class="bh"></div><div class="bs"></div></div></div>';
    document.body.appendChild(d);
    var pw = d.querySelector(".tt-pw"), btns = [];
    for (var k = 1; k <= 6; k++) {
      var b = document.createElement("button"); b.className = "tt-b"; b.type = "button"; b.setAttribute("aria-label", POWERS[k].name + " (" + SHORT[k] + ")");
      b.innerHTML = "<small>" + SHORT[k] + "</small>" + POWERS[k].ico + "<em>" + POWERS[k].name + "</em><div class=\"cd\"></div><div class=\"cdt\"></div>" + (k === 2 ? "<div class=\"en\"><i></i></div>" : "");
      (function (kk, el) {
        el.addEventListener("pointerdown", function (ev) {
          ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (e) {}
          var p = titanReady(); if (!p) return;
          if (kk === 2) { held.beamT = ev.pointerId; beamState(); }
          else if (kk === 3) { if (!p.grounded) send({ titanPower: 3 }); else { held.jumpB = ev.pointerId; send({ titanJump: 1 }); } }
          else send({ titanPower: kk });
        });
        var up = function (ev) { if (kk === 2 && held.beamT === ev.pointerId) { held.beamT = null; beamState(); } if (kk === 3 && held.jumpB === ev.pointerId) { held.jumpB = null; send({ titanJump: 0 }); } };
        el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
      })(k, b);
      pw.appendChild(b); btns.push({ el: b, cd: b.querySelector(".cd"), cdt: b.querySelector(".cdt"), en: b.querySelector(".en i"), k: k });
    }
    var hb = document.createElement("button"); hb.className = "tt-b help"; hb.type = "button"; hb.textContent = "?"; hb.setAttribute("aria-label", "Aide du Titan");
    hb.addEventListener("pointerdown", function (ev) { ev.preventDefault(); ev.stopPropagation(); helpUntil = clock() + 12; if (UI) UI.helpAt = clock(); }); pw.appendChild(hb);
    d.querySelector(".tt-prompt").addEventListener("pointerdown", function (ev) { ev.preventDefault(); send({ interact: true }); });
    var vis = []; for (var v = 0; v < 8; v++) { var m = document.createElement("div"); m.className = "tt-vis"; m.innerHTML = "<b></b><span></span>"; d.appendChild(m); vis.push(m); }
    UI = { root: d, edge: d.querySelector(".tt-edge"), banner: d.querySelector(".tt-banner"), help: d.querySelector(".tt-help"), prompt: d.querySelector(".tt-prompt"), mGl: d.querySelector(".tt-mark.gl"), mTi: d.querySelector(".tt-mark.ti"), pw: pw, btns: btns,
      ring: d.querySelector(".tt-ring"), arc: d.querySelector(".tt-ring .arc"), en: d.querySelector(".tt-en"), enFill: d.querySelector(".tt-en i"), boss: d.querySelector(".tt-boss"), bossName: d.querySelector(".tt-boss span"), bh: d.querySelector(".tt-boss .bh"), bs: d.querySelector(".tt-boss .bs"), vis: vis, bannerUntil: 0 };
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
    var l = (G.lock || 0) - w.elapsed; return l > 0 && !w.titanCreative ? "\nles IA attendent encore " + Math.ceil(l) + " s" : "";
  }
  // atelier créatif : une section « Gant du Titan » (devenir le Titan, rendre le gant, le faire tomber du ciel)
  function hookCreative(g) {
    if (!g || g.__tCrea || typeof g.openCreative !== "function") return;
    var o = g.openCreative; g.__tCrea = true;
    g.openCreative = function () { var r = o.apply(this, arguments); try { addCreative(this); } catch (e) { console.warn("[Titan] atelier", e); } return r; };
  }
  function addCreative(g) {
    var grid = g.overlay && g.overlay.querySelector(".creative-grid"); if (!grid || grid.querySelector(".tt-crea")) return;
    var p = g.player && g.player(), me = !!(p && p._titan);
    var sec = document.createElement("section"); sec.className = "tt-crea";
    sec.innerHTML = "<h3>GANT DU TITAN</h3><p class=\"tt-crea-p\">" + (me ? "Tu es le Titan. Rends le gant pour redevenir normal, ou fais-le tomber du ciel pour revoir son arrivée." : "Deviens le Titan (montée à 200 m, poing serré, chute libre) ou fais tomber le Gant du ciel devant toi.") + "</p>" +
      "<div class=\"tt-crea-a\"><button type=\"button\" class=\"btn btn-primary\" data-titan=\"give\">" + (me ? "RENDRE LE GANT" : "DEVENIR LE TITAN") + "</button><button type=\"button\" class=\"btn btn-secondary\" data-titan=\"meteor\">FAIRE TOMBER LE GANT DU CIEL</button></div>";
    grid.appendChild(sec);
    sec.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-titan]"); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var kind = b.getAttribute("data-titan");
      try { if (typeof g.closeModal === "function") g.closeModal(); } catch (er) {}
      setTimeout(function () { send(kind === "meteor" ? { titanMeteor: true } : { titanGive: true }); }, 40);
    });
  }
  function uiTick() {
    root.requestAnimationFrame(uiTick);
    var g = root.AZUR, w = g && g.world;
    hookCreative(g);
    var on = !!(w && w.titanMode && g.screen === "game");
    if (root.document && document.body) document.body.classList.toggle("az-titan-match", on);
    if (!on) { if (UI) UI.root.style.display = "none"; if (root.document && document.body) document.body.classList.remove("az-titan-me"); wasReady = false; return; }
    if (!UI) buildUi(); UI.root.style.display = "block";
    var G = w.titan || {}, p = g.player && g.player(), now = clock(), cam = g.view && g.view.camera;
    // annonces
    var nw = G.news && G.news[G.news.length - 1];
    if (nw && nw.seq !== lastNews) { lastNews = nw.seq; UI.banner.innerHTML = nw.text.replace(/(Titan|gant|Gant du Titan)/g, "<b>$1</b>"); UI.bannerUntil = now + 4.5; }
    UI.banner.classList.toggle("on", now < UI.bannerUntil);
    if (!p) return;
    var meT = !!(p._titan && p.alive), W = innerWidth, Hh = innerHeight, ready = meT && !p._tAsc;
    document.body.classList.toggle("az-titan-me", meT);
    if (ready && !wasReady) { helpUntil = now + 9; UI.helpAt = now; } // l'aide s'affiche à l'atterrissage du Titan
    if (ready && now < helpUntil && now - (UI.helpAt || 0) > 1.2 && (p._tJc || p._tBeamOn || p._tPound || (p._tPunchAt != null && w.elapsed - p._tPunchAt < .2))) helpUntil = Math.min(helpUntil, now + .6);
    if (!ready && wasReady) releaseAll();
    wasReady = ready;
    UI.help.classList.toggle("on", ready && now < helpUntil);
    if (ready) UI.banner.classList.toggle("on", now < UI.bannerUntil && !(now < helpUntil));
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
    // la vie du Titan pour ceux qui le chassent
    if (h && h.alive && h !== p) {
      var tot = CFG.hp + CFG.shield; UI.boss.style.display = "block";
      UI.bossName.textContent = "TITAN · " + String(h.name || "").toUpperCase() + " · " + Math.round(h.hp + h.shield) + " PV";
      UI.bh.style.width = Math.max(0, h.hp / tot * 100) + "%"; UI.bs.style.width = Math.max(0, h.shield / tot * 100) + "%";
    } else UI.boss.style.display = "none";
    // pouvoirs
    UI.pw.classList.toggle("on", ready);
    if (ready) UI.btns.forEach(function (b) {
      var c = (p._tcd && p._tcd[b.k]) || 0, full = CFG.cd[b.k] || 1, active = (b.k === 2 && p._tBeamOn) || (b.k === 5 && p._tGuard > 0) || (b.k === 3 && (p._tJc || p._tSuper || p._tPound));
      if (b.k === 2) { c = 0; if (b.en) b.en.style.width = Math.round((p._tEnergy == null ? 100 : p._tEnergy)) + "%"; }
      b.cd.style.height = (c > 0 ? Math.min(100, c / full * 100) : 0) + "%"; b.cdt.textContent = c > .9 && !active ? Math.ceil(c) : "";
      b.el.classList.toggle("ready", !(c > 0) && !active); b.el.classList.toggle("on", !!active);
    });
    // jauges près du viseur
    if (ready && p._tJc) { var f = Math.min(1, p._tJc.t / CFG.jump.charge); UI.ring.style.display = "block"; UI.arc.setAttribute("stroke-dashoffset", (163.4 * (1 - f)).toFixed(1)); UI.arc.setAttribute("stroke", f >= 1 ? "#fff6dc" : "#ffb35c"); }
    else UI.ring.style.display = "none";
    var en = p._tEnergy == null ? 100 : p._tEnergy;
    if (ready && (p._tBeamOn || en < 99.5)) { UI.en.style.display = "block"; UI.enFill.style.width = en.toFixed(0) + "%"; UI.en.classList.toggle("low", en < CFG.beam.min); }
    else UI.en.style.display = "none";
    // vision du Titan : les ennemis à moins de 70 m, même derrière les murs
    var shown = 0;
    if (ready && cam) {
      var list = [];
      w.players.forEach(function (q) { if (q === p || !q.alive || !q.deployed || q.downed || q.team === p.team) return; var d = Math.hypot(q.x - p.x, q.z - p.z); if (d < 70) list.push({ q: q, d: d }); });
      list.sort(function (a, b) { return a.d - b.d; });
      for (var i = 0; i < list.length && shown < UI.vis.length; i++) {
        var q = list[i].q; _pv = _pv || new T.Vector3(); _pv.set(q.x, q.y + 2.3, q.z).project(cam);
        if (_pv.z > 1 || Math.abs(_pv.x) > 1.05 || Math.abs(_pv.y) > 1.05) continue;
        var el = UI.vis[shown++]; el.style.display = "block"; el.style.left = ((_pv.x * .5 + .5) * W) + "px"; el.style.top = ((-_pv.y * .5 + .5) * Hh) + "px"; el.lastChild.textContent = Math.round(list[i].d) + " m";
      }
    }
    for (var j = shown; j < UI.vis.length; j++) UI.vis[j].style.display = "none";
  }
  // clavier : 2 maintenu = rayon ; saut maintenu = super saut ; 1, 3 à 6 = pouvoirs ; H = aide
  function onKeyDown(e) {
    var g = root.AZUR, w = g && g.world; if (!w || !w.titanMode || g.screen !== "game" || g.modal) return;
    if (e.code === "KeyH" && !e.repeat) { var pp = g.player && g.player(); if (pp && pp._titan) { helpUntil = clock() + 12; if (UI) UI.helpAt = clock(); } }
    var p = titanReady(); if (!p) return;
    var jumpCode = (g.keybinds && g.keybinds.jump) || "Space";
    if (e.code === jumpCode) { if (!e.repeat && !held.jumpK) { held.jumpK = true; send({ titanJump: 1 }); } return; }
    var m = /^Digit([1-6])$/.exec(e.code || ""); if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return;
    var k = +m[1];
    if (k === 2) { held.beamK = true; beamState(); return; }
    send({ titanPower: k });
  }
  function onKeyUp(e) {
    var g = root.AZUR; if (!g) return;
    var jumpCode = (g.keybinds && g.keybinds.jump) || "Space";
    if (e.code === jumpCode && held.jumpK) { held.jumpK = false; send({ titanJump: 0 }); }
    if (e.code === "Digit2" && held.beamK) { held.beamK = false; beamState(); e.preventDefault(); e.stopImmediatePropagation(); }
  }
  // souris : clic droit maintenu sur le jeu = rayon (on vise en bougeant la souris ou en glissant)
  function onPointerDown(e) {
    var g = root.AZUR;
    if (e.button === 2 && titanReady() && e.target && e.target.tagName === "CANVAS") { held.beamM = true; beamState(); return; }
    // bouton tactile « saut » : maintenu = super saut
    var t = e.target && e.target.closest && e.target.closest('.touch-btn[data-act="jump"]');
    if (t && titanReady()) { held.jumpT = e.pointerId; send({ titanJump: 1 }); }
    void g;
  }
  function onPointerUp(e) {
    if (e.button === 2 && held.beamM) { held.beamM = false; beamState(); }
    if (held.jumpT != null && held.jumpT === e.pointerId) { held.jumpT = null; send({ titanJump: 0 }); }
  }
  if (root.addEventListener) {
    root.addEventListener("keydown", onKeyDown, true); root.addEventListener("keyup", onKeyUp, true);
    root.addEventListener("pointerdown", onPointerDown, true); root.addEventListener("pointerup", onPointerUp, true); root.addEventListener("pointercancel", onPointerUp, true);
    root.addEventListener("blur", releaseAll);
  }
  if (root.requestAnimationFrame) root.requestAnimationFrame(uiTick);
  root.AZTitanMode.becomeTitan = becomeTitan; root.AZTitanMode.state = st; root.AZTitanMode.usePower = usePower; root.AZTitanMode.holder = holder;
  root.AZTitanMode.fwd = fwd; root.AZTitanMode.aim = aim; root.AZTitanMode.launch = launch; root.AZTitanMode.pound = pound;
})(typeof globalThis !== "undefined" ? globalThis : this);
