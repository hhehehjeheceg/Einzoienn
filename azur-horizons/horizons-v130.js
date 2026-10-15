/* Horizons 1.3 — action pêche unifiée, retours manette et finition multi-supports. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons;
  if (!H) return;
  const P = H.prototype;

  const connectedPad = () => {
    if (typeof navigator.getGamepads !== "function") return null;
    return Array.from(navigator.getGamepads()).find(Boolean) || null;
  };
  const controllerFamily = (pad) => {
    const id = String(pad?.id || "").toLowerCase();
    if (/dualsense|dualshock|playstation|054c/.test(id)) return { name: "PLAYSTATION", fire: "R2", jump: "✕", edit: "↑" };
    if (/xbox|xinput|045e/.test(id)) return { name: "XBOX", fire: "RT", jump: "A", edit: "↑" };
    if (/nintendo|switch|joy-con|057e/.test(id)) return { name: "NINTENDO", fire: "ZR", jump: "B", edit: "↑" };
    return { name: "MANETTE", fire: "RT / R2", jump: "A / ✕", edit: "↑" };
  };
  const fishingAction = (game) => {
    const p = game.player?.();
    return !!(p && (p.fishing || (game.harvest && game.world?._fishable?.(p))));
  };
  const removeLegacyFishingButtons = () => {
    document.querySelectorAll('[data-act="fish"]').forEach((node) => node.remove());
  };
  const pulsePad = (strong, weak, duration) => {
    const pad = connectedPad();
    const actuator = pad?.vibrationActuator;
    if (!actuator?.playEffect) return;
    actuator.playEffect("dual-rumble", {
      duration: duration || 55,
      strongMagnitude: Math.max(0, Math.min(1, strong || 0)),
      weakMagnitude: Math.max(0, Math.min(1, weak || 0)),
    }).catch(() => {});
  };

  const previousFireOnce = P.fireOnce;
  P.fireOnce = function () {
    if (fishingAction(this)) {
      this.fire = false;
      this.send({ fish: true });
      this.actionTime = this.frameTime;
      pulsePad(.16, .42, 75);
      return;
    }
    return previousFireOnce.call(this);
  };

  const previousStartGameUI = P.startGameUI;
  P.startGameUI = function () {
    previousStartGameUI.call(this);
    removeLegacyFishingButtons();
    const emote = document.querySelector('.touch-emote-mini, .touch-btn[data-act="emote"]');
    if (emote) {
      emote.classList.add("touch-emote-mini", "v13-emote-dock");
      emote.setAttribute("aria-label", "Ouvrir les petites emotes");
    }
    const status = document.getElementById("gamepad-status");
    if (status) status.setAttribute("aria-live", "polite");
  };

  const previousUpdateHUD = P.updateHUD;
  P.updateHUD = function () {
    previousUpdateHUD.call(this);
    if (this.screen !== "game") return;
    removeLegacyFishingButtons();
    const p = this.player?.();
    const context = fishingAction(this);
    document.body.classList.toggle("fishing-ready", !!context);
    const fire = document.getElementById("touch-fire");
    if (fire && context) {
      const label = fire.querySelector("span");
      if (label) label.textContent = p?.fishing ? "RAMENER" : "LANCER";
      fire.classList.add("fishing-fire");
    } else fire?.classList.remove("fishing-fire");
    const status = document.getElementById("gamepad-status");
    const pad = connectedPad();
    if (status && pad) {
      const family = controllerFamily(pad);
      status.textContent = `${family.name} · ${family.fire} ACTION · ${family.edit} MODIFIER`;
    }
  };

  const previousControllerFrame = P.controllerFrame;
  P.controllerFrame = function (time) {
    previousControllerFrame.call(this, time);
    const pad = connectedPad();
    if (!pad) {
      delete document.body.dataset.controller;
      return;
    }
    const family = controllerFamily(pad);
    document.body.dataset.controller = family.name.toLowerCase();
    const status = document.getElementById("gamepad-status");
    if (status && status.dataset.padId !== String(pad.index)) {
      status.dataset.padId = String(pad.index);
      status.textContent = `${family.name} · ${family.fire} ACTION · ${family.edit} MODIFIER`;
    }
  };

  const previousOnEvent = P.onEvent;
  P.onEvent = function (event) {
    const result = previousOnEvent.call(this, event);
    if (event?.playerId === this.myId) {
      if (event.type === "shot") pulsePad(.12, .28, 42);
      else if (event.type === "build") pulsePad(.18, .36, 62);
      else if (event.type === "edit") pulsePad(.10, .24, 48);
      else if (event.type === "fish") pulsePad(.34, .72, 160);
    }
    return result;
  };

  const previousLobbyHTML = P.lobbyHTML;
  P.lobbyHTML = function () {
    return previousLobbyHTML.call(this)
      .replace("PC · MOBILE · MANETTE", "PC · MOBILE · MANETTES STANDARD")
      .replace("Planeur Alizé · PC, mobile et manette.", "Planeur Alizé · clavier, tactile et manettes standard.");
  };

  const previousHelpHTML = P.helpHTML;
  P.helpHTML = function () {
    return previousHelpHTML.call(this)
      .replace("<h3>MANETTE</h3>", '<h3>MANETTE · XBOX / PLAYSTATION / SWITCH</h3>')
      .replace("<b>↑</b> modifier", "<b>↑</b> modifier directement la pièce visée");
  };

  /* v21 — sons d'interface et micro-animation des boutons (punch easé en JS).
     Le punch est sauté si prefers-reduced-motion ; les sons restent discrets. */
  if (!root.__v21UiFx) {
    root.__v21UiFx = true;
    let lastHover = 0, lastPunch = 0;
    const gameOf = () => root.AZUR;
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target?.closest?.("button, select, input");
      if (!btn) return;
      const g = gameOf();
      if (btn.dataset?.act === "tab" && g?.audio && !g.audio.disabled) { try { g.audio.uiTab(); } catch (err) {} }
      if (root.AZV21.reducedMotion()) return;
      if (btn.tagName !== "BUTTON") return;
      const now = performance.now();
      if (now - lastPunch < 70) return;
      lastPunch = now;
      try {
        btn.style.transform = "scale(.94)";
        root.AZV21.tween(160,
          (k) => { btn.style.transform = "scale(" + (0.94 + 0.06 * k).toFixed(3) + ")"; },
          () => { btn.style.transform = ""; });
      } catch (err) {}
    }, { passive: true });
    document.addEventListener("mouseover", (e) => {
      const btn = e.target?.closest?.("button");
      if (!btn) return;
      try { if (!matchMedia("(hover:hover)").matches) return; } catch (err) { return; }
      const now = performance.now();
      if (now - lastHover < 130) return;
      lastHover = now;
      try { gameOf()?.audio?.uiHover(); } catch (err) {}
    }, { passive: true });
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-act], button");
      if (!el) return;
      if (el.dataset?.act === "tab") return; // déjà joué au pointerdown
      try { gameOf()?.audio?.uiClick(); } catch (err) {}
    });
  }

  const previousToast = P.toast;
  P.toast = function (text, error, kind) {
    if (error) { try { this.audio?.uiError(); } catch (e) {} }
    return previousToast.call(this, text, error, kind);
  };
})(window);
