/* AZUR v67 — sac à dos (inventaire) façon Fortnite.
 * Ouverture : Tab (PC), bouton ▦ de la barre d'outils, bouton SAC (mobile).
 * - pioche + 5 emplacements en cartes à la couleur de rareté ;
 * - toucher/cliquer une carte affiche ses caractéristiques ;
 * - ÉQUIPER, JETER, ou glisser une carte sur une autre pour les échanger,
 *   et la glisser hors du sac pour la jeter au sol ;
 * - matériaux et munitions visibles. La partie continue pendant ce temps.
 * Les ordres passent par les actions existantes du jeu (slot, drop, swap). */
(function (root) {
  'use strict';
  const H = root.AZURHorizons, S = root.AZSim;
  if (!H || !S) return;
  const P = H.prototype;
  const RARE = ['Commun', 'Peu commun', 'Rare', 'Épique', 'Légendaire'];
  const st = { sel: 0, sig: '', timer: null, drag: null, game: null };
  const icon = (it) => (root.AZIcons ? root.AZIcons.inventory(it) : '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function name(it) {
    if (!it) return 'Emplacement vide';
    if (it.kind === 'weapon') return S.weapons?.[it.weapon]?.name || it.weapon;
    return it.kind === 'heal' ? 'Trousse de soin' : it.kind === 'shield' ? 'Potion de bouclier' : it.kind;
  }
  function bar(label, value, max, text) {
    const pct = Math.max(4, Math.min(100, value / max * 100));
    return `<div class="v67-stat"><span>${label}</span><i><b style="width:${pct.toFixed(0)}%"></b></i><em>${text}</em></div>`;
  }
  function detail(p, i) {
    const it = p.inventory[i];
    if (!it) return `<div class="v67-inv-empty"><b>Emplacement ${i + 1} vide</b><span>Ramasse une arme ou un objet pour le remplir.</span></div>`;
    const r = it.rarity | 0, w = it.kind === 'weapon' ? S.weapons?.[it.weapon] : null, mult = S.rarities?.[r]?.multiplier || 1;
    let stats = '';
    if (w) {
      const dmg = Math.round(w.damage * mult * (w.pellets || 1));
      stats = bar('Dégâts', dmg, 140, dmg + (w.pellets ? ' (' + w.pellets + ' plombs)' : '')) + bar('Cadence', w.rate, 11, w.rate + ' / s') +
        bar('Portée', w.range, 240, w.range + ' m') + bar('Chargeur', w.clip, 30, (it.ammo ?? w.clip) + ' / ' + w.clip) +
        `<div class="v67-stat v67-stat-line"><span>Réserve</span><em>${it.reserve ?? 0} munitions</em></div>`;
    } else stats = `<p class="v67-inv-desc">${it.kind === 'heal' ? 'Rend des points de vie. Reste immobile pendant l’utilisation.' : 'Recharge le bouclier. Reste immobile pendant l’utilisation.'}</p><div class="v67-stat v67-stat-line"><span>Quantité</span><em>× ${it.count || 1}</em></div>`;
    return `<div class="v67-inv-big r${r}${it.gold ? ' gold' : ''}">${icon(it)}</div>
      <h3>${esc(name(it))}</h3>
      <div class="v67-inv-tags"><span class="v67-rar r${r}">${RARE[r] || ''}</span>${it.gold ? '<span class="v67-rar gold">OR DE MIDAS</span>' : ''}${p.selected === i ? '<span class="v67-rar eq">EN MAIN</span>' : ''}</div>
      <div class="v67-stats">${stats}</div>
      <div class="v67-inv-actions"><button type="button" class="v67-btn" data-inv="equip">${it.kind === 'weapon' ? 'ÉQUIPER' : 'PRENDRE EN MAIN'}</button><button type="button" class="v67-btn danger" data-inv="drop">JETER</button></div>`;
  }
  function signature(p) {
    return JSON.stringify([p.inventory.map((it) => it && [it.kind, it.weapon, it.rarity, it.ammo, it.reserve, it.count, it.gold]), p.selected, p.mats, st.sel]);
  }
  function render(game, force) {
    const p = game.player(); if (!p || game.modal !== 'inventory') return;
    const sig = signature(p); if (!force && sig === st.sig) return; st.sig = sig;
    if (st.sel >= 5) st.sel = 4;
    const mats = p.mats || {}, slots = [];
    for (let i = 0; i < 5; i++) {
      const it = p.inventory[i], r = it ? (it.rarity | 0) : -1;
      const sub = !it ? '' : it.kind === 'weapon' ? (it.ammo ?? '') + ' / ' + (it.reserve ?? '') : '× ' + (it.count || 1);
      slots.push(`<button type="button" class="v67-slot${it ? ' r' + r : ' empty'}${it?.gold ? ' gold' : ''}${st.sel === i ? ' sel' : ''}${p.selected === i && it ? ' eq' : ''}" data-inv="pick" data-i="${i}" aria-label="${esc(name(it))}">
        <kbd>${i + 1}</kbd><span class="v67-slot-ico">${icon(it)}</span><b>${esc(it ? name(it) : 'Vide')}</b><small>${sub}</small></button>`);
    }
    game.overlay.innerHTML = `<div class="modal-shade v67-inv-shade" data-inv="shade"><section class="v67-inv" role="dialog" aria-modal="true" aria-label="Sac à dos">
      <header><h2>SAC À DOS</h2><span class="v67-inv-hint">Glisse une carte sur une autre pour échanger · hors du sac pour la jeter</span><button type="button" class="v67-btn ghost" data-inv="close">FERMER ✕</button></header>
      <div class="v67-inv-body">
        <div class="v67-inv-left">
          <div class="v67-inv-row"><div class="v67-slot tool"><kbd>0</kbd><span class="v67-slot-ico">⛏</span><b>Pioche</b><small>Récolte</small></div>${slots.join('')}</div>
          <div class="v67-inv-mats"><span><i>▥</i> Bois <b>${mats.wood | 0}</b></span><span><i>◆</i> Pierre <b>${mats.stone | 0}</b></span><span><i>▰</i> Métal <b>${mats.metal | 0}</b></span></div>
        </div>
        <aside class="v67-inv-detail">${detail(p, st.sel)}</aside>
      </div></section></div>`;
  }
  function slotAt(x, y) { const el = document.elementFromPoint(x, y)?.closest?.('.v67-slot[data-i]'); return el ? +el.dataset.i : -1; }
  function inPanel(x, y) { return !!document.elementFromPoint(x, y)?.closest?.('.v67-inv'); }

  function bind(game) {
    const ov = game.overlay;
    if (ov.v67Inv) return; ov.v67Inv = true;
    ov.addEventListener('click', (ev) => {
      if (game.modal !== 'inventory') return;
      const t = ev.target.closest('[data-inv]'); if (!t) return;
      const act = t.dataset.inv, p = game.player();
      if (act === 'shade' && t !== ev.target) return;
      ev.preventDefault(); ev.stopPropagation();
      if (act === 'close' || act === 'shade') { game.closeModal(); return; }
      if (act === 'pick') { st.sel = +t.dataset.i; render(game, true); return; }
      if (act === 'equip' && p?.inventory[st.sel]) { game.action('slot', String(st.sel)); setTimeout(() => render(game, true), 90); return; }
      if (act === 'drop' && p?.inventory[st.sel]) { game.action('drop', String(st.sel)); setTimeout(() => render(game, true), 90); }
    }, true);
    // Glisser-déposer à la souris comme au doigt.
    ov.addEventListener('pointerdown', (ev) => {
      if (game.modal !== 'inventory') return;
      const el = ev.target.closest('.v67-slot[data-i]'); if (!el) return;
      const i = +el.dataset.i, p = game.player(); if (!p?.inventory[i]) return;
      st.drag = { i, x: ev.clientX, y: ev.clientY, moved: false, ghost: null, id: ev.pointerId };
    });
    ov.addEventListener('pointermove', (ev) => {
      const d = st.drag; if (!d || ev.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 8) return;
      if (!d.moved) {
        d.moved = true; const src = ov.querySelector(`.v67-slot[data-i="${d.i}"]`);
        d.ghost = src.cloneNode(true); d.ghost.classList.add('v67-ghost-card'); document.body.appendChild(d.ghost); src.classList.add('dragging');
      }
      d.ghost.style.transform = `translate(${ev.clientX - 45}px,${ev.clientY - 55}px) rotate(-4deg)`;
      ov.querySelectorAll('.v67-slot.over').forEach((n) => n.classList.remove('over'));
      const j = slotAt(ev.clientX, ev.clientY); if (j >= 0 && j !== d.i) ov.querySelector(`.v67-slot[data-i="${j}"]`)?.classList.add('over');
      ov.querySelector('.v67-inv')?.classList.toggle('drop-out', !inPanel(ev.clientX, ev.clientY));
      ev.preventDefault();
    });
    const end = (ev) => {
      const d = st.drag; if (!d || ev.pointerId !== d.id) return; st.drag = null;
      if (d.ghost) d.ghost.remove();
      if (!d.moved) return;
      const p = game.player(), j = slotAt(ev.clientX, ev.clientY);
      if (j >= 0 && j !== d.i && p && j < p.inventory.length) { game.send({ swap: [d.i, j] }); st.sel = j; }
      else if (!inPanel(ev.clientX, ev.clientY)) { game.action('drop', String(d.i)); }
      setTimeout(() => render(game, true), 90);
      // Le clic qui suit un glisser ne doit pas sélectionner/fermer.
      const block = (e) => { e.stopPropagation(); e.preventDefault(); }; ov.addEventListener('click', block, { capture: true, once: true }); setTimeout(() => ov.removeEventListener('click', block, true), 60);
    };
    ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
  }

  P.openInventory = function () {
    if (this.screen !== 'game') return;
    const first = this.modal !== 'inventory';
    this.modal = 'inventory'; this.paused = false;
    if (first) { this.send({ fire: false, aim: false, moveX: 0, moveZ: 0 }); this.fire = false; st.sel = this.player()?.selected || 0; st.sig = ''; }
    st.game = this; bind(this); render(this, true);
    clearInterval(st.timer); st.timer = setInterval(() => { if (this.modal !== 'inventory') { clearInterval(st.timer); return; } if (!st.drag) render(this); }, 200);
  };
  // Tab / I / Échap referment le sac.
  document.addEventListener('keydown', (ev) => {
    const g = st.game; if (!g || g.modal !== 'inventory') return;
    if (ev.code === 'Tab' || ev.code === 'Escape' || ev.code === 'KeyI') { ev.preventDefault(); ev.stopImmediatePropagation(); g.closeModal(); }
  }, true);
  // Bouton SAC sur mobile, à gauche de la barre d'objets.
  setInterval(() => {
    const ctr = document.querySelector('#ui .touch-controls'); if (!ctr || ctr.querySelector('.v67-bag')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'touch-btn v67-bag'; b.setAttribute('aria-label', 'Ouvrir le sac à dos');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5a4 4 0 0 1 8 0v2h2a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2zm2 0h4V5a2 2 0 0 0-4 0zm-2 6v2h8v-2z" fill="currentColor"/></svg><span>SAC</span>';
    b.addEventListener('pointerup', (ev) => { ev.preventDefault(); ev.stopPropagation(); const g = root.AZUR; if (g) g.modal === 'inventory' ? g.closeModal() : g.openInventory(); });
    ctr.appendChild(b);
  }, 500);
})(window);
