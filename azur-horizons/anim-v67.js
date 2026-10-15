/* AZUR v67 — animation du personnage.
 * La pose est recalculée entièrement à chaque image à partir d'états fondus :
 *   repos · marche/course/sprint (avant, arrière, de côté) · accroupi · saut ·
 *   chute libre · planeur · réception, + élan à l'accélération, freinage,
 *   inclinaison dans les virages et petites attentes vivantes.
 * Pioche : portée sur l'épaule, coup en trois temps (armé, frappe, impact)
 *   tenu à deux mains par IK, avec traînée de vitesse pour le joueur local.
 * Émotes : six vraies danses chorégraphiées (salut, disco, victoire, robot,
 *   sauts étoile, breakdance), synchronisées sur leur musique (emotes-v67.js).
 * Conventions du squelette (vérifiées par captures) : hanches/épaules +x =
 * vers l'avant, genoux −x = flexion, COUDES +x = flexion, buste +x = penché
 * en arrière, buste/tête +y = vers la gauche, épaule gauche −z / droite +z =
 * bras écarté, hanche gauche −z / droite +z = jambe écartée. */
(function (root) {
  'use strict';
  const T = root.THREE, V = root.AZView?.View?.prototype;
  if (!T || !V?.animateAvatar) return;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fin = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
  const ease = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const bump = (x, a, b) => x <= a || x >= b ? 0 : Math.sin(Math.PI * (x - a) / (b - a));

  function state(u) {
    return u.v67 || (u.v67 = { phase: 0, run: 0, sprint: 0, crouch: 0, jump: 0, fall: 0, glide: 0, land: 0, landPow: 0,
      air: false, airTop: 0, lastX: null, lastZ: null, lastYaw: null, turn: 0, speed: 0, accel: 0, back: 0, side: 0,
      look: 0, lookT: 0, lookGoal: 0, fidget: 0, fidgetT: 6, fidgetKind: 0, swing: -1, lastHarvest: 0, tool: 0 });
  }

  /* ---------------- Locomotion ---------------- */
  function locomotion(view, m, p, dt, options, st, P) {
    const u = m.userData, t = fin(view.time), menu = !!options.menu;
    const x = fin(p.x), z = fin(p.z), yaw = fin(p.yaw);
    const dx = st.lastX === null || menu ? 0 : x - st.lastX, dz = st.lastZ === null || menu ? 0 : z - st.lastZ;
    st.lastX = x; st.lastZ = z;
    const rawSpeed = dt > 0 ? Math.min(14, Math.hypot(dx, dz) / dt) : 0;
    const prevSpeed = st.speed;
    st.speed += (rawSpeed - st.speed) * damp(10, dt);
    st.accel += ((dt > 0 ? clamp((st.speed - prevSpeed) / dt / 18, -1, 1) : 0) - st.accel) * damp(6, dt);
    // Direction du déplacement dans le repère du personnage (avant = −Z).
    if (rawSpeed > .4) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), inv = 1 / Math.hypot(dx, dz);
      const fwd = (dx * fx + dz * fz) * inv, right = (dx * rx + dz * rz) * inv;
      st.back += ((fwd < -.35 ? 1 : 0) - st.back) * damp(8, dt);
      st.side += ((Math.abs(fwd) < .5 ? Math.sign(right) : 0) - st.side) * damp(8, dt);
    } else { st.back += (0 - st.back) * damp(4, dt); st.side += (0 - st.side) * damp(4, dt); }
    const turnRate = st.lastYaw === null || dt <= 0 ? 0 : wrap(yaw - st.lastYaw) / dt; st.lastYaw = yaw;
    st.turn += (clamp(turnRate, -4, 4) - st.turn) * damp(6, dt);
    const highAir = !!(p.gliding || p.flying || (p.falling && p.airborneFromBus));
    const airborne = !!(p.jumping || p.falling || p.gliding || p.flying);
    const shortAir = airborne && !highAir;
    const w = clamp(st.speed / 6.2, 0, 1), sprintGoal = clamp((st.speed - 6.4) / 2.4, 0, 1);
    const k = damp(11, dt);
    st.run += ((airborne ? 0 : w) - st.run) * k;
    st.sprint += ((airborne ? 0 : sprintGoal) - st.sprint) * k;
    st.crouch += ((p.crouching && !airborne ? 1 : 0) - st.crouch) * damp(13, dt);
    st.jump += ((shortAir ? 1 : 0) - st.jump) * damp(shortAir ? 16 : 10, dt);
    st.fall += ((highAir && !p.gliding ? 1 : 0) - st.fall) * damp(7, dt);
    st.glide += ((p.gliding ? 1 : 0) - st.glide) * damp(7, dt);
    if (airborne) st.airTop = st.air ? Math.max(st.airTop, fin(p.y)) : fin(p.y);
    if (st.air && !airborne) { const drop = st.airTop - fin(p.y); if (drop > .6) { st.land = 1; st.landPow = clamp(drop / 6, .35, 1); } }
    st.air = airborne; st.land = Math.max(0, st.land - dt * 3.4);

    // La foulée tourne à l'envers en marche arrière.
    const cadence = 1.45 + st.speed * .19, dir = st.back > .5 ? -1 : 1;
    st.phase += dt * Math.PI * 2 * cadence * (st.run > .02 ? dir : 0);
    const ph = st.phase, c = Math.sin(ph), cc = Math.cos(ph), run = st.run, sp = st.sprint, back = st.back, side = st.side;

    // Petites attentes : épaules qui roulent, regard derrière, étirement.
    const still = (1 - run) * (airborne ? 0 : 1) * (st.crouch < .3 ? 1 : 0);
    st.fidgetT -= dt * still; if (st.fidgetT <= 0) { st.fidget = 1; st.fidgetKind = (st.fidgetKind + 1) % 3; st.fidgetT = 7 + (Math.sin(t * 9.1) * .5 + .5) * 6; }
    st.fidget = Math.max(0, st.fidget - dt * .55);
    if (still < .5) st.fidget = Math.max(0, st.fidget - dt * 4);
    const fg = bump(1 - st.fidget, 0, 1);

    const breath = Math.sin(t * 1.7), shift = Math.sin(t * .47), idle = 1 - run;
    st.lookT -= dt; if (st.lookT <= 0) { st.lookT = 2.5 + (Math.sin(t * 13.7) * .5 + .5) * 4; st.lookGoal = Math.sin(t * 7.3) * .55; }
    st.look += (st.lookGoal - st.look) * damp(2.2, dt);
    // Repos : appui sur une jambe qui bascule doucement, bras détendus, coudes légèrement pliés.
    P.hipL = .04 + shift * .03; P.hipR = -.02 - shift * .03; P.kneeL = -.06 - Math.max(0, shift) * .12; P.kneeR = -.06 - Math.max(0, -shift) * .12;
    P.hipLz = -.04; P.hipRz = .04;
    P.shL = .05 + Math.sin(t * .9) * .03; P.shR = .05 - Math.sin(t * .9 + .6) * .03; P.shLz = -.12 - breath * .015; P.shRz = .12 + breath * .015;
    P.elL = .22 + breath * .02; P.elR = .26 - breath * .02; P.elLz = 0; P.elRz = 0;
    P.tx = -.015 + breath * .012; P.ty = shift * .04; P.tz = shift * .03; P.ty0 = breath * .008;
    P.hx = .02 + Math.sin(t * .31) * .03; P.hy = st.look * idle; P.hz = 0; P.mx = 0; P.mz = 0;
    if (fg > .001) {
      if (st.fidgetKind === 0) { P.shL += fg * .25; P.shR += fg * .25; P.shLz -= fg * .25; P.shRz += fg * .25; P.tx += fg * .08; P.hx += fg * .25; } // étirement
      else if (st.fidgetKind === 1) { P.hy += fg * 1.0; P.ty += fg * .35; P.hipR += fg * .05; } // regard en arrière
      else { P.shL -= fg * .35; P.shR -= fg * .35; P.elL += fg * .6; P.elR += fg * .6; P.ty0 += fg * .02; P.hx -= fg * .12; } // haussement d'épaules
    }

    if (run > .001) {
      // Foulée mesurée : la cuisse part moins loin en arrière qu'en avant (pas de grand écart).
      const stride = (.26 + .36 * run + .12 * sp) * (1 - back * .3), armSwing = .3 + .5 * run + .22 * sp;
      const rL = c * stride * (c > 0 ? 1 : .62), rR = -c * stride * (c < 0 ? 1 : .62);
      const kL = -(.1 * run + Math.max(0, cc * dir) * (.9 * run + .32 * sp)) - Math.max(0, -c) * .14 * run;
      const kR = -(.1 * run + Math.max(0, -cc * dir) * (.9 * run + .32 * sp)) - Math.max(0, c) * .14 * run;
      const aL = -c * armSwing, aR = c * armSwing, bend = .55 + .7 * run + .45 * sp;
      const bob = .05 * run * (1 - Math.abs(c)) - .035 * run;
      P.hipL = lerp(P.hipL, rL, run); P.hipR = lerp(P.hipR, rR, run); P.kneeL = lerp(P.kneeL, kL, run); P.kneeR = lerp(P.kneeR, kR, run);
      // Pas chassés quand on se déplace de côté.
      P.hipLz = lerp(P.hipLz, -.04 - side * .12 * Math.max(0, c), run); P.hipRz = lerp(P.hipRz, .04 - side * .12 * Math.max(0, -c), run);
      P.shL = lerp(P.shL, aL, run); P.shR = lerp(P.shR, aR, run); P.shLz = lerp(P.shLz, -.15, run); P.shRz = lerp(P.shRz, .15, run);
      P.elL = lerp(P.elL, bend + Math.max(0, aL) * .4, run); P.elR = lerp(P.elR, bend + Math.max(0, aR) * .4, run);
      const lean = -(.05 + .1 * run + .11 * sp) * (1 - back) + back * .08 - clamp(st.accel, 0, 1) * .12 + clamp(-st.accel, 0, 1) * .1;
      P.tx = lerp(P.tx, lean, run); P.ty = lerp(P.ty, c * (.16 + .12 * sp) * (1 - Math.abs(side) * .6) - side * .25, run); P.tz = lerp(P.tz, cc * .035, run);
      P.ty0 = lerp(P.ty0, bob, run);
      P.hx = lerp(P.hx, .08 * run + .14 * sp - back * .05, run); P.hy = lerp(P.hy, -c * .08 + side * .28 + st.turn * .12, run);
      P.mz = -st.turn * .05 * run - side * .05 * run;
    }
    // Freinage : le buste part en arrière quand on s'arrête net.
    if (!airborne) P.tx += clamp(-st.accel, 0, 1) * .2 * (1 - run * .5);

    const cr = st.crouch;
    if (cr > .001) {
      P.hipL += .95 * cr; P.hipR += .7 * cr; P.kneeL -= 1.4 * cr; P.kneeR -= 1.3 * cr;
      P.tx -= .3 * cr; P.hx += .26 * cr; P.ty0 -= .26 * cr; P.shL += .3 * cr; P.shR += .3 * cr; P.elL += .45 * cr; P.elR += .45 * cr;
    }
    const jw = ease(clamp(st.jump, 0, 1));
    if (jw > .001) {
      const rising = fin(p._vy) > 0 ? 1 : 0, flap = Math.sin(t * 9) * .12;
      const jHipL = rising ? 1.0 : .4, jHipR = rising ? .12 : .05, jKneeL = rising ? -1.6 : -.45, jKneeR = rising ? -.6 : -.3;
      P.hipL = lerp(P.hipL, jHipL, jw); P.hipR = lerp(P.hipR, jHipR, jw); P.kneeL = lerp(P.kneeL, jKneeL, jw); P.kneeR = lerp(P.kneeR, jKneeR, jw);
      P.shL = lerp(P.shL, rising ? 1.1 : .35, jw); P.shR = lerp(P.shR, rising ? -.35 : .25, jw);
      P.shLz = lerp(P.shLz, rising ? -.35 : -1.0 + flap, jw); P.shRz = lerp(P.shRz, rising ? .5 : 1.0 - flap, jw);
      P.elL = lerp(P.elL, rising ? 1.1 : .35, jw); P.elR = lerp(P.elR, .45, jw);
      P.tx = lerp(P.tx, rising ? -.14 : .06, jw); P.hx = lerp(P.hx, rising ? .14 : -.08, jw); P.ty = lerp(P.ty, 0, jw); P.ty0 = lerp(P.ty0, .04, jw);
    }
    // Chute libre : à plat ventre, bras écartés en W (avant-bras vers l'avant),
    // jambes écartées genoux pliés. En piqué : corps tête en bas, bras plaqués.
    const fw = ease(clamp(st.fall, 0, 1));
    if (fw > .001) {
      const dive = clamp(fin(u.dive), -1, 1), sl = clamp(dive, 0, 1), sp2 = 1 - sl, steer = clamp(st.turn, -2, 2) * .5;
      const fl = Math.sin(t * 7.5) * .05, fl2 = Math.sin(t * 6.1 + 1.3) * .05;
      P.hipL = lerp(P.hipL, .18 * sp2 + fl, fw); P.hipR = lerp(P.hipR, .18 * sp2 - fl, fw);
      P.hipLz = lerp(P.hipLz, -.3 * sp2 - .03, fw); P.hipRz = lerp(P.hipRz, .3 * sp2 + .03, fw);
      P.kneeL = lerp(P.kneeL, -1.05 * sp2 - .08 + fl2, fw); P.kneeR = lerp(P.kneeR, -1.05 * sp2 - .08 - fl2, fw);
      P.shL = lerp(P.shL, .3 * sp2 - .3 * sl - steer * .25, fw); P.shR = lerp(P.shR, .3 * sp2 - .3 * sl + steer * .25, fw);
      P.shLz = lerp(P.shLz, -1.3 * sp2 - .2 * sl + fl, fw); P.shRz = lerp(P.shRz, 1.3 * sp2 + .2 * sl - fl, fw);
      P.elL = lerp(P.elL, .25 * sp2, fw); P.elR = lerp(P.elR, .25 * sp2, fw);
      P.elLz = lerp(P.elLz, -1.25 * sp2, fw); P.elRz = lerp(P.elRz, 1.25 * sp2, fw);
      P.tx = lerp(P.tx, .14 * sp2, fw); P.ty = lerp(P.ty, 0, fw); P.tz = lerp(P.tz, 0, fw); P.ty0 = lerp(P.ty0, 0, fw);
      P.hx = lerp(P.hx, .75 * sp2 + .35 * sl, fw); P.hy = lerp(P.hy, -steer * .3, fw);
      P.mx = lerp(P.mx, -1.28 - sl * .32, fw); P.mz = lerp(P.mz, -steer * .45, fw);
    }
    // Planeur : suspendu aux poignées (mains posées par IK), buste penché vers
    // l'avant, jambes qui traînent derrière et se balancent, roulis en virage.
    const gw = ease(clamp(st.glide, 0, 1));
    if (gw > .001) {
      const swing = Math.sin(t * 1.9), steer = clamp(st.turn, -2, 2) * .5, dive = clamp(fin(u.dive), -1, 1);
      P.hipL = lerp(P.hipL, -.28 + swing * .1 - steer * .1, gw); P.hipR = lerp(P.hipR, -.18 - swing * .1 + steer * .1, gw);
      P.kneeL = lerp(P.kneeL, -.55 - Math.max(0, swing) * .2, gw); P.kneeR = lerp(P.kneeR, -.42 - Math.max(0, -swing) * .2, gw);
      P.hipLz = lerp(P.hipLz, -.07 + steer * .12, gw); P.hipRz = lerp(P.hipRz, .07 + steer * .12, gw);
      P.shL = lerp(P.shL, 2.95, gw); P.shR = lerp(P.shR, 2.95, gw); P.shLz = lerp(P.shLz, -.2, gw); P.shRz = lerp(P.shRz, .2, gw);
      P.elL = lerp(P.elL, .25, gw); P.elR = lerp(P.elR, .25, gw);
      P.tx = lerp(P.tx, .05, gw); P.ty = lerp(P.ty, -steer * .12, gw); P.tz = lerp(P.tz, -steer * .1, gw); P.ty0 = lerp(P.ty0, 0, gw);
      P.hx = lerp(P.hx, -.12 - dive * .1, gw); P.hy = lerp(P.hy, -steer * .35, gw);
      P.mx = lerp(P.mx, -.28 - dive * .14, gw); P.mz = lerp(P.mz, -steer * .32, gw);
    }
    const ld = st.land > 0 ? ease(st.land) * st.landPow : 0;
    if (ld > .001) {
      P.hipL += .6 * ld; P.hipR += .6 * ld; P.kneeL -= 1.2 * ld; P.kneeR -= 1.2 * ld; P.ty0 -= .22 * ld; P.tx -= .32 * ld;
      P.shLz -= .5 * ld; P.shRz += .5 * ld; P.shL += .3 * ld; P.shR += .3 * ld; P.elL += .3 * ld; P.elR += .3 * ld;
    }
    return { airborne, highAir };
  }

  /* ---------------- Pioche ---------------- */
  const SWING = .52;
  const H = new T.Vector3(), S = new T.Vector3(), D = new T.Vector3(), G = new T.Vector3();
  const CARRY = { hx: .24, hy: 1.26, hz: -.24, a: .75, r: -.12 };
  const KEYS = [
    // t, main (x,y,z), angle du manche, roulis, buste x / y
    [0, .24, 1.26, -.24, .75, -.12, 0, 0],
    [.34, .12, 1.8, .0, 2.05, -.04, .12, -.36],
    [.56, .04, 1.14, -.5, -1.5, .02, -.24, .3],
    [.68, .05, 1.06, -.47, -1.72, .02, -.27, .32],
    [1, .24, 1.26, -.24, .75, -.12, 0, 0]
  ];
  const curve = (k) => k < .34 ? ease(k / .34) : k < .56 ? Math.pow((k - .34) / .22, 2.2) : k < .68 ? ease((k - .56) / .12) : ease((k - .68) / .32);
  function swingKey(s, out) {
    let i = 0; while (i < KEYS.length - 2 && s > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = curve(s), local = clamp(k, 0, 1);
    for (let j = 1; j < 8; j++) out[j] = lerp(a[j], b[j], local);
    return out;
  }
  const keyOut = new Array(8).fill(0);

  function makeTrail() {
    const geo = new T.RingGeometry(.72, 1.38, 36, 1, -1.9, 3.8);
    const mat = new T.ShaderMaterial({
      uniforms: { uFrom: { value: 1.6 }, uTo: { value: 1.6 }, uAlpha: { value: 0 }, uColor: { value: new T.Color('#fff6d6') } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uFrom; uniform float uTo; uniform float uAlpha; uniform vec3 uColor; varying vec2 vP;' +
        'void main(){ float a = atan(vP.y, vP.x); if (a > uFrom || a < uTo) discard; float k = (a - uTo) / max(.001, uFrom - uTo);' +
        ' float r = length(vP); float edge = smoothstep(.72, 1.0, r) * (1.0 - smoothstep(1.25, 1.38, r));' +
        ' gl_FragColor = vec4(uColor, uAlpha * pow(1.0 - k, 1.6) * edge); }',
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1), new T.Vector3(1, 0, 0)));
    mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
    return mesh;
  }

  function pickaxe(view, m, p, dt, options, st, P) {
    const u = m.userData, tool = u.tool;
    if (!tool?.userData?.v67) return false;
    const h = fin(u.harvest);
    if (h > st.lastHarvest + .4 && (st.swing < 0 || st.swing > .62)) st.swing = 0;
    st.lastHarvest = h;
    let s = -1;
    if (st.swing >= 0) { st.swing += dt / SWING; if (st.swing >= 1) st.swing = -1; else s = st.swing; }
    const run = st.run, t = fin(view.time);
    let hx = CARRY.hx, hy = CARRY.hy + P.ty0 * .9, hz = CARRY.hz, a = CARRY.a, r = CARRY.r, btx = 0, bty = 0;
    // En courant la pioche rebondit sur l'épaule au rythme des pas.
    hy += Math.abs(Math.sin(st.phase)) * .035 * run; a += Math.sin(st.phase) * .06 * run;
    if (s >= 0) {
      swingKey(s, keyOut);
      hx = keyOut[1]; hy = keyOut[2] + P.ty0 * .9; hz = keyOut[3]; a = keyOut[4]; r = keyOut[5]; btx = keyOut[6]; bty = keyOut[7];
      const strike = bump(s, .3, .72), plant = bump(s, .34, 1);
      // Appuis : jambe gauche en avant à la frappe, poids sur l'arrière à l'armé.
      P.hipL += plant * .38 * (1 - run); P.kneeL -= plant * .3 * (1 - run); P.hipR -= plant * .22 * (1 - run); P.kneeR -= plant * .25 * (1 - run);
      P.ty0 -= strike * .05;
      P.tx = lerp(P.tx, btx, .85); P.ty = lerp(P.ty, bty, .85);
      P.hx += -btx * .6 + (s > .5 ? -.12 : .1) * bump(s, .2, .9);
      // Petite secousse à l'impact.
      if (s > .56 && s < .7) { const j = (1 - (s - .56) / .14); hy += Math.sin(t * 90) * .012 * j; }
    }
    tool.position.set(hx, hy, hz);
    tool.rotation.set(a, 0, r);
    tool.updateMatrix();
    return { s, hx, hy, hz, a };
  }

  function pickaxeArms(view, u, st, info, options) {
    if (!info || !view.solveArm) return;
    H.set(info.hx, info.hy, info.hz);
    view.solveArm(u, 1, H);
    if (info.s >= 0) {
      const w2 = ease(clamp(bump(info.s, .06, .96) * 1.6, 0, 1));
      if (w2 > .01) {
        D.set(0, Math.cos(info.a), Math.sin(info.a));
        S.copy(H).addScaledVector(D, .4);
        const sh = u.limbs[1], el = u.elbows[0];
        const qs = sh.quaternion.clone(), qe = el.quaternion.clone();
        view.solveArm(u, 0, S);
        if (w2 < .99) { sh.quaternion.slerp(qs, 1 - w2); el.quaternion.slerp(qe, 1 - w2); }
      }
    }
    // Traînée de vitesse (joueur local uniquement).
    if (!options.local) return;
    let trail = u.v67Trail;
    if (!trail) { trail = u.v67Trail = makeTrail(); u.tool.parent?.add(trail); }
    const strike = info.s >= .3 && info.s <= .8;
    trail.visible = strike;
    if (strike) {
      trail.position.set(info.hx + .02, info.hy, info.hz);
      const mu = trail.material.uniforms;
      mu.uFrom.value = 1.6; mu.uTo.value = info.a; mu.uAlpha.value = .75 * (info.s < .68 ? 1 : 1 - (info.s - .68) / .12);
      if (info.s > .68) mu.uFrom.value = lerp(1.6, info.a, (info.s - .68) / .12);
    }
  }

  /* ---------------- Émotes ---------------- */
  const BPM = { salut: 100, danse: 116, victoire: 128, robot: 108, etoile: 132, toupie: 112 };
  function emotePose(style, time, P, R) {
    const bpm = BPM[style] || 110, beat = time * bpm / 60, b = beat % 1, bar = Math.floor(beat / 4) % 2, bi = Math.floor(beat) % 4;
    const pulse = Math.pow(1 - b, 3), hop = Math.sin(Math.PI * b), sw = Math.sin(beat * Math.PI), cw = Math.cos(beat * Math.PI);
    R.lift = 0; R.spin = 0;
    // base neutre
    Object.assign(P, { hipL: 0, hipR: 0, kneeL: -.05, kneeR: -.05, hipLz: -.05, hipRz: .05, shL: 0, shR: 0, shLz: -.15, shRz: .15, elL: .2, elR: .2, elLz: 0, elRz: 0, tx: 0, ty: 0, tz: 0, ty0: 0, hx: 0, hy: 0, hz: 0, mx: 0, mz: 0 });
    if (style === 'salut') {
      // Deux grands saluts du bras droit, puis révérence main sur le cœur.
      const intro = beat < 8;
      if (intro) {
        const wave = Math.sin(beat * Math.PI * 2);
        P.shR = .35; P.shRz = 2.55 + wave * .12; P.elR = .55 + wave * .45; P.shL = .1; P.elL = .3;
        P.ty = -.12; P.tz = -.06 + wave * .03; P.hy = .2 + wave * .05; P.hx = .1;
        P.hipL = .05 * sw; P.hipR = -.05 * sw; P.kneeL = -.08 - .1 * Math.max(0, sw); P.kneeR = -.08 - .1 * Math.max(0, -sw);
      } else {
        const k = ease(clamp((beat - 8) / 1.5, 0, 1)), back = ease(clamp((beat - 10.5) / 1.2, 0, 1)), bow = k * (1 - back);
        P.shR = 1.1 * k; P.shRz = .45 * k; P.elR = 1.9 * k; P.shL = -.5 * bow; P.shLz = -.4 * bow;
        P.tx = -.75 * bow; P.hx = -.3 * bow; P.hipL = .25 * bow; P.hipR = -.35 * bow; P.kneeR = -.35 * bow; P.ty0 = -.03 * bow;
        if (back > 0) { const w2 = Math.sin(beat * Math.PI * 2); P.shR = lerp(P.shR, .35, back); P.shRz = lerp(P.shRz, 2.5 + w2 * .1, back); P.elR = lerp(P.elR, .6 + w2 * .4, back); }
      }
    } else if (style === 'danse') {
      // Disco : doigt pointé vers le ciel puis vers le sol en diagonale, hanches qui roulent, pas glissés.
      const up = bi % 2 === 0, k = ease(clamp(b * 2.2, 0, 1)), side = bar ? -1 : 1;
      const armUp = up ? k : 1 - k;
      if (side > 0) { P.shR = lerp(.3, 2.6, armUp); P.shRz = lerp(.7, .55, armUp); P.elR = lerp(.2, .05, armUp); P.shL = .25; P.shLz = -.3; P.elL = 1.6; }
      else { P.shL = lerp(.3, 2.6, armUp); P.shLz = lerp(-.7, -.55, armUp); P.elL = lerp(.2, .05, armUp); P.shR = .25; P.shRz = .3; P.elR = 1.6; }
      P.tz = side * (armUp * .22 - .08); P.ty = side * -.18; P.hy = side * (armUp * .35); P.hx = armUp * .35 - .1;
      const step = Math.sin(beat * Math.PI);
      P.hipL = .22 * step; P.hipR = -.22 * step; P.kneeL = -.25 - .25 * Math.max(0, step); P.kneeR = -.25 - .25 * Math.max(0, -step);
      P.hipLz = -.12 + .08 * step; P.hipRz = .12 + .08 * step; P.ty0 = -.04 + .03 * hop; R.lift = .015 * hop;
    } else if (style === 'victoire') {
      // Deux coups de poing vers le ciel en sautant, puis bras en V avec petits sauts.
      if (bar === 0) {
        const pump = bi % 2 === 0, k = pulse;
        P.shR = 2.7 - (pump ? 0 : .9) * (1 - k); P.shRz = .3; P.elR = pump ? .2 + (1 - k) * 1.2 : 1.6; P.shL = .4; P.shLz = -.5; P.elL = 1.4;
        R.lift = .32 * Math.max(0, Math.sin(Math.PI * clamp(b * 1.25, 0, 1))) * (pump ? 1 : .5);
        const air = R.lift > .05 ? 1 : 0; P.hipL = .5 * air; P.kneeL = -.9 * air - .1; P.hipR = .1 * air; P.kneeR = -.6 * air - .1;
        P.tx = -.1 + .15 * air; P.hx = .35; P.ty = -.1;
      } else {
        P.shL = 2.3; P.shR = 2.3; P.shLz = -.75; P.shRz = .75; P.elL = .15 + .2 * pulse; P.elR = .15 + .2 * pulse;
        R.lift = .14 * hop; P.kneeL = -.3 * (1 - hop) - .05; P.kneeR = -.3 * (1 - hop) - .05; P.hipL = .15 * (1 - hop); P.hipR = .15 * (1 - hop);
        P.hx = .4; P.tx = .08; P.ty = .15 * sw;
      }
    } else if (style === 'robot') {
      // Robot : positions figées qui claquent sur chaque temps, tête qui tourne par crans.
      const poses = [
        { shL: 1.57, shLz: -.1, elL: 1.57, shR: 0, shRz: .15, elR: 1.57, ty: .3, hy: -.6, hipL: .1, hipR: -.1 },
        { shL: 0, shLz: -.15, elL: 1.57, shR: 1.57, shRz: .1, elR: 1.57, ty: -.3, hy: .6, hipL: -.1, hipR: .1 },
        { shL: .2, shLz: -1.57, elL: 1.57, shR: .2, shRz: 1.57, elR: 1.57, ty: 0, hy: 0, hipL: .25, hipR: -.05 },
        { shL: 1.57, shLz: -.1, elL: 0, shR: 1.57, shRz: .1, elR: 0, ty: 0, hy: .3, hipL: -.05, hipR: .25 }
      ];
      const a = poses[bi], nb = poses[(bi + 1) % 4], snap = b < .82 ? 0 : ease((b - .82) / .18);
      for (const key in a) P[key] = lerp(a[key], nb[key], snap);
      P.kneeL = -.12 - (P.hipL > .1 ? .35 : 0); P.kneeR = -.12 - (P.hipR > .1 ? .35 : 0);
      P.ty0 = -.02 - .02 * (b < .08 ? 1 - b / .08 : 0); P.hx = -.05;
    } else if (style === 'etoile') {
      // Sauts étoile : bras et jambes s'ouvrent en l'air, se referment au sol.
      const air = Math.sin(Math.PI * b), open = ease(clamp(air * 1.4, 0, 1));
      R.lift = .3 * air;
      P.shLz = lerp(-.15, -2.6, open); P.shRz = lerp(.15, 2.6, open); P.elL = .15; P.elR = .15; P.shL = .1; P.shR = .1;
      P.hipLz = lerp(-.04, -.42, open); P.hipRz = lerp(.04, .42, open); P.kneeL = -.05 - (1 - air) * .35; P.kneeR = -.05 - (1 - air) * .35;
      P.hipL = (1 - air) * .2; P.hipR = (1 - air) * .2; P.ty0 = -(1 - air) * .06; P.hx = .2 * open; P.tx = .05 * open;
    } else {
      // Breakdance : appui bas, deux tours sur soi-même, puis pose figée bras croisés.
      const loop = beat % 8;
      if (loop < 4) {
        const k = loop / 4;
        R.spin = ease(k) * Math.PI * 4;
        P.hipL = .9; P.kneeL = -1.6; P.hipR = .2; P.hipRz = .7; P.kneeR = -.3; P.ty0 = -.42;
        P.shL = .6; P.shLz = -1.3; P.elL = .3; P.shR = .9; P.shRz = 1.1; P.elR = .5; P.tx = -.35; P.tz = .2; P.hx = .25;
      } else {
        const hit = pulse;
        P.shL = 1.3; P.shLz = .55; P.elL = 1.9; P.shR = 1.3; P.shRz = -.55; P.elR = 1.9;
        P.tx = .12; P.ty = .2; P.hy = .35; P.hx = .2; P.ty0 = -.02 - .03 * hit;
        P.hipL = .2; P.hipR = -.15; P.kneeL = -.25; P.hipLz = -.15; P.hipRz = .2; R.lift = 0;
      }
    }
  }

  /* ---------------- Application ---------------- */
  function apply(m, u, P, arms, torso, menu) {
    u.limbs[0].rotation.set(P.hipL, 0, P.hipLz); u.limbs[2].rotation.set(P.hipR, 0, P.hipRz);
    u.knees[0].rotation.set(P.kneeL, 0, 0); u.knees[1].rotation.set(P.kneeR, 0, 0);
    if (arms) {
      u.limbs[1].rotation.set(P.shL, 0, P.shLz); u.limbs[3].rotation.set(P.shR, 0, P.shRz);
      u.elbows[0].rotation.set(P.elL, 0, P.elLz || 0); u.elbows[1].rotation.set(P.elR, 0, P.elRz || 0);
    }
    if (torso) { u.torso.rotation.set(P.tx, P.ty, P.tz); u.torso.position.y = P.ty0; u.head.rotation.set(P.hx, P.hy, P.hz); }
    else u.head.rotation.y += P.hy * .3;
    // Le bassin (et les cuisses) suit le buste à l'identique : la jambe reste attachée.
    if (u.restLimbPositions) for (const i of [0, 2]) if (u.limbs[i].parent !== u.torso) u.limbs[i].position.y = u.restLimbPositions[i].y + P.ty0;
    if (u.pelvis) u.pelvis.position.y = P.ty0;
    if (!menu) { m.rotation.x = P.mx; m.rotation.z = P.mz; }
  }

  const P = {}, R = { lift: 0, spin: 0 };
  function animate(view, m, p, dt, options) {
    const u = m.userData, st = state(u);
    if (!u.limbs || !u.knees || !u.elbows || !u.torso || !u.head) return;
    if (p.downed || p.swimming) { st.air = false; return; }
    const menu = !!options.menu;
    if (p.emote > 0 && !p.gliding && !p.falling) {
      const dur = Math.max(.001, fin(p.emoteDuration, 6)), time = clamp(dur - fin(p.emote, dur), 0, dur);
      const style = p.emoteStyle || 'salut';
      emotePose(style, time, P, R);
      if (u.tool) u.tool.visible = false; if (u.gun) u.gun.visible = false;
      apply(m, u, P, true, true, menu);
      u.torso.position.y += R.lift;
      if (u.restLimbPositions) for (const i of [0, 2]) if (u.limbs[i].parent !== u.torso) u.limbs[i].position.y += R.lift;
      if (u.pelvis) u.pelvis.position.y += R.lift;
      m.rotation.y += R.spin;
      st.lastX = null; st.swing = -1;
      return;
    }
    locomotion(view, m, p, dt, options, st, P);
    const toolOut = u.tool?.visible ? pickaxe(view, m, p, dt, options, st, P) : (u.v67Trail && (u.v67Trail.visible = false), null);
    const armsBusy = !!(u.gun?.visible || u.blueprint?.visible || u.rod?.visible);
    apply(m, u, P, !armsBusy, !armsBusy, menu);
    if (toolOut) pickaxeArms(view, u, st, toolOut, options);
    // Planeur : les mains se posent exactement sur les poignées.
    if (st.glide > .5 && u.glider?.visible && u.glider.userData.handles && view.solveArm) {
      u.glider.updateMatrix();
      view.solveArm(u, 0, G.fromArray(u.glider.userData.handles.left).applyMatrix4(u.glider.matrix));
      view.solveArm(u, 1, G.fromArray(u.glider.userData.handles.right).applyMatrix4(u.glider.matrix));
    }
    // Construction : le bras droit pousse la pièce vers l'avant (la main gauche tient le plan).
    if (u.blueprint?.visible && !u.gun?.visible) {
      const push = 1 - Math.pow(1 - clamp(1 - fin(u.placePulse), 0, 1), 3);
      u.limbs[3].rotation.set(lerp(.55, 1.35, push), 0, lerp(.35, .12, push));
      u.elbows[1].rotation.set(lerp(1.5, .35, push), 0, 0);
    }
  }

  const previous = V.animateAvatar;
  V.animateAvatar = function (model, player, dt, options = {}) {
    const r = previous.call(this, model, player, dt, options);
    try { if (model?.userData && player) animate(this, model, player, clamp(fin(dt), 0, .1), options || {}); } catch (e) { /* jamais bloquant */ }
    return r;
  };
})(window);
