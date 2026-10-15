/* ============================================================================
 * event-rockets.js — v14 : les 7 fusées de The Seven (modèle détaillé v5,
 * conservé : corps sombre, parties bleues, damier ; + détails v14 :
 * panneaux de coque, tuyères incandescentes, marquages « 07 », liserés).
 *
 * Reproduction du live Fortnite Chapitre 1 Saison X (13/10/2019), 23 états,
 * 300 s (v17 : resserrement narratif 336 s -> 300 s, fini les segments en
 * boucle) — phases 1 à 6 (groupe A) :
 *  - countdown   [0,60]    : rien (le zéro émet 'countdown:alarm' via
 *                            event-countdown.js, joué par event-audio.js).
 *  - firstrocket [60,86]   : PHASE 1 (fin) — à ZÉRO : la n°1 VIBRE
 *                            (anticipation), moteurs allumés, ÉNORME
 *                            fumée/flammes, DÉCOLLAGE VERTICAL immédiat
 *                            (v24 : ANTICIPATION LONGUE 2,6 s — gronde,
 *                            tremble, s'arrache du pas de tir — puis
 *                            montée MAJESTUEUSE easeLaunchClimb=p^6 :
 *                            v(1 s) ≈ 13 m/s, SANS zigzag), ouvre une
 *                            faille GIGANTESQUE, y entre, refermeture
 *                            derrière.
 *  - sixrockets  [86,106]  : PHASES 2-3 — les failles du ciel s'activent
 *                            SIMULTANÉMENT ; UNE fusée sort d'une faille,
 *                            PLONGE (vertigineux), remonte BRUTALEMENT,
 *                            traverse l'île à grande vitesse ; les 6 autres
 *                            sortent successivement : 7 fusées sautent de
 *                            faille en faille, de PLUS EN PLUS VITE, puis
 *                            ÉCLATENT en éventail (jamais vers la
 *                            météorite). Positions publiées (anchors).
 *  - convergence [106,114] : PHASE 4 (8 s) — les 7 convergent VITE vers la
 *                            faille GÉANTE près de la MÉTÉORITE FIGÉE
 *                            (arc ample + vrille d'entrée), y entrent
 *                            progressivement, COURT INSTANT sans fusée,
 *                            réapparaissent DERRIÈRE la météorite.
 *  - loop        [114,121] : PHASE 5 (7 s, v17 DYNAMIQUE : survol/balayage
 *                            unique près de la météorite, PAS de cercles
 *                            répétitifs), virages INCLINÉS (bank),
 *                            LIENS D'ÉNERGIE fusées->météorite (capture) :
 *                            faille arrière -> fusées -> météorite ->
 *                            faille avant ; les 6 suivent la même
 *                            trajectoire.
 *  - acceleration[121,147] : PHASE 6 (26 s, v17 : montée en puissance
 *                            CONTINUE vers la chute, SANS répétition),
 *                            liens d'énergie + cercle énergétique, la faille
 *                            avant GRANDIT, la météorite VIBRE
 *                            ('meteor:unfreeze' + AZEvent.meteorUnfrozen)
 *                            + GROS FLASH + onde de choc, puis TOMBE dans
 *                            la faille avant et disparaît ; les fusées
 *                            disparaissent dans la séquence.
 *  - strike      [152,165] : PHASE 8 (v10, groupe B) — la n°1 sort d'une
 *                            faille TRÈS HAUT au-dessus du Point Zéro,
 *                            plonge VITE vers lui (piqué en S qui se
 *                            verrouille) avec un LASER DE VISÉE clairement
 *                            visible (faisceau fin et brillant fusée ->
 *                            Point Zéro + point d'impact lumineux sur la
 *                            bulle), accélère et PERCUTE la bulle ;
 *                            CONTACT (ts≈9) -> ÉNORME onde de choc
 *                            SPHÉRIQUE ('shockwave:burst') + 'rocket:zeroshock'
 *                            (propulse le joueur, v11) ; la n°1 est
 *                            DÉTRUITE (destroyed[0] : ne réapparaît
 *                            jamais, pas en meteorsix). Interdiction "pas
 *                            de kamikaze" LEVÉE sur demande explicite de
 *                            l'utilisateur.
 *  - silence ... end       : bornes v17 (silence [147,152], fin à
 *                            300 s) ; logique inchangée.
 *
 * FUSÉE (procédurale, axe +Y) — corps SOMBRE (anthracite métallique),
 * anneaux de structure, 4 ailerons à la base, cône de nez, hublots et
 * bandes BLEUS LUMINEUX (cyan émissif), BASE À DAMIER noir/blanc sur la
 * jupe moteur. INTERDIT : tir métallique, rampes jaunes (il n'y en a pas).
 *
 * v14 « TRAJECTOIRES + DÉTAILS » : RS 5.0 conservé, trajectoires
 * refondues à fond (montées puissantes, grands virages inclinés, plongeons
 * vertigineux, easing marqué, formation/éclatement), détails ajoutés
 * (panneaux de coque, tuyères incandescentes + lueur, marquages « 07 »,
 * liserés cyan, traînées de condensation améliorées). Montée initiale
 * TOUJOURS parfaitement verticale et lisse (aucun zigzag, jamais).
 *
 * v15 « DÉCOLLAGES MAX » (ANIMATION SEULEMENT — bornes, timeline,
 * chorégraphies et fixes v13/v14 inchangés) :
 *  - firstrocket : secousse AU SOL au décollage — anneau d'onde de choc qui
 *    s'étend au sol + halo de lumière au pas de tir (anneau désactivé sur
 *    mobile), LÉGÈRE vibration caméra via le canal existant 'camera:shake'
 *    (force 0.18 : ne change PAS le mode caméra, qui reste LIBRE) ;
 *  - traînée de feu qui S'INTENSIFIE pendant la montée (vitesse verticale
 *    MESURÉE : flamme + cœur + halo moteur GRANDISSENT avec l'altitude et
 *    la vitesse, jamais constants), traînée qui s'élargit en montant,
 *    tuyère incandescente nourrie par la vitesse de montée ;
 *  - la montée initiale reste PARFAITEMENT VERTICALE et lisse (position
 *    x/z verrouillées, quaternion identité : aucun zigzag, jamais).
 *
 * v17 « FUSÉES » (worker fusées — ajouts uniquement, timeline/bornes
 * v17 et fixes v13-v16 inchangés) :
 *  - DÉCOLLAGE 30× PLUS HAUT : LAUNCH_ALT 1400 -> 42000 m, faille de
 *    sortie près du faîte (LAUNCH_RIFT_Y 41800) ; compensation
 *    spectaculaire : PILIER DE LUMIÈRE pas-de-tir->fusée (fog:false),
 *    COLONNE DE FEU (flamme ×23 en hauteur au faîte), HALO GÉANT
 *    (~2500, fog:false), camera.far poussé DÉFENSIVEMENT à 300000
 *    pendant la montée (try/catch, restauré à la sortie de phase) —
 *    le brouillard n'est pas touché (event-sky.js en est le seul
 *    propriétaire) : les FX percent le fog (fog:false). Montée
 *    toujours PARFAITEMENT VERTICALE et lisse ;
 *  - NOUVEAU MODÈLE 3D : coque multi-panneaux (3 tronçons), colliers
 *    boulonnés, 6 ailerons détaillés (bords cyan + feux de position),
 *    2 rangées de hublots encadrés, TRIPLE tuyère (lueur par moteur),
 *    antenne fouet + parabole + balise clignotante, tuyaux, blocs RCS,
 *    emblème chevron « The Seven » + numéros conservés ;
 *  - CAPTURE À 360° : en convergence chaque fusée pique vers SON
 *    azimut d'approche (encerclement, Bézier convFrom->W_i->faille)
 *    et réapparaît côté OPPOSÉ ; en loop chacune fend l'espace à son
 *    azimut ; en acceleration les 7 sont réparties sur tout le tour ;
 *  - LOOP DYNAMIQUE (7 s) : fini les cercles répétitifs — SURVOL/
 *    BALAYAGE UNIQUE par fusée (passe qui accélère dans la descente,
 *    départs échelonnés), qui file vers acceleration (jonction douce
 *    1,5 s sans téléportation) ;
 *  - ANIMATIONS MAX : éclairs de tuyère (flash selon poussée/virage),
 *    tuyères latérales qui respirent, balise clignotante ;
 *  - INÉDITS (sans nouvelle histoire) : ONDES DE CHOC aux changements
 *    de cap brutaux (anneau d'énergie, pool d'un par fusée), DÉBRIS
 *    INCANDESCENTS au largage (entrées de failles).
 *
 * v18 « FUSÉES » (worker fusées — ajouts/corrections uniquement,
 * timeline/bornes v17 et fixes v13-v17 inchangés) :
 *  - BUG 1 — DÉCOLLAGE TROP VIOLENT : le profil de vitesse de la montée
 *    (easeInOutCubic) atteignait ~6000 m/s dès 1,3 s. Nouveau profil
 *    easeLaunchClimb (easeInQuart, dérivée nulle au départ) : décollage
 *    MAJESTUEUX et lent au début, ACCÉLÉRATION PROGRESSIVE jusqu'à la
 *    vitesse max au faîte. Montée toujours PARFAITEMENT VERTICALE et
 *    lisse (x/z verrouillés) ; LAUNCH_ALT (42000 m) toujours atteint en
 *    LAUNCH_CLIMB (5,2 s) — aucune borne déplacée. FILET : le profil
 *    étant très cambré en fin de montée, l'entrée dans la faille GÉANTE
 *    est forcée au faîte si le croisement n'a pas été détecté (la fusée
 *    ne reste jamais figée) ;
 *  - BUG 3 — « TRUC LUMINEUX BIZARRE » AU DÉCOLLAGE : le PILIER DE
 *    LUMIÈRE (42 km, additif, fog:false) restait visible=true figé dans
 *    le ciel après le départ de la fusée — hideLaunchFX() n'était appelé
 *    que dans resetRun(), ni à l'entrée dans la faille ni en sortie de
 *    phase. Désormais masqué dès l'entrée dans la faille GÉANTE
 *    (updateFirst, launchCrossed) + filet de sécurité à l'entrée de
 *    toute phase ≠ firstrocket (enterPhase) ; dispose() inchangé
 *    (suppression/destruction complète).
 *
 * v21 « FUSÉES À FOND » (worker fusées — AJOUTS UNIQUEMENT : aucune
 * fonction supprimée/renommée, bornes/timeline v17 et fixes v13-v20
 * inchangés, easeLaunchClimb/LAUNCH_ALT/montée verticale préservés) :
 *  - DÉCOLLAGE GRANDIOSE : souffle initial (rafale de fumée ×40 + halo de
 *    sol + gerbe), CASCADE D'ALLUMEURS le long de la colonne de feu
 *    (densité ∝ altitude), LANGUES DE FEU latérales, PORTIQUE DE
 *    LANCEMENT qui TREMBLE (anticipation -> décollage), GRONDEMENT
 *    MONTANT (secousses 0,22 -> 0,30 -> 0,38 + halo au pas de tir) ;
 *  - MONTÉE MAJESTUEUSE : JALONS SONIQUES à 10/20/30/38 km (anneau de choc
 *    horizontal + gerbe + secousse légère — les 42 km se SENTENT),
 *    MIROITEMENT du halo moteur, pilier de lumière qui PULSE avec le
 *    moteur, PULSATION PROFONDE des tuyères (battement lent) ;
 *  - 7 PASSES UNIQUES (loop) : CRESCENDO — chaque passe claque plus fort
 *    (1,0 -> 2,3) ; faille avant qui S'EMBRASE au passage de la n°1
 *    (acceleration) ; sorties de failles en 4 temps avec SIGNATURE par
 *    fusée (7 variations cyan) ;
 *  - TRAVERSÉES DE FAILLES : grammaire unique cause -> effet —
 *    ANTICIPATION (halo qui « inspire » 1,2-1,5 s avant : convergence,
 *    acceleration, veeroff, strike) puis IMPLOSION -> FLASH -> DISTORSION
 *    -> DÉBRIS (pool de 8 flashs, orientés selon la traversée) ;
 *  - DESTRUCTION n°1 EN 4 TEMPS : anticipation (laser + halo) ->
 *    EXPLOSION (double gerbe + jet + implosion) -> onde de choc ->
 *    DÉBRIS + flash de faille -> ÉPAVE INCANDESCENTE (2,5 s de feu/fumée/
 *    braises) ; les 6 autres sortent en 4 temps avec variations ;
 *  - INÉDITS : REFLETS DE COQUE (le soleil accroche la coque par
 *    pulsations), ÉTINCELLES DE COQUE (la coque « crache » des étincelles),
 *    SIGNAUX LUMINEUX ENTRE FUSÉES (balises en chenille 0->6 en formation).
 *
 * v22 « FUSÉES » (worker fusées — AJOUTS UNIQUEMENT : aucune fonction
 * supprimée/renommée, bornes/timeline v17 et fixes v13-v21 inchangés,
 * easeLaunchClimb/LAUNCH_ALT/hideLaunchFX/chenille/traversées 3 temps/
 * destruction 4 temps préservés) :
 *  - DÉCOLLAGE : ALLUMAGE SÉQUENCÉ des 3 moteurs (micro-délais 0,22/0,45/
 *    0,68 de l'anticipation, gerbe d'étincelles par moteur) ; SOUFFLE AU SOL
 *    (double rafale + anneau de poussière qui s'étend) ; GRONDEMENT GRAVE au
 *    décollage (secousse lourde, caméra toujours LIBRE) ;
 *  - PERSONNALITÉ : chaque fusée a sa fréquence de pulsation moteur, sa
 *    graine de scintillement, sa largeur de traînée, ses SURSAUTS MOTEUR
 *    (gerbe d'étincelles + poussée visible) — micro-variations, cohérence
 *    gardée ;
 *  - VOL : TRAÎNÉE VOLUMINEUSE en vol (feu + fumée + étincelles, cadencé,
 *    densité réduite sur mobile via dens20()) ;
 *  - TRAVERSÉES : STREAK lumineuse le long de la traversée (couleur de la
 *    fusée) + CICATRICE rémanente (halo qui s'éteint lentement) — signatures
 *    distinctes par fusée (durée/ampleur varient) ;
 *  - DESTRUCTION n°1 (timing du contact inchangé) : SECONDE ONDE DE CHOC
 *    (2 vagues lisibles), COLONNE D'IMPACT (pilier de lumière vers le ciel),
 *    plus de débris, ÉPAVE INCANDESCENTE qui brûle 4 s et s'effondre
 *    (morceaux incandescents qui tombent).
 *
 * v24 « DÉCOLLAGE MAJESTUEUX » (worker fusées — AJOUTS UNIQUEMENT :
 * aucune fonction supprimée/renommée, bornes/timeline v17 et fixes
 * v13-v23 inchangés, LAUNCH_ALT/hideLaunchFX/chenille/traversées 3 temps/
 * destruction 4 temps préservés) :
 *  - COURBE DURCIE : easeLaunchClimb p^4 -> p^6 (easeInSextic) — palier
 *    lent PUIS foudroyant : v(0,5 s) ≈ 0,4 m/s, v(1 s) ≈ 13 m/s (la
 *    fusée reste ÉNORME à l'écran), v(2 s) ≈ 410 m/s, fulgurant ensuite ;
 *    ck(0)=0, ck(1)=1 exacts — LAUNCH_ALT (42000 m) toujours atteint en
 *    LAUNCH_CLIMB (5,2 s), montée PARFAITEMENT VERTICALE (x/z verrouillés),
 *    entrée en faille + FILET au faîte inchangés ('rift:cross' 1×) ;
 *  - ANTICIPATION LONGUE ET RICHE : LAUNCH_ANTICIP 1,2 -> 2,6 s — la fusée
 *    GRONDE (3 paliers de secousse grave 0,28 -> 0,42 -> 0,55, canal
 *    'camera:shake' existant, caméra LIBRE), TREMBLE de plus en plus fort
 *    (amplitude doublée sur la fin), puis S'ARRACHE du pas de tir dans les
 *    0,5 dernières secondes (soulèvement forcé ~3,5 m) ; allumage séquencé
 *    des 3 moteurs + fumée en crescendo conservés et étalés sur 2,6 s.
 *
 *
 * Pilotage : AZEvent.state / tState / tTotal + bus 'phase:<nom>'.
 * AUCUN temps absolu en dur : tout est relatif à l'entrée de phase
 * (tState = secondes écoulées dans la phase courante).
 *
 * Publie : AZEvent.anchors['rocket1'..'rocket7'] (positions, lues par la
 *           caméra) ; v14 : AZEvent.rocketBodies = tableau [{x,y,z,r,top}]
 *           des fusées visibles/actives (contrat de collision solide :
 *           x,z = centre, y = base/tuyère, top = sommet/nez, r ≈ RS*2),
 *           mis à jour chaque frame, jamais null/undefined.
 *           Lit : AZEvent.meteorPos, AZEvent.zeroPointPos, AZEvent.rifts,
 *           AZEvent.launchPad.
 * Émet sur le bus : 'rocket:launch', 'rift:cross', 'rocket:rift-enter',
 *                    'rocket:pass', 'rocket:impact', 'meteor:unfreeze',
 *                    'rocket:zeroshock', 'shockwave:burst' (contact phase 8,
 *                    flash unfreeze phase 6), 'camera:shake' (contact
 *                    phase 8 force 1.0, unfreeze phase 6 force 0.7).
 * v9 conservé : roulis bankSm, pop easeOutBack (failles),
 * collision joueur/fusées 14 m (event-player.js, non touchée).
 * ========================================================================== */
(function (root) {
'use strict';

// Rien à faire si le séquenceur n'est pas chargé.
if (!root.AZEvent) return;

/* ---------------------------------------------------------------------------
 * Miroir local de la timeline v17 officielle (secondes, bornes lues depuis
 * AZEvent.TIMELINE quand elle existe — ce miroir n'est qu'un repli).
 * v17 : RESSERREMENT narratif à 300 s — 'loop' 7 s dynamique (PAS de
 * cercles répétitifs), 'acceleration' 26 s continue, 'impact' 39 s.
 * ------------------------------------------------------------------------- */
var TL = {
  countdown:   [0, 60],    firstrocket: [60, 86],   sixrockets: [86, 106],
  convergence: [106, 114], loop:        [114, 121], acceleration: [121, 147],
  silence:     [147, 152], strike:      [152, 165], thrown:      [165, 172],
  greatrift:   [172, 182], meteorsix:   [182, 189], descent:    [189, 209],
  veeroff:     [209, 217], impact:      [217, 256], contraction: [256, 260],
  collapse:    [260, 263], growth:      [263, 266], destruction: [266, 275],
  playersucked:[275, 279], allgone:    [279, 283], blackhole:  [283, 293],
  numbers:     [293, 300], end:         [300, Infinity]
};
var PHASES = ['countdown','firstrocket','sixrockets','convergence','loop',
  'acceleration','silence','strike','thrown','greatrift','meteorsix',
  'descent','veeroff','impact','contraction','collapse','growth',
  'destruction','playersucked','allgone','blackhole','numbers','end'];

var N = 7;                 // EXACTEMENT 7 fusées : celles de The Seven
var RS = 5.0;              // v12 : échelle du modèle légèrement augmentée (~58 unités de haut, était 4.6)
var REST_LIFT = 5.4 * RS;  // v9 : dérivé de RS (la tuyère repose sur le pas de tir)
var T = null, api = null, scene = null;

var rockets = [];          // état par fusée (voir buildRocket)
var smoke = null;          // fumée blanche massive du décollage
var laserG = null;         // laser de visée du strike (vers le Point Zéro)
var laserCore = null, laserGlow = null, laserRing = null, laserDot = null;
var laserCoreMat = null, laserGlowMat = null, laserRingMat = null;
var ring = null, ringMat = null; // cercle énergétique (acceleration)
var linkG = null, linkBeams = [], linkBeamMat = null, linkBeamGeo = null; // v12 : liens d'énergie fusées->météorite (capture)
var glowTex = null;        // texture radiale partagée (halos)
var checkerTex = null;     // damier noir/blanc de la jupe moteur

var flags = {};            // émissions uniques par passage
var destroyed = [false, false, false, false, false, false, false];
var lastState = '';
var lastT = -1;
var frame = 0;
var phaseT0 = 0;           // tTotal d'entrée dans la phase courante (jamais d'absolu en dur)
var busPhase = '';         // phase reçue via le bus 'phase:<nom>', à consommer
var busBound = false;      // abonnement bus (ne se refait pas à chaque init)
var strikeT0 = 0;          // tTotal d'entrée en strike (repli si bus manqué)
var padRocketHidden = false;

var trailN = 300;          // particules de traînée par fusée (< 500)
var trailLife = 7.0;       // v12 : durée de vie d'une particule de traînée (traînée de flamme ALLONGÉE, était 4.9)
var trailEvery = 1;        // pousse une particule toutes les N frames
var trailMode = 'fire';    // 'fire' = décollage orange incandescent ; 'space' = cyan/bleu électrique
var trailSpread = 1;       // v15 : élargissement de la traînée (montée du décollage)
var lowQ = false;          // v15 : qualité réduite (mobile, via api.isMobile) — effets lourds allégés
var launchRing = null, launchRingMat = null; // v15 : anneau d'onde de choc au sol (décollage)
var launchGlow = null;                       // v15 : halo de lumière au pas de tir
var launchRingT = -1, launchGlowT = -1;       // v15 : chronos des FX de décollage (s)
// v22 — ANNEAU DE POUSSIÈRE du décollage : le souffle balaye le sol
// (anneau gris qui s'étend, créé paresseusement, masqué par hideLaunchFX).
var launchDust = null, launchDustMat = null, launchDustT = -1;
// v17 — PILIER DE LUMIÈRE du décollage 30× plus haut (pas-de-tir -> fusée,
// fog:false : perce le brouillard jusqu'à 42 km). Créé paresseusement.
var launchBeam = null, launchBeamMat = null;
// v17 — VUE CIEL LOINTAIN : camera.far poussé défensivement pendant la
// montée à 42 km (try/catch, RESTAURÉ à la sortie de phase).
var skyViewOn = false, savedCamFar = 0;
// v17 — ONDES DE CHOC aux changements de cap (pool d'un anneau par fusée).
var turnRings = [];
// v17 — DÉBRIS INCANDESCENTS au largage (un seul Points, 240 particules).
var debris = null;
var DEBRIS_N = 240, DEBRIS_LIFE = 1.4;

// v21 — FUSÉES « À FOND » (ajouts uniquement) :
//  - riftFlashes : pool de flashs d'entrée/sortie de faille (implosion ->
//    flash -> halo de distorsion), cause -> effet visible à chaque traversée ;
//  - RIFT_COLORS : 7 variations cyan — chaque fusée a sa signature de faille ;
//  - MILE_Y : jalons d'altitude de la montée (anneaux soniques à 42 km) ;
//  - gantry : portique de lancement (tremble au décollage, pas de nouvelle
//    histoire : simple tour de service qui vibre sous la puissance).
var riftFlashes = [];
var RIFTFLASH_N = 8;
var RIFT_COLORS = [0x9fe8ff, 0x7fd0ff, 0xbfe9ff, 0x8fd8ff, 0xaee6ff, 0x86c8ff, 0xc4ecff];
var MILE_Y = [10000, 20000, 30000, 38000];
var gantry = null, gantryX = 0, gantryZ = 0, gantryBaseY = 0;

// v14 — CONTRAT DE PUBLICATION « FUSÉES SOLIDES » : chaque frame,
// AZEvent.rocketBodies = tableau d'objets {x, y, z, r, top} pour les fusées
// actuellement visibles et actives (x,z = centre ; y = base/tuyère ;
// top = sommet/nez ; r = rayon du cylindre de collision ≈ RS*2).
// Tableau MUTÉ EN PLACE (zéro allocation après amorçage), jamais
// null/undefined (vide si aucune fusée). Nettoyé à dispose().
var rocketBodies = [];

// Constantes partagées avec event-rift.js : cercle des 6 failles de zones.
var ZONE_R = 350, ZONE_Y = 160, ZONE_OFF = 0.3; // v8 : miroir de event-rift.js (plus basses)
// Position figée de la météorite (repli si AZEvent.meteorPos absent).
var FROZEN_METEOR = { x: -180, y: 180, z: -310 }; // miroir de event-meteor.js (ancien, voir meteorNow)

// Vecteurs temporaires (pas d'allocation par frame).
var _v1, _v2, _v3, _v4, _v5, _v6, _v7, _ev, _up, _q, _q2; // v9 : _q2 (roulis/bank) ; v17 : _v7 (points d'approche 360°) ; v22 : _ev (positions moteurs)

// Position publiée d'une faille (AZEvent.rifts, event-rift.js), sinon repli calculé.
function riftPos(i, out) {
  var rs = root.AZEvent.rifts;
  if (rs && rs[i] && rs[i].pos && typeof rs[i].pos.x === 'number')
    return out.copy(rs[i].pos);
  if (i >= 0 && i < 6) return zonePos(i, out); // failles de zones : cercle partagé
  return meteorNow(out);                       // dernier repli : la météorite
}

/* ---------------------------------------------------------------------------
 * Utilitaires
 * ------------------------------------------------------------------------- */

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function easeInOut(p) { p = clamp01(p); return p * p * (3 - 2 * p); }
function easeIn(p) { p = clamp01(p); return p * p; }
// v14 : easing MARQUÉS — accélération/décélération puissantes.
function easeInOutCubic(p) { p = clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
function easeInOutQuart(p) { p = clamp01(p); return p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2; }
// v24 — PROFIL DE VITESSE DU DÉCOLLAGE « PALIER LENT PUIS FOUDROYANT » :
// p^6 (easeInSextic) — remplace le p^4 de v18, encore plus creusé au
// départ : dérivée nulle ET courbure quasi nulle à l'origine, la fusée
// s'arrache du pas de tir AU RALENTI (v(1 s) ≈ 13 m/s : quelques mètres
// à peine, la fusée reste ÉNORME à l'écran), puis accélération de plus
// en plus violente vers le faîte (v(2 s) ≈ 410 m/s, v(3 s) ≈ 3100 m/s,
// fulgurant en fin de montée). ck(0)=0, ck(1)=1 exactement : LAUNCH_ALT
// toujours atteint en LAUNCH_CLIMB. Aucune allocation, montée toujours
// PARFAITEMENT VERTICALE (x/z verrouillés dans updateFirst).
function easeLaunchClimb(p) { p = clamp01(p); var a = p * p * p; return a * a; }
// v10 : dépassement ("pop") à l'ouverture — anticipation + rebond.
function easeOutBack(p) {
  p = clamp01(p);
  var c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
function lerp(a, b, t) { return a + (b - a) * t; }

// Bézier quadratique : a -> c (contrôle) -> b, eased.
function bez2(a, c, b, e, out) {
  var ie = 1 - e;
  out.set(
    ie * ie * a.x + 2 * ie * e * c.x + e * e * b.x,
    ie * ie * a.y + 2 * ie * e * c.y + e * e * b.y,
    ie * ie * a.z + 2 * ie * e * c.z + e * e * b.z
  );
  return out;
}

// Position d'une faille de zone (même cercle que event-rift.js).
function zonePos(i, out) {
  var a = ZONE_OFF + (i / 6) * Math.PI * 2;
  return out.set(Math.cos(a) * ZONE_R, ZONE_Y, Math.sin(a) * ZONE_R);
}

// Position COURANTE de la météorite (publiée par event-meteor.js).
function meteorNow(out) {
  var m = root.AZEvent.meteorPos;
  if (m && typeof m.x === 'number') return out.set(m.x, m.y, m.z);
  // v7 : repli = position FIGÉE (miroir de event-meteor.js : centre + (420, 780, 420)).
  if (api && api.center) return out.set(api.center.x + 420, 780, api.center.z + 420);
  return out.set(FROZEN_METEOR.x, FROZEN_METEOR.y, FROZEN_METEOR.z);
}

// Position COURANTE du Point Zéro (publiée par event-zeropoint.js).
function zeroPointNow(out) {
  var z = root.AZEvent.zeroPointPos;
  if (z && typeof z.x === 'number') return out.set(z.x, z.y, z.z);
  if (api && api.center) return out.set(api.center.x, api.center.y + 25, api.center.z);
  return out.set(0, 55, 0);
}
// Direction horizontale "loin du centre" depuis un point.
function dirOutFrom(p, out) {
  var c = api.center;
  out.set(p.x - c.x, 0, p.z - c.z);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

// Position du pas de tir : publiée par event-arena.js (Vector3), sinon repli.
function launchPadPos(out) {
  var lp = root.AZEvent.launchPad;
  var p = (lp && lp.pos) ? lp.pos : lp;
  if (p && typeof p.x === 'number') return out.set(p.x, p.y || 0, p.z || 0);
  return out.set(-180, 0, 140);
}

/* ---------------------------------------------------------------------------
 * Textures procédurales partagées (aucun appel réseau).
 * ------------------------------------------------------------------------- */

function makeGlowTexture() {
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}

// Damier noir/blanc de la jupe moteur (base à damier).
function makeCheckerTexture() {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  var g = c.getContext('2d');
  var cols = 8, rows = 4, cw = c.width / cols, rh = c.height / rows;
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      g.fillStyle = ((x + y) % 2 === 0) ? '#f4f4f4' : '#0b0b0b';
      g.fillRect(x * cw, y * rh, cw, rh);
    }
  }
  var tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

function makeGlowSprite(color, scale) {
  var mat = new T.SpriteMaterial({
    map: glowTex, color: color, transparent: true,
    blending: T.AdditiveBlending, depthWrite: false, fog: false // v17 : les halos percent le brouillard (décollage 42 km)
  });
  var s = new T.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

// v14 — texture du marquage de coque : numéro de la fusée (« 01 »..« 07 »),
// blanc à contour cyan, esprit Fortnite (sobre, lisible de loin).
function makeMarkTexture(txt) {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  var g = c.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = '#19d8ff';
  g.strokeText(txt, 64, 34);
  g.fillStyle = '#f2fbff';
  g.fillText(txt, 64, 34);
  return new T.CanvasTexture(c);
}

// v17 — texture de l'EMBLÈME de coque : chevron « The Seven » blanc à
// contour cyan + pastille — esprit Fortnite, lisible de loin.
function makeEmblemTexture() {
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.lineWidth = 15; g.strokeStyle = '#19d8ff';
  g.beginPath(); g.moveTo(22, 44); g.lineTo(64, 100); g.lineTo(106, 44); g.stroke();
  g.lineWidth = 8; g.strokeStyle = '#f2fbff';
  g.beginPath(); g.moveTo(22, 44); g.lineTo(64, 100); g.lineTo(106, 44); g.stroke();
  g.fillStyle = '#19d8ff';
  g.beginPath(); g.arc(64, 28, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2fbff';
  g.beginPath(); g.arc(64, 28, 5, 0, Math.PI * 2); g.fill();
  return new T.CanvasTexture(c);
}

/* ---------------------------------------------------------------------------
 * Construction du modèle v17 de fusée (axe +Y, ~58 unités de haut, RS=5).
 * Corps SOMBRE anthracite métallique MULTI-PANNEAUX (3 tronçons), colliers
 * de structure boulonnés, 6 AILERONS détaillés (bords cyan + feux de
 * position), cône de nez (pointe cyan), 2 rangées de HUBLOTS encadrés,
 * bandes BLEUES LUMINEUSES, TRIPLE TUYÈRE (centrale + 2 latérales, lueurs
 * incandescentes), jupe moteur À DAMIER noir/blanc, antenne fouet,
 * parabole, balise clignotante, tuyaux externes, blocs RCS, EMBLÈME
 * chevron « The Seven » + marquages numérotés « 01 »..« 07 ».
 * Les parties émissives sont en MeshBasicMaterial (non éclairé = toujours
 * bien visible, même de nuit et de loin) ; les FX (flammes, halos,
 * traînée, éclairs) ignorent le brouillard (fog:false).
 * Enveloppe INCHANGÉE (contrat rocketBodies) : tuyère ≈ -5.4*RS,
 * nez ≈ +5.9*RS.
 * ------------------------------------------------------------------------- */

function buildRocket(i) {
  var group = new T.Group();

  var hullMat = new T.MeshStandardMaterial({
    color: 0x23262e, metalness: 0.85, roughness: 0.38, emissive: 0x05070c
  });
  var darkMat = new T.MeshStandardMaterial({
    color: 0x14161b, metalness: 0.7, roughness: 0.5
  });
  var ringMat = new T.MeshStandardMaterial({
    color: 0x3d434d, metalness: 0.95, roughness: 0.3
  });
  var cyanMat = new T.MeshBasicMaterial({ color: 0x4fe3ff }); // bleu lumineux
  var cyanDeep = new T.MeshBasicMaterial({ color: 0x1899c2 });
  var checkMat = new T.MeshBasicMaterial({ map: checkerTex });

  // v17 — COQUE MULTI-PANNEAUX : 3 tronçons de teintes alternées (détail
  // de carlingue façon Fortnite) — mêmes dimensions que l'ancien corps.
  var hullMatB = new T.MeshStandardMaterial({
    color: 0x2e333d, metalness: 0.85, roughness: 0.34, emissive: 0x070a10
  });
  var hullSegs = [hullMat, hullMatB, hullMat];
  for (var hs = 0; hs < 3; hs++) {
    var seg = new T.Mesh(new T.CylinderGeometry(1.12 * RS, 1.32 * RS, 2.2 * RS, 12), hullSegs[hs]);
    seg.position.y = (-2.2 + hs * 2.2) * RS;
    group.add(seg);
  }

  // v17 — COLLIERS DE STRUCTURE boulonnés (2) : anneaux métal clair +
  // 10 boulons chacun — la coque « tient » mécaniquement.
  var collarMat = new T.MeshStandardMaterial({
    color: 0x4a515c, metalness: 0.95, roughness: 0.28
  });
  var boltGeo = new T.BoxGeometry(0.22 * RS, 0.22 * RS, 0.22 * RS);
  for (var co = 0; co < 2; co++) {
    var collarY = (-1.65 + co * 3.3) * RS;
    var collar = new T.Mesh(new T.CylinderGeometry(1.46 * RS, 1.46 * RS, 0.34 * RS, 12), collarMat);
    collar.position.y = collarY;
    group.add(collar);
    for (var bo = 0; bo < 10; bo++) {
      var boa = (bo / 10) * Math.PI * 2 + co * 0.31;
      var bolt = new T.Mesh(boltGeo, darkMat);
      bolt.position.set(Math.cos(boa) * 1.46 * RS, collarY, Math.sin(boa) * 1.46 * RS);
      group.add(bolt);
    }
  }

  // Anneaux de structure (4, métal clair).
  for (var ri = 0; ri < 4; ri++) {
    var ringMesh = new T.Mesh(new T.CylinderGeometry(1.4 * RS, 1.4 * RS, 0.3 * RS, 12), ringMat);
    ringMesh.position.y = (-2.4 + ri * 1.6) * RS;
    group.add(ringMesh);
  }

  // Cône de nez + pointe lumineuse cyan.
  var nose = new T.Mesh(new T.ConeGeometry(1.14 * RS, 2.5 * RS, 12), hullMat);
  nose.position.y = 4.55 * RS;
  group.add(nose);
  var tip = new T.Mesh(new T.SphereGeometry(0.32 * RS, 8, 8), cyanMat);
  tip.position.y = 5.85 * RS;
  group.add(tip);

  // Bandes BLEUES LUMINEUSES le long du corps (2 anneaux émissifs).
  for (var bi = 0; bi < 2; bi++) {
    var band = new T.Mesh(new T.CylinderGeometry(1.32 * RS, 1.32 * RS, 0.32 * RS, 12), cyanDeep);
    band.position.y = (0.4 + bi * 1.9) * RS;
    group.add(band);
  }

  // v17 — HUBLOTS : 2 rangées de 8 fenêtres cyan ENCADRÉES (détail cabine).
  var frameMat = new T.MeshStandardMaterial({
    color: 0x0a0c10, metalness: 0.6, roughness: 0.5
  });
  for (var wr = 0; wr < 2; wr++) {
    for (var w = 0; w < 8; w++) {
      var wa = (w / 8) * Math.PI * 2 + wr * 0.39; // rangées décalées
      var wy = (2.2 - wr * 0.85) * RS;
      var fr = new T.Mesh(new T.BoxGeometry(0.56 * RS, 0.78 * RS, 0.14 * RS), frameMat);
      fr.position.set(Math.cos(wa) * 1.2 * RS, wy, Math.sin(wa) * 1.2 * RS);
      fr.rotation.y = Math.PI / 2 - wa; // face vers l'extérieur
      group.add(fr);
      var win = new T.Mesh(new T.BoxGeometry(0.42 * RS, 0.6 * RS, 0.16 * RS), cyanMat);
      win.position.set(Math.cos(wa) * 1.22 * RS, wy, Math.sin(wa) * 1.22 * RS);
      win.rotation.y = Math.PI / 2 - wa;
      group.add(win);
    }
  }

  // v14 — PANNEAUX DE COQUE : lignes de plaques (anneaux fins sombres) +
  // 4 joints verticaux — détail de carlingue façon Fortnite.
  var panelMat = new T.MeshStandardMaterial({
    color: 0x0e1014, metalness: 0.6, roughness: 0.6
  });
  for (var pl = 0; pl < 3; pl++) {
    var pline = new T.Mesh(new T.CylinderGeometry(1.35 * RS, 1.35 * RS, 0.12 * RS, 12), panelMat);
    pline.position.y = (-1.7 + pl * 1.7) * RS;
    group.add(pline);
  }
  for (var vs = 0; vs < 4; vs++) {
    var va = (vs / 4) * Math.PI * 2 + Math.PI / 8;
    var seam = new T.Mesh(new T.BoxGeometry(0.1 * RS, 5.6 * RS, 0.14 * RS), panelMat);
    seam.position.set(Math.cos(va) * 1.3 * RS, 0.1 * RS, Math.sin(va) * 1.3 * RS);
    seam.rotation.y = Math.PI / 2 - va;
    group.add(seam);
  }

  // v14 — LISERÉS cyan : 2 fines bandes verticales lumineuses sur la coque.
  for (var ps = 0; ps < 2; ps++) {
    var pa = ps * Math.PI + Math.PI / 2;
    var stripe = new T.Mesh(new T.BoxGeometry(0.16 * RS, 5.8 * RS, 0.1 * RS), cyanDeep);
    stripe.position.set(Math.cos(pa) * 1.28 * RS, 0.2 * RS, Math.sin(pa) * 1.28 * RS);
    stripe.rotation.y = Math.PI / 2 - pa;
    group.add(stripe);
  }

  // v14 — MARQUAGE : numéro de la fusée (« 01 »..« 07 ») sur 2 faces.
  var markTex = makeMarkTexture(('0' + (i + 1)).slice(-2));
  var markMat = new T.MeshBasicMaterial({ map: markTex, transparent: true });
  for (var mk = 0; mk < 2; mk++) {
    var ma = mk * Math.PI;
    var plate = new T.Mesh(new T.PlaneGeometry(1.7 * RS, 0.85 * RS), markMat);
    plate.position.set(Math.cos(ma) * 1.38 * RS, 1.1 * RS, Math.sin(ma) * 1.38 * RS);
    plate.rotation.y = Math.PI / 2 - ma; // face vers l'extérieur
    group.add(plate);
  }

  // Jupe moteur À DAMIER noir/blanc.
  var skirt = new T.Mesh(
    new T.CylinderGeometry(1.42 * RS, 1.5 * RS, 1.3 * RS, 12, 1, true), checkMat);
  skirt.position.y = -3.95 * RS;
  group.add(skirt);

  // v17 — 6 AILERONS DÉTAILLÉS (étaient 4) : panneau + bord de fuite en
  // flèche + bord lumineux cyan + feu de position — une fusée qui en impose.
  for (var f = 0; f < 6; f++) {
    var fa = (f / 6) * Math.PI * 2 + Math.PI / 6;
    var ca = Math.cos(fa), sa = Math.sin(fa);
    var fin = new T.Mesh(new T.BoxGeometry(0.26 * RS, 2.6 * RS, 1.9 * RS), darkMat);
    fin.position.set(ca * 1.6 * RS, -3.3 * RS, sa * 1.6 * RS);
    fin.rotation.y = Math.PI / 2 - fa;
    group.add(fin);
    var finTip = new T.Mesh(new T.BoxGeometry(0.2 * RS, 0.9 * RS, 1.2 * RS), hullMat);
    finTip.position.set(ca * 1.62 * RS, -2.15 * RS, sa * 1.62 * RS);
    finTip.rotation.y = Math.PI / 2 - fa;
    finTip.rotation.x = 0.35; // bord de fuite en flèche
    group.add(finTip);
    var edge = new T.Mesh(new T.BoxGeometry(0.28 * RS, 2.4 * RS, 0.16 * RS), cyanMat);
    edge.position.set(ca * 2.56 * RS, -3.3 * RS, sa * 2.56 * RS);
    edge.rotation.y = Math.PI / 2 - fa;
    group.add(edge);
    var navLight = new T.Mesh(new T.SphereGeometry(0.16 * RS, 8, 8), cyanMat);
    navLight.position.set(ca * 2.6 * RS, -2.15 * RS, sa * 2.6 * RS);
    group.add(navLight);
  }

  // Tuyère + point de référence pour la traînée.
  var nozzle = new T.Mesh(new T.CylinderGeometry(0.8 * RS, 1.05 * RS, 0.9 * RS, 10), darkMat);
  nozzle.position.y = -4.9 * RS;
  group.add(nozzle);
  // v14 — TUYÈRE INCANDESCENTE : cône de lueur interne (additif) dont
  // l'intensité suit la poussée (updateEngineGlow, piloté par speedSm).
  var nozzleGlowMat = new T.MeshBasicMaterial({
    color: 0xffb060, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false // v17 : perce le brouillard
  });
  var nozzleGlow = new T.Mesh(new T.ConeGeometry(0.72 * RS, 1.7 * RS, 10, 1, true), nozzleGlowMat);
  nozzleGlow.rotation.x = Math.PI; // pointe vers le bas
  nozzleGlow.position.y = -5.1 * RS;
  group.add(nozzleGlow);
  // v17 — TRIPLE TUYÈRE : 2 moteurs latéraux sous la jupe, chacun avec sa
  // lueur incandescente (animées dans updateEngineGlow via engineGlows).
  var engineGlows = [];
  for (var nz = 0; nz < 2; nz++) {
    var nx = (nz === 0 ? -0.85 : 0.85) * RS;
    var snoz = new T.Mesh(new T.CylinderGeometry(0.42 * RS, 0.58 * RS, 0.7 * RS, 8), darkMat);
    snoz.position.set(nx, -4.55 * RS, 0);
    group.add(snoz);
    var sglowMat = new T.MeshBasicMaterial({
      color: 0xff9a50, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
    });
    var sglow = new T.Mesh(new T.ConeGeometry(0.38 * RS, 1.3 * RS, 8, 1, true), sglowMat);
    sglow.rotation.x = Math.PI; // pointe vers le bas
    sglow.position.set(nx, -4.85 * RS, 0);
    group.add(sglow);
    engineGlows.push({ mesh: sglow, mat: sglowMat });
  }
  // v17 — ANTENNE FOUET sur le cône + BALISE CLIGNOTANTE (updateEngineGlow).
  var whip = new T.Mesh(new T.CylinderGeometry(0.05 * RS, 0.05 * RS, 1.6 * RS, 6), darkMat);
  whip.position.set(0.85 * RS, 5.3 * RS, 0.3 * RS);
  group.add(whip);
  var whipTip = new T.Mesh(new T.SphereGeometry(0.12 * RS, 8, 8), cyanMat);
  whipTip.position.set(0.85 * RS, 6.15 * RS, 0.3 * RS);
  group.add(whipTip);
  // v17 — PARABOLE sur la coque.
  var dish = new T.Mesh(new T.ConeGeometry(0.55 * RS, 0.35 * RS, 10, 1, true), ringMat);
  dish.position.set(1.45 * RS, 0.6 * RS, 0);
  dish.rotation.z = -Math.PI / 2.3;
  group.add(dish);
  // v17 — BALISE (clignote dans updateEngineGlow).
  var beaconMat = new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8 });
  var beacon = new T.Mesh(new T.SphereGeometry(0.2 * RS, 8, 8), beaconMat);
  beacon.position.set(0, 3.55 * RS, 1.28 * RS);
  group.add(beacon);
  // v17 — TUYAUX externes (2) + BLOCS RCS près du nez (4).
  for (var pp = 0; pp < 2; pp++) {
    var ppa = pp * Math.PI + 0.9;
    var pipe = new T.Mesh(new T.CylinderGeometry(0.09 * RS, 0.09 * RS, 5.2 * RS, 6), collarMat);
    pipe.position.set(Math.cos(ppa) * 1.38 * RS, 0, Math.sin(ppa) * 1.38 * RS);
    group.add(pipe);
  }
  for (var rc = 0; rc < 4; rc++) {
    var rca = (rc / 4) * Math.PI * 2;
    var rcs = new T.Mesh(new T.BoxGeometry(0.4 * RS, 0.5 * RS, 0.4 * RS), darkMat);
    rcs.position.set(Math.cos(rca) * 1.25 * RS, 3.1 * RS, Math.sin(rca) * 1.25 * RS);
    group.add(rcs);
  }
  // v17 — EMBLÈME chevron « The Seven » sur 2 faces (en plus du numéro).
  var embMat = new T.MeshBasicMaterial({ map: makeEmblemTexture(), transparent: true });
  for (var eb = 0; eb < 2; eb++) {
    var eba = eb * Math.PI + Math.PI / 2;
    var emb = new T.Mesh(new T.PlaneGeometry(1.5 * RS, 1.5 * RS), embMat);
    emb.position.set(Math.cos(eba) * 1.36 * RS, -0.7 * RS, Math.sin(eba) * 1.36 * RS);
    emb.rotation.y = Math.PI / 2 - eba; // face vers l'extérieur
    group.add(emb);
  }
  var nozzleRef = new T.Object3D();
  nozzleRef.position.y = -5.4 * RS;
  group.add(nozzleRef);

  // Halo du moteur (sprite additif, orange au décollage / cyan en vol).
  // v12 : halo RENFORCÉ (était 16).
  var glow = makeGlowSprite(0xffa030, 20);
  glow.position.y = -5.6 * RS;
  group.add(glow);

  // Cône de flammes orange (décollage) + cœur blanc incandescent.
  // v12 : flammes ALLONGÉES (9*RS / 6*RS, étaient 7*RS / 4.5*RS).
  var flameMat = new T.MeshBasicMaterial({
    color: 0xff9a40, transparent: true, opacity: 0.92,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false // v17 : perce le brouillard (42 km)
  });
  var flame = new T.Mesh(new T.ConeGeometry(1.5 * RS, 9 * RS, 10, 1, true), flameMat);
  flame.rotation.x = Math.PI; // pointe vers le bas
  flame.position.y = -8.9 * RS;
  flame.visible = false;
  group.add(flame);
  var coreMat = new T.MeshBasicMaterial({
    color: 0xfff3d0, transparent: true, opacity: 0.95,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false // v17 : perce le brouillard (42 km)
  });
  var core = new T.Mesh(new T.ConeGeometry(0.8 * RS, 6 * RS, 8, 1, true), coreMat);
  core.rotation.x = Math.PI;
  core.position.y = -7.6 * RS;
  core.visible = false;
  group.add(core);

  // Traînée : pool d'historique des positions de la tuyère (< 500).
  var n = trailN;
  var positions = new Float32Array(n * 3);
  var colors = new Float32Array(n * 3);
  var ages = new Float32Array(n);
  for (var k = 0; k < n; k++) ages[k] = trailLife + 1;
  var tgeo = new T.BufferGeometry();
  tgeo.setAttribute('position', new T.BufferAttribute(positions, 3));
  tgeo.setAttribute('color', new T.BufferAttribute(colors, 3));
  var tmat = new T.PointsMaterial({
    size: 12, vertexColors: true, transparent: true,
    blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false // v17 : la traînée perce le brouillard
  });
  var points = new T.Points(tgeo, tmat);
  points.frustumCulled = false;
  points.visible = false;

  // v17 — ÉCLAIR DE TUYÈRE : sprite blanc-cyan qui FLASHE quand la poussée
  // ou le virage est brutal (mission 6, animé dans updateEngineGlow).
  var flashMat = new T.SpriteMaterial({
    map: glowTex, color: 0xcfeeff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });
  var flash = new T.Sprite(flashMat);
  flash.position.y = -5.8 * RS;
  flash.scale.set(10, 10, 1);
  group.add(flash);

  // v21 — REFLET DE COQUE : petit sprite blanc qui « accroche » le soleil
  // par pulsations brèves — un reflet qui balaie la coque (animé dans
  // updateEngineGlow, zéro allocation).
  var glint = makeGlowSprite(0xffffff, 7);
  glint.position.set(0.9 * RS, 1.2 * RS, 0.9 * RS);
  glint.material.opacity = 0;
  group.add(glint);

  return {
    index: i, group: group, glow: glow, flame: flame, core: core,
    nozzleRef: nozzleRef, nozzleGlow: nozzleGlow, nozzleGlowMat: nozzleGlowMat, // v14 : tuyère incandescente
    engineGlows: engineGlows, beaconMat: beaconMat, flash: flash, // v17 : tuyères latérales, balise, éclair de tuyère
    glint: glint, // v21 : reflet de coque
    // v22 — PERSONNALITÉ : chaque fusée a sa fréquence de pulsation moteur,
    // sa graine de scintillement, sa largeur de traînée, son compte à
    // rebours de sursaut moteur — micro-variations, cohérence gardée.
    pulseFreq: 3.4 + i * 0.28, flickSeed: i * 1.7,
    trailWidthMul: 0.9 + 0.2 * ((i * 3) % 5) / 4,
    surgeT: 2 + i * 1.3, surgeK: 0,
    engIg: [true, true, true], // v22 : allumage séquencé (réarmé à chaque décollage)
    spacePuffAcc: 0,           // v22 : accumulateur de traînée volumineuse (vol)
    trail: { points: points, geo: tgeo, positions: positions, colors: colors,
             ages: ages, head: 0 },
    prev: new T.Vector3(), hasPrev: false,
    velDir: null, bankSm: 0, // v9 : direction précédente + roulis lissé (bank)
    turnSm: 0, speedSm: 0,   // v10 : virage lissé (épaissit la traînée) + vitesse lissée (flammes/halo)
    rollAng: 0, rollRate: 0, // v11 : tonneau (barrel roll) pendant les vols rapides
    formInit: false,         // v14 : formation (meteorsix/descent) initialisée sans à-coup
    launchSpdSm: 0, launchPrevY: 0, // v15 : vitesse verticale mesurée du décollage (m/s, lissée)
    // état de chorégraphie (réinitialisé à chaque entrée de phase)
    convFrom: new T.Vector3(), convIn: false,
    convTArr: 0, convTRe: 0, // v10 : arrivée / réapparition (convergence)
    convAz: 0,               // v17 : azimut d'approche propre (encerclement 360°)
    launchT: -1, launched: false, appearT: -1, launchCrossed: false,
    crossT: 0, shakeSeed: 0, // v10 : entrée dans la faille de décollage + graine de vibration
    dance: null,             // v10 : jambes de la danse des failles (sixrockets)
    prevU: 0, frontSent: false, backSent: false, // v10 : passages faille avant/arrière (loop)
    loopU: 0, nearMet: false, curve: null,
    // v17 : survol/balayage dynamique (loop) — passe unique, pas de cercles.
    sweepCurve: null, sweepAz: 0, sweepT0: 0, sweepDur: 1, sweepShockSent: false,
    joinFrom: null, joinT: 0, // v17 : jonction douce loop -> acceleration (1,5 s)
    turnRaw: 0, lastShockT: -10, // v17 : virage brut (onde de choc) + anti-rebond
    escOff: 0, escDur: 3, escDone: false, escRiftSent: false,
    escFrom: new T.Vector3(), escCtl: new T.Vector3(), escTo: new T.Vector3(),
    strikeFrom: new T.Vector3(), strikeTop: new T.Vector3(),
    strikeTarget: new T.Vector3(), strikeDived: false, fadeOut: false,
    peelFrom: new T.Vector3(), peeling: false, peelT0: 0, peeled: false,
    // v21 : chorégraphie enrichie (réinitialisés dans resetRun / enterPhase)
    sparkT: 0.4 + Math.random() * 0.8, // étincelles de coque (compte à rebours)
    signalMode: false,      // chenille lumineuse des balises (formation)
    riftHaloSent: false,    // halo d'anticipation (convergence)
    peelHaloSent: false,    // halo d'anticipation (acceleration)
    escHaloSent: false,     // halo d'anticipation (veeroff)
    strikeHaloSent: false,  // halo d'anticipation (strike)
    mile: 0,                // jalons d'altitude franchis (montée)
    rumble1: false, rumble2: false, rumble3: false, rumbleG: false, // grondement montant
    antiS1: false, antiS2: false, antiS3: false, // v24 : grondement d'anticipation (paliers)
    destrT: 0,              // épave incandescente après destruction (n°1)
    destrPos: null,         // position de l'impact (n°1)
    alive: false
  };
}

/* ---------------------------------------------------------------------------
 * Traînée : dépôt et vieillissement.
 * 'fire'  : tête BLANC CHAUD incandescente -> orange -> sombre (décollage).
 * 'space' : tête blanc-cyan -> cyan/bleu électrique (vol nocturne).
 * ------------------------------------------------------------------------- */

function trailPush(r) {
  if ((frame % trailEvery) !== 0) return;
  var tr = r.trail;
  r.nozzleRef.getWorldPosition(_v1);
  var i3 = tr.head * 3;
  // v14 : légère dispersion latérale — traînée de condensation plus
  // volumineuse et naturelle (panache, pas un fil parfait).
  // v15 : élargie par trailSpread pendant la montée du décollage.
  var jx = (Math.random() - 0.5) * 0.9 * RS * trailSpread;
  var jz = (Math.random() - 0.5) * 0.9 * RS * trailSpread;
  tr.positions[i3] = _v1.x + jx; tr.positions[i3 + 1] = _v1.y; tr.positions[i3 + 2] = _v1.z + jz;
  tr.ages[tr.head] = 0;
  tr.head = (tr.head + 1) % trailN;
  tr.points.visible = true;
  tr.geo.attributes.position.needsUpdate = true;
}

function trailUpdate(r, dt) {
  var tr = r.trail, dirty = false;
  for (var i = 0; i < trailN; i++) {
    if (tr.ages[i] > trailLife) continue;
    tr.ages[i] += dt;
    dirty = true;
    var f = 1 - tr.ages[i] / trailLife;
    if (f < 0) f = 0;
    var i3 = i * 3;
    if (trailMode === 'space') {
      // Cyan/bleu électrique : tête quasi blanche, queue cyan qui s'éteint.
      tr.colors[i3] = f * f * 0.7;
      tr.colors[i3 + 1] = f * (0.6 + 0.4 * f);
      tr.colors[i3 + 2] = f;
    } else {
      // Feu incandescent : tête blanc chaud -> orange -> braise sombre.
      tr.colors[i3] = f;
      tr.colors[i3 + 1] = 0.25 * f + 0.7 * f * f;
      tr.colors[i3 + 2] = 0.1 * f + 0.75 * f * f * f;
    }
  }
  if (dirty) tr.geo.attributes.color.needsUpdate = true;
}

// Bascule la couleur des traînées + du halo moteur des 7 fusées.
function setTrailMode(mode) {
  trailMode = mode;
  var col = (mode === 'space') ? 0x7fdcff : 0xffa030;
  for (var i = 0; i < rockets.length; i++) {
    if (rockets[i].glow) rockets[i].glow.material.color.setHex(col);
  }
}

// v20 — accès DÉFENSIF au toolkit de particules partagé (event-particles.js :
// sparkJet, fire, smoke, sparkle) + facteur de densité mobile (iPhone :
// ~45 % comme le module de particules). Tout est try/catch : le jeu ne
// doit jamais casser si le toolkit est indisponible.
function fx20() {
  try { return root.AZEvent.fx || null; } catch (e) { return null; }
}
function dens20() {
  try { return (api && (api.quality === 'low' || api.isMobile)) ? 0.45 : 1; }
  catch (e) { return 1; }
}

// v20 — TRAINÉE DE PARTICULES sur la trajectoire : à chaque appel, des
// bouffées de feu + fumée naissent à la tuyère (position monde live) et
// dérivent derrière la fusée — la traînée 3D (ruban) gagne une vraie
// matière volumineuse. Cadence gérée par l'appelant (frame % N).
function contrailPuff(r, fireUp, smokeUp) {
  var fx = fx20();
  if (!fx || !r || !r.nozzleRef) return;
  try {
    r.nozzleRef.getWorldPosition(_v1);
    var d = dens20();
    fx.fire(_v1, { count: Math.max(1, Math.round(3 * d)), spread: 6,
      size: 9, life: 0.7, up: fireUp });
    fx.smoke(_v1, { count: Math.max(1, Math.round(4 * d)), spread: 10,
      size: 16, life: 2.4, rise: smokeUp, alpha: 0.42 });
  } catch (e) { /* jamais bloquant */ }
}

function trailClear(r) {
  var tr = r.trail;
  for (var i = 0; i < trailN; i++) tr.ages[i] = trailLife + 1;
  tr.points.visible = false;
}

function orientAlong(r, dir) {
  _v2.copy(dir);
  if (_v2.lengthSq() < 1e-6) _v2.set(0, 1, 0);
  _v2.normalize();
  _q.setFromUnitVectors(_up, _v2);
  r.group.quaternion.copy(_q);
}

// v14 : applique le roulis ABSOLU (bank lissé + tonneau) sur l'orientation
// courante — à appeler APRÈS orientAlong (l'orientation de base est
// reconstruite à neuf à chaque frame : le roulis ne s'accumule jamais).
function applyRoll(r) {
  var roll = (r.bankSm || 0) + (r.rollAng || 0);
  if (roll > 0.001 || roll < -0.001) {
    _q2.setFromAxisAngle(_up, roll); // roulis local (axe du nez)
    r.group.quaternion.multiply(_q2);
  }
}

// Orientation le long de la vitesse mesurée (trajectoires libres).
// v9 : + inclinaison (bank) dans les virages — la fusée penche en virage,
// comme un avion, au lieu de rester rigide.
// v10 : + turnSm (virage lissé 0..1 -> épaissit la traînée) et speedSm
// (vitesse lissée -> flammes/fumée/halo réagissent à la vitesse).
function orientVel(r) {
  var p = r.group.position;
  if (r.hasPrev) {
    _v2.copy(p).sub(r.prev);
    var spd = _v2.length();
    if (spd > 1e-8) {
      _v2.multiplyScalar(1 / spd);
      if (r.velDir) {
        // Angle signé du virage (autour de l'axe vertical monde).
        _v3.crossVectors(r.velDir, _v2);
        var s = _v3.length();
        if (s > 1) s = 1;
        var turn = Math.asin(s) * (_v3.y >= 0 ? 1 : -1);
        r.turnRaw = turn; // v17 : virage BRUT (déclenche l'onde de choc aux changements de cap)
        var target = -turn * 22; // gain : ~30° pour un virage à 90°/s
        if (target > 0.85) target = 0.85;
        else if (target < -0.85) target = -0.85;
        r.bankSm += (target - r.bankSm) * 0.10; // lissage
        // v10 : intensité du virage (lissée) pour la traînée.
        var tm = Math.min(1, Math.abs(turn) * 2.5);
        r.turnSm += (tm - r.turnSm) * 0.12;
      } else {
        r.velDir = new T.Vector3();
        r.bankSm = 0;
        r.turnSm = 0;
        r.turnRaw = 0; // v17 : pas de virage (téléportation)
      }
      r.velDir.copy(_v2);
      orientAlong(r, _v2);
      // v11 : tonneau (barrel roll) ajouté au roulis — la fusée tournoie
      // sur elle-même pendant les vols rapides (spectaculaire, fluide).
      applyRoll(r); // v14 (bankSm + rollAng, absolu)
    }
    r.speedSm += (spd - r.speedSm) * 0.08; // v10 : vitesse lissée (m/frame)
  } else {
    r.bankSm = 0; r.velDir = null; r.turnSm = 0; r.turnRaw = 0; // v17 : téléportation : pas de virage résiduel
  }
  r.prev.copy(p);
  r.hasPrev = true;
}

// v10 : la traînée s'ÉPAISSIT dans les virages (mouvement secondaire).
// v14 : + avec la vitesse (speedSm) — plein gaz = panache plus large.
var TRAIL_BASE_SIZE = 16; // v12 : traînée plus épaisse (était 12)
function trailSizeUpdate(r) {
  if (!r.trail || !r.trail.points || !r.trail.points.material) return;
  var want = TRAIL_BASE_SIZE * (1 + 1.35 * clamp01(r.turnSm || 0)
                             + 0.7 * clamp01((r.speedSm || 0) * 0.025)
                             + 2.0 * clamp01((r.launchSpdSm || 0) / 4000)) * (r.trailWidthMul || 1); // v22 : chaque fusée a sa largeur de traînée
  var m = r.trail.points.material;
  if (Math.abs(m.size - want) > 0.05) m.size = want;
}

// v14 : la TUYÈRE INCANDESCENTE suit la poussée (speedSm) avec un léger
// scintillement — les moteurs « respirent ». Piloté chaque frame pour les
// fusées vivantes (boucle principale).
function updateEngineGlow(r, t) {
  if (!r.nozzleGlowMat) return;
  // v15 : la poussée du décollage (vitesse verticale mesurée, m/s) nourrit
  // aussi la tuyère — le moteur « respire » avec la montée.
  // v21 : PULSATION PROFONDE du moteur — le cœur bat lentement (la
  // puissance se SENT), par-dessus le scintillement rapide existant.
  // v22 : PERSONNALITÉ — chaque fusée a sa fréquence de pulsation et sa
  // graine de scintillement (micro-variations, cohérence gardée).
  var beat = 0.78 + 0.22 * Math.sin(t * (r.pulseFreq || 3.4) + r.index * 1.3);
  var heat = r.alive ? clamp01(0.30 + (r.speedSm || 0) * 0.035 + (r.launchSpdSm || 0) * 0.0018) : 0;
  heat = clamp01(heat * (1 + 1.3 * (r.surgeK || 0))); // v22 : sursaut moteur
  var fs2 = (r.flickSeed !== undefined) ? r.flickSeed : r.index * 1.7;
  // v22 — ALLUMAGE SÉQUENCÉ : moteur pas encore allumé = quasi pas de lueur.
  var igC = (r.engIg && !r.engIg[0]) ? 0.22 : 1;
  r.nozzleGlowMat.opacity = heat * igC * (0.72 + 0.28 * Math.sin(t * 39 + fs2 * 7)) * beat;
  if (r.nozzleGlow) {
    var gs = 0.85 + 0.35 * heat * (0.9 + 0.1 * Math.sin(t * 47 + fs2));
    r.nozzleGlow.scale.set(gs, 0.8 + 0.5 * heat, gs);
  }
  // v17 — les TUYÈRES LATÉRALES respirent avec la centrale.
  if (r.engineGlows) {
    for (var eg = 0; eg < r.engineGlows.length; eg++) {
      var egd = r.engineGlows[eg];
      // v22 — chaque tuyère latérale a sa lampe (allumage séquencé).
      var igL = (r.engIg && !r.engIg[eg + 1]) ? 0.2 : 1;
      egd.mat.opacity = heat * igL * (0.55 + 0.35 * Math.sin(t * 43 + fs2 * 11 + eg));
      var egs = 0.8 + 0.5 * heat;
      egd.mesh.scale.set(egs, 0.75 + 0.6 * heat, egs);
    }
  }
  // v17 — BALISE clignotante (détail du nouveau modèle).
  // v21 — SIGNAUX LUMINEUX ENTRE FUSÉES : en formation (signalMode), les
  // balises pulsent en CHENILLE (l'impulsion lumineuse passe de fusée en
  // fusée, 0 -> 6 -> 0) — les 7 « se parlent » en morse lumineux.
  if (r.beaconMat) {
    if (r.signalMode && r.alive) {
      var cyc = (((t * 2.2 - r.index) % N) + N) % N;
      r.beaconMat.opacity = (cyc < 1) ? 1 : 0.12;
    } else {
      r.beaconMat.opacity = r.alive ? (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 7 + r.index * 2.1))) : 0;
    }
  }
  // v17 — ÉCLAIR DE TUYÈRE : flash bref quand la poussée ou le virage est
  // brutal (mission 6 : les moteurs « crachent » dans les manœuvres).
  if (r.flash) {
    var fl = clamp01((r.speedSm || 0) * 0.02 + (r.turnSm || 0) * 0.9 + (r.launchSpdSm || 0) * 0.0012);
    fl *= 0.55 + 0.45 * Math.sin(t * 57 + r.index * 3.1);
    r.flash.material.opacity = 0.9 * fl;
    var fls = 8 + 52 * fl * (1 + (r.turnSm || 0));
    r.flash.scale.set(fls, fls, 1);
  }
  // v21 — REFLET DE COQUE : pulsation brève et intense — le soleil
  // « accroche » la coque par instants (reflet qui balaie, jamais constant).
  if (r.glint) {
    var gp = Math.pow(Math.max(0, Math.sin(t * 2.1 + r.index * 2.7)), 10);
    r.glint.material.opacity = r.alive ? 0.9 * gp : 0;
    var gsc = 5 + 5 * gp;
    r.glint.scale.set(gsc, gsc, 1);
  }
}

/* ---------------------------------------------------------------------------
 * v17 — ONDES DE CHOC aux changements de cap (mission 6) : quand une fusée
 * vire BRUTALEMENT, un anneau d'énergie « claqué » s'étend autour d'elle
 * (0,55 s) puis s'éteint. Pool d'un anneau par fusée (zéro allocation par
 * frame) ; déclenché depuis la boucle principale via r.turnRaw.
 * ------------------------------------------------------------------------- */

function buildTurnRings() {
  turnRings = [];
  for (var i = 0; i < N; i++) {
    var mat = new T.MeshBasicMaterial({
      color: 0xbfe9ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
    });
    var geo = new T.TorusGeometry(1, 0.05, 8, 48);
    if (geo.rotateX) geo.rotateX(Math.PI / 2); // axe du tore -> +Y (s'aligne à la vitesse)
    var mesh = new T.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    turnRings.push({ mesh: mesh, mat: mat, t: 1e9, s: 1 });
    if (scene) scene.add(mesh);
  }
}

// « Claque » un anneau d'énergie sur la fusée (force s ≈ |virage|).
function fireTurnShock(r, s) {
  var sh = turnRings[r.index];
  if (!sh || !sh.mesh) return;
  sh.mesh.position.copy(r.group.position);
  if (r.velDir) { _q.setFromUnitVectors(_up, r.velDir); sh.mesh.quaternion.copy(_q); }
  else sh.mesh.quaternion.copy(r.group.quaternion);
  sh.t = 0; sh.s = s || 1;
  sh.mesh.visible = true;
}

function updateTurnShocks(dt) {
  for (var i = 0; i < turnRings.length; i++) {
    var sh = turnRings[i];
    if (!sh.mesh.visible) continue;
    sh.t += dt;
    var k = clamp01(sh.t / 0.55);
    var rad = (12 + 120 * sh.s) * (0.3 + 0.7 * easeOutBack(k));
    sh.mesh.scale.set(rad, 1, rad);
    sh.mat.opacity = 0.85 * (1 - k);
    if (k >= 1) sh.mesh.visible = false;
  }
}

/* ---------------------------------------------------------------------------
 * v21 — FLASH DE FAILLE (traversées spectaculaires, mission 4) : chaque
 * entrée/sortie de faille suit la même grammaire cause -> effet, en
 * 3 temps LISIBLES — IMPLOSION (l'anneau se resserre : la faille
 * « aspire », 0,35) -> FLASH (pic blanc bref, 0,2) -> DISTORSION (halo qui
 * s'étend et s'éteint). Pool de 8 (zéro allocation par frame), orienté
 * selon la direction de traversée. Couleur = signature de la fusée
 * (RIFT_COLORS : variations entre les 7).
 * ------------------------------------------------------------------------- */

function buildRiftFlashes() {
  riftFlashes = [];
  for (var i = 0; i < RIFTFLASH_N; i++) {
    var g = new T.Group();
    var rgeo = new T.TorusGeometry(1, 0.06, 8, 48);
    if (rgeo.rotateX) rgeo.rotateX(Math.PI / 2); // axe du tore -> +Y
    var rmat = new T.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
    });
    var rmesh = new T.Mesh(rgeo, rmat);
    rmesh.frustumCulled = false;
    rmesh.visible = false;
    var fmat = new T.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var fspr = new T.Sprite(fmat);
    fspr.visible = false;
    var hmat = new T.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var hspr = new T.Sprite(hmat);
    hspr.visible = false;
    g.add(rmesh); g.add(fspr); g.add(hspr);
    g.visible = false;
    if (scene) scene.add(g);
    riftFlashes.push({
      g: g, ring: rmesh, ringMat: rmat, flash: fspr, flashMat: fmat,
      halo: hspr, haloMat: hmat, t: 1e9, dur: 0.7, maxR: 90
    });
  }
}

// Déclenche un flash de faille en (x,y,z), orienté selon (dx,dy,dz).
function spawnRiftFlash(x, y, z, color, maxR, dur, dx, dy, dz) {
  if (!riftFlashes.length) return;
  var f = null;
  for (var i = 0; i < riftFlashes.length; i++) {
    if (riftFlashes[i].t >= riftFlashes[i].dur) { f = riftFlashes[i]; break; }
  }
  if (!f) f = riftFlashes[0]; // pool saturé : on vole la plus ancienne
  f.t = 0;
  f.dur = dur || 0.7;
  f.maxR = maxR || 90;
  f.g.position.set(x, y, z);
  _v1.set(dx || 0, (dy === undefined ? 1 : dy), dz || 0);
  if (_v1.lengthSq() < 1e-6) _v1.set(0, 1, 0);
  _v1.normalize();
  _q.setFromUnitVectors(_up, _v1);
  f.ring.quaternion.copy(_q);
  f.ringMat.color.setHex(color || 0x9fe8ff);
  f.flashMat.color.setHex(0xffffff);
  f.haloMat.color.setHex(color || 0x9fe8ff);
  f.g.visible = true;
}

function updateRiftFlashes(dt) {
  for (var i = 0; i < riftFlashes.length; i++) {
    var f = riftFlashes[i];
    if (!f.g.visible) continue;
    f.t += dt;
    var k = f.t / f.dur;
    if (k >= 1) {
      f.g.visible = false;
      f.ring.visible = false; f.flash.visible = false; f.halo.visible = false;
      continue;
    }
    if (k < 0.35) {
      // 1. IMPLOSION : l'anneau se resserre vers le centre (la faille aspire).
      var ik = k / 0.35;
      var rr = f.maxR * (1 - 0.85 * easeIn(ik));
      f.ring.visible = true;
      f.ring.scale.set(rr, 1, rr);
      f.ringMat.opacity = 0.9;
      f.flash.visible = false;
      f.halo.visible = true;
      var hs = f.maxR * 0.4 * (1 + ik * 0.3);
      f.halo.scale.set(hs, hs, 1);
      f.haloMat.opacity = 0.25 * ik;
    } else if (k < 0.55) {
      // 2. FLASH : pic blanc bref au centre.
      var fk = (k - 0.35) / 0.2;
      f.ring.visible = false;
      f.flash.visible = true;
      var fs2 = f.maxR * (0.8 + 0.5 * fk);
      f.flash.scale.set(fs2, fs2, 1);
      f.flashMat.opacity = 1 - fk * 0.4;
      f.halo.visible = true;
      f.halo.scale.set(f.maxR * 0.6, f.maxR * 0.6, 1);
      f.haloMat.opacity = 0.3;
    } else {
      // 3. DISTORSION : halo qui s'étend et s'éteint (l'espace se referme).
      var hk = (k - 0.55) / 0.45;
      f.flash.visible = false;
      f.halo.visible = true;
      var hs2 = f.maxR * (0.6 + 1.3 * easeOutBack(hk));
      f.halo.scale.set(hs2, hs2, 1);
      f.haloMat.opacity = 0.45 * (1 - hk);
    }
  }
}

// v21 — TRAVERSÉE DE FAILLE EN UN APPEL : implosion (le toolkit partagé) +
// flash blanc + débris incandescents + flash de faille local.
// v = 0..6 : variation entre les 7 (couleur + ampleur). Défensif (try/catch),
// densité réduite sur mobile via dens20().
// v22 — la traversée claque PLUS FORT : STREAK lumineuse le long de la
// direction de traversée (couleur de la fusée) + CICATRICE rémanente (un
// halo qui s'éteint lentement — la faille « saigne » de la lumière) ; la
// durée du flash varie par fusée (signatures distinctes).
function riftCrossFX(x, y, z, v, dx, dy, dz) {
  var col = RIFT_COLORS[((v % 7) + 7) % 7];
  var fx = fx20();
  var d = dens20();
  if (fx) {
    try {
      fx.implosion({ x: x, y: y, z: z },
        { count: Math.max(20, Math.round(90 * d)), color: col, radius: 90, speed: 200, size: 7 });
      fx.burst({ x: x, y: y, z: z },
        { count: Math.max(10, Math.round(40 * d)), color: 0xffffff, speed: 160, life: 0.7, size: 8, gravity: 0 });
      // v22 — STREAK : traînée de lumière le long de la traversée.
      var sdy = (dy === undefined ? 1 : dy);
      fx.sparkJet({ x: x, y: y, z: z },
        { count: Math.max(6, Math.round(30 * d)),
          dir: { x: dx || 0, y: sdy, z: dz || 0 }, spread: 0.35,
          speed: 420 + 60 * v, color: col, size: 7, life: 0.9, gravity: 0 });
      // v22 — CICATRICE : halo rémanent qui s'éteint lentement.
      fx.halo({ x: x, y: y, z: z },
        { anticip: 0.25, dur: 1.8, radius: 70 + v * 10, color: col });
    } catch (e) { /* jamais bloquant */ }
  }
  spawnDebris(x, y, z, 14 + v * 3, 26, 50);
  spawnRiftFlash(x, y, z, col, 90 + v * 18, 0.7 + v * 0.05, dx, dy, dz);
}

// v21 — ÉTINCELLES DE COQUE : de temps en temps, la coque « crache » une
// poignée d'étincelles (soudure/orange, parfois cyan) — la fusée vit,
// même en vol stable. Cadencé par r.sparkT (boucle principale).
function hullSpark(r) {
  var fx = fx20();
  if (!fx) return;
  try {
    var d = dens20();
    if (d < 1 && Math.random() < 0.5) return; // mobile : une fois sur deux
    var a = Math.random() * Math.PI * 2;
    var hr = 1.5 * RS;
    _v1.set(Math.cos(a) * hr, (Math.random() - 0.5) * 8 * RS, Math.sin(a) * hr);
    r.group.localToWorld(_v1);
    fx.sparkle({ x: _v1.x, y: _v1.y, z: _v1.z }, {
      count: Math.max(2, Math.round(6 * d)), spread: 8,
      size: 4, life: 0.5, color: (Math.random() < 0.3 ? 0x9fe8ff : 0xffd9a0)
    });
  } catch (e) { /* jamais bloquant */ }
}

/* ---------------------------------------------------------------------------
 * v21 — PORTIQUE DE LANCEMENT : tour de service sobre à côté du pas de tir
 * (mât + 2 bras + feux cyan), qui TREMBLE pendant l'anticipation et le
 * début de la montée — la puissance du décollage fait vibrer la structure
 * (cause -> effet visible) — puis s'efface. Créé paresseusement au premier
 * décollage, zéro allocation par frame. Pas de nouvelle histoire : c'est
 * un décor qui vibre, il ne s'effondre pas.
 * ------------------------------------------------------------------------- */

function buildGantry(pad) {
  // v21 — idempotent : rejouer l'événement (resetRun) ne doit jamais empiler
  // des portiques — l'ancien groupe est retiré de la scène avant reconstruction.
  if (gantry && gantry.group) {
    try { var sc0 = scene(); if (sc0) sc0.remove(gantry.group); } catch (e) { /* jamais bloquant */ }
    gantry = null;
  }
  if (!scene || !T) return;
  var g = new T.Group();
  var gm = new T.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.8, roughness: 0.45 });
  var lampMat = new T.MeshBasicMaterial({ color: 0x4fe3ff });
  var mast = new T.Mesh(new T.CylinderGeometry(1.6, 2.2, 46, 8), gm);
  mast.position.y = 23;
  g.add(mast);
  for (var a = 0; a < 2; a++) {
    var arm = new T.Mesh(new T.BoxGeometry(14, 1.6, 1.6), gm);
    arm.position.set(-7, 14 + a * 14, 0); // bras vers la fusée (-X)
    g.add(arm);
    var lamp = new T.Mesh(new T.SphereGeometry(0.9, 8, 8), lampMat);
    lamp.position.set(-13.5, 14 + a * 14, 0);
    g.add(lamp);
  }
  var plat = new T.Mesh(new T.BoxGeometry(10, 2, 10), gm);
  plat.position.y = 1;
  g.add(plat);
  gantryX = pad.x + 30; gantryZ = pad.z + 16; gantryBaseY = pad.y || 0;
  g.position.set(gantryX, gantryBaseY, gantryZ);
  g.visible = false;
  scene.add(g);
  gantry = g;
}

function updateGantry(ts, lt, launched, launchCrossed) {
  if (!gantry) return;
  var amp = 0;
  if (!launched) {
    var k = clamp01(ts / LAUNCH_ANTICIP);
    amp = 1.4 * k * k; // tremble de plus en plus fort avant le décollage
    gantry.visible = true;
  } else if (lt < 1.5 && !launchCrossed) {
    amp = 1.4 * (1 - lt / 1.5); // secousse résiduelle juste après le décollage
    gantry.visible = true;
  } else {
    gantry.visible = false;
    return;
  }
  gantry.position.set(
    gantryX + (Math.random() - 0.5) * amp,
    gantryBaseY + (Math.random() - 0.5) * amp * 0.4,
    gantryZ + (Math.random() - 0.5) * amp
  );
}

function setVisible(r, v) {
  r.group.visible = v;
  r.alive = v;
  // v15 : la vitesse de montée mesurée est réinitialisée à chaque masquage
  // (elle ne doit jamais fuir vers une autre phase).
  if (!v) { trailClear(r); r.hasPrev = false; r.flame.visible = false; r.core.visible = false; r.launchSpdSm = 0; }
  else if (!r.hasPrev) { r.prev.copy(r.group.position); r.hasPrev = true; }
}

function hideAll() {
  for (var i = 0; i < N; i++) setVisible(rockets[i], false);
  if (laserG) laserG.visible = false;
  if (ring) ring.visible = false;
  hideLinks();
  if (smoke) smoke.points.visible = false;
}

/* ---------------------------------------------------------------------------
 * Fumée blanche MASSIVE du décollage : explose vers l'extérieur au sol.
 * Additive dense = masse blanche bien visible ; s'éteint en virant au noir.
 * ------------------------------------------------------------------------- */

function buildSmoke() {
  var n = api && api.isMobile ? 300 : 520; // v12 : fumée PLUS DENSE (était 220/400)
  var positions = new Float32Array(n * 3);
  var colors = new Float32Array(n * 3);
  var vel = new Float32Array(n * 3);
  var life = new Float32Array(n);
  for (var i = 0; i < n; i++) life[i] = -1;
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  var mat = new T.PointsMaterial({
    size: 200, map: glowTex, vertexColors: true, transparent: true, // v12 : panaches plus gros (était 170)
    opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true
  });
  var points = new T.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return { points: points, geo: geo, positions: positions, colors: colors,
           vel: vel, life: life, n: n, head: 0 };
}

// Rafale de fumée : explose vers l'EXTÉRIEUR (vitesses horizontales fortes).
function smokeBurst(px, py, pz, count, spread, power) {
  for (var k = 0; k < count; k++) {
    var i = smoke.head;
    smoke.head = (smoke.head + 1) % smoke.n;
    var i3 = i * 3;
    var a = Math.random() * Math.PI * 2;
    var rr = Math.random() * spread;
    smoke.positions[i3] = px + Math.cos(a) * rr;
    smoke.positions[i3 + 1] = py + Math.random() * 8;
    smoke.positions[i3 + 2] = pz + Math.sin(a) * rr;
    var sp = power * (0.5 + Math.random());
    smoke.vel[i3] = Math.cos(a) * sp;          // explosion horizontale
    smoke.vel[i3 + 1] = 30 + Math.random() * 60;
    smoke.vel[i3 + 2] = Math.sin(a) * sp;
    smoke.life[i] = 0;
  }
  smoke.points.visible = true;
}

function smokeUpdate(dt) {
  var dirty = false;
  for (var i = 0; i < smoke.n; i++) {
    if (smoke.life[i] < 0) continue;
    smoke.life[i] += dt;
    dirty = true;
    var L = 3.2;
    if (smoke.life[i] > L) { smoke.life[i] = -1; continue; }
    var i3 = i * 3;
    smoke.positions[i3] += smoke.vel[i3] * dt;
    smoke.positions[i3 + 1] += smoke.vel[i3 + 1] * dt;
    smoke.positions[i3 + 2] += smoke.vel[i3 + 2] * dt;
    smoke.vel[i3 + 1] += 14 * dt; // la fumée monte en s'étalant
    var f = 1 - smoke.life[i] / L;
    var g = f * f; // blanc massif -> noir (invisible en additif)
    smoke.colors[i3] = g; smoke.colors[i3 + 1] = g; smoke.colors[i3 + 2] = g * 1.02;
  }
  if (dirty) {
    smoke.geo.attributes.position.needsUpdate = true;
    smoke.geo.attributes.color.needsUpdate = true;
  }
}

/* ---------------------------------------------------------------------------
 * v17 — DÉBRIS INCANDESCENTS au largage (mission 6) : quand une fusée entre
 * dans une faille / est larguée, des éclats incandescents giclent puis
 * retombent en s'éteignant (incandescent -> braise). Un seul Points
 * (240 particules), zéro allocation par frame.
 * ------------------------------------------------------------------------- */

function buildDebris() {
  var n = DEBRIS_N;
  var positions = new Float32Array(n * 3);
  var colors = new Float32Array(n * 3);
  var vel = new Float32Array(n * 3);
  var life = new Float32Array(n);
  for (var i = 0; i < n; i++) life[i] = -1;
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  var mat = new T.PointsMaterial({
    size: 10, map: glowTex, vertexColors: true, transparent: true, opacity: 0.95,
    blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
  });
  var points = new T.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return { points: points, geo: geo, positions: positions, colors: colors,
           vel: vel, life: life, n: n, head: 0 };
}

// Giclée de débris à (x,y,z) : count éclats, dispersion spread, poussée up.
function spawnDebris(x, y, z, count, spread, up) {
  if (!debris) return;
  for (var k = 0; k < count; k++) {
    var i = debris.head;
    debris.head = (debris.head + 1) % debris.n;
    var i3 = i * 3;
    var a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
    var sp = (40 + Math.random() * 90) * (spread / 24);
    debris.positions[i3] = x + (Math.random() - 0.5) * 6;
    debris.positions[i3 + 1] = y + (Math.random() - 0.5) * 6;
    debris.positions[i3 + 2] = z + (Math.random() - 0.5) * 6;
    debris.vel[i3] = Math.cos(a) * Math.cos(b) * sp;
    debris.vel[i3 + 1] = Math.abs(Math.sin(b)) * sp * 0.7 + (up || 0);
    debris.vel[i3 + 2] = Math.sin(a) * Math.cos(b) * sp;
    debris.life[i] = 0;
  }
  debris.points.visible = true;
}

function debrisUpdate(dt) {
  if (!debris || !debris.points.visible) return;
  var dirty = false, any = false;
  for (var i = 0; i < debris.n; i++) {
    if (debris.life[i] < 0) continue;
    debris.life[i] += dt;
    if (debris.life[i] > DEBRIS_LIFE) { debris.life[i] = -1; dirty = true; continue; }
    any = true;
    dirty = true;
    var i3 = i * 3;
    debris.vel[i3 + 1] -= 260 * dt; // les débris retombent
    debris.positions[i3] += debris.vel[i3] * dt;
    debris.positions[i3 + 1] += debris.vel[i3 + 1] * dt;
    debris.positions[i3 + 2] += debris.vel[i3 + 2] * dt;
    var f = 1 - debris.life[i] / DEBRIS_LIFE; // incandescent -> braise éteinte
    debris.colors[i3] = f;
    debris.colors[i3 + 1] = 0.32 * f * f;
    debris.colors[i3 + 2] = 0.08 * f * f * f;
  }
  if (dirty) {
    debris.geo.attributes.position.needsUpdate = true;
    debris.geo.attributes.color.needsUpdate = true;
  }
  if (!any) debris.points.visible = false;
}

/* ---------------------------------------------------------------------------
 * v15 — FX de décollage AU SOL : onde de choc (anneau) qui S'ÉTEND au sol +
 * halo de lumière au pas de tir. Meshes créés paresseusement au premier
 * décollage (zéro allocation par frame), vieillissent seuls dans
 * updateLaunchFX. Sur mobile (lowQ) : l'anneau est désactivé, seul le halo
 * léger est conservé. La montée reste parfaitement verticale et lisse.
 * ------------------------------------------------------------------------- */

function startLaunchFX(pad) {
  if (!scene || !T) return;
  if (!launchGlow) {
    launchGlow = makeGlowSprite(0xff8a30, 70);
    launchGlow.frustumCulled = false;
    launchGlow.material.opacity = 0;
    launchGlow.visible = false;
    scene.add(launchGlow);
  }
  launchGlow.position.set(pad.x, pad.y + 6, pad.z);
  launchGlow.scale.set(70, 70, 1);
  launchGlow.material.opacity = 0.8;
  launchGlow.visible = true;
  launchGlowT = 0;
  if (!lowQ) {
    if (!launchRing) {
      launchRingMat = new T.MeshBasicMaterial({
        color: 0xffb060, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      });
      launchRing = new T.Mesh(new T.TorusGeometry(1, 0.02, 8, 64), launchRingMat);
      launchRing.rotation.x = -Math.PI / 2; // anneau à plat sur le sol
      launchRing.frustumCulled = false;
      launchRing.visible = false;
      scene.add(launchRing);
    }
    launchRing.position.set(pad.x, pad.y + 3, pad.z);
    launchRing.scale.set(1, 1, 1);
    launchRingMat.opacity = 0.9;
    launchRing.visible = true;
    launchRingT = 0;
  }
}

function updateLaunchFX(dt) {
  if (launchRingT >= 0 && launchRing) {
    launchRingT += dt;
    var k = clamp01(launchRingT / 1.6);
    var s = 24 + 280 * easeInOut(k); // l'onde de choc s'étend au sol
    launchRing.scale.set(s, s, s);
    launchRingMat.opacity = 0.9 * (1 - k);
    if (k >= 1) { launchRing.visible = false; launchRingT = -1; }
  }
  if (launchGlowT >= 0 && launchGlow) {
    launchGlowT += dt;
    var k2 = clamp01(launchGlowT / 3);
    var s2 = 70 + 110 * easeInOut(k2);
    launchGlow.scale.set(s2, s2, 1);
    launchGlow.material.opacity = 0.8 * (1 - k2);
    if (k2 >= 1) { launchGlow.visible = false; launchGlowT = -1; }
  }
}

function hideLaunchFX() {
  launchRingT = -1; launchGlowT = -1;
  if (launchRing) launchRing.visible = false;
  if (launchGlow) launchGlow.visible = false;
  if (launchBeam) launchBeam.visible = false; // v17 : pilier de lumière
  // v22 : anneau de poussière du décollage (aucun artefact au pas de tir)
  launchDustT = -1;
  if (launchDust) launchDust.visible = false;
}

/* ---------------------------------------------------------------------------
 * v22 — ANNEAU DE POUSSIÈRE du décollage : le souffle projette l'air au
 * loin — anneau gris qui S'ÉTEND au sol pendant 2,5 s. Mesh créé
 * paresseusement (zéro allocation par frame), masqué par hideLaunchFX,
 * nettoyé dans dispose(). Complète l'anneau orange v15 (qui lui est le
 * choc lumineux) : ici c'est la poussière du souffle.
 * ------------------------------------------------------------------------- */

function startLaunchDust(pad) {
  if (!scene || !T) return;
  if (!launchDust) {
    launchDustMat = new T.MeshBasicMaterial({
      color: 0xd8cfc0, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    });
    launchDust = new T.Mesh(new T.TorusGeometry(1, 0.04, 8, 64), launchDustMat);
    launchDust.rotation.x = -Math.PI / 2; // anneau à plat sur le sol
    launchDust.frustumCulled = false;
    launchDust.visible = false;
    scene.add(launchDust);
  }
  launchDust.position.set(pad.x, pad.y + 1.5, pad.z);
  launchDust.scale.set(1, 1, 1);
  launchDustMat.opacity = 0.85;
  launchDust.visible = true;
  launchDustT = 0;
}

function updateLaunchDust(dt) {
  if (launchDustT < 0 || !launchDust) return;
  launchDustT += dt;
  var k = clamp01(launchDustT / 2.5);
  var s = 20 + 430 * easeOutBack(k); // la poussière balaye le sol
  launchDust.scale.set(s, 1, s);
  launchDustMat.opacity = 0.85 * (1 - k);
  if (k >= 1) { launchDust.visible = false; launchDustT = -1; }
}

/* ---------------------------------------------------------------------------
 * v22 — ALLUMAGE SÉQUENCÉ des 3 moteurs (anticipation du décollage) :
 * la centrale s'allume en premier, puis les 2 latérales (micro-délais) —
 * chaque allumage crache sa gerbe d'étincelles et donne un petit coup de
 * secousse. e = 0 centrale, 1/2 latérales. Défensif (try/catch).
 * ------------------------------------------------------------------------- */

function enginePos(r, e, out) {
  if (e === 0) return r.nozzleRef.getWorldPosition(out); // tuyère centrale
  out.set((e === 1 ? -0.85 : 0.85) * RS, -4.85 * RS, 0);
  return r.group.localToWorld(out);
}

function igniteEngineFX(r, e) {
  try {
    enginePos(r, e, _ev);
    var fx = fx20();
    if (fx) {
      var d = dens20();
      fx.sparkle({ x: _ev.x, y: _ev.y, z: _ev.z },
        { count: Math.max(3, Math.round(18 * d)), spread: 10,
          size: 6, life: 0.7, color: 0xffe0a0 });
      fx.burst({ x: _ev.x, y: _ev.y, z: _ev.z },
        { count: Math.max(4, Math.round(16 * d)), color: 0xfff3d0,
          speed: 120, life: 0.5, size: 6, gravity: 0 });
    }
    api.emit('camera:shake', { force: 0.10 + e * 0.05, duration: 0.5, source: 'engine-ignite' });
  } catch (err) { /* jamais bloquant */ }
}

/* ---------------------------------------------------------------------------
 * v22 — TRAÎNÉE VOLUMINEUSE en vol : feu + fumée bleu-nuit + braises cyan
 * à la tuyère, cadencé par l'appelant (frame), densité réduite sur mobile
 * via dens20(). Complète la traînée 3D (ruban) pendant les phases de vol
 * rapides — chaque fusée laisse un sillage qui a de la matière.
 * ------------------------------------------------------------------------- */

function spaceContrailPuff(r) {
  var fx = fx20();
  if (!fx) return;
  try {
    r.nozzleRef.getWorldPosition(_ev);
    var d = dens20();
    if (typeof fx.smoke === 'function')
      fx.smoke({ x: _ev.x, y: _ev.y, z: _ev.z },
        { count: Math.max(1, Math.round(3 * d)), spread: 9,
          size: 15, life: 2.0, color: 0x3a5a8a, rise: 20, alpha: 0.30 });
    if (typeof fx.fire === 'function' && Math.random() < 0.6)
      fx.fire({ x: _ev.x, y: _ev.y, z: _ev.z },
        { count: Math.max(1, Math.round(2 * d)), spread: 7,
          size: 10, life: 0.6, up: 40 });
    if (typeof fx.sparkle === 'function' && Math.random() < 0.5)
      fx.sparkle({ x: _ev.x, y: _ev.y, z: _ev.z },
        { count: Math.max(1, Math.round(3 * d)), spread: 8,
          size: 5, life: 0.6, color: 0x9fe8ff });
  } catch (e) { /* jamais bloquant */ }
}

/* ---------------------------------------------------------------------------
 * v17 — VUE CIEL LOINTAIN (décollage 30× plus haut) : pendant la montée à
 * 42 km, le camera.far est poussé DÉFENSIVEMENT à 300000 (try/catch : la
 * vue lointaine est un bonus, jamais un crash), pour que la colonne de
 * feu ne soit pas coupée par le frustum. RESTAURÉ à la sortie de phase
 * (enterPhase hors firstrocket, resetRun, dispose).
 * Le BROUILLARD n'est pas touché ici : event-sky.js en est le seul
 * propriétaire — les FX du décollage (pilier, halo, flammes, traînée,
 * éclairs) ignorent le fog (fog:false) et percent jusqu'à 42 km.
 * ------------------------------------------------------------------------- */

function getCam() {
  try { return (api && typeof api.camera === 'function') ? api.camera() : null; }
  catch (e) { return null; }
}

function setSkyView(on) {
  if (on === skyViewOn) return;
  skyViewOn = on;
  try {
    var cam = getCam();
    if (cam && typeof cam.far === 'number') {
      if (on) { savedCamFar = cam.far; cam.far = 300000; }
      else if (savedCamFar > 0) { cam.far = savedCamFar; savedCamFar = 0; }
      if (typeof cam.updateProjectionMatrix === 'function') cam.updateProjectionMatrix();
    }
  } catch (e) { /* défensif : la vue lointaine reste un bonus */ }
}

/* ---------------------------------------------------------------------------
 * v17 — PILIER DE LUMIÈRE du décollage : cylindre additif (fog:false) qui
 * relie le pas de tir à la fusée pendant TOUTE la montée et S'ÉLARGIT
 * avec l'altitude — à 42 km, c'est lui (avec la colonne de feu et le halo
 * géant) qui rend le décollage SPECTACULAIRE. Créé paresseusement,
 * masqué par hideLaunchFX, nettoyé dans dispose().
 * ------------------------------------------------------------------------- */

function updateLaunchBeam(px, py, pz, topY, ck, t) {
  if (!scene || !T) return;
  if (!launchBeam) {
    launchBeamMat = new T.MeshBasicMaterial({
      color: 0xffb050, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
    });
    launchBeam = new T.Mesh(new T.CylinderGeometry(1, 1.6, 1, 12, 1, true), launchBeamMat);
    launchBeam.frustumCulled = false;
    launchBeam.visible = false;
    scene.add(launchBeam);
  }
  var h = Math.max(topY - py, 1);
  launchBeam.position.set(px, py + h / 2, pz);
  var rad = 10 + 150 * ck * ck; // le pilier S'ÉLARGIT en montant
  launchBeam.scale.set(rad, h, rad);
  // v21 : le pilier PULSE avec le moteur (battement lent, jamais figé).
  launchBeamMat.opacity = (0.30 + 0.25 * ck) * (0.88 + 0.12 * Math.sin((t || 0) * 9));
  launchBeam.visible = true;
}

/* ---------------------------------------------------------------------------
 * Laser du strike (v10) : faisceau FIN et BRILLANT du nez de la n°1 vers le
 * POINT ZÉRO, anneau de ciblage autour de la bulle + POINT D'IMPACT LUMINEUX
 * qui PULSE sur la bulle. Le laser SE STABILISE progressivement sur sa cible
 * (la secousse de visée décroît avec `stab` 0 -> 1).
 * ------------------------------------------------------------------------- */

function buildLaser() {
  var g = new T.Group();
  var beamGeo = new T.CylinderGeometry(1, 1, 1, 8, 1, true);
  laserCoreMat = new T.MeshBasicMaterial({
    color: 0xff2244, transparent: true, opacity: 0.95,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
  });
  laserCore = new T.Mesh(beamGeo, laserCoreMat);
  laserCore.frustumCulled = false;
  g.add(laserCore);
  laserGlowMat = new T.MeshBasicMaterial({
    color: 0xff4466, transparent: true, opacity: 0.35,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
  });
  laserGlow = new T.Mesh(beamGeo, laserGlowMat);
  laserGlow.frustumCulled = false;
  g.add(laserGlow);
  // Anneau de ciblage autour de la météorite.
  laserRingMat = new T.MeshBasicMaterial({
    color: 0xff3333, transparent: true, opacity: 0.8,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
  });
  laserRing = new T.Mesh(new T.TorusGeometry(32, 3.5, 8, 48), laserRingMat);
  laserRing.rotation.x = Math.PI / 2;
  g.add(laserRing);
  // Point d'impact lumineux sur la météorite.
  laserDot = makeGlowSprite(0xff4444, 30);
  g.add(laserDot);
  g.visible = false;
  return g;
}

// Étire un cylindre (axe +Y) entre deux points avec un rayon donné.
function placeBeam(mesh, a, b, radius) {
  _v3.copy(b).sub(a);
  var len = Math.max(_v3.length(), 0.001);
  mesh.position.copy(a).addScaledVector(_v3, 0.5);
  mesh.scale.set(radius, len, radius);
  _v3.normalize();
  _q.setFromUnitVectors(_up, _v3);
  mesh.quaternion.copy(_q);
}

function updateLaser(r, t, target, radius, stab) {
  _v4.copy(r.group.position);
  _v4.y += 5.85 * RS; // nez de la fusée
  // La visée SE STABILISE : la secousse décroît à mesure que le verrouillage
  // se fait (stab 0 -> 1 pendant le piqué).
  var jit = (1 - stab) * 16;
  _v5.set(
    target.x + Math.sin(t * 37) * jit,
    target.y + Math.cos(t * 43 + 1) * jit * 0.6,
    target.z + Math.sin(t * 31 + 2) * jit
  );
  var pulse = 1 + 0.3 * Math.sin(t * 28);
  // Faisceau FIN (rayon ~1.2) et BRILLANT, du nez jusqu'au Point Zéro.
  placeBeam(laserCore, _v4, _v5, 1.2 * pulse);
  placeBeam(laserGlow, _v4, _v5, 3.6 * pulse);
  laserCoreMat.opacity = (0.55 + 0.45 * stab) * (0.85 + 0.15 * Math.sin(t * 28));
  laserGlowMat.opacity = 0.30 + 0.15 * stab;
  // Anneau de ciblage STABLE sur la bulle (le verrouillage, lui, ne bouge pas).
  laserRing.position.copy(target);
  var rs = (radius / 32) * (1 + 0.18 * Math.sin(t * 14));
  laserRing.scale.set(rs, rs, 1);
  laserRingMat.opacity = 0.5 + 0.4 * Math.sin(t * 14);
  // POINT D'IMPACT LUMINEUX qui PULSE sur la bulle.
  laserDot.position.copy(target);
  var ds = radius * 0.9 * (1 + 0.35 * Math.sin(t * 28));
  laserDot.scale.set(ds, ds, 1);
  laserDot.material.opacity = 0.7 + 0.3 * Math.sin(t * 34);
}

/* ---------------------------------------------------------------------------
 * Liens d'énergie fusées -> météorite (v12, CAPTURE) : pendant la boucle
 * et l'accélération, chaque fusée vivante projette un faisceau électrique
 * cyan vers la météorite — la « prise » se resserre visuellement avant
 * 'meteor:unfreeze'. placeBeam() est réutilisée (elle n'emploie que _v3/_q
 * en interne : ne jamais lui passer _v3 comme point de départ).
 * ------------------------------------------------------------------------- */

function buildLinks() {
  linkG = new T.Group();
  linkBeamGeo = new T.CylinderGeometry(1, 1, 1, 6, 1, true);
  linkBeamMat = new T.MeshBasicMaterial({
    color: 0x66e0ff, transparent: true, opacity: 0.5,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
  });
  for (var i = 0; i < N; i++) {
    var m = new T.Mesh(linkBeamGeo, linkBeamMat);
    m.frustumCulled = false;
    m.visible = false;
    linkBeams.push(m);
    linkG.add(m);
  }
}

// Faisceaux d'énergie : de chaque fusée vivante vers la météorite.
// intensity 0 = tout masqué ; ~0.55 en loop, 0.7 -> 1.0 en acceleration.
function updateLinks(M, t, intensity) {
  if (!linkG) return;
  if (linkBeamMat) {
    linkBeamMat.opacity = 0.3 + 0.4 * intensity * (0.75 + 0.25 * Math.sin(t * 18));
  }
  for (var i = 0; i < N; i++) {
    var r = rockets[i], b = linkBeams[i];
    if (!b) continue;
    if (!r.alive || intensity <= 0) { b.visible = false; continue; }
    // Point d'arrivée : la météorite, avec une légère ondulation électrique.
    _v4.set(
      M.x + Math.sin(t * 30 + i * 2.4) * 6,
      M.y + 10,
      M.z + Math.cos(t * 26 + i * 1.7) * 6
    );
    placeBeam(b, r.group.position, _v4, 1.6 + intensity * 1.6);
    b.visible = true;
  }
}

function hideLinks() {
  if (!linkBeams) return;
  for (var i = 0; i < linkBeams.length; i++) {
    if (linkBeams[i]) linkBeams[i].visible = false;
  }
}

/* ---------------------------------------------------------------------------
 * init
 * ------------------------------------------------------------------------- */

function init(a) {
  api = a;
  T = a.T;
  if (!T) return;

  _v1 = new T.Vector3(); _v2 = new T.Vector3(); _v3 = new T.Vector3();
  _v4 = new T.Vector3(); _v5 = new T.Vector3(); _v6 = new T.Vector3();
  _v7 = new T.Vector3(); // v17 : points d'approche 360°
  _ev = new T.Vector3(); // v22 : positions des moteurs (allumage séquencé)
  _up = new T.Vector3(0, 1, 0);
  _q = new T.Quaternion(); _q2 = new T.Quaternion(); // v9

  glowTex = makeGlowTexture();
  checkerTex = makeCheckerTexture();
  trailN = a.isMobile ? 180 : 300;
  lowQ = !!a.isMobile; // v15 : qualité réduite sur mobile (FX lourds allégés)

  rockets = [];
  scene = a.scene();
  for (var i = 0; i < N; i++) {
    var r = buildRocket(i);
    r.group.visible = false;
    rockets.push(r);
    if (scene) { scene.add(r.group); scene.add(r.trail.points); }
  }

  smoke = buildSmoke();
  if (scene) scene.add(smoke.points);

  debris = buildDebris(); // v17 : débris incandescents au largage
  if (scene) scene.add(debris.points);

  buildTurnRings(); // v17 : ondes de choc aux changements de cap

  buildRiftFlashes(); // v21 : flashs d'entrée/sortie de faille

  laserG = buildLaser();
  if (scene) scene.add(laserG);

  buildLinks();
  if (scene) scene.add(linkG);

  // Cercle énergétique (acceleration) : tore cyan autour de la météorite.
  ringMat = new T.MeshBasicMaterial({
    color: 0x35c8ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false
  });
  ring = new T.Mesh(new T.TorusGeometry(58, 2.2, 8, 64), ringMat);
  ring.visible = false;
  if (scene) scene.add(ring);

  // Abonnement au bus 'phase:<nom>' (une seule fois : le bus est global).
  if (!busBound && typeof a.on === 'function') {
    for (var pi = 0; pi < PHASES.length; pi++) {
      (function (name) {
        a.on('phase:' + name, function () { busPhase = name; });
      })(PHASES[pi]);
    }
    busBound = true;
  }

  flags = {};
  destroyed = [false, false, false, false, false, false, false];
  lastState = '';
  lastT = -1;
  busPhase = '';
  padRocketHidden = false;
}

function attachScene() {
  if (scene || !api) return;
  scene = api.scene();
  if (!scene) return;
  for (var i = 0; i < rockets.length; i++) {
    scene.add(rockets[i].group);
    scene.add(rockets[i].trail.points);
  }
  scene.add(smoke.points);
  scene.add(laserG);
  scene.add(ring);
  if (linkG) scene.add(linkG);
  if (debris) scene.add(debris.points); // v17 : débris incandescents
  for (var tr = 0; tr < turnRings.length; tr++) scene.add(turnRings[tr].mesh); // v17 : ondes de choc
  for (var rf = 0; rf < riftFlashes.length; rf++) scene.add(riftFlashes[rf].g); // v21 : flashs de faille
  if (gantry) scene.add(gantry); // v21 : portique de lancement
}

// Masque la fusée décorative du pas de tir (event-arena.js) pendant le vol,
// pour ne pas avoir deux fusées n°1 superposées.
function setPadRocketVisible(v) {
  try {
    var lp = root.AZEvent.launchPad;
    if (lp && lp.rocketMesh) {
      lp.rocketMesh.visible = v;
      padRocketHidden = !v;
    }
  } catch (e) { /* pas de pas de tir : rien à masquer */ }
}

// Construit la boucle autour de la météorite (loop / acceleration).
// v14 : boucle RETRAVAILLÉE — amplitudes verticales ACCRUES (plongeon
// profond, remontée vertigineuse, virage haut très incliné), la capture
// reste resserrée autour de la météorite (LOOP_R=320).
var LOOP_R = 320;
function buildLoopCurve() {
  var M = meteorNow(_v1);
  dirOutFrom(M, _v2);
  var back = _v3.copy(M).addScaledVector(_v2, LOOP_R); back.y = M.y;
  var front = _v4.copy(M).addScaledVector(_v2, -LOOP_R); front.y = M.y;
  var side = _v5.set(-_v2.z, 0, _v2.x);
  var pts = [
    back.clone().add(new T.Vector3(0, -130, 0)),                   // PLONGEON profond sous l'arrière
    back.clone().lerp(M, 0.4).add(new T.Vector3(0, 330, 0)),      // remontée VERTIGINEUSE
    M.clone().addScaledVector(side, 230).add(new T.Vector3(0, 190, 0)), // virage haut très incliné
    M.clone().lerp(front, 0.5).add(new T.Vector3(0, -100, 0)),     // piqué vers l'avant
    front.clone().add(new T.Vector3(0, 200, 0)),                   // ressource puissante
    front.clone().add(new T.Vector3(0, 40, 0))                     // sortie vers l'avant
  ];
  return new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
}

/* ---------------------------------------------------------------------------
 * Entrées de phase (une seule fois par phase, via bus 'phase:<nom>' ou
 * détection de changement d'état en repli). Tout le timing intra-phase
 * utilise AZEvent.tState (secondes relatives à l'entrée de phase).
 * ------------------------------------------------------------------------- */

function enterPhase(state, t) {
  if (!api) return;
  attachScene();
  phaseT0 = t - (root.AZEvent.tState || 0); // entrée exacte de phase
  hideLinks(); // les liens d'énergie ne vivent qu'en loop/acceleration
  // v17 : la vue ciel lointain (camera.far boosté) ne vit que pendant
  // firstrocket — restaurée à l'entrée de toute autre phase.
  // v18 : les FX de décollage (pilier de lumière, halo, anneau) ne vivent
  // que pendant firstrocket — masqués à la sortie de phase (filet de
  // sécurité si la fusée n'a pas croisé la faille).
  if (state !== 'firstrocket') { setSkyView(false); hideLaunchFX(); }
  var i, r;
  // v21 — SIGNAUX LUMINEUX ENTRE FUSÉES : en formation (meteorsix/descent)
  // et pendant le silence figé, les balises pulsent en CHENILLE (l'impulsion
  // lumineuse passe de fusée en fusée — les 7 « se parlent »).
  for (i = 0; i < rockets.length; i++) rockets[i].signalMode = (state === 'meteorsix' || state === 'descent' || state === 'silence');

  if (state === 'firstrocket') {
    // v10 — PHASE 1 (fin) : à ZÉRO du compte à rebours, lancement IMMÉDIAT.
    // La n°1 est sur le pas de tir : ANTICIPATION (vibration ~1,2 s,
    // moteurs qui s'allument, pré-rafales de fumée) puis DÉCOLLAGE
    // VERTICAL, accélération rapide, montée. Elle ne reste PAS longtemps :
    // ouvre presque immédiatement une faille GIGANTESQUE devant elle,
    // y entre, la faille se referme derrière (bus 'rift:cross' launch).
    // L'alarme sonore du zéro est émise par event-countdown.js
    // ('countdown:alarm', vérifié — pas de doublon ici).
    setTrailMode('fire');
    trailSpread = 1; // v15 : traînée normale en début de phase
    var pad = launchPadPos(_v1);
    r = rockets[0];
    r.group.position.set(pad.x, pad.y + REST_LIFT, pad.z);
    r.group.scale.set(1, 1, 1);
    r.group.quaternion.identity();
    r.glow.scale.set(6, 6, 1); // halo moteur éteint (posé)
    r.launched = false;
    r.engIg = [false, false, false]; // v22 : allumage séquencé réarmé
    r.launchCrossed = false;
    r.crossT = 0;
    r.shakeSeed = Math.random() * 10;
    r.turnSm = 0; r.speedSm = 0;
    r.hasPrev = false;
    r.flame.visible = false;
    r.core.visible = false;
    // v21 : jalons de la montée + grondement réarmés ; portique construit.
    r.mile = 0;
    r.rumble1 = r.rumble2 = r.rumble3 = r.rumbleG = false;
    r.antiS1 = r.antiS2 = r.antiS3 = false; // v24 : grondement d'anticipation réarmé
    buildGantry(pad);
    if (gantry) gantry.visible = true;
    setVisible(r, true);
    setPadRocketVisible(false);
    for (i = 1; i < N; i++) setVisible(rockets[i], false);
    flags = {};
  }

  else if (state === 'sixrockets') {
    // v10 — PHASES 2-3 : la DANSE DES FAILLES. Les 7 fusées ne décollent
    // plus du pas de tir : elles sortent des failles du ciel (activées
    // SIMULTANÉMENT par event-rift.js), plongent, remontent brutalement,
    // traversent l'île à grande vitesse et sautent de faille en faille,
    // de PLUS EN PLUS VITE. La n°1 ouvre le bal (plongeon spectaculaire).
    setTrailMode('space');
    hideAll();
    buildDance();
    flags = {};
  }

  else if (state === 'convergence') {
    // v10 — PHASE 4 : les 7 convergent vers la faille GÉANTE près de la
    // MÉTÉORITE FIGÉE (position lue en direct : AZEvent.meteorPos via
    // convRiftPos()), y entrent PROGRESSIVEMENT (arrivées échelonnées),
    // disparaissent — COURT INSTANT sans aucune fusée visible — puis
    // réapparaissent DERRIÈRE la météorite (pop easeOutBack) et gagnent
    // le point de départ de la boucle. Traînées cyan/bleu (vol nocturne).
    setTrailMode('space');
    for (i = 0; i < N; i++) {
      r = rockets[i];
      if (destroyed[i]) { setVisible(r, false); continue; }
      r.convFrom.copy(r.group.position);
      r.convIn = false;
      r.convTArr = 1.8 + i * 0.35;  // arrivées échelonnées RAPIDES (phase 8 s)
      r.convTRe = 5.6 + i * 0.15;   // réapparition derrière la météorite (phase 8 s)
      r.convAz = (i / N) * Math.PI * 2 + 0.45; // v17 : azimut d'approche PROPRE (encerclement 360°)
      r.group.scale.set(1, 1, 1);
      r.hasPrev = false;
      r.turnSm = 0;
      r.riftHaloSent = false; // v21 : halo d'anticipation réarmé
      r.rollAng = 0; r.rollRate = 2.5; // v14 : tonneau doux pendant la convergence
      r.flame.visible = false;
      r.core.visible = false;
      if (!r.alive) setVisible(r, true);
    }
    flags = {};
  }

  else if (state === 'loop' || state === 'acceleration') {
    // v10 — PHASE 5/6 : boucle énergétique autour de la météorite.
    // faille arrière -> fusées -> météorite -> faille avant -> disparition
    // -> réapparition derrière. Vol nocturne : traînées BLEU/CIAN.
    // v17 — PHASE 5 (loop, 7 s) : DYNAMIQUE — SURVOL/BALAYAGE UNIQUE par
    // fusée (fini les cercles répétitifs), chacune à son azimut
    // (encerclement 360°), qui file vers acceleration (jonction douce).
    // v17 — PHASE 6 (acceleration) : les 7 sont RÉPARTIES sur tout le tour
    // (encerclement, étaient groupées au point arrière).
    setTrailMode('space');
    if (state === 'loop') {
      // v17 — chaque fusée FEND l'espace autour de la météorite en UNE
      // passe : départ haut écarté -> descente -> FENTE près de la
      // météorite -> ressource côté opposé -> sortie haute. Départs
      // échelonnés (0,33 s), passe de 5 s : la dernière finit à 7 s.
      var M0 = meteorNow(new T.Vector3()); // allocation unique à l'entrée de phase
      for (i = 0; i < N; i++) {
        r = rockets[i];
        if (destroyed[i]) { setVisible(r, false); continue; }
        var az = (i / N) * Math.PI * 2 + 0.5; // v17 : azimut propre (encerclement 360°)
        r.sweepAz = az;
        var dx = Math.cos(az), dz = Math.sin(az);
        var pts = [
          new T.Vector3(M0.x + dx * 460, M0.y + 260, M0.z + dz * 460), // départ haut, écarté
          new T.Vector3(M0.x + dx * 200, M0.y + 40,  M0.z + dz * 200), // descente
          new T.Vector3(M0.x + dx * 95,  M0.y - 55,  M0.z + dz * 95),  // FENTE près de la météorite
          new T.Vector3(M0.x - dx * 230, M0.y + 120, M0.z - dz * 230), // ressource côté opposé
          new T.Vector3(M0.x - dx * 480, M0.y + 300, M0.z - dz * 480)  // sortie haute
        ];
        r.sweepCurve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
        r.sweepT0 = i * 0.33;
        r.sweepDur = 5.0;
        r.sweepShockSent = false;
        r.nearMet = false;
        r.frontSent = false;
        r.hasPrev = false;
        r.turnSm = 0; r.turnRaw = 0;
        r.rollAng = 0; r.rollRate = 0;
        r.group.scale.set(1, 1, 1);
        setVisible(r, false); // chaque fusée apparaît à son départ échelonné
      }
      trailLife = 7.0; trailEvery = 1; // v12 : traînées allongées (était 4.9)
      if (ring) ring.visible = false;
      // La faille arrière "accouche" des fusées à l'entrée du survol.
      api.emit('rift:cross', { kind: 'back', index: 0, atLoopStart: true });
    } else {
      // v17 — acceleration : courbe partagée (buildLoopCurve conservée),
      // 7 fusées RÉPARTIES sur tout le tour + jonction douce depuis le survol.
      var curve = buildLoopCurve();
      for (i = 0; i < N; i++) {
        r = rockets[i];
        if (destroyed[i]) { setVisible(r, false); continue; }
        r.curve = curve;
        r.loopU = 0.02 + (i / N) * 0.9; // v17 : ENCERLEMENT — réparties sur tout le tour (étaient groupées)
        r.prevU = r.loopU;
        // v17 — jonction SANS à-coup depuis le survol (loop) : chaque fusée
        // rejoint la courbe partagée en 1,5 s (géré dans updateAcceleration).
        r.joinFrom = r.group.position.clone();
        r.joinT = 0;
        r.nearMet = false;
        r.frontSent = false; r.backSent = true; // 'back' déjà émis à l'entrée
        r.peeling = false; r.peeled = false;
        r.peelHaloSent = false; // v21 : halo d'anticipation réarmé
        r.hasPrev = false;
        r.turnSm = 0; r.turnRaw = 0;
        r.rollAng = 0; r.rollRate = 0; // v14 : pas de roulis résiduel dans la boucle (applyRoll)
        r.group.scale.set(1, 1, 1);
        setVisible(r, true);
      }
      trailLife = 8; trailEvery = 2; // traînées persistantes
      var Mm = meteorNow(_v1);
      ring.position.copy(Mm);
      ring.visible = true;
    }
    flags = {};
  }

  else if (state === 'silence') {
    // Les fusées se figent un instant : formation figée très haut.
    setTrailMode('space');
    hideAll();
    for (i = 0; i < N; i++) {
      r = rockets[i];
      if (destroyed[i]) continue;
      var a = (i / N) * Math.PI * 2;
      r.group.position.set(Math.cos(a) * 95, 430 + (i % 2) * 18, Math.sin(a) * 95);
      r.group.scale.set(1, 1, 1);
      r.group.quaternion.identity(); // nez vers le haut, figé
      r.glow.scale.set(10, 10, 1);
      r.hasPrev = false;
      setVisible(r, true);
    }
    flags = {};
  }

  else if (state === 'strike') {
    // v10 — PHASE 8 : la n°1 sort d'une faille TRÈS HAUT au-dessus du Point
    // Zéro, plonge VITE vers lui avec son LASER DE VISÉE, accélère et
    // PERCUTE la bulle. CONTACT -> ÉNORME onde de choc sphérique, puis la
    // n°1 est DÉTRUITE (destroyed[0] : elle ne réapparaîtra JAMAIS, pas
    // même en meteorsix). Les 6 autres s'effacent.
    strikeT0 = t;
    setTrailMode('space');
    for (i = 1; i < N; i++) {
      r = rockets[i];
      r.fadeOut = true; // rétrécit vite puis disparaît (géré dans update)
    }
    r = rockets[0];
    zeroPointNow(_v1);
    r.strikeTop.set(_v1.x, 1200, _v1.z); // v13 : faille de sortie, TRÈS haut (était 790) — le plongeon part DE PLUS HAUT
    r.group.position.copy(r.strikeTop);
    r.group.scale.set(0.001, 0.001, 0.001);
    r.hasPrev = false;
    r.strikeDived = false;
    // v21 : anticipation de l'impact + séquence de destruction réarmées.
    r.strikeHaloSent = false;
    r.destrT = 0; r.destrPos = null;
    if (!destroyed[0]) setVisible(r, true);
    flags = {};
  }

  else if (state === 'meteorsix' || state === 'descent') {
    // Les 6 RESTANTES (la n°1 a disparu) escortent la météorite.
    setTrailMode('space');
    hideAll();
    for (i = 1; i < N; i++) {
      r = rockets[i];
      r.group.scale.set(1, 1, 1);
      r.hasPrev = false;
      r.formInit = false; // v14 : pas d'à-coup d'orientation à l'entrée
      setVisible(r, true);
    }
    flags = {};
  }

  else if (state === 'veeroff') {
    // Les 6 fusées quittent la trajectoire et s'échappent par des failles.
    setTrailMode('space');
    for (i = 1; i < N; i++) {
      r = rockets[i];
      r.escFrom.copy(r.group.position);
      zonePos(i % 6, r.escTo);
      var Mv = meteorNow(_v1);
      _v2.copy(r.escFrom).sub(Mv); _v2.y = 0;
      if (_v2.lengthSq() < 1e-6) _v2.set(1, 0, 0);
      _v2.normalize();
      r.escCtl.copy(r.escFrom).addScaledVector(_v2, 170);
      r.escCtl.y = r.escFrom.y + 170; // v14 : GRAND ARC spectaculaire vers la faille (était +120)
      r.escOff = (i - 1) * 0.9;  // départs échelonnés (secondes de phase)
      r.escDur = 3.2;            // vol de fuite rapide
      r.escDone = false;
      r.escRiftSent = false;
      r.escHaloSent = false; // v21 : halo d'anticipation réarmé
      r.hasPrev = false;
      if (r.alive) setVisible(r, true);
    }
    flags = {};
  }

  else {
    // countdown, thrown, greatrift, impact et au-delà : ciel dégagé.
    setTrailMode('fire');
    trailSpread = 1; // v15 : traînée normale
    hideAll();
    trailLife = 7.0; trailEvery = 1; // v12 (était 4.9)
  }
}

/* ---------------------------------------------------------------------------
 * Mouvements par phase (ts = AZEvent.tState, secondes RELATIVES à la phase).
 * ------------------------------------------------------------------------- */

// v24 — ANTICIPATION LONGUE (2,6 s : gronde -> tremble -> s'arrache) PUIS
// MONTÉE VERTICALE MAJESTUEUSE (easeLaunchClimb = p^6 — palier lent puis
// foudroyant : v(0,5 s) ≈ 0,4 m/s, v(1 s) ≈ 13 m/s, v(2 s) ≈ 410 m/s) —
// TOUJOURS sans zigzag ni tremblement en montée (x/z verrouillés).
// v17 bornes — firstrocket [60,86] (26 s) : PHASE 1 (fin).
// ts 0→1,2 : ANTICIPATION — la fusée VIBRE sur le pas de tir, les moteurs
// s'allument progressivement (halo), la flamme "tousse", pré-rafales de fumée.
// ts = 1,2 : DÉCOLLAGE — bus 'rocket:launch', ÉNORME fumée/flammes, montée
// VERTICALE MAJESTUEUSE (v18 : easeLaunchClimb/easeInQuart — démarrage lent
// comme un vrai décollage, accélération progressive jusqu'au faîte —
// TOUJOURS sans zigzag ni tremblement). À y >= 260 : la faille
// GIGANTESQUE s'ouvre DEVANT la fusée ('rift:cross' kind 'launch'), elle y
// entre (rétrécit) — la faille se referme derrière (event-rift.js).
var LAUNCH_ANTICIP = 2.6; // v24 : ANTICIPATION LONGUE (était 1,2) — la fusée gronde, tremble et s'arrache du pas de tir AVANT de partir (s, relatif à la phase)
var LAUNCH_CLIMB = 5.2;  // v12 : durée de la montée verticale (s, relatif — était 6)
var LAUNCH_ALT = 42000;   // v17 : DÉCOLLAGE 30× PLUS HAUT (était 1400) — la fusée perce le ciel
var LAUNCH_RIFT_Y = 41800; // v17 : la faille GÉANTE s'ouvre près du FAÎTE (était 260) — la fusée monte VRAIMENT 30× plus haut avant d'y entrer

function updateFirst(t, dt, ts) {
  var r = rockets[0];
  if (!r.alive) return;
  var pad = launchPadPos(_v6);
  var restY = pad.y + REST_LIFT;

  if (!r.launched) {
    if (ts < LAUNCH_ANTICIP) {
      // v24 — ANTICIPATION LONGUE ET RICHE (2,6 s) : la fusée GRONDE
      // (secousses graves progressives, canal existant — caméra LIBRE),
      // TREMBLE de plus en plus fort, puis S'ARRACHE du pas de tir dans
      // les 0,5 dernières secondes (soulèvement forcé de quelques mètres
      // avant le vrai départ). Le joueur SENT la différence dès la
      // première seconde : le décollage est AMENÉ, pas expédié.
      var k = ts / LAUNCH_ANTICIP;
      // ARRACHEMENT : soulèvement forcé sur la fin de l'anticipation.
      var strainK = clamp01((ts - (LAUNCH_ANTICIP - 0.5)) / 0.5);
      var heave = 3.5 * strainK * strainK;
      // v24 : le tremblement S'EMBALLE avec l'arrachement (amplitude
      // doublée sur la fin — la fusée lutte contre le pas de tir).
      var shakeAmp = 1.0 * k + 2.2 * strainK * strainK;
      r.group.position.set(
        pad.x + (Math.random() - 0.5) * shakeAmp,
        restY + heave + Math.sin(t * 43 + r.shakeSeed) * 0.35 * k,
        pad.z + (Math.random() - 0.5) * shakeAmp
      );
      r.group.quaternion.identity();
      // GRONDEMENT D'ANTICIPATION : 3 paliers de secousse grave qui
      // montent en puissance AVANT le départ (canal 'camera:shake'
      // existant — la caméra reste LIBRE).
      if (!r.antiS1 && k > 0.35) { r.antiS1 = true; api.emit('camera:shake', { force: 0.28, duration: 2.2, source: 'rocket-anticip-rumble' }); }
      if (!r.antiS2 && k > 0.62) { r.antiS2 = true; api.emit('camera:shake', { force: 0.42, duration: 1.8, source: 'rocket-anticip-rumble' }); }
      if (!r.antiS3 && k > 0.85) { r.antiS3 = true; api.emit('camera:shake', { force: 0.55, duration: 1.2, source: 'rocket-anticip-liftoff' }); }
      // Halo moteur : éteint -> incandescent (les moteurs s'allument).
      // v12 : halo RENFORCÉ (était 6 + 20*k²).
      var gs = 8 + 30 * k * k;
      r.glow.scale.set(gs, gs, 1);
      // La flamme "tousse" : allumage par à-coups avant le décollage.
      var sputter = Math.sin(t * 47 + r.shakeSeed) > 0.1;
      r.flame.visible = sputter;
      r.core.visible = sputter && k > 0.5;
      if (sputter) {
        var fs0 = 0.35 + 0.4 * k;
        r.flame.scale.set(fs0, 0.5 * k, fs0);
        r.core.scale.set(fs0 * 0.7, 0.35 * k, fs0 * 0.7);
      }
      // Pré-rafales de fumée qui s'intensifient (frame % 9 : ~6,6/s à 60 ips).
      // v12 : PLUS DENSES (était 4, spread 20). v24 : crescendo sur
      // l'anticipation longue — la fumée DEBORDE avant le départ.
      if ((frame % 9) === 0) smokeBurst(pad.x, pad.y + 2, pad.z, 6 + Math.round(12 * k * k), 24, 60 + 120 * k);
      // v22 — ALLUMAGE SÉQUENCÉ : les 3 moteurs s'allument l'un après
      // l'autre (centrale, puis latérales — micro-délais), chacun crache
      // sa gerbe d'étincelles — la fusée a SON moment avant le départ.
      var igK = [0.22, 0.45, 0.68];
      for (var egi = 0; egi < 3; egi++) {
        if (!r.engIg[egi] && k >= igK[egi]) { r.engIg[egi] = true; igniteEngineFX(r, egi); }
      }
      // v20 — CASCADE D'ALLUMEURS : les moteurs « toussent » des gerbes
      // d'étincelles dont l'intensité MONTE avec k — le décollage est
      // AMENÉ par une montée en charge visible (anticipation crescendo).
      if ((frame % 6) === 0) {
        var fxA = fx20();
        if (fxA) {
          try {
            var dA = dens20();
            fxA.sparkle({ x: pad.x, y: pad.y + 3, z: pad.z },
              { count: Math.max(1, Math.round((4 + 14 * k) * dA)), spread: 12,
                size: 5 + 4 * k, life: 0.5 + 0.4 * k, color: 0xffd9a0 });
            if (k > 0.55) fxA.smoke({ x: pad.x, y: pad.y + 2, z: pad.z },
              { count: Math.max(1, Math.round(3 * dA)), spread: 16,
                size: 20, life: 2.0, rise: 22, alpha: 0.4 });
          } catch (e) { /* jamais bloquant */ }
        }
      }
      updateGantry(ts, 0, false, false); // v21 : le portique tremble de plus en plus fort
      return;
    }
    // DÉCOLLAGE ! (l'alarme du zéro a déjà retenti via 'countdown:alarm')
    r.launched = true;
    r.group.scale.set(1, 1, 1);
    api.emit('rocket:launch', { index: 0 });
    // v21 — SOUFFLE INITIAL : énorme rafale de fumée + halo de sol + gerbe
    // d'étincelles — le décollage PART comme un événement majeur.
    smokeBurst(pad.x, pad.y + 2, pad.z, 40, 52, 260);
    var fxL = fx20();
    if (fxL) {
      try {
        fxL.halo({ x: pad.x, y: pad.y + 2, z: pad.z },
          { anticip: 0.35, dur: 0.8, radius: 300, color: 0xff9040, y: 2 });
        fxL.sparkJet({ x: pad.x, y: pad.y + 4, z: pad.z },
          { count: 60, dir: { x: 0, y: 1, z: 0 }, spread: 0.5, speed: 320,
            color: 0xffc060, size: 7, life: 1.0 });
      } catch (e) { /* jamais bloquant */ }
    }
    // v22 — SOUFFLE AU SOL : double rafale de poussière + anneau de
    // poussière qui s'étend (l'air est projeté au loin).
    smokeBurst(pad.x, pad.y + 1, pad.z, 26, 60, 320);
    startLaunchDust(pad);
    // v22 — GRONDEMENT GRAVE : le décollage PART comme un événement majeur
    // (secousse lourde via le canal existant — la caméra reste LIBRE).
    api.emit('camera:shake', { force: 0.5, duration: 2.5, source: 'rocket-liftoff-throb' });
    // v17 — VUE CIEL LOINTAIN : la montée perce à 42 km — le camera.far
    // est poussé défensivement (restauré à la sortie de phase).
    setSkyView(true);
    // v15 — secousse AU SOL : onde de choc qui s'étend + halo de lumière au
    // pas de tir, + LÉGÈRE vibration caméra via le canal existant
    // 'camera:shake' (ne change PAS le mode caméra : elle reste LIBRE).
    r.launchPrevY = restY;
    r.launchSpdSm = 0;
    trailSpread = 1;
    startLaunchFX(pad);
    api.emit('camera:shake', { force: 0.18, duration: 1.6, source: 'rocket-launch' });
  }

  var lt = ts - LAUNCH_ANTICIP;
  if (lt < LAUNCH_CLIMB && !r.launchCrossed) {
    // v24 — Montée PARFAITEMENT VERTICALE et lisse : aucun zigzag ni
    // tremblement ; easeLaunchClimb = p^6 (dérivée ET courbure quasi
    // nulles au départ) — PALIER LENT puis FOUDROYANT : la fusée reste
    // ÉNORME à l'écran les 2 premières secondes (v(1 s) ≈ 13 m/s),
    // puis l'accélération s'emballe vers le faîte. LAUNCH_ALT est
    // toujours atteint en LAUNCH_CLIMB secondes (ck(1)=1 exact).
    var ck = easeLaunchClimb(clamp01(lt / LAUNCH_CLIMB));
    var y = restY + ck * (LAUNCH_ALT - restY);
    r.group.position.set(pad.x, y, pad.z);
    _v1.set(0, 1, 0);
    orientAlong(r, _v1);
    // v15 — la traînée de feu S'INTENSIFIE pendant la montée (vitesse
    // verticale MESURÉE, jamais constante) : flamme + cœur + halo moteur
    // GRANDISSENT avec l'altitude et la vitesse. La montée reste
    // PARFAITEMENT VERTICALE et lisse (x/z verrouillés, quaternion
    // identité : aucun zigzag, jamais).
    r.flame.visible = true;
    r.core.visible = true;
    var spdRaw = Math.max(0, (y - r.launchPrevY) / Math.max(dt, 1e-4));
    r.launchPrevY = y;
    r.launchSpdSm += (spdRaw - r.launchSpdSm) * 0.15; // vitesse lissée (m/s)
    var spdF = clamp01(r.launchSpdSm / 380);          // 0 -> 1 sur la montée
    var heatF = 0.7 + 0.9 * ck;                       // intensification progressive
    var fs = (1 + 0.3 * Math.sin(t * 30)) * (1 + ck * 1.6) * (0.85 + 0.5 * spdF) * heatF;
    // v17 — COLONNE DE FEU : à 42 km la flamme devient un PILIER
    // incandescent (×23 en hauteur au faîte, fog:false) — le décollage
    // reste SPECTACULAIRE même quand la fusée n'est qu'un point.
    var fireCol = 1 + ck * ck * 22;
    var fireWide = 1 + ck * ck * 3;
    r.flame.scale.set(fs * fireWide, (1 + ck * 2.4) * (0.8 + 0.5 * ck) * fireCol, fs * fireWide);
    r.core.scale.set(fs, (1 + ck * 1.6) * (0.8 + 0.5 * ck) * (1 + ck * ck * 10), fs);
    // v17 — HALO GÉANT : le halo moteur grandit avec l'altitude (jusqu'à
    // ~2500 au faîte, fog:false) — un soleil qui monte au ciel.
    // v21 : + MIROITEMENT haute fréquence — l'air tremble autour du moteur.
    var gs = 26 + 34 * ck + 8 * Math.sin(t * 24) + 2400 * ck * ck * ck + 6 * Math.sin(t * 61) * ck;
    r.glow.scale.set(gs, gs, 1);
    trailSpread = 1 + 1.1 * ck; // v15 : la traînée s'élargit en montant
    // v17 — PILIER DE LUMIÈRE : relie le pas de tir à la fusée pendant
    // toute la montée (visible à 42 km, perce le brouillard).
    updateLaunchBeam(pad.x, pad.y, pad.z, y, ck, t);
    // FUMÉE BLANCHE MASSIVE qui explose vers l'extérieur au sol.
    // v12 : PLUS DENSE (était 10, spread 30, power 170).
    if (lt < 1.6) smokeBurst(pad.x, pad.y + 2, pad.z, 16, 36, 200);
    trailPush(r);
    // v20 — TRAINÉE DE PARTICULES : feu + fumée volumineux à la tuyère
    // pendant TOUTE la montée (dérive montante ∝ vitesse mesurée).
    if ((frame % 3) === 0) contrailPuff(r, 90 + 220 * spdF, 60);
    // v21 — CASCADE D'ALLUMEURS : des gerbes d'étincelles jaillissent de la
    // tuyère et MONTENT le long de la colonne de feu, de plus en plus
    // denses avec l'altitude — la poussée s'emballe visuellement.
    if ((frame % 6) === 0) {
      var fxC = fx20();
      if (fxC) {
        try {
          r.nozzleRef.getWorldPosition(_v7);
          var dC = dens20();
          fxC.sparkJet({ x: _v7.x, y: _v7.y, z: _v7.z },
            { count: Math.max(2, Math.round((6 + 26 * ck) * dC)),
              dir: { x: 0, y: 1, z: 0 }, spread: 0.42,
              speed: 240 + 200 * ck, color: 0xffc060,
              size: 6 + 5 * ck, life: 0.9, gravity: 120 });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    // v21 — LANGUES DE FEU : gerbes latérales le long de la colonne — le
    // panache ondule et crache, jamais un cône parfait et sage.
    if ((frame % 12) === 0) {
      var fxT = fx20();
      if (fxT) {
        try {
          r.nozzleRef.getWorldPosition(_v7);
          var dT = dens20();
          fxT.sparkJet({ x: _v7.x, y: _v7.y - 30 * ck, z: _v7.z },
            { count: Math.max(2, Math.round((4 + 14 * ck) * dT)),
              dir: { x: 0, y: 1, z: 0 }, spread: 0.9,
              speed: 160 + 120 * ck, color: 0xff8040,
              size: 8, life: 0.7, gravity: 60 });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    // v21 — JALONS SONIQUES : à 10/20/30/38 km, la fusée « franchit un
    // palier » — anneau de choc horizontal + gerbe + secousse légère :
    // les 42 km se SENTENT, la montée a des étapes lisibles.
    if (r.mile < MILE_Y.length && y >= MILE_Y[r.mile]) {
      r.mile++;
      fireTurnShock(r, 1.8); // vol vertical -> anneau horizontal
      var fxM = fx20();
      if (fxM) {
        try {
          fxM.burst({ x: pad.x, y: y, z: pad.z },
            { count: 36, color: 0xffe0b0, speed: 340, life: 0.7, size: 9, gravity: 0 });
        } catch (e) { /* jamais bloquant */ }
      }
      api.emit('camera:shake', { force: 0.12, duration: 0.7, source: 'rocket-milestone' });
    }
    // v21 — GRONDEMENT MONTANT : la secousse du pas de tir MONTE en
    // puissance avec la fusée (canal 'camera:shake' existant — la caméra
    // reste LIBRE, seul un tremblement s'ajoute).
    if (!r.rumble1 && lt > 0.6) { r.rumble1 = true; api.emit('camera:shake', { force: 0.22, duration: 1.8, source: 'rocket-rumble' }); }
    if (!r.rumble2 && lt > 1.4) { r.rumble2 = true; api.emit('camera:shake', { force: 0.30, duration: 1.6, source: 'rocket-rumble' }); }
    if (!r.rumble3 && lt > 2.4) { r.rumble3 = true; api.emit('camera:shake', { force: 0.38, duration: 1.4, source: 'rocket-rumble' }); }
    // v21 — le sol tremble encore : halo de terreur au pas de tir.
    if (!r.rumbleG && lt > 0.8) {
      r.rumbleG = true;
      var fxG = fx20();
      if (fxG) {
        try {
          fxG.halo({ x: pad.x, y: pad.y + 2, z: pad.z },
            { anticip: 0.4, dur: 0.7, radius: 220, color: 0xff9040, y: 2 });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    updateGantry(ts, lt, true, r.launchCrossed); // v21 : secousse résiduelle du portique
  }
  // v18 — ENTRÉE DANS LA FAILLE GÉANTE : quand la fusée atteint
  // LAUNCH_RIFT_Y pendant la montée. FILET : si la montée se termine sans
  // croisement détecté (le profil easeLaunchClimb est très cambré en fin
  // de montée — 41800 m n'est dépassé qu'au tout dernier instant — ou en
  // cas d'à-coup de dt), l'entrée est FORCÉE au faîte : la fusée ne reste
  // jamais figée dans le ciel. Le PILIER DE LUMIÈRE est masqué ici
  // (décollage PROPRE : il ne persiste plus après le départ de la fusée).
  if (!r.launchCrossed && r.launched && r.alive &&
      (r.group.position.y >= LAUNCH_RIFT_Y || lt >= LAUNCH_CLIMB)) {
    r.launchCrossed = true;
    r.crossT = 0;
    hideLaunchFX();
    var cp = r.group.position.clone(); cp.y += 60;
    api.emit('rift:cross', { index: 0, kind: 'launch', pos: cp });
    api.emit('rocket:rift-enter', { index: 0, rift: 'launch', pos: cp.clone() });
    // v21 — ENTRÉE DANS LA FAILLE GÉANTE : traversée complète (implosion ->
    // flash -> distorsion -> débris), à l'échelle du moment (signature n°1,
    // ampleur max) — la sortie vers 42 km est un événement majeur.
    riftCrossFX(cp.x, cp.y, cp.z, 0, 0, 1, 0);
    spawnRiftFlash(cp.x, cp.y, cp.z, RIFT_COLORS[0], 220, 1.0, 0, 1, 0);
  }
  if (r.launchCrossed && r.alive) {
    // Entrée dans la faille : s'y engouffre en rétrécissant, puis disparaît.
    r.crossT += dt;
    trailSpread = 1; // v15 : fin de l'élargissement de la traînée
    var ck2 = clamp01(r.crossT / 0.8);
    var sc = Math.max(1 - ck2 * ck2, 0.001);
    r.group.position.y += 260 * dt; // continue d'avancer dans la faille
    r.group.scale.set(sc, sc, sc);
    trailPush(r);
    if (r.crossT >= 0.8) setVisible(r, false);
  }
}

// v17 bornes — sixrockets [86,106] (20 s) : PHASES 2-3 — LA DANSE DES FAILLES.
// Les failles du ciel sont activées SIMULTANÉMENT (event-rift.js).
// UNE fusée (la n°1) sort d'une faille, PLONGE (vertigineux) vers l'île,
// remonte VERTIGINEUSEMENT et traverse l'île à GRANDE VITESSE avant
// d'entrer dans une autre faille au loin. Puis les 6 autres sortent
// SUCCESSIVEMENT : les 7 sautent de faille en faille (entre, disparaît,
// ressort d'une autre, change de direction), de PLUS EN PLUS VITE —
// trajectoires rapides, précises, contrôlées, puis ÉCLATEMENT en éventail
// (7 azimuts). Jamais vers la météorite.
// NOTE fidélité : event-arena.js ne définit AUCUNE zone nommée (pas de
// "Greasy Grove") — les 6 failles de zones sont en cercle (R=350 m, y=160) ;
// la n°1 sort de la faille de zone n°0 (≈ (334, 160, 103)).
var DANCE_EMERGE = 0.6; // émergence d'une faille : pop easeOutBack (s)
var DANCE_ENTER = 0.7;  // entrée dans une faille : rétrécit (s)

// Construit une jambe de danse : a/b = indices de failles de zones,
// tEmerge/tX relatifs à la phase, dive = plongeon phase 2,
// last = traversée (pas d'entrée : la fusée continue au loin),
// fan = indice de la fusée (éclatement en éventail sur la dernière jambe).
function buildDanceLeg(a, b, tEmerge, tX, dive, last, fan) {
  var pA = riftPos(a, new T.Vector3());
  var pB = riftPos(b, new T.Vector3());
  var pts;
  if (dive) {
    // v14 — PHASE 2 : plongeon VERTIGINEUX vers l'île, remontée
    // VERTIGINEUSE, repiqué, traversée à GRANDE VITESSE.
    pts = [
      pA.clone(),
      new T.Vector3(230, 170, 110),
      new T.Vector3(120, 30, 40),    // point bas du plongeon (vertigineux)
      new T.Vector3(150, 480, -40),   // remontée vertigineuse
      new T.Vector3(-60, 560, -110),  // très haut, grande vitesse
      new T.Vector3(40, 420, 60),     // repiqué spectaculaire
      pB.clone()
    ];
  } else if (last) {
    // v14 — Dernière jambe : ÉCLATEMENT — la fusée cabre, pique, se
    // ressource puis CONTINUE son vol au loin dans SA direction (éventail
    // à 7 branches : chaque fusée a son azimut), en douce décélération
    // (enchaînement sans à-coup vers convergence).
    dirOutFrom(pB, _v1);
    var fa = (fan >= 0 ? fan : 0) * (Math.PI * 2 / N);
    var fc = Math.cos(fa), fsn = Math.sin(fa);
    var fdx = _v1.x * fc - _v1.z * fsn, fdz = _v1.x * fsn + _v1.z * fc;
    _v1.set(fdx, 0, fdz);
    var far = pB.clone().addScaledVector(_v1, 520); far.y = pB.y + 190;
    pts = [
      pA.clone(),
      pA.clone().lerp(pB, 0.3).add(new T.Vector3(0, 200, 0)),   // cabrage puissant
      pA.clone().lerp(pB, 0.65).add(new T.Vector3(0, -60, 0)),   // piqué marqué
      pB.clone().lerp(far, 0.4).add(new T.Vector3(0, 120, 0)),   // ressource
      far
    ];
  } else {
    // v14 — Saut de faille en faille : S AMPLE et marqué (montée
    // puissante, creux vertigineux, ressource) — trajectoires lisibles
    // et spectaculaires.
    pts = [
      pA.clone(),
      pA.clone().lerp(pB, 0.3).add(new T.Vector3(110, 220, -80)), // montée puissante
      pA.clone().lerp(pB, 0.55).add(new T.Vector3(-40, -90, 60)),  // creux marqué
      pA.clone().lerp(pB, 0.8).add(new T.Vector3(60, 150, -30)),   // ressource
      pB.clone()
    ];
  }
  var curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
  var flyT0 = tEmerge + DANCE_EMERGE;
  var flyT1 = last ? tX : (tX - DANCE_ENTER);
  var flyDur = Math.max(0.5, flyT1 - flyT0);
  curve.getTangent(0, _v2);
  return {
    a: a, b: b, tEmerge: tEmerge,
    tEnter: last ? -1 : tX, tEnd: last ? tX : -1,
    dive: dive, last: last,
    pA: pA, pB: pB, curve: curve,
    outDir: _v2.clone(),               // tangente de sortie (émergence)
    cruise: curve.getLength() / flyDur, // vitesse de croisière (m/s)
    emergeSent: false, enterSent: false
  };
}

function mkDanceLeg(a, b, tEmerge, tX, dive, last, fan) {
  return buildDanceLeg(a, b, tEmerge, tX, dive, last, fan);
}

// Chorégraphie complète des 7 fusées (jambes de plus en plus rapides).
// v12 : DANCE_T compresse tous les temps -> vitesses de croisière PLUS
// ÉLEVÉES (était 1.0) ; les durées de vol restent relatives à la phase.
var DANCE_T = 0.85;
function buildDance() {
  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    var legs = [];
    if (i === 0) {
      // La n°1 ouvre le bal : plongeon spectaculaire (phase 2), puis
      // deux sauts de plus en plus rapides (phase 3).
      legs.push(mkDanceLeg(0, 3, 1.5 * DANCE_T, 9.0 * DANCE_T, true, false, i));
      legs.push(mkDanceLeg(5, 2, 10.0 * DANCE_T, 14.0 * DANCE_T, false, false, i));
      legs.push(mkDanceLeg(1, 4, 15.0 * DANCE_T, 21.5 * DANCE_T, false, true, i));
    } else {
      // Les 6 autres sortent SUCCESSIVEMENT, de plus en plus vite.
      var e0 = (2.0 + i * 1.1) * DANCE_T;
      var tEnter1 = e0 + 4.2 * DANCE_T;
      legs.push(mkDanceLeg((i * 2 + 1) % 6, (i * 2 + 4) % 6, e0, tEnter1, false, false, i));
      legs.push(mkDanceLeg((i * 3 + 2) % 6, (i * 5 + 1) % 6, tEnter1 + 1.2 * DANCE_T, 21.0 * DANCE_T, false, true, i));
    }
    r.dance = legs;
    r.turnSm = 0; r.speedSm = 0;
  }
}

function updateSix(t, dt, ts) {
  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    if (!r.dance) continue;
    updateDanceRocket(r, i, t, dt, ts);
  }
}

// Joue la danse d'une fusée (machine à sous-états 100 % relative à ts).
function updateDanceRocket(r, i, t, dt, ts) {
  var legs = r.dance, L = null;
  for (var k = 0; k < legs.length; k++) {
    if (ts >= legs[k].tEmerge) L = legs[k];
    else break;
  }
  if (!L) { if (r.alive) setVisible(r, false); return; } // pas encore sortie

  if (ts < L.tEmerge + DANCE_EMERGE) {
    // ÉMERGENCE de la faille : pop easeOutBack (anticipation + rebond).
    if (!r.alive) {
      r.group.position.copy(L.pA);
      r.hasPrev = false; r.turnSm = 0;
      r.rollRate = 0; r.rollAng = 0; // v11 : pas de tonneau pendant l'émergence
      setVisible(r, true);
    }
    if (!L.emergeSent) {
      L.emergeSent = true;
      api.emit('rift:cross', { kind: 'zone', index: L.a, pos: L.pA.clone() });
      api.emit('rocket:rift-enter', { index: i, rift: 'zone', pos: L.pA.clone(), exit: true });
      // v21 — SORTIE DE FAILLE : flash (implosion -> flash -> distorsion)
      // orienté selon la tangente de sortie + gerbe blanche.
      spawnRiftFlash(L.pA.x, L.pA.y, L.pA.z, RIFT_COLORS[i], 70, 0.6,
        L.outDir.x, L.outDir.y, L.outDir.z);
      var fxE = fx20();
      if (fxE) {
        try {
          fxE.burst({ x: L.pA.x, y: L.pA.y, z: L.pA.z },
            { count: 24, color: 0xffffff, speed: 200, life: 0.5, size: 7, gravity: 0 });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    var ek = easeOutBack((ts - L.tEmerge) / DANCE_EMERGE);
    r.group.position.copy(L.pA);
    var es = Math.max(ek, 0.001);
    r.group.scale.set(es, es, es);
    _v1.copy(L.outDir); _v1.y += 0.25; _v1.normalize();
    orientAlong(r, _v1);
    var gl0 = 14 + 8 * ek; // halo qui s'allume à la sortie
    r.glow.scale.set(gl0, gl0, 1);
    trailPush(r);
    return;
  }

  var flyT0 = L.tEmerge + DANCE_EMERGE;
  var flyT1 = L.last ? L.tEnd : (L.tEnter - DANCE_ENTER);
  if (ts < flyT1) {
    // VOL : suit la courbe, de plus en plus vite selon les jambes.
    // v14 : easing MARQUÉ par jambe — plongeon : easeInQuad (démarrage
    // brutal, arrivée fulgurante) ; transits : easeInOutQuart (montées
    // puissantes, décélérations marquées dans les creux).
    if (!r.alive) { setVisible(r, true); r.hasPrev = false; }
    var up = clamp01((ts - flyT0) / Math.max(0.001, flyT1 - flyT0));
    var u = L.dive ? up * up : easeInOutQuart(up);
    L.curve.getPoint(u, r.group.position);
    r.group.scale.set(1, 1, 1);
    // v12 : tonneau (barrel roll) RENFORCÉ pendant le vol rapide — la
    // fusée tournoie sur elle-même, et PLUS VITE dans les virages
    // (turnSm) : trajectoire spectaculaire mais fluide.
    r.rollRate = (L.dive ? 2.8 : 2.0) + r.turnSm * 2.0;
    r.rollAng = (r.rollAng + r.rollRate * dt) % (Math.PI * 2);
    orientVel(r); // bank dans les virages + turnSm/speedSm
    trailPush(r);
    var gl = 20 + Math.min(40, r.speedSm * 0.15) + Math.sin(t * 10 + i) * 4;
    r.glow.scale.set(gl, gl, 1);
    return;
  }

  if (!L.last && ts < L.tEnter) {
    // ENTRÉE dans la faille : s'y engouffre en rétrécissant.
    if (!L.enterSent) {
      L.enterSent = true;
      api.emit('rift:cross', { kind: 'zone', index: L.b, pos: L.pB.clone() });
      api.emit('rocket:rift-enter', { index: i, rift: 'zone', pos: L.pB.clone() });
      // v21 — ENTRÉE EN FAILLE : traversée complète (implosion -> flash ->
      // distorsion -> débris), signature de la fusée (variation entre les 7).
      L.curve.getTangent(1, _v7);
      riftCrossFX(L.pB.x, L.pB.y, L.pB.z, i, _v7.x, _v7.y, _v7.z);
    }
    var nk = (ts - (L.tEnter - DANCE_ENTER)) / DANCE_ENTER;
    var sc = Math.max(1 - easeIn(nk), 0.001);
    r.group.position.copy(L.pB);
    r.group.scale.set(sc, sc, sc);
    r.rollRate = 0; r.rollAng = 0; // v11 : le tonneau s'arrête à l'entrée
    trailPush(r);
    if (nk >= 1 && r.alive) setVisible(r, false);
    return;
  }

  if (!L.last) { if (r.alive) setVisible(r, false); return; } // entre deux failles

  // Dernière jambe : TRAVERSÉE — prolonge le vol au loin, en douce
  // décélération (enchaînement sans à-coup vers convergence).
  if (!r.alive) { setVisible(r, true); r.hasPrev = false; }
  L.curve.getTangent(1, _v1);
  var out = 1 - 0.25 * clamp01((ts - L.tEnd) / 3);
  r.group.position.addScaledVector(_v1, L.cruise * 0.85 * out * dt);
  r.group.scale.set(1, 1, 1);
  r.rollRate = 1.0; // v12 : le tonneau ralentit en douceur vers la convergence (était 0.8)
  r.rollAng = (r.rollAng + r.rollRate * dt) % (Math.PI * 2);
  orientVel(r);
  trailPush(r);
}

// v17 bornes — convergence [106,114] (8 s) : PHASE 4.
// Les 7 convergent VITE vers la faille GÉANTE près de la MÉTÉORITE FIGÉE
// (faille 'conv', index 7 — position lue en direct, jamais en dur),
// en ARC AMPLE et INCLINÉ (bank + tonneau doux via orientVel/applyRoll),
// y entrent PROGRESSIVEMENT en VRILLE (arrivées échelonnées sur ~4 s),
// disparaissent : COURT INSTANT sans aucune fusée visible, puis
// réapparaissent DERRIÈRE la météorite (pop easeOutBack) et gagnent le
// point arrière du survol (enchaînement sans téléportation vers la
// phase 5).
// v17 — ENCERLEMENT 360° : chaque fusée pique vers SON point d'approche
// (azimut propre r.convAz autour de la météorite — Bézier
// convFrom -> W_i -> faille) puis réapparaît côté OPPOSÉ à son approche.
// Les 7 viennent de CHAQUE CÔTÉ, jamais toutes du même côté.
function convRiftPos(out) {
  var rs = root.AZEvent.rifts;
  if (rs && rs[7] && rs[7].pos && typeof rs[7].pos.x === 'number')
    return out.copy(rs[7].pos);
  // Repli : près de la météorite figée (miroir d'openConvRift).
  var M = meteorNow(_v5);
  dirOutFrom(M, _v6);
  return out.copy(M).addScaledVector(_v6, 45);
}

var CONV_ENTER = 1;    // entrée dans la faille : rétrécit (s)
var CONV_REAPPEAR = 0.7; // réapparition : pop easeOutBack (s)

function updateConvergence(t, dt, ts) {
  var M = meteorNow(_v6);
  var C = convRiftPos(_v1); // faille géante, près de la météorite figée
  meteorNow(_v6); // v17 : M ré-ancré — convRiftPos() peut écraser _v6 sur son chemin de repli
  dirOutFrom(M, _v2);
  // Point de réapparition : DERRIÈRE la météorite (côté opposé à la faille).
  _v3.copy(M).addScaledVector(_v2, -200); _v3.y = M.y + 10;
  // Point arrière du survol (départ phase 5).
  _v4.copy(M).addScaledVector(_v2, 320); _v4.y = M.y - 40;

  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    if (destroyed[i]) continue;
    var tArr = r.convTArr, tRe = r.convTRe;

    if (ts < tArr) {
      // v17 — ENCERLEMENT 360° : la fusée pique vers SON point d'approche
      // W_i (azimut propre autour de la météorite) puis fond sur la
      // faille — ARC AMPLE et INCLINÉ (bank + tonneau doux).
      if (!r.alive) { setVisible(r, true); r.hasPrev = false; }
      // v21 — ANTICIPATION : 1,2 s avant l'entrée, un halo « inspire » sur
      // la faille — la traversée est ANNONCÉE (cause -> effet lisible).
      if (!r.riftHaloSent && ts >= tArr - 1.2) {
        r.riftHaloSent = true;
        var fxH = fx20();
        if (fxH) {
          try {
            fxH.halo({ x: C.x, y: C.y, z: C.z },
              { anticip: Math.max(0.3, Math.min(1.2, tArr - ts)), dur: 0.5,
                radius: 110, color: RIFT_COLORS[i] });
          } catch (e) { /* jamais bloquant */ }
        }
      }
      var e = easeInOut(ts / tArr);
      _v7.set(Math.cos(r.convAz) * 260, 50, Math.sin(r.convAz) * 260).add(M); // W_i : point d'approche
      bez2(r.convFrom, _v7, C, e, r.group.position);
      r.group.position.y += Math.sin(e * Math.PI) * 40;
      r.rollAng = (r.rollAng + r.rollRate * dt) % (Math.PI * 2);
      orientVel(r);
      trailPush(r);
      var gl = 20 + Math.min(34, r.speedSm * 0.12);
      r.glow.scale.set(gl, gl, 1);
    } else if (ts < tArr + CONV_ENTER) {
      // v14 — Entrée PROGRESSIVE dans la faille : s'y engouffre en
      // rétrécissant, en VRILLE rapide (spectaculaire).
      if (!r.convIn) {
        r.convIn = true;
        r.rollRate = 7; // vrille d'entrée
        api.emit('rift:cross', { index: i, kind: 'conv', pos: C.clone() });
        api.emit('rocket:rift-enter', { index: i, rift: 'conv', pos: C.clone() });
        // v21 — ENTRÉE EN FAILLE : traversée complète (implosion -> flash ->
        // distorsion -> débris), signature de la fusée (variation entre les 7).
        // NOTE : C est l'alias de _v1 — on fige ses coordonnées AVANT l'appel
        // (riftCrossFX utilise _v1 en interne).
        var ccx = C.x, ccy = C.y, ccz = C.z;
        var vdx = 0, vdy = 1, vdz = 0;
        if (r.velDir) { vdx = r.velDir.x; vdy = r.velDir.y; vdz = r.velDir.z; }
        riftCrossFX(ccx, ccy, ccz, i, vdx, vdy, vdz);
        C.set(ccx, ccy, ccz); // restaure (C = _v1, écrasé par riftCrossFX)
      }
      var sk = clamp01((ts - tArr) / CONV_ENTER);
      var sc = Math.max(1 - easeIn(sk), 0.001);
      r.group.position.copy(C);
      r.group.scale.set(sc, sc, sc);
      _q2.setFromAxisAngle(_up, r.rollRate * dt); // vrille incrémentale
      r.group.quaternion.multiply(_q2);
      trailPush(r);
      if (sk >= 1 && r.alive) setVisible(r, false);
    } else if (ts < tRe) {
      // COURT INSTANT sans aucune fusée visible.
      if (r.alive) setVisible(r, false);
    } else if (ts < tRe + CONV_REAPPEAR) {
      // v17 — Réapparition DERRIÈRE la météorite, côté OPPOSÉ à l'azimut
      // d'approche de la fusée (encerclement 360°) : pop easeOutBack.
      _v7.set(-Math.cos(r.convAz) * 200, 10, -Math.sin(r.convAz) * 200).add(M);
      if (!r.alive) {
        r.group.position.copy(_v7);
        r.hasPrev = false; r.turnSm = 0; r.turnRaw = 0;
        r.rollAng = 0; r.rollRate = 0; // v14 : vrille terminée
        setVisible(r, true);
        api.emit('rocket:rift-enter', { index: i, rift: 'reappear', pos: _v7.clone() });
        // v21 — RÉAPPARITION : flash de faille côté opposé (la faille
        // « recrache » la fusée — implosion -> flash -> distorsion).
        spawnRiftFlash(_v7.x, _v7.y, _v7.z, RIFT_COLORS[(i + 3) % 7], 80, 0.6);
      }
      var ek = easeOutBack((ts - tRe) / CONV_REAPPEAR);
      r.group.position.copy(_v7);
      var es = Math.max(ek, 0.001);
      r.group.scale.set(es, es, es);
      _v5.copy(_v4).sub(_v7); // v17 : cap vers le point arrière du survol
      orientAlong(r, _v5);
      r.glow.scale.set(26, 26, 1);
      trailPush(r);
    } else {
      // Glisse vers le point arrière du survol (départ phase 5).
      // v12 : fenêtre RÉDUITE (phase 8 s — était 2.5).
      // v17 : repart du point de réapparition PROPRE à la fusée (encerclement).
      if (!r.alive) { setVisible(r, true); r.hasPrev = false; }
      _v7.set(-Math.cos(r.convAz) * 200, 10, -Math.sin(r.convAz) * 200).add(M);
      var wk = easeInOut(clamp01((ts - (tRe + CONV_REAPPEAR)) / 0.8));
      r.group.position.lerpVectors(_v7, _v4, wk);
      r.group.scale.set(1, 1, 1);
      orientVel(r);
      trailPush(r);
      r.glow.scale.set(22, 22, 1);
    }
  }
}

// v17 — loop [114,121] (7 s, DYNAMIQUE) : SURVOL/BALAYAGE UNIQUE.
// Les 7 fusées FENDENT l'espace autour de la météorite en UNE passe
// (départs échelonnés, chacune à son azimut — encerclement 360°), avec
// GRANDS VIRAGES INCLINÉS (bank via la vitesse mesurée), traînées
// BLEU/CIAN lumineuses, LIENS D'ÉNERGIE fusées->météorite (la capture se
// resserre), puis filent vers acceleration (jonction douce, PAS de
// téléportation). PAS de cercles répétitifs, PAS de trajectoire qui se
// referme sur elle-même.
function updateLoop(t, dt, ts) {
  var M = meteorNow(_v6);
  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    if (destroyed[i] || !r.sweepCurve) { if (r.alive) setVisible(r, false); continue; }
    var p = clamp01((ts - r.sweepT0) / r.sweepDur);
    if (p <= 0) { if (r.alive) setVisible(r, false); continue; } // départ échelonné
    if (!r.alive) { setVisible(r, true); r.hasPrev = false; r.turnSm = 0; r.turnRaw = 0; }
    // v17 : la fente ACCÉLÈRE dans la descente (easeInOutCubic : plongée
    // fulgurante près de la météorite, ressource ample en sortie).
    var e = easeInOutCubic(p);
    r.sweepCurve.getPoint(e, r.group.position);
    r.group.scale.set(1, 1, 1);
    orientVel(r); // v17 : virages INCLINÉS (bank) dans la fente
    var d = r.group.position.distanceTo(M);
    // v17 : la fente RUGIT à l'approche — halo et traînée gonflés.
    var prox = clamp01(1 - d / 520);
    var gl = 24 + prox * 46 + Math.sin(t * 14 + i * 2) * 6;
    r.glow.scale.set(gl, gl, 1);
    if (d < 170 && !r.nearMet) {
      r.nearMet = true;
      api.emit('rocket:pass', { index: i });
    } else if (d > 220) {
      r.nearMet = false;
    }
    if (i === 0 && !r.frontSent && p > 0.55) {
      // v17 : la n°1 ouvre la marche — la faille avant s'embrase à mi-passe.
      r.frontSent = true;
      api.emit('rift:cross', { kind: 'front', index: 0 });
    }
    // v17 : la fusée « DÉCHIRE » l'espace à mi-fente — onde de choc.
    // v21 : CRESCENDO — chaque passe claque PLUS FORT que la précédente
    // (1,0 -> 2,3) : les 7 passes sont uniques et la montée en puissance
    // est lisible d'un coup d'œil.
    if (!r.sweepShockSent && p > 0.42 && p < 0.62) {
      r.sweepShockSent = true;
      fireTurnShock(r, 1.0 + i * 0.22);
    }
    trailPush(r);
    if (p >= 1) {
      // v17 : fin de passe — la fusée file droit devant (prolonge la
      // tangente de sortie) en attendant acceleration (jonction douce).
      r.sweepCurve.getTangent(1, _v1);
      r.group.position.addScaledVector(_v1, 90 * dt);
      orientVel(r);
    }
  }
  // v17 : liens d'énergie fusées->météorite — la CAPTURE se resserre.
  updateLinks(M, t, 0.55);
}

/* ---------------------------------------------------------------------------
 * v17 bornes — acceleration [121,147] (26 s, montée CONTINUE sans répétition) :
 * météorite (3 s -> 1,1 s par tour, VITESSE MODULÉE sur le tour),
 * GRANDS VIRAGES INCLINÉS (bank), TRAÎNÉES BLEU/CIAN lumineuses
 * persistantes, LIENS D'ÉNERGIE fusées->météorite qui s'intensifient
 * (0.7 -> 1.0), cercle énergétique, puis la météorite VIBRE
 * ('meteor:unfreeze') + GROS FLASH + ONDE DE CHOC et TOMBE dans la faille
 * avant. Les fusées convergent vers les failles en fin de phase
 * (disparition échelonnée dans les failles). Chaque seconde compte.
 * ------------------------------------------------------------------------- */

function updateAcceleration(t, dt, ts) {
  var M = meteorNow(_v6);
  var loopDur = 3 - 1.9 * clamp01(ts / 26); // 3 s -> 1,1 s : accélère très fort
  if (loopDur < 1.1) loopDur = 1.1;
  // Le cercle énergétique tourne autour de la météorite.
  ring.position.copy(M);
  ring.rotation.z += dt * 0.6;
  ringMat.opacity = 0.35 + 0.2 * Math.sin(ts * 2);

  // v14 — PHASE 6 : quand la boucle est à son paroxysme et la faille avant
  // bien ouverte, la météorite VIBRE puis TOMBE dans la faille avant.
  // Fraction relative 22,5/30 = 0,75 (inchangée).
  // Contrat inter-modules (event-meteor.js, autre groupe) : bus
  // 'meteor:unfreeze' + drapeau AZEvent.meteorUnfrozen (réarmé au start()).
  // Le moment 'meteor:unfreeze' est SPECTACULAIRE — GROS FLASH + ONDE DE
  // CHOC centrés sur la météorite (la chute dans la faille).
  if (ts >= 22.5 && !flags.unfreeze) {
    flags.unfreeze = true;
    root.AZEvent.meteorUnfrozen = true;
    api.emit('meteor:unfreeze', { phase: 'acceleration', tState: ts });
    api.emit('rift:cross', { kind: 'front', index: 0 }); // flash de la faille avant
    api.emit('shockwave:burst', {
      pos: M.clone(),
      opts: { radius: 520, duration: 2.6, rings: 4, color: 0x9fe8ff, flash: true }
    });
    api.emit('camera:shake', { force: 0.7, duration: 2.2, source: 'rocket-unfreeze' });
  }

  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    if (destroyed[i] || !r.curve) { if (r.alive) setVisible(r, false); continue; }

    // Fin de phase : chaque fusée plonge dans sa faille et disparaît.
    // Fenêtre RESSERRÉE (phase 30 s) : le peel finit au plus tard à
    // 28,8 s < 30 s (silence masque tout à 30 s).
    var peelT = 24.5 + i * 0.35;
    // v21 — ANTICIPATION : 1,2 s avant de plonger dans sa faille, un halo
    // « inspire » sur la faille de la fusée — chaque sortie est annoncée.
    if (!r.peeled && !r.peelHaloSent && ts >= peelT - 1.2) {
      r.peelHaloSent = true;
      var fxP = fx20();
      if (fxP) {
        try {
          fxP.halo({ x: r.escTo.x, y: r.escTo.y, z: r.escTo.z },
            { anticip: Math.max(0.3, Math.min(1.2, peelT - ts)), dur: 0.5,
              radius: 100, color: RIFT_COLORS[i] });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    if (ts >= peelT && !r.peeled) {
      if (!r.peeling) {
        r.peeling = true;
        r.peelT0 = ts;
        r.peelFrom.copy(r.group.position);
        riftPos(i, r.escTo);
      }
      var pk = (ts - r.peelT0) / 2.2;
      if (pk >= 1) {
        r.peeled = true;
        r.peeling = false;
        api.emit('rift:cross', { index: i, kind: 'accel', pos: r.escTo.clone() });
        // v21 — SORTIE EN 4 TEMPS : traversée complète (implosion -> flash
        // -> distorsion -> débris) + onde de choc — chaque fusée a sa
        // signature (variation entre les 7).
        riftCrossFX(r.escTo.x, r.escTo.y, r.escTo.z, i, 0, 1, 0);
        fireTurnShock(r, 1.2 + i * 0.2);
        setVisible(r, false);
        continue;
      }
      if (!r.alive) setVisible(r, true);
      var pe = easeInOut(pk);
      _v1.copy(r.peelFrom).lerp(r.escTo, 0.5); _v1.y += 60; // arche
      bez2(r.peelFrom, _v1, r.escTo, pe, r.group.position);
      _v2.copy(r.group.position).sub(r.prev);
      orientAlong(r, _v2.lengthSq() > 1e-8 ? _v2 : _up);
      r.prev.copy(r.group.position); r.hasPrev = true;
      var psc = Math.max(1 - easeIn(clamp01((pk - 0.7) / 0.3)) * 0.999, 0.001);
      r.group.scale.set(psc, psc, psc);
      trailPush(r);
      continue;
    }

    // v14 : une fusée « peelée » (disparue dans sa faille) ne doit JAMAIS
    // réapparaître — sinon elle rebouclerait 1 à 2 s avant silence.
    if (!r.alive && !r.peeled) setVisible(r, true);
    // v14 : vitesse MODULÉE sur le tour (accélérations/décélérations
    // marquées) + virages INCLINÉS (bank via la vitesse mesurée).
    var lapSpdA = 1 + 0.45 * Math.sin(r.loopU * Math.PI * 4 + ts * 0.3);
    r.loopU = (r.loopU + dt / loopDur * lapSpdA) % 1;
    var s = r.loopU;
    var wrappedA = (s < r.prevU - 0.5); // nouveau tour (saut de courbe)
    if (i === 0) {
      // v10 — la n°1 ouvre la marche : signale les passages aux failles
      // (la boucle accélère, la faille avant grandit).
      if (r.prevU < 0.93 && s >= 0.93 && !r.frontSent) {
        r.frontSent = true;
        api.emit('rift:cross', { kind: 'front', index: 0 });
        // v21 — la faille avant S'EMBRASE au passage de la n°1 (cause ->
        // effet : c'est elle qui la fait grandir) — flash de faille.
        var FR = convRiftPos(_v7);
        spawnRiftFlash(FR.x, FR.y, FR.z, RIFT_COLORS[0], 130, 0.8);
        meteorNow(_v6); // v17 : M ré-ancré (convRiftPos peut écraser _v6 sur son chemin de repli)
      }
      if (wrappedA) {
        r.frontSent = false;
        api.emit('rift:cross', { kind: 'back', index: 0 });
      }
    }
    r.prevU = s;
    r.curve.getPoint(s, r.group.position);
    r.curve.getTangent(s, _v1);
    if (wrappedA) { r.hasPrev = false; orientAlong(r, _v1); }
    else orientVel(r);
    // v17 — JONCTION DOUCE depuis le survol (loop) : la fusée rejoint la
    // courbe partagée en 1,5 s (PAS de téléportation d'une trajectoire
    // à l'autre).
    if (r.joinFrom && r.joinT < 1.5) {
      r.joinT += dt;
      var jk = easeInOut(clamp01(r.joinT / 1.5));
      _v5.copy(r.group.position); // point courant sur la courbe partagée
      r.group.position.lerpVectors(r.joinFrom, _v5, jk);
      orientVel(r);
    }
    var sc = 1;
    if (s < 0.05) sc = s / 0.05;
    else if (s > 0.94) sc = (1 - s) / 0.06;
    sc = Math.max(sc, 0.001);
    r.group.scale.set(sc, sc, sc);
    var d = r.group.position.distanceTo(M);
    if (d < 170 && !r.nearMet) {
      r.nearMet = true;
      api.emit('rocket:pass', { index: i });
    } else if (d > 220) {
      r.nearMet = false;
    }
    var gl = 24 + Math.sin(t * 12 + i * 2) * 7;
    r.glow.scale.set(gl, gl, 1);
    trailPush(r);
  }
  // v14 : liens d'énergie fusées->météorite — s'INTENSIFIENT jusqu'au
  // paroxysme (0.7 -> 1.0) avant 'meteor:unfreeze'.
  updateLinks(M, t, 0.7 + 0.3 * clamp01(ts / 22.5));
}

// silence [158,164] (6 s) : les fusées se figent un instant.
// (Positions fixées à l'entrée de phase ; ici : rien ne bouge, les
// traînées s'éteignent d'elles-mêmes.)
function updateSilence(t, dt, ts) { /* figé */ }

// v17 bornes — strike [152,165] (13 s) : la n°1 sort d'une faille TRÈS HAUT
// au-dessus du Point Zéro, DESCEND VITE vers lui en PIQUÉ EN S (balayage
// latéral qui se VERROUILLE sur la cible) avec un LASER DE VISÉE
// CLAIREMENT VISIBLE (faisceau fin et brillant fusée -> Point Zéro, point
// d'impact lumineux qui pulse sur la bulle), ACCÉLÈRE et PERCUTE la bulle.
// CONTACT (ts≈9, INCHANGÉ) -> ÉNORME onde de choc SPHÉRIQUE dans TOUTES
// les directions ('shockwave:burst') + 'rocket:zeroshock' (propulse le
// joueur, v11), secousse caméra maximale, puis la n°1 est DÉTRUITE
// (elle ne réapparaît JAMAIS — pas en meteorsix).
// L'ancienne interdiction "pas de kamikaze / pas de laser de fusée" est
// LEVÉE sur demande explicite de l'utilisateur : le laser de visée est
// OBLIGATOIRE en phase 8.
// Timing 100 % RELATIF à l'entrée de phase (ts).
var STRIKE_EMERGE = 3;    // fin de l'émergence de la faille
var STRIKE_IMPACT = 9;    // CONTACT avec la bulle du Point Zéro (v14 : INCHANGÉ)

function updateStrike(t, dt, ts) {
  // La n°1 a été détruite au contact : rien à animer (elle ne revient pas).
  if (destroyed[0]) {
    if (laserG) laserG.visible = false;
    // Les 6 autres restent effacées.
    for (var di = 1; di < N; di++) { if (rockets[di].alive) setVisible(rockets[di], false); }
    // v21 — ÉPAVE INCANDESCENTE : l'impact continue de brûler 2,5 s (feu +
    // fumée + braises qui retombent vers le Point Zéro) — la destruction a
    // une QUEUE visible, pas une fin nette.
    // v22 — l'épave brûle 4 s (était 2,5) et S'EFFONDRE : des morceaux
    // incandescents tombent (débris du pool partagé, zéro allocation).
    var r0 = rockets[0];
    if (r0.destrT > 0 && r0.destrT < 4.0 && r0.destrPos) {
      r0.destrT += dt;
      if ((frame % 5) === 0) {
        var fxW = fx20();
        if (fxW) {
          try {
            var dW = dens20();
            var dp = r0.destrPos;
            fxW.fire({ x: dp.x, y: dp.y, z: dp.z },
              { count: Math.max(2, Math.round(8 * dW)), spread: 26, size: 14, life: 0.9, up: -30 });
            fxW.smoke({ x: dp.x, y: dp.y + 10, z: dp.z },
              { count: Math.max(2, Math.round(6 * dW)), spread: 30, size: 22, life: 2.2, rise: -14, alpha: 0.4 });
            fxW.embers({ x: dp.x, y: dp.y, z: dp.z },
              { count: Math.max(2, Math.round(10 * dW)), spread: 40, size: 5, life: 1.4 });
          } catch (e) { /* jamais bloquant */ }
        }
      }
      // v22 — l'épave S'EFFONDRE : des morceaux incandescents tombent.
      if ((frame % 12) === 0) {
        var dp2 = r0.destrPos;
        spawnDebris(dp2.x, dp2.y + 10, dp2.z, 8, 30, 20);
      }
    }
    return;
  }

  // Les 6 autres s'effacent vite (rétrécissent puis disparaissent).
  for (var i = 1; i < N; i++) {
    var o = rockets[i];
    if (!o.alive) continue;
    if (ts < 1) {
      var fs = Math.max(1 - ts, 0.001);
      o.group.scale.set(fs, fs, fs);
    } else {
      setVisible(o, false);
    }
  }

  var r = rockets[0];
  if (!r.alive) return;

  if (ts < STRIKE_EMERGE) {
    // v13 : sort d'une faille TRÈS HAUT dans le ciel (y=1200, au-dessus du
    // Point Zéro — la fusée DESCEND DE PLUS HAUT).
    if (!flags.riftStrike) {
      flags.riftStrike = true;
      api.emit('rift:cross', { index: 0, kind: 'strike', pos: r.strikeTop.clone() });
      api.emit('rocket:rift-enter', { index: 0, rift: 'strike' });
      // v21 — SORTIE DE FAILLE TRÈS HAUT : flash (implosion -> flash ->
      // distorsion) — la n°1 déchire le ciel en apparaissant.
      spawnRiftFlash(r.strikeTop.x, r.strikeTop.y, r.strikeTop.z, 0xff8090, 120, 0.8, 0, -1, 0);
    }
    var e0 = easeInOut(ts / STRIKE_EMERGE);
    r.group.position.copy(r.strikeTop);
    var s0 = Math.max(e0, 0.001);
    r.group.scale.set(s0, s0, s0);
    _v1.set(0, -1, 0);
    orientAlong(r, _v1);
    if (laserG) laserG.visible = false;
    trailPush(r);
    // v20 — la fusée fend le ciel en sortant de la faille : gerbe de feu.
    if ((frame % 4) === 0) contrailPuff(r, 60, 30);
    return;
  }
  if (ts < STRIKE_IMPACT) {
    // v14 — PIQUÉ EN S vers le Point Zéro, en ACCÉLÉRATION (ease-in) :
    // la fusée BALAYE latéralement en début de plongeon puis se VERROUILLE
    // sur la cible (le balayage s'éteint à l'approche). LASER DE VISÉE
    // clairement visible : le faisceau se stabilise progressivement sur la
    // bulle pendant que le point d'impact pulse. CONTACT à ts≈9 INCHANGÉ.
    zeroPointNow(_v6); // cible live : le Point Zéro
    if (!r.strikeDived) {
      r.strikeFrom.copy(r.group.position);
      r.strikeDived = true;
      r.strikeTarget.copy(_v6);
    }
    // v21 — ANTICIPATION : 1,5 s avant le contact, un halo « inspire » sur
    // le Point Zéro — l'impact est ANNONCÉ (le laser verrouille déjà).
    if (!r.strikeHaloSent && ts >= STRIKE_IMPACT - 1.5) {
      r.strikeHaloSent = true;
      var fxS = fx20();
      if (fxS) {
        try {
          fxS.halo({ x: r.strikeTarget.x, y: r.strikeTarget.y, z: r.strikeTarget.z },
            { anticip: 1.5, dur: 0.5, radius: 130, color: 0xff5566 });
        } catch (e) { /* jamais bloquant */ }
      }
    }
    var stab = clamp01((ts - STRIKE_EMERGE) / (STRIKE_IMPACT - STRIKE_EMERGE));
    var e1 = easeIn(stab); // accélération : de plus en plus vite
    r.group.position.lerpVectors(r.strikeFrom, r.strikeTarget, e1);
    _v1.copy(r.strikeTarget).sub(r.strikeFrom);
    // Balayage latéral en S : nul au départ et au contact, maximal à
    // mi-plongeon — la trajectoire se verrouille sur la cible.
    var sweepAmp = Math.sin(stab * Math.PI) * (1 - stab) * 90;
    _v2.crossVectors(_v1, _up);
    if (sweepAmp > 0.01 && _v2.lengthSq() > 1e-6) {
      _v2.normalize();
      r.group.position.addScaledVector(_v2, sweepAmp);
    }
    orientAlong(r, _v1.lengthSq() > 1e-8 ? _v1 : _up);
    // Laser de visée : nez de la fusée -> Point Zéro.
    if (laserG) {
      laserG.visible = true;
      updateLaser(r, t, r.strikeTarget, 40, stab);
    }
    // La traînée s'intensifie avec la vitesse.
    // v12 : halo renforcé (était 20 + stab*14).
    r.glow.scale.set(26 + stab * 18, 26 + stab * 18, 1);
    trailPush(r);
    // v20 — PIQUÉ EN FEU : la plongée laisse un ruban de feu incandescent
    // (la vitesse MESURÉE stab pilote la dérive : plus ça plonge, plus ça
    // brûle) — la trajectoire devient lisible d'un coup d'œil.
    if ((frame % 3) === 0) contrailPuff(r, 120 + 160 * stab, 70);
    return;
  }
  if (!flags.impact) {
    // CONTACT ! La n°1 PERCUTE la bulle du Point Zéro.
    flags.impact = true;
    zeroPointNow(_v6);
    var hitPos = _v6.clone();
    // 1. La bulle brille et scintille (event-zeropoint.js) + son (event-audio.js).
    api.emit('rocket:impact', { pos: hitPos.clone() });
    // 2. ÉNORME onde de choc SPHÉRIQUE dans TOUTES les directions
    //    (event-shockwave.js) : coquille + 6 anneaux + flash.
    //    v11 — la fusée ENTRE dans le Point Zéro : cette onde PROPULSE le
    //    joueur TRÈS HAUT et TRÈS LOIN (bus 'rocket:zeroshock'
    //    -> event-player.js : kickZeroShock + culbute du personnage).
    api.emit('rocket:zeroshock', { pos: hitPos.clone() });
    api.emit('shockwave:burst', {
      pos: hitPos.clone(),
      opts: { radius: 1300, duration: 3.6, rings: 6, color: 0xeaf6ff, flash: true }
    });
    // 3. Secousse caméra maximale (directeur caméra, groupe E).
    api.emit('camera:shake', { force: 1.0, duration: 3.0, source: 'rocket-strike' });
    // v21 — DESTRUCTION EN 4 TEMPS LISIBLES : anticipation (laser + halo,
    // ci-dessus) -> EXPLOSION (double gerbe + jet d'étincelles + flash) ->
    // onde de choc (émise en 2) -> DÉBRIS + flash de faille (le Point Zéro
    // « avale » l'épave) -> épave incandescente (4 s, gérée ci-dessus).
    // v22 — la destruction frappe PLUS FORT (timing du contact INCHANGÉ) :
    // SECONDE ONDE DE CHOC (2 vagues) + COLONNE D'IMPACT (pilier de lumière
    // qui transperce le ciel) + plus de débris.
    var fxD = fx20();
    if (fxD) {
      try {
        fxD.burst({ x: hitPos.x, y: hitPos.y, z: hitPos.z },
          { count: 90, color: 0xfff2dd, speed: 320, life: 1.1, size: 10, gravity: 60 });
        fxD.burst({ x: hitPos.x, y: hitPos.y, z: hitPos.z },
          { count: 50, color: 0xff9040, speed: 200, life: 1.6, size: 12, gravity: 120 });
        fxD.sparkJet({ x: hitPos.x, y: hitPos.y, z: hitPos.z },
          { count: 60, dir: { x: 0, y: 1, z: 0 }, spread: 0.8, speed: 380,
            color: 0xffe9c0, size: 7, life: 1.2 });
        fxD.implosion({ x: hitPos.x, y: hitPos.y, z: hitPos.z },
          { count: 70, color: 0xbfe9ff, radius: 160, speed: 260, size: 8 });
        // v22 — COLONNE D'IMPACT : un pilier de lumière blanche jaillit
        // vers le ciel (le choc « transperce » le ciel).
        fxD.sparkJet({ x: hitPos.x, y: hitPos.y, z: hitPos.z },
          { count: 70, dir: { x: 0, y: 1, z: 0 }, spread: 0.3, speed: 900,
            color: 0xeaf6ff, size: 9, life: 1.5 });
        fxD.halo({ x: hitPos.x, y: hitPos.y, z: hitPos.z },
          { anticip: 0.3, dur: 1.2, radius: 240, color: 0xeaf6ff });
      } catch (e) { /* jamais bloquant */ }
    }
    // v22 — SECONDE ONDE DE CHOC (plus resserrée, plus rapide) : la
    // destruction frappe en 2 vagues lisibles.
    api.emit('shockwave:burst', {
      pos: hitPos.clone(),
      opts: { radius: 700, duration: 2.4, rings: 4, color: 0xfff3dd, flash: false }
    });
    spawnDebris(hitPos.x, hitPos.y, hitPos.z, 60, 60, 120);
    spawnDebris(hitPos.x, hitPos.y, hitPos.z, 90, 80, 160); // v22 : plus de débris, plus haut
    spawnRiftFlash(hitPos.x, hitPos.y, hitPos.z, 0xeaf6ff, 160, 0.9);
    r.destrT = 0.001;
    r.destrPos = hitPos.clone();
    // 4. La n°1 est DÉTRUITE : masquée, elle ne réapparaîtra JAMAIS
    //    (ni en meteorsix, ni en descent, ni en veeroff).
    destroyed[0] = true;
    setVisible(r, false);
    if (laserG) laserG.visible = false;
  }
  // Après le contact : ciel dégagé (la n°1 n'existe plus).
}

// v14 — meteorsix [198,206] (8 s) + descent [206,224] (18 s) : les 6
// RESTANTES escortent la météorite en formation INCLINÉE (bank via la
// vitesse mesurée), rayon pulsé + ondulation verticale marquée
// (trajectoire vivante, pas un cercle parfait). En fin de descent, la
// bulle du Point Zéro résiste : la formation se resserre et pousse
// (secondes de phase 12→16, fractions relatives inchangées).
function updateFormation(t, dt, ts, state) {
  var M = meteorNow(_v6);
  var blocked = (state === 'descent' && ts >= 12 && ts < 16);
  var rad = (state === 'descent') ? (blocked ? 22 : 30) : 34;
  var speed = (state === 'descent') ? 0.55 : 0.5;
  for (var i = 1; i < N; i++) {
    var r = rockets[i];
    if (!r.alive) setVisible(r, true);
    if (!r.formInit) { r.formInit = true; r.hasPrev = false; } // pas d'à-coup d'orientation
    var a = t * speed + i * (Math.PI * 2 / 6);
    // v14 : rayon PULSÉ + ondulation verticale marquée.
    var rad2 = rad * (1 + 0.14 * Math.sin(t * 1.3 + i * 2.1));
    var y2 = M.y + 6 + Math.sin(t * 2.5 + i * 1.1) * 3 + Math.sin(t * 0.9 + i * 2.7) * 7;
    r.group.position.set(
      M.x + Math.cos(a) * rad2,
      y2,
      M.z + Math.sin(a) * rad2
    );
    orientVel(r); // v14 : formation INCLINÉE (bank dans les virages)
    var gl = 23 + Math.sin(t * 8 + i) * 6;
    r.glow.scale.set(gl, gl, 1);
    trailPush(r);
  }
}

// v14 — veeroff [224,234] (10 s) : les 6 fusées s'écartent vite en
// TONNEAU (barrel roll), ouvrent chacune une faille d'évasion
// ('rift:cross' kind 'escape') et s'y échappent par un GRAND ARC.
// La météorite continue seule vers le Point Zéro.
function updateVeeroff(t, dt, ts) {
  for (var i = 1; i < N; i++) {
    var r = rockets[i];
    if (r.escDone) { if (r.alive) setVisible(r, false); continue; }
    if (ts < r.escOff) {
      // Pas encore partie : flotte en formation près de la météorite.
      if (!r.alive) { setVisible(r, true); r.hasPrev = false; }
      // v21 — ANTICIPATION : 1,2 s avant la fuite, un halo « inspire » sur
      // la faille d'évasion — chaque départ est annoncé.
      if (!r.escHaloSent && ts >= r.escOff - 1.2) {
        r.escHaloSent = true;
        var fxV = fx20();
        if (fxV) {
          try {
            fxV.halo({ x: r.escTo.x, y: r.escTo.y, z: r.escTo.z },
              { anticip: Math.max(0.3, Math.min(1.2, r.escOff - ts)), dur: 0.5,
                radius: 90, color: RIFT_COLORS[(i - 1) % 7] });
          } catch (e) { /* jamais bloquant */ }
        }
      }
      var M = meteorNow(_v6);
      var a = t * 0.55 + i * (Math.PI * 2 / 6);
      r.group.position.set(
        M.x + Math.cos(a) * 30, M.y + 6 + Math.sin(t * 2.5 + i) * 3, M.z + Math.sin(a) * 30
      );
      orientVel(r); // v14 : banké, continuité avec la formation
      trailPush(r);
      continue;
    }
    if (!r.escRiftSent) {
      r.escRiftSent = true;
      r.rollRate = 3.5; // v14 : TONNEAU pendant la fuite
      api.emit('rift:cross', { index: i - 1, kind: 'escape', pos: r.escTo.clone() });
      // v21 — ÉVASION EN 4 TEMPS : traversée complète (implosion -> flash ->
      // distorsion -> débris) — chaque fusée a sa signature (variation
      // entre les 6).
      riftCrossFX(r.escTo.x, r.escTo.y, r.escTo.z, i - 1, 0, 1, 0);
    }
    var k = (ts - r.escOff) / r.escDur;
    if (k >= 1) {
      r.escDone = true;
      r.rollRate = 0; r.rollAng = 0;
      setVisible(r, false);
      continue;
    }
    if (!r.alive) { setVisible(r, true); r.hasPrev = false; }
    var e = easeInOut(k);
    bez2(r.escFrom, r.escCtl, r.escTo, e, r.group.position);
    r.rollAng = (r.rollAng + r.rollRate * dt) % (Math.PI * 2);
    orientVel(r); // v14 : orientation par la vitesse + tonneau (applyRoll)
    var sc = 1 - easeIn(clamp01((k - 0.66) / 0.34)) * 0.999;
    sc = Math.max(sc, 0.001);
    r.group.scale.set(sc, sc, sc);
    r.glow.scale.set(27, 27, 1);
    trailPush(r);
  }
}

/* ---------------------------------------------------------------------------
 * Boucle principale.
 * ------------------------------------------------------------------------- */

function resetRun() {
  flags = {};
  destroyed = [false, false, false, false, false, false, false];
  trailLife = 7.0; trailEvery = 1; // v12 (était 4.9)
  trailSpread = 1; // v15
  hideLaunchFX(); // v15 : réarme les FX de décollage au sol
  for (var tri = 0; tri < turnRings.length; tri++) { // v17 : anneaux de choc réarmés
    turnRings[tri].t = 1e9;
    if (turnRings[tri].mesh) turnRings[tri].mesh.visible = false;
  }
  for (var rfi = 0; rfi < riftFlashes.length; rfi++) { // v21 : flashs de faille réarmés
    riftFlashes[rfi].t = 1e9;
    if (riftFlashes[rfi].g) riftFlashes[rfi].g.visible = false;
  }
  if (gantry) gantry.visible = false; // v21 : portique réarmé
  setTrailMode('fire');
  setSkyView(false); // v17 : camera.far restauré au redémarrage
  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    r.curve = null; r.convIn = false; r.nearMet = false;
    r.convTArr = 0; r.convTRe = 0; // v10
    r.convAz = 0; // v17
    r.launched = false; r.launchT = -1; r.appearT = -1;
    r.launchCrossed = false; r.crossT = 0; // v10
    r.dance = null; // v10
    r.prevU = 0; r.frontSent = false; r.backSent = false; // v10
    r.turnSm = 0; r.turnRaw = 0; r.lastShockT = -10; r.speedSm = 0; // v10 + v17
    r.sweepCurve = null; r.sweepT0 = 0; r.sweepDur = 1; r.sweepAz = 0; // v17
    r.sweepShockSent = false; r.joinFrom = null; r.joinT = 0; // v17
    r.rollAng = 0; r.rollRate = 0; // v11 : tonneau réarmé
    r.formInit = false; // v14 : formation réarmée
    r.peeling = false; r.peeled = false;
    r.escDone = false; r.escRiftSent = false; r.hasPrev = false;
    r.fadeOut = false; r.strikeDived = false;
    // v21 : chorégraphie enrichie réarmée
    r.sparkT = 0.4 + Math.random() * 0.8; r.signalMode = false;
    r.riftHaloSent = false; r.peelHaloSent = false;
    r.escHaloSent = false; r.strikeHaloSent = false;
    r.mile = 0;
    r.rumble1 = r.rumble2 = r.rumble3 = r.rumbleG = false;
    r.antiS1 = r.antiS2 = r.antiS3 = false; // v24 : grondement d'anticipation
    r.destrT = 0; r.destrPos = null;
    // v22 : personnalité et allumage séquencé réarmés
    r.surgeT = 2 + i * 1.3; r.surgeK = 0; r.spacePuffAcc = 0;
    r.engIg = [true, true, true];
    setVisible(r, false);
  }
  hideAll();
  setPadRocketVisible(true);
  lastState = '';
  busPhase = '';
}

function update(dt, t) {
  if (!root.AZEvent.active) { publishBodies(); return; } // v14 : contrat tenu même inactif (tableau vide)
  attachScene();
  if (!scene || !api) return;
  frame++;

  // Redémarrage de l'event : on réarme tout.
  if (t < lastT - 0.5) resetRun();
  lastT = t;

  // Entrée de phase : via le bus 'phase:<nom>' (prioritaire), sinon
  // détection de changement d'AZEvent.state (repli, ex. init tardive).
  if (busPhase) {
    if (busPhase !== lastState) enterPhase(busPhase, t);
    lastState = busPhase;
    busPhase = '';
  }
  var state = root.AZEvent.state;
  if (state !== lastState) {
    enterPhase(state, t);
    lastState = state;
  }

  var ts = root.AZEvent.tState || 0; // secondes RELATIVES à la phase
  if (state === 'firstrocket') updateFirst(t, dt, ts);
  else if (state === 'sixrockets') updateSix(t, dt, ts);
  else if (state === 'convergence') updateConvergence(t, dt, ts);
  else if (state === 'loop') updateLoop(t, dt, ts);
  else if (state === 'acceleration') updateAcceleration(t, dt, ts);
  else if (state === 'silence') updateSilence(t, dt, ts);
  else if (state === 'strike') updateStrike(t, dt, ts);
  else if (state === 'meteorsix' || state === 'descent') updateFormation(t, dt, ts, state);
  else if (state === 'veeroff') updateVeeroff(t, dt, ts);

  // Fumée du décollage (vieillit même après la fin de l'émission).
  if (smoke.points.visible) smokeUpdate(dt);

  // v15 : FX de décollage au sol (onde de choc + halo — vieillissent seuls).
  updateLaunchFX(dt);
  updateLaunchDust(dt); // v22 : anneau de poussière du décollage

  // Vieillissement des traînées.
  for (var i = 0; i < N; i++) {
    if (rockets[i].trail.points.visible) trailUpdate(rockets[i], dt);
  }

  // v10 : les traînées s'ÉPAISSISSENT dans les virages (mouvement secondaire).
  // v14 : + tuyères incandescentes (la lueur suit la poussée).
  for (var j2 = 0; j2 < N; j2++) {
    var rr = rockets[j2];
    if (rr.alive) {
      trailSizeUpdate(rr);
      // v22 — SURSAUT MOTEUR : de temps en temps le moteur « tousse » plus
      // fort (personnalité) — gerbe d'étincelles + poussée visible.
      rr.surgeK = Math.max(0, (rr.surgeK || 0) - dt * 1.4);
      rr.surgeT -= dt;
      if (rr.surgeT <= 0) {
        rr.surgeT = 4 + Math.random() * 4;
        if ((rr.speedSm || 0) > 1.5 || (rr.launchSpdSm || 0) > 50) {
          rr.surgeK = 1;
          var fxSg = fx20();
          if (fxSg) {
            try {
              rr.nozzleRef.getWorldPosition(_ev);
              var dSg = dens20();
              fxSg.sparkle({ x: _ev.x, y: _ev.y, z: _ev.z },
                { count: Math.max(2, Math.round(8 * dSg)), spread: 6,
                  size: 6, life: 0.5, color: 0xfff3d0 });
            } catch (esg) { /* jamais bloquant */ }
          }
        }
      }
      // v22 — TRAÎNÉE VOLUMINEUSE en vol : feu + fumée + étincelles
      // (cadencé, densité réduite sur mobile via dens20()).
      if (trailMode === 'space' && (rr.speedSm || 0) > 2) {
        rr.spacePuffAcc += dt;
        if (rr.spacePuffAcc > 0.12) { rr.spacePuffAcc = 0; spaceContrailPuff(rr); }
      }
      updateEngineGlow(rr, t);
      // v21 — ÉTINCELLES DE COQUE : la coque « crache » des étincelles de
      // temps en temps (cadencé par rr.sparkT, densité réduite sur mobile).
      rr.sparkT -= dt;
      if (rr.sparkT <= 0) {
        rr.sparkT = 0.6 + Math.random() * 1.1;
        hullSpark(rr);
      }
      // v17 — CHANGEMENT DE CAP BRUTAL : la fusée « claque » une onde de
      // choc (mission 6). turnRaw > 0,55 rad/frame ; anti-rebond 0,8 s.
      if (Math.abs(rr.turnRaw) > 0.55 && t - rr.lastShockT > 0.8) {
        rr.lastShockT = t;
        fireTurnShock(rr, clamp01((Math.abs(rr.turnRaw) - 0.55) / 0.45));
      }
    }
  }
  updateTurnShocks(dt); // v17 : ondes de choc (animation 0,55 s)
  debrisUpdate(dt);     // v17 : débris incandescents
  updateRiftFlashes(dt); // v21 : flashs d'entrée/sortie de faille (3 temps)

  // Publie les positions pour la caméra (ancres 'rocket1'..'rocket7').
  publishAnchors();
  // v14 : publie les corps solides (contrat de collision, chaque frame).
  publishBodies();
}

// Ancre partagée : la caméra suit les fusées via AZEvent.anchors.
function publishAnchors() {
  var AZ = root.AZEvent;
  if (!AZ) return;
  if (!AZ.anchors) AZ.anchors = {};
  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    if (r && r.alive && r.group) {
      var a = AZ.anchors['rocket' + (i + 1)];
      if (!a) { a = { x: 0, y: 0, z: 0 }; AZ.anchors['rocket' + (i + 1)] = a; }
      a.x = r.group.position.x; a.y = r.group.position.y; a.z = r.group.position.z;
    } else if (AZ.anchors['rocket' + (i + 1)]) {
      delete AZ.anchors['rocket' + (i + 1)];
    }
  }
}

// v14 — CONTRAT « FUSÉES SOLIDES » : publie chaque frame
// AZEvent.rocketBodies = [{x, y, z, r, top}, ...] pour les fusées
// actuellement visibles et actives (ni détruites, ni cachées).
// x,z = centre ; y = base (tuyère) ; top = sommet (nez) ;
// r = rayon du cylindre de collision ≈ RS*2 (10 m).
// Tableau MUTÉ EN PLACE (zéro allocation après amorçage), jamais
// null/undefined (vide si aucune fusée). Le push-out côté joueur est
// fait par un autre worker à partir de ce tableau.
var ROCKET_BODY_R = RS * 2;     // rayon du cylindre de collision (m)
var ROCKET_BASE_OFF = 5.4 * RS; // tuyère -> centre (unités modèle)
var ROCKET_TOP_OFF = 5.9 * RS;  // centre -> nez (unités modèle)
function publishBodies() {
  var AZ = root.AZEvent;
  if (!AZ) return;
  var n = 0;
  for (var i = 0; i < N; i++) {
    var r = rockets[i];
    if (!r || !r.alive || destroyed[i] || !r.group.visible) continue;
    // Axe RÉEL de la fusée (quaternion courant) : base et sommet exacts
    // quelle que soit l'orientation (piqué, tonneau, vrille...).
    _v1.set(0, 1, 0).applyQuaternion(r.group.quaternion);
    var s = r.group.scale.x; // échelle uniforme (émergences < 1)
    var o = rocketBodies[n];
    if (!o) { o = { x: 0, y: 0, z: 0, r: 0, top: 0 }; rocketBodies[n] = o; }
    o.x = r.group.position.x;
    o.z = r.group.position.z;
    o.y = r.group.position.y - _v1.y * ROCKET_BASE_OFF * s;
    o.top = r.group.position.y + _v1.y * ROCKET_TOP_OFF * s;
    o.r = ROCKET_BODY_R;
    n++;
  }
  rocketBodies.length = n; // tronque : zéro allocation après amorçage
  AZ.rocketBodies = rocketBodies;
}

/* ---------------------------------------------------------------------------
 * Nettoyage : TOUT est libéré (meshes, géométries, matériaux, textures).
 * ------------------------------------------------------------------------- */

function dispose() {
  if (scene) {
    for (var i = 0; i < rockets.length; i++) {
      var r = rockets[i];
      scene.remove(r.group);
      scene.remove(r.trail.points);
      r.group.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map && o.material.map !== glowTex && o.material.map !== checkerTex)
            o.material.map.dispose();
          o.material.dispose();
        }
      });
      r.trail.geo.dispose();
      r.trail.points.material.dispose();
    }
    if (smoke) {
      scene.remove(smoke.points);
      smoke.geo.dispose();
      smoke.points.material.dispose();
      smoke = null;
    }
    if (laserG) {
      scene.remove(laserG);
      laserG.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      laserG = null;
      laserCore = laserGlow = laserRing = laserDot = null;
      laserCoreMat = laserGlowMat = laserRingMat = null;
    }
    if (ring) {
      scene.remove(ring);
      ring.geometry.dispose();
      ringMat.dispose();
      ring = null; ringMat = null;
    }
    if (linkG) {
      scene.remove(linkG);
      // géométrie + matériau PARTAGÉS par les 7 faisceaux : libérés une fois.
      if (linkBeamGeo) { linkBeamGeo.dispose(); linkBeamGeo = null; }
      if (linkBeamMat) { linkBeamMat.dispose(); linkBeamMat = null; }
      linkG = null; linkBeams = [];
    }
    // v15 : FX de décollage au sol (créés paresseusement au premier décollage).
    if (launchRing) {
      scene.remove(launchRing);
      launchRing.geometry.dispose();
      launchRing = null;
    }
    if (launchRingMat) { launchRingMat.dispose(); launchRingMat = null; }
    if (launchGlow) {
      scene.remove(launchGlow);
      launchGlow.material.dispose(); // sprite : matériau seul (géométrie partagée)
      launchGlow = null;
    }
    // v22 : anneau de poussière du décollage (créé paresseusement).
    if (launchDust) {
      scene.remove(launchDust);
      launchDust.geometry.dispose();
      launchDust = null;
    }
    if (launchDustMat) { launchDustMat.dispose(); launchDustMat = null; }
    // v17 : pilier de lumière du décollage (créé paresseusement).
    if (launchBeam) {
      scene.remove(launchBeam);
      launchBeam.geometry.dispose();
      launchBeam = null;
    }
    if (launchBeamMat) { launchBeamMat.dispose(); launchBeamMat = null; }
    // v17 : ondes de choc aux changements de cap (pool d'un par fusée).
    for (var tri = 0; tri < turnRings.length; tri++) {
      scene.remove(turnRings[tri].mesh);
      turnRings[tri].mesh.geometry.dispose();
      turnRings[tri].mat.dispose();
    }
    turnRings = [];
    // v17 : débris incandescents.
    if (debris) {
      scene.remove(debris.points);
      debris.geo.dispose();
      debris.points.material.dispose();
      debris = null;
    }
    // v21 : flashs de faille.
    for (var rfi = 0; rfi < riftFlashes.length; rfi++) {
      var rf = riftFlashes[rfi];
      scene.remove(rf.g);
      rf.ring.geometry.dispose();
      rf.ringMat.dispose(); rf.flashMat.dispose(); rf.haloMat.dispose();
    }
    riftFlashes = [];
    // v21 : portique de lancement.
    if (gantry) {
      scene.remove(gantry);
      gantry.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      gantry = null;
    }
  }
  setSkyView(false); // v17 : restaure le camera.far d'origine (défensif)
  launchRingT = -1; launchGlowT = -1; launchDustT = -1; // v22
  if (glowTex) { glowTex.dispose(); glowTex = null; }
  if (checkerTex) { checkerTex.dispose(); checkerTex = null; }
  setPadRocketVisible(true);
  rockets = [];
  flags = {};
  destroyed = [];
  // v14 : nettoie le contrat de publication (tableau vide, jamais null).
  rocketBodies.length = 0;
  if (root.AZEvent) root.AZEvent.rocketBodies = rocketBodies;
  lastState = '';
  lastT = -1;
  busPhase = '';
  api = null; scene = null; T = null;
}

root.AZEvent.register('rockets', {
  init: init,
  update: update,
  dispose: dispose
});

})(window);
