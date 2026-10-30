// « Pourquoi c'est horrible d'avoir un appareil dentaire » — accessoires dessinés.
(function () {
  const X = window.PCH;
  const { K, INK, P, F, L, E, G, cel, clamp, lerp, inv, r1, r2, Ez, rng, txt, grp, at, op, rr } = X;

  // très gros plan d'une bouche souriante avec appareil (centre x,y ; largeur w) + restes de nourriture
  function bigMouth(x, y, w, o = {}) {
    const h = w * 0.5, open = o.open == null ? 1 : o.open;
    const d = `M${-w / 2} ${-h * 0.25}Q0 ${h * 0.05} ${w / 2} ${-h * 0.25}Q${w * 0.42} ${h * (0.4 + 0.5 * open)} 0 ${h * (0.45 + 0.5 * open)}Q${-w * 0.42} ${h * (0.4 + 0.5 * open)} ${-w / 2} ${-h * 0.25}Z`;
    const c = 'bm' + Math.round(x + y);
    let g = cel(`M${-w * 0.62} ${-h * 0.7}Q0 ${-h * 0.95} ${w * 0.62} ${-h * 0.7}Q${w * 0.8} ${h * 0.3} ${w * 0.5} ${h * 1.2}Q0 ${h * 1.55} ${-w * 0.5} ${h * 1.2}Q${-w * 0.8} ${h * 0.3} ${-w * 0.62} ${-h * 0.7}Z`, o.skin || '#F3C9A5', { dx: 20, dy: 14 });
    g += `<clipPath id="${c}"><path d="${d}"/></clipPath>` + F(d, '#5A1A27') + `<g clip-path="url(#${c})">`;
    g += F(`M${-w} ${-h}H${w}V${h * 0.18}H${-w}Z`, '#FFFFFF') + F(`M${-w} ${h * (0.42 + 0.3 * open)}H${w}V${h * 2}H${-w}Z`, '#FFFFFF');
    for (let i = -3; i <= 3; i++) g += L(`M${i * w * 0.11} ${-h}V${h * 0.18}M${i * w * 0.11 + w * 0.05} ${h * (0.42 + 0.3 * open)}V${h * 2}`, '#D9D4CC', 3);
    // fil + bagues
    for (const [yy, ww] of [[-h * 0.02, w * 0.48], [h * (0.6 + 0.3 * open), w * 0.42]]) {
      g += L(`M${-ww} ${yy}Q0 ${yy + h * 0.06} ${ww} ${yy}`, '#8E96A3', w * 0.018);
      for (let i = 0; i < 9; i++) { const xx = -ww + (i + 0.5) * (2 * ww / 9), q = w * 0.026; g += `<rect x="${r1(xx - q)}" y="${r1(yy - q + (1 - Math.pow(xx / ww, 2)) * h * 0.05)}" width="${r1(q * 2)}" height="${r1(q * 2)}" rx="${r1(q * 0.3)}" fill="#D2D7DF" stroke="#5B6270" stroke-width="3"/>`; }
    }
    // restes coincés (épinards, maïs)
    if (o.food) { const r = rng(5); for (let i = 0; i < o.food; i++) { const xx = (r() - 0.5) * w * 0.8, yy = -h * 0.02 + (r() - 0.5) * h * 0.08; g += i % 3 === 2 ? E(xx, yy, w * 0.02, w * 0.026, '#F2C94C', 2) : P(`M${r1(xx - w * 0.03)} ${r1(yy - w * 0.02)}l${r1(w * 0.05)} ${r1(w * 0.01)}l${r1(-w * 0.01)} ${r1(w * 0.05)}l${r1(-w * 0.05)} ${r1(-w * 0.01)}z`, '#3E8E3E', 2); } }
    if (o.shine) g += `<rect x="${r1(-w + o.shine * w * 2)}" y="${-h}" width="${r1(w * 0.12)}" height="${r1(h * 3)}" fill="#FFFFFF" opacity=".7" transform="skewX(-20)"/>`;
    g += '</g>' + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
    return grp(g, at(x, y, o.s || 1, o.rot || 0));
  }
  // bol de purée + cuillère
  function pureeBowl(x, y, s = 1) {
    return grp(E(0, -14, 120, 26, '#F6E7B0', 5) + P('M-40 -24q20 -30 40 -10q20 -26 40 4', '#FFF6D2', 4) + cel('M-130 -14H130Q120 80 0 86Q-120 80 -130 -14Z', '#E5483D', { dx: 14, dy: 8 }) + L('M-110 20Q0 40 110 20', '#FFFFFF', 6, 'opacity=".5"'), at(x, y, s));
  }
  function spoon(x, y, rot = 0, s = 1, food = false) {
    return grp(L('M0 0V-120', '#C9CCD6', 12) + L('M0 0V-120', INK, 3) + cel('M-22 -120Q-26 -170 0 -172Q26 -170 22 -120Q0 -104 -22 -120Z', '#C9CCD6', { dx: 3, dy: 3, sw: 5 }) + (food ? E(0, -142, 18, 12, '#F6E7B0', 3) : ''), at(x, y, s, rot));
  }
  // élastique (petite boucle beige)
  function band(x, y, s = 1, rot = 0) {
    return grp(`<ellipse rx="22" ry="12" fill="none" stroke="${INK}" stroke-width="9"/><ellipse rx="22" ry="12" fill="none" stroke="#E8C77A" stroke-width="5"/>`, at(x, y, s, rot));
  }
  // friandises interdites
  function gum(x, y, s = 1, rot = 0) {
    return grp(cel('M-90 -50H90V50H-90Z', '#4FC3E8', { dx: 10, dy: 8 }) + txt(0, 14, 'GUM', 52, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 8, ls: 3 }) + cel('M60 -50h30v100h-30z', '#FFFFFF', { dx: 3, dy: 3, sw: 4 }), at(x, y, s, rot));
  }
  function caramel(x, y, s = 1, rot = 0) {
    return grp(cel('M-110 -30L-70 0L-110 30Z', '#F2C94C', { dx: 4, dy: 4, sw: 5 }) + cel('M110 -30L70 0L110 30Z', '#F2C94C', { dx: 4, dy: 4, sw: 5 }) + cel('M-70 -40H70V40H-70Z', '#C47A2C', { dx: 10, dy: 8 }) + L('M-50 -20Q0 -36 50 -20', '#E8A85A', 6), at(x, y, s, rot));
  }
  function popcorn(x, y, s = 1, rot = 0) {
    let g = '';
    const r = rng(9);
    for (let i = 0; i < 14; i++) g += cel(`M${r1(-60 + r() * 120)} ${r1(-110 - r() * 50)}m-20 0a20 18 0 1 0 40 0a20 18 0 1 0 -40 0Z`, '#FFF6D2', { dx: 3, dy: 3, sw: 4 });
    g += cel('M-90 -100H90L70 120H-70Z', '#FFFFFF', { dx: 12, dy: 8 });
    for (let i = 0; i < 4; i++) g += F(`M${-80 + i * 46} -100h22l-6 220h-16z`, '#E5483D');
    g += L('M-90 -100H90L70 120H-70Z', INK, 6);
    return grp(g, at(x, y, s, rot));
  }
  function redX(x, y, t, t0, s = 1) {
    if (t < t0) return '';
    const k = X.spring(t, t0, 3, 0.45);
    return grp(L('M-90 -90L90 90M90 -90L-90 90', INK, 46) + L('M-90 -90L90 90M90 -90L-90 90', '#E5483D', 30), at(x, y, s * clamp(k, 0, 1.3), (1 - k) * 30));
  }
  // grosse pince / clé de l'orthodontiste
  function pliers(x, y, s = 1, rot = 0, open = 0) {
    const a = 8 + open * 14;
    const jaw = sd => grp(cel(`M0 0L${sd * 16} -130Q${sd * 6} -150 ${sd * -4} -132L${sd * -10} 0Z`, '#C9CED6', { dx: sd * 4, dy: 0, sw: 5 }), `rotate(${r1(sd * a)})`);
    const handle = sd => grp(cel(`M${sd * 4} 0L${sd * 30} 200Q${sd * 18} 214 ${sd * 6} 200L${sd * -8} 10Z`, '#E5483D', { dx: sd * 4, dy: 4, sw: 5 }), `rotate(${r1(-sd * a * 0.5)})`);
    return grp(handle(-1) + handle(1) + jaw(-1) + jaw(1) + E(0, 0, 14, 14, '#8A8D96', 4), at(x, y, s, rot));
  }
  // fauteuil de dentiste (vu de face, incliné)
  function dentalChair(x, y, s = 1) {
    return grp(cel('M-200 60H200V120H-200Z', '#5BC0C8', { dx: 0, dy: 10 }) + cel('M-170 -420Q-170 -460 -130 -460H130Q170 -460 170 -420V60H-170Z', '#5BC0C8', { dx: 18, dy: 0 }) +
      cel('M-40 120H40V260H-40Z', '#C9CCD6', { dx: 8, dy: 0 }) + cel('M-160 260H160V290H-160Z', '#9AA0AA', { dx: 0, dy: 6 }) + L('M-130 -400Q0 -430 130 -400', '#8ED6DC', 8), at(x, y, s));
  }
  // lampe de dentiste
  function dentalLamp(x, y, s = 1, on = 1) {
    let g = L('M0 -400Q-120 -300 -60 -100', '#9AA0AA', 12) + L('M0 -400Q-120 -300 -60 -100', INK, 3);
    if (on > 0) g += `<path d="M-130 -60L10 -60L160 400H-280Z" fill="#FFF6D8" opacity="${r2(0.25 * on)}"/>`;
    g += cel('M-130 -120Q-60 -170 10 -120L0 -60H-120Z', '#E9E4D8', { dx: 8, dy: 6 }) + E(-60, -62, 54, 10, '#FFF6D8', 3);
    return grp(g, at(x, y, s));
  }
  // calendrier qui s'effeuille (mois affiché)
  function calendar(x, y, s, label, sub, flip = 0, col = '#E5483D') {
    let g = cel('M-140 -170H140V170H-140Z', '#FFFFFF', { dx: 12, dy: 10 }) + F('M-140 -170H140V-80H-140Z', col) + L('M-140 -80H140', INK, 5) + L('M-140 -170H140V170H-140Z', INK, 6);
    g += txt(0, -108, sub || '', 40, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) + txt(0, 70, label, 130, INK, { font: 'Anton', weight: 400 });
    for (let i = -1; i <= 1; i++) g += E(i * 90, -170, 10, 18, '#C9CCD6', 4);
    if (flip > 0) g += grp(cel('M-140 -80H140V170H-140Z', '#FFFFFF', { dx: 6, dy: 6 }), `translate(0 -80) scale(1 ${r2(1 - 2 * flip)}) translate(0 80)`, op(1 - flip));
    return grp(g, at(x, y, s, 0));
  }
  // appareil photo sur pied
  function camera(x, y, s = 1) {
    return grp(L('M0 0L-120 380M0 0L120 380M0 0V380', '#3A3A44', 12) + cel('M-120 -110H120V60H-120Z', '#2B2B33', { dx: 10, dy: 8 }) + E(0, -24, 62, 62, '#4A4F5C', 7) + E(0, -24, 38, 38, '#1A1C22', 5) + E(-12, -36, 10, 10, '#9FD9F2', 0) + cel('M60 -140H110V-110H60Z', '#E9E4D8', { dx: 3, dy: 3, sw: 4 }), at(x, y, s));
  }
  // casque orthodontique (« force extra-orale ») posé sur une tête : centre de tête hx, hy, rayon R
  function headgear(hx, hy, R, t, o = {}) {
    const g = L(`M${-R * 1.02} ${R * 0.05}Q${-R * 1.25} ${-R * 1.25} 0 ${-R * 1.32}Q${R * 1.25} ${-R * 1.25} ${R * 1.02} ${R * 0.05}`, INK, R * 0.2) + L(`M${-R * 1.02} ${R * 0.05}Q${-R * 1.25} ${-R * 1.25} 0 ${-R * 1.32}Q${R * 1.25} ${-R * 1.25} ${R * 1.02} ${R * 0.05}`, '#5BA8E8', R * 0.14) +
      L(`M${-R * 1.02} ${R * 0.12}Q${-R * 0.9} ${R * 0.9} 0 ${R * 0.95}Q${R * 0.9} ${R * 0.9} ${R * 1.02} ${R * 0.12}`, INK, R * 0.2) + L(`M${-R * 1.02} ${R * 0.12}Q${-R * 0.9} ${R * 0.9} 0 ${R * 0.95}Q${R * 0.9} ${R * 0.9} ${R * 1.02} ${R * 0.12}`, '#5BA8E8', R * 0.14) +
      // arc métallique devant la bouche
      L(`M${-R * 1.05} ${R * 0.5}Q${-R * 0.8} ${R * 1.35} 0 ${R * 1.3}Q${R * 0.8} ${R * 1.35} ${R * 1.05} ${R * 0.5}`, '#7A808C', R * 0.08) + L(`M0 ${R * 1.3}V${R * 0.75}`, '#7A808C', R * 0.08) +
      L(`M${-R * 1.05} ${R * 0.5}Q${-R * 0.8} ${R * 1.35} 0 ${R * 1.3}Q${R * 0.8} ${R * 1.35} ${R * 1.05} ${R * 0.5}`, '#E9EDF3', R * 0.035) +
      (o.shine ? `<circle cx="${r1(R * 0.5)}" cy="${r1(R * 1.25)}" r="${r1(R * 0.12 * o.shine)}" fill="#FFFFFF" opacity="${r2(o.shine)}"/>` : '');
    return grp(g, at(hx, hy, 1, o.rot || 0));
  }
  // lit vu de face, nuit
  function bed(x, y, s = 1) {
    return grp(cel('M-360 -60H360V120H-360Z', '#6B5BB0', { dx: 18, dy: 10 }) + cel('M-380 -260H-320V160H-380ZM320 -200H380V160H320Z', '#8A6A4A', { dx: 8, dy: 0 }) + cel('M-300 -150Q-300 -190 -260 -190H-40Q0 -190 0 -150V-90H-300Z', '#FFFFFF', { dx: 6, dy: 6 }), at(x, y, s));
  }
  // case de jeu de société « DOULEUR »
  function boardSquare(x, y, s, label, col) {
    return grp(cel('M-150 -90H150V90H-150Z', col, { dx: 10, dy: 8 }) + txt(0, 22, label, 62, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 8, ls: 2 }), at(x, y, s));
  }
  // postillons
  function spit(x, y, t, t0, n, seed, dir = 1) {
    const dt = t - t0;
    if (dt <= 0 || dt > 0.9) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) { const a = (r() - 0.5) * 0.9, v = 500 + r() * 500; s += E(x + dir * Math.cos(a) * v * dt, y + Math.sin(a) * v * dt + 600 * dt * dt, 7 + r() * 6, 9 + r() * 6, '#BFE6F5', 3); }
    return s;
  }

  Object.assign(X, { bigMouth, pureeBowl, spoon, band, gum, caramel, popcorn, redX, pliers, dentalChair, dentalLamp, calendar, camera, headgear, bed, boardSquare, spit });
})();
