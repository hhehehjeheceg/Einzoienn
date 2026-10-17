/* AZUR v93 — event-v93-rifts.js : les failles de « La Fin » redessinées d'après la vidéo de référence du 17/10.
 * Remplace les textures des grandes failles fabriquées par AZEnd81.makeTextures (event-end81-lib.js) :
 *  - burstBig : l'énorme éclosion de 41-42 s — fond de sphère bleue, des centaines de traits bleus
 *    pointillés qui rayonnent comme un pissenlit, longs éclairs blancs et violets qui dépassent, cœur blanc ;
 *  - shell    : la sphère bleue translucide derrière l'éclosion ;
 *  - ring     : le portail de 43-46 s et l'arc-en-ciel de 85 s — anneau bleu saturé, bord intérieur cyan,
 *    franges vert / jaune / rose, centre sombre où l'on voit la fissure ;
 *  - crack    : la fissure blanche au centre des portails (85-86 s) — éclats pointus et éclairs fins.
 * Les failles « étoile » (shader riftMaterial) gagnent des rayons fins et droits comme à 113 s.
 * Les sprites qui teintaient ces textures en bleu passent en blanc : les couleurs sont dans les textures. */
(function (root) {
  "use strict";
  var T = root.THREE, L = root.AZEnd81, E = root.AZEvent;
  if (!T || !L || !L.makeTextures || L.__v93rifts) return;
  L.__v93rifts = true;
  var rng = L.u.rng;

  function draw(S, fn) {
    var c = document.createElement("canvas"); c.width = c.height = S;
    fn(c.getContext("2d"), S);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t;
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (+a).toFixed(3) + ")"; }
  function blob(g, x, y, s, c, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s);
  }
  // éclair dentelé avec halo, et ramifications
  function bolt(g, x, y, a, len, w, purple, R, depth) {
    var n = 16, pts = [[x, y]], drift = (R() - .5) * .25;
    for (var i = 1; i <= n; i++) {
      var u = i / n, d = len * u, off = (R() - .5) * len * .07 + Math.sin(u * 3.1) * drift * len * .1;
      pts.push([x + Math.cos(a) * d - Math.sin(a) * off, y + Math.sin(a) * d + Math.cos(a) * off]);
    }
    var glow = purple ? [215, 140, 255] : [140, 195, 255];
    [[w * 6, .08, glow], [w * 2.6, .32, glow], [w, .95, [255, 255, 255]]].forEach(function (s) {
      g.strokeStyle = rgba(s[2], s[1]); g.lineWidth = s[0]; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
    });
    if (depth > 0) for (var k = 0; k < 2; k++) {
      var p = pts[3 + ((R() * (n - 6)) | 0)];
      bolt(g, p[0], p[1], a + (R() - .5) * 1.5, len * (.22 + R() * .3), w * .6, purple, R, depth - 1);
    }
  }

  // 41-42 s : l'éclosion « pissenlit »
  function dandelion(seed, S) {
    return draw(S, function (g) {
      var R = rng(seed), c = S / 2, px = S / 1024;
      g.globalCompositeOperation = "lighter";
      // sphère bleue à bord net (vidéo 42 s), un peu plus claire au bord
      var sg = g.createRadialGradient(c, c, 0, c, c, c * .9);
      sg.addColorStop(0, "rgba(70,140,255,.5)"); sg.addColorStop(.75, "rgba(45,105,250,.42)"); sg.addColorStop(.93, "rgba(70,135,255,.5)"); sg.addColorStop(1, "rgba(40,90,240,0)");
      g.fillStyle = sg; g.fillRect(0, 0, S, S);
      g.lineCap = "round";
      for (var i = 0; i < 380; i++) {
        var a = R() * 6.2832, r0 = (.05 + R() * .3) * c, r1 = (.48 + R() * .46) * c, w = (.8 + R() * 2.6) * px;
        var col = R() < .72 ? [90 + R() * 90 | 0, 160 + R() * 80 | 0, 255] : [215, 240, 255];
        var rr = r0, ang = a;
        while (rr < r1) {
          var dl = (.012 + R() * .055) * c, gap = (.004 + R() * .028) * c; ang += (R() - .5) * .02;
          g.strokeStyle = rgba(col, (.22 + .6 * R()) * (1 - rr / c * .55)); g.lineWidth = w * (1 - rr / c * .45);
          g.beginPath(); g.moveTo(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr); g.lineTo(c + Math.cos(ang) * (rr + dl), c + Math.sin(ang) * (rr + dl)); g.stroke();
          rr += dl + gap;
        }
      }
      // éclats bleus déchiquetés dans la couronne (les « taches » de la vidéo)
      for (var j = 0; j < 140; j++) { var aj = R() * 6.2832, rj = (.45 + R() * .45) * c; blob(g, c + Math.cos(aj) * rj, c + Math.sin(aj) * rj, (.012 + R() * .03) * c, [80, 150, 255], .35 + R() * .3); }
      for (var b = 0; b < 14; b++) bolt(g, c, c, b / 14 * 6.2832 + (R() - .5) * .4, (.55 + R() * .44) * c, (2.2 + R() * 3) * px, R() < .38, R, 2);
      blob(g, c, c, c * .13, [235, 248, 255], .85);
      blob(g, c, c, c * .05, [255, 255, 255], 1);
    });
  }
  // la sphère bleue translucide derrière l'éclosion
  function shell(seed, S) {
    return draw(S, function (g) {
      var R = rng(seed), c = S / 2;
      g.globalCompositeOperation = "lighter";
      var gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, "rgba(70,130,255,.34)"); gr.addColorStop(.6, "rgba(45,95,240,.26)"); gr.addColorStop(.87, "rgba(70,130,255,.34)");
      gr.addColorStop(.95, "rgba(40,90,230,.1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      for (var i = 0; i < 170; i++) { var a = R() * 6.2832, rr = Math.sqrt(R()) * c * .9; blob(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr, (.02 + R() * .06) * c, [90, 160, 255], .06 + R() * .12); }
    });
  }
  // 43-46 s et 85 s : le portail — petit trou sombre au centre (≈ 30 % du rayon), anneau bleu épais et flou,
  // bord intérieur cyan, franges vert / jaune / rose, grand halo bleu
  function ring(seed, S) {
    return draw(S, function (g) {
      var R = rng(seed), c = S / 2;
      var d = g.createRadialGradient(c, c, 0, c, c, c * .34);
      d.addColorStop(0, "rgba(10,14,48,.55)"); d.addColorStop(.75, "rgba(8,12,44,.6)"); d.addColorStop(1, "rgba(8,12,44,0)");
      g.fillStyle = d; g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = "lighter";
      function band(r0, r1, col, a) {
        var gr = g.createRadialGradient(c, c, r0 * c, c, c, r1 * c);
        gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
      }
      band(.2, 1, [40, 90, 255], .3);
      band(.24, .64, [30, 105, 255], .95);
      band(.25, .4, [140, 225, 255], .8);
      band(.5, .7, [80, 255, 190], .4);
      band(.58, .8, [255, 230, 120], .34);
      band(.68, .9, [255, 110, 220], .38);
      for (var i = 0; i < 260; i++) { var a = R() * 6.2832, rr = (.28 + R() * .32) * c; blob(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr, (.02 + R() * .06) * c, [70, 160, 255], .12 + R() * .28); }
      // fissure de lumière au fond du trou
      for (var b = 0; b < 5; b++) bolt(g, c, c, R() * 6.2832, (.12 + R() * .2) * c, 1.3 * S / 1024, R() < .3, R, 1);
      blob(g, c, c, c * .05, [220, 240, 255], .8);
    });
  }
  // 85-86 s : la fissure blanche (éclats pointus) au cœur des portails
  function crack(seed, S) {
    return draw(S, function (g) {
      var R = rng(seed), c = S / 2;
      g.globalCompositeOperation = "lighter";
      blob(g, c, c, c * .18, [255, 175, 235], .45);
      blob(g, c, c, c * .05, [255, 245, 255], 1);
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * 6.2832 + (R() - .5) * .5, len = (.32 + R() * .64) * c, w = (.012 + R() * .03) * c, m = .3 + R() * .35;
        var sh = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
        sh.addColorStop(0, "rgba(255,255,255,.95)"); sh.addColorStop(.6, "rgba(228,218,255,.6)"); sh.addColorStop(1, "rgba(200,190,255,0)");
        g.fillStyle = sh; g.beginPath();
        g.moveTo(c + Math.cos(a + 1.57) * w, c + Math.sin(a + 1.57) * w);
        g.lineTo(c + Math.cos(a) * len * m + Math.cos(a + 1.57) * w * .7, c + Math.sin(a) * len * m + Math.sin(a + 1.57) * w * .7);
        g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
        g.lineTo(c + Math.cos(a - 1.57) * w, c + Math.sin(a - 1.57) * w);
        g.closePath(); g.fill();
      }
      for (var b = 0; b < 7; b++) bolt(g, c, c, R() * 6.2832, (.3 + R() * .55) * c, 1.6 * S / 1024, R() < .4, R, 1);
    });
  }

  var prevMake = L.makeTextures;
  L.makeTextures = function (low) {
    var X = prevMake.apply(this, arguments), S = low ? 512 : 1024;
    try {
      X.burstBig = [dandelion(71, S), dandelion(83, S)];
      X.shell = [shell(51, S >> 1), shell(63, S >> 1)];
      X.ring = ring(97, S);
      X.crack = [crack(7, S >> 1), crack(13, S >> 1)];
    } catch (e) { console.warn("[AZUR v93 failles] textures", e); }
    return X;
  };

  // failles « étoile » : rayons fins et droits + scintillement (vidéo 113 s), et un peu plus lumineuses
  var prevRift = L.riftMaterial;
  L.riftMaterial = function () {
    var m = prevRift.apply(this, arguments);
    var a = " col=col*amt+vec3(.9,.97,1.)*flash*exp(-r*5.)*1.6;";
    m.fragmentShader = m.fragmentShader.replace("float core=exp(-r*58.)*3.2+exp(-r*16.)*.75;", "float core=exp(-r*72.)*2.6+exp(-r*24.)*.3;"); // petit cœur net (vidéo)
    if (m.fragmentShader.indexOf(a) >= 0) {
      m.fragmentShader = m.fragmentShader.replace(a,
        " float rays=pow(vn(vec2(a*42.+seed*5.,seed)),9.)*exp(-r*1.9)*(1.-smoothstep(.55,.95,r/mix(.35,1.,open)));" +
        " col+=vec3(.78,.92,1.)*rays*2.2;" +
        a);
    }
    return m;
  };

  // les sprites teintés en bleu passent en blanc (la couleur est maintenant dans la texture)
  function untint(O) {
    ["b1Bolts", "b1Shell", "ringA", "ringB", "b3Crack", "b2Crack"].forEach(function (k) {
      var s = O[k]; if (s && s.material && s.material.color) s.material.color.setHex(0xffffff);
    });
  }
  var M = E && E.mods && E.mods.end81;
  if (M && M.init && !M.__v93rifts) {
    M.__v93rifts = true;
    var prevInit = M.init;
    M.init = function () { var r = prevInit.apply(this, arguments); try { if (E.end81 && E.end81.O) untint(E.end81.O); } catch (e) {} return r; };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
