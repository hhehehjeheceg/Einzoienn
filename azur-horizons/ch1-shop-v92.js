/* AZUR v92 — ch1-shop-v92.js : boutique et casier "Chapitre 1".
 *
 * BOUTIQUE (onglet "shop") — page pleine largeur sous la barre d'onglets, fond bleu nuit / violet :
 *  - en-tête "BOUTIQUE" + date, compte à rebours "NOUVEAUX OBJETS DANS HH:MM:SS" (minuit local)
 *    et solde d'écus avec sa pièce ;
 *  - "EN VEDETTE" (2 grandes tuiles, des tenues) et "QUOTIDIEN" (6 tuiles en 3 × 2 : pioches,
 *    planeurs, sacs, émotes, revêtements), tirés chaque jour de façon déterministe (graine = date) ;
 *  - tuiles de rareté (peu commun vert, rare bleu, épique violet, légendaire orange) avec rayons
 *    de lumière, vignette 3D (chaîne existante .exp-cosmetic / [data-act=preview] / .exp-card-art),
 *    nom, type, prix et bandeau POSSÉDÉ ;
 *  - un clic ouvre la fiche de l'objet (grand aperçu, rareté, type, description, prix) avec
 *    ACHETER (flux existant data-act=purchase → confirm-purchase, écus locaux uniquement, refus
 *    clair si le solde ne suffit pas) ou ÉQUIPER si l'objet est possédé ;
 *  - plus bas, tout le catalogue filtrable (data-act=shop-filter conservé), vignettes paresseuses.
 *
 * CASIER (onglet "locker") — le personnage 3D reste à gauche (cadrage panel du menu) :
 *  - colonne d'emplacements : TENUE, SAC À DOS, PIOCHE, PLANEUR (+ TRAÎNÉE si le catalogue en a),
 *    STYLE / COIFFE, 6 ÉMOTES, REVÊTEMENT, ÉCRAN DE CHARGEMENT, MUSIQUE, BANNIÈRE ;
 *  - l'emplacement choisi (data-act=locker-filter conservé) ouvre à droite la grille des objets
 *    possédés : cadres de rareté, badge NOUVEAU (objets jamais survolés), coche sur l'objet porté ;
 *  - un clic équipe via le flux existant (data-act=equip) et l'aperçu 3D suit (selectedCosmetic).
 *    Les 6 émotes sont rangées dans profile.emoteSlots (la 1re reste equipment.emote).
 *
 * Cette couche enrobe AZPanels.render (onglets shop et locker uniquement, repli sur ui-v81 en cas
 * d'erreur), Horizons.prototype.action (nouveaux verbes ch1s-*, refus d'achat sans fonds) et
 * Horizons.prototype.renderMenu (mise en page, défilement conservé, badges, vignettes paresseuses).
 * Aucune somme réelle : les écus se gagnent en jouant. */
(function (root) {
  "use strict";
  const P = root.AZPanels;
  const M = root.AZMeta;
  const H = root.AZURHorizons;
  const doc = root.document;
  if (!P || typeof P.render !== "function" || !M || !H || !doc || H.prototype.__ch1Shop) return;
  const HP = H.prototype;
  HP.__ch1Shop = true;
  const TAG = "[AZUR ch1-shop]";

  /* ------------------------------------------------------------------ outils */
  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
  const byId = (id) => (id ? M.catalog.find((x) => x && x.id === id) : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = (n) => String(n).padStart(2, "0");

  const TYPE = {
    character: "Tenue",
    variant: "Style",
    back: "Sac à dos",
    tool: "Pioche",
    glider: "Planeur",
    contrail: "Traînée",
    emote: "Émote",
    wrap: "Revêtement",
    headwear: "Coiffe",
    loading: "Écran de chargement",
    music: "Musique du salon",
    banner: "Bannière",
    spray: "Tag",
    pack: "Pack",
  };
  const typeLabel = (t) => TYPE[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Objet");

  /* Raretés façon Chapitre 1. Le catalogue AZMeta note 1 à 4 ; un objet de rareté 1 vendu en
   * boutique s'affiche "peu commun" (vert), les objets de départ gratuits restent "commun" (gris).
   * Une couche peut aussi fixer x.rarityKey ("uncommon", "épique"…) ou x.rarity en texte. */
  const RARITY = {
    commun: "COMMUN",
    "peu-commun": "PEU COMMUN",
    rare: "RARE",
    epique: "ÉPIQUE",
    legendaire: "LÉGENDAIRE",
    mythique: "MYTHIQUE",
  };
  const RANK = { commun: 0, "peu-commun": 1, rare: 2, epique: 3, legendaire: 4, mythique: 5 };
  const ALIAS = {
    common: "commun",
    commun: "commun",
    uncommon: "peu-commun",
    "peu commun": "peu-commun",
    "peu-commun": "peu-commun",
    rare: "rare",
    epic: "epique",
    epique: "epique",
    "épique": "epique",
    legendary: "legendaire",
    legendaire: "legendaire",
    "légendaire": "legendaire",
    mythic: "mythique",
    mythique: "mythique",
  };
  function rarityKey(x) {
    if (!x) return "commun";
    const named = x.rarityKey || (typeof x.rarity === "string" ? x.rarity : "");
    if (named) {
      const k = ALIAS[String(named).toLowerCase().trim()];
      if (k) return k;
    }
    const n = Math.round(Number(x.rarity) || 0);
    if (n <= 0) return "commun";
    if (n === 1) return x.price > 0 ? "peu-commun" : "commun";
    return ["rare", "epique", "legendaire"][n - 2] || "mythique";
  }
  const rank = (x) => RANK[rarityKey(x)];

  /* Pièce d'écu originale (pas de logo de marque). */
  const COIN =
    '<svg class="ch1s-coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12.6" r="10.4" fill="#a45f00"/><circle cx="12" cy="11.4" r="10.2" fill="#ffbf1f"/>' +
    '<circle cx="12" cy="11.4" r="7.6" fill="#ffd94f" stroke="#e39800" stroke-width="1.3"/>' +
    '<path d="M12 6.1 16.6 11.4 12 16.7 7.4 11.4Z" fill="#fff4bf" stroke="#c78100" stroke-width="1.1" stroke-linejoin="round"/>' +
    '<path d="M12 8.7 14.3 11.4 12 14.1 9.7 11.4Z" fill="#eaa700"/></svg>';
  const coins = (n) => `<span class="ch1s-cost">${COIN}<b>${fmt(n)}</b></span>`;

  /* Silhouette de remplacement pendant que la vignette 3D se calcule. */
  const FIGURE =
    '<svg viewBox="0 0 64 100" aria-hidden="true" focusable="false"><circle cx="32" cy="15" r="10" fill="currentColor"/>' +
    '<path d="M17 29q15-6 30 0l6 31-8 2-3-20-1 56h-8l-1-30h-0.5l-1 30h-8l-1-56-3 20-8-2z" fill="currentColor"/></svg>';

  /* Types qui ont une vraie vignette WebGL (chaîne client.queuePanelThumbnails / view.renderOneThumbnail). */
  const THUMB = ["character", "variant", "back", "tool", "glider", "headwear", "wrap"];
  const LOADING_ART = {
    "loading-abysses": "./assets/loading-lagune-azur.svg",
    "loading-vigie": "./assets/loading-observatoire.svg",
    "loading-horizon": "./assets/loading-iles-corail.svg",
    "loading-etoile": "./assets/loading-observatoire.svg",
  };
  const hasThumb = (x) => !!x && (THUMB.includes(x.type) || x.type === "loading");

  function glyph(x) {
    let inner;
    if (x.type === "character" || x.type === "variant") inner = FIGURE;
    else if (root.AZIcons && typeof root.AZIcons.cosmetic === "function") inner = root.AZIcons.cosmetic(x);
    else inner = `<b>${esc(x.icon || "✦")}</b>`;
    return `<span class="ch1s-glyph" style="--c1:${esc(x.color || "#bfe9ff")};--c2:${esc(x.secondary || "#2b4f7a")}">${inner}</span>`;
  }
  /* Zone d'illustration. mode true : chaîne de vignettes du client (exige .exp-cosmetic sur la
   * carte parente) ; "lazy" : vignette créée quand la tuile entre à l'écran ; sinon : glyphe seul. */
  function artBox(x, mode, extra) {
    const pipe = mode === true && hasThumb(x);
    const lazy = mode === "lazy" && hasThumb(x);
    return (
      `<span class="ch1s-art${pipe ? " exp-card-art" : ""}${extra ? " " + extra : ""}"` +
      (pipe ? ` data-act="preview" data-id="${esc(x.id)}"` : "") +
      (lazy ? ` data-ch1s-lazy="${esc(x.id)}"` : "") +
      ` aria-hidden="true">${glyph(x)}</span>`
    );
  }

  function profileOf(g) {
    return M.normalize((g && g.profile) || {});
  }
  const isOwned = (p, x) => !!x && (p.owned || []).includes(x.id);
  function isEquipped(p, x) {
    if (!x || !p.equipment) return false;
    if (x.type === "emote") return (p.emoteSlots || []).includes(x.id) || p.equipment.emote === x.id;
    return p.equipment[x.type] === x.id;
  }

  /* ------------------------------------------------------------------ rotation quotidienne */
  function dayKey(d) {
    const y = d.getFullYear();
    return y * 1000 + Math.round((Date.UTC(y, d.getMonth(), d.getDate()) - Date.UTC(y, 0, 0)) / 864e5);
  }
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, R) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  const DAILY_TYPES = ["tool", "glider", "back", "emote", "wrap"];
  function sellable() {
    return M.catalog.filter((x) => x && x.id && x.price > 0 && x.shop !== false && !x.hidden);
  }
  /* Même date → même boutique (le tirage ne dépend pas de ce que le joueur possède). */
  function rotation(date) {
    const R = rng(dayKey(date) * 7919 + 92);
    const all = sellable().filter((x) => x.type !== "pack");
    const outfits = shuffled(all.filter((x) => x.type === "character"), R);
    const featured = [];
    const star = outfits.find((x) => rank(x) >= 3);
    if (star) featured.push(star);
    for (const x of outfits) if (featured.length < 2 && !featured.includes(x)) featured.push(x);
    const daily = [];
    const pools = {};
    for (const t of DAILY_TYPES) pools[t] = shuffled(all.filter((x) => x.type === t), R);
    for (const t of DAILY_TYPES) if (pools[t].length) daily.push(pools[t].shift());
    const rest = shuffled([].concat(...DAILY_TYPES.map((t) => pools[t])), R);
    while (daily.length < 6 && rest.length) daily.push(rest.shift());
    const extra = shuffled(all.filter((x) => !daily.includes(x) && !featured.includes(x)), R);
    while (daily.length < 6 && extra.length) daily.push(extra.shift());
    while (featured.length < 2 && extra.length) {
      const x = extra.shift();
      if (!daily.includes(x)) featured.push(x);
    }
    daily.sort((a, b) => rank(b) - rank(a) || b.price - a.price);
    return { featured, daily };
  }
  function untilMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  /* ------------------------------------------------------------------ BOUTIQUE */
  function shopTile(x, p, size, mode) {
    const own = isOwned(p, x);
    const eqd = own && isEquipped(p, x);
    const rk = rarityKey(x);
    const badge = x.badge || (x.isNew || x.new ? "NOUVEAU !" : "");
    const pipe = mode === true && hasThumb(x);
    return (
      `<article class="ch1s-tile r-${rk} is-${size}${own ? " is-owned" : ""}${pipe ? " exp-cosmetic" : ""}" data-ch1s-id="${esc(x.id)}" data-type="${esc(x.type)}">` +
      `<span class="ch1s-rays" aria-hidden="true"></span>` +
      artBox(x, mode) +
      (own
        ? `<span class="ch1s-ribbon is-owned">${eqd ? "✓ ÉQUIPÉ" : "✓ POSSÉDÉ"}</span>`
        : badge
          ? `<span class="ch1s-ribbon">${esc(badge)}</span>`
          : "") +
      `<span class="ch1s-info"><span class="ch1s-band"><b class="ch1s-name">${esc(x.name)}</b>` +
      `<small class="ch1s-kind">${esc(typeLabel(x.type))}</small>` +
      (size === "big" && x.description ? `<em class="ch1s-desc">${esc(x.description)}</em>` : "") +
      `</span><span class="ch1s-priceband">${own ? `<span class="ch1s-owned-tag">POSSÉDÉ</span>` : coins(x.price)}</span></span>` +
      `<button class="ch1s-hit" data-act="ch1s-item" data-id="${esc(x.id)}" aria-label="${esc(x.name)} · ${esc(typeLabel(x.type))} · ${own ? "possédé" : fmt(x.price) + " écus"}"></button>` +
      `</article>`
    );
  }

  const FILTERS = [
    ["featured", "Tout"],
    ["character", "Tenues"],
    ["back", "Sacs à dos"],
    ["tool", "Pioches"],
    ["glider", "Planeurs"],
    ["contrail", "Traînées"],
    ["emote", "Émotes"],
    ["wrap", "Revêtements"],
    ["headwear", "Coiffes"],
    ["variant", "Styles"],
    ["loading", "Écrans"],
    ["music", "Musiques"],
    ["banner", "Bannières"],
    ["pack", "Packs"],
  ];
  function shopView(g) {
    const p = profileOf(g);
    const now = new Date();
    const rot = rotation(now);
    const sell = sellable();
    const types = new Set(sell.map((x) => x.type));
    const chips = FILTERS.filter((f) => f[0] === "featured" || types.has(f[0]));
    for (const t of types) if (!FILTERS.some((f) => f[0] === t)) chips.push([t, typeLabel(t)]);
    const filter = chips.some((f) => f[0] === g.shopFilter) ? g.shopFilter : "featured";
    const list = sell.filter((x) => filter === "featured" || x.type === filter);
    list.sort((a, b) => isOwned(p, a) - isOwned(p, b) || rank(b) - rank(a) || a.price - b.price || a.name.localeCompare(b.name, "fr"));
    const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
    return (
      `<div class="ch1s ch1s-shop">` +
      `<header class="ch1s-shop-head">` +
      `<div class="ch1s-title"><h2>BOUTIQUE</h2><span>${esc(date)}</span></div>` +
      `<div class="ch1s-refresh" role="timer" aria-label="Nouveaux objets dans"><small>NOUVEAUX OBJETS DANS</small><b data-ch1s-timer>${untilMidnight()}</b></div>` +
      `<div class="ch1s-wallet" title="Écus gagnés en jouant · aucun achat réel">${COIN}<b>${fmt(p.coins)}</b></div>` +
      `</header>` +
      `<div class="ch1s-shop-main">` +
      `<section class="ch1s-sec ch1s-featured" aria-label="En vedette"><h3>EN VEDETTE</h3><div class="ch1s-feat-grid">` +
      rot.featured.map((x) => shopTile(x, p, "big", true)).join("") +
      `</div></section>` +
      `<section class="ch1s-sec ch1s-daily" aria-label="Quotidien"><h3>QUOTIDIEN</h3><div class="ch1s-daily-grid">` +
      rot.daily.map((x) => shopTile(x, p, "small", true)).join("") +
      `</div></section></div>` +
      `<section class="ch1s-sec ch1s-catalog" aria-label="Tout le catalogue"><h3>TOUT LE CATALOGUE <small>${list.length} objet${list.length > 1 ? "s" : ""}</small></h3>` +
      `<div class="ch1s-chips" role="group" aria-label="Filtrer le catalogue">` +
      chips
        .map((f) => `<button class="ch1s-chip${filter === f[0] ? " is-on" : ""}" data-act="shop-filter" data-id="${esc(f[0])}" aria-pressed="${filter === f[0]}">${esc(f[1])}</button>`)
        .join("") +
      `</div><div class="ch1s-cat-grid">` +
      list.map((x) => shopTile(x, p, "mini", "lazy")).join("") +
      `</div></section>` +
      `<p class="ch1s-legal">Les écus se gagnent en jouant (parties, défis, passe de combat). Aucun achat réel, aucun paiement.</p>` +
      `</div>`
    );
  }

  /* ------------------------------------------------------------------ fiche objet (superposition) */
  function detailHTML(g, x) {
    const p = profileOf(g);
    const own = isOwned(p, x);
    const eqd = own && isEquipped(p, x);
    const rk = rarityKey(x);
    const short = !own && x.price > p.coins;
    const contents = x.type === "pack" ? (x.contents || []).map(byId).filter(Boolean) : [];
    let actions = "";
    if (!own && x.price > 0)
      actions += `<button class="ch1s-btn ch1s-buy${short ? " is-short" : ""}" data-act="purchase" data-id="${esc(x.id)}" data-autofocus>ACHETER ${coins(x.price)}</button>`;
    else if (own && x.type !== "pack" && !eqd)
      actions += `<button class="ch1s-btn ch1s-equip" data-act="equip" data-id="${esc(x.id)}" data-autofocus>ÉQUIPER</button>`;
    else if (own && eqd) actions += `<span class="ch1s-btn ch1s-equipped">✓ ÉQUIPÉ</span>`;
    if (own && x.type !== "pack")
      actions += `<button class="ch1s-btn ch1s-ghost" data-act="ch1s-locker" data-id="${esc(x.id)}">VOIR AU CASIER</button>`;
    actions += `<button class="ch1s-btn ch1s-ghost" data-act="ch1s-close"${actions.includes("data-autofocus") ? "" : " data-autofocus"}>FERMER</button>`;
    return (
      `<div class="ch1s-modal" role="dialog" aria-modal="true" aria-labelledby="ch1s-detail-name">` +
      `<button class="ch1s-shade" data-act="ch1s-close" aria-label="Fermer la fiche" tabindex="-1"></button>` +
      `<section class="ch1s-detail r-${rk}">` +
      `<div class="ch1s-detail-art"><span class="ch1s-rays" aria-hidden="true"></span>${artBox(x, false)}</div>` +
      `<div class="ch1s-detail-info">` +
      `<span class="ch1s-rarity">${RARITY[rk]}</span>` +
      `<h2 id="ch1s-detail-name">${esc(x.name)}</h2>` +
      `<span class="ch1s-detail-type">${esc(typeLabel(x.type).toUpperCase())}</span>` +
      `<p>${esc(x.description || "Objet cosmétique de l'archipel : il ne change rien au combat.")}</p>` +
      (contents.length
        ? `<ul class="ch1s-pack">${contents.map((c) => `<li class="r-${rarityKey(c)}"><b>${esc(c.name)}</b><small>${esc(typeLabel(c.type))}</small>${isOwned(p, c) ? "<i>✓</i>" : ""}</li>`).join("")}</ul>`
        : "") +
      (own
        ? `<div class="ch1s-detail-state">${eqd ? "Équipé actuellement" : x.type === "pack" ? "Contenu dans ta collection" : "Dans ta collection"}</div>`
        : `<div class="ch1s-detail-price">${coins(x.price)}<small>Solde : ${fmt(p.coins)} écus</small></div>`) +
      `<div class="ch1s-detail-actions">${actions}</div>` +
      `<p class="ch1s-detail-msg" role="alert"${short ? "" : " hidden"}>${short ? esc(shortMessage(p, x)) : ""}</p>` +
      `<small class="ch1s-detail-legal">Écus fictifs gagnés en jouant · aucun paiement réel</small>` +
      `</div></section></div>`
    );
  }
  function shortMessage(p, x) {
    return `Il te manque ${fmt(x.price - p.coins)} écus pour ${x.name}. Joue des parties, relève des défis et réclame le passe pour en gagner.`;
  }

  /* Place une vignette en tête de file pour qu'elle soit calculée à la prochaine image. */
  function thumbInto(g, host, x, front) {
    if (!host || !x || host.querySelector("canvas,img.v6-loading-thumb")) return;
    if (x.type === "loading") {
      const img = doc.createElement("img");
      img.src = LOADING_ART[x.id] || LOADING_ART["loading-horizon"];
      img.className = "v6-loading-thumb";
      img.alt = "";
      host.prepend(img);
      return;
    }
    const v = g && g.view;
    if (!THUMB.includes(x.type) || !v || typeof v.renderOneThumbnail !== "function") return;
    const c = doc.createElement("canvas");
    c.width = 320;
    c.height = 430;
    c.className = "v6-item-thumb";
    c.dataset.previewType = x.type;
    const equipment = Object.assign({}, (g.profile && g.profile.equipment) || {}, { [x.type]: x.id });
    c._azEquipment = equipment;
    host.prepend(c);
    if (!v.thumbnailCache) v.thumbnailCache = new Map();
    const entry = { canvas: c, type: x.type, equipment };
    const queue = (v.thumbnailQueue || []).filter((e) => e && e.canvas && e.canvas.isConnected && e.canvas !== c);
    if (front) queue.unshift(entry);
    else queue.push(entry);
    v.thumbnailQueue = queue;
  }

  function openDetail(g, id) {
    const x = byId(id);
    if (!x || !g.overlay) return;
    g.modal = "ch1s-item";
    g._ch1sDetail = x.id;
    g.overlay.innerHTML = detailHTML(g, x);
    thumbInto(g, g.overlay.querySelector(".ch1s-detail-art .ch1s-art"), x, true);
    const f = g.overlay.querySelector("[data-autofocus]");
    if (f) f.focus({ preventScroll: true });
  }
  function closeDetail(g) {
    const id = g._ch1sDetail;
    g._ch1sDetail = null;
    if (g.modal === "ch1s-item") g.modal = null;
    if (g.overlay) g.overlay.innerHTML = "";
    const back = id && doc.querySelector(`#ui .ch1s-tile[data-ch1s-id="${CSS.escape(id)}"] .ch1s-hit`);
    if (back) back.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ CASIER */
  /* Les 6 émotes : profile.emoteSlots (la 1re = equipment.emote, utilisée par le reste du jeu). */
  function emoteSlots(p) {
    const ok = (id) => {
      const x = byId(id);
      return !!x && x.type === "emote" && (p.owned || []).includes(id);
    };
    let s = Array.isArray(p.emoteSlots) ? p.emoteSlots.slice(0, 6) : null;
    if (!s) {
      s = [p.equipment && p.equipment.emote];
      M.catalog.forEach((x) => {
        if (x.type === "emote" && s.length < 6 && ok(x.id) && !s.includes(x.id)) s.push(x.id);
      });
    }
    while (s.length < 6) s.push(null);
    s = s.map((id) => (ok(id) ? id : null));
    const main = p.equipment && p.equipment.emote;
    if (main && ok(main) && s[0] !== main) {
      const k = s.indexOf(main);
      if (k > 0) s[k] = s[0];
      s[0] = main;
    }
    for (let i = 1; i < 6; i++) if (s[i] && s.indexOf(s[i]) < i) s[i] = null;
    p.emoteSlots = s;
    return s;
  }
  /* Objets déjà vus au casier (pour le badge NOUVEAU). Premier passage : tout ce qui est possédé. */
  function seenList(p) {
    if (!Array.isArray(p.lockerSeen)) p.lockerSeen = (p.owned || []).slice();
    return p.lockerSeen;
  }
  const isNew = (p, x) => isOwned(p, x) && !seenList(p).includes(x.id);
  function unseenCount(p, type) {
    return M.catalog.filter((x) => x && (!type || x.type === type) && isNew(p, x)).length;
  }

  function lockerGroups() {
    const present = new Set(M.catalog.map((x) => x && x.type));
    const gear = [{ type: "character", big: true }, { type: "back" }, { type: "tool" }, { type: "glider" }];
    if (present.has("contrail")) gear.push({ type: "contrail" });
    const known = ["character", "back", "tool", "glider", "contrail", "variant", "headwear", "emote", "wrap", "loading", "music", "banner", "pack"];
    const extras = [{ type: "loading" }, { type: "music" }, { type: "banner" }];
    for (const t of present) if (t && !known.includes(t)) extras.push({ type: t });
    return [
      { key: "gear", title: "ÉQUIPEMENT", slots: gear },
      { key: "style", title: "STYLE", slots: [{ type: "variant" }, { type: "headwear" }] },
      { key: "emotes", title: "ÉMOTES", slots: [0, 1, 2, 3, 4, 5].map((i) => ({ type: "emote", index: i })) },
      { key: "extras", title: "REVÊTEMENT ET EXTRAS", slots: [{ type: "wrap" }].concat(extras) },
    ];
  }
  const LOCKER_TYPES = () => [].concat(...lockerGroups().map((gr) => gr.slots.map((s) => s.type)));

  function slotHTML(def, p, filter, emoteIdx) {
    const type = def.type;
    const id = def.index != null ? emoteSlots(p)[def.index] : p.equipment && p.equipment[type];
    const x = byId(id);
    const open = filter === type && (def.index == null || def.index === emoteIdx);
    const fresh = def.index == null || def.index === 0 ? unseenCount(p, type) : 0;
    const label = def.index != null ? `ÉMOTE ${def.index + 1}` : typeLabel(type).toUpperCase();
    const act = def.index != null ? `data-act="ch1s-emote-slot" data-id="${def.index}"` : `data-act="locker-filter" data-id="${esc(type)}"`;
    const pipe = !!x && hasThumb(x);
    return (
      `<div class="ch1s-slot ${x ? "r-" + rarityKey(x) : "is-empty"}${def.big ? " is-big" : ""}${def.index != null ? " is-emote" : ""}${open ? " is-open" : ""}${pipe ? " exp-cosmetic" : ""}" data-type="${esc(type)}">` +
      (x ? `<span class="ch1s-rays" aria-hidden="true"></span>${artBox(x, true)}` : `<span class="ch1s-plus" aria-hidden="true">+</span>`) +
      `<span class="ch1s-slot-type">${esc(label)}</span>` +
      (x && (def.big || def.index == null) ? `<span class="ch1s-slot-name">${esc(x.name)}</span>` : "") +
      (fresh ? `<span class="ch1s-count" title="${fresh} nouveau${fresh > 1 ? "x" : ""}">${fresh}</span>` : "") +
      `<button class="ch1s-hit" ${act} aria-pressed="${open}" aria-label="${esc(label)} : ${esc(x ? x.name : "vide")}"></button>` +
      `</div>`
    );
  }

  function pickTile(x, p, filter, emoteIdx) {
    const slots = emoteSlots(p);
    const on = filter === "emote" ? slots[emoteIdx] === x.id : p.equipment && p.equipment[filter] === x.id;
    const other = filter === "emote" && !on ? slots.indexOf(x.id) : -1;
    const fresh = isNew(p, x);
    const pipe = hasThumb(x);
    const act = filter === "emote" ? "ch1s-emote-set" : on ? "preview" : "equip";
    return (
      `<article class="ch1s-pick r-${rarityKey(x)}${on ? " is-on" : ""}${pipe ? " exp-cosmetic" : ""}" data-ch1s-id="${esc(x.id)}" data-type="${esc(x.type)}"${fresh ? ' data-new="1"' : ""}>` +
      `<span class="ch1s-rays" aria-hidden="true"></span>` +
      artBox(x, true) +
      (fresh ? `<span class="ch1s-new">NOUVEAU</span>` : "") +
      (on ? `<span class="ch1s-check" aria-hidden="true">✓</span>` : other >= 0 ? `<span class="ch1s-slotnum" title="Déjà dans l'émote ${other + 1}">${other + 1}</span>` : "") +
      `<span class="ch1s-pick-name">${esc(x.name)}</span>` +
      `<button class="ch1s-hit" data-act="${act}" data-id="${esc(x.id)}" aria-pressed="${on}" aria-label="${esc(x.name)} · ${RARITY[rarityKey(x)]}${on ? " · équipé" : ""}"></button>` +
      `</article>`
    );
  }

  function lockerView(g) {
    const p = profileOf(g);
    seenList(p);
    emoteSlots(p);
    const types = LOCKER_TYPES();
    const filter = types.includes(g.lockerFilter) ? g.lockerFilter : "character";
    const emoteIdx = filter === "emote" ? clamp(Math.floor(Number(g.ch1sEmoteSlot) || 0), 0, 5) : -1;
    // v95 : champ CHERCHER (nom, ensemble) — la collection compte maintenant plus de 200 objets
    const q = String(g.ch1sQuery || "").trim().toLowerCase();
    const owned = M.catalog.filter((x) => x && x.type === filter && isOwned(p, x) && (!q || (x.name + " " + (x.set || "")).toLowerCase().includes(q)));
    owned.sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, "fr"));
    const total = M.catalog.filter((x) => x && x.type === filter).length;
    const current = filter === "emote" ? byId(p.emoteSlots[emoteIdx]) : byId(p.equipment && p.equipment[filter]);
    const sel = byId(g.selectedCosmetic);
    const focus = sel && sel.type === filter && isOwned(p, sel) ? sel : current;
    const title = filter === "emote" ? `ÉMOTE ${emoteIdx + 1}` : typeLabel(filter).toUpperCase();
    let grid = "";
    if (filter === "emote" && emoteIdx > 0)
      grid += `<article class="ch1s-pick is-clear${current ? "" : " is-on"}"><span class="ch1s-plus" aria-hidden="true">∅</span><span class="ch1s-pick-name">AUCUNE</span><button class="ch1s-hit" data-act="ch1s-emote-set" data-id="none" aria-label="Vider l'emplacement"></button></article>`;
    if (filter !== "character" && filter !== "emote" && filter !== "loading" && filter !== "music" && filter !== "banner" && !owned.length)
      grid += "";
    grid += owned.map((x) => pickTile(x, p, filter, emoteIdx)).join("");
    if (owned.length < total)
      grid += `<button class="ch1s-pick is-shop" data-act="tab" data-id="shop"><span class="ch1s-plus" aria-hidden="true">${COIN}</span><span class="ch1s-pick-name">${total - owned.length} À DÉBLOQUER · BOUTIQUE</span></button>`;
    const info = focus
      ? `<footer class="ch1s-pick-info r-${rarityKey(focus)}"><span class="ch1s-rarity">${RARITY[rarityKey(focus)]}</span><b>${esc(focus.name)}</b>` +
        `<p>${esc(focus.description || typeLabel(focus.type))}</p>` +
        (focus.set ? `<p class="ch1s-set">Fait partie de l'ensemble <b>${esc(focus.set)}</b>.</p>` : "") +
        `<p class="ch1s-since">Disponible depuis : <b>${esc(focus.collection || "Saison 1")}</b></p>` +
        (isEquipped(p, focus) && (filter !== "emote" || p.emoteSlots[emoteIdx] === focus.id)
          ? `<span class="ch1s-btn ch1s-equipped">✓ ÉQUIPÉ</span>`
          : filter === "emote"
            ? `<button class="ch1s-btn ch1s-equip" data-act="ch1s-emote-set" data-id="${esc(focus.id)}">PLACER EN ÉMOTE ${emoteIdx + 1}</button>`
            : `<button class="ch1s-btn ch1s-equip" data-act="equip" data-id="${esc(focus.id)}">ÉQUIPER</button>`) +
        `</footer>`
      : `<footer class="ch1s-pick-info is-empty"><b>Emplacement vide</b><p>Choisis un objet dans la grille.</p></footer>`;
    const count = (p.owned || []).filter((id) => byId(id)).length;
    return (
      `<div class="ch1s ch1s-locker">` +
      `<header class="ch1s-locker-head"><h2>CASIER</h2><span>${count} objet${count > 1 ? "s" : ""} dans ta collection</span></header>` +
      `<nav class="ch1s-slots" data-ch1s-keep="slots" aria-label="Emplacements du casier">` +
      lockerGroups()
        .map(
          (gr) =>
            `<section class="ch1s-group is-${gr.key}"><h4>${gr.title}</h4><div class="ch1s-slot-grid">` +
            gr.slots.map((s) => slotHTML(s, p, filter, emoteIdx)).join("") +
            `</div></section>`,
        )
        .join("") +
      `</nav>` +
      `<section class="ch1s-picker" aria-label="${esc(title)}">` +
      `<header class="ch1s-picker-head"><span class="ch1s-sel">SÉLECTION</span><h3 class="ch1s-cat">${esc(title)}</h3><span>${owned.length} / ${total}</span></header>` +
      `<label class="ch1s-search"><span aria-hidden="true">⌕</span><input type="search" data-ch1s-search placeholder="CHERCHER" value="${esc(g.ch1sQuery || "")}" aria-label="Chercher dans ${esc(title)}"></label>` +
      `<div class="ch1s-pick-grid" data-ch1s-keep="picker">${grid || `<p class="ch1s-empty">Rien ici pour l'instant. La boutique t'attend.</p>`}</div>` +
      info +
      `</section></div>`
    );
  }

  /* ------------------------------------------------------------------ AZPanels.render */
  const prevRender = P.render;
  P.render = function (tab, ctx) {
    try {
      if (tab === "shop") return shopView(ctx || {});
      if (tab === "locker") return lockerView(ctx || {});
    } catch (err) {
      console.error(TAG, err);
    }
    return prevRender.apply(this, arguments);
  };

  /* ------------------------------------------------------------------ actions */
  let saveTimer = 0;
  function saveSoon(g) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        if (g && typeof g.queueSave === "function") g.queueSave();
      } catch (err) {
        console.warn(TAG, err);
      }
    }, 700);
  }
  function markSeen(g, id) {
    const p = g && g.profile;
    const x = byId(id);
    if (!p || !x || !isOwned(p, x)) return false;
    const seen = seenList(p);
    if (seen.includes(id)) return false;
    seen.push(id);
    saveSoon(g);
    return true;
  }
  function uiSound(g) {
    try {
      if (g.audio && typeof g.audio.ui === "function") g.audio.ui();
    } catch (err) {
      /* son facultatif */
    }
  }

  const prevAction = HP.action;
  HP.action = async function (act, id, el) {
    const g = this;
    try {
      if (act === "ch1s-item") {
        uiSound(g);
        openDetail(g, id);
        return;
      }
      if (act === "ch1s-close") {
        closeDetail(g);
        return;
      }
      if (act === "ch1s-locker") {
        const x = byId(id);
        if (!x) return;
        uiSound(g);
        g._ch1sDetail = null;
        g.tab = "locker";
        g.lockerFilter = x.type;
        if (x.type === "emote") g.ch1sEmoteSlot = Math.max(0, emoteSlots(profileOf(g)).indexOf(x.id));
        g.selectedCosmetic = x.id;
        if (typeof g.updatePreview === "function") g.updatePreview();
        return g.renderMenu();
      }
      if (act === "ch1s-emote-slot") {
        uiSound(g);
        const i = clamp(Math.floor(Number(id) || 0), 0, 5);
        const p = profileOf(g);
        g.lockerFilter = "emote";
        g.ch1sEmoteSlot = i;
        g.selectedCosmetic = emoteSlots(p)[i] || null;
        return g.renderMenu();
      }
      if (act === "ch1s-emote-set") {
        const p = profileOf(g);
        const slots = emoteSlots(p);
        const i = clamp(Math.floor(Number(g.ch1sEmoteSlot) || 0), 0, 5);
        const x = id && id !== "none" ? byId(id) : null;
        if (x && (x.type !== "emote" || !isOwned(p, x))) {
          g.toast && g.toast("Émote non disponible.", true);
          return;
        }
        if (!x) {
          if (i === 0) {
            g.toast && g.toast("Le premier emplacement garde toujours une émote.", true);
            return;
          }
          slots[i] = null;
          uiSound(g);
          g.queueSave && g.queueSave();
          return g.renderMenu();
        }
        markSeen(g, x.id);
        const k = slots.indexOf(x.id);
        if (k >= 0 && k !== i) slots[k] = slots[i];
        slots[i] = x.id;
        if (i === 0 || k === 0) {
          // l'émote principale passe par le flux d'équipement existant (toast, sauvegarde, rendu)
          const main = slots[0];
          if (main) return prevAction.call(g, "equip", main, el);
        }
        uiSound(g);
        g.selectedCosmetic = x.id;
        if (typeof g.updatePreview === "function") g.updatePreview();
        g.queueSave && g.queueSave();
        g.toast && g.toast(`${x.name} · émote ${i + 1}`);
        return g.renderMenu();
      }
      if (act === "purchase") {
        const x = byId(id);
        const p = profileOf(g);
        if (x && !isOwned(p, x) && x.price > p.coins) {
          const msg = shortMessage(p, x);
          g.toast && g.toast(msg, true);
          const box = g.overlay && g.overlay.querySelector(".ch1s-detail-msg");
          if (box) {
            box.hidden = false;
            box.textContent = msg;
            box.classList.remove("is-shake");
            void box.offsetWidth;
            box.classList.add("is-shake");
          }
          return;
        }
        g._ch1sReturn = g.modal === "ch1s-item" && x ? x.id : null;
        return prevAction.call(g, act, id, el);
      }
      if (act === "confirm-cancel") {
        const back = g.modal === "confirm" ? g._ch1sReturn : null;
        g._ch1sReturn = null;
        const r = await prevAction.call(g, act, id, el);
        if (back && g.screen === "menu" && g.tab === "shop") openDetail(g, back);
        return r;
      }
      if (act === "locker-filter") {
        const p = profileOf(g);
        if (id === "emote") g.ch1sEmoteSlot = 0;
        const cur = id === "emote" ? emoteSlots(p)[0] : p.equipment && p.equipment[id];
        g.selectedCosmetic = cur && byId(cur) ? cur : null;
        return prevAction.call(g, act, id, el);
      }
      if (act === "equip" || act === "reward-equip") {
        markSeen(g, id);
        const x = byId(id);
        if (x && x.type === "emote" && g.tab === "locker") g.ch1sEmoteSlot = 0;
      }
      if (act === "tab" && id === "locker" && g.tab !== "locker") g.ch1sEmoteSlot = 0;
    } catch (err) {
      console.error(TAG, err);
    }
    return prevAction.call(this, act, id, el);
  };

  /* ------------------------------------------------------------------ après chaque rendu du menu */
  const docEl = doc.documentElement;
  function layoutVars() {
    const top = doc.querySelector("#ui .topbar");
    const foot = doc.querySelector("#ui .bottom-bar");
    const t = top ? Math.max(0, Math.round(top.getBoundingClientRect().bottom)) : 56;
    let b = 0;
    if (foot) {
      const r = foot.getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(foot).display !== "none" && getComputedStyle(foot).visibility !== "hidden")
        b = Math.max(0, Math.round(root.innerHeight - r.top));
    }
    docEl.style.setProperty("--ch1s-top", t + "px");
    docEl.style.setProperty("--ch1s-bottom", b + "px");
  }

  let lazyObserver = null;
  function wireLazy(g, panel) {
    if (lazyObserver) lazyObserver.disconnect();
    lazyObserver = null;
    const boxes = panel ? panel.querySelectorAll("[data-ch1s-lazy]") : [];
    if (!boxes.length) return;
    const load = (el) => thumbInto(g, el, byId(el.dataset.ch1sLazy), false);
    if (typeof root.IntersectionObserver !== "function") {
      boxes.forEach(load);
      return;
    }
    lazyObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          lazyObserver.unobserve(e.target);
          load(e.target);
        }
      },
      { root: panel, rootMargin: "240px 0px" },
    );
    boxes.forEach((el) => lazyObserver.observe(el));
  }

  function decorateLabel(g) {
    const label = doc.querySelector("#ui .page-preview-label");
    if (!label || g.tab !== "locker") return;
    const p = profileOf(g);
    const sel = byId(g.selectedCosmetic);
    const x = sel && isOwned(p, sel) ? sel : byId(p.equipment && p.equipment.character);
    if (!x) return;
    const rk = rarityKey(x);
    label.classList.add("ch1s-caption");
    label.innerHTML =
      `<span class="ch1s-rarity r-${rk}">${RARITY[rk]} · ${esc(typeLabel(x.type).toUpperCase())}</span>` +
      `<h3>${esc(x.name)}</h3><p>Fais glisser le personnage pour le tourner.</p>`;
  }

  function decorateTabBadge(g) {
    const btn = doc.querySelector('#ui .topbar [data-act="tab"][data-id="locker"]');
    if (!btn) return;
    const old = btn.querySelector(".ch1s-tab-badge");
    if (old) old.remove();
    const n = unseenCount(profileOf(g));
    if (!n) return;
    const i = doc.createElement("i");
    i.className = "ch1s-tab-badge";
    i.textContent = n > 99 ? "99+" : String(n);
    i.setAttribute("aria-label", `${n} nouvel objet${n > 1 ? "s" : ""} au casier`);
    btn.appendChild(i);
  }

  function afterRender(g, keep, tabChanged) {
    if (g.screen !== "menu") return;
    layoutVars();
    decorateTabBadge(g);
    const page = g.tab === "shop" || g.tab === "locker";
    doc.body.classList.toggle("ch1s-page", page);
    if (!page) return;
    const panel = doc.querySelector("#ui .scroll-panel");
    if (panel) {
      panel.dataset.ch1sKeep = "panel";
      panel.classList.toggle("ch1s-enter", !!tabChanged);
      doc.querySelectorAll("#ui [data-ch1s-keep]").forEach((el) => {
        const v = keep[el.dataset.ch1sKeep];
        if (v) el.scrollTop = v;
      });
    }
    if (g.tab === "shop") wireLazy(g, panel);
    else if (lazyObserver) {
      lazyObserver.disconnect();
      lazyObserver = null;
    }
    decorateLabel(g);
  }

  const prevRenderMenu = HP.renderMenu;
  HP.renderMenu = function () {
    const keep = {};
    const tabChanged = this._ch1sTab !== this.tab;
    if (!tabChanged && (this.tab === "shop" || this.tab === "locker"))
      doc.querySelectorAll("#ui [data-ch1s-keep]").forEach((el) => (keep[el.dataset.ch1sKeep] = el.scrollTop));
    if (this.tab !== "shop") this._ch1sDetail = null;
    const r = prevRenderMenu.apply(this, arguments);
    this._ch1sTab = this.tab;
    try {
      afterRender(this, keep, tabChanged);
    } catch (err) {
      console.warn(TAG, err);
    }
    return r;
  };

  /* ------------------------------------------------------------------ écouteurs globaux */
  // Survol (ou focus) d'un objet NOUVEAU au casier : il devient "vu".
  function seenFrom(e) {
    const el = e.target && e.target.closest && e.target.closest(".ch1s-pick[data-new]");
    const g = root.AZUR;
    if (!el || !g) return;
    if (!markSeen(g, el.dataset.ch1sId)) return;
    el.removeAttribute("data-new");
    const badge = el.querySelector(".ch1s-new");
    if (badge) badge.remove();
    const type = el.dataset.type;
    const n = unseenCount(profileOf(g), type);
    doc.querySelectorAll(`#ui .ch1s-slot[data-type="${CSS.escape(type)}"] .ch1s-count`).forEach((c) => {
      if (n) c.textContent = String(n);
      else c.remove();
    });
    decorateTabBadge(g);
  }
  doc.addEventListener("pointerover", seenFrom, true);
  doc.addEventListener("focusin", seenFrom, true);

  // Échap ferme la fiche ; Tab reste piégé dans la fiche.
  doc.addEventListener("keydown", (e) => {
    const g = root.AZUR;
    if (!g || g.modal !== "ch1s-item") return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDetail(g);
      return;
    }
    if (e.key === "Tab" && g.overlay) {
      const all = [...g.overlay.querySelectorAll(".ch1s-detail button:not([disabled])")];
      if (!all.length) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  let resizeFrame = 0;
  root.addEventListener("resize", () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const g = root.AZUR;
      if (g && g.screen === "menu") layoutVars();
    });
  });

  // Minuterie de la boutique ; à minuit la rotation change, la page se recalcule d'elle-même.
  let lastDay = dayKey(new Date());
  setInterval(() => {
    const el = doc.querySelector("#ui [data-ch1s-timer]");
    if (el) el.textContent = untilMidnight();
    const today = dayKey(new Date());
    if (today === lastDay) return;
    lastDay = today;
    const g = root.AZUR;
    if (g && g.screen === "menu" && g.tab === "shop" && !g.modal) g.renderMenu();
  }, 1000);

  // Exposé pour les tests et les autres couches (lecture seule).
  root.AZCh1Shop = { rotation, rarityKey, rarityLabel: (x) => RARITY[rarityKey(x)], typeLabel, emoteSlots };
})(typeof globalThis !== "undefined" ? globalThis : this);
