/* AZUR 2.0 — bounded rendering, small caches, predictable frame pacing. */
(function(root){
  'use strict';
  const T=root.THREE,V=root.AZView.View.prototype,P=root.AZURHorizons.prototype;
  // Visual grade fields are additive: low/medium keep their exact previous look
  // (warmth 0, exposure 1.03, PCFSoft shadows) so the default experience and
  // the event layer are untouched. High/ultra gain a warmer cinematic grade;
  // ultra and the new opt-in `vivid` preset use blurred VSM shadows.
  const V2_WARM=new T.Color('#ffd9a8');
  const presets={
    low:{pixel:1,distance:245,shadow:0,extent:36,exposure:1.03,warmth:0,shadowRadius:1.5,vsm:false},
    medium:{pixel:1.35,distance:420,shadow:1024,extent:42,exposure:1.05,warmth:.25,shadowRadius:1.5,vsm:false},
    high:{pixel:1.7,distance:630,shadow:2048,extent:48,exposure:1.05,warmth:.32,shadowRadius:1.5,vsm:false},
    ultra:{pixel:2,distance:850,shadow:2048,extent:54,exposure:1.06,warmth:.45,shadowRadius:6,vsm:true},
    vivid:{pixel:1.5,distance:520,shadow:1024,extent:44,exposure:1.09,warmth:.60,shadowRadius:6,vsm:true}
  };
  V.configure=function(s={}){
    this.quality=presets[s.quality]?s.quality:'medium';const q=presets[this.quality];
    this.performanceAuto=s.performance!==false;this._perfMs=16.7;this._perfBad=this._perfGood=0;this._perfCritical=0;this.adaptiveDetail=1;this.v2UltraLow=false;
    this.drawDistance=q.distance;this.v2BaseDistance=q.distance;
    this.v2PixelCap=Math.min(q.pixel,this.mobileRenderer?1.35:2,devicePixelRatio||1);
    this.renderer.setPixelRatio(this.v2PixelCap);this.allowShadows=s.shadows!==false&&q.shadow>0;
    this.renderer.shadowMap.enabled=this.allowShadows;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate=true;
    const size=this.mobileRenderer?Math.min(q.shadow||512,1024):q.shadow||512;
    if(this.sun.shadow.map&&this.sun.shadow.map.width!==size){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}
    if(this.sun.shadow.map&&this.sun.shadow.map.width!==size){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}this.sun.shadow.mapSize.set(size,size);Object.assign(this.sun.shadow.camera,{left:-q.extent,right:q.extent,top:q.extent,bottom:-q.extent,near:1,far:240});this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.028;this.sun.shadow.radius=q.shadowRadius!=null?q.shadowRadius:1.5;
    if(q.vsm)this.sun.shadow.blurSamples=16;
    // Blurred VSM shadows stay opt-in (ultra/vivid). Switching the shadow map
    // type needs one material refresh, applied only when the type changes.
    const wantVSM=!!q.vsm;
    if(this._vsmShadows!==wantVSM){this._vsmShadows=wantVSM;this.scene?.traverse?.((o)=>{const mats=Array.isArray(o.material)?o.material:o.material?[o.material]:[];mats.forEach((m)=>{m.needsUpdate=true;});});}
    this.renderer.shadowMap.type=wantVSM?T.VSMShadowMap:T.PCFShadowMap;
    // Warmer cinematic grade on high/ultra/vivid. The baseline sun colour is
    // captured once so repeated configure() calls never compound the tint;
    // warmth 0 reproduces the previous colour exactly.
    if(!this._sunBaseColor&&this.sun)this._sunBaseColor=this.sun.color.clone();
    if(this.sun&&this._sunBaseColor)this.sun.color.copy(this._sunBaseColor).lerp(V2_WARM,q.warmth||0);
    this.renderer.toneMappingExposure=q.exposure||1.03;this.resize();
  };
  V.adaptPerformance=function(rawDt){
    if(!this.performanceAuto||!rawDt||rawDt>2||document.hidden||root.AZUR?.paused)return;
    this._perfMs=this._perfMs*.94+Math.min(rawDt,.5)*1000*.06;
    if(this._perfMs>20){this._perfBad++;this._perfGood=0;}else if(this._perfMs<17.2){this._perfGood++;this._perfBad=0;}
    if(this._perfMs>30){this._perfCritical=(this._perfCritical||0)+1;}else if(this._perfMs<20){this._perfCritical=0;}
    // Sustained critical load on an already-minimal pipeline: the art layers
    // read v2UltraLow and halve submitted instances (flora, clouds, rocks).
    // It clears automatically once the frame time settles.
    if(this._perfCritical>120&&!this.v2UltraLow){this.v2UltraLow=true;}
    if(this._perfBad>45){
      this._perfBad=0;this.adaptiveDetail=Math.max(.60,(this.adaptiveDetail||1)-.08);
      this.drawDistance=Math.max(this.quality==='low'?190:270,this.drawDistance-30);
      const ratio=this.renderer.getPixelRatio(),next=Math.max(.72,ratio-.08);if(next<ratio-.01)this.renderer.setPixelRatio(next);
      if(this._perfMs>25)this.renderer.shadowMap.enabled=false;
    }else if(this._perfGood>300){
      this._perfGood=0;this.adaptiveDetail=Math.min(1,(this.adaptiveDetail||1)+.04);this.drawDistance=Math.min(this.v2BaseDistance,this.drawDistance+18);
      const ratio=this.renderer.getPixelRatio(),next=Math.min(this.v2PixelCap,ratio+.04);if(next>ratio+.01)this.renderer.setPixelRatio(next);
      if(this.allowShadows&&this._perfMs<16.8)this.renderer.shadowMap.enabled=true;
      if(this.v2UltraLow&&this._perfMs<16.8)this.v2UltraLow=false;
    }
  };
  const makeMenu=V.makeMenu;
  V.makeMenu=function(){makeMenu.call(this);const l=this.v2Lobby;if(l){l.sun.intensity=1.6;l.rim.intensity=1.05;this.menuScene.traverse(n=>{if(n.isHemisphereLight)n.intensity=1.2;if(n.isSpotLight)n.intensity*=.35;});}};
  const setWorld=V.setWorld;
  V.setWorld=function(w){this.v2ObjectIndex=new Map(w.objects.map(o=>[o.id,o]));this.v2Position=this.v2Position||new T.Vector3();this.v2Friendly=this.v2Friendly||new T.Color('#73e0c1');this.v2Enemy=this.v2Enemy||new T.Color('#e7a17e');return setWorld.call(this,w);};
  const update=V.update;
  V.update=function(w,p,dt,opts={}){
    // Reclaim dead streamed builds and distant actor rigs. Authoritative state is never deleted.
    if(!opts.menu&&(this.time-(this.v2CleanupAt||0)>3)){
      this.v2CleanupAt=this.time;
      const aliveBuilds=new Set(w.builds.filter(b=>!b.dead).map(b=>b.id));
      for(const[id,m]of this.builds)if(!aliveBuilds.has(id)){this.worldRoot.remove(m);this.disposeTree(m);this.builds.delete(id);}
      const actors=new Map(w.players.map(q=>[q.id,q]));
      for(const[id,m]of this.actors){const q=actors.get(id);if(id!==p.id&&(!q||!q.alive||Math.hypot(q.x-p.x,q.z-p.z)>180)){this.actorRoot.remove(m);this.disposeTree(m);this.actors.delete(id);}}
    }
    return update.call(this,w,p,dt,opts);
  };
  const loop=P.loop;
  P.loop=function(t){
    if(document.hidden){this.last=t;this.acc=0;requestAnimationFrame(tt=>this.loop(tt));return;}
    loop.call(this,t);
  };
  root.AZURV2Performance={presets,notes:'Adaptive resolution and view distance; pooled actor colours/vectors; bounded actor/build lifetimes. Actual FPS depend on hardware.'};
})(window);
