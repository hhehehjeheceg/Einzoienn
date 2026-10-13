// =====================================================================================================
//  Sound cues: every sound the score places on the picture, exported to out/cues.json for audio.py.
//  Times come from the same constants that animate the frames, so picture and sound cannot drift apart.
// =====================================================================================================
function buildCues() {
  const c = [], add = (t, k, o = {}) => c.push(Object.assign({ t: +t.toFixed(4), k, i: 0 }, o));
  // ---- A: Bonjour
  add(.1, 'blip');
  TT.forEach((t, i) => add(t, 'key', { i }));
  add(PT, 'pop', { i: 0 }); add(PT + .01, 'sparkle', { d: .9 });
  for (let i = 0; i < L.lbl.length; i += 2) if (L.lbl[i] !== ' ') add(2.3 + i * .45 / L.lbl.length, 'tick', { i, soft: 1 });
  add(3.42, 'swoosh', { i: 0 });
  // ---- B: Je suis Claude
  add(4.0, 'rise', { i: 0 }); add(4.16, 'bell', { i: 0 }); add(4.17, 'confetti', { d: .5 });
  add(5.0, 'swish', { i: 0 }); add(5.15, 'shimmer', { i: 0, soft: 1 });
  [5.3, 5.45, 5.6, 5.75].forEach((t, i) => add(t, 'pop', { i: i + 2, soft: 1 }));
  add(5.75, 'rise', { i: 1 }); add(7.1, 'swish', { i: 2 }); add(7.3, 'swoosh', { i: 1 });
  // ---- C: verbs
  VT.forEach((t, i) => { add(t, 'tok', { i }); add(t + .02, 'sparkle', { d: .6, soft: 1 }); });
  add(8.5, 'scan', { d: .88 }); add(8.75, 'pop', { i: 4 }); add(9.0, 'pop', { i: 5 }); add(9.0, 'marker', { d: .25 });
  for (let j = 0; j < 7; j++) add(9.86 + .145 * j, 'scribble', { i: j, d: L.page.ecr[j] / 1800 });
  add(10.4, 'pop', { i: 3 });
  L.codeT.forEach((t, i) => { if (t > 0) add(t, 'type', { i, d: .1 }); });
  add(11.95, 'pop', { i: 2 }); add(12.05, 'ping', { i: 0 });
  for (let i = 0; i < 12; i++) add(12.58 + .03 * i, 'pop', { i: i % 6, soft: 1 });
  add(12.9, 'pop', { i: 1 }); add(13.05, 'pop', { i: 3 }); add(13.2, 'pop', { i: 5 }); add(13.62, 'suck', { d: .34 });
  // ---- D: the burst
  BURST.forEach((b, i) => { add(b.t, 'hit', { i }); add(b.t + .01, 'confetti', { d: .35, soft: i > 3 ? 1 : 0 }); });
  add(15.75, 'suck', { i: 1, d: .22 });
  // ---- E: the world
  add(16.0, 'impact', { i: 0 }); add(16.0, 'sparkle', { d: 1.4 }); add(16.05, 'dive', { d: 1.45 });
  for (let k = 0; k < 6; k++) add(ARR[k] - .02, 'lock', { i: k });
  const A = ARR;
  // card 0 discuter
  add(A[0] - .55, 'pop', { i: 3 }); add(A[0] - .2, 'pop', { i: 5, soft: 1 });
  for (let i = 0; i < 20; i++) add(A[0] - .02 + .03 * i, 'tick', { i: i % 5 + 2, soft: 1 });
  add(A[0] + 1.0, 'ping', { i: 1 }); [1.0, 1.1, 1.2].forEach((d, i) => add(A[0] + d, 'pop', { i: i + 1, soft: 1 })); add(A[0] + 1.2, 'ping', { i: 2 });
  // card 1 coder
  add(A[1] - .42, 'click', {}); for (let i = 0; i < 8; i++) add(A[1] - .42 + .04 * (i + 1), 'key', { i: i + 7 });
  [0, 1, 2].forEach(i => add(A[1] + .02 + .15 * i, 'check', { i })); add(A[1] + .55, 'chime', { i: 0 });
  // card 2 analyser
  for (let i = 0; i < 6; i++) add(A[2] - .4 + .05 * i, 'pop', { i: i + 1, soft: 1 });
  add(A[2] - .45, 'count', { d: .9 }); add(A[2], 'swish', { i: 1 }); add(A[2] + .48, 'ping', { i: 3 }); add(A[2] + .62, 'pop', { i: 2 });
  // card 3 voir
  add(A[3] - .38, 'scan', { d: .63 }); [.2, .3, .4].forEach((d, i) => add(A[3] + d, 'pop', { i: i * 2, soft: 1 })); for (let i = 0; i < 5; i++) add(A[3] + .7 + .07 * i, 'tick', { i: 2 + i });
  // card 4 calculer
  add(A[4] - .38, 'tok', { i: 0 }); add(A[4] + .15, 'tok', { i: 1 }); add(A[4] + .02, 'tick', { i: 3 }); add(A[4] + .42, 'tick', { i: 5 }); add(A[4] + .55, 'tok', { i: 3 }); add(A[4] - .3, 'swish', { i: 1 });
  add(A[4] + .55, 'pop', { i: 2 }); add(A[4] + .7, 'pop', { i: 4 }); add(A[4] + .85, 'pop', { i: 1 }); add(A[4] + .72, 'chime', { i: 1 });
  // card 5 traduire
  LANG_T.forEach((t, i) => add(t, 'tick', { i: 7 + i })); add(LANG_T[8] + .02, 'chime', { i: 2 });
  for (let k = 0; k < 5; k++) add(LEAVE[k], 'whoosh', { i: k, d: ARR[k + 1] - LEAVE[k], pan: Math.sign(CARDS[k + 1].x - CARDS[k].x) });
  add(LEAVE[5], 'riser', { d: T_DOT - LEAVE[5] });
  // ---- F: je vérifie / je ne sais pas
  add(28.0, 'impact', { i: 1 }); add(28.0, 'sparkle', { d: 1.2 });
  add(28.22, 'rise', { i: 2 }); add(29.0, 'marker', { d: .38 }); add(29.02, 'sparkle', { d: .6, soft: 1 }); add(29.55, 'chime', { i: 1 });
  add(30.3, 'swoosh', { i: 2 }); add(30.58, 'rise', { i: 3 }); add(31.2, 'pop', { i: 4 }); add(31.5, 'swish', { i: 2 }); add(33.1, 'swoosh', { i: 3 });
  // ---- G: the orbit
  for (let i = 0; i < 6; i++) add(33.55 + .07 * i, 'pop', { i, soft: 1 });
  add(34.0, 'orbit', { d: 1.95 }); add(35.7, 'suck', { i: 2, d: .27 });
  // ---- H: finale
  add(36.0, 'boom', { i: 0 }); add(36.04, 'shimmer', { i: 1 }); add(36.0, 'sparkle', { d: 1.8 }); add(36.02, 'confetti', { d: .9 }); add(36.38, 'swish', { i: 3 });
  add(37.1, 'shimmer', { i: 2, soft: 1 }); add(37.15, 'rise', { i: 4 }); add(38.3, 'swish', { i: 4 });
  add(39.0, 'swoosh', { i: 4 });
  for (let i = 0; i < 19; i++) add(40.1 + 1.1 * i / 19, 'key', { i: i + 3 });
  add(41.3, 'ping', { i: 4 }); S7.chips.forEach((ch, i) => add(41.5 + .09 * i, 'pop', { i: i + 1 }));
  [38.6, 40.0, 42.0, 44.0, 46.0].forEach((t, i) => add(t, 'sparkle', { d: .9, soft: 1 }));
  add(44.2, 'swish', { i: 5 }); add(44.5, 'shimmer', { i: 3, soft: 1 });
  return c.sort((a, b) => a.t - b.t);
}
