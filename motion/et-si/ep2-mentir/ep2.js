// « Et si… tu ne pouvais plus mentir ? » — moteur seek(t), 1080 x 1920.
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
    mentir: 2.42, jamais: 3.29, commence: 4.38, mere: 6.19, gateau: 7.14, bon: 7.58, reponds: 8.14,
    il: 9.24, sec1: 9.58, tres: 10.06, sec2: 10.3, bonf: 11.46, mal: 12.42,
    cours: 13.02, prof: 13.82, pourquoi: 14.58, devoirs: 15.54, jai: 16.38, trois: 17.06, matin: 17.5,
    puis: 18.3, plait: 19.5, delle: 20.7, et: 21.58, bouche: 21.9, dit: 22.26, absol: 23.18, tout2: 24.06,
    evid: 25.31, max: 26.43, compris: 26.75,
    devant: 27.69, sort: 28.91, tel: 29.23, vasy: 30.14, moi: 31.43,
    tait: 32.62, peux: 34.31,
    alors: 35.59, verite: 36.23, je: 37.19, autres: 38.31, pour: 38.92, toi: 39.83,
    silence: 41.24, puis2: 42.1, quelquun: 42.82, classe: 43.95,
    parfois: 45.39, peur: 46.62, libere: 47.58,
    ettoi: 48.61, combien: 49.66, disle: 51.05, abonne: 52.2, like: 52.94, etsi: 53.93,
  };
  const blinkAt = (t, seed) => {
    const per = 3.1 + hash(seed) * 1.7, ph = (t + hash(seed + 5) * per) % per;
    return ph < 0.13 ? Math.sin(ph / 0.13 * Math.PI) : 0;
  };

  // ------------------------------------------------------------------ poses fluides
  // keys : [[t, pose], …]. Chaque changement de pose = un ressort ; l'avant-bras (index 1)
  // suit avec un léger retard (overlap), d'où des gestes qui « traînent » naturellement.
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

  // bouche de Léo sur ses répliques (le narrateur parle, la bouche suit les mots)
  const TALK = [[9.22, 10.62], [16.36, 17.95], [21.56, 24.4], [37.17, 40.25]];
  function talk(t) {
    for (const [a, b] of TALK) if (t >= a && t <= b) {
      const w = window.CUES.find(c => t >= c.s - 0.02 && t < c.e + 0.03);
      if (!w) return 'M';
      const k = (t - w.s) / Math.max(0.08, w.e - w.s);
      const seq = ['A', 'E', 'O', 'A', 'E', 'U'];
      return Math.sin(k * Math.PI * 2.4) > -0.5 ? seq[(Math.floor(k * 2.4) + Math.round(w.s * 7)) % seq.length] : 'M';
    }
    return null;
  }
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
  // ================================================================== SCÈNES

  // ---- 1. Accroche : le détecteur de mensonge
  function sHook(t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#20203A"/>` + rays(540, 900, 20, 2400, t * 0.25, '#28284A');
    // bande du polygraphe
    w += `<rect x="-200" y="1360" width="1500" height="300" fill="#FFF8E8" stroke="${INK}" stroke-width="6"/>`;
    for (let x = -200 - (t * 260) % 60; x < 1300; x += 60) w += `<path d="M${r1(x)} 1360V1660" stroke="#E9C9B8" stroke-width="2"/>`;
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const x = -100 + i * 10, tt = t - (900 - x) / 260;
      let a = Math.sin(tt * 9) * 14 + Math.sin(tt * 23) * 6;
      if (tt > T.mentir - 0.1) a += Math.sin(tt * 40) * 110 * Math.exp(-(tt - T.mentir) * 1.4);
      d += `${i ? 'L' : 'M'}${x} ${r1(1510 + a)}`;
    }
    w += `<path d="${d}" fill="none" stroke="#E5483D" stroke-width="7" stroke-linejoin="round"/>`;
    w += path('M880 1250L900 1500L920 1250Z', '#3A3D4A', 5);
    // Léo, gros plan, inquiet
    const e = t < T.mentir ? 'neutre' : 'surpris';
    const wob = t > T.mentir ? Math.sin((t - T.mentir) * 30) * 8 * decay(t, T.mentir, 3) : 0;
    w += R.leo({ x: 540 + wob, y: 980, scale: 2.1 * (1 + 0.02 * Math.sin(t * 2)), headOnly: true, expr: e, blink: blinkAt(t, 2), tilt: Math.sin(t * 1.2) * 3, look: t > T.jamais ? [0, 0.2] : [0, 0], mouth: t > T.jamais ? 'wavy' : null });
    // cadenas sur une bulle « mensonge » barrée
    if (t > T.jamais - 0.1) {
      const k = spring(t, T.jamais - 0.1, 2.6, 0.5);
      w += grp(bubble(0, 0, 360, 170, { seed: 3, lines: ['MENSONGE'], fs: 52, font: 'Anton', weight: 400 }) +
        `<path d="M-150 10H150" stroke="#E5483D" stroke-width="14" stroke-linecap="round"/>` +
        grp(path('M-40 -20V-50Q-40 -90 0 -90Q40 -90 40 -50V-20', 'none', 12) + path('M-56 -24H56V60H-56Z', '#F6B53D', 6) + `<circle cx="0" cy="14" r="10" fill="${INK}"/>`, 'translate(150 -60) scale(.8)'),
        `translate(790 ${r1(560 - (1 - k) * 80)}) rotate(8) scale(${r1(k * 100) / 100})`);
    }
    let ui = '';
    const exit = Ez.in(inv(3.9, 4.25, t));
    if (exit < 1) ui += grp(springWord(540, 330, 'ET SI…', 210, t, 0.08, { fill: '#F6B53D', sw: 16, ls: 6 }), `translate(0 ${r1(-exit * 600)})`);
    const flash = 0.5 * decay(t, T.mentir, 8);
    return { w, ui, cam: { z: 1.0 + 0.06 * Ez.io(inv(0, 4.2, t)) + 0.08 * punch(t, T.mentir, 6), fx: 540, fy: 960, rot: 0, shake: 26 * decay(t, T.mentir, 5) }, flash, rgb: 14 * decay(t, T.mentir, 4), cap: true };
  }

  // ---- 2. Le petit-déjeuner
  function kitchen(t) {
    let w = `<rect x="-600" y="-600" width="2300" height="3200" fill="#FBE3C2"/>`;
    for (let x = -600; x < 1700; x += 90) for (let y = 820; y < 1400; y += 90) w += `<rect x="${x + 4}" y="${y + 4}" width="82" height="82" rx="8" fill="#F7D6A8"/>`;
    w += path('M640 260H1020V700H640Z', '#BFE6F5', 6) + `<path d="M830 260V700M640 480H1020" stroke="${INK}" stroke-width="6"/>`;
    w += `<circle cx="760" cy="350" r="40" fill="#FFE27A" opacity=".9"/>`;
    w += path('M-200 300H180V1400H-200Z', '#E7ECF2', 6) + `<path d="M-200 700H180" stroke="${INK}" stroke-width="5"/><rect x="130" y="460" width="18" height="160" rx="8" fill="${INK}"/>`;
    w += `<rect x="-600" y="1400" width="2300" height="1300" fill="#C98E62"/>` + `<path d="M-600 1400H1700" stroke="${INK}" stroke-width="5"/>`;
    return w;
  }
  function cakeAt(x, y, t, sc = 1) {
    let s = ell(0, 22, 120, 26, '#FFFFFF') ;
    const crumb = inv(T.sec1, T.sec1 + 0.5, t);
    if (crumb < 1) {
      const sq = 1 - 0.15 * crumb;
      s += grp(path('M-80 10L80 10L60 -60L-90 -40Z', '#E8B25C', 5) + path('M-90 -40L60 -60L70 -80L-80 -64Z', '#F7F0E6', 5) + `<circle cx="-10" cy="-86" r="14" fill="#E5483D" stroke="${INK}" stroke-width="4"/>`,
        `scale(${1 + crumb * 0.2} ${sq})`, `opacity="${r1((1 - crumb) * 100) / 100}"`);
    }
    if (t > T.sec1) {
      const r = rng(17); const dt = t - T.sec1;
      for (let i = 0; i < 40; i++) {
        const vx = (r() - 0.5) * 260, vy = -r() * 200, px = vx * dt, py = vy * dt + 900 * dt * dt;
        if (py > 30) continue;
        s += `<rect x="${r1(-40 + r() * 80 + px)}" y="${r1(-30 + r() * 40 + Math.min(py, 26))}" width="${r1(6 + r() * 8)}" height="${r1(6 + r() * 8)}" fill="${r() > 0.5 ? '#E8B25C' : '#D69A44'}"/>`;
      }
      if (dt < 1.2) s += `<circle cx="0" cy="-20" r="${r1(40 + dt * 160)}" fill="#E9D3B0" opacity="${r1((1 - dt / 1.2) * 0.5 * 100) / 100}"/>`;
    }
    return grp(s, `translate(${r1(x)} ${r1(y)}) scale(${sc})`);
  }
  function sKitchen(t) {
    let w = kitchen(t);
    // maman, plat à la main
    const mExpr = t < T.reponds ? 'content' : t < T.sec1 ? 'neutre' : t < T.bonf ? 'choque' : 'triste';
    const mp = alive(blend(t, [
      [0, { arms: { l: [10, 8], r: [60, 30] }, tilt: 0 }],
      [T.mere, { arms: { l: [10, 8], r: [78, -4] }, tilt: -6 }],
      [T.sec1, { arms: { l: [14, 20], r: [40, 60] }, tilt: 4 }],
      [T.bonf, { arms: { l: [8, 6], r: [14, 20] }, tilt: 10 }],
    ]), t, 3);
    const MX = 800, MY = 1660, MS = 1.45;
    w += R.passant({ x: MX, y: MY, scale: MS, flip: true, coat: '#E07A8F', hairStyle: 'chignon', skin: '#E9B48C', hair: '#6B3A26', expr: mExpr, arms: mp.arms, tilt: mp.tilt, bob: mp.bob, lean: mp.lean });
    // tablier
    w += path(`M${MX - 38 * MS} ${MY - 270 * MS}H${MX + 38 * MS}L${MX + 48 * MS} ${MY - 150 * MS}H${MX - 48 * MS}Z`, '#FFF3E6', 4);
    const L = R.prims.limb(58, -300, 1, 70, 66, mp.arms.r[0], mp.arms.r[1]);
    w += cakeAt(MX - L.W[0] * MS - 10, MY + (L.W[1] + mp.bob) * MS - 30, t, 1.1);
    if (t > T.bonf) { const k = spring(t, T.bonf, 2, 0.6); w += grp(bubble(0, 0, 230, 90, { seed: 9, fill: '#8C93A8' }), `translate(${MX} ${r1(MY - 760 * MS / 1.45 + Math.sin(t * 2) * 6)}) scale(${r1(k * 100) / 100})`); for (let i = 0; i < 8; i++) { const ph = (t * 2.2 + i * 0.37) % 1; w += `<path d="M${MX - 60 + i * 16} ${r1(MY - 700 + ph * 150)}l-6 18" stroke="#4FA3CF" stroke-width="5" stroke-linecap="round" opacity="${r1((1 - ph) * k * 100) / 100}"/>`; } }
    // Léo à table
    const chewing = t > 6.3 && t < T.reponds;
    const lp = alive(blend(t, [
      [0, { arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0, y: 0 }],
      [6.3, { arms: { l: [10, 10, 'relax'], r: arm(LA(1, 30, -450, 1), 'fist') }, tilt: 4, y: 0 }],
      [T.reponds, { arms: { l: [10, 10, 'relax'], r: [30, 40, 'open'] }, tilt: -2, y: -20 }],
      [T.il, { arms: { l: [30, 60, 'open'], r: [40, 70, 'open'] }, tilt: 0, y: -10 }],
      [T.bonf, { arms: { l: arm(LA(-1, -60, -500, -1), 'open'), r: [10, 10, 'relax'] }, tilt: 8, y: 0 }],
    ]), t, 1);
    let lExpr = 'neutre', mouthK = null;
    if (chewing) { lExpr = 'blase'; mouthK = Math.sin(t * 14) > 0 ? 'M' : 'flat'; }
    if (t > T.reponds) lExpr = 'surpris';
    if (t > T.il) lExpr = 'gene';
    if (t > T.bonf) lExpr = 'gene';
    const tk = talk(t); if (tk) mouthK = tk;
    w += R.leo({ x: 380, y: 1840 + lp.y, scale: 1.18, expr: lExpr, mouth: mouthK, arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 4) });
    // table
    w += path('M-200 1500H1300V1560H-200Z', '#E9A86A', 6) + path('M-150 1560H1250V1640H-150Z', '#C98852', 5);
    w += `<ellipse cx="380" cy="1495" rx="110" ry="22" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`;
    // bulle de vérité
    let ui = '';
    const W1 = [['IL', 9.24], ['EST', 9.34], ['SEC.', 9.58], ['TRÈS', 10.06], ['SEC.', 10.3]];
    ui += truthBubble(540, 470, 760, 300, W1, t, { lines: [[0, 1, 2], [3, 4]], fs: 96, tail: [-150, 240], out: T.bonf + 0.2 });
    ui += stamp(820, 760, 'VÉRITÉ', '#2FA56A', t, T.sec2 + 0.15);
    const keys = [[0, 1.0, 560, 1160], [T.mere - 0.1, 1.22, 720, 1080, 0.7], [T.reponds, 1.55, 400, 1060, 0.25], [T.il, 1.12, 560, 1100, 0.35], [T.bonf, 1.6, 780, 980, 0.6]];
    const cam = cam2(keys, t);
    cam.z *= 1 + 0.05 * punch(t, T.sec1, 6) + 0.04 * punch(t, T.sec2, 6);
    const frz = t > T.bonf - 0.05 && t < T.bonf + 0.55;
    return { w, ui, cam, sat: frz ? 0.25 : 1, cap: !(t > 9.15 && t < T.bonf), shake: 0 };
  }

  // ---- 3 à 9. La classe (un seul décor, plusieurs plans)
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

  function sClass(t) {
    let w = classroomBg(t);
    const shocked = (t > T.matin + 0.3 && t < 19.0) || (t > T.vasy && t < T.classe);
    const allClap = t > T.classe;
    // --- rangée du fond : élèves + Max
    const stand = Ez.out(inv(T.devant - 0.2, T.devant + 0.4, t)) * (1 - Ez.io(inv(44.6, 45.2, t)));
    const mp = alive(blend(t, [
      [0, { arms: { l: [8, 6, 'relax'], r: [10, 10, 'relax'] }, tilt: 0 }],
      [T.max - 0.2, { arms: { l: [8, 6, 'relax'], r: arm(MA(1, 60, -620, 1), 'fist') }, tilt: -6 }],
      [T.sort, { arms: { l: arm(MA(-1, -110, -380, -1), 'fist'), r: arm(MA(1, 150, -600, 1), 'phone') }, tilt: 0 }],
      [T.pour + 0.2, { arms: { l: [8, 6, 'relax'], r: [40, -60, 'phone'] }, tilt: 6 }],
      [T.classe + 0.3, { arms: { l: [8, 6, 'relax'], r: [10, 10, 'relax'] }, tilt: 10 }],
    ]), t, 7);
    let mExpr = 'neutre';
    if (t > T.bouche) mExpr = 'moqueur';
    if (t > T.max - 0.3) mExpr = 'mechant';
    if (t > T.sort) mExpr = 'moqueur';
    if (t > T.pour) mExpr = 'choque';
    if (t > T.silence) mExpr = 'touche';
    if (t > T.classe) mExpr = 'triste';
    const maxSvg = R.max({ x: 230, y: 1330 - stand * 120, scale: 0.72, flip: false, expr: mExpr, arms: mp.arms, tilt: mp.tilt, bob: mp.bob, lean: mp.lean, blink: blinkAt(t, 9), look: [0.4, 0.3] });
    const studs = STUDENTS.map((st, i) => {
      let expr = shocked ? 'choque' : 'neutre';
      if (allClap) expr = 'rire';
      if (t > T.quelquun && i === 2) expr = 'content';
      const clap = (i === 2 && t > T.quelquun) || allClap;
      const ph = Math.sin(t * 16 + i);
      const arms = clap ? { l: PA(-1, -10 - 8 * ph, -330 - (allClap ? 120 : 0), -1), r: PA(1, 10 + 8 * ph, -330 - (allClap ? 120 : 0), -1) } : { l: [10, 8], r: [10, 8] };
      const look = (t > T.devant && t < T.alors) || (t > T.pour && t < T.silence) ? (st.x > 230 ? -0.8 : 0.8) : 0;
      const p = alive({ arms, tilt: 0, bob: 0, lean: 0 }, t, 20 + i, 0.8);
      return R.passant(Object.assign({}, st, { scale: st.s, expr, arms: p.arms, tilt: p.tilt + (allClap ? Math.sin(t * 8 + i) * 4 : 0), bob: p.bob - (allClap ? Math.abs(Math.sin(t * 8 + i)) * 12 : 0) }));
    });
    w += maxSvg + studs.slice(1).join('');
    w += desk(230, 1150, 320, 170) + desk(520, 1150, 300, 170) + desk(800, 1150, 300, 170) + desk(1080, 1150, 300, 170);
    // --- rangée de devant : élève, Léo, l'amoureuse
    w += studs[0];
    const lStand = Ez.out(inv(T.alors - 0.1, T.alors + 0.5, t)) * (1 - Ez.io(inv(44.8, 45.3, t)));
    const lp = alive(blend(t, [
      [0, { arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0 }],
      [T.jai - 0.1, { arms: { l: [10, 10, 'relax'], r: [70, 40, 'open'] }, tilt: -4 }],
      [T.puis, { arms: { l: [10, 10, 'relax'], r: arm(LA(1, 120, -470, 1), 'relax') }, tilt: 6 }],
      [T.et - 0.15, { arms: { l: arm(LA(-1, -36, -440, -1), 'open'), r: arm(LA(1, 36, -440, -1), 'open') }, tilt: 0 }],
      [T.absol, { arms: { l: [150, 30, 'open'], r: [150, 30, 'open'] }, tilt: -6 }],
      [T.evid, { arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0 }],
      [T.tait, { arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 4 }],
      [T.je - 0.2, { arms: { l: [10, 10, 'relax'], r: [80, 30, 'open'] }, tilt: 0 }],
      [T.pour, { arms: { l: [10, 10, 'relax'], r: [95, -10, 'point'] }, tilt: -4 }],
      [T.silence, { arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] }, tilt: 0 }],
      [T.classe, { arms: { l: [10, 10, 'relax'], r: arm(LA(1, 150, -560, 1), 'relax') }, tilt: -6 }],
    ]), t, 1);
    let lExpr = 'neutre';
    if (t > T.pourquoi) lExpr = 'gene';
    if (t > T.jai) lExpr = 'surpris';
    if (t > T.matin + 0.3) lExpr = 'gene';
    if (t > T.puis) lExpr = 'gene';
    if (t > T.et) lExpr = 'panique';
    if (t > T.evid) lExpr = 'neutre';
    if (t > T.devant) lExpr = 'surpris';
    if (t > T.tait) lExpr = 'panique';
    if (t > T.alors) lExpr = 'determine';
    if (t > T.silence) lExpr = 'surpris';
    if (t > T.classe) lExpr = 'content';
    const lookL = t > T.devant && t < T.alors ? [-0.8, -0.4] : t > T.puis && t < T.evid ? [0.8, 0] : t > T.alors && t < T.silence ? [-0.6, -0.3] : [0, 0];
    w += R.leo({ x: 520, y: 1760 - lStand * 170, scale: 1.12, expr: lExpr, mouth: talk(t), arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 1), look: lookL });
    // sueur pendant le silence
    if (t > T.tait && t < T.alors) for (let i = 0; i < 3; i++) { const ph = ((t - T.tait) * 0.8 + i / 3) % 1; w += path(`M${r1(400 + i * 120)} ${r1(1080 + ph * 120)}q10 16 0 24q-10 -8 0 -24z`, '#9FD8F5', 3.5); }
    const gExpr = t > T.puis && t < T.et ? 'amour' : t > T.et && t < T.evid ? 'amour' : t > T.classe ? 'rire' : shocked ? 'choque' : 'neutre';
    const gp = alive({ arms: { l: [10, 8], r: [10, 8] }, tilt: t > T.et && t < T.evid ? -8 : 0, bob: 0, lean: 0 }, t, 31);
    w += R.passant({ x: 880, y: 1760, scale: 1.25, flip: true, coat: '#F28CB1', hairStyle: 'long', skin: '#8D5A3B', hair: '#2A1B14', expr: gExpr, arms: gp.arms, tilt: gp.tilt, bob: gp.bob, lean: gp.lean });
    w += desk(180, 1500, 330, 260) + desk(520, 1500 - lStand * 0, 360, 260) + desk(880, 1500, 330, 260);
    // le prof (premier plan)
    const tIn = Ez.out(inv(12.9, 13.4, t)) * (1 - Ez.in(inv(16.0, 16.4, t)));
    if (tIn > 0.01) {
      const tp = alive(blend(t, [[0, { arms: { l: [10, 8], r: [10, 8] } }], [T.prof, { arms: { l: PA(-1, 40, -280, -1), r: PA(1, -40, -280, -1) } }], [T.pourquoi, { arms: { l: PA(-1, 40, -280, -1), r: [100, -10] } }]]), t, 41);
      w += R.passant({ x: -160 + (1 - tIn) * -400, y: 2050, scale: 1.75, coat: '#6B7FA8', hairStyle: 'chauve', skin: '#E9B48C', hair: '#7A5A44', expr: t > T.pourquoi ? 'blase' : 'neutre', glasses: true, arms: tp.arms, tilt: tp.tilt, bob: tp.bob });
    }
    // flot de mots/coeurs quand la bouche dit tout
    if (t > T.et && t < 25.3) {
      const words = ['T\'es trop belle', 'Je pense à toi', 'Tout le temps', 'J\'ai répété 40 fois', 'Ton rire !', 'Au secours', 'Tes yeux…', 'Je stresse'];
      const r = rng(5);
      for (let i = 0; i < words.length; i++) {
        const t0 = T.et + 0.1 + i * 0.25, k = inv(t0, t0 + 1.4, t);
        if (k <= 0 || k >= 1) continue;
        const ang = -Math.PI / 2 + (r() - 0.5) * 2.2, d = 120 + Ez.out(k) * 520;
        const s = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (t > T.absol ? 1.25 : 1);
        w += bubble(520 + Math.cos(ang) * d, 1080 + Math.sin(ang) * d * 0.9, measure(words[i], 40) + 80, 120, { s, seed: 60 + i, lines: [words[i]], fs: 40, fill: i % 2 ? '#FFE0EA' : '#FFFFFF' });
      }
      w += hearts(560, 1060, t, T.et + 0.1, 8, 3) + hearts(560, 1060, t, T.absol, 14, 9);
    }
    // ampoule « idée » au-dessus de Max
    if (t > T.max - 0.1 && t < T.devant + 0.3) {
      const k = spring(t, T.max - 0.1, 2.6, 0.5) * (1 - inv(T.devant, T.devant + 0.3, t));
      w += grp(`<circle r="40" fill="#FFE27A" stroke="${INK}" stroke-width="5"/>` + path('M-18 34H18V58H-18Z', '#C9CCD6', 5) + `<path d="M-60 -10H-80M60 -10H80M0 -60V-80M-44 -48L-58 -62M44 -48L58 -62" stroke="#F6B53D" stroke-width="7" stroke-linecap="round"/>`, `translate(300 ${r1(700 - stand * 120)}) scale(${r1(k * 100) / 100})`);
    }
    // confettis des applaudissements
    w += confetti(540, 1100, t, T.classe, 80, 13) + confetti(300, 1000, t, T.classe + 0.3, 50, 14);
    // --- interface
    let ui = '';
    const W2 = [['J\'AI', 16.38], ['JOUÉ', 16.54], ['JUSQU\'À', 16.78], ['3 H', 17.06], ['DU', 17.42], ['MATIN.', 17.5]];
    ui += truthBubble(540, 520, 900, 340, W2, t, { lines: [[0, 1, 2], [3, 4, 5]], fs: 76, tail: [-60, 250], out: 18.2 });
    if (t > T.trois - 0.05 && t < 18.3) {
      const k = spring(t, T.trois - 0.05, 2.6, 0.5);
      ui += grp(path('M-90 -40Q-90 -60 -60 -60H60Q90 -60 90 -40L110 30Q116 60 86 60Q70 60 56 34H-56Q-70 60 -86 60Q-116 60 -110 30Z', '#3A3D4A', 6) + `<circle cx="40" cy="-14" r="10" fill="#E5483D"/><circle cx="62" cy="6" r="10" fill="#4FA3CF"/><path d="M-58 -10H-26M-42 -26V6" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>`, `translate(880 830) rotate(${r1(Math.sin(t * 6) * 8)}) scale(${r1(k * 1.3 * 100) / 100})`);
    }
    const W3 = [['JE', 37.19], ['PENSE', 37.4], ['QUE', 37.59], ['TU', 37.71], ['TE', 37.83], ['MOQUES', 37.95], ['DES', 38.15], ['AUTRES…', 38.31], ['POUR', 38.92], ['QU\'ON', 39.03], ['NE', 39.15], ['SE', 39.23], ['MOQUE', 39.35], ['PAS', 39.55], ['DE', 39.67], ['TOI.', 39.83]];
    ui += truthBubble(540, 470, 1000, 520, W3, t, { lines: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]], fs: 60, tail: [-40, 330], out: T.silence });
    if (t > T.tel && t < T.tait) ui += `<g opacity="${r1(Ez.out(inv(T.tel, T.tel + 0.2, t)) * 100) / 100}">${viewfinder(t, T.tel)}</g>`;
    if (t > T.classe) ui += springWord(540, 380, 'BRAVO !', 170, t, T.classe + 0.1, { fill: '#FFE27A', sw: 14, ls: 6 });
    // --- caméra (plans)
    const keys = [
      [12.9, 1.0, 380, 1180], [T.prof - 0.1, 1.12, 160, 1160, 0.7], [T.jai - 0.1, 1.5, 520, 1100, 0.3], [T.matin + 0.3, 0.95, 620, 1110, 0.35],
      [T.puis, 1.32, 700, 1110, 0.5], [T.et, 1.5, 600, 1080, 0.3], [T.evid - 0.15, 2.3, 240, 960, 0.25], [T.compris, 2.5, 240, 940, 0.9],
      [T.devant, 1.05, 440, 1080, 0.35], [T.tel + 0.1, 1.55, 520, 1080, 0.3], [T.tait, 1.75, 520, 1020, 0.4], [T.peux, 2.0, 520, 990, 1.2],
      [T.alors, 1.3, 520, 960, 0.4], [T.pour, 2.2, 240, 940, 0.3], [T.silence - 0.6, 1.0, 560, 1100, 0.6], [T.classe, 1.06, 560, 1080, 0.3],
    ];
    const cam = cam2(keys, t);
    cam.z *= 1 + 0.05 * punch(t, T.max, 6) + 0.04 * punch(t, T.classe, 5) + 0.03 * punch(t, T.absol, 6);
    cam.shake = (t > T.et && t < 24.6 ? 8 : 0) + 18 * decay(t, T.max, 5) + 10 * decay(t, T.classe, 4);
    const silent = t > T.tait && t < T.alors;
    const hb = [33.2, 33.9, 34.6].reduce((a, b) => a + decay(t, b, 8), 0);
    const capOff = (t > 16.3 && t < 18.2) || (t > 37.1 && t < T.silence);
    return { w, ui, cam, sat: silent ? 0.45 : 1, vign: silent ? 0.55 + 0.4 * hb : 0.32, cap: !capOff, flash: 0.35 * decay(t, T.classe, 7) };
  }
  function viewfinder(t, t0) {
    let s = '';
    const c = '#FFFFFF', m = 70, L = 110;
    s += `<path d="M${m} ${m + L}V${m}H${m + L}M${W - m - L} ${m}H${W - m}V${m + L}M${W - m} ${H - 420 - L}V${H - 420}H${W - m - L}M${m + L} ${H - 420}H${m}V${H - 420 - L}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
    s += `<circle cx="130" cy="150" r="20" fill="#FF3B3B" opacity="${Math.floor(t * 2) % 2 ? 0.25 : 1}"/>` + txt(170, 165, 'REC', 44, c, { anchor: 'start', font: 'Anton', weight: 400 });
    const sec = Math.max(0, t - t0);
    s += txt(W - 120, 165, `00:${String(Math.floor(sec)).padStart(2, '0')}:${String(Math.floor((sec % 1) * 30)).padStart(2, '0')}`, 40, c, { anchor: 'end', font: 'Anton', weight: 400 });
    return s;
  }

  // ---- 10. La vérité libère
  function sMoral(t) {
    let w = `<defs><linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7EC8E3"/><stop offset="1" stop-color="#FFE7B8"/></linearGradient></defs>`;
    w += `<rect x="-800" y="-800" width="2700" height="3500" fill="url(#dawn)"/>` + rays(540, 760, 18, 2200, t * 0.15, '#FFFFFF').replace('<path', '<path opacity=".25"');
    w += `<rect x="-800" y="1500" width="2700" height="900" fill="#8FCB7B"/>` + `<path d="M-800 1500H1900" stroke="${INK}" stroke-width="5"/>`;
    const lp = alive(blend(t, [[0, { arms: { l: [10, 10, 'relax'], r: [10, 10, 'relax'] } }], [T.libere, { arms: { l: [150, 20, 'open'], r: [150, 20, 'open'] } }]]), t, 1);
    w += R.leo({ x: 540, y: 1640, scale: 1.12, expr: t > T.libere ? 'content' : 'neutre', arms: lp.arms, tilt: lp.tilt, bob: lp.bob, lean: lp.lean, blink: blinkAt(t, 2), look: [0, -0.2] });
    // cadenas sur une bulle qui s'ouvre, oiseaux qui s'envolent
    const open = Ez.out(inv(T.libere, T.libere + 0.4, t));
    let lock = grp(path('M-40 -20V-50Q-40 -90 0 -90Q40 -90 40 -50V-20', 'none', 12), `translate(${r1(open * 30)} ${r1(-open * 40)}) rotate(${r1(open * 30)})`) + path('M-56 -24H56V60H-56Z', '#F6B53D', 6) + `<circle cx="0" cy="14" r="10" fill="${INK}"/>`;
    w += grp(bubble(0, 0, 420, 220, { seed: 7 }) + grp(lock, `scale(1.1) translate(0 10)`), `translate(540 ${r1(620 + Math.sin(t * 2) * 8)}) scale(${r1(spring(t, 45.2, 2.2, 0.6) * (1 - open * 0.4) * 100) / 100})`, `opacity="${r1((1 - inv(T.libere + 0.3, T.libere + 0.8, t)) * 100) / 100}"`);
    if (t > T.libere) {
      const r = rng(8);
      for (let i = 0; i < 9; i++) {
        const dt = t - T.libere - r() * 0.2, a = -Math.PI / 2 + (r() - 0.5) * 1.8;
        if (dt < 0) continue;
        const x = 540 + Math.cos(a) * dt * 520, y = 620 + Math.sin(a) * dt * 620, fl = Math.sin(t * 22 + i) * 14;
        w += `<path d="M${r1(x - 30)} ${r1(y - fl)}Q${r1(x - 12)} ${r1(y - 18)} ${r1(x)} ${r1(y)}Q${r1(x + 12)} ${r1(y - 18)} ${r1(x + 30)} ${r1(y - fl)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
      }
      w += sparkles(540, 620, t, T.libere, 20, 460, 4);
    }
    let ui = '';
    const a = spring(t, T.parfois, 2.4, 0.6), b = spring(t, 47.3, 2.4, 0.6);
    if (a > 0.01) ui += grp(txt(0, 0, 'LA VÉRITÉ FAIT PEUR…', 92, '#FFFFFF', { font: 'Anton', weight: 400, stroke: INK, sw: 12 }), `translate(540 ${r1(300 + (1 - a) * 60)})`, `opacity="${r1(clamp(a * 2) * (1 - 0.5 * b) * 100) / 100}"`);
    if (b > 0.01) ui += grp(txt(0, 0, 'MAIS ELLE LIBÈRE', 104, '#FFE27A', { font: 'Anton', weight: 400, stroke: INK, sw: 14 }), `translate(540 ${r1(420 + (1 - b) * 60)}) scale(${r1((0.7 + 0.3 * b) * 100) / 100})`, `opacity="${clamp(b * 2)}"`);
    return { w, ui, cam: { z: lerp(1.12, 1.0, Ez.io(inv(45.2, 48.5, t))) + 0.04 * punch(t, T.libere, 6), fx: 540, fy: 1020, rot: 0 }, cap: true };
  }

  // ---- 11. « Et toi ? »
  function sQuestion(t) {
    let w = `<rect x="-800" y="-800" width="2700" height="3500" fill="#F6B53D"/>` + rays(540, 1040, 22, 2400, t * 0.2, '#F9C55E');
    w += R.leo({ x: 540, y: 1080 + Math.sin(t * 2) * 6, scale: 2.35, headOnly: true, expr: t > T.disle ? 'content' : 'neutre', blink: blinkAt(t, 51), tilt: Math.sin(t * 1.3) * 3 + (t < 49.2 ? 6 : 0) });
    // chrono
    const ck = spring(t, T.combien - 0.1, 2.6, 0.5) * (1 - inv(T.disle - 0.3, T.disle, t));
    if (ck > 0.01) {
      const el = Math.max(0, t - T.combien);
      w += grp(`<circle r="100" fill="#FFFFFF" stroke="${INK}" stroke-width="8"/><rect x="-20" y="-140" width="40" height="34" rx="6" fill="#E5483D" stroke="${INK}" stroke-width="6"/>` +
        `<path d="M0 0L${r1(Math.sin(el * 6) * 80)} ${r1(-Math.cos(el * 6) * 80)}" stroke="#E5483D" stroke-width="8" stroke-linecap="round"/>` + `<circle r="10" fill="${INK}"/>`, `translate(860 1400) rotate(-8) scale(${r1(ck * 100) / 100})`);
    }
    let ui = '';
    const out = Ez.in(inv(T.disle - 0.3, T.disle, t));
    if (out < 1) ui += grp(springWord(540, 420, 'ET TOI ?', 200, t, T.ettoi, { fill: '#FFFFFF', sw: 16, ls: 6 }), `translate(0 ${r1(-out * 600)})`);
    const c = spring(t, T.disle, 2.4, 0.6);
    if (c > 0.01) {
      const typed = '2 minutes max'.slice(0, Math.floor(clamp((t - T.disle - 0.3) / 0.8) * 13));
      const card = path('M-430 -95H430Q470 -95 470 -55V55Q470 95 430 95H-430Q-470 95 -470 55V-55Q-470 -95 -430 -95Z', '#FFFFFF', 6) +
        `<circle cx="-380" cy="0" r="46" fill="#E5483D" stroke="${INK}" stroke-width="5"/>` + txt(-380, 18, '?', 56, '#FFFFFF', { font: 'Anton', weight: 400 }) +
        txt(-305, 16, typed || 'Ajoute un commentaire…', 44, typed ? INK : '#9A8F86', { anchor: 'start', weight: 700 }) +
        (Math.floor(t * 3) % 2 ? `<rect x="${r1(-300 + measure(typed, 44, 'Brico', 700))}" y="-24" width="5" height="48" fill="${INK}"/>` : '');
      ui += grp(card, `translate(540 ${r1(400 + (1 - c) * 200)}) scale(${r1(c * 100) / 100})`);
    }
    return { w, ui, cam: { z: 1 + 0.05 * Ez.io(inv(48.5, 52.1, t)) + 0.05 * punch(t, T.ettoi + 0.1, 5), fx: 540, fy: 960, rot: 0 }, cap: true };
  }

  // ---- 12. Abonne-toi, like, fin
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
    const mIn = Ez.out(inv(53.2, 53.9, t));
    if (mIn > 0) {
      const wk = mIn < 1 ? { lift: [Math.max(0, Math.sin(t * 9)) * 18, Math.max(0, -Math.sin(t * 9)) * 18], bob: -Math.abs(Math.cos(t * 9)) * 8 } : { lift: [0, 0], bob: 0 };
      const mp = alive({ arms: { l: [6, 4, 'relax'], r: t > 54.2 ? [140 + Math.sin(t * 7) * 10, 20, 'open'] : [6, 4, 'relax'] }, tilt: 0, bob: wk.bob, lean: 0 }, t, 7);
      w += R.max({ x: lerp(1300, 760, mIn), y: 1560, scale: 0.92, flip: true, expr: 'touche', mouth: 'smile', blink: blinkAt(t, 62), arms: mp.arms, lift: wk.lift, bob: mp.bob, tilt: mp.tilt });
    }
    let ui = '';
    const bIn = spring(t, 52.1, 2.4, 0.55), press = T.abonne + 0.3;
    const pr = t > press ? 1 - 0.12 * Math.sin(clamp((t - press) / 0.18) * Math.PI) : 1, done = t > press + 0.09;
    const btn = path('M-300 -80H300Q380 -80 380 0Q380 80 300 80H-300Q-380 80 -380 0Q-380 -80 -300 -80Z', done ? '#3A3A42' : '#E5483D', 7) +
      txt(done ? 40 : 0, 26, done ? 'ABONNÉ' : 'S\'ABONNER', 84, '#FFFFFF', { font: 'Anton', weight: 400, ls: 3 }) +
      (done ? grp(bell(Math.sin((t - press) * 30) * 22 * decay(t, press, 2.5)), 'translate(-230 0) scale(.9)') : '');
    ui += grp(btn, `translate(540 ${r1(400 + (1 - bIn) * -400)}) scale(${r1(bIn * pr * 100) / 100})`);
    ui += ring(540, 400, t, press, 0.6, 600, '#FFFFFF', 22) + sparkles(540, 400, t, press, 16, 460, 71);
    const cur = inv(52.1, press, t), cx = lerp(980, 640, Ez.io(cur)), cy = lerp(900, 430, Ez.io(cur)), cs = t > press && t < press + 0.15 ? 0.85 : 1;
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
      const shine = inv(55.0, 55.8, t) * 1400 - 700;
      ui += grp(springWord(0, 0, 'ET SI…', 230, t, T.etsi, { fill: '#FFFFFF', sw: 18, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`);
      ui += `<clipPath id="shn"><rect x="${r1(540 + shine - 60)}" y="300" width="120" height="400" transform="skewX(-20)"/></clipPath>`;
      ui += `<g clip-path="url(#shn)">${grp(txt(0, 0, 'ET SI…', 230, '#FFF6C9', { font: 'Anton', weight: 400, ls: 8 }), `translate(540 ${r1(560 + Math.sin(t * 1.6) * 8)})`)}</g>`;
      ui += txt(540, 720, 'À suivre…', 64, INK, { font: 'Caveat', weight: 700, op: clamp((t - 55.2) * 2) });
    }
    return { w, ui, cam: { z: 1 + 0.03 * Math.sin(t * 0.7), fx: 540, fy: 960, rot: 0 }, cap: t < 54.4 };
  }

  // ================================================================== TIMELINE
  const SCENES = [
    { f: sHook, a: 0, b: 4.2 },
    { f: sKitchen, a: 4.2, b: 12.9, tin: 'whip', d: 0.4 },
    { f: sClass, a: 12.9, b: 45.2, tin: 'whip', d: 0.4 },
    { f: sMoral, a: 45.2, b: 48.5, tin: 'iris', d: 0.55 },
    { f: sQuestion, a: 48.5, b: 52.1, tin: 'whip', d: 0.4 },
    { f: sCTA, a: 52.1, b: DUR + 1, tin: 'zoom', d: 0.45 },
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
