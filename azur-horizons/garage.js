/* AZUR 0.5 — local garage UI. Crafting is always accepted/rejected by AZSim. */
(function (root) {
  'use strict';
  const S = root.AZSim;
  const paints = [ ['#36bdd7','Azur'], ['#f16f59','Corail'], ['#f9cf59','Soleil'], ['#eee9db','Nacre'], ['#30384b','Onyx'], ['#8d83e5','Iris'] ];
  const entries = [
    { type:'sport', title:'ÉCLIPSE GT', category:'COUPÉ SPORT', text:'Bas, rapide, taillé pour les avenues.', shape:'M28 91 38 72 99 61 127 32 190 32 230 61 268 71 281 91 275 110 27 110Z', glass:'M112 62 135 39 185 39 214 62Z' },
    { type:'car', title:'ALIZÉ S', category:'BERLINE', text:'Une conduite souple pour explorer les quartiers.', shape:'M25 87 39 69 94 64 121 29 200 29 233 65 272 73 283 110 25 110Z', glass:'M107 64 127 37 193 37 217 64Z' },
    { type:'buggy', title:'NOMADE X', category:'TOUT-TERRAIN', text:'Léger, vif et prêt pour les chemins.', shape:'M33 72 90 69 108 35 192 35 217 68 266 73 274 109 31 109Z', glass:'M106 64 117 42 184 42 201 64Z' }
  ];
  const reason = (r) => ({materials:'Il te faut 80 métal. Récolte-en à la pioche.',grounded:'Pose-toi au sol et sors du véhicule pour fabriquer.',water:'Choisis un emplacement sur la terre ferme.',blocked:'Pas assez de place devant toi. Éloigne-toi des murs et des voitures.',limit:'20 véhicules maximum sur cette partie.',cooldown:'Patiente un instant avant de fabriquer à nouveau.',type:'Modèle indisponible.'}[r] || 'Choisis une zone dégagée.');
  function illustration(e, color) {
    return `<svg class="garage-car-art" viewBox="0 0 310 150" role="img" aria-label="${e.category}"><ellipse cx="155" cy="120" rx="129" ry="12" fill="#020a1680"/><path d="${e.shape}" fill="${color}" stroke="#ffffff45" stroke-width="2"/><path d="${e.glass}" fill="#153747" stroke="#b5e7ec" stroke-width="2"/><path d="M151 39V63M43 78H73M237 78H263" fill="none" stroke="#e7fbff" stroke-width="5"/><path d="M88 74H225M122 81H140" stroke="#ffffff80" stroke-width="2"/><path d="M25 100H285" stroke="#112b35" stroke-width="7"/><g fill="#111b25" stroke="#4b6474" stroke-width="3"><circle cx="80" cy="108" r="23"/><circle cx="234" cy="108" r="23"/></g><g fill="#bad0d9" stroke="#526978" stroke-width="3"><circle cx="80" cy="108" r="12"/><circle cx="234" cy="108" r="12"/></g><g fill="#243e4c"><circle cx="80" cy="108" r="4"/><circle cx="234" cy="108" r="4"/></g></svg>`;
  }
  root.AZGarage = {
    reason,
    open(game) {
      if (game.screen !== 'game') return;
      game.modal = 'garage'; game.paused = !game.socket;
      game.fire = game.aim = false; game.keys = {}; game.move = { x:0,z:0 }; game.lift = 0;
      game.send({fire:false,moveX:0,moveZ:0,moveY:0});
      if (document.pointerLockElement) document.exitPointerLock();
      this.render(game);
    },
    render(game) {
      const p = game.player(), color = game.vehiclePaint || paints[0][0], creative = game.world.mode === 'creative';
      game.overlay.innerHTML = `<div class="modal-shade"><section class="dialog garage-dialog" role="dialog" aria-modal="true" aria-labelledby="garage-title"><header class="dialog-head"><div><span class="eyebrow">AZUR MOTOR CLUB · 0.5</span><h2 id="garage-title">Ton prochain départ.</h2></div><button class="btn btn-ghost" data-act="resume" aria-label="Fermer le garage">FERMER ×</button></header><p class="garage-intro">Fabrique ta voiture à 7 mètres devant toi, puis approche-toi et appuie sur <kbd>E</kbd> / INTERAGIR pour monter.</p><div class="garage-paints"><span>CARROSSERIE</span>${paints.map(([c,n])=>`<button class="paint-swatch ${c===color?'selected':''}" data-act="garage-paint" data-id="${c}" style="--paint:${c}" aria-label="Peinture ${n}" aria-pressed="${c===color}">${c===color?'✓':''}</button>`).join('')}<strong>${creative?'FABRICATION GRATUITE':`${Math.floor(p.mats.metal)} MÉTAL DISPONIBLE`}</strong></div><div class="garage-grid">${entries.map((e,i)=>{
        const check = game.world.canCraftVehicle(p,e.type), speed = Math.round(S.vehicleSpecs[e.type].maxSpeed*3.6);
        return `<article class="garage-card"><div class="garage-car-top"><span>0${i+1} / ${e.category}</span><span class="garage-speed">${speed}<small> km/h max</small></span></div>${illustration(e,color)}<div class="garage-car-copy"><h3>${e.title}</h3><p>${e.text}</p><button class="btn btn-primary garage-craft" data-act="garage-craft" data-id="${e.type}" ${check.ok?'':'disabled'}>FABRIQUER <span>${creative?'GRATUIT':'80 ▰'}</span></button><small class="garage-valid ${check.ok?'ok':''}">${check.ok?'✓ Espace libre devant toi':reason(check.reason)}</small></div></article>`;
      }).join('')}</div><footer class="garage-footer"><span><kbd>ZQSD</kbd> / <kbd>WASD</kbd> Accélérer, freiner / reculer, tourner</span><span><kbd>E</kbd> Sortir · Joystick sur mobile</span></footer><p class="garage-disclaimer">Véhicules de cette partie uniquement. La fabrication n’utilise ni écus ni argent réel.</p></section></div>`;
    },
    paint(game, value) {
      if (!paints.some(([c])=>c===value) || game.modal !== 'garage') return;
      game.vehiclePaint=value; this.render(game);
    },
    craft(game, type) {
      if (game.modal !== 'garage' || !entries.some(e=>e.type===type)) return;
      const check = game.world.canCraftVehicle(game.player(),type);
      if (!check.ok) { game.toast(reason(check.reason)); this.render(game); return; }
      game.closeModal(); game.buildType=null; game.buildLevel=0; game.updateBuildBar();
      // v21 wiring : confirmation sonore du craft réussi (API audio existante).
      game.audio?.ui();
      game.send({craftVehicle:type,paint:game.vehiclePaint||paints[0][0],yaw:game.yaw});
    }
  };
})(window);
