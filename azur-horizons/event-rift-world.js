(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;
var api, scene, portal, portalCamera, target, skyMaterial, starsMaterial, shards;
var meteorParent, rocketParent, borrowedMeteor, borrowedRocket, transition;
var resources = new Set(), elapsed = 0, lastPortalFrame = -Infinity, exitAt = -Infinity;
var center = new T.Vector3(0, 6500, 0), position = new T.Vector3();
var forward = new T.Vector3(), cameraLook = new T.Vector3();
var exitClip = [new T.Plane(new T.Vector3(0, 0, 1), 420)];
var dummy = new T.Object3D(), rocketUp = new T.Vector3(0, 1, 0), tailAxis = new T.Vector3(0, 0, 1), savedCameraFar = null;
var ribbons = [], low = false, reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
function corridorZ(z) { return -420 + (z + 420) * 20; }
var smooth = function (v) { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
var noise = 'float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));} float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);} float fbm(vec3 p){return .57*noise(p)+.28*noise(p*2.07)+.14*noise(p*4.31);}';
function keep(value) { resources.add(value); return value; }
function mesh(parent, geometry, material) { var m = new T.Mesh(keep(geometry), keep(material)); parent.add(m); return m; }
function additive(color, opacity) { return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: T.AdditiveBlending, depthWrite: false, fog: false }); }
function buildWorld() {
  scene = new T.Scene(); scene.name = 'azur-rift-dimension'; scene.background = new T.Color(0x020616);
  scene.add(new T.HemisphereLight(0xafdfff, 0x243255, 1.8));
  var rim = new T.DirectionalLight(0x71baff, 2.2); rim.position.copy(center).add(new T.Vector3(-120, 180, -90)); scene.add(rim);
  skyMaterial = keep(new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: [
      'varying vec3 vP;uniform float time;', noise,
      /* v48 : ciel violet de la référence (nuages roses, nuit indigo) et
         gerbe de traits de lumière bleus qui jaillit de la faille de sortie (−z). */
      'void main(){vec3 d=normalize(vP);float n=fbm(d*4.+vec3(time*.012,0.,-time*.016));',
      'float fine=fbm(d*13.+n*2.);float a=atan(d.x,d.z);float seam=pow(1.-smoothstep(.008,.045,abs(fine-.48)),2.);',
      'float clouds=smoothstep(.5,.78,fbm(d*6.+vec3(-time*.02,n,time*.01)));',
      'float rr=acos(clamp(-d.z,-1.,1.));float aa=atan(d.y,d.x);',
      'float lane=floor(aa*30.);float lh=fract(sin(lane*91.7)*4375.5);',
      'float ray=pow(1.-abs(fract(aa*30.)*2.-1.),6.)*step(.35,lh)*exp(-rr*(1.1+lh*1.4))*(.55+.45*sin(rr*16.-time*(2.+lh*3.)));',
      'float core=exp(-rr*7.);',
      'vec3 c=mix(vec3(.025,.012,.075),vec3(.13,.07,.3),n);',
      'c+=vec3(.42,.2,.48)*clouds*(.35+.4*n);',
      'c+=vec3(.2,.45,1.)*seam*.16;',
      'c+=vec3(.3,.6,1.)*ray*.45+vec3(.7,.88,1.)*core*.16;',
      'gl_FragColor=vec4(c,1.);}'
    ].join('\n') }));
  var sky = mesh(scene, new T.SphereGeometry(14000, low ? 24 : 40, 24), skyMaterial); sky.position.set(0, 6500, 3700);
  var count = low ? 550 : 1350, values = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (var i = 0; i < count; i++) {
    var a = i * 2.399963, y = 1 - 2 * (i + .5) / count, h = Math.sqrt(1 - y * y), r = 800 + (i % 19) * 65;
    values[i * 3] = Math.cos(a) * h * r; values[i * 3 + 1] = y * r; values[i * 3 + 2] = Math.sin(a) * h * r; seeds[i] = i % 23;
  }
  var geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(values, 3)); geo.setAttribute('seed', new T.BufferAttribute(seeds, 1));
  starsMaterial = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: 'attribute float seed;uniform float time;uniform float pixelRatio;varying float alpha;void main(){alpha=.3+.4*sin(time*.7+seed);vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=(1.8+mod(seed,3.))*pixelRatio;gl_Position=projectionMatrix*p;}',
    fragmentShader: 'varying float alpha;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(.56,.81,1.,(1.-d)*(.5+alpha));}' }));
  var stars = new T.Points(geo, starsMaterial); stars.position.copy(center); scene.add(stars);
  shards = new T.InstancedMesh(keep(new T.IcosahedronGeometry(1, 0)), keep(new T.MeshStandardMaterial({ color: 0x7394bc, roughness: .32, metalness: .52, emissive: 0x102b55, emissiveIntensity: .75 })), low ? 28 : 60);
  shards.frustumCulled = false; scene.add(shards);
  var ribbonMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time;void main(){float pulse=pow(max(0.,sin(vUv.x*51.-time*2.)),10.);gl_FragColor=vec4(.13,.52,.95,.07+pulse*.46);}' }));
  for (var band = 0; band < 5; band++) {
    var points = [];
    for (var k = 0; k < 22; k++) { var z = corridorZ(900 - k * 100), a = band * Math.PI * 2 / 5 + k * .18; points.push(new T.Vector3(Math.cos(a) * (180 + band * 32), 6500 + Math.sin(a) * (120 + band * 25), z)); }
    var ribbon = mesh(scene, new T.TubeGeometry(new T.CatmullRomCurve3(points), low ? 90 : 170, .35 + band * .15, 4, false), ribbonMat); ribbons.push(ribbon);
  }
  target = keep(new T.WebGLRenderTarget(low ? 384 : 768, low ? 384 : 768, { minFilter: T.LinearFilter, magFilter: T.LinearFilter }));
  portalCamera = new T.PerspectiveCamera(65, 1, .5, 4500);
  portal = new T.Group(); portal.name = 'rift-window-to-zero-point'; portal.position.set(0, 6568, -420); scene.add(portal);
  /* v48 : la sortie est une DÉCHIRURE (même langage que les failles du ciel) :
     lentille aux bords cassés qui montre l'île vue d'en haut, liseré blanc,
     fissures qui bifurquent et gerbe de traits bleus. 1 unité = 220 m ;
     la lentille fait ±132 m × ±88 m — la météorite et son rider y passent. */
  var windowMaterial = { transparent: true, side: T.DoubleSide, depthWrite: false, uniforms: { view: { value: target.texture }, time: { value: 0 }, opening: { value: 0 }, approach: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: [
      'varying vec2 vUv;uniform sampler2D view;uniform float time;uniform float opening;uniform float approach;',
      'float h1(float n){return fract(sin(n*91.345+47.13)*43758.5453);}',
      'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float pl(float x){float i=floor(x);return mix(h1(i),h1(i+1.),fract(x));}',
      'float rays(float aa,float rr,float N,float sd,float reach,float t){float s=aa/6.28318*N+sd;float cell=floor(s);float a1=h2(vec2(cell,sd)),a2=h2(vec2(cell,sd+17.)),a3=h2(vec2(cell,sd+31.));',
      ' float f=abs(fract(s)-(.5+(a3-.5)*.6));float len=reach*(.22+.78*a1*a1);float st=.42+.1*a2;float k=(rr-st)/max(.001,len);',
      ' float body=smoothstep(0.,.12,k)*(1.-smoothstep(.45,1.,k));float thin=(.07+.2*a2)*(1.-.5*clamp(k,0.,1.));',
      ' return (1.-smoothstep(0.,thin,f))*body*(.6+.4*sin(rr*20.-t*4.+cell*3.7))*(.35+.65*a1);}',
      'void main(){vec2 p=(vUv-.5)*2.;float ca=cos(-.12),sa=sin(-.12);vec2 q=vec2(ca*p.x+sa*p.y,-sa*p.x+ca*p.y);',
      'float HL=mix(.045,.6,pow(opening,.55));float y0=(pl(q.x*4.2+3.)-.5)*.05+(pl(q.x*11.+5.)-.5)*.025;float dy=q.y-y0;',
      'float u=clamp(abs(q.x)/HL,0.,1.);float prof=pow(max(0.,1.-u*u),.75);float H=mix(.004,.4,opening*opening)*prof*(1.+approach*.08);',
      'float topE=H*(1.+(pl(q.x*9.+7.)-.5)*.4);float botE=H*(1.+(pl(q.x*9.+27.)-.5)*.4);',
      'float sd=dy>0.?dy-topE:-dy-botE;float inside=(1.-smoothstep(-.006,.004,sd))*(1.-step(HL,abs(q.x)));',
      'float rim=exp(-abs(sd)*80.)*(.85+.15*sin(time*31.+q.x*47.));float glow=exp(-max(sd,0.)*14.);',
      'vec2 w=vec2(sin(q.y*30.-time*2.),cos(q.x*26.+time*1.7))*.006;',
      'vec3 isl=texture2D(view,clamp(.5+p*.78+w,.01,.99)).rgb;',
      'float depth=clamp(length(vec2(q.x/HL,dy/max(.02,H))),0.,1.);',
      'vec3 c=mix(isl,vec3(.72,.9,1.),max(smoothstep(.62,1.,depth)*.55,approach*approach*approach*.55))*inside;',
      'float bc=0.;for(int i=0;i<10;i++){float fi=float(i);float r1=h1(fi*7.3+1.),r2=h1(fi*3.9+2.),r3=h1(fi*11.1+3.);',
      ' float sx=(r1-.5)*1.6*HL;float side=r2<.5?-1.:1.;float ex=sx>=0.?1.:-1.;vec2 o=vec2(sx,y0+side*mix(.004,.4,opening*opening)*pow(max(0.,1.-pow(sx/HL,2.)),.75));',
      ' float ba=(sx>=0.?0.:3.14159)+side*(.7+r3*.7)*ex;vec2 dir=vec2(cos(ba),sin(ba));vec2 v=q-o;float bl=.12+.22*r3;',
      ' float tt=dot(v,dir)/bl;float pr=dot(v,vec2(-dir.y,dir.x));float off=(pl(tt*5.+fi*5.)-.5)*.05*tt*bl*4.;',
      ' bc=max(bc,(1.-smoothstep(.0012,.006,abs(pr-off)))*smoothstep(-.02,.06,tt)*(1.-smoothstep(.75,1.,tt)));}',
      'float rr=length(q);float aa=atan(q.y,q.x);float reach=.5*(1.+approach*.5);',
      'float s1=rays(aa,rr,140.,1.,reach,time),s2=rays(aa,rr,52.,9.,reach*.8,time);',
      'c+=vec3(1.)*rim*(1.4+approach)+vec3(.55,.85,1.)*glow*(.35+approach*.4)*(1.-inside);',
      'c+=vec3(1.)*bc*1.4+vec3(.26,.55,1.)*s1+vec3(.55,.8,1.)*s2*1.1;',
      'float mask=1.-smoothstep(.85,1.,max(abs(p.x),abs(p.y)));',
      'float alpha=max(inside,clamp(rim+glow*.5*(1.-inside)+bc+s1+s2,0.,1.))*mask*opening;',
      'gl_FragColor=vec4(c,clamp(alpha,0.,1.));}'
    ].join('\n') };
  mesh(portal, new T.PlaneGeometry(440, 440), new T.ShaderMaterial(windowMaterial));
  transition = document.createElement('div'); transition.className = 'azevent-rift-transition'; transition.setAttribute('aria-hidden', 'true');
  Object.assign(transition.style, { position: 'fixed', inset: '0', zIndex: '85', pointerEvents: 'none', opacity: '0', background: 'radial-gradient(ellipse at center, #eafaff 0%, #74bffc 40%, transparent 85%)' }); document.body.appendChild(transition);
  buildDetails();
}
/* v47 — l'intérieur de la faille : tunnel hyperespace, portes de faille que la
   météorite franchit, fragments d'île en lévitation, poussière de vitesse,
   éclairs et battement lumineux. */
var detail = null;
function buildDetails() {
  var d = { gates: [], bolts: [], boltTimer: 1.2, beat: 0, lastZ: 130 };
  d.tunnelMat = keep(new T.ShaderMaterial({ side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    uniforms: { time: { value: 0 }, beat: { value: 0 }, speed: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: [
      'varying vec2 vUv;uniform float time;uniform float beat;uniform float speed;', noise,
      'void main(){float lanes=120.;float lane=floor(vUv.x*lanes);float h=hash(vec3(lane,1.7,2.3));',
      'float s=fract(vUv.y*5.+h*13.-time*(.12+h*.3)*speed);float streak=smoothstep(0.,.02,s)*(1.-smoothstep(.02,.22+h*.2,s))*step(.62,h);',
      'float across=1.-abs(fract(vUv.x*lanes)*2.-1.);streak*=smoothstep(.2,1.,across);',
      'float n=fbm(vec3(vUv.x*9.,vUv.y*18.-time*.5*speed,time*.05));float spiral=pow(max(0.,sin(vUv.x*6.28318*4.+vUv.y*40.-time*1.6*speed+n*3.)),10.);',
      'float ends=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.88,1.,vUv.y));',
      'vec3 c=vec3(.42,.78,1.)*streak*1.4+vec3(.08,.24,.6)*n*.55+vec3(.25,.55,1.)*spiral*.35+vec3(.6,.85,1.)*beat*n*.4;',
      'gl_FragColor=vec4(c*ends,1.);}'
    ].join('\n') }));
  var tunnel = mesh(scene, new T.CylinderGeometry(300, 300, 18400, low ? 32 : 64, 1, true), d.tunnelMat);
  tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 6500, 4800); tunnel.frustumCulled = false; tunnel.renderOrder = -5;
  var gateMat = function () {
    return keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, glow: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float time;uniform float glow;void main(){vec2 p=(vUv-.5)*2.;float u=abs(p.x);float jag=sin(p.x*19.)*.018+sin(p.x*47.)*.009;float height=pow(max(0.,1.-u*u),.65)*.52;float d=abs(abs(p.y-jag)-height);float lip=exp(-d*90.)*step(u,.95);float haze=exp(-d*16.)*step(u,.96)*.16;float branches=0.;for(int i=0;i<6;i++){float f=float(i);float start=-.65+f*.26;float x=p.x-start;float line=p.y-(f<3.?1.:-1.)*(.46+abs(x)*.9)-sin(x*45.+f)*.008;branches=max(branches,exp(-abs(line)*140.)*(1.-smoothstep(0.,.32,abs(x))));}float wave=.7+.3*sin(p.x*31.-time*2.);float fade=1.-smoothstep(.88,1.,max(abs(p.x),abs(p.y)));vec3 c=mix(vec3(.24,.57,1.),vec3(.8,.95,1.),lip);gl_FragColor=vec4(c,(lip*wave+haze+branches*.22)*fade*(.35+glow));}' }));
  };
  for (var g = 0; g < 6; g++) {
    var gate = new T.Group(); gate.position.set(Math.sin(g * 1.3) * 12, 6500 + Math.cos(g) * 8, corridorZ(60 - g * 95)); scene.add(gate);
    var outer = mesh(gate, new T.PlaneGeometry(360 - g * 12, 320 - g * 10), gateMat()); outer.rotation.z = g * 0.5;
    var inner = mesh(gate, new T.PlaneGeometry(320 - g * 10, 280 - g * 8), gateMat()); inner.rotation.z = -g * 0.3;
    d.gates.push({ group: gate, outer: outer, inner: inner, z: gate.position.z, glow: 0, passed: false });
  }
  var chunkCount = low ? 12 : 26;
  d.rock = new T.InstancedMesh(keep(new T.ConeGeometry(1, 1.5, 7)), keep(new T.MeshStandardMaterial({ color: 0x6a5d52, roughness: .9, flatShading: true, emissive: 0x0b1f40, emissiveIntensity: .6 })), chunkCount);
  d.turf = new T.InstancedMesh(keep(new T.CylinderGeometry(1, .96, .22, 7)), keep(new T.MeshStandardMaterial({ color: 0x5f9a4e, roughness: .8, flatShading: true, emissive: 0x0f2a1a, emissiveIntensity: .4 })), chunkCount);
  d.rock.frustumCulled = d.turf.frustumCulled = false; scene.add(d.rock); scene.add(d.turf);
  d.chunks = [];
  for (var c = 0; c < chunkCount; c++) {
    var a = c * 2.399963, r = 175 + (c * 53 % 110);
    d.chunks.push({ angle: a, radius: r, z: 700 - (c * 157 % 1500), size: 9 + (c * 37 % 26), spin: (c % 2 ? 1 : -1) * (.05 + (c % 5) * .02), tilt: (c % 7) * .09 });
  }
  var moteCount = low ? 220 : 520, motePos = new Float32Array(moteCount * 3);
  d.moteData = [];
  for (var m = 0; m < moteCount; m++) { var ma = Math.random() * Math.PI * 2, mr = 18 + Math.random() * 220; d.moteData.push({ a: ma, r: mr, z: 130 - Math.random() * 900, v: 90 + Math.random() * 160 }); }
  var moteGeo = keep(new T.BufferGeometry()); moteGeo.setAttribute('position', new T.BufferAttribute(motePos, 3).setUsage(T.DynamicDrawUsage));
  d.moteMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, uniforms: { pixel: { value: 1 } },
    vertexShader: 'uniform float pixel;varying float vFade;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vFade=clamp(1.-(-mv.z)/700.,0.,1.);gl_PointSize=clamp(900./max(1.,-mv.z),1.,9.)*pixel;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vFade;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.7,.9,1.,pow(1.-r,2.)*vFade);}' }));
  d.motes = new T.Points(moteGeo, d.moteMat); d.motes.frustumCulled = false; d.motePos = motePos; scene.add(d.motes);
  for (var b = 0; b < (low ? 3 : 6); b++) {
    var N = 14, pos = new Float32Array(N * 3), bg = keep(new T.BufferGeometry()); bg.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    var bm = keep(new T.LineBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    var line = new T.Line(bg, bm); line.frustumCulled = false; scene.add(line);
    var halo = new T.Sprite(keep(new T.SpriteMaterial({ map: E.eventVisuals && E.eventVisuals.meteor.halo.material.map, color: 0x8fd4ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }))); halo.scale.setScalar(60); scene.add(halo);
    d.bolts.push({ line: line, pos: pos, mat: bm, halo: halo, age: 9, a: new T.Vector3(), b: new T.Vector3() });
  }
  d.vortexMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: ['varying vec2 vUv;uniform float time;', noise, 'void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float n=fbm(vec3(p*3.,time*.1));float arms=pow(max(0.,sin(a*5.+r*9.-time*1.4+n*2.)),5.);float band=smoothstep(.42,.6,r)*(1.-smoothstep(.75,1.,r));gl_FragColor=vec4(vec3(.35,.72,1.)*arms*band*1.3,arms*band*.75);}'].join('\n') }));
  var vortex = mesh(portal, new T.PlaneGeometry(520, 520), d.vortexMat); vortex.position.z = -2;
  buildSanctum(d);
  var streakCount = low ? 96 : 192, streakPositions = new Float32Array(streakCount * 6), streakGeometry = keep(new T.BufferGeometry());
  streakGeometry.setAttribute('position', new T.BufferAttribute(streakPositions, 3).setUsage(T.DynamicDrawUsage));
  d.streakData = [];
  for (var s = 0; s < streakCount; s++) {
    var angle = s * 2.399963, radius = 110 + s * 47 % 165;
    d.streakData.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, offset: s * 137 % 2000, length: 35 + s * 19 % 115, speed: 520 + s * 23 % 280 });
  }
  d.streaks = new T.LineSegments(streakGeometry, keep(new T.LineBasicMaterial({ color: 0xafdfff, transparent: true, opacity: reduced ? .07 : .36, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
  d.streaks.name = 'rift-full-speed-slipstream'; d.streaks.frustumCulled = false; scene.add(d.streaks); d.streakPositions = streakPositions;
  d.wakeMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time,alpha;void main(){float fade=pow(vUv.y,1.8);float run=.55+.45*pow(max(0.,sin(vUv.y*37.+time*15.)),3.);gl_FragColor=vec4(.42,.78,1.,fade*run*alpha);}' }));
  d.rocketWake = mesh(scene, new T.ConeGeometry(3.8, 230, 10, 12, true), d.wakeMat); d.rocketWake.rotation.x = -Math.PI / 2; d.rocketWake.name = 'rift-rocket-plasma-wake'; d.rocketWake.visible = false;
  detail = d;
}
function buildSanctum(d) {
  var stone = keep(new T.MeshStandardMaterial({ color: 0x26384d, roughness: .72, metalness: .3, emissive: 0x102b55, emissiveIntensity: .5 }));
  var alloy = keep(new T.MeshStandardMaterial({ color: 0x7394bc, roughness: .36, metalness: .72 }));
  var crystal = keep(new T.MeshStandardMaterial({ color: 0xafdfff, roughness: .19, metalness: .46, emissive: 0x71baff, emissiveIntensity: .65 }));
  d.conduitMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, charge: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time,charge;void main(){float packet=pow(max(0.,cos(vUv.y*19.-time*2.4)),16.);float edge=pow(1.-abs(vUv.x*2.-1.),2.);gl_FragColor=vec4(mix(vec3(.18,.55,1.),vec3(.84,.96,1.),packet),edge*(.32+packet*.6+charge*.2));}' }));
  function batch(name, geometry, material, count) {
    var m = keep(new T.InstancedMesh(keep(geometry), material, count)); m.name = name; m.frustumCulled = false; scene.add(m); return m;
  }
  function put(m, i, x, y, z, sx, sy, sz, rz, ry) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry || 0, rz || 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
  }
  var armor = batch('rift-fractured-observatory', new T.BoxGeometry(1, 1, 1), stone, 6 * 18);
  var brackets = batch('rift-arch-brackets', new T.BoxGeometry(1, 1, 1), alloy, 6 * 18);
  var conductors = batch('rift-live-conduits', new T.BoxGeometry(1, 1, 1), d.conduitMat, 6 * 18);
  for (var g = 0; g < 6; g++) {
    for (var i = 0; i < 18; i++) {
      var a = i / 18 * Math.PI * 2 + g * .11, r = 157 - g * 6, x = Math.cos(a) * r + Math.sin(g * 1.3) * 12;
      var y = 6500 + Math.sin(a) * r + Math.cos(g) * 8, z = corridorZ(60 - g * 95), slot = g * 18 + i;
      var broken = i === (g * 3 + 2) % 18 || i === (g * 3 + 3) % 18;
      put(armor, slot, x, y, z + (broken ? 13 : 0), 13, broken ? 9 : 37, 12, a, broken ? .32 : 0);
      put(brackets, slot, x, y, z - 7, 18, 2.3, 3, a);
      put(conductors, slot, x * .985, 6500 + (y - 6500) * .985, z + 6.4, .8, broken ? 6 : 28, .5, a);
    }
  }
  d.ruins = [];
  var platform = batch('rift-suspended-basalt-islands', new T.ConeGeometry(1, 1, 7), stone, 8);
  var ruins = batch('rift-ruined-towers', new T.BoxGeometry(1, 1, 1), alloy, 32);
  var caps = batch('rift-tower-lanterns', new T.BoxGeometry(1, 1, 1), d.conduitMat, 32);
  var spires = batch('rift-crystal-groves', new T.ConeGeometry(1, 1, 5), crystal, low ? 32 : 56);
  for (var island = 0; island < 8; island++) {
    var side = island % 2 ? 1 : -1, x = side * (195 + island % 3 * 27), y = 6500 - 65 + (island % 3) * 38, z = corridorZ(95 - Math.floor(island / 2) * 180);
    put(platform, island, x, y - 26, z, 48, 62, 39, Math.PI, island * .7);
    for (var tower = 0; tower < 4; tower++) {
      var h = 22 + (tower * 17 + island * 11) % 45, tx = x + (tower % 2 ? 16 : -16), tz = z + (tower < 2 ? 15 : -15), at = island * 4 + tower;
      put(ruins, at, tx, y + h / 2, tz, 7 + tower * 2, h, 9, side * .06, island * .12);
      put(caps, at, tx, y + h - 3, tz, 7.2 + tower * 2, 1.3, 9.2, side * .06, island * .12);
    }
    d.ruins.push({ x: x, y: y, z: z });
  }
  for (var c = 0; c < spires.count; c++) {
    var home = d.ruins[c % 8], ca = c * 2.399963;
    put(spires, c, home.x + Math.cos(ca) * 28, home.y + 5 + c % 4 * 5, home.z + Math.sin(ca) * 26, 2 + c % 3, 18 + c % 5 * 6, 2 + c % 3, Math.sin(ca) * .2, ca);
  }
  var corePositions = new Float32Array((low ? 70 : 150) * 3), coreSeeds = new Float32Array(corePositions.length / 3);
  for (var p = 0; p < coreSeeds.length; p++) {
    var sector = d.ruins[p % 8], a = p * 2.399963;
    corePositions[p * 3] = sector.x + Math.cos(a) * (12 + p % 7 * 5); corePositions[p * 3 + 1] = sector.y + 12 + p % 11 * 5; corePositions[p * 3 + 2] = sector.z + Math.sin(a) * 32; coreSeeds[p] = p;
  }
  var geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(corePositions, 3)); geo.setAttribute('seed', new T.BufferAttribute(coreSeeds, 1));
  d.remnantMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixel: { value: 1 } },
    vertexShader: 'attribute float seed;uniform float time,pixel;varying float a;void main(){vec3 p=position;p.y+=sin(time*.5+seed)*4.;a=.5+.3*sin(time*.7+seed);vec4 v=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(950./max(1.,-v.z),1.,6.)*pixel;gl_Position=projectionMatrix*v;}',
    fragmentShader: 'varying float a;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(.68,.91,1.,(1.-d)*a);}' }));
  scene.add(new T.Points(geo, d.remnantMat));
  d.echoes = [];
  var echoMat = keep(new T.ShaderMaterial({ side: T.DoubleSide, transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, view: { value: target.texture } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time;uniform sampler2D view;void main(){vec2 p=(vUv-.5)*2.;float edge=max(abs(p.x)*.8,abs(p.y));float tear=.05*sin(p.x*9.+sin(p.y*7.));float mask=1.-smoothstep(.74,.78,edge+tear);float rim=exp(-abs(edge+tear-.76)*90.);vec2 warp=vec2(sin(p.y*16.-time),cos(p.x*11.+time))*.007;vec3 c=texture2D(view,clamp(vUv+warp,.01,.99)).rgb;c=mix(c,vec3(.68,.91,1.),.12);gl_FragColor=vec4(c*mask+vec3(.68,.91,1.)*rim*1.6,max(mask*.92,rim));}' }));
  for (var e = 0; e < 4; e++) {
    var echo = mesh(scene, new T.PlaneGeometry(75, 115), echoMat), side = e % 2 ? 1 : -1;
    echo.position.set(side * 135, 6558 + (e % 2) * 20, corridorZ(-35 - Math.floor(e / 2) * 235)); echo.rotation.y = side * -.35; echo.rotation.z = side * .16; d.echoes.push(echo);
  }
  d.echoMat = echoMat;
  d.exitHaloMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, charge: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float time,charge;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float arcs=pow(max(0.,cos(a*7.+time*.35)),14.);float rail=exp(-abs(r-(.64-charge*.08))*150.);float pulse=exp(-abs(r-(.65+fract(time*.16)*.24))*55.)*(1.-fract(time*.16));float tick=step(.86,fract(a/6.28318*80.));float al=(rail*(.25+arcs*.55+tick*.2)+pulse*.1)*(.5+charge*.5);gl_FragColor=vec4(.68,.91,1.,al);}' }));
  var exitHalo = mesh(portal, new T.PlaneGeometry(580, 580), d.exitHaloMat); exitHalo.position.z = -5;
}
function strikeBolt(d, from, to) {
  var bolt = d.bolts.find(function (x) { return x.age > .35; }); if (!bolt) return;
  bolt.age = 0; bolt.a.copy(from); bolt.b.copy(to);
}
function updateDetails(dt) {
  var d = detail; if (!d) return;
  var speedK = reduced ? 1 : 3.4 + (world.exitProgress || 0) * 1.2;
  var flightAge = Math.max(0, elapsed - E.meteorTransport.start);
  d.streakData.forEach(function (streak, i) {
    var z = E.meteorPos.z - 1500 + ((flightAge * streak.speed + streak.offset) % 2000), at = i * 6;
    d.streakPositions[at] = d.streakPositions[at + 3] = streak.x;
    d.streakPositions[at + 1] = d.streakPositions[at + 4] = 6500 + (E.meteorVisR || 44) + streak.y;
    d.streakPositions[at + 2] = z; d.streakPositions[at + 5] = z + streak.length * (reduced ? .2 : 1);
  });
  d.streaks.geometry.attributes.position.needsUpdate = true;
  d.beat = Math.max(0, d.beat - dt * 1.6); if (Math.floor(elapsed / 3.6) !== Math.floor((elapsed - dt) / 3.6)) d.beat = 1;
  d.tunnelMat.uniforms.time.value = elapsed; d.tunnelMat.uniforms.beat.value = d.beat; d.tunnelMat.uniforms.speed.value = speedK;
  // Le corridor gagne en profondeur à l’approche : les battements restent lisibles
  // sans forcer la caméra du joueur à passer en vue rapprochée.
  d.vortexMat.uniforms.time.value = elapsed;
  var passage = world.exitProgress || 0, motionTime = reduced ? 0 : elapsed;
  d.conduitMat.uniforms.time.value = motionTime; d.conduitMat.uniforms.charge.value = d.beat * .4 + smooth((passage - .65) / .35);
  d.remnantMat.uniforms.time.value = motionTime; d.remnantMat.uniforms.pixel.value = Math.min(1.5, api.renderer().getPixelRatio());
  d.echoMat.uniforms.time.value = motionTime;
  d.exitHaloMat.uniforms.time.value = motionTime; d.exitHaloMat.uniforms.charge.value = smooth((passage - .5) / .5);
  d.echoes.forEach(function (echo, i) { echo.position.y = 6558 + (i % 2) * 20 + Math.sin(motionTime * .35 + i * 1.7) * 5; });
  var mz = E.meteorPos ? E.meteorPos.z : 0;
  d.gates.forEach(function (gate, i) {
    if (!gate.passed && mz < gate.z) { gate.passed = true; gate.glow = 1; E.emit('rift:cross', { kind: 'inner-gate', index: i, pos: gate.group.position.clone() }); }
    gate.glow = Math.max(gate.passed ? .15 : 0, gate.glow - dt * .8);
    gate.outer.material.uniforms.time.value = gate.inner.material.uniforms.time.value = elapsed;
    gate.outer.material.uniforms.glow.value = gate.inner.material.uniforms.glow.value = gate.glow + d.beat * .3;
    gate.group.rotation.z += dt * (.08 + i * .015) * (i % 2 ? 1 : -1);
    gate.group.scale.setScalar(1 + gate.glow * .12 + Math.sin(elapsed * 1.4 + i) * .015);
  });
  d.chunks.forEach(function (c, i) {
    var a = c.angle + elapsed * c.spin * .25, z = E.meteorPos.z - 2200 + ((flightAge * 180 + c.z + 2800) % 2800);
    dummy.position.set(Math.cos(a) * c.radius, 6500 + Math.sin(a) * c.radius * .8, z);
    dummy.rotation.set(c.tilt + Math.sin(elapsed * .3 + i) * .08, elapsed * c.spin, c.tilt * .5); dummy.scale.set(c.size, c.size * .9, c.size);
    dummy.updateMatrix(); d.rock.setMatrixAt(i, dummy.matrix);
    dummy.translateY(c.size * .78); dummy.scale.set(c.size * 1.02, c.size * .6, c.size * 1.02); dummy.updateMatrix(); d.turf.setMatrixAt(i, dummy.matrix);
  });
  d.rock.instanceMatrix.needsUpdate = d.turf.instanceMatrix.needsUpdate = true;
  var pz = E.meteorPos ? E.meteorPos.z : 0;
  for (var m = 0; m < d.moteData.length; m++) {
    var md = d.moteData[m]; md.z += md.v * speedK * dt;
    if (md.z > pz + 650) { md.z = pz - 1100 - Math.random() * 400; md.a = Math.random() * Math.PI * 2; }
    d.motePos[m * 3] = Math.cos(md.a) * md.r; d.motePos[m * 3 + 1] = 6500 + Math.sin(md.a) * md.r; d.motePos[m * 3 + 2] = md.z;
  }
  d.motes.geometry.attributes.position.needsUpdate = true; d.moteMat.uniforms.pixel.value = Math.min(1.5, api.renderer().getPixelRatio());
  d.boltTimer -= dt;
  if (d.boltTimer <= 0) {
    d.boltTimer = .5 + Math.random() * 1.4;
    var ang = Math.random() * Math.PI * 2, ang2 = ang + 1 + Math.random() * 2.2, z0 = pz - 80 - Math.random() * 380;
    strikeBolt(d, new T.Vector3(Math.cos(ang) * 290, 6500 + Math.sin(ang) * 290, z0), new T.Vector3(Math.cos(ang2) * 290, 6500 + Math.sin(ang2) * 290, z0 - 60 + Math.random() * 120));
  }
  d.bolts.forEach(function (bolt) {
    bolt.age += dt; var k = Math.max(0, 1 - bolt.age / .35); bolt.mat.opacity = reduced ? 0 : k * (.82 + .08 * Math.sin(bolt.age * 25)); bolt.halo.material.opacity = reduced ? 0 : k * .22;
    if (k <= 0) return;
    for (var i = 0; i < 14; i++) {
      var t = i / 13, j = 70 * Math.sin(t * Math.PI);
      bolt.pos[i * 3] = bolt.a.x + (bolt.b.x - bolt.a.x) * t + (Math.random() - .5) * j;
      bolt.pos[i * 3 + 1] = bolt.a.y + (bolt.b.y - bolt.a.y) * t + (Math.random() - .5) * j;
      bolt.pos[i * 3 + 2] = bolt.a.z + (bolt.b.z - bolt.a.z) * t + (Math.random() - .5) * j * .4;
    }
    bolt.line.geometry.attributes.position.needsUpdate = true; bolt.halo.position.lerpVectors(bolt.a, bolt.b, .5);
  });
}
function restoreBorrowed() {
  [borrowedMeteor, borrowedRocket].forEach(function (visual) {
    if (!visual) return;
    visual.group.traverse(function (object) {
      if (!object.material) return;
      var materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(function (material) { if (material.clippingPlanes === exitClip) material.clippingPlanes = null; });
    });
  });
  if (borrowedMeteor && meteorParent) meteorParent.add(borrowedMeteor.group);
  if (borrowedRocket && rocketParent) rocketParent.add(borrowedRocket.group);
  borrowedMeteor = borrowedRocket = null; meteorParent = rocketParent = null;
}
function update(dt) {
  if (!api || !E.active) return;
  var p = api.player(), flight = E.meteorTransport, visuals = E.eventVisuals;
  var inside = !!(p && p._meteorRide && visuals && flight && E.tTotal >= flight.start && E.tTotal < flight.end && E.meteorContactTime == null);
  elapsed = E.tTotal;
  if (inside && !world.active) {
    world.active = true; world.enteredAt = elapsed; exitAt = -Infinity;
    savedCameraFar = api.camera().far; api.camera().far = 22000; api.camera().updateProjectionMatrix();
    world.exitOpening = 0; world.speed = 0;
    if (detail) {
      detail.gates.forEach(function (gate) { gate.passed = false; gate.glow = 0; });
      detail.moteData.forEach(function (mote) { mote.z = corridorZ(130) - 1100 + Math.random() * 1700; });
    }
    borrowedMeteor = visuals.meteor; meteorParent = borrowedMeteor.group.parent; scene.add(borrowedMeteor.group);
    p._meteorRideOffset = { x: 0, y: E.meteorVisR, z: 0 }; delete p._meteorPrevious;
    api.view()._camMode = 'bus';
    E.emit('player:rift-enter', { pos: E.meteorPos.clone() });
  } else if (!inside && world.active) {
    restoreBorrowed(); world.active = false; exitAt = elapsed;
    if (savedCameraFar !== null) { api.camera().far = savedCameraFar; api.camera().updateProjectionMatrix(); savedCameraFar = null; }
    world.speed = 0;
    if (p && p._meteorRide && E.meteorVisible) {
      p._meteorRideOffset = { x: 0, y: E.meteorVisR + 1, z: 0 }; delete p._meteorPrevious;
      p.x = E.meteorPos.x; p.y = E.meteorPos.y + E.meteorVisR + 1; p.z = E.meteorPos.z;
      api.view()._camMode = 'bus';
      E.emit('player:rift-exit', { pos: E.meteorPos.clone() });
    }
  }
  document.body.classList.toggle('inside-rift', world.active);
  var flashAge = world.active ? elapsed - world.enteredAt : elapsed - exitAt;
  var k = flight ? Math.max(0, Math.min(1, (elapsed - flight.start) / (flight.end - flight.start))) : 0;
  // v48 : la lumière de la faille de sortie envahit l'écran pendant que la caméra la franchit.
  var dive = world.active ? smooth((k - .935) / .065) : 0; world.exitProgress = world.active ? k : 0;
  var flash = flashAge < .7 ? Math.pow(1 - flashAge / .7, 2) * (world.active ? .5 : .85) : 0;
  transition.style.opacity = String(Math.max(flash, dive * .92) * (reduced ? .3 : 1));
  if (!world.active) return;
  var R = E.meteorVisR || 44, duration = flight.end - flight.start, age = elapsed - flight.start;
  var endZ = -426, startZ = corridorZ(130);
  var travel = k * .7 + k * k * .3;
  world.speed = (startZ - endZ) / duration * (.7 + k * .6);
  position.set(0, 6500, startZ + (endZ - startZ) * travel);
  var meteor = borrowedMeteor;
  meteor.group.position.copy(position); meteor.group.visible = meteor.visible = true;
  meteor.rock.material.clippingPlanes = meteor.lavaMat.clippingPlanes = meteor.sheathMat.clippingPlanes = exitClip;
  if (meteor.arcs) meteor.arcs.material.clippingPlanes = exitClip;
  meteor.fireTail.visible = true; meteor.fireTail.quaternion.setFromUnitVectors(rocketUp, tailAxis); meteor.fireTail.scale.set(1.08, 1.9 + k * .7, 1.08);
  meteor.fireMat.uniforms.time.value = elapsed; meteor.fireMat.uniforms.heat.value = 1.15; meteor.fireMat.clippingPlanes = exitClip;
  meteor.sheath.visible = true; meteor.sheathMat.uniforms.time.value = elapsed; meteor.sheathMat.uniforms.heat.value = 1;
  meteor.lavaMat.uniforms.heat.value = 1.4; meteor.halo.material.opacity = .18 * (1 - dive); meteor.light.intensity = 3.4;
  meteor.fragments.forEach(function (f) { f.mesh.material.clippingPlanes = exitClip; });
  var approach = smooth((k - .6) / .4); portal.children[0].material.uniforms.approach.value = approach;
  if (detail) detail.tunnelMat.uniforms.beat.value = Math.max(detail.tunnelMat.uniforms.beat.value, approach * .6);
  E.meteorPos.copy(position); E.meteorVisible = true; E.anchors.meteor.copy(position);
  if (E.coherenceSnapshot) E.coherenceSnapshot.meteorVisible = true;
  skyMaterial.uniforms.time.value = elapsed; starsMaterial.uniforms.time.value = elapsed;
  starsMaterial.uniforms.pixelRatio.value = Math.min(1.5, api.renderer().getPixelRatio());
  ribbons.forEach(function (r) { r.material.uniforms.time.value = elapsed; });
  portal.children[0].material.uniforms.time.value = elapsed;
  world.exitOpening = smooth((age - .1) / 2.8);
  portal.children[0].material.uniforms.opening.value = world.exitOpening;
  portal.scale.set(7, 7 * (.12 + .88 * world.exitOpening), 1);
  if (detail) detail.wakeMat.uniforms.time.value = elapsed;
  for (var i = 0; i < shards.count; i++) {
    var a = i * 2.399963 + (reduced ? 0 : elapsed * .015), radius = 190 + i % 9 * 37;
    dummy.position.set(Math.cos(a) * radius, 6500 + Math.sin(a * 1.7) * 190, position.z - 2000 + ((age * 160 + i * 283) % 2600));
    dummy.rotation.set(a * .7, a * .3, i + elapsed * .025);
    var size = 2 + (i % 7) * 1.25; dummy.scale.set(size, size * (1.5 + i % 3), size * .65); dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix);
  }
  shards.instanceMatrix.needsUpdate = true;
  updateDetails(dt);
  var rocket = visuals.rockets[0], launchAt = flight.start + .15, crossAt = E.TIMELINE.strike[0] + .95;
  if (elapsed >= launchAt && elapsed < crossAt) {
    if (!borrowedRocket) { borrowedRocket = rocket; rocketParent = rocket.group.parent; scene.add(rocket.group); rocket.trail.reset(); }
    var passDuration = crossAt - launchAt;
    var progress = Math.max(0, Math.min(1, (elapsed - launchAt) / passDuration));
    var relativeZ = 160 - 230 * progress - 400 * progress * progress;
    var sprintTime = Math.max(0, Math.min(1, (progress - .72) / .28));
    var sprint = Math.pow(sprintTime, 3), sprintRate = 3 * sprintTime * sprintTime / (.28 * passDuration);
    var followZ = position.z + relativeZ, exitZ = portal.position.z - 32;
    var rocketZ = followZ * (1 - sprint) + exitZ * sprint;
    var side = 18 * (1 - sprint), cruiseY = position.y + R + 8;
    rocket.group.position.set(side, cruiseY * (1 - sprint) + portal.position.y * sprint, rocketZ);
    var relativeSpeed = (230 + 800 * progress) / passDuration;
    forward.set(-18 * sprintRate, (portal.position.y - cruiseY) * sprintRate, (-world.speed - relativeSpeed) * (1 - sprint) + (exitZ - followZ) * sprintRate).normalize(); rocket.direction.copy(forward);
    rocket.active = true; rocket.throttle = .75 + progress * .25;
    if (detail) {
      detail.rocketWake.position.set(rocket.group.position.x, rocket.group.position.y, rocketZ + 145);
      detail.rocketWake.visible = true; detail.wakeMat.uniforms.alpha.value = .65;
    }
    rocket.group.quaternion.setFromUnitVectors(rocketUp, forward); rocket.group.visible = true;
    rocket.flame.visible = true; rocket.flameMat.clippingPlanes = null; rocket.flameMat.uniforms.time.value = elapsed; rocket.flameMat.uniforms.thrust.value = rocket.throttle;
    rocket.flame.scale.y = .8 + progress * .9;
    rocket.flame.position.y = -24 - 20 * rocket.flame.scale.y;
    if (rocket.engineJets) rocket.engineJets.forEach(function (jet, i) { jet.visible = true; jet.material.uniforms.time.value = elapsed + i * .37; jet.material.uniforms.thrust.value = rocket.throttle; });
    rocket.heat.emissiveIntensity = 1.5;
    rocket.halo.material.opacity = .45;
    rocket.group.traverse(function (o) { if (o.isMesh) o.material.clippingPlanes = exitClip; });
    E.anchors.rocket1.copy(rocket.group.position);
    world.rocketStage = sprint > 0 ? 'entering-exit-rift' : relativeZ > 0 ? 'overtaking' : 'accelerating-ahead';
  } else {
    if (detail) {
      var wakeFade = elapsed >= crossAt ? Math.max(0, 1 - (elapsed - crossAt) / .8) : 0;
      detail.rocketWake.visible = wakeFade > 0; detail.wakeMat.uniforms.alpha.value = .65 * wakeFade;
    }
    if (borrowedRocket) { rocketParent.add(borrowedRocket.group); borrowedRocket.group.visible = false; borrowedRocket = null; rocketParent = null; }
    world.rocketStage = E.rocketDestroyed ? 'zero-point-contact' : elapsed >= crossAt ? 'diving-to-zero-point' : 'approaching';
  }
}
function render(renderer, originalRender, camera) {
  var view = api.view(), p = api.player(), c = E.zeroPointPos;
  var actorParent = view.actorRoot.parent, previousTarget = renderer.getRenderTarget();
  // Render the real island into the exit aperture, never as the backdrop of this dimension.
  if (elapsed - lastPortalFrame >= (low ? 1 / 10 : 1 / 18)) {
    lastPortalFrame = elapsed;
    portalCamera.position.set(c.x + 780, c.y + 720, c.z + 880);
    cameraLook.copy(c); cameraLook.y += E.rocketDestroyed ? 0 : 370;
    portalCamera.lookAt(cameraLook); portalCamera.updateMatrixWorld();
    var actorsVisible = view.actorRoot.visible; view.actorRoot.visible = false;
    try { renderer.setRenderTarget(target); originalRender.call(renderer, api.scene(), portalCamera); }
    finally { renderer.setRenderTarget(previousTarget); view.actorRoot.visible = actorsVisible; }
  }
  scene.add(view.actorRoot);
  try { return E.renderMeteorRide(renderer, originalRender, scene, camera); }
  finally { if (actorParent) actorParent.add(view.actorRoot); }
}
function init(a) {
  api = a; low = a.isMobile || a.quality === 'low'; world.active = false; world.rocketStage = 'approaching';
  resources.clear(); ribbons = []; lastPortalFrame = exitAt = -Infinity; buildWorld();
}
function dispose() {
  restoreBorrowed(); world.active = false; world.speed = 0; document.body.classList.remove('inside-rift');
  if (savedCameraFar !== null && api) { api.camera().far = savedCameraFar; api.camera().updateProjectionMatrix(); savedCameraFar = null; }
  if (transition) transition.remove(); resources.forEach(function (r) { if (r.dispose) r.dispose(); }); resources.clear();
  scene = portal = target = transition = api = null; ribbons = []; detail = null;
}
var world = { active: false, enteredAt: 0, rocketStage: 'approaching', render: render,
  snapshot: function () { return { active: world.active, scene: scene && scene.name, meteorPresent: !!(borrowedMeteor && borrowedMeteor.group.parent === scene), rocketStage: world.rocketStage, rocketPresent: !!(borrowedRocket && borrowedRocket.group.parent === scene), meteorY: E.meteorPos && E.meteorPos.y, meteorZ: E.meteorPos && E.meteorPos.z, speed: world.speed, exitOpening: world.exitOpening, exitZ: portal && portal.position.z }; } };
E.riftWorld = world;
E.register('rift-world', { init: init, preUpdate: update, dispose: dispose });
})(window);
