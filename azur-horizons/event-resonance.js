(function (root) {
  'use strict';
  const E=root.AZEvent,T=root.THREE;if(!E||!T)return;
  let api,group,glass,filaments,particles,flash,controls,low=false,bound=false,mutedMotion=false,previousState='',resources=new Set();
  const motion=root.matchMedia('(prefers-reduced-motion: reduce)'),dummy=new T.Object3D(),tmp=new T.Vector3(),local=new T.Vector3(),color=new T.Color();
  const pending=[],pulses=new Map(),particlePool=[],rings=[];
  let filPositions,filColors,starPositions,starAlpha,seed=73219;
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const keep=r=>{resources.add(r);return r;};
  const reduced=()=>motion.matches||mutedMotion;
  function pulse(data,strength) {
    if(!api||!E.active||!data?.pos)return;
    const portal=E.rifts.find(p=>p.kind===data.kind && p.pos.distanceToSquared(data.pos)<100);
    if(portal)pulses.set(portal,Math.max(strength,pulses.get(portal)||0));
    const camera=api.camera(),distance=camera?camera.position.distanceTo(data.pos):0;
    pending.push({at:E.tTotal+Math.min(1.9,distance/600),strength:strength,done:false});
    if(pending.length>24)pending.shift();
    for(let i=0;i<(low?8:20);i++){
      const p=particlePool.find(p=>p.age>=p.life);if(!p)break;
      p.position.copy(data.pos);p.velocity.set(random()-.5,random()-.5,random()-.5).normalize().multiplyScalar(30+random()*70);p.age=0;p.life=.8+random()*1.1;
    }
    if(strength>.7){const ring=rings.find(r=>r.age>=r.life);if(ring){ring.mesh.position.copy(data.pos);if(portal)ring.mesh.quaternion.copy(portal.group.quaternion);ring.age=0;ring.life=1.2;ring.radius=portal?.radius||60;ring.mesh.visible=true;}}
  }
  function bind(){
    if(bound)return;bound=true;
    document.addEventListener('keydown',e=>{
      if(!api||!E.active||e.repeat||e.isComposing||e.keyCode===229||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      if(e.code==='F2'||e.code==='F3'){e.preventDefault();controls?.children[e.code==='F2'?0:1]?.click();}
    });
    E.on('rift:open',d=>pulse(d,.85));E.on('rift:cross',d=>pulse(d,1));E.on('rift:close',d=>pulse(d,.55));
    E.on('meteor:hit',d=>{if(api){pulse({pos:d?.pos||E.zeroPointPos,kind:'impact'},1.4);if(flash&&!reduced())flash.style.opacity='.12';}});
  }
  function build(){
    group=new T.Group();group.name='azur-rift-resonance';api.scene().add(group);
    const count=low?160:384;
    glass=new T.InstancedMesh(keep(new T.TetrahedronGeometry(1,0)),keep(new T.MeshStandardMaterial({color:0xcdefff,emissive:0x194c81,emissiveIntensity:.8,roughness:.15,metalness:.55,transparent:true,opacity:.72})),count);
    glass.instanceMatrix.setUsage(T.DynamicDrawUsage);glass.frustumCulled=false;group.add(glass);
    filPositions=new Float32Array((low?600:1400)*3);filColors=new Float32Array(filPositions.length);
    const filGeometry=keep(new T.BufferGeometry());filGeometry.setAttribute('position',new T.BufferAttribute(filPositions,3).setUsage(T.DynamicDrawUsage));filGeometry.setAttribute('color',new T.BufferAttribute(filColors,3).setUsage(T.DynamicDrawUsage));filGeometry.setDrawRange(0,0);
    filaments=new T.LineSegments(filGeometry,keep(new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.62,blending:T.AdditiveBlending,depthWrite:false,fog:false})));filaments.frustumCulled=false;group.add(filaments);
    const capacity=low?96:240;starPositions=new Float32Array(capacity*3);starAlpha=new Float32Array(capacity);
    const starGeometry=keep(new T.BufferGeometry());starGeometry.setAttribute('position',new T.BufferAttribute(starPositions,3).setUsage(T.DynamicDrawUsage));starGeometry.setAttribute('alpha',new T.BufferAttribute(starAlpha,1).setUsage(T.DynamicDrawUsage));
    const starMaterial=keep(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{pixel:{value:600}},vertexShader:'attribute float alpha;varying float vAlpha;uniform float pixel;void main(){vAlpha=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(pixel/max(1.,-p.z),1.,10.);}',fragmentShader:'varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(.65,.87,1.,pow(1.-d,2.)*vAlpha);}' }));
    particles=new T.Points(starGeometry,starMaterial);particles.frustumCulled=false;group.add(particles);
    for(let i=0;i<capacity;i++)particlePool.push({position:new T.Vector3(),velocity:new T.Vector3(),age:2,life:1});
    for(let i=0;i<4;i++){
      const mat=keep(new T.MeshBasicMaterial({color:0xb9eaff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,fog:false}));
      const mesh=new T.Mesh(keep(new T.TorusGeometry(1,.012,4,low?48:80)),mat);group.add(mesh);mesh.visible=false;rings.push({mesh,age:2,life:1,radius:60});
    }
    flash=document.createElement('div');flash.className='resonance-flash';flash.setAttribute('aria-hidden','true');document.body.appendChild(flash);
    controls=document.createElement('div');controls.className='resonance-controls';
    const aid=document.createElement('button');aid.type='button';aid.innerHTML='REPÈRES<span class="rk"> · F2</span>';aid.setAttribute('aria-pressed','false');aid.setAttribute('aria-label','Afficher les repères narratifs de l’événement');
    aid.onclick=()=>{const on=aid.getAttribute('aria-pressed')!=='true';aid.setAttribute('aria-pressed',String(on));document.body.classList.toggle('event-guidance',on);};
    const effects=document.createElement('button');effects.type='button';effects.innerHTML='EFFETS<span class="rk"> · F3</span>';effects.setAttribute('aria-pressed','true');effects.setAttribute('aria-label','Réduire les effets lumineux et les mouvements');
    effects.onclick=()=>{mutedMotion=!mutedMotion;E.softEffects=mutedMotion;effects.setAttribute('aria-pressed',String(!mutedMotion));effects.innerHTML=(mutedMotion?'EFFETS DOUX':'EFFETS')+'<span class="rk"> · F3</span>';};
    controls.append(aid,effects);document.body.appendChild(controls);
  }
  function writeSegment(a,b,power,cursor){
    if(cursor+6>filPositions.length)return cursor;
    filPositions[cursor]=a.x;filPositions[cursor+1]=a.y;filPositions[cursor+2]=a.z;filPositions[cursor+3]=b.x;filPositions[cursor+4]=b.y;filPositions[cursor+5]=b.z;
    color.setRGB(.4*power,.75*power,power);for(let j=0;j<6;j++)filColors[cursor+j]=j%3===0?color.r:j%3===1?color.g:color.b;
    return cursor+6;
  }
  const a=new T.Vector3(),b=new T.Vector3(),side=new T.Vector3();
  function updatePortals(dt){
    let instance=0,cursor=0,visible=0;
    const calm=reduced(),time=calm?E.tTotal*.12:E.tTotal;
    for(const portal of E.rifts){
      if(!portal.group||portal.opening<.005)continue;visible++;portal.group.updateWorldMatrix(true,false);
      const strength=pulses.get(portal)||0;pulses.set(portal,Math.max(0,strength-dt*1.4));
      const r=portal.radius,opening=portal.opening,amount=low?8:20;
      for(let i=0;i<amount && instance<glass.count;i++){
        const phase=(i*.6180339+portal.seed*.17)%1,theta=phase*Math.PI*2,orbit=calm?.85:.8+((time*.045+i*.081)%1)*.48;
        local.set(Math.cos(theta)*r*orbit,Math.sin(theta)*r*.52*orbit,(Math.sin(i*2.7+time*.15)*.12-.08)*r).applyAxisAngle(side.set(0,0,1),portal.angle||0);
        tmp.copy(local).applyQuaternion(portal.group.quaternion).add(portal.pos);dummy.position.copy(tmp);
        dummy.rotation.set(i*1.4+time*.15,i*.7+time*.11,i+time*.18);const size=(1.2+i%3*.7)*opening*(1+strength*.8);dummy.scale.set(size*.55,size*1.6,size*.24);dummy.updateMatrix();glass.setMatrixAt(instance++,dummy.matrix);
      }
      for(let branch=0;branch<(low?5:9);branch++){
        const sign=branch%2?-1:1,angle=branch*2.399963+(portal.angle||0),reach=r*(.9+branch%3*.25)*(1+strength*.2),segments=calm?4:6;
        for(let j=0;j<segments;j++){
          const t0=j/segments,t1=(j+1)/segments;
          const pos=(v,t)=>{const length=r*.4+t*reach;const jag=Math.sin(branch*43+t*27+portal.seed)*r*.075*t;v.set(Math.cos(angle)*length-jag*Math.sin(angle),Math.sin(angle)*length*.65+jag*Math.cos(angle),Math.sin(t*5+branch)*r*.055*sign);v.applyQuaternion(portal.group.quaternion).add(portal.pos);};
          pos(a,t0);pos(b,t1);cursor=writeSegment(a,b,(1-t0)*opening*(.55+strength*.6),cursor);
        }
      }
    }
    glass.count=instance;glass.instanceMatrix.needsUpdate=true;glass.visible=instance>0;
    glass.userData.active=instance;
    filaments.geometry.setDrawRange(0,cursor/3);filaments.geometry.attributes.position.needsUpdate=true;filaments.geometry.attributes.color.needsUpdate=true;
    filaments.material.opacity=calm?.28:.65;
    E.resonance={openPortals:visible,glassFragments:instance,reducedMotion:calm,filamentVertices:cursor/3};
  }
  function update(dt){
    if(!api||!group)return;
    const state=E.state,late=['contraction','collapse','growth','destruction','playersucked','allgone','blackhole','numbers','end'].includes(state);
    group.visible=!late;controls.hidden=['allgone','blackhole','numbers','end'].includes(state);
    glass.count=low?160:384;updatePortals(dt);
    for(let i=0;i<particlePool.length;i++){
      const p=particlePool[i];p.age+=dt;p.position.addScaledVector(p.velocity,dt);p.velocity.multiplyScalar(Math.exp(-dt*1.5));
      p.position.toArray(starPositions,i*3);starAlpha[i]=p.age<p.life?(1-p.age/p.life)*(reduced()?.35:1):0;
    }
    particles.geometry.attributes.position.needsUpdate=true;particles.geometry.attributes.alpha.needsUpdate=true;
    particles.material.uniforms.pixel.value=Math.min(900,root.innerHeight*.7);
    rings.forEach(r=>{r.age+=dt;const k=Math.min(1,r.age/r.life);r.mesh.visible=k<1 && !reduced();r.mesh.scale.setScalar(r.radius*(.35+k*2));r.mesh.material.opacity=(1-k)*(1-k)*.45;});
    for(const sound of pending){if(!sound.done&&E.tTotal>=sound.at){sound.done=true;const game=api.game();if(game?.audio && !game.muted){game.audio.tone(38+sound.strength*18,.38,'sine',.025*sound.strength,25);game.audio.noise(.22,.022*sound.strength,500);}if(!reduced()&&game?.view)game.view._shake=Math.max(game.view._shake||0,Math.min(.12,sound.strength*.07));}}
    while(pending[0]?.done)pending.shift();
    if(flash)flash.style.opacity=String(Math.max(0,Number(flash.style.opacity||0)-dt*.4));
    if(previousState!==state){previousState=state;document.body.dataset.resonancePhase=state;}
  }
  function dispose(){
    group?.parent?.remove(group);resources.forEach(r=>r.dispose?.());resources=new Set();flash?.remove();controls?.remove();
    document.body.classList.remove('event-guidance');delete document.body.dataset.resonancePhase;
    group=glass=filaments=particles=flash=controls=api=null;particlePool.length=0;rings.length=0;pending.length=0;pulses.clear();E.resonance=null;E.softEffects=false;
  }
  E.register('resonance',{init:a=>{dispose();api=a;low=a.isMobile||a.quality==='low';mutedMotion=false;seed=73219;previousState='';build();bind();},preUpdate:update,dispose});
})(window);
