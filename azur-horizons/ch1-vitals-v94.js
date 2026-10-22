/* AZUR v94 — ch1-vitals-v94.js : barres de vie et de bouclier comme dans la vidéo du Chapitre 1.
 * Deux barres fines et plates sous le chargeur : bouclier en haut (fond sombre, remplissage bleu),
 * vie en dessous (vert vif), icône blanche à gauche, chiffres « actuel | max » dans la barre.
 * Une traînée blanche montre les dégâts qui viennent d'être pris. Remplace l'affichage de hud-v67
 * (masqué en CSS) ; le viseur et les effets de dégâts de hud-v67 restent actifs. */
(function (root) {
  "use strict";
  if (root.__ch1Vitals94) return;
  root.__ch1Vitals94 = true;
  const ICON_SHIELD = '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>';
  const ICON_HP = '<svg viewBox="0 0 24 24"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z"/></svg>';
  let box = null, bars = null;
  function bar(kind, icon) {
    const el = document.createElement("div");
    el.className = "ch1v-row " + kind;
    el.innerHTML = '<i class="ch1v-ico">' + icon + '</i><div class="ch1v-bar"><div class="ch1v-trail"></div><div class="ch1v-fill"></div><div class="ch1v-txt"><b>0</b><s></s><em>100</em></div></div>';
    return { el, fill: el.querySelector(".ch1v-fill"), trail: el.querySelector(".ch1v-trail"), cur: el.querySelector("b"), max: el.querySelector("em"), v: -1, m: -1, tt: 0 };
  }
  function build(hud) {
    box = document.createElement("div");
    box.className = "ch1-vitals";
    box.setAttribute("aria-hidden", "true");
    bars = { sh: bar("sh", ICON_SHIELD), hp: bar("hp", ICON_HP) };
    box.append(bars.sh.el, bars.hp.el);
    hud.appendChild(box);
  }
  function set(b, value, max) {
    const m = Math.max(1, Math.round(max || 100)), v = Math.max(0, Math.min(m, Math.round(value || 0)));
    if (m !== b.m) { b.m = m; b.max.textContent = m; }
    if (v === b.v) return;
    const pct = (v / m) * 100;
    if (b.v >= 0 && v < b.v) {
      // traînée blanche : reste à l'ancienne valeur puis rejoint la nouvelle
      b.trail.style.transition = "none"; b.trail.style.width = (b.v / m) * 100 + "%";
      void b.trail.offsetWidth;
      b.trail.style.transition = "width .45s ease-in .25s"; b.trail.style.width = pct + "%";
    } else { b.trail.style.transition = "none"; b.trail.style.width = pct + "%"; }
    b.fill.style.width = pct + "%";
    b.cur.textContent = v;
    b.el.classList.toggle("empty", v === 0);
    b.v = v;
  }
  function tick() {
    requestAnimationFrame(tick);
    if (document.body.dataset.screen !== "game") return;
    const hud = document.querySelector("#ui .hud");
    if (!hud) return;
    if (!box || !hud.contains(box)) build(hud);
    const g = root.AZUR, p = g && g.player && g.player();
    if (!p) return;
    set(bars.hp, p.hp, p.maxHp || 100);
    set(bars.sh, p.shield, p.maxShield || 100);
    box.classList.toggle("down", !!p.downed);
  }
  requestAnimationFrame(tick);
})(window);
