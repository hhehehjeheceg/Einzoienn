// Scènes de « Pourquoi c'est horrible d'avoir un appareil dentaire ».
// Tous les temps viennent des mots de la voix off (W('mot', n)).
(function () {
  const X = window.PCH;
  const { K, INK, P, F, L, E, G, cel, clamp, lerp, inv, r1, r2, Ez, spring, punch, decay, bump, rng, txt, grp, at, op, rr, measure,
    rays, ring, sparkles, confetti, hearts, speedLines, flashBurst, springWord, stamp, bubble, room, windowBox, picture, plant, table, door,
    actor, handPos, desk, paper, board, backHead, onoma, locker,
    bigMouth, pureeBowl, spoon, band, gum, caramel, popcorn, redX, pliers, dentalChair, dentalLamp, calendar, camera, headgear, bed, boardSquare, spit } = X;
  const { HERO, AMIE, CRUSH, CANCRE, ORTHO, PROF } = window.CAST;

  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[«»?!.,…:;"]/g, '').trim();
  const CUES = window.CUES;
  function W(word, n = 1) {
    const target = norm(word);
    let k = 0;
    for (const c of CUES) { const w = norm(c.w); if (w === target || (target.length > 3 && w.startsWith(target))) { k++; if (k === n) return c.s; } }
    console.warn('mot introuvable', word, n);
    return 0;
  }
  const T = {
    dentaire: W('dentaire'), premier: W('premier'), mal: W('mal'), partout: W('partout'), puree: W('purée'), souffrir: W('souffrir'),
    tout1: W('tout'), coince: W('coincé'), souris: W('souris'), monde: W('monde'), mange: W('mangé'), midi: W('midi'),
    parles: W('parles'), chuinte: W('chuinte'), chest: W("ch'est"), chuper: W('chuper'),
    elastique: W("l'élastique"), seul: W('seul'), atterrit: W('atterrit'), cheveux: W('cheveux'), prof: W('prof'),
    plus1: W('plus'), gum: W('chewing-gum'), caramel: W('caramel'), popcorn: W('pop-corn'), cinema: W('cinéma'),
    college: W('collège'), appelle: W("t'appelle"), bouche: W('bouche'), metal: W('métal'),
    mois: W('mois'), resserre: W('resserre'), retour: W('retour'), douleur: W('douleur'),
    deux: W('deux'), tard: W('tard'), grand: W('grand'), enleve: W("l'enlève"), enfin: W('enfin'), dents: W('dents'), parfaites: W('parfaites'),
    fais: W('fais'), beau: W('beau'), sourire: W('sourire'), photo: W('photo'), classe: W('classe'),
    la: W('là'), annonce: W("t'annonce"), casque: W('casque'), dormir: W('dormir'), pendant: W('pendant'), an: W('an'),
    toi: W('toi'), porte: W('porté'), disle: W('dis-le'), commentaire: W('commentaire'),
    abonne: W('abonne-toi'), like: W('like'), prochain: W('prochain'), pch: W('pourquoi', 2), horrible: W('horrible', 2),
    end: CUES[CUES.length - 1].e,
  };
  const DUR = Math.ceil((T.end + 2.6) * 10) / 10;
  const cam0 = (z = 1, fx = 540, fy = 960, o = {}) => Object.assign({ z, fx, fy, rot: 0 }, o);
  const cutFlash = (t, tc, a = 0.55) => t >= tc ? a * decay(t, tc, 14) : 0;
  const SK = HERO.pal.skin;
  // l'héroïne une fois l'appareil enlevé
  const HERO_NB = Object.assign({}, HERO, { spec: Object.assign({}, HERO.spec, { braces: false }) });
  // centre de la tête d'un acteur (pour coller un accessoire sur le visage)
  function headAt(cast, x, y, sc) { const sp = Object.assign({}, K.BODY[cast.body], cast.spec || {}); return [x, y + (sp.shY - sp.R * 0.92 - sp.neckLen) * sc, sp.R * sc]; }
  function classroom(o = {}) {
    let w = room({ wall: o.wall || '#FDEBD3', stripe: o.stripe || '#F8E1C4', floor: '#B98A62', fy: 1520 });
    w += windowBox(80, 330, 300, 360, '#BFE6F5', { sun: true }) + cel('M640 300H1000V560H640Z', '#2F5D46', { dx: 0, dy: 10, inner: L('M680 380Q760 340 840 380M680 460H900', '#E9F2EC', 5) });
    return w + picture(820, 700, 160, 110, '#F28CB1', 2);
  }

  // ================================================================== 1. titre : le sourire métallique
  const K1 = { hero: [[0, { g: 'repos', expr: 'content', x: 540, y: 1720, scale: 1.12 }], [T.dentaire - 0.35, { g: 'ta_da', expr: 'grin', jump: 60, d: 0.2 }], [T.dentaire + 0.15, { g: 'ta_da', expr: 'grin', jump: 0, d: 0.3 }]] };
  function s1(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#7A4FD0"/>` + rays(540, 1150, 28, 2600, t * 0.18, '#8A62DA');
    w += `<ellipse cx="540" cy="1720" rx="420" ry="60" fill="#000" opacity=".22"/>`;
    for (let i = 0; i < 14; i++) { const r = rng(i + 3), x = r() * 1080, y = 300 + r() * 1300, k = ((t * 0.4 + r()) % 1); w += `<path d="${X.STAR(10 + r() * 14)}" fill="#FFFFFF" opacity="${r2(0.6 * Math.sin(Math.PI * k))}" transform="translate(${r1(x)} ${r1(y - k * 120)})"/>`; }
    w += actor(HERO, K1.hero, t, { seed: 5 });
    const [hx, hy, R] = headAt(HERO, 540, 1720, 1.12);
    // éclat sur l'appareil
    let ui = '';
    if (t > T.dentaire) { const k = inv(T.dentaire, T.dentaire + 0.5, t); ui += grp(`<path d="${X.STAR(70)}" fill="#FFFFFF"/><path d="${X.STAR(34)}" fill="#BFE6F5" transform="rotate(45)"/>`, at(hx + R * 0.32, hy + R * 0.62, Math.sin(Math.PI * clamp(k)) * 1.3, k * 90)); ui += onoma(hx + 260, hy + 40, 'TING !', 90, t, T.dentaire + 0.05, { fill: '#BFE6F5', rot: 10 }); }
    const tk = spring(t, 0.15, 2.2, 0.6);
    let title = `<path d="${rr(-470, -150, 940, 300, 40)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>` + springWord(0, -46, 'POURQUOI C’EST HORRIBLE', 62, t, 0.3, { fill: '#FFD23F', sw: 0, stag: 0.02, dy: 40, ls: 3 });
    title += grp(springWord(0, 0, 'D’AVOIR UN APPAREIL', 84, t, T.dentaire - 0.6, { fill: '#FFFFFF', sw: 0, stag: 0.03, dy: 60, ls: 3 }), `translate(0 86) scale(${r2(1 + 0.07 * punch(t, T.dentaire, 6, 20))})`);
    ui += grp(title, `translate(540 ${r1(300 + (1 - tk) * -420)}) rotate(${r1(-2 + Math.sin(t * 1.4) * 0.6)})`);
    return { w, ui, cam: cam0(1.05 + 0.1 * Ez.io(inv(0, T.premier, t)) + 0.06 * punch(t, T.dentaire, 5, 18), 540, 1180), flash: cutFlash(t, T.dentaire, 0.3), cap: false };
  }

  // ================================================================== 2. le premier jour : même la purée
  const K2 = { hero: [[0, { arms: { l: { at: [-120, -330], hand: 'relax', bend: 1, handAbs: 30 }, r: { at: [110, -340], hand: 'fist', bend: 1, handAbs: -80 } }, expr: 'crispe', x: 540, y: 1680, crouch: 0.25 }],
    [T.mal, { g: 'main_bouche', expr: 'douleur', crouch: 0.25, d: 0.2 }], [T.puree - 0.25, { arms: { l: { at: [-120, -330], hand: 'relax', bend: 1, handAbs: 30 }, r: { at: [40, -470], hand: 'fist', bend: 'low', handAbs: -150 } }, expr: 'crispe', crouch: 0.25 }],
    [T.souffrir - 0.05, { g: 'main_bouche', expr: 'douleur', exprOver: { stream: 1 }, crouch: 0.3, d: 0.15 }]] };
  function s2(t) {
    let w = room({ wall: '#FFE7A8', stripe: '#FFDE90', floor: '#C99B6D', fy: 1500 }) + windowBox(110, 330, 330, 360, '#BFE6F5', { sun: true }) + cel('M720 260H1000V700H720Z', '#4FA3CF', { dx: 16, dy: 0, inner: L('M740 480H980', INK, 5) });
    w += actor(HERO, K2.hero, t, { seed: 5, x: Math.sin(t * 40) * (t > T.mal && t < T.mal + 0.6 ? 4 : 0) });
    const hp = handPos(HERO, K2.hero, t, 1);
    w += spoon(hp[0] - 6, hp[1] - 4, -40, 0.62, t < T.souffrir);
    w += cel('M110 1480H970V1780H110Z', '#C9852E', { dx: 20, dy: 0 }) + desk(540, 1460, 900, { col: '#E59E2A', h: 60 }) + pureeBowl(540, 1440, 1.0);
    // éclairs de douleur autour de la mâchoire
    const [hx, hy, R] = headAt(HERO, 540, 1680 + 0.25 * 238 * 0.28, 1);
    let ui = '';
    for (const tz of [T.mal, T.souffrir]) if (t > tz && t < tz + 1.2) { const k = inv(tz, tz + 1.2, t); for (const sd of [-1, 1]) ui += grp(P('M0 -40L18 -6H4L22 40L-10 2H6Z', '#FFD23F', 5), at(hx + sd * (R + 60 + 20 * Math.sin(t * 30)), hy + R * 0.5, 1.4 * Math.sin(Math.PI * k), sd * 15)); }
    ui += onoma(800, 760, 'AÏE !', 120, t, T.mal + 0.05, { fill: '#FF6B6B', rot: 10, t1: T.puree - 0.3 }) + onoma(300, 760, 'OUILLE', 100, t, T.souffrir, { fill: '#FF6B6B', rot: -10 });
    return { w, ui, cam: cam0(1.25 + 0.08 * Ez.io(inv(T.puree, T.souffrir + 0.4, t)), 540, 1200, { shake: 10 * decay(t, T.souffrir, 8) * (t > T.souffrir ? 1 : 0) }), capY: 1460 };
  }

  // ================================================================== 3. tout reste coincé
  const K3 = {
    hero: [[0, { g: 'repos', expr: 'content', x: 300, y: 1720, turn: 0.35 }], [T.souris - 0.1, { g: 'ta_da', expr: 'grin', d: 0.2 }]],
    amie: [[0, { g: 'repos', expr: 'content', x: 760, y: 1720, turn: -0.35 }], [T.monde, { g: 'main_bouche', expr: 'degoute', d: 0.2 }], [T.midi, { g: 'recule', expr: 'degoute', lean: 10 }]],
  };
  function s3(t) {
    const zoom = t >= T.coince - 0.05 && t < T.souris - 0.1;
    if (zoom) {
      let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#F28CB1"/>` + rays(540, 960, 22, 2200, t * 0.4, '#F5A2C2');
      const k = inv(T.coince, T.souris, t);
      w += bigMouth(540, 900, 900, { food: 11, skin: SK, s: 1 + 0.08 * k });
      let ui = onoma(250, 470, 'BEURK', 100, t, T.coince + 0.2, { fill: '#7BD389', rot: -10 }) + grp(`<path d="M0 -40L30 -10L0 40L-30 -10Z" fill="#3E8E3E" stroke="${INK}" stroke-width="5"/>` + txt(60, 12, 'épinard', 42, '#FFFFFF', { anchor: 'start', font: 'Caveat', weight: 700, stroke: INK, sw: 7 }), at(700, 620, spring(t, T.coince + 0.35, 2.6, 0.5)));
      return { w, ui, cam: cam0(1.0 + 0.06 * k, 540, 960), flash: cutFlash(t, T.coince - 0.05, 0.4), capY: 1460 };
    }
    let w = room({ wall: '#FCE7C8', stripe: '#F8DDB6', floor: '#B7C3CF', fy: 1520, planks: false });
    w += cel('M60 300H460V560H60Z', '#E5483D', { dx: 0, dy: 10, inner: txt(260, 400, 'MENU', 56, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) + txt(260, 480, 'Épinards', 44, '#FFFFFF', { font: 'Caveat', weight: 700 }) });
    w += actor(HERO, K3.hero, t, { seed: 5 }) + actor(AMIE, K3.amie, t, { seed: 12 });
    // restes verts dans le sourire de l'héroïne
    if (t > T.souris - 0.05) { const [hx, hy, R] = headAt(HERO, 300, 1720, 1); for (let i = 0; i < 4; i++) w += P(`M${r1(hx - 20 + i * 14)} ${r1(hy + R * 0.6)}l8 -3l2 9l-9 2z`, '#3E8E3E', 2); }
    let ui = '';
    if (t > T.monde) ui += onoma(800, 640, 'EURK', 90, t, T.monde + 0.05, { fill: '#7BD389', rot: 8 });
    return { w, ui, cam: cam0(1.15, 540, 1220), flash: cutFlash(t, T.souris - 0.1, 0.35), capY: 1460 };
  }

  // ================================================================== 4. ça chuinte : « Ch'est chuper »
  const K4 = {
    hero: [[0, { g: 'presente', expr: 'excite', x: 330, y: 1720, turn: 0.4 }], [T.chest - 0.1, { g: 'ta_da', expr: 'grin', lean: 6 }]],
    crush: [[0, { g: 'mains_poches', expr: 'content', x: 780, y: 1740, turn: -0.4 }], [T.chest + 0.15, { g: 'stop', expr: 'degoute', lean: 12, d: 0.2 }], [T.chuper + 0.5, { g: 'facepalm', expr: 'degoute' }]],
  };
  function s4(t) {
    let w = room({ wall: '#D9EEF7', stripe: '#CDE7F3', floor: '#B7C3CF', fy: 1520, planks: false }) + locker(-60, 1520, '#7FB7D9', 2) + locker(780, 1520, '#F2B33D', 2);
    w += actor(HERO, K4.hero, t, { seed: 5 }) + actor(CRUSH, K4.crush, t, { seed: 14 });
    const [hx, hy, R] = headAt(HERO, 330, 1720, 1);
    w += spit(hx + R * 0.4, hy + R * 0.6, t, T.chest, 10, 3, 1) + spit(hx + R * 0.4, hy + R * 0.6, t, T.chuper, 12, 7, 1);
    let ui = bubble(520, 640, 560, 210, 'CH’EST CHUPER !', 64, t, T.chest - 0.05, { font: 'Anton', fill: '#FFFFFF', tail: [-160, 170], rot: -4 });
    ui += onoma(870, 960, 'PSHH', 80, t, T.chuper + 0.1, { fill: '#BFE6F5', rot: 12 });
    return { w, ui, cam: cam0(1.12 + 0.05 * Ez.io(inv(T.parles, T.elastique, t)), 560, 1200), capY: 1460 };
  }

  // ================================================================== 5. l'élastique atterrit dans les cheveux de la prof
  const K5 = {
    hero: [[0, { g: 'repos', expr: 'neutre', x: 260, y: 1730, crouch: 0.25 }], [T.elastique, { g: 'repos', expr: 'surpris', exprOver: { ms: 'o' }, crouch: 0.25 }], [T.cheveux, { g: 'deux_mains_bouche', expr: 'terrifie', crouch: 0.25 }]],
    prof: [[0, { g: 'pointe_haut', expr: 'concentre', x: 800, y: 1720, turn: -0.3 }], [T.cheveux + 0.1, { g: 'repos', expr: 'choque', exprOver: { shock: 1 }, d: 0.15 }], [T.prof + 0.4, { g: 'colere', expr: 'furieux' }]],
  };
  function s5(t) {
    let w = classroom();
    w += actor(PROF, K5.prof, t, { seed: 21 });
    w += actor(HERO, K5.hero, t, { seed: 5 }) + desk(260, 1470, 420);
    const [hx, hy] = headAt(HERO, 260, 1730 + 0.25 * 238 * 0.28, 1), [px, py, PR] = headAt(PROF, 800, 1720, 1);
    const k = inv(T.seul, T.atterrit + 0.35, t);
    let ui = '';
    if (t > T.seul - 0.1) {
      const bx = lerp(hx + 40, px + 10, k), by = lerp(hy + 70, py - PR * 0.9, k) - Math.sin(Math.PI * k) * 420;
      if (k < 1) { for (let i = 1; i <= 5; i++) { const kk = Math.max(0, k - i * 0.04); ui += `<circle cx="${r1(lerp(hx + 40, px + 10, kk))}" cy="${r1(lerp(hy + 70, py - PR * 0.9, kk) - Math.sin(Math.PI * kk) * 420)}" r="${6 - i}" fill="#FFFFFF" opacity="${r2(0.6 - i * 0.1)}"/>`; } }
      w += band(k < 1 ? bx : px + 10, k < 1 ? by : py - PR * 0.92, 1.4, t * 900 * (k < 1 ? 1 : 0));
    }
    ui += onoma(px + 150, py - PR * 1.2, 'TOING', 84, t, T.atterrit + 0.35, { fill: '#FFD23F', rot: 10 });
    const slow = t > T.seul && t < T.atterrit + 0.35;
    return { w, ui, cam: cam0(lerp(1.1, 1.25, k), lerp(380, 700, Ez.io(k)), lerp(1250, 1120, k)), sat: slow ? 0.85 : 1, capY: 1460 };
  }

  // ================================================================== 6. plus de chewing-gum, caramel, pop-corn
  const K6 = { hero: [[0, { g: 'triste', expr: 'triste', x: 540, y: 1760, crouch: 0.3 }], [T.cinema, { g: 'desespoir', expr: 'sanglote', crouch: 0.3 }]] };
  function s6(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#2A2238"/>`;
    // salle de cinéma : écran + sièges
    w += cel('M120 220H960V700H120Z', '#9FD9F2', { dx: 0, dy: 0, inner: `<rect x="120" y="220" width="840" height="480" fill="#FFFFFF" opacity="${r2(0.15 + 0.1 * Math.sin(t * 9))}"/>` });
    for (let i = 0; i < 7; i++) w += cel(`M${-40 + i * 170} 1460Q${10 + i * 170} 1400 ${60 + i * 170} 1460V1640H${-40 + i * 170}Z`, '#B23A48', { dx: 8, dy: 0 });
    w += actor(HERO, K6.hero, t, { seed: 5 });
    for (let i = 0; i < 7; i++) w += cel(`M${-80 + i * 170} 1700Q${10 + i * 170} 1620 ${100 + i * 170} 1700V1960H${-80 + i * 170}Z`, '#C94A58', { dx: 10, dy: 0 });
    let ui = '';
    const items = [[T.gum, 230, gum], [T.caramel, 540, caramel], [T.popcorn, 850, popcorn]];
    items.forEach(([t0, x, f], i) => {
      if (t > t0 - 0.15) { const k = spring(t, t0 - 0.15, 2.6, 0.5); ui += grp(f(0, 0, 1, Math.sin(t * 3 + i) * 6), at(x, 860 + Math.sin(t * 2 + i) * 10, clamp(k, 0, 1.2) * 1.45)); ui += redX(x, 860, t, t0 + 0.25, 1.3); }
    });
    return { w, ui, cam: cam0(1.0, 540, 1050, { shake: 6 * Math.max(...items.map(([t0]) => decay(t, t0 + 0.25, 10) * (t > t0 + 0.25 ? 1 : 0))) }), capY: 1300 };
  }

  // ================================================================== 7. « Bouche de métal »
  const K7 = {
    hero: [[0, { g: 'repos', expr: 'content', x: -200, y: 1730 }], [T.college - 0.3, { g: 'repos', expr: 'content', x: 520, d: 1.0, e: 'io' }], [T.appelle, { g: 'gene', expr: 'honte', exprOver: { flush: 0.8 }, x: 520, scale: 0.92, crouch: 0.2, d: 0.3 }]],
    cancre: [[0, { g: 'mains_poches', expr: 'mechant', x: 860, y: 1740, turn: -0.4 }], [T.bouche - 0.2, { g: 'se_moque_g', expr: 'moqueur', turn: -0.4 }]],
    amie: [[0, { g: 'repos', expr: 'neutre', x: 170, y: 1600, scale: 0.8 }], [T.metal, { g: 'main_bouche', expr: 'rire' }]],
  };
  function s7(t) {
    let w = room({ wall: '#E9E2F7', stripe: '#E0D7F3', floor: '#BFC6CF', fy: 1500, planks: false }) + locker(-60, 1500, '#8E4FD6', 3) + locker(650, 1500, '#4FA3CF', 3);
    w += actor(AMIE, K7.amie, t, { seed: 12 });
    w += actor(HERO, K7.hero, t, { seed: 5, walk: t > T.college - 0.3 && t < T.college + 0.7 ? 7 : 0 });
    w += actor(CANCRE, K7.cancre, t, { seed: 18 });
    let ui = '';
    if (t > T.bouche - 0.05) {
      const k = spring(t, T.bouche - 0.05, 2.2, 0.45);
      ui += rays(540, 700, 20, 1600, t * 0.5, '#FFFFFF', 0.2 * clamp(k));
      const chrome = `<linearGradient id="chr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#AEB6C2"/><stop offset=".55" stop-color="#6E7685"/><stop offset="1" stop-color="#D9DEE6"/></linearGradient>`;
      ui += chrome + grp(springWord(0, -60, 'BOUCHE', 150, t, T.bouche - 0.05, { font: 'Anton', fill: 'url(#chr)', stroke: INK, sw: 16, stag: 0.04 }) + springWord(0, 100, 'DE MÉTAL', 150, t, T.metal - 0.05, { font: 'Anton', fill: 'url(#chr)', stroke: INK, sw: 16, stag: 0.04 }), `translate(540 ${r1(640 + Math.sin(t * 3) * 8)}) rotate(-4)`);
      for (let i = 0; i < 3; i++) { const kk = ((t * 3 + i * 0.33) % 1); ui += grp(P('M0 -50L22 -8H6L26 50L-12 4H6Z', '#FFE27A', 5), at(160 + i * 380, 520 + (i % 2) * 300, Math.sin(Math.PI * kk) * 1.2, i * 30)); }
    }
    return { w, ui, cam: cam0(1.12 + 0.05 * punch(t, T.metal, 4, 16), 540, 1220, { shake: 8 * decay(t, T.metal, 8) * (t > T.metal ? 1 : 0) }), capY: 1460 };
  }

  // ================================================================== 8. chaque mois, on resserre
  const MOIS = ['JANV', 'FÉVR', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
  const K8 = {
    hero: [[0, { arms: { l: { at: [-150, -300], hand: 'fist', bend: 1, handAbs: 60 }, r: { at: [150, -300], hand: 'fist', bend: 1, handAbs: -60 } }, expr: 'crispe', x: 470, y: 1580, crouch: 0.35 }],
      [T.resserre, { expr: 'douleur', exprOver: { stream: 0.6 }, d: 0.15 }], [T.douleur, { expr: 'pleure' }]],
    ortho: [[0, { g: 'repos', expr: 'malin', x: 900, y: 1760, turn: -0.4 }], [T.ortho1 || T.mois + 0.4, { arms: { r: { at: [260, -560], hand: 'fist', bend: 1, handAbs: -160 }, l: [10, -10, 'relax'] }, expr: 'mechant', lean: -14 }]],
  };
  function s8(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="2400" fill="#DFF3F2"/>` + `<rect x="-800" y="1500" width="2700" height="900" fill="#BFD9D8"/>` + L('M-800 1500H1900', INK, 5);
    w += dentalLamp(560, 760, 1, 1) + dentalChair(480, 1500, 1.05);
    w += actor(HERO, K8.hero, t, { seed: 5, x: Math.sin(t * 50) * (t > T.resserre ? 3 : 0) });
    w += actor(ORTHO, K8.ortho, t, { seed: 31 });
    const hp = handPos(ORTHO, K8.ortho, t, 1);
    w += pliers(hp[0] - 20, hp[1] - 30, 0.8, -150 + 14 * Math.sin(t * 12) * (t > T.resserre ? 1 : 0), 0.5 + 0.5 * Math.sin(t * 12));
    let ui = '';
    // calendrier qui défile les mois
    const k = inv(T.mois - 0.2, T.douleur + 0.3, t), m = Math.min(11, Math.floor(k * 12));
    ui += calendar(860, 420, 0.75, MOIS[m], 'MOIS', (k * 12) % 1);
    if (t > T.resserre) ui += onoma(320, 900, 'CRIC CRIC', 90, t, T.resserre, { fill: '#FFFFFF', rot: -8 });
    if (t > T.retour - 0.1) { const kk = Ez.out(inv(T.retour - 0.1, T.douleur + 0.2, t)); ui += boardSquare(320, 520, 0.9, 'DOULEUR', '#E5483D') + boardSquare(lerp(820, 600, 0), 640, 0.6, 'DÉPART', '#7BD389') + grp(cel('M-24 30H24L14 -20Q0 -50 -14 -20Z', '#4FA3CF', { dx: 4, dy: 4, sw: 4 }) + E(0, -40, 18, 18, '#4FA3CF', 4), at(lerp(600, 320, kk), 470 - Math.sin(Math.PI * kk) * 160, 1)); }
    return { w, ui, cam: cam0(1.08, 560, 1180, { shake: t > T.resserre ? 3 : 0 }), capY: 1460 };
  }

  // ================================================================== 9. deux ans plus tard : on l'enlève
  const K9 = {
    hero: [[0, { g: 'repos', expr: 'neutre', x: 540, y: 1720 }], [T.enleve + 0.2, { g: 'ta_da', expr: 'ravi', jump: 70, d: 0.2 }], [T.dents, { g: 'victoire', expr: 'grin', jump: 0 }], [T.parfaites + 0.3, { g: 'saute_joie', expr: 'joie' }]],
  };
  function s9(t) {
    const cal = t < T.grand - 0.1;
    if (cal) {
      let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#3D5BD8"/>` + rays(540, 900, 24, 2400, t * 0.6, '#4A68E0');
      const k = inv(T.deux - 0.2, T.grand - 0.1, t);
      for (let i = 0; i < 8; i++) { const kk = clamp(k * 8 - i); if (kk > 0 && kk < 1) w += grp(cel('M-140 -80H140V170H-140Z', '#FFFFFF', { dx: 6, dy: 6 }), at(540 + kk * 600 * (i % 2 ? 1 : -1), 900 - kk * 700 + kk * kk * 900, 1, kk * 400 * (i % 2 ? 1 : -1)), op(1 - kk)); }
      w += calendar(540, 900, 1.2, String(2024 + Math.min(2, Math.floor(k * 3))), 'ANNÉE');
      let ui = grp(springWord(0, 0, '2 ANS PLUS TARD', 100, t, T.deux, { font: 'Anton', fill: '#FFD23F', sw: 14, stag: 0.03 }), 'translate(540 420) rotate(-3)');
      return { w, ui, cam: cam0(1.0, 540, 960), capY: 1460 };
    }
    let w = `<rect x="-800" y="-800" width="2700" height="2400" fill="#DFF3F2"/>` + `<rect x="-800" y="1500" width="2700" height="900" fill="#BFD9D8"/>` + L('M-800 1500H1900', INK, 5) + dentalLamp(820, 760, 0.9, 0.6);
    w += actor(t > T.enleve + 0.05 ? HERO_NB : HERO, K9.hero, t, { seed: 5 });
    const [hx, hy, R] = headAt(HERO, 540, 1720, 1);
    // les bagues s'envolent
    if (t > T.enleve) { const dt = t - T.enleve; if (dt < 1.4) { const r = rng(11); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.4, v = 500 + r() * 400; w += `<rect x="-9" y="-9" width="18" height="18" rx="4" fill="#D2D7DF" stroke="#5B6270" stroke-width="3" transform="translate(${r1(hx + Math.cos(a) * v * dt)} ${r1(hy + R * 0.6 + Math.sin(a) * v * dt + 1200 * dt * dt)}) rotate(${r1(dt * 600)})"/>`; } } }
    let ui = onoma(820, 700, 'POP !', 100, t, T.enleve, { fill: '#FFFFFF', rot: 10 });
    if (t > T.dents) ui += sparkles(hx, hy + R * 0.6, t, T.dents, 16, 300, 41, ['#FFFFFF', '#BFE6F5']) + grp(`<path d="${X.STAR(60)}" fill="#FFFFFF"/>`, at(hx + R * 0.35, hy + R * 0.62, Math.sin(Math.PI * clamp((t - T.dents) / 0.5)) * 1.2, t * 200));
    if (t > T.parfaites) ui += confetti(540, 900, t, T.parfaites, 50, 43);
    return { w, ui, cam: cam0(1.12 + 0.06 * punch(t, T.dents, 4, 14), 540, 1180), flash: cutFlash(t, T.grand - 0.1, 0.4), capY: 1460 };
  }

  // ================================================================== 10. la photo de classe
  const K10 = {
    hero: [[0, { g: 'repos', expr: 'grin', x: 540, y: 1640, exprOver: { sparkle: 1 } }]],
    amie: [[0, { g: 'repos', expr: 'content', x: 260, y: 1600, scale: 0.92 }]],
    crush: [[0, { g: 'mains_poches', expr: 'content', x: 820, y: 1600, scale: 0.92 }]],
  };
  function s10(t) {
    let w = classroom({ wall: '#FFF1D6', stripe: '#FBE8C6' }) + cel('M-60 1400H1140V1520H-60Z', '#C9A27A', { dx: 0, dy: 8 });
    w += txt(540, 300, 'PHOTO DE CLASSE', 60, '#E5483D', { font: 'Anton', weight: 400, ls: 4, stroke: '#FFFFFF', sw: 8 });
    w += actor(AMIE, K10.amie, t, { seed: 12 }) + actor(CRUSH, K10.crush, t, { seed: 14 }) + actor(HERO_NB, K10.hero, t, { seed: 5 });
    let ui = '';
    // décompte de l'appareil photo
    const n = 3 - Math.floor(inv(T.fais, T.la - 0.3, t) * 3);
    if (t < T.la - 0.25) ui += grp(`<circle r="70" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>` + txt(0, 30, String(Math.max(1, n)), 90, '#FFFFFF', { font: 'Anton', weight: 400 }), at(900, 380, 1 + 0.15 * punch(t, T.fais + (3 - n) * ((T.la - 0.3 - T.fais) / 3), 8, 20)));
    ui += `<rect x="0" y="0" width="1080" height="1920" fill="none" stroke="#FFFFFF" stroke-width="18" opacity=".8"/>`;
    return { w, ui, cam: cam0(lerp(1.05, 1.3, Ez.io(inv(T.fais, T.la, t))), 540, lerp(1150, 1080, inv(T.fais, T.la, t))), capY: 1460 };
  }

  // ================================================================== 11. le casque
  const K11 = {
    hero: [[0, { g: 'repos', expr: 'grin', x: 380, y: 1720 }], [T.casque, { g: 'oh_non', expr: 'terrifie', d: 0.15 }], [T.casque + 0.6, { g: 'desespoir', expr: 'sonne' }]],
    ortho: [[0, { g: 'repos', expr: 'malin', x: 1300, y: 1740, flip: true }], [T.la, { g: 'presente', expr: 'mechant', x: 820, d: 0.5, e: 'io' }]],
    bed: [[0, { g: 'repos', expr: 'blase', exprOver: { lidT: 0.7 }, x: 540, y: 1540, scale: 1.2 }]],
  };
  function s11(t) {
    const night = t >= T.dormir - 0.15;
    if (!night) {
      let w = classroom({ wall: '#FFF1D6', stripe: '#FBE8C6' });
      w += actor(HERO_NB, K11.hero, t, { seed: 5 });
      w += actor(ORTHO, K11.ortho, t, { seed: 31, walk: t > T.la && t < T.la + 0.5 ? 7 : 0 });
      const hp = handPos(ORTHO, K11.ortho, t, 1);
      // le casque présenté dans la main, puis il saute sur la tête
      const jumpK = inv(T.casque - 0.05, T.casque + 0.35, t), [hx, hy, R] = headAt(HERO, 380, 1720, 1);
      if (t > T.la + 0.2) {
        if (jumpK <= 0) w += headgear(hp[0] - 60, hp[1] - 160, 70, t, { shine: 0.5 + 0.5 * Math.sin(t * 6) });
        else { const k = Ez.out(jumpK); w += headgear(lerp(hp[0] - 60, hx, k), lerp(hp[1] - 160, hy, k) - Math.sin(Math.PI * k) * 200, lerp(70, R, k), t); }
      }
      let ui = '';
      if (t > T.casque) ui += rays(hx, hy, 20, 1500, t * 0.4, '#000000', 0.25) + onoma(760, 700, 'CLAC', 110, t, T.casque + 0.35, { fill: '#FFFFFF', rot: 10 });
      return { w, ui, cam: cam0(lerp(1.1, 1.45, Ez.io(inv(T.casque, T.casque + 0.5, t))), lerp(560, 400, inv(T.casque, T.casque + 0.5, t)), lerp(1200, 1050, inv(T.casque, T.casque + 0.5, t))), sat: t > T.casque ? 0.7 : 1, flash: cutFlash(t, T.casque + 0.35, 0.35), capY: 1460 };
    }
    // la nuit, au lit, avec le casque
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#1E2346"/>` + windowBox(640, 300, 300, 330, '#0E1230', { cloud: false }) + E(860, 380, 34, 34, '#FFF3B0', 0);
    for (let i = 0; i < 20; i++) { const r = rng(i + 70); w += E(r() * 1080, r() * 700, 2.5, 2.5, '#FFFFFF', 0, op(0.4 + 0.5 * Math.sin(t * 3 + i))); }
    w += cel('M120 1000H960V1600H120Z', '#6B5BB0', { dx: 20, dy: 12 }) + cel('M200 1000Q540 930 880 1000V1080H200Z', '#FFFFFF', { dx: 0, dy: 8 });
    const R = 116 * 1.3, hx = 540, hy = 1010;
    w += grp(K.person(Object.assign({}, HERO_NB, { headOnly: true, t, face: K.expr('blase', { lidT: 0.75 }), blink: K.blinkAt(t, 5) })), `translate(${hx} ${hy}) rotate(-6) scale(1.3)`);
    w += grp(headgear(0, 0, 116, t), `translate(${hx} ${hy}) rotate(-6) scale(1.3)`);
    w += cel('M140 1200Q540 1150 940 1200V1600H140Z', '#B9A3F0', { dx: 24, dy: 10, inner: L('M140 1290Q540 1250 940 1290', '#A28CE0', 6) });
    let ui = calendar(860, 1180, 0.7, '365', 'NUITS');
    ui += onoma(300, 700, 'zZz', 90, t, T.dormir + 0.3, { fill: '#BFE6F5', rot: -8 });
    return { w, ui, cam: cam0(1.05 + 0.04 * inv(T.dormir, T.toi, t), 540, 1150), flash: cutFlash(t, T.dormir - 0.15, 0.4), capY: 1460 };
  }

  // ================================================================== 12. Et toi ?
  const K12 = { hero: [[0, { g: 'je_sais_pas', expr: 'pense', x: 540, y: 1760, scale: 1.05 }], [T.disle, { g: 'toi', expr: 'grin' }]] };
  function s12(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#7A4FD0"/>` + rays(540, 900, 22, 2200, t * 0.25, '#8A62DA');
    w += actor(HERO, K12.hero, t, { seed: 5 });
    let ui = grp(txt(0, 0, '?', 340, '#FFD23F', { font: 'Anton', weight: 400, stroke: INK, sw: 20 }), `translate(${r1(860 + Math.sin(t * 2) * 10)} ${r1(700 + Math.sin(t * 3) * 14)}) rotate(${r1(12 + Math.sin(t * 2.2) * 6)}) scale(${r2(spring(t, T.toi - 0.1, 2.4, 0.45))})`);
    ui += grp(bigMouth(0, 0, 300, { skin: SK, shine: (t * 0.6) % 1.4 }), `translate(240 620) rotate(-8) scale(${r2(spring(t, T.porte - 0.2, 2.4, 0.5))})`);
    if (t > T.disle - 0.2) {
      const k = spring(t, T.disle - 0.2, 2.4, 0.6), typed = '3 ans de bagues pour moi'.slice(0, Math.floor(clamp((t - T.disle - 0.2) * 16, 0, 24)));
      ui += grp(`<path d="${rr(-470, -60, 940, 120, 60)}" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/><circle cx="-400" cy="0" r="38" fill="#B9A3F0"/>` + txt(-340, 16, (typed || 'Ajouter un commentaire…') + (Math.floor(t * 3) % 2 ? '|' : ''), 42, typed ? INK : '#9A94A0', { anchor: 'start', weight: typed ? 800 : 600 }), `translate(540 ${r1(lerp(2100, 1600, k))})`);
    }
    return { w, ui, cam: cam0(1.0 + 0.04 * Math.sin(t * 0.8), 540, 1150), capY: 1300 };
  }

  // ================================================================== 13. abonne-toi / like / prochain
  const K13 = { hero: [[0, { g: 'coucou_d', expr: 'grin', x: 400, y: 1660 }], [T.abonne, { g: 'pointe_haut', expr: 'excite' }], [T.like, { g: 'pouce_d', expr: 'grin' }], [T.horrible + 0.6, { g: 'coucou_d', expr: 'grin' }]] };
  function thumb() { return P('M-34 -6H-10L8 -54Q14 -66 26 -60Q38 -54 34 -36L28 -10H58Q72 -10 70 6L62 50Q58 62 46 62H-10V-6Z', '#FFFFFF', 6) + P('M-56 -6H-24V62H-56Z', '#FFFFFF', 6); }
  function bell(rot) { return grp(P('M0 -44Q30 -44 32 -6L36 22Q38 30 46 34H-46Q-38 30 -36 22L-32 -6Q-30 -44 0 -44Z', '#FFFFFF', 6) + `<circle cx="0" cy="44" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`, `rotate(${r1(rot)} 0 -44)`); }
  function s13(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#F2B33D"/>` + rays(540, 900, 22, 2400, t * 0.2, '#F5C25E');
    w += `<rect x="-800" y="1500" width="2700" height="900" fill="#E59E2A"/>` + L('M-800 1500H1900', INK, 5);
    w += actor(HERO, K13.hero, t, { seed: 5 });
    const [hx, hy, R] = headAt(HERO, 400, 1660, 1);
    w += headgear(hx, hy, R, t, { shine: Math.max(0, Math.sin(t * 2)) });
    let ui = '';
    const bIn = spring(t, T.abonne - 0.25, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = P(rr(-380, -80, 760, 160, 80), done ? '#3A3A42' : '#E5483D', 7) + txt(done ? 40 : 0, 28, done ? 'ABONNÉ' : 'S’ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) + (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    const fade = 1 - Ez.io(inv(T.prochain, T.prochain + 0.35, t));
    let cta = grp(btn, `translate(540 ${r1(330 + (1 - bIn) * -400)}) scale(${r2(bIn * pr)})`) + ring(540, 330, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 330, t, press, 16, 460, 141);
    const cur = inv(T.abonne - 0.2, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 360, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
    if (t < press + 0.9) cta += grp(P('M0 0L0 70L18 54L32 86L46 80L32 48L56 48Z', '#FFFFFF', 6), `translate(${r1(cx)} ${r1(cy)}) scale(${cs * 1.4})`, op(1 - inv(press + 0.5, press + 0.9, t)));
    const lk = spring(t, T.like, 2.6, 0.45);
    if (lk > 0.01) cta += grp(`<circle r="110" fill="#7A4FD0" stroke="${INK}" stroke-width="7"/>` + grp(thumb(), 'translate(-6 4) scale(1.15)'), `translate(540 620) rotate(${r1((1 - lk) * -30)}) scale(${r2(lk)})`) + sparkles(540, 620, t, T.like, 18, 380, 142, ['#FFFFFF', '#B9A3F0', '#FFE27A']) + ring(540, 620, t, T.like, 0.6, 520, '#FFFFFF', 18);
    ui += `<g ${op(fade)}>${cta}</g>`;
    if (t > T.prochain) {
      const k = spring(t, T.prochain, 2.2, 0.6);
      const card = `<path d="${rr(-470, -170, 940, 340, 40)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>` + txt(0, -80, 'PROCHAIN ÉPISODE', 40, '#FFFFFF', { ls: 6, weight: 700 }) +
        springWord(0, 10, 'POURQUOI', 86, t, T.pch, { fill: '#FFD23F', sw: 0, stag: 0.03, dy: 50, ls: 3 }) + springWord(0, 112, 'C’EST HORRIBLE…', 86, t, T.horrible, { fill: '#FFFFFF', sw: 0, stag: 0.03, dy: 50, ls: 3 });
      ui += grp(card, `translate(540 ${r1(lerp(-300, 470, k))}) rotate(${r1(-2 + Math.sin(t * 1.3) * 0.8)})`);
    }
    return { w, ui, cam: cam0(1 + 0.03 * Math.sin(t * 0.7), 540, 1160), cap: t < T.horrible + 0.7, capY: 1300 };
  }

  X.T = T; X.W = W; X.DUR = DUR;
  const b = (word, pad) => word - pad;
  X.SCENES = [
    { f: s1, a: 0, b: b(T.premier, 0.3) },
    { f: s2, a: b(T.premier, 0.3), b: b(T.tout1, 0.3), tin: 'zoom', d: 0.35 },
    { f: s3, a: b(T.tout1, 0.3), b: b(T.parles, 0.3), tin: 'whip', d: 0.3 },
    { f: s4, a: b(T.parles, 0.3), b: b(T.elastique, 0.3), tin: 'swipe', d: 0.3 },
    { f: s5, a: b(T.elastique, 0.3), b: b(T.plus1, 0.3), tin: 'whip', d: 0.3 },
    { f: s6, a: b(T.plus1, 0.3), b: b(T.college, 0.35), tin: 'iris', d: 0.45 },
    { f: s7, a: b(T.college, 0.35), b: b(T.mois, 0.5), tin: 'rip', d: 0.45 },
    { f: s8, a: b(T.mois, 0.5), b: b(T.deux, 0.3), tin: 'whip', d: 0.3 },
    { f: s9, a: b(T.deux, 0.3), b: b(T.fais, 0.3), tin: 'zoom', d: 0.35 },
    { f: s10, a: b(T.fais, 0.3), b: b(T.la, 0.25), tin: 'swipe', d: 0.3 },
    { f: s11, a: b(T.la, 0.25), b: b(T.toi, 0.4), tin: 'flash', d: 0.3 },
    { f: s12, a: b(T.toi, 0.4), b: b(T.abonne, 0.3), tin: 'rip', d: 0.45 },
    { f: s13, a: b(T.abonne, 0.3), b: DUR + 1, tin: 'zoom', d: 0.4 },
  ];
})();
