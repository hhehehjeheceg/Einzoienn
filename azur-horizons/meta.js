(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AZMeta = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var DAY = function () {
    return new Date().toISOString().slice(0, 10);
  };
  var WEEK = function () {
    var d = new Date(),
      t = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      );
    var n = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - n);
    return t.toISOString().slice(0, 10);
  };
  var C = [];
  function item(
    id,
    name,
    type,
    rarity,
    price,
    description,
    color,
    secondary,
    icon,
    extra,
  ) {
    var x = {
      id: id,
      name: name,
      type: type,
      rarity: rarity,
      price: price,
      description: description,
      color: color,
      secondary: secondary,
      icon: icon,
    };
    if (extra)
      Object.keys(extra).forEach(function (k) {
        x[k] = extra[k];
      });
    C.push(x);
  }
  // Original expedition cosmetics: no external asset or brand is implied.
  item(
    "char-ambre",
    "Ambre, éclaireuse",
    "character",
    1,
    0,
    "Pilote des côtes de corail",
    "#ff9d5c",
    "#ffe7b0",
    "✦",
    { palette: "coral" },
  );
  item(
    "char-azur",
    "Azur, cartographe",
    "character",
    2,
    650,
    "Une boussole dans le regard",
    "#38bdf8",
    "#d9f4ff",
    "✧",
    { palette: "sky" },
  );
  item(
    "char-sauge",
    "Sauge, botaniste",
    "character",
    2,
    700,
    "Gardienne des îles vertes",
    "#74c69d",
    "#e8ffd9",
    "❖",
    { palette: "sage" },
  );
  item(
    "char-nacre",
    "Nacre, plongeuse",
    "character",
    3,
    900,
    "Armure nacrée, esprit marin",
    "#f5b7d2",
    "#fff7fb",
    "◇",
    { palette: "pearl" },
  );
  item(
    "char-cuivre",
    "Cuivre, mécanicien",
    "character",
    3,
    1100,
    "Toujours prête à réparer",
    "#d88953",
    "#3d2630",
    "⚙",
    { palette: "copper" },
  );
  item(
    "variant-aube",
    "Variante Aube",
    "variant",
    1,
    0,
    "Teintes du premier soleil",
    "#ffc46b",
    "#fff1b5",
    "☼",
  );
  item(
    "variant-lagon",
    "Variante Lagon",
    "variant",
    2,
    450,
    "Reflets d eau claire",
    "#31c7b1",
    "#083b4c",
    "≈",
  );
  item(
    "variant-minuit",
    "Variante Minuit",
    "variant",
    3,
    800,
    "Camouflage sous les étoiles",
    "#273b74",
    "#8fa8ff",
    "☾",
  );
  item(
    "back-sac",
    "Sac Balise",
    "back",
    1,
    0,
    "Sac compact de l expédition",
    "#f0a35a",
    "#5b3242",
    "▣",
  );
  item(
    "back-voile",
    "Voile des Alizés",
    "back",
    2,
    500,
    "Une traîne légère dans le vent",
    "#67d5d0",
    "#164e63",
    "⌁",
  );
  item(
    "back-orbe",
    "Orbe des Marées",
    "back",
    3,
    850,
    "Une lumière au cœur du sac",
    "#e6a7ff",
    "#43205e",
    "◉",
  );
  item(
    "tool-compas",
    "Pioche Compas",
    "tool",
    1,
    0,
    "Outil de terrain fiable",
    "#f4b860",
    "#63402f",
    "⌖",
  );
  item(
    "tool-marteau",
    "Marteau Corail",
    "tool",
    2,
    550,
    "Pour bâtir avec panache",
    "#fb7185",
    "#7f1d3a",
    "⚒",
  );
  item(
    "tool-lame",
    "Lame de Brume",
    "tool",
    3,
    850,
    "Silencieuse et précise",
    "#8ee3ef",
    "#183b56",
    "╱",
  );
  item(
    "glider-alize",
    "Aile Alizée",
    "glider",
    1,
    0,
    "Déploiement souple et rapide",
    "#ffca7a",
    "#248ea1",
    "⌄",
  );
  item(
    "glider-raie",
    "Raie Volante",
    "glider",
    2,
    600,
    "Plane au-dessus des lagons",
    "#3dd6c6",
    "#12506b",
    "◁",
  );
  item(
    "glider-constellation",
    "Constellation",
    "glider",
    3,
    1000,
    "Une carte du ciel déployée",
    "#9b8cff",
    "#24205a",
    "✣",
  );
  item(
    "emote-salut",
    "Salut du large",
    "emote",
    1,
    0,
    "Un signe amical",
    "#ffd166",
    "#ef476f",
    "👋",
  );
  item(
    "emote-boussole",
    "Tour de boussole",
    "emote",
    2,
    350,
    "Toujours retrouver le nord",
    "#7dd3fc",
    "#2563eb",
    "◎",
  );
  item(
    "emote-victoire",
    "Victoire solaire",
    "emote",
    3,
    700,
    "Le soleil se lève pour vous",
    "#facc15",
    "#f97316",
    "★",
  );
  item(
    "loading-horizon",
    "Horizon corail",
    "loading",
    1,
    250,
    "Un nouveau rivage à découvrir",
    "#fb7185",
    "#0f3557",
    "▤",
  );
  item(
    "loading-etoile",
    "Carte étoilée",
    "loading",
    2,
    450,
    "Tracer sa route",
    "#a78bfa",
    "#172554",
    "✦",
  );
  item(
    "banner-vigie",
    "Bannière Vigie",
    "banner",
    1,
    200,
    "La tour garde l île",
    "#38bdf8",
    "#fbbf24",
    "⚑",
  );
  item(
    "banner-explorateur",
    "Bannière Explorateur",
    "banner",
    2,
    500,
    "Partir sans laisser de trace",
    "#34d399",
    "#164e63",
    "⚑",
  );
  item(
    "music-ecume",
    "Écume du matin",
    "music",
    1,
    300,
    "Ambiance calme avant la tempête",
    "#67e8f9",
    "#164e63",
    "♫",
  );
  item(
    "music-tempete",
    "Rythme de la tempête",
    "music",
    2,
    600,
    "Battements de la dernière zone",
    "#fb7185",
    "#3b0a20",
    "♫",
  );
  item(
    "pack-vigie",
    "Pack de la Vigie",
    "pack",
    2,
    1000,
    "Ensemble de départ amélioré",
    "#fbbf24",
    "#1e3a5f",
    "▦",
    { contents: ["back-voile", "banner-vigie", "loading-horizon"] },
  );
  item(
    "pack-alize",
    "Pack Alizé",
    "pack",
    3,
    1600,
    "Tout pour prendre le vent",
    "#67e8f9",
    "#164e63",
    "▦",
    { contents: ["glider-raie", "tool-marteau", "emote-boussole"] },
  );
  item("char-onyx","Onyx, sentinelle","character",3,950,"Une lueur dans la nuit","#5965a5","#76efff","✦");
  item("char-faille","Faille, éclaireuse du vide","character",4,0,"Offerte pour l’événement The End","#1f3354","#7ff3ff","✧",{ palette: "rift", model: "scout" });
  item("char-midas","Midas, le roi d’or","character",4,0,"Tout ce qu’il touche se change en or","#4a2370","#ffd34d","♛",{ palette: "midas", model: "scout" });
  // Extension 0.4: additional original silhouettes and cosmetic slots.
  [
    ["char-corail", "Corail, plongeuse", 2, 720, "Éclaireuse des récifs", "#f9738f", "#ffe0d0", "coral", "char-ambre", "⌁"],
    ["char-brume", "Brume, messagère", 2, 760, "Toujours un pas d avance", "#9b8cff", "#e8e4ff", "mist", "char-azur", "◌"],
    ["char-iroise", "Iroise, vigie", 3, 980, "Veilleuse des falaises", "#4fd1c5", "#d9fff8", "iris", "char-sauge", "◈"],
    ["char-silex", "Silex, pisteur", 2, 680, "Traceur des terres rouges", "#d97745", "#ffe0a8", "flint", "char-cuivre", "▲"],
    ["char-lumen", "Lumen, signaleuse", 3, 1050, "Un phare dans la brume", "#facc15", "#fff8c2", "lumen", "char-azur", "✹"],
    ["char-mistral", "Mistral, voltigeur", 2, 820, "Court après les rafales", "#60a5fa", "#e0f2fe", "mistral", "char-ambre", "↝"],
    ["char-argile", "Argile, bâtisseuse", 2, 740, "Façonne des refuges solides", "#c08457", "#fff0d6", "clay", "char-cuivre", "◫"],
    ["char-aster", "Astér, observatrice", 3, 1150, "Lit les constellations", "#818cf8", "#ede9fe", "aster", "char-onyx", "✦"],
    ["char-ecume", "Écume, sauveteuse", 2, 790, "Secours en eaux vives", "#22d3ee", "#cffafe", "foam", "char-nacre", "≈"],
    ["char-lichen", "Lichen, éclaireur", 3, 1020, "Discret parmi les jardins", "#84cc16", "#ecfccb", "lichen", "char-sauge", "❖"]
  ].forEach(function (a) { item(a[0], a[1], "character", a[2], a[3], a[4], a[5], a[6], a[9], { palette: a[7], model: a[8], headwear: ["corail", "brume", "lumen", "lichen"].indexOf(a[7]) >= 0 ? "headwear-" + a[7] : null }); });
  [
    ["headwear-corail", "Casquette Corail", 1, 240, "Une visière de terrain", "#fb7185", "#7f1d3a", "▰"],
    ["headwear-brume", "Capuche Brume", 2, 420, "Silhouette légère", "#a78bfa", "#312e81", "⌂"],
    ["headwear-lumen", "Visière Lumen", 3, 650, "Repères lumineux", "#fde047", "#713f12", "◉"],
    ["headwear-lichen", "Bonnet Lichen", 2, 380, "Confort des sous-bois", "#84cc16", "#365314", "⌒"]
  ].forEach(function (a) { item(a[0], a[1], "headwear", a[2], a[3], a[4], a[5], a[6], a[7]); });
  item("wrap-corail", "Enveloppe Corail", "wrap", 1, 180, "Teinte douce pour vos armes", "#fb7185", "#3b1020", "▥");
  item("wrap-azur", "Enveloppe Azur", "wrap", 2, 360, "Reflet marin sur le métal", "#38bdf8", "#082f49", "▥");
  item("wrap-nocturne", "Enveloppe Nocturne", "wrap", 3, 600, "Finition mate pour la nuit", "#6366f1", "#1e1b4b", "▥");
  item("tool-piolet", "Piolet des Crêtes", "tool", 2, 620, "Pour les reliefs escarpés", "#f59e0b", "#451a03", "⟂");
  item("glider-voilure", "Voilure Boréale", "glider", 3, 980, "Un arc dans le ciel", "#818cf8", "#1e1b4b", "⌄");
  item("back-balise", "Balise Nomade", "back", 2, 580, "Marque le chemin du retour", "#34d399", "#064e3b", "⌾");
  item("emote-signal", "Signal de Vigie", "emote", 2, 390, "Un geste visible de loin", "#fbbf24", "#78350f", "⚑");
  // 0.6 original expedition collection: these are data-only local cosmetics.
  item("loading-abysses", "Abysses luminescents", "loading", 3, 640, "Des balises descendent sous le courant", "#2dd4bf", "#082f49", "▤");
  item("loading-vigie", "Journal de la Vigie", "loading", 2, 390, "Les routes de l’archipel consignées à la main", "#fbbf24", "#78350f", "▤");
  item("banner-archipel", "Bannière Archipel", "banner", 3, 720, "Cent îles, une même ligne d’horizon", "#a78bfa", "#312e81", "⚑");
  item("banner-recif", "Bannière Récif", "banner", 2, 410, "Le courant indique le passage", "#fb7185", "#4c0519", "⚑");
  item("music-luciole", "Lucioles de marée", "music", 3, 690, "Une boucle nocturne originale pour le lobby", "#c4b5fd", "#312e81", "♫");
  item("music-courant", "Courant clair", "music", 2, 430, "Un rythme léger pour préparer l’expédition", "#67e8f9", "#164e63", "♫");
  item("emote-bonjour", "Balise levée", "emote", 1, 160, "Un salut visible depuis la grève", "#fde68a", "#92400e", "⚑");
  item("wrap-topaze", "Enveloppe Topaze", "wrap", 2, 420, "Des éclats minéraux sous le soleil", "#fbbf24", "#713f12", "▥");
  var catalog = C;
  var byId = function (id) {
    return catalog.find(function (x) {
      return x.id === id;
    });
  };
  var quests = [
    { id: "q-coffres", name: "Fouille méthodique", category: "Quotidienne", metric: "chests", target: 3, xp: 280 },
    { id: "q-degats", name: "Tenir la ligne", category: "Quotidienne", metric: "damage", target: 500, xp: 340 },
    { id: "q-distance", name: "L horizon est vaste", category: "Quotidienne", metric: "distance", target: 2500, xp: 280 },
    { id: "q-collecte", name: "Récolte côtière", category: "Quotidienne", metric: "gathered", target: 40, xp: 280 },
    { id: "q-construction", name: "Bâtisseur du rivage", category: "Quotidienne", metric: "built", target: 8, xp: 340 },
    { id: "q-survie", name: "Rester à flot", category: "Quotidienne", metric: "duration", target: 900, xp: 360 },
    { id: "q-armes", name: "Prise en main", category: "Quotidienne", metric: "weaponUses", target: 60, xp: 320 },
    { id: "q-pilleur", name: "Pilleur confirmé", category: "Quotidienne", metric: "chests", target: 8, xp: 320 },
    { id: "q-chasse", name: "Duel des vigies", category: "Hebdomadaire", metric: "kills", target: 10, xp: 900 },
    { id: "q-voyage", name: "Longue traversée", category: "Hebdomadaire", metric: "distance", target: 12000, xp: 980 },
    { id: "q-expeditions", name: "Carnet de bord", category: "Hebdomadaire", metric: "matches", target: 8, xp: 1050 },
    { id: "q-victoires", name: "Couronne de corail", category: "Hebdomadaire", metric: "wins", target: 2, xp: 1350 },
    { id: "q-carnage", name: "Tempête du rivage", category: "Hebdomadaire", metric: "kills", target: 25, xp: 1300 },
    { id: "q-assaut", name: "Assaut dévastateur", category: "Hebdomadaire", metric: "damage", target: 8000, xp: 1200 },
    { id: "q-marathon", name: "Marathonien", category: "Hebdomadaire", metric: "duration", target: 3600, xp: 1100 },
    { id: "q-esprit", name: "Esprit d équipage", category: "Hebdomadaire", metric: "revived", target: 3, xp: 1000 },
    { id: "q-regions", name: "Toutes les couleurs", category: "Spéciale", metric: "regions", target: 7, xp: 750 }
  ];
  var questsById = function (id) {
    return quests.find(function (q) {
      return q.id === id;
    });
  };
  // The pass is data-driven: every tier exists, with varied rewards rather than
  // a short list repeated by the UI. Starter equipment is deliberately excluded.
  var starterRewardIds = {
    "char-ambre": 1, "variant-aube": 1, "back-sac": 1, "tool-compas": 1,
    "glider-alize": 1, "emote-salut": 1, "loading-horizon": 1,
    "banner-vigie": 1, "music-ecume": 1,
  };
  var rewardItems = catalog.filter(function (x) {
    return x.type !== "pack" && !starterRewardIds[x.id];
  });
  function rewardItem(index, label) {
    var x = rewardItems[index % rewardItems.length];
    return { kind: "item", itemId: x.id, name: label + " · " + x.name };
  }
  var rewards = [];
  for (var tier = 1; tier <= 100; tier++) {
    var isMilestone = tier % 10 === 0;
    var free = tier % 5 === 0
      ? rewardItem((tier / 5 - 1) * 2, "Cosmétique libre")
      : { kind: "coins", amount: 150 + ((tier - 1) % 5) * 40, name: "Écus de corail" };
    // v21 : chaque palier jalon (10, 20, …, 100) ajoute un bonus d'écus au-dessus de la récompense normale.
    if (isMilestone) free.bonusCoins = tier === 100 ? 1000 : 600;
    var premiumTier = tier % 3 === 0 || tier % 5 === 0;
    var premium = premiumTier
      ? rewardItem(tier * 3 + Math.floor(tier / 5), "Cosmétique premium")
      : { kind: "coins", amount: 350 + ((tier - 1) % 5) * 100, name: "Prime azur" };
    rewards.push({ tier: tier, free: free, premium: premium, milestone: isMilestone });
  }
  function finite(n, fallback) {
    return Number.isFinite(Number(n)) ? Number(n) : fallback;
  }
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function cleanIds(a) {
    return Array.from(
      new Set(
        (Array.isArray(a) ? a : []).filter(function (id) {
          return !!byId(id);
        }),
      ),
    );
  }
  var defaultSettings = {
    quality: (typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || ""))) ? "medium" : "high",
    music: 0.25,
    sfx: 0.65,
    sensitivity: 1,
    shadows: true,
    hud: 1,
    fps: true,
    performance: true,
    assist: true,
    layout: "azerty",
    invertY: false,
    touch: false,
    daylight: "day",
  };
  function stringValue(v, fallback, limit) {
    return typeof v === "string" && v.trim() ? v.trim().slice(0, limit || 120) : fallback;
  }
  function safeMode(v) {
    return ["solo", "duo", "squad", "training", "creative"].indexOf(v) >= 0 ? v : "solo";
  }
  function isTraining(mode) { return mode === "training" || mode === "creative"; }
  function noticeId() { return "note-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
  function pushNotice(p, data) {
    var d = data && typeof data === "object" ? data : {};
    var n = Object.assign({}, d, {
      id: stringValue(d.id, noticeId(), 100),
      title: stringValue(d.title, "Expédition", 80),
      message: stringValue(d.message, "Mise à jour de votre profil.", 220),
      type: stringValue(d.type, "info", 24),
      date: stringValue(d.date, new Date().toISOString(), 40),
      read: d.read === true
    });
    p.notifications = (Array.isArray(p.notifications) ? p.notifications : []).filter(function (x) { return x.id !== n.id; });
    p.notifications.push(n);
    p.notifications = p.notifications.slice(-60);
    return n;
  }
  function normalize(p) {
    p = p && typeof p === "object" ? p : {};
    var out = p, oldDaily = p.lastDaily, oldWeekly = p.lastWeekly, sourceCheckpoints = p.matchCheckpoints;
    out.version = 2;
    out.migrations = Object.assign({}, p.migrations && typeof p.migrations === "object" ? p.migrations : {});
    out.name = stringValue(p.name, "Pilote", 24);
    out.xp = clamp(Math.floor(finite(p.xp, 0)), 0, 100000000);
    out.coins = clamp(Math.floor(finite(p.coins, 1200)), 0, 100000000);
    out.premium = p.premium === true;
    out.owned = cleanIds(p.owned);
    ["char-ambre", "variant-aube", "back-sac", "tool-compas", "glider-alize", "emote-salut", "loading-horizon", "banner-vigie", "music-ecume", "char-faille", "char-midas"].forEach(function (id) { if (!out.owned.includes(id)) out.owned.push(id); });
    if (!out.migrations.starter040) {
      ["char-corail", "char-brume", "tool-piolet"].forEach(function (id) { if (!out.owned.includes(id)) out.owned.push(id); });
      out.migrations.starter040 = true;
    }
    // A one-time cosmetic welcome, deliberately not a repeatable currency source.
    if (!out.migrations.welcome060) {
      ["banner-recif", "loading-vigie", "emote-bonjour"].forEach(function (id) { if (!out.owned.includes(id)) out.owned.push(id); });
      out.migrations.welcome060 = true;
    }
    var defaults = { character:"char-ambre", variant:"variant-aube", back:"back-sac", tool:"tool-compas", glider:"glider-alize", emote:"emote-salut", loading:"loading-horizon", banner:"banner-vigie", music:"music-ecume" };
    var eq = Object.assign({}, defaults, p.equipment && typeof p.equipment === "object" ? p.equipment : {});
    Object.keys(eq).forEach(function (k) {
      var x = byId(eq[k]);
      if (typeof eq[k] !== "string" || !x || x.type !== k || !out.owned.includes(eq[k])) {
        if (defaults[k] && out.owned.includes(defaults[k])) eq[k] = defaults[k]; else delete eq[k];
      }
    });
    // v65 : la nouvelle éclaireuse Faille est équipée une seule fois à la mise à jour (rééquipable librement ensuite).
    if (!out.migrations.faille065) { eq.character = "char-faille"; delete eq.variant; if (out.owned.includes(defaults.variant)) eq.variant = defaults.variant; out.migrations.faille065 = true; }
    // v67 : Midas, le roi d’or, est équipé une seule fois à la mise à jour.
    if (!out.migrations.midas067) { eq.character = "char-midas"; out.migrations.midas067 = true; }
    out.equipment = eq;
    function tierList(a) { return Array.from(new Set((Array.isArray(a) ? a : []).filter(function (x) { return Number.isInteger(Number(x)) && +x >= 1 && +x <= 100; }).map(Number))); }
    out.claimed = tierList(p.claimed);
    out.premiumClaimed = Array.from(new Set(tierList(p.premiumClaimed).concat((Array.isArray(p.history) ? p.history : []).filter(function (h) { return h && h.type === "premium-reward"; }).map(function (h) { return Number(h.tier); }).filter(function (n) { return n >= 1 && n <= 100; }))));
    var qp = p.questProgress && typeof p.questProgress === "object" ? Object.assign({}, p.questProgress) : {};
    out.questProgress = {};
    Object.keys(qp).forEach(function (id) { out.questProgress[id] = Math.max(0, Math.floor(finite(qp[id], 0))); });
    quests.forEach(function (q) { out.questProgress[q.id] = clamp(out.questProgress[q.id] || 0, 0, q.target); });
    out.questClaimed = Array.from(new Set((Array.isArray(p.questClaimed) ? p.questClaimed : []).filter(function (id) { return typeof id === "string"; })));
    out.stats = Object.assign({ matches:0, wins:0, kills:0, best:0, time:0 }, p.stats && typeof p.stats === "object" ? p.stats : {});
    ["matches", "wins", "kills", "best", "time"].forEach(function (k) { out.stats[k] = Math.max(0, Math.floor(finite(out.stats[k], 0))); });
    out.stats.byMode = Object.assign({}, p.stats && p.stats.byMode && typeof p.stats.byMode === "object" ? p.stats.byMode : {});
    ["solo", "duo", "squad", "training", "creative"].forEach(function (m) { var ms = Object.assign({ matches:0, wins:0, kills:0, best:0, time:0 }, out.stats.byMode[m] || {}); Object.keys(ms).forEach(function (k) { ms[k] = Math.max(0, Math.floor(finite(ms[k], 0))); }); out.stats.byMode[m] = ms; });
    out.history = Array.isArray(p.history) ? p.history.filter(function (x) { return x && typeof x === "object" && typeof x.id === "string"; }).slice(-200) : [];
    out.matchCheckpoints = {};
    var cps = sourceCheckpoints && typeof sourceCheckpoints === "object" ? sourceCheckpoints : {};
    Object.keys(cps).slice(-200).forEach(function (id) { var c = cps[id]; if (typeof id !== "string" || !c || typeof c !== "object") return; var counters = c.counters && typeof c.counters === "object" ? c.counters : {}; var safe = {}; Object.keys(counters).forEach(function (k) { safe[k] = Math.max(0, Math.floor(finite(counters[k], 0))); }); out.matchCheckpoints[id] = { counters:safe, mode:safeMode(c.mode), date:stringValue(c.date, DAY(), 20) }; });
    out.notifications = (Array.isArray(p.notifications) ? p.notifications : []).filter(function (n) { return n && typeof n === "object"; }).slice(-60).map(function (n) { return { id:stringValue(n.id, noticeId(), 100), title:stringValue(n.title, "Expédition", 80), message:stringValue(n.message, "", 220), type:stringValue(n.type, "info", 24), date:stringValue(n.date, new Date().toISOString(), 40), read:n.read === true }; });
    out.settings = Object.assign({}, defaultSettings, p.settings && typeof p.settings === "object" ? p.settings : {});
    out.settings.music = clamp(finite(out.settings.music, .25), 0, 1); out.settings.sfx = clamp(finite(out.settings.sfx, .65), 0, 1); out.settings.sensitivity = clamp(finite(out.settings.sensitivity, 1), .1, 3); out.settings.hud = clamp(finite(out.settings.hud, 1), .5, 2);
    if (["low", "medium", "high", "ultra"].indexOf(out.settings.quality) < 0) out.settings.quality = "medium";
    if (["azerty", "qwerty"].indexOf(out.settings.layout) < 0) out.settings.layout = "azerty";
    out.lastDaily = typeof p.lastDaily === "string" && /^\d{4}-\d\d-\d\d$/.test(p.lastDaily) ? p.lastDaily : "";
    out.lastWeekly = typeof p.lastWeekly === "string" && /^\d{4}-\d\d-\d\d$/.test(p.lastWeekly) ? p.lastWeekly : "";
    var d = DAY(), w = WEEK(), periodChanged = false;
    if (out.lastDaily !== d) { quests.filter(function(q){ return q.category === "Quotidienne"; }).forEach(function(q){ out.questProgress[q.id] = 0; out.questClaimed = out.questClaimed.filter(function(id){ return id !== q.id; }); }); out.lastDaily = d; periodChanged = !!oldDaily; }
    if (out.lastWeekly !== w) { quests.filter(function(q){ return q.category === "Hebdomadaire"; }).forEach(function(q){ out.questProgress[q.id] = 0; out.questClaimed = out.questClaimed.filter(function(id){ return id !== q.id; }); }); out.lastWeekly = w; periodChanged = periodChanged || !!oldWeekly; }
    // Cumulative counters from a prior quest period cannot be replayed in a new period.
    if (periodChanged) out.matchCheckpoints = {};
    return out;
  }
  function createDefault() {
    return normalize({
      name: "Pilote",
      coins: 1200,
      owned: [
        "char-ambre",
        "variant-aube",
        "back-sac",
        "tool-compas",
        "glider-alize",
        "emote-salut",
        "loading-horizon",
        "banner-vigie",
        "music-ecume",
        "char-corail",
        "char-brume",
        "tool-piolet",
      ],
    });
  }
  function level(p) {
    return Math.min(100, Math.floor(normalize(p).xp / 1000) + 1);
  }
  function xpProgress(p) {
    var x = normalize(p).xp,
      l = level({ xp: x });
    return {
      level: l,
      current: l >= 100 ? 0 : x % 1000,
      needed: l >= 100 ? 0 : 1000,
      percent: l >= 100 ? 1 : (x % 1000) / 1000,
      total: x,
    };
  }
  function result(ok, message, item) {
    var r = { ok: ok, message: message };
    if (item) r.item = item;
    return r;
  }
  function purchase(p, id) {
    p = normalize(p);
    var x = byId(id);
    if (!x) return result(false, "Article introuvable.");
    if (p.owned.indexOf(id) >= 0)
      return result(false, "Vous possédez déjà cet article.");
    if (x.price < 0 || p.coins < x.price)
      return result(false, "Fonds insuffisants.");
    if (x.type === "pack") {
      var contents = (x.contents || []).filter(function (i) {
        return byId(i) && p.owned.indexOf(i) < 0;
      });
      p.coins -= x.price;
      contents.forEach(function (i) {
        p.owned.push(i);
      });
      p.owned.push(id);
      return result(true, "Pack acquis.", x);
    }
    p.coins -= x.price;
    p.owned.push(id);
    return result(true, "Article acquis.", x);
  }
  function equip(p, id) {
    p = normalize(p);
    var x = byId(id);
    if (!x || p.owned.indexOf(id) < 0)
      return result(false, "Article non disponible.");
    if (x.type === "pack")
      return result(false, "Un pack ne peut pas être équipé.");
    p.equipment[x.type] = id;
    return result(true, "Équipement mis à jour.", x);
  }
  function claim(p, t, premium) {
    p = normalize(p);
    var r = rewards.find(function (x) {
      return x.tier === Number(t);
    });
    if (!r || r.tier > level(p))
      return result(false, "Ce palier est encore verrouillé.");
    if (premium === true && !p.premium)
      return result(false, "Passe premium requis.");
    var list = premium ? p.premiumClaimed : p.claimed;
    if (list.indexOf(r.tier) >= 0)
      return result(false, "Récompense déjà réclamée.");
    var rw = r[premium ? "premium" : "free"];
    if (rw.kind === "coins") p.coins = clamp(p.coins + rw.amount, 0, 100000000);
    else if (byId(rw.itemId) && p.owned.indexOf(rw.itemId) < 0)
      p.owned.push(rw.itemId);
    else if (rw.kind === "item") p.coins += 75;
    // v21 : bonus de palier jalon, versé en plus de la récompense normale (idempotent : le palier reste marqué réclamé une seule fois).
    if (rw.bonusCoins) p.coins = clamp(p.coins + rw.bonusCoins, 0, 100000000);
    list.push(r.tier);
    return result(true, "Récompense ajoutée à votre collection.", rw);
  }
  function claimAll(p) {
    // v19 : réclame d'un coup toutes les récompenses de passe débloquées (voie libre + premium si actif).
    p = normalize(p);
    var lvl = level(p), claimed = [], coins = 0, items = [];
    rewards.forEach(function (r) {
      if (r.tier > lvl) return;
      [["free", false], ["premium", true]].forEach(function (pair) {
        var key = pair[0], premium = pair[1];
        if (premium && !p.premium) return;
        var list = premium ? p.premiumClaimed : p.claimed;
        if (list.indexOf(r.tier) >= 0) return;
        var rw = r[key];
        if (rw.kind === "coins") { p.coins = clamp(p.coins + rw.amount, 0, 100000000); coins += rw.amount; }
        else if (byId(rw.itemId) && p.owned.indexOf(rw.itemId) < 0) { p.owned.push(rw.itemId); items.push(rw.itemId); }
        else if (rw.kind === "item") { p.coins = clamp(p.coins + 75, 0, 100000000); coins += 75; }
        if (rw.bonusCoins) { p.coins = clamp(p.coins + rw.bonusCoins, 0, 100000000); coins += rw.bonusCoins; }
        list.push(r.tier);
        claimed.push({ tier: r.tier, premium: premium, reward: rw });
      });
    });
    return { ok: claimed.length > 0, claimed: claimed, coins: coins, items: items, message: claimed.length ? claimed.length + " récompense(s) réclamée(s)." : "Aucune récompense à réclamer.", profile: p };
  }
  function buyPremium(p) {
    p = normalize(p);
    if (p.premium) return result(false, "Passe déjà actif.");
    if (p.coins < 800) return result(false, "Fonds insuffisants.");
    p.coins -= 800;
    p.premium = true;
    return result(true, "Passe premium activé.");
  }
  function setName(p, name) {
    p = normalize(p);
    if (typeof name !== "string" || !name.trim())
      return result(false, "Nom invalide.");
    p.name = name.trim().slice(0, 24);
    return result(true, "Nom mis à jour.");
  }
  function matchCounters(res) {
    var source = Object.assign({}, res || {}, res && res.metrics && typeof res.metrics === "object" ? res.metrics : {}, res && res.counters && typeof res.counters === "object" ? res.counters : {});
    function number(k, aliases, whole) { var v = source[k]; (aliases || []).some(function(a){ if (v == null) v = source[a]; return v != null; }); v = Math.max(0, finite(v, 0)); return whole ? Math.floor(v) : Math.floor(v); }
    return { matches:number("matches", [], true) || 1, wins:source.won === true || source.wins > 0 ? 1 : 0, kills:number("kills", [], true), damage:number("damage"), distance:number("distance"), chests:number("chests", [], true), gathered:number("gathered", [], true), built:number("built", [], true), regions:number("regions", [], true), duration:number("duration", ["survivalDuration", "surviveDuration"]), weaponUses:number("weaponUses", ["weaponUsage", "weaponsUsed", "shots"], true), revived:number("revived", ["timesRevived"], true), bestStreak:number("bestStreak", ["killStreak", "streak"], true) };
  }
  function emptyGain(p, duplicate) { return { xp:0, completed:[], coins:0, breakdown:[], levelBefore:level(p), levelAfter:level(p), duplicate:!!duplicate, profile:p }; }
  function awardQuestDeltas(p, vals) {
    var gain = 0, completed = [];
    quests.forEach(function(q) { var delta = Math.max(0, Math.floor(finite(vals[q.metric], 0))); if (!delta) return; var old = clamp(Math.floor(finite(p.questProgress[q.id], 0)), 0, q.target); var next = clamp(old + delta, 0, q.target); p.questProgress[q.id] = next; if (old < q.target && next >= q.target && !p.questClaimed.includes(q.id)) { p.questClaimed.push(q.id); gain += q.xp; completed.push(q.id); pushNotice(p, { id:"quest-" + q.id + "-" + p.lastDaily + "-" + p.lastWeekly, title:"Quête terminée", message:q.name + " · +" + q.xp + " XP", type:"quest" }); } });
    return { xp:gain, completed:completed };
  }
  function counterDelta(full, previous) { var out = {}; Object.keys(full).forEach(function(k) { out[k] = Math.max(0, (full[k] || 0) - Math.max(0, finite((previous || {})[k], 0))); }); return out; }
  function checkpointMatch(p, res) {
    p = normalize(p); res = res && typeof res === "object" ? res : {};
    var id = typeof res.id === "string" ? res.id.slice(0, 140) : "", mode = safeMode(res.mode);
    if (!id || isTraining(mode) || p.history.some(function(h){ return h.id === id; })) return emptyGain(p, true);
    var before = level(p), full = matchCounters(res), cp = p.matchCheckpoints[id];
    if (cp && cp.mode !== mode) cp = null;
    var delta = counterDelta(full, cp && cp.counters), award = awardQuestDeltas(p, delta);
    p.xp = clamp(p.xp + award.xp, 0, 100000000);
    var stored = Object.assign({}, cp && cp.counters || {}); Object.keys(full).forEach(function(k){ stored[k] = Math.max(Math.floor(finite(stored[k], 0)), full[k]); });
    p.matchCheckpoints[id] = { counters:stored, mode:mode, date:DAY() };
    return { xp:award.xp, completed:award.completed, coins:0, breakdown:[], levelBefore:before, levelAfter:level(p), duplicate:award.xp === 0 && award.completed.length === 0, profile:p };
  }
  function applyMatch(p, res) {
    p = normalize(p); res = res && typeof res === "object" ? res : {};
    var id = typeof res.id === "string" ? res.id.slice(0, 140) : "";
    if (!id || p.history.some(function(h){ return h.id === id; })) return emptyGain(p, true);
    var mode = safeMode(res.mode), before = level(p), gain = 0, completed = [], full = matchCounters(res), cp = p.matchCheckpoints[id];
    var coinsEarned = 0, breakdown = [];
    if (!isTraining(mode)) {
      var award = awardQuestDeltas(p, counterDelta(full, cp && cp.counters)); gain += award.xp; completed = award.completed;
      var rank = clamp(Math.floor(finite(res.rank, 100)), 1, 100);
      // v21 : gains encore plus généreux et variés — participation, éliminations, défis de match
      // (exploits ponctuels), placement élargi, survie, butin, dégâts et récompenses de niveau.
      // Le détail ligne par ligne est affiché à l'écran de fin.
      breakdown = [{ label: "🎯 Participation", xp: 200, coins: 40 }];
      if (full.kills > 0) breakdown.push({ label: "⚔️ Éliminations × " + full.kills, xp: full.kills * 50, coins: full.kills * 20 });
      if (full.kills >= 10) breakdown.push({ label: "🔥 Légende du rivage · 10+ éliminations", xp: 600, coins: 200 });
      else if (full.kills >= 5) breakdown.push({ label: "⚡ Carnage · 5+ éliminations", xp: 300, coins: 100 });
      if (res.won === true && full.kills === 0) breakdown.push({ label: "🕊️ Pacifiste couronné · victoire sans élimination", xp: 300, coins: 100 });
      if (full.damage >= 2000) breakdown.push({ label: "💥 Assaut dévastateur · 2000+ dégâts", xp: 250, coins: 60 });
      if (full.revived > 0) breakdown.push({ label: "🤝 Esprit d'équipage × " + full.revived, xp: full.revived * 100, coins: full.revived * 30 });
      if (full.chests >= 6) breakdown.push({ label: "🗝️ Pilleur de l'archipel · 6+ coffres", xp: 120, coins: 50 });
      if (full.duration >= 900) breakdown.push({ label: "🏃 Marathonien des horizons · 15+ min", xp: 150, coins: 40 });
      if (full.bestStreak >= 8) breakdown.push({ label: "⚔️ Série légendaire × " + full.bestStreak, xp: 800, coins: 200 });
      else if (full.bestStreak >= 5) breakdown.push({ label: "⚔️ Série héroïque × " + full.bestStreak, xp: 400, coins: 100 });
      else if (full.bestStreak >= 3) breakdown.push({ label: "⚔️ Série d'éliminations × " + full.bestStreak, xp: 150, coins: 50 });
      if (res.won === true) breakdown.push({ label: "👑 Victoire · Top 1", xp: 800, coins: 300 });
      else if (rank <= 3) breakdown.push({ label: "🥈 Top 3", xp: 400, coins: 120 });
      else if (rank <= 10) breakdown.push({ label: "🥉 Top 10", xp: 200, coins: 60 });
      else if (rank <= 25) breakdown.push({ label: "🎖️ Top 25", xp: 100, coins: 25 });
      var minutes = Math.floor(full.duration / 60);
      if (minutes > 0) breakdown.push({ label: "⏱️ Survie · " + minutes + " min", xp: 0, coins: minutes * 8 });
      if (full.duration >= 600) breakdown.push({ label: "🛡️ Survivant endurci · 10+ min", xp: 200, coins: 0 });
      if (full.chests > 0) breakdown.push({ label: "🧰 Coffres ouverts × " + full.chests, xp: 0, coins: full.chests * 8 });
      var dmgXp = Math.min(300, Math.floor(full.damage / 500) * 25);
      if (dmgXp > 0) breakdown.push({ label: "💢 Dégâts infligés · " + full.damage, xp: dmgXp, coins: 0 });
      var rawXp = 0, biggest = breakdown[0];
      breakdown.forEach(function (e) { rawXp += e.xp || 0; if ((e.xp || 0) > (biggest.xp || 0)) biggest = e; });
      var perfXp = Math.min(4000, rawXp);
      if (rawXp > perfXp) biggest.xp = Math.max(0, (biggest.xp || 0) - (rawXp - perfXp));
      gain += perfXp;
      // v21 : récompense de progression — 150 écus par niveau gagné grâce à ce match.
      // Idempotent : le match n'est comptabilisé qu'une fois (dédupliqué par son id).
      var lvlAfter = Math.min(100, Math.floor(clamp(p.xp + gain, 0, 100000000) / 1000) + 1);
      for (var nl = before + 1; nl <= lvlAfter; nl++) breakdown.push({ label: "⭐ Niveau " + nl + " atteint", xp: 0, coins: 150 });
      coinsEarned = 0;
      breakdown.forEach(function (e) { coinsEarned += e.coins || 0; });
      p.coins = clamp(p.coins + coinsEarned, 0, 100000000);
      p.stats.matches++; p.stats.wins += full.wins; p.stats.kills += full.kills;
      p.stats.best = p.stats.best ? Math.min(p.stats.best, rank) : rank; p.stats.time += full.duration;
      var ms = p.stats.byMode[mode]; ms.matches++; ms.wins += full.wins; ms.kills += full.kills; ms.time += full.duration; ms.best = ms.best ? Math.min(ms.best, rank) : rank;
    }
    delete p.matchCheckpoints[id];
    p.history.push({ id:id, type:"match", mode:mode, date:stringValue(res.date || res.endedAt || res.finishedAt, new Date().toISOString(), 40), duration:full.duration, kills:full.kills, rank:clamp(Math.floor(finite(res.rank, 100)), 1, 100), won:res.won === true, xp:gain, coins:coinsEarned, result:Object.assign({}, res) });
    if (p.history.length > 200) p.history = p.history.slice(-200);
    p.xp = clamp(p.xp + gain, 0, 100000000);
    if (gain || completed.length) pushNotice(p, { id:"match-" + id, title:"Résultat enregistré", message:"+" + gain + " XP · " + full.kills + " élimination" + (full.kills > 1 ? "s" : "") + (coinsEarned ? " · +" + coinsEarned + " écus" : ""), type:"match" });
    return { xp:gain, coins:coinsEarned, breakdown:breakdown, completed:completed, levelBefore:before, levelAfter:level(p), duplicate:false, profile:p };
  }
  function notify(p, data) { p = normalize(p); var n = pushNotice(p, data); return { ok:true, notification:n, profile:p }; }
  function markNotificationsRead(p, id) { p = normalize(p); var count = 0; (p.notifications || []).forEach(function(n){ if (!id || n.id === id) { if (!n.read) count++; n.read = true; } }); return { ok:true, count:count, profile:p }; }
  return {
    createDefault: createDefault,
    normalize: normalize,
    catalog: catalog,
    quests: quests,
    questsById: questsById,
    rewards: rewards,
    level: level,
    xpProgress: xpProgress,
    purchase: purchase,
    equip: equip,
    claim: claim,
    claimAll: claimAll,
    buyPremium: buyPremium,
    applyMatch: applyMatch,
    checkpointMatch: checkpointMatch,
    notify: notify,
    markNotificationsRead: markNotificationsRead,
    setName: setName,
  };
});
