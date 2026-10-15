/* AZUR v81 — THE END · modèles détaillés.
 *  - flammes animées (shader de feu sur un panneau qui reste face à la caméra
 *    autour de l'axe de poussée) : orange pour la grande fusée et la
 *    météorite, bleu électrique pour les fusées des failles ;
 *  - grande fusée du lancement : étage principal à panneaux, boosters
 *    latéraux, coiffe ogivale, ailerons en flèche, tuyères, feux clignotants ;
 *  - fusées des failles : fuselage profilé blanc, bandes lumineuses bleues,
 *    hublot, ailerons, réacteur bleu incandescent ;
 *  - météorite : roche volcanique très détaillée (bruit 3D), face avant en
 *    fusion, veines de lave, éclats de cristal bleu. */
(function (root) {
  'use strict';
  var T = root.THREE, L = root.AZEnd81;
  if (!T || !L) return;
  var M = L.models = {};
  var NOISE3 = [
    'float h3(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
    'float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}',
    'float f3(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n3(p);p=p*2.07+vec3(1.3,7.1,3.7);a*=.5;}return v;}'
  ].join('\n');
  L.NOISE3 = NOISE3;

  /* ------------------------------------------------------------- flamme */
  L.flameMaterial = function (outer, inner, core) {
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, amt: { value: 1 }, seed: { value: Math.random() * 10 }, cO: { value: new T.Color(outer) }, cI: { value: new T.Color(inner) }, cC: { value: new T.Color(core) }, speed: { value: 9 } },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){vUv=uv;',
        ' vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);vec3 ax=(modelViewMatrix*vec4(0.,1.,0.,0.)).xyz;float len=length(ax);ax/=max(len,1e-5);',
        ' vec3 toC=normalize(-c.xyz);vec3 side=cross(ax,toC);float sl=length(side);side=sl>1e-4?side/sl:vec3(1.,0.,0.);',
        ' float wid=length((modelViewMatrix*vec4(1.,0.,0.,0.)).xyz);',
        ' vec3 p=c.xyz+side*position.x*wid+ax*position.y*len;gl_Position=projectionMatrix*vec4(p,1.);}'
      ].join('\n'),
      fragmentShader: [
        'varying vec2 vUv;uniform float time,amt,seed,speed;uniform vec3 cO,cI,cC;', L.NOISE,
        'void main(){float x=(vUv.x-.5)*2.;float y=vUv.y;',
        ' float n=fbm(vec2(x*2.2+seed,y*5.5-time*speed));float n2=fbm(vec2(x*5.+seed*2.,y*11.-time*speed*1.6));',
        ' float w=mix(.42,1.,pow(clamp(y*3.,0.,1.),.5))*(1.-y*.55);',
        ' float d=abs(x)+(n-.5)*.42*(.3+y);',
        ' float body=1.-smoothstep(w*.45,w,d);',
        ' float tail=1.-smoothstep(.45,1.,y+(n2-.5)*.35);',
        ' float core=(1.-smoothstep(0.,.42,abs(x)/max(w,.01)))*(1.-smoothstep(0.,.55,y+(n-.5)*.2));',
        ' vec3 col=mix(cO,cI,smoothstep(.15,.7,body*(1.-y)));col=mix(col,cC,core);',
        ' float a=body*tail*amt*(.75+.25*n2)*smoothstep(0.,.04,y);',
        ' gl_FragColor=vec4(col,clamp(a,0.,1.));}'
      ].join('\n')
    });
    m.toneMapped = false; return m;
  };
  /* Panneau de flamme : l'origine est la tuyère, la flamme s'étend vers +Y local. */
  L.flame = function (length, width, outer, inner, core) {
    var g = new T.PlaneGeometry(1, 1); g.translate(0, .5, 0);
    var m = new T.Mesh(g, L.flameMaterial(outer, inner, core)); m.scale.set(width, length, 1); m.frustumCulled = false; m.renderOrder = 9; return m;
  };

  /* ------------------------------------------------------ textures coque */
  function hullTexture(base, band, seed) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 1024; var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 512, 1024);
    var R = L.u.rng(seed || 3);
    for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(' + (R() < .5 ? '255,255,255' : '0,0,0') + ',' + (R() * .05) + ')'; g.fillRect(R() * 512, R() * 1024, 2 + R() * 40, 1 + R() * 6); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
    for (var y = 64; y < 1024; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    for (var x = 0; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.4)'; for (var r = 0; r < 300; r++) { var ry = (Math.floor(R() * 8) * 128 + 64) + (R() < .5 ? -5 : 5); g.fillRect(R() * 512, ry, 2, 2); }
    if (band) { g.fillStyle = band; [180, 560, 860].forEach(function (yy) { g.fillRect(0, yy, 512, 36); }); g.fillStyle = 'rgba(255,255,255,.18)'; [180, 560, 860].forEach(function (yy) { g.fillRect(0, yy, 512, 4); }); }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function ogive(r, h, n) { // profil de coiffe
    var pts = []; for (var i = 0; i <= n; i++) { var k = i / n; pts.push(new T.Vector2(Math.max(.001, r * Math.sqrt(1 - k * k * .98) * (1 - Math.pow(k, 6) * .9)), k * h)); } return pts;
  }
  function bell(r0, r1, h) { var pts = []; for (var i = 0; i <= 10; i++) { var k = i / 10; pts.push(new T.Vector2(r0 + (r1 - r0) * Math.pow(k, 1.8), -k * h)); } return pts; }
  function std(c, o) { o = o || {}; var m = new T.MeshStandardMaterial({ color: c, roughness: o.r == null ? .5 : o.r, metalness: o.m == null ? .3 : o.m }); if (o.map) m.map = o.map; if (o.e != null) { m.emissive = new T.Color(o.e); m.emissiveIntensity = o.ei || 1; } return m; }
  function finShape(span, root2, tip, sweep) { var s = new T.Shape(); s.moveTo(0, 0); s.lineTo(span, -sweep); s.lineTo(span, -sweep - tip); s.lineTo(0, -root2); s.lineTo(0, 0); return s; }

  /* ------------------------------------------------- grande fusée (≈ 34 m) */
  /* v85 — la fusée de la vidéo : trapue, coque graphite à panneaux, bande en
   * damier noir et blanc à la base, coiffe bleue lumineuse, tuyaux annelés noir
   * et blanc le long du fuselage, boosters latéraux et tuyères cerclées d'orange. */
  function checkerTexture() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 128; var g = c.getContext('2d');
    for (var x = 0; x < 16; x++) for (var y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#f1f2f4' : '#15171b'; g.fillRect(x * 32, y * 32, 32, 32); }
    g.fillStyle = 'rgba(0,0,0,.25)'; for (var k = 0; k < 4; k++) g.fillRect(0, k * 32, 512, 2);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function stripeTexture() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 256; var g = c.getContext('2d');
    for (var y = 0; y < 16; y++) { g.fillStyle = y % 2 ? '#e9ebee' : '#17191d'; g.fillRect(0, y * 16, 64, 16); }
    g.fillStyle = 'rgba(255,255,255,.18)'; for (var k = 0; k < 16; k++) g.fillRect(0, k * 16, 64, 2);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  M.launchRocket = function (X) {
    var g = new T.Group(), hull = hullTexture('#30353f', null, 11);
    var dark = std(0xffffff, { map: hull, r: .5, m: .55 }), graph = std(0x272b33, { r: .55, m: .6 }), black = std(0x121418, { r: .55, m: .6 }), steel = std(0x9aa3b0, { r: .3, m: .9 });
    var orange = std(0xff8a2a, { r: .4, m: .2, e: 0xff6a10, ei: 1.6 }), blueCap = std(0x5fa8ff, { r: .15, m: .1, e: 0x2f7cff, ei: 2.4 });
    // fuselage (profil tourné) : large à la base, épaule arrondie, coiffe
    var prof = [], n = 22;
    for (var i = 0; i <= n; i++) { var k = i / n, y = 1.2 + k * 25.5, r = 3.05 - .35 * k; if (k > .86) { var q = (k - .86) / .14; r *= Math.cos(q * 1.25); } prof.push(new T.Vector2(Math.max(.05, r), y)); }
    var body = new T.Mesh(new T.LatheGeometry(prof, 36), dark); g.add(body);
    var chk = new T.Mesh(new T.CylinderGeometry(3.08, 3.12, 5.2, 36, 1, true), std(0xffffff, { map: checkerTexture(), r: .55, m: .2 })); chk.position.y = 4.4; g.add(chk);
    [1.6, 7.1, 15.5].forEach(function (y) { var b = new T.Mesh(new T.TorusGeometry(3.05 - .35 * ((y - 1.2) / 25.5), .14, 6, 40), black); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); });
    // coiffe bleue lumineuse dans son anneau sombre
    var capRing = new T.Mesh(new T.TorusGeometry(1.25, .32, 10, 28), graph); capRing.rotation.x = Math.PI / 2; capRing.position.y = 26.6; g.add(capRing);
    var cap = new T.Mesh(new T.SphereGeometry(1.15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), blueCap); cap.position.y = 26.5; g.add(cap);
    g.userData.cap = cap;
    var capGlow = L.sprite(g, X.glow, 0x6fb4ff, 6, true, .55); capGlow.position.y = 27.4; g.userData.capGlow = capGlow;
    // trappes et panneaux
    for (var h = 0; h < 6; h++) { var a = h * Math.PI / 3 + .3, pn = new T.Mesh(new T.BoxGeometry(1.1, 2.2, .12), graph); pn.position.set(Math.cos(a) * 2.86, 12 + (h % 3) * 3.4, Math.sin(a) * 2.86); pn.rotation.y = -a + Math.PI / 2; g.add(pn); }
    // tuyaux annelés noir/blanc le long du fuselage
    var stripes = stripeTexture();
    [-1, 1].forEach(function (s) {
      var cv = new T.CatmullRomCurve3([new T.Vector3(s * 2.55, 22, .4), new T.Vector3(s * 3.6, 18.5, .9), new T.Vector3(s * 3.9, 12, 1.1), new T.Vector3(s * 3.55, 6.5, .9), new T.Vector3(s * 3.25, 3.4, .6)]);
      var tm = std(0xffffff, { map: stripes.clone(), r: .5, m: .1 }); tm.map.repeat.set(1, 7); tm.map.needsUpdate = true;
      var tube = new T.Mesh(new T.TubeGeometry(cv, 40, .34, 8, false), tm); g.add(tube);
      var cv2 = new T.CatmullRomCurve3([new T.Vector3(s * 2.2, 20.5, -1.2), new T.Vector3(s * 3.3, 15, -1.6), new T.Vector3(s * 3.4, 9, -1.4), new T.Vector3(s * 3.1, 4, -1)]);
      var tube2 = new T.Mesh(new T.TubeGeometry(cv2, 32, .28, 8, false), tm); g.add(tube2);
    });
    // boosters latéraux
    [-1, 1].forEach(function (s) {
      var b = new T.Group(); b.position.set(0, 0, s * 3.9); g.add(b);
      var bb = new T.Mesh(new T.CylinderGeometry(1.15, 1.2, 12, 22), dark); bb.position.y = 7.2; b.add(bb);
      var bn = new T.Mesh(new T.LatheGeometry(ogive(1.15, 2.6, 12), 22), graph); bn.position.y = 13.2; b.add(bn);
      var bnoz = new T.Mesh(new T.LatheGeometry(bell(.6, 1.0, 1.6), 18), black); bnoz.position.y = 1.2; b.add(bnoz);
      var br = new T.Mesh(new T.TorusGeometry(1.0, .16, 8, 26), orange); br.rotation.x = Math.PI / 2; br.position.y = -.35; b.add(br);
      var strut = new T.Mesh(new T.BoxGeometry(.35, .35, 1.4), steel); strut.position.set(0, 11.5, -s * 1.1); b.add(strut);
      var strut2 = strut.clone(); strut2.position.y = 3.2; b.add(strut2);
      var fl = L.flame(9, 2.1, 0xff6a1e, 0xffb048, 0xfff2c8); fl.rotation.x = Math.PI; fl.position.y = -.2; b.add(fl); (g.userData.flames = g.userData.flames || []).push(fl);
    });
    // tuyère principale cerclée d'orange
    var noz = new T.Mesh(new T.LatheGeometry(bell(1.4, 2.25, 2.4), 28), std(0x24262c, { r: .35, m: .85 })); noz.position.y = 1.3; g.add(noz);
    var ring = new T.Mesh(new T.TorusGeometry(2.25, .2, 8, 40), orange); ring.rotation.x = Math.PI / 2; ring.position.y = -1.05; g.add(ring);
    var ring2 = new T.Mesh(new T.TorusGeometry(3.1, .16, 6, 40), orange); ring2.rotation.x = Math.PI / 2; ring2.position.y = 1.25; g.add(ring2);
    // feux
    g.userData.lights = [];
    [[0, 22.5, 2.75, 0xff3030], [0, 22.5, -2.75, 0xff3030], [2.8, 10, 0, 0xffd040], [-2.8, 10, 0, 0xffd040]].forEach(function (l) { var s2 = L.sprite(g, X.glow, l[3], 1.8, true, .9); s2.position.set(l[0], l[1], l[2]); g.userData.lights.push(s2); });
    // flamme principale + lueurs
    var f = L.flame(26, 4.8, 0xff5a12, 0xffa23a, 0xfff6d8); f.rotation.x = Math.PI; f.position.y = -1.2; g.add(f);
    var fc = L.flame(12, 2.3, 0xffd890, 0xffeec0, 0xffffff); fc.rotation.x = Math.PI; fc.position.y = -1.2; g.add(fc);
    g.userData.flames = (g.userData.flames || []).concat([f, fc]); g.userData.flame = f; g.userData.core = fc;
    g.userData.glow = L.sprite(g, X.glow, 0xffa64a, 60, true, 0); g.userData.glow.position.y = -4;
    g.userData.glow2 = L.sprite(g, X.soft, 0xff7a30, 160, true, 0); g.userData.glow2.position.y = -9;
    g.traverse(function (o) { if (o.isMesh && !(o.material && o.material.isShaderMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  /* --------------------------------------- fusée des failles (≈ 11 m × s) */
  var riftShared = null;
  function riftParts() {
    if (riftShared) return riftShared;
    var prof = [new T.Vector2(.001, -4.6), new T.Vector2(.85, -4.5), new T.Vector2(1.05, -4.1), new T.Vector2(1.12, -2), new T.Vector2(1.12, 1.6), new T.Vector2(1.06, 2.6), new T.Vector2(.92, 3.6), new T.Vector2(.68, 4.6), new T.Vector2(.38, 5.5), new T.Vector2(.12, 6.1), new T.Vector2(.001, 6.25)];
    var body = new T.LatheGeometry(prof, 24);
    var hull = hullTexture('#eef2f7', 'rgba(36,44,60,.8)', 23);
    riftShared = {
      body: body, hullMat: std(0xffffff, { map: hull, r: .35, m: .35 }),
      bandGeo: new T.CylinderGeometry(1.15, 1.15, .45, 24, 1, true), bandMat: std(0x6fd0ff, { r: .3, m: .2, e: 0x2fa8ff, ei: 2.2 }),
      finGeo: new T.ExtrudeGeometry(finShape(1.6, 2.6, 1.0, 1.4), { depth: .14, bevelEnabled: false }), finMat: std(0x252c3c, { r: .5, m: .6 }),
      winGeo: new T.SphereGeometry(.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), winMat: std(0x0f2236, { r: .08, m: .9, e: 0x1a5f9a, ei: .5 }),
      nozGeo: new T.LatheGeometry(bell(.55, .9, 1.1), 18), nozMat: std(0x2a2d34, { r: .35, m: .85 }),
      coreGeo: new T.CircleGeometry(.62, 18), coreMat: new T.MeshBasicMaterial({ color: 0xc8f2ff, fog: false })
    };
    return riftShared;
  }
  M.riftRocket = function (X, scale) {
    var S = riftParts(), g = new T.Group();
    g.add(new T.Mesh(S.body, S.hullMat));
    [-1.3, 2.2].forEach(function (y) { var b = new T.Mesh(S.bandGeo, S.bandMat); b.position.y = y; g.add(b); });
    for (var k = 0; k < 3; k++) { var piv = new T.Group(); piv.rotation.y = k * Math.PI * 2 / 3; var f = new T.Mesh(S.finGeo, S.finMat); f.position.set(.95, -2.4, -.07); piv.add(f); g.add(piv); }
    var w = new T.Mesh(S.winGeo, S.winMat); w.rotation.x = Math.PI / 2; w.position.set(0, 3.6, .9); g.add(w);
    var n = new T.Mesh(S.nozGeo, S.nozMat); n.position.y = -4.5; g.add(n);
    var c = new T.Mesh(S.coreGeo, S.coreMat); c.rotation.x = Math.PI / 2; c.position.y = -5.55; g.add(c);
    var fl = L.flame(10, 2.2, 0x2a7dff, 0x7fd0ff, 0xf0fbff); fl.rotation.x = Math.PI; fl.position.y = -5.4; fl.material.uniforms.speed.value = 14; g.add(fl);
    var gl = L.sprite(g, X.glow, 0x8fd8ff, 9, true, .95); gl.position.y = -6; gl.visible = true;
    g.userData.flame = fl; g.userData.glow = gl;
    g.scale.setScalar(scale || 1); return g;
  };

  /* -------------------------------------------------------- météorite */
  var ROCK_VS = 'varying vec3 vN;varying vec3 vP;varying vec3 vW;void main(){vP=position;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}';
  var ROCK_FS = [
    'varying vec3 vN;varying vec3 vP;varying vec3 vW;uniform vec3 lightDir,front,rimCol,camPos;uniform float heat,time,pale,energy;', NOISE3,
    'void main(){vec3 n=normalize(vN);vec3 v=normalize(camPos-vW);',
    ' float d=max(dot(n,normalize(lightDir)),0.);',
    ' vec3 q=vP*2.4;float k=f3(q);float k2=f3(q*2.7+5.);',
    ' vec3 rock=mix(vec3(.10,.085,.10),vec3(.30,.25,.28),smoothstep(.3,.75,k))*(1.-.35*smoothstep(.55,.8,k2));',
    ' float fr=dot(normalize(vP),normalize(front));float frontK=smoothstep(-.15,.8,fr);',
    ' float vein=1.-smoothstep(.0,.045,abs(n3(q*1.6+vec3(time*.02))-.5));vein*=.4+.6*smoothstep(.2,.7,k2);',
    ' float molten=smoothstep(.35,.95,fr)*(.55+.45*k2);',
    ' vec3 lava=vec3(1.,.38,.08)*vein*(.25+1.4*frontK)+vec3(1.,.66,.25)*molten*1.6+vec3(1.,.9,.6)*pow(molten,3.)*1.2;',
    ' float rim=pow(1.-max(dot(n,v),0.),3.);',
    ' vec3 c=rock*(.16+.95*d)+lava*heat+rimCol*rim*(.35+energy*1.2);',
    ' c=mix(c,vec3(.96,.88,.97)*(.6+.4*d),pale*.55);',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');
  function displaceRock(geo, seed) {
    var pa = geo.attributes.position, v = new T.Vector3();
    for (var i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      var n = L.fbm2(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.2, seed, 5), r = L.fbm2(v.z * 3.1 + seed * 2, v.x * 3.1 - v.y, seed + 4, 3);
      var ridge = 1 - Math.abs(r * 2 - 1);
      v.multiplyScalar(.72 + n * .55 + ridge * .08);
      pa.setXYZ(i, v.x * 1.18, v.y * .82, v.z * .96);
    }
    geo.computeVertexNormals(); return geo;
  }
  M.meteorRock = function (radius, seed, detail) {
    var geo = displaceRock(new T.IcosahedronGeometry(1, detail == null ? 5 : detail), seed || 2.7);
    var m = new T.Mesh(geo, new T.ShaderMaterial({
      uniforms: { lightDir: { value: new T.Vector3(0, 1, 0) }, front: { value: new T.Vector3(0, -1, 0) }, rimCol: { value: new T.Color(0x4aa8ff) }, camPos: { value: new T.Vector3() }, heat: { value: 1 }, time: { value: 0 }, pale: { value: 0 }, energy: { value: 0 } },
      vertexShader: ROCK_VS, fragmentShader: ROCK_FS }));
    m.scale.setScalar(radius); m.frustumCulled = false; return m;
  };
  /* éclats de cristal bleu qui flottent autour de la traîne */
  M.crystal = function () {
    var geo = new T.OctahedronGeometry(1, 0); geo.scale(.35, 1.6, .35);
    var m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    m.material.toneMapped = false; return m;
  };

  /* v85 — L'ÎLE FLOTTANTE de la vidéo : une petite île de roche à plateau herbeux
   * (cabane, mât, buissons) dont le dessous en cône de roche se prolonge par une
   * énorme grappe de cristaux roses/magenta lumineux pointés vers le bas.
   * Modèle unitaire : plateau de rayon 1 (≈ 2 de large), pointe à -1,75. */
  M.floatingIsland = function (X) {
    var g = new T.Group(), R = L.u.rng(808);
    var grass = std(0x4f9a45, { r: .95, m: 0 }), grass2 = std(0x6db454, { r: .95, m: 0 }), rock = std(0x6a5a52, { r: 1, m: 0 }), rock2 = std(0x4b4048, { r: 1, m: 0 });
    // plateau : disque irrégulier (dessus herbeux un peu bombé)
    var top = new T.CylinderGeometry(1, .92, .16, 26, 2), tp = top.attributes.position, v = new T.Vector3();
    for (var i = 0; i < tp.count; i++) { v.fromBufferAttribute(tp, i); var a = Math.atan2(v.z, v.x), rr = 1 + .1 * Math.sin(a * 3 + 1) + .06 * Math.sin(a * 7); if (Math.hypot(v.x, v.z) > .05) { v.x *= rr; v.z *= rr; } if (v.y > 0) v.y += .05 * (1 - Math.hypot(v.x, v.z)); tp.setXYZ(i, v.x, v.y, v.z); }
    top.computeVertexNormals(); var deck = new T.Mesh(top, grass); g.add(deck);
    // dessous : cône de roche facetté
    var cone = new T.ConeGeometry(1.02, .95, 18, 5, true), cp = cone.attributes.position;
    for (var j = 0; j < cp.count; j++) { v.fromBufferAttribute(cp, j); var k = (v.y + .475) / .95, n = .82 + .3 * L.fbm2(v.x * 3 + 2, v.z * 3 + v.y * 2, 3, 3); v.x *= n; v.z *= n; cp.setXYZ(j, v.x, v.y, v.z); }
    cone.computeVertexNormals(); cone.rotateX(Math.PI); var under = new T.Mesh(cone, rock); under.position.y = -.53; g.add(under);
    var ledge = new T.Mesh(new T.CylinderGeometry(1.04, 1.0, .12, 26), rock2); ledge.position.y = -.12; g.add(ledge);
    // grappe de cristaux magenta (pointes vers le bas)
    var cm = std(0xff4fd8, { r: .2, m: .1, e: 0xd21ea8, ei: 2.2 }); cm.transparent = true; cm.opacity = .95;
    var cm2 = std(0xffa0ee, { r: .15, m: .1, e: 0xff5ad0, ei: 2.6 });
    var crys = new T.Group(); crys.position.y = -.9; g.add(crys); g.userData.crystals = crys;
    var main = new T.Mesh(new T.OctahedronGeometry(1, 0), cm); main.scale.set(.42, .85, .42); main.position.y = -.25; crys.add(main);
    for (var c = 0; c < 9; c++) {
      var an = c / 9 * Math.PI * 2 + R() * .4, rad = .22 + R() * .28, len = .35 + R() * .45;
      var cg = new T.OctahedronGeometry(1, 0); var cr = new T.Mesh(cg, c % 3 ? cm : cm2); cr.scale.set(.1 + R() * .08, len, .1 + R() * .08);
      cr.position.set(Math.cos(an) * rad, -.05 - len * .45, Math.sin(an) * rad); cr.rotation.set(Math.sin(an) * .35, R() * 3, -Math.cos(an) * .35); crys.add(cr);
    }
    var glow = L.sprite(g, X.soft, 0xff3fd0, 2.6, true, .55); glow.position.y = -1.15; g.userData.glow = glow;
    var glow2 = L.sprite(g, X.glow, 0xffb0f0, .9, true, .7); glow2.position.y = -1.5; g.userData.glow2 = glow2;
    // cabane + mât + buissons sur le plateau
    var wall = std(0xb8b4ae, { r: .9, m: 0 }), roofM = std(0x3b4656, { r: .8, m: .2 });
    var hut = new T.Mesh(new T.BoxGeometry(.32, .18, .24), wall); hut.position.set(.12, .17, -.05); g.add(hut);
    var roof = new T.Mesh(new T.ConeGeometry(.25, .12, 4), roofM); roof.rotation.y = Math.PI / 4; roof.position.set(.12, .32, -.05); g.add(roof);
    var mast = new T.Mesh(new T.CylinderGeometry(.012, .016, .5, 6), std(0x9aa3b0, { r: .4, m: .8 })); mast.position.set(-.18, .33, .1); g.add(mast);
    var dish = new T.Mesh(new T.SphereGeometry(.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd8dde4, { r: .4, m: .5 })); dish.rotation.x = Math.PI * .65; dish.position.set(-.18, .52, .1); g.add(dish);
    for (var b = 0; b < 7; b++) { var bx = new T.Mesh(new T.IcosahedronGeometry(.07 + R() * .06, 0), b % 2 ? grass : grass2); var ba = R() * 6.28, bd = .45 + R() * .45; bx.position.set(Math.cos(ba) * bd, .12, Math.sin(ba) * bd); g.add(bx); }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    return g;
  };

  /* v85 — le Battle Bus BLEU de la fin (aspiré par le tourbillon), sans ballon :
   * carrosserie bleue arrondie, toit blanc, vitres sombres, calandre et phares. */
  M.battleBus = function (X) {
    var g = new T.Group();
    var blue = std(0x2a6fe0, { r: .45, m: .35 }), blue2 = std(0x1c4ea8, { r: .5, m: .3 }), white = std(0xe9eef4, { r: .5, m: .2 }), glass = std(0x0c1626, { r: .1, m: .8, e: 0x0a2a4a, ei: .4 }), black = std(0x15171b, { r: .7, m: .3 }), chrome = std(0xc8d0da, { r: .25, m: .9 });
    var body = new T.Mesh(new T.BoxGeometry(2.5, 2.3, 9.6), blue); body.position.y = 1.85; g.add(body);
    var skirt = new T.Mesh(new T.BoxGeometry(2.56, .5, 9.7), blue2); skirt.position.y = .85; g.add(skirt);
    var roof = new T.Mesh(new T.CylinderGeometry(1.3, 1.3, 9.4, 18, 1, false, -Math.PI / 2, Math.PI), white); roof.rotation.x = Math.PI / 2; roof.rotation.z = Math.PI / 2; roof.scale.set(.96, 1, .38); roof.position.y = 3.0; g.add(roof);
    for (var i = 0; i < 6; i++) { [-1, 1].forEach(function (s) { var w = new T.Mesh(new T.BoxGeometry(.06, .85, 1.2), glass); w.position.set(s * 1.27, 2.3, -3.6 + i * 1.45); g.add(w); }); }
    var wind = new T.Mesh(new T.BoxGeometry(2.2, 1.0, .06), glass); wind.position.set(0, 2.35, 4.82); g.add(wind);
    var grill = new T.Mesh(new T.BoxGeometry(1.6, .55, .08), chrome); grill.position.set(0, 1.2, 4.84); g.add(grill);
    [-1, 1].forEach(function (s) { var hl = L.sprite(g, X.glow, 0xffe2a0, 1.1, true, .9); hl.position.set(s * .95, 1.25, 4.95); });
    [[-1, 3.2], [1, 3.2], [-1, -3.0], [1, -3.0]].forEach(function (w) { var wh = new T.Mesh(new T.CylinderGeometry(.62, .62, .45, 16), black); wh.rotation.z = Math.PI / 2; wh.position.set(w[0] * 1.2, .55, w[1]); g.add(wh); });
    var stripe = new T.Mesh(new T.BoxGeometry(2.53, .14, 9.62), white); stripe.position.y = 1.45; g.add(stripe);
    g.scale.setScalar(2.2);
    g.traverse(function (o) { if (o.isMesh) o.frustumCulled = false; });
    return g;
  };
})(window);
