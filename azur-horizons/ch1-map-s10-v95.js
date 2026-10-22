/* AZUR v95 — ch1-map-s10-v95.js : la carte du jeu dessinée comme la carte de la Saison X.
 * La carte (plein écran et minicarte) est peinte à partir du relief et des biomes de l'île :
 *  - relief ombré (lumière du nord-ouest), herbe vive tachetée, forêts sombres, neige bleutée, désert orangé
 *    avec ses dunes, roche et lave du volcan, plages ;
 *  - eau en trois teintes (bord turquoise, lagons, large bleu profond) avec un liseré d'écume, rivière et lacs ;
 *  - routes grises, rues et maisons des villes ;
 *  - noms des lieux en capitales blanches ombrées (sans cartouche), et trois repères : la météorite (lueur
 *    orange), le Point Zéro de Loot Lake (cercle violet) et la base de lancement (fusée rouge).
 * Ne fait rien sur l'ancienne île (sans map-s8-data.js). À charger après client.js. */
(function (root) {
  "use strict";
  const S = root.AZSim, HP = root.AZURHorizons && root.AZURHorizons.prototype;
  if (!S || !S.s8 || !HP || HP.__s10map) return;
  HP.__s10map = true;
  const HALF = S.MAP.halfSize, SPAN = HALF * 2, N = 400, OUT = 1024; // 400² échantillons : quelques centaines de ms, une seule fois
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const PAL = {
    deep: [21, 94, 160], sea: [28, 128, 190], shallow: [58, 186, 214], foam: [214, 246, 250], lagoon: [72, 205, 210],
    sand: [236, 216, 150], grass: [104, 186, 66], grass2: [132, 202, 78], forest: [40, 118, 54], forest2: [28, 96, 46],
    snow: [236, 243, 248], snowSh: [178, 198, 214], ice: [160, 212, 238], desert: [226, 158, 84], dune: [240, 192, 120], mesa: [196, 118, 66],
    rock: [92, 78, 74], lava: [255, 104, 28], road: [168, 168, 160], street: [196, 192, 176], house: [226, 214, 186], houseEdge: [70, 76, 72],
  };

  function paint() {
    const H = new Float32Array(N * N), WAT = new Uint8Array(N * N), CD = new Float32Array(N * N);
    const cell = SPAN / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + .5) * cell - HALF, z = (j + .5) * cell - HALF, k = j * N + i, cd = S.coastDistance(x, z);
      CD[k] = cd;
      if (cd >= S.MAP.shoreEnd) { WAT[k] = 1; H[k] = -4; continue; }
      H[k] = S.heightAt(x, z);
      WAT[k] = H[k] < -1.2 && S.isWater(x, z) ? 1 : 0;
    }
    const c = document.createElement("canvas"); c.width = c.height = N;
    const ctx = c.getContext("2d"), im = ctx.createImageData(N, N), d = im.data;
    const at = (i, j) => H[clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1)];
    const wet = (i, j) => WAT[clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1)];
    const river = S.s8.riverDist, L = S.LAKE, V = S.VOLCANO;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + .5) * cell - HALF, z = (j + .5) * cell - HALF, k = j * N + i, h = H[k];
      let col;
      if (WAT[k]) {
        // profondeur : turquoise près des côtes, bleu profond au large ; lacs et rivière en eau claire
        let near = 0; for (let r = 1; r <= 6 && !near; r++) if (!wet(i + r, j) || !wet(i - r, j) || !wet(i, j + r) || !wet(i, j - r)) near = r;
        const inland = CD[k] < S.MAP.shoreEnd;
        col = inland ? mix(PAL.lagoon, PAL.shallow, .4) : near ? mix(PAL.shallow, PAL.sea, (near - 1) / 5) : mix(PAL.sea, PAL.deep, clamp((CD[k] - S.MAP.shoreEnd) / 140, 0, 1));
        if (near === 1) col = mix(col, PAL.foam, .55);
      } else {
        const w = S.zoneWeights(x, z), ff = S.forestField(x, z), cd = CD[k], n1 = hash(Math.floor(x / 9), Math.floor(z / 9)), n2 = hash(Math.floor(x / 23) + 7, Math.floor(z / 23));
        col = mix(PAL.grass, PAL.grass2, n2 * .7 + n1 * .3);
        const fk = clamp((ff - .15) / .9, 0, 1); if (fk > 0) col = mix(col, n1 > .5 ? PAL.forest : PAL.forest2, Math.min(1, fk * 1.3) * (.75 + .25 * n1));
        if (w.desert > .02) { const dune = .5 + .5 * Math.sin(x * .09 + Math.sin(z * .05) * 2.5); col = mix(col, mix(PAL.desert, PAL.dune, dune * .28 + n1 * .12), clamp(w.desert * 1.25, 0, 1)); if (h > 20 && w.desert > .5) col = mix(col, PAL.mesa, clamp((h - 20) / 10, 0, .45)); }
        if (w.snow > .02) col = mix(col, mix(PAL.snow, PAL.snowSh, n1 * .25), clamp(w.snow * 1.3, 0, 1));
        if (V && Math.hypot(x - V.x, z - V.z) < V.r) col = mix(col, PAL.rock, clamp((1 - Math.hypot(x - V.x, z - V.z) / V.r) * 1.8, 0, 1));
        if (w.lava > .25 || (V && Math.hypot(x - V.x, z - V.z) < V.crater * .55)) col = mix(col, PAL.lava, clamp((w.lava - .25) * 2.2 + (V && Math.hypot(x - V.x, z - V.z) < V.crater * .55 ? 1 : 0), 0, 1));
        if (cd > S.MAP.shoreStart) col = mix(col, PAL.sand, clamp((cd - S.MAP.shoreStart) / (S.MAP.shoreEnd - S.MAP.shoreStart) * 1.6, 0, 1));
        if (river && river(x, z) < 16 && h < 4) col = mix(col, PAL.sand, .5);
        if (L && Math.hypot(x - L.x, z - L.z) < L.r * 1.3 && h < 3) col = mix(col, PAL.sand, .45);
        // relief ombré (lumière du nord-ouest)
        const sl = (at(i - 1, j - 1) - at(i + 1, j + 1)) * .085;
        let sh = clamp(1 + sl, .62, 1.3); if (w.snow > .3 || w.desert > .3) sh = 1 + (sh - 1) * .6; sh *= .96 + Math.min(.1, h / 600);
        col = [col[0] * sh, col[1] * sh, col[2] * sh];
      }
      d[k * 4] = clamp(col[0], 0, 255); d[k * 4 + 1] = clamp(col[1], 0, 255); d[k * 4 + 2] = clamp(col[2], 0, 255); d[k * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    // agrandi (lissé) puis détails vectoriels nets
    const o = document.createElement("canvas"); o.width = o.height = OUT;
    const g = o.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, OUT, OUT);
    const P = (p) => [(p.x / SPAN + .5) * OUT, (p.z / SPAN + .5) * OUT];
    const line = (pts, wdt, col, cap) => { if (!pts || pts.length < 2) return; g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineWidth = wdt; g.strokeStyle = col; g.lineCap = cap || "round"; g.lineJoin = "round"; g.stroke(); };
    if (S.s8.river) { line(S.s8.river, 7.5, "rgba(214,246,250,.9)"); line(S.s8.river, 5.2, "rgb(64,170,214)"); }
    (S.roads || []).forEach((r) => { line(r, 4.2, "rgba(70,72,70,.55)"); line(r, 2.8, "rgb(" + PAL.road + ")"); });
    (S.streets || []).forEach((r) => line(r, 1.4, "rgba(" + PAL.street + ",.9)"));
    return o;
  }

  const prevBuild = HP.buildMapTexture;
  HP.buildMapTexture = function () {
    try { this.mapTexture = paint(); this.__s10Tex = true; return; } catch (e) { if (root.console) console.warn("[AZUR carte]", e); }
    return prevBuild.apply(this, arguments);
  };

  /* -------------------------------------------------------- repères et noms */
  function marks(ctx, pt, sz, span, full) {
    const k = sz / span, ef = S.s8.eventFrame && S.s8.eventFrame();
    ctx.save();
    // météorite figée : lueur orange et roche sombre
    if (ef) {
      const [x, y] = pt(ef.MET.x, ef.MET.z), r = Math.max(4, 10 * k);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4); gr.addColorStop(0, "rgba(255,170,60,.95)"); gr.addColorStop(.35, "rgba(255,96,30,.7)"); gr.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#3a2c2a"; ctx.beginPath(); ctx.arc(x, y, r * .7, 0, 6.283); ctx.fill();
      // traîne de fumée le long de la trajectoire
      ctx.strokeStyle = "rgba(190,120,170,.55)"; ctx.lineWidth = Math.max(2, r * .8); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ef.MDIR.x * r * 6, y - ef.MDIR.z * r * 6); ctx.stroke();
    }
    // Point Zéro (Loot Lake) : cercle violet lumineux
    const L = S.LAKE;
    if (L) { const [x, y] = pt(L.x, L.z), r = Math.max(3, (L.isle || 20) * k * .9); ctx.strokeStyle = "rgba(190,120,255,.95)"; ctx.lineWidth = Math.max(1.5, 3 * k); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); ctx.fillStyle = "rgba(160,90,255,.45)"; ctx.fill(); }
    // base de lancement : fusée rouge
    const B = S.s8.launch;
    if (B) { const [x, y] = pt(B.x, B.z), s = Math.max(5, 9 * k); ctx.fillStyle = "#e23b2e"; ctx.strokeStyle = "#2a1414"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .42, y + s * .5); ctx.lineTo(x, y + s * .25); ctx.lineTo(x - s * .42, y + s * .5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (full) {
      // noms des lieux : capitales blanches ombrées, comme la carte de la saison
      const fs = Math.round(clamp(sz / 46, 10, 17));
      ctx.font = "800 " + fs + "px BarlowCondensed, 'Arial Narrow', Impact, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const r of S.regions) {
        const [x, y] = pt(r.x, r.z); if (x < -40 || y < -20 || x > sz + 40 || y > sz + 20) continue;
        const t = String(r.name).toUpperCase();
        ctx.lineWidth = Math.max(3, fs * .3); ctx.strokeStyle = "rgba(10,20,30,.85)"; ctx.strokeText(t, x, y);
        ctx.fillStyle = "#ffffff"; ctx.fillText(t, x, y);
      }
    }
    ctx.restore();
  }
  const prevDraw = HP.drawMap;
  HP.drawMap = function (c, full) {
    if (!c || !this.world) return prevDraw.apply(this, arguments);
    if (!this.__s10Tex) { try { this.buildMapTexture(); } catch (e) {} }
    // l'ancienne fonction dessine ses noms dans des cartouches : on les remplace par ceux de la saison
    const regs = S.regions;
    try { S.regions = []; prevDraw.apply(this, arguments); } finally { S.regions = regs; }
    try {
      const w = this.world, p = this.player(); if (!p) return;
      const waiting = w.phase === "waiting"; if (waiting && !full) return;
      const ctx = c.getContext("2d"), sz = c.width;
      const span = full ? SPAN / (this.mapZoom || 1) : Math.min(360, SPAN), cx = full ? this.mapCenter.x : p.x, cz = full ? this.mapCenter.z : p.z;
      const pt = (x, z) => [((x - cx) / span) * sz + sz / 2, ((z - cz) / span) * sz + sz / 2];
      marks(ctx, pt, sz, span, full);
      // le joueur reste au-dessus des noms
      if (full) { const [x, y] = pt(p.x, p.z); ctx.save(); ctx.translate(x, y); ctx.rotate(-p.yaw); ctx.fillStyle = "#fff8d0"; ctx.strokeStyle = "#244259"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); }
    } catch (e) { if (!HP.__s10err) { HP.__s10err = 1; if (root.console) console.warn("[AZUR carte]", e); } }
  };
})(typeof window !== "undefined" ? window : globalThis);
