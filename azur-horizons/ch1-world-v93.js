/* AZUR v93 — ch1-world-v93.js : le monde « Chapitre 1 » (design/azur-reference-spec.md §5, §8).
 *  - ciel bleu vif, nuages doux et soleil chaud (dôme qui suit la caméra : jamais coupé
 *    par le plan lointain, donc plus de « dôme noir ») ;
 *  - herbe verte saturée avec grain et variations, falaises brunes, plages claires ;
 *  - chemins de terre entre les villes, rues claires dans les quartiers, asphalte
 *    marqué seulement dans la grande ville ;
 *  - forêts de grands pins étagés et d'arbres ronds, buissons et rochers instanciés
 *    par morceaux (la flore solide vient de la simulation : world.flora) ;
 *  - le Point Zéro et les autres restes de l'événement « La Fin » sont masqués hors
 *    du mode événement (le mode événement garde tout son spectacle).
 * Couche tardive : enveloppe Environment.prototype.update et AZArt.objectModel. */
(function (root) {
  'use strict';
  const T = root.THREE, S = root.AZSim, A = root.AZArt;
  const E = root.AZEnvironment && root.AZEnvironment.Environment && root.AZEnvironment.Environment.prototype;
  const V = root.AZView && root.AZView.View && root.AZView.View.prototype;
  if (!T || !S || !A || !E || !V) return;
  const M = S.MAP;
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const C = (h) => new T.Color(h);
  const W = root.AZCh1World = root.AZCh1World || {};
  const isEventWorld = () => { const w = root.AZUR && root.AZUR.world; return !!(w && w.mode === 'event') || !!(root.AZEvent && root.AZEvent.active); };
  const cityStyle = (r) => !!r && (r.style === 'citadel' || r.city === true);
  W.cityStyle = cityStyle;

  /* ------------------------------------------------------------------ ciel */
  const SKY_NOISE = 'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}' +
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}' +
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n2(p);p=p*2.02+vec2(17.1,9.2);a*=.5;}return v;}';
  function skyMaterial() {
    return new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: true, fog: false,
      uniforms: { day: { value: 1 }, time: { value: 0 }, sunDir: { value: new T.Vector3(-.42, .72, .38).normalize() }, dusk: { value: 0 } },
      vertexShader: 'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
      fragmentShader: 'uniform float day,time,dusk;uniform vec3 sunDir;varying vec3 vD;' + SKY_NOISE +
        'void main(){vec3 d=normalize(vD);float y=d.y;' +
        'vec3 zen=vec3(.13,.45,.86),mid=vec3(.34,.66,.95),hor=vec3(.78,.90,.97),gnd=vec3(.66,.80,.88);' +
        'vec3 c=mix(hor,mid,smoothstep(.0,.22,y));c=mix(c,zen,smoothstep(.18,.85,y));c=mix(c,gnd,smoothstep(0.,-.25,y));' +
        'float sd=max(0.,dot(d,sunDir));c+=vec3(1.,.86,.62)*pow(sd,10.)*.22+vec3(1.,.93,.78)*pow(sd,64.)*.35;c=mix(c,vec3(1.,.98,.9),smoothstep(.9993,.9997,sd));' +
        /* nuages doux : couche plane projetée, ombrés vers le bas, effacés à l'horizon */
        'if(y>.015){vec2 uv=d.xz/(y+.12)*1.15+vec2(time*.004,time*.0016);float n=fbm(uv);float n2b=fbm(uv*1.9+vec2(4.1,1.7));float cov=smoothstep(.50,.74,n*.78+n2b*.32);' +
        'float shade=smoothstep(.45,.95,fbm(uv+sunDir.xz*.12));vec3 cc=mix(vec3(.80,.86,.93),vec3(1.,1.,1.),shade*.8+.2);cc+=vec3(1.,.9,.75)*pow(sd,6.)*.18;' +
        'float fade=smoothstep(.015,.16,y)*(1.-smoothstep(.75,.98,y)*.55);c=mix(c,cc,cov*fade*.92);}' +
        'vec3 night=vec3(.02,.05,.13)+vec3(.05,.07,.12)*(1.-abs(y));vec3 duskC=mix(vec3(1.,.58,.42),vec3(.42,.32,.62),smoothstep(0.,.5,y));' +
        'c=mix(c,duskC*(.7+.3*c),dusk*.65);c=mix(night,c,day);gl_FragColor=vec4(c,1.);}'
    });
  }

  /* ------------------------------------------------------------- terrain */
  function grassTexture() {
    const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), r = rng(9301);
    g.fillStyle = 'rgb(222,226,214)'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) { // nappes douces
      const x = r() * n, y = r() * n, rad = 20 + r() * 70, gr = g.createRadialGradient(x, y, 1, x, y, rad), lum = r() > .5;
      gr.addColorStop(0, lum ? `rgba(250,250,236,${.10 + r() * .12})` : `rgba(150,170,140,${.08 + r() * .10})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      for (const ox of [-n, n]) { g.save(); g.translate(ox, 0); g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.restore(); }
    }
    for (let i = 0; i < 14000; i++) { // brins
      const x = r() * n, y = r() * n, len = 3 + r() * 7, a = -Math.PI / 2 + (r() - .5) * .9, v = 150 + r() * 105 | 0, gg = Math.min(255, v + 12);
      g.strokeStyle = `rgba(${v - 18},${gg},${v - 30},${.20 + r() * .30})`; g.lineWidth = .8 + r() * 1.1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    for (let i = 0; i < 900; i++) { const x = r() * n, y = r() * n; g.fillStyle = `rgba(${90 + r() * 40 | 0},${110 + r() * 40 | 0},${80 + r() * 30 | 0},${.18 + r() * .2})`; g.fillRect(x, y, 1 + r() * 2, 1 + r() * 2); }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    tex.repeat.set(M.halfSize * 2 / 5.5, M.halfSize * 2 / 5.5);
    return tex;
  }
  const PAL = {
    grass: C('#4fa62c'), grass2: C('#73c23a'), lush: C('#3f9a2a'), yellow: C('#93c742'), forest: C('#3b8428'),
    rock: C('#8f7b62'), rock2: C('#a8977c'), sand: C('#ead7a1'), wet: C('#cdb57f'), dirt: C('#a88458'), lawn: C('#5fb63a'),
    snow: C('#edf4f7'), desert: C('#dcb06c'), ash: C('#5b524c'), swamp: C('#3d6b2c'), swamp2: C('#56742f'), field: C('#c9a94a'), field2: C('#b58e3c')
  };
  const tc = new T.Color(), tb = new T.Color();
  /* Couleur du sol (multipliée ensuite par le grain d'herbe). Les zones optionnelles
   * (marais, champs) viennent de S.groundZone quand la géographie les définit. */
  function groundColor(x, z) {
    const h = S.heightAt(x, z), d = S.coastDistance(x, z);
    const slope = Math.abs(S.heightAt(x + 3, z) - h) + Math.abs(S.heightAt(x, z + 3) - h);
    const g1 = Math.sin(x * .021 + z * .017) * .5 + Math.sin(x * .0067 - z * .0089 + 1.3) * .5, g2 = Math.sin(x * .053 - z * .041) * .5 + .5;
    tc.copy(PAL.grass).lerp(PAL.grass2, smooth(-.4, .8, g1) * .75);
    tc.lerp(PAL.yellow, smooth(.55, 1, Math.sin(x * .0131 - 2.1) * Math.sin(z * .0117 + .7)) * .45);
    tc.lerp(PAL.lush, g2 * .18);
    const ff = S.forestField ? S.forestField(x, z) : 0;
    tc.lerp(PAL.forest, smooth(.2, 1.2, ff) * .55);
    const zone = S.groundZone ? S.groundZone(x, z) : null;
    if (zone) {
      if (zone.swamp) { tb.copy(PAL.swamp).lerp(PAL.swamp2, g2); tc.lerp(tb, zone.swamp); }
      if (zone.field) { tb.copy(PAL.field).lerp(PAL.field2, (Math.sin(x * .9) * .5 + .5) * .5 + g2 * .3); tc.lerp(tb, zone.field); }
      if (zone.dirt) tc.lerp(PAL.dirt, zone.dirt);
    } else if (S.zoneWeights) {
      const w = S.zoneWeights(x, z);
      if (w.snow) tc.lerp(PAL.snow, Math.min(1, w.snow * (.4 + h / 60)));
      if (w.desert) tc.lerp(PAL.desert, w.desert * .9);
      if (w.volcano) tc.lerp(PAL.ash, w.volcano * .9);
    }
    const town = S.townPad ? S.townPad(x, z, 0) : null;
    if (town) tc.lerp(PAL.lawn, .35);
    // falaises : roche brune dès que la pente se raidit
    tb.copy(PAL.rock).lerp(PAL.rock2, g2); tc.lerp(tb, smooth(2.6, 6.5, slope));
    const shore = smooth(M.shoreStart - 30, M.shoreStart - 6, d);
    if (shore > 0) tc.lerp(PAL.sand, shore);
    if (d > M.shoreEnd - 24) tc.lerp(PAL.wet, smooth(M.shoreEnd - 24, M.shoreEnd, d));
    if (h < -1.2) tc.lerp(PAL.wet, smooth(-1.2, -2.6, h));
    const L = S.LAKE;
    if (L) { const lr = Math.hypot(x - L.x, z - L.z) / L.r; if (lr < 1.4) tc.lerp(PAL.sand, (1 - smooth(1.05, 1.4, lr)) * (h < -1.5 ? .6 : .75)); }
    return tc;
  }
  W.groundColor = groundColor;
  function terrainMaterial(tex) {
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0, map: tex });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
        '#ifdef USE_MAP\nvec4 t1=texture2D(map,vMapUv);vec4 t2=texture2D(map,vMapUv*.173+vec2(.31,.17));vec4 sampledDiffuseColor=mix(t1,t2,.42);diffuseColor*=sampledDiffuseColor*1.13;\n#endif');
    };
    return mat;
  }
  function recolourTerrain(env) {
    const geo = env.terrain && env.terrain.geometry, pos = geo && geo.attributes.position;
    if (!pos) return;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const c = groundColor(pos.getX(i), pos.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const old = env.terrain.material;
    env.terrain.material = terrainMaterial(grassTexture());
    if (old && old !== A.material) old.dispose && old.dispose();
  }

  /* ------------------------------------------------------- routes et rues */
  function buildRoads(env) {
    const pos = [], col = [], c = new T.Color(), r = rng(4242);
    const H = (x, z) => (env.surfaceHeight ? Math.max(env.surfaceHeight(x, z), S.heightAt(x, z)) : S.heightAt(x, z));
    const strip = (line, width, hex, lift, step, jitter = .05, edgeHex = null) => {
      const base = C(hex), edge = edgeHex ? C(edgeHex) : null;
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        if (len < .05) continue;
        const n = Math.max(1, Math.ceil(len / step)), nx = -dz / len * width / 2, nz = dx / len * width / 2;
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n, x0 = a.x + dx * t0, z0 = a.z + dz * t0, x1 = a.x + dx * t1, z1 = a.z + dz * t1;
          const v = 1 - jitter + r() * jitter * 2;
          const quad = [[x0 - nx, z0 - nz, 0], [x0 + nx, z0 + nz, 1], [x1 + nx, z1 + nz, 1], [x0 - nx, z0 - nz, 0], [x1 + nx, z1 + nz, 1], [x1 - nx, z1 - nz, 0]];
          for (const q of quad) {
            pos.push(q[0], H(q[0], q[1]) + lift, q[1]);
            c.copy(base).multiplyScalar(v); if (edge) c.lerp(edge, .0);
            col.push(c.r, c.g, c.b);
          }
        }
      }
    };
    const regionOf = (line) => { const m = line[Math.floor(line.length / 2)] || line[0], q = line.length > 1 ? { x: (line[0].x + line[line.length - 1].x) / 2, z: (line[0].z + line[line.length - 1].z) / 2 } : m; return S.townPad ? S.townPad(q.x, q.z, 6) : null; };
    // chemins de terre entre les villes (bande d'herbe usée + piste + bande centrale plus claire)
    for (const line of S.roads || []) {
      strip(line, 7.6, '#7f9a45', .05, 3, .06);
      strip(line, 5.4, '#a78558', .075, 3, .07);
      strip(line, 1.8, '#b99a6c', .085, 3, .05);
    }
    // rues : claires et sans marquage dans les quartiers, asphalte marqué dans la grande ville
    for (const line of S.streets || []) {
      const reg = regionOf(line);
      if (cityStyle(reg)) {
        strip(line, 10.4, '#bdb8ad', .06, 4, .03);
        strip(line, 7.4, '#4b5157', .08, 4, .04);
        for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i], len = Math.hypot(b.x - a.x, b.z - a.z); for (let at = 6; at < len - 3; at += 9) { const t = at / len, u = Math.min(1, (at + 3) / len); strip([{ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }], .22, '#f2efe4', .1, 4, 0); } }
      } else {
        strip(line, 7.6, '#c9c6bb', .06, 5, .03);
        strip(line, 6.4, '#8f9397', .08, 5, .05);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const mesh = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.receiveShadow = true; mesh.renderOrder = 1; mesh.name = 'ch1-roads'; mesh.userData.shared = true;
    return mesh;
  }

  /* ------------------------------------------------------------- flore */
  // Géométries fusionnées (position, normale, couleur), unité : un arbre d'échelle 1.
  function merge(parts) {
    let n = 0; for (const p of parts) n += p.g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3); let o = 0;
    for (const p of parts) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g, a = g.attributes.position, nn = g.attributes.normal, base = C(p.c), top = p.c2 ? C(p.c2) : base;
      let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < a.count; i++) { y0 = Math.min(y0, a.getY(i)); y1 = Math.max(y1, a.getY(i)); }
      for (let i = 0; i < a.count; i++, o++) {
        P[o * 3] = a.getX(i); P[o * 3 + 1] = a.getY(i); P[o * 3 + 2] = a.getZ(i);
        N[o * 3] = nn.getX(i); N[o * 3 + 1] = nn.getY(i); N[o * 3 + 2] = nn.getZ(i);
        const k = (a.getY(i) - y0) / Math.max(1e-3, y1 - y0), sh = (p.lo == null ? .78 : p.lo) + ((p.hi == null ? 1.12 : p.hi) - (p.lo == null ? .78 : p.lo)) * k;
        tc.copy(base).lerp(top, k).multiplyScalar(sh); Cc[o * 3] = tc.r; Cc[o * 3 + 1] = tc.g; Cc[o * 3 + 2] = tc.b;
      }
      if (g !== p.g) g.dispose(); p.g.dispose();
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3));
    g.computeBoundingSphere(); return g;
  }
  const at = (g, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => { g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
  function bumpy(g, amp, seed) { const p = g.attributes.position, r = rng(seed), map = new Map(); for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 97) + ',' + Math.round(p.getY(i) * 97) + ',' + Math.round(p.getZ(i) * 97); let f = map.get(k); if (f == null) { f = 1 + (r() - .5) * amp; map.set(k, f); } p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); } g.computeVertexNormals(); return g; }
  function pineGeo(far) {
    const seg = far ? 6 : 9, parts = [{ g: at(new T.CylinderGeometry(.17, .3, 2.6, far ? 5 : 7), 0, 1.3, 0), c: '#5d4130', lo: .8, hi: 1 }];
    const tiers = far ? [[1.9, 4.6, 2.55], [4.6, 3.9, 1.85], [7.2, 3.6, 1.2]] : [[1.8, 4.2, 2.6], [3.9, 3.8, 2.15], [6.0, 3.4, 1.7], [8.0, 3.1, 1.15]];
    tiers.forEach(([y, h, r], i) => parts.push({ g: at(new T.ConeGeometry(r, h, seg, 1), 0, y + h / 2, 0, 1, 1, 1, i * .7), c: i % 2 ? '#2f7536' : '#2a6b31', c2: '#4c9a44', lo: .62, hi: 1.12 }));
    return merge(parts);
  }
  function oakGeo(far) {
    const det = far ? 0 : 1, parts = [{ g: at(new T.CylinderGeometry(.24, .4, 3.4, far ? 5 : 7), 0, 1.7, 0), c: '#6a4a33', lo: .85, hi: 1 }];
    if (!far) parts.push({ g: at(new T.CylinderGeometry(.1, .18, 1.9, 5), .5, 3.3, 0, 1, 1, 1, 0, 0, -.7), c: '#6a4a33' });
    const blobs = far ? [[0, 5.2, 0, 2.7], [1.0, 4.6, .6, 1.9]] : [[0, 5.3, 0, 2.55], [1.45, 4.7, .5, 1.85], [-1.35, 4.8, -.4, 1.9], [.3, 6.5, -.6, 1.7], [-.4, 4.3, 1.3, 1.6]];
    blobs.forEach(([x, y, z, r], i) => parts.push({ g: bumpy(at(new T.IcosahedronGeometry(r, det), x, y, z, 1, .86, 1), .1, 31 + i), c: i % 2 ? '#4c9a33' : '#55a536', c2: '#86c443', lo: .6, hi: 1.12 }));
    return merge(parts);
  }
  function rockGeo(far) {
    const g = bumpy(at(new T.IcosahedronGeometry(1, far ? 0 : 1), 0, .38, 0, 1, .68, .92), .28, 77);
    return merge([{ g, c: '#8a857b', c2: '#b3ad9f', lo: .7, hi: 1.08 }]);
  }
  function bushGeo(far) {
    const det = far ? 0 : 1, parts = [];
    [[0, .55, 0, .85], [.7, .45, .2, .62], [-.62, .42, -.18, .64], [.1, .8, -.3, .55]].slice(0, far ? 2 : 4).forEach(([x, y, z, r], i) => parts.push({ g: bumpy(at(new T.IcosahedronGeometry(r, det), x, y, z, 1, .82, 1), .14, 50 + i), c: '#3f8a2c', c2: '#79b942', lo: .62, hi: 1.08 }));
    return merge(parts);
  }
  const floraUniforms = { time: { value: 0 } };
  function floraMaterial(sway, flat) {
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, flatShading: !!flat });
    if (sway) m.onBeforeCompile = (sh) => {
      sh.uniforms.ch1Time = floraUniforms.time;
      sh.vertexShader = 'uniform float ch1Time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvec3 ch1A=instanceMatrix[3].xyz;float ch1S=sin(ch1Time*1.3+ch1A.x*.13+ch1A.z*.09)*.022+sin(ch1Time*2.7+ch1A.z*.21)*.008;transformed.x+=ch1S*max(0.,position.y-2.);transformed.z+=ch1S*.6*max(0.,position.y-2.);\n#endif');
    };
    return m;
  }
  W.geometries = null;
  function geos() {
    if (W.geometries) return W.geometries;
    W.geometries = {
      near: [pineGeo(false), oakGeo(false), rockGeo(false), bushGeo(false)],
      far: [pineGeo(true), oakGeo(true), rockGeo(true), bushGeo(true)],
      mats: [floraMaterial(true), floraMaterial(true), floraMaterial(false, true), floraMaterial(false)]
    };
    W.geometries.mats.forEach((m) => { m.userData.ch1Shared = true; });
    return W.geometries;
  }
  W.floraGeometry = (k, far) => geos()[far ? 'far' : 'near'][k];
  W.floraMaterial = (k) => geos().mats[k];

  const CHUNK = 220, NCH = Math.ceil(M.halfSize * 2 / CHUNK);
  const chunkOf = (x, z) => Math.max(0, Math.min(NCH - 1, Math.floor((x + M.halfSize) / CHUNK))) * NCH + Math.max(0, Math.min(NCH - 1, Math.floor((z + M.halfSize) / CHUNK)));
  // Buissons décoratifs (non solides) : tirage fixe, hors villes, routes, plages.
  function bushItems() {
    const r = rng(7171), out = [];
    for (let i = 0; i < 26000 && out.length < 2600; i++) {
      const x = (r() - .5) * M.halfSize * 2, z = (r() - .5) * M.halfSize * 2, roll = r(), s = .7 + r() * .9, yaw = r() * 6.283;
      const ff = S.forestField ? S.forestField(x, z) : 0, p = .05 + smooth(-.2, 1, ff) * .35;
      if (roll > p) continue;
      if (S.coastDistance(x, z) > M.shoreStart - 22 || S.heightAt(x, z) < -1.3 || (S.isWater && S.isWater(x, z))) continue;
      if (S.routeDist && S.routeDist(x, z) < 5) continue;
      if (S.townPad && S.townPad(x, z, 4)) continue;
      out.push({ k: 3, x, z, s, yaw, dead: false });
    }
    return out;
  }
  function buildFlora(env, world) {
    const G = geos(), group = new T.Group(); group.name = 'ch1-flora';
    const flora = (world && world.flora) || [], bushes = W._bushes || (W._bushes = bushItems());
    const buckets = new Map();
    const put = (f) => { const key = chunkOf(f.x, f.z) * 4 + f.k; let b = buckets.get(key); if (!b) buckets.set(key, b = []); b.push(f); };
    flora.forEach(put); bushes.forEach(put);
    const d = new T.Object3D(), col = new T.Color(), chunks = [];
    const tint = [[C('#ffffff'), C('#d8f0c8'), C('#c9dfb8')], [C('#ffffff'), C('#e6f5c0'), C('#d5eab0')], [C('#ffffff'), C('#e8e2d6'), C('#d4d9cc')], [C('#ffffff'), C('#e0f2c4'), C('#cfe6b4')]];
    const surf = (x, z) => { const a = S.heightAt(x, z), b = env.surfaceHeight ? env.surfaceHeight(x, z) : a; return Math.min(a, b); };
    for (const [key, list] of buckets) {
      const k = key % 4, ci = (key - k) / 4, near = new T.InstancedMesh(G.near[k], G.mats[k], list.length);
      list.forEach((f, i) => {
        const y = surf(f.x, f.z) - (k === 2 ? .05 : .15);
        d.position.set(f.x, y, f.z); d.rotation.set(0, f.yaw || 0, 0);
        if (k === 2) d.scale.set(f.s, f.s * (.8 + ((i * 37) % 10) * .05), f.s * .95); else d.scale.setScalar(f.s);
        if (f.dead) d.scale.setScalar(0);
        d.updateMatrix(); near.setMatrixAt(i, d.matrix);
        const tv = tint[k][(i * 7 + (f.i || 0)) % 3]; col.copy(tv).multiplyScalar(.92 + ((i * 13) % 9) * .02); near.setColorAt(i, col);
      });
      near.instanceMatrix.needsUpdate = true; if (near.instanceColor) near.instanceColor.needsUpdate = true;
      near.computeBoundingSphere();
      const far = new T.InstancedMesh(G.far[k], G.mats[k], list.length);
      far.instanceMatrix = near.instanceMatrix; far.instanceColor = near.instanceColor; far.count = list.length; far.boundingSphere = near.boundingSphere.clone();
      [near, far].forEach((m) => { m.castShadow = k !== 3; m.receiveShadow = true; m.userData.shared = true; group.add(m); });
      const cx = (Math.floor(ci / NCH) + .5) * CHUNK - M.halfSize, cz = ((ci % NCH) + .5) * CHUNK - M.halfSize;
      chunks.push({ k, cx, cz, near, far, list, dead: list.map((f) => !!f.dead) });
    }
    group.userData.chunks = chunks;
    return group;
  }
  function refreshDeadFlora(group) {
    const d = new T.Object3D(), m4 = new T.Matrix4();
    for (const ch of group.userData.chunks) {
      let dirty = false;
      ch.list.forEach((f, i) => { if (f.dead && !ch.dead[i]) { ch.dead[i] = true; ch.near.getMatrixAt(i, m4); m4.decompose(d.position, d.quaternion, d.scale); d.scale.setScalar(0); d.updateMatrix(); ch.near.setMatrixAt(i, d.matrix); dirty = true; } });
      if (dirty) ch.near.instanceMatrix.needsUpdate = true;
    }
  }

  /* -------------------------------------------- objets « arbre » / « rocher » de la simulation */
  const legacyObjectModel = A.objectModel;
  A.objectModel = function (o) {
    if (!o || (o.type !== 'tree' && o.type !== 'rock')) return legacyObjectModel.apply(this, arguments);
    const k = o.type === 'rock' ? 2 : ((o.seed || 0) % 3 === 0 ? 1 : 0), g = new T.Group();
    const mesh = new T.Mesh(W.floraGeometry(k, false).clone(), W.floraMaterial(k));
    mesh.userData.shared = true; mesh.castShadow = true; mesh.receiveShadow = true;
    if (k === 2) mesh.scale.set(o.w * 1.05, Math.max(.6, o.h * .45), o.w); else mesh.scale.setScalar(k === 0 ? Math.max(.7, o.h / 5.5) : Math.max(.7, o.h / 4.6));
    g.add(mesh); g.position.set(o.x, o.y, o.z); g.rotation.y = o.yaw || ((o.seed || 0) % 628) / 100;
    Object.assign(g.userData, { type: o.type, hp: o.hp, ch1: true });
    return g;
  };

  /* ---------------------------------------------- installation et mise à jour */
  function hideOld(env) {
    const list = [];
    const add = (o) => { if (o) list.push({ o, vis: o.visible }); };
    add(env.roads); add(env.streetFurniture);
    (env.decorations || []).forEach((q) => add(q.mesh)); (env.flags || []).forEach(add);
    if (env.rockFormations) { add(env.rockFormations.base); add(env.rockFormations.cap); }
    (env.scenery || []).forEach((q) => add(q.mesh));
    const v2 = env.worldV2 || {};
    const sky = (o) => { if (o) list.push({ o, vis: o.visible, sky: true }); };
    sky(v2.sky); sky(v2.clouds); add(v2.ridges); add(v2.flora); add(v2.landmarks); add(v2.palms);
    const v65 = env.v65MapDetails;
    if (v65) [1, 2, 3, 5].forEach((i) => add(v65.children[i]));
    return list;
  }
  E.ensureCh1World = function () {
    if (this.ch1World) return this.ch1World;
    const root3 = new T.Group(); root3.name = 'ch1-world-v93';
    const sky = new T.Mesh(new T.SphereGeometry(1200, 40, 24), skyMaterial());
    sky.frustumCulled = false; sky.renderOrder = -10; sky.userData.shared = true;
    sky.onBeforeRender = function (renderer, scene, camera) { this.position.copy(camera.position); this.updateMatrixWorld(true); };
    recolourTerrain(this);
    const roads = buildRoads(this);
    root3.add(sky, roads);
    this.root.add(root3);
    this.ch1World = { root: root3, sky, roads, flora: null, world: null, hidden: hideOld(this), t: 0, rev: -1 };
    return this.ch1World;
  };
  const previousUpdate = E.update;
  E.update = function (dt, focus, day, quality) {
    const r = previousUpdate.apply(this, arguments);
    try {
      const cw = this.ensureCh1World(), ev = isEventWorld(), view = root.AZUR && root.AZUR.view;
      cw.t += dt || 0; floraUniforms.time.value = cw.t;
      // v94 : même île en mode événement (routes, arbres, sol) ; seul le ciel reste celui de l'événement
      cw.root.visible = true; cw.sky.visible = !ev;
      if (ev !== cw.wasEvent) { for (const h of cw.hidden) h.o.visible = ev && h.sky ? h.vis : false; cw.wasEvent = ev; }
      for (const h of cw.hidden) if (!ev || !h.sky) h.o.visible = false;
      if (view && view._zp82 && !ev) view._zp82.visible = false;
      const u = cw.sky.material.uniforms; u.time.value = cw.t;
      if (ev) { /* le ciel de l'événement garde ses couleurs */ } u.day.value = day == null ? 1 : day;
      u.dusk.value = root.AZUR && root.AZUR.timeOfDay === 'sunset' ? 1 : 0;
      if (view && view.fogDay && !cw.fogSet) { view.fogDay.set('#c6e2f2'); cw.fogSet = true; }
      const w = root.AZUR && root.AZUR.world;
      if (w && w !== cw.world) {
        if (cw.flora) { cw.root.remove(cw.flora); }
        cw.world = w; cw.flora = buildFlora(this, w); cw.root.add(cw.flora); cw.rev = w.floraRev | 0;
      }
      if (cw.flora) {
        if (w && (w.floraRev | 0) !== cw.rev) { cw.rev = w.floraRev | 0; refreshDeadFlora(cw.flora); }
        const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0, low = quality === 'low', premium = quality === 'high' || quality === 'ultra';
        const ad = Math.max(.6, Math.min(1, (view && view.adaptiveDetail) || 1));
        const dist = (view && view.drawDistance ? Math.max(260, view.drawDistance * 1.15) : 600) * ad * (view && view.v2UltraLow ? .75 : 1);
        const airborne = focus && (focus.falling || focus.gliding || (w && w.phase === 'transport'));
        const reach = airborne ? Math.max(dist, 900) : dist, nearR = low ? 120 : premium ? 260 : 190;
        for (const ch of cw.flora.userData.chunks) {
          const dx = Math.max(0, Math.abs(fx - ch.cx) - CHUNK / 2), dz = Math.max(0, Math.abs(fz - ch.cz) - CHUNK / 2), dd = Math.hypot(dx, dz);
          const lim = ch.k === 3 ? Math.min(reach, low ? 160 : 320) : ch.k === 2 ? Math.min(reach, 520) : reach;
          const on = dd < lim, isNear = on && dd < nearR && !airborne;
          ch.near.visible = isNear; ch.far.visible = on && !isNear;
          ch.near.castShadow = premium && ch.k !== 3; ch.far.castShadow = false;
        }
      }
    } catch (e) { if (!E._ch1Err) { E._ch1Err = 1; console.warn('ch1-world', e); } }
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
