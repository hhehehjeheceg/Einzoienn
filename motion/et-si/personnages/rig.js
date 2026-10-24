// Rig 2D de la série « Et si… » — Léo (le héros) et Max (l'ennemi).
// Chaque personnage est une fonction qui renvoie un groupe SVG (chaîne) à partir
// d'options : position, échelle, expression, bouche, regard, clignement, bras.
// Origine locale = entre les pieds, au sol. Unités = px à l'échelle 1.

(function (root) {
  const INK = '#2A1F1D';
  const OL = 4.5; // épaisseur du contour

  const r1 = n => Math.round(n * 10) / 10;
  const rad = d => d * Math.PI / 180;

  // ---------- primitives ----------
  const path = (d, fill, sw = OL, extra = '') =>
    `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const fillOnly = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const line = (d, col = INK, sw = OL, extra = '') =>
    `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const ell = (cx, cy, rx, ry, fill, sw = OL, extra = '') =>
    `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}" stroke="${sw ? INK : 'none'}" stroke-width="${sw}" ${extra}/>`;

  // Union de formes avec un seul contour extérieur : passe contour puis passe remplissage.
  function union(shapes, fill, sw = OL) {
    let a = '', b = '';
    for (const s of shapes) {
      if (s.t === 'cap') {
        const d = `M${r1(s.x1)} ${r1(s.y1)}L${r1(s.x2)} ${r1(s.y2)}`;
        a += `<path d="${d}" stroke="${INK}" stroke-width="${s.w + sw * 2}" stroke-linecap="round" fill="none"/>`;
        b += `<path d="${d}" stroke="${s.c || fill}" stroke-width="${s.w}" stroke-linecap="round" fill="none"/>`;
      } else if (s.t === 'poly') {
        a += `<path d="${s.d}" stroke="${INK}" stroke-width="${s.w + sw * 2}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
        b += `<path d="${s.d}" stroke="${s.c || fill}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      } else if (s.t === 'ell') {
        a += `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${INK}" stroke="${INK}" stroke-width="${sw * 2}" ${s.tf ? `transform="${s.tf}"` : ''}/>`;
        b += `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${s.c || fill}" ${s.tf ? `transform="${s.tf}"` : ''}/>`;
      } else if (s.t === 'path') {
        a += `<path d="${s.d}" fill="${INK}" stroke="${INK}" stroke-width="${sw * 2}" stroke-linejoin="round"/>`;
        b += `<path d="${s.d}" fill="${s.c || fill}"/>`;
      }
    }
    return a + b;
  }

  // Bras : épaule S, angle haut-bras a1 (0 = vers le bas, + = vers l'extérieur), pliure a2.
  function limb(Sx, Sy, side, L1, L2, a1, a2) {
    const dir = a => [side * Math.sin(rad(a)), Math.cos(rad(a))];
    const d1 = dir(a1), d2 = dir(a1 + a2);
    const E = [Sx + d1[0] * L1, Sy + d1[1] * L1];
    const W = [E[0] + d2[0] * L2, E[1] + d2[1] * L2];
    return { E, W, rot: -side * (a1 + a2) };
  }

  // Cinématique inverse : angles [a1, a2] pour que le poignet atteigne (Tx, Ty).
  function ik(Sx, Sy, side, L1, L2, Tx, Ty, bend = 1) {
    const dx = Tx - Sx, dy = Ty - Sy;
    const d = Math.max(Math.abs(L1 - L2) + 1, Math.min(L1 + L2 - 0.5, Math.hypot(dx, dy)));
    const aT = Math.atan2(side * dx, dy) * 180 / Math.PI;
    const al = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)) * 180 / Math.PI;
    const a1 = aT + bend * al;
    const Ex = Sx + side * Math.sin(rad(a1)) * L1, Ey = Sy + Math.cos(rad(a1)) * L1;
    const af = Math.atan2(side * (Tx - Ex), Ty - Ey) * 180 / Math.PI;
    return [a1, af - a1];
  }
  // Bras décrits soit par angles [a1, a2, main], soit par cible { at: [x, y], hand, bend }.
  function armSpec(a, sd, Sx, Sy, L1, L2) {
    if (a && !Array.isArray(a) && a.at) { const [a1, a2] = ik(Sx, Sy, sd, L1, L2, a.at[0], a.at[1], a.bend == null ? 1 : a.bend); return [a1, a2, a.hand || 'relax']; }
    return a;
  }
  // Transformation commune de pose : position, échelle, miroir, inclinaison, écrasement.
  function poseTf(o) {
    const sc = o.scale || 1, sq = o.squash || 0;
    return `translate(${r1(o.x || 0)} ${r1(o.y || 0)}) scale(${sc * (o.flip ? -1 : 1)} ${sc}) rotate(${r1(o.lean || 0)}) scale(${1 + sq * 0.6} ${1 - sq})`;
  }

  // Main en repère local : poignet à l'origine, la main pointe vers +y.
  function hand(type, side, skin, rot = 0) {
    const s = side;
    if (type === 'fist') {
      return union([
        { t: 'ell', cx: 0, cy: 15, rx: 17, ry: 16 },
        { t: 'cap', x1: -s * 9, y1: 6, x2: -s * 16, y2: 15, w: 10 },
      ], skin) + line(`M${-8} 20 q8 4 16 0`, INK, 3, 'opacity=".55"');
    }
    if (type === 'point') {
      return union([
        { t: 'ell', cx: 0, cy: 14, rx: 16, ry: 15 },
        { t: 'cap', x1: 2, y1: 20, x2: 4, y2: 44, w: 10 },
        { t: 'cap', x1: -s * 10, y1: 6, x2: -s * 17, y2: 14, w: 10 },
      ], skin);
    }
    if (type === 'phone') { // tient un téléphone droit (il filme), quelle que soit la rotation du bras
      return union([{ t: 'ell', cx: 0, cy: 14, rx: 16, ry: 15 }], skin) +
        `<g transform="translate(0 10) rotate(${-rot}) translate(${-s * 4} -34)">` +
        path('M-19 -2h38a6 6 0 0 1 6 6v58a6 6 0 0 1 -6 6h-38a6 6 0 0 1 -6 -6v-58a6 6 0 0 1 6 -6z', '#2A2D38') +
        ell(-10, 9, 6, 6, '#11131A', 3) + ell(-10, 9, 2.2, 2.2, '#6FD3F7', 0) + ell(10, 8, 4, 4, '#FF4D4D', 0) +
        '</g>' +
        union([
          { t: 'cap', x1: -s * 12, y1: 8, x2: -s * 20, y2: 18, w: 10 },
          { t: 'cap', x1: s * 12, y1: 10, x2: s * 18, y2: 20, w: 9 },
        ], skin);
    }
    if (type === 'remote' || type === 'remoteRed') { // télécommande tenue droite, gros bouton ◀◀
      const btn = type === 'remote' ? '#F6B53D' : '#E5483D';
      return union([{ t: 'ell', cx: 0, cy: 14, rx: 16, ry: 15 }], skin) +
        `<g transform="translate(0 6) rotate(${-rot}) translate(${-s * 2} -46)">` +
        path('M-17 0h34a7 7 0 0 1 7 7v62a7 7 0 0 1 -7 7h-34a7 7 0 0 1 -7 -7v-62a7 7 0 0 1 7 -7z', '#2A2D38') +
        path('M-12 10h24v20h-24z', btn, 3) + `<path d="M-2 14l-8 6l8 6zM8 14l-8 6l8 6z" fill="${INK}"/>` +
        `<circle cx="-7" cy="44" r="4" fill="#8A8D96"/><circle cx="7" cy="44" r="4" fill="#8A8D96"/><circle cx="-7" cy="58" r="4" fill="#8A8D96"/><circle cx="7" cy="58" r="4" fill="#8A8D96"/>` +
        '</g>' + union([{ t: 'cap', x1: -s * 12, y1: 8, x2: -s * 20, y2: 18, w: 10 }, { t: 'cap', x1: s * 12, y1: 10, x2: s * 18, y2: 20, w: 9 }], skin);
    }
    if (type === 'relax') { // main au repos, doigts groupés
      return union([
        { t: 'ell', cx: 0, cy: 13, rx: 15, ry: 14 },
        { t: 'cap', x1: -8, y1: 18, x2: -9, y2: 32, w: 9 },
        { t: 'cap', x1: 0, y1: 20, x2: 0, y2: 36, w: 9.5 },
        { t: 'cap', x1: 8, y1: 18, x2: 8, y2: 31, w: 9 },
        { t: 'cap', x1: -s * 11, y1: 8, x2: -s * 15, y2: 24, w: 9 },
      ], skin) + line('M-4.5 25V34M4.5 25V33', INK, 2.5, 'opacity=".6"');
    }
    // main ouverte, 4 doigts
    const f = [];
    const base = [[-10, 22, -16], [-3.5, 25, -5], [3.5, 25, 5], [10, 22, 16]];
    for (const [x, y, a] of base) f.push({ t: 'cap', x1: x * 0.8, y1: y - 6, x2: x + Math.sin(rad(a)) * 14, y2: y + Math.cos(rad(a)) * 14, w: 8.5 });
    return union([
      { t: 'ell', cx: 0, cy: 14, rx: 16, ry: 14 },
      ...f,
      { t: 'cap', x1: -s * 10, y1: 8, x2: -s * 24, y2: 14, w: 9.5 },
    ], skin);
  }

  // Œil générique : sclère + iris + reflets + paupières (clip).
  let uid = 0;
  function eye(cx, cy, rx, ry, e, iris, side) {
    const id = 'e' + (++uid);
    const lt = e.lidTop || 0, lb = e.lidBot || 0, tilt = (e.lidTilt || 0) * side; // tilt + = intérieur plus bas (fâché)
    const look = e.look || [0, 0];
    const ps = e.pupil || 1;
    const ix = cx + look[0] * rx * 0.42, iy = cy + look[1] * ry * 0.38;
    const top = cy - ry + lt * ry * 2.05;
    const bot = cy + ry - lb * ry * 1.3;
    const dx = rx + 6;
    // ligne de paupière supérieure, inclinée
    const tA = top - tilt * 0.5, tB = top + tilt * 0.5; // A = extérieur? side gère l'inversion
    const lidUp = `M${cx - dx} ${cy - ry - 30}H${cx + dx}V${tB}Q${cx} ${(tA + tB) / 2 + (lt > 0.05 ? 4 : 0)} ${cx - dx} ${tA}Z`;
    const lidDn = `M${cx - dx} ${cy + ry + 30}H${cx + dx}V${bot}Q${cx} ${bot - 4} ${cx - dx} ${bot}Z`;
    let s = `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`;
    s += ell(cx, cy, rx, ry, '#FFFFFF', 0);
    s += `<g clip-path="url(#${id})">`;
    s += ell(ix, iy, rx * 0.58 * ps, ry * 0.52 * ps, iris, 0);
    s += ell(ix, iy, rx * 0.3 * ps, ry * 0.27 * ps, INK, 0);
    s += ell(ix + rx * 0.2, iy - ry * 0.2, rx * 0.17, ry * 0.15, '#FFFFFF', 0);
    s += ell(ix - rx * 0.16, iy + ry * 0.2, rx * 0.07, ry * 0.07, '#FFFFFF', 0);
    if (lt > 0) s += fillOnly(lidUp, e.lidCol) + line(`M${cx + dx} ${tB}Q${cx} ${(tA + tB) / 2 + (lt > 0.05 ? 4 : 0)} ${cx - dx} ${tA}`, INK, OL);
    if (lb > 0) s += fillOnly(lidDn, e.lidCol) + line(`M${cx + dx} ${bot}Q${cx} ${bot - 4} ${cx - dx} ${bot}`, INK, 3.5);
    s += '</g>';
    if (lt >= 0.98) { // fermé : arc
      s = line(`M${cx - rx} ${cy}Q${cx} ${cy + ry * 0.55} ${cx + rx} ${cy}`, INK, OL + 0.5);
    } else s += ell(cx, cy, rx, ry, 'none', OL);
    return s;
  }

  // Bouches : bibliothèque partagée, centrées sur (0,0), largeur ~ 46.
  const MOUTH_IN = '#6E2430', TONGUE = '#E86A6A';
  function mouth(key, w = 1) {
    const k = key || 'neutral';
    const S = (d, sw = OL) => line(d, INK, sw);
    const open = (d, tongue = true, teeth = true) => {
      const id = 'm' + (++uid);
      let s = `<clipPath id="${id}"><path d="${d}"/></clipPath>` + fillOnly(d, MOUTH_IN);
      s += `<g clip-path="url(#${id})">`;
      if (teeth) s += fillOnly('M-40 -40H40V' + (teeth === 'low' ? -40 : -1) + 'H-40Z', '#FFFFFF');
      if (tongue) s += ell(0, 26, 20, 13, TONGUE, 0);
      s += '</g>' + path(d, 'none');
      return s;
    };
    const lib = {
      neutral: () => S('M-13 0Q0 3 13 0'),
      smile: () => S('M-19 -4Q0 13 19 -4'),
      grin: () => open('M-23 -5Q0 0 23 -5Q20 21 0 22Q-20 21 -23 -5Z'),
      laugh: () => open('M-25 -8Q0 -2 25 -8Q24 30 0 32Q-24 30 -25 -8Z'),
      o: () => open('M0 -12C9 -12 12 -4 12 4C12 13 7 18 0 18C-7 18 -12 13 -12 4C-12 -4 -9 -12 0 -12Z', true, false),
      frown: () => S('M-16 6Q0 -7 16 6'),
      sad: () => open('M-18 8Q0 -10 18 8Q0 4 -18 8Z', false, false),
      grimace: () => open('M-22 -8H22Q26 -8 26 -2V6Q26 12 22 12H-22Q-26 12 -26 6V-2Q-26 -8 -22 -8Z', false, false) +
        `<path d="M-22 2H22M-11 -8V12M0 -8V12M11 -8V12" stroke="${INK}" stroke-width="2.5" fill="none" opacity=".5"/>`,
      teeth: () => fillOnly('M-22 -8H22Q26 -8 26 -2V6Q26 12 22 12H-22Q-26 12 -26 6V-2Q-26 -8 -22 -8Z', '#FFF') +
        path('M-22 -8H22Q26 -8 26 -2V6Q26 12 22 12H-22Q-26 12 -26 6V-2Q-26 -8 -22 -8Z', 'none') +
        `<path d="M-26 2H26M-11 -8V12M0 -8V12M11 -8V12" stroke="${INK}" stroke-width="2.5" fill="none" opacity=".45"/>`,
      wavy: () => S('M-20 2q5 -6 10 0t10 0t10 0t10 0', 4),
      flat: () => S('M-12 2H12'),
      smirk: () => S('M-14 3Q2 6 18 -7'),
      sneer: () => open('M-4 0Q10 1 22 -9Q20 6 6 7Q-2 6 -4 0Z', false, true) + S('M-18 4Q-8 4 -4 0'),
      // visèmes (lipsync)
      A: () => open('M-18 -6Q0 -2 18 -6Q16 20 0 22Q-16 20 -18 -6Z'),
      E: () => open('M-21 -4Q0 -1 21 -4Q18 10 0 11Q-18 10 -21 -4Z', false),
      O: () => open('M0 -11C8 -11 11 -4 11 3C11 11 7 15 0 15C-7 15 -11 11 -11 3C-11 -4 -8 -11 0 -11Z', true, false),
      U: () => open('M0 -6C5 -6 7 -2 7 2C7 7 4 9 0 9C-4 9 -7 7 -7 2C-7 -2 -5 -6 0 -6Z', false, false),
      M: () => S('M-14 1Q0 -1 14 1', 5),
      F: () => open('M-15 -4Q0 -1 15 -4Q13 6 0 7Q-13 6 -15 -4Z', false) + S('M-13 5Q0 1 13 5', 3.5),
    };
    return `<g transform="scale(${w} 1)">${(lib[k] || lib.neutral)()}</g>`;
  }

  // Sourcils : épaisseur, position intérieure/extérieure relatives.
  function brow(cx, cy, side, len, b, col, thick = 9) {
    const inX = cx - side * len * 0.5, outX = cx + side * len * 0.5;
    const iy = cy + (b.in || 0), oy = cy + (b.out || 0);
    const my = Math.min(iy, oy) - (b.arch == null ? 5 : b.arch);
    return line(`M${inX} ${iy}Q${cx} ${my} ${outX} ${oy}`, col, thick);
  }

  // Effets d'expression (gouttes, veine, larmes…)
  function fx(list, ox, oy) {
    let s = '';
    for (const f of list || []) {
      if (f === 'sweat') s += path(`M${ox + 98} ${oy - 70}q12 18 0 26q-12 -8 0 -26z`, '#9FD8F5', 3.5);
      if (f === 'vein') s += line(`M${ox + 60} ${oy - 100}l10 10m6 -12l-10 10m-10 10l10 -10m14 6l-10 -10`, '#E04848', 5);
      if (f === 'tears') s += path(`M${ox - 44} ${oy + 22}q-6 22 2 34q10 -10 4 -34z`, '#9FD8F5', 3) + path(`M${ox + 44} ${oy + 22}q6 22 -2 34q-10 -10 -4 -34z`, '#9FD8F5', 3);
      if (f === 'blush') s += ell(ox - 64, oy + 12, 16, 9, '#F27E6F', 0, 'opacity=".55"') + ell(ox + 64, oy + 12, 16, 9, '#F27E6F', 0, 'opacity=".55"');
      if (f === 'shock') s += line(`M${ox - 120} ${oy - 90}l-18 -14M${ox - 128} ${oy - 50}l-22 -4M${ox + 120} ${oy - 90}l18 -14M${ox + 128} ${oy - 50}l22 -4`, INK, 5);
      if (f === 'gloom') s += line(`M${ox - 60} ${oy - 105}v34M${ox - 30} ${oy - 112}v40M${ox} ${oy - 114}v42M${ox + 30} ${oy - 112}v40M${ox + 60} ${oy - 105}v34`, '#7B6FB0', 4, 'opacity=".7"');
    }
    return s;
  }

  // =====================================================================
  //  LÉO — le héros. Formes rondes, sweat jaune, épi sur la tête.
  // =====================================================================
  const LEO_PAL = {
    skin: '#E9B48C', skinSh: '#CF946C', hair: '#3A2621', hairHi: '#5B3B31',
    hood: '#F6B53D', hoodSh: '#DD9528', hoodIn: '#B8771B', string: '#FFF6E6',
    jean: '#3F5888', jeanSh: '#30456E', shoe: '#FBFAF6', shoeAcc: '#E5483D', sole: '#D9D2C6', iris: '#5A3A2A',
  };
  const SKIN_TONES = {
    clair: ['#F4CDB0', '#DDAA88'], medium: ['#E9B48C', '#CF946C'], mat: ['#C98E62', '#AC7148'],
    fonce: ['#8D5A3B', '#714429'], tresFonce: ['#5E3A26', '#4A2C1B'],
  };

  const LEO_EXPR = {
    neutre:   { brow: { in: 0, out: 0 }, eye: {}, mouth: 'neutral' },
    content:  { brow: { in: -4, out: -2 }, eye: { lidBot: 0.25 }, mouth: 'grin', fx: ['blush'] },
    rire:     { brow: { in: -8, out: -4 }, eye: { lidTop: 1 }, mouth: 'laugh', fx: ['blush'] },
    surpris:  { brow: { in: -16, out: -14 }, eye: { pupil: 0.7 }, mouth: 'o', fx: ['shock'] },
    enerve:   { brow: { in: 10, out: -8, arch: -2 }, eye: { lidTop: 0.32, lidTilt: 14 }, mouth: 'grimace', fx: ['vein'] },
    triste:   { brow: { in: -10, out: 6, arch: 2 }, eye: { lidTop: 0.25, lidTilt: -10, look: [0, 0.5] }, mouth: 'sad', fx: ['tears'] },
    fatigue:  { brow: { in: 2, out: 4, arch: 1 }, eye: { lidTop: 0.55, look: [0, 0.4] }, mouth: 'flat', fx: [] },
    gene:     { brow: { in: -6, out: 2 }, eye: { look: [0.8, 0.2] }, mouth: 'wavy', fx: ['blush', 'sweat'] },
    blase:    { brow: { in: 0, out: 0, arch: 0 }, eye: { lidTop: 0.48, look: [0.6, 0] }, mouth: 'flat', fx: [] },
    panique:  { brow: { in: -18, out: -6 }, eye: { pupil: 0.55, lidBot: 0 }, mouth: 'grimace', fx: ['sweat', 'shock'] },
    determine:{ brow: { in: 8, out: -4, arch: 0 }, eye: { lidTop: 0.2, lidTilt: 8 }, mouth: 'smirk', fx: [] },
    choque:   { brow: { in: -14, out: -10 }, eye: { pupil: 0.45 }, mouth: 'A', fx: ['gloom'] },
  };

  function leoHead(o, pal) {
    const ex = LEO_EXPR[o.expr || 'neutre'] || LEO_EXPR.neutre;
    const e = Object.assign({ lidCol: pal.skin }, ex.eye, o.eye || {});
    if (o.look) e.look = o.look;
    if (o.blink) e.lidTop = Math.max(e.lidTop || 0, o.blink);
    const cy = -505; // centre de la tête
    const face = 'M0 -607C64 -607 108 -571 110 -514C112 -458 78 -404 0 -402C-78 -404 -112 -458 -110 -514C-108 -571 -64 -607 0 -607Z';
    let s = '';
    // cheveux arrière
    s += path('M-112 -500C-128 -560 -110 -630 -40 -646C20 -660 96 -640 118 -580C130 -548 124 -516 112 -496Z', pal.hair);
    // oreilles
    for (const sd of [-1, 1]) {
      s += path(`M${sd * 104} -528C${sd * 128} -536 ${sd * 134} -500 ${sd * 124} -482C${sd * 118} -470 ${sd * 108} -468 ${sd * 102} -472Z`, pal.skin);
      s += line(`M${sd * 112} -516Q${sd * 122} -505 ${sd * 112} -488`, pal.skinSh, 4);
    }
    // visage + ombre sous la frange
    const fid = 'f' + (++uid);
    s += `<clipPath id="${fid}"><path d="${face}"/></clipPath>`;
    s += fillOnly(face, pal.skin);
    s += `<g clip-path="url(#${fid})">` +
      fillOnly('M-120 -560Q-60 -520 0 -540Q60 -520 120 -560V-620H-120Z', pal.skinSh, 'opacity=".55"') +
      fillOnly('M58 -560Q100 -500 70 -410H130V-560Z', pal.skinSh, 'opacity=".35"') + '</g>';
    s += path(face, 'none');
    // cernes (signature : il dort mal)
    s += line('M-60 -470Q-44 -462 -28 -468', pal.skinSh, 3.5) + line('M28 -468Q44 -462 60 -470', pal.skinSh, 3.5);
    // taches de rousseur
    for (const sd of [-1, 1]) s += `<g fill="${pal.skinSh}"><circle cx="${sd * 64}" cy="-452" r="2.6"/><circle cx="${sd * 74}" cy="-444" r="2.2"/><circle cx="${sd * 58}" cy="-440" r="2.2"/></g>`;
    // yeux
    s += eye(-42, -500, 25, 31, e, pal.iris, -1) + eye(42, -500, 25, 31, e, pal.iris, 1);
    // nez
    s += line('M-3 -478Q9 -468 -1 -458', INK, 4);
    // bouche
    s += `<g transform="translate(0 -436)">${mouth(o.mouth || ex.mouth)}</g>`;
    // cheveux avant : masse + frange en mèches + épi
    s += path('M-111 -506C-120 -556 -100 -612 -40 -628C10 -642 84 -628 108 -578C116 -560 116 -532 110 -506' +
      'Q104 -526 100 -550Q90 -542 76 -548Q80 -562 72 -574Q58 -558 36 -560Q42 -572 36 -586Q20 -564 -4 -564Q2 -576 -2 -590' +
      'Q-22 -566 -48 -568Q-40 -580 -44 -592Q-62 -572 -82 -564Q-82 -576 -86 -586Q-98 -562 -102 -540Q-106 -522 -111 -506Z', pal.hair);
    s += line('M-70 -606Q-30 -622 14 -616', pal.hairHi, 6) + line('M30 -612Q56 -606 74 -594', pal.hairHi, 5);
    // épi
    s += path('M10 -630C4 -662 26 -690 52 -688C36 -676 30 -660 40 -646C48 -660 64 -668 80 -664C64 -656 54 -640 52 -626Z', pal.hair);
    // sourcils
    s += brow(-42, -541, -1, 40, ex.brow, '#24160F', 9.5) + brow(42, -541, 1, 40, ex.brow, '#24160F', 9.5);
    s += fx(o.fx || ex.fx, 0, -505);
    // accessoires de tête (selon l'épisode)
    const acc = o.acc || [];
    if (acc.includes('lunettesNoires')) {
      s += line('M-112 -506L-70 -510M112 -506L70 -510', INK, 5);
      s += path('M-74 -526H-12Q-8 -526 -9 -520L-14 -490Q-17 -474 -34 -474H-56Q-72 -474 -76 -490L-80 -518Q-80 -526 -74 -526Z', '#1E2028');
      s += path('M74 -526H12Q8 -526 9 -520L14 -490Q17 -474 34 -474H56Q72 -474 76 -490L80 -518Q80 -526 74 -526Z', '#1E2028');
      s += line('M-10 -516Q0 -522 10 -516', INK, 5);
      s += line('M-62 -516L-48 -500M58 -516L70 -502', '#FFFFFF', 4, 'opacity=".35"');
    }
    return s;
  }

  // Canne blanche (accessoire de scène), pointe en bas, poignée en (0,0).
  function canne(x, y, ang = 0, sc = 1) {
    return `<g transform="translate(${x} ${y}) rotate(${ang}) scale(${sc})">` +
      union([{ t: 'cap', x1: 0, y1: 0, x2: 0, y2: 330, w: 11 }], '#FAFAF7') +
      `<path d="M0 270V318" stroke="#E5483D" stroke-width="11"/>` + line('M0 266V322', INK, 0) +
      union([{ t: 'cap', x1: 0, y1: -4, x2: 0, y2: 46, w: 15 }], '#2B2D36') + '</g>';
  }

  function leo(o = {}) {
    const pal = Object.assign({}, LEO_PAL);
    if (o.skin && SKIN_TONES[o.skin]) [pal.skin, pal.skinSh] = SKIN_TONES[o.skin];
    let s = `<g transform="${poseTf(o)}">`;
    if (o.headOnly) return s + `<g transform="translate(0 505) rotate(${o.tilt || 0} 0 -415)">${leoHead(o, pal)}</g></g>`;
    const A = Object.assign({ l: [7, 6, 'relax'], r: [7, 6, 'relax'] }, o.arms || {});
    const lift = o.lift || [0, 0], b = o.bob || 0;
    // jambes
    s += union([{ t: 'cap', x1: -30, y1: -210 + b, x2: -33, y2: -36 - lift[0], w: 54 }], pal.jean);
    s += union([{ t: 'cap', x1: 30, y1: -210 + b, x2: 33, y2: -36 - lift[1], w: 54 }], pal.jean);
    // ourlets retroussés
    s += path(`M-62 ${-64 - lift[0]}H-4V${-44 - lift[0]}H-62Z`, '#5470A3', 4) + path(`M4 ${-64 - lift[1]}H62V${-44 - lift[1]}H4Z`, '#5470A3', 4);
    // baskets
    for (const sd of [-1, 1]) {
      s += `<g transform="translate(0 ${-lift[sd < 0 ? 0 : 1]})">`;
      s += path(`M${sd * 6} -42C${sd * 6} -48 ${sd * 18} -50 ${sd * 34} -50C${sd * 58} -50 ${sd * 74} -36 ${sd * 76} -14C${sd * 76} -4 ${sd * 70} 0 ${sd * 60} 0H${sd * 10}C${sd * 4} 0 ${sd * 2} -6 ${sd * 4} -14Z`, pal.shoe);
      s += path(`M${sd * 4} -12H${sd * 76}V-4C${sd * 76} -1 ${sd * 72} 0 ${sd * 66} 0H${sd * 10}C${sd * 6} 0 ${sd * 4} -3 ${sd * 4} -6Z`, pal.sole, 3.5);
      s += line(`M${sd * 24} -30Q${sd * 44} -36 ${sd * 60} -24`, pal.shoeAcc, 6);
      s += '</g>';
    }
    s += `<g transform="translate(0 ${b})">`;
    // capuche (derrière la tête)
    s += path('M-92 -392C-112 -430 -96 -462 -58 -462H58C96 -462 112 -430 92 -392Z', pal.hoodIn);
    // torse du sweat
    const torso = 'M-62 -408C-88 -404 -102 -392 -104 -366L-98 -222Q-98 -196 -76 -196H76Q98 -196 98 -222L104 -366C102 -392 88 -404 62 -408Z';
    const tid = 't' + (++uid);
    s += `<clipPath id="${tid}"><path d="${torso}"/></clipPath>` + fillOnly(torso, pal.hood);
    s += `<g clip-path="url(#${tid})">` + fillOnly('M60 -420Q74 -300 64 -190H120V-420Z', pal.hoodSh, 'opacity=".7"') +
      fillOnly('M-110 -232H110V-190H-110Z', pal.hoodSh) + '</g>';
    s += path(torso, 'none') + line('M-97 -232H97', INK, 3.5);
    // poche kangourou
    s += path('M-52 -300H52Q60 -300 64 -290L72 -238H-72L-64 -290Q-60 -300 -52 -300Z', pal.hood, 4);
    s += line('M-64 -290Q-50 -270 -60 -238M64 -290Q50 -270 60 -238', INK, 3.5);
    // col + cou
    s += path('M-48 -414Q0 -380 48 -414Q40 -392 0 -386Q-40 -392 -48 -414Z', pal.hoodIn, 4);
    s += fillOnly('M-24 -420H24V-398Q0 -388 -24 -398Z', pal.skinSh);
    // cordons
    s += line('M-20 -396Q-24 -364 -18 -336', pal.string, 5) + line('M20 -396Q24 -364 18 -336', pal.string, 5);
    s += path('M-23 -342h10v18h-10z', '#E5483D', 3) + path('M13 -342h10v18h-10z', '#E5483D', 3);
    // bras
    for (let [sd, a] of [[-1, A.l], [1, A.r]]) {
      a = armSpec(a, sd, sd * 88, -384 + b, 96, 88);
      if (a.length > 3 && a[3] === 'back') continue;
      const L = limb(sd * 88, -384, sd, 96, 88, a[0], a[1]);
      const d = `M${sd * 88} -384L${r1(L.E[0])} ${r1(L.E[1])}L${r1(L.W[0])} ${r1(L.W[1])}`;
      s += union([{ t: 'poly', d, w: 42 }], pal.hood);
      // poignet côtelé
      const back = [L.W[0] - (L.W[0] - L.E[0]) * 0.14, L.W[1] - (L.W[1] - L.E[1]) * 0.14];
      s += `<path d="M${r1(back[0])} ${r1(back[1])}L${r1(L.W[0])} ${r1(L.W[1])}" stroke="${pal.hoodSh}" stroke-width="40" stroke-linecap="butt"/>`;
      s += `<g transform="translate(${r1(L.W[0])} ${r1(L.W[1])}) rotate(${r1(L.rot)})">${hand(a[2], sd, pal.skin, L.rot)}</g>`;
    }
    s += `<g transform="rotate(${o.tilt || 0} 0 -415)">${leoHead(o, pal)}</g>`;
    if (o.front) s += o.front; // élément tenu devant (accessoire)
    return s + '</g></g>';
  }

  // =====================================================================
  //  MAX — l'ennemi. Formes anguleuses, blouson rouge, mèche blonde.
  // =====================================================================
  const MAX_PAL = {
    skin: '#F2C9AC', skinSh: '#DBA584', hair: '#EBC35A', hairSh: '#C99A34', under: '#9C7A3A',
    jacket: '#D62E40', jacketSh: '#A81F30', sleeve: '#F3E6CC', sleeveSh: '#D9C8A6', tee: '#24242B',
    jog: '#8B909C', jogSh: '#6E7380', shoe: '#22232A', sole: '#F4F1EA', iris: '#4FA3CF', chain: '#F2C94C',
  };
  const MAX_EXPR = {
    moqueur:  { brow: { in: 8, out: -6, arch: 2 }, eye: { lidTop: 0.42, lidTilt: 6, look: [-0.5, 0] }, mouth: 'sneer' },
    neutre:   { brow: { in: 4, out: -2 }, eye: { lidTop: 0.3 }, mouth: 'flat' },
    rire:     { brow: { in: 6, out: -8 }, eye: { lidTop: 1 }, mouth: 'laugh' },
    mechant:  { brow: { in: 14, out: -10, arch: -2 }, eye: { lidTop: 0.4, lidTilt: 16, pupil: 0.8 }, mouth: 'teeth', fx: ['vein'] },
    surpris:  { brow: { in: -12, out: -12 }, eye: { pupil: 0.65 }, mouth: 'o' },
    vexe:     { brow: { in: 10, out: 2 }, eye: { lidTop: 0.5, lidTilt: 8, look: [0.7, 0] }, mouth: 'frown' },
    hautain:  { brow: { in: 2, out: -10, arch: 4 }, eye: { lidTop: 0.55, look: [0, -0.4] }, mouth: 'smirk' },
    peur:     { brow: { in: -16, out: -4 }, eye: { pupil: 0.5 }, mouth: 'wavy', fx: ['sweat'] },
    triste:   { brow: { in: -10, out: 6, arch: 2 }, eye: { lidTop: 0.32, lidTilt: -10, look: [0, 0.6] }, mouth: 'sad' },
    touche:   { brow: { in: -8, out: 4, arch: 2 }, eye: { lidTop: 0.2, lidTilt: -6, look: [-0.4, 0.3] }, mouth: 'flat' },
    choque:   { brow: { in: -14, out: -10 }, eye: { pupil: 0.5 }, mouth: 'o' },
  };

  function maxHead(o, pal) {
    const ex = MAX_EXPR[o.expr || 'moqueur'] || MAX_EXPR.moqueur;
    const e = Object.assign({ lidCol: pal.skin }, ex.eye, o.eye || {});
    if (o.look) e.look = o.look;
    if (o.blink) e.lidTop = Math.max(e.lidTop || 0, o.blink);
    const face = 'M0 -716C56 -716 90 -684 90 -628C90 -580 76 -538 40 -514Q18 -500 0 -500Q-18 -500 -40 -514C-76 -538 -90 -580 -90 -628C-90 -684 -56 -716 0 -716Z';
    let s = '';
    for (const sd of [-1, 1]) {
      s += path(`M${sd * 84} -640C${sd * 104} -648 ${sd * 110} -614 ${sd * 100} -598C${sd * 94} -588 ${sd * 86} -588 ${sd * 82} -592Z`, pal.skin);
      s += line(`M${sd * 90} -630Q${sd * 99} -620 ${sd * 90} -604`, pal.skinSh, 4);
    }
    const fid = 'f' + (++uid);
    s += `<clipPath id="${fid}"><path d="${face}"/></clipPath>` + fillOnly(face, pal.skin);
    s += `<g clip-path="url(#${fid})">` + fillOnly('M-100 -680Q0 -640 100 -680V-730H-100Z', pal.skinSh, 'opacity=".6"') +
      fillOnly('M30 -600Q60 -560 40 -500H100V-600Z', pal.skinSh, 'opacity=".35"') + '</g>';
    s += path(face, 'none');
    // pattes (côtés courts)
    s += path('M-89 -628C-94 -672 -80 -698 -58 -708L-60 -676Q-74 -664 -82 -630Z', pal.hairSh, 3.5);
    s += path('M89 -628C94 -672 80 -698 58 -708L60 -676Q74 -664 82 -630Z', pal.hairSh, 3.5);
    // yeux plissés
    s += eye(-34, -616, 21, 23, e, pal.iris, -1) + eye(34, -616, 21, 23, e, pal.iris, 1);
    // nez pointu
    s += line('M2 -600L16 -568Q8 -562 -2 -566', INK, 4);
    // bouche
    s += `<g transform="translate(2 -538)">${mouth(o.mouth || ex.mouth, 1.08)}</g>`;
    // mèche (banane) balayée vers la droite
    s += path('M-74 -676C-86 -716 -60 -756 -10 -762C40 -770 100 -758 128 -724C110 -728 96 -724 88 -716C96 -706 98 -692 94 -680' +
      'Q80 -700 58 -700Q64 -690 62 -680Q40 -700 10 -694Q14 -686 12 -676Q-10 -692 -40 -688Q-56 -686 -74 -676Z', pal.hair);
    s += line('M-46 -728Q0 -752 60 -744', pal.hairSh, 6) + line('M-20 -712Q20 -730 70 -722', pal.hairSh, 4);
    // sourcils fins en V
    s += brow(-34, -652, -1, 38, ex.brow, pal.hairSh, 7) + brow(34, -652, 1, 38, ex.brow, pal.hairSh, 7);
    s += fx(o.fx || ex.fx, 0, -616);
    return s;
  }

  function max(o = {}) {
    const pal = Object.assign({}, MAX_PAL);
    let s = `<g transform="${poseTf(o)}">`;
    if (o.headOnly) return s + `<g transform="translate(0 616) rotate(${o.tilt || 0} 0 -515)">${maxHead(o, pal)}</g></g>`;
    const A = Object.assign({ l: [6, 4, 'relax'], r: [14, -140, 'phone'] }, o.arms || {});
    const lift = o.lift || [0, 0], b = o.bob || 0;
    // jambes (jogging)
    s += union([{ t: 'cap', x1: -28, y1: -280 + b, x2: -34, y2: -44 - lift[0], w: 52 }], pal.jog);
    s += union([{ t: 'cap', x1: 28, y1: -280 + b, x2: 34, y2: -44 - lift[1], w: 52 }], pal.jog);
    s += line(`M-46 ${-250 + b}L-47 ${-70 - lift[0]}`, pal.sole, 5) + line(`M46 ${-250 + b}L47 ${-70 - lift[1]}`, pal.sole, 5); // bandes latérales
    s += path(`M-58 ${-66 - lift[0]}H-10V${-46 - lift[0]}H-58Z`, pal.jogSh, 4) + path(`M10 ${-66 - lift[1]}H58V${-46 - lift[1]}H10Z`, pal.jogSh, 4);
    // baskets montantes noires
    for (const sd of [-1, 1]) {
      s += `<g transform="translate(0 ${-lift[sd < 0 ? 0 : 1]})">`;
      s += path(`M${sd * 8} -52V-60H${sd * 54}C${sd * 58} -40 ${sd * 72} -34 ${sd * 80} -20C${sd * 84} -10 ${sd * 80} 0 ${sd * 68} 0H${sd * 10}C${sd * 4} 0 ${sd * 4} -6 ${sd * 6} -14Z`, pal.shoe);
      s += path(`M${sd * 5} -12H${sd * 82}V-5C${sd * 82} -2 ${sd * 78} 0 ${sd * 72} 0H${sd * 10}C${sd * 6} 0 ${sd * 5} -3 ${sd * 5} -6Z`, pal.sole, 3.5);
      s += line(`M${sd * 22} -44L${sd * 46} -30`, pal.sole, 4) + line(`M${sd * 20} -32L${sd * 42} -20`, pal.sole, 4);
      s += '</g>';
    }
    s += `<g transform="translate(0 ${b})">`;
    // t-shirt noir + blouson ouvert
    const body = 'M-70 -506C-100 -500 -112 -486 -112 -458L-104 -292Q-104 -266 -80 -266H80Q104 -266 104 -292L112 -458C112 -486 100 -500 70 -506Z';
    const bid = 'b' + (++uid);
    s += `<clipPath id="${bid}"><path d="${body}"/></clipPath>` + fillOnly(body, pal.jacket);
    s += `<g clip-path="url(#${bid})">` +
      fillOnly('M-30 -520L-22 -260H22L30 -520Z', pal.tee) +
      fillOnly('M70 -520Q84 -380 72 -250H130V-520Z', pal.jacketSh, 'opacity=".75"') +
      `<path d="M-120 -300H120" stroke="${INK}" stroke-width="3"/>` +
      fillOnly('M-120 -298H120V-260H-120Z', '#2B2B33') +
      `<path d="M-120 -286H120" stroke="${pal.jacket}" stroke-width="5"/>` + '</g>';
    s += path(body, 'none');
    s += line('M-30 -500L-22 -298M30 -500L22 -298', INK, 3.5);
    // chaîne dorée
    s += line('M-20 -496Q0 -448 20 -496', pal.chain, 5) + path('M-7 -458h14v16h-14z', pal.chain, 3);
    // col côtelé
    s += path('M-56 -512Q-30 -486 -26 -500L-34 -520Z', '#2B2B33', 3.5) + path('M56 -512Q30 -486 26 -500L34 -520Z', '#2B2B33', 3.5);
    s += fillOnly('M-22 -530H22V-506Q0 -496 -22 -506Z', pal.skinSh);
    // écusson « V »
    s += path('M-86 -440h34v34h-34z', pal.sleeve, 3.5) + line('M-79 -414V-432l10 11l10 -11V-414', pal.jacket, 5);
    // bras (manches crème)
    for (let [sd, a] of [[-1, A.l], [1, A.r]]) {
      a = armSpec(a, sd, sd * 96, -482 + b, 104, 96);
      const L = limb(sd * 96, -482, sd, 104, 96, a[0], a[1]);
      const d = `M${sd * 96} -482L${r1(L.E[0])} ${r1(L.E[1])}L${r1(L.W[0])} ${r1(L.W[1])}`;
      s += union([{ t: 'poly', d, w: 40 }], pal.sleeve);
      const back = [L.W[0] - (L.W[0] - L.E[0]) * 0.16, L.W[1] - (L.W[1] - L.E[1]) * 0.16];
      s += `<path d="M${r1(back[0])} ${r1(back[1])}L${r1(L.W[0])} ${r1(L.W[1])}" stroke="#2B2B33" stroke-width="38" stroke-linecap="butt"/>`;
      s += `<g transform="translate(${r1(L.W[0])} ${r1(L.W[1])}) rotate(${r1(L.rot)})">${hand(a[2], sd, pal.skin, L.rot)}</g>`;
    }
    s += `<g transform="rotate(${o.tilt || 0} 0 -515)">${maxHead(o, pal)}</g>`;
    return s + '</g></g>';
  }

  root.EtSi = { leo, max, canne, mouth, LEO_EXPR, MAX_EXPR, SKIN_TONES, INK,
    prims: { path, fillOnly, line, ell, union, eye, mouth, brow, hand, limb, ik, fx, poseTf } };
})(typeof window !== 'undefined' ? window : globalThis);
