/* AZUR v92 — ch1-lobby-v92.js : salon et écran de chargement "Chapitre 1".
 * Reproduit la mise en page de l'image de référence (design/azur-reference-spec.md §6 et §3.2) :
 *  - barre d'onglets JOUER | PASSE DE COMBAT | DÉFIS | CASIER | BOUTIQUE | CARRIÈRE ;
 *  - colonne gauche CHAPITRE 1 / SAISON, niveau + barre d'XP violette, carte de médailles, missions XP ;
 *  - compte à rebours rouge au-dessus du personnage (prochain renouvellement des défis, à minuit) ;
 *  - carte de mode (nom + "sans remplissage" + CHANGER cyan) et grand bouton jaune JOUER ! ;
 *  - barre du bas EMOTE / FORMATION D'ESCOUADE ;
 *  - écran de chargement plein écran : illustration, "Solo / Battle Royale", bandeau jaune,
 *    barre CHARGEMENT et astuce dans un encadré violet.
 * Toutes les valeurs affichées viennent du DOM déjà calculé par les couches précédentes (niveau,
 * XP, défi du jour, mode) : cette couche ne fait que réorganiser et décorer, sans rien inventer.
 * Elle enrobe Horizons.prototype.renderMenu et observe #ui pour se ré-appliquer après chaque rendu. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons;
  if (!H || H.prototype.__ch1Lobby) return;
  const P = H.prototype;
  P.__ch1Lobby = true;
  const doc = root.document;

  const TAB_LABELS = {
    play: "JOUER",
    pass: "PASSE DE COMBAT",
    quests: "DÉFIS",
    locker: "CASIER",
    shop: "BOUTIQUE",
    career: "CARRIÈRE",
    group: "GROUPE",
    settings: "OPTIONS",
  };
  const MAIN_TABS = ["play", "pass", "quests", "locker", "shop", "career"];
  const MODE_SUB = {
    solo: "Battle Royale · solo",
    duo: "Battle Royale · sans remplissage",
    squad: "Battle Royale · sans remplissage",
    creative: "Mode créatif",
    training: "Entraînement",
    event: "Événement en direct",
    eventflight: "Événement en direct",
  };
  const MODE_NAME = {
    solo: "SOLO",
    duo: "DUOS",
    squad: "ESCOUADES",
    creative: "CRÉATIF",
    training: "ENTRAÎNEMENT",
    event: "LA FIN",
    eventflight: "LA FIN · VOL",
  };
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const txt = (el) => (el ? el.textContent.trim() : "");

  /* ---------------------------------------------------------------- barre d'onglets */
  function decorateTopbar(ui) {
    const nav = ui.querySelector(".topbar .navlinks");
    if (!nav || nav.dataset.ch1) return;
    nav.dataset.ch1 = "1";
    const buttons = {};
    nav.querySelectorAll("button[data-act=tab]").forEach((b) => (buttons[b.dataset.id] = b));
    for (const id of MAIN_TABS) {
      const b = buttons[id];
      if (!b) continue;
      const span = b.querySelector("span");
      if (span) span.textContent = TAB_LABELS[id];
      b.setAttribute("aria-label", TAB_LABELS[id]);
      b.title = TAB_LABELS[id];
      b.classList.add("ch1-tab");
      nav.appendChild(b);
    }
    for (const id of Object.keys(buttons)) {
      if (MAIN_TABS.includes(id)) continue;
      buttons[id].classList.add("ch1-tab-aux");
      nav.appendChild(buttons[id]);
    }
  }

  /* ---------------------------------------------------------------- colonne de progression */
  function decorateProgress(ui) {
    const aside = ui.querySelector(".classic-progress");
    if (!aside || aside.dataset.ch1) return;
    const level = txt(aside.querySelector(".classic-level-copy b")) || "1";
    const xpBar = aside.querySelector(".classic-xp i");
    const xp = xpBar ? xpBar.style.width || "0%" : "0%";
    const next = txt(aside.querySelector(".classic-level-next"));
    const challenge = txt(aside.querySelector(".classic-challenge span"));
    const progressNode = aside.querySelector(".classic-challenge b");
    const reward = txt(progressNode && progressNode.querySelector("em"));
    let progress = progressNode ? progressNode.childNodes[0]?.textContent || "" : "";
    progress = progress.replace(/\s+/g, " ").trim();
    const m = progress.match(/(\d+)\s*\/\s*(\d+)/);
    const done = m ? +m[1] : 0;
    const total = m ? Math.max(1, +m[2]) : 1;
    const pct = Math.round((Math.min(done, total) / total) * 100);
    // Carte de médailles : 5 cases remplies selon la progression réelle du défi du jour.
    const medals = Array.from({ length: 5 }, (_, i) =>
      `<i class="ch1-medal${i < Math.round((pct / 100) * 5) ? " on" : ""}"></i>`).join("");
    aside.dataset.ch1 = "1";
    aside.innerHTML =
      `<div class="ch1-season"><span>CHAPITRE 1</span><strong>SAISON 1</strong></div>` +
      `<div class="ch1-level"><span>NIVEAU <b>${esc(level)}</b></span><em>${esc(next)}</em>` +
      `<i class="ch1-xpbar"><i style="width:${esc(xp)}"></i></i></div>` +
      `<div class="ch1-punch"><span>CARTE DE MÉDAILLES</span><div class="ch1-medals">${medals}</div></div>` +
      (challenge
        ? `<div class="ch1-missions"><span>MISSIONS XP</span><p>${esc(challenge)}</p>` +
          `<div class="ch1-mrow"><i class="ch1-mbar"><i style="width:${pct}%"></i></i><b>${done} / ${total}</b></div>` +
          (reward ? `<small>Récompense ${esc(reward)}</small>` : "") +
          `<button class="btn ch1-cycle" data-act="tab" data-id="quests">VOIR LES DÉFIS</button></div>`
        : "");
  }

  /* ---------------------------------------------------------------- compte à rebours rouge */
  function countdownText() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    let s = Math.max(0, Math.floor((next - now) / 1000));
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const mi = Math.floor(s / 60);
    s -= mi * 60;
    const p = (n) => String(n).padStart(2, "0");
    return `00:${p(h)}:${p(mi)}:${p(s)}`;
  }
  function decorateCountdown(ui) {
    if (ui.querySelector(".ch1-countdown")) return;
    const el = doc.createElement("div");
    el.className = "ch1-countdown";
    el.setAttribute("aria-label", "Nouveaux défis dans");
    el.innerHTML = `<small>NOUVEAUX DÉFIS DANS</small><b>${countdownText()}</b>`;
    ui.appendChild(el);
  }

  /* ---------------------------------------------------------------- carte de mode + JOUER ! */
  function decoratePlayCard(game, ui) {
    const card = ui.querySelector(".classic-play-card");
    if (!card) return;
    const modeBtn = card.querySelector(".classic-mode");
    const play = card.querySelector(".play-btn");
    const mode = game.mode || "solo";
    if (!card.querySelector(".ch1-mode")) {
      const head = doc.createElement("div");
      head.className = "ch1-mode";
      card.insertBefore(head, card.firstChild);
    }
    const head = card.querySelector(".ch1-mode");
    const name = MODE_NAME[mode] || txt(modeBtn) || "SOLO";
    head.innerHTML = `<strong>${esc(name)}</strong><span>${esc(MODE_SUB[mode] || "")}</span>`;
    if (modeBtn) {
      modeBtn.textContent = "CHANGER";
      modeBtn.classList.add("ch1-change");
    }
    if (play && /^\s*JOUER\s*$/i.test(play.textContent)) play.textContent = "JOUER !";
  }

  /* ---------------------------------------------------------------- barre du bas */
  function decorateBottom(ui) {
    if (ui.querySelector(".ch1-lobby-actions")) return;
    const bar = doc.createElement("div");
    bar.className = "ch1-lobby-actions";
    bar.innerHTML =
      `<button class="btn ch1-emote" data-ch1-act="emote"><i>☺</i>EMOTE</button>` +
      `<button class="btn ch1-formation" data-act="tab" data-id="group"><i>⚇</i>FORMATION D'ESCOUADE</button>`;
    ui.appendChild(bar);
  }

  /* L'émote du salon fait danser le personnage du menu quand la vue l'expose ; sinon elle ouvre
   * le casier sur la catégorie des émotes (aucune action factice). */
  doc.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest && e.target.closest("[data-ch1-act=emote]");
      if (!btn) return;
      e.preventDefault();
      const g = root.AZUR;
      if (!g) return;
      const v = g.view;
      if (v && typeof v.playMenuEmote === "function") {
        v.playMenuEmote(g.profile?.equipment?.emote);
        return;
      }
      g.lockerFilter = "emote";
      g.action?.("tab", "locker", btn);
    },
    true,
  );

  function decorate(game) {
    const ui = game.ui || doc.getElementById("ui");
    if (!ui) return;
    doc.body.classList.add("ch1-ui");
    if (game.screen !== "menu") return;
    decorateTopbar(ui);
    if (game.tab === "play") {
      decorateProgress(ui);
      decorateCountdown(ui);
      decoratePlayCard(game, ui);
      decorateBottom(ui);
    }
  }

  const prevRender = P.renderMenu;
  P.renderMenu = function () {
    const r = prevRender.apply(this, arguments);
    try {
      decorate(this);
    } catch (err) {
      console.warn("[ch1-lobby]", err);
    }
    return r;
  };

  /* ---------------------------------------------------------------- écran de chargement */
  const TIPS = [
    "Les coffres brillent et bourdonnent : écoute-les pour les trouver.",
    "Construis une rampe pour prendre la hauteur sur ton adversaire.",
    "La tempête se referme : garde toujours un chemin vers le cercle.",
    "Frappe le point faible bleu avec ta pioche pour récolter plus vite.",
    "Les écus ne s'obtiennent qu'en jouant : aucun achat réel.",
  ];
  function decorateLoading(game, ui) {
    const sec = ui.querySelector(".v6-loading");
    if (!sec || sec.dataset.ch1) return;
    sec.dataset.ch1 = "1";
    const value = +(sec.querySelector("progress")?.value || 0);
    const mode = game.mode || "solo";
    const tip = TIPS[((game.world && game.world.seed) || 0) % TIPS.length];
    const label = { solo: "Solo", duo: "Duos", squad: "Escouades" }[mode] || MODE_NAME[mode] || "Solo";
    const title = mode === "creative" ? "Créatif" : mode === "training" ? "Entraînement" : /event/.test(mode) ? "Événement" : "Battle Royale";
    const stage = txt(sec.querySelector("h2"));
    const div = doc.createElement("div");
    div.className = "ch1-loading";
    div.innerHTML =
      `<div class="ch1-loading-art" role="img" aria-label="Illustration de chargement : le bus sous sa montgolfière au-dessus de l'île"></div>` +
      `<div class="ch1-loading-title"><small>${esc(label)}</small><strong>${esc(title)}</strong></div>` +
      `<div class="ch1-loading-banner">ACCÈS ANTICIPÉ</div>` +
      `<div class="ch1-loading-bar"><b>CHARGEMENT</b><span>${esc(stage)}</span><i><i style="width:${value}%"></i></i></div>` +
      `<div class="ch1-loading-tip">${esc(tip)}</div>`;
    sec.appendChild(div);
  }

  /* Re-décoration après chaque réécriture de #ui (compte à rebours de préparation, chargement…). */
  function hookObserver() {
    const ui = doc.getElementById("ui");
    if (!ui || ui.__ch1Obs) return;
    ui.__ch1Obs = true;
    /* Décoration synchrone (micro-tâche) : le chargement réécrit #ui entre deux images, une
     * attente d'animation laisserait voir l'ancien écran. On n'observe que les enfants directs de
     * #ui, donc nos propres ajouts à l'intérieur ne relancent pas l'observateur. */
    new MutationObserver(() => {
      const g = root.AZUR;
      if (!g) return;
      try {
        if (g.screen === "loading") decorateLoading(g, ui);
        else decorate(g);
      } catch (err) {
        console.warn("[ch1-lobby]", err);
      }
    }).observe(ui, { childList: true });
  }
  hookObserver();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", hookObserver);

  /* Compte à rebours vivant (une seule minuterie, coupée hors du salon). */
  setInterval(() => {
    const el = doc.querySelector("#ui .ch1-countdown b");
    if (el) el.textContent = countdownText();
    const g = root.AZUR;
    if (g && g.screen === "menu" && g.tab === "play") decoratePlayCard(g, g.ui || doc.getElementById("ui"));
  }, 1000);

  /* Si le menu est déjà affiché quand cette couche arrive (chargement lent), on décore tout de suite. */
  const tryNow = () => {
    if (root.AZUR) decorate(root.AZUR);
    else setTimeout(tryNow, 250);
  };
  tryNow();
})(typeof globalThis !== "undefined" ? globalThis : this);
