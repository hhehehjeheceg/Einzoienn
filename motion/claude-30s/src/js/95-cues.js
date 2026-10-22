// =====================================================================================================
//  Sound cues: every sound the score places on the picture, exported to out/cues.json for audio.py.
//  The times come from the constants that animate the frames, so picture and sound cannot drift apart.
// =====================================================================================================
function buildCues() {
  const c = [], add = (t, k, o = {}) => c.push(Object.assign({ t: +t.toFixed(4), k, i: 0 }, o));
  // 1-2: ember, ignition, Bonjour, Claude
  add(.02, 'blip'); add(bt(1), 'thump');
  add(T_IGN, 'ignite'); add(T_IGN + .01, 'sparkle', { d: 1.2 });
  [...'Bonjour.'].forEach((ch, i) => add(T_HELLO + i * .042, 'tick', { i, soft: 1 }));
  add(T_CLAUDE - .05, 'swoosh'); LETTERS.forEach((L, i) => add(letterT(i) + .05, 'pop', { i }));
  add(T_CLAUDE + .5, 'shimmer', { soft: 1 });
  // 3: whips, pen, keys, bars
  WH.forEach(([a, b], i) => add((a + b) / 2, 'whip', { i, d: b - a }));
  add(T_V[0] + .16, 'scribble', { d: .74 });
  for (let i = 0; i < 24; i++) add(T_V[1] + .06 + i * .026, 'key', { i });
  add(T_V[1] + .74, 'ping', { i: 0 });
  BARS_H.forEach((h, i) => add(T_V[2] + .1 + i * .05, 'pop', { i: i + 1, soft: 1 }));
  add(T_V[2] + .3, 'scan', { d: .48 });
  // 4: burst and implosion
  T_BURST.forEach((t, i) => add(t, 'hit', { i }));
  add(T_SUCK, 'suck', { d: T_DROP - T_SUCK });
  // 5: drop 1
  add(T_DROP, 'boom'); add(T_DROP + .01, 'sparkle', { d: 1.6 });
  for (let i = 0; i < 6; i++) add(bt(17) + i * .05, 'tick', { i: i + 3, soft: 1 });
  add(10.95, 'swoosh', { i: 1 });
  // 6: reasoning
  add(T_THINK, 'impact', { i: 1 });
  T_STEPS.forEach((t, i) => { add(t, 'grow', { d: .36 }); add(t + .3, 'ping', { i: i + 1 }); });
  add(bt(31.2), 'riser', { d: bt(32) - bt(31.2) });
  // 7: vision
  add(T_SEE, 'impact', { i: 2 }); add(T_SEE + .2, 'scan', { d: .7 });
  BOXES.forEach(b => add(b[5], 'pop', { i: 2, soft: 1 }));
  for (let i = 0; i < 26; i++) add(T_SEE + 2.05 + i * .9 / 26, 'key', { i: i + 5, soft: 1 });
  // 8-9: honesty, orbit
  for (let i = 0; i < 6; i++) add(bt(41.2) + i * .18, 'tick', { i, soft: 1 });
  add(T_ORBIT - .2, 'swoosh', { i: 2 }); CARDS.forEach((cd, i) => add(T_ORBIT - .25 + i * .06 + .2, 'pop', { i, soft: 1 }));
  add(T_ORBIT, 'orbit', { d: SUCK2 - T_ORBIT }); add(SUCK2, 'suck', { d: T_DROP2 - SUCK2 });
  // 10: drop 2
  add(T_DROP2, 'boom', { i: 1 }); add(T_DROP2 + .01, 'sparkle', { d: 1.8 });
  T_VALUES.forEach((t, i) => add(t, 'hit', { i: i + 4 }));
  add(RUSH, 'riser', { d: T_FLOOD - RUSH });
  // 11: finale
  add(T_FLOOD, 'impact', { i: 0 }); add(T_FLOOD + .02, 'shimmer');
  add(T_PROMPT, 'swish');
  for (let i = 0; i < PROMPT.length; i++) if (PROMPT[i] !== ' ') add(T_TYPE0 + i * (T_TYPE1 - T_TYPE0) / PROMPT.length, 'key', { i });
  add(T_TYPE1 + .02, 'tok', { i: 1 }); add(T_FINAL, 'chime', { i: 2 }); add(T_FINAL + .02, 'sparkle', { d: 1.2 });
  return c.sort((a, b) => a.t - b.t);
}
