// Entry: renderer, post chain, light rig, and the single renderAt(t) driven by HyperFrames seeks.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { CUES } from "./cues.js";
import { clamp, keys, smooth } from "./lib.js";
import { makeSky, FinalShader, AccumPass } from "./fx.js";
import { W, V, makeMaterials, makeEnvironment, makeLights } from "./world.js";
import { buildTitle } from "./s12.js";
import { buildUI } from "./s3.js";
import { buildLab } from "./s4.js";
import { buildTower } from "./s5.js";
import { buildClimax } from "./s67.js";
import { makeCamera } from "./camera.js";

const WIDTH = 1920, HEIGHT = 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2("#05070f", 0.02);
const camera = new THREE.PerspectiveCamera(35, WIDTH / HEIGHT, 0.04, 900);

// motion blur windows [from, to, samples]: only the fast moves
const BLUR = [[6.98, 7.75, 5], [11.68, 12.08, 5], [16.6, 17.02, 4], [18.0, 18.8, 3], [19.0, 20.62, 4], [23.0, 23.62, 3], [23.62, 23.9, 4], [24.82, 25.5, 4]];
const samplesAt = (t) => { for (const [a, b, n] of BLUR) if (t >= a && t < b) return n; return 1; };

let ready = false, pending = 0, S = null;

async function build() {
  await Promise.all(["600 26px InterTight", "700 40px InterTight", "800 64px InterTight", "500 28px JBM"].map((f) => document.fonts.load(f)));
  const M = makeMaterials();
  scene.environment = makeEnvironment(renderer);
  const L = makeLights(scene);
  const sky = makeSky();
  scene.add(sky);
  const ctx = { scene, M, L, renderer };
  const title = buildTitle(ctx);
  const ui = buildUI(ctx, title);
  const lab = buildLab(ctx);
  const tw = buildTower(ctx);
  const camAt = makeCamera(title, ui);
  const climax = buildClimax(ctx, ui, lab, tw, camAt);
  const bokehMats = [];
  scene.traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uFocus) bokehMats.push(o.material); });

  const rtOpts = { type: THREE.HalfFloatType, stencilBuffer: true, depthBuffer: true, samples: 4 };
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(WIDTH, HEIGHT, rtOpts));
  composer.setPixelRatio(1);
  composer.setSize(WIDTH, HEIGHT);
  const accum = new AccumPass(scene, camera, (t) => update(t));
  accum.tmp.dispose();
  accum.tmp = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, rtOpts);
  const bloom = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.8, 0.55, 0.82);
  const final = new ShaderPass(FinalShader);
  composer.addPass(accum);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(final);
  S = { M, L, sky, title, ui, lab, tw, climax, camAt, bokehMats, composer, accum, bloom, final };
  // compile everything once so the first real frame does not stall
  renderer.compile(scene, camera);
  ready = true;
  renderAt(pending);
}

const proj = (p) => { const v = p.clone().project(camera); return new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5); };

function update(t) {
  const { M, L, sky } = S;
  // per-frame state reset (no state may leak between frames)
  M.coral.emissiveIntensity = 0.05;
  L.p.forEach((p) => (p.intensity = 0));

  const c = S.camAt(t);
  camera.position.copy(c.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(c.look);
  if (c.roll) camera.rotateZ(c.roll);
  camera.fov = c.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // atmosphere per scene
  sky.position.copy(camera.position);
  const su = sky.material.uniforms;
  su.uT.value = t;
  su.uA.value = keys(t, [[0, 0.0], [2.5, 0.18], [7, 0.15], [7.6, 0.06], [12, 0.14], [17, 0.2], [22, 0.3], [25.4, 0.06], [26.5, 0.16]]);
  su.uB.value = keys(t, [[0, 0.06], [7, 0.1], [7.6, 0.28], [12, 0.3], [17, 0.2], [22, 0.3], [25.4, 0.06], [26.5, 0.08]]);
  su.uLevel.value = 1;
  scene.fog.density = keys(t, [[0, 0.02], [7.3, 0.02], [7.6, 0.028], [11.9, 0.03], [12.1, 0.028], [17, 0.022], [22, 0.012], [26, 0.02]]);
  renderer.toneMappingExposure = keys(t, [[0, 1.0], [12, 1.05], [17, 1.0], [26, 1.05]]);

  // light rig
  const C = W.climax;
  L.key.intensity = keys(t, [[0, 0.0], [3.0, 0.4], [3.5, 2.2], [7.3, 2.0], [7.6, 1.0], [12, 1.5], [17, 2.0], [22, 1.6], [25.5, 0.6], [26, 0.3], [26.8, 1.5]]);
  L.key.position.copy(camera.position).add(V(-5, 6, 4));
  L.key.target.position.copy(c.look);
  L.hemi.intensity = keys(t, [[0, 0.2], [7, 0.35], [26, 0.25]]);
  const [p0, p1] = L.p;
  if (t < 7.6) {
    p0.position.set(3, 2.5, 3.5); p0.color.set("#ff8f66"); p0.intensity = 30 * smooth((t - 3) / 0.6);
    p1.position.set(-4, 1, -2.5); p1.color.set("#6f86ff"); p1.intensity = 40 * smooth((t - 3) / 0.6);
  } else if (t < 12) {
    p0.position.copy(S.ui.O).add(V(0, 3, 4)); p0.color.set("#62c6ff"); p0.intensity = 20;
  } else if (t < 17) {
    p0.position.copy(W.lab).add(V(0, 0.3, 0)); p0.color.set("#ff7a4d"); p0.intensity = 60 * smooth((t - 12) / 0.3);
    p1.position.copy(W.lab).add(V(-6, 4, -3)); p1.color.set("#8b7cff"); p1.intensity = 80;
  } else if (t < 26) {
    p0.position.copy(W.tower).add(V(3, 4.5, 3.5)); p0.color.set("#ff8f66"); p0.intensity = 70;
    p1.position.copy(W.tower).add(V(-4.5, 2, -3.5)); p1.color.set("#5f7dff"); p1.intensity = 90;
    if (t > CUES.s6.conv0) { p0.position.copy(C).add(V(0, 0.5, 0)); p0.intensity = 60 + 200 * (t > CUES.s6.pulse ? Math.exp(-(t - CUES.s6.pulse) * 3) : 0); }
  } else {
    p0.position.copy(C).add(V(1.5, 3.0, 4.5)); p0.color.set("#ff9a6a"); p0.intensity = 22 * smooth((t - 26) / 0.9);
    p1.position.copy(C).add(V(-3, 2.5, -3)); p1.color.set("#7d8cff"); p1.intensity = 30 * smooth((t - 26.2) / 1.0);
  }

  // depth of field on every point system
  const focus = c.pos.distanceTo(c.look);
  const aperture = keys(t, [[0, 0.16], [7, 0.12], [7.6, 0.08], [12, 0.1], [17, 0.08], [22, 0.03], [26, 0.06]]);
  const scale = HEIGHT / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2));
  S.bokehMats.forEach((m) => { m.uniforms.uFocus.value = focus; m.uniforms.uAperture.value = aperture; m.uniforms.uScale.value = scale; });

  S.title.update(t, camera);
  S.ui.update(t, camera);
  S.lab.update(t, camera);
  S.tw.update(t, camera);
  S.climax.update(t, camera);
}

const decay = (t, t0, k) => (t >= t0 ? Math.exp(-(t - t0) * k) : 0);

function renderAt(t) {
  if (!ready) { pending = t; return; }
  const { accum, bloom, final } = S;
  accum.t = t;
  accum.samples = samplesAt(t);
  // bloom and grade follow the beats
  bloom.strength = keys(t, [[0, 0.75], [3, 0.8], [7, 0.75], [12, 0.85], [17, 0.65], [22, 0.95], [26, 0.85]])
    + 0.7 * decay(t, CUES.s2.shock, 3) + 0.5 * decay(t, CUES.s4.core, 4) + 0.9 * decay(t, CUES.s6.pulse, 2.5) + 0.35 * decay(t, CUES.s7.final, 2.5);
  bloom.radius = 0.55;
  bloom.threshold = 0.92;
  const u = final.uniforms;
  u.uT.value = t;
  u.uCA.value = 0.0012 + 0.006 * decay(t, CUES.s2.shock, 4) + 0.004 * decay(t, CUES.s4.core, 5) + 0.008 * decay(t, CUES.s6.pulse, 3) + 0.004 * (t > 6.98 && t < 7.7 ? Math.sin(Math.PI * (t - 6.98) / 0.72) : 0);
  u.uFlash.value = 0.22 * decay(t, CUES.s4.core, 6) + 0.85 * decay(t, CUES.s5.code, 7) * (t >= CUES.s5.code) + 0.3 * decay(t, CUES.s6.pulse, 5) + 0.08 * decay(t, CUES.s7.final, 4)
    + 0.6 * smooth((t - 16.82) / 0.18) * (t < CUES.s5.code);
  u.uFade.value = keys(t, [[0, 1], [25.3, 1], [25.85, 0.45], [26.0, 0.45], [26.6, 1]]);
  u.uShock.value.set(0.5, 0.5, -1, 0);
  // the update below sets the camera for this frame before we project the shock centres
  composer_render(t);
}

function composer_render(t) {
  const { composer, final } = S;
  // shock rings need the camera of this frame: set it once, then render
  update(t);
  const s2 = t - CUES.s2.shock, s6 = t - CUES.s6.pulse;
  if (s2 > 0 && s2 < 1.2) { const c = proj(S.title.spark.group.getWorldPosition(new THREE.Vector3())); final.uniforms.uShock.value.set(c.x, c.y, s2 * 1.25, 1.0 * Math.exp(-s2 * 2.5)); }
  if (s6 > 0 && s6 < 1.4) { const c = proj(W.climax); final.uniforms.uShock.value.set(c.x, c.y, s6 * 1.1, 1.2 * Math.exp(-s6 * 2.2)); }
  composer.render();
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.trailer = build();
window.__trailer = { renderAt: (t) => renderAt(t), debug: (t) => { const c = S.camAt(t); return { pos: c.pos.toArray(), look: c.look.toArray(), fov: c.fov }; } };
