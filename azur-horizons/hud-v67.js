/* AZUR v67 — vie et bouclier.
 * Remplace l'ancien bloc par deux barres inclinées façon Fortnite : traînée de
 * dégâts, éclat de soin, chiffres qui s'envolent, bouclier qui se brise,
 * battement rouge quand la vie est basse. Lit directement le joueur local. */
(function (root) {
  'use strict';
  const ICON_SHIELD = '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>';
  const ICON_HP = '<svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>';
  let box = null, rows = null, last = { hp: -1, sh: -1 }, lowOn = false;

  function row(kind, icon) {
    const r = document.createElement('div');
    r.className = 'v67-row ' + kind;
    r.innerHTML = '<i class="v67-ico">' + icon + '</i><div class="v67-bar"><div class="v67-trail"></div><div class="v67-gain"></div><div class="v67-fill"></div><div class="v67-ticks"></div></div><div class="v67-num"><b>0</b><small>/100</small></div>';
    return { el: r, fill: r.querySelector('.v67-fill'), trail: r.querySelector('.v67-trail'), gain: r.querySelector('.v67-gain'), num: r.querySelector('b') };
  }
  function build(hud) {
    box = document.createElement('div');
    box.className = 'v67-vitals'; box.setAttribute('aria-hidden', 'true');
    rows = { sh: row('v67-shield', ICON_SHIELD), hp: row('v67-hp', ICON_HP) };
    box.append(rows.sh.el, rows.hp.el);
    hud.appendChild(box);
    last = { hp: -1, sh: -1 };
  }
  function chip(r, cls, text, pct) {
    const c = document.createElement('span');
    c.className = 'v67-chip ' + cls; c.textContent = text;
    c.style.left = 'calc(38px + ' + Math.max(0, Math.min(80, pct)).toFixed(0) + '% * .72)';
    r.el.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function set(key, value) {
    const r = rows[key], before = last[key], v = Math.max(0, Math.min(100, Math.round(value)));
    if (v === before) return 0;
    r.fill.style.width = v + '%';
    r.num.textContent = v;
    if (key === 'sh') r.el.classList.toggle('empty', v === 0);
    if (before < 0) { r.trail.style.transition = 'none'; r.trail.style.width = v + '%'; last[key] = v; return 0; }
    const delta = v - before;
    if (delta < 0) {
      r.trail.style.transition = ''; r.trail.style.width = before + '%';
      requestAnimationFrame(() => { r.trail.style.width = v + '%'; });
      chip(r, key === 'hp' ? 'hp' : 'sh', String(delta), before);
      if (key === 'sh' && v === 0 && before > 0) { chip(r, 'break', 'BOUCLIER BRISÉ', 30); restart(r.el, 'shatter'); }
    } else {
      r.trail.style.transition = 'none'; r.trail.style.width = v + '%';
      r.gain.style.left = before + '%'; r.gain.style.width = delta + '%'; restart(r.gain, 'on');
      if (delta >= 2) chip(r, key === 'hp' ? 'heal' : 'shup', '+' + delta, v);
    }
    restart(r.el, 'bump');
    last[key] = v;
    return delta;
  }
  function tick() {
    requestAnimationFrame(tick);
    const body = document.body;
    if (body.dataset.screen !== 'game') { if (lowOn) { body.classList.remove('v67-lowpulse'); lowOn = false; } return; }
    const hud = document.querySelector('#ui .hud');
    if (!hud) return;
    if (!box || !hud.contains(box)) build(hud);
    const game = root.AZUR, p = game && game.player && game.player();
    if (!p) return;
    const dh = set('hp', p.hp || 0), ds = set('sh', p.shield || 0), hurt = -Math.min(0, dh) - Math.min(0, ds);
    // Viseur : écartement selon le recul, la vitesse et le saut ; resserré en visée.
    const ch = document.getElementById('crosshair');
    if (ch) {
      const av = game.view?.actors?.get(p.id)?.userData, item = p.inventory?.[p.selected];
      const recoil = Math.min(1, +(av?.recoil) || 0), speed = Math.min(1, (+(av?.v67?.speed) || 0) / 7);
      let gap = 3 + recoil * 16 + speed * 7 + (p.jumping || p.falling ? 9 : 0);
      if (p.aim) gap *= .45;
      if (p.crouching) gap *= .75;
      if (Math.abs(gap - (ch._v67gap || 0)) > .3) { ch._v67gap = gap; ch.style.setProperty('--v67-gap', gap.toFixed(1) + 'px'); }
      ch.classList.toggle('v67-tool', !!(av?.tool?.visible) && item?.kind !== 'weapon');
    }
    const low = !p.downed && p.hp > 0 && p.hp <= 30;
    box.classList.toggle('low', low);
    box.classList.toggle('down', !!p.downed);
    if (low !== lowOn) { body.classList.toggle('v67-lowpulse', low); lowOn = low; }
    if (hurt > 0) {
      restart(box, 'hit');
      if (hurt >= 8) { restart(body, 'v67-damage'); clearTimeout(tick.flash); tick.flash = setTimeout(() => body.classList.remove('v67-damage'), 520); }
    }
  }
  requestAnimationFrame(tick);
})(window);
