// Scenes 1-2: the awakening (particles become the symbol) and the reveal (3D symbol + CLAUDE).
import * as THREE from "three";
import { CUES } from "./cues.js";
import { clamp, prog, smooth, io, out3, out5, outExpo, spring, keys, mulberry32, TAU } from "./lib.js";
import { symbolOutline, symbolRays, rayGeometries, sampleSymbol, wordGeometries } from "./shapes.js";
import { makeDust, makeGlow, makeRays, makeRing, bokehUniforms, BOKEH_VS, BOKEH_FS } from "./fx.js";
import { V, W } from "./world.js";

const C1 = CUES.s1, C2 = CUES.s2;
export const SA = 2.0;                 // symbol scale while it assembles
export const LC = V(0, 0.1, 0);        // symbol centre while it assembles
export const SPARK_FINAL = { pos: V(0, 0.78, 0), scale: 1.05 };
export const LETTERS_Y = -1.55;

// shared symbol data (also used by the lab core and the finale)
export const SYMBOL = (() => {
  const pts = symbolOutline();
  const rays = symbolRays(pts);
  const geos = rayGeometries(rays);
  // order: clockwise from the top
  geos.sort((a, b) => ((Math.PI / 2 - a.angle + 4 * Math.PI) % TAU) - ((Math.PI / 2 - b.angle + 4 * Math.PI) % TAU));
  return { pts, rays, geos };
})();

export function makeSpark(M, faceMat) {
  const g = new THREE.Group();
  const parts = SYMBOL.geos.map((r) => {
    const m = new THREE.Mesh(r.geo, [faceMat || M.coral, M.chrome]);
    m.position.copy(r.home);
    g.add(m);
    return m;
  });
  return { group: g, parts };
}

// ---------------------------------------------------------------- scene 1 particle system
function makeParticles() {
  const N = 16000;
  const rnd = mulberry32(42);
  const logo = sampleSymbol(SYMBOL.pts, N, rnd);
  const A = { aLogo: new Float32Array(N * 3), aOrb: new Float32Array(N * 4), aOrb2: new Float32Array(N * 4), aTime: new Float32Array(N * 4), color: new Float32Array(N * 3) };
  const cols = ["#ff8a5c", "#ffb547", "#ffe2cf", "#f2c27b", "#ff7a4d"].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const [lx, ly] = logo[i];
    A.aLogo.set([LC.x + lx * SA, LC.y + ly * SA, (rnd() - 0.5) * 0.08 * SA], i * 3);
    const u = rnd();
    const type = u < 0.48 ? 0 : u < 0.86 ? 1 : 2;
    const R = type === 0 ? 2.3 + rnd() * 0.9 : type === 1 ? 1.45 + rnd() * 0.3 : 0.25 + rnd() * 0.5;
    const speed = (type === 0 ? 0.35 + rnd() * 0.25 : type === 1 ? 0.22 : 0.9) * (rnd() < 0.5 ? 1 : 1);
    A.aOrb.set([type, R, rnd() * TAU, speed], i * 4);
    A.aOrb2.set([Math.floor(rnd() * 3), Math.acos(1 - 2 * rnd()), (rnd() - 0.5), rnd()], i * 4);
    const rank = clamp(R / 3.2 * 0.75 + rnd() * 0.25);
    const ang = Math.atan2(ly, lx);
    const sweep = ((Math.PI / 2 - ang + 4 * Math.PI) % TAU) / TAU;
    A.aTime.set([C1.spawn0 + 1.15 * Math.pow(rank, 1.2), C1.pulse2 + 0.05 + 0.42 * sweep + rnd() * 0.12, rnd(), 0.6 + rnd() * 0.9], i * 4);
    const c = cols[Math.floor(rnd() * cols.length)];
    A.color.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  Object.entries(A).forEach(([k, v]) => g.setAttribute(k, new THREE.BufferAttribute(v, k === "aLogo" || k === "color" ? 3 : 4)));
  const ringBasis = [[0.3, 1, 0.2], [1, 0.25, 0.4], [-0.5, 0.45, 1]].map((n) => {
    const nn = V(...n).normalize();
    const u = V(0, 1, 0).cross(nn).normalize();
    if (u.lengthSq() < 0.01) u.set(1, 0, 0);
    const v = nn.clone().cross(u).normalize();
    return new THREE.Matrix3().set(u.x, v.x, nn.x, u.y, v.y, nn.y, u.z, v.z, nn.z);
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...bokehUniforms(), uT: { value: 0 }, uRing: { value: ringBasis }, uP1: { value: -1 }, uP2: { value: -1 }, uSize: { value: 0.027 }, uGlobal: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aLogo; attribute vec4 aOrb, aOrb2, aTime;
      uniform float uT, uSize, uP1, uP2; uniform mat3 uRing[3];
      varying vec3 vCol; varying float vA, vCoc;
      ${BOKEH_VS}
      vec3 structPos(float t) {
        float type = aOrb.x, R = aOrb.y, ph = aOrb.z + aOrb.w * t;
        if (type < 0.5) {
          int idx = int(aOrb2.x);
          vec3 p = vec3(cos(ph) * R, sin(ph) * R, aOrb2.z * 0.18);
          return idx == 0 ? uRing[0] * p : idx == 1 ? uRing[1] * p : uRing[2] * p;
        }
        float th = aOrb2.y;
        return R * vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
      }
      void main() {
        float t = uT;
        float born = clamp((t - aTime.x) / 0.55, 0.0, 1.0);
        float be = 1.0 - pow(1.0 - born, 3.0);
        vec3 p = structPos(t) * be;
        // second impulse: accelerate into the symbol along an arc
        float m = clamp((t - aTime.y) / 0.72, 0.0, 1.0);
        float me = 1.0 - pow(1.0 - m, 4.0);
        vec3 arc = vec3(-p.y, p.x, 0.6) * sin(m * 3.14159) * 0.35;
        p = mix(p, aLogo, me) + arc;
        // after it formed: a faint breathing
        p += vec3(0.0, 0.0, sin(t * 2.0 + aOrb2.w * 6.28) * 0.02) * me;
        // scene 2: the particles blow outward and fade while the solid fragments arrive
        float b = clamp((t - ${CUES.s2.burst.toFixed(2)}) / 1.5, 0.0, 1.0);
        float bo = 1.0 - pow(1.0 - b, 3.0);
        vec3 dir = normalize(vec3(aLogo.xy - vec2(0.0, 0.1), (aOrb2.w - 0.5) * 2.4) + 1e-4);
        p += dir * bo * (2.0 + aTime.z * 6.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float coc; gl_PointSize = bokeh(mv, uSize * aTime.w, coc);
        vCoc = coc;
        float r = length(p);
        float glow = 0.0;
        if (uP1 > 0.0) glow += exp(-pow((r - uP1) * 2.5, 2.0)) * 1.6;
        if (uP2 > 0.0) glow += exp(-pow((r - uP2) * 2.0, 2.0)) * 2.2;
        vCol = mix(color, vec3(1.0, 0.92, 0.85), clamp(glow * 0.5, 0.0, 0.8)) * (1.0 + glow) * (1.0 + me * 0.35);
        vA = smoothstep(0.0, 0.25, born) * (1.0 - smoothstep(0.25, 1.0, b)) / (1.0 + coc * coc * 3.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA, vCoc; uniform float uGlobal;
      ${BOKEH_FS}
      void main() { float a = disc(gl_PointCoord, vCoc) * vA * uGlobal; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a * 0.85, a); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------- build
export function buildTitle(ctx) {
  const { M, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const particles = makeParticles();
  group.add(particles);
  const dust = makeDust({ n: 2600, box: [28, 16, 26], seed: 3, size: 0.045, opacity: 0.7 });
  group.add(dust);
  const seed = makeGlow("#ffb38a", 1, 1);
  group.add(seed);
  const halo = makeGlow("#ff7a4d", 1, 0.0);
  group.add(halo);
  const rays = makeRays();
  rays.scale.set(16, 16, 1); rays.position.set(0, 0.1, -0.8);
  group.add(rays);
  const rings = [makeRing("#ffc7a6"), makeRing("#ffb08a"), makeRing("#ffe0c8")];
  rings.forEach((r) => group.add(r));

  // the solid symbol, in rays
  const spark = makeSpark(M);
  group.add(spark.group);
  const rnd = mulberry32(7);
  const flights = spark.parts.map((m, i) => {
    const h = SYMBOL.geos[i].home;
    const dir = V(h.x, h.y, 0).normalize();
    return {
      start: V(h.x + dir.x * (1.6 + rnd() * 1.2), h.y + dir.y * (1.6 + rnd() * 1.2), 1.5 + (rnd() - 0.3) * 3.5),
      rot: V((rnd() - 0.5) * 5, (rnd() - 0.5) * 5, (rnd() - 0.5) * 4),
      land: C2.frag0 + i * C2.fragStep,
    };
  });

  // CLAUDE in 3D
  const word = wordGeometries("CLAUDE", 0.9, 0.09, 0.24);
  const letters = new THREE.Group();
  letters.position.set(0, LETTERS_Y, 0);
  group.add(letters);
  const L = word.letters.map((l, i) => {
    const m = new THREE.Mesh(l.geo, [M.letterFace, M.letterSide]);
    m.position.x = l.x;
    letters.add(m);
    return { m, land: C2.letter0 + i * C2.letterStep };
  });
  // the D's counter: the portal into scene 3
  const D = word.letters[4];
  const hole = D.holes[0];
  const hc = hole.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(hole.length);
  const counter = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(hole), 24), new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp, side: THREE.DoubleSide,
  }));
  counter.position.z = 0.155;
  counter.renderOrder = -5;
  L[4].m.add(counter);
  const dCenter = V(D.x + hc.x, LETTERS_Y + hc.y, 0.155);
  const sweepLight = ctx.L.p[2];

  function update(t, cam) {
    const vis = t < CUES.scene[2] + 0.6;
    group.visible = vis;
    if (!vis) return;
    const u = particles.material.uniforms;
    u.uT.value = t;
    u.uP1.value = t > C1.pulse1 ? (t - C1.pulse1) * 3.2 : -1;
    u.uP2.value = t > C1.pulse2 ? (t - C1.pulse2) * 5.5 : -1;
    particles.visible = t < C2.burst + 1.6;
    dust.material.uniforms.uT.value = t;
    dust.material.uniforms.uOpacity.value = 0.75 * smooth((t - 0.7) / 1.5);
    const sr = t - C2.shock;
    dust.material.uniforms.uShock.value.set(LC.x, LC.y, LC.z, sr > 0 && sr < 2.5 ? sr * 7 : -1);

    // first light: the seed spark
    const sp = prog(t, C1.spark, C1.spark + 0.25);
    const flick = 1 + 0.15 * Math.sin(t * 37) * (1 - prog(t, 1.5, 2.2));
    seed.position.copy(LC);
    seed.scale.setScalar((0.15 + 1.1 * out3(sp)) * flick * (1 - 0.6 * prog(t, 2.2, 2.9)));
    seed.material.opacity = sp * (1 - prog(t, 2.6, 3.1));
    halo.position.set(LC.x, LC.y, -0.3);
    halo.scale.setScalar(9);
    halo.material.opacity = 0.07 * smooth((t - 0.6) / 1.2) + 0.12 * smooth((t - 2.3) / 0.6) * (1 - prog(t, 5.0, 6.5)) + 0.25 * Math.exp(-Math.max(0, sr) * 2.5) * (sr > 0);

    // volumetric rays
    rays.quaternion.copy(cam.quaternion);
    rays.material.uniforms.uT.value = t;
    const shockFlash = sr > 0 ? Math.exp(-sr * 3.0) : 0;
    rays.material.uniforms.uI.value = 0.12 * smooth((t - 0.6) / 1.0) + 0.75 * smooth((t - 2.0) / 0.9) * (1 - 0.55 * prog(t, 3.0, 4.3)) + 0.8 * shockFlash;
    rays.material.uniforms.uI.value *= 1 - prog(t, 6.3, 7.1);
    rays.position.set(0, keys(t, [[4.5, LC.y], [5.4, SPARK_FINAL.pos.y]]), -0.8);

    // pulse rings
    [[C1.pulse1, 1.5, 4.2, 0.9], [C1.pulse2, 1.1, 6.5, 1.2], [C2.shock, 1.3, 11, 1.8]].forEach(([t0, d, R, I], i) => {
      const r = rings[i], p = (t - t0) / d;
      r.visible = p > 0 && p < 1;
      if (!r.visible) return;
      r.position.copy(i === 2 ? spark.group.position : LC);
      r.quaternion.copy(cam.quaternion);
      r.material.uniforms.uR.value = 0.2 + R * out3(p);
      r.material.uniforms.uW.value = 0.05 + 0.12 * p;
      r.material.uniforms.uI.value = I * Math.pow(1 - p, 1.6);
    });

    // ---- scene 2: the fragments arrive one by one
    const sparkOn = t > C2.burst;
    spark.group.visible = sparkOn;
    if (sparkOn) {
      const move = io(prog(t, C2.shock + 0.12, C2.shock + 0.95));
      const punch = sr > 0 ? 0.05 * Math.exp(-sr * 6) * Math.sin(sr * 30) : 0;
      spark.group.position.lerpVectors(LC, SPARK_FINAL.pos, move);
      spark.group.scale.setScalar(THREE.MathUtils.lerp(SA, SPARK_FINAL.scale, move) * (1 + punch));
      spark.group.rotation.y = Math.sin(t * 0.9) * 0.07 * prog(t, 4.6, 5.6) + (1 - prog(t, 3.0, 4.4)) * 0.25;
      spark.group.rotation.x = Math.sin(t * 0.7 + 1) * 0.03;
      spark.parts.forEach((m, i) => {
        const f = flights[i], h = SYMBOL.geos[i].home;
        const s = spring(t - (f.land - 0.33), 1.9, 0.78);
        const appear = out3(prog(t, C2.burst + i * 0.02, C2.burst + 0.3 + i * 0.02));
        const drift = (1 - clamp(s)) * 0.25;
        m.position.set(
          f.start.x + (h.x - f.start.x) * s + Math.sin(t * 1.3 + i) * drift,
          f.start.y + (h.y - f.start.y) * s + Math.cos(t * 1.1 + i) * drift,
          f.start.z * (1 - s));
        const r = 1 - clamp(s, 0, 1.05);
        m.rotation.set(f.rot.x * r + Math.sin(t + i) * 0.2 * r, f.rot.y * r, f.rot.z * r);
        m.scale.setScalar(appear);
      });
    }
    // glow on the faces at the shock, then calm
    ctx.M.coral.emissiveIntensity = 0.05 + 1.4 * shockFlash + 0.25 * Math.exp(-Math.pow((t - (C2.frag0 + 11 * C2.fragStep)) * 6, 2));

    // ---- CLAUDE letters
    L.forEach(({ m, land }) => {
      const s = spring(t - land, 2.3, 0.6);
      m.visible = t > land - 0.02;
      m.rotation.x = -1.4 * (1 - s);
      m.position.y = -0.45 * (1 - s);
      m.position.z = 0.6 * (1 - s);
    });
    letters.visible = t > C2.letter0 - 0.05;

    // light sweep across the letters
    const sw = prog(t, C2.sweep, C2.sweep + 0.85);
    sweepLight.position.set(-4.5 + 9 * io(sw), LETTERS_Y + 0.9, 2.2);
    sweepLight.color.set("#ffe8d6");
    sweepLight.intensity = 26 * Math.sin(Math.PI * sw);
  }

  return { group, update, dCenter, counter, spark, letters, word };
}
