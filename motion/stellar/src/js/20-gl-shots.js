// =====================================================================================================
//  3D shots: which 3D scene renders at time t, and where its camera is. Returns false when no 3D pass.
// =====================================================================================================
starGroup.visible = false;
function glSpace(t, o = {}) {
  nebMat.uniforms.uT.value = t; nebMat.uniforms.uHue.value = o.hue || 0; nebMat.uniforms.uBright.value = o.bright ?? 1;
  starMat.uniforms.uT.value = t; starMat.uniforms.uA.value = o.starA ?? 1;
  streakMat.uniforms.uWarp.value = o.warp || 0; streakMat.uniforms.uZ.value = o.z || 0;
  streaks.visible = (o.warp || 0) > .001;
  starGroup.visible = !!o.star;
  const yaw = o.yaw ?? t * .02, pitch = o.pitch ?? .05;
  const p = o.pos || V(0, 0, 0);
  camLook(spaceCam, p, V(p.x + Math.sin(yaw) * Math.cos(pitch) * -100, p.y + Math.sin(pitch) * 100, p.z - Math.cos(yaw) * Math.cos(pitch) * 100), o.roll || 0);
  spaceCam.fov = o.fov || 60; spaceCam.updateProjectionMatrix();
  if (!o.defer) render(space, spaceCam);
}
// the star emblem, placed relative to the space camera (so it sits at a fixed screen spot)
function placeStar(dist, sx, sy, scale, rotY, rotZ = 0) {
  // screen-space offset (sx, sy in -1..1) at distance dist in front of the camera
  const cam = spaceCam, f = Math.tan(cam.fov * Math.PI / 360) * dist;
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
  const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize(), up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  starGroup.position.copy(cam.position).addScaledVector(fwd, dist).addScaledVector(right, sx * f * cam.aspect).addScaledVector(up, sy * f);
  starGroup.quaternion.copy(cam.quaternion);
  starGroup.rotateY(rotY); starGroup.rotateZ(rotZ);
  starGroup.scale.setScalar(scale);
  spaceKey.position.copy(cam.position).addScaledVector(up, 4).addScaledVector(right, 3);
}

function busAt(t) { // global time -> bus world position & attitude during the bus shot
  const k = seg(t, S.bus[0] - .2, S.bus[1] + .4);
  return { p: V(lerp(-150, 40, k), 72 + Math.sin(t * 1.3) * 1.2, lerp(30, -10, k)), roll: Math.sin(t * 1.1) * .05, yaw: -.18 };
}
function poseBus(b, t) { bus.position.copy(b.p); bus.rotation.set(0, b.yaw, b.roll); const thr = bus.getObjectByName('thr'); thr.scale.set(1, .8 + .4 * hash(Math.floor(t * 30)), 1); }

function glShot(t) {
  waterMat.uniforms.uT.value = t; skyMat.uniforms.uT.value = t;
  // ---------------------------------------------------------------- intro: space push, warp out
  if (t < S.intro[1]) {
    const w = io(seg(t, 3.0, 4.0));
    glSpace(t, { yaw: -.25 + t * .03, pitch: .08 - t * .01, pos: V(0, 0, -t * 6 - w * w * 260), warp: w * 3.2, z: w * w * 900, starA: 1 - w * .6, fov: 60 + w * 25 });
    return true;
  }
  // ---------------------------------------------------------------- the battle bus over the island (day)
  if (t < S.secret[0]) {
    DAY(); showOnly(bus, clouds);
    const b = busAt(t); poseBus(b, t);
    const lt0 = lt(t, 'bus');
    // shot A: close follow in the clouds, swing around the bus; shot B: crane up and tilt down to the island
    const a = io(seg(lt0, 0, 1.7)), c = io5(seg(lt0, 1.45, 3.9));
    const pA = V(b.p.x - 40 + a * 46, b.p.y + 14 + a * 6, b.p.z + 46 - a * 8);
    const dr = Math.max(0, lt0 - 3.9), pB = V(b.p.x + 40 - dr * 10, 175 - dr * 8, b.p.z + 120 - dr * 6);
    const look = lerpV(V(b.p.x, b.p.y + 13, b.p.z), V(b.p.x * .2, 0, 0), c);
    camLook(isleCam, lerpV(pA, pB, c), look, Math.sin(lt0 * .8) * .03 * (1 - c));
    isleCam.fov = 50 + c * 6; isleCam.updateProjectionMatrix();
    render(isle, isleCam); return true;
  }
  // ---------------------------------------------------------------- TOP SECRET: 2D only (dark)
  if (t < S.midas[0]) return false;
  // ---------------------------------------------------------------- Midas + POI tour (top-down over the island)
  if (t < S.poi[1]) {
    DAY(); showOnly(t < S.poi[0] ? null : clouds);
    const keys = ['agency', 'yacht', 'shark', 'rig'];
    if (t < S.poi[0]) {   // Midas: slow high orbit above the centre
      const k = lt(t, 'midas');
      camLook(isleCam, V(Math.sin(k * .2) * 30, 240 - k * 10, 150), V(0, 0, -10));
    } else {
      const k = lt(t, 'poi'); let i = 0; while (i < 3 && k >= CARD_T[i + 1]) i++;
      const f = k - CARD_T[i];
      // each spoken name: a quick whip from the previous POI to this one, then a slow drift
      const prev = i === 0 ? V(0, 0, -10) : POI_POS(keys[i - 1]), cur = POI_POS(keys[i]);
      const m = io5(seg(f, 0, .26)), tgt = lerpV(prev, cur, m);
      const off = V(18 + f * 7, 46 - f * 7, 52 - f * 9);
      camLook(isleCam, tgt.clone().add(off), tgt);
    }
    isleCam.fov = 50; isleCam.updateProjectionMatrix();
    render(isle, isleCam); return true;
  }
  // ---------------------------------------------------------------- Fantôme / Ombre: 2D only
  if (t < S.fade[0]) return false;
  // ---------------------------------------------------------------- the memory (polaroid of the island)
  if (t < S.fade[1]) {
    DAY(); showOnly(bus);
    const b = { p: V(-10, 44, 30), roll: .03, yaw: -.3 }; poseBus(b, t);
    camLook(isleCam, V(50, 46, 110), V(-14, 26, 10)); isleCam.fov = 50; isleCam.updateProjectionMatrix();
    render(isle, isleCam); return 'memory';
  }
  // ---------------------------------------------------------------- DROP: the Stellar star
  if (t < S.logo[1]) {
    const k = lt(t, 'logo'), burst = Math.exp(-k / .35);
    glSpace(t, { yaw: .4 + k * .02, pitch: .02, warp: burst * 2.2, z: k * 300, bright: 1.15, star: true, hue: .4, defer: true });
    const land = spring(k - .02, 120, .74), sc = lerp(.05, 1.75, land);
    placeStar(14, 0, .28, sc, (1 - land) * TAU * 2 + Math.sin(k * 1.6) * .32, (1 - land) * -.8 + Math.sin(k * 1.1) * .06);
    render(space, spaceCam); return true;
  }
  // ---------------------------------------------------------------- OG: dusk flyover with the bus far away
  if (t < S.og[1]) {
    DUSK(); showOnly(bus, clouds);
    const k = lt(t, 'og');
    poseBus({ p: V(-60 + k * 9, 95, -150), roll: .02, yaw: -.1 }, t);
    camLook(isleCam, V(-120 + k * 16, 24 + k * 2.5, 140 - k * 14), V(-20 + k * 10, 18, -40), -.04);
    isleCam.fov = 52; isleCam.updateProjectionMatrix();
    render(isle, isleCam); return true;
  }
  // ---------------------------------------------------------------- features: calm nebula
  if (t < S.feat[1]) {
    const k = lt(t, 'feat');
    glSpace(t, { yaw: 1.2 + k * .025, pitch: -.05, bright: .8, hue: .2, starA: .9 });
    return true;
  }
  // ---------------------------------------------------------------- skydive through the clouds
  if (t < S.jump[1]) {
    DAY(); showOnly(diveClouds, diver); isle.fog.near = 400; isle.fog.far = 2200;
    const k = lt(t, 'jump'), y = 330 - k * 95 - k * k * 22;
    diver.position.set(Math.sin(k * 2) * .6, y - 11.5, 2.2 + Math.cos(k * 1.7) * .4); diver.rotation.set(-Math.PI / 2 + .2, Math.sin(k * 1.3) * .25, Math.sin(k * 3) * .12);
    const roll = k * .45;
    isleCam.position.set(0, y, 6); isleCam.up.set(Math.sin(roll), 0, -Math.cos(roll)); isleCam.lookAt(0, y - 40, 0);
    isleCam.fov = 62; isleCam.updateProjectionMatrix();
    render(isle, isleCam); return true;
  }
  // ---------------------------------------------------------------- build: blueprint pieces snapping in
  if (t < S.build[1]) {
    const k = lt(t, 'build');
    PIECES.forEach((pc, i) => {
      const o = pieceObjs[i], a = k - pc[5], pop = spring(a, 380, .62), solid = io(seg(a, .1, .3));
      o.holder.visible = a > 0;
      o.g.scale.setScalar(Math.max(.001, lerp(.6, 1, pop)));
      o.solid.material.opacity = solid; o.ghost.material.opacity = .28 * (1 - solid) + .9 * pulse(a, 0, .1);
      o.edges.material.opacity = 1 - solid * .7; o.gl.material.opacity = .5 * (1 - solid);
    });
    const ang = -.7 + k * .35;
    camLook(buildCam, V(Math.sin(ang) * 26, 9 + k * 2.2, Math.cos(ang) * 26), V(0, 5 + k, 0));
    render(buildScene, buildCam); return true;
  }
  // ---------------------------------------------------------------- top 1: golden nebula
  if (t < S.top1[1]) {
    const k = lt(t, 'top1');
    glSpace(t, { yaw: 2.4 + k * .05, pitch: .1, bright: .7, hue: 1, starA: 1 });
    return true;
  }
  // ---------------------------------------------------------------- l'île t'attend: sunset establishing
  if (t < S.isle[1]) {
    DUSK(); showOnly(clouds);
    const k = lt(t, 'isle');
    camLook(isleCam, V(40 - k * 5, 14 + k * 3, 330 - k * 22), V(-10, 12, 0)); isleCam.fov = 42; isleCam.updateProjectionMatrix();
    render(isle, isleCam); return true;
  }
  // ---------------------------------------------------------------- end card: the star over the nebula
  const k = lt(t, 'end');
  glSpace(t, { yaw: .4 + k * .015, pitch: .02, bright: 1, star: true, hue: .4, defer: true });
  const land = spring(k, 90, .8);
  placeStar(14, 0, .4, lerp(.3, 1.25, land), (1 - land) * TAU + Math.sin(k * .9) * .35, Math.sin(k * .7) * .05);
  render(space, spaceCam); return true;
}
