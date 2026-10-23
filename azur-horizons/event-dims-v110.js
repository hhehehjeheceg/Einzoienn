/* AZUR v110 — event-dims-v110.js : LES DIMENSIONS derrière les portails du monde des failles.
 * Entré dans un portail, on arrive dans un vrai petit monde où l'on marche, court et saute :
 *  0 désert (dunes, pyramides, cactus, soleil blanc)      4 ville de nuit (rues, immeubles éclairés, néons, lampadaires)
 *  1 océan (îlots de sable, lagon, palmiers, phare)        5 jungle (collines, grands arbres, fleurs géantes, lucioles)
 *  2 lave (roche noire, rivières de lave qui font rebondir, volcan)  6 espace (sol gris à cratères, gravité faible, planète à anneaux)
 *  3 glace (neige, pics de glace, lac gelé, aurores)       7 bonbon (sucettes, bonbons géants, sucres d'orge, arc-en-ciel)
 * Le portail de retour reste ouvert derrière nous : on y rentre pour revenir dans le monde des failles.
 * Une brume colorée marque le bord du monde (on la voit : pas de mur invisible caché).
 * Construit à la demande (un seul monde à la fois), très haut au-dessus de la carte, puis jeté au retour. */
(function (root) {
  "use strict";
  var T = root.THREE, L = root.AZEnd81;
  if (!T) return;
  var TAU = Math.PI * 2;
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sm(x) { x = cl(x); return x * x * (3 - 2 * x); }
  function hs(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function h2(x, z) { var v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); }
  function vn(x, z) { var ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    var a = h2(ix, iz), b = h2(ix + 1, iz), c = h2(ix, iz + 1), d = h2(ix + 1, iz + 1); return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz; }
  function fbm(x, z) { return .55 * vn(x, z) + .28 * vn(x * 2.03 + 5.2, z * 2.03 + 1.3) + .14 * vn(x * 4.1 + 9.7, z * 4.1 + 3.1); }
  function rng(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  var NAMES = ["Désert", "Océan", "Lave", "Glace", "Ville de nuit", "Jungle", "Espace", "Monde bonbon"];
  var RADIUS = 236, ORIGIN = new T.Vector3(0, 9000, 0); // très haut au-dessus de la carte : rien d'autre à l'écran

  // ------------------------------------------------------------- matériaux
  function lam(c, e, o) { o = o || {}; var m = new T.MeshLambertMaterial({ color: c, fog: false, transparent: !!o.tr, opacity: o.op == null ? 1 : o.op, side: o.ds ? T.DoubleSide : T.FrontSide });
    if (e) { m.emissive = new T.Color(c).multiplyScalar(e); } if (o.map) m.map = o.map; return m; }
  function glowMat(c, op) { var m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }); m.toneMapped = false; return m; }
  function canvasTex(w, h, fn) { var c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t; }

  // ciel : dégradé, astre, étoiles, nuages, aurore (selon le monde)
  var SKY_FS = [
    "varying vec3 vD;uniform float time,stars,aur,clouds;uniform vec3 top,bot,sunC,sunD;uniform float sunS;",
    "float h3(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "void main(){vec3 d=normalize(vD);float h=d.y;vec3 c=mix(bot,top,smoothstep(-.05,.7,h));",
    " float sd=max(dot(d,normalize(sunD)),0.);c+=sunC*(smoothstep(1.-sunS*.0006,1.-sunS*.0003,sd)*1.4+pow(sd,60.)*.5+pow(sd,6.)*.15);",
    " float st=step(.996,h3(floor(d*420.)))*smoothstep(0.,.3,h);c+=vec3(st)*stars;",
    " float cl=n3(vec3(d.x*3.+time*.01,d.y*7.,d.z*3.))*.6+n3(vec3(d.x*7.,d.y*14.,d.z*7.+time*.02))*.4;c=mix(c,vec3(1.),smoothstep(.55,.8,cl)*smoothstep(.0,.25,h)*clouds*.7);",
    " float ar=sin(d.x*6.+time*.3+sin(d.z*4.+time*.2)*2.)*.5+.5;c+=vec3(.2,1.,.6)*pow(ar,6.)*smoothstep(.15,.45,h)*(1.-smoothstep(.6,.9,h))*aur;",
    " gl_FragColor=vec4(c,1.);}"].join("\n");
  function sky(top, bot, sunC, sunD, o) {
    o = o || {};
    var m = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { time: { value: 0 }, stars: { value: o.stars || 0 }, aur: { value: o.aur || 0 }, clouds: { value: o.clouds == null ? 1 : o.clouds },
      top: { value: new T.Color(top) }, bot: { value: new T.Color(bot) }, sunC: { value: new T.Color(sunC) }, sunD: { value: new T.Vector3().copy(sunD) }, sunS: { value: o.sunS || 30 } },
      vertexShader: "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: SKY_FS });
    var s = new T.Mesh(new T.SphereGeometry(850, 48, 24), m); s.frustumCulled = false; s.renderOrder = -1; return s;
  }
  // eau / lave animées (plan)
  var LIQ_FS = [
    "varying vec2 vP;uniform float time,lava;uniform vec3 deep,shal,foam;",
    "float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}",
    "void main(){vec2 p=vP*.08;float w=n2(p+vec2(time*.15,time*.1))*.6+n2(p*2.3-vec2(time*.12,0.))*.4;",
    " vec3 c=mix(deep,shal,w);float f=smoothstep(.72,.9,w);c=mix(c,foam,f*.6);",
    " if(lava>.5){float cr=pow(1.-abs(n2(p*1.7+time*.05)-.5)*2.,6.);c=mix(deep,shal,w)+foam*cr*1.4;}",
    " gl_FragColor=vec4(c,lava>.5?1.:.82);}"].join("\n");
  function liquid(size, y, deep, shal, foam, isLava) {
    var m = new T.ShaderMaterial({ transparent: !isLava, depthWrite: !!isLava, fog: false, uniforms: { time: { value: 0 }, lava: { value: isLava ? 1 : 0 }, deep: { value: new T.Color(deep) }, shal: { value: new T.Color(shal) }, foam: { value: new T.Color(foam) } },
      vertexShader: "varying vec2 vP;void main(){vP=(modelMatrix*vec4(position,1.)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: LIQ_FS });
    m.toneMapped = false;
    var g = new T.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2); var q = new T.Mesh(g, m); q.position.y = y; q.frustumCulled = false; return q;
  }
  // brume du bord du monde
  function mist(col) {
    var m = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false, uniforms: { time: { value: 0 }, col: { value: new T.Color(col) } },
      vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying vec2 vU;uniform float time;uniform vec3 col;void main(){float a=(1.-vU.y)*(.55+.25*sin(vU.x*60.+time*.8));gl_FragColor=vec4(col*a,a);}" });
    var c = new T.Mesh(new T.CylinderGeometry(RADIUS + 8, RADIUS + 8, 90, 96, 1, true), m); c.position.y = 30; c.frustumCulled = false; return c;
  }

  // ------------------------------------------------------------- les mondes
  // chaque monde : relief h(x,z), couleur du sol, décor, obstacles (cercles et boîtes), gravité
  function world(kind, X) {
    var D = { kind: kind, name: NAMES[kind], g: new T.Group(), keep: [], circ: [], box: [], grav: 18, jump: 7.4, upd: [], lava: null, bounce: false };
    var g = D.g, R = rng(1000 + kind * 77);
    function add(o) { g.add(o); o.traverse(function (c) { c.frustumCulled = false; if (c.geometry) D.keep.push(c.geometry); if (c.material) D.keep.push(c.material); }); return o; }
    function flat(x, z, h) { var r = Math.hypot(x, z - 6); return h * sm((r - 14) / 18); } // place nette autour de l'arrivée et du portail
    function circ(x, z, r, top) { D.circ.push({ x: x, z: z, r: r, top: top == null ? 1e9 : top }); }
    function box(x, z, hw, hd, top) { D.box.push({ x: x, z: z, hw: hw, hd: hd, top: top == null ? 1e9 : top }); }
    function spot(minR, maxR) { for (var i = 0; i < 40; i++) { var a = R() * TAU, r = minR + R() * (maxR - minR), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x, z - 6) > 26) return [x, z]; } return [minR, 0]; }
    var H, COL, sun = new T.Vector3(.4, .6, -.7), skyM;
    if (kind === 0) { // désert
      H = function (x, z) { return flat(x, z, 5 * Math.sin(x * .028 + 1) * Math.cos(z * .022) + 4 * fbm(x * .02, z * .02) - 2); };
      COL = function (x, z, h) { var v = .9 + .1 * fbm(x * .3, z * .3); return [0.95 * v, 0.76 * v + h * .004, 0.48 * v]; };
      skyM = sky(0x5aa8ff, 0xffe0a8, 0xfff8e0, sun, { clouds: .3, sunS: 60 });
      for (var p = 0; p < 3; p++) { var sp = spot(110, 200), s = 26 + R() * 26, py = new T.Mesh(new T.ConeGeometry(s, s * 1.15, 4), lam(0xe0b870, .08)); py.rotation.y = Math.PI / 4; py.position.set(sp[0], H(sp[0], sp[1]) + s * .5, sp[1]); add(py); circ(sp[0], sp[1], s * .75, H(sp[0], sp[1]) + s); }
      for (var c = 0; c < 34; c++) { var sc = spot(30, 220), cg = new T.Group(), cm = lam(0x3f8f43, .1), hh = 3 + R() * 3; var tk = new T.Mesh(new T.CylinderGeometry(.45, .55, hh, 8), cm); tk.position.y = hh / 2; cg.add(tk);
        for (var a = 0; a < 2; a++) { var arm = new T.Mesh(new T.CylinderGeometry(.3, .3, 1.6, 7), cm); arm.position.set(a ? .8 : -.8, hh * .55 + .5, 0); cg.add(arm); var el = new T.Mesh(new T.CylinderGeometry(.3, .3, .9, 7), cm); el.rotation.z = Math.PI / 2; el.position.set(a ? .45 : -.45, hh * .55 - .2, 0); cg.add(el); }
        cg.position.set(sc[0], H(sc[0], sc[1]), sc[1]); cg.rotation.y = R() * TAU; add(cg); circ(sc[0], sc[1], .8); }
      for (var rk = 0; rk < 20; rk++) { var rs = spot(25, 230), rr = 1 + R() * 3, ro = new T.Mesh(new T.DodecahedronGeometry(rr, 0), lam(0xb88a5a, .05)); ro.position.set(rs[0], H(rs[0], rs[1]) + rr * .4, rs[1]); ro.rotation.set(R() * 3, R() * 3, 0); add(ro); circ(rs[0], rs[1], rr * .9, H(rs[0], rs[1]) + rr * 1.2); }
    } else if (kind === 1) { // océan : îlots de sable dans un lagon (on y marche, l'eau à la taille entre les îles)
      var isl = [[0, 4, 46]]; for (var i2 = 0; i2 < 7; i2++) { var s2 = spot(70, 200); isl.push([s2[0], s2[1], 16 + R() * 26]); }
      H = function (x, z) { var m = -1.3 + .3 * fbm(x * .05, z * .05); for (var k = 0; k < isl.length; k++) { var d = Math.hypot(x - isl[k][0], z - isl[k][1]); m = Math.max(m, 2.2 * (1 - d / isl[k][2]) + .6 * fbm(x * .1, z * .1)); } return m; };
      COL = function (x, z, h) { return h > .4 ? [0.96, 0.88, 0.66] : h > -.4 ? [0.85, 0.8, 0.6] : [0.55, 0.7, 0.65]; };
      skyM = sky(0x3f9cff, 0xbfe8ff, 0xfffbe8, sun, { clouds: 1 });
      var wat = liquid(RADIUS * 2.4, 0, 0x0a5fa0, 0x39c6e0, 0xffffff, false); add(wat); D.upd.push(function (t) { wat.material.uniforms.time.value = t; });
      for (var pl = 0; pl < 22; pl++) { var ii = isl[pl % isl.length], an = R() * TAU, dd = ii[2] * (.2 + R() * .5), px = ii[0] + Math.cos(an) * dd, pz = ii[1] + Math.sin(an) * dd; if (Math.hypot(px, pz - 6) < 20) continue;
        var pg = new T.Group(), trunk = lam(0x8a6a44, .1), hh2 = 6 + R() * 4; for (var sg = 0; sg < 5; sg++) { var seg = new T.Mesh(new T.CylinderGeometry(.28, .34, hh2 / 5, 7), trunk); seg.position.set(sg * sg * .07, hh2 / 5 * (sg + .5), 0); pg.add(seg); }
        for (var lf = 0; lf < 6; lf++) { var leaf = new T.Mesh(new T.ConeGeometry(.6, 4, 4), lam(0x3fae55, .15, { ds: true })); leaf.scale.set(1, 1, .25); leaf.position.set(1.1, hh2, 0); leaf.rotation.set(0, lf / 6 * TAU, -1.2); var lg = new T.Group(); lg.add(leaf); lg.rotation.y = lf / 6 * TAU; lg.position.set(1.1, 0, 0); pg.add(lg); }
        pg.position.set(px, H(px, pz), pz); pg.rotation.y = R() * TAU; add(pg); circ(px, pz, .6); }
      var lh = new T.Group(); for (var b = 0; b < 6; b++) { var band = new T.Mesh(new T.CylinderGeometry(2.6 - b * .2, 2.8 - b * .2, 3, 16), lam(b % 2 ? 0xffffff : 0xe03a3a, .15)); band.position.y = 1.5 + b * 3; lh.add(band); }
      var lamp = new T.Mesh(new T.SphereGeometry(1.4, 12, 8), lam(0xfff1a0, 1.2)); lamp.position.y = 19.5; lh.add(lamp); var lsp = isl[1]; lh.position.set(lsp[0], H(lsp[0], lsp[1]), lsp[1]); add(lh); circ(lsp[0], lsp[1], 3);
    } else if (kind === 2) { // lave
      H = function (x, z) { var r = fbm(x * .02, z * .02), rv = Math.abs(fbm(x * .012 + 4, z * .012 + 7) - .5); var h = 7 * r - 2; if (rv < .06) h = Math.min(h, -1.6 + rv * 10); return flat(x, z, h); };
      COL = function (x, z, h) { var v = .18 + .1 * fbm(x * .4, z * .4); return h < -.8 ? [0.35, 0.1, 0.05] : [v, v * .85, v * .8]; };
      skyM = sky(0x2a0606, 0x8a2a10, 0xff7a30, new T.Vector3(.2, .25, -1), { clouds: .6, sunS: 90 });
      D.lava = -.5; var lv = liquid(RADIUS * 2.4, -.5, 0x7a1404, 0xff5a10, 0xffd070, true); add(lv); D.upd.push(function (t) { lv.material.uniforms.time.value = t; }); D.bounce = true;
      var vol = new T.Mesh(new T.ConeGeometry(90, 110, 24, 1, true), lam(0x2a201c, .05, { ds: true })); vol.position.set(-60, 50, -190); add(vol); circ(-60, -190, 80);
      var crater = new T.Mesh(new T.CircleGeometry(16, 24), glowMat(0xff6a20, .9)); crater.rotation.x = -Math.PI / 2; crater.position.set(-60, 104, -190); add(crater);
      for (var sp2 = 0; sp2 < 26; sp2++) { var s3 = spot(30, 225), hh3 = 4 + R() * 12, sp3 = new T.Mesh(new T.ConeGeometry(1.2 + R() * 1.5, hh3, 5), lam(0x15101a, .05)); sp3.position.set(s3[0], H(s3[0], s3[1]) + hh3 / 2, s3[1]); add(sp3); circ(s3[0], s3[1], 1.4, H(s3[0], s3[1]) + hh3); }
      var EN = 500, ep = new Float32Array(EN * 3); for (var e = 0; e < EN; e++) { ep[e * 3] = (R() - .5) * 460; ep[e * 3 + 1] = R() * 60; ep[e * 3 + 2] = (R() - .5) * 460; }
      var eg = new T.BufferGeometry(); eg.setAttribute("position", new T.BufferAttribute(ep, 3)); var emb = new T.Points(eg, new T.PointsMaterial({ color: 0xffa040, size: .45, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, fog: false })); add(emb);
      D.upd.push(function (t) { emb.position.y = (t * 3) % 60 - 20; });
    } else if (kind === 3) { // glace
      H = function (x, z) { var r = Math.hypot(x - 60, z + 40); var h = 9 * fbm(x * .015, z * .015) - 2; if (r < 45) h = Math.min(h, -.2); return flat(x, z, h); };
      COL = function (x, z, h) { return h < 0 ? [0.72, 0.86, 0.98] : [0.95, 0.97, 1.0]; };
      skyM = sky(0x0a1a4a, 0x5a7ab8, 0xdfe8ff, new T.Vector3(-.5, .35, -.6), { stars: .9, aur: 1, clouds: .2 });
      var ice = new T.Mesh(new T.CircleGeometry(45, 40), lam(0xbfe8ff, .25, { tr: true, op: .85 })); ice.rotation.x = -Math.PI / 2; ice.position.set(60, -.15, -40); add(ice);
      for (var sp4 = 0; sp4 < 40; sp4++) { var s4 = spot(30, 228), hh4 = 4 + R() * 14, ic = new T.Mesh(new T.ConeGeometry(1 + R() * 2, hh4, 6), lam(0x9fdcff, .45, { tr: true, op: .85 })); ic.position.set(s4[0], H(s4[0], s4[1]) + hh4 / 2 - .5, s4[1]); ic.rotation.z = (R() - .5) * .3; add(ic); circ(s4[0], s4[1], 1.3, H(s4[0], s4[1]) + hh4); }
      var igl = new T.Mesh(new T.SphereGeometry(5, 16, 10, 0, TAU, 0, Math.PI / 2), lam(0xffffff, .2)); igl.position.set(-40, H(-40, 30), 30); add(igl); circ(-40, 30, 5.2);
      var SN = 900, snp = new Float32Array(SN * 3); for (var q = 0; q < SN; q++) { snp[q * 3] = (R() - .5) * 200; snp[q * 3 + 1] = R() * 60; snp[q * 3 + 2] = (R() - .5) * 200; }
      var sng = new T.BufferGeometry(); sng.setAttribute("position", new T.BufferAttribute(snp, 3)); var snow = new T.Points(sng, new T.PointsMaterial({ color: 0xffffff, size: .35, transparent: true, opacity: .9, depthWrite: false, fog: false })); add(snow);
      D.upd.push(function (t, me) { snow.position.set(me ? me.x : 0, 60 - (t * 4) % 60 - 30, me ? me.z : 0); });
    } else if (kind === 4) { // ville de nuit
      H = function () { return 0; };
      COL = function (x, z) { var gx = Math.abs(((x + 1000) % 54) - 27), gz = Math.abs(((z + 1000) % 54) - 27); var road = gx > 20 || gz > 20, line = (gx > 26.6 || gz > 26.6); return line ? [0.9, 0.75, 0.2] : road ? [0.12, 0.12, 0.15] : [0.32, 0.32, 0.36]; };
      skyM = sky(0x020414, 0x1a1040, 0xe8ecff, new T.Vector3(.5, .45, -.6), { stars: 1, clouds: .15, sunS: 25 });
      var wt = canvasTex(64, 128, function (c2, w, h) { c2.fillStyle = "#1c2030"; c2.fillRect(0, 0, w, h); for (var yy = 4; yy < h; yy += 12) for (var xx = 4; xx < w; xx += 12) { var on = Math.random() < .45; c2.fillStyle = on ? (Math.random() < .3 ? "#9fd8ff" : "#ffd98a") : "#0d1018"; c2.fillRect(xx, yy, 7, 8); } });
      D.keep.push(wt);
      for (var bx = -4; bx <= 4; bx++) for (var bz = -4; bz <= 4; bz++) {
        var cx = bx * 54, cz = bz * 54; if (Math.hypot(cx, cz) > 215 || Math.hypot(cx, cz - 6) < 40) continue;
        var n = 1 + Math.floor(R() * 3);
        for (var k = 0; k < n; k++) { var w2 = 10 + R() * 10, d2 = 10 + R() * 10, hb = 14 + R() * 60, ox = (R() - .5) * (36 - w2), oz = (R() - .5) * (36 - d2);
          var tx = wt.clone(); tx.needsUpdate = true; tx.repeat.set(Math.max(1, Math.round(w2 / 8)), Math.max(1, Math.round(hb / 16))); D.keep.push(tx);
          var bm = new T.MeshLambertMaterial({ map: tx, emissive: new T.Color(0xffffff), emissiveMap: tx, emissiveIntensity: .9, fog: false });
          var bd = new T.Mesh(new T.BoxGeometry(w2, hb, d2), bm); bd.position.set(cx + ox, hb / 2, cz + oz); add(bd); box(cx + ox, cz + oz, w2 / 2 + .4, d2 / 2 + .4);
          if (R() < .35) { var ne = new T.Mesh(new T.BoxGeometry(w2 * .7, 2.2, .3), glowMat([0xff3fb0, 0x3fe0ff, 0xb0ff3f][k % 3], .95)); ne.position.set(cx + ox, Math.min(hb - 3, 8 + R() * 10), cz + oz + d2 / 2 + .3); add(ne); } } }
      for (var lp = 0; lp < 30; lp++) { var la = lp / 30 * TAU, lr = 20 + (lp % 3) * 70, lx = Math.cos(la) * lr, lz = Math.sin(la) * lr; var post = new T.Mesh(new T.CylinderGeometry(.12, .16, 6, 6), lam(0x30343c)); post.position.set(lx, 3, lz); add(post); var bulb = new T.Mesh(new T.SphereGeometry(.45, 10, 8), lam(0xffeab0, 1.4)); bulb.position.set(lx, 6.2, lz); add(bulb); if (L && X) { var gs = L.sprite(g, X.soft, 0xffd890, 9, true, .45); gs.position.copy(bulb.position); } circ(lx, lz, .3); }
    } else if (kind === 5) { // jungle
      H = function (x, z) { return flat(x, z, 7 * fbm(x * .018, z * .018) - 1.5); };
      COL = function (x, z, h) { var v = .75 + .25 * fbm(x * .2, z * .2); return [0.2 * v, 0.55 * v, 0.18 * v]; };
      skyM = sky(0x4fb0e8, 0xd8f5d0, 0xfffbd8, sun, { clouds: .9 });
      for (var tr = 0; tr < 90; tr++) { var st = spot(22, 230), tg = new T.Group(), hh5 = 10 + R() * 14; var trk = new T.Mesh(new T.CylinderGeometry(.6, 1, hh5, 8), lam(0x5a3d22, .05)); trk.position.y = hh5 / 2; tg.add(trk);
        for (var cp = 0; cp < 3; cp++) { var can = new T.Mesh(new T.SphereGeometry(3.5 + R() * 3, 10, 8), lam([0x2f8f3a, 0x3fae4a, 0x267a30][cp], .08)); can.position.set((R() - .5) * 4, hh5 + (R() - .3) * 3, (R() - .5) * 4); tg.add(can); }
        tg.position.set(st[0], H(st[0], st[1]) - .3, st[1]); add(tg); circ(st[0], st[1], 1.1); }
      for (var fl = 0; fl < 16; fl++) { var sf = spot(25, 200), fg = new T.Group(), stem = new T.Mesh(new T.CylinderGeometry(.25, .3, 4, 6), lam(0x3f9a3a, .1)); stem.position.y = 2; fg.add(stem);
        var pc = [0xff4f8a, 0xffd23f, 0xa66bff, 0xff7a2f][fl % 4]; for (var pt = 0; pt < 6; pt++) { var pet = new T.Mesh(new T.SphereGeometry(1, 8, 6), lam(pc, .35)); pet.scale.set(1.3, .25, .6); pet.position.set(Math.cos(pt / 6 * TAU) * 1.2, 4.2, Math.sin(pt / 6 * TAU) * 1.2); pet.rotation.y = -pt / 6 * TAU; fg.add(pet); }
        var ctr = new T.Mesh(new T.SphereGeometry(.6, 10, 8), lam(0xffe066, .6)); ctr.position.y = 4.3; fg.add(ctr); fg.position.set(sf[0], H(sf[0], sf[1]), sf[1]); fg.scale.setScalar(1 + R() * 1.4); add(fg); circ(sf[0], sf[1], .5); }
      var FN = 260, fp = new Float32Array(FN * 3); for (var f2 = 0; f2 < FN; f2++) { fp[f2 * 3] = (R() - .5) * 300; fp[f2 * 3 + 1] = 1 + R() * 8; fp[f2 * 3 + 2] = (R() - .5) * 300; }
      var fgeo = new T.BufferGeometry(); fgeo.setAttribute("position", new T.BufferAttribute(fp, 3)); var ffl = new T.Points(fgeo, new T.PointsMaterial({ color: 0xe8ff70, size: .5, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, fog: false })); add(ffl);
      D.upd.push(function (t) { ffl.position.y = Math.sin(t * .7) * .8; ffl.material.opacity = .55 + .35 * Math.sin(t * 2.3); });
    } else if (kind === 6) { // espace
      var CR = []; for (var cr = 0; cr < 14; cr++) { var scc = spot(30, 220); CR.push([scc[0], scc[1], 8 + R() * 18]); }
      H = function (x, z) { var h = 2.5 * fbm(x * .03, z * .03); for (var k2 = 0; k2 < CR.length; k2++) { var d3 = Math.hypot(x - CR[k2][0], z - CR[k2][1]) / CR[k2][2]; if (d3 < 1.25) h += d3 < 1 ? -2.6 * (1 - d3 * d3) : 1.2 * (1 - Math.abs(d3 - 1.1) * 6.7) * (d3 < 1.25 ? 1 : 0); } return flat(x, z, h); };
      COL = function (x, z, h) { var v = .45 + .15 * fbm(x * .3, z * .3) + h * .03; return [v, v, v * 1.05]; };
      skyM = sky(0x000005, 0x05051a, 0xffffff, new T.Vector3(.6, .3, -.5), { stars: 1.2, clouds: 0, sunS: 12 });
      D.grav = 4.2; D.jump = 6.2;
      var planet = new T.Mesh(new T.SphereGeometry(140, 40, 24), lam(0xd08a4a, .35)); planet.position.set(-300, 260, -520); add(planet);
      var ring = new T.Mesh(new T.RingGeometry(180, 260, 64), glowMat(0xe8c890, .45)); ring.position.copy(planet.position); ring.rotation.set(1.2, .3, 0); add(ring);
      var moon2 = new T.Mesh(new T.SphereGeometry(40, 24, 16), lam(0x9fb8ff, .4)); moon2.position.set(320, 200, -400); add(moon2);
      for (var cy = 0; cy < 24; cy++) { var sc5 = spot(30, 225), cry = new T.Mesh(new T.OctahedronGeometry(1 + R() * 1.5, 0), lam(0x7ff0ff, .9)); cry.scale.y = 2.2; cry.position.set(sc5[0], H(sc5[0], sc5[1]) + 1.5, sc5[1]); add(cry); circ(sc5[0], sc5[1], 1.2, H(sc5[0], sc5[1]) + 4); }
      var fr = []; for (var fr2 = 0; fr2 < 18; fr2++) { var fs = spot(30, 200), frk = new T.Mesh(new T.DodecahedronGeometry(1.5 + R() * 4, 0), lam(0x8a8a90, .1)); frk.position.set(fs[0], 10 + R() * 40, fs[1]); add(frk); fr.push(frk); }
      D.upd.push(function (t) { for (var i3 = 0; i3 < fr.length; i3++) { fr[i3].rotation.set(t * .1 + i3, t * .13, 0); fr[i3].position.y += Math.sin(t * .5 + i3) * .01; } });
    } else { // bonbon
      H = function (x, z) { return flat(x, z, 4 * Math.sin(x * .035) * Math.sin(z * .03) + 3 * fbm(x * .02, z * .02)); };
      COL = function (x, z, h) { var s5 = .5 + .5 * Math.sin((x + z) * .08); return [1.0, 0.72 + .12 * s5, 0.86 + .06 * s5]; };
      skyM = sky(0x9fd8ff, 0xffd8f0, 0xffffe0, sun, { clouds: 1 });
      var swirl = canvasTex(128, 128, function (c3, w, h) { c3.fillStyle = "#fff"; c3.fillRect(0, 0, w, h); c3.translate(64, 64); for (var a2 = 0; a2 < 60; a2 += .08) { c3.fillStyle = (Math.floor(a2 * 2) % 2) ? "#ff3f8a" : "#ffffff"; c3.beginPath(); c3.arc(Math.cos(a2) * a2, Math.sin(a2) * a2, 4 + a2 * .1, 0, TAU); c3.fill(); } }); D.keep.push(swirl);
      for (var lo = 0; lo < 22; lo++) { var sl = spot(25, 225), lg2 = new T.Group(), hh6 = 6 + R() * 8; var stick = new T.Mesh(new T.CylinderGeometry(.25, .25, hh6, 8), lam(0xffffff, .2)); stick.position.y = hh6 / 2; lg2.add(stick);
        var cand = new T.Mesh(new T.CylinderGeometry(2.4 + R() * 1.6, 2.4 + R() * 1.6, .6, 28), [lam(0xff6fb0, .25), new T.MeshLambertMaterial({ map: swirl, emissive: new T.Color(0x553344), fog: false }), new T.MeshLambertMaterial({ map: swirl, emissive: new T.Color(0x553344), fog: false })]); cand.rotation.x = Math.PI / 2; cand.position.y = hh6 + 1.5; lg2.add(cand);
        lg2.position.set(sl[0], H(sl[0], sl[1]), sl[1]); lg2.rotation.y = R() * TAU; add(lg2); circ(sl[0], sl[1], .5); }
      for (var gd = 0; gd < 26; gd++) { var sgd = spot(25, 228), rgd = 2 + R() * 4, gdr = new T.Mesh(new T.SphereGeometry(rgd, 16, 10, 0, TAU, 0, Math.PI / 2), lam([0x6fe06f, 0xffd23f, 0x6fb0ff, 0xff7a4f, 0xc06fff][gd % 5], .35)); gdr.position.set(sgd[0], H(sgd[0], sgd[1]) - .2, sgd[1]); add(gdr); circ(sgd[0], sgd[1], rgd * .9, H(sgd[0], sgd[1]) + rgd); }
      var rain = new T.Mesh(new T.TorusGeometry(300, 18, 8, 80, Math.PI), new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false, vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "varying vec2 vU;void main(){float y=vU.y;vec3 c=y<.17?vec3(1,.2,.2):y<.33?vec3(1,.6,.1):y<.5?vec3(1,1,.2):y<.67?vec3(.2,.9,.3):y<.83?vec3(.2,.5,1):vec3(.6,.3,1);gl_FragColor=vec4(c,.55);}" }));
      rain.position.set(0, -40, -420); add(rain);
      var cc = []; for (var cl2 = 0; cl2 < 10; cl2++) { var cg2 = new T.Group(), cm2 = lam(0xffe8f8, .4); for (var b2 = 0; b2 < 5; b2++) { var bb = new T.Mesh(new T.SphereGeometry(4 + R() * 4, 12, 8), cm2); bb.position.set(b2 * 4 - 8, R() * 3, R() * 3); cg2.add(bb); } cg2.position.set((R() - .5) * 400, 40 + R() * 40, (R() - .5) * 400); add(cg2); cc.push(cg2); }
      D.upd.push(function (t) { for (var i4 = 0; i4 < cc.length; i4++) cc[i4].position.x += Math.sin(t * .05 + i4) * .02; });
    }
    D.height = H;
    // sol
    var gg = new T.PlaneGeometry(RADIUS * 2.3, RADIUS * 2.3, 120, 120); gg.rotateX(-Math.PI / 2);
    var pa = gg.attributes.position, cols = new Float32Array(pa.count * 3);
    for (var v = 0; v < pa.count; v++) { var x = pa.getX(v), z = pa.getZ(v), y = H(x, z); pa.setY(v, y); var cc3 = COL(x, z, y); cols[v * 3] = cc3[0]; cols[v * 3 + 1] = cc3[1]; cols[v * 3 + 2] = cc3[2]; }
    gg.setAttribute("color", new T.BufferAttribute(cols, 3)); gg.computeVertexNormals();
    var ground = new T.Mesh(gg, new T.MeshLambertMaterial({ vertexColors: true, fog: false })); add(ground);
    add(skyM); D.sky = skyM;
    var mc = [0xffc070, 0x7fe0ff, 0xff5020, 0xbfe8ff, 0x9f7fff, 0x9fff9a, 0x8f7fff, 0xff9ad8][kind];
    var ms = mist(mc); add(ms); D.mist = ms;
    // lumières propres au monde
    var hemi = new T.HemisphereLight(kind === 4 || kind === 6 ? 0x6070a0 : 0xffffff, kind === 2 ? 0x401008 : 0x404850, kind === 4 || kind === 6 ? .8 : 1.05); g.add(hemi); D.hemi = hemi;
    var dl = new T.DirectionalLight(kind === 2 ? 0xff9060 : kind === 3 ? 0xc8d8ff : 0xfff4e0, kind === 4 ? .5 : 1.3); dl.position.copy(sun).multiplyScalar(200); g.add(dl); g.add(dl.target); D.dl = dl;
    return D;
  }

  // ------------------------------------------------------------- API
  function build(kind, X) {
    var D = world(kind | 0, X); D.g.position.copy(ORIGIN); D.origin = ORIGIN.clone();
    D.spawn = new T.Vector3(ORIGIN.x, ORIGIN.y + D.height(0, -4) + .05, ORIGIN.z - 4);
    // portail de retour : derrière l'arrivée, il reste ouvert
    var P = root.AZRiftWorld97 && root.AZRiftWorld97.portalMaterial ? root.AZRiftWorld97.portalMaterial(8, 4.2) : null;
    if (P) { var pm = new T.Mesh(new T.CircleGeometry(1, 64), P); pm.frustumCulled = false; pm.renderOrder = 6; pm.scale.setScalar(4.6); pm.position.set(0, D.height(0, 9) + 4.8, 9); D.g.add(pm); D.portal = pm; D.keep.push(pm.geometry, P);
      if (root.AZRiftWorld97.portalSparks) { var sp = root.AZRiftWorld97.portalSparks(); pm.add(sp); D.sparks = sp; } }
    D.portalW = new T.Vector3(0, D.height(0, 9) + 4.8, 9).add(ORIGIN);
    return D;
  }
  function update(D, t, dt, cam, me) {
    if (!D) return;
    D.sky.position.set(me ? me.x - D.origin.x : 0, 0, me ? me.z - D.origin.z : 0); D.sky.material.uniforms.time.value = t;
    D.mist.material.uniforms.time.value = t;
    for (var i = 0; i < D.upd.length; i++) D.upd[i](t, me ? { x: me.x - D.origin.x, z: me.z - D.origin.z } : null);
    if (D.portal) { var u = D.portal.material.uniforms; u.time.value = t; u.amt.value = 1; if (cam) { var lp = new T.Vector3().copy(cam.position); lp.y = D.portal.getWorldPosition(new T.Vector3()).y; D.portal.lookAt(lp); } if (D.sparks) D.sparks.rotation.z = t * .8; }
  }
  // sol sous (x, z) du monde (coordonnées du monde réel), obstacles, liquide
  function ground(D, x, z) { return D.origin.y + D.height(x - D.origin.x, z - D.origin.z); }
  function collide(D, ox, oz, nx, nz, y) {
    var lx = nx - D.origin.x, lz = nz - D.origin.z, ly = y - D.origin.y, r = Math.hypot(lx, lz);
    if (r > RADIUS - 2) { lx *= (RADIUS - 2) / r; lz *= (RADIUS - 2) / r; } // la brume du bord
    for (var i = 0; i < D.circ.length; i++) { var c = D.circ[i]; if (ly > c.top) continue; var dx = lx - c.x, dz = lz - c.z, d = Math.hypot(dx, dz), rr = c.r + .45; if (d < rr && d > 1e-4) { lx = c.x + dx / d * rr; lz = c.z + dz / d * rr; } }
    for (var j = 0; j < D.box.length; j++) { var b = D.box[j]; if (ly > b.top) continue; var px = lx - b.x, pz = lz - b.z; if (Math.abs(px) < b.hw && Math.abs(pz) < b.hd) { var ex = b.hw - Math.abs(px), ez = b.hd - Math.abs(pz); if (ex < ez) lx = b.x + Math.sign(px || 1) * b.hw; else lz = b.z + Math.sign(pz || 1) * b.hd; } }
    return [lx + D.origin.x, lz + D.origin.z];
  }
  function dispose(D) {
    if (!D) return; if (D.g.parent) D.g.parent.remove(D.g);
    D.keep.forEach(function (o) { try { if (o && o.dispose) o.dispose(); } catch (e) {} });
  }
  root.AZDims110 = { NAMES: NAMES, build: build, update: update, ground: ground, collide: collide, dispose: dispose, RADIUS: RADIUS };
})(typeof globalThis !== "undefined" ? globalThis : this);
