/* AZUR v67 — armes redessinées.
 * Silhouettes plus épaisses et lisibles façon cartoon : corps peint à la couleur
 * de rareté (gris, vert, bleu, violet, orange), métal sombre, liserés clairs qui
 * imitent un biseau, bande lumineuse de rareté et viseurs qui brillent.
 * Les points d'attache (poignée, main d'appui, bouche du canon) restent ceux
 * du modèle précédent : visée, recul, IK des mains et flammes restent alignés.
 * L'arme tenue prend la couleur de rareté de l'objet (voir characters-v67.js). */
(function (root) {
  'use strict';
  const T = root.THREE, A = root.AZArt;
  if (!T || !A?.Model || typeof A.weapon !== 'function') return;
  const Model = A.Model;
  const SPEC = {
    pistol: [.56, [0, -.12, .10], [0, .02, -.51], true], revolver: [.64, [0, -.12, .11], [0, .02, -.58], true],
    rifle: [1.08, [0, -.13, .14], [0, .02, -.98]], burst: [1.02, [0, -.13, .14], [0, .02, -.92]],
    smg: [.82, [0, -.13, .12], [0, .02, -.73]], shotgun: [1.00, [0, -.13, .14], [0, .01, -.90]],
    tactical: [.94, [0, -.13, .13], [0, .02, -.85]], sniper: [1.48, [0, -.13, .18], [0, .02, -1.34]],
    dmr: [1.22, [0, -.13, .16], [0, .02, -1.10]], launcher: [1.15, [0, -.14, .14], [0, .02, -1.05]]
  };
  const DARK = '#1b2633', MID = '#3a4a5a', STEEL = '#8aa2ad', WOOD = '#8a5532', WOOD2 = '#b5753f', LENS = '#7ff0ff';
  const shade = (hex, k) => '#' + new T.Color(hex).multiplyScalar(k).getHexString();
  const tint = (hex, k) => '#' + new T.Color(hex).lerp(new T.Color('#ffffff'), k).getHexString();

  function weapon(key = 'rifle', colour = '#aab8c8', wrap = '') {
    const spec = SPEC[key] || SPEC.rifle, muzzle = spec[2], hand = !!spec[3];
    const body = colour || '#aab8c8', light = tint(body, .45), deep = shade(body, .62);
    const m = new Model(), glow = new Model();
    // Panneau biseauté : bloc + liseré clair dessus + ombre dessous.
    const panel = (w, h, d, col, x, y, z, rx = 0) => {
      m.box(w, h, d, col, x, y, z, rx).box(w * .9, h * .1, d * .94, tint(col, .4), x, y + h * .5, z, rx).box(w * .92, h * .08, d * .94, shade(col, .55), x, y - h * .5, z, rx);
    };
    const barrel = (r, from, col = MID) => {
      const len = from - muzzle[2];
      m.cyl(r, r, len, col, 0, muzzle[1], (from + muzzle[2]) / 2, 12, Math.PI / 2)
       .cyl(r * 1.35, r * 1.35, .07, DARK, 0, muzzle[1], muzzle[2] + .035, 12, Math.PI / 2)
       .cyl(r * .62, r * .62, .02, '#05080c', 0, muzzle[1], muzzle[2] - .002, 10, Math.PI / 2);
    };
    const grip = (col = DARK, tilt = .24) => {
      m.box(.09, .25, .13, col, 0, -.13, .12, tilt);
      for (let i = 0; i < 4; i++) m.box(.094, .012, .11, shade(col, 1.6), 0, -.06 - i * .045, .115 + i * .011, tilt);
      m.box(.11, .03, .14, DARK, 0, -.07, .02).box(.012, .06, .02, STEEL, 0, -.10, -.02, .3);
    };
    const mag = (n, x, y, z, w, h, d, curve) => { for (let i = 0; i < n; i++) m.box(w, h / n + .004, d, i === n - 1 ? STEEL : DARK, x, y - i * h / n, z - i * curve, curve * 2.2 * i); };
    const sight = (z, glowCol = '#ff4d5a') => {
      m.box(.1, .05, .16, DARK, 0, .17, z).box(.1, .1, .02, DARK, 0, .22, z + .06).box(.1, .1, .02, DARK, 0, .22, z - .06);
      glow.box(.012, .012, .006, glowCol, 0, .225, z + .045);
    };
    const scope = (len, z, r = .06) => {
      m.cyl(r, r, len, DARK, 0, .24, z, 14, Math.PI / 2).cyl(r * 1.35, r, .1, MID, 0, .24, z - len / 2 - .03, 14, Math.PI / 2)
       .cyl(r * 1.2, r * 1.2, .08, MID, 0, .24, z + len / 2, 14, Math.PI / 2).box(.07, .09, .06, DARK, 0, .17, z - len * .3).box(.07, .09, .06, DARK, 0, .17, z + len * .3)
       .cyl(r * .5, r * .5, .05, STEEL, 0, .24 + r, z, 8);
      glow.cyl(r * .95, r * .95, .01, LENS, 0, .24, z - len / 2 - .085, 14, Math.PI / 2);
    };
    const strip = (w, len, y, z, x = 0) => { glow.box(w, .022, len, body, x + .001, y, z); };
    const rail = (z, len) => { m.box(.08, .025, len, DARK, 0, .135, z); for (let i = 0; i < 6; i++) m.box(.095, .016, .022, MID, 0, .152, z - len * .42 + i * len * .168); };

    if (key === 'pistol') {
      panel(.13, .11, .42, body, 0, .095, -.17); m.box(.11, .07, .36, DARK, 0, .02, -.15).box(.12, .02, .12, light, 0, .156, -.05);
      for (let i = 0; i < 5; i++) m.box(.135, .07, .012, deep, 0, .095, .0 + i * -.03);
      grip(DARK, .2); barrel(.035, -.36); strip(.006, .26, .1, -.2, .066); strip(.006, .26, .1, -.2, -.066);
      m.box(.025, .03, .02, DARK, 0, .165, -.34); glow.box(.01, .01, .01, '#7dff7a', 0, .182, -.34);
    } else if (key === 'revolver') {
      m.box(.13, .12, .3, body, 0, .07, -.12).cyl(.11, .11, .19, STEEL, 0, .0, -.12, 12, Math.PI / 2);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; m.cyl(.026, .026, .2, DARK, Math.cos(a) * .072, Math.sin(a) * .072, -.12, 6, Math.PI / 2); }
      m.box(.09, .08, .32, light, 0, .07, -.41).box(.03, .03, .1, DARK, 0, .125, -.5).box(.1, .26, .14, WOOD, 0, -.14, .12, -.25).box(.104, .02, .13, WOOD2, 0, -.05, .1, -.25);
      m.box(.04, .07, .05, DARK, 0, .15, .02, -.4); barrel(.045, -.27, MID); strip(.006, .22, .03, -.38, .046);
    } else if (key === 'smg') {
      panel(.2, .18, .46, body, 0, .02, -.16); m.box(.15, .12, .26, DARK, 0, .0, -.47).box(.16, .03, .2, light, 0, .07, -.45);
      for (let i = 0; i < 4; i++) m.box(.155, .04, .02, MID, 0, .02, -.38 - i * .05);
      grip(DARK, .18); mag(5, 0, -.13, -.18, .085, .32, .12, .012); m.box(.07, .15, .07, DARK, 0, -.1, -.5, -.15);
      m.box(.08, .05, .26, MID, 0, .04, .18).box(.1, .14, .05, DARK, 0, .0, .31); barrel(.04, -.6); rail(-.2, .3); sight(-.12, '#ff4d5a'); strip(.006, .3, .02, -.16, .101); strip(.006, .3, .02, -.16, -.101);
    } else if (key === 'shotgun') {
      panel(.16, .15, .38, body, 0, .03, -.04); m.cyl(.042, .042, .7, MID, 0, -.06, -.42, 10, Math.PI / 2).box(.1, .03, .66, STEEL, 0, .105, -.41);
      m.box(.15, .13, .26, WOOD, 0, -.07, -.47).box(.155, .02, .24, WOOD2, 0, -.005, -.47);
      for (let i = 0; i < 5; i++) m.box(.158, .012, .02, shade(WOOD, .7), 0, -.07, -.38 - i * .045);
      grip(WOOD, .22); m.box(.1, .07, .4, WOOD, 0, .0, .32).box(.15, .19, .1, WOOD, 0, -.05, .52).box(.155, .2, .03, DARK, 0, -.05, .58);
      barrel(.055, -.24); for (let i = 0; i < 4; i++) m.box(.03, .035, .08, '#e04b45', -.095, .04, -.06 + i * .07).box(.032, .02, .02, '#e8c45a', -.095, .04, -.1 + i * .07);
      strip(.006, .3, .04, -.04, .081);
    } else if (key === 'tactical') {
      panel(.24, .2, .46, body, 0, .02, -.14); m.cyl(.15, .15, .14, DARK, 0, -.18, -.12, 14, Math.PI / 2).cyl(.11, .11, .145, deep, 0, -.18, -.12, 14, Math.PI / 2);
      m.box(.19, .15, .32, DARK, 0, .0, -.52).box(.2, .03, .26, light, 0, .08, -.52); grip(DARK, .2); barrel(.065, -.62);
      m.box(.09, .06, .3, MID, 0, .03, .2).box(.13, .16, .05, DARK, 0, -.01, .35); rail(-.22, .4); sight(-.1, '#ffd23f'); strip(.006, .34, .03, -.14, .121); strip(.006, .34, .03, -.14, -.121);
    } else if (key === 'burst') {
      panel(.22, .2, .72, body, 0, .01, -.06); m.box(.18, .22, .14, DARK, 0, -.03, .33).box(.2, .12, .28, DARK, 0, -.01, -.5);
      for (let i = 0; i < 3; i++) m.box(.205, .05, .03, MID, 0, .0, -.42 - i * .07);
      grip(DARK, .2); mag(5, 0, -.14, .24, .1, .28, .14, .01); barrel(.042, -.6); rail(-.18, .44); scope(.22, -.18, .045);
      strip(.008, .5, .03, -.1, .111); strip(.008, .5, .03, -.1, -.111);
    } else if (key === 'launcher') {
      m.cyl(.17, .17, .96, body, 0, .02, -.38, 16, Math.PI / 2).cyl(.21, .17, .18, DARK, 0, .02, .15, 16, Math.PI / 2).cyl(.24, .21, .06, MID, 0, .02, .25, 16, Math.PI / 2);
      m.cyl(.19, .19, .12, DARK, 0, .02, -.82, 16, Math.PI / 2).cyl(.1, .19, .1, '#e04b45', 0, .02, -.93, 16, Math.PI / 2).cyl(.055, .1, .06, '#f1f1f1', 0, .02, -1.0, 12, Math.PI / 2);
      for (const z of [-.65, -.2, .05]) m.cyl(.178, .178, .04, z === -.2 ? '#ffd23f' : DARK, 0, .02, z, 16, Math.PI / 2);
      m.box(.1, .26, .14, DARK, 0, -.21, -.22, .2).box(.09, .25, .13, DARK, 0, -.14, .12, .24).box(.06, .16, .2, DARK, -.21, .13, -.25);
      glow.box(.014, .05, .12, LENS, -.245, .17, -.25); strip(.01, .5, .19, -.38);
    } else {
      const precision = key === 'sniper' || key === 'dmr', len = precision ? .5 : .44;
      panel(.18, .18, len, body, 0, .015, -.1); m.box(.16, .14, precision ? .5 : .38, precision ? WOOD : DARK, 0, -.005, -.5);
      if (!precision) for (let i = 0; i < 4; i++) m.box(.165, .045, .02, MID, 0, .0, -.38 - i * .07);
      else m.box(.165, .02, .48, WOOD2, 0, .065, -.5);
      grip(DARK, .22); mag(precision ? 3 : 6, 0, -.14, -.06, .1, precision ? .18 : .3, .13, precision ? 0 : .014);
      m.box(.1, .07, .3, precision ? WOOD : MID, 0, .0, .26).box(.15, .2, .1, precision ? WOOD : DARK, 0, -.05, .43).box(.155, .21, .025, DARK, 0, -.05, .48);
      barrel(key === 'sniper' ? .045 : .04, -.66);
      if (key === 'sniper') { m.box(.11, .08, .09, DARK, 0, muzzle[1], muzzle[2] + .06).box(.02, .1, .02, STEEL, .09, .05, .06).sphere(.03, STEEL, .11, .0, .06); scope(.5, -.22, .07); }
      else if (key === 'dmr') scope(.32, -.2, .055);
      else { rail(-.2, .44); sight(-.16, '#ff4d5a'); }
      strip(.008, len * .8, .03, -.1, .091); strip(.008, len * .8, .03, -.1, -.091);
    }
    if (wrap) { const wd = A.cosmetic ? A.cosmetic(wrap, { color: body, secondary: '#ffd23f' }) : { color: body }; for (const s of [-1, 1]) m.box(.012, .07, spec[0] * .3, wd.color || body, s * (key === 'launcher' ? .18 : .1), .03, -spec[0] * .2); }

    const out = new T.Group();
    out.add(m.mesh());
    const g = glow.mesh(); g.material = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); out.add(g);
    out.userData = { weapon: key, wrap, grip: spec[1], supportGrip: hand ? [-.025, -.11, .075] : [-.035, key === 'launcher' ? -.10 : -.01, key === 'launcher' ? -.13 : key === 'smg' ? -.16 : -.20], muzzle, barrelAxis: [0, 0, -1], presentation: { extension: hand ? .25 : .20, kick: key === 'sniper' || key === 'shotgun' ? .066 : hand ? .044 : .037 } };
    return out;
  }
  A.weapon = weapon;
})(window);
