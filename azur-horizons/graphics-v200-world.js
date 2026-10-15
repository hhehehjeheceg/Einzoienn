/* AZUR Horizons 2.0 — island and lobby art layer.
   Load after art-v2.js and all legacy Horizon scripts. Presentation only: AZSim
   owns all terrain samples, colliders, doors, objects, inventory and movement. */
(function (root) {
  'use strict';
  const T = root.THREE, S = root.AZSim, A = root.AZArt;
  const E = root.AZEnvironment?.Environment?.prototype, V = root.AZView?.View?.prototype;
  if (!T || !S || !A || !E || !V) return;

  const clamp = T.MathUtils.clamp;
  const map = S.MAP;
  const rng = A.rng || ((seed) => { let v = seed >>> 0; return () => ((v = Math.imul(v ^ v >>> 15, 1 | v) + 0x6d2b79f5) >>> 0) / 4294967296; });
  const routeDistance = (x, z, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, d = dx * dx + dz * dz;
    const t = d ? clamp(((x - a.x) * dx + (z - a.z) * dz) / d, 0, 1) : 0;
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
  };
  const clearOfRoutes = (x, z, margin) => ![...(S.roads || []), ...(S.streets || [])].some((line) => line.some((p, i) => i && routeDistance(x, z, line[i - 1], p) < margin));
  const outsideTowns = (x, z, margin = 12) => (S.regions || []).every((r) => Math.abs(x - r.x) > (r.padW || 0) + margin || Math.abs(z - r.z) > (r.padD || 0) + margin);
  const usableLand = (x, z, margin = 10) => S.biomeAt(x, z) !== 'water' && S.coastDistance(x, z) < map.shoreStart - 9 && clearOfRoutes(x, z, margin) && outsideTowns(x, z, 12);
  const safeSpot = (x, z, margin = 11) => {
    for (let i = 0; i < 48; i++) {
      const radius = i ? 8 + Math.floor((i - 1) / 8) * 10 : 0, angle = i * 2.3999632297;
      const qx = x + Math.cos(angle) * radius, qz = z + Math.sin(angle) * radius;
      if (usableLand(qx, qz, margin)) return { x: qx, z: qz, y: S.heightAt(qx, qz) };
    }
    return null;
  };
  const disposeMaterial = (m) => { if (m && m !== A.material) { m.map?.dispose?.(); m.dispose?.(); } };

  function islandSkyMaterial() {
    return new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { day: { value: 1 }, time: { value: 0 } },
      vertexShader: 'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float day,time;varying vec3 v;void main(){vec3 d=normalize(v);float h=clamp(d.y*.5+.5,0.,1.);vec3 night=vec3(.012,.055,.12),horizon=vec3(.18,.70,.73),zenith=vec3(.035,.28,.52);vec3 c=mix(horizon,zenith,pow(h,.72));c=mix(night,c,day);vec3 sunDir=normalize(vec3(-.42,.56,-.52));float sd=max(0.,dot(d,sunDir));float sun=pow(sd,280.);float halo=pow(sd,22.);float haze=pow(1.-abs(d.y),8.);c+=vec3(1.,.72,.40)*sun*(.35+.65*day)+vec3(1.,.78,.50)*halo*.16*day+vec3(.12,.62,.65)*haze*.10;float warm=pow(1.-abs(d.y),14.)*pow(sd,3.);c+=vec3(1.,.62,.38)*warm*.10*day;float cirrus=smoothstep(.72,1.,sin(d.x*31.+d.z*17.+time*.004)*.5+sin(d.z*43.-d.x*13.)*.5)*smoothstep(.30,.55,d.y)*(1.-smoothstep(.62,.85,d.y));c=mix(c,vec3(.94,.99,1.),cirrus*.13*day);float glow=pow(sd,90.);c+=vec3(1.,.80,.52)*glow*.22*day;float cirrus2=smoothstep(.55,1.,sin(d.x*17.-d.z*23.+time*.006)*.5+sin(d.z*29.+d.x*19.)*.5)*smoothstep(.45,.62,d.y)*(1.-smoothstep(.70,.88,d.y));c=mix(c,vec3(.96,1.,1.),cirrus2*.06*day);gl_FragColor=vec4(c,1.);}'
    });
  }
  /* Distance à la côte pré-calculée (moins 220 m, l'échelle d'origine du shader) :
     lagon, écume et vagues suivent exactement le littoral de l'île, quelle que
     soit sa forme. */
  const COAST_SPAN = 2600;
  let coastTex = null;
  function coastTexture() {
    if (coastTex) return coastTex;
    const n = 256, data = new Uint16Array(n * n), toHalf = T.DataUtils.toHalfFloat;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ((i + .5) / n - .5) * COAST_SPAN, z = ((j + .5) / n - .5) * COAST_SPAN;
      data[j * n + i] = toHalf(Math.min(2000, S.coastDistance(x, z)) - (map.shoreStart - 500));
    }
    coastTex = new T.DataTexture(data, n, n, T.RedFormat, T.HalfFloatType);
    coastTex.magFilter = T.LinearFilter; coastTex.minFilter = T.LinearFilter; coastTex.wrapS = coastTex.wrapT = T.ClampToEdgeWrapping; coastTex.needsUpdate = true;
    return coastTex;
  }
  function oceanMaterial(uniforms) {
    return new T.ShaderMaterial({
      transparent: false, side: T.DoubleSide, uniforms,
      vertexShader: 'uniform float time;varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec3 p=position;float w=sin(p.x*.027+time*.58)*.23+sin(p.y*.039-time*.42)*.16+sin((p.x+p.y)*.017+time*.28)*.13;p.z+=w;vW=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      /* Océan cartoon : dégradé lagon → large, reflets de ciel à l'horizon, lignes de
         caustiques dans les hauts-fonds, moutons au large, écume en bandes sur le rivage,
         reflet de soleil sur des vagues bruitées. Le détail s'efface avec la distance
         (plus d'effet de grille vu de haut). */
      fragmentShader: 'uniform float time,day,coastSpan;uniform sampler2D coastTex;varying vec2 vUv;varying vec3 vW;' +
        'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}' +
        'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}' +
        'void main(){float shore=texture2D(coastTex,vW.xz/coastSpan+.5).r;' +
        'float shelf=1.-smoothstep(492.,610.,shore);vec3 eye=cameraPosition-vW;float dist=length(eye);eye/=dist;float detail=1.-smoothstep(140.,780.,dist);' +
        'vec2 q=vW.xz*.045,qa=q+vec2(time*.08,time*.05);float n1=n2(qa);float n=n1*.62+n2(q*2.3-vec2(time*.12,time*.03))*.38;' +
        'vec3 deep=vec3(.015,.15,.32),mid=vec3(.03,.31,.50),lagoon=vec3(.09,.64,.66);vec3 c=mix(deep,mid,smoothstep(.15,.95,n)*.55+.12);c=mix(c,lagoon,shelf*.88);' +
        'float w1=sin(vW.x*.21+time*.9+n*4.)+sin(vW.z*.18-time*.7+n*3.4);float caust=(1.-smoothstep(0.,.3,abs(w1)))*shelf*detail;c+=vec3(.55,.95,.9)*caust*.16;' +
        'float cap=smoothstep(.8,.9,n2(vW.xz*.085+vec2(time*.16,-time*.07)))*(1.-shelf*.8)*detail;c=mix(c,vec3(.86,.96,1.),cap*.22);' +
        'float f1=pow(max(0.,sin(shore*.5-time*1.6+n*2.)),10.)*(1.-smoothstep(492.,506.,shore))*smoothstep(474.,490.,shore);' +
        'float f2=pow(max(0.,sin(shore*.26-time*1.05+n*1.5)),8.)*(1.-smoothstep(498.,530.,shore))*smoothstep(488.,500.,shore);c=mix(c,vec3(.92,.99,.96),clamp(f1*.75+f2*.35,0.,1.));' +
        'vec3 nrm=normalize(vec3((n2(qa+vec2(.06,0.))-n1)*2.2,1.,(n2(qa+vec2(0.,.06))-n1)*2.2));vec3 sunDir=normalize(vec3(-.42,.56,-.52));vec3 hv=normalize(eye+sunDir);' +
        'float g=pow(max(0.,dot(nrm,hv)),220.)*1.6*detail+pow(max(0.,dot(nrm,hv)),28.)*.12;c+=vec3(1.,.86,.6)*g*day;' +
        'float fr=pow(1.-clamp(eye.y,0.,1.),4.);c=mix(c,vec3(.42,.72,.84)*(.35+.65*day),fr*.5);c*=.5+.5*day;gl_FragColor=vec4(c,1.);}'
    });
  }
  /* Nuages v71 : de vrais cumulus gonflés (grappes de boules), éclairés par le
     soleil, posés haut au-dessus de l'île. Un seul maillage instancié. */
  function makeCloudBank(seed) {
    const random = rng(seed), clusters = 46, per = 7, count = clusters * per, geo = new T.IcosahedronGeometry(1, 2);
    const mat = new T.MeshLambertMaterial({ color: '#ffffff', emissive: '#8da4bd', emissiveIntensity: .32, transparent: true, opacity: .96, depthWrite: true });
    const mesh = new T.InstancedMesh(geo, mat, count);
    const d = new T.Object3D(), tints = ['#ffffff', '#fbfdff', '#fff8ee', '#f2f7ff'];
    let n = 0;
    for (let c = 0; c < clusters; c++) {
      const a = random() * Math.PI * 2, rad = 250 + Math.sqrt(random()) * 1350, y = 290 + random() * 150, size = 22 + random() * 30, yaw = random() * Math.PI;
      const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad, tint = new T.Color(tints[Math.floor(random() * tints.length)]);
      for (let k = 0; k < per; k++) {
        const along = (k - (per - 1) / 2) / per * 2.4, r = size * (k === 3 ? 1 : .55 + random() * .4) * (1 - Math.abs(along) * .25);
        const lx = along * size * 1.1, lz = (random() - .5) * size * .8;
        d.position.set(cx + Math.cos(yaw) * lx - Math.sin(yaw) * lz, y + r * .35 + (k === 3 ? size * .2 : 0), cz + Math.sin(yaw) * lx + Math.cos(yaw) * lz);
        d.rotation.set(0, random() * Math.PI, 0); d.scale.set(r * 1.25, r * .8, r); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix); mesh.setColorAt(n, tint); n++;
      }
    }
    mesh.count = n; mesh.frustumCulled = false; mesh.renderOrder = -2; mesh.userData.max = n; mesh.castShadow = false; mesh.receiveShadow = false;
    return mesh;
  }
  /* Îles lointaines : de vraies silhouettes opaques (pics, collines, plage)
     posées sur l'océan autour de l'île. Le brouillard les fond dans l'horizon ;
     tout est fusionné en un seul maillage, un seul appel de dessin. */
  function makeDistantRidges() {
    const pos = [], nor = [], col = [], random = rng(734), m4 = new T.Matrix4(), q = new T.Quaternion(), c = new T.Color();
    const push = (geo, x, y, z, sx, sy, sz, ry, hex, jitter) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), ry); m4.compose(new T.Vector3(x, y, z), q, new T.Vector3(sx, sy, sz));
      g.applyMatrix4(m4); g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal;
      for (let i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i));
        c.set(hex); const h = P.getY(i); if (h > y + sy * .55) c.lerp(new T.Color('#e9eef0'), jitter); c.offsetHSL(0, 0, (random() - .5) * .04); col.push(c.r, c.g, c.b);
      }
    };
    const islands = 16;
    for (let i = 0; i < islands; i++) {
      const a = (i + random() * .6) * Math.PI * 2 / islands, r = 1550 + random() * 520, x = Math.cos(a) * r, z = Math.sin(a) * r, size = 70 + random() * 120;
      push(new T.CylinderGeometry(size * 1.05, size * 1.2, 5, 10), x, -4, z, 1, 1, .8 + random() * .4, random() * 6, '#cbbf98', 0);
      push(new T.IcosahedronGeometry(1, 1), x, -size * .12, z, size * .95, size * .38, size * .7, random() * 6, '#5b9a66', 0);
      const peaks = 1 + Math.floor(random() * 3);
      for (let k = 0; k < peaks; k++) {
        const h = size * (.38 + random() * .62), w = size * (.42 + random() * .3), ox = (random() - .5) * size * .8, oz = (random() - .5) * size * .5;
        push(new T.ConeGeometry(1, 1, 7, 3), x + ox, -2 + h / 2, z + oz, w, h, w * (.7 + random() * .5), random() * 6, k ? '#4a8458' : '#5a9363', h > size * .85 ? .5 : 0);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const mesh = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.frustumCulled = false; mesh.renderOrder = -2;
    return mesh;
  }
  function terrainColour(x, z) {
    const biome = S.biomeAt(x, z), coast = S.coastDistance(x, z), c = new T.Color('#4d9c67');
    if (biome === 'snow') c.set('#7298a0');
    else if (biome === 'desert') c.set('#c78a52');
    else if (coast > map.shoreStart - 38) c.set('#dfbd7c');
    c.offsetHSL(Math.sin(x * .019 + z * .013) * .014, 0, Math.sin(x * .007 - z * .011) * .035);
    return c;
  }
  function recolourTerrain(env) {
    const geo = env.terrain?.geometry, pos = geo?.attributes?.position;
    if (!pos) return;
    const colors = new Float32Array(pos.count * 3), c = new T.Color();
    for (let i = 0; i < pos.count; i++) { c.copy(terrainColour(pos.getX(i), pos.getZ(i))); colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    const groundMap=env.terrain.material.map;
    env.terrain.material = new T.MeshStandardMaterial({ vertexColors: true, map:groundMap, roughness: .98, metalness: 0, flatShading: false });
  }
  /* v72 : feuillage « nuage » façon Fortnite — trois boules lisses fusionnées,
     ombrées du dessous vers le dessus directement dans la géométrie. */
  function fluffy(parts, shadeLow = .62, shadeHigh = 1.12, detail = 1) {
    const geos = parts.map(([x, y, z, r], i) => { const g = new T.IcosahedronGeometry(r, i === 0 ? detail : 0).toNonIndexed(); g.translate(x, y, z); return g; });
    let n = 0; geos.forEach((g) => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0, minY = 1e9, maxY = -1e9;
    geos.forEach((g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i)); } });
    geos.forEach((g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++, o++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = shadeLow + (shadeHigh - shadeLow) * Math.pow((y - minY) / Math.max(.001, maxY - minY), .8);
      const wob = 1 + Math.sin(x * 7.1 + z * 5.3) * .045; pos[o * 3] = x * wob; pos[o * 3 + 1] = y * wob; pos[o * 3 + 2] = z * wob; col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = k; } g.dispose(); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  }
  function makeFlora() {
    const group = new T.Group(), random = rng(20260), d = new T.Object3D(), max = 580;
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(.12, .30, 1, 7), new T.MeshStandardMaterial({ color: '#604a36', roughness: 1, vertexColors: true }), max);
    const crown = new T.InstancedMesh(fluffy([[0, .1, 0, .8], [.44, -.1, .16, .6], [-.42, -.08, -.14, .62]]), new T.MeshStandardMaterial({ color: '#4b8c4d', roughness: .95, vertexColors: true }), max);
    const highlight = new T.InstancedMesh(fluffy([[0, 0, 0, .7], [.3, .15, .1, .45]], .85, 1.2, 0), new T.MeshStandardMaterial({ color: '#86bd62', roughness: .95, vertexColors: true }), max);
    // Underbrush bushes: one extra instanced draw call that fills the forest
    // floor between trunks. Same placement loop, quality-budgeted in update().
    const bushMax = 380, bush = new T.InstancedMesh(fluffy([[0, 0, 0, .75], [.45, -.1, .15, .5], [-.42, -.08, -.1, .52]], .6, 1.1, 0), new T.MeshStandardMaterial({ color: '#557f46', roughness: .95, vertexColors: true }), bushMax);
    let n = 0, nb = 0;
    for (let tries = 0; tries < 16000 && n < max; tries++) {
      const x = (random() - .5) * map.halfSize * 1.9, z = (random() - .5) * map.halfSize * 1.9, b = S.biomeAt(x, z);
      if (!usableLand(x, z, 12) || b === 'desert' && random() > .28) continue;
      const y = S.heightAt(x, z), h = b === 'snow' ? 5 + random() * 6 : 4 + random() * 5, w = b === 'snow' ? 1.4 + random() * 1.5 : 1.7 + random() * 2.1;
      const trunkCol = new T.Color(b === 'desert' ? '#8c6443' : '#614b35');
      const leafCol = new T.Color(b === 'snow' ? '#47767a' : b === 'desert' ? '#789257' : random() > .55 ? '#39784b' : '#4f9654');
      const highCol = leafCol.clone().lerp(new T.Color(b === 'snow' ? '#d9eeea' : '#b8d86e'), .44);
      d.position.set(x, y + h * .5, z); d.rotation.set(0, random() * Math.PI, 0); d.scale.set(w * .20, h, w * .20); d.updateMatrix(); trunk.setMatrixAt(n, d.matrix); trunk.setColorAt(n, trunkCol);
      d.position.set(x, y + h * .83, z); d.scale.set(w, h * .42, w * .82); d.rotation.set(random() * .24, random() * Math.PI, random() * .2); d.updateMatrix(); crown.setMatrixAt(n, d.matrix); crown.setColorAt(n, leafCol);
      d.position.set(x + w * .22, y + h * 1.10, z - w * .10); d.scale.set(w * .70, h * .29, w * .60); d.updateMatrix(); highlight.setMatrixAt(n, d.matrix); highlight.setColorAt(n, highCol); n++;
      // 1-2 low bushes per tree keep the forest floor from reading empty.
      const bushes = 1 + Math.floor(random() * 2);
      for (let bi = 0; bi < bushes && nb < bushMax; bi++) {
        const bx = x + (random() - .5) * w * 3.4, bz = z + (random() - .5) * w * 3.4, bs = .5 + random() * .95;
        d.position.set(bx, S.heightAt(bx, bz) + bs * .30, bz); d.rotation.set(0, random() * Math.PI, 0);
        d.scale.set(bs * (1 + random() * .5), bs * (.62 + random() * .3), bs); d.updateMatrix();
        bush.setMatrixAt(nb, d.matrix);
        const bc = new T.Color(b === 'snow' ? '#7fa3a0' : b === 'desert' ? '#93a05a' : ['#4f7d4a', '#5d8f52', '#6d9c58'][Math.floor(random() * 3)]);
        if (random() > .86) bc.lerp(new T.Color('#d8b46a'), .5); // dry tuft accent
        bush.setColorAt(nb, bc); nb++;
      }
    }
    [trunk, crown, highlight].forEach((mesh) => { mesh.count = n; mesh.userData.max = n; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh); });
    bush.count = nb; bush.userData.max = nb; bush.castShadow = false; bush.receiveShadow = true; bush.frustumCulled = false; group.add(bush);
    group.userData.meshes = [trunk, crown, highlight, bush]; group.userData.max = n; group.userData.bushMax = nb; return group;
  }
  // Beach palms: tilted trunks with a crown of arching fronds, placed only on
  // the sandy coastal band. Two instanced meshes, quality-budgeted in update().
  function makePalms() {
    const group = new T.Group(), random = rng(4041), d = new T.Object3D(), max = 130;
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(.13, .30, 1, 7), new T.MeshStandardMaterial({ color: '#7a5c40', roughness: 1, vertexColors: true }), max);
    const frond = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: '#3f9e57', roughness: 1, vertexColors: true, flatShading: true }), max * 5);
    // Coconut clusters under each crown: one extra instanced draw call.
    const nut = new T.InstancedMesh(new T.SphereGeometry(.22, 8, 6), new T.MeshStandardMaterial({ color: '#7a5a36', roughness: 1, vertexColors: true }), max * 3);
    let n = 0;
    for (let tries = 0; tries < 16000 && n < max; tries++) {
      const x = (random() - .5) * map.halfSize * 1.9, z = (random() - .5) * map.halfSize * 1.9, cd = S.coastDistance(x, z);
      if (cd < map.shoreStart - 70 || cd > map.shoreStart - 12 || S.biomeAt(x, z) === 'water' || !clearOfRoutes(x, z, 10) || !outsideTowns(x, z, 12)) continue;
      const y = S.heightAt(x, z), h = 5.5 + random() * 3.5, lean = .12 + random() * .22, yaw = random() * Math.PI * 2;
      const leanX = Math.cos(yaw) * lean, leanZ = Math.sin(yaw) * lean;
      d.position.set(x + leanX * h * .3, y + h * .5, z + leanZ * h * .3); d.rotation.set(leanZ, 0, -leanX); d.scale.set(1, h, 1); d.updateMatrix();
      trunk.setMatrixAt(n, d.matrix); trunk.setColorAt(n, new T.Color(random() > .5 ? '#7a5c40' : '#8a6a48'));
      const topX = x + leanX * h * .62, topZ = z + leanZ * h * .62, topY = y + h;
      for (let k = 0; k < 5; k++) {
        const fa = k * Math.PI * 2 / 5 + random() * .5, fl = 2.6 + random() * 1.2;
        d.position.set(topX + Math.cos(fa) * fl * .5, topY - .35 - random() * .5, topZ + Math.sin(fa) * fl * .5);
        d.rotation.set(.35 + random() * .3, fa, 0); d.scale.set(fl, .34, .9); d.updateMatrix();
        frond.setMatrixAt(n * 5 + k, d.matrix);
        frond.setColorAt(n * 5 + k, new T.Color(k % 2 ? '#46a85e' : '#2f8a4b').lerp(new T.Color('#b8d86e'), random() * .25));
      }
      for (let k = 0; k < 3; k++) {
        const na = random() * Math.PI * 2;
        d.position.set(topX + Math.cos(na) * .55, topY - .55 - random() * .3, topZ + Math.sin(na) * .55);
        d.rotation.set(0, 0, 0); d.scale.setScalar(.8 + random() * .5); d.updateMatrix();
        nut.setMatrixAt(n * 3 + k, d.matrix);
        nut.setColorAt(n * 3 + k, new T.Color(random() > .5 ? '#7a5a36' : '#8a6a42'));
      }
      n++;
    }
    [trunk, frond, nut].forEach((mesh) => { mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh); });
    trunk.count = n; frond.count = n * 5; nut.count = n * 3;
    nut.instanceMatrix.needsUpdate = true; if (nut.instanceColor) nut.instanceColor.needsUpdate = true;
    group.userData = { meshes: [trunk, frond, nut], max: n, perPalm: 5, nuts: 3 };
    return group;
  }
  function makeCoastRocks() {
    const random = rng(97), max = 180, mesh = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: '#8a725c', roughness: 1, vertexColors: true, flatShading: true }), max), d = new T.Object3D();
    let n = 0;
    for (let i = 0; i < max; i++) {
      // Un point du littoral : on part du centre dans une direction au hasard jusqu'à la côte.
      const ang = random() * Math.PI * 2, inset = 7 + random() * 34, ca = Math.cos(ang), sa = Math.sin(ang);
      let r = 200; while (r < map.halfSize && S.coastDistance(ca * r, sa * r) < map.shoreStart - inset) r += 4;
      const x = ca * r, z = sa * r;
      if (S.coastDistance(x, z) >= map.shoreStart || !clearOfRoutes(x, z, 8)) continue;
      const s = 2.2 + random() * 6, b = S.biomeAt(x, z), c = new T.Color(b === 'snow' ? '#8da9ac' : b === 'desert' ? '#b6784c' : '#807664');
      if (b !== 'snow' && b !== 'desert' && random() > .72) c.lerp(new T.Color('#8fae62'), .45); // moss lichen on shaded faces
      d.position.set(x, S.heightAt(x, z) - s * .20, z); d.rotation.set(random() * .32, random() * Math.PI, random() * .22); d.scale.set(s, s * (.45 + random() * .36), s * (.72 + random() * .35)); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix); mesh.setColorAt(n, c); n++;
    }
    mesh.count = n; mesh.userData.max = n; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; return mesh;
  }
  function landmark(style, pos) {
    const m = new A.Model(), dark = '#25495a', stone = '#b6956d', pale = '#d7e2d6', teal = '#47b9ae', gold = '#f2bd6b';
    // Warm window glow boxes are plain bright quads: no lights added, so the
    // cost stays inside the single merged landmark mesh.
    const windows = (y, r, count, col = '#ffdf9e') => { for (let i = 0; i < count; i++) { const a = i * Math.PI * 2 / count; m.box(.5, .7, .1, col, Math.cos(a) * r, y, Math.sin(a) * r, 0, -a); } };
    if (style === 'port') {
      m.cyl(2.2, 2.55, .7, stone, 0, .35, 0, 10).cyl(.70, 1.05, 9.4, pale, 0, 5.05, 0, 10).cyl(.97, .74, .4, teal, 0, 9.88, 0, 10).cyl(1.45, .1, 3.4, gold, 0, 11.5, 0, 8).box(4.4, .14, .14, dark, 0, 9.05, 0);
      windows(6.2, 1.02, 6); windows(4.4, 1.0, 6);
      for (const [cx, cz] of [[2.9, 1.4], [-2.7, -1.2]]) m.box(1.1, 1.1, 1.1, '#a87f52', cx, .55, cz, 0, cx).box(.9, .9, .9, '#c09a68', cx, 1.5, cz, 0, cz * .5);
    } else if (style === 'forest' || style === 'farm') {
      m.cyl(1.5, 2.0, .55, stone, 0, .28, 0, 10).cyl(.28, .48, 8.2, dark, 0, 4.35, 0, 9).cyl(.58, .58, .38, gold, 0, 8.4, 0, 10);
      for (let i = 0; i < 4; i++) m.box(.28, 5.3, .10, i % 2 ? pale : teal, Math.sin(i * Math.PI / 2) * 1.25, 8.4 + Math.cos(i * Math.PI / 2) * 1.25, 0, 0, -i * Math.PI / 2);
      m.box(.9, .9, .06, '#ffdf9e', 0, 5.6, .5).cyl(.05, .05, 2.2, dark, 0, 9.6, 0, 6).box(1.5, .9, .04, style === 'farm' ? '#e2725b' : teal, .78, 10.1, 0, 0, 0, -.28);
    } else if (style === 'desert') {
      m.box(8.8, .45, 3.0, stone, 0, .22, 0).cyl(.46, .58, 5.6, '#bd8051', -3.2, 2.85, 0, 8).cyl(.46, .58, 5.6, '#bd8051', 3.2, 2.85, 0, 8).box(7.3, .46, .56, pale, 0, 5.45, 0).cyl(.17, .24, 2.1, gold, 0, 6.65, 0, 8).ball(.44, teal, 0, 7.9, 0, 1, 1.3, 1, 1);
      for (const px of [-3.2, 3.2]) m.box(.44, .6, .08, '#ffdf9e', px, 3.4, .55);
      m.box(1.2, 2.0, .05, '#e2725b', 0, 6.2, -.2, 0, 0, .3).box(1.2, 2.0, .05, '#f2bd6b', 0, 6.2, .2, 0, 0, -.3);
    } else if (style === 'citadel' || style === 'observatory') {
      m.cyl(2.7, 3.1, .72, dark, 0, .36, 0, 12).cyl(1.48, 2.1, 7.2, '#64818a', 0, 3.95, 0, 12).cyl(2.32, 1.55, .38, teal, 0, 7.75, 0, 12).sphere(1.72, pale, 0, 9.16, 0, 1, .56, 1).cyl(.13, .22, 3.4, gold, 0, 10.4, 0, 8);
      windows(5.4, 1.82, 8); windows(3.2, 1.66, 8);
      m.cyl(.04, .04, 2.6, dark, 0, 13.2, 0, 6).box(1.6, 1.0, .05, teal, .82, 13.9, 0, 0, 0, -.25);
    } else {
      m.cyl(2.3, 2.8, .6, stone, 0, .3, 0, 10).cyl(.30, .5, 7.5, dark, 0, 4.05, 0, 9).ball(1.3, teal, 0, 8.1, 0, 1, .72, 1, 1).cyl(.12, .18, 2.8, gold, 0, 10.1, 0, 8);
      windows(5.2, .44, 5); windows(3.4, .40, 5);
      m.cyl(.04, .04, 1.8, dark, 0, 12.3, 0, 6).box(1.1, .7, .04, '#e2725b', .57, 12.8, 0, 0, 0, -.25);
    }
    const mesh = m.mesh(); mesh.position.set(pos.x, pos.y, pos.z); mesh.userData = { shared: true, landmark: true, anchor: pos, tier: style === 'citadel' ? 0 : 1 }; mesh.castShadow = false; return mesh;
  }
  function makeLandmarks() {
    const group = new T.Group(), choices = [
      ['port', -257, 444], ['forest', -235, -315], ['desert', 218, 440], ['citadel', 127, 124],
      ['cliff', 444, -411], ['lagoon', 465, 267], ['farm', 8, -472], ['observatory', 378, 60]
    ];
    const entries = [];
    choices.forEach(([style, x, z]) => { const q = safeSpot(x, z, 13); if (!q) return; const mesh = landmark(style, q); group.add(mesh); entries.push(mesh);
      // Soft ground halo marks the POI from the air: one additive quad parented
      // to the landmark, so distance culling in update() moves it for free.
      const halo = new T.Mesh(new T.RingGeometry(3.4, 4.3, 40), new T.MeshBasicMaterial({ color: '#7df0dd', transparent: true, opacity: .14, depthWrite: false, side: T.DoubleSide }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = .3; mesh.add(halo); });
    group.userData.entries = entries; return group;
  }

  /* The old environment was initialized before this script in existing pages. A
     lazy install replaces its presentation in the first frame and also supports
     future View instances without recreating any simulation state. */
  E.installWorldV2 = function () {
    if (this.worldV2Installed) return;
    this.worldV2Installed = true;
    if (this.sky) this.sky.visible = false;
    if (this.clouds) this.clouds.visible = false;
    if (this.stars) this.stars.visible = false;
    if (this.birds) this.birds.visible = false;
    if (this.grass) this.grass.visible = false;
    if (this.roads) { this.roads.material.color?.set('#4b6161'); this.roads.material.roughness = 1; }
    if (this.streetFurniture) this.streetFurniture.visible = false;
    (this.decorations || []).forEach((q) => q.mesh.visible = false); (this.flags || []).forEach((q) => q.visible = false);
    recolourTerrain(this);
    if (this.water) { disposeMaterial(this.water.material); this.worldV2Water = { time: { value: 0 }, day: { value: 1 }, coastTex: { value: coastTexture() }, coastSpan: { value: COAST_SPAN } }; this.water.material = oceanMaterial(this.worldV2Water); }
    const rootGroup = new T.Group(); rootGroup.name = 'azur-v2-island-art';
    const sky = new T.Mesh(new T.SphereGeometry(3300, 32, 20), islandSkyMaterial()); sky.renderOrder = -3;
    const ridges = makeDistantRidges(), clouds = makeCloudBank(716);
    const flora = makeFlora(), coast = makeCoastRocks(), landmarks = makeLandmarks(), palms = makePalms();
    rootGroup.add(sky, ridges, clouds, coast, flora, palms, landmarks); this.root.add(rootGroup);
    this.worldV2Root = rootGroup; this.worldV2 = { sky, ridges, clouds, flora, coast, landmarks, palms };
  };
  E.update = function (dt, focus, day = 1, quality = 'medium') {
    this.installWorldV2();
    const art = this.worldV2, premium = quality === 'high' || quality === 'ultra', low = quality === 'low';
    const t = (this.worldV2Time = (this.worldV2Time || 0) + dt);
    // Adaptive perf factor from the engine: shrinks submitted instances when the
    // device struggles, without changing the quality preset's authored look.
    const ad = Math.max(.55, Math.min(1, root.AZUR?.view?.adaptiveDetail || 1));
    const adAll = ad * (root.AZUR?.view?.v2UltraLow ? .6 : 1);
    if(this.streetFurniture)this.streetFurniture.visible=!low;
    if(this.grass){this.grass.visible=!low;this.grass.count=Math.floor(Math.min(this.grassMax,premium?5400:2600)*adAll);this.grassUniforms.time.value=t;this.grassUniforms.focus.value.set(focus.x,focus.y,focus.z);this.grassUniforms.distance.value=premium?145:90;}
    (this.decorations||[]).forEach(d=>d.mesh.visible=Math.hypot(focus.x-d.x,focus.z-d.z)<(low?150:360));
    (this.flags||[]).forEach(f=>f.visible=!low&&Math.hypot(f.position.x-focus.x,f.position.z-focus.z)<360);
    art.sky.material.uniforms.day.value = day; art.sky.material.uniforms.time.value = t;
    this.worldV2Water.time.value = t; this.worldV2Water.day.value = day;
    art.clouds.material.opacity = .72 + day * .24; art.clouds.visible = true;
    art.clouds.rotation.y = t * .0018;
    art.clouds.count = Math.max(1, Math.floor((low ? 50 : premium ? art.clouds.userData.max : 90) * adAll));
    const floraCount = Math.floor((low ? Math.min(145, art.flora.userData.max) : premium ? art.flora.userData.max : Math.min(330, art.flora.userData.max)) * adAll);
    const bushMax = art.flora.userData.bushMax || 0;
    art.flora.userData.meshes.forEach((mesh, mi) => { mesh.count = mi === 2 ? 0 : mi === 3 ? Math.floor((low ? Math.min(90, bushMax) : premium ? bushMax : Math.min(200, bushMax)) * adAll) : floraCount; mesh.castShadow = premium; });
    // Palms are cheap instanced geometry; low keeps a modest shoreline sample.
    const palmCount = Math.floor((low ? Math.min(60, art.palms.userData.max) : premium ? art.palms.userData.max : Math.min(96, art.palms.userData.max)) * adAll);
    art.palms.userData.meshes[0].count = palmCount; art.palms.userData.meshes[1].count = palmCount * art.palms.userData.perPalm; art.palms.userData.meshes[2].count = palmCount * (art.palms.userData.nuts || 3);
    art.palms.userData.meshes.forEach((mesh) => { mesh.castShadow = premium; });
    // Wildflowers from the base environment layer follow the same budget.
    if (this.flowers) { this.flowers.visible = !low; this.flowers.count = premium ? this.flowerMax : Math.min(this.flowerMax, 420); }
    art.coast.count = low ? Math.min(80, art.coast.userData.max) : premium ? art.coast.userData.max : Math.min(128, art.coast.userData.max);
    art.landmarks.userData.entries.forEach((mesh) => { const distance = Math.hypot(mesh.position.x - focus.x, mesh.position.z - focus.z); mesh.visible = distance < (low ? 250 : premium ? 1000 : 580); });
  };

  /* Detail upgrades retain the exact object root transforms and the original
     house shell. Therefore sim collision boxes and the north-facing house doors
     continue to be authoritative and visually unobstructed. */
  const legacyObjectModel = A.objectModel;
  A.objectModel = function (o) {
    if (o?.type !== 'tree' && o?.type !== 'rock' && o?.type !== 'house') return legacyObjectModel(o);
    if (o.type === 'house') {
      const g = legacyObjectModel(o), m = new A.Model(), w = o.w || 5.3, d = o.d || w, h = o.h || 4;
      const roof = o.style === 'desert' ? '#c97f4e' : o.style === 'cliff' || o.style === 'observatory' ? '#527588' : '#3d7471';
      m.box(w * 2.12, .10, .16, '#f0c57a', 0, h + .18, -d * .96).box(w * 2.12, .10, .16, '#f0c57a', 0, h + .18, d * .96).box(.16, .10, d * 1.88, '#f0c57a', -w * .98, h + .18, 0).box(.16, .10, d * 1.88, '#f0c57a', w * .98, h + .18, 0).box(w * 1.36, .13, d * .18, roof, 0, h + .37, d * .12);
      const random=rng(o.seed||27), accent=['#285a68','#367c77','#b47c4e','#795c68'][Math.floor(random()*4)], pale='#ecdac0';
      // Shallow facade dressing. No window is presented as a new walkable opening.
      for(const side of [-1,1])m.box(.20,h,.15,pale,side*(w-.12),h/2,d+.31).box(.20,h,.15,pale,side*(w-.12),h/2,-d-.31);
      const levels=Math.max(1,Math.min(12,o.floors||Math.round(h/4))),step=h/levels;
      for(let fl=0;fl<levels;fl++){
        const y=fl*step+Math.min(2.0,step*.54);
        for(const x of[-w*.55,w*.55]){
          m.box(1.88,1.95,.10,accent,x,y,d+.31).box(1.59,1.64,.07,'#427e91',x,y,d+.38).box(.065,1.69,.09,pale,x,y,d+.43).box(1.65,.065,.09,pale,x,y+.08,d+.43).box(2.10,.13,.34,pale,x,y-1.02,d+.34).box(.30,1.89,.13,accent,x-1.12,y,d+.33);
        }
        // Ground-floor shutters only: the same trim mesh, bounded cost per house.
        if(fl<2)for(const x of[-w*.55,w*.55])for(const sx of[-1,1])m.box(.36,1.9,.06,pale,x+sx*1.18,y,d+.34);
        if(fl>0)m.box(2*w+.18,.12,.10,accent,0,fl*step,d+.32);
      }
      m.box(3.9,.18,1.10,accent,0,2.95,-d-.56).box(4.03,.20,.10,pale,0,2.89,-d-1.1);
      // Door awning plus a warm wall lantern: shallow facade reads, same mesh.
      m.box(2.4,.08,1.0,accent,0,3.42,-d-.85,0,0,.07).box(.9,.5,.08,'#ffdf9e',1.35,2.9,-d-.42).box(.16,.16,.16,'#172a3a',1.35,3.24,-d-.42);
      // Chimney plus a stepped doorstep: same merged trim mesh, no extra draw.
      m.box(.72,1.7,.72,'#8a6f5c',w*.58,h+1.15,-d*.28).box(.9,.18,.9,'#6e5747',w*.58,h+2.05,-d*.28).box(2.2,.16,1.2,pale,0,.08,d*1.35);
      const trim = m.mesh(); trim.userData.shared = true; trim.castShadow = false; g.add(trim); return g;
    }
    const g = new T.Group(), m = new A.Model(), bio = S.biomeAt(o.x, o.z), h = Math.max(2.8, o.h * (bio === 'desert' ? 1.1 : 1.48)), w = Math.max(.8, o.w);
    if (o.type === 'tree') {
      const trunk = bio === 'desert' ? '#986a42' : '#594333', leaf = bio === 'snow' ? '#5f8c90' : bio === 'desert' ? '#849856' : '#3b7c4d', high = bio === 'snow' ? '#d8ece8' : '#a4c96c';
      m.cyl(.15, .34, h * .72, trunk, 0, h * .36, 0, 8).cyl(.055, .12, h * .44, trunk, w * .36, h * .57, .04, 7, 0, -.55);
      m.cyl(w * .34, w * .54, h * .09, trunk, 0, h * .045, 0, 8); // root flare
      if (bio === 'snow') { for (let k = 0; k < 3; k++) m.cyl(0, w * (1.45 - k * .26), h * .48, k === 2 ? high : leaf, 0, h * (.48 + k * .20), 0, 8); }
      else { m.ball(w * 1.34, leaf, 0, h * .75, 0, 1, .72, 1, 1).ball(w, high, -w * .48, h * .93, .05, 1, .68, .9, 1).ball(w * .86, '#629d56', w * .52, h * .91, -.12, 1, .70, .88, 1); }
      // One tree in five blooms pink/white: same merged mesh, no extra draw.
      if ((o.seed || 0) % 5 === 0 && bio !== 'snow' && bio !== 'desert') m.ball(w * .52, '#f5b8cf', w * .30, h * .86, .10, 1, .68, .78, 0).ball(w * .40, '#fdeef4', -w * .36, h * .80, -.06, 1, .68, .78, 0);
      // One tree in three drapes hanging vines from its canopy: same merged mesh.
      if ((o.seed || 0) % 3 === 0 && bio !== 'snow' && bio !== 'desert') for (let k = 0; k < 3; k++) m.box(.07, h * .24, .07, '#5d7f52', (k - 1) * w * .55, h * .60, w * .34, 0, 0, .07 * (k - 1));
    } else {
      const base = bio === 'snow' ? '#829da2' : bio === 'desert' ? '#b36f45' : '#71827a', cap = bio === 'snow' ? '#d9e9e5' : bio === 'desert' ? '#dca06b' : '#a7b499';
      m.ball(o.w * 1.08, base, 0, o.h * .20, 0, 1, Math.max(.38, o.h / (o.w * 2.4)), .88, 0).ball(o.w * .64, cap, o.w * .32, o.h * .48, -.08, 1, .56, .72, 0).ball(o.w * .38, '#516a67', -o.w * .46, o.h * .33, .12, 1, .5, .64, 0);
      if (bio !== 'desert' && bio !== 'snow') m.ball(o.w * .52, '#7fae62', o.w * .08, o.h * .52, 0, 1, .34, .70, 0);
      m.ball(o.w * .22, bio === 'snow' ? '#e8f1ec' : '#b9c98a', -o.w * .30, o.h * .44, o.w * .30, 1, .4, .7, 0); // lichen patch
    }
    const mesh = m.mesh(); mesh.userData.shared = true; g.add(mesh); g.position.set(o.x, o.y, o.z); g.rotation.y = o.yaw || 0; Object.assign(g.userData, { type: o.type, hp: o.hp }); return g;
  };

  function lobbySky() {
    return new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, vertexShader: 'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec3 v;void main(){float h=clamp(normalize(v).y*.5+.5,0.,1.);vec3 c=mix(vec3(.008,.07,.15),vec3(.05,.34,.48),pow(h,.78));c+=vec3(.18,.78,.73)*pow(max(0.,1.-abs(normalize(v).y)),9.)*.08;gl_FragColor=vec4(c,1.);}' });
  }
  function makeLobbyScene(view) {
    view.menuScene?.clear?.(); view.menuAvatar = null; view.menuTeam = []; view.menuTeamKey = '';
    const scene = view.menuScene = new T.Scene(); scene.background = new T.Color('#051c2a'); scene.fog = new T.FogExp2('#155b67', .032);
    view.menuCamera = new T.PerspectiveCamera(36, 1, .1, 120);
    const menuW = view.canvas?.clientWidth || 1, menuH = view.canvas?.clientHeight || 1;
    view.menuCamera.aspect = menuW / menuH; view.menuCamera.updateProjectionMatrix();
    /* v48 : l'ancien éclairage saturait la courbe ACES — la veste corail
       ressortait presque blanche. Moins de lumière frontale, plus de contre-jour. */
    scene.add(new T.HemisphereLight('#baf8ed', '#102a3e', 1.15));
    const sun = new T.DirectionalLight('#ffe0a6', 1.9); sun.position.set(5, 9, 5); scene.add(sun);
    const rim = new T.DirectionalLight('#52f0dc', 2.6); rim.position.set(-6, 4, -4); scene.add(rim);
    const key = new T.SpotLight('#ffbd75', 52, 17, .62, .7, 1.2); key.position.set(2.7, 6.3, 3.4); key.target.position.set(0, 1, 0); scene.add(key, key.target);
    const aqua = new T.SpotLight('#42e5d9', 62, 16, .68, .75, 1.5); aqua.position.set(-3.4, 3.8, 1.5); aqua.target.position.set(0, 1, 0); scene.add(aqua, aqua.target);
    const rootGroup = new T.Group(); rootGroup.name = 'azur-v2-cliffside-hangar'; scene.add(rootGroup);
    const sky = new T.Mesh(new T.SphereGeometry(90, 24, 16), lobbySky()); rootGroup.add(sky);
    const waterUniforms = { time: { value: 0 } };
    const water = new T.Mesh(new T.PlaneGeometry(110, 110, 24, 24), new T.ShaderMaterial({ side: T.DoubleSide, uniforms: waterUniforms, vertexShader: 'uniform float time;varying vec2 u;void main(){u=uv;vec3 p=position;p.z+=sin(p.x*.35+time*.8)*.10+sin(p.y*.24-time*.5)*.08;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}', fragmentShader: 'varying vec2 u;void main(){float bands=pow(max(0.,sin(u.x*130.+u.y*18.)),24.);gl_FragColor=vec4(vec3(.018,.25,.34)+bands*vec3(.12,.36,.34),1.);}' })); water.rotation.x = -Math.PI / 2; water.position.set(0, -.58, -13); rootGroup.add(water);
    const architecture = new A.Model();
    architecture.cyl(4.55, 5.10, .48, '#173b4a', 0, -.24, 0, 48).cyl(4.20, 4.57, .15, '#2a7180', 0, .04, 0, 48).cyl(2.12, 2.26, .10, '#f1bd70', 0, .15, 0, 40).cyl(1.84, 2.04, .045, '#142d40', 0, .22, 0, 40);
    for (const side of [-1, 1]) { architecture.box(.42, 7.0, .60, '#2b5461', side * 5.1, 3.2, -1.7, 0, 0, side * .12).box(.10, 7.2, .12, '#68e0d1', side * 4.88, 3.5, -1.7, 0, 0, side * .12).box(3.45, .28, .48, '#294e5c', side * 3.45, 6.4, -2.0, 0, 0, side * .42); }
    architecture.box(12.8, .34, 2.0, '#244c59', 0, -.36, -5.5).box(11.9, .06, 1.6, '#3d898b', 0, -.16, -5.5);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI * 2 / 12; architecture.box(.09, .038, 1.40, i % 2 ? '#64d6cd' : '#edac68', Math.sin(a) * 3.18, .20, Math.cos(a) * 3.18, 0, a, 0); }
    const structure = architecture.mesh(); structure.castShadow = true; structure.receiveShadow = true; rootGroup.add(structure);
    const islands = new A.Model();
    [[-13,-20,4.8,'#2c726e'],[12,-23,6.1,'#4d756d'],[0,-31,7.6,'#2e6868'],[21,-33,4.4,'#8d7354'],[-22,-34,4.7,'#377979']].forEach(([x,z,s,c]) => { islands.ball(s,c,x,-1.7,z,1,.34,.72,0); islands.cyl(.08,.12,s*.8,'#e9bc71',x,-1+s*.34,z,7); }); rootGroup.add(islands.mesh());
    const ring = new T.Mesh(new T.TorusGeometry(1.37, .032, 8, 64), new T.MeshBasicMaterial({ color: '#61f0db', transparent: true, opacity: .72, depthWrite: false, blending: T.AdditiveBlending })); ring.rotation.x = Math.PI / 2; ring.position.y = .245; rootGroup.add(ring);
    const ring2 = new T.Mesh(new T.TorusGeometry(2.16, .016, 6, 64), new T.MeshBasicMaterial({ color: '#ffc66e', transparent: true, opacity: .42, depthWrite: false, blending: T.AdditiveBlending })); ring2.rotation.x = Math.PI / 2; ring2.position.y = .25; rootGroup.add(ring2);
    const beam = new T.Mesh(new T.CylinderGeometry(.72, 1.5, 6.7, 20, 1, true), new T.MeshBasicMaterial({ color: '#55e8d9', transparent: true, opacity: .055, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); beam.position.y = 3.3; rootGroup.add(beam);
    // Festive string lights: two sagging rows of warm/cool bulbs from the side
    // posts toward the centre. One instanced draw call, gently pulsing.
    const bulbs = new T.InstancedMesh(new T.SphereGeometry(.055, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: .9 }), 26);
    { const bd = new T.Object3D(), bulbCols = ['#ffd9a0', '#aef3ff', '#ffb3c8']; let bi = 0;
      for (const side of [-1, 1]) for (let k = 0; k <= 12; k++) {
        const t = k / 12, sag = Math.sin(t * Math.PI) * .85;
        bd.position.set(side * (5.1 - t * 5.1), 6.75 - t * .85 - sag, -1.7 + t * 1.4);
        bd.updateMatrix(); bulbs.setMatrixAt(bi, bd.matrix); bulbs.setColorAt(bi, new T.Color(bulbCols[bi % 3])); bi++;
      }
      bulbs.instanceMatrix.needsUpdate = true; if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true; }
    rootGroup.add(bulbs);
    // Floating dust motes catch the lobby light: one instanced additive draw,
    // slow drift handled by rotating/bobbing the whole group in drawMenu.
    const motes = new T.InstancedMesh(new T.SphereGeometry(.035, 6, 5), new T.MeshBasicMaterial({ color: '#bff5ec', transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending }), 42);
    { const md = new T.Object3D(), mr = rng(5150);
      for (let i = 0; i < 42; i++) { md.position.set((mr() - .5) * 9, .4 + mr() * 5.4, -4 + (mr() - .5) * 8); md.updateMatrix(); motes.setMatrixAt(i, md.matrix); }
      motes.instanceMatrix.needsUpdate = true; }
    rootGroup.add(motes);
    // Hanging AZUR banners on the side posts.
    const bannerCanvas = document.createElement("canvas"); bannerCanvas.width = 128; bannerCanvas.height = 256;
    const bctx = bannerCanvas.getContext("2d");
    bctx.fillStyle = "#123a4c"; bctx.fillRect(0, 0, 128, 256);
    bctx.fillStyle = "#f2bd6b"; bctx.fillRect(0, 0, 128, 14); bctx.fillRect(0, 242, 128, 14);
    bctx.fillStyle = "#7df0dd"; bctx.font = "700 34px sans-serif"; bctx.textAlign = "center";
    "AZUR".split("").forEach((ch, i) => bctx.fillText(ch, 64, 72 + i * 42));
    const bannerTex = new T.CanvasTexture(bannerCanvas); bannerTex.colorSpace = T.SRGBColorSpace;
    const bannerMat = new T.MeshBasicMaterial({ map: bannerTex, side: T.DoubleSide });
    for (const side of [-1, 1]) { const banner = new T.Mesh(new T.PlaneGeometry(1.0, 2.0), bannerMat); banner.position.set(side * 4.55, 4.4, -1.7); banner.rotation.y = side * .22; rootGroup.add(banner); }
    const glow = new T.PointLight('#ffb36b', 14, 15, 1.8); glow.position.set(0, 4.4, 1.4); scene.add(glow);
    const cloud = makeCloudBank(88); cloud.scale.setScalar(.043); cloud.position.set(0, 2, -22); rootGroup.add(cloud);
    view.v2Lobby = { root: rootGroup, waterUniforms, ring, ring2, beam, cloud, bulbs, motes, sun, rim }; view.menuTerrace = null;
  }
  V.makeMenu = function () { makeLobbyScene(this); };
  V.setClassicLobbyMode = function (active, panel = false) {
    if (!this.v2Lobby) makeLobbyScene(this);
    this.v2Lobby.root.visible = true; this.menuScene.background.set(panel ? '#082331' : '#051c2a'); this.menuScene.fog.density = panel ? .022 : .032;
    return this.v2Lobby.root;
  };
  V.drawMenu = function (world, player, dt, options = {}) {
    if (!this.v2Lobby) makeLobbyScene(this);
    this.setClassicLobbyMode(true, !!options.panel);
    const eq = options.previewEquipment || player.equipment || {}, signature = JSON.stringify(eq);
    if (!this.menuAvatar || this.menuAvatar.userData.equipment !== signature) {
      if (this.menuAvatar) { this.menuScene.remove(this.menuAvatar); this.disposeTree(this.menuAvatar); }
      this.menuAvatar = A.avatar(eq); this.menuScene.add(this.menuAvatar);
    }
    const avatar = this.menuAvatar, preview = options.previewType || '';
    avatar.position.set(0, .19, .08); avatar.rotation.y = Math.PI + .13 + this.menuRotation + (preview === 'back' ? Math.PI : 0);
    const fake = { ...player, equipment: eq, distance: 0, inventory: preview === 'wrap' && options.panel ? [{ kind: 'weapon', weapon: 'rifle' }] : [], emote: preview === 'emote' ? 2 : 0, gliding: preview === 'glider', falling: false, jumping: false, flying: false, swimming: false, reload: 0, useTime: 0, crouching: false, fishing: 0 };
    this.animateAvatar(avatar, fake, dt, { harvest: preview === 'tool', menu: true }); avatar.userData.gun.visible = preview === 'wrap' && !!options.panel;
    this.setMenuTeam?.(options.menuTeam); const slots = [[-3.25,.08,-.8],[3.25,.08,-.8],[-2.7,.08,-2.4]];
    (this.menuTeam || []).forEach((slot, i) => { const q = slots[i]; slot.group.visible = !options.panel; slot.group.position.set(...q); slot.group.rotation.y = Math.PI + (i === 1 ? -.24 : .24); const mate = { ...fake, equipment: slot.member.equipment || {}, inventory: [], emote: 0, gliding: false }; this.animateAvatar(slot.avatar, mate, dt, { menu: true }); });
    const l = this.v2Lobby, t = this.time || 0; l.waterUniforms.time.value = t; l.ring.rotation.z = t * .16; l.ring2.rotation.z = -t * .09; const pulse = .94 + Math.sin(t * 2.1) * .06; l.ring.scale.setScalar(pulse); l.beam.material.opacity = .014 + Math.sin(t * 1.7) * .004; l.cloud.rotation.y = t * .017;
    if (l.bulbs) l.bulbs.material.opacity = .72 + Math.sin(t * 3.2) * .18;
    if (l.motes) { l.motes.rotation.y = t * .05; l.motes.position.y = Math.sin(t * .6) * .12; }
    // v48 : un téléphone en paysage n'a que ≈ 390 px de haut — la caméra recule
    // et centre le personnage entre la colonne progression et la carte JOUER.
    if (this.mobileRenderer) {
      const want = Math.min(root.devicePixelRatio || 1, 2), current = this.renderer.getPixelRatio();
      if (current < want - .01) { if (!this._menuPixelRestore) this._menuPixelRestore = current; this.renderer.setPixelRatio(want); }
    }
    const portrait = this.menuCamera.aspect < .82, mobile = this.canvas.clientHeight < 520, landscapePhone = mobile && !portrait;
    const distance = preview === 'glider' ? (portrait ? 9.6 : 8.15) : portrait ? 9.2 : landscapePhone ? 7.4 : 6.3; // v89 : cadrage plus serré
    // v48 : en portrait le personnage descend dans le cadre pour laisser la place à la progression en haut.
    const lookY = portrait && !options.panel ? 1.42 : portrait ? 1.10 : landscapePhone && !options.panel ? 1.30 : 1.2;
    this.menuCamera.position.set(.10, 1.66, distance); this.menuCamera.lookAt(0, lookY, -.34);
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight, focusX = options.panel ? .18 : portrait ? .52 : landscapePhone ? .47 : .54;
    this.menuCamera.setViewOffset(width, height, -(focusX - .5) * width, 0, width, height); this.renderer.render(this.menuScene, this.menuCamera);
    this.renderOneThumbnail?.();
  };

  // v48 : en tournant le téléphone, certains navigateurs mobiles déclenchent
  // « resize » avant la nouvelle mise en page — le canvas gardait l'ancienne
  // taille étirée (image floue et zoomée). On compare chaque frame.
  const syncCanvasSize = function (view) {
    const c = view.canvas, ratio = view.renderer.getPixelRatio();
    if (!c || !c.clientWidth || !c.clientHeight) return;
    if (Math.abs(c.width - Math.floor(c.clientWidth * ratio)) > 2 || Math.abs(c.height - Math.floor(c.clientHeight * ratio)) > 2) view.resize();
  };
  const baseViewUpdate = V.update;
  V.update = function (w, p, dt, opts = {}) {
    if (!opts.menu && this._menuPixelRestore) { this.renderer.setPixelRatio(this._menuPixelRestore); this._menuPixelRestore = 0; }
    syncCanvasSize(this);
    return baseViewUpdate.call(this, w, p, dt, opts);
  };
  const baseConfigure = V.configure;
  V.configure = function (settings) { this._menuPixelRestore = 0; return baseConfigure.call(this, settings); };

  root.AZURV2World = Object.freeze({ version: '2.0.0', environmentHook: 'AZEnvironment.Environment.update/installWorldV2', lobbyHook: 'AZView.View.makeMenu/setClassicLobbyMode/drawMenu', objectHook: 'AZArt.objectModel', drawCalls: { island: 'terrain + water + sky + 3 flora instances + coast instance + landmarks', lobby: 'batched architecture with animated water/rings' }, contracts: ['AZSim.heightAt', 'AZSim water/coast', 'simulation collision and doors untouched'] });
  root.AZUR?.view?.environment?.installWorldV2?.();
  if (root.AZUR?.view) root.AZUR.view.makeMenu();
})(window);
