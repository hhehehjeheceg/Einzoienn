/* AZUR v107 — ch1-moves-v107.js : 100+ MOUVEMENTS EN JEU qui se déclenchent tout seuls pendant la partie.
 * Les émotes (ch1-moves-v105.js) se lancent à la roue ; ici, c'est le personnage qui réagit à ce qu'il fait :
 *  1. départs, freinages, demi-tours, pivots sur place          (9)
 *  2. allures : marche, course, sprint, pas chassés, recul, pentes, accroupi (12, choisies selon le joueur)
 *  3. sauts : simple, en course, groupé, étoile, vrille, d'arrêt, arrière, de côté, armé… (12)
 *  4. chutes et réceptions : douce, amortie, lourde (main au sol), roulade, trébuche… (10)
 *  5. planeur : déploiement, virages, piqué, freinage, jambes qui battent, rangement (8)
 *  6. armes : recul propre à chaque arme, rechargements, dégainer, visée, tir en courant… (16)
 *  7. récolte, construction, coffres, ramassage, édition, portes (14)
 *  8. réactions : touché devant / dos / côtés, gros coup, tir à la tête, bouclier cassé, soins, boiteux… (14)
 *  9. environnement : entrée et sortie de l'eau, eau peu profonde, glissade, pente raide, hauteur, vent, nuit (10)
 * 10. 16 nouveaux petits gestes à l'arrêt, ajoutés à ceux de v105 (regarde le ciel, ajuste le sac, lacet…)
 * Tout est écrit à la main sur le squelette (cinématique inverse de v105 pour les membres, rotations additives pour
 * le corps), au-dessus des clips d'animation. Joueur local + personnages proches (≤ 35 m), pas pendant une émote ni
 * pendant les phases scénarisées de « La Fin ». Repère d'écriture : x à droite, y en haut, z devant (mètres). */
(function (root) {
  "use strict";
  const T = root.THREE, D = root.AZMoves105, V = root.AZView && root.AZView.View;
  if (!T || !D || !V || !V.prototype || V.prototype.__moves107) return;
  V.prototype.__moves107 = true;

  /* ------------------------------------------------------------------ outils */
  const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, abs = Math.abs;
  const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const fr = (x) => x - Math.floor(x), pulse = (x, w = .25) => { const f = fr(x); return f < w ? sin(f / w * Math.PI) : 0; };
  const bell = (t, d) => sin(cl(t / d) * Math.PI), lerp = (a, b, k) => a + (b - a) * k;
  const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _ax = new T.Vector3();
  function turn(bone, group, ax, ay, az, ang) {
    if (!bone || abs(ang) < 1e-5) return;
    _ax.set(ax, ay, az).transformDirection(group.matrixWorld);
    _q.setFromAxisAngle(_ax, ang); bone.getWorldQuaternion(_q2); _q.multiply(_q2);
    bone.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q); bone.quaternion.copy(_q2); bone.updateMatrixWorld(true);
  }
  function hsh(n) { const x = sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ------------------------------------------- écriture d'une pose (additive pour le corps, IK pour les membres) */
  function newAcc() { return { hip: { x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0, turn: 0 }, chest: { pitch: 0, yaw: 0, roll: 0 }, head: { pitch: 0, yaw: 0, roll: 0 }, arm: { R: [0, 0, 0], L: [0, 0, 0] }, leg: { R: [0, 0], L: [0, 0] }, plant: false, lim: null, limW: 0 }; }
  function writer(A) {
    let w = 1;
    const add = (dst, o) => { for (const k in o) if (dst[k] !== undefined) dst[k] += o[k] * w; };
    const lim = () => { if (!A.lim || A.limW < w) { A.lim = D.newPose(); A.limW = w; } return A.lim; };
    return {
      set w(v) { w = v; }, get w() { return w; },
      hip(o) { add(A.hip, o); return this; }, chest(o) { add(A.chest, o); return this; }, head(o) { add(A.head, o); return this; },
      // bras : épaule vers l'avant (pitch), écartée (out), coude plié (bend) — additif sur le clip, garde la foulée
      armR(p, o, b) { const a = A.arm.R; a[0] += p * w; a[1] += (o || 0) * w; a[2] += (b || 0) * w; return this; },
      armL(p, o, b) { const a = A.arm.L; a[0] += p * w; a[1] += (o || 0) * w; a[2] += (b || 0) * w; return this; },
      arms(p, o, b) { return this.armR(p, o, b).armL(p, o, b); },
      legR(p, b) { A.leg.R[0] += p * w; A.leg.R[1] += (b || 0) * w; return this; }, legL(p, b) { A.leg.L[0] += p * w; A.leg.L[1] += (b || 0) * w; return this; },
      plant() { A.plant = true; return this; },
      // membres placés (IK, gestes ponctuels) : le geste le plus présent l'emporte
      R(x, y, z, e) { lim().R = { h: [x, y, z], e: e || null }; return this; },
      L(x, y, z, e) { lim().L = { h: [-x, y, z], e: e ? [-e[0], e[1], e[2]] : null }; return this; },
      both(x, y, z, e) { return this.R(x, y, z, e).L(x, y, z, e); },
      FR(x, y, z) { const P = lim(); P.FR = [x, y, z]; P.legs = true; return this; },
      FL(x, y, z) { const P = lim(); P.FL = [-x, y, z]; P.legs = true; return this; },
      hand(r, l) { const P = lim(); P.fR = r; P.fL = l === undefined ? r : l; return this; },
    };
  }

  /* ================================================================ bibliothèque */
  const MV = {}; // id → { name, cat, dur (0 = continu), fn(k, t, c) }
  function mv(id, name, cat, dur, fn) { MV[id] = { id, name, cat, dur, fn }; }

  /* ---- 1. départs, freinages, demi-tours, pivots (gestes brefs) */
  mv("depart-marche", "Départ en marchant", "depart", .45, (k, t) => { const u = bell(t, .45); k.chest({ pitch: .08 * u }).head({ pitch: -.04 * u }).arms(.12 * u, 0, .1 * u); });
  mv("depart-course", "Départ en courant", "depart", .5, (k, t) => { const u = bell(t, .5); k.chest({ pitch: .2 * u }).head({ pitch: -.1 * u }).hip({ pitch: .08 * u }).armR(.45 * u, 0, .5 * u).armL(-.35 * u, 0, .4 * u); });
  mv("depart-sprint", "Départ explosif", "depart", .6, (k, t) => { const u = bell(t, .6); k.chest({ pitch: .32 * u }).head({ pitch: -.16 * u }).hip({ pitch: .14 * u, y: -.04 * u }).armR(.7 * u, .1 * u, .7 * u).armL(-.55 * u, .1 * u, .5 * u); });
  mv("freinage-course", "Freinage", "depart", .5, (k, t) => { const u = bell(t, .5); k.chest({ pitch: -.18 * u }).hip({ pitch: -.1 * u, y: -.05 * u }).arms(.25 * u, .35 * u, .3 * u).head({ pitch: .05 * u }); });
  mv("freinage-sprint", "Dérapage", "depart", .7, (k, t, c) => { const u = bell(t, .7), s = c.side || 1; k.chest({ pitch: -.25 * u, roll: .12 * s * u }).hip({ pitch: -.16 * u, y: -.12 * u, roll: .1 * s * u }).armR(.3 * u, .6 * u, .4 * u).armL(.3 * u, .6 * u, .4 * u).head({ roll: -.08 * s * u }); });
  mv("arret-net", "Arrêt net", "depart", .35, (k, t) => { const u = bell(t, .35); k.chest({ pitch: -.1 * u }).hip({ y: -.03 * u }).head({ pitch: .08 * u }); });
  mv("demi-tour", "Demi-tour", "depart", .55, (k, t, c) => { const u = bell(t, .55), s = c.side || 1; k.chest({ yaw: .45 * s * u, roll: .1 * s * u }).head({ yaw: .5 * s * u }).hip({ roll: .12 * s * u, y: -.05 * u }).armR(.2 * u, .5 * u, .3 * u).armL(.2 * u, .5 * u, .3 * u); });
  mv("pivot-gauche", "Pivot à gauche", "depart", .5, (k, t) => { const u = bell(t, .5), st = pulse(t / .5, .5); k.plant().FL(.14, .07 * st, .06 * st).FR(.1, 0, 0).hip({ yaw: .12 * u, y: -.02 * u }).head({ yaw: .2 * u }); });
  mv("pivot-droite", "Pivot à droite", "depart", .5, (k, t) => { const u = bell(t, .5), st = pulse(t / .5, .5); k.plant().FR(.14, .07 * st, .06 * st).FL(.1, 0, 0).hip({ yaw: -.12 * u, y: -.02 * u }).head({ yaw: -.2 * u }); });

  /* ---- 2. allures (continues, poids réglé par la vitesse et le style du personnage) */
  mv("marche-detendue", "Marche détendue", "allure", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: -.03, roll: .03 * sin(ph) }).head({ roll: -.03 * sin(ph), pitch: -.02 }).arms(-.05, .06, .15).hip({ roll: .04 * sin(ph) }); });
  mv("marche-decidee", "Marche décidée", "allure", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .06, yaw: .06 * sin(ph) }).head({ pitch: -.04 }).armR(.18 * sin(ph), .04, .35).armL(-.18 * sin(ph), .04, .35); });
  mv("marche-prudente", "Marche prudente", "allure", 0, (k, t, c) => { k.chest({ pitch: .1 }).head({ yaw: .25 * sin(t * .9), pitch: .02 }).arms(.12, .12, .5).hip({ y: -.05 }); });
  mv("course-athletique", "Course athlétique", "allure", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .1, yaw: .08 * sin(ph) }).armR(.35 * sin(ph), .05, .75).armL(-.35 * sin(ph), .05, .75).head({ yaw: -.04 * sin(ph) }); });
  mv("course-bras-hauts", "Course bras hauts", "allure", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .05 }).armR(.25 + .3 * sin(ph), .15, .9).armL(.25 - .3 * sin(ph), .15, .9); });
  mv("sprint-penche", "Sprint penché", "allure", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .2, yaw: .1 * sin(ph) }).head({ pitch: -.14 }).hip({ pitch: .06 }).armR(.55 * sin(ph), .02, 1.0).armL(-.55 * sin(ph), .02, 1.0); });
  mv("pas-chasse-gauche", "Pas de côté (gauche)", "allure", 0, (k, t, c) => { k.chest({ roll: -.1, yaw: .12 }).hip({ roll: -.06 }).head({ yaw: -.1 }).armL(0, .25, .2); });
  mv("pas-chasse-droite", "Pas de côté (droite)", "allure", 0, (k, t, c) => { k.chest({ roll: .1, yaw: -.12 }).hip({ roll: .06 }).head({ yaw: .1 }).armR(0, .25, .2); });
  mv("marche-arriere", "Recul", "allure", 0, (k, t, c) => { k.chest({ pitch: -.1 }).hip({ pitch: -.05 }).head({ pitch: .06 }).arms(.15, .12, .35); });
  mv("course-montee", "Course en montée", "allure", 0, (k, t, c) => { k.chest({ pitch: .18 * c.up }).head({ pitch: -.12 * c.up }).hip({ pitch: .08 * c.up }).arms(.2 * c.up, 0, .3 * c.up); });
  mv("course-descente", "Course en descente", "allure", 0, (k, t, c) => { k.chest({ pitch: -.14 * c.down }).hip({ pitch: -.08 * c.down }).arms(.1 * c.down, .3 * c.down, .2 * c.down).head({ pitch: .1 * c.down }); });
  mv("accroupi-avance", "Accroupi qui avance", "allure", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .14, yaw: .05 * sin(ph) }).head({ pitch: -.1, yaw: .12 * sin(t * .7) }).arms(.2, .1, .5); });

  /* ---- 3. sauts */
  mv("saut-simple", "Saut", "saut", .55, (k, t) => { const u = bell(t, .55); k.armR(.6 * u, .25 * u, .3 * u).armL(.6 * u, .25 * u, .3 * u).legR(.35 * u, .6 * u).legL(.1 * u, .3 * u).chest({ pitch: -.06 * u }); });
  mv("saut-course", "Saut en longueur", "saut", .7, (k, t) => { const u = bell(t, .7); k.legR(.7 * u, .2 * u).legL(-.45 * u, .9 * u).armR(-.4 * u, .2 * u, .3 * u).armL(.8 * u, .2 * u, .4 * u).chest({ pitch: .12 * u }).head({ pitch: -.1 * u }); });
  mv("saut-groupe", "Saut groupé", "saut", .7, (k, t) => { const u = bell(t, .7); k.legR(.9 * u, 1.5 * u).legL(.9 * u, 1.5 * u).arms(.9 * u, .1 * u, 1.2 * u).chest({ pitch: .3 * u }).head({ pitch: .2 * u }); });
  mv("saut-etoile", "Saut étoile", "saut", .7, (k, t) => { const u = bell(t, .7); k.arms(.1 * u, 1.3 * u, .1 * u).legR(.1 * u, .1 * u).legL(.1 * u, .1 * u).hip({ roll: 0 }).chest({ pitch: -.1 * u }).head({ pitch: -.15 * u }); A_spread(k, u); });
  mv("saut-vrille", "Saut vrillé", "saut", .8, (k, t) => { const s = sm(t / .7); k.hip({ turn: s * TAU }).arms(.3, .2, 1.1).legR(.3, .7).legL(.3, .7).head({ pitch: -.05 }); });
  mv("saut-arret", "Saut d'appel", "saut", .55, (k, t) => { const u = bell(t, .55); k.arms(.95 * u, .1 * u, .2 * u).legR(.5 * u, 1 * u).legL(.5 * u, 1 * u).chest({ pitch: -.1 * u }); });
  mv("saut-arriere", "Saut en arrière", "saut", .6, (k, t) => { const u = bell(t, .6); k.chest({ pitch: -.2 * u }).hip({ pitch: -.1 * u }).arms(.4 * u, .4 * u, .3 * u).legR(.4 * u, .6 * u).legL(.2 * u, .4 * u).head({ pitch: .1 * u }); });
  mv("saut-cote", "Saut de côté", "saut", .6, (k, t, c) => { const u = bell(t, .6), s = c.side || 1; k.chest({ roll: .16 * s * u }).hip({ roll: .1 * s * u }).armR(.3 * u, .6 * u, .3 * u).armL(.3 * u, .6 * u, .3 * u).legR(.3 * u, .5 * u).legL(.3 * u, .5 * u); });
  mv("saut-arme", "Saut armé", "saut", .55, (k, t) => { const u = bell(t, .55); k.legR(.4 * u, .8 * u).legL(.2 * u, .5 * u).chest({ pitch: .05 * u }).head({ pitch: -.04 * u }); });
  mv("saut-haut", "Saut depuis la hauteur", "saut", .9, (k, t) => { const u = bell(t, .9); k.head({ pitch: .35 * u }).chest({ pitch: .12 * u }).arms(.3 * u, .5 * u, .2 * u).legR(.3 * u, .5 * u).legL(.4 * u, .6 * u); });
  mv("apex", "Flottement au sommet", "saut", .35, (k, t) => { const u = bell(t, .35); k.arms(.15 * u, .2 * u, .1 * u).head({ pitch: -.05 * u }); });
  mv("double-appel", "Pédalage en l'air", "saut", .7, (k, t) => { const a = t * 14, u = bell(t, .7); k.legR(.6 * u * (.5 + .5 * sin(a)), .9 * u).legL(.6 * u * (.5 - .5 * sin(a)), .9 * u).arms(.5 * u, .4 * u, .3 * u); });
  function A_spread(k, u) { k.legR(.1 * u, 0); k.legL(.1 * u, 0); }

  /* ---- 4. chutes et réceptions */
  mv("reception-douce", "Réception souple", "reception", .35, (k, t) => { const u = bell(t, .35); k.plant().hip({ y: -.08 * u, pitch: .04 * u }).chest({ pitch: .05 * u }); });
  mv("reception-amortie", "Réception amortie", "reception", .55, (k, t) => { const u = bell(t, .55); k.plant().hip({ y: -.22 * u, pitch: .1 * u }).chest({ pitch: .15 * u }).arms(.35 * u, .25 * u, .3 * u); });
  mv("reception-lourde", "Réception lourde (main au sol)", "reception", .95, (k, t) => { const u = bell(t, .95); k.plant().hip({ y: -.5 * u, z: .05 * u, pitch: .2 * u }).FR(.16, 0, .28 * u).FL(.16, 0, -.25 * u).R(.22, .1 + .9 * (1 - u), .45).L(.4, .9, -.1).hand("open", "fist").chest({ pitch: .35 * u }).head({ pitch: -.15 * u }); });
  mv("roulade", "Roulade", "reception", .8, (k, t) => { const s = sm(t / .75); k.hip({ y: -.45 * bell(t, .8), pitch: s * TAU, z: .35 * s }).legR(.9, 1.6).legL(.9, 1.6).arms(.9, .2, 1.2).head({ pitch: .5 * bell(t, .8) }); });
  mv("reception-course", "Réception en courant", "reception", .4, (k, t) => { const u = bell(t, .4); k.chest({ pitch: .12 * u }).hip({ y: -.08 * u }).arms(.2 * u, .15 * u, .2 * u); });
  mv("trebuche", "Trébuche", "reception", .9, (k, t) => { const u = bell(t, .9), a = bell(t - .1, .5); k.chest({ pitch: .35 * a - .1 * u }).hip({ y: -.12 * a, pitch: .1 * a }).arms(.8 * a, .5 * a, .3 * a).head({ pitch: -.15 * a, roll: .1 * a }); });
  mv("chute-pedale", "Chute en pédalant", "chute", 0, (k, t) => { const a = t * 7; k.legR(.6 * (.5 + .5 * sin(a)), .9).legL(.6 * (.5 - .5 * sin(a)), .9).arms(.6, .9, .3).head({ pitch: .2 }); });
  mv("chute-ecartee", "Chute bras écartés", "chute", 0, (k, t) => { k.arms(.1, 1.25, .2).legR(.15 + .05 * sin(t * 3), .2).legL(.15 + .05 * sin(t * 3 + 1), .2).chest({ pitch: -.05 }).head({ pitch: .15 }); });
  mv("chute-plongeon", "Chute tête la première", "chute", 0, (k, t) => { k.hip({ pitch: .6 }).arms(1.2, .3, .1).legR(-.1, .1).legL(-.1, .1).head({ pitch: -.4 }); });
  mv("chute-regard", "Regard vers le sol", "chute", 0, (k, t) => { k.head({ pitch: .45 }).chest({ pitch: .1 }).arms(.3, .7, .3); });

  /* ---- 5. planeur */
  mv("planeur-ouvre", "Ouverture du planeur", "planeur", .8, (k, t) => { const u = bell(t, .8); k.arms(1.6 * u, .2 * u, .7 * u).chest({ pitch: -.15 * u }).legR(.3 * u, .5 * u).legL(.3 * u, .5 * u).head({ pitch: -.2 * u }); });
  mv("planeur-gauche", "Virage du planeur (gauche)", "planeur", 0, (k, t) => { k.chest({ roll: -.15 }).hip({ roll: -.1 }).armL(.5, .1, .3).armR(.9, .1, .3).legL(.1, .4).head({ roll: .1 }); });
  mv("planeur-droite", "Virage du planeur (droite)", "planeur", 0, (k, t) => { k.chest({ roll: .15 }).hip({ roll: .1 }).armR(.5, .1, .3).armL(.9, .1, .3).legR(.1, .4).head({ roll: -.1 }); });
  mv("planeur-pique", "Piqué", "planeur", 0, (k, t) => { k.hip({ pitch: .25 }).legR(-.15, .1).legL(-.15, .1).arms(1.3, .15, .4).head({ pitch: -.2 }); });
  mv("planeur-frein", "Freinage du planeur", "planeur", 0, (k, t) => { k.hip({ pitch: -.15 }).legR(.5, .3).legL(.5, .3).arms(1.6, .1, .8).chest({ pitch: -.1 }); });
  mv("planeur-jambes", "Jambes qui battent", "planeur", 0, (k, t) => { k.legR(.15 + .12 * sin(t * 2.3), .25 + .15 * sin(t * 2.3)).legL(.15 + .12 * sin(t * 2.3 + 2), .25 + .15 * sin(t * 2.3 + 2)); });
  mv("planeur-regarde", "Regard autour (planeur)", "planeur", 3.2, (k, t) => { const u = bell(t, 3.2); k.head({ yaw: .7 * sin(t * 1.8) * u, pitch: .25 * u }).chest({ yaw: .15 * sin(t * 1.8) * u }); });
  mv("planeur-range", "Rangement du planeur", "planeur", .6, (k, t) => { const u = bell(t, .6); k.arms(.8 * (1 - sm(t / .6)), .3 * u, .5 * u).hip({ y: -.1 * u }).chest({ pitch: .1 * u }); });

  /* ---- 6. armes (corps seulement : l'arme reste dans les mains du clip) */
  const recoil = (k, t, d, p, y, r) => { const u = t < .05 ? t / .05 : Math.max(0, 1 - (t - .05) / (d - .05)); k.chest({ pitch: -p * u, yaw: y * u, roll: r * u }).head({ pitch: -p * .5 * u }); };
  mv("recul-fusil", "Recul du fusil", "arme", .16, (k, t) => recoil(k, t, .16, .07, .02, 0));
  mv("recul-pompe", "Recul du fusil à pompe", "arme", .45, (k, t) => { recoil(k, t, .45, .22, .05, .02); k.hip({ z: -.06 * bell(t, .45) }); });
  mv("recul-pistolet", "Recul du pistolet", "arme", .2, (k, t) => recoil(k, t, .2, .1, -.03, 0));
  mv("recul-sniper", "Recul du sniper", "arme", .7, (k, t) => { recoil(k, t, .7, .3, .08, .04); k.hip({ z: -.05 * bell(t, .7) }); });
  mv("recul-smg", "Recul du SMG", "arme", .12, (k, t) => recoil(k, t, .12, .04, .03 * sin(t * 90), 0));
  mv("recul-lanceur", "Recul du lanceur", "arme", .8, (k, t) => { recoil(k, t, .8, .35, .1, .05); k.hip({ z: -.12 * bell(t, .8), y: -.05 * bell(t, .8) }); });
  mv("recharge-fusil", "Rechargement du fusil", "arme", 1.6, (k, t) => { const u = bell(t, 1.6), tap = pulse(t / .8, .2); k.chest({ pitch: .1 * u, yaw: .15 * u }).head({ pitch: .3 * u, yaw: .12 * u }).hip({ y: -.02 * tap }); });
  mv("recharge-pompe", "Rechargement cartouche par cartouche", "arme", 1.8, (k, t) => { const u = bell(t, 1.8), sh = pulse(t * 2.6, .4); k.chest({ pitch: .12 * u, yaw: .2 * u, roll: .04 * sh }).head({ pitch: .35 * u - .05 * sh }); });
  mv("recharge-pistolet", "Rechargement du pistolet", "arme", 1.25, (k, t) => { const u = bell(t, 1.25); k.chest({ pitch: .06 * u, yaw: -.12 * u }).head({ pitch: .28 * u, yaw: -.1 * u }); });
  mv("recharge-sniper", "Rechargement du sniper", "arme", 2, (k, t) => { const u = bell(t, 2), bolt = pulse(t / 1.2, .25); k.chest({ pitch: .14 * u, yaw: .18 * u }).head({ pitch: .32 * u, roll: .06 * bolt }).hip({ y: -.03 * u }); });
  mv("degainer", "Dégainer", "arme", .45, (k, t) => { const u = bell(t, .45); k.chest({ pitch: .12 * u, yaw: -.2 * u }).head({ pitch: .1 * u }).hip({ y: -.03 * u }); });
  mv("ranger-arme", "Ranger l'arme", "arme", .4, (k, t) => { const u = bell(t, .4); k.chest({ yaw: .2 * u, roll: -.05 * u }).head({ yaw: .15 * u }); });
  mv("visee", "Épaulé", "arme", 0, (k, t) => { k.chest({ pitch: .04, yaw: -.06 }).head({ pitch: .04, roll: .08 }).hip({ y: -.02 }); });
  mv("tir-course", "Tir en courant", "arme", 0, (k, t) => { k.chest({ pitch: .08, yaw: -.1 }).head({ roll: .05 }); });
  mv("tir-accroupi", "Tir accroupi", "arme", 0, (k, t) => { k.chest({ pitch: .1 }).head({ pitch: .05, roll: .1 }); });
  mv("inspecte-arme", "Inspecte son arme", "arme", 2.8, (k, t) => { const u = bell(t, 2.8); k.chest({ yaw: .3 * sin(t * 1.4) * u, pitch: .1 * u }).head({ pitch: .3 * u, yaw: .2 * sin(t * 1.4) * u }); });

  /* ---- 7. récolte, construction, interactions */
  mv("coup-lateral", "Coup de pioche latéral", "recolte", .5, (k, t) => { const u = bell(t, .5), hit = pulse(t / .5, .35); k.chest({ yaw: -.4 * hit + .15 * u, pitch: .05 * u }).hip({ yaw: -.1 * hit }).head({ yaw: .1 * hit }); });
  mv("coup-haut", "Coup de pioche vertical", "recolte", .55, (k, t) => { const u = bell(t, .55), hit = pulse(t / .55, .35); k.chest({ pitch: .35 * hit - .12 * u }).hip({ y: -.06 * hit }).head({ pitch: .15 * hit }); });
  mv("coup-bas", "Coup de pioche bas", "recolte", .55, (k, t) => { const u = bell(t, .55), hit = pulse(t / .55, .35); k.hip({ y: -.18 * u }).chest({ pitch: .3 * u, yaw: -.2 * hit }).head({ pitch: .2 * u }); });
  mv("coup-rate", "Coup dans le vide", "recolte", .6, (k, t) => { const u = bell(t, .6), sw = pulse(t / .6, .4); k.chest({ yaw: -.55 * sw, pitch: .1 * u }).hip({ yaw: -.15 * sw, roll: .05 * sw }).head({ yaw: .2 * sw }); });
  mv("pioche-prete", "Pioche prête", "recolte", 0, (k, t) => { k.chest({ pitch: .04, yaw: -.05 }).hip({ y: -.02 }); });
  mv("construit-mur", "Pose un mur", "construction", .45, (k, t) => { const u = bell(t, .45); k.R(.15, 1.38, .5 * u + .1).hand("open", null).chest({ pitch: -.04 * u }); });
  mv("construit-sol", "Pose un sol", "construction", .45, (k, t) => { const u = bell(t, .45); k.R(.18, .95 - .1 * u, .45 * u + .1).hand("open", null).chest({ pitch: .15 * u }).head({ pitch: .2 * u }); });
  mv("construit-rampe", "Pose une rampe", "construction", .45, (k, t) => { const u = bell(t, .45); k.R(.2, 1.1 + .4 * u, .45 * u + .1).hand("open", null).head({ pitch: -.1 * u }); });
  mv("construit-toit", "Pose un toit", "construction", .45, (k, t) => { const u = bell(t, .45); k.R(.15, 1.6 + .35 * u, .3 * u).hand("open", null).head({ pitch: -.3 * u }).chest({ pitch: -.1 * u }); });
  mv("edition", "Édition", "construction", 0, (k, t) => { k.R(.12, 1.35 + .05 * sin(t * 6), .45).hand("point", null).head({ pitch: .02 }); });
  mv("ouvre-coffre", "Ouvre un coffre", "interaction", 1.1, (k, t) => { const u = bell(t, 1.1), lift = sm((t - .45) / .3); k.plant().hip({ y: -.42 * u, z: -.02 * u }).FR(.15, 0, .3 * u).FL(.15, 0, -.2 * u).both(.2, .55 + .35 * lift, .55).hand("cup").chest({ pitch: .3 * u }).head({ pitch: .25 * u }); });
  mv("ramasse", "Ramasse un objet", "interaction", .8, (k, t) => { const u = bell(t, .8); k.plant().hip({ y: -.35 * u, pitch: .1 * u }).FR(.15, 0, .25 * u).FL(.15, 0, -.1).R(.2, .45 + .6 * (1 - u), .45).hand("cup", null).chest({ pitch: .4 * u }).head({ pitch: .3 * u }); });
  mv("pousse-porte", "Pousse une porte", "interaction", .6, (k, t) => { const u = bell(t, .6); k.R(.2, 1.25, .25 + .35 * u).hand("open", null).chest({ pitch: .08 * u, yaw: -.08 * u }); });
  mv("active-objet", "Actionne", "interaction", .7, (k, t) => { const u = bell(t, .7); k.R(.12, 1.15, .4 * u + .1).hand("point", null).head({ pitch: .1 * u }); });

  /* ---- 8. réactions */
  mv("touche-devant", "Touché de face", "reaction", .45, (k, t) => { const u = bell(t, .45); k.chest({ pitch: -.25 * u }).head({ pitch: .2 * u }).hip({ z: -.05 * u }).arms(.15 * u, .2 * u, .3 * u); });
  mv("touche-dos", "Touché dans le dos", "reaction", .45, (k, t) => { const u = bell(t, .45); k.chest({ pitch: .3 * u }).head({ pitch: -.25 * u }).hip({ z: .05 * u }).arms(-.2 * u, .3 * u, .2 * u); });
  mv("touche-gauche", "Touché à gauche", "reaction", .45, (k, t) => { const u = bell(t, .45); k.chest({ roll: .25 * u, yaw: -.15 * u }).head({ roll: .2 * u }).hip({ x: .04 * u }).armL(.1 * u, .4 * u, .3 * u); });
  mv("touche-droite", "Touché à droite", "reaction", .45, (k, t) => { const u = bell(t, .45); k.chest({ roll: -.25 * u, yaw: .15 * u }).head({ roll: -.2 * u }).hip({ x: -.04 * u }).armR(.1 * u, .4 * u, .3 * u); });
  mv("gros-coup", "Gros coup (vacille)", "reaction", 1, (k, t) => { const u = bell(t, 1), w2 = sin(t * 9) * (1 - t); k.chest({ pitch: -.3 * u, roll: .1 * w2 }).hip({ z: -.1 * u, y: -.06 * u, roll: .05 * w2 }).head({ pitch: .25 * u, roll: .1 * w2 }).arms(.4 * u, .6 * u, .3 * u); });
  mv("tir-tete", "Tir à la tête", "reaction", .6, (k, t) => { const u = t < .06 ? t / .06 : Math.max(0, 1 - (t - .06) / .54); k.head({ pitch: -.55 * u, roll: .1 * u }).chest({ pitch: -.15 * u }); });
  mv("bouclier-casse", "Bouclier brisé", "reaction", .8, (k, t) => { const u = bell(t, .8); k.chest({ pitch: -.15 * u }).arms(.9 * u, .5 * u, 1.1 * u).head({ pitch: .15 * u, yaw: .2 * sin(t * 12) * u }).hip({ y: -.05 * u }); });
  mv("soin-bandage", "Pose un bandage", "reaction", 0, (k, t) => { const a = t * 5; k.R(-.05 + .08 * cos(a), 1.08 + .05 * sin(a), .3).L(.02, 1.12, .28).hand("cup", "fist").head({ pitch: .35 }).chest({ pitch: .15 }); });
  mv("boit-potion", "Boit une potion", "reaction", 0, (k, t) => { const sip = .5 + .5 * sin(t * 3); k.R(.06, 1.5 + .05 * sip, .18).L(.25, 1.0, .15).hand("cup", "relax").head({ pitch: -.3 - .1 * sip }).chest({ pitch: -.08 }); });
  mv("vie-basse-boite", "Boite (vie basse)", "reaction", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .16, roll: .06 * sin(ph) }).hip({ roll: .05 * sin(ph), y: -.03 * abs(sin(ph)) }).armL(.2, .2, .6).head({ pitch: .08 }); });
  mv("vie-basse-main", "Main sur la blessure", "reaction", 0, (k, t) => { k.L(.05, 1.12, .12).hand(null, "open").chest({ pitch: .14, roll: -.05 }).head({ pitch: .12 }); });
  mv("protege-explosion", "Se protège d'une explosion", "reaction", .8, (k, t) => { const u = bell(t, .8); k.both(.12, 1.6, .25).hand("open").chest({ pitch: .25 * u }).head({ pitch: .3 * u }).hip({ y: -.12 * u }); });
  mv("tousse-tempete", "Tousse dans la tempête", "reaction", 1.4, (k, t) => { const u = bell(t, 1.4), c2 = pulse(t * 2.4, .3); k.chest({ pitch: .25 * c2 + .05 * u }).head({ pitch: .2 * c2 }).R(.05, 1.5, .18).hand("fist", null); });
  mv("sursaut", "Sursaut", "reaction", .5, (k, t) => { const u = bell(t, .5); k.hip({ y: .05 * u }).arms(.4 * u, .5 * u, .6 * u).head({ pitch: -.1 * u }).chest({ pitch: -.1 * u }); });

  /* ---- 9. environnement */
  mv("entree-eau", "Entre dans l'eau", "eau", .8, (k, t) => { const u = bell(t, .8); k.arms(1.1 * u, .7 * u, .3 * u).chest({ pitch: -.15 * u }).head({ pitch: -.15 * u }); });
  mv("sortie-eau", "Sort de l'eau (s'ébroue)", "eau", 1.1, (k, t) => { const u = bell(t, 1.1), sh = sin(t * 26) * u; k.head({ yaw: .25 * sh, roll: .1 * sh }).chest({ yaw: .08 * sh }).arms(.2 * u, .5 * u + .1 * sh, .4 * u); });
  mv("eau-peu-profonde", "Marche dans l'eau", "eau", 0, (k, t) => { k.arms(.2, .55, .55).chest({ pitch: .05 }).head({ pitch: .1 }); });
  mv("glissade-pente", "Glissade dans la pente", "terrain", 0, (k, t) => { k.hip({ y: -.15, roll: .1, yaw: -.4 }).chest({ yaw: .3 }).arms(.4, .9, .3).head({ yaw: .35 }); });
  mv("pente-raide", "Grimpe une pente raide", "terrain", 0, (k, t, c) => { const ph = c.ph; k.chest({ pitch: .3 }).hip({ pitch: .12 }).armR(.9 + .25 * sin(ph), .1, .9).armL(.9 - .25 * sin(ph), .1, .9).head({ pitch: -.2 }); });
  mv("bord-du-vide", "Au bord du vide", "terrain", 0, (k, t) => { k.head({ pitch: .5 }).chest({ pitch: .12 }).arms(.2, .45, .2).hip({ y: -.03 }); });
  mv("equilibre", "Équilibre", "terrain", 0, (k, t) => { const s = sin(t * 2.2); k.arms(.05, 1.15 + .1 * s, .15).hip({ roll: .05 * s }).chest({ roll: -.06 * s }); });
  mv("vent-fort", "Vent fort", "terrain", 0, (k, t) => { const g = .5 + .5 * sin(t * 1.3); k.R(.08, 1.72, .2).hand("open", null).chest({ pitch: .08 + .04 * g }).head({ pitch: .1, yaw: -.1 }); });
  mv("froid-nuit", "Se frotte les bras (nuit)", "terrain", 2.6, (k, t) => { const u = bell(t, 2.6), r = sin(t * 8); k.R(-.12, 1.22 + .05 * r, .18).L(-.12, 1.22 - .05 * r, .2).hand("open").chest({ pitch: .1 * u }).head({ pitch: .08 * u }); });
  mv("aveugle-lumiere", "Ébloui", "terrain", 1.2, (k, t) => { const u = bell(t, 1.2); k.R(.05, 1.72, .22).hand("open", null).head({ pitch: .15 * u, yaw: -.15 * u }).chest({ pitch: -.05 * u }); });

  /* ---- 10. nouveaux petits gestes à l'arrêt (ajoutés à la liste de v105) */
  const NEW_FID = {
    "regarde-ciel": [3, (k, t, w) => k.head({ pitch: -.5 * w, yaw: .2 * sin(t) * w }).chest({ pitch: -.1 * w })],
    "ajuste-sac": [2.6, (k, t, w) => k.R(.18, 1.48 * w + .9 * (1 - w), -.05).L(.18, 1.48 * w + .9 * (1 - w), -.05).hand("fist").chest({ pitch: -.04 * w })],
    "craque-doigts": [2.4, (k, t, w) => { const c = pulse(t * 3, .3) * w; k.R(-.02, 1.15 * w + .9 * (1 - w), .3).L(.02, 1.15 * w + .9 * (1 - w), .3).hand(c > .5 ? "fist" : "open").head({ pitch: .2 * w }); }],
    "tourne-pioche": [3, (k, t, w) => { const a = t * 6 * w; k.R(.25 + .1 * cos(a), 1.05 + .1 * sin(a), .35).hand("fist", null).head({ pitch: .15 * w }); }],
    "appui-pioche": [3.4, (k, t, w) => k.R(.18, 1.02, .35).L(.12, 1.05, .33).hand("fist").chest({ pitch: .12 * w }).hip({ x: .03 * w, roll: .04 * w })],
    "shoot-caillou": [2.2, (k, t, w) => { const kk = pulse(t / 2.2 + .3, .3) * w; k.FR(.12, .1 * kk, .3 * kk).FL(.12, 0, 0).head({ pitch: .25 * w }).hip({ pitch: -.04 * kk }); }],
    "boxe-vide": [2.6, (k, t, w) => { const r = pulse(t * 2.2, .35) * w, l = pulse(t * 2.2 + .5, .35) * w; k.R(.12, 1.4, .2 + .4 * r).L(.12, 1.4, .2 + .4 * l).hand("fist").chest({ yaw: .2 * (l - r) }); }],
    "etire-jambe": [3.2, (k, t, w) => k.hip({ y: -.25 * w, x: -.08 * w }).FR(.45 * w + .12, 0, .05).FL(.12, 0, 0).R(.3, .9, .5 * w).hand("relax").chest({ pitch: .2 * w, roll: .1 * w })],
    "secoue-jambe": [2.2, (k, t, w) => { const s = sin(t * 18) * w; k.FL(.14, .1 * w, .08 * w + .03 * s).FR(.12, 0, 0).hip({ roll: -.03 * w }); }],
    "regarde-derriere": [2.6, (k, t, w) => k.head({ yaw: 1.0 * w }).chest({ yaw: .45 * w }).hip({ yaw: .1 * w })],
    "salut-discret": [2.2, (k, t, w) => k.R(.32, 1.42 + .1 * w, .2, [.9, .9, -.2]).hand("open", null).head({ roll: -.08 * w })],
    "compte-munitions": [2.8, (k, t, w) => k.L(.05, 1.18 * w + .9 * (1 - w), .3 * w).R(.02, 1.2, .3).hand("point", "cup").head({ pitch: .35 * w })],
    "souffle-mains": [2.8, (k, t, w) => k.R(.02, 1.6 * w + .9 * (1 - w), .16).L(.02, 1.6 * w + .9 * (1 - w), .16).hand("cup").head({ pitch: .1 * w }).chest({ pitch: .08 * w })],
    "essuie-front": [2.4, (k, t, w) => { const sw = sin(t * 4) * .1 * w; k.R(.05 + sw, 1.78 * w + .9 * (1 - w), .1).hand("open", null).head({ pitch: -.1 * w }); }],
    "lacet": [3.6, (k, t, w) => { const ti = sin(t * 7) * .04 * w; k.hip({ y: -.45 * w, z: -.03 * w }).FR(.16, 0, .3 * w).FL(.16, 0, -.25 * w).R(.12 + ti, .35 + .55 * (1 - w), .4).L(.08 - ti, .35 + .55 * (1 - w), .4).hand("claw").chest({ pitch: .5 * w }).head({ pitch: .35 * w }); }],
    "tete-en-rythme": [3.2, (k, t, w) => { const b = pulse(t * 2, .4) * w; k.head({ pitch: .12 * b, roll: .06 * sin(t * 2) * w }).hip({ y: -.02 * b }).FR(.12, 0, 0).FL(.12, 0, 0); }],
  };
  if (D.FIDGET && Array.isArray(D.FIDGETS)) for (const id in NEW_FID) { if (D.FIDGET[id]) continue; D.FIDGET[id] = { dur: NEW_FID[id][0], fn: NEW_FID[id][1] }; D.FIDGETS.push(id); }

  /* ================================================================ moteur */
  const per = new WeakMap();
  function stateOf(g) {
    let s = per.get(g);
    if (!s) { s = { t: 0, one: null, cw: {}, prev: null, spdH: [], yaw: null, yawH: 0, airT: 0, wasAir: false, peakFall: 0, ph: 0, look: 0, fallVar: 0, fallT: 0, gl: false, glT: 0, stamp: 0 }; per.set(g, s); }
    return s;
  }
  const PRI = { depart: 1, allure: 0, saut: 3, reception: 4, chute: 2, planeur: 3, arme: 3, recolte: 3, construction: 3, interaction: 5, reaction: 6, eau: 4, terrain: 2 };
  function play(s, id, c) {
    const m = MV[id]; if (!m) return;
    const pr = PRI[m.cat] || 1, cur = s.one && MV[s.one.id];
    if (s.one && s.one.t < cur.dur && (PRI[cur.cat] || 1) > pr) return;
    s.one = { id, t: 0, c: c || {} };
    COUNT[id] = (COUNT[id] || 0) + 1;
  }
  const COUNT = {};
  // style propre à chaque personnage (même joueur → même démarche)
  function persona(p) { const h = hsh(String(p.id || "x").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0)); return { walk: h < .5 ? "marche-detendue" : "marche-decidee", run: hsh(h * 7) < .6 ? "course-athletique" : "course-bras-hauts" }; }

  function weaponOf(p) { const it = p.inventory && p.inventory[p.selected]; return it && it.kind === "weapon" ? it.weapon : null; }
  const RECOIL = { pistol: "recul-pistolet", revolver: "recul-pistolet", rifle: "recul-fusil", burst: "recul-fusil", dmr: "recul-fusil", smg: "recul-smg", shotgun: "recul-pompe", tactical: "recul-pompe", sniper: "recul-sniper", launcher: "recul-lanceur" };
  const RELOAD = { pistol: "recharge-pistolet", revolver: "recharge-pistolet", rifle: "recharge-fusil", burst: "recharge-fusil", dmr: "recharge-fusil", smg: "recharge-fusil", shotgun: "recharge-pompe", tactical: "recharge-pompe", sniper: "recharge-sniper", launcher: "recharge-sniper" };
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 0; } }
  function water(x, z) { try { return root.AZSim.isWater(x, z); } catch (e) { return false; } }

  // provenance des coups (pour savoir de quel côté on est touché)
  (function () {
    const Wp = root.AZSim && root.AZSim.World && root.AZSim.World.prototype; if (!Wp || !Wp._damage || Wp._damage.__v107) return;
    const d0 = Wp._damage;
    Wp._damage = function (v, src, amount) { try { if (v && src && typeof src.x === "number") { v._hitFromX = src.x; v._hitFromZ = src.z; v._hitAmt = amount; } } catch (e) {} return d0.apply(this, arguments); };
    Wp._damage.__v107 = true;
  })();

  function drive(view, group, p, dt, options) {
    const u = group.userData, inst = u && u.ch1; if (!inst || !inst.anim) return;
    if (p.emote > 0 || p.downed || p.vehicleId || !p.alive) return;
    const E = root.AZEvent; if (E && E.active && E.playerInfo && E.playerInfo.mode && E.playerInfo.mode !== "none" && options.local) return; // « La Fin » pilote déjà le corps
    if (E && E.v96 && E.v96.phase && E.v96.phase !== "dim" && options.local) return; // v110 : dans une autre dimension on marche normalement
    const s = stateOf(group); s.t += dt;
    const g = root.AZUR, an = inst.anim;
    // ---------------------------------------------------------------- mesures
    const air = !!(p.jumping || p.falling || p.gliding || p.flying), wpn = weaponOf(p), armed = !!(u.gun && u.gun.visible), tool = !!(u.tool && u.tool.visible);
    const pv = s.prev || { x: p.x, y: p.y, z: p.z, hp: p.hp, sh: p.shield, sel: p.selected, rel: p.reload || 0, shot: p._lastShotAt, gat: p.gathered || 0, built: p.built || 0, chests: p.chests || 0, inv: 0, use: p.useTime || 0, swim: !!p.swimming, mats: Object.assign({}, p.mats || {}) };
    const vx = dt > 0 ? (p.x - pv.x) / dt : 0, vz = dt > 0 ? (p.z - pv.z) / dt : 0, vy = dt > 0 ? (p.y - pv.y) / dt : 0;
    const spd = Math.min(20, Math.hypot(vx, vz)), sy = sin(+p.yaw || 0), cy = cos(+p.yaw || 0);
    const fw = -(vx * sy + vz * cy), sd = vx * cy - vz * sy;
    let dyaw = (+p.yaw || 0) - (s.yaw == null ? (+p.yaw || 0) : s.yaw); dyaw = Math.atan2(sin(dyaw), cos(dyaw)); s.yaw = +p.yaw || 0;
    const yr = dt > 0 ? dyaw / dt : 0;
    s.spdH.push(spd); if (s.spdH.length > 18) s.spdH.shift();
    const spdOld = s.spdH[0] || 0;
    s.ph += dt * (1.6 + spd * 1.25); // phase de foulée (approchée)
    const c = { spd, fw, sd, yr, ph: s.ph, up: 0, down: 0 };
    // pente dans le sens du déplacement
    if (!air && spd > 1.5) { const ux = vx / spd, uz = vz / spd, gr = (H(p.x + ux * 1.5, p.z + uz * 1.5) - H(p.x - ux * 1.5, p.z - uz * 1.5)) / 3; c.up = cl(gr * 2.5); c.down = cl(-gr * 2.5); c.grade = gr; }
    // ---------------------------------------------------------------- déclencheurs (gestes ponctuels)
    const local = !!options.local, isNight = g && g.timeOfDay === "night";
    // départs / freinages / demi-tours
    if (!air && spdOld < .6 && spd > 2) play(s, spd > 7 ? "depart-sprint" : spd > 4 ? "depart-course" : "depart-marche", c);
    if (!air && spdOld > 6.5 && spd < 1.2) play(s, "freinage-sprint", { side: yr >= 0 ? 1 : -1 });
    else if (!air && spdOld > 3.5 && spd < 1) play(s, "freinage-course", c);
    else if (!air && spdOld > 1.2 && spdOld <= 3.5 && spd < .3) play(s, "arret-net", c);
    if (!air && spd > 2.5 && abs(yr) > 7) play(s, "demi-tour", { side: yr > 0 ? 1 : -1 });
    if (!air && spd < .3) { s.yawH += dyaw; if (abs(s.yawH) > .7) { play(s, s.yawH > 0 ? "pivot-gauche" : "pivot-droite", c); s.yawH = 0; } } else s.yawH = 0;
    // sauts
    if (p.jumping && !s.wasAir) {
      const r = hsh(s.t * 3.1 + (p.x || 0));
      let id = "saut-simple";
      if (armed) id = "saut-arme";
      else if (p.y - H(p.x, p.z) > 6) id = "saut-haut";
      else if (fw < -1.5) id = "saut-arriere";
      else if (abs(sd) > 2.5 && abs(sd) > abs(fw)) id = "saut-cote";
      else if (spd > 5.5) id = r < .12 ? "saut-vrille" : r < .24 ? "saut-groupe" : r < .34 ? "double-appel" : "saut-course";
      else if (spd < .5) id = r < .15 ? "saut-etoile" : "saut-arret";
      play(s, id, { side: sd > 0 ? 1 : -1 });
    }
    if (p.jumping && s.wasAir && abs(vy) < 1.2 && s.airT > .2 && s.airT < 1.2 && !(s.one && s.one.id === "apex")) { if (!s.apexDone) { play(s, "apex", c); s.apexDone = true; } }
    // réceptions
    if (!air && s.wasAir) {
      const fall = s.peakFall, aT = s.airT;
      if (s.gl) play(s, "planeur-range", c);
      else if (aT > 1.6 && spd > 4) play(s, "roulade", c);
      else if (aT > 1.6 || fall > 14) play(s, "reception-lourde", c);
      else if (aT > .65) play(s, hsh(s.t * 7.7) < .1 ? "trebuche" : spd > 3 ? "reception-course" : "reception-amortie", c);
      else if (aT > .2) play(s, spd > 3 ? "reception-course" : "reception-douce", c);
      s.peakFall = 0; s.apexDone = false;
    }
    if (air) s.peakFall = Math.max(s.peakFall, -vy);
    // planeur
    if (p.gliding && !s.gl) { play(s, "planeur-ouvre", c); s.glT = 0; }
    if (p.gliding) { s.glT += dt; if (s.glT > 6 && hsh(Math.floor(s.t)) > .97 && !s.one) play(s, "planeur-regarde", c); }
    // armes
    if (p._lastShotAt != null && pv.shot != null && p._lastShotAt !== pv.shot && wpn) play(s, RECOIL[wpn] || "recul-fusil", c);
    if ((p.reload || 0) > 0 && !(pv.rel > 0) && wpn) play(s, RELOAD[wpn] || "recharge-fusil", c);
    if (p.selected !== pv.sel) play(s, wpn ? "degainer" : "ranger-arme", c);
    // récolte (la matière récoltée dit ce qu'on frappe : arbre, pierre, métal)
    if ((p.gathered || 0) > pv.gat) { const m = p.mats || {}, pm = pv.mats || {}; play(s, (m.stone || 0) > (pm.stone || 0) ? "coup-haut" : (m.metal || 0) > (pm.metal || 0) ? "coup-bas" : "coup-lateral", c); }
    else if (tool && local && p._input && p._input.fire && !(s.one && MV[s.one.id].cat === "recolte") && hsh(Math.floor(s.t * 2)) > .8) play(s, "coup-rate", c);
    // construction
    if ((p.built || 0) > pv.built) { const w = g && g.world, b = w && w.builds && w.builds[w.builds.length - 1], ty = b && b.type; play(s, ty === "floor" ? "construit-sol" : ty === "ramp" || ty === "stair" || ty === "stairs" ? "construit-rampe" : ty === "roof" || ty === "cone" ? "construit-toit" : "construit-mur", c); }
    // coffres, ramassage
    if ((p.chests || 0) > pv.chests) play(s, "ouvre-coffre", c);
    const invN = (p.inventory || []).reduce((a, it) => a + (it ? (it.count || 1) : 0), 0);
    if (s.prev && invN > s.prev.inv && !((p.chests || 0) > pv.chests) && !air) play(s, "ramasse", c);
    // dégâts
    const hp = +p.hp || 0, sh = +p.shield || 0, lost = (pv.hp + pv.sh) - (hp + sh);
    if (lost > 1) {
      if (pv.sh > 0 && sh <= 0) play(s, "bouclier-casse", c);
      else if (lost >= 50) play(s, (p._hitAmt || 0) >= 70 ? "tir-tete" : "gros-coup", c);
      else {
        let id = "touche-devant";
        if (p._hitFromX != null) { const dx = p._hitFromX - p.x, dz = p._hitFromZ - p.z, fx = -sy, fz = -cy, f2 = dx * fx + dz * fz, r2 = dx * cy - dz * sy; id = abs(f2) >= abs(r2) ? (f2 >= 0 ? "touche-devant" : "touche-dos") : (r2 >= 0 ? "touche-droite" : "touche-gauche"); }
        play(s, id, c);
      }
    }
    // explosions, tempête, eau, nuit, lumière
    if (local && view && view._shake > .55 && !(s.one && s.one.id === "protege-explosion") && s.t - (s.boomT || -9) > 2) { play(s, "protege-explosion", c); s.boomT = s.t; }
    if (local && g && g.world && g.world.storm && g.world.storm.radius > 0) { const st = g.world.storm, out = Math.hypot(p.x - st.x, p.z - st.z) > st.radius; if (out && s.t - (s.coughT || -9) > 5 && !air) { play(s, "tousse-tempete", c); s.coughT = s.t; } }
    if (p.swimming && !pv.swim) play(s, "entree-eau", c);
    if (!p.swimming && pv.swim) play(s, "sortie-eau", c);
    if (local && isNight && !air && spd < .3 && !armed && s.t - (s.coldT || 0) > 40 && hsh(Math.floor(s.t)) > .98) { play(s, "froid-nuit", c); s.coldT = s.t; }
    if (armed && !air && spd < .3 && !p.reload && s.t - (s.inspT || 0) > 25 && hsh(Math.floor(s.t * 1.3)) > .985) { play(s, "inspecte-arme", c); s.inspT = s.t; }
    if (E && E.active && E.shake > .8 && !air && s.t - (s.jumpT || -9) > 3) { play(s, "sursaut", c); s.jumpT = s.t; }
    if (E && E.active && E.screenFlash > .6 && s.t - (s.blindT || -9) > 4) { play(s, "aveugle-lumiere", c); s.blindT = s.t; }
    // mémoire
    s.prev = { x: p.x, y: p.y, z: p.z, hp, sh, sel: p.selected, rel: p.reload || 0, shot: p._lastShotAt, gat: p.gathered || 0, built: p.built || 0, chests: p.chests || 0, inv: invN, use: p.useTime || 0, swim: !!p.swimming, mats: Object.assign({}, p.mats || {}) };
    s.airT = air ? s.airT + dt : 0; s.wasAir = air; s.gl = !!p.gliding;

    // ---------------------------------------------------------------- couches continues (poids lissés)
    const per2 = persona(p), want = {};
    const moving = !air && spd > .6, crouch = !!p.crouching, aim = !!options.aim;
    const heal = (p.useTime || 0) > 0 ? ((p.inventory && p.inventory[p.selected] && p.inventory[p.selected].kind) || "heal") : null;
    if (moving && !p.swimming) {
      if (crouch) want["accroupi-avance"] = 1;
      else if (fw < -1 && abs(fw) > abs(sd)) want["marche-arriere"] = 1;
      else if (abs(sd) > 1.2 && abs(sd) > abs(fw) * .8) want[sd > 0 ? "pas-chasse-droite" : "pas-chasse-gauche"] = 1;
      else if (spd > 6.5) want["sprint-penche"] = 1;
      else if (spd > 3.2) want[per2.run] = 1;
      else want[hp < 35 ? "vie-basse-boite" : (isNight && local && hsh(Math.floor(s.t / 20)) > .7 ? "marche-prudente" : per2.walk)] = 1;
      if (c.grade > .25) want["pente-raide"] = cl((c.grade - .25) * 4);
      else if (c.up > .05) want["course-montee"] = 1;
      if (c.down > .05) want["course-descente"] = 1;
      if (c.grade < -.45 && spd > 5) want["glissade-pente"] = cl((-c.grade - .45) * 3);
      if (hp < 35 && spd <= 3.2) want["vie-basse-boite"] = 1;
    }
    if (!air && !moving && hp < 35 && !armed && !tool) want["vie-basse-main"] = 1;
    if (armed && aim && !air) want[crouch ? "tir-accroupi" : "visee"] = 1;
    if (armed && moving && local && p._input && p._input.fire) want["tir-course"] = 1;
    if (tool && !moving && !air) want["pioche-prete"] = 1;
    if (local && g && g.editing) want["edition"] = 1;
    if (heal) want[heal === "shield" ? "boit-potion" : "soin-bandage"] = 1;
    if (!air && !p.swimming && water(p.x, p.z) && p.y - H(p.x, p.z) < .6) want["eau-peu-profonde"] = 1;
    if (!air && !moving) { const drop = p.y - Math.min(H(p.x + 1.2 * -sy, p.z + 1.2 * -cy), H(p.x, p.z)); if (p.y - H(p.x, p.z) > 4.5) want["equilibre"] = .6; else if (drop > 5) want["bord-du-vide"] = 1; }
    if (!air && p.y > 70 && local) want["vent-fort"] = .7;
    if (p.falling && !p.gliding && s.airT > .9) {
      s.fallT += dt; if (s.fallT > 3.5) { s.fallT = 0; s.fallVar = (s.fallVar + 1) % 4; }
      const fv = (+p.pitch || 0) < -.7 ? "chute-plongeon" : ["chute-ecartee", "chute-pedale", "chute-regard", "chute-ecartee"][s.fallVar];
      want[p.airborneFromBus ? ((+p.pitch || 0) < -.7 ? "chute-plongeon" : "chute-ecartee") : fv] = 1;
    } else s.fallT = 0;
    if (p.gliding) {
      want["planeur-jambes"] = 1;
      if (yr > .6) want["planeur-gauche"] = cl(yr / 2); else if (yr < -.6) want["planeur-droite"] = cl(-yr / 2);
      if ((+p.pitch || 0) < -.45) want["planeur-pique"] = cl((-(+p.pitch) - .45) * 3); else if ((+p.pitch || 0) > .3) want["planeur-frein"] = cl((+p.pitch - .3) * 3);
    }
    for (const id in s.cw) if (!(id in want)) want[id] = 0;
    const kk = Math.min(1, dt * 7);
    for (const id in want) { const v = (s.cw[id] || 0) + (want[id] - (s.cw[id] || 0)) * kk; if (v < .004 && want[id] === 0) delete s.cw[id]; else s.cw[id] = v; }

    // ---------------------------------------------------------------- composition
    const A = newAcc(), k = writer(A);
    for (const id in s.cw) { const m = MV[id]; if (!m) continue; k.w = s.cw[id]; m.fn(k, s.t, c); }
    if (s.one) {
      const m = MV[s.one.id]; s.one.t += dt;
      if (s.one.t >= m.dur) s.one = null;
      else { const te = s.one.t, env = sm(te / Math.min(.12, m.dur * .3)) * (1 - sm((te - (m.dur - Math.min(.2, m.dur * .35))) / Math.min(.2, m.dur * .35))); k.w = env; m.fn(k, te, s.one.c); }
    }
    apply(group, inst, A, moving || air, armed || tool);
    s.stamp = s.t;
  }

  // corps additif (hanches, buste, tête, épaules, jambes) puis membres placés (IK de v105)
  function apply(group, inst, A, moving, handsBusy) {
    const B = inst.bones, h = A.hip;
    const P = D.newPose();
    P.hip = { x: h.x, y: h.y, z: h.z, pitch: h.pitch, roll: h.roll, yaw: h.yaw, turn: h.turn };
    P.chest = A.chest; P.head = A.head;
    P.legs = A.plant && !moving;
    D.applyPose(group, inst, P, 1);
    // épaules et coudes : rotations additives dans le repère du corps (x droite, y haut, z devant)
    const ar = A.arm;
    for (const [side, sg] of [["R", 1], ["L", -1]]) {
      const a = ar[side]; if (!a[0] && !a[1] && !a[2]) continue;
      if (handsBusy) { a[0] *= .25; a[1] *= .25; a[2] *= .25; } // l'arme ou la pioche reste en main
      const up = B["upperarm_" + side.toLowerCase()], lo = B["lowerarm_" + side.toLowerCase()];
      turn(up, group, 1, 0, 0, a[0]); turn(up, group, 0, 0, 1, a[1] * sg); turn(lo, group, 1, 0, 0, a[2]); // os qui pendent : angle + = vers l'avant / vers l'extérieur
    }
    for (const [side] of [["R"], ["L"]]) {
      const l = A.leg[side]; if (!l[0] && !l[1]) continue;
      const th = B["thigh_" + side.toLowerCase()], ca = B["calf_" + side.toLowerCase()];
      turn(th, group, 1, 0, 0, l[0]); turn(ca, group, 1, 0, 0, -l[1]); // cuisse vers l'avant, genou qui plie vers l'arrière
    }
    if (A.lim && A.limW > .01) {
      const L2 = A.lim;
      if (handsBusy) { L2.R = null; L2.fR = null; L2.L = null; L2.fL = null; }
      if (L2.legs && moving) { L2.legs = false; L2.FR = L2.FL = null; }
      D.applyPose(group, inst, L2, A.limW);
    }
  }

  /* ------------------------------------------------ branchement dans la vue (après v105) */
  const prev = V.prototype.animateAvatar;
  V.prototype.animateAvatar = function (model, player, dt, options) {
    const r = prev.apply(this, arguments);
    try {
      const o = options || {};
      if (model && model.userData && player && !o.menu) {
        let near = !!o.local;
        if (!near && this.camera && this.camera.position) { const cp = this.camera.position, dx = player.x - cp.x, dz = player.z - cp.z; near = dx * dx + dz * dz < 35 * 35; }
        if (near) drive(this, model, player, Math.min(.1, Math.max(0, +dt || 0)), o);
      }
    } catch (err) { if (!V.prototype.__moves107Warn) { V.prototype.__moves107Warn = true; if (root.console) console.warn("[AZUR moves107]", err); } }
    return r;
  };

  const LIST = Object.keys(MV), NEWF = Object.keys(NEW_FID);
  root.AZMoves107 = { MV, LIST, NEW_FIDGETS: NEWF, COUNT, newAcc, writer, apply, play, count: () => ({ moves: LIST.length, fidgets: NEWF.length, total: LIST.length + NEWF.length }) };
})(typeof globalThis !== "undefined" ? globalThis : this);
