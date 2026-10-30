/* Horizons 1.5 — salon classique inspiré de la référence fournie. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons;
  if (!H) return;
  const P = H.prototype;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const modeNames = {solo:"SOLO",titan:"GANT DU TITAN",duo:"DUO",squad:"ESCOUADE",creative:"CRÉATIF",training:"ENTRAÎNEMENT",event:"ÉVÉNEMENT · THE END",eventflight:"ÉVÉNEMENT 2 · VOL LIBRE"};

  const previousRenderMenu = P.renderMenu;
  P.renderMenu = function () {
    previousRenderMenu.call(this);
    if (this.screen !== "menu" || this.tab !== "play") return;
    const wordmark = document.querySelector(".wordmark");
    if (wordmark) wordmark.innerHTML = '<span class="classic-party-mark" aria-hidden="true"></span><b>2</b>';
    const nav = document.querySelector(".navlinks");
    if (nav && !document.querySelector(".classic-lobby-title")) {
      const title = document.createElement("span");
      title.className = "classic-lobby-title";
      title.textContent = "SALON";
      nav.before(title);
    }
    document.querySelectorAll(".navlinks .btn").forEach((button) => {
      const id = button.dataset.id;
      const label = button.textContent.trim();
      button.setAttribute("aria-label", label);
      button.title = label;
      if (id === "play") button.innerHTML = root.AZIcons?.icon?.("play") || "▶";
      else if (root.AZIcons?.icon) button.innerHTML = root.AZIcons.icon(id === "career" ? "quests" : id);
    });
  };

  /* Le premier rendu peut avoir lieu avant le chargement de ce module additionnel.
     On rejoue une seule fois l’onglet Salon dès que l’ancienne vue est prête. */
  let refreshAttempts = 0;
  const refreshInitialLobby = setInterval(() => {
    refreshAttempts += 1;
    const legacyLobby = document.querySelector(".v7-lobby-card");
    const home = document.querySelector('[data-act="tab"][data-id="play"]');
    if (document.body.dataset.screen === "menu" && legacyLobby && home) {
      clearInterval(refreshInitialLobby);
      home.click();
    } else if (refreshAttempts > 80) clearInterval(refreshInitialLobby);
  }, 100);

  P.lobbyHTML = function () {
    const xp = root.AZMeta.xpProgress(this.profile);
    const level = xp.level || 1;
    const percent = Math.max(4, Math.round((xp.percent || 0) * 100));
    const ready = !!this.lobbyReady;
    const seconds = ready ? Math.max(0, Math.ceil((this.prepEndsAt - Date.now()) / 1000)) : 0;
    const character = root.AZMeta.catalog.find((item) => item.id === this.profile.equipment.character)?.name || "Explorateur";
    const mode = modeNames[this.mode] || "SOLO";
    const playLabel = ready ? "ANNULER" : (this.mode === "creative" || this.mode === "training" ? "JOUER" : "JOUER");
    const playAction = ready ? "cancel-ready" : "play";
    return `<aside class="classic-progress" aria-label="Progression du joueur"><strong class="classic-season">HORS SAISON</strong><div class="classic-level"><span class="classic-level-shield">${level}</span><span class="classic-level-copy">NIVEAU <b>${level}</b></span><span class="classic-xp"><i style="width:${percent}%"></i></span><small class="classic-level-next">NIV. ${level + 9}</small></div><div class="classic-challenge-title">DÉFI QUOTIDIEN</div><div class="classic-challenge"><span>Atteindre le Top 50 en Solo</span><b>0 / 1 &nbsp; <em>◈ 500</em></b><small>Progresse en lançant une partie.</small></div></aside><div class="classic-player-label"><strong>${esc(this.profile.name)}</strong><span>${ready ? `PRÉPARATION · ${seconds}` : "PAS PRÊT"}</span><small>${esc(character)} · NIVEAU ${level}</small></div><div class="classic-platform" aria-hidden="true"></div><button class="classic-invite classic-invite-one" data-act="tab" data-id="group" aria-label="Inviter un membre au groupe">+</button><button class="classic-invite classic-invite-two" data-act="tab" data-id="group" aria-label="Inviter un membre au groupe">+</button><button class="classic-invite classic-invite-three" data-act="tab" data-id="group" aria-label="Inviter un membre au groupe">+</button><aside class="classic-play-card" aria-label="Lancer une partie"><button class="btn classic-mode" data-act="choose-mode" aria-haspopup="dialog" ${ready ? "disabled" : ""}>${mode}</button><button class="btn play-btn" data-act="${playAction}">${playLabel}</button><small class="classic-ready-note">${ready ? `DÉPART DANS ${seconds} S` : this.mode === "eventflight" ? "SANS CRASH · VOL SANS FIN · MINUTEUR À BORD" : this.mode === "event" ? "≈ 6 MIN · BUS PUIS SAUT LIBRE · SANS DÉGÂTS" : "100 PARTICIPANTS · LOCAL + IA"}</small></aside>`;
  };
})(window);
