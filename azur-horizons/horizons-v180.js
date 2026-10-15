/* Horizons 1.8 — navigation cohérente, ascension créative et nouveaux repères. */
(function (root) {
  "use strict";
  const H=root.AZURHorizons,T=root.THREE,A=root.AZArt,S=root.AZSim;
  if(!H||!T||!A||!S)return;
  const P=H.prototype,V=root.AZView?.View?.prototype,E=root.AZEnvironment?.Environment?.prototype;
  const tabs={play:["play","SALON"],locker:["locker","CASIER"],shop:["shop","BOUTIQUE"],pass:["pass","PASSE"],quests:["star","QUÊTES"],career:["quests","MISSIONS"],group:["users","GROUPE"],settings:["settings","OPTIONS"],help:["help","AIDE"]};

  const previousRenderMenu=P.renderMenu;
  P.renderMenu=function(){
    /* v21 — fondu d'écran easé lors des changements d'écran (menu ↔ jeu ↔
       résultats). Sauté si prefers-reduced-motion. */
    const screenKey=this.screen||"";
    if(this._v21ScreenKey!==undefined&&this._v21ScreenKey!==screenKey)v21ScreenFade();
    this._v21ScreenKey=screenKey;
    previousRenderMenu.call(this);
    if(this.screen!=="menu")return;
    document.body.dataset.tab=this.tab;
    const current=tabs[this.tab]||tabs.play,bar=document.querySelector(".topbar"),nav=document.querySelector(".navlinks");
    if(bar){
      let heading=bar.querySelector(".v18-section-title");
      if(!heading){heading=document.createElement("div");heading.className="v18-section-title";nav?.before(heading);}
      heading.innerHTML=`${root.AZIcons.icon(current[0])}<strong>${current[1]}</strong>`;
    }
    nav?.querySelectorAll('[data-act="tab"]').forEach((button)=>{
      const spec=tabs[button.dataset.id]||["star",button.textContent.trim()];
      button.setAttribute("aria-label",spec[1]);button.title=spec[1];
      button.innerHTML=`${root.AZIcons.icon(spec[0])}<span>${spec[1]}</span>`;
    });
    document.querySelectorAll(".wordmark-edition,.season-badge").forEach((node)=>{node.innerHTML=node.innerHTML.replace(/1\.[3-7]/g,"1.8");});
  };

  const previousLobbyHTML=P.lobbyHTML;
  P.lobbyHTML=function(){
    const html=previousLobbyHTML.call(this);
    return html+`<aside class="v18-lobby-rail" aria-label="Nouveautés de la carte"><span><b>ASCENSION</b> parcours aérien</span><span><b>19</b> zones à explorer</span><span><b>CRÉATIF</b> ciel libre</span></aside>`;
  };

  if(V){
    const previousClassicMode=V.setClassicLobbyMode;
    if(previousClassicMode)V.setClassicLobbyMode=function(active,panel=false){return previousClassicMode.call(this,true,!!panel);};
    const previousAnimate=V.animateAvatar;
    V.animateAvatar=function(model,player,dt,options={}){
      previousAnimate.call(this,model,player,dt,options);
      const u=model?.userData;if(!u||player.emote||player.downed)return;
      const side=Number(player._input?.moveX)||0,forward=Number(player._input?.moveZ)||0,k=1-Math.exp(-dt*9);
      u.v18Lean=T.MathUtils.lerp(u.v18Lean||0,side*.065,k);
      u.v18Stride=T.MathUtils.lerp(u.v18Stride||0,forward*.035,k);
      u.torso.rotation.z-=u.v18Lean;
      u.torso.rotation.x+=u.v18Stride-(player.aim?.025:0);
      u.head.rotation.z+=u.v18Lean*.28;
      if(player.flying){u.limbs[0].rotation.z-=.12;u.limbs[2].rotation.z+=.12;}
    };
    const previousConfigure=V.configure;
    V.configure=function(settings={}){
      previousConfigure.call(this,settings);
      const premium=this.quality==="high"||this.quality==="ultra";
      this.renderer.toneMappingExposure=premium?1.13:1.075;
      this.renderer.shadowMap.autoUpdate=true;
      if(this.sun){this.sun.shadow.normalBias=premium?.018:.035;this.sun.shadow.radius=premium?.85:1.45;}
      if(this.scene?.fog)this.scene.fog.density=premium?.00082:.00098;
    };
  }

  if(E){
    E.ensureV18Landmarks=function(){
      if(this.v18Landmarks)return this.v18Landmarks;
      const g=new T.Group();g.name="v18-landmarks";
      const glow=new T.MeshBasicMaterial({color:"#4df3e1",transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending});
      const dark=new T.MeshStandardMaterial({color:"#173a58",roughness:.48,metalness:.52});
      const pale=new T.MeshStandardMaterial({color:"#c9f6ee",roughness:.35,metalness:.28});
      const citadel=S.regions.find(r=>r.style==="citadel")||S.regions[0],bx=citadel?.x||0,bz=(citadel?.z||0)+(citadel?.padD||18)+24,baseY=S.heightAt(bx,bz);
      const rings=[];
      for(let i=0;i<7;i++){
        const a=i*.8,x=bx+Math.sin(a)*13,z=bz+Math.cos(a)*13,y=baseY+14+i*19;
        const ring=new T.Mesh(new T.TorusGeometry(4.1,.14,8,32),glow.clone());ring.position.set(x,y,z);ring.rotation.y=a;ring.rotation.x=Math.PI/2+(i%2?.2:-.2);g.add(ring);rings.push(ring);
        if(i%2===0){const pad=new T.Mesh(new T.CylinderGeometry(3.1,3.4,.48,12),dark);pad.position.set(x,y-3.2,z);pad.castShadow=pad.receiveShadow=true;g.add(pad);const core=new T.Mesh(new T.CylinderGeometry(.65,.9,3.2,10),pale);core.position.set(x,y-1.6,z);g.add(core);}
      }
      const turbines=[];
      [S.regions.find(r=>r.style==="snow"),S.regions.find(r=>r.style==="meadow"),S.regions.find(r=>r.style==="desert")].filter(Boolean).forEach((r,i)=>{
        const x=r.x+(r.padW||20)+16,z=r.z-(r.padD||20)-9,y=S.heightAt(x,z),unit=new T.Group();unit.position.set(x,y,z);
        const mast=new T.Mesh(new T.CylinderGeometry(.32,.62,15,10),pale);mast.position.y=7.5;unit.add(mast);
        const hub=new T.Mesh(new T.SphereGeometry(.62,12,8),dark);hub.position.set(0,14.5,0);unit.add(hub);
        const rotor=new T.Group();rotor.position.set(0,14.5,-.55);rotor.rotation.z=i;for(let j=0;j<3;j++){const angle=j*Math.PI*2/3,blade=new T.Mesh(new T.BoxGeometry(.28,6,.11),pale);blade.position.set(-Math.sin(angle)*3,Math.cos(angle)*3,0);blade.rotation.z=angle;rotor.add(blade);}unit.add(rotor);unit.userData.rotor=rotor;g.add(unit);turbines.push(unit);
      });
      g.userData={rings,turbines};this.root.add(g);this.v18Landmarks=g;return g;
    };
    const previousUpdate=E.update;
    E.update=function(dt,focus,day,quality){
      const g=this.ensureV18Landmarks(),t=(this.v18Time=(this.v18Time||0)+dt);
      g.userData.rings.forEach((r,i)=>{r.rotation.z=t*(i%2?-.32:.28)+i*.6;r.material.opacity=.48+Math.sin(t*2+i)*.17;});
      g.userData.turbines.forEach((u,i)=>{u.userData.rotor.rotation.z=t*(.35+i*.05);});
      return previousUpdate.call(this,dt,focus,day,quality);
    };
  }

  const previousStart=P.startGameUI;
  P.startGameUI=function(){
    previousStart.call(this);
    v21ScreenFade();
    if(this.mode==="creative"){
      const hint=document.querySelector(".game-hint");if(hint)hint.insertAdjacentHTML("afterend",'<div class="v18-sky-free"><b>CRÉATIF</b><span>VOL & HAUTEUR LIBRES · CONSTRUCTION SANS FRONTIÈRE</span></div>');
    }
  };

  /* v21 — fondu d'écran : overlay inline animé en JS (aucune CSS), court-circuité
     par prefers-reduced-motion via AZV21.tween. */
  function v21ScreenFade(){
    if(!root.AZV21||root.AZV21.reducedMotion())return;
    let ov=document.getElementById("v21-screen-fade");
    if(!ov){
      ov=document.createElement("div");ov.id="v21-screen-fade";ov.setAttribute("aria-hidden","true");
      ov.style.cssText="position:fixed;inset:0;background:#04121f;opacity:0;pointer-events:none;z-index:9999;";
      document.body.appendChild(ov);
    }
    ov.style.opacity="0";
    root.AZV21.tween(230,(k)=>{ov.style.opacity=String((Math.sin(Math.PI*k)*.8).toFixed(3));},()=>{ov.style.opacity="0";});
  }

  if(E){
    /* v21 — vie du monde : les balises balaient le ciel d'un faisceau rotatif
       et les feux de camp pulsent. Zéro allocation par frame, densités réduites
       sur mobile (pas de halos en qualité basse). */
    const previousV21Update=E.update;
    let v21GlowTex=null;
    const glowTexture=()=>{
      if(v21GlowTex)return v21GlowTex;
      const c=document.createElement("canvas");c.width=c.height=64;
      const ctx=c.getContext("2d"),g=ctx.createRadialGradient(32,32,2,32,32,30);
      g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.4,"rgba(255,255,255,.45)");g.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
      v21GlowTex=new T.CanvasTexture(c);return v21GlowTex;
    };
    const v21WorldFx=function(dt,focus,quality){
      if(!this.scenery||!this.root||!focus)return;
      const t=this.time||0;
      if(!this.v21Fx){
        const group=new T.Group();group.name="v21-world-fx";
        const fx={beams:[],glows:[]};
        for(const d of this.scenery){
          const y0=S.heightAt(d.x,d.z);
          if(d.type==="beacon"){
            const mat=new T.MeshBasicMaterial({color:"#ffe9a8",transparent:true,opacity:.15,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
            const pivot=new T.Group();pivot.position.set(d.x,y0+5.2,d.z);
            for(const rot of [0,Math.PI/2]){
              const beam=new T.Mesh(new T.PlaneGeometry(1.7,11),mat);
              beam.position.y=5.5;beam.rotation.y=rot;pivot.add(beam);
            }
            group.add(pivot);fx.beams.push({pivot,mat,x:d.x,z:d.z,ph:Math.random()*6.28});
          }else if(d.type==="camp"){
            const sm=new T.SpriteMaterial({map:glowTexture(),color:"#ff9a3c",transparent:true,opacity:.45,depthWrite:false,blending:T.AdditiveBlending});
            const spr=new T.Sprite(sm);spr.position.set(d.x,y0+.55,d.z);spr.scale.setScalar(1.7);
            group.add(spr);fx.glows.push({spr,mat:sm,x:d.x,z:d.z,ph:Math.random()*6.28});
          }
        }
        this.root.add(group);this.v21Fx=fx;
      }
      const fx=this.v21Fx,lowQ=quality==="low";
      for(const b of fx.beams){
        const near=Math.hypot(b.x-focus.x,b.z-focus.z)<600;
        b.pivot.visible=near;if(!near)continue;
        b.pivot.rotation.y=t*.55+b.ph;
        b.mat.opacity=.11+Math.sin(t*1.8+b.ph)*.05;
      }
      for(const g of fx.glows){
        const near=!lowQ&&Math.hypot(g.x-focus.x,g.z-focus.z)<420;
        g.spr.visible=near;if(!near)continue;
        const flick=Math.sin(t*11+g.ph)*.5+Math.sin(t*23+g.ph*2)*.3+Math.sin(t*5+g.ph)*.2;
        g.spr.scale.setScalar(1.55+flick*.22);
        g.mat.opacity=.40+flick*.10;
      }
    };
    E.update=function(dt,focus,day,quality){
      const r=previousV21Update.call(this,dt,focus,day,quality);
      v21WorldFx.call(this,dt,focus,quality);
      return r;
    };
  }

  setTimeout(()=>{if(root.AZUR?.screen==="menu")root.AZUR.renderMenu();},0);
})(window);
