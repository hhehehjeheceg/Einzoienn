// =====================================================================================================
//  Timeline: 128 BPM, beat 0.46875 s, bar 1.875 s, 16 bars = 64 beats = 30 s. Picture and score share these numbers.
//   beats  0-4    Allumage        the ember, the 12 rays, "Bonjour."                 intro
//   beats  4-8    Je suis Claude  3D letters                                         intro
//   beats  8-14   J'écris / Je code / J'analyse                                      build
//   beats 14-16   word burst on 8th notes, implosion                                 pre-drop
//   beats 16-24   DROP 1: the language rings                                         drop 1
//   beats 24-32   the reasoning graph                                                drop 1 (b)
//   beats 32-40   Je vois: the picture is read, labels pop                           breakdown
//   beats 40-44   Quand je ne sais pas, je vous le dis                               breakdown
//   beats 44-48   orbit of the six abilities, accelerating, implosion                build 2
//   beats 48-56   DROP 2: melted colours, Utile. Honnête. Bienveillant.             drop 2
//   beats 56-64   cream flood, wordmark, prompt box                                  outro
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
const T_THINK = bt(24);
const T_STEPS = [bt(24), bt(25.5), bt(27), bt(28.5)];      // reasoning steps
const T_SEE = bt(32);
const T_HONEST = bt(40);
const T_ORBIT = bt(44);
const T_DROP2 = bt(48);
const T_VALUES = [bt(48), bt(50), bt(52)];
const T_FLOOD = bt(56);
const T_PROMPT = bt(58);
const T_TYPE0 = bt(58.5), T_TYPE1 = bt(60.5);
const T_FINAL = bt(62);
const VERBS = ['J’écris.', 'Je code.', 'J’analyse.'];
const BURSTW = ['Résumer.', 'Traduire.', 'Expliquer.', 'Imaginer.'];
const VALUES = ['Utile.', 'Honnête.', 'Bienveillant.'];
const PROMPT = 'Comment puis-je vous aider ?';
const IMPACTS = [[T_IGN, 9], [T_DROP, 16], [T_DROP2, 20], [T_FLOOD, 8]];   // [time, camera shake in px]

// registries filled by the scene files
const SCENES = [];   // { t0, cam, setup, bg, fg } in time order
const SUBS = [];     // motion-blur budget: [from, to, sub-frames]
const CUTS = [];     // hard cuts: the sub-frames of a frame stay on its side of the cut
const INITS = [];    // set-up that needs the fonts loaded (textures with text), run once by the boot
