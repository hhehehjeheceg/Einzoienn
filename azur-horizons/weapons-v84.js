/* AZUR v84 — butin au sol plus lisible, comme dans un vrai battle royale.
 * Chaque arme posée au sol reçoit un faisceau de lumière de sa couleur de
 * rareté (plus haut et plus vif pour les armes rares, épiques, légendaires),
 * une flaque de lumière au sol et quelques étincelles qui montent.
 * Purement visuel : la simulation et le ramassage ne changent pas. */
(function (root) {
  'use strict';
  var T = root.THREE, V = root.AZView && root.AZView.View && root.AZView.View.prototype, S = root.AZSim;
  if (!T || !V || typeof V.update !== 'function') return;
  var RAR = (S && S.rarities) || [{ color: '#aab8c8' }, { color: '#58c983' }, { color: '#3f9cff' }, { color: '#a56bff' }, { color: '#ffad31' }];
  var HEIGHT = [1.3, 1.8, 2.5, 3.3, 4.6], POWER = [.32, .42, .55, .68, .85];
  var tmpC = new T.Color(), shared = null;

  function rarityOf(hex) {
    var best = 0, d = 9;
    for (var i = 0; i < RAR.length; i++) { tmpC.set(RAR[i].color); var e = Math.abs(tmpC.r - hex.r) + Math.abs(tmpC.g - hex.g) + Math.abs(tmpC.b - hex.b); if (e < d) { d = e; best = i; } }
    return best;
  }
  function assets() {
    if (shared) return shared;
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    var beamGeo = new T.CylinderGeometry(.12, .3, 1, 14, 1, true); beamGeo.translate(0, .5, 0);
    var sparkGeo = new T.BufferGeometry(), n = 10, pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (var i = 0; i < n; i++) { var a = i * 2.39996; pos[i * 3] = Math.cos(a) * (.08 + (i % 3) * .07); pos[i * 3 + 2] = Math.sin(a) * (.08 + (i % 3) * .07); ph[i] = (i * .618) % 1; }
    sparkGeo.setAttribute('position', new T.BufferAttribute(pos, 3)); sparkGeo.setAttribute('ph', new T.BufferAttribute(ph, 1));
    shared = { tex: tex, beamGeo: beamGeo, sparkGeo: sparkGeo, poolGeo: new T.PlaneGeometry(1, 1) };
    return shared;
  }
  function beamMaterial(col, power) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { col: { value: new T.Color(col) }, time: { value: 0 }, power: { value: power } },
      vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 col;uniform float time,power;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float y=vUv.y;float fade=(1.-smoothstep(.0,1.,y))*smoothstep(.0,.06,y);float rim=pow(1.-abs(dot(vN,vV)),1.6);float flow=.75+.25*sin(y*14.-time*3.);float a=fade*(.35+.65*(1.-rim))*flow*power;gl_FragColor=vec4(mix(col,vec3(1.),.12*(1.-y))*a,a);}'
    });
  }
  function sparkMaterial(col, size) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { col: { value: new T.Color(col) }, time: { value: 0 }, hgt: { value: 1 }, size: { value: size }, map: { value: assets().tex } },
      vertexShader: 'attribute float ph;uniform float time,hgt,size;varying float vA;void main(){float k=fract(ph+time*.35);vec3 p=position*(1.+k*.8);p.y=k*hgt;vA=sin(k*3.1416);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=size*vA*(240./max(1.,-mv.z));}',
      fragmentShader: 'uniform vec3 col;uniform sampler2D map;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(mix(col,vec3(1.),.45)*t.a*vA,t.a*vA);}'
    });
  }
  function decorate(m) {
    var weaponMesh = m.children[0], ring = m.children[1];
    m.userData.v84 = true;
    if (!ring || !ring.material || !ring.material.color) return;
    var isWeapon = !!(weaponMesh && weaponMesh.userData && weaponMesh.userData.weapon);
    var r = rarityOf(ring.material.color), col = '#' + ring.material.color.getHexString(), X = assets();
    var hgt = isWeapon ? HEIGHT[r] : .9, pw = isWeapon ? POWER[r] : .25;
    var beam = new T.Mesh(X.beamGeo, beamMaterial(col, pw)); beam.position.y = ring.position.y; beam.scale.set(1, hgt, 1); beam.renderOrder = 3; beam.frustumCulled = false;
    var pool = new T.Mesh(X.poolGeo, new T.MeshBasicMaterial({ map: X.tex, color: col, transparent: true, opacity: .55 * pw + .15, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = ring.position.y - .01; pool.scale.setScalar(1.25 + r * .12);
    var sparks = new T.Points(X.sparkGeo, sparkMaterial(col, isWeapon ? 3 + r * .6 : 2.4)); sparks.position.y = ring.position.y; sparks.material.uniforms.hgt.value = hgt * .7; sparks.frustumCulled = false;
    m.add(beam, pool, sparks);
    m.userData.v84 = { beam: beam, pool: pool, sparks: sparks, ring: ring, phase: Math.random() * 6, rare: r };
    ring.material.opacity = .85;
  }
  // la position x du butin (sert au flottement d'origine : sin(time*2 + l.x))
  function lootX(view, m) { return m.position.x; }
  var base = V.update;
  V.update = function (w, p, dt, opts) {
    var out = base.apply(this, arguments);
    try {
      if (!this.loot || !this.loot.size || (opts && opts.menu)) return out;
      var t = (this._v84T = (this._v84T || 0) + (dt || 0));
      var vt = this.time;
      this.loot.forEach(function (m) {
        if (!m || !m.visible) return;
        if (!m.userData.v84) { decorate(m); m.userData.v84x = lootX(this, m); }
        var u = m.userData.v84; if (!u || u === true) return;
        var pulse = .85 + .15 * Math.sin(t * 2.4 + u.phase);
        u.beam.material.uniforms.time.value = t + u.phase; u.beam.material.uniforms.power.value = (u.rare >= 0 ? POWER[u.rare] : .3) * pulse;
        u.sparks.material.uniforms.time.value = t + u.phase;
        u.ring.rotation.z = t * .8; u.ring.scale.setScalar(1 + .06 * Math.sin(t * 3 + u.phase));
        // le groupe flotte (bobbing) : le faisceau et la flaque restent posés au sol
        var bob = Math.sin((vt || 0) * 2 + m.userData.v84x) * .1; u.beam.position.y = u.ring.position.y - bob; u.pool.position.y = u.ring.position.y - .01 - bob; u.sparks.position.y = u.beam.position.y;
      });
    } catch (e) { if (!this._v84err) { this._v84err = 1; console.error('[AZUR loot84]', e); } }
    return out;
  };
})(window);
