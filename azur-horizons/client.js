/* Horizons client: responsive menus, complete controls, creative tools and editing. */
(function (root) {
  "use strict";
  const S = AZSim,
    M = AZMeta,
    I = AZIcons,
    $ = (id) => document.getElementById(id),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    clock = (n) =>
      Math.floor(Math.max(0, n) / 60) + ":" + String(Math.floor(Math.max(0, n)) % 60).padStart(2, "0");
  const MODES = {
    solo: { name: "Solo", icon: "solo", text: "Un seul survivant.", tag: "TOI + 99 IA · 100 PARTICIPANTS" },
    duo: {
      name: "Duo",
      icon: "users",
      text: "Un équipier IA à tes côtés.",
      tag: "1 ÉQUIPIER IA · 100 PARTICIPANTS AU TOTAL",
    },
    squad: {
      name: "Escouade",
      icon: "users",
      text: "Une équipe de quatre.",
      tag: "3 ÉQUIPIERS IA · 100 PARTICIPANTS AU TOTAL",
    },
    creative: {
      name: "Créatif",
      icon: "creative",
      text: "Ton île. Tes règles.",
      tag: "VOL • MATÉRIAUX ILLIMITÉS",
    },
    training: {
      name: "Entraînement",
      icon: "build",
      text: "Tout essayer, sans pression.",
      tag: "11 BOTS • INVULNÉRABILITÉ",
    },
    eventflight: {
      name: "Événement 2 · Vol sans fin",
      icon: "star",
      text: "Le même événement, sans crash : le bus continue au-delà de la carte. Le minuteur démarre à bord.",
      tag: "SANS CRASH · SANS ÉJECTION AUTOMATIQUE",
    },
    event: {
      name: "Événement",
      icon: "star",
      text: "Revivez la fin du chapitre comme dans la vidéo : fusées, failles, météorite, Point Zéro et trou noir, en restant libre de vos mouvements.",
      tag: "SANS DÉGÂTS · ≈ 6 MIN (BUS + 5 MIN)",
    },
  };
  const BTYPE = { wall: "Mur", floor: "Sol", ramp: "Rampe", roof: "Toit" },
    MAT = { wood: "Bois", stone: "Pierre", metal: "Métal" },
    BLUEPRINT = "/tasklet/drive/azur/saves/azur-creative.json",
    DEFAULT_BINDS = {
      forward: "KeyZ", back: "KeyS", left: "KeyQ", right: "KeyD", sprint: "ShiftLeft",
      jump: "Space", interact: "KeyE", reload: "KeyR", build: "KeyB",
      edit: "KeyF", material: "KeyG", crouch: "KeyC", map: "KeyM",
      inventory: "Tab", tool: "Digit0", emote: "KeyT", rotate: "KeyY",
      drop: "KeyX", fly: "KeyV", creative: "KeyI", melee: "KeyJ", garage: "KeyK",
      buildUp: "PageUp", buildDown: "PageDown", demolish: "Delete",
      slot1: "Digit1", slot2: "Digit2", slot3: "Digit3", slot4: "Digit4", slot5: "Digit5"
    },
    BIND_NAMES = {
      forward: "Avancer", back: "Reculer", left: "Gauche", right: "Droite", sprint: "Sprinter",
      jump: "Sauter", interact: "Interagir", reload: "Recharger", build: "Construire",
      edit: "Modifier", material: "Matériau", crouch: "S’accroupir", map: "Carte",
      inventory: "Inventaire", tool: "Pioche", emote: "Émote", rotate: "Tourner la construction",
      drop: "Jeter l’objet", fly: "Vol créatif", creative: "Atelier créatif", melee: "Coup de pioche", garage: "Garage",
      buildUp: "Étage supérieur", buildDown: "Étage inférieur", demolish: "Démolir",
      slot1: "Emplacement 1", slot2: "Emplacement 2", slot3: "Emplacement 3", slot4: "Emplacement 4", slot5: "Emplacement 5"
    },
    keyLabel = (code) => ({ Space: "ESPACE", Tab: "TAB", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Digit0: "0" }[code] || String(code || "—").replace(/^Key/, "").replace(/^Digit/, ""));
  const button = (act, label, id = "", cls = "btn-secondary") =>
    `<button class="btn ${cls}" data-act="${act}"${id !== "" ? ` data-id="${esc(id)}"` : ""}>${label}</button>`;
  class Horizons extends root.AZGame {
    async boot() {
      this.buildRotation = 0;
      this.buildLevel = 0;
      this.vehiclePaint = "#36bdd7";
      this.timeOfDay = "day";
      this.mapZoom = 1;
      this.lastAutoSave = 0;
      // v21 wiring : le client possède team-list (son format) — le socle
      // game.js saute alors son écriture, un seul innerHTML par changement.
      this._hudTeamListOwned = true;
      this.lift = 0;
      this.crouching = false;
      this.muted = false;
      this.keybinds = { ...DEFAULT_BINDS };
      this.keyCodes = {};
      this.captureBind = null;
      this.editing = false;
      await super.boot();
      if (this.profile.settings.layout === "qwerty") {
        this.keybinds.forward = "KeyW";
        this.keybinds.left = "KeyA";
      }
      document.body.dataset.screen = this.screen;
    }
    async loadProfile() {
      await super.loadProfile();
      if (!this.profile.horizonsGift && !this.storageBlocked) {
        this.profile.coins += 5000;
        this.profile.horizonsGift = true;
      }
      this.timeOfDay = this.profile.settings.daylight || "day";
      this.syncInputMode();
      document.body.classList.toggle("touch-ui", this.mobile);
    }
    syncInputMode(pointerType) {
      if (pointerType === "touch" || pointerType === "mouse") this.activePointerType = pointerType;
      const touchHardware = navigator.maxTouchPoints > 0;
      this.mobile = touchHardware && (this.activePointerType === "touch" ||
        (!this.activePointerType && (matchMedia("(pointer:coarse)").matches || this.profile.settings.touch === true)));
      document.body.classList.toggle("touch-ui", this.mobile);
    }
    renderMenu() {
      this.screen = "menu";
      this.paused = false;
      this.modal = null;
      this.overlay.innerHTML = "";
      this.touchSprint=false;
      document.body.dataset.screen = "menu";
      document.body.dataset.tab = this.tab;
      const p = this.profile,
        x = M.xpProgress(p),
        tabs = [
          ["play", "JOUER"],
          ["locker", "CASIER"],
          ["shop", "BOUTIQUE"],
          ["pass", "PASSE"],
          ["quests", "MISSIONS"],
          ["settings", "OPTIONS"],
        ];
      this.ui.innerHTML = `<header class="topbar"><button class="btn btn-ghost wordmark" data-act="tab" data-id="play" aria-label="Accueil AZUR"><span class="brand-spark">✦</span> AZUR<span class="wordmark-edition">HORIZONS</span></button><nav class="navlinks" aria-label="Menu principal">${tabs.map(([id, label]) => `<button class="btn btn-ghost ${this.tab === id ? "active" : ""}" data-act="tab" data-id="${id}">${I.icon(id === "play" ? "play" : id)}<span>${label}</span></button>`).join("")}</nav><div class="account-bar"><span class="currency" title="Écus fictifs, aucun paiement">◈ ${p.coins.toLocaleString("fr-FR")}</span><button class="btn btn-ghost profile-btn" data-act="tab" data-id="profile"><span class="level-badge">${x.level}</span><span>${esc(p.name)}</span></button></div></header>${this.tab === "play" ? this.lobbyHTML() : `<div class="page-preview-label"><span class="eyebrow">TA COLLECTION</span><h3>${esc(M.catalog.find((i) => i.id === (this.selectedCosmetic || p.equipment.character))?.name || "Explorateur")}</h3><p>Glisse sur le personnage<br>pour le faire tourner.</p><span class="preview-caption">APERÇU 3D JOUABLE</span></div><section class="scroll-panel">${this.tab === "help" ? this.helpHTML() : this.tab === "settings" ? this.settingsHTML() : AZPanels.render(this.tab, this)}</section>`}<footer class="bottom-bar"><span class="save-state"><span class="status-dot"></span><span data-save>${esc(this.saveStatus)}</span></span><span class="desktop-footer">V1.7.0 <span>•</span> MULTI-SUPPORTS • PC / MOBILE / MANETTE</span><div class="footer-links">${button("tab", "CARRIÈRE", "career", "btn-ghost btn-sm")}${button("tab", "GROUPE", "group", "btn-ghost btn-sm")}${button("tab", "? COMMANDES", "help", "btn-ghost btn-sm")}</div></footer>`;
      this.updatePreview();
      this.view?.queueThumbnails(this.profile.equipment);
      for (const el of document.querySelectorAll("[data-setting]")) {
        const v = this.profile.settings[el.dataset.setting];
        if (el.type === "checkbox") el.checked = !!v;
        else if (v !== undefined) el.value = String(v);
      }
      for (const type of ["shop", "locker"]) {
        const select = document.querySelector(`[data-act="${type}-filter"]`);
        if (select) select.value = this[type + "Filter"];
      }
    }
    lobbyHTML() {
      const mode = MODES[this.mode] || MODES.solo,
        ch = M.catalog.find((x) => x.id === this.profile.equipment.character);
      return `<section class="menu-left"><span class="season-badge"><span></span> MISE À JOUR 0.6 • EXPÉDITION CORAIL</span><h1>LA VILLE<br>EST À TOI<span>.</span></h1><p>Une île compacte. De nouvelles routes.<br>Construis, explore et prends le volant.</p><div class="lobby-facts"><span><b>${Object.values(S.districts).reduce((a,b)=>a+b,0)}</b> MAISONS</span><span><b>8</b> QUARTIERS</span><span><b>100</b> PARTICIPANTS</span></div>${button("tab", "DÉCOUVRIR LE CASIER ↗", "locker", "btn-ghost discover-link")}</section><div class="character-label"><span class="ready-tag">PRÊT POUR L’AVENTURE</span><strong>${esc(this.profile.name)}</strong><span>${esc(ch?.name)} <b>•</b> NIVEAU ${M.level(this.profile)}</span></div><aside class="lobby-card"><div class="mode-art"><img src="./assets/horizon.webp" alt="Illustration de l’archipel AZUR"><span class="mode-art-label">${this.mode === "creative" ? "CRÉE SANS LIMITES" : "CAP SUR L’HORIZONS"}</span><span class="local-badge"><span class="status-dot"></span> ${this.networkActive ? "RÉSEAU LOCAL" : "HORS LIGNE"}</span></div><div class="lobby-card-content"><div class="mode-title"><div><span class="eyebrow">CHOISIS TON MODE</span><h2>${mode.name}</h2></div>${I.icon(mode.icon)}</div><div class="mode-grid">${Object.entries(
        MODES,
      )
        .map(
          ([k, m]) =>
            `<button class="btn ${this.mode === k ? "btn-secondary selected-mode" : "btn-ghost"}" data-act="mode" data-id="${k}" aria-pressed="${this.mode === k}">${m.name}</button>`,
        )
        .join(
          "",
        )}</div><p class="local-tag">${mode.tag}</p><button class="btn btn-primary play-btn" data-act="play"><span>JOUER</span><span>↗</span></button><div class="lobby-detail"><span>${mode.text}</span><span>${this.mobile ? "TACTILE" : "PC"}</span></div></div></aside><aside class="news-strip"><button class="news-card" data-act="mode" data-id="creative"><span class="news-icon">${I.icon("creative")}</span><span><small>NOUVEAU MODE</small><b>À TOI DE BÂTIR.</b><em>Escaliers empilables · Voitures à fabriquer</em></span><span>↗</span></button><button class="news-card skin-news" data-act="tab" data-id="locker"><img src="./assets/char-onyx.webp" alt="Onyx"><span><small>${M.catalog.filter(c => c.type === "character").length} EXPLORATEURS</small><b>TROUVE TON STYLE.</b><em>5 000 écus fictifs de bienvenue</em></span><span>↗</span></button></aside>`;
    }
    settingsHTML() {
      const s = this.profile.settings,
        range = (k, name, min, max, step) =>
          `<label class="form-row"><span>${name}</span><input type="range" data-setting="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><output>${Math.round(s[k] * 100)} %</output></label>`,
        check = (k, name) =>
          `<label class="check-row"><input class="checkbox" type="checkbox" data-setting="${k}" ${s[k] ? "checked" : ""}><span>${name}</span></label>`;
      const bindRows = Object.keys(BIND_NAMES).map((k) => `<button class="keybind ${this.captureBind === k ? "listening" : ""}" data-act="bind-key" data-id="${k}"><span>${BIND_NAMES[k]}</span><kbd>${this.captureBind === k ? "APPUIE…" : keyLabel(this.keybinds[k])}</kbd></button>`).join("");
      return `<div class="panel-heading"><span class="eyebrow">UN JEU À TA MESURE</span><h2>Options</h2><p>Graphismes, son et commandes réglables.</p></div><div class="settings-grid"><section class="settings-section"><h3>IMAGE & INTERFACE</h3><label class="form-row"><span>Qualité graphique</span><select class="select" data-setting="quality"><option value="low">Fluide — priorité aux FPS</option><option value="medium">Équilibrée</option><option value="high">Élevée</option><option value="ultra">Ultra — détails maximum</option></select></label><label class="form-row"><span>Clavier de base</span><select class="select" data-setting="layout"><option value="azerty">AZERTY · ZQSD</option><option value="qwerty">QWERTY · WASD</option></select></label>${range("sensitivity", "Sensibilité caméra", 0.4, 2, 0.1)}${range("hud", "Taille de l’interface", 0.65, 1.15, 0.05)}${check("performance", "Adapter automatiquement la qualité — objectif 60 FPS")}${check("shadows", "Ombres douces")}${check("fps", "Afficher les FPS")}${check("assist", "Aide à la visée (tactile + manette)")}${check("invertY", "Inverser la caméra verticale")}${check("touch", "Afficher les boutons tactiles")}</section><section class="settings-section"><h3>SON & AMBIANCE</h3>${range("music", "Musique originale", 0, 1, 0.01)}${range("sfx", "Armes, impacts et ambiance", 0, 1, 0.01)}<label class="form-row"><span>Lumière en jeu</span><select class="select" data-setting="daylight"><option value="day">Grand soleil</option><option value="sunset">Heure dorée</option><option value="night">Nuit</option></select></label><p class="setting-note">Les sons se débloquent au premier clic. Chaque famille d’arme possède maintenant une attaque, un impact et une résonance distincts.</p><div class="dialog-actions">${button("export-save", "EXPORTER LE PROFIL")}${button("import-save", "IMPORTER LE PROFIL")}</div>${button("tab", "VOIR TOUTES LES COMMANDES", "help", "btn-ghost")}</section><section class="settings-section"><h3>MANETTE</h3><div class="dialog-actions">${button("pad-calibrate", "CALIBRER LES STICKS")}</div><p class="setting-note" id="pad-cal-status">Pose la manette sans toucher les sticks, puis lance la calibration : la dérive du centre est mesurée et mémorisée dans ton profil.</p><p class="setting-note">Si la dérive dépasse ta zone morte, celle-ci est relevée automatiquement. L’aide à la visée douce s’applique aussi à la manette quand « Aide à la visée » est activée.</p></section><section class="keybinds"><h3>TOUCHES PERSONNALISÉES</h3><p>Choisis une action puis appuie sur la nouvelle touche. Tous les raccourcis sont actifs immédiatement pendant cette session.</p><div class="keybind-grid">${bindRows}</div><div class="dialog-actions">${button("bind-reset", "RÉINITIALISER LES TOUCHES", "", "btn-ghost")}</div></section></div>`;
    }
    helpHTML() {
      const rows = [
        [["forward","left","back","right"].map(k=>keyLabel(this.keybinds[k])).join(" / "), "Se déplacer"],
        ["Souris", "Maintenir clic droit pour regarder et viser ; bouton SOURIS pour verrouiller"],
        ["Clic gauche / bouton TIR", "Tirer, construire ou utiliser immédiatement le soin sélectionné"],
        [`${keyLabel(this.keybinds.jump)} / Maj / ${keyLabel(this.keybinds.crouch)}`, "Sauter / courir / s’accroupir"],
        [`${keyLabel(this.keybinds.jump)} dans le bus`, "Sauter ; planeur automatique à 135 m, ouverture anticipée possible"],
        [`${keyLabel(this.keybinds.interact)} / ${keyLabel(this.keybinds.reload)}`, "Interagir / recharger"],
        [`${keyLabel(this.keybinds.tool)} / 1–5 / X`, "Pioche / inventaire / jeter l’objet"],
        [`${keyLabel(this.keybinds.build)} / 1–4`, "Mode construction / mur, sol, rampe, toit"],
        [`${keyLabel(this.keybinds.material)} / C (en construction)`, "Changer de matériau / tourner la pièce"],
        ["Page ↑ / Page ↓ (construction)", "Étage au-dessus / en dessous ; AUTO suit la rampe"],
        ["K / GARAGE", "Fabriquer une berline, un buggy ou un coupé : 80 métal, gratuit en cr��atif"],
        ["ZQSD / WASD (véhicule)", "Accélérer, freiner / reculer et tourner ; E pour sortir"],
        [`${keyLabel(this.keybinds.edit)} / Suppr`, "Édition 3×3 directe dans le monde / démolir"],
        ["J", "Coup de crosse au corps à corps / coup de pioche"],
        ["M / Tab / Échap", "Carte / inventaire / pause"],
        ["T / bouton ÉMOTE", "Emote / tirer avec la canne au bord de l’océan"],
        ["I / V (créatif)", "Atelier / basculer le vol"],
        ["Espace / Ctrl (en vol)", "Monter / descendre"],
      ];
      return `<div class="panel-heading"><span class="eyebrow">PRÊT À EXPLORER ?</span><h2>Les commandes</h2><p>Clavier, souris et tactile. Chaque action affichée est reliée au jeu.</p></div><div class="help-grid"><section><h3>PC</h3><table class="key-table"><tbody>${rows.map(([a, b]) => `<tr><td><kbd>${a}</kbd></td><td>${b}</td></tr>`).join("")}</tbody></table></section><section class="help-cards"><article><h3>TACTILE</h3><p>Joystick à gauche, actions compactes à droite. Sélectionne une trousse ou un bouclier puis appuie sur UTILISER. BÂTIR choisit la pièce ; ÉDITER ouvre directement la grille 3×3 sur le monde.</p></article><article><h3>CRÉATIF</h3><p>Matériaux et munitions illimités, invulnérabilité. Ouvre l’atelier pour choisir des armes, ajouter de 0 à 100 bots, changer de lieu et sauvegarder ou importer tes constructions.</p></article><article><h3>ÉDITION 3×3</h3><p>Vise ta pièce puis utilise la touche choisie ou ÉDITER. Touche les cases directement sur le monde et valide : ouvertures, passages et tirs changent réellement.</p></article><article><h3>PARTIES LOCALES</h3><p>100 participants au total : toi et 99 IA en local, pas 100 joueurs humains. Le réseau local optionnel existe dans le serveur séparé ; aucun serveur public ni compte en ligne n’est fourni.</p></article></section></div>`;
    }
    async action(act, id, el) {
      if (act === "tab" && this.screen === "game") {
        if (id === "help") {
          this.openHelp();
          return;
        }
        return;
      }
      if (act === "bind-key") {
        if (!BIND_NAMES[id]) return;
        this.captureBind = id;
        this.renderMenu();
        document.querySelector(`[data-act="bind-key"][data-id="${id}"]`)?.focus();
        return;
      }
      if (act === "bind-reset") {
        this.keybinds = { ...DEFAULT_BINDS };
        if (this.profile.settings.layout === "qwerty") { this.keybinds.forward = "KeyW"; this.keybinds.left = "KeyA"; }
        this.captureBind = null;
        this.renderMenu();
        this.toast("Touches réinitialisées pour cette session.");
        return;
      }
      if (act === "edit-cancel") { this.closeWorldEdit(false); return; }
      if (act === "garage") { root.AZGarage.open(this); return; }
      if (act === "garage-paint") { root.AZGarage.paint(this,id); return; }
      if (act === "garage-craft") { root.AZGarage.craft(this,id); return; }
      if (["build-up","build-down","build-auto"].includes(act)) {
        if (!this.buildType || this.modal) return;
        this.buildLevel = act === "build-auto" ? 0 : clamp((this.buildLevel || 0) + (act === "build-up" ? 1 : -1),-1,1);
        this.updateBuildBar(); this.updateHUD(); this.audio.ui(); return;
      }
      if (act === "mode" && !MODES[id]) return;
      if (act === "aim") {
        this.aim = !this.aim; this.updateHUD(); return;
      }
      if (act === "melee") { this.send({ melee: true }); return; }
      if (act === "rotate") {
        this.buildRotation = ((this.buildRotation || 0) + 1) % 4;
        this.audio.ui();
        this.updateBuildBar();
        return;
      }
      if (act === "edit") {
        if (this.editing) this.action("edit-confirm");
        else this.openEdit();
        return;
      }
      if (act === "edit-cell") {
        const next = this.editMask ^ (1 << Number(id));
        if (!next) { this.toast("Garde au moins un module — utilise DÉMOLIR pour retirer la pièce."); return; }
        this.editMask = next;
        this.paintEdit();
        this.audio.ui();
        return;
      }
      if (act === "edit-preset") {
        this.editMask = Number(id);
        this.paintEdit();
        this.audio.ui();
        return;
      }
      if (act === "edit-repair") {
        if (this.editTarget) this.send({ editId: this.editTarget, editMask: 511 });
        this.editMask = 511;
        this.closeWorldEdit(true);
        return;
      }
      if (act === "edit-confirm") {
        if (this.editTarget) this.send({ editId: this.editTarget, editMask: this.editMask });
        this.closeWorldEdit(true);
        return;
      }
      if (act === "demolish") {
        this.send({ demolish: true });
        return;
      }
      if (act === "crouch") {
        this.crouching = !this.crouching;
        this.send({ crouch: this.crouching });
        this.audio.ui();
        return;
      }
      if (act === "jump" && this.player()?.flying) {
        this.lift = 1;
        clearTimeout(this.liftTimeout);
        this.liftTimeout = setTimeout(() => (this.lift = 0), 260);
        return;
      }
      if (act === "fly") {
        if (this.mode !== "creative") {
          this.toast("Le vol est réservé au mode créatif.");
          return;
        }
        this.send({ fly: true });
        this.audio.ui();
        return;
      }
      if (act === "fish") {
        this.send({ fish: true });
        return;
      }
      if (act === "creative") {
        this.openCreative();
        return;
      }
      if (act === "creative-give") {
        if (this.world.creativeGive(this.myId, id, 4)) {
          this.harvest = false;
          this.buildType = null;
          this.toast("Équipement ajouté au créneau sélectionné.");
          this.audio.reward();
        }
        this.updateHUD();
        return;
      }
      if (act === "creative-bots") {
        const r = this.world.setCreativeBots(Number($("creative-bots").value));
        this.toast(r.message + ` : ${r.count}`, !r.ok);
        this.openCreative();
        return;
      }
      if (act === "creative-teleport") {
        const r = S.regions[Number($("creative-poi").value)];
        if (r) {
          this.world.teleport(this.myId, r.x, r.z + 55);
          this.closeModal();
          this.toast(r.name);
          this.yaw = 0;
        }
        return;
      }
      if (act === "creative-day") {
        this.timeOfDay = id;
        this.openCreative();
        return;
      }
      if (act === "creative-save") {
        await this.saveBlueprint(false);
        return;
      }
      if (act === "creative-export") {
        const bp = this.blueprintData();
        this.downloadJSON(bp, "AZUR-mon-ile.json");
        return;
      }
      if (act === "creative-import") {
        $("blueprint-import").click();
        return;
      }
      if (act === "creative-clear") {
        this.overlay.innerHTML = `<div class="modal-shade"><section class="dialog"><span class="eyebrow">EFFACER TES CONSTRUCTIONS ?</span><h2>On repart de zéro ?</h2><p>Les villes et le décor restent en place. Exporte un plan si tu veux garder cette création.</p><div class="dialog-actions">${button("creative-export", "EXPORTER D’ABORD")}${button("creative-clear-confirm", "EFFACER", "", "btn-danger")}${button("creative", "ANNULER", "", "btn-ghost")}</div></section></div>`;
        return;
      }
      if (act === "creative-clear-confirm") {
        this.world.clearBuilds(this.myId);
        this.dirtyScene = true;
        this.closeModal();
        this.toast("Tes constructions ont été effacées.");
        return;
      }
      if (act === "map-center") {
        this.mapCenter = { x: 0, z: 0 };
        this.mapZoom = 1;
        this.drawFullMap();
        return;
      }
      if (act === "mute") {
        this.muted = !this.muted;
        this.audio.mute(this.muted);
        this.toast(this.muted ? "Son coupé." : "Son réactivé.");
        return;
      }
      if (act === "help-game") {
        this.openHelp();
        return;
      }
      if (act === "use") {
        const p = this.player();
        if (!p) return;
        if (!["heal", "shield"].includes(p.inventory[p.selected]?.kind)) {
          let i = p.inventory.findIndex((v) => v?.kind === "heal" && p.hp < 100);
          if (i < 0) i = p.inventory.findIndex((v) => v?.kind === "shield" && p.shield < 100);
          if (i < 0) {
            this.toast("Sélectionne un soin, ou récupère-en dans un coffre.");
            return;
          }
          this.send({ slot: i, use: true });
        } else this.send({ use: true });
        return;
      }
      if (act === "reload") {
        const p = this.player(),
          it = p?.inventory[p.selected];
        if (!it || it.kind !== "weapon") {
          this.toast("Sélectionne une arme à recharger.");
          return;
        }
        if (it.ammo >= S.weapons[it.weapon].clip) {
          this.toast("Chargeur déjà plein.");
          return;
        }
        // Reload sound is triggered by the accepted simulation event.
      }
      if (act === "emote") {
        this.buildType = null;
        this.harvest = false;
      }
      if (act === "surrender" && ["creative", "training"].includes(this.mode)) {
        this.closeModal();
        await this.leaveToLobby();
        return;
      }
      if (act === "slot") {
        this.buildType = null;
        this.updateBuildBar();
      }
      await super.action(act, id, el);
      if (act === "slot" && this.mobile && !this.modal) {
        const selected = this.player()?.inventory[Number(id)];
        if (selected && (selected.kind === "heal" || selected.kind === "shield")) this.send({ use: true });
      }
      if (act === "slot" && this.modal === "inventory") this.openInventory();
      if (!this.buildType) this.buildLevel=0;
      if (["build-mode", "build-type", "tool"].includes(act)) this.updateBuildBar();
    }
    bind() {
      document.addEventListener('keydown',e=>{if(this.modal!=='modes')return;if(e.key==='Escape'){e.preventDefault();this.action('close-modes');return;}if(e.key==='Tab'){const all=[...this.overlay.querySelectorAll('button:not([disabled])')],first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
      document.addEventListener("pointerdown", (e) => { if(e.isTrusted) this.syncInputMode(e.pointerType); }, true);
      document.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-act],canvas[data-act],a[data-act]");
        if (b) {
          if (b._pointerActionAt && performance.now() - b._pointerActionAt < 700 && e.detail !== 0) { e.preventDefault(); return; }
          e.preventDefault();
          this.action(b.dataset.act, b.dataset.id, b);
        }
      });
      const updateSetting = (e) => {
        const k = e.target.dataset.setting;
        if (!k) return;
        this.profile.settings[k] =
          e.target.type === "checkbox"
            ? e.target.checked
            : e.target.type === "range"
              ? +e.target.value
              : e.target.value;
        if (k === "layout") {
          const qwerty = e.target.value === "qwerty";
          this.keybinds.forward = qwerty ? "KeyW" : "KeyZ";
          this.keybinds.left = qwerty ? "KeyA" : "KeyQ";
        }
        this.profile = M.normalize(this.profile);
        this.view?.configure(this.profile.settings);
        this.audio.configure(this.profile.settings);
        this.timeOfDay = this.profile.settings.daylight || "day";
        this.syncInputMode();
        document.body.classList.toggle("touch-ui", this.mobile);
        document.documentElement.style.setProperty("--hud-scale", this.profile.settings.hud);
        const out = e.target.parentElement.querySelector("output");
        if (out) out.textContent = Math.round(+e.target.value * 100) + " %";
        clearTimeout(this.settingTimer);
        this.settingTimer = setTimeout(() => this.queueSave(), 200);
      };
      document.addEventListener("input", (e) => {
        if (e.target.type === "range") updateSetting(e);
      });
      document.addEventListener("change", (e) => {
        if (e.target.dataset.setting) updateSetting(e);
        else if (e.target.matches("select[data-act]"))
          this.action(e.target.dataset.act, e.target.value, e.target);
      });
      $("save-import").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          if (f.size > 1000000) throw Error("Profil trop volumineux.");
          const p = JSON.parse(await f.text());
          if (p?.version !== 1 || !p.equipment || !Array.isArray(p.owned))
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
      $("blueprint-import").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          if (this.mode !== "creative") throw Error("Lance le mode créatif pour importer un plan.");
          if (f.size > 2000000) throw Error("Plan trop volumineux.");
          const bp = JSON.parse(await f.text()),
            r = this.world.importBuilds(this.myId, bp);
          if (!r.ok) throw Error(r.message);
          this.toast(`${r.count} constructions importées.`);
          this.dirtyScene = true;
          this.closeModal();
        } catch (err) {
          this.toast(err.message, true);
        }
        e.target.value = "";
      });
      window.addEventListener("resize", () => this.view?.resize());
      const unfocus = () => {
        this.resetControls();
        this.send({fire:false, aim:false, moveX:0, moveZ:0, moveY:0, sprint:false});
        if (this.screen === "game" && !this.socket && !this.modal) this.togglePause();
      };
      window.addEventListener("blur", unfocus);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) unfocus();
      });
      window.addEventListener("pagehide", () => {
        if (this.mode === "creative" && this.world)
          try {
            localStorage.setItem("azur-creative-v2", JSON.stringify(this.blueprintData()));
          } catch {}
      });
      document.addEventListener("keydown", (e) => {
        if (this.captureBind) {
          e.preventDefault();
          if (e.code === "Escape") {
            this.captureBind = null;
            this.renderMenu();
            return;
          }
          const action = this.captureBind;
          const previous = this.keybinds[action];
          const conflict = Object.keys(this.keybinds).find((key) => key !== action && this.keybinds[key] === e.code);
          if (conflict) this.keybinds[conflict] = previous;
          this.keybinds[action] = e.code;
          this.captureBind = null;
          this.renderMenu();
          this.toast(`${BIND_NAMES[action]} : ${keyLabel(e.code)}`);
          return;
        }
        if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (this.screen !== "game") return;
        if (["Space", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.code))
          e.preventDefault();
        this.keys[e.key.toLowerCase()] = true;
        this.keyCodes[e.code] = true;
        if (e.repeat) return;
        if (e.code === "Escape") {
          if (this.editing) this.closeWorldEdit(false);
          else this.modal ? this.closeModal() : this.togglePause();
          return;
        }
        if (this.editing && e.code === "Enter") {
          if (e.isComposing || e.keyCode === 229) return;
          this.action("edit-confirm");
          return;
        }
        if (this.modal === "emotes") {
          if (e.code === "KeyT") { this.closeModal(); return; }
          if (/^Digit[1-6]$/.test(e.code)) { this.action("emote-play", S.EMOTE_STYLES[Number(e.code.slice(5)) - 1]); return; }
          if (["KeyW","KeyA","KeyS","KeyD","KeyZ","KeyQ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) {
            this.closeModal(); this.keys[e.key.toLowerCase()] = true;
            if (e.code === "Space") this.action("jump");
            return;
          }
          if (e.code === "Tab") {
            const buttons = [...this.overlay.querySelectorAll('button:not([disabled])')];
            const index = buttons.indexOf(document.activeElement);
            buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
          }
          return;
        }
        if (this.modal) {
          if (e.code === "Enter" && this.modal === "edit") this.action("edit-confirm");
          return;
        }
        const slotIndex = ["slot1", "slot2", "slot3", "slot4", "slot5"].findIndex((name) => this.keybinds[name] === e.code);
        if (slotIndex >= 0) {
          const i = slotIndex;
          if (this.buildType && i < 4) {
            this.buildType = Object.keys(BTYPE)[i];
            this.updateBuildBar();
          } else this.action("slot", String(i));
          return;
        }
        const bound = Object.keys(this.keybinds).find((name) => this.keybinds[name] === e.code);
        const act = ({
          jump: "jump", interact: "interact", reload: "reload", build: "build-mode",
          edit: "edit", material: "material", crouch: "crouch", map: "map",
          inventory: "inventory", tool: "tool", emote: "emote", rotate: "rotate",
          drop: "drop", fly: "fly", creative: "creative", melee: "melee", garage: "garage",
          buildUp: "build-up", buildDown: "build-down", demolish: "demolish"
        })[bound];
        if (act) this.action(act);
      });
      document.addEventListener("keyup", (e) => {
        delete this.keys[e.key.toLowerCase()];
        delete this.keyCodes[e.code];
      });
      this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      this.canvas.addEventListener("pointerdown", (e) => {
        this.audio.start();
        if (this.screen === "menu") {
          this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, menu: true };
          this.canvas.setPointerCapture(e.pointerId);
          return;
        }
        if (this.screen !== "game" || this.modal || this.editing) return;
        if (e.pointerType === "touch" || e.button === 2 || (this.world.phase === "transport" && !this.player()?.deployed)) {
          // v21 wiring : regard tactile amplifié (×1.6) — voir game.js, même logique.
          this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
          this.canvas.setPointerCapture(e.pointerId);
          if (e.button === 2 && !(this.world.phase === "transport" && !this.player()?.deployed)) this.aim = true;
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
          // v21 wiring : regard tactile amplifié (×1.6).
          const boost = this.pointer.touch ? 1.6 : 1;
          this.look(dx * boost, dy * boost);
        } else if (document.pointerLockElement === this.canvas && !this.modal)
          this.look(e.movementX, e.movementY);
      });
      const release = (e) => {
        if (this.pointer?.id === e.pointerId) this.pointer = null;
        if (e.pointerType !== "touch") {
          if (e.button === 0) this.fire = false;
          if (e.button === 2) this.aim = false;
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
      this.canvas.addEventListener(
        "wheel",
        (e) => {
          if (this.screen !== "game" || this.modal) return;
          e.preventDefault();
          if (this.buildType) {
            const keys = Object.keys(BTYPE);
            this.buildType = keys[(keys.indexOf(this.buildType) + (e.deltaY > 0 ? 1 : 3)) % 4];
            this.updateBuildBar();
          } else {
            const p = this.player();
            this.action("slot", String((p.selected + (e.deltaY > 0 ? 1 : 4)) % 5));
          }
        },
        { passive: false },
      );
    }
    send(input) {
      if (input.build) {
        input = { ...input, rotation: this.buildRotation || 0, buildLevel: this.buildLevel || 0 };
        const check = this.world?.canBuild?.(this.player(),input.build,input.material,input.rotation,input.buildLevel);
        if (check?.reason === "duplicate") return false;
      }
      return super.send(input);
    }
    fireOnce() {
      if (this.modal || this.screen !== "game") return;
      this.send({
        yaw: this.yaw,
        pitch: this.pitch,
        ...(!this.buildType && !this.harvest ? this.view.shotDirection(this.player(), this.yaw, this.pitch) : {}),
        ...(this.buildType
          ? { build: this.buildType, material: this.material, rotation: this.buildRotation || 0 }
          : this.harvest
            ? { harvest: true }
            : { shoot: true }),
      });
      if (this.harvest) {
        const av = this.view.actors.get(this.myId);
        if (av) av.userData.harvest = 1;
      }
      this.actionTime = this.frameTime;
    }
    input() {
      const input = super.input();
      // v21 wiring : valeurs lissées du stick tactile (calculées dans
      // super.input()) — clavier instantané, pouce stabilisé.
      input.moveX = (this.keyCodes[this.keybinds.right] ? 1 : 0) - (this.keyCodes[this.keybinds.left] ? 1 : 0) + (this._touchX ?? this.move.x);
      input.moveZ = (this.keyCodes[this.keybinds.forward] ? 1 : 0) - (this.keyCodes[this.keybinds.back] ? 1 : 0) + (this._touchZ ?? this.move.z);
      const airborne=this.player()?.falling||this.player()?.gliding;
      const sprintHeld=!!this.keyCodes[this.keybinds.sprint];
      input.sprint=airborne ? sprintHeld||!!this.touchSprint : input.sprint||sprintHeld||!!this.touchSprint;
      input.moveY = clamp((this.keyCodes[this.keybinds.jump] ? 1 : 0) - (this.keys.control ? 1 : 0) + (this.lift || 0), -1, 1);
      input.crouch = !!this.crouching;
      if (this.editing) input.fire = false;
      if (input.fire && !this.harvest && !this.buildType && this.view) Object.assign(input, this.view.shotDirection(this.player(), this.yaw, this.pitch));
      return input;
    }
    async startMatch() {
      this.editing = false;
      document.body.classList.remove("world-editing");
      this.buildRotation = 0;
      this.buildLevel = 0;
      this.crouching = false;
      this.mapCenter = { x: 0, z: 0 };
      this.mapZoom = 1;
      this.dirtyScene = false;
      await super.startMatch();
      if (this.screen === "game" && this.mode === "creative") {
        const spawn = S.regions.find(r=>r.style === "citadel");
        this.world.teleport(this.myId, spawn.x, spawn.z + spawn.padD + 8);
        try {
          let bp;
          if (typeof root.tasklet?.invokeTool === "function") {
            const raw = await tasklet.invokeTool({ toolName: "read_file", args: { path: BLUEPRINT } });
            bp = this.parseBlueprint(raw);
          } else {
            const raw = localStorage.getItem("azur-creative-v2");
            if (raw) bp = JSON.parse(raw);
          }
          if (bp) {
            const r = this.world.importBuilds(this.myId, bp);
            if (r.ok) {
              if (bp.spawn && Number.isFinite(bp.spawn.x) && Number.isFinite(bp.spawn.z))
                this.world.teleport(this.myId, bp.spawn.x, bp.spawn.z);
              if (["day", "sunset", "night"].includes(bp.timeOfDay)) this.timeOfDay = bp.timeOfDay;
              this.toast(`Île restaurée · ${r.count} constructions.`);
            }
          }
        } catch (e) {
          /* A missing blueprint is expected on the first launch. */
        }
        this.updateHUD();
      }
      if (this.screen === "game") document.body.dataset.screen = "game";
    }
    startGameUI() {
      this.resetControls();
      this.paused = false; this.modal = null; this.overlay.innerHTML = "";
      this.screen = "game";
      document.body.dataset.screen = "game";
      this.frameTime = 0;
      this.lastHud = 0;
      this.touchSprint=false;this.touchMore=false;this.damageCombo=null;
      this.acc=0;this.commandTime=0;this.actionTime=0;this.flightSample=null;this.flightKmh=0;
      this.buildRotation=0;this.buildLevel=0;this.lift=0;this.crouching=false;
      this.mapCenter={x:0,z:0};this.mapZoom=1;
      document.body.classList.remove('in-storm','driving','building','emoting');
      this.canvas.focus({preventScroll:true});
      clearTimeout(this.damageTimer);clearTimeout(this.eliminationTimer);
      this.ui.innerHTML = `<div class="hud"><div class="hud-top"><div class="hud-pill live-counter"><b id="remaining">100</b><span>EN VIE</span><i></i><b id="kills">0</b><span>ÉLIM.</span></div><div id="net-label" class="net-label"></div><div id="team-list" class="team-list"></div>${this.mode === "creative" ? button("creative", I.icon("creative") + " ATELIER <kbd>I</kbd>", "", "creative-open") : ""}</div><div class="compass" id="compass">N <b>0°</b></div><div class="phase-banner"><b id="phase-title"></b><small id="phase-detail"></small></div><div class="minimap-box"><canvas id="minimap" width="240" height="240" data-act="map" aria-label="Ouvrir la carte"></canvas><div class="map-status"><span id="storm-timer"></span><span id="region-name"></span></div></div><div id="storm-warning" class="storm-warning"></div><div id="scope" class="scope-overlay" hidden aria-label="Lunette de précision"><div class="scope-circle"><i></i><b></b><span>ORION · 4×</span></div></div><div id="crosshair" class="crosshair"><span></span></div><div id="damage-confirm" class="damage-confirm v7-damage" aria-live="off"></div><div id="elimination-confirm" class="v7-elimination" role="status" aria-live="polite"></div><div id="flight-speed" class="v7-flight-speed" hidden></div><div id="emote-status" class="v8-emote-status" hidden role="status"></div><div id="interaction" class="interaction-prompt" hidden></div><div id="feed" class="feed"></div><div class="health-block" id="health-block"><div class="health-row shield"><span>⬡</span><div class="health-track"><div id="shield-bar"></div></div><b id="shield-value">0</b></div><div class="health-row"><span>+</span><div class="health-track"><div id="health-bar"></div></div><b id="health-value">100</b></div></div><div id="ammo" class="ammo-readout"></div><div id="use-progress" class="v9-use-progress" role="status" hidden><span id="use-label"></span><progress id="use-meter" max="1" value="0"></progress><small>Reste immobile · les dégâts interrompent</small></div><div id="materials" class="materials"></div><div id="slots" class="inventory-bar"></div><div id="build-bar" class="build-bar" hidden></div><div id="build-status" class="build-status" hidden aria-live="off"></div><div class="game-hint"><kbd>${["forward","left","back","right"].map(k=>keyLabel(this.keybinds[k])).join("")}</kbd> Bouger · <kbd>${keyLabel(this.keybinds.build)}</kbd> Construire · <kbd>${keyLabel(this.keybinds.edit)}</kbd> Modifier</div><div class="game-toolbar">${button("pause", "Ⅱ", "", "btn-neutral")}${button("inventory", "▦", "", "btn-neutral")}${button("lock", "SOURIS", "", "btn-neutral desktop-only")}${button("fullscreen", "⛶", "", "btn-neutral")}${button("help-game", "?", "", "btn-neutral")}${button("emote", "♪ ÉMOTES <kbd>T</kbd>", "", "btn-neutral emote-open")}${button("mute", I.icon("sound"), "", "btn-neutral")}${button("garage", "GARAGE <kbd>K</kbd>", "", "btn-neutral garage-open")}</div><div id="world-edit" class="world-edit" hidden></div>${this.touchHTML()}<span class="fps-label" id="fps"></span></div>`;
      this.bindTouch();
      this.updateBuildBar();
      this.updateHUD();
    }
    touchHTML() {
      const icons={fire:'<circle cx="12" cy="12" r="7"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',aim:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',jump:'<path d="m5 11 7-7 7 7M12 4v16M4 21h16"/>',interact:'<path d="M4 8h16v13H4zM8 8V4h8v4m-4 4v6m-3-3h6"/>',reload:'<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',crouch:'<circle cx="14" cy="4" r="2"/><path d="m13 8-3 6 6 3-2 5m-4-8-6 4m9-10 5 4h4"/>',tool:'<path d="m5 22 9-15M3 6c6-4 11-3 18 3l-2 3c-5-4-10-5-16-6Z"/>',build:'<path d="M3 4h18v17H3zM3 10h18M3 16h18M9 4v6m6 0v6m-6 0v5"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',sprint:'<path d="m4 12 7-7v5l9-5-6 8h6L8 22l3-10Z"/>'};
      const key=(act,label,icon,extra='')=>`<button class="touch-btn v7-touch-${act}" data-act="${act}" aria-label="${label}" ${extra}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[icon]||icons.more}</svg><span>${label}</span></button>`;
      return `<div class="touch-controls"><div id="joy" class="joy" role="application" aria-label="Joystick : glisser pour avancer et tourner"><div class="joy-ring"></div><div id="joy-nub" class="joy-nub"></div></div>${key('sprint','SPRINT','sprint','aria-pressed="false"')}<div class="touch-right">${key('aim','VISER','aim','aria-pressed="false"')}<button class="touch-btn fire" id="touch-fire" aria-label="Utiliser l’objet sélectionné ; maintenir pour tirer ou construire"><svg viewBox="0 0 24 24" aria-hidden="true">${icons.fire}</svg><span>TIR</span></button>${key('jump','SAUT','jump','data-lift="1"')}${key('interact','PRENDRE','interact')}${key('reload','RECH.','reload')}${key('crouch','BAS','crouch','aria-pressed="false"')}${key('tool','PIOCHE','tool','aria-pressed="false"')}${key('build-mode','BÂTIR','build','aria-pressed="false"')}${key('edit','ÉDITER','build')}</div>${key('emote','ÉMOTE','more').replace('touch-btn','touch-btn touch-emote-mini')}${this.mode==='creative'?`<div id="touch-utility" class="touch-utility creative-utility">${key('fly','VOL','jump')}<button class="touch-btn" data-lift="-1" aria-label="Descendre en vol">↓<span>DESC.</span></button></div>`:''}</div>`;
    }
    bindTouch() {
      super.bindTouch();
      const fireButton=$('touch-fire');
      let fireLook=null;
      fireButton.addEventListener('pointerdown',e=>{if(this.firePointerId===e.pointerId){fireLook={id:e.pointerId,x:e.clientX,y:e.clientY};fireButton.classList.add('pressed');}});
      fireButton.addEventListener('pointermove',e=>{if(fireLook?.id!==e.pointerId||this.modal)return;this.look(e.clientX-fireLook.x,e.clientY-fireLook.y);fireLook.x=e.clientX;fireLook.y=e.clientY;});
      for(const name of ['pointerup','pointercancel','lostpointercapture'])fireButton.addEventListener(name,e=>{if(fireLook?.id===e.pointerId){fireLook=null;fireButton.classList.remove('pressed');}});
      for (const b of document.querySelectorAll(".touch-btn[data-act], .touch-btn[data-lift]")) {
        let pointerId = null;
        b.addEventListener("pointerdown", (e) => {
          if (pointerId !== null || this.modal || this.paused) return;
          e.preventDefault(); e.stopPropagation();
          pointerId = e.pointerId;
          b.setPointerCapture(e.pointerId);
          b._pointerActionAt = performance.now();
          b.classList.add("pressed");
          this.audio.start();
          if (this.player()?.flying && b.dataset.lift) this.lift = Number(b.dataset.lift);
          else if (b.dataset.act) this.action(b.dataset.act, b.dataset.id, b);
        });
        const release = (e) => {
          if (e.pointerId !== pointerId) return;
          pointerId = null; b.classList.remove("pressed");
          if (b.dataset.lift) this.lift = 0;
          b._pointerActionAt = performance.now();
        };
        for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, release);
      }
    }
    updateBuildBar() {
      const e = $("build-bar");
      if (!e) return;
      e.hidden = !this.buildType;
      const symbols = { wall: "▥", floor: "▱", ramp: "◩", roof: "⌂" };
      e.innerHTML = `<span class="build-label">CONSTRUCTION</span>${Object.keys(BTYPE)
        .map((k, i) =>
          button(
            "build-type",
            `<strong>${symbols[k]}</strong><span>${BTYPE[k]}</span><kbd>${i + 1}</kbd>`,
            k,
            k === this.buildType ? "btn-primary" : "btn-ghost",
          ),
        )
        .join(
          "",
        )}${button("material", `${MAT[this.material]} · ${S.BUILD_DURABILITY[this.material]} PV<kbd>${keyLabel(this.keybinds.material)}</kbd>`)}${button("rotate", `↻ ${(this.buildRotation || 0) * 90}°<kbd>${keyLabel(this.keybinds.rotate)}</kbd>`)}<div class="build-level-controls" role="group" aria-label="Étage de construction"><button class="btn btn-ghost" data-act="build-down" aria-label="Étage inférieur" ${(this.buildLevel||0)<=-1?"disabled":""}>−</button><button class="btn ${this.buildLevel?"btn-secondary":"btn-primary"}" data-act="build-auto" title="Revenir au suivi automatique de la rampe">${this.buildLevel>0?"+1 ÉTAGE":this.buildLevel<0?"−1 ÉTAGE":"AUTO ↑"}</button><button class="btn btn-ghost" data-act="build-up" aria-label="Étage supérieur" ${(this.buildLevel||0)>=1?"disabled":""}>+</button></div>${button("edit", `ÉDITER<kbd>${keyLabel(this.keybinds.edit)}</kbd>`, "", "btn-ghost")}${button("demolish", "DÉMOLIR", "", "btn-ghost")}${button("build-mode", "×", "", "btn-ghost")}`;
      document.body.classList.toggle("building", !!this.buildType);
      if ($("build-status")) $("build-status").hidden=!this.buildType;
    }
    updateHUD() {
      if (this.screen !== "game" || !$("remaining")) return;
      const w = this.world,
        p = this.player(),
        it = p.inventory[p.selected],
        free = ["creative", "training"].includes(w.mode);
      $("remaining").textContent = w.players.filter((p) => p.alive).length;
      $("kills").textContent = p.kills;
      $("health-bar").style.width = clamp(p.hp, 0, 100) + "%";
      $("shield-bar").style.width = clamp(p.shield, 0, 100) + "%";
      $("health-value").textContent = Math.max(0, Math.ceil(p.hp));
      $("shield-value").textContent = Math.round(p.shield);
      $("health-block")?.classList.toggle("low-health", p.hp > 0 && p.hp <= 30);
      $("net-label").textContent =
        w.mode === "creative"
          ? `CRÉATIF • ${w.players.filter((q) => q.bot).length} BOTS • INVULNÉRABLE`
          : w.mode === "training"
            ? "ENTRAÎNEMENT • SANS XP"
            : this.socket
              ? "SERVEUR LOCAL • IA + HUMAINS"
              : `${w.players.filter((q) => q.bot).length} BOTS • LOCAL`;
      const heading = ((Math.round((-this.yaw * 180) / Math.PI) % 360) + 360) % 360,
        dir = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"][Math.round(heading / 45) % 8];
      // v21 wiring : la boussole ne re-rend que si le cap a changé (0,13 s → ~0 DOM).
      if (this._lastHeading !== heading) {
        this._lastHeading = heading;
        $("compass").innerHTML =
          `<span>· &nbsp; · &nbsp; | &nbsp; · &nbsp; ·</span> <b>${dir}</b> ${heading}° <span>· &nbsp; · &nbsp; | &nbsp; · &nbsp; ·</span>`;
      }
      let title =
          w.phase === "waiting"
            ? `DÉPART DANS ${Math.max(1, Math.ceil(10 - w.phaseTime))}`
            : w.phase === "transport" && !p.deployed
              ? "L’ALIZÉ TRAVERSE L’ÎLE"
              : p.falling
                ? "CHUTE LIBRE"
                : p.gliding
                  ? "PLANEUR DÉPLOYÉ"
                  : p.swimming
                    ? "NAGE LIBRE"
                  : p.flying
                    ? "VOL CRÉATIF"
                    : p.downed
                      ? "À TERRE"
                      : w.mode === "creative"
                        ? "TON ÎLE. TES RÈGLES."
                        : w.mode === "training"
                          ? "LE TERRAIN EST À TOI"
                          : "",
        detail =
          w.phase === "waiting"
            ? "PRÊT"
            : w.phase === "transport" && !p.deployed
              ? `${keyLabel(this.keybinds.jump)} · SAUTER`
              : p.falling
                ? `${keyLabel(this.keybinds.jump)} · PLANEUR`
                : p.flying
                  ? "CTRL ↓ · ESPACE ↑"
                  : "";
      const vehicle = p.vehicleId && w.vehicles.find(v=>v.id===p.vehicleId);
      document.body.classList.toggle("driving",!!vehicle);
      if(vehicle) { title=S.vehicleSpecs[vehicle.type]?.name || "AU VOLANT"; detail=`${keyLabel(this.keybinds.interact)} · SORTIR`; }
      const buildStatus=$("build-status");
      if(buildStatus) {
        buildStatus.hidden=!this.buildType || !!this.modal || !!vehicle;
        if(!buildStatus.hidden) {
          const check=w.canBuild(p,this.buildType,this.material,this.buildRotation||0,this.buildLevel||0);
          const reasons={duplicate:"DÉJÀ PLACÉE",blocked:"BLOQUÉ",materials:"MATÉRIAUX INSUFFISANTS",airborne:"POSE-TOI",'outside-island':"HORS ZONE",height:"ÉTAGE INACCESSIBLE"};
          const snap=check.placement?.snap ? ({edge:"BORD",module:"MODULE",level:"ÉTAGE",'ramp-chain':"RAMPE"}[check.placement.snap]||"ANCRÉ") : (this.buildLevel ? (this.buildLevel>0?"ÉTAGE +":"ÉTAGE −") : "AUTO");
          buildStatus.textContent=check.ok ? `✓ 10 ${MAT[this.material].toUpperCase()} · ${snap}` : reasons[check.reason]||"IMPOSSIBLE";
          buildStatus.classList.toggle("invalid",!check.ok);
        }
      }
      const scoped = !!(p.aim && this.aim && !this.harvest && !this.buildType && it?.weapon === "sniper");
      if ($("scope")) $("scope").hidden = !scoped;
      $("crosshair").classList.toggle("scoped", scoped);
      $("crosshair").classList.toggle("aiming", !!p.aim);
      document.querySelectorAll('[data-act="aim"]').forEach(b => b.setAttribute("aria-pressed", String(this.aim)));
      const flight=$('flight-speed');
      if(flight){flight.hidden=!(p.falling||p.gliding);if(!flight.hidden){const last=this.flightSample;const now=this.frameTime;if(!last||now>last.t+.2){this.flightKmh=last&&now>last.t?Math.round(Math.hypot(p.x-last.x,p.y-last.y,p.z-last.z)/(now-last.t)*3.6):0;this.flightSample={t:now,x:p.x,y:p.y,z:p.z};}flight.innerHTML=`<b>${this.flightKmh||0}</b><span>km/h · ${p.gliding?'PLANEUR':'CHUTE'}</span>`;}else this.flightSample=null;}
      for(const act of ['sprint','crouch','tool','build-mode']){const active=act==='sprint'?this.touchSprint:act==='crouch'?this.crouching:act==='tool'?this.harvest:!!this.buildType;document.querySelectorAll(`.touch-btn[data-act="${act}"]`).forEach(b=>{b.setAttribute('aria-pressed',String(!!active));if(act==='sprint')b.querySelector('span').textContent=p.falling||p.gliding?'RAPIDE':'SPRINT';});}
      const jumpButton=document.querySelector('.touch-btn[data-act="jump"] span');if(jumpButton)jumpButton.textContent=w.phase==='transport'&&!p.deployed?'SAUTER':p.falling?'PLANEUR':p.gliding?'REPLIER':p.swimming?'IMPULSION':'SAUT';
      document.body.classList.toggle('swimming',!!p.swimming);
      $("phase-title").textContent = title;
      $("phase-detail").textContent = detail;
      $("phase-title").parentElement.hidden = !title;
      const r = S.regions.reduce((a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b,
      );
      $("region-name").textContent = w.phase === "waiting" ? "PRÉPARATION" : r.name;
      $("storm-timer").textContent = free ? "∞" : clock(w.storm.timer);
      const outside =
        w.phase === "active" && !free && Math.hypot(p.x - w.storm.x, p.z - w.storm.z) > w.storm.radius;
      $("storm-warning").textContent = outside ? "DANS LA TEMPÊTE — REJOINS LE CERCLE !" : "";
      document.body.classList.toggle("in-storm", outside);
      $("ammo").innerHTML = vehicle ? `<b>${Math.round(Math.abs(vehicle.speed)*3.6)}</b><span> km/h</span><small>CARBURANT ${Math.ceil(vehicle.fuel)} % · ÉTAT ${Math.ceil(vehicle.hp/vehicle.maxHp*100)} %</small>` : this.buildType
        ? `<strong>${BTYPE[this.buildType]}</strong><small>CLIC / TIR POUR PLACER</small>`
        : this.harvest
          ? "<strong>PIOCHE</strong><small>RÉCOLTER DES MATÉRIAUX</small>"
          : p.fishing
            ? `<strong>CANNE À PÊCHE</strong><small>${p.fishing > 0 ? Math.ceil(p.fishing) + " s • ligne tendue" : "TIR pour lancer"}</small>`
            : p.reload > 0
              ? `<strong>RECHARGEMENT</strong><small>${p.reload.toFixed(1)} s</small>`
              : p.useTime > 0
                ? `<strong>SOIN EN COURS</strong><small>${p.useTime.toFixed(1)} s • reste immobile</small>`
                : it?.kind === "weapon"
                  ? `<b>${it.ammo}</b><span> / ${w.mode === "creative" ? "∞" : it.reserve}</span><small>${S.weapons[it.weapon].name}</small>`
                  : it
                    ? `<strong>${it.kind === "heal" ? "TROUSSE" : "BOUCLIER"}</strong><small>CLIC / TIR POUR UTILISER</small>`
                    : "";
      const consuming = p.useTime > 0;
      const selectedUse = !this.harvest && !this.buildType && ["heal", "shield"].includes(it?.kind);
      const usePanel = $("use-progress");
      if (usePanel) {
        usePanel.hidden = !consuming;
        if (consuming) {
          $("use-label").textContent = (it?.kind === "shield" ? "BOUCLIER" : "SOIN") + " · " + p.useTime.toFixed(1) + " s";
          $("use-meter").value = clamp(1 - p.useTime / (it?.kind === "shield" ? 2.2 : 2.7), 0, 1);
        }
      }
      document.body.classList.toggle("using-item", !!selectedUse);
      const fireButton = $("touch-fire");
      if (fireButton) {
        const label = this.buildType ? "POSER" : this.harvest ? "RÉCOLTER" : selectedUse ? (it.kind === "shield" ? "BOUCLIER" : "UTILISER") : "TIR";
        fireButton.querySelector("span").textContent = label;
        fireButton.setAttribute("aria-label", consuming ? "Utilisation en cours" : label + " — action principale");
      }
      $("materials").innerHTML = ["wood", "stone", "metal"]
        .map((m, i) => `<span><i>${["▥", "◆", "▰"][i]}</i>${w.mode === "creative" ? "∞" : p.mats[m]}</span>`)
        .join("");
      const html =
        `<button class="slot tool-slot ${this.harvest ? "active" : ""}" data-act="tool" title="Pioche — 0"><span class="slot-key">0</span>${I.cosmetic(M.catalog.find((x) => x.id === this.profile.equipment.tool) || { type: "tool" })}</button>` +
        Array.from({ length: 5 }, (_, i) => {
          const a = p.inventory[i];
          return `<button class="slot r${a?.rarity || 0} ${i === p.selected && !this.harvest && !this.buildType ? "active" : ""}" data-act="slot" data-id="${i}" title="${esc(a?.kind === "weapon" ? S.weapons[a.weapon].name : a?.kind === "heal" ? "Soin — toucher pour utiliser" : a?.kind === "shield" ? "Bouclier — toucher pour utiliser" : "Emplacement vide")}"><span class="slot-key">${i + 1}</span><span class="slot-icon">${I.inventory(a)}</span><span class="slot-count">${a?.kind === "weapon" ? a.ammo : a?.count || ""}</span></button>`;
        }).join("");
      if (this.lastSlots !== html) {
        $("slots").innerHTML = html;
        this.lastSlots = html;
      }
      // v21 wiring : innerHTML uniquement quand le contenu change (même logique
      // que le socle game.js — partage le cache _lastTeamHTML).
      const teamHTML = w.players
        .filter((q) => q.team === p.team && q.id !== p.id)
        .map(
          (q) =>
            `<div class="team-member"><span>◆ ${esc(q.name)}</span><small>${q.alive ? (q.downed ? "À TERRE" : Math.round(Math.hypot(q.x - p.x, q.z - p.z)) + " m") : "ÉLIMINÉ"}</small><div class="health-track"><div style="width:${Math.max(0, q.hp)}%"></div></div></div>`,
        )
        .join("");
      if (this._lastTeamHTML !== teamHTML) { $("team-list").innerHTML = teamHTML; this._lastTeamHTML = teamHTML; }
      $("feed").innerHTML = this.events
        .filter((e) => this.frameTime - e.time < 7)
        .map((e) => `<div>${esc(e.text)}</div>`)
        .join("");
      const prompt = this.nearPrompt(p);
      $("interaction").hidden = !prompt;
      $("interaction").textContent = prompt;
      this.drawMap($("minimap"), false);
    }
    nearPrompt(p) {
      if (p.fishing) return "TIR / RT-R2 · ANNULER LA PÊCHE";
      const base = super.nearPrompt(p);
      if (base) return base;
      const b = this.nearBuild(false);
      if (b) return `${keyLabel(this.keybinds.edit)} · MODIFIER ${BTYPE[b.type].toUpperCase()}`;
      if (S.coastDistance(p.x, p.z) > S.MAP.shoreStart + 20 && !p.swimming) return "TIR / RT-R2 · Lancer la canne";
      return "";
    }
    nearBuild(wallOnly = false) {
      const p = this.player(),
        all =
          this.world?.builds.filter(
            (b) =>
              b.owner === p.id &&
              !b.dead &&
              (!wallOnly || b.type === "wall") &&
              Math.hypot(b.x - p.x, b.z - p.z) < 8 &&
              Math.abs(b.y - p.y) < 6,
          ) || [];
      const yaw=this.yaw||0, pitch=this.pitch||0;
      const f = {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
      const score = b => {
        const dx=b.x-p.x, dy=b.y+(b.type === "wall" ? 1.5 : b.type === "ramp" ? 2 : 0)-p.y-1.4, dz=b.z-p.z;
        const along=dx*f.x+dy*f.y+dz*f.z;
        return Math.hypot(dx-f.x*along,dy-f.y*along,dz-f.z*along)*3 + Math.max(0,along)*.15 + (along < -1 ? 30 : 0);
      };
      all.sort((a,b) => score(a)-score(b));
      return all[0];
    }
    openEdit() {
      if (this.screen !== "game" || this.modal) return;
      const b = this.nearBuild(false);
      if (!b) {
        this.toast("Vise une de tes constructions pour la modifier.");
        return;
      }
      this.editTarget = b.id;
      this.editMask = b.editMask ?? (b.edited ? 367 : 511);
      this.editing = true;
      this.fire = false;
      this.buildType = null;
      this.keys = {};
      this.keyCodes = {};
      this.move = { x: 0, z: 0 };
      this.send({ fire: false, moveX: 0, moveZ: 0, moveY: 0 });
      document.body.classList.add("world-editing");
      if (document.pointerLockElement) document.exitPointerLock();
      const panel = $("world-edit");
      if (!panel) return;
      panel.hidden = false;
      panel.innerHTML = `<div class="world-edit-head"><b>${BTYPE[b.type].toUpperCase()}</b><span id="edit-cell-count">9 / 9</span><span>${Math.ceil(b.hp)}♥</span></div><div id="edit-grid" class="world-edit-grid">${Array.from({ length: 9 }, (_, i) => `<button data-act="edit-cell" data-id="${i}" aria-label="Case ${Math.floor(i / 3) + 1}, ${(i % 3) + 1}" aria-pressed="true"></button>`).join("")}</div><div class="world-edit-actions">${button("edit-preset", "RÉTABLIR", "511", "btn-ghost")}${button("edit-confirm", "VALIDER", "", "btn-primary")}${button("edit-cancel", "×", "", "btn-ghost")}</div><div class="world-edit-tip">TOUCHE LES CASES · ${keyLabel(this.keybinds.edit)} POUR VALIDER</div>`;
      this.paintEdit();
    }
    closeWorldEdit(applied = false) {
      if (!this.editing) return;
      this.editing = false;
      this.editTarget = null;
      document.body.classList.remove("world-editing");
      const panel = $("world-edit");
      if (panel) { panel.hidden = true; panel.innerHTML = ""; }
      if (applied) this.toast("Construction modifiée.");
      if (!this.mobile && this.screen === "game") try { this.canvas?.requestPointerLock?.(); } catch (_) {}
    }
    paintEdit() {
      let solidCount=0;
      document.querySelectorAll('[data-act="edit-cell"]').forEach((b) => {
        const solid = !!(this.editMask & (1 << Number(b.dataset.id))); if(solid)solidCount++;
        b.classList.toggle("solid", solid);
        b.setAttribute("aria-pressed", String(solid));
        b.innerHTML = solid ? "<span>▧</span>" : "<span>+</span>";
      });
      const count=$("edit-cell-count");if(count)count.textContent=solidCount+" / 9 MODULES";
    }
    openCreative() {
      if (this.screen !== "game" || this.mode !== "creative") {
        this.toast("Sélectionne le mode Créatif depuis le lobby.");
        return;
      }
      this.modal = "creative";
      this.paused = true;
      this.fire = false;
      this.keys = {};
      this.move = { x: 0, z: 0 };
      this.send({ fire: false, moveX: 0, moveZ: 0, moveY: 0 });
      if (document.pointerLockElement) document.exitPointerLock();
      const count = this.world.players.filter((p) => p.bot).length;
      this.overlay.innerHTML = `<div class="modal-shade"><section class="dialog creative-dialog"><div class="dialog-head"><div><span class="eyebrow">TON MONDE, SANS LIMITES</span><h2>L’atelier créatif</h2></div>${button("resume", "FERMER ×", "", "btn-ghost")}</div><div class="creative-grid"><section><h3>ARSENAL ILLIMITÉ</h3><div class="arsenal-grid">${Object.keys(
        S.weapons,
      )
        .map((k) =>
          button(
            "creative-give",
            `${I.gun(k)}<span>${S.weapons[k].name}</span>`,
            k,
            "btn-ghost arsenal-item",
          ),
        )
        .join(
          "",
        )}${button("creative-give", "✚ TROUSSE", "heal", "btn-ghost")}${button("creative-give", "⬡ BOUCLIER", "shield", "btn-ghost")}</div><p class="muted">L’objet remplace le créneau sélectionné. Rareté légendaire.</p><h3>CONSTRUIRE LIBREMENT</h3><p class="muted">B : construire • Pg↑ / Pg↓ : étage • C : rotation • F : éditer • K : garage</p><div class="dialog-actions">${button("fly", this.player().flying ? "DÉSACTIVER LE VOL" : "ACTIVER LE VOL")}${button("garage", "GARAGE · VOITURES")}${button("resume", "RETOURNER CRÉER", "", "btn-primary")}</div></section><section><h3>RÈGLES DE L’ÎLE</h3><div class="form-row"><label for="creative-bots">Bots actifs</label><select id="creative-bots" class="select">${[0, 10, 25, 50, 100].map((n) => `<option value="${n}" ${n === count ? "selected" : ""}>${n} bots</option>`).join("")}</select>${button("creative-bots", "APPLIQUER")}</div><div class="form-row"><select class="select" id="creative-poi" aria-label="Lieu de téléportation">${S.regions.map((r, i) => `<option value="${i}">${r.name}</option>`).join("")}</select>${button("creative-teleport", "Y ALLER")}</div><div class="day-buttons">${["day", "sunset", "night"].map((k, i) => button("creative-day", ["SOLEIL", "DORÉ", "NUIT"][i], k, this.timeOfDay === k ? "btn-primary" : "btn-ghost")).join("")}</div><h3>MES CONSTRUCTIONS</h3><p class="muted">${this.world.builds.filter((b) => b.owner === this.myId && !b.dead).length} pièces • sauvegarde automatique pendant le jeu</p><div class="dialog-actions">${button("creative-save", "SAUVEGARDER", "", "btn-primary")}${button("creative-export", "EXPORTER LE PLAN")}${button("creative-import", "IMPORTER UN PLAN")}${button("creative-clear", "EFFACER MES PIÈCES", "", "btn-ghost")}</div><p class="muted">Un import ajoute les pièces à l’île actuelle. Exporte avant d’effacer.</p></section></div></section></div>`;
    }
    blueprintData() {
      return {
        ...this.world.exportBuilds(this.myId),
        spawn: { x: this.player().x, z: this.player().z },
        timeOfDay: this.timeOfDay,
      };
    }
    parseBlueprint(raw) {
      if (typeof raw === "string") return JSON.parse(raw);
      if (Array.isArray(raw)) {
        const t = raw.find((v) => v.type === "text");
        return t ? JSON.parse(t.text) : null;
      }
      if (typeof raw?.content === "string") return JSON.parse(raw.content);
      return raw;
    }
    async saveBlueprint(quiet = false) {
      if (this.mode !== "creative") return;
      const data = JSON.stringify(this.blueprintData());
      try {
        if (typeof root.tasklet?.invokeTool === "function")
          await tasklet.invokeTool({
            toolName: "write_file",
            args: { op: "write", path: BLUEPRINT, content: data },
          });
        else localStorage.setItem("azur-creative-v2", data);
        this.dirtyScene = false;
        if (!quiet) this.toast("Ton île a été sauvegardée.");
      } catch (e) {
        if (!quiet || !this.blueprintWarned)
          this.toast("Sauvegarde indisponible : exporte le plan pour conserver ton île.", true);
        this.blueprintWarned = true;
      }
    }
    downloadJSON(data, name) {
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    async leaveToLobby() {
      if (this.editing) this.closeWorldEdit(false);
      if (this.mode === "creative" && this.screen === "game") await this.saveBlueprint(true);
      this.lastSlots = null;
      document.body.classList.remove("building", "in-storm");
      return super.leaveToLobby();
    }
    togglePause() {
      if (this.modal) {
        this.closeModal();
        return;
      }
      this.modal = "pause";
      this.paused = !this.socket;
      this.fire = false;
      this.aim = false;
      this.keys = {};
      this.move = { x: 0, z: 0 };
      this.send({ fire: false, moveX: 0, moveZ: 0, moveY: 0 });
      if (document.pointerLockElement) document.exitPointerLock();
      this.overlay.innerHTML = `<div class="modal-shade"><section class="dialog pause-dialog"><span class="eyebrow">ON SOUFFLE UN INSTANT</span><h2>Une petite pause.</h2><p>${this.socket ? "La partie réseau continue." : "Ta partie locale est en pause."}</p><div class="pause-actions">${button("resume", "REPRENDRE ↗", "", "btn-primary")}${button("map", "VOIR LA CARTE")}${button("inventory", "INVENTAIRE")}${this.mode === "creative" ? button("creative", "ATELIER CRÉATIF") : ""}${button("garage", "GARAGE · FABRIQUER UNE VOITURE")}${button("help-game", "LES COMMANDES")}${button("surrender", ["creative", "training"].includes(this.mode) ? "RETOUR AU LOBBY" : "ABANDONNER LA PARTIE", "", "btn-ghost")}</div><span class="muted">AZUR HORIZONS • V1.7.0 • ${MODES[this.mode]?.name || "Partie"}</span></section></div>`;
    }
    openHelp() {
      if (this.screen !== "game") return;
      this.modal = "help";
      this.paused = !this.socket;
      this.fire = false;
      this.keys = {};
      this.move = { x: 0, z: 0 };
      this.send({ fire: false, moveX: 0, moveZ: 0, moveY: 0 });
      if (document.pointerLockElement) document.exitPointerLock();
      this.overlay.innerHTML = `<div class="modal-shade"><section class="dialog help-dialog"><div class="dialog-head">${button("resume", "RETOURNER AU JEU ×", "", "btn-primary")}</div>${this.helpHTML()}</section></div>`;
    }
    closeModal() {
      this.lift = 0;
      this.touchSprint=false;
      this.keyCodes = {};
      this.move = { x: 0, z: 0 };
      return super.closeModal();
    }
    onEvent(e) {
      super.onEvent(e);
      if (e.playerId === this.myId && e.type === "craftVehicle") { this.toast("Voiture fabriquée ! Approche-toi puis E / INTERAGIR pour conduire."); this.audio.ui(); }
      if (e.playerId === this.myId && e.type === "loot" && this.player()?.inventory[this.player().selected]?.kind === "weapon") this.harvest = false;
      // v21 wiring : feedbacks visuels des actions — ramassage (la barre
      // d'inventaire pulse ; le son est déjà joué par audio.event), soin
      // (le bloc vie/bouclier respire), construction (la barre de build pulse).
      // element.animate : pas de CSS supplémentaire, rien d'encombrant.
      if (e.playerId === this.myId && e.type === "loot") {
        const slots = $("slots");
        slots?.getAnimations?.().forEach((a) => a.cancel());
        slots?.animate?.([{ filter: "brightness(1.9)" }, { filter: "brightness(1)" }], { duration: 380, easing: "ease-out" });
      }
      if (e.playerId === this.myId && e.type === "heal") {
        const hb = document.querySelector(".health-block");
        hb?.getAnimations?.().forEach((a) => a.cancel());
        hb?.animate?.([{ transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
      }
      if (["build", "edit", "demolish"].includes(e.type) && e.playerId === this.myId) {
        this.dirtyScene = true;
        const bb = $("build-bar");
        bb?.getAnimations?.().forEach((a) => a.cancel());
        bb?.animate?.([{ opacity: ".35" }, { opacity: "1" }], { duration: 220, easing: "ease-out" });
      }
      if (e.playerId === this.myId && (e.type === "harvest" || e.type === "melee")) { const a = this.view.actors.get(this.myId); if (a) a.userData.harvest = 1; }
      if (e.playerId === this.myId && e.type === "hit" && e.targetId) {
        const d=$('damage-confirm'), now=performance.now();
        if(d){
          const old=this.damageCombo, same=old&&old.target===e.targetId&&now-old.time<1100;
          const total=(same?old.total:0)+Math.max(0,Number(e.amount)||0);
          this.damageCombo={target:e.targetId,total,time:now};
          const shield=e.shieldDamage>0&&!(e.hpDamage>0), target=this.world.players.find(q=>q.id===e.targetId);
          const broke=e.shieldDamage>0&&target?.shield<=0;
          d.innerHTML=`<span class="v7-hit-kind">${e.headshot?'TIR À LA TÊTE':broke?'BOUCLIER BRISÉ':shield?'BOUCLIER':'TOUCHÉ'}</span><strong>${Math.round(e.amount||0)}</strong><small>${same?`${Math.round(total)} DÉGÂTS CUMULÉS`:'DÉGÂTS INFLIGÉS'}</small>`;
          d.className='damage-confirm v7-damage show'+(e.headshot?' headshot':shield?' shield':'')+(broke?' shield-break':'');
          d.getAnimations?.().forEach(a=>a.cancel());d.animate?.([{transform:'translateY(6px) scale(.82)'},{transform:'translateY(-2px) scale(1.1)',offset:.4},{transform:'translateY(0) scale(1)'}],{duration:230,easing:'ease-out'});
          clearTimeout(this.damageTimer);this.damageTimer=setTimeout(()=>d.classList.remove('show'),1250);
        }
      }
      if(e.type==='elimination'&&e.playerId===this.myId&&e.targetId!==this.myId){
        const banner=$('elimination-confirm'), target=this.world.players.find(q=>q.id===e.targetId);
        if(banner){banner.innerHTML=`<span class="v7-elim-icon">✦</span><div><small>ÉLIMINATION CONFIRMÉE</small><strong>${esc(target?.name||'Adversaire')}</strong></div><b>${this.player()?.kills||0}<small>ÉLIM.</small></b>`;banner.classList.add('show');banner.getAnimations?.().forEach(a=>a.cancel());banner.animate?.([{opacity:0,transform:'translate(-50%,16px) scale(.9)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});clearTimeout(this.eliminationTimer);this.eliminationTimer=setTimeout(()=>banner.classList.remove('show'),2400);}
      }
    }
    loop(t) {
      document.body.dataset.screen = this.screen;
      super.loop(t);
      if (
        this.screen === "game" &&
        this.mode === "creative" &&
        this.dirtyScene &&
        this.frameTime - (this.lastAutoSave || 0) > 15
      ) {
        this.lastAutoSave = this.frameTime;
        this.saveBlueprint(true);
      }
    }
  }
  /* v0.6 integration: the simulation and renderer remain authoritative; this layer
     only coordinates local UI, durable profile state, and the supplied contracts. */
  const v050Action = Horizons.prototype.action;
  const v050Boot = Horizons.prototype.boot;
  const v050RenderMenu = Horizons.prototype.renderMenu;
  const v050StartGameUI = Horizons.prototype.startGameUI;
  const v050StartMatch = Horizons.prototype.startMatch;
  const v050UpdateHUD = Horizons.prototype.updateHUD;
  const v050NearPrompt = Horizons.prototype.nearPrompt;
  const v050OnEvent = Horizons.prototype.onEvent;
  const v050Loop = Horizons.prototype.loop;
  const v050Bind = Horizons.prototype.bind;
  const v050LoadProfile = Horizons.prototype.loadProfile;
  const SAVE_V1 = "/tasklet/drive/azur/saves/azur-profile.json";
  const BR_MODES = ["solo", "duo", "squad"];
  const LOADING_ART = {
    "loading-abysses":"./assets/loading-lagune-azur.svg",
    "loading-vigie":"./assets/loading-observatoire.svg",
    "loading-horizon":"./assets/loading-iles-corail.svg",
    "loading-etoile":"./assets/loading-observatoire.svg"
  };
  const loadingTips = [
    "L’île d’attente sert à essayer les armes : le transport remet l’inventaire à zéro.",
    "Une réanimation demande trois secondes à moins de trois mètres. Restez à couvert.",
    "Les Écus et le passe sont locaux : aucun achat réel n’est proposé.",
    "La tempête finale se referme vraiment : gardez toujours un itinéraire vers le cercle."
  ];
  Horizons.prototype.boot = async function () {
    await v050Boot.call(this);
    if (this.view && !this.view._azurV060MenuTeam) {
      const update = this.view.update.bind(this.view);
      this.view._azurV060MenuTeam = true;
      this.view.update = (world, player, dt, opts) => update(world, player, dt, {...(opts || {}), menuTeam:this.tab === "play" ? (this.menuRoster?.() || []) : []});
    }
  };
  Horizons.prototype.loadProfile = async function () {
    await v050LoadProfile.call(this);
    this.profile = M.normalize(this.profile);
    this.mode = MODES[this.profile.preferredMode] ? this.profile.preferredMode : "solo";
    this.profile.preferredMode = this.mode;
    this.questFilter = "all";
    this.shopFilter = "featured";
    this.lobbyReady = false;
    this.prepEndsAt = 0;
    this.matchWeaponUses = 0;
    this.lastCheckpointAt = 0;
  };
  Horizons.prototype.queueSave = function () {
    if (this.storageBlocked) return Promise.resolve();
    const data = JSON.stringify(M.normalize(this.profile));
    this.saveStatus = "Sauvegarde…";
    this.updateSaveLabel?.();
    this.saveQueue = (this.saveQueue || Promise.resolve()).catch(() => {}).then(async () => {
      try {
        if (typeof root.tasklet?.invokeTool === "function") {
          await tasklet.invokeTool({toolName:"write_file",args:{op:"write",path:SAVE_V1 + ".backup",content:data}});
          await tasklet.invokeTool({toolName:"write_file",args:{op:"write",path:SAVE_V1,content:data}});
          this.saveStatus = "Sauvegardé · Tasklet";
        } else {
          /* The backup is written first, so an interrupted primary write leaves a usable copy. */
          localStorage.setItem("azur-profile-v1-backup", data);
          localStorage.setItem("azur-profile-v1", data);
          this.saveStatus = "Sauvegardé sur cet appareil";
        }
        this.updateSaveLabel?.();
      } catch (e) {
        this.saveStatus = "Échec de sauvegarde";
        this.updateSaveLabel?.();
        this.toast("Sauvegarde impossible. Exportez votre profil depuis Options.", true);
      }
    });
    return this.saveQueue;
  };
  Horizons.prototype.menuRoster = function () {
    const n = this.mode === "duo" ? 1 : this.mode === "squad" ? 3 : 0;
    return Array.from({length:n}, (_, i) => ({
      id:"bot-" + (i + 1), name:["Aster", "Nacre", "Silex"][i],
      equipment:{character:["char-azur", "char-nacre", "char-silex"][i], back:["back-voile", "back-orbe", "back-balise"][i], tool:["tool-marteau", "tool-lame", "tool-piolet"][i], glider:["glider-raie", "glider-constellation", "glider-voilure"][i]},
      ready:true, bot:true, level:1
    }));
  };
  Horizons.prototype.transferMenuRoster = function () {
    if (!this.world || !BR_MODES.includes(this.mode)) return;
    const roster = this.menuRoster?.() || [];
    const allies = this.world.players.filter(q => q.team === this.player()?.team && q.bot).slice(0, roster.length);
    allies.forEach((bot, i) => {
      const m = roster[i]; if (!m) return;
      bot.id = m.id; bot.name = m.name; bot.equipment = {...m.equipment}; bot.bot = true;
    });
  };
  Horizons.prototype.renderMenu = function () {
    this.screen = "menu"; this.paused = false; this.touchSprint=false;
    this.overlay.innerHTML = ""; this.modal = null;
    document.body.dataset.screen = "menu"; document.body.dataset.tab = this.tab;
    const p=this.profile, xp=M.xpProgress(p), unread=(p.notifications||[]).filter(n=>!n.read).length;
    const tabs=[["play","JOUER"],["locker","CASIER"],["shop","BOUTIQUE"],["pass","PASSE"],["quests","QUÊTES"],["career","CARRIÈRE"],["group","GROUPE"],["settings","PARAMÈTRES"]];
    const active = id => this.tab===id ? "active" : "";
    const panel = this.tab !== "play";
    this.ui.innerHTML = `<header class="topbar v6-topbar"><button class="btn btn-ghost wordmark" data-act="tab" data-id="play" aria-label="Accueil AZUR"><span class="brand-spark">✦</span>AZUR<span class="wordmark-edition">HORIZONS · EXPÉDITION 1.4</span></button><nav class="navlinks" aria-label="Navigation principale">${tabs.map(([id,label])=>`<button class="btn btn-ghost ${active(id)}" data-act="tab" data-id="${id}">${label}</button>`).join("")}</nav><div class="account-bar"><span class="currency" title="Monnaie locale fictive">◈ ${p.coins.toLocaleString("fr-FR")}</span><span class="xp-chip">NIV. ${xp.level}<i style="width:${Math.round(xp.percent*100)}%"></i></span><button class="btn btn-ghost notify-button ${unread?"has-unread":""}" data-act="notifications" aria-label="Notifications">◌<b>${unread||""}</b></button><button class="btn btn-ghost profile-btn" data-act="tab" data-id="profile"><span class="level-badge">${xp.level}</span><span>${esc(p.name)}</span></button></div></header>${panel?`<div class="page-preview-label v6-preview-label"><span class="eyebrow">ÉQUIPEMENT D’EXPÉDITION</span><h3>${esc(M.catalog.find(i=>i.id===(this.selectedCosmetic||p.equipment.character))?.name||"Explorateur")}</h3><p>Faites glisser le décor pour observer votre équipement.</p></div><section class="scroll-panel v6-panel">${this.tab==="group" && this.social ? this.social.render() : this.tab==="settings" ? this.settingsHTML() : this.tab==="help" ? this.helpHTML() : AZPanels.render(this.tab,this)}</section>`:this.lobbyHTML()}<footer class="bottom-bar v6-footer"><span class="save-state"><span class="status-dot"></span><span data-save>${esc(this.saveStatus)}</span></span><span class="desktop-footer">NAVIGATEUR · PC / MOBILE / MANETTE STANDARD · 100 PARTICIPANTS</span><div class="footer-links">${button("tab","GROUPE","group","btn-ghost btn-sm")}${button("tab","? COMMANDES","help","btn-ghost btn-sm")}</div></footer>`;
    this.updatePreview(); this.queuePanelThumbnails();
    for (const e of document.querySelectorAll("[data-setting]")) { const v=p.settings[e.dataset.setting]; if(e.type==="checkbox")e.checked=!!v; else if(v!==undefined)e.value=String(v); }
  };
  Horizons.prototype.queuePanelThumbnails = function () {
    if (!this.view?.queueThumbnails) return;
    const cards=[...document.querySelectorAll(".exp-cosmetic[data-item]")];
    /* Panels remain backwards compatible; canvas thumbnails are an enhancement layered onto card art. */
    document.querySelectorAll(".exp-cosmetic").forEach(card=>{
      const id=card.querySelector("[data-act=preview]")?.dataset.id, item=M.catalog.find(x=>x.id===id);
      const art=card.querySelector(".exp-card-art"); if(!item||!art||art.querySelector("canvas")) return;
      if(item.type==='loading'){const img=document.createElement('img');img.src=LOADING_ART[item.id]||LOADING_ART['loading-horizon'];img.className='v6-loading-thumb';img.alt=item.name;art.prepend(img);return;}
      if(!['character','variant','back','tool','glider','emote','headwear','wrap'].includes(item.type)) return;
      const canvas=document.createElement("canvas"); canvas.width=320; canvas.height=430; canvas.className="v6-item-thumb"; canvas.dataset.previewType=item.type; art.prepend(canvas);
      canvas._azEquipment={...this.profile.equipment,[item.type]:item.id};
    });
    const queue=[...document.querySelectorAll("canvas.v6-item-thumb")].map(canvas=>({canvas,type:canvas.dataset.previewType,equipment:canvas._azEquipment}));
    if(queue.length) this.view.thumbnailQueue=queue;
    this.view.queueThumbnails(this.profile.equipment);
    if(queue.length) this.view.thumbnailQueue=queue;
  };
  Horizons.prototype.lobbyHTML = function () {
    const m=MODES[this.mode]||MODES.solo, roster=this.menuRoster?.()||[], xp=M.xpProgress(this.profile);
    const ready=this.lobbyReady, online=!!this.social?.connected&&!!this.social.party&&BR_MODES.includes(this.mode);
    const seconds=ready?Math.max(0,Math.ceil((this.prepEndsAt-Date.now())/1000)):0;
    const population=online?`${this.social.party.members.length} joueur(s) LAN · complément IA`:BR_MODES.includes(this.mode)?'100 participants · joueurs locaux + IA':m.tag;
    return `<section class="v6-lobby-copy menu-left v7-lobby-copy"><span class="season-badge"><span></span> HORIZONS 1.4 · PC / MOBILE / MANETTE</span><h1>CONSTRUIS.<br><span>TON HORIZON.</span></h1><p>${S.regions.length} villes · Nage libre · Construction structurelle · Planeur Alizé Mk II.</p><div class="v6-xp"><span>NIVEAU ${xp.level}</span><b>${xp.current} / ${xp.needed||1000} XP</b><i><em style="width:${Math.round(xp.percent*100)}%"></em></i></div><div class="v6-quick-links">${button('tab','PASSE','pass','btn-ghost')}${button('tab','QUÊTES','quests','btn-ghost')}</div></section><div class="character-label v6-character-label v7-character-label"><span class="ready-tag">${ready?'PRÉPARATION':'TON EXPLORATEUR'}</span><strong>${esc(this.profile.name)}</strong><span>${esc(M.catalog.find(x=>x.id===this.profile.equipment.character)?.name||'Explorateur')} · NIV. ${xp.level}</span></div><aside class="lobby-card v6-lobby-card v7-lobby-card" aria-label="Départ en partie"><div class="v7-mode-summary"><div class="v7-mode-symbol">${I.icon(m.icon)}</div><div><span class="eyebrow">${this.social?.connected?'RÉSEAU PRIVÉ':'PARTIE LOCALE'}</span><h2>${m.name}</h2></div><button class="btn btn-ghost v7-change-mode" data-act="choose-mode" aria-haspopup="dialog" ${ready?'disabled':''}>CHANGER ${I.icon('chevron')}</button></div><p class="local-tag">${esc(population)}</p>${ready?`<div class="v6-ready-count"><b>${online?'EN ATTENTE DU GROUPE':`DÉPART DANS ${seconds}s`}</b></div>${button('cancel-ready','ANNULER','','btn-ghost play-btn')}`:button('play',BR_MODES.includes(this.mode)?'PRÊT →':'JOUER →','','btn-primary play-btn')}</aside>${roster.length?`<aside class="v6-roster v7-roster"><span class="eyebrow">ÉQUIPAGE · ${online?'LAN':'IA'}</span>${roster.map(r=>`<article><span>✦</span><b>${esc(r.name)}</b><em>${r.ready?'PRÊT':'EN ATTENTE'}</em></article>`).join('')}<button class="btn btn-ghost btn-sm" data-act="tab" data-id="group">GÉRER LE GROUPE →</button></aside>`:''}`;
  };
  Horizons.prototype.openModes = function () {
    if(this.screen!=='menu'||this.lobbyReady)return;
    this.modal='modes';
    this.overlay.innerHTML=`<div class="modal-shade v7-mode-shade"><section class="dialog v7-modes" role="dialog" aria-modal="true" aria-labelledby="v7-modes-title"><div class="dialog-head"><div><span class="eyebrow">À TOI DE CHOISIR</span><h2 id="v7-modes-title">Ton prochain départ</h2></div>${button('close-modes','✕','','btn-ghost')}</div><div class="v7-mode-options">${Object.entries(MODES).map(([k,v])=>`<button class="v7-mode-option ${k===this.mode?'selected-mode':''}" data-act="mode" data-id="${k}" aria-pressed="${k===this.mode}"><span>${I.icon(v.icon)}</span><strong>${v.name}</strong><small>${esc(v.text)}</small><em>${k==='event'?'SANS DÉGÂTS · ≈ 6 MIN · LIBRE DE TES MOUVEMENTS':BR_MODES.includes(k)?'100 PARTICIPANTS · IA + LOCAL':'EXPLORATION LIBRE'}</em></button>`).join('')}</div><p>Les modes restent ici : le salon laisse toute la place à ton personnage.</p></section></div>`;
    this.overlay.querySelector('[data-act=close-modes]').focus();
  };
  Horizons.prototype.beginLocalPreparation = function () {
    if (this.lobbyReady || this.screen !== "menu") return;
    this.tab="play"; this.lobbyReady=true; this.prepEndsAt=Date.now()+3000; this.audio.start(); this.audio.ui();
    clearInterval(this.prepTimer); this.renderMenu();
    this.prepTimer=setInterval(()=>{
      if(!this.lobbyReady){clearInterval(this.prepTimer);return;}
      const left=Math.ceil((this.prepEndsAt-Date.now())/1000);
      if(left<=0){clearInterval(this.prepTimer);this.lobbyReady=false;this.startMatch();}
      else this.renderMenu();
    },1000);
  };
  Horizons.prototype.cancelLocalPreparation = function () { clearInterval(this.prepTimer); this.lobbyReady=false; this.prepEndsAt=0; this.renderMenu(); this.toast("Préparation locale annulée."); };
  Horizons.prototype.showConfirm = function (kind,id) {
    const item=id&&M.catalog.find(x=>x.id===id), premium=kind==="premium";
    this.modal="confirm";
    this.overlay.innerHTML=`<div class="modal-shade"><section class="dialog v6-confirm"><span class="eyebrow">${premium?"PASSE D’EXPÉDITION":"BOUTIQUE LOCALE"}</span><h2>${premium?"Activer le passe premium ?":"Confirmer l’acquisition ?"}</h2><p>${premium?"800 Écus de corail seront débités de ce profil local.":`${esc(item?.name||"Cet article")} · ${item?.price||0} Écus de corail`}</p><p class="muted">Aucun paiement réel, aucun débit avant confirmation.</p><div class="dialog-actions">${button(premium?"confirm-premium":"confirm-purchase","CONFIRMER",id,"btn-primary")}${button("confirm-cancel","ANNULER","","btn-ghost")}</div></section></div>`;
  };
  Horizons.prototype.showReward = function (title,item,kind="Récompense ajoutée") {
    this.modal="reward";
    const isCoins=item?.kind==="coins";
    this.overlay.innerHTML=`<div class="modal-shade"><section class="dialog v6-reward v19-reward" role="dialog" aria-modal="true"><span class="eyebrow">${kind}</span><div class="v6-reward-orb v19-reward-orb">${esc(item?.icon||"◈")}<span class="v19-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span></div><h2>${isCoins?`<span class="v19-coin-count" data-count="${item.amount||0}">+0</span> Écus de corail`:esc(title)}</h2><p>${esc(item?.description||item?.name||"Votre profil a été mis à jour.")}</p><div class="dialog-actions">${item?.id&&item.type!=="pack"?button("reward-equip","ÉQUIPER",item.id,"btn-primary"):""}${button("confirm-cancel","CONTINUER","","btn-ghost")}</div></section></div>`;
    const c=this.overlay.querySelector("[data-count]");
    if(c){const target=Number(c.dataset.count)||0,t0=performance.now();
      const step=(t)=>{const k=Math.min(1,(t-t0)/900),e=1-Math.pow(1-k,3);
        c.textContent="+"+Math.round(target*e).toLocaleString("fr-FR");
        if(k<1)requestAnimationFrame(step);else c.textContent="+"+target.toLocaleString("fr-FR");};
      requestAnimationFrame(step);}
  };
  /* v19 — écran de fin de match : gains détaillés, compteurs animés, barre de niveau, confettis. */
  Horizons.prototype.buildResultsHTML = function (r,progress) {
    const levelUp=progress.levelAfter>progress.levelBefore;
    const quests=(progress.completed||[]).map((id)=>M.questsById(id)).filter(Boolean);
    const bd=(progress.breakdown||[]).filter((e)=>(e.xp||0)>0||(e.coins||0)>0);
    const xpTotal=progress.xp||0, coins=progress.coins||0;
    const bdRows=bd.map((e)=>`<div class="v19-bd-row"><span>${esc(e.label)}</span><b>${e.xp?`+${e.xp} XP`:""}${e.xp&&e.coins?" · ":""}${e.coins?`+${e.coins} ◈`:""}</b></div>`).join("");
    const questRows=quests.map((q)=>`<div class="v19-quest-row"><span>★ ${esc(q.name)}</span><b>+${q.xp} XP</b></div>`).join("");
    return `<div class="modal-shade v19-results-shade"><section class="dialog v6-results v19-results ${r.won?"is-victory":""}" role="dialog" aria-modal="true" aria-label="Résultat du match"><span class="eyebrow">${r.won?"LE DERNIER HORIZON EST À VOUS":"RÉSULTAT DE L’EXPÉDITION"}</span><h2 class="v19-results-title">${r.won?"VICTOIRE · TOP 1":"FIN DE PARCOURS"}</h2><div class="result-rank v19-rank">#${r.rank}</div><div class="v19-gains-total"><div class="v19-gain-xp"><small>XP GAGNÉE</small><b data-count="${xpTotal}">+0</b></div><div class="v19-gain-coins"><small>ÉCUS GAGNÉS</small><b data-count="${coins}">+0</b><i aria-hidden="true">◈</i></div></div>${bd.length?`<div class="v19-breakdown"><span class="eyebrow">D’OÙ VIENNENT TES GAINS</span>${bdRows}</div>`:""}<div class="v19-level-wrap"><div class="v19-level-head"><span>NIVEAU ${progress.levelBefore}</span>${levelUp?`<span class="v19-levelup-badge">NIVEAU ${progress.levelAfter} DÉBLOQUÉ !</span>`:`<span>NIVEAU ${progress.levelAfter}</span>`}</div><div class="v19-level-track" role="progressbar" aria-label="Progression du niveau"><i data-levelfill></i></div></div>${quests.length?`<div class="v19-quests"><span class="eyebrow">QUÊTES ACCOMPLIES</span>${questRows}</div>`:`<p class="muted">Carrière et quêtes mises à jour.</p>`}<div class="v19-match-stats"><div><b>${r.kills}</b><small>ÉLIMINATIONS</small></div><div><b>${Math.round(r.damage)}</b><small>DÉGÂTS</small></div><div><b>${clock(r.duration)}</b><small>SURVIE</small></div></div><span class="save-state" data-save>${esc(this.saveStatus)}</span><div class="dialog-actions">${button("replay","REJOUER","","btn-primary")}${button("lobby","RETOUR AU LOBBY","","btn-ghost")}${button("tab","CASIER","locker","btn-ghost")}${button("tab","PASSE","pass","btn-ghost")}</div></section></div>`;
  };
  Horizons.prototype.animateResults = function (r,progress) {
    const root=this.overlay.querySelector(".v19-results"); if(!root)return;
    root.querySelectorAll("[data-count]").forEach((el)=>{
      const target=Number(el.dataset.count)||0,t0=performance.now(),dur=1300;
      const step=(t)=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);
        el.textContent="+"+Math.round(target*e).toLocaleString("fr-FR");
        if(k<1)requestAnimationFrame(step);else{el.textContent="+"+target.toLocaleString("fr-FR");el.classList.add("is-done");}};
      requestAnimationFrame(step);});
    const fill=root.querySelector("[data-levelfill]");
    if(fill){const after=M.xpProgress(this.profile);
      fill.style.width="0%";
      requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.width=Math.round(after.percent*100)+"%";}));
      if(progress.levelAfter>progress.levelBefore)setTimeout(()=>root.classList.add("leveled"),750);}
    if(r.won)this.celebrate(root);
  };
  Horizons.prototype.celebrate = function (root) {
    const layer=document.createElement("div");layer.className="v19-confetti";layer.setAttribute("aria-hidden","true");
    const colors=["#ffd166","#ff9d5c","#38bdf8","#74c69d","#f5b7d2","#fff3bd"];
    for(let i=0;i<64;i++){const s=document.createElement("i");
      s.style.left=(Math.random()*100).toFixed(1)+"%";
      s.style.background=colors[i%colors.length];
      s.style.animationDelay=(Math.random()*0.9).toFixed(2)+"s";
      s.style.animationDuration=(1.6+Math.random()*1.6).toFixed(2)+"s";
      layer.append(s);}
    root.append(layer);setTimeout(()=>layer.remove(),4200);
  };
  Horizons.prototype.action = async function (act,id,el) {
    if(act==='emote') return this.openEmotes();
    if(act==='emote-play') return this.playEmote(id);
    if(act==='choose-mode') return this.openModes();
    if(act==='close-modes') { this.modal=null;this.overlay.innerHTML='';document.querySelector('[data-act=choose-mode]')?.focus();return; }
    if(act==='sprint') { this.touchSprint=!this.touchSprint;this.updateHUD();return; }
    if(act==='touch-more') { this.touchMore=!this.touchMore;const drawer=$('touch-utility');if(drawer)drawer.hidden=!this.touchMore;el?.setAttribute('aria-expanded',String(this.touchMore));return; }

    if (act==="play" && this.screen==="menu" && !this.social?.connected) return this.beginLocalPreparation();
    if (act==="cancel-ready") return this.cancelLocalPreparation();
    if (act==="mode" && MODES[id]) { this.mode=id; this.profile.preferredMode=id; this.lobbyReady=false; clearInterval(this.prepTimer); this.queueSave(); return this.renderMenu(); }
    if (act==="tab") { if(this.screen==='game') { if(id==='help')return this.openHelp(); return; } if(this.screen==='results'){await this.leaveToLobby();} if(this.lobbyReady) this.cancelLocalPreparation(); this.tab=id; this.selectedCosmetic=null; return this.renderMenu(); }
    if (act==="notifications") { this.tab="profile"; return this.renderMenu(); }
    if (act==="preview") { this.selectedCosmetic=id; this.updatePreview(); return this.renderMenu(); }
    if (act==="shop-filter"||act==="locker-filter") { this[act==="shop-filter"?"shopFilter":"lockerFilter"]=id; return this.renderMenu(); }
    if (act==="quest-filter") { this.questFilter=id; return this.renderMenu(); }
    if (act==="pass-page") { this.passPage=clamp(Number(id)||0,0,Math.ceil(M.rewards.length/10)-1); return this.renderMenu(); }
    if (act==="pass-prev"||act==="pass-next") { this.passPage=clamp((Number(this.passPage)||0)+(act==="pass-next"?1:-1),0,Math.ceil(M.rewards.length/10)-1); return this.renderMenu(); }
    if (act==="notifications-read") { M.markNotificationsRead(this.profile); this.queueSave(); return this.renderMenu(); }
    if (act==="shop") { this.tab="shop"; return this.renderMenu(); }
    if (act==="purchase") return this.showConfirm("purchase",id);
    if (act==="premium") return this.showConfirm("premium");
    if (act==="confirm-cancel") { this.pendingImport=null; this.modal=null; this.overlay.innerHTML=""; return this.renderMenu(); }
    if (act==="confirm-purchase") { const r=M.purchase(this.profile,id); if(!r.ok){this.toast(r.message,true);return;} this.audio.reward();M.notify(this.profile,{id:"shop-"+id,title:"Article acquis",message:r.item?.name||"Article ajouté",type:"shop"});this.queueSave();return this.showReward(r.item?.name||"Article acquis",r.item,"ACQUISITION CONFIRMÉE"); }
    if (act==="confirm-premium") { const r=M.buyPremium(this.profile); if(!r.ok){this.toast(r.message,true);return;}this.audio.reward();M.notify(this.profile,{id:"premium-pass",title:"Passe premium activé",message:"Les récompenses premium sont disponibles.",type:"pass"});this.queueSave();return this.showReward("Passe premium activé",null,"PASSE ACTIVÉ"); }
    if (act==="claim") { const r=M.claim(this.profile,+id,el?.dataset.premium==="true"); if(!r.ok){this.toast(r.message,true);return;} M.notify(this.profile,{id:"claim-"+id+"-"+(el?.dataset.premium||"free"),title:"Récompense réclamée",message:r.item?.name||"Écus de corail ajoutés",type:"pass"});this.queueSave();const reward=r.item?.itemId?M.catalog.find(x=>x.id===r.item.itemId):r.item;if(reward?.kind==="coins")this.audio.coins();else this.audio.reward();return this.showReward(reward?.kind==="coins"?`${reward.amount} Écus de corail`:reward?.name||"Récompense ajoutée",reward,"RÉCOMPENSE RÉCLAMÉE"); }
    if (act==="claim-all") { const r=M.claimAll(this.profile); if(!r.ok){this.toast(r.message,true);return;} M.notify(this.profile,{id:"claim-all-"+Date.now(),title:"Récompenses réclamées",message:r.claimed.length+" récompense(s) · +"+r.coins+" écus",type:"pass"});this.queueSave();if(r.coins>0)this.audio.coins();if(r.items.length)this.audio.reward();const desc=r.claimed.length+" récompense(s) du passe récupérée(s)"+(r.items.length?" · "+r.items.length+" cosmétique(s)":"")+".";return this.showReward(r.coins>0?`+${r.coins} Écus de corail`:"Récompenses du passe",{kind:r.coins>0?"coins":"item",amount:r.coins,icon:"🎁",description:desc,name:"Passe d’expédition"},"PASSE · TOUT RÉCLAMÉ"); }
    if (act==="equip"||act==="reward-equip") { const r=M.equip(this.profile,id);this.toast(r.message,!r.ok);if(r.ok){this.selectedCosmetic=id;this.queueSave();this.social?.refreshIdentity?.();this.audio.ui();} if(act==="reward-equip"){this.modal=null;this.overlay.innerHTML="";} return this.renderMenu(); }
    if (act==="save-name") { const r=M.setName(this.profile,$("player-name")?.value);this.toast(r.message,!r.ok);if(r.ok){this.queueSave();this.social?.refreshIdentity?.();}return this.renderMenu(); }
    if (act==="training-arsenal") return this.openTrainingArsenal();
    if (act==="training-give") { const rarity=Number($("training-rarity")?.value||2); if(this.world?.trainingGive(this.myId,id,rarity)){this.toast("Équipement d’entraînement ajouté au créneau sélectionné.");this.audio.reward();this.closeModal();this.updateHUD();}else this.toast("Arsenal réservé à l’entraînement.",true);return; }
    return v050Action.call(this,act,id,el);
  };
  const EMOTE_LABELS = {salut:["☀","Salut"],danse:["♫","Disco"],victoire:["★","Victoire"],robot:["▦","Robot"],etoile:["✦","Sauts étoile"],toupie:["↻","Breakdance"]};
  Horizons.prototype.canEmote = function () {
    const p=this.player();
    return this.screen==='game' && p?.alive && !p.downed && p.grounded && !p.falling && !p.gliding && !p.jumping && !p.swimming && !p.flying && !p.vehicleId && !p.reload && !p.useTime;
  };
  Horizons.prototype.openEmotes = function () {
    if(this.modal==='emotes'){this.closeModal();return;}
    if(this.modal||this.screen!=='game')return;
    if(!this.canEmote()){this.toast('Pose-toi et termine ton action pour faire une emote.');return;}
    this.resetControls();
    this.send({fire:false,aim:false,moveX:0,moveZ:0,moveY:0,sprint:false,crouch:false});
    this.modal='emotes';this.paused=false;this.touchMore=false;const drawer=$('touch-utility');if(drawer)drawer.hidden=true;document.querySelector('[data-act=touch-more]')?.setAttribute('aria-expanded','false');
    if(document.pointerLockElement)document.exitPointerLock();
    this.overlay.innerHTML=`<div class="modal-shade v8-emote-shade"><section class="dialog v8-emote-picker" role="dialog" aria-modal="true" aria-labelledby="emote-title"><header><div><span class="eyebrow">UN PEU DE STYLE</span><h2 id="emote-title">Tes emotes</h2></div>${button('resume','×','','btn-ghost')}</header><p>Choisis un geste. La partie continue !</p><div class="v8-emote-grid">${S.EMOTE_STYLES.map((style,i)=>{const a=EMOTE_LABELS[style];return button('emote-play',`<span class="v8-emote-icon" aria-hidden="true">${a[0]}</span><b>${a[1]}</b><kbd>${i+1}</kbd>`,style,'v8-emote-choice');}).join('')}</div><small>6 secondes · Bouger ou agir interrompt l’emote.<br><kbd>T</kbd> / <kbd>ÉCHAP</kbd> pour fermer.</small></section></div>`;
    this.overlay.querySelector('[data-act="emote-play"]')?.focus();
  };
  Horizons.prototype.playEmote = function (style) {
    if(!S.EMOTE_STYLES.includes(style)||this.screen!=='game')return;
    if(!this.canEmote()){this.closeModal();this.toast('Emote indisponible pendant cette action.');return;}
    this.closeModal();this.buildType=null;this.harvest=false;this.updateBuildBar();
    this.send({fire:false,aim:false,moveX:0,moveZ:0,moveY:0,sprint:false,crouch:false,emote:true,emoteStyle:style});
  };
  Horizons.prototype.openTrainingArsenal = function () {
    if(this.mode!=="training"||this.screen!=="game") return this.toast("L’arsenal est disponible sur le terrain d’entraînement.",true);
    this.modal="training";this.paused=!this.socket;this.fire=false;this.overlay.innerHTML=`<div class="modal-shade"><section class="dialog v6-arsenal"><div class="dialog-head"><div><span class="eyebrow">TERRAIN D’ENTRAÎNEMENT</span><h2>Arsenal de la Vigie</h2></div>${button("resume","FERMER ×","","btn-ghost")}</div><p>Choisissez une arme ou un consommable : l’objet remplace le créneau actif parmi les cinq emplacements.</p><label class="form-row">Rareté <select id="training-rarity"><option value="0">Commune</option><option value="1">Peu commune</option><option value="2" selected>Rare</option><option value="3">Épique</option><option value="4">Légendaire</option></select></label><div class="arsenal-grid">${Object.keys(S.weapons).map(k=>button("training-give",`${I.gun(k)}<span>${esc(S.weapons[k].name)}</span>`,k,"btn-ghost arsenal-item")).join("")}${button("training-give","✚<span>Trousse de soin</span>","heal","btn-ghost arsenal-item")}${button("training-give","⬡<span>Bouclier</span>","shield","btn-ghost arsenal-item")}</div><div class="dialog-actions">${button("training-reset","RETOUR AU TERRAIN","","btn-primary")}${button("garage","GARAGE","","btn-secondary")}</div></section></div>`;
  };
  Horizons.prototype.startMatch = async function () {
    if(this.screen==='loading')return;
    /* Social's wrapper owns connected group starts. The local branch never pretends
       to search for humans: it constructs the 100-slot simulation directly. */
    if (BR_MODES.includes(this.mode) && this.social?.connected && this.social.startMatch && this.social.startMatch !== Horizons.prototype.startMatch) return this.social.startMatch();
    this.resetControls(); clearInterval(this.prepTimer); this.lobbyReady=false;
    this.editing=false; this.keyCodes={}; document.body.classList.remove('world-editing');
    this.acc=0; this.lastSlots=null; this.closeSocket(); this.fire=false; this.aim=false; this.keys={}; this.buildType=null; this.harvest=!['training','creative'].includes(this.mode); this.material='wood'; this.move={x:0,z:0}; this.marker=null; this.resultHandled=null; this.paused=false; this.modal=null; this.overlay.innerHTML=''; this.events=[]; this.yaw=0; this.pitch=-.12; this.matchWeaponUses=0; this.lastCheckpointAt=0; this.audio.start();
    this.screen='loading'; document.body.dataset.screen='loading';
    const loading=M.catalog.find(x=>x.id===this.profile.equipment.loading), art=LOADING_ART[this.profile.equipment.loading]||LOADING_ART['loading-horizon'];
    const renderStage=(value,title,detail)=>{this.ui.innerHTML=`<section class="boot v6-loading" style="--loading-art:url('${art}')"><div class="v6-loading-art" role="img" aria-label="Illustration de chargement originale"></div><div class="v6-loading-copy"><span class="eyebrow">EXPÉDITION LOCALE</span><h2>${esc(title)}</h2><p>${esc(detail)}</p><progress class="progress progress-primary" max="100" value="${value}"></progress><small>${esc(loadingTips[(this.world?.seed||Date.now())%loadingTips.length])}</small></div></section>`;};
    renderStage(18,'Préparation du roster','Validation du mode et des équipiers IA déclarés…'); await new Promise(r=>requestAnimationFrame(r));
    renderStage(52,'Cartographie de l’archipel','Construction de la simulation locale et de ses 100 participants…');
    this.myId='p0'; this.world=new S.World({mode:this.mode,seed:Date.now()>>>0,player:{id:'p0',name:this.profile.name,equipment:{...this.profile.equipment}}}); this.transferMenuRoster(); await new Promise(r=>requestAnimationFrame(r));
    renderStage(82,'Mise à l’eau','Préparation des modèles, de la tempête et de l’interface…'); this.view.setWorld(this.world);
    if(this.mode==='creative') { const spawn=S.regions.find(r=>r.style==='citadel'); if(spawn)this.world.teleport(this.myId,spawn.x,spawn.z+spawn.padD+8); try { const raw=localStorage.getItem('azur-creative-v2'); if(raw){const bp=JSON.parse(raw), imported=this.world.importBuilds(this.myId,bp);if(imported.ok&&bp.spawn)this.world.teleport(this.myId,bp.spawn.x,bp.spawn.z);}} catch(_){} }
    await new Promise(r=>requestAnimationFrame(r)); renderStage(100,'Prêt à embarquer','Les commandes sont actives.'); await new Promise(r=>setTimeout(r,80));
    this.startGameUI(); document.body.dataset.screen='game';
  };
  Horizons.prototype.startGameUI = function () {
    v050StartGameUI.call(this);
    if(this.mode==="training") { const host=document.querySelector(".game-toolbar"); if(host) host.insertAdjacentHTML("beforeend",button("training-arsenal","ARSENAL","","btn-neutral training-open")); }
  };
  Horizons.prototype.nearPrompt = function (p) {
    const base=v050NearPrompt.call(this,p);
    if(p?.revivingId){const ally=this.world?.players.find(q=>q.id===p.revivingId);return `RÉANIMATION ${ally?.name||"allié"} · ${Math.round((p.reviveProgress||0)*100)} %`;} return base;
  };
  Horizons.prototype.updateHUD = function () {
    v050UpdateHUD.call(this);
    const p=this.player?.(); if(!p||this.screen!=="game")return;
    const emoteStatus=$('emote-status');
    if(emoteStatus){emoteStatus.hidden=!(p.emote>0);if(p.emote>0){const a=EMOTE_LABELS[p.emoteStyle]||EMOTE_LABELS.salut;emoteStatus.innerHTML=`<b>${a[0]} ${a[1]}</b><span>Bouge pour arrêter · ${Math.ceil(p.emote)} s</span><i style="--emote-progress:${Math.max(0,Math.min(1,p.emote/(p.emoteDuration||6)))}"></i>`;}}
    document.body.classList.toggle('emoting',p.emote>0);
    const prompt=$("interaction"); if(prompt&&p.revivingId) prompt.textContent=this.nearPrompt(p);
    let revive=$("revive-progress"); const reviver=p.revivingId? p : this.world.players.find(q=>q.team===p.team&&q.revivingId===p.id);
    if(reviver){if(!revive){revive=document.createElement("div");revive.id="revive-progress";revive.className="v6-revive-progress";document.querySelector(".hud")?.append(revive);}revive.innerHTML=`<b>RÉANIMATION</b><i><em style="width:${Math.round((reviver.reviveProgress||0)*100)}%"></em></i><span>${Math.round((reviver.reviveProgress||0)*100)} %</span>`;} else revive?.remove();
  };
  Horizons.prototype.onEvent = function (e) { if(e?.type==="shot"&&e.playerId===this.myId&&this.world?.phase==="active") this.matchWeaponUses=(this.matchWeaponUses||0)+1; return v050OnEvent.call(this,e); };
  Horizons.prototype.matchCounters = function () { const p=this.player();return {id:"match-"+this.world.seed+"-"+this.myId,mode:this.mode,kills:p?.kills||0,damage:p?.damage||0,distance:p?.distance||0,chests:p?.chests||0,gathered:p?.gathered||0,built:p?.built||0,regions:p?.regions?.length||0,duration:this.world?.elapsed||0,weaponUses:this.matchWeaponUses||0,won:false}; };
  Horizons.prototype.checkResult = function () {
    const p=this.player(), r=p?.result||this.world?.results?.[this.myId]; if(!r||this.resultHandled===r.id||this.screen!=="game")return;
    this.resultHandled=r.id; this.fire=false; this.keys={}; this.send({fire:false,moveX:0,moveZ:0});
    Object.assign(r,this.matchCounters(),{id:"match-"+this.world.seed+"-"+this.myId,rank:r.rank,won:r.won,finishedAt:r.finishedAt,date:r.date,weaponDamage:r.weaponDamage,regionNames:r.regionNames,revived:r.revived,timesRevived:r.timesRevived});
    const progress=M.applyMatch(this.profile,r); this.queueSave(); this.screen="results";this.paused=true;
    const leveled=progress.levelAfter>progress.levelBefore;
    if(r.won)this.audio.victory();else this.audio.reward();
    if(leveled)setTimeout(()=>this.audio.levelUp(),r.won?1500:650);
    if(document.pointerLockElement)document.exitPointerLock();
    this.ui.innerHTML="";this.overlay.innerHTML=this.buildResultsHTML(r,progress);
    this.animateResults(r,progress);
  };
  Horizons.prototype.loop = function (t) {
    v050Loop.call(this,t);
    if(this.screen==="game"&&BR_MODES.includes(this.mode)&&this.world?.phase==="active"&&!this.resultHandled&&this.frameTime-(this.lastCheckpointAt||0)>=5){this.lastCheckpointAt=this.frameTime;const gain=M.checkpointMatch(this.profile,this.matchCounters());this.queueSave();if(gain.xp||gain.completed.length){const names=gain.completed.map((id)=>M.questsById(id)?.name).filter(Boolean);this.toast(names.length?`★ ${names.join(" · ")} · +${gain.xp} XP`:`+${gain.xp} XP`,false,names.length?"quest":"xp");if(names.length)this.audio.questComplete();else this.audio.reward();}}
  };
  Horizons.prototype.bind = function () {
    v050Bind.call(this);
    /* Capture the profile file before the legacy immediate importer sees it. */
    $("save-import")?.addEventListener("change",async e=>{if(!e.target.files?.[0])return;e.stopImmediatePropagation();const f=e.target.files[0];try{if(f.size>1000000)throw Error("Profil trop volumineux.");this.pendingImport=M.normalize(JSON.parse(await f.text()));this.modal="import";this.overlay.innerHTML=`<div class="modal-shade"><section class="dialog"><span class="eyebrow">IMPORTER UN PROFIL</span><h2>Remplacer le profil local ?</h2><p>Le profil actuellement chargé sera remplacé après confirmation.</p><div class="dialog-actions">${button("confirm-import-profile","IMPORTER","","btn-primary")}${button("confirm-cancel","ANNULER","","btn-ghost")}</div></section></div>`;}catch(err){this.toast(err.message,true);}finally{e.target.value="";}},true);
  };
  const actionAfterImport = Horizons.prototype.action;
  Horizons.prototype.action = async function(act,id,el){
    if(act==="pad-calibrate"){ return this.calibrateGamepad(); }
    if(act==="confirm-import-profile"){if(!this.pendingImport)return;this.profile=this.pendingImport;this.pendingImport=null;this.storageBlocked=false;this.view?.configure(this.profile.settings);this.audio.configure(this.profile.settings);this.queueSave();this.modal=null;this.overlay.innerHTML="";this.renderMenu();this.toast("Profil importé.");return;}
    if(act==="training-reset"){const p=this.player?.();if(p&&this.world?.mode==="training"){if(p.vehicleId){const v=this.world.vehicles.find(v=>v.id===p.vehicleId);if(v)v.driver=null;p.vehicleId=null;}this.world.teleport(this.myId,0,70);this.world._trainingLoadout(p);p.hp=100;this.toast("Retour au pas de tir.");}this.closeModal();return;}
    return actionAfterImport.call(this,act,id,el);
  };
  // v21 wiring (worker câblage) : calibration des sticks de manette.
  // Échantillonne le centre au repos (1,2 s), mémorise les offsets dans
  // profile.settings.padCal, et relève la zone morte si la dérive la dépasse
  // (compensation réelle via le réglage existant controllerDeadzone, lu à
  // chaque frame par horizons-v170.js). padCalibratedAxes() applique la
  // correction fine des offsets — à brancher en une ligne dans le gamepad loop
  // v170 : const axes = this.padCalibratedAxes ? this.padCalibratedAxes(pad.axes) : pad.axes;
  Horizons.prototype.calibrateGamepad = async function(){
    const pads = typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    const pad = pads[0];
    if (!pad) { this.toast("Aucune manette détectée.", true); return; }
    this.toast("Ne touche à rien… calibration des sticks (1,2 s).");
    const samples = [], t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const g = navigator.getGamepads?.()[pad.index];
        if (g && !g.buttons.some((b) => b.pressed))
          samples.push([g.axes[0] || 0, g.axes[1] || 0, g.axes[2] || 0, g.axes[3] || 0]);
        if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    if (!samples.length) { this.toast("Calibration annulée : touche enfoncée.", true); return; }
    const avg = [0, 1, 2, 3].map((i) => samples.reduce((a, s) => a + s[i], 0) / samples.length);
    const drift = Math.max(...avg.map(Math.abs));
    this.profile.settings.padCal = {
      lx: +avg[0].toFixed(4), ly: +avg[1].toFixed(4),
      rx: +avg[2].toFixed(4), ry: +avg[3].toFixed(4),
    };
    let dzNote = "";
    const curDz = this.profile.settings.controllerDeadzone;
    if (drift > (typeof curDz === "number" && isFinite(curDz) ? curDz : 0.14)) {
      const raised = Math.min(0.35, Math.ceil((drift + 0.03) * 100) / 100);
      this.profile.settings.controllerDeadzone = raised;
      dzNote = ` Zone morte relevée à ${raised.toFixed(2)}.`;
    }
    this.queueSave();
    const st = document.getElementById("pad-cal-status");
    if (st) st.textContent = `Centre mesuré : ${avg.map((v) => (v >= 0 ? "+" : "") + v.toFixed(3)).join(" / ")} — dérive ${drift < 0.05 ? "négligeable" : "compensée"}.${dzNote}`;
    this.toast(drift < 0.02 ? "Sticks déjà bien centrés." : "Calibration enregistrée." + dzNote);
  };
  Horizons.prototype.padCalibratedAxes = function(axes){
    const c = this.profile?.settings?.padCal;
    if (!c || !axes) return axes;
    return [
      (axes[0] || 0) - (c.lx || 0),
      (axes[1] || 0) - (c.ly || 0),
      (axes[2] || 0) - (c.rx || 0),
      (axes[3] || 0) - (c.ry || 0),
    ];
  };
  Object.assign(Horizons.prototype, root.AZMapUI);
  if (root.AZSocial) root.AZSocial.install(Horizons);
  /* Intentionally exposed for local regression tests and optional LAN wrapper installation. */
  root.AZURHorizons = Horizons;
  new Horizons();
})(window);
