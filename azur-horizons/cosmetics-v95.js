/* AZUR v95 — cosmetics-v95.js : la grande collection (créations originales, aucun objet du jeu d'origine).
 *  - 100 TENUES : 25 thèmes × 4 coloris (agents, astronautes, pompiers, pirates, chevaliers, squelettes néon,
 *    mascottes…), construites avec les pièces des personnages (corps, hauts, bas, casques, lueurs, accessoires) ;
 *  - 36 ÉMOTES : un clip de la bibliothèque d'animations + des gestes calculés (cibles des mains, tours sur soi,
 *    rebonds, inclinaisons) — applaudir, guitare imaginaire, hélicoptère, nage à sec, bûcheron, révérence… ;
 *  - 20 PLANEURS de 10 formes (parapente, ailes, parapluie, ballons, chauve-souris, navette, fusée, soucoupe,
 *    feuille, cerf-volant), 15 PIOCHES de 12 formes, 16 SACS À DOS visibles sur le dos du personnage ;
 *  - tout est offert (collection Saison X) : rien ne s'achète avec de l'argent réel ;
 *  - la roue des émotes (touche T) affiche les 6 émotes rangées dans le casier.
 * Chargé TÔT (juste après meta.js / models.js) pour que le catalogue soit complet avant la lecture du profil ;
 * ch1-models-v93.js reprend les tenues et les sacs via root.AZ_EXTRA_LOOKS / root.AZ_EXTRA_ACC, la roue des
 * émotes s'installe quand le jeu (client.js) est prêt. */
(function (root) {
  "use strict";
  const T = root.THREE, M = root.AZMeta, A = root.AZArt, S = root.AZSim;
  if (!T || !M || !M.catalog || root.AZCosmetics95) return;
  const API = (root.AZCosmetics95 = { skins: [], backs: {}, gliders: {}, tools: {}, botSkins: [] });
  const LOOKS_X = (root.AZ_EXTRA_LOOKS = root.AZ_EXTRA_LOOKS || {}), ACC_X = (root.AZ_EXTRA_ACC = root.AZ_EXTRA_ACC || {});
  // mêmes teintes que ch1-models-v93.js
  const SKIN = { light: "#f2c6a0", fair: "#e9b48c", tan: "#d39a6c", olive: "#b97d50", brown: "#8d5a3b", dark: "#5e3a26" };
  const HAIR = { black: "#1c1816", brown: "#4a2f1f", chestnut: "#6b3f22", red: "#a6421f", blond: "#e0b25a", grey: "#9a958f", white: "#ece8de" };
  const hsh = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const added = [];
  function item(id, name, type, rarity, price, desc, color, secondary, icon, extra) {
    if (M.catalog.some((c) => c.id === id)) return;
    const x = Object.assign({ id, name, type, rarity, price, description: desc, color, secondary, icon, collection: "Saison X" }, extra || {});
    M.catalog.push(x); added.push(id);
  }

  /* ================================================================= tenues */
  // [nom, rareté, recette(coloris, i) → look, description, [coloris : nom, principal, secondaire, accent]]
  const PALS = {
    givre: ["Givre", "#e8eef4", "#7fb4d8", "#2ee6ff"], braise: ["Braise", "#2a1a1a", "#c0392b", "#ff7a1a"], nuit: ["Nuit", "#1a1d26", "#2c3240", "#7a4dff"], emeraude: ["Émeraude", "#1f6b4a", "#0f3a28", "#5dffb0"],
    or: ["Or", "#d9b23a", "#6b4a12", "#fff1b0"], corail: ["Corail", "#ff7a6b", "#7a2a24", "#fff1e6"], lagon: ["Lagon", "#1fa3b5", "#0b4a55", "#b8fff4"], prune: ["Prune", "#6a2a6e", "#2a0f2e", "#ff7ad9"],
    sable: ["Sable", "#c9a877", "#6b5236", "#fff0c8"], acier: ["Acier", "#8b97a6", "#3a434d", "#ff4d2e"], rubis: ["Rubis", "#b01f3a", "#3a0a14", "#ffd0d8"], ocean: ["Océan", "#2f5fa8", "#14264a", "#ffd04a"],
    menthe: ["Menthe", "#7fe0c0", "#2a6b5a", "#ffffff"], cendre: ["Cendre", "#5a5e62", "#2a2c2e", "#ff9a3a"], aurore: ["Aurore", "#ff9ac8", "#7a3a8a", "#ffe6a0"], foret: ["Forêt", "#4f6b3a", "#2a3a1f", "#d8c08a"],
  };
  const P4 = (a, b, c, d) => [PALS[a], PALS[b], PALS[c], PALS[d]];
  const SK = (i) => [SKIN.light, SKIN.fair, SKIN.tan, SKIN.olive, SKIN.brown, SKIN.dark][i % 6];
  const HC = (i) => [HAIR.black, HAIR.brown, HAIR.blond, HAIR.red, HAIR.chestnut, HAIR.white, HAIR.grey][i % 7];
  const BODY = (i) => (i % 2 ? "f" : "m");
  const HAIRF = (i, body) => (body === "f" ? ["long", "buns", "long", "buzz"] : ["parted", "buzz", "parted", null])[i % 4];
  const THEMES = [
    ["Agent", 4, "Combinaison de mission, gants, lunettes de visée", P4("givre", "nuit", "rubis", "or"), (c, i) => ({ body: BODY(i), skin: SK(i), hair: HAIRF(i, BODY(i)), hairC: HC(i), t: { c: c[1], c3: c[3], sleeve: "long", neck: "high", zip: true }, b: { c: c[1] }, s: { c: c[2], sole: c[3] }, g: { c: c[2] }, belt: c[2], buckle: c[3], gear: ["boots"], acc: ["goggles:" + c[2] + ":" + c[3], "kneepads:" + c[2], "holster:" + c[2]] })],
    ["Astronaute", 4, "Prête pour le vide : casque bulle et réserve d'air", P4("givre", "corail", "lagon", "or"), (c, i) => ({ body: BODY(i), skin: SK(i + 1), hair: HAIRF(i + 1, BODY(i)), hairC: HC(i + 2), t: { c: c[1], c3: c[2], sleeve: "long", neck: "high", zip: true }, b: { c: c[1] }, s: { c: "#d7dbe0", sole: c[2] }, g: { c: c[2], len: .12 }, belt: c[2], gear: [], acc: ["bubble:" + c[2], "tank:" + "#d7dbe0" + ":" + c[2]] })],
    ["Sapeur", 3, "Veste réfléchissante et casque de chantier", P4("rubis", "or", "cendre", "lagon"), (c, i) => ({ body: BODY(i), skin: SK(i + 2), hair: HAIRF(i, BODY(i)), hairC: HC(i + 1), t: { c: c[1], c2: "#e8eef0", sleeve: "long", pat: "hivis" }, b: { c: c[2] }, s: { c: "#2a2420" }, g: { c: "#d9b23a" }, belt: "#2a2420", gear: ["pants", "tallboots"], acc: ["hardhat:" + c[3], "tank:#d7dbe0:" + c[1]] })],
    ["Corsaire", 3, "Bandana, gilet et bottes de pont", P4("rubis", "ocean", "sable", "prune"), (c, i) => ({ body: BODY(i), skin: SK(i + 3), hair: HAIRF(i + 2, BODY(i)), hairC: HC(i), beard: !(i % 2), t: { c: "#efe6d2", c2: c[1], sleeve: "elbow", neck: "v" }, b: { c: c[2], c2: c[1], pat: "stripes" }, s: { c: "#3a2416" }, belt: "#3a2416", buckle: "#d9b23a", head: { mode: "bandana", c: c[1] }, gear: ["tallboots", "vest:" + c[2]], acc: ["medallion:#d9b23a", "rings:#d9b23a"] })],
    ["Ombre", 4, "Cagoule, lames dorsales, pas silencieux", P4("nuit", "rubis", "emeraude", "givre"), (c, i) => ({ body: BODY(i), skin: SK(i), hair: null, t: { c: c[1], c2: c[2], sleeve: "long", neck: "high" }, b: { c: c[1] }, s: { c: c[2] }, g: { c: c[2] }, belt: c[3], head: { mode: "balaclava", c: c[2] }, glow: { c: c[3], pat: 1, k: .6 }, gear: [], acc: ["blades:#c9ccd8", "scarf:" + c[3]] })],
    ["Paladin", 5, "Armure de plates et heaume à visière", P4("acier", "or", "nuit", "corail"), (c, i) => ({ body: BODY(i), skin: SK(i + 1), hair: null, t: { c: c[1], c2: c[2], sleeve: "long", pat: "armor" }, b: { c: c[1], pat: "armor" }, s: { c: c[2] }, g: { c: c[2] }, belt: c[3], gear: [], acc: ["knight:" + c[1] + ":" + c[2] + ":" + c[3], "chestplate:" + c[1] + ":" + c[3]] })],
    ["Baroudeur", 2, "Chapeau de brousse, sacoches et carte", P4("sable", "foret", "corail", "cendre"), (c, i) => ({ body: BODY(i), skin: SK(i + 4), hair: HAIRF(i, BODY(i)), hairC: HC(i + 3), beard: !!(i % 3 === 0), t: { c: c[1], c2: c[2], sleeve: "elbow", neck: "v" }, b: { c: c[2] }, s: { c: "#4a3527" }, belt: "#4a3527", gear: ["pants", "boots"], acc: ["safari:" + c[1] + ":" + c[2], "pouches:" + c[2]] })],
    ["Scaphandre", 3, "Masque de plongée, bouteilles et palmes", P4("lagon", "or", "nuit", "corail"), (c, i) => ({ body: BODY(i), skin: SK(i + 2), hair: HAIRF(i + 3, BODY(i)), hairC: HC(i + 4), t: { c: c[2], c3: c[1], sleeve: "long", neck: "high", zip: true }, b: { c: c[2] }, s: { c: c[1] }, g: { c: c[2] }, belt: c[1], glow: { c: c[1], pat: 1, k: .3 }, gear: [], acc: ["goggles:#2a2a2a:" + c[1], "tank:" + c[1] + ":" + c[3], "fin:" + c[1]] })],
    ["Aviatrice", 3, "Casquette de pilote, écharpe au vent", P4("cendre", "rubis", "foret", "ocean"), (c, i) => ({ body: BODY(i + 1), skin: SK(i + 3), hair: HAIRF(i, BODY(i + 1)), hairC: HC(i + 1), t: { c: "#5a3a22", c2: c[1], sleeve: "long", neck: "high", zip: true }, b: { c: c[1] }, s: { c: "#3a2416" }, g: { c: "#5a3a22" }, belt: "#3a2416", gear: ["tallboots"], acc: ["cap:" + c[1] + ":" + c[2], "goggles:#3a3a3a:#ffb347:up", "scarf:#f2ece0"] })],
    ["Moissonneur", 2, "Chapeau de paille, salopette et chemise à carreaux", P4("corail", "ocean", "foret", "or"), (c, i) => ({ body: BODY(i), skin: SK(i + 5), hair: HAIRF(i + 1, BODY(i)), hairC: HC(i + 2), beard: !!(i % 2), t: { c: c[1], c2: c[2], c3: "#f2e3c8", pat: "plaid", sleeve: "elbow" }, b: { c: "#3b6db5", hem: 1.32, bib: true }, s: { c: "#5a3a22" }, belt: "#3b6db5", buckle: "#d9d9d9", gear: ["boots"], acc: ["straw:#e8c26a:" + c[1]] })],
    ["Décibel", 4, "Crête, pointes et lueurs de concert", P4("prune", "lagon", "braise", "menthe"), (c, i) => ({ body: BODY(i), skin: SK(i), hair: "buzz", hairC: c[3], t: { c: "#1a1a24", sleeve: i % 2 ? "tank" : "short" }, b: { c: "#2a2a38", c2: c[1], pat: "stripes" }, s: { c: "#ffffff", sole: c[3] }, glow: { c: c[3], pat: 2, k: 1.3 }, gear: ["pants"], acc: ["spikes:" + c[3], "mohawk:" + c[3], "rings:#c9ccd8"] })],
    ["Commando", 2, "Casque, gilet et treillis camouflé", P4("foret", "sable", "givre", "cendre"), (c, i) => ({ body: BODY(i), skin: SK(i + 2), hair: "buzz", hairC: HC(i), beard: !!(i % 2 === 0), t: { c: c[2], sleeve: "short" }, b: { c: c[1], c2: c[2], c3: c[3], pat: "camo" }, s: { c: "#2a2018" }, g: { c: "#2b2a24", fingerless: true }, belt: "#2a2a2a", gear: ["pants", "boots", "vest:" + c[2]], acc: ["helmet:" + c[1] + ":" + c[2], "kneepads:" + c[2], "holster:#2b2a24"] })],
    ["Squelette", 4, "Os peints qui luisent dans le noir", P4("nuit", "emeraude", "prune", "braise"), (c, i) => ({ body: BODY(i), skin: SKIN.light, hair: null, t: { c: "#141418", c2: "#f1ede2", sleeve: "long" }, b: { c: "#141418" }, s: { c: "#141418" }, g: { c: "#141418" }, head: { mode: "skull" }, glow: { c: c[3], pat: 3, k: .9 }, gear: [], acc: i % 2 ? ["scarf:" + c[3]] : [] })],
    ["Néon", 4, "Combinaison sombre parcourue de circuits lumineux", P4("lagon", "prune", "or", "emeraude"), (c, i) => ({ body: BODY(i + 1), skin: SK(i + 1), hair: HAIRF(i, BODY(i + 1)), hairC: HC(i + 5), t: { c: "#151a2e", sleeve: "long", neck: "high", zip: true, c3: c[1] }, b: { c: "#151a2e" }, s: { c: "#0e1120", sole: c[1] }, g: { c: "#0e1120" }, glow: { c: c[1], pat: 1, k: 1.2 }, gear: [], acc: ["visorhelm:#151a2e:" + c[1]] })],
    ["Peluche", 3, "Mascotte toute douce", P4("ocean", "corail", "prune", "menthe"), (c, i) => ({ mascot: ["bear", "dino", "shark", "bear"][i], fur: c[1], fur2: c[3], eye: "#16233d" })],
    ["Motard", 3, "Blouson épais, casque intégral", P4("nuit", "rubis", "or", "givre"), (c, i) => ({ body: BODY(i), skin: SK(i + 4), hair: null, t: { c: c[1], c2: c[2], sleeve: "long", neck: "high", zip: true }, b: { c: "#1a1d26" }, s: { c: "#121417" }, g: { c: c[1] }, belt: "#121417", buckle: c[3], gear: ["tallboots"], acc: ["visorhelm:" + c[1] + ":" + c[3], "kneepads:" + c[2]] })],
    ["Alpiniste", 2, "Bonnet, écharpe et grosses bottes", P4("rubis", "lagon", "or", "prune"), (c, i) => ({ body: BODY(i), skin: SK(i), hair: HAIRF(i + 2, BODY(i)), hairC: HC(i + 3), t: { c: c[1], c2: c[2], sleeve: "long", pat: "fur", neck: "high", zip: true }, b: { c: "#2a3138" }, s: { c: "#4a3527" }, g: { c: c[2] }, belt: "#2a3138", gear: ["pants", "tallboots"], acc: ["beanie:" + c[1] + ":" + c[2], "scarf:" + c[3], "backpack:" + c[2] + ":" + c[1]] })],
    ["Savant", 3, "Blouse claire et lunettes de laboratoire", P4("givre", "menthe", "or", "corail"), (c, i) => ({ body: BODY(i + 1), skin: SK(i + 2), hair: HAIRF(i + 1, BODY(i + 1)), hairC: HC(i + 6), t: { c: "#f4f6f8", c3: c[3], sleeve: "long", neck: "v" }, b: { c: "#3a4049" }, s: { c: "#2a2420" }, g: { c: c[3], len: .1 }, belt: "#3a4049", gear: ["pants"], acc: ["goggles:#f4f6f8:" + c[3] + ":up", "pouches:" + c[2]] })],
    ["Surfeur", 2, "Débardeur, short et coquillages", P4("lagon", "corail", "or", "menthe"), (c, i) => ({ body: BODY(i), skin: SK(i + 3), hair: HAIRF(i, BODY(i)), hairC: HC(i + 2), t: { c: c[1], c2: c[3], sleeve: "tank", pat: i % 2 ? "stripes" : "solid" }, b: { c: c[2], hem: .9 }, s: { c: "#f2ece0", sole: c[1] }, belt: c[3], gear: [], acc: ["medallion:" + c[3]] })],
    ["Ranger", 3, "Capuche de forêt, carquois et cape", P4("foret", "cendre", "sable", "prune"), (c, i) => ({ body: BODY(i + 1), skin: SK(i + 1), hair: HAIRF(i + 3, BODY(i + 1)), hairC: HC(i + 4), t: { c: c[1], c2: c[2], sleeve: "long" }, b: { c: c[2] }, s: { c: "#3a2416" }, g: { c: "#3a2416", fingerless: true }, belt: "#3a2416", gear: ["hood:" + c[1], "tallboots", "vest:" + c[2]], acc: ["pouches:#5a3a22"] })],
    ["Nomade", 3, "Foulard et lunettes contre le sable", P4("sable", "rubis", "lagon", "cendre"), (c, i) => ({ body: BODY(i), skin: SK(i + 4), hair: null, t: { c: c[1], c2: c[2], sleeve: "long" }, b: { c: c[1], c2: c[2], c3: c[3], pat: "camo" }, s: { c: "#5a4330" }, g: { c: "#6b5236" }, belt: "#5a4330", head: { mode: "bandana", c: c[1] }, gear: ["pants", "boots", "vest:" + c[2]], acc: ["goggles:#3a3a3a:" + c[3] + ":up", "scarf:" + c[2]] })],
    ["Banquise", 3, "Fourrure épaisse et bonnet à pompon", P4("givre", "ocean", "rubis", "menthe"), (c, i) => ({ body: BODY(i), skin: SK(i), hair: HAIRF(i + 1, BODY(i)), hairC: HC(i + 5), t: { c: c[1], c2: c[2], sleeve: "long", pat: "fur" }, b: { c: c[2] }, s: { c: "#e8eef4", sole: c[2] }, g: { c: c[2] }, belt: c[2], gear: ["pants", "tallboots"], acc: ["beanie:" + c[1] + ":" + c[2], "scarf:" + c[3]] })],
    ["Cyber", 5, "Visière de données et armure légère lumineuse", P4("lagon", "braise", "prune", "or"), (c, i) => ({ body: BODY(i + 1), skin: SK(i + 2), hair: null, t: { c: "#c9d2dc", c2: "#3a434d", sleeve: "long", pat: "armor" }, b: { c: "#3a434d" }, s: { c: "#1f2329", sole: c[1] }, g: { c: "#1f2329" }, belt: c[1], glow: { c: c[1], pat: 2, k: 1 }, gear: ["boots"], acc: ["visorhelm:#c9d2dc:" + c[1], "chestplate:#c9d2dc:" + c[2], "spinespikes:" + c[1]] })],
    ["Gladiateur", 4, "Casque à cimier et plastron de bronze", P4("or", "rubis", "acier", "nuit"), (c, i) => ({ body: BODY(i), skin: SK(i + 3), hair: null, beard: true, t: { c: c[2], c2: c[1], sleeve: "tank" }, b: { c: c[2], hem: 1.1 }, s: { c: "#5a3a22" }, g: { c: "#5a3a22", fingerless: true }, belt: c[1], buckle: c[1], gear: ["boots"], acc: ["helmet:" + c[1] + ":" + c[2], "chestplate:" + c[1] + ":" + c[2], "kneepads:" + c[1]] })],
    ["Faille", 5, "Capuche d'énergie violette, éclats de cristal", P4("prune", "lagon", "rubis", "givre"), (c, i) => ({ body: BODY(i + 1), skin: SK(i), hair: HAIRF(i, BODY(i + 1)), hairC: HC(i + 5), t: { c: "#2a1d4a", c3: c[1], sleeve: "long", zip: true }, b: { c: "#1a1530" }, s: { c: "#1a1530", sole: c[1] }, g: { c: "#1a1530" }, glow: { c: c[1], pat: 1, k: 1 }, gear: ["hood:#2a1d4a"], acc: ["blades:" + c[3], "spinespikes:" + c[1]] })],
  ];
  const RNAME = { 1: "Commun", 2: "Peu commun", 3: "Rare", 4: "Épique", 5: "Légendaire" };
  const PRICE = { 1: 500, 2: 800, 3: 1200, 4: 1500, 5: 2000 };
  THEMES.forEach((th, ti) => {
    th[3].forEach((c, ci) => {
      const id = "char-v95-" + ti + "-" + ci, look = th[4](c, ci + ti);
      LOOKS_X[id] = look; API.skins.push(id); if (ci === 0 && ti % 3 === 0) API.botSkins.push(id); // 9 tenues pour les bots : peu de modèles à préparer en début de partie (iPhone)
      item(id, th[0] + " " + c[0], "character", th[1], PRICE[th[1]], th[2], c[1], c[2], "✦", { palette: "v95", model: "scout", set: th[0] });
    });
  });

  /* ================================================================= sacs à dos (accessoires rigides) */
  {
    const reg = (name, f) => { f.c2 = true; ACC_X[name] = f; };
    reg("v95wings", (k, c, c2, L) => { for (const s of [-1, 1]) for (let j = 0; j < 5; j++) k.box("spine_03", "main", j % 2 ? c2 : c, [.05, .34 - j * .045, .02], [s * (.1 + j * .07), L.chestY + .06 + j * .045, L.backZ - .09 - j * .01], [0, s * .25, s * (.55 + j * .18)]); });
    reg("v95jet", (k, c, c2, L) => { for (const s of [-1, 1]) { k.cyl("spine_03", "metal", c, .055, .065, .3, [s * .09, L.chestY - .02, L.backZ - .09]); k.cone("spine_03", "main", c2, .06, .08, [s * .09, L.chestY - .2, L.backZ - .09], [Math.PI, 0, 0]); } k.box("spine_03", "main", c2, [.22, .1, .06], [0, L.chestY + .05, L.backZ - .06]); });
    reg("v95shield", (k, c, c2, L) => { k.cyl("spine_03", "metal", c, .2, .2, .03, [0, L.chestY - .03, L.backZ - .07], [Math.PI / 2, 0, 0], 24); k.tor("spine_03", "metal", c2, .2, .018, [0, L.chestY - .03, L.backZ - .085], [0, 0, 0]); k.sph("spine_03", "metal", c2, .05, [0, L.chestY - .03, L.backZ - .09]); });
    reg("v95quiver", (k, c, c2, L) => { k.cyl("spine_03", "main", c, .06, .05, .38, [.06, L.chestY, L.backZ - .08], [0, 0, -.35], 12); for (let j = 0; j < 4; j++) k.cyl("spine_03", "main", c2, .006, .006, .2, [.1 + j * .015, L.chestY + .24, L.backZ - .08 + (j - 1.5) * .015], [0, 0, -.35], 5); });
    reg("v95guitar", (k, c, c2, L) => { k.sph("spine_03", "main", c, 1, [-.02, L.chestY - .1, L.backZ - .08], [.15, .19, .05]); k.box("spine_03", "main", c2, [.04, .36, .025], [.05, L.chestY + .16, L.backZ - .08], [0, 0, -.3]); k.cyl("spine_03", "main", "#1a1a1a", .04, .04, .01, [-.02, L.chestY - .1, L.backZ - .135], [Math.PI / 2, 0, 0]); });
    reg("v95cape", (k, c, c2, L) => { k.box("spine_03", "main", c, [.36, .62, .02], [0, L.chestY - .22, L.backZ - .07], [-.12, 0, 0]); k.box("spine_03", "main", c2, [.38, .05, .03], [0, L.chestY + .1, L.backZ - .05], [0, 0, 0]); });
    reg("v95orb", (k, c, c2, L) => { k.sph("spine_03", "metal", c, .13, [0, L.chestY + .02, L.backZ - .12]); k.tor("spine_03", "metal", c2, .17, .012, [0, L.chestY + .02, L.backZ - .12], [Math.PI / 2, 0, 0]); k.tor("spine_03", "metal", c2, .17, .012, [0, L.chestY + .02, L.backZ - .12], [0, 0, 0]); });
    reg("v95crate", (k, c, c2, L) => { k.box("spine_03", "main", c, [.26, .26, .16], [0, L.chestY - .02, L.backZ - .1], [0, 0, .05]); k.box("spine_03", "main", c2, [.28, .04, .17], [0, L.chestY + .06, L.backZ - .1], [0, 0, .05]); k.box("spine_03", "main", c2, [.28, .04, .17], [0, L.chestY - .1, L.backZ - .1], [0, 0, .05]); });
  }
  const BACKS = [
    ["back-v95-ailes", "Ailes de plume", 4, "v95wings:#f4f6f8:#cfe0ff", "#f4f6f8", "#cfe0ff"], ["back-v95-ailes-nuit", "Ailes de nuit", 4, "v95wings:#2a1d4a:#7a4dff", "#2a1d4a", "#7a4dff"],
    ["back-v95-jet", "Réacteurs dorsaux", 4, "v95jet:#c9d2dc:#ff7a1a", "#c9d2dc", "#ff7a1a"], ["back-v95-jet-lagon", "Réacteurs lagon", 3, "v95jet:#1fa3b5:#b8fff4", "#1fa3b5", "#b8fff4"],
    ["back-v95-bouclier", "Bouclier rond", 3, "v95shield:#8b97a6:#d9b23a", "#8b97a6", "#d9b23a"], ["back-v95-bouclier-rubis", "Écu rubis", 3, "v95shield:#b01f3a:#f2e3c8", "#b01f3a", "#f2e3c8"],
    ["back-v95-carquois", "Carquois du rôdeur", 2, "v95quiver:#5a3a22:#d8c08a", "#5a3a22", "#d8c08a"], ["back-v95-guitare", "Guitare de route", 3, "v95guitar:#c0392b:#3a2416", "#c0392b", "#3a2416"],
    ["back-v95-guitare-neon", "Guitare néon", 4, "v95guitar:#7a4dff:#2ee6ff", "#7a4dff", "#2ee6ff"], ["back-v95-cape", "Cape royale", 4, "v95cape:#b01f3a:#d9b23a", "#b01f3a", "#d9b23a"],
    ["back-v95-cape-ombre", "Cape d'ombre", 4, "v95cape:#141418:#5dffb0", "#141418", "#5dffb0"], ["back-v95-orbe", "Orbe de faille", 5, "v95orb:#7a4dff:#2ee6ff", "#7a4dff", "#2ee6ff"],
    ["back-v95-caisse", "Caisse de ravitaillement", 2, "v95crate:#4f6b3a:#d9b23a", "#4f6b3a", "#d9b23a"], ["back-v95-sac", "Sac d'expédition", 1, "backpack:#5a6242:#3f452e", "#5a6242", "#3f452e"],
    ["back-v95-bouteilles", "Bouteilles de plongée", 2, "tank:#d7dbe0:#1fa3b5", "#d7dbe0", "#1fa3b5"], ["back-v95-lames", "Lames jumelles", 3, "blades:#c9ccd8", "#c9ccd8", "#3a434d"],
  ];
  BACKS.forEach((b) => { API.backs[b[0]] = [b[3]]; item(b[0], b[1], "back", b[2], PRICE[b[2]] * .6 | 0, "Accessoire de dos", b[4], b[5], "⌾"); });
  API.backAcc = (id) => API.backs[id] || null;

  /* ================================================================= planeurs */
  const GL = [
    ["parapente", "Parapente"], ["ailes", "Grandes ailes"], ["parapluie", "Parapluie"], ["ballons", "Grappe de ballons"], ["chauvesouris", "Ailes de chauve-souris"],
    ["navette", "Navette"], ["fusee", "Fusée"], ["soucoupe", "Soucoupe"], ["feuille", "Feuille géante"], ["cerfvolant", "Cerf-volant"],
  ];
  const GCOL = [["Corail", "#ff7a6b", "#fff1e6"], ["Nuit", "#2a1d4a", "#2ee6ff"], ["Lagon", "#1fa3b5", "#ffd04a"], ["Rubis", "#b01f3a", "#f2e3c8"], ["Émeraude", "#1f6b4a", "#5dffb0"]];
  GL.forEach((g, gi) => [0, 1].forEach((v) => {
    const c = GCOL[(gi + v * 2) % GCOL.length], id = "glider-v95-" + g[0] + (v ? "-" + v : ""), r = 2 + ((gi + v) % 4);
    API.gliders[id] = g[0]; item(id, g[1] + " " + c[0], "glider", r, PRICE[r] * .7 | 0, "Planeur", c[1], c[2], "⌄");
  }));
  function gliderModel(shape, col, sec) {
    const Mo = root.AZArt.Model, m = new Mo(), ink = "#22262e", rope = "#d4e8e5";
    m.cyl(.026, .026, .9, ink, 0, -.82, .08, 8, 0, Math.PI / 2).sphere(.055, sec, -.43, -.82, .08).sphere(.055, sec, .43, -.82, .08);
    // suspentes : de la poignée la plus proche jusqu'au point d'attache (cylindre orienté sur le segment)
    const lines = (pts) => pts.forEach(([x, y, z]) => { const gx = (x < 0 ? -1 : 1) * .43, dx = x - gx, dy = y + .82, dz = z - .08, L = Math.hypot(dx, dy, dz) || 1; m.cyl(.012, .012, L, rope, (x + gx) / 2, (y - .82) / 2, (z + .08) / 2, 5, Math.asin(dz / L), Math.atan2(-dx, dy)); });
    if (shape === "parapente") { for (let i = -6; i <= 6; i++) { const u = i / 6, x = u * 2.7, y = .75 - .45 * u * u; m.box(.44, .1, 1.3, i % 2 ? sec : col, x, y, 0, 0, 0, -u * .7); } lines([[-2.2, .45, 0], [-1.1, .7, 0], [1.1, .7, 0], [2.2, .45, 0]]); }
    else if (shape === "ailes") { for (const s of [-1, 1]) for (let j = 0; j < 7; j++) m.box(.22, .05, 1.1 - j * .08, j % 2 ? sec : col, s * (.35 + j * .3), .3 + j * .06, .1 * j, 0, s * .1 * j, s * .12); lines([[-1, .45, 0], [1, .45, 0]]); }
    else if (shape === "parapluie") { m.add(new T.ConeGeometry(1.7, .7, 16, 1, true), col, 0, .65, 0).add(new T.ConeGeometry(1.72, .72, 16, 1, true), sec, 0, .64, 0, 0, Math.PI / 16, 0); m.cyl(.03, .03, 1.5, ink, 0, -.1, .08, 8).sphere(.07, sec, 0, 1.03, 0); }
    else if (shape === "ballons") { const C = [col, sec, "#ffd04a", "#7fe0c0", "#ff9ac8"]; for (let j = 0; j < 7; j++) { const a = j * 2.4, r = j ? .55 : 0, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 1.1 + (j % 3) * .25; m.sphere(.38, C[j % 5], x, y, z, 1, 1.15, 1); lines([[x, y - .4, z]]); } }
    else if (shape === "chauvesouris") { for (const s of [-1, 1]) { for (let j = 0; j < 4; j++) m.box(.04, .04, 1.2 - j * .15, ink, s * (.3 + j * .55), .55 - j * .05, .1, 0, s * (.4 - j * .25), 0); for (let j = 0; j < 4; j++) m.box(.55, .02, .9 - j * .1, j % 2 ? col : sec, s * (.55 + j * .55), .5 - j * .05, .25, 0, 0, s * .12); } lines([[-1.2, .45, .2], [1.2, .45, .2]]); }
    else if (shape === "navette") { m.cyl(.32, .4, 2.4, col, 0, .55, 0, 14, Math.PI / 2).add(new T.ConeGeometry(.32, .7, 14), col, 0, .55, -1.55, -Math.PI / 2, 0, 0); for (const s of [-1, 1]) m.box(1.4, .06, 1.1, sec, s * .8, .45, .5, 0, s * -.35, s * .05); m.box(.06, .7, .7, sec, 0, .95, .9).sphere(.22, "#ff9a3a", 0, .55, 1.3); lines([[-.8, .4, 0], [.8, .4, 0]]); }
    else if (shape === "fusee") { m.cyl(.28, .28, 2.2, col, 0, .55, 0, 14, Math.PI / 2).add(new T.ConeGeometry(.28, .6, 14), sec, 0, .55, -1.4, -Math.PI / 2, 0, 0); for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2; m.box(.04, .45, .5, sec, Math.cos(a) * .32, .55 + Math.sin(a) * .32, 1, 0, 0, a); } m.sphere(.25, "#ffd04a", 0, .55, 1.25); lines([[-.3, .4, -.3], [.3, .4, -.3]]); }
    else if (shape === "soucoupe") { m.cyl(1.4, 1.1, .22, col, 0, .5, 0, 24).sphere(.55, sec, 0, .62, 0, 1, .7, 1); for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; m.sphere(.08, "#ffd04a", Math.cos(a) * 1.15, .45, Math.sin(a) * 1.15); } lines([[-.9, .4, 0], [.9, .4, 0]]); }
    else if (shape === "feuille") { m.sphere(1, col, 0, .55, 0, 2.3, .06, 1.2).box(4.2, .04, .06, sec, 0, .6, 0); for (let j = -3; j <= 3; j++) m.box(.04, .03, 1.6, sec, j * .55, .6, 0, 0, j * .15, 0); lines([[-1.4, .5, 0], [1.4, .5, 0]]); }
    else if (shape === "cerfvolant") { m.box(1.9, .05, 1.9, col, 0, .9, 0, 0, Math.PI / 4, 0).box(2.6, .07, .05, sec, 0, .93, 0).box(.05, .07, 2.6, sec, 0, .93, 0); for (let j = 0; j < 5; j++) m.box(.25, .03, .2, j % 2 ? sec : col, 0, .7 - j * .25, 1.4 + j * .35, 0, j * .5, 0); lines([[0, .85, 0]]); }
    return m.mesh();
  }
  /* ================================================================= pioches */
  const TL = [["hache", "Hache"], ["faux", "Faux"], ["marteau", "Marteau de forge"], ["double", "Pioche double"], ["trident", "Trident"], ["cle", "Clé à molette"], ["sucette", "Sucette géante"], ["cristal", "Sceptre de cristal"], ["ancre", "Ancre"], ["pelle", "Pelle"], ["masse", "Masse à pointes"], ["faucille", "Faucille"]];
  const TCOL = [["Acier", "#c9d2dc", "#3a434d"], ["Or", "#d9b23a", "#6b4a12"], ["Néon", "#2ee6ff", "#7a4dff"], ["Rubis", "#b01f3a", "#2a1a1a"]];
  TL.forEach((t, ti) => [0, 1].forEach((v) => {
    if (v && ti % 4) return; // 12 formes + 3 coloris de plus = 15
    const c = TCOL[(ti + v) % TCOL.length], id = "tool-v95-" + t[0] + (v ? "-" + v : ""), r = 2 + ((ti + v) % 4);
    API.tools[id] = t[0]; item(id, t[1] + " " + c[0], "tool", r, PRICE[r] * .6 | 0, "Outil de collecte", c[1], c[2], "⟂");
  }));
  function toolModel(shape, col, sec) {
    const m = new root.AZArt.Model(), wood = "#5a3a22", ink = "#22262e";
    m.cyl(.025, .034, 1.02, shape === "sucette" ? "#f4f6f8" : ink, 0, 0, 0, 8);
    if (shape === "hache") m.box(.06, .3, .34, col, .16, .38, 0).box(.2, .1, .12, sec, 0, .38, 0);
    else if (shape === "faux") { for (let j = 0; j < 6; j++) m.box(.16, .05, .05, col, .1 + j * .13, .5 - j * j * .012, 0, 0, 0, -.12 * j); m.box(.08, .12, .1, sec, 0, .48, 0); }
    else if (shape === "marteau") m.box(.42, .2, .2, col, 0, .44, 0).box(.12, .24, .24, sec, -.2, .44, 0);
    else if (shape === "double") { for (const s of [-1, 1]) for (let j = 0; j < 4; j++) m.box(.12, .06, .07, col, s * (.08 + j * .09), .4 - j * j * .012, 0, 0, 0, s * -.15 * j); m.box(.1, .12, .11, sec, 0, .4, 0); }
    else if (shape === "trident") { m.box(.34, .05, .05, sec, 0, .4, 0); for (const x of [-.15, 0, .15]) m.box(.035, .24, .035, col, x, .54, 0).add(new T.ConeGeometry(.04, .08, 6), col, x, .7, 0); }
    else if (shape === "cle") { m.box(.09, .18, .05, col, 0, .5, 0); for (const s of [-1, 1]) m.box(.06, .14, .05, col, s * .08, .64, 0); m.box(.04, .3, .04, sec, 0, .3, 0); }
    else if (shape === "sucette") { m.cyl(.2, .2, .07, col, 0, .62, 0, 24, Math.PI / 2); for (let j = 0; j < 3; j++) m.add(new T.TorusGeometry(.06 + j * .05, .012, 5, 24), sec, 0, .62, .04); }
    else if (shape === "cristal") m.add(new T.OctahedronGeometry(.13, 0), col, 0, .62, 0, 0, 0, 0, 1, 1.7, 1).add(new T.TorusGeometry(.1, .018, 6, 18), sec, 0, .46, 0, Math.PI / 2);
    else if (shape === "ancre") { m.box(.3, .05, .05, sec, 0, .5, 0); for (const s of [-1, 1]) m.box(.05, .18, .05, col, s * .2, .3, 0, 0, 0, s * .5); m.add(new T.TorusGeometry(.06, .015, 5, 14), sec, 0, .6, 0); }
    else if (shape === "pelle") m.box(.26, .34, .03, col, 0, .62, 0).box(.12, .05, .05, sec, 0, .45, 0);
    else if (shape === "masse") { m.sphere(.13, col, 0, .5, 0); for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; m.add(new T.ConeGeometry(.03, .1, 5), sec, Math.cos(a) * .14, .5 + Math.sin(a) * .14, 0, 0, 0, a - Math.PI / 2); } }
    else if (shape === "faucille") { for (let j = 0; j < 7; j++) { const a = j / 6 * Math.PI * .9; m.box(.05, .1, .04, col, .14 * Math.sin(a), .45 + .14 * Math.cos(a), 0, 0, 0, -a); } }
    void wood;
    return m.mesh();
  }
  /* remplacement du planeur et de la pioche sur le modèle du joueur */
  function installAvatar() {
    const A = root.AZArt; if (!A || typeof A.avatar !== "function") return false; if (A.__v95cos) return true;
    A.__v95cos = true;
    const base = A.avatar;
    A.avatar = function (eq) {
      const g = base.apply(this, arguments);
      try {
        const u = g && g.userData, cat = (id) => M.catalog.find((x) => x.id === id);
        const gs = eq && API.gliders[eq.glider], ts = eq && API.tools[eq.tool];
        if (u && u.glider && gs) { const c = cat(eq.glider); while (u.glider.children.length) u.glider.remove(u.glider.children[0]); u.glider.add(gliderModel(gs, c.color, c.secondary)); }
        if (u && u.tool && ts) { const c = cat(eq.tool); while (u.tool.children.length) u.tool.remove(u.tool.children[0]); u.tool.add(toolModel(ts, c.color, c.secondary)); }
      } catch (e) { if (root.console) console.warn("[AZUR cosmétiques]", e); }
      return g;
    };
    return true;
  }
  if (!installAvatar()) { let n = 0; const tm = setInterval(() => { if (installAvatar() || ++n > 600) clearInterval(tm); }, 50); }

  /* ================================================================= émotes */
  // hands(et, H) : H.R / H.L(x, y, z) posent une main (repère du personnage : x à droite, y en haut, -z devant)
  const sin = Math.sin, cos = Math.cos, ab = Math.abs, PI = Math.PI, pos = (v) => Math.max(0, v);
  const E = {
    bravo: ["Bravo !", "Idle_Loop", 1, 1, (t, H) => { const c = pos(sin(t * 14)); H.R(.05 + .07 * c, 1.32, -.32); H.L(-.05 - .07 * c, 1.32, -.32); }],
    biceps: ["Biceps d'acier", "Idle_Loop", 1, 2, (t, H) => { const p = .03 * sin(t * 6); H.R(.42, 1.62 + p, -.05); H.L(-.42, 1.62 + p, -.05); }, (t) => ({ y: .02 * ab(sin(t * 3)) })],
    pouce: ["Bien joué", "Yes", 1, 1, (t, H) => H.R(.25, 1.45, -.42)],
    oups: ["Oups…", "Idle_Loop", 1, 1, (t, H) => H.R(.04, 1.7, -.16), (t) => ({ rx: .12 })],
    guitare: ["Guitare imaginaire", "Idle_Loop", 1, 3, (t, H) => { H.L(-.32 - .05 * sin(t * 1.3), 1.26, -.3); H.R(.1, 1.05 + .07 * sin(t * 16), -.24); }, (t) => ({ rx: -.12, y: .04 * ab(sin(t * 4)) })],
    batteur: ["Batteur fou", "Idle_Loop", 1, 3, (t, H) => { H.R(.22, 1.04 + .13 * pos(sin(t * 12)), -.38); H.L(-.22, 1.04 + .13 * pos(sin(t * 12 + PI)), -.38); }, (t) => ({ y: .03 * ab(sin(t * 6)) })],
    chef: ["Chef d'orchestre", "Idle_Loop", 1, 2, (t, H) => { H.R(.34 + .15 * sin(t * 3), 1.6 + .15 * cos(t * 6), -.35); H.L(-.3 - .08 * sin(t * 1.5), 1.45 + .1 * sin(t * 3), -.3); }],
    vague: ["La vague", "Idle_Loop", 1, 2, (t, H) => { H.R(.36, 1.2 + .5 * (.5 + .5 * sin(t * 4)), -.2); H.L(-.36, 1.2 + .5 * (.5 + .5 * sin(t * 4 + PI / 2)), -.2); }, (t) => ({ ry: .12 * sin(t * 2) })],
    helico: ["Hélicoptère", "Idle_Loop", 1, 3, (t, H) => { H.R(.05 + .26 * cos(t * 10), 2.05, -.05 + .26 * sin(t * 10)); H.L(-.3, 1.0, .02); }, (t) => ({ ry: t * 1.6 })],
    pirouette: ["Pirouette", "Idle_Loop", 1, 3, (t, H) => { H.R(.62, 1.48, 0); H.L(-.62, 1.48, 0); }, (t) => ({ ry: t * 5, y: .05 * ab(sin(t * 5)) })],
    joie: ["Saut de joie", "NinjaJump_Idle_Loop", 1, 2, (t, H) => { H.R(.32, 2.0, -.1); H.L(-.32, 2.0, -.1); }, (t) => ({ y: .35 * ab(sin(t * 4)) })],
    boxe: ["Shadow-boxing", "Idle_Loop", 1, 3, (t, H) => { const a = pos(sin(t * 7)), b = pos(sin(t * 7 + PI)); H.R(.14, 1.42, -.22 - .38 * a); H.L(-.14, 1.42, -.22 - .38 * b); }, (t) => ({ ry: .2 * sin(t * 7), y: .03 * ab(sin(t * 7)) })],
    kata: ["Kata", "Idle_Loop", 1, 4, (t, H) => { const k = Math.floor(t / 1.2) % 4, P = [[.3, 1.5, -.5, -.2, 1.1, -.1], [.1, 1.9, -.2, -.5, 1.4, -.1], [.55, 1.35, -.1, -.2, 1.35, -.45], [.2, 1.1, -.3, -.2, 1.1, -.3]][k]; H.R(P[0], P[1], P[2]); H.L(P[3], P[4], P[5]); }, (t) => ({ ry: [0, .5, -.4, 0][Math.floor(t / 1.2) % 4] })],
    zen: ["Zen", "Crouch_Idle_Loop", 1, 3, (t, H) => { H.R(.04, .98, -.26); H.L(-.04, .98, -.26); }, (t) => ({ y: .18 + .08 * sin(t * 1.5) })],
    patience: ["Patience", "Idle_FoldArms_Loop", 1, 1, null, (t) => ({ ry: .05 * sin(t) })],
    nage: ["Nage à sec", "Swim_Fwd_Loop", 1, 3, null, () => ({ rx: -1.35, y: .28 })],
    ver: ["Le ver de terre", "Crawl_Fwd_Loop", 1.3, 3, null],
    surplace: ["Sprint sur place", "Sprint_Loop", 1.2, 2, null],
    peche: ["Grosse prise", "Idle_Loop", 1, 2, (t, H) => { H.R(.22 + .05 * cos(t * 6), 1.15 + .05 * sin(t * 6), -.3); H.L(.1, 1.32, -.45); }, (t) => ({ rx: -.06 * pos(sin(t * .8)) })],
    bucheron: ["Bûcheron", "TreeChopping_Loop", 1, 2, null],
    mineur: ["Mineur", "Mining_Loop", 1, 2, null],
    mecano: ["Mécano", "Fixing_Kneeling", 1, 2, null],
    volant: ["Au volant", "Driving_Loop", 1, 2, null],
    surf: ["Surfeur", "Slide_Loop", 1, 3, null, (t) => ({ ry: .6, rz: .12 * sin(t * 2), y: .04 * sin(t * 2) })],
    fievre: ["Fièvre du samedi", "Dance_Loop", 1.25, 4, (t, H) => { const up = Math.floor(t * 1.6) % 2 === 0; if (up) H.R(.3, 2.02, -.2); else H.R(-.2, .9, -.3); }],
    lunaire: ["Pas lunaire", "Walk_Bwd_Loop", .8, 4, null, () => ({ rx: .05 })],
    pantin: ["Pantin", "Idle_Loop", 1, 3, (t, H) => { const k = Math.floor(t * 3), a = hsh(k), b = hsh(k + 9); H.R(.25 + .3 * a, 1.1 + .8 * b, -.2 - .2 * a); H.L(-.25 - .3 * b, 1.1 + .8 * a, -.2 - .2 * b); }, (t) => ({ rz: .1 * (hsh(Math.floor(t * 3)) - .5) })],
    allo: ["Allô ?", "Idle_Loop", 1, 1, (t, H) => { H.R(.12, 1.68, -.02); H.L(-.3, 1.02, .05); }, (t) => ({ rz: .05 * sin(t) })],
    reverence: ["Révérence", "Idle_Loop", 1, 2, (t, H) => { H.R(-.04, 1.3, -.22); H.L(-.42, 1.15, .1); }, (t) => ({ rx: .45 * Math.min(1, t * 2) * (t > 3.5 ? Math.max(0, 1 - (t - 3.5) * 2) : 1) })],
    bisou: ["Bisou volant", "Idle_Loop", 1, 2, (t, H) => { const k = (t % 1.6) / 1.6, f = k < .4 ? 0 : (k - .4) / .6; H.R(.05 + .3 * f, 1.62 + .1 * f, -.16 - .55 * f); }],
    jongle: ["Jongleur", "Idle_Loop", 1, 3, (t, H) => { H.R(.2, 1.2 + .15 * sin(t * 9), -.35); H.L(-.2, 1.2 + .15 * sin(t * 9 + PI), -.35); }],
    pluie: ["Danse de la pluie", "Idle_Loop", 1, 3, (t, H) => { H.R(.35 + .15 * sin(t * 5), 1.95, -.1); H.L(-.35 + .15 * sin(t * 5), 1.95, -.1); }, (t) => ({ y: .05 * ab(sin(t * 5)), ry: .2 * sin(t * 1.2) })],
    zombie: ["Marche des morts", "Walk_Loop", .5, 2, (t, H) => { H.R(.18, 1.45, -.6); H.L(-.18, 1.45, -.6); }, (t) => ({ rz: .08 * sin(t * 2) })],
    tornade: ["Tornade", "Idle_Loop", 1, 4, (t, H) => { H.R(.25, 2.05, 0); H.L(-.25, 2.05, 0); }, (t) => ({ ry: t * 9, y: .08 + .04 * sin(t * 9) })],
    rameur: ["Rameur", "Crouch_Idle_Loop", 1, 2, (t, H) => { const z = -.15 - .4 * (.5 + .5 * sin(t * 3)); H.R(.16, 1.0, z); H.L(-.16, 1.0, z); }, (t) => ({ rx: .15 * sin(t * 3) })],
    yoga: ["Posture de l'arbre", "Idle_Loop", 1, 2, (t, H) => { H.R(.04, 2.1, 0); H.L(-.04, 2.1, 0); }, (t) => ({ rz: .04 * sin(t * .9) })],
  };
  API.defs = {};
  Object.keys(E).forEach((k) => { const d = E[k]; API.defs[k] = { name: d[0], clip: d[1], ts: d[2], rarity: d[3], hands: d[4], body: d[5] }; });
  root.AZEmotes95 = {
    defs: API.defs,
    body(style, t) { const d = API.defs[style]; return d && d.body ? d.body(t) : null; },
    hands(style, t, c) {
      const d = API.defs[style]; if (!d || !d.hands) return;
      d.hands(t, { R: (x, y, z) => c.solve(...c.right, c.loc(x, y, z), c.pole(1), c.w), L: (x, y, z) => c.solve(...c.left, c.loc(x, y, z), c.pole(-1), c.w) });
    },
  };
  const ICONS = "☺♪✋☝♫♬✦★⚑✧";
  Object.keys(API.defs).forEach((k, i) => { const d = API.defs[k]; item("emote-" + k, d.name, "emote", d.rarity, PRICE[d.rarity] * .4 | 0, "Émote", ["#9ad8ff", "#ffd04a", "#ff9ac8", "#7fe0c0"][i % 4], "#14264a", ICONS[i % ICONS.length], { style: k }); });
  const STYLE_OF = { "emote-salut": "salut", "emote-bonjour": "salut", "emote-boussole": "toupie", "emote-signal": "robot", "emote-victoire": "victoire" };
  API.styleOf = (id) => { const x = M.catalog.find((c) => c.id === id); if (x && x.style) return x.style; if (STYLE_OF[id]) return STYLE_OF[id]; const m = /^emote-(.+)$/.exec(id || ""); return m && S && S.EMOTE_STYLES.indexOf(m[1]) >= 0 ? m[1] : /danse|dance/i.test(id || "") ? "danse" : "salut"; };

  /* ================================================================= tout est offert */
  function grant(p) {
    if (!p || !Array.isArray(p.owned)) return false; let ch = false;
    for (const id of added) if (p.owned.indexOf(id) < 0) { p.owned.push(id); ch = true; }
    return ch;
  }
  if (typeof M.normalize === "function" && !M.normalize.__v95) {
    const norm = M.normalize;
    M.normalize = function () { const out = norm.apply(this, arguments); try { grant(out); } catch (e) {} return out; };
    M.normalize.__v95 = true;
  }
  (function () { let n = 0; const tm = setInterval(() => { const g = root.AZUR; if (++n > 240) return clearInterval(tm); if (!g || !g.profile) return; clearInterval(tm); try { if (grant(g.profile) && g.queueSave) g.queueSave(); } catch (e) {} }, 500); })();

  /* ================================================================= roue des émotes */
  function installWheel() {
    const HP = root.AZURHorizons && root.AZURHorizons.prototype;
    if (!HP) return false;
    if (HP.__v95emotes) return true;
    HP.__v95emotes = true;
    const slots = (p) => { const s = (p && Array.isArray(p.emoteSlots) ? p.emoteSlots.slice(0, 6) : []); if (!s[0] && p && p.equipment) s[0] = p.equipment.emote || "emote-salut"; return s; };
    if (!document.getElementById("az95-wheel-css")) {
      const st = document.createElement("style"); st.id = "az95-wheel-css";
      st.textContent = ".az95-wheel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(6,20,60,.45),rgba(6,20,60,.15));pointer-events:auto}" +
        ".az95-ring{position:relative;width:min(78vmin,420px);height:min(78vmin,420px);border-radius:50%;background:radial-gradient(circle,rgba(10,30,90,.0) 30%,rgba(18,60,160,.78) 31%,rgba(10,36,110,.86) 70%,rgba(6,20,70,0) 71%)}" +
        ".az95-slot{position:absolute;width:30%;height:30%;margin:-15% 0 0 -15%;border:0;border-radius:50%;background:transparent;color:#fff;font:800 12px/1.1 BarlowCondensed,'Arial Narrow',sans-serif;text-transform:uppercase;letter-spacing:.04em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;text-shadow:0 2px 3px #0008}" +
        ".az95-slot:hover,.az95-slot:focus{background:rgba(255,255,255,.18);outline:0}.az95-slot i{font-style:normal;font-size:30px}.az95-slot kbd{font-size:10px;opacity:.7}" +
        ".az95-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#cfe0ff;font:800 14px/1.2 BarlowCondensed,sans-serif;text-transform:uppercase;text-align:center;letter-spacing:.1em}";
      document.head.appendChild(st);
    }
    HP.openEmotes = function () {
      if (this.modal === "emotes") { this.closeModal(); return; }
      if (this.modal || this.screen !== "game") return;
      if (this.canEmote && !this.canEmote()) { this.toast && this.toast("Pose-toi et termine ton action pour faire une émote."); return; }
      this.resetControls && this.resetControls();
      this.send({ fire: false, aim: false, moveX: 0, moveZ: 0, moveY: 0, sprint: false, crouch: false });
      this.modal = "emotes"; this.paused = false; if (document.pointerLockElement) document.exitPointerLock();
      const s = slots(this.profile);
      const html = [0, 1, 2, 3, 4, 5].map((i) => {
        const id = s[i], x = id && M.catalog.find((c) => c.id === id), a = -PI / 2 + i * PI / 3, l = 50 + 33 * cos(a), tp = 50 + 33 * sin(a);
        return '<button type="button" class="az95-slot" data-act="emote-play" data-id="' + (x ? API.styleOf(id) : "") + '" style="left:' + l + "%;top:" + tp + '%"' + (x ? "" : " disabled") + "><i>" + (x ? x.icon || "♪" : "·") + "</i><b>" + (x ? x.name : "Vide") + "</b><kbd>" + (i + 1) + "</kbd></button>";
      }).join("");
      this.overlay.innerHTML = '<div class="az95-wheel modal-shade" data-act="resume"><div class="az95-ring" role="dialog" aria-label="Émotes">' + html + '<div class="az95-center">Émotes<br><small>T pour fermer</small></div></div></div>';
      const first = this.overlay.querySelector('[data-act="emote-play"]:not([disabled])'); if (first) first.focus();
    };
    // touches 1 à 6 dans la roue : l'émote rangée dans cet emplacement du casier
    root.addEventListener("keydown", (e) => {
      const g = root.AZUR; if (!g || g.modal !== "emotes" || !/^Digit[1-6]$/.test(e.code)) return;
      const id = slots(g.profile)[Number(e.code.slice(5)) - 1]; e.preventDefault(); e.stopImmediatePropagation();
      if (id && g.playEmote) g.playEmote(API.styleOf(id));
    }, true);
    const prevAct = HP.action;
    HP.action = function (act, id, el) {
      if (act === "emote") { const st = API.styleOf(this.profile && this.profile.equipment && this.profile.equipment.emote); if (this.playEmote) return this.playEmote(st); }
      if (act === "emote-play" && id && this.playEmote) return this.playEmote(id);
      return prevAct.apply(this, arguments);
    };
    return true;
  }
  /* champ CHERCHER du casier : on garde la saisie, on redessine après une courte pause et on rend le focus */
  let qTimer = 0;
  root.addEventListener("input", (e) => {
    const el = e.target; if (!el || !el.matches || !el.matches("[data-ch1s-search]")) return;
    const g = root.AZUR; if (!g) return; g.ch1sQuery = el.value; clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      try { if (g.renderMenu) g.renderMenu(); } catch (er) {}
      const nx = document.querySelector("[data-ch1s-search]"); if (nx) { nx.focus(); const n = nx.value.length; try { nx.setSelectionRange(n, n); } catch (er) {} }
    }, 260);
  }, true);
  if (!installWheel()) { let n = 0; const tm = setInterval(() => { if (installWheel() || ++n > 600) clearInterval(tm); }, 50); }
})(typeof window !== "undefined" ? window : globalThis);
