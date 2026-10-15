/* AZUR v47 — finition hors cinématique.
   Personnage : étirement au décollage, atterrissage proportionnel à la chute,
   inclinaison dans les virages, roulis en chute libre/planeur, poussière.
   Constructions : balayage holographique bleu à la pose et à l'édition,
   fissures progressives selon les PV, éclatement en morceaux physiques.
   Battle Bus : flammes de réacteurs, traînée de condensation, faisceaux de
   phares, stroboscope du ballon.
   Carte : papillons et pollen autour du joueur (masqués pendant l'event). */
(function (root) {
  'use strict';
  var T = root.THREE, S = root.AZSim, A = root.AZArt, View = root.AZView && root.AZView.View;
  if (!T || !S || !View) return;
  var V = View.prototype;
  var reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function finite(v, d) { return typeof v === 'number' && isFinite(v) ? v : (d || 0); }
  function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
  function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function eventActive() { var E = root.AZEvent; return !!(E && E.active); }
  function mobile() { return !!(A && A.fx && A.fx.mobile); }

  /* ------------------------------------------------------------ personnage */
  var prevAnimate = V.animateAvatar;
  var dustAt = new T.Vector3();
  V.animateAvatar = function (m, p, dt, options) {
    options = options || {};
    prevAnimate.call(this, m, p, dt, options);
    var u = m && m.userData;
    if (!u || !u.torso || !u.limbs || !u.knees || !p || options.menu) return;
    dt = clamp(finite(dt), 0, 0.1);
    var st = u.v47;
    if (!st) st = u.v47 = { air: false, peak: finite(p.y), land: 0, power: 0, yaw: finite(p.yaw), lean: 0, bank: 0, rise: 0 };
    var air = !!(p.jumping || p.falling || p.gliding || p.flying), y = finite(p.y);
    if (air) st.peak = st.air ? Math.max(st.peak, y) : y;
    if (st.air && !air && !p.swimming && !p.downed) {
      var drop = st.peak - y;
      if (drop > 1.2) {
        st.land = 1; st.power = clamp((drop - 1.2) / 6, 0.2, 1);
        if (drop > 2.5 && options.local && A && A.fx && A.fx.spawnBuildPuff && this.scene) A.fx.spawnBuildPuff(this.scene, dustAt.set(finite(p.x), y, finite(p.z)));
      }
    }
    st.air = air;
    st.land = Math.max(0, st.land - dt * 3.2);
    var vy = finite(p._vy), rising = p.jumping && vy > 0 ? clamp(vy / 8, 0, 1) : 0;
    st.rise += (rising - st.rise) * damp(16, dt);
    var yaw = finite(p.yaw), yawRate = dt > 0 ? wrapAngle(yaw - st.yaw) / dt : 0; st.yaw = yaw;
    var grounded = !air && !p.swimming;
    st.lean += ((grounded ? clamp(yawRate * 0.03, -0.14, 0.14) * clamp(finite(u.walk), 0, 1.4) : 0) - st.lean) * damp(8, dt);
    st.bank += (((p.gliding || p.falling) ? clamp(yawRate * 0.16, -0.5, 0.5) : 0) - st.bank) * damp(4, dt);
    if (p.emote || p.downed) return;

    // Grosse réception : écrasement supplémentaire proportionnel à la hauteur.
    var k = st.land, s = k * k * (3 - 2 * k) * st.power;
    if (s > 0.001) {
      u.limbs[0].rotation.x += 0.26 * s; u.limbs[2].rotation.x += 0.26 * s;
      u.knees[0].rotation.x -= 0.5 * s; u.knees[1].rotation.x -= 0.5 * s;
      u.torso.position.y -= 0.12 * s; u.torso.rotation.x += 0.16 * s;
      u.limbs[1].rotation.z -= 0.32 * s; u.limbs[3].rotation.z += 0.32 * s;
      m.scale.y *= 1 - 0.09 * s; m.scale.x *= 1 + 0.045 * s; m.scale.z *= 1 + 0.045 * s;
    }
    // Décollage : le corps s'étire et un bras monte, comme une impulsion.
    if (st.rise > 0.01) {
      m.scale.y *= 1 + 0.06 * st.rise; m.scale.x *= 1 - 0.025 * st.rise; m.scale.z *= 1 - 0.025 * st.rise;
      u.limbs[3].rotation.x -= 0.55 * st.rise;
    }
    u.torso.rotation.z += st.lean;
    u.head.rotation.z -= st.lean * 0.4;
    m.rotation.z += st.bank;
  };

  /* --------------------------------------------------------- constructions */
  var HOLO_TIME = 0.75;
  var buildState = new Map();
  var overlayTemplate = null;
  function overlayMaterial(yMin, yMax) {
    if (!overlayTemplate) overlayTemplate = new T.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uProgress: { value: 0 }, uDamage: { value: 0 }, uTime: { value: 0 }, uYMin: { value: 0 }, uYMax: { value: 3 }, uTint: { value: new T.Color('#5fd4ff') } },
      vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'uniform float uProgress,uDamage,uTime,uYMin,uYMax;uniform vec3 uTint;varying vec3 vP;',
        'vec3 h3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}',
        'float edges(vec3 p){vec3 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(float(x),float(y),float(z));vec3 r=g+h3(i+g)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(d2)-sqrt(d1);}',
        'float line(float v){return 1.-smoothstep(.015,.06,abs(fract(v+.5)-.5));}',
        'void main(){',
        ' float h=clamp((vP.y-uYMin)/max(.001,uYMax-uYMin),0.,1.);',
        ' float building=1.-uProgress;float front=uProgress*1.2-.1;',
        ' float scan=exp(-abs(h-front)*26.)*building;',
        ' float above=step(front,h)*building;',
        ' float grid=max(max(line(vP.x*.75),line(vP.y)),line(vP.z*.75));',
        ' float holo=clamp(scan*1.5+above*(.22+grid*.6)+building*.12,0.,1.);',
        ' float c=edges(vP*1.7+vec3(3.1,1.3,7.7));',
        ' float crack=(1.-smoothstep(.02,.05+uDamage*.07,c))*smoothstep(.1,.75,uDamage+fract(sin(dot(floor(vP*1.7),vec3(12.9,78.2,37.7)))*437.5)*.35-.2);',
        ' vec3 col=mix(vec3(.05,.035,.03),uTint*1.5+.25,clamp(holo*2.,0.,1.));',
        ' float a=max(holo,crack*.9+uDamage*.16);',
        ' if(a<.004)discard;gl_FragColor=vec4(col,a);}'
      ].join('\n')
    });
    var mat = overlayTemplate.clone();
    mat.uniforms.uYMin.value = yMin; mat.uniforms.uYMax.value = yMax;
    return mat;
  }
  function attachOverlay(m) {
    var geo = m.geometry; if (!geo) return null;
    if (!geo.boundingBox) geo.computeBoundingBox();
    var bb = geo.boundingBox, o = new T.Mesh(geo, overlayMaterial(bb.min.y, bb.max.y));
    o.name = 'v47-build-overlay'; o.renderOrder = 3; o.userData.shared = false; o.castShadow = o.receiveShadow = false;
    m.add(o); return o;
  }
  function detachOverlay(m, s) { m.remove(s.overlay); s.overlay.material.dispose(); s.overlay = null; }

  var DEBRIS_MAX = 220, debris = null;
  var PALETTE = { wood: ['#c99c69', '#9b6c44', '#5d3f2d'], stone: ['#b8c0c2', '#89969c', '#5d6d73'], metal: ['#638a9d', '#38566b', '#a9e6e3'] };
  function ensureDebris(scene) {
    if (debris && debris.mesh.parent === scene) return debris;
    var mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ roughness: 0.82, metalness: 0.1 }), DEBRIS_MAX);
    mesh.name = 'v47-build-debris'; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = true; mesh.count = 0;
    var color = new T.Color(); for (var i = 0; i < DEBRIS_MAX; i++) mesh.setColorAt(i, color.set('#ffffff'));
    scene.add(mesh);
    var items = []; for (var j = 0; j < DEBRIS_MAX; j++) items.push({ life: 0, max: 1, p: new T.Vector3(), v: new T.Vector3(), r: new T.Euler(), w: new T.Vector3(), s: new T.Vector3() });
    debris = { mesh: mesh, items: items, next: 0, dummy: new T.Object3D(), color: color };
    return debris;
  }
  function localPoint(b, out) {
    var x = (Math.random() - 0.5) * 3.8, y = 0, z = 0;
    if (b.type === 'wall') { y = Math.random() * 3; z = (Math.random() - 0.5) * 0.3; }
    else if (b.type === 'ramp') { z = (Math.random() - 0.5) * 3.8; y = 2 - z; }
    else if (b.type === 'roof') { z = (Math.random() - 0.5) * 3.8; y = 1 - Math.abs(x) * 0.5; }
    else { z = (Math.random() - 0.5) * 3.8; }
    var c = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0);
    return out.set(b.x + x * c + z * sn, b.y + y, b.z - x * sn + z * c);
  }
  function shatter(view, b) {
    if (!view.scene) return;
    var d = ensureDebris(view.scene), pal = PALETTE[b.material] || PALETTE.wood, n = mobile() ? 10 : 18;
    for (var i = 0; i < n; i++) {
      var it = d.items[d.next], idx = d.next; d.next = (d.next + 1) % DEBRIS_MAX;
      localPoint(b, it.p);
      it.v.set(it.p.x - b.x, 0, it.p.z - b.z).normalize().multiplyScalar(2 + Math.random() * 5);
      it.v.y = 3 + Math.random() * 6;
      it.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      it.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      var plank = b.material === 'wood';
      it.s.set(plank ? 0.9 + Math.random() * 0.6 : 0.35 + Math.random() * 0.45, 0.12 + Math.random() * 0.22, plank ? 0.2 + Math.random() * 0.12 : 0.3 + Math.random() * 0.35);
      it.life = it.max = 1.4 + Math.random() * 0.9;
      d.mesh.setColorAt(idx, d.color.set(pal[i % pal.length]));
    }
    if (d.mesh.instanceColor) d.mesh.instanceColor.needsUpdate = true;
  }
  function updateDebris(dt) {
    var d = debris; if (!d) return;
    var live = 0, dummy = d.dummy;
    for (var i = 0; i < DEBRIS_MAX; i++) {
      var it = d.items[i];
      if (it.life <= 0) { dummy.scale.setScalar(0.0001); dummy.position.set(0, -9999, 0); dummy.updateMatrix(); d.mesh.setMatrixAt(i, dummy.matrix); continue; }
      live++;
      it.life -= dt; it.v.y -= 22 * dt; it.p.addScaledVector(it.v, dt);
      var ground = S.heightAt(it.p.x, it.p.z) + it.s.y * 0.5;
      if (it.p.y < ground) { it.p.y = ground; it.v.y = Math.abs(it.v.y) * 0.32; it.v.x *= 0.55; it.v.z *= 0.55; it.w.multiplyScalar(0.6); }
      it.r.x += it.w.x * dt; it.r.y += it.w.y * dt; it.r.z += it.w.z * dt;
      var fade = clamp(it.life / 0.45, 0, 1);
      dummy.position.copy(it.p); dummy.rotation.copy(it.r); dummy.scale.copy(it.s).multiplyScalar(fade);
      dummy.updateMatrix(); d.mesh.setMatrixAt(i, dummy.matrix);
    }
    d.mesh.count = live ? DEBRIS_MAX : 0;
    d.mesh.instanceMatrix.needsUpdate = true;
  }
  function syncBuilds(view, w, clock) {
    if (!w || !w.builds || !view.builds) return;
    for (var i = 0; i < w.builds.length; i++) {
      var b = w.builds[i], st = buildState.get(b.id);
      if (!st) buildState.set(b.id, st = { alive: !b.dead });
      else if (st.alive && b.dead) { st.alive = false; shatter(view, b); }
      var m = view.builds.get(b.id);
      if (!m || !m.isMesh || b.dead) continue;
      var s = m.userData.v47 || (m.userData.v47 = { born: clock, overlay: null });
      var holo = reduced ? 1 : clamp((clock - s.born) / HOLO_TIME, 0, 1);
      var damage = b.maxHp > 0 ? clamp(1 - b.hp / b.maxHp, 0, 1) : 0, crack = damage > 0.12 ? damage : 0;
      var want = holo < 1 || crack > 0;
      if (want && !s.overlay) s.overlay = attachOverlay(m);
      if (!s.overlay) continue;
      if (!want) { detachOverlay(m, s); continue; }
      var un = s.overlay.material.uniforms; un.uProgress.value = holo; un.uDamage.value = crack; un.uTime.value = clock;
    }
    if (buildState.size > 600) {
      var alive = {}; for (var j = 0; j < w.builds.length; j++) alive[w.builds[j].id] = 1;
      buildState.forEach(function (_, id) { if (!alive[id]) buildState.delete(id); });
    }
  }

  /* ------------------------------------------------------------ Battle Bus */
  var bus = null;
  var PLUME_LEN = 2.6, BEAM_LEN = 7;
  function plumeMaterial() {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uTime: { value: 0 }, uLen: { value: PLUME_LEN } },
      vertexShader: 'uniform float uLen;varying float vT;varying vec3 vN;varying vec3 vV;void main(){vT=clamp(position.y/uLen,0.,1.);vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float uTime;varying float vT;varying vec3 vN;varying vec3 vV;void main(){float core=pow(abs(dot(vN,vV)),1.6);float flick=.75+.25*sin(uTime*48.+vT*22.);vec3 c=mix(vec3(1.,1.,1.),mix(vec3(.45,.9,1.),vec3(.15,.4,1.),vT),smoothstep(0.,.35,vT));float a=(1.-vT)*(1.-vT)*core*flick*1.2;gl_FragColor=vec4(c*a,a);}'
    });
  }
  function beamMaterial() {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uLen: { value: BEAM_LEN }, uOn: { value: 1 } },
      vertexShader: 'uniform float uLen;varying float vT;varying vec3 vN;varying vec3 vV;void main(){vT=clamp(-position.y/uLen,0.,1.);vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float uOn;varying float vT;varying vec3 vN;varying vec3 vV;void main(){float edge=pow(abs(dot(vN,vV)),2.);float a=pow(1.-vT,1.6)*edge*.22*uOn;gl_FragColor=vec4(vec3(1.,.96,.82)*a,a);}'
    });
  }
  function contrail(scene) {
    var N = mobile() ? 140 : 260, pos = new Float32Array(N * 3), life = new Float32Array(N);
    for (var i = 0; i < N; i++) { pos[i * 3 + 1] = -9999; life[i] = 1; }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aLife', new T.BufferAttribute(life, 1).setUsage(T.DynamicDrawUsage));
    var mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uPixel: { value: 1 } },
      vertexShader: 'attribute float aLife;uniform float uPixel;varying float vL;void main(){vL=aLife;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((5.+aLife*16.)*uPixel*420./max(1.,-mv.z),1.,160.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vL;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||vL>=1.)discard;float a=pow(1.-r,1.8)*(1.-vL)*.42;gl_FragColor=vec4(mix(vec3(.85,.97,1.),vec3(.95,.97,1.),vL),a);}'
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.name = 'v47-bus-contrail'; scene.add(pts);
    return { points: pts, pos: pos, life: life, ages: new Float32Array(N).fill(99), n: N, next: 0, timer: 0 };
  }
  function ensureBus(view) {
    var ac = view.aircraft;
    if (!ac || !ac.userData) return null;
    if (bus && bus.aircraft === ac) {
      if (bus.trail.points.parent !== view.scene) bus.trail = contrail(view.scene);
      return bus;
    }
    var ud = ac.userData, plumes = [], beams = [];
    (ud.thrusters || []).forEach(function (lamp) {
      var g = new T.ConeGeometry(0.34, PLUME_LEN, 16, 1, true); g.translate(0, PLUME_LEN / 2, 0);
      var plume = new T.Mesh(g, plumeMaterial()); plume.rotation.x = Math.PI / 2;
      plume.position.copy(lamp.position); plume.position.z += 0.1; plume.renderOrder = 4; plume.name = 'v47-bus-plume';
      ac.add(plume); plumes.push(plume);
    });
    (ud.headlights || []).forEach(function (lamp) {
      var g = new T.ConeGeometry(1.25, BEAM_LEN, 18, 1, true); g.translate(0, -BEAM_LEN / 2, 0);
      var beam = new T.Mesh(g, beamMaterial()); beam.rotation.x = Math.PI / 2 - 0.12;
      beam.position.copy(lamp.position); beam.renderOrder = 4; beam.name = 'v47-bus-beam';
      ac.add(beam); beams.push(beam);
    });
    var strobe = null;
    if (ud.balloon) {
      ac.updateMatrixWorld(true);
      var box = new T.Box3().setFromObject(ud.balloon), top = new T.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
      ud.balloon.worldToLocal(top);
      strobe = new T.Sprite(new T.SpriteMaterial({ color: 0xff3b3b, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      strobe.position.copy(top).add(new T.Vector3(0, 0.15, 0)); strobe.scale.setScalar(1.4); strobe.name = 'v47-bus-strobe';
      ud.balloon.add(strobe);
    }
    bus = { aircraft: ac, plumes: plumes, beams: beams, strobe: strobe, trail: contrail(view.scene), tmp: new T.Vector3(), back: new T.Vector3() };
    return bus;
  }
  function updateBus(view, dt, clock) {
    var b = ensureBus(view); if (!b) return;
    var ac = b.aircraft, on = !!ac.visible;
    b.plumes.forEach(function (plume, i) {
      plume.material.uniforms.uTime.value = clock;
      var s = 0.9 + Math.sin(clock * 31 + i * 2) * 0.08 + Math.sin(clock * 13 + i) * 0.06;
      plume.scale.set(1, s, 1);
    });
    if (b.strobe) {
      var beat = clock % 1.2, flash = beat < 0.07 || (beat > 0.18 && beat < 0.24);
      b.strobe.material.color.setHex(beat > 0.15 ? 0xffffff : 0xff3b3b);
      b.strobe.material.opacity = flash ? 1 : 0.06;
    }
    var tr = b.trail;
    for (var i = 0; i < tr.n; i++) {
      if (tr.ages[i] >= 99) continue;
      tr.ages[i] += dt;
      var l = tr.ages[i] / 3.2;
      if (l >= 1) { tr.ages[i] = 99; tr.life[i] = 1; tr.pos[i * 3 + 1] = -9999; continue; }
      tr.life[i] = l; tr.pos[i * 3 + 1] += dt * 0.6;
    }
    if (on && b.plumes.length) {
      tr.timer -= dt;
      while (tr.timer <= 0) {
        tr.timer += 0.03;
        var plume = b.plumes[tr.next % b.plumes.length];
        plume.getWorldPosition(b.tmp);
        b.back.set(0, 0, 1).applyQuaternion(ac.quaternion).multiplyScalar(PLUME_LEN * 2.7 * 0.8);
        b.tmp.add(b.back);
        var k = tr.next % tr.n; tr.next++;
        tr.pos[k * 3] = b.tmp.x + (Math.random() - 0.5) * 0.8; tr.pos[k * 3 + 1] = b.tmp.y + (Math.random() - 0.5) * 0.8; tr.pos[k * 3 + 2] = b.tmp.z + (Math.random() - 0.5) * 0.8;
        tr.ages[k] = 0; tr.life[k] = 0;
      }
    }
    tr.points.geometry.attributes.position.needsUpdate = true;
    tr.points.geometry.attributes.aLife.needsUpdate = true;
    tr.points.material.uniforms.uPixel.value = Math.min(2, view.renderer ? view.renderer.getPixelRatio() : 1);
  }

  /* ------------------------------------------------------------------ carte */
  var ambient = null;
  function wingTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.strokeStyle = '#2a2a2a'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(34, 22, 28, 18, -0.25, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(26, 46, 18, 13, 0.35, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#2a2a2a';
    [[46, 18, 3.5], [38, 28, 2.5], [28, 48, 2.5]].forEach(function (d) { g.beginPath(); g.arc(d[0], d[1], d[2], 0, Math.PI * 2); g.fill(); });
    var tex = new T.CanvasTexture(c); if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace; return tex;
  }
  function ensureAmbient(view) {
    if (ambient && ambient.group.parent === view.scene) return ambient;
    var group = new T.Group(); group.name = 'v47-ambient'; view.scene.add(group);
    var count = mobile() ? 10 : 22;
    var wing = new T.PlaneGeometry(0.26, 0.22); wing.translate(0.13, 0, 0); wing.rotateX(-Math.PI / 2);
    var wings = new T.InstancedMesh(wing, new T.MeshBasicMaterial({ map: wingTexture(), alphaTest: 0.5, side: T.DoubleSide }), count * 2);
    wings.instanceMatrix.setUsage(T.DynamicDrawUsage); wings.frustumCulled = false; group.add(wings);
    var palette = ['#ff9a3c', '#ffd84a', '#7fd3ff', '#ffffff', '#ff6fa8'], color = new T.Color(), flies = [];
    for (var i = 0; i < count; i++) {
      color.set(palette[i % palette.length]); wings.setColorAt(i * 2, color); wings.setColorAt(i * 2 + 1, color);
      flies.push({ ax: 0, az: 0, ay: 0, seed: Math.random() * 100, speed: 0.6 + Math.random() * 0.7, radius: 1.5 + Math.random() * 3, placed: false });
    }
    if (wings.instanceColor) wings.instanceColor.needsUpdate = true;
    var M = mobile() ? 140 : 300, pos = new Float32Array(M * 3), seeds = new Float32Array(M);
    for (var j = 0; j < M; j++) { pos[j * 3] = (Math.random() - 0.5) * 50; pos[j * 3 + 1] = Math.random() * 9; pos[j * 3 + 2] = (Math.random() - 0.5) * 50; seeds[j] = Math.random() * 100; }
    var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new T.BufferAttribute(seeds, 1));
    var pollenMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new T.Vector3() }, uGround: { value: 0 }, uPixel: { value: 1 } },
      vertexShader: 'attribute float aSeed;uniform float uTime,uGround,uPixel;uniform vec3 uCenter;varying float vA;void main(){vec3 p=position;p.x+=uTime*.7+sin(uTime*.4+aSeed)*1.5;p.z+=uTime*.35+cos(uTime*.3+aSeed*1.3)*1.5;p.x=mod(p.x-uCenter.x+25.,50.)-25.+uCenter.x;p.z=mod(p.z-uCenter.z+25.,50.)-25.+uCenter.z;p.y=uGround+mod(p.y+uTime*.25+sin(uTime+aSeed)*.3,9.);vec4 mv=modelViewMatrix*vec4(p,1.);vA=(.45+.55*sin(uTime*2.+aSeed*7.))*clamp(1.-length(p.xz-uCenter.xz)/25.,0.,1.);gl_PointSize=clamp(60.*uPixel/max(1.,-mv.z),1.,5.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=(1.-r)*vA*.5;gl_FragColor=vec4(vec3(1.,.95,.78)*a,a);}'
    });
    var pollen = new T.Points(pg, pollenMat); pollen.frustumCulled = false; group.add(pollen);
    ambient = { group: group, wings: wings, flies: flies, pollen: pollen, dummy: new T.Object3D() };
    return ambient;
  }
  function placeFly(f, p) {
    for (var tries = 0; tries < 6; tries++) {
      var a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 24, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (S.isWater(x, z)) continue;
      f.ax = x; f.az = z; f.ay = S.heightAt(x, z); f.placed = true; return;
    }
    f.placed = false;
  }
  function updateAmbient(view, w, p, clock) {
    var show = !!(p && w && w.phase !== 'transport' && view.quality !== 'low' && !eventActive());
    if (!show) { if (ambient) ambient.group.visible = false; return; }
    var am = ensureAmbient(view), px = finite(p.x), pz = finite(p.z), ground = S.heightAt(px, pz);
    am.group.visible = finite(p.y) - ground < 40;
    if (!am.group.visible) return;
    var dummy = am.dummy, wings = am.wings;
    am.flies.forEach(function (f, i) {
      if (!f.placed || Math.hypot(f.ax - px, f.az - pz) > 45) placeFly(f, p);
      var t = clock * f.speed + f.seed;
      var x = f.ax + Math.sin(t) * f.radius + Math.sin(t * 2.3) * 0.6, z = f.az + Math.cos(t * 0.8) * f.radius;
      var y = f.ay + 0.9 + Math.sin(t * 1.7) * 0.45 + Math.sin(clock * 9 + f.seed) * 0.06;
      var heading = Math.atan2(Math.cos(t) * f.radius, -Math.sin(t * 0.8) * f.radius * 0.8);
      var flap = 0.2 + Math.abs(Math.sin(clock * (14 + f.speed * 6) + f.seed)) * 1.1;
      var visible = f.placed ? 1 : 0.0001;
      dummy.position.set(x, y, z); dummy.rotation.set(0, heading, flap); dummy.scale.set(visible, visible, visible);
      dummy.updateMatrix(); wings.setMatrixAt(i * 2, dummy.matrix);
      dummy.rotation.set(0, heading, -flap); dummy.scale.set(-visible, visible, visible);
      dummy.updateMatrix(); wings.setMatrixAt(i * 2 + 1, dummy.matrix);
    });
    wings.instanceMatrix.needsUpdate = true;
    var un = am.pollen.material.uniforms;
    un.uTime.value = clock; un.uCenter.value.set(px, 0, pz); un.uGround.value = ground; un.uPixel.value = Math.min(2, view.renderer ? view.renderer.getPixelRatio() : 1);
  }

  /* ---------------------------------------------------------------- frame */
  var clock = 0, broken = false;
  function afterFrame(view, w, p, dt) {
    view._v47Done = true;
    if (broken) return;
    var step = clamp(finite(dt), 0, 0.1);
    clock += step;
    try {
      syncBuilds(view, w, clock);
      updateDebris(step);
      updateBus(view, step, clock);
      updateAmbient(view, w, p, clock);
    } catch (err) {
      broken = true;
      console.warn('[azur v47] polish layer disabled:', err);
    }
  }
  var prevUpdate = V.update;
  V.update = function (w, p, dt, opts) {
    var result = prevUpdate.apply(this, arguments);
    afterFrame(this, w, p, dt);
    return result;
  };
  // client.js binds view.update on the instance before this file loads, which
  // bypasses the prototype hook; wrap that bound function too (once per frame).
  function hookInstance() {
    var game = root.AZUR, view = game && game.view;
    if (!view || view._v47Hooked || !Object.prototype.hasOwnProperty.call(view, 'update')) return;
    var bound = view.update;
    view._v47Hooked = true;
    view.update = function (w, p, dt, opts) {
      view._v47Done = false;
      var result = bound.apply(this, arguments);
      if (!view._v47Done) afterFrame(view, w, p, dt);
      view._v47Done = false;
      return result;
    };
  }
  hookInstance();
  root.setInterval(hookInstance, 1000);
  root.AZPolish47 = { version: 47 };
})(window);
