/* AZUR v67 — animations propres aux personnages et or de Midas.
 * Faille : écharpe qui flotte, éclats en orbite, lignes de lumière qui respirent.
 * Midas : son arme, sa pioche et toute arme qu'il pose au sol sont en or
 * (drapeau « gold » porté par l'objet dans la simulation). */
(function (root) {
  'use strict';
  const V = root.AZView?.View?.prototype, A = root.AZArt;
  if (!V?.animateAvatar || !V.update || !A?.goldMaterial) return;

  function gild(obj) {
    const gold = A.goldMaterial();
    obj.traverse(o => {
      if (!o.isMesh || o.userData.goldOrig || Array.isArray(o.material)) return;
      const m = o.material;
      if (!m || m.transparent || !m.vertexColors || m.side === root.THREE.BackSide) return;
      o.userData.goldOrig = m; o.material = gold;
    });
    obj.userData.gilded = true;
  }
  function ungild(obj) {
    obj.traverse(o => { if (o.isMesh && o.userData.goldOrig) { o.material = o.userData.goldOrig; delete o.userData.goldOrig; } });
    obj.userData.gilded = false;
  }
  const isMidas = (p) => p?.equipment?.character === 'char-midas';

  function animateRift(fx, u, player, t) {
    const walk = Math.min(1.7, Number(u.walk) || 0), air = player.gliding || player.falling || player.flying ? 1 : 0;
    const drag = .3 + walk * .45 + air * 1.0;
    fx.scarf.forEach((seg, i) => {
      const wave = Math.sin(t * (5 + walk * 3) - i * .9) * (.08 + walk * .07 + air * .12);
      seg.rotation.x = -(i ? .12 * drag : .35 + drag * .55) + wave;
      seg.rotation.z = Math.sin(t * 2.3 - i * .7) * .05 * (1 + air);
    });
    fx.shards.children.forEach((sh, i) => {
      const a = t * (1.1 + i * .25) + i * 2.094;
      sh.position.set(Math.cos(a) * .34, Math.sin(t * 2 + i) * .09 + i * .03, Math.sin(a) * .16);
      sh.rotation.set(t * 1.7 + i, t * 2.3, 0);
    });
    if (!fx.baseColor) fx.baseColor = fx.glow.color.clone();
    fx.glow.color.copy(fx.baseColor).multiplyScalar(.78 + .22 * Math.sin(t * 2.4));
  }
  const previousAnimate = V.animateAvatar;
  V.animateAvatar = function (model, player, dt, options) {
    previousAnimate.call(this, model, player, dt, options);
    const u = model?.userData;
    if (!u || !player) return;
    const t = this.time || 0;
    if (u.riftFx) animateRift(u.riftFx, u, player, t);
    // Clignement des yeux toutes les 2 à 5 secondes (double clignement parfois).
    if (u.lids) {
      if (u.blinkAt == null) u.blinkAt = t + 1 + Math.random() * 3;
      const since = t - u.blinkAt;
      u.lids.visible = (since >= 0 && since < .11) || (u.blinkDouble && since >= .22 && since < .32);
      if (since > .4) { u.blinkAt = t + 2 + Math.random() * 3; u.blinkDouble = Math.random() < .2; }
    }
    const item = player.inventory?.[player.selected];
    // L'arme tenue prend la couleur de rareté de l'objet.
    if (u.gun && item?.kind === 'weapon') {
      const wrapId = player.equipment?.wrap || '', want = item.weapon + '|' + (item.rarity | 0) + '|' + wrapId;
      if (u.gun.userData.v67Key !== want) {
        const old = u.gun, colour = root.AZSim?.rarities?.[item.rarity | 0]?.color || '#aab8c8';
        const gun = A.weapon(item.weapon, colour, wrapId);
        gun.position.copy(old.position); gun.rotation.copy(old.rotation); gun.visible = old.visible;
        gun.userData.v67Key = want;
        model.remove(old); this.disposeTree?.(old); model.add(gun);
        u.gun = gun; u.gunKey = item.weapon; u.gunWrap = wrapId;
      }
    }
    const goldGun = isMidas(player) || !!(item && item.gold);
    if (u.gun && !!u.gun.userData.gilded !== goldGun) (goldGun ? gild : ungild)(u.gun);
    if (u.tool && !!u.tool.userData.gilded !== isMidas(player)) (isMidas(player) ? gild : ungild)(u.tool);
  };

  const previousUpdate = V.update;
  V.update = function (w, p, dt, opts) {
    const out = previousUpdate.apply(this, arguments);
    A.goldClock.value = this.time || 0;
    if (w?.loot && this.loot?.size) {
      for (const l of w.loot) {
        if (!l.gold) continue;
        const m = this.loot.get(l.id);
        if (!m || m.userData.goldDone) continue;
        if (m.children[0]) gild(m.children[0]);
        const ring = m.children[1];
        if (ring?.material?.color) ring.material.color.set('#ffd34d');
        m.userData.goldDone = true;
      }
    }
    return out;
  };
})(window);
