/* AZUR v66 — nouveau salon : « Le Dernier Horizon ».
 * Le personnage se tient sur une île flottante au crépuscule, au-dessus d'une
 * mer de nuages. Dans le ciel violet-orangé : la météorite figée dans sa bulle
 * de temps, une faille qui fend le ciel, des îlots avec cascades, la fusée
 * sur son pas de tir au loin et le Battle Bus qui traverse lentement le décor.
 * Remplace entièrement l'ancien hangar ; l'interface (cadrage, rotation du
 * personnage, équipe) reste celle du jeu. */
(function (root) {
  'use strict';
  const T = root.THREE, V = root.AZView?.View?.prototype, A = root.AZArt;
  if (!T || !V || !A) return;
  const rand = (() => { let s = 6606; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();

  function skyMaterial(uniforms) {
    return new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: 'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'varying vec3 v;uniform float time;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'void main(){vec3 d=normalize(v);float y=d.y;',
        ' vec3 top=vec3(.06,.05,.2),mid=vec3(.42,.2,.52),low=vec3(1.,.55,.32),hor=vec3(1.,.78,.5);',
        ' vec3 c=mix(hor,low,smoothstep(-.05,.08,y));c=mix(c,mid,smoothstep(.08,.34,y));c=mix(c,top,smoothstep(.34,.85,y));',
        ' float sunA=max(0.,dot(d,normalize(vec3(.55,.06,-1.))));c+=vec3(1.,.62,.3)*pow(sunA,24.)*.9+vec3(1.,.4,.25)*pow(sunA,5.)*.22;',
        ' vec2 g=d.xz/(abs(y)+.25)*90.;float st=step(.997,h(floor(g)))*smoothstep(.25,.6,y)*(.6+.4*sin(time*2.+h(floor(g))*40.));c+=vec3(st);',
        ' float band=sin(d.x*6.+time*.15)*.5+.5;c+=vec3(.25,.9,.85)*pow(band,8.)*smoothstep(.3,.6,y)*(1.-smoothstep(.6,.9,y))*.12;',
        ' gl_FragColor=vec4(c,1.);}'
      ].join('\n') });
  }
  function glowTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(cv); return t;
  }
  function lumpy(r, detail, amount, seed) {
    const geo = new T.IcosahedronGeometry(r, detail), p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const k = 1 + amount * (Math.sin(n.x * 5 + seed) * Math.cos(n.z * 4.3 - seed) * .6 + Math.sin(n.y * 7.1 + seed * 2) * .4); p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
    geo.computeVertexNormals(); return geo;
  }
  function floatingIsland(radius, height, grass, rock) {
    const g = new T.Group();
    const top = new T.Mesh(new T.CylinderGeometry(radius, radius * .96, .45, 28), new T.MeshStandardMaterial({ color: grass, roughness: .85 }));
    top.position.y = -.22; g.add(top);
    const rim = new T.Mesh(new T.CylinderGeometry(radius * 1.01, radius * .98, .18, 28), new T.MeshStandardMaterial({ color: '#3f8f3a', roughness: .9 })); rim.position.y = -.42; g.add(rim);
    const under = new T.Mesh(new T.ConeGeometry(radius * .98, height, 9, 3), new T.MeshStandardMaterial({ color: rock, roughness: .95, flatShading: true }));
    const up = under.geometry.attributes.position;
    for (let i = 0; i < up.count; i++) { const y = up.getY(i); if (y < height / 2 - .01) { up.setX(i, up.getX(i) * (1 + (rand() - .5) * .25)); up.setZ(i, up.getZ(i) * (1 + (rand() - .5) * .25)); } }
    under.geometry.computeVertexNormals(); under.rotation.x = Math.PI; under.position.y = -.5 - height / 2; g.add(under);
    return g;
  }
  function tree(g, x, z, s) {
    const trunk = new T.Mesh(new T.CylinderGeometry(.09 * s, .14 * s, 1.1 * s, 7), new T.MeshStandardMaterial({ color: '#6b4a32' }));
    trunk.position.set(x, .55 * s, z); g.add(trunk);
    // Feuillage arrondi : trois boules lisses, plus claires sur le dessus.
    const mat = new T.MeshStandardMaterial({ color: rand() > .5 ? '#4fae4f' : '#3d9a52', roughness: .85 });
    const top2 = new T.MeshStandardMaterial({ color: '#7fcf5a', roughness: .85 });
    [[0, 0, 0, .62, mat], [.34, -.12, .12, .42, mat], [-.32, -.1, -.1, .44, mat], [.06, .3, -.04, .36, top2]].forEach(([dx, dy, dz, r, m]) => {
      const b = new T.Mesh(new T.IcosahedronGeometry(r * s, 2), m); b.position.set(x + dx * s, 1.35 * s + dy * s, z + dz * s); b.scale.y = .88; g.add(b);
    });
  }

  function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }
  function makeLobby(view) {
    view.menuScene?.clear?.(); view.menuAvatar = null; view.menuTeam = []; view.menuTeamKey = '';
    const scene = view.menuScene = new T.Scene(); scene.background = new T.Color('#2a1640'); scene.fog = new T.FogExp2('#8a4a6a', .012);
    view.menuCamera = new T.PerspectiveCamera(36, 1, .1, 220);
    const w = view.canvas?.clientWidth || 1, h = view.canvas?.clientHeight || 1; view.menuCamera.aspect = w / h; view.menuCamera.updateProjectionMatrix();
    const skyU = { time: { value: 0 } }, glow = glowTexture();
    const rootGroup = new T.Group(); rootGroup.name = 'v66-lobby-last-horizon'; scene.add(rootGroup);
    rootGroup.add(new T.Mesh(new T.SphereGeometry(150, 32, 20), skyMaterial(skyU)));

    // Lumières : soleil couchant chaud, contre-jour cyan, remplissage violet.
    scene.add(new T.HemisphereLight('#ffd6b8', '#3b2a5c', 1.25));
    const sun = new T.DirectionalLight('#ffb27a', 2.4); sun.position.set(6, 5, 6); scene.add(sun);
    const rim = new T.DirectionalLight('#5ff0ff', 2.2); rim.position.set(-6, 5, -5); scene.add(rim);
    const key = new T.SpotLight('#fff1d6', 40, 16, .5, .8, 1.3); key.position.set(1.5, 7, 4); key.target.position.set(0, 1, 0); scene.add(key, key.target);

    // Île principale + plateforme du joueur.
    const island = floatingIsland(9.5, 9, '#63c24e', '#7b6553'); rootGroup.add(island);
    const pad = new T.Group(); rootGroup.add(pad);
    pad.add(at(new T.Mesh(new T.CylinderGeometry(2.05, 2.2, .26, 40), new T.MeshStandardMaterial({ color: '#2b2f52', roughness: .4, metalness: .5 })), 0, .1, 0));
    pad.add(at(new T.Mesh(new T.CylinderGeometry(1.8, 1.8, .05, 40), new T.MeshStandardMaterial({ color: '#3d3f78', roughness: .35, metalness: .4 })), 0, .25, 0));
    const ring = new T.Mesh(new T.TorusGeometry(1.92, .045, 8, 72), new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: .95, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .25; pad.add(ring);
    const ring2 = new T.Mesh(new T.TorusGeometry(1.2, .025, 6, 64), new T.MeshBasicMaterial({ color: '#6ff6ff', transparent: true, opacity: .8, depthWrite: false, blending: T.AdditiveBlending }));
    ring2.rotation.x = Math.PI / 2; ring2.position.y = .28; pad.add(ring2);
    const beam = new T.Mesh(new T.CylinderGeometry(1.4, 1.9, 7, 24, 1, true), new T.MeshBasicMaterial({ color: '#ffdca0', transparent: true, opacity: .05, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    beam.position.y = 3.6; pad.add(beam);
    // Décor de l'île : arbres, rochers, drapeaux, lanternes.
    [[-5.6, -6.5, 1.3], [-3.9, -8.2, 1.05], [5.8, -7, 1.35], [3.8, -8.6, .95], [-7.4, -3.8, .9]].forEach(([x, z, s]) => tree(island, x, z, s));
    const rockMat = new T.MeshStandardMaterial({ color: '#9a8a7a', roughness: .95, flatShading: true });
    [[-3.4, -2.6, .35], [3.3, -2.4, .3], [6.2, -4.6, .5], [-1.8, -6.4, .55]].forEach(([x, z, s], i) => { const r = new T.Mesh(lumpy(s, 0, .25, i), rockMat); r.position.set(x, s * .5, z); island.add(r); });
    const flagMat = new T.MeshStandardMaterial({ color: '#ff5d73', side: T.DoubleSide, roughness: .7 }), poleMat = new T.MeshStandardMaterial({ color: '#e9e3d4' });
    const flags = [];
    for (const side of [-1, 1]) {
      const pole = new T.Mesh(new T.CylinderGeometry(.05, .06, 3.4, 8), poleMat); pole.position.set(side * 4.2, 1.7, -4.6); island.add(pole);
      const flag = new T.Mesh(new T.PlaneGeometry(1, .6, 8, 2), side < 0 ? flagMat : new T.MeshStandardMaterial({ color: '#4dc9ff', side: T.DoubleSide, roughness: .7 }));
      flag.position.set(side * 4.2 + side * .52, 3.1, -4.6); island.add(flag); flags.push(flag);
    }
    // Fil de lanternes entre les mâts.
    const bulbs = new T.InstancedMesh(new T.SphereGeometry(.07, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: .95, toneMapped: false }), 17);
    { const d = new T.Object3D(), cols = ['#ffd27a', '#ff8fb1', '#8ff3ff'];
      for (let k = 0; k <= 16; k++) { const t = k / 16; d.position.set(-4.2 + 8.4 * t, 3.3 - Math.sin(t * Math.PI) * .8, -4.6); d.updateMatrix(); bulbs.setMatrixAt(k, d.matrix); bulbs.setColorAt(k, new T.Color(cols[k % 3])); } }
    island.add(bulbs);

    // Mer de nuages sous l'île (un seul appel de rendu).
    const cloud = new T.Group(); rootGroup.add(cloud);
    const puffs = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshStandardMaterial({ color: '#ffe3ef', roughness: 1, flatShading: true, emissive: '#5a2f55', emissiveIntensity: .25 }), 140);
    { const d = new T.Object3D(); for (let i = 0; i < 140; i++) { const a = rand() * Math.PI * 2, r = 9 + rand() * 60; d.position.set(Math.cos(a) * r, -9 - rand() * 4, Math.sin(a) * r - 10); const s = 2.5 + rand() * 5; d.scale.set(s * 1.6, s * .55, s); d.rotation.y = rand() * 6; d.updateMatrix(); puffs.setMatrixAt(i, d.matrix); } }
    cloud.add(puffs);

    // Îlots lointains avec cascades.
    const islets = [];
    [[-17, 2, -32, 2.8], [16, 5, -36, 3.4], [-28, 8, -52, 4], [9, -1, -22, 1.8]].forEach(([x, y, z, s], i) => {
      const isl = floatingIsland(s, s * 2.2, i % 2 ? '#7ccf5a' : '#58b852', '#8a7260'); isl.position.set(x, y, z); rootGroup.add(isl);
      tree(isl, -s * .3, 0, s * .45); if (s > 2) tree(isl, s * .35, -s * .2, s * .38);
      const fall = new T.Mesh(new T.PlaneGeometry(s * .35, s * 3.2), new T.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: .55, depthWrite: false, side: T.DoubleSide }));
      fall.position.set(s * .55, -s * 1.6, s * .45); fall.lookAt(0, -s * 1.6, 30); isl.add(fall);
      islets.push({ g: isl, y, phase: i * 1.7 });
    });

    // La météorite figée dans sa bulle de temps, avec sa traînée de feu immobile.
    const meteor = new T.Group(); meteor.position.set(-14, 12, -46); rootGroup.add(meteor);
    meteor.add(new T.Mesh(lumpy(4.2, 2, .28, 3), new T.MeshStandardMaterial({ color: '#2a211d', roughness: .9, flatShading: true, emissive: '#ff4a12', emissiveIntensity: .55, fog: false })));
    const tail = new T.Mesh(new T.ConeGeometry(4.2, 22, 18, 1, true), new T.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: .35, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    tail.geometry.translate(0, 13, 0); tail.rotation.z = .9; tail.rotation.x = -.3; meteor.add(tail);
    const bubble = new T.Mesh(new T.SphereGeometry(8, 32, 20), new T.MeshBasicMaterial({ color: '#7ad8ff', transparent: true, opacity: .14, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    meteor.add(bubble);
    const meteorGlow = new T.Sprite(new T.SpriteMaterial({ map: glow, color: '#ff7a3a', transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false })); meteorGlow.scale.setScalar(26); meteor.add(meteorGlow);
    // La faille qui déchire le ciel.
    const rift = new T.Mesh(new T.PlaneGeometry(26, 26), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: skyU,
      vertexShader: 'varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 u;uniform float time;float h(float n){return fract(sin(n*91.3)*437.5);}float pl(float x){float i=floor(x);return mix(h(i),h(i+1.),fract(x));}void main(){vec2 p=(u-.5)*2.;float y=(pl(p.x*6.)-.5)*.12+(pl(p.x*17.)-.5)*.05;float len=1.-smoothstep(.55,.95,abs(p.x));float d=abs(p.y-y);float core=exp(-d*70.)*len;float glow=exp(-d*9.)*len*.5;float fl=.8+.2*sin(time*13.+p.x*30.);gl_FragColor=vec4(mix(vec3(.4,.8,1.),vec3(1.),core),(core+glow)*fl);}' }));
    rift.position.set(17, 15, -56); rift.rotation.z = -.5; rift.lookAt(0, 3, 10); rootGroup.add(rift);
    // La fusée sur son pas de tir, au loin.
    const rocket = new T.Group(); rocket.position.set(10.5, -1.2, -28); rootGroup.add(rocket);
    const hull = new T.MeshStandardMaterial({ color: '#eef2f4', roughness: .45, metalness: .2 }), dark = new T.MeshStandardMaterial({ color: '#24324a', roughness: .6 });
    rocket.add(at(new T.Mesh(new T.CylinderGeometry(.55, .6, 4.4, 16), hull), 0, 2.2, 0));
    rocket.add(at(new T.Mesh(new T.ConeGeometry(.55, 1.6, 16), dark), 0, 5.2, 0));
    rocket.add(at(new T.Mesh(new T.BoxGeometry(.5, 6.4, .5), dark), 1.2, 3.2, 0));
    const rocketLight = new T.Sprite(new T.SpriteMaterial({ map: glow, color: '#ff4d3d', transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })); rocketLight.position.set(1.2, 6.6, 0); rocketLight.scale.setScalar(1.2); rocket.add(rocketLight);
    // Le Battle Bus qui traverse le ciel.
    let bus = null; try { bus = A.aircraft(); bus.scale.setScalar(.09); rootGroup.add(bus); } catch (e) { bus = null; }
    // Lucioles et étincelles.
    const motes = new T.InstancedMesh(new T.SphereGeometry(.04, 6, 5), new T.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: .8, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }), 60);
    { const d = new T.Object3D(); for (let i = 0; i < 60; i++) { d.position.set((rand() - .5) * 12, .3 + rand() * 5, -4 + (rand() - .5) * 9); d.updateMatrix(); motes.setMatrixAt(i, d.matrix); } }
    rootGroup.add(motes);
    view.v2Lobby = { root: rootGroup, waterUniforms: skyU, ring, ring2, beam, cloud, bulbs, motes, sun, rim, v66: { flags, islets, meteor, bubble, meteorGlow, bus, rocketLight, tail } };
    view.menuTerrace = null;
  }

  V.makeMenu = function () { makeLobby(this); };
  V.setClassicLobbyMode = function (active, panel = false) {
    if (!this.v2Lobby?.v66) makeLobby(this);
    this.v2Lobby.root.visible = true; this.menuScene.background.set(panel ? '#1d1030' : '#2a1640'); this.menuScene.fog.density = panel ? .009 : .012;
    return this.v2Lobby.root;
  };
  const previousDraw = V.drawMenu;
  V.drawMenu = function (world, player, dt, options = {}) {
    if (!this.v2Lobby?.v66) makeLobby(this);
    const r = previousDraw.call(this, world, player, dt, options);
    const x = this.v2Lobby.v66, t = this.time || 0;
    x.flags.forEach((f, i) => { const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const u = (p.getX(k) + .6) / 1.2; p.setZ(k, Math.sin(t * 4 + u * 5 + i) * .12 * u); } p.needsUpdate = true; });
    x.islets.forEach((s) => { s.g.position.y = s.y + Math.sin(t * .5 + s.phase) * .35; s.g.rotation.y = Math.sin(t * .1 + s.phase) * .1; });
    x.meteor.rotation.y = t * .02; x.bubble.material.opacity = .12 + Math.sin(t * 1.3) * .03; x.meteorGlow.material.opacity = .6 + Math.sin(t * 2.1) * .12;
    x.rocketLight.material.opacity = Math.sin(t * 5) > 0 ? .95 : .2;
    if (x.bus) { const k = ((t * .012) % 1); x.bus.position.set(-60 + k * 120, 14 + Math.sin(t * .4) * .8, -50); x.bus.rotation.y = -Math.PI / 2; }
    return r;
  };
})(window);
