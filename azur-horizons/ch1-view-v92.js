/* AZUR v92 — ch1-view-v92.js : rendu "Chapitre 1" des objets (voir design/azur-gap-list.md O4).
 * Armes : comme dans les vidéos, le corps d'une arme garde sa vraie teinte (acier gris, polymère noir,
 * bois, beige désert pour les fusils épiques et légendaires) ; la rareté se lit à la lueur au sol et
 * aux cases de l'inventaire, plus sur toute la carcasse. Les armes de Midas restent dorées
 * (characters-v67.js les recouvre d'or après coup). */
(function (root) {
  "use strict";
  const T = root.THREE, A = root.AZArt, S = root.AZSim;
  if (!T || !A || typeof A.weapon !== "function" || A.__ch1Weapons) return;
  A.__ch1Weapons = true;

  // teinte de carcasse par arme et par palier de rareté (0 commun … 4 légendaire)
  const BODY = {
    rifle: ["#6c737b", "#6c737b", "#5d666f", "#b59a6a", "#c2a46b"],
    burst: ["#5f676f", "#5f676f", "#56606a", "#58626c", "#4f5963"],
    smg: ["#3e444b", "#3e444b", "#454c54", "#4b525a", "#4b525a"],
    shotgun: ["#3b3f45", "#3b3f45", "#3b3f45", "#3b3f45", "#3b3f45"],
    tactical: ["#4a4f57", "#4a4f57", "#4a4f57", "#4a4f57", "#4a4f57"],
    sniper: ["#4b5a46", "#4b5a46", "#4b5a46", "#5a6152", "#6a6f5a"],
    dmr: ["#565d64", "#565d64", "#565d64", "#565d64", "#565d64"],
    pistol: ["#2f3338", "#2f3338", "#2f3338", "#3a3f46", "#3a3f46"],
    revolver: ["#8a8f96", "#8a8f96", "#8a8f96", "#8a8f96", "#8a8f96"],
    launcher: ["#55603f", "#55603f", "#55603f", "#55603f", "#55603f"],
  };
  const RAR = (S && S.rarities ? S.rarities : []).map((r) => (r.color || "").toLowerCase());
  function tierOf(colour) {
    const i = RAR.indexOf(String(colour || "").toLowerCase());
    return i < 0 ? -1 : i;
  }

  const base = A.weapon;
  A.weapon = function (key, colour, wrap) {
    const tier = tierOf(colour);
    const table = BODY[key];
    if (tier >= 0 && table) {
      const g = base.call(this, key, table[tier] || table[0], wrap);
      if (g && g.userData) g.userData.ch1Rarity = tier;
      return g;
    }
    return base.apply(this, arguments);
  };
  if (root.AZView) root.AZView.weapon = A.weapon;
})(typeof globalThis !== "undefined" ? globalThis : this);
