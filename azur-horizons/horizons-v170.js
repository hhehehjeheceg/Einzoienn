/* Horizons 1.7 — modification directe, commandes complètes et finition multi-supports. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons, A = root.AZArt, V = root.AZView?.View, T = root.THREE;
  if (!H) return;
  const P = H.prototype;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pressed = (b) => !!b && (b.pressed || b.value > .45);
  const padNow = () => typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads()).find(Boolean) : null;
  const family = (pad) => {
    const id = String(pad?.id || "").toLowerCase();
    if (/dualsense|dualshock|playstation|054c/.test(id)) return { name: "PLAYSTATION", fire: "R2", aim: "L2", jump: "✕", build: "○", edit: "↑" };
    if (/nintendo|switch|joy-con|057e/.test(id)) return { name: "NINTENDO", fire: "ZR", aim: "ZL", jump: "B", build: "A", edit: "↑" };
    return { name: /xbox|xinput|045e/.test(id) ? "XBOX" : "MANETTE", fire: "RT", aim: "LT", jump: "A", build: "B", edit: "↑" };
  };
  const settings = (game) => Object.assign(game.profile.settings, {
    controllerSensitivity: Number.isFinite(+game.profile.settings.controllerSensitivity) ? clamp(+game.profile.settings.controllerSensitivity, .55, 2) : 1,
    controllerDeadzone: Number.isFinite(+game.profile.settings.controllerDeadzone) ? clamp(+game.profile.settings.controllerDeadzone, .05, .35) : .14,
    editHoldTime: Number.isFinite(+game.profile.settings.editHoldTime) ? clamp(+game.profile.settings.editHoldTime, .12, .55) : .28,
    confirmEditRelease: game.profile.settings.confirmEditRelease !== false,
    simpleEdit: game.profile.settings.simpleEdit === true,
  });
  const dead = (v, zone) => Math.abs(v || 0) < zone ? 0 : Math.sign(v) * (Math.abs(v) - zone) / (1 - zone);
  const roofExpand = (m) => ((m & 1) ? 27 : 0) | ((m & 2) ? 36 : 0) | ((m & 4) ? 192 : 0) | ((m & 8) ? 256 : 0);
  const roofCompress = (m) => ((m & 27) ? 1 : 0) | ((m & 36) ? 2 : 0) | ((m & 192) ? 4 : 0) | ((m & 256) ? 8 : 0);
  const worldMask = (game) => game.editTargetType === "roof" ? roofExpand(game.editMask) : game.editMask;
  const pulse = (strong = .1, weak = .2, duration = 50) => {
    const actuator = padNow()?.vibrationActuator;
    actuator?.playEffect?.("dual-rumble", { duration, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    if (!actuator && navigator.vibrate) navigator.vibrate(Math.min(duration, 25));
  };
  const sfx = (game, kind) => {
    const a = game.audio; if (!a) return; a.start();
    if (kind === "enter") { a.tone(420,.08,"triangle",.09,650); a.noise(.06,.05,2100); }
    if (kind === "cell") { a.tone(780,.045,"square",.07,980); }
    if (kind === "reset") { a.tone(260,.11,"triangle",.09,520); a.tone(520,.08,"sine",.06,740); }
    if (kind === "confirm") { a.tone(520,.09,"triangle",.12,820); setTimeout(()=>a.tone(820,.12,"sine",.08,1040),55); }
  };

  const previousSettingsHTML = P.settingsHTML;
  P.settingsHTML = function () {
    settings(this);
    const html = previousSettingsHTML.call(this);
    const section = `<section class="settings-section v17-controller-settings"><h3>MANETTE & MODIFICATION</h3>
      <label class="form-row"><span>Sensibilité caméra manette</span><input type="range" data-setting="controllerSensitivity" min="0.55" max="2" step="0.05" value="${this.profile.settings.controllerSensitivity}"><output>${Math.round(this.profile.settings.controllerSensitivity*100)} %</output></label>
      <label class="form-row"><span>Zone morte des sticks</span><input type="range" data-setting="controllerDeadzone" min="0.05" max="0.35" step="0.01" value="${this.profile.settings.controllerDeadzone}"><output>${Math.round(this.profile.settings.controllerDeadzone*100)} %</output></label>
      <label class="form-row"><span>Durée d’appui pour modifier</span><input type="range" data-setting="editHoldTime" min="0.12" max="0.55" step="0.01" value="${this.profile.settings.editHoldTime}"><output>${Math.round(this.profile.settings.editHoldTime*100)} %</output></label>
      <label class="check-row"><input class="checkbox" type="checkbox" data-setting="confirmEditRelease" ${this.profile.settings.confirmEditRelease ? "checked" : ""}><span>Valider la modification au relâchement</span></label>
      <label class="check-row"><input class="checkbox" type="checkbox" data-setting="simpleEdit" ${this.profile.settings.simpleEdit ? "checked" : ""}><span>Modification simple — faire défiler les formes</span></label>
      <p class="setting-note">Maintiens B / ○ / A (Nintendo) pour modifier, ou utilise ↑. En grille : RT/R2/ZR sélectionne, X/□ rétablit, Y/△ valide.</p></section>`;
    return html.replace(/<\/div>$/, section + "</div>");
  };

  const previousHelpHTML = P.helpHTML;
  P.helpHTML = function () {
    const info = padNow() ? family(padNow()) : family(null);
    return previousHelpHTML.call(this).replace(/<article class="controller-help">[\s\S]*?<\/article>/,
      `<article class="controller-help"><h3>MANETTE · ${info.name}</h3><p><b>Stick gauche</b> bouger · <b>stick droit</b> caméra · <b>${info.fire}</b> action · <b>${info.aim}</b> viser · <b>${info.jump}</b> sauter · <b>${info.build}</b> construire / maintenir pour modifier · <b>${info.edit}</b> modifier directement · <b>LB / RB</b> changer d’objet · <b>Menu</b> pause.</p><p>Dans la grille : <b>${info.fire}</b> sélectionner · <b>X / □</b> rétablir · <b>Y / △</b> valider · <b>B / ○</b> annuler.</p></article>`);
  };

  P.nearBuild = function (wallOnly = false) {
    const p = this.player?.(); if (!p) return null;
    const teamById = new Map((this.world?.players || []).map(q => [q.id, q.team]));
    const all = (this.world?.builds || []).filter((b) =>
      (b.owner === p.id || teamById.get(b.owner) === p.team) && !b.dead && (!wallOnly || b.type === "wall") &&
      Math.hypot(b.x-p.x,b.z-p.z) < 8 && Math.abs(b.y-p.y) < 6);
    const yaw=this.yaw||0,pitch=this.pitch||0,f={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
    const score=(b)=>{const dx=b.x-p.x,dy=b.y+(b.type==="wall"?1.5:b.type==="ramp"?2:0)-p.y-1.4,dz=b.z-p.z,along=dx*f.x+dy*f.y+dz*f.z;return Math.hypot(dx-f.x*along,dy-f.y*along,dz-f.z*along)*3+Math.max(0,along)*.15+(along<-.5?40:0);};
    return all.sort((a,b)=>score(a)-score(b))[0] || null;
  };

  P.v17EditPreview = function () {
    if (!this.view || !A || !this.editTarget) return;
    if (this.view.v17EditPreview) { this.view.worldRoot.remove(this.view.v17EditPreview); this.view.disposeTree(this.view.v17EditPreview); }
    const b = this.world?.builds.find(q => q.id === this.editTarget); if (!b) return;
    const preview = A.buildModel(Object.assign({}, b, { editMask: worldMask(this) }), true);
    preview.renderOrder = 7; preview.traverse(n => { if (n.material) { n.material.depthTest = false; n.material.opacity = .48; } });
    this.view.v17EditPreview = preview; this.view.v17EditFocus = b.id; this.view.worldRoot.add(preview);
  };
  P.v17ClearPreview = function () {
    const v=this.view;if(!v)return;
    if(v.v17EditPreview){v.worldRoot.remove(v.v17EditPreview);v.disposeTree(v.v17EditPreview);v.v17EditPreview=null;}
    const original=v.builds?.get(v.v17EditFocus);if(original)original.visible=true;v.v17EditFocus=null;
  };
  if (V?.prototype?.update) {
    const previousViewUpdate = V.prototype.update;
    V.prototype.update = function () {
      const result=previousViewUpdate.apply(this,arguments);
      if(this.v17EditFocus){const original=this.builds?.get(this.v17EditFocus);if(original)original.visible=false;if(this.v17EditPreview)this.v17EditPreview.visible=true;}
      return result;
    };
  }

  P.openEdit = function () {
    if (this.screen !== "game" || this.modal || this.editing) return;
    settings(this);
    const b=this.nearBuild(false);
    if(!b){this.toast("Vise une construction de ton équipe pour la modifier.");return;}
    if(this.profile.settings.simpleEdit){this.v17SimpleEdit(b);return;}
    this.editTarget=b.id;this.editTargetType=b.type;this.editOriginalMask=b.editMask==null?511:b.editMask;
    this.editMask=b.type==="roof"?roofCompress(this.editOriginalMask):this.editOriginalMask;
    this.editing=true;this.fire=false;this.buildType=null;this.keys={};this.keyCodes={};this.move={x:0,z:0};
    const me=this.player?.();if(me)me.editing=true;
    this.send({fire:false,moveX:0,moveZ:0,moveY:0});document.body.classList.add("world-editing");
    if(document.pointerLockElement)document.exitPointerLock();
    const count=b.type==="roof"?4:9,cols=b.type==="roof"?2:3,label={wall:"MUR",floor:"SOL",ramp:"RAMPE DIRECTIONNELLE",roof:"TOIT · 4 COINS"}[b.type];
    const owner=b.owner===this.myId?"TA PIÈCE":"PIÈCE ALLIÉE";
    const panel=document.getElementById("world-edit");if(!panel)return;
    panel.hidden=false;panel.dataset.type=b.type;panel.style.setProperty("--edit-cols",cols);
    panel.innerHTML=`<div class="world-edit-head"><b>${label}</b><span>${owner}</span><span id="edit-cell-count"></span><span>${Math.ceil(b.hp)}♥</span></div><div id="edit-grid" class="world-edit-grid" role="grid" aria-label="Grille de modification ${cols} par ${cols}">${Array.from({length:count},(_,i)=>`<button data-act="edit-cell" data-id="${i}" role="gridcell" aria-label="Case ${Math.floor(i/cols)+1}, ${(i%cols)+1}"></button>`).join("")}</div><div class="world-edit-actions"><button class="btn btn-ghost" data-act="edit-preset" data-id="full">RÉTABLIR <kbd>X / □</kbd></button><button class="btn btn-primary" data-act="edit-confirm">VALIDER <kbd>Y / △</kbd></button><button class="btn btn-ghost" data-act="edit-cancel">ANNULER</button></div><div class="world-edit-tip">MAINTIENS ET GLISSE · RT/R2/ZR SÉLECTIONNE</div>`;
    let painting=false,paintSolid=false,pointerId=null;
    const apply=(cell)=>{if(!cell||cell.dataset.v17Paint===String(paintSolid))return;const bit=1<<Number(cell.dataset.id),next=paintSolid?(this.editMask|bit):(this.editMask&~bit);if(!next){this.toast("Garde au moins une zone — utilise DÉMOLIR pour retirer la pièce.");return;}this.editMask=next;cell.dataset.v17Paint=String(paintSolid);this.paintEdit();sfx(this,"cell");pulse(.05,.12,30);};
    panel.addEventListener("pointerdown",e=>{const cell=e.target.closest('[data-act="edit-cell"]');if(!cell)return;e.preventDefault();pointerId=e.pointerId;painting=true;paintSolid=!(this.editMask&(1<<Number(cell.dataset.id)));cell.setPointerCapture?.(e.pointerId);apply(cell);cell._pointerActionAt=performance.now();});
    panel.addEventListener("pointermove",e=>{if(!painting||e.pointerId!==pointerId)return;const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-act="edit-cell"]');apply(cell);});
    const release=(e)=>{if(!painting||e.pointerId!==pointerId)return;painting=false;pointerId=null;panel.querySelectorAll('[data-v17-paint]').forEach(n=>delete n.dataset.v17Paint);if(settings(this).confirmEditRelease)this.action("edit-confirm");};
    panel.addEventListener("pointerup",release);panel.addEventListener("pointercancel",release);
    this.paintEdit();this.v17EditPreview();sfx(this,"enter");pulse(.08,.2,55);
  };

  P.paintEdit = function () {
    let solid=0;const cells=[...document.querySelectorAll('[data-act="edit-cell"]')];
    cells.forEach((cell)=>{const on=!!(this.editMask&(1<<Number(cell.dataset.id)));if(on)solid++;cell.classList.toggle("solid",on);cell.setAttribute("aria-pressed",String(on));cell.innerHTML=`<span>${on?"":"×"}</span>`;});
    const count=document.getElementById("edit-cell-count");if(count)count.textContent=`${solid} / ${cells.length} ZONES`;
    this.v17EditPreview();
  };

  P.v17SimpleEdit = function (b) {
    const presets={wall:[511,495,367,448,473],floor:[511,504,455,195],ramp:[511,73,292,219],roof:[511,27,36,192,256]};
    const list=presets[b.type]||[511],current=b.editMask==null?511:b.editMask,next=list[(list.indexOf(current)+1+list.length)%list.length];
    this.send({editId:b.id,editMask:next});sfx(this,"confirm");pulse(.1,.25,60);this.toast(`Modification simple · ${next===511?"forme complète":"forme suivante"}.`);
  };

  const previousCloseWorldEdit=P.closeWorldEdit;
  P.closeWorldEdit=function(applied=false){const me=this.player?.();if(me)me.editing=false;this.v17ClearPreview();this.editTargetType=null;return previousCloseWorldEdit.call(this,applied);};

  const previousAction=P.action;
  P.action=async function(act,id,el){
    if(act==="edit"&&this.editing){return this.action("edit-confirm");}
    if(act==="edit"&&!this.editing&&settings(this).simpleEdit){const b=this.nearBuild(false);if(!b){this.toast("Vise une construction de ton équipe pour la modifier.");return;}return this.v17SimpleEdit(b);}
    if(act==="edit-cell"&&this.editing){const bit=1<<Number(id),next=this.editMask^bit;if(!next){this.toast("Garde au moins une zone — utilise DÉMOLIR pour retirer la pièce.");return;}this.editMask=next;this.paintEdit();sfx(this,"cell");return;}
    if(act==="edit-preset"&&this.editing){this.editMask=this.editTargetType==="roof"?15:511;this.paintEdit();sfx(this,"reset");pulse(.08,.2,45);return;}
    if(act==="edit-confirm"&&this.editing){if(this.editTarget)this.send({editId:this.editTarget,editMask:worldMask(this)});sfx(this,"confirm");pulse(.12,.32,75);this.closeWorldEdit(true);return;}
    return previousAction.call(this,act,id,el);
  };

  P.controllerFrame=function(time){
    const pad=padNow();
    if(!pad){this._padState=null;this._padButtons=[];document.body.classList.remove("gamepad-ui");return;}
    document.body.classList.add("gamepad-ui");document.body.dataset.controller=family(pad).name.toLowerCase();
    const prefs=settings(this),buttons=pad.buttons.map(pressed),previous=this._padButtons||[],edge=i=>buttons[i]&&!previous[i],release=i=>!buttons[i]&&previous[i];
    const axes=this.padCalibratedAxes?this.padCalibratedAxes(pad.axes):pad.axes; // v21: correction fine des offsets (calibration client.js)
    const lx=dead(axes[0],prefs.controllerDeadzone),ly=dead(axes[1],prefs.controllerDeadzone),rx=dead(axes[2],prefs.controllerDeadzone),ry=dead(axes[3],prefs.controllerDeadzone);
    this._padState={lx,ly,rx,ry,aim:buttons[6],fire:buttons[7],sprint:buttons[10]};
    const menu=this.screen!=="game"||this.modal;
    if(menu){
      const host=this.overlay?.children.length?this.overlay:this.ui,all=[...host.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled])')].filter(e=>e.offsetParent!==null&&getComputedStyle(e).visibility!=="hidden");
      let active=document.activeElement,index=all.indexOf(active),dir=(buttons[12]||ly<-.65)?-1:(buttons[13]||ly>.65)?1:0,h=(buttons[14]||lx<-.65)?-1:(buttons[15]||lx>.65)?1:0;
      if((dir||h)&&time>(this._padNavAt||0)+170){
        if(h&&active?.matches('select,input[type="range"]')){if(active.matches("select")){active.selectedIndex=(active.selectedIndex+h+active.options.length)%active.options.length;}else{active.value=String(clamp(+active.value+h*(+active.step||1),+active.min,+active.max));}active.dispatchEvent(new Event(active.matches('select')?'change':'input',{bubbles:true}));sfx(this,"cell");}
        else{index=(index+(dir||h)+all.length)%all.length;all[index]?.focus({preventScroll:true});}
        this._padNavAt=time;
      }
      if(edge(0)){active=document.activeElement;if(active?.matches('select')){active.selectedIndex=(active.selectedIndex+1)%active.options.length;active.dispatchEvent(new Event('change',{bubbles:true}));}else(active?.matches('button,input')?active:all[0])?.click();}
      if(edge(1)){const close=this.overlay?.querySelector('[data-act="resume"],[data-act="edit-cancel"],[data-act="confirm-cancel"],[data-act="close-modes"]');if(close)close.click();else if(this.screen==="menu"&&this.tab!=="play")this.action("tab","play");}
      if((edge(4)||edge(5))&&this.screen==="menu"){const tabs=[...this.ui.querySelectorAll('.navlinks [data-act="tab"]')];const current=tabs.findIndex(b=>b.classList.contains('active'));tabs[(current+(edge(5)?1:-1)+tabs.length)%tabs.length]?.click();}
      if(edge(3)&&this.screen==="menu")this.action("tab","settings");
      const status=document.getElementById("gamepad-status"),f=family(pad);if(status)status.textContent=`${f.name} · ${f.fire} ACTION · ${f.edit} MODIFIER`;
      this._padButtons=buttons;return;
    }
    if(this.editing){
      const cells=[...document.querySelectorAll('[data-act="edit-cell"]')],cols=["floor","roof"].includes(this.editTargetType)?2:3;
      this._editPadCell=clamp(this._editPadCell??Math.min(4,cells.length-1),0,cells.length-1);
      let move=0;if(edge(12))move=-cols;if(edge(13))move=cols;if(edge(14))move=-1;if(edge(15))move=1;
      if(move&&time>(this._padNavAt||0)+80){const row=Math.floor(this._editPadCell/cols),col=this._editPadCell%cols;this._editPadCell=move===-1?row*cols+Math.max(0,col-1):move===1?row*cols+Math.min(cols-1,col+1):clamp(this._editPadCell+move,0,cells.length-1);this._padNavAt=time;cells[this._editPadCell]?.focus({preventScroll:true});if(buttons[7])this.action("edit-cell",String(this._editPadCell));}
      if(edge(7)||edge(0))this.action("edit-cell",String(this._editPadCell));
      if(release(7)&&prefs.confirmEditRelease)this.action("edit-confirm");
      if(edge(2))this.action("edit-preset","full");if(edge(3))this.action("edit-confirm");if(edge(1))this.action("edit-cancel");
      this._padButtons=buttons;return;
    }
    if(rx||ry)this.look(rx*8.5*prefs.controllerSensitivity,ry*7.2*prefs.controllerSensitivity);
    this.aim=!!buttons[6];const p=this.player?.(),fishing=!!(p&&(p.fishing||(this.harvest&&this.world?._fishable?.(p))));this.fire=!!buttons[7]&&!fishing;
    if(edge(7)){this.fire=true;this.fireOnce();if(fishing)this.fire=false;}if(edge(0))this.action("jump");
    if(edge(1)){this._v17BuildHeldAt=time;this._v17EditFired=false;}if(buttons[1]&&!this._v17EditFired&&time-(this._v17BuildHeldAt||time)>=prefs.editHoldTime*1000){this._v17EditFired=true;this.action("edit");}if(release(1)){if(!this._v17EditFired)this.action("build-mode");this._v17BuildHeldAt=0;}
    if(edge(2))this.action("reload");if(edge(3))this.action("tool");if(edge(8))this.action("map");if(edge(9))this.action("pause");if(edge(10))this.touchSprint=!this.touchSprint;if(edge(11))this.action("crouch");if(edge(12))this.action("edit");if(edge(13))this.action("interact");if(edge(15))this.action("emote");
    if(edge(14)){if(this.buildType)this.action("material");else this.action("slot",String(((p?.selected||0)+4)%5));}
    if(edge(4)||edge(5)){if(this.buildType){const types=["wall","floor","ramp","roof"],i=types.indexOf(this.buildType);this.action("build-type",types[(i+(edge(5)?1:3))%4]);}else this.action("slot",String(((p?.selected||0)+(edge(5)?1:4))%5));}
    this._padButtons=buttons;
  };

  const previousStartGameUI=P.startGameUI;
  P.startGameUI=function(){previousStartGameUI.call(this);const f=family(padNow());const hint=document.querySelector('.game-hint');if(hint&&padNow())hint.innerHTML=`<kbd>STICKS</kbd> Bouger / viser · <kbd>${f.fire}</kbd> Action · <kbd>${f.edit}</kbd> Modifier`;};

  const previousBind=P.bind;
  P.bind=function(){previousBind.call(this);
    /* The outer shell deliberately hides the iframe accessibility tree.  Keep the
       settings reachable to keyboard/gamepad users by interpreting navigation keys
       on the canvas while the menu is visible. */
    this.canvas?.addEventListener("keydown",e=>{if(this.screen!=="menu"||e.altKey||e.ctrlKey||e.metaKey)return;if(e.code==="F10"){e.preventDefault();this.action("tab","settings");return;}if(e.code==="F1"){e.preventDefault();this.action("tab","help");return;}if((e.code==="Enter"||e.code==="Space")&&this.tab==="play"){e.preventDefault();this.action("ready");}});
  };

  if (V?.prototype?.animateAvatar) {
    const previousAnimate=V.prototype.animateAvatar;
    V.prototype.animateAvatar=function(model,player,dt,options={}){previousAnimate.call(this,model,player,dt,options);const u=model?.userData;if(!u)return;const t=this.time||0,speed=Math.hypot(player.vx||0,player.vz||0);if(player.editing){u.blueprint.visible=true;u.torso.rotation.x-=.10;u.head.rotation.x+=.08;u.limbs[0].rotation.x-=.22;u.limbs[1].rotation.x-=.18;}else if(!player.emote&&!player.gliding){u.torso.rotation.z+=clamp((player.turn||0)*-.05,-.08,.08);u.head.rotation.x+=Math.sin(t*.72)*.012;if(speed<.15){u.limbs[0].rotation.z+=Math.sin(t*1.1)*.018;u.limbs[1].rotation.z-=Math.sin(t*1.1)*.018;}if(u.gun?.visible)u.gun.rotation.z+=Math.sin(t*5.4)*Math.min(.018,speed*.006);}};
  }

  /* v21 — les pas contextuels (biome, alternance des pieds) vivent désormais dans
     audio.js (Audio.prototype.update) : un seul endroit pilote les pas, avec
     nage, vent et tempête en plus. L'ancien doublon v17 est retiré. */

  /* v21 — retour sonore discret sur la navigation au menu à la manette. */
  const previousPadFrame = P.controllerFrame;
  P.controllerFrame = function (time) {
    const wasMenu = this.screen !== "game" || this.modal;
    const before = this._padButtons || [];
    previousPadFrame.call(this, time);
    if (wasMenu && this.audio && !this.audio.disabled) {
      const after = this._padButtons || [];
      for (let i = 0; i < after.length; i++) {
        if (after[i] && !before[i]) { this.audio.uiClick(); break; }
      }
    }
  };
})(window);
