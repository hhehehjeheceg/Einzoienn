  // ------------------------------------------------------------------ minutage (temps film, cf. cues.js)
  const T = {
    remonter: 1.82, dix: 2.66, juste: 3.66,
    premier: 4.75, rates: 5.66, marche: 6.06, rw1: 6.83, evites: 7.66, facile: 8.46,
    controle: 9.8, correction: 10.92, rw2: 12.04, ecris: 13.08, reponses: 13.96, vingt20: 14.76,
    skate: 17.14, tombes1: 18.14, rw3a: 18.82, tombes2: 19.82, rw3b: 20.5, rw3c: 21.38, vingt: 23.3, parfait: 24.54,
    mais: 25.85, filme: 26.36, rater: 27.0, rembob: 27.88, vois: 29.4, appuyer: 29.88, bouton: 31.16,
    meme: 32.24, chaque: 33.22, efface: 34.63,
    assume: 35.72, jamais1: 36.36, excuse: 37.56, jamais2: 38.2, grandit: 39.24, jamais3: 39.72,
    alors: 41.03, lache: 41.96, tombes: 43.12, trompes: 43.92, recommence: 44.64, ris: 45.84, parce: 46.46, vrai: 48.0,
    ettoi: 49.28, effacerais: 50.08, disle: 50.8, abonne: 51.84, like: 52.48, etsi: 53.52,
  };
  const blinkAt = (t, seed) => {
    const per = 3.1 + hash(seed) * 1.7, ph = (t + hash(seed + 5) * per) % per;
    return ph < 0.13 ? Math.sin(ph / 0.13 * Math.PI) : 0;
  };
  /*HELPERS*/
  const TALK = [];
  function talk(t) {
    for (const [a, b] of TALK) if (t >= a && t <= b) return Math.sin(t * 22) > 0 ? 'A' : 'M';
    return null;
  }

  // ------------------------------------------------------------------ rembobinage
  // segs : [t0, t1, tau0, tau1, prise, rembobinage?]. Pendant un rembobinage, la scène est
  // réellement rejouée à l'envers (tau décroît), avec l'habillage VHS.
  function remap(t, segs) {
    for (const s of segs) if (t >= s[0] && t < s[1]) {
      const k = (t - s[0]) / (s[1] - s[0]);
      return { tau: lerp(s[2], s[3], s[5] ? Ez.io(k) : k), take: s[4], rw: s[5] ? Math.sin(Math.PI * Math.min(1, k * 1.3)) : 0 };
    }
    const L = segs[segs.length - 1];
    return { tau: L[3] + (t - L[1]), take: L[4], rw: 0 };
  }
  function vhs(t, k, label, counter) {
    if (k <= 0.01) return '';
    let s = `<rect width="${W}" height="${H}" fill="url(#scan)" opacity="${r1(0.5 * k * 100) / 100}"/>`;
    s += `<rect width="${W}" height="${H}" fill="#2B3A8C" opacity="${r1(0.16 * k * 100) / 100}" style="mix-blend-mode:screen"/>`;
    const r = rng(Math.floor(t * 30) + 3);
    for (let i = 0; i < 4; i++) {
      const y = r() * H, h = 14 + r() * 70;
      s += `<rect x="0" y="${r1(y)}" width="${W}" height="${r1(h)}" fill="#FFFFFF" opacity="${r1((0.08 + r() * 0.22) * k * 100) / 100}"/>`;
      for (let j = 0; j < 30; j++) s += `<rect x="${r1(r() * W)}" y="${r1(y + r() * h)}" width="${r1(6 + r() * 30)}" height="3" fill="${r() > 0.5 ? '#FFFFFF' : '#111'}" opacity="${r1(0.6 * k * 100) / 100}"/>`;
    }
    const yb = ((t * 1100) % 2300) - 180;
    s += `<rect x="0" y="${r1(yb)}" width="${W}" height="110" fill="#FFFFFF" opacity="${r1(0.1 * k * 100) / 100}"/>`;
    const blink = Math.floor(t * 5) % 2 ? 1 : 0.55;
    s += txt(70, 190, label || '◀◀ REMBOBINE', 74, '#FFFFFF', { anchor: 'start', font: 'Anton', weight: 400, op: r1(k * blink * 100) / 100, stroke: '#000', sw: 8 });
    if (counter) s += txt(W - 70, 190, counter, 60, '#FFFFFF', { anchor: 'end', font: 'Anton', weight: 400, op: r1(k * 100) / 100, stroke: '#000', sw: 8 });
    return s;
  }
  const tcode = tau => { const s = Math.max(0, tau); return `00:00:${String(Math.floor(s)).padStart(2, '0')}:${String(Math.floor((s % 1) * 30)).padStart(2, '0')}`; };
  // marche de face : pieds qui se lèvent, bras qui balancent en opposition, rebond
  function walkPose(t, sp = 7.5, amp = 22) {
    const p = Math.sin(t * sp);
    return { lift: [Math.max(0, p) * amp, Math.max(0, -p) * amp], bob: -Math.abs(Math.cos(t * sp)) * 9, swing: p * 14 };
  }
  const shadow = (x, y, w, h = 0) => `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(w * (1 - Math.min(0.5, h / 500)))}" ry="${r1(w * 0.14)}" fill="#000" opacity="${r1(0.16 * (1 - Math.min(0.6, h / 400)) * 100) / 100}"/>`;
  // étoiles qui tournent autour de la tête (sonné)
  function dizzy(x, y, t, k) {
    if (k <= 0.01) return '';
    let s = '';
    for (let i = 0; i < 4; i++) { const a = t * 6 + i * Math.PI / 2; s += `<path d="${STAR(20)}" fill="#FFE27A" stroke="${INK}" stroke-width="3" transform="translate(${r1(x + Math.cos(a) * 110)} ${r1(y + Math.sin(a) * 30)}) scale(${r1(k * 100) / 100})"/>`; }
    return s;
  }

  // ================================================================== SCÈNES

  // ---- 1. Accroche : la télécommande du temps
  function sHook(t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#1E2A5A"/>` + rays(540, 820, 24, 2400, -t * 0.6, '#24336B');
    // horloge géante qui tourne à l'envers
    const back = t * 2.4;
    w += `<circle cx="540" cy="760" r="330" fill="#FFF8E8" stroke="${INK}" stroke-width="14"/>`;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; w += `<path d="M${r1(540 + Math.sin(a) * 290)} ${r1(760 - Math.cos(a) * 290)}L${r1(540 + Math.sin(a) * 260)} ${r1(760 - Math.cos(a) * 260)}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`; }
    w += `<path d="M540 760L${r1(540 + Math.sin(-back) * 230)} ${r1(760 - Math.cos(-back) * 230)}" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>`;
    w += `<path d="M540 760L${r1(540 + Math.sin(-back * 6) * 270)} ${r1(760 - Math.cos(-back * 6) * 270)}" stroke="#E5483D" stroke-width="7" stroke-linecap="round"/><circle cx="540" cy="760" r="18" fill="${INK}"/>`;
    // flèches de rembobinage autour
    for (let i = 0; i < 3; i++) { const a = -t * 1.5 + i * 2.1; w += `<path d="M${r1(540 + Math.cos(a) * 400)} ${r1(760 + Math.sin(a) * 400)}l-30 -18l0 36z" fill="#F6B53D" stroke="${INK}" stroke-width="5" transform="rotate(${r1(a * 57.3 - 90)} ${r1(540 + Math.cos(a) * 400)} ${r1(760 + Math.sin(a) * 400)})"/>`; }
    // compte à rebours 10 -> 0
    const n = Math.max(0, 10 - Math.floor(clamp((t - T.dix) / 1.5) * 10));
    if (t > T.dix - 0.1) w += txt(540, 840, String(n), 230, '#E5483D', { font: 'Anton', weight: 400, stroke: INK, sw: 12, op: clamp((t - T.dix + 0.1) * 5) });
    // Léo, télécommande levée
    const lp = alive(blend(t, [[0, { arms: { l: [10, 10, 'relax'], r: [20, 20, 'remote'] } }], [T.remonter, { arms: { l: [10, 10, 'relax'], r: [120, 40, 'remote'] } }]]), t, 1);
    w += shadow(540, 1800, 160);
    w += R.leo({ x: 540, y: 1800, scale: 1.25, expr: t > T.juste ? 'determine' : 'surpris', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 1), look: [0.3, -0.5] });
    let ui = '';
    const exit = Ez.in(inv(4.05, 4.4, t));
    if (exit < 1) ui += grp(springWord(540, 300, 'ET SI…', 210, t, 0.08, { fill: '#F6B53D', sw: 16, ls: 6 }), `translate(0 ${r1(-exit * 600)})`);
    const vk = 0.5 + 0.5 * Math.sin(t * 3);
    ui += vhs(t, 0.45 * vk * (1 - exit), '◀◀', tcode(10 - t * 2.5));
    return { w, ui, cam: { z: 1 + 0.06 * Ez.io(inv(0, 4.4, t)) + 0.05 * punch(t, T.dix, 6), fx: 540, fy: 960, rot: Math.sin(t * 1.2) * 1.2 }, rgb: 4 + 6 * vk, cap: true };
  }

  // ---- 2. L'escalier : chute, rembobinage, esquive
  const STAIRS_SEG = [[4.4, T.rw1, 4.4, T.rw1, 1, 0], [T.rw1, 7.35, T.rw1, 5.25, 1, 1], [7.35, 9.5, 5.25, 7.4, 2, 0]];
  function stairsAt(tau, take, t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#EADCF4"/>`;
    // marches vues de face (de plus en plus grandes vers le bas)
    for (let i = 0; i < 9; i++) {
      const y = 560 + i * i * 13 + i * 70, h = 26 + i * 8;
      w += `<rect x="-200" y="${y}" width="1480" height="${h}" fill="${i % 2 ? '#C7B6DD' : '#D6C7E8'}" stroke="${INK}" stroke-width="4"/>`;
    }
    w += path('M60 300V1700', 'none', 10) + path('M1020 300V1700', 'none', 10);
    w += `<rect x="-200" y="1640" width="1480" height="900" fill="#B9A4D2" stroke="${INK}" stroke-width="5"/>`;
    // Léo descend (il grandit en approchant)
    const d = clamp((tau - 4.4) / 1.7);
    let y = lerp(1060, 1700, d), sc = lerp(0.72, 1.12, d), lean = 0, sq = 0, expr = 'content', arms = null, jump = 0, rot = 0;
    const wk = walkPose(tau, 8.5, 18);
    arms = { l: [10 - wk.swing, 12, 'relax'], r: [10 + wk.swing, 12, 'relax'] };
    let lift = wk.lift, bob = wk.bob;
    if (take === 1 && tau > T.marche) {             // il rate la marche
      const k = clamp((tau - T.marche) / 0.35);
      rot = Ez.in(k) * 78; y += Ez.in(k) * 60; expr = 'panique';
      arms = { l: [150, 30, 'open'], r: [150, 30, 'open'] }; lift = [30, 0]; bob = 0;
      if (k >= 1) sq = 0.12 * decay(tau, T.marche + 0.35, 10);
    }
    if (take === 2 && tau > 5.8) {                   // il saute par-dessus
      const k = clamp((tau - 5.8) / 0.55);
      jump = Math.sin(Math.PI * k) * 220; expr = 'determine';
      sq = k < 0.12 ? 0.1 * (1 - k / 0.12) : (k > 0.95 ? 0.1 : -0.06 * Math.sin(Math.PI * k));
      arms = { l: [60, 50, 'fist'], r: [60, 50, 'fist'] };
      if (k >= 1) { arms = { l: [10, 10, 'relax'], r: arm(LA(1, 120, -560, 1), 'point') }; sq = 0.1 * decay(tau, 6.35, 9); lift = [0, 0]; bob = 0; }
      if (tau > T.facile - 0.3) expr = 'content';
    }
    w += shadow(540, Math.min(1720, y + 10), 150 * sc, jump);
    w += `<g transform="rotate(${r1(rot)} 540 ${r1(y)})">` + R.leo({ x: 540, y: y - jump, scale: sc, expr, arms, lift, bob, squash: sq, blink: blinkAt(tau, 2), tilt: rot > 10 ? 0 : Math.sin(tau * 3) * 2 }) + '</g>';
    if (take === 1 && tau > T.marche + 0.35) w += dizzy(560, 1520, t, spring(tau, T.marche + 0.35, 2.5, 0.5));
    if (take === 2 && tau > T.facile - 0.1) w += sparkles(660, 1000, tau, T.facile - 0.1, 14, 300, 5);
    return w;
  }
  function sStairs(t) {
    const m = remap(t, STAIRS_SEG);
    const w = stairsAt(m.tau, m.take, t);
    let ui = vhs(t, m.rw, '◀◀ REMBOBINE', tcode(m.tau - 4.4));
    if (m.take === 2 && t > T.facile - 0.2) ui += stamp(540, 520, 'TROP FACILE', '#2FA56A', t, T.facile - 0.1, -8);
    const cam = cam2([[4.4, 1.0, 540, 1100], [T.marche - 0.2, 1.15, 540, 1300, 0.3], [T.rw1, 1.0, 540, 1100, 0.4]], t);
    cam.shake = 26 * decay(t, T.marche + 0.25, 6) * (m.take === 1 ? 1 : 0) + m.rw * 10;
    return { w, ui, cam, rgb: m.rw * 22, glitch: m.rw * 0.8, cap: true };
  }

  // ---- 3. Le contrôle : la correction, rembobinage, 20/20
  const TEST_SEG = [[9.4, T.rw2, 9.4, T.rw2, 1, 0], [T.rw2, 12.5, T.rw2, 9.7, 1, 1], [12.5, 15.7, 12.6, 15.8, 2, 0]];
  function testAt(tau, take, t) {
    let w = classroomBg(t);
    // tableau : la correction apparaît (première prise), effacée après le rembobinage
    w += `<rect x="-400" y="320" width="680" height="420" fill="#2F5D4A"/>`;
    const corr = take === 1 ? clamp((tau - T.correction + 0.2) / 0.5) : 0;
    w += txt(-60, 420, 'CONTRÔLE', 64, '#F7F3E8', { font: 'Caveat', weight: 700 });
    if (corr > 0) ['1) B', '2) C', '3) A', '4) 42'].forEach((a, i) => { w += txt(-200 + (i % 2) * 280, 540 + Math.floor(i / 2) * 110, a, 72, '#FFE27A', { font: 'Caveat', weight: 700, op: clamp(corr * 4 - i) }); });
    if (corr > 0) w += txt(-60, 720, 'CORRECTION', 44, '#FF8A8A', { font: 'Anton', weight: 400, op: corr });
    STUDENTS.forEach((st, i) => { if (st.row === 0) w += R.passant(Object.assign({}, st, { scale: st.s, expr: 'blase', tilt: 8, bob: Math.sin(t * 2 + i) * 3 })); });
    w += desk(520, 1150, 300, 170) + desk(800, 1150, 300, 170) + desk(1080, 1150, 300, 170) + desk(230, 1150, 320, 170);
    // Léo
    const writing = take === 2 && tau > T.ecris - 0.1 && tau < T.vingt20;
    let ex = 'fatigue', arms = { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, look = [0, 0.6], acc = [];
    if (take === 1 && tau > T.correction - 0.1) { ex = 'surpris'; look = [-0.9, -0.5]; }
    if (take === 2) { ex = 'determine'; look = [0, 0.7]; }
    if (writing) arms = { l: [10, 10, 'relax'], r: arm(LA(1, 60 + Math.sin(t * 40) * 26, -250 + Math.cos(t * 33) * 10, 1), 'fist') };
    if (take === 2 && tau > T.vingt20) { ex = 'content'; look = [0, 0]; acc = ['lunettesNoires']; arms = { l: [10, 10, 'relax'], r: [150, 20, 'open'] }; }
    const lp = alive({ arms, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += R.leo({ x: 520, y: 1760, scale: 1.12, expr: ex, look, acc, arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 3) });
    if (take === 1 && tau > 10.3 && tau < T.correction) for (let i = 0; i < 3; i++) { const ph = ((t - 10.3) * 0.8 + i / 3) % 1; w += path(`M${r1(420 + i * 100)} ${r1(1100 + ph * 120)}q10 16 0 24q-10 -8 0 -24z`, '#9FD8F5', 3.5); }
    // table + copie
    w += desk(520, 1500, 380, 260) + desk(180, 1500, 330, 260) + desk(880, 1500, 330, 260);
    w += grp(path('M-120 -16H120L110 40H-110Z', '#FFFFFF', 4) + `<path d="M-90 -4H90M-92 10H92M-94 24H94" stroke="#B8C4D6" stroke-width="3"/>`, 'translate(520 1490)');
    const answers = take === 2 ? clamp((tau - T.ecris) / 0.9) : 0;
    if (take === 1) w += txt(520, 1508, '? ? ? ?', 30, '#E5483D', { font: 'Anton', weight: 400 });
    ['B', 'C', 'A', '42'].forEach((a, i) => { if (answers * 4 > i) w += txt(450 + i * 46, 1510, a, 30, '#2F5DB4', { font: 'Caveat', weight: 700 }); });
    if (writing) w += `<circle cx="${r1(520 + Math.sin(t * 40) * 40)}" cy="1490" r="40" fill="#FFE27A" opacity=".35"/>` + sparkles(520, 1480, t, Math.floor(t * 4) / 4, 4, 80, Math.floor(t * 4));
    return w;
  }
  function sTest(t) {
    const m = remap(t, TEST_SEG);
    const w = testAt(m.tau, m.take, t);
    let ui = vhs(t, m.rw, '◀◀ REMBOBINE', tcode(m.tau - 9.4));
    if (m.take === 2) ui += stamp(540, 470, '20 / 20', '#E5483D', t, T.vingt20, -10) + sparkles(540, 470, t, T.vingt20, 20, 440, 6);
    const cam = cam2([[9.4, 1.0, 420, 1180], [T.correction - 0.3, 1.5, 120, 620, 0.4], [T.rw2, 1.0, 420, 1180, 0.4], [T.ecris - 0.2, 1.7, 520, 1380, 0.35], [T.vingt20, 1.15, 520, 1100, 0.35]], t);
    cam.z *= 1 + 0.05 * punch(t, T.vingt20, 6);
    cam.shake = m.rw * 10 + (t > T.ecris && t < T.vingt20 ? 3 : 0);
    return { w, ui, cam, rgb: m.rw * 22, glitch: m.rw * 0.8, cap: true };
  }

  // ---- 4. Le skatepark : 20 essais
  function skatepark(t, scroll = 0) {
    let w = `<defs><linearGradient id="skysk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ED0F0"/><stop offset="1" stop-color="#FFE9C9"/></linearGradient></defs>`;
    w += `<rect x="-800" y="-600" width="2700" height="3200" fill="url(#skysk)"/>`;
    // mur à graffitis
    w += path('M-800 700H1900V1450H-800Z', '#D7D2CB', 5);
    const g = [['#E5483D', 'ET SI'], ['#4FA3CF', 'SK8'], ['#7BD389', '◀◀'], ['#F6B53D', 'OUPS']];
    g.forEach(([c, l], i) => { const x = ((-300 + i * 520 - scroll * 0.6) % 2200 + 2200) % 2200 - 700; w += txt(x, 1100, l, 170, c, { font: 'Anton', weight: 400, stroke: INK, sw: 10, rot: -6 + i * 4, op: 0.9 }); });
    // rampe
    w += path('M760 1460Q1060 1460 1080 1160V1460Z', '#B9B2A8', 5) + path('M1080 1160H1300V1460H1080Z', '#A49C91', 5);
    w += `<rect x="-800" y="1460" width="2700" height="1300" fill="#C9C4BC" stroke="${INK}" stroke-width="5"/>`;
    const off = ((scroll) % 220 + 220) % 220;
    for (let x = -800 - off; x < 1900; x += 220) w += `<path d="M${r1(x)} 1460L${r1(x - 90)} 1900" stroke="${INK}" stroke-width="3" opacity=".25"/>`;
    return w;
  }
  function board(x, y, flip, rot, sc = 1) {
    const k = Math.cos(flip);
    return grp(grp(path('M-110 -10H110Q130 -10 130 0Q130 10 110 10H-110Q-130 10 -130 0Q-130 -10 -110 -10Z', k > 0 ? '#E5483D' : '#2A2D38', 5) +
      `<circle cx="-80" cy="22" r="13" fill="#FFF6E6" stroke="${INK}" stroke-width="4"/><circle cx="80" cy="22" r="13" fill="#FFF6E6" stroke="${INK}" stroke-width="4"/>`,
      `scale(1 ${r1(Math.max(0.15, Math.abs(k)) * (k >= 0 ? 1 : -1) * 100) / 100})`), `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(${sc})`);
  }
  const SKATE_SEG = [[15.6, T.rw3a, 15.6, T.rw3a, 1, 0], [T.rw3a, 19.15, T.rw3a, 17.2, 1, 1], [19.15, T.rw3b, 17.2, 17.2 + T.rw3b - 19.15, 2, 0],
    [T.rw3b, 20.85, 17.2 + T.rw3b - 19.15, 17.2, 2, 1], [20.85, T.rw3c, 17.2, 17.2 + T.rw3c - 20.85, 3, 0], [T.rw3c, 23.0, 17.2 + T.rw3c - 20.85, 17.2, 3, 1], [23.0, 25.7, 17.2, 19.9, 20, 0]];
  function skateAt(tau, take, t) {
    let w = skatepark(t, tau * 260);
    const G = 1640;
    let jumpT = take === 1 ? 17.65 : take === 2 ? 17.45 : take === 3 ? 17.4 : 17.75;
    const k = clamp((tau - jumpT) / 0.6), air = tau > jumpT && k < 1;
    let jump = air ? Math.sin(Math.PI * k) * 260 : 0, flip = 0, ex = 'determine', rot = 0, bx = 540, by = G - 30, brot = 0;
    let arms = { l: [40, 30, 'open'], r: [40, 30, 'open'] }, sq = 0, crash = false;
    if (tau > jumpT) {
      if (take === 20) { flip = k * Math.PI * 2; ex = k < 1 ? 'surpris' : 'content'; arms = k < 1 ? { l: [100, 20, 'open'], r: [100, 20, 'open'] } : { l: [150, 30, 'open'], r: [150, 30, 'open'] }; if (k >= 1) sq = 0.1 * decay(tau, jumpT + 0.6, 9); }
      else {
        flip = k * Math.PI * (take === 2 ? 1.3 : 0.8); ex = 'panique'; arms = { l: [150, 40, 'open'], r: [150, 40, 'open'] };
        if (k > 0.55) { crash = true; const c = clamp((k - 0.55) / 0.45); rot = (take === 2 ? -1 : 1) * Ez.in(c) * 85; jump = Math.max(0, jump); }
        if (k >= 1) { rot = (take === 2 ? -1 : 1) * 85; jump = 0; }
        bx = 540 + (take === 2 ? -1 : 1) * Ez.out(clamp((tau - jumpT - 0.3) / 0.6)) * 380; brot = (take === 2 ? -1 : 1) * clamp((tau - jumpT - 0.3) / 0.6) * 240;
      }
    }
    by = G - 30 - (crash ? Math.max(0, jump * 0.6) : jump);
    w += shadow(540, G + 10, 170, jump);
    w += board(bx, by, flip, brot);
    w += `<g transform="rotate(${r1(rot)} 540 ${G})">` + R.leo({ x: 540, y: G - 45 - jump, scale: 1.1, expr: ex, arms, squash: sq, lean: crash ? 0 : Math.sin(tau * 4) * 3, blink: blinkAt(t, 4), tilt: Math.sin(tau * 3) * 2 }) + '</g>';
    if (crash && tau > jumpT + 0.6) w += dizzy(560 + (take === 2 ? -1 : 1) * 260, G - 140, t, spring(tau, jumpT + 0.6, 2.5, 0.5));
    // traits de vitesse au sol
    if (!crash) for (let i = 0; i < 6; i++) { const y = G - 60 - i * 70, x = ((i * 300 - tau * 900) % 1400 + 1400) % 1400 - 200; w += `<path d="M${r1(x)} ${y}H${r1(x + 140)}" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity=".6"/>`; }
    if (take === 20 && tau > jumpT + 0.6) w += sparkles(540, G - 400, tau, jumpT + 0.6, 22, 520, 7) + confetti(540, G - 500, tau, jumpT + 0.6, 60, 8);
    return w;
  }
  function sSkate(t) {
    const m = remap(t, SKATE_SEG);
    const w = skateAt(m.tau, m.take, t);
    const heavy = m.take === 3 && m.rw > 0;
    const n = heavy ? Math.min(19, 3 + Math.floor(clamp((t - T.rw3c) / 1.4) * 16)) : m.take;
    let ui = vhs(t, m.rw, '◀◀ REMBOBINE', `ESSAI N°${n}`);
    if (m.take === 20) {
      ui += grp(txt(0, 0, 'ESSAI N°20', 96, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 12 }), `translate(540 ${r1(330 + (1 - spring(t, 23.0, 2.6, 0.5)) * -200)})`);
      if (t > T.parfait) ui += stamp(540, 520, 'PARFAIT', '#2FA56A', t, T.parfait, -8);
    }
    const cam = cam2([[15.6, 1.0, 540, 1250], [T.skate, 1.15, 540, 1300, 0.6], [T.rw3a, 1.0, 540, 1250, 0.3], [23.0, 1.0, 540, 1250, 0.1], [23.6, 1.25, 540, 1250, 0.4], [T.parfait, 1.1, 540, 1200, 0.5]], t);
    cam.z *= 1 + (heavy ? 0.15 * m.rw : 0) + 0.05 * punch(t, T.parfait, 6);
    cam.rot = heavy ? m.rw * 6 * Math.sin(t * 30) : 0;
    cam.shake = m.rw * (heavy ? 30 : 10) + 22 * decay(t, T.tombes1 + 0.1, 6) * (m.take === 1 ? 1 : 0) + 22 * decay(t, T.tombes2 + 0.1, 6) * (m.take === 2 ? 1 : 0);
    return { w, ui, cam, rgb: m.rw * (heavy ? 40 : 22), glitch: m.rw * (heavy ? 1.4 : 0.8), cap: true };
  }

  // ---- 5. Max a filmé… et il a le même bouton
  const MAX_SEG = [[25.7, T.rembob, 25.7, T.rembob, 1, 0], [T.rembob, 28.7, T.rembob, 26.4, 1, 1], [28.7, 35.5, 28.7, 35.5, 2, 0]];
  function maxAt(tau, take, t) {
    let w = skatepark(t, 0);
    // Léo au premier plan, de dos de trois quarts : on le garde à gauche
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: take === 1 ? [10, 10, 'relax'] : [40, 40, 'remote'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(250, 1880, 170);
    w += R.leo({ x: 250, y: 1880, scale: 1.35, expr: tau > 28.7 && take === 2 ? (tau > T.meme - 0.3 + 0 ? 'choque' : 'surpris') : 'neutre', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 5), look: [0.9, -0.2] });
    // Max au fond du couloir
    let mArms = { l: [6, 4, 'relax'], r: arm(MA(1, 150, -600, 1), 'phone') }, mEx = 'rire';
    if (take === 2 && tau > 28.7) { mArms = { l: [6, 4, 'relax'], r: arm(MA(1, 140, -560, 1), 'remoteRed') }; mEx = 'moqueur'; }
    if (take === 2 && tau > T.chaque - 0.2) { mEx = 'hautain'; }
    const mp = alive({ arms: mArms, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += shadow(760, 1560, 120);
    w += R.max({ x: 760, y: 1560, scale: 1.0, flip: true, expr: mEx, arms: mp.arms, tilt: mp.tilt + (mEx === 'rire' ? Math.sin(t * 18) * 3 : 0), bob: mp.bob, blink: blinkAt(t, 9) });
    // pression du bouton de Max : onde rouge
    if (take === 2) w += ring(700, 900, tau, T.appuyer + 0.1, 0.7, 700, '#E5483D', 20) + ring(700, 900, tau, T.appuyer + 0.25, 0.7, 500, '#E5483D', 14);
    // « il efface » : un plateau renversé qui s'efface à la gomme
    if (take === 2 && tau > T.chaque) {
      const k = clamp((tau - T.chaque) / 0.6), er = clamp((tau - 34.4) / 0.5);
      w += `<clipPath id="eraseC"><rect x="${r1(560 + er * 420)}" y="1300" width="520" height="400"/></clipPath>`;
      w += `<g clip-path="url(#eraseC)">` + grp(path('M-90 -10H90V10H-90Z', '#B5875B', 5) + `<circle cx="-40" cy="-30" r="22" fill="#F6B53D" stroke="${INK}" stroke-width="4"/><rect x="20" y="-50" width="30" height="40" fill="#E5483D" stroke="${INK}" stroke-width="4"/>`, `translate(820 ${r1(1450 + Ez.in(k) * 120)}) rotate(${r1(Ez.in(k) * 40)})`) + '</g>';
      if (er > 0 && er < 1) w += grp(path('M-40 -24H40V24H-40Z', '#F28CB1', 5) + path('M-40 -24H0V24H-40Z', '#FFFFFF', 5), `translate(${r1(560 + er * 420)} 1560) rotate(-20)`);
    }
    return w;
  }
  function sMax(t) {
    const m = remap(t, MAX_SEG);
    const w = maxAt(m.tau, m.take, t);
    let ui = vhs(t, m.rw, '◀◀ REMBOBINE', tcode(m.tau - 25.7));
    // écran du téléphone de Max : on voit Léo tomber (replay)
    if (m.take === 1 && t > T.filme - 0.1) {
      const k = spring(t, T.filme - 0.1, 2.4, 0.6);
      const ph = (t * 1.2) % 1;
      ui += grp(path('M-170 -300H170Q190 -300 190 -280V280Q190 300 170 300H-170Q-190 300 -190 280V-280Q-190 -300 -170 -300Z', '#2A2D38', 8) + `<rect x="-160" y="-270" width="320" height="540" fill="#C9C4BC"/>` +
        grp(R.leo({ x: 0, y: 200, scale: 0.42, expr: 'panique', arms: { l: [150, 30, 'open'], r: [150, 30, 'open'] } }), `rotate(${r1(ph * 80)} 0 200)`) +
        `<circle cx="-120" cy="-235" r="12" fill="#FF3B3B"/>` + txt(-96, -224, 'REC', 30, '#FFFFFF', { anchor: 'start', font: 'Anton', weight: 400 }) + txt(0, 250, 'HAHAHA', 44, '#FFE27A', { font: 'Anton', weight: 400, stroke: INK, sw: 6 }),
        `translate(800 600) rotate(6) scale(${r1(k * 100) / 100})`);
    }
    if (m.take === 2 && t > T.meme - 0.15) ui += springWord(540, 380, 'LE MÊME POUVOIR !', 112, t, T.meme - 0.15, { fill: '#FF5C7A', sw: 12, ls: 2 });
    if (m.take === 2 && t > T.appuyer && t < T.meme) ui += vhs(t, 0.6 * decay(t, T.appuyer + 0.1, 2), '◀◀ MAX', '').replace(/#2B3A8C/g, '#8C1B2B');
    const cam = cam2([[25.7, 1.05, 520, 1250], [T.filme, 1.25, 700, 1100, 0.4], [T.rembob, 1.0, 520, 1250, 0.4], [T.vois - 0.1, 1.9, 760, 1050, 0.5], [T.meme, 1.3, 600, 1150, 0.3], [T.chaque, 1.2, 760, 1350, 0.4]], t);
    cam.z *= 1 + 0.06 * punch(t, T.meme, 6);
    cam.shake = m.rw * 10 + 16 * decay(t, T.meme, 5);
    return { w, ui, cam, rgb: m.rw * 22 + 18 * decay(t, T.appuyer + 0.1, 3), glitch: m.rw * 0.8, cap: true };
  }

  // ---- 6. Max coincé dans sa boucle
  function sLoop(t) {
    const loopLen = 1.6, lt = (t - 35.5) % loopLen, n = Math.floor((t - 35.5) / loopLen) + 1;
    let w = skatepark(t, 0);
    const press = lt > 0.9;
    const mp = alive({ arms: { l: [6, 4, 'relax'], r: press ? arm(MA(1, 140, -560, 1), 'remoteRed') : [40, -40, 'relax'] }, tilt: press ? -4 : 6, bob: 0, lean: 0 }, lt + 10, 7, 0.6);
    w += shadow(540, 1640, 150);
    w += R.max({ x: 540, y: 1640, scale: 1.25, expr: press ? 'hautain' : 'vexe', arms: mp.arms, tilt: mp.tilt, bob: mp.bob, blink: blinkAt(t, 9) });
    // flèches de boucle
    const a = t * 2.5;
    w += `<g transform="rotate(${r1(a * 57.3)} 540 1000)" opacity=".85"><path d="M540 560A440 440 0 1 1 120 1120" fill="none" stroke="#E5483D" stroke-width="22" stroke-linecap="round"/><path d="M120 1120l-40 -70l90 10z" fill="#E5483D"/></g>`;
    let ui = '';
    ui += txt(540, 300, `BOUCLE N°${n}`, 92, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 12 });
    [[T.jamais1, 520], [T.jamais2, 640], [T.jamais3, 760]].forEach(([tj, y], i) => {
      const k = spring(t, tj, 3, 0.45);
      if (k > 0.01) ui += grp(txt(0, 0, 'JAMAIS', 150, '#E5483D', { font: 'Anton', weight: 400, stroke: INK, sw: 14 }), `translate(540 ${y + 400}) rotate(${(i - 1) * 6}) scale(${r1((2 - k) * 100) / 100})`, `opacity="${r1(clamp(k * 2) * 100) / 100}"`);
    });
    const sat = clamp(1 - (t - 35.5) / 5.2 * 0.85);
    return { w, ui, cam: { z: 1.05 + 0.03 * Math.sin(lt * 4), fx: 540, fy: 1100, rot: 0, shake: 8 * decay(lt + 35.5, 35.5 + 0.9, 8) }, sat, rgb: 6, cap: true };
  }

  // ---- 7. Toi, tu lâches le bouton
  function sLetGo(t) {
    let w = `<defs><linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD7A8"/><stop offset="1" stop-color="#FFF1DC"/></linearGradient></defs>`;
    w += `<rect x="-600" y="-600" width="2300" height="3200" fill="url(#warm)"/>` + rays(540, 900, 20, 2400, t * 0.2, '#FFE2BC');
    w += `<rect x="-600" y="1560" width="2300" height="1200" fill="#E9B887" stroke="${INK}" stroke-width="5"/>`;
    // vignettes successives
    const drop = t > T.lache;
    let ex = 'neutre', arms = { l: [10, 10, 'relax'], r: drop ? [40, 30, 'open'] : [40, 40, 'remote'] }, rot = 0, y = 1660, sq = 0;
    if (t > T.tombes) { const k = clamp((t - T.tombes) / 0.3); rot = Ez.in(k) * -75 * (1 - clamp((t - T.trompes + 0.1) / 0.3)); ex = 'rire'; }
    if (t > T.trompes) { ex = 'gene'; arms = { l: arm(LA(-1, -40, -440, -1), 'open'), r: [10, 10, 'relax'] }; }
    if (t > T.recommence) { ex = 'determine'; arms = { l: [10, 10, 'relax'], r: [150, 20, 'open'] }; }
    if (t > T.ris) { ex = 'rire'; arms = { l: [150, 30, 'open'], r: [150, 30, 'open'] }; sq = -0.04 * Math.sin(t * 16); }
    const lp = alive({ arms, tilt: 0, bob: t > T.ris ? -Math.abs(Math.sin(t * 8)) * 14 : 0, lean: 0 }, t, 1);
    w += shadow(540, 1670, 160);
    w += `<g transform="rotate(${r1(rot)} 540 1660)">` + R.leo({ x: 540, y, scale: 1.25, expr: ex, arms: lp.arms, tilt: lp.tilt, bob: lp.bob, squash: sq, blink: blinkAt(t, 6) }) + '</g>';
    if (t > T.trompes && t < T.recommence) for (let i = 0; i < 3; i++) { const ph = ((t * 1.3) + i / 3) % 1; w += `<circle cx="${r1(500 + i * 40)}" cy="${r1(900 - ph * 160)}" r="${r1(14 + ph * 20)}" fill="#FFFFFF" opacity="${r1((1 - ph) * 0.8 * 100) / 100}"/>`; }
    // la télécommande tombe au ralenti et se casse
    if (drop) {
      const dt = t - T.lache, yy = Math.min(1600, 1150 + dt * dt * 520), broken = yy >= 1600;
      w += grp(path('M-26 -50H26V50H-26Z', '#2A2D38', 6) + path('M-18 -40H18V-14H-18Z', '#F6B53D', 3), `translate(${r1(660 + dt * 30)} ${r1(yy)}) rotate(${r1(broken ? 90 : dt * 160)})`);
      if (broken) w += sparkles(680, 1600, t, T.lache + Math.sqrt(450 / 520), 14, 220, 9, ['#F6B53D', '#FFFFFF']);
    }
    // les autres rient AVEC lui
    if (t > T.ris) {
      w += R.passant({ x: 160, y: 1700, scale: 1.2, coat: '#7FB7BE', hairStyle: 'casquette', skin: '#C98E62', hair: '#3D6FB6', expr: 'rire', bob: -Math.abs(Math.sin(t * 8 + 1)) * 10 });
      w += R.passant({ x: 920, y: 1700, scale: 1.2, flip: true, coat: '#F28CB1', hairStyle: 'long', skin: '#8D5A3B', hair: '#2A1B14', expr: 'rire', bob: -Math.abs(Math.sin(t * 8 + 2)) * 10 });
    }
    if (t > T.trompes && t < T.ris) w += bubble(760, 820, 300, 160, { s: spring(t, T.trompes, 2.6, 0.5), seed: 21, lines: ['Oups !'], fs: 64, font: 'Anton', weight: 400 });
    if (t > T.recommence && t < T.ris + 0.3) w += board(560, 1690, 0, 0, 1.1);
    let ui = '';
    const a = spring(t, T.parce, 2.4, 0.6);
    if (a > 0.01) ui += grp(txt(0, -70, 'TES ERREURS', 120, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 14 }) + txt(0, 70, 'TE RENDENT VRAI', 120, '#FFE27A', { font: 'Anton', weight: 400, stroke: INK, sw: 14 }),
      `translate(540 ${r1(420 + (1 - a) * 80)}) scale(${r1((0.7 + 0.3 * a) * 100) / 100})`, `opacity="${clamp(a * 2)}"`);
    ui += confetti(540, 1000, t, T.ris, 60, 31);
    const cam = cam2([[40.6, 1.2, 540, 1100], [T.lache, 1.45, 620, 1250, 0.6], [T.tombes, 1.15, 540, 1200, 0.3], [T.ris, 1.0, 540, 1150, 0.4]], t);
    cam.z *= 1 + 0.04 * punch(t, T.ris, 5);
    return { w, ui, cam, cap: true };
  }

  // ---- 8. « Et toi ? »
  function sQuestion(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 1040, 22, 2400, t * 0.2, '#F9C55E');
    w += R.leo({ x: 540, y: 1080 + Math.sin(t * 2) * 6, scale: 2.35, headOnly: true, expr: t > T.disle ? 'content' : 'neutre', blink: blinkAt(t, 51), tilt: Math.sin(t * 1.3) * 3 });
    let ui = '';
    const out = Ez.in(inv(T.disle - 0.3, T.disle, t));
    if (out < 1) ui += grp(springWord(540, 420, 'ET TOI ?', 200, t, T.ettoi, { fill: '#FFFFFF', sw: 16, ls: 6 }), `translate(0 ${r1(-out * 600)})`);
    const c = spring(t, T.disle, 2.4, 0.6);
    if (c > 0.01) {
      const typed = 'Ma coupe de cheveux 2019'.slice(0, Math.floor(clamp((t - T.disle - 0.3) / 1.0) * 24));
      const card = path('M-430 -95H430Q470 -95 470 -55V55Q470 95 430 95H-430Q-470 95 -470 55V-55Q-470 -95 -430 -95Z', '#FFFFFF', 6) +
        `<circle cx="-380" cy="0" r="46" fill="#E5483D" stroke="${INK}" stroke-width="5"/>` + txt(-380, 18, '◀◀', 40, '#FFFFFF', { font: 'Anton', weight: 400 }) +
        txt(-305, 16, typed || 'Ajoute un commentaire…', 44, typed ? INK : '#9A8F86', { anchor: 'start', weight: 700 }) +
        (Math.floor(t * 3) % 2 ? `<rect x="${r1(-300 + measure(typed, 44, 'Brico', 700))}" y="-24" width="5" height="48" fill="${INK}"/>` : '');
      ui += grp(card, `translate(540 ${r1(400 + (1 - c) * 200)}) scale(${r1(c * 100) / 100})`);
    }
    return { w, ui, cam: { z: 1 + 0.05 * Ez.io(inv(48.6, 51.7, t)) + 0.05 * punch(t, T.ettoi + 0.1, 5), fx: 540, fy: 960, rot: 0 }, cap: true };
  }

  /*CTA*/

  // ================================================================== TIMELINE
  const SCENES = [
    { f: sHook, a: 0, b: 4.4 },
    { f: sStairs, a: 4.4, b: 9.4, tin: 'whip', d: 0.4 },
    { f: sTest, a: 9.4, b: 15.6, tin: 'whip', d: 0.4 },
    { f: sSkate, a: 15.6, b: 25.7, tin: 'whip', d: 0.4 },
    { f: sMax, a: 25.7, b: 35.5, tin: 'zoom', d: 0.4 },
    { f: sLoop, a: 35.5, b: 40.6, tin: 'cut' },
    { f: sLetGo, a: 40.6, b: 48.6, tin: 'iris', d: 0.55 },
    { f: sQuestion, a: 48.6, b: 51.7, tin: 'whip', d: 0.4 },
    { f: sCTA, a: 51.7, b: DUR + 1, tin: 'zoom', d: 0.45 },
  ];

