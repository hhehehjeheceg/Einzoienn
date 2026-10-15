/* event-player.js — MODULE "THE END" v10 : LE JOUEUR LIBRE (groupe C).
 *
 * ÉVÉNEMENT JOUABLE : le joueur garde le contrôle TOTAL pendant tout
 * l'event — déplacement, caméra, saut du Battle Bus, planeur, constructions.
 * AUCUNE cinématique de joueur : pas de caméra verrouillée, pas d'entrées
 * neutralisées. L'événement se déroule autour de lui pendant qu'il joue.
 *
 * Seules interventions (PHYSIQUES, jamais de prise de contrôle) :
 *  - thrown  [170,178] Ph9  : l'onde de choc frappe — impulsion VIOLENTE
 *    vers le haut + poussée horizontale, puis DÉCÉLÉRATION DOUCE vers une
 *    SUSPENSION prolongée (flottement + léger tournoiement amorti).
 *    Traînée de particules + émission 'shockwave' (audio/ciel).
 *  - greatrift/meteorsix/descent Ph10-12 : la suspension CONTINUE sans
 *    à-coup (même physique, pas de nouveau kick).
 *  - veeroff [216,226] Ph13 : NOUVELLE projection vers le haut, très haut,
 *    puis suspension.
 *  - impact  [226,281] Ph14 : au flash, BLAST encore plus fort que phase 9
 *    (déclenché par 'impact:playerblast' — nom attendu du groupe B — ou
 *    repli sur 'meteor:hit' émis par event-impact.js), puis suspension.
 *  - contraction/collapse/growth Ph15-17 : DÉRIVE DOUCE vers le centre
 *    (vitesse croissante par phase, sans à-coup), sans mourir.
 *  - destruction [294,303] Ph18 : dérive croissante 16→27 m/s vers le centre.
 *  - playersucked [303,308] Ph19 : ASPIRATION FORCÉE (v12) — approche
 *    exponentielle indépendante de la distance (arrivée garantie depuis
 *    n'importe où) + spirale, rotation accélérée ; happé au centre, il
 *    disparaît DANS le trou noir (émission 'player:sucked' → audio).
 *    L'aspiration court aussi pendant 'allgone' (Ph20).
 *  - allgone → end Ph20-Finale : le joueur est caché (dans le trou noir).
 *
 * Invulnérabilité (SANS DÉGÂTS) : dégâts bloqués via enrobage de
 * World.prototype._damage, hp/shield remontés au max.
 *
 * v14 : (1) FLOTTEMENT ROBUSTE après la propulsion du Point Zéro — clamp
 * _vy >= -3 m/s en POST-simulation (update(), après la gravité du jeu :
 * zéro chute libre), portance douce sous l'apogée (« rester en haut »),
 * dn.swim jamais nettoyé tant que dn.mode === 'zeroshock' ; (2) FUSÉES
 * SOLIDES — collision cylindrique live lue depuis
 * window.AZEvent.rocketBodies (publié par event-rockets.js), en preUpdate
 * ET update(), _vy conservé.
 * Les bots IA sont parqués hors-champ et figés (pas de combat, pas de
 * "poteau noir") : compromis de fidélité assumé — aucun bot visible
 * projeté (la partie ne se termine jamais avant la fin de l'event).
 *
 * Publié pour le groupe E (caméra) : AZEvent.playerInfo = {x,y,z, vx,vy,vz,
 * speed, airborne, mode, phase} (muté en place chaque preUpdate, joueur
 * local). Collisions v9 conservées : fusées 14 m, Point Zéro 26 m
 * (désactivée pendant 'playersucked' pour l'aspiration).
 *
 * Piloté UNIQUEMENT par AZEvent.state / tState / tTotal et le bus.
 * Ne modifie jamais sim.js : enrobage des méthodes du monde uniquement.
 * Contrat : root.AZEvent.register('player', {init, preUpdate, update, dispose}).
 */
(function (root) {
'use strict';
if (!root.AZEvent) return;

/* ---------- Constantes (relatives, jamais absolues) ---------- */
var HIDE_Y = -10000;   // parking hors-champ (bots, joueur aspiré)

// Phase 9 (thrown) : impulsion violente puis décélération douce.
var THROWN_VY = 170;   // impulsion verticale initiale (m/s)
var THROWN_PUSH = 70;  // poussée horizontale initiale (m/s)
var THROW_DUR = 3.0;   // durée de la poussée résiduelle (s)
var THROW_DECAY = 1.4; // amortissement de la poussée (1/s)
var RISE_EASE = 0.85;  // décroissance de la montée (1/s) → décélération douce
var HOVER_TRACK = 5.0; // suivi de la cible de suspension (1/s)
var MAX_SINK = 14;     // chute max pendant la suspension (m/s) — flotte, ne tombe pas
var SPIN_THROW = 1.6;  // tournoiement initial phase 9 (rad/s), amorti
var SPIN_DAMP = 0.9;   // amortissement du tournoiement (1/s)

// Phase 13 (veeroff) : encore plus haut que phase 9.
var VEER_VY = 200;
var SPIN_VEER = 1.3;

// Phase 14 (impact) : blast ENCORE PLUS FORT que phase 9.
var BLAST_VY = 260;
var BLAST_PUSH = 100;
var SPIN_BLAST = 2.6;

// v11 — Phase 8 (strike) : la fusée ENTRE dans le Point Zéro -> onde de choc
// qui PROPULSE le joueur TRÈS HAUT et TRÈS LOIN (bus 'rocket:zeroshock').
var ZEROSHOCK_VY = 235;       // montée verticale (m/s) : bien plus haut que tout
var ZEROSHOCK_PUSH = 75;     // poussée horizontale (m/s) : très loin
var ZEROSHOCK_PUSH_DUR = 6.0; // la poussée dure (traverse la map)
var ZEROSHOCK_PUSH_DECAY = 0.9;
var SPIN_ZEROSHOCK = 0.18;     // tournoiement (yaw) pendant le vol

// v14 — FLOTTEMENT ROBUSTE après propulsion (zeroshock) : le clamp preUpdate
// de v12 ne suffit pas — la gravité du jeu ré-accélère le joueur vers le bas
// ENTRE preUpdate et le rendu (update() tourne APRÈS la sim : on y force le
// plancher une seconde fois, ce qui annule la gravité ré-appliquée).
var SWIM_SINK_FLOOR = 3;    // v14 : plancher _vy tant que la nage est active (m/s) — ZÉRO chute libre
var ZSHOCK_LIFT_MARGIN = 120; // v14 : portance quand le joueur redescend sous (apogée - marge) (m)
var ZSHOCK_LIFT = 9;        // v14 : poussée douce vers le haut (m/s²) — « rester en haut »
// v14 — FUSÉES SOLIDES : volumes live publiés par event-rockets.js dans
// window.AZEvent.rocketBodies = [{x, y, z, r, top}] (x,z = centre, y = base,
// top = sommet, r = rayon en mètres). Lecture défensive côté event-player.
var ROCKET_BODY_MARGIN = 1.2; // v14 : marge joueur autour du cylindre (m)
var ROCKET_BODY_YTOL = 2;     // v14 : tolérance verticale base/sommet (m)

// Phases 15-17 : dérive douce vers le centre (m/s), croissante par phase.
var DRIFT_SPEED = { contraction: 6, collapse: 10, growth: 14 };
// Phase 18 : dérive croissante pendant la destruction (m/s).
var DESTRUCT_PULL0 = 16, DESTRUCT_PULL1 = 27;
var DRIFT_ALT = 55;    // altitude visée pendant la dérive (au-dessus du centre)

// Phase 19 (playersucked) : aspiration FORCÉE (v12) — voir stepSuck.
var SUCK_GRAB_DIST = 16;// distance à laquelle le joueur disparaît dedans
var SUCK_RATE0 = 1.5;   // v12 : taux d'approche exponentielle au début (1/s)
var SUCK_RATE1 = 5.0;   // v12 : taux d'approche exponentielle à la fin (1/s)
var SUCK_TANG_MAX = 34; // v12 : vitesse tangentielle max de la spirale (m/s)

/* ---------- État local ---------- */
var api = null;
var saved = {};   // id -> {x,y,z,yaw} : position d'origine (restauration)
var push = {};    // id -> {vx, vz, t} : poussée résiduelle (ne prend jamais le contrôle)
var dyn = {};     // id -> {airT, kickVy, spin, seed, driftV, suckT, swim, mode} : physique d'event
var hidden = {};  // id -> true : parqué hors-champ
var kicked = {};  // id -> phase : impulsions one-shot déjà appliquées
var origDamage = null, wrappedDamage = null;
var origBot = null, wrappedBot = null;
var origSwim = null; // v12 : animateAvatar d'origine (nage)
var busBound = false; // écouteurs branchés une seule fois (pas de off())

var _t1 = { x: 0, y: 0, z: 0 }; // temporaire (zéro allocation par frame)

/* ---------- Utilitaires ---------- */
function AZ() { return root.AZEvent; }
function world() { var g = root.AZUR; return (g && g.world) ? g.world : null; }
function players() { var w = world(); return (w && w.players) ? w.players : []; }
// v13 — ÉJECTION du véhicule (fix cause racine confirmée) : sim.js
// `_drive` écrase p.x/p.y/p.z à CHAQUE frame tant que p.vehicleId est défini
// (et le séquenceur fait tourner les preUpdate AVANT la sim) — toute
// impulsion d'event (kick, aspiration) est donc ANNULÉE si le joueur est
// dans un véhicule (Battle Bus, voiture, bateau). On libère le conducteur
// des deux côtés, comme sim.js l.769 / l.905-906 le fait.
function ejectFromVehicle(p) {
  if (!p || !p.vehicleId) return false;
  try {
    var w = world();
    if (w && w.vehicles) {
      for (var i = 0; i < w.vehicles.length; i++) {
        var v = w.vehicles[i];
        if (v && v.id === p.vehicleId) { v.driver = null; break; }
      }
    }
  } catch (e) { /* ignore */ }
  p.vehicleId = null;
  return true;
}
function center() { return (api && api.center) ? api.center : { x: 0, y: 30, z: 0 }; }
function anchors() { var A = AZ(); return (A && A.anchors) || {}; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }

function busEmit(evt, data) { try { AZ().emit(evt, data); } catch (e) { /* ignore */ } }
function fx() { var A = AZ(); return (A && A.fx) ? A.fx : null; }
function fxTrail(x, y, z, o) {
  var F = fx();
  if (F && typeof F.trail === 'function') { try { F.trail({ x: x, y: y, z: z }, o); } catch (e) { /* ignore */ } }
}
function fxBurst(x, y, z, o) {
  var F = fx();
  if (F && typeof F.burst === 'function') { try { F.burst({ x: x, y: y, z: z }, o); } catch (e) { /* ignore */ } }
}

function meteorLive(out) {
  var m = AZ().meteorPos; // event-meteor.js : Vector3 live
  if (m && typeof m.x === 'number') { out.x = m.x; out.y = m.y; out.z = m.z; return out; }
  // v7 : repli = position FIGÉE (miroir de event-meteor.js : centre + (420, 780, 420)).
  var c = center(); out.x = c.x + 420; out.y = 780; out.z = c.z + 420; return out;
}
function holeLive(out) {
  var b = anchors()['blackhole']; // event-blackhole.js : 'anchor:set'
  if (b && typeof b.x === 'number') { out.x = b.x; out.y = b.y; out.z = b.z; return out; }
  var c = center(); out.x = c.x; out.y = c.y + 150; out.z = c.z; return out;
}

// État dynamique d'event du joueur (créé à la demande, zéro alloc par frame ensuite).
function getDyn(p) {
  var d = dyn[p.id];
  if (!d) {
    d = { airT: 0, kickVy: 0, spin: 0, seed: Math.random() * 6.28,
          driftV: 0, suckT: 0, mode: 'none' };
    dyn[p.id] = d;
  }
  return d;
}

// v24 — Planeur MANUEL du joueur : true uniquement quand le joueur a
// lui-même ouvert son parachute (p.gliding === true, posé par sim.js sur
// la touche saut), SANS que ce soit le planeur AUTO de sécurité de sim.js
// (_airMove, p.autoGlider === true). Seul ce cas est respecté par
// l'événement : le vertical appartient alors au joueur. Le planeur auto
// (p.autoGlider) n'est jamais respecté — leçon v18 conservée, il ne doit
// pas annuler les impulsions d'event.
function manualGlider(p) {
  return !!(p && p.gliding && !p.autoGlider);
}

// Mémorise la position d'origine (une seule fois) pour restauration.
function saveOnce(p) {
  if (!p || saved[p.id]) return;
  saved[p.id] = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
}

// Parquer hors-champ : vivant, invisible, restauré au dispose().
function hidePlayer(p) {
  if (!p || hidden[p.id]) return;
  saveOnce(p);
  hidden[p.id] = true;
  p._eventHidden = true;
  p.y = HIDE_Y;
  p._vy = 0;
  p.grounded = false; p.jumping = false; p.falling = false;
  p.gliding = false; p.swimming = false; p.crouching = false;
}

/* ---------- Enrobage anti-dégâts ----------
 * Tous les dégâts joueurs passent par World.prototype._damage : l'enrober
 * sur l'instance suffit à rendre tout le monde invulnérable, sans toucher
 * à sim.js. En ceinture + bretelles, preUpdate remonte hp/shield au max. */
// v12 — NAGE dans les airs (onde de choc du Point Zéro, REMPLACE la culbute
// v11 refusée par l'utilisateur). On enveloppe view.animateAvatar (tout au
// bout de la chaîne de wrappers existante) : APRÈS le rendu normal, si
// player._eventSwim est un nombre, on amène les membres en pose de NAGE.
// Le modèle reste DROIT (pas de rotation du modèle) : le joueur FLOTTE.
// v15 — BRASSE GRACIEUSE : cycle en 3 temps (traction → retour → GLISSE),
// corps qui ondule légèrement, battements adoucis en glisse ; entrée/sortie
// en fondu (p._eventSwimFade) : la pose de nage se FOND dans la pose du jeu
// au lieu de claquer (pas de snap). On ne fait que des rotations —
// blending additif vers la pose calculée par le jeu juste avant.
function swimPose(u, t, fade) {
  // Cycle de brasse ~2,4 s : ample et gracieux.
  var cyc = ((t / 2.4) % 1 + 1) % 1;
  var TAU = Math.PI * 2;
  // Traction 0 → 0,40 (les bras balayent), retour 0,40 → 0,70,
  // GLISSE 0,70 → 1 (corps allongé, immobile).
  var pull = smooth(clamp(cyc / 0.40, 0, 1));
  var back = smooth(clamp((cyc - 0.40) / 0.30, 0, 1));
  var stroke = pull * (1 - back); // 0 → 1 → 0 : l'enveloppe de la brasse
  // Glisse 0,70 → 1 : s'installe en douceur, puis s'efface juste avant le
  // bouclage pour que la traction reparte sans à-coup (continuité à cyc=1/0).
  var glide = smooth(clamp((cyc - 0.70) / 0.12, 0, 1)) *
              (1 - smooth(clamp((cyc - 0.94) / 0.06, 0, 1)));
  // BRAS : allongés vers l'avant en glisse (-2,2), balayage ample
  // vers le bas pendant la traction (-0,4), léger écart latéral gracieux.
  var armX = -1.25 + stroke * 1.05 - glide * 0.25;
  var armZ = -0.2 - stroke * 0.35;
  blendRot(u.limbs[1].rotation, 'x', armX, fade);
  blendRot(u.limbs[3].rotation, 'x', armX, fade);
  blendRot(u.limbs[1].rotation, 'z', armZ, fade);
  blendRot(u.limbs[3].rotation, 'z', -armZ, fade);
  // Coudes : pliés pendant la traction, tendus en glisse.
  blendRot(u.elbows[0].rotation, 'x', -0.32 + Math.sin(t * 0.8 + 1) * 0.045, fade);
  blendRot(u.elbows[1].rotation, 'x', -0.28 + Math.sin(t * 0.8 - 1) * 0.045, fade);
  // JAMBES : battements doux, forts pendant la traction, presque
  // immobiles (allongées) pendant la glisse.
  var legEnv = 0.30 + 0.70 * (1 - glide);
  var kick = Math.sin(t * 0.85);
  blendRot(u.limbs[0].rotation, 'x', 0.08 + kick * 0.09, fade);
  blendRot(u.limbs[2].rotation, 'x', -0.06 - kick * 0.07, fade);
  blendRot(u.limbs[0].rotation, 'z', -0.055, fade);
  blendRot(u.limbs[2].rotation, 'z', 0.065, fade);
  blendRot(u.knees[0].rotation, 'x', 0.18 + Math.sin(t * 0.9) * 0.04, fade);
  blendRot(u.knees[1].rotation, 'x', 0.24 + Math.sin(t * 0.9 + 1.3) * 0.04, fade);
  // TORSE : ondulation légère synchronisée sur la brasse (le corps
  // "respire" avec le mouvement), jamais raide.
  blendRot(u.torso.rotation, 'x', -0.015 + 0.018 * Math.sin(t * 0.7), fade);
  blendRot(u.torso.rotation, 'z', 0.012 * Math.sin(t * 0.6 + 1.1), fade);
}

// Fait glisser une rotation vers sa cible (0 = pose du jeu, 1 = pose de nage).
function blendRot(rot, axis, target, fade) {
  rot[axis] += (target - rot[axis]) * fade;
}
function installSwimWrap() {
  var vw = api && api.view && api.view();
  if (!vw || typeof vw.animateAvatar !== 'function') return;
  if (vw.__azeventSwimWrapped) return; // déjà enveloppé
  origSwim = vw.animateAvatar;
  var real = origSwim;
  vw.__azeventSwimWrapped = true;
  vw.animateAvatar = function (model, player, dt, options) {
    var r = real.call(this, model, player, dt, options);
    try {
      var fdt = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? dt : 0.016;
      var swimT = player && player._eventSwim;
      var fade = (player && typeof player._eventSwimFade === 'number')
        ? player._eventSwimFade : 0;
      if (model && model.userData && model.userData.limbs &&
          model.userData.knees && model.userData.elbows && model.userData.torso) {
        if (player._meteorRide) {
          var u = model.userData, t = AZ().tTotal;
          var brace = AZ().state === 'acceleration' ? 0.5 * smooth((AZ().tState - 29) / 4) : (AZ().riftWorld && AZ().riftWorld.active ? 0.22 : 0.1);
          u.gun.visible = u.tool.visible = u.blueprint.visible = false;
          u.torso.position.y -= brace * 0.1;
          u.torso.rotation.x += brace * 0.12;
          u.limbs[1].rotation.set(-0.18 - brace * 0.35 + Math.sin(t * 0.9) * 0.035, 0, -0.16 - brace * 0.18);
          u.limbs[3].rotation.set(-0.16 - brace * 0.35 - Math.sin(t * 0.9) * 0.035, 0, 0.16 + brace * 0.18);
          u.elbows[0].rotation.x = -0.2 - brace * 0.3;
          u.elbows[1].rotation.x = -0.24 - brace * 0.3;
          u.knees[0].rotation.x += brace * 0.2; u.knees[1].rotation.x += brace * 0.2;
          model.rotation.x = 0; model.rotation.z = Math.sin(t * 0.8) * brace * 0.012;
          player._eventSwimFade = 0;
        } else if (typeof swimT === 'number' && isFinite(swimT) && !player.gliding) {
          // ENTRÉE DOUCE : le fondu monte en ~0,7 s, la pose se fond.
          fade = Math.min(1, fade + fdt * 1.4);
          player._eventSwimFade = fade;
          player._eventSwimLast = swimT;
          swimPose(model.userData, swimT, fade);
          if (!player.gliding) {
            model.rotation.x *= 1 - fade;
            model.rotation.z = Math.sin(swimT * 0.62) * 0.025 * fade;
            model.userData.gun.visible = model.userData.tool.visible = model.userData.blueprint.visible = false;
            blendRot(model.userData.head.rotation, 'x', Math.sin(swimT * 0.45) * 0.03, fade);
          }
        } else if (fade > 0) {
          // SORTIE DOUCE : la nage vient de se terminer — on rejoue la
          // dernière pose en fondu inverse (~0,55 s), pas de snap.
          fade = Math.max(0, fade - fdt * 1.8);
          player._eventSwimFade = fade;
          if (!player.gliding) swimPose(model.userData, player._eventSwimLast || 0, fade);
          if (fade === 0) {
            delete player._eventSwimFade;
            delete player._eventSwimLast;
          }
        }
      }
    } catch (e) { /* jamais bloquant */ }
    return r;
  };
}

function restoreSwimWrap() {
  var vw = api && api.view && api.view();
  if (vw && vw.__azeventSwimWrapped && origSwim) {
    vw.animateAvatar = origSwim;
    delete vw.__azeventSwimWrapped;
  }
  origSwim = null;
}

function installDamageWrap() {
  var w = world();
  if (!w || typeof w._damage !== 'function') return;
  if (w._damage === wrappedDamage) return;
  origDamage = w._damage;
  var real = origDamage;
  wrappedDamage = function () {
    var A = AZ();
    if (A && A.active) return; // event : dégâts bloqués, personne ne meurt
    return real.apply(this, arguments);
  };
  w._damage = wrappedDamage;
}
function restoreDamageWrap() {
  var w = world();
  if (w && wrappedDamage && w._damage === wrappedDamage && origDamage) w._damage = origDamage;
  origDamage = null; wrappedDamage = null;
}

/* ---------- Enrobage anti-IA ----------
 * Les bots ne participent pas à l'event : leur réflexion est figée pendant
 * tout l'event (ils sont parqués hors-champ par preUpdate). Le joueur,
 * lui, n'est JAMAIS touché. */
function installBotWrap() {
  var w = world();
  if (!w || typeof w._bot !== 'function') return;
  if (w._bot === wrappedBot) return;
  origBot = w._bot;
  var real = origBot;
  wrappedBot = function (p, dt) {
    var A = AZ();
    if (A && A.active && p && p.bot) {
      p._input = { moveX: 0, moveZ: 0, moveY: 0, yaw: p.yaw, pitch: p.pitch,
                   fire: false, sprint: false, aim: false, crouch: false };
      return; // pas de réflexion, pas d'action
    }
    return real.call(this, p, dt);
  };
  w._bot = wrappedBot;
}
function restoreBotWrap() {
  var w = world();
  if (w && wrappedBot && w._bot === wrappedBot && origBot) w._bot = origBot;
  origBot = null; wrappedBot = null;
}

/* ---------- Impulsions one-shot (le joueur garde le contrôle) ---------- */

// 'thrown' Ph9 : l'onde de choc FRAPPE — impulsion violente vers le haut +
// poussée horizontale. Émission 'shockwave' (audio : détonation, ciel : lueur).
function kickThrown(p) {
  ejectFromVehicle(p); // v13 — même cause racine (_drive annulerait l'impulsion)
  meteorLive(_t1); // origine du souffle
  var dx = p.x - _t1.x, dz = p.z - _t1.z;
  var d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1) { var c = center(); dx = p.x - c.x; dz = p.z - c.z; d = Math.sqrt(dx * dx + dz * dz) || 1; }
  push[p.id] = { vx: (dx / d) * THROWN_PUSH, vz: (dz / d) * THROWN_PUSH, t: 0,
               dur: THROW_DUR, decay: THROW_DECAY };
  var dn = getDyn(p);
  dn.airT = 0; dn.kickVy = THROWN_VY; dn.spin = SPIN_THROW; dn.mode = 'thrown';
  dn.swim = true; p._eventSwim = 0; // v15 : flotte + nage gracieuse (comme le zeroshock)
  p._vy = THROWN_VY * 0.55; // amorce immédiate, le tracking de suspension fait le reste
  p.grounded = false; p.jumping = false; p.falling = true; p.gliding = false;
  // v18 — JAMAIS true : le planeur auto de sim.js (_airMove) se déploierait
  // dès le 1er tick (nextY <= openY car le joueur est au sol) et annulerait
  // l'impulsion (_vy = -5, puis re-snap au sol) — c'était la cause racine du
  // « reste au sol ». La nage/flottement (dn.swim + postSimSwim) remplace
  // cette sécurité : aucune chute libre.
  p.airborneFromBus = false;
  kicked[p.id] = 'thrown';
  fxBurst(p.x, p.y, p.z, { color: 0xeaf4ff, count: 26, spread: 8, size: 8, life: 0.9 });
  busEmit('shockwave', { phase: 'thrown' });
}

// v11 — ONDE DE CHOC du Point Zéro (phase 8, la fusée ENTRE dedans) :
// le joueur est PROPULSÉ TRÈS HAUT et TRÈS LOIN.
// v12 : le joueur FLOTTE avec une animation de NAGE dans les airs
// (dn.swim / p._eventSwim, lus par le wrapper animateAvatar) — la culbute
// v11 est SUPPRIMÉE (refus utilisateur : pas de chute libre).
function kickZeroShock(p) {
  var id = p.id;
  ejectFromVehicle(p); // v13 — D'ABORD éjecté du véhicule (sinon _drive annule tout)
  meteorLive(_t1); // origine du souffle
  var dx = p.x - _t1.x, dz = p.z - _t1.z;
  var d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1) { var c = center(); dx = p.x - c.x; dz = p.z - c.z; d = Math.sqrt(dx * dx + dz * dz) || 1; }
  push[id] = { vx: (dx / d) * ZEROSHOCK_PUSH, vz: (dz / d) * ZEROSHOCK_PUSH, t: 0,
               dur: ZEROSHOCK_PUSH_DUR, decay: ZEROSHOCK_PUSH_DECAY };
  var dn = getDyn(p);
  dn.airT = 0; dn.kickVy = ZEROSHOCK_VY; dn.spin = SPIN_ZEROSHOCK; dn.mode = 'zeroshock';
  dn.hoverY = null; dn.liftStartY = p.y; p._eventFloat = true; p._eventVerticalVelocity = ZEROSHOCK_VY; p.swimming = false; p.autoGlider = false;
  dn.swim = true; p._eventSwim = 0; // v12 : FLOTTE + nage (plus de culbute)
  dn.apexY = p.y; // v14 : point de départ du suivi d'apogée (portance « rester en haut »)
  p._vy = ZEROSHOCK_VY * 0.55; // amorce immédiate, le tracking de suspension fait le reste
  p.grounded = false; p.jumping = false; p.falling = true; p.gliding = false;
  // v18 — JAMAIS true : le planeur auto de sim.js (_airMove) se déploierait
  // dès le 1er tick (nextY <= openY car le joueur est au sol) et annulerait
  // l'impulsion (_vy = -5, puis re-snap au sol) — c'était la cause racine du
  // « reste au sol ». La nage/flottement (dn.swim + postSimSwim) remplace
  // cette sécurité : aucune chute libre.
  p.airborneFromBus = false;
  p.invuln = true; if (p.invulnerable !== undefined) p.invulnerable = true;
  kicked[id] = 'zeroshock';
  fxBurst(p.x, p.y, p.z, { color: 0xbfe9ff, count: 60, spread: 14, size: 12, life: 1.4 });
  busEmit('shockwave', { phase: 'zeroshock', force: 1.0 }); // audio + ciel
}

// 'veeroff' Ph13 : PROJETÉ VERS LE HAUT, encore plus haut que phase 9.
function kickVeer(p) {
  ejectFromVehicle(p); // v13 — même cause racine (_drive annulerait l'impulsion)
  var dn = getDyn(p);
  dn.airT = 0; dn.kickVy = VEER_VY; dn.spin = SPIN_VEER; dn.mode = 'veer'; dn.hoverY = null;
  dn.swim = true; p._eventSwim = 0; // v15 : flotte + nage gracieuse
  p._vy = VEER_VY * 0.55;
  p.grounded = false; p.jumping = false; p.falling = true; p.gliding = false;
  p.airborneFromBus = false; // v18 — même cause racine que le zeroshock : le
  // planeur auto de sim.js annulerait l'impulsion dès le 1er tick.
  kicked[p.id] = 'veeroff';
  fxBurst(p.x, p.y, p.z, { color: 0xdff2ff, count: 22, spread: 7, size: 7, life: 0.8 });
}

// 'impact' Ph14 : BLAST — encore plus fort que phase 9. Déclenché par
// 'impact:playerblast' (nom attendu du groupe B — aucun émetteur dans les
// fichiers actuels) ou, en repli, par 'meteor:hit' (flash réel, event-impact.js).
function kickBlast(p) {
  ejectFromVehicle(p); // v13 — même cause racine (_drive annulerait l'impulsion)
  meteorLive(_t1); // origine du souffle (repli : centre)
  var dx = p.x - _t1.x, dz = p.z - _t1.z;
  var d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1) { var c = center(); dx = p.x - c.x; dz = p.z - c.z; d = Math.sqrt(dx * dx + dz * dz) || 1; }
  push[p.id] = { vx: (dx / d) * BLAST_PUSH, vz: (dz / d) * BLAST_PUSH, t: 0 };
  var dn = getDyn(p);
  dn.airT = 0; dn.kickVy = BLAST_VY; dn.spin = SPIN_BLAST; dn.mode = 'blast'; dn.hoverY = null;
  dn.swim = true; p._eventSwim = 0; // v15 : flotte + nage gracieuse (pas de chute libre)
  p._vy = BLAST_VY * 0.55;
  p.grounded = false; p.jumping = false; p.falling = true; p.gliding = false;
  p.airborneFromBus = false; // v18 — même cause racine que le zeroshock : le
  // planeur auto de sim.js annulerait l'impulsion dès le 1er tick.
  kicked[p.id] = 'blast';
  fxBurst(p.x, p.y, p.z, { color: 0xffffff, count: 34, spread: 10, size: 9, life: 1.0 });
  busEmit('player:blast', { phase: 'impact' }); // groupe E (caméra) / audio futur
}

function onBlastEvent() {
  var Az = AZ();
  if (!Az || !Az.active || Az.state !== 'impact') return;
  var ps = players();
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    // v36 : la météorite est détruite au contact — le ride se termine ici,
    // l'explosion (blast) prend le relais.
    if (p && p._meteorRide) { p._meteorRide = false; p._meteorPin = null; p._meteorRideOffset = null; }
    if (p && p.deployed && !p.bot && !hidden[p.id] && p.alive && kicked[p.id] !== 'blast') kickBlast(p);
  }
}

// Poussée résiduelle horizontale : s'amortit, ne prend jamais le contrôle
// (simple déplacement additionnel avant la sim).
function stepPush(p, dt) {
  var k = push[p.id];
  if (!k) return;
  // v11 : durée/décroissance par impulsion (le zeroshock pousse plus longtemps).
  var dur = k.dur || THROW_DUR;
  var decay = (k.decay != null) ? k.decay : THROW_DECAY;
  k.t += dt;
  if (k.t >= dur) { push[p.id] = null; return; }
  var dec = Math.exp(-decay * dt);
  k.vx *= dec; k.vz *= dec;
  p.x += k.vx * dt;
  p.z += k.vz * dt;
}

/* ---------- Vol / suspension (Ph9 → Ph14, transitions sans à-coup) ----------
 * Impulsion violente puis DÉCÉLÉRATION DOUCE vers le flottement :
 * la cible verticale passe de kickVy à un léger balancement (ease
 * exponentiel), le tournoiement s'amortit. Le joueur garde ses touches :
 * on ne pilote que _vy (et le yaw pour le tournoiement). La même fonction
 * sert thrown/veer/blast (après kick) et greatrift/meteorsix/descent
 * (suspension continue, SANS nouveau kick) : aucun à-coup aux transitions. */
function stepAir(p, dt, t, bobAmp) {
  var dn = getDyn(p);
  dn.airT += dt;
  // v24 : si le joueur a ouvert MANUELLEMENT son parachute (p.gliding &&
  // !p.autoGlider), l'événement ne pilote plus le VERTICAL : pas de
  // réécriture de _vy, pas de falling forcé — son vol lui appartient.
  // Restent actifs : la poussée horizontale (stepPush, appelée par
  // preUpdate), le tournoiement amorti, les particules, l'audio/le ciel
  // via les émissions de bus. Le planeur AUTO de sécurité (p.autoGlider)
  // n'est toujours PAS respecté (leçon v18 : il annulerait les kicks).
  var manual = manualGlider(p);
  var rise = Math.exp(-dn.airT * RISE_EASE);      // 1 → 0 : décélération douce
  var swim = !!dn.swim; // v12 : nage dans les airs (pas de chute libre)
  var hover = bobAmp * (swim ? 1.7 : 1) * Math.sin(t * 1.25 + dn.seed); // v12 : balancement doux amplifié en nage
  var target = dn.kickVy * rise + hover * (1 - rise);
  // v14 : l'avancement de l'animation de nage est fait UNE fois par frame en
  // post-simulation (postSimSwim, appelé par update()) — plus ici, pour
  // éviter un double avancement preUpdate + update.
  if (!manual && swim) {
    p._eventFloat = true; p.grounded = false; p.jumping = false; p.falling = true; p.swimming = false; p.airborneFromBus = false; p.autoGlider = false;
    if (dn.airT < 5.8) { p._eventVerticalVelocity = dn.kickVy * rise; dn.hoverY = p.y; }
    else {
      if (typeof dn.hoverY !== 'number') dn.hoverY = p.y;
      var hoverY = dn.hoverY + bobAmp * Math.sin((dn.airT - 5.8) * 0.8);
      p._eventVerticalVelocity = clamp((hoverY - p.y) * 2.4, -7, 7);
    }
    p._vy = p._eventVerticalVelocity;
  } else {
    p._eventFloat = false;
    if (!p.grounded && !manual) { p._vy += (target - p._vy) * (1 - Math.exp(-dt * HOVER_TRACK)); p._vy = Math.max(-MAX_SINK, p._vy); p.falling = true; }
  }
  // Léger tournoiement qui s'amortit.
  if (dn.spin > 0.01) {
    dn.spin *= Math.exp(-SPIN_DAMP * dt);
    p.yaw += dn.spin * dt;
  }
  // Traînée de particules (et stries de vent) quand ça va vite.
  if (Math.abs(p._vy) > 30) {
    fxTrail(p.x, p.y - 1, p.z, { color: 0xdff2ff, count: 2, spread: 3, size: 5, life: 0.6 });
  }
  // v12 : fin de nage à l'atterrissage (le flag swim survit aux changements
  // de mode zeroshock->suspend tant qu'on reste dans les phases aériennes).
  // v14 : JAMAIS nettoyé tant que dn.mode === 'zeroshock' (même à
  // l'atterrissage, même hors phases aériennes listées) — le joueur reste en
  // nage/flottement après la propulsion du Point Zéro.
  if (p.grounded && swim && dn.mode !== 'zeroshock') { dn.swim = false; delete p._eventSwim; }
}

/* ---------- Dérive vers le centre (Ph15-18) ----------
 * L'énergie se contracte : le joueur DÉRIVE doucement vers le centre,
 * sans mourir. Vitesse additive (le joueur peut lutter), qui glisse en
 * douceur vers sa cible à chaque changement de phase (pas d'à-coup).
 * En l'air : l'altitude glisse vers DRIFT_ALT au-dessus du centre. */
function stepDrift(p, dt, t, speed) {
  var dn = getDyn(p);
  p._eventFloat = !manualGlider(p); p._eventVerticalVelocity = 0;
  dn.mode = 'drift';
  dn.driftV += (speed - dn.driftV) * Math.min(1, dt * 1.5); // transition douce
  var c = center();
  var dx = c.x - p.x, dz = c.z - p.z;
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 1) {
    p.x += (dx / dist) * dn.driftV * dt;
    p.z += (dz / dist) * dn.driftV * dt;
  }
  if (!p.grounded) {
    var ty = c.y + DRIFT_ALT + 6 * Math.sin(t * 0.9 + dn.seed);
    p.y += (ty - p.y) * Math.min(1, dt * 0.8);
    p._vy = 0;
    p.falling = true;
  }
  if (dn.driftV > 12 && Math.abs(p._vy) > 20) {
    fxTrail(p.x, p.y, p.z, { color: 0xbfe4ff, count: 2, spread: 4, size: 5, life: 0.6 });
  }
}

/* ---------- Aspiration (Ph19-20, v12) ----------
 * ASPIRATION FORCÉE, INDÉPENDANTE DE LA DISTANCE (diagnostic confirmé :
 * l'ancienne vitesse 14→70 m/s basée sur la distance d'entrée ne pouvait
 * pas traverser une grande distance en 5 s — le joueur n'était jamais
 * aspiré). Approche EXPONENTIELLE : chaque frame, la position avance vers
 * le trou d'une fraction k = min(1, dt*rate) de la distance RESTANTE, avec
 * rate qui rampe de 1.5 à 5/s sur la phase ; idem en vertical vers le y du
 * trou. Composante tangentielle (spirale) PROPORTIONNELLE à la distance
 * restante (vitesse bornée) pour ne pas orbiter indéfiniment. Arrivée
 * garantie bien avant la fin de la phase, DEPUIS N'IMPORTE QUELLE DISTANCE.
 * Le joueur garde ses touches (il peut lutter) mais se fait entraîner.
 * Happé au centre : il disparaît DEDANS ('player:sucked' → audio). */
function stepSuck(p, dt) {
  p._eventFloat = !manualGlider(p); p._eventVerticalVelocity = 0;
  var dn = getDyn(p);
  dn.mode = 'suck';
  dn.suckT = (dn.suckT || 0) + dt; // temps propre d'aspiration (s)
  holeLive(_t1);
  if (!dn.suckFrom) dn.suckFrom = { x: p.x, y: p.y, z: p.z };
  var span = AZ().TIMELINE.playersucked, prog = clamp(dn.suckT / ((span[1] - span[0]) * 0.95), 0, 1);
  var dx = dn.suckFrom.x - _t1.x, dz = dn.suckFrom.z - _t1.z;
  var radius = Math.sqrt(dx * dx + dz * dz), angle = Math.atan2(dz, dx) + Math.pow(prog, 1.7) * 2.4;
  var remaining = 1 - Math.pow(prog, 2.2), dist = radius * remaining;
  p.x = _t1.x + Math.cos(angle) * dist;
  p.z = _t1.z + Math.sin(angle) * dist;
  p.y = _t1.y + (dn.suckFrom.y - _t1.y) * remaining + Math.sin(prog * Math.PI) * 28;
  p._vy = 0;
  p.grounded = false; p.jumping = false; p.falling = true;
  p.yaw += (1.5 + 6.5 * prog) * dt; // rotation accélérée
  fxTrail(p.x, p.y, p.z, { color: 0xbfe4ff, count: 3, spread: 4, size: 6, life: 0.7 });
  // Happé : disparaît DANS le trou noir (masquage propre).
  if (dist < SUCK_GRAB_DIST && Math.abs(p.y - _t1.y) < 60) {
    hidePlayer(p);
    busEmit('player:sucked', { id: p.id });
  }
}

// v13 — REPLI d'aspiration : si stepSuck échoue (exception), le joueur DOIT
// quand même bouger vers le Point Zéro — mouvement exponentiel minimal,
// sans dépendance (ni particules, ni masquage).
function suckFallback(p, dt) {
  holeLive(_t1);
  var k = Math.min(1, dt * 2.2);
  p.x += (_t1.x - p.x) * k;
  p.y += (_t1.y - p.y) * k;
  p.z += (_t1.z - p.z) * k;
  p._vy = 0;
  p.grounded = false; p.jumping = false; p.falling = true;
}

// Phases où le joueur doit être caché (dans le trou noir).
function lateHideState(state) {
  return state === 'allgone' || state === 'blackhole' ||
         state === 'numbers' || state === 'end';
}

// Phases de vol/suspension (Ph9 → Ph14).
function isAirPhase(state) {
  return state === 'thrown' || state === 'greatrift' || state === 'meteorsix' ||
         state === 'descent' || state === 'veeroff' || state === 'impact';
}

// v12 : phases où la NAGE persiste (vol/suspension après l'onde de choc
// du Point Zéro) — le flag swim y survit aux changements de mode.
function isAirSwimPhase(state) {
  return state === 'strike' || state === 'thrown' || state === 'veeroff' || isAirPhase(state);
}

/* ---------- Publication pour le groupe E (caméra) ----------
 * AZEvent.playerInfo : position / vitesse du joueur local, muté en place
 * chaque preUpdate (zéro allocation). Champs : x,y,z, vx,vy,vz (vx/vz =
 * poussée résiduelle d'event, vy = vitesse verticale), speed, airborne,
 * mode ('thrown'|'suspend'|'veer'|'blast'|'drift'|'suck'|'none'),
 * phase (état séquenceur). */
function publishPlayerInfo(p, state) {
  var A = AZ();
  var PI = A.playerInfo;
  if (!PI) PI = A.playerInfo = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    speed: 0, airborne: false, mode: 'none', phase: ''
  };
  var dn = dyn[p.id];
  var k = push[p.id];
  PI.x = p.x; PI.y = p.y; PI.z = p.z;
  PI.vx = k ? k.vx : 0; PI.vz = k ? k.vz : 0;
  PI.vy = p._vy || 0;
  PI.speed = Math.sqrt(PI.vx * PI.vx + PI.vy * PI.vy + PI.vz * PI.vz);
  PI.airborne = !p.grounded;
  PI.mode = dn ? dn.mode : 'none';
  PI.phase = state;
}

/* ---------- Bus d'événements ---------- */
function bindBusOnce() {
  if (busBound) return;
  busBound = true;
  var A = AZ();
  if (!A || typeof A.on !== 'function') return;
  // countdown : l'event commence — on parque les bots (pas de combat,
  // pas de "poteau noir"). Le joueur, lui, reste 100 % libre.
  A.on('phase:countdown', function () {
    if (!AZ().active) return;
    var ps = players();
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p && p.bot) hidePlayer(p);
      else if (p) saveOnce(p);
    }
  });
  // L'onde de choc réelle peut aussi déclencher la poussée (pendant thrown).
  A.on('shockwave:hit', function (d) {
    var Az = AZ();
    if (!Az || !Az.active || Az.state !== 'thrown') return;
    var id = d && (d.playerId || d.id);
    if (!id) return;
    var ps = players();
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p && p.deployed && p.id === id && !p.bot && !hidden[p.id] && kicked[p.id] !== 'thrown' && !p._meteorRide) kickThrown(p);
    }
  });
  // Phase 14 : blast du joueur — 'impact:playerblast' (nom attendu du
  // groupe B ; aucun émetteur dans les fichiers actuels) OU repli sur
  // 'meteor:hit' (le flash réel, émis par event-impact.js).
  A.on('impact:playerblast', onBlastEvent);
  A.on('meteor:hit', onBlastEvent);
  // v11 — Phase 8 : la fusée ENTRE dans le Point Zéro -> ONDE DE CHOC qui
  // PROPULSE le joueur TRÈS HAUT et TRÈS LOIN (v12 : le joueur FLOTTE avec
  // une animation de nage dans les airs, plus de culbute).
  A.on('rocket:zeroshock', function () {
    var Az = AZ();
    if (!Az || !Az.active) return;
    var ps = players();
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (!p || p.bot || hidden[p.id] || !p.alive || !p.deployed) continue;
      if (p._meteorRide) continue; // v36 : le rider reste sur la météorite
      var gd = getDyn(p);
      if (gd.mode === 'zeroshock') continue; // déjà propulsé
      kickZeroShock(p);
    }
  });
}

/* ---------- v16 — Télégraphes d'avertissement (mise en scène) ----------
 * Le joueur est TOUJOURS prévenu AVANT de subir une impulsion : des
 * avertissements one-shot sont émis sur le bus ~2 s avant chaque grand
 * moment subi (onde de choc du Point Zéro, onde de 'thrown', projection
 * de 'veeroff', blast de l'impact, aspiration du trou noir).
 * event-hud.js affiche une pastille d'alerte, event-audio.js joue une
 * montée d'alerte. AJOUTS UNIQUEMENT : les kicks existants sont inchangés.
 * Tous les seuils sont RELATIFS (tState + durées lues dans TIMELINE) —
 * jamais de temps absolus en dur. */
var warned = {};    // nom d'avertissement -> true (un seul par passage)
var warnState = ''; // phase lors du dernier balayage

function checkWarns(state, tS) {
  if (state !== warnState) { warned = {}; warnState = state; }
  var A = AZ();
  var TL = (A && A.TIMELINE) || {};
  function durOf(name, fallback) {
    var b = TL[name];
    return (b && b.length === 2 && b[1] > b[0]) ? (b[1] - b[0]) : fallback;
  }
  function fire(name, cond) {
    if (warned[name] || !cond) return;
    warned[name] = true;
    busEmit(name, { phase: state, tState: tS });
  }
  if (state === 'strike') {
    // Contact fusée n°1 / Point Zéro à strike tState ≈ 9 (STRIKE_IMPACT,
    // event-rockets.js) : le joueur est averti ~2 s AVANT d'être propulsé.
    fire('warn:zeroshock', tS >= 7);
    // L'entrée en 'thrown' suit la fin de la phase : averti ~1,5 s avant
    // que l'onde de choc ne frappe (kickThrown à l'entrée de phase).
    fire('warn:thrown', tS >= durOf('strike', 14) - 1.5);
  } else if (state === 'descent') {
    // 'veeroff' suit 'descent' : averti ~2 s AVANT d'être projeté très haut.
    fire('warn:veer', tS >= durOf('descent', 18) - 2);
  } else if (state === 'impact') {
    // v16 : le flash part sur le CONTACT RÉEL (météorite ↔ Point Zéro,
    // ~41 % de la phase, event-impact.js) — averti ~3 s AVANT ce contact
    // (la pastille 'IMPACT FINAL' de l'entrée de phase est déjà loin
    // derrière — le joueur aurait oublié).
    var idur = durOf('impact', 55);
    fire('warn:blast', tS >= idur * 0.41 - 3);
  } else if (state === 'destruction') {
    // 'playersucked' suit 'destruction' : averti ~2,5 s AVANT l'aspiration.
    fire('warn:suck', tS >= durOf('destruction', 9) - 2.5);
  }
}

/* ---------- preUpdate : AVANT la simulation ---------- */
function preUpdate(dt, t) {
  var A = AZ();
  if (!A || !A.active) return;
  installDamageWrap();
  installBotWrap();

  var state = A.state;
  checkWarns(state, A.tState || 0); // v16 : télégraphes d'avertissement (ajout)
  var ps = players();
  var infoDone = false;
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (!p) continue;
    saveOnce(p);

    // --- invulnérabilité : hp/shield au max, jamais à terre ---
    if (p.alive) {
      if (p.hp < 100) p.hp = 100;
      if (typeof p.shield === 'number' && p.shield < 100) p.shield = 100;
      p.downed = false;
      p.downTimer = 0;
    }

    // --- bots : parqués hors-champ, figés (restent vivants) ---
    // Compromis de fidélité assumé : "tous les autres joueurs projetés"
    // ne peut pas être montré sans réintroduire des bots visibles
    // (l'effet "poteau noir" rejeté par l'utilisateur).
    if (p.bot) {
      if (!hidden[p.id]) hidePlayer(p);
      p.y = HIDE_Y;
      p._eventHidden = true;
      continue;
    }

    // --- joueur caché (aspiré / disparu) : reste parqué ---
    if (hidden[p.id]) {
      p.y = HIDE_Y;
      p._eventHidden = true;
      continue;
    }
    if (!p.alive || !p.deployed) continue;

    // v36 : le joueur sur la météorite y RESTE (rider) — avant la physique.
    updateMeteorRide(p);
    if (p._meteorRide) {
      meteorSolid(p, dt);
      if (!infoDone) { publishPlayerInfo(p, state); infoDone = true; }
      continue;
    }

    // --- physique d'event (le joueur garde TOUJOURS ses touches) ---
    if (state === 'strike') {
      // v11 : la fusée ENTRE dans le Point Zéro -> le joueur est PROPULSÉ
      // (kickZeroShock via le bus 'rocket:zeroshock') et continue de voler
      // très haut pendant la fin de la phase.
      // v13 — REPLI : si le contact est passé (tState >= STRIKE_IMPACT = 9,
      // voir event-rockets.js) et que le joueur n'a pas été propulsé (bus
      // manqué, module rockets inactif...), on applique le kick DIRECTEMENT
      // sans passer par le bus — la propulsion est GARANTIE.
      var dz0 = getDyn(p);
      var tS = A.tState || 0;
      if (A.rocketDestroyed && dz0.mode !== 'zeroshock' && kicked[p.id] !== 'zeroshock' && !p._meteorRide) {
        kickZeroShock(p);
      }
      if (dz0.mode === 'zeroshock' || kicked[p.id] === 'zeroshock') {
        stepAir(p, dt, t, 2.2);
      }
    } else if (state === 'thrown') {
      // v11 : pas de double-kick — un joueur déjà propulsé par le zeroshock
      // (phase 8) continue son vol, plus haut et plus loin.
      if (kicked[p.id] !== 'thrown' && kicked[p.id] !== 'zeroshock' && !p._meteorRide) kickThrown(p);
      stepAir(p, dt, t, 2.2);
    } else if (state === 'veeroff') {
      if (kicked[p.id] !== 'veeroff' && !p._meteorRide) kickVeer(p);
      stepAir(p, dt, t, 2.4);
    } else if (isAirPhase(state)) {
      // greatrift / meteorsix / descent / impact : suspension continue,
      // SANS nouveau kick (transitions sans à-coup). 'blast' est préservé
      // après le kick de phase 14 (informatif pour le groupe E).
      // v12 : le zeroshock devient une suspension (la nage CONTINUE, en
      // flottant — le flag swim survit au changement de mode).
      var dm = getDyn(p);
      // v36 : le rider reste sur la météorite — pas de takeover aérien.
      if (!p._meteorRide) {
        if (dm.mode !== 'blast') dm.mode = 'suspend'; // v12 : zeroshock -> suspend (nage conservée)
        stepAir(p, dt, t, state === 'impact' ? 2.6 : 2.0);
      }
    } else if (state === 'contraction' || state === 'collapse' || state === 'growth') {
      stepDrift(p, dt, t, DRIFT_SPEED[state]);
    } else if (state === 'destruction') {
      // Dérive CROISSANTE pendant la destruction (durée lue dans TIMELINE).
      var TLd = (A.TIMELINE && A.TIMELINE.destruction) || [0, 9];
      var kk = clamp(A.tState / Math.max(1, TLd[1] - TLd[0]), 0, 1);
      stepDrift(p, dt, t, DESTRUCT_PULL0 + (DESTRUCT_PULL1 - DESTRUCT_PULL0) * smooth(kk));
    } else if (state === 'playersucked' || state === 'allgone') {
      // v12 : l'aspiration court aussi pendant 'allgone' (le joueur doit
      // être visiblement aspiré, pas juste caché à 'blackhole').
      // v13 : ÉJECTION du véhicule D'ABORD (même cause racine que le
      // zeroshock : _drive annulerait l'aspiration chaque frame), puis
      // aspiration avec REPLI garanti — le joueur bouge QUOI QU'IL ARRIVE.
      ejectFromVehicle(p);
      try {
        stepSuck(p, dt);
      } catch (e) {
        try { suckFallback(p, dt); } catch (e2) { /* ignore */ }
      }
    }

    // --- poussée résiduelle (s'amortit toute seule) ---
    stepPush(p, dt);

    // v14 : fusées SOLIDES — cylindres live (AZEvent.rocketBodies), aussi en
    // preUpdate pour que le joueur ne les traverse jamais entre deux frames.
    collideRocketBodies(p);
    meteorSolid(p, dt); // v32 : météorite SOLIDE (emporté + atterrissage)

    // v12 : fin de nage en SORTANT des phases aériennes (à l'intérieur des
    // phases aériennes, le flag swim survit aux changements de mode
    // zeroshock->suspend ; l'atterrissage est géré dans stepAir).
    // v14 : JAMAIS nettoyé tant que dn.mode === 'zeroshock' (même hors
    // phases aériennes listées).
    var dnS = getDyn(p);
    if (dnS.swim && dnS.mode !== 'zeroshock' && !isAirSwimPhase(state)) { dnS.swim = false; delete p._eventSwim; }

    // --- publication pour le groupe E (caméra) : joueur local ---
    // (avant le masquage : phase/mode restent à jour même quand le joueur
    // vient d'être aspiré — sa position lue est alors HIDE_Y, c'est honnête).
    if (!infoDone) { publishPlayerInfo(p, state); infoDone = true; }

    // --- disparition générale → finale noire : le joueur est dedans ---
    if (lateHideState(state)) hidePlayer(p);
  }
}

/* ---------- update : APRÈS la simulation ----------
// v9 : le joueur ne TRAVERSE plus les fusées ni le Point Zéro —
// collision sphérique simple (repoussé au bord), la sim garde le reste. */
function update(dt, t) {
  var A = AZ();
  if (!A || !A.active) return;
  var state = A.state;
  var ps = players();
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (!p || p.bot || hidden[p.id] || !p.alive || !p.deployed || p._eventHidden) continue;
    collideSolids(p, state);
    collideRocketBodies(p);   // v14 : fusées SOLIDES (cylindres live)
    meteorSolid(p, dt);       // v32 : météorite SOLIDE (emporté + atterrissage)
    postSimSwim(p, dt);       // v14 : clamp post-sim + portance + nage
    guardZeroShockRise(p);    // v18 : garantit le décollage (répare tout sabotage sim)
  }
}

// Repousse le joueur hors des volumes solides (fusées, Point Zéro).
function collideSolids(p, state) {
  var A = AZ();
  // Rocket collisions use visible live bodies, never stale cinematic anchors.
  // --- Point Zéro (centre + 25 m) : PAS pendant l'aspiration —
  // le joueur doit pouvoir être aspiré DEDANS.
  if (state !== 'playersucked' && state !== 'allgone' && A.meteorContactTime == null) {
    var c = A.zeroPointPos || center();
    pushOut(p, c.x, c.y, c.z, (A.zeroPointVisR || 26) + 0.6);
  }
}

// Repousse p hors de la sphère (cx,cy,cz,r) s'il est dedans.
function pushOut(p, cx, cy, cz, r) {
  var dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  var d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r || d2 < 0.0001) return;
  var d = Math.sqrt(d2);
  var k = r / d;
  p.x = cx + dx * k;
  p.y = cy + dy * k;
  p.z = cz + dz * k;
}

/* ---------- v36 — RIDER MÉTÉORITE : on y RESTE ---------- */
var METEOR_MARGIN = 0.14;
var surfaceRay = new root.THREE.Raycaster();
var surfaceOrigin = new root.THREE.Vector3();
var surfaceDown = new root.THREE.Vector3(0, -1, 0);
function meteorLiveR(A) {
  return (A.meteorVisR || A.meteorSolidR || 48) + METEOR_MARGIN;
}
function releaseMeteor(p) {
  p._meteorRide = false;
  p._meteorPin = p._meteorRideOffset = null;
  delete p._meteorPrevious;
}
function updateMeteorRide(p) {
  var A = AZ();
  if (!A || !A.active || !p.alive || p._eventHidden || hidden[p.id] ||
      A.meteorContactTime != null || lateHideState(A.state)) {
    releaseMeteor(p); return;
  }
  if (p._meteorRide || !A.meteorVisible || !A.meteorPos || A.tTotal < (p._meteorDetachUntil || 0)) return;
  var m = A.meteorPos, R = meteorLiveR(A);
  var dx = p.x - m.x, dy = p.y - m.y, dz = p.z - m.z;
  // Only descending onto the upper hemisphere is a landing, never touching the underside.
  if (dy > R * 0.45 && Math.hypot(dx, dy, dz) <= R + 8 && (p._vy || 0) <= 3) {
    p._meteorRide = true;
    p._meteorRideOffset = { x: dx, y: dy, z: dz };
    getDyn(p).swim = false;
    delete p._eventSwim;
    delete p._eventPose;
    p._eventFloat = false;
    meteorSolid(p, 0);
  }
}
function meteorSurfaceY(x, z) {
  var A = AZ(), m = A.meteorPos, R = meteorLiveR(A);
  var visual = A.eventVisuals && A.eventVisuals.meteor;
  if (visual && visual.rock) {
    visual.group.updateWorldMatrix(true, true);
    surfaceOrigin.set(x, m.y + R * 2, z);
    surfaceRay.set(surfaceOrigin, surfaceDown);
    var hits = surfaceRay.intersectObject(visual.rock, false);
    if (hits.length) return hits[0].point.y + METEOR_MARGIN;
  }
  return m.y + Math.sqrt(Math.max(0, R * R - Math.pow(x - m.x, 2) - Math.pow(z - m.z, 2)));
}
function meteorSolid(p, dt) {
  var A = AZ();
  if (!A || !A.active || !A.meteorPos || !A.meteorVisible) return;
  var m = A.meteorPos, R = meteorLiveR(A);
  if (p._meteorRide) {
    var off = p._meteorRideOffset || (p._meteorRideOffset = { x: 0, y: R, z: 0 });
    var previous = p._meteorPrevious;
    if (previous && Math.hypot(m.x - previous.x, m.y - previous.y, m.z - previous.z) > 200) {
      off.x = off.z = 0;
      var view = api && api.view();
      if (view) view._camMode = 'bus';
    }
    var horizontal = Math.hypot(off.x, off.z), limit = R * 0.62;
    if (horizontal > limit) { off.x *= limit / horizontal; off.z *= limit / horizontal; }
    p.x = m.x + off.x; p.z = m.z + off.z;
    p.y = Math.max(m.y + R * 0.5, meteorSurfaceY(p.x, p.z));
    off.y = p.y - m.y;
    p._meteorPrevious = { x: m.x, y: m.y, z: m.z };
    p._lastX = p.x; p._lastZ = p.z;
    p.grounded = true; p.falling = p.gliding = p.autoGlider = p.jumping = p.swimming = false;
    p._eventFloat = false; p.airborneFromBus = false;
    p._vy = 0; p._coyote = 0.12;
    delete p._eventSwim;
    return;
  }
  var dx = p.x - m.x, dy = p.y - m.y, dz = p.z - m.z, d = Math.hypot(dx, dy, dz);
  if (d < R && d > 0.0001) {
    var k = R / d; p.x = m.x + dx * k; p.y = m.y + dy * k; p.z = m.z + dz * k;
  }
}
AZ().stepMeteorRider = function (p, dt) {
  if (!p._meteorRide || !AZ().active) return false;
  if (AZ().meteorContactTime != null) { releaseMeteor(p); return false; }
  var inside = AZ().riftWorld && AZ().riftWorld.active;
  if (p._jumpBuffer > 0 && !inside) {
    releaseMeteor(p); p._meteorDetachUntil = AZ().tTotal + 1.2;
    p._jumpBuffer = 0; p._vy = 8.2; p.grounded = false; p.jumping = true; p._jumpTime = 0;
    return false;
  }
  if (inside) p._jumpBuffer = 0;
  var i = p._input || {}, mx = clamp(+i.moveX || 0, -1, 1), mz = clamp(+i.moveZ || 0, -1, 1);
  var len = Math.max(1, Math.hypot(mx, mz)), speed = i.sprint ? 7.5 : 4.5;
  var f = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }, off = p._meteorRideOffset;
  if (off) {
    off.x += (f.x * mz + Math.cos(p.yaw) * mx) / len * speed * dt;
    off.z += (f.z * mz - Math.sin(p.yaw) * mx) / len * speed * dt;
  }
  p._vx = mx * speed / len; p._vz = mz * speed / len;
  p.distance += Math.hypot(mx, mz) / len * speed * dt;
  meteorSolid(p, dt);
  return true;
};

/* ---------- v14 — Fusées SOLIDES ----------
 * event-rockets.js publie CHAQUE frame window.AZEvent.rocketBodies :
 * [{x, y, z, r, top}] (x,z = centre, y = base de la fusée, top = sommet,
 * r = rayon en mètres), uniquement pour les fusées visibles/actives.
 * Lecture DÉFENSIVE : tableau absent/vide = rien à faire, entrées
 * malformées ignorées, jamais de throw. Le joueur (vivant, non caché)
 * est repoussé horizontalement hors du cylindre (r + marge joueur),
 * _vy CONSERVÉ (on ne pilote que le plan horizontal). S'applique en
 * preUpdate ET en update(), y compris pendant 'zeroshock'/'suck' : une
 * fusée reste solide même en vol — le push-out radial est local et ne
 * casse pas la trajectoire d'aspiration vers le Point Zéro. */
function collideRocketBodies(p) {
  var bodies = null;
  try {
    var A = AZ();
    var rb = A && A.rocketBodies;
    if (rb && typeof rb.length === 'number') bodies = rb;
  } catch (e) { bodies = null; }
  if (!bodies || !bodies.length) return;
  for (var i = 0; i < bodies.length; i++) {
    var b = bodies[i];
    if (!b) continue;
    try { pushOutCylinder(p, b); } catch (e) { /* jamais bloquant */ }
  }
}

// Repousse p horizontalement hors du cylindre de la fusée {x,y,z,r,top}.
function pushOutCylinder(p, b) {
  if (b.a && b.b) {
    var ax = b.b.x - b.a.x, ay = b.b.y - b.a.y, az = b.b.z - b.a.z, lengthSq = ax * ax + ay * ay + az * az;
    if (lengthSq < 0.001) return;
    var t = clamp(((p.x - b.a.x) * ax + (p.y + 0.9 - b.a.y) * ay + (p.z - b.a.z) * az) / lengthSq, 0, 1);
    var cx = b.a.x + ax * t, cy = b.a.y + ay * t, cz = b.a.z + az * t;
    var dx = p.x - cx, dy = p.y + 0.9 - cy, dz = p.z - cz, distance = Math.hypot(dx, dy, dz), radius = b.r + ROCKET_BODY_MARGIN;
    if (distance >= radius) return;
    if (distance < 0.0001) { dx = 1; dy = dz = 0; distance = 1; }
    var push = radius / distance - 1; p.x += dx * push; p.y += dy * push; p.z += dz * push;
    return;
  }
  var bx = b.x, bz = b.z;
  if (typeof bx !== 'number' || typeof bz !== 'number' ||
      !isFinite(bx) || !isFinite(bz)) return;
  var r = (typeof b.r === 'number' && isFinite(b.r) ? b.r : 0) + ROCKET_BODY_MARGIN;
  if (r <= 0) return;
  var base = (typeof b.y === 'number' && isFinite(b.y)) ? b.y : -1e9;
  var top = (typeof b.top === 'number' && isFinite(b.top)) ? b.top : 1e9;
  // Bande verticale : entre (base - tolérance) et (top + tolérance).
  if (p.y < base - ROCKET_BODY_YTOL || p.y > top + ROCKET_BODY_YTOL) return;
  var dx = p.x - bx, dz = p.z - bz;
  var d2 = dx * dx + dz * dz;
  var rr = r * r;
  if (d2 >= rr) return;
  var d = Math.sqrt(d2);
  if (d < 0.0001) { dx = 1; dz = 0; d = 1; } // pile au centre : direction arbitraire
  var k = r / d;
  p.x = bx + dx * k;
  p.z = bz + dz * k;
  // _vy conservé : on ne pilote que le plan horizontal.
}

/* ---------- v14 — Flottement ROBUSTE post-simulation ----------
 * update() tourne APRÈS la boucle de simulation du jeu : la gravité du jeu
 * a ré-accéléré le joueur vers le bas entre preUpdate et le rendu — cause
 * probable de la chute libre vue sur iPhone malgré le clamp preUpdate de
 * v12. Tant que la nage est active (dn.swim) :
 *  - plancher _vy à -SWIM_SINK_FLOOR (ZÉRO chute libre) — annule la gravité
 *    ré-appliquée par le jeu ;
 *  - avancement de l'animation _eventSwim (une fois par frame, post-sim) ;
 *  - portance douce pendant le zeroshock : suivi de l'apogée du kick, et si
 *    le joueur redescend sous (apogée - marge) avec _vy < 0, poussée douce
 *    vers le haut (plafonnée à 0 : freine la descente, ne fait pas remonter).
 * stepDrift (contraction/destruction…) pilote p.y directement et met
 * _vy = 0 : la portance ne bloque PAS la descente ultérieure. Le joueur
 * garde ses touches — on ne pilote que _vy. */
function postSimSwim(p, dt) {
  var dn = dyn[p.id];
  if (!dn || !dn.swim) return;
  // v24 : planeur MANUEL ouvert → le VERTICAL appartient au joueur : ni le
  // plancher post-sim ni la portance zeroshock n'écrivent _vy (l'animation
  // de nage, purement visuelle, continue d'avancer).
  var manual = manualGlider(p);
  // Plancher post-sim : annule la gravité appliquée par le jeu après preUpdate.
  if (!manual && typeof p._vy === 'number' && isFinite(p._vy) && p._vy < -SWIM_SINK_FLOOR) {
    p._vy = -SWIM_SINK_FLOOR;
  }
  // Animation de nage : avance une fois par frame, post-sim.
  if (typeof p._eventSwim === 'number' && isFinite(p._eventSwim)) {
    p._eventSwim += dt;
  } else {
    p._eventSwim = 0;
  }
  // Suivi de l'apogée + portance pendant le zeroshock (« rester en haut »).
  if (dn.mode === 'zeroshock' && !manual) {
    if (typeof dn.apexY !== 'number' || !isFinite(dn.apexY) || p.y > dn.apexY) dn.apexY = p.y;
    if (p._vy < 0 && p.y < dn.apexY - ZSHOCK_LIFT_MARGIN) {
      p._vy += ZSHOCK_LIFT * dt;
      if (p._vy > 0) p._vy = 0; // douce : freine la descente, ne remonte pas
    }
  }
}

/* ---------- v18 — Garde-fou post-sim de la propulsion ----------
 * update() tourne APRÈS la simulation du jeu : si, pendant la fenêtre de
 * montée du zeroshock, le joueur est encore collé au sol (p.grounded, y au
 * niveau du point de départ) alors que la cible de montée est encore très
 * positive, c'est qu'un chemin de sim.js a mangé l'impulsion (ex. le
 * planeur auto d'avant le fix) — on défait le sabotage (pas de planeur
 * auto, pas de sol, état de vol forcé) et on ré-applique la vitesse de
 * montée. Ne se déclenche JAMAIS sur un atterrissage légitime : 2-3 s
 * après un kick à 430 m/s, toucher le sol est impossible autrement.
 * Le joueur garde ses touches : on ne pilote que l'axe vertical. */
var ZSHOCK_RISE_GUARD_T = 6;   // v18 : fenêtre de montée surveillée (s)
var ZSHOCK_RISE_GUARD_VY = 60; // v18 : cible de montée encore « fusée » (m/s)
function guardZeroShockRise(p) {
  var dn = dyn[p.id];
  if (!dn || dn.mode !== 'zeroshock' || !dn.swim) return;
  // v24 : le garde-fou ne se déclenche PAS quand le joueur a ouvert
  // MANUELLEMENT son parachute — écraser son gliding/falling/_vy ici
  // annulerait son planeur. En revanche le planeur AUTO (p.autoGlider)
  // n'est toujours pas respecté : le garde-fou continue de le réparer
  // (leçon v18 — seule l'ouverture manuelle compte).
  if (manualGlider(p)) return;
  if (!(dn.airT < ZSHOCK_RISE_GUARD_T)) return;
  var riseTarget = ZEROSHOCK_VY * Math.exp(-dn.airT * RISE_EASE);
  if (riseTarget < ZSHOCK_RISE_GUARD_VY) return;
  var glued = !!p.grounded &&
    (typeof dn.apexY !== 'number' || !isFinite(dn.apexY) || p.y <= dn.apexY + 0.6);
  if (!glued) return;
  // Répare : aucun état de sim ne doit retenir le joueur au sol ici.
  p.airborneFromBus = false;
  p.gliding = false; p.autoGlider = false;
  p.swimming = false;
  p.grounded = false; p.jumping = false; p.falling = true;
  if (typeof p._vy !== 'number' || !isFinite(p._vy) || p._vy < riseTarget * 0.5) {
    p._vy = riseTarget * 0.55; // ré-applique la montée (même amorce que le kick)
  }
}

/* ---------- Cycle de vie ---------- */
function init(a) {
  api = a;
  saved = {};
  push = {};
  dyn = {};
  hidden = {};
  kicked = {};
  warned = {};      // v16 : réarme les télégraphes d'avertissement
  warnState = '';
  installDamageWrap();
  installBotWrap();
  installSwimWrap(); // v12 : nage dans les airs (remplace la culbute v11)
  bindBusOnce();
}

function dispose() {
  restoreDamageWrap();
  restoreBotWrap();
  restoreSwimWrap(); // v12 : rend l'animateAvatar d'origine
  // Restaure chaque joueur à sa position d'origine.
  var ps = players();
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (!p) continue;
    var s = saved[p.id];
    if (s) {
      p.x = s.x; p.y = s.y; p.z = s.z;
      if (typeof s.yaw === 'number') p.yaw = s.yaw;
    }
    p._eventHidden = false;
    p._vy = 0;
    releaseMeteor(p);
    delete p._meteorDetachUntil;
    delete p._eventSwim; // v12 : nettoie la nage
    delete p._eventSwimFade;  // v15 : nettoie le fondu d'entrée/sortie
    delete p._eventSwimLast;
    delete p._eventFloat;
    delete p._eventVerticalVelocity;
    delete p._eventPose;
  }
  saved = {};
  push = {};
  dyn = {};
  hidden = {};
  kicked = {};
  warned = {};      // v16 : réarme les télégraphes d'avertissement
  warnState = '';
  if (AZ() && AZ().playerInfo) AZ().playerInfo.phase = 'idle';
  api = null;
}

AZ().register('player', {
  init: init,
  preUpdate: preUpdate,
  beforeRender: update,
  dispose: dispose
});

})(window);
