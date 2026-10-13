// =====================================================================================================
//  Timeline (120 BPM: beat 0.5 s, bar 2 s, 24 bars = 48 s). Picture and score share these numbers.
//   A  0-4    "Bonjour."            bars 0-1     intro, e-piano and air
//   B  4-8    "Je suis Claude."     bars 2-3     pulse starts
//   C  8-14   verbs + object        bars 4-6     build
//   D  14-16  word burst            bar  7       snare rolls on the cuts, riser
//   E  16-28  the 3D world          bars 8-13    DROP 1
//   F  28-34  "Je vérifie..."       bars 14-16   breakdown
//   G  34-36  orbit recap           bar  17      rebuild
//   H  36-48  finale                bars 18-23   DROP 2, wordmark, prompt box, outro
// =====================================================================================================
const TT = [1.0, 1.1, 1.19, 1.31, 1.4, 1.5, 1.62], PT = 2.0;       // "Bonjour" keystrokes, caret -> period
const VT = [8.0, 9.5, 11.0, 12.5];                                  // verbs
const PH = ['Je lis.', 'J’écris.', 'Je code.', 'Je raisonne.'];
const VHUE = ['sky', 'coral', 'mint', 'violet'];                   // one hue per verb
const OC = { x: 1340, y: 540 };                                     // centre of the object in scene C
const CAPS = [
  { k: 'discuter', name: 'Discuter', hue: 'coral' }, { k: 'coder', name: 'Coder', hue: 'mint' },
  { k: 'analyser', name: 'Analyser', hue: 'amber' }, { k: 'voir', name: 'Voir', hue: 'violet' },
  { k: 'calculer', name: 'Calculer', hue: 'sky' }, { k: 'traduire', name: 'Traduire', hue: 'pink' },
];
const ARR = [17.5, 19.25, 21.0, 22.75, 24.5, 26.25];                // the camera arrives in front of card k
const LEAVE = [18.75, 20.5, 22.25, 24.0, 25.75, 27.2];             // and leaves it
const T_DIVE = 16.05, T_DOT = 28.0;                                 // world starts / the dive ends on the far dot
const CHAPTERS = [
  [0, '01', 'BONJOUR'], [4, '02', 'QUI JE SUIS'], [8, '03', 'CE QUE JE FAIS'], [14, '04', 'CE QUE JE PEUX FAIRE'],
  [16, '05', 'DANS LE DÉTAIL'], [28, '06', 'MA PROMESSE'], [34, '07', 'ET MAINTENANT'], [36, '08', 'À VOUS'],
];
const chapterIndex = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c[0]) i = k; }); return i; };
