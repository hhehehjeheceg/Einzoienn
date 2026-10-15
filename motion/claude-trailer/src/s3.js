// Scene 3: through the D, a vast digital space where five interfaces materialise.
import * as THREE from "three";
import { CUES } from "./cues.js";
import { clamp, prog, smooth, io, out3, outExpo, spring } from "./lib.js";
import { canvasTex, drawWriting, drawCode, drawDesign, drawDocument, drawData } from "./textures.js";
import { makeDust, makeGlow, makeGrid, makeBeam } from "./fx.js";
import { V, W } from "./world.js";

const C3 = CUES.s3;

export function panelMaterial(tex, accent) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uReveal: { value: 1 }, uMode: { value: 0 }, uOpacity: { value: 1 }, uBright: { value: 0.78 }, uEdge: { value: new THREE.Color(accent) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uReveal, uMode, uOpacity, uBright; uniform vec3 uEdge; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(map, vUv);
        float x = uMode < 1.5 ? vUv.x : abs(vUv.x - 0.5) * 2.0;
        float m = uMode < 0.5 ? 1.0 : smoothstep(uReveal, uReveal - 0.015, x);
        float edge = uMode < 0.5 ? 0.0 : exp(-pow((x - uReveal) * 60.0, 2.0)) * step(uReveal, 0.995) * step(0.001, uReveal);
        // linear output: the canvas is sRGB
        vec3 lin = pow(c.rgb, vec3(2.2)) * uBright;
        gl_FragColor = vec4(lin + uEdge * edge * 3.0, (c.a * m + edge * 0.8) * uOpacity);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function buildUI(ctx, title) {
  const { scene } = ctx;
  const O = V(title.dCenter.x, title.dCenter.y, W.ui.z);
  const group = new THREE.Group();
  group.position.copy(O);
  scene.add(group);

  const defs = [
    { draw: drawWriting, pos: V(-5.7, 1.45, 0.2), ry: 0.34, accent: "#e8825f", kind: "wipe" },
    { draw: drawCode, pos: V(-2.0, -1.05, 1.7), ry: 0.12, accent: "#62c6ff", kind: "rotate" },
    { draw: drawDesign, pos: V(1.75, 1.35, -0.8), ry: -0.06, accent: "#ff7fae", kind: "depth" },
    { draw: drawDocument, pos: V(5.3, -0.75, 0.5), ry: -0.26, accent: "#ffb547", kind: "unfold" },
    { draw: drawData, pos: V(8.8, 1.1, -1.4), ry: -0.42, accent: "#41d3c4", kind: "morph" },
  ];
  const panels = defs.map((d, i) => {
    const c = canvasTex(1280, 800);
    const mat = panelMaterial(c.tex, d.accent);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), mat);
    const holder = new THREE.Group();
    holder.position.copy(d.pos);
    holder.add(mesh);
    const glow = makeGlow(d.accent, 5.5, 0.0);
    glow.position.set(0, 0, -0.6);
    holder.add(glow);
    group.add(holder);
    return { ...d, c, mat, mesh, holder, glow, t0: C3.panels[i] };
  });

  // light links between the windows
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const a = panels[i].pos, b = panels[i + 1].pos;
    const p0 = V(a.x + 1.55, a.y - 0.2, a.z), p3 = V(b.x - 1.55, b.y + 0.2, b.z);
    const curve = new THREE.CubicBezierCurve3(p0, V(p0.x + 1.2, p0.y + 1.6 * (i % 2 ? -1 : 1), p0.z + 1.2), V(p3.x - 1.2, p3.y - 1.2 * (i % 2 ? -1 : 1), p3.z + 1.0), p3);
    const bm = makeBeam(curve, panels[i + 1].accent, 0.014);
    group.add(bm);
    beams.push({ bm, t0: C3.links + i * 0.12 });
  }
  // long data streams in the depth
  for (let i = 0; i < 5; i++) {
    const y = -2.2 + i * 1.3, z = -6 - i * 2.5;
    const curve = new THREE.CatmullRomCurve3([V(-22, y, z), V(-6, y + 0.8, z + 1), V(6, y - 0.6, z), V(24, y + 0.4, z - 2)]);
    const bm = makeBeam(curve, ["#41d3c4", "#a492ff", "#e8825f", "#62c6ff", "#ffb547"][i], 0.02);
    group.add(bm);
    beams.push({ bm, t0: C3.cross + 0.1 + i * 0.15, long: true });
  }
  const grid = makeGrid("#3a6cff", 160, 1.2);
  grid.position.set(0, -3.6, -10);
  group.add(grid);
  const dust = makeDust({ n: 2600, box: [40, 14, 34], seed: 9, colors: ["#62c6ff", "#41d3c4", "#ffd2b8", "#a492ff"], size: 0.05, opacity: 0.7 });
  group.add(dust);
  const glows = [["#e8825f", V(-14, 2, -16), 22], ["#41d3c4", V(16, -1, -14), 20], ["#a492ff", V(3, 8, -24), 26], ["#62c6ff", V(4, -3, -30), 30]].map(([c, p, s]) => {
    const g = makeGlow(c, s, 0.18); g.position.copy(p); group.add(g); return g;
  });

  const mats = [];
  group.traverse((o) => { if (o.material) mats.push(o.material); });
  let portalMode = null;
  function setPortal(on) {
    if (portalMode === on) return;
    portalMode = on;
    mats.forEach((m) => {
      m.stencilWrite = true;
      m.stencilRef = 1;
      m.stencilFunc = on ? THREE.EqualStencilFunc : THREE.AlwaysStencilFunc;
      m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
    });
  }

  function update(t, cam) {
    const vis = t > CUES.scene[2] - 0.5 && t < CUES.scene[3] + 0.4;
    group.visible = vis;
    if (!vis) return;
    setPortal(cam.position.z > title.dCenter.z + 0.02);
    dust.material.uniforms.uT.value = t;
    dust.material.uniforms.uWarp.value = smooth((t - 11.6) / 0.25);
    grid.material.uniforms.uT.value = t;
    grid.material.uniforms.uI.value = 0.9 * smooth((t - 7.2) / 0.8);
    glows.forEach((g) => (g.material.opacity = 0.09 * smooth((t - 7.0) / 0.6)));

    panels.forEach((P, i) => {
      const a = t - P.t0;
      P.holder.visible = a > 0;
      if (a <= 0) return;
      const fl = Math.sin(t * 0.8 + i * 1.7) * 0.06;
      P.holder.position.set(P.pos.x, P.pos.y + fl, P.pos.z);
      P.holder.rotation.set(Math.sin(t * 0.6 + i) * 0.02, P.ry, 0);
      P.holder.scale.set(1, 1, 1);
      const u = P.mat.uniforms;
      u.uMode.value = 0; u.uOpacity.value = 1;
      if (P.kind === "wipe") {
        u.uMode.value = 1; u.uReveal.value = io(a / 0.55);
        P.holder.position.x += -0.5 * (1 - out3(a / 0.6));
      } else if (P.kind === "rotate") {
        P.holder.rotation.y = P.ry + 1.45 * (1 - spring(a, 1.5, 0.72));
        u.uOpacity.value = smooth(a / 0.15);
      } else if (P.kind === "depth") {
        P.holder.position.z += -24 * (1 - outExpo(a / 0.8));
        u.uOpacity.value = smooth(a / 0.2);
      } else if (P.kind === "unfold") {
        P.holder.scale.set(Math.max(0.01, io(a / 0.45)), 1, 1);
        u.uMode.value = 2; u.uReveal.value = io((a - 0.1) / 0.45);
      } else if (P.kind === "morph") {
        const sx = spring(a - 0.08, 1.7, 0.7), sy = spring(a, 1.9, 0.7);
        P.holder.scale.set(0.12 + 0.88 * sx, 0.2 + 0.8 * sy, 1);
        u.uOpacity.value = smooth(a / 0.12);
      }
      P.glow.material.opacity = 0.22 * smooth(a / 0.5);
      P.draw(P.c, a);
      P.c.tex.needsUpdate = true;
    });
    beams.forEach(({ bm, t0, long }) => {
      const p = (t - t0) / (long ? 1.6 : 0.45);
      bm.visible = p > 0;
      const u = bm.material.uniforms;
      u.uDraw.value = long ? smooth(p) : io(p);
      u.uT.value = t;
      u.uI.value = long ? 0.35 : 0.9;
      u.uPulse.value = long ? -1 : ((t - t0 - 0.5) * 0.9) % 1.0;
    });
  }
  return { group, update, O, panels };
}
