// « Et si… tout le monde voyait ta note au-dessus de ta tête ? » — moteur seek(t), 1080 x 1920.
// Tout est calculé à partir du temps : aucune minuterie, aucun état entre deux images.
(function () {
  const W = 1080, H = 1920, DUR = 61.0;
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
    note: 2.22, tete: 2.94,
    matin: 3.9, trois0: 5.66,
    rue: 6.98, boulanger: 8.66, cinqB: 9.47, gars: 10.22, double: 10.58, une0: 11.79,
    porte: 12.86, quatre: 13.3, fais: 14.46, chauffeur: 14.86, cinq1: 15.9,
    cafe: 17.26, selfies: 18.14, adore: 19.5,
    mais: 20.36, deux0: 22.14, tomber: 24.02, poste: 25.86,
    milliers: 27.26, trois: 28.94, deux: 29.78, une: 30.54,
    bus: 31.7, chien: 33.34,
    etmax: 35.06, video: 36.06, cinqM: 36.78,
    attrapes: 38.18, arraches: 39.38, silence: 40.99,
    fille: 43.02, autre: 44.3, toute: 44.78, rue2: 45.42,
    reste: 46.22, ciel: 47.42, celle: 48.09, maintenant: 49.26, regarde: 50.62,
    ettoi: 51.79, combien: 52.62, disle: 53.61, abonne: 54.76, like: 55.5, etsi: 56.3,
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

  // ================================================================== LA NOTE
  // Badge flottant : 5 étoiles qui se remplissent (valeur continue), chiffre, halo.
  let BN = 0;
  const STAR5 = (r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.46 : r; d += (i ? 'L' : 'M') + r1(Math.cos(a) * rr) + ' ' + r1(Math.sin(a) * rr); } return d + 'Z'; };
  const rateCol = v => v < 1.6 ? '#FF4D5E' : v >= 4.5 ? '#FFC83D' : v >= 3.5 ? '#FFDF7A' : '#F3F0E8';
  // valeur qui glisse d'un palier à l'autre ; pop = instant du dernier changement
  function rateAt(t, keys) {
    let v = keys[0][1], pop = -9, d = 0;
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) break;
      const k = Ez.o5(inv(keys[i][0], keys[i][0] + 0.45, t));
      v += (keys[i][1] - keys[i - 1][1]) * k; pop = keys[i][0]; d = keys[i][1] - keys[i - 1][1];
    }
    return { v, pop, d };
  }
  function badgeBody(val, t, o) {
    const id = 'bd' + (BN++), col = rateCol(val);
    let g = '';
    const glowC = val >= 4.5 ? '#FFD23F' : val < 1.6 ? '#FF4D5E' : '#FFFFFF';
    g += `<ellipse rx="250" ry="92" fill="${glowC}" opacity="${r1((0.22 + 0.1 * Math.sin(t * 5 + (o.seed || 0))) * (o.glow == null ? 1 : o.glow) * 100) / 100}" filter="url(#soft)"/>`;
    g += path('M-160 -54H160Q214 -54 214 0Q214 54 160 54H-160Q-214 54 -214 0Q-214 -54 -160 -54Z', '#2A2D38', 7);
    const n = Math.floor(clamp(val, 0, 5)), f = clamp(val, 0, 5) - n;
    const xb = n >= 5 ? 200 : -176 + n * 62 + f * 52;
    g += `<clipPath id="${id}"><rect x="-210" y="-60" width="${r1(xb + 210)}" height="120"/></clipPath>`;
    let empty = '', full = '';
    for (let i = 0; i < 5; i++) {
      const cx = -150 + i * 62;
      empty += `<path d="${STAR5(27)}" transform="translate(${cx} 2)" fill="#4A4E5E"/>`;
      full += `<path d="${STAR5(27)}" transform="translate(${cx} 2)" fill="${col}" stroke="${INK}" stroke-width="3"/>`;
    }
    g += empty + `<g clip-path="url(#${id})">${full}</g>`;
    g += txt(166, 18, (Math.round(val * 10) / 10).toFixed(1), 48, col, { font: 'Anton', weight: 400 });
    return g;
  }
  // o : s (échelle), seed, pop (instant du dernier changement), rip (0..1 arrachée), still
  function badge(x, y, val, t, o = {}) {
    const s = o.s == null ? 1 : o.s;
    if (s < 0.01) return '';
    const bob = o.still ? 0 : Math.sin(t * 2.4 + (o.seed || 0)) * 8;
    const pk = o.pop != null && t >= o.pop ? Math.exp(-(t - o.pop) * 6) * Math.cos((t - o.pop) * 22) : 0;
    const sc = s * (1 + 0.28 * pk);
    const rot = (o.rot || 0) + pk * 6 * (o.d < 0 ? -1 : 1);
    if (o.rip > 0) {
      const k = o.rip, body = badgeBody(val, t, o), id = 'rp' + (BN++);
      const half = (sd) => `<clipPath id="${id}${sd > 0 ? 'r' : 'l'}"><path d="${sd < 0 ? 'M-260 -80H10L-14 -20L16 20L-6 80H-260Z' : 'M260 -80H10L-14 -20L16 20L-6 80H260Z'}"/></clipPath>` +
        grp(`<g clip-path="url(#${id}${sd > 0 ? 'r' : 'l'})">${body}</g>`, `translate(${r1(sd * k * 300)} ${r1(k * k * 520)}) rotate(${r1(sd * k * 55)})`);
      return grp(half(-1) + half(1), `translate(${r1(x)} ${r1(y + bob)}) scale(${r1(sc * 100) / 100})`, `opacity="${r1(clamp(1 - (k - 0.55) / 0.45) * 100) / 100}"`);
    }
    return grp(badgeBody(val, t, o), `translate(${r1(x)} ${r1(y + bob)}) rotate(${r1(rot)}) scale(${r1(sc * 100) / 100})`);
  }
  // « +1 ★ » / « −1 ★ » qui s'envole
  function deltaFx(x, y, t, pop, d) {
    const k = inv(pop, pop + 1.1, t);
    if (k <= 0 || k >= 1 || !d) return '';
    const up = d > 0, label = (up ? '+' : '−') + Math.abs(Math.round(d)) + ' ★';
    return txt(r1(x + 230), r1(y - (up ? 1 : -1) * Ez.out(k) * 120), label, 64, up ? '#FFE27A' : '#FF4D5E', { font: 'Anton', weight: 400, stroke: INK, sw: 10, op: r1(Math.sin(Math.PI * k) * 1.4 * 100) / 100 });
  }
  // éclats d'étoiles (note arrachée)
  function starBurst(cx, cy, t, t0, n, seed, col = '#FFC83D', spread = 1) {
    const dt = t - t0;
    if (dt <= 0 || dt > 1.8) return '';
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, v = (500 + r() * 900) * spread;
      const x = cx + Math.cos(a) * v * dt, y = cy + Math.sin(a) * v * dt + 900 * dt * dt;
      s += `<path d="${STAR5(10 + r() * 16)}" fill="${i % 3 ? col : '#FFFFFF'}" stroke="${INK}" stroke-width="2.5" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(dt * 600 * (r() - 0.5))})" opacity="${r1(clamp(1.8 - dt) * 100) / 100}"/>`;
    }
    return s;
  }
  // position du poignet d'un passant (pour lui mettre un téléphone dans la main)
  function pWrist(o, sd) {
    const a = o.arms[sd < 0 ? 'l' : 'r'], L = R.prims.limb(sd * 58, -300, sd, 70, 66, a[0], a[1]), sc = o.scale || 1;
    return [o.x + L.W[0] * sc * (o.flip ? -1 : 1), o.y + (L.W[1] + (o.bob || 0)) * sc];
  }
  function phoneAt(x, y, sc, rot = 0, flash = 0) {
    let s = grp(path('M-26 -46H26Q34 -46 34 -38V38Q34 46 26 46H-26Q-34 46 -34 38V-38Q-34 -46 -26 -46Z', '#2A2D38', 5) + `<rect x="-26" y="-38" width="52" height="72" fill="#7FC8F0"/>`, `translate(${r1(x)} ${r1(y)}) rotate(${rot}) scale(${sc})`);
    if (flash > 0.01) s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(90 * sc)}" fill="#FFFFFF" opacity="${r1(flash * 100) / 100}"/>`;
    return s;
  }
  // gobelet de café
  const cup = (x, y, sc = 1, rot = 0) => grp(path('M-24 -34H24L18 34H-18Z', '#FFFFFF', 5) + path('M-26 -44H26V-32H-26Z', '#7A4B2A', 5) + path('M-22 -6H21L19 12H-20Z', '#C98852', 0), `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(${sc})`);
  // chien du voisin (assis, de face)
  function dog(x, y, sc, o = {}) {
    const turn = o.turn || 0, tail = Math.sin((o.t || 0) * 10) * 20 * (1 - turn);
    let s = path(`M30 -40Q${r1(80 + tail)} -110 ${r1(70 + tail)} -130`, 'none', 12);
    s += path('M-56 0Q-62 -90 0 -100Q62 -90 56 0Z', '#C98852', 6);
    s += grp(path('M-52 -60Q-56 -128 0 -132Q56 -128 52 -60Q40 -26 0 -26Q-40 -26 -52 -60Z', '#C98852', 6) +
      path('M-48 -112Q-80 -100 -70 -54Q-50 -70 -40 -100Z', '#7A4B2A', 5) + path('M48 -112Q80 -100 70 -54Q50 -70 40 -100Z', '#7A4B2A', 5) +
      (turn > 0.5 ? path('M-30 -84Q-20 -94 -10 -84M10 -84Q20 -94 30 -84', 'none', 5).replace('fill="none"', 'fill="none"') + `<path d="M-10 -52Q0 -46 10 -52" stroke="${INK}" stroke-width="5" fill="none"/>`
        : ell(-20, -82, 9, 11, INK) + ell(20, -82, 9, 11, INK) + ell(-17, -86, 3, 3, '#FFFFFF') + ell(23, -86, 3, 3, '#FFFFFF')) +
      ell(0, -58, 14, 10, INK), `translate(0 0) rotate(${r1(turn * -35)} 0 -40) translate(${r1(turn * -14)} 0)`);
    return grp(s, `translate(${r1(x)} ${r1(y)}) scale(${sc * (o.flip ? -1 : 1)} ${sc})`);
  }
  // ------------------------------------------------------------------ décors
  const BLD = [['#F2C6A0', 520], ['#BFD8E8', 380], ['#E8B4B8', 600], ['#D9E3B0', 430], ['#C9B8E0', 560], ['#F4D9A0', 470], ['#B8DCD0', 610], ['#EBC0A0', 400]];
  function street(t, o = {}) {
    let w = `<defs><linearGradient id="skyst" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.rain ? '#7F93A8' : '#9BD6F2'}"/><stop offset="1" stop-color="${o.rain ? '#C2CAD2' : '#FFEBD0'}"/></linearGradient></defs>`;
    w += `<rect x="-1400" y="-800" width="5200" height="3600" fill="url(#skyst)"/>`;
    if (!o.rain) for (let i = 0; i < 4; i++) { const x = ((i * 900 + t * 30) % 3600) - 1200; w += grp(ell(0, 0, 120, 50, '#FFFFFF') + ell(-80, 14, 70, 40, '#FFFFFF') + ell(90, 10, 80, 44, '#FFFFFF'), `translate(${r1(x)} ${200 + i * 70})`, 'opacity=".85"'); }
    // immeubles
    for (let i = -4; i < 10; i++) {
      const [c, h] = BLD[((i % 8) + 8) % 8], x = i * 380 - 40, top = 1460 - h - 300;
      w += path(`M${x} ${top}H${x + 360}V1460H${x}Z`, c, 5);
      for (let r = 0; r < Math.floor((h + 200) / 150); r++) for (let k = 0; k < 3; k++) {
        const wx = x + 40 + k * 110, wy = top + 50 + r * 150, lit = hash(i * 31 + r * 7 + k) > 0.6;
        w += `<rect x="${wx}" y="${wy}" width="70" height="90" rx="6" fill="${lit ? '#FFE9A8' : '#8FB4CF'}" stroke="${INK}" stroke-width="4"/>`;
      }
    }
    // boulangerie (x 120 -> 940)
    w += path('M120 980H940V1460H120Z', '#F6D7A7', 6) + path('M150 1000H910V1100H150Z', '#FFF6E6', 5) + txt(530, 1072, 'BOULANGERIE', 66, '#B5562D', { font: 'Anton', weight: 400, ls: 4 });
    for (let i = 0; i < 9; i++) w += path(`M${120 + i * 91} 1110H${120 + (i + 1) * 91}L${120 + (i + 1) * 91 - 10} 1180H${130 + i * 91}Z`, i % 2 ? '#FFFFFF' : '#E5483D', 4);
    w += path('M170 1200H480V1440H170Z', '#BFE6F5', 5) + path('M600 1200H860V1460H600Z', '#8A5A3B', 5);
    for (let i = 0; i < 3; i++) w += ell(240 + i * 90, 1380, 40, 22, '#E2A35A') + `<path d="M${215 + i * 90} 1372l14 -10M${238 + i * 90} 1376l14 -10M${261 + i * 90} 1380l10 -8" stroke="${INK}" stroke-width="3"/>`;
    // trottoir, route
    w += `<rect x="-1400" y="1460" width="5200" height="300" fill="#D8CFC4" stroke="${INK}" stroke-width="5"/>`;
    for (let x = -1400; x < 3800; x += 200) w += `<path d="M${x} 1460L${x - 40} 1760" stroke="${INK}" stroke-width="3" opacity=".2"/>`;
    w += `<rect x="-1400" y="1760" width="5200" height="900" fill="#5B5F6B" stroke="${INK}" stroke-width="5"/>`;
    for (let x = -1400; x < 3800; x += 300) w += `<rect x="${x}" y="1880" width="160" height="22" fill="#F3F0E8" opacity=".8"/>`;
    // arrêt de bus (x 1900)
    w += path('M1896 1000H1914V1470H1896Z', '#8B909C', 4) + `<circle cx="1905" cy="980" r="58" fill="#2F8F5B" stroke="${INK}" stroke-width="6"/>` + txt(1905, 998, 'BUS', 44, '#FFFFFF', { font: 'Anton', weight: 400 });
    return w;
  }
  function rainFx(t, k) {
    if (k <= 0.01) return '';
    const r = rng(Math.floor(t * 30) + 77); let d = '';
    for (let i = 0; i < 90; i++) { const x = r() * 1300 - 100, y = r() * 2000 - 40; d += `M${r1(x)} ${r1(y)}l-14 60`; }
    return `<path d="${d}" stroke="#DCE8F5" stroke-width="4" stroke-linecap="round" opacity="${r1(0.6 * k * 100) / 100}"/>`;
  }
  // bus vu de côté (avance vers la droite), conducteur à l'avant
  function bus(x, y, t, o = {}) {
    let s = path('M-560 -380H500Q560 -380 570 -320L580 -60Q580 0 520 0H-560Q-590 0 -590 -30V-350Q-590 -380 -560 -380Z', '#2F8F5B', 7);
    for (let i = 0; i < 5; i++) s += `<rect x="${-540 + i * 190}" y="-340" width="160" height="150" rx="14" fill="#BFE6F5" stroke="${INK}" stroke-width="5"/>`;
    s += path('M420 -340H520Q550 -340 552 -300L556 -190H420Z', '#BFE6F5', 5);
    if (o.driver) s += `<clipPath id="drvc"><path d="M420 -340H520Q550 -340 552 -300L556 -190H420Z"/></clipPath><g clip-path="url(#drvc)">${o.driver}</g>`;
    s += `<rect x="-590" y="-150" width="1170" height="34" fill="#F6B53D"/>` + txt(-80, -40, 'LIGNE 42', 52, '#FFFFFF', { font: 'Anton', weight: 400 });
    for (const wx of [-380, 340]) s += grp(`<circle r="64" fill="#2A2D38" stroke="${INK}" stroke-width="6"/><circle r="26" fill="#C9C4BC"/><path d="M-26 0H26M0 -26V26" stroke="${INK}" stroke-width="5"/>`, `translate(${wx} 0) rotate(${r1((o.spin || 0) * 57.3)})`);
    return grp(s, `translate(${r1(x)} ${r1(y)}) scale(${o.s || 1})`);
  }
  function bathroom(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#CFE9F2"/>`;
    for (let y = -400; y < 2400; y += 120) for (let x = -400; x < 1500; x += 120) w += `<rect x="${x + ((y / 120) % 2 ? 60 : 0)}" y="${y}" width="116" height="116" fill="#E3F3F8" opacity=".7"/>`;
    w += path('M-200 1540H1300V2400H-200Z', '#F7F3E8', 6) + path('M-200 1540H1300V1600H-200Z', '#FFFFFF', 5);
    return w;
  }

  // ================================================================== SCÈNES

  // ---- 1. Accroche : une note au-dessus de toi
  function sHook(t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#2A2350"/>` + rays(540, 900, 24, 2400, t * 0.3, '#332B60');
    for (let i = 0; i < 26; i++) { const r = rng(i + 3), x = r() * 1080, y = r() * 1700, tw = 0.5 + 0.5 * Math.sin(t * 4 + i); w += `<path d="${STAR5(6 + r() * 10)}" fill="#FFE27A" transform="translate(${r1(x)} ${r1(y)}) scale(${r1(tw * 100) / 100})" opacity=".8"/>`; }
    const lp = alive({ arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    if (t > T.note) lp.arms.r = arm(LA(1, 70, -700, 1), 'point');
    w += shadow(540, 1820, 170);
    w += R.leo({ x: 540, y: 1820, scale: 1.3, expr: t > T.note ? 'surpris' : 'neutre', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 1), look: t > T.note ? [0, -0.9] : [0, 0] });
    // la note qui défile comme une machine à sous puis se pose
    const bin = spring(t, T.note - 0.2, 2.2, 0.5);
    const spin = t < T.tete ? (t * 9) % 5 : 3 + 2 * Math.sin(t * 2) * 0;
    const val = t < T.tete + 0.3 ? spin : 3.0;
    w += badge(540, 760, val, t, { s: bin * 1.25, pop: T.tete + 0.3, seed: 1 });
    w += ring(540, 760, t, T.tete + 0.3, 0.6, 520, '#FFE27A', 20);
    let ui = '';
    const exit = Ez.in(inv(3.15, 3.5, t));
    if (exit < 1) ui += grp(springWord(540, 300, 'ET SI…', 210, t, 0.08, { fill: '#F6B53D', sw: 16, ls: 6 }), `translate(0 ${r1(-exit * 600)})`);
    return { w, ui, cam: { z: 1 + 0.06 * Ez.io(inv(0, 3.5, t)) + 0.05 * punch(t, T.tete + 0.3, 6), fx: 540, fy: 1000, rot: Math.sin(t * 1.2) * 1 }, cap: true };
  }

  // ---- 2. Le miroir : trois étoiles
  function sMirror(t) {
    let w = bathroom(t);
    const surprised = t > T.trois0 - 0.1;
    const brush = !surprised;
    const bx = Math.sin(t * 18) * 14;
    let arms = { l: [10, 10, 'relax'], r: brush ? arm(LA(1, 40 + bx, -470, 1), 'fist') : [20, 20, 'relax'] };
    if (surprised) arms = { l: [10, 10, 'relax'], r: arm(LA(1, 150, -560, 1), 'fist') };
    const lp = alive({ arms, tilt: 0, bob: 0, lean: 0 }, t, 2, 0.6);
    w += R.leo({ x: 540, y: 1850, scale: 1.55, expr: surprised ? 'surpris' : 'fatigue', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 2), look: surprised ? [0, -0.9] : [0, 0.2] });
    // brosse à dents + mousse
    const hx = 540 + (brush ? 40 + bx : 150) * 1.55, hy = 1850 + (brush ? -470 : -560) * 1.55;
    w += grp(path('M-90 -8H40V8H-90Z', '#4FA3CF', 4) + path('M-110 -16H-80V4H-110Z', '#FFFFFF', 4), `translate(${r1(hx)} ${r1(hy)}) rotate(${brush ? 0 : -60})`);
    if (brush) for (let i = 0; i < 5; i++) w += ell(470 + i * 30 + Math.sin(t * 9 + i) * 6, 1152 + Math.cos(t * 7 + i) * 8, 16 + (i % 2) * 6, 14, '#FFFFFF');
    // la note tombe du plafond et rebondit
    const k = spring(t, T.trois0 - 0.35, 2.4, 0.45);
    w += badge(540, lerp(-200, 680, k), 3, t, { s: 1.3, pop: T.trois0, seed: 2, still: k < 0.9 });
    w += sparkles(540, 680, t, T.trois0, 16, 380, 3) + ring(540, 680, t, T.trois0, 0.6, 520, '#FFFFFF', 20);
    // cadre du miroir (le spectateur est le miroir)
    let ui = `<path d="M0 0H1080V1920H0Z M70 90Q70 60 100 60H980Q1010 60 1010 90V1830Q1010 1860 980 1860H100Q70 1860 70 1830Z" fill="#E8D9C2" fill-rule="evenodd" stroke="${INK}" stroke-width="8"/>`;
    ui += `<path d="M140 160L320 100M150 260L420 120" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" opacity=".35"/>`;
    const cam = cam2([[3.3, 1.0, 540, 1000], [T.trois0 - 0.4, 1.0, 540, 960, 0.1], [T.trois0, 1.12, 540, 900, 0.3]], t);
    cam.z *= 1 + 0.05 * punch(t, T.trois0, 6);
    cam.shake = 10 * decay(t, T.trois0, 6);
    return { w, ui, cam, cap: true };
  }

  // ---- 3. La rue : tout le monde a sa note
  const BAKER = { x: 730, y: 1600, scale: 1.25, coat: '#FFFFFF', hairStyle: 'chauve', skin: '#E9B48C', hair: '#4A3226', pants: '#4B4E63' };
  const QUEUE = [
    { x: 1300, y: 1640, scale: 1.2, coat: '#9AA0B5', hairStyle: 'chignon', skin: '#F4CDB0', hair: '#8A4B2A', flip: true },
    { x: 1520, y: 1640, scale: 1.2, coat: '#B5D99C', hairStyle: 'afro', skin: '#5E3A26', hair: '#1E1410', flip: true },
    { x: 1740, y: 1640, scale: 1.2, coat: '#F4D06F', hairStyle: 'long', skin: '#C98E62', hair: '#2A1B14', flip: true },
  ];
  function sStreet(t) {
    let w = street(t);
    // passants qui marchent en arrière-plan avec leur note
    const walkers = [[-200, 1580, 0.95, '#7FB7BE', 'casquette', 4.2], [2300, 1580, 0.95, '#F28CB1', 'long', 3.6]];
    walkers.forEach(([x0, y, s, coat, hs, v], i) => {
      const x = x0 + (i ? -1 : 1) * (t - 6.6) * 160, wk = walkPose(t + i, 8, 16);
      w += R.passant({ x, y, scale: s, flip: !!i, coat, hairStyle: hs, skin: i ? '#8D5A3B' : '#F4CDB0', hair: '#2A1B14', expr: 'content', lift: wk.lift, bob: wk.bob, arms: { l: [10 - wk.swing, 8], r: [10 + wk.swing, 8] } });
      w += badge(x, y - 560 * s, v, t, { s: 0.6, seed: 10 + i });
    });
    // le boulanger, toque et 5 étoiles
    const bp = { ...BAKER, expr: 'content', arms: t > T.cinqB ? { l: [10, 8], r: [140, 30] } : { l: [10, 8], r: [10, 8] }, bob: Math.sin(t * 2.3) * 3 };
    w += R.passant(bp) + path('M-50 -470Q-70 -540 -20 -540Q0 -580 30 -540Q76 -540 50 -470Z', '#FFFFFF', 5).replace('<path', `<path transform="translate(${BAKER.x} ${BAKER.y}) scale(${BAKER.scale})"`);
    const bk = rateAt(t, [[0, 4.6], [T.cinqB, 5]]);
    w += badge(BAKER.x, BAKER.y - 640 * BAKER.scale, bk.v, t, { s: spring(t, T.boulanger - 0.3, 2.4, 0.5) * 0.9, pop: bk.pop, d: bk.d, seed: 3 });
    w += sparkles(BAKER.x, BAKER.y - 800, t, T.cinqB, 18, 360, 11);
    // la file d'attente et celui qui double
    QUEUE.forEach((q, i) => {
      const angry = t > T.une0 - 0.2;
      w += R.passant({ ...q, expr: angry ? 'choque' : 'blase', arms: angry && i === 0 ? { l: [10, 8], r: [100, 0] } : { l: [10, 8], r: [10, 8] }, bob: Math.sin(t * 2 + i) * 3 });
      w += badge(q.x, q.y - 560 * q.scale, [4.1, 3.8, 4.4][i], t, { s: 0.55, seed: 20 + i });
    });
    const cut = Ez.io(inv(T.double - 0.2, T.double + 0.6, t)), cx = lerp(2050, 1110, cut), wk = cut > 0 && cut < 1 ? walkPose(t, 10, 18) : { lift: [0, 0], bob: 0, swing: 0 };
    const cutter = { x: cx, y: 1640, scale: 1.2, flip: true, coat: '#E5483D', hairStyle: 'casquette', skin: '#E9B48C', hair: '#3D6FB6', expr: t > T.une0 ? 'panique' : 'content', lift: wk.lift, bob: wk.bob, arms: { l: [10 - wk.swing, 8], r: [10 + wk.swing, 8] } };
    w += R.passant(cutter);
    const ck = rateAt(t, [[0, 2.4], [T.une0, 1]]);
    w += badge(cx, 1640 - 560 * 1.2, ck.v, t, { s: 0.7 + 0.25 * Ez.out(inv(T.une0, T.une0 + 0.3, t)), pop: ck.pop, d: ck.d, seed: 5 });
    let ui = '';
    if (t > T.une0) ui += stamp(540, 520, 'RESQUILLEUR', '#E5483D', t, T.une0, -8);
    if (t > T.cinqB && t < T.gars) ui += stamp(540, 520, 'PARFAIT', '#2FA56A', t, T.cinqB, 6);
    const cam = cam2([[6.6, 1.0, 400, 1100], [T.boulanger - 0.4, 1.35, 730, 1050, 0.6], [T.gars - 0.3, 1.0, 1400, 1150, 0.6], [T.une0 - 0.1, 1.25, 1150, 1100, 0.3]], t);
    cam.z *= 1 + 0.05 * punch(t, T.une0, 6) + 0.04 * punch(t, T.cinqB, 6);
    cam.shake = 10 * decay(t, T.une0, 6);
    return { w, ui, cam, cap: true };
  }

  // ---- 4. Tu tiens la porte : quatre étoiles
  function sDoor(t) {
    let w = street(t);
    // porte vitrée de la boulangerie ouverte par Léo
    const open = Ez.out(inv(12.2, 12.7, t));
    w += path(`M600 1200H${r1(600 + 260 * (1 - open * 0.75))}V1460H600Z`, '#BFE6F5', 5);
    // mamie qui passe
    const mx = lerp(1150, 760, Ez.io(inv(12.3, 13.4, t))), wk = walkPose(t, 6, 10);
    w += R.passant({ x: mx, y: 1640, scale: 1.1, flip: true, coat: '#9B7EC8', hairStyle: 'chignon', skin: '#F4CDB0', hair: '#D9D9D9', glasses: true, expr: t > T.quatre - 0.2 ? 'amour' : 'content', lift: t < 13.4 ? wk.lift : [0, 0], bob: wk.bob });
    w += badge(mx, 1640 - 560 * 1.1, 4.8, t, { s: 0.55, seed: 31 });
    if (t > T.quatre) w += hearts(mx, 1640 - 500, t, T.quatre - 0.1, 5, 32);
    // Léo
    const lp = alive({ arms: { l: arm(LA(-1, -160, -360, -1), 'open'), r: [10, 10, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    w += shadow(480, 1660, 150);
    w += R.leo({ x: 480, y: 1650, scale: 1.1, flip: false, expr: t > T.quatre ? 'content' : 'neutre', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 3), look: [0.7, 0] });
    const lv = rateAt(t, [[0, 3], [T.quatre, 4]]);
    w += badge(480, 1650 - 780 * 1.1, lv.v, t, { s: 0.9, pop: lv.pop, d: lv.d, seed: 1 }) + deltaFx(480, 1650 - 780 * 1.1, t, lv.pop, lv.d);
    w += sparkles(480, 790, t, T.quatre, 14, 300, 33);
    const cam = cam2([[12.1, 1.15, 620, 1250], [T.quatre - 0.3, 1.3, 520, 1050, 0.4]], t);
    cam.z *= 1 + 0.05 * punch(t, T.quatre, 6);
    return { w, cam, cap: true };
  }

  // ---- 5. Le chauffeur de bus rit : cinq étoiles
  function sBus(t) {
    let w = street(t);
    const arrive = Ez.out(inv(14.2, 14.9, t));
    const bx = lerp(-700, 1380, arrive);
    const laugh = t > T.cinq1 - 0.5;
    const drv = R.passant({ x: 484, y: -40, scale: 0.62, coat: '#3D6FB6', hairStyle: 'casquette', skin: '#C98E62', hair: '#2F5DB4', expr: laugh ? 'rire' : 'blase', tilt: laugh ? Math.sin(t * 20) * 6 : 0 });
    w += bus(bx, 1700, t, { driver: drv, spin: -(1 - arrive) * 12 });
    const dk = rateAt(t, [[0, 4.3], [T.cinq1, 4.8]]);
    w += badge(bx + 484, 1700 - 470, dk.v, t, { s: 0.5, seed: 41, pop: dk.pop, d: dk.d });
    // Léo fait le clown
    const funny = t > T.fais - 0.1;
    const wig = Math.sin(t * 14);
    const lp = alive({ arms: funny ? { l: [150 + wig * 15, 60, 'open'], r: [150 - wig * 15, 60, 'open'] } : { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: funny ? wig * 8 : 0, bob: funny ? -Math.abs(Math.sin(t * 7)) * 20 : 0, lean: funny ? wig * 6 : 0 }, t, 1);
    w += shadow(2120, 1660, 150);
    w += R.leo({ x: 2120, y: 1650, scale: 1.1, expr: funny ? (t > T.cinq1 ? 'rire' : 'content') : 'neutre', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 4), look: [-0.8, -0.2] });
    const lv = rateAt(t, [[0, 4], [T.cinq1, 5]]);
    w += badge(2120, 1650 - 780 * 1.1, lv.v, t, { s: 0.9, pop: lv.pop, d: lv.d, seed: 1 }) + deltaFx(2120, 1650 - 780 * 1.1, t, lv.pop, lv.d);
    w += starBurst(2120, 790, t, T.cinq1, 30, 42) + ring(2120, 790, t, T.cinq1, 0.7, 700, '#FFD23F', 26);
    let ui = '';
    if (t > T.cinq1) ui += springWord(540, 400, '5 ÉTOILES !', 150, t, T.cinq1, { fill: '#FFC83D', sw: 14, ls: 2 });
    const cam = cam2([[14.3, 1.0, 1800, 1200], [T.cinq1 - 0.2, 1.2, 1950, 1100, 0.3]], t);
    cam.z *= 1 + 0.06 * punch(t, T.cinq1, 6);
    cam.shake = 14 * decay(t, T.cinq1, 5);
    return { w, ui, cam, cap: true, rgb: 10 * decay(t, T.cinq1, 4) };
  }

  // ---- 6. La belle vie : café offert, selfies
  function sStar(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#FFB84D"/>` + rays(540, 900, 26, 2600, t * 0.4, '#FFC870');
    w += `<rect x="-800" y="1600" width="2700" height="900" fill="#E59E2A" stroke="${INK}" stroke-width="5"/>`;
    // fans avec téléphones
    const fans = [
      { x: 170, y: 1720, scale: 1.15, coat: '#7FB7BE', hairStyle: 'casquette', skin: '#C98E62', hair: '#3D6FB6' },
      { x: 910, y: 1720, scale: 1.15, flip: true, coat: '#F28CB1', hairStyle: 'long', skin: '#F4CDB0', hair: '#8A4B2A' },
      { x: 300, y: 1520, scale: 0.85, coat: '#B5D99C', hairStyle: 'afro', skin: '#5E3A26', hair: '#1E1410' },
      { x: 790, y: 1520, scale: 0.85, flip: true, coat: '#9AA0B5', hairStyle: 'chignon', skin: '#E9B48C', hair: '#4A3226' },
    ];
    const shoot = t > T.selfies - 0.2;
    fans.forEach((f, i) => {
      const o = { ...f, expr: 'amour', arms: shoot ? { l: [10, 8], r: [120, 50] } : { l: [10, 8], r: [10, 8] }, bob: -Math.abs(Math.sin(t * 6 + i)) * 10 };
      w += R.passant(o);
      if (shoot) { const [px, py] = pWrist(o, 1); const fl = ((t - T.selfies + i * 0.17) % 0.7); w += phoneAt(px, py - 10, f.scale * 1.1, f.flip ? 10 : -10, fl < 0.08 ? 0.9 : 0); }
    });
    // Léo, star du jour
    const gotCup = t > T.cafe + 0.15;
    const lp = alive({ arms: { l: [20, 20, 'relax'], r: gotCup ? arm(LA(1, 130, -330, 1), 'fist') : [10, 10, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 1);
    if (t > T.adore - 0.2) lp.arms.l = [150, 30, 'open'];
    w += shadow(540, 1670, 160);
    w += R.leo({ x: 540, y: 1660, scale: 1.2, expr: 'content', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 5), lean: lp.lean });
    // le café arrive en glissant, étiquette « OFFERT »
    const ck = Ez.back(inv(T.cafe - 0.4, T.cafe + 0.15, t));
    if (!gotCup) w += cup(lerp(1300, 540 + 130 * 1.2, ck), 1660 - 330 * 1.2, 1.3);
    else w += cup(540 + 130 * 1.2, 1660 - 330 * 1.2 - 20, 1.3);
    if (t > T.cafe) w += grp(path('M-80 -30H80V30H-80Z', '#2FA56A', 5) + txt(0, 14, 'OFFERT', 40, '#FFFFFF', { font: 'Anton', weight: 400 }), `translate(${540 + 130 * 1.2 + 120} ${1660 - 330 * 1.2 - 90}) rotate(-10) scale(${r1(spring(t, T.cafe, 3, 0.45) * 100) / 100})`);
    w += badge(540, 1660 - 780 * 1.2, 5, t, { s: 1.0, seed: 1, glow: 1.6 });
    w += hearts(540, 900, t, T.adore - 0.2, 12, 51);
    // notifications qui pleuvent
    let ui = '';
    const notes = [['❤ 1 254', 18.4], ['★★★★★', 18.8], ['ON T\'ADORE', 19.2], ['❤ 9 999+', 19.6]];
    notes.forEach(([l, t0], i) => {
      const k = spring(t, t0, 2.6, 0.5);
      if (k > 0.01) ui += grp(path('M-170 -44H170Q194 -44 194 -20V20Q194 44 170 44H-170Q-194 44 -194 20V-20Q-194 -44 -170 -44Z', '#FFFFFF', 6) + txt(0, 16, l, 46, i === 1 ? '#F6B53D' : '#E5483D', { font: 'Anton', weight: 400 }), `translate(${i % 2 ? 790 : 290} ${300 + i * 120}) rotate(${(i % 2 ? 4 : -4)}) scale(${r1(k * 100) / 100})`);
    });
    let flash = 0;
    if (shoot) { const ph = (t - T.selfies) % 0.35; flash = ph < 0.05 ? 0.35 : 0; }
    const cam = cam2([[16.4, 1.15, 540, 1150], [T.selfies - 0.2, 1.0, 540, 1100, 0.5], [T.adore, 1.08, 540, 1050, 0.6]], t);
    return { w, ui, cam, flash, cap: true };
  }

  // ---- 7. Max : deux étoiles. Il te fait tomber et poste la vidéo
  function sMax(t) {
    let w = street(t);
    const push = T.tomber - 0.05, fallK = clamp((t - push) / 0.45);
    // Max
    let mArms = { l: [6, 4, 'relax'], r: [6, 4, 'relax'] }, mEx = t < T.deux0 - 0.2 ? 'neutre' : 'vexe';
    if (t > push - 0.4 && t < push + 0.35) { mArms = { l: [6, 4, 'relax'], r: arm(MA(1, 300, -420, 1), 'open') }; mEx = 'mechant'; }
    if (t > push + 0.35) { mArms = { l: [6, 4, 'relax'], r: arm(MA(1, 150, -600, 1), 'phone') }; mEx = 'rire'; }
    const mp = alive({ arms: mArms, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += shadow(1150, 1650, 130);
    w += R.max({ x: 1150, y: 1640, scale: 1.0, flip: true, expr: mEx, arms: mp.arms, tilt: mp.tilt + (mEx === 'rire' ? Math.sin(t * 18) * 3 : 0), bob: mp.bob, blink: blinkAt(t, 9) });
    w += badge(1150, 1640 - 860, 2, t, { s: spring(t, T.mais - 0.2, 2.4, 0.5) * 0.85, seed: 7, pop: T.deux0, d: 0 });
    // Léo arrive avec son café, tombe
    const walkIn = Ez.out(inv(20.2, 22.0, t)), lx = lerp(250, 880, walkIn);
    let rot = 0, expr = 'content', arms = { l: [10, 10, 'relax'], r: arm(LA(1, 130, -330, 1), 'fist') }, lift = [0, 0], bob = 0;
    if (walkIn < 1) { const wk = walkPose(t, 8, 16); lift = wk.lift; bob = wk.bob; arms.l = [10 - wk.swing, 10, 'relax']; }
    if (t > T.deux0 && t < push) expr = 'neutre';
    if (fallK > 0) { rot = -Ez.in(fallK) * 82; expr = 'panique'; arms = { l: [150, 30, 'open'], r: [150, 30, 'open'] }; lift = [30, 0]; bob = 0; }
    w += shadow(lx, 1660, 150);
    w += `<g transform="rotate(${r1(rot)} ${r1(lx - 40)} 1650)">` + R.leo({ x: lx, y: 1650, scale: 1.1, expr, arms, lift, bob, blink: blinkAt(t, 1), squash: fallK >= 1 ? 0.12 * decay(t, push + 0.45, 10) : 0, look: t > T.deux0 - 0.4 && fallK <= 0 ? [0.8, -0.4] : [0, 0] }) + '</g>';
    if (fallK <= 0) w += cup(lx + 130 * 1.1, 1650 - 330 * 1.1 - 20, 1.2) + badge(lx, 1650 - 780 * 1.1, 5, t, { s: 0.85, seed: 1 });
    else {
      // le café vole et éclabousse
      const dt = t - push, cxp = lx + 140 + dt * 500, cyp = 1650 - 380 + dt * -600 + dt * dt * 2400;
      if (cyp < 1640) w += cup(cxp, cyp, 1.2, dt * 700);
      for (let i = 0; i < 14; i++) { const r = rng(i + 90), a = -Math.PI / 2 + (r() - 0.5) * 2, v = 400 + r() * 700, d = clamp(dt - 0.1); w += ell(lx + 60 + Math.cos(a) * v * d, Math.min(1660, 1450 + Math.sin(a) * v * d + 1800 * d * d), 12 + r() * 10, 9 + r() * 6, '#7A4B2A'); }
      w += badge(lx - 300, 1500 - 300 * fallK, 5, t, { s: 0.85, seed: 1, rot: -30 * fallK });
      if (fallK >= 1) w += dizzy(lx - 330, 1520, t, spring(t, push + 0.45, 2.5, 0.5));
    }
    let ui = '';
    if (t > push + 0.4) ui += viewfinder(t, push + 0.4);
    // publication de la vidéo
    if (t > T.poste - 0.2) {
      const k = spring(t, T.poste - 0.2, 2.4, 0.55), prog = clamp((t - T.poste) / 0.9);
      ui += grp(path('M-330 -120H330Q370 -120 370 -80V80Q370 120 330 120H-330Q-370 120 -370 80V-80Q-370 -120 -330 -120Z', '#FFFFFF', 7) +
        `<circle cx="-280" cy="-30" r="44" fill="#D62E40" stroke="${INK}" stroke-width="5"/>` + txt(-280, -14, 'M', 50, '#FFFFFF', { font: 'Anton', weight: 400 }) +
        txt(-210, -40, 'MAX', 44, INK, { anchor: 'start', font: 'Anton', weight: 400 }) + txt(-210, 10, 'MDRRR il tombe 😂', 38, '#555', { anchor: 'start', weight: 700 }) +
        `<rect x="-320" y="50" width="640" height="26" rx="13" fill="#E3E3E3"/><rect x="-320" y="50" width="${r1(640 * prog)}" height="26" rx="13" fill="${prog >= 1 ? '#2FA56A' : '#4FA3CF'}"/>` +
        (prog >= 1 ? txt(240, -36, 'PUBLIÉ ✓', 40, '#2FA56A', { font: 'Anton', weight: 400 }) : ''),
        `translate(540 ${r1(560 + (1 - k) * -500)}) scale(${r1(k * 100) / 100})`);
    }
    const cam = cam2([[20.2, 1.15, 760, 1200], [T.mais, 1.5, 1150, 980, 0.6], [T.deux0 + 0.6, 1.0, 900, 1150, 0.6], [push, 1.2, 800, 1250, 0.15]], t);
    cam.z *= 1 + 0.06 * punch(t, push + 0.45, 6);
    cam.shake = 26 * decay(t, push + 0.45, 6);
    return { w, ui, cam, cap: true, rgb: 14 * decay(t, push + 0.45, 4) };
  }

  // ---- 8. Des milliers d'inconnus te notent
  function sCrash(t) {
    const lv = rateAt(t, [[0, 5], [T.trois, 3], [T.deux, 2], [T.une, 1]]);
    const alarm = lv.v < 1.6 ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="${mix('#3B2A5A', '#7A1F2B', clamp((5 - lv.v) / 4))}"/>` + rays(540, 760, 24, 2400, -t * 0.4, mix('#45336A', '#8C2533', clamp((5 - lv.v) / 4)));
    // pluie de notes d'inconnus
    for (let i = 0; i < 26; i++) {
      const r = rng(i + 200), t0 = 27.0 + r() * 3.4, k = (t - t0) / 1.6;
      if (k <= 0 || k >= 1) continue;
      const x = 80 + r() * 920, y = 1900 - Ez.out(k) * (1000 + r() * 700);
      const n = r() < 0.75 ? 1 : 2, lbl = '★'.repeat(n) + '☆'.repeat(5 - n), msg = ['nul', 'lol', 'bof', 'mdr', '1/5', 'la honte'][i % 6];
      w += grp(path('M-130 -40H130Q150 -40 150 -20V20Q150 40 130 40H-130Q-150 40 -150 20V-20Q-150 -40 -130 -40Z', '#FFFFFF', 5) + txt(-60, 14, lbl, 34, '#FF4D5E', { font: 'Brico', weight: 800 }) + txt(84, 14, msg, 32, INK, { weight: 800 }),
        `translate(${r1(x)} ${r1(y)}) rotate(${r1((r() - 0.5) * 16)}) scale(${r1(Math.min(1, k * 6) * 0.9 * 100) / 100})`, `opacity="${r1(clamp((1 - k) * 3) * 100) / 100}"`);
    }
    // Léo en gros plan
    const ex = lv.v > 4 ? 'surpris' : lv.v > 2.5 ? 'panique' : lv.v > 1.6 ? 'choque' : 'triste';
    w += R.leo({ x: 540, y: 1040, scale: 2.0, headOnly: true, expr: ex, blink: blinkAt(t, 3), tilt: Math.sin(t * 9) * 2 * (lv.v < 3 ? 1 : 0), look: [0, -0.8] });
    w += badge(540, 470, lv.v, t, { s: 1.6, pop: lv.pop, d: lv.d, seed: 1, glow: 1 + alarm });
    w += deltaFx(540, 470, t, lv.pop, lv.d);
    let ui = '';
    [[T.trois, '3'], [T.deux, '2'], [T.une, '1']].forEach(([t0, l]) => { const k = inv(t0, t0 + 0.7, t); if (k > 0 && k < 1) ui += grp(txt(0, 0, l, 420, '#FF4D5E', { font: 'Anton', weight: 400, stroke: INK, sw: 18 }), `translate(540 ${1060}) scale(${r1((1.6 - 0.6 * Ez.o5(k)) * 100) / 100})`, `opacity="${r1(Math.sin(Math.PI * k) * 100) / 100}"`); });
    if (alarm > 0) ui += `<rect width="${W}" height="${H}" fill="none" stroke="#FF2D40" stroke-width="${r1(30 + 30 * alarm)}" opacity="${r1(alarm * 0.8 * 100) / 100}"/>`;
    const hit = Math.max(decay(t, T.trois, 6), decay(t, T.deux, 6), decay(t, T.une, 5));
    return { w, ui, cam: { z: 1.0 + 0.05 * Ez.io(inv(27, 31.3, t)) + 0.06 * hit, fx: 540, fy: 960, rot: 0, shake: 24 * hit }, rgb: 6 + 26 * hit, glitch: 0.9 * hit, cap: true };
  }

  // ---- 9. Le bus ne s'arrête plus, le chien t'ignore
  function sSad(t) {
    let w = street(t, { rain: true });
    // Léo à l'arrêt, sous la pluie
    const lp = alive({ arms: { l: [6, 6, 'relax'], r: [6, 6, 'relax'] }, tilt: 0, bob: 0, lean: 0 }, t, 1, 0.4);
    const splash = t > T.bus + 0.25;
    w += shadow(1700, 1660, 150);
    w += R.leo({ x: 1700, y: 1650, scale: 1.1, expr: splash && t < T.bus + 1.2 ? 'choque' : 'triste', arms: lp.arms, tilt: lp.tilt - 6, bob: lp.bob, blink: blinkAt(t, 1), look: t < T.chien ? [-0.8, 0] : [0.8, 0.3] });
    w += badge(1700, 1650 - 780 * 1.1, 1, t, { s: 0.9, seed: 1, glow: 0.6 });
    // nuage de pluie perso au-dessus de lui
    w += grp(ell(0, 0, 120, 50, '#6F7C8C') + ell(-80, 14, 70, 40, '#6F7C8C') + ell(90, 10, 80, 44, '#6F7C8C'), `translate(1700 ${560 + Math.sin(t * 2) * 10})`);
    // le bus passe sans s'arrêter + gerbe d'eau
    const bk = inv(T.bus - 0.5, T.bus + 1.0, t);
    if (bk > 0 && bk < 1) w += bus(lerp(600, 3300, bk), 1880, t, { spin: t * 14, s: 1.05 });
    if (splash) for (let i = 0; i < 22; i++) { const r = rng(i + 300), d = t - T.bus - 0.25 - r() * 0.1; if (d > 0 && d < 0.9) w += ell(1600 + r() * 220 + d * 200, 1700 - (500 + r() * 400) * d + 1800 * d * d, 10 + r() * 10, 14 + r() * 8, '#9FD8F5'); }
    // le voisin et son chien
    const turn = Ez.io(inv(T.chien + 0.2, T.chien + 0.6, t));
    w += R.passant({ x: 2250, y: 1650, scale: 1.1, flip: true, coat: '#B5D99C', hairStyle: 'court', skin: '#E9B48C', hair: '#4A3226', expr: 'blase', bob: Math.sin(t * 2) * 3 });
    w += badge(2250, 1650 - 560 * 1.1, 3.9, t, { s: 0.5, seed: 61 });
    w += dog(2060, 1660, 1.15, { turn, t });
    w += badge(2060, 1660 - 260, 4.5, t, { s: 0.42, seed: 62 });
    if (turn > 0.5) w += bubble(1960, 1250, 220, 120, { s: spring(t, T.chien + 0.5, 2.6, 0.5), seed: 63, lines: ['Pff.'], fs: 54, font: 'Anton', weight: 400 });
    const cam = cam2([[31.3, 1.1, 1500, 1250], [T.bus + 0.2, 1.2, 1650, 1250, 0.3], [T.chien - 0.3, 1.25, 1950, 1250, 0.6]], t);
    cam.shake = 14 * decay(t, T.bus + 0.25, 5);
    return { w, ui: rainFx(t, 1), cam, sat: 0.45, tint: 1, cap: true };
  }

  // ---- 10. Et Max ? Cinq étoiles
  function sMaxStar(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3600" fill="#2A2350"/>` + rays(540, 900, 24, 2600, t * 0.5, '#3A2F6E');
    w += `<path d="M380 -200L700 -200L900 1700H180Z" fill="#FFE9A8" opacity=".22"/>`;
    w += `<rect x="-800" y="1640" width="2700" height="900" fill="#1C1838" stroke="${INK}" stroke-width="5"/>`;
    const mv = rateAt(t, [[0, 2], [T.video - 0.1, 3.5], [T.cinqM, 5]]);
    const mp = alive({ arms: { l: [150, 30, 'open'], r: arm(MA(1, 150, -600, 1), 'phone') }, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += shadow(540, 1650, 150);
    w += R.max({ x: 540, y: 1640, scale: 1.15, expr: t > T.cinqM ? 'hautain' : 'moqueur', arms: mp.arms, tilt: mp.tilt, bob: mp.bob, blink: blinkAt(t, 9) });
    // couronne qui tombe sur sa tête
    const ck = spring(t, T.cinqM, 2.6, 0.45);
    if (t > T.cinqM - 0.1) w += grp(path('M-70 0L-80 -70L-36 -36L0 -86L36 -36L80 -70L70 0Z', '#FFC83D', 6) + ell(0, -50, 9, 9, '#E5483D'), `translate(540 ${r1(lerp(300, 1640 - 790 * 1.15, ck))}) rotate(-8)`);
    w += badge(540, 1640 - 980 * 1.15, mv.v, t, { s: 1.15, pop: mv.pop, d: mv.d, seed: 7, glow: 1.4 });
    w += starBurst(540, 520, t, T.cinqM, 30, 71) + confetti(540, 400, t, T.cinqM, 50, 72);
    let ui = '';
    const vk = spring(t, T.video - 0.2, 2.6, 0.5);
    if (vk > 0.01) ui += grp(path('M-200 -50H200Q230 -50 230 -20V20Q230 50 200 50H-200Q-230 50 -230 20V-20Q-230 -50 -200 -50Z', '#FFFFFF', 6) + txt(0, 16, `▶ ${Math.round(lerp(12, 1000, Ez.io(inv(T.video, T.cinqM + 0.4, t))))} K VUES`, 44, '#E5483D', { font: 'Anton', weight: 400 }), `translate(820 1000) rotate(6) scale(${r1(vk * 100) / 100})`);
    const cam = cam2([[34.6, 1.0, 540, 1150], [T.cinqM - 0.3, 1.2, 540, 900, 0.4]], t);
    cam.z *= 1 + 0.06 * punch(t, T.cinqM, 6);
    return { w, ui, cam, cap: true };
  }

  // ---- 11. Tu attrapes ta note… et tu l'arraches. Silence.
  const CROWD = [
    { x: 120, y: 1700, scale: 1.05, coat: '#7FB7BE', hairStyle: 'casquette', skin: '#C98E62', hair: '#3D6FB6', v: 4.1 },
    { x: 960, y: 1700, scale: 1.05, flip: true, coat: '#F28CB1', hairStyle: 'long', skin: '#F4CDB0', hair: '#8A4B2A', v: 3.7 },
    { x: 300, y: 1480, scale: 0.8, coat: '#B5D99C', hairStyle: 'afro', skin: '#5E3A26', hair: '#1E1410', v: 4.4 },
    { x: 780, y: 1480, scale: 0.8, flip: true, coat: '#9AA0B5', hairStyle: 'chignon', skin: '#E9B48C', hair: '#4A3226', v: 2.9 },
  ];
  function sRip(t) {
    let w = street(t);
    const frozen = t > T.arraches + 0.3;
    CROWD.forEach((c, i) => {
      w += R.passant({ ...c, expr: frozen ? 'choque' : 'neutre', bob: frozen ? 0 : Math.sin(t * 2 + i) * 3 });
      w += badge(c.x, c.y - 560 * c.scale, c.v, frozen ? T.arraches + 0.3 : t, { s: 0.55 * c.scale / 0.9, seed: 80 + i, still: frozen });
    });
    const reach = t > T.attrapes - 0.25, ripK = inv(T.arraches, T.arraches + 1.2, t);
    let arms = { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, ex = 'triste';
    if (reach) { arms = { l: arm(LA(-1, -40, -770, -1), 'fist'), r: arm(LA(1, 40, -770, 1), 'fist') }; ex = 'determine'; }
    if (t > T.arraches) { const k = Ez.o5(clamp((t - T.arraches) / 0.25)); arms = { l: arm(LA(-1, lerp(-40, -260, k), lerp(-770, -560, k), -1), 'fist'), r: arm(LA(1, lerp(40, 260, k), lerp(-770, -560, k), 1), 'fist') }; ex = 'enerve'; }
    if (frozen) ex = 'neutre';
    const lp = alive({ arms, tilt: 0, bob: 0, lean: 0 }, frozen ? T.arraches + 0.3 : t, 1, frozen ? 0 : 1);
    w += shadow(540, 1880, 180);
    w += R.leo({ x: 540, y: 1870, scale: 1.4, expr: ex, arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: frozen ? 0 : blinkAt(t, 1), look: reach && !frozen ? [0, -1] : [0, 0] });
    const by = 1870 - 790 * 1.4;
    if (t < T.arraches) w += badge(540, by + (reach ? Math.sin(t * 40) * 6 : 0), 1, t, { s: 1.1, seed: 1, still: reach, rot: reach ? Math.sin(t * 50) * 3 : 0 });
    else w += badge(540, by, 1, T.arraches, { s: 1.1, rip: Ez.out(ripK), still: true });
    w += starBurst(540, by, t, T.arraches, 34, 91, '#FF4D5E', 1.2) + ring(540, by, t, T.arraches, 0.6, 800, '#FFFFFF', 30);
    let ui = '';
    if (t > T.silence - 0.3) ui += springWord(540, 420, 'SILENCE.', 150, t, T.silence - 0.3, { fill: '#FFFFFF', sw: 14, ls: 6, rot: 0 });
    const cam = cam2([[37.6, 1.05, 540, 1200], [T.attrapes - 0.2, 1.4, 540, 900, 0.5], [T.arraches, 1.15, 540, 1050, 0.2], [T.arraches + 0.4, 1.0, 540, 1150, 2.2]], t);
    cam.z *= 1 + 0.08 * punch(t, T.arraches, 6);
    cam.shake = 30 * decay(t, T.arraches, 6) + (reach && t < T.arraches ? 4 : 0);
    const sat = frozen ? clamp(1 - Ez.io(inv(T.arraches + 0.3, T.arraches + 0.9, t)) * 0.85, 0.15) : 1;
    return { w, ui, cam, sat, cap: true, flash: 0.7 * decay(t, T.arraches, 8), rgb: 20 * decay(t, T.arraches, 5) };
  }

  // ---- 12. Puis une fille. Puis un autre. Puis toute la rue.
  function sChain(t) {
    let w = street(t);
    // rangée du fond (toute la rue)
    const back = [];
    for (let i = 0; i < 7; i++) back.push({ x: -120 + i * 220, y: 1500, scale: 0.7, flip: i % 2 === 1, coat: ['#7FB7BE', '#F4D06F', '#C9B8E0', '#B8DCD0', '#E8B4B8', '#9AA0B5', '#D9E3B0'][i], hairStyle: ['court', 'long', 'casquette', 'afro', 'chignon', 'chauve', 'court'][i], skin: ['#F4CDB0', '#8D5A3B', '#E9B48C', '#5E3A26', '#C98E62', '#F4CDB0', '#E9B48C'][i], hair: ['#4A3226', '#1E1410', '#3D6FB6', '#1E1410', '#8A4B2A', '#4A3226', '#E2A35A'][i], v: 2.5 + hash(i + 5) * 2.4 });
    const allT = T.rue2 - 0.1;
    back.forEach((c, i) => {
      const tr = allT + i * 0.04, done = t > tr;
      w += R.passant({ ...c, expr: done ? 'rire' : 'choque', arms: done ? { l: [150, 30], r: [150, 30] } : { l: [10, 8], r: [10, 8] }, bob: done ? -Math.abs(Math.sin(t * 8 + i)) * 12 : 0 });
      w += badge(c.x, c.y - 560 * 0.7, c.v, t, { s: 0.42, seed: 100 + i, rip: done ? Ez.out(inv(tr, tr + 1, t)) : 0 });
      w += starBurst(c.x, c.y - 392, t, tr, 10, 110 + i, '#FFC83D', 0.6);
    });
    // la fille puis le garçon, au premier plan
    const girl = { x: 190, y: 1760, scale: 1.2, coat: '#F28CB1', hairStyle: 'long', skin: '#8D5A3B', hair: '#2A1B14' };
    const guy = { x: 900, y: 1760, scale: 1.2, flip: true, coat: '#7FB7BE', hairStyle: 'casquette', skin: '#F4CDB0', hair: '#3D6FB6' };
    [[girl, T.fille, 3.6], [guy, T.autre, 4.3]].forEach(([p, tr, v], i) => {
      const done = t > tr;
      w += R.passant({ ...p, expr: done ? 'rire' : 'choque', arms: t > tr - 0.3 ? { l: [10, 8], r: [done ? 120 : 165, done ? 60 : 10] } : { l: [10, 8], r: [10, 8] }, bob: done && t > allT ? -Math.abs(Math.sin(t * 8 + i)) * 12 : 0 });
      w += badge(p.x, p.y - 560 * 1.2, v, t, { s: 0.6, seed: 120 + i, rip: done ? Ez.out(inv(tr, tr + 1, t)) : 0 });
      w += starBurst(p.x, p.y - 672, t, tr, 22, 130 + i);
    });
    // Léo au centre, sans note, qui sourit
    const happy = t > T.fille;
    const lp = alive({ arms: t > allT ? { l: [150, 30, 'open'], r: [150, 30, 'open'] } : { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0, bob: t > allT ? -Math.abs(Math.sin(t * 8)) * 14 : 0, lean: 0 }, t, 1);
    w += shadow(540, 1880, 170);
    w += R.leo({ x: 540, y: 1870, scale: 1.25, expr: t > allT ? 'rire' : happy ? 'content' : 'surpris', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, blink: blinkAt(t, 1) });
    let ui = confetti(540, 900, t, allT, 70, 141);
    if (t > allT) ui += springWord(540, 400, 'TOUTE LA RUE !', 130, t, allT, { fill: '#FFE27A', sw: 14, ls: 2 });
    const cam = cam2([[41.9, 1.35, 280, 1250], [T.autre - 0.3, 1.35, 800, 1250, 0.4], [T.toute, 0.95, 540, 1250, 0.6]], t);
    cam.z *= 1 + 0.05 * punch(t, allT, 6) + 0.04 * punch(t, T.fille, 6) + 0.04 * punch(t, T.autre, 6);
    cam.shake = 10 * decay(t, allT, 5);
    return { w, ui, cam, cap: true };
  }

  // ---- 13. Il ne reste qu'une note : celle de Max. Tout le monde le regarde.
  function sLast(t) {
    let w = street(t);
    const turnK = Ez.io(inv(T.maintenant, T.maintenant + 0.5, t)), phones = t > T.regarde - 0.15;
    // Max au fond, au milieu de la rue
    const scared = t > T.maintenant + 0.3;
    const mp = alive({ arms: scared ? { l: [30, 60, 'open'], r: [30, 60, 'open'] } : { l: [6, 4, 'relax'], r: arm(MA(1, 150, -600, 1), 'phone') }, tilt: 0, bob: 0, lean: 0 }, t, 7);
    w += shadow(540, 1540, 120);
    w += R.max({ x: 540, y: 1530, scale: 0.95, expr: scared ? 'peur' : 'hautain', arms: mp.arms, tilt: mp.tilt + (scared ? Math.sin(t * 30) * 2 : 0), bob: mp.bob, blink: blinkAt(t, 9) });
    w += `<ellipse cx="540" cy="${1530 - 980 * 0.95}" rx="${r1(260 + 20 * Math.sin(t * 3))}" ry="120" fill="#FFE27A" opacity=".18" filter="url(#soft)"/>`;
    w += badge(540, 1530 - 980 * 0.95, 5, t, { s: 1.0, seed: 7, glow: 1.6, rot: scared ? Math.sin(t * 40) * 3 : 0 });
    // la foule, de dos puis face à lui, téléphones levés
    const crowd = [[60, 1880, 1.2, '#7FB7BE', 'casquette'], [300, 1820, 1.05, '#F28CB1', 'long'], [780, 1820, 1.05, '#B5D99C', 'afro'], [1020, 1880, 1.2, '#F4D06F', 'chignon'], [200, 1640, 0.8, '#C9B8E0', 'court'], [880, 1640, 0.8, '#E8B4B8', 'court']];
    crowd.forEach(([x, y, s, coat, hs], i) => {
      const o = { x, y, scale: s, flip: x > 540 ? turnK > 0.5 : turnK < 0.5, coat, hairStyle: hs, skin: ['#C98E62', '#F4CDB0', '#5E3A26', '#E9B48C', '#8D5A3B', '#F4CDB0'][i], hair: '#2A1B14', expr: turnK > 0.5 ? 'blase' : 'rire', tilt: (1 - turnK) * Math.sin(t * 6 + i) * 3, arms: phones ? { l: [10, 8], r: [120, 50] } : { l: [10, 8], r: [10, 8] } };
      w += R.passant(o);
      if (phones) { const [px, py] = pWrist(o, 1); w += phoneAt(px, py - 10, s * 1.1, o.flip ? 10 : -10, ((t - T.regarde + i * 0.13) % 0.6) < 0.06 ? 0.8 : 0); }
    });
    let ui = '';
    if (scared) ui += txt(700, 960, 'gloups', 70, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 10, rot: -8, op: clamp((t - T.maintenant - 0.4) * 4) });
    const cam = cam2([[46.0, 1.0, 540, 1250], [T.ciel - 0.6, 1.3, 540, 700, 0.8], [T.celle, 1.4, 540, 1150, 0.6], [T.maintenant, 1.0, 540, 1300, 0.6], [T.regarde, 1.25, 540, 1150, 0.4]], t);
    cam.z *= 1 + 0.04 * punch(t, T.regarde, 6);
    return { w, ui, cam, cap: true, flash: phones ? (((t - T.regarde) % 0.3) < 0.04 ? 0.25 : 0) : 0 };
  }

  // ---- 14. « Et toi ? »
  function sQuestion(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 1040, 22, 2400, t * 0.2, '#F9C55E');
    w += R.leo({ x: 540, y: 1080 + Math.sin(t * 2) * 6, scale: 2.35, headOnly: true, expr: t > T.disle ? 'content' : 'neutre', blink: blinkAt(t, 51), tilt: Math.sin(t * 1.3) * 3 });
    const q = (t * 4) % 5;
    w += badge(540, 560, t < T.combien ? 0 : t < T.disle ? q : 5, t, { s: spring(t, T.ettoi + 0.2, 2.4, 0.5) * 1.1, seed: 9 });
    let ui = '';
    const out = Ez.in(inv(T.disle - 0.3, T.disle, t));
    if (out < 1) ui += grp(springWord(540, 330, 'ET TOI ?', 200, t, T.ettoi, { fill: '#FFFFFF', sw: 16, ls: 6 }), `translate(0 ${r1(-out * 600)})`);
    const c = spring(t, T.disle, 2.4, 0.6);
    if (c > 0.01) {
      const full = '★★★★★ évidemment', typed = full.slice(0, Math.floor(clamp((t - T.disle - 0.3) / 0.9) * full.length));
      const card = path('M-430 -95H430Q470 -95 470 -55V55Q470 95 430 95H-430Q-470 95 -470 55V-55Q-470 -95 -430 -95Z', '#FFFFFF', 6) +
        `<circle cx="-380" cy="0" r="46" fill="#F6B53D" stroke="${INK}" stroke-width="5"/>` + `<path d="${STAR5(26)}" transform="translate(-380 2)" fill="#FFFFFF"/>` +
        txt(-305, 16, typed || 'Ajoute un commentaire…', 44, typed ? INK : '#9A8F86', { anchor: 'start', weight: 700 }) +
        (Math.floor(t * 3) % 2 ? `<rect x="${r1(-300 + measure(typed, 44, 'Brico', 700))}" y="-24" width="5" height="48" fill="${INK}"/>` : '');
      ui += grp(card, `translate(540 ${r1(330 + (1 - c) * 200)}) scale(${r1(c * 100) / 100})`);
    }
    return { w, ui, cam: { z: 1 + 0.05 * Ez.io(inv(51.3, 54.62, t)) + 0.05 * punch(t, T.ettoi + 0.1, 5), fx: 540, fy: 960, rot: 0 }, cap: true };
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
    const mIn = Ez.out(inv(55.72, 56.42, t));
    if (mIn > 0) {
      const wk = mIn < 1 ? { lift: [Math.max(0, Math.sin(t * 9)) * 18, Math.max(0, -Math.sin(t * 9)) * 18], bob: -Math.abs(Math.cos(t * 9)) * 8 } : { lift: [0, 0], bob: 0 };
      const mp = alive({ arms: { l: [6, 4, 'relax'], r: t > 56.72 ? [140 + Math.sin(t * 7) * 10, 20, 'open'] : [6, 4, 'relax'] }, tilt: 0, bob: wk.bob, lean: 0 }, t, 7);
      w += R.max({ x: lerp(1300, 760, mIn), y: 1560, scale: 0.92, flip: true, expr: 'touche', mouth: 'smile', blink: blinkAt(t, 62), arms: mp.arms, lift: wk.lift, bob: mp.bob, tilt: mp.tilt });
    }
    let ui = '';
    const bIn = spring(t, 54.62, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = path('M-300 -80H300Q380 -80 380 0Q380 80 300 80H-300Q-380 80 -380 0Q-380 -80 -300 -80Z', done ? '#3A3A42' : '#E5483D', 7) +
      txt(done ? 40 : 0, 26, done ? 'ABONNÉ' : 'S\'ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    ui += grp(btn, `translate(540 ${r1(400 + (1 - bIn) * -400)}) scale(${r1(bIn * pr * 100) / 100})`);
    ui += ring(540, 400, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 400, t, press, 16, 460, 71);
    const cur = inv(54.62, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 430, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
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
      const shine = inv(57.62, 58.42, t) * 1400 - 700;
      ui += grp(springWord(0, 0, 'ET SI…', 230, t, T.etsi, { fill: '#FFFFFF', sw: 18, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`);
      ui += `<clipPath id="shn"><rect x="${r1(540 + shine - 60)}" y="300" width="120" height="400" transform="skewX(-20)"/></clipPath>`;
      ui += `<g clip-path="url(#shn)">${grp(txt(0, 0, 'ET SI…', 230, '#FFF6C9', { font: 'Anton', weight: 400, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`)}</g>`;
      ui += txt(540, 720, 'À suivre…', 64, INK, { font: 'Caveat', weight: 700, op: clamp((t - 57.82) * 2) });
    }
    return { w, ui, cam: { z: 1 + 0.03 * Math.sin(t * 0.7), fx: 540, fy: 960, rot: 0 }, cap: t < 57.12 };
  }


  // ================================================================== TIMELINE
  const SCENES = [
    { f: sHook, a: 0, b: 3.3 },
    { f: sMirror, a: 3.3, b: 6.6, tin: 'zoom', d: 0.4 },
    { f: sStreet, a: 6.6, b: 12.1, tin: 'whip', d: 0.4 },
    { f: sDoor, a: 12.1, b: 14.3, tin: 'whip', d: 0.35 },
    { f: sBus, a: 14.3, b: 16.4, tin: 'whip', d: 0.35 },
    { f: sStar, a: 16.4, b: 20.2, tin: 'flash', d: 0.3 },
    { f: sMax, a: 20.2, b: 27.0, tin: 'whip', d: 0.4 },
    { f: sCrash, a: 27.0, b: 31.3, tin: 'zoom', d: 0.4 },
    { f: sSad, a: 31.3, b: 34.6, tin: 'cut' },
    { f: sMaxStar, a: 34.6, b: 37.6, tin: 'whip', d: 0.4 },
    { f: sRip, a: 37.6, b: 41.9, tin: 'zoom', d: 0.4 },
    { f: sChain, a: 41.9, b: 46.0, tin: 'flash', d: 0.3 },
    { f: sLast, a: 46.0, b: 51.3, tin: 'whip', d: 0.4 },
    { f: sQuestion, a: 51.3, b: 54.62, tin: 'iris', d: 0.55 },
    { f: sCTA, a: 54.62, b: DUR + 1, tin: 'zoom', d: 0.45 },
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
    BN = 0;
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
