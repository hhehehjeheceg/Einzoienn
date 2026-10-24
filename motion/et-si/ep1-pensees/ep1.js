// « Et si… tu pouvais entendre les pensées des autres ? » — moteur seek(t), 1080 x 1920.
// Tout est calculé à partir du temps : aucune minuterie, aucun état entre deux images.
(function () {
  const W = 1080, H = 1920, DUR = 58.0;
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
    tout: 3.47, yeux: 5.39, etla: 6.163, commence: 6.91,
    rue: 8.19, personne: 9.15, voix: 10.07,
    four: 11.3, lundi: 12.91, mignon: 14.19, franch: 15.85, genial: 16.75,
    chat: 18.0, pense: 19.39, absol: 20.62, rien2: 21.27,
    mais: 21.98, trop: 23.27, cent: 24.11, meme: 25.43, partout: 26.11, toutle: 26.63, cut: 27.25,
    etpuis: 28.37, max: 29.69,
    moque: 31.37, filme: 32.53, rigole: 33.29,
    sauf: 34.6, pense2: 36.79,
    chez: 38.76, personne2: 39.72, jamais: 40.6,
    celui: 41.92, mal1: 43.08, est: 43.68, mal2: 44.96,
    ettoi: 46.14, pensent: 48.36, disle: 49.07,
    abonne: 50.22, like: 50.96, etsi: 52.1,
  };
  const blinkAt = (t, seed) => { // clignements naturels
    const per = 3.1 + hash(seed) * 1.7, ph = (t + hash(seed + 5) * per) % per;
    return ph < 0.13 ? Math.sin(ph / 0.13 * Math.PI) : 0;
  };

  // ================================================================== SCÈNES
  // Chaque scène renvoie { w: monde (caméra), ui: écran, cam, sat, rgb, glitch, cap, bg }

  // ---- 1. Le lit, vu du dessus : nuit -> matin
  function sBed(t) {
    const day = Ez.io(inv(4.45, 5.2, t));
    let w = '';
    w += `<rect x="-200" y="-200" width="1480" height="2320" fill="${mix('#3B3366', '#E9B887', day)}"/>`;
    for (let y = -200; y < 2200; y += 120) w += `<path d="M-200 ${y}H1300" stroke="${mix('#2C2650', '#D19E6E', day)}" stroke-width="5"/>`;
    // table de chevet + réveil
    w += path('M900 330H1090V640H900Z', mix('#4A3F75', '#B07A4E', day), 5);
    w += path('M930 400H1060V490H930Z', '#2A2D38', 5);
    const hh = t < 5.2 ? '03:12' : '07:00';
    w += txt(995, 466, hh, 52, t < 5.2 ? '#FF6B6B' : '#7BFFB0', { font: 'Anton', weight: 400 });
    // lit
    w += path('M120 300H960V2300H120Z', mix('#5B4A8A', '#C98B5A', day), 6);
    w += path('M150 330H930V2300H150Z', mix('#E8E4F5', '#FFFFFF', day), 5);
    w += path('M250 430Q540 390 830 430Q860 600 830 790Q540 820 250 790Q220 600 250 430Z', mix('#CFC9EA', '#F7F2EA', day), 5);
    // couverture étoilée
    const blanket = 'M140 900Q540 860 940 900L960 2300H120Z';
    w += path(blanket, mix('#3E5AA8', '#F6B53D', day), 6);
    w += path('M140 900Q540 860 940 900L942 960Q540 920 138 960Z', mix('#D7D2EE', '#FFF6E6', day), 5);
    const rs = rng(4);
    for (let i = 0; i < 16; i++) {
      const x = 200 + rs() * 700, y = 1020 + rs() * 860;
      w += `<path d="${STAR(18 + rs() * 12)}" fill="${mix('#FFE27A', '#FFFFFF', day)}" opacity=".85" transform="translate(${r1(x)} ${r1(y)})"/>`;
    }
    // mains sur la couverture
    w += ell(330, 990, 34, 30, '#E9B48C') + ell(750, 990, 34, 30, '#E9B48C');
    // Léo sur l'oreiller
    const open = t < T.yeux ? 1 : 1 - spring(t, T.yeux, 3.2, 0.55);
    const blink = t < T.yeux ? 1 : Math.max(clamp(open), blinkAt(t, 3));
    let look = [0, 0];
    if (t > T.etla + 0.1) look = [lerp(0, -0.85, Ez.io(inv(T.etla + 0.1, T.etla + 0.35, t))), 0];
    if (t > T.commence) look = [lerp(-0.85, 0.85, Ez.io(inv(T.commence, T.commence + 0.25, t))), -0.1];
    if (t > 7.6) look = [lerp(0.85, 0, Ez.io(inv(7.6, 7.85, t))), 0];
    const expr = t < T.yeux ? 'neutre' : t < 6.0 ? 'surpris' : 'neutre';
    const breath = Math.sin(t * 2.2) * 0.012;
    w += R.leo({ x: 540, y: 640, scale: 1.75 * (1 + breath), headOnly: true, expr, blink, look, tilt: Math.sin(t * 1.1) * 2 });
    // zZz pendant le sommeil
    if (t < T.yeux) for (let i = 0; i < 3; i++) {
      const ph = ((t * 0.55 + i / 3) % 1);
      w += txt(r1(720 + ph * 120 + Math.sin(ph * 6 + i) * 20), r1(470 - ph * 260), 'z', 44 + ph * 50, '#FFFFFF', { font: 'Anton', weight: 400, op: r1(Math.sin(ph * Math.PI) * 100) / 100, stroke: INK, sw: 8 });
    }
    // lumière du matin
    if (day > 0) w += `<path d="M-200 -200L700 -200L1300 2200L400 2200Z" fill="#FFF1C9" opacity="${r1(day * 0.28 * (0.9 + 0.1 * Math.sin(t * 3)) * 100) / 100}" style="mix-blend-mode:screen"/>`;
    // nuit : bulles de pensée en orbite, puis explosion sur « TOUT »
    const icons = ['?', '…', '!', '♪', '?', '…'];
    const burst = Ez.o5(inv(T.tout, T.tout + 0.7, t));
    for (let i = 0; i < 6; i++) {
      const a = t * 0.6 + i / 6 * Math.PI * 2, rr = 330 + 30 * Math.sin(t * 2 + i) + burst * 900;
      const k = spring(t, 0.5 + i * 0.32, 2.4, 0.45) * (1 - inv(T.tout + 0.4, T.tout + 0.9, t));
      if (k > 0.01) w += bubble(540 + Math.cos(a) * rr, 600 + Math.sin(a) * rr * 0.75, 130, 100, { s: k, seed: i + 1, lines: [icons[i]], fs: 56 });
    }
    const words = ['J\'ai faim', 'Il est où ?', 'Trop cher…', 'Je l\'aime', 'En retard !', 'Pfff', 'Lundi…', 'Le wifi ?!', 'Mon chat…', 'Pizza', 'Hein ?', 'Oups'];
    if (t > T.tout && t < T.tout + 1.5) for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + 0.3, k = Ez.o5(inv(T.tout, T.tout + 1.2, t));
      const rr = 200 + k * 820, sc = spring(t, T.tout + i * 0.015, 2.6, 0.5) * (1 - inv(T.tout + 0.9, T.tout + 1.5, t));
      w += bubble(540 + Math.cos(a) * rr, 640 + Math.sin(a) * rr, 260, 140, { s: sc, seed: i + 9, lines: [words[i]], fs: 40, rot: (hash(i) - 0.5) * 16 });
    }
    w += ring(540, 640, t, T.tout, 0.9, 1300, '#FFFFFF', 34) + ring(540, 640, t, T.tout + 0.12, 0.9, 1100, '#F6B53D', 20);
    // ondes sonores qui arrivent aux oreilles (« Et là… ça commence »)
    for (let i = 0; i < 6; i++) {
      const t0 = T.etla + 0.15 + i * 0.28, k = inv(t0, t0 + 0.9, t);
      if (k <= 0 || k >= 1) continue;
      const sd = i % 2 ? 1 : -1, x = 540 + sd * lerp(640, 260, Ez.out(k));
      w += `<path d="M${r1(x)} 520Q${r1(x - sd * 60)} 640 ${r1(x)} 760" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="${r1(Math.sin(Math.PI * k) * 100) / 100}"/>`;
    }
    // titre « ET SI… »
    let ui = '';
    const exit = Ez.in(inv(4.35, 4.75, t));
    if (exit < 1) ui += grp(springWord(540, 380, 'ET SI…', 210, t, 0.1, { fill: '#F6B53D', sw: 16, ls: 6 }), `translate(0 ${r1(-exit * 700)})`);
    const z = 1.12 + 0.1 * Ez.io(inv(0, 4.4, t)) + 0.05 * punch(t, T.tout, 6) + 0.12 * Ez.io(inv(T.yeux, T.yeux + 0.5, t)) - 0.06 * Ez.io(inv(6.5, 8.1, t));
    return { w, ui, cam: { z, fx: 540, fy: lerp(800, 700, Ez.io(inv(T.yeux, T.yeux + 0.5, t))), rot: Math.sin(t * 0.8) * 0.6 }, sat: 1, cap: true };
  }

  // ---- décor de rue (parallaxe)
  function streetBg(scroll, tint = 0) {
    let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix('#9AD8F2', '#2B1030', tint)}"/><stop offset="1" stop-color="${mix('#FFF0D6', '#5A1530', tint)}"/></linearGradient></defs>`;
    s += `<rect x="-900" y="-400" width="2900" height="2500" fill="url(#sky)"/>`;
    // nuages
    for (let i = 0; i < 5; i++) {
      const x = ((i * 520 - scroll * 0.1) % 2600 + 2600) % 2600 - 900;
      s += bubble(x, 240 + (i % 2) * 140, 300, 110, { seed: i + 40, fill: mix('#FFFFFF', '#6B2340', tint), op: 0.9 });
    }
    const layer = (par, y0, cols, hmin, hmax, seed, win) => {
      let out = '';
      const per = 2200, off = ((scroll * par) % per + per) % per, r = rng(seed);
      const blds = []; let x = 0;
      while (x < per) { const w = 170 + r() * 160; blds.push([x, w, hmin + r() * (hmax - hmin), cols[Math.floor(r() * cols.length)]]); x += w + 10; }
      for (const rep of [-1, 0, 1]) for (const [bx, bw, bh, c] of blds) {
        const X = bx - off + rep * per - 600;
        if (X > 1700 || X + bw < -700) continue;
        out += `<rect x="${r1(X)}" y="${r1(y0 - bh)}" width="${r1(bw)}" height="${r1(bh + 400)}" fill="${mix(c, '#3A0F25', tint)}" stroke="${INK}" stroke-width="5"/>`;
        if (win) for (let wy = y0 - bh + 40; wy < y0 - 60; wy += 100) for (let wx = X + 26; wx < X + bw - 50; wx += 64)
          out += `<rect x="${r1(wx)}" y="${r1(wy)}" width="34" height="52" rx="6" fill="${mix('#FFF6E4', '#FFB347', tint)}" stroke="${INK}" stroke-width="3.5"/>`;
      }
      return out;
    };
    s += layer(0.25, 1250, ['#C9D6F0', '#D8CDEB', '#BFD9E6'], 380, 640, 7, false);
    s += layer(0.55, 1460, ['#F4B9A0', '#F7CBA6', '#EBA98F', '#F4C29A', '#EFB494'], 520, 820, 11, true);
    // trottoir
    s += `<rect x="-900" y="1500" width="2900" height="700" fill="${mix('#D9CFC2', '#4A2232', tint)}" stroke="${INK}" stroke-width="5"/>`;
    s += `<rect x="-900" y="1700" width="2900" height="600" fill="${mix('#8A8D96', '#2A1420', tint)}"/>`;
    const off = ((scroll) % 180 + 180) % 180;
    for (let x = -900 - off; x < 2000; x += 180) s += `<path d="M${r1(x)} 1500L${r1(x - 60)} 1700" stroke="${INK}" stroke-width="3" opacity=".35"/>`;
    // lampadaires
    const loff = ((scroll * 1.0) % 900 + 900) % 900;
    for (let x = -600 - loff; x < 1900; x += 900) {
      s += `<rect x="${r1(x)}" y="880" width="20" height="640" fill="#3A3D4A" stroke="${INK}" stroke-width="4"/>`;
      s += path(`M${r1(x - 30)} 880H${r1(x + 50)}L${r1(x + 34)} 840H${r1(x - 14)}Z`, '#3A3D4A', 4);
    }
    return s;
  }
  const walk = (t, sp = 7, amp = 22) => { const p = Math.sin(t * sp); return { lift: [Math.max(0, p) * amp, Math.max(0, -p) * amp], bob: -Math.abs(Math.cos(t * sp)) * 8 }; };

  // ---- 2. La rue : les pensées des passants
  const PASS = [
    { x: 150, coat: '#7FB7BE', hairStyle: 'chignon', skin: '#F4CDB0', hair: '#8A4B2A' },
    { x: 1300, coat: '#9AA0B5', hairStyle: 'chauve', skin: '#C98E62', hair: '#5B3B2A' },
    { x: 880, coat: '#F28CB1', hairStyle: 'long', skin: '#8D5A3B', hair: '#2A1B14', flip: true },
    { x: -260, coat: '#B5D99C', hairStyle: 'casquette', skin: '#E9B48C', hair: '#3D6FB6' },
    { x: 1700, coat: '#F4D06F', hairStyle: 'afro', skin: '#5E3A26', hair: '#1E1410' },
  ];
  function sStreet(t) {
    const walking = t < 11.0;
    const scroll = (Math.min(t, 11.0) - 8.1) * 420 + Ez.out(inv(11.0, 11.6, t)) * 120;
    let w = streetBg(scroll);
    const wk = walking ? walk(t) : { lift: [0, 0], bob: Math.sin(t * 3) * 2 };
    // passants
    PASS.forEach((p, i) => {
      let expr = 'neutre', tilt = 0, sp = 6.4 + i * 0.4;
      if (i === 0 && t > T.four) expr = 'panique';
      if (i === 1 && t > T.lundi) expr = 'blase';
      if (i === 2 && t > T.mignon) expr = 'amour';
      if (i === 2 && t > T.mignon) tilt = -6;
      const wp = walking ? walk(t + i, sp, 18) : { lift: [0, 0], bob: Math.sin(t * 2.5 + i) * 2 };
      w += R.passant(Object.assign({ y: 1585, scale: 1.25, expr, tilt, lift: wp.lift, bob: wp.bob }, p));
    });
    // Léo
    let lexpr = 'content', look = [0, 0], arms = null, ltilt = 0;
    if (t > T.four) { lexpr = 'surpris'; look = [-0.9, -0.2]; }
    if (t > T.lundi) { lexpr = 'blase'; look = [0.9, 0]; }
    if (t > T.mignon) { lexpr = 'gene'; look = [0.8, 0.1]; ltilt = -5; }
    if (t > T.franch) { lexpr = 'rire'; look = [0, 0]; ltilt = 0; }
    if (t > T.genial) { lexpr = 'content'; arms = { l: [150, 20, 'open'], r: [150, 20, 'open'] }; }
    const jump = t > T.genial ? Math.max(0, Math.sin(clamp((t - T.genial) / 0.5) * Math.PI)) * 70 : 0;
    w += R.leo({ x: 540, y: 1590 - jump, scale: 1.18, expr: lexpr, look, tilt: ltilt, lift: wk.lift, bob: wk.bob, arms, blink: blinkAt(t, 1), squash: t > T.genial ? -0.05 * Math.sin(clamp((t - T.genial) / 0.5) * Math.PI) : 0 });
    // petites bulles « … » au-dessus de tout le monde
    const heads = [[150, 950], [1300, 950], [880, 950], [-260, 950], [1700, 950]];
    heads.forEach(([hx, hy], i) => {
      const k = spring(t, T.personne + i * 0.18, 2.5, 0.45) * (1 - inv(T.four - 0.2, T.four, t) * (i < 3 ? 1 : 0));
      if (k > 0.01) w += bubble(hx + 40, hy - 90 + Math.sin(t * 3 + i) * 8, 120, 86, { s: k, seed: i + 3, lines: ['…'], fs: 54, tail: [hx, hy + 20] });
    });
    // les 3 pensées
    const ends = [T.lundi, T.mignon, T.franch];
    const th = (i, t0, hx, txtL, extra) => {
      const k = spring(t, t0, 2.4, 0.5) * (1 - Ez.in(inv(ends[i] - 0.05, ends[i] + 0.25, t)));
      return k > 0.01 ? bubble(hx, 690 + Math.sin(t * 2.4 + i) * 10, 430, 230, { s: k, seed: 20 + i, lines: txtL, fs: 46, tail: [hx + (i === 2 ? -30 : 0), 930], inner: extra || '', rot: (i - 1) * 3 }) : '';
    };
    // four qui fume
    let oven = '';
    if (t > T.four) {
      oven = grp(path('M-40 -30H40V40H-40Z', '#C9CCD6', 4) + path('M-30 -10H30V30H-30Z', '#2A2D38', 4) +
        [0, 1, 2].map(i => { const ph = (t * 1.2 + i / 3) % 1; return `<circle cx="${r1(Math.sin(ph * 6 + i) * 14)}" cy="${r1(-40 - ph * 70)}" r="${r1(10 + ph * 16)}" fill="#8A8D96" opacity="${r1((1 - ph) * 80) / 100}"/>`; }).join(''),
        'translate(150 -40) scale(.9)');
    }
    w += th(0, T.four, 230, ['J\'ai oublié', 'd\'éteindre le four !'], oven);
    // nuage de pluie sur le lundi
    if (t > T.lundi) {
      const k = spring(t, T.lundi + 0.3, 2, 0.6);
      let rain = '';
      for (let i = 0; i < 9; i++) { const ph = (t * 2.2 + i * 0.37) % 1; rain += `<path d="M${-60 + i * 15} ${r1(30 + ph * 150)}l-6 18" stroke="#4FA3CF" stroke-width="5" stroke-linecap="round" opacity="${r1((1 - ph) * 100) / 100}"/>`; }
      const kk = k * (1 - inv(T.mignon, T.mignon + 0.3, t));
      if (kk > 0.01) w += grp(bubble(0, 0, 220, 90, { seed: 77, fill: '#8C93A8' }) + rain, `translate(1300 ${r1(820 + Math.sin(t * 2) * 6)}) scale(${r1(kk * 100) / 100})`);
    }
    w += th(1, T.lundi, 1230, ['Encore', 'un lundi…']);
    w += th(2, T.mignon, 860, ['Il est trop', 'mignon, lui !']);
    w += hearts(900, 1060, t, T.mignon + 0.1, 9, 5);
    // « C'est génial ! »
    w += sparkles(540, 900, t, T.genial, 22, 520, 8) + confetti(540, 1000, t, T.genial, 70, 12);
    w += ring(540, 950, t, T.genial, 0.8, 1000, '#FFFFFF', 30);
    // caméra : large -> four -> lundi -> mignon -> centre
    const keys = [[8.1, 0.92, 540, 1060], [T.four - 0.15, 0.92, 540, 1060], [T.four + 0.25, 1.22, 300, 1000], [T.lundi + 0.25, 1.22, 1150, 1000],
      [T.mignon + 0.25, 1.18, 720, 1020], [T.franch + 0.2, 1.05, 540, 1060], [18, 1.1, 540, 1040]];
    const cam = camKeys(keys, t);
    cam.z *= 1 + 0.06 * punch(t, T.genial, 5);
    let ui = '';
    if (t > T.genial - 0.3) ui += `<g opacity="${r1(clamp((t - T.genial + 0.3) * 4) * (1 - inv(17.6, 17.9, t)) * 100) / 100}">${rays(540, 900, 18, 1600, t * 0.4, '#FFFFFF')}</g>`.replace('<g', '<g style="mix-blend-mode:soft-light"');
    return { w, ui, cam, sat: 1, cap: true };
  }
  function camKeys(keys, t) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, z0, x0, y0] = keys[i], [t1, z1, x1, y1] = keys[i + 1];
    const k = Ez.io(inv(t0, t1, t));
    return { z: Math.exp(lerp(Math.log(z0), Math.log(z1), k)), fx: lerp(x0, x1, k), fy: lerp(y0, y1, k), rot: 0 };
  }

  // ---- 3. Le chat qui ne pense à rien
  function sCat(t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#F3E3C8"/>`;
    w += `<rect x="-600" y="1380" width="2300" height="1200" fill="#D9B48A"/>` + `<path d="M-600 1380H1700" stroke="${INK}" stroke-width="5"/>`;
    // canapé
    w += path('M60 900Q60 820 140 820H940Q1020 820 1020 900V1420H60Z', '#7C9FD1', 6);
    w += path('M20 1100Q20 1040 80 1040H160V1460H20Z', '#6A8BBE', 6) + path('M1060 1100Q1060 1040 1000 1040H920V1460H1060Z', '#6A8BBE', 6);
    w += path('M150 1180H930V1400H150Z', '#8FB0DD', 6);
    // cadre au mur
    w += path('M380 380H700V640H380Z', '#FFFFFF', 6) + path('M410 410H670V610H410Z', '#BFE3F2', 4) + path('M410 610L500 500L560 560L610 520L670 610Z', '#7BD389', 4);
    const blink = t > 19.9 && t < 20.25 ? Math.sin(inv(19.9, 20.25, t) * Math.PI) : 0;
    w += R.chat({ x: 540, y: 1300, scale: 1.55, tail: t * 2.2, blink });
    // bulle vide, puis virevoltant
    const k = spring(t, T.pense - 0.1, 2.4, 0.5);
    let inner = '';
    if (t > T.absol) {
      const x = lerp(-260, 260, inv(T.absol, T.absol + 1.6, t)), rot = (t - T.absol) * 400;
      inner = grp(`<g transform="scale(2.2)"><circle r="34" fill="none" stroke="#B08A52" stroke-width="6"/><path d="M-30 -10Q0 20 30 -6M-20 20Q0 -24 24 24M-28 4Q4 -30 20 -26" fill="none" stroke="#B08A52" stroke-width="5"/></g>`, `translate(${r1(x)} ${r1(40 - Math.abs(Math.sin((t - T.absol) * 6)) * 40)}) rotate(${r1(rot)})`);
    }
    w += bubble(560, 520, 620, 380, { s: k, seed: 5, tail: [560, 760], inner });
    // Léo, blasé, dans le coin
    w += R.leo({ x: 880, y: 1950, scale: 1.25, expr: 'blase', look: [-0.9, -0.2], blink: blinkAt(t, 7), arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] } });
    const z = lerp(1.0, 1.35, Ez.io(inv(18.0, 21.9, t))) + 0.04 * punch(t, T.absol, 5);
    let ui = '';
    return { w, ui, cam: { z, fx: 540, fy: lerp(1000, 800, Ez.io(inv(18, 21.9, t))), rot: 0 }, sat: 1, cap: true };
  }

  // ---- 4. Le chaos : des centaines de voix
  const CHAOS = ['J\'ai faim', 'Il me regarde ?', 'Loyer…', 'Pfff', 'Trop cher', 'En retard !', 'Il pleut ?', 'Mon yaourt !', 'Je l\'aime', 'Lundi…', 'Le wifi ?!', 'Ma mère va me tuer', 'Bof', 'Taxi !', 'J\'ai froid', 'Où sont mes clés', 'Nul', 'Pizza ?', 'Qui c\'est ?', 'Chut', 'Hein ?', 'Oups', 'Vite !', 'Il est beau', 'Ça pue', 'Promo !', 'Mes impôts', 'Dodo', 'Pourquoi ?', 'Allô ?'];
  function sChaos(t) {
    const k = inv(T.mais, T.cut, t);
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="${mix('#F7C59F', '#3A0A1E', Ez.io(inv(T.mais, T.cent, t)))}"/>`;
    w += rays(540, 900, 24, 2600, t * (0.6 + k * 3), mix('#FFD9B8', '#7A0F2E', Ez.io(inv(T.mais, T.cent, t))));
    // pulsations rouges
    w += `<circle cx="540" cy="900" r="${r1(300 + (t * 900) % 1400)}" fill="none" stroke="#FF3B5C" stroke-width="40" opacity="${r1(0.25 * k * 100) / 100}"/>`;
    // bulles de plus en plus nombreuses
    const r = rng(99);
    const N = 70;
    let bubs = '';
    for (let i = 0; i < N; i++) {
      const t0 = T.mais + 0.35 + Math.pow(i / N, 0.55) * 4.6;
      let x = 60 + r() * 960, y = 160 + r() * 1180;
      const sz = 0.7 + r() * 0.6, rot = (r() - 0.5) * 24, txt0 = CHAOS[Math.floor(r() * CHAOS.length)];
      if (x > 230 && x < 850 && y > 640 && y < 1260) y = y < 950 ? 160 + (y - 640) * 0.8 : 1300 + (y - 950) * 0.15;
      const s = spring(t, t0, 2.8, 0.45);
      if (s < 0.01) continue;
      const jx = noise1(t * 1.4, i) * 14 * k, jy = noise1(t * 1.3, i + 3) * 14 * k;
      const wdt = Math.max(170, measure(txt0, 38) + 70);
      bubs += bubble(x + jx, y + jy, wdt * sz, 120 * sz, { s, seed: i + 50, lines: [txt0], fs: 38 * sz, rot, fill: i % 7 === 0 ? '#FFE27A' : '#FFFFFF' });
    }
    // Léo, mains sur les oreilles
    const shake = 4 + 10 * k;
    w += bubs;
    w += R.leo({ x: 540 + noise1(t * 3, 1) * shake, y: 1680, scale: 1.32, expr: 'panique', look: [noise1(t, 2) * 0.6, 0],
      arms: { l: { at: [-118, -498], hand: 'open', bend: -1 }, r: { at: [118, -498], hand: 'open', bend: -1 } }, tilt: noise1(t * 2, 4) * 4 });
    // mots géants
    let ui = '';
    const slam = (word, t0, y, rot, col) => {
      const s = spring(t, t0, 3, 0.45);
      if (s < 0.01 || t > T.cut) return '';
      return grp(txt(0, 0, word, 170, col, { font: 'Anton', weight: 400, stroke: INK, sw: 18 }), `translate(540 ${y}) rotate(${rot}) scale(${r1((2.4 - 1.4 * s) * 100) / 100})`, `opacity="${clamp(s * 2)}"`);
    };
    ui += slam('PARTOUT', T.partout, 520, -7, '#FFE27A') + slam('TOUT LE TEMPS', T.toutle, 760, 5, '#FF5C7A');
    const hits = [T.cent, T.meme, T.partout, T.toutle];
    const hit = hits.reduce((a, h) => a + decay(t, h, 9), 0);
    return {
      w, ui, cam: { z: 1 + 0.12 * k + 0.05 * hit, fx: 540, fy: 960, rot: noise1(t * 2, 7) * 2.5 * k, shake: 6 + 26 * k + 30 * hit },
      sat: 1, rgb: 4 + 22 * k + 30 * hit, glitch: k > 0.45 ? 0.3 + hit : hit * 0.6, cap: true,
    };
  }

  // ---- 5. « Et puis… il y a Max. »
  function sMaxIntro(t) {
    const on = Ez.out(inv(T.etpuis - 0.1, T.etpuis + 0.25, t)), lit = Ez.out(inv(T.max, T.max + 0.2, t));
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="${mix('#050507', '#3A0812', lit)}"/>`;
    if (lit > 0) w += `<g opacity="${lit}">${rays(540, 1000, 20, 2400, t * 0.25, '#55101E')}</g>`;
    // cône de lumière
    w += `<defs><linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF5D6" stop-opacity=".0"/><stop offset="1" stop-color="#FFF5D6" stop-opacity=".55"/></linearGradient></defs>`;
    w += `<path d="M470 -100H610L900 1640H180Z" fill="url(#cone)" opacity="${r1(on * (0.85 + 0.15 * Math.sin(t * 20) * (1 - lit)) * 100) / 100}"/>`;
    w += `<ellipse cx="540" cy="1640" rx="${r1(360 * on)}" ry="60" fill="#FFF5D6" opacity="${r1(on * 0.35 * 100) / 100}"/>`;
    // poussières
    const r = rng(3);
    for (let i = 0; i < 40; i++) { const x = 300 + r() * 480, y = ((r() * 1600 + t * 40 * (0.5 + r())) % 1600); w += `<circle cx="${r1(x + Math.sin(t + i) * 10)}" cy="${r1(y)}" r="${r1(2 + r() * 3)}" fill="#FFF5D6" opacity="${r1(on * 0.6 * 100) / 100}"/>`; }
    const maxSvg = R.max({ x: 540, y: 1640, scale: 1.25, expr: 'hautain', look: [0, 0], blink: blinkAt(t, 11), tilt: -3 + Math.sin(t * 1.5) * 1.5 });
    if (lit < 1) w += `<g filter="url(#silhouette)" opacity="${on}">${maxSvg}</g>`;
    if (lit > 0) w += `<g opacity="${lit}">${maxSvg}</g>`;
    let ui = '';
    if (t > T.max) {
      ui += springWord(540, 420, 'MAX', 240, t, T.max, { fill: '#E5483D', sw: 16, ls: 10, dy: -160, rot: 8 });
      ui += sparkles(540, 360, t, T.max + 0.05, 14, 420, 21, ['#FF5C7A', '#FFFFFF']);
    }
    const z = lerp(1.0, 1.12, Ez.io(inv(27.25, 30.3, t))) + 0.07 * punch(t, T.max, 6);
    return { w, ui, cam: { z, fx: 540, fy: 1000, rot: 0, shake: 24 * decay(t, T.max, 5) + 14 * decay(t, T.etpuis, 4) }, sat: 1, flash: 0.45 * decay(t, T.max, 9), cap: true };
  }

  // ---- 6/7. Max se moque, filme, rigole — puis le temps se fige
  function sMockAt(t) {
    let w = streetBg(200, 0.25);
    const pointing = t > T.moque - 0.15 && t < T.filme - 0.1;
    const filming = t >= T.filme - 0.1;
    const laughing = t > T.rigole;
    const maxArms = pointing ? { l: { at: [120, -380], hand: 'fist', bend: -1 }, r: [92, -4, 'point'] }
      : filming ? { l: { at: [120, -380], hand: 'fist', bend: -1 }, r: { at: [150, -600], hand: 'phone', bend: 1 } }
        : { l: [6, 4, 'relax'], r: [14, -140, 'phone'] };
    const mExpr = laughing ? 'rire' : pointing ? 'moqueur' : filming ? 'moqueur' : 'hautain';
    const shakeLaugh = laughing ? Math.sin(t * 40) * 4 : 0;
    w += R.max({ x: 770, y: 1600 + shakeLaugh, scale: 1.18, flip: true, expr: mExpr, arms: maxArms, look: [0.6, 0], blink: blinkAt(t, 12), tilt: laughing ? -8 + Math.sin(t * 18) * 3 : 0, lean: laughing ? -4 : 0 });
    const hide = filming ? Ez.out(inv(T.filme, T.filme + 0.3, t)) : 0;
    const lArms = hide > 0 ? { l: [8, 8, 'relax'], r: { at: [lerp(40, 125, hide), lerp(-260, -520, hide)], hand: 'open', bend: 1 } } : { l: [8, 8, 'relax'], r: [8, 8, 'relax'] };
    w += R.leo({ x: 300, y: 1600, scale: 1.12, expr: 'triste', look: [0.5, 0.4], arms: lArms, tilt: 6, blink: blinkAt(t, 13) });
    // HAHA
    if (laughing) for (let i = 0; i < 5; i++) {
      const s = spring(t, T.rigole + i * 0.12, 3, 0.4);
      w += txt(r1(620 + (i % 3) * 170 + Math.sin(t * 9 + i) * 8), r1(620 - i * 70 + Math.cos(t * 11 + i) * 8), 'HA', 80 + i * 8, '#FFE27A', { font: 'Anton', weight: 400, stroke: INK, sw: 12, rot: (i % 2 ? 12 : -10), op: clamp(s * 2) });
    }
    if (pointing) w += txt(560, 780, '!', 150, '#E5483D', { font: 'Anton', weight: 400, stroke: INK, sw: 12, op: clamp((t - T.moque) * 5) });
    return w;
  }
  function viewfinder(t, frozen) {
    let s = '';
    const c = '#FFFFFF', m = 70, L = 110;
    s += `<path d="M${m} ${m + L}V${m}H${m + L}M${W - m - L} ${m}H${W - m}V${m + L}M${W - m} ${H - 420 - L}V${H - 420}H${W - m - L}M${m + L} ${H - 420}H${m}V${H - 420 - L}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
    const rec = frozen || Math.floor(t * 2) % 2 === 0;
    s += `<circle cx="130" cy="150" r="20" fill="#FF3B3B" opacity="${rec ? 1 : 0.25}"/>` + txt(170, 165, 'REC', 44, c, { anchor: 'start', font: 'Anton', weight: 400 });
    const sec = Math.max(0, t - T.filme), tc = `00:${String(Math.floor(sec)).padStart(2, '0')}:${String(Math.floor((sec % 1) * 30)).padStart(2, '0')}`;
    s += txt(W - 120, 165, tc, 40, c, { anchor: 'end', font: 'Anton', weight: 400 });
    s += `<path d="M520 960H560M540 940V980" stroke="${c}" stroke-width="4" opacity=".7"/>`;
    s += `<rect x="${W - 210}" y="200" width="70" height="34" rx="6" fill="none" stroke="${c}" stroke-width="4"/><rect x="${W - 204}" y="206" width="40" height="22" fill="${c}"/>`;
    return s;
  }
  function sMock(t) {
    const w = sMockAt(t);
    let ui = '';
    const vf = t > T.filme ? Ez.out(inv(T.filme, T.filme + 0.15, t)) : 0;
    if (vf > 0) ui += `<g opacity="${vf}">${viewfinder(t, false)}</g>`;
    const cam = t < T.filme ? { z: lerp(1.0, 1.06, inv(30.2, T.filme, t)), fx: 540, fy: 1060, rot: 0 } : { z: lerp(1.25, 1.32, inv(T.filme, 34.6, t)), fx: 380, fy: 1050, rot: Math.sin(t * 2) * 1.2, shake: 5 };
    cam.z += 0.04 * punch(t, T.moque, 6) + 0.05 * punch(t, T.rigole, 6);
    return { w, ui, cam, sat: 1, cap: true, flash: 0.5 * decay(t, T.filme, 9) };
  }
  function sFreeze(t) {
    const w = sMockAt(T.sauf - 0.02);
    const k = Ez.io(inv(T.sauf, T.sauf + 0.5, t));
    let ui = '';
    ui += `<g opacity="${r1((1 - k) * 100) / 100}">${viewfinder(T.sauf, true)}</g>`;
    // la bulle pointillée qui se dessine au-dessus de Max
    let wb = '';
    const draw = inv(T.pense2 - 0.2, 38.6, t);
    if (draw > 0) {
      const per = 2400;
      wb += `<ellipse cx="780" cy="560" rx="260" ry="170" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="22 18" stroke-dashoffset="${r1(t * 40)}" opacity="${r1(Math.min(1, draw * 3) * 100) / 100}" pathLength="${per}" style="stroke-dasharray:${r1(draw * per)} ${per}"/>`;
      for (const [cx, cy, rr] of [[790, 770, 22], [800, 830, 14]]) wb += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="${r1(clamp(draw * 3 - 1) * 100) / 100}"/>`;
    }
    // battements de cœur (pulsations)
    const beats = [37.15, 37.75, 38.3];
    const hb = beats.reduce((a, b) => a + decay(t, b, 8), 0);
    const z = lerp(1.0, 1.75, Ez.io(inv(T.sauf + 0.2, 38.65, t))) * (1 + 0.025 * hb);
    return { w: w + wb, ui, cam: { z, fx: lerp(540, 780, Ez.io(inv(T.sauf, 38.6, t))), fy: lerp(1060, 760, Ez.io(inv(T.sauf, 38.6, t))), rot: 0 }, sat: 1 - 0.88 * k, tint: k, vign: 0.4 + 0.5 * hb, cap: true };
  }

  // ---- 8. La pensée de Max : « Chez moi… personne ne me regarde jamais. »
  function memoryRoom(t) {
    let s = `<rect x="-600" y="-500" width="1200" height="1000" fill="#3B5486"/>`;
    s += `<rect x="-600" y="150" width="1200" height="400" fill="#2C406B"/>` + `<path d="M-600 150H600" stroke="${INK}" stroke-width="5"/>`;
    // fenêtre et lune
    s += path('M120 -300H360V-80H120Z', '#1C2A4A', 5) + `<circle cx="300" cy="-240" r="34" fill="#FFF3C4"/>` + `<path d="M240 -300V-80M120 -190H360" stroke="${INK}" stroke-width="5"/>`;
    // télé
    const glow = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 5.3);
    s += path('M-380 -170H-150V-10H-380Z', '#0E1426', 5) + `<rect x="-366" y="-156" width="202" height="132" fill="#9FE3FF" opacity="${r1(glow * 100) / 100}"/>` + path('M-280 -10H-250V20H-280Z', '#0E1426', 4);
    // canapé + deux adultes, tournés vers leurs écrans
    s += path('M-140 40Q-140 0 -100 0H220Q260 0 260 40V210H-140Z', '#5A6FA0', 5);
    for (const [x, sc] of [[-40, 1], [150, 1.05]]) {
      s += path(`M${x - 58} 140Q${x - 58} 20 ${x} 10Q${x + 58} 20 ${x + 58} 140Z`, '#1A2238', 4);
      s += `<circle cx="${x}" cy="-40" r="${46 * sc}" fill="#1A2238" stroke="${INK}" stroke-width="4"/>`;
      s += `<rect x="${x - 40}" y="20" width="32" height="48" rx="6" fill="#BFF0FF" opacity="${r1(glow * 100) / 100}" stroke="${INK}" stroke-width="3"/>`;
      s += `<ellipse cx="${x - 10}" cy="-30" rx="58" ry="40" fill="#9FE3FF" opacity="${r1(0.22 * glow * 100) / 100}"/>`;
    }
    // le petit Max, seul, qui attend un regard
    s += R.max({ x: 400, y: 330, scale: 0.6, expr: 'triste', arms: { l: [6, 4, 'relax'], r: [6, 4, 'relax'] }, look: [-0.7, 0.1], blink: blinkAt(t, 30) });
    return s;
  }
  function sThought(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#2D3A56"/>`;
    w += rays(540, 1500, 16, 2200, t * 0.08, '#34436A');
    const grow = Ez.o5(inv(38.65, 39.15, t));
    // Max en bas, de face, triste
    const mk = spring(t, 38.65, 1.6, 0.8);
    w += R.max({ x: 540, y: 1650 + (1 - mk) * 200, scale: 2.0, headOnly: true, expr: t > T.personne2 ? 'triste' : 'touche', blink: blinkAt(t, 31), tilt: -4 + Math.sin(t) * 1.5 });
    // la grande bulle, avec le souvenir à l'intérieur
    const bx = lerp(780, 540, grow), by = lerp(560, 560, grow), bw = lerp(520, 990, grow), bh = lerp(340, 760, grow);
    const id = 'mem';
    const clip = `<clipPath id="${id}"><ellipse cx="0" cy="0" rx="${r1(bw / 2 * 0.86)}" ry="${r1(bh / 2 * 0.8)}"/></clipPath>`;
    const inner = clip + `<g clip-path="url(#${id})"><g transform="translate(0 -10) scale(${r1(bw / 1000 * 100) / 100})">${memoryRoom(t)}</g></g>`;
    w += bubble(bx, by, bw, bh, { seed: 61, tail: [900, 1400], inner });
    // texte manuscrit, mot par mot
    const words = [['Chez', T.chez], ['moi…', 38.92], ['personne', T.personne2], ['ne', 40.0], ['me', 40.12], ['regarde', 40.2], ['jamais.', T.jamais]];
    let ui = '';
    const line1 = words.slice(0, 2), line2 = words.slice(2, 5), line3 = words.slice(5);
    [[line1, 1100], [line2, 1180], [line3, 1260]].forEach(([ln, y]) => {
      const total = ln.reduce((a, [wd]) => a + measure(wd + ' ', 76, 'Caveat', 700), 0);
      let x = 540 - total / 2;
      ln.forEach(([wd, ts]) => {
        const ww = measure(wd + ' ', 76, 'Caveat', 700), s = spring(t, ts - 0.05, 3, 0.6);
        if (s > 0.01) ui += txt(r1(x + ww / 2), r1(y + (1 - s) * 30), wd, 76, '#FFFFFF', { font: 'Caveat', weight: 700, stroke: '#1C2A4A', sw: 10, op: clamp(s * 2) });
        x += ww;
      });
    });
    return { w, ui, cam: { z: 1 + 0.04 * Ez.io(inv(38.65, 41.8, t)), fx: 540, fy: 960, rot: 0 }, sat: 1, cap: false, vign: 0.55 };
  }

  // ---- 9. La morale, au coucher du soleil
  function sMoral(t) {
    let w = `<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B3A8C"/><stop offset=".55" stop-color="#F28C6B"/><stop offset="1" stop-color="#FFD29A"/></linearGradient></defs>`;
    w += `<rect x="-800" y="-800" width="2700" height="3500" fill="url(#sun)"/>`;
    w += `<circle cx="540" cy="1300" r="300" fill="#FFE7A8" opacity=".9"/>`;
    w += `<rect x="-800" y="1460" width="2700" height="900" fill="#3A2A4F"/>` + `<path d="M-800 1460H1900" stroke="${INK}" stroke-width="5"/>`;
    for (let i = 0; i < 7; i++) { const x = -200 + i * 220, h = 260 + hash(i + 3) * 320; w += `<rect x="${x}" y="${1460 - h}" width="190" height="${h}" fill="#4B3466" stroke="${INK}" stroke-width="5"/>`; }
    const lower = Ez.io(inv(41.9, 42.6, t));
    w += R.max({ x: 760, y: 1640, scale: 1.18, flip: true, expr: t > T.mal2 ? 'touche' : 'triste', look: [0.3, 0.3], arms: { l: [6, 4, 'relax'], r: [lerp(60, 8, lower), lerp(-110, 6, lower), 'phone'] }, blink: blinkAt(t, 41), tilt: 4 });
    w += R.leo({ x: 320, y: 1640, scale: 1.12, expr: t > T.mal2 + 0.3 ? 'content' : 'neutre', look: [0.7, 0.1], blink: blinkAt(t, 42), tilt: -3, mouth: t > T.mal2 + 0.3 ? 'smile' : null,
      arms: t > T.mal2 + 0.3 ? { l: [8, 8, 'relax'], r: { at: [lerp(40, 200, Ez.io(inv(T.mal2 + 0.3, T.mal2 + 0.9, t))), -330], hand: 'open', bend: 1 } } : null });
    // texte cinétique : « IL FAIT MAL » -> « IL A MAL »
    let ui = '';
    const a = spring(t, T.celui + 0.2, 2.4, 0.6), flip = Ez.io(inv(T.est, T.est + 0.35, t));
    if (a > 0.01) {
      const verb1 = grp(txt(0, 0, 'FAIT', 150, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 14 }), `scale(1 ${r1(Math.max(0.001, 1 - flip * 2) * 100) / 100})`);
      const verb2 = grp(txt(0, 0, 'A', 150, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 14 }), `scale(1 ${r1(Math.max(0.001, flip * 2 - 1) * 100) / 100})`);
      const malCol = mix('#E5483D', '#6FB7FF', flip);
      ui += grp(txt(0, -170, 'IL', 110, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 12 }) + grp((flip < 0.5 ? verb1 : verb2), 'translate(0 -30)') +
        txt(0, 130, 'MAL', 190, malCol, { font: 'Anton', weight: 400, stroke: INK, sw: 16 }), `translate(540 ${r1(470 + (1 - a) * 80)}) scale(${r1((0.6 + 0.4 * a) * 100) / 100})`, `opacity="${clamp(a * 2)}"`);
      ui += ring(540, 600, t, T.mal1, 0.7, 700, '#FFFFFF', 18) + ring(540, 600, t, T.mal2, 0.7, 700, '#6FB7FF', 18);
    }
    return { w, ui, cam: { z: lerp(1.08, 1.0, Ez.io(inv(41.75, 46, t))), fx: 540, fy: 1060, rot: 0 }, sat: 1, cap: true };
  }

  // ---- 10. « Et toi… ? »
  function sQuestion(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 1040, 22, 2400, t * 0.2, '#F9C55E');
    const look = t > 48.0 ? [noise1(t * 0.3, 2) * 0.15, 0] : [0, 0];
    const expr = t > T.disle ? 'content' : 'neutre';
    w += R.leo({ x: 540, y: 1080 + Math.sin(t * 2) * 6, scale: 2.35, headOnly: true, expr, look, blink: blinkAt(t, 51), tilt: Math.sin(t * 1.3) * 3 + (t < 47 ? 6 : 0) });
    let ui = '';
    const out = Ez.in(inv(T.disle - 0.3, T.disle, t));
    if (out < 1) ui += grp(springWord(540, 420, 'ET TOI ?', 200, t, T.ettoi, { fill: '#FFFFFF', sw: 16, ls: 6 }), `translate(0 ${r1(-out * 600)})`);
    // carte « commentaire »
    const c = spring(t, T.disle, 2.4, 0.6);
    if (c > 0.01) {
      const typed = 'Moi je voudrais savoir'.slice(0, Math.floor(clamp((t - T.disle - 0.4) / 1.2) * 22));
      const card = path('M-430 -95H430Q470 -95 470 -55V55Q470 95 430 95H-430Q-470 95 -470 55V-55Q-470 -95 -430 -95Z', '#FFFFFF', 6) +
        `<circle cx="-380" cy="0" r="46" fill="#E5483D" stroke="${INK}" stroke-width="5"/>` + txt(-380, 18, '?', 56, '#FFFFFF', { font: 'Anton', weight: 400 }) +
        txt(-305, 16, typed || 'Ajoute un commentaire…', 44, typed ? INK : '#9A8F86', { anchor: 'start', weight: 700 }) +
        (Math.floor(t * 3) % 2 ? `<rect x="${r1(-300 + measure(typed, 44, 'Brico', 700))}" y="-24" width="5" height="48" fill="${INK}"/>` : '');
      ui += grp(card, `translate(540 ${r1(400 + (1 - c) * 200)}) scale(${r1(c * 100) / 100})`);
    }
    return { w, ui, cam: { z: 1 + 0.05 * Ez.io(inv(46, 50.1, t)) + 0.05 * punch(t, T.ettoi + 0.1, 5), fx: 540, fy: 960, rot: 0 }, sat: 1, cap: true };
  }

  // ---- 11. Abonne-toi, like, fin
  function thumb() {
    return path('M-34 -6H-10L8 -54Q14 -66 26 -60Q38 -54 34 -36L28 -10H58Q72 -10 70 6L62 50Q58 62 46 62H-10V-6Z', '#FFFFFF', 6) + path('M-56 -6H-24V62H-56Z', '#FFFFFF', 6);
  }
  function bell(rot) {
    return grp(path('M0 -44Q30 -44 32 -6L36 22Q38 30 46 34H-46Q-38 30 -36 22L-32 -6Q-30 -44 0 -44Z', '#FFFFFF', 6) + `<circle cx="0" cy="44" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`, `rotate(${rot} 0 -44)`);
  }
  function sCTA(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 900, 22, 2400, t * 0.2, '#F9C55E');
    w += `<rect x="-800" y="1520" width="2700" height="900" fill="#E59E2A"/>` + `<path d="M-800 1520H1900" stroke="${INK}" stroke-width="5"/>`;
    // Léo fait coucou, Max (réconcilié) aussi, un peu timide
    const wave = Math.sin(t * 9) * 18;
    const mIn = Ez.out(inv(51.3, 52.0, t));
    w += R.leo({ x: 360, y: 1560, scale: 0.98, expr: 'content', blink: blinkAt(t, 61), arms: { l: [8, 8, 'relax'], r: [150 + wave, 30 + wave * 0.6, 'open'] }, tilt: Math.sin(t * 2) * 2 });
    if (mIn > 0) w += R.max({ x: lerp(1300, 760, mIn), y: 1560, scale: 0.92, flip: true, expr: 'touche', mouth: 'smile', blink: blinkAt(t, 62), arms: { l: [6, 4, 'relax'], r: t > 52.3 ? [140 + Math.sin(t * 7) * 10, 20, 'open'] : [6, 4, 'relax'] }, lift: mIn < 1 ? walk(t, 9, 18).lift : [0, 0], bob: mIn < 1 ? walk(t, 9, 18).bob : 0 });
    let ui = '';
    // bouton « S'ABONNER »
    const bIn = spring(t, 50.1, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = path('M-300 -80H300Q380 -80 380 0Q380 80 300 80H-300Q-380 80 -380 0Q-380 -80 -300 -80Z', done ? '#3A3A42' : '#E5483D', 7) +
      txt(done ? 40 : 0, 26, done ? 'ABONNÉ' : 'S\'ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    ui += grp(btn, `translate(540 ${r1(400 + (1 - bIn) * -400)}) scale(${r1(bIn * pr * 100) / 100})`);
    ui += ring(540, 400, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 400, t, press, 16, 460, 71);
    // curseur
    const cur = inv(50.1, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 430, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
    if (t < press + 0.9) ui += grp(path('M0 0L0 70L18 54L32 86L46 80L32 48L56 48Z', '#FFFFFF', 6), `translate(${r1(cx)} ${r1(cy)}) scale(${cs * 1.4})`, `opacity="${r1((1 - inv(press + 0.5, press + 0.9, t)) * 100) / 100}"`);
    // like
    const lk = spring(t, T.like, 2.6, 0.45);
    if (lk > 0.01) {
      ui += grp(`<circle r="110" fill="#4FA3CF" stroke="${INK}" stroke-width="7"/>` + grp(thumb(), 'translate(-6 4) scale(1.15)'), `translate(540 690) rotate(${r1((1 - lk) * -30)}) scale(${r1(lk * 100) / 100})`);
      ui += sparkles(540, 690, t, T.like, 18, 380, 72, ['#FFFFFF', '#4FA3CF', '#FFE27A']) + ring(540, 690, t, T.like, 0.6, 520, '#FFFFFF', 18);
      ui += txt(r1(700 + 20 * Math.sin(t * 3)), r1(640 - Ez.out(inv(T.like, T.like + 1, t)) * 80), '+1', 72, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 10, op: 1 - inv(T.like + 0.8, T.like + 1.3, t) });
    }
    // logo de fin
    const lg = spring(t, T.etsi, 2.2, 0.55);
    if (t > T.etsi) {
      const k = Ez.io(inv(T.etsi, T.etsi + 0.4, t));
      ui = `<g opacity="${r1((1 - k) * 100) / 100}">${ui}</g>`;
      const shine = inv(53.0, 53.8, t) * 1400 - 700;
      ui += grp(springWord(0, 0, 'ET SI…', 230, t, T.etsi, { fill: '#FFFFFF', sw: 18, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`);
      ui += `<clipPath id="shn"><rect x="${r1(540 + shine - 60)}" y="300" width="120" height="400" transform="skewX(-20)"/></clipPath>`;
      ui += `<g clip-path="url(#shn)">${grp(txt(0, 0, 'ET SI…', 230, '#FFF6C9', { font: 'Anton', weight: 400, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`)}</g>`;
      ui += txt(540, 720, 'À suivre…', 64, INK, { font: 'Caveat', weight: 700, op: clamp((t - 53.4) * 2) });
    }
    void lg;
    return { w, ui, cam: { z: 1 + 0.03 * Math.sin(t * 0.7), fx: 540, fy: 960, rot: 0 }, sat: 1, cap: t < 52.6 };
  }

  // ================================================================== TIMELINE
  const SCENES = [
    { f: sBed, a: 0, b: 8.1 },
    { f: sStreet, a: 8.1, b: 17.9, tin: 'whip', d: 0.4 },
    { f: sCat, a: 17.9, b: 21.9, tin: 'whip', d: 0.4 },
    { f: sChaos, a: 21.9, b: 27.25, tin: 'zoom', d: 0.45 },
    { f: sMaxIntro, a: 27.25, b: 30.2, tin: 'cut' },
    { f: sMock, a: 30.2, b: 34.55, tin: 'flash', d: 0.18 },
    { f: sFreeze, a: 34.55, b: 38.65, tin: 'cut' },
    { f: sThought, a: 38.65, b: 41.75, tin: 'cut' },
    { f: sMoral, a: 41.75, b: 46.0, tin: 'iris', d: 0.6 },
    { f: sQuestion, a: 46.0, b: 50.1, tin: 'whip', d: 0.4 },
    { f: sCTA, a: 50.1, b: DUR + 1, tin: 'zoom', d: 0.45 },
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
    if (S.f === sChaos && t > T.cut - 0.08) flash = 0;
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
