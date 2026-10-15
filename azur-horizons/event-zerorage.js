/* AZUR v71 — THE END · la colère du Point Zéro.
 *  1. RÉACTION (dès que la fusée n°1 percute le Point Zéro) : il s'embrase en
 *     rouge-orangé, gonfle par battements, crache des arcs électriques sur le
 *     sol et envoie des ondes de choc qui balaient l'île.
 *  2. CHARGE puis LASERS (quand la météorite commence à descendre) : deux
 *     faisceaux partent du Point Zéro et labourent l'île d'un rivage à l'autre.
 *     Une tranchée de lave s'ouvre derrière eux.
 *  3. L'ÎLE SE COUPE EN DEUX : la moitié d'en face s'écarte de ~75 m, s'incline
 *     et s'enfonce ; une rivière de lave remplit la faille.
 *  4. VILLES DÉTRUITES : d'autres lasers frappent quatre villes l'une après
 *     l'autre. Explosion, bâtiments écrasés, sol calciné, incendies, fumée.
 * La déformation du décor passe par world-split.js (shader partagé) : aucun
 * objet n'est recréé et la simulation n'est pas modifiée. */
(function (root) {
  'use strict';
  var E = root.AZEvent, T = root.THREE, SPLIT = root.AZSplit;
  if (!E || !T || !SPLIT) return;
  var S = root.AZSim, U = SPLIT.uniforms;
  var api = null, group = null, keep = [], low = false;
  var zp = new T.Vector3(), cam = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3();
  function k(o) { keep.push(o); return o; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function ramp(t, a, b) { return ease((t - a) / (b - a)); }
  var NOISE = 'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}' +
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}' +
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}';

  /* ------------------------------------------------ calendrier (secondes de l'événement) */
  var T_CHARGE = 221.5, T_FIRE = 226, T_SWEEP_END = 232.5, T_OPEN_END = 246;
  var CITY_HITS = [233.5, 236.5, 239.5, 242.5], RAGE_FALLBACK = 192, GONE_AT = 336, FADE_AT = 300;
  // v75 « film » : calendrier calé sur la vidéo (le dôme réagit à 179 s, lasers pendant la chute de la météorite)
  if ((E.FILM && !E.FILM_PLAY) || root.__AZ_FILM) { T_CHARGE = 210.5; T_FIRE = 213; T_SWEEP_END = 217; T_OPEN_END = 223; CITY_HITS = [216.5, 218, 219.5, 221]; RAGE_FALLBACK = 179; GONE_AT = 224.5; FADE_AT = 223.5; }
  var OPEN_MAX = 150, TILT_MAX = -0.04, YAW_MAX = 0.09;

  /* ------------------------------------------------ géométrie de la coupe */
  var cut = { cx: 0, cz: 0, nx: 1, nz: 0, aMin: -600, aMax: 600, ready: false };
  var cities = [];
  function heightAt(x, z) { try { return S && S.heightAt ? S.heightAt(x, z) : 0; } catch (e) { return 0; } }
  function onLand(x, z) { try { return S.coastDistance(x, z) < S.MAP.shoreEnd - 4; } catch (e) { return Math.hypot(x, z) < 600; } }
  function planCut() {
    var regions = (S && S.regions) || [], best = null;
    // L'angle qui traverse le plus de villes, sans être trop proche d'une
    // diagonale déjà vue (variété) — la tranchée coupe des quartiers en deux.
    for (var deg = 0; deg < 180; deg += 3) {
      var a = deg * Math.PI / 180, nx = Math.cos(a), nz = Math.sin(a), hits = 0;
      for (var i = 0; i < regions.length; i++) {
        var r = regions[i], d = Math.abs((r.x - zp.x) * nx + (r.z - zp.z) * nz);
        if (d < Math.max(r.padW || 60, r.padD || 40) * .7) hits++;
      }
      var score = hits + Math.random() * .5;
      if (!best || score > best.score) best = { score: score, nx: nx, nz: nz };
    }
    cut.cx = zp.x; cut.cz = zp.z; cut.nx = best.nx; cut.nz = best.nz;
    // Le joueur reste sur la moitié immobile (d < 0) : il voit l'autre partir.
    var p = api && api.player();
    if (p && ((p.x - cut.cx) * cut.nx + (p.z - cut.cz) * cut.nz) > 0) { cut.nx = -cut.nx; cut.nz = -cut.nz; }
    // Étendue de terre le long de la ligne, d'un rivage à l'autre.
    var tx = -cut.nz, tz = cut.nx, aMin = 0, aMax = 0;
    for (var s = 0; s < 1400; s += 8) if (onLand(cut.cx + tx * s, cut.cz + tz * s)) aMax = s;
    for (s = 0; s < 1400; s += 8) if (onLand(cut.cx - tx * s, cut.cz - tz * s)) aMin = -s;
    cut.aMin = aMin - 30; cut.aMax = aMax + 30; cut.ready = true;
    U.azA.value.set(cut.cx, cut.cz, cut.nx, cut.nz);
    // Villes frappées : les plus proches du centre, hors de la tranchée.
    var list = regions.map(function (r) {
      var d = (r.x - cut.cx) * cut.nx + (r.z - cut.cz) * cut.nz;
      return { r: r, d: d, dist: Math.hypot(r.x - cut.cx, r.z - cut.cz) };
    }).filter(function (c) { return Math.abs(c.d) > 70; }).sort(function (a, b) { return a.dist - b.dist; });
    // Alterne les deux moitiés pour que la destruction se voie des deux côtés.
    var a0 = list.filter(function (c) { return c.d < 0; }), a1 = list.filter(function (c) { return c.d > 0; });
    cities = [];
    for (var j = 0; cities.length < 4 && (a0.length || a1.length); j++) {
      var c = (j % 2 ? a1 : a0).shift() || (j % 2 ? a0 : a1).shift(); if (!c) break;
      var rad = Math.max(c.r.padW || 70, c.r.padD || 45) * 1.35 + 20;
      cities.push({ x: c.r.x, z: c.r.z, r: rad, h: Math.max(3, heightAt(c.r.x, c.r.z)), name: c.r.name, hit: false, smokeT: 0, amt: 0 });
    }
    for (j = 0; j < 4; j++) {
      var cc = cities[j];
      if (cc) { U.azZ.value[j].set(cc.x, cc.z, cc.r, 0); U.azH.value.setComponent(j, cc.h); }
      else U.azZ.value[j].set(0, 0, 1, 0);
    }
  }
  // Même calcul que le shader : où se trouve un point du décor une fois l'île coupée.
  function displaced(x, y, z, out) {
    var rx = x - cut.cx, rz = z - cut.cz, d = rx * cut.nx + rz * cut.nz;
    var mask = (1 - ease((y - 230) / 90)) * (1 - ease((Math.hypot(rx, rz) - 1150) / 200));
    var side = ease((d + 1.5) / 3) * mask, tl = U.azB.value.z * side, py = y + 25;
    var nd = d * Math.cos(tl) - py * Math.sin(tl), ny = d * Math.sin(tl) + py * Math.cos(tl);
    var shift = (nd - d) + U.azB.value.y * side;
    var ox = x + cut.nx * shift, oz = z + cut.nz * shift, D = U.azD.value, yw = D.x * side, px = ox - D.y, pz = oz - D.z, c2 = Math.cos(yw), s2 = Math.sin(yw);
    out.set(D.y + px * c2 - pz * s2, (y + (ny - 25 - y) * side) - side * U.azB.value.y * .06, D.z + px * s2 + pz * c2);
    return out;
  }

  /* ------------------------------------------------ matières */
  function additive(uniforms, vs, fs) {
    return k(new T.ShaderMaterial({ uniforms: uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
  }
  var VS_UV = 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

  // Enveloppe de rage autour du Point Zéro.
  function makeShell() {
    var mat = additive({ time: { value: 0 }, col: { value: new T.Color('#ff5a1e') }, col2: { value: new T.Color('#ffe08a') }, amt: { value: 0 }, beat: { value: 0 } },
      'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
      'uniform float time,amt,beat;uniform vec3 col,col2;varying vec3 vN;varying vec3 vV;varying vec3 vP;' + NOISE +
      'void main(){float f=1.-abs(dot(vN,vV));float n=fbm(vP.xy*2.2+vec2(time*.7,-time*.5))*.6+fbm(vP.yz*3.1-time*.4)*.4;' +
      'float veins=smoothstep(.55,.62,n)*(1.-smoothstep(.62,.7,n));float a=(pow(f,1.4)*1.9+veins*1.5+.3+n*.25)*amt*(.8+beat*.7);' +
      'vec3 c=mix(col,col2,veins+pow(f,4.)*.5)*(1.2+beat);gl_FragColor=vec4(c*a,a);}');
    var m = new T.Mesh(k(new T.SphereGeometry(1, 40, 24)), mat); m.frustumCulled = false; m.renderOrder = 6;
    return m;
  }
  // Onde de choc au sol.
  function makeRing() {
    var mat = additive({ age: { value: 1 }, col: { value: new T.Color('#ff7a3a') } }, VS_UV,
      'uniform float age;uniform vec3 col;varying vec2 vU;void main(){float r=vU.x;float edge=smoothstep(.0,.25,r)*(1.-smoothstep(.75,1.,r));' +
      'float a=edge*(1.-age)*(1.-age)*1.4;gl_FragColor=vec4(col*a*1.6,a);}');
    var g = k(new T.RingGeometry(.86, 1, 96, 1));
    // u = position dans l'épaisseur de l'anneau
    var uv = g.attributes.uv, pos = g.attributes.position;
    for (var i = 0; i < uv.count; i++) { var rr = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (rr - .86) / .14, 0); }
    var m = new T.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.visible = false; m.frustumCulled = false; m.renderOrder = 5;
    return { mesh: m, t: 1 };
  }
  // Faisceau laser : deux plans croisés, cœur blanc, halo bleu électrique.
  var beamMat = null;
  function makeBeam() {
    if (!beamMat) beamMat = additive({ time: { value: 0 }, col: { value: new T.Color('#5fd4ff') } }, VS_UV,
      'uniform float time;uniform vec3 col;varying vec2 vU;void main(){float x=abs(vU.x-.5)*2.;float core=pow(1.-x,10.);float halo=pow(1.-x,2.2);' +
      'float fl=.85+.15*sin(time*60.+vU.y*40.);float a=(core*2.4+halo*.8)*fl;vec3 c=mix(col,vec3(1.),core);gl_FragColor=vec4(c*a,a);}');
    var geo = new T.BufferGeometry(), w = .5;
    geo.setAttribute('position', new T.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w, 1, 0, -w, 1, 0, 0, 0, -w, 0, 0, w, 0, 1, w, 0, 1, -w], 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]); k(geo);
    var m = new T.Mesh(geo, beamMat); m.frustumCulled = false; m.visible = false; m.renderOrder = 7;
    var flare = makeFlare(); flare.visible = false;
    return { mesh: m, flare: flare, on: false };
  }
  function aimBeam(b, from, to, width) {
    tmp.subVectors(to, from); var len = tmp.length();
    b.mesh.position.copy(from); b.mesh.scale.set(width, len, width);
    b.mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tmp.normalize());
    b.flare.position.copy(to); b.mesh.visible = b.flare.visible = true;
  }
  // Éclat lumineux face caméra.
  var flareMat = null;
  function makeFlare() {
    if (!flareMat) flareMat = additive({ time: { value: 0 }, col: { value: new T.Color('#9fe6ff') } },
      'varying vec2 vU;void main(){vU=uv;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);vec2 s=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));c.xy+=position.xy*s;gl_Position=projectionMatrix*c;}',
      'uniform float time;uniform vec3 col;varying vec2 vU;void main(){vec2 p=vU-.5;float r=length(p)*2.;float a=pow(max(0.,1.-r),2.5)*1.6+pow(max(0.,1.-r),12.)*2.;' +
      'float ray=pow(abs(sin(atan(p.y,p.x)*6.+time*3.)),20.)*max(0.,1.-r)*.6;a+=ray;vec3 c=mix(col,vec3(1.),pow(max(0.,1.-r),6.));gl_FragColor=vec4(c*a,a);}');
    var m = new T.Mesh(k(new T.PlaneGeometry(1, 1)), flareMat); m.scale.set(110, 110, 1); m.frustumCulled = false; m.renderOrder = 8;
    return m;
  }
  // Arc électrique : ruban double le long d'une ligne brisée.
  var arcMat = null;
  function makeArc() {
    if (!arcMat) arcMat = additive({ col: { value: new T.Color('#ffb36a') }, amt: { value: 1 } }, VS_UV,
      'uniform vec3 col;uniform float amt;varying vec2 vU;void main(){float x=abs(vU.x-.5)*2.;float a=(pow(1.-x,6.)*2.+pow(1.-x,1.5)*.4)*amt;gl_FragColor=vec4(mix(col,vec3(1.),pow(1.-x,8.))*a,a);}');
    var N = 14, geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 4 * 3), 3).setUsage(T.DynamicDrawUsage));
    var uv = [], idx = [];
    for (var i = 0; i < N; i++) { uv.push(0, i / N, 1, i / N, 0, i / N, 1, i / N); if (i) { var b = (i - 1) * 4, c = i * 4; idx.push(b, b + 1, c + 1, b, c + 1, c, b + 2, b + 3, c + 3, b + 2, c + 3, c + 2); } }
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); k(geo);
    var m = new T.Mesh(geo, arcMat.clone()); k(m.material); m.frustumCulled = false; m.visible = false; m.renderOrder = 7;
    return { mesh: m, N: N, life: 0 };
  }
  function strikeArc(arc, from, to) {
    var pos = arc.mesh.geometry.attributes.position, N = arc.N, w = 2.2;
    tmp.subVectors(to, from); var len = tmp.length(), dir = tmp.clone().normalize();
    var side = new T.Vector3().crossVectors(dir, new T.Vector3(0, 1, 0)); if (side.lengthSq() < .01) side.set(1, 0, 0); side.normalize();
    var up = new T.Vector3().crossVectors(side, dir).normalize();
    for (var i = 0; i < N; i++) {
      var f = i / (N - 1), j = (i === 0 || i === N - 1) ? 0 : len * .07;
      tmp2.copy(from).addScaledVector(dir, len * f).addScaledVector(side, (Math.random() - .5) * j * 2).addScaledVector(up, (Math.random() - .5) * j * 2);
      var ww = w * (1 - f * .5);
      pos.setXYZ(i * 4, tmp2.x - side.x * ww, tmp2.y - side.y * ww, tmp2.z - side.z * ww);
      pos.setXYZ(i * 4 + 1, tmp2.x + side.x * ww, tmp2.y + side.y * ww, tmp2.z + side.z * ww);
      pos.setXYZ(i * 4 + 2, tmp2.x - up.x * ww, tmp2.y - up.y * ww, tmp2.z - up.z * ww);
      pos.setXYZ(i * 4 + 3, tmp2.x + up.x * ww, tmp2.y + up.y * ww, tmp2.z + up.z * ww);
    }
    pos.needsUpdate = true; arc.mesh.geometry.computeBoundingSphere(); arc.life = .22 + Math.random() * .12; arc.mesh.visible = true;
  }
  // Rivière de lave dans la faille.
  function makeLava() {
    var mat = k(new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, aMin: { value: 0 }, aMax: { value: 0 }, amt: { value: 0 }, line: { value: new T.Vector4() }, gap: { value: new T.Vector3() } }, fog: false, side: T.DoubleSide,
      vertexShader: 'varying vec2 vW;varying vec2 vL;void main(){vL=position.xy;vec4 w=modelMatrix*vec4(position,1.);vW=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: 'uniform float time,aMin,aMax,amt;uniform vec4 line;uniform vec3 gap;varying vec2 vW;varying vec2 vL;' + NOISE +
        'void main(){vec2 r=vW-line.xy;float d=dot(r,line.zw);float al=dot(r,vec2(-line.w,line.z));' +
        'if(al<aMin||al>aMax)discard;float e=min(al-aMin,aMax-al);float g=gap.x+gap.y*(al-gap.z);if(d<-16.||d>g+16.)discard;' +
        'vec2 q=vW*.045+vec2(time*.12,time*.05);float f=fbm(q+fbm(q*1.6-time*.08)*1.4);float crust=smoothstep(.52,.64,f);' +
        'vec3 hot=mix(vec3(1.,.93,.5),vec3(1.,.35,.05),smoothstep(.15,.5,f));vec3 c=mix(hot*2.,vec3(.15,.05,.04),crust*.85);' +
        'c*=smoothstep(0.,40.,e)*amt+.0001;gl_FragColor=vec4(c,1.);}'
    }));
    var m = new T.Mesh(k(new T.PlaneGeometry(2800, 1, 1, 1)), mat); m.frustumCulled = false; m.visible = false; m.rotation.order = 'YXZ';
    return m;
  }

  /* ------------------------------------------------ sons (Web Audio du jeu) */
  function sfx() { var a = root.AZUR && root.AZUR.audio; return a && a.ctx && a.ctx.state === 'running' && a.sfxBus && a.settings && a.settings.sfx > 0 ? a : null; }
  function tone(a, type, f0, f1, t, dur, vol) {
    var o = a.ctx.createOscillator(), g = a.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.08, dur * .3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(a.sfxBus); o.start(t); o.stop(t + dur + .05);
  }
  function rumble(a, t, dur, vol, cut) {
    if (!a.noiseBuffer) return;
    var s = a.ctx.createBufferSource(), f = a.ctx.createBiquadFilter(), g = a.ctx.createGain();
    s.buffer = a.noiseBuffer; s.loop = true; f.type = 'lowpass'; f.frequency.value = cut || 180;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.4, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.sfxBus); s.start(t); s.stop(t + dur + .05);
  }
  var SND = {
    rage: function () { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; tone(a, 'sawtooth', 70, 38, t, 2.6, .22); tone(a, 'square', 140, 55, t, 1.8, .06); rumble(a, t, 3.5, .5, 220); },
    beat: function () { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; tone(a, 'sine', 62, 34, t, .7, .35); },
    zap: function () { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; tone(a, 'sawtooth', 1800 + Math.random() * 900, 300, t, .18, .05); },
    charge: function () { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; tone(a, 'sawtooth', 90, 1400, t, 4.4, .09); tone(a, 'sine', 180, 2600, t, 4.4, .06); },
    laser: function (dur) { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; tone(a, 'sawtooth', 820, 760, t, dur, .07); tone(a, 'square', 410, 380, t, dur, .04); rumble(a, t, dur + 1, .45, 300); },
    boom: function () { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; tone(a, 'sine', 90, 28, t, 1.6, .5); rumble(a, t, 3, .6, 600); },
    quake: function (dur) { var a = sfx(); if (!a) return; var t = a.ctx.currentTime; rumble(a, t, dur, .7, 120); tone(a, 'sine', 40, 30, t, dur, .2); }
  };

  /* ------------------------------------------------ état */
  var shell = null, rings = [], beams = [], arcs = [], lava = null;
  var rageAt = -1, nextRing = 0, nextArc = 0, nextBeat = 0, beat = 0, fired = {}, ringI = 0;
  function once(key, fn) { if (fired[key]) return; fired[key] = true; try { fn(); } catch (e) { /* un effet raté ne bloque rien */ } }
  function fx() { return E.fx || null; }

  function init(a) {
    api = a; low = a.quality === 'low';
    var scene = a.scene(); if (!scene) return;
    group = new T.Group(); group.name = 'v71-zerorage'; scene.add(group);
    shell = makeShell(); shell.visible = false; group.add(shell);
    rings = []; for (var i = 0; i < 4; i++) { var r = makeRing(); rings.push(r); group.add(r.mesh); }
    beams = []; for (i = 0; i < 3; i++) { var b = makeBeam(); beams.push(b); group.add(b.mesh, b.flare); }
    arcs = []; for (i = 0; i < (low ? 3 : 5); i++) { var c = makeArc(); arcs.push(c); group.add(c.mesh); }
    lava = makeLava(); group.add(lava);
    rageAt = -1; fired = {}; cut.ready = false; cities = [];
    E.zeroRage = { cut: cut, cities: function () { return cities; }, displaced: displaced };
    reset();
    a.on('rocket:zeroshock', function () { if (rageAt < 0) rageAt = E.tTotal || 191; });
  }
  function reset() {
    U.azB.value.set(-1e5, 0, 0, 0); U.azC.value.set(1e5, -1e5, 0, 0); U.azD.value.set(0, 0, 0, 0);
    for (var i = 0; i < 4; i++) U.azZ.value[i].set(0, 0, 1, 0);
  }
  function groundRing(force, col) {
    var r = rings[ringI++ % rings.length]; r.t = 0; r.mesh.visible = true; r.force = force;
    r.mesh.material.uniforms.col.value.set(col || '#ff7a3a');
    r.mesh.position.set(zp.x, heightAt(zp.x, zp.z) + 2.5, zp.z);
  }
  function zapArc() {
    var arc = null; for (var i = 0; i < arcs.length; i++) if (arcs[i].life <= 0) { arc = arcs[i]; break; }
    if (!arc) return;
    var ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 170;
    var gx = zp.x + Math.cos(ang) * dist, gz = zp.z + Math.sin(ang) * dist;
    tmp.set(gx, heightAt(gx, gz) + 1, gz); tmp2.copy(zp).addScaledVector(tmp.clone().sub(zp).normalize(), 18);
    strikeArc(arc, tmp2, tmp.clone());
    var f = fx(); if (f && f.burst && !low) f.burst(tmp, { count: 10, color: 0xffb070, speed: 30, life: .6, size: 4 });
    if (Math.random() < .5) SND.zap();
  }

  function update(dt) {
    if (!group || !api) return;
    var t = E.tTotal || 0, time = performance.now() / 1000;
    var camera = api.camera(); if (camera) camera.getWorldPosition(cam);
    if (E.zeroPointPos) zp.copy(E.zeroPointPos); else zp.set(0, heightAt(0, 0) + 25, 0);
    if (rageAt < 0 && t >= RAGE_FALLBACK && t < FADE_AT) rageAt = t; // repli si l'événement a été sauté
    var gone = t > GONE_AT;

    /* ---- 1. réaction et rage ---- */
    var raging = rageAt > 0 && t >= rageAt && !gone;
    if (raging) {
      once('rage', function () {
        SND.rage(); groundRing(1, '#ffd08a');
        E.emit('camera:shake', { force: .55, duration: 2.2 });
        var f = fx(); if (f) { if (f.burst) f.burst(zp, { count: low ? 30 : 70, color: 0xff7a3a, speed: 120, life: 1.6, size: 9 }); if (f.halo) f.halo(zp, { color: 0xff7a3a }); }
      });
      var since = t - rageAt, charge = ramp(t, T_CHARGE, T_FIRE), grow = ease(since / 1.2);
      if (time > nextBeat) { nextBeat = time + (charge > 0 ? .35 : Math.max(.6, 1.6 - since * .03)); beat = 1; SND.beat(); }
      beat = Math.max(0, beat - dt * 3.2);
      var R = (42 + grow * 30 + beat * 12) * (1 - charge * .3);
      shell.visible = true; shell.position.copy(zp); shell.scale.setScalar(R);
      var su = shell.material.uniforms; su.time.value = time; su.beat.value = beat; su.amt.value = grow * (t < FADE_AT ? 1 : Math.max(0, 1 - (t - FADE_AT) / 6));
      su.col.value.set('#ff2a0a').lerp(tmp.set(.37, .83, 1), charge); su.col2.value.set('#ffe08a').lerp(tmp.set(1, 1, 1), charge);
      if (t < T_FIRE + 1 && time > nextRing) { nextRing = time + (charge > 0 ? 1.1 : 2.6); groundRing(.8, charge > 0 ? '#7fd8ff' : '#ff7a3a'); }
      if (t < T_OPEN_END && time > nextArc) { nextArc = time + (charge > 0 ? .08 : .25 + Math.random() * .5); zapArc(); }
      if (charge > 0) once('charge', function () { SND.charge(); E.emit('camera:shake', { force: .25, duration: 4 }); });
    } else if (shell) shell.visible = false;
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i]; if (!r.mesh.visible) continue;
      r.t += dt / 2.4; if (r.t >= 1) { r.mesh.visible = false; continue; }
      var rr = 20 + ease(r.t) * 520 * (r.force || 1); r.mesh.scale.set(rr, rr, 1); r.mesh.material.uniforms.age.value = r.t;
    }
    for (i = 0; i < arcs.length; i++) { var c = arcs[i]; if (c.life > 0) { c.life -= dt; c.mesh.material.uniforms.amt.value = clamp(c.life * 6, 0, 1); if (c.life <= 0) c.mesh.visible = false; } }

    /* ---- 2. lasers qui coupent l'île ---- */
    if (t >= T_CHARGE && !cut.ready) planCut();
    if (!cut.ready) { for (i = 0; i < beams.length; i++) beams[i].mesh.visible = beams[i].flare.visible = false; return; }
    if (beamMat) beamMat.uniforms.time.value = time; if (flareMat) flareMat.uniforms.time.value = time;
    var tx = -cut.nz, tz = cut.nx;
    var sweep = ramp(t, T_FIRE, T_SWEEP_END), aNeg = cut.aMin * sweep, aPos = cut.aMax * sweep;
    var active = t >= T_FIRE && !gone;
    U.azB.value.w = active ? 1 : 0;
    U.azC.value.x = active ? aNeg : 1e5; U.azC.value.y = active ? aPos : -1e5; U.azC.value.z = time;
    U.azC.value.w = active ? (t < T_OPEN_END + 20 ? 1 : Math.max(.55, 1 - (t - T_OPEN_END - 20) / 30)) : 0;
    var firing = t >= T_FIRE && t < T_SWEEP_END + .4;
    if (firing) {
      once('fire', function () { SND.laser(T_SWEEP_END - T_FIRE + .4); E.emit('camera:shake', { force: .7, duration: 6.5 }); });
      for (var s = 0; s < 2; s++) {
        var aa = s ? aPos : aNeg, gx = cut.cx + tx * aa, gz = cut.cz + tz * aa;
        tmp2.set(gx, heightAt(gx, gz) - 2, gz);
        aimBeam(beams[s], zp, tmp2, 13 + Math.sin(time * 40 + s) * 2);
        if (Math.random() < (low ? .25 : .55)) {
          var f2 = fx(); if (f2) {
            if (f2.burst) f2.burst(tmp2, { count: low ? 6 : 14, color: 0xffa040, speed: 70, life: 1.1, size: 6, gravity: 60 });
            if (f2.fire && Math.random() < .5) f2.fire({ x: tmp2.x, y: tmp2.y + 4, z: tmp2.z }, { count: low ? 4 : 10, spread: 8, size: 12 });
            if (f2.smoke && Math.random() < .25) f2.smoke({ x: tmp2.x, y: tmp2.y + 8, z: tmp2.z }, { count: low ? 3 : 6, spread: 10, size: 30, color: 0x3a3236 });
          }
        }
      }
    } else { beams[0].mesh.visible = beams[0].flare.visible = beams[1].mesh.visible = beams[1].flare.visible = false; }

    /* ---- 3. l'île se sépare ---- */
    var open = ramp(t, T_SWEEP_END - .5, T_OPEN_END);
    var quake = open > 0 && open < 1 ? Math.sin(time * 23) * .9 + Math.sin(time * 37) * .5 : 0;
    U.azB.value.y = active ? OPEN_MAX * open + quake * .6 : 0;
    U.azB.value.z = active ? TILT_MAX * open : 0;
    U.azD.value.set(active ? -YAW_MAX * open : 0, cut.cx + tx * cut.aMin, cut.cz + tz * cut.aMin, 0);
    if (active && open > 0) once('open', function () { SND.quake(T_OPEN_END - T_SWEEP_END + 2); E.emit('camera:shake', { force: .6, duration: T_OPEN_END - T_SWEEP_END }); });
    if (active && open > 0 && open < 1 && Math.random() < (low ? .15 : .4)) {
      // éboulis qui tombent des deux bords
      var along = cut.aMin + Math.random() * (cut.aMax - cut.aMin), edge = Math.random() < .5 ? -8 : U.azB.value.y + 8;
      var ex = cut.cx + tx * along + cut.nx * edge, ez = cut.cz + tz * along + cut.nz * edge, f3 = fx();
      if (f3 && f3.burst && onLand(cut.cx + tx * along, cut.cz + tz * along)) f3.burst({ x: ex, y: heightAt(ex, ez) + 2, z: ez }, { count: 8, color: 0x6a5a50, speed: 25, life: 1.4, size: 5, gravity: 50 });
    }
    // rivière de lave entre les deux moitiés
    var gap = U.azB.value.y;
    lava.visible = active && sweep > 0;
    if (lava.visible) {
      var wedge = Math.abs(U.azD.value.x), lw = 60 + gap + wedge * (cut.aMax - cut.aMin);
      lava.position.set(cut.cx + cut.nx * lw * .4, -.4, cut.cz + cut.nz * lw * .4);
      lava.rotation.set(-Math.PI / 2, Math.atan2(-tz, tx), 0, 'YXZ');
      lava.scale.set(1, lw, 1);
      var lu = lava.material.uniforms; lu.time.value = time; lu.aMin.value = aNeg; lu.aMax.value = aPos; lu.amt.value = 1;
      lu.line.value.set(cut.cx, cut.cz, cut.nx, cut.nz); lu.gap.value.set(gap, wedge, cut.aMin);
    }

    /* ---- 4. villes détruites ---- */
    for (var ci = 0; ci < cities.length; ci++) {
      var cy = cities[ci], th = CITY_HITS[ci], b = beams[2];
      var p = displaced(cy.x, cy.h + 4, cy.z, tmp2);
      if (t >= th && t < th + 1.3 && !gone) {
        aimBeam(b, zp, p, 16 + Math.sin(time * 50) * 2.5);
        if (!cy.hit) {
          cy.hit = true; SND.laser(1.3); setTimeout(SND.boom, 900);
          E.emit('camera:shake', { force: .5, duration: 1.6 });
        }
      } else if (ci === cities.length - 1 || t < th) { /* le faisceau 3 sert à la ville suivante */ }
      if (t >= th + .9 && !gone) {
        once('boom' + ci, function () {
          var f4 = fx(); if (!f4) return;
          if (f4.burst) f4.burst({ x: p.x, y: p.y + 6, z: p.z }, { count: low ? 40 : 110, color: 0xff8a3a, speed: 160, life: 2, size: 12, gravity: 40 });
          if (f4.shockring) f4.shockring({ x: p.x, y: p.y + 2, z: p.z }, { radius: 20, reach: cy.r * 2.2, color: 0xffb070 });
          if (f4.beam) f4.beam({ x: p.x, y: p.y, z: p.z }, { height: 260, radius: cy.r * .4, color: 0xff7a3a, color2: 0xfff0c0, count: low ? 40 : 110, life: 2.4 });
        });
        cy.amt = ease((t - th - .9) / 2.2);
        U.azZ.value[ci].w = cy.amt;
        // la ville brûle ensuite
        cy.smokeT -= dt;
        if (cy.smokeT <= 0 && t < GONE_AT) {
          cy.smokeT = low ? 1.4 : .6;
          var f5 = fx(), ox = (Math.random() - .5) * cy.r, oz = (Math.random() - .5) * cy.r, q = displaced(cy.x + ox, cy.h, cy.z + oz, tmp);
          if (f5 && f5.fire) f5.fire({ x: q.x, y: q.y + 3, z: q.z }, { count: low ? 6 : 14, spread: 10, size: 14, life: 1.2 });
          if (f5 && f5.smoke) f5.smoke({ x: q.x, y: q.y + 14, z: q.z }, { count: low ? 4 : 8, spread: 18, size: 46, color: 0x2a2428 });
        }
      }
    }
    var cityBeamOn = false;
    for (ci = 0; ci < cities.length; ci++) if (t >= CITY_HITS[ci] && t < CITY_HITS[ci] + 1.3) cityBeamOn = true;
    if (!cityBeamOn || gone) beams[2].mesh.visible = beams[2].flare.visible = false;
  }
  function dispose() {
    reset();
    if (group && group.parent) group.parent.remove(group);
    keep.forEach(function (o) { try { o.dispose(); } catch (e) { /* déjà libéré */ } });
    keep = []; group = null; shell = lava = null; rings = []; beams = []; arcs = []; beamMat = flareMat = arcMat = null; cities = []; cut.ready = false;
  }
  E.register('zerorage', { init: init, update: update, dispose: dispose });
})(window);
