/* ============================================================================
 * event-rift.js — Les failles de l'événement "THE END" (pass v10).
 * Reproduction du live Fortnite Chapitre 1 Saison X (13/10/2019), 23 états :
 * les failles sont des ÉTOILES/ÉCLATS de VERRE FISSURÉ bleu-blanc —
 * cœur blanc-bleu aveuglant, éclats de cristal rayonnants, éclairs fins
 * bleu-blanc qui crépitent (ref eventwatch/ref3 f3_009, f3_021, f3_024).
 * JAMAIS de tourbillons violets, JAMAIS de teinte mauve.
 *
 * Chorégraphie v10 — phases 1 à 6 (groupe A), pilotée par états + bus,
 * AUCUN temps absolu en dur :
 *   firstrocket : à ZÉRO, la n°1 décolle ; la faille GÉANTE du décollage
 *     s'ouvre DEVANT elle pendant la montée (bus 'rift:cross' launch),
 *     pop easeOutBack + flash, SE REFERME derrière elle (fermeture auto).
 *   sixrockets  : les 6 failles de zones s'ACTIVENT SIMULTANÉMENT
 *     (pulsation, lumineuses, distorsions + flash synchro) pour la danse ;
 *     chaque traversée pulse sa faille ('rift:cross' zone).
 *   convergence : la faille GÉANTE de convergence s'ouvre PRÈS DE LA
 *     MÉTÉORITE FIGÉE (apparition progressive + flash) ; les 7 fusées
 *     y entrent progressivement ('rift:cross' conv -> pulsation).
 *   loop        : la faille de convergence se referme ; DEUX failles
 *     s'ouvrent près de la météorite — AVANT ('great') et ARRIÈRE
 *     ('strike') ; la n°1 y entre/s'en échappe à chaque tour
 *     ('rift:cross' front/back -> pulsation + flash) ; les 6 zones
 *     se multiplient en cascade en fond.
 *   acceleration: la faille AVANT GRANDIT progressivement (cible des fusées
 *     et de la météorite) ; les fusées s'y engouffrent en fin de phase.
 *   silence     : TOUT se referme SAUF la gigantesque faille qui s'ouvre
 *                 DIRECTEMENT AU-DESSUS du Point Zéro (coordination groupe B :
 *                 la météorite en émerge — position live lue dans AZ.rifts).
 *   strike      : faille géante très haut dans le ciel (y=800), la fusée en
 *     émerge ; se referme derrière elle ('rift:cross' strike).
 *   greatrift   : GRANDE faille devant la météorite (+flash, fissure, débris).
 *     v17 — COHÉRENCE (demande critique utilisateur) : la grande faille
 *     s'ouvre AU-DESSUS DU POINT ZÉRO (même formule que event-meteor.js) —
 *     la météorite en RESSORT VISIBLEMENT, AU CENTRE (éclairs de sortie via
 *     le bus 'meteor:emerging').
 *   descent/veeroff : les 6 zones persistent comme points de convergence
 *     des lasers ; les 6 failles d'évasion s'ouvrent au passage des fusées
 *     ('rift:cross' escape).
 *   impact → end : les failles se referment / sont absorbées. Aucune faille
 *     orpheline (fermeture garantie à chaque sortie de phase).
 *
 * v9 conservé : pop easeOutBack à l'ouverture, rotation lente de l'étoile,
 * pulsation renforcée, halo de visibilité.
 * v10 : le HALO PRÉCÈDE l'ouverture (la lueur apparaît avant l'étoile).
 * v17 : FAILLES À FOND — ouvertures maxées (déformation d'espace, pilier de
 * lumière, éclairs), maintien vivant (sursauts de tenue sur les géantes),
 * implosion violente (+ déchirure du ciel à la fermeture) ; AJOUTS INÉDITS
 * (sans nouvelle histoire) : cicatrices lumineuses rémanentes là où une
 * faille s'est refermée, pluie d'étincelles à chaque traversée.
 *
 * Publie AZEvent.rifts = [{pos:Vector3, open:bool, radius:number, kind:string}]
 * (index 0-5 : zones, 6 : launch, 7 : conv, 8 : strike, 9 : great,
 *  10-15 : escape — lus par event-rockets.js).
 * Réagit à 'phase:<nom>' (séquenceur), 'rocket:launch', 'rift:cross',
 * 'meteor:gone' — jamais de temps absolus, seuls des délais relatifs à
 * l'état courant (tState).
 *
 * v21 — FAILLES À FOND : chaque ouverture est un événement majeur —
 * halo d'anticipation qui « inspire » AVANT l'ouverture (openA : la cause
 * précède l'effet, annulé si la phase a changé), ÉCLAIR DU CIEL qui frappe
 * à l'ouverture/fermeture des géantes, pluie d'étincelles TOURBILLONNANTE
 * aux traversées (sillage spiral), cicatrices des géantes qui PULSENT en
 * rémanence avant de s'éteindre. Rien n'est supprimé/renommé.
 *
 * v22 — FAILLES DÉCHIRANTES : chaque ouverture DÉCHIRE le ciel —
 * ÉVENTAIL d'éclairs du ciel sur les géantes (3 à l'ouverture, 2 à la
 * fermeture), déchirure géante du ciel à l'ouverture des géantes (cooldown
 * anti-spam), crépitement du ciel PENDANT l'anticipation (les arcs
 * précèdent la déchirure), ouverture VIOLENTE (sur-distorsion + éclairs
 * de bord renforcés), tenue pulsante avec SURSAUT D'ÉNERGIE (l'espace se
 * tord + gerbe d'étincelles à chaque sursaut), fermeture qui ASPIRE LA
 * LUMIÈRE (flash blanc qui se contracte vers le centre au lieu d'exploser).
 * La faille géante au-dessus du Point Zéro (openZeroRift) est LA plus
 * massive (échelle 2.4, ouverture lente 2.6 s, anticipation 1.8 s).
 * Acquis v17/v20/v21 intacts : halos d'anticipation, implosion, cicatrices,
 * pluie d'étincelles aux traversées. Rien n'est supprimé/renommé.
 *
 * v23 — FAILLES MASSIVES (demande utilisateur « améliore les failles ») :
 * PLUS GRANDES — bases : zones 2.0->2.8, launch 3.2->4.5, conv 4.2->5.5,
 * strike 3.5->4.5, great 4.5->6.0, escape 0.6->0.9 ; multiplicateurs
 * d'ouverture relevés (zero rift 2.4->3.2 : rayon ~653 m, diamètre 1,3 km —
 * visible de partout sur l'île). Nouveau palier COLOSSAL (base >= 5.0 :
 * conv/great) : éventail de 5 éclairs, déchirure du ciel plus fréquente,
 * cicatrices de 40 s. PLUS BELLES — shader enrichi (uniformes uSpk1/uSpk2 :
 * 16/31 éclats sur les géantes ; énergie bleu-blanc TOURBILLONNANTE interne
 * uSwirl ; anneaux de déformation concentriques uWarp ; double liseré) +
 * GORGE (disque bleu nuit derrière l'étoile : on regarde DANS la faille,
 * profondeur) + tourbillon de bord plus dense sur les colossales (96/48).
 * PLUS SPECTACULAIRES — ouverture explosive dès la frame 1 (flash immédiat),
 * anneau de choc qui grandit avec la faille (4.5+base), 3e anneau
 * d'implosion retardé à la fermeture, flash de succion agrandi, traversées
 * (rift:cross) : anneau de choc réarmé + rafale d'éclairs de bord + gerbes
 * renforcées, meteor:gone : flash 3.5 + onde de choc (contrat inchangé).
 * Cohérence v17/v20 intacte : la météorite entre dans la faille avant
 * (position live), en émerge, meteor:gone {pos, swallowed:true} conservé.
 * Perf : zéro allocation par frame (uniformes/échelles/opacités uniquement),
 * densités réduites sur mobile conservées. Rien n'est supprimé/renommé.
 * ========================================================================== */
(function (root) {
'use strict';

// Rien à faire si le séquenceur n'est pas chargé.
if (!root.AZEvent) return;
var AZ = root.AZEvent;

/* ---------------------------------------------------------------------------
 * Miroir local de la timeline officielle (tTotal en secondes) — DOCUMENTAIRE
 * UNIQUEMENT : le code ne branche JAMAIS sur ces temps, seulement sur les
 * états de phase + le bus (contrainte permanente). v17 : synchronisé avec
 * la timeline officielle (countdown 60 s, total 300 s — fini les segments
 * en boucle).
 * ------------------------------------------------------------------------- */
var TL = {
  countdown:   [0, 60],    firstrocket: [60, 86],   sixrockets: [86, 106],
  convergence: [106, 114], loop:        [114, 121], acceleration: [121, 147],
  silence:     [147, 152], strike:      [152, 165], thrown:      [165, 172],
  greatrift:   [172, 182], meteorsix:   [182, 189], descent:    [189, 209],
  veeroff:     [209, 217], impact:      [217, 256], contraction: [256, 260],
  collapse:    [260, 263], growth:      [263, 266], destruction: [266, 275],
  playersucked:[275, 279], allgone:     [279, 283], blackhole:   [283, 293],
  numbers:     [293, 300], end:         [300, Infinity]
};
var PHASE_NAMES = [
  'countdown','firstrocket','sixrockets','convergence','loop','acceleration',
  'silence','strike','thrown','greatrift','meteorsix','descent','veeroff',
  'impact','contraction','collapse','growth','destruction','playersucked',
  'allgone','blackhole','numbers','end'
];

var T = null, api = null, scene = null;
var group = null;
var GEO = null;            // disque partagé (support de l'étoile)
var RIFT_GEO_R = 34;       // rayon du disque GEO (m, à l'échelle 1) — v7 : plus grandes
var RING_IN = null;        // anneau interne partagé (halo)
var RING_OUT = null;       // anneau externe partagé (halo)
var LIGHT_PLANE = null;    // plan partagé du contour de foudre
var PILLAR_GEO = null;     // v12 : cylindre partagé du pilier de lumière
var DEPTH_GEO = null;      // v23 : disque partagé de la « gorge » (profondeur)
var depthTex = null;       // v23 : texture canvas : puits bleu nuit
var lightTex = null;       // texture canvas : anneau de foudre
var glowTex = null;        // texture canvas : halo de visibilité (v8)
var crackTex = null;       // texture canvas : fissure géante du ciel

var rifts = [];            // interne : {pos, open, mesh, mat, kind, base, ...}
var pub = [];              // publié : [{pos, open, radius, kind}]
var debris = [];
var arcs = [];

var crackMesh = null;
var crackT = -1;
var CRACK_DUR = 3;

var entered = {};          // phases déjà traitées (garde anti-doublon)
var lastState = '';
var lastT = -1;
var handlersAttached = false;
var anticipTimers = [];     // v21 : minuteurs d'ouvertures anticipées (annulés au reset/dispose)

// Constantes partagées avec event-rockets.js : cercle des 6 failles de zones.
var ZONE_R = 350, ZONE_Y = 160, ZONE_OFF = 0.3; // v8 : plus basses (visibles du sol)
var FROZEN_METEOR = { x: -180, y: 180, z: -310 }; // miroir de event-meteor.js (repli absolu, rarement utilisé)
var STRIKE_Y = 800;        // miroir de event-rockets.js (faille très haute) — v7
// v17 — ALTITUDE D'ÉMERGENCE au-dessus du Point Zéro : miroir partagé avec
// event-meteor.js (greatRiftPos) — la faille ET la météorite utilisent la
// même formule, la cohérence faille/météorite est garantie.
var V17_EMERGE_ALT = 1300;

var _v1, _v2;

/* ---------------------------------------------------------------------------
 * Shader : ÉTOILE DE VERRE FISSURÉ bleu-blanc.
 * Silhouette en étoile brisée (éclats de cristal aux longueurs aléatoires
 * par secteur, qui crépitent), cœur blanc-bleu aveuglant, lames lumineuses
 * rayonnantes, éclairs fins qui partent de la faille, liseré cyan le long
 * de la silhouette. Dégradé blanc pur -> bleu électrique -> bleu profond.
 * ZÉRO violet, ZÉRO tourbillon.
 * ------------------------------------------------------------------------- */

/* v48 — FISSURE DU CIEL (référence : capture du live, faille au-dessus des
 * nuages violets). Une déchirure blanche en zigzag, des fissures secondaires
 * qui bifurquent, et une gerbe de traits de lumière bleus qui jaillissent de
 * la déchirure dans toutes les directions. L'ouverture « dézippe » la fissure
 * depuis son centre ; la fermeture la recoud. Même jeu d'uniformes que v23
 * (+ uAng : orientation de la déchirure). */
var FRAG = [
  'varying vec2 vUv;',
  'uniform float uTime, uIntensity, uOpacity, uPulse, uDistort, uBoost, uSeed, uSpk1, uSpk2, uSwirl, uWarp, uAng;',
  'float h1(float n){ return fract(sin(n * 91.345 + 47.13) * 43758.5453); }',
  'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  // profil en segments droits = éclair / verre brisé
  'float pl(float x){ float i = floor(x); return mix(h1(i), h1(i + 1.0), fract(x)); }',
  'float jag(float x, float s, float amp){',
  '  return ((pl(x * 4.2 + s) - 0.5) * 0.09 + (pl(x * 11.0 + s * 1.7) - 0.5) * 0.045 + (pl(x * 29.0 + s * 2.3) - 0.5) * 0.016) * amp;',
  '}',
  // gerbe de traits lumineux rayonnant depuis la déchirure
  'float rays(float aa, float rr, float N, float sd, float reach, float t, float speed){',
  '  float s = aa / 6.28318 * N + sd;',
  '  float cell = floor(s);',
  '  float a1 = h2(vec2(cell, sd)), a2 = h2(vec2(cell, sd + 17.0)), a3 = h2(vec2(cell, sd + 31.0));',
  '  float f = abs(fract(s) - (0.5 + (a3 - 0.5) * 0.6));',
  '  float len = reach * (0.22 + 0.78 * a1 * a1);',
  '  float st = 0.03 + 0.2 * a2 * a2;',
  '  float k = (rr - st) / max(0.001, len);',
  '  float body = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.45, 1.0, k));',
  '  float thin = (0.07 + 0.22 * a2) * (1.0 - 0.55 * clamp(k, 0.0, 1.0));',
  '  float line = 1.0 - smoothstep(0.0, thin, f);',
  '  float flow = 0.6 + 0.4 * sin(rr * 24.0 - t * speed + cell * 3.7);',
  '  return line * body * flow * (0.35 + 0.65 * a1);',
  '}',
  'void main(){',
  '  vec2 p = (vUv - 0.5) * 2.0;',
  '  float edge = (1.0 - smoothstep(0.8, 1.0, max(abs(p.x), abs(p.y)))) * (1.0 - smoothstep(0.88, 1.0, length(p)));',
  '  float ca = cos(uAng), sa = sin(uAng);',
  '  vec2 q = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);',
  '  float reveal = smoothstep(0.0, 0.9, uOpacity);',
  '  float shake = uDistort + uBoost;',
  '  float amp = 1.0 + shake * 0.9;',
  '  float HL = 0.64 * reveal * (1.0 + uBoost * 0.08);',
  // déchirure principale
  '  float y0 = jag(q.x, uSeed, amp);',
  '  float d = abs(q.y - y0);',
  '  float along = abs(q.x) / max(0.001, HL);',
  '  float inLen = 1.0 - smoothstep(0.8, 1.0, along);',
  '  float w = mix(0.012, 0.003, clamp(along, 0.0, 1.0)) * (1.0 + uBoost * 1.6 + uPulse * 0.35);',
  '  float flick = 0.82 + 0.18 * sin(uTime * 31.0 + q.x * 47.0);',
  '  float core = (1.0 - smoothstep(w * 0.35, w, d)) * inLen * flick;',
  '  float halo = exp(-d * 60.0) * inLen * (1.0 - 0.55 * clamp(along, 0.0, 1.0));',
  '  float halo2 = exp(-d * 15.0) * (1.0 - smoothstep(0.6, 1.25, along));',
  // fissures secondaires (grandes branches + brindilles)
  '  float bc = 0.0, bh = 0.0;',
  '  for (int i = 0; i < 12; i++) {',
  '    float fi = float(i);',
  '    float r1 = h1(uSeed * 3.1 + fi * 7.3), r2 = h1(uSeed * 5.7 + fi * 3.9), r3 = h1(uSeed * 1.3 + fi * 11.1);',
  '    float big = step(fi, 4.5);',
  '    float sx = (r1 - 0.5) * 1.7 * HL;',
  '    vec2 o = vec2(sx, jag(sx, uSeed, amp));',
  '    float side = r2 < 0.5 ? -1.0 : 1.0;',
  '    float ba = (sx >= 0.0 ? 0.0 : 3.14159) + side * (0.5 + r3 * 0.85) * (sx >= 0.0 ? 1.0 : -1.0);',
  '    vec2 dir = vec2(cos(ba), sin(ba));',
  '    vec2 v = q - o;',
  '    float bl = mix(0.05 + 0.1 * r2, 0.2 + 0.28 * r3, big) * reveal * (1.0 - 0.45 * abs(sx) / max(0.001, HL));',
  '    float tt = dot(v, dir) / max(0.001, bl);',
  '    float pr = dot(v, vec2(-dir.y, dir.x));',
  '    float off = ((pl(tt * 5.0 + fi * 5.0) - 0.5) * 0.05 + (pl(tt * 13.0 + fi * 9.0) - 0.5) * 0.015) * tt * bl * 4.0;',
  '    float bd = abs(pr - off);',
  '    float m = smoothstep(-0.02, 0.06, tt) * (1.0 - smoothstep(0.75, 1.0, tt));',
  '    float bw = mix(0.0065, 0.0012, clamp(tt, 0.0, 1.0)) * mix(0.6, 1.0, big);',
  '    bc = max(bc, (1.0 - smoothstep(bw * 0.35, bw, bd)) * m);',
  '    bh = max(bh, exp(-bd * 70.0) * m * (1.0 - 0.6 * clamp(tt, 0.0, 1.0)) * mix(0.55, 1.0, big));',
  '  }',
  // gerbe de lumière : plus longue perpendiculairement à la déchirure
  '  vec2 pc = q - vec2(0.0, jag(0.0, uSeed, amp));',
  '  float rr = length(pc);',
  '  float aa = atan(pc.y, pc.x);',
  '  float perp = pow(abs(sin(aa)), 1.4) * (sin(aa) > 0.0 ? 1.0 : 0.7);',
  '  float reach = (0.36 + 0.6 * perp) * (0.25 + 0.75 * reveal) * (1.0 + uBoost * 0.3 + uPulse * 0.12);',
  '  float spd = 3.0 + uSwirl * 6.0;',
  '  float s1 = rays(aa, rr, 110.0 + uSpk2 * 2.0, uSeed, reach, uTime, spd);',
  '  float s2 = rays(aa, rr, 40.0 + uSpk1 * 1.5, uSeed + 9.0, reach * 0.85, uTime, spd * 0.7);',
  '  float s3 = rays(aa, rr, 250.0, uSeed + 21.0, reach * 1.2, uTime, spd * 1.3);',
  '  float burst = exp(-rr * 5.5);',
  '  float haze = burst * 0.22 + halo2 * 0.18;',
  '  vec3 col = vec3(1.0) * (core * 2.6 + bc * 1.8);',
  '  col += vec3(0.55, 0.85, 1.0) * (halo * 0.9 + bh * 0.75);',
  '  col += vec3(0.3, 0.52, 1.0) * halo2 * 0.3;',
  '  col += vec3(0.24, 0.52, 1.0) * s1 * 0.95 + vec3(0.5, 0.78, 1.0) * s2 * 1.05 + vec3(0.3, 0.6, 1.0) * s3 * 0.55;',
  '  col += vec3(0.38, 0.42, 1.0) * haze * (0.55 + uWarp * 0.45);',
  '  col += vec3(0.85, 0.95, 1.0) * burst * burst * 0.32 * reveal;',
  '  col *= 1.0 + uPulse * 0.75;',
  '  gl_FragColor = vec4(col * uIntensity * edge, clamp(uOpacity, 0.0, 1.0));',
  '}'
].join('\n');

var VERT = [
  'varying vec2 vUv;',
  'void main(){',
  '  vUv = uv;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

/* ---------------------------------------------------------------------------
 * Utilitaires
 * ------------------------------------------------------------------------- */

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

// v15 — Battement « lub-dub » : double impulsion rythmée par période.
// Pilote la pulsation des failles tenues : elles « respirent » en rythme.
function heart15(x) {
  var p = x - Math.floor(x);
  var a = Math.exp(-Math.pow((p - 0.10) * 10, 2));
  var b = 0.6 * Math.exp(-Math.pow((p - 0.32) * 10, 2));
  return Math.min(1, a + b);
}

// Position COURANTE de la météorite (publiée par event-meteor.js).
function meteorNow(out) {
  var m = AZ.meteorPos;
  if (m && typeof m.x === 'number') return out.set(m.x, m.y, m.z);
  // v7 : repli = position FIGÉE de la météorite (miroir de event-meteor.js).
  // v17 : altitude figée 800 m (était 780).
  if (api && api.center) return out.set(api.center.x + 420, 800, api.center.z + 420);
  return out.set(FROZEN_METEOR.x, FROZEN_METEOR.y, FROZEN_METEOR.z);
}

// Direction horizontale "loin du centre" depuis un point.
function dirOutFrom(p, out) {
  var c = api.center;
  out.set(p.x - c.x, 0, p.z - c.z);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

function findRift(kind, n) {
  var seen = 0;
  for (var i = 0; i < rifts.length; i++) {
    if (rifts[i].kind === kind) {
      if (seen === n) return rifts[i];
      seen++;
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Ouverture / fermeture.
 * open(r, mult, holdT, progDur, flashAtEnd) :
 *   mult      : multiplicateur d'échelle (r.base * mult)
 *   holdT     : > 0 -> fermeture automatique après holdT secondes
 *   progDur   : > 0 -> apparition PROGRESSIVE sur progDur secondes
 *               (échelle + opacité pilotées par la courbe, pas par lerp)
 *   flashAtEnd: flash lumineux quand l'ouverture progressive se termine
 * ------------------------------------------------------------------------- */

function open(r, scaleMult, holdT, progDur, flashAtEnd) {
  if (!r) return;
  r.open = true;
  r.progScale = r.base * (scaleMult || 1);
  r.sTgt = r.progScale;
  r.oTgt = 1.0;
  r.holdT = holdT || 0;
  // v11 : à l'OUVERTURE — ANNEAU DE CHOC expansif + gerbe de débris de
  // verre + arcs électriques (ouverture spectaculaire).
  r.shockT = 0;
  if (r.shock) { r.shock.visible = true; r.shock.scale.set(1, 1, 1); }
  r.rippleT = 0; // v15 : ride d'espace à l'ouverture
  if (r.ripple) { r.ripple.visible = true; r.ripple.scale.set(1, 1, 1); }
  r.closeFast = false;
  // v12 : une (ré)ouverture annule l'implosion éventuelle en cours.
  r.imploT = -1;
  r.imploN = 1; // v13 : compteur de salves d'implosion (réarmé à l'ouverture)
  if (r.implo) r.implo.visible = false;
  r.implo3T = -1; // v23 : le 3e anneau d'implosion est réarmé aussi
  if (r.implo3) r.implo3.visible = false;
  r.suckT = -1; // v22 : une (ré)ouverture annule le flash de succion
  if (r.suckGlow) r.suckGlow.visible = false;
  r.flash = Math.max(r.flash, 0.6); // v23 : l'ouverture est EXPLOSIVE dès la première frame
  // v23 : palier COLOSSAL (base >= 5.0 : conv/great) — les plus grandes
  // failles ouvrent plus fort que les simples géantes.
  var colossal = r.base >= 5.0;
  spawnDebris(r.pos, colossal ? 26 : (r.base >= 3.2 ? 18 : 14));
  spawnArc(r); spawnArc(r); spawnArc(r); // v12 : arcs renforcés à l'ouverture
  // v20 — GERBE D'ÉTINCELLES DIRECTIONNELLE à l'ouverture : l'énergie
  // FUSE hors de la faille (radial + vers le haut) — cause -> effet : la
  // faille s'ouvre, les éclats en sortent. (toolkit partagé, défensif)
  try {
    var fxo = (root.AZEvent && root.AZEvent.fx) || null;
    if (fxo && fxo.sparkJet) {
      var qd = (api && (api.quality === 'low' || api.isMobile)) ? 0.45 : 1;
      var ox = r.pos.x - (api && api.center ? api.center.x : 0);
      var oz = r.pos.z - (api && api.center ? api.center.z : 0);
      fxo.sparkJet(r.pos, { count: Math.round(30 * qd * (colossal ? 2.2 : (r.base >= 3.2 ? 1.6 : 1))),
        dir: { x: ox, y: 0.8, z: oz }, spread: 0.5, speed: 130,
        color: 0xcfe8ff, size: 6, life: 1.1, gravity: 50 });
      fxo.halo(r.pos, { anticip: 0.6, dur: 0.4, radius: r.sCur * RIFT_GEO_R * 1.4,
        color: 0x9fd0ff }); // le halo « inspire » puis claque à l'ouverture
    }
  } catch (e) { /* jamais bloquant */ }
  if (progDur && progDur > 0) {
    r.progT = 0;
    r.progDur = progDur;
    r.flashAtEnd = !!flashAtEnd;
  } else {
    r.progT = -1;
  }
  // v21 : l'ÉCLAIR DU CIEL frappe à l'ouverture des failles GÉANTES
  // (launch, conv, strike, great) — le ciel « répond » à la déchirure.
  // v22 : ÉVENTAIL d'éclairs sur les géantes + DÉCHIRURE GÉANTE du ciel
  // (cooldown 5 s : open() est ré-invoqué pendant la croissance en phase
  // acceleration — la garde v17 évite le spam) ; les petites failles
  // crépitent aussi (un éclair).
  // v23 : les COLOSSALES (base >= 5.0) frappent en éventail LARGE (5) et
  // déchirent le ciel plus souvent (cooldown 3,5 s).
  if (colossal) {
    spawnSkyBoltFan(r, 5);
    if ((r.crackCd || 0) <= 0) { triggerCrack(r.pos); r.crackCd = 3.5; }
  } else if (r.base >= 3.2) {
    spawnSkyBoltFan(r, 3);
    if ((r.crackCd || 0) <= 0) { triggerCrack(r.pos); r.crackCd = 5; }
  } else spawnSkyBolt(r.pos, 300);
}

/* ---------------------------------------------------------------------------
 * v21 — OUVERTURE ANTICIPÉE : le halo d'anticipation « inspire » pendant
 * anticipDur secondes AVANT que la faille ne s'ouvre vraiment (cohérence
 * cause -> effet : l'énergie se concentre, PUIS le ciel se déchire).
 * Garde : si la phase a changé entre-temps, l'ouverture est annulée
 * (jamais d'ouverture orpheline hors contexte). Les minuteurs sont
 * annulés au resetRun/dispose (pas de fuite entre les runs).
 * ------------------------------------------------------------------------- */
function openA(r, scaleMult, holdT, progDur, flashAtEnd, anticipDur) {
  if (!r) return;
  if (!(anticipDur > 0) || r.open) { open(r, scaleMult, holdT, progDur, flashAtEnd); return; }
  var st0 = AZ.state;
  try {
    var fx = (root.AZEvent && root.AZEvent.fx) || null;
    if (fx && fx.halo) {
      fx.halo(r.pos, {
        anticip: anticipDur, dur: 0.45,
        radius: Math.max(60, (r.sCur || r.base) * RIFT_GEO_R * (scaleMult || 1) * 1.25),
        color: 0xbfe0ff, y: 3
      });
    }
  } catch (e) { /* jamais bloquant */ }
  // v22 : le ciel CRÉPITE pendant l'anticipation (les arcs précèdent la
  // déchirure — la cause précède l'effet, jusqu'au bout).
  if (r.base >= 3.2) { spawnArc(r); spawnArc(r); }
  var tm = setTimeout(function () {
    for (var i = anticipTimers.length - 1; i >= 0; i--) {
      if (anticipTimers[i] === tm) { anticipTimers.splice(i, 1); break; }
    }
    if (!AZ.active) return;
    if (AZ.state !== st0) return; // la phase a changé : annulé (cohérence)
    if (!r || r.open) return;
    open(r, scaleMult, holdT, progDur, flashAtEnd);
  }, Math.max(50, anticipDur * 1000));
  anticipTimers.push(tm);
}

function clearAnticipTimers() {
  for (var i = 0; i < anticipTimers.length; i++) {
    try { clearTimeout(anticipTimers[i]); } catch (e) { /* ignore */ }
  }
  anticipTimers.length = 0;
}

function close(r) {
  if (!r) return;
  r.open = false;
  r.progT = -1;
  r.sTgt = 0.0001;
  r.oTgt = 0.0;
  r.holdT = 0;
  // v11 : à la FERMETURE — IMPLOSION : flash + gerbe de débris aspirés +
  // fermeture RAPIDE (la faille s'effondre sur elle-même).
  // v12 : fermeture encore plus violente — flash renforcé, plus de débris,
  // décharges électriques, anneau d'implosion qui se contracte.
  // v15 : IMPLOSION BRUTALE — flash maximal, débris happés vers le centre,
  // double anneau qui se contracte (onde de choc inversée), l'espace se
  // tord (sur-distorsion) pendant l'effondrement.
  // v17 : la fermeture est VIOLENTE — déchirure du ciel au point de
  // fermeture + CICATRICE LUMINEUSE rémanente (la faille laisse une trace
  // qui s'estompe). Seulement si la faille était vraiment ouverte (évite
  // le spam quand closeAll passe sur des failles déjà fermées).
  if (r.oCur > 0.15) {
    triggerCrack(r.pos, true);
    spawnScar(r.pos, r.sCur, r.base >= 3.2, r.base >= 5.0 ? 40 : SCAR_LIFE);
    // v21 : les cicatrices des GÉANTES pulsent ; v23 : celles des COLOSSALES
    // vivent 40 s (la trace d'une faille immense s'efface lentement).
    // v22 : l'éclair FRAPPE le point de fermeture — en ÉVENTAIL sur les
    // géantes (l'énergie retourne au ciel, deux fois).
    if (r.base >= 3.2) spawnSkyBoltFan(r, 2); else spawnSkyBolt(r.pos, 300);
    // v22 : la lumière est ASPIRÉE — le flash de succion se contracte
    // vers le centre (animé dans update(), voir r.suckT).
    r.suckT = 0;
    if (r.suckGlow) r.suckGlow.visible = true;
  }
  r.flash = 2.2;
  spawnDebris(r.pos, 18);
  spawnImploDebris(r.pos, 12); // v15 : éclats ASPIRÉS vers le centre
  // v20 — ASPIRATION DIRECTIONNELLE à la fermeture : les étincelles sont
  // HAPPÉES vers le centre de la faille (implosion, pas explosion) —
  // cause -> effet inversé : la faille se referme, tout y retourne.
  try {
    var fxc = (root.AZEvent && root.AZEvent.fx) || null;
    if (fxc && fxc.implosion) {
      var qc = (api && (api.quality === 'low' || api.isMobile)) ? 0.45 : 1;
      fxc.implosion(r.pos, { count: Math.round(26 * qc), radius: 150,
        size: 6, speed: 130, color: 0x9fd0ff });
    }
  } catch (e) { /* jamais bloquant */ }
  spawnArc(r); spawnArc(r);
  r.imploT = 0;
  r.imploN = 2; // v13 : DOUBLE implosion — la faille "avale" deux fois
  r.imploStart = 4.5;
  if (r.implo) { r.implo.visible = true; r.implo.scale.set(4.5, 4.5, 1); }
  if (r.implo2) { r.implo2.visible = true; r.implo2.scale.set(7.5, 7.5, 1); } // v15
  // v23 : TROISIÈME anneau d'implosion — le plus large, contraction RETARDÉE
  // (0.14 s) : la fermeture « avale » l'espace en trois temps.
  r.implo3T = -0.14;
  if (r.implo3) r.implo3.visible = false;
  r.collapseT = 0; // v15 : torsion de l'espace pendant l'implosion
  r.closeFast = true;
}

function closeAll() {
  for (var i = 0; i < rifts.length; i++) close(rifts[i]);
}

/* ---------------------------------------------------------------------------
 * Fissure géante du ciel + débris de verre + arcs électriques.
 * ------------------------------------------------------------------------- */

function makeCrackTexture() {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  var cx = 128, cy = 128;
  for (var b = 0; b < 14; b++) {
    var ang = (b / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    var x = cx, y = cy, w = 3.5;
    ctx.strokeStyle = 'rgba(180, 220, 255, 1)';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    var len = 60 + Math.random() * 65;
    for (var s = 0; s < 5; s++) {
      ang += (Math.random() - 0.5) * 0.9;
      x += Math.cos(ang) * (len / 5);
      y += Math.sin(ang) * (len / 5);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60, 140, 255, 0.55)';
    ctx.lineWidth = w + 5;
    ctx.stroke();
  }
  return new T.CanvasTexture(cv);
}

// Texture canvas : halo radial bleu (visibilité des failles à distance).
// v8 : les failles doivent se voir de loin, même en plein jour.
function makeGlowTexture() {
  var cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  var ctx = cv.getContext('2d');
  var g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(190, 230, 255, 0.9)');
  g.addColorStop(0.35, 'rgba(120, 190, 255, 0.45)');
  g.addColorStop(0.7, 'rgba(80, 140, 255, 0.16)');
  g.addColorStop(1, 'rgba(60, 110, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(cv);
}

// Texture canvas : anneau de foudre (cercle en zigzag, halo bleu).
function makeLightningTexture() {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(205, 238, 255, 1)';
  ctx.shadowColor = 'rgba(120, 180, 255, 1)';
  ctx.shadowBlur = 12;
  for (var pass = 0; pass < 2; pass++) {
    ctx.lineWidth = pass === 0 ? 5 : 2.5;
    ctx.beginPath();
    var steps = 48;
    for (var i = 0; i <= steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      var rr = 96 + (Math.random() - 0.5) * 26;
      var x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  return new T.CanvasTexture(cv);
}

// v23 — Texture canvas : « gorge » de la faille — puits bleu nuit
// (centre presque noir-bleu -> transparent) : placée derrière l'étoile,
// elle donne l'illusion de regarder DANS la faille (profondeur).
function makeDepthTexture() {
  var cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  var ctx = cv.getContext('2d');
  var g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(2, 8, 30, 0.92)');
  g.addColorStop(0.45, 'rgba(6, 22, 70, 0.55)');
  g.addColorStop(0.8, 'rgba(10, 40, 110, 0.12)');
  g.addColorStop(1, 'rgba(10, 40, 110, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(cv);
}

function triggerCrack(pos, noDebris) {
  if (!crackMesh) return;
  crackMesh.position.copy(pos);
  crackMesh.lookAt(0, pos.y * 0.75, 0);
  crackT = 0;
  crackMesh.visible = true;
  crackMesh.scale.set(0.3, 0.3, 1);
  crackMesh.material.opacity = 0;
  if (!noDebris) spawnDebris(pos, 14); // v17 : la déchirure seule, sans gerbe (la fermeture en a déjà)
}

function spawnDebris(pos, count) {
  var geoD = new T.TetrahedronGeometry(3, 0);
  for (var i = 0; i < count; i++) {
    var mat = new T.MeshBasicMaterial({
      color: new T.Color().setHSL(0.55 + Math.random() * 0.08, 0.95, 0.62),
      transparent: true, opacity: 1
    });
    var m = new T.Mesh(geoD, mat);
    m.position.set(
      pos.x + (Math.random() - 0.5) * 60,
      pos.y + (Math.random() - 0.5) * 30,
      pos.z + (Math.random() - 0.5) * 60
    );
    var sc = 0.6 + Math.random() * 1.4;
    m.scale.set(sc, sc, sc);
    group.add(m);
    debris.push({
      mesh: m,
      vel: new T.Vector3((Math.random() - 0.5) * 20, -30 - Math.random() * 40,
                         (Math.random() - 0.5) * 20),
      rx: (Math.random() - 0.5) * 4, rz: (Math.random() - 0.5) * 4,
      life: 2.5 + Math.random() * 1.5
    });
  }
}

// Arc électrique : long zigzag qui part de la faille (crépitement).
function spawnArc(r) {
  var pts = [];
  var n = 5 + Math.floor(Math.random() * 3);
  var asp = 45 * Math.max(1, r.base);
  var dirA = Math.random() * Math.PI * 2;
  var dx = Math.cos(dirA), dy = Math.sin(dirA) * 0.6;
  for (var i = 0; i < n; i++) {
    var k = i / (n - 1);
    pts.push(new T.Vector3(
      r.pos.x + dx * asp * k * 1.6 + (Math.random() - 0.5) * asp * 0.5,
      r.pos.y + dy * asp * k * 1.6 + (Math.random() - 0.5) * asp * 0.5,
      r.pos.z + (Math.random() - 0.5) * asp * 0.55
    ));
  }
  var geo = new T.BufferGeometry().setFromPoints(pts);
  var mat = new T.LineBasicMaterial({
    color: 0x9fd4ff, transparent: true, opacity: 1,
    blending: T.AdditiveBlending, depthWrite: false
  });
  var line = new T.Line(geo, mat);
  group.add(line);
  // v12 : arcs plus durables (crépitement lisible), plafond relevé.
  arcs.push({ line: line, life: 0.25 + Math.random() * 0.25, maxLife: 0.5 });
  if (arcs.length > 90) { // v15 : plafond relevé (éclairs de bord en plus)
    var old = arcs.shift();
    group.remove(old.line);
    old.line.geometry.dispose(); old.line.material.dispose();
  }
}

// v15 — ÉCLAIR DE BORD : zigzag lumineux qui LÈCHE le contour de la faille
// (suit le périmètre de l'étoile, vie très courte). L'éclair est placé dans
// le plan de la faille via son quaternion (position monde = pos + quat*local).
function spawnEdgeArc(r) {
  if (!r || !r.mesh) return;
  var sc = Math.max(r.sCur, 0.05);
  var n = 5 + Math.floor(Math.random() * 3);
  var baseA = Math.random() * Math.PI * 2;
  var span = 0.5 + Math.random() * 0.8;
  var pts = [];
  var tmp = new T.Vector3();
  for (var i = 0; i < n; i++) {
    var a = baseA + span * (i / (n - 1));
    var rad = 33 * (1 + (Math.random() - 0.5) * 0.14);
    tmp.set(Math.cos(a) * rad * sc, Math.sin(a) * rad * sc, (Math.random() - 0.5) * 3 * sc);
    tmp.applyQuaternion(r.mesh.quaternion);
    pts.push(new T.Vector3(r.mesh.position.x + tmp.x, r.mesh.position.y + tmp.y, r.mesh.position.z + tmp.z));
  }
  var geo = new T.BufferGeometry().setFromPoints(pts);
  var mat = new T.LineBasicMaterial({
    color: 0xe2f4ff, transparent: true, opacity: 1,
    blending: T.AdditiveBlending, depthWrite: false
  });
  var line = new T.Line(geo, mat);
  group.add(line);
  arcs.push({ line: line, life: 0.16 + Math.random() * 0.12, maxLife: 0.28 });
  if (arcs.length > 90) {
    var old2 = arcs.shift();
    group.remove(old2.line);
    old2.line.geometry.dispose(); old2.line.material.dispose();
  }
}

// v21 — ÉCLAIR DU CIEL : zigzag vertical qui FRAPPE le point d'ouverture /
// de fermeture d'une faille (le ciel « répond » à la déchirure). Réutilise
// la piscine d'arcs (même cycle de vie, même plafond) : zéro allocation
// par frame, rien de nouveau à animer.
function spawnSkyBolt(pos, height) {
  if (!pos || !group) return;
  try {
    var h = height || 380;
    var pts = [];
    var n = 7;
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      var spread = 46 * (1 - k * 0.6);
      pts.push(new T.Vector3(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + h - h * k,
        pos.z + (Math.random() - 0.5) * spread
      ));
    }
    var geo = new T.BufferGeometry().setFromPoints(pts);
    var mat = new T.LineBasicMaterial({
      color: 0xeaf6ff, transparent: true, opacity: 1,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var line = new T.Line(geo, mat);
    group.add(line);
    arcs.push({ line: line, life: 0.22 + Math.random() * 0.14, maxLife: 0.36 });
    if (arcs.length > 90) {
      var old3 = arcs.shift();
      group.remove(old3.line);
      old3.line.geometry.dispose(); old3.line.material.dispose();
    }
  } catch (e) { /* l'éclair ne casse jamais la faille */ }
}

// v22 — ÉVENTAIL D'ÉCLAIRS DU CIEL : 3 éclairs en éventail autour du
// point de déchirure (les géantes ne sont pas frappées une fois mais
// TROIS — le ciel se déchire violemment). Chaque éclair réutilise la
// piscine d'arcs (même cycle de vie, même plafond) : zéro allocation
// par frame, rien de nouveau à animer.
function spawnSkyBoltFan(r, n) {
  if (!r || !r.pos) return;
  n = n || 3;
  for (var i = 0; i < n; i++) {
    spawnSkyBolt({
      x: r.pos.x + (Math.random() - 0.5) * 170,
      y: r.pos.y,
      z: r.pos.z + (Math.random() - 0.5) * 170
    }, 380 + Math.random() * 120);
  }
}

// v15 — Débris ASPIRÉS : à l'implosion, des éclats de verre sont happés
// VERS le centre de la faille (vitesse centripète, vie très courte —
// ils sont « avalés »).
function spawnImploDebris(pos, count) {
  var geoD = new T.TetrahedronGeometry(3, 0);
  for (var i = 0; i < count; i++) {
    var mat = new T.MeshBasicMaterial({
      color: new T.Color().setHSL(0.58, 1.0, 0.75),
      transparent: true, opacity: 1,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var m = new T.Mesh(geoD, mat);
    var a = Math.random() * Math.PI * 2;
    var rr = 90 + Math.random() * 120;
    m.position.set(pos.x + Math.cos(a) * rr, pos.y + (Math.random() - 0.5) * 60,
                   pos.z + Math.sin(a) * rr);
    var sc = 0.8 + Math.random() * 1.6;
    m.scale.set(sc, sc, sc);
    group.add(m);
    var toC = new T.Vector3(pos.x - m.position.x, pos.y - m.position.y, pos.z - m.position.z);
    var dist = toC.length() || 1;
    toC.multiplyScalar((140 + Math.random() * 120) / dist); // ~0,5 s pour atteindre le centre
    debris.push({
      mesh: m, vel: toC,
      rx: (Math.random() - 0.5) * 8, rz: (Math.random() - 0.5) * 8,
      life: 0.55 + Math.random() * 0.2
    });
  }
}

/* ---------------------------------------------------------------------------
 * v17 — AJOUTS INÉDITS (sans nouvelle histoire).
 * ------------------------------------------------------------------------- */

// v17 — CICATRICES LUMINEUSES RÉMANENTES : là où une faille s'est refermée,
// une cicatrice de lumière persiste et s'estompe lentement (mémoire du ciel).
var scars = [];
var SCAR_LIFE = 25;   // la cicatrice vit 25 s puis s'efface
var SCAR_MAX = 14;    // plafond (les plus anciennes sont recyclées)
function spawnScar(pos, scaleRef, big, life) {
  if (!pos || !group) return;
  var mat = new T.MeshBasicMaterial({
    map: crackTex, color: 0x9fd4ff,
    transparent: true, opacity: 0.55,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var m = new T.Mesh(new T.PlaneGeometry(150, 150), mat);
  m.position.copy(pos);
  m.lookAt(0, pos.y * 0.75, 0);
  var s = 0.6 + (scaleRef || 1) * 0.35; // la cicatrice garde la taille de la faille
  m.scale.set(s, s, 1);
  group.add(m);
  // v21 : les cicatrices des GÉANTES pulsent en rémanence (cœur qui bat)
  // pendant les premières secondes, avant de s'éteindre doucement.
  // v23 : durée de vie paramétrable (les colossales laissent une trace de 40 s).
  var scarLife = (typeof life === 'number' && life > 0) ? life : SCAR_LIFE;
  scars.push({ mesh: m, life: scarLife, maxLife: scarLife, age: 0, big: !!big });
  if (scars.length > SCAR_MAX) {
    var old = scars.shift();
    group.remove(old.mesh);
    old.mesh.geometry.dispose(); old.mesh.material.dispose();
  }
}

function updateScars(dt) {
  for (var i = scars.length - 1; i >= 0; i--) {
    var sc = scars[i];
    sc.life -= dt;
    sc.age += dt;
    var ck = Math.max(0, sc.life / (sc.maxLife || SCAR_LIFE));
    // v21 : rémanence pulsante des géantes — la cicatrice « bat » 3 fois
    // (lub-dub) puis s'estompe avec les autres.
    var pulse21 = (sc.big && sc.age < 7) ? (0.22 * heart15(sc.age * 0.9)) : 0;
    sc.mesh.material.opacity = 0.55 * ck * ck + pulse21 * ck;
    if (sc.life <= 0) {
      group.remove(sc.mesh);
      sc.mesh.geometry.dispose(); sc.mesh.material.dispose();
      scars.splice(i, 1);
    }
  }
}

function clearScars() {
  for (var i = 0; i < scars.length; i++) {
    group.remove(scars[i].mesh);
    scars[i].mesh.geometry.dispose(); scars[i].mesh.material.dispose();
  }
  scars = [];
}

// v17 — PLUIE D'ÉTINCELLES : à chaque traversée de faille, une gerbe
// d'étincelles incandescentes pleut autour du point de passage.
var sparks = [];
var SPARK_MAX = 160;
var SPARK_GEO = null; // géométrie partagée (créée paresseusement)
function sparkGeo() {
  if (!SPARK_GEO) SPARK_GEO = new T.OctahedronGeometry(1.6, 0);
  return SPARK_GEO;
}
function spawnSparkRain(pos, count) {
  if (!pos || !group) return;
  var geoS = sparkGeo();
  for (var i = 0; i < count; i++) {
    var mat = new T.MeshBasicMaterial({
      color: new T.Color().setHSL(0.55 + Math.random() * 0.1, 1.0, 0.7),
      transparent: true, opacity: 1,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var m = new T.Mesh(geoS, mat);
    m.position.set(
      pos.x + (Math.random() - 0.5) * 40,
      pos.y + (Math.random() - 0.5) * 20,
      pos.z + (Math.random() - 0.5) * 40
    );
    var a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 60;
    group.add(m);
    sparks.push({
      mesh: m,
      vel: new T.Vector3(Math.cos(a) * sp, 40 + Math.random() * 70, Math.sin(a) * sp),
      rx: (Math.random() - 0.5) * 10,
      life: 1.2 + Math.random() * 0.8
    });
  }
  while (sparks.length > SPARK_MAX) {
    var old2 = sparks.shift();
    group.remove(old2.mesh);
    old2.mesh.material.dispose();
  }
}

function updateSparks(dt) {
  for (var i = sparks.length - 1; i >= 0; i--) {
    var sk = sparks[i];
    sk.life -= dt;
    sk.vel.y -= 160 * dt; // gravité : la pluie d'étincelles retombe
    sk.mesh.position.addScaledVector(sk.vel, dt);
    sk.mesh.rotation.x += sk.rx * dt;
    sk.mesh.material.opacity = Math.max(0, Math.min(1, sk.life / 0.8));
    if (sk.life <= 0) {
      group.remove(sk.mesh);
      sk.mesh.material.dispose();
      sparks.splice(i, 1);
    }
  }
}

function clearSparks() {
  for (var i = 0; i < sparks.length; i++) {
    group.remove(sparks[i].mesh);
    sparks[i].mesh.material.dispose();
  }
  sparks = [];
}

// v21 — ÉTINCELLES TOURBILLONNANTES : à chaque traversée de faille, une
// gerbe d'étincelles SPIRALE autour du point de passage (le sillage de ce
// qui vient de traverser — la faille « tourne » autour du passage).
// Piscine dédiée, zéro allocation par frame, densité réduite sur mobile.
var vorts = [];
var VORT_MAX = 120;
var VORT_GEO = null; // géométrie partagée (créée paresseusement)
function vortGeo() {
  if (!VORT_GEO) VORT_GEO = new T.OctahedronGeometry(1.9, 0);
  return VORT_GEO;
}
function spawnVortexSparks(pos, count) {
  if (!pos || !group) return;
  try {
    var lowQv = !!(api && (api.quality === 'low' || api.isMobile));
    var n = lowQv ? Math.max(4, Math.round(count * 0.5)) : count;
    var geoV = vortGeo();
    for (var i = 0; i < n; i++) {
      var mat = new T.MeshBasicMaterial({
        color: new T.Color().setHSL(0.55 + Math.random() * 0.1, 1.0, 0.72),
        transparent: true, opacity: 1,
        blending: T.AdditiveBlending, depthWrite: false, fog: false
      });
      var m = new T.Mesh(geoV, mat);
      var a = Math.random() * Math.PI * 2;
      var rr = 14 + Math.random() * 40;
      m.position.set(
        pos.x + Math.cos(a) * rr,
        pos.y + (Math.random() - 0.5) * 26,
        pos.z + Math.sin(a) * rr
      );
      group.add(m);
      vorts.push({
        mesh: m, cx: pos.x, cz: pos.z,
        ang: a, rad: rr, y: m.position.y,
        spin: (2.5 + Math.random() * 3.5) * (Math.random() < 0.5 ? 1 : -1),
        vy: 30 + Math.random() * 60,
        life: 1.1 + Math.random() * 0.7
      });
    }
    while (vorts.length > VORT_MAX) {
      var old3 = vorts.shift();
      group.remove(old3.mesh);
      old3.mesh.material.dispose();
    }
  } catch (e) { /* jamais bloquant */ }
}

function updateVorts(dt) {
  for (var i = vorts.length - 1; i >= 0; i--) {
    var v = vorts[i];
    v.life -= dt;
    v.ang += v.spin * dt;
    v.rad = Math.max(2, v.rad - dt * 26); // la spirale se resserre vers le point
    v.y += v.vy * dt;
    v.vy -= 90 * dt; // retombe doucement
    v.mesh.position.set(
      v.cx + Math.cos(v.ang) * v.rad,
      v.y,
      v.cz + Math.sin(v.ang) * v.rad
    );
    v.mesh.rotation.y += v.spin * dt * 2;
    v.mesh.material.opacity = Math.max(0, Math.min(1, v.life / 0.7));
    if (v.life <= 0) {
      group.remove(v.mesh);
      v.mesh.material.dispose();
      vorts.splice(i, 1);
    }
  }
}

function clearVorts() {
  for (var i = 0; i < vorts.length; i++) {
    group.remove(vorts[i].mesh);
    vorts[i].mesh.material.dispose();
  }
  vorts = [];
}

/* ---------------------------------------------------------------------------
 * v20 — HALO DE DISTORSION DU CIEL (shimmer) : un seul halo partagé qui
 * suit la PLUS GRANDE faille ouverte — anneau fin bleu-blanc qui ondule
 * autour d'elle (le ciel « frissonne » près des failles). Un seul mesh,
 * zéro allocation par frame.
 * ------------------------------------------------------------------------- */
var shimmer = null;
var shimmerMat = null;
var shimmerGeo = null;

function ensureShimmer() {
  if (shimmer || !group || !T) return;
  shimmerGeo = new T.RingGeometry(0.78, 1.0, 72);
  shimmerMat = new T.MeshBasicMaterial({
    color: 0xa8d4ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  shimmer = new T.Mesh(shimmerGeo, shimmerMat);
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.frustumCulled = false;
  shimmer.visible = false;
  group.add(shimmer);
}

function updateShimmer(dt, t) {
  ensureShimmer();
  if (!shimmer) return;
  // La plus grande faille ouverte (ouverture * taille).
  var best = null, bestK = 0;
  for (var i = 0; i < rifts.length; i++) {
    var r = rifts[i];
    var kk = (r.open ? r.oCur : 0) * r.sCur * r.base;
    if (kk > bestK) { bestK = kk; best = r; }
  }
  if (!best || bestK < 1.2) {
    shimmer.visible = false;
    return;
  }
  shimmer.visible = true;
  shimmer.position.copy(best.pos);
  // Ondulation : l'anneau « respire » (lente) + frémit (rapide, le ciel
  // distordu) — le rayon suit la taille live de la faille * 2.1.
  var breathe = 1 + 0.07 * Math.sin(t * 2.3);
  var shiver = 1 + 0.025 * Math.sin(t * 17.0);
  var rad = best.sCur * RIFT_GEO_R * 2.1 * breathe * shiver;
  shimmer.scale.set(rad, rad, 1);
  shimmer.position.y = best.pos.y + 6 * Math.sin(t * 1.7); // dérive légère
  shimmer.rotation.z += dt * 0.35;
  shimmerMat.opacity = Math.min(0.55, best.oCur * 0.5) *
    (0.72 + 0.28 * Math.sin(t * 9.0));
}

function clearShimmer() {
  if (shimmer && group) group.remove(shimmer);
  if (shimmerMat) shimmerMat.dispose();
  if (shimmerGeo) shimmerGeo.dispose();
  shimmer = null; shimmerMat = null; shimmerGeo = null;
}

/* ---------------------------------------------------------------------------
 * Création d'une faille (étoile de verre fissuré + halo + contour de foudre).
 * ------------------------------------------------------------------------- */

function createRift(x, y, z, kind, base) {
  var mat = new T.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: Math.random() * 10 },
      uIntensity: { value: 1.0 },
      uOpacity: { value: 0.0 },
      uPulse: { value: 0.0 },
      uDistort: { value: 0.0 },
      uBoost: { value: 0.0 }, // v15 : sur-distorsion (ouverture/implosion)
      uSeed: { value: Math.random() * 100.0 },
      uSpk1: { value: base >= 4.5 ? 16.0 : 12.0 }, // v23 : bords plus détaillés sur les géantes
      uSpk2: { value: base >= 4.5 ? 31.0 : 23.0 },
      uSwirl: { value: 0.4 }, // v23 : énergie tourbillonnante interne
      uWarp: { value: 0.7 },  // v23 : anneaux de déformation
      uAng: { value: -0.38 + (Math.random() - 0.5) * 0.9 } // v48 : déchirure en diagonale
    },
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide
  });
  var mesh = new T.Mesh(GEO, mat);
  mesh.position.set(x, y, z);
  mesh.lookAt(0, y * 0.75, 0);
  mesh.scale.set(0.0001, 0.0001, 0.0001);
  mesh.visible = false;
  group.add(mesh);
  // Halo lumineux + contour de foudre : enfants de l'étoile,
  // ils héritent de son échelle (failles géantes incluses).
  var ringMat1 = new T.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  var ring1 = new T.Mesh(RING_IN, ringMat1);
  ring1.position.z = 0.5;
  mesh.add(ring1);
  var ringMat2 = new T.MeshBasicMaterial({ color: 0x4f9dff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  var ring2 = new T.Mesh(RING_OUT, ringMat2);
  ring2.position.z = 0.4;
  mesh.add(ring2);
  var lightMat = new T.MeshBasicMaterial({ map: lightTex, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  var light = new T.Mesh(LIGHT_PLANE, lightMat);
  light.position.z = 0.8;
  mesh.add(light);
  // v8 : halo lumineux de visibilité à distance (enfant de l'étoile,
  // hérite de l'échelle) — les failles se voient de loin, même de jour.
  var glowMat = new T.SpriteMaterial({ map: glowTex, color: 0x77c8ff,
    transparent: true, opacity: 0, blending: T.AdditiveBlending,
    depthWrite: false });
  var glow = new T.Sprite(glowMat);
  glow.scale.set(3.2, 3.2, 1);
  mesh.add(glow);
  // v11 : ANNEAU DE CHOC expansif à l'ouverture (enfant de l'étoile,
  // hérite de son échelle — l'anneau jaillit de la faille qui s'ouvre).
  var shockMat = new T.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var shock = new T.Mesh(RING_OUT, shockMat);
  shock.position.z = 0.4;
  shock.visible = false;
  mesh.add(shock);
  // v12 : PILIER DE LUMIÈRE vertical projeté à l'ouverture (enfant de
  // l'étoile — la largeur suit l'échelle de la faille, la hauteur reste
  // 500 m : le pilier perce le ciel quand la faille s'ouvre).
  var pillarMat = new T.MeshBasicMaterial({ color: 0xaee4ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var pillar = new T.Mesh(PILLAR_GEO, pillarMat);
  pillar.position.y = 250;
  mesh.add(pillar);
  // v12 : ANNEAU D'IMPLOSION — à la fermeture, l'anneau se contracte
  // violemment vers le centre (la faille s'effondre sur elle-même).
  var imploMat = new T.MeshBasicMaterial({ color: 0xd8f2ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var implo = new T.Mesh(RING_OUT, imploMat);
  implo.position.z = 0.4;
  implo.visible = false;
  mesh.add(implo);
  // v15 : SECOND ANNEAU D'IMPLOSION — plus large, contraction décalée :
  // l'onde de choc INVERSÉE (la faille « avale » l'espace autour d'elle).
  var implo2Mat = new T.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var implo2 = new T.Mesh(RING_OUT, implo2Mat);
  implo2.position.z = 0.35;
  implo2.visible = false;
  mesh.add(implo2);
  // v23 : TROISIÈME ANNEAU D'IMPLOSION — le plus large, contraction
  // retardée : à la fermeture, la faille « avale » l'espace en trois temps.
  var implo3Mat = new T.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var implo3 = new T.Mesh(RING_OUT, implo3Mat);
  implo3.position.z = 0.3;
  implo3.visible = false;
  mesh.add(implo3);
  // v15 : ANNEAU D'ONDULATION — à l'ouverture, une ride d'espace s'étend
  // autour de la faille (déformation visible de l'espace environnant).
  var rippleMat = new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true,
    opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var ripple = new T.Mesh(RING_OUT, rippleMat);
  ripple.position.z = 0.3;
  ripple.visible = false;
  mesh.add(ripple);
  // v22 : FLASH DE SUCCION — sprite qui se CONTRACTE vers le centre à la
  // fermeture (la lumière est « aspirée » dans la faille qui s'effondre,
  // au lieu d'exploser vers l'extérieur). Enfant de l'étoile.
  var suckGlowMat = new T.SpriteMaterial({ map: glowTex, color: 0xf2faff,
    transparent: true, opacity: 0, blending: T.AdditiveBlending,
    depthWrite: false });
  var suckGlow = new T.Sprite(suckGlowMat);
  suckGlow.scale.set(3.5, 3.5, 1);
  suckGlow.visible = false;
  mesh.add(suckGlow);
  // v23 : GORGE DE LA FAILLE — disque bleu nuit derrière l'étoile : on
  // regarde DANS un puits (profondeur). Enfant de l'étoile, hérite de
  // son échelle (les géantes ont un puits immense).
  var throatMat = new T.MeshBasicMaterial({ map: depthTex, transparent: true,
    opacity: 0, blending: T.NormalBlending, depthWrite: false,
    side: T.DoubleSide, fog: false });
  var throat = new T.Mesh(DEPTH_GEO, throatMat);
  throat.position.z = -1.2;
  mesh.add(throat);
  // v48 : une fissure du ciel n'a ni anneaux ronds, ni puits sombre, ni
  // couronne d'éclairs circulaire — la lumière sort de la déchirure.
  ring1.visible = false; ring2.visible = false; light.visible = false; throat.visible = false;
  // v12 : PARTICULES TOURBILLONNANTES sur le bord — la faille TENUE
  // crépite en permanence sur sa silhouette (enfant de l'étoile).
  // v15 : tourbillon PLUS DENSE (64 particules, 32 en lowQ).
  // v23 : les COLOSSALES (bords immenses) ont un tourbillon encore plus
  // dense (96, 48 en lowQ) — les bords restent « vivants » à grande échelle.
  var colossalSwirl = base >= 5.0;
  var SWIRL_N = (api && api.quality === 'low') ? (colossalSwirl ? 48 : 32)
                                              : (colossalSwirl ? 96 : 64);
  var swirlGeo = new T.BufferGeometry();
  swirlGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(SWIRL_N * 3), 3));
  var swirlData = [];
  // v48 : étincelles projetées hors de la déchirure (u : position le long
  // de la fissure, ph : progression de la projection, côté aléatoire).
  for (var swj = 0; swj < SWIRL_N; swj++) {
    swirlData.push({
      u: (Math.random() * 2 - 1) * Math.random(),
      ph: Math.random(),
      spd: 0.35 + Math.random() * 0.9,
      side: Math.random() < 0.5 ? -1 : 1,
      reach: 10 + Math.random() * 26,
      zoff: (Math.random() - 0.5) * 2
    });
  }
  var swirlMat = new T.PointsMaterial({ color: 0xa8dcff, size: 2.4,
    transparent: true, opacity: 0, blending: T.AdditiveBlending,
    depthWrite: false, fog: false });
  var swirl = new T.Points(swirlGeo, swirlMat);
  swirl.frustumCulled = false;
  mesh.add(swirl);
  var giant = (kind === 'launch' || kind === 'conv' || kind === 'strike' || kind === 'great');
  var r = {
    pos: new T.Vector3(x, y, z),
    open: false,
    mesh: mesh, mat: mat, kind: kind, base: base,
    ring1: ring1, ring2: ring2, light: light, glow: glow, glowMat: glowMat,
    shock: shock, shockMat: shockMat, shockT: -1, // v11 : anneau de choc
    pillar: pillar, pillarMat: pillarMat,       // v12 : pilier de lumière
    implo: implo, imploMat: imploMat, imploT: -1, // v12 : implosion
    implo2: implo2, implo2Mat: implo2Mat,       // v15 : 2e anneau (onde inversée)
    implo3: implo3, implo3Mat: implo3Mat, implo3T: -1, // v23 : 3e anneau (retardé)
    throat: throat, throatMat: throatMat,       // v23 : gorge (profondeur)
    ripple: ripple, rippleMat: rippleMat, rippleT: -1, // v15 : ride d'espace
    suckGlow: suckGlow, suckGlowMat: suckGlowMat, suckT: -1, // v22 : flash de succion
    crackCd: 0,                                 // v22 : cooldown de la déchirure géante
    collapseT: -1,                              // v15 : torsion de l'espace à l'implosion
    edgeT: Math.random() * 0.5,                // v15 : minuteur d'éclairs de bord
    swirl: swirl, swirlMat: swirlMat, swirlData: swirlData, // v12 : tourbillon de bord
    closeFast: false, // v11 : implosion rapide à la fermeture
    iBase: giant ? 1.35 : 1.0,
    sCur: 0.0001, sTgt: 0.0001, progScale: 0.0001,
    oCur: 0.0, oTgt: 0.0,
    progT: -1, progDur: 0, flashAtEnd: false,
    starK: 1, // v10 : retard de l'étoile sur le halo à l'ouverture (0..1)
    holdT: 0, pulse: 0, flash: 0,
    arcT: Math.random() * 0.5
  };
  rifts.push(r);
  return r;
}

/* ---------------------------------------------------------------------------
 * Ouvertures scénarisées (appelées par onPhase et par le bus).
 * ------------------------------------------------------------------------- */

// Faille GÉANTE du décollage : s'ouvre devant la fusée n°1, très haut
// au-dessus du pas de tir (la fusée y monte en vertical).
function openLaunchRift() {
  if (entered.launchRiftOpen) return;
  entered.launchRiftOpen = true;
  var lr = findRift('launch', 0);
  if (!lr) return;
  var lp = AZ.launchPad;
  if (lp && typeof lp.x === 'number') lr.pos.set(lp.x, 300, lp.z);
  else lr.pos.set(api.center.x, 300, api.center.z);
  lr.mesh.position.copy(lr.pos);
  lr.mesh.lookAt(0, lr.pos.y * 0.75, 0);
  openA(lr, 2.4, 0, 1.0, true, 1.2); // v23 : GÉANTE MASSIVE (était 2.0) ; v21 : halo d'anticipation 1,2 s avant
  lr.mat.uniforms.uDistort.value = 0.8; // v17 : l'espace se déchire (était 0.5)
  triggerCrack(lr.pos);
}

// Activation SIMULTANÉE des 6 failles de zones (danse des fusées, phase 2).
// v10 : flash SYNCHRO à l'ouverture — l'activation se voit d'un coup.
function activateZones() {
  if (entered.zonesOn) return;
  entered.zonesOn = true;
  for (var i = 0; i < 6; i++) {
    var z = findRift('zone', i);
    if (!z) continue;
    openA(z, 1.3, 0, 1.0, true, 1.0); // v23 : failles du ciel MASSIVES (était 1.15) ; v21 : anticipation synchro 1,0 s
    z.pulse = 1;
    z.mat.uniforms.uDistort.value = 0.55; // v17 : déformation d'espace (était 0.45)
  }
}

// Faille GÉANTE de convergence (phase 4) : PRÈS DE LA MÉTÉORITE FIGÉE —
// apparition progressive + flash à l'ouverture. Les 7 fusées y entrent.
function openConvRift() {
  if (entered.convOpen) return;
  entered.convOpen = true;
  var M = meteorNow(_v1);
  dirOutFrom(M, _v2);
  var cr = findRift('conv', 0);
  if (!cr) return;
  cr.pos.copy(M).addScaledVector(_v2, 45); cr.pos.y = M.y;
  cr.mesh.position.copy(cr.pos);
  cr.mesh.lookAt(0, cr.pos.y * 0.75, 0);
  openA(cr, 2.0, 0, 2.6, true, 1.5); // v23 : COLOSSALE (était 1.6) ; v21 : anticipation 1,5 s
  cr.mat.uniforms.uDistort.value = 0.7; // v17 : déformation d'espace (était 0.6)
  triggerCrack(cr.pos);
}

// v10 — Failles de la BOUCLE (phase 5) : AVANT ('great') et ARRIÈRE
// ('strike'), de part et d'autre de la météorite. La fusée passe autour,
// la faille avant est (re)créée DEVANT la météorite, la fusée y entre,
// ressort DERRIÈRE (faille arrière), recommence.
var LOOP_R = 380; // miroir de event-rockets.js (rayon de la boucle)
function openLoopRifts() {
  if (entered.loopRiftsOpen) return;
  entered.loopRiftsOpen = true;
  var M = meteorNow(_v1);
  dirOutFrom(M, _v2);
  var gr = findRift('great', 0); // faille AVANT
  if (gr) {
    gr.pos.copy(M).addScaledVector(_v2, -LOOP_R); gr.pos.y = M.y;
    gr.mesh.position.copy(gr.pos);
    gr.mesh.lookAt(0, gr.pos.y * 0.75, 0);
    openA(gr, 1.6, 0, 2.2, true, 1.2); // v23 : faille avant MASSIVE (était 1) ; v21 : anticipation 1,2 s
    gr.mat.uniforms.uDistort.value = 0.7;
    triggerCrack(gr.pos);
  }
  var sr = findRift('strike', 0); // faille ARRIÈRE
  if (sr) {
    sr.pos.copy(M).addScaledVector(_v2, LOOP_R); sr.pos.y = M.y;
    sr.mesh.position.copy(sr.pos);
    sr.mesh.lookAt(0, sr.pos.y * 0.75, 0);
    openA(sr, 1.3, 0, 2.2, true, 1.2); // v23 : faille arrière plus grande (était 1) ; v21 : anticipation 1,2 s
    sr.mat.uniforms.uDistort.value = 0.7;
  }
}

// Faille GÉANTE de strike : très haut dans le ciel, la fusée en émerge.
function openStrikeRift() {
  if (entered.strikeOpen) return;
  entered.strikeOpen = true;
  var sr = findRift('strike', 0);
  if (!sr) return;
  sr.pos.set(api.center.x, STRIKE_Y, api.center.z);
  sr.mesh.position.copy(sr.pos);
  sr.mesh.lookAt(0, sr.pos.y * 0.75, 0);
  openA(sr, 1.5, 0, 2.5, true, 1.2); // v23 : plus grande (était 1) ; v21 : anticipation 1,2 s
  sr.mat.uniforms.uDistort.value = 0.6;
  triggerCrack(sr.pos);
}

// GRANDE faille (greatrift) : la météorite en ressort.
// v17 — COHÉRENCE FAILLE (demande critique utilisateur : la météorite doit
// RESSORTIR VISIBLEMENT de la grande faille) : la grande faille s'ouvre
// AU-DESSUS DU POINT ZÉRO (position live — même formule que
// event-meteor.js greatRiftPos : zp.y + V17_EMERGE_ALT). Fini la faille
// ouverte sur l'ancienne position figée périmée de la météorite cachée :
// la faille et l'émergence sont AU MÊME POINT. Maxée : immense, aveuglante.
function openGreatRift() {
  if (entered.greatOpen) return;
  entered.greatOpen = true;
  var gr = findRift('great', 0);
  if (!gr) return;
  var zp = AZ.zeroPointPos || null;
  if (zp && isFinite(zp.x) && isFinite(zp.y) && isFinite(zp.z))
    gr.pos.set(zp.x, zp.y + V17_EMERGE_ALT, zp.z);
  else
    gr.pos.set(api.center.x, api.center.y + 25 + V17_EMERGE_ALT, api.center.z);
  gr.mesh.position.copy(gr.pos);
  gr.mesh.lookAt(0, gr.pos.y * 0.75, 0);
  openA(gr, 3.0, 0, 3.0, true, 1.5); // v23 : COLOSSALE (était 2.2) — la météorite en ressort AU CENTRE ; v21 : anticipation 1,5 s
  gr.mat.uniforms.uDistort.value = 1.0;
  gr.mat.uniforms.uIntensity.value = 1.9; // v17 : aveuglante (était 1.6)
  triggerCrack(gr.pos);
}

// GIGANTESQUE faille AU-DESSUS du Point Zéro (silence / phase 7).
// — Coordination groupe B (météorite/point zéro) : le groupe B lit la
//   position LIVE de la faille kind==='great' dans AZ.rifts (publié :
//   [{pos, open, radius, kind}], pos = référence live) pour faire émerger
//   la météorite — l'alignement x/z avec le Point Zéro est donc exact.
// — Position = AZEvent.zeroPointPos live (publié chaque frame par
//   event-zeropoint.js : l'orbe, à centre + 25 m) + 150 m AU-DESSUS, pour
//   que la météorite en émerge dans le ciel ; repli = centre + y25 + 150.
// — Refermée à l'entrée de 'strike' (la descente se fait à ciel ouvert).
function openZeroRift() {
  if (entered.zeroOpen) return;
  entered.zeroOpen = true;
  var gr = findRift('great', 0);
  if (!gr) return;
  var zp = AZ.zeroPointPos || null;
  if (zp) gr.pos.set(zp.x, zp.y + 150, zp.z);
  else gr.pos.set(api.center.x, api.center.y + 175, api.center.z);
  gr.mesh.position.copy(gr.pos);
  gr.mesh.lookAt(0, gr.pos.y * 0.75, 0);
  // v23 : LA PLUS MASSIVE — échelle 3.2 (base 6.0 : rayon ~653 m, diamètre
  // 1,3 km — visible de partout sur l'île), ouverture LENTE et inexorable
  // (2.6 s), anticipation 1.8 s.
  openA(gr, 3.2, 0, 2.6, true, 1.8);
  gr.mat.uniforms.uDistort.value = 1.0;
  gr.mat.uniforms.uIntensity.value = 1.6;
  triggerCrack(gr.pos);
}

function attachHandlers() {
  if (handlersAttached) return;
  handlersAttached = true;

  // 'phase:<nom>' : chaque phase pilote sa chorégraphie (garde anti-doublon
  // dans onPhase — le détecteur d'état dans update() appelle le même).
  for (var pi = 0; pi < PHASE_NAMES.length; pi++) {
    (function (pname) {
      api.on('phase:' + pname, function () {
        if (!AZ.active) return;
        onPhase(pname);
      });
    })(PHASE_NAMES[pi]);
  }

  // Décollage : la faille géante ne s'ouvre PAS au décollage — elle
  // s'ouvre uniquement au PASSAGE réel de la fusée n°1 ('rift:cross'
  // kind 'launch', émis par event-rockets.js pendant la montée).
  // (v8 : l'ouverture anticipée masquait la fusée avant le décollage.)
  api.on('rocket:launch', function (data) {
    if (!AZ.active) return;
    if (data && data.parked) return; // fusée encore posée : rien à ouvrir
  });

  api.on('rift:cross', function (data) {
    if (!AZ.active) return;
    data = data || {};
    var kind = data.kind || 'zone';
    var sparkRift = null; // v17 : la faille traversée -> pluie d'étincelles au point de passage

    if (kind === 'launch') {
      // v10 : la fusée VIENT d'entrer dans la faille GÉANTE : elle s'ouvre
      // en GRAND devant elle (pop easeOutBack + flash) puis SE REFERME
      // derrière elle (fermeture auto après la traversée visuelle).
      var lr = findRift('launch', 0);
      if (lr) {
        if (data.pos) {
          lr.pos.set(data.pos.x, data.pos.y, data.pos.z);
          lr.mesh.position.copy(lr.pos);
          lr.mesh.lookAt(0, lr.pos.y * 0.75, 0);
        }
        open(lr, 2.4, 1.6, 0.8, true); // v23 : vraiment gigantesque (était 2.0), refermeture visible
        sparkRift = lr; // v17
      }
      entered.launchDone = true;
    }
    else if (kind === 'conv') {
      // Entrée dans la faille de convergence : pulsation lumineuse.
      var cr = findRift('conv', 0);
      if (cr) {
        cr.pulse = 1;
        if (!cr.open) open(cr, 1, 0, 1.5, true);
        sparkRift = cr; // v17
      }
    }
    else if (kind === 'strike') {
      // La fusée émerge de la faille très haute : elle se referme derrière.
      var sr = findRift('strike', 0);
      if (sr) {
        if (data.pos) {
          sr.pos.set(data.pos.x, data.pos.y, data.pos.z);
          sr.mesh.position.copy(sr.pos);
          sr.mesh.lookAt(0, sr.pos.y * 0.75, 0);
        }
        if (!sr.open) open(sr, 1, 0, 1.0, true);
        sr.holdT = 1.5; // fermeture automatique après la traversée
        sr.open = true; sr.oTgt = 1.0;
        sparkRift = sr; // v17
      }
      entered.strikeDone = true;
    }
    else if (kind === 'escape') {
      // Faille d'évasion : la fusée la traverse, elle se referme derrière.
      var idx = (typeof data.index === 'number') ? ((data.index % 6) + 6) % 6 : 0;
      var er = findRift('escape', idx);
      if (er) {
        if (data.pos) {
          er.pos.set(data.pos.x, data.pos.y, data.pos.z);
          er.mesh.position.copy(er.pos);
          er.mesh.lookAt(0, er.pos.y * 0.75, 0);
        }
        open(er, 1.6, 1.5, 0.8, true); // v23 : failles de fuite MASSIVES (était 1.35)
        sparkRift = er; // v17
      }
    }
    else if (kind === 'front' || kind === 'back') {
      // v10 (phases 5-6) : la n°1 entre dans la faille AVANT / ressort par
      // la faille ARRIÈRE — pulsation lumineuse + flash + crépitement.
      var fr = findRift(kind === 'front' ? 'great' : 'strike', 0);
      if (fr) {
        if (data.pos) {
          fr.pos.set(data.pos.x, data.pos.y, data.pos.z);
          fr.mesh.position.copy(fr.pos);
          fr.mesh.lookAt(0, fr.pos.y * 0.75, 0);
        }
        fr.pulse = 1;
        fr.flash = Math.max(fr.flash, 0.7);
        if (!fr.open) open(fr, 1, 0, 1.2, true);
        spawnArc(fr);
        sparkRift = fr; // v17
      }
    }
    else {
      // Passage par une faille de zone : pulsation + crépitement.
      var zi = (typeof data.index === 'number') ? ((data.index % 6) + 6) % 6 : 0;
      var zr = findRift('zone', zi);
      if (zr) {
        zr.pulse = 1;
        // Première traversée : les 6 failles s'activent SIMULTANÉMENT ;
        // ensuite simple réouverture si besoin (jamais après convergence).
        if (!entered.zonesOn && !entered.zonesClosed) activateZones();
        else if (entered.zonesOn && !zr.open) open(zr, 1, 0, 1.0, false);
        spawnArc(zr);
        sparkRift = zr; // v17
      }
    }

    // v17 — PLUIE D'ÉTINCELLES à chaque traversée (au point de passage) :
    // la faille « répond » à ce qui la traverse.
    // v21 — la gerbe TOURBILLONNE en plus de pleuvoir (sillage spiral).
    // v23 — la traversée SE VOIT : l'anneau de choc est réarmé (onde de
    // lumière à chaque passage) + rafale d'éclairs de bord + flash. Les
    // gerbes sont renforcées sur les géantes (densité réduite sur mobile
    // conservée dans les piscines).
    if (sparkRift) {
      sparkRift.shockT = 0;
      if (sparkRift.shock) { sparkRift.shock.visible = true; sparkRift.shock.scale.set(1, 1, 1); }
      spawnEdgeArc(sparkRift); spawnEdgeArc(sparkRift);
      if (sparkRift.base >= 5.0) spawnEdgeArc(sparkRift);
      sparkRift.flash = Math.max(sparkRift.flash, 0.8);
    }
    var cp = (data.pos && isFinite(data.pos.x)) ? data.pos :
             (sparkRift ? sparkRift.pos : null);
    if (cp) {
      var giantCross = !!(sparkRift && sparkRift.base >= 4.5);
      spawnSparkRain(cp, giantCross ? 34 : 22);
      spawnVortexSparks(cp, giantCross ? 26 : 16);
    }
  });

  // La météorite tombe dans la faille : TOUT se referme aussitôt
  // (repli : l'entrée en phase 'silence' referme aussi).
  // v17 — FLASH D'ENGLOUTISSEMENT : la météorite vient d'ENTRER dans la
  // faille avant (data = {pos, swallowed:true} émis par event-meteor.js) —
  // la faille la plus proche s'embrase, puis se referme DESSUS (implosion
  // = closeAll ci-dessous). On la voit disparaître DEDANS.
  api.on('meteor:gone', function (data) {
    if (!AZ.active) return;
    if (data && data.pos && !data.forced) {
      var bp = data.pos, best = null, bd = 1e12;
      for (var bi = 0; bi < rifts.length; bi++) {
        var br = rifts[bi];
        if (!br.open && br.oCur < 0.2) continue;
        var bdx = br.pos.x - bp.x, bdy = br.pos.y - bp.y, bdz = br.pos.z - bp.z;
        var bdd = bdx * bdx + bdy * bdy + bdz * bdz;
        if (bdd < bd) { bd = bdd; best = br; }
      }
      if (best) {
        best.flash = 3.5; // v23 : l'engloutissement embrase plus fort (était 3.0)
        best.pulse = 1.5;
        best.mat.uniforms.uDistort.value = 1.2; // l'espace se tord à l'engloutissement
        // v23 : ONDE DE CHOC à l'engloutissement — la faille « avale » la
        // météorite dans un sursaut de lumière (réarme l'anneau de choc).
        best.shockT = 0;
        if (best.shock) { best.shock.visible = true; best.shock.scale.set(1, 1, 1); }
        spawnArc(best); spawnArc(best); spawnArc(best);
        spawnSparkRain(best.pos, 26);
        triggerCrack(best.pos, true);
      }
    }
    closeAll();
    entered.allClosed = true;
    entered.zonesOn = false;
  });

  // v17 — la météorite RESSORT de la grande faille ('meteor:emerging' émis
  // par event-meteor.js) : ÉCLAIRS DE SORTIE — la faille s'embrase au moment
  // où la météorite en jaillit (aucune ambiguïté : sortir = sortir).
  // Robuste à l'ordre des écouteurs 'phase:greatrift' : la faille existe
  // dès init(), le flash persiste jusqu'à l'ouverture.
  api.on('meteor:emerging', function (data) {
    if (!AZ.active) return;
    var gr = findRift('great', 0);
    if (gr) {
      gr.flash = Math.max(gr.flash, 2.2);
      gr.pulse = Math.max(gr.pulse, 1.2);
      var ep = (data && data.pos && isFinite(data.pos.x)) ? data.pos : gr.pos;
      for (var ei = 0; ei < 5; ei++) spawnEdgeArc(gr);
      spawnSparkRain(ep, 20);
      triggerCrack(ep, true);
    }
  });
}

/* ---------------------------------------------------------------------------
 * init
 * ------------------------------------------------------------------------- */

function init(a) {
  api = a;
  T = a.T;
  if (!T) return;

  _v1 = new T.Vector3(); _v2 = new T.Vector3();

  // v48 : carré plus large que l'ancien disque — la gerbe de lumière déborde de la déchirure.
  GEO = new T.PlaneGeometry(RIFT_GEO_R * 2.6, RIFT_GEO_R * 2.6);
  crackTex = makeCrackTexture();
  RING_IN = new T.RingGeometry(19.5, 22.5, 64);
  RING_OUT = new T.RingGeometry(25.5, 28.5, 64);
  LIGHT_PLANE = new T.PlaneGeometry(66, 66);
  // v12 : pilier de lumière vertical (500 m) projeté à l'ouverture.
  PILLAR_GEO = new T.CylinderGeometry(10, 16, 500, 10, 1, true);
  lightTex = makeLightningTexture();
  glowTex = makeGlowTexture(); // v8 : halo de visibilité
  DEPTH_GEO = new T.PlaneGeometry(46, 46); // v23 : support de la « gorge »
  depthTex = makeDepthTexture(); // v23 : puits bleu nuit (profondeur)

  group = new T.Group();
  group.name = 'azevent-rifts';
  // Tout est construit même si la scène n'existe pas encore
  // (attachScene() l'ajoutera dès que possible dans update).

  // Indices 0-5 : 6 failles de zones en cercle (même cercle que event-rockets.js).
  // v23 : FAILLES MASSIVES — bases relevées (zones 2.0->2.8, launch 3.2->4.5,
  // conv 4.2->5.5, strike 3.5->4.5, great 4.5->6.0, escape 0.6->0.9).
  for (var i = 0; i < 6; i++) {
    var ang = ZONE_OFF + (i / 6) * Math.PI * 2;
    createRift(Math.cos(ang) * ZONE_R, ZONE_Y, Math.sin(ang) * ZONE_R, 'zone', 2.8); // v23 : 2.8 (visibles de loin)
  }
  // Indice 6 : faille géante du décollage (repositionnée à l'ouverture).
  createRift(0, 280, 0, 'launch', 4.5); // v23 : 4.5 (était 3.2)
  // v7 : indices 7/9 près de la NOUVELLE position figée de la météorite
  // (miroir de event-meteor.js : centre + (420, 800, 420)).
  // v17 : altitude figée 800 m (était 780).
  var fmx = api.center.x + 420, fmz = api.center.z + 420;
  // Indice 7 : faille GÉANTE de convergence (près de la météorite).
  createRift(fmx, 800, fmz, 'conv', 5.5); // v23 : 5.5 (était 4.2) — COLOSSALE
  // Indice 8 : faille géante de strike (très haut dans le ciel).
  createRift(0, STRIKE_Y, 0, 'strike', 4.5); // v23 : 4.5 (était 3.5)
  // Indice 9 : GRANDE faille devant la météorite (greatrift).
  createRift(fmx, 800, fmz, 'great', 6.0); // v23 : 6.0 (était 4.5) — COLOSSALE
  // Indices 10-15 : 6 petites failles d'évasion (veeroff).
  for (var e = 0; e < 6; e++) {
    var ae = ZONE_OFF + (e / 6) * Math.PI * 2;
    createRift(Math.cos(ae) * ZONE_R, 150, Math.sin(ae) * ZONE_R, 'escape', 0.9); // v23 : 0.9 (était 0.6)
  }

  // Fissure géante du ciel (plan déchiré lumineux, ouvertures majeures).
  var crackMat = new T.MeshBasicMaterial({
    map: crackTex, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
  });
  crackMesh = new T.Mesh(new T.PlaneGeometry(420, 140), crackMat);
  crackMesh.position.set(0, 280, 0);
  crackMesh.visible = false;
  group.add(crackMesh);

  attachHandlers();

  // Publication : [{pos, open, radius, kind}] pour event-rockets.js
  // (agents trajectoires : position + rayon + état d'ouverture).
  pub = [];
  for (var p = 0; p < rifts.length; p++) {
    pub.push({ pos: rifts[p].pos, open: rifts[p].open, radius: 0, kind: rifts[p].kind });
  }
  AZ.rifts = pub;

  // Ajout paresseux à la scène (peut ne pas exister encore à init).
  attachScene();
}

function attachScene() {
  if (scene || !group) return;
  scene = api.scene();
  if (scene) scene.add(group);
}

/* ---------------------------------------------------------------------------
 * Chorégraphie par ÉTAT DE PHASE — AUCUN temps absolu en dur.
 * onPhase(name) : actions uniques à l'entrée de chaque phase (garde
 *   anti-doublon via `entered` : bus 'phase:<nom>' ET détecteur d'état
 *   dans update() appellent le même point d'entrée).
 * choreography(t, state, tState) : suivi par frame ; les seuls délais sont
 *   relatifs à l'état courant (tState), jamais absolus.
 * ------------------------------------------------------------------------- */

function onPhase(state) {
  if (entered['ph_' + state]) return;
  entered['ph_' + state] = true;

  if (state === 'firstrocket') {
    // v8 : la faille géante ne s'ouvre PLUS avant le décollage
    // (elle masquait la fusée posée sur le pas de tir).
  }
  else if (state === 'sixrockets') {
    // La danse commence : la faille du décollage est refermée (sécurité) et
    // les 6 failles de zones sont actives.
    var lr = findRift('launch', 0);
    if (lr && lr.open && !entered.launchDone) close(lr);
    entered.launchDone = true;
    if (!entered.zonesOn) activateZones();
  }
  else if (state === 'convergence') {
    // La PREMIÈRE faille de l'arc céleste s'ouvre dans le ciel nocturne ;
    // les zones se referment (tout converge vers la météorite).
    for (var i = 0; i < 6; i++) close(findRift('zone', i));
    entered.zonesClosed = true;
    openConvRift();
  }
  else if (state === 'loop') {
    // v10 : la faille de convergence se referme (les fusées y sont entrées) ;
    // les failles AVANT et ARRIÈRE s'ouvrent près de la météorite pour la
    // boucle (faille arrière -> fusées -> météorite -> faille avant ->
    // disparition -> réapparition derrière). Les 6 zones se multiplient
    // en cascade en fond (choreography).
    close(findRift('conv', 0));
    entered.convOpen = false;
    openLoopRifts();
    entered.zonesClosed = false; // réarmement pour la multiplication
    entered.zonesOn = false;
  }
  else if (state === 'silence') {
    // Calme : TOUT est refermé, aucune faille orpheline
    // (repli : 'meteor:gone' l'a déjà fait sur le bus) —
    // SAUF la gigantesque faille (coordination groupe B, voir openZeroRift).
    closeAll();
    entered.allClosed = true;
    entered.zonesOn = false;
    entered.convOpen = false;
    openZeroRift();
  }
  else if (state === 'strike') {
    // La météorite a émergé de la faille du Point Zéro : on la referme
    // proprement derrière elle (la descente, phase strike, se fait à ciel
    // ouvert). Faille géante très haut dans le ciel : la fusée en émerge.
    var zr = findRift('great', 0);
    if (zr && zr.open) close(zr);
    entered.zeroOpen = false;
    openStrikeRift();
  }
  else if (state === 'thrown') {
    // Repli : si 'rift:cross' (strike) n'a pas refermé la faille, on la ferme.
    var sr = findRift('strike', 0);
    if (sr && sr.open && !entered.strikeDone) close(sr);
    entered.strikeDone = true;
  }
  else if (state === 'greatrift') {
    // GRANDE faille devant la météorite — la météorite en ressort.
    openGreatRift();
  }
  else if (state === 'descent') {
    // La grande faille s'efface ; les 6 zones persistent comme points de
    // convergence des lasers (réouverture en cascade, choreography).
    close(findRift('great', 0));
    entered.greatOpen = false;
    entered.zonesOn = false;
    entered.descentZones = false;
  }
  else if (state === 'impact') {
    // Impact : les failles se referment / sont absorbées. Aucune orpheline.
    closeAll();
    entered.allClosed = true;
    entered.zonesOn = false;
  }
  // acceleration : les failles restent ouvertes, cibles des fusées (rien à faire).
  // meteorsix : la grande faille reste ouverte pendant la descente (rien à faire).
  // veeroff : zones persistantes + failles d'évasion via le bus (rien à faire).
  // contraction/collapse/growth/destruction/playersucked/allgone/blackhole/
  // numbers/end : tout reste fermé (rien à faire).
}

function choreography(t, state, tState) {
  var i, z;
  if (state === 'loop') {
    // Multiplication en cascade : les 6 zones s'ouvrent une à une
    // (délais relatifs à l'entrée de phase uniquement).
    for (i = 0; i < 6; i++) {
      if (!entered['lz' + i] && tState >= 1.0 + i * 1.1) {
        entered['lz' + i] = true;
        z = findRift('zone', i);
        if (z) {
          openA(z, 1.2, 0, 1.6, i === 5, 0.8); // v23 : plus grandes (était 1) ; flash à la dernière : multiplication complète ; v21 : anticipation 0,8 s
          z.pulse = 1;
          z.mat.uniforms.uDistort.value = 0.45;
        }
      }
    }
  }
  else if (state === 'acceleration') {
    // v10 — PHASE 6 : la faille AVANT GRANDIT progressivement (cible des
    // fusées et de la météorite). Délai relatif à l'entrée de phase uniquement.
    // v17 : garde anti-spam — open() n'est ré-invoqué que si la croissance a
    // vraiment progressé (sinon les FX d'ouverture — anneau de choc, gerbe
    // de débris, arcs — se réarmaient À CHAQUE FRAME : inondation).
    // v23 : croissance DOUCE sans réarmer les FX d'ouverture à chaque pas —
    // la cible d'échelle suffit (la faille est déjà ouverte et stable), ce
    // qui évite ~65 gerbes de débris/éclairs sur la phase. Croissance
    // poussée à ×2.3 (la faille avant devient immense avant d'avaler la
    // météorite — rayon ~469 m).
    var gr = findRift('great', 0);
    if (gr && (gr.open || gr.oCur > 0.05)) {
      var gm = 1 + 1.3 * clamp01(tState / 56);
      if (Math.abs(gm - (gr._v17gm || 0)) > 0.02) {
        gr._v17gm = gm;
        gr.progScale = gr.base * gm;
        gr.sTgt = gr.progScale;
      }
      gr.mat.uniforms.uDistort.value = 0.7 + 0.3 * clamp01(tState / 56);
    }
  }
  else if (state === 'descent' || state === 'veeroff') {
    // Points de convergence des lasers : les 6 zones restent ouvertes
    // (réouverture en cascade à l'entrée de descent).
    if (state === 'descent') {
      for (i = 0; i < 6; i++) {
        if (!entered['dz' + i] && tState >= 0.6 + i * 0.9) {
          entered['dz' + i] = true;
          z = findRift('zone', i);
          if (z && !z.open) {
            openA(z, 1.2, 0, 1.4, false, 0.8); // v23 : plus grandes (était 1) ; v21 : anticipation 0,8 s
            z.pulse = 1;
            z.mat.uniforms.uDistort.value = 0.4;
          }
        }
      }
    }
  }
}

/* ---------------------------------------------------------------------------
 * update
 * ------------------------------------------------------------------------- */

function resetRun() {
  entered = {};
  closeAll();
  for (var i = 0; i < rifts.length; i++) {
    rifts[i].pulse = 0;
    rifts[i].flash = 0;
    rifts[i].progT = -1;
    rifts[i].starK = 1; // v10
    rifts[i].imploT = -1; // v12 : implosion
    rifts[i].holdPulseT = 0; // v17 : sursaut de tenue
    rifts[i]._v17gm = 0; // v17 : garde anti-spam de la croissance
    if (rifts[i].implo) rifts[i].implo.visible = false;
    if (rifts[i].implo2) rifts[i].implo2.visible = false; // v15
    if (rifts[i].implo3) rifts[i].implo3.visible = false; // v23
    rifts[i].implo3T = -1; // v23
    if (rifts[i].ripple) rifts[i].ripple.visible = false; // v15
    rifts[i].rippleT = -1; // v15
    rifts[i].collapseT = -1; // v15
    rifts[i].edgeT = Math.random() * 0.5; // v15
    rifts[i].suckT = -1; // v22 : flash de succion
    if (rifts[i].suckGlow) rifts[i].suckGlow.visible = false; // v22
    rifts[i].crackCd = 0; // v22 : cooldown de la déchirure géante
    rifts[i].mat.uniforms.uBoost.value = 0; // v15 : sur-distorsion
    if (rifts[i].pillarMat) rifts[i].pillarMat.opacity = 0;
    if (rifts[i].swirlMat) rifts[i].swirlMat.opacity = 0;
    rifts[i].mat.uniforms.uDistort.value = 0;
    rifts[i].mat.uniforms.uIntensity.value = rifts[i].iBase;
    if (rifts[i].ring1) rifts[i].ring1.material.opacity = 0;
    if (rifts[i].ring2) rifts[i].ring2.material.opacity = 0;
    if (rifts[i].light) rifts[i].light.material.opacity = 0;
    if (rifts[i].glowMat) rifts[i].glowMat.opacity = 0;
  }
  crackT = -1;
  if (crackMesh) crackMesh.visible = false;
  clearScars();  // v17 : les cicatrices appartiennent au run précédent
  clearSparks(); // v17 : les étincelles aussi
  clearVorts();  // v21 : les étincelles tourbillonnantes aussi
  clearAnticipTimers(); // v21 : aucune ouverture anticipée ne survit au reset
  lastState = '';
}

function update(dt, t) {
  if (!AZ.active || !group) return;      // inactif hors event
  attachScene();
  if (!scene) return;

  // Redémarrage : on réarme tout.
  if (t < lastT - 0.5) resetRun();
  lastT = t;

  var state = AZ.state;
  var tState = AZ.tState || 0;
  // La chorégraphie est pilotée par les ENTRÉES d'état (+ le bus 'phase:X'),
  // jamais par des temps absolus.
  if (state !== lastState) { onPhase(state); lastState = state; }

  choreography(t, state, tState);

  // Animation ouverture/fermeture + shader.
  for (var k = 0; k < rifts.length; k++) {
    var r = rifts[k];
    // Fermeture automatique après holdT.
    if (r.holdT > 0) {
      r.holdT -= dt;
      if (r.holdT <= 0) close(r);
    }
    // v22 : cooldown de la déchirure géante (anti-spam d'ouverture).
    if (r.crackCd > 0) r.crackCd -= dt;
    var sp = (!r.open && r.closeFast) ? 7 : 2.5; // v11 : implosion rapide à la fermeture
    if (r.progT >= 0) {
      // Apparition PROGRESSIVE : courbe d'ouverture (pas de lerp).
      r.progT += dt;
      var pk = clamp01(r.progT / Math.max(r.progDur, 0.001));
      var pe = pk * pk * (3 - 2 * pk);
      // v9 : "pop" à l'ouverture (easeOutBack sur l'échelle — léger dépassement).
      var c1 = 1.70158;
      var pb = 1 + (c1 + 1) * Math.pow(pk - 1, 3) + c1 * Math.pow(pk - 1, 2);
      r.sCur = Math.max(r.progScale * pb, 0.0001);
      r.oCur = pe;
      // v10 : le HALO PRÉCÈDE l'ouverture — la lueur apparaît d'abord,
      // l'étoile de verre ne commence qu'à ~18 % de l'ouverture.
      r.starK = clamp01((pk - 0.18) / 0.82);
      if (pk >= 1) {
        r.progT = -1;
        r.sCur = r.progScale;
        r.oCur = 1.0;
        r.starK = 1;
        if (r.flashAtEnd) { r.flash = 1; r.flashAtEnd = false; }
      }
      // v15 : sur-distorsion maximale au début de l'ouverture (l'espace se
      // déchire autour de la faille), qui retombe pendant la stabilisation.
      r.mat.uniforms.uBoost.value = 1.3 * (1 - pk) + 0.15;
      // v15 : éclairs qui LÈCHENT les bords pendant toute l'ouverture.
      r.edgeT -= dt;
      if (r.edgeT <= 0) { spawnEdgeArc(r); r.edgeT = 0.14 + Math.random() * 0.1; }
    } else {
      r.sCur += (r.sTgt - r.sCur) * Math.min(1, dt * sp);
      r.oCur += (r.oTgt - r.oCur) * Math.min(1, dt * sp);
      r.starK = 1;
      if (r.closeFast && Math.abs(r.sTgt - r.sCur) < 0.05) r.closeFast = false;
      // v15 : respiration de la distorsion sur les failles tenues
      // (l'espace autour « ondule » doucement).
      var bTgt = r.open ? (0.10 + 0.08 * Math.sin(t * 2.2 + k * 1.1)) : 0;
      var bCur = r.mat.uniforms.uBoost.value;
      r.mat.uniforms.uBoost.value = bCur + (bTgt - bCur) * Math.min(1, dt * 3);
      // v15 : éclairs de bord épisodiques sur les failles bien ouvertes.
      if (r.open && r.oCur > 0.7) {
        r.edgeT -= dt;
        if (r.edgeT <= 0) {
          spawnEdgeArc(r);
          r.edgeT = (r.base >= 3.2 ? 0.9 : 1.7) * (0.7 + Math.random() * 0.6);
        }
      }
    }
    // v15 : TORSION DE L'ESPACE pendant l'implosion — la sur-distorsion
    // explose puis s'éteint avec l'effondrement (remplace le lerp ci-dessus).
    if (r.collapseT >= 0) {
      r.collapseT += dt;
      r.mat.uniforms.uBoost.value = 1.7 * Math.exp(-6 * r.collapseT);
      if (r.collapseT > 0.9) r.collapseT = -1;
    }
    r.mesh.visible = r.oCur > 0.01;
    var sc = Math.max(r.sCur, 0.0001);
    // v15 : la faille tenue RESPIRE — gonflement lent et subtil.
    var br15 = (r.open && r.progT < 0) ? (1 + 0.035 * Math.sin(t * 1.6 + k * 2.3)) : 1;
    r.mesh.scale.set(sc * br15, sc * br15, 1);
    // v48 : une déchirure ne tourne pas ; elle tremble quand l'espace se tord.
    if (r.mesh.visible) {
      r.mat.uniforms.uAng.value += Math.sin(t * 9.0 + k * 1.7) * dt * 0.08 * (r.mat.uniforms.uDistort.value + r.mat.uniforms.uBoost.value);
    }
    r.mat.uniforms.uTime.value += dt;
    r.mat.uniforms.uOpacity.value = r.oCur * r.starK; // v10 : halo d'abord
    // Flash (ouverture) + pulsation : pic sur les passages, base quand ouverte.
    if (r.flash > 0) r.flash = Math.max(0, r.flash - dt * 1.8);
    // v11 : ANNEAU DE CHOC expansif après l'ouverture (0.7 s).
    if (r.shockT >= 0) {
      r.shockT += dt;
      var shk = r.shockT / 0.7;
      if (shk >= 1) { r.shockT = -1; if (r.shock) r.shock.visible = false; }
      else if (r.shock) {
        var shs = 1 + shk * (4.5 + r.base); // v23 : l'onde de choc grandit avec la faille
        r.shock.scale.set(shs, shs, 1);
        r.shockMat.opacity = (1 - shk) * 0.9;
      }
    }
    // v22 : SUCCION DE LA LUMIÈRE — à la fermeture, un flash blanc se
    // CONTRACTE vers le centre en 0.45 s (la faille « aspire » la lumière
    // au lieu de l'exploser — cause : la fermeture, effet : l'implosion).
    if (r.suckT >= 0) {
      r.suckT += dt;
      var suk = r.suckT / 0.45;
      if (suk >= 1) { r.suckT = -1; if (r.suckGlow) r.suckGlow.visible = false; }
      else if (r.suckGlow) {
        var sus = (3.5 + r.base * 0.35) * (1 - suk) + 0.3; // v23 : succion plus massive
        r.suckGlow.scale.set(sus, sus, 1);
        r.suckGlowMat.opacity = 0.9 * (1 - suk);
      }
    }
    // v23 : GORGE — le puits bleu nuit suit l'ouverture (profondeur) et
    // respire doucement avec l'étoile.
    if (r.throatMat) {
      r.throatMat.opacity = r.oCur * r.starK * 0.9;
      var ths = 1 + 0.03 * Math.sin(t * 1.9 + k * 2.7);
      r.throat.scale.set(ths, ths, 1);
    }
    // v12 : IMPLOSION — l'anneau se contracte violemment vers le centre
    // (0.55 s) pendant que la faille s'effondre sur elle-même.
    // v13 : DOUBLE implosion — la faille "avale" deux fois de suite
    // (seconde salve plus petite et plus rapide).
    // v15 : IMPLOSION BRUTALE — contraction TRÈS rapide (0.38 s), double
    // anneau (onde de choc inversée), gerbe aspirée à chaque salve.
    var IMLO_DUR = 0.38;
    if (r.imploT >= 0) {
      r.imploT += dt;
      var imk = r.imploT / IMLO_DUR;
      if (imk >= 1) {
        if (r.imploN > 1) {
          r.imploN--;
          r.imploT = 0;
          r.imploStart = 2.3;
          if (r.implo) { r.implo.visible = true; r.implo.scale.set(2.3, 2.3, 1); }
          if (r.implo2) { r.implo2.visible = true; r.implo2.scale.set(4.2, 4.2, 1); }
          r.flash = Math.max(r.flash, 1.2); // sursaut lumineux entre les salves
          spawnImploDebris(r.pos, 8); // v15 : la faille « avale » à chaque salve
          r.collapseT = 0; // v15 : l'espace se tord à chaque salve
        } else {
          r.imploT = -1;
          if (r.implo) r.implo.visible = false;
          if (r.implo2) r.implo2.visible = false; // v15
        }
      }
      else {
        if (r.implo) {
          var ims = (r.imploStart || 4.5) * (1 - imk) + 0.4;
          r.implo.scale.set(ims, ims, 1);
          r.imploMat.opacity = (1 - imk) * 0.95;
        }
        if (r.implo2) { // v15 : second anneau, plus large — l'onde inversée
          var ims2 = 7.5 * (1 - imk) + 0.6;
          r.implo2.scale.set(ims2, ims2, 1);
          r.implo2Mat.opacity = (1 - imk) * 0.7;
        }
      }
    }
    // v23 : TROISIÈME ANNEAU D'IMPLOSION — le plus large (10.5), contraction
    // retardée de 0.14 s sur 0.55 s : la fermeture « avale » en trois temps.
    if (r.implo3T > -1) {
      r.implo3T += dt;
      var imk3 = r.implo3T / 0.55;
      if (imk3 >= 1) {
        r.implo3T = -1;
        if (r.implo3) r.implo3.visible = false;
      } else if (imk3 >= 0 && r.implo3) {
        r.implo3.visible = true;
        var ims3 = 10.5 * (1 - imk3) + 0.8;
        r.implo3.scale.set(ims3, ims3, 1);
        r.implo3Mat.opacity = (1 - imk3) * 0.6;
      }
    }
    // v15 : RIDE D'ESPACE — anneau lent qui s'étend autour de la faille
    // à l'ouverture (1.1 s) : l'espace « ondule » autour d'elle.
    if (r.rippleT >= 0) {
      r.rippleT += dt;
      var rpk = r.rippleT / 1.1;
      if (rpk >= 1) { r.rippleT = -1; if (r.ripple) r.ripple.visible = false; }
      else if (r.ripple) {
        var rps = 1 + rpk * 5.5;
        r.ripple.scale.set(rps, rps, 1);
        r.rippleMat.opacity = (1 - rpk) * 0.55 * (0.7 + 0.3 * Math.sin(rpk * 25));
      }
    }
    // v12 : PILIER DE LUMIÈRE vertical — jaillit à l'ouverture, persiste
    // en tenue (scintillement), s'éteint avec la faille.
    // v15 : le pilier JAILLIT à l'ouverture (surge : plus large, plus
    // brillant), puis se stabilise en tenue.
    if (r.pillarMat) {
      var holdK = r.open ? 0.5 : 1.0;
      var pflick = 0.85 + 0.15 * Math.sin(t * 23 + k * 3.3);
      var pSurge = (r.shockT >= 0) ? (1.6 * (1 - r.shockT / 0.7)) : 0; // v15 : surge d'ouverture
      r.pillarMat.opacity = r.oCur * r.starK * holdK * pflick *
        (0.30 + 0.55 * Math.min(1, r.mat.uniforms.uPulse.value)) * (1 + pSurge);
      var pwid = (0.8 + 0.2 * Math.sin(t * 17 + k * 1.3)) * (1 + pSurge * 0.6);
      r.pillar.scale.set(pwid, 1, pwid);
    }
    // v12 : PARTICULES TOURBILLONNANTES sur le bord — la faille tenue
    // crépite en permanence (vitesse liée à la distorsion du shader).
    if (r.swirl && r.swirlData) {
      var swOn = r.oCur > 0.05 ? 1 : 0;
      if (swOn) {
        var sattr = r.swirl.geometry.getAttribute('position');
        var swSpin = 1 + r.mat.uniforms.uDistort.value * 2.5;
        var swA = r.mat.uniforms.uAng.value, swC = Math.cos(swA), swS = Math.sin(swA);
        var swHalf = RIFT_GEO_R * 1.3 * 0.64; // demi-longueur de la déchirure (repère local)
        for (var swi = 0; swi < r.swirlData.length; swi++) {
          var sdp = r.swirlData[swi];
          sdp.ph += dt * sdp.spd * swSpin;
          if (sdp.ph >= 1) { sdp.ph -= 1; sdp.u = (Math.random() * 2 - 1) * Math.random(); sdp.side = -sdp.side; }
          var lx = sdp.u * swHalf, ly = sdp.side * sdp.ph * sdp.reach * (1 - Math.abs(sdp.u) * 0.5);
          sattr.setXYZ(swi, swC * lx - swS * ly, swS * lx + swC * ly, sdp.zoff);
        }
        sattr.needsUpdate = true;
      }
      r.swirlMat.opacity = r.oCur * r.starK * 0.85 * swOn;
    }
    if (r.pulse > 0) r.pulse = Math.max(0, r.pulse - dt * 1.6);
    // v15 : pulsation RYTHMÉE (lub-dub) — la faille tenue « respire » en rythme.
    var basePulse = r.open ? (0.55 + 0.45 * heart15(t * 0.85 + k * 0.63)) : 0;
    r.mat.uniforms.uPulse.value = basePulse + r.pulse + r.flash * 1.5;
    r.mat.uniforms.uIntensity.value = r.iBase + r.pulse * 0.8 + r.flash * 2.2;
    // v23 : l'énergie interne tourbillonne plus fort aux pulsations, les
    // anneaux de déformation respirent lentement (zéro allocation).
    var pu23 = Math.min(1, r.mat.uniforms.uPulse.value);
    r.mat.uniforms.uSwirl.value = r.oCur * (0.35 + 0.65 * pu23);
    r.mat.uniforms.uWarp.value = r.oCur * (0.55 + 0.45 * Math.sin(t * 1.3 + k * 1.9));

    // Halo contrarotatif + contour de foudre + scintillement.
    var spin = 1.2 + r.mat.uniforms.uDistort.value * 3.0;
    r.ring1.rotation.z += dt * spin;
    r.ring2.rotation.z -= dt * spin * 0.7;
    r.light.rotation.z += dt * spin * 0.35;
    var halo = 1.0 + 0.07 * Math.sin(t * 6.0 + k * 2.1) *
               (0.5 + r.mat.uniforms.uPulse.value);
    r.ring2.scale.set(halo, halo, 1);
    r.ring1.material.opacity = r.oCur * r.starK * 0.85;
    r.ring2.material.opacity = r.oCur * r.starK * 0.65;
    r.light.material.opacity = r.oCur * r.starK *
      (0.55 + 0.45 * Math.min(1, r.mat.uniforms.uPulse.value));
    // v8 : halo de visibilité à distance (suit l'ouverture).
    if (r.glowMat) {
      r.glowMat.opacity = r.oCur *
        (0.55 + 0.45 * Math.min(1, r.mat.uniforms.uPulse.value));
      var gs = 1 + 0.06 * Math.sin(t * 4.0 + k * 1.7);
      r.glow.scale.set(3.2 * gs, 3.2 * gs, 1);
    }

    // Crépitements électriques sur les failles bien ouvertes.
    // v12 : décharges renforcées — plus fréquentes, doublées sur les géantes.
    if (r.open && r.oCur > 0.6) {
      r.arcT -= dt;
      if (r.arcT <= 0) {
        r.arcT = 0.18 + Math.random() * (api.quality === 'low' ? 0.7 : 0.32);
        spawnArc(r);
        if (r.base >= 3.2 || Math.random() < 0.4) spawnArc(r);
      }
    }
    // v17 — SURSAUT DE TENUE : les failles GÉANTES tenues « respirent » fort —
    // vague de pulsation + éclairs de bord toutes les ~3,5 s (vivantes, pas statiques).
    // v22 — SURSAUT D'ÉNERGIE : en plus, l'espace se TORD (sur-distorsion) et
    // une gerbe d'étincelles fuse hors de la faille (la faille « crache »
    // l'énergie qu'elle contient — cause : le sursaut, effet : la gerbe).
    if (r.open && r.progT < 0 && r.base >= 3.2) {
      r.holdPulseT = (r.holdPulseT || 0) + dt;
      if (r.holdPulseT > 3.5) {
        r.holdPulseT = 0;
        r.pulse = Math.max(r.pulse, 1.1);
        r.flash = Math.max(r.flash, 0.5);
        spawnEdgeArc(r); spawnEdgeArc(r);
        r.mat.uniforms.uBoost.value = Math.max(r.mat.uniforms.uBoost.value, 1.1);
        try {
          var fxs22 = (root.AZEvent && root.AZEvent.fx) || null;
          if (fxs22 && fxs22.sparkJet) {
            var q22 = (api && (api.quality === 'low' || api.isMobile)) ? 0.45 : 1;
            fxs22.sparkJet(r.pos, { count: Math.round(20 * q22),
              dir: { x: 0, y: 0.4, z: 0 }, spread: 1.4, speed: 110,
              color: 0xcfe8ff, size: 6, life: 0.9, gravity: 30 });
          }
        } catch (e22) { /* jamais bloquant */ }
      }
    }
  }

  // Fissure géante : apparition / disparition en 3 s.
  if (crackT >= 0) {
    crackT += dt;
    var p = crackT / CRACK_DUR;
    if (p >= 1) { crackT = -1; crackMesh.visible = false; }
    else {
      var a = Math.sin(p * Math.PI);
      var grow = 0.3 + 0.7 * Math.min(1, p * 3);
      crackMesh.scale.set(grow, grow, 1);
      crackMesh.material.opacity = a;
    }
  }

  // Débris de verre : chute + rotation + évanouissement.
  for (var d = debris.length - 1; d >= 0; d--) {
    var db = debris[d];
    db.life -= dt;
    db.mesh.position.addScaledVector(db.vel, dt);
    db.mesh.rotation.x += db.rx * dt;
    db.mesh.rotation.z += db.rz * dt;
    if (db.life < 1) db.mesh.material.opacity = Math.max(0, db.life);
    if (db.life <= 0 || db.mesh.position.y < -10) {
      group.remove(db.mesh);
      db.mesh.material.dispose();
      debris.splice(d, 1);
    }
  }

  // Arcs : scintillement puis disparition.
  for (var q = arcs.length - 1; q >= 0; q--) {
    var ar = arcs[q];
    ar.life -= dt;
    ar.line.material.opacity = Math.max(0, ar.life / ar.maxLife);
    if (ar.life <= 0) {
      group.remove(ar.line);
      ar.line.geometry.dispose(); ar.line.material.dispose();
      arcs.splice(q, 1);
    }
  }

  updateScars(dt);  // v17 : les cicatrices lumineuses s'estompent lentement
  updateSparks(dt); // v17 : la pluie d'étincelles retombe et s'éteint
  updateVorts(dt);  // v21 : les étincelles tourbillonnantes spiralent puis meurent
  updateShimmer(dt, t); // v20 : halo de distorsion sur la plus grande faille ouverte

  // Publication : [{pos, open, radius, kind}] à jour chaque frame.
  for (var u = 0; u < rifts.length && u < pub.length; u++) {
    pub[u].open = rifts[u].open;
    pub[u].radius = RIFT_GEO_R * rifts[u].sCur; // rayon visuel courant (m)
  }
}

/* ---------------------------------------------------------------------------
 * Nettoyage : TOUT est libéré.
 * ------------------------------------------------------------------------- */

function dispose() {
  if (scene && group) scene.remove(group);

  for (var i = 0; i < rifts.length; i++) {
    var r = rifts[i];
    if (group) group.remove(r.mesh);
    r.mat.dispose();
    if (r.ring1) r.ring1.material.dispose();
    if (r.ring2) r.ring2.material.dispose();
    if (r.light) r.light.material.dispose();
    if (r.shock) r.shock.material.dispose(); // v11 : anneau de choc
    if (r.pillar) r.pillarMat.dispose();     // v12 : pilier de lumière
    if (r.implo) r.imploMat.dispose();       // v12 : anneau d'implosion
    if (r.implo2) r.implo2Mat.dispose();       // v15 : 2e anneau d'implosion
    if (r.implo3) r.implo3Mat.dispose();       // v23 : 3e anneau d'implosion
    if (r.throat) r.throatMat.dispose();       // v23 : gorge (profondeur)
    if (r.ripple) r.rippleMat.dispose();       // v15 : anneau d'ondulation
    if (r.suckGlow) r.suckGlowMat.dispose();  // v22 : flash de succion
    if (r.swirl) { r.swirl.geometry.dispose(); r.swirlMat.dispose(); } // v12
  }
  rifts = [];
  pub = [];
  if (AZ) AZ.rifts = [];

  if (crackMesh) {
    if (group) group.remove(crackMesh);
    crackMesh.geometry.dispose();
    crackMesh.material.dispose();
    crackMesh = null;
  }
  crackT = -1;

  for (var d = 0; d < debris.length; d++) {
    if (group) group.remove(debris[d].mesh);
    debris[d].mesh.material.dispose();
  }
  debris = [];

  for (var q = 0; q < arcs.length; q++) {
    if (group) group.remove(arcs[q].line);
    arcs[q].line.geometry.dispose(); arcs[q].line.material.dispose();
  }
  arcs = [];

  clearScars();  // v17 : cicatrices lumineuses rémanentes
  clearSparks(); // v17 : pluie d'étincelles
  clearVorts();  // v21 : étincelles tourbillonnantes
  clearAnticipTimers(); // v21 : minuteurs d'ouvertures anticipées
  if (VORT_GEO) { VORT_GEO.dispose(); VORT_GEO = null; } // v21
  clearShimmer(); // v20 : halo de distorsion du ciel
  if (SPARK_GEO) { SPARK_GEO.dispose(); SPARK_GEO = null; } // v17

  if (GEO) { GEO.dispose(); GEO = null; }
  if (DEPTH_GEO) { DEPTH_GEO.dispose(); DEPTH_GEO = null; } // v23
  if (depthTex) { depthTex.dispose(); depthTex = null; } // v23
  if (crackTex) { crackTex.dispose(); crackTex = null; }
  if (RING_IN) { RING_IN.dispose(); RING_IN = null; }
  if (RING_OUT) { RING_OUT.dispose(); RING_OUT = null; }
  if (LIGHT_PLANE) { LIGHT_PLANE.dispose(); LIGHT_PLANE = null; }
  if (PILLAR_GEO) { PILLAR_GEO.dispose(); PILLAR_GEO = null; } // v12
  if (lightTex) { lightTex.dispose(); lightTex = null; }
  if (glowTex) { glowTex.dispose(); glowTex = null; }
  if (group) { group.clear(); group = null; }

  entered = {};
  lastState = '';
  lastT = -1;
  // NOTE : handlersAttached n'est PAS réinitialisé ici. Le bus ne purge PAS
  // ses écouteurs au stop() (pas de off()) ; le remettre à false ferait
  // re-brancher les écouteurs à chaque init() — des doublons au redémarrage
  // (doubles ouvertures, doubles arcs, doubles pulsations). De plus, onPhase
  // est protégé par la garde `entered`, donc un double déclenchement
  // bus + détecteur d'état est sans effet.
  T = null; api = null; scene = null;
  _v1 = _v2 = null;
}

AZ.register('rift', { init: init, update: update, dispose: dispose });

})(window);
