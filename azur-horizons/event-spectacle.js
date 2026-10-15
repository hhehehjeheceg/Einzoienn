/* AZUR v68 — THE END · nouveau spectacle visuel (mêmes étapes, visuels refaits).
 *  - CIEL DE L'ÉVÉNEMENT : un dôme peint qui suit toute l'histoire — coucher de
 *    soleil doré au compte à rebours, crépuscule pendant les décollages, nuit
 *    d'orage violette avec aurores et étoiles, ciel en feu après l'impact, vide
 *    noir à la fin. Le brouillard prend la couleur de l'horizon : plus de ciel
 *    blanc délavé ni de bord d'océan visible.
 *  - ŒIL DU CYCLONE : un immense vortex de nuages tourne au-dessus du Point Zéro,
 *    éclairé de l'intérieur par les éclairs.
 *  - TRAÎNÉES DES FUSÉES : colonnes de fumée épaisses qui restent dans le ciel.
 *  - MÉTÉORITE : couronne d'énergie géante (bleue figée, orange en chute).
 *  - IMPACT : colonne de lumière jusqu'au ciel, dôme d'énergie qui balaie l'île,
 *    onde au sol, ciel qui s'embrase.
 * Tout est créé à l'init de l'événement et libéré au dispose. */
(function (root) {
  'use strict';
  var E = root.AZEvent, T = root.THREE;
  if (!E || !T) return;
  var api = null, group = null, keep = [], low = false;
  function renderer() { return api && api.renderer && api.renderer(); }
  var dome = null, vortex = null, corona = null, trails = [], blast = null;
  var hidden = [], fogSaved = null;
  var cam = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  function k(o) { keep.push(o); return o; }
  var NOISE = 'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}' +
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}' +
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}';

  /* ------------------------------------------------ palette par moment de l'histoire */
  // t, zénith, horizon, lueur, étoiles, aurores, orage
  var KEYS = [
    [0, '#2b3f8f', '#ff9a5c', '#ffcf7a', 0, 0, 0],
    [55, '#25317a', '#ff7f5a', '#ffb36b', 0, 0, .05],
    [75, '#1a1f5e', '#d65f7a', '#ff8f6b', .2, 0, .2],
    [100, '#0c0a30', '#5a2f8f', '#c77dff', .55, .2, .45],
    [125, '#03030f', '#24124f', '#8fd8ff', .9, .8, .7],
    [176, '#020210', '#1c0f45', '#8fd8ff', 1, .9, .85],
    [181, '#020208', '#120a28', '#5a6dff', .8, .2, .9],
    [195, '#07021a', '#3f1478', '#c6a4ff', .7, .3, 1],
    [250, '#07021a', '#4a1888', '#ffd0a0', .6, .2, 1],
    [256, '#3a0a06', '#ff6a1e', '#fff1c0', .1, 0, .7],
    [290, '#240505', '#c2361a', '#ff9a4a', .3, 0, .8],
    [305, '#080012', '#3a0a5a', '#b06aff', .6, 0, .9],
    [330, '#020006', '#1a0428', '#7a3aff', .8, 0, .6],
    [338, '#000000', '#050008', '#3a2a6a', 1, 0, 0]
  ];
  var cZen = new T.Color(), cHor = new T.Color(), cGlow = new T.Color(), ca = new T.Color(), cb = new T.Color();
  function palette(t, out) {
    var i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
    var a = KEYS[i], b = KEYS[i + 1], f = Math.max(0, Math.min(1, (t - a[0]) / Math.max(.001, b[0] - a[0]))); f = f * f * (3 - 2 * f);
    cZen.copy(ca.set(a[1])).lerp(cb.set(b[1]), f); cHor.copy(ca.set(a[2])).lerp(cb.set(b[2]), f); cGlow.copy(ca.set(a[3])).lerp(cb.set(b[3]), f);
    out.stars = a[4] + (b[4] - a[4]) * f; out.aurora = a[5] + (b[5] - a[5]) * f; out.storm = a[6] + (b[6] - a[6]) * f;
    return out;
  }
  var pal = {};

  /* ------------------------------------------------ dôme du ciel */
  function makeDome() {
    var mat = k(new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { zen: { value: new T.Color() }, hor: { value: new T.Color() }, glow: { value: new T.Color() }, sunDir: { value: new T.Vector3(-.42, .25, -.52).normalize() },
        stars: { value: 0 }, aurora: { value: 0 }, storm: { value: 0 }, flash: { value: 0 }, time: { value: 0 }, eye: { value: new T.Vector3(0, 1, 0) } },
      vertexShader: 'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=vec4(p.xy,p.w*.9995,p.w);}',
      fragmentShader: 'uniform vec3 zen,hor,glow,sunDir,eye;uniform float stars,aurora,storm,flash,time;varying vec3 vD;' + NOISE +
        'void main(){vec3 d=normalize(vD);float h=d.y;vec3 c=mix(hor,zen,smoothstep(-.02,.62,h));' +
        'c=mix(c,hor*.45,smoothstep(0.,-.35,h));' +
        'float sd=max(dot(d,sunDir),0.);c+=glow*(pow(sd,6.)*.35+pow(sd,90.)*1.4);' +
        'vec3 sp=d*230.;vec3 ci=floor(sp);float sh=fract(sin(dot(ci,vec3(12.9898,78.233,37.719)))*43758.5453);' +
        'float st=step(.992,sh)*smoothstep(.45,.0,length(fract(sp)-.5))*(.6+.4*sin(time*3.+sh*60.));c+=vec3(.9,.95,1.)*st*stars*smoothstep(.0,.25,h);' +
        'float ang=atan(d.z,d.x);float band=sin(ang*5.+time*.15+sin(ang*3.-time*.2)*1.5)*.5+.5;' +
        'float cur=smoothstep(.12,.32,h)*(1.-smoothstep(.42,.75,h))*pow(band,3.)*(.6+.4*n2(vec2(ang*8.,time*.3)));' +
        'c+=mix(vec3(.15,1.,.55),vec3(.3,.7,1.),band)*cur*aurora*.55;' +
        'float r=acos(clamp(dot(d,eye),-1.,1.));float sw=fbm(vec2(ang*2.+r*5.-time*.06,r*7.+time*.02));' +
        'float cl=smoothstep(.42,.78,sw)*smoothstep(-.05,.3,h);vec3 sc=mix(zen*1.6+vec3(.05),hor*1.2,.4);c=mix(c,sc+glow*.08,cl*storm*.75);' +
        'c+=vec3(.75,.8,1.)*flash*(.5+.5*cl);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
    }));
    var m = new T.Mesh(k(new T.SphereGeometry(1, 48, 24)), mat);
    m.frustumCulled = false; m.renderOrder = -1000; m.scale.setScalar(2000);
    // Toujours centré sur la caméra qui dessine (y compris les caméras de cinématique).
    m.onBeforeRender = function (r, s, camera) { camera.getWorldPosition(m.position); m.updateMatrixWorld(true); };
    return m;
  }
  /* ------------------------------------------------ œil du cyclone */
  function makeVortex() {
    var mat = k(new T.ShaderMaterial({
      transparent: true, side: T.DoubleSide, depthWrite: false, fog: false,
      uniforms: { time: { value: 0 }, amt: { value: 0 }, col: { value: new T.Color() }, glow: { value: new T.Color() }, flash: { value: 0 } },
      vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float time,amt,flash;uniform vec3 col,glow;varying vec2 vP;' + NOISE +
        'void main(){float r=length(vP)/2600.;float a=atan(vP.y,vP.x);' +
        'float sw=fbm(vec2(a*3.+log(r+.02)*4.-time*.12,r*9.+time*.03))*.7+fbm(vec2(a*6.-r*14.+time*.2,r*3.))*.3;' +
        'float dens=smoothstep(.35,.8,sw)*smoothstep(1.,.65,r)*smoothstep(.04,.14,r);' +
        'float eyeGlow=exp(-r*22.)*1.2;vec3 c=mix(col,glow,eyeGlow+sw*.25)+glow*flash*.8*dens;' +
        'float alpha=(dens*.85+eyeGlow*.5)*amt;if(alpha<.01)discard;gl_FragColor=vec4(c,alpha);}'
    }));
    var m = new T.Mesh(k(new T.CircleGeometry(2600, 96)), mat);
    m.rotation.x = Math.PI / 2; m.frustumCulled = false; m.renderOrder = -5;
    return m;
  }
  /* ------------------------------------------------ couronne de la météorite */
  function makeCorona() {
    var mat = k(new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { col: { value: new T.Color('#7fd8ff') }, time: { value: 0 }, amt: { value: 0 } },
      vertexShader: 'varying vec2 vU;void main(){vU=uv*2.-1.;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 col;uniform float time,amt;varying vec2 vU;' + NOISE +
        'void main(){float r=length(vU);float a=atan(vU.y,vU.x);float rays=pow(n2(vec2(a*6.,time*.8))*.6+n2(vec2(a*14.,-time))*.4,2.);' +
        'float g=exp(-r*4.)*1.6+smoothstep(1.,.2,r)*rays*.8+exp(-pow((r-.34)*9.,2.))*.6;gl_FragColor=vec4(col*g*amt,1.);}'
    }));
    var m = new T.Mesh(k(new T.PlaneGeometry(520, 520)), mat);
    m.frustumCulled = false; m.renderOrder = 4;
    return m;
  }
  /* ------------------------------------------------ traînées des fusées */
  // Bouffées de fumée laissées tous les quelques mètres : elles gonflent,
  // dérivent avec le vent et s'éteignent en une minute.
  var TRAIL_N = 240;
  var trailMat = null;
  function makeTrail() {
    var geo = k(new T.BufferGeometry()), pos = new Float32Array(TRAIL_N * 3), birth = new Float32Array(TRAIL_N).fill(-1e4), seed = new Float32Array(TRAIL_N);
    for (var i = 0; i < TRAIL_N; i++) seed[i] = Math.random();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('birth', new T.BufferAttribute(birth, 1).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('seed', new T.BufferAttribute(seed, 1));
    if (!trailMat) trailMat = k(new T.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { now: { value: 0 }, scale: { value: 400 }, light: { value: 1 } },
      vertexShader: 'attribute float birth;attribute float seed;uniform float now,scale;varying float vA;varying float vS;void main(){float age=now-birth;vA=age/55.;vS=seed;vec3 p=position+vec3(sin(seed*31.)*1.,1.,cos(seed*17.))*age*vec3(1.2,.5,1.2);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=age<0.||vA>1.?0.:(16.+age*2.6+seed*8.)*scale/-mv.z;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float light;varying float vA;varying float vS;void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;float soft=smoothstep(.5,.15,r);float shade=.75+.25*(c.y+.5);' +
        'vec3 col=mix(vec3(1.,.72,.35)*1.6,vec3(.86,.85,.9)*shade*light,smoothstep(0.,.03,vA));gl_FragColor=vec4(col,soft*(1.-vA)*(1.-vA)*.8);}'
    }));
    var pts = new T.Points(geo, trailMat); pts.frustumCulled = false; pts.renderOrder = 2;
    return { mesh: pts, pos: pos, birth: birth, head: 0, last: null };
  }
  function updateTrail(tr, rocket, now) {
    var g = rocket && rocket.group;
    if (!(g && g.visible && g.parent)) { tr.last = null; return; }
    g.updateWorldMatrix(true, false); tmp.setFromMatrixPosition(g.matrixWorld);
    if (tr.last && tr.last.distanceTo(tmp) < 6) return;
    if (!tr.last) tr.last = new T.Vector3();
    // Combler les trous quand la fusée va vite.
    var steps = Math.min(6, Math.max(1, Math.floor(tr.last.distanceTo(tmp) / 6))), from = tr.last.lengthSq() ? tr.last.clone() : tmp.clone();
    for (var s = 1; s <= steps; s++) {
      var i = tr.head; tr.head = (tr.head + 1) % TRAIL_N;
      tmp2.copy(from).lerp(tmp, s / steps);
      tr.pos[i * 3] = tmp2.x; tr.pos[i * 3 + 1] = tmp2.y; tr.pos[i * 3 + 2] = tmp2.z; tr.birth[i] = now - (steps - s) * .02;
    }
    tr.last.copy(tmp);
    tr.mesh.geometry.attributes.position.needsUpdate = true; tr.mesh.geometry.attributes.birth.needsUpdate = true;
  }
  /* ------------------------------------------------ impact */
  function makeBlast() {
    var pillarMat = k(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide,
      uniforms: { amt: { value: 0 }, time: { value: 0 } },
      vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float amt,time;varying vec2 vU;void main(){float core=pow(sin(vU.x*3.14159),3.);float f=(1.-vU.y*.7)*(.8+.2*sin(vU.y*40.-time*12.));gl_FragColor=vec4(vec3(.85,.95,1.)*core*f*amt*1.5,1.);}' }));
    var pillar = new T.Mesh(k(new T.CylinderGeometry(1, 1, 1, 32, 1, true)), pillarMat); pillar.frustumCulled = false;
    var domeMat = k(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide,
      uniforms: { amt: { value: 0 }, col: { value: new T.Color('#ffd9a0') } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float amt;uniform vec3 col;varying vec3 vN;varying vec3 vV;void main(){float fr=pow(1.-abs(dot(vN,vV)),2.5);gl_FragColor=vec4(col*(fr*1.4+.08)*amt,1.);}' }));
    var shell = new T.Mesh(k(new T.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)), domeMat); shell.frustumCulled = false;
    var ringMat = k(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide,
      uniforms: { amt: { value: 0 } },
      vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float amt;varying vec2 vU;void main(){float r=vU.x;float g=exp(-pow((r-.92)*14.,2.))+exp(-pow((r-.7)*6.,2.))*.25;gl_FragColor=vec4(vec3(1.,.8,.55)*g*amt,1.);}' }));
    var ringGeo = k(new T.RingGeometry(.01, 1, 96, 1)); var rp = ringGeo.attributes.position, ru = ringGeo.attributes.uv;
    for (var i = 0; i < rp.count; i++) ru.setXY(i, Math.hypot(rp.getX(i), rp.getY(i)), 0);
    var ring = new T.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.frustumCulled = false;
    var g = new T.Group(); g.add(pillar, shell, ring); g.visible = false;
    return { group: g, pillar: pillar, shell: shell, ring: ring, t: -1 };
  }
  function updateBlast(b, dt, center) {
    if (b.t < 0) { b.group.visible = false; return; }
    b.t += dt; var t = b.t; b.group.visible = true; b.group.position.copy(center);
    var p = Math.min(1, t / 1.2), fade = Math.max(0, 1 - Math.max(0, t - 5) / 6);
    b.pillar.scale.set(90 * (1 - p * .55), 3200, 90 * (1 - p * .55)); b.pillar.position.y = 1600;
    b.pillar.material.uniforms.amt.value = Math.min(1, t * 4) * fade; b.pillar.material.uniforms.time.value = t;
    var s = 1400 * (1 - Math.pow(1 - Math.min(1, t / 7), 3));
    b.shell.scale.set(s, s * .7, s); b.shell.material.uniforms.amt.value = Math.max(0, 1 - t / 9) * (t < .2 ? t * 5 : 1);
    b.shell.material.uniforms.col.value.set(t < 1.5 ? '#ffffff' : '#ffb46b');
    var rr = 1800 * Math.min(1, t / 5); b.ring.scale.setScalar(Math.max(1, rr)); b.ring.position.y = 3; b.ring.material.uniforms.amt.value = Math.max(0, 1 - t / 6);
    if (t > 12) b.t = -1;
  }

  /* ------------------------------------------------ cycle de vie */
  // Tous les anciens dômes de ciel (grandes sphères vues de l'intérieur) passent derrière le nouveau.
  var skyScan = 0;
  function findSkies(scene) {
    scene.traverse(function (o) {
      if (!o.isMesh || o === dome || !o.geometry || !o.material || o.material.side !== T.BackSide) return;
      if (hidden.some(function (h) { return h.m === o; })) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      var r = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
      if (r > 1500) hidden.push({ m: o, was: o.visible });
    });
  }
  function init(a) {
    api = a; low = a.quality === 'low';
    var scene = a.scene(); if (!scene) return;
    group = new T.Group(); group.name = 'v68-spectacle'; scene.add(group);
    dome = makeDome(); group.add(dome);
    vortex = makeVortex(); group.add(vortex);
    corona = makeCorona(); group.add(corona);
    blast = makeBlast(); group.add(blast.group);
    trails = [];
    // Les anciens dômes de ciel passent derrière le nouveau.
    var env = root.AZUR && root.AZUR.view && root.AZUR.view.environment;
    hidden = [];
    findSkies(scene);
    if (scene.fog) fogSaved = { color: scene.fog.color.clone(), density: scene.fog.density };
    if (env && env.water && env.water.scale) { env.water.userData.v68Scale = env.water.scale.x; env.water.scale.set(6, 6, 1); }
  }
  // event-sky réaffiche son ciel juste avant chaque rendu : on le recache aussitôt.
  var wrappedApply = null, originalApply = null;
  function hookApply() {
    if (!E.applyEventSky || E.applyEventSky === wrappedApply) return;
    originalApply = E.applyEventSky;
    wrappedApply = function () {
      var r = originalApply.apply(this, arguments);
      if (group) {
        for (var i = 0; i < hidden.length; i++) hidden[i].m.visible = false;
        // L'océan et les nuages suivent la lumière du ciel de l'événement.
        var env = root.AZUR && root.AZUR.view && root.AZUR.view.environment;
        if (env && env.worldV2Water) env.worldV2Water.day.value = light;
        var cl = env && env.worldV2 && env.worldV2.clouds;
        if (cl) { cl.visible = light > .25; if (!cl.userData.v68Col) cl.userData.v68Col = cl.material.color.clone(); cl.material.color.copy(cHor).lerp(cZen, .3).multiplyScalar(1.4); }
      }
      return r;
    };
    E.applyEventSky = wrappedApply;
  }
  var flash = 0, nextBolt = 0, center = new T.Vector3(), light = 1;
  function update(dt) {
    if (!group || !api) return;
    var camera = api.camera(), scene = api.scene(); if (!camera || !scene) return;
    camera.getWorldPosition(cam);
    var t = E.tTotal || 0, time = performance.now() / 1000, soft = !!E.softEffects;
    palette(t, pal);
    light = Math.max(.12, Math.min(1, (cHor.r * .3 + cHor.g * .59 + cHor.b * .11) * 1.15 + (cZen.r * .3 + cZen.g * .59 + cZen.b * .11) * .8 + flash * .25));
    if (E.zeroPointPos) center.copy(E.zeroPointPos); else center.set(0, 90, 0);
    // éclairs dans l'orage
    var stormy = pal.storm > .5 && t > 118 && t < 338;
    if (stormy && time > nextBolt) { flash = soft ? .25 : .7 + Math.random() * .3; nextBolt = time + 1.2 + Math.random() * (t > 182 ? 2 : 4.5); }
    if (blast && blast.t >= 0 && blast.t < .4) flash = Math.max(flash, 1.2);
    flash = Math.max(0, flash - dt * 3.2);
    // ciel
    var u = dome.material.uniforms;
    u.zen.value.copy(cZen); u.hor.value.copy(cHor); u.glow.value.copy(cGlow);
    u.stars.value = pal.stars; u.aurora.value = pal.aurora; u.storm.value = pal.storm; u.flash.value = flash * .35; u.time.value = time;
    tmp.subVectors(center, cam).setY(Math.max(600, center.y + 900 - cam.y)).normalize(); u.eye.value.copy(tmp);
    skyScan -= dt; if (skyScan <= 0) { skyScan = 2; findSkies(scene); hookApply(); }
    for (var hi = 0; hi < hidden.length; hi++) hidden[hi].m.visible = false;
    var black = t > 336;
    dome.visible = !black || t < 360;
    if (scene.fog) {
      scene.fog.color.copy(cHor).multiplyScalar(.75).lerp(cZen, .25);
      if (fogSaved) scene.fog.density = Math.min(fogSaved.density, .00045);
    }
    // vortex au-dessus du Point Zéro
    var vu = vortex.material.uniforms, vAmt = Math.max(0, Math.min(1, (t - 100) / 25)) * (t < 336 ? 1 : Math.max(0, 1 - (t - 336) / 3));
    vortex.visible = vAmt > .01; vortex.position.set(center.x, 1350, center.z); vortex.rotation.z = time * .03;
    vu.time.value = time; vu.amt.value = vAmt * (low ? .8 : 1); vu.col.value.copy(cZen).multiplyScalar(2.2).lerp(cHor, .35); vu.glow.value.copy(cGlow); vu.flash.value = flash;
    // couronne de la météorite
    var v = E.eventVisuals || {}, met = v.meteor && v.meteor.group;
    if (met && met.visible && met.parent) {
      met.updateWorldMatrix(true, false); corona.position.setFromMatrixPosition(met.matrixWorld);
      var falling = t > 210 && t < 256;
      corona.material.uniforms.col.value.set(falling ? '#ff8a3c' : t > 181 ? '#c69bff' : '#7fd8ff');
      corona.material.uniforms.amt.value = Math.min(1, corona.material.uniforms.amt.value + dt);
      corona.material.uniforms.time.value = time; corona.visible = true;
      var sc = falling ? 1.5 : 1; corona.scale.set(sc, sc, 1);
    } else { corona.material.uniforms.amt.value = Math.max(0, corona.material.uniforms.amt.value - dt * 2); corona.visible = corona.material.uniforms.amt.value > .01; }
    // traînées des fusées
    var rockets = v.rockets || [];
    while (trails.length < rockets.length) { var tr = makeTrail(); group.add(tr.mesh); trails.push(tr); }
    for (var i = 0; i < trails.length; i++) updateTrail(trails[i], rockets[i], t);
    if (trailMat) { trailMat.uniforms.now.value = t; trailMat.uniforms.light.value = light; trailMat.uniforms.scale.value = (renderer() ? renderer().domElement.height : 600) * .7; }
    // impact
    if (blast) { if (!blast.done && E.state === 'impact') { blast.t = 0; blast.done = true; } updateBlast(blast, dt, center); }
  }
  function dispose() {
    var envC = root.AZUR && root.AZUR.view && root.AZUR.view.environment, clc = envC && envC.worldV2 && envC.worldV2.clouds;
    if (clc && clc.userData.v68Col) { clc.material.color.copy(clc.userData.v68Col); delete clc.userData.v68Col; }
    if (wrappedApply && E.applyEventSky === wrappedApply) E.applyEventSky = originalApply; wrappedApply = originalApply = null;
    hidden.forEach(function (h) { h.m.visible = h.was; }); hidden = [];
    var scene = api && api.scene();
    if (scene && scene.fog && fogSaved) { scene.fog.color.copy(fogSaved.color); scene.fog.density = fogSaved.density; }
    var env = root.AZUR && root.AZUR.view && root.AZUR.view.environment;
    if (env && env.water && env.water.userData.v68Scale) { env.water.scale.set(env.water.userData.v68Scale, env.water.userData.v68Scale, 1); delete env.water.userData.v68Scale; }
    if (group && group.parent) group.parent.remove(group);
    keep.forEach(function (o) { try { o.dispose(); } catch (e) { /* déjà libéré */ } });
    keep = []; group = null; dome = vortex = corona = blast = null; trails = []; fogSaved = null;
  }
  E.register('spectacle', { init: init, update: update, dispose: dispose });
})(window);
