// =====================================================================================================
//  3D world (three.js, rendered on demand by time). Models are all built in code:
//  nebula + starfield, low-poly island with POI props, the battle bus under its balloon, clouds,
//  blueprint build pieces, and the chrome Stellar star.
// =====================================================================================================
const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
const R = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, alpha: false });
R.setPixelRatio(1); R.setSize(W, H, false);
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .92;
const GLB = mk(W, H);   // holds a copy of a first GL pass when two 3D scenes cross-fade

// ---------------------------------------------------------------- 2D value noise + fbm (seeded)
const NP = (() => { const r = mulberry32(2020), p = new Float32Array(1024); for (let i = 0; i < 1024; i++) p[i] = r(); return p; })();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => NP[((a * 73 + b * 179) & 1023 + 1024) & 1023];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
const fbm = (x, y, o = 5) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; };

// ---------------------------------------------------------------- shared shader chunks
const NOISE_GLSL = `
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n2(p);p*=2.02;a*=.5;}return s;}
`;

// ================================================================= SPACE (nebula + stars + warp streaks)
const space = new THREE.Scene();
const spaceCam = new THREE.PerspectiveCamera(60, W / H, .1, 4000);
const nebMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { uT: { value: 0 }, uHue: { value: 0 }, uBright: { value: 1 } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: NOISE_GLSL + `
  varying vec3 vP; uniform float uT, uHue, uBright;
  void main(){
    vec3 d = normalize(vP);
    vec2 uv = vec2(atan(d.z,d.x)*1.2, d.y*2.2);
    float n = fbm2(uv*1.6 + vec2(uT*.01, 0.));
    float m = fbm2(uv*3.1 - vec2(0., uT*.008) + n*1.4);
    float band = exp(-pow((d.y - .15*sin(d.x*2.)) * 2.4, 2.));
    vec3 deep = vec3(.012,.016,.05);
    vec3 vio = vec3(.42,.27,1.0), cy = vec3(.16,.75,1.0), pk = vec3(1.0,.26,.62);
    vec3 col = deep;
    float neb = smoothstep(.35,.9,m) * (.35 + .9*band);
    col += mix(vio, mix(cy, pk, smoothstep(.4,.8,n)), smoothstep(.3,.75,n + uHue*.3)) * neb * .55;
    col += vio * band * .06;
    gl_FragColor = vec4(col * uBright, 1.);
  }`,
});
space.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), nebMat));
// stars: points with per-star size and colour, a twinkle phase, and a "warp" stretch done with line streaks
const NSTAR = 5000;
const starGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(31), pos = new Float32Array(NSTAR * 3), col = new Float32Array(NSTAR * 3), siz = new Float32Array(NSTAR), ph = new Float32Array(NSTAR);
  for (let i = 0; i < NSTAR; i++) {
    const u = r() * 2 - 1, th = r() * TAU, rad = 200 + r() * 1100, s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * rad; pos[i * 3 + 1] = u * rad * .8; pos[i * 3 + 2] = Math.sin(th) * s * rad;
    const k = r(), c = k < .6 ? [1, 1, 1] : k < .8 ? [.75, .85, 1] : k < .92 ? [.8, .7, 1] : [1, .85, .7];
    col.set(c, i * 3); siz[i] = .6 + Math.pow(r(), 6) * 6; ph[i] = r() * TAU;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  starGeo.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
}
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 }, uA: { value: 1 } },
  vertexShader: `attribute float size; attribute float ph; attribute vec3 color; varying vec3 vC; varying float vTw; uniform float uT;
    void main(){ vC = color; vTw = .65 + .35*sin(uT*2.3 + ph*7.);
      vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size * (900. / -mv.z) * 1.6; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vTw; uniform float uA;
    void main(){ vec2 p = gl_PointCoord-.5; float d = length(p); float a = smoothstep(.5,.0,d); a = a*a;
      float cross = max(0., 1. - abs(p.x)*18.) * smoothstep(.5,0.,abs(p.y)) + max(0., 1. - abs(p.y)*18.) * smoothstep(.5,0.,abs(p.x));
      gl_FragColor = vec4(vC * (a + cross*.35) * vTw * uA, 1.); }`,
});
space.add(new THREE.Points(starGeo, starMat));
// warp streaks: a tunnel of line segments along -z, length driven by uWarp
const NSTREAK = 1400, streakGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(55), pos = new Float32Array(NSTREAK * 6), end = new Float32Array(NSTREAK * 2), col = new Float32Array(NSTREAK * 6);
  for (let i = 0; i < NSTREAK; i++) {
    const a = r() * TAU, rad = 6 + r() * 60, z = -r() * 900;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    pos.set([x, y, z, x, y, z], i * 6); end.set([0, 1], i * 2);
    const c = r() < .5 ? [.6, .5, 1] : r() < .5 ? [.4, .85, 1] : [1, 1, 1];
    col.set([...c, ...c], i * 6);
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  streakGeo.setAttribute('isEnd', new THREE.BufferAttribute(end, 1));
  streakGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
const streakMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uWarp: { value: 0 }, uZ: { value: 0 } },
  vertexShader: `attribute float isEnd; attribute vec3 color; varying vec3 vC; varying float vE; uniform float uWarp, uZ;
    void main(){ vec3 p = position; p.z = mod(p.z + uZ, 900.) - 900.; p.z += isEnd * uWarp * 140.; vC = color; vE = isEnd;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
  fragmentShader: `varying vec3 vC; varying float vE; uniform float uWarp; void main(){ gl_FragColor = vec4(vC * (0.25 + vE) * min(1., uWarp*1.5), 1.); }`,
});
const streaks = new THREE.LineSegments(streakGeo, streakMat); streaks.frustumCulled = false;
space.add(streaks);

// ---------------------------------------------------------------- environment map for chrome (PMREM of a coloured light box)
const pmrem = new THREE.PMREMGenerator(R);
const envScene = new THREE.Scene();
{
  envScene.background = new THREE.Color('#05060f');
  const box = (c, x, y, z, sx, sy, sz, I = 1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(I) })); m.position.set(x, y, z); envScene.add(m); };
  box('#7b5cff', -8, 3, -6, 4, 10, .5, 3); box('#39d0ff', 9, -2, -4, 3, 8, .5, 3); box('#ffffff', 0, 9, 0, 14, .5, 6, 2.5);
  box('#ff4fa3', 6, 4, 8, 6, 3, .5, 2.2); box('#ffc93c', -7, -6, 6, 6, 2, .5, 1.6); box('#1a1f5c', 0, -10, 0, 30, .5, 30, 1);
}
const ENV = pmrem.fromScene(envScene, .02).texture;

// ================================================================= the STELLAR STAR (extruded, chrome-violet)
function starShape(r1, r2, n = 5, round = .12) {
  const s = new THREE.Shape(), pts = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r2 : r1; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  // rounded corners by quadratic curves around each vertex
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const pa = p.clone().lerp(a, round), pb = p.clone().lerp(b, round);
    if (i === 0) s.moveTo(pa.x, pa.y); else s.lineTo(pa.x, pa.y);
    s.quadraticCurveTo(p.x, p.y, pb.x, pb.y);
  }
  s.closePath(); return s;
}
const starMesh = new THREE.Mesh(
  new THREE.ExtrudeGeometry(starShape(1, .46), { depth: .32, bevelEnabled: true, bevelThickness: .16, bevelSize: .1, bevelSegments: 6, curveSegments: 10 }).center(),
  new THREE.MeshStandardMaterial({ color: '#cfc6ff', metalness: 1, roughness: .16, envMap: ENV, envMapIntensity: 1.6 }));
const starInner = new THREE.Mesh(
  new THREE.ExtrudeGeometry(starShape(.52, .24), { depth: .5, bevelEnabled: true, bevelThickness: .06, bevelSize: .05, bevelSegments: 3 }).center(),
  new THREE.MeshStandardMaterial({ color: '#39d0ff', emissive: '#39d0ff', emissiveIntensity: 1.6, metalness: .3, roughness: .3 }));
const starGroup = new THREE.Group(); starGroup.add(starMesh); starGroup.add(starInner);
space.add(starGroup);
space.add(new THREE.AmbientLight('#8a7dff', .25));
const spaceKey = new THREE.PointLight('#ffffff', 60, 0, 1.6); spaceKey.position.set(3, 4, 6); space.add(spaceKey);

// ================================================================= ISLAND WORLD
const isle = new THREE.Scene();
const isleCam = new THREE.PerspectiveCamera(50, W / H, .5, 3000);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, .2, -1) }, uSunCol: { value: new THREE.Color() }, uT: { value: 0 } },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: NOISE_GLSL + `varying vec3 vD; uniform vec3 uTop, uHor, uSun, uSunCol; uniform float uT;
    void main(){ vec3 d = normalize(vD); float h = clamp(d.y, -.2, 1.);
      vec3 col = mix(uHor, uTop, pow(clamp(h*1.6, 0., 1.), .55));
      float s = max(0., dot(d, normalize(uSun)));
      col += uSunCol * (pow(s, 600.) * 6. + pow(s, 12.) * .45 + pow(s, 3.) * .12);
      // soft high cirrus
      vec2 uv = d.xz / max(.08, d.y) * .35; float c = smoothstep(.5, .9, fbm2(uv + vec2(uT*.01,0.))) * smoothstep(.12,.45,d.y);
      col = mix(col, mix(vec3(1.), uSunCol, .35), c*.18);
      gl_FragColor = vec4(col, 1.); }`,
});
isle.add(new THREE.Mesh(new THREE.SphereGeometry(2000, 40, 24), skyMat));
isle.fog = new THREE.Fog('#9fd0ff', 160, 900);
const hemi = new THREE.HemisphereLight('#bfe3ff', '#2a4a1a', .75); isle.add(hemi);
const sun = new THREE.DirectionalLight('#fff4dc', 2.6); sun.position.set(-80, 120, -60); isle.add(sun);

// ---- terrain
const ISZ = 220, ISEG = 150;
function islandH(x, z) {
  const r = Math.hypot(x * 1.0, z * 1.12) / 92;
  const edge = fbm(x * .018 + 7, z * .018 - 3, 4) * .55;
  const mask = 1 - ss(clamp((r + edge - .62) / .5));
  const hills = fbm(x * .03, z * .03, 5);
  const mount = Math.exp(-((x + 30) ** 2 + (z + 25) ** 2) / 420) * 16;
  // a river carved across the island (Chapter 2 had rivers everywhere)
  const river = Math.exp(-((z - 18 * Math.sin(x * .03) - 6) ** 2) / 20) * 5 * mask;
  return mask * (3 + hills * 16 + mount) - (1 - mask) * 9 - river - 1.2;
}
const terrGeo = new THREE.PlaneGeometry(ISZ, ISZ, ISEG, ISEG).toNonIndexed();
terrGeo.rotateX(-Math.PI / 2);
{
  const p = terrGeo.attributes.position, col = new Float32Array(p.count * 3), r = mulberry32(9);
  for (let i = 0; i < p.count; i++) p.setY(i, islandH(p.getX(i), p.getZ(i)));
  // colour per triangle (flat): by mean height and slope
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const ax = p.getX(i + 1) - p.getX(i), ay = p.getY(i + 1) - p.getY(i), az = p.getZ(i + 1) - p.getZ(i);
    const bx = p.getX(i + 2) - p.getX(i), by = p.getY(i + 2) - p.getY(i), bz = p.getZ(i + 2) - p.getZ(i);
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, slope = 1 - Math.abs(ny) / Math.hypot(nx, ny, nz);
    let c;
    if (y < -2.2) c = [.16, .55, .6];            // seabed (turquoise through the water)
    else if (y < .6) c = [.93, .85, .62];        // sand
    else if (y > 27) c = [.9, .93, 1];           // snow cap on the mountain
    else if (slope > .62) c = [.46, .44, .42];   // rock
    else if (y > 13) c = [.2, .46, .22];
    else if (y < 1.6) c = [.62, .74, .36];
    else c = [.26 + r() * .06, .58 + r() * .08, .2];
    const j = (r() - .5) * .05;
    for (let k = 0; k < 3; k++) col.set([c[0] + j, c[1] + j, c[2] + j], (i + k) * 3);
  }
  terrGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  terrGeo.computeVertexNormals();
}
const terrMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 });
isle.add(new THREE.Mesh(terrGeo, terrMat));
// ---- water
const waterMat = new THREE.ShaderMaterial({
  transparent: true, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uDeep: { value: new THREE.Color('#1166c8') }, uShal: { value: new THREE.Color('#38d6e0') }, uSunCol: { value: new THREE.Color('#fff') } }]),
  vertexShader: `#include <fog_pars_vertex>
    varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: NOISE_GLSL + `#include <fog_pars_fragment>
    varying vec3 vW; uniform float uT; uniform vec3 uDeep, uShal, uSunCol;
    void main(){ float r = length(vW.xz*vec2(1.,1.12))/92.;
      float shal = 1. - smoothstep(.55, 1.25, r);
      vec3 col = mix(uDeep, uShal, shal*.85);
      float w = fbm2(vW.xz*.08 + vec2(uT*.15, uT*.07));
      float spark = smoothstep(.72, .8, fbm2(vW.xz*.25 + vec2(-uT*.3, uT*.2)));
      col += w*.06 + spark * uSunCol * .35;
      float foam = smoothstep(.06,.0,abs(r - .78 - (w-.5)*.12)) * .0;
      gl_FragColor = vec4(col + foam, .82);
      #include <fog_fragment>
    }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = 0;
isle.add(water);
// ---- trees (instanced low-poly pines + round trees)
{
  const r = mulberry32(4), pine = new THREE.ConeGeometry(1.4, 4.2, 6), trunk = new THREE.CylinderGeometry(.25, .3, 1.2, 5);
  const pm = new THREE.MeshStandardMaterial({ color: '#2f7d3a', flatShading: true, roughness: .9 });
  const tm = new THREE.MeshStandardMaterial({ color: '#6b4a2b', flatShading: true });
  const N = 900, pI = new THREE.InstancedMesh(pine, pm, N), tI = new THREE.InstancedMesh(trunk, tm, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < 6000 && k < N; i++) {
    const x = (r() - .5) * 190, z = (r() - .5) * 190, y = islandH(x, z);
    if (y < 2 || y > 14 || fbm(x * .05 + 40, z * .05, 3) < .5) continue;
    const s = .7 + r() * .8; sc.set(s, s * (.9 + r() * .4), s);
    m.compose(new THREE.Vector3(x, y + 2.6 * sc.y, z), q, sc); pI.setMatrixAt(k, m);
    m.compose(new THREE.Vector3(x, y + .4, z), q, sc); tI.setMatrixAt(k, m); k++;
  }
  pI.count = tI.count = k; isle.add(pI); isle.add(tI);
}
// ---- POI props (stylised, built from primitives)
const POI = {};
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .7 }, o));
function addAt(g, x, z, lift = 0) { g.position.set(x, Math.max(0, islandH(x, z)) + lift, z); isle.add(g); return g; }
{ // L'Agence: a mansion-like HQ block with a gold dome at the centre of the island
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), std('#e9e4da')); b.position.y = 3; g.add(b);
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 14), std('#d8d1c4')); w1.position.set(-9, 2, 0); g.add(w1);
  const w2 = w1.clone(); w2.position.x = 9; g.add(w2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, TAU, 0, Math.PI / 2), std('#ffc93c', { metalness: .9, roughness: .25, envMap: ENV })); dome.position.y = 6; g.add(dome);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14.4, .6, 10.4), std('#3b3f58')); roof.position.y = 6.2; g.add(roof);
  POI.agency = addAt(g, 4, -6);
}
{ // Le Yacht: white superyacht on the water, east
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(3, 1.6, 22, 6, 1), std('#f4f6fa')); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, .8); hull.position.y = 1.4; g.add(hull);
  const d1 = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 4), std('#ffffff')); d1.position.set(-1, 4, 0); g.add(d1);
  const d2 = new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, 3.4), std('#1d2a44')); d2.position.set(-1.5, 6, 0); g.add(d2);
  const st = new THREE.Mesh(new THREE.BoxGeometry(18, .4, 4.8), std('#2a3b66')); st.position.set(0, 2.9, 0); g.add(st);
  POI.yacht = addAt(g, 112, 10, .2); POI.yacht.rotation.y = .5;
}
{ // Le Requin: a rocky islet with a giant shark-fin rock, south-west
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(9, 0), std('#7e8a8f')); rock.scale.set(1.4, .45, 1); g.add(rock);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 3), std('#5a6a78')); fin.position.set(0, 8, 0); fin.scale.set(.5, 1, 1.4); fin.rotation.y = .4; g.add(fin);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 8), std('#2b2f3a')); base.position.set(6, 3, 2); g.add(base);
  POI.shark = addAt(g, -96, 78, 0);
}
{ // La Plateforme: an offshore oil rig, north-west
  const g = new THREE.Group(), legM = std('#d9a23a', { metalness: .4 });
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 14, 6), legM); l.position.set(x, 4, z); g.add(l); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 18), std('#4b5568')); deck.position.y = 11; g.add(deck);
  const blk = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), std('#c8402e')); blk.position.set(-3, 14, -3); g.add(blk);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(.6, 2.6, 16, 4, 1, true), std('#e6e6e6', { wireframe: false })); tower.position.set(4, 19, 4); g.add(tower);
  const heli = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, .4, 12), std('#2c3e50')); heli.position.set(4, 12, -5); g.add(heli);
  POI.rig = addAt(g, -70, -112, 0);
}
const POI_POS = k => POI[k].position.clone().add(new THREE.Vector3(0, 8, 0));

// ---- the BATTLE BUS (blue bus hanging under a hot-air balloon), ~ 10 units long
function canvasTex(w, h, draw) { const { c, g } = mk(w, h); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const balloonTex = canvasTex(512, 256, (g, w, h) => {
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#2b7cff'; g.fillRect(i * w / 12, 0, w / 12 + 1, h); }
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, h * .05, w, h * .04);
});
const busSideTex = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = '#2f6fe4'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d9ecff'; g.fillRect(0, h * .78, w, h * .06);
  for (let i = 0; i < 6; i++) { g.fillStyle = '#16213a'; g.fillRect(70 + i * 150, h * .16, 120, h * .4); g.fillStyle = 'rgba(160,220,255,.35)'; g.fillRect(74 + i * 150, h * .18, 40, h * .36); }
  g.fillStyle = '#ffd23f'; g.font = '900 64px Anton, sans-serif'; g.textAlign = 'right'; g.fillText('BATTLE BUS', w - 30, h * .73);
});
const bus = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 3.4, 3.4), [
    std('#2f6fe4'), std('#2f6fe4'), std('#5a96ff'), std('#1d3f8a'),
    new THREE.MeshStandardMaterial({ map: busSideTex, roughness: .5 }), new THREE.MeshStandardMaterial({ map: busSideTex, roughness: .5 }),
  ]);
  bus.add(body);
  const front = new THREE.Mesh(new THREE.BoxGeometry(.3, 1.4, 2.8), std('#16213a')); front.position.set(5.1, .5, 0); bus.add(front);
  for (const [x, z] of [[-3.2, 1.75], [3.2, 1.75], [-3.2, -1.75], [3.2, -1.75]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .5, 14), std('#15171c')); wh.rotation.x = Math.PI / 2; wh.position.set(x, -1.7, z); bus.add(wh);
  }
  const balloon = new THREE.Mesh(new THREE.SphereGeometry(5.4, 36, 24), new THREE.MeshStandardMaterial({ map: balloonTex, roughness: .55 }));
  balloon.scale.set(1, 1.15, 1); balloon.position.y = 11; bus.add(balloon);
  const ropeM = new THREE.LineBasicMaterial({ color: '#222' });
  for (const [x, z] of [[-4.5, 1.5], [4.5, 1.5], [-4.5, -1.5], [4.5, -1.5]]) {
    const gg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 1.7, z), new THREE.Vector3(x * .5, 6.5, z * 1.6)]);
    bus.add(new THREE.Line(gg, ropeM));
  }
  const thr = new THREE.Mesh(new THREE.ConeGeometry(.7, 2.2, 10), new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: .8, blending: THREE.AdditiveBlending }));
  thr.rotation.z = Math.PI / 2; thr.position.set(-6.1, -.3, 0); thr.name = 'thr'; bus.add(thr);
}
isle.add(bus);

// ---- clouds: billboard sprites with a seeded canvas texture
const cloudTex = canvasTex(256, 256, (g, w, h) => {
  const r = mulberry32(12);
  for (let i = 0; i < 26; i++) {
    const x = w * (.25 + r() * .5), y = h * (.4 + r() * .25), rad = w * (.1 + r() * .18), gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
});
const clouds = new THREE.Group();
{
  const r = mulberry32(77);
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: .9, fog: true }));
    const s = 30 + r() * 50; m.scale.set(s * 1.6, s, 1);
    let x = (r() - .5) * 700, z = (r() - .5) * 700; const d = Math.hypot(x, z); if (d < 130) { x *= 130 / Math.max(1, d); z *= 130 / Math.max(1, d); }
    m.position.set(x, 55 + r() * 35, z); clouds.add(m);
  }
}
isle.add(clouds);
// skydive cloud tunnel (separate group, vertical)
const diveClouds = new THREE.Group();
{
  const r = mulberry32(88);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: .85 }));
    const s = 14 + r() * 26; m.scale.set(s * 1.5, s, 1); m.material.opacity = .6;
    const a = r() * TAU, rad = 22 + r() * 70; m.position.set(Math.cos(a) * rad, 40 + r() * 260, Math.sin(a) * rad); diveClouds.add(m);
  }
}
isle.add(diveClouds);
// a glider + skydiver silhouette (simple) for the jump shot
const diver = new THREE.Group();
{
  const suit = std('#7b5cff', { emissive: '#2a1a66' });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.45, 1.1, 4, 8), suit); torso.rotation.x = Math.PI / 2; diver.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 8), std('#f0c8a0')); head.position.set(0, 0, -1.05); diver.add(head);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .9, 3, 6), suit); arm.position.set(s * .75, 0, -.45); arm.rotation.z = Math.PI / 2; arm.rotation.y = s * .5; diver.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .95, 3, 6), std('#2a2350')); leg.position.set(s * .32, 0, 1.1); leg.rotation.x = Math.PI / 2; leg.rotation.y = s * .25; diver.add(leg);
  }
  const trailM = new THREE.MeshBasicMaterial({ color: '#39d0ff', transparent: true, opacity: .6, blending: THREE.AdditiveBlending });
  for (const s of [-1, 1]) { const tr = new THREE.Mesh(new THREE.ConeGeometry(.12, 7, 6), trailM); tr.position.set(s * .32, 0, 4.6); tr.rotation.x = -Math.PI / 2; diver.add(tr); }
}
isle.add(diver);

// ================================================================= BUILD scene (blueprint walls + ramp + floor)
const buildScene = new THREE.Scene();
const buildCam = new THREE.PerspectiveCamera(48, W / H, .1, 500);
buildScene.background = new THREE.Color('#071022');
buildScene.fog = new THREE.Fog('#071022', 40, 140);
buildScene.add(new THREE.HemisphereLight('#9fd0ff', '#10162e', 1.2));
const bsun = new THREE.DirectionalLight('#ffffff', 2); bsun.position.set(20, 40, 15); buildScene.add(bsun);
{ // glowing grid ground
  const grid = new THREE.GridHelper(400, 100, '#2fa8ff', '#1b3b6e'); grid.material.transparent = true; grid.material.opacity = .45; buildScene.add(grid);
}
const woodTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b07a43'; g.fillRect(0, 0, w, h);
  const r = mulberry32(3);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#a06d3a' : '#bd8750'; g.fillRect(0, i * h / 4, w, h / 4 - 4); g.fillStyle = '#6e4724'; g.fillRect(0, (i + 1) * h / 4 - 4, w, 4); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(80,45,20,${r() * .15})`; g.fillRect(r() * w, r() * h, 30 + r() * 60, 1.5); }
  g.strokeStyle = '#5a3a1c'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
});
// piece list: [type, x, y, z, rotY, buildStart(local s)]
const PIECES = [
  ['wall', 0, 0, -4, 0, 0.00], ['floor', 0, 0, 0, 0, .33], ['ramp', 0, 0, 4, 0, .67], ['wall', -4, 0, 0, Math.PI / 2, .95],
  ['wall', 4, 0, 0, Math.PI / 2, 1.15], ['wall', 0, 4, -4, 0, 1.33], ['ramp', 0, 4, 0, 0, 1.5], ['wall', -4, 4, 0, Math.PI / 2, 1.62], ['wall', 4, 4, 0, Math.PI / 2, 1.72],
];
const pieceObjs = PIECES.map(([type, x, y, z, ry]) => {
  const g = new THREE.Group();
  let geo;
  if (type === 'wall') geo = new THREE.BoxGeometry(8, 8, .5);
  else if (type === 'floor') geo = new THREE.BoxGeometry(8, .5, 8);
  else { geo = new THREE.BoxGeometry(8, .5, 11.3); }
  const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: woodTex, roughness: .8, transparent: true, opacity: 0 }));
  const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#2fa8ff', transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#9fe4ff', transparent: true }));
  // blueprint inner grid lines
  const gl = new THREE.LineSegments(new THREE.WireframeGeometry(type === 'wall' ? new THREE.PlaneGeometry(8, 8, 4, 4) : new THREE.PlaneGeometry(8, type === 'ramp' ? 11.3 : 8, 4, 4)), new THREE.LineBasicMaterial({ color: '#2fa8ff', transparent: true, opacity: .5 }));
  if (type !== 'wall') gl.rotation.x = -Math.PI / 2;
  g.add(solid, ghost, edges, gl);
  g.position.set(x, y + (type === 'floor' ? .25 : 4), z);
  g.rotation.set(type === 'ramp' ? Math.PI / 4 : 0, ry, 0, 'YXZ');
  const holder = new THREE.Group(); holder.add(g);
  buildScene.add(holder);
  return { holder, g, solid, ghost, edges, gl };
});

// ================================================================= per-frame drivers
function setSky(top, hor, sunCol, sunDir, fogCol, fogNear, fogFar) {
  skyMat.uniforms.uTop.value.set(top); skyMat.uniforms.uHor.value.set(hor); skyMat.uniforms.uSunCol.value.set(sunCol);
  skyMat.uniforms.uSun.value.copy(sunDir); isle.fog.color.set(fogCol); isle.fog.near = fogNear; isle.fog.far = fogFar;
  waterMat.uniforms.uSunCol.value.set(sunCol);
}
function cloudTint(c, a) { for (const g of [clouds, diveClouds]) for (const m of g.children) { m.material.color.set(c); m.material.opacity = a * (g === diveClouds ? .7 : 1); } }
const DAY = () => { cloudTint('#ffffff', .9); setSky('#2f7fe8', '#bfe6ff', '#fff3d6', new THREE.Vector3(-.5, .55, -.6), '#a9d6ff', 220, 1100); sun.color.set('#fff2d6'); sun.position.set(-80, 120, -60); sun.intensity = 2.1; hemi.intensity = .75; };
const DUSK = (k = 1) => { cloudTint('#c98a96', .55);
  setSky('#2a2a7a', '#ff9a5a', '#ffb070', new THREE.Vector3(.2, .08, -1), '#d9907a', 180, 900);
  sun.color.set('#ffb27a'); sun.position.set(40, 30, -120); sun.intensity = 2.2 * k + .4; hemi.intensity = .6;
};
// camera helper: position + look target
function camLook(cam, p, look, roll = 0) { cam.position.copy(p); cam.up.set(Math.sin(roll), Math.cos(roll), 0); cam.lookAt(look); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);
function render(scene, cam) { R.render(scene, cam); }
// project a world point to 2D canvas pixels with a camera
function proj(cam, v) { const p = v.clone().project(cam); return [(p.x * .5 + .5) * W, (-p.y * .5 + .5) * H, p.z]; }
function showOnly(...objs) { for (const o of [bus, clouds, diveClouds, diver]) o.visible = objs.includes(o); }
