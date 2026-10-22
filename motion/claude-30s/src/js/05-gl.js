// =====================================================================================================
//  three.js: one renderer (SwiftShader in headless Chromium), one scene, studio environments, shared materials,
//  camera helpers, soft additive point clouds. The GL canvas is drawn into the 2D frame after every render.
// =====================================================================================================
const GLC = document.getElementById('gl') || document.createElement('canvas');
GLC.width = W; GLC.height = H;
const R3 = new THREE.WebGLRenderer({ canvas: GLC, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
R3.setPixelRatio(1); R3.setSize(W, H, false);
R3.outputColorSpace = THREE.SRGBColorSpace;
R3.toneMapping = THREE.NeutralToneMapping; R3.toneMappingExposure = 1.0;
R3.setClearColor(0x000000, 1);
const S3 = new THREE.Scene();
// the background is painted in 2D (half resolution, it is soft anyway) and handed to three as an sRGB texture:
// the GL frame is then opaque and copies into the 2D frame without any alpha round trip
const BG = mk(W / 2, H / 2), bgx = BG.g;
const BGT = new THREE.CanvasTexture(BG.c); BGT.colorSpace = THREE.SRGBColorSpace; BGT.minFilter = THREE.LinearFilter; BGT.generateMipmaps = false;
S3.background = BGT;
function paintBG(fn) { withCtx(bgx, () => { ctx.setTransform(.5, 0, 0, .5, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; fn(); ctx.setTransform(1, 0, 0, 1, 0, 0); }); }
const CAM = new THREE.PerspectiveCamera(30, W / H, .05, 400);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v = V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// ------------------------------------------------------------------ studio environments (PMREM from an emissive room)
function makeEnv(light) {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(light ? 0xb9b0a3 : 0x0d0b0a).multiplyScalar(light ? 1.1 : 1), side: THREE.BackSide })));
  const panel = (w, h, x, y, z, col, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
  };
  panel(9, 6, -8, 7, 9, 0xfff0dc, light ? 3.2 : 6.0);      // key softbox, front left, high
  panel(2.2, 12, 10, 1, -5, 0xdfe9ff, light ? 2.2 : 4.0);   // rim strip, right back
  panel(16, 1.4, 0, 11, 1, 0xffffff, light ? 2.0 : 3.0);    // top strip
  panel(1.4, 9, -11, 0, -3, 0xffd2b8, light ? 1.4 : 2.4);   // kicker, left back
  panel(14, 14, 0, -10, 3, 0xd97757, light ? .9 : .35);     // warm floor bounce
  const pm = new THREE.PMREMGenerator(R3);
  const tex = pm.fromScene(sc, .025).texture;
  pm.dispose();
  return tex;
}
const ENV = { dark: makeEnv(false), light: makeEnv(true) };
S3.environment = ENV.dark;
const KEY = new THREE.DirectionalLight(0xfff1e2, 1.6); KEY.position.set(-4, 6, 7); S3.add(KEY);
const RIM = new THREE.DirectionalLight(0xcfe0ff, 1.2); RIM.position.set(6, 2, -6); S3.add(RIM);
const FILL = new THREE.HemisphereLight(0xffe9d8, 0x2a1810, .25); S3.add(FILL);
function setLook(light) {
  S3.environment = light ? ENV.light : ENV.dark;
  S3.environmentIntensity = light ? 1.0 : 1.0;
  KEY.intensity = light ? 1.1 : 1.6; RIM.intensity = light ? .5 : 1.2; FILL.intensity = light ? .6 : .25;
}

// ------------------------------------------------------------------ materials
const MAT = {
  clay: new THREE.MeshPhysicalMaterial({ color: 0xd97757, roughness: .3, clearcoat: 1, clearcoatRoughness: .06, emissive: 0x3a1206, emissiveIntensity: 1 }),
  cream: new THREE.MeshPhysicalMaterial({ color: 0xf0eee6, roughness: .32, clearcoat: .8, clearcoatRoughness: .1 }),
  claySide: new THREE.MeshPhysicalMaterial({ color: 0xc8643f, roughness: .42, clearcoat: .6, clearcoatRoughness: .2 }),
  ink: new THREE.MeshPhysicalMaterial({ color: 0x1c1b19, roughness: .22, clearcoat: 1, clearcoatRoughness: .05 }),
  mint: new THREE.MeshPhysicalMaterial({ color: 0x5fd3a6, roughness: .25, clearcoat: 1, clearcoatRoughness: .05, emissive: 0x0c3022 }),
  sky: new THREE.MeshPhysicalMaterial({ color: 0x8ec3ff, roughness: .28, clearcoat: 1, clearcoatRoughness: .06 }),
};

// ------------------------------------------------------------------ geometry helpers
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function slab(w, h, r, depth, bevel = .02, seg = 4) {   // a rounded slab centred on the origin, front face at +z
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bevel, h - 2 * bevel, Math.max(.001, r - bevel)), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function glyphShapes(ch, size) {   // outlines from src/glyphs.json (Fraunces 700), size = em in world units
  const g = GLYPHS.glyphs[ch], k = size / GLYPHS.upm, p = new THREE.ShapePath();
  for (const c of g.cmds) {
    if (c[0] === 'M') p.moveTo(c[1] * k, c[2] * k);
    else if (c[0] === 'L') p.lineTo(c[1] * k, c[2] * k);
    else if (c[0] === 'Q') p.quadraticCurveTo(c[1] * k, c[2] * k, c[3] * k, c[4] * k);
    else if (c[0] === 'C') p.bezierCurveTo(c[1] * k, c[2] * k, c[3] * k, c[4] * k, c[5] * k, c[6] * k);
  }
  return { shapes: p.toShapes(false), adv: g.adv * k };
}
function group(parent = S3) { const g = new THREE.Group(); parent.add(g); return g; }

// ------------------------------------------------------------------ camera
function camLook(p, tgt, roll = 0, fov = 30) {
  CAM.position.set(p[0], p[1], p[2]); CAM.up.set(0, 1, 0); CAM.lookAt(tgt[0], tgt[1], tgt[2]);
  if (roll) CAM.rotateZ(roll);
  if (CAM.fov !== fov) { CAM.fov = fov; CAM.updateProjectionMatrix(); }
  CAM.updateMatrixWorld();
}
function proj(x, y, z) {   // world -> screen pixels (z > 1: behind the camera)
  _v.set(x, y, z).project(CAM);
  return { x: (_v.x * .5 + .5) * W, y: (-_v.y * .5 + .5) * H, z: _v.z };
}
const pxPerUnit = d => H / (2 * Math.tan(CAM.fov * Math.PI / 360) * d);   // screen size of one world unit at distance d

// ------------------------------------------------------------------ soft additive point clouds (positions written by the scenes every frame)
const PT_VS = `attribute float size; attribute vec4 col; varying vec4 vCol; uniform float uScale;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, size * uScale / -mv.z); vCol = col; vCol.a *= clamp(size * uScale / -mv.z, 0.0, 1.0); }`;
const PT_FS = `varying vec4 vCol; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.0, r); a *= a; float core = smoothstep(0.35, 0.0, r);
  gl_FragColor = vec4(vCol.rgb * (a + core * 0.6), vCol.a); }`;
class Cloud {
  constructor(n, parent = S3) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.col = new Float32Array(n * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 1 } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.geo = g;
    parent.add(this.obj);
  }
  set(i, x, y, z, s, c, a) {
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.size[i] = s;
    this.col[i * 4] = c[0] / 255; this.col[i * 4 + 1] = c[1] / 255; this.col[i * 4 + 2] = c[2] / 255; this.col[i * 4 + 3] = a;
  }
  commit(count = this.n) {
    for (let i = count; i < this.n; i++) this.size[i] = 0, this.col[i * 4 + 3] = 0;
    this.mat.uniforms.uScale.value = H / (2 * Math.tan(CAM.fov * Math.PI / 360));
    for (const k of ['position', 'size', 'col']) this.geo.attributes[k].needsUpdate = true;
  }
}

// ------------------------------------------------------------------ scene registry: every group is hidden, then the active scenes show theirs
const GROUPS = [];
function sceneGroup() { const g = group(); GROUPS.push(g); return g; }
function render3D() {
  BGT.needsUpdate = true;
  R3.render(S3, CAM);
  ctx.drawImage(GLC, 0, 0);
}
