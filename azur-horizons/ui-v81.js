/* AZUR v81 — Casier et Boutique refaits.
 *  - CASIER : grille d'emplacements (tenue, équipement, expression) en tuiles
 *    de rareté avec vignette 3D ; un clic ouvre la sélection de la catégorie,
 *    l'objet porté est marqué, « Équiper » en un geste. Le personnage reste
 *    visible à gauche, en 3D.
 *  - BOUTIQUE : en-tête avec minuterie de renouvellement (minuit), « À la une »
 *    (grandes tuiles), « Offres du jour » (rotation quotidienne déterministe),
 *    puis tout le catalogue filtrable. Prix en écus fictifs, aucun achat réel.
 * Les actions restent celles du jeu (preview, equip, purchase, *-filter). */
(function (root) {
  'use strict';
  var P = root.AZPanels, M = root.AZMeta;
  if (!P || !P.render || !M) return;
  var base = P.render;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var RAR = { 1: ['commun', 'COMMUN'], 2: ['rare', 'RARE'], 3: ['epique', 'ÉPIQUE'], 4: ['legendaire', 'LÉGENDAIRE'] };
  var TYPE = { character: 'Tenue', variant: 'Variante', back: 'Sac à dos', tool: 'Pioche', glider: 'Planeur', emote: 'Emote', loading: 'Écran de chargement', banner: 'Bannière', music: 'Musique', headwear: 'Coiffe', wrap: 'Revêtement', pack: 'Pack' };
  function art(x) {
    var icon = root.AZIcons && root.AZIcons.cosmetic ? root.AZIcons.cosmetic(x) : '<span class="exp-art-icon">' + esc(x.icon || '✦') + '</span>';
    return '<span class="v81-art" style="--c1:' + esc(x.color) + ';--c2:' + esc(x.secondary) + '">' + icon + '</span>';
  }
  function rar(x) { return RAR[x.rarity] || RAR[1]; }
  function coins(n) { return '◈ ' + Number(n || 0).toLocaleString('fr-FR'); }

  function lockerView(ctx) {
    var p = M.normalize(ctx.profile || {}), cat = M.catalog, owned = p.owned || [], eq = p.equipment || {};
    var byId = function (id) { return cat.filter(function (x) { return x.id === id; })[0]; };
    var filter = ctx.lockerFilter || 'character';
    var groups = [['TENUE', ['character', 'variant', 'headwear']], ['ÉQUIPEMENT', ['back', 'tool', 'glider', 'wrap']], ['EXPRESSION', ['emote', 'banner', 'music', 'loading']]];
    function slot(type, big) {
      var x = byId(eq[type]), r = x ? rar(x) : ['vide', ''], n = cat.filter(function (c) { return c.type === type && owned.indexOf(c.id) >= 0; }).length;
      var inner = x ? '<button class="exp-card-art v81-slot-art" data-act="preview" data-id="' + esc(x.id) + '" tabindex="-1" aria-hidden="true">' + art(x) + '</button>' : '<span class="v81-slot-empty">+</span>';
      return '<div class="v81-slot exp-cosmetic r-' + r[0] + (big ? ' is-big' : '') + (filter === type ? ' is-open' : '') + '">' + inner +
        '<button class="v81-slot-hit" data-act="locker-filter" data-id="' + type + '" aria-label="' + esc(TYPE[type]) + '"></button>' +
        '<span class="v81-slot-type">' + esc(TYPE[type]) + '</span><span class="v81-slot-name">' + esc(x ? x.name : 'Aucun') + '</span><span class="v81-slot-count">' + n + '</span></div>';
    }
    var list = cat.filter(function (x) { return x.type === filter && owned.indexOf(x.id) >= 0; });
    list.sort(function (a, b) { return (b.rarity - a.rarity) || a.name.localeCompare(b.name); });
    var picker = list.map(function (x) {
      var on = eq[x.type] === x.id, r = rar(x), sel = ctx.selectedCosmetic === x.id;
      return '<article class="v81-tile exp-cosmetic r-' + r[0] + (on ? ' is-on' : '') + (sel ? ' is-sel' : '') + '"><button class="exp-card-art v81-tile-art" data-act="preview" data-id="' + esc(x.id) + '" aria-label="Aperçu de ' + esc(x.name) + '">' + art(x) + '</button>' +
        '<div class="v81-tile-foot"><b>' + esc(x.name) + '</b><small>' + r[1] + '</small>' + (on ? '<span class="v81-on">PORTÉ</span>' : '<button class="v81-btn" data-act="equip" data-id="' + esc(x.id) + '">ÉQUIPER</button>') + '</div></article>';
    }).join('');
    var all = cat.filter(function (x) { return x.type === filter; }).length;
    return '<div class="v81-locker">' +
      '<header class="v81-head"><span class="v81-kicker">CASIER</span><h2>Ton explorateur</h2><p>' + owned.length + ' objets dans ta collection · tout se voit en 3D à gauche</p></header>' +
      groups.map(function (g) { return '<section class="v81-group"><h4>' + g[0] + '</h4><div class="v81-slots">' + g[1].map(function (t, i) { return slot(t, g[0] === 'TENUE' && i === 0); }).join('') + '</div></section>'; }).join('') +
      '<section class="v81-picker"><div class="v81-picker-head"><h3>' + esc(TYPE[filter] || filter) + '</h3><span>' + list.length + ' / ' + all + ' possédés</span>' + (list.length < all ? '<button class="v81-link" data-act="tab" data-id="shop">Voir la boutique ›</button>' : '') + '</div>' +
      '<div class="v81-grid">' + (picker || '<p class="v81-empty">Rien ici pour l’instant. La boutique t’attend.</p>') + '</div></section></div>';
  }

  function dayKey() { var d = new Date(); return d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function shopView(ctx) {
    var p = M.normalize(ctx.profile || {}), cat = M.catalog, owned = p.owned || [];
    var sellable = cat.filter(function (x) { return x.price > 0; });
    var R = rng(dayKey() * 7919);
    var feat = ['char-eclipse', 'char-aurore'].map(function (id) { return cat.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
    var pool = sellable.filter(function (x) { return feat.indexOf(x) < 0; }), daily = [];
    while (daily.length < 8 && pool.length) { daily.push(pool.splice(Math.floor(R() * pool.length), 1)[0]); }
    function tile(x, big) {
      var has = owned.indexOf(x.id) >= 0, r = rar(x), can = p.coins >= x.price;
      return '<article class="v81-offer exp-cosmetic r-' + r[0] + (big ? ' is-big' : '') + (has ? ' is-owned' : '') + '"><button class="exp-card-art v81-offer-art" data-act="preview" data-id="' + esc(x.id) + '" aria-label="Aperçu de ' + esc(x.name) + '">' + art(x) + '</button>' +
        '<span class="v81-offer-type">' + esc(TYPE[x.type] || x.type) + '</span>' + (big ? '<span class="v81-offer-tag">NOUVEAU</span>' : '') +
        '<div class="v81-offer-foot"><b>' + esc(x.name) + '</b>' + (big ? '<small>' + esc(x.description || '') + '</small>' : '') +
        (has ? '<span class="v81-owned">✓ POSSÉDÉ</span>' : '<button class="v81-price' + (can ? '' : ' is-short') + '" data-act="purchase" data-id="' + esc(x.id) + '">' + coins(x.price) + '</button>') + '</div></article>';
    }
    var filter = ctx.shopFilter || 'featured', types = [['featured', 'Tout voir'], ['character', 'Tenues'], ['glider', 'Planeurs'], ['tool', 'Pioches'], ['back', 'Sacs'], ['emote', 'Emotes'], ['wrap', 'Revêtements'], ['headwear', 'Coiffes'], ['loading', 'Écrans'], ['banner', 'Bannières'], ['music', 'Musiques'], ['pack', 'Packs']];
    var list = cat.filter(function (x) { return x.price > 0 && (filter === 'featured' || filter === 'all' || x.type === filter); });
    list.sort(function (a, b) { return (owned.indexOf(a.id) >= 0) - (owned.indexOf(b.id) >= 0) || (b.rarity - a.rarity) || a.price - b.price; });
    return '<div class="v81-shop">' +
      '<header class="v81-head"><span class="v81-kicker">BOUTIQUE</span><h2>Boutique de l’archipel</h2><p>Objets payés en écus gagnés en jouant · aucun achat réel</p>' +
      '<div class="v81-shop-bar"><span class="v81-timer">Nouveaux objets dans <b data-v81-timer>--:--:--</b></span><span class="v81-wallet">' + coins(p.coins) + '</span></div></header>' +
      (feat.length ? '<section class="v81-sec"><h3>À LA UNE</h3><div class="v81-featured">' + feat.map(function (x) { return tile(x, true); }).join('') + '</div></section>' : '') +
      '<section class="v81-sec"><h3>OFFRES DU JOUR</h3><div class="v81-daily">' + daily.map(function (x) { return tile(x, false); }).join('') + '</div></section>' +
      '<section class="v81-sec"><h3>TOUT LE CATALOGUE</h3><div class="v81-chips">' + types.map(function (f) { return '<button class="v81-chip' + (filter === f[0] ? ' is-on' : '') + '" data-act="shop-filter" data-id="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="v81-daily v81-all">' + list.map(function (x) { return tile(x, false); }).join('') + '</div></section></div>';
  }

  P.render = function (tab, ctx) {
    try {
      if (tab === 'locker') return lockerView(ctx || {});
      if (tab === 'shop') return shopView(ctx || {});
    } catch (e) { console.error('[AZUR ui81]', e); }
    return base.apply(this, arguments);
  };

  // minuterie de la boutique (jusqu'à minuit, heure locale)
  setInterval(function () {
    var el = document.querySelector('[data-v81-timer]'); if (!el) return;
    var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), s = Math.max(0, Math.floor((next - now) / 1000));
    el.textContent = String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
})(window);
