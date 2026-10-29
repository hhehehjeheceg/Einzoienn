// « Pourquoi c'est horrible d'être gaucher » — accessoires dessinés (cel shading, trait encre).
// S'appuie sur la boîte à outils de l'épisode 1 (window.PCH) et le rig v2 (window.EtSi2).
(function () {
  const X = window.PCH;
  const { K, INK, P, F, L, E, G, cel, clamp, lerp, inv, r1, r2, Ez, rng, txt, grp, at, op, rr } = X;

  // pupitre d'école vu de face (plateau + façade qui cache les jambes)
  function desk(x, y, w = 760, o = {}) {
    const c = o.col || '#D9A066', h = o.h || 300;
    return cel(`M${x - w / 2 + 20} ${y + 40}H${x + w / 2 - 20}V${y + h}H${x - w / 2 + 20}Z`, K.shade(c, 0.1), { dx: 18, dy: 0, inner: L(`M${x - w / 2 + 60} ${y + 120}H${x + w / 2 - 60}`, K.shade(c, 0.25), 5) }) +
      cel(`M${x - w / 2} ${y}H${x + w / 2}V${y + 44}H${x - w / 2}Z`, c, { dx: 0, dy: 10 });
  }
  // feuille lignée (centre x, y), avec marge rouge
  function paper(x, y, w, h, rot = 0, o = {}) {
    let g = cel(`M${-w / 2} ${-h / 2}H${w / 2}V${h / 2}H${-w / 2}Z`, o.col || '#FFFDF6', { dx: 6, dy: 6, sw: o.sw || 5 });
    for (let yy = -h / 2 + 50; yy < h / 2 - 10; yy += o.step || 36) g += L(`M${-w / 2 + 8} ${yy}H${w / 2 - 8}`, '#BFD3EE', 2.5);
    if (o.margin !== false) g += L(`M${-w / 2 + 60} ${-h / 2 + 6}V${h / 2 - 6}`, '#F2A0A0', 3);
    return grp(g + (o.inner || ''), at(x, y, o.s || 1, rot));
  }
  // écriture manuscrite : ondulations qui se dessinent de 0 à k (0-1), puis bavure optionnelle
  function scribbleLine(x0, y0, len, k, seed, o = {}) {
    if (k <= 0) return '';
    const r = rng(seed);
    let d = `M${x0} ${y0}`, x = x0;
    const step = 9;
    while (x < x0 + len) { const a = 5 + r() * 7, w = step + r() * 4; d += `q${r1(w / 2)} ${r1(-a * 2)} ${r1(w)} 0`; if (r() < 0.12) { d += `m${r1(8 + r() * 10)} 0`; x += 12; } x += w; }
    const tot = len * 2.4;
    return `<path d="${d}" fill="none" stroke="${o.col || '#2A4FA8'}" stroke-width="${o.w || 4.5}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${r1(tot)}" stroke-dashoffset="${r1(tot * (1 - clamp(k)))}" ${op(o.op == null ? 1 : o.op)}/>`;
  }
  // stylo (pointe en bas à 0°)
  function pen(x, y, rot = 0, s = 1, o = {}) {
    const c = o.col || '#2E5AAC';
    let g = cel('M-9 -150H9V-20H-9Z', c, { dx: 4, dy: 0, sw: 4.5 }) + cel('M-9 -20H9L3 4H-3Z', '#E9E4D8', { dx: 2, dy: 0, sw: 4 }) + P('M-2 4L0 12L2 4Z', INK, 2);
    g += cel('M-11 -160H11V-140H-11Z', o.cap || K.shade(c, 0.2), { dx: 2, dy: 2, sw: 4 }) + L('M11 -150V-95', o.clip || '#C9CCD6', 5);
    if (o.glow) g = `<circle r="${r1(120 * o.glow)}" cy="-70" fill="#FFF2B0" ${op(0.5 * o.glow)} filter="url(#soft)"/>` + g;
    return grp(g, at(x, y, s, rot));
  }
  // ciseaux d'école (open : 0 fermé -> 1 ouvert), face optionnelle (mâchoire qui mâche)
  function scissors(x, y, s = 1, rot = 0, open = 0.5, o = {}) {
    const a = 6 + open * 26;
    const blade = sd => grp(cel(`M0 0L${sd * 14} -230Q${sd * 4} -244 ${sd * -6} -228L${sd * -8} 0Z`, '#D4D8E0', { dx: sd * 5, dy: 0, sw: 5 }) +
      (o.teeth ? P(Array.from({ length: 7 }, (_, i) => `M${sd * -6} ${-30 - i * 28}l${sd * 10} -10l${sd * -10} -10z`).join(''), '#FFFFFF', 3) : ''), `rotate(${r1(sd * a)})`);
    const handle = sd => grp(cel(`M${sd * 8} 10C${sd * 70} 0 ${sd * 96} 60 ${sd * 70} 110C${sd * 40} 150 ${sd * -10} 120 ${sd * 2} 60Z`, o.col || '#F28CB1', { dx: sd * 6, dy: 6 }) +
      E(sd * 46, 72, 22, 26, o.bg || '#FFFFFF', 4), `rotate(${r1(sd * a * 0.6)})`);
    let g = handle(-1) + handle(1) + blade(-1) + blade(1) + E(0, 0, 12, 12, '#8A8D96', 4);
    if (o.face) g += E(-26, -150, 14, 16, '#FFFFFF', 4) + E(26, -150, 14, 16, '#FFFFFF', 4) + E(-22, -148, 6, 7, INK, 0) + E(22, -148, 6, 7, INK, 0) + L('M-40 -176L-14 -168M40 -176L14 -168', INK, 5);
    return grp(g, at(x, y, s, rot));
  }
  // grosse main de gaucher (moufle) qui tient un stylo — vue de dessus, poignet vers la droite
  function bigHand(x, y, s = 1, rot = 0, o = {}) {
    const skin = o.skin || '#8A5A3C', sleeve = o.sleeve || '#F28C38', ink = o.ink || 0, sh = K.shade(skin, 0.22);
    let g = cel('M120 -74H440V74H120Z', sleeve, { dx: 0, dy: 14 }) + cel('M104 -82H150V82H104Z', K.shade(sleeve, 0.2), { dx: 0, dy: 6, sw: 5 });
    g += grp(pen(0, 0, 0, 1.2, { col: o.penCol || '#2E5AAC', glow: o.glow }), 'translate(-112 70) rotate(38)');
    g += cel('M112 -64C40 -100 -50 -96 -96 -50C-128 -14 -124 40 -92 64C-50 96 50 92 112 62Z', skin, { dx: 8, dy: 12 });
    // doigts repliés (jointures)
    g += L('M-96 10Q-70 26 -44 12M-60 44Q-34 60 -8 44M-22 70Q4 84 30 70', sh, 5);
    g += cel('M-40 -40C-100 -60 -150 -30 -136 0C-124 26 -84 22 -56 6Z', skin, { dx: 4, dy: 6 }); // pouce
    if (ink > 0) g += `<path d="M-94 56C-50 92 50 92 110 60L112 80C50 104 -50 104 -100 70Z" fill="#2A4FA8" ${op(0.85 * ink)}/>`;
    return grp(g, at(x, y, s, rot));
  }
  // cahier à spirale (vu de dessus)
  function spiralBook(x, y, s = 1, rot = 0, o = {}) {
    let g = cel('M-300 -220H300V220H-300Z', o.cover || '#4FA3CF', { dx: 10, dy: 10 }) + paper(14, 0, 560, 420, 0, { margin: true });
    for (let i = 0; i < 9; i++) g += `<ellipse cx="-290" cy="${-180 + i * 45}" rx="26" ry="12" fill="none" stroke="${INK}" stroke-width="9"/><ellipse cx="-290" cy="${-180 + i * 45}" rx="26" ry="12" fill="none" stroke="#C9CCD6" stroke-width="5"/>`;
    return grp(g, at(x, y, s, rot));
  }
  // plateau de cantine
  function tray(x, y, s = 1, o = {}) {
    let g = cel('M-210 -26H210L196 30H-196Z', '#9AA4B5', { dx: 10, dy: 6 });
    g += E(-100, -30, 80, 22, '#FFFFFF', 5) + E(-100, -38, 52, 13, '#F6E2A8', 0) + E(90, -30, 80, 22, '#FFFFFF', 5);
    for (let i = 0; i < (o.peas == null ? 12 : o.peas); i++) g += E(70 + (i % 4) * 14 - 2, -40 + Math.floor(i / 4) * 8 - 4, 8, 7, '#7BC14E', 2.5);
    return grp(g, at(x, y, s));
  }
  // fourchette (dents en haut à 0°)
  function fork(x, y, rot = 0, s = 1) {
    return grp(L('M0 0V-90', '#C9CCD6', 9) + L('M0 0V-90', INK, 2.5) + P('M-12 -90H12V-110L8 -140M0 -140V-110M-8 -140L-12 -110', '#C9CCD6', 3).replace('fill="#C9CCD6"', 'fill="none"') +
      L('M-12 -92V-140M-4 -92V-140M4 -92V-140M12 -92V-140', '#C9CCD6', 5) + L('M-12 -92H12', '#C9CCD6', 8), at(x, y, s, rot));
  }
  // tableau blanc
  function board(x, y, w = 900, h = 520) {
    return cel(`M${x - w / 2 - 24} ${y - h / 2 - 24}H${x + w / 2 + 24}V${y + h / 2 + 24}H${x - w / 2 - 24}Z`, '#B9BEC8', { dx: 0, dy: 10 }) +
      F(`M${x - w / 2} ${y - h / 2}H${x + w / 2}V${y + h / 2}H${x - w / 2}Z`, '#F7FAFC') + L(`M${x - w / 2} ${y - h / 2}H${x + w / 2}V${y + h / 2}H${x - w / 2}Z`, INK, 5) +
      cel(`M${x - w / 2} ${y + h / 2 + 24}H${x + w / 2}V${y + h / 2 + 50}H${x - w / 2}Z`, '#9AA0AA', { dx: 0, dy: 6, sw: 5 });
  }
  // radiateur + ondes de chaleur
  function radiator(x, y, s = 1, t = 0, heat = 0) {
    let g = '';
    for (let i = 0; i < 8; i++) g += cel(`M${-200 + i * 50} -150Q${-176 + i * 50} -168 ${-152 + i * 50} -150V150Q${-176 + i * 50} 166 ${-200 + i * 50} 150Z`, heat > 0.5 ? K.tint('#F4F1EA', 0) : '#F4F1EA', { dx: 6, dy: 0, sw: 5 });
    g += cel('M-212 120H212V138H-212Z', '#E2DED4', { dx: 0, dy: 4, sw: 4 }) + L('M-170 150V196M170 150V196', INK, 8);
    if (heat > 0) for (let i = 0; i < 6; i++) {
      const xx = -170 + i * 68, ph = t * 2.2 + i * 0.7, k = (ph % 1);
      g += `<path d="M${xx} ${-170 - k * 160}q14 -30 0 -60q-14 -30 0 -60" fill="none" stroke="#FF8A5C" stroke-width="7" stroke-linecap="round" ${op(heat * Math.sin(Math.PI * k) * 0.8)}/>`;
    }
    return grp(g, at(x, y, s));
  }
  // boîte du stylo spécial gaucher
  function penBox(x, y, s = 1, rot = 0, o = {}) {
    let g = cel('M-190 -260H190V260H-190Z', '#1C1418', { dx: 16, dy: 10 }) + `<path d="${rr(-170, -240, 340, 480, 18)}" fill="none" stroke="#FFD23F" stroke-width="5"/>`;
    g += txt(0, -170, 'STYLO', 66, '#FFD23F', { font: 'Anton', weight: 400, ls: 6 }) + txt(0, -110, 'SPÉCIAL GAUCHER', 40, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 });
    g += `<path d="${rr(-70, -80, 140, 220, 14)}" fill="#2A2238" stroke="#FFD23F" stroke-width="4"/>`;
    const ticks = o.ticks || 0;
    ['EFFAÇABLE', 'ZÉRO BAVURE'].forEach((s1, i) => {
      const k = clamp(ticks - i);
      g += txt(-60, 186 + i * 44, s1, 32, '#FFFFFF', { anchor: 'start', weight: 800 }) + `<circle cx="-110" cy="${176 + i * 44}" r="16" fill="#7BD389" ${op(k)}/>` + (k > 0 ? `<path d="M-118 ${176 + i * 44}l6 7l12 -14" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>` : `<circle cx="-110" cy="${176 + i * 44}" r="16" fill="none" stroke="#FFFFFF" stroke-width="3"/>`);
    });
    return grp(g, at(x, y, s, rot));
  }
  // dos de tête d'élève (premier plan de la classe)
  function backHead(x, y, s, hair, skin, top) {
    return grp(cel('M-120 120Q-120 30 0 30Q120 30 120 120V200H-120Z', top, { dx: 14, dy: 0 }) + cel('M-74 40C-90 -60 -50 -110 0 -110C50 -110 90 -60 74 40Q0 70 -74 40Z', hair, { dx: 10, dy: 6 }) + E(-80, -10, 14, 22, skin, 4) + E(80, -10, 14, 22, skin, 4), at(x, y, s));
  }
  // éclaboussure d'encre (forme organique), utile pour la transition « encre »
  function inkBlot(cx, cy, R, seed, col = '#2A4FA8') {
    const r = rng(seed), n = 22;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, q = R * (0.78 + r() * 0.38), q2 = R * (0.78 + r() * 0.38);
      const x1 = cx + Math.cos(a) * q, y1 = cy + Math.sin(a) * q, am = a + Math.PI / n, xm = cx + Math.cos(am) * q2 * 1.08, ym = cy + Math.sin(am) * q2 * 1.08;
      d += (i ? `Q${r1(xm)} ${r1(ym)} ${r1(x1)} ${r1(y1)}` : `M${r1(x1)} ${r1(y1)}`);
    }
    let s = `<path d="${d}Z" fill="${col}"/>`;
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, dd = R * (1.1 + r() * 0.5), rr2 = R * (0.04 + r() * 0.08); s += `<circle cx="${r1(cx + Math.cos(a) * dd)}" cy="${r1(cy + Math.sin(a) * dd)}" r="${r1(rr2)}" fill="${col}"/>`; }
    return s;
  }
  // onomatopée BD (contour épais, légère rotation, ressort)
  function onoma(x, y, word, size, t, t0, o = {}) {
    if (t < t0) return '';
    const k = X.spring(t, t0, 3, 0.4), out = o.t1 ? 1 - Ez.in(inv(o.t1, o.t1 + 0.18, t)) : 1;
    const g = txt(0, size * 0.35, word, size, o.fill || '#FFD23F', { font: 'Anton', weight: 400, stroke: INK, sw: o.sw || 16, ls: 3 });
    return grp(g, at(x, y, clamp(k, 0, 1.3) * out, (o.rot == null ? -10 : o.rot) + (1 - k) * 20));
  }

  Object.assign(X, { desk, paper, scribbleLine, pen, scissors, bigHand, spiralBook, tray, fork, board, radiator, penBox, backHead, inkBlot, onoma });
})();
