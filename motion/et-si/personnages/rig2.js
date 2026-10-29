// Rig 2D v2 — un seul constructeur de personnage pour toute la chaîne
// (Léo, Max, passants, héros des « Pourquoi c'est horrible… »).
//
//  - style : aplats + une ombre douce par forme, contour encre, mains « moufle »
//    lisibles, membres souples (courbe qui passe par le coude / le genou) ;
//  - gestes de tout le corps : bras devant / derrière le torse, épaules qui se
//    haussent (shrug), buste qui se penche (lean), bassin (sway), accroupi (crouch),
//    tête qui tourne (turn), s'incline (tilt), hoche (nod) ;
//  - visage très expressif : sourcils, paupières, yeux spéciaux (^^, cœurs,
//    étoiles, spirales), bouches (D, cri, moue, dents serrées…), effets (larmes en
//    torrent, veine, vapeur, front bleu, gouttes, éclats) ; tout est paramétrique et
//    se mélange en douceur (mixExpr).
// Origine locale = entre les pieds, au sol. y vers le bas. Unités = px à l'échelle 1.
(function (root) {
  const INK = '#2B1D24';
  const OL = 5;    // contour
  const IL = 3;    // traits intérieurs
  const r1 = n => Math.round(n * 10) / 10;
  const rad = d => d * Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  let uid = 0;
  const nid = p => p + (++uid).toString(36);

  // ------------------------------------------------------------------ couleurs
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const toHex = a => '#' + a.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const shade = (c, k) => toHex(hex(c).map(v => v * (1 - k)));
  const tint = (c, k) => toHex(hex(c).map(v => v + (255 - v) * k));
  const shadowOf = c => toHex(hex(c).map((v, i) => v * (i === 2 ? 0.86 : 0.8)));

  // ------------------------------------------------------------------ primitives
  const P = (d, fill, sw = OL, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const F = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const L = (d, col = INK, sw = IL, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const E = (cx, cy, rx, ry, fill, sw = 0, extra = '') => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(Math.abs(rx))}" ry="${r1(Math.abs(ry))}" fill="${fill}" ${sw ? `stroke="${INK}" stroke-width="${sw}"` : ''} ${extra}/>`;
  const G = (inner, tf = '', extra = '') => `<g ${tf ? `transform="${tf}"` : ''} ${extra}>${inner}</g>`;

  // Forme ombrée : remplissage + ombre en croissant (bas-droite) + contour.
  function cel(d, fill, o = {}) {
    const c = nid('c'), sh = o.sh || shadowOf(fill);
    const dx = o.dx == null ? 14 : o.dx, dy = o.dy == null ? 10 : o.dy;
    let s = `<clipPath id="${c}"><path d="${d}"/></clipPath>` + F(d, fill) + `<g clip-path="url(#${c})">`;
    if (dx || dy) s += `<path d="M-4000 -4000H4000V4000H-4000Z ${d}" fill-rule="evenodd" fill="${sh}" transform="translate(${-dx} ${-dy})"/>`;
    if (o.inner) s += o.inner;
    s += '</g>';
    return s + (o.sw === 0 ? '' : `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${o.sw || OL}" stroke-linejoin="round"/>`);
  }
  // Membre souple : courbe quadratique qui passe par M (coude), largeur w0 -> w1, bouts arrondis.
  function limbPath(A, M, B, w0, w1) {
    const C = [2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2];
    const n = 16, lt = [], rt = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], y = u * u * A[1] + 2 * u * t * C[1] + t * t * B[1];
      const tx = 2 * u * (C[0] - A[0]) + 2 * t * (B[0] - C[0]), ty = 2 * u * (C[1] - A[1]) + 2 * t * (B[1] - C[1]);
      const len = Math.hypot(tx, ty) || 1, nx = -ty / len, ny = tx / len;
      const w = lerp(w0, w1, t) / 2;
      lt.push([x + nx * w, y + ny * w]); rt.push([x - nx * w, y - ny * w]);
    }
    let d = `M${r1(lt[0][0])} ${r1(lt[0][1])}`;
    for (let i = 1; i <= n; i++) d += `L${r1(lt[i][0])} ${r1(lt[i][1])}`;
    d += `A${r1(w1 / 2)} ${r1(w1 / 2)} 0 0 0 ${r1(rt[n][0])} ${r1(rt[n][1])}`;
    for (let i = n - 1; i >= 0; i--) d += `L${r1(rt[i][0])} ${r1(rt[i][1])}`;
    d += `A${r1(w0 / 2)} ${r1(w0 / 2)} 0 0 0 ${r1(lt[0][0])} ${r1(lt[0][1])}Z`;
    return d;
  }
  const cap = (A, B, w) => limbPath(A, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], B, w, w);
  // IK deux segments (coude / genou). bend +1 / -1 = sens de pliure.
  function ik2(S, l1, l2, T, bend) {
    const dx = T[0] - S[0], dy = T[1] - S[1], D = Math.hypot(dx, dy) || 1;
    const d = Math.max(Math.abs(l1 - l2) + 1, Math.min(l1 + l2 - 0.01, D));
    const base = Math.atan2(dy, dx), a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ang = base + bend * a;
    const W = D > l1 + l2 ? [S[0] + dx / D * (l1 + l2), S[1] + dy / D * (l1 + l2)] : T;
    return { E: [S[0] + Math.cos(ang) * l1, S[1] + Math.sin(ang) * l1], W };
  }
  // bend 'low' : des deux solutions, garde celle dont le coude tombe le plus bas
  function ikArm(S, sp, a, side) {
    if (a.bend === 'low') { const p = ik2(S, sp.arm[0], sp.arm[1], a.at, 1), q = ik2(S, sp.arm[0], sp.arm[1], a.at, -1); return p.E[1] >= q.E[1] ? p : q; }
    return ik2(S, sp.arm[0], sp.arm[1], a.at, (a.bend == null ? 1 : a.bend) * -side);
  }
  // Angles [a1 (0 = bas, + = vers l'extérieur), a2 pliure] -> coude, poignet.
  function fk(S, side, l1, l2, a1, a2) {
    const dir = a => [side * Math.sin(rad(a)), Math.cos(rad(a))];
    const d1 = dir(a1), d2 = dir(a1 + a2);
    const Ep = [S[0] + d1[0] * l1, S[1] + d1[1] * l1];
    return { E: Ep, W: [Ep[0] + d2[0] * l2, Ep[1] + d2[1] * l2] };
  }

  // ------------------------------------------------------------------ mains « moufle » (poignet à l'origine, vers +y)
  // side = côté du bras (-1 gauche de l'écran, +1 droite) : le pouce est vers le corps.
  function hand(type, side, skin, sc = 1, rot = 0, extra = {}) {
    const s = -side; // côté du pouce
    if (type === 'none') return '';
    if (type === 'priere') {
      // main plate vue de profil : bord intérieur (paume) en x = 0, dos de la main vers l'extérieur
      const d = `M0 2C${s * 1} 24 ${s * 0} 50 ${s * 3} 64Q${s * 10} 73 ${s * 17} 64C${s * 23} 46 ${s * 25} 22 ${s * 22} 2Q${s * 11} -4 0 2Z`;
      return G(cel(d, skin, { dx: s * 3, dy: 4, sw: 4.5 }) + L(`M${s * 6} 26Q${s * 8} 42 ${s * 7} 56`, shadowOf(skin), 2.4) + cel(cap([s * 4, 12], [s * 2, 32], 12), skin, { dx: 2, dy: 2, sw: 4 }), `scale(${sc})`);
    }
    if (type === 'phone' || type === 'filme') {
      // le téléphone reste droit quelle que soit la rotation du bras
      const back = type === 'filme', pc = extra.phone || '#2A2D38';
      let ph = cel('M-26 -48H26Q34 -48 34 -40V40Q34 48 26 48H-26Q-34 48 -34 40V-40Q-34 -48 -26 -48Z', pc, { dx: 4, dy: 4, sw: 4.5 });
      if (back) ph += E(-14, -32, 9, 9, '#14161C', 3) + E(-14, -32, 3.5, 3.5, '#6FD3F7') + E(12, -34, 4, 4, extra.rec ? '#FF3B3B' : '#8A8D96') + L('M-8 26H8', '#5A5E6B', 4);
      else ph += F('M-26 -40H26V34H-26Z', extra.screen || '#7FC8F0') + L('M-6 41H6', '#5A5E6B', 3);
      const pal_ = shadowOf(skin);
      return G(G(ph, `rotate(${r1(-rot)}) translate(${s * 2} -20)`) +
        cel(cap([s * 24, 6], [s * 28, 30], 14), skin, { dx: 3, dy: 3, sw: 4 }) + cel(cap([-s * 24, 12], [-s * 26, 34], 13), skin, { dx: 3, dy: 3, sw: 4 }), `scale(${sc})`);
    }
    const sh = shadowOf(skin), o = { dx: 5, dy: 4, sw: 4.5 };
    const fing = (x, y, a, l, w = 15) => cap([x, y], [x + Math.sin(rad(a)) * l, y + Math.cos(rad(a)) * l], w);
    const palm = 'M-20 2Q-28 24 -22 38Q0 48 22 38Q28 24 20 2Q0 -6 -20 2Z';
    let out = '';
    if (type === 'fist' || type === 'point' || type === 'thumb' || type === 'peace') {
      if (type === 'point') out += cel(fing(s * 6, 34, s * 4, 34, 15), skin, o);
      if (type === 'peace') out += cel(fing(s * 9, 34, s * 14, 30, 14), skin, o) + cel(fing(-s * 5, 36, -s * 6, 32, 14), skin, o);
      out += cel('M-21 2C-31 18 -24 48 0 48C24 48 31 18 21 2Q0 -6 -21 2Z', skin, o);
      out += L('M-15 32Q-10 36 -5 32M5 32Q10 36 15 32', sh, 3);
      if (type === 'thumb') out += cel(fing(s * 16, 12, s * 90, 30, 16), skin, o);
      else out += cel(cap([s * 22, 16], [s * 2, 28], 15), skin, o);
      return G(out, `scale(${sc})`);
    }
    if (type === 'open' || type === 'wave' || type === 'claw') {
      const k = type === 'claw' ? 0.7 : 1;
      [[-16, 32, -18, 22], [-5.5, 36, -6, 25], [5.5, 36, 6, 24], [16, 32, 18, 20]].forEach(([x, y, a, l]) => { out += cel(fing(x, y, a * k, l * k), skin, o); });
      out += cel(fing(s * 21, 14, s * 62, 22, 16), skin, o);
      out += cel(palm, skin, o) + L('M-8 22Q0 28 10 20', sh, 2.6, 'opacity=".7"');
      return G(out, `scale(${sc})`);
    }
    // relax : moufle, doigts serrés, pouce le long
    out += cel(fing(s * 20, 12, s * 14, 22, 15), skin, o);
    out += cel('M-20 2Q-29 30 -18 50Q-4 62 12 58Q26 50 24 28Q23 12 20 2Q0 -6 -20 2Z', skin, o);
    out += L('M-8 40Q-6 50 -10 56M5 42Q7 52 3 58', sh, 3);
    return G(out, `scale(${sc})`);
  }

  // ------------------------------------------------------------------ expressions
  const BASE = { bIn: 0, bOut: 0, bUp: 0, lidT: 0, lidB: 0, tilt: 0, pupil: 1, lx: 0, ly: 0, eyeS: 1, happy: 0, closed: 0,
    smile: 0, open: 0, wide: 1, asym: 0, teeth: 0.8, tongue: 0, cheek: 0,
    sweat: 0, tears: 0, stream: 0, winkL: 0, winkR: 0, flush: 0, pale: 0, puff: 0, shock: 0, vein: 0, gloom: 0, steam: 0, sparkle: 0, wet: 0, zzz: 0, q: 0, excl: 0, love: 0,
    eye: '', ms: '' };
  const EXPR = {
    neutre: {},
    content: { bUp: 4, lidB: 0.3, smile: 0.85, open: 0.2, cheek: 0.5 },
    joie: { bUp: 10, happy: 1, smile: 1, open: 0.85, wide: 1.1, cheek: 0.9 },
    rire: { bIn: -4, bUp: 12, happy: 1, smile: 1, open: 1, wide: 1.2, cheek: 1, tongue: 0.7, wet: 1 },
    fier: { bIn: 4, bOut: -6, closed: 1, smile: 0.7, asym: 0.8, cheek: 0.4 },
    surpris: { bIn: -16, bOut: -14, bUp: 16, eyeS: 1.15, pupil: 0.6, open: 0.7, wide: 0.5, smile: 0, teeth: 0, ms: 'o' },
    choque: { bIn: -18, bOut: -10, bUp: 18, eyeS: 1.2, pupil: 0.32, ms: 'scream' },
    triste: { bIn: -16, bOut: 8, lidT: 0.3, tilt: -12, ly: 0.5, smile: -0.8, open: 0.05, wet: 0.8 },
    pleure: { bIn: -18, bOut: 10, closed: 1, tilt: -14, ms: 'wail', stream: 1 },
    enerve: { bIn: 16, bOut: -10, lidT: 0.32, tilt: 16, pupil: 0.8, ms: 'teeth' },
    furieux: { bIn: 22, bOut: -14, lidT: 0.4, tilt: 22, pupil: 0.6, ms: 'scream' },
    gene: { bIn: -10, bOut: 4, lx: 0.85, ly: 0.2, ms: 'wavy', cheek: 1.2 },
    blase: { lidT: 0.55, lx: 0.5, smile: -0.15, wide: 0.75 },
    panique: { bIn: -20, bOut: -6, bUp: 12, eyeS: 1.15, pupil: 0.38, ms: 'teeth', wide: 1.3 },
    determine: { bIn: 12, bOut: -6, lidT: 0.25, tilt: 10, smile: 0.35, asym: 0.9 },
    amoureux: { bIn: -6, bUp: 6, eye: 'coeur', smile: 0.9, open: 0.4, cheek: 1.2 },
    emerveille: { bUp: 12, eye: 'etoile', smile: 0.9, open: 0.8, wide: 1, cheek: 0.6 },
    pense: { bIn: 6, bOut: -8, bUp: 4, lx: 0.6, ly: -0.75, smile: -0.1, asym: -0.8 },
    fatigue: { bIn: 2, bOut: 6, lidT: 0.62, ly: 0.4, smile: -0.2 },
    degoute: { bIn: 10, bOut: -4, lidT: 0.35, lidB: 0.3, tilt: 6, ms: 'beurk', asym: 1, cheek: 0 },
    mefiant: { bIn: 10, bOut: 0, lidT: 0.5, lidB: 0.25, tilt: 8, lx: 0.85, smile: -0.25, asym: -0.6 },
    moqueur: { bIn: 10, bOut: -10, lidT: 0.4, tilt: 8, lx: -0.5, smile: 0.6, asym: 1, open: 0.2 },
    mechant: { bIn: 18, bOut: -12, lidT: 0.38, tilt: 18, pupil: 0.7, ms: 'D', smile: 0.8, teeth: 1 },
    hautain: { bIn: 2, bOut: -12, bUp: 4, lidT: 0.58, ly: -0.4, smile: 0.35, asym: 0.9 },
    peur: { bIn: -18, bOut: -4, bUp: 10, pupil: 0.45, ms: 'wavy', wide: 1.2 },
    timide: { bIn: -8, bOut: 2, lidT: 0.2, ly: 0.6, lx: -0.4, smile: 0.4, open: 0, cheek: 1.3 },
    sonne: { eye: 'spirale', ms: 'wavy', bIn: -6, bOut: 4 },
    vexe: { bIn: 12, bOut: 2, lidT: 0.48, tilt: 10, lx: 0.75, ms: 'pout' },
    touche: { bIn: -10, bOut: 6, lidT: 0.2, tilt: -8, ly: 0.3, smile: 0.35, wet: 1 },
    ok: { bUp: 6, closed: 0, lidB: 0.25, smile: 0.7, asym: 0.4, cheek: 0.4 },
    excite: { bUp: 14, eyeS: 1.12, pupil: 0.9, smile: 1, open: 0.9, ms: 'D', cheek: 0.8, wide: 1.15 },
    honte: { bIn: -10, bOut: 6, lidT: 0.35, ly: 0.8, lx: -0.3, smile: -0.2, cheek: 1, flush: 0.7 },
    jaloux: { bIn: 12, bOut: 0, lidT: 0.45, lidB: 0.2, tilt: 10, lx: 0.9, ms: 'pout', asym: 0 },
    soulage: { bIn: -6, bOut: 6, closed: 1, smile: 0.5, open: 0.1, cheek: 0.3 },
    ennui: { bIn: 0, bOut: 6, lidT: 0.6, ly: 0.2, lx: 0.4, smile: -0.25, wide: 0.7, asym: -0.4 },
    concentre: { bIn: 12, bOut: 2, lidT: 0.3, lidB: 0.2, tilt: 6, ly: 0.3, ms: 'langue' },
    malin: { bIn: 14, bOut: -8, lidT: 0.38, tilt: 10, lx: -0.6, smile: 0.8, asym: 1, open: 0.3, teeth: 1 },
    crie: { bIn: 18, bOut: -12, lidT: 0.2, tilt: 14, ms: 'scream', flush: 0.4 },
    boude: { bIn: 12, bOut: 4, lidT: 0.42, tilt: 6, lx: -0.85, ms: 'pout', puff: 0.6 },
    sanglote: { bIn: -18, bOut: 10, lidT: 0.55, tilt: -14, ly: 0.4, ms: 'wail', wide: 0.8, stream: 0.7, flush: 0.3 },
    ebahi: { bUp: 18, eyeS: 1.25, pupil: 0.7, ms: 'baille', wet: 0.5 },
    genesourire: { bIn: -8, bOut: 4, lx: 0.6, ms: 'grimace', wide: 1.1, cheek: 0.8 },
    clin: { bIn: 2, bOut: -6, winkR: 1, smile: 0.85, open: 0.35, asym: 0.6, cheek: 0.6 },
    langue: { bUp: 6, winkL: 1, ms: 'langue', cheek: 0.4 },
    bisou: { bIn: -4, bUp: 6, closed: 1, ms: 'bisou', cheek: 1 },
    baille: { bIn: -4, bOut: 6, closed: 1, ms: 'baille' },
    pouffe: { bIn: -8, bUp: 8, closed: 1, ms: 'pouffe', puff: 0.9, flush: 0.5, cheek: 1 },
    rouge: { bIn: 22, bOut: -14, lidT: 0.42, tilt: 22, pupil: 0.6, ms: 'teeth', flush: 1 },
    malade: { bIn: -8, bOut: 6, lidT: 0.4, ly: 0.3, ms: 'wavy', pale: 1 },
    terrifie: { bIn: -22, bOut: -8, bUp: 20, eyeS: 1.25, pupil: 0.28, ms: 'scream', pale: 0.6 },
    ravi: { bUp: 12, happy: 1, smile: 1, open: 0.5, cheek: 1, ms: '' },
    supplie: { bIn: -18, bOut: 6, bUp: 6, eyeS: 1.16, pupil: 1.28, ly: -0.5, wet: 1, ms: 'pout', cheek: 0.6 },
  };
  function expr(name, over) { return Object.assign({}, BASE, EXPR[name] || {}, over || {}); }
  function mixExpr(a, b, k) {
    const A = typeof a === 'string' ? expr(a) : Object.assign({}, BASE, a), B = typeof b === 'string' ? expr(b) : Object.assign({}, BASE, b), out = {};
    for (const n in BASE) out[n] = typeof BASE[n] === 'string' ? (k < 0.5 ? A[n] : B[n]) : lerp(A[n], B[n], k);
    return out;
  }

  const STAR5 = r => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + r1(Math.cos(a) * q) + ' ' + r1(Math.sin(a) * q); } return d + 'Z'; };
  const HEART = r => `M0 ${r1(r * 0.9)}C${r1(-r * 1.3)} ${r1(-r * 0.1)} ${r1(-r * 0.7)} ${r1(-r * 1.1)} 0 ${r1(-r * 0.45)}C${r1(r * 0.7)} ${r1(-r * 1.1)} ${r1(r * 1.3)} ${r1(-r * 0.1)} 0 ${r1(r * 0.9)}Z`;

  // œil (centré en 0,0)
  function eye(rx0, ry0, f, iris, side, skin, lash, blink) {
    const rx = rx0 * f.eyeS, ry = ry0 * f.eyeS;
    const bl = clamp(blink || 0);
    if (f.happy > 0.5) return L(`M${r1(-rx)} ${r1(ry * 0.25)}Q0 ${r1(-ry * 0.75)} ${r1(rx)} ${r1(ry * 0.25)}`, INK, OL + 2);
    if (f.closed > 0.5 || bl > 0.92) return L(`M${r1(-rx)} ${r1(-ry * 0.05)}Q0 ${r1(ry * 0.5)} ${r1(rx)} ${r1(-ry * 0.05)}`, INK, OL + 1.5) + (lash ? L(`M${r1(side * rx)} ${r1(-ry * 0.05)}l${side * 10} -6`, INK, 4) : '');
    if (f.eye === 'x') return L(`M${-rx * 0.6} ${-ry * 0.5}L${rx * 0.6} ${ry * 0.5}M${rx * 0.6} ${-ry * 0.5}L${-rx * 0.6} ${ry * 0.5}`, INK, OL + 2);
    const c = nid('e'), g = nid('g');
    const lt = clamp(Math.max(f.lidT, bl)), lb = clamp(f.lidB), tilt = f.tilt * side;
    const ix = f.lx * rx * 0.4, iy = f.ly * ry * 0.34, ps = f.pupil;
    let s = `<radialGradient id="${g}" cx="45%" cy="38%" r="65%"><stop offset="0" stop-color="${tint(iris, 0.4)}"/><stop offset=".75" stop-color="${iris}"/><stop offset="1" stop-color="${shade(iris, 0.4)}"/></radialGradient>`;
    s += `<clipPath id="${c}"><ellipse cx="0" cy="0" rx="${r1(rx)}" ry="${r1(ry)}"/></clipPath>`;
    s += E(0, 0, rx, ry, '#FFFFFF') + `<g clip-path="url(#${c})">`;
    s += F(`M${r1(-rx)} ${r1(-ry * 0.25)}Q0 ${r1(-ry * 1.15)} ${r1(rx)} ${r1(-ry * 0.25)}V${r1(-ry - 4)}H${r1(-rx)}Z`, '#E2DCEB');
    if (f.eye === 'coeur') s += P(HEART(rx * 0.72), '#F0435E', 3, `transform="translate(${r1(ix)} ${r1(iy + 2)})"`) + E(ix - rx * 0.22, iy - ry * 0.2, rx * 0.14, ry * 0.1, '#FFFFFF');
    else if (f.eye === 'etoile') s += P(STAR5(rx * 0.8), '#FFC83D', 3, `transform="translate(${r1(ix)} ${r1(iy + 2)})"`);
    else if (f.eye === 'spirale') { let d = ''; for (let i = 0; i <= 40; i++) { const a = i * 0.5, q = i / 40 * rx * 0.8; d += (i ? 'L' : 'M') + r1(Math.cos(a) * q) + ' ' + r1(Math.sin(a) * q); } s += L(d, INK, 4); }
    else {
      s += E(ix, iy, rx * 0.7 * ps, ry * 0.66 * ps, `url(#${g})`) + E(ix, iy, rx * 0.7 * ps, ry * 0.66 * ps, 'none', 2);
      s += E(ix, iy + 1, rx * 0.36 * ps, ry * 0.34 * ps, '#160C12');
      s += E(ix + rx * 0.24, iy - ry * 0.24, rx * 0.22, ry * 0.18, '#FFFFFF') + E(ix - rx * 0.22, iy + ry * 0.24, rx * 0.09, ry * 0.08, '#FFFFFF');
      if (f.wet > 0.05) s += E(ix - rx * 0.05, iy + ry * 0.36, rx * 0.4, ry * 0.08, '#FFFFFF', 0, `opacity="${r1(f.wet * 0.8 * 100) / 100}"`) + E(ix + rx * 0.3, iy + ry * 0.05, rx * 0.1, ry * 0.08, '#FFFFFF', 0, `opacity="${r1(f.wet * 100) / 100}"`);
    }
    const top = -ry + lt * ry * 2.0, bot = ry - lb * ry * 1.3, tA = top - tilt * 0.5, tB = top + tilt * 0.5;
    if (lt > 0.01) s += F(`M${r1(-rx - 8)} ${r1(-ry - 40)}H${r1(rx + 8)}V${r1(tB)}Q0 ${r1((tA + tB) / 2 + 5)} ${r1(-rx - 8)} ${r1(tA)}Z`, skin) + L(`M${r1(rx + 8)} ${r1(tB)}Q0 ${r1((tA + tB) / 2 + 5)} ${r1(-rx - 8)} ${r1(tA)}`, INK, OL + 1);
    if (lb > 0.01) s += F(`M${r1(-rx - 8)} ${r1(ry + 40)}H${r1(rx + 8)}V${r1(bot)}Q0 ${r1(bot - 6)} ${r1(-rx - 8)} ${r1(bot)}Z`, skin) + L(`M${r1(rx + 8)} ${r1(bot)}Q0 ${r1(bot - 6)} ${r1(-rx - 8)} ${r1(bot)}`, INK, IL);
    s += '</g>';
    s += `<path d="M${r1(-rx)} 0A${r1(rx)} ${r1(ry)} 0 0 1 ${r1(rx)} 0" fill="none" stroke="${INK}" stroke-width="${lt > 0.01 ? IL : OL + 1.5}" stroke-linecap="round"/>`;
    s += `<path d="M${r1(-rx)} 0A${r1(rx)} ${r1(ry)} 0 0 0 ${r1(rx)} 0" fill="none" stroke="${INK}" stroke-width="${IL}"/>`;
    if (lash && lt < 0.7) { const yy = lt > 0.01 ? (side > 0 ? tB : tA) : -ry * 0.5; s += L(`M${r1(side * rx * 0.96)} ${r1(yy)}l${side * 12} -9M${r1(side * rx * 0.86)} ${r1(yy - 8)}l${side * 9} -10`, INK, 4); }
    return s;
  }
  // sourcil épais arrondi
  function brow(side, len, f, col, th) {
    const iy = f.bIn - f.bUp, oy = f.bOut - f.bUp;
    const ix = -side * len * 0.48, ox = side * len * 0.52;
    const my = Math.min(iy, oy) - 6 + Math.max(0, f.bIn) * 0.25;
    return L(`M${r1(ix)} ${r1(iy)}Q${r1((ix + ox) / 2)} ${r1(my)} ${r1(ox)} ${r1(oy)}`, col, th);
  }
  // bouche (centrée 0,0)
  function mouth(f, W, inCol = '#5A1A27') {
    const filled = (d, teeth, tongue, tTop) => {
      const c = nid('m');
      let s = `<clipPath id="${c}"><path d="${d}"/></clipPath>` + F(d, inCol) + `<g clip-path="url(#${c})">`;
      if (teeth) s += F(`M-200 -200H200V${r1(tTop)}H-200Z`, '#FFFFFF');
      if (tongue) s += E(0, tongue[0], tongue[1], tongue[2], '#E5636B');
      return s + '</g>' + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${OL - 0.5}" stroke-linejoin="round"/>`;
    };
    const w = W * f.wide;
    switch (f.ms) {
      case 'o': return filled(`M0 ${-W * 0.3}C${W * 0.4} ${-W * 0.3} ${W * 0.46} ${W * 0.1} ${W * 0.42} ${W * 0.3}C${W * 0.36} ${W * 0.62} ${-W * 0.36} ${W * 0.62} ${-W * 0.42} ${W * 0.3}C${-W * 0.46} ${W * 0.1} ${-W * 0.4} ${-W * 0.3} 0 ${-W * 0.3}Z`, false, [W * 0.45, W * 0.26, W * 0.14]);
      case 'scream': return filled(`M0 ${-W * 0.35}C${W * 0.62} ${-W * 0.35} ${W * 0.7} ${W * 0.4} ${W * 0.55} ${W * 1.05}C${W * 0.4} ${W * 1.5} ${-W * 0.4} ${W * 1.5} ${-W * 0.55} ${W * 1.05}C${-W * 0.7} ${W * 0.4} ${-W * 0.62} ${-W * 0.35} 0 ${-W * 0.35}Z`, true, [W * 1.15, W * 0.42, W * 0.24], -W * 0.18);
      case 'wail': return filled(`M${-W * 0.9} ${W * 0.3}Q0 ${-W * 0.5} ${W * 0.9} ${W * 0.3}Q${W * 0.6} ${W * 1.1} 0 ${W * 1.1}Q${-W * 0.6} ${W * 1.1} ${-W * 0.9} ${W * 0.3}Z`, true, [W * 0.95, W * 0.45, W * 0.22], -W * 0.05);
      case 'D': return filled(`M${-w} ${-W * 0.1}Q0 ${-W * 0.2} ${w} ${-W * 0.1}Q${w * 0.8} ${W * 1.0} 0 ${W * 1.0}Q${-w * 0.8} ${W * 1.0} ${-w} ${-W * 0.1}Z`, true, [W * 0.9, W * 0.5, W * 0.2], W * 0.12);
      case 'teeth': { const d = `M${-w} ${-W * 0.22}Q0 ${-W * 0.3} ${w} ${-W * 0.22}Q${w + 6} 0 ${w} ${W * 0.26}Q0 ${W * 0.34} ${-w} ${W * 0.26}Q${-w - 6} 0 ${-w} ${-W * 0.22}Z`; return F(d, '#FFFFFF') + L(`M${-w + 4} 0H${w - 4}` + [-0.5, 0, 0.5].map(k => `M${r1(w * k)} ${-W * 0.26}V${W * 0.3}`).join(''), INK, 2.4, 'opacity=".55"') + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${OL - 0.5}"/>`; }
      case 'wavy': return L(`M${-w} 0q${w / 4} ${-W * 0.22} ${w / 2} 0t${w / 2} 0t${w / 2} 0t${w / 2} 0`, INK, OL);
      case 'pout': return P(`M${-W * 0.2} ${W * 0.05}Q0 ${-W * 0.22} ${W * 0.2} ${W * 0.05}Q0 ${W * 0.24} ${-W * 0.2} ${W * 0.05}Z`, '#C94A5A', 4);
      case 'bisou': return P(`M${-W * 0.16} 0Q${-W * 0.3} ${-W * 0.3} 0 ${-W * 0.2}Q${W * 0.3} ${-W * 0.3} ${W * 0.16} 0Q${W * 0.3} ${W * 0.3} 0 ${W * 0.22}Q${-W * 0.3} ${W * 0.3} ${-W * 0.16} 0Z`, '#D9506A', 4) + L(`M${-W * 0.1} 0H${W * 0.1}`, INK, 2.5);
      case 'langue': return L(`M${-w} ${-W * 0.05}Q0 ${W * 0.25} ${w} ${-W * 0.1}`, INK, OL) + P(`M${-W * 0.32} ${W * 0.08}Q${-W * 0.34} ${W * 0.75} 0 ${W * 0.78}Q${W * 0.34} ${W * 0.75} ${W * 0.32} ${W * 0.08}Z`, '#E5636B', 4) + L(`M0 ${W * 0.2}V${W * 0.52}`, '#B8404B', 3);
      case 'baille': return filled(`M0 ${-W * 0.45}C${W * 0.55} ${-W * 0.45} ${W * 0.6} ${W * 0.6} ${W * 0.4} ${W * 1.2}C${W * 0.25} ${W * 1.5} ${-W * 0.25} ${W * 1.5} ${-W * 0.4} ${W * 1.2}C${-W * 0.6} ${W * 0.6} ${-W * 0.55} ${-W * 0.45} 0 ${-W * 0.45}Z`, false, [W * 1.2, W * 0.36, W * 0.2]);
      case 'pouffe': return L(`M${-w * 0.7} 0Q0 ${-W * 0.12} ${w * 0.7} 0`, INK, OL) + L(`M${-w * 0.7} 0q-4 -4 -2 -9M${w * 0.7} 0q4 -4 2 -9`, INK, IL);
      case 'grimace': { const d = `M${-w * 1.1} ${-W * 0.05}Q${-w * 0.5} ${-W * 0.35} 0 ${-W * 0.1}Q${w * 0.5} ${W * 0.15} ${w * 1.1} ${-W * 0.25}Q${w * 0.9} ${W * 0.3} 0 ${W * 0.3}Q${-w * 0.9} ${W * 0.4} ${-w * 1.1} ${-W * 0.05}Z`; return F(d, '#FFFFFF') + L(`M${-w} ${W * 0.08}H${w}` + [-0.5, 0, 0.5].map(k => `M${r1(w * k)} ${-W * 0.25}V${W * 0.32}`).join(''), INK, 2.2, 'opacity=".5"') + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${OL - 0.5}" stroke-linejoin="round"/>`; }
      case 'beurk': return filled(`M${-w} ${W * 0.1}Q${-w * 0.3} ${-W * 0.25} 0 0Q${w * 0.4} ${W * 0.25} ${w} ${-W * 0.05}Q${w * 0.6} ${W * 0.5} 0 ${W * 0.45}Q${-w * 0.6} ${W * 0.5} ${-w} ${W * 0.1}Z`, false, [W * 0.55, W * 0.3, W * 0.18]);
    }
    const sm = f.smile, op = f.open, as = f.asym;
    const cL = [-w, -sm * W * 0.32 - as * W * 0.18], cR = [w, -sm * W * 0.32 + as * W * 0.18];
    if (op < 0.06) {
      const ctl = sm * W * 0.48 + 2;
      let s = L(`M${r1(cL[0])} ${r1(cL[1])}Q0 ${r1(ctl)} ${r1(cR[0])} ${r1(cR[1])}`, INK, OL);
      if (sm > 0.45) s += L(`M${r1(cL[0] - 3)} ${r1(cL[1] + 6)}q-4 -6 -2 -12M${r1(cR[0] + 3)} ${r1(cR[1] + 6)}q4 -6 2 -12`, INK, IL);
      return s;
    }
    const up = Math.min(cL[1], cR[1]) * 0.2 + sm * 3, lo = Math.max(cL[1], cR[1]) + W * 0.25 + op * W * 1.05 + Math.max(0, sm) * W * 0.3;
    const d = `M${r1(cL[0])} ${r1(cL[1])}Q0 ${r1(up)} ${r1(cR[0])} ${r1(cR[1])}Q${r1(w * 0.75)} ${r1(lo)} 0 ${r1(lo)}Q${r1(-w * 0.75)} ${r1(lo)} ${r1(cL[0])} ${r1(cL[1])}Z`;
    return filled(d, f.teeth > 0.05, [lo - W * 0.06, w * 0.6, W * (0.18 + f.tongue * 0.2)], up + f.teeth * W * 0.28);
  }
  // effets (repère tête, rayon R)
  function fxLayer(f, R, fx, t) {
    let s = '';
    const op = v => `opacity="${r1(clamp(v) * 100) / 100}"`;
    if (f.cheek > 0.05) for (const sd of [-1, 1]) s += E(fx + sd * R * 0.6, R * 0.32, R * 0.18, R * 0.1, '#F06A6A', 0, op(f.cheek * 0.45));
    if (f.flush > 0.05) { const g = nid('fl'); s += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E5303F" stop-opacity="0"/><stop offset=".5" stop-color="#E5303F" stop-opacity=".55"/><stop offset="1" stop-color="#E5303F" stop-opacity=".7"/></linearGradient>`; s += F(`M${-R * 1.1} ${-R * 0.4}H${R * 1.1}V${R * 1.1}H${-R * 1.1}Z`, `url(#${g})`, op(f.flush)); }
    if (f.pale > 0.05) s += F(`M${-R * 1.1} ${-R * 1.1}H${R * 1.1}V${R * 1.1}H${-R * 1.1}Z`, '#7FC79A', op(f.pale * 0.45));
    if (f.gloom > 0.05) { const g = nid('gl'); s += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6B4FB8" stop-opacity=".75"/><stop offset="1" stop-color="#6B4FB8" stop-opacity="0"/></linearGradient>`; s += F(`M${-R} ${-R * 0.95}H${R}V${-R * 0.15}H${-R}Z`, `url(#${g})`, op(f.gloom)); }
    return s;
  }
  function fxOver(f, R, fx, t) {
    let s = '';
    const op = v => `opacity="${r1(clamp(v) * 100) / 100}"`;
    if (f.sweat > 0.05) s += P(`M${r1(R * 0.95)} ${r1(-R * 0.7)}q22 30 0 44q-22 -14 0 -44z`, '#9FDCF7', 4, op(f.sweat)) + E(R * 0.92, -R * 0.52, 4, 6, '#FFFFFF', 0, op(f.sweat));
    if (f.stream > 0.05) for (const sd of [-1, 1]) { const x = fx + sd * R * 0.4, w = Math.sin((t || 0) * 18 + sd) * 4; s += P(`M${r1(x - 10)} ${r1(R * 0.12)}Q${r1(x - 14 + w)} ${r1(R * 0.6)} ${r1(x - 6)} ${r1(R * 1.05)}L${r1(x + 12)} ${r1(R * 1.05)}Q${r1(x + 10 + w)} ${r1(R * 0.6)} ${r1(x + 10)} ${r1(R * 0.12)}Z`, '#8FD3F5', 3.5, op(f.stream * 0.95)); }
    if (f.tears > 0.05) for (const sd of [-1, 1]) s += P(`M${r1(fx + sd * R * 0.42)} ${r1(R * 0.2)}q-8 22 0 32q8 -10 0 -32z`, '#9FDCF7', 3, op(f.tears));
    if (f.shock > 0.05) s += L(`M${-R * 1.12} ${-R * 0.85}l-26 -20M${-R * 1.22} ${-R * 0.4}l-30 -4M${R * 1.12} ${-R * 0.85}l26 -20M${R * 1.22} ${-R * 0.4}l30 -4`, INK, 6, op(f.shock));
    if (f.vein > 0.05) s += L(`M${r1(R * 0.42)} ${r1(-R * 0.82)}l12 12m8 -14l-12 12m-12 12l12 -12m16 8l-12 -12`, '#E53B4B', 6, op(f.vein));
    if (f.gloom > 0.05) { let d = ''; for (let i = -2; i <= 2; i++) d += `M${r1(fx + i * R * 0.24)} ${r1(-R * 0.9)}v${r1(R * 0.36)}`; s += L(d, '#4A3590', 4, op(f.gloom * 0.8)); }
    if (f.steam > 0.05) for (const sd of [-1, 1]) { const k = ((t || 0) * 1.6 + (sd > 0 ? 0.5 : 0)) % 1; s += G(E(0, 0, 26, 18, '#FFFFFF', 4) + E(18, -14, 18, 14, '#FFFFFF', 4), `translate(${r1(sd * R * (1.0 + k * 0.4))} ${r1(-R * (0.9 + k * 0.5))}) scale(${r1((0.6 + k * 0.6) * 100) / 100})`, op(f.steam * (1 - k))); }
    if (f.sparkle > 0.05) for (const [x, y, r] of [[-1.15, -0.7, 16], [1.2, -0.3, 12], [1.0, -1.0, 10]]) s += P(`M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z`, '#FFE27A', 2.5, `transform="translate(${r1(x * R)} ${r1(y * R)}) rotate(${r1((t || 0) * 60)})" ${op(f.sparkle)}`);
    if (f.love > 0.05) for (const [x, y, r] of [[-1.1, -0.9, 14], [1.15, -0.6, 11]]) s += P(HEART(r), '#F0435E', 3, `transform="translate(${r1(x * R)} ${r1(y * R - Math.sin((t || 0) * 3) * 8)})" ${op(f.love)}`);
    if (f.zzz > 0.05) s += `<text x="${r1(R * 0.9)}" y="${r1(-R * 0.9)}" font-family="Anton" font-size="${r1(R * 0.4)}" fill="#FFFFFF" stroke="${INK}" stroke-width="5" paint-order="stroke" ${op(f.zzz)}>z<tspan font-size="${r1(R * 0.3)}" dy="-14">z</tspan></text>`;
    if (f.q > 0.05) s += `<text x="${r1(R * 0.85)}" y="${r1(-R * 0.85)}" font-family="Anton" font-size="${r1(R * 0.62)}" fill="#FFE27A" stroke="${INK}" stroke-width="6" paint-order="stroke" ${op(f.q)}>?</text>`;
    if (f.excl > 0.05) s += `<text x="${r1(R * 0.85)}" y="${r1(-R * 0.85)}" font-family="Anton" font-size="${r1(R * 0.62)}" fill="#FF5C5C" stroke="${INK}" stroke-width="6" paint-order="stroke" ${op(f.excl)}>!</text>`;
    return s;
  }

  // ------------------------------------------------------------------ cheveux (repère tête, rayon R)
  const HAIR = {
    leo: {
      back: (R, c) => P(`M${-R * 1.04} ${R * 0.2}C${-R * 1.16} ${-R * 0.6} ${-R * 0.82} ${-R * 1.22} 0 ${-R * 1.2}C${R * 0.82} ${-R * 1.22} ${R * 1.16} ${-R * 0.6} ${R * 1.04} ${R * 0.2}Z`, c),
      front: (R, c, sw) => cel(`M${-R * 1.03} ${R * 0.12}C${-R * 1.1} ${-R * 0.55} ${-R * 0.82} ${-R * 1.1} ${-R * 0.12} ${-R * 1.14}C${R * 0.6} ${-R * 1.18} ${R * 1.08} ${-R * 0.74} ${R * 1.03} ${R * 0.1}` +
        `C${R * 0.96} ${-R * 0.18} ${R * 0.88} ${-R * 0.32} ${R * 0.74} ${-R * 0.4}C${R * 0.74} ${-R * 0.3} ${R * 0.64} ${-R * 0.26} ${R * 0.54} ${-R * 0.3}C${R * 0.52} ${-R * 0.46} ${R * 0.42} ${-R * 0.56} ${R * 0.28} ${-R * 0.6}C${R * 0.26} ${-R * 0.46} ${R * 0.14} ${-R * 0.4} ${R * 0.0} ${-R * 0.42}` +
        `C${-R * 0.02} ${-R * 0.56} ${-R * 0.12} ${-R * 0.64} ${-R * 0.24} ${-R * 0.66}C${-R * 0.26} ${-R * 0.5} ${-R * 0.38} ${-R * 0.44} ${-R * 0.5} ${-R * 0.46}C${-R * 0.54} ${-R * 0.6} ${-R * 0.64} ${-R * 0.64} ${-R * 0.74} ${-R * 0.62}C${-R * 0.76} ${-R * 0.44} ${-R * 0.84} ${-R * 0.3} ${-R * 0.92} ${-R * 0.22}C${-R * 0.96} ${-R * 0.08} ${-R * 1.0} ${R * 0.02} ${-R * 1.03} ${R * 0.12}Z`, c, { dx: 10, dy: 10 }) +
        G(cel(`M0 0C-8 -36 16 -70 50 -70C32 -56 28 -38 38 -22C48 -38 66 -46 84 -40C64 -32 52 -14 50 2Z`, c, { dx: 6, dy: 5 }), `translate(${r1(-R * 0.08)} ${r1(-R * 1.08)}) rotate(${r1(sw || 0)})`) +
        L(`M${-R * 0.6} ${-R * 0.95}Q${-R * 0.22} ${-R * 1.08} ${R * 0.22} ${-R * 1.02}`, tint(c, 0.28), 7) },
    max: {
      back: (R, c) => P(`M${-R * 0.98} ${-R * 0.05}C${-R * 1.04} ${-R * 0.7} ${-R * 0.7} ${-R * 1.12} 0 ${-R * 1.1}C${R * 0.7} ${-R * 1.12} ${R * 1.04} ${-R * 0.7} ${R * 0.98} ${-R * 0.05}Z`, shade(c, 0.28)),
      front: (R, c, sw) => cel(`M${-R * 0.96} ${-R * 0.25}C${-R * 1.06} ${-R * 0.9} ${-R * 0.6} ${-R * 1.4} ${R * 0.12} ${-R * 1.42}C${R * 0.72} ${-R * 1.44} ${R * 1.28} ${-R * 1.22} ${R * (1.46 + (sw || 0) * 0.01)} ${-R * 0.9}` +
        `C${R * 1.24} ${-R * 0.98} ${R * 1.08} ${-R * 0.94} ${R * 0.98} ${-R * 0.84}C${R * 1.0} ${-R * 0.6} ${R * 0.98} ${-R * 0.38} ${R * 0.96} ${-R * 0.25}Q${R * 0.72} ${-R * 0.7} ${R * 0.2} ${-R * 0.66}Q${-R * 0.3} ${-R * 0.68} ${-R * 0.62} ${-R * 0.52}Q${-R * 0.86} ${-R * 0.42} ${-R * 0.96} ${-R * 0.25}Z`, c, { dx: 10, dy: 10 }) +
        L(`M${-R * 0.48} ${-R * 1.16}Q${R * 0.2} ${-R * 1.36} ${R * 1.0} ${-R * 1.1}`, shade(c, 0.22), 6) + L(`M${-R * 0.28} ${-R * 0.98}Q${R * 0.3} ${-R * 1.12} ${R * 0.9} ${-R * 0.96}`, tint(c, 0.4), 5) },
    court: { front: (R, c) => cel(`M${-R * 0.99} ${-R * 0.05}C${-R * 1.05} ${-R * 0.8} ${-R * 0.6} ${-R * 1.14} 0 ${-R * 1.14}C${R * 0.6} ${-R * 1.14} ${R * 1.05} ${-R * 0.8} ${R * 0.99} ${-R * 0.05}C${R * 0.9} ${-R * 0.42} ${R * 0.6} ${-R * 0.58} ${R * 0.3} ${-R * 0.56}C${R * 0.1} ${-R * 0.5} ${-R * 0.2} ${-R * 0.64} ${-R * 0.5} ${-R * 0.58}C${-R * 0.8} ${-R * 0.5} ${-R * 0.94} ${-R * 0.3} ${-R * 0.99} ${-R * 0.05}Z`, c, { dx: 10, dy: 8 }) },
    afro: { back: (R, c) => { let d = ''; const n = 18; for (let i = 0; i <= n; i++) { const a = Math.PI * 0.92 + i / n * Math.PI * 1.16, q = R * (1.36 + 0.07 * Math.sin(i * 2.6)); d += (i ? 'L' : 'M') + r1(Math.cos(a) * q) + ' ' + r1(Math.sin(a) * q * 0.96 - R * 0.22); } return cel(d + 'Z', c, { dx: 14, dy: 12 }); },
      front: (R, c) => F(`M${-R * 0.95} ${-R * 0.2}C${-R * 0.8} ${-R * 0.62} ${-R * 0.4} ${-R * 0.72} 0 ${-R * 0.7}C${R * 0.4} ${-R * 0.72} ${R * 0.8} ${-R * 0.62} ${R * 0.95} ${-R * 0.2}V${-R * 1.0}H${-R * 0.95}Z`, c) + L(`M${-R * 0.95} ${-R * 0.2}C${-R * 0.8} ${-R * 0.62} ${-R * 0.4} ${-R * 0.72} 0 ${-R * 0.7}C${R * 0.4} ${-R * 0.72} ${R * 0.8} ${-R * 0.62} ${R * 0.95} ${-R * 0.2}`, INK, IL) },
    boucles: { back: (R, c) => { let s = ''; for (let i = 0; i < 10; i++) { const a = Math.PI * 0.95 + i / 9 * Math.PI * 1.1; s += E(Math.cos(a) * R * 1.0, Math.sin(a) * R * 1.0 - R * 0.08, R * 0.32, R * 0.3, c, OL); } return s; },
      front: (R, c) => { let s = ''; for (let i = 0; i < 6; i++) { const x = -R * 0.68 + i * R * 0.27, y = -R * (0.6 + 0.08 * Math.sin(i * 1.7)); s += cel(`M${r1(x - R * 0.2)} ${r1(y)}a${r1(R * 0.2)} ${r1(R * 0.19)} 0 1 1 ${r1(R * 0.4)} 0a${r1(R * 0.2)} ${r1(R * 0.19)} 0 1 1 ${r1(-R * 0.4)} 0Z`, c, { dx: 5, dy: 4, sw: 4 }); } return s; } },
    long: { back: (R, c) => cel(`M${-R * 1.1} ${R * 1.55}C${-R * 1.32} ${R * 0.3} ${-R * 1.2} ${-R * 1.18} 0 ${-R * 1.18}C${R * 1.2} ${-R * 1.18} ${R * 1.32} ${R * 0.3} ${R * 1.1} ${R * 1.55}Q${R * 0.8} ${R * 1.66} ${R * 0.55} ${R * 1.45}H${-R * 0.55}Q${-R * 0.8} ${R * 1.66} ${-R * 1.1} ${R * 1.55}Z`, c, { dx: 14, dy: 10 }),
      front: (R, c) => cel(`M${-R * 1.02} ${R * 0.3}C${-R * 1.08} ${-R * 0.7} ${-R * 0.62} ${-R * 1.12} 0 ${-R * 1.12}C${R * 0.62} ${-R * 1.12} ${R * 1.08} ${-R * 0.7} ${R * 1.02} ${R * 0.3}C${R * 0.92} ${-R * 0.2} ${R * 0.7} ${-R * 0.5} ${R * 0.36} ${-R * 0.6}C${R * 0.1} ${-R * 0.5} ${-R * 0.1} ${-R * 0.66} ${-R * 0.36} ${-R * 0.64}C${-R * 0.7} ${-R * 0.5} ${-R * 0.94} ${-R * 0.2} ${-R * 1.02} ${R * 0.3}Z`, c, { dx: 10, dy: 8 }) },
    queue: { back: (R, c, sw) => G(cel(`M0 0C${R * 0.5} ${R * 0.1} ${R * 0.72} ${R * 0.7} ${R * 0.42} ${R * 1.32}C${R * 0.22} ${R * 0.9} ${R * 0.1} ${R * 0.5} 0 ${R * 0.3}Z`, c, { dx: 8, dy: 6 }), `translate(${r1(R * 0.62)} ${r1(-R * 0.72)}) rotate(${r1(sw || 0)})`), front: (R, c) => HAIR.court.front(R, c) },
    chignon: { back: (R, c) => cel(`M${-R * 0.42} ${-R * 1.24}a${R * 0.42} ${R * 0.38} 0 1 0 ${R * 0.84} 0a${R * 0.42} ${R * 0.38} 0 1 0 ${-R * 0.84} 0Z`, c, { dx: 8, dy: 6 }),
      front: (R, c) => cel(`M${-R * 0.99} ${-R * 0.05}C${-R * 1.05} ${-R * 0.8} ${-R * 0.6} ${-R * 1.12} 0 ${-R * 1.12}C${R * 0.6} ${-R * 1.12} ${R * 1.05} ${-R * 0.8} ${R * 0.99} ${-R * 0.05}Q${R * 0.7} ${-R * 0.7} 0 ${-R * 0.72}Q${-R * 0.7} ${-R * 0.7} ${-R * 0.99} ${-R * 0.05}Z`, c, { dx: 10, dy: 8 }) + L(`M${-R * 0.5} ${-R * 0.92}Q0 ${-R * 1.02} ${R * 0.5} ${-R * 0.92}`, shade(c, 0.25), 4) },
    tresses: { back: (R, c, sw) => [-1, 1].map(sd => { let s = ''; for (let i = 0; i < 4; i++) s += E(sd * R * 1.02 + Math.sin(rad(sw || 0)) * i * 6, R * 0.22 + i * R * 0.3, R * 0.2, R * 0.19, c, OL - 1); return s + E(sd * R * 1.02, R * 1.38, R * 0.1, R * 0.08, '#F0435E', 3); }).join(''), front: (R, c) => HAIR.court.front(R, c) },
    hijab: { back: (R, c) => cel(`M${-R * 1.28} ${R * 1.7}C${-R * 1.46} ${R * 0.2} ${-R * 1.32} ${-R * 1.32} 0 ${-R * 1.32}C${R * 1.32} ${-R * 1.32} ${R * 1.46} ${R * 0.2} ${R * 1.28} ${R * 1.7}Z`, c, { dx: 16, dy: 12 }),
      front: (R, c) => P(`M${-R * 1.08} ${R * 0.7}C${-R * 1.14} ${-R * 0.92} ${-R * 0.62} ${-R * 1.18} 0 ${-R * 1.18}C${R * 0.62} ${-R * 1.18} ${R * 1.14} ${-R * 0.92} ${R * 1.08} ${R * 0.7}C${R * 1.0} ${-R * 0.5} ${R * 0.62} ${-R * 0.86} 0 ${-R * 0.86}C${-R * 0.62} ${-R * 0.86} ${-R * 1.0} ${-R * 0.5} ${-R * 1.08} ${R * 0.7}Z`, c) + L(`M${-R * 0.98} ${R * 0.24}C${-R * 0.9} ${-R * 0.6} ${-R * 0.5} ${-R * 0.94} 0 ${-R * 0.94}`, shade(c, 0.2), 4) },
    casquette: { front: (R, c) => cel(`M${-R * 1.01} ${-R * 0.32}C${-R * 1.01} ${-R * 0.95} ${-R * 0.55} ${-R * 1.2} 0 ${-R * 1.2}C${R * 0.55} ${-R * 1.2} ${R * 1.01} ${-R * 0.95} ${R * 1.01} ${-R * 0.32}Z`, c, { dx: 12, dy: 8 }) +
        cel(`M${-R * 1.06} ${-R * 0.36}Q0 ${-R * 0.5} ${R * 1.06} ${-R * 0.36}Q${R * 1.02} ${-R * 0.12} ${R * 0.6} ${-R * 0.14}Q0 ${-R * 0.26} ${-R * 0.6} ${-R * 0.14}Q${-R * 1.02} ${-R * 0.12} ${-R * 1.06} ${-R * 0.36}Z`, shade(c, 0.16), { dx: 4, dy: 4 }) + E(0, -R * 1.2, 9, 6, shade(c, 0.3), 3) },
    bonnet: { front: (R, c) => cel(`M${-R * 1.03} ${-R * 0.28}C${-R * 1.07} ${-R * 1.0} ${-R * 0.6} ${-R * 1.3} 0 ${-R * 1.3}C${R * 0.6} ${-R * 1.3} ${R * 1.07} ${-R * 1.0} ${R * 1.03} ${-R * 0.28}Z`, c, { dx: 12, dy: 8 }) +
        cel(`M${-R * 1.07} ${-R * 0.5}H${R * 1.07}V${-R * 0.22}H${-R * 1.07}Z`, shade(c, 0.15), { dx: 3, dy: 3 }) + cel(`M-22 ${-R * 1.3}a22 22 0 1 0 44 0a22 22 0 1 0 -44 0Z`, tint(c, 0.4), { dx: 4, dy: 3 }) },
    chauve: { front: (R, c) => cel(`M${-R * 1.0} ${-R * 0.25}Q${-R * 1.08} ${R * 0.1} ${-R * 0.94} ${R * 0.32}L${-R * 0.86} ${R * 0.1}Q${-R * 0.9} ${-R * 0.1} ${-R * 0.86} ${-R * 0.28}Z`, c, { dx: 3, dy: 3, sw: 3.5 }) + cel(`M${R * 1.0} ${-R * 0.25}Q${R * 1.08} ${R * 0.1} ${R * 0.94} ${R * 0.32}L${R * 0.86} ${R * 0.1}Q${R * 0.9} ${-R * 0.1} ${R * 0.86} ${-R * 0.28}Z`, c, { dx: 3, dy: 3, sw: 3.5 }) + L(`M${-R * 0.5} ${-R * 0.8}Q${-R * 0.2} ${-R * 0.94} ${R * 0.1} ${-R * 0.88}`, '#FFFFFF', 6, 'opacity=".5"') },
  };

  // ------------------------------------------------------------------ tête : renvoie { back, front } (repère tête, centre 0,0)
  function head(o, sp, pal, f) {
    const R = sp.R, turn = clamp(o.turn || 0, -1, 1), nod = o.nod || 0, t = o.t || 0;
    const fx = turn * R * 0.3, fy = nod * R * 0.12;
    const hs = HAIR[sp.hair] || HAIR.court;
    const back = hs.back ? G(hs.back(R, pal.hair, o.hairSway), `translate(${r1(-fx * 0.2)} 0)`) : '';
    let s = '';
    // oreilles
    for (const sd of [-1, 1]) {
      if (sd * turn > 0.6 || sp.hair === 'hijab') continue;
      const ex = sd * R * 0.97 - turn * R * 0.12, ey = R * 0.08 + fy;
      s += cel(`M${r1(ex)} ${r1(ey - R * 0.2)}C${r1(ex + sd * R * 0.28)} ${r1(ey - R * 0.3)} ${r1(ex + sd * R * 0.32)} ${r1(ey + R * 0.16)} ${r1(ex + sd * R * 0.12)} ${r1(ey + R * 0.25)}C${r1(ex + sd * R * 0.03)} ${r1(ey + R * 0.27)} ${r1(ex - sd * R * 0.02)} ${r1(ey + R * 0.22)} ${r1(ex)} ${r1(ey + R * 0.16)}Z`, pal.skin, { dx: sd * 4, dy: 4 });
      s += L(`M${r1(ex + sd * R * 0.08)} ${r1(ey - R * 0.1)}Q${r1(ex + sd * R * 0.2)} ${r1(ey)} ${r1(ex + sd * R * 0.08)} ${r1(ey + R * 0.15)}`, shade(pal.skin, 0.25), 3.5);
    }
    // visage
    const cw = R * (sp.cheekW || 1), ch = R * (sp.faceH || 1);
    const face = sp.jaw === 'anguleux'
      ? `M0 ${-ch}C${cw * 0.62} ${-ch} ${cw} ${-ch * 0.72} ${cw} ${-ch * 0.12}C${cw} ${ch * 0.42} ${cw * 0.7} ${ch * 0.8} ${cw * 0.3} ${ch * 0.98}Q0 ${ch * 1.08} ${-cw * 0.3} ${ch * 0.98}C${-cw * 0.7} ${ch * 0.8} ${-cw} ${ch * 0.42} ${-cw} ${-ch * 0.12}C${-cw} ${-ch * 0.72} ${-cw * 0.62} ${-ch} 0 ${-ch}Z`
      : `M0 ${-ch}C${cw * 0.6} ${-ch} ${cw} ${-ch * 0.66} ${cw} ${-ch * 0.04}C${cw} ${ch * 0.52} ${cw * 0.64} ${ch * 0.94} 0 ${ch * 0.95}C${-cw * 0.64} ${ch * 0.94} ${-cw} ${ch * 0.52} ${-cw} ${-ch * 0.04}C${-cw} ${-ch * 0.66} ${-cw * 0.6} ${-ch} 0 ${-ch}Z`;
    if (f.puff > 0.05) for (const sd of [-1, 1]) s += cel(`M${r1(sd * cw * 0.7)} ${r1(R * 0.12)}a${r1(R * 0.36 * f.puff)} ${r1(R * 0.34 * f.puff)} 0 1 0 0.1 0Z`, pal.skin, { dx: sd * 6, dy: 6 });
    s += cel(face, pal.skin, { dx: 16 - turn * 10, dy: 10, inner: fxLayer(f, R, fx, t) });
    // traits
    const ey = R * (sp.eyeY || 0.04) + fy, sep = R * (sp.eyeSep || 0.4), erx = R * (sp.eyeW || 0.23), ery = R * (sp.eyeH || 0.29);
    if (sp.freckles) for (const sd of [-1, 1]) { const x0 = fx + sd * R * 0.58; s += `<g fill="${shade(pal.skin, 0.22)}"><circle cx="${r1(x0)}" cy="${r1(ey + R * 0.4)}" r="3.2"/><circle cx="${r1(x0 + sd * 13)}" cy="${r1(ey + R * 0.48)}" r="2.8"/><circle cx="${r1(x0 - sd * 9)}" cy="${r1(ey + R * 0.52)}" r="2.6"/></g>`; }
    for (const sd of [-1, 1]) {
      const far = Math.max(0, -sd * turn), ex = fx + sd * sep * (1 - 0.22 * sd * turn);
      const wk = sd < 0 ? f.winkL : f.winkR;
      s += G(eye(erx, ery, f, pal.iris, sd, pal.skin, sp.lash, Math.max(o.blink || 0, wk > 0.5 ? 1 : 0)), `translate(${r1(ex)} ${r1(ey)}) scale(${r1((1 - 0.3 * far) * 100) / 100} 1)`);
    }
    if (sp.glasses) for (const sd of [-1, 1]) s += L(`M${r1(fx + sd * sep - erx * 1.3)} ${r1(ey)}a${r1(erx * 1.3)} ${r1(ery * 1.08)} 0 1 0 ${r1(erx * 2.6)} 0a${r1(erx * 1.3)} ${r1(ery * 1.08)} 0 1 0 ${r1(-erx * 2.6)} 0Z`, sp.glasses, 5) + (sd > 0 ? L(`M${r1(fx - sep + erx * 1.3)} ${r1(ey - 4)}Q${r1(fx)} ${r1(ey - 14)} ${r1(fx + sep - erx * 1.3)} ${r1(ey - 4)}`, sp.glasses, 5) : '');
    // nez
    const nx = fx * 1.2, ny = ey + R * 0.32;
    s += sp.nose === 'pointu' ? L(`M${r1(nx)} ${r1(ny - R * 0.18)}L${r1(nx + R * 0.12 + turn * 6)} ${r1(ny + R * 0.06)}Q${r1(nx + R * 0.04)} ${r1(ny + R * 0.13)} ${r1(nx - R * 0.05)} ${r1(ny + R * 0.08)}`, INK, IL + 0.6)
      : P(`M${r1(nx - R * 0.08)} ${r1(ny)}Q${r1(nx + turn * 6)} ${r1(ny - R * 0.1)} ${r1(nx + R * 0.08)} ${r1(ny)}Q${r1(nx + turn * 4)} ${r1(ny + R * 0.08)} ${r1(nx - R * 0.08)} ${r1(ny)}Z`, shade(pal.skin, 0.12), 3);
    if (sp.beard) s += cel(`M${-R * 0.95} ${R * 0.1}C${-R * 0.92} ${R * 0.72} ${-R * 0.5} ${R * 1.06} 0 ${R * 1.08}C${R * 0.5} ${R * 1.06} ${R * 0.92} ${R * 0.72} ${R * 0.95} ${R * 0.1}Q${R * 0.7} ${R * 0.62} ${r1(fx + R * 0.32)} ${R * 0.52}Q${r1(fx)} ${R * 0.44} ${r1(fx - R * 0.32)} ${R * 0.52}Q${-R * 0.7} ${R * 0.62} ${-R * 0.95} ${R * 0.1}Z`, sp.beard, { dx: 8, dy: 6 });
    s += G(mouth(f, R * (sp.mouthW || 0.25)), `translate(${r1(fx * 1.08)} ${r1(ey + R * 0.6)})`);
    if (sp.mustache) s += cel(`M${r1(fx - R * 0.32)} ${r1(ey + R * 0.52)}Q${r1(fx)} ${r1(ey + R * 0.32)} ${r1(fx + R * 0.32)} ${r1(ey + R * 0.52)}Q${r1(fx)} ${r1(ey + R * 0.46)} ${r1(fx - R * 0.32)} ${r1(ey + R * 0.52)}Z`, sp.mustache, { dx: 3, dy: 3, sw: 4 });
    // cheveux avant + sourcils
    if (hs.front) s += G(hs.front(R, pal.hair, o.hairSway), `translate(${r1(fx * 0.4)} 0)`);
    const bcol = sp.browCol || shade(pal.hair, 0.2);
    for (const sd of [-1, 1]) { const far = Math.max(0, -sd * turn), bx = fx + sd * sep * (1 - 0.22 * sd * turn); s += G(brow(sd, erx * 2.0, f, bcol, (sp.browTh || 13)), `translate(${r1(bx)} ${r1(ey - ery * f.eyeS - R * 0.13)}) scale(${r1((1 - 0.3 * far) * 100) / 100} 1)`); }
    s += fxOver(f, R, fx, t);
    return { back, front: s };
  }

  // ------------------------------------------------------------------ gabarits
  const BODY = {
    enfant: { R: 116, shY: -430, shO: 82, neckLen: 0, waistY: -238, hemW: 76, hipW: 32, arm: [84, 78], armW: [40, 33], legW: [50, 42], foot: 1, hand: 1.08 },
    ado: { R: 100, shY: -548, shO: 92, neckLen: 12, waistY: -326, hemW: 80, hipW: 34, arm: [104, 98], armW: [40, 31], legW: [50, 40], foot: 1.08, hand: 1.06 },
    adulte: { R: 98, shY: -598, shO: 100, neckLen: 16, waistY: -356, hemW: 86, hipW: 38, arm: [114, 106], armW: [42, 33], legW: [54, 42], foot: 1.12, hand: 1.1 },
    rond: { R: 100, shY: -578, shO: 108, neckLen: 10, waistY: -340, hemW: 116, hipW: 46, arm: [110, 102], armW: [46, 37], legW: [62, 50], foot: 1.15, hand: 1.12, belly: 1 },
    age: { R: 96, shY: -556, shO: 94, neckLen: 10, waistY: -336, hemW: 88, hipW: 38, arm: [106, 100], armW: [40, 31], legW: [50, 40], foot: 1.08, hand: 1.04, stoop: 7 },
    petit: { R: 108, shY: -334, shO: 66, neckLen: 0, waistY: -190, hemW: 66, hipW: 26, arm: [64, 60], armW: [34, 28], legW: [42, 36], foot: 0.86, hand: 0.94 },
  };
  const SKIN = { clair: '#F7D7BF', rose: '#F2C3A6', medium: '#E9B48C', mat: '#C98E62', brun: '#A06A44', fonce: '#7A4A2E', tresFonce: '#5A3624' };

  // ------------------------------------------------------------------ torse et vêtements
  function torsoPath(sp, shrug, bel) {
    const { shY, shO, waistY, hemW } = sp, nW = sp.R * 0.26, sy = shY - shrug * 16;
    return `M${-nW} ${shY - 4}C${-nW - 30} ${sy - 6} ${-shO + 8} ${sy} ${-shO} ${sy + 30}C${-shO - 6} ${shY + 96} ${-hemW - 8 - bel} ${waistY - 70} ${-hemW} ${waistY}` +
      `Q0 ${waistY + 12 + bel * 0.4} ${hemW} ${waistY}C${hemW + 8 + bel} ${waistY - 70} ${shO + 6} ${shY + 96} ${shO} ${sy + 30}C${shO - 8} ${sy} ${nW + 30} ${sy - 6} ${nW} ${shY - 4}Q0 ${shY + 14} ${-nW} ${shY - 4}Z`;
  }
  function torso(o, sp, pal) {
    const shrug = o.shrug || 0, bel = sp.belly ? 26 : 0, d = torsoPath(sp, shrug, bel);
    const { shY, shO, waistY, hemW } = sp, bt = clamp(o.bodyTurn || 0, -1, 1) * 18, col = pal.top, top = o.top || 'tee';
    const inner = [];
    let pre = '', post = '';
    if (top === 'hoodie') {
      pre += cel(`M${-sp.R * 0.62} ${shY + 12}C${-sp.R * 0.76} ${shY - 40} ${-sp.R * 0.48} ${shY - 66} 0 ${shY - 66}C${sp.R * 0.48} ${shY - 66} ${sp.R * 0.76} ${shY - 40} ${sp.R * 0.62} ${shY + 12}Z`, shade(col, 0.24), { dx: 6, dy: 4 });
      inner.push(F(`M-300 ${waistY - 34}H300V${waistY + 40}H-300Z`, shade(col, 0.14)), L(`M-300 ${waistY - 34}H300`, INK, IL));
    }
    if (top === 'robe') pre += cel(`M${-hemW + 4} ${waistY - 24}L${-hemW - 50} ${waistY + 130}Q0 ${waistY + 156} ${hemW + 50} ${waistY + 130}L${hemW - 4} ${waistY - 24}Z`, col, { dx: 14, dy: 10 });
    if (top === 'manteau') pre += cel(`M${-hemW} ${waistY - 30}L${-hemW - 20} ${waistY + 140}Q0 ${waistY + 154} ${hemW + 20} ${waistY + 140}L${hemW} ${waistY - 30}Z`, col, { dx: 14, dy: 10, inner: L(`M${bt} ${waistY - 30}V${waistY + 150}`, INK, IL) });
    if (top === 'veste') {
      inner.push(F(`M${-24 + bt} ${shY - 20}L${-20 + bt} ${waistY + 20}H${20 + bt}L${24 + bt} ${shY - 20}Z`, pal.tee || '#24242B'));
      inner.push(L(`M${-24 + bt} ${shY}L${-20 + bt} ${waistY}M${24 + bt} ${shY}L${20 + bt} ${waistY}`, INK, IL));
      inner.push(F(`M-300 ${waistY - 28}H300V${waistY + 30}H-300Z`, '#2B2B33'), L(`M-300 ${waistY - 16}H300`, col, 5));
    }
    if (top === 'chemise') { inner.push(L(`M${bt} ${shY + 6}V${waistY}`, shade(col, 0.4), IL)); for (let i = 0; i < 4; i++) inner.push(E(bt + 9, shY + 30 + i * (waistY - shY - 50) / 3, 4, 4, '#FFFFFF', 2)); }
    if (top === 'pull') inner.push(F(`M-300 ${waistY - 24}H300V${waistY + 30}H-300Z`, shade(col, 0.14)), L(`M-300 ${waistY - 24}H300`, INK, IL), L(`M${-hemW * 0.5 + bt} ${shY + 60}l14 14l14 -14l14 14l14 -14`, tint(col, 0.35), 4));
    if (o.motif) inner.push(o.motif);
    let s = pre + cel(d, col, { dx: 20, dy: 12, inner: inner.join('') });
    if (top === 'hoodie') {
      s += cel(`M${-46 + bt} ${waistY - 96}H${46 + bt}Q${54 + bt} ${waistY - 96} ${58 + bt} ${waistY - 86}L${70 + bt} ${waistY - 36}H${-70 + bt}L${-58 + bt} ${waistY - 86}Q${-54 + bt} ${waistY - 96} ${-46 + bt} ${waistY - 96}Z`, col, { dx: 6, dy: 5, sw: 4 });
      const sw = Math.sin((o.t || 0) * 3 + 1) * 3 + (o.stringSway || 0);
      for (const sd of [-1, 1]) s += L(`M${sd * 18 + bt} ${shY + 4}Q${sd * 22 + bt + sw} ${shY + 40} ${sd * 15 + bt + sw * 1.6} ${shY + 74}`, pal.string || '#FFF6E6', 6) + P(`M${sd * 15 + bt + sw * 1.6 - 5} ${shY + 70}h10v16h-10z`, pal.accent || '#E5483D', 3);
    }
    if (top === 'veste') { post += L(`M${-18 + bt} ${shY + 6}Q${bt} ${shY + 52} ${18 + bt} ${shY + 6}`, pal.chain || '#F2C94C', 5); post += cel(`M${-shO + 16} ${shY + 66}h34v34h-34z`, pal.patch || '#F3E6CC', { dx: 3, dy: 3, sw: 4 }) + L(`M${-shO + 23} ${shY + 92}V${shY + 74}l10 11l10 -11V${shY + 92}`, col, 5); }
    if (top === 'tee' || top === 'robe' || top === 'pull') s += L(`M${-sp.R * 0.26 + bt} ${shY}Q${bt} ${shY + 22} ${sp.R * 0.26 + bt} ${shY}`, INK, IL);
    if (top === 'chemise') s += P(`M${-30 + bt} ${shY - 6}L${bt} ${shY + 18}L${-8 + bt} ${shY + 30}L${-36 + bt} ${shY + 10}Z`, '#FFFFFF', 3.5) + P(`M${30 + bt} ${shY - 6}L${bt} ${shY + 18}L${8 + bt} ${shY + 30}L${36 + bt} ${shY + 10}Z`, '#FFFFFF', 3.5);
    return { s: s + post, d };
  }
  function legs(o, sp, pal, hipX, hipY) {
    const lift = o.lift || [0, 0], bottom = o.bottom || 'jean';
    let s = '';
    const legLen = (-34 - (sp.waistY + 8)) / 2 * 1.02;
    for (const side of [-1, 1]) {
      const i = side < 0 ? 0 : 1;
      const H = [hipX + side * sp.hipW, hipY];
      const A = [side * (sp.hipW + 10 + (o.stance || 0) * 36) + (o.footDX ? o.footDX[i] : 0), -34 - lift[i]];
      const seg = o.kneeOut ? legLen : legLen - lift[i] * 0.5;
      const { E: K, W: An } = ik2(H, seg, seg, A, -side * (o.knee == null ? 1 : o.knee));
      const skinLeg = bottom === 'short' || bottom === 'jupe' || bottom === 'robe';
      s += cel(limbPath(H, K, An, sp.legW[0], sp.legW[1]), skinLeg ? (pal.socks || pal.skin) : pal.bottom, { dx: 9, dy: 5 });
      if (bottom === 'short') s += cel(limbPath(H, [lerp(H[0], K[0], 0.5), lerp(H[1], K[1], 0.5)], [lerp(H[0], K[0], 0.92), lerp(H[1], K[1], 0.92)], sp.legW[0] + 10, sp.legW[0] + 6), pal.bottom, { dx: 8, dy: 5 });
      if (bottom === 'jean') s += L(`M${r1(An[0] - sp.legW[1] * 0.5)} ${r1(An[1] - 18)}L${r1(An[0] + sp.legW[1] * 0.5)} ${r1(An[1] - 18)}`, shade(pal.bottom, 0.28), 4);
      if (bottom === 'jogging') s += L(`M${r1(H[0] + side * sp.legW[0] * 0.36)} ${r1(H[1] + 10)}Q${r1(K[0] + side * sp.legW[0] * 0.42)} ${r1(K[1])} ${r1(An[0] + side * sp.legW[1] * 0.4)} ${r1(An[1] - 20)}`, '#F4F1EA', 5);
      // chaussure 3/4 avant
      const fs = sp.foot, toe = o.toe ? o.toe[i] : 0;
      const shoe = `M-22 2C-24 -8 18 -10 22 2C40 4 54 16 54 28Q54 36 44 36H-24Q-32 36 -32 28Q-32 12 -22 2Z`;
      const c = nid('s');
      const body = `<clipPath id="${c}"><path d="${shoe}"/></clipPath>` + F(shoe, pal.shoe) + `<g clip-path="url(#${c})">` + F('M-40 25H60V40H-40Z', pal.sole || '#E8E2D6') + L('M-40 25H60', INK, IL) + F(`M-40 -20H60V40H-40Z`, shadowOf(pal.shoe), 'transform="translate(10 6)" opacity=".0"') + '</g>' + `<path d="${shoe}" fill="none" stroke="${INK}" stroke-width="${OL}" stroke-linejoin="round"/>`;
      const det = (pal.shoeAcc ? L('M-6 10Q14 4 30 16', pal.shoeAcc, 5) : '') + L('M-10 6l10 4M-4 0l10 4', shade(pal.shoe, 0.35), 2.6);
      s += G(body + det, `translate(${r1(An[0])} ${r1(An[1])}) scale(${side * fs} ${fs}) rotate(${r1(toe)} 0 30)`);
    }
    // bassin
    if (bottom !== 'robe') {
      const hw = sp.hipW + sp.legW[0] * 0.5, col = bottom === 'jupe' ? pal.bottom : pal.bottom;
      if (bottom === 'jupe') s += cel(`M${hipX - sp.hemW + 6} ${hipY - 30}H${hipX + sp.hemW - 6}L${hipX + sp.hemW + 22} ${hipY + 70}Q${hipX} ${hipY + 84} ${hipX - sp.hemW - 22} ${hipY + 70}Z`, col, { dx: 12, dy: 8 });
      else s += cel(`M${hipX - sp.hemW + 8} ${hipY - 26}H${hipX + sp.hemW - 8}L${hipX + hw} ${hipY + 26}Q${hipX} ${hipY + 50} ${hipX - hw} ${hipY + 26}Z`, col, { dx: 10, dy: 6 });
    }
    return s;
  }
  // bras : renvoie dessin + infos (devant / derrière le torse)
  function arm(o, sp, pal, side, a) {
    const shrug = o.shrug || 0;
    const S = [side * (sp.shO - 16), sp.shY + 32 - shrug * 16];
    let r, hType = 'relax', front = false, hr = 0;
    if (Array.isArray(a)) { r = fk(S, side, sp.arm[0], sp.arm[1], a[0], a[1]); hType = a[2] || 'relax'; front = a[3] !== 'back'; }
    else if (a && a.at) { r = ikArm(S, sp, a, side); hType = a.hand || 'relax'; front = !a.back; hr = a.handRot || 0; }
    else if (a && a.pts) { r = { E: a.pts.E, W: a.pts.W }; hType = a.pts.hand; front = !a.pts.back; }
    else { r = fk(S, side, sp.arm[0], sp.arm[1], 12, -16); front = true; }
    let abs = a && !Array.isArray(a) && a.handAbs != null ? a.handAbs * side : null;
    if (a && a.pts) abs = a.pts.rot;
    const sleeve = o.sleeve || 'long', top = pal.sleeve || pal.top;
    let s = '';
    const armD = limbPath(S, r.E, r.W, sp.armW[0], sp.armW[1]);
    if (sleeve === 'court') {
      s += cel(armD, pal.skin, { dx: 8, dy: 5 });
      s += cel(limbPath(S, [lerp(S[0], r.E[0], 0.45), lerp(S[1], r.E[1], 0.45)], [lerp(S[0], r.E[0], 0.8), lerp(S[1], r.E[1], 0.8)], sp.armW[0] + 10, sp.armW[0] + 8), top, { dx: 8, dy: 5 });
    } else {
      s += cel(armD, top, { dx: 8, dy: 5 });
      const k = 0.84, c0 = [lerp(r.E[0], r.W[0], k), lerp(r.E[1], r.W[1], k)];
      s += cel(cap(c0, r.W, sp.armW[1] + 4), pal.cuff || shade(top, 0.18), { dx: 3, dy: 3, sw: 4 });
    }
    const ang = Math.atan2(r.W[1] - r.E[1], r.W[0] - r.E[0]) * 180 / Math.PI - 90;
    const rr = abs != null ? abs : ang + hr;
    s += G(hand(hType, side, pal.skin, sp.hand, rr, { phone: pal.phone, screen: pal.screen, rec: o.rec }), `translate(${r1(r.W[0])} ${r1(r.W[1])}) rotate(${r1(rr)})`);
    return { s, front, S, W: r.W };
  }

  // Résout un bras en points (épaule, coude, poignet, main, angle de main) pour pouvoir mélanger deux poses.
  function armSolve(o, side, a) {
    const sp = Object.assign({}, BODY[o.body || 'enfant'], o.spec || {});
    const shrug = o.shrug || 0;
    const S = [side * (sp.shO - 16), sp.shY + 32 - shrug * 16];
    let r, hand = 'relax', back = false, hr = 0;
    if (Array.isArray(a)) { r = fk(S, side, sp.arm[0], sp.arm[1], a[0], a[1]); hand = a[2] || 'relax'; back = a[3] === 'back'; }
    else if (a && a.at) { r = ikArm(S, sp, a, side); hand = a.hand || 'relax'; back = !!a.back; hr = a.handRot || 0; }
    else if (a && a.pts) return a.pts;
    else r = fk(S, side, sp.arm[0], sp.arm[1], 12, -16);
    const ang = Math.atan2(r.W[1] - r.E[1], r.W[0] - r.E[0]) * 180 / Math.PI - 90;
    const rot = a && !Array.isArray(a) && a.handAbs != null ? a.handAbs * side : ang + hr;
    return { E: r.E, W: r.W, hand, back, rot };
  }

  // ------------------------------------------------------------------ personnage complet
  function person(o = {}) {
    const sp = Object.assign({}, BODY[o.body || 'enfant'], o.spec || {});
    const pal = Object.assign({ skin: SKIN.medium, hair: '#3A2621', top: '#7FB7BE', bottom: '#3F5888', shoe: '#FBFAF6', iris: '#5A3A2A' }, o.pal || {});
    if (SKIN[pal.skin]) pal.skin = SKIN[pal.skin];
    if (pal.socks && SKIN[pal.socks]) pal.socks = SKIN[pal.socks];
    const f = Object.assign(o.face ? Object.assign({}, BASE, o.face) : expr(o.expr || 'neutre', o.exprOver), o.fx || {});
    const sc = o.scale || 1, sq = o.squash || 0;
    const headY = sp.shY - sp.R * (sp.faceH || 1) * 0.92 - sp.neckLen;
    let s = `<g transform="translate(${r1(o.x || 0)} ${r1(o.y || 0)}) scale(${r1(sc * (o.flip ? -1 : 1) * 1000) / 1000} ${r1(sc * 1000) / 1000}) scale(${r1((1 + sq * 0.6) * 1000) / 1000} ${r1((1 - sq) * 1000) / 1000})">`;
    if (o.headOnly) { const h = head(o, sp, pal, f); return s + `<g transform="rotate(${r1(o.tilt || 0)})">${h.back}${h.front}</g></g>`; }
    const jmp = o.jump || 0;
    if (o.shadow !== false) s += `<ellipse cx="0" cy="2" rx="${r1(sp.shO * 1.35 * (1 - Math.min(0.5, jmp / 400)))}" ry="${r1(sp.shO * 0.18 * (1 - Math.min(0.5, jmp / 400)))}" fill="#000" opacity="${r1(0.13 * (1 - Math.min(0.6, jmp / 300)) * 100) / 100}"/>`;
    s += `<g transform="translate(0 ${r1(-jmp)})">`;
    const drop = (o.crouch || 0) * (sp.waistY * -0.28) + (o.bob || 0), sway = o.sway || 0;
    const hipY = sp.waistY + 8 + drop;
    s += legs(o, sp, pal, sway, hipY);
    const lean = (o.lean || 0) + (sp.stoop || 0);
    s += `<g transform="translate(${r1(sway)} ${r1(drop)}) rotate(${r1(lean)} 0 ${sp.waistY})">`;
    const A = o.arms || {};
    const arms = [[-1, A.l], [1, A.r]].map(([sd, a]) => arm(o, sp, pal, sd, a));
    const h = head(o, sp, pal, f);
    const hTf = `translate(0 ${r1(headY + (o.shrug || 0) * 14)}) rotate(${r1(o.tilt || 0)} 0 ${r1(sp.R * 0.9)})`;
    s += G(h.back, hTf);
    for (const a of arms) if (!a.front) s += a.s;
    s += cel(`M${-sp.R * 0.21} ${sp.shY + 6}V${headY + sp.R * 0.6}H${sp.R * 0.21}V${sp.shY + 6}Z`, shade(pal.skin, 0.1), { dx: 6, dy: 0 });
    const T = torso(o, sp, pal);
    s += T.s;
    s += G(h.front, hTf);
    for (const a of arms) if (a.front) {
      s += a.s;
      // l'épaule repasse par-dessus le haut du bras
      const c = nid('sp'), sd = Math.sign(a.S[0]);
      s += `<clipPath id="${c}"><circle cx="${r1(a.S[0])}" cy="${r1(a.S[1] - 2)}" r="${r1(sp.armW[0] * 0.66)}"/></clipPath>` + `<g clip-path="url(#${c})">${cel(T.d, pal.top, { dx: 20, dy: 12 })}</g>`;
    }
    if (o.front) s += o.front;
    return s + '</g></g></g>';
  }

  // ------------------------------------------------------------------ personnages récurrents
  const LEO = { body: 'enfant', spec: { hair: 'leo', freckles: true }, top: 'hoodie', bottom: 'jean',
    pal: { skin: '#EDB892', hair: '#3A2621', top: '#F6B53D', bottom: '#3F5888', shoe: '#FBFAF6', shoeAcc: '#E5483D', iris: '#7A4A2E', string: '#FFF6E6', accent: '#E5483D' } };
  const MAX = { body: 'ado', spec: { hair: 'max', jaw: 'anguleux', nose: 'pointu', eyeW: 0.22, eyeH: 0.25, browTh: 10 }, top: 'veste', bottom: 'jogging',
    pal: { skin: '#F2C9AC', hair: '#EBC35A', top: '#D62E40', sleeve: '#F3E6CC', cuff: '#2B2B33', tee: '#24242B', bottom: '#8B909C', shoe: '#22232A', sole: '#F4F1EA', iris: '#4FA3CF', chain: '#F2C94C', patch: '#F3E6CC' } };
  const merge = (pre, o) => Object.assign({}, pre, o, { spec: Object.assign({}, pre.spec, o.spec || {}), pal: Object.assign({}, pre.pal, o.pal || {}) });
  const leo = o => person(merge(LEO, o || {}));
  const max = o => person(merge(MAX, Object.assign({ expr: 'moqueur' }, o || {})));

  // ------------------------------------------------------------------ gestes prêts à l'emploi (coordonnées locales du buste)
  // Chaque geste renvoie un objet d'options (arms, lean, shrug, tilt, turn, crouch, lift, expr…) qu'on fusionne / mélange.
  function gesture(name, sp0 = 'enfant') {
    const sp = BODY[sp0] || sp0, R = sp.R, hy = sp.shY - R * 0.92 - sp.neckLen;
    const G_ = {
      repos: { arms: { l: [12, -16, 'relax'], r: [12, -16, 'relax'] } },
      salut: { arms: { l: [12, -16, 'relax'], r: { at: [sp.shO + 70, hy - 10], hand: 'open', handAbs: 200 } }, tilt: -6, lean: -3, expr: 'joie' },
      facepalm: { arms: { l: [12, -16, 'relax'], r: { at: [R * 0.32, hy + R * 0.62], hand: 'open', handAbs: 172, bend: -1 } }, tilt: 10, nod: 0.6, lean: 4, expr: 'blase' },
      hausse: { arms: { l: { at: [-sp.shO - 70, sp.shY + 66], hand: 'open', handAbs: -140, bend: -1 }, r: { at: [sp.shO + 70, sp.shY + 66], hand: 'open', handAbs: -140, bend: -1 } }, shrug: 1, tilt: 8, expr: 'pense', exprOver: { q: 0 } },
      croise: { arms: { l: { at: [sp.shO * 0.52, sp.shY + R * 1.0], hand: 'none', bend: 1, handAbs: 90 }, r: { at: [-sp.shO * 0.16, sp.shY + R * 0.8], hand: 'relax', bend: 1, handAbs: 90 } }, tilt: -4, expr: 'vexe' },
      victoire: { arms: { l: { at: [-sp.shO - 40, hy - R * 0.9], hand: 'fist' }, r: { at: [sp.shO + 40, hy - R * 0.9], hand: 'fist' } }, lift: [16, 16], jump: 50, squash: -0.05, tilt: 4, expr: 'joie' },
      horreur: { arms: { l: { at: [-R * 0.86, hy + R * 0.92], hand: 'open', handAbs: 168, bend: -1 }, r: { at: [R * 0.86, hy + R * 0.92], hand: 'open', handAbs: 168, bend: -1 } }, shrug: 0.6, expr: 'choque' },
      pointe: { arms: { l: { at: [sp.shO * 0.05, sp.waistY - 66], hand: 'fist', bend: 1, handAbs: 90 }, r: { at: [sp.shO + 160, sp.shY + 30], hand: 'point', handRot: -6 } }, lean: -8, tilt: -8, turn: 0.3, expr: 'rire' },
      reflechit: { arms: { l: { at: [sp.shO - 10, sp.shY + 126], hand: 'fist', bend: 1, handAbs: 90 }, r: { at: [R * 0.22, hy + R * 1.08], hand: 'fist', handAbs: 182, bend: -1 } }, tilt: 8, turn: -0.2, expr: 'pense' },
      triste: { arms: { l: [6, -4, 'relax'], r: [6, -4, 'relax'] }, shrug: -0.4, nod: 1, tilt: 8, lean: 5, expr: 'triste' },
      pleure: { arms: { l: { at: [-R * 0.46, hy + R * 0.5], hand: 'fist', handAbs: 175, bend: -1 }, r: { at: [R * 0.46, hy + R * 0.5], hand: 'fist', handAbs: 175, bend: -1 } }, shrug: 0.5, nod: 0.5, expr: 'pleure' },
      hanches: { arms: { l: { at: [-sp.hemW - 14, sp.waistY - 40], hand: 'fist', handAbs: 72 }, r: { at: [sp.hemW + 14, sp.waistY - 40], hand: 'fist', handAbs: 72 } }, lean: -4, tilt: -6, expr: 'fier' },
      panique: { arms: { l: { at: [-R * 0.92, hy - R * 0.2], hand: 'open', handAbs: 160, bend: -1 }, r: { at: [R * 0.92, hy - R * 0.2], hand: 'open', handAbs: 160, bend: -1 } }, shrug: 0.8, crouch: 0.15, expr: 'panique' },
      pouce: { arms: { l: [12, -16, 'relax'], r: { at: [sp.shO * 0.35, sp.shY + 50], hand: 'thumb', handAbs: 90, bend: -1 } }, tilt: -8, turn: 0.2, expr: 'ok' },
      course: { arms: { l: { at: [-sp.shO * 0.2, sp.shY + 40], hand: 'fist', bend: 1, handAbs: 150 }, r: { at: [sp.shO + 40, sp.waistY + 30], hand: 'fist', bend: -1 } }, lift: [80, 0], jump: 16, lean: 4, sway: -8, tilt: -4, expr: 'determine' },
    };
    return G_[name] || G_.repos;
  }

  // ------------------------------------------------------------------ mouvement
  function walk(t, o = {}) {
    const sp = o.speed || 7, a = o.amp || 1, ph = t * sp, s1 = Math.sin(ph), c1 = Math.cos(ph);
    return { lift: [Math.max(0, s1) * 34 * a, Math.max(0, -s1) * 34 * a], bob: -Math.abs(c1) * 12 * a + 4, sway: s1 * 6 * a, lean: s1 * 2 * a, tilt: -s1 * 2.5 * a,
      arms: { l: [10 - s1 * 24 * a, -10 - Math.max(0, s1) * 18, 'relax'], r: [10 + s1 * 24 * a, -10 - Math.max(0, -s1) * 18, 'relax'] }, hairSway: -c1 * 6 * a };
  }
  function idle(t, seed = 0, amp = 1) {
    const n = (k, s) => Math.sin(t * k + seed * s);
    return { bob: n(2.4, 1) * 3 * amp, tilt: (n(0.7, 2) * 2 + n(1.9, 3) * 0.8) * amp, lean: n(0.9, 4) * 1.2 * amp, turn: n(0.37, 5) * 0.06 * amp, hairSway: n(1.3, 6) * 3 * amp };
  }
  function blinkAt(t, seed = 0) {
    const per = 3.2 + ((seed * 9301 + 49297) % 233) / 233 * 1.8, ph = (t + seed * 0.77) % per;
    const one = x => x > 0 && x < 0.14 ? Math.sin(x / 0.14 * Math.PI) : 0;
    return Math.max(one(ph), seed % 3 === 0 ? one(ph - 0.22) : 0);
  }

  root.EtSi2 = { person, leo, max, expr, mixExpr, gesture, armSolve, EXPR, BODY, SKIN, HAIR, walk, idle, blinkAt, hand, INK, shade, tint,
    prims: { P, F, L, E, G, cel, limbPath, cap, ik2, fk } };
})(typeof window !== 'undefined' ? window : globalThis);
