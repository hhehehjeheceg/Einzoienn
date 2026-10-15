/* ============================================================================
 * AZUR Horizons — THE END · Éclairs du Point Zéro (v48)
 * -----------------------------------------------------------------------------
 * Tant que l'orbe existe, de vrais éclairs ramifiés jaillissent de sa surface
 * et frappent le sol autour (impact lumineux + étincelles + fumée). Leur
 * fréquence suit la tension de l'événement : rares pendant le compte à
 * rebours, presque continus quand la météorite descend. Tout s'arrête à
 * l'impact (l'orbe est détruite).
 * ========================================================================== */
(function (root) {
  'use strict';

  var E = root.AZEvent, T = root.THREE;
  if (!E || !T) return;

  var LEVELS = 5, POINTS = (1 << LEVELS) + 1;
  var INTENSITY = {
    countdown: 0.3, firstrocket: 0.35, sixrockets: 0.4, convergence: 0.45, loop: 0.45, acceleration: 0.5,
    silence: 0.12, strike: 0.85, thrown: 0.8, greatrift: 0.9, meteorsix: 0.9, descent: 1, veeroff: 1
  };

  var api = null, low = false, group = null, resources = [], bolts = [], glowTex = null, light = null;
  var spawnTimer = 0, clock = 0, lightLevel = 0;
  var toCam = new T.Vector3(), seg = new T.Vector3(), side = new T.Vector3(), pt = new T.Vector3();

  function keep(r) { resources.push(r); return r; }
  function groundAt(x, z) {
    try { if (root.AZSim && root.AZSim.heightAt) return Math.max(-1.6, root.AZSim.heightAt(x, z)); } catch (e) {}
    return 0;
  }
  function glowTexture() {
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return keep(new T.CanvasTexture(cv));
  }

  function makeBolt() {
    var positions = new Float32Array(POINTS * 6), across = new Float32Array(POINTS * 2), along = new Float32Array(POINTS * 2), index = [];
    for (var i = 0; i < POINTS; i++) {
      across[i * 2] = -1; across[i * 2 + 1] = 1; along[i * 2] = along[i * 2 + 1] = i / (POINTS - 1);
      if (i < POINTS - 1) { var a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var geo = keep(new T.BufferGeometry());
    geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aAcross', new T.BufferAttribute(across, 1));
    geo.setAttribute('aAlong', new T.BufferAttribute(along, 1));
    geo.setIndex(index);
    var mat = keep(new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { uAlpha: { value: 0 }, uHead: { value: 1 } },
      vertexShader: 'attribute float aAcross;attribute float aAlong;varying float vAcross;varying float vAlong;' +
        'void main(){vAcross=aAcross;vAlong=aAlong;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float uAlpha;uniform float uHead;varying float vAcross;varying float vAlong;' +
        'void main(){float edge=1.-abs(vAcross);float core=pow(edge,6.);float glow=pow(edge,1.6);' +
        'float reach=1.-smoothstep(uHead-.04,uHead,vAlong);' +
        'vec3 c=mix(vec3(.32,.66,1.),vec3(.94,.98,1.),core);float a=(core*.95+glow*.45)*uAlpha*reach;gl_FragColor=vec4(c,clamp(a,0.,1.));}'
    }));
    var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 30; group.add(mesh);
    var spark = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color: 0xbfe6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    spark.renderOrder = 31; group.add(spark);
    return { mesh: mesh, mat: mat, geo: geo, positions: positions, pts: new Float32Array(POINTS * 3), age: 0, life: 0, width: 1, alive: false, spark: spark, branch: false };
  }

  /* Déplacement du point médian : un vrai tracé fractal d'éclair. */
  function trace(b, sx, sy, sz, ex, ey, ez, rough) {
    var p = b.pts, step = POINTS - 1;
    p[0] = sx; p[1] = sy; p[2] = sz; p[step * 3] = ex; p[step * 3 + 1] = ey; p[step * 3 + 2] = ez;
    var len = Math.hypot(ex - sx, ey - sy, ez - sz), amp = len * rough;
    for (var level = 0; level < LEVELS; level++) {
      var half = step >> 1;
      for (var i = half; i < POINTS - 1; i += step) {
        var a = (i - half) * 3, c = (i + half) * 3, m = i * 3;
        p[m] = (p[a] + p[c]) * 0.5 + (Math.random() - 0.5) * amp;
        p[m + 1] = (p[a + 1] + p[c + 1]) * 0.5 + (Math.random() - 0.5) * amp * 0.6;
        p[m + 2] = (p[a + 2] + p[c + 2]) * 0.5 + (Math.random() - 0.5) * amp;
      }
      amp *= 0.52; step = half;
    }
  }

  function freeBolt() {
    for (var i = 0; i < bolts.length; i++) if (!bolts[i].alive) return bolts[i];
    return null;
  }
  function strike(zp, R, power) {
    var b = freeBolt(); if (!b) return;
    var a = Math.random() * Math.PI * 2, reach = R * (1.9 + Math.random() * 4.2);
    var ex = zp.x + Math.cos(a) * reach, ez = zp.z + Math.sin(a) * reach, ey = groundAt(ex, ez) + 0.5;
    var el = -0.25 - Math.random() * 0.55, sx = zp.x + Math.cos(a) * Math.cos(el) * R * 0.96, sz = zp.z + Math.sin(a) * Math.cos(el) * R * 0.96, sy = zp.y + Math.sin(el) * R * 0.96;
    trace(b, sx, sy, sz, ex, ey, ez, 0.22);
    b.alive = true; b.age = 0; b.life = 0.16 + Math.random() * 0.2; b.width = (low ? 1.3 : 1.1) * (0.8 + power * 0.9); b.branch = false;
    b.mesh.visible = true; b.spark.position.set(ex, ey + 2, ez);
    var F = E.fx;
    if (F) {
      F.sparkle({ x: ex, y: ey + 1, z: ez }, { color: 0xcfeeff, count: low ? 6 : 12, spread: 8, size: 4 });
      if (Math.random() < 0.5) F.sparkJet({ x: ex, y: ey + 1, z: ez }, { color: 0x9fe0ff, count: low ? 6 : 12, speed: 40, life: 0.5, size: 3 });
      if (Math.random() < 0.3) F.smoke({ x: ex, y: ey + 2, z: ez }, { count: 3, size: 12, life: 2, alpha: 0.3, color: 0x5d6b78 });
    }
    light.position.set(ex, ey + 8, ez); lightLevel = Math.max(lightLevel, 1);
    if (Math.random() < 0.55) {
      var br = freeBolt();
      if (br) {
        var k = 3 + ((Math.random() * (POINTS - 8)) | 0), p = b.pts, bx = p[k * 3], by = p[k * 3 + 1], bz = p[k * 3 + 2];
        var ba = a + (Math.random() - 0.5) * 1.6, bl = reach * (0.25 + Math.random() * 0.3);
        var bex = bx + Math.cos(ba) * bl, bez = bz + Math.sin(ba) * bl, bey = Math.max(groundAt(bex, bez) + 1, by - bl * (0.4 + Math.random() * 0.6));
        trace(br, bx, by, bz, bex, bey, bez, 0.26);
        br.alive = true; br.age = 0; br.life = b.life * 0.8; br.width = b.width * 0.45; br.branch = true; br.mesh.visible = true;
      }
    }
    E.emit('zeropoint:arc', { x: ex, y: ey, z: ez, power: power });
  }

  function layout(b, cam, flicker) {
    var p = b.pts, out = b.positions;
    for (var i = 0; i < POINTS; i++) {
      var n = i * 3, q = (i < POINTS - 1 ? i + 1 : i - 1) * 3;
      pt.set(p[n], p[n + 1], p[n + 2]);
      seg.set(p[q] - pt.x, p[q + 1] - pt.y, p[q + 2] - pt.z);
      toCam.subVectors(cam.position, pt);
      side.crossVectors(seg, toCam);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      var dist = toCam.length(), taper = 1 - (i / (POINTS - 1)) * 0.55;
      side.normalize().multiplyScalar(b.width * taper * flicker * Math.max(1, dist / 260));
      out[i * 6] = pt.x + side.x; out[i * 6 + 1] = pt.y + side.y; out[i * 6 + 2] = pt.z + side.z;
      out[i * 6 + 3] = pt.x - side.x; out[i * 6 + 4] = pt.y - side.y; out[i * 6 + 5] = pt.z - side.z;
    }
    b.geo.attributes.position.needsUpdate = true;
  }

  function build() {
    group = new T.Group(); group.name = 'v48-zero-arcs'; api.scene().add(group);
    glowTex = glowTexture();
    for (var i = 0; i < (low ? 6 : 10); i++) bolts.push(makeBolt());
    light = new T.PointLight(0x9fd8ff, 0, 220, 2); group.add(light);
  }
  function teardown() {
    if (group && group.parent) group.parent.remove(group);
    resources.forEach(function (r) { if (r && r.dispose) r.dispose(); });
    resources = []; bolts = []; group = null; light = null; glowTex = null;
  }

  E.register('zparcs', {
    init: function (a) {
      api = a; low = !!(a.isMobile || a.quality === 'low'); teardown(); build();
      spawnTimer = 0.5; clock = 0; lightLevel = 0;
    },
    update: function (dt) {
      if (!api || !group) return;
      clock += dt;
      var zp = E.zeroPointPos, power = INTENSITY[E.state] || 0, cam = api.camera();
      if (zp && power > 0 && dt > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          strike(zp, E.zeroPointVisR || 26, power);
          var gap = 1.6 - power * 1.35;
          spawnTimer = gap * (0.45 + Math.random() * 1.1) * (low ? 1.35 : 1);
        }
      }
      for (var i = 0; i < bolts.length; i++) {
        var b = bolts[i]; if (!b.alive) continue;
        b.age += dt;
        var k = b.age / b.life;
        if (k >= 1 || power === 0) { b.alive = false; b.mesh.visible = false; b.spark.material.opacity = 0; continue; }
        var head = Math.min(1, b.age / 0.05), flicker = 0.75 + Math.random() * 0.5;
        b.mat.uniforms.uHead.value = head; b.mat.uniforms.uAlpha.value = (1 - k * k) * (0.7 + Math.random() * 0.3);
        if (!b.branch) { b.spark.material.opacity = head >= 1 ? (1 - k) * 0.95 : 0; b.spark.scale.setScalar(26 + Math.random() * 14); }
        if (cam) layout(b, cam, flicker);
        if (Math.random() < dt * 12) { trace(b, b.pts[0], b.pts[1], b.pts[2], b.pts[(POINTS - 1) * 3], b.pts[(POINTS - 1) * 3 + 1], b.pts[(POINTS - 1) * 3 + 2], b.branch ? 0.26 : 0.22); }
      }
      lightLevel *= Math.exp(-dt * 9); light.intensity = lightLevel * 5;
    },
    dispose: function () { teardown(); api = null; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
