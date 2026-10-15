/* ============================================================================
 * AZUR Horizons — THE END · Overdrive v47
 * -----------------------------------------------------------------------------
 * Couche de détails posée sur la chorégraphie (event-coherence.js), sans en
 * changer le timing. Fidèle au live du 13/10/2019 :
 *   - FUSÉES   : longues traînées de fumée blanche qui restent dans le ciel,
 *                lumière de réacteur, nuages roulants au décollage.
 *   - FAILLES  : chaque faille refermée laisse une CICATRICE dans le ciel
 *                (le ciel se fissure comme pendant The End), éclats au passage.
 *   - POINT ZÉRO : anneaux gyroscopiques, rochers en lévitation, ondulations
 *                du lac, éclairs, colonne d'énergie après la frappe.
 *   - MÉTÉORITE : sillage de fumée géant, onde de proue incandescente,
 *                éclairs vers le Point Zéro à l'approche.
 *   - ONDES DE CHOC au sol (épousent le relief) + mur de poussière :
 *                frappe de la fusée et impact de la météorite.
 * ========================================================================== */
(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;

var api = null, group = null, low = false, resources = [], clock = 0, glowTex = null;
var contrails = [], meteorWake = null, scars = [], bolts = [], shocks = [];
var zp = null, bow = null, rocketLight = null, padSmoke = null;
var listenersBound = false, lastMeteor = new T.Vector3(), meteorSpeed = 0, boltTimer = 0;
var tmp = new T.Vector3(), tmp2 = new T.Vector3(), side = new T.Vector3(), toCam = new T.Vector3(), seg = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
var LATE = ['contraction', 'collapse', 'growth', 'destruction', 'playersucked', 'allgone', 'blackhole', 'numbers', 'end'];
var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
var smooth = function (v) { v = clamp01(v); return v * v * (3 - 2 * v); };
var NOISE = 'float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}' +
  'float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}' +
  'float fbm(vec3 p){return .55*noise(p)+.28*noise(p*2.1)+.14*noise(p*4.3);}';

function keep(r) { resources.push(r); return r; }
function late() { return LATE.indexOf(E.state) !== -1; }
function P(v) { return { x: v.x, y: v.y, z: v.z }; }
function groundAt(x, z) { try { return Math.max(-1.6, root.AZSim.heightAt(x, z)); } catch (e) { return 0; } }
function radialTexture() {
  var cv = document.createElement('canvas'); cv.width = cv.height = 128;
  var g = cv.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.22, 'rgba(255,255,255,.7)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.15)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return keep(new T.CanvasTexture(cv));
}

/* ------------------------------------------------ camera-facing ribbon trail */
function makeRibbon(opts) {
  var count = opts.count, samples = new Float32Array(count * 3), times = new Float32Array(count).fill(-1e9), vis = new Float32Array(count);
  var positions = new Float32Array(count * 6), ages = new Float32Array(count * 2), alive = new Float32Array(count * 2), uv = new Float32Array(count * 4), index = [];
  for (var i = 0; i < count; i++) {
    uv[i * 4] = 0; uv[i * 4 + 1] = i / count; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / count;
    if (i < count - 1) { var a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  var geo = keep(new T.BufferGeometry());
  geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('aAge', new T.BufferAttribute(ages, 1).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('aVis', new T.BufferAttribute(alive, 1).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(index);
  var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
    blending: opts.additive ? T.AdditiveBlending : T.NormalBlending,
    uniforms: { time: { value: 0 }, life: { value: opts.life }, hot: { value: new T.Color(opts.hot) }, cold: { value: new T.Color(opts.cold) }, opacity: { value: opts.opacity }, fade: { value: 1 } },
    vertexShader: 'attribute float aAge;attribute float aVis;varying float vAge;varying float vVis;varying vec2 vUv;void main(){vAge=aAge;vVis=aVis;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time,life,opacity,fade;uniform vec3 hot,cold;varying float vAge;varying float vVis;varying vec2 vUv;' + NOISE +
      'void main(){float across=1.-abs(vUv.x*2.-1.);float n=fbm(vec3(vUv.x*2.6,vUv.y*30.-time*.25,vAge*.22));' +
      'float body=smoothstep(0.,.6,across*(.5+n*.95));float l=clamp(1.-vAge/life,0.,1.);float young=clamp(vAge*4.,0.,1.);' +
      'vec3 c=mix(hot,cold,clamp(vAge*.7,0.,1.));gl_FragColor=vec4(c,body*l*l*young*vVis*opacity*fade);}' }));
  var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false; group.add(mesh);
  var cursor = 0, filled = 0, last = -1e9, lastPoint = new T.Vector3(), pt = new T.Vector3(), hasLast = false;
  function write(p, v) {
    samples[cursor * 3] = p.x; samples[cursor * 3 + 1] = p.y; samples[cursor * 3 + 2] = p.z; times[cursor] = clock; vis[cursor] = v;
    cursor = (cursor + 1) % count; filled = Math.min(count, filled + 1);
  }
  return {
    mat: mat,
    push: function (p) {
      if (clock - last < opts.interval) return;
      if (!hasLast) write(p, 0);
      else if (lastPoint.distanceTo(p) > opts.gap) { write(lastPoint, 0); write(p, 0); }
      else write(p, 1);
      last = clock; lastPoint.copy(p); hasLast = true;
    },
    cut: function () { if (!hasLast) return; hasLast = false; write(lastPoint, 0); },
    clear: function () { filled = 0; hasLast = false; times.fill(-1e9); },
    update: function () {
      var cam = api.camera(); mesh.visible = !!(cam && filled > 1); if (!mesh.visible) return;
      mat.uniforms.time.value = clock;
      for (var i = 0; i < count; i++) {
        var k = Math.min(i, filled - 1), at = (cursor - 1 - k + count * 2) % count, prev = (at - 1 + count) % count, n = at * 3, q = prev * 3;
        pt.set(samples[n], samples[n + 1], samples[n + 2]);
        if (i >= filled - 1) seg.set(0, 1, 0); else seg.set(samples[q] - pt.x, samples[q + 1] - pt.y, samples[q + 2] - pt.z);
        toCam.subVectors(cam.position, pt); side.crossVectors(seg, toCam).normalize(); if (side.lengthSq() < 0.1) side.set(1, 0, 0);
        var age = i < filled ? clock - times[at] : 999, w = opts.width0 + Math.min(age, opts.life) * opts.grow;
        side.multiplyScalar(w); var o = i * 6, lift = age * opts.rise;
        positions[o] = pt.x + side.x; positions[o + 1] = pt.y + side.y + lift; positions[o + 2] = pt.z + side.z;
        positions[o + 3] = pt.x - side.x; positions[o + 4] = pt.y - side.y + lift; positions[o + 5] = pt.z - side.z;
        ages[i * 2] = ages[i * 2 + 1] = age; alive[i * 2] = alive[i * 2 + 1] = i < filled ? vis[at] : 0;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aAge.needsUpdate = geo.attributes.aVis.needsUpdate = true;
    }
  };
}

/* ---------------------------------------------------------- lightning bolts */
function makeBolt() {
  var N = 16, positions = new Float32Array(N * 6), uv = new Float32Array(N * 4), index = [], points = [];
  for (var i = 0; i < N; i++) {
    uv[i * 4] = 0; uv[i * 4 + 1] = i / (N - 1); uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / (N - 1); points.push(new T.Vector3());
    if (i < N - 1) { var a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  var geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(index);
  var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    uniforms: { alpha: { value: 0 }, tint: { value: new T.Color(0x9fdcff) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float alpha;uniform vec3 tint;varying vec2 vUv;void main(){float x=abs(vUv.x*2.-1.);float core=exp(-x*14.);float glow=exp(-x*3.)*.45;vec3 c=mix(tint,vec3(1.),core);gl_FragColor=vec4(c*(core+glow)*1.4,(core+glow)*alpha);}' }));
  var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 8; group.add(mesh);
  return { mesh: mesh, mat: mat, geo: geo, positions: positions, points: points, a: new T.Vector3(), b: new T.Vector3(), age: 99, life: 0.3, width: 3, regen: 0, jag: 0.12 };
}
function fireBolt(a, b, width, color, life, jag) {
  var bolt = bolts.find(function (x) { return x.age >= x.life; }) || bolts[0];
  bolt.a.copy(a); bolt.b.copy(b); bolt.age = 0; bolt.life = life || 0.32; bolt.width = width || 3; bolt.regen = 0; bolt.jag = jag || 0.12;
  bolt.mat.uniforms.tint.value.setHex(color || 0x9fdcff);
}
function shapeBolt(bolt) {
  var n = bolt.points.length, len = bolt.a.distanceTo(bolt.b);
  seg.subVectors(bolt.b, bolt.a); side.set(seg.z, 0, -seg.x).normalize(); if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  tmp2.crossVectors(seg, side).normalize();
  for (var i = 0; i < n; i++) {
    var t = i / (n - 1), env = Math.sin(t * Math.PI), j = len * bolt.jag * env;
    bolt.points[i].lerpVectors(bolt.a, bolt.b, t).addScaledVector(side, (Math.random() - 0.5) * j).addScaledVector(tmp2, (Math.random() - 0.5) * j);
  }
}
function updateBolts(dt) {
  var cam = api.camera(); if (!cam) return;
  bolts.forEach(function (bolt) {
    if (bolt.age >= bolt.life) { bolt.mesh.visible = false; return; }
    bolt.age += dt; bolt.regen -= dt; if (bolt.regen <= 0) { bolt.regen = 0.05; shapeBolt(bolt); }
    bolt.mesh.visible = true; var k = 1 - bolt.age / bolt.life; bolt.mat.uniforms.alpha.value = k * (0.65 + Math.random() * 0.35);
    for (var i = 0; i < bolt.points.length; i++) {
      var p = bolt.points[i], next = bolt.points[Math.min(i + 1, bolt.points.length - 1)], prev = bolt.points[Math.max(i - 1, 0)];
      seg.subVectors(next, prev); toCam.subVectors(cam.position, p); side.crossVectors(seg, toCam).normalize().multiplyScalar(bolt.width);
      var o = i * 6; bolt.positions[o] = p.x + side.x; bolt.positions[o + 1] = p.y + side.y; bolt.positions[o + 2] = p.z + side.z;
      bolt.positions[o + 3] = p.x - side.x; bolt.positions[o + 4] = p.y - side.y; bolt.positions[o + 5] = p.z - side.z;
    }
    bolt.geo.attributes.position.needsUpdate = true;
  });
}

/* ------------------------------------------------------------- sky scars */
var scarFragment = 'uniform float time,alpha,seed,fresh;varying vec2 vUv;' + NOISE +
  'void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);' +
  'float slash=abs(p.y-.18*sin(p.x*3.+seed)-.07*(fbm(vec3(p.x*6.,seed,1.))-.5)*4.);float main=exp(-slash*55.)*(1.-smoothstep(.55,.98,abs(p.x)));' +
  'float branches=0.;for(int i=0;i<5;i++){float fi=float(i);float ang=seed*1.7+fi*1.25;vec2 d=vec2(cos(ang),sin(ang));float t=dot(p,d);vec2 q=p-d*t;' +
  'float wig=fbm(vec3(t*9.,fi+seed,2.))-.5;float dist=abs(dot(q,vec2(-d.y,d.x))+wig*.12);branches+=exp(-dist*90.)*smoothstep(0.,.15,t)*(1.-smoothstep(.2+fi*.09,.62+fi*.06,t));}' +
  'float web=pow(1.-smoothstep(.0,.035,abs(fbm(vec3(p*7.,seed))-.5)),3.)*(1.-smoothstep(.2,.8,r))*.5;' +
  'float lines=clamp(main+branches+web,0.,1.6);float glow=exp(-slash*9.)*(1.-smoothstep(.4,.95,abs(p.x)))*.35+exp(-r*3.)*.12;' +
  'float flick=.8+.2*sin(time*2.3+seed*3.)+.15*fresh*sin(time*31.+seed);' +
  'vec3 c=mix(vec3(.3,.62,1.),vec3(.92,.98,1.),clamp(lines,0.,1.));float al=(lines*.9+glow)*alpha*flick*(1.-smoothstep(.85,1.,r));gl_FragColor=vec4(c*al,al);}';
function makeScar() {
  var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, alpha: { value: 0 }, seed: { value: 0 }, fresh: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: scarFragment }));
  var mesh = new T.Mesh(keep(new T.PlaneGeometry(1, 1)), mat); mesh.visible = false; mesh.frustumCulled = false; group.add(mesh);
  return { mesh: mesh, mat: mat, born: -1, size: 1 };
}
function leaveScar(pos, radius, quaternion) {
  var scar = scars.find(function (s) { return s.born < 0; });
  if (!scar) { scar = scars.reduce(function (a, b) { return a.born < b.born ? a : b; }); }
  scar.born = clock; scar.size = radius * (3.4 + Math.random() * 1.6);
  scar.mesh.position.copy(pos); if (quaternion) scar.mesh.quaternion.copy(quaternion);
  scar.mesh.rotateZ(Math.random() * Math.PI * 2); scar.mesh.scale.set(scar.size, scar.size * (0.55 + Math.random() * 0.3), 1);
  scar.mat.uniforms.seed.value = Math.random() * 40; scar.mesh.visible = true;
}
function updateScars() {
  var fadeOut = late() ? 1 - smooth((E.tTotal - E.TIMELINE.contraction[0]) / 4) : 1;
  scars.forEach(function (s) {
    if (s.born < 0) return;
    var age = clock - s.born, fresh = Math.exp(-age * 0.9), birth = smooth(age / 0.25);
    s.mat.uniforms.time.value = clock; s.mat.uniforms.fresh.value = fresh;
    s.mat.uniforms.alpha.value = birth * (0.38 + fresh * 0.9) * fadeOut;
    s.mesh.visible = fadeOut > 0.01;
  });
}

/* --------------------------------------------- terrain-conforming shockwave */
function band(segments, additive, fragment) {
  var verts = (segments + 1) * 2, positions = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), index = [];
  for (var i = 0; i <= segments; i++) {
    uv[i * 4] = i / segments; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / segments; uv[i * 4 + 3] = 1;
    if (i < segments) { var a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  var geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(index);
  var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 0 }, tint: { value: new T.Color(0xbfe6ff) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: fragment }));
  var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
  return { mesh: mesh, mat: mat, positions: positions, segments: segments };
}
function makeShock() {
  var s = low ? 80 : 180;
  return {
    ring: band(s, true, 'uniform float time,alpha;uniform vec3 tint;varying vec2 vUv;' + NOISE +
      'void main(){float n=fbm(vec3(vUv.x*90.,vUv.y*4.,time*1.2));float front=smoothstep(.5,.93,vUv.y)*(1.-smoothstep(.93,1.,vUv.y));float wake=smoothstep(0.,.55,vUv.y)*(1.-smoothstep(.55,.95,vUv.y))*.3;' +
      'float a=(front*(.6+n*.8)+wake*n)*alpha;gl_FragColor=vec4(mix(tint,vec3(1.),front*.6)*a*1.5,a);}'),
    dust: band(s, false, 'uniform float time,alpha;uniform vec3 tint;varying vec2 vUv;' + NOISE +
      'void main(){float h=vUv.y;float n=fbm(vec3(vUv.x*60.,h*3.-time*.8,time*.25));float billow=fbm(vec3(vUv.x*22.+time*.15,h*1.5,3.1));' +
      'float body=(1.-smoothstep(.12,1.,h+(n-.5)*.6))*smoothstep(0.,.05,h);vec3 c=mix(vec3(.4,.36,.31),vec3(.78,.74,.68),billow*.8+h*.25);gl_FragColor=vec4(c,clamp(body*(.5+billow*.6)*alpha,0.,.9));}'),
    origin: new T.Vector3(), age: 99, duration: 3, radius: 600, height: 80
  };
}
function triggerShock(pos, radius, duration, height, color) {
  var s = shocks.find(function (x) { return x.age >= x.duration * 1.9; }) || shocks[0];
  s.origin.copy(pos); s.age = 0; s.radius = radius; s.duration = duration; s.height = height;
  s.ring.mat.uniforms.tint.value.setHex(color || 0xbfe6ff);
}
function updateShocks(dt) {
  shocks.forEach(function (s) {
    if (s.age >= s.duration * 1.9) { s.ring.mesh.visible = s.dust.mesh.visible = false; return; }
    s.age += dt;
    var p = clamp01(s.age / s.duration), R = 10 + (1 - Math.pow(1 - p, 2.5)) * s.radius, w = 18 + (1 - Math.pow(1 - p, 2.5)) * s.radius * 0.13;
    s.ring.mesh.visible = p < 1;
    if (s.ring.mesh.visible) {
      var n = s.ring.segments, pos = s.ring.positions;
      for (var i = 0; i <= n; i++) {
        var a = i / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), o = i * 6, r0 = Math.max(0, R - w);
        var x0 = s.origin.x + c * r0, z0 = s.origin.z + sn * r0, x1 = s.origin.x + c * R, z1 = s.origin.z + sn * R;
        pos[o] = x0; pos[o + 1] = groundAt(x0, z0) + 1.6; pos[o + 2] = z0; pos[o + 3] = x1; pos[o + 4] = groundAt(x1, z1) + 1.6; pos[o + 5] = z1;
      }
      s.ring.mesh.geometry.attributes.position.needsUpdate = true; s.ring.mat.uniforms.time.value = clock; s.ring.mat.uniforms.alpha.value = Math.pow(1 - p, 1.3);
    }
    var dp = clamp01(s.age / (s.duration * 1.9)), dR = 8 + (1 - Math.pow(1 - dp, 2.2)) * s.radius * 0.93, dH = 10 + s.height * Math.pow(1 - dp, 0.7) * smooth(s.age / 0.3);
    s.dust.mesh.visible = dp < 1;
    if (s.dust.mesh.visible) {
      var m = s.dust.segments, dpos = s.dust.positions;
      for (var j = 0; j <= m; j++) {
        var b = j / m * Math.PI * 2, cc = Math.cos(b), ss = Math.sin(b), q = j * 6, x = s.origin.x + cc * dR, z = s.origin.z + ss * dR, g = groundAt(x, z);
        var wob = 1 + Math.sin(b * 11 + clock * 0.6) * 0.14 + Math.sin(b * 27) * 0.07;
        dpos[q] = x; dpos[q + 1] = g - 1; dpos[q + 2] = z;
        dpos[q + 3] = s.origin.x + cc * (dR - dH * 0.3); dpos[q + 4] = g + dH * wob; dpos[q + 5] = s.origin.z + ss * (dR - dH * 0.3);
      }
      s.dust.mesh.geometry.attributes.position.needsUpdate = true; s.dust.mat.uniforms.time.value = clock; s.dust.mat.uniforms.alpha.value = Math.pow(1 - dp, 1.1) * smooth(s.age / 0.25);
    }
  });
}

/* ------------------------------------------------------- Zero Point dressing */
function makeZeroDressing() {
  var g = new T.Group(); g.name = 'v47-zero-dressing'; group.add(g);
  var ringMat = function (color) {
    return keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, alpha: { value: 0.6 }, tint: { value: new T.Color(color) } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float time,alpha;uniform vec3 tint;varying vec2 vUv;void main(){float dash=step(.35,fract(vUv.x*24.-time*.6));float pulse=pow(max(0.,sin(vUv.x*6.28318*3.-time*3.)),8.);gl_FragColor=vec4(tint*(1.+pulse*1.5),(.25+dash*.45+pulse*.5)*alpha);}' }));
  };
  var rings = [];
  for (var i = 0; i < 3; i++) {
    var ring = new T.Mesh(keep(new T.TorusGeometry(44 + i * 9, 0.45 - i * 0.08, 6, low ? 90 : 160)), ringMat(i === 1 ? 0xd9f3ff : 0x6fc6ff));
    ring.rotation.set(Math.PI / 2 + i * 0.7, i * 1.1, 0); g.add(ring); rings.push(ring);
  }
  var rockGeo = keep(new T.IcosahedronGeometry(1, 1)), rp = rockGeo.attributes.position, rv = new T.Vector3();
  // Rochers arrachés au sol : silhouette cassée (sommets déplacés), basalte sombre
  // dont seules les arêtes s'illuminent du bleu du Point Zéro.
  for (var ri = 0; ri < rp.count; ri++) { rv.fromBufferAttribute(rp, ri); var rk = 0.72 + 0.5 * Math.abs(Math.sin(rv.x * 5.1 + rv.y * 3.7) * Math.cos(rv.z * 4.3 - rv.x)); rp.setXYZ(ri, rv.x * rk * 1.2, rv.y * rk * 0.75, rv.z * rk); }
  rockGeo.computeVertexNormals();
  var rockMat = keep(new T.MeshStandardMaterial({ color: 0x6a5646, roughness: 0.95, metalness: 0.05, emissive: 0x1a5f9c, emissiveIntensity: 0.05, flatShading: true }));
  var rockCount = low ? 14 : 30, rocks = new T.InstancedMesh(rockGeo, rockMat, rockCount); rocks.instanceMatrix.setUsage(T.DynamicDrawUsage); rocks.frustumCulled = false; g.add(rocks);
  var rockData = [];
  for (var r = 0; r < rockCount; r++) rockData.push({ radius: 70 + Math.random() * 90, angle: Math.random() * Math.PI * 2, height: -30 + Math.random() * 70, speed: (0.04 + Math.random() * 0.06) * (r % 2 ? 1 : -1), size: 1.5 + Math.random() * 4.5, spin: Math.random() * 3 });
  var columnMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, alpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float time,alpha;varying vec2 vUv;varying vec3 vN;varying vec3 vV;' + NOISE + 'void main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),2.);float n=fbm(vec3(vUv.x*8.,vUv.y*14.-time*1.6,time*.3));float packets=pow(max(0.,sin(vUv.y*60.-time*7.)),10.);float top=1.-smoothstep(.6,1.,vUv.y);vec3 c=mix(vec3(.25,.6,1.),vec3(.9,.97,1.),f*n);gl_FragColor=vec4(c,(f*(.4+n*.6)+packets*f*.5)*alpha*top);}' }));
  var colGeo = keep(new T.CylinderGeometry(1, 1, 1, 24, 1, true)); colGeo.translate(0, 0.5, 0);
  var column = new T.Mesh(colGeo, columnMat); column.scale.set(10, 1600, 10); column.visible = false; column.frustumCulled = false; g.add(column);
  var rippleMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3,
    uniforms: { time: { value: 0 }, alpha: { value: 0.7 }, stress: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time,alpha,stress;varying vec2 vUv;' + NOISE + 'void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float n=fbm(vec3(p*4.,time*.2));float rings=pow(max(0.,sin(r*38.-time*(2.4+stress*4.)+n*2.)),6.);float fall=(1.-smoothstep(.15,1.,r))*smoothstep(.03,.2,r);float caustic=pow(1.-smoothstep(.0,.06,abs(n-.5)),2.)*(1.-r);gl_FragColor=vec4(vec3(.35,.75,1.)*(rings*fall*.8+caustic*.25),(rings*fall*.55+caustic*.15)*alpha*(1.+stress));}' }));
  var ripple = new T.Mesh(keep(new T.PlaneGeometry(380, 380)), rippleMat); ripple.rotation.x = -Math.PI / 2; ripple.frustumCulled = false; group.add(ripple);
  return { group: g, rings: rings, rocks: rocks, rockData: rockData, rockMat: rockMat, column: column, columnMat: columnMat, ripple: ripple, rippleMat: rippleMat, dummy: new T.Object3D(), orbitPhase: 0, spinSpeed: 1 };
}
function updateZero(dt) {
  var v = E.eventVisuals, zero = v && v.zero, center = E.zeroPointPos; if (!zp || !center) return;
  var alive = !!(zero && zero.group.visible) && !late(), stress = zero && zero.mat ? zero.mat.uniforms.stress.value : 0;
  var meteorNear = E.meteorVisible && E.meteorPos ? clamp01(1 - E.meteorPos.distanceTo(center) / 1400) : 0;
  zp.group.visible = alive; zp.group.position.copy(center);
  if (alive) {
    zp.spinSpeed += (1 + stress * 2 + meteorNear * 3 - zp.spinSpeed) * (1 - Math.exp(-dt * 2.4));
    zp.orbitPhase += dt * zp.spinSpeed;
    zp.rings.forEach(function (ring, i) {
      var sign = i % 2 ? -1 : 1;
      ring.rotation.x = Math.PI / 2 + i * .7 + zp.orbitPhase * (.12 + i * .04) * sign;
      ring.rotation.y = i * 1.1 + zp.orbitPhase * (.09 + i * .035) * sign;
      ring.material.uniforms.time.value = zp.orbitPhase; ring.material.uniforms.alpha.value = .32 + stress * .3 + meteorNear * .25;
      ring.scale.setScalar(1 + Math.sin(zp.orbitPhase * .7 + i) * .02 - meteorNear * .12);
    });
    for (var r = 0; r < zp.rockData.length; r++) {
      var d = zp.rockData[r], a = d.angle + zp.orbitPhase * d.speed, pull = meteorNear * .35;
      zp.dummy.position.set(Math.cos(a) * d.radius * (1 - pull), d.height + Math.sin(clock * 0.6 + r) * 4 + meteorNear * 30, Math.sin(a) * d.radius * (1 - pull));
      zp.dummy.rotation.set(clock * 0.2 + d.spin, clock * 0.13 + r, d.spin); zp.dummy.scale.setScalar(d.size);
      zp.dummy.updateMatrix(); zp.rocks.setMatrixAt(r, zp.dummy.matrix);
    }
    zp.rocks.instanceMatrix.needsUpdate = true; zp.rockMat.emissiveIntensity = 0.08 + stress * 0.35 + meteorNear * 0.6;
  }
  var columnOn = E.rocketDestroyed && E.meteorContactTime == null && !late();
  zp.column.visible = columnOn;
  if (columnOn) { zp.columnMat.uniforms.time.value = clock; zp.columnMat.uniforms.alpha.value = (0.35 + Math.sin(clock * 5) * 0.08) * (1 + meteorNear); zp.column.scale.set(8 + meteorNear * 14 + Math.sin(clock * 9) * 0.8, 1700, 8 + meteorNear * 14); }
  zp.ripple.visible = !late(); zp.ripple.position.set(center.x, groundAt(center.x, center.z) + 0.6, center.z);
  zp.rippleMat.uniforms.time.value = clock; zp.rippleMat.uniforms.stress.value = stress + meteorNear;
  if (!alive) return;
  boltTimer -= dt;
  var rate = (E.rocketDestroyed ? 0.55 : 1.6) / (1 + meteorNear * 5 + stress * 2);
  if (boltTimer <= 0) {
    boltTimer = rate * (0.5 + Math.random());
    var ang = Math.random() * Math.PI * 2, reach = 60 + Math.random() * 150;
    tmp.set(center.x + Math.cos(ang) * reach, 0, center.z + Math.sin(ang) * reach); tmp.y = groundAt(tmp.x, tmp.z) + 1;
    tmp2.copy(center).addScaledVector(seg.subVectors(tmp, center).normalize(), (E.zeroPointVisR || 26));
    fireBolt(tmp2, tmp, 2.2 + Math.random() * 2, 0x9fdcff, 0.28, 0.16);
    if (E.fx && E.fx.sparkle) E.fx.sparkle(P(tmp), { color: 0xbfe8ff, count: 6, spread: 6, size: 4 });
    if (meteorNear > 0.35 && E.meteorPos) { tmp.copy(E.meteorPos); fireBolt(center, tmp, 4 + meteorNear * 4, 0xffd2a8, 0.35, 0.09); }
  }
}

/* ------------------------------------------------------------ meteor detail */
function makeBow() {
  var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, alpha: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float time,alpha;varying vec3 vN;varying vec3 vV;varying vec3 vP;' + NOISE + 'void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.8);float n=fbm(vP*.08+vec3(0.,time*2.,0.));float nose=smoothstep(-.2,1.,normalize(vP).y);vec3 c=mix(vec3(1.,.32,.05),vec3(1.,.9,.65),nose*n);gl_FragColor=vec4(c,(rim*rim*.75+n*.12)*nose*alpha);}' }));
  var m = new T.Mesh(keep(new T.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62)), mat); m.visible = false; m.frustumCulled = false; group.add(m);
  return { mesh: m, mat: mat };
}
function updateMeteor(dt) {
  var v = E.eventVisuals, meteor = v && v.meteor; if (!meteor || !E.meteorPos) return;
  var pos = meteor.group.position;
  if (dt > 0) { var s = pos.distanceTo(lastMeteor) / dt; meteorSpeed += (Math.min(s, 2000) - meteorSpeed) * Math.min(1, dt * 6); }
  var moving = meteor.visible && meteorSpeed > 25 && meteorSpeed < 1500 && !(E.riftWorld && E.riftWorld.active);
  if (moving) meteorWake.push(pos); else if (!meteor.visible) meteorWake.cut();
  bow.mesh.visible = moving && meteorSpeed > 60;
  if (bow.mesh.visible) {
    seg.subVectors(pos, lastMeteor).normalize();
    bow.mesh.position.copy(pos).addScaledVector(seg, (meteor.radius || 44) * 0.2);
    bow.mesh.quaternion.setFromUnitVectors(UP, seg); bow.mesh.scale.setScalar((meteor.radius || 44) * 1.32);
    bow.mat.uniforms.time.value = clock; bow.mat.uniforms.alpha.value = clamp01((meteorSpeed - 60) / 140) * 0.42;
  }
  lastMeteor.copy(pos);
}

/* ------------------------------------------------------------- rocket detail */
function updateRockets(dt) {
  var v = E.eventVisuals; if (!v || !v.rockets) return;
  var cam = api.camera(), best = null, bestScore = Infinity;
  v.rockets.forEach(function (r, i) {
    var trail = contrails[i]; if (!trail) return;
    if (r.active && r.throttle > 0.2 && !(E.riftWorld && E.riftWorld.active)) {
      tmp.copy(r.group.position).addScaledVector(r.direction, -26); trail.push(tmp);
      var score = cam ? cam.position.distanceTo(r.group.position) / (0.3 + r.throttle) : 0;
      if (score < bestScore) { bestScore = score; best = r; }
    } else if (!r.active) trail.cut();
  });
  rocketLight.visible = !!best;
  if (best) { rocketLight.position.copy(best.group.position).addScaledVector(best.direction, -30); rocketLight.intensity = 3 + best.throttle * 5 + Math.sin(clock * 40) * 0.6; }
  if (E.state === 'firstrocket' && v.rockets[0]) {
    var r0 = v.rockets[0], ts = E.tState;
    if (!padSmoke.origin && ts < 6) padSmoke.origin = r0.group.position.clone().add(tmp.set(0, -24, 0));
    var F = E.fx;
    if (padSmoke.origin && F && ts > 1 && ts < 16) {
      padSmoke.credit += dt * (ts < 6.4 ? 3 + ts * 1.5 : 14 * (1 - (ts - 6.4) / 9.6));
      while (padSmoke.credit >= 1) {
        padSmoke.credit--;
        F.smoke(P(padSmoke.origin), { count: 3, size: 26 + ts * 3, life: 8, alpha: 0.5, color: 0xe2e6ea, spread: 20, out: 55 + ts * 6, rise: 8, grow: 22 });
      }
    }
  }
}

/* ------------------------------------------------------------ black hole */
var SWALLOW = ['growth', 'destruction', 'playersucked', 'allgone'];
function makeHoleDressing() {
  var g = new T.Group(); g.name = 'v47-blackhole-dressing'; g.visible = false; group.add(g);
  var lensMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, alpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time,alpha;varying vec2 vUv;' + NOISE +
      'void main(){vec2 p=(vUv-.5)*2.*60.;float r=length(p);float a=atan(p.y,p.x);' +
      'float photon=exp(-abs(r-8.6)*3.2)*(.65+.35*pow(.5+.5*cos(a-.6),2.));float second=exp(-abs(r-9.6)*6.)*.35;' +
      'float warp=r-13.-3.6*abs(sin(a));float upper=exp(-abs(warp)*.9)*pow(abs(sin(a)),1.5);' +
      'float n=fbm(vec3(a*3.,r*.3-time*.6,time*.1));float streaks=pow(max(0.,sin(a*24.+r*1.3-time*2.6+n*4.)),6.);' +
      'float shadow=smoothstep(7.6,8.2,r);float fade=1.-smoothstep(30.,58.,r);' +
      'vec3 c=vec3(.55,.8,1.)*photon*1.8+vec3(.9,.97,1.)*second+mix(vec3(.18,.42,1.),vec3(.8,.92,1.),n)*upper*(.45+streaks*.6);' +
      'float al=(photon*1.2+second+upper*(.35+streaks*.4))*shadow*fade*alpha;gl_FragColor=vec4(c*al,al);}' }));
  var lens = new T.Mesh(keep(new T.PlaneGeometry(120, 120)), lensMat); lens.renderOrder = 1003; lens.frustumCulled = false; g.add(lens);
  var count = low ? 40 : 90, palette = [0x5f9a4e, 0x6a5d52, 0x7a8590, 0x2779a7, 0xc9b38a, 0x3f6b37];
  var debris = new T.InstancedMesh(keep(new T.BoxGeometry(1, 1, 1)), keep(new T.MeshBasicMaterial({ fog: false })), count);
  debris.instanceMatrix.setUsage(T.DynamicDrawUsage); debris.frustumCulled = false; debris.renderOrder = 1004; g.add(debris);
  var color = new T.Color(), items = [];
  for (var i = 0; i < count; i++) {
    debris.setColorAt(i, color.setHex(palette[i % palette.length]));
    items.push({ phase: Math.random(), period: 3.2 + Math.random() * 3.4, r0: 90 + Math.random() * 130, a0: Math.random() * Math.PI * 2, size: 0.6 + Math.random() * 2.4, lift: (Math.random() - 0.5) * 18 });
  }
  if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
  return { group: g, lens: lens, lensMat: lensMat, debris: debris, items: items, dummy: new T.Object3D(), target: null };
}
function updateHole() {
  var h = holeDress; if (!h) return;
  if (!h.target || !h.target.parent) h.target = api.scene().getObjectByName('azevent-blackhole') || null;
  var hole = h.target, s = hole ? hole.scale.x : 0;
  h.group.visible = !!(hole && hole.visible && s > 0.05 && E.state !== 'end');
  if (!h.group.visible) return;
  h.group.position.copy(hole.position); h.group.quaternion.copy(hole.quaternion); h.group.scale.setScalar(s);
  h.lensMat.uniforms.time.value = clock; h.lensMat.uniforms.alpha.value = smooth((s - 0.05) / 0.6) * (E.state === 'numbers' ? 0.85 : 1);
  var swallowing = SWALLOW.indexOf(E.state) !== -1, dummy = h.dummy;
  h.debris.visible = swallowing;
  if (!swallowing) return;
  h.items.forEach(function (d, i) {
    var u = ((clock / d.period) + d.phase) % 1, fall = Math.pow(u, 1.8), r = 8.5 + (d.r0 - 8.5) * (1 - fall);
    var a = d.a0 + u * (4 + 14 * fall), x = Math.cos(a) * r, y = Math.sin(a) * r;
    var stretch = 1 + fall * 7, thin = Math.max(0.12, 1 - fall * 0.85);
    dummy.position.set(x, y, d.lift * (1 - fall));
    dummy.rotation.set(0, 0, a + Math.PI / 2);
    dummy.scale.set(d.size * stretch, d.size * thin, d.size * thin);
    if (u > 0.985) dummy.scale.setScalar(0.0001);
    dummy.updateMatrix(); h.debris.setMatrixAt(i, dummy.matrix);
  });
  h.debris.instanceMatrix.needsUpdate = true;
}
var holeDress = null;

/* ------------------------------------------------------------------ events */
function bind() {
  if (listenersBound) return; listenersBound = true;
  E.on('rift:close', function (d) {
    if (!api || !d || !d.pos) return;
    var portal = (E.rifts || []).find(function (p) { return p.kind === d.kind; });
    leaveScar(d.pos, portal ? portal.radius : 50, portal ? portal.group.quaternion : null);
  });
  E.on('rift:open', function (d) {
    if (!api || !d || !d.pos || !E.fx) return;
    E.fx.halo(P(d.pos), { radius: (d.radius || 50) * 2.2, color: 0xbfe6ff, dur: 0.7, anticip: 0.02 });
    for (var i = 0; i < 3; i++) { tmp.copy(d.pos).add(tmp2.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar((d.radius || 50) * 2.6)); fireBolt(d.pos, tmp, 2.5, 0xbfe6ff, 0.35, 0.18); }
  });
  E.on('rocket:rift-enter', function (d) {
    if (!api || !d || !d.pos || !E.fx) return;
    E.fx.burst(P(d.pos), { color: 0xd9f3ff, count: 26, speed: 60, size: 7, life: 0.9, gravity: 0 });
    E.fx.sparkle(P(d.pos), { color: 0x8fd4ff, count: 20, spread: 40, size: 6, life: 0.7 });
  });
  E.on('launchpad:liftoff', function () {
    if (!api || !padSmoke.origin) return;
    triggerShock(padSmoke.origin, 230, 2.4, 40, 0xffd9a8);
    if (E.fx) E.fx.smoke(P(padSmoke.origin), { count: 60, size: 40, life: 10, alpha: 0.55, color: 0xeef0f2, spread: 30, out: 110, rise: 6, grow: 30 });
  });
  E.on('rocket:zeroshock', function (d) {
    if (!api) return; var c = (d && d.pos) || E.zeroPointPos; if (!c) return;
    triggerShock(tmp.set(c.x, groundAt(c.x, c.z), c.z), 680, 3, 55, 0xbfe6ff);
  });
  E.on('meteor:hit', function (d) {
    if (!api) return; var c = (d && d.pos) || E.zeroPointPos; if (!c) return;
    triggerShock(tmp.set(c.x, groundAt(c.x, c.z), c.z), 1300, 4.2, 120, 0xffd9b0);
    meteorWake.cut();
    for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; tmp2.set(c.x + Math.cos(a) * 260, c.y + 120 + Math.random() * 200, c.z + Math.sin(a) * 260); fireBolt(c, tmp2, 6, 0xd8eeff, 0.6, 0.14); }
  });
}

function build() {
  group = new T.Group(); group.name = 'v47-overdrive'; api.scene().add(group); glowTex = radialTexture();
  contrails = [];
  for (var i = 0; i < 7; i++) contrails.push(makeRibbon({ count: low ? 70 : 130, interval: 0.11, gap: 140, life: 15, width0: 2.4, grow: 1.05, rise: 0.6, hot: 0xffffff, cold: 0xa9bccb, opacity: i === 0 ? 0.72 : 0.6 }));
  meteorWake = makeRibbon({ count: low ? 80 : 150, interval: 0.09, gap: 260, life: 18, width0: 26, grow: 7, rise: 1.4, hot: 0xffa25a, cold: 0x2b2522, opacity: 0.82 });
  scars = []; for (var s = 0; s < (low ? 14 : 28); s++) scars.push(makeScar());
  bolts = []; for (var b = 0; b < (low ? 6 : 12); b++) bolts.push(makeBolt());
  shocks = [makeShock(), makeShock()];
  zp = makeZeroDressing(); bow = makeBow(); holeDress = makeHoleDressing();
  rocketLight = new T.PointLight(0xffb27a, 0, 340, 2); group.add(rocketLight);
  padSmoke = { origin: null, credit: 0 };
}
function teardown() {
  if (group && group.parent) group.parent.remove(group);
  resources.forEach(function (r) { if (r && r.dispose) r.dispose(); }); resources = [];
  group = zp = bow = rocketLight = meteorWake = holeDress = null; contrails = []; scars = []; bolts = []; shocks = [];
}

E.register('overdrive', {
  init: function (a) {
    api = a; low = !!(a.isMobile || a.quality === 'low'); clock = 0; meteorSpeed = 0; boltTimer = 1;
    teardown(); build(); bind();
    if (E.meteorPos) lastMeteor.copy(E.meteorPos);
  },
  preUpdate: function (dt) {
    if (!api || !group) return;
    clock = E.tTotal;
    updateRockets(dt); updateMeteor(dt); updateZero(dt); updateScars(); updateShocks(dt); updateBolts(dt); updateHole();
    contrails.forEach(function (c) { c.mat.uniforms.fade.value = late() ? 1 - smooth((E.tTotal - E.TIMELINE.contraction[0]) / 5) : 1; c.update(); });
    meteorWake.mat.uniforms.fade.value = late() ? 1 - smooth((E.tTotal - E.TIMELINE.contraction[0]) / 4) : 1; meteorWake.update();
    E.overdrive = { contrails: contrails.length, scars: scars.filter(function (s) { return s.born >= 0; }).length, meteorSpeed: meteorSpeed };
  },
  dispose: function () { teardown(); api = null; E.overdrive = null; }
});
})(window);
