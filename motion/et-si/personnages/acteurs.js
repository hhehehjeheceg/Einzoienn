// Boîte à outils commune des épisodes (v3, à partir de « Pourquoi c'est horrible » 3) — moteur seek(t).
// v3 : clignement à chaque changement d'émotion, transfert de poids à chaque geste,
// étirement / écrasement des sauts, tête qui suit le buste (follow-through).
// Outils, effets, décors et acteurs animés (mélange de poses en ressort + couche de vie).
// Tout dépend du temps t : aucune minuterie, aucun état d'une image à l'autre.
(function () {
  const K = window.EtSi2, INK = K.INK;
  const { P, F, L, E, G, cel } = K.prims;

  // ------------------------------------------------------------------ outils
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const inv = (a, b, t) => clamp((t - a) / (b - a));
  const r1 = v => Math.round(v * 10) / 10;
  const r2 = v => Math.round(v * 100) / 100;
  const Ez = {
    io: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    out: k => 1 - Math.pow(1 - k, 3),
    o5: k => 1 - Math.pow(1 - k, 5),
    in: k => k * k * k,
    back: k => { const c = 1.8; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
    sine: k => 0.5 - Math.cos(Math.PI * k) / 2,
  };
  // réponse indicielle d'un ressort (0 -> 1 à partir de t0)
  function spring(t, t0, f = 2.6, z = 0.5) {
    if (t <= t0) return 0;
    const x = t - t0, w = 2 * Math.PI * f;
    if (z >= 1) return 1 - Math.exp(-w * x) * (1 + w * x);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }
  const punch = (t, t0, k = 7, f = 30) => t < t0 ? 0 : Math.exp(-(t - t0) * k) * Math.cos((t - t0) * f);
  const decay = (t, t0, k = 6) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
  const bump = (t, a, b) => { const k = inv(a, b, t); return k <= 0 || k >= 1 ? 0 : Math.sin(Math.PI * k); };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  const hash = n => rng(n * 9301 + 49297)();
  const noise1 = (t, s) => Math.sin(t * 13.1 + s) * 0.5 + Math.sin(t * 7.3 + s * 2.1) * 0.3 + Math.sin(t * 23.7 + s * 0.7) * 0.2;
  const mixC = (c1, c2, k) => {
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, '0')).join('');
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function txt(x, y, s, size, fill, o = {}) {
    const st = o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw || 10}" stroke-linejoin="round" paint-order="stroke"` : '';
    const tf = o.rot ? `transform="rotate(${o.rot} ${x} ${y})"` : '';
    return `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" fill="${fill}" font-family="${o.font || 'Brico'}" font-weight="${o.weight || 800}" text-anchor="${o.anchor || 'middle'}" letter-spacing="${o.ls || 0}" opacity="${o.op == null ? 1 : r2(o.op)}" ${st} ${tf}>${esc(s)}</text>`;
  }
  const grp = (inner, tf = '', extra = '') => `<g ${tf ? `transform="${tf}"` : ''} ${extra}>${inner}</g>`;
  const at = (x, y, s = 1, rot = 0) => `translate(${r1(x)} ${r1(y)})${rot ? ` rotate(${r1(rot)})` : ''}${s !== 1 ? ` scale(${r2(s)})` : ''}`;
  const op = v => `opacity="${r2(clamp(v))}"`;
  const cv = document.createElement('canvas').getContext('2d');
  const measure = (s, size, font = 'Brico', weight = 800) => { cv.font = `${weight} ${size}px ${font}`; return cv.measureText(s).width; };
  const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // ------------------------------------------------------------------ effets
  const STAR = r => `M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z`;
  const HEART = 'M0 12C-26 -8 -30 -30 -14 -36C-6 -39 0 -32 0 -26C0 -32 6 -39 14 -36C30 -30 26 -8 0 12Z';
  function rays(cx, cy, n, R, rot, c, o = 1) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + rot, a1 = a0 + Math.PI / n;
      d += `M${cx} ${cy}L${r1(cx + Math.cos(a0) * R)} ${r1(cy + Math.sin(a0) * R)}L${r1(cx + Math.cos(a1) * R)} ${r1(cy + Math.sin(a1) * R)}Z`;
    }
    return `<path d="${d}" fill="${c}" ${op(o)}/>`;
  }
  function ring(cx, cy, t, t0, dur, Rmax, col = '#FFFFFF', w0 = 26) {
    const k = inv(t0, t0 + dur, t);
    if (k <= 0 || k >= 1) return '';
    return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(Ez.o5(k) * Rmax)}" fill="none" stroke="${col}" stroke-width="${r1(w0 * (1 - k))}" ${op(1 - k)}/>`;
  }
  function sparkles(cx, cy, t, t0, n, spread, seed, cols = ['#FFFFFF', '#FFE27A']) {
    const k = inv(t0, t0 + 1.1, t);
    if (k <= 0 || k >= 1) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = spread * (0.4 + r() * 0.6) * Ez.o5(k), sz = 10 + r() * 22;
      const sc = Math.max(0, Math.sin(Math.PI * clamp(k * 1.3 - r() * 0.2)));
      s += `<path d="${STAR(sz)}" fill="${cols[i % cols.length]}" transform="${at(cx + Math.cos(a) * d, cy + Math.sin(a) * d, sc, k * 180 * (r() - 0.5))}"/>`;
    }
    return s;
  }
  function confetti(cx, cy, t, t0, n, seed, dur = 2.6) {
    const dt = t - t0;
    if (dt <= 0 || dt > dur) return '';
    const r = rng(seed), cols = ['#F6B53D', '#E5483D', '#4FA3CF', '#7BD389', '#F28CB1', '#FFFFFF'];
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = 900 + r() * 1300;
      const x = cx + Math.cos(a) * v * dt * 0.9, y = cy + Math.sin(a) * v * dt + 1500 * dt * dt;
      const w = 14 + r() * 14, h = 8 + r() * 8;
      s += `<rect x="${r1(-w / 2)}" y="${r1(-h / 2)}" width="${r1(w)}" height="${r1(h)}" fill="${cols[i % cols.length]}" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1((r() - 0.5) * 1400 * dt)}) scale(1 ${r2(Math.cos(dt * 9 + i))})" ${op(dur - dt)}/>`;
    }
    return s;
  }
  function hearts(cx, cy, t, t0, n, seed, o = {}) {
    const dt = t - t0, life = o.life || 2.2;
    if (dt <= 0 || dt > life + 0.6) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const d0 = r() * (o.spread || 0.5), k = clamp((dt - d0) / life);
      const x = cx + (r() - 0.5) * (o.w || 300) + Math.sin(dt * 4 + i) * 22, y = cy - Ez.out(k) * (o.h || 260) * (0.6 + r() * 0.6);
      if (k <= 0 || k >= 1) continue;
      const sc = (0.8 + r() * 0.9) * Math.sin(Math.PI * k) * (o.size || 1.6);
      s += `<path d="${HEART}" fill="${o.col || '#F25C7A'}" stroke="${INK}" stroke-width="4" transform="${at(x, y, sc, (r() - 0.5) * 30)}"/>`;
    }
    return s;
  }
  function speedLines(cx, cy, t, n, seed, o = 0.5, col = '#FFFFFF', r0 = 520) {
    const r = rng(seed + Math.floor(t * 20)); let d = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, a0 = r0 + r() * 260, a2 = a0 + 400 + r() * 600, w = 0.004 + r() * 0.01;
      d += `M${r1(cx + Math.cos(a) * a0)} ${r1(cy + Math.sin(a) * a0)}L${r1(cx + Math.cos(a - w) * a2)} ${r1(cy + Math.sin(a - w) * a2)}L${r1(cx + Math.cos(a + w) * a2)} ${r1(cy + Math.sin(a + w) * a2)}Z`;
    }
    return `<path d="${d}" fill="${col}" ${op(o)}/>`;
  }
  // éclair d'appareil photo (étoile blanche + halo)
  function flashBurst(x, y, t, t0, s = 1) {
    const k = inv(t0, t0 + 0.35, t);
    if (k <= 0 || k >= 1) return '';
    const e = Ez.o5(k), a = 1 - k;
    return grp(`<circle r="${r1(150 * e)}" fill="#FFFFFF" ${op(a * 0.55)} filter="url(#soft)"/>` +
      `<path d="${STAR(120 * (0.4 + e))}" fill="#FFFFFF" ${op(a)}/>` + `<path d="${STAR(60 * (0.4 + e))}" fill="#FFF6C9" transform="rotate(45)" ${op(a)}/>`, at(x, y, s));
  }
  // lettres qui arrivent une à une en ressort
  function springWord(x, y, word, size, t, t0, o = {}) {
    const font = o.font || 'Anton', fill = o.fill || '#FFFFFF', wt = font === 'Anton' ? 400 : 800;
    const total = measure(word, size, font, wt) + (word.length - 1) * (o.ls || 0);
    let cx = x - total / 2, s = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], wch = measure(ch, size, font, wt);
      const k = spring(t, t0 + i * (o.stag || 0.035), o.f || 2.4, o.z || 0.45);
      const yy = y + (1 - k) * (o.dy == null ? 120 : o.dy);
      if (k > 0.001) s += `<text x="${r1(cx + wch / 2)}" y="${r1(yy)}" font-size="${size}" font-family="${font}" font-weight="${wt}" text-anchor="middle" fill="${fill}" stroke="${o.stroke || INK}" stroke-width="${o.sw || 12}" stroke-linejoin="round" paint-order="stroke" transform="rotate(${r1((1 - k) * (o.rot == null ? -12 : o.rot))} ${r1(cx + wch / 2)} ${r1(yy)})" ${op(k * 3)}>${esc(ch)}</text>`;
      cx += wch + (o.ls || 0);
    }
    return s;
  }
  // tampon qui s'écrase (« CONTENU », « PRISE 7 »…)
  function stamp(x, y, text, t, t0, o = {}) {
    if (t < t0) return '';
    const k = inv(t0, t0 + 0.16, t), sc = k < 1 ? lerp(2.6, 1, Ez.in(k)) : 1 + 0.06 * punch(t, t0 + 0.16, 9, 40);
    const size = o.size || 130, col = o.col || '#E5483D', w = measure(text, size, 'Anton', 400) + 70, h = size * 1.1;
    const body = `<path d="${rr(-w / 2, -h / 2 - 8, w, h + 16, 22)}" fill="none" stroke="${col}" stroke-width="14"/>` +
      `<path d="${rr(-w / 2 + 16, -h / 2 + 8, w - 32, h - 16, 12)}" fill="none" stroke="${col}" stroke-width="5"/>` +
      txt(0, size * 0.36, text, size, col, { font: 'Anton', weight: 400, ls: 4 });
    const shadow = grp(body.replace(new RegExp(col, 'g'), '#000000'), 'translate(8 10)', 'opacity=".25"');
    return grp(shadow + body, at(x, y, sc, o.rot == null ? -8 : o.rot), op(clamp(k * 4) * (o.fade == null ? 1 : o.fade)));
  }
  // compteur qui défile (« 2 000 000 VUES »)
  function counter(x, y, t, t0, t1, target, label, o = {}) {
    if (t < t0) return '';
    const k = Ez.o5(inv(t0, t1, t)), n = target * k, pop = spring(t, t0, 2.6, 0.5), done = t > t1 ? 1 + 0.12 * punch(t, t1, 7, 26) : 1;
    const s1 = fmt(n), size = o.size || 120;
    const w = Math.max(measure(fmt(target), size, 'Anton', 400), measure(label, 54, 'Brico', 800)) + 150;
    let s = `<path d="${rr(-w / 2, -size * 0.95, w, size * 1.75 + 10, 40)}" fill="${o.bg || '#1C1418'}" stroke="#FFFFFF" stroke-width="6"/>`;
    s += grp(`<path d="M-30 0Q0 -24 30 0Q0 24 -30 0Z" fill="#FFFFFF"/><circle r="10" fill="${o.bg || '#1C1418'}"/>`, `translate(${r1(-w / 2 + 62)} ${r1(-size * 0.32)}) scale(1.3)`);
    s += txt(28, size * 0.04, s1, size, o.col || '#FFD23F', { font: 'Anton', weight: 400, ls: 2 });
    s += txt(0, size * 0.66, label, 50, '#FFFFFF', { ls: 4 });
    return grp(s, at(x, y, pop * done, o.rot || -3));
  }
  // notification qui tombe du haut de l'écran
  function notif(t, t0, y, app, title, body, o = {}) {
    if (t < t0) return '';
    const k = spring(t, t0, 2.2, 0.62), out = o.t1 ? Ez.in(inv(o.t1, o.t1 + 0.3, t)) : 0;
    const w = 940, h = 150, x = 540;
    let s = `<path d="${rr(-w / 2, 0, w, h, 34)}" fill="#FFFFFF" fill-opacity=".97" stroke="${INK}" stroke-width="5"/>`;
    s += `<path d="${rr(-w / 2 + 24, 25, 100, 100, 24)}" fill="${o.col || '#E5483D'}"/>` + (o.icon || grp(`<path d="M-16 -22L22 0L-16 22Z" fill="#FFFFFF"/>`, `translate(${-w / 2 + 74} 75)`));
    s += txt(-w / 2 + 150, 62, app, 32, '#7A7480', { anchor: 'start', weight: 700 }) + txt(w / 2 - 30, 62, o.when || 'maintenant', 28, '#9A94A0', { anchor: 'end', weight: 600 });
    s += txt(-w / 2 + 150, 104, title, 38, INK, { anchor: 'start' }) + (body ? txt(-w / 2 + 150, 140, body, 30, '#5A5460', { anchor: 'start', weight: 600 }) : '');
    return grp(s, at(x, lerp(-220, y, k) - out * 400, 1), op(1 - out));
  }
  // viseur d'enregistrement (coins, REC, minuteur, batterie)
  function recUI(t, o = {}) {
    const m = o.m || 70, w = 1080 - 2 * m, h = 1920 - 2 * m - (o.dh || 0), y0 = m + (o.dy || 0), c = o.col || '#FFFFFF', a = o.op == null ? 1 : o.op;
    const L1 = 90;
    let s = '';
    for (const [x, y, sx, sy] of [[m, y0, 1, 1], [m + w, y0, -1, 1], [m, y0 + h, 1, -1], [m + w, y0 + h, -1, -1]]) s += L(`M${x} ${y + sy * L1}V${y}H${x + sx * L1}`, c, 9);
    const on = Math.floor(t * 2) % 2 === 0;
    s += `<circle cx="${m + 60}" cy="${y0 + 64}" r="17" fill="#FF3B3B" ${op(on ? 1 : 0.25)}/>` + txt(m + 92, y0 + 78, 'REC', 44, c, { anchor: 'start', font: 'Anton', weight: 400, ls: 3 });
    const tc = Math.max(0, t - (o.t0 || 0)), mm = Math.floor(tc / 60), ss = Math.floor(tc % 60), ff = Math.floor((tc * 30) % 30);
    s += txt(m + w - 30, y0 + 78, `00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, 40, c, { anchor: 'end', font: 'Anton', weight: 400, ls: 2 });
    s += L(`M520 ${y0 + h / 2 + (o.dh || 0) * 0}H560M540 ${y0 + h / 2 - 20}V${y0 + h / 2 + 20}`, c, 4);
    return `<g ${op(a)}>${s}</g>`;
  }
  // lumière annulaire sur pied
  function ringLight(x, y, t, on = 1, s = 1) {
    let g = L('M0 0V560', '#3A3A44', 12) + L('M-90 560L0 470L90 560', '#3A3A44', 10);
    if (on > 0) g += `<circle r="${r1(150 + 30 * on)}" fill="#FFF6D8" ${op(0.45 * on)} filter="url(#soft)"/>`;
    g += `<circle r="118" fill="none" stroke="${INK}" stroke-width="44"/>` + `<circle r="118" fill="none" stroke="${mixC('#B9B4A8', '#FFFDF2', on)}" stroke-width="32"/>`;
    g += cel('M-20 -12H20V12H-20Z', '#2B2B33', { dx: 2, dy: 2, sw: 4 });
    return grp(g, at(x, y, s));
  }
  // clap de cinéma
  function clapper(x, y, t, tClap, take, s = 1, rot = 0) {
    const k = t < tClap - 0.25 ? 0 : t < tClap ? Ez.in(inv(tClap - 0.25, tClap, t)) : 1;
    const ang = lerp(-28, 0, k) + (t > tClap ? 3 * punch(t, tClap, 12, 50) : 0);
    const stripes = n => Array.from({ length: n }, (_, i) => `M${-150 + i * 60} 0l30 0l-24 -44h-30z`).join('');
    let g = cel('M-150 0H150V170H-150Z', '#26262E', { dx: 0, dy: 0 }) + L('M-130 70H130M-130 120H130M0 70V170', '#FFFFFF', 4);
    g += txt(-70, 56, 'PRISE', 34, '#FFFFFF', { font: 'Anton', weight: 400, ls: 2 }) + txt(70, 162, String(take), 54, '#FFD23F', { font: 'Anton', weight: 400 });
    g += txt(-70, 160, 'ANNIV', 34, '#FFFFFF', { font: 'Anton', weight: 400, ls: 2 }) + txt(70, 112, 'SCÈNE 1', 30, '#FFFFFF', { font: 'Anton', weight: 400 });
    g += grp(cel('M-150 -44H150V0H-150Z', '#26262E', { dx: 0, dy: 0 }) + `<path d="${stripes(5)}" fill="#FFFFFF"/>`, `rotate(${r1(ang)} -150 0)`);
    return grp(g, at(x, y, s, rot));
  }
  // bulle de BD (ellipse + pointe)
  function bubble(x, y, w, h, text, size, t, t0, o = {}) {
    if (t < t0) return '';
    const k = spring(t, t0, 2.6, 0.5), end = o.t1 ? 1 - Ez.in(inv(o.t1, o.t1 + 0.2, t)) : 1;
    const tl = o.tail || [-w * 0.2, h * 0.75];
    const tail = `M${r1(-w * 0.18)} ${r1(h * 0.3)}L${r1(tl[0])} ${r1(tl[1])}L${r1(w * 0.02)} ${r1(h * 0.38)}Z`;
    const shape = o.shout ? (() => { let d = ''; const n = 18; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, q = i % 2 ? 0.78 : 1; d += (i ? 'L' : 'M') + r1(Math.cos(a) * w / 2 * q) + ' ' + r1(Math.sin(a) * h / 2 * q); } return d + 'Z'; })()
      : `M${-w / 2} 0A${w / 2} ${h / 2} 0 1 0 ${w / 2} 0A${w / 2} ${h / 2} 0 1 0 ${-w / 2} 0Z`;
    const g = P(tail, o.fill || '#FFFFFF', 6) + P(shape, o.fill || '#FFFFFF', 6) + F(tail, o.fill || '#FFFFFF') +
      txt(0, size * 0.36, text, size, o.ink || INK, { font: o.font || 'Brico', weight: o.font === 'Anton' ? 400 : 800, ls: o.ls || 0 });
    return grp(g, at(x, y, k * end, o.rot || 0));
  }
  // écran de téléphone (cadre) autour d'un contenu (coordonnées locales -w/2..w/2, -h/2..h/2)
  function phoneFrame(x, y, w, h, inner, o = {}) {
    const id = o.id || 'pf';
    let s = `<clipPath id="${id}"><path d="${rr(-w / 2, -h / 2, w, h, 54)}"/></clipPath>`;
    s += `<path d="${rr(-w / 2 - 22, -h / 2 - 22, w + 44, h + 44, 72)}" fill="${o.body || '#1B1B22'}" stroke="${INK}" stroke-width="6"/>`;
    s += `<g clip-path="url(#${id})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${o.bg || '#000'}"/>${inner}</g>`;
    s += `<path d="${rr(-70, -h / 2 + 14, 140, 34, 17)}" fill="#0A0A0E"/>`;
    return grp(s, at(x, y, o.s || 1, o.rot || 0));
  }
  // barre d'icônes façon réseau social (cœur, commentaire, partage) avec compteurs
  function socialBar(x, y, t, likes, comments, o = {}) {
    let s = '';
    const items = [[HEART, likes, '#F25C7A', 2.4], ['M-30 -24H30Q38 -24 38 -16V12Q38 20 30 20H-6L-22 34V20H-30Q-38 20 -38 12V-16Q-38 -24 -30 -24Z', comments, '#FFFFFF', 1], ['M-30 14L6 -22V-6Q34 -6 34 26Q22 8 6 8V24Z', o.shares || '12k', '#FFFFFF', 1]];
    items.forEach(([d, n, c, sc], i) => {
      const pp = i === 0 && o.tLike ? 1 + 0.35 * punch(t, o.tLike, 6, 22) : 1;
      s += grp(`<path d="${d}" fill="${c}" stroke="${INK}" stroke-width="${i === 0 ? 3 : 5}"/>`, at(0, i * 170, (i === 0 ? 1.7 : 1.15) * pp));
      s += txt(0, i * 170 + 82, typeof n === 'number' ? (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' k' : String(Math.round(n))) : n, 36, '#FFFFFF', { stroke: INK, sw: 8 });
    });
    return grp(s, at(x, y));
  }

  // ------------------------------------------------------------------ décors
  function room(o = {}) {
    const wall = o.wall || '#F4E3C9', fl = o.floor || '#C99B6D', fy = o.fy || 1520;
    let s = `<rect x="-600" y="-600" width="2280" height="${fy + 600}" fill="${wall}"/>`;
    if (o.stripe !== false) for (let x = -600; x < 1700; x += 120) s += `<rect x="${x}" y="-600" width="56" height="${fy + 600}" fill="${o.stripe || K.shade(wall, 0.04)}"/>`;
    s += `<rect x="-600" y="${fy - 40}" width="2280" height="40" fill="${K.shade(wall, 0.18)}"/>` + L(`M-600 ${fy - 40}H1700`, INK, 4);
    s += `<rect x="-600" y="${fy}" width="2280" height="1200" fill="${fl}"/>` + L(`M-600 ${fy}H1700`, INK, 5);
    if (o.planks !== false) for (let i = 1; i < 8; i++) s += L(`M-600 ${fy + i * i * 14}H1700`, K.shade(fl, 0.12), 3);
    return s;
  }
  function windowBox(x, y, w, h, sky = '#BFE6F5', o = {}) {
    let s = cel(`M${x} ${y}H${x + w}V${y + h}H${x}Z`, sky, { dx: 0, dy: 0, sw: 7 });
    if (o.sun) s += E(x + w * 0.7, y + h * 0.3, 40, 40, '#FFE27A', 0);
    if (o.cloud !== false) s += P(`M${x + w * 0.15} ${y + h * 0.7}q20 -40 60 -20q30 -30 60 6q30 0 26 22h-150z`, '#FFFFFF', 0);
    s += L(`M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`, INK, 7);
    s += cel(`M${x - 24} ${y + h}H${x + w + 24}V${y + h + 22}H${x - 24}Z`, '#F4F1EA', { dx: 0, dy: 6, sw: 5 });
    return s;
  }
  function picture(x, y, w, h, c = '#7BD389', rot = 0) {
    return grp(cel(`M${-w / 2} ${-h / 2}H${w / 2}V${h / 2}H${-w / 2}Z`, '#FFFFFF', { dx: 6, dy: 6, sw: 6 }) + F(`M${-w / 2 + 14} ${-h / 2 + 14}H${w / 2 - 14}V${h / 2 - 14}H${-w / 2 + 14}Z`, c) +
      P(`M${-w / 2 + 14} ${h / 2 - 14}L${-w * 0.1} ${-h * 0.05}L${w * 0.08} ${h * 0.15}L${w * 0.22} ${0}L${w / 2 - 14} ${h / 2 - 14}Z`, K.shade(c, 0.25), 0), at(x, y, 1, rot));
  }
  function plant(x, y, s = 1) {
    let g = '';
    [[-50, -150, -30], [0, -190, 0], [50, -150, 30], [-30, -110, -50], [30, -110, 50]].forEach(([dx, dy, a]) => { g += grp(cel('M0 0C-26 -40 -18 -90 0 -120C18 -90 26 -40 0 0Z', '#5FB57A', { dx: 6, dy: 4, sw: 5 }), `translate(${dx * 0.2} -40) rotate(${a})`); });
    g += cel('M-50 -50H50L38 40H-38Z', '#E07A4F', { dx: 10, dy: 6 });
    return grp(g, at(x, y, s));
  }
  function table(x, y, w, h = 40, c = '#B5794A', legs = 220) {
    return cel(`M${x - w / 2 + 30} ${y + h}V${y + legs}H${x - w / 2 + 62}V${y + h}Z`, K.shade(c, 0.2), { dx: 6, dy: 0 }) + cel(`M${x + w / 2 - 62} ${y + h}V${y + legs}H${x + w / 2 - 30}V${y + h}Z`, K.shade(c, 0.2), { dx: 6, dy: 0 }) +
      cel(`M${x - w / 2} ${y}H${x + w / 2}V${y + h}H${x - w / 2}Z`, c, { dx: 0, dy: 12 });
  }
  function bowl(x, y, s = 1, mush = 0) {
    let g = cel('M-80 -10H80Q76 60 0 66Q-76 60 -80 -10Z', '#4FA3CF', { dx: 12, dy: 8 });
    const cols = ['#F6B53D', '#E5483D', '#7BD389', '#F28CB1'];
    let c = E(0, -12, 76, 18, '#FFFDF4', 4);
    for (let i = 0; i < 11; i++) { const a = i * 2.3, dx = Math.cos(a) * (14 + i * 5.5), dy = Math.sin(a) * 9 - 14; c += mush > 0.5 ? E(dx, dy + 4, 12, 6, K.shade('#F6C88A', 0.1), 0) : `<circle cx="${r1(dx)}" cy="${r1(dy)}" r="11" fill="none" stroke="${cols[i % 4]}" stroke-width="7"/>`; }
    if (mush > 0.5) c += P('M-60 -16Q-30 -26 0 -18Q30 -28 60 -16', '#E8D8B0', 4);
    return grp(c + g, at(x, y, s));
  }
  function door(x, y, w = 260, h = 520, open = 0, c = '#B5794A') {
    let s = cel(`M${x - w / 2 - 20} ${y}V${y - h - 20}H${x + w / 2 + 20}V${y}Z`, '#F4F1EA', { dx: 0, dy: 0 }) + F(`M${x - w / 2} ${y}V${y - h}H${x + w / 2}V${y}Z`, '#3B2B22');
    const ww = w * Math.cos(open * 1.25);
    s += cel(`M${x - w / 2} ${y}V${y - h}H${x - w / 2 + ww}V${y}Z`, c, { dx: 10, dy: 0, inner: P(`M${x - w / 2 + ww * 0.15} ${y - h * 0.9}H${x - w / 2 + ww * 0.85}V${y - h * 0.55}H${x - w / 2 + ww * 0.15}Z`, K.shade(c, 0.12), 4) });
    if (ww > 40) s += E(x - w / 2 + ww * 0.85, y - h * 0.45, 12, 12, '#F6B53D', 4);
    return s;
  }
  function balloon(x, y, c, t, seed, s = 1) {
    const dx = Math.sin(t * 1.3 + seed) * 10, dy = Math.sin(t * 1.7 + seed * 2) * 8;
    return grp(L(`M0 90Q20 200 -10 320`, INK, 3) + cel('M0 -90C70 -90 76 40 0 90C-76 40 -70 -90 0 -90Z', c, { dx: 14, dy: 10 }) + E(-26, -40, 12, 22, '#FFFFFF', 0, 'opacity=".55"') + P('M-10 90L0 104L10 90Z', c, 4), at(x + dx, y + dy, s, Math.sin(t + seed) * 4));
  }
  function garland(y, n = 11, t = 0) {
    let s = L(`M-60 ${y - 10}Q540 ${y + 110} 1140 ${y - 10}`, INK, 4);
    for (let i = 0; i < n; i++) { const x = 20 + i * 100, yy = y + Math.sin(i / (n - 1) * Math.PI) * 60, sw = Math.sin(t * 2 + i) * 4; s += P(`M${x} ${yy}L${x + 80} ${yy + 4}L${x + 40 + sw} ${yy + 70}Z`, ['#E5483D', '#F6B53D', '#4FA3CF', '#7BD389'][i % 4], 4); }
    return s;
  }
  function locker(x, y, c = '#4FA3CF', n = 1) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const xx = x + i * 150;
      s += cel(`M${xx} ${y}V${y - 560}H${xx + 146}V${y}Z`, c, { dx: 10, dy: 0, inner: L(`M${xx + 30} ${y - 500}H${xx + 116}M${xx + 30} ${y - 480}H${xx + 116}M${xx + 30} ${y - 460}H${xx + 116}`, K.shade(c, 0.25), 6) + E(xx + 120, y - 300, 8, 18, K.shade(c, 0.35), 3) });
    }
    return s;
  }
  function bike(x, y, s = 1, rot = 0, wheel = 0) {
    const wh = cx => `<circle cx="${cx}" cy="0" r="78" fill="none" stroke="${INK}" stroke-width="12"/><circle cx="${cx}" cy="0" r="78" fill="none" stroke="#3A3A44" stroke-width="5"/>` +
      L([0, 1, 2].map(i => { const a = wheel + i * Math.PI / 3; return `M${r1(cx + Math.cos(a) * 74)} ${r1(Math.sin(a) * 74)}L${r1(cx - Math.cos(a) * 74)} ${r1(-Math.sin(a) * 74)}`; }).join(''), '#8A8D96', 3) + E(cx, 0, 10, 10, '#8A8D96', 4);
    let g = wh(-130) + wh(130);
    g += P('M-130 0L-40 -110H90L130 0M-40 -110L10 0L90 -110M10 0L-130 0', '#E5483D', 12).replace('fill="#E5483D"', 'fill="none"').replace(/stroke="[^"]*"/, 'stroke="#E5483D"');
    g += L('M-130 0L-40 -110H90L130 0M-40 -110L10 0L90 -110M10 0L-130 0', '#E5483D', 11);
    g += L('M90 -110L110 -170M80 -176H140', INK, 9) + L('M-40 -110L-50 -140', INK, 8) + cel('M-90 -150H-10Q0 -150 -6 -138H-86Q-96 -140 -90 -150Z', '#26262E', { dx: 2, dy: 2, sw: 5 });
    return grp(g, at(x, y, s, rot));
  }
  function tub(x, y, s = 1, t = 0) {
    let g = cel('M-300 -120H300Q300 120 180 140H-180Q-300 120 -300 -120Z', '#FFFFFF', { dx: 22, dy: 10 });
    g += L('M-250 140L-260 190M250 140L260 190', INK, 12);
    return grp(g, at(x, y, s));
  }
  function bubbles(x, y, w, t, seed, n = 16) {
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - 0.5) * w, by = y + (r() - 0.5) * 40 + Math.sin(t * 2 + i) * 6, br = 26 + r() * 30;
      s += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="${r1(br)}" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>` + E(bx - br * 0.3, by - br * 0.35, br * 0.22, br * 0.14, '#BFE6F5', 0);
    }
    return s;
  }
  function duck(x, y, s = 1, rot = 0) {
    return grp(cel('M-50 0Q-56 -46 -6 -40Q10 -86 44 -70Q66 -56 52 -30Q74 -30 76 -18Q60 -10 46 -14Q40 20 -10 22Q-46 22 -50 0Z', '#FFD23F', { dx: 8, dy: 6, sw: 5 }) + E(30, -58, 5, 6, INK, 0) + P('M52 -32L80 -26L54 -16Z', '#F2913D', 4), at(x, y, s, rot));
  }
  function diaperPack(x, y, s = 1, rot = 0) {
    let g = cel('M-130 -170H130V170H-130Z', '#7EC8F2', { dx: 16, dy: 10 }) + F('M-130 60H130V170H-130Z', '#FFFFFF') + L('M-130 60H130', INK, 5);
    g += txt(0, -90, 'COUCHOU', 54, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 9, ls: 2 }) + txt(0, 130, 'ULTRA DOUX', 30, '#4FA3CF', { ls: 2 });
    g += grp(cel('M-56 -10Q0 30 56 -10V30Q0 70 -56 30Z', '#FFFFFF', { dx: 4, dy: 4, sw: 4 }) + E(0, -14, 26, 26, '#F4C9A8', 4) + E(-9, -16, 3, 4, INK, 0) + E(9, -16, 3, 4, INK, 0) + L('M-8 -4Q0 2 8 -4', INK, 3), 'translate(0 -6)');
    return grp(g, at(x, y, s, rot));
  }
  function cake(x, y, s, t, lit = true) {
    let g = cel('M-140 -90H140V40H-140Z', '#F28CB1', { dx: 16, dy: 8 }) + cel('M-160 40H160V70H-160Z', '#FFFFFF', { dx: 0, dy: 6 }) + L('M-140 -60Q-110 -36 -80 -60Q-50 -36 -20 -60Q10 -36 40 -60Q70 -36 100 -60Q120 -40 140 -60', '#FFFFFF', 9);
    [-70, 0, 70].forEach((cx, i) => { g += cel(`M${cx - 8} -90V-150H${cx + 8}V-90Z`, ['#4FA3CF', '#F6B53D', '#7BD389'][i], { dx: 3, dy: 3, sw: 4 }); if (lit) g += P(`M${cx} ${-186 + Math.sin(t * 20 + i) * 3}q13 18 0 32q-13 -14 0 -32z`, '#FFC83D', 3); });
    return grp(g, at(x, y, s));
  }
  function phoneObj(x, y, s = 1, rot = 0, o = {}) {
    let g = cel('M-38 -70H38Q48 -70 48 -60V60Q48 70 38 70H-38Q-48 70 -48 60V-60Q-48 -70 -38 -70Z', o.col || '#2A2D38', { dx: 5, dy: 5, sw: 5 });
    g += F('M-38 -58H38V52H-38Z', o.screen || '#7FC8F0') + (o.rec ? `<circle cx="22" cy="-42" r="7" fill="#FF3B3B"/>` : '');
    return grp(g, at(x, y, s, rot));
  }
  const shadowE = (x, y, w, o = 0.13) => `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(w)}" ry="${r1(w * 0.16)}" fill="#000" ${op(o)}/>`;

  // ------------------------------------------------------------------ acteurs : poses mélangées + couche de vie
  // keys : [[t, pose], …] ; pose = { g: 'geste', expr, exprOver, arms, lean, tilt, … , d (durée), e ('spring' | 'io' | 'lin') }
  const SCAL = ['x', 'y', 'scale', 'lean', 'tilt', 'turn', 'nod', 'crouch', 'shrug', 'bob', 'jump', 'sway', 'squash', 'bodyTurn', 'hairSway', 'stance'];
  const lerpAng = (a, b, k) => { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * k; };
  function resolve(cast, p) {
    const g = p.g ? K.geste(p.g, cast.body) : {};
    const o = Object.assign({}, g, p);
    if (p.exprOver || g.exprOver) o.exprOver = Object.assign({}, g.exprOver || {}, p.exprOver || {});
    if (p.armsOver) o.arms = Object.assign({}, o.arms, p.armsOver);
    const sp0 = Object.assign({}, K.BODY[cast.body], cast.spec || {});
    if (o.arms) o.arms = { l: typeof o.arms.l === 'string' ? K.place(o.arms.l, -1, sp0) : o.arms.l, r: typeof o.arms.r === 'string' ? K.place(o.arms.r, 1, sp0) : o.arms.r };
    const base = Object.assign({}, cast, o);
    const arms = {};
    for (const [nm, sd] of [['l', -1], ['r', 1]]) arms[nm] = K.armSolve(base, sd, (o.arms || {})[nm]);
    const face = K.expr(o.expr || 'neutre', o.exprOver);
    const out = { arms, face, flip: o.flip, rec: o.rec, lift: o.lift, front: o.front, hasArms: !!(p.g || p.arms || p.armsOver), hasFace: !!(p.g || p.expr || p.exprOver) };
    for (const n of SCAL) if (o[n] != null) out[n] = o[n];
    return out;
  }
  function blendArm(sp, side, A, B, k, shrug) {
    const W = [lerp(A.W[0], B.W[0], k), lerp(A.W[1], B.W[1], k)], Eg = [lerp(A.E[0], B.E[0], k), lerp(A.E[1], B.E[1], k)];
    const S = [side * (sp.shO - 16), sp.shY + 32 - (shrug || 0) * 16];
    const p = K.prims.ik2(S, sp.arm[0], sp.arm[1], W, 1), q = K.prims.ik2(S, sp.arm[0], sp.arm[1], W, -1);
    const dp = Math.hypot(p.E[0] - Eg[0], p.E[1] - Eg[1]), dq = Math.hypot(q.E[0] - Eg[0], q.E[1] - Eg[1]);
    const E1 = (dp < dq ? p : q).E;
    return { E: E1, W: (dp < dq ? p : q).W, hand: k < 0.5 ? A.hand : B.hand, back: k < 0.5 ? A.back : B.back, rot: lerpAng(A.rot, B.rot, k) };
  }
  function blend(sp, A, B, k, ke) {
    // ce qu'une pose ne précise pas est hérité de la pose précédente (position, bras, visage)
    const o = { arms: {}, face: B.hasFace ? K.mixExpr(A.face, B.face, ke) : A.face, flip: B.flip == null ? A.flip : (ke < 0.5 ? A.flip : B.flip), rec: B.rec == null ? A.rec : (ke < 0.5 ? A.rec : B.rec), front: B.front, hasArms: true, hasFace: true };
    const held = n => n === 'x' || n === 'y' || n === 'scale' || n === 'flip';
    for (const n of SCAL) {
      const dflt = n === 'scale' ? 1 : 0, a = A[n] == null ? dflt : A[n];
      const b = B[n] == null ? (held(n) || !B.hasArms ? a : dflt) : B[n];
      o[n] = lerp(a, b, held(n) ? clamp(k, -0.2, 1.2) : k);
    }
    const la = A.lift || [0, 0], lb = B.lift || (B.hasArms ? [0, 0] : la);
    o.lift = [lerp(la[0], lb[0], k), lerp(la[1], lb[1], k)];
    const shrug = o.shrug;
    if (B.hasArms) { o.arms.l = blendArm(sp, -1, A.arms.l, B.arms.l, k, shrug); o.arms.r = blendArm(sp, 1, A.arms.r, B.arms.r, k, shrug); }
    else o.arms = A.arms;
    return o;
  }
  const kOf = (t, t0, p) => {
    const d = p.d || 0.32, e = p.e || 'spring';
    if (e === 'lin') return inv(t0, t0 + d, t);
    if (e === 'io') return Ez.io(inv(t0, t0 + d, t));
    if (e === 'cut') return t >= t0 ? 1 : 0;
    return clamp(spring(t, t0, 0.62 / d, p.z || 0.62), -0.3, 1.3);
  };
  const cache = new Map();
  function stateAt(cast, keys, t) {
    const sp = Object.assign({}, K.BODY[cast.body], cast.spec || {});
    const R = keys.map(k => { if (!k._r) k._r = resolve(cast, k[1]); return k._r; });
    let s = Object.assign({}, R[0], { lift: R[0].lift || [0, 0], flip: !!R[0].flip });
    for (let j = 1; j < keys.length; j++) {
      if (t < keys[j][0]) break;
      const p = keys[j][1], k = kOf(t, keys[j][0], p), ke = p.e === 'cut' ? (t >= keys[j][0] ? 1 : 0) : Ez.io(inv(keys[j][0], keys[j][0] + (p.de || Math.max(0.16, (p.d || 0.32) * 0.8)), t));
      s = blend(sp, s, R[j], k, ke);
    }
    return s;
  }
  // couche de vie : respiration, balancement, clignements, saccades du regard, cheveux qui suivent
  function life(o, t, seed, amp, tk) {
    const id = K.idle(t, seed, amp);
    o.bob = (o.bob || 0) + id.bob; o.tilt = (o.tilt || 0) + id.tilt; o.lean = (o.lean || 0) + id.lean * 0.6; o.turn = (o.turn || 0) + id.turn;
    o.shrug = (o.shrug || 0) + Math.sin(t * 2.1 + seed) * 0.05 * amp;
    const f = o.face;
    if (!f.closed && !f.happy) {
      const per = 0.7 + hash(seed * 7 + Math.floor((t + seed) / 0.9)) * 0.6, slot = Math.floor((t + seed * 0.37) / per);
      const g0 = [hash(slot * 13 + seed) - 0.5, hash(slot * 17 + seed + 3) - 0.5], g1 = [hash((slot - 1) * 13 + seed) - 0.5, hash((slot - 1) * 17 + seed + 3) - 0.5];
      const k = Ez.out(clamp(((t + seed * 0.37) % per) / 0.06));
      const amt = 0.22 * (o.gaze == null ? 1 : o.gaze);
      f.lx = clamp(f.lx + lerp(g1[0], g0[0], k) * amt, -1, 1); f.ly = clamp(f.ly + lerp(g1[1], g0[1], k) * amt * 0.6, -1, 1);
      o.blink = Math.max(o.blink || 0, K.blinkAt(t, seed));
    }
    f.bUp += Math.sin(t * 1.7 + seed) * 1.2 * amp;
    o.hairSway = (o.hairSway || 0) + id.hairSway - (tk.dTilt || 0) * 0.9 - (tk.dTurn || 0) * 40 + (tk.dx || 0) * -0.06;
    return o;
  }
  // rend un acteur : cast (look), keys (poses), t, extra (options fixes : walk, life…)
  function actor(cast, keys, t, extra = {}) {
    const s = stateAt(cast, keys, t), s0 = stateAt(cast, keys, t - 0.07);
    const o = Object.assign({}, cast, extra, { t });
    for (const n of SCAL) o[n] = (s[n] || 0) + (extra[n] || 0);
    o.scale = (s.scale == null ? 1 : s.scale) * (extra.scale || 1);
    o.lift = [s.lift[0] + ((extra.lift || [0, 0])[0]), s.lift[1] + ((extra.lift || [0, 0])[1])];
    o.flip = extra.flip != null ? extra.flip : s.flip;
    o.rec = extra.rec != null ? extra.rec : s.rec;
    o.face = Object.assign({}, s.face, extra.fx || {});
    o.arms = { l: { pts: s.arms.l }, r: { pts: s.arms.r } };
    if (extra.walk) {
      const w = K.walk(t + (extra.walkPh || 0), { speed: extra.walk, amp: extra.walkAmp || 1 });
      o.lift = [o.lift[0] + w.lift[0], o.lift[1] + w.lift[1]]; o.bob += w.bob; o.sway += w.sway; o.tilt += w.tilt; o.hairSway += w.hairSway;
      if (extra.walkArms) o.arms = w.arms;
    }
    // transfert de poids + clignement à chaque nouvelle pose
    const amp = extra.life == null ? 1 : extra.life;
    for (let j = 1; j < keys.length; j++) {
      const dt = t - keys[j][0];
      if (dt < 0) break;
      if (dt < 0.5) {
        o.bob += 9 * amp * Math.sin(Math.PI * dt / 0.5) * Math.exp(-dt * 2.5);
        const p = keys[j][1];
        if ((p.expr || p.g) && p.e !== 'cut' && dt < 0.15 && !o.face.closed) o.blink = Math.max(o.blink || 0, Math.sin(Math.PI * dt / 0.15));
      }
    }
    // étirement en montée, écrasement en descente (sauts)
    const vj = ((s.jump || 0) - (s0.jump || 0)) / 0.07;
    if (Math.abs(vj) > 1) o.squash = (o.squash || 0) + clamp(-vj * 0.0005, -0.12, 0.1);
    // la tête suit le buste avec un léger retard
    o.tilt += -((s.lean || 0) - (s0.lean || 0)) * 0.9;
    const tk = { dTilt: (s.tilt || 0) - (s0.tilt || 0), dTurn: (s.turn || 0) - (s0.turn || 0), dx: (s.x || 0) - (s0.x || 0) };
    life(o, t, extra.seed || 1, extra.life == null ? 1 : extra.life, tk);
    if (extra.blink != null) o.blink = Math.max(o.blink || 0, extra.blink);
    delete o.expr; delete o.exprOver;
    return K.person(o);
  }

  // position monde d'un poignet (pour les objets tenus : cuillère, paquet, carton…)
  function handPos(cast, keys, t, side, extra = {}) {
    const s = stateAt(cast, keys, t), sp = Object.assign({}, K.BODY[cast.body], cast.spec || {});
    const W = (side < 0 ? s.arms.l : s.arms.r).W;
    const sc = (s.scale == null ? 1 : s.scale) * (extra.scale || 1), x = (s.x || 0) + (extra.x || 0), y = (s.y || 0) + (extra.y || 0);
    const drop = (s.crouch || 0) * (sp.waistY * -0.28) + (s.bob || 0), a = ((s.lean || 0) + (sp.stoop || 0)) * Math.PI / 180;
    const dx = W[0], dy = W[1] - sp.waistY, wx = dx * Math.cos(a) - dy * Math.sin(a) + (s.sway || 0), wy = dx * Math.sin(a) + dy * Math.cos(a) + sp.waistY + drop;
    const fl = (extra.flip != null ? extra.flip : s.flip) ? -1 : 1;
    return [x + sc * fl * wx, y + sc * wy];
  }

  window.PCH = { handPos, K, INK, P, F, L, E, G, cel, clamp, lerp, inv, r1, r2, Ez, spring, punch, decay, bump, rng, hash, noise1, mixC, esc, txt, grp, at, op, measure, rr, fmt,
    STAR, HEART, rays, ring, sparkles, confetti, hearts, speedLines, flashBurst, springWord, stamp, counter, notif, recUI, ringLight, clapper, bubble, phoneFrame, socialBar,
    room, windowBox, picture, plant, table, bowl, door, balloon, garland, locker, bike, tub, bubbles, duck, diaperPack, cake, phoneObj, shadowE, actor, stateAt };
})();
