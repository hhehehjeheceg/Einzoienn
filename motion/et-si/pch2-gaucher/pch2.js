// « Pourquoi c'est horrible d'être gaucher » — composition d'une image (seek(t)).
// Transitions entre scènes, post-traitement, sous-titres v2 (mot actif dans une pastille jaune).
(function () {
  const X = window.PCH;
  const { INK, clamp, lerp, inv, r1, r2, Ez, spring, rng, hash, noise1, esc, grp, measure } = X;
  const W = 1080, H = 1920, DUR = X.DUR;
  const SCENES = X.SCENES;

  function camTf(c, t) {
    const sh = c.shake || 0;
    const sx = sh ? noise1(t * 2.3, 11) * sh : 0, sy = sh ? noise1(t * 2.1, 17) * sh : 0;
    return `translate(${r1(540 + sx)} ${r1(960 + sy)}) rotate(${r2(c.rot || 0)}) scale(${Math.round(c.z * 1000) / 1000}) translate(${r1(-c.fx)} ${r1(-c.fy)})`;
  }
  function renderScene(S, t, k) {
    const r = S.f(t);
    let defs = '', body = `<g transform="${camTf(r.cam, t)}">${r.w}</g>${r.ui || ''}`;
    if (r.sat != null && Math.abs(r.sat - 1) > 0.001) { defs += `<filter id="sat${k}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${r2(r.sat)}"/></filter>`; body = `<g filter="url(#sat${k})">${body}</g>`; }
    if (r.heat) {
      defs += `<filter id="heat${k}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.03" numOctaves="1" seed="${Math.floor(t * 24) % 97}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${r1(r.heat * 22)}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
      body = `<g filter="url(#heat${k})">${body}</g>`;
    }
    if (r.rgb) {
      const d = r1(r.rgb);
      defs += `<filter id="rgb${k}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="${d}" result="ro"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="b" dx="${-d}" result="bo"/>
        <feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter>`;
      body = `<g filter="url(#rgb${k})">${body}</g>`;
    }
    return { svg: defs + body, r };
  }

  // ------------------------------------------------------------------ sous-titres v2
  const CH = [];
  (function chunk() {
    const C = window.CUES;
    let cur = [];
    const flush = () => { if (cur.length) CH.push(cur); cur = []; };
    C.forEach((c, i) => {
      cur.push(c);
      const len = cur.map(x => x.w).join(' ').length, nxt = C[i + 1];
      if (/[.?!…,]$/.test(c.w) || len > 15 || cur.length >= 3 || !nxt || nxt.s - c.e > 0.35) flush();
    });
    CH.forEach((ch, i) => { ch.a = ch[0].s - 0.05; ch.b = CH[i + 1] ? Math.min(CH[i + 1][0].s - 0.05, ch[ch.length - 1].e + 0.6) : ch[ch.length - 1].e + 0.8; });
  })();
  const clean = w => w.replace(/[«»]/g, '').replace(/…/g, '…').toUpperCase();
  function captions(t, y) {
    const ch = CH.find(c => t >= c.a && t < c.b);
    if (!ch) return '';
    const fs = 62, gap = 20, pad = 34;
    const words = ch.map(c => clean(c.w));
    let active = -1;
    ch.forEach((c, i) => { if (t >= c.s - 0.03) active = i; });
    const ws = words.map(w => measure(w, fs));
    const total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1) + pad;
    const e = spring(t, ch.a, 3.2, 0.6);
    let x = 540 - total / 2, s = '';
    words.forEach((wd, i) => {
      const isA = i === active, ww = ws[i] + (isA ? pad : 0), cx = x + ww / 2;
      if (isA) {
        const pk = spring(t, ch[i].s - 0.03, 3.4, 0.5), sc = 0.9 + 0.17 * pk;
        s += `<g transform="translate(${r1(cx)} ${y - 21}) rotate(-2) scale(${r2(sc)})"><rect x="${r1(-ws[i] / 2 - 17)}" y="-45" width="${r1(ws[i] + 34)}" height="82" rx="18" fill="#FFD23F" stroke="${INK}" stroke-width="5"/>` +
          `<text x="0" y="21" font-family="Brico" font-weight="800" font-size="${fs}" fill="${INK}" text-anchor="middle">${esc(wd)}</text></g>`;
      } else s += `<text x="${r1(cx)}" y="${y}" font-family="Brico" font-weight="800" font-size="${fs}" fill="#FFFFFF" stroke="#1C1418" stroke-width="11" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" opacity="${i < active ? 1 : 0.9}">${esc(wd)}</text>`;
      x += ww + gap;
    });
    return `<g filter="url(#cap)" transform="translate(540 ${y}) scale(${r2(0.86 + 0.14 * e)}) translate(-540 ${-y})" opacity="${r2(clamp(e * 3))}">${s}</g>`;
  }

  // ------------------------------------------------------------------ grain
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

  // ------------------------------------------------------------------ composition
  const stage = document.getElementById('stage');
  window.seek = function (t) {
    t = clamp(t, 0, DUR - 1e-4);
    const idx = SCENES.findIndex(S => t >= S.a && t < S.b), S = SCENES[idx];
    let out = '';
    const cur = renderScene(S, t, 'a');
    const tr = S.tin && S.d && t < S.a + S.d ? S.tin : null;
    const k = tr ? Ez.io(inv(S.a, S.a + S.d, t)) : 1;
    if (tr && idx > 0) {
      const Pv = SCENES[idx - 1], prev = renderScene(Pv, Math.min(t, Pv.b + 0.4), 'b');
      if (tr === 'whip') {
        const blur = r1(Math.sin(k * Math.PI) * 60);
        out += `<defs><filter id="wb" x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation="${blur} 0"/></filter></defs>`;
        out += `<g filter="url(#wb)"><g transform="translate(${r1(-k * W)} 0)">${prev.svg}</g><g transform="translate(${r1((1 - k) * W)} 0)">${cur.svg}</g></g>`;
      } else if (tr === 'swipe') {
        const blur = r1(Math.sin(k * Math.PI) * 40);
        out += `<defs><filter id="sb" x="0" y="-20%" width="100%" height="140%"><feGaussianBlur stdDeviation="0 ${blur}"/></filter></defs>`;
        out += `<g filter="url(#sb)"><g transform="translate(0 ${r1(-k * H)})">${prev.svg}</g><g transform="translate(0 ${r1((1 - k) * H)})">${cur.svg}</g></g>`;
      } else if (tr === 'zoom') {
        out += `<rect width="${W}" height="${H}" fill="#000"/><g transform="translate(540 960) scale(${Math.round((0.6 + 0.4 * k) * 1000) / 1000}) translate(-540 -960)">${cur.svg}</g>`;
        out += `<g transform="translate(540 960) scale(${r2(1 + k * 2.5)}) translate(-540 -960)" opacity="${r2(1 - k)}">${prev.svg}</g>`;
      } else if (tr === 'ink') {
        // une tache d'encre grossit et révèle la scène suivante
        const R0 = Ez.in(k) * 1500;
        out += prev.svg + `<clipPath id="inkc">${X.inkBlot(540, 960, Math.max(1, R0), 17).replace(/<circle[^>]*>/g, '')}</clipPath><g clip-path="url(#inkc)">${cur.svg}</g>`;
        out += `<g opacity="${r2(1 - k)}">${X.inkBlot(540, 960, Math.max(1, R0 * 0.25 + 40), 23, '#2A4FA8')}</g>`;
      } else if (tr === 'rip') {
        // la scène précédente se déchire en deux et s'écarte
        const rr0 = rng(77); let edge = '';
        for (let y = -40; y <= H + 40; y += 60) edge += `L${r1(540 + (rr0() - 0.5) * 70)} ${y}`;
        const e = Ez.in(k), dx = e * 700, rot = e * 12;
        out += cur.svg;
        out += `<clipPath id="ripL"><path d="M-400 -40${edge}L-400 ${H + 40}Z"/></clipPath><clipPath id="ripR"><path d="M1480 -40${edge}L1480 ${H + 40}Z"/></clipPath>`;
        out += `<g transform="translate(${r1(-dx)} ${r1(e * 120)}) rotate(${r1(-rot)} 0 1920)"><g clip-path="url(#ripL)">${prev.svg}</g><path d="M540 -40${edge.replace(/^L/, 'L')}" fill="none" stroke="#FFFDF6" stroke-width="14" transform="translate(-6 0)"/></g>`;
        out += `<g transform="translate(${r1(dx)} ${r1(e * 160)}) rotate(${r1(rot)} 1080 1920)"><g clip-path="url(#ripR)">${prev.svg.replace(/id="(sat|rgb|heat)b"/g, 'id="$1b2"').replace(/url\(#(sat|rgb|heat)b\)/g, 'url(#$1b2)')}</g></g>`;
      } else if (tr === 'iris') {
        const rr = r1(Ez.io(k) * 1250);
        out += prev.svg + `<clipPath id="iris"><circle cx="540" cy="900" r="${rr}"/></clipPath><g clip-path="url(#iris)">${cur.svg}</g><circle cx="540" cy="900" r="${rr}" fill="none" stroke="${INK}" stroke-width="14"/>`;
      } else out += cur.svg;
    } else out += cur.svg;
    const r = cur.r;
    out += `<rect width="${W}" height="${H}" fill="url(#vig)" opacity="${r2(r.vign == null ? 0.3 : r.vign)}"/>`;
    let flash = r.flash || 0;
    if (tr === 'flash') flash = Math.max(flash, 0.8 * (1 - k));
    if (flash > 0.01) out += `<rect width="${W}" height="${H}" fill="#FFFFFF" opacity="${r2(flash)}"/>`;
    if (r.cap !== false) out += captions(t, r.capY || 1420);
    const gi = Math.floor(t * 30) % 4, gx = Math.floor(hash(Math.floor(t * 30)) * 256), gy = Math.floor(hash(Math.floor(t * 30) + 1) * 256);
    out += `<rect x="${-gx}" y="${-gy}" width="${W + 512}" height="${H + 512}" fill="url(#grain${gi})" opacity=".05" style="mix-blend-mode:overlay"/>`;
    stage.innerHTML = out;
  };
  window.DUR = DUR;

  (async () => {
    await Promise.all(['800 40px Brico', '600 40px Brico', '700 40px Brico', '400 40px Anton', '700 40px Caveat'].map(f => document.fonts.load(f)));
    makeGrain();
    document.getElementById('defs').innerHTML =
      `<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="1"/></radialGradient>` +
      `<linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>` +
      `<linearGradient id="fadeT" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>` +
      `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>` +
      `<filter id="smudge" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="9 5"/></filter>` +
      `<filter id="cap" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".35"/></filter>` +
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
