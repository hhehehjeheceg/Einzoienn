/* AZUR v65 — l'île s'habille.
 * Une couche de décor instancié (quelques appels de rendu seulement) posée
 * sur toute l'île, hors villes et hors routes :
 *  - touffes d'herbes hautes qui ondulent au vent, buissons, champignons ;
 *  - troncs couchés dans les clairières, meules de foin autour de la ferme ;
 *  - parasols et serviettes sur les plages, bouées et bateaux au large qui
 *    tanguent sur la houle.
 * Purement visuel : aucune collision, aucune règle de jeu modifiée. */
(function (root) {
  'use strict';
  const T = root.THREE, S = root.AZSim, A = root.AZArt, E = root.AZEnvironment?.Environment?.prototype;
  if (!T || !S || !A || !E) return;
  const SEA = -2;
  const routes = () => (Array.isArray(S.roads) ? S.roads : []).concat(Array.isArray(S.streets) ? S.streets : []);
  function nearRoute(x, z, margin) {
    for (const line of routes()) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], dx = b.x - a.x, dz = b.z - a.z, len = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len));
      if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < margin) return true;
    }
    return false;
  }
  const inTown = (x, z, pad) => S.regions.some((r) => Math.abs(x - r.x) < (r.padW || 0) + pad && Math.abs(z - r.z) < (r.padD || 0) + pad);
  function scatter(rand, count, tries, accept) {
    const out = [];
    for (let i = 0; i < tries && out.length < count; i++) {
      const x = (rand() - .5) * 1120, z = (rand() - .5) * 1120, hit = accept(x, z);
      if (hit) out.push(Object.assign({ x, z }, hit === true ? {} : hit));
    }
    return out;
  }
  function instanced(geo, mat, items, place, colors) {
    const mesh = new T.InstancedMesh(geo, mat, Math.max(1, items.length)), d = new T.Object3D(), c = new T.Color();
    items.forEach((it, i) => { place(d, it, i); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); if (colors) mesh.setColorAt(i, c.set(colors(it, i))); });
    mesh.count = items.length; mesh.frustumCulled = false; return mesh;
  }
  function lumpy(detail, amount, seed) {
    const g = new T.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + amount * Math.sin(v.x * 4.1 + seed) * Math.cos(v.z * 3.7 - seed) * Math.sin(v.y * 3.3 + seed * .5); p.setXYZ(i, v.x * k, v.y * k * .8, v.z * k); }
    g.computeVertexNormals(); return g;
  }
  function bladeGeometry() {
    // Trois brins croisés, du vert sombre au pied au vert clair à la pointe.
    const pos = [], col = [], dark = new T.Color('#2f6b3a'), light = new T.Color('#9fd16a');
    for (let b = 0; b < 3; b++) {
      const a = b * Math.PI / 3, cx = Math.cos(a) * .22, cz = Math.sin(a) * .22, h = .8 + b * .18, lean = (b - 1) * .12;
      pos.push(-cx, 0, -cz, cx, 0, cz, lean, h, lean * .5);
      col.push(dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, light.r, light.g, light.b);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }
  E.ensureV65MapDetails = function () {
    if (this.v65MapDetails) return;
    const group = new T.Group(), rand = A.rng(6505); group.name = 'v65-map-details';
    const land = (x, z, pad = 8) => S.biomeAt(x, z) !== 'water' && S.coastDistance(x, z) < 500 && !inTown(x, z, pad) && !nearRoute(x, z, 5);
    // Herbes hautes : le vent les fait onduler (décalage de sommet dans le shader).
    const grassItems = scatter(rand, 1800, 9000, (x, z) => S.biomeAt(x, z) === 'grass' && land(x, z) && { s: .7 + rand() * .9, r: rand() * 6.3 });
    const grassMat = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: .9 });
    const windU = { uWind: { value: 0 } };
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = windU.uWind;
      shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvec4 wp=instanceMatrix*vec4(0.,0.,0.,1.);float sway=sin(uWind*1.7+wp.x*.08+wp.z*.06)*.22+sin(uWind*3.1+wp.x*.21)*.07;transformed.x+=sway*position.y;transformed.z+=sway*.6*position.y;');
    };
    const grass = instanced(bladeGeometry(), grassMat, grassItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) - .05, it.z); d.rotation.set(0, it.r, 0); d.scale.set(it.s, it.s * (.8 + rand() * .6), it.s); });
    grass.castShadow = false; grass.receiveShadow = true; group.add(grass);
    // Buissons ronds et cabossés, trois teintes.
    const bushItems = scatter(rand, 320, 4000, (x, z) => (S.biomeAt(x, z) === 'grass' || S.biomeAt(x, z) === 'sand') && land(x, z, 10) && { s: .8 + rand() * 1.6, r: rand() * 6.3 });
    const bushes = instanced(lumpy(1, .22, 1.3), new T.MeshStandardMaterial({ roughness: .95, flatShading: true }), bushItems,
      (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + it.s * .45, it.z); d.rotation.set(0, it.r, 0); d.scale.set(it.s * 1.2, it.s * .9, it.s); },
      (it, i) => ['#5aa155', '#6fb35e', '#7fae4a', '#4f9a62'][i % 4]);
    bushes.castShadow = true; bushes.receiveShadow = true; group.add(bushes);
    // Champignons (pied + chapeau tacheté) au pied des arbres de la forêt.
    const shroomItems = scatter(rand, 160, 5000, (x, z) => S.biomeAt(x, z) === 'grass' && land(x, z) && Math.hypot(x + 330, z + 225) < 190 && { s: .35 + rand() * .55, r: rand() * 6.3 });
    group.add(instanced(new T.CylinderGeometry(.12, .16, .5, 6), new T.MeshStandardMaterial({ color: '#f2e6cf', roughness: .8 }), shroomItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + .25 * it.s, it.z); d.rotation.set(0, 0, 0); d.scale.setScalar(it.s); }));
    const capGeo = new T.SphereGeometry(.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    group.add(instanced(capGeo, new T.MeshStandardMaterial({ roughness: .6 }), shroomItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + .48 * it.s, it.z); d.rotation.set(0, it.r, 0); d.scale.set(it.s, it.s * .8, it.s); }, (it, i) => i % 3 ? '#c8452e' : '#d9913a'));
    // Troncs couchés.
    const logItems = scatter(rand, 60, 3000, (x, z) => S.biomeAt(x, z) === 'grass' && land(x, z, 12) && { s: 2.5 + rand() * 3.5, r: rand() * 6.3 });
    group.add(instanced(new T.CylinderGeometry(.42, .5, 1, 8), new T.MeshStandardMaterial({ color: '#6b4a32', roughness: .95 }), logItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + .42, it.z); d.rotation.set(0, it.r, Math.PI / 2); d.scale.set(1, it.s, 1); }));
    // Meules de foin autour de la Ferme Aurore.
    const farm = S.regions.find((r) => r.style === 'farm');
    const hayItems = farm ? scatter(rand, 22, 2000, (x, z) => Math.hypot(x - farm.x, z - farm.z) < 150 && land(x, z, 6) && { r: rand() * 6.3 }) : [];
    group.add(instanced(new T.CylinderGeometry(1.5, 1.5, 2.2, 14), new T.MeshStandardMaterial({ color: '#d9b45a', roughness: 1 }), hayItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + 1.5, it.z); d.rotation.set(Math.PI / 2, it.r, 0); }));
    // Plages : parasols rayés et serviettes.
    const beachItems = scatter(rand, 36, 6000, (x, z) => S.biomeAt(x, z) === 'sand' && S.coastDistance(x, z) > 470 && S.coastDistance(x, z) < 528 && S.heightAt(x, z) > SEA + .6 && !nearRoute(x, z, 5) && !inTown(x, z, 4) && { r: rand() * 6.3, tilt: (rand() - .5) * .25 });
    group.add(instanced(new T.CylinderGeometry(.06, .06, 3, 6), new T.MeshStandardMaterial({ color: '#eae3d2' }), beachItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + 1.5, it.z); d.rotation.set(it.tilt, 0, 0); d.scale.setScalar(1); }));
    group.add(instanced(new T.ConeGeometry(1.8, .7, 8, 1, true), new T.MeshStandardMaterial({ side: T.DoubleSide, roughness: .7 }), beachItems, (d, it) => { d.position.set(it.x, S.heightAt(it.x, it.z) + 3.1, it.z); d.rotation.set(it.tilt, it.r, 0); }, (it, i) => ['#ff7a59', '#2fa4d9', '#ffd166', '#f25f8a'][i % 4]));
    group.add(instanced(new T.BoxGeometry(1, .04, 2), new T.MeshStandardMaterial({ roughness: .9 }), beachItems, (d, it) => { d.position.set(it.x + Math.cos(it.r) * 2.2, S.heightAt(it.x, it.z) + .05, it.z + Math.sin(it.r) * 2.2); d.rotation.set(0, it.r, 0); }, (it, i) => ['#ffffff', '#7fd1c7', '#ffb37a'][i % 3]));
    // Au large : bouées et bateaux qui tanguent (animés dans update()).
    const sea = [];
    for (let i = 0; i < 14; i++) { const a = rand() * Math.PI * 2, r = 575 + rand() * 110; sea.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: rand() * 6.3, boat: i < 7, ph: rand() * 6 }); }
    const boats = sea.filter((s) => s.boat), buoys = sea.filter((s) => !s.boat);
    const hull = new T.InstancedMesh(new T.CylinderGeometry(1.4, .9, 1.2, 8, 1).scale(1, 1, 3.2), new T.MeshStandardMaterial({ roughness: .6 }), boats.length);
    const cabin = new T.InstancedMesh(new T.BoxGeometry(1.8, 1.4, 2.2), new T.MeshStandardMaterial({ color: '#f4f1e8', roughness: .7 }), boats.length);
    const buoy = new T.InstancedMesh(new T.ConeGeometry(.6, 1.6, 8), new T.MeshStandardMaterial({ color: '#ff5a3c', emissive: '#ff2a10', emissiveIntensity: .3 }), buoys.length);
    boats.forEach((b, i) => hull.setColorAt(i, new T.Color(['#2f6fa6', '#c8452e', '#f2f2f2', '#2b8f6f'][i % 4])));
    [hull, cabin, buoy].forEach((m) => { m.frustumCulled = false; group.add(m); });
    group.userData = { grass, windU, hull, cabin, buoy, boats, buoys, dummy: new T.Object3D() };
    this.root.add(group); this.v65MapDetails = group;
  };
  const previousUpdate = E.update;
  E.update = function (dt, focus, day, quality) {
    this.ensureV65MapDetails();
    const u = this.v65MapDetails.userData, premium = quality === 'high' || quality === 'ultra', t = (u.windU.uWind.value += Math.min(.1, dt || 0));
    this.v65MapDetails.visible = quality !== 'low';
    u.grass.visible = premium || quality === 'medium';
    // Houle : chaque coque tangue et roule à son propre rythme.
    const d = u.dummy;
    u.boats.forEach((b, i) => {
      d.position.set(b.x, SEA + .35 + Math.sin(t * 1.1 + b.ph) * .25, b.z); d.rotation.set(Math.sin(t * .9 + b.ph) * .06, b.r, Math.sin(t * 1.3 + b.ph) * .08); d.scale.setScalar(1); d.updateMatrix(); u.hull.setMatrixAt(i, d.matrix);
      d.position.y += 1.1; d.translateZ(-.8); d.updateMatrix(); u.cabin.setMatrixAt(i, d.matrix);
    });
    u.buoys.forEach((b, i) => { d.position.set(b.x, SEA + .5 + Math.sin(t * 1.6 + b.ph) * .3, b.z); d.rotation.set(Math.sin(t * 1.2 + b.ph) * .15, 0, Math.cos(t + b.ph) * .15); d.updateMatrix(); u.buoy.setMatrixAt(i, d.matrix); });
    u.hull.instanceMatrix.needsUpdate = u.cabin.instanceMatrix.needsUpdate = u.buoy.instanceMatrix.needsUpdate = true;
    return previousUpdate.call(this, dt, focus, day, quality);
  };
})(window);
