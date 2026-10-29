// Scènes de « Pourquoi c'est horrible d'être gaucher ».
// Tous les temps viennent des mots de la voix off (W('mot', n)) : les scènes se recalent seules sur la voix.
(function () {
  const X = window.PCH;
  const { K, INK, P, F, L, E, G, cel, clamp, lerp, inv, r1, r2, Ez, spring, punch, decay, bump, rng, hash, txt, grp, at, op, rr, measure,
    rays, ring, sparkles, confetti, hearts, speedLines, flashBurst, springWord, stamp, bubble, room, windowBox, picture, plant, table, door,
    actor, stateAt, handPos, shadowE,
    desk, paper, scribbleLine, pen, scissors, bigHand, spiralBook, tray, fork, board, radiator, penBox, backHead, inkBlot, onoma } = X;
  const { HERO, VOISIN, PROF, MAMIE, ELEVE1, ELEVE2 } = window.CAST;

  // ------------------------------------------------------------------ minutage depuis les mots
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
    gaucher: W('gaucher'), les: W('les'), ciseaux: W('ciseaux'), coupent: W('coupent'), rien: W('rien'), machent: W('mâchent'), papier: W('papier'),
    tu1: W('tu'), stylo1: W('stylo'), traine: W('traîne'), encre: W("l'encre"), fin: W('fin'), cote: W('côté'), bleu: W('bleu'),
    cahier: W('cahier'), spirale: W('spirale'), rentre: W('rentre'), poignet: W('poignet'),
    cantine: W('cantine'), cognes: W('cognes'), coude: W('coude'), voisin: W('voisin'), chaque: W('chaque'), bouchee: W('bouchée'),
    tableau: W('tableau'), effaces: W('effaces'), ecris2: W('écris', 2), propre: W('propre'), manche: W('manche'),
    mamie: W('grand-mère'), essaie: W('essaie'), corriger: W('corriger'),
    alors: W('alors'), achetes: W("t'achètes"), enfin: W('enfin'), special: W('spécial'), gaucher2: W('gaucher', 2), effacable: W('effaçable'), zero1: W('zéro'), bavure: W('bavure'),
    premier: W('premier'), controle: W('contrôle'), ecris3: W('écris', 3), tout: W('tout', 2), fier: W('fier'),
    prof: W('prof'), pose: W('pose'), copies: W('copies'), radiateur: W('radiateur'), tienne: W('tienne'), devient: W('devient'), blanche: W('blanche'),
    zero2: W('zéro', 2), copie: W('copie', 2), blanche2: W('blanche', 2),
    toi: W('toi'), gaucher3: W('gaucher', 3), droitier: W('droitier'), disle: W('dis-le'), commentaire: W('commentaire'),
    abonne: W('abonne-toi'), like: W('like'), prochain: W('prochain'), pch: W('pourquoi', 2), horrible: W('horrible', 2),
    end: CUES[CUES.length - 1].e,
  };
  const DUR = Math.ceil((T.end + 2.6) * 10) / 10;
  const cam0 = (z = 1, fx = 540, fy = 960, o = {}) => Object.assign({ z, fx, fy, rot: 0 }, o);
  const SK = HERO.pal.skin;
  // fondu doux entre deux plans d'une même scène
  const cutFlash = (t, tc, a = 0.55) => t >= tc ? a * decay(t, tc, 14) : 0;

  // ================================================================== 1. titre
  const K1 = { hero: [[0, { g: 'repos', expr: 'content', x: 540, y: 1700, scale: 1.12 }], [T.gaucher - 0.15, { g: 'salut_d', expr: 'excite', armsOver: { r: 'haut' }, d: 0.22 }],
    [T.les - 0.75, { g: 'oh_non', expr: 'choque', d: 0.15 }]] };
  const ORBIT = [['scissors', 0], ['book', 1], ['mouse', 2], ['pen', 3], ['opener', 4]];
  function mouse(x, y, s, rot) { return grp(cel('M-50 -80Q0 -110 50 -80V60Q0 100 -50 60Z', '#E9E4D8', { dx: 8, dy: 8 }) + L('M0 -96V-30M-50 -30H50', INK, 4) + F('M2 -94Q40 -88 48 -32H2Z', '#4FA3CF') + L('M0 -96Q-30 -150 10 -190', INK, 4), at(x, y, s, rot)); }
  function opener(x, y, s, rot) { return grp(cel('M-14 -140H14V40H-14Z', '#E5483D', { dx: 4, dy: 0 }) + cel('M-20 -170H20L10 -140H-10Z', '#C9CCD6', { dx: 3, dy: 3, sw: 4 }) + E(0, 60, 26, 26, '#C9CCD6', 5), at(x, y, s, rot)); }
  function s1(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#2E3D78"/>` + rays(540, 1100, 26, 2600, t * 0.15, '#34458A');
    w += `<ellipse cx="540" cy="1720" rx="420" ry="60" fill="#000" opacity=".25"/>`;
    // objets « pour droitiers » qui tournent autour du héros
    const ok = Ez.out(inv(0.15, 1.0, t));
    ORBIT.forEach(([n, i]) => {
      const a = t * 1.1 + i * Math.PI * 2 / 5, rx = lerp(900, 380, ok), ry = lerp(700, 150, ok);
      const x = 540 + Math.cos(a) * rx, y = 1250 + Math.sin(a) * ry, s = 0.85 + 0.25 * Math.sin(a), rot = Math.sin(t * 2 + i) * 20;
      const tag = grp(`<circle r="30" fill="#E5483D" stroke="${INK}" stroke-width="4"/>` + txt(0, 12, 'D', 34, '#FFFFFF', { font: 'Anton', weight: 400 }), at(x + 60 * s, y - 90 * s, s));
      const back = Math.sin(a) < 0;
      const obj = n === 'scissors' ? scissors(x, y, s * 0.8, rot, 0.5 + 0.4 * Math.sin(t * 8)) : n === 'book' ? spiralBook(x, y, s * 0.35, rot) : n === 'mouse' ? mouse(x, y, s, rot) : n === 'pen' ? pen(x, y, rot + 30, s * 1.2) : opener(x, y, s, rot);
      if (back) w += obj + tag;
    });
    w += actor(HERO, K1.hero, t, { seed: 3 });
    ORBIT.forEach(([n, i]) => {
      const a = t * 1.1 + i * Math.PI * 2 / 5, rx = lerp(900, 380, ok), ry = lerp(700, 150, ok);
      const x = 540 + Math.cos(a) * rx, y = 1250 + Math.sin(a) * ry, s = 0.85 + 0.25 * Math.sin(a), rot = Math.sin(t * 2 + i) * 20;
      if (Math.sin(a) >= 0) {
        const obj = n === 'scissors' ? scissors(x, y, s * 0.8, rot, 0.5 + 0.4 * Math.sin(t * 8)) : n === 'book' ? spiralBook(x, y, s * 0.35, rot) : n === 'mouse' ? mouse(x, y, s, rot) : n === 'pen' ? pen(x, y, rot + 30, s * 1.2) : opener(x, y, s, rot);
        w += obj + grp(`<circle r="30" fill="#E5483D" stroke="${INK}" stroke-width="4"/>` + txt(0, 12, 'D', 34, '#FFFFFF', { font: 'Anton', weight: 400 }), at(x + 60 * s, y - 90 * s, s));
      }
    });
    // la main gauche s'illumine
    const hp = handPos(HERO, K1.hero, t, 1, { scale: 1.12 });
    if (t > T.gaucher) w += `<circle cx="${r1(hp[0])}" cy="${r1(hp[1] - 40)}" r="${r1(110 + 14 * Math.sin(t * 9))}" fill="#FFE27A" ${op(0.45 * Ez.out(inv(T.gaucher, T.gaucher + 0.3, t)))} filter="url(#soft)"/>` + sparkles(hp[0], hp[1] - 40, t, T.gaucher, 14, 260, 7);
    let ui = '';
    const tk = spring(t, 0.2, 2.2, 0.6);
    let title = `<path d="${rr(-470, -150, 940, 300, 40)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>` + springWord(0, -46, 'POURQUOI C’EST HORRIBLE', 64, t, 0.32, { fill: '#FFD23F', sw: 0, stag: 0.02, dy: 40, ls: 3 });
    title += grp(springWord(0, 0, 'D’ÊTRE GAUCHER', 104, t, T.gaucher - 0.35, { fill: '#FFFFFF', sw: 0, stag: 0.035, dy: 60, ls: 4 }), `translate(0 92) scale(${r2(1 + 0.08 * punch(t, T.gaucher, 6, 20))})`);
    ui += grp(title, `translate(540 ${r1(300 + (1 - tk) * -420)}) rotate(${r1(-2 + Math.sin(t * 1.4) * 0.6)})`);
    // flèche « GAUCHE » vers la main
    const ak = spring(t, T.gaucher + 0.15, 2.4, 0.5);
    if (ak > 0.01) ui += grp(`<path d="M0 -26H120V-60L200 0L120 60V26H0Z" fill="#FFD23F" stroke="${INK}" stroke-width="7"/>` + txt(-20, 20, 'GAUCHE', 56, '#FFFFFF', { anchor: 'end', font: 'Anton', weight: 400, stroke: INK, sw: 10, ls: 2 }), `translate(${r1(hp[0] - 300 + Math.sin(t * 8) * 10)} ${r1(hp[1] - 30)}) scale(${r2(ak)})`);
    const bonk = T.les - 0.75;
    ui += onoma(700, 900, 'BONK', 110, t, bonk, { fill: '#FF8FC0', rot: 12 });
    return { w, ui, cam: cam0(1.02 + 0.08 * Ez.io(inv(0, T.les, t)) + 0.05 * punch(t, T.gaucher, 5, 18), 540, 1240, { shake: 16 * decay(t, bonk, 9) * (t > bonk ? 1 : 0) }), flash: cutFlash(t, T.gaucher, 0.35), cap: false };
  }

  // ================================================================== 2. ciseaux qui mâchent
  const K2 = {
    hero: [[0, { arms: { l: { at: [-90, -350], hand: 'fist', bend: 1, handAbs: 30 }, r: { at: [70, -350], hand: 'fist', bend: 1, handAbs: -100 } }, expr: 'concentre', x: 540, y: 1690, crouch: 0.25 }],
      [T.coupent, { expr: 'enerve', exprOver: { sweat: 1 } }], [T.papier + 0.55, { g: 'je_sais_pas', expr: 'blase', d: 0.3 }]],
  };
  function classroom(o = {}) {
    let w = room({ wall: o.wall || '#E8F0E4', stripe: o.stripe || '#DFE9DA', floor: '#C9A27A', fy: 1520 });
    w += windowBox(80, 330, 300, 360, '#BFE6F5', { sun: true }) + cel('M640 300H1000V560H640Z', '#2F5D46', { dx: 0, dy: 10, inner: L('M680 380Q760 340 840 380M680 460H900', '#E9F2EC', 5) });
    w += picture(820, 700, 160, 110, '#F6B53D', 2);
    return w;
  }
  function s2(t) {
    const shotB = t >= T.machent - 0.08 && t < T.papier + 0.55;
    if (shotB) {
      // très gros plan : les ciseaux mâchent la feuille
      const k = t - T.machent, chew = 0.35 + 0.35 * Math.abs(Math.sin(k * 11));
      let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#F7C7D6"/>` + rays(540, 900, 20, 2200, t * 0.4, '#F9D3DF');
      w += grp(paper(0, 0, 520, 360, 0, { margin: false }), `translate(${r1(560 + Math.sin(k * 11) * 8)} 900) rotate(${r1(-12 + Math.sin(k * 7) * 4)}) scale(1 ${r2(0.8 + 0.2 * Math.cos(k * 11))})`);
      w += scissors(560, 1560, 2.5, Math.sin(k * 11) * 4, chew, { teeth: true, face: true });
      const r = rng(Math.floor(k * 12));
      for (let i = 0; i < 6; i++) { const kk = ((k * 1.6 + i / 6) % 1); w += grp(cel('M-26 -18L22 -24L28 14L-18 22Z', '#FFFDF6', { dx: 3, dy: 3, sw: 4 }), at(560 + (i % 2 ? 1 : -1) * (80 + kk * 300), 980 - Math.sin(kk * Math.PI) * 300 + kk * 300, 0.8 + 0.4 * (i % 3), kk * 400 * (i % 2 ? 1 : -1))); }
      let ui = onoma(300, 520, 'CROUNCH', 120, t, T.machent + 0.05, { rot: -12 }) + onoma(800, 1500, 'MIAM', 90, t, T.machent + 0.45, { fill: '#FF8FC0', rot: 10 });
      return { w, ui, cam: cam0(1.0 + 0.05 * Math.sin(k * 11), 560, 1000, { shake: 6 }), flash: cutFlash(t, T.machent - 0.08), capY: 1460 };
    }
    let w = classroom();
    w += actor(HERO, K2.hero, t, { seed: 3 });
    const after = t >= T.papier + 0.55;
    const hpR = handPos(HERO, K2.hero, t, 1), hpL = handPos(HERO, K2.hero, t, -1);
    if (!after) {
      // la feuille tenue par la main droite (côté gauche de l'écran), les ciseaux par la gauche
      const cut = clamp((t - T.ciseaux) / 2.2);
      w += grp(paper(0, 0, 200, 160, 0, { margin: false, inner: P('M-60 -20C-60 -60 -10 -60 0 -30C10 -60 60 -60 60 -20C60 20 0 50 0 60C0 50 -60 20 -60 -20Z', 'none', 4).replace('fill="none"', 'fill="none" stroke-dasharray="10 8"') }), `translate(${r1(hpL[0] + 70)} ${r1(hpL[1] - 30)}) rotate(${r1(-6 + Math.sin(t * 14) * 3 * cut)})`);
      w += scissors(hpR[0] - 30, hpR[1] - 10, 0.55, -60, 0.5 + 0.45 * Math.sin(t * 16));
    } else {
      // la feuille mâchée (boule froissée)
      w += grp(cel('M-60 -40L-10 -70L50 -50L70 0L40 50L-20 60L-70 20Z', '#FFFDF6', { dx: 6, dy: 6 }) + L('M-40 -20L10 -40M-30 20L30 0M0 40L40 20', '#C9C4B8', 4), `translate(${r1(hpR[0] - 20)} ${r1(hpR[1] - 70)}) rotate(${r1(Math.sin(t * 3) * 6)})`);
    }
    w += desk(540, 1460, 860);
    let ui = '';
    if (t > T.rien - 0.05 && t < T.machent) ui += onoma(780, 900, 'RIEN.', 90, t, T.rien - 0.05, { fill: '#FFFFFF', rot: 6 });
    if (after) ui += onoma(800, 760, 'BOUHOU', 70, t, T.papier + 0.7, { fill: '#9AD0F5', rot: 8 });
    return { w, ui, cam: cam0(lerp(1.3, 1.45, inv(T.ciseaux, T.machent, t)), 560, 1200), flash: after ? cutFlash(t, T.papier + 0.55) : 0, capY: 1460 };
  }

  // ================================================================== 3. la main dans l'encre
  const K3 = { hero: [[0, { g: 'repos', expr: 'blase', x: 540, y: 2000, scale: 1.55, armsOver: { r: { at: [175, -590], hand: 'open', bend: 'low', handAbs: 170 } } }],
    [T.bleu, { expr: 'degoute', d: 0.2 }], [T.bleu + 0.6, { expr: 'blase', exprOver: { lx: 0.9, ly: -0.4 } }]] };
  function s3(t) {
    const shotB = t >= T.fin - 0.15;
    if (!shotB) {
      // vue de dessus : la main glisse sur ce qu'elle vient d'écrire
      let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#C79A6B"/>` + L('M-800 300H1900M-800 900H1900M-800 1500H1900', '#B98C5E', 6);
      w += paper(540, 980, 860, 1180, -3, { step: 70 });
      const k = inv(T.tu1 - 0.1, T.fin - 0.2, t);
      // 4 lignes écrites l'une après l'autre ; la main suit la ligne en cours
      const lines = 4, per = 1 / lines;
      let ink = '', handX = 0, handY = 0;
      for (let i = 0; i < lines; i++) {
        const kk = clamp((k - i * per) / per), y = 560 + i * 140;
        ink += scribbleLine(190, y, 700, kk, 11 + i, { w: 6 });
        if (kk > 0 && kk < 1) { handX = 190 + 700 * kk; handY = y; }
        if (kk >= 1) { handX = 890; handY = y; }
        // bavure : la tranche de la main traîne derrière la pointe
        const sm = clamp(kk * 1.1 - 0.05);
        if (sm > 0) ink += `<path d="M190 ${y + 14}H${r1(190 + 700 * sm)}" stroke="#2A4FA8" stroke-width="34" stroke-linecap="round" opacity=".33" filter="url(#smudge)"/>`;
      }
      w += grp(ink, 'rotate(-3 540 980)');
      w += bigHand(handX + 150, handY - 125, 1.25, -8, { ink: clamp(k * 1.4), sleeve: HERO.pal.top, skin: SK });
      let ui = onoma(820, 360, 'SPLOTCH', 100, t, T.encre, { fill: '#9AC4FF', rot: 8, t1: T.fin - 0.3 });
      return { w, ui, cam: cam0(1.12 + 0.12 * k, lerp(420, 600, k) + (handX - 540) * 0.6, lerp(820, 1080, k), { rot: -2 + k * 3 }), capY: 1460 };
    }
    // le héros montre sa main : le côté tout bleu
    let w = classroom({ wall: '#F3E6D8', stripe: '#EEDCCB' });
    w += actor(HERO, K3.hero, t, { seed: 3 });
    const hp = handPos(HERO, K3.hero, t, 1, {});
    const bk = Ez.out(inv(T.bleu - 0.1, T.bleu + 0.25, t));
    w += `<ellipse cx="${r1(hp[0] + 34)}" cy="${r1(hp[1] - 60)}" rx="22" ry="62" fill="#2A4FA8" opacity="${r2(0.9 * Math.max(0.6, bk))}" transform="rotate(-8 ${r1(hp[0] + 34)} ${r1(hp[1] - 60)})"/>`;
    let ui = '';
    if (t > T.bleu - 0.1) ui += rays(hp[0] + 34, hp[1] - 60, 18, 900, t * 0.6, '#FFFFFF', 0.18 * bk) + ring(hp[0] + 34, hp[1] - 60, t, T.bleu, 0.5, 380, '#9AC4FF', 20) + sparkles(hp[0] + 34, hp[1] - 60, t, T.bleu, 12, 240, 31, ['#9AC4FF', '#FFFFFF']);
    ui += onoma(330, 560, 'BEURK', 96, t, T.bleu + 0.15, { fill: '#7BD389', rot: -8 });
    return { w, ui, cam: cam0(lerp(1.15, 1.3, inv(T.fin, T.cahier, t)) + 0.1 * punch(t, T.bleu, 5, 16), 620, 1010), flash: cutFlash(t, T.fin - 0.15), capY: 1460 };
  }

  // ================================================================== 4. la spirale dans le poignet
  const K4 = { hero: [[0, { g: 'facepalm', expr: 'enerve', exprOver: { tears: 1, sweat: 1 }, x: 540, y: 2020, scale: 1.7 }], [T.poignet + 0.9, { g: 'facepalm', expr: 'pleure' }]] };
  function s4(t) {
    const shotB = t >= T.poignet + 0.45;
    if (!shotB) {
      let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#C79A6B"/>`;
      w += spiralBook(560, 960, 1.55, 90);
      const k = inv(T.cahier, T.poignet, t), press = Ez.io(clamp(k * 1.5)), lift = Ez.out(inv(T.poignet, T.poignet + 0.3, t));
      // la main appuie sur les anneaux, puis se soulève : marques rouges
      w += bigHand(lerp(420, 380, press), lerp(960, 1010, press) - lift * 200, 1.35 + 0.05 * press - lift * 0.1, 90 - lift * 10, { sleeve: HERO.pal.top, skin: SK });
      if (lift > 0.05) for (let i = 0; i < 5; i++) w += L(`M${300 + i * 40} ${r1(1060 - lift * 200)}v60`, '#E5483D', 9 * lift);
      let ui = onoma(760, 640, 'AÏE !', 130, t, T.poignet, { fill: '#FF6B6B', rot: 10 }) + ring(400, 1000, t, T.poignet, 0.4, 500, '#FF6B6B', 24);
      return { w, ui, cam: cam0(1.05 + 0.25 * press, 480, 1000, { shake: 18 * decay(t, T.poignet, 9) * (t > T.poignet ? 1 : 0) }), flash: t > T.poignet ? 0.4 * decay(t, T.poignet, 14) : 0, capY: 1460 };
    }
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#FFB3B3"/>` + rays(540, 1000, 20, 2200, t * 0.5, '#FFC2C2');
    w += actor(HERO, K4.hero, t, { seed: 3 });
    return { w, ui: '', cam: cam0(1.0 + 0.04 * Math.sin(t * 30) * decay(t, T.poignet + 0.45, 4), 540, 960), flash: cutFlash(t, T.poignet + 0.45), capY: 1460 };
  }

  // ================================================================== 5. cantine : les coudes
  const BITES = [T.cognes - 0.05, T.coude + 0.05, T.voisin + 0.1, T.chaque + 0.1, T.bouchee + 0.25];
  const tray2 = (side) => ({ at: [side * 70, -330], hand: 'fist', bend: 1, handAbs: side * -100 });
  const mouth = (side) => ({ at: [side * 24, -470], hand: 'fist', bend: 'low', handAbs: side * -150 });
  function eatKeys(base, side, exprs) {
    const k = [[0, Object.assign({ arms: { l: side < 0 ? mouth(-1) : tray2(-1), r: side > 0 ? tray2(1) : tray2(1) }, expr: exprs[0], crouch: 0.3 }, base)]];
    k[0][1].arms = { l: side < 0 ? tray2(-1) : { at: [-80, -330], hand: 'relax', bend: 1, handAbs: 20 }, r: side > 0 ? tray2(1) : { at: [80, -330], hand: 'relax', bend: 1, handAbs: -20 } };
    BITES.forEach((b, i) => {
      const arms = Object.assign({}, k[0][1].arms); arms[side > 0 ? 'r' : 'l'] = mouth(side);
      const arms2 = Object.assign({}, k[0][1].arms);
      k.push([b - 0.28, { arms, expr: exprs[Math.min(exprs.length - 1, i)], d: 0.2 }]);
      k.push([b + 0.12, { arms: arms2, lean: -side * 8, d: 0.25 }]);
      k.push([b + 0.45, { arms: arms2, lean: 0, d: 0.3 }]);
    });
    return k;
  }
  const K5 = {
    hero: eatKeys({ x: 380, y: 1690 }, 1, ['content', 'gene', 'gene', 'honte', 'honte']),
    voisin: eatKeys({ x: 700, y: 1690 }, -1, ['content', 'surpris', 'enerve', 'furieux', 'rouge']),
  };
  function s5(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="2400" fill="#FCE7C8"/>`;
    for (let x = -800; x < 1900; x += 100) for (let y = 700; y < 1100; y += 100) w += `<rect x="${x + 4}" y="${y + 4}" width="92" height="92" rx="6" fill="#FFF3DF"/>`;
    w += cel('M-60 1000H1140V1040H-60Z', '#E2C9A0', { dx: 0, dy: 8 }) + cel('M60 260H500V560H60Z', '#E5483D', { dx: 0, dy: 10, inner: txt(280, 440, 'CANTINE', 70, '#FFFFFF', { font: 'Anton', weight: 400, ls: 4 }) }) + windowBox(640, 280, 340, 300, '#BFE6F5', { sun: true });
    w += `<rect x="-800" y="1600" width="2700" height="800" fill="#B7C3CF"/>`;
    w += actor(HERO, K5.hero, t, { seed: 3, fx: t > BITES[3] ? { flush: 0.6 } : {} });
    w += actor(VOISIN, K5.voisin, t, { seed: 21, fx: t > BITES[2] + 0.12 ? { vein: 1 } : {} });
    // fourchettes dans les mains qui mangent
    const hh = handPos(HERO, K5.hero, t, 1), hv = handPos(VOISIN, K5.voisin, t, -1);
    w += fork(hh[0] - 10, hh[1] - 10, -30, 0.6) + fork(hv[0] + 10, hv[1] - 10, 30, 0.6);
    // purée sur la joue du voisin après le 3e choc
    if (t > BITES[2] + 0.12) w += E(700 - 70, 1690 - 520, 30, 20, '#F6E2A8', 4);
    w += desk(540, 1430, 1000, { col: '#9FB4C7', h: 400 }) + tray(380, 1420, 0.9, { peas: Math.max(0, 12 - BITES.filter(b => t > b).length * 2) }) + tray(700, 1420, 0.9);
    let ui = '', shake = 0;
    BITES.forEach((b, i) => {
      if (t > b) {
        const mx = 540, my = 1300;
        ui += ring(mx, my, t, b, 0.35, 260, '#FFFFFF', 18) + onoma(mx, my - 200, ['BONK', 'PAF', 'TOC', 'BAM', 'AÏE'][i], 84 + i * 6, t, b, { t1: b + 0.55, rot: (i % 2 ? 10 : -10) });
        // petits pois qui volent
        const dt = t - b; if (dt < 0.9) { const r = rng(40 + i); for (let j = 0; j < 7; j++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.4, v = 500 + r() * 500; ui += E(mx + Math.cos(a) * v * dt, my + Math.sin(a) * v * dt + 1400 * dt * dt, 11, 10, '#7BC14E', 3); } }
        shake = Math.max(shake, 14 * decay(t, b, 10));
      }
    });
    const n = BITES.filter(b => t > b).length;
    if (n > 0) ui += grp(`<path d="${rr(-90, -50, 180, 100, 24)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="5"/>` + txt(0, 22, '×' + n, 70, '#FFD23F', { font: 'Anton', weight: 400 }), `translate(900 380) rotate(6) scale(${r2(1 + 0.25 * punch(t, BITES[n - 1], 8, 26))})`);
    return { w, ui, cam: cam0(1.18 + 0.03 * n, 540, 1260, { shake }), capY: 1460 };
  }

  // ================================================================== 6. tableau : la manche efface
  const K6 = { hero: [[0, { arms: { l: [10, -10, 'relax'], r: { at: [190, -560], hand: 'fist', bend: 1, handAbs: -120 } }, expr: 'concentre', x: 300, y: 1720, turn: 0.55 }],
    [T.manche + 0.35, { g: 'gene', expr: 'gene', turn: 0, d: 0.3 }]] };
  function s6(t) {
    let w = classroom({ wall: '#E3ECF7', stripe: '#D9E4F2' });
    w += board(560, 820, 980, 600);
    const k = inv(T.tableau - 0.1, T.manche + 0.3, t);
    const hx = 300 + 360 * Ez.sine(k);
    // le texte n'est visible qu'entre la manche (qui efface) et la main (qui écrit)
    const penX = hx + 230, eraseX = hx + 60;
    w += `<clipPath id="bw"><rect x="${r1(eraseX)}" y="500" width="${r1(Math.max(0, penX - eraseX))}" height="600"/></clipPath>`;
    w += `<g clip-path="url(#bw)">` + txt(150, 760, 'Le gaucher est un génie', 92, '#2A4FA8', { anchor: 'start', font: 'Caveat', weight: 700 }) + txt(150, 900, '2 + 2 = 4', 92, '#2A4FA8', { anchor: 'start', font: 'Caveat', weight: 700 }) + `</g>`;
    // traces de bavure sur le tableau, derrière la manche
    w += `<rect x="150" y="690" width="${r1(Math.max(0, eraseX - 150))}" height="90" fill="#9AB0D8" opacity=".25" filter="url(#smudge)"/>`;
    w += actor(HERO, K6.hero, t, { seed: 3, x: hx - 300 });
    const hp = handPos(HERO, K6.hero, t, 1, { x: hx - 300 });
    if (t < T.manche + 0.35) w += pen(hp[0] + 6, hp[1] - 6, -110, 0.45, { col: '#2A4FA8' });
    // élèves de dos au premier plan qui rigolent
    const laugh = t > T.manche ? Math.sin(t * 30) * 6 : 0;
    w += backHead(180, 1760 + laugh, 1.3, '#B5532A', '#F0C8A8', '#F28CB1') + backHead(560, 1790 - laugh, 1.35, '#24160F', '#C98E62', '#7FB7BE') + backHead(930, 1760 + laugh, 1.3, '#E3B94F', '#F2C9AC', '#5FB57A');
    let ui = '';
    if (t > T.manche) ui += onoma(260, 560, 'HAHAHA', 90, t, T.manche + 0.05, { fill: '#FFFFFF', rot: -8 }) + onoma(820, 1220, 'MDR', 80, t, T.manche + 0.25, { fill: '#FFD23F', rot: 10 });
    return { w, ui, cam: cam0(1.22, lerp(420, 700, Ez.sine(k)), 1080), capY: 1460 };
  }

  // ================================================================== 7. mamie te « corrige »
  const K7 = {
    hero: [[0, { arms: { l: { at: [-80, -330], hand: 'relax', bend: 1, handAbs: 20 }, r: { at: [70, -340], hand: 'fist', bend: 1, handAbs: -110 } }, expr: 'content', x: 420, y: 1690, crouch: 0.25 }],
      [T.corriger - 0.05, { arms: { l: { at: [-60, -340], hand: 'fist', bend: 1, handAbs: 110 }, r: { at: [90, -320], hand: 'relax', bend: 1, handAbs: -20 } }, expr: 'blase', d: 0.3 }],
      [T.corriger + 0.5, { expr: 'sonne', d: 0.2 }]],
    mamie: [[0, { g: 'repos', expr: 'content', x: 1250, y: 1720, flip: true }], [T.mamie - 0.2, { g: 'repos', expr: 'mefiant', x: 800, d: 0.8, e: 'io' }],
      [T.essaie, { g: 'pointe_g', expr: 'hautain', x: 780 }], [T.corriger - 0.25, { armsOver: { l: { at: [-260, -470], hand: 'fist', bend: 1, handAbs: 60 } }, expr: 'determine', x: 760, lean: -12 }],
      [T.corriger + 0.4, { g: 'pouce_d', expr: 'fier', x: 780, lean: 0 }]],
  };
  function s7(t) {
    let w = room({ wall: '#F2DCE8', stripe: '#EDD1E0', floor: '#B98A62', fy: 1500 }) + picture(220, 560, 180, 140, '#A97CC9', -3) + picture(860, 520, 150, 190, '#F6B53D', 3) + plant(980, 1500, 1);
    w += L('M760 -100V250', INK, 5) + cel('M680 250H840L880 330H640Z', '#F6D04D', { dx: 12, dy: 6 });
    const walking = t > T.mamie - 0.2 && t < T.mamie + 0.6;
    w += actor(MAMIE, K7.mamie, t, { seed: 31, walk: walking ? 6 : 0, walkAmp: 0.6 });
    w += actor(HERO, K7.hero, t, { seed: 3 });
    const swapped = t > T.corriger;
    const hp = handPos(HERO, K7.hero, t, swapped ? -1 : 1);
    w += desk(420, 1440, 640, { col: '#C98E5A' });
    w += paper(420, 1430, 360, 120, -2, { margin: false, step: 30, inner: swapped ? `<path d="M-140 -20l20 30l18 -40l22 44l16 -38l24 40l20 -46l26 42l18 -30" fill="none" stroke="#E5483D" stroke-width="5" stroke-dasharray="600" stroke-dashoffset="${r1(600 * (1 - clamp((t - T.corriger - 0.2) / 0.8)))}"/>` : scribbleLine(-140, -10, 260, clamp((t - 0.2) / 2), 71, { w: 4 }) });
    w += pen(hp[0] + (swapped ? 10 : -10), hp[1] - 8, swapped ? 160 : -160, 0.45);
    let ui = bubble(760, 760, 520, 190, 'LA BONNE MAIN !', 56, t, T.corriger - 0.2, { shout: true, font: 'Anton', fill: '#FFFFFF', tail: [120, 170] });
    ui += onoma(330, 1000, '?!', 110, t, T.corriger + 0.5, { fill: '#FFD23F', rot: -10 });
    return { w, ui, cam: cam0(1.1, 560, 1240), capY: 1460 };
  }

  // ================================================================== 8. le stylo spécial gaucher
  const K8 = { hero: [[0, { g: 'reflechit', expr: 'pense', x: 540, y: 1720 }], [T.special - 0.3, { g: 'repos', expr: 'emerveille', armsOver: { r: { at: [150, -520], hand: 'fist', bend: 'low', handAbs: -160 } }, d: 0.25 }],
    [T.bavure, { g: 'victoire', expr: 'excite', jump: 50, d: 0.2 }], [T.bavure + 0.3, { g: 'victoire', expr: 'ravi', jump: 0 }]] };
  function s8(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#20183A"/>` + rays(540, 700, 24, 2400, t * 0.3, '#2A2050');
    w += `<path d="M380 -200L700 -200L1000 1800H80Z" fill="#FFF2B0" opacity=".12"/>` + `<ellipse cx="540" cy="1720" rx="380" ry="50" fill="#FFF2B0" opacity=".2"/>`;
    w += actor(HERO, K8.hero, t, { seed: 3 });
    // la boîte descend, s'ouvre, le stylo s'envole en tournant jusqu'à la main
    const bk = spring(t, T.alors - 0.1, 1.8, 0.6), open = Ez.out(inv(T.enfin, T.special - 0.3, t));
    const hp = handPos(HERO, K8.hero, t, 1);
    if (t < T.special) w += penBox(540, lerp(-500, 700, bk), 1.15, Math.sin(t * 2) * 3, { ticks: 0 });
    else w += penBox(820, 560, 0.55, 8, { ticks: clamp((t - T.effacable + 0.1) * 3) + clamp((t - T.bavure + 0.1) * 3) });
    if (t > T.enfin) {
      const k = inv(T.enfin, T.special - 0.05, t), x = lerp(540, hp[0], Ez.io(k)), y = lerp(640, hp[1], Ez.io(k)) - Math.sin(Math.PI * k) * 300;
      w += pen(x, y + (k >= 1 ? -10 : 0), k < 1 ? t * 900 : -160, 0.8, { col: '#FFD23F', cap: '#E59E2A', glow: 1 });
      w += sparkles(x, y, t, T.enfin, 10, 200, 81);
    }
    let ui = '';
    if (t > T.special) ui += ring(hp[0], hp[1], t, T.special, 0.5, 600, '#FFE27A', 22) + sparkles(hp[0], hp[1], t, T.special, 16, 420, 83);
    ui += grp(`<path d="${rr(-150, -50, 300, 100, 50)}" fill="#E5483D" stroke="#FFFFFF" stroke-width="5"/>` + txt(0, 20, '4,99 €', 58, '#FFFFFF', { font: 'Anton', weight: 400 }), `translate(250 ${r1(520 + Math.sin(t * 2) * 10)}) rotate(-8) scale(${r2(spring(t, T.enfin + 0.2, 2.4, 0.5))})`);
    if (t > T.bavure) ui += confetti(540, 900, t, T.bavure, 40, 85);
    return { w, ui, cam: cam0(1.0 + 0.06 * Ez.io(inv(T.alors, T.premier, t)), 540, 1150), flash: cutFlash(t, T.special, 0.4), capY: 1460 };
  }

  // ================================================================== 9. le contrôle (tu es fier)
  const K9 = { hero: [[0, { arms: { l: { at: [-80, -330], hand: 'open', bend: 1, handAbs: 30 }, r: { at: [70, -345], hand: 'fist', bend: 1, handAbs: -110 } }, expr: 'determine', x: 540, y: 1690, crouch: 0.25 }],
    [T.fier - 0.1, { g: 'fier', expr: 'fier', crouch: 0.1, d: 0.3 }]] };
  function s9(t) {
    let w = classroom();
    w += backHead(160, 1880, 1.2, '#24160F', '#C98E62', '#7FB7BE') + backHead(920, 1880, 1.2, '#B5532A', '#F0C8A8', '#F28CB1');
    const writing = t < T.fier - 0.1;
    w += actor(HERO, K9.hero, t, { seed: 3, bob: writing ? Math.sin(t * 40) * 3 : 0 });
    const hp = handPos(HERO, K9.hero, t, 1);
    if (writing) w += pen(hp[0] - 4 + Math.sin(t * 40) * 6, hp[1] - 6, -160, 0.45, { col: '#FFD23F', cap: '#E59E2A' });
    w += desk(540, 1460, 820);
    w += paper(540, 1452, 300, 100, 0, { margin: false, step: 22 });
    // incrustation : la copie qui se remplit, main propre
    let ui = '';
    const ik = spring(t, T.controle - 0.2, 2.4, 0.6) * (1 - Ez.in(inv(T.fier - 0.2, T.fier + 0.1, t)));
    if (ik > 0.01) {
      const k = inv(T.controle, T.fier - 0.15, t);
      let inner = txt(-180, -250, 'CONTRÔLE', 54, '#E5483D', { anchor: 'start', font: 'Anton', weight: 400, ls: 3 });
      for (let i = 0; i < 7; i++) inner += scribbleLine(-200, -170 + i * 58, 420, clamp(k * 7 - i), 91 + i, { w: 5 });
      ui += grp(paper(0, 0, 520, 640, 0, { inner, step: 58 }) + `<rect x="-270" y="-330" width="540" height="660" fill="none" stroke="#FFFFFF" stroke-width="10"/>`, `translate(270 600) rotate(-4) scale(${r2(ik * 0.66)})`);
      ui += grp(`<circle r="46" fill="#7BD389" stroke="${INK}" stroke-width="5"/><path d="M-20 0l14 16l26 -30" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>`, `translate(430 330) scale(${r2(spring(t, T.ecris3, 2.6, 0.5))})`);
      ui += speedLines(270, 600, t, 22, 5, 0.18, '#FFFFFF', 300);
    }
    if (t > T.fier - 0.1) ui += rays(540, 1100, 20, 1400, t * 0.6, '#FFE27A', 0.25 * Ez.out(inv(T.fier, T.fier + 0.3, t))) + sparkles(540, 1050, t, T.fier, 16, 420, 93) + onoma(540, 560, 'FINI !', 130, t, T.fier, { rot: -6 });
    return { w, ui, cam: cam0(1.12 + 0.06 * punch(t, T.fier, 4, 14), 540, 1250), flash: cutFlash(t, T.fier - 0.1, 0.3), capY: 1460 };
  }

  // ================================================================== 10. le radiateur
  const K10 = {
    prof: [[0, { g: 'tient', expr: 'content', x: 260, y: 1720, armsOver: { l: { at: [-60, -430], hand: 'open', bend: 1, handAbs: 80 }, r: { at: [60, -430], hand: 'open', bend: 1, handAbs: -80 } } }],
      [T.pose - 0.1, { x: 560, d: 0.7, e: 'io', expr: 'content' }], [T.radiateur - 0.15, { x: 600, lean: 16, crouch: 0.1, armsOver: { l: { at: [40, -330], hand: 'open', bend: 1, handAbs: 80 }, r: { at: [180, -330], hand: 'open', bend: 1, handAbs: -80 } }, d: 0.35 }],
      [T.radiateur + 0.45, { g: 'repos', expr: 'ok', lean: 0, crouch: 0, x: 560 }]],
    hero: [[0, { g: 'repos', expr: 'choque', x: 540, y: 2060, scale: 1.7 }], [T.blanche, { g: 'deux_mains_bouche', expr: 'terrifie', d: 0.2 }]],
  };
  function s10(t) {
    const shotB = t >= T.tienne - 0.15;
    if (!shotB) {
      let w = classroom({ wall: '#E8E4F2', stripe: '#E0DBEE' });
      w += radiator(820, 1340, 1.05, t, Ez.out(inv(T.radiateur, T.radiateur + 0.5, t)));
      const walking = t > T.pose - 0.1 && t < T.pose + 0.6;
      w += actor(PROF, K10.prof, t, { seed: 41, walk: walking ? 7 : 0, walkAmp: 0.7 });
      // la pile de copies dans les mains, puis sur le radiateur
      const hp = handPos(PROF, K10.prof, t, 1), hl = handPos(PROF, K10.prof, t, -1);
      const placed = t > T.radiateur + 0.15;
      const px = placed ? 820 : (hp[0] + hl[0]) / 2, py = placed ? 1170 : (hp[1] + hl[1]) / 2 - 10;
      for (let i = 0; i < 5; i++) w += grp(paper(0, 0, 220, 50, 0, { margin: false, step: 100 }), at(px + (i - 2) * 3, py - i * 9, 1, (i - 2) * 2));
      return { w, ui: thermo(t), cam: cam0(1.08, 600, 1220), capY: 1460 };
    }
    // gros plan : l'encre s'efface à la chaleur
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#F4F1EA"/>`;
    for (let i = 0; i < 12; i++) w += L(`M${-200 + i * 120} 1500V2100`, '#E2DED4', 30);
    const k = inv(T.tienne, T.blanche + 0.25, t);
    let inner = txt(-260, -440, 'CONTRÔLE', 66, '#E5483D', { anchor: 'start', font: 'Anton', weight: 400, ls: 3 }) + txt(150, -440, 'Nom : Yanis', 40, '#2A4FA8', { anchor: 'start', font: 'Caveat', weight: 700, op: 1 - clamp(k * 1.4 - 0.3) });
    for (let i = 0; i < 10; i++) { const fadeAt = 1 - i / 10; inner += scribbleLine(-280, -340 + i * 80, 560, 1, 91 + i, { w: 6, op: 1 - clamp((k - (1 - fadeAt) * 0.8) * 4) }); }
    w += paper(540, 960, 760, 1100, -2, { inner, step: 80 });
    let ui = thermo(t) + grp(`<circle r="130" fill="#FFFFFF" stroke="${INK}" stroke-width="8"/><clipPath id="face"><circle r="124"/></clipPath><g clip-path="url(#face)">` + actor(HERO, K10.hero, t, { seed: 3, x: -540, y: -1240 }) + `</g>`, `translate(860 1140) scale(${r2(spring(t, T.devient, 2.4, 0.55))})`);
    return { w, ui, cam: cam0(1.0 + 0.04 * Math.abs(Math.sin(t * 7)) * clamp(k * 2), 540, 960), heat: 0.6 + 0.4 * clamp(k * 2), flash: cutFlash(t, T.tienne - 0.15, 0.3), capY: 1460 };
  }
  function thermo(t) {
    const h = Ez.out(inv(T.radiateur, T.blanche, t));
    if (t < T.radiateur - 0.2) return '';
    return grp(`<path d="${rr(-26, -260, 52, 300, 26)}" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/><circle cy="70" r="46" fill="#E5483D" stroke="${INK}" stroke-width="6"/><rect x="-12" y="${r1(30 - 260 * h)}" width="24" height="${r1(260 * h + 20)}" fill="#E5483D"/>` +
      txt(50, -200, `${Math.round(lerp(20, 60, h))}°`, 54, '#E5483D', { anchor: 'start', font: 'Anton', weight: 400, stroke: '#FFFFFF', sw: 8 }), `translate(120 420) scale(${r2(spring(t, T.radiateur - 0.2, 2.4, 0.55))})`);
  }

  // ================================================================== 11. zéro, copie blanche
  const K11 = { hero: [[0, { g: 'desespoir', expr: 'sonne', x: 540, y: 1720, scale: 1.05 }]] };
  function s11(t) {
    const shotB = t >= T.copie + 0.55;
    if (!shotB) {
      let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#F4F1EA"/>` + paper(540, 960, 760, 1100, -2, { step: 80, inner: txt(-260, -440, 'CONTRÔLE', 66, '#E5483D', { anchor: 'start', font: 'Anton', weight: 400, ls: 3 }) });
      const k = Ez.io(inv(T.zero2 - 0.05, T.zero2 + 0.45, t));
      w += `<ellipse cx="480" cy="880" rx="210" ry="270" fill="none" stroke="#E5483D" stroke-width="34" stroke-linecap="round" stroke-dasharray="1600" stroke-dashoffset="${r1(1600 * (1 - k))}" transform="rotate(-8 480 880)"/>`;
      w += txt(760, 1060, '/20', 150, '#E5483D', { font: 'Caveat', weight: 700, op: clamp((t - T.zero2 - 0.35) * 5) });
      let ui = stamp(540, 1380, 'COPIE BLANCHE', t, T.copie, { size: 110, col: '#E5483D', rot: -10 });
      return { w, ui, cam: cam0(1.05 + 0.1 * k, 520, 960, { shake: 16 * decay(t, T.copie + 0.16, 9) * (t > T.copie + 0.16 ? 1 : 0) }), capY: 1460 };
    }
    let w = classroom({ wall: '#D9D9E3', stripe: '#D0D0DC' });
    w += actor(HERO, K11.hero, t, { seed: 3, fx: { pale: 0.7, gloom: 1 } });
    // nuage de pluie au-dessus de la tête
    let c = cel('M-160 40Q-180 -40 -100 -50Q-80 -120 0 -110Q70 -150 120 -70Q190 -60 170 20Q160 60 100 60H-120Q-170 60 -160 40Z', '#8A8FA8', { dx: 12, dy: 8 });
    for (let i = 0; i < 9; i++) { const kk = ((t * 2.2 + i * 0.37) % 1); c += L(`M${-120 + i * 30} ${r1(80 + kk * 260)}l-6 22`, '#7FB8E8', 6); }
    w += grp(c, at(540, 820 + Math.sin(t * 2) * 8));
    const pk = Ez.out(inv(T.copie + 0.55, T.copie + 0.9, t));
    w += grp(paper(0, 0, 220, 300, 0, { margin: false, step: 40, inner: `<ellipse cx="-20" cy="-10" rx="60" ry="80" fill="none" stroke="#E5483D" stroke-width="12"/>` }), at(540, lerp(1600, 1380, pk), 1, -6));
    let ui = onoma(300, 520, 'HAHA', 80, t, T.copie + 0.8, { fill: '#FFFFFF', rot: -10 });
    return { w, ui, cam: cam0(1.15, 540, 1180), sat: 0.55, flash: cutFlash(t, T.copie + 0.55, 0.3), capY: 1460 };
  }

  // ================================================================== 12. Et toi ? gaucher ou droitier
  const K12 = {
    hero: [[0, { g: 'salut_g', expr: 'malin', x: 290, y: 1760, armsOver: { r: 'haut' }, armsOverL: null }], [T.disle, { g: 'pointe_d', expr: 'malin' }]],
    voisin: [[0, { g: 'salut_g', expr: 'moqueur', x: 790, y: 1760 }], [T.disle, { g: 'pointe_g', expr: 'moqueur' }]],
  };
  function s12(t) {
    let w = `<rect x="-800" y="-800" width="1340" height="3600" fill="#3D5BD8"/><rect x="540" y="-800" width="1400" height="3600" fill="#F28C38"/>` + rays(270, 1000, 14, 1600, t * 0.3, '#4A68E0') + L('M540 -800V3000', '#FFFFFF', 10);
    w += actor(HERO, K12.hero, t, { seed: 3 }) + actor(VOISIN, K12.voisin, t, { seed: 21 });
    let ui = txt(270, 360, 'GAUCHER', 110, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 14, ls: 3 }) + txt(810, 360, 'DROITIER', 110, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 14, ls: 3 });
    ui += grp(txt(0, 40, 'OU', 120, '#FFD23F', { font: 'Anton', weight: 400, stroke: INK, sw: 16 }), `translate(540 520) scale(${r2(spring(t, T.toi, 2.6, 0.45) * (1 + 0.06 * Math.sin(t * 6)))})`);
    // barre de vote qui hésite
    const v = 0.5 + 0.12 * Math.sin(t * 2.6) + 0.06 * Math.sin(t * 7.1);
    ui += `<path d="${rr(90, 650, 900, 70, 35)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="5"/><path d="${rr(100, 660, 880 * v, 50, 25)}" fill="#7FA6FF"/>` + txt(140, 700, Math.round(v * 100) + ' %', 40, '#FFFFFF', { anchor: 'start', font: 'Anton', weight: 400 }) + txt(940, 700, Math.round((1 - v) * 100) + ' %', 40, '#FFFFFF', { anchor: 'end', font: 'Anton', weight: 400 });
    if (t > T.disle - 0.2) {
      const k = spring(t, T.disle - 0.2, 2.4, 0.6), typed = 'Gaucher et fier'.slice(0, Math.floor(clamp((t - T.disle - 0.2) * 14, 0, 15)));
      ui += grp(`<path d="${rr(-470, -60, 940, 120, 60)}" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/><circle cx="-400" cy="0" r="38" fill="#F28C38"/>` + txt(-340, 16, (typed || 'Ajouter un commentaire…') + (Math.floor(t * 3) % 2 ? '|' : ''), 42, typed ? INK : '#9A94A0', { anchor: 'start', weight: typed ? 800 : 600 }), `translate(540 ${r1(lerp(2100, 1560, k))})`);
    }
    return { w, ui, cam: cam0(1.0 + 0.03 * Math.sin(t * 0.9), 540, 1100), capY: 1300 };
  }

  // ================================================================== 13. abonne-toi / like / prochain
  const K13 = {
    hero: [[0, { g: 'coucou_d', expr: 'content', x: 400, y: 1660 }], [T.abonne, { g: 'pointe_haut', expr: 'excite' }], [T.like, { g: 'pouce_d', expr: 'joie' }],
      [T.horrible + 0.5, { g: 'coucou_d', expr: 'content' }], [T.horrible + 1.2, { g: 'coucou_g', expr: 'blase', d: 0.25 }]],
    mamie: [[0, { g: 'repos', expr: 'mefiant', x: 1300, y: 1680, flip: true }], [T.horrible + 0.5, { g: 'pointe_g', expr: 'hautain', x: 820, d: 0.6, e: 'io' }]],
  };
  function thumb() { return P('M-34 -6H-10L8 -54Q14 -66 26 -60Q38 -54 34 -36L28 -10H58Q72 -10 70 6L62 50Q58 62 46 62H-10V-6Z', '#FFFFFF', 6) + P('M-56 -6H-24V62H-56Z', '#FFFFFF', 6); }
  function bell(rot) { return grp(P('M0 -44Q30 -44 32 -6L36 22Q38 30 46 34H-46Q-38 30 -36 22L-32 -6Q-30 -44 0 -44Z', '#FFFFFF', 6) + `<circle cx="0" cy="44" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`, `rotate(${r1(rot)} 0 -44)`); }
  function s13(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#3D5BD8"/>` + rays(540, 900, 22, 2400, t * 0.2, '#4A68E0');
    w += `<rect x="-800" y="1500" width="2700" height="900" fill="#2E47B5"/>` + L('M-800 1500H1900', INK, 5);
    w += actor(HERO, K13.hero, t, { seed: 3 });
    w += actor(MAMIE, K13.mamie, t, { seed: 31, walk: t > T.horrible + 0.5 && t < T.horrible + 1.1 ? 6 : 0, walkAmp: 0.6 });
    let ui = '';
    const bIn = spring(t, T.abonne - 0.25, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = P(rr(-380, -80, 760, 160, 80), done ? '#3A3A42' : '#E5483D', 7) + txt(done ? 40 : 0, 28, done ? 'ABONNÉ' : 'S’ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    const fade = 1 - Ez.io(inv(T.prochain, T.prochain + 0.35, t));
    let cta = grp(btn, `translate(540 ${r1(330 + (1 - bIn) * -400)}) scale(${r2(bIn * pr)})`) + ring(540, 330, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 330, t, press, 16, 460, 141);
    const cur = inv(T.abonne - 0.2, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 360, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
    if (t < press + 0.9) cta += grp(P('M0 0L0 70L18 54L32 86L46 80L32 48L56 48Z', '#FFFFFF', 6), `translate(${r1(cx)} ${r1(cy)}) scale(${cs * 1.4})`, op(1 - inv(press + 0.5, press + 0.9, t)));
    const lk = spring(t, T.like, 2.6, 0.45);
    // le pouce du like est une main GAUCHE (miroir)
    if (lk > 0.01) cta += grp(`<circle r="110" fill="#F28C38" stroke="${INK}" stroke-width="7"/>` + grp(thumb(), 'translate(6 4) scale(-1.15 1.15)'), `translate(540 620) rotate(${r1((1 - lk) * 30)}) scale(${r2(lk)})`) + sparkles(540, 620, t, T.like, 18, 380, 142, ['#FFFFFF', '#F28C38', '#FFE27A']) + ring(540, 620, t, T.like, 0.6, 520, '#FFFFFF', 18);
    ui += `<g ${op(fade)}>${cta}</g>`;
    if (t > T.prochain) {
      const k = spring(t, T.prochain, 2.2, 0.6);
      const card = `<path d="${rr(-470, -170, 940, 340, 40)}" fill="#1C1418" stroke="#FFFFFF" stroke-width="6"/>` + txt(0, -80, 'PROCHAIN ÉPISODE', 40, '#FFFFFF', { ls: 6, weight: 700 }) +
        springWord(0, 10, 'POURQUOI', 86, t, T.pch, { fill: '#FFD23F', sw: 0, stag: 0.03, dy: 50, ls: 3 }) + springWord(0, 112, 'C’EST HORRIBLE…', 86, t, T.horrible, { fill: '#FFFFFF', sw: 0, stag: 0.03, dy: 50, ls: 3 });
      ui += grp(card, `translate(540 ${r1(lerp(-300, 470, k))}) rotate(${r1(-2 + Math.sin(t * 1.3) * 0.8)})`);
    }
    if (t > T.horrible + 1.0) ui += bubble(760, 820, 420, 170, 'L’AUTRE MAIN !', 54, t, T.horrible + 1.0, { shout: true, font: 'Anton', fill: '#FFFFFF', tail: [40, 150] });
    return { w, ui, cam: cam0(1 + 0.03 * Math.sin(t * 0.7), 540, 1160), cap: t < T.horrible + 0.7, capY: 1300 };
  }

  X.T = T; X.W = W; X.DUR = DUR;
  const b = (word, pad) => word - pad;
  X.SCENES = [
    { f: s1, a: 0, b: b(T.les, 0.3) },
    { f: s2, a: b(T.les, 0.3), b: b(T.tu1, 0.3), tin: 'zoom', d: 0.35 },
    { f: s3, a: b(T.tu1, 0.3), b: b(T.cahier, 0.45), tin: 'ink', d: 0.5 },
    { f: s4, a: b(T.cahier, 0.45), b: b(T.cantine, 0.5), tin: 'swipe', d: 0.32 },
    { f: s5, a: b(T.cantine, 0.5), b: b(T.tableau, 0.4), tin: 'whip', d: 0.3 },
    { f: s6, a: b(T.tableau, 0.4), b: b(T.mamie, 0.6), tin: 'rip', d: 0.45 },
    { f: s7, a: b(T.mamie, 0.6), b: b(T.alors, 0.3), tin: 'whip', d: 0.3 },
    { f: s8, a: b(T.alors, 0.3), b: b(T.premier, 0.3), tin: 'iris', d: 0.45 },
    { f: s9, a: b(T.premier, 0.3), b: b(T.prof, 0.4), tin: 'swipe', d: 0.32 },
    { f: s10, a: b(T.prof, 0.4), b: b(T.zero2, 0.2), tin: 'whip', d: 0.3 },
    { f: s11, a: b(T.zero2, 0.2), b: b(T.toi, 0.45), tin: 'flash', d: 0.25 },
    { f: s12, a: b(T.toi, 0.45), b: b(T.abonne, 0.3), tin: 'rip', d: 0.45 },
    { f: s13, a: b(T.abonne, 0.3), b: DUR + 1, tin: 'zoom', d: 0.4 },
  ];
})();
