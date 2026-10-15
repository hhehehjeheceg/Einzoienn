// Scene 4: the skills lab. A glowing core and six volumetric modules, each connected by a beam.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CUES } from "./cues.js";
import { clamp, prog, smooth, io, out3, out5, outExpo, spring, mulberry32, TAU } from "./lib.js";
import { canvasTex, labelTex, CODE_PANEL } from "./textures.js";
import { makeDust, makeGlow, makeGrid, makeBeam, makeRing } from "./fx.js";
import { makeSpark } from "./s12.js";
import { V, W } from "./world.js";

const C4 = CUES.s4;
export const MODULES = [
  { name: "CODE", color: "#41d3c4" },
  { name: "DESIGN", color: "#ff7fae" },
  { name: "DOCUMENTS", color: "#ffb547" },
  { name: "RECHERCHE", color: "#62c6ff" },
  { name: "AUTOMATISATION", color: "#a492ff" },
  { name: "AUDIO & VIDÉO", color: "#f2c27b" },
];
export const LAB_R = 4.4;
const HEIGHTS = [0.55, -0.35, 0.45, -0.5, 0.65, -0.25];

const emissive = (color, k = 0.6, extra = {}) => new THREE.MeshPhysicalMaterial({
  color: "#1a1d2b", metalness: 0.6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08,
  emissive: new THREE.Color(color), emissiveIntensity: k, ...extra,
});

// ---------------------------------------------------------------- the six module objects (unit size ~1)
function codeModule(col, M) {
  const g = new THREE.Group();
  const c = canvasTex(512, 512);
  const { ctx } = c;
  ctx.fillStyle = "#0d111c"; ctx.fillRect(0, 0, 512, 512);
  ctx.font = "500 30px JBM";
  const SYN = { k: "#c792ea", v: "#f3efe9", f: "#62c6ff", s: "#ffcf8a", n: "#ff9a74", p: "#8b93a8", c: "#6b7287" };
  CODE_PANEL.forEach((ln, i) => { let x = 28; ln.forEach(([k, s]) => { ctx.fillStyle = SYN[k]; ctx.fillText(s, x, 60 + i * 52); x += ctx.measureText(s).width; }); });
  ctx.font = "800 150px InterTight"; ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.textAlign = "center"; ctx.fillText("</>", 256, 470);
  c.tex.needsUpdate = true;
  const face = new THREE.MeshPhysicalMaterial({ map: c.tex, emissiveMap: c.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.2, clearcoat: 1 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 1.0, 4, 0.1), [face, face, M.chromeDark, M.chromeDark, face, face]);
  g.add(box);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.08, 1.08, 1.08)), new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2), transparent: true, opacity: 0.8 }));
  g.add(edges);
  return { g, spin: box, parts: [box, edges], emis: [face] };
}
function designModule(col, M) {
  const g = new THREE.Group();
  const mk = (shape, color, z, s = 1) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    geo.center();
    const m = new THREE.Mesh(geo, emissive(color, 0.55, { color, transparent: true, opacity: 0.92 }));
    m.position.z = z; m.scale.setScalar(s); g.add(m); return m;
  };
  const circle = new THREE.Shape(); circle.absarc(0, 0, 0.42, 0, TAU);
  const tri = new THREE.Shape(); tri.moveTo(0, 0.5); tri.lineTo(0.45, -0.3); tri.lineTo(-0.45, -0.3); tri.closePath();
  const sq = new THREE.Shape(); sq.moveTo(-0.33, -0.33); sq.lineTo(0.33, -0.33); sq.lineTo(0.33, 0.33); sq.lineTo(-0.33, 0.33); sq.closePath();
  const a = mk(circle, "#ff7fae", -0.25), b = mk(tri, "#ffb547", 0.0), c = mk(sq, "#a492ff", 0.25);
  a.position.x = -0.18; c.position.x = 0.2; c.position.y = 0.12;
  return { g, spin: g, parts: [a, b, c], emis: [a.material, b.material, c.material] };
}
function docModule(col, M) {
  const g = new THREE.Group();
  const pages = [0, 1, 2, 3].map((i) => {
    const c = canvasTex(256, 330);
    const { ctx } = c;
    ctx.fillStyle = "#f4efe7"; ctx.fillRect(0, 0, 256, 330);
    ctx.fillStyle = "#1a1c26"; ctx.fillRect(24, 26, 140, 16);
    for (let k = 0; k < 9; k++) { ctx.fillStyle = k === 3 + (i % 3) ? "rgba(255,181,71,0.75)" : "rgba(26,28,38,0.22)"; ctx.fillRect(24, 64 + k * 28, 200 - (k * 37 % 60), 10); }
    c.tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.012), new THREE.MeshPhysicalMaterial({ map: c.tex, roughness: 0.5, emissive: new THREE.Color(col), emissiveIntensity: 0.05, emissiveMap: c.tex }));
    g.add(m); return m;
  });
  return { g, spin: g, parts: pages, pages, emis: pages.map((p) => p.material) };
}
function searchModule(col, M) {
  const g = new THREE.Group();
  const ico = new THREE.IcosahedronGeometry(0.55, 1);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(ico), new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2), transparent: true, opacity: 0.85 }));
  const nodes = new THREE.Points(ico, new THREE.PointsMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(2), size: 0.07, sizeAttenuation: true }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), emissive(col, 1.2));
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6) }));
  orbit.rotation.x = 1.2;
  g.add(wire, nodes, core, orbit);
  return { g, spin: g, parts: [wire, nodes, core, orbit], orbit, emis: [core.material] };
}
function autoModule(col, M) {
  const g = new THREE.Group();
  const rings = [0.62, 0.48, 0.34].map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 96), i === 1 ? emissive(col, 1.0) : M.chrome);
    g.add(m); return m;
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12), emissive(col, 2.0));
  g.add(ball);
  return { g, spin: g, parts: [...rings, ball], rings, emis: [rings[1].material, ball.material] };
}
function avModule(col, M) {
  const g = new THREE.Group();
  const mat = emissive(col, 0.9, { color: "#2a2116" });
  const bars = Array.from({ length: 24 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), mat);
    const a = (i / 24) * TAU; m.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
    g.add(m); return m;
  });
  const tri = new THREE.Shape(); tri.moveTo(-0.16, 0.22); tri.lineTo(0.24, 0); tri.lineTo(-0.16, -0.22); tri.closePath();
  const play = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), M.chrome);
  play.geometry.center();
  g.add(play);
  return { g, spin: g, parts: [...bars, play], bars, play, emis: [mat] };
}

export function buildLab(ctx) {
  const { scene, M } = ctx;
  const group = new THREE.Group();
  group.position.copy(W.lab);
  scene.add(group);

  // floor
  const grid = makeGrid("#6d5cff", 120, 0.9);
  grid.position.y = -2.4;
  group.add(grid);
  const floorRings = [2.0, LAB_R, 6.8].map((r, i) => {
    const ring = makeRing(["#ff8f66", "#a492ff", "#41d3c4"][i]);
    ring.rotation.x = -Math.PI / 2; ring.position.y = -2.38;
    ring.material.uniforms.uR.value = r; ring.material.uniforms.uW.value = 0.03;
    group.add(ring); return ring;
  });

  // the core: a small luminous symbol inside a glass sphere
  const coreMat = new THREE.MeshPhysicalMaterial({ color: "#ff9a6a", emissive: new THREE.Color("#ff6a3d"), emissiveIntensity: 2.2, roughness: 0.3, clearcoat: 1 });
  const core = makeSpark(M, coreMat);
  core.group.scale.setScalar(0.62);
  core.group.position.y = 0.3;
  group.add(core.group);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 32), new THREE.ShaderMaterial({
    uniforms: { uI: { value: 1 }, uC: { value: new THREE.Color("#ffb08a") } },
    vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN, vV; uniform float uI; uniform vec3 uC; void main(){ float f = pow(1.0 - clamp(abs(dot(vN, vV)), 0.0, 1.0), 2.5); gl_FragColor = vec4(uC * f * uI * 1.6, f * uI); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  shell.position.y = 0.3;
  group.add(shell);
  const orbits = [0, 1].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.45 + i * 0.25, 0.01, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(i ? "#ffb547" : "#ff8f66").multiplyScalar(2) }));
    m.position.y = 0.3; group.add(m); return m;
  });
  const coreGlow = makeGlow("#ff7a4d", 7, 0);
  coreGlow.position.y = 0.3;
  group.add(coreGlow);

  // modules
  const builders = [codeModule, designModule, docModule, searchModule, autoModule, avModule];
  const mods = MODULES.map((d, i) => {
    const a = Math.PI / 2 + (i / 6) * TAU + 0.2;
    const home = V(Math.cos(a) * LAB_R, HEIGHTS[i], Math.sin(a) * LAB_R);
    const obj = builders[i](d.color, M);
    const holder = new THREE.Group();
    holder.position.copy(home);
    holder.add(obj.g);
    group.add(holder);
    const lab = labelTex(d.name, d.color);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: lab.tex, transparent: true, depthWrite: false, fog: false }));
    spr.scale.set(1.9, 0.36, 1);
    spr.position.set(0, -0.95, 0);
    holder.add(spr);
    const glow = makeGlow(d.color, 3.2, 0);
    holder.add(glow);
    const ring = makeRing(d.color);
    ring.scale.setScalar(0.12);
    holder.add(ring);
    const p0 = V(0, 0.3, 0), p3 = home.clone();
    const mid = p0.clone().lerp(p3, 0.5).add(V(0, 1.6, 0));
    const beam = makeBeam(new THREE.QuadraticBezierCurve3(p0, mid, p3), d.color, 0.016, 80);
    group.add(beam);
    return { ...d, home, obj, holder, spr, glow, ring, beam, t0: C4.modules[i], tb: C4.modules[i] + C4.beamLag };
  });

  const dust = makeDust({ n: 2400, box: [30, 12, 30], seed: 21, colors: ["#a492ff", "#ffb08a", "#41d3c4", "#ffffff"], size: 0.05, opacity: 0.6 });
  group.add(dust);
  const bg = [["#6d5cff", V(-12, 4, -16), 26], ["#ff7a4d", V(10, -2, -12), 18], ["#41d3c4", V(0, 9, -20), 22]].map(([c, p, s]) => { const g = makeGlow(c, s, 0.12); g.position.copy(p); group.add(g); return g; });

  function update(t, cam) {
    const vis = t > CUES.scene[3] - 0.35 && t < CUES.scene[4] + 0.1;
    group.visible = vis;
    if (!vis) return;
    const ig = t - C4.core;
    grid.material.uniforms.uT.value = t;
    grid.material.uniforms.uI.value = 0.8;
    floorRings.forEach((r, i) => (r.material.uniforms.uI.value = (0.5 + 0.4 * Math.sin(t * 2 + i)) * smooth((ig - 0.1 * i) / 0.4)));
    dust.material.uniforms.uT.value = t;
    dust.material.uniforms.uWarp.value = 1 - smooth((t - 11.95) / 0.3);

    // core ignition
    const on = smooth(ig / 0.25);
    const flash = ig > 0 ? Math.exp(-ig * 4) : 0;
    core.group.rotation.y = t * 0.6;
    core.group.rotation.z = Math.sin(t * 0.8) * 0.15;
    core.group.scale.setScalar(0.62 * (0.6 + 0.4 * out5(ig / 0.5)) * (1 + 0.04 * Math.sin(t * 8) * on));
    coreMat.emissiveIntensity = 0.3 + 2.0 * on + 4 * flash + 1.2 * Math.max(0, 1 - Math.abs(t - C4.rise - 0.35) * 2.5);
    shell.material.uniforms.uI.value = on * (0.7 + 0.3 * Math.sin(t * 3));
    orbits.forEach((o, i) => { o.rotation.set(1.1 + i * 0.5 + t * (0.4 + i * 0.3), t * (0.7 - i * 0.2), 0.3 * i); o.scale.setScalar(0.4 + 0.6 * out5(ig / 0.6)); });
    coreGlow.material.opacity = 0.5 * on + 0.8 * flash;

    mods.forEach((m, i) => {
      const a = t - m.t0;
      m.holder.visible = a > 0;
      if (a <= 0) return;
      const s = spring(a, 2.1, 0.66);
      const activ = t - (m.tb + 0.4); // beam reaches the module
      const act = activ > 0 ? Math.exp(-activ * 3) : 0;
      const bob = Math.sin(t * 1.2 + i) * 0.08;
      m.holder.position.set(m.home.x, m.home.y + bob, m.home.z);
      m.obj.g.scale.setScalar(Math.max(0.001, s) * (1 + act * 0.12));
      // each module moves on its own axes; some spin fast then lock precisely
      const lock = out5(a / 1.1);
      if (i === 0) { m.obj.spin.rotation.set(0.35, (1 - lock) * 9 + 0.6 + t * 0.15, 0); }
      else if (i === 1) { m.obj.g.rotation.set(Math.sin(t) * 0.2, t * 0.7, 0); m.obj.parts.forEach((p, k) => (p.rotation.z = Math.sin(t * 1.5 + k) * 0.3)); }
      else if (i === 2) { m.obj.pages.forEach((p, k) => { const f = out3((activ + 0.05) / 0.5); p.rotation.y = (k - 1.5) * 0.35 * f; p.position.set((k - 1.5) * 0.12 * f, 0, (k - 1.5) * -0.05); }); m.obj.g.rotation.y = 0.4 + Math.sin(t * 0.6) * 0.2; }
      else if (i === 3) { m.obj.g.rotation.y = t * 0.8; m.obj.orbit.rotation.z = t * 2.0; }
      else if (i === 4) { m.obj.rings.forEach((r, k) => { r.rotation.set(k === 0 ? (1 - lock) * 14 + t * 0.4 : 0, k === 1 ? (1 - lock) * 11 + t * 0.6 : 0, k === 2 ? t * 1.2 : 0); }); }
      else if (i === 5) { m.obj.bars.forEach((b, k) => { const h = 0.35 + 0.65 * Math.abs(Math.sin(t * 6 + k * 0.7)) * (0.4 + 0.6 * smooth(activ / 0.3)); b.scale.y = h; }); m.obj.g.rotation.y = t * 0.5; m.obj.play.rotation.y = -t * 0.5 + 0.3; }
      m.obj.emis.forEach((e) => (e.emissiveIntensity = (e._base ??= e.emissiveIntensity) * (1 + act * 2.5)));
      m.spr.material.opacity = smooth((a - 0.25) / 0.35);
      m.glow.material.opacity = 0.18 * s + 0.6 * act;
      const ru = m.ring.material.uniforms;
      m.ring.visible = activ > 0 && activ < 0.8;
      m.ring.quaternion.copy(cam.quaternion);
      ru.uR.value = 0.5 + 9 * out3(activ / 0.8); ru.uW.value = 0.4; ru.uI.value = 1.2 * Math.pow(1 - clamp(activ / 0.8), 2);
      const bu = m.beam.material.uniforms;
      const bp = (t - m.tb) / 0.4;
      m.beam.visible = bp > 0;
      bu.uDraw.value = io(bp); bu.uT.value = t; bu.uI.value = 1.1;
      bu.uPulse.value = ((t - m.tb) * 0.8) % 1;
    });
  }
  return { group, update, mods, core };
}
