/* AZUR Horizons — renderer. Simulation remains separate and authoritative. */
(function (root) {
  "use strict";
  const T = THREE,
    S = AZSim,
    A = AZArt,
    clamp = T.MathUtils.clamp;
  class View {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new T.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFShadowMap;
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.07;
      this.renderer.setClearColor(0, 0);
      this.scene = new T.Scene();
      this.scene.fog = new T.FogExp2("#b7e4ea", 0.00095);
      // Reused colours keep the main render loop allocation-free while preserving
      // the readable cool-to-warm day/night fog transition.
      this.fogDay = new T.Color("#b7e4ea");
      this.fogNight = new T.Color("#334c6d");
      this.camera = new T.PerspectiveCamera(65, 1, 0.09, 4500);
      this.hemi = new T.HemisphereLight("#d9f5ff", "#718450", 2.05);
      this.scene.add(this.hemi);
      this.sun = new T.DirectionalLight("#fff0cf", 2.7);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      Object.assign(this.sun.shadow.camera, {
        left: -47,
        right: 47,
        top: 47,
        bottom: -47,
        near: 1,
        far: 220,
      });
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.04;
      this.scene.add(this.sun, this.sun.target);
      // A low-cost cyan sky fill keeps the new terrain/city dressing legible on
      // the shadow side without another shadow map or any extra geometry.
      this.skyFill = new T.DirectionalLight('#79d8e6', .34);
      this.skyFill.castShadow = false;
      this.scene.add(this.skyFill);
      this.environment = new AZEnvironment.Environment(this.scene);
      // Preserve crisp procedural ground/road detail at oblique camera angles. This
      // uses the GPU's supported ceiling and adds no network texture dependency.
      const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() || 1);
      this.environment.root.traverse((node) => {
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        materials.forEach((mat) => {
          if (mat.map) { mat.map.anisotropy = anisotropy; mat.map.needsUpdate = true; }
        });
      });
      this.worldRoot = new T.Group();
      this.actorRoot = new T.Group();
      this.scene.add(this.worldRoot, this.actorRoot);
      this.objects = new Map();
      this.actors = new Map();
      this.builds = new Map();
      this.loot = new Map();
      this.vehicles = new Map();
      this.particles = [];
      this.texts = [];
      // Moving hitscan visualisations are separate from UI sprites: they have a
      // strict cap, own geometry/material lifetime, and never accumulate in text.
      this.shotEffects = [];
      this.time = 0;
      this.lastEvent = 0;
      this.menuRotation = 0;
      this.quality = "medium";
      // High is a desktop-first profile. A coarse-pointer/small-screen fallback
      // keeps an explicitly requested high profile from exhausting mobile GPUs.
      this.mobileRenderer = (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")) ||
        (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && typeof screen !== "undefined" && Math.min(screen.width || Infinity, screen.height || Infinity) < 900);
      this.performanceAuto = true;
      this._perfMs = 16.7;
      this._perfGood = 0;
      this._perfBad = 0;
      this.drawDistance = 430;
      this.ray = new T.Raycaster();
      // v21 wiring (worker câblage) : état caméra cinématique — secousse par
      // trauma, transitions amorties, FOV sprint. Les vecteurs scratch gardent
      // les maths caméra par frame sans allocation.
      this._shake = 0;
      this._camMode = "";
      this._camT = new T.Vector3();
      this._camB = new T.Vector3();
      this._camD = new T.Vector3();
      this._camS = new T.Vector3();
      this._fxPos = new T.Vector3();
      // v21 perf : tampons réutilisés — zéro allocation dans les boucles chaudes.
      this._nearBuf = [];
      this._idSet = new Set();
      this._obsBuf = [];
      this._vehSet = new Set();
      this.aircraft = A.aircraft();
      this.scene.add(this.aircraft);
      this.makeEffects();
      this.makeMenu();
      this.resize();
    }
    resize() {
      const w = this.canvas.clientWidth,
        h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.menuCamera.aspect = w / h;
      this.menuCamera.updateProjectionMatrix();
    }
    configure(s = {}) {
      const requested = s.quality;
      this.quality = ["low", "medium", "high", "ultra"].includes(requested) ? requested : "medium";
      this.performanceAuto = s.performance !== false;
      this._perfMs = 16.7;
      this._perfGood = this._perfBad = 0;
      const ultra = this.quality === "ultra", high = this.quality === "high" || ultra, low = this.quality === "low";
      this.drawDistance = low ? 240 : ultra ? 980 : high ? 780 : 450;
      const pixelCap = low ? 1 : ultra ? (this.mobileRenderer ? 1.65 : 2.25) : high ? (this.mobileRenderer ? 1.5 : 2) : (this.mobileRenderer ? 1.15 : 1.35);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelCap));
      this.allowShadows = s.shadows !== false && !low;
      this.renderer.shadowMap.enabled = this.allowShadows;
      // High uses a tighter, denser PC shadow atlas. The mobile fallback retains
      // the stable medium atlas rather than silently allocating a 2048px target.
      const shadowSize = ultra && !this.mobileRenderer ? 4096 : high && !this.mobileRenderer ? 2048 : 1024;
      if (this.sun.shadow.map && this.sun.shadow.map.width !== shadowSize) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      if (this.sun.shadow.map && this.sun.shadow.map.width !== shadowSize) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      const shadowExtent = high ? 54 : 47;
      Object.assign(this.sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: high ? 250 : 220 });
      this.sun.shadow.camera.updateProjectionMatrix();
      this.sun.shadow.radius = high ? 1.15 : 1.8;
      this.renderer.shadowMap.type = T.PCFShadowMap;
      // v21 wiring : les budgets FX poolés suivent la classe d'appareil détectée.
      if (A.fx && A.fx.setMobile) A.fx.setMobile(this.mobileRenderer || this.quality === "low");
      this.resize();
    }
    disposeTree(g) {
      g.traverse((o) => {
        if (o.geometry && !o.isSprite) o.geometry.dispose();
        if (o.material && o.material !== A.material && !o.userData.shared) {
          const arr = Array.isArray(o.material) ? o.material : [o.material];
          arr.forEach((m) => {
            if (m !== A.material) m.dispose();
          });
        }
      });
      g.clear?.();
    }
    makeEffects() {
      this.particleMesh = new T.InstancedMesh(
        new T.IcosahedronGeometry(0.095, 0),
        new T.MeshBasicMaterial({ vertexColors: false }),
        280,
      );
      this.particleMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.particleMesh.frustumCulled = false;
      this.scene.add(this.particleMesh);
      this.dummy = new T.Object3D();
      // Scratch objects keep the per-frame hot loops allocation-free. They are
      // only ever read immediately (copy/lerp/setColorAt), never stored.
      this._scratchColor = new T.Color();
      this._scratchV1 = new T.Vector3();
      this._scratchV2 = new T.Vector3();
      this._scratchV3 = new T.Vector3();
      this._upY = new T.Vector3(0, 1, 0);
      this.stormWall = new T.Mesh(
        new T.CylinderGeometry(1, 1, 600, 100, 1, true),
        new T.ShaderMaterial({
          side: T.DoubleSide,
          transparent: true,
          depthWrite: false,
          uniforms: { time: { value: 0 } },
          vertexShader:
            "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader:
            "varying vec2 vUv;uniform float time;void main(){float pulse=sin(vUv.x*200.+time*3.)*.5+.5;float y=sin(vUv.y*60.-time*2.);gl_FragColor=vec4(.48,.35,.95,.09+pulse*.075+y*.025);}",
        }),
      );
      this.scene.add(this.stormWall);
      this.stormRing = new T.Mesh(
        new T.TorusGeometry(1, 0.004, 5, 128),
        new T.MeshBasicMaterial({ color: "#c3aaff", transparent: true, opacity: 0.7 }),
      );
      this.stormRing.rotation.x = Math.PI / 2;
      this.scene.add(this.stormRing);
      // Far-away actors remain visibly represented without rendering 100 detailed rigs.
      this.farActors = new T.InstancedMesh(
        new T.CylinderGeometry(0.25, 0.29, 1.75, 6),
        new T.MeshStandardMaterial({ color: "#426a87", roughness: 0.9 }),
        101,
      );
      this.farActors.frustumCulled = false;
      this.scene.add(this.farActors);
      // All far buildings share one draw call; detailed city meshes are streamed only nearby.
      const facade=document.createElement('canvas');facade.width=64;facade.height=128;const fx=facade.getContext('2d');
      fx.fillStyle='#c9d0d0';fx.fillRect(0,0,64,128);
      for(let yy=5;yy<128;yy+=16)for(let xx=8;xx<64;xx+=22){fx.fillStyle=((yy+xx)%3)?'#547d91':'#b3e2db';fx.fillRect(xx,yy,12,9);}
      const tex=new T.CanvasTexture(facade);tex.colorSpace=T.SRGBColorSpace;
      const lodMaterial=root.AZCityFacade?root.AZCityFacade.material():new T.MeshStandardMaterial({color:'#ffffff',map:tex,roughness:.86});
      this.houseLOD=new T.InstancedMesh(new T.BoxGeometry(1,1,1),lodMaterial,900);
      this.houseLOD.count=0;this.houseLOD.frustumCulled=false;this.houseLOD.castShadow=false;this.scene.add(this.houseLOD);
      this.houseLODColors=S.regions.map(r=>new T.Color(r.color).lerp(new T.Color('#e3e2d6'),.76));
      this.marker = new T.Group();
      const beam = new T.Mesh(
        new T.CylinderGeometry(0.07, 0.25, 95, 8),
        new T.MeshBasicMaterial({ color: "#ffce73", transparent: true, opacity: 0.4, depthWrite: false }),
      );
      beam.position.y = 47.5;
      this.marker.add(beam);
      const pin = new T.Mesh(new T.OctahedronGeometry(1), new T.MeshBasicMaterial({ color: "#ffe099" }));
      pin.position.y = 5;
      this.marker.add(pin);
      this.marker.visible = false;
      this.scene.add(this.marker);
    }
    clearShotEffects() {
      for (const fx of this.shotEffects || []) {
        this.scene.remove(fx.group);
        this.disposeTree(fx.group);
      }
      this.shotEffects = [];
    }
    // v21 wiring : secousse dosée (trauma 0..1, décroît toute seule). Exposée
    // pour les modules event-* : AZUR.view.addShake(x) reste un appel additif sûr.
    addShake(amount) {
      this._shake = Math.min(1, this._shake + amount);
    }
    spawnShotEffect(start, end, local, weapon) {
      // Simulation remains hitscan; this short, fast travelling head only makes the
      // already-authoritative ray readable. Cap it before allocating anything.
      if (this.shotEffects.length >= 56) {
        const old = this.shotEffects.shift();
        this.scene.remove(old.group); this.disposeTree(old.group);
      }
      const group = new T.Group();
      const warm = local ? "#fff4a8" : "#ffbf83";
      const beamMat = new T.MeshBasicMaterial({ color: warm, transparent: true, opacity: .92, depthWrite: false, blending: T.AdditiveBlending });
      const beam = new T.Mesh(new T.CylinderGeometry(.027, .045, 1, 7), beamMat);
      const head = new T.Mesh(new T.IcosahedronGeometry(.105, 1), new T.MeshBasicMaterial({ color: "#fffbe1", transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending }));
      const flash = new T.Mesh(new T.SphereGeometry(.14, 8, 6), new T.MeshBasicMaterial({ color: "#fff3bc", transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending }));
      flash.position.copy(start); flash.scale.set(.9, .9, 1.7);
      group.add(beam, head, flash); this.scene.add(group);
      const distance = start.distanceTo(end), duration = clamp(distance / 720, .055, .18);
      this.shotEffects.push({ group, beam, head, flash, start: start.clone(), end: end.clone(), t: 0, duration, impacted: false, weapon });
    }
    updateShotEffects(dt) {
      for (let i = this.shotEffects.length - 1; i >= 0; i--) {
        const fx = this.shotEffects[i]; fx.t += dt;
        const progress = clamp(fx.t / fx.duration, 0, 1);
        const point = this._scratchV1.copy(fx.start).lerp(fx.end, progress);
        const tail = this._scratchV2.copy(fx.start).lerp(point, Math.max(0, 1 - .18 / Math.max(.18, progress)));
        const vector = this._scratchV3.copy(point).sub(tail), length = Math.max(.02, vector.length());
        fx.beam.position.copy(tail).addScaledVector(vector, .5);
        fx.beam.scale.set(1, length, 1);
        fx.beam.quaternion.setFromUnitVectors(this._upY, vector.normalize());
        fx.head.position.copy(point);
        const fade = 1 - progress;
        fx.head.scale.setScalar(.68 + fade * .55);
        fx.head.material.opacity = .35 + fade * .65;
        fx.beam.material.opacity = .2 + fade * .72;
        const flashLife = Math.max(0, 1 - fx.t / .055);
        fx.flash.visible = flashLife > 0; fx.flash.scale.setScalar(.45 + flashLife * 1.7); fx.flash.material.opacity = flashLife;
        if (progress >= 1 && !fx.impacted) {
          fx.impacted = true;
          // One compact visual impact accompanies the hit/end point without adding
          // another collision or damage path.
          this.burst(fx.end.x, fx.end.y, fx.end.z, fx.weapon === "shotgun" ? 4 : 6, "#ffe3b4", .24, 2.6);
          // v19 FX (worker animations 2/4): pooled impact sparks + flash alongside
          // the legacy burst. Guarded: silent no-op if the art module is absent.
          if (A.fx && A.fx.spawnImpact) A.fx.spawnImpact(this.scene, fx.end, 0xffe3b4);
        }
        if (fx.t >= fx.duration + .09) {
          this.scene.remove(fx.group); this.disposeTree(fx.group); this.shotEffects.splice(i, 1);
        }
      }
    }
    makeMenu() {
      this.menuScene = new T.Scene();
      this.menuScene.background = new T.Color("#071d31");
      this.menuScene.fog = new T.FogExp2("#1f6680", .055);
      this.menuCamera = new T.PerspectiveCamera(39, 1, .1, 92);
      this.menuScene.add(new T.HemisphereLight("#9cdbeb", "#10283c", 1.7));
      const key = new T.DirectionalLight("#ffe0ad", 2.1); key.position.set(4, 7, 4);
      const rim = new T.DirectionalLight("#46dbe0", 2.35); rim.position.set(-5, 4, -5);
      const coral = new T.SpotLight("#ff9b78", 115, 18, .62, .72, 1.4); coral.position.set(3.8, 6.5, 2.1); coral.target.position.set(0, .8, 0);
      const teal = new T.SpotLight("#48e2dd", 95, 20, .67, .76, 1.6); teal.position.set(-4.5, 4.6, -3); teal.target.position.set(0, 1, 0);
      this.menuScene.add(key, rim, coral, coral.target, teal, teal.target);
      const terrace = A.launchTerrace ? A.launchTerrace() : new T.Group();
      this.menuScene.add(terrace); this.menuTerrace = terrace;
      // A low-cost sea horizon and a handful of faceted islands create depth behind
      // the launch deck.  This is lobby-only scenery, never gameplay collision.
      const water = new T.Mesh(new T.PlaneGeometry(74, 74, 48, 48), new T.ShaderMaterial({
        transparent:true,side:T.DoubleSide,depthWrite:true,
        uniforms:{time:{value:0},deep:{value:new T.Color("#08334d")},shallow:{value:new T.Color("#16869a")},sun:{value:new T.Color("#f5c47e")}},
        vertexShader:'uniform float time;varying vec2 vUv;varying float wave;void main(){vUv=uv;vec3 p=position;float w=sin(p.x*.48+time*.72)*.10+sin(p.y*.67-time*.55)*.075+sin((p.x+p.y)*.24+time*.38)*.055;p.z+=w;wave=w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
        fragmentShader:'uniform float time;uniform vec3 deep;uniform vec3 shallow;uniform vec3 sun;varying vec2 vUv;varying float wave;void main(){float horizon=smoothstep(.05,.84,vUv.y);float streak=pow(max(0.,sin(vUv.x*145.+sin(vUv.y*18.)*3.+time*.25)),18.)*smoothstep(.35,.95,vUv.y);vec3 c=mix(shallow,deep,horizon*.72)+wave*vec3(.18,.38,.42)+sun*streak*.24;gl_FragColor=vec4(c,.96);}'
      }));
      water.rotation.x=-Math.PI/2; water.position.set(0,-.43,-8); this.menuScene.add(water); this.menuWater=water; this.menuWaterUniforms=water.material.uniforms;
      const sunDisc=new T.Mesh(new T.CircleGeometry(2.7,36),new T.MeshBasicMaterial({color:'#f6c97c',transparent:true,opacity:.82,depthWrite:false,blending:T.AdditiveBlending}));
      sunDisc.position.set(-12,8,-42);this.menuScene.add(sunDisc);this.menuSunDisc=sunDisc;
      const islands=new T.Group();
      [[-9,-16,2.8,"#31756f"],[8,-18,3.9,"#597f73"],[0,-26,5.5,"#376c68"],[13,-29,3.5,"#a17358"],[-15,-31,4.2,"#4d7780"]].forEach(([x,z,scale,col],i)=>{
        const rock=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:col,roughness:1,flatShading:true}));
        rock.position.set(x,-.72,z);rock.scale.set(scale,scale*.44,scale*.78);islands.add(rock);
        const beacon=new T.Mesh(new T.CylinderGeometry(.028,.055,1.3,6),new T.MeshBasicMaterial({color:i%2?"#f2bd72":"#67d8d4"}));beacon.position.set(x,scale*.43-.7,z);islands.add(beacon);
      }); this.menuScene.add(islands); this.menuIslands=islands;
      const sky = new T.Mesh(new T.SphereGeometry(70,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;void main(){float h=clamp(normalize(v).y*.5+.5,0.,1.);vec3 c=mix(vec3(.025,.12,.23),vec3(.12,.52,.66),pow(h,.62));gl_FragColor=vec4(c,1.);}'}));
      this.menuScene.add(sky); this.menuSky=sky;
      const dust=[]; const rand=A.rng ? A.rng(606) : Math.random;
      for(let i=0;i<110;i++) dust.push((rand()-.5)*11,rand()*5-.1,-1-rand()*15);
      const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.Float32BufferAttribute(dust,3));
      this.menuDust=new T.Points(dustGeo,new T.PointsMaterial({color:'#c7ffed',size:.045,transparent:true,opacity:.68,depthWrite:false,sizeAttenuation:true}));this.menuScene.add(this.menuDust);
      this.menuTeam = []; this.menuTeamKey = '';
    }
    setMenuTeam(entries) {
      const list = Array.isArray(entries) ? entries.slice(0,3) : [];
      const signature = JSON.stringify(list.map((m)=>({id:m?.id,name:m?.name,equipment:m?.equipment,level:m?.level,ready:m?.ready,bot:m?.bot})));
      if (signature === this.menuTeamKey) return list;
      for (const slot of this.menuTeam) {
        this.menuScene.remove(slot.group);
        // Name-tag canvases are generated per supplied team entry; release their
        // texture before disposing the sprite material when the roster changes.
        slot.tag?.material?.map?.dispose();
        this.disposeTree(slot.group);
      }
      this.menuTeam=[]; this.menuTeamKey=signature;
      list.forEach((member,index)=>{
        const group=new T.Group(), avatar=A.avatar(member?.equipment || {});
        const ring=new T.Mesh(new T.TorusGeometry(.55,.018,6,32),new T.MeshBasicMaterial({color:member?.ready?'#75f0d4':'#f1a56f',transparent:true,opacity:.75}));
        ring.rotation.x=Math.PI/2; ring.position.y=.15; group.add(avatar,ring);
        // The designation is derived only from supplied data.  No invented online
        // friends/team members appear when the integration omits menuTeam.
        const label=document.createElement('canvas');label.width=256;label.height=40;const c=label.getContext('2d');
        c.font='700 20px sans-serif';c.textAlign='center';c.fillStyle=member?.bot?'#9be8ed':'#fff0d0';c.fillText((member?.bot?'IA · ':'')+(member?.name||member?.id||'EXPÉDITION'),128,25);
        const tag=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(label),transparent:true,depthTest:false}));tag.position.y=2.35;tag.scale.set(1.36,.213,1);group.add(tag);
        this.menuScene.add(group);this.menuTeam.push({group,avatar,ring,tag,member,index});
      });
      return list;
    }
    setWorld(world) {
      this.worldRef = world;
      this.cameraPhase = null;
      this.disposeTree(this.worldRoot);
      this.disposeTree(this.actorRoot);
      this.objects.clear();
      this.actors.clear();
      this.builds.clear();
      this.loot.clear();
      this.vehicles.clear();
      this.lastEvent = world.events.at(-1)?.id || 0;
      this.worldSeed = world.seed;
      this.particles = [];
      // A replay can reuse player ids and event counters. Reset every renderer-only
      // pool/counter so old actor poses, far impostors, particles, or adaptive
      // quality state cannot leak into the new world's first frame.
      this.farActors.count = 0;
      this.farActors.instanceMatrix.needsUpdate = true;
      this.particleMesh.count = 0;
      this.particleMesh.instanceMatrix.needsUpdate = true;
      this.houseLOD.count = 0;
      this.houseLOD.instanceMatrix.needsUpdate = true;
      this.marker.visible = false;
      this.adaptiveDetail = 1;
      this._perfGood = this._perfBad = 0;
      this.aircraft.visible = false;
      this.aircraft.rotation.set(0, 0, 0);
      this.aircraft.userData.balloon.rotation.set(0, 0, 0);
      this.aircraft.userData.turbines?.forEach((rotor) => rotor.rotation.set(0, 0, 0));
      this.clearShotEffects();
      for (const t of this.texts) {
        this.scene.remove(t.mesh);
        this.disposeTree(t.mesh);
      }
      this.texts = [];
      for (const v of world.vehicles) {
        const m = A.vehicleModel(v);
        this.worldRoot.add(m);
        this.vehicles.set(v.id, m);
      }
      const p = world.players[0];
      for (const o of world.objects) {
        if (Math.hypot(o.x - p.x, o.z - p.z) < 65 && this.objects.size < 8) {
          const m = A.objectModel(o);
          this.worldRoot.add(m);
          this.objects.set(o.id, m);
        }
      }
      this.ghostKey = "";
      if (this.ghost) {
        this.scene.remove(this.ghost);
        this.disposeTree(this.ghost);
        this.ghost = null;
      }
    }
    animateAvatar(m, p, dt, options = {}) {
      const u = m.userData,
        t = this.time,
        local = options.local,
        walkDistance = u.lastDistance === undefined ? 0 : Math.max(0, p.distance - u.lastDistance);
      u.lastDistance = p.distance;
      let speed = walkDistance / Math.max(0.001, dt);
      u.walk = T.MathUtils.lerp(u.walk, clamp(speed / 5, 0, 1.7), 1 - Math.exp(-dt * 13));
      u.anim += dt * (7 + u.walk * 4);
      u.recoil = Math.max(0, u.recoil - dt * 5);
      u.harvest = Math.max(0, u.harvest - dt * 3);
      const gait = Math.sin(u.anim),
        leg = gait * u.walk * 0.53,
        air = p.gliding || p.falling || p.flying;
      u.torso.rotation.set(0, 0, 0);
      u.head.rotation.set(0, 0, 0);
      u.limbs[0].rotation.set(leg, 0, 0);
      u.limbs[2].rotation.set(-leg, 0, 0);
      u.knees[0].rotation.x = Math.max(0, -gait) * u.walk * 0.55;
      u.knees[1].rotation.x = Math.max(0, gait) * u.walk * 0.55;
      u.limbs[1].rotation.set(-leg * 0.6, 0, -0.08);
      u.limbs[3].rotation.set(leg * 0.6, 0, 0.08);
      u.elbows[0].rotation.x = -0.15;
      u.elbows[1].rotation.x = -0.15;
      u.torso.position.y = Math.sin(t * 2) * 0.014 + Math.abs(gait) * u.walk * 0.024;
      u.torso.rotation.z = Math.sin(u.anim) * u.walk * 0.018;
      u.head.rotation.y = Math.sin(t * 0.9) * 0.035;
      let it = p.inventory?.[p.selected],
        key = it?.kind === "weapon" ? it.weapon : null;
      const armed = key && !air && !options.harvest && !options.buildType && !p.emote && !p.fishing;
      if (key && (key !== u.gunKey || p.equipment?.wrap !== u.gunWrap)) {
        m.remove(u.gun);
        this.disposeTree(u.gun);
        u.gun = A.weapon(key, A.cosmetic(p.equipment?.character).secondary, p.equipment?.wrap);
        u.gun.position.set(0.23, 1.15, -0.43);
        m.add(u.gun);
        u.gunKey = key;
        u.gunWrap = p.equipment?.wrap || "";
      }
      u.gun.visible = !!armed;
      u.gun.rotation.x = -u.recoil * 0.2 - (p.pitch || 0) * 0.2;
      u.gun.position.z = -0.43 + u.recoil * 0.1;
      if (armed) {
        u.limbs[1].rotation.set(-0.84, 0, -0.45);
        u.limbs[3].rotation.set(-0.88, 0, 0.1);
        u.elbows[0].rotation.x = -0.72;
        u.elbows[1].rotation.x = -0.84;
      }
      const fishingReady = !!options.fishingReady && !air && !p.emote;
      u.tool.visible = !!options.harvest && !fishingReady && !air && !p.emote;
      u.tool.rotation.x = -0.3 - u.harvest * 2.2;
      u.tool.rotation.z = u.harvest * 0.25;
      if (u.tool.visible) {
        u.limbs[3].rotation.x = -0.6 - u.harvest * 1.7;
        u.elbows[1].rotation.x = -0.45;
      }
      u.blueprint.visible = !!options.buildType && !p.emote;
      if (u.blueprint.visible) {
        u.limbs[1].rotation.x = -1.05;
        u.elbows[0].rotation.x = -0.5;
        u.limbs[3].rotation.x = -0.65;
      }
      u.glider.visible = !!p.gliding;
      const gs = clamp((u.glideScale || 0) + (p.gliding ? dt * 6 : -dt * 8), 0, 1);
      u.glideScale = gs;
      u.glider.scale.setScalar(Math.max(0.01, gs));
      u.glider.rotation.z = Math.sin(t * 2) * 0.035;
      if (p.gliding) {
        u.limbs[1].rotation.set(-2.85, 0, -0.12);
        u.limbs[3].rotation.set(-2.85, 0, 0.12);
        u.limbs[0].rotation.x = 0.12;
        u.limbs[2].rotation.x = -0.1;
        u.knees[0].rotation.x = 0.15;
        u.knees[1].rotation.x = 0.23;
      } else if (p.falling || p.flying) {
        // Belly-down freefall is intentionally unlike the compact terrestrial jump.
        u.limbs[1].rotation.set(-1.7, 0, -0.8);
        u.limbs[3].rotation.set(-1.7, 0, 0.8);
        u.limbs[0].rotation.x = 0.2;
        u.limbs[2].rotation.x = -0.14;
        u.torso.rotation.x = -0.12;
      } else if (p.jumping) {
        // Ordinary jump: knees tucked and arms balanced, but no freefall/glider pose.
        const phase = clamp((p._jumpTime || 0) * 4, 0, 1);
        u.limbs[0].rotation.x = 0.42 + phase * 0.12;
        u.limbs[2].rotation.x = -0.32 - phase * 0.08;
        u.knees[0].rotation.x = -0.58;
        u.knees[1].rotation.x = -0.46;
        u.limbs[1].rotation.z = -0.18;
        u.limbs[3].rotation.z = 0.18;
        u.torso.rotation.x = 0.08;
      }
      if (p.reload > 0) {
        u.limbs[1].rotation.x = -1.4 + Math.sin(t * 9) * 0.16;
        u.elbows[0].rotation.x = -0.9;
        u.gun.rotation.z = -0.3;
      } else u.gun.rotation.z = 0;
      if (p.useTime > 0) {
        u.limbs[3].rotation.x = -1.8;
        u.elbows[1].rotation.x = -1.1;
        u.gun.visible = false;
      }
      if (p.emote > 0) {
        u.limbs[1].rotation.z = -1.6 + Math.sin(t * 7) * 0.4;
        u.limbs[3].rotation.z = 1.6 + Math.sin(t * 7 + 1.8) * 0.4;
        u.limbs[0].rotation.x = Math.sin(t * 6) * 0.3;
        u.limbs[2].rotation.x = -Math.sin(t * 6) * 0.3;
        u.torso.rotation.y = Math.sin(t * 5) * 0.13;
        m.position.y += Math.abs(Math.sin(t * 6)) * 0.08;
      }
      u.rod.visible = !!p.fishing || fishingReady;
      if (p.fishing || fishingReady) {
        u.limbs[3].rotation.x = -1.1;
        u.elbows[1].rotation.x = -0.55;
        u.rod.rotation.z = Math.sin(t * 3) * 0.015;
      }
      m.rotation.x = p.swimming ? -0.65 : p.falling && speed > 1 ? -0.3 : p.jumping ? 0.04 : 0;
      m.rotation.z = p.downed ? Math.PI / 2 : 0;
      if (p.crouching && !air) m.scale.y = 0.74;
      else m.scale.y = 1;
    }
    drawMenu(w, p, dt, opts = {}) {
      const eq = opts.previewEquipment || p.equipment || {};
      if (!this.menuAvatar || this.menuAvatar.userData.equipment !== JSON.stringify(eq)) {
        if (this.menuAvatar) { this.menuScene.remove(this.menuAvatar); this.disposeTree(this.menuAvatar); }
        this.menuAvatar = A.avatar(eq); this.menuScene.add(this.menuAvatar);
      }
      const a = this.menuAvatar, preview = opts.previewType || '';
      a.position.set(0, 0.18, 0);
      a.rotation.y = Math.PI + .22 + this.menuRotation + (preview === 'back' ? Math.PI : 0);
      const fake = {...p,equipment:eq,distance:0,inventory:preview==='wrap'?[{kind:'weapon',weapon:'rifle'}]:[],emote:preview==='emote'?2:0,emoteStyle:preview==='emote'?undefined:p.emoteStyle,gliding:preview==='glider',falling:false,jumping:false,flying:false,swimming:false,reload:0,useTime:0,crouching:false,fishing:0};
      this.animateAvatar(a, fake, dt, {harvest:preview==='tool', menu:true});
      a.userData.gun.visible = preview === 'wrap';
      const members=this.setMenuTeam(opts.menuTeam);
      const slots=[[-2.65,.05,-.2],[2.65,.05,-.2],[-1.95,.05,-1.9]];
      this.menuTeam.forEach((slot,i)=>{
        const q=slots[i];slot.group.visible=!opts.panel;slot.group.position.set(q[0],q[1],q[2]);slot.group.rotation.y=Math.PI+(i===1?-.2:.2);
        slot.ring.material.color.set(slot.member.ready?'#72f3d4':'#f1a36e');slot.ring.scale.setScalar(1+Math.sin(this.time*2+i)*.045);
        const tm={...fake,equipment:slot.member.equipment||{},emote:0,gliding:false};this.animateAvatar(slot.avatar,tm,dt,{menu:true});
      });
      if(this.menuTerrace?.userData.portal)this.menuTerrace.userData.portal.time.value=this.time;
      this.menuTerrace?.userData.beacons?.forEach((b,i)=>{const pulse=.85+Math.sin(this.time*3+i)*.16;b.scale.y=pulse;b.material.opacity=.68+pulse*.18;});
      this.menuTerrace?.userData.navRings?.forEach((ring,i)=>{ring.rotation.z=this.time*(i%2?-.11:.08)+i*.32;ring.scale.setScalar(1+Math.sin(this.time*1.7+i)*.025);});
      if(this.menuDust){this.menuDust.rotation.y=this.time*.018;this.menuDust.position.y=Math.sin(this.time*.45)*.04;}
      if(this.menuWaterUniforms)this.menuWaterUniforms.time.value=this.time;
      if(this.menuSunDisc)this.menuSunDisc.material.opacity=.75+Math.sin(this.time*.7)*.07;
      const portrait=this.menuCamera.aspect<.82, mobileLandscape=this.canvas.clientHeight<520;
      const distance=preview==='glider'?(portrait?9:7.9):(portrait?8.05:mobileLandscape?6.25:6.65);
      this.menuCamera.position.set(0,1.72,distance);this.menuCamera.lookAt(0,portrait?1.04:1.13,-.35);
      const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
      const center=opts.panel?(opts.tab==='locker'&&width>1100&&height>550?.8:width>820?.17:.5):.5;
      this.menuCamera.setViewOffset(width,height,-(center-.5)*width,0,width,height);
      this.renderer.render(this.menuScene,this.menuCamera);
    }
    emit(e, p) {
      const near = Math.hypot(e.x - p.x, e.z - p.z) < 160;
      const actor = this.actors.get(e.playerId);
      if (e.type === "shot" && actor) actor.userData.recoil = 1;
      if (e.type === "harvest" && actor) actor.userData.harvest = 1;
      if (e.type === "land" && actor) actor.userData.landImpact = Math.max(actor.userData.landImpact || 0, e.ordinary ? .72 : 1);
      if (!near && e.type !== "phase") return;
      if (e.type === "shot") {
        const local = e.playerId === p.id;
        const dir = this._scratchV1.set(e.endX - e.x, e.endY - e.y, e.endZ - e.z).normalize();
        const start = this._scratchV2.set(e.x, e.y, e.z).addScaledVector(dir, .52);
        if (actor?.userData.gun?.visible && actor.userData.gun.userData.muzzle) {
          actor.updateMatrixWorld(true);
          start.copy(actor.userData.gun.localToWorld(this._scratchV3.set(...actor.userData.gun.userData.muzzle)));
        }
        this.spawnShotEffect(start, this._scratchV3.set(e.endX, e.endY, e.endZ), local, e.weapon);
        // v21 wiring : flash de bouche poolé au vrai canon, en plus du traceur.
        // Gardé : no-op silencieux si le module d'art est absent.
        if (A.fx && A.fx.spawnMuzzle) {
          this._fxPos.copy(start);
          A.fx.spawnMuzzle(this.scene, this._fxPos, dir, e.weapon === "shotgun" ? 1.3 : e.weapon === "launcher" ? 1.6 : 1);
        }
      }
      if (
        [
          "destroy",
          "hit",
          "land",
          "build",
          "edit",
          "heal",
          "explosion",
          "demolish",
          "harvest",
          "deploy",
          "glider",
          "fish",
          "splash",
        ].includes(e.type)
      ) {
        const n = e.type === "explosion" ? 38 : e.type === "destroy" || e.type === "demolish" ? 20 : e.type === "splash" ? 14 : 8,
          col =
            e.type === "heal"
              ? "#71eccb"
              : ["build", "edit", "glider", "splash"].includes(e.type)
                ? "#7be8f2"
                : e.type === "hit" && e.shield
                  ? "#74bdff"
                  : "#e6c49b";
        this.burst(
          e.x,
          e.y + 0.4,
          e.z,
          n,
          col,
          e.type === "explosion" ? 1.1 : 0.55,
          e.type === "explosion" ? 14 : 4,
        );
        // v19 FX (worker animations 2/4): pooled explosion (flash + ring + debris)
        // alongside the legacy burst. Guarded: silent no-op if absent.
        if (e.type === "explosion" && A.fx && A.fx.spawnExplosion) A.fx.spawnExplosion(this.scene, new T.Vector3(e.x, e.y + 0.4, e.z), 1);
        // v21 wiring : poussière/impacts poolés aux bons endroits, en plus du
        // burst legacy. Gardé : no-op silencieux si le module d'art est absent.
        if (A.fx) {
          this._fxPos.set(e.x, e.y + 0.4, e.z);
          if (e.type === "hit" && A.fx.spawnImpact) A.fx.spawnImpact(this.scene, this._fxPos, e.shield ? 0x74bdff : 0xffd9a8);
          else if ((e.type === "destroy" || e.type === "demolish") && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0x9a8f7a, 12, .55, .9);
          else if (e.type === "land" && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0xcfc4ae, 8, .45, .55);
          else if (e.type === "harvest" && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0xe6c49b, 6, .3, .4);
          else if (e.type === "heal" && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0x71eccb, 10, .3, .7);
          else if (e.type === "splash" && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0xbfe9f5, 10, .4, .6);
          else if ((e.type === "deploy" || e.type === "glide" || e.type === "glider") && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0x7be8f2, 8, .35, .5);
          else if (e.type === "edit" && A.fx.spawnDust) A.fx.spawnDust(this.scene, this._fxPos, 0x7be8f2, 6, .3, .4);
        }
        // v21 wiring : secousses dosées par trauma — la caméra reste libre.
        if (e.type === "explosion") this.addShake(0.45);
      }
      // v21 wiring : feedback de ramassage — éclat doré poolé à la position du loot.
      if (e.type === "loot" && A.fx && A.fx.spawnImpact) {
        this._fxPos.set(e.x, e.y + 0.5, e.z);
        A.fx.spawnImpact(this.scene, this._fxPos, 0xffd97a);
        this.addShake(0.05);
      }
      // v21 wiring : dégâts reçus / atterrissage — secousse courte, caméra libre.
      if (e.type === "hit" && e.targetId === p.id) this.addShake(0.3);
      if (e.type === "land" && e.playerId === p.id) this.addShake(e.ordinary ? 0.08 : 0.16);
      if (e.type === "hit" && e.targetId && e.playerId === p.id) {
        const cv = document.createElement("canvas");
        cv.width = 208;
        cv.height = 78;
        const cx = cv.getContext("2d");
        const head = !!e.headshot, shield = (e.shieldDamage || e.shield || 0) > 0 && !(e.hpDamage > 0);
        const label = "";
        cx.font = "900 48px sans-serif";
        cx.textAlign = "center";
        cx.lineWidth = 6;
        cx.strokeStyle = "#142e47";
        cx.strokeText(label + Math.round(e.amount || 0), 104, 53);
        cx.fillStyle = head ? "#ffd15f" : shield ? "#70cfff" : "#e2fbff";
        cx.fillText(label + Math.round(e.amount || 0), 104, 53);
        const sp = new T.Sprite(
          new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, transparent: true }),
        );
        sp.position.set(e.x, e.y + 1.3, e.z);
        sp.scale.set(head ? 2.15 : 1.55, head ? 0.8 : 0.64, 1);
        this.scene.add(sp);
        this.texts.push({ mesh: sp, life: 1.0, max: 1.0, damageLabel: true, headshot: head });
        if (this.texts.length > 18) { const old = this.texts.shift(); this.scene.remove(old.mesh); old.mesh.material.map?.dispose(); old.mesh.material.dispose(); }
      }
      if (e.type === "elimination" && e.targetId) {
        this.burst(e.x, e.y + 1, e.z, 28, "#7df8ff", 1, 6);
        // v19 FX (worker animations 2/4): pooled elimination beam + ring alongside
        // the legacy burst. Guarded: silent no-op if the art module is absent.
        if (A.fx && A.fx.spawnElimination) A.fx.spawnElimination(this.scene, new T.Vector3(e.x, e.y + 1, e.z));
        // v21 wiring : secousse dosée à l'élimination proche.
        if (near) this.addShake(0.22);
      }
    }
    burst(x, y, z, n, col, life, speed) {
      for (let i = 0; i < n; i++) {
        if (this.particles.length >= 280) this.particles.shift();
        this.particles.push({
          x,
          y,
          z,
          vx: (Math.random() - 0.5) * speed,
          vy: Math.random() * speed * 0.7,
          vz: (Math.random() - 0.5) * speed,
          t: life * (0.6 + Math.random() * 0.4),
          max: life,
          col,
        });
      }
    }
    project(x, y, z) {
      const v = new T.Vector3(x, y, z).project(this.camera);
      return {
        x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth,
        y: (-0.5 * v.y + 0.5) * this.canvas.clientHeight,
        visible: v.z < 1 && v.z > 0,
      };
    }
    adaptPerformance(rawDt) {
      if (!this.performanceAuto || !rawDt || rawDt > 2 || document.hidden) return;
      const ms = Math.min(rawDt, .5) * 1000;
      this._perfMs = this._perfMs * 0.92 + ms * 0.08;
      // v21 wiring : les draw calls comptent aussi — un pic de batchs fait
      // baisser la qualité même si le temps frame reste correct.
      const calls = this.renderer?.info?.render?.calls || 0;
      this._perfCalls = (this._perfCalls || 0) * 0.9 + calls * 0.1;
      if (this._perfMs > 18.2 || this._perfCalls > 320) { this._perfBad++; this._perfGood = 0; }
      else if (this._perfMs < 16.9 && this._perfCalls < 240) { this._perfGood++; this._perfBad = 0; }
      if (this._perfBad > 24) {
        this._perfBad = 0;
        if (this._perfMs > 23) this.renderer.shadowMap.enabled = false;
        this.adaptiveDetail = Math.max(.6, (this.adaptiveDetail || 1) - .1);
        this.drawDistance = Math.max(this.quality === "low" ? 190 : 300, this.drawDistance - 35);
        const next = Math.max(this.quality === "low" ? 0.65 : 0.8, this.renderer.getPixelRatio() - 0.08);
        if (Math.abs(next - this.renderer.getPixelRatio()) > .01) this.renderer.setPixelRatio(next);
      } else if (this._perfGood > 180) {
        this._perfGood = 0;
        this.adaptiveDetail = Math.min(1, (this.adaptiveDetail || 1) + .05);
        if (this._perfMs < 16.6 && this.allowShadows) this.renderer.shadowMap.enabled = true;
        const cap = this.quality === "low" ? 1 : this.quality === "ultra" ? (this.mobileRenderer ? 1.6 : 2.25) : this.quality === "high" ? (this.mobileRenderer ? 1.5 : 2) : (this.mobileRenderer ? 1.15 : 1.35);
        this.drawDistance = Math.min(this.quality === "low" ? 240 : this.quality === "ultra" ? 980 : this.quality === "high" ? 780 : 450, this.drawDistance + 18);
        const next = Math.min(devicePixelRatio, cap, this.renderer.getPixelRatio() + 0.04);
        if (Math.abs(next - this.renderer.getPixelRatio()) > .01) this.renderer.setPixelRatio(next);
      }
    }
    update(w, p, dt, opts = {}) {
      if (!opts.menu) this.adaptPerformance(opts.rawDt || dt);
      this.time += dt;
      this.worldRef = w;
      if (!p) return;
      if (opts.menu) {
        this.drawMenu(w, p, dt, opts);
        return;
      }
      const time = this.time,
        day = opts.timeOfDay === "night" ? 0.12 : opts.timeOfDay === "sunset" ? 0.63 : 1,
        focus = p;
      this.environment.update(dt, p, day, this.quality);
      this.hemi.intensity = 0.42 + day * 1.63;
      this.sun.intensity = 0.15 + day * 2.5;
      this.sun.color.set(opts.timeOfDay === "sunset" ? "#ffc58f" : "#fff0cf");
      this.scene.fog.color.copy(this.fogNight).lerp(this.fogDay, day);
      this.scene.fog.density = (this.quality === "ultra" ? .00058 : this.quality === "high" ? .00072 : this.quality === "low" ? .00118 : .00094) * (1.08 - day * .08);
      this.renderer.toneMappingExposure = T.MathUtils.lerp(this.renderer.toneMappingExposure, .92 + day * .18, 1 - Math.exp(-dt * 2.2));
      this.sun.position.set(p.x - 48, p.y + 90, p.z + 44);
      this.sun.target.position.set(p.x, p.y, p.z);
      this.skyFill.position.set(p.x + 34, p.y + 52, p.z - 42);
      this.skyFill.intensity = .06 + day * .30;
      let made=0,houseCount=0;
      const began=performance.now(),airborne=p.falling||p.gliding||w.phase==='transport',distLimit=airborne?1100:this.drawDistance;
      const detailDistance=(this.quality==='low'?90:this.quality==='ultra'?245:this.quality==='high'?185:130)*(this.adaptiveDetail||1);
      for(const o of w.objects){
        const dist=Math.hypot(o.x-p.x,o.z-p.z),isHouse=o.type==='house';
        const close=dist<(isHouse?detailDistance:Math.min(this.drawDistance,airborne?140:230)) && (!airborne||Math.abs(p.y-(o.y+Math.min(8,o.h||0)))<90);
        let m=this.objects.get(o.id);
        if(!m&&!o.dead&&close&&made<2&&(performance.now()-began<2.2)){
          m=A.objectModel(o);m.userData.lastSeen=time;this.worldRoot.add(m);this.objects.set(o.id,m);made++;
        }
        if(m){m.visible=!o.dead&&close;if(m.visible)m.userData.lastSeen=time;
          if(m.visible&&o.type==='tree')m.rotation.z=Math.sin(time*1.2+o.x)*.008;
          if(m.userData.lid)m.userData.lid.rotation.x=T.MathUtils.lerp(m.userData.lid.rotation.x,o.opened?-1.82:0,1-Math.exp(-dt*8));
          if(m.userData.light){m.userData.light.visible=!o.opened;m.userData.light.scale.y=1+Math.sin(time*2+o.x)*.08;}
        }
        if(isHouse&&!o.dead&&!(m&&m.visible)&&dist<(airborne?1700:1000)&&houseCount<900){
          this.dummy.position.set(o.x,o.y+o.h/2,o.z);this.dummy.rotation.set(0,o.yaw||0,0);this.dummy.scale.set(o.w*2,o.h,o.d*2);this.dummy.updateMatrix();
          this.houseLOD.setMatrixAt(houseCount,this.dummy.matrix);this.houseLOD.setColorAt(houseCount,this.houseLODColors[o.region]||this.houseLODColors[0]);houseCount++;
        }
      }
      this.houseLOD.count=houseCount;this.houseLOD.instanceMatrix.needsUpdate=true;if(this.houseLOD.instanceColor)this.houseLOD.instanceColor.needsUpdate=true;
      // Detailed streamed meshes are an LRU cache.  Collision stays in AZSim, so
      // eviction cannot change movement/raycast authority; it only releases GPU/CPU
      // resources after an object has remained well outside the presentation bubble.
      const cacheLimit=this.quality==='low'?34:this.quality==='ultra'?148:this.quality==='high'?110:66;
      const objectById=new Map(w.objects.map((q)=>[q.id,q]));
      for (const [id, mesh] of this.objects) {
        const o=objectById.get(id), d=o?Math.hypot(o.x-p.x,o.z-p.z):Infinity;
        if (mesh.visible) mesh.userData.lastSeen=time;
        if (!o || o.dead || (d>detailDistance*1.8 && time-(mesh.userData.lastSeen||0)>5) || (this.objects.size>cacheLimit && d>detailDistance*.9)) { this.worldRoot.remove(mesh);this.disposeTree(mesh);this.objects.delete(id); }
      }
      for (const b of w.builds) {
        let m = this.builds.get(b.id);
        const key = [b.editMask, b.edited, b.yaw, b.material].join("/");
        if (m && m.userData.signature !== key) {
          this.worldRoot.remove(m);
          this.disposeTree(m);
          this.builds.delete(b.id);
          m = null;
        }
        if (!m && !b.dead) {
          m = A.buildModel(b);
          m.userData.signature = key;
          m.userData.birth = time;
          this.builds.set(b.id, m);
          this.worldRoot.add(m);
          // v19 FX (worker animations 2/4): one dust puff at the base on placement.
          // Guarded: silent no-op if the art module is absent.
          if (A.fx && A.fx.spawnBuildPuff) A.fx.spawnBuildPuff(this.scene, new T.Vector3(b.x, b.y, b.z));
        }
        if (m) {
          m.visible = !b.dead && Math.hypot(b.x - p.x, b.z - p.z) < distLimit;
          const age = time - m.userData.birth;
          // v19 FX (worker animations 2/4): eased spawn pop each frame. Falls back
          // to the legacy grow-in when the art module lacks buildSpawnScale.
          if (A.buildSpawnScale) m.scale.setScalar(A.buildSpawnScale(age));
          else m.scale.y = age < 0.22 ? 0.12 + Math.min(1, age / 0.22) * 0.88 : 1;
        }
      }
      for (const l of w.loot) {
        const distance = Math.hypot(l.x - p.x, l.z - p.z);
        let m = this.loot.get(l.id);
        if (!m && !l.dead && distance < 65) {
          const g = new T.Group();
          let mesh =
            l.kind === "weapon"
              ? A.weapon(l.weapon, S.rarities[l.rarity]?.color)
              : new A.Model()
                  .box(0.42, 0.55, 0.42, l.kind === "heal" ? "#f4ede1" : "#53d3dd", 0, 0.08, 0)
                  .box(0.3, 0.09, 0.44, l.kind === "heal" ? "#ec7365" : "#c9f7ff", 0, 0.08, 0)
                  .box(0.09, 0.3, 0.44, l.kind === "heal" ? "#ec7365" : "#c9f7ff", 0, 0.08, 0)
                  .mesh();
          mesh.rotation.z = l.kind === "weapon" ? 0.18 : 0;
          g.add(mesh);
          const glow = new T.Mesh(
            new T.RingGeometry(0.36, 0.47, 20),
            new T.MeshBasicMaterial({
              color: S.rarities[l.rarity || 0].color,
              transparent: true,
              opacity: 0.7,
              side: T.DoubleSide,
              depthWrite: false,
            }),
          );
          glow.rotation.x = -Math.PI / 2;
          glow.position.y = -0.38;
          g.add(glow);
          m = g;
          this.loot.set(l.id, m);
          this.worldRoot.add(m);
        }
        if (m) {
          m.visible = !l.dead && distance < 70;
          m.position.set(
            l.x,
            Math.max(l.y, S.heightAt(l.x, l.z) + 0.56) + Math.sin(time * 2 + l.x) * 0.1,
            l.z,
          );
          m.children[0].rotation.y = time * 0.7 + l.x;
        }
      }
      // v21 wiring : Set réutilisé — zéro allocation par frame.
      const liveVehicleIds = this._vehSet;
      liveVehicleIds.clear();
      for (const v of w.vehicles) {
        liveVehicleIds.add(v.id);
        let m = this.vehicles.get(v.id);
        // Crafted vehicles arrive after setWorld; create their render model lazily
        // rather than requiring a reconnect/reload.  Keep distant creations cheap.
        if (!m && v.hp > 0 && Math.hypot(v.x - p.x, v.z - p.z) < distLimit) {
          m = A.vehicleModel(v); this.worldRoot.add(m); this.vehicles.set(v.id, m);
        }
        if (m) {
          const visible = v.hp > 0 && Math.hypot(v.x - p.x, v.z - p.z) < distLimit;
          m.visible = visible;
          m.position.set(v.x, v.y, v.z); m.rotation.y = v.yaw;
          m.userData.wheels?.forEach((wh) => (wh.rotation.x += v.speed * dt * 2.45));
          m.userData.rotors?.forEach((rotor) => (rotor.rotation.z += v.speed * dt * 4.5));
          // Steering is visual only; driving direction remains simulation-authoritative.
          const steer = clamp((v.steer || 0) * -.38, -.38, .38);
          m.userData.steeringWheels?.forEach((wheel) => (wheel.rotation.y = steer));
        }
      }
      for (const [id, m] of this.vehicles) if (!liveVehicleIds.has(id)) {
        this.worldRoot.remove(m); this.disposeTree(m); this.vehicles.delete(id);
      }
      // v21 wiring : tampon réutilisé + remplissage manuel + tri — zéro
      // allocation par frame (plus de .filter/.map/.slice chaînés ici).
      const nearBuf = this._nearBuf;
      nearBuf.length = 0;
      for (const q of w.players) {
        if (!q.alive || (!q.deployed && w.phase === "transport")) continue;
        if (q.id !== p.id && Math.hypot(q.x - p.x, q.z - p.z) >= 115) continue;
        nearBuf.push(q);
      }
      nearBuf.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      const nearCap = this.quality === "low" ? 8 : this.quality === "ultra" ? 24 : this.quality === "high" ? 18 : 12;
      if (nearBuf.length > nearCap) nearBuf.length = nearCap;
      const near = nearBuf;
      const ids = this._idSet;
      ids.clear();
      for (const q of near) ids.add(q.id);
      for (const [id, m] of this.actors) m.visible = ids.has(id);
      for (const q of near) {
        let m = this.actors.get(q.id);
        // v92 : les bots portent surtout la tenue de recrue (variantes choisies par ch1-chars-v92 via `bot`)
        const botN = q.bot ? parseInt(q.id.replace(/\D/g, "")) || 0 : 0;
        const eq = q.bot
          ? {
              character: "char-ambre",
              bot: botN,
              glider: "glider-alize",
              back: botN % 3 === 0 ? "back-sac" : "",
              tool: "tool-compas",
            }
          : q.equipment;
        const actorDetail = this.quality === "low" || (this.mobileRenderer && this.quality !== "high" && this.quality !== "ultra") ? "low" : "high";
        if (m && (m.userData.equipment !== JSON.stringify(eq) || m.userData.renderDetail !== actorDetail)) {
          this.actorRoot.remove(m);
          this.disposeTree(m);
          this.actors.delete(q.id);
          m = null;
        }
        if (!m) {
          m = A.avatar(eq, actorDetail);
          m.userData.renderDetail = actorDetail;
          this.actorRoot.add(m);
          this.actors.set(q.id, m);
          m.position.set(q.x, q.y, q.z);
        }
        const local = q.id === p.id;
        m.visible = q.alive && !(w.phase === "transport" && !q.deployed) && !q.vehicleId;
        m.position.lerp(
          this._scratchV1.set(q.x, q.y + (q.swimming ? 0.45 : 0), q.z),
          local ? 1 : 1 - Math.exp(-dt * 14),
        );
        m.rotation.y = q.yaw;
        this.animateAvatar(m, q, dt, local ? { ...opts, local: true, fishingReady: !!opts.harvest && !!w._fishable?.(q) } : {});
      }
      let fi = 0;
      for (const q of w.players) {
        if (
          !q.alive ||
          ids.has(q.id) ||
          (!q.deployed && w.phase === "transport") ||
          Math.hypot(q.x - p.x, q.z - p.z) > 850
        )
          continue;
        this.dummy.position.set(q.x, q.y + 0.88, q.z);
        this.dummy.rotation.set(0, q.yaw, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.farActors.setMatrixAt(fi, this.dummy.matrix);
        this.farActors.setColorAt(fi, this._scratchColor.set(q.team === p.team ? "#57e7c4" : "#dc976a"));
        fi++;
      }
      this.farActors.count = fi;
      this.farActors.instanceMatrix.needsUpdate = true;
      if (this.farActors.instanceColor) this.farActors.instanceColor.needsUpdate = true;
      this.aircraft.visible = w.phase === "transport" || (w.phase === "active" && w.mode !== "creative" && w.mode !== "training");
      const busBob = Math.sin(time * 1.45) * 1.15;
      this.aircraft.position.set(w.aircraft.x, w.aircraft.y + busBob, w.aircraft.z);
      this.aircraft.rotation.y = w.aircraft.yaw;
      this.aircraft.rotation.z = Math.sin(time * 0.82) * 0.032;
      this.aircraft.rotation.x = Math.sin(time * 1.18 + 0.6) * 0.014;
      this.aircraft.userData.balloon.rotation.z = Math.sin(time * 1.2) * 0.012;
      this.aircraft.userData.balloon.rotation.x = Math.sin(time * 1.1 + 0.7) * 0.008;
      this.aircraft.userData.thrusters?.forEach((lamp, i) => {
        lamp.material.color.setHSL(0.52 + Math.sin(time * 7 + i) * 0.025, 0.85, 0.62 + Math.sin(time * 8 + i) * 0.18);
        lamp.scale.setScalar(0.82 + Math.sin(time * 8 + i) * 0.12);
      });
      this.aircraft.userData.turbines?.forEach((rotor,i)=>rotor.rotation.z+=dt*(18+i*2));
      this.aircraft.userData.cabinPanes?.forEach((pane,i)=>pane.material.opacity=.28+Math.sin(time*3+i*.8)*.1);
      this.aircraft.userData.navLights?.forEach((lamp,i)=>lamp.scale.setScalar(.75+Math.sin(time*5+i)*.22));
      this.aircraft.userData.headlights?.forEach((lamp,i)=>{lamp.material.opacity=.74+Math.sin(time*4.2+i*.7)*.18;lamp.scale.setScalar(.94+Math.sin(time*3.4+i)*.05);});
      if(this.aircraft.userData.energyCore){const core=this.aircraft.userData.energyCore;core.rotation.y=time*1.8;core.rotation.z=Math.sin(time*.9)*.18;core.children[0].scale.setScalar(.9+Math.sin(time*4.6)*.12);core.children[1].rotation.y=-time*2.6;}
      if (w.phase === "transport" && !p.deployed) {
        const orbit = (opts.yaw ?? 0) + w.aircraft.yaw + .65;
        const elevation = clamp(.32 - (opts.pitch ?? -.12), -.12, 1.12);
        const target = this.aircraft.position.clone().add(new T.Vector3(...(this.aircraft.userData.cameraTarget || [0, 15, 0])));
        const goal = target.clone().add(new T.Vector3(Math.sin(orbit) * Math.cos(elevation), Math.sin(elevation), Math.cos(orbit) * Math.cos(elevation)).multiplyScalar(this.camera.aspect < 1 ? (this.aircraft.userData.cameraRadiusPortrait || 78) : (this.aircraft.userData.cameraRadius || 64)));
        this.camera.position.copy(goal);
        this.camera.lookAt(target);
        this.camera.fov = 62;
        // v21 wiring : la sortie du bus coupe franchement (pas de traversée).
        this._camMode = "bus";
      } else {
        const yaw = opts.yaw ?? p.yaw,
          pitch = opts.pitch ?? p.pitch;
        const sniperAim = !!opts.aim && p.inventory?.[p.selected]?.weapon === "sniper";
        const driven = p.vehicleId ? w.vehicles.find((v) => v.id === p.vehicleId) : null;
        let dist = driven ? 9.4 : p.gliding || p.falling || p.flying ? 6.2 : opts.aim ? (sniperAim ? 1.65 : 2.2) : 3.7;
        // Pendant l'événement, la caméra recule pour embrasser le spectacle.
        if (!driven && !opts.aim) dist *= window.AZEvent?.cameraZoom || 1;
        // Follow behind the actual vehicle yaw, lifted over its roof. The seated
        // avatar is hidden in the actor pass, so it can never appear on the roof.
        const cameraYaw = driven ? driven.yaw : yaw;
        // v21 wiring : vecteurs scratch — zéro allocation par frame ici.
        const target = this._camT.set(p.x, p.y + (driven ? 1.15 : p.crouching ? 1.3 : 1.82), p.z),
          back = this._camB.set(
            Math.sin(cameraYaw) * Math.cos(pitch * (driven ? .45 : 1)),
            -Math.sin(pitch * (driven ? .45 : 1)),
            Math.cos(cameraYaw) * Math.cos(pitch * (driven ? .45 : 1)),
          );
        // Ray-test the complete shoulder-offset boom. Testing only the back
        // vector then offsetting the camera put it through nearby house corners.
        const desired = this._camD.copy(target).addScaledVector(back, dist);
        if (!driven) { const shs = .5 * (window.AZEvent?.cameraShoulder ?? 1); desired.x += Math.cos(yaw) * shs; desired.z -= Math.sin(yaw) * shs; }
        else desired.y += 1.05 + Math.min(1.2, Math.abs(driven.speed || 0) * .045);
        desired.y = Math.max(desired.y, S.heightAt(desired.x, desired.z) + .34, -1.3);
        this._camS.copy(desired).sub(target);
        const boomLength = this._camS.length();
        this.ray.set(target, this._camS.normalize());
        this.ray.far = boomLength + .25;
        // v21 wiring : tampons réutilisés pour les obstacles du raycast.
        const obstacles = this._obsBuf;
        obstacles.length = 0;
        for (const m of this.objects.values())
          if (m.visible && m.userData.type === "house" && m.position.distanceTo(target) < 35) obstacles.push(m);
        for (const m of this.builds.values())
          if (m.visible && m.position.distanceTo(target) < 9) obstacles.push(m);
        const hits = this.ray.intersectObjects(obstacles, true);
        if (hits.length) desired.copy(target).addScaledVector(this._camS, Math.min(boomLength, Math.max(.12, hits[0].distance - .28)));
        const recoil = this.actors.get(p.id)?.userData.recoil || 0;
        desired.x += Math.sin(time * 82) * recoil * 0.015;
        desired.y += recoil * 0.018;
        // v21 wiring : transitions amorties entre états caméra (bus → chute →
        // sol → visée → véhicule). Coupe franche uniquement au changement de
        // mode (bus/sol/véhicule) pour éviter les traversées de décor.
        const camMode = driven ? "drive" : opts.aim ? "aim" : "foot";
        const snap = !this._camMode || this._camMode === "bus";
        this._camMode = camMode;
        if (snap) this.camera.position.copy(desired);
        else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 16));
        // Jamais au-delà du boom validé par le raycast, même après amorti.
        this._camS.copy(this.camera.position).sub(target);
        const camLen = this._camS.length();
        if (camLen > boomLength + 0.001) this.camera.position.copy(target).addScaledVector(this._camS.normalize(), boomLength);
        // v21 wiring : secousse par trauma — dosée, décroît toute seule,
        // la caméra reste toujours libre (pas de cinématique forcée).
        this._shake = Math.max(0, this._shake - dt * 1.6);
        const sh = this._shake * this._shake;
        if (sh > 0.0001) {
          this.camera.position.x += (Math.random() - .5) * .3 * sh;
          this.camera.position.y += (Math.random() - .5) * .22 * sh;
        }
        this.camera.lookAt(this._camS.copy(target).addScaledVector(back, -100));
        if (sh > 0.0001) this.camera.rotation.z += Math.sin(time * 87) * .02 * sh;
        this.camera.fov = T.MathUtils.lerp(
          this.camera.fov,
          // v21 wiring : FOV dynamique — +5 au sprint au sol (jamais en visée).
          opts.aim ? (sniperAim ? 24 : 47) : p.falling || p.gliding ? 78 : p.flying ? 72 : opts.sprint ? 70 : 65,
          1 - Math.exp(-dt * 9),
        );
      }
      this.camera.updateProjectionMatrix();
      this.stormWall.visible = !["creative", "training", "event"].includes(w.mode) && w.phase === "active";
      this.stormRing.visible = this.stormWall.visible;
      this.stormWall.position.set(w.storm.x, 160, w.storm.z);
      this.stormWall.scale.set(Math.max(0.1, w.storm.radius), 1, Math.max(0.1, w.storm.radius));
      this.stormWall.material.uniforms.time.value = time;
      this.stormRing.position.set(w.storm.x, 3, w.storm.z);
      this.stormRing.scale.setScalar(Math.max(0.1, w.storm.radius));
      const ghostAllowed = opts.buildType && p.alive && p.deployed && !p.gliding && !p.swimming && !p.vehicleId;
      if (ghostAllowed) {
        const buildLevel = Number.isInteger(opts.buildLevel) ? opts.buildLevel : 0;
        const validation = typeof w.canBuild === "function" ? w.canBuild(p, opts.buildType, opts.material || opts.mat || "wood", opts.buildRotation || 0, buildLevel) : null;
        const b = validation?.placement || S.buildPlacement(p, opts.buildType, opts.buildRotation || 0, buildLevel);
        b.material = opts.material || opts.mat || "wood";
        b.editMask = 511;
        b.invalid = validation ? !validation.ok : false;
        // Placement changes every aim/movement frame, but its visual topology does
        // not. Cache by authored shape only and move one preview mesh in place;
        // this avoids geometry/material churn while retaining exact sim placement.
        const key = [b.type, b.material, b.editMask].join("/");
        if (this.ghostKey !== key) {
          if (this.ghost) {
            this.scene.remove(this.ghost);
            this.disposeTree(this.ghost);
          }
          this.ghost = A.buildModel({ ...b, x: 0, y: 0, z: 0, yaw: 0 }, true);
          const outline = new T.LineSegments(new T.EdgesGeometry(this.ghost.geometry, 28), new T.LineBasicMaterial({ color: "#c8fff5", transparent: true, opacity: .82, depthWrite: false }));
          outline.userData.shared = false; this.ghost.add(outline); this.ghost.userData.previewOutline = outline;
          const grid = new T.GridHelper(4, 4, "#f8d88e", "#8deee2");
          grid.position.y = .025; grid.material.transparent = true; grid.material.opacity = .42; grid.material.depthWrite = false;
          grid.userData.shared = false; this.ghost.add(grid); this.ghost.userData.previewGrid = grid;
          this.scene.add(this.ghost);
          this.ghostKey = key;
        }
        this.ghost.position.set(b.x, b.y, b.z);
        this.ghost.rotation.y = b.yaw || 0;
        this.ghost.visible = true;
        this.ghost.material.opacity = 0.24 + Math.sin(time * 5) * 0.055;
        const enough = w.mode === "creative" || p.mats?.[b.material] >= 10, valid = enough && !b.invalid;
        this.ghost.material.color.set(valid ? "#6ef4e5" : "#ff7673");
        const outline=this.ghost.userData.previewOutline;if(outline){outline.material.color.set(valid?"#d8fff7":"#ffd0cc");outline.material.opacity=.68+Math.sin(time*5)*.14;}
      } else if (this.ghost) this.ghost.visible = false;
      this.marker.visible = !!opts.marker;
      if (opts.marker) {
        this.marker.position.set(opts.marker.x, S.heightAt(opts.marker.x, opts.marker.z), opts.marker.z);
        this.marker.children[1].rotation.y = time;
      }
      for (const e of w.events)
        if (e.id > this.lastEvent) {
          this.emit(e, p);
          opts.onEvent?.(e);
          this.lastEvent = e.id;
        }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const txt = this.texts[i];
        txt.life -= dt;
        if (txt.mesh.isSprite) txt.mesh.position.y += dt * .75;
        if (txt.damageLabel) {
          const depth = txt.mesh.position.distanceTo(this.camera.position);
          const pixelWorld = 2 * Math.tan(this.camera.fov * Math.PI / 360) * depth / Math.max(1, this.canvas.clientHeight);
          const pop = 1 + Math.sin(Math.min(1, (txt.max - txt.life) * 6) * Math.PI) * .18;
          txt.mesh.scale.set(100 * pixelWorld * pop, 38 * pixelWorld * pop, 1);
        }
        txt.mesh.material.opacity = Math.max(0, txt.life / txt.max);
        if (txt.life <= 0) {
          this.scene.remove(txt.mesh);
          if (!txt.mesh.isSprite) txt.mesh.geometry?.dispose();
          txt.mesh.material.map?.dispose();
          txt.mesh.material.dispose();
          this.texts.splice(i, 1);
        }
      }
      this.updateShotEffects(dt);
      this.particles = this.particles.filter((p) => p.t > 0);
      let pn = 0;
      for (const p of this.particles) {
        p.t -= dt;
        p.vy -= dt * 7;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.rotation.set(time, time * 0.5, 0);
        this.dummy.scale.setScalar(Math.max(0, p.t / p.max) * 1.7);
        this.dummy.updateMatrix();
        this.particleMesh.setMatrixAt(pn, this.dummy.matrix);
        this.particleMesh.setColorAt(pn, this._scratchColor.set(p.col));
        pn++;
      }
      this.particleMesh.count = pn;
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
      // v19 FX (worker animations 2/4): pooled effects — tracers, impacts, dust,
      // explosions, eliminations, muzzle flashes, casings, build puffs — tick
      // exactly once per frame. Guarded: never crashes if the art module is absent.
      if (A.fx && A.fx.update) A.fx.update(dt);
      this.renderer.render(this.scene, this.camera);
    }
  }
  root.AZView = { View, avatar: A.avatar, weapon: A.weapon };
})(window);
