/* AZUR v75 — THE END, version « film ».
 * L'événement est rejoué comme un film calé à la seconde près sur la vidéo de
 * référence (5 min 03). Le temps de l'événement = le temps de la vidéo.
 * Ce module pose le joueur sur une colline de nuit face à la base de
 * lancement, pilote une caméra cinéma par images clés et anime tous les
 * éléments du ciel de façon déterministe (fonction du temps : on peut
 * rejoindre l'événement en cours de route, tout est à sa place).
 * Partie 1 : 0 → 90 s (décollage, faille, explosion de foudre, aurores,
 * fusée dans les failles, météorite, anneau arc-en-ciel). */
(function (root) {
  'use strict';
  var E = root.AZEvent, T = root.THREE;
  if (!E || !T || !E.register) return;
  var D2R = Math.PI / 180;
  /* v78 : mode JOUABLE — le film de la v75 (même temps que la vidéo) tourne autour du joueur
     libre (bus, déplacements, caméra du joueur). Les failles sont les ANCIENNES failles
     (shader d'event-coherence) et la météorite est la vraie météorite solide de l'événement. */
  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  var PLAY = false, camFwd = new T.Vector3(0, 0, -1), RIFTS = [];
  var voidOn = false, voidHidden = [], hidden = [], api = null, G = null, grp = null, on = false, prevTOD = null, renderer = null, innerRender = null;
  var P = new T.Vector3(), F = new T.Vector3(), R = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
  var BASE = new T.Vector3(), O = {}, camPos = new T.Vector3();
  var tmp = new T.Vector3(), tmp2 = new T.Vector3();
  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(x) { x = cl(x); return x * x * (3 - 2 * x); }
  function ramp(t, a, b) { return sm((t - a) / (b - a)); }
  function win(t, a, b, fi, fo) { return ramp(t, a, a + (fi || .5)) * (1 - ramp(t, b - (fo || .5), b)); }
  function L(a, b, k) { return a + (b - a) * k; }
  function hsh(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* ---------------------------------------------------------------- repère de la scène */
  // Joueur sur une prairie en hauteur (Forêt d'Opale), base de lancement devant lui,
  // le volcan derrière la base, exactement comme la composition de la vidéo.
  var SPOT = {px: -515, pz: -135, bx: -540, bz: -255};
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 20; } }
  function dirYP(yaw, pitch, out) {
    yaw *= D2R; pitch *= D2R; var h = Math.cos(pitch);
    return (out || new T.Vector3()).copy(F).multiplyScalar(Math.cos(yaw) * h).addScaledVector(R, Math.sin(yaw) * h).addScaledVector(UP, Math.sin(pitch));
  }
  function skyPos(yaw, pitch, dist, out) { return dirYP(yaw, pitch, out).multiplyScalar(dist).add(P).add(tmp2.set(0, 1.7, 0)); }

  /* ---------------------------------------------------------------- textures procédurales */
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); draw(g, w, h);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var TEX = {};
  function texGlow() {
    return canvasTex(128, 128, function (g) {
      var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,255,255,.65)'); r.addColorStop(.45, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    });
  }
  function texStar() {
    return canvasTex(256, 256, function (g) {
      var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.08, 'rgba(220,245,255,.9)'); r.addColorStop(.3, 'rgba(120,200,255,.25)'); r.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      g.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 4; k++) {
        var a = k * Math.PI / 4; g.save(); g.translate(128, 128); g.rotate(a);
        var lg = g.createLinearGradient(-128, 0, 128, 0); lg.addColorStop(0, 'rgba(160,220,255,0)'); lg.addColorStop(.5, 'rgba(230,250,255,' + (k % 2 ? .5 : .9) + ')'); lg.addColorStop(1, 'rgba(160,220,255,0)');
        g.fillStyle = lg; g.fillRect(-128, -1.5, 256, 3); g.restore();
      }
    });
  }
  function bolt(g, x, y, ang, len, w, depth, seed) {
    var n = 10, px = x, py = y;
    g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
    for (var i = 1; i <= n; i++) {
      var a = ang + (hsh(seed + i) - .5) * 1.1;
      px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; g.lineTo(px, py);
      if (depth > 0 && hsh(seed * 3 + i) < .22) { g.stroke(); bolt(g, px, py, a + (hsh(seed + i * 7) - .5) * 1.6, len * .45, w * .6, depth - 1, seed * 1.7 + i); g.lineWidth = w; g.beginPath(); g.moveTo(px, py); }
    }
    g.stroke();
  }
  // faille : coeur lumineux + fissures ramifiées, voile bleu-violet
  function texRift(seed, n, violet) {
    return canvasTex(512, 512, function (g) {
      var base = violet ? [150, 120, 255] : [80, 160, 255];
      var r = g.createRadialGradient(256, 256, 0, 256, 256, 250);
      r.addColorStop(0, 'rgba(' + base + ',.45)'); r.addColorStop(.4, 'rgba(' + base + ',.12)'); r.addColorStop(1, 'rgba(20,30,90,0)');
      g.fillStyle = r; g.fillRect(0, 0, 512, 512);
      g.globalCompositeOperation = 'lighter';
      // ailes : lobes voilés en éventail
      for (var w = 0; w < 4; w++) {
        g.save(); g.translate(256, 256); g.rotate(w * Math.PI / 2 + .5 + (hsh(seed + w) - .5) * .5);
        for (var f = 0; f < 6; f++) {
          var gr = g.createLinearGradient(0, 0, 200, 0); gr.addColorStop(0, 'rgba(' + base + ',.55)'); gr.addColorStop(1, 'rgba(' + base + ',0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
          var a0 = (f - 2.5) * .11, len = 150 + hsh(seed + w * 9 + f) * 90;
          g.quadraticCurveTo(len * .5, Math.sin(a0) * len * .9 - 25, len, Math.sin(a0) * len); g.quadraticCurveTo(len * .5, Math.sin(a0) * len * .9 + 25, 0, 0); g.fill();
        }
        g.restore();
      }
      g.lineCap = 'round'; g.strokeStyle = 'rgba(200,240,255,.9)'; g.shadowColor = 'rgba(120,200,255,1)'; g.shadowBlur = 8;
      for (var k = 0; k < n; k++) bolt(g, 256, 256, k / n * Math.PI * 2 + hsh(seed + k), 60 + hsh(seed * 2 + k) * 90, 1.6, 1, seed + k * 13);
      var c = g.createRadialGradient(256, 256, 0, 256, 256, 46); c.addColorStop(0, 'rgba(255,255,255,1)'); c.addColorStop(.3, 'rgba(200,240,255,.8)'); c.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = c; g.fillRect(200, 200, 112, 112);
    });
  }
  function texBurst(seed) {   // sphère d'éclairs (40 s)
    return canvasTex(512, 512, function (g) {
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      var r = g.createRadialGradient(256, 256, 0, 256, 256, 256); r.addColorStop(0, 'rgba(160,220,255,.9)'); r.addColorStop(.25, 'rgba(70,140,255,.35)'); r.addColorStop(.7, 'rgba(40,70,200,.12)'); r.addColorStop(1, 'rgba(20,30,120,0)');
      g.fillStyle = r; g.fillRect(0, 0, 512, 512);
      for (var pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? 'rgba(200,225,255,.9)' : 'rgba(70,120,255,.55)'; g.shadowColor = 'rgba(90,150,255,1)'; g.shadowBlur = pass ? 5 : 16;
        for (var k = 0; k < 34; k++) bolt(g, 256, 256, k / 34 * Math.PI * 2, 150 + hsh(seed + k) * 100, pass ? 1.8 : 6, 2, seed + k * 7);
      }
      for (var k2 = 0; k2 < 10; k2++) { g.strokeStyle = 'rgba(220,120,255,.7)'; bolt(g, 256, 256, hsh(k2 + 50) * 6.3, 200, 2, 1, 90 + k2); }
    });
  }
  function texRing() {   // anneau arc-en-ciel (82 s)
    return canvasTex(512, 512, function (g) {
      var cols = ['rgba(255,80,80,', 'rgba(255,200,80,', 'rgba(120,255,140,', 'rgba(80,200,255,', 'rgba(160,110,255,'];
      for (var i = 0; i < cols.length; i++) {
        g.beginPath(); g.arc(256, 256, 170 + i * 9, 0, Math.PI * 2); g.strokeStyle = cols[i] + '.55)'; g.lineWidth = 12; g.shadowColor = cols[i] + '1)'; g.shadowBlur = 20; g.stroke();
      }
      var r = g.createRadialGradient(256, 256, 0, 256, 256, 170); r.addColorStop(0, 'rgba(120,170,255,.25)'); r.addColorStop(1, 'rgba(40,60,160,.05)'); g.fillStyle = r; g.beginPath(); g.arc(256, 256, 170, 0, 6.3); g.fill();
    });
  }
  function texMoon() {
    return canvasTex(256, 256, function (g) {
      var r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.32, 'rgba(250,252,255,1)'); r.addColorStop(.36, 'rgba(200,230,255,.55)'); r.addColorStop(.6, 'rgba(120,180,255,.12)'); r.addColorStop(1, 'rgba(80,140,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(190,205,225,.35)'; [[110, 112, 10], [142, 128, 7], [124, 146, 6], [146, 106, 5]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 6.3); g.fill(); });
    });
  }
  function texSmoke() {
    return canvasTex(128, 128, function (g) {
      for (var i = 0; i < 9; i++) {
        var x = 64 + (hsh(i) - .5) * 50, y = 64 + (hsh(i + 9) - .5) * 40, rr = 24 + hsh(i + 3) * 22;
        var r = g.createRadialGradient(x, y, 0, x, y, rr); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      }
    });
  }
  function texMeteor() {   // roche nuageuse rose-violet, flammes à l'avant, éclats de glace
    return canvasTex(512, 512, function (g) {
      g.translate(256, 256); g.rotate(-.6);
      for (var i = 0; i < 60; i++) {
        var u = hsh(i * 1.3) * 2 - 1, x = u * 170, y = (hsh(i * 2.9) - .5) * (130 - Math.abs(u) * 50), r = 34 + hsh(i * 4.1) * 40;
        var lit = .55 + .45 * hsh(i * 7.3), cr = 200 * lit + 40, cg = 120 * lit + 40, cb = 190 * lit + 50;
        var gr = g.createRadialGradient(x - r * .3, y - r * .3, 2, x, y, r); gr.addColorStop(0, 'rgba(' + (cr + 30 | 0) + ',' + (cg + 30 | 0) + ',' + (cb + 30 | 0) + ',.95)'); gr.addColorStop(.7, 'rgba(' + (cr * .6 | 0) + ',' + (cg * .5 | 0) + ',' + (cb * .7 | 0) + ',.85)'); gr.addColorStop(1, 'rgba(60,30,80,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
      }
      g.globalCompositeOperation = 'lighter';
      var lava = g.createRadialGradient(-175, 10, 0, -175, 10, 110); lava.addColorStop(0, 'rgba(255,250,200,1)'); lava.addColorStop(.25, 'rgba(255,170,60,.95)'); lava.addColorStop(.6, 'rgba(255,90,30,.5)'); lava.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = lava; g.fillRect(-300, -120, 260, 260);
      g.strokeStyle = 'rgba(200,235,255,.9)'; g.lineWidth = 2; g.shadowColor = 'rgba(140,210,255,1)'; g.shadowBlur = 10;
      for (var k = 0; k < 12; k++) bolt(g, -20 + hsh(k) * 200, (hsh(k + 4) - .5) * 110, hsh(k + 8) * 6.3, 50 + hsh(k + 2) * 50, 1.6, 1, 200 + k);
    });
  }
  function sprite(tex, color, size, additive, opacity) {
    var m = new T.SpriteMaterial({map: tex, color: color || 0xffffff, transparent: true, depthWrite: false, fog: false, blending: additive === false ? T.NormalBlending : T.AdditiveBlending, opacity: opacity == null ? 1 : opacity});
    var s = new T.Sprite(m); s.scale.setScalar(size); s.frustumCulled = false; grp.add(s); return s;
  }

  /* ---------------------------------------------------------------- traînées (tube révélé par shader) */
  var TRAIL_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  var TRAIL_FS = 'uniform float head,len,alpha;uniform vec3 col,core;varying vec2 vUv;void main(){float u=vUv.x;if(u>head)discard;float k=clamp(1.-(head-u)/len,0.,1.);float edge=1.-abs(vUv.y-.5)*2.;edge=pow(max(edge,0.),1.5);vec3 c=mix(col,core,pow(k,6.)*edge);gl_FragColor=vec4(c*(.6+.9*edge),k*edge*alpha);}';
  function trail(points, radius, color, core) {
    var curve = new T.CatmullRomCurve3(points);
    var geo = new T.TubeGeometry(curve, 160, radius * 2.6, 8, false);
    var mat = new T.ShaderMaterial({vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: {head: {value: 0}, len: {value: .5}, alpha: {value: 1}, col: {value: new T.Color(color)}, core: {value: new T.Color(core || 0xffffff)}}});
    var m = new T.Mesh(geo, mat); m.frustumCulled = false; grp.add(m);
    return {mesh: m, curve: curve, u: mat.uniforms};
  }
  /* ---------------------------------------------------------------- aurores boréales */
  var AUR_FS = 'uniform float time,alpha;varying vec2 vUv;' +
    'float h(float n){return fract(sin(n)*43758.5453);}float n1(float x){float i=floor(x),f=fract(x);return mix(h(i),h(i+1.),f*f*(3.-2.*f));}' +
    'void main(){float x=vUv.x*40.;float band=n1(x+time*.35)*.6+n1(x*2.7-time*.5)*.4;float rays=pow(n1(vUv.x*220.+time*.8),3.);' +
    'float v=vUv.y;float base=smoothstep(0.,.12,v)*(1.-smoothstep(.25+band*.55,.95,v));' +
    'vec3 c=mix(vec3(.1,1.,.55),vec3(.15,.75,1.),v)*.9+vec3(.5,.2,.9)*smoothstep(.6,1.,v)*.4;' +
    'float a=base*(.35+.65*band)*(.5+.5*rays)*alpha;gl_FragColor=vec4(c*a,a);}';
  function aurora(yaw0, yaw1, pitch, dist, height, seed) {
    var seg = 60, w = 2, geo = new T.PlaneGeometry(1, 1, seg, 1), pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var u = pos.getX(i) + .5, v = pos.getY(i) + .5;
      var yaw = L(yaw0, yaw1, u), wob = Math.sin(u * 7 + seed) * 6 + Math.sin(u * 17 + seed * 2) * 2;
      skyPos(yaw + wob * .3, pitch + v * height + Math.sin(u * 5 + seed) * 2, dist, tmp);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    geo.computeBoundingSphere();
    var mat = new T.ShaderMaterial({vertexShader: TRAIL_VS, fragmentShader: AUR_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: {time: {value: 0}, alpha: {value: 0}}, fog: false});
    var m = new T.Mesh(geo, mat); m.frustumCulled = false; grp.add(m); return m;
  }

  /* ---------------------------------------------------------------- fusée */
  function rocketMesh() {
    var g = new T.Group(), white = new T.MeshStandardMaterial({color: 0xeef2f6, roughness: .5, metalness: .2}), dark = new T.MeshStandardMaterial({color: 0x2a3550, roughness: .6});
    var body = new T.Mesh(new T.CylinderGeometry(1.6, 1.8, 16, 20), white); body.position.y = 8; g.add(body);
    var nose = new T.Mesh(new T.ConeGeometry(1.6, 5, 20), white); nose.position.y = 18.5; g.add(nose);
    var band = new T.Mesh(new T.CylinderGeometry(1.65, 1.65, 1.2, 20), dark); band.position.y = 12; g.add(band);
    for (var k = 0; k < 4; k++) { var fin = new T.Mesh(new T.BoxGeometry(.25, 4, 2.6), dark); fin.position.set(Math.cos(k * Math.PI / 2) * 2, 1.5, Math.sin(k * Math.PI / 2) * 2); fin.rotation.y = -k * Math.PI / 2; g.add(fin); }
    var flame = new T.Mesh(new T.ConeGeometry(1.5, 9, 16, 1, true), new T.MeshBasicMaterial({color: 0xffb060, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, fog: false}));
    flame.rotation.x = Math.PI; flame.position.y = -4.5; g.add(flame); g.userData.flame = flame;
    var glow = new T.Sprite(new T.SpriteMaterial({map: TEX.glow, color: 0xffa050, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false})); glow.scale.setScalar(26); glow.position.y = -2; g.add(glow); g.userData.glow = glow;
    return g;
  }
  function gantry() {
    var g = new T.Group(), mat = new T.MeshStandardMaterial({color: 0x56606e, roughness: .7, metalness: .4});
    for (var i = 0; i < 4; i++) { var leg = new T.Mesh(new T.BoxGeometry(.5, 28, .5), mat); leg.position.set(5 + (i % 2) * 3, 14, -1.5 + (i >> 1) * 3); g.add(leg); }
    for (var j = 0; j < 7; j++) { var bar = new T.Mesh(new T.BoxGeometry(3.6, .35, 3.4), mat); bar.position.set(6.5, 3 + j * 4, 0); g.add(bar); }
    var pad = new T.Mesh(new T.CylinderGeometry(11, 12, 1.6, 24), new T.MeshStandardMaterial({color: 0x3b4450, roughness: .9})); pad.position.y = -.4; g.add(pad);
    var hm = new T.MeshStandardMaterial({color: 0x3f6fb8, roughness: .7});
    [[-28, 6, 22, 12, 30], [26, 9, 18, 10, 22], [-6, 30, 26, 11, 16]].forEach(function (b) { var h = new T.Mesh(new T.BoxGeometry(b[2], b[3], b[4]), hm); h.position.set(b[0], b[3] / 2 - 1, b[1]); g.add(h); var roof = new T.Mesh(new T.CylinderGeometry(b[4] / 2, b[4] / 2, b[2], 12, 1, false, 0, Math.PI), hm); roof.rotation.z = Math.PI / 2; roof.position.set(b[0], b[3] - 1, b[1]); g.add(roof); });
    var lamp = new T.PointLight(0xffa860, 1.5, 120, 1.6); lamp.position.set(0, 10, 0); g.add(lamp);
    return g;
  }

  /* ---------------------------------------------------------------- construction de la scène */
  function build() {
    TEX.glow = texGlow(); TEX.star = texStar(); TEX.smoke = texSmoke(); TEX.moon = texMoon(); TEX.ring = texRing(); TEX.meteor = texMeteor();
    TEX.rift1 = texRift(3, 7, false); TEX.rift2 = texRift(11, 9, true); TEX.rift3 = texRift(23, 6, false); TEX.burst = texBurst(5);
    // étoiles
    var n = 1500, pg = new T.BufferGeometry(), arr = new Float32Array(n * 3), sz = new Float32Array(n);
    for (var i = 0; i < n; i++) { var y = Math.pow(hsh(i * 3.1), .6), a = hsh(i * 7.7) * Math.PI * 2, rr = Math.sqrt(1 - y * y); arr[i * 3] = P.x + Math.cos(a) * rr * 3600; arr[i * 3 + 1] = P.y + y * 3600; arr[i * 3 + 2] = P.z + Math.sin(a) * rr * 3600; }
    pg.setAttribute('position', new T.BufferAttribute(arr, 3));
    O.stars = new T.Points(pg, new T.PointsMaterial({color: 0xdfeaff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: .75, depthWrite: false, fog: false})); O.stars.frustumCulled = false; grp.add(O.stars);
    // voile bleu de la nuit + lune
    O.haze1 = sprite(TEX.glow, 0x3a8dff, 3000, true, .45); O.haze2 = sprite(TEX.glow, 0x2a50c8, 2200, true, .28);
    O.moon = sprite(TEX.moon, 0xffffff, 420, true, 1); O.moonHalo = sprite(TEX.glow, 0x6fc4ff, 1700, true, .7);
    // base de lancement + fusée
    O.base = gantry(); O.base.position.copy(BASE); O.base.lookAt(P.x, BASE.y, P.z); grp.add(O.base);
    O.rocket = rocketMesh(); grp.add(O.rocket);
    O.smoke = []; for (var s = 0; s < 46; s++) O.smoke.push(sprite(TEX.smoke, 0xf2e8ee, 10, false, 0));
    O.column = []; for (var c = 0; c < 150; c++) O.column.push(sprite(TEX.smoke, 0xf6d6e6, 14, false, 0));
    // failles et explosions du ciel
    O.rift1 = sprite(TEX.rift1, 0xffffff, 560, true, 0);
    O.rift2 = sprite(TEX.rift2, 0xffffff, 620, true, 0);
    O.rift3 = sprite(TEX.rift3, 0xffffff, 420, true, 0);
    O.rift4 = sprite(TEX.rift1, 0xc8b8ff, 340, true, 0);
    O.burst = sprite(TEX.burst, 0x8ab8ff, 900, true, 0);
    O.flash = sprite(TEX.star, 0xffffff, 400, true, 0);
    O.beam = new T.Mesh(new T.CylinderGeometry(6, 40, 1, 16, 1, true), new T.MeshBasicMaterial({color: 0x9fd8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide})); O.beam.frustumCulled = false; grp.add(O.beam);
    O.ring = sprite(TEX.ring, 0xffffff, 380, true, 0);
    O.ringBurst = sprite(TEX.burst, 0xd8c8ff, 520, true, 0);
    O.meteor = sprite(TEX.meteor, 0xffffff, 520, false, 0);
    O.meteorGlow = sprite(TEX.glow, 0xff8a50, 420, true, 0);
    O.rocketGlow = sprite(TEX.star, 0xbfe8ff, 60, true, 0);
    // aurores
    O.aur = [aurora(-110, 10, 14, 1800, 22, 1), aurora(-30, 95, 20, 1900, 26, 2.3), aurora(40, 160, 12, 2000, 20, 4.1), aurora(-170, -60, 18, 1900, 24, 5.7)];
    // traînées : fusée qui ressort (56 s), passages (60–76 s), éclats (88 s)
    O.tr = [
      trail([skyPos(-4, 62, 1200), skyPos(2, 44, 1150), skyPos(10, 22, 1100), skyPos(16, 6, 1000)], 3.2, 0x5fb8ff, 0xffffff),
      trail([skyPos(-60, 6, 900), skyPos(-25, 12, 700), skyPos(10, 18, 650), skyPos(60, 30, 900)], 3.5, 0x7fd0ff, 0xffffff),
      trail([skyPos(70, 28, 900), skyPos(40, 22, 520), skyPos(5, 14, 220), skyPos(-20, 10, 90), skyPos(-60, 6, 260)], 2.2, 0x8fd8ff, 0xffffff),
      trail([skyPos(20, 40, 800), skyPos(30, 32, 750), skyPos(48, 34, 760), skyPos(38, 42, 780)], 2.4, 0x9ad8ff, 0xffffff),
      trail([skyPos(-80, 4, 900), skyPos(-30, 10, 700), skyPos(20, 22, 650), skyPos(70, 40, 900)], 3.0, 0x88b8ff, 0xf0f6ff),
      trail([skyPos(-50, 10, 600), skyPos(-10, 16, 300), skyPos(10, 20, 120)], 2.6, 0x9fd8ff, 0xffffff),
      trail([skyPos(-30, 45, 900), skyPos(0, 30, 500), skyPos(25, 28, 300), skyPos(60, 20, 600)], 2.6, 0x9fd8ff, 0xffffff)
    ];
    build2(); build3();
    O.hemi = new T.HemisphereLight(0x7fb4ff, 0x1d5a3a, 1.3); grp.add(O.hemi);
    O.shards = []; for (var k = 0; k < 16; k++) O.shards.push(sprite(TEX.glow, 0xdff4ff, 6, true, 0));
  }

  /* ---------------------------------------------------------------- trajectoire de la première fusée */
  var RIFT1 = {yaw: 18, pitch: 52, dist: 900};
  function rocketPos(t, out) {
    // 9 s : allumage ; 10–34 s : montée qui s'incurve vers la faille ; 34,6 s : entrée
    var k = cl((t - 9.5) / 25), e = Math.pow(k, 1.7);
    var top = skyPos(RIFT1.yaw, RIFT1.pitch, RIFT1.dist, tmp2.clone());
    out.copy(BASE).add(tmp.set(0, 2, 0));
    var climb = out.clone().add(tmp.set(0, 420, 0));
    var a = out.clone().lerp(climb, Math.min(1, e * 1.6)), b = climb.clone().lerp(top, e);
    return out.copy(a).lerp(b, e);
  }

  /* ---------------------------------------------------------------- caméra (images clés vidéo) */
  // [t, recul, hauteur, côté, lacet°, tangage°, fov]
  var CAM = [
    [0, 3.4, 2.0, .5, -2, -3, 58], [5, 3.4, 2.0, .5, 0, -2, 58], [10, 3.2, 1.9, .6, 4, 4, 58], [13, 3.0, 1.6, .6, 8, 14, 60],
    [17, 2.8, 1.3, .7, 14, 28, 62], [24, 2.6, 1.1, .7, 18, 38, 62], [31, 2.3, .9, .8, 18, 48, 62], [36, 2.0, .7, .8, 16, 54, 64],
    [39, 2.0, .6, .6, 4, 58, 66], [42, 2.4, .8, .5, 8, 50, 64], [46, 3.0, 1.2, .4, 10, 34, 62], [52, 3.2, 1.4, .3, 4, 24, 60],
    [56, 3.4, 1.7, .3, -6, 10, 60], [59, 3.6, 1.9, .3, -22, 4, 58], [62, 3.6, 1.9, .3, -40, 6, 58], [64.5, 3.4, 1.7, .2, 10, 14, 60],
    [67, 3.4, 1.6, .2, 30, 14, 60], [70, 3.0, 1.2, .2, 18, 26, 62], [73, 3.4, 1.7, .3, -6, 10, 60], [76, 3.0, 1.3, .3, 4, 20, 62],
    [79, 3.4, 1.6, .2, -18, 8, 60], [82, 3.2, 1.5, .2, 0, 22, 60], [86, 3.0, 1.3, .2, 0, 26, 62], [88, 2.8, 1.1, .3, 22, 30, 62], [90, 3.4, 1.7, .3, 20, 14, 60],
    [93, 3.4, 1.7, .3, 0, 12, 60], [96, 3.6, 1.9, .3, -5, 6, 58], [100, 3.4, 1.7, .4, 30, 16, 60], [104, 3.4, 1.7, .3, -30, 8, 58],
    [108, 3.0, 1.2, .2, 20, 30, 62], [112, 3.2, 1.4, .2, 15, 24, 62], [116, 3.4, 1.6, .2, -20, 12, 60], [118, 3.6, 1.8, .3, 12, 8, 58],
    [124, 3.4, 1.7, .3, 18, 11, 58], [132, 3.2, 1.6, .3, 14, 13, 58], [140, 3.2, 1.6, .3, 10, 9, 58], [148, 3.2, 1.6, .3, 12, 9, 58],
    [152, 3.2, 1.6, .3, 8, 5, 58], [155, 3.6, 1.8, .3, 15, 3, 58], [157.2, 3.0, 2.3, .3, 0, -24, 58], [158.3, 3.0, 2.3, .3, 0, -24, 58],
    [158.6, 2.0, .2, .2, 0, 42, 64], [166, 1.8, .1, .2, 5, 50, 64], [176, 1.8, .1, .2, 5, 52, 64]
  ];
  function camAt(t) {
    var i = 0; while (i < CAM.length - 2 && t >= CAM[i + 1][0]) i++;
    var a = CAM[i], b = CAM[i + 1], k = sm((t - a[0]) / Math.max(.01, b[0] - a[0]));
    var o = []; for (var j = 1; j < 7; j++) o.push(L(a[j], b[j], k)); return o;
  }
  function applyCam(cam) {
    var t = E.tTotal, c = camAt(t);
    var p = playerPos();
    // léger mouvement à l'épaule
    var hx = Math.sin(t * .7) * .06 + Math.sin(t * 1.9) * .025, hy = Math.sin(t * .9 + 1) * .05;
    var cf = dirYP(c[3], 0, new T.Vector3()), cr = new T.Vector3().crossVectors(cf, UP).normalize();
    cam.position.copy(p).addScaledVector(cf, -c[0]).addScaledVector(cr, c[2] + hx).add(tmp.set(0, c[1] + hy, 0));
    var look = dirYP(c[3] + hx * 6, c[4] + hy * 6, tmp2);
    cam.lookAt(cam.position.x + look.x, cam.position.y + look.y, cam.position.z + look.z);
    if (cam.clearViewOffset) cam.clearViewOffset();
    camPos.copy(cam.position);
    cam.fov = c[5]; cam.near = .1; cam.far = 4500; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  function playerPos() { var p = api && api.player(); return tmp.set(p ? p.x : P.x, p ? p.y : P.y, p ? p.z : P.z).clone(); }

  /* ---------------------------------------------------------------- animation (déterministe) */
  function animate(t) {
    var p = playerPos();
    // nuit : lune, voile, étoiles
    skyPos(36, 30, 2000, O.moon.position); O.moonHalo.position.copy(O.moon.position);
    skyPos(20, 36, 3200, O.haze1.position); skyPos(-40, 20, 3200, O.haze2.position);
    O.haze1.material.opacity = .32 + .1 * ramp(t, 40, 50); O.haze2.material.opacity = .22;
    // fusée : fumée de lancement, montée, colonne de fumée rose
    var rk = O.rocket; rocketPos(t, rk.position);
    var flying = t >= 9 && t < 34.6;
    rk.visible = t < 34.6;
    if (t < 9.5) rk.position.copy(BASE).add(tmp.set(0, .4, 0));
    tmp.copy(rocketPos(t + .05, new T.Vector3())).sub(rk.position);
    if (flying && tmp.lengthSq() > 1e-4) rk.quaternion.setFromUnitVectors(UP, tmp.normalize()); else rk.quaternion.identity();
    var thr = ramp(t, 6.5, 9.5); rk.userData.flame.visible = t > 6.5; rk.userData.flame.scale.set(1, .6 + thr * 1.4 + Math.sin(t * 40) * .08, 1);
    rk.userData.glow.material.opacity = thr * (.8 + Math.sin(t * 31) * .2); var fz = 1 + 1.5 * ramp(t, 9, 20); rk.scale.setScalar(fz);
    O.smoke.forEach(function (s, i) {
      var born = 5.2 + i * .14, age = t - born, a = hsh(i) * Math.PI * 2, r = 6 + age * (5 + hsh(i + 3) * 4);
      s.visible = age > 0 && age < 26;
      if (!s.visible) return;
      s.position.set(BASE.x + Math.cos(a) * r, BASE.y + 2 + age * (.6 + hsh(i + 7) * .8), BASE.z + Math.sin(a) * r);
      s.scale.setScalar(12 + age * 3.2); s.material.opacity = Math.min(.85, age * 1.5) * (1 - cl((age - 10) / 16)) * .9;
    });
    O.column.forEach(function (s, i) {
      var k = i / O.column.length, tp = 9.5 + k * 25, age = t - tp;
      s.visible = age > 0 && t < 70;
      if (!s.visible) return;
      rocketPos(tp, s.position); s.position.y -= 6;
      s.position.x += Math.sin(i * 1.7 + t * .2) * age * .5; s.position.z += Math.cos(i * 1.3) * age * .4;
      s.scale.setScalar((6 + k * 16) * (1 + age * .04) * fz * .55);
      s.material.opacity = cl(age * 2) * .8 * (1 - ramp(t, 36, 46)) * (1 - k * .35);
    });
    // faille principale (22–40 s), entrée de la fusée, flash, sphère d'éclairs
    skyPos(RIFT1.yaw, RIFT1.pitch, RIFT1.dist, O.rift1.position);
    O.rift1.material.opacity = ramp(t, 20, 24) * (1 - ramp(t, 40, 44)) * (.85 + .15 * Math.sin(t * 9));
    O.rift1.material.rotation = t * .04; O.rift1.scale.setScalar(520 + 160 * ramp(t, 30, 36));
    skyPos(RIFT1.yaw, RIFT1.pitch, RIFT1.dist * .98, O.flash.position);
    O.flash.material.opacity = win(t, 34.5, 39, .3, 3.5) * 1.2; O.flash.scale.setScalar(300 + 900 * ramp(t, 34.5, 38.5));
    skyPos(RIFT1.yaw - 6, RIFT1.pitch + 2, RIFT1.dist * .9, O.burst.position);
    O.burst.material.opacity = win(t, 38.6, 45, .35, 3); O.burst.material.rotation = t * .3; O.burst.scale.setScalar(500 + 700 * ramp(t, 38.6, 41.5));
    // anneau de failles (42–46 s) et rayon vers le sol (46–52 s)
    skyPos(38, 34, 900, O.rift3.position); O.rift3.material.opacity = win(t, 41.5, 47, .6, 1.5); O.rift3.material.rotation = -t * .5;
    skyPos(6, 42, 950, O.rift2.position); O.rift2.material.opacity = win(t, 44, 58, 1.2, 3) * (.8 + .2 * Math.sin(t * 7)); O.rift2.material.rotation = t * .05;
    var bk = win(t, 46, 53, .8, 2.5);
    O.beam.material.opacity = bk * .55; O.beam.visible = bk > .01;
    if (O.beam.visible) {
      var top = skyPos(6, 42, 950, new T.Vector3()), bot = top.clone().setY(P.y - 10).addScaledVector(F, -80);
      O.beam.position.copy(top).lerp(bot, .5); O.beam.scale.set(1, top.distanceTo(bot), 1);
      O.beam.quaternion.setFromUnitVectors(UP, top.clone().sub(bot).normalize());
    }
    // aurores : apparaissent à 46 s puis ondulent
    O.aur.forEach(function (m, i) { m.material.uniforms.time.value = t + i * 3; m.material.uniforms.alpha.value = ramp(t, 45 + i * 1.5, 52 + i * 1.5) * (i === 3 ? .7 : 1) * (1 - .75 * ramp(t, 116, 121)) * .8; });
    // fusée qui ressort d'une faille (56 s) et passages (60–76 s)
    var tr = O.tr;
    function run(ti, a, b, tail, fade) { var k = cl((t - a) / (b - a)); tr[ti].u.head.value = k * 1.02; tr[ti].u.len.value = tail; tr[ti].u.alpha.value = (k > 0 ? 1 : 0) * (1 - ramp(t, b + .2, b + (fade || 2))); tr[ti].mesh.visible = t > a && t < b + (fade || 2); }
    run(0, 55.5, 59.5, .55, 3); run(1, 60.5, 63.5, .6, 2.5); run(2, 63.5, 66, .7, 1.5); run(3, 69, 71, .9, 1.5); run(4, 71.5, 74.5, .6, 2); run(5, 74.5, 76.2, .8, 1.2); run(6, 86.6, 88.6, .6, 2);
    // tête lumineuse de la traînée active
    var headOn = null; [[0, 55.5, 59.5], [1, 60.5, 63.5], [2, 63.5, 66], [4, 71.5, 74.5], [5, 74.5, 76.2], [6, 86.6, 88.6]].forEach(function (r) { if (t >= r[1] && t <= r[2]) headOn = r; });
    O.rocketGlow.material.opacity = headOn ? 1 : 0;
    if (headOn) { tr[headOn[0]].curve.getPointAt(cl((t - headOn[1]) / (headOn[2] - headOn[1])), O.rocketGlow.position); O.rocketGlow.scale.setScalar(55 + Math.sin(t * 30) * 6); }
    // météorite figée dans le ciel (apparaît 64 s)
    skyPos(46, 17, 760, O.meteor.position); O.meteorGlow.position.copy(O.meteor.position).addScaledVector(R, -60);
    O.meteor.material.opacity = ramp(t, 64.5, 66.5); O.meteorGlow.material.opacity = ramp(t, 64.5, 66.5) * (.55 + .1 * Math.sin(t * 5));
    O.meteor.material.rotation = .1;
    // explosion de faille proche (76 s), puis anneau arc-en-ciel (81–86 s)
    skyPos(-4, 16, 260, O.rift4.position); O.rift4.material.opacity = win(t, 76, 79.5, .15, 2) * 1.3; O.rift4.scale.setScalar(180 + 140 * ramp(t, 76, 77.5)); O.rift4.material.rotation = t * .6;
    skyPos(0, 26, 820, O.ring.position); O.ring.material.opacity = win(t, 80.5, 86.4, 1.2, .6); O.ring.scale.setScalar(300 + 40 * Math.sin(t * 2));
    O.ringBurst.position.copy(O.ring.position); O.ringBurst.material.opacity = win(t, 84.6, 88, .25, 2.2); O.ringBurst.scale.setScalar(400 + 500 * ramp(t, 84.6, 86.5)); O.ringBurst.material.rotation = -t * .4;
    // éclats de verre de la fusée qui traverse (88 s)
    O.shards.forEach(function (s, i) {
      var k = cl((t - 87.6) / 2.2); s.visible = k > 0 && k < 1; if (!s.visible) return;
      tr[6].curve.getPointAt(.62, s.position); s.position.add(tmp.set((hsh(i) - .5), (hsh(i + 5) - .5), (hsh(i + 9) - .5)).multiplyScalar(160 * k));
      s.material.opacity = (1 - k) * .9; s.scale.setScalar(5 + hsh(i + 2) * 6);
    });
  }


  /* ================================================================ PARTIE 2 : 90 → 176 s */
  var MET_A = [46, 17, 760], MET_B = [20, 11, 470];
  function meteorPos(t, out) {
    var k = sm((t - 116) / 2.2), a = skyPos(MET_A[0], MET_A[1], MET_A[2], new T.Vector3()), b = skyPos(MET_B[0], MET_B[1], MET_B[2], new T.Vector3());
    return out.copy(a).lerp(b, k);
  }
  function overlay() {   // voile plein écran (flash blanc, fondus) placé devant la caméra à chaque rendu
    if (O.ovq) return O.ovq;
    var m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0xe8f6ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false}));
    m.renderOrder = 9999; m.frustumCulled = false; grp.add(m); O.ovq = m;
    m.userData.op = 0; m.style = {set background(c) { m.material.color.set(c); }, set opacity(v) { m.userData.op = +v; m.material.opacity = +v; m.visible = +v > .002; }};
    return m;
  }
  function placeOverlay(cam) {
    if (!O.ovq) return;
    var q = O.ovq, d = .5, h = 2 * Math.tan(cam.fov * D2R / 2) * d * 1.2;
    q.position.copy(cam.position).add(tmp.set(0, 0, -d).applyQuaternion(cam.quaternion)); q.quaternion.copy(cam.quaternion); q.scale.set(h * cam.aspect, h, 1);
  }
  function build2() {
    // six fusées qui sillonnent le ciel (90–116 s)
    O.tr2 = []; O.tr2t = [];
    var R2 = [[90.5, 94, [-70, 8], [10, 30], [70, 45]], [92, 95.5, [80, 10], [20, 22], [-40, 28]], [94.5, 98, [-60, 20], [0, 26], [60, 20]],
      [96.5, 100, [70, 30], [10, 18], [-70, 14]], [99, 102.5, [-80, 6], [-10, 14], [50, 30]], [101.5, 105, [-40, 30], [10, 12], [60, 6]],
      [104, 107, [60, 8], [0, 14], [-60, 10]], [107.5, 110.6, [-40, 50], [0, 42], [18, 36]], [113, 116, [30, 40], [-10, 30], [-60, 20]]];
    R2.forEach(function (r, i) {
      var d = 650 + (i % 3) * 120;
      O.tr2.push(trail([skyPos(r[2][0], r[2][1], d * 1.3), skyPos(r[3][0], r[3][1], d), skyPos((r[3][0] + r[4][0]) / 2, (r[3][1] + r[4][1]) / 2 + 3, d), skyPos(r[4][0], r[4][1], d * 1.2)], 2.6, 0x86ccff, 0xffffff));
      O.tr2t.push(r);
    });
    O.rift5 = sprite(TEX.rift2, 0xd0e4ff, 520, true, 0); O.burst2 = sprite(TEX.burst, 0x9cc4ff, 700, true, 0);
    // boucles des fusées autour de la météorite (124–149 s)
    O.loops = [];
    var mc = skyPos(MET_B[0], MET_B[1], MET_B[2], new T.Vector3()), ax = skyPos(MET_B[0] - 25, MET_B[1] + 14, MET_B[2] + 60, new T.Vector3()).sub(mc).normalize();
    var u1 = new T.Vector3().crossVectors(ax, UP).normalize(), u2 = new T.Vector3().crossVectors(ax, u1).normalize();
    for (var k = 0; k < 4; k++) {
      var pts = [];
      for (var j = 0; j <= 40; j++) { var a = j / 40 * Math.PI * 4 + k * 1.57, along = (j / 40 - .5) * 220; pts.push(mc.clone().addScaledVector(ax, along).addScaledVector(u1, Math.cos(a) * (95 + k * 12)).addScaledVector(u2, Math.sin(a) * (80 + k * 10))); }
      O.loops.push(trail(pts, 1.6, 0xbfe6ff, 0xffffff));
    }
    O.under = sprite(TEX.star, 0xb8ecff, 300, true, 0);
    O.blast = sprite(TEX.burst, 0xd8f0ff, 900, true, 0);
    O.groundBolt = sprite(TEX.rift3, 0xdff4ff, 260, true, 0);
    O.scorch = new T.Mesh(new T.CircleGeometry(5.5, 40), new T.MeshBasicMaterial({color: 0x15181c, transparent: true, opacity: 0, depthWrite: false}));
    O.scorch.rotation.x = -Math.PI / 2; grp.add(O.scorch);
    // le vide : faille sombre puis étoile qui grandit, lasers rouges
    O.voidRing = sprite(TEX.ring, 0x6080ff, 40, true, 0);
    O.vstar = sprite(TEX.star, 0xc8e8ff, 60, true, 0); O.vstar2 = sprite(TEX.burst, 0x8fb8ff, 120, true, 0);
    O.laserH = new T.Mesh(new T.CylinderGeometry(.6, .6, 1, 6), new T.MeshBasicMaterial({color: 0xff2030, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false}));
    O.laserV = O.laserH.clone(); O.laserV.material = O.laserH.material.clone(); grp.add(O.laserH); grp.add(O.laserV);
    O.laserH.frustumCulled = O.laserV.frustumCulled = false;
  }
  function inVoid(t) { return (t >= 158.5 && t < 176.6) || (t >= 188.6 && t < 210.5) || t >= 254.5; }
  function animate2(t) {
    // traînées des six fusées
    var head = null;
    O.tr2.forEach(function (tr, i) {
      var r = O.tr2t[i], k = cl((t - r[0]) / (r[1] - r[0]));
      tr.u.head.value = k * 1.02; tr.u.len.value = .55; tr.u.alpha.value = (k > 0 ? 1 : 0) * (1 - ramp(t, r[1] + .2, r[1] + 2.2)); tr.mesh.visible = t > r[0] && t < r[1] + 2.2;
      if (k > 0 && k < 1) head = tr.curve.getPointAt(k);
    });
    if (head && !(O.rocketGlow.material.opacity > 0)) { O.rocketGlow.position.copy(head); O.rocketGlow.material.opacity = 1; O.rocketGlow.scale.setScalar(50); }
    skyPos(18, 36, 820, O.rift5.position); O.rift5.material.opacity = win(t, 108.5, 114, .8, 1.2); O.rift5.material.rotation = t * .3;
    O.burst2.position.copy(O.rift5.position); O.burst2.material.opacity = win(t, 110.4, 113.5, .15, 1.6); O.burst2.scale.setScalar(400 + 500 * ramp(t, 110.4, 112));
    // météorite qui se rapproche puis captée par les boucles
    if (t >= 64) {
      meteorPos(t, O.meteor.position); O.meteor.scale.setScalar(L(360, 330, sm((t - 116) / 2.2)) * (1 + .03 * Math.sin(t * 3)));
      O.meteorGlow.position.copy(O.meteor.position).addScaledVector(R, -80); O.meteorGlow.scale.setScalar(L(300, 300, sm((t - 116) / 2.2)));
      var bright = ramp(t, 138, 150); O.meteor.material.color.setRGB(1, 1 + bright * .15, 1 + bright * .3);
    }
    O.loops.forEach(function (lp, i) {
      var a = 124 + i * 1.6, k = cl((t - a) / 9); lp.u.head.value = k; lp.u.len.value = .35; lp.u.alpha.value = (k > 0 ? 1 : 0) * (1 - ramp(t, 150, 151.5)); lp.mesh.visible = k > 0 && t < 151.5;
    });
    // lueur sous la météorite, puis frappe (150–156 s)
    skyPos(16, 1.5, 380, O.under.position); O.under.material.opacity = ramp(t, 138, 148) * (1 - ramp(t, 155, 157)); O.under.scale.setScalar(200 + 500 * ramp(t, 140, 153));
    O.blast.position.copy(O.under.position); O.blast.material.opacity = win(t, 150.5, 156, .4, 1.5) * (PLAY ? .5 : 1); O.blast.scale.setScalar(500 + 1400 * ramp(t, 150.5, 154));
    var ov = overlay(), fl = Math.max(win(t, 152.6, 155.6, .9, 1.1) * (PLAY ? .5 : 1), win(t, 34.6, 36.4, .15, 1.4) * (PLAY ? .1 : .35), win(t, 38.6, 39.6, .1, .8) * (PLAY ? .08 : .3));
    ov.style.background = '#e8f6ff'; ov.style.opacity = fl.toFixed(3);
    skyPos(26, 2.5, 230, O.groundBolt.position); O.groundBolt.material.opacity = win(t, 155.4, 158.2, .2, 1); O.groundBolt.material.rotation = t;
    O.scorch.position.set(P.x, H(P.x, P.z) + .08, P.z).addScaledVector(F, 8); O.scorch.material.opacity = ramp(t, 156, 157) * (1 - ramp(t, 158.3, 158.6)) * .85;
    // le vide
    var vd = inVoid(t);
    skyPos(25, 58, 600, O.voidRing.position); O.voidRing.material.opacity = vd ? win(t, 160.5, 165, .8, 1.2) : 0; O.voidRing.scale.setScalar(30 + 10 * Math.sin(t * 2));
    O.vstar.position.copy(O.voidRing.position); O.vstar2.position.copy(O.voidRing.position);
    O.vstar.material.opacity = vd ? ramp(t, 163.5, 166) : 0; O.vstar.scale.setScalar(40 + 260 * ramp(t, 164, 176));
    O.vstar2.material.opacity = vd ? ramp(t, 167, 169) * .9 : 0; O.vstar2.scale.setScalar(120 + 300 * ramp(t, 167, 176)); O.vstar2.material.rotation = t * .5;
    var lz = vd && t < 176.6 ? ramp(t, 174.8, 175.4) : 0;
    [O.laserH, O.laserV].forEach(function (m, i) {
      m.material.opacity = lz * .9; m.visible = lz > .01; if (!m.visible) return;
      var c = O.vstar.position, dir = i ? UP.clone() : R.clone();
      m.position.copy(c); m.scale.set(1, 4000, 1); m.quaternion.setFromUnitVectors(UP, dir);
    });
  }


  /* ================================================================ PARTIE 3 : 176 → 303 s */
  var ZP = new T.Vector3(), ZYAW = 0;
  function camKeys3() {
    var z = ZYAW;
    // retour sur l'île face au dôme, envol, vide rouge/bleu, chute vers le dôme, trou noir
    [[176.6, 3.4, 1.8, .3, z, 4, 58], [180, 3.4, 1.8, .3, z, 5, 58], [183.5, 3.6, 2.0, .3, z, 6, 58],
     [184.6, 4.2, 3.4, .2, z, -10, 60], [188.3, 4.2, 3.4, .2, z, -16, 60],
     [188.6, 3.0, .4, .2, z, 18, 64], [190, 2.6, -.4, .2, z, 30, 66], [200, 2.6, -.5, .2, z, 32, 66], [209.5, 3.0, -.2, .2, z, 24, 64],
     [210.6, 4.5, 3.2, .2, z, -34, 60], [216, 4.5, 3.4, .2, z, -42, 60], [223.5, 4.5, 3.4, .2, z, -44, 60],
     [224.5, 4.8, 3.8, .2, z, -40, 66], [240, 5.5, 4.5, .2, z, -48, 68], [252, 6, 5, .2, z, -50, 70],
     [254.5, 6, 5, .2, z, -50, 70], [255, 3, 0, 0, z, 0, 60], [303, 3, 0, 0, z, 0, 60], [999, 3, 0, 0, z, 0, 60]
    ].forEach(function (k) { CAM.push(k); });
  }
  function flight(t, out) {   // position du joueur (sol, soulevé, chute vers le dôme, aspiré)
    var g = out.set(P.x, H(P.x, P.z), P.z);
    if (t >= 184.4 && t < 188.6) { var k = sm((t - 184.4) / 4); g.lerp(tmp.copy(ZP).setY(ZP.y + 160), .25 * k); g.y = L(H(P.x, P.z), ZP.y + 140, k); }
    else if (t >= 210.5 && t < 254.5) {
      var k2 = cl((t - 210.5) / 13.5), start = tmp.copy(P).lerp(ZP, .55).setY(ZP.y + 760);
      g.copy(start).lerp(tmp2.copy(ZP).setY(ZP.y + 470).addScaledVector(F, -260), sm(k2));
      if (t >= 224) { var k3 = sm((t - 224) / 28); g.lerp(tmp2.copy(ZP).setY(ZP.y + 20), k3 * .92); }
    }
    return g;
  }
  function inAir(t) { return (t >= 184.4 && t < 188.6) || (t >= 188.6 && t < 210.5) || (t >= 210.5 && t < 254.5); }
  function texSwirl() {
    return canvasTex(512, 512, function (g) {
      g.translate(256, 256); g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 260; i++) {
        var a0 = hsh(i) * Math.PI * 2, r0 = 30 + hsh(i + 1) * 220, len = .6 + hsh(i + 2) * 1.4;
        g.strokeStyle = 'rgba(' + (180 + hsh(i + 3) * 75 | 0) + ',' + (210 + hsh(i + 4) * 45 | 0) + ',255,' + (.08 + hsh(i + 5) * .25) + ')'; g.lineWidth = 1 + hsh(i + 6) * 4;
        g.beginPath(); for (var j = 0; j <= 20; j++) { var a = a0 + len * j / 20, r = r0 * (1 - .35 * j / 20); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke();
      }
      var c = g.createRadialGradient(0, 0, 0, 0, 0, 120); c.addColorStop(0, 'rgba(255,255,255,1)'); c.addColorStop(.3, 'rgba(200,235,255,.7)'); c.addColorStop(1, 'rgba(120,180,255,0)'); g.fillStyle = c; g.fillRect(-256, -256, 512, 512);
    });
  }
  function texRays(magenta) {
    return canvasTex(512, 512, function (g) {
      g.translate(256, 256); g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 70; i++) {
        var a = hsh(i * 3) * Math.PI * 2, w = .004 + hsh(i) * .02, m = magenta && i % 4 === 0;
        var gr = g.createLinearGradient(0, 0, Math.cos(a) * 256, Math.sin(a) * 256); gr.addColorStop(0, m ? 'rgba(255,90,220,.9)' : 'rgba(220,240,255,.9)'); gr.addColorStop(1, 'rgba(120,160,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 256, a - w, a + w); g.fill();
      }
    });
  }
  function texHole() {
    return canvasTex(256, 256, function (g) {
      g.translate(128, 128);
      var r = g.createRadialGradient(0, 0, 20, 0, 0, 120); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(.25, 'rgba(40,80,200,.9)'); r.addColorStop(.45, 'rgba(20,40,140,.45)'); r.addColorStop(1, 'rgba(0,0,40,0)');
      g.fillStyle = r; g.fillRect(-128, -128, 256, 256);
      g.strokeStyle = 'rgba(120,170,255,.6)'; g.lineWidth = 2;
      for (var i = 0; i < 9; i++) { g.beginPath(); var a0 = i * .7; for (var j = 0; j <= 24; j++) { var a = a0 + j * .12, rr = 32 + j * 2.2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,1)'; g.beginPath(); g.arc(0, 0, 30, 0, 6.3); g.fill();
    });
  }
  var DOME_FS = 'uniform float time,flash,amt;uniform vec3 col;varying vec3 vN;varying vec3 vV;varying vec2 vUv;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}' +
    'void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);float crack=step(.985,h(floor(vUv*vec2(60.,30.))+floor(time*3.)));' +
    'vec3 c=mix(col,vec3(1.),flash)*(.25+f*1.4)+vec3(.8,.9,1.)*crack*.6;gl_FragColor=vec4(c*amt,(.18+f*.8+flash*.6)*amt);}';
  var DOME_VS = 'varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 w=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-w.xyz;gl_Position=projectionMatrix*w;}';
  function build3() {
    var zp0 = E.zeroPointPos; ZP.set(zp0 ? zp0.x : 0, H(zp0 ? zp0.x : 0, zp0 ? zp0.z : 0) + 25, zp0 ? zp0.z : 0);
    var dz = ZP.clone().sub(P); ZYAW = Math.atan2(dz.dot(R), dz.dot(F)) / D2R;
    camKeys3();
    TEX.swirl = texSwirl(); TEX.rays = texRays(false); TEX.raysM = texRays(true); TEX.hole = texHole();
    O.dome = new T.Mesh(new T.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new T.ShaderMaterial({vertexShader: DOME_VS, fragmentShader: DOME_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: {time: {value: 0}, flash: {value: 0}, amt: {value: 0}, col: {value: new T.Color(0xc87aff)}}}));
    O.dome.position.copy(ZP).setY(ZP.y - 25); O.dome.frustumCulled = false; grp.add(O.dome);
    O.domeBeam = new T.Mesh(new T.CylinderGeometry(8, 14, 1, 16, 1, true), new T.MeshBasicMaterial({color: 0xbfe8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false})); O.domeBeam.frustumCulled = false; grp.add(O.domeBeam);
    O.redL = []; for (var i = 0; i < 2; i++) { var m = new T.Mesh(new T.CylinderGeometry(.9, .9, 1, 6), new T.MeshBasicMaterial({color: 0xff2238, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false})); m.frustumCulled = false; grp.add(m); O.redL.push(m); }
    O.bigRift = sprite(TEX.rift2, 0xa8c4ff, 900, true, 0); O.bigSphere = sprite(TEX.glow, 0x2a4cff, 1600, true, 0); O.bigBurst = sprite(TEX.burst, 0xbcd8ff, 700, true, 0);
    O.met2 = sprite(TEX.meteor, 0xffb8a0, 60, false, 0); O.met2Glow = sprite(TEX.glow, 0xff5a2a, 80, true, 0);
    O.esc = []; for (var e = 0; e < 6; e++) O.esc.push(sprite(TEX.star, 0xc8ecff, 30, true, 0));
    O.fallMet = sprite(TEX.glow, 0xff6a2a, 90, true, 0); O.fallCol = new T.Mesh(new T.CylinderGeometry(5, 9, 1, 12, 1, true), new T.MeshBasicMaterial({color: 0xff4a2a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false})); O.fallCol.frustumCulled = false; grp.add(O.fallCol);
    O.dive = []; for (var d = 0; d < 6; d++) { var a = d / 6 * Math.PI * 2; O.dive.push(trail([ZP.clone().add(tmp.set(Math.cos(a) * 220, 700, Math.sin(a) * 220)), ZP.clone().add(tmp.set(Math.cos(a) * 120, 380, Math.sin(a) * 120)), ZP.clone().add(tmp.set(Math.cos(a) * 30, 60, Math.sin(a) * 30))], 1.5, 0xc8ecff, 0xffffff)); }
    O.bhFlash = sprite(TEX.star, 0xffffff, 600, true, 0); O.bhRays = sprite(TEX.raysM, 0xffffff, 1200, true, 0); O.bhSwirl = sprite(TEX.swirl, 0xdfefff, 600, true, 0);
    O.endStar = sprite(TEX.star, 0xffffff, 40, true, 0); O.hole = sprite(TEX.hole, 0xffffff, 30, false, 0);
  }
  function inVoid2(t) { return t >= 188.6 && t < 210.5; }
  function inBlack(t) { return t >= 254.5; }
  function animate3(t) {
    var vd2 = inVoid2(t), blk = inBlack(t);
    // dôme du Point Zéro
    var du = O.dome.material.uniforms; du.time.value = t;
    du.amt.value = ramp(t, 178, 180) * (1 - ramp(t, 224, 226)) * (vd2 || blk ? 0 : 1);
    du.flash.value = win(t, 182.6, 185, .2, 1.6) + win(t, 216, 224, 2, .5) * .5;
    O.dome.scale.set(1, 1, 1).multiplyScalar(170 + 10 * Math.sin(t * 2) + 40 * ramp(t, 216, 224));
    var bm = win(t, 182.8, 185.5, .2, 1.2) * (vd2 ? 0 : 1); O.domeBeam.material.opacity = bm * .8; O.domeBeam.visible = bm > .01;
    O.domeBeam.position.copy(ZP).setY(ZP.y + 600); O.domeBeam.scale.set(1, 1250, 1);
    O.redL.forEach(function (m, i) { var o = win(t, 178.6, 182.4, .3, .6); m.material.opacity = o * .85; m.visible = o > .01; m.position.copy(ZP).add(tmp.set(i ? 40 : -30, 700, i ? -20 : 25)); m.scale.set(1, 1400, 1); });
    // vide n°2 : grande faille, la météorite en ressort avec son escorte
    var cen = skyPos(ZYAW, 34, 1200, new T.Vector3());
    O.bigRift.position.copy(cen); O.bigRift.material.opacity = vd2 ? ramp(t, 189.5, 191) * .9 : 0; O.bigRift.material.rotation = t * .05;
    O.bigSphere.position.copy(cen); O.bigSphere.material.opacity = vd2 ? win(t, 191, 199, 1, 3) * .8 : 0; O.bigSphere.scale.setScalar(1200 + 1200 * ramp(t, 191, 196));
    O.bigBurst.position.copy(cen); O.bigBurst.material.opacity = vd2 ? win(t, 190.4, 194, .2, 2) : 0; O.bigBurst.scale.setScalar(500 + 600 * ramp(t, 190.4, 192));
    var mk = sm((t - 193) / 17), mp = cen.clone().lerp(playerPos().add(tmp.set(0, 30, 0)), mk * .8);
    O.met2.position.copy(mp); O.met2.material.opacity = vd2 ? ramp(t, 193, 195) : 0; O.met2.scale.setScalar(50 + 220 * mk * mk); O.met2.material.rotation = 1.4;
    O.met2Glow.position.copy(mp); O.met2Glow.material.opacity = O.met2.material.opacity * .8; O.met2Glow.scale.setScalar(120 + 260 * mk);
    O.esc.forEach(function (s, i) {
      var a = i / 6 * Math.PI * 2, k = sm((t - 205) / 5);
      s.position.copy(mp).add(tmp.set(Math.cos(a) * (40 + 60 * k), Math.sin(a) * 30 - 80 * k, Math.sin(a) * 40)); s.material.opacity = vd2 ? ramp(t, 204.5, 206) : 0; s.scale.setScalar(30);
    });
    // chute vers le dôme : fusées qui plongent, météorite qui tombe dans le dôme
    O.dive.forEach(function (tr, i) { var k = cl((t - 210.8 - i * .25) / 3.2); tr.u.head.value = k; tr.u.len.value = .5; tr.u.alpha.value = k > 0 ? 1 - ramp(t, 214.5, 216) : 0; tr.mesh.visible = k > 0 && t < 216; });
    var fk = cl((t - 214.5) / 8), mtop = ZP.clone().setY(ZP.y + 1400), mpos = mtop.clone().lerp(ZP, sm(fk));
    O.fallMet.position.copy(mpos); O.fallMet.material.opacity = win(t, 214.5, 223.8, .5, .3) * (vd2 ? 0 : 1); O.fallMet.scale.setScalar(120);
    var co = win(t, 214.8, 224, .8, .4); O.fallCol.material.opacity = co * .7; O.fallCol.visible = co > .01;
    O.fallCol.position.copy(mtop).lerp(mpos, .5); O.fallCol.scale.set(1, Math.max(1, mtop.distanceTo(mpos)), 1);
    // trou noir : explosion de lumière, tourbillon qui avale l'île
    var bc = ZP.clone().setY(ZP.y + 10);
    O.bhFlash.position.copy(bc); O.bhFlash.material.opacity = win(t, 223.8, 228, .3, 3) * .7 + win(t, 249.5, 254.5, 2.5, 1.2) * .8; O.bhFlash.scale.setScalar(600 + 1500 * ramp(t, 223.8, 225) + 1200 * ramp(t, 249, 252.5));
    O.bhRays.position.copy(bc); O.bhRays.material.opacity = win(t, 224, 236, .4, 6) * .55; O.bhRays.scale.setScalar(1400 + 600 * ramp(t, 224, 230)); O.bhRays.material.rotation = t * .05;
    O.bhSwirl.position.copy(bc); O.bhSwirl.material.opacity = win(t, 226, 254.4, 4, .4) * .75; O.bhSwirl.scale.setScalar(400 + 1300 * ramp(t, 226, 248)); O.bhSwirl.material.rotation = -t * .6;
    var ov = overlay(); ov.style.background = '#e9f6ff';
    var fl = Math.max(+ov.userData.op || 0, win(t, 223.7, 225.2, .15, 1.1) * .5, win(t, 252.5, 254.6, 1.2, .2) * .6);
    if (t >= 188.3 && t < 189.8) { ov.style.background = '#5a0c1c'; fl = Math.max(fl, win(t, 188.3, 189.8, .2, .8) * .45); }
    ov.style.opacity = fl.toFixed(3);
    // écran noir : étoile qui s'éteint, puis le petit trou noir
    var front = playerPos().addScaledVector(F, 1);
    var look = PLAY ? camFwd.clone() : dirYP(ZYAW, 0, new T.Vector3());
    O.endStar.position.copy(camPos).addScaledVector(look, 400); O.endStar.material.opacity = blk ? win(t, 254.5, 258.5, .1, 3.5) : 0; O.endStar.scale.setScalar(60 * (1 - ramp(t, 254.5, 258)) + 8);
    O.hole.position.copy(camPos).addScaledVector(look, 400); O.hole.material.opacity = blk ? ramp(t, 270, 274) : 0; O.hole.scale.setScalar(40 + 3 * Math.sin(t * 1.3)); O.hole.material.rotation = -t * .4;
  }

  /* ---------------------------------------------------------------- joueur, nuit, rendu */
  function holdPlayer() {
    var p = api.player(); if (!p) return;
    if (!p.deployed) { try { api.world()._deployFromBus(p, false); } catch (e) {} }
    var fp = flight(E.tTotal, new T.Vector3()), cy = camAt(E.tTotal)[3]; p.x = fp.x; p.z = fp.z; p.y = fp.y; p.grounded = true; p.falling = p.gliding = p.jumping = p.flying = false; p.deployed = true; p.airborneFromBus = false; p.autoGlider = false;
    p._vy = 0; var lf = dirYP(cy, 0, new T.Vector3()); p.yaw = Math.atan2(-lf.x, -lf.z);
    if (inVoid(E.tTotal) || inAir(E.tTotal)) { p.grounded = false; p.falling = true; }
    if (E.tTotal >= 254.5) { var av = api.view(); if (av && av.actorRoot) av.actorRoot.visible = false; } else { var av2 = api.view(); if (av2 && av2.actorRoot) av2.actorRoot.visible = true; }
    var g = api.game(); if (g) { g.move = {x: 0, z: 0}; g.fire = false; g.yaw = p.yaw; g.harvest = false; g.buildType = null; }
    var v = api.view(); if (v && v.aircraft) v.aircraft.visible = false;
    var w = api.world(); if (w) w._azBusOverride = {x: P.x + 4000, y: -500, z: P.z + 4000};
  }
  function setVoid(onv, v) {
    if (onv) {
      voidHidden = [];
      v.scene.children.forEach(function (c) { if (c !== grp && c !== v.actorRoot && !c.isLight && c.visible) { voidHidden.push(c); c.visible = false; } });
      O.prevBg = v.scene.background; v.scene.background = new T.Color(0x01030a);
      O.skyOff = [O.haze2, O.moon, O.moonHalo, O.meteor, O.meteorGlow, O.under, O.blast, O.groundBolt, O.scorch, O.rocketGlow].concat(O.aur);
      O.skyOff.forEach(function (o) { o.visible = false; });
    } else {
      voidHidden.forEach(function (c) { c.visible = true; }); voidHidden = [];
      if (O.prevBg !== undefined) v.scene.background = O.prevBg;
      (O.skyOff || []).forEach(function (o) { if (o) o.visible = true; });
    }
  }
  function hookRender() {
    var v = api.view(); if (!v || !v.renderer) return;
    renderer = v.renderer; innerRender = renderer.render;
    var expo0 = renderer.toneMappingExposure;
    // panache du volcan masqué pendant le film (il n'existe pas dans la vidéo)
    hidden = [];
    if (v.scene) v.scene.traverse(function (o) { if (o.isPoints && o.material && o.material.vertexShader && o.material.vertexShader.indexOf('t*320.') >= 0) hidden.push(o); });
    var wrapped = function (scene, cam) {
      if (on && cam === v.camera) {
        var tv = VT();
        if (PLAY) { camPos.copy(cam.position); cam.getWorldDirection(camFwd); try { placeOverlay(cam); } catch (e) {} }
        else { try { applyCam(cam); placeOverlay(cam); } catch (e) {} }
        if (scene.fog) { scene.fog.color.set(0x1e4c8c); scene.fog.density = .00042; }
        renderer.toneMappingExposure = tv > 223.5 && tv < 255 ? .95 : tv > 210 && tv < 224 ? 1.1 : 1.35;
        var insideRift = document.body.classList.contains('inside-rift');
        var vd = PLAY ? tv >= 254.5 && !insideRift : inVoid(tv);
        if (vd !== voidOn) { voidOn = vd; setVoid(vd, v); }
        if (vd && scene.fog) { scene.fog.color.set(0x000206); }
        if (O.stars) O.stars.visible = tv < 256;
        if (vd && tv >= 254.5) scene.background = new T.Color(0x000000);
        var w2 = v.worldV2 || (v.environment && v.environment.worldV2);
        if (w2 && w2.clouds) { var cc = w2.clouds; if (!cc.userData.filmScale) cc.userData.filmScale = cc.scale.clone(); cc.scale.setScalar(1e-4); }
        if (v.environment && v.environment.clouds) { var ec = v.environment.clouds; if (!ec.userData.filmScale) ec.userData.filmScale = ec.scale.clone(); ec.scale.setScalar(1e-4); ec.visible = false; }
        hidden.forEach(function (o) { o.visible = false; });
      } else renderer.toneMappingExposure = expo0;
      return innerRender.apply(this, arguments);
    };
    wrapped.__gate = innerRender.__gate; wrapped.__film = true; renderer.render = wrapped;
  }
  /* ---------------------------------------------------------------- v78 : mode jouable */
  /* v80 : chaque faille est liée à une fusée ou à la météorite — une fusée sort toujours
     d'une faille et rentre toujours dans une faille ; aucune faille ne s'ouvre « pour rien ». */
  function riftMesh(i) {
    var S = E.oldRiftShaders, seed = 3.1 + i * 2.173, ang = {value: S.angle(seed)}, sd = {value: seed};
    var mat = new T.ShaderMaterial({transparent: true, side: T.DoubleSide, depthWrite: false, fog: false,
      uniforms: {time: {value: 0}, opening: {value: 0}, pulse: {value: 0}, seed: sd, ang: ang, parallax: {value: new T.Vector2()}}, vertexShader: S.vertex, fragmentShader: S.fragment});
    var cmat = new T.ShaderMaterial({transparent: true, side: T.DoubleSide, depthWrite: false, fog: false, blending: T.AdditiveBlending,
      uniforms: {time: {value: 0}, opening: {value: 0}, pulse: {value: 0}, anticipation: {value: 0}, age: {value: 99}, ang: ang, seed: sd}, vertexShader: S.vertex, fragmentShader: S.corona});
    var g = new T.Group(), m = new T.Mesh(new T.PlaneGeometry(1, 1), mat), c = new T.Mesh(new T.PlaneGeometry(2, 2), cmat);
    m.frustumCulled = c.frustumCulled = false; m.renderOrder = 3; c.renderOrder = 2; g.add(c); g.add(m); g.visible = false; grp.add(g);
    return {g: g, mat: mat, cmat: cmat, born: -1};
  }
  function addRift(pos, size, a, b, fi, fo) {   // faille fixe ouverte de a à b
    var r = riftMesh(RIFTS.length); r.pos = pos.clone(); r.size = size; r.a = a; r.b = b; r.fi = fi || .8; r.fo = fo || .8; RIFTS.push(r); return r;
  }
  function trailRifts(tr, a, b, exit, entry) {
    var p0 = tr.curve.getPointAt(0), p1 = tr.curve.getPointAt(1);
    if (exit) addRift(p0, Math.max(90, p0.distanceTo(P) * .3), a - 1.4, a + 1.6, .7, .9);
    if (entry) addRift(p1, Math.max(90, p1.distanceTo(P) * .3), b - 1.6, b + 1.2, .7, .9);
  }
  var MET_POS = new T.Vector3();
  function buildOldRifts() {
    if (!E.oldRiftShaders) return;
    MET_POS.copy(skyPos(MET_A[0], MET_A[1], MET_A[2], new T.Vector3()));
    // 1re fusée : la faille s'ouvre juste avant qu'elle y entre (34,6 s)
    addRift(skyPos(RIFT1.yaw, RIFT1.pitch, RIFT1.dist, new T.Vector3()), 520, 30.5, 38.5, 1.2, 2.5);
    // fusées qui ressortent / repassent (55–89 s)
    var T1 = [[0, 55.5, 59.5, 1, 1], [1, 60.5, 63.5, 1, 1], [2, 63.5, 66, 1, 1], [3, 69, 71, 1, 1], [4, 71.5, 74.5, 1, 1], [5, 74.5, 76.2, 1, 0], [6, 86.6, 88.6, 1, 1]];
    T1.forEach(function (d) { trailRifts(O.tr[d[0]], d[1], d[2], d[3], d[4]); });
    // explosion de faille proche au bout de la 6e traînée (76 s)
    addRift(skyPos(-4, 16, 260, new T.Vector3()), 240, 75.6, 79.5, .3, 2);
    // les six fusées qui sillonnent le ciel (90–116 s)
    O.tr2.forEach(function (tr, i) { var r = O.tr2t[i]; trailRifts(tr, r[0], r[1], true, true); });
    // la météorite sort d'une faille (64 s) avant de se figer
    addRift(MET_POS, 430, 62.2, 69, 1.2, 2.5);
    // les boucles des fusées tournent autour de la vraie météorite
    var mc = skyPos(MET_B[0], MET_B[1], MET_B[2], new T.Vector3()), dlt = MET_POS.clone().sub(mc);
    O.loops.forEach(function (lp) { lp.mesh.position.add(dlt); });
    O.under.userData.shift = dlt;
  }
  function playFix(t) {
    var inside = document.body.classList.contains('inside-rift');
    // les sprites du film qui faisaient office de failles et de météorite sont remplacés
    ['rift1', 'rift2', 'rift3', 'rift4', 'rift5', 'bigRift', 'meteor', 'meteorGlow', 'met2', 'met2Glow', 'fallMet', 'fallCol', 'beam'].forEach(function (k) { if (O[k]) O[k].visible = false; });
    (O.esc || []).forEach(function (s) { s.visible = false; });
    // écran noir final (comme la vidéo) : seuls l'étoile qui s'éteint et le petit trou noir restent
    if (t >= 254.5 && !inside) {
      grp.children.forEach(function (c) { if (c !== O.endStar && c !== O.hole && c !== O.ovq) c.visible = false; });
      var av = api.view(); if (av && av.actorRoot) { av.actorRoot.visible = false; O.hidActor = true; }
      return;
    } else if (O.hidActor) { var av2 = api.view(); if (av2 && av2.actorRoot) av2.actorRoot.visible = true; O.hidActor = false; }
    var cam = api.camera();
    // la vraie météorite habillée comme dans la vidéo : nuage rose, flammes, halo chaud
    if (E.meteorVisible && E.meteorPos && !inside && cam) {
      var back = tmp.copy(E.meteorPos).sub(cam.position).normalize(), MR = E.meteorVisR || 66;
      O.meteor.visible = O.meteorGlow.visible = true;
      O.meteor.position.copy(E.meteorPos).addScaledVector(back, MR * 1.3); O.meteor.scale.setScalar(MR * 6.2); O.meteor.material.opacity = 1; O.meteor.material.rotation = .1;
      O.meteorGlow.position.copy(E.meteorPos).addScaledVector(back, MR * 1.5); O.meteorGlow.scale.setScalar(MR * 6.5); O.meteorGlow.material.opacity = .55 + .1 * Math.sin(t * 5);
    }
    if (O.under.userData.shift) { O.under.position.add(O.under.userData.shift); O.blast.position.add(O.under.userData.shift); }
    RIFTS.forEach(function (r) {
      var op = win(t, r.a, r.b, r.fi, r.fo);
      r.g.visible = op > .004;
      if (!r.g.visible) { r.born = -1; return; }
      if (r.born < 0) r.born = t;
      r.g.position.copy(r.pos); if (cam) r.g.quaternion.copy(cam.quaternion);
      r.g.scale.setScalar(r.size);
      var age = t - r.born;
      r.mat.uniforms.time.value = t; r.mat.uniforms.opening.value = op; r.mat.uniforms.pulse.value = Math.max(0, 1 - age * 1.5) * .8;
      var u = r.cmat.uniforms; u.time.value = t; u.opening.value = op; u.pulse.value = r.mat.uniforms.pulse.value; u.age.value = age;
    });
  }
  /* v78 : le Battle Bus passe à basse altitude au-dessus de la prairie de la vidéo,
     face à la base de lancement ; le joueur saute quand il veut (largage auto à -3 s). */
  var busOwn = false, BUS_Y = 0;
  function busRoute(t) {
    var w = api.world(), p = api.player(); if (!w) return;
    if (t < 40 && w.phase === 'transport') {
      if (!BUS_Y) { for (var i = 0; i <= 20; i++) { var q = P.clone().addScaledVector(F, L(-1150, 60, i / 20)); BUS_Y = Math.max(BUS_Y, H(q.x, q.z)); } BUS_Y += 420; }
      var k = (t + 54) / 51, pos = P.clone().addScaledVector(F, L(-1150, 40, k)).addScaledVector(R, 25 + Math.max(0, t + 3) * 14);
      w._azBusOverride = {x: pos.x, y: BUS_Y + Math.max(0, t + 3) * Math.max(0, t + 3) * .5, z: pos.z, lockId: null, release: true}; busOwn = true;
      if (w.aircraft) w.aircraft.yaw = Math.atan2(-F.x, -F.z);
      if (t >= -3 && p && !p.deployed) { try { w._deployFromBus(p, false); } catch (e) {} }
    } else if (busOwn) { busOwn = false; if (w._azBusOverride && w._azBusOverride.release) delete w._azBusOverride; }
  }
  function init(a) {
    api = a; G = api.game(); on = true; PLAY = !!E.FILM_PLAY;
    P.set(SPOT.px, H(SPOT.px, SPOT.pz), SPOT.pz); BASE.set(SPOT.bx, H(SPOT.bx, SPOT.bz) + .5, SPOT.bz);
    F.set(BASE.x - P.x, 0, BASE.z - P.z).normalize(); R.crossVectors(F, UP).normalize();
    grp = new T.Group(); grp.name = 'film75'; var sc = api.scene(); if (sc) sc.add(grp);
    build(); if (PLAY) buildOldRifts();
    if (G) { prevTOD = G.timeOfDay; G.timeOfDay = 'night'; }
    hookRender();
  }
  function update() {
    if (!on) return;
    if (G) G.timeOfDay = 'night';
    var t = VT();
    if (!PLAY) holdPlayer();
    animate(t); animate2(t); animate3(t);
    if (PLAY) { playFix(t); busRoute(t); }
  }
  function dispose() {
    on = false;
    if (grp && grp.parent) grp.parent.remove(grp);
    grp = null; O = {};
    if (G && prevTOD) G.timeOfDay = prevTOD;
    if (renderer && renderer.render && renderer.render.__film) renderer.render = innerRender;
    hidden.forEach(function (o) { o.visible = true; }); hidden = [];
    var v = api && api.view(); if (v && v.environment && v.environment.clouds && v.environment.clouds.userData.filmScale) { v.environment.clouds.scale.copy(v.environment.clouds.userData.filmScale); v.environment.clouds.visible = true; delete v.environment.clouds.userData.filmScale; }
    var w2d = v && (v.worldV2 || (v.environment && v.environment.worldV2));
    if (w2d && w2d.clouds && w2d.clouds.userData.filmScale) { w2d.clouds.scale.copy(w2d.clouds.userData.filmScale); delete w2d.clouds.userData.filmScale; }
  }
  root.__filmDbg = function () { return O; };
  // outil de comparaison : cadre la caméra comme la vidéo (point de vue de la v75)
  root.__filmCamRef = function (cam) {
    var t = VT(), c = camAt(t), p = flight(t, new T.Vector3());
    var cf = dirYP(c[3], 0, new T.Vector3()), cr = new T.Vector3().crossVectors(cf, UP).normalize();
    cam.position.copy(p).addScaledVector(cf, -c[0]).addScaledVector(cr, c[2]).add(new T.Vector3(0, c[1], 0));
    var look = dirYP(c[3], c[4], new T.Vector3()); cam.lookAt(cam.position.x + look.x, cam.position.y + look.y, cam.position.z + look.z);
    cam.fov = c[5]; cam.near = .1; cam.far = 4500; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); camPos.copy(cam.position); cam.getWorldDirection(camFwd); try { placeOverlay(cam); } catch (e) {}
  };
  E.register('film75', {init: init, update: update, preUpdate: function () { if (on && !PLAY) holdPlayer(); }, dispose: dispose});
})(window);
