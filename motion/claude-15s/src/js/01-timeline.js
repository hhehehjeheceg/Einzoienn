// =====================================================================================================
//  Timeline: 128 BPM, beat 0.46875 s, bar 1.875 s, 8 bars = 32 beats = 15 s. Picture and score share these numbers.
//   1  0     - 1.875   Allumage      the ember, the 12 rays, "Bonjour."
//   2  1.875 - 3.75    Je suis Claude 3D letters
//   3  3.75  - 6.5625  J'écris / Je code / J'analyse
//   4  6.5625- 7.5     word burst on 8th notes, implosion
//   5  7.5   - 9.375   DROP: the language rings
//   6  9.375 - 11.25   the reasoning graph
//   7  11.25 - 15      cream flood, wordmark, prompt box
// =====================================================================================================
const BPM = 128, BEAT = 60 / BPM, BAR = 4 * BEAT;
const bt = n => n * BEAT;                                  // beat n -> seconds
const T_IGN = bt(2);                                       // the rays burst out
const T_HELLO = bt(2.5);                                   // "Bonjour." rises
const T_CLAUDE = bt(4);                                    // scene 2
const T_V = [bt(8), bt(10), bt(12)];                       // verbs
const T_BURST = [bt(14), bt(14.5), bt(15), bt(15.5)];      // word burst (8th notes)
const T_IMPLODE = bt(15.75);
const T_DROP = bt(16);
const T_THINK = bt(20);
const T_STEPS = [bt(20), bt(21), bt(22), bt(23)];          // reasoning steps
const T_FLOOD = bt(24);
const T_PROMPT = bt(26);
const T_TYPE0 = bt(26.5), T_TYPE1 = bt(28.5);
const T_FINAL = bt(30);
const VERBS = ['J’écris.', 'Je code.', 'J’analyse.'];
const BURSTW = ['Résumer.', 'Traduire.', 'Expliquer.', 'Imaginer.'];
const PROMPT = 'Comment puis-je vous aider ?';
const IMPACTS = [[T_IGN, 9], [T_DROP, 16], [T_FLOOD, 10]];   // [time, camera shake in px]

// registries filled by the scene files
const SCENES = [];   // { t0, cam, setup, bg, fg } in time order
const SUBS = [];     // motion-blur budget: [from, to, sub-frames]
const CUTS = [];     // hard cuts: the sub-frames of a frame stay on its side of the cut
