/* Horizons 1.6 — état du salon isolé, scène classique et finition graphique. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons, T = root.THREE, A = root.AZArt, S = root.AZSim;
  if (!H || !T || !A || !S) return;
  const P = H.prototype, V = root.AZView?.View?.prototype, E = root.AZEnvironment?.Environment?.prototype;

  /* Le démarrage WebGL peut dépasser l’ancien délai de rafraîchissement sur mobile.
     On attend réellement que le menu existe avant d’appliquer la version courante. */
  let initialRefreshCount = 0;
  const initialRefresh = setInterval(() => {
    initialRefreshCount += 1;
    const game = root.AZUR;
    if (game?.screen === "menu" && game.tab === "play" && !document.querySelector(".classic-progress")) {
      clearInterval(initialRefresh);
      game.renderMenu();
    } else if (document.querySelector(".classic-progress") || initialRefreshCount > 240) clearInterval(initialRefresh);
  }, 250);

  /* Le salon repart toujours de l'équipement réellement équipé. Une prévisualisation
     du Casier ne peut donc plus conserver son décor, son type ou son personnage. */
  const previousUpdatePreview = P.updatePreview;
  P.updatePreview = function () {
    if (this.tab === "play") {
      this.selectedCosmetic = null;
      this.previewType = null;
      this.previewEquipment = { ...this.profile.equipment };
      return;
    }
    return previousUpdatePreview.call(this);
  };

  const previousRenderMenu = P.renderMenu;
  P.renderMenu = function () {
    if (this.tab === "play") {
      this.selectedCosmetic = null;
      this.previewType = null;
      this.previewEquipment = { ...this.profile.equipment };
    }
    previousRenderMenu.call(this);
    document.body.dataset.tab = this.tab;
    document.body.classList.toggle("classic-lobby-active", this.tab === "play");
    this.view?.setClassicLobbyMode?.(this.tab === "play");
    if (this.tab === "play") {
      const label = document.querySelector(".classic-lobby-title");
      if (label) label.textContent = "SALON";
      document.querySelectorAll(".wordmark-edition,.season-badge").forEach((node) => {
        node.innerHTML = node.innerHTML.replace(/1\.[345]/g, "1.6");
      });
    }
  };

  if (V) {
    V.ensureClassicLobbyScene = function () {
      if (this.classicLobbyScene) return this.classicLobbyScene;
      const group = new T.Group();
      group.name = "classic-lobby-scene";

      const canvas = document.createElement("canvas");
      canvas.width = 1024; canvas.height = 512;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, "#0b3d72"); gradient.addColorStop(.48, "#061f48"); gradient.addColorStop(1, "#03112d");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = "rgba(86,151,211,.18)"; ctx.lineWidth = 1;
      const size = 74, height = size * .866;
      for (let row = -1; row < 10; row++) for (let col = -1; col < 17; col++) {
        const x = col * size + (row & 1 ? size / 2 : 0), y = row * height;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size / 2, y + height); ctx.lineTo(x + size * 1.5, y + height); ctx.lineTo(x + size * 2, y); ctx.stroke();
      }
      const wallTexture = new T.CanvasTexture(canvas); wallTexture.colorSpace = T.SRGBColorSpace;
      const wall = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({ map: wallTexture, depthWrite: false }));
      wall.position.set(0, 4.2, -7.2); group.add(wall);

      const floor = new T.Mesh(new T.PlaneGeometry(30, 24), new T.MeshStandardMaterial({ color: "#173653", roughness: .78, metalness: .08 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.02, -2.3); floor.receiveShadow = true; group.add(floor);
      const horizon = new T.Mesh(new T.PlaneGeometry(30, 3.1), new T.MeshBasicMaterial({ color: "#0a274d", transparent: true, opacity: .86 }));
      horizon.position.set(0, .52, -6.95); group.add(horizon);

      const ring = new T.Mesh(new T.RingGeometry(.66, 1.02, 64), new T.MeshBasicMaterial({ color: "#21e9ff", transparent: true, opacity: .78, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .018; group.add(ring);
      const inner = new T.Mesh(new T.CircleGeometry(.67, 64), new T.MeshBasicMaterial({ color: "#087be7", transparent: true, opacity: .42, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      inner.rotation.x = -Math.PI / 2; inner.position.y = .016; group.add(inner);
      const beam = new T.Mesh(new T.CylinderGeometry(.42, .9, 5.1, 28, 1, true), new T.MeshBasicMaterial({ color: "#18cfff", transparent: true, opacity: .055, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      beam.position.y = 2.45; group.add(beam);
      const light = new T.PointLight("#27ddff", 3.2, 8.5, 1.8); light.position.set(0, 2.6, 1.2); group.add(light);
      const rim = new T.DirectionalLight("#7bdfff", .9); rim.position.set(-3, 5, -2); group.add(rim);

      group.userData = { ring, inner, beam, light, wallTexture };
      this.menuScene.add(group); this.classicLobbyScene = group;
      this.classicLobbyBackground = this.menuScene.background?.clone?.() || new T.Color("#071d31");
      return group;
    };

    V.setClassicLobbyMode = function (active, panel = false) {
      const classic = this.ensureClassicLobbyScene();
      classic.visible = !!active;
      /* La terrasse historique n’appartient qu’aux écrans qui n’ont pas de panneau.
         Le Casier, la Boutique et le Passe gardent un fond bleu calme et l’avatar. */
      const legacyVisible = !active && !panel;
      if (this.menuTerrace) this.menuTerrace.visible = legacyVisible;
      if (this.menuWater) this.menuWater.visible = legacyVisible;
      if (this.menuSunDisc) this.menuSunDisc.visible = legacyVisible;
      if (this.menuIslands) this.menuIslands.visible = legacyVisible;
      if (this.menuSky) this.menuSky.visible = legacyVisible;
      if (this.menuDust) this.menuDust.visible = legacyVisible;
      this.menuScene.fog.density = panel ? .025 : .055;
      this.menuScene.background = active ? new T.Color("#03142f") : panel ? new T.Color("#092744") : this.classicLobbyBackground.clone();
    };

    const previousDrawMenu = V.drawMenu;
    V.drawMenu = function (world, player, dt, options = {}) {
      const classic = !options.panel && document.body.dataset.tab === "play";
      this.setClassicLobbyMode(classic, !!options.panel);
      if (classic && this.classicLobbyScene) {
        const u = this.classicLobbyScene.userData, t = this.time || 0;
        u.ring.rotation.z = t * .08; u.inner.rotation.z = -t * .045;
        const pulse = .94 + Math.sin(t * 2.2) * .055;
        u.ring.scale.setScalar(pulse); u.beam.material.opacity = .047 + Math.sin(t * 1.7) * .012;
        u.light.intensity = 3 + Math.sin(t * 2.1) * .35;
      }
      return previousDrawMenu.call(this, world, player, dt, options);
    };

    const previousAnimateAvatar = V.animateAvatar;
    V.animateAvatar = function (model, player, dt, options = {}) {
      previousAnimateAvatar.call(this, model, player, dt, options);
      if (!options.menu || document.body.dataset.tab !== "play" || !model?.userData) return;
      const u = model.userData, t = this.time || 0;
      model.scale.setScalar(1.16);
      model.position.y += .015 + Math.sin(t * 1.8) * .006;
      if (!player.emote && !player.gliding) {
        u.torso.rotation.y += Math.sin(t * .62) * .018;
        u.torso.rotation.x -= .018;
        u.head.rotation.y += Math.sin(t * .48) * .026;
        u.limbs[1].rotation.z -= .055; u.limbs[3].rotation.z += .055;
      }
    };

    const previousConfigure = V.configure;
    V.configure = function (settings = {}) {
      previousConfigure.call(this, settings);
      const premium = this.quality === "high" || this.quality === "ultra";
      this.renderer.toneMappingExposure = premium ? 1.1 : 1.06;
      this.sun.shadow.normalBias = premium ? .025 : .04;
      this.sun.shadow.bias = premium ? -.00035 : -.0006;
      const anisotropy = Math.min(this.quality === "ultra" ? 12 : 8, this.renderer.capabilities.getMaxAnisotropy?.() || 1);
      this.environment?.root?.traverse((node) => {
        const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        mats.forEach((mat) => { if (mat.map) { mat.map.anisotropy = anisotropy; mat.map.needsUpdate = true; } });
      });
    };
  }

  if (E) {
    E.ensureV16MapDetails = function () {
      if (this.v16MapDetails) return;
      const group = new T.Group(), rand = A.rng(1606), dummy = new T.Object3D();
      const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(.34, 0), new T.MeshStandardMaterial({ color: "#8ba09d", roughness: 1, vertexColors: true, flatShading: true }), 180);
      let rockCount = 0;
      for (let tries = 0; tries < 1600 && rockCount < 180; tries++) {
        const x = (rand() - .5) * 970, z = (rand() - .5) * 970, biome = S.biomeAt(x, z);
        if (biome === "water" || S.regions.some((r) => Math.abs(x-r.x) < (r.padW||0)+10 && Math.abs(z-r.z) < (r.padD||0)+10)) continue;
        const y = S.heightAt(x, z), scale = .45 + rand() * 1.2;
        dummy.position.set(x, y + .08, z); dummy.rotation.set(rand()*.4, rand()*Math.PI, rand()*.35); dummy.scale.set(scale, scale*(.55+rand()*.35), scale); dummy.updateMatrix();
        rocks.setMatrixAt(rockCount, dummy.matrix);
        rocks.setColorAt(rockCount, new T.Color(biome === "snow" ? "#c2d8dc" : biome === "desert" ? "#b88758" : rand()>.5 ? "#6d8176" : "#9a8b72"));
        rockCount++;
      }
      rocks.count = rockCount; rocks.receiveShadow = true; rocks.castShadow = false; group.add(rocks);

      const flowerPositions = [], flowerColors = [];
      for (let tries = 0; tries < 2600 && flowerPositions.length < 1260; tries++) {
        const x = (rand() - .5) * 920, z = (rand() - .5) * 920;
        if (S.biomeAt(x,z) !== "grass" || S.regions.some((r) => Math.abs(x-r.x) < (r.padW||0)+7 && Math.abs(z-r.z) < (r.padD||0)+7)) continue;
        flowerPositions.push(x, S.heightAt(x,z)+.24+rand()*.16, z);
        const c = new T.Color(rand()>.66 ? "#ffd67c" : rand()>.5 ? "#f69a8a" : "#b9eff0"); flowerColors.push(c.r,c.g,c.b);
      }
      const flowerGeo = new T.BufferGeometry(); flowerGeo.setAttribute("position", new T.Float32BufferAttribute(flowerPositions,3)); flowerGeo.setAttribute("color",new T.Float32BufferAttribute(flowerColors,3));
      const flowers = new T.Points(flowerGeo,new T.PointsMaterial({size:.27,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,sizeAttenuation:true})); group.add(flowers);
      group.userData = { rocks, flowers }; this.root.add(group); this.v16MapDetails = group;
    };
    const previousEnvironmentUpdate = E.update;
    E.update = function (dt, focus, day, quality) {
      this.ensureV16MapDetails();
      const premium = quality === "high" || quality === "ultra";
      this.v16MapDetails.userData.rocks.visible = quality !== "low";
      this.v16MapDetails.userData.flowers.visible = premium;
      return previousEnvironmentUpdate.call(this, dt, focus, day, quality);
    };
  }
})(window);
