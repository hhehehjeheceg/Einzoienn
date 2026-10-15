/* event-shockwave.js — projet "THE END" (AZUR Horizons v1.8, vague v10).
 *
 * DEUX SYSTÈMES :
 * 1. LASERS ROUGES (réf. frames f3_027/f3_028) : pendant les phases 'descent'
 *    et 'veeroff', des LASERS ROUGES FINS montent du sol / de l'île et se
 *    CROISENT sur la météorite. La cible est AZEvent.meteorPos (publié chaque
 *    frame par event-meteor.js) ; repli : AZEvent.rifts[0].pos ; dernier repli :
 *    le centre, en l'air. Ciel noir étoilé en fond (géré par event-sky.js).
 *
 *    Les lasers sont des faisceaux fins CONTINUS (pas d'alarmes rouges
 *    clignotantes) : opacité quasi constante avec un léger scintillement.
 *    En 'veeroff', ils se RESSERRENT (tight -> ~0.92 : les points de visée
 *    convergent presque exactement sur la météorite).
 *
 * 2. ONDES DE CHOC SPHÉRIQUES (v10) : explosions d'énergie dans TOUTES les
 *    directions — coquille sphérique expansive + anneaux multiples +
 *    éclair lumineux. Déclenchées par le bus 'shockwave:burst' :
 *      api.emit('shockwave:burst', { pos, opts })
 *    ou via trigger('burst', {pos, opts}).
 *    opts : { radius (défaut 500, mètres), duration (défaut 2.8 s),
 *             color (défaut 0xbfe6ff), rings (défaut 3),
 *             flash (défaut true : PointLight), ringTilt (défaut true) }
 *
 *    CÂBLAGE (v10, réconciliation) :
 *      - CONTACT phase 8 : event-rockets.js émet DIRECTEMENT
 *        'shockwave:burst' {radius:1000, 5 anneaux} (une fois, garde
 *        flags.impact) — pas de câblage automatique ici (doublon évité) ;
 *      - Explosion phase 14 : event-impact.js émet DIRECTEMENT
 *        'shockwave:burst' {radius:2600, 7 anneaux, échelle de l'île}
 *        (une fois, garde meteorHitSent) — pas de câblage auto ici ;
 *      - 'phase:greatrift' : câblage AUTOMATIQUE — OUVERTURE de la GRANDE
 *        faille (phase 10) -> r=420 + bus 'shockwave' {force:0.7} (audio/ciel) ;
 *      - 'phase:destruction' : câblage AUTOMATIQUE — 7 TEMPS de destruction
 *        (phase 18), répartis sur la durée de la phase (bornes TIMELINE),
 *        alternés autour de l'île + un au centre, chacun avec bus
 *        'shockwave' {force:0.45}.
 *    NOTE POUR LES AUTRES GROUPES : n'émettez PAS 'shockwave:burst' pour
 *    ces 4 moments (doublons visuels) ; utilisez 'shockwave:burst'
 *    uniquement pour des ondes SUR MESURE ailleurs.
 *    Bus ÉMIS par ce module : 'shockwave' {force, pos} (écouté par
 *    event-audio.js -> boom, event-sky.js -> lueur).
 *
 * v14 (passe animation) : l'onde du strike (fusée -> Point Zéro) est
 * DÉVASTATRICE — noyau incandescent intérieur qui claque plus vite que
 * la coquille, TRAÎNÉES RADIALES qui fusent dans toutes les directions,
 * ONDE AU SOL qui balaie le sol sous l'explosion, FLASH qui suit la
 * courbe en crescendo des 7 temps (0.32 -> 0.77, comme les temps de
 * destruction). Nouveaux opts (activés par défaut) : innerShell,
 * streaks, groundWave, beatFlash. Comptes réduits sur mobile via
 * api.quality / api.isMobile.
 *
 * v15 (passe animation maximale) : l'onde du strike est DÉVASTATRICE
 * multi-couches — coquille externe + noyau incandescent AMPLIFIÉ + CŒUR
 * CHAUD blanc qui claque en premier, TRAÎNÉES RADIALES plus nombreuses
 * (44 hors mobile), ONDE AU SOL avec FRONT LUMINEUX au bord d'attaque +
 * double écho, FLASH qui suit la courbe des 7 temps AMPLIFIÉE
 * (0.51 -> 1.23). Les 7 temps de destruction frappent chacun plus fort
 * (rayon/durée/anneaux croissants). Nouveaux opts (défaut true) :
 * hotCore, waveFront, echo2. 'shockwave:burst' et 'shockwave' conservés.
 *
 * v21 — ONDE DE CHOC À FOND :
 *  - on la SENT arriver : front de pression PRÉCURSEUR (anneau fin et
 *    rapide qui devance la coquille sur les impacts majeurs), MUR DE
 *    POUSSIÈRE au bord d'attaque (opts.dustWall), MIROITEMENT DE L'AIR
 *    (coquille fantôme qui ondule devant l'onde, opts.airShimmer) ;
 *  - vagues multiples et retardées : 3e vague de la cascade (+1,6 s) sur
 *    les majeurs, ÉCHO retardé (+0,7 s) sur toutes les ondes >= 250 m,
 *    RAFALES RETARDÉES génériques (scheduleBurst — second souffle) ;
 *  - les 7 temps ont chacun leur SIGNATURE (anneaux purs / traînées /
 *    mur de poussière / LE gros au centre / double écho / réplique
 *    retardée / cascade maximale) + PRÉ-TEMPS télégraphié (anneau qui
 *    s'inspire 0,5 s avant chaque temps) ;
 *  - anticipation du strike : ANNEAUX DE PRESSION qui descendent du ciel
 *    vers le Point Zéro pendant que la fusée plonge ;
 *  - PROPULSION DU JOUEUR (visuel uniquement — la mécanique vit dans
 *    event-player.js) : sur 'rocket:zeroshock' — FLASH de départ, ANNEAU
 *    DE CHOC au décollage, TRAÎNÉE lumineuse qui suit le joueur tant
 *    qu'il vole (AZEvent.playerInfo.mode === 'zeroshock').
 *
 * v22 — ONDE DE CHOC MASSIVE :
 *  - DOUBLE PRÉCURSEUR sur les impacts majeurs (2 anneaux fins à vitesses
 *    différentes : on SENT l'onde arriver en deux temps) ; les temps 6 et
 *    7 de destruction ont aussi leur pré-anneau (opts.preRing) ;
 *  - SECOND SOUFFLE : sur les impacts majeurs, une seconde onde (x0.75)
 *    frappe +2,2 s après (l'explosion « rebondit », jamais de coupure) ;
 *  - au STRIKE de la fusée n°1 ('rocket:impact') : DÔME DE PRESSION —
 *    un hémisphère qui S'ÉCRASE vers le sol en s'aplatissant (distinct de
 *    la coquille expansive : il se contracte et s'enfonce, l'air est
 *    « pressé ») + double mur de poussière au sol ;
 *  - PROPULSION DU JOUEUR : SOUFFLE (gerbe vers le bas/l'extérieur),
 *    2e anneau au décollage, halo large + le joueur SÈME DES ÉTINCELLES
 *    pendant son vol (le sillage scintille) ;
 *  - le bus 'shockwave' des 7 temps porte le numéro du temps (beat).
 * Rien n'est supprimé/renommé : ajouts et enrichissements uniquement.
 *
 * Pilotage : bus 'phase:descent' / 'phase:veeroff' + AZEvent.state
 * (repli si un événement de phase a été manqué). Durées relatives aux
 * phases uniquement — jamais de temps absolus en dur.
 *
 * Contrat : IIFE 'use strict', THREE global, aucun import, aucun réseau,
 * inactif si !AZEvent.active, dispose() retire TOUT (meshs, DOM, écouteurs).
 */
(function (root) {
'use strict';

if (!root.AZEvent) return; // le séquenceur doit être chargé avant

var api = null;
var T = null;              // alias THREE
var disposed = false;
var busBound = false;

var laserGroup = null;     // T.Group ajouté à la scène
var laserGeo = null;       // géométrie partagée (cylindre unitaire, base à l'origine)
var lasers = [];           // {mesh, mat, base:Vector3, aim:Vector3}
var UP = null;

var mode = 'off';          // 'off' | 'descent' | 'veeroff'
var tight = 0.25;          // resserrement courant 0..1
var tightTarget = 0.25;    // resserrement visé (0.25 descent, ~0.92 veeroff)
var strikeT = 99;          // v12 : temps depuis l'allumage (0 = frappe en cours)
var fading = false;        // fondu de sortie en cours
var fadeAge = 0;
var FADE_LIFE = 2.0;       // fondu relatif, pas un temps absolu

var LASER_COUNT = 9;
var LASER_RADIUS = 0.9;    // faisceaux FINS
var LASER_COLOR = 0xff2a22; // rouge
var GROUND_MIN_R = 60;
var GROUND_MAX_R = 170;
var AIM_SPREAD = 130;      // dispersion des points de visée autour de la météorite (descent)

// ---------- ondes de choc sphériques (v10) ----------
var burstGroup = null;     // T.Group ajouté à la scène (coquilles + anneaux)
var bursts = [];           // {shell, shellMat, rings:[{mesh,mat,delay}], light, age, life, maxR}
var burstSceneBound = false;

// v14 : couches dévastatrices.
var streakGeo = null;      // géométrie partagée des traînées radiales
var streakUp = null;       // vecteur +Y (orientation des traînées)
// v17 : ANNEAUX CÉLESTES — sur 'meteor:hit', la colonne d'énergie de
// l'impact perfore le ciel : des anneaux horizontaux géants naissent haut
// au-dessus du Point Zéro, s'élargissent en montant puis s'éteignent.
// Visuel DISTINCT de 'shockwave:burst' (centré au sol) : ceux-ci vivent
// DANS le ciel — pas de doublon (réconciliation v10 respectée).
var celestGroup = null;
var celestRings = [];      // {mesh, mat, age, y0, maxR, rise}
var CELEST_N = 5;
// Courbe en crescendo des 7 temps (même courbe que les temps de
// destruction v13 : 0.32 -> 0.77) — le flash du strike la suit.
function beatCrescendo14(i) { return 0.32 + i * 0.075; }
// v15 : chaque temps frappe VISUELLEMENT plus fort — la courbe 0.32 -> 0.77
// est amplifiée (x1.6 : 0.51 -> 1.23) pour la lumière et les pulsations.
// (beatCrescendo14 est conservée telle quelle : l'audio suit sa courbe.)
function beatCrescendo15(i) { return beatCrescendo14(i) * 1.6; }
// Hauteur du sol sous un point (pour l'onde au sol) ; repli : centre.
function groundYShock(x, z) {
  try {
    if (root.AZSim && typeof root.AZSim.heightAt === 'function') {
      var h = root.AZSim.heightAt(x, z);
      if (isFinite(h)) return h;
    }
  } catch (e) { /* repli */ }
  var c = api ? api.center : null;
  return (c && isFinite(c.y)) ? c.y : 0;
}

// v16 (cohérence spectacle) : ANTICIPATION du strike (phase 8) — l'espace
// autour du Point Zéro "respire" avant la frappe : un halo bleu qui
// s'INSPIRE (se resserre et s'intensifie) à mesure que la fusée n°1 plonge.
// La frappe réelle ('rocket:impact' -> 'shockwave:burst' émis par
// event-rockets.js) prend le relais : pas de doublon, ajout uniquement.
// Pilote : bus 'phase:strike' / 'rocket:impact' + repli d'état dans
// update() ; durées relatives à la phase (tState), jamais en dur.
var anticip = null;       // {group, ring, ringMat, ring2, ring2Mat, shell, shellMat, age}
var anticipDone = false;  // frappe déjà passée (pas de réapparition)
var anticipFade = -1;     // dissolution rapide à l'impact (-1 = inactif)
var STRIKE_IMPACT_TS = 9; // miroir de event-rockets.js : CONTACT à ts≈9 (relatif à la phase)
var _azp = null;          // vecteur temporaire (position du Point Zéro)

// v21 — PROPULSION DU JOUEUR (visuel uniquement : la mécanique vit dans
// event-player.js, ici on ne fait QUE du visuel) : au kick
// 'rocket:zeroshock' — FLASH de départ, ANNEAU DE CHOC au décollage, puis
// TRAÎNÉE lumineuse qui suit le joueur tant qu'il vole
// (AZEvent.playerInfo.mode === 'zeroshock', publié par event-player.js).
var zsTrail = null;      // quad du sillage du joueur
var zsTrailMat = null;
var zsTrailTex = null;   // texture dégradée partagée (créée paresseusement)
var zsPrev = null;       // position précédente du joueur (Vector3)
var _zsDir = null, _zsN = null, _zsY = null, _zsM = null, _zsMid = null;
var _zsUp = null, _zsX = null;

function zsTrailTexture() {
  if (zsTrailTex) return zsTrailTex;
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 16;
  var ctx = cv.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(190,230,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 16);
  zsTrailTex = new T.CanvasTexture(cv);
  return zsTrailTex;
}

function zsEnsureTemps() {
  if (_zsM) return;
  _zsDir = new T.Vector3(); _zsN = new T.Vector3(); _zsY = new T.Vector3();
  _zsM = new T.Matrix4(); _zsMid = new T.Vector3();
  _zsUp = new T.Vector3(0, 1, 0); _zsX = new T.Vector3(1, 0, 0);
}

// Le kick vient d'avoir lieu : FLASH + anneau de choc au décollage +
// amorçage de la traînée (positions lues dans AZEvent.playerInfo).
function zeroShockFx() {
  if (disposed || !api || !T) return;
  if (!root.AZEvent.active) return;
  try {
    var PI = root.AZEvent.playerInfo;
    var c = api.center || { x: 0, y: 30, z: 0 };
    var px = (PI && isFinite(PI.x)) ? PI.x : c.x;
    var py = (PI && isFinite(PI.y)) ? PI.y : c.y + 30;
    var pz = (PI && isFinite(PI.z)) ? PI.z : c.z;
    var pp = { x: px, y: py, z: pz };
    var fx = (root.AZEvent && root.AZEvent.fx) || null;
    if (fx) {
      // FLASH de départ : gerbe ascendante + halo qui claque.
      if (fx.sparkJet) fx.sparkJet(pp, {
        count: 40, dir: { x: 0, y: 1, z: 0 }, spread: 0.5,
        speed: 170, color: 0xeaf6ff, size: 7, life: 0.9, gravity: 60
      });
      if (fx.halo) fx.halo(pp, {
        anticip: 0.12, dur: 0.5, radius: 130, color: 0xd6ecff, y: 2
      });
    }
    // ANNEAU DE CHOC au décollage, À L'ALTITUDE du joueur (vague rapide).
    var lowQzs = !!(api && (api.quality === 'low' || api.isMobile));
    fireGroundWave(px, py, pz, 150, 0xffffff, lowQzs, py);
    // v22 — SOUFFLE : la détonation souffle vers le bas et l'extérieur
    // (l'air est chassé du point de décollage), + 2e anneau + halo large
    // (le décollage se SENT, pas seulement se voit). Visuel uniquement :
    // la mécanique vit dans event-player.js.
    if (fx && fx.sparkJet) fx.sparkJet(pp, {
      count: lowQzs ? 12 : 30, dir: { x: 0, y: -0.45, z: 0 }, spread: 1.2,
      speed: 230, color: 0x9fd0ff, size: 7, life: 0.7, gravity: 0
    });
    fireGroundWave(px, py, pz, 260, 0x9fd0ff, lowQzs, py);
    if (fx && fx.halo) fx.halo(pp, {
      anticip: 0.08, dur: 0.6, radius: 220, color: 0xbfe8ff, y: 2
    });
    // TRAÎNÉE : le sillage naît au point de décollage.
    zsEnsureTemps();
    if (!zsPrev) zsPrev = new T.Vector3();
    zsPrev.set(px, py, pz);
    if (!zsTrail) {
      zsTrailMat = new T.MeshBasicMaterial({
        map: zsTrailTexture(), color: 0xd6ecff, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide
      });
      zsTrail = new T.Mesh(new T.PlaneGeometry(1, 1), zsTrailMat);
      zsTrail.frustumCulled = false;
      zsTrail.visible = false;
      if (burstGroup) burstGroup.add(zsTrail);
      else { var sc0 = api.scene(); if (sc0) sc0.add(zsTrail); }
    }
  } catch (e) { /* le visuel ne casse jamais la propulsion */ }
}

// La traînée suit le joueur tant qu'il vole (mode 'zeroshock').
// Zéro allocation par frame (temps pré-alloués).
function updateZeroShockTrail(dt) {
  if (!zsTrail || !zsPrev) return;
  var PI = root.AZEvent.playerInfo;
  var flying = !!(PI && PI.mode === 'zeroshock' && root.AZEvent.active);
  if (!flying) { zsTrail.visible = false; return; }
  try {
    _zsDir.set(PI.x - zsPrev.x, PI.y - zsPrev.y, PI.z - zsPrev.z);
    var len = _zsDir.length();
    var speed = dt > 0 ? len / dt : 0;
    if (len < 0.5 || speed < 4) {
      zsTrail.visible = false;
    } else {
      zsTrail.visible = true;
      _zsDir.multiplyScalar(1 / len);
      _zsN.crossVectors(_zsDir, Math.abs(_zsDir.y) > 0.94 ? _zsX : _zsUp).normalize();
      _zsY.crossVectors(_zsN, _zsDir).normalize();
      _zsM.makeBasis(_zsDir, _zsY, _zsN);
      zsTrail.quaternion.setFromRotationMatrix(_zsM);
      var trailLen = Math.min(len * 2.4, 60);
      _zsMid.set((PI.x + zsPrev.x) / 2, (PI.y + zsPrev.y) / 2, (PI.z + zsPrev.z) / 2);
      zsTrail.position.copy(_zsMid).addScaledVector(_zsDir, -trailLen * 0.22);
      zsTrail.scale.set(trailLen, 3.2, 1);
      zsTrailMat.opacity = Math.min(0.8, speed / 200);
    }
    // v22 : le joueur SÈME DES ÉTINCELLES pendant son vol (le sillage
    // scintille — on suit sa trajectoire à l'œil). Visuel uniquement.
    zsSparkT += dt;
    if (zsSparkT > 0.35) {
      zsSparkT = 0;
      var fxz = (root.AZEvent && root.AZEvent.fx) || null;
      var lowQfly = !!(api && (api.quality === 'low' || api.isMobile));
      if (fxz && fxz.sparkJet && PI) fxz.sparkJet({ x: PI.x, y: PI.y, z: PI.z },
        { count: lowQfly ? 4 : 8, dir: { x: 0, y: -0.2, z: 0 }, spread: 1.0,
          speed: 60, color: 0xd6ecff, size: 5, life: 0.6, gravity: 30 });
    }
    zsPrev.set(PI.x, PI.y, PI.z);
  } catch (e) { /* jamais bloquant */ }
}

function killZeroShockTrail() {
  if (zsTrail) {
    try {
      if (zsTrail.parent) zsTrail.parent.remove(zsTrail);
      if (zsTrail.geometry) zsTrail.geometry.dispose();
      if (zsTrailMat) zsTrailMat.dispose();
    } catch (e) { /* ignore */ }
    zsTrail = null; zsTrailMat = null;
  }
  if (zsTrailTex) { try { zsTrailTex.dispose(); } catch (e) { /* ignore */ } zsTrailTex = null; }
  zsPrev = null;
  zsSparkT = 0; // v22 : minuteur des étincelles du vol
  _zsDir = _zsN = _zsY = _zsM = _zsMid = null;
  _zsUp = _zsX = null;
}

function zeroPointNow16(out) {
  var zp = root.AZEvent.zeroPointPos; // publié live par event-zeropoint.js
  if (zp && typeof zp.x === 'number' && isFinite(zp.x)) return out.set(zp.x, zp.y, zp.z);
  var c = api ? api.center : null;
  if (c) return out.set(c.x, c.y + 25, c.z);
  return out.set(0, 25, 0);
}

function startStrikeAnticip() {
  if (disposed || !api || !T || anticip || anticipDone) return;
  if (!root.AZEvent.active) return;
  if (!_azp) _azp = new T.Vector3();
  zeroPointNow16(_azp);
  // Le groupe d'ondes existe déjà (créé par fireBurst) ou est créé ici.
  if (!burstGroup) {
    burstGroup = new T.Group();
    burstGroup.name = 'azevent-shockbursts';
  }
  if (!burstSceneBound) {
    var sc = null;
    try { sc = api.scene(); } catch (e) { sc = null; }
    if (sc) { sc.add(burstGroup); burstSceneBound = true; }
    else return; // scène pas prête : le repli d'état réessaiera
  }
  var lowQ16 = !!(api && (api.quality === 'low' || api.isMobile));
  var g = new T.Group();
  g.position.copy(_azp);
  var ringMat = new T.MeshBasicMaterial({
    color: 0x9fd0ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
  });
  var ring = new T.Mesh(new T.RingGeometry(0.88, 1.0, lowQ16 ? 40 : 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.frustumCulled = false;
  g.add(ring);
  var ring2Mat = new T.MeshBasicMaterial({
    color: 0xeaf4ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
  });
  var ring2 = new T.Mesh(new T.RingGeometry(0.93, 1.0, lowQ16 ? 32 : 56), ring2Mat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.rotation.y = 0.7;
  ring2.frustumCulled = false;
  g.add(ring2);
  var shellMat = new T.MeshBasicMaterial({
    color: 0x66aaff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
  });
  var shell = new T.Mesh(new T.SphereGeometry(1, lowQ16 ? 20 : 36, lowQ16 ? 14 : 24), shellMat);
  shell.frustumCulled = false;
  g.add(shell);
  // v20 — COLONNE D'ÉNERGIE MONTANTE : pendant que la fusée plonge, un
  // pilier de lumière BLEUE monte du Point Zéro vers le ciel (la frappe
  // « appelle » la fusée) — cause -> effet : la colonne grandit à mesure
  // que le contact approche, l'impact est AMENÉ visuellement.
  var colMat = new T.MeshBasicMaterial({
    color: 0x8fc4ff, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
  });
  var colGeo = new T.CylinderGeometry(1, 1, 1, lowQ16 ? 10 : 18, 1, true);
  colGeo.translate(0, 0.5, 0); // base à l'origine, monte en +Y
  var col = new T.Mesh(colGeo, colMat);
  col.frustumCulled = false;
  g.add(col);
  // v21 — ANNEAUX DE PRESSION : pendant que la fusée plonge, des anneaux
  // descendent du ciel vers le Point Zéro (l'air est « pressé » vers le
  // bas avant la frappe — cause : la plongée, effet : la pression visible).
  var press = [];
  var nPress = lowQ16 ? 2 : 4;
  for (var pqi = 0; pqi < nPress; pqi++) {
    var pmat = new T.MeshBasicMaterial({
      color: 0x9fd0ff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false
    });
    var pmesh = new T.Mesh(new T.RingGeometry(0.9, 1.0, lowQ16 ? 32 : 56), pmat);
    pmesh.rotation.x = -Math.PI / 2;
    pmesh.frustumCulled = false;
    pmesh.visible = false;
    g.add(pmesh);
    press.push({ mesh: pmesh, mat: pmat, off: pqi / nPress });
  }
  burstGroup.add(g);
  anticip = { group: g, ring: ring, ringMat: ringMat,
              ring2: ring2, ring2Mat: ring2Mat,
              shell: shell, shellMat: shellMat, age: 0,
              col: col, colMat: colMat, // v20 : colonne montante
              press: press };          // v21 : anneaux de pression
}

// La frappe a eu lieu : dissolution rapide, l'onde réelle prend le relais.
function killStrikeAnticip() {
  if (anticipDone) return;
  anticipDone = true;
  if (anticip) anticipFade = 0;
}

function updateStrikeAnticip(dt, t) {
  var st = root.AZEvent.state;
  // Repli : phase entrée sans passer par le bus (jamais de temps absolu).
  if (st === 'strike' && !anticip && !anticipDone && !disposed) startStrikeAnticip();
  if (st !== 'strike' && anticip && !anticipDone) killStrikeAnticip(); // sécurité
  if (!anticip) return;
  var A = anticip;
  A.age += dt;
  if (!_azp) _azp = new T.Vector3();
  zeroPointNow16(_azp); // le Point Zéro bouge : on suit sa position live
  A.group.position.copy(_azp);
  var fade = 1;
  if (anticipFade >= 0) {
    anticipFade += dt;
    fade = Math.max(0, 1 - anticipFade / 0.35);
    if (fade <= 0) { disposeAnticip(); return; }
  }
  var ts = root.AZEvent.tState || 0;
  var k = Math.min(1, Math.max(0, ts / STRIKE_IMPACT_TS)); // 0 -> 1 jusqu'au contact
  // INSPIRATION : le halo se RESSERRE et S'INTENSIFIE à mesure que la fusée
  // plonge — la respiration s'accélère vers le contact.
  var breathe = 1 - 0.42 * k;
  breathe *= 1 + 0.055 * Math.sin(t * (5 + 15 * k)) * (1 - 0.4 * k);
  var R = 200 * breathe;
  A.ring.scale.set(R, R, 1);
  A.ring2.scale.set(R * 0.8, R * 0.8, 1);
  A.shell.scale.set(R * 0.55, R * 0.55, R * 0.55);
  A.ring.rotation.z += dt * (0.8 + 2.2 * k);
  A.ring2.rotation.z -= dt * (0.6 + 1.8 * k);
  var pulse = 0.5 + 0.5 * Math.sin(t * (6 + 14 * k));
  A.ringMat.opacity = fade * (0.18 + 0.50 * k) * (0.7 + 0.3 * pulse);
  A.ring2Mat.opacity = fade * (0.12 + 0.40 * k) * (0.7 + 0.3 * pulse);
  A.shellMat.opacity = fade * (0.10 + 0.30 * k) * (0.6 + 0.4 * pulse);
  // v20 — la colonne MONTE à mesure que la fusée plonge (cause -> effet :
  // plus le contact est proche, plus la colonne est haute et brillante).
  if (A.col) {
    var ch = 60 + 640 * k * k;             // 60 -> 700 m
    var cw = 8 + 26 * k;                   // s'épaissit en montant
    A.col.scale.set(cw, ch, cw);
    A.colMat.opacity = fade * (0.10 + 0.55 * k * k) *
      (0.75 + 0.25 * Math.sin(t * (10 + 22 * k)));
    A.col.rotation.y += dt * (0.5 + 2.5 * k);
  }
  // v21 — les ANNEAUX DE PRESSION descendent du ciel (cycle ~2 s) en
  // s'élargissant : l'air est pressé vers le Point Zéro, de plus en plus
  // fort à mesure que le contact approche.
  if (A.press) {
    for (var qpi = 0; qpi < A.press.length; qpi++) {
      var P = A.press[qpi];
      var cyc = (A.age * 0.5 + P.off) % 1;
      P.mesh.position.y = 520 * (1 - cyc);
      var prr = 60 + cyc * 200 * (1 - 0.42 * k);
      P.mesh.scale.set(prr, prr, 1);
      P.mat.opacity = fade * 0.28 * Math.sin(Math.PI * cyc) * (0.4 + 0.6 * k);
      P.mesh.visible = true;
    }
  }
}

function disposeAnticip() {
  if (!anticip) return;
  var A = anticip;
  if (burstGroup) burstGroup.remove(A.group);
  A.ring.geometry.dispose(); A.ringMat.dispose();
  A.ring2.geometry.dispose(); A.ring2Mat.dispose();
  A.shell.geometry.dispose(); A.shellMat.dispose();
  if (A.col) { A.col.geometry.dispose(); A.colMat.dispose(); } // v20
  if (A.press) { // v21 : anneaux de pression
    for (var i = 0; i < A.press.length; i++) {
      A.press[i].mesh.geometry.dispose();
      A.press[i].mat.dispose();
    }
  }
  anticip = null;
  anticipFade = -1;
}

// --- câblage automatique des ondes de choc (v10, groupe E) ---
var destrTimers = [];      // timeouts des 7 temps de destruction (phase 18)
var greatRiftTimer = null; // v16 : minuteur dédié de l'onde de la grande faille

function clearDestructionBeats() {
  for (var i = 0; i < destrTimers.length; i++) {
    try { clearTimeout(destrTimers[i]); } catch (e) { /* ignore */ }
  }
  destrTimers.length = 0;
}

// Position de la GRANDE faille : devant la météorite (repli : le centre).
function greatRiftPos() {
  var AZ = root.AZEvent;
  if (AZ.meteorPos && typeof AZ.meteorPos.x === 'number') {
    return { x: AZ.meteorPos.x, y: AZ.meteorPos.y, z: AZ.meteorPos.z };
  }
  var c = api ? api.center : { x: 0, y: 30, z: 0 };
  return { x: c.x, y: c.y + 200, z: c.z };
}

// 7 temps de destruction (phase 18) : 7 ondes de choc réparties sur la
// DURÉE DE LA PHASE (bornes de TIMELINE, jamais de temps absolus en dur),
// en alternance autour de l'île + un temps au centre.
// v21 — POSITION et SIGNATURE extraites (beatPos/beatOpts) : chaque temps
// a sa personnalité visuelle — lisible UN PAR UN, jamais de boucle.
function beatRadius(k) { return (k === 3) ? 480 : 330 + k * 45; }

function beatPos(k) {
  var c = api ? api.center : { x: 0, y: 30, z: 0 };
  var a = k * (Math.PI * 2 / 7) + 0.4;
  var rr = 120 + k * 22;
  var p = { x: c.x + Math.cos(a) * rr, y: c.y + 30, z: c.z + Math.sin(a) * rr };
  if (k === 3) { p.x = c.x; p.z = c.z; } // 4e temps : au centre
  return p;
}

// v21 — SIGNATURES des 7 temps : chaque temps frappe différemment.
// 0 : anneaux purs — 1 : traînées — 2 : mur de poussière —
// 3 (centre) : LE gros — 4 : double écho — 5 : + réplique retardée —
// 6 : cascade maximale (final).
function beatOpts(k) {
  var o = {
    radius: beatRadius(k), duration: 2.4 + k * 0.22,
    // v16 : palette unifiée — famille BLEU électrique du Point Zéro
    // (l'alternance crème chaud était hors langage).
    color: (k % 2) ? 0xaed6ff : 0xeaf4ff,
    rings: 4, flash: true,
    innerShell: true, hotCore: true, streaks: true,
    groundWave: true, waveFront: true, beatFlash: true
  };
  if (k === 0) { o.rings = 5; o.streaks = false; }            // temps 1 : anneaux purs
  else if (k === 1) { o.rings = 3; }                          // temps 2 : traînées (défaut)
  else if (k === 2) { o.rings = 4; o.dustWall = true; }       // temps 3 : mur de poussière
  else if (k === 3) { o.rings = 6; o.dustWall = true; o.duration = 3.0; } // temps 4 (centre) : LE gros
  else if (k === 4) { o.rings = 4; o.echo2 = true; }         // temps 5 : double écho
  else if (k === 5) { o.rings = 4; o.preRing = true; }        // temps 6 : pré-anneau + réplique retardée (ci-dessous)
  else { o.rings = 6; o.forceCascade = true; o.duration = 3.2; o.preRing = true; } // temps 7 : pré-anneau + cascade maximale
  return o;
}

function scheduleDestructionBeats() {
  if (disposed || !root.AZEvent.active) return;
  clearDestructionBeats();
  var TL = root.AZEvent.TIMELINE || {};
  var b = TL.destruction || [294, 303];
  var dur = Math.max(3, ((b[1] - b[0]) || 9)); // secondes, relatif aux bornes
  for (var i = 0; i < 7; i++) {
    (function (k) {
      var at = (k / 7) * dur * 1000;
      // v21 — PRÉ-TEMPS : 0,5 s AVANT chaque temps, un anneau s'INSPIRE au
      // point du temps (télégraphe lisible : le temps est annoncé, jamais
      // sec). Cause -> effet : l'anneau inspire, PUIS le temps frappe.
      // Le 1er temps frappe à t=0 de la phase : son pré-temps part
      // immédiatement (à la planification, l'état est déjà 'destruction').
      var preAt = (k === 0) ? 0 : Math.max(0, at - 500);
      destrTimers.push(setTimeout(function () {
        if (disposed || !root.AZEvent.active) return;
        if (root.AZEvent.state !== 'destruction') return; // phase quittée : annulé
        try {
          var fx0 = (root.AZEvent && root.AZEvent.fx) || null;
          if (fx0 && fx0.halo) fx0.halo(beatPos(k), {
            anticip: 0.5, dur: 0.35, radius: beatRadius(k) * 1.05,
            color: 0xcfe8ff, y: 4
          });
        } catch (e) { /* jamais bloquant */ }
      }, preAt));
      destrTimers.push(setTimeout(function () {
        if (disposed || !root.AZEvent.active) return;
        if (root.AZEvent.state !== 'destruction') return; // phase quittée : annulé
        var p = beatPos(k);
        // v13 : CRESCENDO — chaque temps frappe plus fort que le précédent
        // (rayon, durée et force bus croissants vers le 7e temps).
        // v15 : CRESCENDO VISUEL — chaque temps frappe plus fort
        // (rayon, durée, anneaux et couches croissants vers le 7e temps).
        // v21 : SIGNATURE par temps (beatOpts) — chacun est reconnaissable.
        fireBurst(p, beatOpts(k));
        // v21 — TEMPS 6 : second souffle — une RÉPLIQUE retardée (+0,4 s,
        // plus petite, sans flash) : le temps « rebondit ».
        if (k === 5) scheduleBurst(0.4, p, {
          radius: 260, duration: 1.8, color: 0x9fd0ff, rings: 3,
          flash: false, innerShell: true, hotCore: false, streaks: false,
          groundWave: true, waveFront: false, beatFlash: false,
          airShimmer: false, dustWall: false
        });
        try { api.emit('shockwave', { force: 0.32 + k * 0.075, pos: p, beat: k + 1 }); } catch (e) { /* ignore */ } // v22 : le numéro du temps (signature sonore)
      }, at));
    })(i);
  }
}

function easeOutBurst(p) { p = p < 0 ? 0 : (p > 1 ? 1 : p); return 1 - Math.pow(1 - p, 3); }

// v12 : overshoot franc (la coquille "claque" puis se pose).
function easeOutBack12(p) {
  p = p < 0 ? 0 : (p > 1 ? 1 : p);
  var c1 = 1.20158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

// Déclenche une onde de choc sphérique. pos : {x,y,z} (Vector3 accepté).
// opts : {radius, duration, color, rings, flash, ringTilt} (voir en-tête).
function fireBurst(pos, opts) {
  if (disposed || !api || !T) return;
  if (!pos || typeof pos.x !== 'number') return;
  opts = opts || {};
  var maxR = (typeof opts.radius === 'number' && opts.radius > 0) ? opts.radius : 500;
  var life = (typeof opts.duration === 'number' && opts.duration > 0) ? opts.duration : 2.8;
  var color = (typeof opts.color === 'number') ? opts.color : 0xbfe6ff;
  var nRings = Math.max(1, Math.min(8, Math.round(opts.rings) || 3));
  var useFlash = opts.flash !== false;
  var ringTilt = opts.ringTilt !== false;
  // v14 : couches dévastatrices (activées par défaut, même sans opts).
  var lowQ = !!(api && (api.quality === 'low' || api.isMobile));
  var wantInner = opts.innerShell !== false;
  var wantStreaks = opts.streaks !== false;
  var wantGround = opts.groundWave !== false;
  var wantBeatFlash = opts.beatFlash !== false;

  if (!burstGroup) {
    burstGroup = new T.Group();
    burstGroup.name = 'azevent-shockbursts';
  }
  if (!burstSceneBound) {
    var sc = null;
    try { sc = api.scene(); } catch (e) { sc = null; }
    if (sc) { sc.add(burstGroup); burstSceneBound = true; }
    else return; // scène pas encore prête : on réessaiera au prochain burst
  }

  var g = new T.Group();
  g.position.set(pos.x, pos.y, pos.z);

  // Coquille sphérique expansive (visible de partout : DoubleSide).
  var shellMat = new T.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0.55,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var shell = new T.Mesh(new T.SphereGeometry(1, lowQ ? 24 : 48, lowQ ? 16 : 32), shellMat);
  shell.frustumCulled = false;
  g.add(shell);

  // v14 : NOYAU INCANDESCENT — seconde coquille intérieure, plus blanche,
  // qui claque plus vite que la coquille principale (le cœur de l'explosion).
  // v15 : AMPLIFIÉ — plus blanc, plus opaque, rayon plus large.
  var inner = null, innerMat = null;
  if (wantInner) {
    var coreCol = new T.Color(color).lerp(new T.Color(0xffffff), 0.8);
    innerMat = new T.MeshBasicMaterial({
      color: coreCol, transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    inner = new T.Mesh(new T.SphereGeometry(1, lowQ ? 16 : 32, lowQ ? 12 : 24), innerMat);
    inner.frustumCulled = false;
    g.add(inner);
  }

  // v15 : CŒUR CHAUD — sphère blanche pure qui claque EN PREMIER
  // (le flash initial de l'explosion), meurt très tôt.
  var hot = null, hotMat = null;
  var wantHot = opts.hotCore !== false;
  if (wantHot) {
    hotMat = new T.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    hot = new T.Mesh(new T.SphereGeometry(1, lowQ ? 12 : 20, lowQ ? 8 : 16), hotMat);
    hot.frustumCulled = false;
    g.add(hot);
  }

  // v14 : TRAÎNÉES RADIALES — l'énergie fuse dans toutes les directions
  // (faisceaux fins qui partent du centre vers l'extérieur).
  var streakList = [];
  if (wantStreaks) {
    if (!streakUp) streakUp = new T.Vector3(0, 1, 0);
    if (!streakGeo) {
      streakGeo = new T.CylinderGeometry(1, 1, 1, 5, 1, true);
      streakGeo.translate(0, 0.5, 0); // base à l'origine, le long de +Y
    }
    var nStreak = lowQ ? 14 : 44; // v15 : traînées plus nombreuses (mobile réduit)
    for (var si = 0; si < nStreak; si++) {
      var sd = new T.Vector3(
        Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (sd.lengthSq() < 0.01) sd.set(0, 1, 0);
      sd.normalize();
      var smat = new T.MeshBasicMaterial({
        color: (si % 3 === 0) ? 0xffffff : color, transparent: true, opacity: 0.85,
        blending: T.AdditiveBlending, depthWrite: false, fog: false
      });
      var smesh = new T.Mesh(streakGeo, smat);
      smesh.quaternion.setFromUnitVectors(streakUp, sd);
      smesh.frustumCulled = false;
      g.add(smesh);
      streakList.push({ mesh: smesh, mat: smat, dir: sd,
                        delay: Math.random() * 0.18, w: 0.7 + Math.random() * 2.0 }); // v15 : plus épaisses
    }
  }

  // v14 : ONDE AU SOL — un anneau plat balaie le sol sous l'explosion
  // (la déflagration "touche terre"), avec un second anneau en écho.
  var ground = null, ground2 = null, ground3 = null, front = null; // v15
  if (wantGround) {
    var gy = groundYShock(pos.x, pos.z);
    var gmat = new T.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var gmesh = new T.Mesh(new T.RingGeometry(0.86, 1.0, lowQ ? 48 : 96), gmat);
    gmesh.rotation.x = -Math.PI / 2;
    gmesh.position.set(0, (gy + 1.5) - pos.y, 0); // coordonnées locales
    gmesh.visible = false;
    gmesh.frustumCulled = false;
    g.add(gmesh);
    ground = { mesh: gmesh, mat: gmat };
    if (!lowQ) {
      var g2mat = new T.MeshBasicMaterial({
        color: 0xbfe0ff, transparent: true, opacity: 0, // v16 : unifié bleu (était chaud)
        blending: T.AdditiveBlending, depthWrite: false,
        side: T.DoubleSide, fog: false
      });
      var g2mesh = new T.Mesh(new T.RingGeometry(0.9, 1.0, 64), g2mat);
      g2mesh.rotation.x = -Math.PI / 2;
      g2mesh.position.set(0, (gy + 2.5) - pos.y, 0);
      g2mesh.visible = false;
      g2mesh.frustumCulled = false;
      g.add(g2mesh);
      ground2 = { mesh: g2mesh, mat: g2mat };
      // v15 : SECOND ÉCHO (desktop) — troisième anneau retardé.
      if (opts.echo2 !== false) {
        var g3mat = new T.MeshBasicMaterial({
          color: 0x9fd0ff, transparent: true, opacity: 0, // v16 : unifié bleu (était chaud)
          blending: T.AdditiveBlending, depthWrite: false,
          side: T.DoubleSide, fog: false
        });
        var g3mesh = new T.Mesh(new T.RingGeometry(0.92, 1.0, 64), g3mat);
        g3mesh.rotation.x = -Math.PI / 2;
        g3mesh.position.set(0, (gy + 3.5) - pos.y, 0);
        g3mesh.visible = false;
        g3mesh.frustumCulled = false;
        g.add(g3mesh);
        ground3 = { mesh: g3mesh, mat: g3mat };
      }
    }
    // v15 : FRONT LUMINEUX — anneau fin et très brillant qui surfe sur le
    // bord d'attaque de l'onde au sol (la déflagration "brûle" le sol).
    if (opts.waveFront !== false) {
      var fmat = new T.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false,
        side: T.DoubleSide, fog: false
      });
      var fmesh = new T.Mesh(new T.RingGeometry(0.94, 1.0, lowQ ? 48 : 96), fmat);
      fmesh.rotation.x = -Math.PI / 2;
      fmesh.position.set(0, (gy + 1.2) - pos.y, 0);
      fmesh.visible = false;
      fmesh.frustumCulled = false;
      g.add(fmesh);
      front = { mesh: fmesh, mat: fmat };
    }
  }

  // v21 : MUR DE POUSSIÈRE — au bord d'attaque de l'onde, un mur
  // cylindrique soulève la poussière et l'air (la déflagration « touche
  // terre » en volume, pas seulement en anneau plat). Rayon >= 400 m,
  // désactivable via opts.dustWall:false, jamais sur mobile (perf).
  var dust = null, dustMat = null;
  var wantDust = opts.dustWall !== false && maxR >= 400 && !lowQ;
  if (wantDust) {
    try {
      var gyD = groundYShock(pos.x, pos.z);
      dustMat = new T.MeshBasicMaterial({
        color: new T.Color(color).lerp(new T.Color(0xffffff), 0.4),
        transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false,
        side: T.DoubleSide, fog: false
      });
      dust = new T.Mesh(new T.CylinderGeometry(1, 1, 0.16, 48, 1, true), dustMat);
      dust.position.set(0, (gyD + 14) - pos.y, 0); // coordonnées locales
      dust.frustumCulled = false;
      dust.visible = false;
      g.add(dust);
    } catch (e) { dust = null; dustMat = null; }
  }

  // v21 : MIROITEMENT DE L'AIR — coquille fantôme qui ondule DEVANT l'onde
  // principale (l'air se déforme avant d'être frappé). Très discrète,
  // désactivable via opts.airShimmer:false.
  var shim = null, shimMat = null;
  if (opts.airShimmer !== false) {
    try {
      shimMat = new T.MeshBasicMaterial({
        color: 0xd6ecff, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false,
        side: T.DoubleSide, fog: false
      });
      shim = new T.Mesh(new T.SphereGeometry(1, lowQ ? 16 : 28, lowQ ? 10 : 18), shimMat);
      shim.frustumCulled = false;
      shim.visible = false;
      g.add(shim);
    } catch (e) { shim = null; shimMat = null; }
  }

  // Anneaux multiples (orientations variées : l'onde part dans TOUTES
  // les directions, pas seulement à l'horizontale).
  var rings = [];
  for (var i = 0; i < nRings; i++) {
    var rmat = new T.MeshBasicMaterial({
      color: (i % 2 === 0) ? color : 0xffffff, transparent: true, opacity: 0.7,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var rmesh = new T.Mesh(new T.TorusGeometry(1, 0.018, 8, 96), rmat);
    rmesh.frustumCulled = false;
    if (ringTilt) {
      // Éventail d'orientations : horizontal, vertical, inclinés.
      rmesh.rotation.set(
        (i % 3 === 0) ? Math.PI / 2 : (i * 0.7),
        i * 1.1,
        (i % 2 === 0) ? 0 : 0.5
      );
    } else {
      rmesh.rotation.x = Math.PI / 2;
    }
    g.add(rmesh);
    rings.push({ mesh: rmesh, mat: rmat, delay: i * 0.12, ratio: 0.65 + 0.35 * (i / Math.max(1, nRings - 1)) });
  }

  // Éclair lumineux au centre.
  var light = null;
  if (useFlash) {
    light = new T.PointLight(color, 40, maxR * 8, 1.7);
    g.add(light);
  }

  burstGroup.add(g);
  bursts.push({ group: g, shell: shell, shellMat: shellMat,
                rings: rings, light: light, age: 0, life: life, maxR: maxR,
                inner: inner, innerMat: innerMat,   // v14 : noyau incandescent
                hot: hot, hotMat: hotMat,           // v15 : cœur chaud
                front: front,                       // v15 : front lumineux au sol
                ground3: ground3,                   // v15 : second écho
                dust: dust, dustMat: dustMat,       // v21 : mur de poussière
                shim: shim, shimMat: shimMat,       // v21 : miroitement de l'air
                streakList: streakList,            // v14 : traînées radiales
                ground: ground, ground2: ground2,  // v14 : onde au sol
                beatFlash: wantBeatFlash });       // v14 : flash 7 temps

  // v21 — FRONT DE PRESSION : sur les impacts MAJEURS, un anneau fin et
  // rapide DEVANCE la coquille — on SENT l'onde arriver avant le choc.
  // v22 : DOUBLE précurseur sur les majeurs (deux anneaux à vitesses
  // différentes — l'onde arrive en deux temps) ; les temps ciblés
  // (opts.preRing) ont aussi leur pré-anneau.
  if (maxR >= 900 && opts.precursor !== false) {
    firePrecursorRing(pos.x, pos.y, pos.z, maxR * 1.3, 0xd6ecff, lowQ, Math.min(1.8, life * 0.55));
    firePrecursorRing(pos.x, pos.y, pos.z, maxR * 1.12, 0x9fd0ff, lowQ, Math.min(1.1, life * 0.35));
  } else if (opts.preRing) {
    firePrecursorRing(pos.x, pos.y, pos.z, maxR * 1.2, 0xcfe8ff, lowQ, 1.2);
  }
  // v22 — SECOND SOUFFLE : sur les impacts MAJEURS, une seconde onde
  // (x0.75) frappe +2,2 s après — l'explosion « rebondit », jamais de
  // coupure nette. Pas de récursion (secondBreath:false).
  if (maxR >= 900 && opts.secondBreath !== false) {
    scheduleBurst(2.2, { x: pos.x, y: pos.y, z: pos.z }, {
      radius: maxR * 0.75, duration: 2.0, color: color, rings: 4,
      flash: false, innerShell: true, hotCore: false, streaks: false,
      groundWave: true, waveFront: false, beatFlash: false,
      airShimmer: false, dustWall: false, precursor: false, secondBreath: false
    });
  }

  // v20 — CASCADE DE VAGUES D'ÉNERGIE AU SOL : sur les impacts MAJEURS
  // (rayon >= 900 m : contact fusée/Point Zéro, explosion phase 14), la
  // déflagration se propage en vagues CONCENTRIQUES retardées (+0,45 s et
  // +0,95 s, rayons croissants) — l'onde ne s'éteint pas d'un coup, elle
  // roule sur l'île en échos successifs (cause : l'explosion, effet : le
  // sol qui ondule en cercles). Désactivable via opts.groundCascade:false.
  // v21 : 3e vague (+1,6 s, encore plus large) + ÉCHO retardé (+0,7 s) sur
  // TOUTES les ondes >= 250 m (forceCascade permet de forcer la cascade
  // sur un temps de destruction ciblé).
  var cascadeOn = (maxR >= 900 || opts.forceCascade === true) && opts.groundCascade !== false;
  if (cascadeOn) {
    var lowQ20 = lowQ;
    delayedWaves.push({ t: -0.45, pos: { x: pos.x, y: pos.y, z: pos.z },
                        radius: maxR * 1.45, color: 0xd8ecff, lowQ: lowQ20 });
    delayedWaves.push({ t: -0.95, pos: { x: pos.x, y: pos.y, z: pos.z },
                        radius: maxR * 1.95, color: 0x9fd0ff, lowQ: lowQ20 });
    delayedWaves.push({ t: -1.6, pos: { x: pos.x, y: pos.y, z: pos.z },
                        radius: maxR * 2.5, color: 0x7fb8ff, lowQ: lowQ20,
                        soft: 0.6 }); // v21 : 3e vague, plus large, plus douce
  } else if (maxR >= 250 && opts.groundWave !== false) {
    // v21 : même les ondes moyennes laissent un écho retardé.
    delayedWaves.push({ t: -0.7, pos: { x: pos.x, y: pos.y, z: pos.z },
                        radius: maxR * 1.35, color: 0xbfe0ff, lowQ: lowQ,
                        soft: 0.45 });
  }
}

// v20 — VAGUE D'ÉNERGIE AU SOL autonome (anneau plat qui balaie le sol) :
// utilisée par la cascade ci-dessus. Pool léger (listes, mesh libéré à la
// fin) — pas de système permanent.
var groundWaves = [];   // {mesh, mat, age, life, maxR}
var delayedWaves = [];  // {t (négatif = en attente), pos, radius, color, lowQ}

// v22 — garantit que le groupe des ondes existe (création paresseuse :
// 'rocket:impact' peut frapper avant le premier 'shockwave:burst').
function ensureBurstGroup() {
  if (burstGroup) return true;
  try {
    burstGroup = new T.Group();
    burstGroup.name = 'azevent-shockbursts';
    var sc = api.scene();
    if (sc) { sc.add(burstGroup); burstSceneBound = true; return true; }
  } catch (e) { /* ignore */ }
  return false;
}

// v21 : atY (optionnel) force l'altitude de l'anneau (décollage du joueur
// en l'air) ; sinon l'anneau balaie le sol (gy + 2).
function fireGroundWave(px, py, pz, radius, color, lowQ, atY) {
  if (disposed || !api || !T) return;
  if (!ensureBurstGroup()) return;
  var gy = groundYShock(px, pz);
  var mat = new T.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var mesh = new T.Mesh(new T.RingGeometry(0.86, 1.0, lowQ ? 48 : 96), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(px, (atY !== undefined && isFinite(atY)) ? atY : (gy + 2), pz);
  mesh.frustumCulled = false;
  mesh.visible = false;
  burstGroup.add(mesh);
  groundWaves.push({ mesh: mesh, mat: mat, age: 0, life: 2.2, maxR: radius });
}

function updateGroundWaves(dt) {
  // Retards : les vagues retardées partent à t >= 0.
  for (var d = delayedWaves.length - 1; d >= 0; d--) {
    var dw = delayedWaves[d];
    dw.t += dt;
    if (dw.t >= 0) {
      fireGroundWave(dw.pos.x, dw.pos.y, dw.pos.z, dw.radius, dw.color, dw.lowQ);
      delayedWaves.splice(d, 1);
    }
  }
  for (var i = groundWaves.length - 1; i >= 0; i--) {
    var w = groundWaves[i];
    w.age += dt;
    var k = w.age / w.life;
    if (k >= 1) {
      burstGroup.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mat.dispose();
      groundWaves.splice(i, 1);
      continue;
    }
    // Expansion ease-out (la vague « roule » vite puis s'étale), double
    // flash au départ : l'anneau claque avant de partir.
    // v21 : pre (précurseur) -> opacité faible ; soft -> profil adouci.
    var e = easeOutBurst(k);
    var sc = Math.max(1, e * w.maxR);
    w.mesh.scale.set(sc, sc, 1);
    var lead = (k < 0.12) ? (0.6 + 0.4 * Math.sin(k / 0.12 * Math.PI * 2)) : 1;
    var baseOp = w.pre ? 0.32 : 0.8;
    w.mat.opacity = baseOp * (w.soft || 1) * Math.pow(1 - k, 1.4) * lead;
    w.mesh.visible = true;
  }
}

function clearGroundWaves() {
  for (var i = 0; i < groundWaves.length; i++) {
    if (burstGroup) burstGroup.remove(groundWaves[i].mesh);
    groundWaves[i].mesh.geometry.dispose();
    groundWaves[i].mat.dispose();
  }
  groundWaves.length = 0;
  delayedWaves.length = 0;
}

// v21 — RAFALES RETARDÉES : file d'ondes de choc programmées (second
// souffle d'un temps de destruction, écho d'un impact). {t (négatif =
// en attente), pos, opts}. Plafond 6 — jamais d'emballement.
var delayedBursts = [];
var DELAYED_MAX = 6;
// v22 — DÔMES DE PRESSION : hémisphères qui S'ÉCRASENT vers le sol
// (l'air est « pressé ») — distincts des coquilles expansives.
var pressDomes = []; // {mesh, mat, age, life, r0, y0}
var zsSparkT = 0;    // v22 : minuteur des étincelles semées pendant le vol du joueur
function scheduleBurst(delay, pos, opts) {
  if (disposed || !(delay >= 0) || !pos || typeof pos.x !== 'number') return;
  if (delayedBursts.length >= DELAYED_MAX) delayedBursts.shift();
  delayedBursts.push({ t: -delay, pos: { x: pos.x, y: pos.y, z: pos.z }, opts: opts || {} });
}
function updateDelayedBursts(dt) {
  for (var i = delayedBursts.length - 1; i >= 0; i--) {
    var d = delayedBursts[i];
    d.t += dt;
    if (d.t >= 0) {
      try { fireBurst(d.pos, d.opts); } catch (e) { /* jamais bloquant */ }
      delayedBursts.splice(i, 1);
    }
  }
}
function clearDelayedBursts() { delayedBursts.length = 0; }

// v21 — FRONT DE PRESSION PRÉCURSEUR : anneau fin, rapide et discret qui
// DEVANCE la coquille principale sur les impacts majeurs — on SENT l'onde
// arriver avant qu'elle ne frappe. Réutilise la file des vagues au sol
// (même cycle de vie), vie courte, opacité faible.
function firePrecursorRing(px, py, pz, radius, color, lowQ, life) {
  if (disposed || !api || !T) return;
  if (!ensureBurstGroup()) return;
  var gy = groundYShock(px, pz);
  var mat = new T.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false,
    side: T.DoubleSide, fog: false
  });
  var mesh = new T.Mesh(new T.RingGeometry(0.93, 1.0, lowQ ? 48 : 96), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(px, gy + 2.5, pz);
  mesh.frustumCulled = false;
  mesh.visible = false;
  burstGroup.add(mesh);
  // pre:true -> opacité faible ; soft:1 -> profil standard.
  groundWaves.push({ mesh: mesh, mat: mat, age: 0, life: life || 1.6,
                     maxR: radius, pre: true });
}

// v22 — DÔME DE PRESSION : au strike de la fusée n°1, un hémisphère de
// lumière BLEUE S'ÉCRASE vers le sol (il descend ET s'aplatit — l'air est
// « pressé »). Visuel DISTINCT de la coquille expansive du burst (qui
// monte et s'étend) : celui-ci se contracte et s'enfonce. Pas de doublon,
// un complément. Création à l'événement, animation sans allocation.
function firePressureDome(x, y, z) {
  if (disposed || !api || !T) return;
  if (!ensureBurstGroup()) return;
  try {
    var lowQp = !!(api && (api.quality === 'low' || api.isMobile));
    var mat = new T.MeshBasicMaterial({
      color: 0x9fd0ff, transparent: true, opacity: 0.32,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var geo = new T.SphereGeometry(1, lowQp ? 20 : 36, lowQp ? 10 : 18,
                                   0, Math.PI * 2, 0, Math.PI / 2);
    var mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y + 320, z);
    mesh.frustumCulled = false;
    burstGroup.add(mesh);
    pressDomes.push({ mesh: mesh, mat: mat, age: 0, life: 1.4,
                      r0: 700, y0: y });
    if (pressDomes.length > 4) { // plafond : jamais d'emballement
      var old = pressDomes.shift();
      if (old.mesh.parent) old.mesh.parent.remove(old.mesh);
      old.mesh.geometry.dispose(); old.mat.dispose();
    }
  } catch (e) { /* jamais bloquant */ }
}

function updatePressureDomes(dt) {
  for (var i = pressDomes.length - 1; i >= 0; i--) {
    var d = pressDomes[i];
    d.age += dt;
    var k = d.age / d.life;
    if (k >= 1) {
      if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
      d.mesh.geometry.dispose(); d.mat.dispose();
      pressDomes.splice(i, 1);
      continue;
    }
    var e = 1 - Math.pow(1 - k, 3); // ease-out : l'écrasement part vite
    var rr = d.r0 * (0.75 + 0.45 * e); // s'élargit en s'écrasant
    d.mesh.scale.set(rr, 420 * (1 - k) + 40, rr); // s'aplatit vers le sol
    d.mesh.position.y = d.y0 + 320 * (1 - e); // descend et « presse »
    d.mat.opacity = 0.32 * (1 - k) * (1 - k);
  }
}

function clearPressureDomes() {
  for (var i = 0; i < pressDomes.length; i++) {
    var d = pressDomes[i];
    if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
    d.mesh.geometry.dispose(); d.mat.dispose();
  }
  pressDomes.length = 0;
}

function updateBursts(dt) {
  updateGroundWaves(dt); // v20 : cascade de vagues d'énergie au sol
  updateDelayedBursts(dt); // v21 : rafales retardées (second souffle)
  updatePressureDomes(dt); // v22 : dômes de pression qui s'écrasent
  for (var i = bursts.length - 1; i >= 0; i--) {
    var b = bursts[i];
    b.age += dt;
    var k = b.age / b.life;
    if (k >= 1) {
      // Fin : on retire et on libère tout.
      burstGroup.remove(b.group);
      b.shell.geometry.dispose();
      b.shellMat.dispose();
      // v14 : couches dévastatrices (streakGeo est partagée : libérée dans dispose()).
      if (b.inner) { b.inner.geometry.dispose(); b.innerMat.dispose(); }
      if (b.hot) { b.hot.geometry.dispose(); b.hotMat.dispose(); } // v15
      if (b.front) { b.front.mesh.geometry.dispose(); b.front.mat.dispose(); } // v15
      if (b.ground3) { b.ground3.mesh.geometry.dispose(); b.ground3.mat.dispose(); } // v15
      if (b.dust) { b.dust.geometry.dispose(); b.dustMat.dispose(); } // v21 : mur de poussière
      if (b.shim) { b.shim.geometry.dispose(); b.shimMat.dispose(); } // v21 : miroitement de l'air
      for (var sd2 = 0; sd2 < b.streakList.length; sd2++) b.streakList[sd2].mat.dispose();
      if (b.ground) { b.ground.mesh.geometry.dispose(); b.ground.mat.dispose(); }
      if (b.ground2) { b.ground2.mesh.geometry.dispose(); b.ground2.mat.dispose(); }
      for (var r = 0; r < b.rings.length; r++) {
        b.rings[r].mesh.geometry.dispose();
        b.rings[r].mat.dispose();
      }
      bursts.splice(i, 1);
      continue;
    }
    // v12 : coquille — expansion avec overshoot franc (elle "claque"),
    // fondu en fin de vie.
    var es = easeOutBack12(Math.min(1, k * 1.04)) * b.maxR;
    b.shell.scale.set(es, es, es);
    b.shellMat.opacity = 0.62 * (1 - k) * (1 - k); // v15 : coquille plus dense
    // v14 : NOYAU INCANDESCENT — claque plus vite (vie * 0.55), meurt tôt.
    // v15 : AMPLIFIÉ — plus large, plus blanc.
    if (b.inner) {
      var ie = easeOutBack12(Math.min(1, k / 0.55)) * b.maxR * 0.62;
      b.inner.scale.set(ie, ie, ie);
      var iop = Math.max(0, 1 - k / 0.55);
      b.innerMat.opacity = 0.85 * iop * iop;
      b.inner.visible = k < 0.55;
    }
    // v15 : CŒUR CHAUD — claque EN PREMIER (vie * 0.38), flash blanc initial.
    if (b.hot) {
      var hk = Math.min(1, k / 0.38);
      var he = easeOutBack12(hk) * b.maxR * 0.34;
      b.hot.scale.set(he, he, he);
      b.hotMat.opacity = 0.95 * (1 - hk) * (1 - hk);
      b.hot.visible = k < 0.38;
    }
    // v14 : TRAÎNÉES RADIALES — fusent vers l'extérieur, s'étirent, meurent.
    for (var s3 = 0; s3 < b.streakList.length; s3++) {
      var S = b.streakList[s3];
      var sk = Math.max(0, Math.min(1, (b.age - S.delay) / (b.life * 0.7)));
      var head = easeOutBurst(sk) * b.maxR * 1.3; // v15 : fusent plus loin
      S.mesh.scale.set(S.w, Math.max(0.001, head), S.w);
      S.mat.opacity = 0.9 * (1 - sk) * (1 - sk);
      S.mesh.visible = sk > 0 && sk < 1;
    }
    // v14 : ONDE AU SOL — balaie le sol sous l'explosion (+ écho).
    if (b.ground) {
      var gk = Math.max(0, Math.min(1, b.age / (b.life * 0.9)));
      var gr = easeOutBurst(gk) * b.maxR * 1.25;
      b.ground.mesh.scale.set(gr, gr, 1);
      b.ground.mat.opacity = 0.75 * Math.pow(1 - gk, 1.5);
      b.ground.mesh.visible = gk > 0 && gk < 1;
    }
    if (b.ground2) {
      var gk2 = Math.max(0, Math.min(1, (b.age - 0.18) / (b.life * 0.9)));
      var gr2 = easeOutBurst(gk2) * b.maxR * 1.1;
      b.ground2.mesh.scale.set(gr2, gr2, 1);
      b.ground2.mat.opacity = 0.5 * Math.pow(1 - gk2, 1.5);
      b.ground2.mesh.visible = gk2 > 0 && gk2 < 1;
    }
    // v15 : SECOND ÉCHO — troisième anneau retardé qui balaie le sol.
    if (b.ground3) {
      var gk3 = Math.max(0, Math.min(1, (b.age - 0.34) / (b.life * 0.9)));
      var gr3 = easeOutBurst(gk3) * b.maxR * 1.0;
      b.ground3.mesh.scale.set(gr3, gr3, 1);
      b.ground3.mat.opacity = 0.4 * Math.pow(1 - gk3, 1.5);
      b.ground3.mesh.visible = gk3 > 0 && gk3 < 1;
    }
    // v15 : FRONT LUMINEUX — surfe sur le bord d'attaque de l'onde au sol.
    if (b.front && b.ground) {
      var fk = Math.max(0, Math.min(1, b.age / (b.life * 0.9)));
      var fr = easeOutBurst(fk) * b.maxR * 1.25;
      b.front.mesh.scale.set(fr, fr, 1);
      b.front.mat.opacity = 0.95 * Math.pow(1 - fk, 2.2);
      b.front.mesh.visible = fk > 0 && fk < 1;
    }
    // v21 : MUR DE POUSSIÈRE — suit le bord d'attaque de l'onde au sol
    // (même courbe que l'onde au sol), s'épaissit puis retombe avec elle.
    if (b.dust) {
      var dk = Math.max(0, Math.min(1, b.age / (b.life * 0.9)));
      var dr = easeOutBurst(dk) * b.maxR * 1.25;
      b.dust.scale.set(dr, 1, dr);
      b.dustMat.opacity = 0.5 * Math.pow(1 - dk, 1.8);
      b.dust.visible = dk > 0 && dk < 1;
    }
    // v21 : MIROITEMENT DE L'AIR — coquille fantôme qui ondule LÉGÈREMENT
    // devant la coquille principale (x1.12), scintille et meurt tôt.
    if (b.shim) {
      var shk2 = Math.min(1, k / 0.8);
      var she = easeOutBurst(shk2) * b.maxR * 1.12;
      b.shim.scale.set(she, she, she);
      b.shimMat.opacity = 0.10 * (1 - shk2) *
        (0.6 + 0.4 * Math.sin(b.age * 23));
      b.shim.visible = shk2 > 0 && shk2 < 1;
    }
    // Anneaux : expansion décalée, chacun à son rythme — opacité qui MONTE
    // puis descend (pic au milieu, plus percutant qu'un fondu linéaire),
    // léger overshoot d'expansion.
    for (var r2 = 0; r2 < b.rings.length; r2++) {
      var R = b.rings[r2];
      var rk = Math.max(0, Math.min(1, (b.age - R.delay) / (b.life * 0.85)));
      var rs = easeOutBack12(rk) * b.maxR * R.ratio;
      R.mesh.scale.set(rs, rs, rs);
      R.mat.opacity = 0.85 * Math.sin(Math.PI * Math.min(1, rk));
      R.mesh.visible = rk > 0;
    }
    // v15 : FLASH EN CRESCENDO AMPLIFIÉ — 7 pulsations de plus en plus
    // violentes (courbe 0.51 -> 1.23) : chaque temps visuellement plus fort.
    if (b.light) {
      if (b.beatFlash) {
        var bk = Math.min(6.999, k * 7);
        var bi = Math.floor(bk), bp = bk - bi;
        b.light.intensity = 90 * beatCrescendo15(bi) * Math.exp(-bp * 5) * (1 - k * 0.45);
      } else {
        // Lumière : double décroissance — pic initial violent puis halo qui meurt.
        b.light.intensity = 46 * Math.exp(-k * 7) + 22 * (1 - k) * (1 - k);
      }
    }
  }
}

// v17 : ANNEAUX CÉLESTES — construction (sur 'meteor:hit').
function fireCelestialRings(pos) {
  if (disposed || !api || !T) return;
  if (!pos || typeof pos.x !== 'number') {
    try {
      var zp = root.AZEvent.zeroPointPos;
      if (zp && isFinite(zp.x)) pos = { x: zp.x, y: zp.y, z: zp.z };
      else return;
    } catch (e) { return; }
  }
  clearCelestialRings();
  var sc = null;
  try { sc = api.scene(); } catch (e) { sc = null; }
  if (!sc) return;
  celestGroup = new T.Group();
  celestGroup.name = 'azevent-celestial-rings';
  celestGroup.position.set(pos.x, 0, pos.z);
  sc.add(celestGroup);
  var lowQ = !!(api && (api.quality === 'low' || api.isMobile));
  var n = lowQ ? 3 : CELEST_N;
  for (var i = 0; i < n; i++) {
    var mat = new T.MeshBasicMaterial({
      color: (i % 2 === 0) ? 0xbfe6ff : 0xffffff,
      transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var mesh = new T.Mesh(new T.TorusGeometry(1, 0.012, 8, lowQ ? 48 : 96), mat);
    mesh.rotation.x = Math.PI / 2; // horizontal : l'anneau vit dans le ciel
    mesh.frustumCulled = false;
    mesh.visible = false;
    celestGroup.add(mesh);
    celestRings.push({
      mesh: mesh, mat: mat,
      age: -i * 0.55,              // départ en cascade
      y0: pos.y + 260 + i * 260,   // 260 à 1300 m au-dessus du Point Zéro
      maxR: 500 + i * 260,         // jusqu'à ~1500 m de rayon
      rise: 160 + i * 40           // montée (m/s)
    });
  }
}

// v17 : ANNEAUX CÉLESTES — animation (expansion + montée + fondu doux).
function updateCelestialRings(dt) {
  if (!celestRings.length) return;
  var done = true;
  for (var i = 0; i < celestRings.length; i++) {
    var R = celestRings[i];
    R.age += dt;
    if (R.age < 0) { done = false; continue; }
    var k = Math.min(1, R.age / 7); // ~7 s de vie
    var e = 1 - Math.pow(1 - k, 3); // ease-out franc
    var rr = 60 + e * R.maxR;
    R.mesh.visible = true;
    R.mesh.scale.set(rr, rr, rr);
    R.mesh.position.y = R.y0 + R.age * R.rise;
    // Opacité : montée rapide, pic, extinction douce (jamais de coupure nette).
    R.mat.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, k));
    if (k < 1) done = false;
  }
  if (done) clearCelestialRings();
}

function clearCelestialRings() {
  for (var i = 0; i < celestRings.length; i++) {
    var R = celestRings[i];
    if (R.mesh.parent) R.mesh.parent.remove(R.mesh);
    R.mesh.geometry.dispose();
    R.mat.dispose();
  }
  celestRings.length = 0;
  if (celestGroup) {
    if (celestGroup.parent) celestGroup.parent.remove(celestGroup);
    celestGroup = null;
  }
}

function clearBursts() {
  for (var i = 0; i < bursts.length; i++) {
    var b = bursts[i];
    if (burstGroup) burstGroup.remove(b.group);
    b.shell.geometry.dispose();
    b.shellMat.dispose();
    // v14 : couches dévastatrices (streakGeo partagée : libérée dans dispose()).
    if (b.inner) { b.inner.geometry.dispose(); b.innerMat.dispose(); }
    if (b.hot) { b.hot.geometry.dispose(); b.hotMat.dispose(); } // v15
    if (b.front) { b.front.mesh.geometry.dispose(); b.front.mat.dispose(); } // v15
    if (b.ground3) { b.ground3.mesh.geometry.dispose(); b.ground3.mat.dispose(); } // v15
    if (b.dust) { b.dust.geometry.dispose(); b.dustMat.dispose(); } // v21
    if (b.shim) { b.shim.geometry.dispose(); b.shimMat.dispose(); } // v21
    for (var s2 = 0; s2 < b.streakList.length; s2++) b.streakList[s2].mat.dispose();
    if (b.ground) { b.ground.mesh.geometry.dispose(); b.ground.mat.dispose(); }
    if (b.ground2) { b.ground2.mesh.geometry.dispose(); b.ground2.mat.dispose(); }
    for (var r = 0; r < b.rings.length; r++) {
      b.rings[r].mesh.geometry.dispose();
      b.rings[r].mat.dispose();
    }
  }
  bursts.length = 0;
  if (burstGroup) {
    var sc = null;
    try { sc = api ? api.scene() : null; } catch (e) { sc = null; }
    if (sc) sc.remove(burstGroup);
  }
  burstGroup = null;
  burstSceneBound = false;
}

// ---------- cible ----------
function meteorTarget(out) {
  var AZ = root.AZEvent;
  if (AZ.meteorPos && AZ.meteorPos.clone) {
    out.copy(AZ.meteorPos);
    if (out.y > 0) return out;
  }
  if (AZ.rifts && AZ.rifts.length && AZ.rifts[0] && AZ.rifts[0].pos) {
    out.copy(AZ.rifts[0].pos);
    out.y += 220; // la faille est en l'air : on vise au-dessus
    return out;
  }
  var c = api.center;
  out.set(c.x, c.y + 420, c.z);
  return out;
}

// ---------- construction ----------
function buildLasers() {
  var scene = api.scene();
  if (!scene || laserGroup) return;
  UP = new T.Vector3(0, 1, 0);
  // Cylindre unitaire, base à l'origine : position = pied, scale.y = longueur.
  laserGeo = new T.CylinderGeometry(LASER_RADIUS, LASER_RADIUS, 1, 6, 1, true);
  laserGeo.translate(0, 0.5, 0);

  laserGroup = new T.Group();
  var c = api.center;
  for (var i = 0; i < LASER_COUNT; i++) {
    var a = (i / LASER_COUNT) * Math.PI * 2 + (i * 0.35);
    var rr = GROUND_MIN_R + (GROUND_MAX_R - GROUND_MIN_R) * ((i * 0.618) % 1);
    var base = new T.Vector3(
      c.x + Math.cos(a) * rr,
      c.y + 2,
      c.z + Math.sin(a) * rr
    );
    // Point de visée personnel : dispersé autour de la météorite en descent,
    // converge vers elle en veeroff (via `tight` dans update).
    var aim = new T.Vector3(
      (Math.random() - 0.5) * 2 * AIM_SPREAD,
      (Math.random() - 0.5) * AIM_SPREAD * 0.6,
      (Math.random() - 0.5) * 2 * AIM_SPREAD
    );
    var mat = new T.MeshBasicMaterial({
      color: LASER_COLOR, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false
    });
    var mesh = new T.Mesh(laserGeo, mat);
    mesh.position.copy(base);
    mesh.frustumCulled = false;
    laserGroup.add(mesh);
    lasers.push({ mesh: mesh, mat: mat, base: base, aim: aim, seed: Math.random() * 10 });
  }
  scene.add(laserGroup);
}

function clearLasers() {
  var scene = api ? api.scene() : null;
  if (laserGroup && scene) scene.remove(laserGroup);
  for (var i = 0; i < lasers.length; i++) lasers[i].mat.dispose();
  if (laserGeo) laserGeo.dispose();
  laserGroup = null;
  laserGeo = null;
  lasers.length = 0;
  UP = null;
  mode = 'off';
  tight = 0.25;
  tightTarget = 0.25;
  strikeT = 99;
  fading = false;
  fadeAge = 0;
}

// ---------- entrées de phase ----------
function onPhase(kind) {
  if (disposed || !api) return;
  if (!root.AZEvent.active) return;
  if (kind === 'descent') {
    mode = 'descent';
    tightTarget = 0.25;
    fading = false;
    fadeAge = 0;
    strikeT = 0; // v12 : les faisceaux FRAPPENT le sol en cascade
    buildLasers();
  } else if (kind === 'veeroff') {
    mode = 'veeroff';
    tightTarget = 0.92; // les lasers se resserrent sur la météorite
    fading = false;
    fadeAge = 0;
    strikeT = 0; // v12 : frappe en cascade aussi au resserrement
    buildLasers();
  }
}

function beginFadeOut() {
  if (fading || !laserGroup) { if (!laserGroup) mode = 'off'; return; }
  fading = true;
  fadeAge = 0;
}

// ---------- boucle ----------
var _dir = null;
var _pt = null;

function update(dt, t) {
  if (disposed) return;
  if (!root.AZEvent.active) return;
  if (!dt || dt <= 0) return;

  // Ondes de choc sphériques : indépendantes des lasers (toujours actives).
  updateBursts(dt);

  // v21 : la traînée suit le joueur propulsé (mode 'zeroshock').
  updateZeroShockTrail(dt);

  // v17 : ANNEAUX CÉLESTES (dans le ciel, sur 'meteor:hit').
  updateCelestialRings(dt);

  // v16 : anticipation du strike — l'espace respire avant la frappe.
  updateStrikeAnticip(dt, t);

  // 7 temps de destruction : si la phase est quittée, on annule les temps restants.
  if (destrTimers.length && root.AZEvent.state !== 'destruction') clearDestructionBeats();

  var st = root.AZEvent.state;

  // Repli si un événement de phase a été manqué (jamais de temps absolu).
  if (st === 'descent' && mode !== 'descent') onPhase('descent');
  else if (st === 'veeroff' && mode !== 'veeroff') onPhase('veeroff');
  else if (mode !== 'off' && st !== 'descent' && st !== 'veeroff') beginFadeOut();

  if (!laserGroup) return;
  if (!_dir) { _dir = new T.Vector3(); _pt = new T.Vector3(); }

  // Le resserrement glisse en douceur vers sa cible (relatif au dt).
  tight += (tightTarget - tight) * Math.min(1, dt * 2.2);
  // v12 : frappe des faisceaux — chacun jaillit du sol en cascade.
  strikeT += dt;
  // Fondu de sortie (quand la phase est finie).
  var globalOp = 1;
  if (fading) {
    fadeAge += dt;
    globalOp = Math.max(0, 1 - fadeAge / FADE_LIFE);
    if (globalOp <= 0) { clearLasers(); return; }
  }

  meteorTarget(_pt);
  var spread = 1 - tight; // 0.75 en descent, ~0.08 en veeroff

  for (var i = 0; i < lasers.length; i++) {
    var L = lasers[i];
    // Point de visée : converge vers la météorite à mesure que tight monte.
    _dir.set(
      _pt.x + L.aim.x * spread - L.base.x,
      _pt.y + L.aim.y * spread - L.base.y,
      _pt.z + L.aim.z * spread - L.base.z
    );
    var len = Math.max(1, _dir.length());
    L.mesh.position.copy(L.base);
    L.mesh.quaternion.setFromUnitVectors(UP, _dir.multiplyScalar(1 / len));
    // v12 : le faisceau JAILLIT du sol (frappe décalée par laser).
    var lk = Math.min(1, Math.max(0, (strikeT - i * 0.05) / 0.32));
    var le = 1 - Math.pow(1 - lk, 3);
    L.mesh.scale.set(1 + 0.6 * (1 - le), len * le, 1 + 0.6 * (1 - le));
    // Faisceaux CONTINUS : pas de clignotement d'alarme, juste un léger
    // scintillement d'énergie. Plus opaques quand ils sont resserrés.
    var flick = 0.86 + 0.14 * Math.sin(t * 26 + L.seed * 6.28);
    L.mat.opacity = globalOp * flick * (0.55 + 0.45 * tight) * Math.min(1, lk * 1.6);
  }
}

// ---------- enregistrement ----------
function init(a) {
  api = a;
  T = a.T;
  disposed = false;
  if (!busBound) {
    busBound = true;
    api.on('phase:descent', function () { onPhase('descent'); });
    api.on('phase:veeroff', function () { onPhase('veeroff'); });
    // Ondes de choc sphériques (v10) : 'shockwave:burst' {pos, opts}.
    api.on('shockwave:burst', function (d) {
      if (!root.AZEvent.active) return;
      fireBurst(d && d.pos, d && d.opts);
    });
    // --- Câblage automatique (v10, groupe E) : les moments clés
    // déclenchent leurs ondes de choc SANS que les autres modules
    // aient à réémettre quoi que ce soit (pas de doublons) ---
    // CONTACT phase 8 et explosion phase 14 : gérés par les émissions
    // DIRECTES 'shockwave:burst' de event-rockets.js (contact : rayon 1000)
    // et event-impact.js (impact : rayon 2600, échelle de l'île).
    // Pas de câblage automatique sur 'rocket:impact'/'meteor:hit' ici :
    // cela créerait des DOUBLONS visuels (réconciliation v10).
    // (audio déjà couvert par 'rocket:impact'/'meteor:hit' : pas de bus
    // 'shockwave' supplémentaire ici)
    // Ouverture de la GRANDE faille (phase 10).
    api.on('phase:greatrift', function () {
      if (disposed || !root.AZEvent.active) return;
      var p = greatRiftPos();
      // v16 : l'onde part quand la faille est visiblement OUVERTE (ouverture
      // progressive sur 3 s) — pas avant. Délai relatif, gardes actives.
      // (minuteur dédié : destrTimers est vidé hors phase 'destruction')
      if (greatRiftTimer) { clearTimeout(greatRiftTimer); greatRiftTimer = null; }
      greatRiftTimer = setTimeout(function () {
        greatRiftTimer = null;
        if (disposed || !root.AZEvent.active) return;
        if (root.AZEvent.state !== 'greatrift') return;
        fireBurst(p, { radius: 420, duration: 2.6, color: 0x9fd0ff, rings: 4, flash: true });
        try { api.emit('shockwave', { force: 0.7, pos: p }); } catch (e) { /* audio + ciel */ }
      }, 1500);
    });
    // 7 temps de destruction (phase 18).
    api.on('phase:destruction', function () { scheduleDestructionBeats(); });
    // v16 : anticipation du strike (phase 8) — le halo s'inspire avant la
    // frappe ; 'rocket:impact' le dissout (l'onde réelle prend le relais).
    api.on('phase:strike', function () {
      if (root.AZEvent.active) startStrikeAnticip();
    });
    api.on('rocket:impact', function () {
      killStrikeAnticip();
      // v22 — PRESSION MASSIVE au strike de la fusée n°1 : le DÔME DE
      // PRESSION s'écrase + double mur de poussière au sol (distinct de
      // la coquille expansive émise par event-rockets.js : pas de doublon).
      try {
        if (disposed || !root.AZEvent.active) return;
        var AZ22 = root.AZEvent;
        var zp22 = AZ22.zeroPointPos;
        var cc22 = api.center || { x: 0, y: 30, z: 0 };
        var ix = (zp22 && isFinite(zp22.x)) ? zp22.x : cc22.x;
        var iy = (zp22 && isFinite(zp22.y)) ? zp22.y : cc22.y;
        var iz = (zp22 && isFinite(zp22.z)) ? zp22.z : cc22.z;
        firePressureDome(ix, iy, iz);
        var lowQ22 = !!(api && (api.quality === 'low' || api.isMobile));
        fireGroundWave(ix, iy, iz, 700, 0xd6ecff, lowQ22);
        fireGroundWave(ix, iy, iz, 950, 0x9fd0ff, lowQ22);
      } catch (e) { /* jamais bloquant */ }
    });
    // v17 : ANNEAUX CÉLESTES — sur le contact réel ('meteor:hit'), la
    // colonne d'énergie perfore le ciel (visuel distinct du burst au sol :
    // pas de doublon avec 'shockwave:burst').
    api.on('meteor:hit', function (d) {
      if (disposed || !root.AZEvent.active) return;
      fireCelestialRings(d && d.pos);
    });
    // v21 — PROPULSION DU JOUEUR (visuel uniquement) : 'rocket:zeroshock'
    // est émis par event-rockets.js au contact ; la MÉCANIQUE du kick vit
    // dans event-player.js — ici : flash, anneau de choc au décollage,
    // traînée qui suit le joueur en vol. Aucun doublon visuel.
    api.on('rocket:zeroshock', function () { zeroShockFx(); });
  }
  // v16 : réarmement de l'anticipation (restart propre).
  anticipDone = false;
  anticipFade = -1;
  disposeAnticip();
}

function dispose() {
  disposed = true;
  if (greatRiftTimer) { clearTimeout(greatRiftTimer); greatRiftTimer = null; }
  clearLasers();
  disposeAnticip(); // v16 : anticipation du strike
  anticipDone = false;
  _azp = null;
  clearBursts(); // v10 : ondes de choc sphériques
  clearGroundWaves(); // v20 : cascade de vagues au sol
  clearDelayedBursts(); // v21 : rafales retardées
  clearPressureDomes(); // v22 : dômes de pression
  killZeroShockTrail(); // v21 : traînée du joueur propulsé
  clearCelestialRings(); // v17 : anneaux célestes
  // v14 : géométrie partagée des traînées radiales.
  if (streakGeo) { streakGeo.dispose(); streakGeo = null; }
  streakUp = null;
  clearDestructionBeats(); // v10, groupe E : 7 temps de destruction
  // v24 : le bus n'expose pas de off() — les écouteurs posés dans init()
  // restent branchés pour toute la vie du module. busBound doit RESTER true
  // (sinon le restart re-brancherait les 8 écouteurs -> effets doublés).
  api = null;
  T = null;
}

// Déclenchement manuel :
//   trigger('burst', {pos, opts})  -> onde de choc sphérique (v10)
//   trigger('descent'|'veeroff')   -> lasers rouges
//   trigger('stop')                -> fin des lasers
function trigger(kind, data) {
  if (kind === 'burst') { fireBurst(data && data.pos, data && data.opts); return; }
  if (kind === 'veeroff') onPhase('veeroff');
  else if (kind === 'stop') beginFadeOut();
  else onPhase('descent');
}

root.AZEvent.register('shockwave', {
  init: init,
  update: update,
  dispose: dispose,
  trigger: trigger
});

})(window);
