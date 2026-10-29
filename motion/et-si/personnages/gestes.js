// Bibliothèque de 100 gestes pour le rig v2 (EtSi2.person).
// Chaque geste = une place pour le bras gauche, une pour le bras droit, + attitude du corps
// (buste, épaules, tête, bassin, saut) + émotion conseillée. Les places sont calculées à
// partir des repères du gabarit (tête, épaules, taille), donc les gestes marchent pour
// tous les corps (enfant, ado, adulte, rond, âgé, petit).
//   const o = EtSi2.geste('salut', 'adulte')  ->  { arms, lean, tilt, ..., expr }
(function (root) {
  const K = root.EtSi2;

  // places d'un bras (side = -1 bras gauche de l'écran, +1 droit)
  function place(name, side, sp) {
    const R = sp.R, hy = sp.shY - R * 0.92 - sp.neckLen, sh = sp.shY, w = sp.waistY, o = sp.shO, hw = sp.hemW;
    const at = (x, y, hand, handAbs, bend, extra) => Object.assign({ at: [side * x, y], hand, handAbs, bend }, extra || {});
    switch (name) {
      case 'bas': return [12, -16, 'relax'];
      case 'ouvert': return [22, -8, 'open'];
      case 'ballant': return [5, -3, 'relax'];
      case 'poing_bas': return [14, -10, 'fist'];
      case 'poche': return at(26, w - 64, 'none', 0, 1);
      case 'hanche': return at(hw + 14, w - 40, 'fist', 72);
      case 'ventre': return at(14, w - 72, 'open', 100, 1);
      case 'coeur': return at(-12, sh + 84, 'open', 118, 1);
      case 'menton': return at(R * 0.2, hy + R * 1.06, 'fist', 182, -1);
      case 'bouche': return at(R * 0.06, hy + R * 0.82, 'open', 176, -1);
      case 'joue': return at(R * 0.86, hy + R * 0.92, 'open', 168, -1);
      case 'oeil': return at(R * 0.44, hy + R * 0.5, 'fist', 175, -1);
      case 'front': return at(R * 0.62, hy - R * 0.36, 'open', 118, -1);
      case 'facepalm': return at(R * 0.32, hy + R * 0.62, 'open', 172, -1);
      case 'tete': return at(R * 0.88, hy - R * 0.22, 'open', 160, -1);
      case 'nuque': return at(R * 0.96, hy + R * 0.05, 'fist', 205, -1);
      case 'oreille': return at(R * 1.1, hy + R * 0.12, 'open', 192, -1);
      case 'haut': return at(R * 0.95, hy - R * 1.45, 'open', 180);
      case 'haut_poing': return at(R * 0.95, hy - R * 1.45, 'fist', 180);
      case 'haut_large': return at(o + 90, hy - R * 1.2, 'open', 200);
      case 'salut': return at(o + 70, hy - 10, 'open', 200);
      case 'coucou': return at(o + 96, sh + 24, 'open', 215, -1);
      case 'pointe': return at(o + 170, sh + 30, 'point', -84);
      case 'pointe_haut': return at(o + 70, hy - R * 0.9, 'point', -150);
      case 'pointe_bas': return at(o + 70, w + 40, 'point', -30);
      case 'pointe_soi': return at(14, sh + 66, 'point', 84, 1);
      case 'pointe_avant': return at(o * 0.5, sh + 70, 'point', 180, -1);
      case 'paume': return at(o + 70, sh + 66, 'open', -140, -1);
      case 'stop': return at(o + 44, sh + 18, 'open', 180, -1);
      case 'tendu': return at(o + 182, sh + 44, 'open', -90);
      // bras croisés : avant-bras à l'horizontale, celui de droite par-dessus, sa main posée sur l'autre bras
      case 'croise_haut': return at(-o * 0.16, sh + R * 0.8, 'relax', 90, 1);
      case 'croise_bas': return at(-o * 0.52, sh + R * 1.0, 'none', 90, 1);
      case 'dos': return at(hw * 0.6, w - 22, 'none', 0, 1, { back: true });
      case 'telephone': return at(R * 0.28, sh + 26, 'phone', 180, -1);
      case 'selfie': return at(o + 116, hy - R * 0.55, 'phone', 180);
      // filmer à une main : le téléphone à côté du visage (qui reste visible)
      case 'filme': { const hs = sp.hand, pcx = R * 1.34, pcy = hy + R * 0.3; return at(pcx + 2 * hs, pcy + 20 * hs, 'filme', 180, 'low'); }
      // filmer à deux mains : un seul téléphone devant le torse, tenu par la gauche, la droite serre le bord
      case 'filme2_tel': { const hs = sp.hand, pcx = -R * 0.08, pcy = sh + R * 0.95; return at(-(pcx - 2 * hs), pcy + 20 * hs, 'filme', 180, 'low'); }
      case 'filme2_main': { const hs = sp.hand, pcx = -R * 0.08, pcy = sh + R * 0.95; return at(pcx + 36 * hs + 22 * hs, pcy - 2 * hs, 'fist', 90, 'low'); }
      case 'pouce': return at(o * 0.95, sh + 40, 'thumb', 90, -1);
      case 'pouce_bas': return at(o * 0.95, sh + 96, 'thumb', -90, -1);
      case 'v': return at(o + 40, hy + R * 0.22, 'peace', 180, -1);
      case 'poing': return at(o + 30, sh - 24, 'fist', 172, -1);
      case 'muscle': return at(o + 64, sh - 40, 'fist', 200, -1);
      case 'priere': return at(1, sh + R * 0.86, 'priere', 180, 'low');
      case 'supplie': return at(1, hy + R * 1.5, 'priere', 180, 'low');
      case 'joint_bas': return at(-6, w - 64, 'fist', 90, 1);
      case 'applaudit': return at(14, sh + 70, 'open', side < 0 ? 130 : 130, -1);
      case 'frotte': return at(10, sh + 88, 'fist', 90, -1);
      case 'tient': return at(R * 0.36, sh + 92, 'fist', 90, 1);
      case 'compte': return at(o * 0.5, sh + 40, 'peace', 180, -1);
      case 'menace': return at(o * 0.6, sh + 30, 'point', 175, -1);
      case 'bras_tete': return at(R * 0.4, hy - R * 1.0, 'fist', 160, -1);
      case 'eventail': return at(R * 0.9, hy + R * 0.6, 'open', 150, -1);
      default: return [12, -16, 'relax'];
    }
  }

  // [gauche, droite, attitude]
  const LIST = {
    // --- repos / attitudes
    repos: ['bas', 'bas', {}],
    repos_ouvert: ['ouvert', 'ouvert', { expr: 'content' }],
    ballant: ['ballant', 'ballant', { shrug: -0.3, nod: 0.4, expr: 'blase' }],
    mains_poches: ['poche', 'poche', { tilt: -4, expr: 'neutre' }],
    poche_cool: ['poche', 'bas', { lean: -3, sway: 8, tilt: -6, expr: 'fier' }],
    mains_dos: ['dos', 'dos', { tilt: 4, expr: 'timide' }],
    mains_dos_innocent: ['dos', 'dos', { tilt: -8, turn: 0.2, expr: 'clin' }],
    poings_serres: ['poing_bas', 'poing_bas', { shrug: 0.3, expr: 'enerve' }],
    bras_croises: ['croise_bas', 'croise_haut', { tilt: -4, expr: 'vexe' }],
    bras_croises_fier: ['croise_bas', 'croise_haut', { lean: -5, tilt: -8, expr: 'hautain' }],
    bras_croises_boude: ['croise_bas', 'croise_haut', { turn: -0.35, tilt: 6, expr: 'boude' }],
    fier: ['hanche', 'hanche', { lean: -4, tilt: -6, expr: 'fier' }],
    hanche_g: ['hanche', 'bas', { sway: 10, tilt: 6, expr: 'mefiant' }],
    hanche_d: ['bas', 'hanche', { sway: -10, tilt: -6, expr: 'mefiant' }],
    super_heros: ['hanche', 'hanche', { lean: -6, jump: 0, expr: 'determine', exprOver: { sparkle: 0 } }],
    // --- salutations
    salut_d: ['bas', 'salut', { tilt: -6, lean: -3, expr: 'joie' }],
    salut_g: ['salut', 'bas', { tilt: 6, lean: 3, expr: 'joie' }],
    coucou_d: ['bas', 'coucou', { tilt: -4, expr: 'content' }],
    coucou_g: ['coucou', 'bas', { tilt: 4, expr: 'content' }],
    salut_deux_mains: ['haut_large', 'haut_large', { jump: 10, expr: 'excite' }],
    au_revoir: ['bas', 'coucou', { tilt: 8, expr: 'triste' }],
    bisou_vole: ['bas', 'bouche', { tilt: -6, expr: 'bisou' }],
    clin_pouce: ['bas', 'pouce', { tilt: -8, turn: 0.2, expr: 'clin' }],
    pouce_d: ['bas', 'pouce', { tilt: -8, turn: 0.2, expr: 'ok' }],
    pouce_g: ['pouce', 'bas', { tilt: 8, turn: -0.2, expr: 'ok' }],
    deux_pouces: ['pouce', 'pouce', { expr: 'joie' }],
    pouce_bas: ['bas', 'pouce_bas', { tilt: 8, expr: 'degoute' }],
    v_victoire: ['bas', 'v', { tilt: -8, expr: 'clin' }],
    // --- joie / victoire
    victoire: ['haut_poing', 'haut_poing', { jump: 50, lift: [16, 16], squash: -0.05, tilt: 4, expr: 'joie' }],
    victoire_sol: ['haut_poing', 'haut_poing', { tilt: 4, expr: 'excite' }],
    poing_leve_d: ['bas', 'poing', { tilt: -6, expr: 'determine' }],
    poing_leve_g: ['poing', 'bas', { tilt: 6, expr: 'determine' }],
    muscle: ['hanche', 'muscle', { lean: -3, tilt: -6, expr: 'fier' }],
    double_muscle: ['muscle', 'muscle', { shrug: 0.4, expr: 'excite' }],
    danse_1: ['haut', 'hanche', { sway: 16, tilt: 10, lean: 6, lift: [0, 20], expr: 'ravi' }],
    danse_2: ['hanche', 'haut', { sway: -16, tilt: -10, lean: -6, lift: [20, 0], expr: 'ravi' }],
    danse_3: ['pointe_haut', 'pointe_bas', { sway: 12, lean: 8, tilt: 10, expr: 'excite' }],
    applaudit: ['applaudit', 'applaudit', { expr: 'joie' }],
    saute_joie: ['haut_large', 'haut_large', { jump: 70, lift: [30, 30], squash: -0.07, expr: 'excite' }],
    yes: ['poing_bas', 'poing', { crouch: 0.2, tilt: -8, expr: 'excite' }],
    // --- montrer
    pointe_d: ['bas', 'pointe', { lean: -2, tilt: -4, expr: 'surpris' }],
    pointe_g: ['pointe', 'bas', { lean: 2, tilt: 4, expr: 'surpris' }],
    se_moque_d: ['ventre', 'pointe', { lean: -8, tilt: -8, turn: 0.3, expr: 'rire' }],
    se_moque_g: ['pointe', 'ventre', { lean: 8, tilt: 8, turn: -0.3, expr: 'rire' }],
    pointe_haut: ['bas', 'pointe_haut', { tilt: -10, nod: -0.5, expr: 'surpris' }],
    pointe_bas: ['bas', 'pointe_bas', { tilt: 6, nod: 0.5, expr: 'degoute' }],
    moi: ['bas', 'pointe_soi', { tilt: 8, expr: 'surpris' }],
    moi_fier: ['hanche', 'pointe_soi', { lean: -4, tilt: -8, expr: 'fier' }],
    toi: ['bas', 'pointe_avant', { lean: 4, expr: 'determine' }],
    menace: ['hanche', 'menace', { lean: 6, expr: 'enerve' }],
    regarde: ['bas', 'tendu', { turn: 0.5, tilt: -4, expr: 'emerveille' }],
    presente: ['tendu', 'bas', { turn: -0.5, tilt: 4, expr: 'content' }],
    ta_da: ['tendu', 'tendu', { jump: 20, expr: 'excite' }],
    // --- réfléchir / douter
    reflechit: ['croise_bas', 'menton', { tilt: 8, turn: -0.2, expr: 'pense' }],
    reflechit_haut: ['bas', 'menton', { tilt: -8, nod: -0.6, expr: 'pense' }],
    je_sais_pas: ['paume', 'paume', { shrug: 1, tilt: 8, expr: 'pense' }],
    bof: ['paume', 'bas', { shrug: 0.6, tilt: -8, expr: 'blase' }],
    hum: ['bas', 'menton', { tilt: 10, lx: 0, expr: 'mefiant' }],
    idee: ['bas', 'pointe_haut', { jump: 12, tilt: -6, expr: 'excite' }],
    gratte_tete: ['bas', 'nuque', { tilt: 10, expr: 'gene' }],
    gratte_tete_g: ['nuque', 'bas', { tilt: -10, expr: 'genesourire' }],
    ecoute: ['bas', 'oreille', { tilt: 14, turn: 0.3, expr: 'concentre' }],
    chut: ['bas', 'bouche', { tilt: -4, expr: 'mefiant' }],
    // --- surprise / peur
    horreur: ['joue', 'joue', { shrug: 0.6, expr: 'choque' }],
    oh_non: ['tete', 'tete', { shrug: 0.8, crouch: 0.15, expr: 'panique' }],
    panique: ['tete', 'tete', { shrug: 0.8, crouch: 0.15, tilt: 6, expr: 'terrifie' }],
    main_bouche: ['bas', 'bouche', { shrug: 0.4, expr: 'surpris' }],
    deux_mains_bouche: ['bouche', 'bouche', { shrug: 0.5, expr: 'surpris' }],
    sursaut: ['haut_large', 'haut_large', { jump: 40, squash: -0.08, expr: 'terrifie' }],
    recule: ['stop', 'stop', { lean: -10, expr: 'peur' }],
    stop: ['bas', 'stop', { lean: 4, expr: 'determine' }],
    stop_deux: ['stop', 'stop', { lean: 6, expr: 'crie' }],
    cache_yeux: ['oeil', 'oeil', { nod: 0.4, expr: 'peur' }],
    // --- tristesse / fatigue
    triste: ['ballant', 'ballant', { shrug: -0.4, nod: 1, tilt: 8, lean: 5, expr: 'triste' }],
    pleure: ['oeil', 'oeil', { shrug: 0.5, nod: 0.5, expr: 'pleure' }],
    sanglote: ['oeil', 'ballant', { shrug: 0.4, nod: 0.6, tilt: 10, expr: 'sanglote' }],
    desespoir: ['front', 'ballant', { lean: -6, tilt: -12, nod: -0.5, expr: 'triste' }],
    facepalm: ['bas', 'facepalm', { tilt: 10, nod: 0.6, lean: 4, expr: 'blase' }],
    facepalm_g: ['facepalm', 'bas', { tilt: -10, nod: 0.6, lean: -4, expr: 'blase' }],
    epuise: ['ballant', 'ballant', { crouch: 0.2, shrug: -0.5, nod: 0.8, lean: 8, expr: 'fatigue' }],
    baille: ['bas', 'bouche', { lean: -4, tilt: -6, expr: 'baille' }],
    etire: ['haut', 'haut', { lean: -4, tilt: -6, expr: 'baille' }],
    malade: ['ventre', 'ventre', { crouch: 0.15, nod: 0.5, expr: 'malade' }],
    // --- colère / gêne
    colere: ['poing_bas', 'poing_bas', { shrug: 0.5, lean: 6, expr: 'rouge' }],
    furieux: ['poing', 'poing', { shrug: 0.6, crouch: 0.1, expr: 'furieux' }],
    trepigne: ['poing_bas', 'poing_bas', { lift: [30, 0], shrug: 0.5, expr: 'crie' }],
    boude: ['croise_bas', 'croise_haut', { turn: -0.5, tilt: 8, nod: 0.3, expr: 'boude' }],
    gene: ['dos', 'nuque', { tilt: 10, nod: 0.3, expr: 'honte' }],
    timide: ['joint_bas', 'joint_bas', { nod: 0.5, tilt: 6, turn: 0.15, expr: 'timide' }],
    honte: ['oeil', 'oeil', { crouch: 0.1, nod: 0.6, expr: 'honte' }],
    jaloux: ['croise_bas', 'croise_haut', { turn: 0.4, tilt: -6, expr: 'jaloux' }],
    // --- divers
    telephone: ['bas', 'telephone', { nod: 0.6, tilt: 6, expr: 'concentre' }],
    telephone_rire: ['ventre', 'telephone', { nod: 0.3, expr: 'pouffe' }],
    selfie: ['hanche', 'selfie', { tilt: -10, turn: 0.25, expr: 'clin' }],
    selfie_bisou: ['bas', 'selfie', { tilt: -12, turn: 0.3, expr: 'bisou' }],
    filme: ['bas', 'filme', { tilt: 6, expr: 'concentre', exprOver: { lx: 0.9, ly: -0.1, ms: '' } }],
    filme_deux_mains: ['filme2_tel', 'filme2_main', { nod: 0.35, expr: 'excite', exprOver: { ly: 0.75, lx: 0 } }],
    priere: ['priere', 'priere', { nod: -0.3, tilt: -6, expr: 'touche', exprOver: { closed: 1 } }],
    supplie: ['supplie', 'supplie', { crouch: 0.12, nod: -0.5, tilt: 10, shrug: 0.3, expr: 'supplie' }],
    complote: ['frotte', 'frotte', { lean: 6, nod: 0.3, expr: 'malin' }],
    coeur: ['coeur', 'coeur', { tilt: -8, expr: 'amoureux' }],
    eventail: ['bas', 'eventail', { tilt: -6, expr: 'gene' }],
    compte: ['bas', 'compte', { tilt: -6, expr: 'pense' }],
    court: [{ at: [-30, -370], hand: 'fist', bend: 1, handAbs: 150 }, { at: [120, -210], hand: 'fist', bend: -1 }, { lift: [80, 0], jump: 16, lean: 4, sway: -8, tilt: -4, expr: 'determine' }],
    marche: ['bas', 'bas', { lift: [26, 0], sway: 6, expr: 'content' }],
    garde_a_vous: ['ballant', 'ballant', { lean: -2, expr: 'determine' }],
  };

  // un geste prêt à fusionner dans les options d'un personnage
  function geste(name, body = 'enfant') {
    const sp = Object.assign({}, K.BODY[body] || K.BODY.enfant);
    const g = LIST[name] || LIST.repos;
    const arm = (p, sd) => typeof p === 'string' ? place(p, sd, sp) : (Array.isArray(p) ? p : Object.assign({}, p, { at: [p.at[0] * sp.shO / 82, p.at[1] * sp.shY / -430] }));
    return Object.assign({ arms: { l: arm(g[0], -1), r: arm(g[1], 1) } }, g[2]);
  }
  root.EtSi2.geste = geste;
  root.EtSi2.GESTES = Object.keys(LIST);
  root.EtSi2.place = place;
})(typeof window !== 'undefined' ? window : globalThis);
