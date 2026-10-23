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
    R.rock.frustumCulled = false; g.add(R.rock); R.rock0 = R.rock.position.clone(); R.rockY = 0; R.rockV = 0;
    // v108 : la faille qui s'ouvre sous le joueur resté dans ce monde et le renvoie sur l'île
    R.portal = new T.Mesh(k(new T.PlaneGeometry(1, 1)), k(L.riftMaterial(9.3, false))); R.portal.frustumCulled = false; R.portal.visible = false; R.portal.renderOrder = 5; g.add(R.portal);
    R.portalGlow = L.sprite(g, X.soft, 0xc9a6ff, 60, true, 0);
    try { buildOdd(R, X); } catch (e) { R.odd = null; if (root.console) console.warn("[AZUR rift v109]", e); }
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
  function update(R, t, dt, cam, opt) {
    if (!R) return;
    dt = Math.min(.1, Math.max(0, +dt || 0));
    // v108 : joueur descendu de la météorite — le monde s'arrête autour de lui, la roche continue sa chute sans lui
    var free = !!(opt && opt.free), fk = free ? ramp(t, opt.since, opt.since + 1.5) : 0;
    // déroulé du voyage
    var entry = (1 - ramp(t, 153.05, 156.5)) * (1 - fk), storm = win(t, 168, 178.5, 1.5, 2), exitK = free ? .45 : ramp(t, 176, 190) * .6 + ramp(t, 189.5, 192.5) * .9;
    var rush = free ? 0 : ramp(t, 153.05, 153.6) * (1 - ramp(t, 154, 158)) + ramp(t, 188, 192.4);
    var speed = 60 * (1 + 2.6 * rush) * (1 - fk);
    if (free) { R.rockV = Math.min(240, (R.rockV || 0) + 70 * dt); R.rockY -= R.rockV * dt; } else { R.rockY = 0; R.rockV = 0; }
    if (R.rockMtx) { R.rock.matrix.copy(R.rockMtx); R.rock.matrix.elements[13] += R.rockY; R.rock.matrixWorldNeedsUpdate = true; } else R.rock.position.set(R.rock0.x, R.rock0.y + R.rockY, R.rock0.z); R.rock.visible = R.rockY > -950; // v112 : même matrice que la forme de collision R.under.position.y = -16 + R.rockY;
    if (R.portal) { var po = opt && opt.portal; R.portal.visible = !!po; L.setOp(R.portalGlow, po ? .8 * po.k : 0); if (po) { R.portal.position.set(po.x, po.y, po.z); R.portalGlow.position.copy(R.portal.position); if (cam) R.portal.quaternion.copy(cam.quaternion); var pk = .3 + .7 * po.k; R.portal.scale.setScalar(26 + 70 * po.k); var pu = R.portal.material.uniforms; pu.time.value = t; pu.open.value = pk; pu.amt.value = Math.min(1, po.k * 2); pu.flash.value = po.k > .9 ? 1 : 0; R.portalGlow.scale.setScalar(60 + 160 * po.k); } }
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
    L.setOp(R.under, R.rock.visible ? .45 + .15 * Math.sin(t * 2.3) + .3 * rush : 0);
    for (var a = 0; a < R.arcs.length; a++) {
      var s = R.arcs[a], cyc = Math.floor(t * 3 + a * .37), k2 = t * 3 + a * .37 - cyc, aa = hs(cyc * 7 + a) * 6.283;
      s.position.set(Math.cos(aa) * 10.5, -2 + hs(cyc * 3 + a) * 9 + R.rockY, Math.sin(aa) * 10.5); s.material.rotation = hs(cyc + a) * 6.283;
      L.setOp(s, R.rock.visible && hs(cyc * 5 + a) > .45 ? (1 - k2) * (.55 + .4 * storm) : 0);
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
    for (var f = 0; f < R.isl.length && !R.frozen; f++) {
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
    try { updateOdd(R, t, dt, free, opt && opt.me, cam); } catch (e) {}
  }


  /* ===================================================== v109 : CE QUI APPARAÎT QUAND ON RESTE BLOQUÉ
   * Resté dans le monde des failles (descendu de la météorite), on voit surgir de temps en temps des morceaux
   * d'autres dimensions : maisons qui flottent, un bus aux couleurs d'un autre monde qui grésille, un personnage
   * fantôme, voitures, arbres à l'envers, escaliers qui ne mènent nulle part, coffre géant, lampadaire… et des
   * PORTAILS ronds qui montrent chacun une autre dimension (désert, océan, lave, glace, ville de nuit, jungle,
   * espace, monde bonbon). Tout apparaît en fondu autour du joueur, dérive, tourne, puis s'efface. */
  /* v110 — portails améliorés : la dimension se voit EN PROFONDEUR (parallaxe : le ciel bouge moins vite que les
   * collines quand on tourne autour), anneau d'énergie épais qui tourbillonne, lèvres qui ondulent, paillettes,
   * aspiration lumineuse au centre ; kind 8 = le monde des failles (portail de retour). */
  var PORTAL_VS = "varying vec2 vUv;varying vec3 vV;void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.);vec3 d=normalize(wp.xyz-cameraPosition);vV=normalize(vec3(dot(d,modelMatrix[0].xyz),dot(d,modelMatrix[1].xyz),dot(d,modelMatrix[2].xyz)));gl_Position=projectionMatrix*viewMatrix*wp;}";
  var PORTAL_FS = [
    "varying vec2 vUv;varying vec3 vV;uniform float time,amt,kind,seed;",
    "float h1(float n){return fract(sin(n)*43758.5453);}",
    "float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}",
    "float fb(vec2 p){return .55*n2(p)+.28*n2(p*2.1)+.14*n2(p*4.3);}",
    "vec3 scene(vec2 q,vec2 par,float K,float tt){",
    " vec3 top,bot,gnd,acc;",
    " if(K<.5){top=vec3(.35,.62,1.);bot=vec3(1.,.86,.6);gnd=vec3(.95,.75,.45);acc=vec3(1.,.97,.85);}",
    " else if(K<1.5){top=vec3(.2,.55,1.);bot=vec3(.72,.9,1.);gnd=vec3(.95,.88,.65);acc=vec3(1.);}",
    " else if(K<2.5){top=vec3(.16,.02,.02);bot=vec3(.55,.14,.05);gnd=vec3(.14,.1,.1);acc=vec3(1.,.5,.15);}",
    " else if(K<3.5){top=vec3(.04,.1,.3);bot=vec3(.4,.55,.8);gnd=vec3(.92,.96,1.);acc=vec3(.85,.92,1.);}",
    " else if(K<4.5){top=vec3(.01,.02,.08);bot=vec3(.12,.07,.26);gnd=vec3(.05,.05,.09);acc=vec3(1.,.86,.5);}",
    " else if(K<5.5){top=vec3(.3,.7,.95);bot=vec3(.8,.96,.82);gnd=vec3(.15,.48,.16);acc=vec3(1.,1.,.75);}",
    " else if(K<6.5){top=vec3(.0,.0,.02);bot=vec3(.04,.02,.12);gnd=vec3(.42,.42,.46);acc=vec3(.95,.65,.35);}",
    " else if(K<7.5){top=vec3(.6,.84,1.);bot=vec3(1.,.82,.94);gnd=vec3(1.,.74,.88);acc=vec3(1.,1.,.8);}",
    " else {top=vec3(.05,.01,.12);bot=vec3(.3,.08,.5);gnd=vec3(.2,.05,.35);acc=vec3(.7,.5,1.);}",
    " vec2 qs=q+par*.55,qm=q+par*.3,qg=q+par*.12;float hz=-.1+.03*sin(tt*.3+seed);",
    " vec3 c=mix(bot,top,smoothstep(hz,1.,qs.y));",
    " if(K>2.5&&K<3.5){float ar=sin(qs.x*5.+tt*.4+sin(qs.y*3.+tt*.3)*2.)*.5+.5;c+=vec3(.2,1.,.6)*pow(ar,5.)*smoothstep(.1,.5,qs.y)*.8;}",
    " if((K>3.5&&K<4.5)||(K>2.5&&K<3.5)||(K>5.5&&K<6.5)||K>7.5){c+=vec3(step(.985,h2(floor(qs*90.+seed))))*.9;}",
    " if(K>7.5){float sp=atan(qs.y,qs.x)*3.-length(qs)*9.+tt*1.2;c+=vec3(.6,.4,1.)*pow(.5+.5*sin(sp),5.)*.6;}",
    " vec2 sp2=vec2(.4,.45)+par*.55;float sd=length(qs-sp2);c+=acc*(smoothstep(.15,.12,sd)+.3*exp(-sd*4.5));",
    " if(K>5.5&&K<6.5){float pd=length(qs-vec2(-.35,.35));c=mix(c,vec3(.85,.55,.3)*(.6+.4*smoothstep(.3,.0,pd)),smoothstep(.31,.29,pd));c+=vec3(.9,.8,.6)*smoothstep(.02,.0,abs(length((qs-vec2(-.35,.35))*vec2(1.,3.))-.48))*.6;}",
    " if(K<6.){float cl=fb(vec2(qs.x*2.+tt*.05+seed,qs.y*4.));c=mix(c,vec3(1.),smoothstep(.55,.8,cl)*smoothstep(hz+.1,.8,qs.y)*.6);}",
    " if(K>6.5&&K<7.5){float rb=length(qs-vec2(0.,-.6));float band=smoothstep(.05,.0,abs(rb-.9));c=mix(c,vec3(.5+.5*sin(rb*40.),.5+.5*sin(rb*40.+2.),.5+.5*sin(rb*40.+4.)),band*.7);}",
    " float mf=hz+.2*fb(vec2(qm.x*2.+seed,1.))+.07*sin(qm.x*7.+seed);",
    " if(K>3.5&&K<4.5){float bx=floor(qm.x*12.+seed*3.);mf=hz+.06+.4*h1(bx*7.1);}",
    " if(qm.y<mf){vec3 mc=mix(gnd,bot,.45)*(.8+.2*smoothstep(mf-.3,mf,qm.y));",
    "  if(K>3.5&&K<4.5){vec2 w=fract(qm*vec2(36.,54.));mc+=acc*step(.55,h2(floor(qm*vec2(36.,54.))+seed))*step(.25,w.x)*step(.3,w.y)*.9;}",
    "  if(K>1.5&&K<2.5&&qm.x>.0&&qm.x<.35)mc+=vec3(1.,.4,.1)*smoothstep(mf-.15,mf,qm.y)*.7;",
    "  c=mc;}",
    " float ng=hz-.12+.05*fb(vec2(qg.x*4.+seed,2.));",
    " if(qg.y<ng){vec3 gc=gnd*(.7+.3*n2(qg*25.));",
    "  if(K>.5&&K<1.5)gc=mix(vec3(.05,.35,.6),vec3(.4,.8,1.),.5+.5*sin(qg.x*30.+qg.y*90.-tt*2.5));",
    "  if(K>1.5&&K<2.5)gc+=vec3(1.,.35,.05)*pow(1.-abs(fb(qg*6.+tt*.1)-.5)*2.,8.)*1.6;",
    "  if(K>4.5&&K<5.5)gc*=.6+.5*n2(qg*40.);",
    "  if(K>6.5&&K<7.5)gc=mix(gc,vec3(1.),.4*step(.5,fract((qg.x+qg.y)*12.)));",
    "  c=gc;}",
    " return c;}",
    "void main(){vec2 p=vUv*2.-1.;float a=atan(p.y,p.x),tt=time;",
    " float lip=.93+.035*sin(a*7.+tt*2.3)+.02*sin(a*13.-tt*3.1);float r=length(p)/lip;if(r>1.08)discard;",
    " vec2 par=-vV.xy/max(.35,abs(vV.z))*.35;",
    " vec2 q=p*.95;q+=.02*vec2(sin(p.y*9.+tt*2.),cos(p.x*9.+tt*1.7))*smoothstep(.6,1.,r);",
    " vec3 c=scene(q,par,kind,tt);",
    " float sw=.5+.5*sin(a*5.+tt*4.-r*16.),sw2=.5+.5*sin(a*9.-tt*6.+r*20.);",
    " vec3 r1=kind>7.5?vec3(.8,.4,1.):mix(vec3(.55,.3,1.),vec3(.35,.95,1.),sw),ring=mix(r1,vec3(1.,.8,1.),sw2*.22);",
    " float rim=smoothstep(.78,.94,r)*(1.-smoothstep(1.,1.08,r));",
    " c=mix(c,ring*.85,smoothstep(.86,.98,r));c+=ring*rim*.55+ring*pow(smoothstep(.6,1.,r),4.)*.3;",
    " c+=vec3(1.)*pow(max(0.,1.-r*1.4),6.)*.25*(.6+.4*sin(tt*3.));",
    " float sp=step(.97,h2(floor(vec2(a*20.,r*14.-tt*2.)+seed)))*smoothstep(.75,1.,r);c+=vec3(1.)*sp;",
    " c*=1.-.3*smoothstep(.5,.85,r)*(1.-smoothstep(.85,.97,r));",
    " gl_FragColor=vec4(c,amt*(1.-smoothstep(1.,1.08,r)));}"
  ].join("\n");
  function portalMaterial(kind, seed) {
    var m = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false, uniforms: { time: { value: 0 }, amt: { value: 0 }, kind: { value: kind || 0 }, seed: { value: seed || 0 } }, vertexShader: PORTAL_VS, fragmentShader: PORTAL_FS });
    m.toneMapped = false; return m;
  }
  function portalSparks() { // paillettes qui tournent autour de l'anneau
    var N = 90, pos = new Float32Array(N * 3); for (var i = 0; i < N; i++) { var a = i / N * 6.283, r = 1.02 + hs(i * 3.3) * .18; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r; pos[i * 3 + 2] = (hs(i * 7.7) - .5) * .15; }
    var g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ color: 0xe8dcff, size: 3.5, sizeAttenuation: false, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, fog: false }); m.toneMapped = false;
    var pts = new T.Points(g, m); pts.frustumCulled = false; return pts;
  }
  function lam(c, e) { var m = new T.MeshLambertMaterial({ color: c, emissive: new T.Color(c).multiplyScalar(e == null ? .35 : e), transparent: true, opacity: 0, depthWrite: true, fog: false }); return m; }
  function oddBox(g, w, h, d, m, x, y, z) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x || 0, y || 0, z || 0); b.frustumCulled = false; g.add(b); return b; }
  function oddHouse(i) {
    var g = new T.Group(), cols = [0xf2c6a0, 0x9fd8ff, 0xd7f5a8, 0xffb3d1], wall = lam(cols[i % 4]), roof = lam(0x5b3a6e, .25), win = lam(0xfff1a0, 1.1), door = lam(0x6b3f2a, .2);
    oddBox(g, 8, 6, 7, wall, 0, 3, 0);
    var rf = new T.Mesh(new T.ConeGeometry(6.4, 4, 4), roof); rf.rotation.y = Math.PI / 4; rf.position.y = 8; rf.frustumCulled = false; g.add(rf);
    oddBox(g, 1.6, 2.6, .2, door, 0, 1.3, 3.55); oddBox(g, 1.4, 1.2, .2, win, -2.6, 3.8, 3.55); oddBox(g, 1.4, 1.2, .2, win, 2.6, 3.8, 3.55); oddBox(g, .2, 1.2, 1.4, win, 4.05, 3.8, 0);
    oddBox(g, 1, 2.2, 1, roof, 2.2, 9, -1.2); // cheminée
    return g;
  }
  function oddCar(i) { var g = new T.Group(), body = lam([0xe04848, 0x3fa7ff, 0x55d07a][i % 3]), dark = lam(0x1d1f26, .1), glass = lam(0xbfe8ff, .6);
    oddBox(g, 4.4, 1.1, 2, body, 0, .9, 0); oddBox(g, 2.4, .9, 1.8, glass, -.2, 1.9, 0);
    for (var w = 0; w < 4; w++) { var wh = new T.Mesh(new T.CylinderGeometry(.42, .42, .3, 14), dark); wh.rotation.x = Math.PI / 2; wh.position.set(w < 2 ? 1.4 : -1.4, .42, w % 2 ? .95 : -.95); wh.frustumCulled = false; g.add(wh); }
    return g; }
  function oddTree() { var g = new T.Group(), trunk = lam(0x7a5236, .2), leaf = lam(0x3fae5a, .3); var tk = new T.Mesh(new T.CylinderGeometry(.35, .5, 4, 8), trunk); tk.position.y = 2; g.add(tk);
    for (var l = 0; l < 3; l++) { var cn = new T.Mesh(new T.ConeGeometry(2.6 - l * .6, 3, 9), leaf); cn.position.y = 4 + l * 1.7; g.add(cn); } g.traverse(function (o) { o.frustumCulled = false; }); return g; }
  function oddStairs() { var g = new T.Group(), m = lam(0xd9d2c5, .3); for (var k = 0; k < 9; k++) oddBox(g, 3, .5, 1.1, m, 0, k * .55, k * 1.05); oddBox(g, .15, 6, .15, lam(0x8a7f70, .2), 1.6, 3, 4); return g; }
  function oddChest() { var g = new T.Group(), wood = lam(0x8a5a2b, .25), gold = lam(0xffd24a, 1); oddBox(g, 4, 2.2, 2.6, wood, 0, 1.1, 0); var lid = oddBox(g, 4, .8, 2.6, wood, 0, 2.6, -.6); lid.rotation.x = -.7; oddBox(g, 4.1, .3, 2.7, gold, 0, 2.1, 0); oddBox(g, .6, .8, .2, gold, 0, 1.6, 1.35); return g; }
  function oddLamp() { var g = new T.Group(); var pl = new T.Mesh(new T.CylinderGeometry(.12, .18, 7, 8), lam(0x2c3440, .2)); pl.position.y = 3.5; g.add(pl); var bulb = new T.Mesh(new T.SphereGeometry(.55, 12, 8), lam(0xfff3b0, 1.4)); bulb.position.set(.9, 7, 0); g.add(bulb); oddBox(g, 1.2, .15, .3, lam(0x2c3440, .2), .5, 7.3, 0); g.traverse(function (o) { o.frustumCulled = false; }); return g; }
  function oddGhost() { // repli si le personnage 3D n'est pas prêt : silhouette lumineuse
    var g = new T.Group(), m = lam(0x9fe8ff, .9); var b = new T.Mesh(new T.CapsuleGeometry ? new T.CapsuleGeometry(.4, .9, 4, 8) : new T.CylinderGeometry(.4, .4, 1.6, 8), m); b.position.y = 1.2; g.add(b);
    var hd = new T.Mesh(new T.SphereGeometry(.3, 12, 8), m); hd.position.y = 2.05; g.add(hd);
    for (var s = -1; s <= 1; s += 2) { var ar = new T.Mesh(new T.CylinderGeometry(.1, .1, .9, 6), m); ar.position.set(s * .55, 1.35, 0); ar.rotation.z = s * .9; g.add(ar); var lg = new T.Mesh(new T.CylinderGeometry(.13, .13, .9, 6), m); lg.position.set(s * .2, .45, 0); g.add(lg); }
    g.traverse(function (o) { o.frustumCulled = false; }); return g;
  }
  function mats(o) { var a = []; o.traverse(function (c) { if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { if (a.indexOf(m) < 0) a.push(m); }); }); return a; }
  function buildOdd(R, X) {
    var g = R.g, P = R.odd = { items: [], next: 0, n: 0 };
    function item(kind, obj, opt) { opt = opt || {}; obj.visible = false; g.add(obj); var it = { kind: kind, obj: obj, mats: opt.mats || mats(obj), on: false, t0: 0, life: 0, vel: new T.Vector3(), spin: new T.Vector3(), base: [], glow: L.sprite(g, X.soft, opt.glow || 0xb38cff, 30, true, 0), size: opt.size || 10 };
      it.mats.forEach(function (m) { m.transparent = true; it.base.push(m.opacity == null || m.opacity === 0 ? 1 : m.opacity); m.opacity = 0; }); P.items.push(it); return it; }
    for (var h = 0; h < 3; h++) item("maison", oddHouse(h), { glow: 0xffc9a0, size: 14 });
    for (var c = 0; c < 2; c++) item("voiture", oddCar(c), { glow: 0x9fd8ff, size: 7 });
    for (var tr = 0; tr < 2; tr++) item("arbre", oddTree(), { glow: 0x9fffb0, size: 10 });
    item("escalier", oddStairs(), { glow: 0xe8dcc8, size: 10 }); item("coffre", oddChest(), { glow: 0xffd24a, size: 8 }); item("lampadaire", oddLamp(), { glow: 0xfff3b0, size: 8 });
    // le bus d'une autre dimension : couleurs inversées, il grésille
    if (L.models && L.models.battleBus) {
      var bus = new T.Group(); bus.add(L.models.battleBus(X)); var bm = [];
      bus.traverse(function (o) { if (o.isMesh && o.material && !o.isSprite) { var m2 = o.material.clone(); if (m2.color) { var hsl = {}; m2.color.getHSL(hsl); m2.color.setHSL((hsl.h + .42) % 1, Math.min(1, hsl.s + .3), hsl.l); } if (m2.emissive) { m2.emissive.copy(m2.color).multiplyScalar(.5); m2.emissiveIntensity = 1; } o.material = m2; bm.push(m2); } if (o.isSprite) o.visible = false; o.frustumCulled = false; });
      item("bus", bus, { mats: bm, glow: 0x7fffd0, size: 18 }).glitch = true;
    }
    // un personnage d'une autre dimension (vrai modèle 3D si disponible, sinon silhouette)
    var ghost = item("personnage", oddGhost(), { glow: 0x9fe8ff, size: 6 }); ghost.glitch = true;
    try {
      var CM = root.AZCh1Models;
      if (CM && CM.getTemplate && CM.instantiate) CM.getTemplate("char-corail").then(function (tpl) {
        var inst = CM.instantiate(tpl), grp = new T.Group(); grp.add(inst.model); inst.model.scale.multiplyScalar(2.2);
        var cm = []; inst.model.traverse(function (o) { o.frustumCulled = false; if (o.isMesh && o.material) { var m3 = o.material.clone(); m3.transparent = true; if (m3.color) m3.color.lerp(new T.Color(0x9fe8ff), .55); if (m3.emissive) { m3.emissive.setHex(0x3a7aff); m3.emissiveIntensity = .8; } o.material = m3; cm.push(m3); } });
        var clip = CM.clip && CM.clip("Idle_Loop"); if (clip) { ghost.mixer = new T.AnimationMixer(inst.model); ghost.mixer.clipAction(clip).play(); }
        g.remove(ghost.obj); ghost.obj = grp; grp.visible = false; g.add(grp); ghost.mats = cm; ghost.base = cm.map(function () { return 1; }); cm.forEach(function (m4) { m4.opacity = 0; });
      }).catch(function () {});
    } catch (e) {}
    // portails vers d'autres dimensions
    var pg = new T.CircleGeometry(1, 64); R.keep.push(pg);
    for (var q = 0; q < 4; q++) {
      var pm = portalMaterial(q, q * 3.7);
      R.keep.push(pm); var pmesh = new T.Mesh(pg, pm); pmesh.frustumCulled = false; pmesh.renderOrder = 6;
      var spk = portalSparks(); pmesh.add(spk); R.keep.push(spk.geometry, spk.material);
      var pit = item("portail", pmesh, { mats: [], glow: 0xb38cff, size: 34 }); pit.portal = pm; pit.sparks = spk;
    }
  }
  var WEIGHTS = { portail: 3, maison: 2, bus: 1, personnage: 1.2, voiture: 1, arbre: 1, escalier: .8, coffre: .8, lampadaire: .8 };
  var DIM_GLOW = [0xffb060, 0x6fc8ff, 0xff5020, 0xd8f0ff, 0xffd060, 0x8fff9a, 0xb07bff, 0xff9ad8];
  function spawnOdd(R, t, me, cam, first) {
    var P = R.odd, free = P.items.filter(function (it) { return !it.on; }); if (!free.length) return;
    var pick = null;
    if (first) pick = free.filter(function (it) { return it.kind === first; })[0];
    if (!pick) { var tot = 0; free.forEach(function (it) { tot += WEIGHTS[it.kind] || 1; }); var r = Math.random() * tot; for (var i = 0; i < free.length; i++) { r -= WEIGHTS[free[i].kind] || 1; if (r <= 0) { pick = free[i]; break; } } pick = pick || free[0]; }
    // devant la caméra le plus souvent (pour qu'on le voie), à 45-200 m
    var fw = new T.Vector3(0, 0, -1); if (cam) fw.applyQuaternion(cam.quaternion); fw.y = 0; if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    var ang = Math.atan2(fw.z, fw.x) + (Math.random() - .5) * (Math.random() < .75 ? 1.8 : 6.28), d = pick.kind === "portail" ? 50 + Math.random() * 60 : 45 + Math.random() * 155;
    pick.obj.position.set(me.x + Math.cos(ang) * d, pick.kind === "portail" ? me.y - 25 + Math.random() * 30 : me.y - 40 + Math.random() * 100, me.z + Math.sin(ang) * d); // les portails à portée (on peut y entrer)
    pick.obj.rotation.set(pick.kind === "arbre" ? Math.PI : (Math.random() - .5) * .8, Math.random() * 6.28, (Math.random() - .5) * .8);
    var sc = pick.kind === "portail" ? 20 + Math.random() * 14 : pick.kind === "personnage" ? 1 : .8 + Math.random() * .7; pick.obj.scale.setScalar(sc); pick.sc = sc;
    pick.vel.set((Math.random() - .5) * 3, (Math.random() - .5) * 2, (Math.random() - .5) * 3); pick.spin.set((Math.random() - .5) * .25, (Math.random() - .5) * .35, (Math.random() - .5) * .25);
    if (pick.kind === "portail") { pick.spin.set(0, 0, 0); pick.vel.multiplyScalar(.3); pick.obj.lookAt(R.g.position.x + me.x, R.g.position.y + pick.obj.position.y, R.g.position.z + me.z); /* tourné vers le joueur une fois : en tournant autour, la dimension se voit en profondeur */ var kd = Math.floor(Math.random() * 8); pick.portal.uniforms.kind.value = kd; pick.portal.uniforms.seed.value = Math.random() * 20; pick.glow.material.color.setHex(DIM_GLOW[kd]); }
    if (pick.kind === "personnage") pick.spin.set(0, .4, 0);
    pick.on = true; pick.t0 = t; pick.life = 13 + Math.random() * 11; pick.obj.visible = true;
  }
  function updateOdd(R, t, dt, free, me, cam) {
    var P = R.odd; if (!P) return;
    if (!free) { P.items.forEach(function (it) { if (it.on || it.obj.visible) { it.on = false; it.obj.visible = false; L.setOp(it.glow, 0); } }); P.next = 0; P.n = 0; return; }
    if (!P.next) P.next = t + 1.2;
    var act = P.items.filter(function (it) { return it.on; }).length;
    if (t >= P.next && act < 8 && me) { spawnOdd(R, t, me, cam, P.n === 0 ? "portail" : P.n === 1 ? "maison" : P.n === 2 ? "bus" : null); P.n++; P.next = t + (P.n < 4 ? 2.5 : 3 + Math.random() * 4.5); }
    for (var i = 0; i < P.items.length; i++) {
      var it = P.items[i]; if (!it.on) continue;
      if (it.hold) it.life = Math.max(it.life, t - it.t0 + 3); // on est passé dedans : il reste ouvert jusqu'à notre retour
      var age = t - it.t0, a = ramp(age, 0, 1.6) * (1 - ramp(age, it.life - 2.2, it.life));
      if (age > it.life) { it.on = false; it.obj.visible = false; L.setOp(it.glow, 0); continue; }
      if (it.glitch) { var gl = hs(Math.floor(t * 11) + i * 7); a *= gl > .18 ? 1 : .25; if (gl < .06) it.obj.position.x += (hs(t + i) - .5) * 3; }
      it.obj.position.addScaledVector(it.vel, dt); it.obj.rotation.x += it.spin.x * dt; it.obj.rotation.y += it.spin.y * dt; it.obj.rotation.z += it.spin.z * dt;
      for (var m = 0; m < it.mats.length; m++) it.mats[m].opacity = it.base[m] * a;
      if (it.portal) { it.portal.uniforms.time.value = t; it.portal.uniforms.amt.value = a; if (it.sparks) { it.sparks.rotation.z = t * .6; it.sparks.material.opacity = .9 * a; } it.a = a; }
      if (it.mixer) it.mixer.update(dt);
      it.glow.position.copy(it.obj.position); it.glow.scale.setScalar((it.size * (it.sc || 1)) * (it.portal ? 1.6 : 2.2)); L.setOp(it.glow, a * (it.portal ? .45 : .3));
    }
  }
  // v108 : les îles s'arrêtent en escalier devant le joueur qui a quitté la météorite (on peut s'y poser)
  var STAIR = [[38, 0, -30, 34], [98, 48, -100, 30], [150, -46, -180, 40], [72, -112, -265, 28]];
  function freeze(R, rx, ry, rz, yaw) {
    if (!R || R.frozen) return; R.frozen = true; R.exitRel = ry - 265 - 80; // sous la dernière île : la faille de retour s'ouvre
    var fx = -Math.sin(yaw), fz = -Math.cos(yaw), gx = Math.cos(yaw), gz = -Math.sin(yaw);
    for (var i = 0; i < R.isl.length; i++) {
      var il = R.isl[i], q = STAIR[i % STAIR.length];
      il.position.set(rx + fx * q[0] + gx * q[1], ry + q[2] - q[3] * .13, rz + fz * q[0] + gz * q[1]);
      il.rotation.set(0, il.rotation.y, 0); il.scale.setScalar(q[3]); il.visible = true;
    }
  }
  function dispose(R) {
    if (!R) return;
    R.keep.forEach(function (o) { try { if (o && o.dispose) o.dispose(); } catch (e) {} });
  }

  root.AZRiftWorld97 = { build: build, update: update, dispose: dispose, freeze: freeze, portalMaterial: portalMaterial, portalSparks: portalSparks };
})(typeof globalThis !== "undefined" ? globalThis : this);
