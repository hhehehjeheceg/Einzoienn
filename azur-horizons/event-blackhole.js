/* event-blackhole.js — MODULE "THE END" : LE TROU NOIR (AZUR Horizons v10).
 * v12 (passe animation globale) :
 *  - formation : ANTICIPATION (resserrement bref avant l'explosion) +
 *    anneau de choc en snap ease-out + extinction quadratique ;
 *  - nombres : naissance franche (anticipation + overshoot qui se pose),
 *    pulsation de tenue plus marquée ;
 *  - 'anchor:set' {name:'blackhole'} et la sobriété des phases 21-22/'end'
 *    sont intacts (aucune animation après le noir final).
 * v15 (passe "animation maximale", timeline intacte) :
 *  - aspiration VISUELLEMENT VIOLENTE : 2e système de spirales rapides et
 *    denses qui ne s'active qu'en phases d'aspiration (vigor élevé) ;
 *  - disque d'accrétion qui S'EMBRASE (uIgnite : blanc incandescent) à
 *    chaque temps de destruction ;
 *  - distorsion gravitationnelle : arcs de la lentille animés dans le
 *    temps + 2e lentille large en contre-rotation ;
 *  - CRESCENDO des 7 temps : la force vient du bus 'shockwave' — chaque
 *    temps frappe plus fort (overshoot, sursaut du disque, flash d'écran,
 *    onde de choc réémise, secousse autour de l'ancrage) ;
 *  - nombres : pop BRUTAL (overshoot + flash + secousse), plus intense à
 *    chaque chiffre ; sobriété de 'blackhole'/'end' intacte.
 * v10 : passe "animations maximales" (fidélité intacte) :
 *  - formation (collapse) : ease-out rapide + micro-pulsation amortie à
 *    l'arrivée, flash blanc bref qui masque le relais avec l'effondrement
 *    du Point Zéro (même position exacte, aucune image intermédiaire) ;
 *  - disque d'accrétion à DEUX couches tournant à des vitesses différentes
 *    (interne rapide / externe lente en contre-rotation) + particules
 *    spirales qui plongent + respiration lente ;
 *  - croissance (growth) : ease-out jusqu'à 2.6 avec pulsations qui
 *    s'apaisent (continuité exacte avec la phase 'blackhole') ;
 *  - nombres (numbers) : fondu in/out + légère pulsation pendant la tenue,
 *    strictement un par un, timing vérifié (9 × 0,62 s ≈ 5,6 s < 6 s) ;
 *  - phases 21-22 : sobriété absolue, lenteur maîtrisée, trou noir seul.
 * v8 : onde de choc à la formation, taille finale plus imposante (2.6),
 * disque plus vif, respiration lente en phase 'blackhole'.
 * Timeline v5 (séquence finale) :
 *  - contraction [281,286] : PAS de trou noir. L'énergie se contracte vers
 *    le Point Zéro (géré par event-suction.js). Ce module reste inactif.
 *  - collapse    [286,290] : sur 'blackhole:formed' (émis par
 *    event-zeropoint.js), le trou noir se forme : FLASH BLANC bref, il
 *    apparaît PETIT puis GROSSIT RAPIDEMENT à sa taille finale (~2,4 s),
 *    disque d'accrétion bleu en rotation visible immédiatement, halo
 *    subtil, l'écran s'assombrit.
 *    (Repli : formation dès l'état 'collapse' si le signal n'arrive pas —
 *    sans jamais ré-émettre 'blackhole:formed'.)
 *  - growth      [290,294] : il GRANDIT et absorbe la matière autour
 *    (matière qui tourne autour). Progression RELATIVE au temps écoulé
 *    DANS la phase (aucun temps absolu).
 *  - destruction -> allgone [294,312] : il continue d'aspirer toute la matière.
 *  - blackhole   [312,322] : ON COUPE TOUTE L'ACTION — uniquement le trou
 *    noir : centre noir ABSOLU, matière BLEUE lumineuse qui tourne
 *    LENTEMENT, caméra stable, SILENCE. Aucune explosion, aucun
 *    personnage, aucun combat, aucun lieu, aucun nombre.
 *  - numbers     [322,328] : des NOMBRES apparaissent UN PAR UN autour du
 *    trou noir (sprites canvas, chiffres blancs/bleus), restent brièvement
 *    puis disparaissent — message codé, JAMAIS expliqué. 9 nombres en 6 s.
 *  - end         [328,infini] : ÉCRAN TOTALEMENT NOIR + minuscule point bleu
 *    lumineux au centre — RIEN d'autre. Le trou noir détaillé est masqué ;
 *    seul un minuscule point DOM reste affiché, centré. RIEN APRÈS.
 * INTERDIT : tourbillons violets, teintes mauves (bleu/blanc uniquement).
 * v22 (passe « frissons ») : le disque s'EMBRASE EN PIC à chaque battement
 * (igniteFlash) + anneau bleu sobre par battement d'aspiration, 3e anneau
 * d'aspiration de la lumière (plus marqués, partent de plus loin), la
 * lumière est aspirée DÈS LA FORMATION, chaque nombre fait PULSER le trou
 * (mini anneau bleu + pic d'embrasement), transition « avalé par le noir »
 * accélérée et sans couture (implosion ease-in sur 2,2 s, tourbillon qui
 * s'emballe, convergence qui s'intensifie). Finale 'end' INTANGIBLE
 * (écran noir + minuscule point bleu, RIEN d'autre).
 * Contrat : root.AZEvent.register('blackhole', {init, update, dispose}).
 */
(function (root) {
'use strict';

if (!root.AZEvent) return;

// ---------------------------------------------------------------- constantes
var FORM_DURATION = 2.4;     // durée de la formation (s) — petit → taille finale
var FLASH_FADE_MS = 600;     // durée du flash blanc bref à l'effondrement
var HOLE_Y = 25;             // hauteur du trou noir au-dessus du sol du centre
var GROWTH_SPAN = 4;         // durée RELATIVE de la phase growth (progression =
                             // temps écoulé DANS la phase / GROWTH_SPAN : aucun temps absolu)
var PLUNGE_COUNT = 300;      // particules du disque (contrainte : < 500 / système)
var PLUNGE_R_IN = 11;        // rayon intérieur des particules (juste hors du disque interne)
var PLUNGE_R_OUT = 42;       // rayon extérieur des particules
// Séquence authentique de l'event original (décodée par la communauté en
// "I was not alone. Others were outside the loop...") — jamais expliquée ici.
// https://fortnite.fandom.com/wiki/The_End_(Chapter_1) : ordre historique, cadence condensée pour cette recréation.
var NUMBERS = [11, 146, 15, 62, 87, 14, 106, 2, 150, 69, 146, 15, 36, 2, 176, 8, 160, 65];
var NUM_FADE = 0.10;
var NUM_CYCLE = 0.54;
function numberInterval() {
  var bounds = root.AZEvent.TIMELINE.numbers;
  return (bounds[1] - bounds[0] - 0.7) / NUMBERS.length;
}

// ---------------------------------------------------------------- état local
var api = null;
var T = null;
var group = null;        // racine du trou noir
var core = null;         // centre noir ABSOLU
var disk = null;         // disque d'accrétion bleu/blanc tourbillonnant (couche interne)
var diskMat = null;
var disk2 = null;        // v10 : seconde couche du disque (anneau externe,
                         // contre-rotation lente — vitesses différenciées)
var disk2Mat = null;
var halo = null;         // lueur bleue diffuse autour
var haloMat = null;
var formed = false;      // formation terminée ?
var forming = false;     // formation en cours ?
var formT = 0;           // progression de la formation
var dimDiv = null;       // voile d'assombrissement de l'écran (collapse)
var numIdx = 0;          // prochain nombre à afficher
var numTimer = 0;        // chrono avant le prochain nombre
var numSprites = [];     // {sprite, life} — sprites de nombres actifs
var numCache = {};       // CanvasTexture par nombre (créées une seule fois)
var anchorSet = false;   // 'anchor:set' publié pour la caméra ?
var busBound = false;    // écouteurs du bus branchés une seule fois (pas de off())
var ring = null;         // anneau d'Einstein (fin anneau lumineux au bord de l'ombre)
var ringMat = null;
var lens = null;         // halo de lentille gravitationnelle (arcs de lumière courbés)
var lensMat = null;
var plunge = null;       // ~300 particules bleues qui plongent vers le trou noir
var plungeMat = null;
var plungeData = null;   // [angle, rayon, vitesse orbitale, vitesse de chute] / particule
var growthT = 0;         // temps écoulé DANS la phase growth (relatif, pas absolu)
var shock = null;        // v8 : anneau d'onde de choc (formation)
var shockMat = null;
var beatPunch = 0;       // v13 : 1 juste après un temps de destruction, décroît
var suckPunch = 0;       // v20 : 1 juste après un battement d'aspiration (suction:beat), décroît
// v15 — passe "animation maximale" : crescendo des temps, disque qui
// s'embrase, aspiration violente, secousses.
var beatForce = 0.5;     // force du dernier temps (bus 'shockwave' : 0.32 -> 0.7)
var beatNum = 0;         // compteur de temps de destruction
var shakeT = 0;          // secousse restante (s) — le trou tremble sur son ancrage
var basePos = null;      // position d'ancrage (clone à la construction)
var beatShockT = -1;     // onde de choc réémise d'un temps (-1 = inactive)
var beatShockF = 0;      // force de l'onde de choc en cours
var beatFlashDiv = null; // flash DOM par temps de destruction (bref, auto-retiré)
var plungeFast = null;   // spirales RAPIDES et DENSES (aspiration violente)
var plungeFastMat = null;
var plungeFastData = null;
var lens2 = null;        // 2e lentille gravitationnelle (anneau large, contre-rotation)
var lens2Mat = null;
var lowQ = false;        // mobile : particules allégées, pas de 2e systèmes
var numShakeT = 0;       // secousse restante d'un nombre qui claque
var igniteTarget = 0;    // cible d'embrasement du disque (uIgnite)
// v21 : ASPIRATION VISUELLE DE LA LUMIÈRE — 2 anneaux lumineux qui
// convergent en continu vers le cœur (la lumière elle-même est aspirée :
// le climax cosmique se LIT). 2 meshes, zéro allocation par frame.
var inRing1 = null, inRing1Mat = null;
var inRing2 = null, inRing2Mat = null;
var inRingT1 = 0, inRingT2 = 0;
var inRing3 = null, inRing3Mat = null; // v22 : 3e anneau d'aspiration de la lumière
var inRingT3 = 0;                       // v22
var igniteFlash = 0;                    // v22 : pic d'embrasement bref (battements)
var numBeat = 0;         // v21 : 1 juste après un nombre affiché, décroît (le disque répond)
var breathT = 0;         // v21 : minuteur du « souffle » du trou noir (phase blackhole)

// ---------------------------------------------------------------- point final
// 'end' : l'écran est TOTALEMENT NOIR, avec juste un minuscule point bleu
// lumineux au centre — RIEN d'autre. Le trou noir détaillé est masqué ;
// le point est un overlay DOM fixe, toujours centré. Pas de post-traitement.
var endDot = null;       // div du minuscule point bleu (phase 'end' uniquement)
var endBackdrop = null;
var endMinified = false; // bascule 'end' déjà effectuée (une seule fois)

function showEndDot() {
  if (typeof document === 'undefined') return;
  if (!endBackdrop) {
    endBackdrop = document.createElement('div');
    endBackdrop.id = 'azevent-final-black';
    endBackdrop.setAttribute('aria-hidden', 'true');
    endBackdrop.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:2147483100;';
    document.body.appendChild(endBackdrop);
  }
  endBackdrop.style.display = 'block';
  if (!endDot) {
    endDot = document.createElement('div');
    endDot.id = 'azevent-blackhole-enddot';
    // Minuscule point bleu lumineux : cœur blanc-bleu, halo bleu discret.
    endDot.style.cssText =
      'position:fixed;left:50%;top:50%;width:11px;height:11px;' +
      'transform:translate(-50%,-50%);border-radius:50%;' +
      'pointer-events:none;z-index:2147483101;' +
      'background:radial-gradient(circle, #ffffff 0%, #cfe6ff 32%,' +
      ' #6faeff 62%, rgba(90,150,255,0) 100%);' +
      'box-shadow:0 0 16px 5px rgba(130,185,255,0.55),' +
      ' 0 0 42px 12px rgba(90,150,255,0.22);';
    document.body.appendChild(endDot);
  }
  endDot.style.display = 'block';
}

function hideEndDot() {
  if (endDot) endDot.style.display = 'none';
  if (endBackdrop) endBackdrop.style.display = 'none';
}

function removeEndDot() {
  if (endDot && endDot.parentNode) endDot.parentNode.removeChild(endDot);
  if (endBackdrop && endBackdrop.parentNode) endBackdrop.parentNode.removeChild(endBackdrop);
  endDot = endBackdrop = null;
  endMinified = false;
}

// ---------------------------------------------------------------- textures
// Halo radial bleu pâle (canvas, aucun réseau).
function makeHaloTexture() {
  var c = document.createElement('canvas');
  c.width = c.height = 256;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(170,205,255,0.6)');
  grad.addColorStop(0.4, 'rgba(120,165,255,0.28)');
  grad.addColorStop(0.75, 'rgba(90,135,255,0.10)');
  grad.addColorStop(1.0, 'rgba(80,120,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new T.CanvasTexture(c);
}

// Texture d'un nombre : chiffres blancs/bleus lumineux sur fond transparent.
function numberTexture(n) {
  if (numCache[n]) return numCache[n];
  var c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  var g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.font = '600 76px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(160,210,255,0.95)';
  g.shadowBlur = 22;
  g.fillStyle = '#eef6ff';
  g.fillText(String(n), 128, 66);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.fillText(String(n), 128, 66);
  var tex = new T.CanvasTexture(c);
  numCache[n] = tex;
  return tex;
}

// ---------------------------------------------------------------- construction
function build() {
  var scene = api.scene();
  if (!scene) return;
  disposeGroup();

  group = new T.Group();
  group.name = 'azevent-blackhole';
  var c = api.center;
  if (root.AZEvent.zeroPointPos) group.position.copy(root.AZEvent.zeroPointPos);
  else group.position.set(c.x, c.y + HOLE_Y, c.z);
  basePos = group.position.clone(); // v15 : la secousse oscille autour de l'ancrage

  // --- Centre noir ABSOLU : insensible à la lumière et au brouillard ---
  core = new T.Mesh(
    new T.SphereGeometry(8, 32, 24),
    new T.MeshBasicMaterial({ color: 0x000000, fog: false, transparent: true, opacity: 1, depthWrite: true })
  );
  core.material.depthTest = true; // Les bâtiments passent devant l’horizon avant d’être engloutis.
  core.renderOrder = 1000;
  group.add(core);

  // --- Disque d'accrétion : anneau bleu/blanc en spirale, additif ---
  diskMat = new T.ShaderMaterial({
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    side: T.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uIgnite: { value: 0 } // v15 : embrasement du disque (0 = normal, 1 = blanc incandescent)
    },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform float uAlpha;',
      'uniform float uIgnite;', // v15
      'void main() {',
      '  vec2 p = vUv - 0.5;',
      '  float r = length(p) * 2.0;',
      '  float a = atan(p.y, p.x);',
      '  float rn = clamp((r - 0.3846) / (1.0 - 0.3846), 0.0, 1.0);',
      '  float turbulence = sin(a*11.0 + rn*38.0 - uTime*2.0)*0.18 + sin(a*23.0-rn*71.0+uTime*1.3)*0.08;',
      '  float shear = a + 2.4 / (0.28 + rn) - uTime * (0.65 + 0.7 / (0.4 + rn));',
      '  float filaments = pow(max(0.0, sin(shear*7.0 + turbulence*3.0)), 6.0);',
      '  float threads = pow(max(0.0, sin(rn*133.0+a*3.0-uTime*2.0)), 14.0);',
      '  float lanes = 0.55 + 0.45 * sin(rn*41.0+a*2.0+uTime);',
      '  float bright = 0.16 + filaments * 0.56 + threads * lanes * 0.28;',
      '  float beaming = 0.52 + 0.48 * pow(0.5 + 0.5 * cos(a-0.65), 2.0);',
      '  float knots = pow(max(0.0, sin(shear*13.0+rn*87.0)),22.0);',
      '  float photon = exp(-abs(rn-.065)*80.0);',
      // v48 : plasma turbulent (bruit de valeur 2 octaves) entraîné par le cisaillement.
      '  vec2 q = vec2(cos(shear), sin(shear)) * (1.5 + rn * 3.0) + vec2(uTime * .07, rn * 5.0);',
      '  vec2 qi = floor(q), qf = fract(q); qf = qf*qf*(3.0-2.0*qf);',
      '  float h00 = fract(sin(dot(qi, vec2(127.1,311.7)))*43758.5), h10 = fract(sin(dot(qi+vec2(1.,0.), vec2(127.1,311.7)))*43758.5);',
      '  float h01 = fract(sin(dot(qi+vec2(0.,1.), vec2(127.1,311.7)))*43758.5), h11 = fract(sin(dot(qi+vec2(1.,1.), vec2(127.1,311.7)))*43758.5);',
      '  float plasma = mix(mix(h00,h10,qf.x), mix(h01,h11,qf.x), qf.y);',
      '  bright = (bright * (.62 + plasma * .9) + knots*.16 + photon*.3) * beaming * (1.0 + uIgnite * 0.8);',
      '  float edge = smoothstep(0.0, 0.09, rn) * (1.0 - smoothstep(0.68, 1.0, rn));',
      '  vec3 deep = vec3(0.035, 0.17, 0.46);',
      '  vec3 mid = vec3(0.33, 0.7, 1.0);',
      '  vec3 col = mix(deep, mid, filaments*.75+threads*.25+plasma*.2);',
      '  col = mix(col, vec3(0.86,0.95,1.0), (1.0-smoothstep(0.0,0.3,rn))*.7+uIgnite*.3);',
      '  col += vec3(.55,.75,1.0) * pow(1.0 - rn, 7.0) * .45;',
      '  gl_FragColor = vec4(col * (0.65+bright), edge * uAlpha * (0.24+bright*.76));',
      '}'
    ].join('\n')
  });
  disk = new T.Mesh(new T.RingGeometry(10, 26, 96, 1), diskMat);
  disk.renderOrder = 999;
  disk.rotation.x = 0.82;
  diskMat.depthTest = true;
  group.add(disk);

  // --- v10 : seconde couche du disque — anneau externe bleu pâle, bras
  // spiraux plus larges, CONTRE-ROTATION lente par rapport à la couche
  // interne (mouvement différencié, profondeur du tourbillon).
  disk2Mat = new T.ShaderMaterial({
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    side: T.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uIgnite: { value: 0 } // v15 : embrasement (suit la couche interne)
    },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform float uAlpha;',
      'uniform float uIgnite;', // v15
      'void main() {',
      '  vec2 p = vUv - 0.5;',
      '  float r = length(p) * 2.0;',
      '  float a = atan(p.y, p.x);',
      '  float rn = clamp((r - 0.44) / (1.0 - 0.44), 0.0, 1.0);',
      // deux bras larges qui dérivent lentement (sens inverse de disk)
      '  float sp = sin(a * 2.0 - rn * 9.0 + uTime * 0.55);',
      '  float sp2 = sin(a * 4.0 + rn * 5.0 - uTime * 0.32);',
      '  float bright = 0.45 + 0.55 * (sp * 0.65 + sp2 * 0.35);',
      '  bright *= 0.9 + 0.1 * sin(uTime * 1.7 + rn * 18.0);',
      '  bright *= 1.0 + uIgnite * 1.4;', // v15 : la couche externe s'embrase aussi
      '  float edge = smoothstep(0.0, 0.22, rn) * (1.0 - smoothstep(0.60, 1.0, rn));',
      '  vec3 deep = vec3(0.16, 0.38, 1.00);',
      '  vec3 mid  = vec3(0.55, 0.78, 1.0);',
      '  vec3 col = mix(deep, mid, bright);',
      '  col = mix(col, vec3(1.0), uIgnite * 0.6);', // v15
      '  gl_FragColor = vec4(col * bright, edge * uAlpha * 0.75);',
      '}'
    ].join('\n')
  });
  disk2 = new T.Mesh(new T.RingGeometry(24, 44, 96, 1), disk2Mat);
  disk2.renderOrder = 996;
  disk2.rotation.x = 0.56;
  group.add(disk2);

  // --- Anneau d'Einstein : fin anneau lumineux collé au bord de l'ombre ---
  // v48 : anneau de photons en shader (fin cœur brûlant + halo vers
  // l'extérieur + côté Doppler plus vif) au lieu d'un donut blanc uni.
  // `ringMat.opacity` reste le seul paramètre piloté par update().
  ringMat = new T.ShaderMaterial({
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false,
    fog: false, side: T.DoubleSide,
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: [
      'varying vec2 vUv;uniform float uAlpha;uniform float uTime;',
      'void main(){',
      '  vec2 p=vUv-0.5;float r=length(p)*2.0*10.8;float a=atan(p.y,p.x);',
      '  float d=r-8.62;',
      '  float core=exp(-d*d*22.0);',
      '  float glow=exp(-max(d,0.0)*1.35)*smoothstep(-0.35,0.05,d);',
      '  float flick=0.82+0.18*sin(a*9.0+uTime*5.0)*sin(a*4.0-uTime*3.1);',
      '  float dop=0.42+0.58*pow(0.5+0.5*cos(a-0.65),1.6);',
      '  vec3 col=mix(vec3(0.3,0.62,1.0),vec3(0.96,0.99,1.0),clamp(core*1.2,0.0,1.0));',
      '  float alpha=(core*0.95+glow*0.32)*flick*dop*uAlpha;',
      '  gl_FragColor=vec4(col,clamp(alpha,0.0,1.0));',
      '}'
    ].join('\n')
  });
  ringMat.opacity = 0;
  ring = new T.Mesh(new T.RingGeometry(7.9, 10.8, 128, 1), ringMat);
  ring.renderOrder = 1001;
  ring.onBeforeRender = function () {
    ringMat.uniforms.uAlpha.value = ringMat.opacity;
    if (diskMat) ringMat.uniforms.uTime.value = diskMat.uniforms.uTime.value;
  };
  group.add(ring);

  // --- Lentille gravitationnelle : arcs de lumière courbés autour du trou ---
  lensMat = new T.ShaderMaterial({
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    side: T.DoubleSide,
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } }, // v15 : arcs animés
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec2 vUv;',
      'uniform float uAlpha;',
      'uniform float uTime;', // v15
      'void main() {',
      '  vec2 p = vUv - 0.5;',
      '  float r = length(p) * 2.0;',
      '  float a = atan(p.y, p.x);',
      // arcs lumineux : la lumière pliée par la gravité (v15 : dérive dans le temps)
      '  float arcs = pow(0.5 + 0.5 * sin(a * 2.0 + r * 9.0 - uTime * 1.5), 3.0);',
      '  float edge = smoothstep(0.0, 0.35, r) * (1.0 - smoothstep(0.55, 1.0, r));',
      '  vec3 col = vec3(0.45, 0.68, 1.0);',
      '  float caustic=pow(max(0.0,sin(a*7.0+r*31.0-uTime*.8)),12.0);',
      '  float lensing=exp(-abs(r-.73-sin(a*2.0)*.08)*35.0);',
      '  gl_FragColor = vec4(col, (arcs*.4+caustic*.12+lensing*.16) * edge * uAlpha);',
      '}'
    ].join('\n')
  });
  lens = new T.Mesh(new T.RingGeometry(30, 48, 96, 1), lensMat);
  lens.renderOrder = 997;
  group.add(lens);

  // --- v15 : seconde lentille gravitationnelle — anneau large d'arcs
  // courbés en CONTRE-ROTATION (la distorsion autour de l'horizon se lit
  // sur deux échelles). Sauf mobile.
  if (!lowQ) {
    lens2Mat = new T.ShaderMaterial({
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
      side: T.DoubleSide,
      uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform float uAlpha;',
        'uniform float uTime;',
        'void main() {',
        '  vec2 p = vUv - 0.5;',
        '  float r = length(p) * 2.0;',
        '  float a = atan(p.y, p.x);',
        '  float rn = clamp((r - 0.44) / (1.0 - 0.44), 0.0, 1.0);',
        '  float arcs = pow(0.5 + 0.5 * sin(a * 3.0 - r * 7.0 + uTime * 1.1), 3.0);',
        '  float edge = smoothstep(0.0, 0.30, rn) * (1.0 - smoothstep(0.60, 1.0, rn));',
        '  vec3 col = vec3(0.55, 0.75, 1.0);',
        '  gl_FragColor = vec4(col, arcs * edge * uAlpha * 0.35);',
        '}'
      ].join('\n')
    });
    lens2 = new T.Mesh(new T.RingGeometry(52, 72, 96, 1), lens2Mat);
    lens2.renderOrder = 995;
    group.add(lens2);
  }

  // --- Particules du disque : ~300 particules bleues qui plongent vers le trou ---
  buildPlunge();
  // --- v15 : spirales RAPIDES et DENSES — l'aspiration devient
  // VISUELLEMENT VIOLENTE en phases d'aspiration. Sauf mobile.
  if (!lowQ) buildPlungeFast();

  // --- Halo bleu diffus derrière le disque ---
  haloMat = new T.SpriteMaterial({
    map: makeHaloTexture(), transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
  });
  halo = new T.Sprite(haloMat);
  halo.scale.set(95, 95, 1);
  halo.renderOrder = 998;
  group.add(halo);

  // --- v8 : onde de choc de la formation : anneau blanc-bleu qui s'étend
  // et s'estompe pendant que le trou noir naît ---
  shockMat = new T.MeshBasicMaterial({
    color: 0xcfe8ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false,
    fog: false, side: T.DoubleSide
  });
  shock = new T.Mesh(new T.RingGeometry(10.05, 10.5, 96, 1), shockMat);
  shock.renderOrder = 1002;
  group.add(shock);

  buildInflow(); // v21 : anneaux d'aspiration de la lumière

  group.scale.setScalar(0.001); // invisible jusqu'à la formation
  scene.add(group);

  // La caméra cinématique (event-camera.js) s'ancre sur le trou noir.
  if (!anchorSet) {
    anchorSet = true;
    try { api.emit('anchor:set', { name: 'blackhole', pos: group.position.clone() }); } catch (e) { /* ignore */ }
  }
}

function disposeGroup() {
  if (!group) return;
  // retire les sprites de nombres
  for (var i = 0; i < numSprites.length; i++) {
    var ns = numSprites[i];
    if (ns.sprite.parent) ns.sprite.parent.remove(ns.sprite);
    ns.sprite.material.dispose();
  }
  numSprites = [];
  if (group.parent) group.parent.remove(group);
  group.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map && o.material.map !== (haloMat && haloMat.map)) o.material.map.dispose();
      o.material.dispose();
    }
  });
  if (haloMat && haloMat.map) haloMat.map.dispose();
  for (var k in numCache) { if (numCache[k]) numCache[k].dispose(); }
  numCache = {};
  group = null; core = null; disk = null; diskMat = null; halo = null; haloMat = null;
  disk2 = null; disk2Mat = null; // v10
  shock = null; shockMat = null; // v8
}

// L'écran s'assombrit pendant la formation (voile DOM léger, pas de post-traitement).
function setDim(on) {
  if (typeof document === 'undefined') return;
  if (on && !dimDiv) {
    dimDiv = document.createElement('div');
    dimDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;' +
      'background:#01020a;opacity:0;transition:opacity 3s;';
    document.body.appendChild(dimDiv);
    setTimeout(function () { if (dimDiv) dimDiv.style.opacity = '0.55'; }, 50);
  } else if (!on && dimDiv) {
    // Pendant blackhole : le ciel est déjà noir, on retire le voile
    // pour ne garder QUE le trou noir (pas de double assombrissement).
    var d = dimDiv; dimDiv = null;
    d.style.opacity = '0';
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  }
}

var flashDiv = null;     // flash blanc bref à l'effondrement (formation resserrée)

// v12 : overshoot franc (naissance qui "claque" puis se pose).
function easeOutBack12(p) {
  p = p < 0 ? 0 : (p > 1 ? 1 : p);
  var c1 = 1.20158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

// Flash blanc BREF à l'effondrement : voile DOM plein écran (pas de
// post-traitement), opacité 1 → 0 en ~0,6 s puis retiré du DOM.
// Masque le 'pop' du trou noir qui apparaît petit avant de grossir.
// Transitoire par construction : s'auto-retire en < 1 s (aucun état persistant).
function flashWhite() {
  if (typeof document === 'undefined') return;
  if (flashDiv && flashDiv.parentNode) flashDiv.parentNode.removeChild(flashDiv);
  flashDiv = document.createElement('div');
  flashDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;' +
    'background:#ffffff;opacity:1;transition:opacity ' + FLASH_FADE_MS + 'ms ease-out;';
  document.body.appendChild(flashDiv);
  var f = flashDiv;
  setTimeout(function () { if (f) f.style.opacity = '0'; }, 30);
  setTimeout(function () {
    if (f.parentNode) f.parentNode.removeChild(f);
    if (flashDiv === f) flashDiv = null;
  }, FLASH_FADE_MS + 150);
}

// ---------------------------------------------------------------- v15 : temps
// CRESCENDO des 7 temps de destruction — chaque temps FRAPPE plus fort que
// le précédent (la force vient du bus 'shockwave' : 0.32 -> 0.7) :
// flash d'écran, onde de choc réémise, secousse sur l'ancrage, disque qui
// s'embrase. Aucun son joué directement : l'audio écoute déjà 'shockwave'.

// Déclenche l'onde de choc d'un temps (réutilise l'anneau 'shock').
function fireBeatShock(force) {
  if (!shock || !shockMat || !group) return;
  beatShockT = 0;
  beatShockF = 0.6 + force; // 0.92 -> 1.3 : crescendo
  shock.visible = true;
  shockMat.color.setHex(0xffffff);
}

// v21 : SOUFFLE du trou noir — pendant la phase 'blackhole', le trou
// « respire » : un anneau bleu-blanc très discret s'étend lentement toutes
// les ~5,5 s (le silence domine, le trou reste vivant).
function fireBreath() {
  if (!shock || !shockMat || !group) return;
  beatShockT = 0;
  beatShockF = 0.32; // anneau contenu, jamais spectaculaire ici
  shock.visible = true;
  shockMat.color.setHex(0x8fb8ff);
}

function updateBeatShock(dt) {
  if (beatShockT < 0 || !shock || !shockMat) return;
  beatShockT += dt;
  var k = beatShockT / 0.9;
  if (k >= 1) { beatShockT = -1; shock.visible = false; shockMat.opacity = 0; return; }
  var e = 1 - Math.pow(1 - k, 3); // snap ease-out
  var sk = (1 + e * 11) * beatShockF;
  shock.scale.set(sk, sk, 1);
  shockMat.opacity = 0.95 * (1 - k) * (1 - k) * Math.min(1.2, beatShockF);
}

// Flash d'écran par temps : DOM bref, auto-retiré, opacité = crescendo.
function flashBeat(force) {
  if (typeof document === 'undefined') return;
  if (beatFlashDiv && beatFlashDiv.parentNode) beatFlashDiv.parentNode.removeChild(beatFlashDiv);
  beatFlashDiv = document.createElement('div');
  var op = Math.min(0.55, 0.16 + force * 0.45); // 0.30 -> 0.47 : de plus en plus fort
  beatFlashDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;' +
    'background:#dfeeff;opacity:' + op.toFixed(3) + ';transition:opacity 300ms ease-out;';
  document.body.appendChild(beatFlashDiv);
  var f = beatFlashDiv;
  setTimeout(function () { if (f) f.style.opacity = '0'; }, 30);
  setTimeout(function () {
    if (f.parentNode) f.parentNode.removeChild(f);
    if (beatFlashDiv === f) beatFlashDiv = null;
  }, 480);
}

// Secousse : le trou noir tremble autour de sa position d'ancrage, puis s'y
// repose exactement (l'ancrage caméra, émis en clone à la construction,
// n'est jamais déplacé).
function updateShake(dt) {
  if (shakeT <= 0 || !group || !basePos) return;
  shakeT -= dt;
  var amp = Math.max(0, shakeT / 0.5) * (2.2 + beatForce * 4); // crescendo
  group.position.set(
    basePos.x + (Math.random() - 0.5) * amp,
    basePos.y + (Math.random() - 0.5) * amp,
    basePos.z + (Math.random() - 0.5) * amp
  );
  if (shakeT <= 0) group.position.copy(basePos);
}

// Replace la secousse et l'onde sur l'ancrage (transitions de phases).
function settleShake() {
  shakeT = 0;
  beatShockT = -1;
  if (shock) { shock.visible = false; if (shockMat) shockMat.opacity = 0; }
  if (group && basePos) group.position.copy(basePos);
}

// v15 : le disque S'EMBRASE — uIgnite suit sa cible en douceur.
// v22 : + igniteFlash — un PIC d'embrasement bref à chaque battement
// (le disque « crache » de la lumière puis retombe).
function updateIgnite(dt) {
  if (!diskMat) return;
  igniteFlash = Math.max(0, igniteFlash - dt * 3.5);
  var u = diskMat.uniforms.uIgnite;
  u.value += (igniteTarget + igniteFlash - u.value) * Math.min(1, dt * 3);
  if (disk2Mat) disk2Mat.uniforms.uIgnite.value = u.value * 0.8;
}

// ---------------------------------------------------------------- disque :
// particules, anneau d'Einstein, lentille
function buildPlunge() {
  var nP = lowQ ? 150 : PLUNGE_COUNT; // v15 : allégé sur mobile
  var pos = new Float32Array(nP * 3);
  plungeData = new Float32Array(nP * 4);
  for (var i = 0; i < nP; i++) {
    var ang = Math.random() * Math.PI * 2;
    var rad = PLUNGE_R_IN + Math.random() * (PLUNGE_R_OUT - PLUNGE_R_IN);
    plungeData[i * 4] = ang;
    plungeData[i * 4 + 1] = rad;
    plungeData[i * 4 + 2] = 0.25 + Math.random() * 0.5; // vitesse orbitale
    plungeData[i * 4 + 3] = 1.2 + Math.random() * 2.4;  // vitesse de chute
    pos[i * 3] = Math.cos(ang) * rad;
    pos[i * 3 + 1] = Math.sin(ang) * rad;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  plungeMat = new T.PointsMaterial({
    color: 0x9fc4ff, size: 1.6, sizeAttenuation: true,
    transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
  });
  plunge = new T.Points(geo, plungeMat);
  plunge.renderOrder = 1002;
  plunge.frustumCulled = false;
  group.add(plunge);
}

// v15 — Spirales RAPIDES et DENSES : 180 particules brillantes qui plongent
// VIOLENTMENT vers le centre pendant les phases d'aspiration (l'aspiration
// doit se VOIR). Opacité pilotée par le vigor dans updatePlunge().
var PLUNGE_FAST_COUNT = 180;
function buildPlungeFast() {
  var nP = PLUNGE_FAST_COUNT;
  var pos = new Float32Array(nP * 3);
  plungeFastData = new Float32Array(nP * 4);
  for (var i = 0; i < nP; i++) {
    var ang = Math.random() * Math.PI * 2;
    var rad = 14 + Math.random() * 50;
    plungeFastData[i * 4] = ang;
    plungeFastData[i * 4 + 1] = rad;
    plungeFastData[i * 4 + 2] = 0.8 + Math.random() * 1.2;  // orbitale rapide
    plungeFastData[i * 4 + 3] = 4.0 + Math.random() * 6.0;  // chute VIOLENTE
    pos[i * 3] = Math.cos(ang) * rad;
    pos[i * 3 + 1] = Math.sin(ang) * rad;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  plungeFastMat = new T.PointsMaterial({
    color: 0xd8ecff, size: 2.2, sizeAttenuation: true,
    transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
  });
  plungeFast = new T.Points(geo, plungeFastMat);
  plungeFast.renderOrder = 1003;
  plungeFast.frustumCulled = false;
  group.add(plungeFast);
}

// v21 — ASPIRATION VISUELLE DE LA LUMIÈRE : 2 anneaux lumineux qui
// convergent en continu vers le cœur (décalés d'un demi-cycle). La lumière
// elle-même est aspirée : le climax cosmique se LIT sur le trou noir.
function buildInflow() {
  if (inRing1 || !group) return;
  inRing1Mat = new T.MeshBasicMaterial({
    color: 0xbfe0ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false,
    fog: false, side: T.DoubleSide
  });
  inRing1 = new T.Mesh(new T.RingGeometry(0.94, 1.0, 64), inRing1Mat);
  inRing1.renderOrder = 994;
  group.add(inRing1);
  inRing2Mat = new T.MeshBasicMaterial({
    color: 0x9fd0ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false,
    fog: false, side: T.DoubleSide
  });
  inRing2 = new T.Mesh(new T.RingGeometry(0.94, 1.0, 64), inRing2Mat);
  inRing2.renderOrder = 993;
  group.add(inRing2);
  // v22 : 3e anneau — la convergence de la lumière se lit sur 3 temps
  // décalés (tiers de cycle) : l'aspiration est TERRIFIANTE à regarder.
  inRing3Mat = new T.MeshBasicMaterial({
    color: 0xd8ecff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false,
    fog: false, side: T.DoubleSide
  });
  inRing3 = new T.Mesh(new T.RingGeometry(0.94, 1.0, 64), inRing3Mat);
  inRing3.renderOrder = 992;
  group.add(inRing3);
}

// Anime les anneaux d'aspiration : le rayon décroît de 110 -> 16 en
// accélérant (l'aspiration s'intensifie en approchant de l'horizon).
// vigor : intensité de l'aspiration (0 = anneaux éteints).
// v22 : 3 anneaux décalés d'un tiers de cycle, PLUS MARQUÉS (opacité et
// rayon de départ augmentés) — la lumière aspirée se LIT de loin.
function updateInflow(dt, vigor) {
  if (!inRing1 || !inRing2 || !inRing1Mat || !inRing2Mat) return;
  var on = vigor > 0.15;
  inRingT1 += dt;
  inRingT2 += dt;
  inRingT3 += dt;
  var cyc = 3.2;
  if (inRingT1 >= cyc) inRingT1 -= cyc;
  if (inRingT2 >= cyc) inRingT2 -= cyc;
  if (inRingT3 >= cyc) inRingT3 -= cyc;
  var k1 = inRingT1 / cyc;
  var k2 = ((inRingT2 + cyc / 2) % cyc) / cyc; // demi-cycle de décalage
  var k3 = ((inRingT3 + cyc / 3) % cyc) / cyc; // v22 : tiers de cycle
  var r1 = 110 - 94 * k1 * k1;
  var r2 = 110 - 94 * k2 * k2;
  inRing1.scale.set(r1, r1, 1);
  inRing2.scale.set(r2, r2, 1);
  var o = Math.min(0.65, vigor * 0.42);
  if (on) {
    inRing1Mat.opacity = o * (1 - k1 * 0.6);
    inRing2Mat.opacity = o * (1 - k2 * 0.6);
  } else {
    inRing1Mat.opacity = Math.max(0, inRing1Mat.opacity - dt * 2);
    inRing2Mat.opacity = Math.max(0, inRing2Mat.opacity - dt * 2);
  }
  if (inRing3 && inRing3Mat) {
    var r3 = 110 - 94 * k3 * k3;
    inRing3.scale.set(r3, r3, 1);
    if (on) inRing3Mat.opacity = o * (1 - k3 * 0.6) * 0.9;
    else inRing3Mat.opacity = Math.max(0, inRing3Mat.opacity - dt * 2);
  }
}

// Anime le disque : rotation, anneau d'Einstein, lentille, particules qui plongent.
// spin : vitesse de rotation du disque ; vigor : intensité de l'aspiration.
// v10 : la seconde couche (disk2) tourne en SENS INVERSE, plus lentement.
// Anime le disque : rotation, anneau d'Einstein, lentille, particules qui plongent.
// spin : vitesse de rotation du disque ; vigor : intensité de l'aspiration.
// v10 : la seconde couche (disk2) tourne en SENS INVERSE, plus lentement.
// v15 : arcs de lentille animés dans le temps + spirales rapides/violentes
// quand le vigor monte (phases d'aspiration).
function updatePlunge(dt, vigor, spin) {
  if (disk) disk.rotation.z += dt * spin;
  if (disk2) disk2.rotation.z -= dt * spin * 0.38; // contre-rotation lente
  if (lens) lens.rotation.z -= dt * spin * 0.3;
  if (lens2) lens2.rotation.z += dt * spin * 0.22; // v15 : contre-rotation
  if (lensMat) lensMat.uniforms.uTime.value += dt * spin * 2.0; // v15 : arcs animés
  if (lens2Mat) lens2Mat.uniforms.uTime.value += dt * spin * 1.6; // v15
  if (diskMat) {
    var uA = diskMat.uniforms.uAlpha.value;
    if (disk2Mat) {
      disk2Mat.uniforms.uAlpha.value = uA;
      disk2Mat.uniforms.uTime.value += dt * spin * 1.35; // dérive propre à la couche externe
    }
    if (ringMat) ringMat.opacity = uA * (0.88 + 0.12 * Math.sin(diskMat.uniforms.uTime.value * 2.0));
    if (lensMat) lensMat.uniforms.uAlpha.value = uA;
    if (lens2Mat) lens2Mat.uniforms.uAlpha.value = uA * 0.8; // v15
    if (plungeMat) plungeMat.opacity = uA;
  }
  if (plunge && plungeData) {
    var pos = plunge.geometry.attributes.position.array;
    var nPlunge = plungeData.length / 4; // v15 : compte réel (allégé sur mobile)
    for (var i = 0; i < nPlunge; i++) {
      var a = plungeData[i * 4];
      var r = plungeData[i * 4 + 1];
      var sp = plungeData[i * 4 + 2];
      var fl = plungeData[i * 4 + 3];
      var near = 26 / Math.max(r, 4); // accélération près de l'horizon
      a += dt * sp * vigor * near;
      r -= dt * fl * vigor * near;
      if (r < PLUNGE_R_IN) { // absorbée : réapparaît au bord extérieur
        r = PLUNGE_R_OUT - Math.random() * 6;
        a = Math.random() * Math.PI * 2;
      }
      plungeData[i * 4] = a;
      plungeData[i * 4 + 1] = r;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
    }
    plunge.geometry.attributes.position.needsUpdate = true;
  }
  // v15 : SPIRALES RAPIDES — denses et violentes quand l'aspiration monte
  // (vigor > ~1) : l'aspiration devient VISUELLEMENT VIOLENTE.
  if (plungeFast && plungeFastData && plungeFastMat) {
    var fastK = Math.min(1, Math.max(0, (vigor - 0.9) / 0.8));
    plungeFastMat.opacity = (plungeMat ? plungeMat.opacity : 0) * fastK;
    if (fastK > 0) {
      var fpos = plungeFast.geometry.attributes.position.array;
      var fn = plungeFastData.length / 4;
      for (var fi = 0; fi < fn; fi++) {
        var fa = plungeFastData[fi * 4];
        var fr = plungeFastData[fi * 4 + 1];
        var fsp = plungeFastData[fi * 4 + 2];
        var ffl = plungeFastData[fi * 4 + 3];
        var fnear = 26 / Math.max(fr, 4);
        fa += dt * fsp * vigor * 2.0 * fnear;
        fr -= dt * ffl * vigor * fnear;
        if (fr < 11) { fr = 58 + Math.random() * 6; fa = Math.random() * Math.PI * 2; }
        plungeFastData[fi * 4] = fa;
        plungeFastData[fi * 4 + 1] = fr;
        fpos[fi * 3] = Math.cos(fa) * fr;
        fpos[fi * 3 + 1] = Math.sin(fa) * fr;
      }
      plungeFast.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------- formation
function startFormation() {
  if (forming || formed) return;
  forming = true;
  formT = 0;
  build();
  flashWhite(); // impact visuel immédiat : flash blanc bref
  setDim(false);
  igniteFlash = 1; // v22 : le disque naît embrasé (pic initial)
}

function finishFormation() {
  forming = false;
  formed = true;
}

// ---------------------------------------------------------------- nombres
// Fait apparaître UN nombre autour du trou noir (fondu in/out, tenue brève).
// v15 : chaque nombre CLAQUE plus fort que le précédent — pop brutal
// (overshoot + flash + secousse), intensité croissante avec l'index.
function spawnNumber() {
  if (!group || numIdx >= NUMBERS.length) return;
  var n = NUMBERS[numIdx++];
  var nk = numIdx / NUMBERS.length; // 1/9 -> 1 : intensité croissante
  var mat = new T.SpriteMaterial({
    map: numberTexture(n), transparent: true, opacity: 0,
    depthWrite: false, depthTest: false, fog: false
  });
  var spr = new T.Sprite(mat);
  var ang = Math.random() * Math.PI * 2;
  var rad = 32 + Math.random() * 14;
  spr.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7, -2);
  var bw = 13 * (1 + nk * 0.12), bh = 6.5 * (1 + nk * 0.12); // grandit à chaque chiffre
  spr.scale.set(bw, bh, 1);
  spr.renderOrder = 1001;
  group.add(spr);
  // v15 : flash radial derrière le nombre — il claque en blanc puis s'éteint.
  var fmat = new T.SpriteMaterial({
    map: haloMat.map, color: 0xeaf4ff, transparent: true, opacity: 0.9,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
  });
  var fspr = new T.Sprite(fmat);
  fspr.position.copy(spr.position);
  fspr.scale.set(4, 4, 1);
  fspr.renderOrder = 1000;
  group.add(fspr);
  numSprites.push({ sprite: spr, flash: fspr, at: 0.15 + (numIdx - 1) * numberInterval(), life: 0, pop: 1 + nk * 0.9, w: bw, h: bh });
  numShakeT = 0.28; // v15 : secousse brève à chaque nombre qui claque
  // v22 : chaque nombre fait PULSER le trou — mini anneau bleu en écho +
  // pic d'embrasement du disque (les nombres sont « plus marquants »,
  // un par un, jamais expliqués).
  if (beatShockT < 0) {
    fireBeatShock(0.35);
    if (shockMat) shockMat.color.setHex(0xbfe0ff);
  }
  igniteFlash = Math.min(1, igniteFlash + 0.35);
  // Un blip discret par nombre affiché (l'audio l'écoute).
  // v21 : 'idx'/'total' ajoutés (champs compatibles) — l'audio fait monter
  // le pitch du blip avec l'index : chaque nombre sonne plus marquant.
  try { if (api) api.emit('number:show', { n: n, idx: numIdx, total: NUMBERS.length }); } catch (e) { /* ignore */ }
}

function updateNumbers(dt) {
  // Strictement UN PAR UN : chaque nombre apparaît, reste visible brièvement,
  // disparaît COMPLÈTEMENT, puis seulement le suivant apparaît.
  var elapsed = root.AZEvent.tState;
  if (numIdx < NUMBERS.length && elapsed >= 0.15 + numIdx * numberInterval() && numSprites.length === 0) spawnNumber();
  for (var i = numSprites.length - 1; i >= 0; i--) {
    var ns = numSprites[i];
    ns.life = Math.max(0, elapsed - ns.at);
    var m = ns.sprite.material;
    // v10 : le nombre naît en fondu avec une légère expansion, pulse
    // doucement pendant sa tenue, puis s'efface en fondu.
    // v12 : naissance FRANCHE — anticipation (resserrement) + overshoot qui
    // se pose ; tenue avec pulsation plus marquée.
    // v15 : pop BRUTAL — l'overshoot, le flash et la taille croissent avec
    // l'index du nombre (ns.pop : 1 -> 1.9).
    if (ns.life < NUM_FADE) {
      var fi = ns.life / NUM_FADE;                            // fondu in
      m.opacity = fi;
      var si = 0.86 + 0.18 * ns.pop * easeOutBack12(fi);      // anticipation + overshoot brutal
      ns.sprite.scale.set(ns.w * si, ns.h * si, 1);
    } else if (ns.life < NUM_CYCLE - NUM_FADE) {
      m.opacity = 1;                                          // tenue brève
      var pu = 1.03 + 0.05 * Math.sin(ns.life * 15);          // pulsation franche
      ns.sprite.scale.set(ns.w * pu, ns.h * pu, 1);
    } else if (ns.life < NUM_CYCLE) {
      var fo = 1 - (ns.life - (NUM_CYCLE - NUM_FADE)) / NUM_FADE; // fondu out
      m.opacity = fo;
      var so = 1 - 0.08 * (1 - fo);                           // léger retrait
      ns.sprite.scale.set(ns.w * so, ns.h * so, 1);
    } else {
      group.remove(ns.sprite);
      m.dispose();
      if (ns.flash) { // v15 : le flash est déjà éteint, on le retire
        if (ns.flash.parent) ns.flash.parent.remove(ns.flash);
        ns.flash.material.dispose();
      }
      numSprites.splice(i, 1);
      continue;
    }
    // v15 : flash du nombre — expansion radiale + fondu en 0,3 s.
    if (ns.flash) {
      var fl = ns.life / 0.30;
      if (fl >= 1) {
        if (ns.flash.parent) ns.flash.parent.remove(ns.flash);
        ns.flash.material.dispose();
        ns.flash = null;
      } else {
        var fsc = 4 + fl * 34 * ns.pop;
        ns.flash.scale.set(fsc, fsc, 1);
        ns.flash.material.opacity = 0.9 * (1 - fl);
      }
    }
  }
}

// ---------------------------------------------------------------- cycle de vie
function init(a) {
  api = a;
  T = a.T;
  lowQ = !!(a && (a.quality === 'low' || a.isMobile)); // v15 : mobile -> allégé
  formed = false;
  forming = false;
  formT = 0;
  numIdx = 0;
  numTimer = 0.15;           // le premier nombre apparaît presque aussitôt l'entrée en phase
  anchorSet = false;
  growthT = 0;
  beatPunch = 0;             // v13 : réarmé à chaque démarrage (restart OK)
  suckPunch = 0;             // v20 : réarmé à chaque démarrage (restart OK)
  beatForce = 0.5;           // v15 : réarmé
  beatNum = 0;               // v15 : réarmé
  shakeT = 0;                // v15 : réarmé
  basePos = null;            // v15 : réarmé
  beatShockT = -1;           // v15 : réarmé
  numShakeT = 0;             // v15 : réarmé
  igniteTarget = 0;          // v15 : réarmé
  numBeat = 0;               // v21 : réarmé
  breathT = 0;               // v21 : réarmé
  inRingT1 = 0; inRingT2 = 0; // v21 : réarmés
  inRingT3 = 0;              // v22 : réarmé
  igniteFlash = 0;           // v22 : réarmé
  endMinified = false;       // réarmé à chaque démarrage (restart OK)
  hideEndDot();              // le point final ne survit pas à un redémarrage
  // Signal officiel de formation, émis par event-zeropoint.js (phase collapse).
  // Ce module ÉCOUTE uniquement : il ne doit jamais émettre 'blackhole:formed'
  // lui-même (sinon double émission inter-modules).
  // Branché UNE SEULE FOIS : le bus ne purge pas ses écouteurs au stop(),
  // un re-branchement à chaque init() le dupliquerait au redémarrage.
  if (!busBound) {
    busBound = true;
    api.on('blackhole:formed', function () {
      if (root.AZEvent.active) startFormation();
    });
    // v13 : chaque temps de destruction FAIT FRAPPER le trou noir
    // (overshoot d'échelle + sursaut du halo et du disque).
    // v15 : CRESCENDO — la force vient du bus (event-shockwave.js :
    // 0.32 -> 0.7) : chaque temps frappe PLUS FORT que le précédent
    // (flash d'écran, onde de choc réémise, secousse sur l'ancrage).
    api.on('shockwave', function (d) {
      if (!root.AZEvent.active || (!formed && !forming)) return;
      beatPunch = 1;
      beatForce = (d && typeof d.force === 'number') ? d.force : 0.5;
      beatNum++;
      shakeT = 0.5;
      fireBeatShock(beatForce);
      flashBeat(beatForce);
      igniteFlash = Math.min(1, igniteFlash + 0.4); // v22 : le disque s'embrase en pic
    });
    // v20 — chaque battement d'ASPIRATION ('suction:beat', émis par
    // event-suction.js pendant 'destruction') fait PULSER le trou noir :
    // le disque s'embrase et gonfle en écho du temps — le trou « boit »
    // à chaque battement. (Actif seulement quand formé.)
    // v22 : + un anneau bleu SOBRE s'étend à chaque battement (jamais
    // pendant qu'un anneau de temps est déjà en cours — pas de conflit).
    api.on('suction:beat', function () {
      if (!root.AZEvent.active || !formed) return;
      suckPunch = 1;
      igniteFlash = Math.min(1, igniteFlash + 0.55);
      if (beatShockT < 0) {
        fireBeatShock(0.45);
        if (shockMat) shockMat.color.setHex(0x9fd0ff);
      }
    });
    // v21 — chaque nombre affiché fait RÉPONDRE le trou noir : le disque
    // et le halo pulsent en écho (les nombres sont « plus marquants »,
    // un par un, jamais expliqués).
    api.on('number:show', function () {
      if (!root.AZEvent.active || !formed) return;
      numBeat = 1;
    });
  }
}

var FORMATION_STATES = { collapse: 1, growth: 1, destruction: 1, playersucked: 1, allgone: 1, blackhole: 1, numbers: 1 };

function update(dt, t) {
  if (!root.AZEvent.active) return;
  var state = root.AZEvent.state;

  // --- end [300,infini] : ÉCRAN TOTALEMENT NOIR + minuscule point bleu ---
  // Juste un minuscule point bleu lumineux au centre — RIEN d'autre, c'est
  // LA fin. Le trou noir détaillé (disque, anneau d'Einstein, lentille,
  // particules, halo) est masqué d'un coup, les derniers nombres sont
  // retirés, seul le point DOM centré reste affiché sur le noir absolu.
  // AUCUNE animation, AUCUN texte après.
  if (state === 'end') {
    if (!endMinified) {
      endMinified = true;
      for (var ei = numSprites.length - 1; ei >= 0; ei--) {
        var ens = numSprites[ei];
        if (ens.sprite.parent) ens.sprite.parent.remove(ens.sprite);
        ens.sprite.material.dispose();
        // v23 : le flash compagnon du nombre part aussi — sinon sprite
        // orphelin dans le groupe (masqué mais jamais libéré : fuite).
        if (ens.flash) {
          if (ens.flash.parent) ens.flash.parent.remove(ens.flash);
          if (ens.flash.material) ens.flash.material.dispose();
        }
      }
      numSprites = [];
      if (group) group.visible = false;
      showEndDot();
    }
    return;
  }

  // --- contraction [281,286] : le module reste STRICTEMENT inactif ---
  // L'énergie de l'explosion se contracte vers le Point Zéro — visuels
  // gérés par event-suction.js (anneaux qui se resserrent, halo qui
  // rétrécit). Le trou noir n'apparaît sous AUCUNE condition avant
  // 'collapse' : aucun build(), aucun anchor, aucun voile.
  // (Défense : même si un groupe venait d'être construit par erreur, on le
  // garde invisible tant que la formation n'a pas démarré.)
  if (state === 'contraction' && !forming && !formed) {
    if (group) group.visible = false;
    return;
  }

  // Repli : si le signal n'est jamais arrivé, on forme dès l'état 'collapse'
  // (basé sur l'ÉTAT, pas sur un temps absolu — le trou noir ne doit jamais manquer).
  // v47 : toute phase postérieure à 'collapse' compte (frame sautée, onglet en
  // arrière-plan, saut de phase) — sinon le trou noir manquait jusqu'à la fin.
  if (!forming && !formed && FORMATION_STATES[state]) {
    startFormation();
  }
  if (!forming && !formed) return;
  if (!group) { build(); if (!group) return; }

  // --- Formation (collapse [286,290]) : naissance RESSERRÉE et SPECTACULAIRE ---
  // Le trou apparaît PETIT puis GROSSIT RAPIDEMENT à sa taille finale
  // (easeOutCubic sur ~2,4 s — aucun flottement lent), disque d'accrétion bleu
  // en rotation visible immédiatement, halo subtil.
  if (forming) {
    formT += dt;
    var p = Math.min(1, formT / FORM_DURATION);
    var e = 1 - Math.pow(1 - p, 3); // easeOutCubic : croissance très rapide
    // v10 : micro-pulsation amortie à l'arrivée (le trou "se pose").
    var wob = Math.sin(p * Math.PI * 2.5) * 0.035 * (1 - p);
    // v12 : ANTICIPATION — le trou se resserre un bref instant avant
    // d'exploser (dip en début de formation).
    var anticip = -0.035 * Math.sin(Math.min(1, p / 0.15) * Math.PI) * (1 - p);
    group.scale.setScalar(Math.max(0.001, 0.08 + 0.92 * e + wob + anticip)); // petit (0.08) → taille finale (1.0)
    diskMat.uniforms.uTime.value += dt * 2.2; // tourbillon visible immédiatement
    diskMat.uniforms.uAlpha.value = Math.min(1, formT / 0.6); // disque visible de suite
    if (disk2Mat) { // v10 : la couche externe naît avec l'interne
      disk2Mat.uniforms.uTime.value += dt * 1.4;
      disk2Mat.uniforms.uAlpha.value = Math.min(1, formT / 0.9);
    }
    if (disk2) disk2.rotation.z -= dt * 0.6;
    haloMat.opacity = 0.35 * e; // halo SUBTIL
    disk.rotation.z += dt * (1.6 - 0.9 * e); // rotation rapide dès le départ, s'apaise
    // v8 : onde de choc — l'anneau s'étend et s'estompe pendant la formation.
    // v12 : expansion franche (snap ease-out).
    if (shock && shockMat) {
      var sk = 1 + (1 - Math.pow(1 - p, 3)) * 9;
      shock.scale.set(sk, sk, 1);
      shockMat.opacity = 0.9 * (1 - p) * (1 - p);
    }
    if (p >= 1) finishFormation();
    igniteTarget = 0.6; // v15 : le disque naît embrasé, puis s'apaise
    updateInflow(dt, 0.9); // v22 : la lumière est aspirée DÈS LA NAISSANCE
    updateIgnite(dt);
    faceCamera();
    return;
  }

  // --- Croissance (growth [290,294]) : il GRANDIT et absorbe la matière autour ---
  // Progression RELATIVE (temps écoulé DANS la phase, aucun temps absolu).
  // v10 : ease-out jusqu'à 2.6 (continuité EXACTE avec la phase 'blackhole'),
  // avec des pulsations amples qui s'apaisent pendant la croissance.
  if (state === 'growth') {
    growthT += dt;
    var span = root.AZEvent.TIMELINE.growth;
    var k = api.clamp(growthT / (span[1] - span[0]), 0, 1);
    var e2 = 1 - Math.pow(1 - k, 3); // ease-out : départ franc, arrivée douce
    var gp = Math.sin(growthT * 5.2) * 0.07 * (1 - k)   // pulsation principale
           + Math.sin(growthT * 11.0) * 0.02 * (1 - k); // harmonique fine
    group.scale.setScalar(1 + 3.2 * e2 + gp); // → 2.6 pile à k=1 (gp→0)
    diskMat.uniforms.uTime.value += dt * 1.5; // v8 : tourbillon plus vif
    diskMat.uniforms.uAlpha.value = 1;
    haloMat.opacity = 0.85 - 0.25 * e2;
    halo.scale.set(95 + 60 * e2, 95 + 60 * e2, 1);
    updatePlunge(dt, 1.7 - 0.7 * e2, 0.55 - 0.45 * e2);
    igniteTarget = 0.35; // v15 : embrasement modéré pendant la croissance
    updateIgnite(dt);
    updateInflow(dt, 1.2); // v21 : la lumière commence à être aspirée
    faceCamera();
    return;
  }

  // --- destruction -> allgone [294,312] : aspiration continue de la matière ---
  if (state === 'destruction' || state === 'playersucked' || state === 'allgone') {
    // v13 : chaque temps de destruction fait FRAPPER le trou noir
    // (overshoot d'échelle + sursaut du halo et du disque).
    // v15 : CRESCENDO — la force du temps (bus 'shockwave') multiplie le
    // coup : overshoot, sursaut du tourbillon, halo, disque qui s'embrase,
    // onde de choc réémise, secousse. Chaque temps frappe plus fort.
    beatPunch = Math.max(0, beatPunch - dt * 2.6);
    suckPunch = Math.max(0, suckPunch - dt * 2.2); // v20 : retombe vite
    var bpk = beatPunch * beatPunch;
    var spk = suckPunch * suckPunch; // v20 : pulsation d'aspiration
    var bf = 0.55 + beatForce; // 0.87 -> 1.25 : crescendo du bus
    group.scale.setScalar(4.2 + 0.14 * Math.sin(t * 0.5) + 0.24 * bpk * bf + 0.18 * spk);
    diskMat.uniforms.uTime.value += dt * (1.3 + 3.2 * bpk * bf + 2.0 * spk); // sursaut du tourbillon
    updatePlunge(dt, 1.0 + 1.5 * bpk * bf + 0.8 * spk, 0.22 + 0.55 * bpk * bf + 0.25 * spk); // aspiration VIOLENTE à chaque temps
    updateInflow(dt, 1.0 + 1.2 * bpk * bf + 0.6 * spk); // v21 : la lumière est aspirée
    haloMat.opacity = 0.55 + 0.12 * Math.sin(t * 0.8) + 0.25 * bpk * bf + 0.18 * spk;
    igniteTarget = 0.35 + bpk * 0.65 + spk * 0.3; // v15 + v20 : le disque S'EMBRASE à chaque temps/battement
    updateIgnite(dt);
    updateBeatShock(dt); // v15 : onde de choc du temps
    updateShake(dt);      // v15 : secousse sur l'ancrage
    faceCamera();
    return;
  }

  // --- blackhole [312,322] : ON COUPE TOUTE L'ACTION ---
  // TROU NOIR SEUL : centre noir absolu, matière BLEUE lumineuse qui tourne
  // LENTEMENT, caméra stable, SILENCE. RIEN d'autre.
  if (state === 'blackhole') {
    setDim(false); // le ciel est déjà noir : on montre le trou noir pur
    // v15 : sobriété absolue — aucune secousse résiduelle (MAIS on ne tue
    // pas l'anneau du souffle : settleShake() complet annulerait
    // beatShockT à chaque frame, le souffle ne vivrait jamais).
    shakeT = 0;
    if (group && basePos) group.position.copy(basePos);
    // v8 : plus grand, respiration lente majestueuse.
    // v21 : le trou « respire » — anneau bleu discret toutes les ~5,5 s.
    breathT += dt;
    if (breathT >= 5.5) { breathT = 0; fireBreath(); }
    updateBeatShock(dt); // v21 : le souffle s'étend et s'éteint
    group.scale.setScalar(4.2 + 0.06 * Math.sin(t * 0.45));
    diskMat.uniforms.uTime.value += dt * 0.7; // ralenti
    diskMat.uniforms.uAlpha.value = 1;
    haloMat.opacity = 0.38 + 0.05 * Math.sin(t * 0.45);
    halo.scale.set(160, 160, 1);
    updatePlunge(dt, 0.35, 0.10); // matière bleue LENTE, aucun nombre, aucun effet
    updateInflow(dt, 0.5); // v21 : la lumière continue d'être aspirée, doucement
    igniteTarget = 0.15; // v15 : le disque s'est apaisé
    updateIgnite(dt);
    faceCamera();
    return;
  }

  // --- numbers [322,328] : les nombres, un par un, jamais expliqués ---
  if (state === 'numbers') {
    settleShake(); // v15 : les nombres claquent, le trou reste stable
    // v21 : AVALÉ PAR LE NOIR — dans les 1,4 dernières secondes de la
    // phase, le trou noir s'effondre sur lui-même (implosion franche) :
    // la transition vers le noir final est une disparition, pas une
    // coupure. Durée lue depuis la timeline officielle (bornes figées,
    // jamais en dur ici).
    // v22 : implosion ACCÉLÉRÉE (ease-in, 2,2 s) — le trou s'effondre sur
    // lui-même de plus en plus vite, le tourbillon s'EMBALLE, la lumière
    // converge plus fort. À la fin : RIEN — la finale noire ('end' :
    // écran noir + minuscule point bleu) prend le relais sans couture.
    var numDur = 7;
    try {
      var TLM = root.AZEvent.TIMELINE;
      if (TLM && TLM.numbers && isFinite(TLM.numbers[1]) && isFinite(TLM.numbers[0]))
        numDur = Math.max(2, TLM.numbers[1] - TLM.numbers[0]);
    } catch (e) { /* repli 7 s */ }
    var numRem = numDur - (root.AZEvent.tState || 0);
    var swallow = numRem < 2.2 ? Math.pow(1 - Math.max(0, numRem) / 2.2, 1.6) : 0;
    group.scale.setScalar(Math.max(0.001, 4.2 * (1 - swallow * swallow)));
    // v21 : le trou RÉPOND à chaque nombre — le disque et le halo pulsent
    // en écho (numBeat, posé par l'écouteur 'number:show').
    numBeat = Math.max(0, numBeat - dt * 3);
    var nbk = numBeat * numBeat;
    diskMat.uniforms.uTime.value += dt * (0.7 + 2.4 * nbk + 9 * swallow); // v22 : le tourbillon s'emballe dans l'implosion
    updatePlunge(dt, 0.35, 0.10); // le disque continue lentement
    updateInflow(dt, 0.4 + 1.6 * swallow); // v22 : la lumière converge plus fort à la fin
    haloMat.opacity = 0.3 + 0.3 * nbk;
    updateNumbers(dt);
    igniteTarget = 0.1 + 0.25 * nbk;
    updateIgnite(dt);
    // v15 : secousse BRÈVE à chaque nombre qui claque (le trou tremble
    // sur son ancrage, puis s'y repose exactement).
    if (numShakeT > 0 && group && basePos) {
      numShakeT -= dt;
      var namp = Math.max(0, numShakeT / 0.28) * 3;
      group.position.set(
        basePos.x + (Math.random() - 0.5) * namp,
        basePos.y + (Math.random() - 0.5) * namp,
        basePos.z + (Math.random() - 0.5) * namp
      );
      if (numShakeT <= 0) group.position.copy(basePos);
    }
    faceCamera();
    return;
  }

  // --- repli : tout autre état déjà formé (ne devrait pas arriver) ---
  // trou noir stable (comportement historique de la branche finale).
  // v10 : retour DOUX vers 2.6 (pas de saut d'échelle si la formation
  // s'est terminée hors 'growth').
  var cs = group.scale.x;
  group.scale.setScalar(cs + (4.2 - cs) * Math.min(1, dt * 3));
  diskMat.uniforms.uTime.value += dt * 0.7;
  haloMat.opacity = 0.3;
  updatePlunge(dt, 0.35, 0.10); // matière bleue tournant lentement, immobile au loin
  updateShake(dt); // v15 : une secousse en cours se termine proprement
  igniteTarget = 0.15;
  updateIgnite(dt);
  // les derniers nombres s'éteignent, puis plus rien ne bouge
  for (var i = numSprites.length - 1; i >= 0; i--) {
    var ns = numSprites[i];
    ns.life += dt;
    var m = ns.sprite.material;
    m.opacity = Math.max(0, 1 - ns.life / 0.5);
    if (m.opacity <= 0) { group.remove(ns.sprite); m.dispose(); numSprites.splice(i, 1); }
  }
  faceCamera();
}

// Le trou noir fait toujours face à la caméra cinématique.
function faceCamera() {
  if (!group) return;
  var cam = api.camera();
  if (cam) group.lookAt(cam.position);
}

function dispose() {
  setDim(false);
  if (dimDiv && dimDiv.parentNode) { dimDiv.parentNode.removeChild(dimDiv); dimDiv = null; }
  if (beatFlashDiv && beatFlashDiv.parentNode) { beatFlashDiv.parentNode.removeChild(beatFlashDiv); beatFlashDiv = null; } // v15
  disposeGroup();
  removeEndDot(); // retire le point final du DOM, réarme la bascule 'end'
  formed = false;
  forming = false;
  formT = 0;
  numIdx = 0;
  anchorSet = false;
  growthT = 0;
  beatPunch = 0;             // v13
  suckPunch = 0;             // v20
  beatForce = 0.5;           // v15
  beatNum = 0;               // v15
  shakeT = 0;                // v15
  basePos = null;            // v15
  beatShockT = -1;           // v15
  numShakeT = 0;             // v15
  igniteTarget = 0;          // v15
  numBeat = 0;               // v21
  breathT = 0;               // v21
  // v21 : anneaux d'aspiration (géométries/matériaux libérés par le
  // traverse de disposeGroup()).
  inRing1 = null; inRing1Mat = null;
  inRing2 = null; inRing2Mat = null;
  inRingT1 = 0; inRingT2 = 0;
  inRing3 = null; inRing3Mat = null; // v22
  inRingT3 = 0;                      // v22
  igniteFlash = 0;                   // v22
  lowQ = false;              // v15
  ring = null; ringMat = null;
  lens = null; lensMat = null;
  lens2 = null; lens2Mat = null; // v15 (géométries libérées par le traverse de disposeGroup)
  plunge = null; plungeMat = null; plungeData = null;
  plungeFast = null; plungeFastMat = null; plungeFastData = null; // v15
  api = null;
  T = null;
}

root.AZEvent.register('blackhole', {
  init: init,
  update: update,
  dispose: dispose
});

})(window);
