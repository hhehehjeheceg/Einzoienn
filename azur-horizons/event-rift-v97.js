/* AZUR v97 — event-rift-v97.js : LE MONDE DES FAILLES (voyage sur la météorite, 153 → 192,6 s).
 * Un puits sans fond, violet, bleu et magenta, que la météorite traverse en tombant vers une lumière :
 *  - ciel : nébuleuses qui défilent vers le haut, spirale qui tourne vers la sortie, éclats cristallins,
 *    fissures bleu-blanc, traits de vitesse, éclairs qui illuminent les nuages ;
 *  - anneaux d'énergie que l'on traverse les uns après les autres ;
 *  - déchirures (failles) qui s'ouvrent et palpitent sur les parois, et celle par laquelle on est entré,
 *    au-dessus, qui se referme ;
 *  - fragments du monde aspirés : petites îles flottantes avec leur cabane, et le bus qui passe en
 *    tournoyant tout près (162 → 172 s) ;
 *  - tempête (168 → 178 s) : éclairs sur les parois, secousses ;
 *  - les sept fusées plongent en hélice devant nous vers la sortie (177 → 187 s) ;
 *  - sortie (186 → 192,6 s) : tourbillon blanc en bas qui grandit, tout accélère, secousses.
 * Débris, cristaux, poussière et filets de lumière qui remontent donnent la vitesse de chute.
 * Tout est dans le repère du groupe (centré sur la roche ; le dessus de la roche est vers y = +9).
 * Utilisé par event-v95.js (build / update / dispose). Aucun élément ni logo du jeu d'origine. */
(function (root) {
  "use strict";
  var T = root.THREE, L = root.AZEnd81;
  if (!T || !L) return;
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ramp(t, a, b) { return cl((t - a) / (b - a)); }
  function win(t, a, b, fi, fo) { return ramp(t, a, a + fi) * (1 - ramp(t, b - fo, b)); }
  function hs(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function wrap(y, period) { return ((y % period) + period) % period - period / 2; }

  var SKY_VS = "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
  var SKY_FS = [
    "varying vec3 vD;uniform float time,exitK,enterK,rush,flash,storm;",
    "float hs(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float ns(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "float fb(vec3 p){return .57*ns(p)+.28*ns(p*2.07)+.14*ns(p*4.31);}",
    "void main(){vec3 d=normalize(vD);float a=atan(d.z,d.x),h=d.y,ca=cos(a),sa=sin(a);",
    " float fl=time*(.22+1.3*rush);",
    " float n=fb(vec3(ca*1.6,sa*1.6,h*2.6+fl));",
    " float n2=fb(vec3(ca*4.+n*1.4,sa*4.,h*6.+fl*1.6));",
    " vec3 deep=vec3(.03,.006,.08),vio=vec3(.34,.08,.58),blu=vec3(.08,.2,.9),mag=vec3(.92,.22,.78);",
    " vec3 c=mix(deep,vio,smoothstep(.25,.85,n));",
    " c=mix(c,blu,smoothstep(.5,.85,n2)*.6);",
    " c+=mag*smoothstep(.62,.9,fb(vec3(ca*2.5,sa*2.5,h*3.5-fl*.7)))*.32;",
    // spirale qui tourne vers la sortie (plus serrée en bas)
    " float sp=a*3.-log(1.03+h)*5.+time*.4;",
    " float arms=pow(.5+.5*sin(sp+n*4.),6.);",
    " c+=vec3(.55,.4,1.)*arms*(.12+.4*smoothstep(.1,-.95,h))*(1.+exitK);",
    // éclats cristallins : arêtes d'une grille 3D qui défile, quelques cellules allumées
    " vec3 g=vec3(ca*6.,sa*6.,h*9.+fl*1.8);vec3 gi=floor(g),gf=fract(g);float cell=hs(gi);",
    " vec3 m3=min(gf,1.-gf);float ed=1.-smoothstep(0.,.05,min(min(m3.x,m3.y),m3.z));",
    " c+=vec3(.35,.62,1.)*ed*step(.8,cell)*(.3+.3*sin(time*4.+cell*30.));",
    // fissures lumineuses
    " float seam=pow(1.-smoothstep(0.,.045,abs(n2-.52)),3.);c+=vec3(.55,.82,1.)*seam*(.7+.5*sin(time*3.+a*5.))*(1.+storm*.8);",
    // traits de vitesse
    " float u=(a+3.14159)*26.,ln=floor(u),lh=fract(sin(ln*91.7)*4375.5);",
    " float sk=pow(1.-abs(fract(u)*2.-1.),7.)*step(.5,lh)*smoothstep(.55,1.,fract(h*1.6+time*(.5+lh)*(1.+3.*rush)+lh));",
    " c+=vec3(.75,.6,1.)*sk*(.25+1.1*rush)*(1.-abs(h)*.6);",
    // éclairs : les nuages s'illuminent
    " c+=vec3(.55,.68,1.)*flash*(.2+.9*n2*n);",
    // lumière de la sortie (en bas) et de l'entrée (en haut)
    " float dn=max(0.,-h),up=max(0.,h);",
    " c+=vec3(.55,.75,1.)*pow(dn,6.)*(.35+2.2*exitK)+vec3(1.)*pow(dn,30.)*exitK*5.;",
    " c+=vec3(.78,.45,1.)*pow(up,10.)*enterK*2.5;",
    " gl_FragColor=vec4(c,1.);}"
  ].join("\n");

  function addMat(c, op) { var m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }); m.toneMapped = false; return m; }

  function build(rk, gs, X) {
    if (!rk || !X) return null;
    var R = { g: new T.Group(), keep: [], fall: 0, shake: 0, last: null };
    function k(o) { R.keep.push(o); return o; }
    var g = R.g; g.name = "az96-rift-world";
    // ciel
    R.sky = new T.Mesh(k(new T.SphereGeometry(1000, 64, 40)), k(new T.ShaderMaterial({ side: T.BackSide, fog: false,
      uniforms: { time: { value: 0 }, exitK: { value: 0 }, enterK: { value: 1 }, rush: { value: 0 }, flash: { value: 0 }, storm: { value: 0 } }, vertexShader: SKY_VS, fragmentShader: SKY_FS })));
    R.sky.frustumCulled = false; g.add(R.sky);
    // la météorite (copie exacte de la roche : même forme que les collisions)
    R.rockMat = k(rk.material.clone());
    R.rock = new T.Mesh(rk.geometry, R.rockMat); R.rock.position.copy(rk.position).multiplyScalar(gs); R.rock.quaternion.copy(rk.quaternion); R.rock.scale.copy(rk.scale).multiplyScalar(gs);
    R.rock.frustumCulled = false; g.add(R.rock);
    var u = R.rockMat.uniforms; if (u) { u.front.value.set(0, -1, 0); u.lightDir.value.set(.35, 1, .25); u.rimCol.value.setHex(0xa66bff); u.heat.value = .9; u.pale.value = 0; u.energy.value = .9; }
    R.under = L.sprite(g, X.soft, 0xb06bff, 80, true, .55); R.under.position.set(0, -16, 0);
    R.arcs = []; for (var a = 0; a < 7; a++) { var s = L.sprite(g, X.arcs[a % 3], 0xcdb0ff, 22, true, 0); R.arcs.push(s); }
    // anneaux d'énergie
    R.rings = []; var rg = k(new T.TorusGeometry(1, .012, 6, 120));
    for (var r = 0; r < 7; r++) {
      var ring = new T.Mesh(rg, k(addMat(r % 2 ? 0x7fd4ff : 0xc08bff, .8))); ring.rotation.x = Math.PI / 2; ring.frustumCulled = false;
      ring.userData = { y0: r * 200, s: 150 + hs(r * 3) * 70, tilt: (hs(r * 5) - .5) * .35 };
      g.add(ring); R.rings.push(ring);
      var halo = new T.Mesh(k(new T.TorusGeometry(1, .05, 6, 120)), k(addMat(r % 2 ? 0x2a6cff : 0x8a3dff, .25))); halo.frustumCulled = false; ring.add(halo);
    }
    // déchirures sur les parois
    R.tears = []; var pg = k(new T.PlaneGeometry(1, 1));
    for (var i = 0; i < 10; i++) {
      var tm = k(L.riftMaterial(1.3 + i * .71, i % 3 === 0)), tear = new T.Mesh(pg, tm); tear.frustumCulled = false; tear.renderOrder = 4;
      tear.userData = { a: hs(i * 7.1) * 6.283, r: 380 + hs(i * 2.3) * 260, y0: hs(i * 4.7) * 1400, s: 170 + hs(i * 9.1) * 200, ph: hs(i * 1.9) * 6.283 };
      g.add(tear); R.tears.push(tear);
    }
    // la faille d'entrée (au-dessus) et le tourbillon de sortie (en bas)
    R.entry = new T.Mesh(pg, k(L.riftMaterial(7.7, false))); R.entry.rotation.x = Math.PI / 2; R.entry.position.y = 640; R.entry.scale.setScalar(1100); R.entry.frustumCulled = false; g.add(R.entry);
    R.vortex = new T.Mesh(pg, k(L.vortexMaterial())); R.vortex.rotation.x = -Math.PI / 2; R.vortex.position.y = -820; R.vortex.scale.setScalar(1500); R.vortex.frustumCulled = false; g.add(R.vortex);
    R.exit = L.sprite(g, X.glow, 0xe6f2ff, 300, true, 0); R.exit.position.set(0, -800, 0);
    // fragments du monde : îles flottantes et le bus
    R.isl = [];
    if (L.models && L.models.floatingIsland) for (var f = 0; f < 4; f++) {
      var il = L.models.floatingIsland(X); il.userData.p = { a: f * 1.6 + .4, r: 170 + f * 85, y0: f * 360, s: 26 + hs(f * 3.3) * 30, sp: (hs(f) - .5) * .3 };
      if (il.userData.glow) L.setOp(il.userData.glow, .6); if (il.userData.glow2) L.setOp(il.userData.glow2, .7);
      g.add(il); R.isl.push(il);
    }
    R.bus = L.models && L.models.battleBus ? L.models.battleBus(X) : null;
    if (R.bus) { R.bus.traverse(function (o) { if (o.isSprite) L.setOp(o, .9); }); R.bus.visible = false; g.add(R.bus); }
    // les sept fusées qui plongent vers la sortie
    R.rockets = [];
    if (L.Trail) for (var q = 0; q < 7; q++) {
      var pts = [], a0 = q / 7 * 6.283 + .5, rr0 = 62 + q * 9;
      for (var sI = 0; sI <= 8; sI++) { var uu = sI / 8, rr = rr0 + 1100 * (uu - .5) * (uu - .5), an = a0 + uu * 2.4; pts.push(new T.Vector3(Math.cos(an) * rr, 900 - 1800 * uu, Math.sin(an) * rr)); }
      var rocket = L.models && L.models.riftRocket ? L.models.riftRocket(X, 3) : L.riftRocket(3);
      if (rocket.userData.glow) L.setOp(rocket.userData.glow, .95);
      var tr = new L.Trail(g, pts, 3.2, q % 2 ? 0x8fd2ff : 0xb98cff, 0xffffff, X.star, { headSize: 90, rocket: rocket, grow: 1.6, segs: 140 });
      tr.t0 = 177.2 + q * 1.3; R.rockets.push(tr); k(tr.mat); k(tr.mesh.geometry);
    }
    // éclairs sur les parois
    R.bolts = []; for (var b = 0; b < 8; b++) { var bs = L.sprite(g, X.boltV[b % 4], b % 3 ? 0xcfe6ff : 0xe2c8ff, 1, true, 0); bs.userData = { P: 2.1 + b * .37, o: b * 1.7 }; R.bolts.push(bs); }
    // débris de roche et cristaux
    var dg = k(new T.IcosahedronGeometry(1, 1)), pa = dg.attributes.position;
    for (var v = 0; v < pa.count; v++) { var x = pa.getX(v), y = pa.getY(v), z = pa.getZ(v), ff = 1 + .28 * Math.sin(3.1 * x + 1) * Math.sin(4.3 * y + 2) * Math.sin(5.2 * z + .5); pa.setXYZ(v, x * ff, y * ff * .8, z * ff); }
    dg.computeVertexNormals();
    R.debMat = k(rk.material.clone()); var du = R.debMat.uniforms; if (du) { du.heat.value = .15; du.front.value.set(0, -1, 0); du.lightDir.value.set(.2, -1, .3); du.rimCol.value.setHex(0x7f8cff); du.energy.value = .8; du.pale.value = 0; }
    R.deb = [];
    for (var d = 0; d < 30; d++) { var m = new T.Mesh(dg, R.debMat); m.frustumCulled = false; m.userData = { a: hs(d * 1.3) * 6.283, r: 60 + hs(d * 2.9) * 520, s: 2.5 + Math.pow(hs(d * 4.1), 2) * 24, v: 25 + hs(d * 5.3) * 90, y0: hs(d * 6.7) * 1400, sp: (hs(d * 8.2) - .5) * 1.2 }; g.add(m); R.deb.push(m); }
    R.crys = [];
    if (L.models && L.models.crystal) for (var c = 0; c < 22; c++) { var cr = L.models.crystal(); cr.material.color.setHex(c % 3 ? 0xbfe8ff : 0xe7b8ff); cr.frustumCulled = false; cr.userData = { a: hs(c * 3.7) * 6.283, r: 30 + hs(c * 1.1) * 300, s: 2 + hs(c * 2.2) * 7, v: 40 + hs(c * 9.9) * 80, y0: hs(c * 7.3) * 1400 }; g.add(cr); R.crys.push(cr); }
    // poussière d'étincelles et filets de lumière (motifs répétés tous les 200 m pour défiler sans couture)
    var N = 2400, pos = new Float32Array(N * 3);
    for (var p = 0; p < N; p++) { var pa2 = hs(p * 3.17) * 6.283, pr = 30 + hs(p * 7.71) * 600; pos[p * 3] = Math.cos(pa2) * pr; pos[p * 3 + 1] = hs(p * 1.93) * 200 + 200 * (p % 8) - 800; pos[p * 3 + 2] = Math.sin(pa2) * pr; }
    var dgeo = k(new T.BufferGeometry()); dgeo.setAttribute("position", new T.BufferAttribute(pos, 3));
    R.dust = new T.Points(dgeo, k(new T.PointsMaterial({ color: 0xcdb8ff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    R.dust.frustumCulled = false; g.add(R.dust);
    var NS = 360, sp2 = new Float32Array(NS * 6);
    for (var s2 = 0; s2 < NS; s2++) { var sa = hs(s2 * 5.13) * 6.283, sr = 25 + hs(s2 * 2.71) * 420, sy = hs(s2 * 8.31) * 200 + 200 * (s2 % 8) - 800, sl = 14 + hs(s2 * 4.4) * 50; sp2.set([Math.cos(sa) * sr, sy, Math.sin(sa) * sr, Math.cos(sa) * sr, sy + sl, Math.sin(sa) * sr], s2 * 6); }
    var sgeo = k(new T.BufferGeometry()); sgeo.setAttribute("position", new T.BufferAttribute(sp2, 3));
    var smat = k(new T.LineBasicMaterial({ color: 0xbfb2ff, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, fog: false })); smat.toneMapped = false;
    R.streaks = new T.LineSegments(sgeo, smat); R.streaks.frustumCulled = false; g.add(R.streaks);
    return R;
  }

  var _w = new T.Vector3();
  function update(R, t, dt, cam) {
    if (!R) return;
    dt = Math.min(.1, Math.max(0, +dt || 0));
    // déroulé du voyage
    var entry = 1 - ramp(t, 153.05, 156.5), storm = win(t, 168, 178.5, 1.5, 2), exitK = ramp(t, 176, 190) * .6 + ramp(t, 189.5, 192.5) * .9;
    var rush = ramp(t, 153.05, 153.6) * (1 - ramp(t, 154, 158)) + ramp(t, 188, 192.4);
    var speed = 60 * (1 + 2.6 * rush);
    R.fall += speed * dt; var fall = R.fall;
    var shake = entry * .9 + ramp(t, 188, 192.5) * .75;
    // éclairs
    var flash = 0;
    for (var b = 0; b < R.bolts.length; b++) {
      var bs = R.bolts[b], P = bs.userData.P * (storm > .3 ? .45 : 1), z = (t + bs.userData.o) / P, n = Math.floor(z), ph = z - n, on = (storm > .3 || hs(n * 3 + b) > .45) && ph < .08;
      var op = on ? (1 - ph / .08) * (.75 + .25 * storm) : 0;
      if (op > 0) { var an = hs(n * 13 + b) * 6.283, rr = 320 + hs(n * 7 + b) * 380; bs.position.set(Math.cos(an) * rr, (hs(n * 5 + b) - .5) * 700, Math.sin(an) * rr); bs.scale.set(110 + 60 * hs(n + b), 480 + 200 * hs(n * 2 + b), 1); bs.material.rotation = (hs(n * 11 + b) - .5) * .5; }
      L.setOp(bs, op); flash = Math.max(flash, op);
    }
    shake = Math.max(shake, flash * storm * .35);
    var su = R.sky.material.uniforms; su.time.value = t; su.rush.value = rush; su.exitK.value = exitK; su.enterK.value = 1 - ramp(t, 153.5, 162); su.flash.value = flash * .9; su.storm.value = storm;
    var cp = cam ? cam.position : null;
    [R.rockMat, R.debMat].forEach(function (m) { if (m.uniforms) { m.uniforms.time.value = t; if (cp) m.uniforms.camPos.value.copy(cp); } });
    R.rockMat.uniforms && (R.rockMat.uniforms.energy.value = .9 + flash * .8);
    // la roche : lueur dessous et arcs d'énergie qui crépitent
    L.setOp(R.under, .45 + .15 * Math.sin(t * 2.3) + .3 * rush);
    for (var a = 0; a < R.arcs.length; a++) {
      var s = R.arcs[a], cyc = Math.floor(t * 3 + a * .37), k2 = t * 3 + a * .37 - cyc, aa = hs(cyc * 7 + a) * 6.283;
      s.position.set(Math.cos(aa) * 10.5, -2 + hs(cyc * 3 + a) * 9, Math.sin(aa) * 10.5); s.material.rotation = hs(cyc + a) * 6.283;
      L.setOp(s, hs(cyc * 5 + a) > .45 ? (1 - k2) * (.55 + .4 * storm) : 0);
    }
    // anneaux qu'on traverse
    for (var r = 0; r < R.rings.length; r++) {
      var ring = R.rings[r], du = ring.userData, y = wrap(du.y0 + fall, 1400);
      ring.position.set(Math.sin(t * .3 + r) * 12, y, Math.cos(t * .27 + r) * 12); ring.rotation.set(Math.PI / 2 + du.tilt, 0, t * .2 * (r % 2 ? 1 : -1));
      ring.scale.setScalar(du.s * (1 + .04 * Math.sin(t * 3 + r)));
      var fade = (1 - ramp(Math.abs(y), 450, 690)) * (1 - entry * .7);
      ring.material.opacity = (.55 + .35 * Math.sin(t * 5 + r * 2)) * fade * (1 + rush * .5); ring.visible = fade > .01;
      ring.children[0].material.opacity = .25 * fade;
    }
    // déchirures
    for (var i = 0; i < R.tears.length; i++) {
      var tr = R.tears[i], td = tr.userData, ty = wrap(td.y0 + fall * .3, 1400), tu = tr.material.uniforms, ta = td.a + t * .03;
      tr.position.set(Math.cos(ta) * td.r, ty, Math.sin(ta) * td.r); tr.lookAt(_w.set(0, ty, 0).add(R.g.position)); tr.scale.setScalar(td.s);
      var fadeT = 1 - ramp(Math.abs(ty), 480, 690);
      tu.time.value = t; tu.open.value = .55 + .45 * Math.sin(t * .6 + td.ph); tu.amt.value = fadeT * (.7 + .3 * storm); tu.flash.value = flash * storm; tu.curl.value = 1;
      tr.visible = fadeT > .01;
    }
    var eu = R.entry.material.uniforms; eu.time.value = t; eu.open.value = 1 - ramp(t, 153.5, 163); eu.amt.value = 1 - ramp(t, 158, 164); eu.flash.value = entry; R.entry.visible = eu.amt.value > .01;
    var vu = R.vortex.material.uniforms; vu.time.value = t; vu.amt.value = .25 + exitK * .9; vu.core.value = exitK * 1.3; vu.twist.value = 5 + 3 * rush;
    L.setOp(R.exit, Math.min(1, exitK * 1.1)); R.exit.scale.setScalar(300 + 900 * exitK);
    // îles flottantes
    for (var f = 0; f < R.isl.length; f++) {
      var il = R.isl[f], ip = il.userData.p, iy = wrap(ip.y0 + fall * .22, 1440), ia = ip.a + t * .02;
      il.position.set(Math.cos(ia) * ip.r, iy, Math.sin(ia) * ip.r); il.rotation.set(Math.sin(t * .2 + f) * .12, t * ip.sp, Math.cos(t * .17 + f) * .1); il.scale.setScalar(ip.s);
      il.visible = Math.abs(iy) < 690;
    }
    // le bus qui passe en tournoyant
    if (R.bus) {
      var bu = ramp(t, 161.5, 172), bv = bu > 0 && bu < 1;
      R.bus.visible = bv;
      if (bv) { var ba = 1.1 + bu * 1.4; R.bus.position.set(Math.cos(ba) * (48 + 30 * bu), -760 + 1520 * bu, Math.sin(ba) * (48 + 30 * bu)); R.bus.rotation.set(t * .7, t * .45, t * .3); }
      if (bv) shake = Math.max(shake, .25 * Math.exp(-Math.pow((bu - .5) * 9, 2)));
    }
    // fusées
    for (var q = 0; q < R.rockets.length; q++) {
      var rt = R.rockets[q], kk = (t - rt.t0) / 2.8;
      if (kk < -.05 || kk > 1.6) { if (rt.mesh.visible || (rt.rocket && rt.rocket.visible)) rt.set(0, 0, 0, t); continue; }
      rt.set(Math.max(0, kk), .38, kk > 0 ? 1 - ramp(kk, 1, 1.55) : 0, t);
      shake = Math.max(shake, .5 * Math.exp(-Math.pow((kk - .5) * 7, 2)));
    }
    // débris, cristaux, poussière, filets
    var dsp = 1 + 2.6 * rush;
    for (var d = 0; d < R.deb.length; d++) {
      var m = R.deb[d], md = m.userData, my = wrap(md.y0 + fall * md.v / 60, 1400);
      m.position.set(Math.cos(md.a + t * .02 * md.sp) * md.r, my, Math.sin(md.a + t * .02 * md.sp) * md.r); m.scale.setScalar(md.s); m.rotation.set(t * .3 * md.sp, t * .2 + d, t * .17 * md.sp);
    }
    for (var c = 0; c < R.crys.length; c++) {
      var cr = R.crys[c], cd = cr.userData, cy = wrap(cd.y0 + fall * cd.v / 60, 1400);
      cr.position.set(Math.cos(cd.a + t * .05) * cd.r, cy, Math.sin(cd.a + t * .05) * cd.r); cr.scale.setScalar(cd.s); cr.rotation.set(t * .8 + c, t * .5, c);
      cr.material.opacity = .55 + .35 * Math.sin(t * 4 + c);
    }
    R.dust.position.y = (fall * 1.4) % 200;
    R.streaks.position.y = (fall * 2.2) % 200; R.streaks.material.opacity = .3 + .5 * Math.min(1, dsp - 1 + storm * .3);
    R.shake = Math.min(1.2, shake);
  }

  function dispose(R) {
    if (!R) return;
    R.keep.forEach(function (o) { try { if (o && o.dispose) o.dispose(); } catch (e) {} });
  }

  root.AZRiftWorld97 = { build: build, update: update, dispose: dispose };
})(typeof globalThis !== "undefined" ? globalThis : this);
