// « Et si… tu pouvais remonter le temps de 10 secondes ? » — moteur seek(t), 1080 x 1920.
// Tout est calculé à partir du temps : aucune minuterie, aucun état entre deux images.
(function () {
  const W = 1080, H = 1920, DUR = 59.0;
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
    const mIn = Ez.out(inv(52.8, 53.5, t));
    if (mIn > 0) {
      const wk = mIn < 1 ? { lift: [Math.max(0, Math.sin(t * 9)) * 18, Math.max(0, -Math.sin(t * 9)) * 18], bob: -Math.abs(Math.cos(t * 9)) * 8 } : { lift: [0, 0], bob: 0 };
      const mp = alive({ arms: { l: [6, 4, 'relax'], r: t > 53.8 ? [140 + Math.sin(t * 7) * 10, 20, 'open'] : [6, 4, 'relax'] }, tilt: 0, bob: wk.bob, lean: 0 }, t, 7);
      w += R.max({ x: lerp(1300, 760, mIn), y: 1560, scale: 0.92, flip: true, expr: 'touche', mouth: 'smile', blink: blinkAt(t, 62), arms: mp.arms, lift: wk.lift, bob: mp.bob, tilt: mp.tilt });
    }
    let ui = '';
    const bIn = spring(t, 51.7, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = path('M-300 -80H300Q380 -80 380 0Q380 80 300 80H-300Q-380 80 -380 0Q-380 -80 -300 -80Z', done ? '#3A3A42' : '#E5483D', 7) +
      txt(done ? 40 : 0, 26, done ? 'ABONNÉ' : 'S\'ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    ui += grp(btn, `translate(540 ${r1(400 + (1 - bIn) * -400)}) scale(${r1(bIn * pr * 100) / 100})`);
    ui += ring(540, 400, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 400, t, press, 16, 460, 71);
    const cur = inv(51.7, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 430, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
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
      const shine = inv(54.7, 55.5, t) * 1400 - 700;
      ui += grp(springWord(0, 0, 'ET SI…', 230, t, T.etsi, { fill: '#FFFFFF', sw: 18, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`);
      ui += `<clipPath id="shn"><rect x="${r1(540 + shine - 60)}" y="300" width="120" height="400" transform="skewX(-20)"/></clipPath>`;
      ui += `<g clip-path="url(#shn)">${grp(txt(0, 0, 'ET SI…', 230, '#FFF6C9', { font: 'Anton', weight: 400, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`)}</g>`;
      ui += txt(540, 720, 'À suivre…', 64, INK, { font: 'Caveat', weight: 700, op: clamp((t - 54.9) * 2) });
    }
    return { w, ui, cam: { z: 1 + 0.03 * Math.sin(t * 0.7), fx: 540, fy: 960, rot: 0 }, cap: t < 54.2 };
  }


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
