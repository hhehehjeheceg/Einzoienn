// Shared world: anchors of every scene, materials, the studio environment for reflections, the light rig.
import * as THREE from "three";

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// where each scene lives in the one continuous space
export const W = {
  title: V(0, 0, 0),          // scenes 1-2
  ui: V(0, 0, -20),           // scene 3 (shifted onto the D at build time)
  lab: V(0, 0, -78),          // scene 4
  code: V(0, 0, -150),        // scene 5
};
W.tower = W.code.clone().add(V(7.6, -3.1, -3.0));
W.climax = W.tower.clone().add(V(0, 3.0, 0)); // scenes 6-7

export const COL = {
  coral: new THREE.Color("#d97757"), coralHi: new THREE.Color("#ff8f66"), amber: new THREE.Color("#ffb547"),
  gold: new THREE.Color("#f2c27b"), peach: new THREE.Color("#ffd9c4"), teal: new THREE.Color("#41d3c4"),
  sky: new THREE.Color("#62c6ff"), violet: new THREE.Color("#a492ff"), rose: new THREE.Color("#ff7fae"),
  navy: new THREE.Color("#05070f"),
};

export function makeMaterials() {
  const M = {};
  M.coral = new THREE.MeshPhysicalMaterial({
    color: "#d97757", roughness: 0.26, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05,
    sheen: 0.5, sheenColor: new THREE.Color("#ffb08a"), sheenRoughness: 0.4, emissive: new THREE.Color("#ff6a3d"), emissiveIntensity: 0.04,
  });
  M.chrome = new THREE.MeshPhysicalMaterial({ color: "#f3ede7", metalness: 1, roughness: 0.1 });
  M.chromeDark = new THREE.MeshPhysicalMaterial({ color: "#b9aea6", metalness: 1, roughness: 0.2 });
  M.letterFace = new THREE.MeshPhysicalMaterial({ color: "#f6f1ec", metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  M.letterSide = new THREE.MeshPhysicalMaterial({ color: "#8f8580", metalness: 1, roughness: 0.18 });
  M.glass = new THREE.MeshPhysicalMaterial({
    color: "#cfd8ff", metalness: 0, roughness: 0.08, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.03,
    envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
  });
  M.darkGlass = new THREE.MeshPhysicalMaterial({ color: "#151a2c", metalness: 0.5, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  return M;
}

// a dark studio with coloured softboxes, prefiltered into a reflection map
export function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: "#05060c", side: THREE.BackSide })));
  const box = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(look); env.add(m);
  };
  box(10, 1.6, "#ffffff", 7, V(0, 7, 1), V(0, 0, 0));
  box(3.5, 5, "#ff8a5c", 5, V(-7, 1.5, 3), V(0, 0, 0));
  box(3, 4, "#ffc070", 3.2, V(7, -0.5, 1), V(0, 0, 0));
  box(8, 2.2, "#5f7dff", 2.4, V(0, 2, -8), V(0, 0, 0));
  box(6, 1.2, "#ffffff", 1.6, V(0, -4, 7), V(0, 0, 0));
  box(1.2, 6, "#ffffff", 3, V(5, 2, 6), V(0, 0, 0));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.0, 0.1, 50).texture;
  pm.dispose();
  return tex;
}

export function makeLights(scene) {
  const L = {};
  L.hemi = new THREE.HemisphereLight("#7d8cff", "#1a0f0c", 0.35);
  L.key = new THREE.DirectionalLight("#ffe6d2", 2.0);
  L.key.position.set(-4, 6, 8);
  L.p = [0, 1, 2].map(() => { const p = new THREE.PointLight("#ff8f66", 0, 0, 2); scene.add(p); return p; });
  scene.add(L.hemi, L.key, L.key.target);
  return L;
}
