/* AZUR v67 — dix lieux nommés sur l'île.
 * Chaque lieu a une vraie présence de jeu (objets solides, récoltables, coffres
 * avec butin, créés par la simulation donc identiques en LAN) et un décor
 * propre dessiné par le moteur, visible dans tous les modes :
 *   1. Dépôt des Conteneurs  — conteneurs empilés, silos, grue qui pivote
 *   2. Éoliennes du Plateau  — cinq éoliennes géantes sur la crête
 *   3. Cratère de l'Impact   — cratère calciné, roche céleste, cristaux bleus
 *   4. Camp des Explorateurs — tentes, feu de camp vivant, caisses
 *   5. Ruines du Temple      — colonnes brisées, arches, dalles
 *   6. Tour de Guet          — tour en bois et longue-vue sur la côte est
 *   7. Phare de la Pointe    — phare rayé, faisceau tournant, maison du gardien
 *   8. Épave du Galion       — coque échouée, mât brisé, canons, trésor
 *   9. Parc des Lumières     — grande roue, manège, chapiteaux, guirlandes
 *  10. Carrière de Cristal   — gradins taillés, mine, wagonnet, cristaux
 * Les lieux sont aussi marqués sur la carte et la minicarte. Chaque décor est
 * masqué quand on en est loin, pour ne rien coûter aux performances. */
(function (root) {
  'use strict';
  const S = root.AZSim, T = root.THREE, E = root.AZEnvironment?.Environment?.prototype;
  if (!S || !S.World) return;
  const POIS = [
    { id: 'depot', name: 'Dépôt des Conteneurs', x: -160, z: -22, color: '#ff8a3c' },
    { id: 'wind', name: 'Éoliennes du Plateau', x: 178, z: 70, color: '#8fe3ff' },
    { id: 'crater', name: 'Cratère de l’Impact', x: 120, z: -160, color: '#b38cff' },
    { id: 'camp', name: 'Camp des Explorateurs', x: -125, z: 95, color: '#ffd23f' },
    { id: 'ruins', name: 'Ruines du Temple', x: -200, z: -205, color: '#e6d3a3' },
    { id: 'watch', name: 'Tour de Guet', x: 285, z: 140, color: '#7fe08a' },
    { id: 'phare', name: 'Phare de la Pointe', x: -606, z: 6, color: '#ff5d6c' },
    { id: 'epave', name: 'Épave du Galion', x: -112, z: 586, color: '#c9965a' },
    { id: 'parc', name: 'Parc des Lumières', x: 190, z: 190, color: '#ff7ad9' },
    { id: 'carriere', name: 'Carrière de Cristal', x: -416, z: -92, color: '#6fe7ff' },
    { id: 'volcan', name: 'Volcan Cendré', x: -640, z: -560, color: '#ff5a1e' },
    { id: 'givre', name: 'Pics Givrés', x: 600, z: -560, color: '#bfeaff' },
    { id: 'jade', name: 'Temple de Jade', x: -650, z: 285, color: '#4dffb0' },
    { id: 'canyon', name: 'Canyon Rouge', x: 560, z: 560, color: '#e0763a' },
    { id: 'lac', name: 'Lac des Reflets', x: -115, z: 465, color: '#5fd4ff' }
  ];
  S.pois = POIS;
  const P = (id) => POIS.find((p) => p.id === id);

  /* ------------------------------------------------ simulation (solide) */
  const W = S.World.prototype, previousCreate = W._createMap;
  W._createMap = function () {
    const r = previousCreate.apply(this, arguments);
    const add = (type, x, z, w, h, mat, yaw) => { try { return this._object(type, x, z, w, h, mat, yaw || 0); } catch (e) { return null; } };
    const chest = (x, z) => add('chest', x, z, .8, 1, 'wood', 0);
    let p = P('depot');
    [[-18, -8], [-18, 0], [-12, -8], [14, 10], [14, 18], [20, 10], [-4, 18], [6, -16]].forEach(([dx, dz], i) => add('container', p.x + dx, p.z + dz, 1.5, 2.5, 'metal', i % 2 ? Math.PI / 2 : 0));
    add('silo', p.x + 22, p.z - 16, 2.4, 9, 'metal'); add('silo', p.x + 28, p.z - 10, 2.4, 9, 'metal');
    chest(p.x, p.z); chest(p.x - 15, p.z + 6); chest(p.x + 17, p.z + 14);
    p = P('crater');
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add('rock', p.x + Math.cos(a) * 21, p.z + Math.sin(a) * 21, 1.6 + (i % 3) * .5, 2.6 + (i % 2), 'stone'); }
    chest(p.x + 5, p.z - 3); chest(p.x - 6, p.z + 4);
    p = P('camp');
    [[-9, 4], [8, 6], [0, -9]].forEach(([dx, dz]) => add('crate', p.x + dx, p.z + dz, 1.2, 1.2, 'wood'));
    chest(p.x + 3, p.z + 2); chest(p.x - 4, p.z - 3);
    p = P('ruins');
    [[-10, -10], [10, -10], [-10, 10], [10, 10], [0, -14], [-14, 0], [14, 2]].forEach(([dx, dz]) => add('rock', p.x + dx, p.z + dz, 1.1, 2.2, 'stone'));
    chest(p.x, p.z); chest(p.x + 6, p.z - 6);
    p = P('watch'); chest(p.x + 2, p.z + 3);
    p = P('wind'); chest(p.x, p.z + 4);
    p = P('phare'); add('silo', p.x, p.z, 3.2, 26, 'stone'); add('crate', p.x + 9, p.z + 6, 3.2, 3, 'wood'); chest(p.x + 4, p.z - 5);
    p = P('epave'); [[-8, 0], [-3, 1], [2, 1.5], [7, 2]].forEach(([dx, dz]) => add('container', p.x + dx, p.z + dz, 1.4, 2.4, 'wood', Math.PI / 2 + .3));
    chest(p.x + 1, p.z - 5); chest(p.x - 10, p.z + 6);
    p = P('parc'); add('silo', p.x - 14, p.z, 1.6, 4, 'metal'); add('rock', p.x + 12, p.z + 2, 3, 2.6, 'wood');
    [[0, 14], [8, -12], [-8, -12]].forEach(([dx, dz]) => add('crate', p.x + dx, p.z + dz, 1.2, 1.2, 'wood'));
    chest(p.x, p.z + 6); chest(p.x + 14, p.z - 10); chest(p.x - 16, p.z + 12);
    p = P('carriere'); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add('rock', p.x + Math.cos(a) * 24, p.z + Math.sin(a) * 24, 2 + (i % 3) * .6, 3.5, 'stone'); }
    chest(p.x, p.z); chest(p.x + 10, p.z - 6); chest(p.x - 9, p.z + 8);
    // Nouveaux biomes : coffres sur la lèvre du volcan, au refuge des pics, au temple et sous l'arche.
    p = P('volcan'); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4; chest(p.x + Math.cos(a) * 58, p.z + Math.sin(a) * 58); }
    for (let i = 0; i < 10; i++) { const a = i * .63; add('rock', p.x + Math.cos(a) * 110, p.z + Math.sin(a) * 110, 1.6, 2.6, 'stone'); }
    p = P('givre'); chest(p.x, p.z); chest(p.x + 14, p.z + 8); for (let i = 0; i < 12; i++) { const a = i * .52; add('tree', p.x + Math.cos(a) * (30 + i * 3), p.z + Math.sin(a) * (30 + i * 3), .9, 6, 'wood'); }
    p = P('jade'); chest(p.x, p.z + 20); chest(p.x - 18, p.z - 10); chest(p.x + 18, p.z - 10); for (let i = 0; i < 14; i++) { const a = i * .45; add('tree', p.x + Math.cos(a) * (36 + i * 4), p.z + Math.sin(a) * (36 + i * 4), 1, 8, 'wood'); }
    // Lac des Reflets : maison sur l'îlot, pontons et cabanes de pêcheurs sur la rive.
    p = P('lac');
    const isle = add('house', p.x, p.z, 4.4, 8, 'wood', 0);
    if (isle) { isle.d = 4.4; isle.style = 'lagoon'; isle.floors = 2; isle.door = { x: p.x, z: p.z - 4.4, side: 'north' }; }
    chest(p.x, p.z + 1); chest(p.x + 2.5, p.z - 1);
    [[0, -62], [58, 20], [-56, 26]].forEach(([dx, dz]) => {
      const hx = p.x + dx, hz = p.z + dz, hut = add('house', hx, hz, 3.6, 4, 'wood', 0);
      if (hut) { hut.d = 3.6; hut.style = 'forest'; hut.floors = 1; hut.door = { x: hx, z: hz - 3.6, side: 'north' }; }
      chest(hx, hz + 1);
    });
    add('dock', p.x + 4, p.z - 46, 8, 1.2, 'wood'); add('dock', p.x + 44, p.z + 14, 8, 1.2, 'wood');
    p = P('canyon'); chest(p.x, p.z); chest(p.x + 22, p.z + 6); for (let i = 0; i < 8; i++) { const a = i * .8; add('rock', p.x + Math.cos(a) * 34, p.z + Math.sin(a) * 34, 2, 3, 'stone'); }
    return r;
  };

  /* ------------------------------------------------ carte */
  if (root.AZMapUI?.buildMapTexture) {
    const previousTexture = root.AZMapUI.buildMapTexture;
    root.AZMapUI.buildMapTexture = function () {
      const r = previousTexture.apply(this, arguments);
      const ctx = this.mapTexture?.getContext('2d'); if (!ctx) return r;
      const span = S.MAP.halfSize * 2;
      ctx.save(); ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center';
      for (const p of POIS) {
        const x = (p.x / span + .5) * 512, y = (p.z / span + .5) * 512;
        ctx.fillStyle = p.color; ctx.strokeStyle = '#1b1f36'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeText(p.name, x, y + 16); ctx.fillStyle = '#fff'; ctx.fillText(p.name, x, y + 16);
      }
      ctx.restore(); return r;
    };
  }

  /* ------------------------------------------------ décor */
  if (!T || !E) return;
  const std = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .75, metalness: .1 }, extra || {}));
  const mesh = (parent, geo, mat, x, y, z, rx, ry, rz) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const ground = (x, z) => S.heightAt(x, z);
  function lumpy(r, detail, amount, seed) {
    const g = new T.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const k = 1 + amount * Math.sin(n.x * 5 + seed) * Math.cos(n.z * 4 - seed) * Math.sin(n.y * 3 + seed); p.setXYZ(i, v.x * k, v.y * k * .8, v.z * k); }
    g.computeVertexNormals(); return g;
  }

  function depot(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); group.add(g);
    const yellow = std('#ffc23d'), steel = std('#4d5966', { metalness: .5, roughness: .45 }), red = std('#e2543a');
    // Grue à tour : mât en treillis, flèche qui pivote lentement, câble et crochet.
    const mast = new T.Group(); mast.position.set(-2, 0, -12); g.add(mast);
    for (let k = 0; k < 4; k++) mesh(mast, new T.BoxGeometry(.25, 26, .25), yellow, (k & 1 ? .9 : -.9), 13, (k & 2 ? .9 : -.9));
    for (let y = 2; y < 26; y += 3) { mesh(mast, new T.BoxGeometry(2, .15, .15), yellow, 0, y, .9); mesh(mast, new T.BoxGeometry(2, .15, .15), yellow, 0, y, -.9); mesh(mast, new T.BoxGeometry(.15, .15, 2), yellow, .9, y, 0); mesh(mast, new T.BoxGeometry(.15, .15, 2), yellow, -.9, y, 0); }
    const jib = new T.Group(); jib.position.y = 26.5; mast.add(jib);
    mesh(jib, new T.BoxGeometry(24, 1.1, 1.1), yellow, 7, 0, 0); mesh(jib, new T.BoxGeometry(3, 2.2, 2.2), red, 0, 0, 0); mesh(jib, new T.BoxGeometry(3.5, 2, 2), steel, -5, -.4, 0);
    mesh(jib, new T.CylinderGeometry(.05, .05, 14, 4), steel, 16, -7, 0); mesh(jib, new T.BoxGeometry(.8, .6, .8), red, 16, -14.2, 0);
    anim.push((t) => { jib.rotation.y = Math.sin(t * .08) * 1.2; });
    // Marquages au sol, barrières et projecteurs.
    mesh(g, new T.PlaneGeometry(46, 40), std('#6b6f73', { roughness: .95 }), 0, .05, 0, -Math.PI / 2);
    for (let k = -2; k <= 2; k++) mesh(g, new T.PlaneGeometry(.5, 36), std('#ffd23f'), k * 9, .07, 0, -Math.PI / 2);
    for (let k = 0; k < 8; k++) mesh(g, new T.BoxGeometry(2.6, 1, .25), k % 2 ? red : std('#f2f2f2'), -22 + k * 3.1, .5, 20);
    for (const sx of [-21, 21]) { mesh(g, new T.CylinderGeometry(.15, .2, 9, 8), steel, sx, 4.5, -18); mesh(g, new T.BoxGeometry(1.4, .8, .6), steel, sx, 9, -18); }
  }
  function windfarm(group, p, anim) {
    const white = std('#f4f6f8', { roughness: .4 }), grey = std('#c9d3db');
    [[0, 0], [-26, 18], [24, -14], [30, 26], [-30, -22]].forEach(([dx, dz], i) => {
      const x = p.x + dx, z = p.z + dz, g = new T.Group(); g.position.set(x, ground(x, z), z); g.rotation.y = .6; g.userData.poi = 'wind'; group.add(g);
      mesh(g, new T.CylinderGeometry(.55, 1.1, 30, 12), white, 0, 15, 0);
      mesh(g, new T.BoxGeometry(1.6, 1.6, 3.6), grey, 0, 30.5, .4);
      const hub = new T.Group(); hub.position.set(0, 30.5, -1.6); g.add(hub);
      mesh(hub, new T.SphereGeometry(.7, 12, 8), white, 0, 0, 0);
      for (let b = 0; b < 3; b++) { const blade = new T.Group(); blade.rotation.z = b * Math.PI * 2 / 3; hub.add(blade); mesh(blade, new T.BoxGeometry(.9, 13, .25), white, 0, 7, 0); mesh(blade, new T.BoxGeometry(.9, 1.2, .26), std('#e2543a'), 0, 13, 0); }
      const speed = .7 + (i % 3) * .15; anim.push((t) => { hub.rotation.z = t * speed; });
    });
  }
  function crater(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); group.add(g);
    const scorch = new T.Mesh(new T.CircleGeometry(24, 40), new T.MeshStandardMaterial({ color: '#2b2321', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.y = .06; scorch.receiveShadow = true; g.add(scorch);
    const rim = new T.Mesh(new T.TorusGeometry(19, 2.2, 8, 40), std('#5d4a3e', { roughness: 1, flatShading: true })); rim.rotation.x = Math.PI / 2; rim.scale.z = .5; rim.position.y = .3; g.add(rim);
    const meteor = mesh(g, lumpy(4.2, 2, .3, 4), std('#2f2724', { roughness: .9, flatShading: true, emissive: '#ff5a14', emissiveIntensity: .45 }), 0, 1.6, 0, .4, .2, .3);
    const crystals = new T.InstancedMesh(new T.CylinderGeometry(.25, .55, 1, 6), std('#9fd8ff', { emissive: '#3a8cff', emissiveIntensity: .8, roughness: .15, flatShading: true }), 26);
    const d = new T.Object3D();
    for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = 5 + (i % 7) * 1.6, h = 1.2 + (i % 5) * .7; d.position.set(Math.cos(a) * rr, h * .4, Math.sin(a) * rr); d.rotation.set((i % 3 - 1) * .4, a, (i % 2 - .5) * .5); d.scale.set(1, h, 1); d.updateMatrix(); crystals.setMatrixAt(i, d.matrix); }
    g.add(crystals);
    const light = new T.PointLight('#6fb8ff', 3, 30, 2); light.position.y = 4; g.add(light);
    anim.push((t) => { light.intensity = 2.5 + Math.sin(t * 2.2) * .8; meteor.material.emissiveIntensity = .4 + Math.sin(t * 1.6) * .15; });
  }
  function camp(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); group.add(g);
    [['#e2543a', -8, -2, .3], ['#2fa4d9', 7, -5, -.4], ['#ffc23d', 5, 8, 1.1], ['#7fe08a', -7, 8, 2.3]].forEach(([c, x, z, r]) => {
      const tent = mesh(g, new T.ConeGeometry(2.6, 3, 4), std(c, { roughness: .9 }), x, 1.5, z, 0, r + Math.PI / 4, 0); tent.scale.z = 1.4;
      mesh(g, new T.PlaneGeometry(1.2, 1.6), std('#2a2230'), x + Math.cos(r) * 1.9, .8, z - Math.sin(r) * 1.9, 0, r + Math.PI / 2, 0);
    });
    for (let k = 0; k < 4; k++) mesh(g, new T.CylinderGeometry(.18, .2, 1.8, 6), std('#6b4a32'), Math.cos(k * 1.57) * .5, .2, Math.sin(k * 1.57) * .5, Math.PI / 2, k * 1.57, 0);
    for (let k = 0; k < 6; k++) mesh(g, new T.DodecahedronGeometry(.35, 0), std('#8a8580', { flatShading: true }), Math.cos(k) * 1.2, .15, Math.sin(k) * 1.2);
    const flameMat = new T.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false });
    const flames = [0, 1, 2].map((k) => mesh(g, new T.ConeGeometry(.45 - k * .1, 1.4 - k * .25, 6, 1, true), flameMat, (k - 1) * .2, .9, (k % 2) * .2));
    const fire = new T.PointLight('#ff9a3c', 4, 22, 2); fire.position.y = 1.4; g.add(fire);
    for (const [x, z, r] of [[-3, 3, .2], [3.2, -2.6, 1.6]]) mesh(g, new T.CylinderGeometry(.35, .35, 2.4, 8), std('#6b4a32'), x, .35, z, 0, r, Math.PI / 2);
    anim.push((t) => { flames.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 9 + k) * .12, 1 + Math.sin(t * 13 + k * 2) * .25, 1); }); fire.intensity = 3.6 + Math.sin(t * 17) * .5 + Math.sin(t * 7) * .4; });
  }
  function ruins(group, p) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); group.add(g);
    const stone = std('#d8cba6', { roughness: .95, flatShading: true }), moss = std('#7fae4a', { roughness: 1 });
    mesh(g, new T.BoxGeometry(22, .4, 22), std('#c3b48d', { roughness: 1 }), 0, .2, 0);
    [[-8, -8, 6], [8, -8, 3.5], [-8, 8, 4.5], [8, 8, 7], [-8, 0, 2.5], [8, 0, 5.5], [0, -8, 7], [0, 8, 3]].forEach(([x, z, h], i) => {
      mesh(g, new T.CylinderGeometry(.75, .85, h, 10), stone, x, h / 2 + .4, z, (i % 3 === 1 ? .08 : 0), 0, (i % 2 ? .06 : -.04));
      mesh(g, new T.BoxGeometry(2, .5, 2), stone, x, .65, z);
      if (i % 3 === 0) mesh(g, new T.BoxGeometry(1.9, .4, 1.9), moss, x, h + .55, z);
    });
    mesh(g, new T.BoxGeometry(18, 1.4, 2), stone, 0, 7.6, -8);
    mesh(g, new T.CylinderGeometry(.75, .75, 7, 10), stone, 5, .8, 3.5, 0, .4, Math.PI / 2);
    const idol = mesh(g, new T.OctahedronGeometry(1.2, 0), std('#ffd23f', { emissive: '#ff9a00', emissiveIntensity: .6, metalness: .6, roughness: .3 }), 0, 2.4, 0);
    return (t) => { idol.rotation.y = t * .6; idol.position.y = 2.4 + Math.sin(t * 1.5) * .25; };
  }
  function watchtower(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); group.add(g);
    const wood = std('#8a6040', { roughness: .9 }), plank = std('#b88a5a', { roughness: .9 });
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) mesh(g, new T.CylinderGeometry(.22, .3, 14, 8), wood, x, 7, z, 0, 0, 0);
    for (let y = 3; y < 13; y += 3.5) { mesh(g, new T.BoxGeometry(4.6, .2, .2), wood, 0, y, 2, 0, 0, .7); mesh(g, new T.BoxGeometry(4.6, .2, .2), wood, 0, y, -2, 0, 0, -.7); }
    mesh(g, new T.BoxGeometry(6, .4, 6), plank, 0, 14, 0);
    mesh(g, new T.ConeGeometry(4.6, 3, 4), std('#c24a3a', { roughness: .8 }), 0, 17.6, 0, 0, Math.PI / 4, 0);
    for (const s of [-1, 1]) { mesh(g, new T.BoxGeometry(6, 1, .15), plank, 0, 14.7, s * 3); mesh(g, new T.BoxGeometry(.15, 1, 6), plank, s * 3, 14.7, 0); }
    const scope = mesh(g, new T.CylinderGeometry(.18, .24, 1.6, 10), std('#2b3a4a', { metalness: .6 }), 1.6, 15.6, 0, 0, 0, Math.PI / 2);
    const flag = mesh(g, new T.PlaneGeometry(1.6, 1, 6, 1), std('#4dc9ff', { side: T.DoubleSide }), .8, 20.6, 0);
    mesh(g, new T.CylinderGeometry(.06, .06, 4, 6), wood, 0, 20, 0);
    anim.push((t) => { scope.rotation.y = Math.sin(t * .3) * .9; const a = flag.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const u = (a.getX(i) + .8) / 1.6; a.setZ(i, Math.sin(t * 5 + u * 6) * .15 * u); } a.needsUpdate = true; });
  }


  function lighthouse(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); g.userData.poi = 'phare'; group.add(g);
    const white = std('#f4f1ea', { roughness: .6 }), red = std('#e2443a', { roughness: .6 }), dark = std('#2b3440', { metalness: .4, roughness: .5 });
    mesh(g, lumpy(7, 1, .25, 2), std('#8b8378', { flatShading: true, roughness: 1 }), 0, .5, 0);
    for (let k = 0; k < 6; k++) { const r0 = 3.4 - k * .2, r1 = 3.4 - (k + 1) * .2; mesh(g, new T.CylinderGeometry(r1, r0, 4, 18), k % 2 ? red : white, 0, 2 + k * 4, 0); }
    mesh(g, new T.CylinderGeometry(3.3, 3.3, .5, 18), dark, 0, 24.2, 0);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; mesh(g, new T.BoxGeometry(.1, 1.2, .1), dark, Math.cos(a) * 3.1, 25, Math.sin(a) * 3.1); }
    mesh(g, new T.TorusGeometry(3.1, .06, 4, 24), dark, 0, 25.6, 0, Math.PI / 2);
    const glass = new T.MeshStandardMaterial({ color: '#fff6c8', emissive: '#ffd36b', emissiveIntensity: 1.4, transparent: true, opacity: .75, roughness: .1 });
    mesh(g, new T.CylinderGeometry(1.9, 1.9, 2.6, 12, 1, true), glass, 0, 25.8, 0);
    mesh(g, new T.ConeGeometry(2.5, 2.2, 12), red, 0, 28.2, 0); mesh(g, new T.SphereGeometry(.35, 8, 6), dark, 0, 29.4, 0);
    const beamMat = new T.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    const rotor = new T.Group(); rotor.position.y = 25.8; g.add(rotor);
    for (const s of [-1, 1]) { const cone = new T.Mesh(new T.ConeGeometry(5, 70, 16, 1, true), beamMat); cone.rotation.z = s * Math.PI / 2; cone.position.x = s * 36; rotor.add(cone); }
    const lamp = new T.PointLight('#ffd36b', 3, 40, 2); lamp.position.y = 25.8; g.add(lamp);
    const house = new T.Group(); house.position.set(9, 0, 6); g.add(house);
    mesh(house, new T.BoxGeometry(6, 3.4, 4.6), white, 0, 1.7, 0); mesh(house, new T.ConeGeometry(4.4, 2.4, 4), std('#3c5f8a'), 0, 4.6, 0, 0, Math.PI / 4, 0);
    mesh(house, new T.BoxGeometry(1.1, 2, .1), std('#6b4a32'), 0, 1, 2.31); mesh(house, new T.BoxGeometry(1, 1, .1), glass, 2, 2, 2.31);
    anim.push((t) => { rotor.rotation.y = t * .9; lamp.intensity = 2.5 + Math.sin(t * 1.8) * .5; });
  }
  function shipwreck(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z) - .6, p.z); g.rotation.y = .3; group.add(g);
    const hullMat = std('#7a4e2c', { roughness: .95, flatShading: true }), plank = std('#a8743f', { roughness: .95 }), dark = std('#3b2a20', { roughness: 1 });
    const hull = new T.Group(); hull.rotation.z = .32; hull.rotation.x = -.06; g.add(hull);
    for (let k = 0; k < 9; k++) { const x = -10 + k * 2.4, w = 4.6 - Math.abs(k - 4) * .45; if (k === 6) continue; mesh(hull, new T.BoxGeometry(2.3, 3.2, w), hullMat, x, 1.6, 0); mesh(hull, new T.BoxGeometry(2.32, .3, w + .2), plank, x, 3.3, 0); }
    mesh(hull, new T.ConeGeometry(2.2, 4.5, 4), hullMat, 12.2, 1.8, 0, 0, Math.PI / 4, -Math.PI / 2);
    mesh(hull, new T.BoxGeometry(4, 2.2, 4.2), plank, -9.5, 4.4, 0);
    for (let k = 0; k < 10; k++) mesh(hull, new T.BoxGeometry(.25, 1.6, .25), dark, -10 + k * 2.2, 2.4, (k % 2 ? 1 : -1) * 2.3, (k % 3) * .2);
    const mast = mesh(hull, new T.CylinderGeometry(.35, .45, 12, 8), dark, -2, 8.5, 0, 0, 0, -.25);
    mesh(hull, new T.CylinderGeometry(.18, .18, 7, 6), dark, -2.5, 11, 0, Math.PI / 2, 0, 0);
    const sail = mesh(hull, new T.PlaneGeometry(6, 4.4, 8, 4), std('#e8dcc0', { side: T.DoubleSide, roughness: 1 }), -2.6, 9, .1, 0, Math.PI / 2, 0);
    mesh(g, new T.CylinderGeometry(.3, .4, 7, 8), dark, 9, .5, 5, Math.PI / 2, .8, 0);
    for (const [x, z] of [[-4, -6], [3, -6.5], [-12, 4]]) { mesh(g, new T.CylinderGeometry(.35, .45, 2.6, 10), std('#2b2b2f', { metalness: .6, roughness: .4 }), x, .6, z, Math.PI / 2, .4, 0); mesh(g, new T.BoxGeometry(1, .6, 1.4), dark, x, .3, z + 1.2); }
    for (let k = 0; k < 5; k++) mesh(g, new T.CylinderGeometry(.55, .55, 1.2, 10), plank, -14 + k * 1.3, .6, -8 + (k % 2) * 1.1, 0, 0, k === 3 ? Math.PI / 2 : 0);
    const gold = std('#ffd23f', { emissive: '#ff9a00', emissiveIntensity: .5, metalness: .7, roughness: .3 });
    for (let k = 0; k < 14; k++) mesh(g, new T.CylinderGeometry(.18, .18, .06, 10), gold, 1 + Math.cos(k * 2.1) * (1 + k * .08), .45 + (k % 3) * .05, -5 + Math.sin(k * 2.1) * (1 + k * .08), (k % 2) * .4);
    const pos = sail.geometry.attributes.position, base = pos.array.slice();
    anim.push((t) => { for (let i = 0; i < pos.count; i++) { const u = (base[i * 3] + 3) / 6; pos.setZ(i, base[i * 3 + 2] + Math.sin(t * 2.2 + base[i * 3 + 1] * 1.3 + u * 4) * .35 * u); } pos.needsUpdate = true; });
  }
  function funfair(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); g.userData.poi = 'parc'; group.add(g);
    const white = std('#f7f3ea'), steel = std('#c9d3db', { metalness: .5, roughness: .4 }), colors = ['#ff5d8f', '#ffd23f', '#4fc3ff', '#7fe08a', '#b38cff', '#ff8a3c'];
    mesh(g, new T.CylinderGeometry(30, 30, .2, 40), std('#d9c9a0', { roughness: 1 }), 0, .1, 0);
    // Grande roue (les nacelles restent droites en tournant).
    const wheel = new T.Group(); wheel.position.set(-14, 15, 0); g.add(wheel);
    for (const s of [-1, 1]) { mesh(g, new T.BoxGeometry(.5, 16, .5), steel, -14 + s * 4, 7.6, -1.6, 0, 0, s * .26); mesh(g, new T.BoxGeometry(.5, 16, .5), steel, -14 + s * 4, 7.6, 1.6, 0, 0, s * .26); }
    for (const z of [-1.2, 1.2]) { const rim = mesh(wheel, new T.TorusGeometry(11, .22, 6, 40), steel, 0, 0, z); rim.castShadow = false; }
    mesh(wheel, new T.CylinderGeometry(.9, .9, 3, 12), white, 0, 0, 0, Math.PI / 2);
    const cars = [];
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2; mesh(wheel, new T.BoxGeometry(.18, 11, .18), steel, Math.cos(a) * 5.5, Math.sin(a) * 5.5, 0, 0, 0, a - Math.PI / 2);
      const car = new T.Group(); car.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0); wheel.add(car); cars.push(car);
      mesh(car, new T.CylinderGeometry(1, 1.1, 1.4, 8), std(colors[k % 6], { roughness: .5 }), 0, -1.6, 0); mesh(car, new T.ConeGeometry(1.2, .7, 8), white, 0, -.6, 0); mesh(car, new T.CylinderGeometry(.05, .05, 1, 4), steel, 0, -.4, 0);
    }
    const bulbMat = new T.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false });
    const bulbs = new T.InstancedMesh(new T.SphereGeometry(.16, 6, 4), bulbMat, 48), d = new T.Object3D();
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; d.position.set(Math.cos(a) * 11.4, Math.sin(a) * 11.4, (k % 2 ? 1.25 : -1.25)); d.updateMatrix(); bulbs.setMatrixAt(k, d.matrix); }
    wheel.add(bulbs);
    // Manège : toit rayé, chevaux qui montent et descendent.
    const caro = new T.Group(); caro.position.set(12, 0, 2); g.add(caro);
    mesh(caro, new T.CylinderGeometry(7, 7.2, .8, 24), std('#7a3fb0'), 0, .4, 0); mesh(caro, new T.CylinderGeometry(.6, .6, 6, 10), std('#ffd23f', { metalness: .6, roughness: .3 }), 0, 3.4, 0);
    const spin = new T.Group(); caro.add(spin);
    for (let k = 0; k < 12; k++) { const roofSeg = mesh(spin, new T.ConeGeometry(7.6, 3, 12, 1, true, k / 12 * Math.PI * 2, Math.PI * 2 / 12), std(k % 2 ? '#ff5d8f' : '#f7f3ea', { side: T.DoubleSide }), 0, 7.4, 0); roofSeg.castShadow = false; }
    const horses = [];
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, h = new T.Group(); h.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5); h.rotation.y = -a; spin.add(h); horses.push(h);
      mesh(h, new T.CylinderGeometry(.06, .06, 6, 4), std('#ffd23f', { metalness: .6 }), 0, 3.6, 0);
      const c = std(colors[k % 6]); mesh(h, new T.BoxGeometry(.6, .6, 1.6), c, 0, 2, 0); mesh(h, new T.BoxGeometry(.4, .8, .5), c, 0, 2.5, .8, -.4); mesh(h, new T.BoxGeometry(.35, .4, .6), c, 0, 2.9, 1.1);
    }
    // Chapiteaux et guirlandes.
    [[-2, -18, '#ff5d8f'], [10, -16, '#4fc3ff'], [20, 14, '#ffd23f'], [-20, 18, '#7fe08a']].forEach(([x, z, c]) => {
      mesh(g, new T.CylinderGeometry(3.4, 3.4, 2.6, 12), white, x, 1.3, z); mesh(g, new T.ConeGeometry(4, 3.4, 12), std(c), x, 4.3, z); mesh(g, new T.BoxGeometry(.5, .6, .5), std(c), x, 6.3, z);
    });
    const lights = new T.InstancedMesh(new T.SphereGeometry(.14, 6, 4), new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 60);
    const tmpC = new T.Color();
    for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r = 24; d.position.set(Math.cos(a) * r, 4.6 + Math.sin(k * .52) * .3, Math.sin(a) * r); d.updateMatrix(); lights.setMatrixAt(k, d.matrix); lights.setColorAt(k, tmpC.set(colors[k % 6])); }
    g.add(lights);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; mesh(g, new T.CylinderGeometry(.1, .12, 5, 6), steel, Math.cos(a) * 24, 2.5, Math.sin(a) * 24); }
    anim.push((t) => { wheel.rotation.z = t * .12; for (const c of cars) c.rotation.z = -wheel.rotation.z; spin.rotation.y = t * .5; horses.forEach((h, k) => { h.children[1].position.y = 2 + Math.sin(t * 2.4 + k) * .45; h.children[2].position.y = 2.5 + Math.sin(t * 2.4 + k) * .45; h.children[3].position.y = 2.9 + Math.sin(t * 2.4 + k) * .45; }); });
  }
  function quarry(group, p, anim) {
    const g = new T.Group(); g.position.set(p.x, ground(p.x, p.z), p.z); group.add(g);
    const rock = std('#9a8f86', { flatShading: true, roughness: 1 }), rock2 = std('#7d736b', { flatShading: true, roughness: 1 });
    for (let ring = 0; ring < 3; ring++) { const r = 26 - ring * 6; mesh(g, new T.CylinderGeometry(r, r + 1.5, 1.4, 28), ring % 2 ? rock : rock2, 0, .7 - ring * .2, 0); }
    mesh(g, new T.CircleGeometry(12, 28), std('#5d5550', { roughness: 1 }), 0, 1.45, 0, -Math.PI / 2);
    // Entrée de mine : arche en bois dans un rocher.
    const cliff = mesh(g, lumpy(9, 1, .3, 7), rock, -6, 4, -20); cliff.scale.set(1.4, .9, .8);
    const wood = std('#7a5232', { roughness: 1 });
    mesh(g, new T.BoxGeometry(.6, 5, .6), wood, -9, 3.5, -13); mesh(g, new T.BoxGeometry(.6, 5, .6), wood, -3, 3.5, -13); mesh(g, new T.BoxGeometry(7, .7, .7), wood, -6, 6.1, -13);
    mesh(g, new T.PlaneGeometry(5.4, 4.6), std('#0d0c10'), -6, 3.4, -13.4);
    // Rails, wagonnet chargé de cristaux.
    for (let k = 0; k < 14; k++) mesh(g, new T.BoxGeometry(2.2, .14, .35), wood, -6, 1.55, -11 + k * 1.1);
    for (const s of [-1, 1]) mesh(g, new T.BoxGeometry(.12, .16, 15.5), std('#5a5f66', { metalness: .6 }), -6 + s * .7, 1.7, -3.5);
    const cart = new T.Group(); cart.position.set(-6, 2.2, 0); g.add(cart);
    mesh(cart, new T.BoxGeometry(1.8, 1.1, 2.4), std('#6b4a32'), 0, .3, 0); for (const [x, z] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) mesh(cart, new T.CylinderGeometry(.3, .3, .2, 10), std('#333'), x, -.35, z, 0, 0, Math.PI / 2);
    const cmat = std('#9ff0ff', { emissive: '#2ec9ff', emissiveIntensity: 1, roughness: .15, flatShading: true, transparent: true, opacity: .92 });
    for (let k = 0; k < 5; k++) mesh(cart, new T.OctahedronGeometry(.45 + (k % 2) * .15, 0), cmat, (k - 2) * .35, 1.1, (k % 2 - .5) * .6, k, k * .7, 0);
    const crystals = new T.InstancedMesh(new T.CylinderGeometry(.0, .7, 1, 6), cmat, 34), d = new T.Object3D();
    for (let k = 0; k < 34; k++) { const a = k * 1.9, r = 13 + (k % 5) * 2.4, h = 1.5 + (k % 4) * 1.1; d.position.set(Math.cos(a) * r, 1.4 + h * .45 - (r > 19 ? 0 : .3), Math.sin(a) * r); d.rotation.set((k % 3 - 1) * .35, a, (k % 2 - .5) * .45); d.scale.set(1, h, 1); d.updateMatrix(); crystals.setMatrixAt(k, d.matrix); }
    g.add(crystals);
    const glow = new T.PointLight('#5fe3ff', 3, 36, 2); glow.position.set(0, 5, 0); g.add(glow);
    anim.push((t) => { cmat.emissiveIntensity = .8 + Math.sin(t * 1.7) * .3; cart.position.z = Math.sin(t * .25) * 4; glow.intensity = 2.6 + Math.sin(t * 2.1) * .6; });
  }
  E.ensurePoiDecor = function () {
    if (this.v66Pois) return;
    const group = new T.Group(); group.name = 'v66-pois'; const anim = [];
    depot(group, P('depot'), anim); windfarm(group, P('wind'), anim); crater(group, P('crater'), anim);
    camp(group, P('camp'), anim); const idol = ruins(group, P('ruins')); if (idol) anim.push(idol); watchtower(group, P('watch'), anim);
    lighthouse(group, P('phare'), anim); shipwreck(group, P('epave'), anim); funfair(group, P('parc'), anim); quarry(group, P('carriere'), anim);
    this.root.add(group); this.v66Pois = { group, anim, t: 0 };
  };
  // Distance d'affichage de chaque décor (le phare et la grande roue se voient de loin).
  const VIEW = { phare: 900, parc: 700, wind: 800 };
  const previousUpdate = E.update;
  E.update = function (dt, focus, day, quality) {
    this.ensurePoiDecor();
    const s = this.v66Pois; s.t += Math.min(.1, dt || 0);
    const fx = focus?.x ?? 0, fz = focus?.z ?? 0, far = quality === 'low' ? .6 : 1;
    s.group.children.forEach((child) => {
      const d = Math.hypot(child.position.x - fx, child.position.z - fz), poi = child.userData.poi;
      child.visible = d < (VIEW[poi] || 520) * far;
    });
    for (const f of s.anim) f(s.t);
    return previousUpdate.call(this, dt, focus, day, quality);
  };
})(window);
