// Personnages secondaires de la série : passants génériques et le chat.
// Même trait (contour encre) que Léo et Max, en plus simple pour rester en arrière-plan.
(function (root) {
  const E = root.EtSi, INK = E.INK;
  const { path, fillOnly, line, ell, union, eye, mouth, brow, fx, poseTf } = E.prims;

  const HAIR = {
    court: c => path('M-62 -380C-70 -430 -40 -456 0 -456C40 -456 70 -430 62 -380Q50 -404 20 -410Q-10 -400 -40 -408Q-56 -400 -62 -380Z', c),
    chignon: c => path('M-60 -384C-68 -432 -38 -454 0 -454C38 -454 68 -432 60 -384Q40 -414 0 -414Q-40 -414 -60 -384Z', c) + ell(0, -462, 26, 22, c),
    long: c => path('M-66 -300C-80 -380 -64 -456 0 -458C64 -456 80 -380 66 -300Q58 -330 56 -380Q30 -410 0 -410Q-30 -410 -56 -380Q-58 -330 -66 -300Z', c),
    casquette: c => path('M-60 -398C-60 -440 -30 -458 4 -458C40 -458 62 -440 62 -398Z', c) + path('M40 -404H104Q110 -404 106 -396Q100 -390 90 -390H40Z', c),
    chauve: c => line('M-50 -410Q0 -440 50 -410', c, 5, 'opacity=".5"'),
    afro: c => path('M-60 -404Q-40 -430 0 -428Q40 -430 60 -404Q56 -440 0 -446Q-56 -440 -60 -404Z', c),
  };
  const P_EXPR = {
    neutre: { brow: { in: 0, out: 0 }, eye: {}, mouth: 'neutral' },
    panique: { brow: { in: -12, out: -4 }, eye: { pupil: 0.6 }, mouth: 'grimace', fx: ['sweat'] },
    blase: { brow: { in: 2, out: 2, arch: 0 }, eye: { lidTop: 0.5 }, mouth: 'flat' },
    amour: { brow: { in: -6, out: -2 }, eye: { lidBot: 0.3 }, mouth: 'smile', fx: ['blush'] },
    content: { brow: { in: -4, out: -2 }, eye: { lidBot: 0.25 }, mouth: 'smile' },
    rire: { brow: { in: -6, out: -2 }, eye: { lidTop: 1 }, mouth: 'grin' },
    choque: { brow: { in: -14, out: -10 }, eye: { pupil: 0.5 }, mouth: 'o' },
    triste: { brow: { in: -10, out: 6, arch: 2 }, eye: { lidTop: 0.3, lidTilt: -10, look: [0, 0.5] }, mouth: 'sad' },
  };

  // Passant : manteau, tête ronde, 6 coiffures. Hauteur ~ 470 px à l'échelle 1.
  function passant(o = {}) {
    const skin = o.skin || '#E9B48C', coat = o.coat || '#7FB7BE', pants = o.pants || '#4B4E63', hair = o.hair || '#4A3226';
    const lift = o.lift || [0, 0], b = o.bob || 0;
    const ex = P_EXPR[o.expr || 'neutre'];
    let s = `<g transform="${poseTf(o)}">`;
    s += union([{ t: 'cap', x1: -22, y1: -150 + b, x2: -24, y2: -26 - lift[0], w: 36 }, { t: 'cap', x1: 22, y1: -150 + b, x2: 24, y2: -26 - lift[1], w: 36 }], pants);
    for (const [sd, l] of [[-1, lift[0]], [1, lift[1]]])
      s += path(`M${sd * 6} ${-30 - l}H${sd * 34}Q${sd * 52} ${-28 - l} ${sd * 52} ${-12 - l}V${-l}H${sd * 6}Z`, '#2E2F38', 4);
    s += `<g transform="translate(0 ${b})">`;
    const A = o.arms || { l: [10, 8], r: [10, 8] };
    for (const [sd, a] of [[-1, A.l], [1, A.r]]) {
      const L = E.prims.limb(sd * 58, -300, sd, 70, 66, a[0], a[1]);
      s += union([{ t: 'poly', d: `M${sd * 58} -300L${L.E[0]} ${L.E[1]}L${L.W[0]} ${L.W[1]}`, w: 30 }], coat);
      s += ell(L.W[0], L.W[1] + 6, 13, 13, skin);
    }
    s += path('M-48 -318C-64 -316 -72 -304 -72 -286L-66 -150Q-66 -136 -52 -136H52Q66 -136 66 -150L72 -286C72 -304 64 -316 48 -318Z', coat);
    s += line('M0 -312V-140', INK, 3, 'opacity=".35"');
    s += `<g transform="rotate(${o.tilt || 0} 0 -320)">`;
    if (o.hairStyle === 'long') s += HAIR.long(hair);
    if (o.hairStyle === 'afro') s += path('M-80 -350C-108 -400 -92 -480 -30 -488C0 -500 44 -496 66 -474C104 -450 104 -396 80 -350Z', hair);
    const face = 'M0 -452C46 -452 66 -420 66 -384C66 -346 40 -318 0 -318C-40 -318 -66 -346 -66 -384C-66 -420 -46 -452 0 -452Z';
    s += path(face, skin);
    const e = Object.assign({ lidCol: skin }, ex.eye);
    s += eye(-24, -386, 12, 14, e, '#3B2A24', -1) + eye(24, -386, 12, 14, e, '#3B2A24', 1);
    s += brow(-24, -410, -1, 22, ex.brow, hair, 6) + brow(24, -410, 1, 22, ex.brow, hair, 6);
    s += `<g transform="translate(0 -348) scale(.7)">${mouth(o.mouth || ex.mouth)}</g>`;
    if (o.glasses) s += `<g fill="none" stroke="${INK}" stroke-width="5"><circle cx="-24" cy="-386" r="19"/><circle cx="24" cy="-386" r="19"/><path d="M-5 -388H5M-43 -390L-64 -396M43 -390L64 -396"/></g>`;
    if (o.hairStyle !== 'long') s += (HAIR[o.hairStyle || 'court'] || HAIR.court)(hair);
    else s += path('M-56 -380Q-30 -420 0 -418Q30 -420 56 -380Q50 -430 0 -436Q-50 -430 -56 -380Z', hair);
    s += `<g transform="translate(0 -386) scale(.62) translate(0 70)">${fx(ex.fx, 0, -70)}</g>`;
    s += '</g></g></g>';
    return s;
  }

  // Le chat : assis de face, regard vide. o.tail = phase de la queue, o.blink.
  function chat(o = {}) {
    const fur = '#F2A04B', furSh = '#D9822E', light = '#FFE2B8';
    let s = `<g transform="${poseTf(o)}">`;
    const tw = Math.sin(o.tail || 0) * 30;
    s += union([{ t: 'poly', d: `M60 -30Q140 -40 ${150 + tw * 0.4} -120Q${160 + tw} -190 ${120 + tw} -230`, w: 26 }], fur);
    s += path('M-90 -10C-104 -100 -80 -190 0 -196C80 -190 104 -100 90 -10Q88 0 76 0H-76Q-88 0 -90 -10Z', fur);
    s += path('M-40 -10C-50 -80 -30 -140 0 -142C30 -140 50 -80 40 -10Z', light, 0);
    s += union([{ t: 'ell', cx: -40, cy: -10, rx: 28, ry: 16 }, { t: 'ell', cx: 40, cy: -10, rx: 28, ry: 16 }], fur);
    // tête
    s += path('M-96 -300L-104 -400L-50 -352Z', fur) + path('M96 -300L104 -400L50 -352Z', fur);
    s += fillOnly('M-90 -330L-96 -380L-64 -350Z', '#F7B9B0') + fillOnly('M90 -330L96 -380L64 -350Z', '#F7B9B0');
    s += path('M0 -370C70 -370 112 -330 112 -270C112 -214 64 -180 0 -180C-64 -180 -112 -214 -112 -270C-112 -330 -70 -370 0 -370Z', fur);
    s += line('M-20 -362L-14 -330M0 -366V-332M20 -362L14 -330', furSh, 6);
    // yeux ronds et vides (le gag)
    const bl = o.blink || 0;
    for (const sd of [-1, 1]) {
      if (bl > 0.9) s += line(`M${sd * 40 - 16} -276H${sd * 40 + 16}`, INK, 5);
      else s += ell(sd * 40, -276, 16, 16 * (1 - bl), '#FFFFFF') + ell(sd * 40, -276, 5, 5 * (1 - bl), INK, 0);
    }
    s += path('M-10 -244H10L0 -234Z', '#E46F6F', 3);
    s += line('M0 -234Q-10 -222 -20 -226M0 -234Q10 -222 20 -226', INK, 3.5);
    s += line('M-50 -240L-110 -250M-50 -230L-108 -222M50 -240L110 -250M50 -230L108 -222', INK, 3);
    return s + '</g>';
  }

  Object.assign(E, { passant, chat, P_EXPR });
})(typeof window !== 'undefined' ? window : globalThis);
