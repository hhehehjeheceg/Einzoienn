/* AZUR Horizons — deterministic final pose, authored -Z equipment and two-bone IK. */
(function (root) {
  'use strict';
  const T = root.THREE, A = root.AZArt, S = root.AZSim, V = root.AZView.View.prototype;
  const clamp = T.MathUtils.clamp, lerp = T.MathUtils.lerp;
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const ease = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  // v19 animation curves: eased transitions everywhere — anticipation winds up
  // with easeIn, releases snap out with easeOutCubic/easeOutBack, blends cross
  // with easeInOut so no state ever snaps.
  const easeInOut = v => { v = clamp(v, 0, 1); return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2; };
  const easeOutCubic = v => { v = clamp(v, 0, 1); return 1 - Math.pow(1 - v, 3); };
  const easeOutBack = v => { v = clamp(v, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  // Volume-preserving squash & stretch: y compresses while x/z widen. Positive
  // amount = squash (landings, foot plants), negative = stretch (jump takeoff).
  function applySquashStretch(u, amount) {
    const a = clamp(amount, -.6, 1);
    u.torso.scale.set(1 + a * .05, 1 - a * .085, 1 + a * .05);
  }
  const down = new T.Vector3(0, -1, 0), primary = new T.Vector3(), support = new T.Vector3();
  // Scratch vectors/quaternion are reused for every actor; no geometry/material or
  // per-bone vector allocations in this pass (including IK).
  const origin = new T.Vector3(), axis = new T.Vector3(), bend = new T.Vector3(), middle = new T.Vector3();
  const lowerDir = new T.Vector3(), reachable = new T.Vector3(), inverse = new T.Quaternion();
  const armTarget = new T.Vector3(), torsoInverse = new T.Matrix4();
  function point(out, values, matrix) { return out.fromArray(values).applyMatrix4(matrix); }
  V.solveArm = function (u, side, target) {
    const shoulder = u.limbs[side ? 3 : 1], elbow = u.elbows[side];
    armTarget.copy(target);
    if (shoulder.parent === u.torso) {
      u.torso.updateMatrix();
      torsoInverse.copy(u.torso.matrix).invert();
      armTarget.applyMatrix4(torsoInverse);
    }
    origin.copy(shoulder.position); axis.copy(armTarget).sub(origin);
    const length = axis.length(), distance = clamp(length, .042, .604);
    if (length < .00001) axis.set(0, -1, 0); else axis.multiplyScalar(1 / length);
    const upper = .32, lower = .285;
    const a = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const h = Math.sqrt(Math.max(0, upper * upper - a * a));
    bend.set(side ? .88 : -.88, -.34, .5).addScaledVector(axis, -bend.dot(axis));
    if (bend.lengthSq() < .00001) bend.set(0, 0, 1).addScaledVector(axis, -axis.z);
    bend.normalize();
    middle.copy(origin).addScaledVector(axis, a).addScaledVector(bend, h);
    reachable.copy(origin).addScaledVector(axis, distance);
    shoulder.quaternion.setFromUnitVectors(down, lowerDir.copy(middle).sub(origin).normalize());
    inverse.copy(shoulder.quaternion).invert();
    lowerDir.copy(reachable).sub(middle).applyQuaternion(inverse).normalize();
    elbow.quaternion.setFromUnitVectors(down, lowerDir);
  };
  function resetRig(m, u) {
    u.torso.position.set(0, 0, 0); u.torso.rotation.set(0, 0, 0); u.torso.scale.set(1, 1, 1); u.head.rotation.set(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      if (!u.restLimbPositions) u.restLimbPositions = u.limbs.map(limb => limb.position.clone());
      u.limbs[i].position.copy(u.restLimbPositions[i]);
      u.limbs[i].rotation.set(0, 0, 0);
    }
    for (let i = 0; i < 2; i++) { u.knees[i].rotation.set(0, 0, 0); u.elbows[i].rotation.set(0, 0, 0); }
    m.rotation.set(0, finite(m.rotation.y), 0); m.scale.setScalar(finite(u.avatarScale, 1.065));
    if (u.emoteFx) { u.emoteFx.visible = false; u.emoteFx.position.set(0, 0, 0); u.emoteFx.rotation.set(0, 0, 0); u.emoteFx.scale.setScalar(1); }
  }
  const EMOTE_STYLES = ['salut', 'danse', 'victoire', 'robot', 'etoile', 'toupie'];
  const EMOTE_BY_COSMETIC = {
    'emote-salut': 'salut', 'emote-bonjour': 'salut',
    'emote-boussole': 'toupie', 'emote-signal': 'robot',
    'emote-victoire': 'victoire'
  };
  function emoteStyle(p) {
    if (EMOTE_STYLES.includes(p?.emoteStyle)) return p.emoteStyle;
    const id = p?.equipment?.emote || '';
    if (EMOTE_BY_COSMETIC[id]) return EMOTE_BY_COSMETIC[id];
    if (/danse|dance/i.test(id)) return 'danse';
    if (/etoile|star/i.test(id)) return 'etoile';
    if (/toupie|spin/i.test(id)) return 'toupie';
    if (/robot/i.test(id)) return 'robot';
    return 'salut';
  }
  // Emote motion lives entirely in torso-local joints.  Phase comes from the
  // authoritative countdown, so snapshots remain deterministic and no transform
  // is ever accumulated from a preceding frame.
  function applyEmote(u, style, phase, t) {
    // Every six-second emote contains several authored beats instead of one slow
    // pendulum pass.  Styles keep distinct timing: crisp robot ticks, flowing
    // dance phrases, broad victory bounces and a slower ceremonial salute.
    const loops = style === 'robot' ? 8 : style === 'danse' ? 5 : style === 'toupie' ? 4 : style === 'victoire' ? 4 : style === 'etoile' ? 3 : 3;
    const c = phase * Math.PI * 2 * loops, s = Math.sin(c), q = Math.cos(c), s2 = Math.sin(c * 2), q2 = Math.cos(c * 2);
    if (style === 'danse') {
      // Side-step, counter-hip and alternating shoulder sweep.
      u.limbs[0].rotation.set(.36 * s, .05, -.10); u.limbs[2].rotation.set(-.36 * s, -.05, .10);
      u.knees[0].rotation.x = -.42 * Math.max(0, s); u.knees[1].rotation.x = -.42 * Math.max(0, -s);
      u.limbs[1].rotation.set(-.72 - .24 * q, .10 * s, -1.00 + .46 * s); u.limbs[3].rotation.set(-.72 + .24 * q, -.10 * s, .92 + .46 * s);
      u.elbows[0].rotation.x = -.58 - .28 * s2; u.elbows[1].rotation.x = -.58 + .28 * s2;
      u.torso.position.set(.035 * s, .055 + .045 * Math.abs(s), 0); u.torso.rotation.set(.05 * q2, .25 * s, .14 * s); u.head.rotation.set(-.04 * q, -.20 * s, -.05 * s);
    } else if (style === 'victoire') {
      // A planted celebratory bounce with a wide, asymmetrical double-arm cheer.
      u.limbs[0].rotation.set(.15 + .16 * s, 0, -.08); u.limbs[2].rotation.set(-.15 - .16 * s, 0, .08);
      u.knees[0].rotation.x = -.30 * Math.max(0, q); u.knees[1].rotation.x = -.30 * Math.max(0, -q);
      u.limbs[1].rotation.set(-1.30 + .16 * q, -.08, -1.14 + .13 * s); u.limbs[3].rotation.set(-1.13 - .16 * q, .08, 1.14 - .13 * s);
      u.elbows[0].rotation.x = -.60 + .13 * s; u.elbows[1].rotation.x = -.60 - .13 * s;
      u.torso.position.y = .10 + .055 * Math.max(0, s); u.torso.rotation.set(-.08, .08 * s, .09 * s); u.head.rotation.set(-.15, .13 * s, 0);
    } else if (style === 'robot') {
      // Deliberately angular weight transfers, with distinct mechanical head ticks.
      const snap = q >= 0 ? 1 : -1, lift = s >= 0 ? 0 : 1;
      u.limbs[0].rotation.set(snap * .20, 0, -.09); u.limbs[2].rotation.set(-snap * .20, 0, .09);
      u.knees[0].rotation.x = lift ? -.34 : -.06; u.knees[1].rotation.x = lift ? -.06 : -.34;
      u.limbs[1].rotation.set(-.50 + .12 * snap, 0, -1.47 + .13 * snap); u.limbs[3].rotation.set(-.50 - .12 * snap, 0, 1.47 - .13 * snap);
      u.elbows[0].rotation.set(-.92 + .12 * snap, 0, 0); u.elbows[1].rotation.set(-.92 - .12 * snap, 0, 0);
      u.torso.position.set(snap * .018, .028, 0); u.torso.rotation.set(0, .20 * snap, -.09 * snap); u.head.rotation.set(0, .28 * snap, 0);
    } else if (style === 'etoile') {
      // Star silhouette breathes through ankles, knees, shoulders and a proud chin.
      u.limbs[0].rotation.set(.34 + .10 * s, 0, -.16); u.limbs[2].rotation.set(-.34 - .10 * s, 0, .16);
      u.knees[0].rotation.x = -.20 - .08 * q; u.knees[1].rotation.x = -.20 + .08 * q;
      u.limbs[1].rotation.set(-.34 + .10 * s, 0, -1.58); u.limbs[3].rotation.set(-.34 - .10 * s, 0, 1.58);
      u.elbows[0].rotation.x = -.22 - .10 * q; u.elbows[1].rotation.x = -.22 + .10 * q;
      u.torso.position.y = .050 + .025 * Math.max(0, s); u.torso.rotation.set(.04 * s, 0, 0); u.head.rotation.set(-.08, .18 * q, 0);
    } else if (style === 'toupie') {
      // A low, grounded spiral: twisting is bounded sine motion rather than a root spin.
      u.limbs[0].rotation.set(.25 * q, .05 * s, -.12); u.limbs[2].rotation.set(-.25 * q, -.05 * s, .12);
      u.knees[0].rotation.x = -.24 - .14 * Math.max(0, q); u.knees[1].rotation.x = -.24 - .14 * Math.max(0, -q);
      u.limbs[1].rotation.set(-.88 + .19 * s, .08 * q, -.98 + .30 * q); u.limbs[3].rotation.set(-.88 - .19 * s, -.08 * q, .98 - .30 * q);
      u.elbows[0].rotation.x = -.63 + .19 * q; u.elbows[1].rotation.x = -.63 - .19 * q;
      u.torso.position.set(0, .045, 0); u.torso.rotation.set(.04 * s, .48 * s, .10 * q); u.head.rotation.set(0, -.40 * s, -.04 * q);
    } else {
      // Salut: a clear high wave, resting hand, small weight shift and friendly nod.
      u.limbs[0].rotation.set(.10 * s, 0, -.06); u.limbs[2].rotation.set(-.10 * s, 0, .06);
      u.knees[0].rotation.x = -.13 * Math.max(0, -s); u.knees[1].rotation.x = -.13 * Math.max(0, s);
      u.limbs[1].rotation.set(-.40 + .13 * q, 0, -1.43 + .34 * s); u.limbs[3].rotation.set(-1.08 + .08 * q, 0, .58 + .16 * s);
      u.elbows[0].rotation.x = -.52 + .12 * q; u.elbows[1].rotation.x = -.66;
      u.torso.position.set(.014 * s, .035, 0); u.torso.rotation.set(0, .10 * s, -.05 * s); u.head.rotation.set(.04 * q, .16 * s, 0);
    }
    if (u.emoteFx) {
      u.emoteFx.visible = true; u.emoteFx.rotation.set(0, c * .52, .08 * s);
      u.emoteFx.scale.setScalar(.84 + .22 * (0.5 + 0.5 * s)); u.emoteFx.position.y = .02 + Math.abs(s) * .035;
    }
  }
  function mixRotation(node, x, y, z, weight) {
    node.rotation.set(lerp(node.rotation.x, x, weight), lerp(node.rotation.y, y, weight), lerp(node.rotation.z, z, weight));
  }
  const baseAnimate = V.animateAvatar;
  V.animateAvatar = function (m, p, dt, options = {}) {
    const u = m.userData;
    dt = clamp(finite(dt), 0, .1);
    const smooth = 1 - Math.exp(-dt * 15), airSmooth = 1 - Math.exp(-dt * 10);
    const distance = finite(p.distance, finite(u.lastDistance));
    // Exactly ONE base call owns walk/phase/recoil/harvest/glideScale. Normalize
    // absent wraps: undefined !== '' previously replaced the weapon EVERY frame.
    // Suppress only the base emote's additive root Y; our emote stays rig-local.
    const wrap = p.equipment?.wrap || '';
    const basePlayer = { ...p, distance, pitch: finite(p.pitch), emote: 0, equipment: { ...p.equipment, wrap } };
    u.walk = finite(u.walk); u.anim = finite(u.anim); u.recoil = finite(u.recoil); u.harvest = finite(u.harvest);
    u.glideScale = finite(u.glideScale); u.lastDistance = finite(u.lastDistance, distance);
    const shot = u.recoil > .01;
    baseAnimate.call(this, m, basePlayer, dt, options);
    resetRig(m, u);
    const t = finite(this.time, u.poseTime = finite(u.poseTime) + dt);
    const ground = S.heightAt ? finite(S.heightAt(finite(p.x), finite(p.z)), finite(p.y)) : finite(p.y);
    const busFall = !!(p.falling && p.airborneFromBus);
    const highAir = !!(p.gliding || p.flying || busFall || (p.falling && finite(p.y) - ground > 5));
    const input = p._input || options;
    const yaw = finite(p.yaw, m.rotation.y), dx = finite(p.x) - finite(u.poseX, finite(p.x)), dz = finite(p.z) - finite(u.poseZ, finite(p.z));
    const travel = Math.hypot(dx, dz), speed = travel / Math.max(.001, dt);
    const lateral = travel > .0001 && speed < 85 ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / travel : 0;
    const forward = travel > .0001 && speed < 85 ? -(dx * Math.sin(yaw) + dz * Math.cos(yaw)) / travel : 0;
    const yawDelta = Math.atan2(Math.sin(yaw - finite(u.poseYaw, yaw)), Math.cos(yaw - finite(u.poseYaw, yaw)));
    u.poseX = finite(p.x); u.poseZ = finite(p.z); u.poseYaw = yaw;
    u.steer = lerp(finite(u.steer), clamp(finite(input.moveX, lateral) + yawDelta / Math.max(.08, dt * 4), -1, 1), airSmooth);
    u.dive = lerp(finite(u.dive), clamp(finite(input.moveZ, forward), -1, 1), airSmooth);
    const moving = clamp(u.walk, 0, 1.65), sprint = clamp((moving - 1.03) / .55, 0, 1);
    const phase = u.anim, sine = Math.sin(phase), cosine = Math.cos(phase);
    // v19 locomotion: arms swing with a follow-through lag behind the legs, the
    // head counter-bobs, strafing leans the torso, and every foot plant feeds a
    // subtle volume-preserving squash instead of a hard vertical bounce.
    let squashAmt = 0;
    const sineLag = Math.sin(phase - .62), cosineLag = Math.cos(phase - .62);
    const stride = sine * moving * (.48 + sprint * .15), bounce = Math.abs(sine) * moving * (.020 + sprint * .013);
    const armSwing = sineLag * moving * (.42 + sprint * .12);
    u.limbs[0].rotation.x = stride; u.limbs[2].rotation.x = -stride;
    u.knees[0].rotation.x = -Math.max(0, -sine) * moving * (.68 + sprint * .25);
    u.knees[1].rotation.x = -Math.max(0, sine) * moving * (.68 + sprint * .25);
    u.limbs[1].rotation.set(-armSwing, 0, -.055 - cosineLag * moving * .023);
    u.limbs[3].rotation.set(armSwing, 0, .055 + cosineLag * moving * .023);
    u.elbows[0].rotation.x = -.20 - sprint * .37 - Math.max(0, armSwing) * .25;
    u.elbows[1].rotation.x = -.20 - sprint * .37 + Math.min(0, armSwing) * .25;
    u.torso.position.y = Math.sin(t * 2.15) * .009 + bounce;
    u.torso.rotation.set(sprint * .075, -sine * moving * .026, -sine * moving * .023 - u.steer * moving * .055);
    u.head.rotation.set(-bounce * 1.1, Math.sin(t * .83) * .018, 0);
    squashAmt += Math.abs(cosine) * moving * .30;
    // v19: launching into a sprint dips the body once — anticipation before speed.
    const wasMoving = finite(u.prevMoving);
    if (moving > 1.02 && wasMoving <= 1.02) u.launchDip = 1;
    u.prevMoving = moving;
    u.launchDip = Math.max(0, finite(u.launchDip) - dt * 4.6);
    if (u.launchDip > 0) {
      const dip = Math.sin(Math.PI * finite(u.launchDip));
      u.torso.position.y -= dip * .055;
      squashAmt += dip * .5;
    }
    // A landing from jump, freefall or glider produces one impact envelope. No
    // dependence on whether a LAN 'land' event arrived before or after this frame.
    const airborne = !!(p.jumping || p.falling || p.gliding || p.flying);
    if (u.wasAirborne && !airborne && p.grounded !== false) u.landImpact = 1;
    u.wasAirborne = airborne; u.wasJumping = !!p.jumping;
    u.landImpact = Math.max(0, finite(u.landImpact) - dt * 4.5);
    const impact = u.landImpact;
    if (impact) {
      u.torso.position.y -= impact * .14;
      u.limbs[0].rotation.x += .38 * impact; u.limbs[2].rotation.x += .38 * impact;
      u.knees[0].rotation.x -= .92 * impact; u.knees[1].rotation.x -= .92 * impact;
      squashAmt += impact * .8;
    }
    // v21 gait: a braking skid when speed collapses, a lagging pelvis roll with
    // the stride, and a deeper chest drop at full sprint. All envelopes ease —
    // direction changes and stops never snap.
    const prevSpeed = finite(u.prevSpeed, speed);
    u.prevSpeed = speed;
    // v21: skid if the speed collapsed this frame (lost >45% while running).
    if (!airborne && prevSpeed > 2.5 && speed < prevSpeed * .55) u.brakeHold = .45;
    u.brakeHold = Math.max(0, finite(u.brakeHold) - dt);
    const wantBrake = u.brakeHold > 0 ? 1 : 0;
    u.brake = lerp(finite(u.brake), wantBrake, 1 - Math.exp(-dt * (wantBrake ? 14 : 6)));
    const br = easeOutCubic(finite(u.brake));
    if (br > .001) {
      u.torso.rotation.x += br * .14;
      u.torso.position.y -= br * .05;
      u.knees[0].rotation.x -= br * .5; u.knees[1].rotation.x -= br * .5;
      u.limbs[0].rotation.x -= br * .3; u.limbs[2].rotation.x += br * .3;
      u.limbs[1].rotation.z -= br * .12; u.limbs[3].rotation.z += br * .12;
      squashAmt += br * .3;
    }
    u.torso.rotation.z += Math.sin(phase - .9) * moving * .018;
    u.torso.rotation.x += sprint * .045;
    u.head.rotation.x -= sprint * .05;
    u.crouchBlend = lerp(finite(u.crouchBlend), p.crouching && !airborne ? 1 : 0, smooth);
    const crouch = u.crouchBlend;
    u.torso.position.y -= crouch * .29; u.torso.rotation.x += crouch * .12;
    for (let i = 0; i < 4; i++) {
      if (u.limbs[i].parent !== u.torso) u.limbs[i].position.y -= i % 2 ? crouch * .29 + impact * .08 : crouch * .25 + impact * .055;
      if (!(i % 2)) u.limbs[i].rotation.x += crouch * .72;
    }
    u.knees[0].rotation.x = lerp(u.knees[0].rotation.x, -1.4, crouch);
    u.knees[1].rotation.x = lerp(u.knees[1].rotation.x, -1.4, crouch);
    // v19: the jump pose blends in and out with an eased envelope instead of
    // snapping over the run cycle — anticipation crouch, then flight extension.
    const wantJump = (p.jumping || (p.falling && !highAir)) ? 1 : 0;
    u.jumpBlend = lerp(finite(u.jumpBlend), wantJump, 1 - Math.exp(-dt * (wantJump ? 13 : 9)));
    if (wantJump) u.jumpAge = finite(u.jumpAge) + dt; else u.jumpAge = 0;
    const jw = easeInOut(finite(u.jumpBlend));
    if (jw > .001) {
      const anticipation = Math.max(0, 1 - finite(u.jumpAge) / .11), flight = 1 - anticipation;
      mixRotation(u.limbs[0], .22 + flight * .32, 0, 0, jw);
      mixRotation(u.limbs[2], -.16 - flight * .24, 0, 0, jw);
      mixRotation(u.knees[0], -.35 - flight * .42, 0, 0, jw);
      mixRotation(u.knees[1], -.28 - flight * .38, 0, 0, jw);
      mixRotation(u.limbs[1], u.limbs[1].rotation.x, 0, -.2, jw);
      mixRotation(u.limbs[3], u.limbs[3].rotation.x, 0, .2, jw);
      u.torso.position.y -= anticipation * .08 * jw;
      u.torso.rotation.x += flight * .10 * jw;
      squashAmt += anticipation * .55 * jw;
    }
    const airRate = airborne ? airSmooth : 1 - Math.exp(-dt * 22);
    u.fallBlend = lerp(finite(u.fallBlend), highAir && !p.gliding ? 1 : 0, airRate);
    u.glidePose = lerp(finite(u.glidePose), p.gliding ? 1 : 0, airRate);
    const fall = u.fallBlend, glide = u.glidePose, air = clamp(fall + glide, 0, 1);
    m.rotation.x = fall * (-1.40 - u.dive * .11) + glide * (-.21 - u.dive * .06);
    m.rotation.z = -u.steer * (fall * .24 + glide * .16);
    u.torso.position.y *= 1 - air; u.torso.rotation.x *= 1 - air;
    u.torso.rotation.y *= 1 - air; u.torso.rotation.z *= 1 - air;
    u.head.rotation.x = fall * -.18 + glide * .08;
    // Asymmetric bent knees, breathing and control-surface arm banking react to
    // actual steering (or remote displacement), including the final bus metres.
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, flutter = Math.sin(t * 4.8 + i * 1.7) * .035;
      mixRotation(u.limbs[i ? 3 : 1], -1.64 + u.dive * .17 + side * u.steer * .16, side * .09, side * (.92 - u.dive * .15), fall);
      mixRotation(u.elbows[i], -.31 + flutter, 0, 0, fall);
      mixRotation(u.limbs[i ? 2 : 0], .18 + side * .13 + flutter, side * .11, side * .19, fall);
      mixRotation(u.knees[i], -.54 - side * .09 - u.dive * .15, 0, 0, fall);
      mixRotation(u.limbs[i ? 2 : 0], .18 + side * .16 + u.dive * .08, 0, side * .10, glide);
      mixRotation(u.knees[i], -.48 - side * .08 + Math.sin(t * 2.8 + i) * .035, 0, 0, glide);
    }
    // v19: swimming eases in and out like every other state — no snap when the
    // player enters or leaves the water.
    u.swimBlend = lerp(finite(u.swimBlend), (p.swimming && !highAir) ? 1 : 0, 1 - Math.exp(-dt * 7));
    const sw = easeInOut(finite(u.swimBlend));
    if (sw > .001) {
      const swimPhase = finite(p._swimPhase, t * 5.1), stroke = Math.sin(swimPhase), kick = Math.sin(swimPhase * 1.82);
      const fast = clamp((speed - 4.2) / 2.4, 0, 1), thrust = clamp(finite(p._swimBoost), 0, 1);
      m.rotation.x = lerp(m.rotation.x, -.88 + Math.sin(swimPhase * .5) * .025, sw);
      m.rotation.z = lerp(m.rotation.z, -.075 * Math.sin(swimPhase * .5), sw);
      u.torso.position.y = lerp(u.torso.position.y, .025 + Math.abs(stroke) * .018, sw);
      mixRotation(u.torso, .08 + thrust * .06, Math.sin(swimPhase * .5) * .11, Math.sin(swimPhase) * .06, sw);
      mixRotation(u.head, -.19 + Math.max(0, stroke) * .08, -Math.sin(swimPhase * .5) * .18, 0, sw);
      // v21: the body rolls with the stroke and the head lifts on the breath.
      u.torso.rotation.z += Math.sin(swimPhase) * .05 * sw;
      u.head.rotation.x += Math.max(0, Math.sin(swimPhase + 1.2)) * .06 * sw;
      mixRotation(u.limbs[1], -1.15 + stroke * (1.02 + fast * .18) - thrust * .28, -.12, -.34 - stroke * .16, sw);
      mixRotation(u.limbs[3], -1.15 - stroke * (1.02 + fast * .18) - thrust * .28, .12, .34 - stroke * .16, sw);
      mixRotation(u.elbows[0], -.42 - Math.max(0, -stroke) * .72, 0, 0, sw);
      mixRotation(u.elbows[1], -.42 - Math.max(0, stroke) * .72, 0, 0, sw);
      mixRotation(u.limbs[0], .22 + kick * (.26 + fast * .14), 0, -.055, sw);
      mixRotation(u.limbs[2], .22 - kick * (.26 + fast * .14), 0, .055, sw);
      mixRotation(u.knees[0], -.22 - Math.max(0, -kick) * .48, 0, 0, sw);
      mixRotation(u.knees[1], -.22 - Math.max(0, kick) * .48, 0, 0, sw);
    }
    // v19: one volume-preserving squash & stretch pass, fed by foot plants,
    // sprint launches, landings, jump anticipation and build placements above.
    applySquashStretch(u, squashAmt);
    // The base already advances glideScale at 6/s open, 8/s close: DO NOT tick it
    // again here. Deployment rises from reachable harness height into full span.
    const glideBlend = clamp(u.glideScale, 0, 1);
    u.glider.visible = glideBlend > .015; u.glider.scale.setScalar(Math.max(.01, glideBlend) * (1 + Math.sin(t * 2.2) * .008 * glideBlend));
    u.glider.position.set(0, 1.82 + 1.02 * glideBlend, 0);
    u.glider.rotation.set(u.dive * .025, 0, -u.steer * .035 + Math.sin(t * 1.7) * .012);
    if (u.glider.userData.rotor) u.glider.userData.rotor.rotation.z = t * (8.5 + Math.abs(u.steer) * 3.5 + Math.max(0, u.dive) * 2);
    u.glider.userData.navLights?.forEach((light, index) => {
      const pulse = .78 + Math.sin(t * 6.2 + index * Math.PI) * .22;
      light.scale.setScalar(pulse); light.material.opacity = .72 + pulse * .2;
    });
    u.glider.userData.wingTips?.forEach((tip, index) => {
      const side = index ? 1 : -1;
      tip.rotation.z = side * ((1 - ease(glideBlend)) * .78 - u.steer * .075) + Math.sin(t * 5.4 + index) * .008 * glideBlend;
      tip.rotation.x = -.035 - Math.max(0, side * u.steer) * .08;
    });
    u.glider.userData.brakePanels?.forEach((flap, index) => {
      const side = index ? 1 : -1;
      flap.rotation.x = -.08 - Math.max(0, side * u.steer) * .42 - Math.max(0, u.dive) * .08;
      flap.rotation.z = side * .035;
    });
    u.glider.userData.ribbons?.forEach((ribbon, index) => {
      ribbon.position.y = Math.sin(t * 7.2 + index * 1.8) * .035;
      ribbon.scale.z = .82 + Math.sin(t * 5.1 + index) * .11 + Math.abs(u.steer) * .14;
      ribbon.material.opacity = (.24 + glideBlend * .26) * (p.gliding ? 1 : 0);
    });
    // v21: the canopy catches the air with a visible pop on deployment.
    if (p.gliding && !u.wasGlide) u.glidePop = 1;
    u.wasGlide = !!p.gliding;
    u.glidePop = Math.max(0, finite(u.glidePop) - dt * 3);
    if (u.glidePop > .001) u.glider.scale.multiplyScalar(1 + Math.sin(Math.PI * finite(u.glidePop)) * .12);

    const it = p.inventory?.[p.selected];
    // A server normally cancels an emote as soon as movement/combat starts.  This
    // presentation-side guard also handles delayed or malformed remote snapshots:
    // resetRig above restores a neutral rig immediately instead of letting a dance
    // blend with tools, building or locomotion.
    const emoteActive = p.emote > 0 && !highAir && !p.downed && !p.swimming && !p.fishing && p.useTime <= 0 && p.reload <= 0 && !options.buildType && !options.harvest && !input.buildType && !input.harvest && !input.fire && !options.fire && !p.aim && Math.abs(finite(input.moveX)) < .01 && Math.abs(finite(input.moveZ)) < .01 && moving < .075;
    const blocked = highAir || air > .25 || p.downed || p.swimming || emoteActive || !!p.fishing || p.useTime > 0;
    const harvesting = (!!options.harvest || u.harvest > .001) && !blocked && !options.buildType;
    const armed = it?.kind === 'weapon' && !blocked && !harvesting && !options.buildType;
    const ads = armed && !!(p.aim || options.aim);
    u.fireHold = shot && armed ? .16 : Math.max(0, finite(u.fireHold) - dt);
    const presenting = armed && (ads || u.fireHold > 0 || input.fire || options.fire);
    u.presentationBlend = lerp(finite(u.presentationBlend), presenting ? 1 : 0, 1 - Math.exp(-dt * (presenting ? 24 : 12)));
    u.gun.visible = !!armed;
    if (armed) {
      const pitch = clamp(finite(p.pitch), -1.35, 1.35), present = u.presentationBlend;
      const info = u.gun.userData.presentation || { extension: .19, kick: .035 };
      const reach = .065 + info.extension * present;
      // v21 weapon personality: heavy guns kick harder and recover slower.
      const wkind = it?.weapon || '';
      const kickScale = wkind === 'shotgun' ? 2.1 : wkind === 'sniper' ? 2.4 : wkind === 'launcher' ? 2.8 : wkind === 'smg' ? .7 : 1;
      const recoilOffset = u.recoil * u.recoil * info.kick * kickScale;
      // v21 weapon handling: swapping dips and rolls the gun with an overshoot,
      // drawing raises it from the hip, and the magazine drops mid-reload.
      const sel = finite(p.selected, 0);
      if (u.lastSelected !== sel) { if (u.wasArmed) u.swapT = 1; u.lastSelected = sel; }
      u.swapT = Math.max(0, finite(u.swapT) - dt * 3.2);
      if (!u.wasArmed) u.drawT = 1;
      u.drawT = Math.max(0, finite(u.drawT) - dt * 4.2);
      u.wasArmed = true;
      const swapEnv = u.swapT > 0 ? Math.sin(Math.PI * Math.min(1, u.swapT)) : 0;
      const drawEnv = 1 - easeOutBack(1 - finite(u.drawT));
      if (swapEnv > .001) {
        u.gun.position.y -= swapEnv * .16;
        u.gun.rotation.z += swapEnv * .5;
        u.gun.rotation.x -= swapEnv * .3;
      }
      if (drawEnv > .001) {
        u.gun.position.y -= drawEnv * .22;
        u.gun.rotation.x -= drawEnv * .55;
      }
      // v21: the original `reloading` const is declared below — use a local.
      const v21Reloading = p.reload > 0;
      if (v21Reloading) {
        u.reloadTotal = Math.max(finite(u.reloadTotal), p.reload);
        const total = finite(u.reloadTotal);
        if (!u.magDropped && total > 0 && p.reload < total * .45) {
          u.magDropped = true;
          if (A.fx && this.scene && !A.fx.mobile) {
            u.gun.updateMatrix();
            middle.set(0, -.05, .1).applyMatrix4(u.gun.matrix);
            reachable.set(.3, -.5, .2).applyMatrix4(u.gun.matrix).sub(middle).normalize();
            A.fx.spawnCasing(this.scene, middle, reachable);
          }
        }
      } else { u.reloadTotal = 0; u.magDropped = false; }
      // Aiming AND firing extend the complete weapon along its authored -Z. The
      // return/recoil is relative to this anchor, never += root/world position.
      u.gun.position.set(lerp(.16, .065, present), 1.30 - crouch * .29 - impact * .08 + Math.sin(pitch) * reach + Math.max(0, -Math.sin(pitch)) * .175 * present, -.025 - Math.cos(pitch) * reach);
      u.gun.position.y -= Math.sin(pitch) * recoilOffset;
      u.gun.position.z += Math.cos(pitch) * recoilOffset;
      // v19 reload: the weapon dips and rolls while the magazine is out, and the
      // support hand pumps twice (slap the mag home) instead of hovering.
      const reloading = p.reload > 0;
      u.gun.rotation.set(pitch - (u.recoil || 0) * .045 - (reloading ? .34 : 0), 0, reloading && !ads ? -.24 : 0);
      if (reloading) u.gun.position.y -= .055;
      if (!ads) u.gun.position.y += Math.sin(t * 2.1) * .004 * (1 - present);
      // v19 gun feel: a rising recoil edge is a real shot — flash the muzzle,
      // shake the weapon and eject a casing. The kick itself stays a fast attack
      // with an eased spring return via recoilOffset above.
      let flash = u.gun.userData.flash;
      if (!flash) {
        flash = new T.Group();
        const coreMat = new T.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
        const spikeMat = new T.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
        const core = new T.Mesh(new T.SphereGeometry(.085, 8, 6), coreMat);
        const spike = new T.Mesh(new T.ConeGeometry(.07, .44, 6), spikeMat);
        spike.rotation.x = -Math.PI / 2; spike.position.z = -.2;
        const crossA = new T.Mesh(new T.PlaneGeometry(.52, .13), spikeMat); crossA.position.z = -.1;
        const crossB = crossA.clone(); crossB.rotation.z = Math.PI / 2;
        flash.add(core, spike, crossA, crossB);
        const mz = u.gun.userData.muzzle || [0, .02, -.9];
        flash.position.set(mz[0], mz[1], mz[2]);
        flash.visible = false;
        u.gun.add(flash);
        u.gun.userData.flash = flash;
      }
      const prevRecoil = finite(u.prevRecoil);
      if (u.recoil > prevRecoil + .04) {
        u.flashT = 1; u.flashSpin = Math.random() * Math.PI * 2; u.gunShake = 1;
        if (A.fx && this.scene && !A.fx.mobile) {
          u.gun.updateMatrix();
          middle.set(.095, .055, -.12).applyMatrix4(u.gun.matrix);
          reachable.set(1, .35, 0).applyMatrix4(u.gun.matrix).sub(middle).normalize();
          A.fx.spawnCasing(this.scene, middle, reachable);
        }
      }
      u.prevRecoil = u.recoil;
      u.flashT = Math.max(0, finite(u.flashT) - dt * 13);
      u.gunShake = Math.max(0, finite(u.gunShake) - dt * 8);
      flash.visible = u.flashT > .01;
      if (flash.visible) {
        flash.rotation.z = (u.flashSpin || 0) + (1 - u.flashT) * 3;
        flash.scale.setScalar(.55 + u.flashT * 1.5);
        for (const part of flash.children) part.material.opacity = u.flashT;
      }
      if (u.gunShake > 0) {
        u.gun.rotation.x += (Math.random() - .5) * .06 * u.gunShake;
        u.gun.rotation.z += (Math.random() - .5) * .04 * u.gunShake;
      }
      u.gun.updateMatrix();
      point(primary, u.gun.userData.grip, u.gun.matrix);
      point(support, u.gun.userData.supportGrip, u.gun.matrix);
      if (reloading) support.set(-.16, 1.10 - crouch * .29 + Math.sin(t * 11) * .045 + Math.sin(t * 23) * .014, -.21);
      this.solveArm(u, 1, primary);
      this.solveArm(u, 0, support);
      primary.toArray(u.handTargets.weaponPrimary); support.toArray(u.handTargets.weaponSupport);
      u.head.rotation.x += pitch * .20;
      // v19 ADS: elbows tuck in and the head drops slightly onto the weapon.
      if (ads) {
        u.elbows[0].rotation.x -= .16 * present;
        u.elbows[1].rotation.x -= .16 * present;
        u.head.rotation.x += pitch * .06;
      }
    } else u.wasArmed = false;
    u.tool.visible = harvesting;
    if (harvesting) {
      // Carry is NOT a swing. The free hand counter-swings and the legs retain
      // locomotion; only a real harvest event drives this short two-hand arc.
      const activeSwing = u.harvest > .001;
      const age = 1 - clamp(u.harvest, 0, 1);
      const weight = activeSwing ? Math.sin(Math.PI * age) : 0;
      let arc = -.38;
      if (activeSwing) {
        if (age < .28) arc = lerp(-.38, -2.15, ease(age / .28));
        else if (age < .69) arc = lerp(-2.15, .66, ease((age - .28) / .41));
        else arc = lerp(.66, -.38, ease((age - .69) / .31));
      }
      u.toolAngle = lerp(finite(u.toolAngle, -.38), arc, 1 - Math.exp(-dt * 36));
      u.tool.position.set(lerp(.32, .105, weight), 1.23 - crouch * .29 + bounce * .35 + weight * .065, -.13 - weight * .04);
      u.tool.rotation.set(u.toolAngle + sine * moving * .045 * (1 - weight), 0, -.28 + weight * .43);
      u.tool.updateMatrix();
      point(primary, u.tool.userData.grips.primary, u.tool.matrix);
      this.solveArm(u, 1, primary);
      if (activeSwing) {
        point(support, u.tool.userData.grips.support, u.tool.matrix);
        // Blend only the free arm into the support grip, never stamp a static leg
        // stance over a moving pickaxe carrier (the 0.6 gait regression).
        const shoulder = u.limbs[1], elbow = u.elbows[0];
        reachable.set(0, -.285, 0).applyQuaternion(elbow.quaternion).add(elbow.position).applyQuaternion(shoulder.quaternion).add(shoulder.position);
        support.lerpVectors(reachable, support, ease(weight * 2));
        this.solveArm(u, 0, support);
        u.torso.rotation.y += Math.sin(age * Math.PI * 2) * weight * .15;
        u.torso.rotation.x += weight * .09;
      }
    }
    u.blueprint.visible = !!options.buildType && !blocked;
    if (u.blueprint.visible) {
      u.blueprint.position.set(-.25, 1.24 - crouch * .29, -.36); u.blueprint.rotation.set(-.5, 0, 0); u.blueprint.updateMatrix();
      primary.set(-.16, -.05, 0).applyMatrix4(u.blueprint.matrix); this.solveArm(u, 0, primary);
      u.limbs[3].rotation.set(-.68, 0, .18); u.elbows[1].rotation.x = -.62;
    }
    // v19: building is a visible two-beat gesture — the right arm winds up while
    // aiming the blueprint, then punches the piece into place on the fire edge.
    // The blueprint itself pops with an overshoot the instant the piece lands.
    const buildMode = (!!options.buildType || !!input.buildType) && !blocked;
    u.buildBlend = lerp(finite(u.buildBlend), buildMode ? 1 : 0, 1 - Math.exp(-dt * 11));
    const bb = easeInOut(finite(u.buildBlend));
    const buildFiring = !!(input.fire || options.fire);
    if (buildFiring && !u.wasBuildFire && bb > .3) u.placePulse = 1;
    u.wasBuildFire = buildFiring;
    u.placePulse = Math.max(0, finite(u.placePulse) - dt * 3.4);
    if (bb > .001) {
      const push = easeOutCubic(1 - finite(u.placePulse)); // 0 = wound up, 1 = placed
      mixRotation(u.limbs[3], lerp(-1.15, -.60, push), 0, .18, bb);
      mixRotation(u.elbows[1], -.62 + push * .34, 0, 0, bb);
      u.torso.rotation.x += .13 * bb;
      u.torso.position.y -= .03 * bb;
      u.head.rotation.x += .22 * bb;
      if (u.placePulse > 0) {
        const pop = Math.sin(Math.PI * (1 - u.placePulse));
        u.blueprint.scale.setScalar(1 + .28 * pop);
        squashAmt += pop * .25;
      } else if (u.blueprint.scale.x !== 1) u.blueprint.scale.setScalar(1);
    }
    if (p.gliding) {
      u.glider.updateMatrix();
      point(primary, u.glider.userData.handles.left, u.glider.matrix);
      point(support, u.glider.userData.handles.right, u.glider.matrix);
      primary.toArray(u.handTargets.gliderLeft); support.toArray(u.handTargets.gliderRight);
      // Deployment targets move up with the opening canopy; full-size handles are
      // within the authored 0.605m arm chain rather than beyond both wrists.
      this.solveArm(u, 0, primary); this.solveArm(u, 1, support);
    }
    u.rod.visible = !!p.fishing && !highAir;
    if (u.rod.visible) { u.rod.rotation.z = Math.sin(t * 3) * .018; u.limbs[3].rotation.set(-1.08, 0, .12); u.elbows[1].rotation.x = -.52; }
    if (p.useTime > 0 && !highAir) { u.limbs[3].rotation.set(-1.75, 0, .16); u.elbows[1].rotation.x = -.9; }
    if (emoteActive) {
      const duration = Math.max(.001, finite(p.emoteDuration, 6));
      const progress = clamp(1 - finite(p.emote, duration) / duration, 0, 1);
      applyEmote(u, emoteStyle(p), progress, t);
    }
    // v21 idle life: weight shifts, shoulder rolls and slow glances keep standing
    // characters alive — especially bots, which otherwise freeze between AI
    // decisions. Phase is seeded per player id so a squad never moves in sync.
    // v21 bot reactions: a flinch on damage taken and a celebration on a kill.
    let idSeed = 0; { const idStr = String(p.id || ''); for (let ci = 0; ci < idStr.length; ci++) idSeed = (idSeed * 31 + idStr.charCodeAt(ci)) | 0; }
    const seed = (idSeed % 1000) / 1000 * Math.PI * 2;
    const idleCalm = !airborne && moving < .06 && !blocked && !harvesting && !emoteActive;
    if (idleCalm) {
      const shift = Math.sin(t * .55 + seed);
      u.torso.position.x += shift * .02;
      u.torso.rotation.z += shift * .028;
      u.limbs[1].rotation.z -= .018 + Math.sin(t * 1.1 + seed) * .012;
      u.limbs[3].rotation.z += .018 + Math.sin(t * 1.1 + seed) * .012;
      if (!armed || u.presentationBlend < .3) {
        u.head.rotation.y += Math.sin(t * .34 + seed * 2.1) * .085;
        u.head.rotation.x += Math.sin(t * .47 + seed) * .02;
      }
    }
    if (!options.local) {
      const hpNow = finite(p.hp, 100);
      if (hpNow < finite(u.lastHp, 100) - .5 && !airborne) u.flinch = 1;
      u.lastHp = hpNow;
      u.flinch = Math.max(0, finite(u.flinch) - dt * 5);
      if (u.flinch > .001 && !blocked) {
        const fl = easeOutCubic(finite(u.flinch));
        u.torso.rotation.x -= fl * .22;
        u.torso.position.y -= fl * .06;
        u.head.rotation.y += fl * .38;
        u.limbs[1].rotation.z -= fl * .2; u.limbs[3].rotation.z += fl * .2;
      }
      const killsNow = finite(p.kills, 0);
      if (killsNow > finite(u.lastKills, 0)) u.cheer = 1.3;
      u.lastKills = killsNow;
      u.cheer = Math.max(0, finite(u.cheer) - dt);
      if (u.cheer > 0 && !airborne && !blocked) {
        const cw = easeInOut(Math.min(1, finite(u.cheer)));
        mixRotation(u.limbs[1], -2.65, 0, -.3, cw);
        mixRotation(u.limbs[3], -2.65, 0, .3, cw);
        u.torso.position.y += Math.abs(Math.sin(finite(u.cheer) * 9)) * .1 * cw;
        u.head.rotation.x -= cw * .18;
      }
    }
    // Locker and lobby portraits get a restrained authored idle instead of the
    // gameplay stand pose: relaxed weight shift, breathing shoulders and eye-line.
    // Equipment previews keep their functional poses and emotes remain untouched.
    const portraitIdle = !!options.menu && !emoteActive && !armed && !harvesting && !p.gliding && !options.buildType;
    if (portraitIdle) {
      const breathe = Math.sin(t * 1.45), glance = Math.sin(t * .47);
      u.torso.position.y += .018 + breathe * .012;
      u.torso.rotation.set(-.018 + breathe * .012, glance * .055, -.032);
      u.head.rotation.set(-.035 + Math.sin(t * .72) * .022, -glance * .12, .018);
      u.limbs[0].rotation.set(.09 + breathe * .025, 0, -.055);
      u.knees[0].rotation.x = -.11; u.limbs[2].rotation.set(-.055, 0, .08);
      u.knees[1].rotation.x = -.035;
      u.limbs[1].rotation.set(-.16 + breathe * .02, .02, -.16);
      u.elbows[0].rotation.x = -.28;
      u.limbs[3].rotation.set(.10 - breathe * .02, -.02, .13);
      u.elbows[1].rotation.x = -.46;
    }
    if (p.downed) { m.rotation.z = Math.PI / 2; m.rotation.x = 0; }
  };

  V.queueThumbnails = function (equipment = {}) {
    // Existing character cards keep data-avatar-thumb.  Generic item cards may opt
    // into the same real WebGL thumbnail via data-preview-thumb/data-preview-type.
    const canvases = [...new Set(Array.from(document.querySelectorAll('canvas[data-avatar-thumb],canvas[data-preview-thumb]')))];
    this.thumbnailQueue = canvases.map(canvas => ({
      canvas,
      type: canvas.dataset.previewType || canvas.dataset.previewThumb || '',
      equipment: { ...equipment, ...(canvas.dataset.avatarThumb ? { character: canvas.dataset.avatarThumb } : {}) },
    }));
    this.thumbnailCache ||= new Map();
  };
  V.renderOneThumbnail = function () {
    const item = this.thumbnailQueue?.shift(); if (!item || !item.canvas.isConnected) return;
    const { canvas, equipment, type = '' } = item, key = JSON.stringify({ equipment, type }); let image = this.thumbnailCache.get(key);
    if (!image) {
      this.thumbnailTarget ||= new T.WebGLRenderTarget(320, 430, { depthBuffer: true }); this.thumbnailTarget.texture.colorSpace = T.SRGBColorSpace;
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 320 / 430, .1, 15);
      scene.add(new T.HemisphereLight('#dcf7ff', '#3771a6', 1.65)); const light = new T.DirectionalLight('#fff4de', 2.05); light.position.set(3, 6, 5); scene.add(light);
      const rim = new T.DirectionalLight('#43cffe', 1.8); rim.position.set(-4, 3, -4); scene.add(rim);
      const model = A.avatar(equipment);
      // The item is a tangible part of the avatar rig in every thumbnail.  This is
      // especially important for gliders/backpacks/tools, which previously looked
      // like a generic character card.
      model.rotation.y = Math.PI + .25 + (type === 'back' ? Math.PI : 0);
      model.userData.gun.visible = type === 'wrap';
      model.userData.tool.visible = type === 'tool';
      model.userData.glider.visible = type === 'glider';
      if (type === 'glider') { model.userData.glider.scale.setScalar(.82); model.rotation.x = -.08; }
      if (type === 'tool') { model.userData.tool.rotation.set(-.9, 0, -.32); }
      scene.add(model);
      camera.position.set(0, 1.22, type === 'glider' ? 5.05 : 3.65); camera.lookAt(0, 1.02, 0); const previous = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.thumbnailTarget); this.renderer.render(scene, camera); const pixels = new Uint8Array(320 * 430 * 4);
      this.renderer.readRenderTargetPixels(this.thumbnailTarget, 0, 0, 320, 430, pixels); this.renderer.setRenderTarget(previous);
      image = new ImageData(320, 430); for (let y = 0; y < 430; y++) image.data.set(pixels.subarray(y * 1280, (y + 1) * 1280), (429 - y) * 1280);
      this.disposeTree(model); if (this.thumbnailCache.size > 24) this.thumbnailCache.clear(); this.thumbnailCache.set(key, image);
    }
    canvas.getContext('2d').putImageData(image, 0, 0); canvas.classList.add('is-ready');
  };
  const drawMenu = V.drawMenu;
  V.drawMenu = function (w, p, dt, opts) { drawMenu.call(this, w, p, dt, opts); this.renderOneThumbnail(); };
  V.shotDirection = function (p) {
    if (!p || !this.camera || !this.worldRef || this.worldRef.phase === 'transport') return {};
    const w = this.worldRef, ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(0, 0), this.camera);
    const d = ray.ray.direction, o = ray.ray.origin; let range = 400;
    if (w._rayObstacle) { const obstacle = w._rayObstacle(o.x, o.y, o.z, d, range); if (obstacle) range = obstacle.t; const terrain = w._terrainHit(o.x, o.y, o.z, d, range); if (terrain != null) range = terrain; }
    for (const q of w.players) { if (!q.alive || q.id === p.id || q.team === p.team || !q.deployed) continue; const hit = ray.ray.intersectBox(new T.Box3(new T.Vector3(q.x - .48, q.y, q.z - .48), new T.Vector3(q.x + .48, q.y + (q.crouching ? 1.4 : 1.9), q.z + .48)), new T.Vector3()); if (hit) range = Math.min(range, o.distanceTo(hit)); }
    const target = o.clone().addScaledVector(d, Math.max(1, range)); const aim = target.sub(new T.Vector3(p.x, p.y + (p.crouching ? 1.05 : 1.4), p.z));
    return { shotYaw: Math.atan2(-aim.x, -aim.z), shotPitch: Math.atan2(aim.y, Math.hypot(aim.x, aim.z)) };
  };

  // v21 build FX: destroyed player pieces crumble (dust + impact burst at the
  // piece) and damaged pieces shudder briefly. Tracks the view's build meshes
  // per id without touching view.js; zero per-frame allocation.
  const buildFxState = new Map();
  function v21BuildFx(w, dt) {
    if (!w || !w.builds || !this.builds || !this.scene || !A.fx) return;
    const seen = buildFxState, now = (this.time || 0) * 1000;
    for (const b of w.builds) {
      let st = seen.get(b.id);
      if (!st) { seen.set(b.id, { hp: b.hp, shake: 0, dead: !!b.dead }); continue; }
      if (!st.dead && b.dead) {
        st.dead = true; st.shake = 0;
        origin.set(b.x, b.y + 1, b.z);
        A.fx.spawnDust(this.scene, origin, 0xcfc4ae, A.fx.mobile ? 6 : 12, .6, .8);
        A.fx.spawnImpact(this.scene, origin, 0xd8e2e6);
      } else if (!b.dead && b.hp < st.hp - 1) st.shake = 1;
      st.hp = b.hp;
      if (st.shake > 0 && !b.dead) {
        st.shake = Math.max(0, st.shake - dt * 5);
        const m = this.builds.get(b.id);
        if (m) {
          // buildModel bakes the piece position into the mesh: jitter relative
          // to that base, then restore exactly.
          if (st.bx === undefined) { st.bx = m.position.x; st.by = m.position.y; st.bz = m.position.z; }
          const j = Math.sin(now * .09 + b.x) * .07 * st.shake;
          m.position.set(st.bx + j, st.by + Math.abs(j) * .5, st.bz - j * .7);
          if (st.shake <= 0) { m.position.set(st.bx, st.by, st.bz); st.bx = undefined; }
        }
      }
    }
    if (seen.size > 500) {
      const alive = {};
      for (const b of w.builds) alive[b.id] = 1;
      for (const id of seen.keys()) if (!alive[id]) seen.delete(id);
    }
  }
  const baseViewUpdate = V.update;
  V.update = function (w, p, dt, opts) {
    const result = baseViewUpdate.call(this, w, p, dt, opts);
    v21BuildFx.call(this, w, dt);
    return result;
  };
})(window);
