// ------------------------------------------------------------------ timeline
// 90 BPM: one beat = 0.6667 s, one bar = 2.6667 s. The music drop sits on bar 9 (24.0 s) = "Project Stellar la ramène".
// Every scene boundary and every voice line lives here, so re-timing to the final voice-over is one edit.
const BPM = 90, BEAT = 60 / BPM, BAR = BEAT * 4, DROP = 9 * BAR;   // drop = bar 9 = 24.0 s
const S = {
  intro: [0, 4.0],          // space, "février 2020"
  bus: [4.0, 9.333],        // battle bus over the island, "une saison qui a tout changé"
  secret: [9.333, 11.333],  // TOP SECRET stamp
  midas: [11.333, 12.667],  // gold wave
  poi: [12.667, 16.0],      // L'Agence, le Yacht, le Requin, la Plateforme (one card per spoken name)
  sides: [16.0, 19.333],    // Fantôme ou Ombre
  fade: [19.333, DROP],     // "tu pensais ne jamais la revoir": memory shatters into stars
  logo: [DROP, 26.667],     // drop: Project Stellar
  og: [26.667, 33.333],     // projet indépendant, Fortnite OG, C2 S2 (gameplay slot A)
  feat: [33.333, 39.667],   // installation, launcher, serveurs
  jump: [39.667, 41.333],   // saute du bus
  build: [41.333, 43.333],  // pose tes murs
  top1: [43.333, 46.333],   // top 1 (gameplay slot B)
  isle: [46.333, 50.0],     // l'île t'attend
  end: [50.0, 60.0],        // Project Stellar, le OG est de retour
};
const CARD_T = [0, .733, 1.533, 2.333];   // POI cards, on the spoken names
const FEAT_T = [0, 2, 4, 6.333];          // feature cards
const inS = (t, k, pre = 0, post = 0) => t >= S[k][0] - pre && t < S[k][1] + post;
const lt = (t, k) => t - S[k][0];
// voice-over placement: [source start, source end, film start, text] (ElevenLabs take 1, cut on its own pauses)
const VO = [
  [0.00, 2.00, 0.45, 'Tu te souviens de février 2020 ?'],
  [2.69, 3.73, 4.25, 'Le bus de combat...'],
  [4.17, 5.45, 5.75, "l'île du Chapitre 2..."],
  [6.15, 8.04, 7.15, 'et une saison qui a tout changé :'],
  [8.77, 9.48, 9.38, 'Top Secret.'],
  [10.20, 10.83, 11.45, 'Midas.'],
  [11.42, 12.12, 12.72, "L'Agence."],
  [12.72, 13.40, 13.45, 'Le Yacht,'],
  [13.40, 14.17, 14.25, 'le Requin,'],
  [14.17, 15.12, 15.05, 'la Plateforme.'],
  [15.96, 17.24, 16.3, 'Fantôme ou Ombre :'],
  [17.51, 18.79, 17.85, 'il fallait choisir son camp.'],
  [20.01, 20.71, 19.85, 'Cette époque,'],
  [20.98, 22.62, 20.75, 'tu pensais ne jamais la revoir.'],
  [23.73, 25.35, 24.1, 'Project Stellar la ramène.'],
  [25.92, 28.17, 26.85, 'Un projet indépendant et non officiel,'],
  [28.68, 32.43, 29.35, 'pour revivre le Fortnite OG du Chapitre 2, Saison 2.'],
  [33.48, 34.64, 33.5, 'Une installation rapide.'],
  [34.90, 36.02, 35.5, 'Un launcher simple.'],
  [36.41, 38.53, 37.5, 'Des serveurs pour jouer avec ta squad.'],
  [39.30, 40.06, 39.75, 'Saute du bus.'],
  [40.26, 40.96, 41.4, 'Pose tes murs.'],
  [41.21, 42.44, 43.4, 'Va chercher le Top 1.'],
  [43.35, 44.17, 46.7, "L'île t'attend."],
  [45.12, 46.25, 50.25, 'Project Stellar.'],
  [46.80, 48.93, 51.7, 'Le OG est de retour.'],
];
// camera punch on beats after the drop (exp decay), used by the compositor
function beatPunch(t) {
  if (t < DROP || t > S.isle[0]) return 0;
  const b = (t - DROP) / BEAT, k = Math.floor(b), ph = (b - k) * BEAT;
  return (k % 4 === 0 ? .022 : .009) * Math.exp(-ph / .12);
}
