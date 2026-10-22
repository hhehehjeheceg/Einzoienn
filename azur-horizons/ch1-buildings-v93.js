/* AZUR v93 — ch1-buildings-v93.js : de grands bâtiments comme dans le Chapitre 1.
 * Les villes de la simulation ne comptaient presque que des maisons d'un ou deux niveaux.
 * Cette couche (navigateur seulement : le test Node tools/azur/sim-smoke.cjs garde sim.js seul)
 *  - agrandit les bâtiments des villes après la génération de la carte : immeubles de 4 à 8
 *    étages dans la grande ville et le port, 2 à 4 étages ailleurs, emprise plus large ;
 *  - ajoute dans chacun un escalier intérieur (côté est) qui relie tous les étages : c'est une
 *    surface de marche de la simulation, avec une trémie dans chaque plancher ;
 *  - pose des coffres et du butin aux étages ;
 *  - dessine planchers, escaliers, fenêtres sur les quatre façades, garde-corps et toit-terrasse
 *    (enveloppe AZArt.objectModel, par-dessus la coque d'origine qui reste celle des collisions).
 * Doit être chargée après sim.js, models.js, graphics-v200-world.js et ch1-world-v93.js. */
(function (root) {
  "use strict";
  const S = root.AZSim, A = root.AZArt, T = root.THREE;
  if (!S || !S.World || S.World.prototype.__ch1Buildings) return;
  const P = S.World.prototype;
  P.__ch1Buildings = true;
  const FLOOR = 4; // hauteur d'un étage (sim.js : supportAt, panneaux de collision)

  function hash(n) { let x = (n | 0) ^ 0x2c1b3c6d; x = Math.imul(x ^ (x >>> 15), 0x297a2d39); x = Math.imul(x ^ (x >>> 13), 0x85ebca6b); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
  function toLocal(o, x, z) { const c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0), dx = x - o.x, dz = z - o.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; }
  function toWorld(o, lx, lz) { const c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0); return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c }; }
  // escalier : volée le long du mur est, du sud (z0) au nord (z1) puis retour, un étage par volée
  function stairOf(o) { return { x0: o.w - 2.75, x1: o.w - .45, z0: -o.d + 1.4, z1: o.d - 1.1 }; }
  function flightHeight(o, st, f, lz) { const u = Math.min(1, Math.max(0, (lz - st.z0) / (st.z1 - st.z0))); return o.y + f * FLOOR + FLOOR * (f % 2 ? 1 - u : u); }

  /* ------------------------------------------------------------ génération */
  const prevCreate = P._createMap;
  P._createMap = function () {
    const r = prevCreate.apply(this, arguments);
    try { upgradeTowns(this); } catch (e) { if (root.console) console.warn("[AZUR bâtiments]", e); }
    return r;
  };
  /* Bâtiments longs : deux parcelles voisines d'une même ville fusionnent en un seul grand immeuble
   * (dans l'axe nord-sud, porte au nord, ou est-ouest), rue entre les deux comprise. */
  function mergeLots(w) {
    const W = S.MAP.waiting, houses = w.objects.filter((o) => o.type === "house" && !o.dead && (o.yaw || 0) === 0 && Math.hypot(o.x - W.x, o.z - W.z) > (W.radius || 82) + 60);
    const gone = new Set();
    for (const a of houses) {
      if (gone.has(a) || a._merged) continue;
      const style = a.style || "", big = style === "citadel" || style === "port";
      if (style === "hamlet" || style === "farm") continue;
      const k = hash((a.seed || 1) * 5 + 3);
      if (k > (big ? .4 : .22)) continue;
      const alongZ = true; // nord-sud seulement : la porte reste au nord, sur la rue
      const b = houses.find((q) => q !== a && !gone.has(q) && !q._merged && q.region === a.region && (alongZ ? Math.abs(q.x - a.x) < 1.2 && q.z - a.z > 12 && q.z - a.z < 23 : Math.abs(q.z - a.z) < 1.2 && q.x - a.x > 12 && q.x - a.x < 24));
      if (!b) continue;
      if (alongZ) { const z0 = a.z - (a.d || 5.5), z1 = b.z + (b.d || 5.5); a.z = (z0 + z1) / 2; a.d = (z1 - z0) / 2; a.w = Math.max(a.w || 5.5, b.w || 5.5); }
      else { const x0 = a.x - (a.w || 5.5), x1 = b.x + (b.w || 5.5); a.x = (x0 + x1) / 2; a.w = (x1 - x0) / 2; a.d = Math.max(a.d || 5.5, b.d || 5.5); }
      a.y = Math.min(a.y, b.y); a._merged = true; gone.add(b);
    }
    if (gone.size) w.objects = w.objects.filter((o) => !gone.has(o));
    return gone.size;
  }
  /* v94 — types d'architecture : chaque bâtiment reçoit un modèle propre (forme, toit, matériaux,
   * façades, intérieur), pas seulement une autre couleur. Inspirés des lieux du Chapitre 1 (ville de
   * tours en brique avec une tour de l'horloge, banlieue de maisons à pignon, ferme et granges, port
   * et entrepôts, village en adobe, villas de bord de mer, chalets, pagodes), dessins originaux.
   * roof.t : flat (terrasse), gz (pignon, faîtage nord-sud), gx (faîtage est-ouest), hip (croupe),
   * gam (toit de grange) ; s = pente. Le toit est une vraie surface de marche (supportAt). */
  const ARCH = {
    tower: { floors: [6, 10], roof: { t: "flat" }, inside: "home" },
    office: { floors: [8, 13], roof: { t: "flat" }, inside: "office" },
    apart: { floors: [4, 7], roof: { t: "flat" }, inside: "home" },
    shops: { floors: [2, 3], roof: { t: "flat" }, inside: "shop" },
    clock: { floors: [12, 14], roof: { t: "hip", s: 1.05 }, inside: "office" },
    harbor: { floors: [3, 5], roof: { t: "gz", s: .95 }, inside: "home" },
    depot: { floors: [2, 3], roof: { t: "gz", s: .2 }, inside: "depot" },
    suburb: { floors: [3, 3], roof: { t: "gz", s: .55 }, inside: "home" },
    brick: { floors: [2, 3], roof: { t: "hip", s: .5 }, inside: "home" },
    cabin: { floors: [2, 3], roof: { t: "gx", s: .62 }, inside: "home" },
    chalet: { floors: [3, 4], roof: { t: "gz", s: .9 }, inside: "home" },
    farm: { floors: [3, 3], roof: { t: "gx", s: .6 }, inside: "home" },
    barn: { floors: [2, 3], roof: { t: "gam" }, inside: "barn" },
    adobe: { floors: [2, 4], roof: { t: "flat" }, inside: "home" },
    diner: { floors: [2, 2], roof: { t: "flat" }, inside: "diner" },
    motel: { floors: [2, 3], roof: { t: "flat" }, inside: "home" },
    villa: { floors: [3, 4], roof: { t: "flat" }, inside: "home" },
    deco: { floors: [4, 6], roof: { t: "flat" }, inside: "home" },
    lab: { floors: [3, 5], roof: { t: "flat" }, inside: "lab" },
    pagoda: { floors: [3, 5], roof: { t: "hip", s: .62 }, inside: "pagoda" },
  };
  const MIX = {
    citadel: [["tower", 3], ["office", 2], ["apart", 2.5], ["shops", 2.5]],
    port: [["harbor", 3.5], ["depot", 2.5], ["tower", 1.5], ["apart", 2]],
    forest: [["suburb", 5], ["brick", 3], ["cabin", 2]],
    farm: [["farm", 4], ["barn", 4], ["brick", 2]],
    desert: [["adobe", 5], ["diner", 1.5], ["motel", 2.5], ["shops", 1]],
    lagoon: [["villa", 5], ["deco", 4], ["suburb", 1]],
    cliff: [["chalet", 6], ["cabin", 4]],
    observatory: [["lab", 6], ["chalet", 2], ["office", 2]],
  };
  const LONG = { citadel: [["shops", 5], ["tower", 3], ["apart", 2]], port: [["depot", 6], ["apart", 4]], desert: [["motel", 7], ["shops", 3]], lagoon: [["villa", 7], ["deco", 3]], farm: [["barn", 8], ["farm", 2]] };
  function pick(list, k) { let t = 0; for (const e of list) t += e[1]; let a = k * t; for (const e of list) { a -= e[1]; if (a <= 0) return e[0]; } return list[list.length - 1][0]; }
  function assignArch(w, o, clockIds) {
    const style = o.style || "", reg = S.regions[o.region] || {}, k = hash((o.seed || 1) * 7 + 5);
    let arch;
    if (clockIds.has(o)) arch = "clock";
    else if (/Sources Turquoise/.test(reg.name || "")) arch = "pagoda";
    else if (o._merged && LONG[style]) arch = pick(LONG[style], k);
    else arch = pick(MIX[style] || MIX.forest, k);
    const A0 = ARCH[arch], lo = A0.floors[0], hi = A0.floors[1];
    let floors = lo + Math.floor(hash((o.seed || 1) * 13 + 2) * (hi - lo + .999));
    if (o._merged && arch !== "shops" && arch !== "motel" && arch !== "barn") floors += 1;
    if (reg.layout === "hamlet") floors = Math.max(2, floors - 1);
    o._arch = arch; o._roof = A0.roof; o._inside = A0.inside;
    return Math.min(14, Math.max(2, floors));
  }
  // hauteur du dessus du toit au-dessus de o.y + o.h, en coordonnées locales
  const RB = .45;
  function roofTop(o, lx, lz) {
    const r = o._roof || { t: "flat" }, w = o.w, d = o.d, ex = Math.max(0, w - Math.abs(lx)), ez = Math.max(0, d - Math.abs(lz));
    if (r.t === "gz") return RB + ex * r.s;
    if (r.t === "gx") return RB + ez * r.s;
    if (r.t === "hip") return RB + Math.min(ex, ez) * r.s;
    if (r.t === "gam") { const a = w * .5; return RB + (ex < a ? ex * 1.5 : a * 1.5 + (ex - a) * .42); }
    return .24;
  }
  P.__ch1RoofTop = roofTop;
  function upgradeTowns(w) {
    const W = S.MAP.waiting, added = [];
    w._ch1Merged = mergeLots(w);
    // une tour de l'horloge au cœur de chaque grande ville
    const clockIds = new Set();
    S.regions.forEach((reg, ri) => {
      if (reg.style !== "citadel" || reg.layout) return;
      let best = null, bd = 1e9;
      for (const o of w.objects) if (o.type === "house" && !o.dead && o.region === ri && !o._merged) { const dd = Math.hypot(o.x - reg.x, o.z - reg.z); if (dd < bd) { bd = dd; best = o; } }
      if (best) clockIds.add(best);
    });
    for (const o of w.objects) {
      if (o.type !== "house" || o.dead || Math.hypot(o.x - W.x, o.z - W.z) < (W.radius || 82) + 60) continue;
      const k2 = hash((o.seed || 1) * 3 + 11);
      const floors = assignArch(w, o, clockIds);
      if (!o._merged) {
        o.w = Math.min(6.6, Math.max(o.w || 5, 5.5 + k2 * 1.1));
        o.d = Math.min(6.4, Math.max(o.d || o.w, 5.5 + hash(k2 * 977) * .9));
      }
      o.floors = floors; o.h = floors * FLOOR; o.maxHp = o.hp = Math.max(o.hp || 420, 260 + floors * 120);
      if (o.door) { o.door.z = o.z - o.d; o.door.x = o.x; }
      o._panels = null; o._stair = stairOf(o);
      // coffres et butin aux étages (coin opposé à l'escalier)
      for (let f = 1; f < floors; f++) {
        const deck = o.y + f * FLOOR;
        if (f === 1 || f === floors - 1 || (f === 3 && floors >= 6)) { // au plus trois coffres par bâtiment
          const c = toWorld(o, -o.w + 1.3, o.d - 1.4);
          added.push({ kind: "chest", x: c.x, z: c.z, y: deck });
        }
        if (hash((o.seed || 1) + f * 31) < .3) { const l = toWorld(o, -o.w + 2.6, -o.d + 2.2 + hash(f * 17 + (o.seed || 1)) * 2); added.push({ kind: "loot", x: l.x, z: l.z, y: deck + .2 }); }
      }
    }
    for (const a of added) {
      if (a.kind === "chest") { const ch = w._object("chest", a.x, a.z, .8, 1, "wood", 0); ch.y = a.y; ch.floorChest = true; }
      else if (w._dropLoot) w._dropLoot(a.x, a.y, a.z);
    }
    w._staticRef = null; // reconstruire l'index spatial (emprises agrandies)
  }

  /* Les IA ne savent pas monter les escaliers : elles ignorent les coffres des étages
   * (sinon elles resteraient plantées sous un coffre inaccessible). */
  const prevBot = P._bot;
  if (prevBot) P._bot = function (p) {
    const list = this._floorChests || (this._floorChests = this.objects.filter((o) => o.floorChest)), hid = [];
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (!c.opened) { c.opened = true; hid.push(c); } }
    try { return prevBot.apply(this, arguments); } finally { for (let i = 0; i < hid.length; i++) hid[i].opened = false; }
  };

  /* ------------------------------------------------------ surfaces de marche */
  /* Les bâtiments typés (o._arch) sont entièrement traités ici : planchers, volées d'escalier et toit
   * propre au modèle. Pour la requête d'origine (terrain, constructions, rochers), ils sont
   * momentanément ignorés (drapeau dead posé puis rendu dans le même appel). */
  const prevSupport = P.supportAt;
  const _hid = [];
  P.supportAt = function (x, z, currentY) {
    const near = this._objectsAt ? this._objectsAt(x, z) : [];
    const limit = currentY == null ? Infinity : currentY + .8;
    let n = 0;
    for (let i = 0; i < near.length; i++) { const o = near[i]; if (!o.dead && o.type === "house" && o._arch) { o.dead = true; _hid[n++] = o; } }
    let best;
    try { best = prevSupport.call(this, x, z, currentY); } finally { for (let i = 0; i < n; i++) _hid[i].dead = false; }
    for (let i = 0; i < n; i++) {
      const o = _hid[i], q = toLocal(o, x, z);
      _hid[i] = null;
      if (Math.abs(q.x) >= o.w - .25 || Math.abs(q.z) >= o.d - .25) continue;
      const st = o._stair, floors = o.floors || 1;
      let b = -Infinity;
      if (st && floors >= 2 && q.x >= st.x0 && q.x <= st.x1 && q.z >= st.z0 - .3 && q.z <= st.z1 + .3) {
        // dans la cage d'escalier : pas de plancher au-dessus du rez-de-chaussée, seulement les volées
        b = o.y;
        for (let f = 0; f < floors - 1; f++) { const h = flightHeight(o, st, f, q.z); if (h <= limit && h > b) b = h; }
      } else {
        const deck = o.y + Math.max(0, Math.min(floors - 1, Math.floor((limit - o.y) / FLOOR))) * FLOOR;
        if (deck <= limit) b = deck;
      }
      const roof = o.y + o.h + roofTop(o, q.x, q.z);
      if (roof <= limit && roof > b) b = roof;
      if (b > best) best = b;
    }
    return best;
  };
  /* Au-dessus du rez-de-chaussée, la façade nord est pleine (la porte ne fait qu'un étage). */
  const prevBlocked = P._houseBlocked;
  if (prevBlocked) P._houseBlocked = function (o, x, z, r, y) {
    if (prevBlocked.call(this, o, x, z, r, y)) return true;
    if (!o._arch || y == null || y < o.y + 3.1 || y >= o.y + o.h - .05) return false;
    const q = toLocal(o, x, z);
    return Math.abs(q.z + o.d) < .42 + r && Math.abs(q.x) <= 1.8 + r;
  };

  /* ------------------------------------------------------------- dessin */
  if (!A || !A.objectModel || !A.Model || !T) return;
  const prevModel = A.objectModel;
  A.objectModel = function (o) {
    const g = prevModel.apply(this, arguments);
    if (!o || o.type !== "house" || !o._stair) return g;
    try { g.add(details(o)); g.add(ceilings(o)); } catch (e) { if (root.console) console.warn("[AZUR bâtiments] modèle", e); }
    return g;
  };
  const GLASS = ["#3f6f8a", "#4b7f9c", "#35607a"], LIT = "#ffd98a", FRAME = "#eef1ee", SLAB = "#b9b3a6", STEP = "#9c8f7c", RAIL = "#5a5f66";
  // plafonds : sous chaque plancher, matière non éclairée (sinon la lumière d'ambiance du sol les teinte en vert)
  let CEIL = null;
  function ceilings(o) {
    const m = new A.Model(), w = o.w, d = o.d, st = o._stair;
    for (let f = 1; f < (o.floors || 1); f++) {
      const y = f * FLOOR - .215, iw = w - .32, id = d - .32;
      m.box(st.x0 + iw, .02, id * 2, "#d9d3c6", (st.x0 - iw) / 2, y, 0);
      const cw = st.x1 - st.x0 + .3, cx = (st.x0 + st.x1 + .3) / 2, za = -id, zb = st.z0 - .3, zc = st.z1 + .3, zd = id;
      if (zb > za) m.box(cw, .02, zb - za, "#d9d3c6", cx, y, (za + zb) / 2);
      if (zd > zc) m.box(cw, .02, zd - zc, "#d9d3c6", cx, y, (zc + zd) / 2);
    }
    const mesh = m.mesh();
    if (!CEIL) CEIL = new T.MeshBasicMaterial({ vertexColors: true, color: 0xb8b2a6 });
    mesh.material = CEIL; mesh.userData.shared = true; mesh.castShadow = false; return mesh;
  }
  function details(o) {
    const m = new A.Model(), w = o.w, d = o.d, floors = o.floors || 1, st = o._stair;
    // planchers intérieurs, avec la trémie de l'escalier
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR - .1, iw = w - .3, id = d - .3;
      const xa = -iw, xb = st.x0; m.box(xb - xa, .2, id * 2, SLAB, (xa + xb) / 2, y, 0);
      const za = -id, zb = st.z0 - .3; if (zb > za) m.box(st.x1 - st.x0 + .3, .2, zb - za, SLAB, (st.x0 + st.x1 + .3) / 2, y, (za + zb) / 2);
      const zc = st.z1 + .3, zd = id; if (zd > zc) m.box(st.x1 - st.x0 + .3, .2, zd - zc, SLAB, (st.x0 + st.x1 + .3) / 2, y, (zc + zd) / 2);
      // garde-corps le long de la trémie
      m.box(.08, .9, st.z1 - st.z0, RAIL, st.x0 - .05, y + .55, (st.z0 + st.z1) / 2);
    }
    // escaliers : une volée par étage
    const N = 10, L = st.z1 - st.z0, sw = st.x1 - st.x0;
    for (let f = 0; f < floors - 1; f++) {
      for (let i = 0; i < N; i++) {
        const u = (i + .5) / N, lz = f % 2 ? st.z1 - u * L : st.z0 + u * L, top = f * FLOOR + FLOOR * (i + 1) / N;
        m.box(sw, .24, L / N + .04, STEP, (st.x0 + st.x1) / 2, top - .12, lz);
      }
    }
    // fenêtres sur les quatre façades, à chaque étage au-dessus du rez-de-chaussée
    const rnd = (n) => hash((o.seed || 7) * 13 + n);
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR + 1.9;
      for (const side of [-1, 1]) {
        const nx = Math.max(2, Math.floor((w * 2) / 3.1)), nz = Math.max(2, Math.floor((d * 2) / 3.1));
        for (let i = 0; i < nx; i++) { // façades nord (porte) et sud
          const x = -w + (i + .5) * (w * 2 / nx), lit = rnd(f * 97 + i * 7 + side) < .22;
          m.box(1.5, 1.7, .08, FRAME, x, y, side * (d + .3)).box(1.26, 1.46, .1, lit ? LIT : GLASS[(i + f) % 3], x, y, side * (d + .33));
        }
        for (let i = 0; i < nz; i++) { // façades est et ouest
          const z = -d + (i + .5) * (d * 2 / nz), lit = rnd(f * 89 + i * 5 + side * 3) < .22;
          m.box(.08, 1.7, 1.5, FRAME, side * (w + .3), y, z).box(.1, 1.46, 1.26, lit ? LIT : GLASS[(i + f + 1) % 3], side * (w + .33), y, z);
        }
      }
      m.box(w * 2 + .7, .16, d * 2 + .7, FRAME, 0, f * FLOOR, 0); // bandeau d'étage
    }
    // toit-terrasse : acrotère et équipements sur les grands bâtiments
    const flat = ["citadel", "port", "desert", "observatory"].indexOf(o.style) >= 0, h = o.h;
    if (flat) {
      m.box(w * 2 + .5, .7, .3, FRAME, 0, h + .55, -d - .1).box(w * 2 + .5, .7, .3, FRAME, 0, h + .55, d + .1).box(.3, .7, d * 2 + .5, FRAME, -w - .1, h + .55, 0).box(.3, .7, d * 2 + .5, FRAME, w + .1, h + .55, 0);
      if (floors >= 4) {
        m.box(1.8, 1.1, 1.4, "#9aa3ab", -w * .4, h + .8, d * .3).box(1.4, .9, 1.2, "#8b949c", w * .1, h + .7, -d * .4);
        if (floors >= 6) m.cyl(1.1, 1.1, 2.2, "#7b6a58", w * .45, h + 2.6, d * .4, 10).box(.2, 1.6, .2, "#4a4f55", w * .45 - .7, h + .9, d * .4 - .7).box(.2, 1.6, .2, "#4a4f55", w * .45 + .7, h + .9, d * .4 + .7);
      }
    }
    const mesh = m.mesh(); mesh.userData.shared = true; mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
