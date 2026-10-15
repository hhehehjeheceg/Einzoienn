/* AZUR: original synthesized Web Audio palette — no sampled or licensed game audio. */
(function(root){'use strict';
  class Audio {
    constructor(){
      this.ctx=null; this.disabled=false; this.settings={music:.25,sfx:.65};
      this.menu=true; this.note=0; this.lastNote=0; this.lastAmbient=0; this.lastBird=0; this.lastLap=0; this.lastCricket=0;
      this.stepDistance=0; this.stepAlt=0; this.engineTime=0; this.emoteTime=0; this.voiceCount=0; this.maxVoices=48;
      this.nodes=[]; this.noiseBuffer=null; this.reverb=null;
      this._wind=null; this._windLevel=-1; this._drone=null; this._droneLevel=-1;
      this._lastSlot=-1; this._reloading=false; this._lastStroke=0; this._dayOf='day';
    }
    configure(s){
      s=s||{}; this.settings={music:Math.max(0,Math.min(1,Number(s.music==null?this.settings.music:s.music)||0)),sfx:Math.max(0,Math.min(1,Number(s.sfx==null?this.settings.sfx:s.sfx)||0))};
      if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.settings.music,this.ctx.currentTime,.015);
      if(this.sfxBus)this.sfxBus.gain.setTargetAtTime(this.settings.sfx,this.ctx.currentTime,.015);
      if(this.ambientBus)this.ambientBus.gain.setTargetAtTime(this.settings.sfx*.22,this.ctx.currentTime,.03);
    }
    start(){
      if(this.disabled)return Promise.resolve(false);
      try{
        if(!this.ctx){
          const C=root.AudioContext||root.webkitAudioContext; if(!C){this.disabled=true;return Promise.resolve(false);}
          this.ctx=new C();
          this.master=this.ctx.createGain(); this.musicBus=this.ctx.createGain(); this.sfxBus=this.ctx.createGain(); this.ambientBus=this.ctx.createGain();
          this.master.gain.value=.42; this.musicBus.gain.value=this.settings.music; this.sfxBus.gain.value=this.settings.sfx; this.ambientBus.gain.value=this.settings.sfx*.22;
          this.musicBus.connect(this.master); this.sfxBus.connect(this.master); this.ambientBus.connect(this.master); this.master.connect(this.ctx.destination);
          this.reverb=this.ctx.createConvolver(); this.reverb.buffer=this.impulse(.42,.19); this.reverb.connect(this.sfxBus); this.noiseBuffer=this.makeNoise(2);
        }
        const r=this.ctx.state==='suspended'?this.ctx.resume():undefined;
        return Promise.resolve(r).catch(function(){return false;});
      }catch(e){this.disabled=true;return Promise.resolve(false);}
    }
    impulse(seconds,decay){const n=Math.floor(this.ctx.sampleRate*seconds),b=this.ctx.createBuffer(2,n,this.ctx.sampleRate);for(let c=0;c<2;c++){let d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay*8)*.32;}return b;}
    makeNoise(seconds){const n=Math.floor(this.ctx.sampleRate*seconds),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b;}
    configureVoice(o){if(!this.ctx||this.ctx.state!=='running'||this.voiceCount>=this.maxVoices)return null;this.voiceCount++;const done=()=>{this.voiceCount=Math.max(0,this.voiceCount-1);};o.addEventListener('ended',done,{once:true});return o;}
    tone(freq,duration=.1,type='sine',vol=.3,end,pan=0,bus){if(!this.ctx||this.ctx.state!=='running'||!this.settings.sfx&&bus!==this.musicBus)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();if(!this.configureVoice(o))return;o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),this.ctx.currentTime);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),this.ctx.currentTime+duration);g.gain.setValueAtTime(Math.max(.0001,vol),this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+duration);o.connect(g);this.route(g,pan,bus||this.sfxBus);o.start();o.stop(this.ctx.currentTime+duration+.025);}
    route(source,pan,bus){if(this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan||0));source.connect(p);p.connect(bus);}else source.connect(bus);}
    noise(duration,vol,cutoff=1400,pan=0,reverb=false,bus){if(!this.ctx||this.ctx.state!=='running'||!this.settings.sfx&&bus!==this.musicBus)return;const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();if(!this.configureVoice(src))return;src.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=cutoff;g.gain.setValueAtTime(vol,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+duration);this.route(g,pan,bus||this.sfxBus);if(reverb)g.connect(this.reverb);src.connect(f);f.connect(g);src.start(0);src.stop(this.ctx.currentTime+duration+.02);}
    ui(ok=true){this.start();this.tone(ok?650:145,.09,'sine',.14*this.settings.sfx,ok?1000:75);}
    reward(){this.start();[523,659,784,1046,1319].forEach((n,i)=>setTimeout(()=>this.tone(n,.22,'triangle',.22*this.settings.sfx,undefined,(i-2)*.12),i*75));}
    /* v19 — sons de récompense : fanfare de victoire, montée de niveau, quête accomplie, pluie d'écus, butin. */
    victory(){this.start();const s=this.settings.sfx;
      [523,659,784,1046].forEach((n,i)=>setTimeout(()=>{this.tone(n,.5,'triangle',.24*s,undefined,(i-1.5)*.15);this.tone(n/2,.55,'sine',.12*s);},i*110));
      setTimeout(()=>{[659,784,1046,1319].forEach(n=>{this.tone(n,.9,'triangle',.2*s);this.tone(n*2,.9,'sine',.06*s);});this.noise(.7,.12,6000,0,true);},470);
      setTimeout(()=>{[784,1046,1319,1568].forEach(n=>this.tone(n,1.2,'triangle',.18*s));this.noise(1,.1,7000,0,true);},950);}
    levelUp(){this.start();const s=this.settings.sfx;
      for(let i=0;i<12;i++)setTimeout(()=>this.tone(400+i*90,.12,'sine',.12*s,undefined,(i-6)*.1),i*45);
      setTimeout(()=>{this.tone(880,.5,'triangle',.22*s,1760);this.tone(1320,.7,'sine',.1*s,1980);},560);}
    questComplete(){this.start();const s=this.settings.sfx;
      [660,880,990,1320].forEach((n,i)=>setTimeout(()=>this.tone(n,.16,'triangle',.2*s,undefined,(i-1.5)*.12),i*80));}
    coins(){this.start();const s=this.settings.sfx;
      for(let i=0;i<6;i++)setTimeout(()=>{this.tone(1568,.07,'square',.07*s,2093);this.tone(2093,.09,'sine',.09*s,2637,(i%2?.2:-.2));},i*70);}
    loot(pan=0,vol=1){this.tone(660,.12,'sine',.23*vol,980,pan);this.tone(990,.2,'triangle',.16*vol,1320,pan);setTimeout(()=>{this.tone(1320,.25,'triangle',.14*vol,1760,pan);this.tone(660,.2,'sine',.08*vol,1320,-pan);},95);}
    /* v21 — palette jeu : chaque son reste doux, jamais agressif. Les volumes
       sont calibrés pour le mix existant (master .42, bus sfx .65). */
    footstep(biome,vol=1,pan=0){
      this.stepAlt^=1; const alt=this.stepAlt?1:-1, s=this.settings.sfx*vol, p=pan+alt*.1, det=1+alt*.04;
      if(biome==='snow'){this.noise(.055,.035*s,2600,p);this.tone(880*det,.035,'triangle',.014*s,620,p);}
      else if(biome==='sand'||biome==='desert'){this.noise(.07,.05*s,520,p);this.tone(105*det,.06,'sine',.028*s,70,p);}
      else if(biome==='water'){this.noise(.08,.045*s,1200,p);this.tone(300*det,.05,'sine',.02*s,180,p);}
      else{this.noise(.05,.048*s,760,p);this.tone(148*det,.055,'triangle',.026*s,92,p);}
    }
    swimStroke(intensity=1,pan=0){const s=this.settings.sfx*intensity;
      this.noise(.26,.055*s,760,pan);this.tone(165,.2,'sine',.032*s,82,pan);
      setTimeout(()=>this.tone(320+Math.random()*380,.1,'sine',.012*s,760,pan),90);}
    splashSfx(size=.8,pan=0,vol=1){const s=this.settings.sfx*vol;
      this.noise(.28+.4*size,.10+.20*size*s,900+1500*size,pan);this.tone(215,.24,'sine',.055*s,58,pan);
      if(size>.6)setTimeout(()=>this.noise(.3,.05*s,2400,pan),70);}
    jumpSfx(vol=1,pan=0){const s=this.settings.sfx*vol;this.noise(.08,.045*s,520,pan);this.tone(175,.09,'sine',.035*s,305,pan);}
    landSfx(hard=.3,pan=0,vol=1){const s=this.settings.sfx*vol;
      this.noise(.11,.09+.14*hard*s,430,pan);this.tone(72,.17,'sine',.09+.11*hard*s,30,pan);}
    buildKnock(type='wall',pan=0,vol=1){const s=this.settings.sfx*vol;
      const base={wall:205,floor:158,ramp:186,roof:238}[type]||195;
      this.tone(base,.09,'triangle',.20*s,base*.66,pan);this.tone(base*1.5,.07,'sine',.08*s,base*.9,pan);
      this.noise(.05,.11*s,1900,pan);setTimeout(()=>this.tone(base*2.02,.06,'triangle',.05*s,base*1.4,pan),45);}
    editTick(pan=0,vol=1){const s=this.settings.sfx*vol;this.tone(880,.05,'square',.085*s,660,pan);this.noise(.03,.055*s,3200,pan);}
    crumbleSfx(big=1,pan=0,vol=1){const s=this.settings.sfx*vol;
      this.noise(.38,.26*big*s,720,pan,true);this.tone(68,.34,'sine',.20*big*s,26,pan);
      for(let i=0;i<3;i++)setTimeout(()=>this.tone(290+i*130,.06,'triangle',.055*s,170,pan+(i-1)*.2),60+i*70);}
    harvestHit(pan=0,vol=1){const s=this.settings.sfx*vol;this.tone(205,.07,'square',.11*s,118,pan);this.noise(.04,.075*s,2700,pan);}
    harvestBreak(pan=0,vol=1){const s=this.settings.sfx*vol;this.noise(.24,.18*s,1500,pan);this.tone(150,.2,'triangle',.11*s,66,pan);}
    pickupSfx(rarity=0,pan=0,vol=1){const s=this.settings.sfx*vol,base=620*(1+rarity*.13);
      this.tone(base,.09,'triangle',.16*s,base*1.26,pan);setTimeout(()=>this.tone(base*1.5,.13,'triangle',.13*s,base*2,pan),70);}
    chestSfx(pan=0,vol=1){const s=this.settings.sfx*vol;
      this.tone(140,.3,'sawtooth',.055*s,88,pan);this.noise(.18,.06*s,900,pan);
      [880,1174,1568].forEach((n,i)=>setTimeout(()=>this.tone(n,.22,'triangle',.10*s,n*1.01,pan+(i-1)*.15),140+i*65));}
    swapSfx(vol=1){const s=this.settings.sfx*vol;this.tone(295,.08,'triangle',.09*s,175,0);setTimeout(()=>this.tone(415,.09,'triangle',.09*s,645,0),85);}
    reloadDoneSfx(){const s=this.settings.sfx;this.tone(980,.05,'square',.10*s,1240,.1);setTimeout(()=>this.tone(1240,.07,'triangle',.09*s,1560,-.1),60);}
    useStart(kind='heal',pan=0){const s=this.settings.sfx;
      if(kind==='shield'){for(let i=0;i<3;i++)setTimeout(()=>this.tone(305,.09,'sine',.07*s,175,pan),i*130);}
      else{this.noise(.5,.045*s,950,pan);this.tone(235,.3,'sine',.045*s,175,pan);}}
    healDone(){const s=this.settings.sfx;this.tone(523,.3,'triangle',.13*s,784);setTimeout(()=>this.tone(784,.42,'sine',.075*s,1046),110);}
    reviveTick(progress=0){this.tone(440+progress*230,.07,'sine',.05*this.settings.sfx,undefined,(progress-.5)*.5);}
    reviveDone(){const s=this.settings.sfx;[392,523,659,784].forEach((n,i)=>setTimeout(()=>this.tone(n,.24,'triangle',.13*s,n*1.005,(i-1.5)*.14),i*90));}
    killSfx(){const s=this.settings.sfx;this.tone(660,.09,'square',.09*s,990);setTimeout(()=>this.tone(990,.15,'triangle',.10*s,1320),70);}
    downSfx(){const s=this.settings.sfx;this.tone(165,.5,'sawtooth',.14*s,38);this.noise(.4,.16*s,320);}
    shieldCrackSfx(pan=0,vol=1){const s=this.settings.sfx*vol;this.noise(.15,.16*s,3300,pan);this.tone(1180,.12,'triangle',.09*s,290,pan);}
    zoneWarnSfx(){const s=this.settings.sfx;
      for(let i=0;i<2;i++)setTimeout(()=>{this.tone(392,.55,'sine',.085*s,523);this.tone(196,.55,'sine',.05*s,262);},i*680);}
    stormPulseSfx(){const s=this.settings.sfx;this.tone(55,1.2,'sine',.19*s,30);this.noise(1,.11*s,240,0,true);}
    craftSfx(pan=0){const s=this.settings.sfx;this.tone(180,.15,'square',.11*s,90,pan);this.noise(.16,.08*s,2100,pan);
      setTimeout(()=>this.tone(1244,.2,'triangle',.06*s,830,pan),95);}
    gliderSnapSfx(pan=0,vol=1){const s=this.settings.sfx*vol;this.noise(.12,.13*s,2500,pan);this.tone(185,.32,'sine',.055*s,92,pan);}
    uiClick(){this.tone(700,.05,'sine',.07*this.settings.sfx,905);}
    uiHover(){this.tone(505,.03,'sine',.028*this.settings.sfx,610);}
    uiBack(){this.tone(415,.07,'sine',.06*this.settings.sfx,255);}
    uiTab(){this.tone(520,.07,'triangle',.075*this.settings.sfx,780);}
    uiError(){this.tone(180,.16,'square',.08*this.settings.sfx,118);}
    birdCall(pan=0){const s=this.settings.sfx,n=2+Math.floor(Math.random()*3),f=2300+Math.random()*900;
      for(let i=0;i<n;i++)setTimeout(()=>this.tone(f+Math.random()*300,.07,'sine',.015*s,f+500+Math.random()*400,pan),i*110);}
    cricket(pan=0){const s=this.settings.sfx;for(let i=0;i<4;i++)setTimeout(()=>this.tone(4300,.025,'sine',.009*s,3850,pan),i*70);}
    waterLap(vol=1){const s=this.settings.sfx*vol;this.noise(.5,.026*s,720,0,false,this.ambientBus);this.tone(138,.4,'sine',.013*s,88,0,this.ambientBus);}
    distance(e,p){if(!e||!p)return {d:0,pan:0,vol:1};const dx=(e.x||0)-(p.x||0),dz=(e.z||0)-(p.z||0),d=Math.hypot(dx,(e.y||0)-(p.y||0),dz),yaw=p.yaw||0;return {d,pan:Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/(d||1))),vol:1/(1+d*.035)};}
    /* v21 — boucle de vent continue (planeur, chute, altitude) et bourdonnement
       de tempête : deux nœuds longue durée, gain piloté en douceur. */
    _ensureWind(){if(this._wind||!this.ctx)return;try{
      const src=this.ctx.createBufferSource();src.buffer=this.noiseBuffer;src.loop=true;
      const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=520;f.Q.value=.55;
      const g=this.ctx.createGain();g.gain.value=0;
      src.connect(f);f.connect(g);g.connect(this.sfxBus);src.start();this._wind={g,f};}catch(e){}}
    _windSet(level){this._ensureWind();if(!this._wind)return;level=Math.max(0,Math.min(1,level));
      if(Math.abs(level-this._windLevel)>.015){this._windLevel=level;this._wind.g.gain.setTargetAtTime(level*.16*this.settings.sfx,this.ctx.currentTime,.4);}}
    _ensureDrone(){if(this._drone||!this.ctx)return;try{
      const o=this.ctx.createOscillator();o.type='sine';o.frequency.value=47;
      const g=this.ctx.createGain();g.gain.value=0;o.connect(g);g.connect(this.sfxBus);o.start();this._drone={g};}catch(e){}}
    _droneSet(level){this._ensureDrone();if(!this._drone)return;level=Math.max(0,Math.min(1,level));
      if(Math.abs(level-this._droneLevel)>.01){this._droneLevel=level;this._drone.g.gain.setTargetAtTime(level,this.ctx.currentTime,.8);}}
    report(kind,v){const spec={pistol:[210,.1,1500],revolver:[112,.22,1600],burst:[150,.12,2200],tactical:[98,.15,1400],dmr:[190,.19,2600],smg:[170,.07,1900],rifle:[125,.11,2100],shotgun:[82,.2,1100],sniper:[260,.3,2500],launcher:[58,.34,700]}[kind]||[180,.1,1700],t=spec[1],vol=v.vol*.7;
      /* v21 — légère désyntonisation aléatoire : deux tirs identiques ne sonnent
         jamais exactement pareil, sans changer le caractère de l'arme. */
      const det=1+(Math.random()-.5)*.05;
      this.noise(t,vol,spec[2],v.pan,true);this.tone(spec[0]*det,t*.75,'sawtooth',vol*.32,spec[0]*.35,v.pan);this.tone(48,t*.9,'sine',vol*.3,25,v.pan);}
    event(e,p){if(!e||!this.ctx||this.ctx.state!=='running')return;const v=this.distance(e,p), own=e.playerId===p?.id||e.targetId===p?.id, pan=v.pan, x=e.type;
      if((x==='shot'||x==='fire')){ if(e.pellet > 0 || v.d > 300) return; this.report(e.weapon||'pistol',v); }
      else if(x==='hit'){if(e.targetId===p?.id){this.tone(130,.13,'triangle',.22,55,pan);if(e.shieldDamage>0&&e.hpDamage<=0)this.shieldCrackSfx(pan,Math.min(1,v.vol+.4));}else if(e.playerId===p?.id&&e.targetId){this.tone(e.headshot?1100:e.shieldDamage>0?880:720,.08,'triangle',.18,e.headshot?1600:1050,pan);if(e.headshot)this.tone(1560,.1,'sine',.07,2090,pan);if(e.shieldDamage>0)this.noise(.09,.1,3300,pan);} }
      else if(x==='elimination'){if(e.playerId===p?.id&&e.targetId&&e.targetId!==p?.id)this.killSfx();else if(e.targetId===p?.id)this.downSfx();}
      else if(x==='loot'||x==='chest'){this.loot(pan,v.vol);}
      else if(x==='reload'){this.tone(300,.055,'square',.12*v.vol,430,pan);setTimeout(()=>this.tone(620,.08,'square',.12*v.vol,880,pan),85);}
      else if(x==='use'){this.useStart(e.kind||'heal',pan);}
      else if(x==='heal'){if(own)this.healDone();}
      else if(x==='reviveStart'){if(own)this.tone(440,.2,'sine',.08,560,pan);}
      else if(x==='revive'){if(own||v.d<40)this.reviveDone();}
      /* v21 — la sim fusionne le payload APRÈS le type d'événement : une pose de
         pièce arrive comme type 'wall'/'floor'/'ramp'/'roof' (l'ancien test
         x==='build' ne se déclenchait donc jamais). editMask distingue edit. */
      else if(x==='wall'||x==='floor'||x==='ramp'||x==='roof'){ if(e.editMask!=null)this.editTick(pan,v.vol); else this.buildKnock(x,pan,v.vol); }
      else if(x==='destroy'||x==='demolish'){this.crumbleSfx(x==='demolish'?.8:1,pan,v.vol);}
      else if(x==='harvest'||x==='melee'){this.harvestHit(pan,v.vol);if(x==='melee')this.tone(740,.07,'triangle',.08*v.vol,420,pan);}
      else if(x==='jump'){ if(e.fromBus){this.noise(.5,.1*v.vol,1700,pan);this.tone(210,.35,'sine',.06*v.vol,110,pan);} else if(e.ordinary){this.jumpSfx(v.vol,pan);} }
      else if(x==='splash'){ if(e.cancelled)this.tone(520,.06,'square',.07*v.vol,300,pan);
        else if(e.stroke){ if(own)this.swimStroke(.8,pan); else this.noise(.18,.05*v.vol,900,pan); }
        else this.splashSfx(e.exit?.45:.9,pan,v.vol); }
      else if(x==='fish'){this.splashSfx(.55,pan,v.vol);setTimeout(()=>this.pickupSfx(2,pan,v.vol),130);}
      else if(x==='explosion'){if(v.d<260){this.noise(.65,.6*v.vol,700,pan,true);this.tone(48,.6,'sine',.5*v.vol,22,pan);}}
      else if(x==='land'){this.landSfx(own?.5:.22,pan,v.vol);}
      else if(x==='glider'||x==='glide'||x==='deploy'){ if(v.d<70)this.gliderSnapSfx(pan,v.vol); this.noise(.5,.12*v.vol,900,pan);this.tone(210,.4,'sine',.08*v.vol,110,pan); }
      else if(x==='craftVehicle'){this.craftSfx(pan);}
      else if(x==='trainingItem'){this.pickupSfx(e.rarity||0,pan,v.vol);}
      else if(x==='phase'){ const text=String(e.text||'');
        if(/^contraction/i.test(text))this.zoneWarnSfx();
        else if(/^tempête/i.test(text))this.stormPulseSfx();
        else if(!/ended/i.test(text)){this.noise(.8,.1,1100,0);this.tone(92,.7,'sawtooth',.08,55);} }
      else if(x==='transport'){this.noise(.8,.1,1100,0);this.tone(92,.7,'sawtooth',.08,55);}
    }
    ambient(time,p,world){if(this.settings.sfx<=0||!this.ctx||this.ctx.state!=='running')return;
      const day=this._dayOf!=='night';
      const coast=world&&(world.coastline||world.coast||world.nearWater||p?.swimming);
      if(time-this.lastAmbient>3.4){this.lastAmbient=time;this.noise(1.9,coast?.035:.012,coast?900:480,0,false,this.ambientBus);}
      /* v21 — clapotis près du rivage, oiseaux le jour, grillons la nuit. */
      if(!p?.swimming&&coast&&time-this.lastLap>2.6){this.lastLap=time;this.waterLap(.8+Math.random()*.4);}
      if(day){if(!p?.swimming&&time-this.lastBird>17+Math.random()*9){this.lastBird=time;this.birdCall(Math.random()*1.2-.6);}}
      else if(time-this.lastCricket>4.6){this.lastCricket=time;this.cricket(Math.random()*1.2-.6);}
    }
    update(time,menu,p,equipment,world){if(!this.ctx||this.ctx.state!=='running')return;this.menu=!!menu;
      this._dayOf=root.AZUR?.timeOfDay||this._dayOf||'day';
      this.ambient(time,p,world);
      if(menu&&this.settings.music>0&&time-this.lastNote>.58){this.lastNote=time;const scores={'music-tempete':[196,246.94,293.66,392,329.63,293.66,246.94,220],'music-luciole':[329.63,392,493.88,659.25,587.33,493.88,392,293.66],'music-courant':[220,261.63,349.23,440,523.25,349.23,293.66,261.63]};const a=scores[equipment?.music]||[261.63,329.63,392,523.25,440,392,329.63,293.66];this.tone(a[this.note++%8],1.15,'sine',.07*this.settings.music,undefined,0,this.musicBus);if(this.note%4===0)this.tone(a[(this.note+4)%8]/2,1.8,'triangle',.035*this.settings.music,undefined,0,this.musicBus);}
      else if(!menu&&equipment?.music&&this.settings.music>0&&time-this.lastNote>1.2){this.lastNote=time;this.tone(98,.9,'sine',.018*this.settings.music,82,0,this.musicBus);}
      if(p?.emote>0&&time-this.emoteTime>.28){this.emoteTime=time;this.tone([220,277,330,392][Math.floor(time*3)%4],.1,'square',.035*this.settings.music,undefined,0,this.musicBus);}
      if(menu||!p){this._windSet(0);this._droneSet(0);return;}
      /* v21 — pas contextuels (biome, alternance pied gauche/droit). Remplace
         l'ancien patch v17 : un seul endroit pilote les pas. */
      const dist=p.distance||0;if(dist<this.stepDistance)this.stepDistance=dist;
      if(p.grounded&&!p.swimming&&dist-this.stepDistance>.85){this.stepDistance=dist;
        this.footstep(root.AZSim?.biomeAt?.(p.x,p.z)||'grass',1,0);}
      /* v21 — nage : coups de brasse réguliers, cadencés par la vitesse. */
      if(p.swimming){const sp=Math.hypot(p.vx||0,p.vz||0);
        if(sp>1&&time-this._lastStroke>.62-sp*.04){this._lastStroke=time;this.swimStroke(Math.min(1.4,.6+sp*.12));}}
      /* v21 — changement d'arme et fin de rechargement détectés localement. */
      const sel=p.selected|0;
      if(this._lastSlot<0)this._lastSlot=sel;
      else if(sel!==this._lastSlot){this._lastSlot=sel;this.swapSfx();}
      if(p.reload>0)this._reloading=true;
      else if(this._reloading){this._reloading=false;this.reloadDoneSfx();}
      if(p.vehicleId&&time-this.engineTime>.18){this.engineTime=time;this.tone(57,.2,'sawtooth',.025*this.settings.sfx,68,0);}
      if(world?.phase==='transport'&&!p.deployed&&time-this.engineTime>.24){this.engineTime=time;this.tone(54,.28,'sawtooth',.045,62);this.noise(.27,.045,750);}
      else if((p.falling||p.gliding)&&time-this.engineTime>.3){this.engineTime=time;this.noise(.42,p.falling?.1:.04,p.falling?2100:1000);}
      /* v21 — vent continu : planeur, chute libre, altitude, véhicule, nage. */
      let wind=0;
      if(p.gliding)wind=.5;else if(p.falling)wind=.75;else if(p.vehicleId)wind=.28;
      if((p.y||0)>60)wind=Math.max(wind,.2);
      if(p.swimming)wind=Math.max(wind,.12);
      this._windSet(wind);
      /* v21 — bourdonnement de tempête quand le joueur est hors zone. */
      let drone=0;const st=world?.storm;
      if(st&&world.phase==='active'){const outside=Math.hypot((p.x||0)-st.x,(p.z||0)-st.z)-st.radius;
        if(outside>0)drone=Math.min(1,outside/160)*.05+(world._stormState==='shrink'?.018:0);}
      this._droneSet(drone);
    }
    suspend(){if(this.ctx)this.ctx.suspend().catch(function(){});} mute(on){if(this.master)this.master.gain.setTargetAtTime(on?0:.42,this.ctx.currentTime,.02);}
  }
  root.AZAudio=Audio;
})(window);
