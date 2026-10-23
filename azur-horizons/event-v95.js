/* AZUR v95 — event-v95.js : le joueur dans « La Fin », version Saison X.
 *  - La météorite est SOLIDE : on peut se poser dessus (comme sur la vraie météorite figée de la saison),
 *    on ne la traverse plus à pied, en planant ou en lévitation ; si elle glisse sur le joueur, elle le pousse.
 *    Pareil pour la météorite de la fin qui plonge dans le Point Zéro.
 *  - Réactions du personnage : sursaut aux grands éclats quand il est au sol et immobile, coup de souffle quand
 *    une onde de choc passe sur lui (petit saut, recul), bras et jambes qui battent l'air quand l'onde du Point
 *    Zéro l'arrache du sol, culbutes dans le tourbillon. Les poses sont lues par ch1-models-v93.js (E.v95.pose).
 * Enrobe le module play81 (comme event-v93.js). À charger après event-v93.js. */
(function (root) {
  "use strict";
  /* v95b — FORME EXACTE d'une roche pour les collisions : pour 24 × 48 directions autour du centre, le rayon
   * de la surface (le plus grand sommet du maillage dans cette direction). On marche sur la vraie surface et on
   * bute contre elle, au lieu d'un ovale plus petit que la roche (on s'enfonçait dedans, sur un sol invisible). */
  var NT = 24, NP = 48;
  function RockShape(offsets) {
    var b = new Float32Array(NT * NP), i, j, k, mx = 0;
    for (k = 0; k < offsets.length; k++) {
      var o = offsets[k], r = Math.hypot(o[0], o[1], o[2]); if (r < 1e-6) continue;
      var th = Math.acos(Math.max(-1, Math.min(1, o[1] / r))), ph = Math.atan2(o[2], o[0]);
      i = Math.min(NT - 1, Math.floor(th / Math.PI * NT)); j = Math.min(NP - 1, Math.floor((ph + Math.PI) / (2 * Math.PI) * NP));
      if (r > b[i * NP + j]) b[i * NP + j] = r; if (r > mx) mx = r;
    }
    for (var pass = 0; pass < 6; pass++) { var hole = false; for (i = 0; i < NT; i++) for (j = 0; j < NP; j++) { if (b[i * NP + j] > 0) continue; hole = true; var s = 0, n = 0; for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) { var ii = Math.max(0, Math.min(NT - 1, i + di)), jj = (j + dj + NP) % NP, v = b[ii * NP + jj]; if (v > 0) { s += v; n++; } } if (n) b[i * NP + j] = s / n; } if (!hole) break; }
    this.b = b; this.max = mx;
  }
  RockShape.prototype.R = function (dx, dy, dz) {
    var r = Math.hypot(dx, dy, dz); if (r < 1e-6) return this.max;
    var th = Math.acos(Math.max(-1, Math.min(1, dy / r))) / Math.PI * NT - .5, ph = (Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * NP - .5;
    var i0 = Math.floor(th), j0 = Math.floor(ph), u = th - i0, v = ph - j0, b = this.b;
    var at = function (i, j) { return b[Math.max(0, Math.min(NT - 1, i)) * NP + ((j % NP) + NP) % NP]; };
    return (at(i0, j0) * (1 - v) + at(i0, j0 + 1) * v) * (1 - u) + (at(i0 + 1, j0) * (1 - v) + at(i0 + 1, j0 + 1) * v) * u;
  };
  RockShape.prototype.inside = function (dx, dy, dz, m) { return Math.hypot(dx, dy, dz) < this.R(dx, dy, dz) + (m || 0); };
  // hauteur du dessus de la roche à la verticale de (dx, dz), ou null
  RockShape.prototype.top = function (dx, dz) {
    if (Math.hypot(dx, dz) >= this.max) return null;
    var y = this.max, step = Math.max(.12, this.max / 60);
    for (; y > -this.max; y -= step) if (this.inside(dx, y, dz, 0)) { var lo = y, hi = y + step; for (var k = 0; k < 6; k++) { var mid = (lo + hi) / 2; if (this.inside(dx, mid, dz, 0)) lo = mid; else hi = mid; } return lo; }
    return null;
  };
  // décalages des sommets d'un maillage par rapport au centre de son groupe (matrice locale × échelle du groupe)
  RockShape.fromMesh = function (mesh, pre) {
    var T = root.THREE, g = mesh.geometry, pa = g && g.attributes && g.attributes.position; if (!T || !pa) return null;
    mesh.updateMatrix(); var m = mesh.matrix.clone(); if (pre) m.premultiply(pre);
    var v = new T.Vector3(), out = [], step = Math.max(1, Math.floor(pa.count / 6000));
    for (var k = 0; k < pa.count; k += step) { v.fromBufferAttribute(pa, k).applyMatrix4(m); out.push([v.x, v.y, v.z]); }
    return new RockShape(out);
  };
  // collisions communes (événement et météorite figée) : sol, obstacle, sortie si la roche recouvre le joueur
  RockShape.prototype.support = function (c, x, z, cy) { var t = this.top(x - c.x, z - c.z); if (t == null) return null; t += c.y; return cy == null || cy > t - 4 ? t : null; };
  RockShape.prototype.blocks = function (c, x, z, r, y) {
    if (Math.hypot(x - c.x, z - c.z) > this.max + (r || .45)) return false;
    var t = this.top(x - c.x, z - c.z); if (t != null && y >= c.y + t - .35) return false; // debout dessus
    var hs = [.25, .9, 1.55]; for (var k = 0; k < 3; k++) if (this.inside(x - c.x, y + hs[k] - c.y, z - c.z, (r || .45) * .8)) return true;
    return false;
  };
  RockShape.prototype.pushOut = function (c, p, floating) {
    var dx = p.x - c.x, dy = p.y + .9 - c.y, dz = p.z - c.z; if (!this.inside(dx, dy, dz, .35)) return false;
    var t = this.top(dx, dz);
    if (t != null && dy > 0) { p.y = c.y + t; if (!floating) { p.grounded = true; p._vy = 0; } return true; } // par-dessus si on est dans la moitié haute
    var r = Math.hypot(dx, dz) || 1, R = this.R(dx, 0, dz) + .6; p.x = c.x + dx / r * R; p.z = c.z + dz / r * R; p._lastX = p.x; p._lastZ = p.z; return true;
  };
  root.AZRockShape = RockShape;
  var E = root.AZEvent;
  if (!E || !E.mods || !E.mods.play81 || E.mods.play81.__v95) return;
  var M = E.mods.play81;
  M.__v95 = true;
  var V = (E.v95 = { pose: null, poseT: 0, hop: -99 });
  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  function H(x, z) { try { return root.AZSim.heightAt(x, z); } catch (e) { return 0; } }
  function me() { var g = root.AZUR, w = g && g.world; return w ? w.players.find(function (q) { return q.id === g.myId; }) : null; }

  /* ------------------------------------------------------------ météorite solide */
  // ellipsoïde : rayon horizontal Re, demi-hauteur .85 Re (la roche est aplatie)
  var SHAPE = null, SHAPE_OF = null;
  function shape() {
    var O = E.end81 && E.end81.O, M1 = O && O.met; if (!M1 || !M1.rock) return null;
    if (SHAPE_OF !== M1.rock) { var T = root.THREE; SHAPE_OF = M1.rock; SHAPE = RockShape.fromMesh(M1.rock, new T.Matrix4().makeScale(M1.g.scale.x, M1.g.scale.y, M1.g.scale.z)); }
    return SHAPE;
  }
  function rock() {
    if (!E.active || !E.meteorVisible || !E.meteorPos) return null;
    var t = VT(), r = t < 170 ? (E.meteorRadius || 9) : 21, sh = t < 170 ? shape() : null;
    return { x: E.meteorPos.x, y: E.meteorPos.y, z: E.meteorPos.z, Re: r * .95, Hy: r * .95 * .85, sh: sh };
  }
  function topAt(c, d) { return d >= c.Re ? null : c.y + c.Hy * Math.sqrt(1 - (d / c.Re) * (d / c.Re)); }
  var hook = null;
  function install() {
    var Wp = root.AZSim && root.AZSim.World && root.AZSim.World.prototype;
    if (!Wp || hook || !Wp.supportAt || !Wp._blocked) return;
    var sup = Wp.supportAt, blk = Wp._blocked;
    var mySup = function (x, z, cy) {
      var best = sup.apply(this, arguments);
      try {
        var c = rock(); if (!c) return best;
        if (c.sh) { var ts = c.sh.support(c, x, z, cy); return ts != null && ts > best ? ts : best; }
        var top = topAt(c, Math.hypot(x - c.x, z - c.z));
        if (top != null && top > best && (cy == null || cy > top - 4)) best = top;
      } catch (e) {}
      return best;
    };
    var myBlk = function (x, z, r, y) {
      if (blk.apply(this, arguments)) return true;
      try {
        var c = rock(); if (!c || y == null) return false;
        if (c.sh) return c.sh.blocks(c, x, z, r, y);
        var d = Math.hypot(x - c.x, z - c.z), rr = r || .45; if (d > c.Re + rr) return false;
        var dd = Math.min(d, c.Re - 1e-3), h = c.Hy * Math.sqrt(1 - (dd / c.Re) * (dd / c.Re)), top = c.y + h, bot = c.y - h;
        return y < top - .35 && y + 1.7 > bot;
      } catch (e) { return false; }
    };
    Wp.supportAt = mySup; Wp._blocked = myBlk; hook = { Wp: Wp, sup: sup, blk: blk, mySup: mySup, myBlk: myBlk };
  }
  function uninstall() {
    if (!hook) return; var Wp = hook.Wp;
    if (Wp.supportAt === hook.mySup) Wp.supportAt = hook.sup; if (Wp._blocked === hook.myBlk) Wp._blocked = hook.blk;
    hook = null;
  }
  // si la roche (qui bouge) recouvre le joueur, on le sort par le chemin le plus court
  function pushOut(p) {
    var c = rock(); if (!c || !p || RIDE.phase) return;
    if (c.sh) { c.sh.pushOut(c, p, !!p._eventFloat); return; }
    var cx = p.x - c.x, cy = (p.y + .9) - c.y, cz = p.z - c.z, ex = c.Re + .45, ey = c.Hy + .9;
    var n = Math.sqrt((cx * cx + cz * cz) / (ex * ex) + (cy * cy) / (ey * ey));
    if (n >= 1 || n < 1e-4) return;
    var k = 1 / n;
    p.x = c.x + cx * k; p.z = c.z + cz * k; var ny = c.y + cy * k - .9;
    if (cy > 0) { p.y = Math.max(p.y, ny); if (!p._eventFloat) { p.grounded = true; p._vy = 0; } } else p.y = Math.min(p.y, ny);
    p._lastX = p.x; p._lastZ = p.z;
  }

  /* ---------------------------------------------------------------- réactions */
  var GASP = [[38.7, 40.3], [62.4, 63.4], [75.9, 77.4], [110.95, 112.2], [152.9, 154.6], [155.45, 156.8], [183.05, 183.5], [223.35, 224.2]];
  function pose(p, t, dt) {
    var info = E.playerInfo || {}, mode = info.mode || "none", inp = p._input || {}, idle = Math.abs(+inp.moveX || 0) + Math.abs(+inp.moveZ || 0) < .05;
    var next = null;
    if (RIDE.phase === "thrown") next = "fall";
    else if (mode === "zeroshock" || mode === "blast") next = "fall";
    else if (mode === "suck") next = "tumble";
    else if (p.grounded && !(p.emote > 0)) {
      // le souffle d'une onde qui passe : petit saut et recul (jamais quand on chevauche la météorite)
      if ((E.shake || 0) > .42 && t - V.hop > 2.5 && mode === "none" && !RIDE.phase) {
        V.hop = t; p.grounded = false; p.jumping = true; p._vy = 5.5;
        var c = E.rc, dx = c ? p.x - c.x : 0, dz = c ? p.z - c.z : 0, dl = Math.hypot(dx, dz) || 1;
        p._vx = (p._vx || 0) + dx / dl * 4; p._vz = (p._vz || 0) + dz / dl * 4;
      }
      if (t - V.hop < .5) next = "hit";
      else if (idle) for (var i = 0; i < GASP.length; i++) if (t > GASP[i][0] && t < GASP[i][1]) { next = "surprise"; break; }
    }
    if (next !== V.pose) { V.pose = next; V.poseT = 0; } else V.poseT += dt;
  }

  /* ------------------------------------------- v96 : le voyage avec la météorite */
  /* Debout sur la météorite quand les fusées la poussent (124 → 153 s), on RESTE dessus : elle nous emporte
   * (plus d'éjection) et l'on peut toujours marcher, sauter ou faire une emote sur la roche. Quand elle plonge
   * dans la faille (153 s), on passe avec elle dans le MONDE DES FAILLES : un puits violet et bleu, fissures
   * lumineuses, traits de vitesse, débris qui filent, la roche qui tombe sous nos pieds vers une lumière.
   * On en ressort par l'étoile du zénith (192,6 s) toujours sur la météorite, qui plonge alors sur le dôme du
   * Point Zéro ; au choc (216,2 s) on est projeté en l'air, puis la fin reprend comme pour tout le monde
   * (souffle 224 s, dérive, tourbillon). Le joueur est porté dans le repère de la roche : position = centre de
   * la roche + décalage que les commandes déplacent, posé sur la vraie surface (RockShape). */
  function cl01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function rmp(t, a, b) { return cl01((t - a) / (b - a)); }
  var RIDE = { phase: null, ox: 0, oz: 0, oy: 0, vy: 0, cx: 0, cy: 0, cz: 0, hasC: false, hx: 0, hz: 0 };
  var V6 = (E.v96 = { phase: null, m2: false, flash: 0 });
  var M2SHAPE = null, M2SHAPE_OF = null, W = null, RW = null, FLASH = null, GRP_HIDDEN = null;
  var _c = null;
  function shape2() { // la météorite de la fin, rayon 22 et rotation nulle (figée pendant qu'on la chevauche)
    var O = E.end81 && E.end81.O, M2 = O && O.met2; if (!M2 || !M2.rock) return null;
    if (M2SHAPE_OF !== M2.rock) {
      var pa = M2.rock.geometry.attributes.position, out = [], step = Math.max(1, Math.floor(pa.count / 6000));
      for (var k = 0; k < pa.count; k += step) out.push([pa.getX(k) * 22, pa.getY(k) * 22, pa.getZ(k) * 22]);
      M2SHAPE = new RockShape(out); M2SHAPE_OF = M2.rock;
    }
    return M2SHAPE;
  }
  // centre, forme et échelle de la roche qui nous porte selon la phase
  function frame(ph, t) {
    var en = E.end81; if (!en) return null;
    if (!_c) _c = new root.THREE.Vector3();
    if (ph === "m1") { var s1 = shape(); if (!s1 || !en.meteorPos) return null; en.meteorPos(t, _c); return { c: _c, sh: s1, k: 1 }; }
    if (ph === "rift") { var s2 = shape(); if (!s2 || !W) return null; _c.copy(W); return { c: _c, sh: s2, k: 1 }; }
    if (ph === "m2") { var s3 = shape2(); if (!s3 || !en.met2Pos) return null; en.met2Pos(t, _c); return { c: _c, sh: s3, k: Math.max(.35, rmp(t, 192.6, 194.5)) }; }
    return null;
  }
  function surf(f, ox, oz) { var h = f.sh.top(ox / f.k, oz / f.k); return h == null ? null : h * f.k; }
  function isMe(p) { var g = root.AZUR; return !!(g && p && p.id === g.myId); }

  /* ---- le monde des failles : un puits fermé autour de la roche (rien du reste du monde n'y est visible) */
  var RW_VS = "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
  var RW_FS = [
    "varying vec3 vD;uniform float time,exitK,enterK,rush;",
    "float hs(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float ns(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "float fb(vec3 p){return .57*ns(p)+.28*ns(p*2.07)+.14*ns(p*4.31);}",
    "void main(){vec3 d=normalize(vD);float a=atan(d.z,d.x),h=d.y,ca=cos(a),sa=sin(a);",
    // le puits défile vers le haut : on tombe vers la sortie (en bas)
    " float fl=time*(.22+1.3*rush);",
    " float n=fb(vec3(ca*1.6,sa*1.6,h*2.6+fl));",
    " float n2=fb(vec3(ca*4.+n*1.4,sa*4.,h*6.+fl*1.6));",
    " vec3 c=mix(vec3(.035,.008,.09),vec3(.30,.07,.50),smoothstep(.25,.85,n));",
    " c=mix(c,vec3(.10,.22,.85),smoothstep(.5,.85,n2)*.65);",
    " c+=vec3(.85,.25,.75)*smoothstep(.62,.9,fb(vec3(ca*2.5,sa*2.5,h*3.5-fl*.7)))*.35;",
    // fissures lumineuses : les bords des failles, bleu-blanc
    " float seam=pow(1.-smoothstep(0.,.045,abs(n2-.52)),3.);c+=vec3(.55,.82,1.)*seam*(.7+.5*sin(time*3.+a*5.));",
    // traits de vitesse
    " float u=(a+3.14159)*26.,ln=floor(u),lh=fract(sin(ln*91.7)*4375.5);",
    " float sk=pow(1.-abs(fract(u)*2.-1.),7.)*step(.5,lh)*smoothstep(.55,1.,fract(h*1.6+time*(.5+lh)*(1.+3.*rush)+lh));",
    " c+=vec3(.75,.6,1.)*sk*(.25+1.1*rush)*(1.-abs(h)*.6);",
    // lumière de la sortie (en bas) et trace de l'entrée (en haut)
    " float dn=max(0.,-h),up=max(0.,h);",
    " c+=vec3(.55,.75,1.)*pow(dn,6.)*(.35+2.2*exitK)+vec3(1.)*pow(dn,30.)*exitK*5.;",
    " c+=vec3(.75,.45,1.)*pow(up,10.)*enterK*2.5;",
    " gl_FragColor=vec4(c,1.);}"
  ].join("\n");
  function glowTex() {
    var cv = document.createElement("canvas"); cv.width = cv.height = 128; var x = cv.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); var t = new root.THREE.CanvasTexture(cv); return t;
  }
  function buildRift() {
    var T = root.THREE, g = root.AZUR, sc = g && g.view && g.view.scene, O = E.end81 && E.end81.O, M1 = O && O.met;
    if (!T || !sc || !M1 || !M1.rock) return null;
    var R = { g: new T.Group(), keep: [] }; R.g.name = "az96-rift-world"; R.g.visible = false;
    function k(o) { R.keep.push(o); return o; }
    R.sky = new T.Mesh(k(new T.SphereGeometry(900, 64, 40)), k(new T.ShaderMaterial({ side: T.BackSide, fog: false, uniforms: { time: { value: 0 }, exitK: { value: 0 }, enterK: { value: 1 }, rush: { value: 0 } }, vertexShader: RW_VS, fragmentShader: RW_FS })));
    R.sky.frustumCulled = false; R.g.add(R.sky);
    // la météorite, copie exacte de la roche (même forme que les collisions)
    var rk = M1.rock, gs = M1.g.scale.x;
    R.rockMat = k(rk.material.clone());
    R.rock = new T.Mesh(rk.geometry, R.rockMat); R.rock.position.copy(rk.position).multiplyScalar(gs); R.rock.quaternion.copy(rk.quaternion); R.rock.scale.copy(rk.scale).multiplyScalar(gs);
    R.rock.frustumCulled = false; R.g.add(R.rock);
    var u = R.rockMat.uniforms; if (u) { u.front.value.set(0, -1, 0); u.lightDir.value.set(.35, 1, .25); u.rimCol.value.setHex(0xa66bff); u.heat.value = .9; u.pale.value = 0; u.energy.value = .9; }
    // débris qui remontent le long du puits
    var dg = k(new T.IcosahedronGeometry(1, 1)), pa = dg.attributes.position;
    for (var i = 0; i < pa.count; i++) { var x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), f = 1 + .28 * Math.sin(3.1 * x + 1) * Math.sin(4.3 * y + 2) * Math.sin(5.2 * z + .5); pa.setXYZ(i, x * f, y * f * .8, z * f); }
    dg.computeVertexNormals();
    R.debMat = k(rk.material.clone()); var du = R.debMat.uniforms; if (du) { du.heat.value = .12; du.front.value.set(0, -1, 0); du.lightDir.value.set(.2, -1, .3); du.rimCol.value.setHex(0x7f8cff); du.energy.value = .8; du.pale.value = 0; }
    R.deb = [];
    for (var d = 0; d < 34; d++) {
      var h1 = Math.abs(Math.sin(d * 12.9898) * 43758.5453) % 1, h2 = Math.abs(Math.sin(d * 78.233) * 12543.13) % 1, h3 = Math.abs(Math.sin(d * 39.425) * 3758.77) % 1;
      var m = new T.Mesh(dg, R.debMat); m.frustumCulled = false; m.userData = { a: h1 * 6.283, r: 70 + h2 * 520, s: 2.5 + Math.pow(h3, 2) * 26, v: 25 + h3 * 90, y0: h2 * 1400, sp: (h1 - .5) * 1.2 };
      R.g.add(m); R.deb.push(m);
    }
    // poussière d'étincelles (motif répété tous les 200 m pour défiler sans couture)
    var N = 2400, pos = new Float32Array(N * 3);
    for (var q = 0; q < N; q++) {
      var a = (Math.abs(Math.sin(q * 3.17) * 9137.1) % 1) * 6.283, rr = 30 + (Math.abs(Math.sin(q * 7.71) * 3917.3) % 1) * 600, yy = ((Math.abs(Math.sin(q * 1.93) * 7713.9) % 1) * 200) + 200 * (q % 8) - 800;
      pos[q * 3] = Math.cos(a) * rr; pos[q * 3 + 1] = yy; pos[q * 3 + 2] = Math.sin(a) * rr;
    }
    var pg = k(new T.BufferGeometry()); pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    R.dust = new T.Points(pg, k(new T.PointsMaterial({ color: 0xcdb8ff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    R.dust.frustumCulled = false; R.g.add(R.dust);
    // lueur violette sous la roche et lumière de la sortie
    var gt = k(glowTex());
    R.under = new T.Sprite(k(new T.SpriteMaterial({ map: gt, color: 0xb06bff, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    R.under.scale.setScalar(70); R.under.position.set(0, -14, 0); R.g.add(R.under);
    R.exit = new T.Sprite(k(new T.SpriteMaterial({ map: gt, color: 0xe6f2ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    R.exit.scale.setScalar(300); R.exit.position.set(0, -820, 0); R.g.add(R.exit);
    sc.add(R.g); R.sc = sc;
    return R;
  }
  function updateRift(t, dt) {
    if (!RW || !W) return;
    var on = RIDE.phase === "rift"; RW.g.visible = on; if (!on) return;
    RW.g.position.copy(W);
    var rush = rmp(t, 153.05, 153.6) * (1 - rmp(t, 154, 158)) + rmp(t, 188.5, 192.4), exitK = rmp(t, 176, 190) * .6 + rmp(t, 189.5, 192.5) * .9;
    var u = RW.sky.material.uniforms; u.time.value = t; u.rush.value = rush; u.exitK.value = exitK; u.enterK.value = 1 - rmp(t, 153.5, 162);
    var cam = root.AZUR && root.AZUR.view && root.AZUR.view.camera;
    if (RW.rockMat.uniforms) { RW.rockMat.uniforms.time.value = t; if (cam) RW.rockMat.uniforms.camPos.value.copy(cam.position); }
    if (RW.debMat.uniforms) { RW.debMat.uniforms.time.value = t; if (cam) RW.debMat.uniforms.camPos.value.copy(cam.position); }
    var sp = 1 + 2.6 * rush;
    RIDE.fall = (RIDE.fall || 0) + dt * 60 * sp; var fall = RIDE.fall;
    for (var i = 0; i < RW.deb.length; i++) {
      var m = RW.deb[i], d = m.userData, y = ((d.y0 + fall * d.v / 60) % 1400) - 700;
      m.position.set(Math.cos(d.a + t * .02 * d.sp) * d.r, y, Math.sin(d.a + t * .02 * d.sp) * d.r); m.scale.setScalar(d.s); m.rotation.set(t * .3 * d.sp, t * .2 + i, t * .17 * d.sp);
    }
    RW.dust.position.y = (fall * 1.4) % 200;
    RW.under.material.opacity = .45 + .15 * Math.sin(t * 2.3) + .3 * rush;
    RW.exit.material.opacity = Math.min(1, exitK * 1.1); RW.exit.scale.setScalar(300 + 900 * exitK);
  }
  function disposeRift() {
    if (!RW) return;
    if (RW.g.parent) RW.g.parent.remove(RW.g);
    RW.keep.forEach(function (o) { try { o.dispose(); } catch (e) {} });
    RW = null;
  }
  function showGrp(vis) {
    var O = E.end81 && E.end81.O, g = O && O.met && O.met.g && O.met.g.parent;
    if (!vis) { if (g && g.visible) { g.visible = false; GRP_HIDDEN = g; } }
    else if (GRP_HIDDEN) { GRP_HIDDEN.visible = true; GRP_HIDDEN = null; }
  }
  function flashEl() {
    if (FLASH || !root.document) return FLASH;
    FLASH = document.createElement("div"); FLASH.id = "az96-flash";
    FLASH.style.cssText = "position:fixed;inset:0;z-index:25;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 55%,#ffffff 0%,#efe6ff 30%,#b48cff 62%,#4b2a9a 100%)";
    document.body.appendChild(FLASH); return FLASH;
  }
  function setFlash(v) { V6.flash = v; var el = v > .001 ? flashEl() : FLASH; if (el) el.style.opacity = v.toFixed(3); }

  /* ---- les phases du voyage */
  function endRide(p, keepFloat) {
    RIDE.phase = null; RIDE.hasC = false; V6.phase = null; V6.m2 = false;
    showGrp(true); if (RW) RW.g.visible = false;
    if (p && keepFloat) { p._eventFloat = true; p._eventVerticalVelocity = 0; p._vy = 0; p.grounded = false; p.falling = true; }
  }
  function enter(ph, p) { RIDE.phase = ph; V6.phase = ph; V6.m2 = ph === "m2"; }
  function ride(p, dt) {
    if (!isMe(p) || !p.alive || !p.deployed || p.vehicleId) return false;
    var t = VT(); dt = Math.min(.1, Math.max(0, +dt || 0));
    if (RIDE.phase && (t < 118 || t > 224.5)) { endRide(p, false); return false; }
    // monter dessus : debout sur la roche pendant la poussée des fusées
    if (!RIDE.phase) {
      if (t < 118 || t >= 152.9 || !p.grounded) return false;
      var f0 = frame("m1", t); if (!f0) return false;
      var dx0 = p.x - f0.c.x, dz0 = p.z - f0.c.z, s0 = surf(f0, dx0, dz0);
      if (s0 == null || Math.abs(p.y - (f0.c.y + s0)) > .8) return false;
      enter("m1", p); RIDE.ox = dx0; RIDE.oz = dz0; RIDE.oy = 0; RIDE.vy = 0; RIDE.hasC = false;
    }
    // changements de phase
    if (RIDE.phase === "m1" && t >= 153.05) {
      var S = E.end81 && E.end81.S; if (!S || !S.STAR) { endRide(p, false); return false; }
      W = W || new root.THREE.Vector3(); W.set(S.STAR.x, S.STAR.y + 2400, S.STAR.z);
      if (!RW) RW = buildRift();
      if (!RW) { endRide(p, false); return false; }
      enter("rift", p); showGrp(false); RIDE.fall = 0;
    }
    if (RIDE.phase === "rift" && t >= 192.6) { enter("m2", p); showGrp(true); if (RW) RW.g.visible = false; RIDE.ox = 0; RIDE.oz = 0; RIDE.oy = 0; RIDE.vy = 0; }
    if (RIDE.phase === "m2" && t >= 216.15) {
      enter("thrown", p); V6.m2 = false;
      var hl = Math.hypot(RIDE.ox, RIDE.oz), hx = hl > .5 ? RIDE.ox / hl : Math.cos(p.yaw || 0), hz = hl > .5 ? RIDE.oz / hl : -Math.sin(p.yaw || 0);
      RIDE.hx = hx * 11; RIDE.hz = hz * 11; RIDE.vy = 26; RIDE.hasC = false;
    }
    if (RIDE.phase === "thrown") {
      if (t >= 223.9) { endRide(p, true); return false; }
      var S2 = E.end81 && E.end81.S, floor = S2 && S2.ZP ? S2.ZP.y + 92 + 18 : H(p.x, p.z) + 30;
      RIDE.vy = Math.max(-4, RIDE.vy - 10 * dt); var dmp = Math.exp(-dt * .5); RIDE.hx *= dmp; RIDE.hz *= dmp;
      p.x += RIDE.hx * dt; p.z += RIDE.hz * dt; p.y = Math.max(floor, p.y + RIDE.vy * dt);
      p._lastX = p.x; p._lastZ = p.z; p._vy = RIDE.vy; p._eventFloat = true; p._eventVerticalVelocity = RIDE.vy;
      p.grounded = false; p.falling = true; p.jumping = false; p.gliding = false; p.autoGlider = false; p.swimming = false; p.airborneFromBus = false;
      return true;
    }
    var f = frame(RIDE.phase, t); if (!f) { endRide(p, false); return false; }
    // marcher sur la roche (repère de la roche)
    var i = p._input || {}, mx = Math.max(-1, Math.min(1, +i.moveX || 0)), mz = Math.max(-1, Math.min(1, +i.moveZ || 0));
    var len = Math.max(1, Math.hypot(mx, mz)), spd = (i.sprint ? 6.6 : 4.6) * dt, yaw = p.yaw || 0;
    var mvx = (-Math.sin(yaw) * mz + Math.cos(yaw) * mx) / len * spd, mvz = (-Math.cos(yaw) * mz - Math.sin(yaw) * mx) / len * spd;
    var s = surf(f, RIDE.ox, RIDE.oz);
    if (s == null) { // la roche a grandi / changé sous nous : on revient au sommet
      RIDE.ox *= .5; RIDE.oz *= .5; s = surf(f, RIDE.ox, RIDE.oz); if (s == null) { RIDE.ox = RIDE.oz = 0; s = surf(f, 0, 0) || 0; }
    }
    if (mvx || mvz) {
      var nx = RIDE.ox + mvx, nz = RIDE.oz + mvz, ns = surf(f, nx, nz), lim = f.sh.max * f.k * .22;
      if (ns == null || (RIDE.phase !== "m1" && ns < lim)) {
        if (RIDE.phase === "m1" && ns == null) { // on saute du bord : on retombe librement
          endRide(p, false); p.x += mvx; p.z += mvz; p._lastX = p.x; p._lastZ = p.z; p.grounded = false; p.falling = true; p._vy = RIDE.vy; return false;
        }
      } else if ((ns - s) / Math.max(1e-3, Math.hypot(mvx, mvz)) < 2.2 || RIDE.oy > ns - s) {
        // au sol on reste collé à la pente (même en descente) ; en l'air la hauteur absolue est conservée
        RIDE.ox = nx; RIDE.oz = nz; if (RIDE.oy > 0 || RIDE.vy > 0) RIDE.oy = Math.max(0, RIDE.oy - (ns - s)); s = ns;
      }
    }
    // saut et retombée sur la roche
    if (RIDE.oy <= 0 && p._jumpBuffer > 0) { p._jumpBuffer = 0; RIDE.vy = 7.4; p.jumping = true; p._jumpTime = 0; }
    if (RIDE.oy > 0 || RIDE.vy > 0) { RIDE.oy += RIDE.vy * dt; RIDE.vy -= 18 * dt; if (RIDE.oy <= 0) { RIDE.oy = 0; RIDE.vy = 0; p.jumping = false; } }
    // porté par la roche ; le décalage de la roche est retiré de la vitesse lue par l'animation
    if (RIDE.hasC) { p._azCarryX = (+p._azCarryX || 0) + (f.c.x - RIDE.cx); p._azCarryZ = (+p._azCarryZ || 0) + (f.c.z - RIDE.cz); }
    RIDE.cx = f.c.x; RIDE.cy = f.c.y; RIDE.cz = f.c.z; RIDE.hasC = true;
    p.x = f.c.x + RIDE.ox; p.z = f.c.z + RIDE.oz; p.y = f.c.y + s + RIDE.oy; p._lastX = p.x; p._lastZ = p.z;
    var air = RIDE.oy > 0;
    p.grounded = !air; p.falling = air; if (!air) p.jumping = false;
    p.gliding = false; p.autoGlider = false; p.swimming = false; p.flying = false; p.airborneFromBus = false;
    p._eventFloat = false; p._eventVerticalVelocity = 0; p._vy = air ? RIDE.vy : 0; p._coyote = .12;
    p._vx = dt > 0 ? mvx / dt : 0; p._vz = dt > 0 ? mvz / dt : 0;
    p.distance = (+p.distance || 0) + Math.hypot(mvx, mvz);
    return true;
  }
  var prevRider = E.stepMeteorRider;
  E.stepMeteorRider = function (p, dt) {
    try { if (ride(p, dt)) return true; } catch (e) { if (!V.err6) { V.err6 = 1; if (root.console) console.warn("[AZUR v96]", e); } endRide(p, false); }
    return prevRider ? prevRider.apply(this, arguments) : false;
  };
  function flashFor(t) {
    var ph = RIDE.phase;
    if (ph === "m1" && t > 152.4) return rmp(t, 152.4, 153.05);
    if (ph === "rift") return t < 154.2 ? 1 - rmp(t, 153.05, 154.2) : rmp(t, 191.7, 192.6);
    if (ph === "m2" && t < 193.8) return 1 - rmp(t, 192.6, 193.8);
    return 0;
  }

  var prevInit = M.init;
  M.init = function () { V.pose = null; V.hop = -99; endRide(null, false); W = null; var r = prevInit.apply(this, arguments); install(); return r; };
  var prevDispose = M.dispose;
  M.dispose = function () { uninstall(); V.pose = null; endRide(null, false); disposeRift(); setFlash(0); return prevDispose ? prevDispose.apply(this, arguments) : undefined; };
  var prevPre = M.preUpdate;
  M.preUpdate = function (dt) {
    // pendant le voyage, la chorégraphie de fin (soulèvement par l'onde du Point Zéro) ne s'applique pas : on est sur la roche
    var late = RIDE.phase === "rift" || RIDE.phase === "m2" || RIDE.phase === "thrown", V93 = E.v93, saved = V93 ? V93.freeRoam : false;
    if (late && V93) V93.freeRoam = true;
    var r;
    try { r = prevPre.apply(this, arguments); } finally { if (late && V93) V93.freeRoam = saved; }
    try {
      if (E.active) {
        if (!hook) install();
        var p = me(), t = VT(), d = Math.min(.1, +dt || 0);
        if (p && p.alive && p.deployed) { pushOut(p); pose(p, t, d); }
        if (RIDE.phase) {
          if (RIDE.phase === "rift" || RIDE.phase === "m2") V.pose = null;
          E.cameraZoom = RIDE.phase === "m2" ? 1.45 : RIDE.phase === "rift" ? 1.2 : 1.1;
        }
        updateRift(t, d);
        setFlash(flashFor(t));
      } else if (RIDE.phase) { endRide(null, false); setFlash(0); }
    } catch (e) { if (!V.err) { V.err = 1; if (root.console) console.warn("[AZUR v95]", e); } }
    return r;
  };
  void H;
})(typeof globalThis !== "undefined" ? globalThis : this);
