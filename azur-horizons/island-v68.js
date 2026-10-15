/* AZUR v68 — la nouvelle île : couleurs du relief et décors des biomes.
 *  - VOLCAN CENDRÉ (nord-ouest) : cône de basalte, lac de lave qui bouillonne
 *    dans le cratère, coulées de lave qui descendent les pentes, panache de
 *    fumée, roches incandescentes, arbres calcinés ;
 *  - PICS GIVRÉS (nord-est) : sapins enneigés, cristaux de glace, neige qui
 *    tombe autour du joueur ;
 *  - JUNGLE DE JADE (ouest) : grands arbres à étages, fougères, temple de jade ;
 *  - CANYON ROUGE (sud-est) : mésas, cactus, arche de pierre, ossements ;
 *  - le relief est recoloré zone par zone (pente rocheuse, sable, cendre…).
 * Chaque biome est un petit nombre de maillages instanciés, masqué quand la
 * caméra est loin : le coût reste faible, même sur mobile. */
(function (root) {
  'use strict';
  const T = root.THREE, S = root.AZSim, E = root.AZEnvironment?.Environment?.prototype;
  if (!T || !S?.zoneWeights || !E) return;
  const M = S.MAP, V = S.VOLCANO;
  const rng = (seed) => { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const NOISE = 'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}' +
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}' +
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}';
  const inTown = (x, z, pad) => S.regions.some((r) => Math.abs(x - r.x) < (r.padW || 76) + pad && Math.abs(z - r.z) < (r.padD || 42) + pad);
  const nearRoad = (x, z, m) => { const all = (S.roads || []).concat(S.streets || []); for (const line of all) for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i], dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)); if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < m) return true; } return false; };

  /* ------------------------------------------------ couleurs du relief */
  const C = (h) => new T.Color(h);
  const PAL = {
    meadow: C('#5fb04f'), meadow2: C('#86c35a'), jungle: C('#2a8a3e'), jungle2: C('#46a24a'),
    snow: C('#eef6fa'), snowShade: C('#c8dbe6'), rock: C('#8a8279'), desert: C('#e3a35c'), mesa: C('#c4673a'), mesa2: C('#e8b071'),
    ash: C('#3d3538'), ash2: C('#5b4c4a'), scorched: C('#6b2a1c'), beach: C('#f0d9a6'), wet: C('#c9b07a'), cape: C('#77bf5e')
  };
  const tc = new T.Color(), tb = new T.Color();
  function zoneColor(x, z) {
    const d = S.coastDistance(x, z), w = S.zoneWeights(x, z), h = S.heightAt(x, z);
    const slope = Math.abs(S.heightAt(x + 4, z) - h) + Math.abs(S.heightAt(x, z + 4) - h);
    const grain = Math.sin(x * .061 + z * .043) * .5 + Math.sin(x * .023 - z * .031) * .5;
    tc.copy(PAL.meadow).lerp(PAL.meadow2, .35 + grain * .3);
    tc.lerp(PAL.cape, w.meadow * .8);
    tb.copy(PAL.jungle).lerp(PAL.jungle2, .5 + grain * .4); tc.lerp(tb, w.jungle);
    tb.copy(PAL.desert).lerp(PAL.mesa, Math.max(0, Math.sin(h * .55)) * .55 * Math.min(1, slope / 3)).lerp(PAL.mesa2, Math.max(0, grain) * .25); tc.lerp(tb, w.desert);
    tb.copy(PAL.snow).lerp(PAL.snowShade, .3 + grain * .3); tc.lerp(tb, w.snow * Math.min(1, .35 + h / 55));
    const vr = Math.hypot(x - V.x, z - V.z);
    tb.copy(PAL.ash).lerp(PAL.ash2, .5 + grain * .5).lerp(PAL.scorched, Math.max(0, 1 - vr / (V.crater * 2.2)));
    tc.lerp(tb, Math.max(w.volcano, 1 - Math.min(1, Math.max(0, (vr - V.r * .55) / (V.r * .55)))));
    // Pentes raides : la roche affleure partout sauf sous la neige épaisse.
    tc.lerp(w.volcano > .5 ? PAL.ash : PAL.rock, Math.min(.85, Math.max(0, slope - 3.2) * .14) * (1 - w.snow * .6));
    const shore = Math.min(1, Math.max(0, (d - (M.shoreStart - 34)) / 34));
    if (shore > 0) tc.lerp(w.volcano > .4 ? PAL.ash2 : PAL.beach, shore);
    if (d > M.shoreEnd - 22) tc.lerp(PAL.wet, Math.min(1, (d - (M.shoreEnd - 22)) / 22));
    // Lac des Reflets : plage claire sur la rive, fond sableux sous l'eau.
    const L = S.LAKE;
    if (L) { const lr = Math.hypot(x - L.x, z - L.z) / L.r; if (lr < 1.45) tc.lerp(h < -2.2 ? PAL.wet : PAL.beach, (1 - Math.max(0, (lr - 1.15) / .3)) * (h < -2.2 ? .9 : .8)); }
    return tc;
  }
  function recolour(env) {
    const geo = env.terrain?.geometry, pos = geo?.attributes?.position;
    if (!pos) return;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const c = zoneColor(pos.getX(i), pos.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
  }

  /* ------------------------------------------------ outils */
  function scatter(rand, count, tries, test) {
    const out = [];
    for (let i = 0; i < tries && out.length < count; i++) {
      const x = (rand() - .5) * M.halfSize * 2, z = (rand() - .5) * M.halfSize * 2, r = test(x, z, rand);
      if (r) out.push(Object.assign({ x, z, y: S.heightAt(x, z) }, r));
    }
    return out;
  }
  const lowQ = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '') || navigator.maxTouchPoints > 0;
  const land = (x, z, pad = 10) => S.coastDistance(x, z) < M.shoreStart - 6 && !inTown(x, z, pad) && !nearRoad(x, z, 6);
  function instanced(geo, mat, items, place) {
    const m = new T.InstancedMesh(geo, mat, Math.max(1, items.length)), d = new T.Object3D();
    items.forEach((it, i) => { place(d, it, i); d.updateMatrix(); m.setMatrixAt(i, d.matrix); if (it.col) m.setColorAt(i, it.col); });
    m.count = items.length; m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
    return m;
  }
  function merge(parts) {
    let count = 0; parts.forEach((g) => { count += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3); let o = 0;
    parts.forEach((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal, c = new T.Color(g0.userData.color || '#ffffff');
      for (let i = 0; i < p.count; i++, o++) { pos.set([p.getX(i), p.getY(i), p.getZ(i)], o * 3); nor.set([n.getX(i), n.getY(i), n.getZ(i)], o * 3); col.set([c.r, c.g, c.b], o * 3); }
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    return g;
  }
  const part = (geo, color, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.scale(sx, sy, sz); geo.translate(tx, ty, tz); geo.userData.color = color; return geo;
  };
  const flat = (extra) => new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: .95, flatShading: true }, extra || {}));

  /* ------------------------------------------------ volcan */
  const lavaUniforms = { time: { value: 0 } };
  function lavaMaterial() {
    return new T.ShaderMaterial({
      uniforms: Object.assign({}, T.UniformsLib.fog, lavaUniforms), side: T.DoubleSide,
      vertexShader: 'varying vec2 vU;varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){vU=uv;vW=(modelMatrix*vec4(position,1.)).xyz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: 'uniform float time;varying vec2 vU;varying vec3 vW;\n#include <fog_pars_fragment>\n' + NOISE +
        'void main(){vec2 q=vW.xz*.06+vec2(0.,time*.25);float f=fbm(q+fbm(q*1.7-time*.1)*1.5);float crust=smoothstep(.5,.62,f);' +
        'vec3 hot=mix(vec3(1.,.95,.45),vec3(1.,.42,.06),smoothstep(.1,.5,f));vec3 c=mix(hot*1.9,vec3(.16,.06,.05),crust);' +
        'c+=vec3(1.,.5,.1)*pow(1.-crust,4.)*.6*(.7+.3*sin(time*3.+f*20.));gl_FragColor=vec4(c,1.);\n#include <fog_fragment>\n}',
      fog: true
    });
  }
  function volcano(group, anim) {
    const g = new T.Group(); g.userData.focus = new T.Vector3(V.x, 0, V.z); g.userData.range = 900; group.add(g);
    const rand = rng(911), lava = lavaMaterial();
    // Lac de lave au fond du cratère.
    const floor = S.heightAt(V.x, V.z) + 2.5;
    const lake = new T.Mesh(new T.CircleGeometry(V.crater * .82, 40), lava); lake.rotation.x = -Math.PI / 2; lake.position.set(V.x, floor, V.z); g.add(lake);
    // Coulées : on descend la plus grande pente depuis la lèvre du cratère.
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + rand() * .6;
      let x = V.x + Math.cos(a) * (V.crater + 6), z = V.z + Math.sin(a) * (V.crater + 6);
      const pts = [];
      for (let s = 0; s < 46; s++) {
        pts.push(new T.Vector3(x, S.heightAt(x, z) + .5, z));
        const h = S.heightAt(x, z), gx = S.heightAt(x + 3, z) - h, gz = S.heightAt(x, z + 3) - h, L = Math.hypot(gx, gz) || 1;
        const dx = -gx / L + Math.cos(a) * .6 + (rand() - .5) * .5, dz = -gz / L + Math.sin(a) * .6 + (rand() - .5) * .5, L2 = Math.hypot(dx, dz) || 1;
        x += dx / L2 * 5.5; z += dz / L2 * 5.5;
        if (S.heightAt(x, z) < 6 || Math.hypot(x - V.x, z - V.z) > V.r * 1.05) break;
      }
      if (pts.length < 4) continue;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
        const w = 2.2 + i * .14 + Math.sin(i * .9 + k) * .8, nx = -dz / L * w, nz = dx / L * w;
        pos.push(p.x + nx, S.heightAt(p.x + nx, p.z + nz) + .45, p.z + nz, p.x - nx, S.heightAt(p.x - nx, p.z - nz) + .45, p.z - nz);
        uv.push(0, i / pts.length, 1, i / pts.length);
        if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      g.add(new T.Mesh(geo, lava));
    }
    const glow = new T.PointLight('#ff6a1e', 6, 260, 1.6); glow.position.set(V.x, floor + 18, V.z); g.add(glow);
    // Panache de fumée : grosses bouffées qui montent et s'élargissent.
    const smokeMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: { time: lavaUniforms.time },
      vertexShader: 'attribute float seed;varying float vA;varying float vS;uniform float time;void main(){float t=fract(time*.035+seed);vA=t;vS=seed;vec3 p=position;p.y+=t*320.;p.x+=sin(seed*20.+t*3.)*30.*t+t*90.;p.z+=cos(seed*13.)*25.*t;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(60.+t*420.)*(300./-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;varying float vS;void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;float a=smoothstep(.5,.1,r)*(1.-vA)*smoothstep(0.,.08,vA)*.55;vec3 col=mix(vec3(.9,.42,.18),vec3(.32,.29,.3),smoothstep(0.,.25,vA));gl_FragColor=vec4(col,a);}'
    });
    const N = 40, sp = new Float32Array(N * 3), seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) { sp[i * 3] = V.x + (rand() - .5) * 20; sp[i * 3 + 1] = floor + 4; sp[i * 3 + 2] = V.z + (rand() - .5) * 20; seeds[i] = i / N; }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('seed', new T.BufferAttribute(seeds, 1));
    const smoke = new T.Points(sg, smokeMat); smoke.frustumCulled = false; g.add(smoke);
    // Roches de basalte, roches incandescentes, arbres calcinés.
    const rocks = scatter(rand, lowQ ? 60 : 110, 6000, (x, z, r) => S.zoneWeights(x, z).volcano > .4 && land(x, z, 8) && Math.hypot(x - V.x, z - V.z) > V.crater + 8 && { s: 1.2 + r() * 4.5, r: r() * 6, col: C(r() > .3 ? '#2e2729' : '#4a3b38') });
    g.add(instanced(new T.DodecahedronGeometry(1, 0), flat(), rocks, (d, it) => { d.position.set(it.x, it.y + it.s * .2, it.z); d.rotation.set(it.r, it.r * 2, 0); d.scale.set(it.s, it.s * .7, it.s * .9); }));
    const embers = scatter(rand, 40, 4000, (x, z, r) => Math.hypot(x - V.x, z - V.z) < V.r * .75 && Math.hypot(x - V.x, z - V.z) > V.crater + 4 && land(x, z, 8) && { s: .8 + r() * 1.6, r: r() * 6 });
    g.add(instanced(new T.OctahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: '#2a1410', emissive: '#ff4a10', emissiveIntensity: 1.4, flatShading: true }), embers, (d, it) => { d.position.set(it.x, it.y + it.s * .3, it.z); d.rotation.set(it.r, it.r, 0); d.scale.setScalar(it.s); }));
    const dead = scatter(rand, 60, 4000, (x, z, r) => { const w = S.zoneWeights(x, z).volcano; return w > .2 && w < .8 && land(x, z, 10) && { h: 4 + r() * 5, r: r() * 6, lean: (r() - .5) * .3 }; });
    const deadGeo = merge([part(new T.CylinderGeometry(.12, .3, 1, 6), '#2a2220', 0, .5, 0), part(new T.CylinderGeometry(.05, .12, .5, 5), '#2a2220', .18, .78, 0, 0, 0, -.9), part(new T.CylinderGeometry(.05, .1, .45, 5), '#2a2220', -.15, .66, 0, 0, 0, .8)]);
    g.add(instanced(deadGeo, flat(), dead, (d, it) => { d.position.set(it.x, it.y, it.z); d.rotation.set(it.lean, it.r, it.lean * .5); d.scale.set(it.h * .9, it.h, it.h * .9); }));
    anim.push((t) => { glow.intensity = 5 + Math.sin(t * 2.3) * 1.2 + Math.sin(t * 7.1) * .5; });
  }

  /* ------------------------------------------------ pics givrés */
  function snowpeaks(group, anim, env) {
    const L = S.LOBES[1], g = new T.Group(); g.userData.focus = new T.Vector3(480, 0, -460); g.userData.range = 560; group.add(g);
    const rand = rng(4242);
    const pineGeo = merge([
      part(new T.CylinderGeometry(.18, .26, 1.6, 6), '#5a3e2a', 0, .8, 0),
      part(new T.ConeGeometry(1.6, 2.4, 7), '#1f5a48', 0, 2.4, 0), part(new T.ConeGeometry(1.25, 2.1, 7), '#24664f', 0, 3.6, 0), part(new T.ConeGeometry(.85, 1.8, 7), '#2b7358', 0, 4.7, 0),
      part(new T.ConeGeometry(1.0, .7, 7), '#f4fbff', 0, 3.0, 0), part(new T.ConeGeometry(.75, .65, 7), '#f4fbff', 0, 4.15, 0), part(new T.ConeGeometry(.5, .7, 7), '#ffffff', 0, 5.4, 0)
    ]);
    const pines = scatter(rand, lowQ ? 160 : 280, 16000, (x, z, r) => S.zoneWeights(x, z).snow > .45 && land(x, z, 10) && { s: 1.2 + r() * 1.3, r: r() * 6 });
    g.add(instanced(pineGeo, flat(), pines, (d, it) => { d.position.set(it.x, it.y - .2, it.z); d.rotation.set(0, it.r, 0); d.scale.setScalar(it.s); }));
    const ice = scatter(rand, 70, 6000, (x, z, r) => S.zoneWeights(x, z).snow > .6 && land(x, z, 10) && { s: 1 + r() * 3, r: r() * 6 });
    g.add(instanced(new T.OctahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: '#bfeaff', emissive: '#3aa8ff', emissiveIntensity: .35, roughness: .15, metalness: .1, flatShading: true }), ice, (d, it) => { d.position.set(it.x, it.y + it.s * .6, it.z); d.rotation.set(.2, it.r, .15); d.scale.set(it.s * .55, it.s * 1.6, it.s * .55); }));
    // Neige qui tombe autour de la caméra quand on est dans la zone.
    const N = 1400, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (rand() - .5) * 140; pos[i * 3 + 1] = rand() * 70; pos[i * 3 + 2] = (rand() - .5) * 140; }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const snowMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { time: lavaUniforms.time, origin: { value: new T.Vector3() }, amt: { value: 0 } },
      vertexShader: 'uniform float time;uniform vec3 origin;uniform float amt;void main(){vec3 p=position;p.y=mod(p.y-time*4.,70.);p.x+=sin(time*.7+position.z)*1.5;vec3 w=origin+p-vec3(0.,20.,0.);vec4 mv=modelViewMatrix*vec4(w,1.);gl_PointSize=amt*4.*(60./-mv.z)+.01;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'void main(){if(length(gl_PointCoord-.5)>.5)discard;gl_FragColor=vec4(1.,1.,1.,.85);}' });
    const flakes = new T.Points(sg, snowMat); flakes.frustumCulled = false; group.add(flakes);
    anim.push((t, cam) => { const w = cam ? S.zoneWeights(cam.x, cam.z).snow : 0; snowMat.uniforms.amt.value += ((w > .5 ? 1 : 0) - snowMat.uniforms.amt.value) * .05; flakes.visible = snowMat.uniforms.amt.value > .02; if (cam) snowMat.uniforms.origin.value.set(cam.x, cam.y ?? S.heightAt(cam.x, cam.z), cam.z); });
  }

  /* ------------------------------------------------ jungle de jade */
  function jungle(group, anim) {
    const g = new T.Group(); g.userData.focus = new T.Vector3(-660, 0, 270); g.userData.range = 520; group.add(g);
    const rand = rng(777);
    const treeGeo = merge([
      part(new T.CylinderGeometry(.35, .7, 1, 7), '#5b4330', 0, .5, 0),
      part(new T.DodecahedronGeometry(1, 0), '#1f7a35', 0, 1.0, 0, 0, 0, 0, 3.4, 1.1, 3.0), part(new T.DodecahedronGeometry(1, 0), '#2f9444', .6, 1.45, -.3, 0, .6, 0, 2.4, .9, 2.2),
      part(new T.DodecahedronGeometry(1, 0), '#4fb05a', -.4, 1.8, .4, 0, 1.2, 0, 1.6, .7, 1.5)
    ]);
    const JP = (S.pois || []).find((p) => p.id === 'jade'), clear = (x, z, r0) => !JP || Math.hypot(x - JP.x, z - JP.z) > r0;
    const trees = scatter(rand, lowQ ? 110 : 190, 16000, (x, z, r) => S.zoneWeights(x, z).jungle > .45 && land(x, z, 10) && clear(x, z, 48) && { h: 9 + r() * 9, r: r() * 6 });
    g.add(instanced(treeGeo, flat(), trees, (d, it) => { d.position.set(it.x, it.y - .3, it.z); d.rotation.set(0, it.r, 0); d.scale.set(it.h * .17, it.h, it.h * .17); }));
    const fernGeo = merge([0, 1, 2, 3, 4].map((k) => part(new T.PlaneGeometry(.6, 2.4), k % 2 ? '#3aa64c' : '#2b8a3e', Math.cos(k * 1.26) * .9, .55, Math.sin(k * 1.26) * .9, -1.05, -k * 1.26 + Math.PI / 2, 0)));
    const ferns = scatter(rand, lowQ ? 260 : 520, 20000, (x, z, r) => S.zoneWeights(x, z).jungle > .4 && land(x, z, 6) && clear(x, z, 20) && { s: .8 + r() * 1.4, r: r() * 6 });
    const fernMat = flat({ side: T.DoubleSide, flatShading: false });
    g.add(instanced(fernGeo, fernMat, ferns, (d, it) => { d.position.set(it.x, it.y, it.z); d.rotation.set(0, it.r, 0); d.scale.setScalar(it.s); }));
    // Temple de jade : pyramide à degrés et sanctuaire lumineux.
    const P = (S.pois || []).find((p) => p.id === 'jade');
    if (P) {
      const tg = new T.Group(), y0 = S.heightAt(P.x, P.z); tg.position.set(P.x, y0, P.z); g.add(tg);
      const stone = new T.MeshStandardMaterial({ color: '#7f9a86', roughness: 1, flatShading: true }), moss = new T.MeshStandardMaterial({ color: '#4c8f4e', roughness: 1 });
      for (let k = 0; k < 5; k++) { const w = 26 - k * 4.6; const m = new T.Mesh(new T.BoxGeometry(w, 3.2, w), k % 2 ? moss : stone); m.position.y = 1.6 + k * 3.2; tg.add(m); }
      const stairs = new T.Mesh(new T.BoxGeometry(5, 16, 9), stone); stairs.position.set(0, 7, 12); stairs.rotation.x = -.85; tg.add(stairs);
      const jade = new T.Mesh(new T.OctahedronGeometry(2.4, 0), new T.MeshStandardMaterial({ color: '#4dffb0', emissive: '#16c47a', emissiveIntensity: 1.6, roughness: .2, flatShading: true })); jade.position.y = 21; tg.add(jade);
      const jl = new T.PointLight('#3dffa8', 4, 70, 1.8); jl.position.y = 22; tg.add(jl);
      anim.push((t) => { jade.rotation.y = t * .8; jade.position.y = 21 + Math.sin(t * 1.4) * .6; jl.intensity = 3.5 + Math.sin(t * 2) * .8; });
    }
  }

  /* ------------------------------------------------ canyon rouge */
  function canyon(group) {
    const g = new T.Group(); g.userData.focus = new T.Vector3(520, 0, 540); g.userData.range = 560; group.add(g);
    const rand = rng(5150);
    const cactusGeo = merge([
      part(new T.CylinderGeometry(.42, .5, 4.2, 7), '#3f8f4a', 0, 2.1, 0), part(new T.SphereGeometry(.42, 7, 4), '#4a9e55', 0, 4.2, 0),
      part(new T.CylinderGeometry(.3, .32, 1.4, 6), '#3f8f4a', .85, 2.2, 0, 0, 0, Math.PI / 2), part(new T.CylinderGeometry(.28, .3, 1.6, 6), '#3f8f4a', 1.45, 3.0, 0),
      part(new T.CylinderGeometry(.28, .3, 1.1, 6), '#3f8f4a', -.7, 1.7, 0, 0, 0, Math.PI / 2), part(new T.CylinderGeometry(.26, .28, 1.3, 6), '#3f8f4a', -1.2, 2.3, 0),
      part(new T.SphereGeometry(.22, 5, 3), '#ff6fa0', 0, 4.6, 0)
    ]);
    const cacti = scatter(rand, lowQ ? 70 : 140, 12000, (x, z, r) => S.zoneWeights(x, z).desert > .45 && land(x, z, 10) && { s: .8 + r() * .9, r: r() * 6 });
    g.add(instanced(cactusGeo, flat(), cacti, (d, it) => { d.position.set(it.x, it.y - .1, it.z); d.rotation.set(0, it.r, 0); d.scale.setScalar(it.s); }));
    const spires = scatter(rand, 55, 8000, (x, z, r) => S.zoneWeights(x, z).desert > .55 && land(x, z, 14) && { h: 10 + r() * 22, w: 3 + r() * 5, r: r() * 6, col: C(r() > .5 ? '#c4673a' : '#d9844a') });
    const spireGeo = merge([part(new T.CylinderGeometry(.7, 1, 1, 7, 3), '#ffffff', 0, .5, 0), part(new T.CylinderGeometry(.85, .75, .12, 7), '#ffffff', 0, .62, 0), part(new T.CylinderGeometry(.75, .62, .1, 7), '#ffffff', 0, .3, 0)]);
    g.add(instanced(spireGeo, flat(), spires, (d, it) => { d.position.set(it.x, it.y - 1, it.z); d.rotation.set(0, it.r, 0); d.scale.set(it.w, it.h, it.w); }));
    const bones = scatter(rand, 30, 5000, (x, z, r) => S.zoneWeights(x, z).desert > .6 && land(x, z, 10) && { s: 1 + r(), r: r() * 6 });
    const boneGeo = merge([part(new T.CylinderGeometry(.12, .12, 3, 6), '#efe6d2', 0, .2, 0, 0, 0, Math.PI / 2), ...[0, 1, 2, 3].map((k) => part(new T.TorusGeometry(.7, .09, 5, 10, Math.PI), '#efe6d2', -1.1 + k * .7, .2, 0, 0, Math.PI / 2, 0))]);
    g.add(instanced(boneGeo, flat(), bones, (d, it) => { d.position.set(it.x, it.y, it.z); d.rotation.set(0, it.r, 0); d.scale.setScalar(it.s); }));
    // Arche de pierre au point d'intérêt.
    const P = (S.pois || []).find((p) => p.id === 'canyon');
    if (P) {
      const ag = new T.Group(), y0 = S.heightAt(P.x, P.z); ag.position.set(P.x, y0, P.z); ag.rotation.y = .5; g.add(ag);
      const red = new T.MeshStandardMaterial({ color: '#c4673a', roughness: 1, flatShading: true });
      const arch = new T.Mesh(new T.TorusGeometry(16, 4.2, 6, 14, Math.PI), red); ag.add(arch);
      for (const sx of [-16, 16]) { const leg = new T.Mesh(new T.CylinderGeometry(5, 6.5, 6, 7), red); leg.position.set(sx, -1, 0); ag.add(leg); }
    }
  }

  /* ------------------------------------------------ lac des reflets */
  function lake(group) {
    const L = S.LAKE; if (!L) return;
    const g = new T.Group(); g.userData.focus = new T.Vector3(L.x, 0, L.z); g.userData.range = 420; group.add(g);
    const rand = rng(3131);
    const reedGeo = merge([0, 1, 2, 3, 4].map((k) => part(new T.CylinderGeometry(.03, .05, 2.2 + (k % 3) * .5, 4), k % 2 ? '#6f9a3a' : '#88b04a', Math.cos(k * 1.3) * .35, 1.1, Math.sin(k * 1.3) * .35, (k - 2) * .08, 0, (k - 2) * .06)).concat([part(new T.CylinderGeometry(.07, .07, .45, 6), '#6b4a2a', .1, 2.4, 0)]));
    const reeds = [];
    for (let i = 0; i < (lowQ ? 90 : 170); i++) { const a = rand() * Math.PI * 2, q = 1.02 + rand() * .22, x = L.x + Math.cos(a) * L.r * q, z = L.z + Math.sin(a) * L.r * q; if (S.heightAt(x, z) > -3 && S.heightAt(x, z) < .5) reeds.push({ x, z, y: Math.max(-2, S.heightAt(x, z)), s: .8 + rand() * .6, r: rand() * 6 }); }
    g.add(instanced(reedGeo, flat({ flatShading: false }), reeds, (d, it) => { d.position.set(it.x, it.y, it.z); d.rotation.set(0, it.r, 0); d.scale.setScalar(it.s); }));
    const pads = [];
    for (let i = 0; i < 70; i++) { const a = rand() * Math.PI * 2, q = .3 + rand() * .6; pads.push({ x: L.x + Math.cos(a) * L.r * q, z: L.z + Math.sin(a) * L.r * q, s: .7 + rand() * .9, r: rand() * 6, col: C(rand() > .85 ? '#ff9ac8' : rand() > .5 ? '#3f9a4a' : '#5ab35a') }); }
    const padGeo = new T.CylinderGeometry(1, 1, .06, 10, 1, false, .4, Math.PI * 2 - .4);
    g.add(instanced(padGeo, flat(), pads, (d, it) => { d.position.set(it.x, -1.93, it.z); d.rotation.set(0, it.r, 0); d.scale.set(it.s, 1, it.s); }));
  }

  /* ------------------------------------------------ installation */
  const previousUpdate = E.update;
  E.update = function (dt, focus, day, quality) {
    const r = previousUpdate.apply(this, arguments);
    if (!this.v68Island) {
      this.v68Island = { group: new T.Group(), anim: [], t: 0 };
      recolour(this);
      const s = this.v68Island; s.group.name = 'v68-island';
      try { volcano(s.group, s.anim); snowpeaks(s.group, s.anim, this); jungle(s.group, s.anim); canyon(s.group); lake(s.group); } catch (e) { console.warn('[AZUR île]', e); }
      this.root.add(s.group);
    }
    const s = this.v68Island; s.t += Math.min(.1, dt || 0); lavaUniforms.time.value = s.t;
    const fx = focus?.x ?? 0, fz = focus?.z ?? 0, far = quality === 'low' ? .65 : 1;
    s.group.children.forEach((c) => { if (c.userData.focus) c.visible = Math.hypot(c.userData.focus.x - fx, c.userData.focus.z - fz) < c.userData.range * far; });
    for (const f of s.anim) f(s.t, focus);
    return r;
  };
  root.AZIsland = { zoneColor };
})(window);
