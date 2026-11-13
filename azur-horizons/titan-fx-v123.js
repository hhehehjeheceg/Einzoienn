/* AZUR v123 — effets visuels et animations du mode « Gant du Titan » (la simulation est dans titan-mode-v122.js).
 *  · Le Gant tombe du ciel : un poing de bronze chauffé à blanc, une onde de choc devant lui, une longue traînée de fumée
 *    qui reste dans le ciel et une zone d'impact qui rougeoie au sol. À l'impact : éclair, ondes, poussière, débris,
 *    cratère fissuré de magma et colonne de fumée.
 *  · Au sol : il flotte au-dessus du cratère, sous un faisceau visible de loin.
 *  · Quand on le ramasse : colonne d'énergie, montée à 200 m, bras levé, le poing se serre (éclair, onde dans le ciel, il
 *    grandit d'un coup), plongeon tête la première dans une traînée de feu, atterrissage poing au sol (onde, cratère).
 *  · Les pouvoirs : coup de poing (onde, étincelles), rayon (charge, faisceau en couches, impact qui brûle le sol), saut
 *    écrasant, bond éclair, bouclier hexagonal, attraction (liens d'énergie, tourbillon).
 *  · Le corps : taille, poing qui se serre, bras qui visent, atterrissage poing au sol, poussière des pas, caméra plus large.
 * Tout passe par AZView (animateAvatar, renderer.render) et AZCh1Models.Animator : aucun fichier du jeu n'est modifié. */
(function (root) {
  "use strict";
  var T = root.THREE, S = root.AZSim, M = root.AZTitanMode, L = root.AZEnd81, CH = root.AZCh1Models;
  var VP = root.AZView && root.AZView.View && root.AZView.View.prototype;
  if (!T || !S || !M || !M.CFG || !M.state || !L || !L.SmokeSystem || !VP || root.__azTitanFx) return;
  root.__azTitanFx = true;
  var CFG = M.CFG, LK = root.AZTitanLook || {}, SCALE = LK.SCALE || 1.75, LOOK = LK.ID || "char-titan-colosse";

  /* ================================================================ outils */
  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(x) { x = cl(x); return x * x * (3 - 2 * x); }
  function eo(x) { x = cl(x); return 1 - (1 - x) * (1 - x) * (1 - x); }
  function elastic(k) { return k >= 1 ? 1 : 1 - Math.pow(2, -9 * k) * Math.cos(k * 9.5); }
  function H(x, z) { try { return S.heightAt(x, z); } catch (e) { return 0; } }
  function clock() { return (root.performance ? root.performance.now() : Date.now()) / 1000; }
  function game() { return root.AZUR || null; }
  function warn(e) { if (!root.__azTitanFxWarn) { root.__azTitanFxWarn = 1; console.warn("[Titan fx]", e); } }
  var R = Math.random;
  function rr(a, b) { return a + R() * (b - a); }
  var V1 = new T.Vector3(), V2 = new T.Vector3(), V3 = new T.Vector3(), V4 = new T.Vector3(), V5 = new T.Vector3(), UP = new T.Vector3(0, 1, 0), DOWN = new T.Vector3(0, -1, 0);
  var M1 = new T.Matrix4(), M2 = new T.Matrix4(), Q1 = new T.Quaternion();
  var WIND = { x: 1.1, z: .5 };
  var DUST = [.76, .68, .56], SOOT = [.3, .27, .26], ASH = [.44, .42, .42];
  var FIRE = [1.4, .7, .28], GOLD = [1.3, .95, .5], WHITE = [1.4, 1.3, 1.1];

  /* ================================================================ matériaux */
  var X = null;
  function tex() { if (!X) X = L.makeTextures(true); return X; }
  // énergie : cœur clair face à la caméra, bord orangé, stries qui défilent le long de la forme (cylindres, cônes, dômes)
  var VS_E = "varying vec2 vUv;varying float vF;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vec3 n=normalize(normalMatrix*normal);vF=abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}";
  var FS_E = ["uniform float time,op,len,speed,seed,sharp,ends,tail;uniform vec3 cA,cB;varying vec2 vUv;varying float vF;", L.NOISE,
    "void main(){float core=pow(vF,sharp);",
    " float n=fbm(vec2(vUv.x*4.+seed,vUv.y*len*.08-time*speed));float n2=fbm3(vec2(vUv.x*9.-seed,vUv.y*len*.21-time*speed*1.7));",
    " float st=smoothstep(.36,.9,n*.75+n2*.45);",
    " vec3 c=mix(cA,cB,core)*(.6+.9*st)+vec3(1.)*pow(vF,10.)*.8;",
    " float a=(core*.8+st*.45*vF)*op;",
    " float e=max(ends,.0001);a*=smoothstep(0.,e,vUv.y)*smoothstep(1.,1.-e,vUv.y);",
    " a*=pow(max(1.-vUv.y,0.),tail);",
    " gl_FragColor=vec4(c,a);}"].join("\n");
  function energyMat(cA, cB, o) {
    o = o || {};
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, op: { value: o.op || 0 }, len: { value: o.len || 10 }, speed: { value: o.speed || 2 }, seed: { value: R() * 9 }, sharp: { value: o.sharp || 1.6 }, ends: { value: o.ends == null ? .05 : o.ends }, tail: { value: o.tail || 0 }, cA: { value: new T.Vector3(cA[0], cA[1], cA[2]) }, cB: { value: new T.Vector3(cB[0], cB[1], cB[2]) } },
      vertexShader: VS_E, fragmentShader: FS_E
    });
    m.toneMapped = false; return m;
  }
  // ruban d'énergie toujours tourné vers la caméra (calculé dans le shader) : un rayon reste visible même vu de derrière
  var VS_R = ["attribute vec2 seg;uniform vec3 pA,pB;uniform float width,wob,helix,phase,time,len;varying vec2 vUv;",
    "void main(){vec3 P=mix(pA,pB,seg.x);vec3 d=pB-pA;float L=max(length(d),1e-4);d/=L;vec3 tc=normalize(cameraPosition-P);",
    " vec3 sd=cross(d,tc);float l=length(sd);sd=l>1e-4?sd/l:vec3(1.,0.,0.);",
    " float w=width*(1.+wob*sin(seg.x*L*.9-time*31.))*(.35+.65*smoothstep(0.,.04,seg.x));",
    " float hx=helix*sin(seg.x*L*.42-time*17.+phase);",
    " vec3 pos=P+sd*(seg.y*w+hx);vUv=vec2(seg.y,seg.x);gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.);}"].join("\n");
  var FS_R = ["uniform float time,op,len,speed,seed;uniform vec3 cA,cB;varying vec2 vUv;", L.NOISE,
    "void main(){float x=abs(vUv.x);float core=exp(-x*x*5.);",
    " float n=fbm(vec2(vUv.x*2.+seed,vUv.y*len*.08-time*speed));float st=smoothstep(.35,.9,n);",
    " vec3 c=mix(cA,cB,core)*(.65+.8*st)+vec3(1.)*pow(core,7.)*.9;",
    " float a=(core*.9+st*.35*(1.-x))*op;a*=smoothstep(0.,.012,vUv.y)*smoothstep(1.,.985,vUv.y);",
    " gl_FragColor=vec4(c,a);}"].join("\n");
  function Ribbon(segs, width, cA, cB, o) {
    o = o || {};
    var g = new T.BufferGeometry(), sg = [], idx = [];
    for (var i = 0; i <= segs; i++) { sg.push(i / segs, -1, i / segs, 1); if (i < segs) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute("seg", new T.Float32BufferAttribute(sg, 2)); g.setAttribute("position", new T.Float32BufferAttribute(new Float32Array((segs + 1) * 6), 3)); g.setIndex(idx);
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { pA: { value: new T.Vector3() }, pB: { value: new T.Vector3(0, 1, 0) }, width: { value: width }, wob: { value: o.wob || 0 }, helix: { value: o.helix || 0 }, phase: { value: o.phase || 0 }, time: { value: 0 }, len: { value: 10 }, op: { value: 0 }, speed: { value: o.speed || 10 }, seed: { value: R() * 9 }, cA: { value: new T.Vector3(cA[0], cA[1], cA[2]) }, cB: { value: new T.Vector3(cB[0], cB[1], cB[2]) } },
      vertexShader: VS_R, fragmentShader: FS_R
    });
    m.toneMapped = false;
    var me = new T.Mesh(g, m); me.frustumCulled = false; me.matrixAutoUpdate = false; me.renderOrder = 7; me.visible = false;
    return me;
  }
  function setRibbon(me, a, b, op, t) { var u = me.material.uniforms; u.pA.value.copy(a); u.pB.value.copy(b); u.len.value = a.distanceTo(b); u.op.value = op; u.time.value = t; me.visible = op > .003; }
  // anneau d'onde de choc, doux et déchiré (sur un plan)
  var VS_UV = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
  var FS_RING = ["uniform float op,thick,time,seed;uniform vec3 col;varying vec2 vUv;", L.NOISE,
    "void main(){vec2 q=vUv*2.-1.;float r=length(q);if(r>1.)discard;float a=atan(q.y,q.x);",
    " float n=fbm3(vec2(a*3.+seed,r*4.-time*2.));",
    " float band=smoothstep(1.-thick,1.-thick*.35,r)*(1.-smoothstep(.93,1.,r));",
    " float inner=smoothstep(1.-thick*2.6,1.,r)*.22;",
    " float v=(band*(.5+.75*n)+inner*n)*op;if(v<.003)discard;gl_FragColor=vec4(col*(1.+band*.5),v);}"].join("\n");
  function ringMat(col, thick) {
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { op: { value: 0 }, thick: { value: thick || .2 }, time: { value: 0 }, seed: { value: R() * 9 }, col: { value: new T.Vector3(col[0], col[1], col[2]) } },
      vertexShader: VS_UV, fragmentShader: FS_RING
    });
    m.toneMapped = false; return m;
  }
  // bouclier : dôme hexagonal, bord lumineux, vagues qui montent
  var VS_G = "varying vec2 vUv;varying float vF;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vec3 n=normalize(normalMatrix*normal);vF=abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}";
  var FS_G = ["uniform float time,op,hit;uniform vec3 col;varying vec2 vUv;varying float vF;",
    "float hx(vec2 p){p.x*=1.1547;p.y+=mod(floor(p.x),2.)*.5;p=abs(fract(p)-.5);return abs(max(p.x*1.5+p.y,p.y*2.)-1.);}",
    "void main(){float rim=pow(1.-vF,2.4);float l=1.-smoothstep(.0,.14,hx(vUv*vec2(22.,11.)));",
    " float wave=.5+.5*sin(vUv.y*26.-time*5.);float a=(rim*.85+l*(.22+.5*wave*wave)+.04+hit*.5)*op;",
    " gl_FragColor=vec4(col*(1.+rim*.8+hit),a);}"].join("\n");
  function addMat(map, color, op) {
    var m = new T.MeshBasicMaterial({ map: map || null, color: color == null ? 0xffffff : color, transparent: true, opacity: op == null ? 1 : op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    m.toneMapped = false; return m;
  }
  var PLANE = null;
  function plane() { if (!PLANE) { PLANE = new T.PlaneGeometry(2, 2); PLANE.userData.keep = true; } return PLANE; }
  // décalque posé sur le relief (cratère, brûlure)
  function decalGeo(x, z, size, segs) {
    var g = new T.PlaneGeometry(size, size, segs, segs); g.rotateX(-Math.PI / 2);
    var p = g.attributes.position, uv = g.attributes.uv, a = R() * 6.283, c = Math.cos(a), s = Math.sin(a);
    for (var i = 0; i < p.count; i++) {
      p.setY(i, H(x + p.getX(i), z + p.getZ(i)) + .14);
      var u = uv.getX(i) - .5, v = uv.getY(i) - .5; uv.setXY(i, .5 + u * c - v * s, .5 + u * s + v * c);
    }
    g.computeBoundingSphere(); return g;
  }

  /* ================================================================ particules */
  // étincelles (un seul tirage pour toutes)
  function Sparks(max, map) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
    this.t = new Float32Array(max); this.life = new Float32Array(max); this.sz = new Float32Array(max); this.dr = new Float32Array(max); this.gr = new Float32Array(max);
    var g = this.geo = new T.BufferGeometry();
    this.aPos = new T.BufferAttribute(new Float32Array(max * 3), 3); this.aCol = new T.BufferAttribute(new Float32Array(max * 4), 4); this.aSize = new T.BufferAttribute(new Float32Array(max), 1);
    [this.aPos, this.aCol, this.aSize].forEach(function (a) { a.setUsage(T.DynamicDrawUsage); });
    g.setAttribute("position", this.aPos); g.setAttribute("aCol", this.aCol); g.setAttribute("aSize", this.aSize); g.setDrawRange(0, 0);
    this.mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { map: { value: map }, px: { value: 500 } },
      vertexShader: "attribute vec4 aCol;attribute float aSize;uniform float px;varying vec4 vC;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.);float d=-mv.z;vC.a*=smoothstep(1.5,5.,d);gl_PointSize=clamp(aSize*px/max(.2,d),1.5,44.);gl_Position=projectionMatrix*mv;}",
      fragmentShader: "uniform sampler2D map;varying vec4 vC;void main(){float a=texture2D(map,gl_PointCoord).a*vC.a;if(a<.01)discard;gl_FragColor=vec4(vC.rgb,a);}"
    });
    this.mat.toneMapped = false;
    this.mesh = new T.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 7;
  }
  Sparks.prototype.add = function (x, y, z, vx, vy, vz, life, size, col, drag, grav) {
    var i = this.n < this.max ? this.n++ : (R() * this.max) | 0, k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.c[k] = col[0]; this.c[k + 1] = col[1]; this.c[k + 2] = col[2];
    this.t[i] = 0; this.life[i] = life; this.sz[i] = size; this.dr[i] = drag || 0; this.gr[i] = grav || 0;
  };
  Sparks.prototype.move = function (a, b) {
    var ka = a * 3, kb = b * 3;
    for (var j = 0; j < 3; j++) { this.p[ka + j] = this.p[kb + j]; this.v[ka + j] = this.v[kb + j]; this.c[ka + j] = this.c[kb + j]; }
    this.t[a] = this.t[b]; this.life[a] = this.life[b]; this.sz[a] = this.sz[b]; this.dr[a] = this.dr[b]; this.gr[a] = this.gr[b];
  };
  Sparks.prototype.update = function (dt, px) {
    var P = this.p, Vv = this.v, C = this.c, aP = this.aPos.array, aC = this.aCol.array, aS = this.aSize.array;
    for (var i = 0; i < this.n; i++) {
      this.t[i] += dt;
      if (this.t[i] >= this.life[i]) { this.n--; if (i < this.n) { this.move(i, this.n); i--; } continue; }
      var k = i * 3, d = Math.exp(-this.dr[i] * dt);
      Vv[k] *= d; Vv[k + 1] = Vv[k + 1] * d - this.gr[i] * dt; Vv[k + 2] *= d;
      P[k] += Vv[k] * dt; P[k + 1] += Vv[k + 1] * dt; P[k + 2] += Vv[k + 2] * dt;
      var f = 1 - this.t[i] / this.life[i], f2 = f * f;
      aP[k] = P[k]; aP[k + 1] = P[k + 1]; aP[k + 2] = P[k + 2];
      var c4 = i * 4; aC[c4] = C[k] * (.6 + .4 * f); aC[c4 + 1] = C[k + 1] * (.35 + .65 * f2); aC[c4 + 2] = C[k + 2] * f2; aC[c4 + 3] = Math.min(1, f * 1.6);
      aS[i] = this.sz[i] * (.35 + .65 * f);
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.mat.uniforms.px.value = px;
    this.mesh.visible = this.n > 0;
  };
  // fumée et poussière (bouffées éclairées par le soleil, triées)
  function Puffs(max, map) { this.sys = new L.SmokeSystem(max, map); this.list = []; this.max = max; }
  Puffs.prototype.add = function (o) {
    if (this.list.length >= this.max) this.list.shift();
    o.t = 0; o.rot = R() * 6.283; o.vr = (R() - .5) * .5; o.vari = (R() * 4) | 0;
    o.vx = o.vx || 0; o.vy = o.vy || 0; o.vz = o.vz || 0; if (o.a == null) o.a = .8;
    this.list.push(o);
  };
  Puffs.prototype.update = function (dt, cam) {
    var s = this.sys, list = this.list, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z; s.begin();
    for (var i = list.length - 1; i >= 0; i--) {
      var q = list[i]; q.t += dt; var k = q.t / q.life;
      if (k >= 1) { list.splice(i, 1); continue; }
      var d = Math.exp(-(q.drag || 0) * dt); q.vx *= d; q.vy *= d; q.vz *= d; q.vy += (q.rise || 0) * dt;
      q.x += (q.vx + WIND.x * (q.wind == null ? 1 : q.wind)) * dt; q.y += q.vy * dt; q.z += (q.vz + WIND.z * (q.wind == null ? 1 : q.wind)) * dt; q.rot += q.vr * dt;
      var size = q.s0 + (q.s1 - q.s0) * (1 - Math.pow(1 - k, 2.2));
      if (q.gy != null && q.y < q.gy + size * .28) q.y = q.gy + size * .28;
      var a = q.a * cl(q.t / (q.fin || .12)) * Math.pow(1 - k, 1.4), warm = q.warm ? q.warm * Math.exp(-q.t / (q.warmT || .8)) : 0;
      var dc = Math.hypot(q.x - cx, q.y - cy, q.z - cz); if (dc < size * .7 + 3) a *= cl((dc - 1) / (size * .7 + 2));
      s.add(q.x, q.y, q.z, size, q.r, q.g, q.b, a, q.rot, q.vari, q.flat || 0, warm);
    }
    s.end(cam);
  };
  // éclats de roche (rebondissent, roulent, disparaissent)
  function Debris(parent, max) {
    var geo = new T.IcosahedronGeometry(1, 0), mat = new T.MeshStandardMaterial({ color: 0x4a3f38, roughness: .95, metalness: 0, flatShading: true });
    this.mesh = new T.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.castShadow = false; parent.add(this.mesh); this.list = []; this.max = max; this.o = new T.Object3D();
  }
  Debris.prototype.add = function (x, y, z, vx, vy, vz, s, life, hot) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, s: s, life: life, t: 0, rx: R() * 6, ry: R() * 6, wx: rr(-9, 9), wy: rr(-9, 9), hot: !!hot, acc: 0 });
  };
  Debris.prototype.update = function (dt, sparks, puffs) {
    var o = this.o, n = 0;
    for (var i = this.list.length - 1; i >= 0; i--) {
      var q = this.list[i]; q.t += dt; if (q.t >= q.life) { this.list.splice(i, 1); continue; }
      q.vy -= 26 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rx += q.wx * dt; q.ry += q.wy * dt;
      var g = H(q.x, q.z) + q.s * .45;
      if (q.y < g) { q.y = g; if (q.vy < 0) { q.vy = -q.vy * .28; q.vx *= .55; q.vz *= .55; q.wx *= .5; q.wy *= .5; if (q.vy < 1.5) q.vy = 0; } }
      if (q.t < .7) { q.acc += dt; if (q.acc > .05) { q.acc = 0; sparks.add(q.x, q.y, q.z, rr(-1, 1), rr(0, 2), rr(-1, 1), .45, .55, FIRE, 2, 0); if (q.hot) puffs.add({ x: q.x, y: q.y, z: q.z, vy: 1, life: rr(1.6, 2.4), s0: q.s * .8, s1: q.s * 3, r: SOOT[0], g: SOOT[1], b: SOOT[2], a: .6, warm: 1, warmT: .3, wind: .5 }); } }
    }
    for (var j = 0; j < this.list.length && n < this.max; j++) {
      var d = this.list[j], k = d.t / d.life, sc = d.s * (k > .82 ? (1 - k) / .18 : 1);
      o.position.set(d.x, d.y, d.z); o.rotation.set(d.rx, d.ry, 0); o.scale.set(sc, sc * .8, sc * 1.1); o.updateMatrix();
      this.mesh.setMatrixAt(n++, o.matrix);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.visible = n > 0;
  };

  /* ================================================================ effets ponctuels */
  var FX = null;
  // moins de particules en qualité basse / moyenne (téléphones)
  function qn(n) { return Math.max(1, Math.round(n * (FX ? FX.q : 1))); }
  function live(life, upd) { var e = { t: 0, life: life, upd: upd, objs: [] }; FX.live.push(e); return e; }
  function own(e, o) { FX.root.add(o); e.objs.push(o); return o; }
  // les matériaux du gant (partagés avec le Colosse) et les géométries communes restent en place
  function disposeObj(o) { o.traverse(function (c) { if (c.geometry && !(c.geometry.userData && c.geometry.userData.keep)) c.geometry.dispose(); var m = c.material; if (m && !(m.userData && (m.userData.keep || m.userData.shared))) m.dispose(); }); }
  function kill(e) { e.objs.forEach(function (o) { if (o.parent) o.parent.remove(o); disposeObj(o); }); e.objs.length = 0; }
  function tickLive(dt) {
    for (var i = FX.live.length - 1; i >= 0; i--) {
      var e = FX.live[i]; e.t += dt; var k = e.t / e.life;
      if (k >= 1) { kill(e); FX.live.splice(i, 1); continue; }
      try { e.upd(e, k, dt); } catch (er) { warn(er); }
    }
  }
  function sprite(texture, color, size) { var s = L.sprite(null, texture, color, size, true, 0); return s; }
  function flash(x, y, z, color, s0, s1, life, op, tname) {
    // un éclair collé à la caméra remplirait tout l'écran : plus petit et plus doux quand on est tout près
    var cp = FX.view.camera.position, cf = cl(Math.hypot(cp.x - x, cp.y - y, cp.z - z) / 32); cf = .35 + .65 * cf; s0 *= cf; s1 *= cf; op *= .6 + .4 * cf;
    var e = live(life, function (e, k) { L.setOp(e.s, op * (1 - k) * (1 - k)); e.s.scale.setScalar(s0 + (s1 - s0) * eo(k)); });
    e.s = own(e, sprite(tex()[tname || "glow"], color, s0)); e.s.position.set(x, y, z); L.setOp(e.s, op);
    return e;
  }
  function ring(x, y, z, col, r0, r1, life, thick, op, nrm) {
    var me = new T.Mesh(plane(), ringMat(col, thick)); me.frustumCulled = false; me.renderOrder = 6;
    if (nrm) me.quaternion.setFromUnitVectors(V1.set(0, 0, 1), nrm); else me.rotation.x = -Math.PI / 2;
    me.position.set(x, y, z); me.scale.setScalar(r0);
    var e = live(life, function (e, k, dt) { var s = r0 + (r1 - r0) * eo(k); e.m.scale.set(s, s, s); var u = e.m.material.uniforms; u.op.value = op * (1 - k) * (1 - k * .4); u.time.value += dt; });
    e.m = own(e, me); return e;
  }
  function lightPulse(x, y, z, peak, life) { FX.pulse = { x: x, y: y, z: z, peak: peak, t: 0, life: life }; }
  function dustRing(x, y, z, n, rad, speed, size, col, life) {
    n = qn(n);
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.283 + R() * .3, sp = speed * rr(.65, 1.15), c = col || DUST;
      FX.puffs.add({ x: x + Math.cos(a) * rad, y: y + rr(.3, 1.4), z: z + Math.sin(a) * rad, vx: Math.cos(a) * sp, vy: rr(.5, 3.5), vz: Math.sin(a) * sp, drag: 2.3, rise: .5, life: life * rr(.8, 1.25), s0: size * .5, s1: size * rr(1.7, 2.5), r: c[0], g: c[1], b: c[2], a: .85, gy: y, flat: .25 });
    }
  }
  function sparkBurst(x, y, z, n, speed, col, life, size, grav, dir, spread) {
    n = qn(n);
    for (var i = 0; i < n; i++) {
      var u = R() * 2 - 1, a = R() * 6.283, s = Math.sqrt(1 - u * u), vx = s * Math.cos(a), vy = Math.abs(u) * .8 + .2, vz = s * Math.sin(a);
      if (dir) { var sp2 = spread == null ? .55 : spread; vx = dir.x + vx * sp2; vy = dir.y + vy * sp2; vz = dir.z + vz * sp2; var l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l; }
      var v = speed * rr(.35, 1);
      FX.sparks.add(x, y, z, vx * v, vy * v, vz * v, life * rr(.6, 1.2), size * rr(.6, 1.3), col, 1.6, grav);
    }
  }
  function debrisBurst(x, y, z, n, speed, up, size) {
    n = qn(n);
    var cam = FX.view.camera.position, cx = cam.x - x, cz = cam.z - z, cd = Math.hypot(cx, cz), near = cd < 40, ca = Math.atan2(cz, cx);
    for (var i = 0; i < n; i++) {
      // près de la caméra : les éclats partent sur les côtés et vers l'avant, pas dans l'objectif
      var a = near ? ca + Math.PI * (.45 + R() * 1.1) * (R() < .5 ? -1 : 1) : R() * 6.283, sp = speed * rr(.35, 1);
      FX.debris.add(x + Math.cos(a) * 1.5, y + .8, z + Math.sin(a) * 1.5, Math.cos(a) * sp, up * rr(.5, 1.3), Math.sin(a) * sp, size * rr(.45, 1.35), rr(3, 5.5), !near && i < 8);
    }
  }
  function crater(x, z, size, life, glow) {
    var Xt = tex(), geo = decalGeo(x, z, size, 14);
    var sc = new T.Mesh(geo, new T.MeshBasicMaterial({ map: Xt.scorch, transparent: true, depthWrite: false, opacity: .95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    sc.position.set(x, 0, z); sc.renderOrder = 2; sc.frustumCulled = false;
    var ck = new T.Mesh(geo, addMat(Xt.crack[(R() * 2) | 0], 0xff7a2a, 0)); ck.position.set(x, .02, z); ck.renderOrder = 3; ck.frustumCulled = false;
    var e = live(life, function (e, k) { e.sc.material.opacity = .95 * (1 - sm((k - .8) / .2)); e.ck.material.opacity = glow * (1 - sm(k / .7)) * (.7 + .3 * Math.sin(FX.time * 2.6 + x)); });
    e.sc = own(e, sc); e.ck = own(e, ck);
    return e;
  }
  function smokeColumn(x, y, z, dur, rate, size, col, warm) {
    var acc = 0; rate *= FX.q;
    live(dur, function (e, k, dt) {
      acc += dt * rate * (1 - k * .75);
      while (acc >= 1) { acc -= 1; FX.puffs.add({ x: x + rr(-2, 2), y: y + rr(0, 2), z: z + rr(-2, 2), vx: rr(-1, 1), vy: rr(3, 6), vz: rr(-1, 1), drag: .2, rise: .5, life: rr(8, 12), s0: size * .5, s1: size * rr(2.2, 3), r: col[0], g: col[1], b: col[2], a: .62, warm: warm * (1 - k), warmT: 1.3, gy: y }); }
    });
  }
  function shakeAt(x, y, z, amt, range) {
    var g = game(), me = g && g.player && g.player(), v = g && g.view; if (!me || !v || !v.addShake) return;
    var d = Math.hypot(me.x - x, (me.y - y) * .5, me.z - z); if (d > range) return;
    var k = 1 - d / range; v.addShake(amt * k * k);
  }
  function rays(x, y, z, color, s0, s1, life, op) {
    var e = live(life, function (e, k, dt) { L.setOp(e.s, op * (1 - k) * (1 - k)); e.s.scale.setScalar(s0 + (s1 - s0) * eo(k)); e.s.material.rotation += dt * .35; });
    e.s = own(e, sprite(tex().rays, color, s0)); e.s.position.set(x, y, z); L.setOp(e.s, op);
    return e;
  }
  function streak(a, b, r, cA, cB, life) {
    if (a.distanceTo(b) < .5) return;
    var me = Ribbon(32, r, cA, cB, { speed: 9, wob: .15 }), a0 = a.clone(), b0 = b.clone();
    var e = live(life, function (e, k, dt) { e.tt = (e.tt || 0) + dt; setRibbon(e.m, a0, b0, 1.1 * (1 - k) * (1 - k), e.tt); e.m.material.uniforms.width.value = r * (1 - .7 * k); });
    e.m = own(e, me);
  }

  /* ================================================================ construction */
  function curlParts(o, k) { o.traverse(function (c) { if (c.name === "tg-finger") c.rotation.x = k * 1.45; else if (c.name === "tg-thumb") { c.rotation.x = k * .9; c.rotation.z = -k * .45; } }); }
  function build(view, w) {
    teardown();
    var Xt = tex(), g = new T.Group(); g.name = "az-titan-fx"; view.scene.add(g);
    var G = M.state(w);
    FX = { view: view, world: w, root: g, q: view.quality === "low" ? .45 : view.quality === "medium" ? .75 : 1, time: 0, last: 0, seen: G.seq || 0, live: [], trail: [], trailT: 0, metPrev: null, metDist: 0, puffAcc: 0, ringAcc: 0, diveAcc: 0, beamAcc: 0, scorchAcc: 0, emberAcc: 0, glAcc: 0, pulse: null, steps: {}, tethers: {}, fist: {}, beamFade: 0, guardK: 0, chargeK: 0, prevBeam: {} };
    FX.puffs = new Puffs(720, Xt.smoke); g.add(FX.puffs.sys.mesh);
    var u = FX.puffs.sys.mat.uniforms; u.lightCol.value.setRGB(1, .97, .92); u.shadeCol.value.setRGB(.36, .35, .38);
    FX.sparks = new Sparks(1000, Xt.glow); g.add(FX.sparks.mesh);
    FX.debris = new Debris(g, 64);
    FX.light = new T.PointLight(0xff8a3a, 0, 140, 1.4); g.add(FX.light);
    FX.fistLight = new T.PointLight(0xff9a48, 0, 26, 1.5); g.add(FX.fistLight);
    // — le Gant qui tombe du ciel
    var met = FX.met = new T.Group(); met.visible = false; g.add(met);
    var mg = FX.metGl = LK.gauntlet ? LK.gauntlet(14) : new T.Mesh(new T.OctahedronGeometry(2), addMat(null, 0xff8a3a, 1)); curlParts(mg, .95); met.add(mg);
    var shockGeo = new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * .55); shockGeo.rotateX(Math.PI);
    FX.metShock = new T.Mesh(shockGeo, energyMat([1, .42, .1], [1.3, 1.1, .85], { speed: 7, sharp: 1.1, ends: 0, len: 8 })); FX.metShock.position.y = -1.3; FX.metShock.scale.set(3.6, 2.6, 3.6); met.add(FX.metShock);
    var tailGeo = new T.ConeGeometry(3.4, 1, 24, 1, true); tailGeo.translate(0, .5, 0);
    FX.metTail = new T.Mesh(tailGeo, energyMat([1, .38, .08], [1.3, .95, .55], { speed: -6, sharp: 1.3, ends: .02, tail: 1.6, len: 60 })); FX.metTail.position.y = -1.6; met.add(FX.metTail);
    FX.metGlow = sprite(Xt.glow, 0xff7a2a, 80); met.add(FX.metGlow);
    FX.metCore = sprite(Xt.glow, 0xfff2d8, 18); met.add(FX.metCore);
    FX.metFlare = sprite(Xt.flare, 0xffb070, 1); FX.metFlare.scale.set(150, 20, 1); met.add(FX.metFlare);
    // en plein jour une lueur additive disparaît dans le ciel clair : une vraie boule de feu orange, opaque
    FX.metBall = L.sprite(met, Xt.glow, 0xff7a1e, 30, false, 0); FX.metBall.renderOrder = 8;
    FX.metBallCore = L.sprite(met, Xt.glow, 0xfff2c0, 14, false, 0); FX.metBallCore.renderOrder = 9;
    FX.plume = new L.Plume(g, 96);
    FX.plume.mat.uniforms.lit.value.setRGB(.5, .47, .45); FX.plume.mat.uniforms.shade.value.setRGB(.17, .16, .17);
    FX.zone = new T.Mesh(plane(), ringMat([1, .35, .1], .1)); FX.zone.rotation.x = -Math.PI / 2; FX.zone.visible = false; FX.zone.frustumCulled = false; g.add(FX.zone);
    // — le Gant au sol : il flotte au-dessus du cratère sous un faisceau
    var gl = FX.gl = new T.Group(); gl.visible = false; g.add(gl);
    var gm = FX.glModel = LK.gauntlet ? LK.gauntlet(9) : new T.Mesh(new T.OctahedronGeometry(1.4), addMat(null, 0xff8a3a, 1)); gm.rotation.x = Math.PI; curlParts(gm, .55); gl.add(gm);
    FX.glHalo = sprite(Xt.glow, 0xff9a40, 9); FX.glHalo.position.y = 2.6; gl.add(FX.glHalo);
    var bGeo = new T.CylinderGeometry(1.2, 2.6, 1, 18, 1, true); bGeo.translate(0, .5, 0);
    FX.beacon = new T.Mesh(bGeo, energyMat([1, .5, .16], [1.3, 1.05, .8], { speed: 1.4, sharp: 1.2, ends: .01, tail: 1.4, len: 260 })); FX.beacon.scale.y = 260; FX.beacon.frustumCulled = false; g.add(FX.beacon); FX.beacon.visible = false;
    FX.glRing = new T.Mesh(plane(), ringMat([1, .55, .2], .35)); FX.glRing.rotation.x = -Math.PI / 2; FX.glRing.position.y = .35; FX.glRing.scale.setScalar(7); gl.add(FX.glRing);
    // — le Titan : lueur du poing, colonne d'énergie, plongeon, rayon, bouclier
    FX.aura = sprite(Xt.glow, 0xff8a3a, 3.4); g.add(FX.aura);
    var cGeo = new T.CylinderGeometry(1, 1.9, 1, 20, 1, true); cGeo.translate(0, .5, 0);
    FX.column = new T.Mesh(cGeo, energyMat([1, .5, .15], [1.3, 1.15, .9], { speed: -14, sharp: 1.25, ends: .02, len: 60 })); FX.column.visible = false; FX.column.frustumCulled = false; g.add(FX.column);
    var dGeo = new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * .55); dGeo.rotateX(Math.PI);
    FX.diveShock = new T.Mesh(dGeo, energyMat([1, .45, .12], [1.3, 1.1, .85], { speed: 8, sharp: 1.1, ends: 0, len: 6 })); FX.diveShock.visible = false; FX.diveShock.frustumCulled = false; g.add(FX.diveShock);
    FX.diveGlow = sprite(Xt.glow, 0xff8a3a, 14); g.add(FX.diveGlow);
    var beam = FX.beam = new T.Group(); beam.visible = false; g.add(beam);
    FX.beamLayers = [
      [Ribbon(48, 1.7, [1, .3, .06], [1.2, .7, .3], { speed: 5, wob: .12 }), .5],
      [Ribbon(48, .85, [1, .55, .18], [1.3, 1.05, .7], { speed: 12, wob: .08 }), 1],
      [Ribbon(48, .3, [1.3, 1.1, .8], [1.6, 1.55, 1.4], { speed: 20 }), 1.15],
      [Ribbon(64, .2, [1, .5, .15], [1.3, .95, .55], { speed: 16, helix: .95, phase: 0 }), .85],
      [Ribbon(64, .2, [1, .5, .15], [1.3, .95, .55], { speed: 16, helix: .95, phase: Math.PI }), .85]
    ];
    FX.beamLayers.forEach(function (l) { beam.add(l[0]); });
    FX.muzzle = sprite(Xt.glow, 0xfff0d0, 4); g.add(FX.muzzle);
    FX.muzzleFlare = sprite(Xt.flare, 0xffb070, 1); FX.muzzleFlare.scale.set(16, 3, 1); g.add(FX.muzzleFlare);
    FX.beamHit = sprite(Xt.glow, 0xffc070, 8); g.add(FX.beamHit);
    FX.beamHit2 = sprite(Xt.star, 0xfff0d0, 6); g.add(FX.beamHit2);
    FX.guard = new T.Mesh(new T.SphereGeometry(1, 40, 24), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false, uniforms: { time: { value: 0 }, op: { value: 0 }, hit: { value: 0 }, col: { value: new T.Vector3(1, .62, .25) } }, vertexShader: VS_G, fragmentShader: FS_G }));
    FX.guard.material.toneMapped = false; FX.guard.visible = false; FX.guard.frustumCulled = false; g.add(FX.guard);
    FX.arcs = [0, 1, 2].map(function (i) { var s = sprite(Xt.arcs[i % Xt.arcs.length], 0xffd8a0, 6); g.add(s); return s; });
  }
  function teardown() {
    if (!FX) return;
    try { FX.live.forEach(kill); if (FX.root.parent) FX.root.parent.remove(FX.root); disposeObj(FX.root); } catch (e) { warn(e); }
    FX = null;
  }

  /* ================================================================ le Gant : chute, impact, au sol */
  function meteor(w, G, dt, t, cam) {
    var falling = G.phase === "falling" && G.from, m = FX.met;
    m.visible = !!falling; FX.zone.visible = !!falling;
    if (falling) {
      var k = cl((w.elapsed - G.fallStart) / CFG.fall), kk = k * k;
      var px = G.from.x + (G.x - G.from.x) * kk, py = G.from.y + (G.y + 3 - G.from.y) * kk, pz = G.from.z + (G.z - G.from.z) * kk;
      m.position.set(px, py, pz);
      var d = V1.set(G.x - G.from.x, G.y - G.from.y, G.z - G.from.z).normalize();
      m.quaternion.setFromUnitVectors(DOWN, d); m.quaternion.multiply(Q1.setFromAxisAngle(UP, t * 1.7));
      var dist = cam.position.distanceTo(m.position), big = Math.max(1, dist / 450);
      L.setOp(FX.metGlow, .75); FX.metGlow.scale.setScalar(70 * big + 8 * Math.sin(t * 23));
      L.setOp(FX.metCore, 1); FX.metCore.scale.setScalar(16 * big);
      L.setOp(FX.metFlare, .35 + .15 * k); FX.metFlare.scale.set(150 * big, 18 * big, 1);
      var ball = Math.max(14, dist * .06); // de loin, une boule de feu bien visible (≈ 3,5° quelle que soit la distance)
      L.setOp(FX.metBall, .95); FX.metBall.scale.setScalar(ball * (1 + .07 * Math.sin(t * 29)));
      L.setOp(FX.metBallCore, 1); FX.metBallCore.scale.setScalar(ball * .48);
      var su = FX.metShock.material.uniforms; su.op.value = .85 + .15 * Math.sin(t * 31); su.time.value = t;
      var tu = FX.metTail.material.uniforms; tu.op.value = .9; tu.time.value = t; FX.metTail.scale.set(1 + .08 * Math.sin(t * 27), 34 + 30 * k, 1 + .08 * Math.sin(t * 19));
      // la traînée : un ruban de fumée continu (récent = rougeoyant) et des bouffées près du sol
      if (FX.metPrev) FX.metDist += m.position.distanceTo(FX.metPrev); else FX.metPrev = new T.Vector3();
      FX.metPrev.copy(m.position);
      FX.trailT += dt;
      if (FX.trailT > .11 || !FX.trail.length) { FX.trailT = 0; FX.trail.push({ x: px, y: py, z: pz, t: t, v: FX.metDist * .012 }); if (FX.trail.length > 95) FX.trail.shift(); }
      FX.puffAcc += dt;
      if (py - G.y < 520 && FX.puffAcc > .045 / FX.q) {
        FX.puffAcc = 0;
        FX.puffs.add({ x: px + rr(-2, 2), y: py + rr(-2, 2), z: pz + rr(-2, 2), vx: rr(-1, 1), vy: rr(0, 1.5), vz: rr(-1, 1), drag: .3, rise: .25, life: rr(12, 17), s0: 6, s1: rr(26, 38), r: SOOT[0], g: SOOT[1], b: SOOT[2], a: .75, warm: 1, warmT: .7, fin: .3 });
      }
      for (var i = 0; i < 3; i++) FX.sparks.add(px + rr(-2, 2), py + rr(-2, 2), pz + rr(-2, 2), -d.x * 30 + rr(-8, 8), -d.y * 30 + rr(-8, 8), -d.z * 30 + rr(-8, 8), rr(.4, .9), rr(.9, 1.8), FIRE, 1.2, 4);
      FX.light.position.copy(m.position); FX.light.intensity = 260 * k * k;
      // la zone d'impact rougeoie de plus en plus
      FX.zone.position.set(G.x, G.y + .5, G.z); FX.zone.scale.setScalar(16 + 2 * Math.sin(t * 5));
      var zu = FX.zone.material.uniforms; zu.op.value = (.25 + .5 * k) * (.75 + .25 * Math.sin(t * (5 + 10 * k))); zu.time.value = t;
    } else FX.metPrev = null;
    // la fumée reste dans le ciel et se défait lentement
    var pts = FX.ptsBuf || (FX.ptsBuf = []), n = 0;
    while (FX.trail.length && t - FX.trail[0].t > 34) FX.trail.shift();
    for (var j = 0; j < FX.trail.length; j++) {
      var p = FX.trail[j], age = t - p.t, q = pts[n] || (pts[n] = {});
      q.x = p.x + age * 1.1; q.y = p.y + age * .35; q.z = p.z + age * .5; q.w = Math.max(Math.min(48, 4 + age * 3.2), Math.hypot(q.x - cam.position.x, q.y - cam.position.y, q.z - cam.position.z) * .011); q.age = age; q.f = 1 - sm((age - 14) / 18); q.v = p.v; n++;
    }
    if (falling && n) { var hq = pts[n] || (pts[n] = {}); hq.x = m.position.x; hq.y = m.position.y; hq.z = m.position.z; hq.w = Math.max(3.5, dist * .009); hq.age = 0; hq.f = 1; hq.v = FX.metDist * .012; n++; }
    FX.plume.update(pts, n, cam.position, t);
  }
  function onImpact(x, y, z) {
    flash(x, y + 6, z, 0xfff2d8, 18, 105, .7, .85, "glow");
    flash(x, y + 3, z, 0xff8a3a, 16, 80, 1.5, .7, "soft");
    rays(x, y + 5, z, 0xffc890, 20, 120, 1.2, .8);
    ring(x, y + .6, z, [1.2, .6, .25], 4, 85, 1.4, .16, 1);
    ring(x, y + .7, z, [1.3, 1.1, .8], 2, 48, .9, .3, .85);
    dustRing(x, y, z, 42, 6, 44, 9, DUST, 6.5);
    for (var i = 0, nd = qn(34); i < nd; i++) {
      var a = R() * 6.283, el = rr(.2, 1.35), sp = rr(14, 34);
      FX.puffs.add({ x: x, y: y + 2, z: z, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(a) * Math.cos(el) * sp, drag: 2.1, rise: 1.3, life: rr(6, 10), s0: 6, s1: rr(16, 28), r: SOOT[0] * .7, g: SOOT[1] * .7, b: SOOT[2] * .7, a: .95, warm: 1, warmT: .9, gy: y });
    }
    debrisBurst(x, y, z, 30, 26, 22, 1.25);
    sparkBurst(x, y + 2, z, 140, 48, FIRE, 1.7, 1.5, 22);
    crater(x, z, 28, 75, 1);
    smokeColumn(x, y, z, 24, 3.6, 8, SOOT, .9);
    lightPulse(x, y + 10, z, 1400, 1.8);
    shakeAt(x, y, z, 1.1, 280);
  }
  function groundGl(w, G, dt, t, cam) {
    var on = G.phase === "ground", gl = FX.gl, b = FX.beacon;
    // tout près, le faisceau et le halo s'effacent (sinon la caméra est dedans et tout l'écran blanchit)
    var near = sm((Math.hypot(cam.position.x - G.x, cam.position.z - G.z) - 5) / 22);
    gl.visible = on;
    var showB = on || (G.phase === "falling" && G.from);
    b.visible = !!showB;
    if (showB) {
      b.position.set(G.x, G.y, G.z);
      var bu = b.material.uniforms; bu.time.value = t; bu.op.value = (on ? .55 + .1 * Math.sin(t * 3) : .22 + .12 * Math.sin(t * 6)) * (.12 + .88 * near);
      b.scale.x = b.scale.z = on ? 1 : .55;
    }
    if (!on) return;
    gl.position.set(G.x, G.y, G.z);
    FX.glModel.rotation.y = t * .9; FX.glModel.position.y = 2.7 + Math.sin(t * 2.1) * .35;
    var pul = .8 + .2 * Math.sin(t * 4);
    L.setOp(FX.glHalo, .6 * pul * (.3 + .7 * near)); FX.glHalo.position.y = FX.glModel.position.y; FX.glHalo.scale.setScalar(9 + 1.5 * Math.sin(t * 3));
    var ru = FX.glRing.material.uniforms; ru.op.value = .55 * pul; ru.time.value = t;
    if (!FX.pulse) { FX.light.position.set(G.x, G.y + 4, G.z); FX.light.intensity = 90 * pul; }
    FX.glAcc += dt;
    while (FX.glAcc > .07) { FX.glAcc -= .07; var a = R() * 6.283, r = rr(.5, 2.4); FX.sparks.add(G.x + Math.cos(a) * r, G.y + rr(.5, 3.5), G.z + Math.sin(a) * r, Math.cos(a) * .6, rr(2, 5), Math.sin(a) * .6, rr(.8, 1.6), rr(.25, .5), GOLD, .5, -1); }
  }

  /* ================================================================ le Titan */
  function fistOf(h) {
    var f = FX.fist[h.id];
    if (f && clock() - f.at < .25) return f;
    var fw = M.fwd ? M.fwd(h.yaw) : { x: -Math.sin(h.yaw), z: -Math.cos(h.yaw) }, rx = Math.cos(h.yaw), rz = -Math.sin(h.yaw), s = h._tAsc ? 1.15 : SCALE;
    return { x: h.x + rx * .55 * s + fw.x * .3 * s, y: h.y + 1.25 * s, z: h.z + rz * .55 * s + fw.z * .3 * s, kx: fw.x, ky: 0, kz: fw.z, at: 0, fallback: true };
  }
  function titanFx(w, h, me, dt, t) {
    var vis = !!h;
    L.setOp(FX.aura, 0); FX.fistLight.intensity = 0; FX.column.visible = false; FX.diveShock.visible = false; L.setOp(FX.diveGlow, 0);
    FX.arcs.forEach(function (s) { L.setOp(s, 0); });
    if (!vis) { beamFx(null, dt, t); guardFx(null, dt, t); return; }
    var F = fistOf(h), A = h._tAsc;
    // lueur du poing et braises
    L.setOp(FX.aura, (A && A.phase !== "fall" && A.phase !== "clench" ? .35 : .5) + .12 * Math.sin(t * 5)); FX.aura.position.set(F.x, F.y, F.z); FX.aura.scale.setScalar(3.4 * (A ? 1 : 1.25));
    FX.fistLight.position.set(F.x, F.y, F.z); FX.fistLight.intensity = 26 + 6 * Math.sin(t * 7);
    FX.emberAcc += dt;
    while (FX.emberAcc > .09) { FX.emberAcc -= .09; FX.sparks.add(F.x + rr(-.3, .3), F.y + rr(-.3, .3), F.z + rr(-.3, .3), rr(-.6, .6), rr(1.5, 3.5), rr(-.6, .6), rr(.5, 1), rr(.18, .32), FIRE, .8, -.5); }
    if (A) ascension(h, A, F, dt, t);
    else stepsFx(h, dt, t);
    // éclairs autour du poing juste après qu'il s'est serré
    var cAt = FX.clenchAt && FX.clenchAt[h.id];
    if (cAt != null && t - cAt < 1.1) { var ck = 1 - (t - cAt) / 1.1; FX.arcs.forEach(function (s, i) { L.setOp(s, ck * (R() < .7 ? .9 : .2)); s.position.set(F.x + rr(-.4, .4), F.y + rr(-.4, .4), F.z + rr(-.4, .4)); s.scale.setScalar(rr(3, 6.5) * (A ? 1.2 : 1)); s.material.rotation = R() * 6.28; }); }
    beamFx(h, dt, t);
    guardFx(h, dt, t);
  }
  function ascension(h, A, F, dt, t) {
    var C = CFG.asc, col = FX.column;
    if (A.phase === "lift" || A.phase === "rise" || A.phase === "hover") {
      var bot = A.y0 - .4, top = h.y + 1.4, len = Math.max(1, top - bot), fade = A.phase === "hover" ? 1 - cl(A.t / C.hover) : A.phase === "lift" ? sm(A.t / C.lift) : 1;
      col.visible = true; col.position.set(A.x, bot, A.z); col.scale.set(1 + .06 * Math.sin(t * 17), len, 1 + .06 * Math.sin(t * 13));
      var cn = sm((Math.hypot(FX.view.camera.position.x - A.x, FX.view.camera.position.z - A.z) - 2) / 14); // près de la caméra, la colonne s'efface
      var cu = col.material.uniforms; cu.op.value = .8 * fade * (.25 + .75 * cn); cu.len.value = len; cu.time.value = t;
      FX.ringAcc += dt;
      if (A.phase !== "hover" && FX.ringAcc > .16) { FX.ringAcc = 0; risingRing(A.x, bot, A.z, h); }
      for (var i = 0; i < 4; i++) FX.sparks.add(A.x + rr(-1.6, 1.6), bot + R() * len, A.z + rr(-1.6, 1.6), rr(-.5, .5), rr(35, 70), rr(-.5, .5), rr(.3, .6), rr(.4, .8), GOLD, 0, 0);
      if (A.phase === "rise") { FX.diveAcc += dt; if (FX.diveAcc > .05) { FX.diveAcc = 0; FX.puffs.add({ x: A.x + rr(-3, 3), y: A.y0 + .5, z: A.z + rr(-3, 3), vx: rr(-6, 6), vy: rr(1, 3), vz: rr(-6, 6), drag: 1.6, rise: .3, life: rr(3, 5), s0: 3, s1: rr(9, 14), r: DUST[0], g: DUST[1], b: DUST[2], a: .7, gy: A.y0, flat: .2 }); } }
    }
    if (A.phase === "fall") {
      var sp = A.vy / C.vmax;
      FX.diveShock.visible = true; FX.diveShock.position.set(F.x, F.y - 1.2, F.z); FX.diveShock.scale.set(2.6, 1.6 + 1.6 * sp, 2.6);
      var du = FX.diveShock.material.uniforms; du.op.value = .25 + .7 * sp; du.time.value = t;
      L.setOp(FX.diveGlow, .45 + .3 * sp); FX.diveGlow.position.set(F.x, F.y - .6, F.z); FX.diveGlow.scale.setScalar(10 + 8 * sp);
      FX.diveAcc += dt;
      while (FX.diveAcc > .035 / FX.q) {
        FX.diveAcc -= .035 / FX.q;
        FX.puffs.add({ x: h.x + rr(-.8, .8), y: h.y + 1.6 * SCALE + rr(-1, 1), z: h.z + rr(-.8, .8), vx: rr(-1.5, 1.5), vy: rr(-1, 1), vz: rr(-1.5, 1.5), drag: .8, rise: .4, life: rr(2.5, 4), s0: 2.2, s1: rr(8, 13), r: SOOT[0], g: SOOT[1], b: SOOT[2], a: .7 * sp + .1, warm: 1, warmT: .35, wind: .3 });
        FX.sparks.add(F.x + rr(-1, 1), F.y + rr(-1, 1), F.z + rr(-1, 1), rr(-6, 6), rr(10, 30), rr(-6, 6), rr(.3, .7), rr(.6, 1.2), FIRE, 1.5, 0);
      }
      var g = game(), meP = g && g.player && g.player(); if (meP === h && g.view && g.view.addShake) g.view.addShake(dt * .9 * sp);
    }
  }
  function risingRing(x, y0, z, h) {
    var me = new T.Mesh(plane(), ringMat([1.2, .75, .3], .3)); me.rotation.x = -Math.PI / 2; me.frustumCulled = false; me.renderOrder = 6;
    var e = live(.65, function (e, k, dt) { var top = h.y + .8, y = y0 + (top - y0) * eo(k); e.m.position.set(x, y, z); var s = 5.2 - 2.6 * k; e.m.scale.setScalar(s); var u = e.m.material.uniforms; u.op.value = 1.1 * (1 - k); u.time.value += dt; });
    e.m = own(e, me); e.m.position.set(x, y0, z);
  }
  function stepsFx(h, dt, t) {
    var s = FX.steps[h.id] || (FX.steps[h.id] = { x: h.x, z: h.z, acc: 0, side: 0 }), sp = Math.hypot(h.x - s.x, h.z - s.z) / Math.max(dt, 1e-3);
    s.x = h.x; s.z = h.z;
    if (!h.grounded || sp < 2 || sp > 40) { s.acc = 0; return; }
    s.acc += dt;
    if (s.acc > .33) {
      s.acc = 0; s.side ^= 1;
      var f = FX.fist[h.id], foot = f && f.feet ? f.feet[s.side] : null, fx2 = foot ? foot.x : h.x, fz = foot ? foot.z : h.z;
      for (var i = 0; i < 3; i++) FX.puffs.add({ x: fx2 + rr(-.4, .4), y: h.y + .3, z: fz + rr(-.4, .4), vx: rr(-2, 2), vy: rr(.5, 1.5), vz: rr(-2, 2), drag: 2.5, rise: .3, life: rr(1.4, 2.2), s0: .8, s1: rr(2.4, 3.4), r: DUST[0], g: DUST[1], b: DUST[2], a: .55, gy: h.y, flat: .3 });
    }
  }
  function beamFx(h, dt, t) {
    var b = FX.beam, firing = h && h._tBeam > 0 && h._tBeamEnd && !(h._tBeamCharge > 0), charging = h && h._tBeam > 0 && h._tBeamCharge > 0;
    FX.beamFade = firing ? 1 : Math.max(0, FX.beamFade - dt * 6);
    L.setOp(FX.muzzle, 0); L.setOp(FX.muzzleFlare, 0); L.setOp(FX.beamHit, 0); L.setOp(FX.beamHit2, 0);
    if (charging) {
      var F0 = fistOf(h), ck = 1 - h._tBeamCharge / Math.max(.01, CFG.beam.charge);
      L.setOp(FX.muzzle, .5 + .5 * ck); FX.muzzle.position.set(F0.x, F0.y, F0.z); FX.muzzle.scale.setScalar(1 + 5 * ck + .5 * Math.sin(t * 40));
      for (var i = 0; i < 5; i++) { var a = R() * 6.283, u = R() * 2 - 1, s = Math.sqrt(1 - u * u), r = rr(2.5, 4.5), ox = s * Math.cos(a) * r, oy = u * r, oz = s * Math.sin(a) * r; FX.sparks.add(F0.x + ox, F0.y + oy, F0.z + oz, -ox * 5, -oy * 5, -oz * 5, .2, rr(.3, .6), GOLD, 0, 0); }
      FX.fistLight.intensity = 30 + 90 * ck;
    }
    b.visible = FX.beamFade > .01 && !!(h && h._tBeamEnd);
    if (!b.visible) return;
    var F = fistOf(h), E = h._tBeamEnd, o = V2.set(F.x, F.y, F.z), en = V3.set(E.x, E.y, E.z), dir = V4.copy(en).sub(o), len = dir.length();
    if (len < .5) { b.visible = false; return; }
    dir.divideScalar(len); o.addScaledVector(dir, .35); len -= .35;
    var fd = FX.beamFade, e2 = V5.copy(o).addScaledVector(dir, len);
    FX.beamLayers.forEach(function (l) { setRibbon(l[0], o, e2, l[1] * fd, t); });
    L.setOp(FX.muzzle, fd); FX.muzzle.position.copy(o); FX.muzzle.scale.setScalar(4.5 + .8 * Math.sin(t * 50));
    L.setOp(FX.muzzleFlare, .6 * fd); FX.muzzleFlare.position.copy(o);
    L.setOp(FX.beamHit, fd); FX.beamHit.position.copy(en); FX.beamHit.scale.setScalar(8 + 3 * Math.sin(t * 33));
    L.setOp(FX.beamHit2, .8 * fd); FX.beamHit2.position.copy(en); FX.beamHit2.scale.setScalar(6 + 4 * R()); FX.beamHit2.material.rotation = R() * 6.28;
    if (!firing) return;
    FX.light.position.copy(en); FX.light.intensity = Math.max(FX.light.intensity, 160 + 60 * Math.sin(t * 41));
    FX.fistLight.intensity = 80;
    // l'impact : gerbes d'étincelles, fumée, brûlures au sol
    for (var j = 0; j < 7; j++) FX.sparks.add(en.x, en.y + .2, en.z, -dir.x * 8 + rr(-9, 9), rr(3, 14), -dir.z * 8 + rr(-9, 9), rr(.3, .7), rr(.4, .9), FIRE, 1.2, 18);
    FX.beamAcc += dt;
    if (FX.beamAcc > .07) { FX.beamAcc = 0; FX.puffs.add({ x: en.x + rr(-.6, .6), y: en.y + .5, z: en.z + rr(-.6, .6), vx: rr(-1, 1), vy: rr(2.5, 4.5), vz: rr(-1, 1), drag: .6, rise: .5, life: rr(2.5, 4), s0: 1.5, s1: rr(5, 8), r: SOOT[0], g: SOOT[1], b: SOOT[2], a: .7, warm: 1, warmT: .4, gy: E.ground ? en.y : null }); }
    FX.scorchAcc += dt;
    if (E.ground && FX.scorchAcc > .22) { FX.scorchAcc = 0; crater(en.x, en.z, 4.5, 9, .8); }
    var g = game(), meP = g && g.player && g.player(); if (meP === h && g.view && g.view.addShake) g.view.addShake(dt * .35);
  }
  function guardFx(h, dt, t) {
    var on = !!(h && h._tGuard > 0 && !h._tAsc);
    FX.guardK += ((on ? 1 : 0) - FX.guardK) * (1 - Math.exp(-dt * (on ? 10 : 6)));
    FX.guard.visible = FX.guardK > .01 && !!h;
    if (!FX.guard.visible) return;
    var u = FX.guard.material.uniforms, last = h._tGuard < .6 ? (Math.sin(t * 30) > 0 ? .55 : 1) : 1;
    u.time.value = t; u.op.value = FX.guardK * .8 * last;
    var hp = (h.hp || 0) + (h.shield || 0); if (FX.guardHp != null && hp < FX.guardHp - .5) u.hit.value = 1; FX.guardHp = hp; u.hit.value = Math.max(0, u.hit.value - dt * 4);
    FX.guard.position.set(h.x, h.y + 1.05 * SCALE, h.z); FX.guard.scale.setScalar(1.75 * SCALE * (1 + .02 * Math.sin(t * 7)) * (.6 + .4 * FX.guardK)); FX.guard.rotation.y = t * .5;
  }
  // attraction : liens d'énergie entre le poing et chaque victime
  function pulls(w, dt, t) {
    var seen = {};
    w.players.forEach(function (q) {
      if (!q._tPull || !(q._tPull.t > 0) || !q.alive) return;
      var h = w._find(q._tPull.id); if (!h || !h.alive) return;
      var F = fistOf(h), key = q.id; seen[key] = 1;
      var me = FX.tethers[key];
      if (!me) { me = FX.tethers[key] = Ribbon(24, .3, [1, .5, .15], [1.3, 1.1, .8], { speed: -16, wob: .3, helix: .25 }); FX.root.add(me); }
      var a = V2.set(F.x, F.y, F.z), b = V3.set(q.x, q.y + 1.1, q.z);
      setRibbon(me, a, b, a.distanceTo(b) > .5 ? 1.1 * cl(q._tPull.t / .25) : 0, t);
      if (R() < .5) FX.sparks.add(b.x, b.y, b.z, rr(-2, 2), rr(-1, 2), rr(-2, 2), .3, .5, GOLD, 1, 0);
    });
    Object.keys(FX.tethers).forEach(function (k) { if (!seen[k]) { var me = FX.tethers[k]; FX.root.remove(me); disposeObj(me); delete FX.tethers[k]; } });
  }

  /* ================================================================ événements de la simulation */
  function events(w, G) {
    var list = G.fx || [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i]; if (ev.seq <= FX.seen) continue;
      FX.seen = ev.seq;
      try { onEvent(w, ev); } catch (e) { warn(e); }
    }
  }
  function onEvent(w, ev) {
    var x = ev.x, y = ev.y, z = ev.z, h = ev.id != null ? w._find(ev.id) : null, F = h ? fistOf(h) : null, t = FX.time;
    switch (ev.type) {
      case "meteor": FX.trail.length = 0; FX.metDist = 0; FX.metPrev = null; break;
      case "impact": onImpact(x, y, z); break;
      case "pickup":
        flash(x, y + 2, z, 0xfff0d0, 4, 26, .8, 1, "glow");
        ring(x, y + .4, z, [1.2, .7, .3], 2, 22, .9, .25, 1);
        dustRing(x, y, z, 24, 2, 26, 5, DUST, 4);
        sparkBurst(x, y + 1.5, z, 60, 26, GOLD, 1.1, 1, 6, UP, .9);
        lightPulse(x, y + 4, z, 500, 1.2);
        shakeAt(x, y, z, .45, 90);
        break;
      case "clench": {
        var cx = F ? F.x : x, cy = F ? F.y : y + 3, cz = F ? F.z : z;
        (FX.clenchAt || (FX.clenchAt = {}))[ev.id] = t;
        flash(cx, cy, cz, 0xfff2d8, .5, 9, .45, 1, "glow");
        flash(cx, cy, cz, 0xff8a3a, 3, 60, 1.3, .4, "soft");
        rays(cx, cy, cz, 0xffd0a0, 4, 90, 1.4, .75);
        ring(cx, cy - 1, cz, [1.3, .75, .35], 4, 180, 1.7, .1, 1);
        ring(cx, cy - 1, cz, [1.3, 1.1, .8], 2, 90, 1.1, .2, .7);
        sparkBurst(cx, cy, cz, 110, 40, GOLD, 1.5, 1.3, 4);
        lightPulse(cx, cy + 6, cz, 380, 1.1);
        shakeAt(cx, cy, cz, .7, 300);
        break;
      }
      case "dive":
        ring(x, y - 1, z, [1.2, .7, .3], 3, 30, .7, .2, .9);
        flash(x, y, z, 0xffc070, 6, 22, .5, .8, "glow");
        break;
      case "landing": {
        var r = CFG.landing.r;
        flash(x, y + 3, z, 0xfff2d8, 10, 75, .75, 1, "glow");
        flash(x, y + 2, z, 0xff8a3a, 10, 55, 1.2, .6, "soft");
        ring(x, y + .5, z, [1.2, .6, .25], 3, r * 2.7, 1.1, .2, 1);
        ring(x, y + .6, z, [1.3, 1.1, .8], 2, r * 1.5, .75, .3, .85);
        dustRing(x, y, z, 34, 3.5, 36, 6, DUST, 5);
        debrisBurst(x, y, z, 18, 17, 15, .75);
        sparkBurst(x, y + 1, z, 90, 32, FIRE, 1.3, 1.2, 22);
        crater(x, z, 19, 32, .95);
        smokeColumn(x, y, z, 6, 4, 5, DUST, .4);
        lightPulse(x, y + 5, z, 420, 1);
        shakeAt(x, y, z, 1.2, 140);
        break;
      }
      case "drop":
        flash(x, y + 2, z, 0xffc070, 6, 30, 1, 1, "glow");
        ring(x, y + .4, z, [1.2, .65, .3], 2, 18, .9, .25, .9);
        dustRing(x, y, z, 18, 1.5, 18, 4, DUST, 3.5);
        sparkBurst(x, y + 1.5, z, 50, 22, GOLD, 1, 1, 10);
        break;
      case "punch": {
        var d = h ? (M.fwd ? M.fwd(h.yaw) : { x: -Math.sin(h.yaw), z: -Math.cos(h.yaw) }) : { x: 0, z: 1 }, dv = V5.set(d.x, 0, d.z).normalize(), hit = ev.hit > 0;
        ring(x, y, z, [1.3, .8, .4], .4, hit ? 3.2 : 2.3, hit ? .32 : .24, .35, hit ? .75 : .5, dv.clone());
        flash(x, y, z, 0xffc070, 1.5, hit ? 9 : 6, .28, hit ? 1 : .7, "glow");
        sparkBurst(x, y, z, hit ? 40 : 14, hit ? 26 : 16, FIRE, .55, .8, 10, dv, .7);
        if (hit) { flash(x, y, z, 0xfff0d0, 1, 5, .18, 1, "star"); var g = game(), meP = g && g.player && g.player(); if (meP === h && g.view && g.view.addShake) g.view.addShake(.22); else shakeAt(x, y, z, .25, 12); }
        break;
      }
      case "beam":
        if (F) ring(F.x, F.y, F.z, [1.3, .8, .4], 4, .5, CFG.beam.charge + .05, .3, .9, V5.set(0, 0, 1).applyQuaternion(FX.view.camera.quaternion).clone());
        break;
      case "leap":
        dustRing(x, y, z, 16, 1.5, 16, 4, DUST, 3);
        ring(x, y + .4, z, [1.1, .7, .3], 1.5, 8, .5, .25, .7);
        break;
      case "slam": {
        var sr = CFG.slam.r;
        flash(x, y + 1.5, z, 0xffc070, 6, 30, .55, .9, "glow");
        ring(x, y + .5, z, [1.2, .6, .25], 2, sr * 1.8, .8, .2, 1);
        ring(x, y + .6, z, [1.3, 1.1, .8], 1, sr * 1.1, .55, .3, .8);
        dustRing(x, y, z, 30, 2, 30, 5.5, DUST, 4.5);
        debrisBurst(x, y, z, 14, 13, 13, .7);
        sparkBurst(x, y + .5, z, 50, 24, FIRE, 1, 1, 22);
        crater(x, z, 11, 12, .8);
        shakeAt(x, y, z, .7, 70);
        break;
      }
      case "blink": {
        var a0 = new T.Vector3(x, y + 1.2 * SCALE, z), b0 = new T.Vector3(ev.tx, ev.ty + 1.2 * SCALE, ev.tz);
        flash(a0.x, a0.y, a0.z, 0xffc070, 8, 2, .35, 1, "glow");
        for (var k = 0; k < 40; k++) { var aa = R() * 6.283, rr2 = rr(2, 4); FX.sparks.add(a0.x + Math.cos(aa) * rr2, a0.y + rr(-2, 2), a0.z + Math.sin(aa) * rr2, -Math.cos(aa) * rr2 * 6, rr(-2, 2), -Math.sin(aa) * rr2 * 6, .2, .7, GOLD, 0, 0); }
        streak(a0, b0, .9, [1, .5, .15], [1.3, 1.1, .8], .4);
        flash(b0.x, b0.y, b0.z, 0xfff0d0, 3, 14, .45, 1, "glow");
        ring(ev.tx, ev.ty + .4, ev.tz, [1.2, .75, .35], 1, 9, .45, .25, .9);
        sparkBurst(b0.x, b0.y, b0.z, 40, 20, GOLD, .7, .9, 6);
        break;
      }
      case "guard":
        flash(x, y + 1.05 * SCALE, z, 0xffc070, 3, 9, .35, .7, "glow");
        break;
      case "pull": {
        var pr = CFG.pull.r;
        ring(x, y + .5, z, [1.2, .7, .3], pr, 2, .8, .1, .9);
        for (var m2 = 0; m2 < 90; m2++) { var a2 = R() * 6.283, d2 = rr(6, pr), tx = -Math.sin(a2), tz = Math.cos(a2); FX.sparks.add(x + Math.cos(a2) * d2, y + rr(.3, 3), z + Math.sin(a2) * d2, tx * 14 - Math.cos(a2) * d2 * 1.2, rr(0, 2), tz * 14 - Math.sin(a2) * d2 * 1.2, rr(.5, .8), rr(.4, .8), GOLD, .5, 0); }
        if (F) flash(F.x, F.y, F.z, 0xffc070, 2, 7, .5, 1, "glow");
        break;
      }
    }
  }

  /* ================================================================ le corps : taille, gestes, poing */
  function titanScale(p) {
    var A = p._tAsc; if (!A) return SCALE;
    var C = CFG.asc;
    if (A.phase === "lift") return 1 + .03 * sm(A.t / C.lift);
    if (A.phase === "rise") return 1.03 + .12 * sm(A.t / C.rise);
    if (A.phase === "hover") return 1.15;
    if (A.phase === "clench") return 1.15 + (SCALE - 1.15) * elastic(cl(A.t / .55));
    return SCALE;
  }
  // les clips imposés au corps (montée, plongeon, atterrissage) : lus par Animator.set
  function prepAct(inst, p, w) {
    var A = p._tAsc, e = w.elapsed, o = null;
    if (A) {
      if (A.phase === "lift") o = { base: "Jump_Start", scale: .9, fade: .1 };
      else if (A.phase === "rise") o = { base: "Jump_Loop", scale: .35, fade: .3 };
      else if (A.phase === "hover" || A.phase === "clench") o = { base: "Idle_Loop", scale: .55, fade: .35 };
      else o = { base: "Jump_Loop", scale: .45, fade: .25 };
    } else if (p._tLandAt != null && e >= p._tLandAt && e - p._tLandAt < .85) o = { base: "Jump_Land", scale: .7, fade: .05 };
    else if (p._tSlamAt != null && e >= p._tSlamAt && e - p._tSlamAt < .5) o = { base: "Jump_Land", scale: 1, fade: .05 };
    inst.__tAct = o;
  }
  if (CH && CH.Animator && CH.Animator.prototype && !CH.Animator.prototype.__azTitanFx) {
    var AP = CH.Animator.prototype, set0 = AP.set; AP.__azTitanFx = true;
    AP.set = function (layer, name, part, fade, scale) {
      var o = this.inst && this.inst.__tAct;
      if (o && layer === "base" && o.base) { name = o.base; part = null; fade = o.fade; scale = o.scale; }
      return set0.call(this, layer, name, part, fade, scale);
    };
  }
  // bras : IK à deux os dans l'espace monde (même méthode que ch1-models)
  var _A = new T.Vector3(), _B = new T.Vector3(), _C = new T.Vector3(), _D = new T.Vector3(), _E = new T.Vector3(), _P = new T.Vector3(), _G = new T.Vector3(), _Dir = new T.Vector3(), _Bend = new T.Vector3(), _El = new T.Vector3(), _W = new T.Vector3();
  var _qa = new T.Quaternion(), _qb = new T.Quaternion(), _qc = new T.Quaternion();
  function aimBone(bone, childPos, want) {
    bone.getWorldPosition(_P);
    var v1 = _D.copy(childPos).sub(_P), v2 = _E.copy(want).sub(_P);
    if (v1.lengthSq() < 1e-8 || v2.lengthSq() < 1e-8) return;
    _qa.setFromUnitVectors(v1.normalize(), v2.normalize());
    bone.getWorldQuaternion(_qb); bone.parent.getWorldQuaternion(_qc);
    bone.quaternion.copy(_qc.invert().multiply(_qa).multiply(_qb));
    bone.updateMatrixWorld(true);
  }
  function solveArm(up, lo, hand, target, pole, weight) {
    if (!up || !lo || !hand || !(weight > .001)) return;
    up.getWorldPosition(_A); lo.getWorldPosition(_B); hand.getWorldPosition(_C);
    var l1 = _A.distanceTo(_B), l2 = _B.distanceTo(_C);
    _G.copy(_C).lerp(target, cl(weight)); _Dir.copy(_G).sub(_A);
    var d = _Dir.length(); if (d < 1e-4) return;
    _Dir.divideScalar(d); d = Math.min(d, (l1 + l2) * .999);
    var x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    _Bend.copy(pole).sub(_A); _Bend.addScaledVector(_Dir, -_Bend.dot(_Dir)); if (_Bend.lengthSq() < 1e-8) _Bend.set(0, -1, 0); _Bend.normalize();
    _El.copy(_A).addScaledVector(_Dir, x).addScaledVector(_Bend, hh);
    aimBone(up, _B, _El);
    lo.getWorldPosition(_B); hand.getWorldPosition(_C);
    aimBone(lo, _C, _W.copy(_A).addScaledVector(_Dir, d));
  }
  function rotWorld(bone, axis, ang) {
    if (!bone || !bone.parent || !ang) return;
    _qa.setFromAxisAngle(axis, ang); bone.getWorldQuaternion(_qb); bone.parent.getWorldQuaternion(_qc);
    bone.quaternion.copy(_qc.invert().multiply(_qa).multiply(_qb)); bone.updateMatrixWorld(true);
  }
  function findParts(inst) {
    var o = { g: null, fingers: [], thumb: null };
    inst.model.traverse(function (c) { if (c.name === "titan-gauntlet" && !o.g) o.g = c; else if (c.name === "tg-finger") o.fingers.push(c); else if (c.name === "tg-thumb") o.thumb = c; });
    return o.g ? o : false;
  }
  var _up = new T.Vector3(), _rt = new T.Vector3(), _fw = new T.Vector3(), _sh = new T.Vector3(), _tg = new T.Vector3(), _pl = new T.Vector3();
  function pose(model, inst, p, w, dt) {
    var B = inst.bones; if (!B || !B.upperarm_r || !B.lowerarm_r || !B.hand_r) return;
    if (inst.__tg == null) inst.__tg = findParts(inst);
    var parts = inst.__tg, A = p._tAsc, e = w.elapsed, s = model.scale.x, C = CFG.asc;
    // plongeon : tout le corps bascule tête la première, puis se redresse pour atterrir sur les pieds
    if (A && A.phase === "fall") {
      var hg = p.y - H(p.x, p.z), tilt = 1.3 * sm(A.t / .35) * sm((hg - 10) / 32);
      if (tilt > .001) { inst.model.matrix.multiply(M1.makeTranslation(0, .95, 0)).multiply(M2.makeRotationX(tilt)).multiply(M1.makeTranslation(0, -.95, 0)); }
    }
    model.updateMatrixWorld(true);
    var mw = inst.model.matrixWorld;
    _up.set(0, 1, 0).transformDirection(mw); _rt.set(-1, 0, 0).transformDirection(mw); _fw.set(0, 0, 1).transformDirection(mw);
    B.upperarm_r.getWorldPosition(_sh);
    _A.copy(_sh); B.lowerarm_r.getWorldPosition(_B); B.hand_r.getWorldPosition(_C);
    var reach = (_A.distanceTo(_B) + _B.distanceTo(_C)) * .985, W = 0, curl = .9;
    // 1. le bras droit
    if (A) {
      if (A.phase === "hover" || A.phase === "clench" || A.phase === "fall" || (A.phase === "rise" && A.t > C.rise - .45)) {
        W = A.phase === "rise" ? sm((A.t - (C.rise - .45)) / .45) * .7 : A.phase === "hover" ? .7 + .3 * sm(A.t / .3) : A.phase === "fall" ? sm((p.y - H(p.x, p.z) - 14) / 30) : 1;
        _tg.copy(_sh).addScaledVector(_up, reach).addScaledVector(_rt, .06 * s).addScaledVector(_fw, .1 * s);
        _pl.copy(_sh).addScaledVector(_rt, 1.2 * s).addScaledVector(_fw, -.3 * s);
        solveArm(B.upperarm_r, B.lowerarm_r, B.hand_r, _tg, _pl, W);
      }
      if (A.phase === "hover" || A.phase === "clench") {
        var look = A.phase === "hover" ? sm(A.t / .4) : 1;
        rotWorld(B.spine_03, _rt, .12 * look); rotWorld(B.neck_01, _rt, .32 * look); rotWorld(B.Head, _rt, .28 * look);
      }
      curl = A.phase === "clench" ? 1.12 * sm(A.t / .14) : A.phase === "fall" ? 1.12 : .05;
    } else {
      var lt = p._tLandAt != null ? e - p._tLandAt : 99, sl = p._tSlamAt != null ? e - p._tSlamAt : 99, pt = p._tPunchAt != null ? e - p._tPunchAt : 99, pu = p._tPullAt != null ? e - p._tPullAt : 99;
      if (lt >= 0 && lt < .8 || sl >= 0 && sl < .45) {
        // atterrissage : le poing frappe le sol devant lui
        var kk = lt < .8 ? lt : sl, len2 = lt < .8 ? .8 : .45;
        W = sm(kk / .1) * (1 - sm((kk - len2 * .55) / (len2 * .4)));
        _tg.set(p.x, p.y + .08 * s, p.z).addScaledVector(_fw, .55 * s).addScaledVector(_rt, .28 * s);
        _pl.copy(_sh).addScaledVector(_rt, 1 * s).addScaledVector(_up, .6 * s);
        solveArm(B.upperarm_r, B.lowerarm_r, B.hand_r, _tg, _pl, W); curl = 1.12;
      } else if (p._tBeam > 0 && p._tBeamEnd) {
        // le rayon : bras tendu vers la cible, main ouverte
        var bw = p._tBeamCharge > 0 ? sm((CFG.beam.charge - p._tBeamCharge) / .25) : 1;
        _tg.set(p._tBeamEnd.x, p._tBeamEnd.y, p._tBeamEnd.z).sub(_sh).normalize().multiplyScalar(reach).add(_sh);
        _pl.copy(_sh).addScaledVector(_rt, .7 * s).addScaledVector(_up, -.9 * s);
        solveArm(B.upperarm_r, B.lowerarm_r, B.hand_r, _tg, _pl, bw); curl = .08;
        rotWorld(B.spine_03, _up, .22 * bw);
      } else if (pt >= 0 && pt < .42) {
        // coup de poing du gant : armé, détendu, ramené (un direct puis un crochet montant)
        W = pt < .06 ? 0 : pt < .13 ? sm((pt - .06) / .07) : 1 - sm((pt - .2) / .2);
        var upper = (p._tPunchN || 0) % 2 === 0;
        _tg.copy(_sh).addScaledVector(_fw, reach * (upper ? .8 : .97)).addScaledVector(_rt, -.14 * s).addScaledVector(_up, (upper ? .32 : -.04) * s);
        _pl.copy(_sh).addScaledVector(_rt, .8 * s).addScaledVector(_up, -.6 * s);
        rotWorld(B.spine_03, _up, .38 * W); rotWorld(B.spine_02, _up, .18 * W);
        solveArm(B.upperarm_r, B.lowerarm_r, B.hand_r, _tg, _pl, W); curl = 1.12;
      } else if (pu >= 0 && pu < .75) {
        // attraction : main ouverte tendue, puis le poing se ferme et tire
        W = pu < .45 ? sm(pu / .12) : 1 - sm((pu - .45) / .3);
        var yank = sm((pu - .22) / .18);
        _tg.copy(_sh).addScaledVector(_fw, reach * (1 - .55 * yank)).addScaledVector(_up, .1 * s);
        _pl.copy(_sh).addScaledVector(_rt, .9 * s).addScaledVector(_up, -.5 * s);
        solveArm(B.upperarm_r, B.lowerarm_r, B.hand_r, _tg, _pl, W); curl = pu < .22 ? .05 : 1.12;
      } else if (p._tSlam && !p.grounded) {
        // saut écrasant : poing levé au-dessus de la tête
        _tg.copy(_sh).addScaledVector(_up, reach * .97).addScaledVector(_fw, .15 * s);
        _pl.copy(_sh).addScaledVector(_rt, 1 * s);
        solveArm(B.upperarm_r, B.lowerarm_r, B.hand_r, _tg, _pl, .85); curl = 1.12;
      }
    }
    // 2. les doigts du gant
    if (parts) {
      var k = 1 - Math.exp(-dt * 24); inst.__curl = inst.__curl == null ? curl : inst.__curl + (curl - inst.__curl) * k;
      var c = inst.__curl;
      for (var i = 0; i < parts.fingers.length; i++) parts.fingers[i].rotation.x = c * (1.32 + i * .05);
      if (parts.thumb) { parts.thumb.rotation.x = c * .85; parts.thumb.rotation.z = -c * .45; }
    }
    model.updateMatrixWorld(true);
    // 3. on note où est le poing (le rayon et les lueurs partent de là) et les pieds (poussière des pas)
    var f = FX && FX.fist ? (FX.fist[p.id] || (FX.fist[p.id] = { feet: [{}, {}] })) : null;
    if (f) {
      if (parts) { V1.set(0, -.075, -.012).applyMatrix4(parts.g.matrixWorld); V2.set(0, -1, 0).transformDirection(parts.g.matrixWorld); }
      else { B.hand_r.getWorldPosition(V1); V2.copy(_fw); }
      f.x = V1.x; f.y = V1.y; f.z = V1.z; f.kx = V2.x; f.ky = V2.y; f.kz = V2.z; f.at = clock(); f.fallback = false;
      if (B.foot_l) { B.foot_l.getWorldPosition(V3); f.feet[0].x = V3.x; f.feet[0].z = V3.z; }
      if (B.foot_r) { B.foot_r.getWorldPosition(V3); f.feet[1].x = V3.x; f.feet[1].z = V3.z; }
    }
  }
  if (!VP.__azTitanFx) {
    VP.__azTitanFx = true;
    var an0 = VP.animateAvatar;
    VP.animateAvatar = function (model, player, dt, options) {
      var g = game(), w = g && g.world, titan = !!(model && player && player._titan && w && w.titanMode && !(options && options.menu)), s = 1, u = model && model.userData, inst = u && u.ch1;
      if (titan) { s = titanScale(player); model.scale.set(s, s, s); u.azTitanScaled = true; if (inst) { try { prepAct(inst, player, w); } catch (e) { warn(e); } } }
      else if (u && u.azTitanScaled) { model.scale.set(1, 1, 1); u.azTitanScaled = false; if (inst) inst.__tAct = null; }
      else if (inst && inst.__tAct) inst.__tAct = null;
      var r = an0.apply(this, arguments);
      if (titan) {
        model.scale.x = model.scale.z = s; // le corps garde sa largeur (accroupi / nage ne touchent que la hauteur)
        inst = u.ch1;
        if (inst && inst.bones) { try { pose(model, inst, player, w, Math.min(.1, Math.max(0, +dt || 0))); } catch (e) { warn(e); } }
      }
      return r;
    };
  }

  /* ================================================================ caméra */
  var camS = null;
  function camera(me, dt) {
    var E = root.AZEvent || (root.AZEvent = {}), want = null;
    if (me && me._titan && me.alive) {
      var A = me._tAsc, C = CFG.asc;
      want = [1.6, 3.4, 1.4];
      if (A) {
        if (A.phase === "lift" || A.phase === "rise") want = [1.25 + .35 * sm(A.t / C.rise), 2.5, .7];
        else if (A.phase === "hover" || A.phase === "clench") want = [1.5, 2.7, 1.7]; // caméra décalée : on voit le bras levé et le poing
        else want = [1.7, 2.9, .6];
      }
    }
    if (want) {
      if (!camS) camS = [E.cameraZoom || 1, E.cameraPivotY == null ? 2.12 : E.cameraPivotY, E.cameraShoulder == null ? 1 : E.cameraShoulder];
      var k = 1 - Math.exp(-dt * 3.2);
      for (var i = 0; i < 3; i++) camS[i] += (want[i] - camS[i]) * k;
      E.cameraZoom = camS[0]; E.cameraPivotY = camS[1]; E.cameraShoulder = camS[2];
    } else if (camS) { E.cameraZoom = 1; E.cameraPivotY = undefined; E.cameraShoulder = 1; camS = null; }
  }

  /* ================================================================ boucle */
  function frame(view, cam) {
    var g = game(), w = g && g.world;
    if (!w || !w.titanMode || g.screen !== "game") { if (FX) teardown(); if (camS) camera(null, 0); return; }
    if (!FX || FX.view !== view || FX.world !== w || !FX.root.parent) build(view, w);
    var t = clock(), dt = FX.last ? Math.min(.1, Math.max(0, t - FX.last)) : 1 / 60;
    if (FX.last && t - FX.last < .004) return; // déjà fait pour cette image
    FX.last = t; FX.time += dt;
    var me = g.player && g.player(), G = M.state(w);
    events(w, G);
    var tt = FX.time;
    meteor(w, G, dt, tt, cam);
    groundGl(w, G, dt, tt, cam);
    titanFx(w, M.holder ? M.holder(w) : null, me, dt, tt);
    pulls(w, dt, tt);
    tickLive(dt);
    if (FX.pulse) { var P = FX.pulse; P.t += dt; var pk = P.t / P.life; if (pk >= 1) FX.pulse = null; else { FX.light.position.set(P.x, P.y, P.z); FX.light.intensity = P.peak * (1 - pk) * (1 - pk); } }
    else if (G.phase !== "ground" && G.phase !== "falling" && !(FX.beam.visible)) FX.light.intensity = 0;
    var px = view.renderer && view.renderer.domElement ? view.renderer.domElement.height / (2 * Math.tan((cam.fov || 60) * Math.PI / 360)) : 500;
    FX.sparks.update(dt, px);
    FX.puffs.update(dt, cam);
    FX.debris.update(dt, FX.sparks, FX.puffs);
    camera(me, dt);
  }
  // les effets se mettent à jour juste avant le rendu de la scène du jeu : les avatars sont déjà animés, la caméra placée
  function hookRenderer(view) {
    var r = view && view.renderer; if (!r || r.render.__azTitanFx) return;
    var r0 = r.render;
    var wrap = function (scene, cam) { if (scene === view.scene && cam === view.camera) { try { frame(view, cam); } catch (e) { warn(e); } } return r0.apply(this, arguments); };
    wrap.__azTitanFx = true; r.render = wrap;
  }
  var warmed = null;
  function loop() {
    root.requestAnimationFrame(loop);
    var g = game(); if (!g || !g.view) return;
    hookRenderer(g.view);
    // le Colosse est préparé dès le début d'une partie Titan : pas d'attente au moment où quelqu'un ramasse le gant
    var w = g.world;
    if (w && w.titanMode && warmed !== w && CH && CH.getTemplate) {
      warmed = w;
      try { var tp = CH.getTemplate(LOOK); if (tp && !tp.ready && tp.then) tp.then(function (t2) { tp.ready = t2; }, function () {}); } catch (e) { warn(e); }
      try { tex(); } catch (e2) { warn(e2); }
    }
  }
  if (root.requestAnimationFrame) root.requestAnimationFrame(loop);
  root.AZTitanFx = { state: function () { return FX; }, scaleOf: titanScale };
})(typeof globalThis !== "undefined" ? globalThis : this);
