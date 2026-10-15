(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;
var api, group, ground, halo, light, streaks, positions, colors, seeds = [], resources = [], bound = false;
var meteorAt = -1, rocketAt = -1, shell, field, shards, dummy, fieldPositions, resonanceFlags = [], resonanceTimes = [];
function own(value) { resources.push(value); return value; }
function texture() {
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var ctx = c.getContext('2d'), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,.65)'); g.addColorStop(0.55, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return own(new T.CanvasTexture(c));
}
function init(a) {
  api = a; meteorAt = rocketAt = -1; seeds = []; resources = []; resonanceFlags = []; resonanceTimes = []; E.zeroResonance = 0;
  group = new T.Group(); group.name = 'v30-impact-resonance'; a.scene().add(group);
  var mat = own(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { age: { value: 0 }, alpha: { value: 0 }, strength: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: [
      'varying vec2 vUv;uniform float age;uniform float alpha;uniform float strength;',
      'void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);',
      'float front=clamp(age*.15,0.,1.25);float ripple=exp(-abs(r-front)*140.);',
      'float echo=exp(-abs(r-front*.76)*105.)*.28;float wake=exp(-abs(r-front*.87)*24.)*.12;',
      'float heat=exp(-r*r*75.)*exp(-age*.32);float rays=pow(max(0.,cos(a*19.+r*36.)),18.)*exp(-r*7.)*exp(-age*.65);',
      'vec3 c=vec3(.34,.72,1.)*(ripple+echo+wake)+vec3(1.,.44,.12)*(heat*.6+rays*.2)*strength;',
      'gl_FragColor=vec4(c,(ripple+echo+wake+heat*.32+rays*.08)*alpha*(1.-smoothstep(.96,1.,r)));}'
    ].join('\n') }));
  ground = new T.Mesh(own(new T.PlaneGeometry(2, 2)), mat); ground.rotation.x = -Math.PI / 2;
  ground.position.copy(a.center); ground.position.y += 0.8; ground.visible = false; group.add(ground);
  halo = new T.Sprite(own(new T.SpriteMaterial({ map: texture(), color: 0x9fdfff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
  halo.position.copy(E.zeroPointPos); group.add(halo);
  light = new T.PointLight(0x96dfff, 0, 950, 2); light.position.copy(E.zeroPointPos); group.add(light);
  var count = a.isMobile || a.quality === 'low' ? 28 : 64;
  positions = new Float32Array(count * 6); colors = new Float32Array(count * 6);
  var geo = own(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage)); geo.setAttribute('color', new T.BufferAttribute(colors, 3).setUsage(T.DynamicDrawUsage));
  streaks = new T.LineSegments(geo, own(new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
  streaks.frustumCulled = false; group.add(streaks);
  for (var i = 0; i < count; i++) { var angle = i * 2.399963, y = 0.15 + (i % 11) / 13, horizontal = Math.sqrt(1 - y * y); seeds.push({ x: Math.cos(angle) * horizontal, y: y, z: Math.sin(angle) * horizontal, speed: 90 + (i * 37 % 120), delay: i % 5 * 0.018 }); }
  var shellMat = own(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.FrontSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 0 }, pulse: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vView;varying vec3 vP;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;gl_Position=projectionMatrix*p;}',
    fragmentShader: 'varying vec3 vN;varying vec3 vView;varying vec3 vP;uniform float time;uniform float alpha;uniform float pulse;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vView))),3.);float bands=pow(max(0.,sin(vP.y*14.+sin(vP.x*9.+time*.6)*2.-time*1.4)),18.);vec3 c=mix(vec3(.12,.42,.85),vec3(.67,.88,1.),pulse);gl_FragColor=vec4(c,(rim*.22+bands*.055)*(1.+pulse*1.5)*alpha);}' }));
  shell = new T.Mesh(own(new T.SphereGeometry(1, a.isMobile ? 20 : 32, 18)), shellMat); shell.visible = false; group.add(shell);
  var streams = a.isMobile || a.quality === 'low' ? 14 : 32;
  fieldPositions = new Float32Array(streams * 6 * 6); var fieldGeo = own(new T.BufferGeometry()); fieldGeo.setAttribute('position', new T.BufferAttribute(fieldPositions, 3).setUsage(T.DynamicDrawUsage));
  field = new T.LineSegments(fieldGeo, own(new T.LineBasicMaterial({ color: 0x7fcfff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }))); field.frustumCulled = false; group.add(field);
  shards = new T.InstancedMesh(own(new T.OctahedronGeometry(1)), own(new T.MeshStandardMaterial({ color: 0x6a9ebc, emissive: 0x237ec3, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.38, transparent: true, opacity: 0 })), streams);
  shards.name = 'v31-levitating-residue'; shards.instanceMatrix.setUsage(T.DynamicDrawUsage); shards.frustumCulled = false; group.add(shards); dummy = new T.Object3D();
  if (!bound) {
    bound = true;
    E.on('rocket:zeroshock', function () { if (api && E.active) rocketAt = E.tTotal; });
    E.on('meteor:hit', function () {
      if (!api || !E.active) return;
      meteorAt = E.tTotal; var span = E.TIMELINE.impact[1] - meteorAt;
      resonanceTimes = [0.18, 0.39, 0.63, 0.84].map(function (p) { return p * span; }); resonanceFlags = [];
    });
  }
}
function update() {
  if (!api || !E.active) return;
  var major = meteorAt >= 0, age = major ? E.tTotal - meteorAt : rocketAt >= 0 ? E.tTotal - rocketAt : -1;
  var duration = major ? 8 : 4.2, strength = major ? 1 : 0.45;
  group.visible = age >= 0 && (major ? E.tTotal < E.TIMELINE.growth[0] : age < 6);
  E.zeroResonance = 0;
  if (!group.visible) return;
  var c = E.zeroPointPos || api.center;
  var pullBounds = E.TIMELINE.contraction, pull = Math.max(0, Math.min(1, (E.tTotal - pullBounds[0]) / (pullBounds[1] - pullBounds[0])));
  var fieldAlpha = major ? Math.min(1, age / 4) * (1 - pull) : 0, pulse = 0;
  if (major) resonanceTimes.forEach(function (time, index) {
    var since = age - time;
    if (since >= 0 && !resonanceFlags[index]) { resonanceFlags[index] = true; E.emit('zeropoint:resonance', { index: index, strength: 0.24 + index * 0.1, pos: c.clone() }); }
    if (since >= 0) pulse = Math.max(pulse, Math.exp(-since * 1.7) * (0.45 + index * 0.12));
  });
  E.zeroResonance = pulse * fieldAlpha;
  shell.visible = major; shell.position.copy(c); shell.scale.setScalar((60 + Math.min(160, age * 3.5) + pulse * 24) * (1 - pull * 0.90));
  shell.material.uniforms.time.value = E.tTotal; shell.material.uniforms.alpha.value = fieldAlpha; shell.material.uniforms.pulse.value = pulse;
  field.visible = shards.visible = major;
  field.material.opacity = (0.13 + pulse * 0.25) * fieldAlpha; shards.material.opacity = fieldAlpha * 0.78; shards.material.emissiveIntensity = 0.6 + pulse * 1.8;
  for (var stream = 0; stream < shards.count; stream++) {
    var phase = stream * 2.399963 + age * (0.12 + stream % 4 * 0.017), radius = (72 + stream % 8 * 16 + Math.sin(age * 0.3 + stream) * 7 + pulse * 12) * (1 - pull * 0.9);
    var elevation = Math.sin(stream * 1.71) * (25 + stream % 4 * 8);
    for (var segment = 0; segment < 6; segment++) for (var end = 0; end < 2; end++) {
      var fraction = (segment + end) / 6, angle = phase - fraction * (0.75 + pull * 2), r = radius * (1 - fraction * 0.28), offset = (stream * 6 + segment) * 6 + end * 3;
      fieldPositions[offset] = c.x + Math.cos(angle) * r; fieldPositions[offset + 1] = c.y + elevation * (1 - fraction) * (1 - pull) + Math.sin(angle * 2) * 7;
      fieldPositions[offset + 2] = c.z + Math.sin(angle) * r;
    }
    dummy.position.set(c.x + Math.cos(phase) * radius, c.y + elevation * (1 - pull), c.z + Math.sin(phase) * radius);
    dummy.rotation.set(stream + age * 0.2, phase, age * 0.11); var scale = (2 + stream % 4) * (1 - pull * 0.8); dummy.scale.set(scale * 0.5, scale * 1.4, scale * 0.3); dummy.updateMatrix(); shards.setMatrixAt(stream, dummy.matrix);
  }
  field.geometry.attributes.position.needsUpdate = true; shards.instanceMatrix.needsUpdate = true;
  halo.position.copy(c); light.position.copy(c);
  var ignition = Math.exp(-age * (major ? 1.8 : 3.2));
  halo.scale.setScalar((major ? 180 : 90) + age * (major ? 160 : 70)); halo.material.opacity = ignition * 0.62 * strength;
  light.intensity = ignition * (major ? 16 : 9) + pulse * fieldAlpha * 3;
  if (major && age > 8) { halo.scale.setScalar(130 + pulse * 75); halo.material.opacity = (0.035 + pulse * 0.12) * fieldAlpha; }
  ground.visible = age < duration; ground.scale.setScalar(major ? 950 : 620);
  ground.material.uniforms.age.value = age; ground.material.uniforms.alpha.value = Math.pow(Math.max(0, 1 - age / duration), 1.5) * strength;
  ground.material.uniforms.strength.value = strength;
  streaks.visible = age < 5.5; streaks.material.opacity = Math.pow(Math.max(0, 1 - age / 5.5), 1.6) * strength;
  for (var i = 0; i < seeds.length; i++) {
    var s = seeds[i], t = Math.max(0, age - s.delay), tailT = Math.max(0, t - 0.075), offset = i * 6;
    for (var end = 0; end < 2; end++) {
      var at = end ? tailT : t, distance = s.speed * strength * (1 - Math.exp(-at * 0.16)) / 0.16;
      positions[offset + end * 3] = c.x + s.x * distance; positions[offset + end * 3 + 1] = c.y + s.y * distance - at * at * 6; positions[offset + end * 3 + 2] = c.z + s.z * distance;
      var glow = end ? 0.16 : 1;
      colors[offset + end * 3] = glow; colors[offset + end * 3 + 1] = glow * (major ? 0.7 : 0.86); colors[offset + end * 3 + 2] = glow * (major ? 0.38 : 1);
    }
  }
  streaks.geometry.attributes.position.needsUpdate = streaks.geometry.attributes.color.needsUpdate = true;
}
function dispose() {
  if (api && group) api.scene().remove(group);
  resources.forEach(function (r) { r.dispose(); }); resources = []; seeds = [];
  api = group = ground = halo = light = streaks = positions = colors = shell = field = shards = dummy = fieldPositions = null; meteorAt = rocketAt = -1; resonanceFlags = []; resonanceTimes = []; E.zeroResonance = 0;
}
E.register('impactdetail', { init: init, preUpdate: update, dispose: dispose });
})(window);
