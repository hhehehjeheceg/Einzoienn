/* AZUR v94 — graphics-v94.js : rendu poussé.
 *  - post-traitement HDR : rendu dans une cible flottante multi-échantillonnée (anticrénelage), halo
 *    lumineux (bloom à 5 niveaux), étalonnage (vibrance, contraste, ombres froides et lumières chaudes),
 *    vignette, tramage anti-bandes ; même courbe ACES que le moteur ;
 *  - ciel : dégradé saturé, disque et halo du soleil, cumulus éclairés par le soleil, cirrus, étoiles ;
 *  - éclairage d'ambiance par l'environnement (IBL) généré depuis ce ciel : reflets sur le verre, l'eau,
 *    le métal, ombres douces adoucies ;
 *  - brouillard d'altitude teinté par le soleil (perspective atmosphérique) ;
 *  - terrain plus fin (maillage 2× plus dense), détail de sol procédural, rides du désert, paillettes de
 *    neige, lave incandescente, ombres des nuages qui défilent, relief de surface ;
 *  - eau : couleur selon la profondeur (turquoise près des côtes), vagues, écume sur le rivage, reflets ;
 *  - herbe dense qui ondule au vent autour du joueur ;
 *  - ombres plus douces et stables (sans scintillement).
 * Chaque effet se coupe tout seul si son shader ne compile pas sur l'appareil (et le reste désactivé
 * pour les sessions suivantes). Qualité « basse » : pas de post-traitement ni d'herbe dense.
 * À charger en dernier. */
(function (root) {
  "use strict";
  const T = root.THREE, S = root.AZSim;
  const VP = root.AZView && root.AZView.View && root.AZView.View.prototype;
  const EP = root.AZEnvironment && root.AZEnvironment.Environment && root.AZEnvironment.Environment.prototype;
  if (!T || !S || !VP || VP.__gfx94) return;
  VP.__gfx94 = true;
  const KEY = "azGfx94Off-1";
  const G = (root.AZGfx94 = { on: { post: true, fog: true, sky: true, ibl: true, terrain: true, water: true, grass: true, shadows: true }, time: { value: 0 }, errors: [] });
  try { const k = JSON.parse(localStorage.getItem(KEY) || "{}"); for (const f in k) G.on[f] = false; } catch (e) {}
  function disable(f, why) {
    if (!G.on[f]) return;
    G.on[f] = false;
    G.errors.push(f + ": " + why);
    if (root.console) console.warn("[AZUR graphismes] " + f + " désactivé :", why);
    try { const k = JSON.parse(localStorage.getItem(KEY) || "{}"); k[f] = 1; localStorage.setItem(KEY, JSON.stringify(k)); } catch (e) {}
  }
  const isEvent = () => { const w = root.AZUR && root.AZUR.world; return !!(w && w.mode === "event") || !!(root.AZEvent && root.AZEvent.active); };
  const qual = (v) => (v && v.quality) || "medium";
  const lowQ = (v) => qual(v) === "low";
  const SUN = new T.Vector3(-48, 90, 44).normalize(); // même direction que le soleil de la vue

  /* ============================================================ garde-fou des shaders */
  const MARK = { post: "/*azPost*/", fog: "azFogW", sky: "/*azSky94*/", terrain: "/*azTer94*/", water: "/*azWat94*/", grass: "/*azGrass94*/" };
  let FOG_SAVED = null;
  function watchShaders(renderer) {
    if (renderer.__az94Watch) return;
    renderer.__az94Watch = true;
    const prev = renderer.debug.onShaderError;
    renderer.debug.onShaderError = function (gl, program, vs, fs) {
      let src = "", log = "";
      try { src = gl.getShaderSource(fs) + gl.getShaderSource(vs); log = (gl.getProgramInfoLog(program) || "") + (gl.getShaderInfoLog(vs) || "") + (gl.getShaderInfoLog(fs) || ""); } catch (e) {}
      if (root.console) console.error("[AZUR graphismes] erreur de shader", log.slice(0, 600));
      for (const f in MARK) if (src.indexOf(MARK[f]) >= 0) {
        disable(f, log.slice(0, 200));
        if (f === "fog") restoreFog();
      }
      if (typeof prev === "function") try { prev.apply(this, arguments); } catch (e) {}
    };
  }

  /* ============================================================ brouillard d'altitude */
  function installFog() {
    if (FOG_SAVED || !G.on.fog) return;
    const C = T.ShaderChunk;
    FOG_SAVED = { pv: C.fog_pars_vertex, v: C.fog_vertex, pf: C.fog_pars_fragment, f: C.fog_fragment };
    C.fog_pars_vertex = "#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 azFogW;\n#endif";
    C.fog_vertex = "#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tazFogW = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );\n#endif";
    C.fog_pars_fragment = "#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying vec3 azFogW;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif";
    C.fog_fragment = [
      "#ifdef USE_FOG",
      "\t#ifdef FOG_EXP2",
      "\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );",
      "\t\tvec3 azFv = azFogW - cameraPosition; float azFl = max( length( azFv ), 0.001 ); vec3 azFd = azFv / azFl;",
      // plus léger en altitude : les sommets et le ciel restent nets, les vallées et la mer se voilent
      "\t\tfogFactor *= mix( 0.52, 1.0, exp( - max( azFogW.y - 6.0, 0.0 ) * 0.011 ) );",
      // voile bas près du sol, même de près (perspective atmosphérique)
      "\t\tfogFactor = max( fogFactor, ( 1.0 - exp( - vFogDepth * 0.0016 ) ) * exp( - max( azFogW.y + 2.0, 0.0 ) * 0.05 ) * 0.35 );",
      "\t\tfloat azSun = pow( max( dot( azFd, vec3( " + SUN.x.toFixed(4) + ", " + SUN.y.toFixed(4) + ", " + SUN.z.toFixed(4) + " ) ), 0.0 ), 6.0 );",
      "\t\tvec3 azFc = mix( fogColor, fogColor * vec3( 1.10, 1.0, 0.84 ) + vec3( 0.05, 0.035, 0.0 ), azSun * 0.75 );",
      "\t\tazFc = mix( azFc, azFc * vec3( 0.9, 0.96, 1.07 ), clamp( azFd.y * 2.0, 0.0, 1.0 ) );",
      "\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, azFc, clamp( fogFactor, 0.0, 1.0 ) );",
      "\t#else",
      "\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );",
      "\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );",
      "\t#endif",
      "#endif",
    ].join("\n");
  }
  function restoreFog() {
    if (!FOG_SAVED) return;
    const C = T.ShaderChunk;
    C.fog_pars_vertex = FOG_SAVED.pv; C.fog_vertex = FOG_SAVED.v; C.fog_pars_fragment = FOG_SAVED.pf; C.fog_fragment = FOG_SAVED.f;
    FOG_SAVED = null;
    const v = root.AZUR && root.AZUR.view;
    if (v && v.scene) v.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach((m) => { m.needsUpdate = true; }); });
  }

  /* ============================================================ post-traitement */
  const QUAD_VS = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
  function pmat(fs, uniforms) {
    return new T.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: MARK.post + fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false, blending: T.NoBlending });
  }
  const PRE_FS = `uniform sampler2D tSrc;uniform vec2 uTexel;uniform float uThr,uKnee;varying vec2 vUv;
vec3 pk(vec2 uv){return min(texture2D(tSrc,uv).rgb,vec3(40.));}
void main(){vec3 c=(pk(vUv+uTexel*vec2(-1.,-1.))+pk(vUv+uTexel*vec2(1.,-1.))+pk(vUv+uTexel*vec2(-1.,1.))+pk(vUv+uTexel*vec2(1.,1.)))*.25;
float br=max(c.r,max(c.g,c.b));float so=clamp(br-uThr+uKnee,0.,2.*uKnee);so=so*so/(4.*uKnee+1e-4);
float w=max(so,br-uThr)/max(br,1e-4);gl_FragColor=vec4(c*w,1.);}`;
  const DOWN_FS = `uniform sampler2D tSrc;uniform vec2 uTexel;varying vec2 vUv;
void main(){vec2 h=uTexel;vec3 s=texture2D(tSrc,vUv).rgb*4.;s+=texture2D(tSrc,vUv-h).rgb;s+=texture2D(tSrc,vUv+h).rgb;s+=texture2D(tSrc,vUv+vec2(h.x,-h.y)).rgb;s+=texture2D(tSrc,vUv-vec2(h.x,-h.y)).rgb;gl_FragColor=vec4(s*.125,1.);}`;
  const UP_FS = `uniform sampler2D tSrc;uniform sampler2D tAdd;uniform vec2 uTexel;uniform float uScatter;varying vec2 vUv;
void main(){vec2 h=uTexel;vec3 s=vec3(0.);
s+=texture2D(tSrc,vUv+vec2(-h.x*2.,0.)).rgb;s+=texture2D(tSrc,vUv+vec2(-h.x,h.y)).rgb*2.;s+=texture2D(tSrc,vUv+vec2(0.,h.y*2.)).rgb;s+=texture2D(tSrc,vUv+vec2(h.x,h.y)).rgb*2.;
s+=texture2D(tSrc,vUv+vec2(h.x*2.,0.)).rgb;s+=texture2D(tSrc,vUv+vec2(h.x,-h.y)).rgb*2.;s+=texture2D(tSrc,vUv+vec2(0.,-h.y*2.)).rgb;s+=texture2D(tSrc,vUv+vec2(-h.x,-h.y)).rgb*2.;
gl_FragColor=vec4(s/12.*uScatter+texture2D(tAdd,vUv).rgb,1.);}`;
  const COMP_FS = `uniform sampler2D tScene;uniform sampler2D tBloom;uniform float uBloom,uExposure,uSat,uContrast,uVig,uBloomOn,uAlpha;uniform vec3 uLift,uGain;varying vec2 vUv;
vec3 rrt(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}
vec3 aces(vec3 c){const mat3 I=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
const mat3 O=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
c*=uExposure/.6;c=I*c;c=rrt(c);c=O*c;return clamp(c,0.,1.);}
vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){vec4 c4=texture2D(tScene,vUv);vec3 c=c4.rgb;
if(uBloomOn>.5)c+=texture2D(tBloom,vUv).rgb*uBloom;
float l=dot(c,vec3(.2126,.7152,.0722));float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));float sat=(mx-mn)/max(mx,1e-4);
c=max(mix(vec3(l),c,uSat+(1.-sat)*.18),vec3(0.));
c=srgb(aces(c));
c=clamp((c-.5)*uContrast+.5,0.,1.);
float L=dot(c,vec3(.299,.587,.114));c*=mix(uLift,uGain,smoothstep(.12,.85,L));
vec2 q=vUv-.5;c*=1.-uVig*smoothstep(.32,.95,length(q*vec2(1.15,1.)));
c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
float a=mix(1.,clamp(c4.a,0.,1.),uAlpha);gl_FragColor=vec4(clamp(c,0.,1.)*a,a);}`;

  class Post {
    constructor(view) {
      this.v = view; this.r = view.renderer; this.ok = false; this.w = 0; this.h = 0; this.sz = new T.Vector2();
      const r = this.r;
      if (!r.capabilities.isWebGL2) return;
      const q = qual(view), samples = q === "high" || q === "ultra" ? 4 : 2;
      this.type = this.test(T.HalfFloatType, samples) ? T.HalfFloatType : this.test(T.UnsignedByteType, samples) ? T.UnsignedByteType : null;
      if (!this.type) return;
      this.samples = samples;
      this.rt = new T.WebGLRenderTarget(4, 4, { type: this.type, samples, depthBuffer: true });
      this.down = []; this.up = [];
      for (let i = 0; i < 5; i++) {
        this.down.push(new T.WebGLRenderTarget(2, 2, { type: this.type, depthBuffer: false }));
        if (i < 4) this.up.push(new T.WebGLRenderTarget(2, 2, { type: this.type, depthBuffer: false }));
      }
      this.mPre = pmat(PRE_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: this.type === T.HalfFloatType ? 1.0 : .82 }, uKnee: { value: .45 } });
      this.mDown = pmat(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
      this.mUp = pmat(UP_FS, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new T.Vector2() }, uScatter: { value: .9 } });
      this.mComp = pmat(COMP_FS, {
        tScene: { value: null }, tBloom: { value: null }, uBloom: { value: .32 }, uExposure: { value: 1 }, uSat: { value: 1.13 }, uContrast: { value: 1.06 }, uVig: { value: .22 },
        uBloomOn: { value: 1 }, uAlpha: { value: 0 }, uLift: { value: new T.Vector3(.965, 1.0, 1.05) }, uGain: { value: new T.Vector3(1.04, 1.0, .95) },
      });
      this.qs = new T.Scene(); this.qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.mComp); this.quad.frustumCulled = false; this.qs.add(this.quad);
      this.ok = true;
    }
    test(type, samples) {
      const r = this.r, gl = r.getContext();
      let rt = null, ok = false;
      try {
        while (gl.getError() !== gl.NO_ERROR) {}
        rt = new T.WebGLRenderTarget(8, 8, { type, samples, depthBuffer: true });
        const prev = r.getRenderTarget();
        r.setRenderTarget(rt); r.clear(true, true, false);
        ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === gl.NO_ERROR;
        r.setRenderTarget(prev);
      } catch (e) { ok = false; }
      if (rt) rt.dispose();
      return ok;
    }
    resize(w, h) {
      this.w = w; this.h = h;
      this.rt.setSize(w, h);
      let dw = Math.max(1, w >> 1), dh = Math.max(1, h >> 1);
      for (let i = 0; i < this.down.length; i++) { this.down[i].setSize(dw, dh); if (i < this.up.length) this.up[i].setSize(dw, dh); dw = Math.max(1, dw >> 1); dh = Math.max(1, dh >> 1); }
    }
    pass(orig, mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); orig(this.qs, this.qc); }
    render(scene, cam, orig) {
      const r = this.r;
      r.getDrawingBufferSize(this.sz);
      const w = this.sz.x | 0, h = this.sz.y | 0;
      if (w < 2 || h < 2) return orig(scene, cam);
      if (w !== this.w || h !== this.h) this.resize(w, h);
      const prevTarget = r.getRenderTarget();
      r.setRenderTarget(this.rt);
      orig(scene, cam);
      const bloom = !lowQ(this.v);
      if (bloom) {
        this.mPre.uniforms.tSrc.value = this.rt.texture; this.mPre.uniforms.uTexel.value.set(1 / w, 1 / h);
        this.pass(orig, this.mPre, this.down[0]);
        for (let i = 1; i < this.down.length; i++) { const s = this.down[i - 1]; this.mDown.uniforms.tSrc.value = s.texture; this.mDown.uniforms.uTexel.value.set(1 / s.width, 1 / s.height); this.pass(orig, this.mDown, this.down[i]); }
        let src = this.down[this.down.length - 1];
        for (let i = this.up.length - 1; i >= 0; i--) { this.mUp.uniforms.tSrc.value = src.texture; this.mUp.uniforms.tAdd.value = this.down[i].texture; this.mUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); this.pass(orig, this.mUp, this.up[i]); src = this.up[i]; }
      }
      const u = this.mComp.uniforms, ev = isEvent();
      u.tScene.value = this.rt.texture; u.tBloom.value = this.up[0].texture; u.uBloomOn.value = bloom ? 1 : 0; u.uAlpha.value = scene === this.v.scene ? 0 : 1;
      u.uExposure.value = r.toneMappingExposure * (ev ? 1 : 1.04);
      u.uBloom.value = ev ? .42 : .3; u.uSat.value = ev ? 1.05 : 1.14; u.uContrast.value = ev ? 1.03 : 1.07; u.uVig.value = ev ? .28 : .2;
      this.pass(orig, this.mComp, prevTarget);
    }
  }
  function hookRender(view) {
    const r = view.renderer;
    if (!r || r.__az94Post) return;
    r.__az94Post = true;
    watchShaders(r);
    const orig = r.render.bind(r);
    r.render = function (scene, cam) {
      if (G.on.post && !lowQ(view) && r.getRenderTarget() === null && (scene === view.scene || scene === view.menuScene) && cam && cam.isCamera) {
        try {
          if (!view.__az94Post) view.__az94Post = new Post(view);
          const P = view.__az94Post;
          if (P.ok) return P.render(scene, cam, orig);
        } catch (e) { disable("post", String(e && e.message || e)); r.setRenderTarget(null); }
      }
      return orig(scene, cam);
    };
  }

  /* ============================================================ ciel */
  const SKY_FS = MARK.sky + `uniform float day,time,dusk,clouds;uniform vec3 sunDir;varying vec3 vD;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){vec3 d=normalize(vD);float y=d.y,yy=max(y,0.),sd=max(0.,dot(d,sunDir));
vec3 zen=vec3(.085,.33,.82),mid=vec3(.25,.56,.95),hor=vec3(.70,.86,.98);
vec3 c=mix(hor,mid,smoothstep(0.,.24,yy));c=mix(c,zen,smoothstep(.18,.92,yy));
c+=vec3(1.,.80,.52)*pow(sd,5.)*.16+vec3(1.,.90,.70)*pow(sd,36.)*.42;
c=mix(c,vec3(.68,.82,.92),smoothstep(0.,-.14,y));
if(y>.008&&clouds>.01){vec2 uv=d.xz/(y+.085)*.85+vec2(time*.0055,time*.002);
float n=fbm(uv*1.25+vec2(fbm(uv*.6)*.8));float cov=smoothstep(.47,.76,n)*clouds;
float n2=fbm(uv*1.25+vec2(fbm(uv*.6)*.8)+sunDir.xz*.16);float lit=clamp(1.-(n2-n)*3.2,0.,1.);
vec3 cc=mix(vec3(.58,.66,.80),vec3(1.06,1.04,1.01),lit*.7+.3*smoothstep(.5,.92,n));
cc+=vec3(1.,.84,.6)*pow(sd,4.)*.32*(1.-cov*.4);
float fade=smoothstep(.008,.2,y);c=mix(c,cc,cov*fade*.96);
float ci=fbm(vec2(uv.x*.3,uv.y*2.4)*.7+time*.002);c+=vec3(.92,.96,1.)*smoothstep(.6,.9,ci)*.09*fade*clouds;}
c=mix(c,vec3(1.7,1.58,1.38),smoothstep(.99962,.99984,sd));
vec3 dc=mix(vec3(1.,.5,.33),vec3(.36,.27,.6),smoothstep(0.,.55,yy));c=mix(c,dc*(.62+.38*c),dusk*.7);
vec3 night=vec3(.012,.03,.09)+vec3(.035,.055,.10)*(1.-abs(y));
vec2 sp=d.xz/(abs(y)+.25)*90.;float st=step(.9968,h21(floor(sp)))*smoothstep(0.,.3,y)*(.5+.5*sin(time*3.+h21(floor(sp)+3.)*30.));
night+=vec3(st)*1.2;c=mix(night,c,day);gl_FragColor=vec4(c,1.);}`;
  const SKY_VS = "varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}";
  function skyMaterial(src) {
    const u = src && src.uniforms;
    return new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: true, fog: false,
      uniforms: { day: u && u.day || { value: 1 }, time: u && u.time || { value: 0 }, dusk: u && u.dusk || { value: 0 }, sunDir: { value: SUN.clone() }, clouds: { value: 1 } },
      vertexShader: SKY_VS, fragmentShader: SKY_FS,
    });
  }

  /* ============================================================ environnement (IBL) */
  const ENV = { key: "", tex: null, cache: {} };
  function envFor(renderer, day, dusk) {
    const key = (day > .7 ? "d" : day > .3 ? "m" : "n") + (dusk > .5 ? "s" : "");
    if (ENV.cache[key]) return ENV.cache[key];
    const pm = new T.PMREMGenerator(renderer);
    const sc = new T.Scene();
    const m = skyMaterial(null); m.uniforms.day.value = key[0] === "d" ? 1 : key[0] === "m" ? .5 : .1; m.uniforms.dusk.value = dusk > .5 ? 1 : 0; m.uniforms.clouds.value = .55;
    sc.add(new T.Mesh(new T.SphereGeometry(100, 48, 24), m));
    const g = new T.Mesh(new T.CircleGeometry(95, 32), new T.MeshBasicMaterial({ color: new T.Color("#56803f").multiplyScalar(key[0] === "d" ? .55 : key[0] === "m" ? .3 : .06) }));
    g.rotation.x = -Math.PI / 2; g.position.y = -4; sc.add(g);
    const rt = pm.fromScene(sc, .035, .1, 300);
    pm.dispose(); m.dispose(); g.geometry.dispose(); g.material.dispose();
    ENV.cache[key] = rt.texture;
    return rt.texture;
  }

  /* ============================================================ terrain */
  const TER_NOISE = `float azH2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float azVn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(azH2(i),azH2(i+vec2(1.,0.)),f.x),mix(azH2(i+vec2(0.,1.)),azH2(i+vec2(1.,1.)),f.x),f.y);}
float azFbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*azVn(p);p=p*2.07+vec2(5.1,1.3);a*=.5;}return s;}`;
  function patchTerrain(mat) {
    if (!mat || mat.__az94) return;
    mat.__az94 = true;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      if (!G.on.terrain) return;
      sh.uniforms.uAzT = G.time;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 azZ;\nvarying vec4 vAzZ;\nvarying vec3 vAzW;\nvarying vec3 vAzN;")
        .replace("#include <project_vertex>", "#include <project_vertex>\n  vAzZ = azZ; vAzW = (modelMatrix * vec4(transformed, 1.0)).xyz; vAzN = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = MARK.terrain + sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uAzT;\nvarying vec4 vAzZ;\nvarying vec3 vAzW;\nvarying vec3 vAzN;\n" + TER_NOISE)
        .replace("#include <color_fragment>", `#include <color_fragment>
  float azDist = length(vAzW - cameraPosition), azFd = 1. - smoothstep(55., 240., azDist);
  float azM1 = azFbm(vAzW.xz * .011);
  diffuseColor.rgb *= .86 + .28 * azM1;
  float azM2 = azVn(vAzW.xz * .33) * .5 + azVn(vAzW.xz * 1.37) * .5;
  diffuseColor.rgb *= mix(1., .88 + .24 * azM2, azFd);
  float azSl = 1. - clamp(vAzN.y, 0., 1.);
  vec3 azRock = vec3(.47, .42, .36) * (.8 + .4 * azVn(vAzW.xz * .21 + vAzW.y * .3));
  diffuseColor.rgb = mix(diffuseColor.rgb, azRock, smoothstep(.34, .6, azSl) * (1. - vAzZ.x * .6));
  float azRip = sin(dot(vAzW.xz, vec2(.82, .36)) * 1.6 + azVn(vAzW.xz * .07) * 7.) * .5 + .5;
  diffuseColor.rgb *= mix(1., .9 + .14 * azRip, vAzZ.y * azFd);
  float azLv = smoothstep(.25, .6, vAzZ.z);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.07, .05, .045), azLv * .9);
  float azCl = smoothstep(.46, .74, azFbm(vAzW.xz * .0038 + uAzT * vec2(.011, .0045)));
  diffuseColor.rgb *= 1. - azCl * .2;`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  { float e = .35, b0 = azVn(vAzW.xz * .9), bx = azVn((vAzW.xz + vec2(e, 0.)) * .9), bz = azVn((vAzW.xz + vec2(0., e)) * .9);
    vec3 azB = vec3(b0 - bx, 0., b0 - bz) * 1.1 * azFd * (1. - azLv);
    normal = normalize(normal + (viewMatrix * vec4(azB, 0.)).xyz); }`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  { float azCr = smoothstep(.42, .62, azFbm(vAzW.xz * .06 + vec2(uAzT * .02, -uAzT * .013)));
    float azPulse = .75 + .25 * sin(uAzT * 1.7 + azVn(vAzW.xz * .05) * 9.);
    totalEmissiveRadiance += vec3(2.6, .78, .12) * azLv * (.25 + .9 * azCr) * azPulse;
    float azSp = step(.9955, azH2(floor(vAzW.xz * 5.))) * vAzZ.x * azFd;
    totalEmissiveRadiance += vec3(azSp) * .9; }`);
    };
    mat.customProgramCacheKey = () => "azTer94" + (G.on.terrain ? 1 : 0);
    mat.needsUpdate = true;
  }
  function rebuildTerrain(env, n) {
    const M = S.MAP, geo = new T.PlaneGeometry(M.halfSize * 2, M.halfSize * 2, n, n);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, zt = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, S.heightAt(x, z));
      const w = S.zoneWeights(x, z), ff = S.forestField ? S.forestField(x, z) : 0;
      zt[i * 4] = w.snow || 0; zt[i * 4 + 1] = w.desert || 0; zt[i * 4 + 2] = w.lava || 0; zt[i * 4 + 3] = Math.max(0, Math.min(1, (ff + 1.3) / 3.4));
    }
    geo.computeVertexNormals();
    geo.setAttribute("azZ", new T.BufferAttribute(zt, 4));
    const old = env.terrain.geometry;
    env.terrain.geometry = geo;
    if (old) old.dispose();
    env.terrainPositions = pos; env.terrainSegments = n;
  }
  function ensureTerrainZones(env) {
    const geo = env.terrain && env.terrain.geometry;
    if (!geo || geo.attributes.azZ) return;
    const pos = geo.attributes.position, zt = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), w = S.zoneWeights(x, z); zt[i * 4] = w.snow || 0; zt[i * 4 + 1] = w.desert || 0; zt[i * 4 + 2] = w.lava || 0; zt[i * 4 + 3] = 0; }
    geo.setAttribute("azZ", new T.BufferAttribute(zt, 4));
  }
  if (EP && EP.ensureCh1World) {
    const prevEnsure = EP.ensureCh1World;
    EP.ensureCh1World = function () {
      if (!this.ch1World && !this.__az94Ter && this.terrain) {
        this.__az94Ter = true;
        const v = root.AZUR && root.AZUR.view;
        try { if (G.on.terrain && !lowQ(v)) rebuildTerrain(this, qual(v) === "high" || qual(v) === "ultra" ? 352 : 300); } catch (e) { if (root.console) console.warn("[AZUR graphismes] terrain", e); }
      }
      const cw = prevEnsure.apply(this, arguments);
      try { if (this.terrain && !this.terrain.material.__az94) { ensureTerrainZones(this); patchTerrain(this.terrain.material); } } catch (e) {}
      try { if (cw && cw.sky && !cw.sky.__az94 && G.on.sky) { cw.sky.__az94 = true; const old = cw.sky.material; cw.sky.material = skyMaterial(old); old.dispose(); } } catch (e) {}
      return cw;
    };
  }

  /* ============================================================ eau */
  const WAT_FS_COMMON = `uniform float uAzT;uniform sampler2D tAzDepth;uniform float uAzHalf;varying vec3 vAzW;
float wH(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float wN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wH(i),wH(i+vec2(1.,0.)),f.x),mix(wH(i+vec2(0.,1.)),wH(i+vec2(1.,1.)),f.x),f.y);}
float wDepth(){vec2 uv=(vAzW.xz+uAzHalf)/(2.*uAzHalf);if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 30.;return texture2D(tAzDepth,uv).r*30.;}`;
  function depthTexture() {
    const n = 512, half = S.MAP.halfSize, data = new Uint8Array(n * n * 4), SEA = -2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + .5) / n * half * 2 - half, z = (j + .5) / n * half * 2 - half, h = S.heightAt(x, z), dpt = Math.max(0, Math.min(30, SEA - h));
      const k = (j * n + i) * 4; data[k] = Math.round(dpt / 30 * 255); data[k + 1] = 0; data[k + 2] = 0; data[k + 3] = 255;
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat, T.UnsignedByteType);
    t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  }
  function waterMaterial() {
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .07, metalness: 0, transparent: true, envMapIntensity: 1.15 });
    const U = { tAzDepth: { value: depthTexture() }, uAzHalf: { value: S.MAP.halfSize } };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uAzT = G.time; sh.uniforms.tAzDepth = U.tAzDepth; sh.uniforms.uAzHalf = U.uAzHalf;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vAzW;\nuniform float uAzT;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n  { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; transformed.z += (sin(wp.x * .035 + uAzT * .7) * .12 + cos(wp.z * .05 - uAzT * .5) * .08); }")
        .replace("#include <project_vertex>", "#include <project_vertex>\n  vAzW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = MARK.water + sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + WAT_FS_COMMON)
        .replace("#include <color_fragment>", `#include <color_fragment>
  float azDp = wDepth();
  vec3 azShallow = vec3(.22, .78, .80), azMid = vec3(.05, .48, .70), azDeep = vec3(.015, .20, .42);
  diffuseColor.rgb = mix(azShallow, azMid, smoothstep(0., 3.5, azDp));
  diffuseColor.rgb = mix(diffuseColor.rgb, azDeep, smoothstep(3.5, 18., azDp));
  diffuseColor.a = mix(.42, .94, smoothstep(0., 4., azDp));`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  { float azDist = length(vAzW - cameraPosition), azF = 1. - smoothstep(80., 600., azDist);
    vec2 p1 = vAzW.xz * .18 + vec2(uAzT * .35, uAzT * .21), p2 = vAzW.xz * .47 - vec2(uAzT * .29, -uAzT * .4), p3 = vAzW.xz * 1.3 + vec2(uAzT * .9, uAzT * .6);
    float e = .25;
    float a0 = wN(p1) + wN(p2) * .5 + wN(p3) * .25;
    float ax = wN(p1 + vec2(e, 0.)) + wN(p2 + vec2(e, 0.)) * .5 + wN(p3 + vec2(e, 0.)) * .25;
    float az = wN(p1 + vec2(0., e)) + wN(p2 + vec2(0., e)) * .5 + wN(p3 + vec2(0., e)) * .25;
    vec3 azWn = vec3(a0 - ax, 0., a0 - az) * (.55 + .9 * azF);
    normal = normalize(normal + (viewMatrix * vec4(azWn, 0.)).xyz); }`)
        .replace("#include <opaque_fragment>", `{ float azSh = 1. - smoothstep(.05, 1.1, azDp + (wN(vAzW.xz * .6 + uAzT * .25) - .5) * .6);
    float azBand = smoothstep(.55, 1., sin(azDp * 9. - uAzT * 2.2) * .5 + .5) * (1. - smoothstep(.2, 2.2, azDp));
    float azFoam = clamp(azSh * .85 + azBand * .45, 0., 1.) * step(.001, azDp);
    outgoingLight = mix(outgoingLight, vec3(.92, .97, 1.) * (.62 + .38 * clamp(dot(outgoingLight, vec3(.33)) * 2.5, 0., 1.)), azFoam * .8);
    diffuseColor.a = max(diffuseColor.a, azFoam * .9); }
  #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => "azWat94";
    return mat;
  }
  function installWater(env) {
    if (!env.water || env.__az94Water || !G.on.water) return;
    env.__az94Water = true;
    try {
      const old = env.water.material;
      const m = waterMaterial();
      env.water.material = m; env.water.receiveShadow = true; env.water.renderOrder = 1;
      env.__az94WaterOld = old;
    } catch (e) { if (root.console) console.warn("[AZUR graphismes] eau", e); }
  }

  /* ============================================================ herbe dense */
  const GRASS = { mesh: null, cx: 1e9, cz: 1e9, max: 0, r: 0 };
  function grassGeometry() {
    const pos = [], col = [], bend = [], R = (s) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };
    for (let b = 0; b < 7; b++) {
      const a = (b / 7) * Math.PI * 2 + R(b) * .8, rr = .05 + R(b + 3) * .16, x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = .32 + R(b + 7) * .42, wdt = .035 + R(b + 11) * .03;
      const lean = (R(b + 13) - .5) * .5, lx = Math.cos(a) * lean * .4, lz = Math.sin(a) * lean * .4, px = -Math.sin(a) * wdt, pz = Math.cos(a) * wdt;
      // brin : base large, pointe effilée (deux triangles)
      const v = [[x - px, 0, z - pz, 0], [x + px, 0, z + pz, 0], [x + lx * .5 + px * .55, h * .55, z + lz * .5 + pz * .55, .55], [x + lx * .5 - px * .55, h * .55, z + lz * .5 - pz * .55, .55], [x + lx, h, z + lz, 1]];
      const tris = [[0, 1, 2], [0, 2, 3], [3, 2, 4]];
      for (const t of tris) for (const k of t) { const q = v[k]; pos.push(q[0], q[1], q[2]); const s = .55 + q[3] * .6; col.push(s, s, s); bend.push(q[3]); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("azBend", new T.Float32BufferAttribute(bend, 1));
    g.setAttribute("normal", new T.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    return g;
  }
  function grassMaterial() {
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, side: T.DoubleSide });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uAzT = G.time;
      sh.vertexShader = MARK.grass + sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float azBend;\nuniform float uAzT;")
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
  { vec3 ip = vec3(0.);
  #ifdef USE_INSTANCING
    ip = instanceMatrix[3].xyz;
  #endif
    float wv = sin(uAzT * 1.6 + ip.x * .21 + ip.z * .13) + .5 * sin(uAzT * 2.7 + ip.x * .53 - ip.z * .37);
    float gust = .5 + .5 * sin(uAzT * .35 + ip.x * .012 + ip.z * .009);
    transformed.x += wv * azBend * azBend * (.07 + .1 * gust); transformed.z += wv * azBend * azBend * .05; }`);
    };
    m.customProgramCacheKey = () => "azGrass94";
    return m;
  }
  const _gd = new T.Object3D(), _gc = new T.Color();
  function grassUpdate(view, p) {
    if (!G.on.grass || lowQ(view) || !view.scene || !p) { if (GRASS.mesh) GRASS.mesh.visible = false; return; }
    const R = qual(view) === "high" || qual(view) === "ultra" ? 52 : 38, CELL = 8, PER = 26;
    if (!GRASS.mesh || GRASS.r !== R) {
      if (GRASS.mesh) { GRASS.mesh.parent && GRASS.mesh.parent.remove(GRASS.mesh); GRASS.mesh.geometry.dispose(); GRASS.mesh.material.dispose(); }
      const cells = Math.pow(Math.ceil((R * 2) / CELL) + 1, 2);
      GRASS.max = cells * PER; GRASS.r = R;
      GRASS.mesh = new T.InstancedMesh(grassGeometry(), grassMaterial(), GRASS.max);
      GRASS.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); GRASS.mesh.count = 0; GRASS.mesh.frustumCulled = false; GRASS.mesh.castShadow = false; GRASS.mesh.receiveShadow = true;
      GRASS.mesh.setColorAt(0, _gc.set(1, 1, 1)); GRASS.mesh.raycast = function () {};
      view.scene.add(GRASS.mesh); GRASS.cx = 1e9;
    }
    GRASS.mesh.visible = !(p.falling || p.gliding || (root.AZUR && root.AZUR.world && root.AZUR.world.phase === "transport"));
    const cx = Math.round(p.x / CELL), cz = Math.round(p.z / CELL);
    if (cx === GRASS.cx && cz === GRASS.cz) return;
    GRASS.cx = cx; GRASS.cz = cz;
    const env = view.environment, gH = env && env.surfaceHeight && env.terrainPositions ? (x, z) => env.surfaceHeight(x, z) : (x, z) => S.heightAt(x, z);
    const gc = root.AZCh1World && root.AZCh1World.groundColor;
    let n = 0;
    const span = Math.ceil(R / CELL);
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const gx = cx + i, gz = cz + j, ox = gx * CELL, oz = gz * CELL;
      if (Math.hypot(ox - p.x, oz - p.z) > R + CELL) continue;
      if (S.biomeAt(ox, oz) !== "grass") continue;
      for (let k = 0; k < PER && n < GRASS.max; k++) {
        const h1 = Math.sin((gx * 92.17 + gz * 31.7 + k * 7.31)) * 43758.5453, r1 = h1 - Math.floor(h1), h2 = Math.sin((gx * 12.9 + gz * 78.2 + k * 3.7)) * 24634.6345, r2 = h2 - Math.floor(h2);
        const x = ox + (r1 - .5) * CELL, z = oz + (r2 - .5) * CELL, d = Math.hypot(x - p.x, z - p.z);
        if (d > R) continue;
        if (S.routeDist && S.routeDist(x, z) < 3.2) continue;
        const pad = S.townPad && S.townPad(x, z, -6);
        if (pad && ((r1 * 13.7) % 1) < .8) continue;
        if (S.isWater(x, z)) continue;
        const y = gH(x, z);
        if (y < -1.4) continue;
        const zw = S.zoneWeights(x, z); if (zw.snow > .3 || zw.desert > .3 || (zw.volcano || 0) > .3 || (zw.lava || 0) > .1) continue;
        const s = (.75 + r1 * .7) * (1 - Math.pow(Math.max(0, (d - R * .7) / (R * .3)), 2));
        _gd.position.set(x, y - .02, z); _gd.rotation.set(0, r2 * 6.283, 0); _gd.scale.set(s, s * (.8 + r2 * .55), s); _gd.updateMatrix();
        GRASS.mesh.setMatrixAt(n, _gd.matrix);
        if (gc) { const c = gc(x, z); _gc.setRGB(c.r * 1.05, c.g * 1.12, c.b * .95); } else _gc.setRGB(.33, .62, .2);
        _gc.multiplyScalar(.9 + r2 * .25);
        GRASS.mesh.setColorAt(n, _gc); n++;
      }
    }
    GRASS.mesh.count = n; GRASS.mesh.instanceMatrix.needsUpdate = true; if (GRASS.mesh.instanceColor) GRASS.mesh.instanceColor.needsUpdate = true;
  }

  /* ============================================================ ombres stables et douces */
  const _sv = new T.Vector3(), _sr = new T.Vector3(), _su = new T.Vector3(), _sf = new T.Vector3();
  function stabilizeShadow(view) {
    const L = view.sun;
    if (!L || !L.castShadow || !L.shadow || !L.shadow.camera) return;
    const cam = L.shadow.camera, size = L.shadow.mapSize.x || 1024, texel = (cam.right - cam.left) / size;
    _sf.copy(L.target.position).sub(L.position).normalize();
    _sr.crossVectors(_sf, _sv.set(0, 1, 0)).normalize(); _su.crossVectors(_sr, _sf).normalize();
    const t = L.target.position, a = t.dot(_sr), b = t.dot(_su), da = Math.round(a / texel) * texel - a, db = Math.round(b / texel) * texel - b;
    _sv.copy(_sr).multiplyScalar(da).addScaledVector(_su, db);
    t.add(_sv); L.position.add(_sv); L.target.updateMatrixWorld();
  }

  /* ============================================================ intégration à la vue */
  const prevUpdate = VP.update;
  VP.update = function (w, p, dt, opts) {
    const o = opts || {};
    try {
      if (!this.__az94Init) {
        this.__az94Init = true;
        watchShaders(this.renderer);
        if (this.renderer.capabilities.isWebGL2) installFog();
        hookRender(this);
      }
    } catch (e) { if (root.console) console.warn("[AZUR graphismes] init", e); }
    G.time.value += Math.min(.1, Math.max(0, +dt || 0));
    const r = prevUpdate.apply(this, arguments);
    try {
      if (!o.menu && this.scene) {
        const ev = isEvent(), env = this.environment, q = qual(this);
        if (env) installWater(env);
        // ombres douces
        if (G.on.shadows && this.renderer.shadowMap.enabled && q !== "low" && q !== "ultra" && this.renderer.shadowMap.type !== T.PCFSoftShadowMap) { this.renderer.shadowMap.type = T.PCFSoftShadowMap; this.scene.traverse((m) => { if (m.material && !Array.isArray(m.material)) m.material.needsUpdate = true; }); }
        if (G.on.shadows) stabilizeShadow(this);
        // éclairage d'ambiance par l'environnement (hors événement : ses propres lumières)
        const tod = o.timeOfDay || (root.AZUR && root.AZUR.timeOfDay);
        const day = tod === "night" ? .12 : tod === "sunset" ? .63 : 1, dusk = tod === "sunset" ? 1 : 0;
        if (G.on.ibl && !ev && q !== "low") {
          try { const tex = envFor(this.renderer, day, dusk); if (this.scene.environment !== tex) this.scene.environment = tex; } catch (e) { disable("ibl", String(e && e.message || e)); }
          if (this.hemi) this.hemi.intensity *= .42;
          if (this.skyFill) this.skyFill.intensity *= .6;
          if (this.sun) this.sun.intensity *= 1.08;
        } else if (this.scene.environment && ENV.cache && Object.values(ENV.cache).indexOf(this.scene.environment) >= 0) this.scene.environment = null;
        grassUpdate(this, p);
      }
    } catch (e) { if (!G.__frameErr) { G.__frameErr = 1; if (root.console) console.warn("[AZUR graphismes] image", e); } }
    return r;
  };
  root.AZGfx94.reset = function () { try { localStorage.removeItem(KEY); } catch (e) {} };
})(typeof window !== "undefined" ? window : globalThis);
