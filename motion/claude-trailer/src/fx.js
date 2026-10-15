// Shaders and effect building blocks. Every uniform is set from time by the scenes.
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { mulberry32 } from "./lib.js";

// ---------------------------------------------------------------- shared point-sprite chunk (bokeh by focus distance)
export const BOKEH_VS = /* glsl */ `
uniform float uFocus, uAperture, uScale;
float bokeh(vec4 mv, float size, out float coc) {
  float d = -mv.z;
  coc = abs(d - uFocus) * uAperture;
  return size * (1.0 + coc * 4.0) * uScale / max(d, 0.05);
}`;
export const BOKEH_FS = /* glsl */ `
float disc(vec2 pc, float coc) {
  float r = length(pc - 0.5) * 2.0;
  float core = exp(-r * r * 5.0);
  float ring = smoothstep(1.0, 0.82, r) * (0.55 + 0.45 * smoothstep(0.55, 0.95, r));
  return mix(core, ring * 0.6, clamp(coc * 1.4, 0.0, 1.0)) * smoothstep(1.0, 0.9, r);
}`;

export function bokehUniforms() {
  return { uFocus: { value: 10 }, uAperture: { value: 0.12 }, uScale: { value: 800 } };
}

// ---------------------------------------------------------------- drifting dust (micro particles everywhere)
export function makeDust({ n = 3000, box = [30, 18, 30], seed = 1, colors = ["#ffd2b8", "#e8825f", "#9fb6ff"], size = 0.05, opacity = 0.6 }) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sd = new Float32Array(n * 4);
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    pos.set([(rnd() - 0.5) * box[0], (rnd() - 0.5) * box[1], (rnd() - 0.5) * box[2]], i * 3);
    const c = cs[Math.floor(rnd() * cs.length)];
    col.set([c.r, c.g, c.b], i * 3);
    sd.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(sd, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...bokehUniforms(), uT: { value: 0 }, uOpacity: { value: opacity }, uSize: { value: size },
      uShock: { value: new THREE.Vector4(0, 0, 0, -1) }, uWarp: { value: 0 }, uBox: { value: new THREE.Vector3(...box) } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; varying vec3 vCol; varying float vA, vCoc;
      uniform float uT, uSize, uWarp; uniform vec4 uShock; uniform vec3 uBox;
      ${BOKEH_VS}
      void main() {
        vec3 p = position;
        p += vec3(sin(uT * (0.2 + aSeed.x * 0.3) + aSeed.y * 6.28), cos(uT * (0.17 + aSeed.z * 0.25) + aSeed.w * 6.28), sin(uT * 0.13 + aSeed.x * 9.0)) * 0.35;
        p.y += uT * (0.05 + aSeed.z * 0.08);
        p = mod(p + uBox * 0.5, uBox) - uBox * 0.5;
        // shock: a spherical push outward from uShock.xyz at radius uShock.w
        if (uShock.w > 0.0) {
          vec3 d = p - uShock.xyz; float r = length(d);
          p += normalize(d + 1e-4) * 1.6 * exp(-pow((r - uShock.w) * 0.9, 2.0)) * smoothstep(0.0, 1.0, uShock.w);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // speed streak: stretch along view z when warping (rendered as larger, fainter points)
        float coc; gl_PointSize = bokeh(mv, uSize * (0.5 + aSeed.w), coc) * (1.0 + uWarp * 2.0);
        vCoc = coc; vCol = color;
        vA = (0.35 + 0.65 * aSeed.x) / (1.0 + coc * coc * 3.0) / (1.0 + uWarp);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA, vCoc; uniform float uOpacity;
      ${BOKEH_FS}
      void main() { float a = disc(gl_PointCoord, vCoc) * vA * uOpacity; if (a < 0.003) discard; gl_FragColor = vec4(vCol * a * 1.6, a); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------- soft glow sprite
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.12, "rgba(255,255,255,0.55)");
  g.addColorStop(0.35, "rgba(255,255,255,0.16)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}
export function makeGlow(color, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- sky dome: deep gradient + slow nebula
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color("#04050b") }, uBot: { value: new THREE.Color("#0a0d1c") },
      uGlowA: { value: new THREE.Color("#e8825f") }, uGlowB: { value: new THREE.Color("#2d3a8c") },
      uDirA: { value: new THREE.Vector3(0.3, 0.1, -1).normalize() }, uDirB: { value: new THREE.Vector3(-0.6, 0.3, -1).normalize() },
      uA: { value: 0.0 }, uB: { value: 0.0 }, uT: { value: 0 }, uLevel: { value: 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform vec3 uTop, uBot, uGlowA, uGlowB, uDirA, uDirB; uniform float uA, uB, uT, uLevel;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = mix(uBot, uTop, smoothstep(-0.4, 0.6, d.y));
        float neb = n3(d * 3.0 + vec3(0.0, 0.0, uT * 0.02)) * 0.6 + n3(d * 7.0 - uT * 0.03) * 0.4;
        c += uGlowA * uA * pow(max(dot(d, uDirA), 0.0), 6.0) * (0.6 + 0.6 * neb);
        c += uGlowB * uB * pow(max(dot(d, uDirB), 0.0), 3.0) * (0.5 + 0.8 * neb);
        gl_FragColor = vec4(c * uLevel, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- light rays behind the symbol
export function makeRays(color = "#ff9a6a") {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uI: { value: 0 }, uC: { value: new THREE.Color(color) }, uC2: { value: new THREE.Color("#ffd28a") } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uT, uI; uniform vec3 uC, uC2;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
        float s = 0.0;
        s += pow(0.5 + 0.5 * sin(a * 13.0 + uT * 0.35), 9.0);
        s += 0.7 * pow(0.5 + 0.5 * sin(a * 21.0 - uT * 0.22 + 1.7), 14.0);
        s += 0.5 * pow(0.5 + 0.5 * sin(a * 7.0 + uT * 0.15 + 4.1), 6.0);
        float fall = exp(-r * 2.6) * smoothstep(0.02, 0.18, r);
        vec3 c = mix(uC2, uC, smoothstep(0.0, 0.6, r));
        float v = (s * 0.55 + 0.25) * fall * uI;
        gl_FragColor = vec4(c * v, v);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
}

// ---------------------------------------------------------------- expanding energy ring
export function makeRing(color = "#ffb08a") {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uR: { value: 1 }, uW: { value: 0.06 }, uI: { value: 0 }, uC: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vP; uniform float uR, uW, uI; uniform vec3 uC;
      void main(){ float d = abs(length(vP) - uR); float v = exp(-d * d / (uW * uW)) * uI + exp(-d / (uW * 6.0)) * uI * 0.25; gl_FragColor = vec4(uC * v, v); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat);
}

// ---------------------------------------------------------------- glowing grid floor that fades into the distance
export function makeGrid(color = "#41d3c4", size = 120, cell = 1.0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uI: { value: 1 }, uCell: { value: cell }, uT: { value: 0 }, uFade: { value: 28 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW; uniform vec3 uC; uniform float uI, uCell, uT, uFade;
      void main(){
        vec2 g = vW.xz / uCell; vec2 f = abs(fract(g - 0.5) - 0.5) / fwidth(g);
        float line = 1.0 - min(min(f.x, f.y), 1.0);
        vec2 G = vW.xz / (uCell * 5.0); vec2 F = abs(fract(G - 0.5) - 0.5) / fwidth(G);
        float major = 1.0 - min(min(F.x, F.y), 1.0);
        float dist = length(vW.xz - cameraPosition.xz);
        float fade = exp(-dist / uFade);
        float scan = 0.5 + 0.5 * sin(dist * 0.6 - uT * 3.0);
        float v = (line * 0.25 + major * 0.55) * fade * uI * (0.7 + 0.3 * scan);
        gl_FragColor = vec4(uC * v, v);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  mat.extensions = { derivatives: true };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ---------------------------------------------------------------- light beam along a curve, drawn and pulsing
export function makeBeam(curve, color = "#ff9a74", radius = 0.012, seg = 120) {
  const geo = new THREE.TubeGeometry(curve, seg, radius, 6, false);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDraw: { value: 0 }, uT: { value: 0 }, uI: { value: 1 }, uC: { value: new THREE.Color(color) }, uPulse: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uDraw, uT, uI, uPulse; uniform vec3 uC;
      void main(){
        float u = vUv.x; if (u > uDraw) discard;
        float head = exp(-pow((uDraw - u) * 18.0, 2.0)) * step(uDraw, 0.999);
        float p = fract(u * 2.0 - uT * 1.4); float pulses = pow(p, 18.0) * 2.5;
        float travel = exp(-pow((u - uPulse) * 14.0, 2.0)) * step(0.0, uPulse) * 3.0;
        float v = (0.55 + head * 3.0 + pulses + travel) * uI;
        gl_FragColor = vec4(uC * v, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- post: final grade, shock distortion, aberration, vignette, grain
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1920, 1080) }, uT: { value: 0 },
    uShock: { value: new THREE.Vector4(0.5, 0.5, -1, 0) }, uCA: { value: 0.0015 }, uVig: { value: 0.32 },
    uGrain: { value: 0.035 }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Color("#ffd9c4") }, uFade: { value: 1 },
    uLift: { value: new THREE.Color("#060812") }, uWarm: { value: 0.08 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uT, uCA, uVig, uGrain, uFlash, uFade, uWarm;
    uniform vec4 uShock; uniform vec3 uFlashC, uLift; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      // shock ring distortion
      if (uShock.z > 0.0) {
        vec2 d = (uv - uShock.xy) * asp; float r = length(d);
        float w = exp(-pow((r - uShock.z) * 14.0, 2.0)) * uShock.w;
        uv -= normalize(d + 1e-5) / asp * w * 0.035;
      }
      vec2 c = (uv - 0.5); float rr = dot(c * asp, c * asp);
      float ca = uCA * (0.4 + rr * 2.2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;
      // grade: lifted cool shadows, warm highlights
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = col + uLift * (1.0 - smoothstep(0.0, 0.35, l));
      col *= mix(vec3(1.0), vec3(1.06, 1.0, 0.93), smoothstep(0.4, 1.0, l) * uWarm * 6.0);
      col = mix(col, uFlashC, uFlash);
      col *= 1.0 - uVig * smoothstep(0.15, 1.1, rr * 1.6);
      col += (hash(vUv * uRes + fract(uT * 61.7) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

// ---------------------------------------------------------------- render pass with in-frame motion blur (sub-frame accumulation)
export class AccumPass extends Pass {
  constructor(scene, camera, update) {
    super();
    this.scene = scene; this.camera = camera; this.update = update;
    this.t = 0; this.samples = 1; this.shutter = 0.5 / 60;
    this.tmp = new THREE.WebGLRenderTarget(1920, 1080, { type: THREE.HalfFloatType, samples: 0 });
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null }, uW: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D tMap; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tMap, vUv) * uW; }`,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    }));
    this.needsSwap = true;
  }
  setSize(w, h) { this.tmp.setSize(w, h); }
  render(renderer, writeBuffer) {
    const n = this.samples;
    if (n <= 1) {
      this.update(this.t);
      renderer.setRenderTarget(writeBuffer); renderer.clear(); renderer.render(this.scene, this.camera);
      return;
    }
    renderer.setRenderTarget(writeBuffer); renderer.setClearColor(0x000000, 0); renderer.clear();
    for (let k = 0; k < n; k++) {
      this.update(this.t + (k / (n - 1) - 0.5) * this.shutter);
      renderer.setRenderTarget(this.tmp); renderer.clear(); renderer.render(this.scene, this.camera);
      this.quad.material.uniforms.tMap.value = this.tmp.texture; this.quad.material.uniforms.uW.value = 1 / n;
      renderer.setRenderTarget(writeBuffer); this.quad.render(renderer);
    }
    this.update(this.t); // leave scene state at the frame time
  }
}
