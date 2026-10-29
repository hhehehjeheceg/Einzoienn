// Scènes de « Pourquoi c'est horrible d'avoir des parents influenceurs ».
// Chaque scène renvoie { w (monde, sous la caméra), ui (interface), cam, cap, … } pour un temps t.
(function () {
  const X = window.PCH;
  const { K, INK, P, F, L, E, G, cel, clamp, lerp, inv, r1, r2, Ez, spring, punch, decay, bump, rng, hash, txt, grp, at, op, rr, fmt, measure,
    rays, ring, sparkles, confetti, hearts, speedLines, flashBurst, springWord, stamp, counter, notif, recUI, ringLight, clapper, bubble, phoneFrame, socialBar,
    room, windowBox, picture, plant, table, bowl, door, balloon, garland, locker, bike, tub, bubbles, duck, diaperPack, cake, phoneObj, shadowE, actor, stateAt, handPos } = X;

  // ------------------------------------------------------------------ minutage (temps film, cf. cues.js)
  const T = {
    titre: 0.38, influenceurs: 2.02,
    vie: 3.76, entiere: 4.08, contenu: 5.24,
    bain: 6.7, deux: 7.26, vues1: 7.95, pas: 8.78, spons: 9.23, couches: 10.42,
    matin: 11.58, imposs: 12.14, cereales: 13.22, attends: 13.95, lumiere: 14.46, bonne: 14.94,
    anniv: 16.6, mere: 17.6, refaire: 18.12, entree: 18.52, sept: 19.16, fois: 19.4,
    tombes: 20.38, velo: 20.66, pere: 21.46, cherche: 21.62, angle: 22.54,
    pleures: 23.6, garde: 24.22, tete: 24.68, parfait: 25.36, miniature: 25.84,
    college: 27.32, connait: 28.28, chambre: 28.68, pyjama: 29.36, surnom: 30.4, bebe: 30.8, choupi: 31.91,
    alors: 33.22, stop: 34.26, caches: 35.06, telephones: 35.78,
    premiere: 37.14, dinez: 38.13, ecran: 38.66, cest: 39.26, genial: 39.54,
    sauf: 41.05, soeur: 41.66, filmait: 41.94, mon: 42.66, frere: 42.78, pete: 43.18, plombs: 43.62, dix: 44.14, millions: 44.3, vues2: 44.75,
    ettoi: 45.75, combien: 46.72, disle: 47.49, abonne: 48.62, like: 49.16, prochain: 49.6, pch: 50.11, horrible: 50.52,
  };

  // ------------------------------------------------------------------ la famille
  const VLOG = `<g transform="translate(0 -486)"><path d="${rr(-58, -26, 116, 52, 14)}" fill="#E5483D" stroke="${INK}" stroke-width="4"/><path d="M-10 -12L14 0L-10 12Z" fill="#FFFFFF"/></g>` +
    `<text x="0" y="-418" font-family="Anton" font-size="34" text-anchor="middle" fill="${INK}" letter-spacing="3">VLOG</text>`;
  const HERO = { body: 'enfant', spec: { hair: 'boucles', freckles: true }, top: 'hoodie', bottom: 'jean',
    pal: { skin: '#E2A77E', hair: '#2A1A12', top: '#3FB6A8', bottom: '#33456E', shoe: '#FBFAF6', shoeAcc: '#F6B53D', iris: '#5A3A22', string: '#FFF6E6', accent: '#F6B53D' } };
  const MOM = { body: 'adulte', spec: { hair: 'long', lash: true }, top: 'tee', sleeve: 'court',
    pal: { skin: '#F2C3A6', hair: '#9C4A2E', top: '#F28CB1', bottom: '#3F5888', iris: '#2FA56A', phone: '#F7A8C8', shoe: '#FBFAF6', shoeAcc: '#F28CB1' } };
  const DAD = { body: 'adulte', spec: { hair: 'court', beard: '#2A1B14', glasses: '#26262E' }, top: 'tee', sleeve: 'court', bottom: 'jogging', motif: VLOG,
    pal: { skin: '#C98E62', hair: '#1E1410', top: '#FFFFFF', bottom: '#4B4E63', shoe: '#22232A', iris: '#3B2418', phone: '#2B2B33' } };
  const SIS = { body: 'petit', spec: { hair: 'queue', lash: true }, top: 'robe', bottom: 'robe',
    pal: { skin: '#EDBE9C', hair: '#F2C94C', top: '#F6D04D', shoe: '#E5483D', socks: '#FFFFFF', iris: '#4FA3CF', phone: '#B48CF2' } };
  const BABY = { body: 'petit', spec: { hair: 'boucles', freckles: false }, top: 'tee', sleeve: 'court', bottom: 'short',
    pal: { skin: '#E2A77E', hair: '#2A1A12', top: '#E2A77E', bottom: '#FFFFFF', shoe: '#E2A77E', sole: '#D9966C', iris: '#5A3A22' } };
  const PJ = Object.assign({}, HERO, { pal: Object.assign({}, HERO.pal, { top: '#7BD389' }) });
  const KID1 = { body: 'ado', spec: { hair: 'tresses', lash: true }, top: 'pull', bottom: 'jean', pal: { skin: 'brun', hair: '#24160F', top: '#F6B53D', bottom: '#2F3B55', iris: '#3B2418', phone: '#E5483D' } };
  const KID2 = { body: 'ado', spec: { hair: 'casquette' }, top: 'hoodie', bottom: 'jogging', pal: { skin: '#F2C9AC', hair: '#5A3A22', top: '#E5483D', bottom: '#4B4E63', accent: '#26262E', iris: '#4FA3CF', phone: '#26262E' } };
  const KID3 = { body: 'ado', spec: { hair: 'afro' }, top: 'tee', bottom: 'short', pal: { skin: '#8A5A3C', hair: '#1E1410', top: '#B48CF2', bottom: '#33456E', iris: '#3B2418', phone: '#4FA3CF' } };

  const cam0 = (z = 1, fx = 540, fy = 960, o = {}) => Object.assign({ z, fx, fy, rot: 0 }, o);
  // cœurs en continu (live)
  function heartStream(x, y, t, t0, t1, rate, seed) {
    let s = '';
    for (let i = Math.floor((t - 2.4 - t0) * rate); i <= Math.floor((t - t0) * rate); i++) {
      if (i < 0) continue;
      const tb = t0 + i / rate; if (tb > t1) break;
      const dt = t - tb; if (dt < 0 || dt > 2.4) continue;
      const k = dt / 2.4, r = rng(seed + i * 7);
      const xx = x + Math.sin(dt * 3 + r() * 6) * 30 + (r() - 0.5) * 60, yy = y - Ez.out(k) * 620, sc = (0.9 + r() * 0.6) * Math.min(1, dt * 6) * (1 - Ez.in(k));
      s += `<path d="${X.HEART}" fill="${['#F25C7A', '#FF8FA8', '#E5483D', '#FFB3C6'][i % 4]}" stroke="${INK}" stroke-width="3.5" transform="${at(xx, yy, sc * 1.3, Math.sin(dt * 4 + i) * 14)}"/>`;
    }
    return s;
  }
  function liveBadge(x, y, t, viewers) {
    const n = fmt(viewers);
    const w = measure(n, 40, 'Brico', 800) + 70;
    return grp(`<path d="${rr(0, -30, 120, 60, 12)}" fill="#E5483D" stroke="${INK}" stroke-width="4"/>` + txt(60, 13, 'LIVE', 38, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      `<path d="${rr(130, -30, w, 60, 12)}" fill="#000" fill-opacity=".55"/>` + grp(`<path d="M-18 0Q0 -14 18 0Q0 14 -18 0Z" fill="#FFFFFF"/><circle r="6" fill="#333"/>`, 'translate(162 0)') + txt(188, 14, n, 36, '#FFFFFF', { anchor: 'start' }), at(x, y));
  }

  // ================================================================== 1. accroche (0 – 3.3)
  const K1 = {
    hero: [[0, { g: 'repos', expr: 'blase', x: 540, y: 1690 }], [0.52, { g: 'sursaut', expr: 'surpris', d: 0.16 }], [0.95, { g: 'cache_yeux', expr: 'fatigue', exprOver: { lidT: 0.7 } }],
      [1.9, { g: 'bras_croises_boude', expr: 'boude', turn: 0 }], [2.7, { g: 'bras_croises_boude', expr: 'vexe', tilt: 6 }]],
    mom: [[0, { g: 'filme', expr: 'excite', x: 170, y: 1780, turn: 0.45, lean: 4, rec: true }], [1.4, { g: 'selfie', expr: 'clin', turn: 0.2, d: 0.4 }], [2.3, { g: 'filme', expr: 'excite', turn: 0.45 }]],
    dad: [[0, { g: 'filme_deux_mains', expr: 'excite', x: 905, y: 1790, turn: -0.45, rec: true }], [1.1, { g: 'filme_deux_mains', expr: 'concentre', crouch: 0.25, lean: -6, d: 0.4 }], [2.2, { g: 'pouce_d', expr: 'joie', crouch: 0, d: 0.35 }]],
  };
  const FL1 = [0.5, 0.86, 1.25, 1.62, 2.04, 2.4, 2.78];
  function s1(t) {
    let w = room({ wall: '#F7DCE4', stripe: '#F3D0DA', floor: '#C9926A', fy: 1500 });
    w += windowBox(110, 520, 300, 330, '#BFE6F5', { sun: true }) + picture(800, 600, 200, 150, '#F6B53D', 3) + picture(760, 820, 120, 150, '#4FA3CF', -4) + plant(960, 1500, 1.1);
    w += ringLight(310, 900, t, 1, 0.95);
    w += actor(HERO, K1.hero, t, { seed: 3 });
    w += actor(MOM, K1.mom, t, { seed: 5, rec: Math.floor(t * 2) % 2 === 0 });
    w += actor(DAD, K1.dad, t, { seed: 8, rec: Math.floor(t * 2 + 1) % 2 === 0 });
    // éclairs des téléphones
    FL1.forEach((f, i) => { w += flashBurst(i % 2 ? 900 : 305, i % 2 ? 1290 : 1110, t, f, 1.0); });
    let ui = liveBadge(60, 140 + 0, t, 1200 + Math.floor(Ez.out(inv(0, 3.3, t)) * 48300));
    ui += heartStream(980, 1560, t, 0.2, 3.3, 7, 11);
    // titre
    const tk = spring(t, T.titre - 0.08, 2.2, 0.6);
    const card = `<path d="${rr(-480, -180, 960, 360, 40)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>`;
    let title = card + springWord(0, -96, 'POURQUOI C’EST HORRIBLE', 62, t, T.titre, { fill: '#FFD23F', sw: 0, stag: 0.02, dy: 40, ls: 3 });
    title += springWord(0, -6, 'D’AVOIR DES PARENTS', 64, t, 1.39, { fill: '#FFFFFF', sw: 0, stag: 0.02, dy: 40, ls: 2 });
    title += grp(springWord(0, 0, 'INFLUENCEURS', 96, t, T.influenceurs, { fill: '#F28CB1', stroke: '#FFFFFF', sw: 0, stag: 0.03, dy: 60, ls: 4 }), `translate(0 128) scale(${r2(1 + 0.08 * punch(t, T.influenceurs + 0.4, 6, 20))})`);
    ui += grp(title, `translate(540 ${r1(330 + (1 - tk) * -420)}) rotate(${r1(-2 + Math.sin(t * 1.4) * 0.6)})`);
    ui += sparkles(540, 450, t, T.influenceurs + 0.35, 14, 420, 21, ['#FFFFFF', '#F28CB1', '#FFE27A']);
    const fl = Math.max(...FL1.map(f => decay(t, f, 14) * (t >= f ? 0.35 : 0)));
    const shake = Math.max(...FL1.map(f => decay(t, f, 10))) * 5;
    return { w, ui, cam: cam0(1.02 + 0.06 * Ez.io(inv(0, 3.3, t)), 540, 1180, { shake }), flash: fl, cap: false };
  }

  // ================================================================== 2. ta vie = du contenu (3.3 – 6.15)
  const CARDS = [3.3, 3.98, 4.52, 4.98];
  const K2 = {
    bed: [[0, { expr: 'fatigue', exprOver: { closed: 1, zzz: 1 }, x: 540, y: 1150, scale: 1.3, tilt: -78 }], [T.vie, { expr: 'choque', tilt: -78, d: 0.12 }]],
    desk: [[0, { g: 'reflechit', expr: 'pense', x: 540, y: 1700 }], [4.25, { g: 'gratte_tete', expr: 'gene' }]],
    wc: [[0, { g: 'stop_deux', expr: 'panique', x: 600, y: 1700, turn: -0.2 }], [4.75, { g: 'stop_deux', expr: 'crie' }]],
    live: [[0, { g: 'repos', expr: 'blase', x: 540, y: 1700 }], [T.contenu, { g: 'oh_non', expr: 'choque', d: 0.15 }], [5.75, { g: 'oh_non', expr: 'terrifie' }]],
  };
  function card2(i, t) {
    let w = '';
    if (i === 0) {
      w += room({ wall: '#3B3F6B', stripe: '#383C66', floor: '#2C2F52', fy: 1500 }) + windowBox(640, 380, 280, 300, '#1B1E3A', { cloud: false }) + E(860, 460, 30, 30, '#FFF3B0', 0);
      w += cel('M120 1000H960V1560H120Z', '#5A6FB5', { dx: 20, dy: 12 }) + cel('M200 1000Q540 930 880 1000V1080H200Z', '#FFFFFF', { dx: 0, dy: 8 });
      w += grp(K.person(Object.assign({}, HERO, { headOnly: true, t, face: Object.assign(K.expr(t < T.vie ? 'fatigue' : 'choque', t < T.vie ? { closed: 1, zzz: 1 } : {}), {}) })), 'translate(540 1010) rotate(-8) scale(1.25)');
      w += cel('M140 1110Q540 1060 940 1110V1540H140Z', '#F6B53D', { dx: 24, dy: 10, inner: L('M140 1200Q540 1160 940 1200', '#E89F2A', 6) });
      w += flashBurst(780, 760, t, T.vie - 0.04, 1.3);
    } else if (i === 1) {
      w += room({ wall: '#DDEFE3', stripe: '#D2E9DA', floor: '#B98A62', fy: 1480 }) + picture(300, 520, 220, 160, '#F28CB1', -3) + picture(760, 470, 160, 200, '#4FA3CF', 2);
      w += actor(HERO, K2.desk, t, { seed: 4 });
      w += table(540, 1380, 760, 44, '#B5794A', 300) + cel('M330 1330H500V1380H330Z', '#FFFFFF', { dx: 4, dy: 4, sw: 5 }) + L('M350 1350H480M350 1364H460', '#9AA4C8', 3) + phoneObj(700, 1340, 0.9, 80);
    } else if (i === 2) {
      w += room({ wall: '#CFE6F2', stripe: '#C4DDEB', floor: '#9FB6C4', fy: 1480, planks: false }) + door(270, 1480, 280, 600, 0.55, '#E5E0D6');
      w += grp(cel(`M-60 -40H60V40H-60Z`, '#FFFFFF', { dx: 3, dy: 3, sw: 5 }) + txt(0, 16, 'WC', 46, INK, { font: 'Anton', weight: 400 }), 'translate(270 760)');
      w += actor(HERO, K2.wc, t, { seed: 6 });
      w += bubble(780, 760, 360, 170, 'PAS ICI !!', 64, t, 4.62, { shout: true, font: 'Anton', fill: '#FFE27A', tail: [-120, 110] });
    } else {
      w += room({ wall: '#F7DCE4', stripe: '#F3D0DA', floor: '#C9926A', fy: 1500 }) + windowBox(120, 520, 300, 330, '#BFE6F5', { sun: true }) + plant(960, 1500, 1.1);
      w += actor(HERO, K2.live, t, { seed: 3 });
    }
    return w;
  }
  const LBL2 = ['bonne nuit mon cœur 💤', 'devoirs en famille ✏️', 'il est trop drôle 😂', 'ma vie, mes règles'];
  function s2(t) {
    let i = CARDS.findIndex((c, j) => t >= c && (j === CARDS.length - 1 || t < CARDS[j + 1]));
    if (i < 0) i = 0;
    let w = '';
    const sw = i > 0 ? Ez.io(inv(CARDS[i], CARDS[i] + 0.22, t)) : 1;
    if (sw < 1) w += grp(card2(i - 1, t), `translate(0 ${r1(-sw * 1920)})`);
    w += grp(card2(i, t), `translate(0 ${r1((1 - sw) * 1920)})`);
    let ui = `<rect y="1500" width="1080" height="420" fill="url(#fadeB)"/>`;
    ui += socialBar(980, 1080, t, 12000 + Ez.out(inv(3.3, 6.1, t)) * 980000, 1800 + Math.floor((t - 3.3) * 2400), { tLike: CARDS[i] + 0.25 });
    ui += txt(60, 1600, '@lafamilleparfaite', 46, '#FFFFFF', { anchor: 'start', stroke: INK, sw: 9 }) + grp(`<circle r="20" fill="#4FA3CF" stroke="#FFFFFF" stroke-width="4"/><path d="M-9 0L-2 8L10 -7" fill="none" stroke="#FFFFFF" stroke-width="5"/>`, `translate(${r1(84 + measure('@lafamilleparfaite', 46))} 1586)`);
    ui += txt(60, 1660, LBL2[i].replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, '').trim() + '  #contenu', 38, '#FFFFFF', { anchor: 'start', weight: 600, stroke: INK, sw: 7 });
    ui += grp(`<path d="M0 0H1080" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="6"/><path d="M0 0H${r1(1080 * inv(CARDS[i], CARDS[i + 1] || 6.15, t))}" stroke="#FFFFFF" stroke-width="6"/>`, 'translate(0 1890)');
    ui += stamp(540, 820, 'CONTENU', t, T.contenu, { size: 170, col: '#E5483D', rot: -9 });
    ui += ring(540, 820, t, T.contenu + 0.16, 0.5, 700, '#FFFFFF', 30);
    const sh = 18 * decay(t, T.contenu + 0.16, 8);
    return { w, ui, cam: cam0(1, 540, 960, { shake: sh }), flash: 0.45 * decay(t, T.contenu + 0.16, 12) * (t > T.contenu + 0.16 ? 1 : 0), capY: 1420 };
  }

  // ================================================================== 3. premier bain (6.15 – 8.15)
  const K3 = {
    baby: [[0, { g: 'saute_joie', expr: 'rire', x: 470, y: 1560, crouch: 0.4 }], [6.9, { g: 'victoire', expr: 'joie', crouch: 0.4 }], [7.3, { g: 'saute_joie', expr: 'rire', crouch: 0.4 }], [7.85, { g: 'bras_croises', expr: 'honte', crouch: 0.5, d: 0.25 }]],
    mom: [[0, { g: 'filme', expr: 'excite', x: 910, y: 1800, turn: -0.5, lean: -10, rec: true }], [7.3, { g: 'filme_deux_mains', expr: 'joie', turn: -0.4, lean: -6 }]],
  };
  function s3(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="2100" fill="#CDEBF5"/>`;
    for (let x = -600; x < 1700; x += 110) w += L(`M${x} -600V1500`, '#B6DDEB', 4);
    for (let y = -600; y < 1500; y += 110) w += L(`M-600 ${y}H1700`, '#B6DDEB', 4);
    w += `<rect x="-600" y="1500" width="2280" height="600" fill="#8FC2D6"/>` + L('M-600 1500H1700', INK, 5);
    w += grp(cel('M-40 0H40V40H-40Z', '#C9CCD6', { dx: 4, dy: 4, sw: 5 }) + L('M0 40V100Q0 130 40 130', '#C9CCD6', 14) + L('M0 40V100Q0 130 40 130', INK, 4), 'translate(150 1180)');
    w += actor(BABY, K3.baby, t, { seed: 9 });
    w += tub(470, 1520, 1, t) + bubbles(470, 1408, 560, t, 3, 16) + duck(300 + Math.sin(t * 2) * 20, 1395 + Math.sin(t * 3) * 6, 0.9, Math.sin(t * 3) * 6);
    // éclaboussures
    for (const tt0 of [6.3, 6.85, 7.4]) { const k = inv(tt0, tt0 + 0.6, t); if (k > 0 && k < 1) for (let j = 0; j < 7; j++) { const a = -Math.PI / 2 + (j - 3) * 0.32, d = Ez.out(k) * 220; w += E(470 + Math.cos(a) * d, 1390 + Math.sin(a) * d + k * k * 260, 12 * (1 - k) + 4, 16 * (1 - k) + 5, '#9BD8F2', 3); } }
    w += actor(MOM, K3.mom, t, { seed: 5 });
    let ui = notif(t, 6.45, 70, 'INSTAGRAM', '@maman.influence a publié', 'PREMIER BAIN DE BÉBÉ (trop mignon)', { col: '#E1306C', t1: 7.15 });
    ui += counter(540, 400, t, T.deux, 7.95, 2000000, 'VUES', { size: 120 });
    ui += hearts(540, 700, t, 7.95, 14, 31, { w: 600, h: 420 }) + sparkles(540, 400, t, 7.95, 14, 440, 33);
    return { w, ui, cam: cam0(1.08 + 0.04 * Ez.io(inv(6.15, 8.15, t)), 560, 1250), capY: 1720 };
  }

  // ================================================================== 4. premiers pas (8.15 – 11.25)
  const K4 = {
    baby: [[0, { g: 'haut_large', expr: 'concentre', x: 210, y: 1720, armsOver: { l: 'haut_large', r: 'haut_large' } }], [8.3, { x: 560, d: 1.3, e: 'lin', g: 'haut_large', expr: 'concentre' }],
      [9.6, { g: 'victoire', expr: 'joie', x: 560 }], [10.4, { g: 'repos', expr: 'blase', exprOver: { lx: 0.8 }, x: 560 }], [10.75, { g: 'repos', expr: 'blase', x: 560, crouch: 1, d: 0.2, e: 'io' }]],
    dad: [[0, { g: 'filme_deux_mains', expr: 'excite', x: 880, y: 1800, crouch: 0.55, turn: -0.4, lean: -8, rec: true }], [9.35, { g: 'presente', expr: 'excite', exprOver: { smile: 1, open: 0.6 }, crouch: 0, turn: -0.15, lean: 0, d: 0.35 }],
      [10.42, { g: 'deux_pouces', expr: 'excite', exprOver: { wide: 1.4 } }]],
  };
  function s4(t) {
    let w = room({ wall: '#E8E1F7', stripe: '#E0D7F3', floor: '#C99B6D', fy: 1500 }) + windowBox(640, 470, 300, 330, '#BFE6F5', { sun: true }) + picture(250, 560, 200, 150, '#7BD389', -2);
    w += cel('M-40 1250H330Q380 1250 380 1300V1500H-40Z', '#4FA3CF', { dx: 18, dy: 10 });
    const walking = t > 8.3 && t < 9.6;
    w += actor(BABY, K4.baby, t, { seed: 9, walk: walking ? 6.5 : 0, walkAmp: 0.7, tilt: walking ? Math.sin(t * 6.5) * 6 : 0 });
    w += actor(DAD, K4.dad, t, { seed: 8 });
    // le paquet de couches tombe du ciel
    if (t > 9.75) { const k = inv(9.75, 10.05, t), y = lerp(-300, 1500, Ez.in(k)), sq = t > 10.05 ? punch(t, 10.05, 8, 30) * 0.15 : 0; w += grp(diaperPack(0, -170, 1), `translate(330 ${r1(y)}) scale(${r2(1 + sq)} ${r2(1 - sq)})`) + shadowE(330, 1505, 150 * clamp(k), 0.15); }
    let ui = '';
    if (t > T.spons) {
      const k = spring(t, T.spons, 2.4, 0.6);
      ui += grp(`<path d="${rr(-330, -48, 660, 96, 20)}" fill="#FFD23F" stroke="${INK}" stroke-width="6"/>` + txt(0, 20, 'SPONSORISÉ', 62, INK, { font: 'Anton', weight: 400, ls: 5 }), `translate(540 ${r1(lerp(-120, 230, k))}) rotate(-2)`);
      ui += grp(`<path d="${rr(-250, -38, 500, 76, 38)}" fill="#1C1418"/>` + txt(0, 14, 'code BEBE20  -20 %', 40, '#FFFFFF'), `translate(540 ${r1(lerp(2200, 1720, spring(t, 10.1, 2.4, 0.6)))})`);
    }
    ui += sparkles(330, 1300, t, 10.05, 14, 360, 41) + ring(330, 1330, t, 10.05, 0.5, 420, '#FFFFFF', 22);
    return { w, ui, cam: cam0(1.05, 560, 1240, { shake: 14 * decay(t, 10.05, 9) * (t > 10.05 ? 1 : 0) }), capY: 1420 };
  }

  // ================================================================== 5. céréales + lumière (11.25 – 16.2)
  const K5 = {
    hero: [[0, { arms: { l: { at: [-150, -330], hand: 'relax', bend: 1, handAbs: 30 }, r: { at: [150, -330], hand: 'fist', bend: 1, handAbs: -60 } }, expr: 'fatigue', x: 540, y: 1660, crouch: 0.25 }],
      [T.imposs, { arms: { l: { at: [-150, -330], hand: 'relax', bend: 1, handAbs: 30 }, r: { at: [60, -470], hand: 'fist', bend: 1, handAbs: -120 } }, expr: 'joie', exprOver: { open: 1 }, d: 0.5 }],
      [T.attends, { arms: { l: { at: [-150, -330], hand: 'relax', bend: 1, handAbs: 30 }, r: { at: [70, -475], hand: 'fist', bend: 1, handAbs: -120 } }, expr: 'surpris', exprOver: { lx: 0.9 }, d: 0.15 }],
      [14.9, { expr: 'blase', exprOver: { lx: 0.9 }, arms: { l: { at: [-150, -330], hand: 'relax', bend: 1, handAbs: 30 }, r: { at: [70, -475], hand: 'fist', bend: 1, handAbs: -120 } } }],
      [15.3, { g: 'epuise', expr: 'fatigue', exprOver: { lidT: 0.8 }, crouch: 0.6, nod: 0.8, d: 0.3 }]],
    mom: [[0, { g: 'stop', expr: 'panique', x: 1350, y: 1780, flip: true, turn: 0.4 }], [13.7, { g: 'stop', expr: 'panique', x: 880, d: 0.35, e: 'io' }],
      [T.lumiere, { g: 'pointe_haut', expr: 'concentre', x: 880 }], [T.bonne, { g: 'filme', expr: 'enerve', x: 880, turn: -0.35, rec: true }], [15.3, { g: 'filme', expr: 'concentre', x: 880, crouch: 0.2, rec: true }]],
  };
  function spoon(x, y, rot, t, drip) {
    let g = L('M0 0L0 -120', '#C9CCD6', 12) + L('M0 0L0 -120', INK, 3) + cel('M-22 -120Q-26 -170 0 -172Q26 -170 22 -120Q0 -104 -22 -120Z', '#C9CCD6', { dx: 3, dy: 3, sw: 5 }) + E(0, -138, 16, 12, '#FFFDF4', 0);
    if (drip) { const k = ((t * 1.6) % 1); g += E(0, -110 + k * 140, 6, 9, '#FFFFFF', 3, op(1 - k)); }
    return grp(g, at(x, y, 0.62, rot));
  }
  function s5(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="2100" fill="#FFE7A8"/>`;
    for (let x = -600; x < 1700; x += 90) for (let y = 760; y < 1100; y += 90) w += `<rect x="${x + 4}" y="${y + 4}" width="82" height="82" rx="8" fill="#FFF3CF"/>`;
    w += `<rect x="-600" y="1500" width="2280" height="900" fill="#C99B6D"/>` + L('M-600 1500H1700', INK, 5);
    w += cel('M-40 1060H1120V1120H-40Z', '#F4F1EA', { dx: 0, dy: 10 }) + windowBox(110, 300, 360, 380, '#BFE6F5', { sun: true }) + cel('M700 240H1000V700H700Z', '#E5483D', { dx: 16, dy: 0, inner: L('M720 470H980M960 300V420M960 520V640', INK, 5) });
    const late = t > 15.3;
    const lit = t > T.lumiere ? Ez.out(inv(T.lumiere, T.lumiere + 0.25, t)) * (1 - 0.15 * Math.sin(t * 30) * decay(t, T.lumiere, 4)) : 0;
    w += ringLight(lerp(-260, 170, Ez.io(inv(14.15, 14.45, t))), 820, t, lit, 1.05);
    w += actor(HERO, K5.hero, t, { seed: 3 });
    const hp = handPos(HERO, K5.hero, t, 1);
    if (!late) w += spoon(hp[0] - 6, hp[1] - 4, lerp(-150, -62, Ez.io(inv(T.imposs, T.imposs + 0.5, t))), t, t > T.attends);
    w += cel('M110 1500H970V1780H110Z', '#C9852E', { dx: 20, dy: 0, inner: L('M140 1560H940M140 1640H940M140 1720H940', '#B5752A', 5) }) + table(540, 1460, 900, 48, '#E59E2A', 60) + bowl(540, 1440, 1.1, late ? 1 : 0);
    if (late) w += grp(L('M-10 0Q0 -10 10 0', INK, 3) + E(0, 0, 5, 4, INK, 0), `translate(${r1(600 + Math.sin(t * 9) * 60)} ${r1(1240 + Math.cos(t * 13) * 30)})`);
    w += actor(MOM, K5.mom, t, { seed: 5 });
    let ui = bubble(760, 520, 380, 190, 'ATTENDS !', 70, t, T.attends, { shout: true, font: 'Anton', fill: '#FFFFFF', tail: [120, 160], t1: 14.9 });
    ui += bubble(700, 560, 560, 190, 'PAS BONNE, LA LUMIÈRE !', 44, t, 14.6, { font: 'Brico', fill: '#FFFFFF', tail: [140, 150], t1: 15.25 });
    if (late) {
      const k = spring(t, 15.3, 2.4, 0.6);
      ui += grp(`<path d="${rr(-380, -56, 760, 112, 18)}" fill="#1C1418" stroke="#FFD23F" stroke-width="6"/>` + txt(0, 20, '12 MINUTES PLUS TARD…', 58, '#FFD23F', { font: 'Anton', weight: 400, ls: 3 }), `translate(${r1(lerp(-500, 540, k))} 320) rotate(-2)`);
    }
    return { w, ui, cam: cam0(lerp(1.05, 1.15, Ez.io(inv(13.95, 14.6, t))), lerp(540, 600, inv(13.95, 14.6, t)), 1220, { shake: 8 * decay(t, T.attends, 8) * (t > T.attends ? 1 : 0) }), sat: late ? 0.75 : 1, capY: 1700 };
  }

  // ================================================================== 6. anniversaire, 7 prises (16.2 – 20.1)
  const TAKES = [16.6, 18.52, 18.92, 19.06, 19.2, 19.32, 19.42];
  const takeAt = t => { let i = 0; TAKES.forEach((a, j) => { if (t >= a) i = j; }); return i; };
  const K6 = {
    hero: [[0, { g: 'ta_da', expr: 'joie', x: 260, y: 1720 }]],
    mom: [[0, { g: 'filme', expr: 'excite', x: 880, y: 1790, turn: -0.4, rec: true }], [T.mere, { g: 'stop', expr: 'crie', turn: -0.4 }], [18.4, { g: 'filme', expr: 'concentre', turn: -0.4, rec: true }], [19.4, { g: 'filme', expr: 'ravi', turn: -0.4, rec: true }]],
  };
  const TAKE_EXPR = ['joie', 'content', 'ok', 'blase', 'fatigue', 'ennui', 'epuise'];
  function s6(t) {
    let w = room({ wall: '#F7D9B5', stripe: '#F2CFA6', floor: '#C99B6D', fy: 1500 });
    w += garland(250, 11, t) + balloon(140, 820, '#E5483D', t, 1) + balloon(960, 760, '#4FA3CF', t, 2) + balloon(1010, 900, '#F6B53D', t, 3);
    const ti = takeAt(t), ta = TAKES[ti];
    const rew = t > T.refaire && t < T.entree;
    const dk = rew ? 1 - inv(T.refaire, T.entree - 0.05, t) : Ez.out(inv(ta - 0.1, ta + 0.25, t));
    w += door(250, 1500, 300, 620, clamp(dk + 0.05), '#B5794A');
    // le héros fait son entrée (à chaque prise un peu moins enthousiaste)
    const enter = rew ? 1 - inv(T.refaire, T.entree - 0.05, t) : Ez.back(inv(ta, ta + 0.3, t));
    const ex = TAKE_EXPR[ti], g = ti >= 5 ? 'epuise' : ti >= 3 ? 'repos' : 'ta_da';
    const heroK = [[0, { g, expr: ex, x: 260, y: 1720, exprOver: ti >= 4 ? { lidT: 0.6 + ti * 0.03 } : {} }]];
    if (enter > 0.02) {
      w += actor(HERO, heroK, t, { seed: 3 + ti, x: lerp(-60, 210, clamp(enter)), jump: ti < 2 ? 40 * bump(t, ta, ta + 0.35) : 0, scale: 1 });
      // chapeau pointu
      const hx = lerp(-60, 210, clamp(enter)) + 260, hy = 1720 - 690 + (ti >= 5 ? 30 : 0);
      w += grp(cel('M-50 0L0 -140L50 0Q0 16 -50 0Z', '#4FA3CF', { dx: 8, dy: 6 }) + L('M-32 -34L28 -50M-18 -76L18 -88', '#FFE27A', 6) + E(0, -146, 14, 14, '#F6B53D', 4), `translate(${r1(hx)} ${r1(hy)}) rotate(${ti >= 5 ? 28 : -10})`);
    }
    w += table(760, 1420, 520, 40, '#F4F1EA', 300) + cake(760, 1350, 0.9, t);
    w += actor(MOM, K6.mom, t, { seed: 5 });
    if (ti < 2) w += confetti(300, 900, t, ta + 0.2, 40, 51 + ti);
    let ui = '';
    ui += bubble(700, 470, 470, 200, 'COUPEZ ! ENCORE !', 52, t, 17.75, { shout: true, font: 'Anton', fill: '#FFFFFF', tail: [140, 170], t1: 18.45 });
    if (rew) { ui += `<rect width="1080" height="1920" fill="#000" opacity=".15"/>` + txt(540, 980, '◀◀', 200, '#FFFFFF', { stroke: INK, sw: 14 }); for (let i = 0; i < 6; i++) { const y = ((t * 2600 + i * 330) % 1920); ui += `<rect x="0" y="${r1(y)}" width="1080" height="${10 + (i % 3) * 8}" fill="#FFFFFF" opacity=".35"/>`; } }
    if (t >= T.entree && t < T.fois) ui += grp(clapper(0, 0, t, ta + 0.02, ti + 1, 1.05, -6), `translate(540 ${r1(330 - 30 * decay(t, ta, 10))})`);
    if (ti >= 6) ui += stamp(540, 620, 'PRISE 7', t, T.fois, { size: 110, col: '#E5483D', rot: 8 });
    const fl = ti >= 2 ? 0.5 * decay(t, ta, 16) : 0;
    return { w, ui, cam: cam0(1.06, 560, 1220, { shake: ti >= 2 ? 10 * decay(t, ta, 12) : 0 }), flash: fl, capY: 1700, rgb: rew ? 8 : 0 };
  }

  // ================================================================== 7. chute de vélo (20.1 – 23.2)
  const K7 = {
    rider: [[0, { arms: { l: { at: [-150, -400], hand: 'fist', bend: 1, handAbs: -80 }, r: { at: [150, -400], hand: 'fist', bend: 1, handAbs: 80 } }, expr: 'joie', crouch: 0.4 }]],
    fallen: [[0, { g: 'supplie', expr: 'sonne', x: 0, y: 0 }], [21.9, { g: 'supplie', expr: 'pleure', exprOver: { closed: 0, lidT: 0.3 } }]],
    dad: [[0, { g: 'filme_deux_mains', expr: 'excite', x: 1300, y: 1780, flip: true, rec: true }], [T.pere, { g: 'filme_deux_mains', expr: 'concentre', x: 830, d: 0.45, e: 'io', rec: true }],
      [T.cherche, { g: 'filme_deux_mains', expr: 'concentre', x: 830, crouch: 0.28, lean: -8, rec: true }], [22.1, { g: 'filme_deux_mains', expr: 'concentre', x: 790, crouch: 0.2, lean: 10, tilt: -10, rec: true }],
      [T.angle, { g: 'pouce_d', expr: 'excite', x: 790, crouch: 0, lean: 0, tilt: 0 }]],
  };
  function park(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="2000" fill="#9FD9F2"/>` + E(880, 300, 90, 90, '#FFE27A', 0) + E(880, 300, 130, 130, '#FFE27A', 0, 'opacity=".25"');
    w += P('M150 420q30 -50 90 -30q40 -40 90 6q50 -6 50 34h-230z', '#FFFFFF', 0) + P('M560 560q24 -40 70 -24q34 -30 70 4q40 -4 40 26h-180z', '#FFFFFF', 0);
    w += `<path d="M-600 1180Q300 1060 1700 1200V2400H-600Z" fill="#8CCB6E" stroke="${INK}" stroke-width="5"/>`;
    w += cel('M60 1240V820H120V1240Z', '#8A5A3C', { dx: 12, dy: 0 }) + cel('M-80 860C-120 640 60 520 120 560C220 480 330 620 280 760C340 860 220 960 90 920C-10 980 -100 940 -80 860Z', '#5FB57A', { dx: 24, dy: 14 });
    w += `<path d="M-600 1560Q540 1480 1700 1580V1760Q540 1660 -600 1760Z" fill="#E8D7B0" stroke="${INK}" stroke-width="5"/>`;
    w += cel('M560 1625Q600 1580 650 1600Q680 1625 660 1640H570Z', '#9AA0A8', { dx: 6, dy: 4 });
    return w;
  }
  function s7(t) {
    let w = park(t);
    if (t < T.tombes) {
      const x = lerp(-120, 420, inv(20.1, T.tombes, t));
      w += speedLines(x, 1500, t, 0, 1);
      w += actor(HERO, K7.rider, t, { seed: 3, x, y: 1560, scale: 0.85, lift: [40, 0] });
      w += bike(x, 1640, 0.95, 0, -t * 20);
    } else {
      const k = inv(T.tombes, 20.85, t);
      const fx = lerp(470, 640, Ez.out(k)), fy = 1650 - Math.sin(Math.PI * clamp(k)) * 300, rot = lerp(0, 82, Ez.out(k));
      w += bike(lerp(470, 380, Ez.out(k)), 1640 + 10 * clamp(k), 0.95, lerp(0, -70, Ez.out(k)), -T.tombes * 20 - (t - T.tombes) * 14 * Math.exp(-(t - T.tombes)));
      w += grp(actor(HERO, K7.fallen, t, { seed: 3, scale: 0.85 }), `translate(${r1(fx)} ${r1(fy)}) rotate(${r1(rot)} 0 -260)`);
      if (t > 20.85) { for (let i = 0; i < 4; i++) { const a = t * 4 + i * Math.PI / 2; w += grp(`<path d="${X.STAR(16)}" fill="#FFE27A" stroke="${INK}" stroke-width="3"/>`, at(fx + 300 + Math.cos(a) * 80, fy - 260 + Math.sin(a) * 26)); } }
      w += sparkles(560, 1620, t, T.tombes + 0.3, 10, 240, 61, ['#FFFFFF', '#E8D7B0']);
    }
    w += actor(DAD, K7.dad, t, { seed: 8, walk: t > T.pere - 0.05 && t < T.cherche + 0.1 ? 9 : 0, walkAmp: 1.2 });
    let ui = '';
    // viseur qui cherche l'angle
    if (t > T.cherche) {
      const k = inv(T.cherche, T.angle, t), seq = [[0, 1], [-14, 1.15], [90, 0.8], [8, 1.05], [0, 1]];
      const f = clamp(k * 4), i0 = Math.min(3, Math.floor(f)), kk = Ez.io(f - i0), ang = lerp(seq[i0][0], seq[i0 + 1][0], kk), sc = lerp(seq[i0][1], seq[i0 + 1][1], kk);
      const fr = `<path d="${rr(-260, -340, 520, 680, 30)}" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="40 24"/>` + L('M-87 -340V340M87 -340V340M-260 -113H260M-260 113H260', '#FFFFFF', 2) + `<circle r="14" fill="none" stroke="#FFD23F" stroke-width="5"/>`;
      ui += grp(fr, `translate(560 1180) rotate(${r1(ang)}) scale(${r2(sc)})`, op(t > T.angle + 0.5 ? 1 - inv(T.angle + 0.5, T.angle + 0.8, t) : 1));
      ui += txt(560, 760, t < T.angle ? 'ANGLE ?' : 'PARFAIT !', 72, t < T.angle ? '#FFFFFF' : '#7BD389', { font: 'Anton', weight: 400, stroke: INK, sw: 12, ls: 3 });
    }
    return { w, ui, cam: cam0(1.0 + 0.06 * inv(20.1, 23.2, t), 600, 1230, { shake: 16 * decay(t, 20.8, 9) * (t > 20.8 ? 1 : 0) }), flash: t > T.angle ? 0.6 * decay(t, T.angle, 14) : 0, capY: 1760 };
  }

  // ================================================================== 8. tu pleures -> miniature (23.2 – 26.9)
  const K8 = { hero: [[0, { g: 'pleure', expr: 'sanglote', x: 540, y: 1820, scale: 1.75 }], [T.pleures, { g: 'pleure', expr: 'pleure' }], [24.4, { g: 'triste', expr: 'sanglote', exprOver: { stream: 1 } }]] };
  function s8(t) {
    const frz = t > T.tete ? T.tete : t;
    let w = `<rect x="-600" y="-600" width="2280" height="3000" fill="#9FD9F2"/>` + `<path d="M-600 1500Q540 1400 1700 1520V2600H-600Z" fill="#8CCB6E" stroke="${INK}" stroke-width="5"/>`;
    w += actor(HERO, K8.hero, frz, { seed: 3 });
    // larmes qui volent
    for (let i = 0; i < 10; i++) { const tt = (frz * 1.4 + i * 0.1) % 1, sd = i % 2 ? 1 : -1; w += P(`M0 -12Q10 4 0 12Q-10 4 0 -12Z`, '#7FD3F7', 3).replace('<path', `<path transform="${at(540 + sd * (150 + tt * 260), 1060 - Math.sin(tt * Math.PI) * 120 + tt * 160, 1.6 * (1 - tt * 0.5))}"`); }
    let ui = '';
    ui += bubble(560, 330, 640, 200, 'GARDE CETTE TÊTE !', 58, t, T.garde, { shout: true, font: 'Anton', fill: '#FFFFFF', tail: [220, 160], t1: T.miniature - 0.1 });
    const th = Ez.io(inv(T.miniature, T.miniature + 0.45, t));
    if (t > T.tete) ui += `<rect width="1080" height="1920" fill="#FFFFFF" ${op(0.7 * decay(t, T.tete, 10))}/>`;
    // la miniature : bordure, flèche, cercle, gros texte
    if (th > 0) {
      ui += `<rect x="20" y="20" width="1040" height="1880" fill="none" stroke="#E5483D" stroke-width="${r1(40 * th)}"/>`;
      const ak = spring(t, T.miniature + 0.15, 2.6, 0.5);
      ui += grp(`<path d="M0 -40H160V-90L280 0L160 90V40H0Z" fill="#E5483D" stroke="#FFFFFF" stroke-width="10"/>`, `translate(110 1420) rotate(-40) scale(${r2(ak)})`);
      ui += `<circle cx="540" cy="1050" r="${r1(300 * spring(t, T.miniature + 0.25, 2.6, 0.5))}" fill="none" stroke="#E5483D" stroke-width="18"/>`;
      ui += grp(springWord(0, 0, 'IL A PLEURÉ !!', 130, t, T.miniature + 0.05, { fill: '#FFD23F', sw: 16, stag: 0.03 }), 'translate(540 380) rotate(-4)');
      ui += grp(`<path d="${rr(-80, -34, 160, 68, 10)}" fill="#000" fill-opacity=".8"/>` + txt(0, 16, '12:47', 44, '#FFFFFF', { font: 'Anton', weight: 400 }), `translate(920 1800) scale(${r2(spring(t, T.miniature + 0.35, 2.6, 0.6))})`);
      ui += grp(`<path d="${rr(-110, -36, 220, 72, 36)}" fill="#E5483D"/>` + txt(0, 16, 'ÉMOUVANT', 40, '#FFFFFF', { font: 'Anton', weight: 400, ls: 2 }), `translate(200 160) rotate(-6) scale(${r2(spring(t, T.miniature + 0.45, 2.6, 0.6))})`);
    }
    const shrink = Ez.io(inv(26.2, 26.9, t));
    return { w, ui, cam: cam0(1, 540, 960), sat: t > T.tete ? lerp(1, 1.35, th) : 1, capY: 1650, cap: true, frame: shrink };
  }

  // ================================================================== 9. collège : Choupinou (26.9 – 33.0)
  const K9 = {
    hero: [[0, { g: 'mains_poches', expr: 'content', x: -150, y: 1720 }], [27.0, { g: 'mains_poches', expr: 'content', x: 540, d: 1.2, e: 'io' }], [T.connait, { g: 'repos', expr: 'gene', x: 540 }],
      [T.pyjama, { g: 'gene', expr: 'gene', x: 540 }], [T.choupi, { g: 'cache_yeux', expr: 'honte', exprOver: { flush: 1, sweat: 1 }, x: 540, crouch: 0.3, scale: 0.9, d: 0.25 }]],
    a: [[0, { g: 'telephone', expr: 'ennui', x: 160, y: 1780, turn: 0.3 }], [T.connait, { g: 'telephone', expr: 'moqueur', turn: 0.4 }], [30.5, { g: 'se_moque_d', expr: 'rire', turn: 0.4 }], [T.choupi, { g: 'telephone_rire', expr: 'rire', turn: 0.3 }]],
    b: [[0, { g: 'telephone', expr: 'ennui', x: 930, y: 1790, turn: -0.3 }], [28.5, { g: 'telephone', expr: 'moqueur', turn: -0.4 }], [30.8, { g: 'se_moque_g', expr: 'rire', turn: -0.4 }], [T.choupi, { g: 'se_moque_g', expr: 'pouffe', turn: -0.4 }]],
    c: [[0, { g: 'telephone', expr: 'ennui', x: 760, y: 1560, scale: 0.8, turn: -0.2 }], [29.0, { g: 'pointe_g', expr: 'moqueur', turn: -0.3 }], [T.choupi, { g: 'telephone_rire', expr: 'rire' }]],
  };
  // mini-écrans au-dessus des élèves
  function miniRoom(t) { return `<rect x="-200" y="-300" width="400" height="600" fill="#FCE3B0"/>` + cel('M-170 120H170V250H-170Z', '#4FA3CF', { dx: 10, dy: 6 }) + cel('M-170 90H-60V130H-170Z', '#FFFFFF', { dx: 0, dy: 4, sw: 4 }) + picture(60, -140, 120, 90, '#E5483D', 4) + picture(-90, -170, 80, 100, '#7BD389', -6) + txt(0, 290, 'ROOM TOUR', 40, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 8 }); }
  function miniPJ(t) {
    let s = `<rect x="-200" y="-300" width="400" height="600" fill="#3B3F6B"/>`;
    s += grp(K.person(Object.assign({}, PJ, { t, expr: 'gene', exprOver: { flush: 0.6 }, x: 0, y: 0, arms: { l: [10, -10, 'relax'], r: [10, -10, 'relax'] } })) +
      [0, 1, 2, 3].map(i => P(`M${-20 + i * 2} ${-420 + i * 50}l26 -16l0 32z`, '#5FB57A', 4)).join(''), 'translate(0 290) scale(.62)');
    return s + txt(0, -240, 'PYJAMA DINO', 40, '#7BD389', { font: 'Anton', weight: 400, stroke: INK, sw: 8 });
  }
  function s9(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="2100" fill="#F2EEE4"/>` + `<rect x="-600" y="1500" width="2280" height="600" fill="#BFC6CF"/>` + L('M-600 1500H1700', INK, 5);
    for (let i = 0; i < 10; i++) w += L(`M${-600 + i * 260} 1500L${-900 + i * 340} 2100`, '#AEB6C0', 4);
    w += locker(-80, 1500, '#4FA3CF', 3) + locker(640, 1500, '#F28CB1', 3);
    w += grp(cel('M-160 -60H160V60H-160Z', '#FFFFFF', { dx: 6, dy: 6 }) + txt(0, 20, 'COLLÈGE', 54, INK, { font: 'Anton', weight: 400, ls: 3 }), 'translate(540 420) rotate(-1)');
    w += actor(KID3, K9.c, t, { seed: 13 });
    w += actor(HERO, K9.hero, t, { seed: 3, walk: t > 27.0 && t < 28.2 ? 7 : 0 });
    w += actor(KID1, K9.a, t, { seed: 11 });
    w += actor(KID2, K9.b, t, { seed: 12 });
    let ui = '';
    const p1 = spring(t, T.chambre, 2.4, 0.55) * (1 - Ez.in(inv(31.6, 31.85, t)));
    if (p1 > 0.01) ui += grp(phoneFrame(0, 0, 400, 600, miniRoom(t), { id: 'm1' }), `translate(250 640) rotate(-6) scale(${r2(p1 * 0.72)})`);
    const p2 = spring(t, T.pyjama, 2.4, 0.55) * (1 - Ez.in(inv(31.6, 31.85, t)));
    if (p2 > 0.01) ui += grp(phoneFrame(0, 0, 400, 600, miniPJ(t), { id: 'm2' }), `translate(840 610) rotate(6) scale(${r2(p2 * 0.72)})`);
    if (t > 30.75) ui += grp(springWord(0, 0, 'BÉBÉ ?', 90, t, 30.8, { fill: '#FFFFFF', stag: 0.04 }), 'translate(540 420)', op(1 - inv(31.7, 31.9, t)));
    if (t > T.choupi) {
      const k = spring(t, T.choupi, 2.2, 0.45);
      ui += rays(540, 760, 22, 1600, t * 0.4, '#FFFFFF', 0.25 * clamp(k));
      ui += grp(springWord(0, 0, 'CHOUPINOU', 150, t, T.choupi, { font: 'Anton', fill: '#FF8FC0', stroke: '#FFFFFF', sw: 18, stag: 0.04, rot: 18 }), `translate(540 ${r1(560 + Math.sin(t * 3) * 10)}) rotate(${r1(-5 + Math.sin(t * 2.4) * 2)})`);
      ui += hearts(540, 760, t, T.choupi + 0.1, 18, 91, { w: 800, h: 500, size: 1.9 });
    }
    return { w, ui, cam: cam0(lerp(1.12, 1.2, inv(30.5, 33, t)), 540, 1330, { shake: 9 * decay(t, T.choupi, 7) * (t > T.choupi ? 1 : 0) }), capY: 1420 };
  }

  // ================================================================== 10. tu dis stop (33.0 – 36.7)
  const K10 = {
    hero: [[0, { g: 'poings_serres', expr: 'enerve', x: 540, y: 1700 }], [T.alors, { g: 'poings_serres', expr: 'determine' }], [T.stop - 0.06, { g: 'stop_deux', expr: 'crie', lean: -4, d: 0.14 }],
      [T.caches, { arms: { l: { at: [-120, -330], hand: 'open', bend: 1, handAbs: 70 }, r: { at: [120, -330], hand: 'open', bend: 1, handAbs: -70 } }, expr: 'malin', lean: 0 }], [36.1, { arms: { l: { at: [-120, -330], hand: 'open', bend: 1, handAbs: 70 }, r: { at: [120, -330], hand: 'open', bend: 1, handAbs: -70 } }, expr: 'fier' }]],
    mom: [[0, { g: 'telephone', expr: 'concentre', x: 170, y: 1780, turn: 0.3 }], [T.stop, { g: 'sursaut', expr: 'choque', d: 0.15 }], [35.25, { g: 'stop_deux', expr: 'panique', turn: 0.4 }], [T.telephones, { g: 'deux_mains_bouche', expr: 'terrifie' }]],
    dad: [[0, { g: 'filme_deux_mains', expr: 'concentre', x: 910, y: 1790, turn: -0.3, rec: true }], [T.stop, { g: 'sursaut', expr: 'choque', d: 0.15 }], [35.45, { g: 'oh_non', expr: 'panique', turn: -0.4 }], [T.telephones, { g: 'desespoir', expr: 'sanglote' }]],
  };
  function s10(t) {
    let w = room({ wall: '#D9E6F7', stripe: '#CFDEF3', floor: '#B98A62', fy: 1500 }) + windowBox(120, 480, 280, 320, '#F7B26B', { cloud: false }) + picture(820, 560, 200, 150, '#F28CB1', 2);
    if (t > T.stop - 0.06) {
      const k = spring(t, T.stop - 0.06, 2.4, 0.45);
      w += grp(cel('M-150 -362H150L362 -150V150L150 362H-150L-362 150V-150Z', '#E5483D', { dx: 30, dy: 20, sw: 12 }) + `<path d="M-130 -316H130L316 -130V130L130 316H-130L-316 130V-130Z" fill="none" stroke="#FFFFFF" stroke-width="16"/>` + txt(0, 70, 'STOP', 230, '#FFFFFF', { font: 'Anton', weight: 400, ls: 6 }), `translate(540 840) rotate(${r1((1 - k) * -30)}) scale(${r2(clamp(k, 0, 1.3) * 0.85)})`, op(t > T.caches ? 1 - inv(T.caches, T.caches + 0.3, t) : 1));
    }
    w += actor(MOM, K10.mom, t, { seed: 5 });
    w += actor(DAD, K10.dad, t, { seed: 8 });
    w += actor(HERO, K10.hero, t, { seed: 3 });
    // le carton : les téléphones y volent
    if (t > T.caches - 0.1) {
      const bk = spring(t, T.caches - 0.1, 2.4, 0.6);
      const bx = 540, by = 1460;
      let box = cel('M-150 -40H150V150H-150Z', '#C98E5A', { dx: 18, dy: 10 }) + txt(0, 70, 'TÉLÉPHONES', 40, INK, { font: 'Anton', weight: 400, ls: 2 }) + L('M-150 -40L-190 -100M150 -40L190 -100', INK, 6) + P('M-150 -40L-190 -100H-40L0 -40Z', '#B97E4A', 5) + P('M150 -40L190 -100H40L0 -40Z', '#B97E4A', 5);
      w += grp(box, `translate(${bx} ${r1(by + (1 - bk) * 200)}) scale(${r2(clamp(bk, 0, 1.2))})`);
      [[200, 1150, 35.2, '#F7A8C8'], [880, 1180, 35.4, '#2B2B33'], [150, 1250, 35.55, '#4FA3CF'], [940, 1240, 35.7, '#F6B53D']].forEach(([x0, y0, t0, c], i) => {
        const k = inv(t0, t0 + 0.4, t);
        if (k > 0 && k < 1) w += phoneObj(lerp(x0, bx, k), lerp(y0, by - 60, k) - Math.sin(Math.PI * k) * 260, 0.8, k * 720 * (i % 2 ? 1 : -1), { col: c });
      });
    }
    let ui = ring(540, 840, t, T.stop, 0.6, 900, '#FFFFFF', 34);
    if (t > T.telephones + 0.1) ui += sparkles(540, 1380, t, T.telephones + 0.15, 12, 300, 101);
    return { w, ui, cam: cam0(1.04 + 0.06 * decay(t, T.stop, 3) * (t > T.stop ? 1 : 0), 540, 1200, { shake: 22 * decay(t, T.stop, 7) * (t > T.stop ? 1 : 0) }), capY: 1420, flash: t > T.stop ? 0.4 * decay(t, T.stop, 12) : 0 };
  }

  // ================================================================== 11. dîner sans écran (36.7 – 40.8)
  const K11 = {
    mom: [[0, { g: 'gene', expr: 'gene', x: 170, y: 1660, scale: 0.85, turn: 0.3 }], [T.dinez, { g: 'repos', expr: 'content', turn: 0.2 }], [T.cest, { g: 'applaudit', expr: 'rire' }]],
    dad: [[0, { g: 'gratte_tete', expr: 'gene', x: 410, y: 1670, scale: 0.85, turn: 0.1 }], [T.dinez, { g: 'repos', expr: 'content' }], [T.cest, { g: 'se_moque_d', expr: 'rire' }]],
    hero: [[0, { g: 'repos', expr: 'timide', x: 670, y: 1640, scale: 0.85, turn: -0.1 }], [T.dinez, { g: 'repos', expr: 'content' }], [T.genial, { g: 'v_victoire', expr: 'ravi' }]],
    sis: [[0, { g: 'repos', expr: 'content', x: 905, y: 1600, scale: 0.85, turn: -0.3 }], [T.cest, { g: 'applaudit', expr: 'rire' }], [40.15, { g: 'mains_dos_innocent', expr: 'malin', exprOver: { lx: -1, ly: 0.2 }, turn: -0.5 }]],
  };
  function dinner(t) {
    let w = room({ wall: '#F2C9A0', stripe: '#EDBF92', floor: '#9C6B48', fy: 1440 }) + windowBox(400, 380, 280, 300, '#3B3F6B', { cloud: false }) + E(610, 450, 22, 22, '#FFF3B0', 0) + picture(180, 520, 160, 120, '#F6B53D', -3) + picture(900, 500, 150, 190, '#7BD389', 2);
    w += L('M540 -100V250', INK, 5) + cel('M440 250H640L700 340H380Z', '#F6B53D', { dx: 16, dy: 8 }) + `<ellipse cx="540" cy="700" rx="600" ry="520" fill="#FFE7A8" opacity=".25" filter="url(#soft)"/>`;
    w += actor(MOM, K11.mom, t, { seed: 5 }) + actor(DAD, K11.dad, t, { seed: 8 }) + actor(HERO, K11.hero, t, { seed: 3 }) + actor(SIS, K11.sis, t, { seed: 14 });
    w += cel('M-60 1350H1140V1440H-60Z', '#F4F1EA', { dx: 0, dy: 14 }) + L('M-60 1380Q60 1430 180 1380Q300 1430 420 1380Q540 1430 660 1380Q780 1430 900 1380Q1020 1430 1140 1380', '#E5483D', 5);
    w += cel('M-60 1440H1140V2200H-60Z', '#B5794A', { dx: 0, dy: 0 });
    [170, 410, 670, 905].forEach((x, i) => { w += E(x, 1360, 100, 26, '#FFFFFF', 5) + E(x, 1352, 60, 12, ['#E5483D', '#F6B53D', '#7BD389', '#F28CB1'][i], 0); });
    w += cel('M520 1250Q540 1180 560 1250V1350H520Z', '#7BD389', { dx: 4, dy: 0, sw: 5 });
    return w;
  }
  function s11(t) {
    let w = dinner(t);
    let ui = '';
    if (t > T.ecran - 0.1) {
      const k = spring(t, T.ecran - 0.1, 2.4, 0.5);
      ui += grp(phoneObj(0, 0, 1.6, 0) + `<circle r="150" fill="none" stroke="#E5483D" stroke-width="22"/>` + L('M-106 -106L106 106', '#E5483D', 22), `translate(540 520) scale(${r2(k)})`, op(t > 39.5 ? 1 - inv(39.5, 39.8, t) : 1));
    }
    if (t > T.cest) ui += hearts(540, 1100, t, T.cest, 16, 111, { w: 900, h: 600 }) + sparkles(540, 760, t, T.genial, 16, 500, 113);
    return { w, ui, cam: cam0(lerp(1.28, 1.34, inv(36.7, 40.8, t)), 540, 1240), capY: 1720 };
  }

  // ================================================================== 12a. sauf que… la sœur filmait (40.8 – 42.6)
  const K12 = { sis: [[0, { g: 'filme_deux_mains', expr: 'malin', x: 540, y: 1720, scale: 1.7, rec: true }], [42.25, { g: 'filme_deux_mains', expr: 'pouffe', rec: true }]] };
  function s12a(t) {
    const frozen = t < T.soeur;
    let w, ui = '';
    if (frozen) {
      w = dinner(40.6);
      const k = Ez.io(inv(T.sauf, T.soeur, t));
      w += `<circle cx="905" cy="1180" r="${r1(lerp(1400, 300, k) + 700)}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="1400"/>`;
      ui += grp(springWord(0, 0, 'SAUF QUE…', 120, t, T.sauf + 0.05, { fill: '#FFFFFF', stag: 0.03 }), 'translate(540 360) rotate(-3)');
      return { w, ui, cam: cam0(lerp(1.28, 1.9, Ez.io(inv(T.sauf, T.soeur, t))), lerp(540, 880, Ez.io(inv(T.sauf, T.soeur, t))), lerp(1240, 1180, inv(T.sauf, T.soeur, t))), sat: 0.2, capY: 1700, vign: 0.6 };
    }
    w = `<rect x="-600" y="-600" width="2280" height="3200" fill="#F2C9A0"/>` + `<ellipse cx="540" cy="900" rx="700" ry="600" fill="#FFE7A8" opacity=".3" filter="url(#soft)"/>`;
    w += actor(SIS, K12.sis, t, { seed: 14, rec: Math.floor(t * 3) % 2 === 0 });
    w += cel('M-60 1500H1140V2200H-60Z', '#B5794A', { dx: 0, dy: 0 });
    ui += recUI(t, { t0: T.soeur, op: 0.9 });
    return { w, ui, cam: cam0(1.0 + 0.03 * inv(T.soeur, 42.6, t), 540, 960), capY: 1700 };
  }

  // ================================================================== 12b. « Mon frère pète les plombs » : 10 millions (42.6 – 45.5)
  const K12b = {
    clip: [[0, { g: 'stop_deux', expr: 'crie', x: 0, y: 0 }], [43.5, { g: 'furieux', expr: 'rouge' }], [44.0, { g: 'trepigne', expr: 'crie' }]],
    hero: [[0, { g: 'repos', expr: 'neutre', x: 540, y: 2120, scale: 1.6 }], [T.vues2, { g: 'deux_mains_bouche', expr: 'terrifie', d: 0.2 }]],
  };
  function s12b(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="3200" fill="#2A2238"/>` + rays(540, 900, 24, 2000, t * 0.3, '#33294A');
    // l'écran du téléphone de la sœur
    let inner = room({ wall: '#D9E6F7', stripe: '#CFDEF3', floor: '#B98A62', fy: 220 }).replace(/x="-600"/g, 'x="-400"');
    inner = `<g transform="translate(0 0)">${room({ wall: '#D9E6F7', stripe: '#CFDEF3', floor: '#B98A62', fy: 250 })}</g>`;
    inner += grp(actor(HERO, K12b.clip, t, { seed: 3, jump: t > 44 ? Math.abs(Math.sin(t * 12)) * 40 : 0 }), 'translate(0 560) scale(.85)');
    inner += `<rect x="-330" y="-560" width="660" height="230" fill="url(#fadeT)"/>` + txt(-300, -470, 'MON FRÈRE PÈTE', 58, '#FFFFFF', { anchor: 'start', font: 'Anton', weight: 400, ls: 2, stroke: INK, sw: 8 }) + txt(-300, -400, 'LES PLOMBS 😂'.replace(/\s?😂/, ' MDR'), 58, '#FFD23F', { anchor: 'start', font: 'Anton', weight: 400, ls: 2, stroke: INK, sw: 8 });
    inner += socialBar(270, 120, t, 40000 + Ez.o5(inv(T.dix, 44.9, t)) * 4600000, 2000 + Math.floor(Ez.o5(inv(T.dix, 44.9, t)) * 98000), { tLike: T.dix });
    inner += txt(-300, 520, '@la_petite_soeur', 38, '#FFFFFF', { anchor: 'start', stroke: INK, sw: 8 });
    const pk = spring(t, 42.6, 2.4, 0.6), out = Ez.io(inv(T.vues2 - 0.05, T.vues2 + 0.3, t));
    w += grp(phoneFrame(0, 0, 660, 1120, inner, { id: 'big', bg: '#D9E6F7' }), `translate(${r1(540 - out * 160)} ${r1(lerp(1500, 900, pk) - out * 200)}) rotate(${r1(lerp(10, -3, pk) - out * 8)}) scale(${r2(lerp(1, 0.62, out))})`);
    if (t > T.vues2 - 0.05) w += actor(HERO, K12b.hero, t, { seed: 3, fx: { pale: 0.6, sweat: 1 } });
    let ui = '';
    ui += notif(t, 43.2, 70, 'TIKTOK', '@la_petite_soeur', 'Ta vidéo devient virale !', { col: '#1C1418', when: 'maintenant', t1: 44.05 });
    ui += notif(t, 43.55, 240, 'TIKTOK', '+ 50 000 abonnés', '', { col: '#1C1418', t1: 44.1 });
    ui += notif(t, 43.85, 410, 'MESSAGES', 'Tout le collège', 'MDRRR CHOUPINOU', { col: '#7BD389', t1: 44.15 });
    if (t > T.dix) ui += counter(540, t > T.vues2 ? 640 : 1580, t, T.dix, 44.75, 10000000, 'VUES', { size: 120, col: '#FF8FC0' });
    ui += hearts(540, 1500, t, T.dix + 0.1, 20, 121, { w: 900, h: 700, size: 1.8 });
    ui += sparkles(540, 640, t, T.vues2, 16, 460, 123, ['#FFFFFF', '#FF8FC0', '#FFE27A']);
    return { w, ui, cam: cam0(1, 540, 960, { shake: 12 * decay(t, T.vues2, 7) * (t > T.vues2 ? 1 : 0) }), flash: t > T.vues2 ? 0.35 * decay(t, T.vues2, 12) : 0, capY: t > T.vues2 - 0.05 ? 1740 : 1420, cap: t > T.vues2 - 0.3 ? true : true };
  }

  // ================================================================== 13. Et toi ? (45.5 – 48.4)
  const K13 = { hero: [[0, { g: 'je_sais_pas', expr: 'pense', x: 540, y: 1760, scale: 1.05 }], [T.combien, { g: 'reflechit', expr: 'pense' }], [T.disle, { g: 'pointe_avant' in {} ? 'toi' : 'toi', expr: 'malin' }]] };
  function s13(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="3200" fill="#6C4BD8"/>` + rays(540, 900, 22, 2200, t * 0.25, '#7A5BE0');
    w += actor(HERO, K13.hero, t, { seed: 3 });
    let ui = '';
    const qk = spring(t, T.ettoi - 0.1, 2.4, 0.45);
    ui += grp(txt(0, 0, '?', 380, '#FFD23F', { font: 'Anton', weight: 400, stroke: INK, sw: 20 }), `translate(${r1(860 + Math.sin(t * 2) * 10)} ${r1(700 + Math.sin(t * 3) * 14)}) rotate(${r1(12 + Math.sin(t * 2.2) * 6)}) scale(${r2(qk)})`);
    // chronomètre qui tourne
    const ck = spring(t, T.combien - 0.2, 2.4, 0.55);
    if (ck > 0.01) {
      const a = (t - T.combien) * 720;
      ui += grp(`<circle r="130" fill="#FFFFFF" stroke="${INK}" stroke-width="10"/><rect x="-24" y="-176" width="48" height="36" rx="8" fill="${INK}"/>` + L(`M0 0L${r1(Math.sin(a * Math.PI / 180) * 100)} ${r1(-Math.cos(a * Math.PI / 180) * 100)}`, '#E5483D', 10) + `<circle r="12" fill="${INK}"/>` +
        Array.from({ length: 12 }, (_, i) => L(`M${r1(Math.sin(i * Math.PI / 6) * 104)} ${r1(-Math.cos(i * Math.PI / 6) * 104)}L${r1(Math.sin(i * Math.PI / 6) * 118)} ${r1(-Math.cos(i * Math.PI / 6) * 118)}`, INK, 6)).join(''), `translate(220 600) scale(${r2(ck)})`);
    }
    // barre de commentaire qui s'écrit
    if (t > T.disle - 0.2) {
      const k = spring(t, T.disle - 0.2, 2.4, 0.6), typed = 'Moi 2 secondes MDR'.slice(0, Math.floor(clamp((t - 47.8) * 14, 0, 18)));
      const cur = Math.floor(t * 3) % 2 ? '|' : '';
      ui += grp(`<path d="${rr(-470, -60, 940, 120, 60)}" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/>` + `<circle cx="-400" cy="0" r="38" fill="#3FB6A8"/>` +
        txt(-340, 16, typed ? typed + cur : 'Ajouter un commentaire…' + cur, 42, typed ? INK : '#9A94A0', { anchor: 'start', weight: typed ? 800 : 600 }) + grp(`<path d="M-20 -20L24 0L-20 20L-10 0Z" fill="#E5483D"/>`, 'translate(410 0)'), `translate(540 ${r1(lerp(2100, 1620, k))})`);
    }
    return { w, ui, cam: cam0(1.0 + 0.04 * Math.sin(t * 0.8), 540, 1150), capY: 1420 };
  }

  // ================================================================== 14. abonne-toi / like / prochain (48.4 – 55)
  const K14 = {
    hero: [[0, { g: 'coucou_d', expr: 'content', x: 380, y: 1650 }], [T.abonne, { g: 'pointe_haut', expr: 'excite' }], [T.like, { g: 'pouce_d', expr: 'joie' }], [51.7, { g: 'repos', expr: 'blase', exprOver: { lx: 0.9 }, turn: 0.3 }], [52.4, { g: 'stop', expr: 'enerve', turn: 0.4 }]],
    sis: [[0, { g: 'filme_deux_mains', expr: 'malin', x: 1300, y: 1650, flip: true, rec: true }], [50.6, { g: 'filme_deux_mains', expr: 'malin', x: 830, d: 0.6, e: 'io', rec: true }], [52.5, { g: 'filme_deux_mains', expr: 'pouffe', x: 830, rec: true }]],
  };
  function thumb() { return P('M-34 -6H-10L8 -54Q14 -66 26 -60Q38 -54 34 -36L28 -10H58Q72 -10 70 6L62 50Q58 62 46 62H-10V-6Z', '#FFFFFF', 6) + P('M-56 -6H-24V62H-56Z', '#FFFFFF', 6); }
  function bell(rot) { return grp(P('M0 -44Q30 -44 32 -6L36 22Q38 30 46 34H-46Q-38 30 -36 22L-32 -6Q-30 -44 0 -44Z', '#FFFFFF', 6) + `<circle cx="0" cy="44" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`, `rotate(${r1(rot)} 0 -44)`); }
  function s14(t) {
    let w = `<rect x="-600" y="-600" width="2280" height="3200" fill="#F6B53D"/>` + rays(540, 900, 22, 2400, t * 0.2, '#F9C55E');
    w += `<rect x="-800" y="1500" width="2700" height="900" fill="#E59E2A"/>` + L('M-800 1500H1900', INK, 5);
    w += actor(HERO, K14.hero, t, { seed: 3 });
    w += actor(SIS, K14.sis, t, { seed: 14, walk: t > 50.6 && t < 51.2 ? 8 : 0, rec: Math.floor(t * 3) % 2 === 0 });
    let ui = '';
    const bIn = spring(t, 48.45, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = P(rr(-380, -80, 760, 160, 80), done ? '#3A3A42' : '#E5483D', 7) + txt(done ? 40 : 0, 28, done ? 'ABONNÉ' : 'S’ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    const fade = 1 - Ez.io(inv(T.prochain, T.prochain + 0.35, t));
    let cta = grp(btn, `translate(540 ${r1(330 + (1 - bIn) * -400)}) scale(${r2(bIn * pr)})`);
    cta += ring(540, 330, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 330, t, press, 16, 460, 141);
    const cur = inv(48.5, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 360, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
    if (t < press + 0.9) cta += grp(P('M0 0L0 70L18 54L32 86L46 80L32 48L56 48Z', '#FFFFFF', 6), `translate(${r1(cx)} ${r1(cy)}) scale(${cs * 1.4})`, op(1 - inv(press + 0.5, press + 0.9, t)));
    const lk = spring(t, T.like, 2.6, 0.45);
    if (lk > 0.01) {
      cta += grp(`<circle r="110" fill="#4FA3CF" stroke="${INK}" stroke-width="7"/>` + grp(thumb(), 'translate(-6 4) scale(1.15)'), `translate(540 620) rotate(${r1((1 - lk) * -30)}) scale(${r2(lk)})`);
      cta += sparkles(540, 620, t, T.like, 18, 380, 142, ['#FFFFFF', '#4FA3CF', '#FFE27A']) + ring(540, 620, t, T.like, 0.6, 520, '#FFFFFF', 18);
    }
    ui += `<g ${op(fade)}>${cta}</g>`;
    if (t > T.prochain) {
      const k = spring(t, T.prochain, 2.2, 0.6);
      const card = `<path d="${rr(-470, -170, 940, 340, 40)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>` + txt(0, -80, 'PROCHAIN ÉPISODE', 40, '#FFFFFF', { ls: 6, weight: 700 }) +
        springWord(0, 10, 'POURQUOI', 86, t, T.pch, { fill: '#FFD23F', sw: 0, stag: 0.03, dy: 50, ls: 3 }) + springWord(0, 112, 'C’EST HORRIBLE…', 86, t, T.horrible, { fill: '#FFFFFF', sw: 0, stag: 0.03, dy: 50, ls: 3 });
      ui += grp(card, `translate(540 ${r1(lerp(-300, 470, k))}) rotate(${r1(-2 + Math.sin(t * 1.3) * 0.8)})`);
      const sh = inv(51.3, 52.0, t) * 1400 - 700;
      ui += `<clipPath id="shn"><rect x="${r1(540 + sh - 60)}" y="300" width="120" height="360" transform="skewX(-20)"/></clipPath>`;
      ui += `<g clip-path="url(#shn)" opacity=".5"><rect x="0" y="300" width="1080" height="360" fill="#FFFFFF"/></g>`;
    }
    if (t > 52.5) ui += bubble(620, 760, 360, 170, 'ARRÊTE !', 70, t, 52.5, { shout: true, font: 'Anton', fill: '#FFFFFF', tail: [-60, 150] });
    return { w, ui, cam: cam0(1 + 0.03 * Math.sin(t * 0.7), 540, 1160), cap: t < 51.2, capY: 1420 };
  }

  X.T = T;
  X.SCENES = [
    { f: s1, a: 0, b: 3.3 },
    { f: s2, a: 3.3, b: 6.15, tin: 'swipe', d: 0.35 },
    { f: s3, a: 6.15, b: 8.15, tin: 'whip', d: 0.32 },
    { f: s4, a: 8.15, b: 11.25, tin: 'swipe', d: 0.35 },
    { f: s5, a: 11.25, b: 16.2, tin: 'whip', d: 0.32 },
    { f: s6, a: 16.2, b: 20.1, tin: 'zoom', d: 0.35 },
    { f: s7, a: 20.1, b: 23.2, tin: 'whip', d: 0.3 },
    { f: s8, a: 23.2, b: 26.9, tin: 'flash', d: 0.25 },
    { f: s9, a: 26.9, b: 33.0, tin: 'swipe', d: 0.4 },
    { f: s10, a: 33.0, b: 36.7, tin: 'whip', d: 0.32 },
    { f: s11, a: 36.7, b: 40.8, tin: 'zoom', d: 0.4 },
    { f: s12a, a: 40.8, b: 42.6, tin: 'cut' },
    { f: s12b, a: 42.6, b: 45.5, tin: 'swipe', d: 0.32 },
    { f: s13, a: 45.5, b: 48.4, tin: 'iris', d: 0.5 },
    { f: s14, a: 48.4, b: 56, tin: 'zoom', d: 0.4 },
  ];
})();
