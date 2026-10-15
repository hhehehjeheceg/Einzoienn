/* AZUR v83 — salon retouché.
 *  - Carte « ÉVÉNEMENT EN DIRECT · LA FIN » dans le salon : un clic choisit le
 *    mode événement, il ne reste qu'à appuyer sur JOUER.
 *  - La faille du ciel du salon reprend la vraie faille de l'événement
 *    (étoile, éclairs bleus et violets, voile bleu nuit).
 *  - Éclairage studio sur le personnage (lumière principale + contre-jour),
 *    pour qu'il ressorte bien sur le décor. */
(function (root) {
  'use strict';
  var T = root.THREE, H = root.AZURHorizons, V = root.AZView && root.AZView.View && root.AZView.View.prototype, L = root.AZEnd81;
  if (!T) return;

  /* ------------------------------------------------ carte de l'événement */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function eventCard(g) {
    var on = g.mode === 'event', ready = !!g.lobbyReady;
    var btn = on ? '<span class="v83-ev-picked">✓ CHOISI · APPUIE SUR JOUER</span>'
      : '<button type="button" class="v83-ev-btn" data-v83-event="1"' + (ready ? ' disabled' : '') + '>CHOISIR</button>';
    return '<aside class="v83-event-card' + (on ? ' is-on' : '') + '" aria-label="Événement en direct">' +
      '<div class="v83-ev-art" aria-hidden="true"><i class="v83-ev-glow"></i><i class="v83-ev-rift"></i><i class="v83-ev-met"></i><i class="v83-ev-orb"></i></div>' +
      '<div class="v83-ev-copy"><span class="v83-ev-live"><b></b>ÉVÉNEMENT EN DIRECT</span><strong>LA FIN</strong>' +
      '<small>' + esc('Fusées, failles, météorite et Point Zéro · sans dégâts · 5 min') + '</small>' + btn + '</div></aside>';
  }
  /* clic sur CHOISIR : même effet que choisir « Événement » dans la liste des modes */
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-v83-event]'); if (!b || b.disabled) return;
    var g = root.AZUR; if (!g || g.screen !== 'menu' || g.lobbyReady) return;
    e.preventDefault(); e.stopPropagation();
    try { g.mode = 'event'; if (g.profile) g.profile.preferredMode = 'event'; g.lobbyReady = false; clearInterval(g.prepTimer); if (g.queueSave) g.queueSave(); if (g.audio && g.audio.ui) g.audio.ui(); g.renderMenu(); } catch (er) { console.error('[AZUR lobby83]', er); }
  }, true);
  if (H && H.prototype && typeof H.prototype.lobbyHTML === 'function') {
    var P = H.prototype, prevLobby = P.lobbyHTML;
    P.lobbyHTML = function () {
      var html = prevLobby.apply(this, arguments);
      try { html += eventCard(this); } catch (e) {}
      return html;
    };
  }

  /* ------------------------------------------------ décor 3D du salon */
  if (!V || typeof V.drawMenu !== 'function') return;
  function upgrade(view) {
    var lob = view.v2Lobby; if (!lob || lob.v83 || !view.menuScene) return;
    lob.v83 = { rift: null, mats: [] };
    // éclairage studio sur le personnage
    var key = new T.SpotLight('#fff1dc', 9, 16, .42, .65, 1.4); key.position.set(2.6, 5.2, 5.4); key.target.position.set(0, 1.1, 0);
    var back = new T.DirectionalLight('#8fd8ff', 1.35); back.position.set(-3, 3.2, -4); back.target.position.set(0, 1.1, 0);
    var fill = new T.PointLight('#ff9fd0', 1.1, 9, 1.6); fill.position.set(-2.4, 1.6, 2.6);
    view.menuScene.add(key, key.target, back, back.target, fill); lob.v83.lights = [key, back, fill];
    // la faille du ciel = la vraie faille de l'événement
    if (L && L.riftMaterial) {
      try {
        lob.root.traverse(function (o) {
          if (o.isMesh && o.material && o.material.isShaderMaterial && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 26 && o.geometry.parameters.height === 26) o.visible = false;
        });
        var mk = function (pos, size, seed, narrow) {
          var m = new T.Mesh(new T.PlaneGeometry(1, 1), L.riftMaterial(seed, narrow)); m.position.copy(pos); m.scale.setScalar(size);
          m.material.uniforms.amt.value = 1; m.material.uniforms.open.value = 1; m.material.fog = false; m.renderOrder = 2; m.frustumCulled = false;
          lob.root.add(m); lob.v83.mats.push(m); return m;
        };
        lob.v83.rift = mk(new T.Vector3(17, 15, -56), 30, 3.7, false);
        mk(new T.Vector3(-30, 21, -70), 13, 8.1, true);
      } catch (e) { lob.v83.mats = []; }
    }
  }
  var prevDraw = V.drawMenu;
  V.drawMenu = function (world, player, dt, options) {
    var r = prevDraw.apply(this, arguments);
    try {
      upgrade(this);
      var lob = this.v2Lobby, t = this.time || 0;
      if (lob && lob.v83) {
        var cam = this.menuCamera;
        lob.v83.mats.forEach(function (m, i) {
          var u = m.material.uniforms; u.time.value = t + i * 13; u.amt.value = .85 + .15 * Math.sin(t * 1.7 + i);
          u.flash.value = Math.max(0, Math.sin(t * .45 + i * 2.1) - .93) * 8;
          if (cam) m.quaternion.copy(cam.quaternion);
        });
      }
    } catch (e) { if (!this._v83err) { this._v83err = 1; console.error('[AZUR lobby83]', e); } }
    return r;
  };
})(window);
