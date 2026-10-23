/* AZUR v105 — event-float-v105.js : la FLOTTAISON en apesanteur de « La Fin », comme dans la vidéo (183 → 254 s).
 * Pose écrite à la main par-dessus l'animation du personnage (repère du groupe : x droite, y haut, −z avant) :
 *  - bras écartés vers le bas (~40° sous l'horizontale), coudes un peu fléchis et ouverts, mains qui flottent ;
 *  - jambes pendantes, un peu écartées, genoux légèrement pliés, qui battent très lentement ;
 *  - tout le corps roule doucement d'un côté à l'autre et respire (apesanteur) ;
 *  - au choc de l'onde du Point Zéro (183,5 s) : bras projetés vers le haut, puis ils retombent dans la pose ;
 *  - au souffle de l'explosion (224,3 s) : bras et jambes rejetés en arrière, puis la dérive bras écartés.
 * Cinématique inverse à deux os pour bras et jambes (cibles des mains et des pieds), pondérée pour des transitions
 * douces. Joueur local seulement, pendant l'événement. À charger après ch1-models-v93.js. */
(function (root) {
  "use strict";
  const T = root.THREE, V = root.AZView && root.AZView.View;
  if (!T || !V || !V.prototype || V.prototype.__float105) return;
  V.prototype.__float105 = true;
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _d = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4(), _m2 = new T.Matrix4(), _m3 = new T.Matrix4(), _e = new T.Euler();
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v), ramp = (t, a, b) => cl((t - a) / (b - a)), sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const st = { w: 0, shock: 0, blast: 0, t: 0 };

  // tourne un os pour que la direction os → enfant vise un point du monde, avec un poids
  function aimAt(bone, child, target, w) {
    bone.getWorldPosition(_a); child.getWorldPosition(_b);
    const cur = _c.copy(_b).sub(_a).normalize(), want = _d.copy(target).sub(_a).normalize();
    _q.setFromUnitVectors(cur, want);
    bone.getWorldQuaternion(_q2); _q.multiply(_q2);
    bone.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q);
    bone.quaternion.slerp(_q2, w); bone.updateMatrixWorld(true);
  }
  // cinématique inverse à deux os (épaule-coude-main, hanche-genou-pied), coude/genou tiré vers « pole »
  function ik(up, lo, end, target, pole, w) {
    if (!up || !lo || !end || w <= 0) return;
    const A = up.getWorldPosition(new T.Vector3()), B = lo.getWorldPosition(new T.Vector3()), C = end.getWorldPosition(new T.Vector3());
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C), goal = C.clone().lerp(target, w), dir = goal.clone().sub(A);
    let d = dir.length(); if (d < 1e-4) return; dir.divideScalar(d); d = Math.min(d, (l1 + l2) * .999);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const bend = pole.clone().sub(A); bend.sub(dir.clone().multiplyScalar(bend.dot(dir))); if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0); bend.normalize();
    const mid = A.clone().addScaledVector(dir, x).addScaledVector(bend, h);
    aimAt(up, lo, mid, 1); aimAt(lo, end, A.clone().addScaledVector(dir, d), 1);
  }

  function apply(group, p, dt) {
    const E = root.AZEvent, u = group.userData, inst = u && u.ch1; if (!inst || !E || !E.active) { st.w = 0; return; }
    const mode = (E.playerInfo && E.playerInfo.mode) || "none", t = E.filmVideoTime ? E.filmVideoTime() : E.tTotal;
    const on = ((mode === "zeroshock" || mode === "float" || mode === "drift" || mode === "blast") && !(E.v96 && E.v96.phase)) || !!(E.v96 && E.v96.phase === "riftfree" && p.falling); // v108 : on flotte aussi dans le monde des failles
    st.w += ((on ? 1 : 0) - st.w) * Math.min(1, dt * 3.2); if (st.w < .01) return;
    const B = inst.bones, w = st.w;
    // choc de l'onde (183,5 → 185,2 s) et souffle de l'explosion (224,3 → 227 s)
    const shock = mode === "zeroshock" ? (1 - sm(ramp(t, 184.2, 185.6))) * sm(ramp(t, 183.45, 183.75)) : 0;
    const blast = mode === "blast" || mode === "drift" ? (1 - sm(ramp(t, 225.2, 227.4))) * sm(ramp(t, 224.25, 224.55)) : 0;
    // tout le corps : roulis lent, tangage, respiration (pivot au bassin)
    const roll = (.16 * Math.sin(t * .37) + .05 * Math.sin(t * .91 + 1)) * w * (1 - shock), pitch = (.05 * Math.sin(t * .29 + 2) - .1 * blast + .06 * shock) * w;
    _m.makeTranslation(0, .95, 0).multiply(_m2.makeRotationFromEuler(_e.set(pitch, .04 * Math.sin(t * .23) * w, roll))).multiply(_m3.makeTranslation(0, -.95, 0));
    inst.model.matrix.multiply(_m); inst.model.matrixWorldNeedsUpdate = true; group.updateMatrixWorld(true);
    const L = (x, y, z) => group.localToWorld(new T.Vector3(x, y, z));
    // bras : écartés vers le bas, mains qui flottent ; au choc → vers le haut ; au souffle → rejetés en arrière
    const br = Math.sin(t * 1.3) * .035, br2 = Math.sin(t * 1.05 + 1.4) * .035;
    for (const s of [1, -1]) {
      const ph = s > 0 ? br : br2;
      const fx = .6 + ph, fy = 1.0 + ph * 1.4, fz = -.08;                  // pose flottante
      const sx = .42, sy = 2.15, sz = -.12;                                 // bras levés (choc)
      const bx = .55, by = 1.7, bz = .38;                                   // rejetés en arrière (souffle)
      const k1 = shock, k2 = blast * (1 - shock);
      const hx = fx + (sx - fx) * k1 + (bx - fx) * k2, hy = fy + (sy - fy) * k1 + (by - fy) * k2, hz = fz + (sz - fz) * k1 + (bz - fz) * k2;
      const arm = s > 0 ? [B.upperarm_r, B.lowerarm_r, B.hand_r] : [B.upperarm_l, B.lowerarm_l, B.hand_l];
      ik(arm[0], arm[1], arm[2], L(s * hx, hy, hz), L(s * 1.1, 1.25, .5), w);
      // poignet : la main prolonge l'avant-bras en s'ouvrant un peu vers le bas
      const mid = s > 0 ? B.middle_01_r : B.middle_01_l;
      if (mid) { arm[1].getWorldPosition(_a); arm[2].getWorldPosition(_b); aimAt(arm[2], mid, _c.copy(_b).sub(_a).normalize().multiplyScalar(.2).add(_b).add(_d.set(0, -.06, 0)), .7 * w); }
      // jambes : pendantes, un peu écartées, genoux pliés, battement lent
      const leg = s > 0 ? [B.thigh_r, B.calf_r, B.foot_r] : [B.thigh_l, B.calf_l, B.foot_l];
      const kick = Math.sin(t * .8 + (s > 0 ? 0 : Math.PI)) * .07, lb = blast * .45;
      ik(leg[0], leg[1], leg[2], L(s * (.17 + .03 * Math.sin(t * .6)), .14 + .05 * Math.abs(kick) + lb * .35, .06 + kick + lb * .5), L(s * .15, .55, -1.2), w);
    }
    // buste un peu cambré, tête qui suit la caméra (gérée ailleurs)
    if (B.spine_02) { B.spine_02.rotateX((-.06 - .12 * blast + .08 * shock) * w); B.spine_02.updateMatrixWorld(true); }
  }

  const prev = V.prototype.animateAvatar;
  V.prototype.animateAvatar = function (model, player, dt, options) {
    const r = prev.apply(this, arguments);
    try { if (options && options.local && model && player) apply(model, player, Math.min(.1, Math.max(0, +dt || 0))); } catch (e) { if (!st.err) { st.err = 1; if (root.console) console.warn("[AZUR float105]", e); } }
    return r;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
