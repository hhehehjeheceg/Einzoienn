/* ============================================================================
 * AZUR Horizons — THE END · Le Point Zéro abat le Battle Bus (v47)
 * -----------------------------------------------------------------------------
 * Quand le bus termine son trajet (transport -> active) :
 *   1. CHARGE   — le Point Zéro aspire l'énergie (implosion, anneaux qui se
 *                 resserrent) et verrouille le bus avec un faisceau de visée.
 *   2. LASER    — rayon triple couche (shader) qui jaillit du Point Zéro et
 *                 frappe le bus : paquets d'énergie, étincelles, éclat.
 *   3. DÉCHIRURE — explosion sur le bus, le ballon se déchire et se dégonfle.
 *   4. CHUTE    — vrille, feu, longue traînée de fumée noire, débris.
 *   5. CRASH    — VRAIE ONDE DE CHOC : flash, dôme, anneau au sol épousant le
 *                 relief, mur de poussière, souffle qui projette le joueur,
 *                 cratère calciné, débris qui rebondissent, champignon.
 *   6. ÉPAVE    — l'épave brûle et fume jusqu'à la fin de l'événement.
 * v47 : les effets utilisent enfin AZEvent.fx (api.fx n'a jamais existé,
 * aucune particule du crash ne s'affichait).
 * v48 : le bus est abattu EN PLEIN TRAJET (bien avant la fin de sa route),
 * le joueur RESTE À BORD pendant toute la chute, le bus percute un bâtiment
 * d'une ville qui s'effondre, et l'éjection n'a lieu qu'à l'atterrissage.
 * Le compte à rebours démarre dès le départ et continue pendant le crash.
 * ========================================================================== */
(function (root) {
  'use strict';

  var E = root.AZEvent, T = root.THREE;
  if (!E || !T) return;

  var CHARGE_DUR = 2.4, LASER_DUR = 1.9, WRECK_SMOKE_DUR = 90, FALL_DUR = 11.5, EJECT_DELAY = 1.8;
  var GRAV = 34, SHOCK_DUR = 3.4, SHOCK_RADIUS = 470, DOME_RADIUS = 300;
  var SEA = -2, BUS_CRASH_AT = 35; // v50 : crash à 3 s de la fin du trajet (38 s), pas au milieu
  E.BUS_CRASH_AT = BUS_CRASH_AT;

  var api = null, low = false, group = null, resources = [];
  var renderRenderer = null, renderPrevious = null, renderWrapper = null;
  var phase = 'idle', tPhase = 0, clock = 0, lastWorldPhase = '';
  var pathPos = new T.Vector3(), pathPrev = new T.Vector3(), heading = 0;
  var busMesh = null, balloon = null, balloonSaved = null;
  var busPos = new T.Vector3(), busVel = new T.Vector3(), busBase = new T.Vector3(), busRot = { x: 0, y: 0, z: 0 };
  var routeVel = new T.Vector3(), prevPos = new T.Vector3(), approach = new T.Vector3(1, 0, 0);
  var fallFrom = new T.Vector3(), fallTo = new T.Vector3(), fallM0 = new T.Vector3(), fallM1 = new T.Vector3();
  var roll = 0, laserFrom = new T.Vector3(), zeroPos = new T.Vector3(), crash = new T.Vector3();
  var inBus = false, ejected = true, targetHouse = null, targetCity = '', collapse = null;
  var timers = { fire: 0, smoke: 0, debris: 0, spark: 0, wreck: 0 };
  var beam = null, chargeFx = null, shock = null, crater = null, debris = null, trail = null, busGlow = null, busLight = null;
  var flash = 0, knocked = false, secondary = false, impactAt = -1, glowTex = null;
  var tmp = new T.Vector3(), tmp2 = new T.Vector3(), dir = new T.Vector3(), UP = new T.Vector3(0, 1, 0);

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smooth = function (v) { v = clamp01(v); return v * v * (3 - 2 * v); };
  var NOISE = 'float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}' +
    'float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}' +
    'float fbm(vec3 p){return .55*noise(p)+.28*noise(p*2.1)+.14*noise(p*4.3);}';

  function fx() { return E.fx || null; }
  function keep(r) { resources.push(r); return r; }
  function groundAt(x, z) {
    try { if (root.AZSim && root.AZSim.heightAt) return Math.max(SEA + 0.4, root.AZSim.heightAt(x, z)); } catch (e) {}
    return 40;
  }
  function isWaterAt(x, z) {
    try { if (root.AZSim && root.AZSim.isWater) return root.AZSim.isWater(x, z) || root.AZSim.heightAt(x, z) < SEA + 0.6; } catch (e) {}
    return false;
  }
  function P(x, y, z) { return { x: x, y: y, z: z }; }
  function playerDistance() {
    var p = api && api.player(); if (!p) return Infinity;
    return Math.hypot(p.x - crash.x, p.z - crash.z);
  }
  function shake(force, duration, from) {
    var p = api && api.player(), k = 1;
    if (p && from) k = Math.max(0.25, 1 - Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z) / 1800);
    try { E.emit('camera:shake', { force: force * k, duration: duration }); } catch (e) {}
  }

  function radialTexture() {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var g = cv.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.2, 'rgba(255,255,255,.75)');
    grad.addColorStop(0.5, 'rgba(255,255,255,.18)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return keep(new T.CanvasTexture(cv));
  }
  function glowSprite(color, size, opacity) {
    var mat = keep(new T.SpriteMaterial({ map: glowTex, color: color, transparent: true, opacity: opacity,
      blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    var s = new T.Sprite(mat); s.scale.setScalar(size); s.renderOrder = 20; return s;
  }

  /* ---------------------------------------------------------------- laser */
  function makeBeam() {
    var g = new T.Group(); g.name = 'v47-zero-laser'; g.visible = false; group.add(g);
    var geo = keep(new T.CylinderGeometry(1, 1, 1, low ? 14 : 28, 1, true)); geo.translate(0, 0.5, 0);
    function layer(radius, color, power, gain) {
      var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
        uniforms: { time: { value: 0 }, len: { value: 1 }, tint: { value: new T.Color(color) }, alpha: { value: 0 }, power: { value: power }, grow: { value: 0 }, gain: { value: gain } },
        vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'uniform float time,len,alpha,power,grow,gain;uniform vec3 tint;varying vec3 vN;varying vec3 vV;varying vec2 vUv;' + NOISE +
          'void main(){float facing=abs(dot(normalize(vN),normalize(vV)));float core=pow(facing,power);float along=vUv.y*len;' +
          'float bands=.7+.3*sin(along*.11-time*42.);float packets=pow(max(0.,sin(along*.016-time*11.)),16.);' +
          'float flicker=.82+.18*fbm(vec3(along*.03-time*14.,vUv.x*6.,time*3.));float head=1.-smoothstep(grow-.015,grow,vUv.y);' +
          'vec3 c=tint*core*(gain+packets*1.8)*bands*flicker;gl_FragColor=vec4(c,clamp(core*alpha*head*(.72+packets*.7),0.,1.));}' }));
      var m = new T.Mesh(geo, mat); m.scale.set(radius, 1, radius); m.frustumCulled = false; g.add(m);
      return { mesh: m, mat: mat, radius: radius };
    }
    var layers = [layer(26, 0x1f5dff, 1.4, 0.55), layer(9, 0x58c8ff, 1.8, 1.0), layer(3.2, 0xf2fbff, 2.6, 1.6)];
    var source = glowSprite(0x9fdcff, 90, 0); group.add(source);
    var impact = glowSprite(0xe6f6ff, 70, 0); group.add(impact);
    var impactHalo = glowSprite(0x4aa6ff, 160, 0); group.add(impactHalo);
    return { group: g, layers: layers, source: source, impact: impact, impactHalo: impactHalo, grow: 0 };
  }
  function placeBeam(from, to, alpha, grow, widthScale) {
    dir.subVectors(to, from); var len = dir.length(); if (len < 1) { beam.group.visible = false; return; }
    beam.group.visible = alpha > 0.003; beam.group.position.copy(from);
    beam.group.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
    beam.group.scale.set(1, len, 1);
    beam.layers.forEach(function (l, i) {
      var wobble = 1 + Math.sin(clock * (47 + i * 13)) * 0.09 + Math.sin(clock * (19 + i * 7)) * 0.05;
      l.mesh.scale.set(l.radius * widthScale * wobble, 1, l.radius * widthScale * wobble);
      l.mat.uniforms.time.value = clock; l.mat.uniforms.len.value = len; l.mat.uniforms.alpha.value = alpha; l.mat.uniforms.grow.value = grow;
    });
  }

  /* --------------------------------------------------------------- charge */
  function makeCharge() {
    var g = new T.Group(); g.name = 'v47-zero-charge'; g.visible = false; group.add(g);
    var core = glowSprite(0xbfe6ff, 40, 0); g.add(core);
    var rings = [];
    for (var i = 0; i < 3; i++) {
      var ring = new T.Mesh(keep(new T.TorusGeometry(1, 0.012, 6, low ? 64 : 128)),
        keep(new T.MeshBasicMaterial({ color: i === 1 ? 0xffffff : 0x6fd0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
      ring.rotation.set(Math.PI / 2 + i * 0.5, i * 0.9, 0); g.add(ring); rings.push(ring);
    }
    return { group: g, core: core, rings: rings };
  }

  /* -------------------------------------------------------- smoke ribbon */
  function makeTrail() {
    var count = low ? 70 : 140, samples = new Float32Array(count * 3), times = new Float32Array(count).fill(-1e9);
    var positions = new Float32Array(count * 6), ages = new Float32Array(count * 2), uv = new Float32Array(count * 4), index = [];
    for (var i = 0; i < count; i++) {
      uv[i * 4] = 0; uv[i * 4 + 1] = i / count; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / count;
      if (i < count - 1) { var a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var geo = keep(new T.BufferGeometry());
    geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aAge', new T.BufferAttribute(ages, 1).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(index);
    var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 } },
      vertexShader: 'attribute float aAge;varying float vAge;varying vec2 vUv;void main(){vAge=aAge;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float time;varying float vAge;varying vec2 vUv;' + NOISE +
        'void main(){float across=1.-abs(vUv.x*2.-1.);float n=fbm(vec3(vUv.x*3.,vUv.y*26.-time*.6,vAge*.4));' +
        'float body=smoothstep(.0,.55,across*(.55+n*.9));float life=clamp(1.-vAge/14.,0.,1.);float young=clamp(vAge*3.,0.,1.);' +
        'vec3 hot=mix(vec3(1.,.55,.16),vec3(.09,.08,.08),clamp(vAge*1.6,0.,1.));gl_FragColor=vec4(hot,body*life*young*.78);}' }));
    var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; group.add(mesh);
    var cursor = 0, filled = 0, last = -1e9, side = new T.Vector3(), toCam = new T.Vector3(), seg = new T.Vector3(), pt = new T.Vector3();
    return {
      push: function (p) {
        if (clock - last < 0.06) return; last = clock;
        samples[cursor * 3] = p.x; samples[cursor * 3 + 1] = p.y; samples[cursor * 3 + 2] = p.z; times[cursor] = clock;
        cursor = (cursor + 1) % count; filled = Math.min(count, filled + 1);
      },
      update: function () {
        var cam = api.camera(); if (!cam || !filled) { mesh.visible = false; return; }
        mesh.visible = true; mat.uniforms.time.value = clock;
        for (var i = 0; i < count; i++) {
          var k = Math.min(i, filled - 1), at = (cursor - 1 - k + count * 2) % count, prev = (at - 1 + count) % count, n = at * 3, q = prev * 3;
          pt.set(samples[n], samples[n + 1], samples[n + 2]);
          seg.set(samples[q] - pt.x, samples[q + 1] - pt.y, samples[q + 2] - pt.z);
          toCam.subVectors(cam.position, pt); side.crossVectors(seg, toCam).normalize();
          if (side.lengthSq() < 0.1) side.set(1, 0, 0);
          var age = i < filled ? clock - times[at] : 99, w = 5 + Math.min(age, 14) * 4.2;
          side.multiplyScalar(w); var o = i * 6;
          positions[o] = pt.x + side.x; positions[o + 1] = pt.y + side.y + age * 2.2; positions[o + 2] = pt.z + side.z;
          positions[o + 3] = pt.x - side.x; positions[o + 4] = pt.y - side.y + age * 2.2; positions[o + 5] = pt.z - side.z;
          ages[i * 2] = ages[i * 2 + 1] = age;
        }
        geo.attributes.position.needsUpdate = geo.attributes.aAge.needsUpdate = true;
      }
    };
  }

  /* ------------------------------------------------------------ shockwave */
  function conformingBand(segments, additive, fragment, uniforms) {
    var verts = (segments + 1) * 2, positions = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), index = [];
    for (var i = 0; i <= segments; i++) {
      uv[i * 4] = i / segments; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / segments; uv[i * 4 + 3] = 1;
      if (i < segments) { var a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var geo = keep(new T.BufferGeometry());
    geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(index);
    var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending, uniforms: uniforms,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: fragment }));
    var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
    return { mesh: mesh, mat: mat, positions: positions, segments: segments };
  }
  function makeShock() {
    var segs = low ? 72 : 160;
    var ring = conformingBand(segs, true,
      'uniform float time;uniform float alpha;varying vec2 vUv;' + NOISE +
      'void main(){float across=vUv.y;float n=fbm(vec3(vUv.x*70.,across*4.,time*1.3));' +
      'float front=smoothstep(.55,.92,across)*(1.-smoothstep(.92,1.,across));float wake=smoothstep(0.,.6,across)*(1.-smoothstep(.6,.95,across))*.35;' +
      'float a=(front*(.65+n*.7)+wake*n)*alpha;vec3 c=mix(vec3(1.,.62,.28),vec3(1.,.95,.86),front);gl_FragColor=vec4(c*a*1.6,a);}',
      { time: { value: 0 }, alpha: { value: 0 } });
    var dust = conformingBand(segs, false,
      'uniform float time;uniform float alpha;varying vec2 vUv;' + NOISE +
      'void main(){float h=vUv.y;float n=fbm(vec3(vUv.x*46.,h*3.-time*.9,time*.3));float billow=fbm(vec3(vUv.x*18.+time*.2,h*1.6,1.7));' +
      'float body=(1.-smoothstep(.15,1.,h+ (n-.5)*.55))*smoothstep(0.,.06,h);vec3 c=mix(vec3(.42,.35,.28),vec3(.74,.66,.56),billow*.8+h*.3);' +
      'gl_FragColor=vec4(c,clamp(body*(.55+billow*.6)*alpha,0.,.92));}',
      { time: { value: 0 }, alpha: { value: 0 } });
    var domeMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
      uniforms: { time: { value: 0 }, alpha: { value: 0 } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float time;uniform float alpha;varying vec3 vN;varying vec3 vV;varying vec3 vP;' + NOISE +
        'void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.2);float n=fbm(normalize(vP)*7.+vec3(0.,-time*.8,time*.4));' +
        'float base=smoothstep(.0,.25,vP.y);float a=(rim*(.7+n*.6)+n*.05)*alpha*(.35+base*.65);gl_FragColor=vec4(vec3(1.,.82,.6)*a,a);}' }));
    var dome = new T.Mesh(keep(new T.SphereGeometry(1, low ? 32 : 56, low ? 12 : 20, 0, Math.PI * 2, 0, Math.PI / 2)), domeMat);
    dome.visible = false; dome.frustumCulled = false; group.add(dome);
    var fireball = new T.Mesh(keep(new T.SphereGeometry(1, 28, 18)), keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { time: { value: 0 }, alpha: { value: 0 } },
      vertexShader: 'varying vec3 vP;varying vec3 vN;varying vec3 vV;uniform float time;' + NOISE + 'void main(){vP=position;vec3 p=position*(1.+(fbm(position*2.6+vec3(time*1.4))-.5)*.5);vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(p,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float time;uniform float alpha;varying vec3 vP;varying vec3 vN;varying vec3 vV;' + NOISE +
        'void main(){float n=fbm(vP*3.+vec3(0.,-time*2.,0.));float facing=abs(dot(normalize(vN),normalize(vV)));vec3 c=mix(vec3(1.,.28,.04),vec3(1.,.93,.7),pow(facing,1.5)*n*1.4);gl_FragColor=vec4(c,alpha*(.45+n*.55)*facing);}' })));
    fireball.visible = false; fireball.frustumCulled = false; group.add(fireball);
    var flare = glowSprite(0xffe2b0, 320, 0); group.add(flare);
    return { ring: ring, dust: dust, dome: dome, domeMat: domeMat, fireball: fireball, flare: flare, age: -1 };
  }
  function updateBand(band, radiusIn, radiusOut, yIn, yOut) {
    var s = band.segments, pos = band.positions;
    for (var i = 0; i <= s; i++) {
      var a = i / s * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), o = i * 6;
      var x0 = crash.x + c * radiusIn, z0 = crash.z + sn * radiusIn, x1 = crash.x + c * radiusOut, z1 = crash.z + sn * radiusOut;
      pos[o] = x0; pos[o + 1] = groundAt(x0, z0) + yIn; pos[o + 2] = z0;
      pos[o + 3] = x1; pos[o + 4] = groundAt(x1, z1) + yOut; pos[o + 5] = z1;
    }
    band.mesh.geometry.attributes.position.needsUpdate = true;
  }
  function updateShock(dt) {
    if (!shock || shock.age < 0) return;
    shock.age += dt;
    var t = shock.age, p = clamp01(t / SHOCK_DUR), expand = 1 - Math.pow(1 - p, 2.6);
    var R = 8 + expand * SHOCK_RADIUS, width = 14 + expand * 60;
    shock.ring.mesh.visible = p < 1;
    if (shock.ring.mesh.visible) {
      updateBand(shock.ring, Math.max(0, R - width), R, 1.4, 1.4);
      shock.ring.mat.uniforms.time.value = clock; shock.ring.mat.uniforms.alpha.value = Math.pow(1 - p, 1.3) * 1.1;
    }
    var dp = clamp01(t / (SHOCK_DUR * 1.9)), dustR = 6 + (1 - Math.pow(1 - dp, 2.2)) * SHOCK_RADIUS * 0.94;
    var dustH = 8 + 74 * Math.pow(1 - dp, 0.7) * smooth(t / 0.25);
    shock.dust.mesh.visible = dp < 1;
    if (shock.dust.mesh.visible) {
      var s = shock.dust.segments, pos = shock.dust.positions;
      for (var i = 0; i <= s; i++) {
        var a = i / s * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), o = i * 6;
        var x = crash.x + c * dustR, z = crash.z + sn * dustR, g = groundAt(x, z), wob = Math.sin(a * 9 + clock * 0.7) * 0.12 + Math.sin(a * 23) * 0.06;
        pos[o] = x; pos[o + 1] = g - 1; pos[o + 2] = z;
        pos[o + 3] = crash.x + c * (dustR - dustH * 0.28); pos[o + 4] = g + dustH * (1 + wob); pos[o + 5] = crash.z + sn * (dustR - dustH * 0.28);
      }
      shock.dust.mesh.geometry.attributes.position.needsUpdate = true;
      shock.dust.mat.uniforms.time.value = clock; shock.dust.mat.uniforms.alpha.value = Math.pow(1 - dp, 1.1) * smooth(t / 0.2);
    }
    var domeP = clamp01(t / 2.2);
    shock.dome.visible = domeP < 1; shock.dome.position.set(crash.x, crash.y - 4, crash.z);
    shock.dome.scale.setScalar(4 + (1 - Math.pow(1 - domeP, 3)) * DOME_RADIUS);
    shock.domeMat.uniforms.time.value = clock; shock.domeMat.uniforms.alpha.value = Math.pow(1 - domeP, 1.6) * 1.2;
    var fb = clamp01(t / 1.6);
    shock.fireball.visible = fb < 1; shock.fireball.position.set(crash.x, crash.y + 6 + fb * 40, crash.z);
    shock.fireball.scale.setScalar(6 + (1 - Math.pow(1 - fb, 2.4)) * 62);
    shock.fireball.material.uniforms.time.value = clock; shock.fireball.material.uniforms.alpha.value = Math.pow(1 - fb, 1.4);
    shock.flare.position.set(crash.x, crash.y + 16, crash.z);
    shock.flare.material.opacity = Math.exp(-t * 3.2) * 0.95; shock.flare.scale.setScalar(140 + t * 260);
    var pd = playerDistance();
    if (!knocked && pd <= R) { knocked = true; knockPlayer(pd); }
  }
  function knockPlayer(distance) {
    var p = api.player(); if (!p) return;
    var k = 1 - distance / (SHOCK_RADIUS + 40); if (k <= 0) return;
    shake(0.55 + k * 0.6, 0.9 + k * 0.8);
    flash = Math.max(flash, 0.12 + k * 0.25);
    if (!p.grounded || p._meteorRide || p._eventFloat || p.vehicleId || p.swimming || p.downed) return;
    var nx = (p.x - crash.x) / Math.max(1, distance), nz = (p.z - crash.z) / Math.max(1, distance);
    p.grounded = false; p.jumping = true; p._jumpTime = 0; p._vy = 5 + k * 9;
    p._vx = (p._vx || 0) + nx * (8 + k * 16); p._vz = (p._vz || 0) + nz * (8 + k * 16);
    E.emit('bus:shockwave-hit', { force: k });
  }

  /* --------------------------------------------------------------- crater */
  function makeCrater(radius) {
    var rings = 12, segs = low ? 36 : 64, verts = (rings + 1) * (segs + 1), positions = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), index = [];
    for (var r = 0; r <= rings; r++) for (var s = 0; s <= segs; s++) {
      var i = r * (segs + 1) + s, rr = r / rings * radius, a = s / segs * Math.PI * 2;
      var x = crash.x + Math.cos(a) * rr, z = crash.z + Math.sin(a) * rr, dip = (1 - r / rings) * (1 - r / rings) * 2.6;
      positions[i * 3] = x; positions[i * 3 + 1] = groundAt(x, z) + 0.35 - dip * 0.3; positions[i * 3 + 2] = z;
      uv[i * 2] = s / segs; uv[i * 2 + 1] = r / rings;
      if (r < rings && s < segs) { var a0 = i, a1 = i + 1, b0 = i + segs + 1, b1 = b0 + 1; index.push(a0, b0, a1, a1, b0, b1); }
    }
    var geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(positions, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(index);
    var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false,
      uniforms: { heat: { value: 1 }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float heat;uniform float time;varying vec2 vUv;' + NOISE +
        'void main(){float r=vUv.y;float a=vUv.x*6.28318;vec3 q=vec3(cos(a)*r*6.,sin(a)*r*6.,1.3);float n=fbm(q);float edge=1.-smoothstep(.55,1.,r+(n-.5)*.35);' +
        'float cracks=pow(1.-smoothstep(.0,.07,abs(fbm(q*2.3)-.5)),2.)*(1.-smoothstep(.2,.85,r));float rays=pow(max(0.,cos(a*17.+n*4.)),12.)*smoothstep(.35,.9,r)*(1.-smoothstep(.9,1.,r));' +
        'vec3 c=mix(vec3(.025,.022,.02),vec3(.16,.13,.1),smoothstep(.25,1.,r)+n*.2);float glow=cracks*heat*(.75+.25*sin(time*3.+n*9.));' +
        'c+=vec3(1.,.38,.08)*glow*1.8+vec3(1.,.6,.25)*exp(-r*7.)*heat*.6;gl_FragColor=vec4(c,clamp(edge*.94+rays*.3,0.,1.));}' }));
    var mesh = new T.Mesh(geo, mat); mesh.renderOrder = 2; mesh.frustumCulled = false; group.add(mesh);
    return { mesh: mesh, mat: mat };
  }

  /* --------------------------------------------------------------- debris */
  function makeDebris() {
    var count = low ? 24 : 48, palette = [0x2779a7, 0x2779a7, 0x7795a0, 0xf5c26e, 0x1d2a33, 0xe58965];
    var mat = keep(new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.45, emissive: 0xff4a12, emissiveIntensity: 0 }));
    var mesh = new T.InstancedMesh(keep(new T.BoxGeometry(1, 1, 1)), mat, count);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
    var color = new T.Color(), items = [];
    for (var i = 0; i < count; i++) {
      mesh.setColorAt(i, color.setHex(palette[i % palette.length]));
      items.push({ pos: new T.Vector3(), vel: new T.Vector3(), rot: new T.Euler(), spin: new T.Vector3(), size: new T.Vector3(), alive: false, rest: false, burn: 0 });
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return { mesh: mesh, mat: mat, items: items, dummy: new T.Object3D(), cursor: 0 };
  }
  function spawnDebris(origin, number, speed, upward) {
    if (!debris) return;
    debris.mesh.visible = true;
    for (var n = 0; n < number; n++) {
      var d = debris.items[debris.cursor++ % debris.items.length], a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      d.pos.copy(origin).add(tmp.set((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8));
      d.vel.set(Math.cos(a) * s, upward * (0.5 + Math.random() * 0.9), Math.sin(a) * s);
      d.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      var big = 1.2 + Math.random() * 3.6; d.size.set(big * (0.8 + Math.random()), big * (0.25 + Math.random() * 0.4), big * (0.6 + Math.random()));
      d.alive = true; d.rest = false; d.burn = Math.random() < 0.45 ? 4 + Math.random() * 8 : 0;
    }
  }
  function updateDebris(dt) {
    if (!debris || !debris.mesh.visible) return;
    var F = fx(), dummy = debris.dummy, age = impactAt >= 0 ? clock - impactAt : 0;
    debris.mat.emissiveIntensity = impactAt >= 0 ? Math.max(0, 1.4 * Math.exp(-age * 0.12)) : 0.9;
    debris.items.forEach(function (d, i) {
      if (!d.alive) { dummy.scale.setScalar(0.0001); dummy.updateMatrix(); debris.mesh.setMatrixAt(i, dummy.matrix); return; }
      if (!d.rest) {
        d.vel.y -= GRAV * dt; d.vel.multiplyScalar(Math.exp(-dt * 0.08)); d.pos.addScaledVector(d.vel, dt);
        d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt;
        var g = groundAt(d.pos.x, d.pos.z) + d.size.y * 0.5;
        if (d.pos.y <= g) {
          d.pos.y = g;
          if (Math.abs(d.vel.y) > 6) { d.vel.y *= -0.32; d.vel.x *= 0.55; d.vel.z *= 0.55; d.spin.multiplyScalar(0.5); if (F && Math.random() < 0.5) F.smoke(P(d.pos.x, d.pos.y, d.pos.z), { count: 4, size: 10, life: 1.6, alpha: 0.35, color: 0x9a8c7c }); }
          else { d.rest = true; d.rot.x = Math.round(d.rot.x / Math.PI) * Math.PI; d.rot.z = Math.round(d.rot.z / Math.PI) * Math.PI; }
        }
      }
      if (d.burn > 0 && F) { d.burn -= dt; if (Math.random() < dt * 6) F.fire(P(d.pos.x, d.pos.y + 1, d.pos.z), { count: 3, size: 6, life: 0.7, spread: 2 }); }
      dummy.position.copy(d.pos); dummy.rotation.copy(d.rot); dummy.scale.copy(d.size); dummy.updateMatrix(); debris.mesh.setMatrixAt(i, dummy.matrix);
    });
    debris.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------------------- render hook */
  function installRenderHook() {
    var v = api.view(), rdr = v && v.renderer;
    if (!rdr || rdr._azBusCrashHook) return;
    rdr._azBusCrashHook = true;
    renderRenderer = rdr; renderPrevious = rdr.render;
    var previous = renderPrevious;
    renderWrapper = function (scene, camera) {
      if (phase !== 'idle' && busMesh) {
        // YXZ : cap, puis piqué, puis vrille autour de l'axe du bus.
        busMesh.visible = true; busMesh.position.copy(busPos); busMesh.rotation.order = 'YXZ'; busMesh.rotation.set(busRot.x, busRot.y, busRot.z);
      }
      return previous.apply(rdr, arguments);
    };
    rdr.render = renderWrapper;
  }
  function findLandTarget(from) {
    var x = from.x + routeVel.x * 10, z = from.z + routeVel.z * 10;
    for (var i = 0; i < 40 && isWaterAt(x, z); i++) { x *= 0.92; z *= 0.92; }
    if (Math.hypot(x, z) < 160) { var a = Math.atan2(z, x); x = Math.cos(a) * 200; z = Math.sin(a) * 200; }
    return { x: x, z: z };
  }
  /* La ville visée : devant le bus, hors du centre (Point Zéro), assez
   * peuplée ; on y choisit le bâtiment le plus haut près du centre-ville. */
  function pickCityTarget(w, from) {
    var S = root.AZSim, regions = (S && S.regions) || [];
    var houses = ((w && w.objects) || []).filter(function (o) { return o.type === 'house' && !o.dead; });
    var fx0 = routeVel.x, fz0 = routeVel.z, fl = Math.hypot(fx0, fz0) || 1;
    var zoneX = from.x + fx0 / fl * 300, zoneZ = from.z + fz0 / fl * 300, best = null, bestScore = Infinity;
    regions.forEach(function (r) {
      if (Math.hypot(r.x, r.z) < 150) return;
      var d = Math.hypot(r.x - from.x, r.z - from.z); if (d < 170 || d > 520) return;
      var inCity = houses.filter(function (o) { return Math.hypot(o.x - r.x, o.z - r.z) < 75; });
      if (inCity.length < 6) return;
      var score = Math.hypot(r.x - zoneX, r.z - zoneZ) - inCity.length * 2;
      // v50 : la VILLE GLACÉE (biome snow) est ciblée en priorité
      if (r.biome === 'snow') score -= 500;
      if (score < bestScore) { bestScore = score; best = { region: r, houses: inCity }; }
    });
    if (!best) return null;
    var pick = null, pickScore = -Infinity;
    best.houses.forEach(function (o) {
      var s = (o.h || 4) * 3 - Math.hypot(o.x - best.region.x, o.z - best.region.z) * 0.6;
      if (s > pickScore) { pickScore = s; pick = o; }
    });
    return pick ? { house: pick, name: best.region.name || '' } : null;
  }

  /* ------------------------------------------------- bâtiment qui s'effondre */
  function collapseBuilding(o, push) {
    var v = api.view(), F = fx();
    o.dead = true;
    var floors = Math.max(1, Math.round((o.h || 8) / 4)), hw = o.w || 5.3, hd = o.d || hw;
    var baseY = typeof o.y === 'number' ? o.y : groundAt(o.x, o.z), cy = Math.cos(o.yaw || 0), sy = Math.sin(o.yaw || 0);
    var tint = (v && v.houseLODColors && (v.houseLODColors[o.region] || v.houseLODColors[0])) || new T.Color(0xcbb79a);
    var count = (floors + 1) * 4, mat = keep(new T.MeshStandardMaterial({ roughness: 0.92, metalness: 0.03 }));
    var mesh = new T.InstancedMesh(keep(new T.BoxGeometry(1, 1, 1)), mat, count);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = true; group.add(mesh);
    var color = new T.Color(), chunks = [];
    for (var f = 0; f <= floors; f++) for (var q = 0; q < 4; q++) {
      var roof = f === floors, qx = q & 1 ? 1 : -1, qz = q & 2 ? 1 : -1, lx = qx * hw * 0.5, lz = qz * hd * 0.5;
      var up = f / Math.max(1, floors), shove = 4 + up * 13;
      chunks.push({
        pos: new T.Vector3(o.x + lx * cy + lz * sy, roof ? baseY + floors * 4 + 0.8 : baseY + f * 4 + 2, o.z - lx * sy + lz * cy),
        vel: new T.Vector3(push.x * shove + qx * (2 + Math.random() * 5), Math.random() * 4 + up * 3, push.z * shove + qz * (2 + Math.random() * 5)),
        rot: new T.Euler(0, o.yaw || 0, 0), spin: new T.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3),
        size: new T.Vector3(hw * 0.98, roof ? 1.6 : 3.9, hd * 0.98), delay: (1 - up) * 0.08 + Math.random() * 0.18, rest: false, settle: 1
      });
      if (roof) color.setHex(q % 2 ? 0x54787b : 0x466e76); else color.copy(tint).multiplyScalar(0.78 + Math.random() * 0.26);
      mesh.setColorAt(chunks.length - 1, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    var mound = new T.Mesh(keep(new T.ConeGeometry(1, 1, 7)), keep(new T.MeshStandardMaterial({ color: 0x5b5148, roughness: 1, flatShading: true })));
    mound.position.set(o.x, baseY, o.z); mound.scale.set(hw * 1.9, 0.01, hd * 1.9); group.add(mound);
    collapse = { mesh: mesh, chunks: chunks, mound: mound, age: 0, base: baseY, x: o.x, z: o.z, hw: hw, height: floors * 4, dust: 0, dummy: new T.Object3D() };
    if (F) {
      var mid = P(o.x, baseY + floors * 2, o.z);
      F.burst(mid, { color: 0xcdbfa8, count: 50, speed: 50, size: 12, life: 1.8, gravity: 22 });
      F.smoke(P(o.x, baseY + 3, o.z), { count: 40, size: 40, life: 7, alpha: 0.62, color: 0xa79784, spread: 40, out: 50, rise: 7 });
      F.smoke(mid, { count: 24, size: 34, life: 6, alpha: 0.5, color: 0x8d7f6f, spread: 20, rise: 12 });
    }
    E.emit('bus:building', { id: o.id, city: targetCity, pos: new T.Vector3(o.x, baseY, o.z) });
  }
  function updateCollapse(dt) {
    if (!collapse) return;
    var k = collapse, F = fx(), d = k.dummy; k.age += dt;
    k.chunks.forEach(function (ch, i) {
      if (!ch.rest && k.age >= ch.delay) {
        ch.vel.y -= GRAV * dt; ch.pos.addScaledVector(ch.vel, dt);
        ch.rot.x += ch.spin.x * dt; ch.rot.y += ch.spin.y * dt; ch.rot.z += ch.spin.z * dt;
        var g = groundAt(ch.pos.x, ch.pos.z) + ch.size.y * 0.3;
        if (ch.pos.y <= g) {
          ch.pos.y = g;
          if (Math.abs(ch.vel.y) > 7) { ch.vel.y *= -0.25; ch.vel.x *= 0.5; ch.vel.z *= 0.5; ch.spin.multiplyScalar(0.4); }
          else ch.rest = true;
          if (F && Math.random() < 0.35) F.smoke(P(ch.pos.x, ch.pos.y + 1, ch.pos.z), { count: 4, size: 14, life: 2.6, alpha: 0.4, color: 0xa39482 });
        }
      }
      if (ch.rest) ch.settle = Math.max(0.55, ch.settle - dt * 0.8);
      d.position.copy(ch.pos); d.rotation.copy(ch.rot); d.scale.set(ch.size.x, ch.size.y * ch.settle, ch.size.z); d.updateMatrix(); k.mesh.setMatrixAt(i, d.matrix);
    });
    k.mesh.instanceMatrix.needsUpdate = true;
    k.mound.scale.y = 0.01 + smooth(k.age / 1.6) * Math.min(5, k.height * 0.35);
    k.dust -= dt;
    if (F && k.age < 3.2 && k.dust <= 0) {
      k.dust = 0.12;
      F.smoke(P(k.x + (Math.random() - 0.5) * k.hw * 3, k.base + 2 + Math.random() * k.height * 0.6, k.z + (Math.random() - 0.5) * k.hw * 3), { count: 6, size: 22, life: 4.5, alpha: 0.5, color: 0xa39482, spread: 18, rise: 6 });
    }
  }
  function saveBalloon() {
    balloon = busMesh && busMesh.userData ? busMesh.userData.balloon : null;
    balloonSaved = balloon ? { scale: balloon.scale.clone(), position: balloon.position.clone(), rotation: balloon.rotation.clone(), visible: balloon.visible } : null;
  }
  function restoreBalloon() {
    if (balloon && balloonSaved) {
      balloon.scale.copy(balloonSaved.scale); balloon.position.copy(balloonSaved.position);
      balloon.rotation.copy(balloonSaved.rotation); balloon.visible = balloonSaved.visible;
    }
    balloon = null; balloonSaved = null;
  }
  function updateBalloon() {
    if (!balloon || !balloonSaved || impactAt >= 0) return;
    var torn = phase === 'falling' ? tPhase : 0;
    if (phase !== 'falling') return;
    var k = smooth(torn / 1.7);
    balloon.scale.set(balloonSaved.scale.x * (1 - k * 0.62), balloonSaved.scale.y * (1 - k * 0.78), balloonSaved.scale.z * (1 - k * 0.55));
    balloon.position.y = balloonSaved.position.y - k * 2.5;
    balloon.rotation.x = Math.sin(clock * 9) * 0.25 * k; balloon.rotation.z = Math.cos(clock * 7) * 0.3 * k;
    if (torn > 2.2 && balloon.visible) {
      balloon.visible = false;
      var F = fx(); balloon.getWorldPosition(tmp);
      if (F) { F.burst(P(tmp.x, tmp.y, tmp.z), { color: 0xd8e6ee, count: 40, speed: 40, size: 9, life: 2.4, gravity: 18 }); F.burst(P(tmp.x, tmp.y, tmp.z), { color: 0x8be7df, count: 24, speed: 30, size: 6, life: 2, gravity: 14 }); }
    }
  }

  /* ------------------------------------------------------ simulation patch */
  /* Tant que w._azBusOverride existe, le bus (et tous ceux encore à bord)
   * suivent la trajectoire du crash au lieu de la route ; le joueur verrouillé
   * ne peut pas sauter (seule l'éjection forcée à l'impact le libère). */
  function installSimPatch() {
    var S = root.AZSim, W = S && S.World && S.World.prototype;
    if (!W || W._azBusPatched) return;
    W._azBusPatched = true;
    var baseStep = W.step, baseDeploy = W._deployFromBus;
    W.step = function () {
      var r = baseStep.apply(this, arguments), o = this._azBusOverride;
      if (o && this.phase === 'transport' && this.aircraft) {
        this.aircraft.x = o.x; this.aircraft.y = o.y; this.aircraft.z = o.z;
        if (typeof o.yaw === 'number') this.aircraft.yaw = o.yaw;
        for (var i = 0; i < this.players.length; i++) {
          var p = this.players[i];
          if (!p.deployed) { p.x = o.x; p.y = o.y; p.z = o.z; }
        }
      }
      return r;
    };
    W._deployFromBus = function (p, forced) {
      var o = this._azBusOverride;
      if (o && p && o.lockId != null && o.lockId === p.id && !o.release) return false;
      return baseDeploy.apply(this, arguments);
    };
  }
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('azevent-bus-hold-style')) return;
    var st = document.createElement('style'); st.id = 'azevent-bus-hold-style';
    st.textContent = 'html.azevent-bus-hold #azevent-countdown .azevent-cd-ring,html.azevent-bus-hold #azevent-countdown .azevent-cd-timer,' +
      'html.azevent-bus-hold #azevent-countdown .azevent-cd-warn,html.azevent-bus-hold #azevent-countdown .azevent-cd-mark,' +
      'html.azevent-bus-hold #azevent-countdown .azevent-cd-bar,html.azevent-bus-hold .event-v27-time{opacity:0 !important}' +
      'html.azevent-bus-hold .touch-btn[data-act="jump"]{opacity:.35;filter:grayscale(1)}';
    document.head.appendChild(st);
  }
  function setBusHud() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('azevent-bus-hold');
    var title = document.getElementById('phase-title'), detail = document.getElementById('phase-detail');
    var t = phase === 'charge' ? 'LE POINT ZÉRO VISE LE BUS' : phase === 'laser' ? 'LE BUS EST TOUCHÉ !' : phase === 'falling' ? 'LE BUS S’ÉCRASE' : 'CRASH !';
    var d = phase === 'crashed' ? 'ÉJECTION…' : phase === 'falling' && targetCity ? 'ACCROCHE-TOI · ' + targetCity.toUpperCase() : 'ACCROCHE-TOI · ÉJECTION À L’IMPACT';
    if (title) { if (title.textContent !== t) title.textContent = t; if (title.parentElement) title.parentElement.hidden = false; }
    if (detail && detail.textContent !== d) detail.textContent = d;
    var jump = document.querySelector('.touch-btn[data-act="jump"] span');
    if (jump && jump.textContent !== 'BLOQUÉ') jump.textContent = 'BLOQUÉ';
  }

  /* ---------------------------------------------------------------- phases */
  function setHold(on) {
    E.hold = !!on;
    try { document.documentElement.classList.toggle('azevent-bus-hold', !!on); } catch (e) {}
  }
  function startCrash(w, aboard) {
    var v = api.view();
    busMesh = v && v.aircraft ? v.aircraft : null;
    if (!busMesh) { phase = 'done'; return; }
    var route = root.AZSim && root.AZSim.MAP && root.AZSim.MAP.transport;
    routeVel.set(route ? route.velocityX : 28, 0, route ? route.velocityZ : -16);
    busBase.set(w.aircraft.x, w.aircraft.y, w.aircraft.z); busPos.copy(busBase); busVel.copy(routeVel);
    busRot.x = 0; busRot.y = typeof w.aircraft.yaw === 'number' ? w.aircraft.yaw : busMesh.rotation.y; busRot.z = 0; roll = 0; heading = busRot.y;
    zeroPos.copy(E.zeroPointPos || api.center);
    inBus = !!aboard; ejected = !inBus; targetHouse = null; targetCity = ''; collapse = null;
    // Le bus suit désormais la trajectoire du crash (et plus la route) ; si le
    // joueur est à bord il ne peut plus sauter et le compte à rebours attend.
    var me = api.player();
    w._azBusOverride = { x: busPos.x, y: busPos.y, z: busPos.z, yaw: busRot.y, lockId: inBus && me ? me.id : null, release: false };
    // v55 : pas de blocage — le joueur reste dans le bus librement, sans être bloqué.
    installSimPatch(); saveBalloon(); installRenderHook();
    busMesh.visible = true; busMesh.position.copy(busPos);
    var F = fx();
    if (F) F.implosion(P(zeroPos.x, zeroPos.y, zeroPos.z), { radius: 160, count: 70, color: 0x8fd6ff, life: CHARGE_DUR * 0.9, size: 6 });
    E.emit('bus:laser-charge', { pos: zeroPos.clone() });
    phase = 'charge'; tPhase = 0; knocked = false; secondary = false; impactAt = -1;
  }
  function laserOrigin() {
    dir.subVectors(busPos, zeroPos).normalize();
    return laserFrom.copy(zeroPos).addScaledVector(dir, (E.zeroPointVisR || 26) + 3);
  }
  function stepCharge(dt) {
    var k = clamp01(tPhase / CHARGE_DUR), F = fx();
    busBase.addScaledVector(routeVel, dt); busPos.copy(busBase);
    busRot.z = Math.sin(clock * 2.4) * 0.03 * k;
    chargeFx.group.visible = true; chargeFx.group.position.copy(zeroPos);
    chargeFx.core.material.opacity = 0.25 + k * 0.75; chargeFx.core.scale.setScalar(40 + k * 150 + Math.sin(clock * 34) * 10 * k);
    chargeFx.rings.forEach(function (ring, i) {
      var r = 150 * (1 - smooth(k)) + 32; ring.scale.setScalar(r); ring.rotation.z += dt * (1.5 + i) * (1 + k * 4);
      ring.material.opacity = 0.2 + k * 0.7;
    });
    laserOrigin();
    var lock = k > 0.35 ? (Math.sin(clock * 40) > -0.2 ? 0.16 : 0.03) * smooth((k - 0.35) / 0.3) : 0;
    placeBeam(laserFrom, busPos, lock, 1, 0.18);
    if (F && Math.random() < 0.8) {
      var a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 90;
      F.sparkle(P(zeroPos.x + Math.cos(a) * r, zeroPos.y + (Math.random() - 0.3) * 80, zeroPos.z + Math.sin(a) * r), { color: 0x9fdcff, count: 3, spread: 10, size: 4 });
    }
    if (tPhase >= CHARGE_DUR) {
      phase = 'laser'; tPhase = 0; beam.grow = 0;
      chargeFx.group.visible = false;
      if (F) {
        F.shockring(P(zeroPos.x, zeroPos.y, zeroPos.z), { radius: 30, reach: 260, color: 0xaee4ff, double: true });
        F.halo(P(zeroPos.x, zeroPos.y, zeroPos.z), { radius: 140, color: 0xcfeeff, dur: 0.8, anticip: 0.05 });
      }
      E.emit('bus:laser', { from: laserFrom.clone(), to: busPos.clone() });
      shake(0.35, 0.8, zeroPos);
    }
  }
  function stepLaser(dt) {
    var holding = beam.grow >= 1;
    busBase.addScaledVector(routeVel, dt * (holding ? 0.55 : 1));
    busPos.set(busBase.x + (Math.random() - 0.5) * (holding ? 1.6 : 0.3), busBase.y + (Math.random() - 0.5) * (holding ? 1.2 : 0.2), busBase.z);
    laserOrigin();
    beam.grow = Math.min(1, beam.grow + dt / 0.22);
    var fade = 1 - smooth((tPhase - (LASER_DUR - 0.35)) / 0.35);
    placeBeam(laserFrom, busPos, fade, beam.grow, 1);
    beam.source.position.copy(laserFrom); beam.source.material.opacity = 0.9 * fade; beam.source.scale.setScalar(110 + Math.sin(clock * 50) * 18);
    var hitting = beam.grow >= 1;
    beam.impact.position.copy(busPos); beam.impact.material.opacity = hitting ? 0.95 * fade : 0; beam.impact.scale.setScalar(55 + Math.sin(clock * 60) * 14);
    beam.impactHalo.position.copy(busPos); beam.impactHalo.material.opacity = hitting ? 0.5 * fade : 0;
    busRot.z = Math.sin(clock * 38) * (hitting ? 0.06 : 0.01);
    var F = fx();
    if (F && hitting) {
      F.sparkle(P(busPos.x, busPos.y, busPos.z), { color: 0xffffff, count: 4, spread: 18, size: 5 });
      if (Math.random() < 0.4) F.sparkJet(P(busPos.x, busPos.y, busPos.z), { color: 0x9fe0ff, count: 8, speed: 60, life: 0.6, size: 4 });
      var along = Math.random();
      tmp.lerpVectors(laserFrom, busPos, along);
      F.sparkle(P(tmp.x, tmp.y, tmp.z), { color: 0x7fd0ff, count: 2, spread: 14, size: 5 });
    }
    if (hitting && !beam.hitEmitted) { beam.hitEmitted = true; flash = Math.max(flash, 0.2); }
    if (tPhase >= LASER_DUR) {
      placeBeam(laserFrom, busPos, 0, 1, 1);
      beam.source.material.opacity = beam.impact.material.opacity = beam.impactHalo.material.opacity = 0;
      explodeBus();
    }
  }
  function explodeBus() {
    var F = fx(), p = P(busPos.x, busPos.y, busPos.z);
    if (F) {
      F.burst(p, { color: 0xffffff, count: 50, speed: 90, size: 12, life: 0.8 });
      F.burst(p, { color: 0xff8a2a, count: 60, speed: 70, size: 16, life: 1.5 });
      F.fire(p, { count: 40, size: 22, life: 1.6, spread: 14 });
      F.smoke(p, { count: 30, size: 34, life: 5, alpha: 0.55, color: 0x2a2624 });
      F.halo(p, { radius: 190, color: 0xffd2a0, dur: 0.9, anticip: 0.04, double: true });
    }
    spawnDebris(busPos, low ? 8 : 14, 45, 30);
    E.emit('bus:hit', { pos: busPos.clone() });
    shake(0.6, 1.1, busPos);
    flash = Math.max(flash, 0.32);
    planFall(); phase = 'falling'; tPhase = 0;
  }
  /* Trajectoire de chute : une courbe de Bézier qui part du bus, continue un
   * peu sur sa lancée puis plonge (~55°) droit dans le bâtiment visé. */
  function planFall() {
    var w = null; try { w = api.world(); } catch (e) {}
    var pick = pickCityTarget(w, busPos);
    fallFrom.copy(busPos);
    if (pick) {
      targetHouse = pick.house; targetCity = pick.name;
      var base = typeof targetHouse.y === 'number' ? targetHouse.y : groundAt(targetHouse.x, targetHouse.z);
      fallTo.set(targetHouse.x, base + Math.max(3, (targetHouse.h || 8) * 0.55), targetHouse.z);
    } else {
      var land = findLandTarget(busPos);
      fallTo.set(land.x, groundAt(land.x, land.z) + 2, land.z);
    }
    approach.set(fallTo.x - fallFrom.x, 0, fallTo.z - fallFrom.z);
    if (approach.lengthSq() < 1) approach.set(routeVel.x, 0, routeVel.z);
    approach.normalize();
    tmp.set(routeVel.x, 0, routeVel.z).normalize().add(approach).normalize();
    fallM0.copy(fallFrom).addScaledVector(tmp, 260); fallM0.y += 40;
    fallM1.copy(fallTo).addScaledVector(approach, -180); fallM1.y += 260;
    pathPos.copy(busPos); heading = busRot.y; roll = busRot.z;
    E.emit('bus:target', { city: targetCity, pos: fallTo.clone() });
  }
  function bezier(s, out) {
    var a = 1 - s, b0 = a * a * a, b1 = 3 * a * a * s, b2 = 3 * a * s * s, b3 = s * s * s;
    return out.set(
      fallFrom.x * b0 + fallM0.x * b1 + fallM1.x * b2 + fallTo.x * b3,
      fallFrom.y * b0 + fallM0.y * b1 + fallM1.y * b2 + fallTo.y * b3,
      fallFrom.z * b0 + fallM0.z * b1 + fallM1.z * b2 + fallTo.z * b3);
  }
  function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function stepFalling(dt) {
    // Accélération continue : le bus décroche puis plonge de plus en plus vite.
    var u = clamp01(tPhase / FALL_DUR), s = 0.2 * u + 0.3 * u * u + 0.5 * u * u * u;
    pathPrev.copy(pathPos); bezier(s, pathPos);
    dir.subVectors(pathPos, pathPrev);
    var horiz = Math.hypot(dir.x, dir.z), ease = Math.min(1, dt * 3);
    if (horiz > 1e-4) heading += wrapAngle(Math.atan2(-dir.x, -dir.z) - heading) * ease;
    busRot.y = heading;
    if (dt > 0) busRot.x += (Math.max(-1.2, Math.min(0.2, Math.atan2(dir.y, Math.max(horiz, 1e-4)))) - busRot.x) * Math.min(1, dt * 2.2);
    roll += dt * (0.5 + u * 2.6); busRot.z = roll + Math.sin(clock * 3.1) * 0.12;
    var wob = 0.6 + u * 1.8;
    busPos.set(pathPos.x + Math.sin(clock * 13.1) * wob, pathPos.y + Math.sin(clock * 9.7) * wob * 0.6, pathPos.z + Math.cos(clock * 11.3) * wob);
    trail.push(busPos);
    busGlow.visible = true; busGlow.position.copy(busPos); busGlow.material.opacity = 0.55 + Math.sin(clock * 22) * 0.12; busGlow.scale.setScalar(55 + Math.min(tPhase, 6) * 6);
    busLight.position.copy(busPos); busLight.intensity = 6;
    var F = fx(), heat = Math.min(1, tPhase / 3);
    timers.fire -= dt;
    if (F && timers.fire <= 0) {
      timers.fire = 0.045;
      F.fire(P(busPos.x, busPos.y, busPos.z), { count: 6 + Math.floor(heat * 6), size: 14 + heat * 9, life: 0.9, spread: 10, up: 10 });
      F.sparkle(P(busPos.x, busPos.y, busPos.z), { color: 0xffd27a, count: 3, spread: 16, size: 4 });
    }
    timers.smoke -= dt;
    if (F && timers.smoke <= 0) { timers.smoke = 0.1; F.smoke(P(busPos.x, busPos.y + 4, busPos.z), { count: 6, size: 26, life: 3.4, alpha: 0.5, color: 0x24211f }); }
    timers.debris -= dt;
    if (timers.debris <= 0) { timers.debris = 0.55; spawnDebris(busPos, 1, 18, 6); }
    if (u >= 1) crashBus(true);
    else if (busPos.y <= groundAt(busPos.x, busPos.z) + 3) crashBus(!!targetHouse && Math.hypot(busPos.x - fallTo.x, busPos.z - fallTo.z) < 40);
  }
  function crashBus(hitBuilding) {
    var house = hitBuilding ? targetHouse : null;
    var x = house ? house.x : busPos.x, z = house ? house.z : busPos.z;
    var y = house && typeof house.y === 'number' ? Math.max(SEA + 0.4, house.y) : groundAt(x, z);
    crash.set(x, y, z); impactAt = clock;
    if (house) collapseBuilding(house, approach);
    var F = fx(), p = P(x, y + 4, z);
    if (F) {
      F.burst(p, { color: 0xffffff, count: 70, speed: 120, size: 16, life: 0.9 });
      F.burst(p, { color: 0xff7722, count: 90, speed: 95, size: 20, life: 1.8 });
      F.fire(P(x, y + 2, z), { count: 60, size: 30, life: 2.6, spread: 28, up: 60 });
      F.smoke(P(x, y + 10, z), { count: 50, size: 44, life: 7, alpha: 0.6, color: 0x3a332e, spread: 50 });
      F.smoke(P(x, y + 4, z), { count: 40, size: 30, life: 5, alpha: 0.45, color: 0x9b8a76, spread: 90, out: 70, rise: 6 });
      F.shockring(P(x, y + 2, z), { radius: 20, reach: 420, color: 0xffc58a, double: true });
      F.embers(P(x, y + 3, z), { count: 80, radius: 30, speed: 70, life: 3.5, color: 0xffa040, size: 5 });
      F.halo(P(x, y + 24, z), { radius: 260, color: 0xffd7a8, dur: 1.1, anticip: 0.02, double: true });
    }
    spawnDebris(crash, low ? 14 : 28, 70, 48);
    shock.age = 0; knocked = false;
    crater = makeCrater(house ? 52 : 70);
    E.emit('bus:crash', { pos: crash.clone(), city: targetCity, building: !!house, aboard: inBus && !ejected });
    E.emit('shockwave:burst', { pos: crash.clone(), opts: { radius: 760, duration: 3.6, color: 0xffd2a8 } });
    shake(1.0, 2.0, crash);
    var pd = playerDistance();
    flash = Math.max(flash, inBus && !ejected ? 0.5 : pd < 900 ? 0.62 * (1 - pd / 1200) + 0.18 : 0.16);
    // L'épave finit plantée dans les gravats, nez vers le sol, couchée sur le flanc.
    busPos.set(x - approach.x * 2.5, y + 2.6, z - approach.z * 2.5);
    busRot.y = heading; busRot.x = -0.42; busRot.z = 1.05;
    // Garder le passager à bord jusqu'à la fin du délai après l'impact.
    if (!inBus || ejected) releaseOverride();
    if (balloon) balloon.visible = false;
    busGlow.visible = false; busLight.intensity = 8;
    phase = 'crashed'; tPhase = 0;
  }
  function releaseOverride() {
    try { var w = api.world(); if (w) delete w._azBusOverride; } catch (e) {}
  }
  /* L'éjection n'a lieu qu'une fois le bus au sol : le joueur est projeté
   * hors de l'épave (côté d'où le bus arrivait). Le minuteur continue. */
  function ejectPlayer() {
    ejected = true;
    var w = null; try { w = api.world(); } catch (e) {}
    var p = api.player(), o = w && w._azBusOverride, F = fx();
    if (o) o.release = true;
    // Assez loin pour que la caméra ne finisse pas dans la colonne de fumée.
    var bx = busPos.x - approach.x * 26, bz = busPos.z - approach.z * 26, g = groundAt(bx, bz);
    if (w && p && !p.deployed && typeof w._deployFromBus === 'function') {
      if (w.aircraft) { w.aircraft.x = bx; w.aircraft.y = g + 5; w.aircraft.z = bz; }
      w._deployFromBus(p, true);
    }
    releaseOverride();
    if (p) {
      p.x = bx; p.z = bz; p.y = g + 5; p._lastX = p.x; p._lastZ = p.z;
      p.airborneFromBus = false; p.autoGlider = false; p.falling = false; p.gliding = false;
      p.grounded = false; p.jumping = true; p._jumpTime = 0; p._vy = 12;
      p._vx = -approach.x * 10; p._vz = -approach.z * 10;
      p.yaw = Math.atan2(-approach.x, -approach.z);
      if (root.AZUR && typeof root.AZUR.yaw === 'number') root.AZUR.yaw = p.yaw;
    }
    setHold(false);
    if (F) {
      F.burst(P(bx, g + 4, bz), { color: 0xffd9a0, count: 26, speed: 34, size: 7, life: 0.9, gravity: 20 });
      F.smoke(P(bx, g + 3, bz), { count: 14, size: 18, life: 2.6, alpha: 0.5, color: 0x3a332e, spread: 8, rise: 8 });
    }
    E.emit('bus:eject', { pos: new T.Vector3(bx, g + 5, bz) });
    shake(0.35, 0.6, busPos);
  }
  function stepCrashed(dt) {
    if (inBus && !ejected && tPhase >= EJECT_DELAY) ejectPlayer();
    var F = fx(), bx = busPos.x, by = busPos.y, bz = busPos.z;
    if (!secondary && tPhase >= 1.25) {
      secondary = true;
      if (F) {
        F.burst(P(bx, by + 6, bz), { color: 0xff5522, count: 60, speed: 75, size: 18, life: 1.4 });
        F.fire(P(bx, by + 3, bz), { count: 30, size: 24, life: 2.2, up: 70 });
        F.shockring(P(bx, by + 2, bz), { radius: 10, reach: 160, color: 0xffaa44 });
        F.smoke(P(bx, by + 30, bz), { count: 30, size: 60, life: 9, alpha: 0.55, color: 0x2e2926, rise: 28 });
      }
      spawnDebris(busPos, 6, 40, 40);
      E.emit('bus:secondary', { pos: busPos.clone() });
      shake(0.55, 0.9, busPos);
    }
    if (tPhase < 6 && F && Math.random() < dt * 8) F.smoke(P(bx, by + 30 + tPhase * 22, bz), { count: 5, size: 50 + tPhase * 8, life: 7, alpha: 0.42, color: 0x35302c, rise: 22, spread: 20 + tPhase * 6 });
    timers.wreck -= dt;
    if (F && timers.wreck <= 0) {
      timers.wreck = 0.12;
      F.smoke(P(bx, by + 8, bz), { count: 4, size: 26, life: 5.5, alpha: 0.4, color: 0x2b2725, rise: 18 });
      if (tPhase < WRECK_SMOKE_DUR * 0.6) F.fire(P(bx + (Math.random() - 0.5) * 10, by + 2, bz + (Math.random() - 0.5) * 10), { count: 4, size: 12, life: 1.1, up: 30 });
    }
    busLight.position.set(bx, by + 6, bz); busLight.intensity = 3 + Math.sin(clock * 11) * 0.8 + Math.sin(clock * 23) * 0.5;
    if (crater) { crater.mat.uniforms.heat.value = Math.max(0.05, Math.exp(-tPhase * 0.05)); crater.mat.uniforms.time.value = clock; }
  }

  function build() {
    group = new T.Group(); group.name = 'v47-bus-crash'; api.scene().add(group);
    glowTex = radialTexture(); beam = makeBeam(); chargeFx = makeCharge(); shock = makeShock(); debris = makeDebris(); trail = makeTrail();
    busGlow = glowSprite(0xff7a2a, 60, 0); busGlow.visible = false; group.add(busGlow);
    busLight = new T.PointLight(0xff7a33, 0, 260, 2); group.add(busLight);
    injectStyle();
  }
  function teardown() {
    if (renderRenderer) {
      if (renderRenderer.render === renderWrapper) renderRenderer.render = renderPrevious;
      delete renderRenderer._azBusCrashHook;
    }
    renderRenderer = renderPrevious = renderWrapper = null;
    restoreBalloon();
    if (group && group.parent) group.parent.remove(group);
    resources.forEach(function (r) { if (r && r.dispose) r.dispose(); }); resources = [];
    group = beam = chargeFx = shock = crater = debris = trail = busGlow = busLight = collapse = null;
  }

  E.register('buscrash', {
    init: function (a) {
      api = a; low = !!(a.isMobile || a.quality === 'low'); teardown(); build();
      phase = 'idle'; tPhase = 0; clock = 0; busMesh = null; flash = 0; impactAt = -1; lastWorldPhase = ''; knocked = false; secondary = false;
      timers = { fire: 0, smoke: 0, debris: 0, spark: 0, wreck: 0 };
      busRot.x = busRot.y = busRot.z = 0; inBus = false; ejected = true; targetHouse = null; targetCity = ''; collapse = null;
      setHold(false); installSimPatch();
      try { var w = api.world(); if (w && w.phase === 'active') lastWorldPhase = 'transport'; } catch (e) {}
    },
    preUpdate: function () {
      if (flash > 0.001) E.screenFlash = Math.max(E.screenFlash || 0, flash);
    },
    update: function (dt) {
      if (!api || !group) return;
      var w = null; try { w = api.world(); } catch (e) { return; }
      if (!w || w.eventVariant === 'flight') return;
      clock += dt; flash *= Math.exp(-dt * 3.6);
      var wp = w.phase || '', me = api.player();
      if (phase === 'idle') {
        // v48 : le Point Zéro abat le bus EN PLEIN TRAJET (pas à la fin).
        if (wp === 'transport' && w.phaseTime >= BUS_CRASH_AT) startCrash(w, !!(me && !me.deployed));
        else if (lastWorldPhase === 'transport' && wp === 'active') startCrash(w, false);
      }
      lastWorldPhase = wp;
      if (phase !== 'idle') {
        tPhase += dt;
        if (inBus && !ejected && me && me.deployed) { ejected = true; setHold(false); releaseOverride(); }
        if (phase === 'charge') stepCharge(dt);
        else if (phase === 'laser') stepLaser(dt);
        else if (phase === 'falling') stepFalling(dt);
        else if (phase === 'crashed') stepCrashed(dt);
        var o = w._azBusOverride;
        if (o && !o.release) { o.x = busPos.x; o.y = busPos.y; o.z = busPos.z; o.yaw = heading || busRot.y; }
        if (inBus && !ejected) setBusHud();
        updateBalloon(); updateShock(dt); updateDebris(dt); updateCollapse(dt); trail.update();
      }
      E.busCrash = { phase: phase, t: tPhase, bus: busPos.clone(), crash: impactAt >= 0 ? crash.clone() : null, shockAge: shock ? shock.age : -1,
        knocked: knocked, aboard: inBus && !ejected, ejected: ejected, city: targetCity, building: targetHouse ? targetHouse.id : null };
    },
    dispose: function () {
      setHold(false); releaseOverride();
      teardown(); phase = 'idle'; busMesh = null; api = null; E.busCrash = null;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
