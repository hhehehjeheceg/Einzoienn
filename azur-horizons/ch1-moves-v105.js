/* AZUR v105 — ch1-moves-v105.js : plus de 100 MOUVEMENTS écrits à la main pour le personnage.
 *  - un moteur de chorégraphie qui pilote tout le corps par-dessus l'animation de base :
 *    hanches (rebond, balancement, tours, sauts), buste, tête, bras et jambes par cinématique inverse
 *    (mains et pieds sur des cibles, pieds qui restent au sol quand le corps descend), doigts
 *    (poing, main ouverte, index, V, pouce levé) ;
 *  - 107 ÉMOTES : vraies danses en boucle sur le tempo (pas chassés, twist, disco, robot, rame, arroseur,
 *    moulinets, marche sur place, jumping jacks…), gestes (salut militaire, révérence, applaudir, cœur,
 *    pouce, rire, pleurs, facepalm, haussement d'épaules, téléphone, selfie…) et numéros (guitare,
 *    batterie, DJ, boxe, karaté, jonglage, yoyo, hula hoop, lasso…) — toutes originales ;
 *  - 18 PETITS GESTES À L'ARRÊT : le personnage qui attend s'étire, regarde autour, roule des épaules,
 *    consulte son poignet, se gratte la tête, tape du pied… (un de temps en temps) ;
 *  - 14 COUCHES DE MOUVEMENT EN JEU : respiration, penché dans les virages, penché en sprint, bras qui
 *    balancent, rebond de la foulée, genoux qui amortissent la réception, bras en l'air au saut, jambes
 *    repliées en l'air, bras qui moulinent en chute, balancement sous le planeur, inclinaison en chute
 *    libre, recul quand on est touché, tête qui suit la visée, accroupi plus bas.
 * Repère d'écriture : x à droite du personnage, y en haut, z devant (mètres, sol = 0, bassin ≈ 0,95). */
(function (root) {
  "use strict";
  const T = root.THREE, M = root.AZCh1Models, V = root.AZView && root.AZView.View, META = root.AZMeta;
  if (!T || !M || !V || !V.prototype || V.prototype.__moves105) return;
  V.prototype.__moves105 = true;

  /* ------------------------------------------------------------------ outils */
  const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, abs = Math.abs;
  const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const S = (x) => sin(x * TAU), C = (x) => cos(x * TAU), fr = (x) => x - Math.floor(x);
  const tri = (x) => 1 - abs(fr(x) * 2 - 1), pulse = (x, w = .25) => { const f = fr(x); return f < w ? sin(f / w * Math.PI) : 0; };
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _d = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion();
  const _m = new T.Matrix4(), _m2 = new T.Matrix4(), _m3 = new T.Matrix4(), _e = new T.Euler(), _ax = new T.Vector3();

  function aimAt(bone, child, target, w) {
    bone.getWorldPosition(_a); child.getWorldPosition(_b);
    const cur = _c.copy(_b).sub(_a), want = _d.copy(target).sub(_a); if (cur.lengthSq() < 1e-10 || want.lengthSq() < 1e-10) return;
    _q.setFromUnitVectors(cur.normalize(), want.normalize());
    bone.getWorldQuaternion(_q2); _q.multiply(_q2);
    bone.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q);
    bone.quaternion.slerp(_q2, w); bone.updateMatrixWorld(true);
  }
  function ik(up, lo, end, target, pole, w) {
    if (!up || !lo || !end || w <= .001) return;
    const A = up.getWorldPosition(new T.Vector3()), B = lo.getWorldPosition(new T.Vector3()), Cc = end.getWorldPosition(new T.Vector3());
    const l1 = A.distanceTo(B), l2 = B.distanceTo(Cc), goal = Cc.clone().lerp(target, w), dir = goal.clone().sub(A);
    let d = dir.length(); if (d < 1e-4) return; dir.divideScalar(d); d = Math.min(d, (l1 + l2) * .999);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const bend = pole.clone().sub(A); bend.sub(dir.clone().multiplyScalar(bend.dot(dir))); if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0); bend.normalize();
    aimAt(up, lo, A.clone().addScaledVector(dir, x).addScaledVector(bend, h), 1);
    aimAt(lo, end, A.clone().addScaledVector(dir, d), 1);
  }
  // rotation autour d'un axe du repère du groupe, appliquée en monde
  function turn(bone, group, ax, ay, az, ang) {
    if (!bone || abs(ang) < 1e-5) return;
    _ax.set(ax, ay, az).transformDirection(group.matrixWorld);
    _q.setFromAxisAngle(_ax, ang); bone.getWorldQuaternion(_q2); _q.multiply(_q2);
    bone.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q); bone.quaternion.copy(_q2); bone.updateMatrixWorld(true);
  }

  /* ------------------------------------------------------- doigts (axes de flexion pris sur la pose de repos) */
  const FING = ["index", "middle", "ring", "pinky", "thumb"];
  let FAX = null; // nom d'os → { axis (local), rest (quaternion local) }
  function fingerAxes(inst) {
    if (FAX) return FAX;
    try {
      const bind = M.instantiate(inst.tpl), Bb = bind.bones; bind.model.updateMatrixWorld(true); FAX = {};
      for (const side of ["r", "l"]) for (const f of FING) for (let i = 1; i <= 3; i++) {
        const n = f + "_0" + i + "_" + side, b = Bb[n], ch = Bb[f + "_0" + (i + 1) + (i === 3 ? "_leaf_" : "_") + side] || (b && b.children[0]);
        if (!b || !ch) continue;
        const p0 = b.getWorldPosition(new T.Vector3()), p1 = ch.getWorldPosition(new T.Vector3()), dir = p1.sub(p0).normalize();
        const palm = new T.Vector3(0, -1, 0), axW = new T.Vector3().crossVectors(dir, palm);
        if (f === "thumb") axW.set(side === "r" ? 1 : -1, 0, 0).cross(dir).normalize().negate(); // le pouce se replie sous la paume
        if (axW.lengthSq() < 1e-6) continue; axW.normalize();
        const wq = b.getWorldQuaternion(new T.Quaternion()).invert();
        FAX[n] = { axis: axW.applyQuaternion(wq), rest: b.quaternion.clone() };
      }
    } catch (e) { FAX = {}; }
    return FAX;
  }
  const HANDS = { // flexion par doigt (index, majeur, annulaire, auriculaire, pouce), en radians par phalange
    open: [0, 0, 0, 0, 0], relax: [.25, .3, .35, .4, .1], fist: [1.25, 1.3, 1.3, 1.3, .7], point: [0, 1.3, 1.3, 1.3, .6],
    peace: [0, 0, 1.3, 1.3, .7], thumb: [1.3, 1.3, 1.3, 1.3, 0], claw: [.7, .75, .8, .8, .3], rock: [0, 1.3, 1.3, 0, .6], cup: [.5, .5, .5, .5, .3]
  };
  function fingers(inst, side, kind, w) {
    const ax = fingerAxes(inst), c = HANDS[kind]; if (!c) return;
    for (let fi = 0; fi < 5; fi++) for (let i = 1; i <= 3; i++) {
      const n = FING[fi] + "_0" + i + "_" + side, b = inst.bones[n], a = ax[n]; if (!b || !a) continue;
      _q.setFromAxisAngle(a.axis, c[fi] * (fi === 4 && i === 1 ? .5 : 1)); _q2.copy(a.rest).multiply(_q);
      b.quaternion.slerp(_q2, w);
    }
  }

  /* ------------------------------------------------------------------ pose */
  function newPose() { return { hip: null, chest: null, head: null, R: null, L: null, FR: null, FL: null, fR: null, fL: null, legs: false }; }
  function K(P, t) { // fonctions d'écriture passées à chaque mouvement
    return {
      t,
      hip(o) { P.hip = Object.assign(P.hip || {}, o); if (o.y || o.x || o.z || o.pitch || o.roll) P.legs = true; return this; },
      chest(o) { P.chest = Object.assign(P.chest || {}, o); return this; },
      head(o) { P.head = Object.assign(P.head || {}, o); return this; },
      R(x, y, z, e) { P.R = { h: [x, y, z], e: e || null }; return this; },
      L(x, y, z, e) { P.L = { h: [-x, y, z], e: e ? [-e[0], e[1], e[2]] : null }; return this; }, // x positif = côté gauche
      both(x, y, z, e) { return this.R(x, y, z, e).L(x, y, z, e); },
      FR(x, y, z) { P.FR = [x, y, z]; P.legs = true; return this; },
      FL(x, y, z) { P.FL = [-x, y, z]; P.legs = true; return this; },
      hand(kR, kL) { P.fR = kR; P.fL = kL === undefined ? kR : kL; return this; },
    };
  }

  /* ================================================================ bibliothèque */
  const LIB = {}; // id → { name, rarity, dur, loop, bpm, fn, kind }
  function add(id, name, rarity, dur, bpm, fn, kind) { LIB[id] = { id, name, rarity, dur, loop: dur >= 12, bpm, fn, kind: kind || "emote" }; }
  // pas de base réutilisables
  const step = {
    bounce(k, b, a = .06) { k.hip({ y: -a * (.5 + .5 * C(b)) }); },
    side(k, b, w = .22) { const s = S(b / 2); k.hip({ x: s * w * .5, roll: -s * .06 }); k.FR(.12 + Math.max(0, s) * w, .04 * pulse(b, .5), 0); k.FL(.12 + Math.max(0, -s) * w, .04 * pulse(b + .5, .5), 0); },
    march(k, b, h = .22) { const a = Math.max(0, S(b / 2)), c = Math.max(0, -S(b / 2)); k.FR(.12, a * h, a * .12); k.FL(.12, c * h, c * .12); k.hip({ y: -.03 * abs(S(b / 2)) }); },
    twist(k, b, a = .5) { const s = S(b / 2); k.hip({ yaw: s * a, y: -.08 - .03 * abs(s) }); k.FR(.13, 0, .02); k.FL(.13, 0, .02); },
    kick(k, b) { const ph = fr(b / 4), side = ph < .5 ? 1 : -1, kk = pulse(ph * 2, .45); if (side > 0) { k.FR(.1, .25 * kk, .45 * kk); k.FL(.12, 0, 0); } else { k.FL(.1, .25 * kk, .45 * kk); k.FR(.12, 0, 0); } k.hip({ y: -.04 * kk, pitch: -.05 * kk }); },
    hop(k, b, h = .12) { const j = pulse(b, .5); k.hip({ y: j * h - .05 * (1 - j) }); k.FR(.12, j * h, 0); k.FL(.12, j * h, 0); },
    shuffle(k, b) { const s = S(b / 2), j = pulse(b, .35); k.FR(.12 + .1 * s, .06 * j, .18 * s); k.FL(.12 - .1 * s, .06 * pulse(b + .5, .35), -.18 * s); k.hip({ y: -.07 + .03 * j, x: .05 * s }); },
    squat(k, d) { k.hip({ y: -d }); k.FR(.17, 0, .04); k.FL(.17, 0, .04); },
  };
  const e = [.9, .5, -.6]; // coude par défaut : dehors, en bas, en arrière

  /* ---- 1. danses en boucle (12 s, sur le tempo) */
  add("pas-chasse", "Pas chassé", "rare", 12, 112, (k, t, b) => { step.side(k, b); const s = S(b / 2); k.R(.35 + .1 * s, 1.15 + .08 * pulse(b), .25).L(.35 - .1 * s, 1.15 + .08 * pulse(b + .5), .25).hand("fist").head({ roll: .1 * s, pitch: .05 * pulse(b) }); });
  add("twist", "Twist", "rare", 12, 120, (k, t, b) => { step.twist(k, b); const s = S(b / 2); k.R(.32, 1.05, .2 - .15 * s).L(.32, 1.05, .2 + .15 * s).hand("fist").chest({ yaw: -s * .3 }); });
  add("disco", "Fièvre disco", "epique", 12, 116, (k, t, b) => { const up = fr(b / 2) < .5; step.bounce(k, b, .05); k.hip({ x: up ? .05 : -.05, roll: up ? -.05 : .05 }); if (up) k.R(.55, 2.05, .25).L(.25, .85, .1); else k.R(.3, .75, .35).L(.25, .95, .1); k.hand("point", "relax").head({ yaw: up ? .2 : -.15, pitch: up ? -.2 : .1 }); });
  add("robot", "Robot", "rare", 12, 104, (k, t, b) => { const q = Math.floor(b) % 4, ang = [0, .45, 0, -.45][q]; k.hip({ yaw: ang * .5, y: -.02 }); k.R(.3, 1.2 + (q === 1 ? .2 : 0), .32, [1, 1.6, 0]).L(.3, 1.2 + (q === 3 ? .2 : 0), .32, [1, 1.6, 0]).hand("open").head({ yaw: -ang, pitch: q % 2 ? .1 : 0 }).chest({ yaw: ang * .3 }); k.FR(.14, 0, 0).FL(.14, 0, 0); });
  add("arroseur", "Arroseur", "rare", 12, 108, (k, t, b) => { const sw = tri(b / 4) * 2 - 1; step.bounce(k, b, .04); k.hip({ yaw: sw * .45 }); k.R(.45, 1.2, .3).L(-.05, 1.62, .1, [.6, 1.7, .2]).hand("open", "fist").head({ yaw: sw * .2 }); k.FR(.15, 0, .02).FL(.15, .05 * pulse(b), .05); });
  add("moulinets", "Moulinets", "rare", 12, 120, (k, t, b) => { const a = b * Math.PI; step.bounce(k, b); k.R(.12 + .1 * cos(a), 1.15 + .1 * sin(a), .32).L(.12 - .1 * cos(a), 1.15 - .1 * sin(a), .32).hand("fist").chest({ yaw: .15 * sin(a / 2) }).head({ roll: .08 * sin(a / 2) }); });
  add("marche-sur-place", "Marche sur place", "commun", 12, 110, (k, t, b) => { step.march(k, b); const s = S(b / 2); k.R(.25, 1.0 + .12 * s, .1 + .2 * s).L(.25, 1.0 - .12 * s, .1 - .2 * s).hand("fist").chest({ yaw: .1 * s }); });
  add("jumping-jacks", "Jumping jacks", "commun", 12, 100, (k, t, b) => { const o = .5 - .5 * C(b / 2), j = pulse(b, .45); k.hip({ y: .08 * j - .04 }); k.FR(.1 + .2 * o, .08 * j, 0).FL(.1 + .2 * o, .08 * j, 0); k.R(.3 + .25 * o, .95 + 1.15 * o, 0).L(.3 + .25 * o, .95 + 1.15 * o, 0).hand("open"); });
  add("ramer", "Rameur", "commun", 12, 96, (k, t, b) => { const r = .5 - .5 * C(b / 2); step.squat(k, .22); k.chest({ pitch: .25 - .45 * r }); k.R(.18, 1.05, .55 - .45 * r).L(.18, 1.05, .55 - .45 * r).hand("fist").head({ pitch: -.1 }); });
  add("nage-a-sec", "Nage à sec", "rare", 12, 92, (k, t, b) => { const a = b * Math.PI; step.bounce(k, b, .04); k.R(.25 + .2 * cos(a), 1.35 + .35 * sin(a), .35 + .15 * cos(a)).L(.25 - .2 * cos(a), 1.35 - .35 * sin(a), .35 - .15 * cos(a)).hand("cup").head({ yaw: .3 * sin(a) }); });
  add("poulet", "Danse du poulet", "commun", 12, 128, (k, t, b) => { const f = pulse(b, .5); step.bounce(k, b, .05); k.R(.32, 1.25 + .12 * f, -.05, [1.2, 1.3, .3]).L(.32, 1.25 + .12 * pulse(b + .5, .5), -.05, [1.2, 1.3, .3]).hand("fist").head({ pitch: .15 * S(b), yaw: .1 * S(b / 2) }); k.hip({ pitch: .06 }); });
  add("lasso", "Lasso", "epique", 12, 112, (k, t, b) => { const a = b * Math.PI; step.side(k, b, .16); k.R(.15 + .2 * cos(a), 2.05, .1 + .2 * sin(a), [.8, 2.5, 0]).L(.3, 1.0, .2).hand("fist", "relax").head({ yaw: .3 * sin(a), pitch: -.15 }); });
  add("hula", "Hula hoop", "rare", 12, 104, (k, t, b) => { const a = b * Math.PI; k.hip({ x: .08 * cos(a), z: .08 * sin(a), roll: -.05 * cos(a), y: -.06 }); k.FR(.15, 0, 0).FL(.15, 0, 0); k.R(.4, 1.55, .15).L(.4, 1.55, .15).hand("open"); });
  add("ventilo", "Ventilateur", "rare", 12, 120, (k, t, b) => { const a = b * Math.PI * 2; step.bounce(k, b); k.R(.4 + .35 * cos(a), 1.35 + .35 * sin(a), .25).L(.4 + .35 * cos(a + Math.PI), 1.35 + .35 * sin(a + Math.PI), .25).hand("open"); });
  add("pompe-a-bras", "Lève les bras", "commun", 12, 124, (k, t, b) => { step.bounce(k, b, .08); const u = pulse(b, .5); k.both(.3, 1.4 + .75 * u, .1).hand("open").head({ pitch: -.2 * u }); });
  add("shuffle", "Shuffle", "epique", 12, 128, (k, t, b) => { step.shuffle(k, b); const s = S(b / 2); k.R(.3, 1.05, .25 + .1 * s).L(.3, 1.05, .25 - .1 * s).hand("fist").chest({ yaw: .2 * s }).head({ roll: .08 * s }); });
  add("coup-de-pied", "Coups de pied", "rare", 12, 112, (k, t, b) => { step.kick(k, b); k.R(.35, 1.15, .2).L(.35, 1.15, .2).hand("fist").chest({ pitch: -.05 }); });
  add("tete-qui-bouge", "Headbang", "rare", 12, 140, (k, t, b) => { step.bounce(k, b, .06); k.head({ pitch: .35 * pulse(b, .4) - .1 }).chest({ pitch: .15 * pulse(b, .4) }); k.R(.25, 1.95, .15).L(.3, .95, .15).hand("rock", "fist"); });
  add("vague-bras", "La vague", "epique", 12, 100, (k, t, b) => { const ph = b / 2; step.bounce(k, b, .03); k.R(.5 + .2 * S(ph), 1.45 + .18 * S(ph + .2), .05).L(.5 + .2 * S(ph + .5), 1.45 + .18 * S(ph + .7), .05).hand("open").chest({ roll: .12 * S(ph) }).head({ roll: .15 * S(ph + .1) }); });
  add("cowboy", "Cavalier", "commun", 12, 124, (k, t, b) => { step.hop(k, b, .08); k.R(.2, 1.1, .4).L(.2, 1.1, .4).hand("fist").chest({ pitch: .1 }); });
  add("toupie-lente", "Toupie lente", "epique", 12, 90, (k, t, b) => { k.hip({ turn: t * 1.4, y: -.04 }); k.FR(.12, 0, 0).FL(.12, 0, 0); k.R(.62, 1.42, 0).L(.62, 1.42, 0).hand("open").head({ pitch: -.15 }); });
  add("glisse", "Glissade", "legendaire", 12, 100, (k, t, b) => { const ph = fr(b / 2), s = ph < .5 ? 1 : -1, g = sm(fr(ph * 2)); k.hip({ x: s * (.12 - .24 * g), y: -.05 }); k.FR(.12 + s * .1 * g, .03 * sin(g * Math.PI), -.05 * s).FL(.12 - s * .1 * g, .03 * sin(g * Math.PI), .05 * s); k.R(.3, 1.1, .25).L(.3, 1.1, .25).hand("relax").head({ yaw: s * .2 }); });
  add("pingouin", "Pingouin", "commun", 12, 120, (k, t, b) => { const s = S(b / 2); k.hip({ roll: .1 * s, y: -.02 }); k.FR(.08, .04 * Math.max(0, s), 0).FL(.08, .04 * Math.max(0, -s), 0); k.R(.3, .85, -.05, [1, 1, 0]).L(.3, .85, -.05, [1, 1, 0]).hand("open").head({ roll: -.1 * s }); });
  add("electrique", "Électrique", "epique", 12, 132, (k, t, b) => { const q = Math.floor(b * 2) % 4, jitter = .05 * S(b * 8); step.bounce(k, b, .04); k.R(.3 + (q === 0 ? .25 : 0), 1.3 + (q === 1 ? .4 : 0) + jitter, .2).L(.3 + (q === 2 ? .25 : 0), 1.3 + (q === 3 ? .4 : 0) - jitter, .2).hand("claw").head({ yaw: .15 * S(b * 2), roll: .1 * S(b * 4) }); });
  add("ballerine", "Ballerine", "legendaire", 12, 84, (k, t, b) => { const sp = sm(fr(b / 4) * 2) * TAU; k.hip({ turn: fr(b / 4) < .5 ? sp : TAU, y: .03 }); k.FR(.05, 0, 0).FL(.02, .35, .05); k.R(.12, 2.05, .1).L(.12, 2.05, .1).hand("relax").head({ pitch: -.1 }); });
  add("pantin", "Pantin", "rare", 12, 116, (k, t, b) => { const u = pulse(b, .5), v = pulse(b + .5, .5); step.bounce(k, b, .03); k.R(.45, 1.1 + .7 * u, .05).L(.45, 1.1 + .7 * v, .05).hand("open").FR(.15, .12 * v, 0).FL(.15, .12 * u, 0).head({ roll: .15 * (u - v) }); });
  add("air-guitare", "Guitare imaginaire", "epique", 12, 132, (k, t, b) => { step.bounce(k, b, .05); k.R(.05, 1.0 + .06 * pulse(b * 2), .3).L(-.35, 1.32, .38).hand("fist", "claw").chest({ pitch: .1, yaw: .1 }).head({ pitch: .2 * pulse(b, .4) }); k.FR(.22, 0, .05).FL(.1, 0, -.05); });
  add("air-batterie", "Batterie imaginaire", "epique", 12, 140, (k, t, b) => { const r = pulse(b, .4), l = pulse(b + .5, .4); step.squat(k, .18); k.R(.25, 1.0 + .2 * (1 - r), .4).L(.25, 1.0 + .2 * (1 - l), .4).hand("fist").head({ pitch: .1 + .12 * r }); });
  add("dj", "DJ", "legendaire", 12, 126, (k, t, b) => { step.bounce(k, b, .05); k.R(.25 + .05 * S(b), 1.02, .42).L(-.02, 1.6, .02, [.6, 1.7, -.1]).hand("open", "cup").head({ roll: .25, pitch: .15 * pulse(b, .4) }).chest({ pitch: .1 }); });
  add("boxe", "Boxeur", "rare", 12, 132, (k, t, b) => { const r = pulse(b, .3), l = pulse(b + .5, .3); step.hop(k, b, .05); k.R(.12, 1.42, .2 + .45 * r).L(.12, 1.42, .2 + .45 * l).hand("fist").chest({ yaw: .25 * (l - r) }); k.FR(.14, 0, -.08).FL(.14, 0, .1); });
  add("karate", "Karaté", "rare", 12, 96, (k, t, b) => { const ph = Math.floor(b) % 4, p = pulse(b, .35); step.squat(k, .2); k.FR(.28, 0, .05).FL(.28, 0, -.05); if (ph % 2) k.R(.05, 1.35, .55 * p + .1).L(.2, 1.05, .15); else k.L(.05, 1.35, .55 * p + .1).R(.2, 1.05, .15); k.hand("open", "fist").chest({ yaw: ph % 2 ? -.2 : .2 }); });
  add("jongle", "Jongleur", "rare", 12, 120, (k, t, b) => { const r = pulse(b, .5), l = pulse(b + .5, .5); step.bounce(k, b, .03); k.R(.22, 1.1 + .25 * r, .38).L(.22, 1.1 + .25 * l, .38).hand("cup").head({ pitch: -.25 - .1 * (r + l), yaw: .15 * (r - l) }); });
  add("yoyo", "Yoyo", "commun", 12, 120, (k, t, b) => { const y = pulse(b, .6); step.bounce(k, b, .03); k.R(.25, 1.25 - .3 * y, .32).L(.3, .95, .1).hand("fist", "relax").head({ pitch: .2 * y }); });
  add("chef-orchestre", "Chef d'orchestre", "epique", 12, 90, (k, t, b) => { const a = fr(b) * TAU; k.R(.3 + .12 * cos(a), 1.5 + .2 * sin(a * 2), .35).L(.35, 1.35 + .1 * S(b / 2), .3).hand("point", "open").head({ pitch: -.1, yaw: .15 * S(b / 4) }).chest({ yaw: .1 * S(b / 4) }); });
  add("sauterelle", "Sauterelle", "rare", 12, 128, (k, t, b) => { step.hop(k, b, .2); k.both(.35, 1.2 + .4 * pulse(b, .5), .15).hand("open").head({ pitch: -.15 * pulse(b, .5) }); });
  add("ola", "Ola", "commun", 12, 80, (k, t, b) => { const u = sm(tri(b / 4)); k.hip({ y: -.15 * (1 - u) }); k.FR(.14, 0, .02).FL(.14, 0, .02); k.both(.3 + .1 * u, .95 + 1.2 * u, .2).hand("open").head({ pitch: -.3 * u }); });
  add("zombie", "Zombie", "rare", 12, 72, (k, t, b) => { const s = S(b / 2); k.hip({ roll: .08 * s, y: -.04 }); k.FR(.12, .05 * Math.max(0, s), .1 * Math.max(0, s)).FL(.12, .05 * Math.max(0, -s), .1 * Math.max(0, -s)); k.both(.22, 1.42, .6).hand("claw").head({ roll: .3, pitch: .15 }).chest({ pitch: .1 }); });
  add("ver-de-terre", "Vague du corps", "epique", 12, 96, (k, t, b) => { const p = b / 2; k.hip({ z: .08 * S(p), y: -.06 + .04 * S(p + .25), pitch: .1 * S(p + .1) }); k.FR(.12, 0, 0).FL(.12, 0, 0); k.chest({ pitch: -.2 * S(p + .3) }).head({ pitch: .2 * S(p + .45) }); k.both(.3, 1.0 + .08 * S(p + .5), .2).hand("relax"); });
  add("tornade", "Tornade", "legendaire", 12, 120, (k, t, b) => { k.hip({ turn: t * 6 * sm(t / 1.5), y: .02 }); k.FR(.08, 0, 0).FL(.08, .1, 0); k.R(.12, 2.1, 0).L(.6, 1.3, 0).hand("point", "open"); });
  add("macaroni", "Macaroni", "epique", 12, 116, (k, t, b) => { const q = Math.floor(b) % 8, s = q % 2 ? -1 : 1; step.bounce(k, b, .04); k.hip({ x: .05 * S(b / 2) }); if (q < 2) k.R(.3, 1.4, .5).L(.3, 1.4, .5).hand("open"); else if (q < 4) k.R(-.1, 1.4, .25).L(-.1, 1.4, .25).hand("open"); else if (q < 6) k.R(.08, 1.85, .05).L(.08, 1.85, .05).hand("open"); else { k.R(.25, .95, -.1).L(.25, .95, -.1).hand("open"); k.hip({ roll: .1 * s }); } });
  add("swing", "Swing", "rare", 12, 132, (k, t, b) => { const s = S(b / 2); step.side(k, b, .14); k.R(.4, 1.25 + .15 * s, .2).L(.4, 1.25 - .15 * s, .2).hand("open").chest({ roll: .12 * s }).head({ yaw: .2 * s }); });
  add("planche-surf", "Surfeur", "rare", 12, 90, (k, t, b) => { const s = S(b / 4); step.squat(k, .22); k.FR(.3, 0, .1).FL(.3, 0, -.1); k.hip({ roll: .1 * s, yaw: -.5 }); k.R(.6, 1.35 + .15 * s, .05).L(.6, 1.35 - .15 * s, .05).hand("open").head({ yaw: .5 }); });
  add("bras-de-fer", "Muscles en rythme", "commun", 12, 110, (k, t, b) => { step.bounce(k, b, .05); const f = pulse(b, .5); k.R(.42, 1.55 + .1 * f, .05, [1, .9, -.2]).L(.42, 1.55 + .1 * pulse(b + .5, .5), .05, [1, .9, -.2]).hand("fist").head({ yaw: .3 * S(b / 2) }); });
  add("claquettes", "Claquettes", "epique", 12, 140, (k, t, b) => { const r = pulse(b, .3), l = pulse(b + .5, .3); k.FR(.12, .07 * r, .1 * r).FL(.12, .07 * l, .1 * l); k.hip({ y: -.04 - .02 * (r + l) }); k.R(.3, 1.0, .1).L(.3, 1.0, .1).hand("open").head({ pitch: .1 }); });
  add("toupie-rapide", "Pirouettes", "legendaire", 12, 110, (k, t, b) => { const ph = fr(b / 2), sp = ph < .5 ? sm(ph * 2) * TAU : TAU; k.hip({ turn: Math.floor(b / 2) * TAU + sp, y: .02 }); k.FR(.06, 0, 0).FL(.05, .22, 0); k.R(.15, 1.85, .25).L(.15, 1.85, .25).hand("relax"); });
  add("sautille", "Sautillements", "commun", 12, 132, (k, t, b) => { step.hop(k, b, .1); const s = S(b / 2); k.R(.35, 1.1 + .1 * s, .15).L(.35, 1.1 - .1 * s, .15).hand("fist").head({ roll: .08 * s }); });
  add("conga", "Conga", "commun", 12, 116, (k, t, b) => { const q = fr(b / 4), kick = q > .75 ? pulse((q - .75) * 4, .9) : 0; step.side(k, b, .1); if (kick) k.FR(.15, .2 * kick, .3 * kick); k.R(.22, 1.15, .45).L(.22, 1.15, .45).hand("open").hip({ roll: .06 * S(b / 2) }); });
  add("aerobic", "Aérobic", "rare", 12, 128, (k, t, b) => { const q = Math.floor(b) % 4; step.march(k, b, .15); k.R(q === 0 ? .55 : .3, q === 1 ? 2.05 : 1.2, q === 2 ? .55 : .1).L(q === 2 ? .55 : .3, q === 3 ? 2.05 : 1.2, q === 0 ? .55 : .1).hand("open"); });
  add("vogue", "Vogue", "legendaire", 12, 108, (k, t, b) => { const q = Math.floor(b) % 4, f = sm(fr(b) * 3); k.hip({ x: .04 * S(b / 2), roll: -.05 * S(b / 2) }); k.FR(.13, 0, 0).FL(.13, 0, 0); if (q === 0) k.R(.15, 1.7, .28).L(.15, 1.7, .28); else if (q === 1) k.R(.18 + .3 * f, 1.62, .3).L(.18, 1.62, .3); else if (q === 2) k.R(.12, 1.6, .15).L(.12 + .3 * f, 1.62, .3); else k.R(.08, 1.75 - .2 * f, .3).L(.08, 1.55 + .2 * f, .3); k.hand("open").head({ yaw: [.3, -.3, .3, 0][q], pitch: -.05 }); });

  /* ---- 2. gestes (une fois, 3 à 6 s) */
  const once = (t, a, b, fi = .3, fo = .35) => sm((t - a) / fi) * (1 - sm((t - (b - fo)) / fo));
  add("salut-militaire", "Salut militaire", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.6); k.R(.1 + .02 * w, 1.45 + .27 * w, .1 + .05 * w, [.9, 1.5, .1]).hand("open").FR(.1, 0, 0).FL(.1, 0, 0).head({ pitch: -.05 * w }).chest({ pitch: -.05 * w }); });
  add("reverence", "Révérence", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.6, .7, .7); k.chest({ pitch: .7 * w }).head({ pitch: .3 * w }); k.R(.05, 1.15 - .15 * w, .3 * w, [.6, 1.2, .3]).L(.3, .9, -.2 * w).hand("open"); k.hip({ y: -.03 * w, z: -.05 * w }); k.FR(.1, 0, .04).FL(.1, 0, -.06 * w); });
  add("applaudir", "Applaudir", "commun", 5, 150, (k, t, b) => { const w = once(t, .2, 4.7), c = pulse(b, .4); k.R(.06 + .12 * (1 - c), 1.28, .35).L(.06 + .12 * (1 - c), 1.28, .35).hand("open"); k.hip({ y: -.02 * c * w }); k.head({ pitch: .05 * c }); });
  add("coeur", "Cœur avec les mains", "rare", 4, 0, (k, t) => { const w = once(t, .3, 3.7); k.R(.04, 1.4 + .05 * w, .28 * w + .05).L(.04, 1.4 + .05 * w, .28 * w + .05).hand("cup").head({ roll: .15 * w, pitch: -.05 }).hip({ x: .02 * sin(t * 3) * w }); });
  add("pouce-leve", "Pouce levé", "commun", 3, 0, (k, t) => { const w = once(t, .2, 2.8); k.R(.28, 1.25 + .1 * w, .35 * w).hand("thumb", "relax").head({ roll: -.1 * w }).chest({ yaw: .1 * w }); });
  add("double-pouce", "Double pouce", "commun", 3, 0, (k, t) => { const w = once(t, .2, 2.8); k.both(.3, 1.22 + .08 * w, .35 * w).hand("thumb").head({ pitch: -.05 * w }); k.hip({ y: -.03 * w }); });
  add("rire", "Fou rire", "rare", 5, 0, (k, t) => { const w = once(t, .2, 4.7), sh = sin(t * 18) * w; k.chest({ pitch: -.25 * w + .04 * sh }).head({ pitch: -.3 * w + .05 * sh }); k.R(.12, 1.05, .15 + .02 * sh).L(.12, 1.05, .15 - .02 * sh).hand("relax"); k.hip({ y: -.02 * abs(sh) }); });
  add("pleurs", "Gros chagrin", "rare", 5, 0, (k, t) => { const w = once(t, .3, 4.6), sob = sin(t * 9) * w; k.chest({ pitch: .25 * w + .03 * sob }).head({ pitch: .35 * w }); k.R(.05, 1.58, .15).L(.05, 1.58, .15).hand("cup"); k.hip({ y: -.03 * w - .015 * abs(sob) }); });
  add("facepalm", "Facepalm", "commun", 3.5, 0, (k, t) => { const w = once(t, .25, 3.3); k.R(.04, 1.66, .14).hand("open", "relax").head({ pitch: .25 * w, yaw: .1 * sin(t * 3) * w }).chest({ pitch: .1 * w }); });
  add("epaules", "Bof !", "commun", 3, 0, (k, t) => { const w = once(t, .2, 2.8), up = sin(Math.min(1, t / 1.2) * Math.PI); k.R(.42, 1.12 + .08 * up, .25).L(.42, 1.12 + .08 * up, .25).hand("open").head({ roll: .15 * w, pitch: .05 }).chest({ pitch: -.04 * up }); });
  add("telephone", "Allô ?", "commun", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.1, 1.62, .03, [.8, 1.3, -.2]).L(.32, 1.1, .1).hand("cup", "open").head({ roll: .2 * w, yaw: .2 * sin(t * 1.5) * w }); k.hip({ x: .03 * sin(t * 2) * w }); });
  add("selfie", "Selfie", "rare", 4, 0, (k, t) => { const w = once(t, .3, 3.7), click = pulse(t * .8, .1); k.R(.32, 1.75, .45).L(.25, 1.3, .25).hand("cup", "peace").head({ yaw: .3 * w, roll: .1 * w, pitch: -.1 }); k.hip({ y: -.04 * click }); });
  add("reflexion", "Je réfléchis…", "commun", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.05, 1.52, .15).L(.08, 1.2, .2).hand("point", "relax").head({ pitch: -.15 * w, yaw: .2 * sin(t) * w, roll: .1 }); k.hip({ x: .03 * w }); });
  add("chut", "Chut !", "commun", 3, 0, (k, t) => { const w = once(t, .2, 2.8); k.R(.02, 1.58, .14).hand("point").head({ pitch: .05, yaw: -.1 * w }).chest({ pitch: .06 * w }); });
  add("baille", "Bâillement", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.7, .8, .8); k.R(.25, 1.85 + .2 * w, -.05).L(.25, 1.85 + .2 * w, -.05).hand("fist").chest({ pitch: -.25 * w }).head({ pitch: -.35 * w }); k.hip({ y: .02 * w }); });
  add("victoire-poing", "Yes !", "commun", 3, 0, (k, t) => { const w = once(t, .15, 2.8), pump = pulse(t * 2.2, .5) * w; k.R(.25, 1.1 + .35 * pump, .25).hand("fist", "relax").chest({ pitch: .15 * pump }).head({ pitch: -.1 * pump }); k.hip({ y: -.08 * pump }); });
  add("au-revoir", "Au revoir", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.6), sw = sin(t * 13) * .12 * w; k.R(.4 + sw, 1.85, .15, [.9, .9, -.2]).hand("open", "relax").head({ roll: -.12 * w }).chest({ roll: .05 * w }); });
  add("coucou-deux-mains", "Coucou des deux mains", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.6), sw = sin(t * 12) * .12 * w; k.R(.42 + sw, 1.85, .15).L(.42 - sw, 1.85, .15).hand("open"); step.hop(k, t * 2, .04 * w); });
  add("calin", "Gros câlin", "rare", 4, 0, (k, t) => { const w = once(t, .3, 3.6), sq = .5 + .5 * sin(t * 3); k.R(.18 - .05 * sq, 1.25, .38).L(.18 - .05 * sq, 1.25, .38).hand("open").head({ roll: .2 * w }).hip({ roll: .05 * sin(t * 3) * w }); });
  add("pointer", "Toi !", "commun", 3, 0, (k, t) => { const w = once(t, .15, 2.8); k.R(.12, 1.5, .62 * w + .1).hand("point", "relax").head({ pitch: -.05 }).chest({ yaw: .1 * w, pitch: .06 * w }); k.FR(.12, 0, .12 * w).FL(.12, 0, -.05); });
  add("viens", "Viens par là", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.6), c = pulse(t * 1.5, .5); k.R(.25, 1.3, .3 + .15 * (1 - c), [.9, .8, -.2]).hand(c > .5 ? "fist" : "open", "relax").head({ pitch: -.05, roll: .1 * w }); });
  add("tranquille", "Tranquille", "commun", 5, 0, (k, t) => { const w = once(t, .4, 4.6); k.R(.08, 1.62, -.12, [1, 1.9, -.3]).L(.08, 1.62, -.12, [1, 1.9, -.3]).hand("open").chest({ pitch: -.08 * w }).head({ pitch: -.12 * w }); k.hip({ x: .03 * sin(t) * w }); k.FR(.1, 0, 0).FL(.2, 0, .12); });
  add("bras-croises", "Bras croisés", "commun", 5, 0, (k, t) => { const w = once(t, .4, 4.6); k.R(-.12, 1.22, .2).L(-.12, 1.18, .22).hand("relax").head({ pitch: -.05, yaw: .15 * sin(t * .8) * w }); step.bounce(k, t * 1.5, .01 * w); });
  add("mains-hanches", "Poings sur les hanches", "commun", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.27, .98, -.02, [1, 1.1, -.1]).L(.27, .98, -.02, [1, 1.1, -.1]).hand("fist").chest({ pitch: -.06 * w }).head({ pitch: -.1 * w }); k.FR(.17, 0, 0).FL(.17, 0, 0); });
  add("muscles", "Gros bras", "rare", 4, 0, (k, t) => { const w = once(t, .2, 3.8), q = sin(t * 4) * .5 + .5; k.R(.45, 1.62 + .05 * q, -.02, [1, .9, -.2]).L(.45, 1.62 + .05 * (1 - q), -.02, [1, .9, -.2]).hand("fist").chest({ pitch: -.1 * w, yaw: .15 * (q - .5) }).head({ yaw: .4 * (q - .5) }); });
  add("binocles", "Jumelles", "commun", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.06, 1.62, .18).L(.06, 1.62, .18).hand("cup").head({ yaw: .5 * sin(t * .9) * w, pitch: -.05 }).chest({ yaw: .2 * sin(t * .9) * w }); });
  add("mange", "Petit casse-croûte", "commun", 5, 0, (k, t) => { const w = once(t, .3, 4.7), bite = pulse(t * 1.2, .4); k.R(.06, 1.35 + .22 * bite, .22).L(.3, 1.05, .2).hand("cup", "relax").head({ pitch: .05 - .08 * bite }); });
  add("boire", "Petite soif", "commun", 4, 0, (k, t) => { const w = once(t, .3, 3.7); k.R(.06, 1.55, .15).hand("cup", "relax").head({ pitch: -.35 * w }).chest({ pitch: -.1 * w }); });
  add("genuflexion", "Un genou à terre", "rare", 5, 0, (k, t) => { const w = once(t, .4, 4.6, .6, .6); k.hip({ y: -.45 * w, z: -.05 * w }); k.FR(.14, 0, .35 * w).FL(.14, .02 * w, -.42 * w); k.R(.25, .95 - .2 * w, .35 * w).L(.25, .95 - .1 * w, .1).hand("fist", "relax").head({ pitch: .2 * w }); });
  add("assis", "Pause assise", "commun", 6, 0, (k, t) => { const w = once(t, .5, 5.5, .8, .8); k.hip({ y: -.5 * w, z: -.18 * w, pitch: -.05 * w }); k.FR(.15, 0, .32 * w).FL(.15, 0, .32 * w); k.R(.2, .7 + .1 * (1 - w), .3 * w).L(.2, .7 + .1 * (1 - w), .3 * w).hand("relax").head({ yaw: .2 * sin(t * .7) * w }); });
  add("meditation", "Zen", "rare", 8, 0, (k, t) => { const w = once(t, .6, 7.4, 1, 1), br = sin(t * 1.4) * .015; k.hip({ y: -.38 * w + br }); k.FR(.3, 0, .1).FL(.3, 0, .1); k.R(.32, .85 + br, .25).L(.32, .85 + br, .25).hand("relax").head({ pitch: .1 * w }); });
  add("etirement", "Étirements", "commun", 5, 0, (k, t) => { const ph = fr(t / 2.5), side = ph < .5 ? 1 : -1, w = once(t, .3, 4.7); k.R(.15, 2.05, .05).L(.15, 2.05, .05).hand("open").chest({ roll: .25 * side * w }).hip({ x: -.04 * side * w }); });
  add("pompes-bras", "Échauffement des bras", "commun", 5, 0, (k, t) => { const a = t * 7; k.R(.55 * cos(a) + .05, 1.45 + .55 * sin(a), .05).L(.55 * cos(a + .6) + .05, 1.45 + .55 * sin(a + .6), .05).hand("fist"); step.bounce(k, t * 2, .02); });
  add("saut-joie", "Saut de joie", "rare", 3, 0, (k, t) => { const j = sin(cl((t - .3) / .8) * Math.PI); k.hip({ y: .5 * j - .1 * sm(t / .3) * (1 - sm((t - .3) / .2)) }); k.FR(.12, .5 * j + .15 * j, -.1 * j).FL(.12, .5 * j + .2 * j, -.15 * j); k.R(.35, 1.4 + .75 * j, .1).L(.35, 1.4 + .75 * j, .1).hand("fist").head({ pitch: -.25 * j }); });
  add("flexion", "Squats", "commun", 6, 60, (k, t, b) => { const d = .5 - .5 * C(b / 2); step.squat(k, .4 * d); k.R(.2, 1.4 - .2 * d, .45 * d + .1).L(.2, 1.4 - .2 * d, .45 * d + .1).hand("fist"); });
  add("colere", "Ça m'énerve !", "rare", 4, 0, (k, t) => { const st2 = pulse(t * 2.5, .3); k.FR(.14, .15 * st2, .05).FL(.12, 0, 0); k.R(.3, 1.0 + .3 * st2, .15).L(.3, 1.0 + .3 * st2, .15).hand("fist").chest({ pitch: .15 }).head({ pitch: .2 + .1 * st2 }); k.hip({ y: -.04 * st2 }); });
  add("frisson", "Brrr…", "commun", 4, 0, (k, t) => { const w = once(t, .2, 3.8), sh = sin(t * 40) * .012 * w; k.R(-.1, 1.3 + sh, .2).L(-.1, 1.3 - sh, .22).hand("fist").chest({ pitch: .1 * w }).head({ pitch: .1 * w, yaw: sh * 4 }); k.hip({ x: sh }); });
  add("prise-photo", "Photographe", "rare", 5, 0, (k, t) => { const w = once(t, .3, 4.7), cl2 = pulse(t * 1.2, .08); k.R(.1, 1.6, .2).L(.1, 1.6, .2).hand("claw").head({ pitch: .05 * cl2 }); k.hip({ y: -.05 * w }); k.FR(.15, 0, .1).FL(.15, 0, -.05); });
  add("baguette", "Baguette magique", "epique", 5, 0, (k, t) => { const w = once(t, .3, 4.7), a = t * 6; k.R(.25 + .12 * cos(a), 1.55 + .12 * sin(a), .4).L(.3, 1.0, .1).hand("fist", "open").head({ pitch: -.1, yaw: .1 * sin(a) }); k.chest({ yaw: .1 * sin(a) * w }); });
  add("magicien", "Abracadabra", "epique", 4, 0, (k, t) => { const reveal = sm((t - 1.6) / .3) * (1 - sm((t - 3.4) / .4)); k.R(.15 + .45 * reveal, 1.25 + .6 * reveal, .3).L(.15 + .45 * reveal, 1.25 + .6 * reveal, .3).hand(reveal > .5 ? "open" : "fist").head({ pitch: -.15 * reveal }); k.hip({ y: -.08 * (1 - reveal) * sm(t / .5) }); });
  add("statue", "Statue", "commun", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.1, 2.05, .3).L(.3, 1.0, -.1).hand("point", "fist").chest({ pitch: -.1 * w }).head({ pitch: -.25 * w, yaw: .2 }); k.FR(.1, 0, .2).FL(.15, 0, -.1); });
  add("courbette", "Courbette", "rare", 4, 0, (k, t) => { const w = once(t, .4, 3.6, .7, .7); k.R(.15, 1.3, .3).L(.5, 1.55, -.2).hand("open").chest({ pitch: .45 * w }).head({ pitch: .2 * w }); k.FR(.1, 0, .05).FL(.1, 0, -.25 * w); k.hip({ y: -.08 * w }); });
  add("detective", "Détective", "rare", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.05, 1.45, .32).L(.15, 1.05, .1).hand("cup", "relax").chest({ pitch: .25 * w }).head({ pitch: .35 * w, yaw: .3 * sin(t * 1.5) * w }); k.hip({ y: -.08 * w }); k.FR(.16, 0, .12).FL(.14, 0, -.08); });
  add("bisou", "Bisou soufflé", "rare", 3, 0, (k, t) => { const out = sm((t - 1.1) / .4) * (1 - sm((t - 2.5) / .4)); k.R(.08 + .3 * out, 1.62 - .1 * out, .12 + .45 * out).hand(out > .3 ? "open" : "cup", "relax").head({ pitch: -.05 * out, roll: .1 }); });
  add("ninja", "Ninja", "epique", 5, 0, (k, t) => { const w = once(t, .2, 4.8); k.hip({ y: -.25 * w }); k.FR(.28, 0, .12).FL(.28, 0, -.12); k.R(.0, 1.38, .3).L(.0, 1.38, .3).hand("peace", "fist").head({ yaw: .4 * sin(t * 1.3) * w, pitch: .05 }); });
  add("super-heros", "Super-héros", "legendaire", 5, 0, (k, t) => { const w = once(t, .3, 4.7); k.R(.27, .98, -.02, [1, 1.1, -.1]).L(.27, .98, -.02, [1, 1.1, -.1]).hand("fist").chest({ pitch: -.12 * w }).head({ pitch: -.2 * w, yaw: .2 }); k.FR(.22, 0, .05).FL(.22, 0, -.02); });
  add("decollage", "Décollage", "legendaire", 4, 0, (k, t) => { const c2 = sm(t / 1), j = sm((t - 1.2) / .6) * (1 - sm((t - 3.2) / .5)); k.hip({ y: -.25 * c2 * (1 - j) + .9 * j }); k.FR(.12, .9 * j, 0).FL(.12, .9 * j, 0); k.R(.08, 1.5 + .8 * j, .2).L(.08, 1.5 + .8 * j, .2).hand("fist").head({ pitch: -.3 * j }); });
  add("mime-mur", "Mime : le mur", "epique", 6, 0, (k, t) => { const q = Math.floor(t * 1.2) % 4, w = once(t, .3, 5.7); k.R(.2 + (q % 2 ? .1 : 0), 1.35 + (q === 1 ? .25 : 0), .42).L(.2 + (q % 2 ? 0 : .1), 1.35 + (q === 3 ? .25 : 0), .42).hand("open").head({ yaw: .15 * sin(t), pitch: .05 }); k.hip({ x: .03 * sin(t * 1.2) * w }); });
  add("mime-corde", "Mime : la corde", "epique", 6, 0, (k, t) => { const pull = fr(t * .8), h = .35 * pull; k.R(.06, 1.75 - h, .32).L(.06, 1.35 - h + .35 * (pull > .5 ? 1 : 0) * 0, .32).hand("fist").chest({ pitch: .1 + .1 * pull }); k.hip({ y: -.08 - .05 * pull }); k.FR(.16, 0, -.12).FL(.16, 0, .12); });
  add("pecheur", "Pêcheur", "rare", 6, 0, (k, t) => { const cast = sm((t - .4) / .5) * (1 - sm((t - 1.4) / .3)), reel = Math.max(0, t - 2) * 7; k.R(.18 + .05 * cos(reel), 1.2 + .5 * cast + .05 * sin(reel), .3 - .2 * cast).L(.15, 1.15, .35).hand("fist").chest({ pitch: -.1 * cast }); });
  add("bucheron", "Bûcheron", "commun", 6, 72, (k, t, b) => { const sw = pulse(b, .45); k.R(.08, 1.85 - .85 * sw, .22 + .25 * sw).L(.04, 1.7 - .8 * sw, .2 + .25 * sw).hand("fist").chest({ pitch: .3 * sw - .1 }).head({ pitch: .2 * sw }); k.hip({ y: -.1 * sw }); k.FR(.2, 0, .05).FL(.2, 0, -.05); });
  add("cuisinier", "Chef cuisinier", "rare", 6, 120, (k, t, b) => { const f = pulse(b, .45); k.R(.15, 1.15 + .25 * f, .4).L(.25, 1.1, .32).hand("fist", "cup").head({ pitch: .15 - .25 * f }).chest({ pitch: .05 }); });
  add("peintre", "Peintre", "rare", 6, 0, (k, t) => { const a = t * 2.5; k.R(.15 + .25 * sin(a), 1.4 + .25 * sin(a * .5), .5).L(.25, 1.15, .25).hand("fist", "open").head({ yaw: .2 * sin(a), pitch: -.05 }).chest({ yaw: .1 * sin(a) }); });
  add("jardinier", "Jardinier", "commun", 6, 0, (k, t) => { const s2 = pulse(t * .9, .5); k.hip({ y: -.3 }); k.FR(.2, 0, .12).FL(.2, 0, -.05); k.R(.12, .65 + .2 * s2, .45).L(.12, .7 + .2 * s2, .4).hand("fist").chest({ pitch: .35 }).head({ pitch: .3 }); });
  add("arbitre", "Carton rouge", "commun", 3.5, 0, (k, t) => { const up = sm((t - .4) / .3) * (1 - sm((t - 2.8) / .4)); k.R(.12, 1.3 + .8 * up, .2 + .1 * up).L(.2, 1.0, .1).hand("cup", "relax").head({ yaw: .2, pitch: -.1 * up }).chest({ pitch: -.06 * up }); });
  add("dab", "Coup de coude", "rare", 3, 0, (k, t) => { const w = once(t, .15, 2.7); k.R(.62 * w, 1.75 * w + 1.0 * (1 - w), .1).L(.04, 1.62, .25, [-.4, 1.8, .2]).hand("open").head({ pitch: .45 * w, yaw: -.35 * w }).chest({ pitch: .15 * w }); });
  add("superstar", "Superstar", "legendaire", 5, 0, (k, t) => { const w = once(t, .3, 4.7), sp = sm((t - .3) / 1.2); k.hip({ turn: sp * TAU, y: .03 }); k.FR(.08, 0, 0).FL(.08, 0, 0); k.R(.55, 2.0, .15).L(.2, 1.0, .1).hand("peace", "relax").head({ pitch: -.2 * w }); });
  add("tap-tap", "Pied qui tape", "commun", 5, 120, (k, t, b) => { const tp = pulse(b, .35); k.FR(.15, .05 * tp, .12).FL(.12, 0, 0); k.R(.27, .98, -.02, [1, 1.1, -.1]).L(.3, .95, .1).hand("fist", "relax").head({ yaw: .2, pitch: .05 * tp }); });

  const EMOTES = Object.keys(LIB).filter((k) => LIB[k].kind === "emote");

  /* ---- 3. petits gestes à l'arrêt (choisis au hasard quand on attend) */
  const FIDGET = {};
  function fid(id, dur, fn) { FIDGET[id] = { dur, fn }; }
  fid("regarde-autour", 3.2, (k, t, w) => k.head({ yaw: .7 * sin(t * 2) * w, pitch: -.05 * w }).chest({ yaw: .2 * sin(t * 2) * w }));
  fid("epaules", 2.4, (k, t, w) => { const u = pulse(t * .8, .5) * w; k.chest({ pitch: -.04 * u }).head({ roll: .06 * u }); });
  fid("etire-bras", 3, (k, t, w) => k.R(.15, 1.45 + .65 * w, .05).L(.15, 1.45 + .65 * w, .05).hand("fist").chest({ pitch: -.15 * w }).head({ pitch: -.2 * w }));
  fid("poignet", 2.6, (k, t, w) => k.L(.02, 1.32 * w + .9 * (1 - w), .32 * w).hand(null, "fist").head({ pitch: .3 * w, yaw: .25 * w }));
  fid("gratte-tete", 2.6, (k, t, w) => k.R(.08, 1.78 * w + .9 * (1 - w), .02 + .02 * sin(t * 14)).hand("claw").head({ roll: -.12 * w, pitch: .05 }));
  fid("tape-pied", 3, (k, t, w) => { const tp = pulse(t * 2.2, .35) * w; k.FR(.13, .05 * tp, .1).FL(.12, 0, 0).head({ yaw: .1 }); });
  fid("poids-du-corps", 3.4, (k, t, w) => { const s2 = sin(t * 1.8) * w; k.hip({ x: .05 * s2, roll: -.04 * s2 }).FR(.12, 0, 0).FL(.12, 0, 0).head({ roll: .05 * s2 }); });
  fid("craque-nuque", 2.4, (k, t, w) => k.head({ roll: .35 * sin(Math.min(1, t / 1.2) * Math.PI) * w, yaw: -.1 * w }));
  fid("soupir", 2.8, (k, t, w) => { const u = sin(Math.min(1, t / 2.2) * Math.PI) * w; k.chest({ pitch: -.12 * u }).head({ pitch: -.15 * u + .1 * (1 - u) * w }); });
  fid("gants", 2.8, (k, t, w) => k.R(-.02, 1.15 * w + .9 * (1 - w), .3 * w).L(.1, 1.15 * w + .9 * (1 - w), .32 * w).hand("fist", "open").head({ pitch: .25 * w }));
  fid("visiere", 3, (k, t, w) => k.R(.05, 1.74 * w + .9 * (1 - w), .12 * w).hand("open").head({ pitch: -.12 * w, yaw: .3 * sin(t) * w }));
  fid("bras-croises", 3.4, (k, t, w) => k.R(-.12, 1.22 * w + .9 * (1 - w), .2 * w).L(-.12, 1.18 * w + .9 * (1 - w), .22 * w).hand("relax").head({ yaw: .2 * sin(t) * w }));
  fid("hanches", 3, (k, t, w) => k.R(.27, .98, -.02, [1, 1.1, -.1]).L(.27, .98, -.02, [1, 1.1, -.1]).hand("fist").chest({ pitch: -.05 * w }));
  fid("sautille", 2.4, (k, t, w) => { const j = pulse(t * 2.2, .5) * w; k.hip({ y: .05 * j - .02 * w }).FR(.12, .05 * j, 0).FL(.12, .05 * j, 0); });
  fid("baille", 3, (k, t, w) => { const u = sin(Math.min(1, t / 2.6) * Math.PI) * w; k.R(.25, 1.0 + .95 * u, 0).L(.25, 1.0 + .95 * u, 0).hand("fist").head({ pitch: -.3 * u }).chest({ pitch: -.15 * u }); });
  fid("poussiere", 2.6, (k, t, w) => k.R(.1, 1.15 * w + .9 * (1 - w), .15 + .08 * sin(t * 12)).hand("open").head({ pitch: .3 * w, roll: .05 }).chest({ pitch: .12 * w }));
  fid("chantonne", 3.4, (k, t, w) => { const s2 = sin(t * 4) * w; k.head({ roll: .1 * s2, pitch: .04 * abs(s2) }).hip({ x: .02 * s2 }).FR(.12, 0, 0).FL(.12, 0, 0); });
  fid("tour-cheville", 2.8, (k, t, w) => { const a = t * 6; k.FL(.14 + .03 * cos(a) * w, .06 * w, .1 * w + .03 * sin(a) * w).FR(.12, 0, 0).head({ pitch: .15 * w }); });
  const FIDGETS = Object.keys(FIDGET);

  /* ================================================================ application */
  const per = new WeakMap(); // état par personnage
  function stateOf(group) { let s = per.get(group); if (!s) { s = { w: 0, fid: null, fidT: 0, idleT: 0, nextFid: 4 + Math.random() * 6, yaw: null, lean: 0, sprint: 0, land: 0, wasAir: false, airT: 0, hp: null, hit: 0, hitDir: 0, lastStyle: null, ew: 0, prevEw: 0 }; per.set(group, s); } return s; }

  function applyPose(group, inst, P, w) {
    const Bn = inst.bones; group.updateMatrixWorld(true);
    // 1. hanches : déplacement et rotation du corps entier (pivot au bassin)
    const h = P.hip || {}, turnA = h.turn || 0;
    if (P.hip) {
      _m.makeTranslation((h.x || 0) * w, (h.y || 0) * w, -(h.z || 0) * w)
        .multiply(_m2.makeTranslation(0, .95, 0)).multiply(_m3.makeRotationFromEuler(_e.set(-(h.pitch || 0) * w, ((h.yaw || 0) + turnA) * w, -(h.roll || 0) * w, "YXZ")))
        .multiply(_m2.makeTranslation(0, -.95, 0));
      inst.model.matrix.premultiply(_m); inst.model.matrixWorldNeedsUpdate = true; group.updateMatrixWorld(true);
    }
    // repère du corps (les mains bougent avec lui) et repère du sol (les pieds restent posés, ne tournent qu'avec « turn »)
    const body = new T.Matrix4().makeTranslation((h.x || 0) * w, (h.y || 0) * w, -(h.z || 0) * w).multiply(new T.Matrix4().makeTranslation(0, .95, 0)).multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(-(h.pitch || 0) * w, ((h.yaw || 0) + turnA) * w, -(h.roll || 0) * w, "YXZ"))).multiply(new T.Matrix4().makeTranslation(0, -.95, 0));
    const ground = new T.Matrix4().makeRotationY(turnA * w);
    const W = (m, a) => group.localToWorld(new T.Vector3(a[0], a[1], -a[2]).applyMatrix4(m));
    // 2. buste et tête
    const c = P.chest; if (c) { for (const [n, f] of [["spine_01", .3], ["spine_02", .35], ["spine_03", .35]]) { const b = Bn[n]; if (!b) continue; turn(b, group, 0, 1, 0, (c.yaw || 0) * f * w); turn(b, group, 1, 0, 0, -(c.pitch || 0) * f * w); turn(b, group, 0, 0, 1, -(c.roll || 0) * f * w); } }
    const hd = P.head; if (hd && Bn.Head) { turn(Bn.Head, group, 0, 1, 0, (hd.yaw || 0) * w); turn(Bn.Head, group, 1, 0, 0, -(hd.pitch || 0) * w); turn(Bn.Head, group, 0, 0, 1, -(hd.roll || 0) * w); }
    // 3. jambes (avant les bras : le bassin peut avoir bougé)
    if (P.legs) {
      const fR = P.FR || [.11, 0, 0], fL = P.FL || [-.11, 0, 0];
      ik(Bn.thigh_r, Bn.calf_r, Bn.foot_r, W(ground, [fR[0], fR[1] + .08, fR[2]]), W(ground, [fR[0] + .05, .55, 1.2]), w);
      ik(Bn.thigh_l, Bn.calf_l, Bn.foot_l, W(ground, [fL[0], fL[1] + .08, fL[2]]), W(ground, [fL[0] - .05, .55, 1.2]), w);
    }
    // 4. bras
    for (const [side, arm, sg] of [["R", [Bn.upperarm_r, Bn.lowerarm_r, Bn.hand_r], 1], ["L", [Bn.upperarm_l, Bn.lowerarm_l, Bn.hand_l], -1]]) {
      const a = P[side]; if (!a) continue;
      const pole = a.e || [sg * e[0], e[1], e[2]];
      ik(arm[0], arm[1], arm[2], W(body, a.h), W(body, pole), w);
    }
    // 5. doigts
    if (P.fR) fingers(inst, "r", P.fR, w);
    if (P.fL) fingers(inst, "l", P.fL, w);
  }

  function emoteFor(p) { return p && p.emote > 0 && !p.gliding && !p.falling && LIB[p.emoteStyle] ? LIB[p.emoteStyle] : null; }

  function drive(view, group, p, dt, options) {
    const u = group.userData, inst = u && u.ch1; if (!inst || !inst.anim) return;
    if (options.menu && !options.local) { /* aperçu du casier : on joue aussi l'émote si demandée */ }
    const s = stateOf(group), an = inst.anim, Bn = inst.bones;
    const E = root.AZEvent, evOn = !!(E && E.active && options.local && E.playerInfo && E.playerInfo.mode && E.playerInfo.mode !== "none");
    const em = emoteFor(p);
    // ---------------------------------------------------------------- ÉMOTE
    if (em) {
      const et = Math.max(0, (+p.emoteDuration || em.dur) - (+p.emote || 0));
      s.ew = Math.min(1, et * 4) * Math.min(1, (+p.emote || 0) * 3);
      const P = newPose(), k = K(P, et), b = et * (em.bpm || 60) / 60;
      em.fn(k, et, b);
      applyPose(group, inst, P, s.ew);
      return;
    }
    if (evOn || p.downed || p.swimming || p.vehicleId || !options.local) return; // couches en jeu : joueur local (coût)
    // ---------------------------------------------------------- COUCHES EN JEU
    const air = !!(p.jumping || p.falling || p.gliding || p.flying), armed = !!(u.gun && u.gun.visible), tool = !!(u.tool && u.tool.visible);
    const speed = an.speed || 0, t = (s.clock = (s.clock || 0) + dt);
    // virages : écart de cap par seconde
    const yaw = +p.yaw || 0; if (s.yaw == null) s.yaw = yaw; let dy = yaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw = yaw;
    const yawRate = dt > 0 ? dy / dt : 0;
    s.lean += (Math.max(-.22, Math.min(.22, -yawRate * .045 * Math.min(1, speed / 3))) - s.lean) * Math.min(1, dt * 6);
    s.sprint += ((speed > 6.5 && !air ? 1 : 0) - s.sprint) * Math.min(1, dt * 4);
    // réception : genoux qui amortissent
    if (!air && s.wasAir && s.airT > .25) s.land = Math.min(1, .45 + s.airT * .35);
    s.land = Math.max(0, s.land - dt * 3.2); s.airT = air ? s.airT + dt : 0; s.wasAir = air;
    // touché : petit recul
    const hpNow = (+p.hp || 0) + (+p.shield || 0); if (s.hp != null && hpNow < s.hp - 1) { s.hit = 1; s.hitDir = Math.random() < .5 ? 1 : -1; } s.hp = hpNow; s.hit = Math.max(0, s.hit - dt * 3.5);
    const P = newPose(), k = K(P, t);
    // 1 respiration · 2 penché dans les virages · 3 penché en sprint · 4 rebond de foulée
    const breath = sin(t * 1.7) * (speed < .4 ? 1 : .4);
    k.chest({ pitch: .015 * breath + .12 * s.sprint + .05 * Math.min(1, speed / 4) - .08 * s.hit, roll: s.lean * .6 + .08 * s.hit * s.hitDir, yaw: .06 * s.hit * s.hitDir });
    k.head({ pitch: -.04 * s.sprint + .08 * s.hit, roll: -s.lean * .35 });
    if (!air && speed > .6) { const ph = (an.phase || t * speed * 1.6); k.hip({ roll: s.lean * .4, y: -.012 * abs(sin(ph * 2)) * Math.min(1, speed / 4) }); P.legs = false; }
    // 5 réception : flexion
    if (s.land > 0 && !air) { const l = sin(Math.min(1, (1 - s.land)) * Math.PI) * s.land; k.hip({ y: -.16 * l, pitch: .1 * l }); k.chest({ pitch: .1 * l }); if (!armed && !tool) k.R(.32, .95 - .1 * l, .2 * l).L(.32, .95 - .1 * l, .2 * l); }
    // 6 bras levés au saut · 7 jambes repliées en l'air · 8 bras qui moulinent en grande chute
    if (p.jumping && !p.gliding && !armed) { const j = Math.min(1, s.airT * 3); if (!tool) k.R(.38, 1.25 + .25 * j, .1); k.L(.38, 1.25 + .25 * j, .1); k.FR(.12, .18 * j, .08 * j).FL(.12, .1 * j, -.05 * j); }
    if (p.falling && !p.gliding && !p.airborneFromBus && s.airT > .8 && !armed) { const a = t * 9; k.R(.45 + .1 * cos(a), 1.65 + .2 * sin(a), .1).L(.45 + .1 * cos(a + 2), 1.65 + .2 * sin(a + 2), .1).hand("open"); k.FR(.15, .25 + .08 * sin(a), .1).FL(.15, .2 + .08 * sin(a + 1.5), -.05); }
    // 9 planeur : jambes qui pendent et balancent avec les virages · 10 chute libre : battement
    if (p.gliding) { const sw = s.lean * 2; k.hip({ roll: sw * .5 }); k.FR(.13, .08 + .04 * sin(t * 2.1), .04 * sin(t * 1.3)).FL(.13, .06 + .04 * sin(t * 2.1 + 1), .04 * sin(t * 1.3 + 2)); }
    else if (p.falling && p.airborneFromBus) { k.FR(.16, .1 + .05 * sin(t * 3), .05).FL(.16, .1 + .05 * sin(t * 3 + 2), .05); }
    // 11 tête qui suit la visée (léger), 12 accroupi plus bas
    if (p.crouching && !air) { k.chest({ pitch: .08 }); }
    // 13-14 petits gestes à l'arrêt : un de temps en temps
    const idle = !air && speed < .3 && !armed && !p.useTime && !p.reload && !(p.inventory && p._input && p._input.fire);
    if (idle) {
      s.idleT += dt;
      if (!s.fid && s.idleT > s.nextFid) { s.fid = FIDGETS[Math.floor(Math.random() * FIDGETS.length)]; s.fidT = 0; }
    } else { s.idleT = 0; s.fid = null; }
    if (s.fid) {
      const F = FIDGET[s.fid]; s.fidT += dt;
      if (s.fidT > F.dur) { s.fid = null; s.idleT = 0; s.nextFid = 5 + Math.random() * 8; }
      else {
        const fw = sm(s.fidT / .45) * (1 - sm((s.fidT - (F.dur - .45)) / .45)); const kk = K(P, s.fidT); F.fn(kk, s.fidT, fw);
        if (tool) { P.R = null; P.fR = null; } // la pioche reste dans la main droite
        applyPose(group, inst, P, 1); return;
      }
    }
    if (tool) { P.R = null; P.fR = null; }
    applyPose(group, inst, P, 1);
  }

  /* ------------------------------------------------ branchement dans la vue */
  const prev = V.prototype.animateAvatar;
  V.prototype.animateAvatar = function (model, player, dt, options) {
    const r = prev.apply(this, arguments);
    try { if (model && model.userData && player) drive(this, model, player, Math.min(.1, Math.max(0, +dt || 0)), options || {}); }
    catch (err) { if (!V.prototype.__moves105Warn) { V.prototype.__moves105Warn = true; if (root.console) console.warn("[AZUR moves105]", err); } }
    return r;
  };

  /* --------------------------- émotes : simulation, catalogue, propriété, roue */
  const EXTRA = (root.AZ_EMOTE_EXTRA = root.AZ_EMOTE_EXTRA || {});
  for (const id of EMOTES) EXTRA[id] = LIB[id].dur;
  if (root.AZEmotes95 && root.AZEmotes95.defs) for (const id of EMOTES) root.AZEmotes95.defs[id] = { name: LIB[id].name, clip: "Idle_Loop", ts: 1, rarity: LIB[id].rarity, hands: null, body: null };
  const ADDED = [];
  if (META && Array.isArray(META.catalog)) {
    const ICONS = "♪♫♬✦★☺✋☝⚑✧", COL = ["#9ad8ff", "#ffd04a", "#ff9ac8", "#7fe0c0", "#c59bff"], PRICE = { commun: 200, "peu-commun": 300, rare: 500, epique: 800, legendaire: 1200 };
    EMOTES.forEach((id, i) => {
      const d = LIB[id], cid = "emote-" + id; if (META.catalog.some((c) => c.id === cid)) return;
      META.catalog.push({ id: cid, name: d.name, type: "emote", rarity: d.rarity, price: PRICE[d.rarity] || 300, description: d.loop ? "Danse en boucle" : "Geste", color: COL[i % COL.length], secondary: "#14264a", icon: ICONS[i % ICONS.length], collection: "Mouvements v105", style: id });
      ADDED.push(cid);
    });
  }
  function grant(p) { if (!p || !Array.isArray(p.owned)) return false; let ch = false; for (const id of ADDED) if (p.owned.indexOf(id) < 0) { p.owned.push(id); ch = true; } return ch; }
  if (META && typeof META.normalize === "function" && !META.normalize.__v105) { const n0 = META.normalize; META.normalize = function () { const out = n0.apply(this, arguments); try { grant(out); } catch (e) {} return out; }; META.normalize.__v105 = true; }
  (function () { let n = 0; const tm = setInterval(() => { const g = root.AZUR; if (++n > 240) return clearInterval(tm); if (!g || !g.profile) return; clearInterval(tm); try { if (grant(g.profile) && g.queueSave) g.queueSave(); } catch (e) {} }, 500); })();

  root.AZMoves105 = { LIB, EMOTES, FIDGET, FIDGETS, applyPose, newPose, K, count: () => ({ emotes: EMOTES.length, fidgets: FIDGETS.length, layers: 14 }) };
})(typeof globalThis !== "undefined" ? globalThis : this);
