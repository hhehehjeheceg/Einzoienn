/* event-landmarks.js — THE END : la carte de l'événement.
 * Ce qui manquait au sol pour raconter la Saison X :
 *  - six BALISES DE FAILLE (tripodes à noyau d'énergie) sous les failles du
 *    ciel, chacune dans sa ZONE DE FAILLE (dôme translucide) ; elles se
 *    chargent pendant le compte à rebours puis tirent un faisceau qui ouvre
 *    leur faille quand les six fusées arrivent ;
 *  - l'ÉCRAN GÉANT du compte à rebours à côté du pas de tir ;
 *  - quatre PROJECTEURS qui balaient le ciel pendant l'attente ;
 *  - le champ de CRISTAUX et les FISSURES lumineuses autour du Point Zéro,
 *    qui s'éveillent à la frappe de la fusée et s'embrasent à l'impact ;
 *  - tout est aspiré vers le centre pendant la destruction de l'île.
 * Décor purement visuel (aucune collision), libéré au dispose(). */
(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;

var api = null, group = null, low = false, resources = [], glowTex = null, clock = 0;
var beacons = [], domes = [], screen = null, lights = [], crystals = null, crystalData = [], cracks = null, crackMat = null;
var center = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
var dummy = new T.Object3D(), strikeAt = -1, impactAt = -1, lastScreenText = '';
var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
var smooth = function (v) { v = clamp01(v); return v * v * (3 - 2 * v); };
var LATE = { contraction: 1, collapse: 1, growth: 1, destruction: 1, playersucked: 1, allgone: 1, blackhole: 1, numbers: 1, end: 1 };

function keep(r) { resources.push(r); return r; }
function ground(x, z) { try { return Math.max(-1.5, root.AZSim.heightAt(x, z)); } catch (e) { return 0; } }
function glowTexture() {
  var cv = document.createElement('canvas'); cv.width = cv.height = 64;
  var g = cv.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); return keep(new T.CanvasTexture(cv));
}
function std(color, opts) { var m = new T.MeshStandardMaterial({ color: color, roughness: 0.55, metalness: 0.45 }); if (opts) Object.assign(m, opts); return keep(m); }
function add(parent, geo, mat, x, y, z) { var m = new T.Mesh(keep(geo), mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; }
function additive(color, opacity) { return keep(new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: T.AdditiveBlending, depthWrite: false })); }

/* ------------------------------------------------------------ balises */
function beamMaterial() {
  return keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time,alpha;void main(){float core=pow(max(0.,sin(vUv.x*3.14159)),3.);float packets=pow(max(0.,sin(vUv.y*60.-time*14.)),6.);float wob=.75+.25*sin(vUv.y*9.+time*5.);vec3 c=mix(vec3(.35,.7,1.),vec3(.95,.98,1.),core*.7+packets*.3);gl_FragColor=vec4(c,(core*.8+packets*core*.6)*wob*alpha);}' }));
}
function makeBeacon(portal, index) {
  var dir = tmp.set(portal.pos.x - center.x, 0, portal.pos.z - center.z), dist = dir.length(); dir.normalize();
  var landDist = Math.min(dist * 0.78, 430), x = center.x + dir.x * landDist, z = center.z + dir.z * landDist, y = ground(x, z);
  var g = new T.Group(); g.name = 'rift-beacon-' + index; g.position.set(x, y, z); group.add(g);
  var frame = std(0x2c3a46, { roughness: 0.6 }), steel = std(0x8ea2ad, { metalness: 0.7, roughness: 0.35 }), coreMat = additive(0x9fdcff, 0.9);
  for (var l = 0; l < 3; l++) {
    var a = l / 3 * Math.PI * 2, leg = add(g, new T.CylinderGeometry(0.35, 0.55, 15, 6), frame, Math.cos(a) * 4, 6.6, Math.sin(a) * 4);
    leg.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32);
    add(g, new T.CylinderGeometry(1.1, 1.3, 0.8, 8), steel, Math.cos(a) * 6.3, 0.4, Math.sin(a) * 6.3);
  }
  add(g, new T.CylinderGeometry(1.8, 2.4, 3.2, 10), frame, 0, 13.4, 0);
  add(g, new T.ConeGeometry(1.8, 3.4, 10), steel, 0, 16.7, 0);
  add(g, new T.TorusGeometry(2.45, 0.22, 6, 20), steel, 0, 12, 0).rotation.x = Math.PI / 2;
  var core = add(g, new T.IcosahedronGeometry(1.5, 1), coreMat, 0, 20.5, 0);
  var halo = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color: 0x8fd4ff, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false })));
  halo.position.set(0, 20.5, 0); halo.scale.setScalar(14); g.add(halo);
  var rings = [];
  for (var r = 0; r < 3; r++) { var ring = add(g, new T.TorusGeometry(3 + r * 0.9, 0.12, 4, 32), additive(0xbfe8ff, 0.55), 0, 20.5, 0); rings.push(ring); }
  var lamp = add(g, new T.SphereGeometry(0.35, 8, 6), additive(0xff5a3a, 0.9), 0, 18.6, 0);
  // Faisceau balise → faille : cylindre étiré entre le noyau et le portail.
  var beam = new T.Mesh(keep(new T.CylinderGeometry(1, 1, 1, 10, 1, true)), beamMaterial()); beam.visible = false; beam.frustumCulled = false; group.add(beam);
  // Zone de faille : dôme translucide qui épouse le sol autour de la balise.
  var domeMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 0.6 } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;uniform float time,alpha;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);float h=normalize(vP).y;float base=exp(-h*14.);float scan=pow(max(0.,sin(h*40.-time*2.)),20.);float hex=pow(max(0.,sin(vP.x*.9+time*.3)*sin(vP.z*.9)),18.);gl_FragColor=vec4(mix(vec3(.3,.65,1.),vec3(.85,.95,1.),scan),(rim*.22+base*.1+scan*.06+hex*.03)*alpha);}' }));
  var dome = add(group, new T.SphereGeometry(42, low ? 24 : 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, x, y - 1, z);
  var b = { group: g, portal: portal, core: core, coreMat: coreMat, halo: halo, rings: rings, lamp: lamp, beam: beam, dome: dome, domeMat: domeMat, home: g.position.clone(), seed: index * 1.7 };
  beacons.push(b); return b;
}
function placeBeam(beam, a, b, width, alpha, time) {
  tmp.subVectors(b, a); var len = tmp.length(); beam.visible = alpha > 0.01 && len > 1; if (!beam.visible) return;
  beam.position.copy(a).add(b).multiplyScalar(0.5); beam.quaternion.setFromUnitVectors(UP, tmp.multiplyScalar(1 / len)); beam.scale.set(width, len, width);
  beam.material.uniforms.alpha.value = alpha; beam.material.uniforms.time.value = time;
}

/* ------------------------------------------------------------ écran géant */
function makeScreen() {
  var pad = E.launchPad || new T.Vector3(-180, ground(-180, 140), 140), x = pad.x + 34, z = pad.z - 26, y = ground(x, z);
  var g = new T.Group(); g.name = 'countdown-screen'; g.position.set(x, y, z); group.add(g);
  g.rotation.y = Math.atan2(center.x - x, center.z - z) + 0.35;
  var frame = std(0x1b2631), canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 224;
  var tex = keep(new T.CanvasTexture(canvas)), face = keep(new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
  add(g, new T.BoxGeometry(0.9, 20, 0.9), frame, -10, 10, 0); add(g, new T.BoxGeometry(0.9, 20, 0.9), frame, 10, 10, 0);
  add(g, new T.BoxGeometry(23, 10.6, 1.2), frame, 0, 19, 0);
  var panel = add(g, new T.PlaneGeometry(21.6, 9.4), face, 0, 19, 0.62);
  var back = add(g, new T.PlaneGeometry(21.6, 9.4), face, 0, 19, -0.62); back.rotation.y = Math.PI;
  var glow = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color: 0xff5d4a, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false }))); glow.position.set(0, 19, 1.5); glow.scale.set(34, 18, 1); g.add(glow);
  screen = { group: g, canvas: canvas, ctx: canvas.getContext('2d'), tex: tex, glow: glow, panel: panel, home: g.position.clone() };
}
function drawScreen(text, sub, color) {
  var key = text + '|' + sub + '|' + color; if (key === lastScreenText) return; lastScreenText = key;
  var c = screen.ctx; c.fillStyle = '#050a10'; c.fillRect(0, 0, 512, 224);
  c.fillStyle = 'rgba(255,255,255,.04)'; for (var y = 0; y < 224; y += 4) c.fillRect(0, y, 512, 1);
  c.strokeStyle = color; c.lineWidth = 6; c.strokeRect(8, 8, 496, 208);
  c.fillStyle = color; c.textAlign = 'center'; c.font = 'bold 112px "Barlow Condensed", Impact, sans-serif'; c.fillText(text, 256, 140);
  c.font = 'bold 26px "Barlow Condensed", sans-serif'; c.fillStyle = 'rgba(255,255,255,.75)'; c.fillText(sub, 256, 192);
  screen.tex.needsUpdate = true;
}
function updateScreen() {
  var s = E.state;
  if (s === 'countdown') { var left = Math.max(0, Math.ceil(E.TIMELINE.countdown[1] - E.tTotal)); drawScreen('T-' + String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'), 'LANCEMENT IMMINENT', left <= 10 ? '#ff4d3d' : '#ffb347'); }
  else if (s === 'firstrocket') drawScreen('DÉCOLLAGE', 'FUSÉE 01 · EN VOL', '#7fe0ff');
  else if (s === 'sixrockets' || s === 'convergence') drawScreen('7 / 7', 'FUSÉES EN VOL', '#7fe0ff');
  else if (s === 'loop' || s === 'acceleration') drawScreen('CAPTURE', 'MÉTÉORITE EN MOUVEMENT', '#ffb347');
  else if (LATE[s]) drawScreen('ERREUR', 'SIGNAL PERDU', '#ff4d3d');
  else drawScreen('ALERTE', 'POINT ZÉRO INSTABLE', '#ff4d3d');
  var blink = s === 'countdown' && E.TIMELINE.countdown[1] - E.tTotal < 10 ? 0.5 + 0.5 * Math.sin(clock * 12) : 0.6;
  screen.glow.material.opacity = 0.18 + blink * 0.2;
  screen.panel.material.color.setScalar(LATE[s] ? 0.6 + 0.4 * (Math.random() > 0.15 ? 1 : 0) : 1);
}

/* ------------------------------------------------------------ projecteurs */
function makeSearchlights() {
  var pad = E.launchPad || new T.Vector3(-180, 0, 140);
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * Math.PI * 2 + 0.4, x = pad.x + Math.cos(a) * 55, z = pad.z + Math.sin(a) * 55, y = ground(x, z);
    var base = new T.Group(); base.position.set(x, y, z); group.add(base);
    add(base, new T.CylinderGeometry(1.4, 1.8, 2, 8), std(0x26323d), 0, 1, 0);
    var head = add(base, new T.CylinderGeometry(1.3, 1.1, 2.2, 10), std(0x3b4955), 0, 3, 0);
    var coneGeo = new T.ConeGeometry(38, 600, 16, 1, true); coneGeo.translate(0, -300, 0); coneGeo.rotateX(Math.PI);
    var cone = new T.Mesh(keep(coneGeo), keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, uniforms: { alpha: { value: 0.18 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float alpha;void main(){float edge=pow(max(0.,sin(vUv.x*3.14159*2.)),.5);float fade=pow(vUv.y,1.6);gl_FragColor=vec4(.85,.93,1.,fade*alpha*(.4+.6*edge));}' })));
    cone.position.y = 3; base.add(cone);
    lights.push({ base: base, head: head, cone: cone, phase: i * 1.9, home: base.position.clone() });
  }
}

/* ------------------------------------------------------------ Point Zéro */
function makeZeroGround() {
  var count = low ? 50 : 130, geo = keep(new T.CylinderGeometry(0.5, 1, 1, 6)), mat = std(0x9fd8ff, { metalness: 0.2, roughness: 0.15, emissive: 0x2a8cff, emissiveIntensity: 0.4, transparent: true, opacity: 0.92, flatShading: true });
  crystals = new T.InstancedMesh(geo, mat, count); crystals.frustumCulled = false; group.add(crystals);
  var gy = center.y - 45;
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2, r = 55 + Math.pow(Math.random(), 0.7) * 120, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    crystalData.push({ x: x, y: ground(x, z), z: z, h: 2 + Math.random() * 7 * (1 - r / 200), w: 0.6 + Math.random() * 1.4, tx: (Math.random() - 0.5) * 0.7, tz: (Math.random() - 0.5) * 0.7, ry: Math.random() * 6, r: r });
  }
  crackMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
    uniforms: { time: { value: 0 }, power: { value: 0 }, heat: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time,power,heat;float h(float n){return fract(sin(n*91.3)*43758.5);}void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float c=0.;for(int i=0;i<14;i++){float fi=float(i);float ang=h(fi)*6.2832;float d=abs(sin(a-ang-sin(r*9.+fi)*.06*r));float len=.35+.6*h(fi+7.);c=max(c,(1.-smoothstep(.0,.012+.01*r,d*r))*step(r,len*power)*step(.07,r));}float ring=exp(-abs(r-power*.92)*40.)*power*.4;vec3 col=mix(vec3(.35,.7,1.),vec3(1.,.75,.4),heat);float pulse=.7+.3*sin(time*6.-r*12.);gl_FragColor=vec4(col*(1.+heat),(c*pulse+ring)*(1.-smoothstep(.9,1.,r)));}' }));
  cracks = add(group, new T.PlaneGeometry(420, 420), crackMat, center.x, ground(center.x, center.z) + 0.6, center.z); cracks.rotation.x = -Math.PI / 2;
}
function updateZeroGround(dt) {
  var after = strikeAt >= 0 ? E.tTotal - strikeAt : -1, afterImpact = impactAt >= 0 ? E.tTotal - impactAt : -1;
  var power = after >= 0 ? smooth(after / 3) * 0.55 : 0; if (afterImpact >= 0) power = 0.55 + smooth(afterImpact / 2) * 0.45;
  var heat = afterImpact >= 0 ? Math.exp(-afterImpact * 0.4) : 0;
  crackMat.uniforms.time.value = clock; crackMat.uniforms.power.value = power; crackMat.uniforms.heat.value = heat;
  cracks.visible = power > 0.01 && !LATE[E.state];
  var wake = after >= 0 ? 1 : 0.35, meteorNear = E.meteorPos && E.meteorVisible ? clamp01(1 - E.meteorPos.distanceTo(center) / 1200) : 0;
  crystals.material.emissiveIntensity = 0.3 + wake * 0.5 + meteorNear * 1.2 + heat * 2 + Math.sin(clock * 3) * 0.1;
  for (var i = 0; i < crystalData.length; i++) {
    var d = crystalData[i], lift = (after >= 0 ? smooth(after / 4) * (1 - d.r / 220) * 6 : 0) + meteorNear * Math.sin(clock * 2 + i) * 1.5;
    var grow = 0.5 + 0.5 * wake + meteorNear * 0.4;
    dummy.position.set(d.x, d.y + d.h * grow * 0.5 + lift, d.z); dummy.rotation.set(d.tx, d.ry + (lift > 0.1 ? clock * 0.3 : 0), d.tz); dummy.scale.set(d.w, d.h * grow, d.w);
    dummy.updateMatrix(); crystals.setMatrixAt(i, dummy.matrix);
  }
  crystals.instanceMatrix.needsUpdate = true;
}

/* ------------------------------------------------------------ cycle */
function updateBeacons(dt) {
  var s = E.state, ts = E.tState;
  var charge = s === 'countdown' ? smooth(E.tTotal / 60) : s === 'firstrocket' ? 1 : 0;
  beacons.forEach(function (b, i) {
    var open = b.portal.opening || 0, firing = s === 'sixrockets' || (s === 'firstrocket' && ts > 26) ? 1 : 0;
    var energy = Math.max(charge, open, firing * 0.8);
    var pulse = 0.5 + 0.5 * Math.sin(clock * (2 + energy * 6) + b.seed);
    b.coreMat.opacity = 0.5 + energy * 0.5; b.core.scale.setScalar(1 + energy * 0.4 + pulse * 0.15 * energy); b.core.rotation.y += dt * (0.5 + energy * 3);
    b.halo.material.opacity = 0.25 + energy * 0.6 * (0.7 + pulse * 0.3); b.halo.scale.setScalar(10 + energy * 18);
    b.rings.forEach(function (r, k) { r.rotation.x = clock * (0.6 + k * 0.4) * (1 + energy * 2) + k; r.rotation.y = clock * (0.4 + k * 0.3) * (k % 2 ? -1 : 1); r.material.opacity = 0.2 + energy * 0.6; });
    b.lamp.material.opacity = Math.sin(clock * 6 + i) > 0 ? 0.95 : 0.15;
    tmp2.copy(b.group.position); tmp2.y += 20.5;
    var beamAlpha = Math.max(firing * 0.85, open * 0.6) * (LATE[s] ? 0 : 1);
    placeBeam(b.beam, tmp2, b.portal.pos, 1.1 + energy * 0.8, beamAlpha * (0.8 + 0.2 * Math.sin(clock * 30 + i)), clock);
    b.domeMat.uniforms.time.value = clock; b.domeMat.uniforms.alpha.value = 0.35 + energy * 0.4;
  });
}
function suckAll() {
  // Destruction de l'île : chaque élément glisse puis plonge vers le centre.
  var s = E.state, span = E.TIMELINE.destruction, k = 0;
  if (s === 'destruction') k = smooth((E.tTotal - span[0]) / (span[1] - span[0]));
  else if (s === 'playersucked' || s === 'allgone' || s === 'blackhole' || s === 'numbers' || s === 'end') k = 1;
  function pull(obj, home, delay) {
    var kk = smooth((k - delay) / (1 - delay)); obj.visible = kk < 0.98;
    obj.position.lerpVectors(home, center, kk * kk); obj.position.y += Math.sin(kk * Math.PI) * 40;
    obj.scale.setScalar(Math.max(0.001, 1 - kk)); obj.rotation.z = kk * 4;
  }
  beacons.forEach(function (b, i) { pull(b.group, b.home, 0.1 + i * 0.05); b.dome.visible = k < 0.05; });
  lights.forEach(function (l, i) { pull(l.base, l.home, 0.3 + i * 0.04); });
  if (screen) pull(screen.group, screen.home, 0.2);
  if (crystals) crystals.visible = k < 0.5;
}
function updateLights() {
  var on = E.state === 'countdown' || E.state === 'firstrocket';
  lights.forEach(function (l, i) {
    l.cone.visible = on; if (!on) return;
    var yaw = Math.sin(clock * 0.21 + l.phase) * 1.2 + l.phase, tilt = 0.35 + Math.sin(clock * 0.33 + l.phase * 2) * 0.22;
    l.head.rotation.set(tilt, yaw, 0); l.cone.rotation.set(tilt, yaw, 0);
    l.cone.material.uniforms.alpha.value = E.state === 'firstrocket' ? 0.18 * (1 - smooth(E.tState / 6)) : 0.16;
  });
}

function init(a) {
  api = a; low = a.isMobile || a.quality === 'low'; resources = []; beacons = []; domes = []; lights = []; crystalData = []; strikeAt = impactAt = -1; lastScreenText = ''; clock = 0;
  center.copy(E.zeroPointPos || a.center); group = new T.Group(); group.name = 'v65-event-landmarks'; a.scene().add(group); glowTex = glowTexture();
  (E.rifts || []).filter(function (p) { return /^zone\d$/.test(p.kind); }).forEach(makeBeacon);
  makeScreen(); makeSearchlights(); makeZeroGround();
}
function update(dt) {
  if (!group || !E.active) return;
  clock = E.tTotal;
  if (strikeAt < 0 && E.coherenceSnapshot && E.coherenceSnapshot.rocketContact >= 0) strikeAt = E.coherenceSnapshot.rocketContact;
  if (impactAt < 0 && E.meteorContactTime != null) impactAt = E.meteorContactTime;
  updateBeacons(dt); updateScreen(); updateLights(); updateZeroGround(dt); suckAll();
}
function dispose() {
  if (group && group.parent) group.parent.remove(group);
  resources.forEach(function (r) { if (r && r.dispose) r.dispose(); });
  resources = []; beacons = []; lights = []; crystalData = []; group = screen = crystals = cracks = crackMat = null; api = null;
}
E.register('landmarks', { init: init, update: update, dispose: dispose });
})(window);
