/* AZUR v67 — construction et modification façon Fortnite.
 *  - FANTÔME HOLOGRAPHIQUE : la pièce à poser est un hologramme bleu (grille
 *    lumineuse, balayage, reflets), rouge quand la pose est impossible ;
 *  - ASSEMBLAGE : chaque pièce posée est balayée de bas en haut par une onde
 *    d'énergie, et une barre de solidité flotte au-dessus des pièces qu'on
 *    vient de poser ou qui prennent des dégâts ;
 *  - ÉDITION DIRECTE SUR LA PIÈCE : « Modifier » affiche les carreaux sur la
 *    pièce elle-même. Souris : viser un carreau, cliquer-glisser pour
 *    retirer/remettre, relâcher pour valider, clic droit pour tout rétablir.
 *    Tactile : toucher ou glisser sur les carreaux, puis « Modifier » valide.
 *  - Avec l'option « édition simple », l'ancienne fenêtre reste utilisée.
 * Les règles de forme valides (AZBuildRules) et l'envoi au serveur sont ceux
 * du jeu : seule la façon de faire change. */
(function (root) {
  'use strict';
  const H = root.AZURHorizons, R = root.AZBuildRules, T = root.THREE, V = root.AZView?.View?.prototype;
  if (!H || !R || !T || !V) return;
  const P = H.prototype, CELL = 4 / 3;

  /* ------------------------------------------------------------ fantôme */
  const holoMaterial = () => new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { time: { value: 0 }, tint: { value: new T.Color('#4fc3ff') } },
    vertexShader: 'varying vec3 vP;varying vec3 vN;varying vec3 vV;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying vec3 vP;varying vec3 vN;varying vec3 vV;uniform float time;uniform vec3 tint;' +
      'float line(float v){float d=abs(fract(v)-.5);return 1.-smoothstep(.45,.5,d);}' +
      'void main(){float fres=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);' +
      'vec3 g=vP/1.3333;float grid=max(max(line(g.x),line(g.y)),line(g.z));' +
      'float scan=exp(-abs(fract(vP.y*.25-time*.6)-.5)*18.);' +
      'float a=.16+fres*.35+grid*.45+scan*.25;vec3 c=mix(tint,vec3(1.),grid*.55+scan*.4);gl_FragColor=vec4(c,clamp(a,0.,.9));}'
  });
  const previousUpdate = V.update;
  V.update = function (w, p, dt, opts = {}) {
    const r = previousUpdate.call(this, w, p, dt, opts);
    const ghost = this.ghost;
    if (ghost && ghost.visible) {
      if (!ghost.userData.v66) {
        const holo = new T.Mesh(ghost.geometry, holoMaterial()); holo.renderOrder = 6; holo.userData.shared = false;
        ghost.add(holo); ghost.material.visible = false;
        if (ghost.userData.previewGrid) ghost.userData.previewGrid.visible = false;
        ghost.userData.v66 = holo;
      }
      const holo = ghost.userData.v66, valid = ghost.material.color.getHexString() !== 'ff7673';
      holo.material.uniforms.time.value = this.time || 0;
      holo.material.uniforms.tint.value.set(valid ? '#4fc3ff' : '#ff4d5a');
      const pop = ghost.userData.v66Pop || 0; ghost.userData.v66Pop = Math.max(0, pop - dt * 6);
      ghost.scale.setScalar(1 + Math.sin(ghost.userData.v66Pop * Math.PI) * .05);
    }
    if (this.v66Edit) updateEditVisual(this, this.v66Edit);
    if (w?.builds && p) { buildSweeps(this, w, dt); buildBars(this, w, p); }
    return r;
  };

  /* ------------------------------------------------------------ assemblage */
  const sweepMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { prog: { value: 0 }, tint: { value: new T.Color('#5fd4ff') } },
    vertexShader: 'varying float vY;void main(){vY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float prog;uniform vec3 tint;varying float vY;void main(){float h=prog*4.6-.3;float band=exp(-abs(vY-h)*5.);float above=step(h,vY)*.22*(1.-prog);' +
      'gl_FragColor=vec4(mix(tint,vec3(1.),band*.6),(band*.9+above)*(1.-smoothstep(.85,1.,prog)));}'
  });
  function buildSweeps(view, w, dt) {
    const seen = view.v67Seen || (view.v67Seen = new Set()), now = view.time || 0;
    for (const b of w.builds) {
      if (b.dead || seen.has(b.id)) continue;
      const m = view.builds.get(b.id); if (!m) continue;
      seen.add(b.id);
      if (now - (m.userData.birth || 0) > .3 || view.quality === 'low') continue;
      m.traverse((o) => {
        if (!o.isMesh || o.userData.v67Sweep || !o.geometry) return;
        const mat = sweepMat.clone(); const fx = new T.Mesh(o.geometry, mat); fx.renderOrder = 7; fx.userData.v67Sweep = true; fx.userData.shared = false;
        o.add(fx); (view.v67Sweeps || (view.v67Sweeps = [])).push({ fx, t: 0 });
      });
    }
    const list = view.v67Sweeps; if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]; s.t += dt / .7;
      if (s.t >= 1 || !s.fx.parent) { s.fx.parent?.remove(s.fx); s.fx.material.dispose(); list.splice(i, 1); continue; }
      s.fx.material.uniforms.prog.value = s.t;
    }
  }
  /* ------------------------------------------------------------ barres de solidité */
  const projV = new T.Vector3();
  function buildBars(view, w, p) {
    const hud = document.querySelector('#ui .hud'); if (!hud || !view.camera) return;
    const box = view.v67Bars && hud.contains(view.v67Bars.box) ? view.v67Bars : (view.v67Bars = { box: Object.assign(document.createElement('div'), { className: 'v67-build-bars' }), els: [], hp: new Map(), shown: new Map() });
    if (!box.box.parentNode) hud.appendChild(box.box);
    const now = view.time || 0, list = [];
    for (const b of w.builds) {
      if (b.dead) { box.hp.delete(b.id); continue; }
      const d2 = (b.x - p.x) ** 2 + (b.z - p.z) ** 2; if (d2 > 196) continue;
      const prev = box.hp.get(b.id); box.hp.set(b.id, b.hp);
      const m = view.builds.get(b.id), born = m ? now - (m.userData.birth || -9) : 9;
      if ((prev !== undefined && b.hp < prev - .01) || (born < 1.2 && b.owner === p.id && m?.userData.v67Fresh !== false)) box.shown.set(b.id, now);
      const seenAt = box.shown.get(b.id); if (seenAt !== undefined && now - seenAt < 2.4) list.push({ b, d2, age: now - seenAt, born });
    }
    list.sort((a, c) => a.d2 - c.d2); list.length = Math.min(list.length, 3);
    while (box.els.length < list.length) { const el = document.createElement('div'); el.className = 'v67-build-bar'; el.innerHTML = '<i></i><b></b>'; box.box.appendChild(el); box.els.push(el); }
    const W = view.renderer.domElement.clientWidth, H = view.renderer.domElement.clientHeight;
    box.els.forEach((el, i) => {
      const it = list[i]; if (!it) { el.style.display = 'none'; return; }
      const b = it.b, top = b.type === 'floor' ? .7 : 4.3;
      projV.set(b.x, b.y + top, b.z).project(view.camera);
      if (projV.z > 1) { el.style.display = 'none'; return; }
      const fill = it.born < 1.2 ? Math.min(1, it.born / 1.2) * (b.hp / Math.max(1, b.maxHp)) : b.hp / Math.max(1, b.maxHp);
      el.style.display = ''; el.style.transform = `translate(${((projV.x * .5 + .5) * W).toFixed(0)}px,${((-projV.y * .5 + .5) * H).toFixed(0)}px)`;
      el.style.opacity = String(Math.min(1, (2.4 - it.age) * 2));
      el.dataset.mat = b.material || 'wood';
      el.firstChild.style.width = (fill * 100).toFixed(1) + '%';
      el.lastChild.textContent = Math.ceil(it.born < 1.2 ? fill * b.maxHp : b.hp) + ' / ' + Math.ceil(b.maxHp);
    });
  }

  /* ------------------------------------------------------------ édition */
  function layout(type) {
    const tiles = [];
    if (type === 'wall') for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tiles.push({ i: r * 3 + c, x: (c - 1) * CELL, y: (2.5 - r) * CELL, z: 0, rx: 0, w: CELL * .94, h: CELL * .94 });
    else if (type === 'ramp') for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const z = (r - 1) * CELL; tiles.push({ i: r * 3 + c, x: (c - 1) * CELL, y: 2 - z + .08, z, rx: -Math.PI / 4, w: CELL * .94, h: CELL * Math.SQRT2 * .94 }); }
    else for (let k = 0; k < 4; k++) { const row = k >> 1, col = k & 1; tiles.push({ i: k, x: col * 2 - 1, y: type === 'roof' ? 1.08 : .14, z: row * 2 - 1, rx: -Math.PI / 2, w: 1.9, h: 1.9 }); }
    return tiles;
  }
  function solid(game, i) {
    return !!(game.editMask & (1 << i));
  }
  function buildEditOverlay(game, b) {
    const view = game.view, host = view.builds.get(b.id);
    if (!host) return null;
    const group = new T.Group(); group.name = 'v66-edit-tiles'; host.add(group);
    const geo = new T.PlaneGeometry(1, 1), edgeGeo = new T.EdgesGeometry(geo), tiles = [];
    for (const t of layout(b.type)) {
      const mat = new T.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: .3, side: T.DoubleSide, depthWrite: false, depthTest: false });
      const mesh = new T.Mesh(geo, mat); mesh.position.set(t.x, t.y, t.z); mesh.rotation.x = t.rx; mesh.scale.set(t.w, t.h, 1); mesh.renderOrder = 8; mesh.userData.tile = t.i;
      const edge = new T.LineSegments(edgeGeo, new T.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthTest: false })); edge.renderOrder = 9; mesh.add(edge);
      group.add(mesh); tiles.push({ mesh, mat, edge, i: t.i });
    }
    return { group, tiles, geo, edgeGeo, hover: -1, painting: false, paintSolid: false, painted: new Set(), ray: new T.Raycaster(), center: new T.Vector2(0, 0), type: b.type };
  }
  function disposeOverlay(view) {
    const e = view.v66Edit; if (!e) return;
    e.group.parent?.remove(e.group);
    e.tiles.forEach((t) => { t.mat.dispose(); t.edge.material.dispose(); });
    e.geo.dispose(); e.edgeGeo.dispose(); view.v66Edit = null;
  }
  function updateEditVisual(view, e) {
    const game = root.AZUR; if (!game || !game.editing) { disposeOverlay(view); return; }
    if (!touchLike()) {
      e.ray.setFromCamera(e.center, view.camera);
      const hits = e.ray.intersectObjects(e.tiles.map((t) => t.mesh), false);
      e.hover = hits.length ? hits[0].object.userData.tile : -1;
    } else if (e.touchId === undefined) e.hover = -1;
    if (e.painting && e.hover >= 0 && !touchLike()) paint(game, e, e.hover);
    const valid = R.valid(game.editTargetType, root.AZConstruction ? root.AZConstruction.currentMask(game) : game.editMask), t = view.time || 0;
    for (const tile of e.tiles) {
      const on = e.type === 'ramp' ? solid(game, tile.i % 3) : solid(game, tile.i), hot = tile.i === e.hover || (e.type === 'ramp' && e.hover >= 0 && e.hover % 3 === tile.i % 3);
      tile.mat.color.set(!valid ? '#ff9a3c' : on ? '#4fc3ff' : '#ffffff');
      tile.mat.opacity = (on ? .32 : .07) + (hot ? .28 + Math.sin(t * 10) * .05 : 0);
      tile.edge.material.color.set(on ? '#ffffff' : '#ff6b6b'); tile.edge.material.opacity = hot ? 1 : .75;
    }
  }
  function paint(game, e, i) {
    if (e.painted.has(e.type === 'ramp' ? i % 3 : i)) return;
    e.painted.add(e.type === 'ramp' ? i % 3 : i);
    if (e.type === 'ramp') { const bits = 73 << (i % 3); game.editMask = e.paintSolid ? game.editMask | bits : game.editMask & ~bits; }
    else game.editMask = e.paintSolid ? game.editMask | (1 << i) : game.editMask & ~(1 << i);
    game.paintEdit?.();
    game.audio?.start?.(); game.audio?.tone?.(e.paintSolid ? 660 : 520, .04, 'triangle', .05, e.paintSolid ? 900 : 380);
  }
  const touchLike = () => document.body.classList.contains('touch-ui') || (root.matchMedia && root.matchMedia('(pointer: coarse)').matches);

  const previousOpen = P.openEdit;
  P.openEdit = function () {
    if (this.profile?.settings?.simpleEdit) return previousOpen.call(this);
    if (this.screen !== 'game' || this.modal || this.editing || this.paused || root.AZEvent?.active) return;
    const b = this.nearBuild(); if (!b) { this.toast('Vise une de tes pièces ou une pièce alliée à moins de 8 m.'); return; }
    if (!this.view?.builds?.get(b.id)) return previousOpen.call(this);
    this._buildBeforeEdit = this.buildType; this.editing = true; this.editTarget = b.id; this.editTargetType = b.type;
    this.editOriginalMask = b.editMask ?? 511; this.editMask = ['floor', 'roof'].includes(b.type) ? R.compress(this.editOriginalMask) : this.editOriginalMask;
    this.fire = false; this.buildType = null;
    const p = this.player(); if (p) p.editing = true;
    this.send({ fire: false });
    document.body.classList.add('world-editing', 'v67-editing');
    this.updateBuildBar?.();
    disposeOverlay(this.view);
    this.view.v66Edit = buildEditOverlay(this, b);
    this.paintEdit?.();
    this.audio?.start?.(); this.audio?.tone?.(440, .07, 'triangle', .07, 880);
  };
  const previousClose = P.closeWorldEdit;
  P.closeWorldEdit = function (applied = false) {
    if (this.view) disposeOverlay(this.view);
    document.body.classList.remove('v67-editing');
    return previousClose.call(this, applied);
  };
  // La fenêtre de l'ancien éditeur ne s'ouvre pas pendant l'édition directe.
  const previousPaint = P.paintEdit;
  P.paintEdit = function () {
    const r = previousPaint?.call(this);
    if (this.view?.v66Edit) { const panel = document.getElementById('world-edit'); if (panel) panel.hidden = true; }
    return r;
  };

  // Souris : clic-glisser pour peindre, relâcher pour valider, clic droit = rétablir.
  function editState() { const g = root.AZUR; return g && g.editing && g.view?.v66Edit ? g : null; }
  document.addEventListener('mousedown', (ev) => {
    const game = editState(); if (!game) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const e = game.view.v66Edit;
    if (ev.button === 2) { game.editMask = ['floor', 'roof'].includes(game.editTargetType) ? 15 : 511; game.paintEdit?.(); return; }
    if (ev.button !== 0 || e.hover < 0) return;
    e.painting = true; e.painted = new Set();
    e.paintSolid = e.type === 'ramp' ? !solid(game, e.hover % 3) : !solid(game, e.hover);
    paint(game, e, e.hover);
  }, true);
  document.addEventListener('mouseup', (ev) => {
    const game = editState(); if (!game) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const e = game.view.v66Edit; if (!e.painting) return;
    e.painting = false; lastRelease = performance.now();
    const mask = root.AZConstruction ? root.AZConstruction.currentMask(game) : game.editMask;
    if (game.profile?.settings?.confirmEditRelease !== false && R.valid(game.editTargetType, mask)) game.action('edit-confirm');
  }, true);
  document.addEventListener('contextmenu', (ev) => { if (editState()) ev.preventDefault(); }, true);
  // Tactile : toucher/glisser sur les carreaux ; « Modifier » valide.
  const touchNdc = new T.Vector2();
  function touchTile(game, touch) {
    const e = game.view.v66Edit, rect = game.view.renderer.domElement.getBoundingClientRect();
    touchNdc.set((touch.clientX - rect.left) / rect.width * 2 - 1, -((touch.clientY - rect.top) / rect.height) * 2 + 1);
    e.ray.setFromCamera(touchNdc, game.view.camera);
    const hits = e.ray.intersectObjects(e.tiles.map((t) => t.mesh), false);
    return hits.length ? hits[0].object.userData.tile : -1;
  }
  const onCanvas = (ev) => ev.target && ev.target.tagName === 'CANVAS';
  document.addEventListener('touchstart', (ev) => {
    const game = editState(); if (!game || !onCanvas(ev)) return;
    const e = game.view.v66Edit, i = touchTile(game, ev.changedTouches[0]); if (i < 0) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    e.touchId = ev.changedTouches[0].identifier; e.painted = new Set();
    e.paintSolid = e.type === 'ramp' ? !solid(game, i % 3) : !solid(game, i);
    e.hover = i; paint(game, e, i);
  }, { capture: true, passive: false });
  document.addEventListener('touchmove', (ev) => {
    const game = editState(); if (!game) return;
    const e = game.view.v66Edit; if (e.touchId === undefined) return;
    const touch = Array.from(ev.changedTouches).find((t) => t.identifier === e.touchId); if (!touch) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const i = touchTile(game, touch); if (i >= 0) { e.hover = i; paint(game, e, i); }
  }, { capture: true, passive: false });
  document.addEventListener('touchend', (ev) => {
    const game = editState(); if (!game) return;
    const e = game.view.v66Edit; if (e.touchId === undefined) return;
    if (Array.from(ev.changedTouches).some((t) => t.identifier === e.touchId)) { e.touchId = undefined; ev.stopImmediatePropagation(); }
  }, { capture: true });
  // Le clic qui suit le relâchement de l'édition ne doit pas tirer.
  let lastRelease = -1e9;
  document.addEventListener('click', (ev) => { if (performance.now() - lastRelease < 400) { ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);

  // Aide : décrit la nouvelle édition directe.
  const previousHelp = P.helpHTML;
  P.helpHTML = function () {
    return String(previousHelp.call(this)).replace('Glisse sur la grille, puis relâche pour valider.', 'Les carreaux apparaissent sur la pièce : vise-les, clique-glisse pour retirer ou remettre, relâche pour valider (ou appuie de nouveau sur <b>F</b>). Échap annule.');
  };

  // Petit rebond du fantôme à chaque pièce posée.
  const previousFire = P.fireOnce;
  P.fireOnce = function () {
    const before = this.world?.builds?.length || 0, r = previousFire.call(this);
    if (this.buildType && this.view?.ghost && (this.world?.builds?.length || 0) >= before) this.view.ghost.userData.v66Pop = 1;
    return r;
  };
})(window);
