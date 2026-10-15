/* AZUR — connected browser client, mobile/desktop controls and durable profile. */
(function (root) {
  "use strict";
  const S = AZSim,
    M = AZMeta,
    $ = (id) => document.getElementById(id),
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SAVE =
    "/tasklet/drive/azur/saves/azur-profile.json";
  const MODES = {
 creative:["Créatif", "Ton île. Tes règles.", 1],
    solo: ["Solo", "Seul face à l’orage", 1],
    duo: ["Duo", "À deux, plus loin", 2],
    squad: ["Escouade", "Votre équipe de quatre", 4],
    training: ["Entraînement", "Explorez. Construisez. Essayez.", 1],
    event: ["Événement", "Revivez la fin du Chapitre 1.", 1],
    eventflight: ["Événement 2 · Vol sans fin", "Sans crash ni éjection automatique.", 1],
  };
  const NAMES = {
    rifle: "Carabine Alizé",
    pistol: "Pistolet Étincelle",
    shotgun: "Pompe Récif",
    smg: "Rafale Luciole",
    sniper: "Longue-vue Orion",
    launcher: "Lanceur Tonnerre",
  };
  function itemName(i) {
    return !i
      ? "Emplacement vide"
      : i.kind === "weapon"
        ? NAMES[i.weapon] || S.weapons[i.weapon]?.name || i.weapon
        : i.kind === "heal"
          ? "Trousse de soin"
          : i.kind === "shield"
            ? "Fiole de bouclier"
            : "Munitions";
  }
  function itemIcon(i) {
    if(root.AZIcons) return root.AZIcons.inventory(i);
    return !i
      ? "·"
      : i.kind === "weapon"
        ? i.weapon === "sniper"
          ? "╾━"
          : i.weapon === "launcher"
            ? "◉━"
            : i.weapon === "pistol"
              ? "┏━"
              : "⌐━"
        : i.kind === "heal"
          ? "✚"
          : i.kind === "shield"
            ? "⬡"
            : "▥";
  }
  function clock(t) {
    t = Math.max(0, Math.floor(t));
    return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  }
  function parseDisk(r) {
    if (typeof r === "string") {
      try {
        return JSON.parse(r);
      } catch (e) {
        throw Error("Sauvegarde illisible.");
      }
    }
    if (r && typeof r.content === "string") return parseDisk(r.content);
    if (Array.isArray(r)) {
      let t = r.find((x) => x.type === "text");
      if (t) return parseDisk(t.text);
    }
    return r;
  }
  class Game {
    constructor() {
      this.ui = $("ui");
      this.overlay = $("overlay");
      this.canvas = $("scene");
      this.screen = "boot";
      this.tab = "play";
      this.mode = "solo";
      this.passPage = 0;
      this.shopFilter = "all";
      this.lockerFilter = "character";
      this.selectedCosmetic = null;
      this.profile = M.createDefault();
      this.audio = new AZAudio();
      this.keys = {};
      this.yaw = 0;
      this.pitch = -0.1;
      this.fire = false;
      this.aim = false;
      this.harvest = false;
      this.paused = false;
      this.modal = null;
      this.saveStatus = "Chargement";
      this.saveQueue = Promise.resolve();
      this.move = { x: 0, z: 0 };
      this.marker = null;
      this.mapZoom = 1;
      this.mapCenter = { x: 0, z: 0 };
      this.networkActive = false;
      this.netAvailable = !!root.AZ_RUNTIME?.network && typeof root.tasklet?.invokeTool !== "function";
      this.myId = "p0";
      this.events = [];
      this.lastHud = 0;
      this.frameTime = 0;
      this.mobile = matchMedia("(pointer:coarse)").matches;
      this.bind();
      this.boot();
    }
    async boot() {
      try {
        if (!root.THREE)
          throw Error(
            "Le moteur 3D est introuvable. Décompresse tout le ZIP, y compris le dossier vendor.",
          );
        this.bootText("Récupération de votre profil…", 20);
        await this.loadProfile();
        this.bootText("Création de l’île et des modèles originaux…", 55);
        await new Promise((r) => requestAnimationFrame(r));
        this.view = new AZView.View(this.canvas);
        this.view.configure(this.profile.settings);
        this.audio.configure(this.profile.settings);
        this.world = new S.World({
          mode: "training",
          seed: 20260913,
          player: {
            id: "p0",
            name: this.profile.name,
            equipment: this.profile.equipment,
          },
        });
        this.view.setWorld(this.world);
        this.buildMapTexture();
        this.bootText("Votre expédition est prête.", 100);
        this.screen = "menu";
        this.renderMenu();
        this.last = performance.now();
        requestAnimationFrame((t) => this.loop(t));
        this.queueSave();
        root.AZUR = this;
      } catch (e) {
        console.error(e);
        this.ui.innerHTML =
          '<section class="boot"><div class="brand-mark">✧</div><h2>Le jeu ne peut pas démarrer</h2><p class="loading-tip">' +
          esc(e.message) +
          '</p><button class="btn btn-primary" data-act="retry">Réessayer</button></section>';
      }
    }
    bootText(s, p) {
      let el = $("boot-message");
      if (el) el.textContent = s;
      let pr = this.ui.querySelector("progress");
      if (pr) pr.value = p;
    }
    async loadProfile() {
      if (typeof root.tasklet?.invokeTool === "function") {
        try {
          let data = await tasklet.invokeTool({
            toolName: "read_file",
            args: { path: SAVE },
          });
          let p = parseDisk(data);
          if (!p || typeof p !== "object" || Array.isArray(p))
            throw Error("Format inattendu");
          this.profile = M.normalize(p);
          this.saveStatus = "Profil restauré · Tasklet";
        } catch (e) {
          console.error("Restauration impossible", e);
          this.saveStatus = "Profil non restauré";
          this.storageBlocked = true;
          this.toast(
            "Sauvegarde inaccessible : le profil existant ne sera pas écrasé.",
            true,
          );
        }
      } else {
        try {
          let raw = localStorage.getItem("azur-profile-v1");
          this.profile = M.normalize(raw ? JSON.parse(raw) : M.createDefault());
          this.saveStatus = "Profil local restauré";
        } catch (e) {
          this.saveStatus = "Sauvegarde locale indisponible";
          this.storageBlocked = true;
          this.toast(
            "Stockage bloqué : exportez votre profil avant de quitter.",
            true,
          );
        }
      }
    }
    queueSave() {
      if (this.storageBlocked) return;
      const data = JSON.stringify(this.profile);
      this.saveStatus = "Sauvegarde…";
      this.updateSaveLabel();
      this.saveQueue = this.saveQueue
        .catch(() => {})
        .then(async () => {
          try {
            if (typeof root.tasklet?.invokeTool === "function")
              await tasklet.invokeTool({
                toolName: "write_file",
                args: { op: "write", path: SAVE, content: data },
              });
            else localStorage.setItem("azur-profile-v1", data);
            this.saveStatus = typeof root.tasklet?.invokeTool === "function"
              ? "Sauvegardé · Tasklet"
              : "Sauvegardé sur cet appareil";
            this.updateSaveLabel();
          } catch (e) {
            console.error("Sauvegarde impossible", e);
            this.saveStatus = "Échec de sauvegarde";
            this.updateSaveLabel();
            this.toast(
              "Sauvegarde impossible. Exportez votre profil depuis le menu Profil.",
              true,
            );
          }
        });
    }
    updateSaveLabel() {
      document
        .querySelectorAll("[data-save]")
        .forEach((e) => (e.textContent = this.saveStatus));
    }
    toast(text, error = false, kind = null) {
      const e = document.createElement("div");
      e.className =
        "toast-item" +
        (error ? " error" : "") +
        (kind ? " toast-kind-" + kind : "");
      const icons = {
        xp: "✦",
        quest: "★",
        coins: "◈",
        victory: "🏆",
        info: "◌",
      };
      if (kind && icons[kind]) {
        const ic = document.createElement("span");
        ic.className = "toast-icon";
        ic.setAttribute("aria-hidden", "true");
        ic.textContent = icons[kind];
        e.append(ic);
      }
      const tx = document.createElement("span");
      tx.textContent = text;
      e.append(tx);
      $("toasts").append(e);
      setTimeout(() => {
        e.classList.add("is-leaving");
        setTimeout(() => e.remove(), 480);
      }, 4000);
    }
    renderMenu() {
      this.screen = "menu";
      this.paused = false;
      this.modal = null;
      this.overlay.innerHTML = "";
      const p = this.profile,
        x = M.xpProgress(p);
      const tabs = [
        ["play", "JOUER"],
        ["pass", "PASSE"],
        ["locker", "CASIER"],
        ["shop", "BOUTIQUE"],
        ["quests", "QUÊTES"],
        ["career", "CARRIÈRE"],
        ["group", "GROUPE"],
        ["settings", "⚙"],
      ];
      this.ui.innerHTML =
        '<header class="topbar"><button class="btn btn-ghost wordmark" data-act="tab" data-id="play"><i>✧</i> AZUR</button><nav class="navlinks" aria-label="Navigation principale">' +
        tabs
          .map(
            ([id, n]) =>
              '<button class="btn btn-ghost ' +
              (this.tab === id ? "active" : "") +
              '" data-act="tab" data-id="' +
              id +
              '">' +
              n +
              "</button>",
          )
          .join("") +
        '</nav><div class="account-bar"><span class="currency">◈ ' +
        p.coins.toLocaleString("fr-FR") +
        '</span><button class="btn btn-ghost" data-act="tab" data-id="profile"><span class="level-badge">' +
        x.level +
        "</span>" +
        esc(p.name) +
        "</button></div></header>" +
        (this.tab === "play"
          ? this.lobbyHTML()
          : '<div class="page-preview-label"><span class="eyebrow">VOTRE EXPLORATEUR</span><h3>' +
            esc(
              M.catalog.find(
                (i) =>
                  i.id === (this.selectedCosmetic || p.equipment.character),
              )?.name || p.name,
            ) +
            '</h3><span class="muted">Glissez sur le personnage pour le faire tourner.</span></div><section class="scroll-panel">' +
            AZPanels.render(this.tab, this) +
            "</section>") +
        '<footer class="bottom-bar"><span class="save-state"><span class="status-dot"></span><span data-save>' +
        esc(this.saveStatus) +
        '</span></span><span class="desktop-footer">' +
        (this.netAvailable
          ? "SERVEUR RÉSEAU DISPONIBLE"
          : "ÉDITION LOCALE · ADVERSAIRES IA EXPLICITES") +
        '</span><button class="btn btn-ghost btn-sm" data-act="tab" data-id="help">? COMMANDES</button></footer>';
      this.updatePreview();
    }
    lobbyHTML() {
      let m = MODES[this.mode];
      return (
        '<section class="menu-left"><span class="eyebrow">SAISON 01 / HORIZON CORAIL</span><div class="season-line"></div><h1>AZUR</h1><h2>Les îles<br>de l’orage.</h2><p>Un rivage à explorer.<br>Un dernier cercle à conquérir.</p><div class="quick-links"><button class="btn btn-ghost btn-sm" data-act="tab" data-id="pass">DÉCOUVRIR LE PASSE ↗</button></div></section><div class="character-label"><span class="status-dot"></span><div>' +
        esc(this.profile.name) +
        "<small>" +
        esc(
          M.catalog.find((i) => i.id === this.profile.equipment.character)
            ?.name,
        ) +
        " · NIVEAU " +
        M.level(this.profile) +
        '</small></div></div><aside class="lobby-card"><span class="eyebrow">' +
        (this.networkActive
          ? "PARTIE EN RÉSEAU"
          : "VOTRE PROCHAINE EXPÉDITION") +
        "</span><h3>" +
        m[0] +
        ' <span class="muted">/</span> Île Corail</h3><div class="mode-grid">' +
        Object.entries(MODES)
          .map(
            ([k, v]) =>
              '<button class="btn ' +
              (k === this.mode ? "btn-secondary" : "btn-ghost") +
              '" data-act="mode" data-id="' +
              k +
              '">' +
              v[0] +
              "</button>",
          )
          .join("") +
        '</div><div class="local-tag"><span class="status-dot"></span>' +
        (["training","creative"].includes(this.mode)
          ? "Entraînement libre · sans classement"
          : this.networkActive
            ? "Humains connectés + remplissage IA"
            : "1 humain + 99 IA · " +
              (m[2] > 1
                ? m[2] - 1 + " équipier" + (m[2] > 2 ? "s" : "") + " IA"
                : "chacun pour soi")) +
        '</div><button class="btn btn-primary play-btn" data-act="play">PRÊT · JOUER &nbsp; ↗</button><div class="lobby-detail"><span>' +
        m[1] +
        "</span><span>3D / " +
        (this.mobile ? "TACTILE" : "PC") +
        '</span></div></aside><aside class="menu-tip"><b>EXPLOREZ SANS LIMITES.</b><span>Récoltez, équipez-vous et survivez à la tempête.</span></aside>'
      );
    }
    updatePreview() {
      let eq = { ...this.profile.equipment },
        item = M.catalog.find((i) => i.id === this.selectedCosmetic);
      this.previewType = null;
      if (item && this.tab !== "play" && item.type !== "pack") {
        eq[item.type] = item.id;
        this.previewType = item.type;
      }
      this.previewEquipment = eq;
    }
    async action(act, id, el) {
      this.audio.ui();
      if (act === "retry") {
        location.reload();
        return;
      }
      if (act === "tab") {
        this.tab = id;
        this.selectedCosmetic = null;
        this.renderMenu();
        return;
      }
      if (act === "mode") {
        this.mode = id;
        this.renderMenu();
        return;
      }
      if (act === "play" || act === "replay") {
        this.startMatch();
        return;
      }
      if (act === "lobby") {
        this.leaveToLobby();
        return;
      }
      if (act === "preview") {
        this.selectedCosmetic = id;
        this.updatePreview();
        this.renderMenu();
        return;
      }
      if (act === "shop-filter") {
        this.shopFilter = id;
        this.renderMenu();
        return;
      }
      if (act === "locker-filter") {
        this.lockerFilter = id;
        this.renderMenu();
        return;
      }
      if (act === "pass-prev" || act === "pass-next") {
        this.passPage = clamp(
          this.passPage + (act === "pass-next" ? 1 : -1),
          0,
          Math.ceil(M.rewards.length / 10) - 1,
        );
        this.renderMenu();
        return;
      }
      let r;
      if (act === "purchase") r = M.purchase(this.profile, id);
      if (act === "equip") r = M.equip(this.profile, id);
      if (act === "premium") r = M.buyPremium(this.profile);
      if (act === "claim")
        r = M.claim(this.profile, +id, el?.dataset.premium === "true");
      if (act === "save-name")
        r = M.setName(this.profile, $("player-name")?.value);
      if (r) {
        this.toast(r.message, !r.ok);
        if (r.ok) {
          this.audio.reward();
          this.queueSave();
        }
        this.renderMenu();
        return;
      }
      if (act === "export-save") {
        let b = new Blob([JSON.stringify(this.profile, null, 2)], {
            type: "application/json",
          }),
          url = URL.createObjectURL(b),
          a = document.createElement("a");
        a.href = url;
        a.download = "azur-profil.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        return;
      }
      if (act === "import-save") {
        $("save-import").click();
        return;
      }
      if (act === "network-toggle") {
        if (this.netAvailable) {
          this.networkActive = !this.networkActive;
          this.renderMenu();
        }
        return;
      }
      if (act === "copy-link") {
        try {
          await navigator.clipboard.writeText(location.origin + "/");
          this.toast(
            "Adresse copiée. Sur mobile, utilisez l’adresse réseau du PC.",
          );
        } catch (e) {
          this.toast(location.origin + "/");
        }
        return;
      }
      if (act === "pause") {
        this.togglePause();
        return;
      }
      if (act === "resume") {
        this.closeModal();
        return;
      }
      if (act === "map") {
        this.openMap();
        return;
      }
      if (act === "inventory") {
        this.openInventory();
        return;
      }
      if (act === "slot") {
        this.harvest = false;
        this.send({ slot: +id });
        return;
      }
      if (act === "tool") {
        this.harvest = true;
        this.aim = false;
          this.updateHUD();
        return;
      }
      if (act === "interact") {
        this.send({ interact: true });
        return;
      }
      if (act === "jump") {
        this.send({ jump: true });
        return;
      }
      if (act === "reload") {
        this.send({ reload: true });
        return;
      }
      if (act === "use") {
        this.send({ use: true });
        return;
      }
      if (act === "drop") {
        this.send({
          slot: id ? +id : this.player()?.selected || 0,
          drop: true,
        });
        setTimeout(() => this.openInventory(), 80);
        return;
      }
      if (act === "swap-left" || act === "swap-right") {
        let a = +id,
          b = clamp(a + (act === "swap-left" ? -1 : 1), 0, 4);
        this.send({ swap: [a, b] });
        setTimeout(() => this.openInventory(), 80);
        return;
      }
      if (act === "emote") {
        const equipped = this.profile.equipment.emote || "emote-salut";
        const style = ({
          "emote-salut": "salut",
          "emote-bonjour": "salut",
          "emote-boussole": "toupie",
          "emote-signal": "robot",
          "emote-victoire": "victoire",
        })[equipped] || (/danse|dance/i.test(equipped) ? "danse" : /etoile|star/i.test(equipped) ? "etoile" : "salut");
        this.send({ emote: true, emoteStyle: style });
        return;
      }
      if (act === "lock") {
        try {
          await this.canvas.requestPointerLock?.();
        } catch (e) {
          this.toast(
            "Souris non verrouillable ici : maintenez le clic droit pour regarder.",
          );
        }
        return;
      }
      if (act === "fullscreen") {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch (e) {
          this.toast("Utilisez le mode plein écran de votre navigateur.");
        }
        return;
      }
      if (act === "zoom-in" || act === "zoom-out") {
        this.mapZoom = clamp(
          this.mapZoom * (act === "zoom-in" ? 1.4 : 1 / 1.4),
          1,
          5,
        );
        this.drawFullMap();
        return;
      }
      if (act === "marker-clear") {
        this.marker = null;
        this.drawFullMap();
        return;
      }
      if (act === "surrender") {
        this.closeModal();
        if (["training","creative"].includes(this.mode)) {
          this.leaveToLobby();
          return;
        }
        this.send({ surrender: true });
        return;
      }
    }
    async startMatch() {
      if(this.screen === "loading") return;
      this.resetControls();
      this.acc = 0; this.lastSlots = null;
      this.closeSocket();
      this.fire = false;
      this.aim = false;
      this.keys = {};
      this.harvest = !["training", "creative"].includes(this.mode);
      this.move = { x: 0, z: 0 };
      this.marker = null;
      this.resultHandled = null;
      this.paused = false;
      this.modal = null;
      this.overlay.innerHTML = "";
      this.events = [];
      this.yaw = 0;
      this.pitch = -0.12;
      this.audio.start();
      this.screen = "loading";
      this.ui.innerHTML =
        '<section class="boot"><div class="loading-graphic"></div><span class="eyebrow">CAP SUR L’ÎLE CORAIL</span><h2>' +
        MODES[this.mode][0] +
        '</h2><p class="loading-tip">' +
        (this.networkActive && !["training","creative"].includes(this.mode)
          ? "Connexion au serveur de partie…"
          : "Préparation de l’île et des adversaires IA…") +
        '</p><progress class="progress progress-primary" max="100" value="60"></progress><p class="loading-tip muted">' +
        (this.profile.equipment.loading === "loading-etoile"
          ? "Repérez votre prochaine zone sûre sur la carte."
          : "Un coffre peut changer votre expédition. Approchez-vous et utilisez Interagir.") +
        "</p></section>";
      await new Promise((r) => setTimeout(r, 100));
      if (this.networkActive && !["training","creative"].includes(this.mode)) {
        this.connect();
        return;
      }
      this.myId = "p0";
      this.world = new S.World({
        mode: this.mode,
        seed: Date.now() >>> 0,
        player: {
          id: "p0",
          name: this.profile.name,
          equipment: { ...this.profile.equipment },
        },
      });
      this.view.setWorld(this.world);
      this.startGameUI();
    }
    connect() {
      try {
        const url =
          (location.protocol === "https:" ? "wss:" : "ws:") +
          "//" +
          location.host +
          "/socket";
        let ws = (this.socket = new WebSocket(url)),
          received = false;
        this.networkDeadline = setTimeout(() => {
          if (!received) {
            this.closeSocket();
            this.tab = "group";
            this.renderMenu();
            this.toast(
              "Serveur injoignable. Le jeu local reste disponible.",
              true,
            );
          }
        }, 12000);
        ws.onopen = () =>
          ws.send(
            JSON.stringify({
              type: "join",
              mode: this.mode,
              name: this.profile.name,
              equipment: this.profile.equipment,
            }),
          );
        ws.onmessage = (e) => {
          let d;
          try {
            d = JSON.parse(e.data);
          } catch {
            return;
          }
          if (d.type === "joined") {
            this.myId = d.playerId;
            this.roomId = d.roomId;
          }
          if (d.type === "error") {
            this.toast(d.message || "Connexion refusée", true);
          }
          if (d.type === "state") {
            this.world = d.state;
            if (!received) {
              received = true;
              clearTimeout(this.networkDeadline);
              this.view.setWorld(this.world);
              this.startGameUI();
            }
            this.checkResult();
          }
        };
        ws.onclose = () => {
          if (this.socket === ws && this.screen === "game") {
            this.socket = null;
            this.toast(
              "Connexion interrompue : cette partie réseau s’est arrêtée.",
              true,
            );
            this.tab = "group";
            this.renderMenu();
          }
        };
        ws.onerror = () => this.toast("Erreur de connexion au serveur.", true);
      } catch (e) {
        this.renderMenu();
        this.toast(e.message, true);
      }
    }
    closeSocket() {
      clearTimeout(this.networkDeadline);
      if (this.socket) {
        let ws = this.socket;
        this.socket = null;
        ws.onclose = null;
        ws.close();
      }
    }
    player() {
      return (
        this.world?.players.find((p) => p.id === this.myId) ||
        this.world?.players[0]
      );
    }
    send(input) {
      if (this.screen !== "game") return;
      if (this.socket) {
        if (this.socket.readyState === 1)
          this.socket.send(JSON.stringify({ type: "input", input }));
      } else {
        this.world.command(this.myId, input);
        if (this.paused) this.world.step(0.001);
      }
    }
    startGameUI() {
      this.screen = "game";
      this.frameTime = 0;
      this.lastHud = 0;
      this.ui.innerHTML =
        '<div class="hud"><div class="hud-top"><div class="hud-pill"><b id="remaining">100</b><span>EN VIE</span><b id="kills">0</b><span>ÉLIM.</span></div><div id="team-list" class="team-list"></div><div class="hud-pill" id="net-label"></div></div><div class="phase-banner"><b id="phase-title">DÉPLOIEMENT DANS 10</b><small id="phase-detail">ÎLE D’ATTENTE</small></div><div class="minimap-box"><canvas id="minimap" width="220" height="220" data-act="map" aria-label="Ouvrir la carte"></canvas><div class="map-status"><span id="storm-timer">◷ 0:50</span><span id="region-name">CORAIL</span></div></div><div id="storm-warning" class="storm-warning"></div><div class="crosshair" id="crosshair">+</div><div id="interaction" class="interaction-prompt" hidden></div><div id="feed" class="feed"></div><div class="health-block"><div class="health-row shield"><span>⬡</span><div class="health-track"><div id="shield-bar" style="width:0%"></div></div><span class="health-label" id="shield-value">0</span></div><div class="health-row"><span>✚</span><div class="health-track"><div id="health-bar" style="width:100%"></div></div><span class="health-label" id="health-value">100</span></div></div><div id="ammo" class="ammo-readout"></div><div id="materials" class="materials" hidden></div><div id="slots" class="inventory-bar"></div><div class="game-hint">' +
        (this.profile.settings.layout === "azerty" ? "ZQSD" : "WASD") +
        ' · déplacement &nbsp; ESPACE · saut<br>Clic droit glissé · caméra / visée<br>E · interagir &nbsp; 0 · outil</div><div class="game-toolbar"><button class="btn btn-neutral" data-act="pause" title="Pause">Ⅱ</button><button class="btn btn-neutral" data-act="inventory" title="Inventaire">▦</button><button class="btn btn-neutral desktop-only" data-act="lock">SOURIS</button><button class="btn btn-neutral" data-act="fullscreen" title="Plein écran">⛶</button></div><div class="touch-controls"><div id="joy" class="joy" aria-label="Joystick de déplacement"><div id="joy-nub" class="joy-nub"></div></div><div class="touch-right"><button class="touch-btn" data-act="jump">SAUT</button><button class="touch-btn" data-act="interact">E</button><button class="touch-btn fire" id="touch-fire" aria-label="Tirer">◎</button><button class="touch-btn" data-act="reload">R</button><button class="touch-btn" data-act="tool">⚒</button><button class="touch-btn" data-act="emote">DANSE</button></div></div><span class="fps-label" id="fps"></span></div>';
      this.bindTouch();
      this.updateHUD();
    }

    bind() {
      document.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (b) {
          e.preventDefault();
          this.action(b.dataset.act, b.dataset.id, b);
        }
      });
      document.addEventListener("change", (e) => {
        const k = e.target.dataset.setting;
        if (k) {
          let v =
            e.target.type === "checkbox"
              ? e.target.checked
              : e.target.type === "range"
                ? +e.target.value
                : e.target.value;
          this.profile.settings[k] = v;
          this.profile = M.normalize(this.profile);
          this.view?.configure(this.profile.settings);
          this.audio.configure(this.profile.settings);
          document.documentElement.style.setProperty(
            "--hud-scale",
            this.profile.settings.hud,
          );
          this.queueSave();
        }
      });
      $("save-import").addEventListener("change", async (e) => {
        let f = e.target.files[0];
        if (!f) return;
        if (f.size > 1000000) {
          this.toast("Fichier de profil trop volumineux.", true);
          return;
        }
        try {
          let p = JSON.parse(await f.text());
          if (
            !p ||
            typeof p !== "object" ||
            p.version !== 1 ||
            !p.equipment ||
            !Array.isArray(p.owned)
          )
            throw Error("Profil AZUR invalide.");
          this.profile = M.normalize(p);
          this.storageBlocked = false;
          this.view.configure(this.profile.settings);
          this.audio.configure(this.profile.settings);
          this.queueSave();
          this.renderMenu();
          this.toast("Profil importé.");
        } catch (err) {
          this.toast(err.message, true);
        }
        e.target.value = "";
      });
      window.addEventListener("resize", () => this.view?.resize());
      window.addEventListener("blur", () => {
        this.keys = {};
        this.fire = false;
        this.aim = false;
        this.move = { x: 0, z: 0 };
        if (this.screen === "game" && !this.socket && !this.modal)
          this.togglePause();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.fire = false;
          this.keys = {};
          this.move = { x: 0, z: 0 };
          if (this.screen === "game" && !this.socket && !this.modal)
            this.togglePause();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (this.screen !== "game") return;
        if (
          [
            "Space",
            "Tab",
            "Escape",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.code)
        )
          e.preventDefault();
        this.keys[e.key.toLowerCase()] = true;
        if (e.repeat) return;
        if (e.code === "Escape") {
          this.modal ? this.closeModal() : this.togglePause();
          return;
        }
        if (this.modal) return;
        if (/^Digit[1-5]$/.test(e.code)) {
          this.harvest = false;
          this.send({ slot: +e.code.slice(5) - 1 });
        }
        let a = {
          Space: "jump",
          KeyE: "interact",
          KeyR: "reload",

          KeyX: "drop",
          KeyM: "map",
          Tab: "inventory",
          Digit0: "tool",
          KeyT: "emote",
        }[e.code];
        if (a) this.action(a);
      });
      document.addEventListener("keyup", (e) => {
        delete this.keys[e.key.toLowerCase()];
      });
      this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      this.canvas.addEventListener("pointerdown", (e) => {
        this.audio.start();
        if (this.screen === "menu") {
          this.pointer = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            menu: true,
          };
          this.canvas.setPointerCapture(e.pointerId);
          return;
        }
        if (this.screen !== "game" || this.modal) return;
        if (e.pointerType === "touch" || e.button === 2) {
          // v21 wiring : mémorise le type de pointeur — le regard tactile est
          // amplifié (×1.6) dans le pointermove pour garder la réactivité iPhone.
          this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
          this.canvas.setPointerCapture(e.pointerId);
          if (e.button === 2) this.aim = true;
        } else if (e.button === 0) {
          this.fire = true;
          this.fireOnce();
          this.canvas.setPointerCapture(e.pointerId);
        }
      });
      this.canvas.addEventListener("pointermove", (e) => {
        if (this.pointer?.id === e.pointerId) {
          const dx = e.clientX - this.pointer.x,
            dy = e.clientY - this.pointer.y;
          this.pointer.x = e.clientX;
          this.pointer.y = e.clientY;
          if (this.pointer.menu) {
            this.view.menuRotation += dx * 0.009;
            return;
          }
          // v21 wiring : regard tactile amplifié — même course de doigt,
          // rotation plus vive sur mobile.
          const boost = this.pointer.touch ? 1.6 : 1;
          this.look(dx * boost, dy * boost);
        } else if (document.pointerLockElement === this.canvas && !this.modal)
          this.look(e.movementX, e.movementY);
      });
      const release = (e) => {
        if (this.pointer?.id === e.pointerId) this.pointer = null;
        if (e.pointerType !== "touch") {
          this.fire = false;
          this.aim = false;
        }
      };
      this.canvas.addEventListener("pointerup", release);
      this.canvas.addEventListener("pointercancel", (e) => {
        release(e);
        this.fire = false;
      });
      document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement !== this.canvas) {
          this.fire = false;
          this.aim = false;
        }
      });
    }
    fireOnce() {
      if (this.modal || this.screen !== "game") return;
      this.send({
        yaw: this.yaw,
        pitch: this.pitch,
      ...(this.harvest

            ? { harvest: true }
            : { shoot: true }),
      });
      this.actionTime = this.frameTime;
    }
    look(dx, dy) {
      let sens = 0.0035 * this.profile.settings.sensitivity;
      this.yaw -= dx * sens;
      this.pitch = clamp(
        this.pitch - dy * sens * (this.profile.settings.invertY ? -1 : 1),
        -1.22,
        1.15,
      );
    }
    resetControls() {
      const captures = [[this.canvas, this.pointer?.id], [$("joy"), this.joyId], [$("touch-fire"), this.firePointerId]];
      this.joyId = null; this.joyStart = null; this.firePointerId = null; this.pointer = null;
      this.keys = {}; this.move = { x: 0, z: 0 }; this.fire = false; this.aim = false;
      this.lift = 0; this.touchSprint = false; this.crouching = false;
      for (const [node, id] of captures) {
        try { if (id != null && node?.hasPointerCapture?.(id)) node.releasePointerCapture(id); } catch (_) {}
      }
      for (const b of document.querySelectorAll(".touch-btn.pressed")) b.classList.remove("pressed");
      const nub = $("joy-nub"); if (nub) nub.style.transform = "";
    }
    bindTouch() {
      this.resetControls();
      let joy = $("joy"),
        nub = $("joy-nub");
      joy.addEventListener("pointerdown", (e) => {
        if (this.joyId != null || this.modal || this.paused || this.screen !== "game") return;
        e.preventDefault();
        this.audio.start();
        joy.setPointerCapture(e.pointerId);
        this.joyId = e.pointerId;
        this.joyStart = { x: e.clientX, y: e.clientY };
      });
      joy.addEventListener("pointermove", (e) => {
        if (this.joyId !== e.pointerId || this.modal || this.paused || !this.joyStart) return;
        let dx = e.clientX - this.joyStart.x,
          dy = e.clientY - this.joyStart.y,
          len = Math.hypot(dx, dy),
          r = 42;
        if (len > r) {
          dx *= r / len;
          dy *= r / len;
          len = r;
        }
        nub.style.transform = `translate(${dx}px,${dy}px)`;
        // v21 wiring : zone morte radiale + courbe de réponse progressive —
        // le stick répond de façon précise près du centre, plein régime au bord.
        const mag = len / r, DZ = 0.16;
        let out = 0;
        if (mag >= DZ) out = Math.pow((mag - DZ) / (1 - DZ), 1.3);
        const inv = len > 0.0001 ? 1 / len : 0;
        this.move = { x: dx * inv * out, z: -dy * inv * out };
      });
      const release = (e) => {
        if (e.pointerId !== this.joyId) return;
        this.joyId = null;
        this.move = { x: 0, z: 0 };
        nub.style.transform = "";
      };
      joy.addEventListener("pointerup", release);
      joy.addEventListener("pointercancel", release);
      joy.addEventListener("lostpointercapture", release);
      const f = $("touch-fire");
      f.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.audio.start();
        if (this.firePointerId != null || this.modal || this.paused || this.screen !== "game") return;
        this.firePointerId = e.pointerId;
        this.fire = true;
        this.fireOnce();
        f.setPointerCapture(e.pointerId);
      });
      const stopFire = (e) => { if (e.pointerId === this.firePointerId) { this.fire = false; this.firePointerId = null; } };
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) f.addEventListener(name, stopFire);
    }
    // v21 wiring : aide à la visée douce, commune au tactile et à la manette.
    // Paramètres (strength, pitchStrength, maxDist, cone) : la manette reçoit
    // des valeurs plus douces que le tactile pour rester honnête en cross-play.
    _applyAimAssist(p, strength, pitchStrength, maxDist, cone) {
      if (!p || !this.world) return;
      let best = null, bd = cone;
      for (let q of this.world.players) {
        if (!q.alive || q.team === p.team) continue;
        const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
        if (dist > maxDist) continue;
        const angle = Math.atan2(-dx, -dz),
          diff = Math.atan2(Math.sin(angle - this.yaw), Math.cos(angle - this.yaw));
        if (Math.abs(diff) < bd) {
          best = { angle, q, dist };
          bd = Math.abs(diff);
        }
      }
      if (best) {
        this.yaw += Math.atan2(Math.sin(best.angle - this.yaw), Math.cos(best.angle - this.yaw)) * strength;
        this.pitch += (Math.atan2(best.q.y + 1.1 - p.y - 1.4, best.dist) - this.pitch) * pitchStrength;
      }
    }
    input() {
      let k = this.keys,
        az = this.profile.settings.layout === "azerty",
        // v21 wiring : lissage léger du stick tactile uniquement (un pôle) —
        // le clavier reste instantané, le pouce gagne en stabilité.
        tk = 0.55;
      this._touchX = (this._touchX || 0) + (this.move.x - (this._touchX || 0)) * tk;
      this._touchZ = (this._touchZ || 0) + (this.move.z - (this._touchZ || 0)) * tk;
      if (Math.abs(this.move.x) < 0.001 && Math.abs(this._touchX) < 0.012) this._touchX = 0;
      if (Math.abs(this.move.z) < 0.001 && Math.abs(this._touchZ) < 0.012) this._touchZ = 0;
      let mx =
          (k[az ? "d" : "d"] || k.arrowright ? 1 : 0) -
          (k[az ? "q" : "a"] || k.arrowleft ? 1 : 0) +
          this._touchX,
        mz =
          (k[az ? "z" : "w"] || k.arrowup ? 1 : 0) -
          (k.s || k.arrowdown ? 1 : 0) +
          this._touchZ;
      let fire = this.fire && !this.harvest;
      if (this.profile.settings.assist && fire) {
        // Tactile : réglages d'origine conservés. Manette : aide plus douce,
        // active quand on vise ou tire au pad (horizons-v170 renseigne _padState).
        if (this.mobile) this._applyAimAssist(this.player(), 0.08, 0.06, 90, 0.04);
        else if (this._padState && (this._padState.fire || this._padState.aim))
          this._applyAimAssist(this.player(), 0.05, 0.035, 110, 0.055);
      }
      return {
        moveX: clamp(mx, -1, 1),
        moveZ: clamp(mz, -1, 1),
        yaw: this.yaw,
        pitch: this.pitch,
        fire,
        sprint: !!k.shift || Math.hypot(this._touchX, this._touchZ) > 0.75,
        aim: !!(this.aim && !this.harvest),
      };
    }
    loop(t) {
      const rawDt = Math.max(0.001, (t - this.last) / 1000 || 1 / 60);
      this.fpsAverage = (this.fpsAverage || 60) * .94 + (1 / rawDt) * .06;
      let dt = Math.min(0.1, rawDt);
      this.last = t;
      this.frameTime += dt;
      let p = this.player();
      if (this.screen === "game" && !this.modal) {
        this.commandTime = (this.commandTime || 0) + dt;
        if (!this.socket || this.commandTime >= 0.05) {
          this.send(this.input());
          this.commandTime = 0;
        }
        if (
          this.fire &&
      this.harvest &&
        this.frameTime - (this.actionTime || 0) > 0.3
        ) {
          this.send({ harvest: true });
          this.actionTime = this.frameTime;
        }
      }
      if (this.screen === "game" && !this.socket && !this.paused) {
        this.acc = (this.acc || 0) + dt;
        let ticks = 0;
        const step = 1 / 60;
        while (this.acc >= step && ticks++ < 6) {
          this.world.step(step);
          this.acc -= step;
        }
        this.checkResult();
      }
      if (this.view && this.world) {
        p = this.player();
        let isMenu = this.screen === "menu" || this.screen === "boot";
        if (!isMenu && root.AZEvent && root.AZEvent.active && root.AZEvent.beforeView) root.AZEvent.beforeView(dt);
        this.view.update(this.world, p, dt, {
          menu: isMenu,
          rawDt,
          panel: this.tab !== "play",
          tab: this.tab,
          previewEquipment: this.previewEquipment || this.profile.equipment,
          previewType: this.previewType,
          mode: this.mode,
          yaw: this.yaw,
          pitch: this.pitch,
          aim: !!(this.aim && !this.harvest && p.inventory?.[p.selected]?.kind === "weapon" && !p.falling && !p.gliding && !p.flying),
          harvest: this.harvest,
          buildType: this.buildType, material: this.material || 'wood',
          buildRotation:this.buildRotation||0, buildLevel:this.buildLevel||0, marker:this.marker, timeOfDay:this.timeOfDay||"day",
          // v21 wiring : sprint → FOV dynamique côté vue (jamais en visée).
          sprint: !!this.keys?.shift || Math.hypot(this.move?.x || 0, this.move?.z || 0) > 0.9 || !!this.touchSprint || !!(this._padState && this._padState.sprint),
          onEvent: (e) => this.onEvent(e),
        });
        this.audio.update(this.frameTime, isMenu, p, this.profile.equipment, this.world);
        if (this.screen === "game" && this.frameTime - this.lastHud > 0.13) {
          this.updateHUD();
          this.lastHud = this.frameTime;
          if (this.modal === "map") this.drawFullMap();
        }
        if ($("fps"))
          $("fps").textContent = this.profile.settings.fps
            ? Math.round(this.fpsAverage) +
              " FPS · " + (this.view.performanceAuto ? "AUTO" : this.view.quality.toUpperCase())
            : "";
      }
      requestAnimationFrame((tt) => this.loop(tt));
    }
    onEvent(e) {
      let p = this.player();
      this.audio.event(e, p);
      if (e.type === "hit" && e.targetId === p.id) {
        $("vignette").classList.add("damage-flash");
        setTimeout(() => $("vignette").classList.remove("damage-flash"), 180);
      }
      if (e.type === "hit" && e.playerId === p.id && e.targetId) {
        $("crosshair")?.classList.add("hit");
        setTimeout(() => $("crosshair")?.classList.remove("hit"), 140);
      }
      if (e.type === "elimination") {
        let a = this.world.players.find((p) => p.id === e.playerId)?.name,
          b = this.world.players.find((p) => p.id === e.targetId)?.name;
        this.events.push({
          text: (a || "La tempête") + " → " + (b || "Explorateur"),
          time: this.frameTime,
        });
        if (this.events.length > 4) this.events.shift();
      }
      if (e.type === "message" && e.playerId === p.id && e.text)
        this.toast(e.text);
    }
    updateHUD() {
      if (this.screen !== "game" || !$("remaining")) return;
      let w = this.world,
        p = this.player(),
        it = p.inventory[p.selected];
      $("remaining").textContent = w.players.filter((p) => p.alive).length;
      $("kills").textContent = p.kills;
      $("health-bar").style.width = clamp(p.hp, 0, 100) + "%";
      $("shield-bar").style.width = clamp(p.shield, 0, 100) + "%";
      $("health-value").textContent = Math.max(0, Math.ceil(p.hp));
      $("shield-value").textContent = Math.round(p.shield);
      $("net-label").textContent =
        w.mode === "training"
          ? "ENTRAÎNEMENT · AUCUNE XP"
          : this.socket
            ? w.players.filter((p) => !p.bot).length + " HUMAINS · SERVEUR"
            : w.players.filter((p) => p.bot).length + " IA · PARTIE LOCALE";
      let phase =
        w.phase === "waiting"
          ? "DÉPLOIEMENT DANS " + Math.max(1, Math.ceil(10 - w.phaseTime))
          : w.phase === "transport" && !p.deployed
            ? "L’ALBATROS TRAVERSE L’ÎLE"
            : p.falling
              ? "CHUTE LIBRE"
              : p.gliding
                ? "AILE DÉPLOYÉE"
                : w.mode === "training"
                  ? "TERRAIN D’ENTRAÎNEMENT"
                  : p.downed
                    ? "À TERRE · " + Math.ceil(p.downTimer) + " s"
                    : "SURVIVEZ À L’ORAGE";
      $("phase-title").textContent = phase;
      $("phase-detail").textContent =
        w.phase === "waiting"
          ? "Explorez · construisez · testez vos armes"
          : w.phase === "transport" && !p.deployed
            ? "ESPACE / SAUT : choisissez votre départ"
            : p.falling
              ? "ESPACE / SAUT : ouvrir votre planeur"
              : p.gliding
                ? "Dirigez la descente avec les commandes de déplacement"
                : w.mode === "training"
                  ? "Armes, matériaux et protections fournis · pas de progression"
                  : MODES[w.mode][0] + " · " + clock(w.elapsed);
      $("storm-timer").textContent = "◷ " + clock(w.storm.timer);
      let reg = S.regions.reduce((a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z)
          ? a
          : b,
      );
      $("region-name").textContent =
        w.phase === "waiting"
          ? "ATTENTE"
          : reg.name.split(" ")[0].toUpperCase();
      let outside =
        w.phase === "active" &&
        w.mode !== "training" &&
        Math.hypot(p.x - w.storm.x, p.z - w.storm.z) > w.storm.radius;
      $("storm-warning").textContent = outside
        ? "DANS LA TEMPÊTE · REJOIGNEZ LA ZONE SÛRE"
        : "";
      $("ammo").innerHTML = this.harvest
        ? "⚒ <small>RÉCOLTE</small>"
        : p.reload > 0
          ? "<small>RECHARGEMENT " + p.reload.toFixed(1) + " s</small>"
          : p.useTime > 0
            ? "<small>UTILISATION " + p.useTime.toFixed(1) + " s</small>"
            : it?.kind === "weapon"
              ? it.ammo +
                " <small>/ " +
                it.reserve +
                "<br>" +
                esc(NAMES[it.weapon]) +
                "</small>"
              : it
                ? "<small>" + esc(itemName(it)) + " · H / ✚</small>"
                : "";
      $("materials").innerHTML =
        "▥ " +
        p.mats.wood +
        " &nbsp; ◆ " +
        p.mats.stone +
        " &nbsp; ▰ " +
        p.mats.metal +
        (p.vehicleId
          ? " &nbsp; ⛽ " +
            Math.ceil(w.vehicles.find((v) => v.id === p.vehicleId)?.fuel || 0)
          : "");
      const slotHTML = Array.from({ length: 5 }, (_, i) => {
        let a = p.inventory[i];
        return (
          '<button class="slot r' +
          (a?.rarity || 0) +
          " " +
          (i === p.selected && !this.harvest ? "active" : "") +
          '" data-act="slot" data-id="' +
          i +
          '" title="' +
          esc(itemName(a)) +
          '"><span class="slot-key">' +
          (i + 1) +
          '</span><span class="slot-icon">' +
          itemIcon(a) +
          '</span><span class="slot-count">' +
          (a?.kind === "weapon" ? a.ammo : a?.count || "") +
          "</span></button>"
        );
      }).join("");
      if ($("slots").innerHTML !== slotHTML) $("slots").innerHTML = slotHTML;
      // v21 wiring : le client possède team-list (son format) — le socle saute
      // son écriture ; sinon innerHTML uniquement quand le contenu change.
      // Moins de reflows sur mobile, même cadence de rafraîchissement (0,13 s).
      if (!this._hudTeamListOwned) {
        const teamHTML = w.players
          .filter((q) => q.team === p.team && q.id !== p.id)
          .map(
            (q) =>
              '<div class="team-member">' +
              esc(q.name) +
              " · " +
              (q.alive
                ? q.downed
                  ? "À TERRE"
                  : Math.round(Math.hypot(q.x - p.x, q.z - p.z)) + " m"
                : "ÉLIMINÉ") +
              '<div class="progress"><div style="width:' +
              Math.max(0, q.hp) +
              '%"></div></div></div>',
          )
          .join("");
        if (this._lastTeamHTML !== teamHTML) { $("team-list").innerHTML = teamHTML; this._lastTeamHTML = teamHTML; }
      }
      $("feed").innerHTML = this.events
        .filter((e) => this.frameTime - e.time < 7)
        .map((e) => "<div>" + esc(e.text) + "</div>")
        .join("");
      let prompt = this.nearPrompt(p);
      $("interaction").hidden = !prompt;
      $("interaction").textContent = prompt;
      this.drawMap($("minimap"), false);
    }
    nearPrompt(p) {
      if (p.vehicleId) return "E / INTERAGIR · Quitter le véhicule";
      let a = this.world.players.find(
        (q) =>
          q.team === p.team &&
          q.downed &&
          Math.hypot(q.x - p.x, q.z - p.z) < 3.2,
      );
      if (a) return "E / INTERAGIR · Réanimer " + a.name;
      let l = this.world.loot.find(
        (l) => !l.dead && Math.hypot(l.x - p.x, l.z - p.z) < 3,
      );
      if (l)
        return (
          "E · " +
          itemName(l) +
          (p.inventory.length >= 5 ? " · remplace le créneau sélectionné" : "")
        );
      let o = this.world.objects.find(
        (o) =>
          o.type === "chest" &&
          !o.opened &&
          !o.dead &&
          Math.hypot(o.x - p.x, o.z - p.z) < 3.5,
      );
      if (o) return "E / INTERAGIR · Ouvrir le coffre";
      let v = this.world.vehicles.find(
        (v) => !v.driver && v.hp > 0 && Math.hypot(v.x - p.x, v.z - p.z) < 3.5,
      );
      if (v)
        return (
          "E / INTERAGIR · Conduire " +
          {
            car: "Corail",
            van: "Transporteur",
            buggy: "Éclaireur",
            boat: "Écume",
          }[v.type]
        );
      if (
        this.marker &&
        Math.hypot(this.marker.x - p.x, this.marker.z - p.z) > 10
      )
        return (
          "⚑ " +
          Math.round(Math.hypot(this.marker.x - p.x, this.marker.z - p.z)) +
          " m · votre marqueur"
        );
      return "";
    }
    checkResult() {
      let p = this.player(),
        r = p?.result || this.world.results?.[this.myId];
      if (!r || this.resultHandled === r.id || this.screen !== "game") return;
      this.resultHandled = r.id;
      this.fire = false;
      this.keys = {};
      this.send({ fire: false, moveX: 0, moveZ: 0 });
      let progress = M.applyMatch(this.profile, r);
      this.queueSave();
      this.screen = "results";
      this.paused = true;
      this.audio.reward();
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.innerHTML = "";
      this.overlay.innerHTML =
        '<div class="modal-shade"><section class="dialog"><span class="eyebrow">' +
        (r.won ? "LE DERNIER HORIZON VOUS APPARTIENT" : "FIN DE L’EXPÉDITION") +
        "</span><h2>" +
        (r.won ? "VICTOIRE !" : "Une autre île vous attend.") +
        '</h2><div class="result-rank">#' +
        r.rank +
        '</div><div class="result-stats"><div><b>' +
        r.kills +
        "</b><small>ÉLIMINATIONS</small></div><div><b>" +
        clock(r.duration) +
        "</b><small>SURVIE</small></div><div><b>+" +
        progress.xp +
        "</b><small>XP GAGNÉE</small></div></div><p>Niveau " +
        progress.levelAfter +
        " · " +
        (progress.completed.length
          ? progress.completed.length + " quête(s) accomplie(s)."
          : "Votre carrière et vos quêtes ont été mises à jour.") +
        '</p><span class="save-state" data-save>' +
        esc(this.saveStatus) +
        '</span><div class="dialog-actions"><button class="btn btn-primary" data-act="replay">REJOUER ↗</button><button class="btn btn-ghost" data-act="lobby">RETOUR AU LOBBY</button></div></section></div>';
    }
    leaveToLobby() {
      this.closeSocket();
      this.fire = false;
      this.keys = {};
      this.move = { x: 0, z: 0 };
      this.world = new S.World({
        mode: "training",
        seed: 20260913,
        player: {
          id: "p0",
          name: this.profile.name,
          equipment: { ...this.profile.equipment },
        },
      });
      this.myId = "p0";
      this.view.setWorld(this.world);
      this.tab = "play";
      this.renderMenu();
    }
    togglePause() {
      if (this.modal) {
        this.closeModal();
        return;
      }
      this.modal = "pause";
      this.paused = !this.socket;
      this.fire = false;
      this.keys = {};
      this.move = { x: 0, z: 0 };
      this.send({ fire: false, moveX: 0, moveZ: 0 });
      if (document.pointerLockElement) document.exitPointerLock();
      this.overlay.innerHTML =
        '<div class="modal-shade"><section class="dialog"><span class="eyebrow">FAIRE ESCALE</span><h2>Votre expédition</h2><p>' +
        (this.socket
          ? "La partie réseau continue pendant ce menu."
          : "La partie locale est en pause.") +
        '</p><p class="muted">PC : ' +
        (this.profile.settings.layout === "azerty" ? "ZQSD" : "WASD") +
        ' · clic droit glissé pour regarder · clic gauche pour tirer · E interagir · R recharger · 0 outil · H consommer.<br>Mobile : joystick gauche, glissement à droite pour la caméra, boutons tactiles. Essayez le mode paysage.</p><div class="dialog-actions"><button class="btn btn-primary" data-act="resume">REPRENDRE</button><button class="btn btn-secondary" data-act="map">CARTE</button><button class="btn btn-ghost" data-act="surrender">' +
        (["training","creative"].includes(this.mode)
          ? "QUITTER L’ENTRAÎNEMENT"
          : "ABANDONNER ET VOIR LE BILAN") +
        "</button></div></section></div>";
    }
    closeModal() {
      this.resetControls();
      this.modal = null;
      this.paused = false;
      this.overlay.innerHTML = "";
      if (this.screen === "game") this.canvas.focus({ preventScroll: true });
    }
    openInventory() {
      if (this.screen !== "game") return;
      this.modal = "inventory";
      this.paused = !this.socket;
      this.send({ fire: false, moveX: 0, moveZ: 0 });
      this.fire = false;
      let p = this.player();
      this.overlay.innerHTML =
        '<div class="modal-shade"><section class="dialog"><div class="dialog-actions"><h2>Votre équipement</h2><button class="btn btn-ghost" data-act="resume">FERMER ×</button></div><p class="muted">Sélectionnez un objet dans la barre, puis H / ✚ pour le consommer. Jeter libère un créneau.</p><div class="inventory-grid">' +
        Array.from({ length: 5 }, (_, i) => {
          let it = p.inventory[i];
          return (
            '<div class="inventory-detail ' +
            (p.selected === i ? "selected" : "") +
            '"><b>' +
            itemIcon(it) +
            " " +
            esc(itemName(it)) +
            "</b><span>" +
            (it?.kind === "weapon"
              ? S.rarities[it.rarity || 0].name +
                " · " +
                it.ammo +
                " / " +
                it.reserve
              : it?.count
                ? "× " + it.count
                : "Vide") +
            "</span>" +
            (it
              ? '<button class="btn btn-secondary" data-act="slot" data-id="' +
                i +
                '">Équiper ' +
                (i + 1) +
                '</button><button class="btn btn-ghost" data-act="swap-left" data-id="' +
                i +
                '">← Déplacer</button><button class="btn btn-ghost" data-act="swap-right" data-id="' +
                i +
                '">Déplacer →</button><button class="btn btn-ghost" data-act="drop" data-id="' +
                i +
                '">Jeter</button>'
              : "") +
            "</div>"
          );
        }).join("") +
        "</div></section></div>";
    }
    buildMapTexture() {
      let c = (this.mapTexture = document.createElement("canvas"));
      c.width = c.height = 520;
      const ctx = c.getContext("2d"),
        im = ctx.createImageData(520, 520);
      for (let y = 0; y < 520; y++)
        for (let x = 0; x < 520; x++) {
          let wx = (x / 520 - 0.5) * 1040,
            wz = (y / 520 - 0.5) * 1040,
            h = S.heightAt(wx, wz),
            d = Math.hypot(wx, wz),
            col =
              h < -2
                ? [33, 116, 134]
                : d > 415
                  ? [215, 193, 142]
                  : h > 38
                    ? [131, 155, 153]
                    : [
                        106 + Math.max(0, h) * 0.45,
                        149 + Math.max(0, h) * 0.3,
                        101,
                      ];
          let i = (y * 520 + x) * 4;
          im.data[i] = col[0];
          im.data[i + 1] = col[1];
          im.data[i + 2] = col[2];
          im.data[i + 3] = 255;
        }
      ctx.putImageData(im, 0, 0);
    }
    drawMap(c, full) {
      if (!c) return;
      let ctx = c.getContext("2d"),
        sz = c.width,
        p = this.player(),
        w = this.world,
        waiting = w.phase === "waiting",
        span = waiting && !full ? 175 : 1040 / (full ? this.mapZoom : 1),
        cx = waiting && !full ? 610 : full ? this.mapCenter.x : 0,
        cz = waiting && !full ? -590 : full ? this.mapCenter.z : 0;
      const pt = (x, z) => [
        ((x - cx) / span) * sz + sz / 2,
        ((z - cz) / span) * sz + sz / 2,
      ];
      ctx.clearRect(0, 0, sz, sz);
      ctx.fillStyle = "#297a88";
      ctx.fillRect(0, 0, sz, sz);
      if (waiting && !full) {
        ctx.fillStyle = "#aac192";
        ctx.beginPath();
        ctx.arc(sz / 2, sz / 2, sz * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        let [x, y] = pt(-520, -520);
        ctx.drawImage(
          this.mapTexture,
          x,
          y,
          (1040 / span) * sz,
          (1040 / span) * sz,
        );
      }
      for (let o of w.objects)
        if (o.type === "house" && !o.dead) {
          let [x, y] = pt(o.x, o.z);
          ctx.fillStyle = "#e3ceb1";
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      if (!waiting && w.mode !== "training") {
        let [x, y] = pt(w.storm.x, w.storm.z),
          r = (w.storm.radius / span) * sz;
        ctx.save();
        ctx.fillStyle = "rgba(85,50,156,.38)";
        ctx.beginPath();
        ctx.rect(0, 0, sz, sz);
        ctx.arc(x, y, r, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.strokeStyle = "#cab9ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        let [nx, ny] = pt(w.storm.nextX, w.storm.nextZ);
        ctx.strokeStyle = "#eff8e8";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(nx, ny, (w.storm.nextRadius / span) * sz, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (full) {
        ctx.textAlign = "center";
        ctx.font = "600 10px system-ui";
        for (const r of S.regions) {
          let [x, y] = pt(r.x, r.z);
          ctx.fillStyle = "#142e3c";
          ctx.fillRect(x - 40, y + 7, 80, 15);
          ctx.fillStyle = "#eaf1db";
          ctx.fillText(r.name, x, y + 18);
        }
      }
      for (const q of w.players.filter((q) => q.team === p.team && q.alive)) {
        let [x, y] = pt(q.x, q.z);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-q.yaw);
        ctx.fillStyle = q.id === p.id ? "#fff7c6" : "#66efc6";
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 3);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      if (this.marker) {
        let [x, y] = pt(this.marker.x, this.marker.z);
        ctx.fillStyle = "#ffda70";
        ctx.font = "bold 19px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("⚑", x, y);
      }
      this.currentMap = { span, cx, cz };
    }
    openMap() {
      if (this.screen !== "game") return;
      this.modal = "map";
      this.paused = !this.socket;
      this.fire = false;
      this.send({ fire: false, moveX: 0, moveZ: 0 });
      this.overlay.innerHTML =
        '<div class="modal-shade"><section class="dialog map-dialog"><div class="dialog-actions"><h2>Île Corail</h2><button class="btn btn-ghost" data-act="resume">FERMER ×</button></div><canvas class="full-map" id="full-map" width="600" height="600" aria-label="Carte de l’île, toucher pour marquer"></canvas><div class="map-legend"><span>△ Vous / équipe</span><span>○ Prochaine zone</span><span>⚑ Votre marqueur</span></div><div class="dialog-actions"><button class="btn btn-secondary" data-act="zoom-in">+</button><button class="btn btn-secondary" data-act="zoom-out">−</button><button class="btn btn-ghost" data-act="marker-clear">Effacer le marqueur</button></div><p class="muted">Touchez pour marquer · glissez pour déplacer · molette pour zoomer.</p></section></div>';
      this.drawFullMap();
      let cv = $("full-map"),
        start;
      cv.addEventListener("pointerdown", (e) => {
        cv.setPointerCapture(e.pointerId);
        start = {
          x: e.clientX,
          y: e.clientY,
          px: e.clientX,
          py: e.clientY,
          moved: false,
        };
      });
      cv.addEventListener("pointermove", (e) => {
        if (!start) return;
        let dx = e.clientX - start.px,
          dy = e.clientY - start.py;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5)
          start.moved = true;
        if (start.moved) {
          this.mapCenter.x = clamp(
            this.mapCenter.x - ((dx / cv.clientWidth) * 1040) / this.mapZoom,
            -400,
            400,
          );
          this.mapCenter.z = clamp(
            this.mapCenter.z - ((dy / cv.clientHeight) * 1040) / this.mapZoom,
            -400,
            400,
          );
          this.drawFullMap();
        }
        start.px = e.clientX;
        start.py = e.clientY;
      });
      cv.addEventListener("pointerup", (e) => {
        if (start && !start.moved) {
          let r = cv.getBoundingClientRect(),
            span = 1040 / this.mapZoom;
          this.marker = {
            x: this.mapCenter.x + ((e.clientX - r.left) / r.width - 0.5) * span,
            z: this.mapCenter.z + ((e.clientY - r.top) / r.height - 0.5) * span,
          };
          this.drawFullMap();
        }
        start = null;
      });
      cv.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this.mapZoom = clamp(
            this.mapZoom * (e.deltaY < 0 ? 1.13 : 1 / 1.13),
            1,
            5,
          );
          this.drawFullMap();
        },
        { passive: false },
      );
    }
    drawFullMap() {
      this.drawMap($("full-map"), true);
    }
  }
  window.addEventListener("error", (e) => {
    if (!root.AZUR && $("boot-message"))
      $("boot-message").textContent = "Erreur de chargement : " + e.message;
  });
  root.AZGame=Game;
})(window);
