// Scene 5: code on several planes, then a tower built from wireframe to polygons to finished materials.
import * as THREE from "three";
import { CUES } from "./cues.js";
import { clamp, prog, smooth, io, out3, out5 } from "./lib.js";
import { canvasTex, drawEditor, drawSide } from "./textures.js";
import { makeDust, makeGlow } from "./fx.js";
import { panelMaterial } from "./s3.js";
import { V, W } from "./world.js";

const C5 = CUES.s5;
export const FLOORS = 36, FLOOR_H = 0.17;

function ringShape(r) {
  // rounded square (superellipse) ring
  const sup = (R, n = 64) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 0.42;
      pts.push(new THREE.Vector2(R * Math.sign(c) * Math.pow(Math.abs(c), e), R * Math.sign(s) * Math.pow(Math.abs(s), e)));
    }
    return pts;
  };
  const sh = new THREE.Shape(sup(r));
  sh.holes.push(new THREE.Path(sup(r * 0.6).reverse()));
  return sh;
}

export function buildTower(ctx) {
  const { scene, M } = ctx;
  const group = new THREE.Group();
  group.position.copy(W.code);
  scene.add(group);

  // the code, on three planes
  const ed = canvasTex(1600, 1000);
  const edMat = panelMaterial(ed.tex, "#e8825f");
  const editor = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.0), edMat);
  group.add(editor);
  const sides = [V(-3.9, 2.35, 1.7), V(3.4, -2.25, 2.5)].map((p, i) => {
    const c = canvasTex(1100, 300);
    const mat = panelMaterial(c.tex, "#62c6ff");
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.9), mat);
    m.position.copy(p); m.rotation.y = i ? -0.18 : 0.2;
    group.add(m);
    return { m, c, mat };
  });
  const edGlow = makeGlow("#e8825f", 12, 0.0);
  edGlow.position.set(0, 0, -1.5);
  group.add(edGlow);

  // the tower
  const tower = new THREE.Group();
  tower.position.copy(W.tower).sub(W.code);
  group.add(tower);
  const wireMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color("#ffb08a") } },
    vertexShader: `attribute float aU; attribute float aP; varying float vU, vP; void main(){ vU = aU; vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uC; varying float vU, vP; void main(){ if (vU > vP) discard; float head = exp(-pow((vP - vU) * 25.0, 2.0)) * step(vP, 0.999); gl_FragColor = vec4(uC * (1.2 + head * 4.0), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const slabs = [];
  for (let i = 0; i < FLOORS; i++) {
    const k = i / (FLOORS - 1);
    const r = 1.55 - 0.5 * Math.sin(k * Math.PI);
    const geo = new THREE.ExtrudeGeometry(ringShape(r), { depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.055, 0);
    geo.computeVertexNormals();
    const chrome = i % 2 === 0;
    const mat = new THREE.MeshPhysicalMaterial({ color: "#2b2f3c", metalness: 0, roughness: 0.75, transparent: true, opacity: 0, clearcoat: 0, emissive: new THREE.Color("#ff7a4d"), emissiveIntensity: 0, envMapIntensity: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = i * FLOOR_H;
    mesh.rotation.y = k * Math.PI * 0.9;
    const eg = new THREE.EdgesGeometry(geo, 25);
    const pos = eg.attributes.position;
    const aU = new Float32Array(pos.count), aP = new Float32Array(pos.count);
    for (let j = 0; j < pos.count; j++) aU[j] = (Math.atan2(pos.getZ(j), pos.getX(j)) + Math.PI) / (2 * Math.PI);
    eg.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
    eg.setAttribute("aP", new THREE.BufferAttribute(aP, 1));
    const wire = new THREE.LineSegments(eg, wireMat);
    mesh.add(wire);
    tower.add(mesh);
    slabs.push({ mesh, mat, wire, aP, k, chrome, home: { pos: mesh.position.clone(), rotY: mesh.rotation.y } });
  }
  const towerGlow = makeGlow("#ff8f66", 9, 0);
  towerGlow.position.set(0, 3, 0);
  tower.add(towerGlow);
  const dust = makeDust({ n: 2400, box: [36, 18, 30], seed: 33, colors: ["#ffd2b8", "#ffb547", "#62c6ff"], size: 0.05, opacity: 0.6 });
  dust.position.set(4, 0, -4);
  group.add(dust);
  const bg = [["#ff7a4d", V(14, 6, -22), 30], ["#3a4cff", V(-14, -2, -18), 26]].map(([c, p, s]) => { const g = makeGlow(c, s, 0.14); g.position.copy(p); group.add(g); return g; });

  const finalColor = { chrome: new THREE.Color("#f3ede7"), coral: new THREE.Color("#d97757"), raw: new THREE.Color("#2b2f3c") };

  function update(t, cam) {
    const vis = t > CUES.scene[4] - 0.05 && t < 24.0;
    group.visible = vis;
    if (!vis) return;
    const p = t - C5.code;
    // code planes
    edMat.uniforms.uMode.value = 1;
    edMat.uniforms.uReveal.value = io(p / 0.35);
    edMat.uniforms.uOpacity.value = 1 - smooth((t - 21.6) / 0.4);
    drawEditor(ed, p * 3.4);
    ed.tex.needsUpdate = true;
    sides.forEach((s, i) => {
      const a = p - 0.35 - i * 0.25;
      s.m.visible = a > 0;
      s.mat.uniforms.uMode.value = 2; s.mat.uniforms.uReveal.value = io(a / 0.35);
      s.mat.uniforms.uOpacity.value = 0.95 * (1 - smooth((t - 21.6) / 0.4));
      drawSide(s.c, a * 2.2, i);
      s.c.tex.needsUpdate = true;
      s.m.position.y += 0; // fixed planes, parallax comes from the camera
    });
    edGlow.material.opacity = 0.18 * smooth(p / 0.4);
    dust.material.uniforms.uT.value = t;

    // tower: wire, then faces, then materials, then the light pulse
    const climax = t > CUES.s6.conv0;
    slabs.forEach((s, i) => {
      const k = s.k;
      const w0 = C5.wire0 + (C5.wire1 - C5.wire0 - 0.35) * k;
      const wp = clamp((t - w0) / 0.35);
      s.aP.fill(io(wp));
      s.wire.geometry.attributes.aP.needsUpdate = true;
      s.wire.visible = wp > 0 && !climax;
      const f0 = C5.fill0 + (C5.fill1 - C5.fill0 - 0.3) * k;
      const fp = smooth((t - f0) / 0.3);
      const mp = smooth((t - C5.mat - 0.25 * k) / 0.45);
      s.mesh.visible = fp > 0 || climax;
      s.mat.opacity = fp;
      s.mat.transparent = fp < 1;
      s.mat.depthWrite = fp > 0.5;
      s.mat.color.copy(finalColor.raw).lerp(s.chrome ? finalColor.chrome : finalColor.coral, mp);
      s.mat.metalness = s.chrome ? mp : 0.1 * mp;
      s.mat.roughness = 0.75 - (s.chrome ? 0.63 : 0.5) * mp;
      s.mat.clearcoat = mp;
      s.mat.envMapIntensity = 0.2 + 1.1 * mp;
      const py = (t - C5.pulse) / 0.9 * (FLOORS + 6) - 3;
      const band = t > C5.pulse ? Math.exp(-Math.pow((i - py) / 2.2, 2)) : 0;
      s.mat.emissiveIntensity = 1.0 * band + 0.04 * mp;
      if (!climax) {
        s.mesh.position.copy(s.home.pos);
        s.mesh.rotation.set(0, s.home.rotY + Math.sin(t * 0.5 + i * 0.2) * 0.01, 0);
        s.mesh.scale.setScalar(1);
      }
    });
    towerGlow.material.opacity = 0.25 * smooth((t - C5.mat) / 0.5) + 0.6 * Math.max(0, 1 - Math.abs(t - C5.pulse - 0.45) * 2);
  }
  return { group, update, slabs, tower };
}
