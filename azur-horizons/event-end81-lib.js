/* AZUR v81 — THE END, refonte complète · bibliothèque partagée.
 * Bruit, textures procédurales (fumée éclairée, éclairs, failles, rayons,
 * anneaux, lune, trou noir…), shaders (ciel nocturne, faille « méduse »,
 * traînées de fusée, aurores, dôme du Point Zéro, tourbillon), systèmes
 * (fumée instanciée triée, traînées révélées) et halo lumineux (bloom).
 * Aucune dépendance hors THREE (global). Tout est généré à l'exécution. */
(function (root) {
  'use strict';
  var T = root.THREE;
  if (!T) return;
  var L = root.AZEnd81 = root.AZEnd81 || {};

  /* ------------------------------------------------------------------ maths */
  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(x) { x = cl(x); return x * x * (3 - 2 * x); }
  function ramp(t, a, b) { return sm((t - a) / (b - a)); }
  function win(t, a, b, fi, fo) { fi = fi == null ? .5 : fi; fo = fo == null ? .5 : fo; return ramp(t, a, a + fi) * (1 - ramp(t, b - fo, b)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function hsh(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function easeIn(x) { x = cl(x); return x * x; }
  function easeOut(x) { x = cl(x); return 1 - (1 - x) * (1 - x); }
  L.u = { cl: cl, sm: sm, ramp: ramp, win: win, lerp: lerp, hsh: hsh, rng: rng, easeIn: easeIn, easeOut: easeOut };

  /* ------------------------------------------------------------- bruit JS */
  function vnoise2(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    function h(a, b) { var s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); }
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm2(x, y, seed, oct) {
    var v = 0, a = .5, n = oct || 5;
    for (var i = 0; i < n; i++) { v += a * vnoise2(x, y, seed + i * 13.1); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= .5; }
    return v;
  }
  L.fbm2 = fbm2;

  /* -------------------------------------------------------------- GLSL */
  var NOISE = [
    'float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1.,0.)),f.x),mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}'
  ].join('\n');
  L.NOISE = NOISE;

  /* ---------------------------------------------------------- textures */
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texFrom(c, srgb) { var t = new T.CanvasTexture(c); if (srgb !== false) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t; }
  function draw(w, h, fn, srgb) { var c = canvas(w, h), g = c.getContext('2d'); fn(g, w, h); return texFrom(c, srgb); }

  function glowTex() {
    return draw(128, 128, function (g) {
      var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.12, 'rgba(255,255,255,.75)'); r.addColorStop(.32, 'rgba(255,255,255,.28)');
      r.addColorStop(.6, 'rgba(255,255,255,.07)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    });
  }
  function softTex() { // halo très doux (grandes lueurs)
    return draw(128, 128, function (g) {
      var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.35, 'rgba(255,255,255,.35)'); r.addColorStop(.7, 'rgba(255,255,255,.08)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    });
  }
  function starTex(spikes) {
    return draw(256, 256, function (g) {
      var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.05, 'rgba(240,250,255,.95)'); r.addColorStop(.16, 'rgba(160,220,255,.4)');
      r.addColorStop(.45, 'rgba(90,160,255,.08)'); r.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      g.globalCompositeOperation = 'lighter';
      var n = spikes || 4;
      for (var k = 0; k < n; k++) {
        g.save(); g.translate(128, 128); g.rotate(k * Math.PI / n + (n > 4 ? .2 : 0));
        var lg = g.createLinearGradient(-128, 0, 128, 0);
        lg.addColorStop(0, 'rgba(160,220,255,0)'); lg.addColorStop(.5, 'rgba(235,250,255,' + (k % 2 ? .45 : .95) + ')'); lg.addColorStop(1, 'rgba(160,220,255,0)');
        g.fillStyle = lg; g.fillRect(-128, -1.4, 256, 2.8); g.restore();
      }
    });
  }
  function flareTex() { // traînée anamorphique horizontale
    return draw(512, 64, function (g) {
      for (var i = 0; i < 3; i++) {
        var lg = g.createLinearGradient(0, 0, 512, 0);
        lg.addColorStop(0, 'rgba(120,190,255,0)'); lg.addColorStop(.5, 'rgba(235,248,255,' + [.9, .5, .25][i] + ')'); lg.addColorStop(1, 'rgba(120,190,255,0)');
        g.fillStyle = lg; var hh = [2, 7, 18][i]; g.globalAlpha = 1; g.fillRect(0, 32 - hh / 2, 512, hh);
      }
      var r = g.createRadialGradient(256, 32, 0, 256, 32, 40); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(200, 0, 112, 64);
    });
  }
  /* Fumée : atlas 2×2, R = densité, G = éclairage (ombre portée interne vers la lumière). */
  function smokeTex() {
    var S = 128, c = canvas(S * 2, S * 2), g = c.getContext('2d'), img = g.createImageData(S * 2, S * 2), d = img.data;
    for (var cell = 0; cell < 4; cell++) {
      var ox = (cell % 2) * S, oy = (cell >> 1) * S, R = rng(91 + cell * 17), blobs = [];
      for (var b = 0; b < 9; b++) {
        var ang = R() * 6.283, rad = R() * .26;
        blobs.push([.5 + Math.cos(ang) * rad, .52 + Math.sin(ang) * rad * .8, .13 + R() * .14]);
      }
      var den = new Float32Array(S * S);
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        var u = x / S, v = y / S, a = 0;
        for (var k = 0; k < blobs.length; k++) { var dx = u - blobs[k][0], dy = v - blobs[k][1]; a += Math.exp(-(dx * dx + dy * dy) / (blobs[k][2] * blobs[k][2])); }
        var n = fbm2(u * 6, v * 6, cell * 3.7, 4);
        a = a * (.55 + .9 * n) - .35;
        var edge = Math.hypot(u - .5, v - .5) * 2; a *= cl((1 - edge) * 2.2);
        den[y * S + x] = cl(a * 1.15);
      }
      for (var y2 = 0; y2 < S; y2++) for (var x2 = 0; x2 < S; x2++) {
        var acc = 0;
        for (var s = 1; s <= 7; s++) { var sx = x2 - s * 2, sy = y2 - s * 3; if (sx < 0 || sy < 0) break; acc += den[sy * S + sx]; }
        var lit = Math.exp(-acc * .55), dd = den[y2 * S + x2], i = ((oy + y2) * S * 2 + ox + x2) * 4;
        d[i] = Math.round(dd * 255); d[i + 1] = Math.round(cl(lit) * 255); d[i + 2] = Math.round(fbm2(x2 / 20, y2 / 20, cell + 9, 3) * 255); d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.needsUpdate = true; return t;
  }
  function bolt(g, x, y, ang, len, w, depth, R, jitter) {
    var n = 9 + Math.floor(R() * 5), px = x, py = y;
    g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
    for (var i = 1; i <= n; i++) {
      var a = ang + (R() - .5) * (jitter || 1.2);
      px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; g.lineTo(px, py);
      if (depth > 0 && R() < .18) {
        g.stroke(); bolt(g, px, py, a + (R() - .5) * 1.7, len * (.3 + R() * .35), w * .6, depth - 1, R, jitter);
        g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
      }
    }
    g.stroke();
  }
  function burstTex(seed, opts) { // gerbe d'éclairs radiale
    opts = opts || {};
    return draw(512, 512, function (g) {
      var R = rng(seed);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
      if (opts.shell) {
        var r0 = g.createRadialGradient(256, 256, 60, 256, 256, 250);
        r0.addColorStop(0, 'rgba(60,120,255,.0)'); r0.addColorStop(.7, 'rgba(50,110,255,.22)'); r0.addColorStop(.92, 'rgba(70,140,255,.35)'); r0.addColorStop(1, 'rgba(40,80,220,0)');
        g.fillStyle = r0; g.fillRect(0, 0, 512, 512);
        for (var s = 0; s < 260; s++) { // stries de la sphère
          var a0 = R() * 6.283, rr = 120 + R() * 125, l = 6 + R() * 22;
          g.strokeStyle = 'rgba(' + (90 + R() * 80 | 0) + ',' + (160 + R() * 70 | 0) + ',255,' + (.15 + R() * .35) + ')'; g.lineWidth = 1 + R() * 2.5;
          g.beginPath(); g.moveTo(256 + Math.cos(a0) * rr, 256 + Math.sin(a0) * rr); g.lineTo(256 + Math.cos(a0) * (rr + l), 256 + Math.sin(a0) * (rr + l)); g.stroke();
        }
      }
      var r = g.createRadialGradient(256, 256, 0, 256, 256, 120);
      r.addColorStop(0, 'rgba(230,248,255,1)'); r.addColorStop(.18, 'rgba(150,215,255,.75)'); r.addColorStop(.6, 'rgba(60,130,255,.18)'); r.addColorStop(1, 'rgba(40,80,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 512, 512);
      var N = opts.count || 26;
      for (var pass = 0; pass < 2; pass++) {
        g.shadowColor = 'rgba(110,170,255,1)'; g.shadowBlur = pass ? 4 : 14;
        for (var k = 0; k < N; k++) {
          var purple = R() < (opts.purple || .22);
          g.strokeStyle = pass ? (purple ? 'rgba(240,200,255,.95)' : 'rgba(225,245,255,.95)') : (purple ? 'rgba(190,90,255,.5)' : 'rgba(80,140,255,.5)');
          var len = (opts.len || 170) + R() * (opts.lenVar || 80);
          bolt(g, 256, 256, k / N * 6.283 + R() * .3, len, pass ? 1.6 : 5, 2, rng(seed * 31 + k), 1.0);
        }
      }
    });
  }
  function boltVTex(seed) { // éclair vertical (bande)
    return draw(128, 512, function (g) {
      var R = rng(seed); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) {
        g.shadowColor = 'rgba(120,180,255,1)'; g.shadowBlur = pass ? 4 : 12;
        g.strokeStyle = pass ? 'rgba(235,248,255,1)' : 'rgba(110,160,255,.55)';
        var RR = rng(seed);
        bolt(g, 64, 4, Math.PI / 2, 500, pass ? 2.2 : 6, 2, RR, .9);
      }
    });
  }
  function arcsTex(seed) { // petits arcs électriques (météorite)
    return draw(256, 256, function (g) {
      var R = rng(seed); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (var pass = 0; pass < 2; pass++) {
        g.shadowColor = 'rgba(120,200,255,1)'; g.shadowBlur = pass ? 3 : 10;
        g.strokeStyle = pass ? 'rgba(230,248,255,.95)' : 'rgba(90,170,255,.6)';
        var RR = rng(seed);
        for (var k = 0; k < 7; k++) bolt(g, 128 + (RR() - .5) * 150, 128 + (RR() - .5) * 150, RR() * 6.283, 50 + RR() * 70, pass ? 1.4 : 4, 1, RR, 1.5);
      }
    });
  }
  function crackTex(seed) { // étoile de fissures (verre brisé)
    return draw(512, 512, function (g) {
      var R = rng(seed); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'miter';
      var r = g.createRadialGradient(256, 256, 0, 256, 256, 70); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(200,235,255,.6)'); r.addColorStop(1, 'rgba(120,180,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 512, 512);
      for (var pass = 0; pass < 2; pass++) {
        g.shadowColor = 'rgba(150,210,255,1)'; g.shadowBlur = pass ? 3 : 10;
        g.strokeStyle = pass ? 'rgba(245,252,255,1)' : 'rgba(120,190,255,.6)';
        var RR = rng(seed);
        for (var k = 0; k < 11; k++) {
          var a = k / 11 * 6.283 + RR() * .4, x = 256, y = 256, len = 70 + RR() * 150;
          g.lineWidth = pass ? 1.8 : 5; g.beginPath(); g.moveTo(x, y);
          var segs = 3 + Math.floor(RR() * 3);
          for (var s = 0; s < segs; s++) { a += (RR() - .5) * .9; x += Math.cos(a) * len / segs; y += Math.sin(a) * len / segs; g.lineTo(x, y); }
          g.stroke();
        }
      }
    });
  }
  function raysTex(seed, magenta) { // rayons de lumière radiaux fins
    return draw(512, 512, function (g) {
      var R = rng(seed); g.translate(256, 256); g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 90; i++) {
        var a = R() * 6.283, w = .002 + R() * .012, m = magenta && R() < .3;
        var gr = g.createLinearGradient(0, 0, Math.cos(a) * 256, Math.sin(a) * 256);
        gr.addColorStop(0, m ? 'rgba(255,90,230,.95)' : 'rgba(225,240,255,.95)'); gr.addColorStop(.5, m ? 'rgba(220,60,220,.35)' : 'rgba(150,190,255,.35)'); gr.addColorStop(1, 'rgba(120,160,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 256, a - w, a + w); g.fill();
      }
      var c = g.createRadialGradient(0, 0, 0, 0, 0, 90); c.addColorStop(0, 'rgba(255,255,255,1)'); c.addColorStop(.3, 'rgba(200,230,255,.5)'); c.addColorStop(1, 'rgba(150,200,255,0)');
      g.fillStyle = c; g.fillRect(-256, -256, 512, 512);
    });
  }
  function portalRingTex() { // portail : grand halo bleu doux, intérieur sombre, fin liseré irisé (fusion normale)
    return draw(512, 512, function (g) {
      var cx = 256, r = g.createRadialGradient(cx, cx, 0, cx, cx, 256);
      r.addColorStop(0, 'rgba(8,10,34,.72)'); r.addColorStop(.42, 'rgba(14,16,52,.66)'); r.addColorStop(.52, 'rgba(40,30,96,.62)');
      r.addColorStop(.565, 'rgba(255,150,120,.42)'); r.addColorStop(.59, 'rgba(230,240,140,.42)'); r.addColorStop(.615, 'rgba(120,230,200,.45)');
      r.addColorStop(.66, 'rgba(70,150,255,.85)'); r.addColorStop(.76, 'rgba(50,110,255,.62)'); r.addColorStop(.88, 'rgba(40,80,240,.28)'); r.addColorStop(1, 'rgba(30,60,220,0)');
      g.fillStyle = r; g.fillRect(0, 0, 512, 512);
      var R = rng(77);
      for (var i = 0; i < 500; i++) { var a = R() * 6.283, rr = 160 + R() * 90; g.fillStyle = 'rgba(150,190,255,' + (R() * .16) + ')'; g.fillRect(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, 2, 2); }
    });
  }
  function moonTex() {
    return draw(256, 256, function (g) {
      var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.36, 'rgba(250,253,255,1)'); r.addColorStop(.39, 'rgba(220,240,255,.45)');
      r.addColorStop(.5, 'rgba(150,205,255,.08)'); r.addColorStop(1, 'rgba(80,140,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(205,218,236,.4)';
      [[112, 110, 11], [146, 128, 8], [124, 150, 7], [150, 100, 6], [100, 138, 5]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 6.3); g.fill(); });
    });
  }
  function holeTex() { // trou noir (fusion normale) : disque noir, anneau bleu, volutes
    return draw(256, 256, function (g) {
      g.translate(128, 128);
      var r = g.createRadialGradient(0, 0, 18, 0, 0, 125);
      r.addColorStop(0, 'rgba(30,60,200,1)'); r.addColorStop(.12, 'rgba(60,120,255,1)'); r.addColorStop(.2, 'rgba(40,80,220,.75)');
      r.addColorStop(.42, 'rgba(18,40,150,.32)'); r.addColorStop(.75, 'rgba(8,18,80,.08)'); r.addColorStop(1, 'rgba(0,0,30,0)');
      g.fillStyle = r; g.fillRect(-128, -128, 256, 256);
      var R = rng(5);
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 26; i++) {
        g.strokeStyle = 'rgba(90,150,255,' + (.08 + R() * .2) + ')'; g.lineWidth = 1 + R() * 2.2; g.beginPath();
        var a0 = R() * 6.283, r0 = 24 + R() * 6;
        for (var j = 0; j <= 26; j++) { var a = a0 + j * .09, rr = r0 + j * (1.4 + R() * .6); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(0,0,0,1)'; g.beginPath(); g.arc(0, 0, 22, 0, 6.3); g.fill();
    });
  }
  function scorchTex() {
    var S = 256, c = canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var u = x / S - .5, v = y / S - .5, r = Math.hypot(u, v) * 2, n = fbm2(x / 40, y / 40, 4, 5);
      var a = cl((1 - r * (1.05 + .45 * (n - .5) * 2)) * 3.2), i = (y * S + x) * 4;
      var k = .5 + .5 * fbm2(x / 9, y / 9, 8, 3);
      d[i] = 18 + k * 22; d[i + 1] = 16 + k * 16; d[i + 2] = 18 + k * 14; d[i + 3] = Math.round(a * 240);
    }
    g.putImageData(img, 0, 0); return texFrom(c);
  }
  function shardTex() {
    return draw(64, 64, function (g) {
      g.fillStyle = 'rgba(220,240,255,.9)'; g.beginPath(); g.moveTo(32, 4); g.lineTo(54, 30); g.lineTo(30, 60); g.lineTo(12, 26); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 2; g.stroke();
    });
  }
  function lavaTex() { // fissure de lave (ruban)
    var W = 512, H = 64, c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var v = Math.abs(y / H - .5) * 2, n = fbm2(x / 30, y / 12, 3, 4), core = cl(1 - v * (1.8 + n)), glow = cl(1 - v) * .55, i = (y * W + x) * 4;
      var hot = core * core;
      d[i] = 255; d[i + 1] = Math.round(70 + hot * 170); d[i + 2] = Math.round(20 + hot * 80); d[i + 3] = Math.round(cl(core + glow * .5) * 255 * cl(x / 30) * cl((W - x) / 30));
    }
    g.putImageData(img, 0, 0); return texFrom(c);
  }

  function globeTex() { // grande sphère bleue au zénith (190-204 s) : disque translucide, bord plus clair, volutes
    return draw(512, 512, function (g) {
      var r = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      r.addColorStop(0, 'rgba(30,60,200,.42)'); r.addColorStop(.62, 'rgba(40,80,230,.55)'); r.addColorStop(.84, 'rgba(70,120,255,.8)');
      r.addColorStop(.93, 'rgba(110,160,255,.55)'); r.addColorStop(1, 'rgba(60,100,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 512, 512);
      var s = 11; function R() { s = (s * 16807) % 2147483647; return s / 2147483647; }
      g.save(); g.beginPath(); g.arc(256, 256, 236, 0, 6.3); g.clip(); g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 70; i++) { var x = 256 + (R() - .5) * 440, y = 256 + (R() - .5) * 440, rr = 20 + R() * 70, q = g.createRadialGradient(x, y, 0, x, y, rr); q.addColorStop(0, 'rgba(60,110,255,' + (.05 + R() * .08) + ')'); q.addColorStop(1, 'rgba(60,110,255,0)'); g.fillStyle = q; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      g.restore();
    });
  }
  L.makeTextures = function (low) {
    var X = {};
    X.glow = glowTex(); X.soft = softTex(); X.star = starTex(4); X.star6 = starTex(6); X.flare = flareTex(); X.smoke = smokeTex();
    X.bursts = [burstTex(11, { count: 14 }), burstTex(23, { count: 14 }), burstTex(37, { count: 14 })];
    X.shell = [burstTex(51, { shell: true, count: 16, purple: .3 }), burstTex(63, { shell: true, count: 16, purple: .3 })];
    X.burstBig = [burstTex(71, { count: 15, len: 215, lenVar: 40, purple: .2 }), burstTex(83, { count: 15, len: 215, lenVar: 40, purple: .2 })];
    X.boltV = [boltVTex(3), boltVTex(17), boltVTex(29), boltVTex(41)];
    X.arcs = [arcsTex(5), arcsTex(19), arcsTex(31)];
    X.crack = [crackTex(7), crackTex(13)];
    X.rays = raysTex(9, false); X.raysM = raysTex(21, true);
    X.ring = portalRingTex(); X.globe = globeTex(); X.moon = moonTex(); X.hole = holeTex(); X.scorch = scorchTex(); X.shard = shardTex(); X.lava = lavaTex();
    return X;
  };

  /* --------------------------------------------------------- matériaux */
  L.sprite = function (parent, tex, color, size, additive, opacity) {
    var m = new T.SpriteMaterial({ map: tex, color: color == null ? 0xffffff : color, transparent: true, depthWrite: false, fog: false,
      blending: additive === false ? T.NormalBlending : T.AdditiveBlending, opacity: opacity == null ? 0 : opacity });
    m.toneMapped = false;
    var s = new T.Sprite(m); s.scale.setScalar(size); s.frustumCulled = false; s.visible = false; if (parent) parent.add(s); return s;
  };
  /* Règle utile : sprite visible seulement si opacité > 0. */
  L.setOp = function (s, op) { op = op > 0 ? op : 0; s.material.opacity = op; s.visible = op > .003; return s; };

  /* Ciel nocturne : dégradé, halo de lune, nébuleuses, teinte rouge, mode espace. */
  L.skyMaterial = function () {
    return new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { time: { value: 0 }, moonDir: { value: new T.Vector3(0, .5, -1).normalize() }, red: { value: 0 }, space: { value: 0 }, dark: { value: 0 }, glow: { value: 1 }, bright: { value: 0 } },
      vertexShader: 'varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
      fragmentShader: [
        'varying vec3 vDir;uniform vec3 moonDir;uniform float time,red,space,dark,glow,bright;', NOISE,
        'void main(){vec3 d=normalize(vDir);float h=d.y;',
        'vec3 hor=vec3(.10,.30,.52),mid=vec3(.035,.13,.30),zen=vec3(.008,.025,.075);',
        'vec3 c=mix(hor,mid,smoothstep(-.02,.22,h));c=mix(c,zen,smoothstep(.22,.92,h));',
        'float md=max(dot(d,normalize(moonDir)),0.);',
        'c+=vec3(.20,.62,.88)*pow(md,40.)*.3*glow+vec3(.08,.34,.62)*pow(md,7.)*.16*glow;',
        'vec2 q=vec2(atan(d.z,d.x)*2.2,h*3.4);',
        'float n=fbm(q*1.3+vec2(time*.003,0.));float neb=smoothstep(.42,.86,n)*(1.-smoothstep(.0,1.,abs(h-.32)*1.6));',
        'c+=vec3(.06,.26,.46)*neb*.55*glow;',
        'float lane=smoothstep(.52,.78,fbm(q*2.1+vec2(3.1,1.7)));c*=1.-.32*lane*smoothstep(.0,.3,h);',
        'vec3 redc=mix(vec3(.42,.05,.10),vec3(.86,.20,.27),smoothstep(-.05,.75,h))+vec3(.25,.05,.1)*neb+vec3(1.,.72,.78)*pow(max(h,0.),7.)*.9;',
        'vec3 brc=c*1.55+vec3(.04,.13,.26)*(1.-smoothstep(.0,.8,h))+vec3(.12,.38,.62)*pow(md,5.)*.35;c=mix(c,brc,bright);',
        'c=mix(c,redc,red);',
        'vec3 sp=vec3(.003,.006,.016)+vec3(.035,.07,.15)*neb+vec3(.06,.02,.1)*lane*neb;',
        'c=mix(c,sp,space);c*=1.-dark*.55;',
        'gl_FragColor=vec4(c,1.);}'
      ].join('\n')
    });
  };
  /* Étoiles : points scintillants. */
  L.starField = function (n, radius, seed) {
    var R = rng(seed || 3), pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var y = R() * 1.05 - .05, a = R() * 6.283, rr = Math.sqrt(Math.max(0, 1 - y * y));
      pos[i * 3] = Math.cos(a) * rr * radius; pos[i * 3 + 1] = y * radius; pos[i * 3 + 2] = Math.sin(a) * rr * radius;
      sz[i] = .6 + Math.pow(R(), 6) * 3.2; ph[i] = R() * 6.283;
    }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('sz', new T.BufferAttribute(sz, 1)); g.setAttribute('ph', new T.BufferAttribute(ph, 1));
    var m = new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, fog: false,
      uniforms: { time: { value: 0 }, amt: { value: 1 }, px: { value: 1 } },
      vertexShader: 'attribute float sz;attribute float ph;uniform float time,px;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_Position.z=gl_Position.w*.9999;vA=.55+.45*sin(time*(1.3+fract(ph*3.)*2.)+ph);gl_PointSize=sz*px;}',
      fragmentShader: 'uniform float amt;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,.0,d);gl_FragColor=vec4(vec3(.82,.9,1.)*a*vA*amt,a*vA*amt);}' });
    var p = new T.Points(g, m); p.frustumCulled = false; p.renderOrder = -9; return p;
  };

  /* Faille v81b « ailes de lumière » (comme la vidéo) : un point d'étoile très
   * brillant, des voiles translucides en éventail (2 à 5 ailes striées de fines
   * fibres, plus claires sur les bords), de longs filaments qui pendent, et un
   * frémissement permanent. narrow = 1 : petite faille de passage (ailes fines,
   * filaments plus longs). */
  L.riftMaterial = function (seed, narrow) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide,
      uniforms: { time: { value: 0 }, open: { value: 0 }, seed: { value: seed || 1 }, amt: { value: 0 }, flash: { value: 0 }, curl: { value: 1 }, narrow: { value: narrow ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'varying vec2 vUv;uniform float time,open,seed,amt,flash,curl,narrow;', NOISE,
        'float hs(float n){return fract(sin(n*91.345+seed*17.13)*43758.5453);}',
        'float tri(float x){return abs(fract(x)-.5)*2.;}',
        'float sgA(float a){return mod(a+3.14159,6.28318)-3.14159;}',
        /* éclair dentelé partant du centre dans la direction ang */
        'float bolt(float r,float a,float ang,float L,float w,float ph){',
        ' float off=(tri(r*4.+ph)-.5)*.11+(tri(r*13.+ph*2.3)-.5)*.035+(tri(r*37.+ph*4.1)-.5)*.007;',
        ' float d=abs(r*sgA(a-ang)-off*r*1.6);float k=r/max(L,.001);',
        ' float ww=w*max(1.-.55*k,.3);float fade=smoothstep(.02,.07,r)*(1.-smoothstep(.62,1.,k));',
        ' return (exp(-d*d/(ww*ww))+.28*exp(-d/(ww*4.5)))*fade;}',
        'void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);',
        ' float N=mix(13.,8.,narrow);float rot=hs(9.)*6.2832;vec3 lc=vec3(0.);',
        ' for(int i=0;i<13;i++){float fi=float(i);if(fi>=N)break;',
        '  float L=(.55+.45*hs(fi+3.))*mix(.3,1.,open)*(fi<3.?1.:.85);',
        '  float ang=rot+fi*6.2832/N+(hs(fi+1.)-.5)*.55+.035*sin(time*.8+fi*2.)+(hs(fi+7.)-.5)*.7*curl*r;',
        '  float ph=hs(fi+13.)*10.+floor(time*5.+hs(fi+29.)*3.)*.37;',
        '  float w=mix(.012,.0095,narrow);float fl=.72+.28*sin(time*13.+fi*4.7);',
        '  float b=bolt(r,a,ang,L,w,ph);',
        '  float rb=L*(.22+.38*hs(fi+17.)),bo=(hs(fi+19.)-.5)*1.5;',
        '  b+=.7*step(.25,hs(fi+39.))*bolt(r,a,ang+bo*(1.-rb/max(r,.001)),L*.75,w*.8,ph+3.1)*smoothstep(rb,rb+.03,r);',
        '  float rb2=L*(.45+.3*hs(fi+21.)),bo2=(hs(fi+23.)-.5)*1.8;',
        '  b+=.5*step(.55,hs(fi+37.))*bolt(r,a,ang+bo2*(1.-rb2/max(r,.001)),L*.8,w*.7,ph+6.3)*smoothstep(rb2,rb2+.03,r);',
        '  vec3 tc=mix(vec3(.72,.88,1.),vec3(.86,.62,1.),step(.62,hs(fi+27.))*smoothstep(.15,.6,r/L));',
        '  lc+=tc*b*fl;}',
        /* voiles bleu nuit, translucides, en éventail (les « ailes ») */
        ' float cl1=fbm3(p*2.4+vec2(seed*1.7,time*.03)),cl2=fbm3(p*5.2+vec2(time*.05,seed*.7));',
        ' float veil=smoothstep(.42,.78,cl1*.78+cl2*.34)*(1.-smoothstep(.2,.92,r/mix(.3,1.,open)))*smoothstep(.0,.12,r)*mix(1.,.5,narrow);',
        /* paillettes qui tombent sous l'étoile */
        ' vec2 g=vec2(p.x*46.,(p.y+time*.10)*46.);vec2 id=floor(g),f=fract(g)-.5;',
        ' float hh=fract(sin(dot(id,vec2(12.9898,78.233))+seed*7.)*43758.5453);',
        ' float spk=step(.8,hh)*exp(-dot(f,f)*26.)*(.55+.45*sin(time*9.+hh*40.));',
        ' float cone=(1.-smoothstep(.0,.05+.13*max(-p.y,0.),abs(p.x)))*smoothstep(.06,-.02,p.y)*(1.-smoothstep(.2,.7,-p.y));',
        ' float core=exp(-r*58.)*3.2+exp(-r*16.)*.75;',
        ' float sp=exp(-abs(p.x)*120.)*exp(-abs(p.y)*9.)+exp(-abs(p.y)*120.)*exp(-abs(p.x)*9.);',
        ' vec3 col=lc+vec3(.07,.18,.78)*veil*1.1+vec3(.14,.38,1.)*exp(-r*r*7.)*.42+vec3(.35,.75,1.)*exp(-r*6.)*.4',
        '  +vec3(.9,.97,1.)*(core+sp*.6)+vec3(.75,.92,1.)*spk*cone*1.3*mix(1.,.6,narrow);',
        ' col=col*amt+vec3(.9,.97,1.)*flash*exp(-r*5.)*1.6;',
        ' float edge=1.-smoothstep(.84,1.,r);',
        ' gl_FragColor=vec4(col*edge,1.);}'
      ].join('\n')
    });
  };

  /* v85 — FAILLE « AILES » telle qu'on la voit dans la vidéo (lancement, 20-47 s, et
   * les failles-méduses vers 62-72 s) : une étoile bleu-blanc éblouissante, 6 à 9 longs
   * filaments fins et courbes (pattes / antennes), 2 à 4 grandes ailes bleues
   * translucides en éventail, striées de fibres, plus claires sur les bords, qui pendent
   * plus ou moins (droop : 0 = papillon, 1 = rideaux de méduse), et une fine pluie de
   * paillettes qui tombe d'un côté de l'étoile. */
  L.wingMaterial = function (seed, droop, nw) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide,
      uniforms: { time: { value: 0 }, open: { value: 0 }, seed: { value: seed || 1 }, amt: { value: 0 }, flash: { value: 0 }, curl: { value: 1 }, narrow: { value: 0 }, droop: { value: droop || 0 }, nw: { value: nw || 3 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'varying vec2 vUv;uniform float time,open,seed,amt,flash,droop,nw;', NOISE,
        'float hs(float n){return fract(sin(n*91.345+seed*17.13)*43758.5453);}',
        'float sgA(float a){return mod(a+3.14159,6.28318)-3.14159;}',
        'void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float rot=hs(5.)*6.2832;vec3 col=vec3(0.);',
        /* ailes : voiles translucides striés */
        ' float wv=0.,we=0.;',
        ' for(int k=0;k<4;k++){float fk=float(k);if(fk>=nw)break;',
        '  vec2 q=p;float rq=length(q),aq=atan(q.y,q.x);',
        '  float phi=rot+.5+fk*6.2832/max(nw,1.)+(hs(fk+31.)-.5)*.7;',
        '  float hw=.42+.3*hs(fk+33.);float R=(.66+.24*hs(fk+35.))*mix(.25,1.,open);',
        '  float da=sgA(aq-phi-(hs(fk+37.)-.5)*.7*rq);',
        '  float inS=1.-smoothstep(hw*.7,hw,abs(da));float rad=smoothstep(.02,.15,rq)*(1.-smoothstep(R*.55,R*.97,rq));',
        '  float fib=vn(vec2(da*26.+seed*3.+fk*7.,rq*1.6-time*.1));fib=.55+.45*smoothstep(.15,.95,fib);',
        '  float outer=smoothstep(R*.4,R*.92,rq),side=smoothstep(hw*.3,hw*.95,abs(da));',
        '  float sway=1.+.08*sin(time*1.7+fk*2.+rq*5.);',
        '  wv+=inS*rad*fib*(.32+.45*outer+.35*side)*sway;we+=inS*rad*side*outer*fib;}',
        ' col+=(vec3(.16,.30,.88)*wv*.72+vec3(.45,.62,1.)*we*.3)*(1.-droop);',
        /* rideaux de méduse (droop) : voiles verticaux qui pendent sous l'étoile, striés, ondulants */
        ' float cu=0.,ce=0.;if(droop>.01){for(int k=0;k<3;k++){float fk=float(k);',
        '  float y=-p.y,cx=(fk-1.)*.3+(hs(fk+41.)-.5)*.16,wd=(.15+.09*hs(fk+43.))*(.25+.75*smoothstep(.0,.35,y));',
        '  float Lc=(.6+.32*hs(fk+45.))*mix(.25,1.,open);',
        '  float x=p.x-cx*smoothstep(.0,.32,y)-.05*sin(time*.9+fk*2.+y*3.)*y;',
        '  float inX=1.-smoothstep(wd*.55,wd,abs(x)),inY=smoothstep(-.02,.07,y)*(1.-smoothstep(Lc*.45,Lc,y));',
        '  float fib=.45+.55*smoothstep(.2,.9,vn(vec2(x*60.+fk*9.,y*1.4-time*.08)));float ex=smoothstep(wd*.2,wd*.9,abs(x));',
        '  cu+=inX*inY*fib*(.4+.5*ex);ce+=inX*inY*ex*smoothstep(.0,.2,y);}}',
        ' col+=(vec3(.17,.30,.92)*cu*.62+vec3(.5,.66,1.)*ce*.25)*droop;',
        /* filaments courbes */
        ' for(int i=0;i<9;i++){float fi=float(i);',
        '  float L=(.3+.66*hs(fi+3.)*hs(fi+3.7))*mix(.2,1.,open)+.12*step(.6,hs(fi+5.));float th=rot+fi*.6981+(hs(fi+1.)-.5)*.55;',
        '  float cv=(hs(fi+7.)-.5)*1.6+.7*sign(hs(fi+11.)-.5);',
        '  float ang=th+cv*r*r/max(L,.2)+.04*sin(time*1.3+fi*2.1+r*7.);',
        '  float d=abs(r*sgA(a-ang));float k=r/max(L,.001);float w=max(.0036*(1.-.5*k),0.)+.0011;',
        '  float fade=smoothstep(.01,.05,r)*(1.-smoothstep(.5,1.,k));',
        '  col+=vec3(.72,.86,1.)*(exp(-d*d/(w*w))+.2*exp(-d/(w*7.)))*fade*(.8+.2*sin(time*5.+fi*3.1))*(1.-.45*k)*.8;}',
        /* étoile centrale */
        ' float core=exp(-r*75.)*2.6+exp(-r*22.)*.38;',
        ' float sp=exp(-abs(p.x)*160.)*exp(-abs(p.y)*16.)+exp(-abs(p.y)*160.)*exp(-abs(p.x)*16.);',
        ' col+=vec3(.86,.96,1.)*(core+sp*.4)+vec3(.2,.5,1.)*exp(-r*r*14.)*.3;',
        /* pluie de paillettes */
        ' vec2 g=vec2((p.x-.08)*50.,(p.y+time*.09)*50.);vec2 id=floor(g),f2=fract(g)-.5;float hh=h12(id+seed);',
        ' float spk=step(.82,hh)*exp(-dot(f2,f2)*28.)*(.55+.45*sin(time*8.+hh*40.));',
        ' float stream=(1.-smoothstep(.0,.06+.12*max(-p.y,0.),abs(p.x-.1+p.y*.25)))*smoothstep(.04,-.04,p.y)*(1.-smoothstep(.15,.65,-p.y));',
        ' col+=vec3(.75,.9,1.)*spk*stream*1.3;',
        ' col=col*amt+vec3(.9,.97,1.)*flash*exp(-r*5.)*1.6;',
        ' gl_FragColor=vec4(col*(1.-smoothstep(.86,1.,r)),1.);}'
      ].join('\n')
    });
  };

  /* Traînée : tube révélé jusqu'à la tête, élargi et adouci vers la queue. */
  L.trailGeometry = function (curve, segs, radial, radius) {
    segs = segs || 140; radial = radial || 8;
    var frames = curve.computeFrenetFrames(segs, false), pos = [], cen = [], uv = [], idx = [], P = new T.Vector3(), N = new T.Vector3();
    for (var i = 0; i <= segs; i++) {
      var u = i / segs; curve.getPointAt(u, P);
      for (var j = 0; j <= radial; j++) {
        var v = j / radial * Math.PI * 2, s = Math.sin(v), c = -Math.cos(v);
        N.set(0, 0, 0).addScaledVector(frames.normals[i], c).addScaledVector(frames.binormals[i], s).normalize();
        pos.push(P.x + N.x * radius, P.y + N.y * radius, P.z + N.z * radius); cen.push(P.x, P.y, P.z); uv.push(u, j / radial);
      }
    }
    for (var i2 = 0; i2 < segs; i2++) for (var j2 = 0; j2 < radial; j2++) {
      var a = i2 * (radial + 1) + j2, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('center', new T.Float32BufferAttribute(cen, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere(); return g;
  };
  L.trailMaterial = function (col, core) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { head: { value: 0 }, len: { value: .5 }, alpha: { value: 0 }, time: { value: 0 }, grow: { value: 2.2 }, col: { value: new T.Color(col) }, core: { value: new T.Color(core) } },
      vertexShader: [
        'attribute vec3 center;uniform float head,len,grow;varying vec2 vUv;varying float vF;',
        'void main(){vUv=uv;float age=clamp((head-uv.x)/max(len,.001),0.,1.);float w=.55+grow*age;',
        'vec3 p=center+(position-center)*w;vec4 mv=modelViewMatrix*vec4(p,1.);',
        'vec3 n=normalize(normalMatrix*(position-center));vF=abs(dot(n,normalize(-mv.xyz)));',
        'gl_Position=projectionMatrix*mv;}'
      ].join('\n'),
      fragmentShader: [
        'uniform float head,len,alpha,time;uniform vec3 col,core;varying vec2 vUv;varying float vF;', NOISE,
        'void main(){float u=vUv.x;if(u>head)discard;float k=clamp(1.-(head-u)/max(len,.001),0.,1.);',
        'float prof=pow(vF,1.4);float n=.62+.38*vn(vec2(u*90.-time*1.5,vUv.y*5.));',
        'vec3 c=mix(col,core,pow(prof,2.5)*(.35+.65*k));',
        'float a=prof*pow(k,.75)*alpha*n*(.35+.65*smoothstep(0.,.08,head-u+.08));',
        'gl_FragColor=vec4(c,a);}'
      ].join('\n')
    });
  };

  /* Aurores boréales : rideaux à rayons verticaux, vert → cyan → violet. */
  L.auroraMaterial = function (seed) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, alpha: { value: 0 }, seed: { value: seed || 1 }, len: { value: 30 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'varying vec2 vUv;uniform float time,alpha,seed,len;', NOISE,
        'void main(){float x=vUv.x*len+seed*13.;float y=vUv.y;',
        'float fold=.5+.5*sin(x*.9+time*.25+fbm3(vec2(x*.35,time*.05+seed))*5.);',
        'float rays=pow(vn(vec2(x*9.+time*.6,y*.6+seed)),2.2)*1.3+.25;',
        'float rays2=pow(vn(vec2(x*31.-time*.9,y*.4)),3.)*.8;',
        'float top=.22+.42*fold;',
        'float body=smoothstep(0.,.07,y)*(1.-smoothstep(top*.55,top,y));',
        'float edge=exp(-pow((y-.06)*16.,2.))*1.2;',
        'vec3 g=vec3(.12,1.,.52),c2=vec3(.10,.86,.78),v=vec3(.45,.32,1.);',
        'vec3 col=mix(g,c2,smoothstep(.05,.45,y));col=mix(col,v,smoothstep(.45,.95,y)*.75);',
        'float side=smoothstep(0.,.06,vUv.x)*(1.-smoothstep(.94,1.,vUv.x));',
        'float a=(body*(rays+rays2)*(.45+.55*fold)+edge*(.5+.5*rays))*alpha*side;',
        'gl_FragColor=vec4(col,a*.85);}'
      ].join('\n')
    });
  };

  /* Dôme du Point Zéro : verre d'énergie violet puis cyan, volutes, ondes. */
  L.domeMaterial = function () {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, amt: { value: 0 }, flash: { value: 0 }, cyan: { value: 0 }, ripple: { value: 0 }, ripT: { value: 0 }, hot: { value: 0 },
        ripDir: { value: new T.Vector3(0, 1, 0) }, dentDir: { value: new T.Vector3(0, 1, 0) }, dent: { value: 0 }, dentW: { value: .42 }, wob: { value: 0 }, touch: { value: 0 } },
      /* v93 : la membrane réagit — creux là où la météorite appuie (dent), ondulation qui part du point de contact (wob) */
      vertexShader: 'uniform vec3 dentDir;uniform float dent,dentW,wob,time;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying float vDt;void main(){vP=position;vec3 n0=normalize(position);float ang=acos(clamp(dot(n0,dentDir),-1.,1.));float pr=exp(-pow(ang/dentW,2.));vec3 q=position*(1.-dent*pr*(1.+.12*sin(time*23.)));q*=1.+wob*sin(ang*7.-time*9.)*exp(-ang*.9)*.06;vDt=pr*step(.001,dent);vec4 mv=modelViewMatrix*vec4(q,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: [
        'varying vec3 vN;varying vec3 vV;varying vec3 vP;varying float vDt;uniform float time,amt,flash,cyan,ripple,ripT,hot,touch;uniform vec3 ripDir;', NOISE,
        'void main(){vec3 p=normalize(vP);float f=1.-abs(dot(normalize(vN),normalize(vV)));float rim=pow(f,2.2);',
        'float ang=atan(p.z,p.x);float h=clamp(p.y,0.,1.);',
        'float sw=fbm(vec2(ang*2.+h*3.5-time*.35,h*5.-time*.55));float sw2=fbm(vec2(ang*4.-time*.5,h*9.+time*.3));',
        'float streak=pow(sw,2.6)*2.2+pow(sw2,4.)*1.5;',
        'vec3 pur=vec3(.62,.38,1.),pink=vec3(1.,.48,.86),cy=vec3(.45,.92,1.),wh=vec3(.9,.97,1.);',
        'vec3 c=mix(mix(pur,pink,sw),mix(cy,wh,sw2*.6),cyan);',
        'float base=exp(-h*7.)*1.3;float top=exp(-pow(acos(h)*3.,2.))*hot;',
        'float d=acos(clamp(dot(p,ripDir),-1.,1.));float rp=ripple*(exp(-pow((d-ripT)*7.,2.))+.55*exp(-pow((d-ripT*.62)*9.,2.)));',
        'float tg=touch*(exp(-d*d*9.)*(1.1+.5*sin(time*31.))+vDt*.8+exp(-d*2.2)*pow(streak,1.5)*.9);',
        'float a=(rim*.6+streak*.2+base*.08)*amt+flash*(.3+rim*.5)+rp*.6+top*.9+tg*.75;',
        'vec3 col=c*(.65+streak*.45)+wh*(flash*.6+rp*.8+tg)+vec3(1.,.25,.2)*top+vec3(1.,.55,.3)*touch*exp(-d*d*30.)*.8;',
        'gl_FragColor=vec4(col,clamp(a,0.,1.));}'
      ].join('\n')
    });
  };

  /* Tourbillon : spirale blanche qui aspire l'île. */
  L.vortexMaterial = function () {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { time: { value: 0 }, amt: { value: 0 }, core: { value: 0 }, twist: { value: 5 }, rad: { value: 1 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'varying vec2 vUv;uniform float time,amt,core,twist,rad;', NOISE,
        'void main(){vec2 p=(vUv-.5)*2./max(rad,.001);float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x);',
        'float sp=a*5.+log(r+.015)*twist+time*2.2;',
        'float bands=pow(.5+.5*sin(sp+fbm(p*3.+time*.1)*3.),10.);',
        'float fine=fbm(vec2(sp*2.6,r*40.-time*6.));float lines=pow(fine,4.)*3.;',
        'float fall=1.-smoothstep(.25,1.,r);',
        'vec3 c=mix(vec3(.55,.72,1.),vec3(1.),bands);',
        'float al=(bands*.5+lines*.5)*fall*amt*(.45+.55*smoothstep(0.,.25,r))+exp(-r*8.)*core;',
        'gl_FragColor=vec4(c,clamp(al,0.,1.));}'
      ].join('\n')
    });
  };

  /* --------------------------------------------- fumée instanciée triée */
  L.SmokeSystem = function (max, tex) {
    var geo = new T.InstancedBufferGeometry(), base = new T.PlaneGeometry(1, 1);
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    this.max = max; this.n = 0;
    this.aPos = new T.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aCol = new T.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aExt = new T.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aPos.setUsage(T.DynamicDrawUsage); this.aCol.setUsage(T.DynamicDrawUsage); this.aExt.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iCol', this.aCol); geo.setAttribute('iExt', this.aExt);
    geo.instanceCount = 0;
    this.mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { map: { value: tex }, lightCol: { value: new T.Color(1, 1, 1) }, shadeCol: { value: new T.Color(.35, .4, .55) } },
      vertexShader: [
        'attribute vec4 iPos;attribute vec4 iCol;attribute vec4 iExt;varying vec2 vUv;varying vec4 vCol;varying vec3 vExt;',
        'void main(){float c=cos(iExt.x),s=sin(iExt.x);vec2 q=vec2(c*position.x-s*position.y,s*position.x+c*position.y);',
        'vec2 cell=vec2(mod(iExt.y,2.),floor(iExt.y/2.));vUv=(uv+cell)*.5;vCol=iCol;vExt=iExt.yzw;',
        'vec4 mv=viewMatrix*vec4(iPos.xyz,1.);mv.xy+=q*iPos.w;gl_Position=projectionMatrix*mv;}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D map;uniform vec3 lightCol,shadeCol;varying vec2 vUv;varying vec4 vCol;varying vec3 vExt;',
        'void main(){vec4 t=texture2D(map,vUv);float d=t.r;if(d<.01)discard;',
        'float lit=mix(t.g,1.,vExt.y);vec3 c=vCol.rgb*mix(shadeCol,lightCol,lit)*(.85+.3*t.b);',
        'c+=vExt.z*vec3(1.,.55,.25)*(1.-t.g)*.8;',
        'gl_FragColor=vec4(c,d*vCol.a);}'
      ].join('\n')
    });
    this.mat.toneMapped = false;
    this.mesh = new T.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    this.geo = geo; this.list = [];
    for (var i = 0; i < max; i++) this.list.push({ x: 0, y: 0, z: 0, s: 1, r: 1, g: 1, b: 1, a: 0, rot: 0, v: 0, flat: 0, warm: 0, d: 0 });
  };
  L.SmokeSystem.prototype.begin = function () { this.n = 0; };
  L.SmokeSystem.prototype.add = function (x, y, z, size, r, g, b, a, rot, variant, flat, warm) {
    if (this.n >= this.max || a <= .004 || size <= 0) return;
    var q = this.list[this.n++]; q.x = x; q.y = y; q.z = z; q.s = size; q.r = r; q.g = g; q.b = b; q.a = a; q.rot = rot || 0; q.v = variant || 0; q.flat = flat || 0; q.warm = warm || 0;
  };
  L.SmokeSystem.prototype.end = function (cam) {
    var n = this.n, L2 = this.list, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, i;
    for (i = 0; i < n; i++) { var q = L2[i]; q.d = (q.x - cx) * (q.x - cx) + (q.y - cy) * (q.y - cy) + (q.z - cz) * (q.z - cz); }
    var arr = L2.slice(0, n); arr.sort(function (a, b) { return b.d - a.d; });
    var P = this.aPos.array, C = this.aCol.array, X = this.aExt.array;
    for (i = 0; i < n; i++) {
      var o = arr[i], k = i * 4;
      P[k] = o.x; P[k + 1] = o.y; P[k + 2] = o.z; P[k + 3] = o.s;
      C[k] = o.r; C[k + 1] = o.g; C[k + 2] = o.b; C[k + 3] = o.a;
      X[k] = o.rot; X[k + 1] = o.v; X[k + 2] = o.flat; X[k + 3] = o.warm;
    }
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aExt.needsUpdate = true;
    this.mesh.visible = n > 0;
  };

  /* ------------------------------------------------- traînée de fusée */
  L.Trail = function (parent, points, radius, col, core, headTex, opts) {
    opts = opts || {};
    this.curve = new T.CatmullRomCurve3(points, false, 'centripetal');
    this.mat = L.trailMaterial(col, core);
    this.mesh = new T.Mesh(L.trailGeometry(this.curve, opts.segs || 120, 8, radius), this.mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 6; parent.add(this.mesh);
    this.mat.uniforms.grow.value = opts.grow == null ? 2.2 : opts.grow;
    if (headTex) { this.head = L.sprite(parent, headTex, opts.headColor || 0xcfeeff, opts.headSize || radius * 26, true, 0); }
    if (opts.rocket) { this.rocket = opts.rocket; parent.add(this.rocket); this.rocket.visible = false; }
    this.P = new T.Vector3(); this.D = new T.Vector3();
  };
  /* k : avancement de la tête (0→1), len : longueur de queue, alpha. */
  L.Trail.prototype.set = function (k, len, alpha, time) {
    var vis = alpha > .003 && k > 0;
    this.mesh.visible = vis;
    var u = this.mat.uniforms; u.head.value = k; u.len.value = len; u.alpha.value = alpha; u.time.value = time || 0;
    var flying = vis && k > 0 && k < 1;
    if (this.head) { if (flying) { this.curve.getPointAt(Math.min(1, k), this.head.position); L.setOp(this.head, alpha); } else L.setOp(this.head, 0); }
    if (this.rocket) {
      this.rocket.visible = flying;
      if (flying) {
        this.curve.getPointAt(Math.min(1, k), this.rocket.position);
        this.curve.getTangentAt(Math.min(1, k), this.D);
        this.rocket.quaternion.setFromUnitVectors(UP, this.D.normalize());
        var rf = this.rocket.userData.flame; if (rf && rf.material.uniforms) { rf.material.uniforms.time.value = time || 0; rf.material.uniforms.amt.value = alpha; }
      }
    }
    // v85 : décalage d'ensemble (la cage de la capture suit la météorite qui descend)
    if (this.off) { this.mesh.position.copy(this.off); if (this.head && this.head.visible) this.head.position.add(this.off); if (this.rocket && this.rocket.visible) this.rocket.position.add(this.off); }
  };
  var UP = new T.Vector3(0, 1, 0);
  L.UP = UP;

  /* Petite fusée des failles (blanche, propulseur bleu). */
  L.riftRocket = function (scale) {
    var g = new T.Group(), white = new T.MeshStandardMaterial({ color: 0xe9eef5, roughness: .45, metalness: .25, emissive: 0x223044, emissiveIntensity: .6 }),
      dark = new T.MeshStandardMaterial({ color: 0x2b3448, roughness: .6 });
    var body = new T.Mesh(new T.CylinderGeometry(1, 1.15, 9, 14), white); body.position.y = 0; g.add(body);
    var nose = new T.Mesh(new T.ConeGeometry(1, 3.2, 14), white); nose.position.y = 6.1; g.add(nose);
    var band = new T.Mesh(new T.CylinderGeometry(1.05, 1.05, .8, 14), dark); band.position.y = 2.6; g.add(band);
    for (var k = 0; k < 4; k++) { var fin = new T.Mesh(new T.BoxGeometry(.16, 2.6, 1.7), dark); fin.position.set(Math.cos(k * Math.PI / 2) * 1.3, -3.6, Math.sin(k * Math.PI / 2) * 1.3); fin.rotation.y = -k * Math.PI / 2; g.add(fin); }
    var flame = new T.Mesh(new T.ConeGeometry(.9, 5, 12, 1, true), new T.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    flame.rotation.x = Math.PI; flame.position.y = -7; g.add(flame);
    g.scale.setScalar(scale || 1); return g;
  };

  /* ----------------------------------------------------- halo (bloom) */
  L.Post = function (renderer, light) {
    var gl2 = renderer.capabilities && renderer.capabilities.isWebGL2;
    var opt = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true };
    if (gl2 && !light) opt.samples = 4; // v85 : version légère (mobile / qualité basse) sans multi-échantillonnage
    this.r = renderer;
    this.rt = new T.WebGLRenderTarget(4, 4, opt); this.rt.isXRRenderTarget = true; this.rt.texture.colorSpace = T.SRGBColorSpace;
    var o2 = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false };
    this.a = new T.WebGLRenderTarget(4, 4, o2); this.b = new T.WebGLRenderTarget(4, 4, o2);
    this.c = new T.WebGLRenderTarget(4, 4, o2); this.d = new T.WebGLRenderTarget(4, 4, o2);
    var vs = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    this.bright = new T.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tex: { value: null }, thr: { value: .84 }, soft: { value: .22 } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D tex;uniform float thr,soft;varying vec2 vUv;void main(){vec3 c=texture2D(tex,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=smoothstep(thr-soft,thr+soft,l);gl_FragColor=vec4(c*k,1.);}' });
    this.blur = new T.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tex: { value: null }, dir: { value: new T.Vector2() } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D tex;uniform vec2 dir;varying vec2 vUv;void main(){vec3 s=texture2D(tex,vUv).rgb*.2270;s+=texture2D(tex,vUv+dir*1.3846).rgb*.3162;s+=texture2D(tex,vUv-dir*1.3846).rgb*.3162;s+=texture2D(tex,vUv+dir*3.2308).rgb*.0703;s+=texture2D(tex,vUv-dir*3.2308).rgb*.0703;gl_FragColor=vec4(s,1.);}' });
    this.comp = new T.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { base: { value: null }, b1: { value: null }, b2: { value: null }, strength: { value: .9 }, wide: { value: .6 }, warp: { value: 0 }, warpC: { value: new T.Vector2(.5, .5) }, time: { value: 0 }, vig: { value: .25 }, aspect: { value: 1 }, grade: { value: 0 }, squash: { value: 0 } },
      vertexShader: vs,
      fragmentShader: [
        'uniform sampler2D base,b1,b2;uniform float strength,wide,warp,time,vig,aspect,grade,squash;uniform vec2 warpC;varying vec2 vUv;', NOISE,
        'void main(){vec2 uv=vUv;float band=1.;',
        /* fin : l'île s'écrase en une ligne lumineuse (vidéo 252,5 → 254,5) */
        'if(squash>.001){float k=max(1.-squash,.012);uv.y=warpC.y+(vUv.y-warpC.y)/k;band=smoothstep(-.12,.02,uv.y)*smoothstep(1.12,.98,uv.y);uv=clamp(uv,0.,1.);}',
        'vec3 c=texture2D(base,uv).rgb;vec3 bl=texture2D(b1,uv).rgb*strength+texture2D(b2,uv).rgb*wide;c+=bl;c=mix(vec3(.006,.012,.035),c,band);',
        /* étalonnage espace : île désaturée, bleutée, plus sombre */
        'if(grade>.001){float l=dot(c,vec3(.299,.587,.114));vec3 g2=mix(vec3(l),c,.55)*vec3(.80,.92,1.18)*.86;c=mix(c,g2,grade);}',
        'if(squash>.001){vec2 dq=vUv-warpC;dq.x*=aspect;float ln=exp(-abs(dq.y)*90./(1.+squash*2.))*exp(-abs(dq.x)*2.2);c+=vec3(.75,.9,1.)*ln*squash*1.2;c+=vec3(.9,.97,1.)*exp(-length(dq)*28.)*squash*1.6;}',
        'if(warp>.001){vec2 d=vUv-warpC;d.x*=aspect;float r=length(d);float a=atan(d.y,d.x);',
        ' float s=pow(vn(vec2(a*60.,0.)),8.)*2.+pow(vn(vec2(a*23.+7.,1.)),10.)*2.;',
        ' float mov=fract(r*1.6-time*1.8+vn(vec2(a*60.,3.)));',
        ' float streak=s*smoothstep(.05,.25,r)*smoothstep(.0,.35,mov)*(1.-smoothstep(.6,1.,mov));',
        ' vec3 sc=mix(vec3(.55,.8,1.),vec3(1.,.35,.95),step(.82,vn(vec2(a*60.,9.))));',
        ' c+=sc*streak*warp;}',
        'vec2 q=vUv-.5;c*=1.-vig*dot(q,q)*1.6;',
        'gl_FragColor=vec4(c,1.);}'
      ].join('\n') });
    this.comp.toneMapped = false; this.bright.toneMapped = false; this.blur.toneMapped = false;
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.bright); this.quad.frustumCulled = false;
    this.scene = new T.Scene(); this.scene.add(this.quad); this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = new T.Vector2(); this.failed = false;
  };
  L.Post.prototype.pass = function (inner, mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); inner.call(this.r, this.scene, this.cam); };
  L.Post.prototype.render = function (inner, scene, camera) {
    var r = this.r; r.getDrawingBufferSize(this.size);
    var w = Math.max(4, this.size.x | 0), h = Math.max(4, this.size.y | 0);
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.setSize(w, h);
      var qw = Math.max(4, w >> 2), qh = Math.max(4, h >> 2); this.a.setSize(qw, qh); this.b.setSize(qw, qh);
      var ew = Math.max(4, w >> 3), eh = Math.max(4, h >> 3); this.c.setSize(ew, eh); this.d.setSize(ew, eh);
    }
    var prev = r.getRenderTarget();
    r.setRenderTarget(this.rt); inner.call(r, scene, camera);
    this.bright.uniforms.tex.value = this.rt.texture; this.pass(inner, this.bright, this.a);
    var B = this.blur.uniforms;
    B.tex.value = this.a.texture; B.dir.value.set(1 / this.a.width, 0); this.pass(inner, this.blur, this.b);
    B.tex.value = this.b.texture; B.dir.value.set(0, 1 / this.a.height); this.pass(inner, this.blur, this.a);
    B.tex.value = this.a.texture; B.dir.value.set(1 / this.c.width, 0); this.pass(inner, this.blur, this.c);
    B.tex.value = this.c.texture; B.dir.value.set(0, 1 / this.c.height); this.pass(inner, this.blur, this.d);
    B.tex.value = this.d.texture; B.dir.value.set(2 / this.c.width, 0); this.pass(inner, this.blur, this.c);
    B.tex.value = this.c.texture; B.dir.value.set(0, 2 / this.c.height); this.pass(inner, this.blur, this.d);
    var C = this.comp.uniforms; C.base.value = this.rt.texture; C.b1.value = this.a.texture; C.b2.value = this.d.texture; C.aspect.value = w / h;
    this.pass(inner, this.comp, prev);
  };
  L.Post.prototype.dispose = function () { [this.rt, this.a, this.b, this.c, this.d].forEach(function (t) { t.dispose(); }); };
})(window);
