/* Horizons 1.2 — action principale contextuelle et prise en charge des manettes standard. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons;
  if (!H) return;
  const P = H.prototype;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dead = (v, zone = 0.16) => Math.abs(v || 0) < zone ? 0 : Math.sign(v) * (Math.abs(v) - zone) / (1 - zone);
  const pressed = (button) => !!button && (button.pressed || button.value > 0.45);
  const pads = () => typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  const buildTypes = ["wall", "floor", "ramp", "roof"];

  function fishingContext(game) {
    const p = game.player?.();
    return !!(p && game.harvest && game.world?._fishable?.(p));
  }
  function visibleControls(game) {
    const host = game.overlay?.children.length ? game.overlay : game.ui;
    return [...host.querySelectorAll("button:not([disabled]), select:not([disabled]), input:not([disabled])")]
      .filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden");
  }
  function moveFocus(game, delta) {
    const all = visibleControls(game);
    if (!all.length) return;
    const current = all.indexOf(document.activeElement);
    all[(current + delta + all.length) % all.length].focus({ preventScroll: true });
  }
  function controllerBack(game) {
    const close = game.overlay?.querySelector('[data-act="resume"], [data-act="edit-cancel"], [data-act="confirm-cancel"], [data-act="close-modes"]');
    if (close) close.click();
    else if (game.screen === "menu" && game.tab !== "play") game.action?.("tab", "play");
  }
  function showController(game, pad) {
    if (game._shownController === pad.index) return;
    game._shownController = pad.index;
    document.body.classList.add("gamepad-ui");
    const status = document.getElementById("gamepad-status");
    if (status) status.textContent = "MANETTE CONNECTÉE";
    game.toast?.("Manette connectée · sticks, gâchettes et croix directionnelle actifs");
  }

  const baseFireOnce = P.fireOnce;
  P.fireOnce = function () {
    if (fishingContext(this)) {
      this.fire = false;
      this.send({ fish: true });
      this.actionTime = this.frameTime;
      return;
    }
    return baseFireOnce.call(this);
  };

  const baseStartGameUI = P.startGameUI;
  P.startGameUI = function () {
    baseStartGameUI.call(this);
    document.querySelectorAll('[data-act="fish"]').forEach((node) => node.remove());
    document.querySelectorAll('[data-act="touch-more"]').forEach((node) => node.remove());
    const controls = document.querySelector(".touch-controls");
    const utility = document.getElementById("touch-utility");
    const emote = utility?.querySelector('[data-act="emote"]');
    if (controls && emote) {
      emote.classList.add("touch-emote-mini");
      controls.append(emote);
    }
    if (utility) {
      if (utility.querySelector("button")) {
        utility.hidden = false;
        utility.classList.add("creative-utility");
      } else utility.remove();
    }
    const hud = document.querySelector(".hud");
    if (hud && !document.getElementById("gamepad-status")) {
      const status = document.createElement("div");
      status.id = "gamepad-status";
      status.className = "gamepad-status";
      status.textContent = "MANETTE";
      hud.append(status);
    }
  };

  const baseLobbyHTML = P.lobbyHTML;
  P.lobbyHTML = function () {
    return baseLobbyHTML.call(this)
      .replace(/<span>(TACTILE|PC)<\/span><\/div><\/div><\/aside>/, "<span>PC · MOBILE · MANETTE</span></div></div></aside>")
      .replace("Planeur Alizé.</p>", "Planeur Alizé · PC, mobile et manette.</p>");
  };

  const baseHelpHTML = P.helpHTML;
  P.helpHTML = function () {
    const html = baseHelpHTML.call(this)
      .replace("Clic gauche / bouton TIR", "Clic gauche / TIR / RT-R2")
      .replace("T / P", "T / bouton ÉMOTE")
      .replace("Emote / pêcher au bord de l’océan", "Emote / tirer avec la canne au bord de l’océan")
      .replace("Clavier, souris et tactile.", "Clavier, souris, tactile et manette.");
    const controller = '<article class="controller-help"><h3>MANETTE</h3><p><b>Stick gauche</b> bouger · <b>stick droit</b> caméra · <b>RT / R2</b> tirer, poser ou lancer la canne · <b>LT / L2</b> viser · <b>A / ✕</b> sauter · <b>X / □</b> recharger · <b>B / ○</b> construire · <b>Y / △</b> pioche · <b>LB / RB</b> inventaire · <b>↑</b> modifier · <b>↓</b> interagir · <b>Menu</b> pause.</p></article>';
    return html.replace('<section class="help-cards">', '<section class="help-cards">' + controller);
  };

  const baseUpdateHUD = P.updateHUD;
  P.updateHUD = function () {
    baseUpdateHUD.call(this);
    if (this.screen !== "game") return;
    const p = this.player?.();
    const context = fishingContext(this) || !!p?.fishing;
    const fire = document.getElementById("touch-fire");
    if (fire && context) {
      const label = fire.querySelector("span");
      if (label) label.textContent = p?.fishing ? "RAMENER" : "TIRER";
      fire.setAttribute("aria-label", p?.fishing ? "Ramener ou annuler la ligne" : "Tirer pour lancer la canne à pêche");
    }
    const ammo = document.getElementById("ammo");
    if (ammo && context) ammo.innerHTML = p?.fishing
      ? `<strong>CANNE À PÊCHE</strong><small>PRISE DANS ${Math.max(1, Math.ceil(p.fishing))} s · TIR POUR ANNULER</small>`
      : "<strong>CANNE À PÊCHE</strong><small>TIR / RT-R2 POUR LANCER</small>";
    const prompt = document.getElementById("interaction");
    if (prompt && context) {
      prompt.hidden = false;
      prompt.textContent = p?.fishing ? "TIR / RT-R2 · ANNULER LA LIGNE" : "TIR / RT-R2 · LANCER LA LIGNE";
    }
    const hint = document.querySelector(".game-hint");
    if (hint && document.body.classList.contains("gamepad-ui")) hint.innerHTML = "<kbd>STICKS</kbd> Bouger / viser · <kbd>RT</kbd> Action · <kbd>↑</kbd> Modifier";
  };

  const baseInput = P.input;
  P.input = function () {
    const input = baseInput.call(this);
    const state = this._padState;
    if (!state || this.screen !== "game" || this.modal || this.editing) return input;
    input.moveX = clamp(input.moveX + state.lx, -1, 1);
    input.moveZ = clamp(input.moveZ - state.ly, -1, 1);
    input.sprint = input.sprint || state.sprint || Math.hypot(state.lx, state.ly) > .94;
    input.aim = !!state.aim && !this.harvest && !this.buildType;
    input.fire = !!state.fire && !this.buildType && !this.harvest;
    return input;
  };

  P.controllerFrame = function (time) {
    const pad = pads()[0];
    if (!pad) {
      this._padState = null;
      this._padButtons = [];
      document.body.classList.remove("gamepad-ui");
      return;
    }
    showController(this, pad);
    const buttons = pad.buttons.map(pressed), previous = this._padButtons || [];
    const edge = (i) => buttons[i] && !previous[i];
    const lx = dead(pad.axes[0]), ly = dead(pad.axes[1]), rx = dead(pad.axes[2]), ry = dead(pad.axes[3]);
    this._padState = { lx, ly, rx, ry, aim: buttons[6], fire: buttons[7], sprint: buttons[10] };

    if (this.screen !== "game" || this.modal) {
      const vertical = buttons[12] || ly < -.65 ? -1 : buttons[13] || ly > .65 ? 1 : 0;
      const horizontal = buttons[14] || lx < -.65 ? -1 : buttons[15] || lx > .65 ? 1 : 0;
      if ((vertical || horizontal) && time > (this._padNavAt || 0) + 165) {
        moveFocus(this, vertical || horizontal);
        this._padNavAt = time;
      }
      if (edge(0)) (document.activeElement?.matches("button,select,input") ? document.activeElement : visibleControls(this)[0])?.click();
      if (edge(1)) controllerBack(this);
      this._padButtons = buttons;
      return;
    }

    if (this.editing) {
      const cells = [...document.querySelectorAll('[data-act="edit-cell"]')];
      this._editPadCell = clamp(this._editPadCell ?? 4, 0, 8);
      let next = this._editPadCell;
      if (edge(12)) next -= 3;
      if (edge(13)) next += 3;
      if (edge(14)) next -= 1;
      if (edge(15)) next += 1;
      this._editPadCell = clamp(next, 0, 8);
      cells[this._editPadCell]?.focus({ preventScroll: true });
      if (edge(0)) cells[this._editPadCell]?.click();
      if (edge(3)) this.action("edit-confirm");
      if (edge(1)) this.action("edit-cancel");
      this._padButtons = buttons;
      return;
    }

    if (rx || ry) this.look(rx * 8.5, ry * 7.2);
    this.aim = !!buttons[6];
    const fishing = fishingContext(this);
    this.fire = !!buttons[7] && !fishing;
    if (edge(7)) { this.fire = true; this.fireOnce(); if (fishing) this.fire = false; }
    if (edge(0)) this.action("jump");
    if (edge(1)) this.action("build-mode");
    if (edge(2)) this.action("reload");
    if (edge(3)) this.action("tool");
    if (edge(8)) this.action("map");
    if (edge(9)) this.action("pause");
    if (edge(11)) this.action("crouch");
    if (edge(12)) this.action("edit");
    if (edge(13)) this.action("interact");
    if (edge(15)) this.action("emote");
    if (edge(14)) this.action(this.buildType ? "material" : "slot", this.buildType ? undefined : String((this.player()?.selected + 4) % 5));
    if (edge(4) || edge(5)) {
      if (this.buildType) {
        const i = buildTypes.indexOf(this.buildType);
        this.action("build-type", buildTypes[(i + (edge(5) ? 1 : 3)) % 4]);
      } else {
        const selected = this.player()?.selected || 0;
        this.action("slot", String((selected + (edge(5) ? 1 : 4)) % 5));
      }
    }
    this._padButtons = buttons;
  };

  const baseLoop = P.loop;
  P.loop = function (time) {
    this.controllerFrame(time);
    return baseLoop.call(this, time);
  };

  root.addEventListener("gamepadconnected", (event) => {
    const game = root.AZUR;
    if (game) showController(game, event.gamepad);
  });
  root.addEventListener("gamepaddisconnected", () => {
    if (!pads().length) document.body.classList.remove("gamepad-ui");
  });

  /* v21 — aides de mouvement d'interface partagées (v130/v180). Easing 100 % JS,
     sans toucher aux CSS des autres workers. Tout est court-circuité quand
     l'utilisateur préfère les mouvements réduits. */
  root.AZV21 = root.AZV21 || {};
  root.AZV21.reducedMotion = function () {
    try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  };
  root.AZV21.easeInOut = function (v) {
    v = Math.max(0, Math.min(1, v));
    return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
  };
  root.AZV21.tween = function (duration, step, done) {
    if (root.AZV21.reducedMotion()) {
      try { step(1); } catch (e) {}
      if (done) done();
      return function () {};
    }
    const t0 = performance.now();
    let dead = false;
    const frame = (t) => {
      if (dead) return;
      const k = Math.min(1, (t - t0) / Math.max(1, duration));
      try { step(root.AZV21.easeInOut(k)); } catch (e) {}
      if (k < 1) requestAnimationFrame(frame);
      else if (done) done();
    };
    requestAnimationFrame(frame);
    return function () { dead = true; };
  };
})(window);
