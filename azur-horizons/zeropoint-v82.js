/* AZUR v82 — le Point Zéro en partie normale, refait.
 * Une orbe d'énergie posée au centre de l'île (même style que pendant The End) :
 * coque de verre aux volutes cyan et violettes, cœur étoilé, halo, éclairs qui
 * crépitent, colonne de lumière et anneau lumineux sur le sol. L'ancienne sphère
 * bleue est masquée. Pendant l'événement, c'est l'événement qui la dessine. */
(function (root) {
  'use strict';
  var T = root.THREE, V = root.AZView && root.AZView.View && root.AZView.View.prototype, L = root.AZEnd81;
  if (!T || !V || !V.update || !L || !L.domeMaterial) return;
  function canvasTex(n, fn) { var c = document.createElement('canvas'); c.width = c.height = n; fn(c.getContext('2d'), n); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
  var TX = null;
  function textures() {
    if (TX) return TX;
    var soft = canvasTex(128, function (g, n) { var r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.35, 'rgba(255,255,255,.35)'); r.addColorStop(.7, 'rgba(255,255,255,.08)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
    var star = canvasTex(256, function (g, n) {
      var h = n / 2, r = g.createRadialGradient(h, h, 0, h, h, h); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.06, 'rgba(235,250,255,.95)'); r.addColorStop(.2, 'rgba(150,215,255,.35)'); r.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, n, n); g.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 6; k++) { g.save(); g.translate(h, h); g.rotate(k * Math.PI / 6 + .2); var lg = g.createLinearGradient(-h, 0, h, 0); lg.addColorStop(0, 'rgba(160,220,255,0)'); lg.addColorStop(.5, 'rgba(235,250,255,' + (k % 2 ? .4 : .9) + ')'); lg.addColorStop(1, 'rgba(160,220,255,0)'); g.fillStyle = lg; g.fillRect(-h, -1.3, n, 2.6); g.restore(); }
    });
    var arcs = [0, 1, 2].map(function (seed) {
      return canvasTex(256, function (g, n) {
        var s = 7 + seed * 13; function R() { s = (s * 16807) % 2147483647; return s / 2147483647; }
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (var pass = 0; pass < 2; pass++) {
          g.shadowColor = 'rgba(120,200,255,1)'; g.shadowBlur = pass ? 3 : 10; g.strokeStyle = pass ? 'rgba(230,248,255,.95)' : 'rgba(90,170,255,.6)'; g.lineWidth = pass ? 1.4 : 4;
          for (var k = 0; k < 6; k++) { var x = 128 + (R() - .5) * 120, y = 128 + (R() - .5) * 120, a = R() * 6.28; g.beginPath(); g.moveTo(x, y); for (var j = 0; j < 8; j++) { a += (R() - .5) * 1.4; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); }
        }
      });
    });
    var ring = canvasTex(256, function (g, n) { var h = n / 2, r = g.createRadialGradient(h, h, h * .55, h, h, h); r.addColorStop(0, 'rgba(120,220,255,0)'); r.addColorStop(.45, 'rgba(140,230,255,.85)'); r.addColorStop(.6, 'rgba(180,140,255,.4)'); r.addColorStop(1, 'rgba(120,120,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
    TX = { soft: soft, star: star, arcs: arcs, ring: ring }; return TX;
  }
  function sprite(tex, color, size, op) {
    var m = new T.SpriteMaterial({ map: tex, color: color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: op, fog: false }); m.toneMapped = false;
    var s = new T.Sprite(m); s.scale.setScalar(size); return s;
  }
  function build(view) {
    var X = textures(), g = new T.Group(); g.name = 'azur-zero-point-v82';
    var h = 20; try { h = root.AZSim.heightAt(0, 0); } catch (e) {}
    g.position.set(0, h + 32, 0);
    var shell = new T.Mesh(new T.SphereGeometry(1, 48, 32), L.domeMaterial()); shell.scale.setScalar(24); shell.material.uniforms.cyan.value = .8; shell.renderOrder = 7;
    var inner = new T.Mesh(new T.SphereGeometry(1, 32, 20), L.domeMaterial()); inner.scale.setScalar(14); inner.material.uniforms.cyan.value = .25; inner.renderOrder = 7;
    var core = sprite(X.star, 0xf2fbff, 80, 1), halo = sprite(X.soft, 0x6fc8ff, 260, .6), arcs = [];
    for (var i = 0; i < 4; i++) { var a = sprite(X.arcs[i % 3], 0xcfeaff, 34, 0); arcs.push(a); g.add(a); }
    var beam = new T.Mesh(new T.CylinderGeometry(2.2, 6, 1, 16, 1, true), new T.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    beam.scale.set(1, 520, 1); beam.position.y = 260;
    var ringM = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: X.ring, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: .6, fog: false }));
    ringM.rotation.x = -Math.PI / 2; ringM.scale.setScalar(110); ringM.position.y = -31.4;
    var light = new T.PointLight(0x8fd8ff, 2.2, 160, 1.4);
    g.add(shell, inner, core, halo, beam, ringM, light);
    [core, halo].forEach(function (s) { s.frustumCulled = false; });
    g.userData = { shell: shell, inner: inner, core: core, halo: halo, arcs: arcs, beam: beam, ring: ringM, light: light };
    view.scene.add(g); return g;
  }
  function hideOld(scene) {
    scene.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.material && o.material.isMeshBasicMaterial && !o.userData.zp82Hidden) {
        var r = o.geometry.parameters && o.geometry.parameters.radius;
        if ((r === 18 || r === 28) && Math.abs(o.position.x) < 1 && Math.abs(o.position.z) < 1) { o.material.visible = false; o.userData.zp82Hidden = true; }
      }
    });
  }
  var base = V.update;
  V.update = function (w, p, dt, opts) {
    var out = base.apply(this, arguments);
    try {
      opts = opts || {};
      if (opts.menu || !this.scene) return out;
      if (!this._zp82) { this._zp82 = build(this); this._zp82Scan = 0; }
      if ((this._zp82Scan = (this._zp82Scan || 0) - 1) <= 0) { hideOld(this.scene); this._zp82Scan = 120; }
      var g = this._zp82, E = root.AZEvent, on = !(E && E.active) && !!w;
      g.visible = on; if (!on) return out;
      var t = (this._zp82T = (this._zp82T || 0) + (dt || 0)), u = g.userData, pul = 1 + .05 * Math.sin(t * 2.6) + .025 * Math.sin(t * 7.3);
      g.position.y += (((root.AZSim.heightAt(0, 0) || 20) + 32 + Math.sin(t * .9) * 1.5) - g.position.y) * .1;
      var su = u.shell.material.uniforms; su.time.value = t; su.amt.value = .95; su.flash.value = .12 + .1 * Math.sin(t * 3);
      var iu = u.inner.material.uniforms; iu.time.value = t * 1.6; iu.amt.value = .7;
      u.shell.scale.setScalar(24 * pul); u.shell.rotation.y = t * .3; u.inner.scale.setScalar(14 * pul); u.inner.rotation.y = -t * .5;
      u.core.material.opacity = .85 + .15 * Math.sin(t * 9); u.core.scale.setScalar(80 * pul); u.halo.scale.setScalar(260 * pul);
      var fl = Math.floor((t + 100) * 11);
      u.arcs.forEach(function (a, i) {
        var hs = Math.sin(fl * 12.9898 + i * 78.233) * 43758.5453; hs -= Math.floor(hs);
        a.material.map = textures().arcs[(fl + i) % 3]; a.material.rotation = hs * 6.28; a.material.opacity = hs > .45 ? .85 : 0; a.scale.setScalar(40 + 20 * hs);
      });
      u.beam.material.opacity = .16 + .05 * Math.sin(t * 1.3); u.ring.material.opacity = .45 + .15 * Math.sin(t * 2); u.ring.rotation.z = t * .2;
      u.light.intensity = 2 + .5 * Math.sin(t * 5);
    } catch (e) { if (!this._zp82Err) { this._zp82Err = 1; console.error('[AZUR zp82]', e); } }
    return out;
  };
})(window);
