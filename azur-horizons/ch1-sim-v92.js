/* AZUR v92 — ch1-sim-v92.js : règles de déroulé "Chapitre 1" (design/azur-reference-spec.md §3).
 * Couche chargée juste après build-rules.js ; enrobe AZSim.World.prototype (navigateur seulement :
 * le test Node tools/azur/sim-smoke.cjs charge sim.js seul et garde l'ancien déroulé).
 *  - Trajet du bus tiré à chaque partie : une droite qui traverse l'île dans une direction et avec un
 *    décalage dérivés de la graine de la partie (déterministe pour une graine donnée), même vitesse
 *    qu'avant, durée ajustée à la longueur du trajet.
 *  - Attente sur l'île de départ allongée à WAIT secondes (émotes, armes d'entraînement), exposée
 *    en w.ch1WaitLeft pour l'interface. */
(function (root) {
  "use strict";
  const S = root.AZSim;
  if (!S || !S.World || !S.MAP || !S.MAP.transport || S.World.prototype.__ch1Sim) return;
  const P = S.World.prototype;
  P.__ch1Sim = true;

  const WAIT = 30; // secondes sur l'île de départ (le cœur de sim.js part à 10 s)
  const BASE = Object.assign({}, S.MAP.transport);
  const SPEED = Math.hypot(BASE.velocityX, BASE.velocityZ);
  const BR = (w) => !["creative", "training", "event"].includes(w.mode);
  // hachage entier → [0,1) : ne touche pas au générateur aléatoire de la simulation
  function frac(n) {
    let x = (n | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  function planRoute(w) {
    const tr = S.MAP.transport, R = S.MAP.landRadius || 800;
    const seed = Math.abs(Math.floor(+w.seed || 1)) + 1;
    const a = frac(seed * 7 + 1) * Math.PI * 2;
    const off = (frac(seed * 13 + 5) - 0.5) * 0.6 * R;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const half = Math.sqrt(Math.max(0, R * R - off * off)) + 160;
    tr.startX = px * off - dx * half;
    tr.startZ = pz * off - dz * half;
    tr.velocityX = dx * SPEED;
    tr.velocityZ = dz * SPEED;
    tr.duration = (2 * half) / SPEED;
    tr.altitude = BASE.altitude;
    if (w.aircraft) {
      w.aircraft.x = tr.startX;
      w.aircraft.z = tr.startZ;
      w.aircraft.y = tr.altitude;
      w.aircraft.yaw = Math.atan2(-dx, -dz);
    }
  }

  const prevStep = P.step;
  P.step = function (dt) {
    if (!this.__ch1Route) {
      this.__ch1Route = true;
      if (BR(this)) planRoute(this);
      else Object.assign(S.MAP.transport, BASE);
      this.__ch1Wait = 0;
    }
    if (this.phase === "waiting" && BR(this)) {
      const d = Math.min(0.05, Math.max(0, +dt || 0));
      this.__ch1Wait += d;
      // le cœur passe au bus à phaseTime ≥ 10 : on le retient jusqu'à la fin de l'attente
      if (this.__ch1Wait < WAIT - 0.1) this.phaseTime = Math.min(this.phaseTime, 9.9 - d);
      this.ch1WaitLeft = Math.max(0, WAIT - this.__ch1Wait);
    } else this.ch1WaitLeft = 0;
    return prevStep.apply(this, arguments);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
