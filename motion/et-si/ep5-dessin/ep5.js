// « Et si… tout ce que tu dessines devenait réel ? » — moteur seek(t), 1080 x 1920.
// Tout est calculé à partir du temps : aucune minuterie, aucun état entre deux images.
(function () {
  const W = 1080, H = 1920, DUR = 56.7;
  const R = window.EtSi, INK = R.INK;
  const { union, ell, line, path } = R.prims;

  // ------------------------------------------------------------------ outils
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const inv = (a, b, t) => clamp((t - a) / (b - a));
  const Ez = {
    io: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    out: k => 1 - Math.pow(1 - k, 3),
    o5: k => 1 - Math.pow(1 - k, 5),
    in: k => k * k * k,
    back: k => { const c = 1.8; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  };
  // réponse indicielle d'un ressort (0 -> 1 à partir de t0)
  function spring(t, t0, f = 2.6, z = 0.5) {
    if (t <= t0) return 0;
    const x = t - t0, w = 2 * Math.PI * f;
    if (z >= 1) return 1 - Math.exp(-w * x) * (1 + w * x);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }
  // impulsion qui décroît (pour les « punchs » de caméra)
  const punch = (t, t0, k = 7) => t < t0 ? 0 : Math.exp(-(t - t0) * k) * Math.cos((t - t0) * 30);
  const decay = (t, t0, k = 6) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  const hash = n => { const r = rng(n * 9301 + 49297); return r(); };
  const noise1 = (t, s) => Math.sin(t * 13.1 + s) * 0.5 + Math.sin(t * 7.3 + s * 2.1) * 0.3 + Math.sin(t * 23.7 + s * 0.7) * 0.2;
  const mix = (c1, c2, k) => {
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, '0')).join('');
  };
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function txt(x, y, s, size, fill, o = {}) {
    const st = o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw || 10}" stroke-linejoin="round" paint-order="stroke"` : '';
    const tf = o.rot ? `transform="rotate(${o.rot} ${x} ${y})"` : '';
    return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="${o.font || 'Brico'}" font-weight="${o.weight || 800}" text-anchor="${o.anchor || 'middle'}" letter-spacing="${o.ls || 0}" opacity="${o.op == null ? 1 : o.op}" ${st} ${tf}>${esc(s)}</text>`;
  }
  const grp = (inner, tf = '', extra = '') => `<g ${tf ? `transform="${tf}"` : ''} ${extra}>${inner}</g>`;

  // mesure de texte (sous-titres)
  const cv = document.createElement('canvas').getContext('2d');
  const measure = (s, size, font = 'Brico', weight = 800) => { cv.font = `${weight} ${size}px ${font}`; return cv.measureText(s).width; };

  // ------------------------------------------------------------------ primitives graphiques
  function bubble(cx, cy, w, h, o = {}) {
    const s = o.s == null ? 1 : o.s;
    if (s <= 0.01) return '';
    const seed = o.seed || 1, fill = o.fill || '#FFFFFF';
    const n = Math.max(7, Math.round((w + h) / 75));
    const shapes = [{ t: 'ell', cx: 0, cy: 0, rx: r1(w / 2 * 0.9), ry: r1(h / 2 * 0.82) }];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + seed;
      const rr = Math.min(w, h) * (0.2 + 0.07 * hash(seed * 31 + i));
      shapes.push({ t: 'ell', cx: r1(Math.cos(a) * w / 2 * 0.84), cy: r1(Math.sin(a) * h / 2 * 0.78), rx: r1(rr), ry: r1(rr) });
    }
    let tail = '';
    if (o.tail) {
      const dx = o.tail[0] - cx, dy = o.tail[1] - cy, L = Math.hypot(dx, dy);
      const e = Math.min(w, h) * 0.5;
      [[0.0, 0.16], [0.45, 0.1], [0.82, 0.06]].forEach(([k, r]) => {
        const d = e + (L - e) * k;
        tail += ell(dx / L * d, dy / L * d, Math.min(w, h) * r, Math.min(w, h) * r, fill);
      });
    }
    let t = '';
    if (o.lines) {
      const fs = o.fs || 40, lh = fs * 1.12, y0 = -((o.lines.length - 1) * lh) / 2 + fs * 0.35;
      o.lines.forEach((l, i) => { t += txt(0, r1(y0 + i * lh), l, fs, o.ink || INK, { font: o.font || 'Brico', weight: o.weight || 800 }); });
    }
    const inner = o.inner || '';
    return grp(tail + union(shapes, fill) + inner + t, `translate(${r1(cx)} ${r1(cy)}) rotate(${o.rot || 0}) scale(${r1(s * 1000) / 1000})`, o.op != null ? `opacity="${o.op}"` : '');
  }
  const r1 = v => Math.round(v * 10) / 10;

  function rays(cx, cy, n, Rr, rot, c) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + rot, a1 = a0 + Math.PI / n;
      d += `M${cx} ${cy}L${r1(cx + Math.cos(a0) * Rr)} ${r1(cy + Math.sin(a0) * Rr)}L${r1(cx + Math.cos(a1) * Rr)} ${r1(cy + Math.sin(a1) * Rr)}Z`;
    }
    return `<path d="${d}" fill="${c}"/>`;
  }
  function ring(cx, cy, t, t0, dur, Rmax, col = '#FFFFFF', w0 = 26) {
    const k = inv(t0, t0 + dur, t);
    if (k <= 0 || k >= 1) return '';
    const e = Ez.o5(k);
    return `<circle cx="${cx}" cy="${cy}" r="${r1(e * Rmax)}" fill="none" stroke="${col}" stroke-width="${r1(w0 * (1 - k))}" opacity="${r1((1 - k) * 100) / 100}"/>`;
  }
  const STAR = r => `M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z`;
  function sparkles(cx, cy, t, t0, n, spread, seed, cols = ['#FFFFFF', '#FFE27A']) {
    const k = inv(t0, t0 + 1.1, t);
    if (k <= 0 || k >= 1) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = spread * (0.4 + r() * 0.6) * Ez.o5(k), sz = 10 + r() * 22;
      const sc = Math.sin(Math.PI * clamp(k * 1.3 - r() * 0.2));
      s += `<path d="${STAR(sz)}" fill="${cols[i % cols.length]}" transform="translate(${r1(cx + Math.cos(a) * d)} ${r1(cy + Math.sin(a) * d)}) rotate(${r1(k * 180 * (r() - 0.5))}) scale(${r1(Math.max(0, sc) * 100) / 100})"/>`;
    }
    return s;
  }
  function confetti(cx, cy, t, t0, n, seed) {
    const dt = t - t0;
    if (dt <= 0 || dt > 2.6) return '';
    const r = rng(seed), cols = ['#F6B53D', '#E5483D', '#4FA3CF', '#7BD389', '#F28CB1', '#FFFFFF'];
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = 900 + r() * 1300;
      const x = cx + Math.cos(a) * v * dt * 0.9, y = cy + Math.sin(a) * v * dt + 1500 * dt * dt;
      const rot = (r() - 0.5) * 1400 * dt, w = 14 + r() * 14, h = 8 + r() * 8;
      s += `<rect x="${r1(-w / 2)}" y="${r1(-h / 2)}" width="${r1(w)}" height="${r1(h)}" fill="${cols[i % cols.length]}" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(1 ${r1(Math.cos(dt * 9 + i) * 100) / 100})" opacity="${r1(clamp(2.6 - dt) * 100) / 100}"/>`;
    }
    return s;
  }
  const HEART = 'M0 12C-26 -8 -30 -30 -14 -36C-6 -39 0 -32 0 -26C0 -32 6 -39 14 -36C30 -30 26 -8 0 12Z';
  function hearts(cx, cy, t, t0, n, seed) {
    const dt = t - t0;
    if (dt <= 0 || dt > 2.2) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const d0 = r() * 0.4, k = clamp((dt - d0) / 1.6);
      if (k <= 0) continue;
      const x = cx + (r() - 0.5) * 300 + Math.sin(dt * 4 + i) * 20, y = cy - Ez.out(k) * (110 + r() * 130);
      const sc = (0.8 + r() * 0.9) * Math.sin(Math.PI * k) * 1.6;
      s += `<path d="${HEART}" fill="#F25C7A" stroke="${INK}" stroke-width="4" transform="translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 100) / 100})"/>`;
    }
    return s;
  }
  function speedLines(cx, cy, t, n, seed, op = 0.5, col = '#FFFFFF') {
    const r = rng(seed + Math.floor(t * 20)); let d = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, r0 = 520 + r() * 260, r2 = r0 + 400 + r() * 600, wdt = 0.004 + r() * 0.01;
      d += `M${r1(cx + Math.cos(a) * r0)} ${r1(cy + Math.sin(a) * r0)}L${r1(cx + Math.cos(a - wdt) * r2)} ${r1(cy + Math.sin(a - wdt) * r2)}L${r1(cx + Math.cos(a + wdt) * r2)} ${r1(cy + Math.sin(a + wdt) * r2)}Z`;
    }
    return `<path d="${d}" fill="${col}" opacity="${op}"/>`;
  }
  // lettres qui arrivent une à une en ressort
  function springWord(x, y, word, size, t, t0, o = {}) {
    const font = o.font || 'Anton', fill = o.fill || '#FFFFFF';
    const total = measure(word, size, font, 400) + (word.length - 1) * (o.ls || 0);
    let cx = x - total / 2, s = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], wch = measure(ch, size, font, 400);
      const k = spring(t, t0 + i * (o.stag || 0.045), o.f || 2.4, o.z || 0.45);
      const yy = y + (1 - k) * (o.dy == null ? 120 : o.dy);
      if (k > 0.001) s += `<text x="${r1(cx + wch / 2)}" y="${r1(yy)}" font-size="${size}" font-family="${font}" text-anchor="middle" fill="${fill}" stroke="${o.stroke || INK}" stroke-width="${o.sw || 12}" stroke-linejoin="round" paint-order="stroke" transform="rotate(${r1((1 - k) * (o.rot == null ? -12 : o.rot))} ${r1(cx + wch / 2)} ${r1(yy)}) scale(1)" opacity="${clamp(k * 3)}">${esc(ch)}</text>`;
      cx += wch + (o.ls || 0);
    }
    return s;
  }

  // ------------------------------------------------------------------ minutage (temps film, cf. cues.js)
  const T = {
    dessines0: 2.02, reel: 2.7,
    chat: 4.22, sort: 5.02, page: 5.5, miaou: 6.2,
    pizza: 7.16, manges: 8.12, baskets: 8.92, pieds: 10.0,
    porte: 11.76, mur: 12.2, derriere: 12.92, plage: 13.72,
    mais: 15.23, cahier: 15.9, pique: 16.91, crayon: 17.26,
    oreilles: 18.78, poussent: 19.94, vrai: 20.78,
    monstre: 22.22, enorme: 22.86, rate: 23.66, enorme2: 24.62,
    mange: 26.27, pizza2: 26.7, baskets2: 27.18, porte2: 28.14,
    gomme: 30.16, eff1: 30.84, eff2: 31.96, eff3: 33.24, rien: 35.12,
    souffles: 36.34, la: 37.9, truc: 38.86,
    gomme2: 40.06, maison: 41.74, toit: 42.38, pleuvoir: 44.82,
    ettoi: 46.2, dessinerais: 47.0, disle: 48.36, abonne: 49.48, like: 50.2, etsi: 51.16,
  };
  const blinkAt = (t, seed) => {
    const per = 3.1 + hash(seed) * 1.7, ph = (t + hash(seed + 5) * per) % per;
    return ph < 0.13 ? Math.sin(ph / 0.13 * Math.PI) : 0;
  };
  function blend(t, keys, f = 2.3, z = 0.6) {
    const out = JSON.parse(JSON.stringify(keys[0][1]));
    for (let i = 1; i < keys.length; i++) {
      const [ti, P] = keys[i], Q = keys[i - 1][1];
      if (t < ti) break;
      const k = spring(t, ti, f, z), k2 = spring(t, ti + 0.06, f * 0.8, z * 0.85);
      for (const n in P) {
        const v = P[n], q = Q[n];
        if (typeof v === 'number') out[n] += (v - q) * k;
        else if (Array.isArray(v)) v.forEach((x, j) => {
          if (typeof x === 'number') out[n][j] += (x - q[j]) * (j === 1 ? k2 : k);
          else if (k > 0.45) out[n][j] = x;
        });
        else if (k > 0.45) out[n] = v;
      }
    }
    return out;
  }
  // vie permanente : respiration, poids, tête
  function alive(p, t, seed, amp = 1) {
    p.bob = (p.bob || 0) + Math.sin(t * 2.3 + seed) * 3.5 * amp;
    p.tilt = (p.tilt || 0) + noise1(t * 0.45, seed) * 2.6 * amp;
    p.lean = (p.lean || 0) + Math.sin(t * 0.9 + seed * 2) * 1.2 * amp;
    for (const s of ['l', 'r']) if (p.arms && p.arms[s]) { p.arms[s][0] += Math.sin(t * 1.7 + seed + (s === 'l' ? 0 : 1.3)) * 2.2 * amp; }
    return p;
  }
  const LA = (sd, x, y, bend = 1) => R.prims.ik(sd * 88, -384, sd, 96, 88, x, y, bend);       // Léo
  const MA = (sd, x, y, bend = 1) => R.prims.ik(sd * 96, -482, sd, 104, 96, x, y, bend);      // Max
  const PA = (sd, x, y, bend = 1) => R.prims.ik(sd * 58, -300, sd, 70, 66, x, y, bend);       // passants
  const arm = (ang, hand) => [ang[0], ang[1], hand];

  // bulle de parole « vérité » (contour en éclats), mots qui apparaissent au rythme de la voix
  function truthBubble(cx, cy, w, h, words, t, o = {}) {
    const s = spring(t, words[0][1] - 0.15, 2.6, 0.5) * (o.out ? 1 - Ez.in(inv(o.out, o.out + 0.25, t)) : 1);
    if (s < 0.01) return '';
    const n = 22;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, r = i % 2 ? 0.86 : 1.0;
      d += `${i ? 'L' : 'M'}${r1(Math.cos(a) * w / 2 * r)} ${r1(Math.sin(a) * h / 2 * r)}`;
    }
    const tail = o.tail ? `<path d="M${o.tail[0] * 0.25} ${h * 0.3}L${o.tail[0]} ${o.tail[1]}L${o.tail[0] * 0.25 + 60} ${h * 0.34}Z" fill="${o.fill || '#FFFFFF'}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` : '';
    let txtS = '';
    const fs = o.fs || 58, lines = o.lines;
    lines.forEach((ln, li) => {
      const y = (li - (lines.length - 1) / 2) * fs * 1.15 + fs * 0.35;
      const tot = ln.reduce((a, i) => a + measure(words[i][0] + ' ', fs, 'Anton', 400) + fs * 0.18, 0);
      let x = -tot / 2;
      ln.forEach(i => {
        const [wd, ts] = words[i], ww = measure(wd + ' ', fs, 'Anton', 400) + fs * 0.18, k = spring(t, ts - 0.04, 3.2, 0.5);
        if (k > 0.01) txtS += `<text x="${r1(x + ww / 2)}" y="${r1(y)}" font-family="Anton" font-size="${fs}" text-anchor="middle" fill="${o.ink || INK}" transform="translate(${r1(x + ww / 2)} ${r1(y)}) scale(${r1(k * 100) / 100}) translate(${r1(-(x + ww / 2))} ${r1(-y)})">${esc(wd)}</text>`;
        x += ww;
      });
    });
    return grp(tail + `<path d="${d}Z" fill="${o.fill || '#FFFFFF'}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>` + txtS,
      `translate(${cx} ${cy}) rotate(${o.rot || 0}) scale(${r1(s * 100) / 100})`);
  }
  // tampon « VÉRITÉ » / « MENSONGE »
  function stamp(cx, cy, label, col, t, t0, rot = -12) {
    const k = spring(t, t0, 3.4, 0.45);
    if (k < 0.01) return '';
    const w = measure(label, 92, 'Anton', 400) + 70;
    return grp(`<rect x="${-w / 2}" y="-70" width="${w}" height="120" rx="16" fill="none" stroke="${col}" stroke-width="12"/>` +
      txt(0, 22, label, 92, col, { font: 'Anton', weight: 400, ls: 4 }), `translate(${cx} ${cy}) rotate(${rot}) scale(${r1((2.2 - 1.2 * k) * 100) / 100})`, `opacity="${r1(clamp(k * 2) * 0.92 * 100) / 100}"`);
  }
  function cam2(keys, t) {
    let z = keys[0][1], x = keys[0][2], y = keys[0][3];
    for (let i = 1; i < keys.length; i++) {
      const [ti, zi, xi, yi, d] = keys[i];
      if (t < ti) break;
      const k = d > 0 ? Ez.io(inv(ti, ti + d, t)) : 1;
      z = Math.exp(lerp(Math.log(z), Math.log(zi), k)); x = lerp(x, xi, k); y = lerp(y, yi, k);
    }
    return { z, fx: x, fy: y, rot: 0 };
  }
  const STUDENTS = [ // [x, y, échelle, rangée, look]
    { x: 180, y: 1760, s: 1.25, row: 1, coat: '#7FB7BE', hairStyle: 'casquette', skin: '#C98E62', hair: '#3D6FB6' },
    { x: 520, y: 1330, s: 0.95, row: 0, coat: '#B5D99C', hairStyle: 'court', skin: '#F4CDB0', hair: '#8A4B2A' },
    { x: 800, y: 1330, s: 0.95, row: 0, coat: '#F4D06F', hairStyle: 'afro', skin: '#5E3A26', hair: '#1E1410' },
    { x: 1080, y: 1330, s: 0.95, row: 0, coat: '#9AA0B5', hairStyle: 'chignon', skin: '#E9B48C', hair: '#4A3226' },
  ];
  function classroomBg(t) {
    let w = `<rect x="-800" y="-600" width="2700" height="3200" fill="#F2E2C4"/>`;
    w += `<rect x="-800" y="1180" width="2700" height="1500" fill="#C99B6D"/>` + `<path d="M-800 1180H1900" stroke="${INK}" stroke-width="5"/>`;
    for (let i = -6; i < 14; i++) w += `<path d="M${540 + i * 140} 1180L${540 + i * 260} 2000" stroke="#B5875B" stroke-width="4"/>`;
    // tableau, horloge, fenêtre, frise
    w += path('M-420 300H300V760H-420Z', '#2F5D4A', 8) + txt(-60, 470, 'Devoirs : p. 42', 56, '#F7F3E8', { font: 'Caveat', weight: 700 }) + txt(-60, 560, '2 + 2 = 4', 56, '#F7F3E8', { font: 'Caveat', weight: 700 });
    w += path('M1120 260H1460V820H1120Z', '#BFE6F5', 7) + `<path d="M1290 260V820M1120 540H1460" stroke="${INK}" stroke-width="6"/>`;
    const sec = Math.floor(t);
    w += `<circle cx="760" cy="440" r="78" fill="#FFFFFF" stroke="${INK}" stroke-width="7"/>`;
    w += `<path d="M760 440L760 392M760 440L792 452" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
    const a = sec * 6 * Math.PI / 180 + 0.12 * Math.max(0, 1 - (t - sec) * 12) * Math.sin((t - sec) * 60);
    w += `<path d="M760 440L${r1(760 + Math.sin(a) * 62)} ${r1(440 - Math.cos(a) * 62)}" stroke="#E5483D" stroke-width="4" stroke-linecap="round"/>`;
    for (let i = 0; i < 12; i++) w += txt(-300 + i * 180, 200, 'ABCDEFGHIJKL'[i], 64, ['#E5483D', '#4FA3CF', '#F6B53D', '#7BD389'][i % 4], { font: 'Anton', weight: 400, op: 0.8 });
    return w;
  }
  const desk = (x, y, wdt, h) => path(`M${x - wdt / 2} ${y}H${x + wdt / 2}V${y + 26}H${x - wdt / 2}Z`, '#E9A86A', 5) + path(`M${x - wdt / 2 + 20} ${y + 26}H${x + wdt / 2 - 20}V${y + h}H${x - wdt / 2 + 20}Z`, '#C98852', 5);

  function viewfinder(t, t0) {
    let s = '';
    const c = '#FFFFFF', m = 70, L = 110;
    s += `<path d="M${m} ${m + L}V${m}H${m + L}M${W - m - L} ${m}H${W - m}V${m + L}M${W - m} ${H - 420 - L}V${H - 420}H${W - m - L}M${m + L} ${H - 420}H${m}V${H - 420 - L}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
    s += `<circle cx="130" cy="150" r="20" fill="#FF3B3B" opacity="${Math.floor(t * 2) % 2 ? 0.25 : 1}"/>` + txt(170, 165, 'REC', 44, c, { anchor: 'start', font: 'Anton', weight: 400 });
    const sec = Math.max(0, t - t0);
    s += txt(W - 120, 165, `00:${String(Math.floor(sec)).padStart(2, '0')}:${String(Math.floor((sec % 1) * 30)).padStart(2, '0')}`, 40, c, { anchor: 'end', font: 'Anton', weight: 400 });
    return s;
  }

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

  // ================================================================== LE CRAYON MAGIQUE
  const GRAPH = '#4E4E5C';
  // trait qui se dessine (longueur normalisée) : k de 0 à 1 entre t0 et t1
  function sketch(d, t, t0, t1, o = {}) {
    const k = t1 > t0 ? clamp((t - t0) / (t1 - t0)) : (t >= t0 ? 1 : 0);
    if (k <= 0) return '';
    return `<path d="${d}" pathLength="1" fill="none" stroke="${o.col || GRAPH}" stroke-width="${o.sw || 7}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1" stroke-dashoffset="${r1((1 - k) * 1000) / 1000}" opacity="${o.op == null ? 1 : o.op}"/>`;
  }
  // plusieurs traits dessinés l'un après l'autre
  function sketchSeq(ds, t, t0, t1, o = {}) {
    const n = ds.length, step = (t1 - t0) / n;
    return ds.map((d, i) => sketch(d, t, t0 + i * step, t0 + (i + 1) * step, o)).join('');
  }
  // nuage « pouf » : le dessin devient réel
  function poof(cx, cy, t, t0, s = 1) {
    const k = inv(t0, t0 + 0.55, t);
    if (k <= 0 || k >= 1) return '';
    let g = '';
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, d = Ez.out(k) * 120 * s, r = (40 + 24 * Math.sin(i * 2.3)) * s * (1 - k * 0.6);
      g += `<circle cx="${r1(cx + Math.cos(a) * d)}" cy="${r1(cy + Math.sin(a) * d * 0.8)}" r="${r1(r)}" fill="#FFFFFF" stroke="${INK}" stroke-width="5" opacity="${r1((1 - k) * 100) / 100}"/>`;
    }
    return g + sparkles(cx, cy, t, t0, 12, 220 * s, Math.round(t0 * 10), ['#FFFFFF', '#FFE27A', '#9FD8F5']);
  }
  // crayon : pointe en (0,0), corps vers +x
  function pencil(x, y, rot, sc = 1) {
    return grp(path('M0 0L36 -14V14Z', '#E9C08F', 4) + path('M0 0L12 -5V5Z', GRAPH, 2) + path('M36 -14H230V14H36Z', '#F6C33D', 5) +
      `<path d="M36 -5H230M36 5H230" stroke="#D9A21E" stroke-width="3"/>` + path('M230 -15H250V15H230Z', '#C9C4BC', 4) + path('M250 -14H272Q280 -14 280 -6V6Q280 14 272 14H250Z', '#F28CB1', 4),
      `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(${sc})`);
  }
  // gomme géante
  function eraser(x, y, rot, sc = 1) {
    return grp(path('M-70 -40H70Q84 -40 84 -26V26Q84 40 70 40H-70Q-84 40 -84 26V-26Q-84 -40 -70 -40Z', '#F28CB1', 6) + path('M-84 -10H84V10H-84Z', '#4FA3CF', 0) + txt(0, 8, 'GOMME', 26, '#FFFFFF', { font: 'Anton', weight: 400 }),
      `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(${sc})`);
  }
  // miettes de gomme
  function crumbs(cx, cy, t, t0, t1, seed, w = 200) {
    if (t < t0 || t > t1 + 1.2) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < 26; i++) {
      const tb = t0 + r() * (t1 - t0), dt = t - tb;
      if (dt < 0 || dt > 1.2) { r(); r(); continue; }
      const x = cx + (r() - 0.5) * w + (r() - 0.5) * 60 * dt, y = cy + 300 * dt + 900 * dt * dt;
      s += `<rect x="${r1(x)}" y="${r1(y)}" width="12" height="8" rx="3" fill="${i % 3 ? '#F28CB1' : '#9A8F86'}" transform="rotate(${r1(dt * 400)} ${r1(x)} ${r1(y)})" opacity="${r1(clamp(1.2 - dt) * 100) / 100}"/>`;
    }
    return s;
  }
  // effacement : l'objet est coupé par un rideau qui descend (k 0 -> 1), gomme qui frotte au bord
  function erased(inner, box, t, t0, t1, id) {
    const k = clamp((t - t0) / (t1 - t0));
    if (k >= 1) return '';
    if (k <= 0) return inner;
    const [x, y, w, h] = box, yb = y + h * k;
    return `<clipPath id="${id}"><rect x="${x - 40}" y="${r1(yb)}" width="${w + 80}" height="${r1(h * (1 - k) + 40)}"/></clipPath><g clip-path="url(#${id})">${inner}</g>` +
      eraser(x + w / 2 + Math.sin(t * 34) * w * 0.4, yb, -10 + Math.sin(t * 34) * 12, 1.1) + crumbs(x + w / 2, yb, t, t0, t1, Math.round(t0 * 7), w);
  }
  const NOTE = (cx, cy, w, h, rot = -4) => grp(path(`M${-w / 2} ${-h / 2}H${w / 2}V${h / 2}H${-w / 2}Z`, '#FBF8F0', 6) +
    Array.from({ length: Math.floor(h / 44) }, (_, i) => `<path d="M${-w / 2 + 6} ${-h / 2 + 50 + i * 44}H${w / 2 - 6}" stroke="#9FC3E3" stroke-width="3"/>`).join('') +
    `<path d="M${-w / 2 + 60} ${-h / 2 + 6}V${h / 2 - 6}" stroke="#F09A9A" stroke-width="3"/>`, `translate(${cx} ${cy}) rotate(${rot})`);
  function bedroom(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#F1DFC2"/>`;
    for (let x = -800; x < 1900; x += 90) w += `<rect x="${x}" y="-800" width="40" height="2500" fill="#EAD5B3" opacity=".6"/>`;
    w += path('M60 260H420V700H60Z', '#BFE6F5', 7) + `<path d="M240 260V700M60 480H420" stroke="${INK}" stroke-width="6"/>` + ell(130, 330, 40, 18, '#FFFFFF', 0);
    w += path('M640 300H960V640H640Z', '#E5483D', 6) + txt(800, 460, 'ET SI', 74, '#FFFFFF', { font: 'Anton', weight: 400, rot: -6 }) + txt(800, 560, '…', 74, '#FFFFFF', { font: 'Anton', weight: 400 });
    w += `<rect x="-800" y="1600" width="2700" height="1200" fill="#C99B6D" stroke="${INK}" stroke-width="5"/>`;
    for (let i = -6; i < 14; i++) w += `<path d="M${540 + i * 150} 1600L${540 + i * 280} 2400" stroke="#B5875B" stroke-width="4"/>`;
    return w;
  }
  const PIZZA = (x, y, sc, bite = 0, rot = 0) => {
    let s = path('M0 -100L66 70Q0 92 -66 70Z', '#F6C35D', 6) + path('M-66 70Q0 92 66 70L70 84Q0 108 -70 84Z', '#D98E3A', 5);
    s += ell(-14, 0, 14, 14, '#D9483D', 4) + ell(20, 40, 14, 14, '#D9483D', 4) + ell(-28, 52, 11, 11, '#D9483D', 4);
    if (bite > 0) s += `<circle cx="0" cy="-104" r="${r1(48 * bite)}" fill="#F1DFC2" stroke="none"/><circle cx="-26" cy="-80" r="${r1(30 * bite)}" fill="#F1DFC2"/><circle cx="26" cy="-80" r="${r1(30 * bite)}" fill="#F1DFC2"/>`;
    return grp(s, `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(${sc})`);
  };
  const PIZZA_SK = ['M0 -100L66 70Q0 92 -66 70Z', 'M-70 84Q0 108 70 84', 'M-28 0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0', 'M6 40a14 14 0 1 0 28 0a14 14 0 1 0 -28 0'];
  const SHOE = sd => `M${sd * 6} -42C${sd * 6} -48 ${sd * 18} -50 ${sd * 34} -50C${sd * 58} -50 ${sd * 74} -36 ${sd * 76} -14C${sd * 76} -4 ${sd * 70} 0 ${sd * 60} 0H${sd * 10}C${sd * 4} 0 ${sd * 2} -6 ${sd * 4} -14Z`;
  // baskets en or posées sur les pieds de Léo (même forme que ses chaussures)
  const goldShoes = (x, y, sc, t) => grp([-1, 1].map(sd => path(SHOE(sd), '#FFC83D', 6) + line(`M${sd * 24} -30Q${sd * 44} -36 ${sd * 60} -24`, '#FFF3B0', 6)).join('') +
    `<path d="M${r1(-60 + ((t * 120) % 140))} -46l10 -10l10 10l-10 10z" fill="#FFFFFF" opacity=".9"/>`, `translate(${r1(x)} ${r1(y)}) scale(${sc})`);
  const CAT_SK = ['M-60 -40C-60 -110 60 -110 60 -40C60 10 -60 10 -60 -40Z', 'M-55 -80L-45 -130L-15 -95', 'M55 -80L45 -130L15 -95', 'M-50 0C-80 120 -60 180 0 180C60 180 80 120 50 0', 'M50 150Q140 120 120 40', 'M-30 -50h12M18 -50h12', 'M-8 -28L0 -20L8 -28'];
  const DOOR = { x: 620, y: 860, w: 300, h: 720 };
  function beach(t, x, y, w, h) {
    let s = `<defs><linearGradient id="skyb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5CC6F2"/><stop offset="1" stop-color="#C8F0FF"/></linearGradient></defs>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#skyb)"/>`;
    s += `<circle cx="${x + w * 0.7}" cy="${y + h * 0.22}" r="${w * 0.16}" fill="#FFE27A"/>`;
    const sea = y + h * 0.5;
    s += `<rect x="${x}" y="${sea}" width="${w}" height="${h * 0.22}" fill="#2F9BD6"/>`;
    for (let i = 0; i < 4; i++) { const wy = sea + 20 + i * 30, ph = t * 2 + i; s += `<path d="M${x} ${wy}Q${r1(x + w * 0.25)} ${r1(wy - 10 * Math.sin(ph))} ${x + w * 0.5} ${wy}T${x + w} ${wy}" stroke="#BFE6F5" stroke-width="5" fill="none"/>`; }
    s += `<rect x="${x}" y="${r1(sea + h * 0.22)}" width="${w}" height="${r1(h * 0.28)}" fill="#F6D58A"/>`;
    s += grp(path('M0 0V-220', 'none', 10) + path('M0 -220Q-80 -260 -130 -200Q-60 -230 0 -220Q60 -270 130 -210Q60 -230 0 -220Z', '#2FA56A', 5), `translate(${r1(x + w * 0.2)} ${r1(sea + h * 0.4)}) scale(${r1(w / 300 * 100) / 100})`);
    return s;
  }
  // monstre gribouillé (dessin raté) — origine aux pieds, hauteur ~ 1 (échelle sc px)
  function monsterBody(seed) {
    const r = rng(seed); let d = '';
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, rr = 1 + (r() - 0.5) * 0.18;
      const x = Math.cos(a) * 300 * rr, y = -380 + Math.sin(a) * 380 * rr;
      d += (i ? 'L' : 'M') + r1(x) + ' ' + r1(y);
    }
    return d + 'Z';
  }
  const MBODY = monsterBody(5), MBODY2 = monsterBody(9);
  function monster(x, y, sc, t, o = {}) {
    const draw = o.draw == null ? 1 : o.draw, fill = o.fill || 0, jaw = o.jaw || 0, crook = o.crook || 0;
    let s = '';
    if (fill > 0) s += `<path d="${MBODY}" fill="#9B7EDC" opacity="${r1(fill * 0.9 * 100) / 100}"/>`;
    // hachures
    if (fill > 0) for (let i = 0; i < 12; i++) s += `<path d="M${-260 + i * 46} -80L${-160 + i * 46} -680" stroke="#7A5BC7" stroke-width="6" opacity="${r1(fill * 0.6 * 100) / 100}"/>`;
    const bt = o.t0 || 0;
    s += sketch(MBODY, draw, 0, 0.45, { col: '#4B2E8A', sw: 12 }) + sketch(MBODY2, draw, 0.2, 0.6, { col: '#4B2E8A', sw: 7, op: 0.7 });
    // jambes et bras ratés
    s += sketch('M-140 -40L-170 60L-110 60', draw, 0.5, 0.6, { col: '#4B2E8A', sw: 12 }) + sketch('M140 -40L120 60L190 60', draw, 0.55, 0.65, { col: '#4B2E8A', sw: 12 });
    s += sketch(`M-290 -420Q-420 ${r1(-520 + Math.sin(t * 5) * 30)} -470 -380`, draw, 0.6, 0.7, { col: '#4B2E8A', sw: 12 }) + sketch(`M290 -420Q430 ${r1(-560 + Math.cos(t * 5) * 30)} 480 -460`, draw, 0.62, 0.72, { col: '#4B2E8A', sw: 12 });
    // yeux de travers
    if (draw > 0.72) {
      const ey = -520;
      s += `<circle cx="-110" cy="${ey}" r="70" fill="#FFFFFF" stroke="#4B2E8A" stroke-width="8"/><circle cx="${r1(-100 + Math.sin(t * 3) * 10)}" cy="${ey + 10}" r="26" fill="${INK}"/>`;
      s += grp(`<circle cx="0" cy="0" r="42" fill="#FFFFFF" stroke="#4B2E8A" stroke-width="8"/><circle cx="8" cy="6" r="16" fill="${INK}"/>`, `translate(${r1(120 + crook * 30)} ${r1(ey - 60 + crook * 90)})`);
    }
    // bouche
    if (draw > 0.8) {
      const mo = 40 + jaw * 160;
      s += `<path d="M-180 -330Q0 ${r1(-330 + mo * 0.3)} 180 -330Q0 ${r1(-330 + mo)} -180 -330Z" fill="#3A1F5C" stroke="#4B2E8A" stroke-width="8"/>`;
      let teeth = '';
      for (let i = 0; i < 7; i++) { const tx = -150 + i * 50; teeth += `M${tx} -330l20 ${r1(26 + jaw * 10)}l20 ${r1(-26 - jaw * 10)}`; }
      s += `<path d="${teeth}" fill="#FFFFFF" stroke="#4B2E8A" stroke-width="4"/>`;
    }
    return grp(s, `translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 1000) / 1000})`);
  }
  // oreilles d'âne (k = croissance), posées sur la tête de Léo
  function donkeyEars(x, y, sc, k, t, sketchK = 0) {
    let s = '';
    for (const sd of [-1, 1]) {
      const wig = Math.sin(t * 6 + sd) * 6 * k;
      const d = `M${sd * 40} -600Q${sd * 120} -760 ${sd * 90} -860Q${sd * 40} -760 ${sd * 10} -610Z`;
      if (k > 0) s += grp(path(d, '#9AA0B5', 6) + path(`M${sd * 42} -620Q${sd * 96} -740 ${sd * 82} -820Q${sd * 46} -740 ${sd * 24} -630Z`, '#F7B9B0', 0), `rotate(${r1(sd * (12 + wig))} ${sd * 30} -600) translate(0 -600) scale(1 ${r1(k * 100) / 100}) translate(0 600)`);
      else if (sketchK > 0) s += sketch(d, sketchK, 0, 1, { sw: 7 });
    }
    return grp(s, `translate(${r1(x)} ${r1(y)}) scale(${sc})`);
  }
  // main de Léo / Max -> position monde
  const handW = (X, Y, sc, lx, ly) => [X + lx * sc, Y + ly * sc];

  // ================================================================== SCÈNES

  // ---- 1. Accroche : une page blanche, un crayon
  function sHook(t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#FBF8F0"/>`;
    for (let y = -400; y < 2400; y += 70) w += `<path d="M-600 ${y}H1700" stroke="#C9DDF0" stroke-width="4"/>`;
    w += `<path d="M150 -600V2600" stroke="#F09A9A" stroke-width="5"/>`;
    // Léo se dessine trait par trait puis prend ses couleurs
    const col = spring(t, 2.0, 2.6, 0.55);
    const sk = ['M-110 -514C-108 -571 -64 -607 0 -607C64 -607 108 -571 110 -514C112 -458 78 -404 0 -402C-78 -404 -112 -458 -110 -514Z', 'M-90 -390L-100 -150H100L90 -390Z', 'M-60 -150V0M60 -150V0', 'M-90 -380L-160 -220M90 -380L160 -220'];
    if (col < 0.98) w += grp(sketchSeq(sk, t, 0.3, 1.9, { sw: 9 }), 'translate(540 1700) scale(1.3)', `opacity="${r1((1 - col) * 100) / 100}"`);
    if (col > 0.01) {
      const lp = alive({ arms: { l: [10, 10, 'relax'], r: arm(LA(1, 150, -560, 1), 'fist') }, tilt: 0, bob: 0, lean: 0 }, t, 1);
      w += grp(R.leo({ x: 540, y: 1700, scale: 1.3, expr: 'surpris', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 1), look: [0.5, -0.6] }), '', `opacity="${r1(col * 100) / 100}"`);
      const [hx, hy] = handW(540, 1700, 1.3, 150, -560);
      w += pencil(hx + 10, hy - 10, -60, 1.2);
    }
    w += poof(540, 1100, t, 2.0, 2);
    // crayon géant qui dessine
    const px = 540 + Math.sin(t * 9) * 160, py = 1100 + Math.cos(t * 7) * 300;
    if (t < 2.0) w += pencil(px, py, -50, 2.0);
    let ui = '';
    const exit = Ez.in(inv(2.75, 3.1, t));
    if (exit < 1) ui += grp(springWord(540, 300, 'ET SI…', 210, t, 0.08, { fill: '#F6B53D', sw: 16, ls: 6 }), `translate(0 ${r1(-exit * 600)})`);
    return { w, ui, cam: { z: 1 + 0.05 * Ez.io(inv(0, 3.1, t)) + 0.05 * punch(t, 2.0, 6), fx: 540, fy: 1050, rot: Math.sin(t * 1.2) }, cap: true };
  }

  // ---- 2. Le chat sort de la page
  function sCat(t) {
    let w = bedroom(t);
    const drawing = t < T.sort;
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: drawing ? arm(LA(1, 210 + Math.sin(t * 30) * 30, -560 + Math.cos(t * 26) * 30, 1), 'fist') : [20, 20, 'fist'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(330, 1730, 150);
    w += R.leo({ x: 330, y: 1720, scale: 1.15, expr: t > T.sort ? 'surpris' : 'determine', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 2), look: t > T.sort ? [0.8, 0.3] : [0.9, -0.3] });
    const [hx, hy] = handW(330, 1720, 1.15, drawing ? 210 + Math.sin(t * 30) * 30 : 20, drawing ? -560 + Math.cos(t * 26) * 30 : -60);
    if (drawing) w += pencil(hx, hy, -40, 1);
    // la page flottante et le chat dessiné
    w += NOTE(740, 900, 440, 560);
    const sk = grp(sketchSeq(CAT_SK, t, 3.5, 4.8, { sw: 8 }), 'translate(740 920) rotate(-4) scale(1.2)');
    if (t < T.sort + 0.1) w += sk;
    // le chat réel saute hors de la page
    if (t > T.sort) {
      const k = clamp((t - T.sort) / 0.6), x = lerp(740, 780, k), y = lerp(1100, 1720, Ez.in(k)) - Math.sin(Math.PI * k) * 260;
      w += shadow(780, 1730, 110 * k);
      w += R.chat({ x, y, scale: 0.85, blink: blinkAt(t, 3), tail: t * 3, squash: k >= 1 ? 0.12 * decay(t, T.sort + 0.6, 10) : 0 });
      if (t > T.miaou - 0.1) w += bubble(900, 1220, 280, 150, { s: spring(t, T.miaou - 0.1, 2.6, 0.5), seed: 11, lines: ['MIAOU'], fs: 60, font: 'Anton', weight: 400 });
    }
    w += poof(760, 1000, t, T.sort, 1.4);
    const cam = cam2([[3.1, 1.15, 600, 1050], [T.sort - 0.1, 1.0, 600, 1200, 0.5]], t);
    cam.z *= 1 + 0.05 * punch(t, T.sort, 6);
    return { w, cam, cap: true };
  }

  // ---- 3. Pizza, baskets en or
  function sPizza(t) {
    let w = bedroom(t);
    const pz = T.pizza + 0.35, bs = T.baskets + 0.6;
    const hasPizza = t > pz;
    let arms = { l: [10, 10, 'relax'], r: arm(LA(1, 230, -520, 1), 'fist') };
    if (hasPizza) arms.r = arm(LA(1, 130, t > T.manges - 0.25 && t < T.manges + 0.3 ? -480 : -420, 1), 'fist');
    if (t > T.baskets - 0.1 && t < bs) arms.l = arm(LA(-1, -200, -160, -1), 'fist');
    const lp = alive({ arms, tilt: 0, bob: 0, lean: 0 }, t, 1);
    const happy = t > bs;
    w += shadow(540, 1730, 160);
    w += R.leo({ x: 540, y: 1720, scale: 1.2, expr: t > T.manges ? (happy ? 'content' : 'rire') : 'surpris', arms: lp.arms, tilt: lp.tilt, bob: lp.bob + (happy ? -Math.abs(Math.sin(t * 8)) * 10 : 0), blink: blinkAt(t, 3), look: t > T.baskets && t < 10.4 ? [0, 0.9] : [0.4, -0.2] });
    // pizza dessinée en l'air puis réelle dans la main
    if (!hasPizza) w += grp(sketchSeq(PIZZA_SK, t, 6.95, pz - 0.05, { sw: 7 }), 'translate(820 800) scale(1.4)');
    else {
      const [hx, hy] = handW(540, 1720, 1.2, 130, t > T.manges - 0.25 && t < T.manges + 0.3 ? -480 : -420);
      const fly = Ez.out(clamp((t - pz) / 0.35));
      w += PIZZA(lerp(820, hx + 10, fly), lerp(800, hy - 90, fly), 1.1, t > T.manges ? 1 : 0, lerp(0, -20, fly));
    }
    w += poof(820, 800, t, pz, 1.2);
    if (t > T.manges && t < T.manges + 0.8) for (let i = 0; i < 6; i++) { const r = rng(i + 40), d = t - T.manges; w += ell(560 + (r() - 0.5) * 100 + d * 60, 1130 + d * 500, 7, 5, '#D98E3A', 0); }
    // baskets dessinées au sol puis en or aux pieds
    if (t < bs && t > T.baskets - 0.2) w += grp(sketchSeq([SHOE(-1), SHOE(1)], t, T.baskets - 0.15, bs - 0.05, { sw: 6 }), 'translate(540 1720) scale(1.2)');
    if (t > bs) w += goldShoes(540, 1720 + lp.bob * 0, 1.2, t) + sparkles(540, 1690, t, bs, 16, 280, 41, ['#FFE27A', '#FFFFFF']);
    w += poof(540, 1690, t, bs, 1.1);
    const cam = cam2([[6.9, 1.2, 640, 1050], [T.baskets - 0.2, 1.45, 540, 1620, 0.4], [10.5, 1.1, 540, 1250, 0.4]], t);
    cam.z *= 1 + 0.05 * punch(t, pz, 6) + 0.05 * punch(t, bs, 6);
    return { w, cam, cap: true };
  }

  // ---- 4. Une porte sur le mur… la plage
  function sDoor(t) {
    let w = bedroom(t);
    const { x, y, w: dw, h: dh } = DOOR;
    const open = Ez.io(inv(T.derriere - 0.25, T.derriere + 0.45, t));
    // la plage derrière la porte (lumière qui déborde)
    if (open > 0) {
      w += `<ellipse cx="${x + dw / 2}" cy="${y + dh / 2}" rx="${r1(420 * open)}" ry="${r1(620 * open)}" fill="#FFF1B8" opacity="${r1(0.45 * open * 100) / 100}" filter="url(#soft)"/>`;
      w += `<clipPath id="dcl"><rect x="${x}" y="${y}" width="${dw}" height="${dh}"/></clipPath><g clip-path="url(#dcl)">${beach(t, x, y, dw, dh)}</g>`;
    }
    // la porte (panneau qui pivote sur la gauche)
    const doorPanel = path(`M0 0H${dw}V${dh}H0Z`, '#E9A86A', 7) + path(`M30 40H${dw - 30}V${dh * 0.45}H30Z`, 'none', 5) + path(`M30 ${dh * 0.52}H${dw - 30}V${dh - 40}H30Z`, 'none', 5) + ell(dw - 40, dh * 0.5, 16, 16, '#FFC83D', 5);
    const drawn = t > T.mur + 0.1;
    if (!drawn) w += sketchSeq([`M${x} ${y + dh}V${y}H${x + dw}V${y + dh}`, `M${x + 30} ${y + 40}H${x + dw - 30}V${y + dh * 0.45}H${x + 30}Z`, `M${x + dw - 56} ${y + dh * 0.5}a16 16 0 1 0 32 0a16 16 0 1 0 -32 0`], t, 11.0, T.mur + 0.1, { sw: 8 });
    else w += grp(doorPanel, `translate(${x} ${y}) scale(${r1((1 - open * 0.85) * 1000) / 1000} 1)`);
    w += poof(x + dw / 2, y + dh / 2, t, T.mur + 0.1, 1.6);
    // Léo
    const drawing = t < T.mur + 0.1;
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: drawing ? arm(LA(1, 250 + Math.sin(t * 9) * 60, -560 + Math.cos(t * 7) * 140, 1), 'fist') : [20, 20, 'fist'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(330, 1730, 150);
    w += R.leo({ x: 330, y: 1720, scale: 1.15, expr: open > 0.3 ? 'content' : 'determine', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 4), look: [0.9, -0.2] });
    if (drawing) { const [hx, hy] = handW(330, 1720, 1.15, 250 + Math.sin(t * 9) * 60, -560 + Math.cos(t * 7) * 140); w += pencil(hx, hy, -40, 1); }
    w += goldShoes(330, 1720, 1.15, t);
    const cam = cam2([[10.9, 1.05, 600, 1150], [T.derriere, 1.15, 700, 1200, 0.5], [T.plage - 0.1, 2.3, x + dw / 2, y + dh / 2, 0.6]], t);
    return { w, cam, cap: true };
  }

  // ---- 5. Max te pique ton crayon
  function sSteal(t) {
    let w = bedroom(t);
    w += NOTE(540, 1250, 300, 200, 8);
    const grab = T.pique, gk = Ez.io(clamp((t - grab) / 0.3));
    // Léo
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: arm(LA(1, 150, -430, 1), 'fist') }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(330, 1730, 150);
    w += R.leo({ x: 330, y: 1720, scale: 1.15, expr: t > grab ? 'choque' : 'content', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 5), look: t > T.mais ? [0.9, -0.2] : [0, 0] });
    w += goldShoes(330, 1720, 1.15, t);
    // Max entre par la droite
    const mx = lerp(1350, 800, Ez.out(inv(T.mais - 0.3, T.mais + 0.6, t)));
    const wk = mx > 801 ? walkPose(t, 8, 16) : { lift: [0, 0], bob: 0 };
    const reach = t > grab - 0.25 && t < grab + 0.15;
    const mArmT = reach ? [-300, -470] : t > grab ? [-140, -620] : [-60, -300];
    const mp = alive({ arms: { l: arm(MA(-1, mArmT[0], mArmT[1], -1), 'fist'), r: [6, 4, 'relax'] }, tilt: 0, bob: wk.bob, lean: 0 }, t, 7);
    w += shadow(mx, 1730, 130);
    w += R.max({ x: mx, y: 1720, scale: 0.95, expr: t > grab ? 'rire' : t > T.cahier ? 'moqueur' : 'neutre', arms: mp.arms, lift: wk.lift, bob: mp.bob, tilt: mp.tilt, blink: blinkAt(t, 9), look: [-0.8, 0.2] });
    // le crayon passe d'une main à l'autre
    const [lx, ly] = handW(330, 1720, 1.15, 150, -430);
    const [mxh, myh] = handW(mx, 1720, 0.95, mArmT[0], mArmT[1]);
    w += pencil(lerp(lx, mxh, gk), lerp(ly, myh, gk), lerp(-40, -140, gk), 1);
    if (t > grab) w += txt(r1(lerp(lx, mxh, 0.5)), 1000, 'HOP !', 80, '#E5483D', { font: 'Anton', weight: 400, stroke: INK, sw: 10, op: clamp(1 - (t - grab - 0.5) * 2) });
    const cam = cam2([[14.6, 1.0, 560, 1200], [T.cahier, 1.2, 600, 1150, 0.5], [grab - 0.1, 1.3, 560, 1100, 0.2]], t);
    cam.z *= 1 + 0.05 * punch(t, grab, 7);
    cam.shake = 10 * decay(t, grab, 6);
    return { w, cam, cap: true };
  }

  // ---- 6. Oreilles d'âne
  function sEars(t) {
    let w = bedroom(t);
    const scrib = t > 18.1 && t < 19.2;
    const lp = alive({ arms: t > T.vrai - 0.2 ? { l: arm(LA(-1, -60, -640, -1), 'open'), r: arm(LA(1, 60, -640, 1), 'open') } : { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    const ex = t > T.poussent ? 'gene' : 'surpris';
    w += shadow(380, 1730, 150);
    w += R.leo({ x: 380, y: 1720, scale: 1.15, expr: ex, arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 6), look: t > T.poussent ? [0, -1] : [0.8, 0] });
    w += goldShoes(380, 1720, 1.15, t);
    const grow = t > T.poussent ? spring(t, T.poussent, 2.4, 0.4) : 0;
    w += donkeyEars(380, 1720 + lp.bob * 1.15, 1.15, grow, t, clamp((t - 18.6) / 0.6));
    w += poof(380, 1720 - 820 * 1.15, t, T.poussent, 1.2);
    // Max gribouille dans l'air
    const hand = scrib ? [-160 + Math.sin(t * 30) * 40, -620 + Math.cos(t * 24) * 40] : [-140, -620];
    const mp = alive({ arms: { l: arm(MA(-1, hand[0], hand[1], -1), 'fist'), r: [6, 4, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += shadow(820, 1730, 130);
    w += R.max({ x: 820, y: 1720, scale: 0.95, expr: t > T.poussent ? 'rire' : 'moqueur', arms: mp.arms, bob: mp.bob, tilt: mp.tilt + (t > T.poussent ? Math.sin(t * 18) * 3 : 0), blink: blinkAt(t, 9), look: [-0.8, -0.2] });
    const [px, py] = handW(820, 1720, 0.95, hand[0], hand[1]);
    w += pencil(px, py, -140, 1);
    let ui = '';
    if (t > T.vrai) ui += springWord(540, 420, 'HI-HAN !', 150, t, T.vrai, { fill: '#FFFFFF', sw: 14, ls: 4 });
    const cam = cam2([[17.75, 1.05, 600, 1150], [T.poussent - 0.2, 1.35, 400, 900, 0.4], [T.vrai, 1.1, 520, 1050, 0.4]], t);
    cam.z *= 1 + 0.05 * punch(t, T.poussent, 6);
    return { w, ui, cam, cap: true };
  }

  // ---- 7. Le monstre (énorme, raté)
  function sMonster(t) {
    let w = bedroom(t);
    const drawK = clamp((t - 21.45) / 1.3);
    const big = Ez.back(inv(T.enorme, T.enorme + 0.5, t));
    const sc = lerp(0.55, 1.15, big);
    const crook = Ez.out(inv(T.rate, T.rate + 0.4, t));
    const roar = t > T.enorme2 ? Math.sin(Math.PI * clamp((t - T.enorme2) / 0.8)) : 0;
    w += shadow(560, 1740, 340 * sc);
    w += monster(560, 1730, sc, t, { draw: drawK, fill: Ez.out(inv(T.enorme - 0.1, T.enorme + 0.3, t)), crook, jaw: roar });
    // Léo, tout petit
    const lp = alive({ arms: { l: [150, 30, 'open'], r: [150, 30, 'open'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += R.leo({ x: 180, y: 1760, scale: 0.7, expr: 'panique', arms: t > T.enorme ? lp.arms : { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 7) });
    w += donkeyEars(180, 1760, 0.7, 1, t) + goldShoes(180, 1760, 0.7, t);
    // Max qui dessine, fier
    const hand = t < 22.8 ? [-160 + Math.sin(t * 22) * 80, -700 + Math.cos(t * 17) * 100] : [-140, -650];
    const mp = alive({ arms: { l: arm(MA(-1, hand[0], hand[1], -1), 'fist'), r: [6, 4, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += R.max({ x: 960, y: 1760, scale: 0.72, expr: t > T.rate ? 'surpris' : 'hautain', arms: mp.arms, bob: mp.bob, tilt: mp.tilt, blink: blinkAt(t, 9) });
    const [px, py] = handW(960, 1760, 0.72, hand[0], hand[1]);
    w += pencil(px, py, -140, 0.75);
    let ui = '';
    if (t > T.enorme) ui += springWord(540, 380, 'ÉNORME.', 150, t, T.enorme, { fill: '#9B7EDC', sw: 14, ls: 4 });
    if (t > T.rate) ui += stamp(540, 560, 'RATÉ', '#E5483D', t, T.rate, -10);
    const cam = cam2([[21.3, 1.15, 560, 1300], [T.enorme - 0.1, 0.95, 560, 1150, 0.5]], t);
    cam.z *= 1 + 0.06 * punch(t, T.enorme, 6) + 0.05 * punch(t, T.enorme2, 6);
    cam.shake = 26 * roar + 10 * decay(t, T.enorme, 5);
    return { w, ui, cam, cap: true, rgb: 12 * roar };
  }

  // ---- 8. Le monstre mange tout
  function sEat(t) {
    let w = bedroom(t);
    const chomps = [T.pizza2, T.baskets2, T.porte2 + 0.15];
    let jaw = 0.25 + 0.1 * Math.sin(t * 4);
    chomps.forEach(c => { if (t > c - 0.3 && t < c + 0.25) jaw = t < c ? 1 : Math.max(0, 1 - (t - c) / 0.08) * 0; });
    w += shadow(700, 1740, 360);
    w += monster(700, 1730, 1.05, t, { draw: 1, fill: 1, crook: 1, jaw });
    const mouth = [700, 1730 - 330 * 1.05 + 40];
    // Léo
    const lost = n => t > chomps[n] - 0.45;
    const lp = alive({ arms: { l: [150, 40, 'open'], r: lost(0) ? [150, 40, 'open'] : arm(LA(1, 130, -420, 1), 'fist') }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(200, 1770, 120);
    w += R.leo({ x: 200, y: 1760, scale: 0.85, expr: 'panique', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 8), look: [0.9, -0.4] });
    w += donkeyEars(200, 1760, 0.85, 1, t);
    // objets aspirés vers la bouche
    const fly = (n, from, draw) => { const k = Ez.in(clamp((t - (chomps[n] - 0.45)) / 0.45)); if (k >= 1) return ''; const x = lerp(from[0], mouth[0], k), y = lerp(from[1], mouth[1], k) - Math.sin(Math.PI * k) * 200; return draw(x, y, 1 - k * 0.6, k * 540); };
    const [hx, hy] = handW(200, 1760, 0.85, 130, -420);
    w += fly(0, [hx, hy - 70], (x, y, s, r) => PIZZA(x, y, 0.8 * s, 1, r));
    if (!lost(1)) w += goldShoes(200, 1760, 0.85, t);
    else w += fly(1, [200, 1740], (x, y, s, r) => goldShoes(x, y, 0.85 * s, t));
    w += fly(2, [110, 880], (x, y, s, r) => grp(path('M-80 -170H80V170H-80Z', '#E9A86A', 6) + `<rect x="-60" y="-150" width="120" height="300" fill="#5CC6F2"/><rect x="-60" y="10" width="120" height="140" fill="#F6D58A"/>`, `translate(${r1(x)} ${r1(y)}) rotate(${r1(r)}) scale(${r1(s * 100) / 100})`));
    if (t < chomps[2] - 0.45) w += grp(path('M-80 -170H80V170H-80Z', '#E9A86A', 6) + `<rect x="-60" y="-150" width="120" height="300" fill="#5CC6F2"/><rect x="-60" y="10" width="120" height="140" fill="#F6D58A"/>`, 'translate(110 880) scale(.8)');
    chomps.forEach((c, i) => { w += crumbs(mouth[0], mouth[1], t, c, c + 0.15, 50 + i, 160); });
    let ui = '';
    chomps.forEach((c, i) => { const k = inv(c, c + 0.6, t); if (k > 0 && k < 1) ui += txt(r1(700 + (i - 1) * 140), r1(560 - Ez.out(k) * 80), 'CROC !', 96, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 12, rot: (i - 1) * 8, op: r1(Math.sin(Math.PI * k) * 1.5 * 100) / 100 }); });
    const hit = Math.max(...chomps.map(c => decay(t, c, 6)));
    return { w, ui, cam: { z: 1.0 + 0.06 * hit, fx: 540, fy: 1180, rot: 0, shake: 22 * hit }, cap: true };
  }

  // ---- 9. La gomme : oreilles, monstre, crayon de Max
  function sErase(t) {
    let w = bedroom(t);
    const E1 = [T.eff1 + 0.05, T.eff1 + 0.6], E2 = [T.eff2 + 0.05, T.eff2 + 0.9], E3 = [T.eff3 + 0.3, T.eff3 + 0.9];
    // monstre au fond
    const mon = monster(760, 1730, 0.95, t, { draw: 1, fill: 1, crook: 1, jaw: 0.3 + 0.1 * Math.sin(t * 4) });
    w += erased(mon, [280, 1000, 960, 760], t, E2[0], E2[1], 'erm');
    // Max (crayon en main jusqu'à l'effacement)
    const mp = alive({ arms: { l: arm(MA(-1, -140, -620, -1), t > E3[1] ? 'open' : 'fist'), r: [6, 4, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += shadow(930, 1760, 110);
    w += R.max({ x: 930, y: 1760, scale: 0.8, expr: t > E3[1] ? 'choque' : t > E2[1] ? 'surpris' : 'moqueur', arms: mp.arms, bob: mp.bob, tilt: mp.tilt, blink: blinkAt(t, 9) });
    const [px, py] = handW(930, 1760, 0.8, -140, -620);
    w += erased(pencil(px, py, -140, 0.85), [px - 240, py - 200, 300, 260], t, E3[0], E3[1], 'erp');
    // Léo et sa gomme
    const tgt = t < E1[1] ? [60, -700] : t < E2[1] ? [250, -500] : [250, -560];
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: arm(LA(1, tgt[0], tgt[1], 1), 'fist') }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(300, 1770, 140);
    w += R.leo({ x: 300, y: 1760, scale: 1.05, expr: t > E3[1] ? 'content' : 'determine', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 9), look: t < E1[1] ? [0, -1] : [0.9, -0.3] });
    const ears = donkeyEars(300, 1760, 1.05, 1, t);
    w += erased(ears, [150, 760, 300, 400], t, E1[0], E1[1], 'ere');
    const [ex, ey] = handW(300, 1760, 1.05, tgt[0], tgt[1]);
    const busy = (t > E1[0] && t < E1[1]) || (t > E2[0] && t < E2[1]) || (t > E3[0] && t < E3[1]);
    if (!busy) w += eraser(ex + 10, ey - 30, -20, 1) + sparkles(ex, ey - 30, t, T.gomme, 10, 160, 61);
    let ui = '';
    if (t > T.rien) ui += springWord(540, 420, 'PLUS RIEN !', 140, t, T.rien - 0.1, { fill: '#F28CB1', sw: 14, ls: 2 });
    const cam = cam2([[29.4, 1.0, 560, 1200], [E1[0] - 0.2, 1.4, 320, 950, 0.4], [E2[0] - 0.2, 1.0, 640, 1200, 0.4], [E3[0] - 0.3, 1.5, 820, 1150, 0.4], [T.rien, 1.15, 640, 1150, 0.5]], t);
    return { w, ui, cam, cap: true };
  }

  // ---- 10. Tu souffles… et là, tu remarques un truc
  function sBlow(t) {
    let w = bedroom(t);
    const blow = t > T.souffles - 0.1 && t < 37.5;
    w += R.leo({ x: 540, y: 1000, scale: 2.1, headOnly: true, expr: t > T.la ? 'surpris' : blow ? 'neutre' : 'content', mouth: blow ? 'o' : undefined, blink: blinkAt(t, 10), tilt: Math.sin(t * 1.3) * 3, look: t > T.la ? [0, -1] : [0.6, 0.3] });
    if (blow) {
      for (let i = 0; i < 5; i++) { const ph = ((t * 1.6) + i / 5) % 1; w += `<path d="M${r1(700 + ph * 400)} ${1080 + (i - 2) * 40}q40 -20 80 0" stroke="#9FC3E3" stroke-width="8" fill="none" stroke-linecap="round" opacity="${r1((1 - ph) * 100) / 100}"/>`; }
      const r = rng(71);
      for (let i = 0; i < 24; i++) { const d = t - T.souffles + r() * 0.3, x = 720 + d * (700 + r() * 400), y = 1020 + (r() - 0.5) * 300 - d * 80; if (d > 0) w += `<rect x="${r1(x)}" y="${r1(y)}" width="14" height="9" rx="3" fill="${i % 3 ? '#F28CB1' : '#9A8F86'}"/>`; }
    }
    // une goutte tombe sur ton nez
    if (t > T.la - 0.6) { const k = clamp((t - (T.la - 0.6)) / 0.6); if (k < 1) w += path('M0 -22Q14 0 0 12Q-14 0 0 -22Z', '#5CC6F2', 4).replace('<path', `<path transform="translate(560 ${r1(lerp(100, 900, Ez.in(k)))}) scale(2)"`); else w += sparkles(560, 900, t, T.la, 8, 120, 72, ['#5CC6F2', '#FFFFFF']); }
    let ui = '';
    if (t > T.la) ui += txt(540, 420, '…?', 200, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 14, op: clamp((t - T.la) * 4) });
    const cam = cam2([[35.8, 1.0, 540, 1060], [T.la, 1.15, 540, 980, 0.3]], t);
    cam.z *= 1 + 0.05 * punch(t, T.la, 6);
    return { w, ui, cam, cap: true };
  }

  // ---- 11. Ta maison n'a plus de toit… et il pleut
  function sRoof(t) {
    const rain = t > T.pleuvoir - 0.2;
    let w = `<defs><linearGradient id="skyr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rain ? '#7F93A8' : '#9BD6F2'}"/><stop offset="1" stop-color="${rain ? '#C2CAD2' : '#FFEBD0'}"/></linearGradient></defs>`;
    w += `<rect x="-1400" y="-1400" width="4000" height="4400" fill="url(#skyr)"/>`;
    w += `<rect x="-1400" y="1700" width="4000" height="1400" fill="#8FC77A" stroke="${INK}" stroke-width="5"/>`;
    // maison : murs + étage ouvert
    w += path('M140 900H940V1700H140Z', '#F4D9A0', 7);
    w += path('M220 1360H420V1560H220Z', '#BFE6F5', 6) + path('M660 1360H860V1560H660Z', '#BFE6F5', 6) + path('M470 1440H610V1700H470Z', '#8A5A3B', 6);
    // Léo à l'étage, visible par le haut
    const sad = t > T.pleuvoir;
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: sad ? [10, 10, 'relax'] : [20, 20, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 1, sad ? 0.3 : 1);
    w += `<clipPath id="flr"><rect x="140" y="-600" width="800" height="1560"/></clipPath><g clip-path="url(#flr)">` + R.leo({ x: 540, y: 1300, scale: 0.85, expr: sad ? 'triste' : t > T.toit ? 'choque' : 'surpris', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 11), look: [0, -1] }) + '</g>';
    w += path('M140 960H940V1260H140Z', '#F4D9A0', 7) + path('M260 1020H440V1180H260Z', '#BFE6F5', 6) + path('M640 1020H820V1180H640Z', '#BFE6F5', 6);
    // le toit effacé : contour en pointillés + miettes
    const ghost = 0.5 + 0.5 * Math.sin(t * 6);
    w += `<path d="M100 960L540 560L980 960" fill="none" stroke="${GRAPH}" stroke-width="7" stroke-dasharray="20 18" opacity="${r1((t > T.toit ? 0.4 + 0.5 * ghost : 0.5) * 100) / 100}"/>`;
    for (let i = 0; i < 14; i++) { const r = rng(i + 90); w += `<rect x="${r1(120 + r() * 840)}" y="${r1(900 + r() * 60)}" width="14" height="9" rx="3" fill="${i % 3 ? '#F28CB1' : '#9A8F86'}"/>`; }
    // gros nuage + pluie juste sur la maison
    if (rain) {
      const ck = Ez.out(inv(T.pleuvoir - 0.2, T.pleuvoir + 0.4, t));
      w += grp(ell(0, 0, 260, 110, '#6F7C8C') + ell(-180, 30, 160, 90, '#6F7C8C') + ell(200, 26, 170, 96, '#6F7C8C') + ell(-40, -60, 160, 100, '#7F8C9C'), `translate(${r1(lerp(-500, 540, ck))} 380)`);
      const rr = rng(Math.floor(t * 30) + 5); let d = '';
      for (let i = 0; i < 60; i++) { const x = 160 + rr() * 760, y = 460 + rr() * 900; d += `M${r1(x)} ${r1(y)}l-8 50`; }
      w += `<path d="${d}" stroke="#5CC6F2" stroke-width="5" stroke-linecap="round" opacity="${r1(ck * 0.9 * 100) / 100}"/>`;
      for (let i = 0; i < 3; i++) { const ph = ((t * 1.4) + i / 3) % 1; w += path('M0 -14Q9 0 0 8Q-9 0 0 -14Z', '#5CC6F2', 3).replace('<path', `<path transform="translate(${470 + i * 70} ${r1(900 + ph * 120)}) scale(1.4)"`); }
    }
    // Max, au sec sous son parapluie, qui se marre
    if (rain) {
      const mk = Ez.out(inv(T.pleuvoir + 0.2, T.pleuvoir + 0.9, t));
      const mxp = lerp(1500, 990, mk);
      const mp = alive({ arms: { l: arm(MA(-1, -40, -700, -1), 'fist'), r: [6, 4, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 7);
      w += grp(path('M-200 0Q-200 -150 0 -160Q200 -150 200 0Q150 -30 100 0Q50 -30 0 0Q-50 -30 -100 0Q-150 -30 -200 0Z', '#E5483D', 6) + path('M0 0V230', 'none', 8), `translate(${r1(mxp - 40 * 0.8)} ${r1(1760 - 760 * 0.8 - 40)})`);
      w += R.max({ x: mxp, y: 1760, scale: 0.8, flip: true, expr: 'rire', arms: mp.arms, bob: mp.bob, tilt: mp.tilt + Math.sin(t * 18) * 3, blink: blinkAt(t, 9) });
    }
    let ui = '';
    if (t > T.toit) ui += stamp(540, 300, 'PLUS DE TOIT', '#E5483D', t, T.toit, -6);
    const cam = cam2([[39.6, 1.6, 540, 1200], [T.maison - 0.3, 0.9, 600, 1150, 0.9], [T.pleuvoir, 0.92, 600, 1200, 0.6]], t);
    cam.z *= 1 + 0.04 * punch(t, T.toit, 6);
    return { w, ui: ui + (rain ? rainFx(t, 0.5) : ''), cam, cap: true, sat: rain ? 0.7 : 1 };
  }
  function rainFx(t, k) {
    const r = rng(Math.floor(t * 30) + 77); let d = '';
    for (let i = 0; i < 70; i++) { const x = r() * 1300 - 100, y = r() * 2000 - 40; d += `M${r1(x)} ${r1(y)}l-14 60`; }
    return `<path d="${d}" stroke="#DCE8F5" stroke-width="4" stroke-linecap="round" opacity="${r1(0.5 * k * 100) / 100}"/>`;
  }

  // ---- 12. « Et toi ? »
  function sQuestion(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 1040, 22, 2400, t * 0.2, '#F9C55E');
    w += R.leo({ x: 540, y: 1080 + Math.sin(t * 2) * 6, scale: 2.35, headOnly: true, expr: t > T.disle ? 'content' : 'neutre', blink: blinkAt(t, 51), tilt: Math.sin(t * 1.3) * 3 });
    if (t > T.dessinerais - 0.2) w += pencil(820, 760 + Math.sin(t * 4) * 20, -50 + Math.sin(t * 6) * 8, 1.4);
    let ui = '';
    const out = Ez.in(inv(T.disle - 0.3, T.disle, t));
    if (out < 1) ui += grp(springWord(540, 380, 'ET TOI ?', 200, t, T.ettoi, { fill: '#FFFFFF', sw: 16, ls: 6 }), `translate(0 ${r1(-out * 600)})`);
    const c = spring(t, T.disle, 2.4, 0.6);
    if (c > 0.01) {
      const full = 'Un toit, vite', typed = full.slice(0, Math.floor(clamp((t - T.disle - 0.3) / 0.8) * full.length));
      const card = path('M-430 -95H430Q470 -95 470 -55V55Q470 95 430 95H-430Q-470 95 -470 55V-55Q-470 -95 -430 -95Z', '#FFFFFF', 6) +
        `<circle cx="-380" cy="0" r="46" fill="#F6B53D" stroke="${INK}" stroke-width="5"/>` + grp(pencil(0, 0, -45, 0.32), 'translate(-410 26)') +
        txt(-305, 16, typed || 'Ajoute un commentaire…', 44, typed ? INK : '#9A8F86', { anchor: 'start', weight: 700 }) +
        (Math.floor(t * 3) % 2 ? `<rect x="${r1(-300 + measure(typed, 44, 'Brico', 700))}" y="-24" width="5" height="48" fill="${INK}"/>` : '');
      ui += grp(card, `translate(540 ${r1(400 + (1 - c) * 200)}) scale(${r1(c * 100) / 100})`);
    }
    return { w, ui, cam: { z: 1 + 0.05 * Ez.io(inv(45.9, 49.34, t)) + 0.05 * punch(t, T.ettoi + 0.1, 5), fx: 540, fy: 960, rot: 0 }, cap: true };
  }

  function thumb() {
    return path('M-34 -6H-10L8 -54Q14 -66 26 -60Q38 -54 34 -36L28 -10H58Q72 -10 70 6L62 50Q58 62 46 62H-10V-6Z', '#FFFFFF', 6) + path('M-56 -6H-24V62H-56Z', '#FFFFFF', 6);
  }
  function bell(rot) {
    return grp(path('M0 -44Q30 -44 32 -6L36 22Q38 30 46 34H-46Q-38 30 -36 22L-32 -6Q-30 -44 0 -44Z', '#FFFFFF', 6) + `<circle cx="0" cy="44" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`, `rotate(${rot} 0 -44)`);
  }
  function sCTA(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 900, 22, 2400, t * 0.2, '#F9C55E');
    w += `<rect x="-800" y="1520" width="2700" height="900" fill="#E59E2A"/>` + `<path d="M-800 1520H1900" stroke="${INK}" stroke-width="5"/>`;
    const wave = Math.sin(t * 9) * 18;
    const lp = alive({ arms: { l: [8, 8, 'relax'], r: [150 + wave, 30 + wave * 0.6, 'open'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += R.leo({ x: 360, y: 1560, scale: 0.98, expr: 'content', blink: blinkAt(t, 61), arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean });
    const mIn = Ez.out(inv(50.44, 51.14, t));
    if (mIn > 0) {
      const wk = mIn < 1 ? { lift: [Math.max(0, Math.sin(t * 9)) * 18, Math.max(0, -Math.sin(t * 9)) * 18], bob: -Math.abs(Math.cos(t * 9)) * 8 } : { lift: [0, 0], bob: 0 };
      const mp = alive({ arms: { l: [6, 4, 'relax'], r: t > 51.44 ? [140 + Math.sin(t * 7) * 10, 20, 'open'] : [6, 4, 'relax'] }, tilt: 0, bob: wk.bob, lean: 0 }, t, 7);
      w += R.max({ x: lerp(1300, 760, mIn), y: 1560, scale: 0.92, flip: true, expr: 'touche', mouth: 'smile', blink: blinkAt(t, 62), arms: mp.arms, lift: wk.lift, bob: mp.bob, tilt: mp.tilt });
    }
    let ui = '';
    const bIn = spring(t, 49.34, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = path('M-300 -80H300Q380 -80 380 0Q380 80 300 80H-300Q-380 80 -380 0Q-380 -80 -300 -80Z', done ? '#3A3A42' : '#E5483D', 7) +
      txt(done ? 40 : 0, 26, done ? 'ABONNÉ' : 'S\'ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    ui += grp(btn, `translate(540 ${r1(400 + (1 - bIn) * -400)}) scale(${r1(bIn * pr * 100) / 100})`);
    ui += ring(540, 400, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 400, t, press, 16, 460, 71);
    const cur = inv(49.34, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 430, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
    if (t < press + 0.9) ui += grp(path('M0 0L0 70L18 54L32 86L46 80L32 48L56 48Z', '#FFFFFF', 6), `translate(${r1(cx)} ${r1(cy)}) scale(${cs * 1.4})`, `opacity="${r1((1 - inv(press + 0.5, press + 0.9, t)) * 100) / 100}"`);
    const lk = spring(t, T.like, 2.6, 0.45);
    if (lk > 0.01) {
      ui += grp(`<circle r="110" fill="#4FA3CF" stroke="${INK}" stroke-width="7"/>` + grp(thumb(), 'translate(-6 4) scale(1.15)'), `translate(540 690) rotate(${r1((1 - lk) * -30)}) scale(${r1(lk * 100) / 100})`);
      ui += sparkles(540, 690, t, T.like, 18, 380, 72, ['#FFFFFF', '#4FA3CF', '#FFE27A']) + ring(540, 690, t, T.like, 0.6, 520, '#FFFFFF', 18);
      ui += txt(r1(700 + 20 * Math.sin(t * 3)), r1(640 - Ez.out(inv(T.like, T.like + 1, t)) * 80), '+1', 72, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 10, op: 1 - inv(T.like + 0.8, T.like + 1.3, t) });
    }
    if (t > T.etsi) {
      const k = Ez.io(inv(T.etsi, T.etsi + 0.4, t));
      ui = `<g opacity="${r1((1 - k) * 100) / 100}">${ui}</g>`;
      const shine = inv(52.34, 53.14, t) * 1400 - 700;
      ui += grp(springWord(0, 0, 'ET SI…', 230, t, T.etsi, { fill: '#FFFFFF', sw: 18, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`);
      ui += `<clipPath id="shn"><rect x="${r1(540 + shine - 60)}" y="300" width="120" height="400" transform="skewX(-20)"/></clipPath>`;
      ui += `<g clip-path="url(#shn)">${grp(txt(0, 0, 'ET SI…', 230, '#FFF6C9', { font: 'Anton', weight: 400, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`)}</g>`;
      ui += txt(540, 720, 'À suivre…', 64, INK, { font: 'Caveat', weight: 700, op: clamp((t - 52.54) * 2) });
    }
    return { w, ui, cam: { z: 1 + 0.03 * Math.sin(t * 0.7), fx: 540, fy: 960, rot: 0 }, cap: t < 51.84 };
  }


  // ================================================================== TIMELINE
  const SCENES = [
    { f: sHook, a: 0, b: 3.1 },
    { f: sCat, a: 3.1, b: 6.9, tin: 'zoom', d: 0.4 },
    { f: sPizza, a: 6.9, b: 10.9, tin: 'whip', d: 0.4 },
    { f: sDoor, a: 10.9, b: 14.6, tin: 'whip', d: 0.4 },
    { f: sSteal, a: 14.6, b: 17.75, tin: 'flash', d: 0.3 },
    { f: sEars, a: 17.75, b: 21.3, tin: 'whip', d: 0.4 },
    { f: sMonster, a: 21.3, b: 25.6, tin: 'zoom', d: 0.4 },
    { f: sEat, a: 25.6, b: 29.4, tin: 'cut' },
    { f: sErase, a: 29.4, b: 35.8, tin: 'whip', d: 0.4 },
    { f: sBlow, a: 35.8, b: 39.6, tin: 'zoom', d: 0.4 },
    { f: sRoof, a: 39.6, b: 45.9, tin: 'whip', d: 0.4 },
    { f: sQuestion, a: 45.9, b: 49.34, tin: 'iris', d: 0.55 },
    { f: sCTA, a: 49.34, b: DUR + 1, tin: 'zoom', d: 0.45 },
  ];

  function camTf(c, t) {
    const sh = c.shake || 0;
    const sx = sh ? noise1(t * 2.3, 11) * sh : 0, sy = sh ? noise1(t * 2.1, 17) * sh : 0;
    return `translate(${r1(540 + sx)} ${r1(960 + sy)}) rotate(${r1((c.rot || 0) * 100) / 100}) scale(${r1(c.z * 1000) / 1000}) translate(${r1(-c.fx)} ${r1(-c.fy)})`;
  }
  // rend une scène complète (monde + interface) dans un groupe
  function renderScene(S, t, k) {
    const r = S.f(t);
    let filt = '';
    const fx = [];
    if (r.sat != null && r.sat < 0.999) fx.push('sat');
    if (r.rgb) fx.push('rgb');
    let defs = '';
    if (fx.includes('sat')) defs += `<filter id="sat${k}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${r1(r.sat * 100) / 100}"/>${r.tint ? `<feColorMatrix type="matrix" values="${1 - 0.12 * r.tint} 0 0 0 0  0 ${1 - 0.04 * r.tint} 0 0 0  0 0 ${1 + 0.1 * r.tint} 0 ${r1(0.04 * r.tint * 100) / 100}  0 0 0 1 0"/>` : ''}</filter>`;
    if (fx.includes('rgb')) {
      const d = r1(r.rgb);
      defs += `<filter id="rgb${k}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="${d}" result="ro"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="b" dx="${-d}" result="bo"/>
        <feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter>`;
    }
    let body = `<g transform="${camTf(r.cam, t)}">${r.w}</g>${r.ui || ''}`;
    if (r.glitch > 0.05) {
      const g = rng(Math.floor(t * 24) + 7);
      let sl = '';
      const n = Math.round(2 + r.glitch * 5);
      for (let i = 0; i < n; i++) {
        const y = g() * H, h = 30 + g() * 160 * r.glitch, dx = (g() - 0.5) * 220 * r.glitch;
        sl += `<clipPath id="gl${k}${i}"><rect x="0" y="${r1(y)}" width="${W}" height="${r1(h)}"/></clipPath><g clip-path="url(#gl${k}${i})"><g transform="translate(${r1(dx)} 0)"><use href="#sc${k}"/></g></g>`;
      }
      body = `<g id="sc${k}">${body}</g>${sl}`;
    }
    if (fx.includes('sat')) body = `<g filter="url(#sat${k})">${body}</g>`;
    if (fx.includes('rgb')) body = `<g filter="url(#rgb${k})">${body}</g>`;
    return { svg: defs + body, r };
  }

  // ------------------------------------------------------------------ sous-titres (karaoké 1-3 mots)
  const CH = [];
  (function chunk() {
    const C = window.CUES;
    let cur = [];
    const flush = () => { if (cur.length) CH.push(cur); cur = []; };
    C.forEach((c, i) => {
      cur.push(c);
      const len = cur.map(x => x.w).join(' ').length;
      const nxt = C[i + 1];
      if (/[.?!…,]$/.test(c.w) || len > 13 || !nxt || nxt.s - c.e > 0.35) flush();
    });
    CH.forEach((ch, i) => { ch.a = ch[0].s - 0.04; ch.b = CH[i + 1] ? Math.min(CH[i + 1][0].s - 0.04, ch[ch.length - 1].e + 0.7) : ch[ch.length - 1].e + 0.8; });
  })();
  function captions(t) {
    const ch = CH.find(c => t >= c.a && t < c.b);
    if (!ch) return '';
    const fs = 86, y = 1330;
    const words = ch.map(c => c.w.replace(/[«»]/g, '').toUpperCase());
    const ws = words.map(wd => measure(wd, fs));
    const gap = 34, total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    const e = spring(t, ch.a, 3.2, 0.55);
    let x = 540 - total / 2, s = '';
    words.forEach((wd, i) => {
      const c = ch[i], active = t >= c.s - 0.02 && (i === ch.length - 1 || t < ch[i + 1].s);
      const past = t >= c.s - 0.02;
      const pop = active ? 1 + 0.1 * (1 - spring(t, c.s - 0.02, 3, 0.5)) + 0.05 : 1;
      const cx = x + ws[i] / 2;
      s += `<text x="${r1(cx)}" y="${y}" font-size="${fs}" font-family="Brico" font-weight="800" text-anchor="middle" fill="${active ? '#FFD23F' : '#FFFFFF'}" stroke="${INK}" stroke-width="16" stroke-linejoin="round" paint-order="stroke" opacity="${past ? 1 : 0.55}" transform="translate(${r1(cx)} ${y}) scale(${r1(pop * 100) / 100}) translate(${r1(-cx)} ${-y})">${esc(wd)}</text>`;
      x += ws[i] + gap;
    });
    return grp(s, `translate(540 ${y}) scale(${r1((0.85 + 0.15 * e) * 100) / 100}) translate(-540 ${-y})`, `opacity="${clamp(e * 3)}"`);
  }

  // ------------------------------------------------------------------ grain (tuiles de bruit fixes)
  const GRAIN = [];
  function makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), r = rng(5);
    for (let k = 0; k < 4; k++) {
      const im = x.createImageData(256, 256);
      for (let i = 0; i < im.data.length; i += 4) { const v = Math.floor(r() * 255); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0); GRAIN.push(c.toDataURL());
    }
  }

  // ------------------------------------------------------------------ composition d'une image
  const stage = document.getElementById('stage');
  window.seek = function (t) {
    t = clamp(t, 0, DUR - 1e-4);
    let idx = SCENES.findIndex(S => t >= S.a && t < S.b);
    const S = SCENES[idx];
    let out = '';
    const cur = renderScene(S, t, 'a');
    const tr = S.tin && S.d && t < S.a + S.d ? S.tin : null;
    const k = tr ? Ez.io(inv(S.a, S.a + S.d, t)) : 1;
    if (tr && idx > 0) {
      const P = SCENES[idx - 1];
      const prev = renderScene(P, Math.min(t, P.b + 0.5), 'b');
      if (tr === 'whip') {
        const blur = r1(Math.sin(k * Math.PI) * 60);
        out += `<defs><filter id="wb" x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation="${blur} 0"/></filter></defs>`;
        out += `<g filter="url(#wb)"><g transform="translate(${r1(-k * W)} 0)">${prev.svg}</g><g transform="translate(${r1((1 - k) * W)} 0)">${cur.svg}</g></g>`;
      } else if (tr === 'zoom') {
        out += `<g transform="translate(540 960) scale(${r1((1 + k * 2.5) * 100) / 100}) translate(-540 -960)" opacity="${r1((1 - k) * 100) / 100}">${prev.svg}</g>`;
        out = `<g transform="translate(540 960) scale(${r1((0.6 + 0.4 * k) * 1000) / 1000}) translate(-540 -960)">${cur.svg}</g>` + out;
        out = `<rect width="${W}" height="${H}" fill="#000"/>` + out;
      } else if (tr === 'iris') {
        const rr = r1(Ez.io(k) * 1250);
        out += prev.svg + `<clipPath id="iris"><circle cx="540" cy="900" r="${rr}"/></clipPath><g clip-path="url(#iris)">${cur.svg}</g>`;
        out += `<circle cx="540" cy="900" r="${rr}" fill="none" stroke="${INK}" stroke-width="14"/>`;
      } else if (tr === 'flash') {
        out += cur.svg;
      } else out += cur.svg;
    } else out += cur.svg;
    // post-traitement
    const r = cur.r;
    const vign = r.vign == null ? 0.32 : r.vign;
    out += `<rect width="${W}" height="${H}" fill="url(#vig)" opacity="${r1(vign * 100) / 100}"/>`;
    let flash = r.flash || 0;
    if (tr === 'flash') flash = Math.max(flash, 0.55 * (1 - k));
    if (flash > 0.01) out += `<rect width="${W}" height="${H}" fill="#FFFFFF" opacity="${r1(flash * 100) / 100}"/>`;
    if (r.cap !== false) out += captions(t);
    const gi = Math.floor(t * 30) % 4, gx = Math.floor(hash(Math.floor(t * 30)) * 256), gy = Math.floor(hash(Math.floor(t * 30) + 1) * 256);
    out += `<rect x="${-gx}" y="${-gy}" width="${W + 512}" height="${H + 512}" fill="url(#grain${gi})" opacity=".07" style="mix-blend-mode:overlay"/>`;
    stage.innerHTML = out;
  };
  window.DUR = DUR;
  window.T = T;

  // ------------------------------------------------------------------ démarrage
  (async () => {
    await Promise.all(['800 40px Brico', '400 40px Anton', '700 40px Caveat'].map(f => document.fonts.load(f)));
    makeGrain();
    document.getElementById('defs').innerHTML =
      `<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="1"/></radialGradient>` +
      `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>` +
      `<pattern id="scan" width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000" opacity=".55"/></pattern>` +
      `<filter id="silhouette"><feColorMatrix type="matrix" values="0 0 0 0 0.02 0 0 0 0 0.02 0 0 0 0 0.03 0 0 0 1 0"/></filter>` +
      GRAIN.map((g, i) => `<pattern id="grain${i}" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${g}" width="256" height="256"/></pattern>`).join('');
    const q = new URLSearchParams(location.search);
    window.seek(parseFloat(q.get('t') || '0'));
    window.ready = true;
    if (!q.has('render')) {
      const au = document.getElementById('au'); let t0 = null;
      document.body.addEventListener('click', () => { au.currentTime = 0; au.play(); t0 = performance.now(); const loop = () => { const t = (performance.now() - t0) / 1000; if (t < DUR) { window.seek(t); requestAnimationFrame(loop); } }; loop(); });
    }
  })();
})();
