/* AZUR v92 — ch1-hud-v92.js : interface de partie placée comme dans les vidéos (design/azur-reference-spec.md §2).
 * Ajoute ce que l'ancien HUD n'a pas et le met à jour après chaque updateHUD :
 *  - boussole graduée (lettres tous les 45°, degrés tous les 15°, repère ▼ au centre),
 *  - ligne d'état sous la mini-carte : tempête/bus + minuteur, joueurs en vie, éliminations,
 *  - nom du joueur en haut à gauche avec sa fine barre de vie verte,
 *  - messages au centre de l'écran (chiffres en violet).
 * Le placement des éléments existants (mini-carte, barres, inventaire, matériaux) est dans ch1-hud-v92.css. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons, doc = root.document;
  if (!H || !doc || H.prototype.__ch1Hud) return;
  const P = H.prototype;
  P.__ch1Hud = true;

  const DIRS = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SO", 270: "O", 315: "NO" };
  const SPAN = 150; // degrés visibles sur la largeur de la boussole
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ICON = {
    storm: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>',
    bus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5Q3 4 6 4h8q3 0 3 2.5V14H3z" fill="currentColor"/><rect x="5" y="6" width="10" height="3.2" rx=".8" fill="#000" opacity=".45"/><circle cx="6.5" cy="15" r="1.6" fill="currentColor"/><circle cx="13.5" cy="15" r="1.6" fill="currentColor"/></svg>',
    alive: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="5.6" r="3.4" fill="currentColor"/><path d="M3.5 18q0-7 6.5-7t6.5 7z" fill="currentColor"/></svg>',
    kills: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5c-4.2 0-7 2.8-7 6.6 0 2.3 1.1 3.7 2.6 4.6V17h2.2v-1.8h1.2V17h2v-1.8h1.2V17h2.2v-3.3c1.5-.9 2.6-2.3 2.6-4.6 0-3.8-2.8-6.6-7-6.6z" fill="currentColor"/><circle cx="7.2" cy="9.4" r="1.7" fill="#000"/><circle cx="12.8" cy="9.4" r="1.7" fill="#000"/></svg>',
  };

  function ensure(hud) {
    if (hud.querySelector("#ch1-compass")) return;
    const add = (html) => hud.insertAdjacentHTML("beforeend", html);
    add('<div id="ch1-compass" class="ch1-compass" aria-hidden="true"><div class="ch1-compass-strip"></div><b class="ch1-compass-head"></b><i class="ch1-compass-mark">▼</i></div>');
    add('<div id="ch1-status" class="ch1-status"><span class="ch1-st-storm"></span><span class="ch1-st-alive">' + ICON.alive + '<b></b></span><span class="ch1-st-kills">' + ICON.kills + "<b></b></span></div>");
    add('<div id="ch1-squad" class="ch1-squad"><span class="ch1-squad-name"></span><i class="ch1-squad-bar"><i></i></i></div>');
    add('<div id="ch1-msg" class="ch1-msg" aria-live="polite"><span class="ch1-msg-ico"></span><b class="ch1-msg-text"></b><small class="ch1-msg-sub"></small></div>');
    doc.body.classList.add("ch1-hud");
  }

  function drawCompass(el, heading) {
    if (el.__h === heading) return;
    el.__h = heading;
    let html = "";
    const start = Math.ceil((heading - SPAN / 2) / 15) * 15;
    for (let d = start; d <= heading + SPAN / 2; d += 15) {
      const deg = ((d % 360) + 360) % 360, x = 50 + ((d - heading) / SPAN) * 100;
      const lab = DIRS[deg];
      html += lab
        ? `<span class="ch1-c-dir${deg % 90 ? "" : " card"}" style="left:${x.toFixed(2)}%">${lab}</span>`
        : `<span class="ch1-c-deg" style="left:${x.toFixed(2)}%">${deg}</span>`;
    }
    el.querySelector(".ch1-compass-strip").innerHTML = html;
    el.querySelector(".ch1-compass-head").textContent = heading;
  }

  // « DÉPART DANS 9 » → le message de la vidéo, chiffres mis en valeur
  function message(game, w, p) {
    if (!w || !p) return null;
    if (w.phase === "waiting") {
      const n = Math.max(1, Math.ceil(10 - (w.phaseTime || 0)));
      return { ico: ICON.bus, text: `LE BUS DE COMBAT DÉCOLLE DANS <em>${n}</em> ${n > 1 ? "secondes" : "seconde"}` };
    }
    if (w.phase === "transport" && !p.deployed) return { ico: ICON.bus, text: "SAUTE DU BUS QUAND TU VEUX", sub: "ESPACE · SAUTER" };
    if (p.falling && !p.gliding) return { text: "", sub: "ESPACE · DÉPLOYER LE PLANEUR" };
    if (p.downed) return { text: "À TERRE", sub: "UN COÉQUIPIER PEUT TE RÉANIMER" };
    const st = w.storm;
    if (st && st.shrinking) return { ico: ICON.storm, text: "L'ŒIL DU CYCLONE <em>RÉTRÉCIT</em>" };
    return null;
  }

  function timerText(w) {
    const st = w && w.storm;
    if (!st) return "";
    const t = st.timer != null ? st.timer : st.nextIn != null ? st.nextIn : st.time;
    if (t == null || !isFinite(t)) return "";
    const s = Math.max(0, Math.ceil(t));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  const prevHud = P.updateHUD;
  P.updateHUD = function () {
    const r = prevHud.apply(this, arguments);
    try {
      if (this.screen !== "game") return r;
      const hud = doc.querySelector("#ui .hud");
      if (!hud) return r;
      ensure(hud);
      const w = this.world, p = this.player && this.player();
      if (!w || !p) return r;
      const heading = ((Math.round((-this.yaw * 180) / Math.PI) % 360) + 360) % 360;
      drawCompass(hud.querySelector("#ch1-compass"), heading);
      // ligne d'état sous la mini-carte
      const st = hud.querySelector("#ch1-status");
      const old = doc.getElementById("storm-timer");
      const stormT = (old && old.textContent.trim()) || timerText(w);
      const bus = w.phase === "waiting" || (w.phase === "transport" && !p.deployed);
      const key = (bus ? "b" : "s") + stormT;
      if (st.__k !== key) { st.__k = key; st.querySelector(".ch1-st-storm").innerHTML = (bus ? ICON.bus : ICON.storm) + "<b>" + esc(stormT) + "</b>"; }
      const alive = w.players.filter((q) => q.alive).length;
      const ab = st.querySelector(".ch1-st-alive b"), kb = st.querySelector(".ch1-st-kills b");
      if (ab.textContent !== String(alive)) ab.textContent = alive;
      if (kb.textContent !== String(p.kills | 0)) kb.textContent = p.kills | 0;
      // nom du joueur + barre de vie fine
      const sq = hud.querySelector("#ch1-squad");
      const nm = sq.querySelector(".ch1-squad-name");
      if (nm.textContent !== (p.name || "Toi")) nm.textContent = p.name || "Toi";
      sq.querySelector(".ch1-squad-bar i").style.width = Math.max(0, Math.min(100, p.hp)) + "%";
      // message central
      const m = message(this, w, p), box = hud.querySelector("#ch1-msg");
      const mk = m ? (m.text || "") + "|" + (m.sub || "") : "";
      if (box.__k !== mk) {
        box.__k = mk;
        box.hidden = !m;
        if (m) {
          box.querySelector(".ch1-msg-ico").innerHTML = m.ico || "";
          box.querySelector(".ch1-msg-text").innerHTML = m.text || "";
          box.querySelector(".ch1-msg-sub").textContent = m.sub || "";
        }
      }
    } catch (err) {
      if (!P.__ch1HudWarned) { P.__ch1HudWarned = true; console.warn("[ch1-hud]", err); }
    }
    return r;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
