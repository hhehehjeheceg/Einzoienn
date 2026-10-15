/* Horizons 1.4 — endurance des IA, altitude de transport et animation de personnage. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons;
  if (!H) return;
  const P = H.prototype;

  const previousRenderMenu = P.renderMenu;
  P.renderMenu = function () {
    previousRenderMenu.call(this);
    const currency = document.querySelector(".currency");
    if (currency) {
      currency.setAttribute("aria-label", `${this.profile.coins.toLocaleString("fr-FR")} écus de corail`);
      currency.title = "Écus de corail disponibles";
    }
    document.querySelectorAll(".wordmark-edition,.season-badge").forEach((node) => {
      node.innerHTML = node.innerHTML.replace(/1\.3/g, "1.4");
    });
  };

  const previousLobbyHTML = P.lobbyHTML;
  P.lobbyHTML = function () {
    return previousLobbyHTML.call(this)
      .replace(/HORIZONS 1\.3/g, "HORIZONS 1.4")
      .replace("Planeur Alizé", "Planeur Alizé Mk II");
  };

  const previousUpdateHUD = P.updateHUD;
  P.updateHUD = function () {
    previousUpdateHUD.call(this);
    if (this.screen !== "game") return;
    const p = this.player?.();
    if (this.world?.phase === "transport" && p && !p.deployed) {
      const detail = document.getElementById("phase-detail");
      if (detail) detail.textContent = `${detail.textContent} · ALT. ${Math.round(this.world.aircraft?.y || 560)} M`;
    }
  };

  /* Une inertie courte relie les pas, les changements de direction et la posture.
     Elle n’ajoute aucun calcul de squelette aux acteurs lointains. */
  const V = root.AZView?.View?.prototype;
  if (V?.animateAvatar) {
    const previousAnimateAvatar = V.animateAvatar;
    V.animateAvatar = function (model, player, dt, options) {
      previousAnimateAvatar.call(this, model, player, dt, options);
      const u = model?.userData;
      if (!u || options?.menu || player.gliding || player.falling || player.flying || player.swimming || player.downed) return;
      const x = Number(player.x) || 0, z = Number(player.z) || 0, yaw = Number(player.yaw) || 0;
      const lastX = Number.isFinite(u.v14X) ? u.v14X : x, lastZ = Number.isFinite(u.v14Z) ? u.v14Z : z;
      const speed = Math.min(12, Math.hypot(x - lastX, z - lastZ) / Math.max(.001, dt));
      const lastYaw = Number.isFinite(u.v14Yaw) ? u.v14Yaw : yaw;
      const turn = Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw));
      u.v14X = x; u.v14Z = z; u.v14Yaw = yaw;
      u.v14Lean = (u.v14Lean || 0) + (Math.max(-1, Math.min(1, turn / Math.max(.03, dt * 5))) - (u.v14Lean || 0)) * (1 - Math.exp(-dt * 9));
      if (speed > .2 && player.grounded !== false) {
        model.rotation.z += u.v14Lean * .045;
        if (u.torso) {
          u.torso.rotation.y += u.v14Lean * .055;
          u.torso.position.y += Math.sin((u.anim || 0) * 2) * Math.min(.012, speed * .0012);
        }
        if (u.head) u.head.rotation.y -= u.v14Lean * .07;
      }
    };
  }
})(window);
