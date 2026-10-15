/* AZUR v71 — nouvelles armes, dessinées par leur silhouette.
 * Chaque pièce (carcasse, crosse, garde-main, chargeur, poignée) est un profil
 * 2D arrondi extrudé avec un biseau : des formes épaisses et douces façon
 * cartoon, au lieu de boîtes. La carcasse prend la couleur de rareté, le métal
 * reste sombre, les détails clairs (liserés, vis, rails) accrochent la lumière
 * et une bande lumineuse de rareté court sur les flancs.
 * Les points d'attache (poignée, main d'appui, bouche du canon) sont inchangés :
 * visée, recul, mains et flammes restent alignés avec l'ancienne version. */
(function (root) {
  'use strict';
  const T = root.THREE, A = root.AZArt;
  if (!T || !A?.Model || typeof A.weapon !== 'function') return;
  const Model = A.Model, previous = A.weapon;
  const SPEC = {
    pistol: [.56, [0, -.12, .10], [0, .02, -.51], true], revolver: [.64, [0, -.12, .11], [0, .02, -.58], true],
    rifle: [1.08, [0, -.13, .14], [0, .02, -.98]], burst: [1.02, [0, -.13, .14], [0, .02, -.92]],
    smg: [.82, [0, -.13, .12], [0, .02, -.73]], shotgun: [1.00, [0, -.13, .14], [0, .01, -.90]],
    tactical: [.94, [0, -.13, .13], [0, .02, -.85]], sniper: [1.48, [0, -.13, .18], [0, .02, -1.34]],
    dmr: [1.22, [0, -.13, .16], [0, .02, -1.10]], launcher: [1.15, [0, -.14, .14], [0, .02, -1.05]]
  };
  const DARK = '#1d2530', GUN = '#2e3a46', MID = '#465868', STEEL = '#9fb3bd', WOOD = '#9a5a2e', WOOD2 = '#c27a3e', LENS = '#7ff0ff', RED = '#ff4d5a';
  const C = new T.Color(), C2 = new T.Color();
  const shade = (hex, k) => '#' + C.set(hex).multiplyScalar(k).getHexString();
  const tint = (hex, k) => '#' + C.set(hex).lerp(C2.set('#ffffff'), k).getHexString();

  // Profil (z, y) arrondi, extrudé sur l'épaisseur w (axe x), centré en x0.
  function profile(m, pts, w, col, x0 = 0, bevel = .014, round = .018) {
    const s = new T.Shape(), n = pts.length;
    // coins arrondis : on raccourcit chaque arête et on relie par une courbe
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
      const ra = Math.min(round, da * .4), rb = Math.min(round, db * .4);
      const p1 = [p[0] + (a[0] - p[0]) / da * ra, p[1] + (a[1] - p[1]) / da * ra], p2 = [p[0] + (b[0] - p[0]) / db * rb, p[1] + (b[1] - p[1]) / db * rb];
      if (i === 0) s.moveTo(p1[0], p1[1]); else s.lineTo(p1[0], p1[1]);
      s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
    }
    s.closePath();
    const depth = Math.max(.004, w - bevel * 2);
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 2, curveSegments: 3 });
    g.rotateY(-Math.PI / 2); g.translate(x0 + depth / 2, 0, 0);
    m.add(g, col);
  }
  function weapon(key = 'rifle', colour = '#aab8c8', wrap = '') {
    if (!SPEC[key]) return previous.apply(this, arguments);
    const spec = SPEC[key], muzzle = spec[2], hand = !!spec[3];
    const body = colour || '#aab8c8', light = tint(body, .5), deep = shade(body, .6);
    const m = new Model(), glow = new Model();
    const barrel = (r, from, to = muzzle[2], y = muzzle[1], col = GUN) => {
      m.cyl(r, r, from - to, col, 0, y, (from + to) / 2, 12, Math.PI / 2);
    };
    const brake = (r, len = .09, y = muzzle[1]) => {
      m.cyl(r * 1.45, r * 1.45, len, DARK, 0, y, muzzle[2] + len / 2, 12, Math.PI / 2).cyl(r * .7, r * .7, .02, '#05080c', 0, y, muzzle[2] - .004, 10, Math.PI / 2);
      for (const s of [-1, 1]) m.box(.012, r * 1.2, len * .55, '#0b1016', s * r * 1.42, y, muzzle[2] + len * .5);
    };
    const grip = (col = DARK, z = spec[1][2], tilt = .22) => {
      const zz = z, y0 = -.04;
      profile(m, [[zz + .055, y0], [zz - .045, y0], [zz - .02 + tilt * -.0, -.25], [zz + .085, -.25]], .1, col, 0, .012, .03);
      for (let i = 0; i < 4; i++) m.box(.104, .01, .07, shade(col, 1.7), 0, -.08 - i * .045, zz + .02 + i * .008);
      // pontet + détente
      profile(m, [[zz - .05, -.04], [zz - .2, -.04], [zz - .2, -.1], [zz - .05, -.1], [zz - .06, -.085], [zz - .185, -.085], [zz - .185, -.055], [zz - .06, -.055]], .03, DARK, 0, .004, .01);
      m.box(.016, .05, .018, STEEL, 0, -.07, zz - .1, .35);
    };
    const curvedMag = (z, y, len, w, col = DARK, curve = .14) => {
      const p = [[z + .055, y], [z - .055, y], [z - .055 - curve * .5, y - len], [z + .055 - curve * .55, y - len - .015]];
      profile(m, p, w, col, 0, .01, .02);
      m.box(w + .006, .02, .12, STEEL, 0, y - len * .98, z - curve * .52, -.3);
    };
    const rail = (z0, z1, y = .14) => {
      m.box(.07, .025, z0 - z1, DARK, 0, y, (z0 + z1) / 2);
      for (let z = z1 + .02; z < z0 - .01; z += .045) m.box(.085, .018, .02, MID, 0, y + .018, z);
    };
    const redDot = (z, y = .16) => {
      profile(m, [[z + .06, y], [z - .06, y], [z - .05, y + .1], [z + .045, y + .1]], .1, DARK, 0, .01, .02);
      m.cyl(.04, .04, .02, '#0d141b', 0, y + .065, z - .055, 14, Math.PI / 2);
      glow.cyl(.034, .034, .006, '#9fe8ff', 0, y + .065, z - .066, 14, Math.PI / 2).box(.012, .012, .004, RED, 0, y + .065, z - .07);
    };
    const scope = (len, z, r = .055, y = .22) => {
      m.cyl(r, r, len, DARK, 0, y, z, 16, Math.PI / 2)
       .cyl(r * 1.5, r * 1.05, .14, GUN, 0, y, z - len / 2 - .06, 16, Math.PI / 2)
       .cyl(r * 1.3, r * 1.05, .1, GUN, 0, y, z + len / 2 + .04, 16, Math.PI / 2)
       .cyl(r * .55, r * .55, .06, MID, 0, y + r, z, 10).cyl(r * .55, r * .55, .06, MID, r, y, z, 10, 0, Math.PI / 2);
      for (const zz of [z - len * .3, z + len * .3]) profile(m, [[zz + .035, y - r], [zz - .035, y - r], [zz - .03, .135], [zz + .03, .135]], .07, DARK, 0, .006, .01);
      glow.cyl(r * 1.35, r * 1.35, .008, LENS, 0, y, z - len / 2 - .135, 16, Math.PI / 2);
      m.box(.02, .01, len * .7, light, 0, y + r + .002, z);
    };
    const stripe = (z0, z1, y, x = .0) => { for (const s of [-1, 1]) glow.box(.006, .022, z0 - z1, body, s * x, y, (z0 + z1) / 2); };
    const screws = (pts, x) => { for (const [z, y] of pts) for (const s of [-1, 1]) m.cyl(.012, .012, .01, STEEL, s * x, y, z, 8, 0, Math.PI / 2); };

    if (key === 'pistol') {
      profile(m, [[.12, .03], [.12, .15], [.08, .175], [-.4, .175], [-.43, .14], [-.43, .05], [-.2, .03]], .12, body, 0, .012, .02);
      for (let i = 0; i < 6; i++) m.box(.125, .09, .012, deep, 0, .11, .07 - i * .028);
      profile(m, [[.06, -.04], [-.4, -.04], [-.4, .04], [.06, .04]], .1, DARK, 0, .01, .015);
      grip(DARK, .1, .26); barrel(.03, -.38, muzzle[2], .1); brake(.028, .05, .1);
      m.box(.03, .04, .025, DARK, 0, .195, -.38).box(.05, .03, .03, DARK, 0, .19, .07);
      glow.box(.01, .01, .006, '#7dff7a', 0, .21, -.393); stripe(-.05, -.38, .1, .062); screws([[.0, .0], [-.3, .0]], .052);
    } else if (key === 'revolver') {
      profile(m, [[.1, .02], [.06, .14], [-.05, .15], [-.22, .13], [-.22, -.02], [.0, -.05]], .12, body, 0, .012, .02);
      m.cyl(.1, .1, .2, STEEL, 0, .05, -.12, 14, Math.PI / 2).cyl(.104, .104, .03, MID, 0, .05, -.03, 14, Math.PI / 2);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .52; m.cyl(.022, .022, .205, DARK, Math.cos(a) * .062, .05 + Math.sin(a) * .062, -.12, 6, Math.PI / 2); }
      profile(m, [[-.22, .12], [-.56, .12], [-.58, .06], [-.22, .04]], .09, light, 0, .01, .02);
      m.box(.025, .045, .05, DARK, 0, .16, -.53).cyl(.025, .025, .04, '#05080c', 0, .08, -.585, 8, Math.PI / 2);
      profile(m, [[.12, .0], [.0, -.03], [.08, -.27], [.2, -.26]], .11, WOOD, 0, .012, .035);
      m.box(.112, .02, .1, WOOD2, 0, -.07, .1, -.35).box(.03, .06, .04, DARK, 0, .16, .07, -.5);
      stripe(-.25, -.5, .1, .046);
    } else if (key === 'smg') {
      profile(m, [[.26, -.04], [.26, .1], [.2, .13], [-.42, .13], [-.46, .08], [-.46, -.04]], .16, body, 0, .014, .025);
      profile(m, [[-.46, .1], [-.66, .1], [-.68, .0], [-.46, -.03]], .13, GUN, 0, .012, .02);
      for (let i = 0; i < 4; i++) m.box(.135, .03, .025, '#0b1016', 0, .045, -.5 - i * .045);
      grip(DARK, .12, .24); barrel(.034, -.66); brake(.03, .07);
      profile(m, [[-.08, -.04], [-.2, -.04], [-.22, -.42], [-.1, -.42]], .08, DARK, 0, .01, .015);
      m.box(.086, .02, .12, STEEL, 0, -.41, -.16);
      profile(m, [[-.42, -.04], [-.52, -.04], [-.5, -.16], [-.43, -.16]], .07, DARK, 0, .008, .02);
      for (const s of [-1, 1]) m.box(.02, .02, .3, DARK, s * .05, .06, .38);
      m.box(.12, .14, .03, DARK, 0, .02, .54).box(.13, .02, .2, MID, 0, .14, .44);
      rail(.1, -.36, .15); redDot(-.08, .165); stripe(.2, -.4, .03, .081); screws([[.15, .06], [-.3, .06]], .082);
    } else if (key === 'shotgun') {
      profile(m, [[.24, -.04], [.24, .1], [.18, .14], [-.18, .14], [-.24, .1], [-.24, -.06]], .15, body, 0, .014, .025);
      barrel(.045, -.2, muzzle[2], .05, GUN); m.cyl(.04, .04, .5, MID, 0, -.04, -.5, 12, Math.PI / 2);
      m.cyl(.05, .05, .06, DARK, 0, .05, muzzle[2] + .03, 12, Math.PI / 2).cyl(.03, .03, .02, '#05080c', 0, .05, muzzle[2] - .004, 10, Math.PI / 2);
      profile(m, [[-.28, .02], [-.6, .02], [-.62, -.04], [-.6, -.11], [-.28, -.11], [-.26, -.045]], .14, WOOD, 0, .012, .02);
      for (let i = 0; i < 6; i++) m.box(.143, .012, .02, shade(WOOD, .62), 0, -.045, -.33 - i * .045);
      grip(WOOD, .14, .25);
      profile(m, [[.24, .1], [.56, .04], [.66, .02], [.68, -.17], [.6, -.18], [.26, -.06]], .13, WOOD, 0, .014, .03);
      m.box(.135, .2, .03, DARK, 0, -.07, .675).box(.14, .02, .3, WOOD2, 0, .06, .4, .15);
      for (let i = 0; i < 4; i++) m.box(.03, .035, .07, '#e04b45', -.09, .03, -.12 + i * .065).box(.032, .018, .018, '#e8c45a', -.09, .03, -.155 + i * .065);
      m.box(.02, .02, .7, STEEL, 0, .155, -.45); glow.box(.01, .01, .01, '#ffd23f', 0, .17, -.86);
      stripe(.15, -.15, .05, .076);
    } else if (key === 'tactical') {
      profile(m, [[.26, -.06], [.26, .1], [.2, .15], [-.4, .15], [-.46, .1], [-.46, -.08]], .2, body, 0, .016, .03);
      m.cyl(.15, .15, .15, DARK, 0, -.17, -.16, 18, Math.PI / 2).cyl(.11, .11, .155, deep, 0, -.17, -.16, 18, Math.PI / 2).cyl(.04, .04, .16, STEEL, 0, -.17, -.16, 10, Math.PI / 2);
      profile(m, [[-.46, .1], [-.7, .1], [-.72, .0], [-.7, -.06], [-.46, -.07]], .17, GUN, 0, .014, .025);
      for (let i = 0; i < 3; i++) m.box(.175, .03, .03, '#0b1016', 0, .03, -.53 - i * .055);
      barrel(.055, -.7); brake(.05, .1);
      grip(DARK, .13, .2);
      profile(m, [[.26, .08], [.48, .06], [.5, -.12], [.42, -.13], [.3, -.04]], .12, DARK, 0, .012, .025);
      rail(.12, -.4, .165); redDot(-.1, .18); stripe(.2, -.4, .04, .101); screws([[.18, .08], [-.38, .08], [.18, -.03]], .102);
    } else if (key === 'launcher') {
      m.cyl(.16, .16, .9, body, 0, .02, -.36, 20, Math.PI / 2).cyl(.17, .17, .05, DARK, 0, .02, -.1, 20, Math.PI / 2).cyl(.17, .17, .05, DARK, 0, .02, -.62, 20, Math.PI / 2);
      m.cyl(.2, .16, .2, GUN, 0, .02, .16, 20, Math.PI / 2).cyl(.23, .2, .06, DARK, 0, .02, .28, 20, Math.PI / 2).cyl(.12, .12, .02, '#05080c', 0, .02, .31, 16, Math.PI / 2);
      m.cyl(.19, .19, .1, DARK, 0, .02, -.82, 20, Math.PI / 2);
      m.cyl(.1, .17, .14, '#e04b45', 0, .02, -.94, 18, Math.PI / 2).cyl(.03, .1, .1, '#f4f4f4', 0, .02, -1.05, 14, Math.PI / 2);
      for (let i = 0; i < 4; i++) m.box(.012, .07, .12, '#f4f4f4', Math.cos(i * 1.57) * .14, .02 + Math.sin(i * 1.57) * .14, -.86);
      m.cyl(.163, .163, .14, '#ffd23f', 0, .02, -.36, 20, Math.PI / 2);
      profile(m, [[.18, -.12], [.08, -.12], [.11, -.36], [.21, -.36]], .1, DARK, 0, .01, .03);
      profile(m, [[-.16, -.12], [-.28, -.12], [-.25, -.32], [-.15, -.32]], .1, DARK, 0, .01, .03);
      profile(m, [[-.12, .17], [-.36, .17], [-.34, .3], [-.14, .3]], .08, DARK, -.13, .008, .02);
      glow.box(.012, .07, .16, LENS, -.172, .24, -.24);
      stripe(.0, -.7, .02, .162);
    } else {
      const sniper = key === 'sniper', dmr = key === 'dmr', burst = key === 'burst';
      const rear = sniper ? .36 : .3, front = sniper ? -.5 : dmr ? -.48 : -.44, top = .13;
      profile(m, [[rear, -.05], [rear, .1], [rear - .1, top], [front + .05, top], [front, .09], [front, -.06]], .16, body, 0, .014, .025);
      if (sniper || dmr) {
        profile(m, [[front, .07], [front - .32, .05], [front - .36, .0], [front - .32, -.07], [front, -.08]], .14, sniper ? WOOD : GUN, 0, .012, .03);
        if (sniper) m.box(.142, .015, .3, WOOD2, 0, .04, front - .17);
      } else {
        profile(m, [[front, .1], [front - .34, .09], [front - .36, -.03], [front, -.06]], .15, GUN, 0, .012, .02);
        for (let i = 0; i < 4; i++) m.box(.155, .028, .03, '#0b1016', 0, .045, front - .06 - i * .07);
        for (const s of [-1, 1]) m.box(.01, .06, .26, MID, s * .077, .02, front - .17);
      }
      barrel(sniper ? .036 : .032, front - .3); brake(sniper ? .04 : .034, sniper ? .12 : .09);
      grip(DARK, spec[1][2], .22);
      if (sniper) {
        profile(m, [[-.02, -.05], [-.14, -.05], [-.14, -.17], [-.02, -.17]], .1, DARK, 0, .01, .015);
        profile(m, [[rear, .1], [rear + .44, .04], [rear + .5, .03], [rear + .52, -.2], [rear + .42, -.21], [rear + .2, -.08], [rear, -.05]], .13, WOOD, 0, .014, .035);
        m.box(.135, .23, .03, DARK, 0, -.08, rear + .525).box(.02, .1, .02, STEEL, .09, .1, .1).ball(.03, STEEL, .11, .05, .1);
        scope(.5, -.18, .065, .24);
      } else {
        curvedMag(-.1, -.05, burst ? .26 : dmr ? .2 : .3, .1, DARK, dmr ? .04 : .14);
        profile(m, [[rear, .09], [rear + .3, .06], [rear + .34, .04], [rear + .35, -.15], [rear + .27, -.16], [rear + .12, -.05], [rear, -.04]], .12, dmr ? WOOD : DARK, 0, .012, .03);
        m.box(.125, .2, .03, DARK, 0, -.05, rear + .355);
        rail(rear - .08, front + .06, .145);
        if (burst) scope(.24, -.14, .045, .215); else if (dmr) scope(.34, -.16, .052, .225); else redDot(-.12, .16);
      }
      stripe(rear - .05, front + .05, .04, .081); screws([[rear - .06, .07], [front + .06, .07]], .082);
      glow.box(.006, .03, .08, '#ffffff', .081, .09, rear - .12);
    }
    if (wrap) {
      const wd = A.cosmetic ? A.cosmetic(wrap, { color: body, secondary: '#ffd23f' }) : { color: body };
      for (const s of [-1, 1]) m.box(.012, .06, spec[0] * .32, wd.color || body, s * (key === 'launcher' ? .17 : .085), .07, -spec[0] * .18).box(.013, .02, spec[0] * .32, wd.secondary || '#ffd23f', s * (key === 'launcher' ? .171 : .086), .07, -spec[0] * .18);
    }
    const out = new T.Group();
    out.add(m.mesh());
    const g = glow.mesh(); g.material = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); out.add(g);
    out.userData = { weapon: key, wrap, grip: spec[1], supportGrip: hand ? [-.025, -.11, .075] : [-.035, key === 'launcher' ? -.10 : -.01, key === 'launcher' ? -.13 : key === 'smg' ? -.16 : -.20], muzzle, barrelAxis: [0, 0, -1], presentation: { extension: hand ? .25 : .20, kick: key === 'sniper' || key === 'shotgun' ? .066 : hand ? .044 : .037 } };
    return out;
  }
  A.weapon = weapon;
})(window);
