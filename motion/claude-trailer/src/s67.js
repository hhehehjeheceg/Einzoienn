// Scenes 6-7: everything converges into a monumental composition, bursts in slow motion, then the signature.
import * as THREE from "three";
import { CUES } from "./cues.js";
import { clamp, prog, smooth, io, out3, out5, outExpo, inExpo, spring, mulberry32, TAU } from "./lib.js";
import { makeDust, makeGlow, makeRing, makeRays, bokehUniforms, BOKEH_VS, BOKEH_FS } from "./fx.js";
import { makeSpark, SYMBOL } from "./s12.js";
import { V, W } from "./world.js";

const C6 = CUES.s6, C7 = CUES.s7;

// dispersion clock: fast burst, long slow motion, then a hard acceleration (numerically integrated once)
const TAU_T0 = C6.burst, TAU_DT = 1 / 600;
const TAU_TABLE = (() => {
  const speed = (t) => {
    const a = smooth((t - C6.burst) / 0.06);
    const slow = smooth((t - C6.slow0 + 0.08) / 0.16);
    const fast = Math.pow(clamp((t - C6.slow1) / 0.6), 2);
    return a * (1.1 * (1 - slow) + 0.11 * slow) + fast * 2.9;
  };
  const arr = [0];
  for (let t = TAU_T0; t < 26.2; t += TAU_DT) arr.push(arr[arr.length - 1] + speed(t) * TAU_DT);
  return arr;
})();
export const disperse = (t) => (t <= TAU_T0 ? 0 : TAU_TABLE[Math.min(TAU_TABLE.length - 1, Math.floor((t - TAU_T0) / TAU_DT))]);

export function buildClimax(ctx, ui, lab, tw, camAt) {
  const { scene, M } = ctx;
  const C = W.climax;
  const group = new THREE.Group();
  group.position.copy(C);
  scene.add(group);
  const rnd = mulberry32(606);
  const randDir = () => { const u = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - u * u); return V(s * Math.cos(a), u, s * Math.sin(a)); };
  const camEnd = camAt(25.0).pos.clone().sub(C); // camera position (relative) while things fly past
  // incoming objects never cross the lens: mirror any approach direction that faces the camera
  const camDirs = [22.0, 22.5, 23.0].map((k) => camAt(k).pos.clone().sub(C).normalize());
  const away = (d) => { d = d.clone().normalize(); camDirs.forEach((c) => { const k = d.dot(c); if (k > -0.2) d.addScaledVector(c, -(k + 0.45)).normalize(); }); return d; };

  // central symbol
  const spark = makeSpark(M);
  spark.group.scale.setScalar(2.1);
  group.add(spark.group);
  const sparkFl = spark.parts.map((m, i) => ({ from: SYMBOL.geos[i].home.clone().add(away(randDir()).multiplyScalar(9 + rnd() * 6)), rot: randDir().multiplyScalar(6), t0: C6.conv0 + 0.15 + i * 0.06 }));

  // movers: everything that converges then bursts
  const movers = [];
  const addMover = (obj, home, opts = {}) => {
    group.add(obj);
    const dir = opts.dir || home.clone().normalize().add(randDir().multiplyScalar(0.35)).normalize();
    movers.push({ obj, home, from: opts.from || away(home.clone().normalize().add(randDir().multiplyScalar(0.3))).multiplyScalar(26 + rnd() * 14),
      dir, dist: opts.dist || 16 + rnd() * 22, spin: randDir().multiplyScalar(opts.spin ?? 3 + rnd() * 6), baseRot: opts.baseRot || new THREE.Euler(),
      t0: opts.t0 ?? C6.conv0 + rnd() * 0.5, dur: opts.dur ?? 0.9 + rnd() * 0.4, scale: opts.scale ?? 1 });
  };
  // interface panels on an outer ring
  ui.panels.forEach((P, i) => {
    const a = (i / 5) * TAU + 0.3;
    const home = V(Math.cos(a) * 6.4, Math.sin(a * 2) * 1.2, Math.sin(a) * 6.4);
    const h = new THREE.Group();
    const m = new THREE.Mesh(P.mesh.geometry, P.mat);
    m.scale.setScalar(0.85);
    h.add(m);
    const look = new THREE.Matrix4().lookAt(home.clone().multiplyScalar(2), home, V(0, 1, 0));
    addMover(h, home, { baseRot: new THREE.Euler().setFromRotationMatrix(look), spin: 1.5 + rnd() * 2, t0: C6.conv0 + 0.1 * i });
  });
  // the skill modules
  lab.mods.forEach((md, i) => {
    const a = (i / 6) * TAU;
    const home = V(Math.cos(a) * 4.4, (i % 2 ? 1 : -1) * 1.6, Math.sin(a) * 4.4);
    const c = md.obj.g.clone();
    c.scale.setScalar(0.8);
    addMover(c, home, { t0: C6.conv0 + 0.25 + i * 0.07 });
  });
  // metal and coral shards
  const shardGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.025, 3);
  const shardMats = [M.chrome, M.coral];
  const shards = shardMats.map((mat, j) => new THREE.InstancedMesh(shardGeo, mat, j ? 70 : 130));
  const shardData = [];
  shards.forEach((im, j) => {
    group.add(im);
    for (let i = 0; i < im.count; i++) {
      const d = randDir();
      const home = d.clone().multiplyScalar(2.0 + Math.pow(rnd(), 0.7) * 6.5);
      const close = i < 7 && j === 0;
      const target = camEnd.clone().add(V((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.0 + 0.4, 0));
      shardData.push({ im, i, home, from: away(d).multiplyScalar(24 + rnd() * 20),
        dir: close ? target.clone().sub(home).normalize() : home.clone().normalize().add(randDir().multiplyScalar(0.4)).normalize(),
        dist: close ? target.distanceTo(home) * (1.15 + rnd() * 0.2) : 14 + rnd() * 30,
        rot: V(rnd() * TAU, rnd() * TAU, rnd() * TAU), spin: randDir().multiplyScalar(4 + rnd() * 10),
        t0: C6.conv0 + rnd() * 0.8, dur: 0.7 + rnd() * 0.5, s: 0.5 + rnd() * 1.4 });
    }
  });
  // particle cloud
  const NP = 6000;
  const pg = new THREE.BufferGeometry();
  const aHome = new Float32Array(NP * 3), aFrom = new Float32Array(NP * 3), aDir = new Float32Array(NP * 4), col = new Float32Array(NP * 3);
  const pc = ["#ff8a5c", "#ffb547", "#ffe2cf", "#62c6ff", "#a492ff", "#41d3c4"].map((c) => new THREE.Color(c));
  for (let i = 0; i < NP; i++) {
    const d = randDir();
    aHome.set(d.clone().multiplyScalar(1.4 + Math.pow(rnd(), 0.5) * 8).toArray(), i * 3);
    aFrom.set(d.clone().multiplyScalar(30 + rnd() * 20).add(randDir().multiplyScalar(5)).toArray(), i * 3);
    const dd = d.clone().add(randDir().multiplyScalar(0.3)).normalize();
    aDir.set([dd.x, dd.y, dd.z, rnd()], i * 4);
    const c = pc[i % 9 < 6 ? Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 3)];
    col.set([c.r, c.g, c.b], i * 3);
  }
  pg.setAttribute("position", new THREE.BufferAttribute(aHome, 3));
  pg.setAttribute("aFrom", new THREE.BufferAttribute(aFrom, 3));
  pg.setAttribute("aDir", new THREE.BufferAttribute(aDir, 4));
  pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const cloud = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: { ...bokehUniforms(), uConv: { value: 0 }, uTau: { value: 0 }, uWave: { value: -1 }, uT: { value: 0 }, uSize: { value: 0.045 }, uO: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aFrom; attribute vec4 aDir; uniform float uConv, uTau, uWave, uT, uSize;
      varying vec3 vCol; varying float vA, vCoc;
      ${BOKEH_VS}
      void main(){
        float c = clamp((uConv - aDir.w * 0.35) / 0.65, 0.0, 1.0); c = 1.0 - pow(1.0 - c, 3.0);
        vec3 p = mix(aFrom, position, c);
        float sw = sin(uT * 0.7 + aDir.w * 6.28) * 0.08;
        p += vec3(sw, -sw, sw);
        p += aDir.xyz * uTau * (12.0 + aDir.w * 34.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float coc; gl_PointSize = bokeh(mv, uSize * (0.5 + aDir.w), coc);
        vCoc = coc;
        float wave = uWave > 0.0 ? exp(-pow((length(p) - uWave) * 0.9, 2.0)) * 2.5 : 0.0;
        vCol = color * (1.0 + wave);
        vA = smoothstep(0.0, 0.3, c) / (1.0 + coc * coc * 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA, vCoc; uniform float uO; ${BOKEH_FS}
      void main(){ float a = disc(gl_PointCoord, vCoc) * vA * uO; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a * 0.9, a); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  cloud.frustumCulled = false;
  group.add(cloud);
  const wave = makeRing("#ffd2b8");
  group.add(wave);
  const centerGlow = makeGlow("#ff7a4d", 10, 0);
  group.add(centerGlow);
  const bgGlows = [["#ff7a4d", V(-16, 6, -20), 34], ["#6d5cff", V(18, -4, -16), 30], ["#41d3c4", V(0, -10, -24), 30]].map(([c, p, s]) => { const g = makeGlow(c, s, 0); g.position.copy(p); group.add(g); return g; });

  // ---- scene 7: the signature
  const sig = new THREE.Group();
  group.add(sig);
  const spark7 = makeSpark(M);
  sig.add(spark7.group);
  const sig7 = spark7.parts.map((m, i) => ({ off: randDir().multiplyScalar(0.5 + rnd() * 0.5), rot: randDir().multiplyScalar(0.9), d: i * 0.035 }));
  const rays7 = makeRays("#ff8a5c");
  rays7.scale.set(12, 12, 1); rays7.position.set(0, 0, -1.2);
  sig.add(rays7);
  const glow7 = makeGlow("#ff7a4d", 6, 0);
  glow7.position.z = -0.6;
  sig.add(glow7);
  const ring7 = makeRing("#ffd9c4");
  sig.add(ring7);
  const motes = makeDust({ n: 900, box: [16, 9, 10], seed: 77, colors: ["#ffd2b8", "#ffb08a"], size: 0.04, opacity: 0.5 });
  sig.add(motes);

  function update(t, cam) {
    const vis = t > C6.conv0 - 0.05;
    group.visible = vis;
    if (!vis) return;
    const tau = disperse(t);
    const conv = clamp((t - C6.conv0) / 1.25);
    const pulse = t - C6.pulse;
    const wr = pulse > 0 ? pulse * 26 : -1;
    const climaxOn = t < C6.cut + 0.3;

    // central symbol assembles, then explodes too
    spark.group.visible = climaxOn;
    spark.parts.forEach((m, i) => {
      const f = sparkFl[i], h = SYMBOL.geos[i].home;
      const e = out5((t - f.t0) / 0.75);
      m.position.lerpVectors(f.from, h, e);
      const d = h.clone().normalize();
      m.position.addScaledVector(V(d.x, d.y, 0.4).normalize(), tau * 20);
      m.rotation.set(f.rot.x * (1 - e) + tau * 4 * (i % 3), f.rot.y * (1 - e) + tau * 3, f.rot.z * (1 - e));
    });
    spark.group.rotation.y = Math.sin(t * 0.8) * 0.2 + (t - C6.conv0) * 0.25;
    M.coral.emissiveIntensity = Math.max(M.coral.emissiveIntensity, pulse > 0 && t < 26 ? 1.6 * Math.exp(-pulse * 2.5) : 0);

    movers.forEach((m) => {
      m.obj.visible = climaxOn && t > m.t0 + 0.02;
      const e = io((t - m.t0) / m.dur);
      m.obj.position.lerpVectors(m.from, m.home, e).addScaledVector(m.dir, tau * m.dist);
      m.obj.rotation.set(m.baseRot.x + m.spin.x * (tau + (1 - e) * 0.6), m.baseRot.y + m.spin.y * (tau + (1 - e) * 0.6) + (t - C6.conv0) * 0.15, m.baseRot.z + m.spin.z * tau);
      m.obj.scale.setScalar(m.scale * Math.max(0.01, smooth((t - m.t0) / 0.3)));
    });
    // tower slabs leave the tower and form a halo
    const L = W.climax.clone().sub(W.tower); // halo centre in tower space
    tw.slabs.forEach((s, i) => {
      if (t < C6.conv0) return;
      const e = io((t - C6.conv0 - s.k * 0.35) / 0.95);
      const a = (i / tw.slabs.length) * TAU;
      const ring = V(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3).applyAxisAngle(V(1, 0, 0), 0.5).applyAxisAngle(V(0, 0, 1), 0.25).add(L);
      const d = ring.clone().sub(L).normalize();
      s.mesh.visible = climaxOn;
      s.mesh.position.lerpVectors(s.home.pos, ring, e).addScaledVector(d, tau * (18 + (i % 5) * 5));
      s.mesh.rotation.set(e * (1.2 + tau * 6 * ((i % 3) - 1)), s.home.rotY + e * a + tau * 5, e * 0.5);
      s.mesh.scale.setScalar(1 - 0.55 * e);
    });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), eu = new THREE.Euler();
    shardData.forEach((s) => {
      const e = out3((t - s.t0) / s.dur);
      p.lerpVectors(s.from, s.home, e).addScaledVector(s.dir, tau * s.dist);
      const sp = (1 - e) * 2 + tau;
      eu.set(s.rot.x + s.spin.x * sp, s.rot.y + s.spin.y * sp + t * 0.3, s.rot.z + s.spin.z * sp);
      q.setFromEuler(eu);
      sc.setScalar(Math.max(0.01, s.s * smooth((t - s.t0) / 0.25)));
      s.im.setMatrixAt(s.i, m4.compose(p, q, sc));
    });
    shards.forEach((im) => { im.instanceMatrix.needsUpdate = true; im.visible = climaxOn; });
    const cu = cloud.material.uniforms;
    cu.uConv.value = conv; cu.uTau.value = tau; cu.uWave.value = wr; cu.uT.value = t;
    cu.uO.value = 1 - smooth((t - 25.0) / 0.6);
    cloud.visible = t < 26.0;
    wave.visible = pulse > 0 && pulse < 1.2;
    wave.quaternion.copy(cam.quaternion);
    wave.material.uniforms.uR.value = wr; wave.material.uniforms.uW.value = 0.3 + pulse * 1.5; wave.material.uniforms.uI.value = 1.6 * Math.pow(1 - clamp(pulse / 1.2), 2);
    centerGlow.material.opacity = (0.35 * smooth(conv) + 1.4 * (pulse > 0 ? Math.exp(-pulse * 3) : 0)) * (1 - smooth((t - 24.0) / 1.2));
    bgGlows.forEach((g) => (g.material.opacity = 0.14 * smooth((t - 22.0) / 0.8) * (1 - smooth((t - 24.8) / 0.8))));

    // ---- signature
    const s7 = t - C7.symbol;
    sig.visible = s7 > -0.2;
    if (!sig.visible) return;
    const up = io((t - C7.word + 0.1) / 0.8);
    spark7.group.position.set(0, 0.28 + 0.55 * up, 0);
    spark7.group.scale.setScalar(1.18 - 0.26 * up);
    spark7.group.rotation.set(Math.sin(t * 0.5) * 0.05, Math.sin(t * 0.6 + 0.5) * 0.16, 0);
    spark7.parts.forEach((m, i) => {
      const f = sig7[i], h = SYMBOL.geos[i].home;
      const e = out5((s7 - f.d) / 1.1);
      m.position.set(h.x + f.off.x * (1 - e), h.y + f.off.y * (1 - e), f.off.z * (1 - e) * 2);
      m.rotation.set(f.rot.x * (1 - e), f.rot.y * (1 - e), f.rot.z * (1 - e));
      m.scale.setScalar(Math.max(0.001, smooth((s7 - f.d) / 0.5)));
    });
    const fin = t - C7.final;
    if (t > 25.9) M.coral.emissiveIntensity = 0.06 + 0.25 * smooth(s7 / 0.8) * (1 - 0.6 * smooth((s7 - 1) / 0.8)) + (fin > 0 ? 1.1 * Math.exp(-fin * 2.2) : 0);
    rays7.quaternion.copy(cam.quaternion);
    rays7.position.y = spark7.group.position.y;
    rays7.material.uniforms.uT.value = t;
    rays7.material.uniforms.uI.value = 0.18 * smooth(s7 / 1.0) + (fin > 0 ? 0.7 * Math.exp(-fin * 2.5) : 0);
    glow7.position.y = spark7.group.position.y;
    glow7.material.opacity = 0.16 * smooth(s7 / 0.8) + (fin > 0 ? 0.5 * Math.exp(-fin * 2) : 0);
    ring7.visible = fin > 0 && fin < 1.3;
    ring7.position.y = spark7.group.position.y;
    ring7.quaternion.copy(cam.quaternion);
    ring7.material.uniforms.uR.value = 0.6 + 7 * out3(fin / 1.3); ring7.material.uniforms.uW.value = 0.08 + fin * 0.25; ring7.material.uniforms.uI.value = 1.2 * Math.pow(1 - clamp(fin / 1.3), 2);
    motes.material.uniforms.uT.value = t;
    motes.material.uniforms.uOpacity.value = 0.45 * smooth(s7 / 1.0);
    // sheen: a light crossing the symbol
    const sh = prog(t, C7.sheen, C7.sheen + 0.75);
    const lp = ctx.L.p[2];
    lp.position.copy(C).add(V(-3 + 6 * io(sh), spark7.group.position.y + 0.6, 2.2));
    lp.color.set("#fff1e6");
    lp.intensity = 30 * Math.sin(Math.PI * sh);
  }
  return { group, update, spark7 };
}
