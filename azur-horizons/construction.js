(function (root) {
  'use strict';
  const H = root.AZURHorizons, R = root.AZBuildRules, T = root.THREE, S = root.AZSim;
  if (!H || !R) return;
  const P = H.prototype, names = {wall:'Mur',floor:'Sol',ramp:'Escalier',roof:'Cône'};
  const presets = {
    wall: [['Complet',511],['Fenêtre',495],['Porte',367],['Arche',47],['Muret',448],['Côté gauche',73],['Côté droit',292]],
    floor: [['Complet',511],['Angle retiré',R.expand(14)],['Demi-sol',R.expand(12)],['Quart de sol',R.expand(1)]],
    ramp: [['Complet',511],['Gauche',73],['Centre',146],['Droite',292],['Deux voies',219]],
    roof: [['Complet',511],['Un coin levé',R.expand(14)],['Pente',R.expand(12)],['Deux coins opposés',R.expand(9)],['Trois coins levés',R.expand(1)]]
  };
  function sound(game, kind) {
    game.audio?.start();
    game.audio?.tone(kind === 'confirm' ? 740 : kind === 'reset' ? 300 : 540,.06,'triangle',.07,kind === 'confirm' ? 1060 : 820);
  }
  function currentMask(game) { return ['roof','floor'].includes(game.editTargetType) ? R.expand(game.editMask) : game.editMask; }
  function updatePreview(game) {
    const b = game.world?.builds.find(q => q.id === game.editTarget), v = game.view;
    if (!b || !v) return;
    game.v17ClearPreview();
    const mesh = root.AZArt.buildModel({...b,editMask:currentMask(game)},true);
    mesh.renderOrder=7; mesh.material.opacity=.62; mesh.material.depthTest=false;
    v.v17EditPreview=mesh; v.v17EditFocus=b.id; v.worldRoot.add(mesh);
  }
  const previousNear = P.nearBuild;
  const ray = new T.Raycaster(), center = new T.Vector2(0,0);
  P.nearBuild = function (wallOnly=false) {
    const p=this.player?.(); if (!p || !this.view) return null;
    ray.setFromCamera(center,this.view.camera);
    const meshes=Array.from(this.view.builds.values()).filter(mesh=>mesh.visible);
    const hits=ray.intersectObjects(meshes,true);
    const teams=new Map(this.world.players.map(q=>[q.id,q.team]));
    for (const hit of hits) {
      let object=hit.object; while(object && !object.userData.buildId) object=object.parent;
      if (!object) continue;
      const b=this.world.builds.find(q=>q.id===object.userData.buildId);
      if (!b || b.dead || wallOnly && b.type!=='wall') continue;
      if (b.owner!==p.id && teams.get(b.owner)!==p.team) return null;
      if (Math.hypot(b.x-p.x,b.z-p.z)<8.5 && Math.abs(b.y-p.y)<6) return b;
    }
    const candidate=previousNear.call(this,wallOnly); if(!candidate)return null;
    const position=new T.Vector3(candidate.x,candidate.y+(candidate.type==='wall'?2:candidate.type==='floor'?0:1.8),candidate.z).project(this.view.camera);
    return position.z<1 && Math.hypot(position.x,position.y)<.52 ? candidate : null;
  };
  P.paintEdit = function () {
    const panel=document.getElementById('world-edit'); if(!panel)return;
    let selected=0;
    panel.querySelectorAll('[data-act="edit-cell"]').forEach(cell=>{
      const on=!!(this.editMask & (1<<Number(cell.dataset.id))); if(on)selected++;
      cell.classList.toggle('solid',on); cell.setAttribute('aria-pressed',String(on));
      cell.innerHTML='<span>'+(!on && this.editTargetType==='roof'?'LEVER':on?'':'RETIRER')+'</span>';
    });
    const mask=currentMask(this), valid=R.valid(this.editTargetType,mask), count=panel.querySelector('#edit-cell-count');
    if(count) count.textContent=valid?selected+' / '+panel.querySelectorAll('[data-act="edit-cell"]').length+' ZONES':'FORME NON VALIDE';
    const confirm=panel.querySelector('[data-act="edit-confirm"]');if(confirm)confirm.disabled=!valid;
    panel.dataset.valid=String(valid);
    panel.querySelectorAll('[data-act="build-edit-preset"]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.id)===mask)));
    updatePreview(this);
  };
  P.v17EditPreview = function () { updatePreview(this); };
  P.openEdit = function () {
    if(this.screen!=='game'||this.modal||this.editing||this.paused||root.AZEvent?.active)return;
    const b=this.nearBuild();if(!b){this.toast('Vise une de tes pièces ou une pièce alliée à moins de 8 m.');return;}
    if(this.profile.settings.simpleEdit){this.v17SimpleEdit(b);return;}
    const panel=document.getElementById('world-edit');if(!panel)return;
    this._buildBeforeEdit=this.buildType;this.editing=true;this.editTarget=b.id;this.editTargetType=b.type;
    this.editOriginalMask=b.editMask??511;this.editMask=['floor','roof'].includes(b.type)?R.compress(this.editOriginalMask):this.editOriginalMask;
    this.fire=false;this.buildType=null;this.keys={};this.keyCodes={};this.move={x:0,z:0};
    const p=this.player();p.editing=true;this.send({fire:false,moveX:0,moveZ:0,moveY:0});
    document.body.classList.add('world-editing');this.updateBuildBar();
    if(document.pointerLockElement)document.exitPointerLock();
    const columns=['floor','roof'].includes(b.type)?2:3, count=columns*columns;
    panel.hidden=false;panel.dataset.type=b.type;panel.style.setProperty('--edit-cols',columns);
    panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Modifier '+names[b.type]);
    panel.innerHTML='<div class="world-edit-head"><b>MODIFIER · '+names[b.type].toUpperCase()+'</b><span id="edit-cell-count"></span><span>'+Math.ceil(b.hp)+' PV</span></div>'+
      '<div class="construction-edit-instruction">'+(b.type==='roof'?'Sélectionne les coins à relever.':b.type==='ramp'?'Trace une ou plusieurs voies verticales.':'Sélectionne les zones à retirer.')+'</div>'+
      '<div class="world-edit-grid" id="edit-grid" role="group" aria-label="Grille '+columns+' par '+columns+'">'+Array.from({length:count},(_,i)=>'<button type="button" data-act="edit-cell" data-id="'+i+'" aria-label="Zone '+(Math.floor(i/columns)+1)+', '+(i%columns+1)+'"></button>').join('')+'</div>'+
      '<div class="construction-presets" aria-label="Formes rapides">'+presets[b.type].map(([label,mask])=>'<button type="button" data-act="build-edit-preset" data-id="'+mask+'">'+label+'</button>').join('')+'</div>'+
      '<div class="world-edit-actions"><button class="btn btn-ghost" data-act="edit-preset">RÉTABLIR</button><button class="btn btn-primary" data-act="edit-confirm">VALIDER</button><button class="btn btn-ghost" data-act="edit-cancel">ANNULER</button></div>'+
      '<div class="world-edit-tip">'+(this.profile.settings.confirmEditRelease!==false?'GLISSER · RELÂCHER POUR VALIDER':'GLISSER · F / ENTRÉE POUR VALIDER')+'<br>CLIC DROIT : RÉTABLIR · ÉCHAP : ANNULER</div>';
    let pointer=null,solid=false,painted=new Set();
    const paint=cell=>{
      if(!cell || !panel.contains(cell))return;const i=Number(cell.dataset.id);if(painted.has(i))return;painted.add(i);
      if(b.type==='ramp') { const column=i%3,bit=73<<column;this.editMask=solid?this.editMask|bit:this.editMask&~bit; }
      else this.editMask=solid?this.editMask|(1<<i):this.editMask&~(1<<i);
      cell._pointerActionAt=performance.now();this.paintEdit();sound(this,'cell');
    };
    panel.oncontextmenu=e=>e.preventDefault();
    panel.onpointerdown=e=>{
      const cell=e.target.closest('[data-act="edit-cell"]');if(!cell)return;e.preventDefault();e.stopPropagation();
      if(e.button===2){this.editMask=columns===2?15:511;this.paintEdit();sound(this,'reset');return;}
      pointer=e.pointerId;solid=!(this.editMask&(1<<Number(cell.dataset.id)));painted=new Set();panel.setPointerCapture(e.pointerId);paint(cell);
    };
    panel.onpointermove=e=>{if(e.pointerId===pointer)paint(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-act="edit-cell"]'));};
    panel.onpointerup=e=>{
      if(e.pointerId!==pointer)return;pointer=null;
      if(this.profile.settings.confirmEditRelease!==false && R.valid(b.type,currentMask(this)))this.action('edit-confirm');
    };
    panel.onpointercancel=()=>{pointer=null;};
    this.paintEdit();sound(this,'enter');panel.querySelector('[data-act="edit-cell"]').focus({preventScroll:true});
  };
  P.v17SimpleEdit = function (b) {
    const list=presets[b.type].map(pair=>pair[1]),current=b.editMask??511,next=list[(list.indexOf(current)+1)%list.length];
    this.send({editId:b.id,editMask:next});sound(this,'confirm');this.toast(names[b.type]+' · '+presets[b.type].find(pair=>pair[1]===next)[0]);
  };
  const closeEdit=P.closeWorldEdit;
  P.closeWorldEdit=function(applied=false){
    const resume=this._buildBeforeEdit;this._buildBeforeEdit=null;
    closeEdit.call(this,applied);this.buildType=resume;this.updateBuildBar();
  };
  const action=P.action;
  P.action=async function(act,id,element){
    if(act==='build-mode'||act==='build-type'||act==='material'){
      if(this.screen!=='game'||this.modal||this.editing||this.paused||root.AZEvent?.active)return;
      if(act==='build-mode'){this.buildType=this.buildType?null:'wall';if(!this.buildType)this.buildLevel=0;}
      if(act==='build-type' && names[id])this.buildType=id;
      if(act==='material'){const materials=['wood','stone','metal'];this.material=materials[(materials.indexOf(this.material)+1)%3];}
      this.material=this.material||'wood';this.harvest=false;this.aim=false;this.fire=false;this.audio?.ui();this.updateBuildBar();this.updateHUD();return;
    }
    if(this.editing){
      if(act==='build-edit-preset'){this.editMask=['floor','roof'].includes(this.editTargetType)?R.compress(Number(id)):Number(id);this.paintEdit();sound(this,'cell');return;}
      if(act==='edit-preset'||act==='edit-repair'){this.editMask=['floor','roof'].includes(this.editTargetType)?15:511;this.paintEdit();sound(this,'reset');return;}
      if(act==='edit-cell'){const i=Number(id);if(this.editTargetType==='ramp'){const column=73<<(i%3);this.editMask^=column;}else this.editMask^=1<<i;this.paintEdit();return;}
      if(act==='edit-confirm'||act==='edit'){
        const mask=currentMask(this);if(!R.valid(this.editTargetType,mask)){this.toast('Cette forme ne peut pas être validée.');return;}
        const b=this.world.builds.find(q=>q.id===this.editTarget),p=this.player();
        if(!b||b.dead||Math.hypot(b.x-p.x,b.z-p.z)>8.5){this.closeWorldEdit();this.toast('La pièce n’est plus disponible.');return;}
        this.send({editId:b.id,editMask:mask});sound(this,'confirm');this.closeWorldEdit(true);return;
      }
    }
    if(act==='build-turbo'){this._turboDisabled=!this._turboDisabled;this.updateBuildBar();return;}
    if(act==='build-reset'){
      const b=this.nearBuild();if(b){this.send({editId:b.id,editMask:511});sound(this,'reset');}return;
    }
    return action.call(this,act,id,element);
  };
  const buildBar=P.updateBuildBar;
  P.updateBuildBar=function(){
    buildBar.call(this);const bar=document.getElementById('build-bar');if(!bar)return;
    const roof=bar.querySelector('[data-act="build-type"][data-id="roof"] span');if(roof)roof.textContent='Cône';
    if(this.buildType){
      const turbo=document.createElement('button');turbo.className='btn btn-ghost construction-turbo';turbo.dataset.act='build-turbo';turbo.setAttribute('aria-pressed',String(!this._turboDisabled));turbo.textContent=this._turboDisabled?'TURBO OFF':'TURBO ON';bar.appendChild(turbo);
    }
  };
  const fireOnce=P.fireOnce;
  P.fireOnce=function(){
    if(!this.buildType)return fireOnce.call(this);
    if(this.editing||this.modal||this.paused||root.AZEvent?.active)return;
    const p=this.player();if(!p)return;
    const aimed={...p,yaw:this.yaw,pitch:this.pitch},check=this.world.canBuild(aimed,this.buildType,this.material,this.buildRotation||0,this.buildLevel||0);
    this._turboAttempt=this.frameTime||0;
    if(check.ok)return fireOnce.call(this);
    if(!this.fire || check.reason==='materials') {
      const reasons={materials:'Pas assez de matériaux.',support:'Relie la pièce au sol ou à une structure.',blocked:'Emplacement bloqué.',airborne:'Construction indisponible dans cet état.',height:'La pièce est trop éloignée.',limit:'Limite de 600 pièces atteinte.'};
      if((this.frameTime||0)-(this._buildWarningAt||-10)>1){this._buildWarningAt=this.frameTime||0;if(reasons[check.reason])this.toast(reasons[check.reason]);}
    }
  };
  const input=P.input;
  P.input=function(){const packet=input.call(this);if(this.buildType||this.editing)packet.fire=false;return packet;};
  const loop=P.loop;
  P.loop=function(time){
    if(this.screen==='game' && this.buildType && this.fire && !this._turboDisabled && !this.editing && !this.modal && !this.paused && !root.AZEvent?.active && (this.frameTime||0)-(this._turboAttempt||0)>.09)this.fireOnce();
    return loop.call(this,time);
  };
  const hud=P.updateHUD;
  P.updateHUD=function(){
    hud.call(this);
    const status=document.getElementById('build-status');
    if(status && this.buildType && !this.modal && !root.AZEvent?.active){
      const p=this.player(),check=this.world.canBuild({...p,yaw:this.yaw,pitch:this.pitch},this.buildType,this.material,this.buildRotation||0,this.buildLevel||0);
      const reasons={support:'SUPPORT REQUIS',limit:'LIMITE DE PIÈCES',duplicate:'PIÈCE DÉJÀ POSÉE',blocked:'EMPLACEMENT BLOQUÉ',materials:'MATÉRIAUX INSUFFISANTS',height:'HORS DE PORTÉE',airborne:'POSE INDISPONIBLE'};
      status.textContent=check.ok?names[this.buildType].toUpperCase()+' · 10 '+({wood:'BOIS',stone:'PIERRE',metal:'MÉTAL'}[this.material])+' · MAINTENIR POUR CONSTRUIRE':reasons[check.reason]||'POSE IMPOSSIBLE';status.classList.toggle('invalid',!check.ok);
    }
  };
  const help=P.helpHTML;
  P.helpHTML=function(){return help.call(this)+'<section class="construction-help"><h3>CONSTRUCTION & MODIFICATION</h3><p><b>B</b> : construire · <b>1 / 2 / 3 / 4</b> : mur, sol, escalier, cône · <b>maintenir le clic gauche</b> : construction turbo · <b>G</b> : matériau · <b>Y</b> : rotation · <b>F</b> : modifier la pièce visée.</p><p>Glisse sur la grille, puis relâche pour valider. Les sols et cônes utilisent quatre zones ; les murs utilisent neuf zones. Pour les escaliers, sélectionne les voies complètes. <b>Clic droit dans la grille</b> ou <b>Maj + molette</b> sur une pièce : rétablir. Les structures déconnectées s’effondrent hors Créatif.</p><p>Adaptation indépendante inspirée des mécaniques de Fortnite, avec les assets originaux d’AZUR. Aucun contenu officiel d’Epic Games n’est inclus.</p></section>';};
  document.addEventListener('click',e=>{if(e.target.closest('[data-act="edit-cell"]')?. _pointerActionAt && performance.now()-e.target.closest('[data-act="edit-cell"]')._pointerActionAt<400)e.stopImmediatePropagation();},true);
  document.addEventListener('wheel',e=>{
    const game=root.AZUR;if(!game||game.screen!=='game'||game.modal||game.paused||!e.shiftKey||root.AZEvent?.active)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(game.editing){game.editMask=['floor','roof'].includes(game.editTargetType)?15:511;game.action('edit-confirm');}
    else game.action('build-reset');
  },{capture:true,passive:false});
  root.AZConstruction={presets,names,currentMask};
})(window);
