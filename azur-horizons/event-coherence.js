(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;
var api, scene, group, glow, smoke, meteor, zero, rockets = [], portals = [], links = [], waves = [];
var resources = new Set(), flags = {}, low, previousPhase, clock = 0, rng = 271828;
var center, pad, frozen, front, rear, rearOther, arrival, up = new T.Vector3(0, 1, 0);
var capturePasses = [], previousMeteor = new T.Vector3(), meteorSpeed = 0, frameDt = 1 / 60;
var tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3(), direction = new T.Vector3();
var cameraRight = new T.Vector3(), cameraUp = new T.Vector3(), q = new T.Quaternion();
var oldClipping = false, bound = false, meteorHitAt = -1, rocketHitAt = -1;
var motionPreference = root.matchMedia('(prefers-reduced-motion: reduce)');
var descentKeys = [], launchPlane, capturePlane, arrivalPlane, captureClip = null, arrivalClip = null;
var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
var smooth = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
function random() { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; }
function keep(value) { resources.add(value); return value; }
function V(x, y, z) { return new T.Vector3(x, y, z); }
function phaseProgress(name) { var b = E.TIMELINE[name]; return clamp((E.tTotal - b[0]) / (b[1] - b[0])); }
function once(key, condition, action) { if (condition && !flags[key]) { flags[key] = true; action(); } }
function publish(name, position) { if (!E.anchors[name]) E.anchors[name] = position.clone(); else E.anchors[name].copy(position); }
function mesh(parent, geometry, material, x, y, z) {
  var m = new T.Mesh(keep(geometry), keep(material)); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m;
}
function basic(color, opacity) { return keep(new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: T.AdditiveBlending, depthWrite: false })); }
function metal(color, roughness) { return keep(new T.MeshStandardMaterial({ color: color, roughness: roughness || 0.48, metalness: 0.65 })); }
function sprite(parent, color, size, opacity) {
  var m = keep(new T.SpriteMaterial({ map: glow, color: color, transparent: true, opacity: opacity, blending: T.AdditiveBlending, depthWrite: false }));
  var s = new T.Sprite(m); s.scale.set(size, size, 1); parent.add(s); return s;
}
function radialTexture() {
  var canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  var ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.18, 'rgba(255,255,255,.8)'); gradient.addColorStop(0.5, 'rgba(255,255,255,.16)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); return keep(new T.CanvasTexture(canvas));
}
var noiseGLSL = 'float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));} float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);} float fbm(vec3 p){return .55*noise(p)+.28*noise(p*2.1)+.14*noise(p*4.3);}';
var surfaceVertex = '#include <clipping_planes_pars_vertex>\nvarying vec3 vN; varying vec3 vP; varying vec3 vView; void main(){vN=normalize(normalMatrix*normal);vP=position;vec4 mvPosition=modelViewMatrix*vec4(position,1.);vView=-mvPosition.xyz;gl_Position=projectionMatrix*mvPosition;\n#include <clipping_planes_vertex>\n}';
var portalVertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
/* v48 — FAILLE = DÉCHIRURE DU CIEL (référence : capture du live The End).
   La faille naît comme une fissure blanche en zigzag (reveal), puis s'écarte
   en une lentille aux bords cassés (gape) remplie de lumière blanc-bleu ;
   des fissures secondaires bifurquent et une gerbe de traits de lumière
   bleus jaillit tout autour. Le trou reste assez haut pour avaler la
   météorite (demi-hauteur ≈ 0,6 × rayon du portail). */
var crackGLSL = [
  'float h1(float n){return fract(sin(n*91.345+47.13)*43758.5453);}',
  'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
  'float pl(float x){float i=floor(x);return mix(h1(i),h1(i+1.),fract(x));}',
  'float jag(float x,float s){return (pl(x*4.2+s)-.5)*.07+(pl(x*11.+s*1.7)-.5)*.035+(pl(x*29.+s*2.3)-.5)*.014;}',
  'float rays(float aa,float rr,float N,float sd,float reach,float t,float speed){',
  ' float s=aa/6.28318*N+sd;float cell=floor(s);',
  ' float a1=h2(vec2(cell,sd)),a2=h2(vec2(cell,sd+17.)),a3=h2(vec2(cell,sd+31.));',
  ' float f=abs(fract(s)-(.5+(a3-.5)*.6));float len=reach*(.22+.78*a1*a1);float st=.03+.2*a2*a2;',
  ' float k=(rr-st)/max(.001,len);float body=smoothstep(0.,.12,k)*(1.-smoothstep(.45,1.,k));',
  ' float thin=(.07+.22*a2)*(1.-.55*clamp(k,0.,1.));',
  ' return (1.-smoothstep(0.,thin,f))*body*(.6+.4*sin(rr*24.-t*speed+cell*3.7))*(.35+.65*a1);}'
].join('\n');
var portalFragment = [
  'varying vec2 vUv;uniform float time;uniform float opening;uniform float pulse;uniform float seed;uniform float ang;uniform vec2 parallax;', noiseGLSL, crackGLSL,
  'void main(){',
  'vec2 p=(vUv-.5)*2.;',
  'float mask=(1.-smoothstep(.8,1.,max(abs(p.x),abs(p.y))))*(1.-smoothstep(.88,1.,length(p)));',
  /* glitch : de brèves bandes du ciel se décalent, la réalité « saute » */
  'float tq=floor(time*7.);float glitch=step(.86,h1(tq+seed*13.))*(.4+pulse);',
  'p.x+=glitch*step(.5,fract(p.y*5.+h1(tq*1.7)))*.045;',
  'float ca=cos(ang),sa=sin(ang);vec2 q=vec2(ca*p.x+sa*p.y,-sa*p.x+ca*p.y);',
  'float reveal=smoothstep(0.,.55,opening);float gape=smoothstep(.25,1.,opening);',
  'float HL=.66*reveal+.001;float y0=jag(q.x,seed);float dy=q.y-y0;',
  'float u=clamp(abs(q.x)/HL,0.,1.);float prof=pow(max(0.,1.-u*u),.75);',
  'float H=(.31*gape+.008)*prof;',
  'float topE=H*(1.+(pl(q.x*9.+seed*3.)-.5)*.55*gape);float botE=H*(1.+(pl(q.x*9.+seed*5.+20.)-.5)*.55*gape);',
  'float sd=dy>0.?dy-topE:-dy-botE;',
  'float inLen=1.-smoothstep(.9,1.,abs(q.x)/HL);',
  'float inside=(1.-smoothstep(-.006,.004,sd))*inLen;',
  'float rim=exp(-abs(sd)*95.)*inLen*(.85+.15*sin(time*31.+q.x*47.));',
  'float glowR=exp(-max(sd,0.)*20.)*inLen;',
  'float n=fbm(vec3(q*6.,time*.25+seed));',
  'vec2 c2=vec2(q.x/HL,dy/max(.02,H+.02));float depth=clamp(length(c2),0.,1.);',
  'float stream=pow(max(0.,sin(q.x*38.+n*6.-time*(3.+pulse*3.))),6.);',
  'vec3 inner=mix(vec3(1.),vec3(.58,.84,1.),smoothstep(0.,.75,depth));',
  'inner=mix(inner,vec3(.24,.46,.96),smoothstep(.55,1.,depth)*.65);',
  'inner+=vec3(.6,.85,1.)*stream*.22*(1.-depth);inner*=.82+.32*n;',
  /* à travers la déchirure : un tourbillon et des étoiles qui filent vers le fond */
  'float swA=atan(c2.y,c2.x)+time*(.7+pulse*1.5)+(1.-depth)*5.;',
  'float swirl=pow(max(0.,sin(swA*3.+n*4.)),3.)*(1.-depth)*smoothstep(.0,.3,depth);',
  'vec2 sv=(c2+parallax*(1.-depth))/(.12+depth);float sp=0.;',
  'for(int j=0;j<4;j++){float fj=float(j);float layer=2.+fj*2.4;vec2 travel=vec2(cos(time*.14+fj),sin(time*.14+fj))*.15;vec2 gc=fract((sv+parallax*fj*.7+travel)*layer+vec2(seed*.3+fj*.37,-time*(.35+fj*.25)))-.5;sp+=exp(-dot(gc,gc)*(220.+fj*110.))*(.8-fj*.15);}',
  'float tunnel=pow(max(0.,sin(log(.06+depth)*-20.-time*(2.+pulse)+n*2.)),14.)*(1.-depth);',
  'inner+=vec3(.08,.24,.7)*tunnel*.4*gape;',
  'inner=mix(inner,vec3(.012,.035,.16),(1.-smoothstep(.18,.82,depth))*.94*gape);',
  'inner+=vec3(.3,.68,1.)*swirl*.95*gape+vec3(.75,.92,1.)*sp*(1.-depth*.6)*gape;',
  'float bc=0.,bh=0.;',
  'for(int i=0;i<12;i++){float fi=float(i);',
  ' float r1=h1(seed*3.1+fi*7.3),r2=h1(seed*5.7+fi*3.9),r3=h1(seed*1.3+fi*11.1);float big=step(fi,4.5);',
  ' float sx=(r1-.5)*1.7*HL;vec2 o=vec2(sx,jag(sx,seed));float side=r2<.5?-1.:1.;float dirS=sx>=0.?1.:-1.;',
  ' float ba=(sx>=0.?0.:3.14159)+side*(.5+r3*.85)*dirS;vec2 dir=vec2(cos(ba),sin(ba));vec2 v=q-o;',
  ' float bl=mix(.05+.1*r2,.2+.28*r3,big)*reveal*(1.-.45*abs(sx)/HL);',
  ' float tt=dot(v,dir)/max(.001,bl);float pr=dot(v,vec2(-dir.y,dir.x));',
  ' float off=((pl(tt*5.+fi*5.)-.5)*.05+(pl(tt*13.+fi*9.)-.5)*.015)*tt*bl*4.;float bd=abs(pr-off);',
  ' float m=smoothstep(-.02,.06,tt)*(1.-smoothstep(.75,1.,tt));float bw=mix(.0065,.0012,clamp(tt,0.,1.))*mix(.6,1.,big);',
  ' bc=max(bc,(1.-smoothstep(bw*.35,bw,bd))*m);bh=max(bh,exp(-bd*70.)*m*(1.-.6*clamp(tt,0.,1.))*mix(.55,1.,big));}',
  'vec2 pc=q-vec2(0.,jag(0.,seed));float rr=length(pc);float aa=atan(pc.y,pc.x);',
  'float perp=pow(abs(sin(aa)),1.4)*(sin(aa)>0.?1.:.7);',
  'float reach=(.36+.6*perp)*(.25+.75*reveal)*(1.+pulse*.25);float spd=3.+pulse*5.;',
  'float s1=rays(aa,rr,170.,seed,reach,time,spd),s2=rays(aa,rr,62.,seed+9.,reach*.85,time,spd*.7),s3=rays(aa,rr,250.,seed+21.,reach*1.2,time,spd*1.3);',
  'float burst=exp(-rr*5.5);float haze=burst*.22+glowR*.12;',
  'vec3 c=inner*inside;',
  'c+=vec3(1.)*rim*(1.5+pulse)+vec3(.55,.85,1.)*glowR*.55;',
  'c+=vec3(1.)*bc*1.7+vec3(.55,.85,1.)*bh*.8;',
  'c+=vec3(.24,.52,1.)*s1*.95+vec3(.5,.78,1.)*s2*1.05+vec3(.3,.6,1.)*s3*.55;',
  'c+=vec3(.38,.42,1.)*haze;',
  /* pointes de la déchirure : l'étincelle qui « coupe » le ciel pendant l'ouverture */
  'float tipD=min(length(q-vec2(HL,jag(HL,seed))),length(q-vec2(-HL,jag(-HL,seed))));',
  'float tip=(exp(-tipD*55.)*1.6+exp(-tipD*14.)*.35)*(sin(reveal*3.14159)+.15)*step(.001,opening);',
  /* frange chromatique sur les lèvres, renforcée pendant un glitch */
  'float rimR=exp(-abs(sd-.014)*110.)*inLen,rimB=exp(-abs(sd+.01)*110.)*inLen;',
  'c+=vec3(1.,.3,.45)*rimR*(.18+glitch*.7)+vec3(.2,.65,1.)*rimB*(.35+glitch*.5)+vec3(1.)*tip;',
  'float rayA=clamp(rim*1.2+glowR*.4+bc+bh*.7+(s1+s2+s3*.6)*.85+haze*.8+tip+rimR*.3,0.,1.);',
  'float alpha=max(inside*.97,rayA)*mask*clamp(opening*3.,0.,1.);',
  'gl_FragColor=vec4(c*(1.+pulse*.45),clamp(alpha,0.,1.));}'
].join('\n');
var portalCoronaFragment = [
  'varying vec2 vUv;uniform float time;uniform float opening;uniform float pulse;uniform float anticipation;uniform float age;uniform float ang;uniform float seed;', crackGLSL,
  'void main(){vec2 p=(vUv-.5)*2.;float r=length(p);',
  'float ca=cos(ang),sa=sin(ang);vec2 q=vec2(ca*p.x+sa*p.y,-sa*p.x+ca*p.y);',
  'float halo=exp(-(q.x*q.x*4.+q.y*q.y*14.))*(anticipation*.36+opening*.06+pulse*.12);',
  /* avant l'ouverture, le ciel commence à se fêler : un fil de lumière qui s'allonge */
  'float pre=exp(-abs(q.y*2.-jag(q.x*2.,seed))*140.)*(1.-smoothstep(.0,.36*anticipation+.001,abs(q.x)))*anticipation*(.7+.3*sin(time*40.+q.x*90.));',
  'float sweep=clamp(age/1.65,0.,1.);float shock=exp(-abs(r-(.24+sweep*.68))*115.)*pow(1.-sweep,2.)*.55;',
  'float alpha=(halo+pre+shock)*(1.-smoothstep(.92,1.,r));',
  'gl_FragColor=vec4(mix(vec3(.32,.68,1.),vec3(.9,.97,1.),pre),alpha);}'
].join('\n');
function crackAngle(seed) { var h = Math.sin(seed * 12.9898 + 4.1) * 43758.5453; return -0.42 + ((h - Math.floor(h)) - 0.5) * 0.8; }
/* v78 : les shaders des anciennes failles sont partagés avec le film (event-film-v75.js). */
E.oldRiftShaders = { vertex: portalVertex, fragment: portalFragment, corona: portalCoronaFragment, angle: crackAngle };
function makePortal(position, radius, normal, kind) {
  var g = new T.Group(); g.name = 'v27-rift-' + kind; g.position.copy(position); g.quaternion.setFromUnitVectors(V(0, 0, 1), normal.clone().normalize()); group.add(g);
  var seed = portals.length * 2.173, ang = { value: crackAngle(seed) }, seedU = { value: seed };
  var material = keep(new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, uniforms: { time: { value: 0 }, opening: { value: 0 }, pulse: { value: 0 }, seed: seedU, ang: ang, parallax: { value: new T.Vector2() } }, vertexShader: portalVertex, fragmentShader: portalFragment }));
  mesh(g, new T.PlaneGeometry(radius * 3.6, radius * 3.6), material);
  var coronaMat = keep(new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, opening: { value: 0 }, pulse: { value: 0 }, anticipation: { value: 0 }, age: { value: 99 }, ang: ang, seed: seedU }, vertexShader: portalVertex, fragmentShader: portalCoronaFragment }));
  var corona = mesh(group, new T.PlaneGeometry(radius * 7.2, radius * 7.2), coronaMat); corona.position.copy(position); corona.quaternion.copy(g.quaternion);
  // Éclats de verre arrachés aux bords de la déchirure.
  var shards = new T.InstancedMesh(keep(new T.OctahedronGeometry(1, 0)), keep(new T.MeshStandardMaterial({ color: 0xc9e6ff, roughness: 0.18, metalness: 0.55, emissive: 0x3b9cff, emissiveIntensity: 0.9, transparent: true, opacity: 0 })), low ? 12 : 26);
  shards.instanceMatrix.setUsage(T.DynamicDrawUsage); shards.frustumCulled = false; g.add(shards);
  // Éclairs qui crépitent sur les lèvres de la déchirure (régénérés en continu).
  var boltCount = low ? 4 : 9, boltSeg = 8, boltPos = new Float32Array(boltCount * boltSeg * 6), boltGeo = keep(new T.BufferGeometry());
  boltGeo.setAttribute('position', new T.BufferAttribute(boltPos, 3).setUsage(T.DynamicDrawUsage));
  var bolts = new T.LineSegments(boltGeo, keep(new T.LineBasicMaterial({ color: 0xd6f0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
  bolts.frustumCulled = false; g.add(bolts);
  var p = { group: g, pos: g.position, normal: normal.clone().normalize(), radius: radius, mat: material, shards: shards, bolts: bolts, boltPos: boltPos, boltCount: boltCount, boltSeg: boltSeg, boltTimer: 0, dummy: new T.Object3D(), corona: corona, coronaMat: coronaMat,
    angle: ang.value, cosA: Math.cos(ang.value), sinA: Math.sin(ang.value),
    open: false, opening: 0, target: 0, pulse: 0, kind: kind, seed: seed, anticipation: 0, age: 99, wasTarget: false, flowCredit: 0 };
  portals.push(p); return p;
}
function pulsePortal(p, index, entering) {
  p.pulse = 1; E.emit('rift:cross', { kind: p.kind, index: index, pos: p.pos.clone() });
  E.emit('rocket:rift-enter', { index: index, rift: p.kind, pos: p.pos.clone(), exit: !entering });
  if (!(E.FILM_PLAY && p !== front && p !== arrival)) particles.burst(p.pos, low ? 12 : 28, 0xa4e2ff, 42, 1.1, 4.5);
}
function makeBeam(color, width) {
  var material = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { tint: { value: new T.Color(color) }, alpha: { value: 0 }, time: { value: 0 } }, vertexShader: portalVertex,
    fragmentShader: 'varying vec2 vUv;uniform vec3 tint;uniform float alpha;uniform float time;void main(){float packet=pow(max(0.,cos(vUv.y*21.-time*6.)),18.);float sheath=.65+.35*sin(vUv.x*6.28318);gl_FragColor=vec4(tint*(.6+packet*.75),alpha*sheath*(.55+packet*.45));}' })), b = mesh(group, new T.CylinderGeometry(1, 1, 1, 6, 12, true), material); b.visible = false;
  return { mesh: b, mat: material, width: width };
}
function placeBeam(b, a, z, opacity) {
  direction.subVectors(z, a); var len = direction.length(); b.mesh.visible = opacity > 0.005 && len > 1;
  if (!b.mesh.visible) return; b.mesh.position.copy(a).add(z).multiplyScalar(0.5); b.mesh.quaternion.setFromUnitVectors(up, direction.multiplyScalar(1 / len)); b.mesh.scale.set(b.width, len, b.width); b.mat.uniforms.alpha.value = opacity; b.mat.uniforms.time.value = clock;
}
function makePool(count, smoky) {
  var positions = new Float32Array(count * 3), sizes = new Float32Array(count), alphas = new Float32Array(count), colors = new Float32Array(count * 3);
  var velocity = new Float32Array(count * 3), age = new Float32Array(count), life = new Float32Array(count), startSize = new Float32Array(count);
  var geometry = keep(new T.BufferGeometry()); geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('aSize', new T.BufferAttribute(sizes, 1)); geometry.setAttribute('aAlpha', new T.BufferAttribute(alphas, 1)); geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  var material = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: smoky ? T.NormalBlending : T.AdditiveBlending, vertexColors: true,
    uniforms: { pixelScale: { value: 480 } }, vertexShader: 'attribute float aSize;attribute float aAlpha;varying float vAlpha;varying vec3 vColor;uniform float pixelScale;void main(){vAlpha=aAlpha;vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*pixelScale/max(1.,-mv.z),0.,180.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vAlpha;varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=pow(1.-r,' + (smoky ? '1.6' : '2.2') + ');gl_FragColor=vec4(vColor,a*vAlpha);}' }));
  var points = new T.Points(geometry, material); points.frustumCulled = false; points.name = smoky ? 'v27-exhaust-smoke' : 'v27-embers'; group.add(points);
  var cursor = 0, tint = new T.Color();
  return {
    emit: function (p, vx, vy, vz, color, size, duration) { var i = cursor++ % count, n = i * 3; positions[n] = p.x; positions[n + 1] = p.y; positions[n + 2] = p.z; velocity[n] = vx; velocity[n + 1] = vy; velocity[n + 2] = vz; age[i] = 0; life[i] = duration; sizes[i] = startSize[i] = size; tint.setHex(color); colors[n] = tint.r; colors[n + 1] = tint.g; colors[n + 2] = tint.b; alphas[i] = smoky ? 0.32 : 0.9; },
    burst: function (p, number, color, speed, duration, size) { for (var i = 0; i < number; i++) { var x = random() * 2 - 1, y = random() * 2 - 1, z = random() * 2 - 1, length = Math.sqrt(x * x + y * y + z * z) || 1; this.emit(p, x / length * speed, y / length * speed, z / length * speed, color, size, duration * (0.7 + random() * 0.6)); } },
    update: function (dt) { var camera = api.camera(); material.uniforms.pixelScale.value = Math.min(900, root.innerHeight * (camera ? 0.5 / Math.tan(camera.fov * Math.PI / 360) : 0.7));
      for (var i = 0; i < count; i++) { if (!life[i]) continue; age[i] += dt; var p = clamp(age[i] / life[i]); if (p >= 1) { life[i] = 0; alphas[i] = 0; sizes[i] = 0; continue; }
        var n = i * 3, drag = Math.exp(-dt * (smoky ? 0.8 : 0.12)); velocity[n] *= drag; velocity[n + 2] *= drag; velocity[n + 1] += (smoky ? 5 : -9) * dt;
        positions[n] += velocity[n] * dt; positions[n + 1] += velocity[n + 1] * dt; positions[n + 2] += velocity[n + 2] * dt; sizes[i] = startSize[i] * (smoky ? 1 + p * 2.8 : 1 - p * 0.65); alphas[i] = (smoky ? 0.32 : 0.9) * (1 - p) * smooth(Math.min(1, (1 - p) * 4));
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.aSize.needsUpdate = geometry.attributes.aAlpha.needsUpdate = geometry.attributes.color.needsUpdate = true;
    }
  };
}
var particles;
function makeTrail(color) {
  var count = low ? 34 : 64, samples = new Float32Array(count * 3), times = new Float32Array(count), positions = new Float32Array(count * 6), alpha = new Float32Array(count * 2), uv = new Float32Array(count * 4), indices = [];
  times.fill(-100);
  for (var i = 0; i < count; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i / count; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / count; if (i < count - 1) { var a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  var geometry = keep(new T.BufferGeometry()); geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('aAlpha', new T.BufferAttribute(alpha, 1)); geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); geometry.setIndex(indices);
  var material = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, uniforms: { tint: { value: new T.Color(color) } }, vertexShader: 'attribute float aAlpha;varying float vAlpha;varying vec2 vUv;void main(){vAlpha=aAlpha;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 tint;varying float vAlpha;varying vec2 vUv;void main(){float a=pow(1.-abs(vUv.x*2.-1.),1.8);gl_FragColor=vec4(tint,a*vAlpha);}' }));
  var ribbon = new T.Mesh(geometry, material); ribbon.frustumCulled = false; group.add(ribbon); var cursor = 0, filled = 0, lastSample = -100;
  var tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3(), direction = new T.Vector3();
  return {
    mesh: ribbon,
    reset: function () { filled = 0; times.fill(-100); alpha.fill(0); geometry.attributes.aAlpha.needsUpdate = true; lastSample = -100; },
    update: function (position, active, time, width) { if (active && time - lastSample >= 0.035) { var at = cursor * 3; samples[at] = position.x; samples[at + 1] = position.y; samples[at + 2] = position.z; times[cursor] = time; cursor = (cursor + 1) % count; filled = Math.min(count, filled + 1); lastSample = time; }
      var camera = api.camera(); if (!camera) return;
      for (var i = 0; i < count; i++) { var at = (cursor - 1 - Math.min(i, Math.max(0, filled - 1)) + count) % count, n = at * 3; tmp.set(samples[n], samples[n + 1], samples[n + 2]); var previous = ((at - 1 + count) % count) * 3; direction.set(samples[previous] - tmp.x, samples[previous + 1] - tmp.y, samples[previous + 2] - tmp.z); tmp2.subVectors(camera.position, tmp); tmp3.crossVectors(direction, tmp2).normalize(); if (tmp3.lengthSq() < 0.1) tmp3.set(1, 0, 0);
        var fading = i < filled ? clamp(1 - (time - times[at]) / 2.25) : 0, w = width * (0.35 + 0.65 * fading); tmp3.multiplyScalar(w); var o = i * 6;
        positions[o] = tmp.x + tmp3.x; positions[o + 1] = tmp.y + tmp3.y; positions[o + 2] = tmp.z + tmp3.z; positions[o + 3] = tmp.x - tmp3.x; positions[o + 4] = tmp.y - tmp3.y; positions[o + 5] = tmp.z - tmp3.z; alpha[i * 2] = alpha[i * 2 + 1] = fading * 0.65;
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.aAlpha.needsUpdate = true;
    }
  };
}
var rocketDetailGeometry = null;
function rocketDetails(parent, index, silver, dark, cyan, heat) {
  if (!rocketDetailGeometry) rocketDetailGeometry = {
    box: keep(new T.BoxGeometry(1, 1, 1)), cylinder: keep(new T.CylinderGeometry(1, 1, 1, 8)),
    lens: keep(new T.SphereGeometry(1, 8, 6)), nozzle: keep(new T.CylinderGeometry(1, 1.4, 1, 12, 1, true))
  };
  var stamp = new T.Object3D();
  function batch(name, geometry, material, items) {
    var parts = keep(new T.InstancedMesh(geometry, material, items.length)); parts.name = name; parts.frustumCulled = false;
    items.forEach(function (p, i) {
      stamp.position.set(p[0], p[1], p[2]); stamp.scale.set(p[3], p[4], p[5]); stamp.rotation.set(p[6] || 0, p[7] || 0, p[8] || 0); stamp.updateMatrix(); parts.setMatrixAt(i, stamp.matrix);
    }); parent.add(parts); return parts;
  }
  var plates = [], hatches = [], vents = [], pipes = [], couplings = [], windows = [], frames = [], ribs = [], lights = [], chambers = [];
  for (var side = 0; side < 8; side++) {
    var a = side / 8 * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
    for (var row = 0; row < 3; row++) {
      var y = -8.8 + row * 7.7, radius = row === 0 ? 4.73 : 4.54;
      plates.push([sx * radius, y, sz * radius, 2.8, 6.8, .16, 0, a]);
      hatches.push([sx * (radius + .1), y - 2, sz * (radius + .1), .72, .22, .06, 0, a]);
    }
    frames.push([sx * 4.53, 9.2, sz * 4.53, .83, .85, .22, Math.PI / 2, 0, -a]);
    windows.push([sx * 4.74, 9.2, sz * 4.74, .55, .56, .11, Math.PI / 2, 0, -a]);
    lights.push([sx * 5.02, -11.5, sz * 5.02, .24, .8, .12, 0, a]);
    for (var v = 0; v < 5; v++) vents.push([sx * 5.45, -19 + v * .65, sz * 5.45, 1.8, .17, .14, 0, a]);
    if (side % 2 === 0) {
      pipes.push([sx * 4.98, -.7, sz * 4.98, .19, 18.5, .19]);
      for (var join = 0; join < 5; join++) couplings.push([sx * 4.98, -9 + join * 4.3, sz * 4.98, .3, .34, .3]);
    }
  }
  for (var engine = 0; engine < 3; engine++) {
    var ea = engine * Math.PI * 2 / 3, x = Math.cos(ea) * 2.5, z = Math.sin(ea) * 2.5;
    chambers.push([x, -20.4, z, .95, 2, .95]);
    for (var ring = 0; ring < 6; ring++) ribs.push([x, -21.3 - ring * .42, z, 1.12 + ring * .11, .11, 1.12 + ring * .11]);
  }
  batch('rocket-interlocking-armor', rocketDetailGeometry.box, silver, plates);
  batch('rocket-service-hatches', rocketDetailGeometry.box, dark, hatches);
  batch('rocket-thermal-louvers', rocketDetailGeometry.box, dark, vents);
  batch('rocket-exposed-feed-lines', rocketDetailGeometry.cylinder, silver, pipes);
  batch('rocket-feed-line-clamps', rocketDetailGeometry.cylinder, dark, couplings);
  batch('rocket-armored-window-frames', rocketDetailGeometry.cylinder, dark, frames);
  batch('rocket-optical-windows', rocketDetailGeometry.cylinder, cyan, windows);
  batch('rocket-status-lamps', rocketDetailGeometry.box, cyan, lights);
  batch('rocket-nozzle-cooling-ribs', rocketDetailGeometry.cylinder, dark, ribs);
  batch('rocket-combustion-chambers', rocketDetailGeometry.nozzle, heat, chambers);
  var flaps = [], verniers = [], vernierMat = basic(0xbbeeff, 0);
  var flapGeo = keep(new T.BoxGeometry(3.1, 2.5, .24)), jetGeo = keep(new T.ConeGeometry(.45, 2.4, 8, 1, true));
  for (var f = 0; f < 4; f++) {
    var fa = f * Math.PI / 2, hinge = new T.Group(); hinge.position.set(Math.cos(fa) * 8.4, -17, -Math.sin(fa) * 8.4); hinge.rotation.y = fa; parent.add(hinge);
    var flap = new T.Mesh(flapGeo, silver); flap.position.x = 1.1; hinge.add(flap); flaps.push(hinge);
    var control = new T.Group(); control.position.set(Math.sin(fa) * 5.1, 12.5, Math.cos(fa) * 5.1); control.rotation.y = fa; parent.add(control);
    mesh(control, new T.BoxGeometry(1.1, 1.6, 1.1), dark);
    mesh(control, new T.CylinderGeometry(.28, .36, .5, 8), silver, 0, 0, .7).rotation.x = Math.PI / 2;
    var jet = new T.Mesh(jetGeo, vernierMat); jet.position.z = 2; jet.rotation.x = Math.PI / 2; control.add(jet); verniers.push(jet);
  }
  mesh(parent, new T.CylinderGeometry(.08, .12, 5, 6), silver, 2, 22, 0).rotation.z = -.18;
  mesh(parent, new T.BoxGeometry(.16, 1.8, .8), dark, 2.45, 24.6, 0);
  var beacon = mesh(parent, new T.SphereGeometry(.28, 8, 6), cyan, 2.45, 25.7, 0);
  var detail = { flaps: flaps, verniers: verniers, vernierMat: vernierMat, beacon: beacon, enginePhase: index * 1.3 };
  return detail;
}
var hullTexture = null;
function rocketHullTexture() {
  if (hullTexture) return hullTexture;
  // Coque peinte : tôles rivetées, joints, bande bleue, suie de rentrée en bas.
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024; var c = cv.getContext('2d');
  c.fillStyle = '#e4eaec'; c.fillRect(0, 0, 512, 1024);
  for (var i = 0; i < 2600; i++) { c.fillStyle = 'rgba(' + (120 + (i * 37) % 60) + ',' + (130 + (i * 53) % 50) + ',140,' + (0.03 + (i % 7) * 0.006) + ')'; c.fillRect((i * 97) % 512, (i * 193) % 1024, 3 + i % 9, 2 + i % 5); }
  c.fillStyle = '#8a979e'; for (var y = 0; y < 1024; y += 128) c.fillRect(0, y, 512, 3);
  for (var row = 0; row < 8; row++) for (var x = (row % 2) * 32; x < 512; x += 64) c.fillRect(x, row * 128, 2, 128);
  c.fillStyle = '#6f7d85'; for (var ry = 0; ry < 1024; ry += 128) for (var rx = 4; rx < 512; rx += 16) { c.fillRect(rx, ry + 8, 2, 2); c.fillRect(rx, ry + 118, 2, 2); }
  c.fillStyle = '#1a2b3a'; c.fillRect(0, 300, 512, 34); c.fillRect(0, 760, 512, 18);
  c.fillStyle = '#2f8fd8'; c.fillRect(0, 336, 512, 10); c.fillRect(120, 380, 20, 360); c.fillRect(376, 380, 20, 360);
  c.save(); c.translate(240, 560); c.rotate(-Math.PI / 2); c.fillStyle = '#1a2b3a'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.fillText('AZUR', 0, 18); c.restore();
  var soot = c.createLinearGradient(0, 700, 0, 1024); soot.addColorStop(0, 'rgba(30,24,20,0)'); soot.addColorStop(1, 'rgba(30,24,20,.75)'); c.fillStyle = soot; c.fillRect(0, 700, 512, 324);
  for (var k = 0; k < 40; k++) { c.fillStyle = 'rgba(25,20,18,.25)'; c.fillRect((k * 131) % 512, 760 + (k * 71) % 200, 4, 60 + (k * 13) % 120); }
  hullTexture = keep(new T.CanvasTexture(cv)); hullTexture.anisotropy = 4; return hullTexture;
}
function makeRocket(index) {
  var g = new T.Group(); g.name = 'v27-rocket-' + (index + 1); group.add(g);
  var hull = keep(new T.MeshStandardMaterial({ map: rocketHullTexture(), roughness: 0.42, metalness: 0.22 })), silver = keep(new T.MeshStandardMaterial({ color: 0xb9c6cd, roughness: 0.32, metalness: 0.45 })), dark = keep(new T.MeshStandardMaterial({ color: 0x1b2a36, roughness: 0.55, metalness: 0.35 })), copper = metal(0xc18756, 0.38), cyan = basic(0x6adeff, 0.85);
  mesh(g, new T.CylinderGeometry(4.4, 4.8, 27, low ? 16 : 24), hull);
  mesh(g, new T.ConeGeometry(4.4, 12, low ? 16 : 24), silver, 0, 19.5, 0);
  mesh(g, new T.CylinderGeometry(3.3, 4.45, 2.4, 18), dark, 0, 14.8, 0);
  mesh(g, new T.CylinderGeometry(4.8, 5.4, 7, 18), dark, 0, -17, 0);
  for (var i = 0; i < 4; i++) mesh(g, new T.CylinderGeometry(4.58, 4.58, 0.38, 24), i === 0 ? copper : silver, 0, -10 + i * 7, 0);
  var fasteners = new T.InstancedMesh(keep(new T.SphereGeometry(.16, 6, 4)), silver, 48), bolt = new T.Object3D();
  for (var b = 0; b < fasteners.count; b++) {
    var angle = (b % 12) / 12 * Math.PI * 2;
    bolt.position.set(Math.cos(angle) * 4.65, -10 + Math.floor(b / 12) * 7, Math.sin(angle) * 4.65);
    bolt.updateMatrix(); fasteners.setMatrixAt(b, bolt.matrix);
  }
  g.add(fasteners);
  mesh(g, new T.CylinderGeometry(4.43, 4.43, .7, 24), dark, 0, 11.8, 0);
  var finShape = new T.Shape(); finShape.moveTo(0, 0); finShape.lineTo(0, -11); finShape.lineTo(6.5, -12.5); finShape.lineTo(6.5, -9); finShape.lineTo(0.7, 0); finShape.closePath();
  var finGeometry = keep(new T.ExtrudeGeometry(finShape, { depth: 0.65, bevelEnabled: false }));
  for (var j = 0; j < 4; j++) {
    var angle = j * Math.PI / 2, fin = new T.Mesh(finGeometry, dark); fin.position.set(Math.cos(angle) * 4.4, -6, -Math.sin(angle) * 4.4); fin.rotation.y = angle; g.add(fin);
    var rail = mesh(g, new T.BoxGeometry(0.65, 22, 0.5), dark, Math.sin(angle) * 4.7, 0, Math.cos(angle) * 4.7); rail.rotation.y = angle;
    var strip = mesh(g, new T.BoxGeometry(0.32, 5, 0.2), cyan, Math.sin(angle) * 4.98, 7, Math.cos(angle) * 4.98); strip.rotation.y = angle;
    mesh(g, new T.BoxGeometry(0.65, 1.1, 0.5), copper, Math.sin(angle) * 4.98, -6, Math.cos(angle) * 4.98).rotation.y = angle;
  }
  var canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128; var ctx = canvas.getContext('2d'); ctx.fillStyle = '#c1d0d5'; ctx.fillRect(0, 0, 256, 128); ctx.fillStyle = '#152431'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('0' + (index + 1), 128, 80); ctx.font = '14px sans-serif'; ctx.fillText('AZUR / HORIZONS', 128, 108);
  var label = keep(new T.CanvasTexture(canvas)), labelMat = keep(new T.MeshStandardMaterial({ map: label, roughness: 0.6 }));
  for (var face = 0; face < 2; face++) { var badge = mesh(g, new T.PlaneGeometry(5.7, 2.85), labelMat, 0, 2, face ? -4.83 : 4.83); badge.rotation.y = face * Math.PI; }
  var checkerCanvas = document.createElement('canvas'); checkerCanvas.width = 128; checkerCanvas.height = 32; var c = checkerCanvas.getContext('2d'); for (var x = 0; x < 16; x++) for (var y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#dce8eb' : '#152431'; c.fillRect(x * 8, y * 8, 8, 8); }
  var checker = keep(new T.CanvasTexture(checkerCanvas)); mesh(g, new T.CylinderGeometry(5.42, 5.42, 3, 20), new T.MeshStandardMaterial({ map: checker, roughness: 0.5 }), 0, -17, 0);
  var engine = new T.Group(); engine.name = 'v31-gimballed-engine'; g.add(engine);
  var heat = keep(new T.MeshStandardMaterial({ color: 0x3d6578, roughness: 0.25, metalness: 0.7, emissive: 0x50baff, emissiveIntensity: 0 }));
  for (var e = 0; e < 3; e++) { var a = e * Math.PI * 2 / 3; mesh(engine, new T.CylinderGeometry(1.2, 1.8, 3.6, 12, 1, true), silver, Math.cos(a) * 2.5, -22, Math.sin(a) * 2.5); mesh(engine, new T.TorusGeometry(1.7, 0.15, 5, 16), heat, Math.cos(a) * 2.5, -23.8, Math.sin(a) * 2.5).rotation.x = Math.PI / 2; }
  var flameMat = keep(new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, clipping: true,
    uniforms: { time: { value: 0 }, thrust: { value: 0 } },
    vertexShader: '#include <clipping_planes_pars_vertex>\nvarying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.x+=sin(uv.y*19.-time*21.)*uv.y*.36;p.z+=cos(uv.y*17.-time*23.)*uv.y*.36;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;\n#include <clipping_planes_vertex>\n}',
    fragmentShader: '#include <clipping_planes_pars_fragment>\nvarying vec2 vUv;uniform float time;uniform float thrust;' + noiseGLSL + 'void main(){\n#include <clipping_planes_fragment>\nfloat n=fbm(vec3(vUv.x*12.,vUv.y*25.-time*8.,time*.8));float turbulence=.55+.45*n;float diamond=pow(max(0.,cos(vUv.y*49.-time*2.)),12.)*(1.-vUv.y);float a=smoothstep(0.,.025,vUv.y)*(1.-smoothstep(.65,1.,vUv.y));vec3 c=mix(vec3(.63,.9,1.),vec3(1.,.23,.04),smoothstep(.1,.85,vUv.y));c+=vec3(.7,.85,1.)*diamond*.5;gl_FragColor=vec4(c,a*turbulence*thrust*.88);}' }));
  var flame = mesh(engine, new T.ConeGeometry(4.1, 40, low ? 12 : 20, 8, true), flameMat, 0, -44, 0); flame.rotation.z = Math.PI;
  // Cœur du jet : dard blanc-bleu très lumineux au centre du panache.
  var coreMat = keep(new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, clipping: true, uniforms: { time: { value: 0 }, thrust: { value: 0 } },
    vertexShader: '#include <clipping_planes_pars_vertex>\nvarying vec2 vUv;void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <clipping_planes_vertex>\n}',
    fragmentShader: '#include <clipping_planes_pars_fragment>\nvarying vec2 vUv;uniform float time;uniform float thrust;void main(){\n#include <clipping_planes_fragment>\nfloat a=smoothstep(0.,.05,vUv.y)*(1.-smoothstep(.25,1.,vUv.y));float flick=.85+.15*sin(time*53.+vUv.y*30.);vec3 c=mix(vec3(1.,1.,1.),vec3(.55,.8,1.),vUv.y);gl_FragColor=vec4(c,a*thrust*flick*.95);}' }));
  var core = mesh(engine, new T.ConeGeometry(2.2, 22, 12, 1, true), coreMat, 0, -35, 0); core.rotation.z = Math.PI; core.name = 'rocket-jet-core';
  var engineJets = [], jetGeometry = keep(new T.ConeGeometry(1.5, 14, 10, 5, true));
  for (var jetIndex = 0; jetIndex < 3; jetIndex++) {
    var ja = jetIndex * Math.PI * 2 / 3, jetMat = keep(flameMat.clone()); jetMat.uniforms.thrust.value = 0;
    var jet = mesh(engine, jetGeometry, jetMat, Math.cos(ja) * 2.5, -30.8, Math.sin(ja) * 2.5); jet.rotation.z = Math.PI; jet.name = 'rocket-independent-exhaust-' + jetIndex; engineJets.push(jet);
  }
  var mechanics = rocketDetails(g, index, silver, dark, cyan, heat);
  var halo = sprite(engine, 0x85cfff, 25, 0); halo.position.y = -24;
  var diamonds = [], diamondMat = basic(0xbbeeff, 0);
  for (var d = 0; d < (low ? 3 : 5); d++) { var diamond = mesh(engine, new T.TorusGeometry(1, 0.09, 4, 12), diamondMat, 0, -28 - d * 5.1, 0); diamond.rotation.x = Math.PI / 2; diamonds.push(diamond); }
  var boosters = [];
  if (index === 0) for (var side = -1; side <= 1; side += 2) {
    var pod = new T.Group(); pod.name = 'v31-separable-booster'; pod.position.set(side * 6.5, -4, 0); g.add(pod);
    mesh(pod, new T.CylinderGeometry(1.5, 1.8, 17, 12), silver); mesh(pod, new T.ConeGeometry(1.5, 4, 12), dark, 0, 10.5, 0); mesh(pod, new T.CylinderGeometry(1.4, 2, 2, 10), copper, 0, -9.5, 0);
    for (var collar = 0; collar < 3; collar++) mesh(pod, new T.CylinderGeometry(1.68, 1.68, .23, 12), dark, 0, -6 + collar * 6, 0);
    mesh(pod, new T.BoxGeometry(.22, 13, .18), cyan, 0, 0, 1.72);
    mesh(pod, new T.BoxGeometry(.5, 12, .4), dark, side * .7, 0, 1.6);
    mesh(pod, new T.BoxGeometry(2.5, .6, 1.4), silver, -side * 1.4, 4.5, 0);
    mesh(pod, new T.BoxGeometry(2.5, .6, 1.4), silver, -side * 1.4, -5, 0);
    mesh(pod, new T.CylinderGeometry(.82, 1.3, 1.7, 10, 1, true), heat, 0, -11.1, 0);
    boosters.push({ mesh: pod, side: side, dropped: false, origin: V(0, 0, 0), at: 0 });
  }
  return { group: g, core: core, coreMat: coreMat, roll: index * 0.9, engine: engine, engineJets: engineJets, mechanics: mechanics, heat: heat, diamonds: diamonds, diamondMat: diamondMat, boosters: boosters, flame: flame, flameMat: flameMat, halo: halo, trail: makeTrail(0x69c7f5), direction: V(0, 1, 0), lastPos: V(0, 0, 0), active: false, throttle: 0, destroyed: false, smokeCredit: 0, sparkCredit: 0, paths: [], convergenceFrom: V(0, 0, 0), formation: V(0, 0, 0), escapeFrom: V(0, 0, 0) };
}
/* Bruit de valeur 3D côté JS : sculpte la roche une seule fois à la création. */
function jhash(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function jnoise(x, y, z) {
  var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  function L(a, b, t) { return a + (b - a) * t; }
  return L(L(L(jhash(ix, iy, iz), jhash(ix + 1, iy, iz), fx), L(jhash(ix, iy + 1, iz), jhash(ix + 1, iy + 1, iz), fx), fy),
    L(L(jhash(ix, iy, iz + 1), jhash(ix + 1, iy, iz + 1), fx), L(jhash(ix, iy + 1, iz + 1), jhash(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
function jfbm(x, y, z) { return 0.53 * jnoise(x, y, z) + 0.27 * jnoise(x * 2.03, y * 2.03, z * 2.03) + 0.13 * jnoise(x * 4.1, y * 4.1, z * 4.1) + 0.07 * jnoise(x * 8.3, y * 8.3, z * 8.3); }
/* Roche irrégulière réutilisable (fragments, rochers) : icosaèdre bosselé. */
function rockGeometry(detail, rough, seed) {
  var g = new T.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new T.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    var k = 1 + (jfbm(v.x * 1.7 + seed, v.y * 1.7, v.z * 1.7 - seed) - 0.5) * rough * 2;
    p.setXYZ(i, v.x * k * 1.15, v.y * k * 0.82, v.z * k);
  }
  g.computeVertexNormals(); return keep(g);
}
/* Réseau de fissures cellulaire (distance aux bords de Voronoï). */
var cellGLSL = 'vec3 ch3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}' +
  'float cellEdge(vec3 p){vec3 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(float(x),float(y),float(z));vec3 r=g+ch3(i+g)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(d2)-sqrt(d1);}';
function makeMeteor() {
  var g = new T.Group(); g.name = 'v65-meteor'; group.add(g);
  var MR = 66; // v76 : météorite plus grosse (~150 m)
  var geometry = keep(new T.IcosahedronGeometry(MR, low ? 3 : 4)), pos = geometry.attributes.position;
  var craterAxes = [];
  for (var c = 0; c < 11; c++) craterAxes.push({ axis: V(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize(), size: 60 + random() * 160, depth: 0.05 + random() * 0.09 });
  function sculpt(pos) {
  for (var i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i); var n = tmp.clone().normalize();
    // Masse principale bosselée + arêtes vives (bruit « ridged ») + grain fin.
    var ridge = 1 - Math.abs(jnoise(n.x * 3.1 + 7, n.y * 3.1, n.z * 3.1) * 2 - 1);
    var k = 1 + (jfbm(n.x * 1.25 + 3, n.y * 1.25, n.z * 1.25) - 0.5) * 0.62 + ridge * ridge * 0.07 + (jnoise(n.x * 13, n.y * 13, n.z * 13) - 0.5) * 0.025;
    craterAxes.forEach(function (cr) { var d = 1 - n.dot(cr.axis); k -= cr.depth * Math.exp(-d * cr.size); k += cr.depth * 0.38 * Math.exp(-Math.pow(d - 1.6 / cr.size, 2) * cr.size * cr.size * 0.6); });
    // Face avant usée par l'entrée atmosphérique, arrière déchiquetée.
    var front = Math.max(0, -n.y * 0.6 - n.x * 0.4);
    k -= front * front * 0.06;
    tmp.copy(n).multiplyScalar(MR * k); tmp.x *= 1.16; tmp.y *= 0.94; tmp.z *= 0.88; pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  }
  sculpt(pos); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  // Coque de chaleur : même silhouette, maillage plus léger (simple halo additif).
  var shellGeo = keep(new T.IcosahedronGeometry(MR, 2)); sculpt(shellGeo.attributes.position); shellGeo.computeVertexNormals();
  // Basalte calciné : grain, strates, suie près des fissures, et FISSURES DE
  // MAGMA émissives (réseau cellulaire à deux échelles) qui battent comme un
  // cœur. uFrost teinte le tout de givre bleuté tant que le temps est figé.
  var rockU = { uTime: { value: 0 }, uHeat: { value: 0.7 }, uFrost: { value: 1 }, uBeat: { value: 0 } };
  var rockMat = keep(new T.MeshStandardMaterial({ color: 0x3a312c, roughness: 0.94, metalness: 0.06 }));
  var cheap = low ? '1' : '0';
  rockMat.onBeforeCompile = function (shader) {
    Object.keys(rockU).forEach(function (k) { shader.uniforms[k] = rockU[k]; });
    shader.vertexShader = 'varying vec3 vBasalt;varying vec3 vBN;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBasalt=position;vBN=normal;');
    shader.fragmentShader = 'varying vec3 vBasalt;varying vec3 vBN;uniform float uTime,uHeat,uFrost,uBeat;\n' + noiseGLSL + '\n' + cellGLSL + '\n' +
      'float magma(vec3 p){\n#if ' + cheap + '\nreturn 1.-smoothstep(.012,.05,abs(fbm(p*.11)-.48));\n#else\nfloat w=.05+.06*noise(p*.09);float a=1.-smoothstep(0.,w,cellEdge(p*.06));float b=(1.-smoothstep(.012,.04,abs(fbm(p*.2+3.1)-.48)))*.5;return max(a,b);\n#endif\n}\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' +
      'float grain=fbm(vBasalt*.42);float strata=sin(vBasalt.y*.8+noise(vBasalt*.15)*9.);float mg=magma(vBasalt);' +
      'float soot=smoothstep(.0,.9,mg)*.8;diffuseColor.rgb*=.5+grain*.75+strata*.06;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.07,.045,.035),soot*.75);' +
      'float pits=smoothstep(.72,.95,grain);diffuseColor.rgb*=1.-pits*.3;' +
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.3,.42,.55),uFrost*smoothstep(.45,.8,grain)*.3);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' +
      'float n0=noise(vBasalt*.8);vec3 bg=vec3(noise(vBasalt*.8+vec3(.12,0.,0.)),noise(vBasalt*.8+vec3(0.,.12,0.)),n0)-vec3(n0);normal=normalize(normal+bg*.9);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
      'float glowK=pow(mg,1.4);float flick=.82+.18*sin(uTime*2.3+grain*14.)+uBeat*.6;' +
      'float hot=smoothstep(.55,1.,mg);vec3 lavaC=mix(vec3(.55,.05,.01),vec3(1.,.42,.06),smoothstep(.15,.7,mg));lavaC=mix(lavaC,vec3(1.,.78,.4),hot*.45);' +
      'vec3 frostC=mix(lavaC,vec3(.35,.6,1.),uFrost*.18);' +
      'vec3 vd=normalize(vViewPosition);float rim=pow(1.-abs(dot(normal,vd)),3.);' +
      'totalEmissiveRadiance+=frostC*glowK*uHeat*flick*1.05+vec3(1.,.28,.05)*rim*uHeat*.18*(1.-uFrost)+vec3(.45,.75,1.)*rim*uFrost*.22;');
  };
  var rock = new T.Mesh(geometry, rockMat); rock.name = 'meteor-basalt'; g.add(rock);
  // Halo de chaleur additif juste au-dessus de la roche (faux bloom des fissures).
  var lavaMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { time: { value: 0 }, heat: { value: 0.6 }, frost: { value: 1 } }, vertexShader: surfaceVertex,
    fragmentShader: '#include <clipping_planes_pars_fragment>\nvarying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float time;uniform float heat;uniform float frost;' + noiseGLSL + 'void main(){\n#include <clipping_planes_fragment>\nfloat n=fbm(vP*.07+vec3(0.,time*.05,0.));float bloom=pow(smoothstep(.35,.75,n),2.);float fres=pow(1.-abs(dot(normalize(vN),normalize(vView))),2.6);float pulse=.8+.2*sin(time*2.3+n*9.);vec3 c=mix(vec3(1.,.26,.04),vec3(.55,.85,1.),frost*.55);gl_FragColor=vec4(c,(bloom*.16+fres*.42)*heat*pulse);}' }));
  lavaMat.clipping = true;
  var lava = new T.Mesh(shellGeo, lavaMat); lava.scale.setScalar(1.035); g.add(lava);
  var halo = sprite(g, 0xff6223, 165, 0.28), fragments = [];
  // Ceinture de débris figés : vrais blocs de roche (géométrie sculptée), dont
  // certains encore incandescents.
  var fragmentGeo = rockGeometry(1, 0.32, 5.3), fragmentMat = keep(new T.MeshStandardMaterial({ color: 0x40352f, roughness: 0.95, metalness: 0.05, flatShading: true }));
  var emberMat = keep(new T.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9, emissive: 0xff5a14, emissiveIntensity: 0.9, flatShading: true }));
  for (var f = 0; f < (low ? 10 : 24); f++) {
    var r = 68 + random() * 40, a = random() * Math.PI * 2, m = new T.Mesh(fragmentGeo, f % 4 === 0 ? emberMat : fragmentMat);
    var size = 1.6 + Math.pow(random(), 2) * 7; m.scale.set(size, size * (0.7 + random() * 0.5), size * (0.8 + random() * 0.4)); g.add(m);
    fragments.push({ mesh: m, radius: r, angle: a, height: (random() - 0.5) * 70, speed: (0.03 + random() * 0.07) * (f % 3 ? 1 : -1), tilt: random() * 6 });
  }
  // Poussière en orbite (points), figée avec le reste pendant la stase.
  var dustCount = low ? 160 : 520, dustPos = new Float32Array(dustCount * 3), dustSeed = new Float32Array(dustCount * 3), dustGeo = keep(new T.BufferGeometry());
  for (var d = 0; d < dustCount; d++) { dustSeed[d * 3] = random() * Math.PI * 2; dustSeed[d * 3 + 1] = 54 + Math.pow(random(), 0.6) * 70; dustSeed[d * 3 + 2] = (random() - 0.5) * 2; }
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3).setUsage(T.DynamicDrawUsage));
  var dustMat = keep(new T.PointsMaterial({ color: 0xffb27a, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false }));
  var dust = new T.Points(dustGeo, dustMat); dust.frustumCulled = false; g.add(dust);
  var ring = mesh(g, new T.TorusGeometry(105, 0.42, 6, 96), basic(0x59c9ff, 0.6)); ring.rotation.x = Math.PI / 2;
  var ring2 = mesh(g, new T.TorusGeometry(114, 0.22, 6, 96), basic(0x9edfff, 0.35)); ring2.rotation.x = 1.1; ring2.rotation.z = 0.4;
  // BULLE TEMPORELLE (Saison X) : la météorite est figée dans une sphère de
  // temps arrêté — facettes cristallines, reflets qui balaient, et elle VOLE
  // EN ÉCLATS quand les fusées libèrent la roche.
  var bubbleMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 1 }, charge: { value: 0 }, shatter: { value: 0 } }, vertexShader: surfaceVertex,
    fragmentShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float time,alpha,charge,shatter;' + noiseGLSL +
      'void main(){vec3 p=normalize(vP);float fres=pow(1.-abs(dot(normalize(vN),normalize(vView))),3.);' +
      'float facet=1.-smoothstep(0.,.045,abs(fbm(p*6.)-.5));' +
      'float sweep=pow(max(0.,sin(p.y*3.+p.x*2.-time*.6)),24.);float rip=pow(max(0.,sin(length(p.xz)*20.-time*2.)),30.)*charge;' +
      'float crack=0.;if(charge>.4)crack=(1.-smoothstep(.0,.05+.1*shatter,abs(fbm(p*5.)-.5)))*(charge-.4)*1.6;' +
      'vec3 c=mix(vec3(.35,.7,1.),vec3(.85,.97,1.),facet*.5+sweep);c+=vec3(1.,.95,.85)*crack;' +
      'float a=(fres*.42+facet*(.08+fres*.3)+sweep*.12+rip*.2+crack*.5)*alpha*(1.-shatter);gl_FragColor=vec4(c,a);}' }));
  var bubble = mesh(g, new T.SphereGeometry(153, low ? 28 : 40, low ? 18 : 26), bubbleMat); bubble.name = 'meteor-time-bubble';
  var sheathMat = keep(new T.ShaderMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, uniforms: { heat: { value: 0 }, time: { value: 0 } }, vertexShader: surfaceVertex,
    fragmentShader: '#include <clipping_planes_pars_fragment>\nvarying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float heat;uniform float time;' + noiseGLSL + 'void main(){\n#include <clipping_planes_fragment>\nfloat f=pow(1.-abs(dot(normalize(vN),normalize(vView))),2.2);float n=fbm(vP*.06+vec3(0.,-time*1.6,0.));float flame=.55+.45*n+.2*sin(vP.y*.25-time*6.);vec3 c=mix(vec3(1.,.15,.015),vec3(1.,.86,.45),f*n);gl_FragColor=vec4(c,f*heat*flame*.75);}' }));
  sheathMat.clipping = true; var sheath = mesh(g, new T.SphereGeometry(78, low ? 20 : 36, 18), sheathMat);
  // Queue de feu : panache turbulent (bruit), cœur blanc, franges rouges.
  // Pendant la stase, son temps est FIGÉ et teinté de givre.
  var fireMat = keep(new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false,
    uniforms: { time: { value: 0 }, heat: { value: 0 }, frost: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vPos;uniform float time;void main(){vUv=uv;vec3 p=position;vPos=p;float taper=uv.y;float wave=sin(p.y*.06+time*5.);p.x+=wave*taper*9.;p.z+=cos(p.y*.045-time*4.)*taper*7.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: 'varying vec2 vUv;varying vec3 vPos;uniform float time;uniform float heat;uniform float frost;' + noiseGLSL + 'void main(){float n=fbm(vec3(vUv.x*9.,vUv.y*6.-time*2.4,time*.3));float n2=noise(vec3(vUv.x*22.,vUv.y*14.-time*4.,1.7));float ribbon=pow(max(0.,sin(vUv.x*44.+vUv.y*21.+n*6.-time*8.)),3.);float body=(1.-smoothstep(.1,1.,vUv.y))*smoothstep(0.,.06,vUv.y);float a=body*(.12+ribbon*.26+n*.34)*(.6+n2*.6)*heat;vec3 c=mix(vec3(1.,.72,.32),vec3(1.,.28,.03),smoothstep(0.,.45,vUv.y+n*.2));c=mix(c,vec3(.45,.08,.02),smoothstep(.45,1.,vUv.y));c=mix(c,vec3(.45,.7,1.)*(.6+n*.6),frost*.35);gl_FragColor=vec4(c,a*(1.-frost*.35));}' }));
  var fireGeo = new T.ConeGeometry(69, 345, low ? 12 : 28, 14, true); fireGeo.translate(0, 148, 0);
  var fireTail = mesh(g, fireGeo, fireMat); fireTail.visible = false;
  var light = new T.PointLight(0xff8b38, 2, 320, 2); g.add(light);
  // Arcs électriques bleus qui crépitent sur la roche figée dans la faille.
  var arcCount = low ? 4 : 10, arcSeg = 9, arcPos = new Float32Array(arcCount * arcSeg * 6), arcGeo = keep(new T.BufferGeometry());
  arcGeo.setAttribute('position', new T.BufferAttribute(arcPos, 3).setUsage(T.DynamicDrawUsage));
  var arcs = new T.LineSegments(arcGeo, keep(new T.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
  arcs.frustumCulled = false; arcs.visible = false; g.add(arcs);
  var chunks = [], chunkMat = keep(new T.MeshStandardMaterial({ color: 0x45332c, roughness: 0.92, emissive: 0xa5330b, emissiveIntensity: 0.9, flatShading: true }));
  for (var k = 0; k < (low ? 14 : 34); k++) {
    var chunk = new T.Mesh(fragmentGeo, chunkMat), angle = random() * Math.PI * 2, speed = 60 + random() * 130;
    chunk.visible = false; group.add(chunk); chunks.push({ mesh: chunk, vx: Math.cos(angle) * speed, vy: 50 + random() * 140, vz: Math.sin(angle) * speed, size: 3 + random() * 8 });
  }
  return { group: g, rock: rock, rockU: rockU, lava: lava, lavaMat: lavaMat, halo: halo, fragments: fragments, dust: dust, dustPos: dustPos, dustSeed: dustSeed, ring: ring, ring2: ring2, bubble: bubble, bubbleMat: bubbleMat, shatterAt: -1,
    trail: makeTrail(0xff7630), sheath: sheath, sheathMat: sheathMat, fireTail: fireTail, fireMat: fireMat, light: light, chunks: chunks, radius: geometry.boundingSphere.radius, visible: true, heat: 0.6, sparkCredit: 0, smokeCredit: 0,
    arcs: arcs, arcPos: arcPos, arcCount: arcCount, arcSeg: arcSeg, arcTimer: 0, suctionCredit: 0 };
}
function regenMeteorArcs(m, charge) {
  var R = m.radius, k = 0, px = 0, py = 0, pz = 0;
  for (var i = 0; i < m.arcCount; i++) {
    tmp.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    tmp2.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(0.55 + charge * 0.65).add(tmp).normalize();
    for (var s = 0; s <= m.arcSeg; s++) {
      var t = s / m.arcSeg, jitter = s > 0 && s < m.arcSeg ? (random() - 0.5) * 0.09 : 0;
      tmp3.copy(tmp).lerp(tmp2, t).normalize().multiplyScalar(R * (1.03 + Math.sin(t * Math.PI) * (0.1 + charge * 0.16) + jitter));
      if (s > 0) { m.arcPos[k++] = px; m.arcPos[k++] = py; m.arcPos[k++] = pz; m.arcPos[k++] = tmp3.x; m.arcPos[k++] = tmp3.y; m.arcPos[k++] = tmp3.z; }
      px = tmp3.x; py = tmp3.y; pz = tmp3.z;
    }
  }
  m.arcs.geometry.attributes.position.needsUpdate = true;
}
function makeZeroLattice(parent) {
  var lattice = new T.Group(); lattice.name = 'zero-fractured-crystalline-mantle'; parent.add(lattice);
  var panelGeometry = keep(new T.BufferGeometry()); panelGeometry.setAttribute('position', new T.Float32BufferAttribute([-2.6, -1.6, 0, 2.6, -1.6, 0, 0, 2.9, 0], 3)); panelGeometry.computeVertexNormals();
  var panelMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, stress: { value: 0 }, alpha: { value: 1 } },
    vertexShader: 'varying vec3 vP;void main(){vP=position;vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',
    fragmentShader: 'varying vec3 vP;uniform float time,stress,alpha;void main(){vec2 p=vP.xy;float left=abs(p.y-1.73*p.x-2.9)/2.;float right=abs(p.y+1.73*p.x-2.9)/2.;float bottom=abs(p.y+1.6);float edge=exp(-min(min(left,right),bottom)*14.);float flow=pow(max(0.,cos(p.y*4.-time*1.7)),20.);gl_FragColor=vec4(mix(vec3(.13,.48,.8),vec3(.68,.91,1.),edge),(.016+edge*(.18+stress*.28)+flow*.025)*alpha);}' }));
  var panels = keep(new T.InstancedMesh(panelGeometry, panelMat, low ? 40 : 80)); panels.instanceMatrix.setUsage(T.DynamicDrawUsage); panels.frustumCulled = false; lattice.add(panels);
  var mantle = [], stamp = new T.Object3D(), normal = V(0, 0, 1);
  for (var i = 0; i < panels.count; i++) {
    var y = 1 - 2 * (i + .5) / panels.count, a = i * 2.399963, h = Math.sqrt(1 - y * y), axis = V(Math.cos(a) * h, y, Math.sin(a) * h);
    mantle.push({ axis: axis, rotation: new T.Quaternion().setFromUnitVectors(normal, axis), phase: i * 1.37 });
  }
  var coilMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, stress: { value: 0 }, alpha: { value: 1 } }, vertexShader: portalVertex,
    fragmentShader: 'varying vec2 vUv;uniform float time,stress,alpha;void main(){float packets=pow(max(0.,cos(vUv.x*44.-time*(1.8+stress))),16.);float core=pow(max(0.,cos((vUv.y-.5)*6.28318)),4.);gl_FragColor=vec4(mix(vec3(.25,.65,1.),vec3(.84,.96,1.),packets),(.23+packets*.7)*(.4+core*.6)*alpha);}' }));
  var coils = [];
  for (var c = 0; c < 2; c++) {
    var points = [];
    for (var step = 0; step < 96; step++) {
      var k = step / 95, ca = k * Math.PI * 5 + c * Math.PI, y = (k * 2 - 1) * 22, r = 8 + Math.sin(k * Math.PI) * 15;
      points.push(V(Math.cos(ca) * r, y, Math.sin(ca) * r));
    }
    var coil = mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), low ? 96 : 160, .34, 5, false), coilMat); coil.name = 'zero-counterflow-plasma-' + c; coils.push(coil);
  }
  var nucleusMat = basic(0xbbeeff, .65), nucleus = mesh(parent, new T.IcosahedronGeometry(5.4, 1), nucleusMat); nucleus.name = 'zero-white-hot-singularity';
  return { group: lattice, panels: panels, panelMat: panelMat, mantle: mantle, dummy: stamp, coils: coils, coilMat: coilMat, nucleus: nucleus, nucleusMat: nucleusMat, phase: 0, impulse: 0 };
}
function updateZeroLattice(detail, dt, stress, alpha, resonance, afterRocket, afterImpact) {
  var reduced = motionPreference.matches;
  var drive = (1 + stress * 1.8) * (reduced ? .25 : 1);
  detail.phase += dt * drive;
  var beatPhase = (detail.phase * .4) % 1, beat = Math.exp(-Math.pow((beatPhase - .12) * 26, 2)) + .42 * Math.exp(-Math.pow((beatPhase - .31) * 22, 2));
  var shock = afterRocket >= 0 ? Math.exp(-afterRocket * 1.8) : 0;
  if (afterImpact >= 0) shock = Math.exp(-afterImpact * .8);
  detail.impulse += (shock - detail.impulse) * (1 - Math.exp(-dt * 12));
  var opening = 1 + stress * .075 + detail.impulse * .25;
  detail.group.rotation.set(Math.sin(detail.phase * .12) * .09, detail.phase * -.09, detail.phase * .035);
  detail.mantle.forEach(function (panel, i) {
    var radius = 29.1 * opening + Math.sin(detail.phase * .55 + panel.phase) * (.25 + stress * .65);
    detail.dummy.position.copy(panel.axis).multiplyScalar(radius); detail.dummy.quaternion.copy(panel.rotation);
    var size = (low ? 1.65 : 1.25) * (1 + beat * .035); detail.dummy.scale.setScalar(size); detail.dummy.updateMatrix(); detail.panels.setMatrixAt(i, detail.dummy.matrix);
  });
  detail.panels.instanceMatrix.needsUpdate = true;
  detail.panelMat.uniforms.time.value = detail.phase; detail.panelMat.uniforms.stress.value = stress; detail.panelMat.uniforms.alpha.value = alpha;
  detail.coilMat.uniforms.time.value = detail.phase; detail.coilMat.uniforms.stress.value = stress; detail.coilMat.uniforms.alpha.value = alpha;
  detail.coils.forEach(function (coil, i) { coil.rotation.set(i ? .3 : -.3, detail.phase * (i ? -.22 : .22), i ? .22 : -.22); coil.scale.setScalar(1 - stress * .08 + beat * .02); });
  detail.nucleus.rotation.set(detail.phase * .13, detail.phase * -.18, detail.phase * .08); detail.nucleus.scale.setScalar(1 + beat * .12 + stress * .3 + resonance * .1);
  if (detail.orbitRings) detail.orbitRings.forEach(function (ring, i) {
    ring.rotation.x += dt * (.18 + i * .08);
    ring.rotation.y -= dt * (.24 + i * .1);
    ring.scale.setScalar(1 + beat * (.04 + i * .018) + stress * .025);
  });
  detail.nucleusMat.opacity = (.5 + beat * .16 + stress * .15) * alpha;
}
function starTexture() {
  // Étoile de lumière : cœur blanc, 6 rayons fins et une longue traînée
  // horizontale (reflet d'objectif) — lisible de très loin.
  var cv = document.createElement('canvas'); cv.width = cv.height = 256; var c = cv.getContext('2d'), m = 128;
  var g = c.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(220,240,255,.85)'); g.addColorStop(0.3, 'rgba(120,190,255,.18)'); g.addColorStop(1, 'rgba(60,140,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 6; i++) { c.save(); c.translate(m, m); c.rotate(i * Math.PI / 3 + 0.26); var rg = c.createLinearGradient(0, 0, m, 0); rg.addColorStop(0, 'rgba(230,245,255,.9)'); rg.addColorStop(1, 'rgba(120,190,255,0)'); c.fillStyle = rg; c.beginPath(); c.moveTo(0, -2.2); c.lineTo(m, 0); c.lineTo(0, 2.2); c.fill(); c.restore(); }
  var hg = c.createLinearGradient(0, 0, 256, 0); hg.addColorStop(0, 'rgba(90,170,255,0)'); hg.addColorStop(0.5, 'rgba(210,235,255,.95)'); hg.addColorStop(1, 'rgba(90,170,255,0)');
  c.fillStyle = hg; c.fillRect(0, m - 1.5, 256, 3);
  return keep(new T.CanvasTexture(cv));
}
function makeZero() {
  var g = new T.Group(); g.name = 'v27-zero-point'; g.position.copy(center); group.add(g);
  var mat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, stress: { value: 0 }, alpha: { value: 1 } }, vertexShader: surfaceVertex,
    fragmentShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float time;uniform float stress;uniform float alpha;' + noiseGLSL + 'void main(){float fres=pow(1.-abs(dot(normalize(vN),normalize(vView))),2.3);vec3 p=normalize(vP)*3.;float n=fbm(p+vec3(time*.13,-time*.18,time*.09));float fil=pow(1.-smoothstep(.012,.08,abs(n-.46)),2.);float band=pow(max(0.,sin(p.y*5.+n*8.-time*(.7+stress))),16.);float crack=1.-smoothstep(.006,.022+stress*.018,abs(fbm(p*2.4)-.49));float pulse=.8+.2*sin(time*(2.+stress*4.)+p.y*2.);vec3 c=mix(vec3(.015,.12,.32),vec3(.25,.76,1.),fres);c+=vec3(.32,.75,1.)*(fil*.9+band*.4);c+=vec3(.8,.94,1.)*crack*stress*pulse*1.8;float caustic=pow(max(0.,sin(p.x*3.8+p.z*2.7+time*.5+n*7.)),18.);c+=vec3(.15,.5,.8)*caustic*.45;float vortex=pow(max(0.,cos(atan(p.z,p.x)*5.+p.y*4.-time*.8+n*3.)),20.);float lattice=pow(1.-smoothstep(.009,.04,abs(fbm(p*3.+vec3(-time*.08,time*.07,0.))-.5)),2.);c+=vec3(.38,.8,1.)*vortex*(.12+stress*.2);c+=vec3(.68,.91,1.)*lattice*stress*.42;gl_FragColor=vec4(c,(.34+fres*.56+fil*.10+crack*stress*.14)*alpha);}' }));
  mesh(g, new T.SphereGeometry(26, low ? 24 : 40, low ? 16 : 28), mat);
  var shellMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, stress: { value: 0 }, alpha: { value: 1 } }, vertexShader: surfaceVertex,
    fragmentShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float time;uniform float stress;uniform float alpha;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vView))),3.5);float sweep=pow(max(0.,sin(vP.y*.23+vP.x*.08-time*(.8+stress))),22.);gl_FragColor=vec4(.28,.7,1.,(f*(.3+stress*.2)+sweep*.055)*alpha);}' })), shell = mesh(g, new T.SphereGeometry(30, low ? 24 : 40, 24), shellMat);
  var halo = sprite(g, 0x389fff, 130, 0.28), arcs = [];
  for (var j = 0; j < 3; j++) { var pts = []; for (var i = 0; i < 58; i++) { var a = i / 57 * Math.PI * 1.65, r = 33 + j * 4; pts.push(V(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    var arc = mesh(g, new T.TubeGeometry(new T.CatmullRomCurve3(pts), 64, 0.24, 4, false), basic(0x83d9ff, 0.5)); arc.rotation.set(j * 0.9, j * 0.8, j * 1.2); arcs.push(arc);
  }
  var light = new T.PointLight(0x4abaff, 3, 240, 2); g.add(light);
  // Anneaux orbitaux : donnent au Point Zéro une silhouette plus lisible
  // pendant les impacts et rappellent son cœur en rotation.
  var orbitMat = basic(0x9edfff, 0.42), orbitRings = [];
  for (var orbit = 0; orbit < 3; orbit++) {
    var orbitRing = mesh(g, new T.TorusGeometry(39 + orbit * 5, 0.24 + orbit * 0.06, 6, 96), orbitMat);
    orbitRing.rotation.set(orbit * .62, orbit * .37, orbit * .51); orbitRings.push(orbitRing);
  }
  var innerMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, stress: { value: 0 }, alpha: { value: 1 } }, vertexShader: surfaceVertex,
    fragmentShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float time;uniform float stress;uniform float alpha;' + noiseGLSL + 'void main(){float n=fbm(normalize(vP)*5.+vec3(time*.21,-time*.34,time*.17));float flow=pow(1.-smoothstep(.01,.09,abs(n-.48)),2.);float f=pow(1.-abs(dot(normalize(vN),normalize(vView))),1.5);vec3 c=mix(vec3(.08,.35,.7),vec3(.72,.95,1.),flow*.8+stress*.16);gl_FragColor=vec4(c,(.45+flow*.4+f*.15)*alpha);}' }));
  var inner = mesh(g, new T.SphereGeometry(11, 28, 20), innerMat);
  var moteCount = low ? 80 : 180, motePositions = new Float32Array(moteCount * 3), moteGeo = keep(new T.BufferGeometry());
  moteGeo.setAttribute('position', new T.BufferAttribute(motePositions, 3).setUsage(T.DynamicDrawUsage));
  var moteMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { alpha: { value: 1 }, pixelScale: { value: 600 } },
    vertexShader: 'uniform float pixelScale;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(pixelScale/max(1.,-p.z),1.,14.);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'uniform float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.45,.82,1.,pow(1.-r,2.)*alpha);}' }));
  var motes = new T.Points(moteGeo, moteMat); motes.frustumCulled = false; g.add(motes);
  var fragments = new T.InstancedMesh(keep(new T.OctahedronGeometry(1)), keep(new T.MeshStandardMaterial({ color: 0xb2e6fa, emissive: 0x2e88ac, emissiveIntensity: 0.9, metalness: 0.45, roughness: 0.2, transparent: true, opacity: 0 })), low ? 12 : 28);
  fragments.instanceMatrix.setUsage(T.DynamicDrawUsage); fragments.frustumCulled = false; g.add(fragments);
  var crackPositions = new Float32Array((low ? 10 : 20) * 5 * 6), crackGeo = keep(new T.BufferGeometry()); crackGeo.setAttribute('position', new T.BufferAttribute(crackPositions, 3));
  var crackMat = keep(new T.LineBasicMaterial({ color: 0xbcefff, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false }));
  var cracks = new T.LineSegments(crackGeo, crackMat); cracks.frustumCulled = false; g.add(cracks);
  var surgeMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { alpha: { value: 0 } }, vertexShader: surfaceVertex,
    fragmentShader: 'varying vec3 vN;varying vec3 vView;uniform float alpha;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vView))),4.);gl_FragColor=vec4(.6,.85,1.,rim*alpha);}' }));
  var surge = mesh(group, new T.SphereGeometry(1, low ? 24 : 40, 20), surgeMat); surge.position.copy(center); surge.visible = false;
  var zoneMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, alpha: { value: 0 }, stress: { value: 0 }, hit: { value: 0 } }, vertexShader: surfaceVertex,
    fragmentShader: [
      'varying vec3 vN;varying vec3 vP;varying vec3 vView;uniform float time;uniform float alpha;uniform float stress;uniform float hit;', noiseGLSL,
      'void main(){vec3 p=normalize(vP);float rim=pow(1.-abs(dot(normalize(vN),normalize(vView))),4.);',
      'float n=fbm(p*6.+vec3(time*.07,-time*.12,time*.04));float fractures=pow(1.-smoothstep(.008,.036,abs(n-.48)),2.);',
      'float bands=pow(max(0.,sin(p.y*48.+n*5.-time*.9)),20.);float wave=exp(-abs(p.y-(1.-hit*2.))*55.)*hit;',
      'vec3 c=mix(vec3(.13,.35,.75),vec3(.65,.86,1.),stress);float a=rim*(.13+stress*.15)+fractures*stress*.045+bands*.025+wave*.3;',
      'gl_FragColor=vec4(c,a*alpha);}'
    ].join('\n') }));
  var zone = mesh(group, new T.SphereGeometry(1, low ? 24 : 40, low ? 16 : 28), zoneMat); zone.name = 'v31-zero-rift-zone'; zone.position.copy(center); zone.visible = false;
  var flare = new T.Sprite(keep(new T.SpriteMaterial({ map: starTexture(), color: 0xd6ecff, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })));
  flare.scale.set(200, 200, 1); flare.renderOrder = 5; g.add(flare);
  var lattice = makeZeroLattice(g);
  return { group: g, flare: flare, lattice: lattice, mat: mat, shell: shell, shellMat: shellMat, halo: halo, arcs: arcs, light: light, inner: inner, motes: motes, motePositions: motePositions, fragments: fragments, dummy: new T.Object3D(), cracks: cracks, crackPositions: crackPositions, surge: surge, surgeMat: surgeMat, zone: zone, zoneMat: zoneMat, radius: 26, destroyed: false };
}
function makeWave() {
  var g = new T.Group(); group.add(g); var mat = basic(0x9fd5ff, 0), rings = [];
  for (var i = 0; i < 2; i++) { var ring = mesh(g, new T.TorusGeometry(1, 0.007, 4, low ? 64 : 120), mat); ring.rotation.x = i === 0 ? Math.PI / 2 : 0.9; rings.push(ring); }
  g.visible = false; return { group: g, mat: mat, age: 99, duration: 1, radius: 1 };
}
function wave(p, radius, duration, color) {
  var w = waves.find(function (v) { return v.age >= v.duration; }) || waves[0]; w.group.position.copy(p); w.group.visible = true; w.age = 0; w.duration = duration; w.radius = radius; w.mat.color.setHex(color || 0x9bdcff); w.mat.opacity = 0.7;
}
function bezier(out, a, b, c, d, t) { var k = 1 - t; return out.copy(a).multiplyScalar(k * k * k).addScaledVector(b, 3 * k * k * t).addScaledVector(c, 3 * k * t * t).addScaledVector(d, t * t * t); }
function orientRocket(r, position, forward, visible, thrust) {
  r.active = visible && !r.destroyed; r.group.visible = r.active; r.throttle = thrust;
  if (!r.active) return;
  r.group.position.copy(position);
  if (forward.lengthSq() > 0.001) r.direction.copy(forward).normalize();
  r.group.quaternion.setFromUnitVectors(up, r.direction);
  var turn = r.lastDirection ? r.lastDirection.x * r.direction.z - r.lastDirection.z * r.direction.x : 0;
  var bankTarget = Math.max(-0.28, Math.min(0.28, turn * 0.13 / Math.max(0.001, frameDt)));
  r.bank = (r.bank || 0) + (bankTarget - (r.bank || 0)) * (1 - Math.exp(-frameDt * 8));
  r.roll += frameDt * (0.15 + thrust * 0.35); r.group.rotateY(r.bank + r.roll);
  if (thrust > 0.6 && E.state === 'firstrocket' && E.tState < 9) { var shake = (1 - E.tState / 9) * 0.35; r.group.position.x += (random() - 0.5) * shake; r.group.position.z += (random() - 0.5) * shake; } if (!r.lastDirection) r.lastDirection = r.direction.clone(); else r.lastDirection.copy(r.direction);
}
function formationPoint(out, index, turn) { var a = index / 7 * Math.PI * 2 + turn; return out.set(frozen.x + Math.cos(a) * 155, frozen.y + Math.sin(a * 2) * 75, frozen.z + Math.sin(a) * 155); }
function makePaths() {
  for (var i = 0; i < 7; i++) { var r = rockets[i], delay = i * 0.52; r.paths = [];
    for (var j = 0; j < 5; j++) { var from = portals[(i + j * 3) % 6], to = portals[(i + j * 3 + 3) % 6], start = delay + [0, 6.2, 11.8, 16.6, 20.8][j], end = j === 4 ? 28 : start + [5.65, 5.0, 4.2, 3.65][j];
      var a = from.pos.clone(), d = to.pos.clone(), b = a.clone().multiplyScalar(0.56), c = d.clone().multiplyScalar(0.7); b.y = center.y + (j === 0 ? 120 + i * 11 : 300 + j * 55 + i * 14); c.y = center.y + 760 + (j % 2 ? -140 : 70);
      b.x += (i % 2 ? 1 : -1) * (90 + j * 25); c.z += (j % 2 ? -1 : 1) * 110;
      if (j === 4) { d.copy(formationPoint(V(0, 0, 0), i, 0)).add(V((i - 3) * 35, 120, -320)); c.copy(d).add(V(-180, 200, -150)); }
      var curve = flight(a, b, c, d);
      var exitNormal = curve.getTangentAt(0), entryNormal = curve.getTangentAt(1).negate();
      r.paths.push({ curve: curve, a: a, b: b, c: c, d: d, start: start, end: end, from: from, to: to, enters: j !== 4,
        exitPlane: new T.Plane(exitNormal, -exitNormal.dot(a)), entryPlane: new T.Plane(entryNormal, -entryNormal.dot(d)) });
    }
  }
}
function makeCapturePasses() {
  capturePasses = [];
  var axis = front.normal.clone().negate(), sideAxis = V(0, 0, 0).crossVectors(axis, up).normalize();
  var start = E.TIMELINE.loop[0] + 0.28, limit = E.TIMELINE.acceleration[0] + 28.5;
  for (var n = 0; n < 96; n++) {
    var duration = Math.max(0.95, 3.3 * Math.pow(0.94, n));
    if (start + duration > limit) break;
    var side = n % 2 === 0 ? -1 : 1, source = side < 0 ? rear : rearOther, width = side * (170 + n % 3 * 12);
    capturePasses.push({ order: n, rocket: n % 7, side: side, start: start, end: start + duration, source: source,
      a: source.pos.clone(), b: frozen.clone().addScaledVector(axis, -185).addScaledVector(sideAxis, width).add(V(0, Math.sin(n * 1.7) * 50, 0)),
      c: frozen.clone().addScaledVector(axis, 170).addScaledVector(sideAxis, width * (0.76 + (n % 3) * 0.12)).add(V(0, Math.cos(n * 1.4) * 42, 0)), d: front.pos.clone().addScaledVector(axis, 36) });
    start += Math.max(0.48, 3.9 * Math.pow(0.91, n));
  }
  capturePasses.forEach(function (p) { p.curve = flight(p.a, p.b, p.c, p.d); });
  E.captureChoreography = capturePasses.map(function (p) { return { order: p.order, rocket: p.rocket, side: p.side, start: p.start, end: p.end }; });
  publish('capturefocus', frozen.clone().lerp(front.pos, 0.28));
}
function flight(a, b, c, d) {
  var curve = new T.CubicBezierCurve3(a.clone(), b.clone(), c.clone(), d.clone());
  curve.arcLengthDivisions = 320; curve.updateArcLengths();
  return curve;
}
function buildDescent() {
  var start = E.TIMELINE.greatrift[0] + 2, hit = E.TIMELINE.impact[0] + 2.4;
  var destination = V(0.12, 1, 0.065).normalize().multiplyScalar(meteor.radius + zero.radius - 0.3).add(center);
  var origin = arrival.pos.clone().add(V(0, meteor.radius + 6, 0));
  var curve = flight(origin, center.clone().add(V(-95, 1320, -52)), center.clone().add(V(68, 590, 37)), destination);
  descentKeys = [{ t: start, p: origin }, { t: hit, p: destination }];
  meteor.descent = curve;
  E.meteorFlight = { start: start, contact: hit, distance: curve.getLength(), speed: curve.getLength() / (hit - start) };
}
function sampleDescent(out, time) {
  var start = descentKeys[0].t, end = descentKeys[1].t;
  return out.copy(meteor.descent.getPointAt(clamp((time - start) / (end - start))));
}
function enterPhase(state) {
  if (state === 'convergence') rockets.forEach(function (r) { r.convergenceFrom.copy(r.group.position); });
  if (state === 'acceleration') rockets.forEach(function (r) { r.formation.copy(r.group.position); });
  if (state === 'veeroff') rockets.forEach(function (r) { r.escapeFrom.copy(r.group.position); });
}
function updatePortals(dt, state) {
  portals.forEach(function (p) { p.target = 0; }); var ts = E.tState;
  if (state === 'firstrocket') portals[6].target = smooth((ts - 20.5) / 2);
  if (state === 'sixrockets') for (var i = 0; i < 6; i++) portals[i].target = 1;
  if (state === 'convergence') { front.target = 1; rear.target = rearOther.target = smooth((ts - 9.8) / 1); }
  if (state === 'loop' || state === 'acceleration') {
    front.target = state === 'acceleration' ? 1 - smooth((ts - 35.2) / 0.8) : 1;
    rear.target = rearOther.target = state === 'loop' ? 1 : 1 - smooth((ts - 28.5) / 1.2);
  }
  if (state === 'strike') portals[9].target = 1 - smooth((ts - 3.3) / 1.3);
  if (state === 'greatrift') arrival.target = smooth(ts / 2);
  if (state === 'meteorsix') arrival.target = 1 - smooth((ts - 1.0) / 2.3);
  if (state === 'veeroff') for (var e = 10; e < 16; e++) portals[e].target = smooth(ts / 0.8) * (1 - smooth((ts - 6.2) / 1.8));
  portals.forEach(function (p) {
    var wantsOpen = p.target > 0.04;
    if (wantsOpen && !p.wasTarget) { p.age = 0; p.pulse = Math.max(p.pulse, 0.65); E.emit('rift:open', { kind: p.kind, pos: p.pos, radius: p.radius }); }
    if (!wantsOpen && p.wasTarget) { p.pulse = 1; E.emit('rift:close', { kind: p.kind, pos: p.pos.clone() }); }
    p.wasTarget = wantsOpen; p.age += dt;
    p.anticipation = p === portals[6] && state === 'firstrocket' ? smooth((ts - 18.4) / 1.8) * (1 - smooth((ts - 21.5) / 1.2)) : p === arrival && state === 'greatrift' ? 1 - smooth(ts / 2.4) : 0;
    p.opening += (p.target - p.opening) * (1 - Math.exp(-dt * (p.target > p.opening ? 5 : 3.8))); p.pulse = Math.max(0, p.pulse - dt * 1.65);
    // Le ciel cède par à-coups : la déchirure saute de cran en cran, chaque cran claque.
    var shown = p.opening;
    if (p.target > p.opening + 0.02) {
      var notch = Math.floor(p.opening * 7);
      shown = Math.min(1, notch / 7 + (p.opening - notch / 7) * 0.3);
      if (notch > (p.notch || 0)) { p.pulse = Math.max(p.pulse, 0.45); if (!(E.FILM_PLAY && p !== front && p !== arrival)) particles.burst(p.pos, low ? 4 : 10, 0xd8f1ff, 28, 0.7, 3); }
      p.notch = notch;
    } else if (p.target < p.opening) {
      p.notch = 0;
      shown = p.opening * (1 + p.pulse * 0.12);
    }
    p.group.visible = shown > 0.004; p.corona.visible = p.group.visible || p.anticipation > 0.005; p.open = p.opening > 0.65;
    var bloom = 1 + Math.sin(Math.min(1, p.age / 1.6) * Math.PI) * 0.11;
    var size = Math.max(0.001, smooth(Math.min(1, shown))) * bloom * (1 + p.pulse * 0.07);
    if (p === front && state === 'acceleration') size *= 1 + smooth(ts / 33) * 0.4;
    p.group.scale.set(size, size * (0.55 + 0.45 * smooth(Math.min(1, shown))), size);
    p.mat.uniforms.time.value = motionPreference.matches || E.softEffects ? clock * .18 : clock; p.mat.uniforms.opening.value = Math.min(1, shown); p.mat.uniforms.pulse.value = motionPreference.matches || E.softEffects ? p.pulse * .2 : p.pulse;
    var viewer = api.camera();
    if (viewer) { tmp.copy(viewer.position).sub(p.pos).applyQuaternion(q.copy(p.group.quaternion).invert()); p.mat.uniforms.parallax.value.set(Math.max(-.22, Math.min(.22, tmp.x / Math.max(1, Math.abs(tmp.z)) * .12)), Math.max(-.22, Math.min(.22, tmp.y / Math.max(1, Math.abs(tmp.z)) * .12))); }
    var u = p.coronaMat.uniforms; u.time.value = clock; u.opening.value = p.opening; u.pulse.value = p.pulse; u.anticipation.value = p.anticipation; u.age.value = p.age;
    p.corona.scale.setScalar(p === front && state === 'acceleration' ? 1 + smooth(ts / 33) * 0.4 : 1);
    if (!p.group.visible) return;
    // Même géométrie que le shader : demi-longueur et demi-hauteur de la lentille (repère local du portail).
    var unit = p.radius * 1.8, reveal = smooth(p.opening / 0.55), gape = smooth((p.opening - 0.25) / 0.75);
    var halfLen = 0.66 * reveal * unit, halfGap = (0.31 * gape + 0.008) * unit;
    p.shards.material.opacity = p.opening * 0.9;
    for (var shard = 0; shard < p.shards.count; shard++) {
      var su = ((shard * 0.618034 + p.seed * 0.37) % 1) * 2 - 1, side = shard % 2 ? 1 : -1;
      var prof = Math.pow(Math.max(0, 1 - su * su), 0.75), drift = ((clock * 0.06 + shard * 0.137) % 1);
      var lx = su * halfLen, ly = side * (halfGap * prof + drift * p.radius * (0.18 + p.pulse * 0.25));
      p.dummy.position.set(p.cosA * lx - p.sinA * ly, p.sinA * lx + p.cosA * ly, Math.sin(clock * 0.8 + shard) * p.radius * 0.05);
      p.dummy.rotation.set(clock * 0.6 + shard, shard * 1.7 + clock * 0.4, p.angle + shard);
      var h = p.radius * (0.03 + (shard % 4) * 0.012) * (1 - drift * 0.7); p.dummy.scale.set(h * 0.55, h * 1.6, h * 0.18); p.dummy.updateMatrix(); p.shards.setMatrixAt(shard, p.dummy.matrix);
    }
    p.shards.instanceMatrix.needsUpdate = true;
    p.boltTimer -= dt;
    if (p.boltTimer <= 0) {
      p.boltTimer = 0.05 + random() * 0.08; var bp = p.boltPos, n = 0;
      for (var b = 0; b < p.boltCount; b++) {
        var bu = random() * 1.8 - 0.9, bs = random() < 0.5 ? -1 : 1, bprof = Math.pow(Math.max(0, 1 - bu * bu), 0.75);
        var x0 = bu * halfLen, y0 = bs * halfGap * bprof, reach = p.radius * (0.25 + random() * 0.6) * (0.5 + p.pulse), along = (random() - 0.5) * p.radius * 0.6;
        var px = x0, py = y0;
        for (var sg = 1; sg <= p.boltSeg; sg++) {
          var kk = sg / p.boltSeg, jit = sg < p.boltSeg ? (random() - 0.5) * p.radius * 0.12 : 0;
          var nx = x0 + along * kk + jit, ny = y0 + bs * reach * kk + jit * 0.6;
          bp[n++] = p.cosA * px - p.sinA * py; bp[n++] = p.sinA * px + p.cosA * py; bp[n++] = 0;
          bp[n++] = p.cosA * nx - p.sinA * ny; bp[n++] = p.sinA * nx + p.cosA * ny; bp[n++] = 0;
          px = nx; py = ny;
        }
      }
      p.bolts.geometry.attributes.position.needsUpdate = true;
    }
    p.bolts.material.opacity = Math.min(1, p.opening * (0.35 + p.pulse * 0.9)) * (0.5 + 0.5 * Math.sin(clock * 61 + p.seed * 9));
    // Lumière qui gicle des bords de la déchirure, perpendiculairement à la fissure.
    p.flowCredit += dt * (low ? 5 : p.radius >= 85 ? 22 : 10) * p.opening;
    while (p.flowCredit >= 1) {
      p.flowCredit--; var fu = random() * 2 - 1, fs = random() < 0.5 ? -1 : 1, fprof = Math.pow(Math.max(0, 1 - fu * fu), 0.75);
      var fx = fu * halfLen, fy = fs * halfGap * fprof;
      tmp.set(p.cosA * fx - p.sinA * fy, p.sinA * fx + p.cosA * fy, (random() - 0.5) * 6).applyQuaternion(p.group.quaternion).add(p.pos);
      var out = 16 + random() * 22;
      tmp2.set(-p.sinA * fs * out, p.cosA * fs * out, 6).applyQuaternion(p.group.quaternion);
      particles.emit(tmp, tmp2.x, tmp2.y, tmp2.z, random() < 0.3 ? 0xffffff : 0x97dcff, 2 + random() * 2.5, 1.1);
    }
  });
}
function updateRockets(dt, state) {
  var ts = E.tState;
  for (var i = 0; i < 7; i++) {
    var r = rockets[i]; r.active = false; r.group.visible = false; r.capturePass = null; r.flameMat.clippingPlanes = null;
    if (state !== 'firstrocket') r.group.traverse(function (o) { if (o.isMesh) o.material.clippingPlanes = null; });
    if (state === 'countdown' && i === 0) { tmp.copy(pad).add(V(0, 24, 0)); orientRocket(r, tmp, up, true, 0); }
    else if (state === 'firstrocket' && i === 0) {
      var ignite = 0.22 * smooth(ts / 3) + 0.78 * smooth((ts - 4) / 2.4), climb = clamp((ts - 6.4) / 19.8), altitude = 1120 * (0.12 * climb + 0.88 * climb * climb);
      tmp.copy(pad).add(V(0, 24 + altitude, 0)); orientRocket(r, tmp, up, ts < 27.7, ignite);
      if (ts < 6.4) { r.group.position.x += Math.sin(ts * 61) * ignite * 0.18; r.group.position.z += Math.sin(ts * 47) * ignite * 0.18; }
      r.group.traverse(function (o) { if (o.isMesh && o !== r.flame) o.material.clippingPlanes = ts > 22 ? [launchPlane] : null; });
      once('liftoff', ts >= 6.4, function () { E.emit('rocket:launch', { index: 0 }); E.emit('launchpad:liftoff'); if (!E.FILM_PLAY) wave(pad, 110, 3.2, 0xb9d3dd); if (!E.FILM_PLAY) particles.burst(pad, low ? 16 : 40, 0xffbd68, 45, 2.1, 3.5); E.emit('camera:shake', { force: 0.20, duration: 1.5 }); });
      once('launch-rift', ts >= 26.2, function () { pulsePortal(portals[6], 0, true); });
    } else if (state === 'sixrockets') {
      for (var j = 0; j < r.paths.length; j++) { var leg = r.paths[j]; if (ts >= leg.start && ts <= leg.end) { var p = clamp((ts - leg.start) / (leg.end - leg.start)), speed = 0.65 * p + 0.35 * p * p;
          tmp.copy(leg.curve.getPointAt(speed)); direction.copy(leg.curve.getTangentAt(speed));
          orientRocket(r, tmp, direction, true, 0.82 + p * 0.18);
          var crossingPlanes = p < 0.16 ? [leg.exitPlane] : leg.enters && p > 0.84 ? [leg.entryPlane] : null;
          r.group.traverse(function (o) { if (o.isMesh) o.material.clippingPlanes = crossingPlanes; });
          once('exit-' + i + '-' + j, true, (function (l, index) { return function () { r.trail.reset(); pulsePortal(l.from, index, false); }; })(leg, i));
          once('flyby-' + i + '-' + j, p >= 0.4, (function (l, index) { return function () { E.emit('rocket:pass', { index: index, pos: l.curve.getPointAt(0.4), end: l.d.clone() }); }; })(leg, i));
          if (leg.enters) once('enter-' + i + '-' + j, p > 0.975, (function (l, index) { return function () { pulsePortal(l.to, index, true); }; })(leg, i));
          break;
        } }
    } else if (state === 'convergence') {
      var cp = clamp((ts - i * 0.35) / 7.2); tmp2.copy(r.convergenceFrom).add(V(0, 90, 0)); tmp3.copy(front.pos).add(V(0, 75, 140)); bezier(tmp, r.convergenceFrom, tmp2, tmp3, front.pos, cp); direction.subVectors(front.pos, tmp);
      orientRocket(r, tmp, direction, ts >= i * 0.35 && cp < 0.99, 1);
      once('capture-rocket-' + i, cp >= 0.99, (function (index) { return function () { pulsePortal(front, index, true); }; })(i));
    } else if (state === 'loop' || state === 'acceleration') {
      for (var passIndex = 0; passIndex < capturePasses.length; passIndex++) {
        var pass = capturePasses[passIndex];
        if (pass.rocket !== i || E.tTotal < pass.start) continue;
        once('capture-exit-' + pass.order, true, (function (p, rocket) { return function () {
          rocket.trail.reset(); pulsePortal(p.source, p.rocket, false);
          E.emit('capture:pass', { order: p.order, index: p.rocket, side: p.side, stage: 'behind', pos: p.a.clone(), end: p.d.clone(), duration: p.end - p.start });
        }; })(pass, r));
        once('capture-enter-' + pass.order, E.tTotal >= pass.end, (function (p) { return function () {
          pulsePortal(front, p.rocket, true);
          E.emit('capture:pass', { order: p.order, index: p.rocket, side: p.side, stage: 'entered' });
        }; })(pass));
        if (E.tTotal >= pass.end) continue;
        var progress = clamp((E.tTotal - pass.start) / (pass.end - pass.start)), travel = 0.78 * progress + 0.22 * progress * progress;
        tmp.copy(pass.curve.getPointAt(travel)); direction.copy(pass.curve.getTangentAt(travel));
        orientRocket(r, tmp, direction, true, 0.85 + 0.15 * clamp(pass.order / 12));
        r.group.traverse(function (o) { if (o.isMesh) o.material.clippingPlanes = [capturePlane]; });
        r.capturePass = { order: pass.order, side: pass.side, progress: progress };
        break;
      }
    } else if (state === 'strike' && i === 0 && !r.destroyed) {
      var sp = clamp((ts - 1.2) / 8.8);
      if (!r.strikeCurve) { var origin = portals[9].pos.clone(), finish = center.clone().add(V(0, zero.radius + 25.5, 0)); r.strikeCurve = flight(origin, origin.clone().add(V(42, -320, 10)), finish.clone().add(V(0, 240, 0)), finish); }
      tmp.copy(r.strikeCurve.getPointAt(sp)); direction.copy(r.strikeCurve.getTangentAt(sp)); orientRocket(r, tmp, direction, ts >= 1.2, 1);
      once('strike-exit', ts >= 1.2, function () { r.trail.reset(); pulsePortal(portals[9], 0, false); });
      tmp2.copy(r.direction).multiplyScalar(25.5).add(r.group.position); tmp3.copy(center).add(V(0, zero.radius, 0)); placeBeam(links[7], tmp2, tmp3, ts >= 1.2 ? 0.65 : 0);
      once('rocket-contact', ts >= 1.2 && tmp2.distanceTo(center) <= (E.zeroPointVisR || zero.radius) + 0.6, function () { r.destroyed = true; r.active = false; r.group.visible = false; rocketHitAt = E.tTotal; E.rocketDestroyed = true; portals[9].target = 0;
        E.emit('rocket:impact', { index: 0, pos: center.clone() }); E.emit('rocket:zeroshock', { pos: center.clone() }); E.emit('shockwave:burst', { pos: center.clone(), opts: { radius: 600, duration: 3, color: 0xbbefff } }); E.emit('camera:shake', { force: 0.38, duration: 1.8 }); particles.burst(tmp2, low ? 36 : 70, 0xffcc86, 85, 3.4, 6); links[7].mesh.visible = false;
      });
    } else if ((state === 'greatrift' || state === 'meteorsix' || state === 'descent') && i > 0 && meteor.visible) {
      var emergeTime = E.TIMELINE.greatrift[0] + 5 + (i - 1) * 0.22, blend = smooth((E.tTotal - emergeTime) / 2.2), a2 = (i - 1) / 6 * Math.PI * 2;
      tmp.copy(meteor.group.position).add(V(Math.cos(a2) * 108, 25 + Math.sin(a2) * 38, Math.sin(a2) * 108)); tmp.lerpVectors(arrival.pos, tmp, blend); sampleDescent(tmp2, E.tTotal + 0.1); direction.subVectors(tmp2, meteor.group.position); direction.y -= 1;
      orientRocket(r, tmp, direction, E.tTotal >= emergeTime, 0.65);
      once('escort-exit-' + i, E.tTotal >= emergeTime, (function (index) { return function () { r.trail.reset(); pulsePortal(arrival, index, false); }; })(i));
    } else if (state === 'veeroff' && i > 0) {
      var escape = portals[9 + i], vp = clamp((ts - (i - 1) * 0.16) / 5.5); tmp2.copy(r.escapeFrom).add(V((i % 2 ? 1 : -1) * 180, 85, 60)); tmp3.copy(escape.pos).add(V(0, -90, 0)); bezier(tmp, r.escapeFrom, tmp2, tmp3, escape.pos, vp * vp); direction.subVectors(escape.pos, tmp);
      orientRocket(r, tmp, direction, vp < 0.99, 1); once('escape-' + i, vp >= 0.99, (function (p, index) { return function () { pulsePortal(p, index, true); }; })(escape, i));
    }
    updateRocketFx(r, i, dt);
    publish('rocket' + (i + 1), r.group.position);
  }
  E.rocketBodies = rockets.filter(function (r) { return r.active; }).map(function (r) { return { x: r.group.position.x, y: r.group.position.y - 23, z: r.group.position.z, r: 5.2, top: r.group.position.y + 26,
    a: r.group.position.clone().addScaledVector(r.direction, -21), b: r.group.position.clone().addScaledVector(r.direction, 24) }; });
  if (state !== 'strike') links[7].mesh.visible = false;
}
function updateRocketFx(r, index, dt) {
  if (E.FILM_PLAY && !document.body.classList.contains('inside-rift')) { r.active = false; r.smokeCredit = 0; }
  var thrust = r.active ? r.throttle : 0, plumeScale = 0.25 + thrust * 1.05 + Math.sin(clock * 17 + index) * 0.025 * thrust;
  r.core.visible = thrust > 0.05; r.coreMat.uniforms.time.value = clock + index; r.coreMat.uniforms.thrust.value = thrust; r.core.scale.set(1, 0.5 + thrust * 0.8, 1); r.core.position.y = -24 - 11 * r.core.scale.y;
  r.flame.visible = thrust > 0.02; r.flameMat.uniforms.time.value = clock + index; r.flameMat.uniforms.thrust.value = thrust; r.flame.scale.y = plumeScale; r.flame.position.y = -24 - 20 * plumeScale;
  r.halo.material.opacity = thrust * 0.48; r.halo.scale.setScalar(18 + thrust * 16); r.heat.emissiveIntensity = thrust * 1.6;
  var mechanics = r.mechanics, igniting = E.state === 'firstrocket' && index === 0 && E.tState < 6.4;
  r.engine.rotation.x = Math.sin(clock * 2.3 + index) * 0.018 * thrust; r.engine.rotation.z += ((r.bank || 0) * .34 - r.engine.rotation.z) * (1 - Math.exp(-dt * 9));
  r.engineJets.forEach(function (jet, j) {
    var ignition = igniting ? smooth((E.tState - 1.1 - j * .55) / .6) : 1;
    var burn = thrust * ignition * (.94 + .06 * Math.sin(clock * (15 + j) + mechanics.enginePhase));
    jet.visible = burn > .015; jet.material.uniforms.time.value = clock + j * .37; jet.material.uniforms.thrust.value = burn;
    jet.scale.y = .5 + burn * .7; jet.position.y = -23.8 - 7 * jet.scale.y;
  });
  mechanics.flaps.forEach(function (flap, j) { var sign = j % 2 ? -1 : 1; flap.rotation.z += ((r.bank || 0) * sign * .7 - flap.rotation.z) * (1 - Math.exp(-dt * 7)); });
  mechanics.verniers.forEach(function (jet, j) { jet.visible = r.active && Math.abs(r.bank || 0) > .045 && ((r.bank > 0) === (j % 2 === 0)); });
  mechanics.vernierMat.opacity = Math.min(.55, Math.abs(r.bank || 0) * 2.4) * thrust;
  mechanics.beacon.scale.setScalar(.8 + .25 * (.5 + .5 * Math.sin(clock * 1.6 + index)));
  r.diamondMat.opacity = thrust * 0.44;
  r.diamonds.forEach(function (diamond, d) { diamond.visible = thrust > 0.18; diamond.position.y = -27 - d * 5.8 * plumeScale; diamond.scale.setScalar((3.1 - d * 0.42) * (0.65 + thrust * 0.35 + Math.sin(clock * 7 - d) * 0.025)); });
  if (index === 0) {
    once('booster-release', E.state === 'firstrocket' && E.tState >= 12.6, function () {
      r.group.updateMatrixWorld(true);
      r.boosters.forEach(function (pod) { pod.mesh.getWorldPosition(pod.origin); pod.mesh.getWorldQuaternion(q); group.add(pod.mesh); pod.mesh.position.copy(pod.origin); pod.mesh.quaternion.copy(q); pod.dropped = true; pod.at = E.tTotal; particles.burst(pod.origin, low ? 6 : 14, 0xffc27d, 18, 1.2, 2.5); });
      E.emit('rocket:stage', { pos: r.group.position.clone() });
    });
    r.boosters.forEach(function (pod) {
      if (!pod.dropped) return;
      var age = E.tTotal - pod.at; pod.mesh.visible = age < 13;
      if (!pod.mesh.visible) return;
      pod.mesh.position.set(pod.origin.x + pod.side * age * 22, pod.origin.y + age * 42 - age * age * 5.2, pod.origin.z + Math.sin(age * 0.3) * 7);
      pod.mesh.rotation.set(age * 0.24, age * 0.5, pod.side * age * 0.36); pod.mesh.scale.setScalar(1 - smooth((age - 10) / 3));
    });
  }
  tmp.copy(r.group.position).addScaledVector(r.direction, -24); r.trail.update(tmp, thrust > 0.2, clock, 2.4 + thrust * 0.6);
  if (thrust < 0.1) return;
  r.smokeCredit += dt * (E.state === 'firstrocket' ? low ? 22 : 44 : low ? 6 : 11) * thrust;
  while (r.smokeCredit >= 1) { r.smokeCredit--; smoke.emit(tmp, -r.direction.x * 24 + (random() - 0.5) * 9, -r.direction.y * 24 + 4, -r.direction.z * 24 + (random() - 0.5) * 9, (E.FILM_PLAY ? 0xcfe8ff : 0x8a97a3), E.state === 'firstrocket' ? 15 : 7, E.state === 'firstrocket' ? 4 : 1.4); }
  r.sparkCredit += dt * (low ? 8 : 15) * thrust;
  while (r.sparkCredit >= 1) { r.sparkCredit--; particles.emit(tmp, -r.direction.x * 60 + (random() - 0.5) * 20, -r.direction.y * 60, -r.direction.z * 60 + (random() - 0.5) * 20, 0xffae54, 3, 0.75); }
}
function updateMeteorBubble(stasis, state) {
  var b = meteor.bubble, m = meteor.bubbleMat.uniforms, since = meteor.shatterAt >= 0 ? E.tTotal - meteor.shatterAt : -1;
  var charge = state === 'acceleration' ? smooth(E.tState / 29) : (state === 'loop' ? 0.25 : 0);
  m.time.value = clock; m.charge.value = charge;
  if (since < 0) { b.visible = stasis && meteor.visible; m.shatter.value = 0; m.alpha.value = 0.85 + Math.sin(clock * 1.3) * 0.08; b.scale.setScalar(1 + charge * 0.04 + Math.sin(clock * 0.8) * 0.006); return; }
  // Éclatement : la bulle gonfle d'un coup, se fissure et s'évanouit en 0,9 s.
  var k = clamp(since / 0.9); b.visible = k < 1; m.shatter.value = k; m.alpha.value = 1.4 * (1 - k); b.scale.setScalar(1 + 0.35 * Math.sqrt(k));
}
function updateMeteor(dt, state) {
  var ts = E.tState, visible = true, stasis = true; previousMeteor.copy(meteor.group.position); meteor.rock.material.clippingPlanes = meteor.lavaMat.clippingPlanes = null;
  if (E.tTotal < E.TIMELINE.acceleration[0] + 29) meteor.group.position.copy(frozen);
  else if (state === 'acceleration') {
    once('unfreeze', ts >= 29, function () { E.meteorUnfrozen = true; meteor.shatterAt = E.tTotal; E.emit('meteor:unfreeze'); wave(frozen, 190, 2.1, 0x86ddff); wave(frozen, 320, 1.4, 0xe6f6ff); particles.burst(frozen, low ? 40 : 120, 0xbfe9ff, 95, 2.2, 5); particles.burst(frozen, low ? 20 : 50, 0xffffff, 150, 0.9, 7); E.emit('camera:shake', { force: 0.3, duration: 0.8 }); });
    // v48 : la faille ASPIRE la météorite — départ lent, engloutie à pleine vitesse.
    var dive = clamp((ts - 29.55) / 5.55), fall = dive * dive * (2.2 - 1.2 * dive);
    tmp.copy(front.pos).addScaledVector(front.normal, -meteor.radius - 6);
    meteor.group.position.lerpVectors(frozen, tmp, fall);
    if (ts < 29.55) meteor.group.position.add(V(Math.sin(clock * 21) * 0.35, Math.cos(clock * 17) * 0.3, 0));
    // v48 : tout ce qui a franchi le plan de la faille disparaît DEDANS — vu du
    // sol, la roche ne ressort plus sous la faille. Le rider (au sommet, côté
    // arrière) garde son appui jusqu'au passage complet.
    var swallowing = ts >= 29.55 && ts < 35.1;
    meteor.rock.material.clippingPlanes = meteor.lavaMat.clippingPlanes = swallowing ? captureClip : null;
    if (swallowing) {
      front.pulse = Math.max(front.pulse, 0.3 + fall * 0.7);
      meteor.halo.material.opacity = 0.34 * (1 - fall);
      meteor.suctionCredit = (meteor.suctionCredit || 0) + dt * (low ? 22 : 55);
      while (meteor.suctionCredit >= 1) {
        meteor.suctionCredit--; var sa = random() * Math.PI * 2, sb = random() * 2 - 1, sr = meteor.radius * (1.1 + random() * 0.9);
        tmp2.set(Math.cos(sa) * Math.sqrt(1 - sb * sb), sb, Math.sin(sa) * Math.sqrt(1 - sb * sb)).multiplyScalar(sr).add(meteor.group.position);
        tmp3.subVectors(front.pos, tmp2).normalize().multiplyScalar(70 + fall * 90);
        particles.emit(tmp2, tmp3.x, tmp3.y, tmp3.z, random() < 0.4 ? 0xffb070 : 0x9fdcff, 2.5 + random() * 3, 0.9);
      }
    }
    stasis = false; visible = ts < 35.1;
    once('meteor-swallow', ts >= 35.1, function () {
      front.pulse = 1; E.meteorAbsorbedTime = E.tTotal; meteor.trail.reset(); E.emit('meteor:gone');
      wave(front.pos, 300, 1.9, 0xcfeeff); particles.burst(front.pos, low ? 30 : 84, 0xbfe6ff, 95, 1.6, 4.5);
      E.emit('camera:shake', { force: 0.35, duration: 1.1 });
    });
  } else if (state === 'silence' || state === 'strike' || state === 'thrown') { visible = false; stasis = false; }
  else if (['greatrift', 'meteorsix', 'descent', 'veeroff', 'impact'].indexOf(state) !== -1) {
    sampleDescent(meteor.group.position, E.tTotal); stasis = false; visible = E.tTotal >= descentKeys[0].t && meteorHitAt < 0;
    // v48 : téléportée AU-DESSUS — la roche sort de la face de la faille
    // d'arrivée ; la partie encore « de l'autre côté » reste invisible.
    var emerging = meteor.group.position.y + meteor.radius + 4 > arrival.pos.y;
    meteor.rock.material.clippingPlanes = meteor.lavaMat.clippingPlanes = emerging ? arrivalClip : null;
    if (emerging && visible) arrival.pulse = Math.max(arrival.pulse, 0.55);
    if (state === 'greatrift') meteor.halo.material.opacity = smooth((E.tTotal - descentKeys[0].t) / 1.5) * 0.24;
    once('meteor-return', E.tTotal >= descentKeys[0].t, function () {
      arrival.pulse = 1; E.emit('meteor:emerge', { pos: arrival.pos.clone() });
      wave(arrival.pos, 520, 2.4, 0xd6f0ff); particles.burst(arrival.pos, low ? 40 : 110, 0xc9ecff, 140, 2, 6);
      E.emit('camera:shake', { force: 0.4, duration: 1.3 });
    });
    once('meteor-contact', state === 'impact' && visible && meteor.group.position.distanceTo(center) <= meteor.radius + (E.zeroPointVisR || zero.radius) + 0.1, function () {
      meteorHitAt = E.tTotal; E.meteorContactTime = meteorHitAt; E.meteorContactDistance = meteor.group.position.distanceTo(center); zero.destroyed = true; visible = false;
      E.emit('meteor:hit', { pos: center.clone(), meteorPos: meteor.group.position.clone(), distance: E.meteorContactDistance, radius: meteor.radius + zero.radius }); E.emit('zeropoint:destroyed'); E.emit('impact:playerblast');
      E.emit('shockwave:burst', { pos: center.clone(), opts: { radius: 1100, duration: 5.2, color: 0xd4edff } }); E.emit('camera:shake', { force: 0.65, duration: 2.4 }); particles.burst(center, low ? 85 : 170, 0xffd6ab, 155, 5, 10);
    });
  } else { visible = false; stasis = false; }
  if (dt > 0) {
    if (meteor.descent && E.tTotal >= descentKeys[0].t && E.tTotal <= descentKeys[1].t && meteorHitAt < 0) meteorSpeed = E.meteorFlight.speed;
    else meteorSpeed = meteor.group.position.distanceTo(previousMeteor) / dt;
  }
  var vtM = E.FILM_PLAY && E.filmVideoTime ? E.filmVideoTime() : 999;
  if (vtM < 64.5) visible = false;   // v78 : comme dans la vidéo, la météorite surgit à 64 s
  meteor.group.scale.setScalar(vtM < 67 ? Math.max(.05, smooth((vtM - 64.5) / 2.5)) : 1);
  meteor.visible = visible; meteor.group.visible = visible;
  var frozenTime = stasis ? 3.7 + clock * 0.02 : clock; // le temps est (presque) arrêté dans la bulle
  meteor.rock.rotation.y = frozenTime * 0.035; meteor.rock.rotation.z = frozenTime * 0.017; meteor.lava.rotation.copy(meteor.rock.rotation); meteor.lavaMat.uniforms.time.value = clock;
  meteor.heat = stasis ? 0.72 : 1.3; meteor.lavaMat.uniforms.heat.value = meteor.heat;
  var frost = stasis ? 1 : (meteor.shatterAt >= 0 ? 1 - smooth((E.tTotal - meteor.shatterAt) / 4) : 0);
  meteor.rockU.uTime.value = clock; meteor.rockU.uHeat.value = stasis ? 0.75 : (state === 'impact' || state === 'veeroff' ? 1.35 : 1.1); meteor.rockU.uFrost.value = frost; meteor.lavaMat.uniforms.frost.value = frost;
  var beatPhase = (clock * 0.9) % 1; meteor.rockU.uBeat.value = Math.exp(-Math.pow((beatPhase - 0.1) * 18, 2)) + 0.5 * Math.exp(-Math.pow((beatPhase - 0.3) * 16, 2));
  updateMeteorBubble(stasis, state);
  meteor.sheath.visible = visible && !stasis; meteor.sheathMat.uniforms.heat.value = state === 'impact' ? 1.2 : 0.7; meteor.sheathMat.uniforms.time.value = clock;
  meteor.sheathMat.clippingPlanes = meteor.rock.material.clippingPlanes; meteor.light.intensity = visible ? (stasis ? 1.5 : 5) : 0;
  meteor.fireTail.visible = visible && (stasis || state !== 'greatrift' || E.tTotal > descentKeys[0].t + 1.5); meteor.fireMat.uniforms.time.value = stasis ? 11.3 + Math.sin(clock * 0.7) * 0.04 : clock; meteor.fireMat.uniforms.frost.value = frost; meteor.fireMat.clippingPlanes = meteor.rock.material.clippingPlanes;
  meteor.fireMat.uniforms.heat.value = stasis ? 0.5 : (0.85 + clamp(meteorSpeed / 110) * 0.35) * (E.tTotal >= descentKeys[0].t ? smooth((E.tTotal - descentKeys[0].t - 1.5) / 2.2) : 1);
  if (meteor.fireTail.visible) {
    if (stasis) direction.set(frozen.x - center.x, (frozen.y - center.y) * 0.32, frozen.z - center.z).normalize();
    else if (meteor.descent && E.tTotal >= descentKeys[0].t) direction.copy(meteor.descent.getTangentAt(clamp((E.tTotal - descentKeys[0].t) / (descentKeys[1].t - descentKeys[0].t)))).negate();
    else direction.subVectors(previousMeteor, meteor.group.position).normalize();
    if (direction.lengthSq() < 0.01) direction.copy(up);
    meteor.fireTail.quaternion.setFromUnitVectors(up, direction); meteor.fireTail.scale.set(1.08, stasis ? 1.25 : 1.35 + clamp(meteorSpeed / 180) * 0.55, 1.08);
  }
  if (visible && !stasis) {
    direction.subVectors(previousMeteor, meteor.group.position).normalize(); meteor.smokeCredit += dt * (low ? 18 : 35);
    while (meteor.smokeCredit >= 1) { meteor.smokeCredit--; tmp.copy(meteor.group.position).addScaledVector(direction, 38); smoke.emit(tmp, direction.x * 24, direction.y * 24 + 12, direction.z * 24, (E.FILM_PLAY ? 0xb48fb8 : 0x66524b), 20 + random() * 16, 3.8); }
  }
  var debrisAge = meteorHitAt < 0 ? -1 : E.tTotal - meteorHitAt;
  meteor.chunks.forEach(function (chunk, i) {
    chunk.mesh.visible = debrisAge >= 0 && debrisAge < 12;
    if (!chunk.mesh.visible) return;
    var drift = (1 - Math.exp(-debrisAge * 0.18)) / 0.18;
    chunk.mesh.position.set(center.x + chunk.vx * drift, center.y + chunk.vy * drift - debrisAge * debrisAge * 5, center.z + chunk.vz * drift);
    chunk.mesh.rotation.set(debrisAge * (0.7 + i % 3), debrisAge + i, debrisAge * 0.8);
    chunk.mesh.scale.setScalar(chunk.size * (1 - smooth((debrisAge - 7) / 5)));
  });
  var diving = state === 'acceleration' && ts >= 29.55;
  if (state !== 'greatrift' && !diving) meteor.halo.material.opacity = stasis ? 0.2 : 0.34;
  if (diving) meteor.light.intensity *= 1 - Math.pow(clamp((ts - 29.55) / 5.55), 2);
  var charge = state === 'acceleration' ? smooth(ts / 29) : 0;
  var arcOn = visible && (stasis || (state === 'acceleration' && ts < 35.1));
  meteor.arcs.visible = arcOn;
  if (arcOn) {
    meteor.arcTimer -= dt;
    if (meteor.arcTimer <= 0) { meteor.arcTimer = 0.06 + random() * 0.07; regenMeteorArcs(meteor, Math.max(charge, diving ? 1 : 0)); }
    meteor.arcs.material.opacity = (0.4 + charge * 0.5) * (0.55 + 0.45 * Math.sin(clock * 47));
    meteor.arcs.material.clippingPlanes = meteor.rock.material.clippingPlanes;
  }
  meteor.ring.visible = meteor.ring2.visible = stasis; meteor.ring.rotation.z = clock * 0.08 + charge * 2.2; meteor.ring2.rotation.y = clock * -0.09 - charge * 2.8;
  meteor.ring.scale.setScalar(1 + charge * 0.22); meteor.ring2.scale.setScalar(1 + charge * 0.32);
  meteor.ring.material.opacity = 0.45 + charge * 0.35; meteor.ring2.material.opacity = 0.25 + charge * 0.45;
  if (stasis && charge > 0.7) meteor.group.position.add(V(Math.sin(clock * 13) * charge * 0.45, Math.cos(clock * 17) * charge * 0.35, 0));
  var orbitT = stasis ? frozenTime * 3 : clock;
  meteor.fragments.forEach(function (f, i) { f.mesh.material.clippingPlanes = meteor.rock.material.clippingPlanes; var a = f.angle + orbitT * f.speed, ct = Math.cos(f.tilt * 0.12), st = Math.sin(f.tilt * 0.12); var x = Math.cos(a) * f.radius, z = Math.sin(a) * f.radius, y = f.height + Math.sin(orbitT * 0.25 + i) * 4; f.mesh.position.set(x, y * ct - z * st, y * st + z * ct); f.mesh.rotation.set(orbitT * 0.13 + i, orbitT * 0.2 + f.tilt, i); });
  meteor.dust.visible = visible; if (visible) { var ds = meteor.dustSeed, dp = meteor.dustPos; for (var di = 0; di < dp.length / 3; di++) { var da = ds[di * 3] + orbitT * (0.05 + (di % 7) * 0.008) * (di % 2 ? 1 : -1), dr = ds[di * 3 + 1]; dp[di * 3] = Math.cos(da) * dr; dp[di * 3 + 1] = ds[di * 3 + 2] * 30 + Math.sin(da * 3 + di) * 4; dp[di * 3 + 2] = Math.sin(da) * dr; } meteor.dust.geometry.attributes.position.needsUpdate = true; meteor.dust.material.color.setHex(stasis ? 0xcfe9ff : 0xffb27a); meteor.dust.material.opacity = stasis ? 0.6 : 0.85; }
  publish('meteor', meteor.group.position); E.meteorPos.copy(meteor.group.position); E.meteorVisible = visible; E.meteorVisR = meteor.radius;
  meteor.trail.update(meteor.group.position, visible && !stasis && state !== 'greatrift', clock, state === 'impact' ? 30 : 16);
  if (visible) { meteor.sparkCredit += dt * (low ? 16 : 36); while (meteor.sparkCredit >= 1) { meteor.sparkCredit--; var a = random() * Math.PI * 2; tmp.copy(meteor.group.position).add(V(Math.cos(a) * 42, (random() - 0.5) * 50, Math.sin(a) * 42)); particles.emit(tmp, Math.cos(a) * 12, stasis ? 3 : 35, Math.sin(a) * 12, 0xff9038, 3 + random() * 3, 1.8); } }
}
function updateZero(dt, state) {
  var afterRocket = rocketHitAt >= 0 ? E.tTotal - rocketHitAt : -1, afterImpact = meteorHitAt >= 0 ? E.tTotal - meteorHitAt : -1;
  var stress = afterRocket >= 0 ? 0.35 : 0; if (state === 'descent' || state === 'veeroff' || state === 'impact') stress = Math.max(stress, clamp(1 - meteor.group.position.distanceTo(center) / 1100));
  var resonance = E.zeroResonance || 0;
  stress += resonance * 0.2;
  var approach = E.meteorFlight && E.tTotal >= E.meteorFlight.start && afterImpact < 0 ? smooth(1 - meteor.group.position.distanceTo(center) / 1500) : 0;
  var activated = afterRocket >= 0 ? smooth(afterRocket / 2.4) : 0;
  var zoneRadius = 58 + activated * 44 + approach * 275;
  var rupture = afterImpact >= 0 ? clamp(afterImpact / 2.4) : 0;
  var zoneAlpha = (0.35 + activated * 0.35 + approach * 0.3) * (1 - smooth(rupture));
  if (afterImpact >= 0) zoneRadius = 377 + 280 * (1 - Math.exp(-afterImpact * 0.85));
  zero.zone.visible = zoneAlpha > 0.003 && E.tTotal < E.TIMELINE.contraction[0]; zero.zone.scale.setScalar(zoneRadius);
  zero.zoneMat.uniforms.time.value = clock; zero.zoneMat.uniforms.alpha.value = zoneAlpha; zero.zoneMat.uniforms.stress.value = clamp(approach + resonance * 0.3 + rupture);
  zero.zoneMat.uniforms.hit.value = afterRocket >= 0 && afterRocket < 2.4 ? afterRocket / 2.4 : rupture;
  E.zeroZoneRadius = zoneRadius; E.zeroZoneAlpha = zero.zone.visible ? zoneAlpha : 0;
  once('zone-expansion', approach > 0.06, function () { E.emit('zeropoint:zone-expand', { pos: center.clone() }); });
  once('zone-rupture', afterImpact >= 0, function () { E.emit('zeropoint:zone-break', { pos: center.clone() }); });
  var scale = 1 + stress * 0.05 + Math.sin(clock * (1.3 + stress * 4)) * (0.008 + stress * 0.02);
  var alpha = 1;
  if (afterImpact >= 0) { scale = 1.12 + Math.exp(-afterImpact * 0.7) * 0.5; stress = 1; alpha = 0.65; }
  if (state === 'contraction') { scale *= 1 - smooth(phaseProgress('contraction')) * 0.78; alpha = 0.8; }
  if (state === 'collapse') { scale = 0.24 * (1 - smooth(E.tState / 1.2)); alpha = 1 - smooth(E.tState / 1.2); }
  if (E.tTotal >= E.TIMELINE.growth[0]) alpha = 0;
  zero.group.visible = alpha > 0.001; zero.group.scale.setScalar(Math.max(0.001, scale)); zero.mat.uniforms.time.value = clock; zero.mat.uniforms.stress.value = stress; zero.mat.uniforms.alpha.value = alpha;
  zero.shellMat.uniforms.time.value = clock; zero.shellMat.uniforms.stress.value = stress; zero.shellMat.uniforms.alpha.value = alpha;
  zero.halo.material.opacity = (0.26 + stress * 0.16) * alpha; zero.light.intensity = (2.8 + stress * 3.5) * alpha;
  var zbeat = (clock * 0.75) % 1, zpulse = Math.exp(-Math.pow((zbeat - 0.1) * 20, 2)) + 0.45 * Math.exp(-Math.pow((zbeat - 0.28) * 18, 2));
  zero.flare.material.opacity = (0.45 + zpulse * 0.25 + stress * 0.3) * alpha; zero.flare.material.rotation = Math.sin(clock * 0.12) * 0.08;
  var fs = (160 + zpulse * 30 + stress * 120) / Math.max(0.2, zero.group.scale.x); zero.flare.scale.set(fs * 1.25, fs, 1);
  var recoil = afterRocket >= 0 ? Math.exp(-afterRocket * 2.4) * Math.sin(afterRocket * 9) * 0.10 : 0;
  zero.group.scale.set(scale * (1 + recoil), scale * (1 - recoil * 1.6), scale * (1 + recoil));
  updateZeroLattice(zero.lattice, dt, stress, alpha, resonance, afterRocket, afterImpact);
  var orbitClock = zero.lattice.phase;
  zero.arcs.forEach(function (arc, i) { var sign = i % 2 ? -1 : 1; arc.rotation.set(i * .9 + orbitClock * (.08 + i * .025), i * .8 + orbitClock * .12 * (i + 1) * sign, i * 1.2 + orbitClock * (.22 + i * .1) * sign); arc.material.opacity = (.25 + stress * .45) * alpha; });
  zero.inner.scale.setScalar(0.90 + Math.sin(clock * 1.6) * 0.07 + stress * 0.26 + resonance * 0.14);
  zero.inner.rotation.set(clock * 0.13, clock * -0.18, Math.sin(clock * 0.11) * 0.25); zero.shell.rotation.y = clock * -0.09;
  zero.shell.scale.setScalar(1 + resonance * 0.09); zero.halo.material.opacity += resonance * alpha * 0.13;
  zero.inner.material.uniforms.time.value = clock; zero.inner.material.uniforms.stress.value = stress; zero.inner.material.uniforms.alpha.value = alpha;
  zero.motes.material.uniforms.alpha.value = (0.6 + stress * 0.3) * alpha; zero.motes.material.uniforms.pixelScale.value = Math.min(1100, root.innerHeight * 1.3);
  for (var mote = 0; mote < zero.motePositions.length / 3; mote++) {
    var ma = mote * 2.399963 + clock * (0.17 + mote % 5 * 0.025), elevation = 1 - 2 * (mote + 0.5) / (zero.motePositions.length / 3);
    var mr = 34 + (mote % 7) * 2.5 + stress * 10 + Math.sin(clock * 0.8 + mote) * 1.8, mh = Math.sqrt(1 - elevation * elevation);
    zero.motePositions[mote * 3] = Math.cos(ma) * mr * mh; zero.motePositions[mote * 3 + 1] = elevation * mr; zero.motePositions[mote * 3 + 2] = Math.sin(ma) * mr * mh;
  }
  zero.motes.geometry.attributes.position.needsUpdate = true;
  zero.fragments.material.opacity = stress * alpha * 0.85;
  for (var shard = 0; shard < zero.fragments.count; shard++) {
    var angle = shard * 2.39996 + clock * (0.14 + stress * 0.28), elevation = 1 - 2 * (shard + 0.5) / zero.fragments.count;
    var radius = 32 + stress * 22 + Math.sin(clock * 1.8 + shard) * (2 + stress * 4), horizontal = Math.sqrt(1 - elevation * elevation);
    zero.dummy.position.set(Math.cos(angle) * horizontal * radius, elevation * radius, Math.sin(angle) * horizontal * radius);
    zero.dummy.rotation.set(angle * 0.7, clock * 0.5 + shard, shard * 1.1); var length = 1.4 + stress * (1 + shard % 4);
    zero.dummy.scale.set(length * 0.3, length, length * 0.24); zero.dummy.updateMatrix(); zero.fragments.setMatrixAt(shard, zero.dummy.matrix);
  }
  zero.fragments.instanceMatrix.needsUpdate = true;
  var branches = zero.crackPositions.length / 30;
  for (var branch = 0; branch < branches; branch++) {
    var angle = branch / branches * Math.PI * 2 + clock * 0.11, elevation = Math.sin(branch * 2.39) * 0.75;
    for (var segment = 0; segment < 5; segment++) {
      var offset = (branch * 5 + segment) * 6;
      for (var end = 0; end < 2; end++) {
        var k = (segment + end) / 5, radius = 27 + k * (8 + stress * 38), bend = (Math.sin((segment + end) * 13 + branch * 7 + clock * 5) * 0.09 + Math.sin(clock * 2.3 + branch) * 0.04) * k;
        zero.crackPositions[offset + end * 3] = Math.cos(angle + bend) * radius * Math.sqrt(1 - elevation * elevation);
        zero.crackPositions[offset + end * 3 + 1] = elevation * radius + Math.sin(k * 18 + branch) * k * stress * 5;
        zero.crackPositions[offset + end * 3 + 2] = Math.sin(angle + bend) * radius * Math.sqrt(1 - elevation * elevation);
      }
    }
  }
  zero.cracks.geometry.attributes.position.needsUpdate = true; zero.cracks.material.opacity = (0.22 + stress * 0.6) * alpha;
  var surgeAge = afterImpact >= 0 ? afterImpact : afterRocket;
  var surgeDuration = afterImpact >= 0 ? 5.5 : 3.2;
  zero.surge.visible = surgeAge >= 0 && surgeAge < surgeDuration;
  if (zero.surge.visible) { zero.surge.scale.setScalar(30 + (1 - Math.exp(-surgeAge * 0.55)) * (afterImpact >= 0 ? 1050 : 620)); zero.surgeMat.uniforms.alpha.value = Math.pow(1 - surgeAge / surgeDuration, 2) * (afterImpact >= 0 ? 0.6 : 0.36); }
  if (afterRocket >= 0 && afterRocket < 1.2) zero.halo.material.opacity += Math.exp(-afterRocket * 4) * 0.35;
  E.zeroPointVisR = zero.radius * scale; E.zeroPointPos.copy(center); publish('zeropoint', center);
  for (var i = 0; i < 7; i++) { var r = rockets[i], capture = (state === 'loop' || state === 'acceleration') && r.active && meteor.visible;
    placeBeam(links[i], r.group.position, meteor.group.position, capture ? 0.12 + (state === 'acceleration' ? phaseProgress('acceleration') * 0.35 : 0.05) : 0);
  }
  once('aftershock', afterImpact > 3.6, function () { wave(center, 850, 5, 0x5ba7ff); });
  once('blackhole-formed', state === 'collapse' && E.tState >= 0.45, function () { E.emit('blackhole:formed'); E.emit('zeropoint:collapse'); });
  if (afterImpact > 0 && alpha > 0 && Math.floor(clock * 18) !== flags.residueFrame) { flags.residueFrame = Math.floor(clock * 18); var a = clock * 1.4, radius = state === 'contraction' ? 140 * (1 - phaseProgress('contraction')) : 35 + afterImpact * 1.8; tmp.copy(center).add(V(Math.cos(a) * radius, Math.sin(a * 2) * 18, Math.sin(a) * radius)); direction.subVectors(center, tmp).multiplyScalar(0.8); particles.emit(tmp, direction.x, direction.y, direction.z, 0x71b8ff, 5, 1.3); }
  if (afterImpact >= 0) E.screenFlash = Math.min(0.82, Math.exp(-afterImpact * 3.4) * 0.82);
  else if (afterRocket >= 0) E.screenFlash = Math.exp(-afterRocket * 5) * 0.22;
  else E.screenFlash = 0;
}
/* v78 : dans l'événement de la v75, seuls restent de l'ancienne chorégraphie la météorite
   (solide), le Point Zéro et les deux failles qu'elle traverse (capture et arrivée).
   Les anciennes fusées, failles de zone, faisceaux et bulles sont masqués
   (les fusées restent visibles dans le monde des failles). */
function filmPlayFilter() {
  var inRift = document.body.classList.contains('inside-rift');
  rockets.forEach(function (r) { if (!inRift) r.group.visible = false; if (r.trail && r.trail.mesh) r.trail.mesh.visible = inRift; (r.boosters || []).forEach(function (pod) { pod.mesh.visible = false; }); });
  portals.forEach(function (p) { if (p !== front && p !== arrival) { p.group.visible = false; p.corona.visible = false; } });
  // la faille de capture ne s'ouvre qu'au moment où la météorite y plonge (vidéo ≈ 2:22)
  var vtF = E.filmVideoTime ? E.filmVideoTime() : 999;
  if (vtF < 142) { front.group.visible = false; front.corona.visible = false; }
  else if (vtF < 144) { var kF = smooth((vtF - 142) / 2); front.group.scale.multiplyScalar(Math.max(.01, kF)); front.corona.scale.multiplyScalar(Math.max(.01, kF)); }
  links.forEach(function (l) { l.mesh.visible = false; });
  if (zero && zero.zone) zero.zone.visible = false;
  if (meteor) { if (meteor.bubble) meteor.bubble.visible = false; if (meteor.ring) meteor.ring.visible = false; if (meteor.ring2) meteor.ring2.visible = false; }
}
function update(dt) {
  if (!api || !E.active || !group) return;
  frameDt = dt; clock = E.tTotal; var state = E.state; if (state !== previousPhase) { enterPhase(state); previousPhase = state; }
  updatePortals(dt, state); updateMeteor(dt, state); updateRockets(dt, state); updateZero(dt, state);
  if (E.FILM_PLAY) filmPlayFilter();
  waves.forEach(function (w) { if (w.age >= w.duration) { w.group.visible = false; return; } w.age += dt; var p = clamp(w.age / w.duration); w.group.scale.setScalar(Math.max(1, w.radius * (1 - Math.pow(1 - p, 1.8)))); w.mat.opacity = Math.pow(1 - p, 2) * 0.62; });
  particles.update(dt); smoke.update(dt);
  E.coherenceSnapshot = { phase: state, time: E.tTotal, visibleRockets: rockets.filter(function (r) { return r.active; }).length, rocketOneDestroyed: rockets[0].destroyed, meteorVisible: meteor.visible, meteorRadius: meteor.radius, zeroRadius: zero.radius, meteorContact: meteorHitAt, rocketContact: rocketHitAt, openRifts: portals.filter(function (p) { return p.open; }).length,
    meteorSpeed: meteorSpeed, meteorAbsorbed: E.meteorAbsorbedTime, zeroZoneRadius: E.zeroZoneRadius, zeroZoneAlpha: E.zeroZoneAlpha, targetingBeamVisible: links[7].mesh.visible,
    capturePassesCompleted: capturePasses.filter(function (p) { return flags['capture-enter-' + p.order]; }).length,
    activeCapturePasses: rockets.filter(function (r) { return r.active && r.capturePass; }).map(function (r) { return r.capturePass; }) };
}
function init(a) {
  api = a; scene = a.scene(); low = a.isMobile || a.quality === 'low'; flags = {}; previousPhase = ''; clock = 0; rng = 271828; meteorHitAt = rocketHitAt = -1; rockets = []; portals = []; links = []; waves = []; resources.clear();
  rocketDetailGeometry = null; hullTexture = null;
  group = new T.Group(); group.name = 'v27-event-choreography'; scene.add(group); glow = radialTexture();
  center = a.center.clone().add(V(0, 20, 0)); /* v76 : Point Zéro plus bas, aligné sur l'orbe */ var padY = root.AZSim.heightAt(-180, 140); pad = V(-180, padY + 5, 140); frozen = center.clone().add(V(270, 430, 220)); /* v76 : météorite plus proche et bien visible */
  if (E.FILM_PLAY) { /* v78 : météorite figée à l'endroit exact où la vidéo la montre (repère du film) */
    var hP = root.AZSim.heightAt(-515, -135), fP = V(-25, 0, -120).normalize(), rP = V(0, 0, 0).crossVectors(fP, up).normalize(), yw = 46 * Math.PI / 180, pt = 17 * Math.PI / 180;
    frozen = V(-515, hP + 1.7, -135).addScaledVector(fP, Math.cos(yw) * Math.cos(pt) * 760).addScaledVector(rP, Math.sin(yw) * Math.cos(pt) * 760).addScaledVector(up, Math.sin(pt) * 760);
  }
  E.anchors = E.anchors || {}; E.meteorPos = frozen.clone(); E.zeroPointPos = center.clone(); E.rocketDestroyed = false; E.meteorContactTime = null; E.meteorAbsorbedTime = null; E.screenFlash = 0; E.zeroZoneRadius = 0; E.zeroZoneAlpha = 0; meteorSpeed = 0;
  var r = a.renderer(); oldClipping = r.localClippingEnabled; r.localClippingEnabled = true;
  var skyPositions = [[-510,550,-280],[460,650,-360],[-460,730,400],[510,550,380],[40,850,-540],[-150,680,560]];
  skyPositions.forEach(function (p, i) { makePortal(center.clone().add(V(p[0], p[1], p[2])), 48, V(-p[0], 0, -p[2]), 'zone' + i); });
  var launch = makePortal(pad.clone().add(V(0, 1120, 0)), 58, V(0, -1, 0), 'launch'); launchPlane = new T.Plane(V(0, -1, 0), launch.pos.y);
  front = makePortal(frozen.clone().add(V(-95, -120, -150)), 85, V(95, 120, 150), 'capture'); capturePlane = new T.Plane(front.normal.clone(), -front.normal.dot(front.pos));
  var captureAxis = front.normal.clone().negate(), captureSide = V(0, 0, 0).crossVectors(captureAxis, up).normalize();
  rear = makePortal(frozen.clone().addScaledVector(captureAxis, -290).addScaledVector(captureSide, -76), 55, captureAxis, 'rear');
  makePortal(center.clone().add(V(0, 1100, 0)), 62, V(0, -1, 0), 'strike');
  for (var i = 0; i < 6; i++) { var angle = i / 6 * Math.PI * 2; makePortal(center.clone().add(V(Math.cos(angle) * 500, 620 + i * 25, Math.sin(angle) * 500)), 48, V(-Math.cos(angle), -0.25, -Math.sin(angle)), 'escape' + i); }
  arrival = makePortal(center.clone().add(V(0, 1800, 0)), 205, V(0, -1, 0), 'arrival'); arrivalPlane = new T.Plane(V(0, -1, 0), arrival.pos.y);
  rearOther = makePortal(frozen.clone().addScaledVector(captureAxis, -290).addScaledVector(captureSide, 76), 55, captureAxis, 'rear-other');
  captureClip = [capturePlane]; arrivalClip = [arrivalPlane];
  E.rifts = portals;
  particles = makePool(low ? 320 : 760, false); smoke = makePool(low ? 110 : 240, true);
  for (var j = 0; j < 7; j++) rockets.push(makeRocket(j)); meteor = makeMeteor(); zero = makeZero();
  E.eventVisuals = { group: group, meteor: meteor, rockets: rockets, zero: zero };
  E.meteorTransport = { start: E.TIMELINE.acceleration[0] + 35.1, end: E.TIMELINE.greatrift[0] + 2 };
  for (var l = 0; l < 8; l++) links.push(makeBeam(l === 7 ? 0xff7a68 : 0x5fd2ff, l === 7 ? 0.22 : 0.55));
  for (var w = 0; w < 6; w++) waves.push(makeWave()); makePaths(); makeCapturePasses(); buildDescent();
  if (!bound) { bound = true; E.on('shockwave:burst', function (data) { if (!E.active || !group || !data || !data.pos) return; var opts = data.opts || {}; wave(data.pos, opts.radius || 300, opts.duration || 3, opts.color); }); E.on('anchor:set', function (d) { if (d && d.name && d.pos) publish(d.name, d.pos); }); }
  update(1 / 60);
}
function dispose() {
  if (group && scene) scene.remove(group); resources.forEach(function (r) { if (r.dispose) r.dispose(); }); resources.clear();
  var renderer = api && api.renderer(); if (renderer) renderer.localClippingEnabled = oldClipping;
  capturePasses = []; E.captureChoreography = []; E.meteorAbsorbedTime = null; E.meteorFlight = null;
  E.eventVisuals = null; E.meteorTransport = null;
  E.rifts = []; E.rocketBodies = []; E.meteorVisible = false; E.meteorPos = E.zeroPointPos = null; E.meteorVisR = E.zeroPointVisR = null; E.screenFlash = 0; E.zeroZoneRadius = 0; E.zeroZoneAlpha = 0; E.coherenceSnapshot = null; group = null; scene = null; api = null;
}
E.register('coherence', { init: init, preUpdate: update, dispose: dispose });
})(window);
