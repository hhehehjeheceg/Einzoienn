// =====================================================================================================
//  Effects toolbox: stateless particle bursts, grid ripples, dust, the orb (the logo dot), chips,
//  cursors, flares, the film HUD. Everything is a pure function of the time.
// =====================================================================================================

// ------------------------------------------------------------------ stateless particle bursts
const EMIT = [];
function addBurst(o) {
  const r = mulberry32(o.seed || (EMIT.length * 7919 + 13)), hues = o.hues || HN, P = [];
  for (let i = 0; i < o.n; i++) {
    const a = (o.dir || 0) + (r() - .5) * (o.spread === undefined ? TAU : o.spread), sp = (o.speed || 400) * (.3 + .7 * r());
    P.push({
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life || 1) * (.55 + .45 * r()), size: (o.size || 6) * (.55 + .9 * r()),
      hue: hues[Math.floor(r() * hues.length)], rot: r() * TAU, spin: (r() - .5) * 14, ph: r() * TAU, dl: (o.stagger || 0) * r(),
      ox: (r() - .5) * (o.jitter || 0), oy: (r() - .5) * (o.jitter || 0),
    });
  }
  EMIT.push(Object.assign({ shape: 'dot', grav: 0, drag: 2.2, light: true }, o, { P, t1: o.t0 + (o.stagger || 0) + (o.life || 1) }));
}
function starPath(x, y, r, rot = 0, inner = .2) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4 - Math.PI / 2, rad = i % 2 ? r * inner : r; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
}
function drawEmitters(t, tag) {
  for (const e of EMIT) {
    if ((tag !== undefined && e.tag !== tag) || t < e.t0 || t > e.t1) continue;
    for (const p of e.P) {
      const a = t - e.t0 - p.dl; if (a < 0 || a > p.life) continue;
      const k = e.drag, f = (1 - Math.exp(-k * a)) / k;
      const x = e.x + p.ox + p.vx * f, y = e.y + p.oy + p.vy * f + .5 * e.grav * a * a;
      const u = a / p.life, al = Math.pow(1 - u, 1.4) * (u < .06 ? u / .06 : 1), c = HU[p.hue], s = p.size;
      if (e.shape === 'dot') {
        if (e.light) glow(GLOW[p.hue], x, y, s * 3.4 * (1 - .45 * u), al);
        else { circ(x, y, s * (1 - .4 * u)); ctx.fillStyle = rgb(c, al); ctx.fill(); }
      } else if (e.shape === 'conf') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.spin * a); ctx.scale(1, Math.cos(p.ph + p.spin * a * 1.6));
        ctx.fillStyle = rgb(c, al); ctx.fillRect(-s, -s * .55, s * 2, s * 1.1); ctx.restore();
      } else if (e.shape === 'star') {
        starPath(x, y, s * (1.2 - .5 * u), p.rot + p.spin * a * .3); ctx.fillStyle = rgb(c, al); ctx.fill();
        if (e.light) glow(GLOW[p.hue], x, y, s * 3, al * .5);
      } else if (e.shape === 'streak') {
        const vx = p.vx * Math.exp(-k * a), vy = p.vy * Math.exp(-k * a), L = Math.hypot(vx, vy) * .045 + 2;
        ctx.strokeStyle = rgb(c, al); ctx.lineWidth = s * .5 + .6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx / (Math.hypot(vx, vy) + 1e-3) * L, y - vy / (Math.hypot(vx, vy) + 1e-3) * L); ctx.stroke();
      }
    }
  }
}

// ------------------------------------------------------------------ dot grid with travelling ripples
const RIP = [];
function ripple(t, x, y, a = 10, hue = 'coral') { RIP.push({ t, x, y, a, hue }); }
function drawGrid(t, col, alpha, o = {}) {
  const act = RIP.filter(r => t >= r.t && t < r.t + 1.9), hot = [], step = 48;
  ctx.fillStyle = rgb(col, alpha);
  for (let x = 0; x <= W; x += step) for (let y = 12; y <= H; y += step) {
    let dx = 0, dy = 0, amp = 0, hue = null;
    for (const r of act) {
      const ex = x - r.x, ey = y - r.y, dist = Math.hypot(ex, ey) + .001, age = t - r.t, w = (dist - 1500 * age) / 80;
      if (w > 3 || w < -3) continue;
      const disp = r.a * -2 * w * Math.exp(-w * w) * Math.exp(-age / .55);
      dx += ex / dist * disp; dy += ey / dist * disp; amp += Math.abs(disp); hue = r.hue;
    }
    const s = 1.2 + amp * .09;
    ctx.fillRect(x + dx - s, y + dy - s, 2 * s, 2 * s);
    if (amp > 2) hot.push([x + dx, y + dy, s, amp, hue]);
  }
  for (const [x, y, s, a, h] of hot) { ctx.fillStyle = rgb(HU[h] || BR.clay, Math.min(o.hotMax || .7, a / 20)); ctx.fillRect(x - s * 1.2, y - s * 1.2, s * 2.4, s * 2.4); }
}

// ------------------------------------------------------------------ floating dust (parallax motes)
const DUST = [];
(() => { const r = mulberry32(77); for (let i = 0; i < 150; i++) DUST.push({ x: r() * W, y: r() * H, z: .25 + r() * .75, vx: (r() - .5) * 16, vy: -5 - r() * 13, s: 1 + r() * 2.6, ph: r() * TAU, hue: r() < .45 ? HN[Math.floor(r() * 6)] : null }); })();
function drawDust(t, dark, alpha = 1, ox = 0, oy = 0) {
  for (const d of DUST) {
    const x = ((d.x + d.vx * t * d.z + ox * d.z) % W + W) % W, y = ((d.y + d.vy * t * d.z + oy * d.z) % H + H) % H;
    const tw_ = .55 + .45 * Math.sin(t * 1.7 + d.ph), a = alpha * tw_ * d.z;
    if (dark) glow(d.hue ? GLOW[d.hue] : GLOW.cream, x, y, d.s * 2.6 * d.z + 1, a * .8);
    else { circ(x, y, d.s * d.z + .4); ctx.fillStyle = d.hue ? rgb(HU[d.hue], a * .55) : rgb(BR.ink, a * .16); ctx.fill(); }
  }
}

// ------------------------------------------------------------------ the orb: the logo dot, glossy, with an orbit ring and satellites
function drawOrb(x, y, r, t, o = {}) {
  if (r <= .5) return;
  const dark = !!o.dark, g = o.glow === undefined ? 1 : o.glow, br = 1 + .025 * Math.sin(t * TAU * .55);
  r *= br;
  if (dark) glow(GLOW.clay, x, y, r * 3.4, .55 * g); else glow(SOFT.clay, x, y, r * 3.1, .42 * g, 'source-over');
  if (o.ring) {   // orbit ring + satellites with short trails
    const R = r * (o.ringR || 2.6), a0 = t * (o.spin || 1.6), c = dark ? BR.cream : BR.ink;
    ctx.lineWidth = 1.4; ctx.strokeStyle = rgb(c, .22 * o.ring); circ(x, y, R); ctx.stroke();
    const n = o.sat || 3;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * TAU / n, hx = x + Math.cos(a) * R, hy = y + Math.sin(a) * R, hc = hueAt(i + (o.hueShift || 0));
      ctx.lineCap = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = rgb(hc, .45 * o.ring);
      ctx.beginPath(); ctx.arc(x, y, R, a - .55, a); ctx.stroke();
      circ(hx, hy, r * .2); ctx.fillStyle = rgb(hc, o.ring); ctx.fill();
      if (dark) glow(GLOW[HN[(i + (o.hueShift || 0)) % 6]], hx, hy, r * .8, .5 * o.ring);
    }
  }
  const gr = ctx.createRadialGradient(x - r * .32, y - r * .38, r * .06, x, y, r);
  gr.addColorStop(0, '#ffd9c2'); gr.addColorStop(.32, '#ff9d73'); gr.addColorStop(.72, '#d97757'); gr.addColorStop(1, '#b4533a');
  circ(x, y, r); ctx.fillStyle = gr; ctx.fill();
  if (r > 9) {   // iridescent rim
    const cg = ctx.createConicGradient(t * 1.2, x, y);
    RAINBOW.forEach(([p, c]) => cg.addColorStop(p, rgb(c, .6))); cg.addColorStop(1, rgb(HU.coral, .6));
    circ(x, y, r * .965); ctx.strokeStyle = cg; ctx.lineWidth = Math.max(1.2, r * .07); ctx.stroke();
  }
  ctx.save(); ctx.translate(x - r * .3, y - r * .4); ctx.rotate(-.55); ctx.beginPath(); ctx.ellipse(0, 0, r * .3, r * .15, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); ctx.restore();
}

// ------------------------------------------------------------------ chips, cursor, flare
function chip(cx, cy, label, hue, o = {}) {
  const f = o.font || SANS(o.size || 26, 600), h = o.h || 56, w = tw(label, f, -.3) + (o.pad || 58), sz = o.size || 26;
  ctx.save(); ctx.translate(cx, cy); const s = o.scale === undefined ? 1 : o.scale; ctx.scale(s, s); ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  if (o.shadow !== false && !o.dark) { ctx.shadowColor = 'rgba(70,40,20,0.16)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; }
  rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = o.fill || (o.dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.88)'); ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 1.5; ctx.strokeStyle = rgb(HU[hue], o.dark ? .6 : .55); ctx.stroke();
  circ(-w / 2 + h * .46, 0, h * .12); ctx.fillStyle = rgb(HU[hue]); ctx.fill();
  if (o.dark) glow(GLOW[hue], -w / 2 + h * .46, 0, h * .5, .6);
  txt(label, -w / 2 + h * .46 + h * .3, sz * .36, f, o.dark ? BR.cream : BR.ink, { ls: -.3 });
  ctx.restore();
  return w;
}
function drawCursor(x, y, hue, name, a = 1, s = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.beginPath(); [[0, 0], [0, 24], [6.2, 18.6], [10.4, 28], [14.6, 26.2], [10.6, 17], [19, 17]].forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](px, py)); ctx.closePath();
  ctx.fillStyle = rgb(HU[hue]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.stroke(); ctx.fill(); ctx.shadowColor = 'rgba(0,0,0,0)';
  if (name) { const w = tw(name, SANS(15, 600)) + 22; rr(16, 26, w, 27, 13.5); ctx.fillStyle = rgb(HU[hue]); ctx.fill(); txt(name, 27, 45, SANS(15, 700), BR.ink); }
  ctx.restore();
}
function flare(x, y, size, a, hue = 'amber', cx = 960, cy = 540) {   // anamorphic streak + core + ghosts toward the centre
  if (a <= .004) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.setTransform(size * 7, 0, 0, size * .06, x, y); ctx.drawImage(GLOW[hue], -1, -1, 2, 2);
  ctx.setTransform(size * 3.4, 0, 0, size * .02, x, y); ctx.drawImage(GLOW.white, -1, -1, 2, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(GLOW.white, x - size * .9, y - size * .9, size * 1.8, size * 1.8);
  [[.5, .2, 'sky'], [.95, .14, 'pink'], [1.55, .24, 'mint'], [2.1, .1, 'amber']].forEach(([k, s2, h2]) => {
    const gx = lerp(x, cx, k), gy = lerp(y, cy, k); ctx.globalAlpha = Math.min(1, a) * .35; ctx.drawImage(GLOW[h2], gx - size * s2 * 1.4, gy - size * s2 * 1.4, size * s2 * 2.8, size * s2 * 2.8);
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------ film HUD: corner marks, chapter label, timecode, progress bar
function drawHUD(t, dark, fade = 1) {
  if (fade <= .01) return;
  const c = dark ? BR.cream : BR.ink, a = (dark ? .62 : .5) * fade;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = 2; ctx.strokeStyle = rgb(c, a * .6); ctx.lineCap = 'square';
  const m = 44, l = 24;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke();
  });
  const ci = chapterIndex(t), ch = CHAPTERS[ci], age = t - ch[0], e = ss(age / .35);
  circ(80, 82 - 5, 5); ctx.fillStyle = rgb(hueAt(ci), a * 1.3); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(70, 58, 520, 40); ctx.clip();
  txt(ch[1] + '  ·  ' + ch[2], 98, 82 + (1 - e) * 26, MONO(17), c, { ls: 3, alpha: a * e });
  ctx.restore();
  const sec = Math.floor(t), mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss_ = String(sec % 60).padStart(2, '0');
  txt(`${mm}:${ss_}  /  00:${T}`, W - 78, 82, MONO(17), c, { ls: 3, alpha: a, align: 'right' });
  const x0 = 78, x1 = W - 78, y = H - 62, p = clamp(t / T);
  ctx.fillStyle = rgb(c, a * .22); ctx.fillRect(x0, y, x1 - x0, 2);
  const g = ctx.createLinearGradient(x0, 0, x1, 0); RAINBOW.forEach(([q, col]) => g.addColorStop(q, rgb(col, Math.min(1, a * 1.7))));
  ctx.fillStyle = g; ctx.fillRect(x0, y - 1, (x1 - x0) * p, 4);
  CHAPTERS.forEach(([ct]) => { ctx.fillStyle = rgb(c, a * (t >= ct ? .9 : .35)); ctx.fillRect(x0 + (x1 - x0) * ct / T - 1, y - 6, 2, 14); });
  for (let b = 0; b < T; b += 2) { ctx.fillStyle = rgb(c, a * .14); ctx.fillRect(x0 + (x1 - x0) * b / T, y + 6, 1, 4); }
  circ(x0 + (x1 - x0) * p, y + 1, 4.5); ctx.fillStyle = rgb(BR.clay, Math.min(1, a * 2)); ctx.fill();
}
