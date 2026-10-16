/* AZUR v92 — ch1-hud-v92.js : interface de partie placée comme dans les vidéos (design/azur-reference-spec.md §2).
 * Ajoute ce que l'ancien HUD n'a pas et le met à jour après chaque updateHUD :
 *  - boussole graduée (lettres tous les 45°, degrés tous les 15°, repère ▼ au centre),
 *  - ligne d'état sous la mini-carte : tempête/bus + minuteur, joueurs en vie, éliminations,
 *  - nom du joueur en haut à gauche avec sa fine barre de vie verte,
 *  - messages au centre de l'écran (chiffres en violet), dont les annonces de la tempête,
 *  - barre d'objets en bas à droite (pioche + 5, fond à la couleur de rareté, munitions, touches),
 *  - barre de construction toujours visible au-dessus (mur, sol, escalier, toit, piège),
 *  - réserves de munitions et colonne de matériaux à droite,
 *  - fil des éliminations en bas à gauche, fil des objets ramassés à droite,
 *  - fiche de l'objet au sol à droite du viseur avec « [E] Ramasser »,
 *  - récolte : point faible sur la cible, barre de solidité, « +8 » qui s'envole,
 *  - lunette de précision bleutée.
 * Les anciens éléments (#slots, #materials, #feed, #build-bar) restent dans le DOM pour les autres couches,
 * ils sont seulement masqués par ch1-hud-v92.css. Le placement est dans ch1-hud-v92.css. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons, doc = root.document, S = root.AZSim || {};
  if (!H || !doc || H.prototype.__ch1Hud) return;
  const P = H.prototype;
  P.__ch1Hud = true;

  const DIRS = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SO", 270: "O", 315: "NO" };
  const SPAN = 150; // degrés visibles sur la largeur de la boussole
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const now = () => performance.now() / 1000;
  const keyLabel = (code) =>
    ({ Space: "ESPACE", Tab: "TAB", ShiftLeft: "MAJ", ShiftRight: "MAJ", ControlLeft: "CTRL", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Delete: "SUPPR", PageUp: "PG↑", PageDown: "PG↓" }[code] ||
    String(code || "—").replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, ""));
  const touch = () => doc.body.classList.contains("touch-ui");
  const fmtNum = (n) => String(n).replace(".", ",");
  // durée de vie des fils et des « +N » ; AZ_CH1_HUD_SLOW > 1 les rallonge (captures d'écran en rendu logiciel lent)
  const life = (s) => s * Math.max(1, +root.AZ_CH1_HUD_SLOW || 1);

  const ICON = {
    storm: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 5.2V10l3.4 2.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    bus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5Q3 4 6 4h8q3 0 3 2.5V14H3z" fill="currentColor"/><rect x="5" y="6" width="10" height="3.2" rx=".8" fill="#000" opacity=".45"/><circle cx="6.5" cy="15" r="1.6" fill="currentColor"/><circle cx="13.5" cy="15" r="1.6" fill="currentColor"/></svg>',
    alive: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="5.6" r="3.4" fill="currentColor"/><path d="M3.5 18q0-7 6.5-7t6.5 7z" fill="currentColor"/></svg>',
    kills: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5c-4.2 0-7 2.8-7 6.6 0 2.3 1.1 3.7 2.6 4.6V17h2.2v-1.8h1.2V17h2v-1.8h1.2V17h2.2v-3.3c1.5-.9 2.6-2.3 2.6-4.6 0-3.8-2.8-6.6-7-6.6z" fill="currentColor"/><circle cx="7.2" cy="9.4" r="1.7" fill="#000"/><circle cx="12.8" cy="9.4" r="1.7" fill="#000"/></svg>',
    hammer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 9.5 2l3 3-1.2 1.2 1.6 1.6-1.4 1.4L9.9 7.6 8.6 8.9z" fill="currentColor"/><path d="m10.6 9.6 1.4-1.4 9 9-1.4 1.4-1.1 1.1z" fill="currentColor"/><path d="M14 14.5 7 21.5 4.5 19l7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5a1.5 1.5 0 0 1 3 0v8l1.2-2.2a1.6 1.6 0 0 1 2.8 1.6L18 19a5 5 0 0 1-4.4 3H12a5 5 0 0 1-5-5v-4.5a1.5 1.5 0 0 1 3 0" fill="currentColor"/></svg>',
  };

  /* ------------------------------------------------------------------ données d'objets */
  const RARE = ["Commun", "Peu commun", "Rare", "Épique", "Légendaire"];
  const AMMO_ORDER = ["light", "medium", "heavy", "shells", "rockets"];
  const AMMO_NAME = { light: "Munitions légères", medium: "Munitions moyennes", heavy: "Munitions lourdes", shells: "Cartouches", rockets: "Roquettes" };
  const AMMO_OF = { pistol: "light", smg: "light", revolver: "medium", rifle: "medium", burst: "medium", dmr: "heavy", sniper: "heavy", shotgun: "shells", tactical: "shells", launcher: "rockets" };
  const WNAME = {
    rifle: "Fusil d'assaut", burst: "Fusil d'assaut à rafale", smg: "Mitraillette", pistol: "Pistolet", revolver: "Revolver",
    shotgun: "Fusil à pompe", tactical: "Fusil à pompe tactique", sniper: "Fusil de précision à verrou", dmr: "Fusil de précision semi-auto", launcher: "Lance-roquettes",
  };
  const WKILL = {
    rifle: "au fusil d'assaut", burst: "au fusil d'assaut", smg: "à la mitraillette", pistol: "au pistolet", revolver: "au revolver",
    shotgun: "au fusil à pompe", tactical: "au fusil à pompe", sniper: "au fusil de précision", dmr: "au fusil de précision", launcher: "au lance-roquettes",
  };
  const MATS = ["wood", "stone", "metal"];
  const MAT_NAME = { wood: "Bois", stone: "Pierre", metal: "Métal" };
  const PIECES = ["wall", "floor", "ramp", "roof"];
  const PIECE_NAME = { wall: "Mur", floor: "Sol", ramp: "Escalier", roof: "Toit" };
  const weaponDef = (k) => (S.weapons && S.weapons[k]) || null;
  const itemName = (it) =>
    !it ? "" : it.kind === "weapon" ? WNAME[it.weapon] || weaponDef(it.weapon)?.name || it.weapon : it.kind === "heal" ? "Trousse de soin" : it.kind === "shield" ? "Potion de bouclier" : it.kind === "ammo" ? "Munitions" : String(it.kind);

  /* ------------------------------------------------------------------ icônes originales (SVG) */
  const svg = (vb, body, cls) => `<svg viewBox="${vb}" class="${cls || ""}" aria-hidden="true">${body}</svg>`;
  const G = "#22272c", L = "#7d8a95", Wd = "#8a5a35";
  const GUN = {
    rifle: `<path d="M2 11h11l2 2v5H9l-7 3z" fill="${G}"/><rect x="13" y="10" width="31" height="7" rx="1" fill="${G}"/><rect x="21" y="7" width="12" height="3" fill="${G}"/><path d="M28 17h6l-1.5 10h-6z" fill="${G}"/><path d="M17 17h5l-2 7h-5z" fill="${G}"/><rect x="44" y="11" width="11" height="5" fill="${L}"/><rect x="55" y="12.5" width="8" height="2" fill="${G}"/><rect x="15" y="11" width="27" height="1.4" fill="${L}"/>`,
    burst: `<path d="M2 12h11l2 1v5H9l-7 2z" fill="${G}"/><rect x="13" y="10" width="33" height="7" rx="1" fill="${G}"/><rect x="20" y="6" width="15" height="3.4" rx="1.2" fill="${L}"/><path d="M29 17h6l-1 9h-6z" fill="${G}"/><path d="M17 17h5l-2 7h-5z" fill="${G}"/><rect x="46" y="11" width="10" height="5" fill="${G}"/><rect x="56" y="12.5" width="7" height="2" fill="${G}"/><rect x="15" y="11" width="29" height="1.4" fill="${L}"/>`,
    smg: `<path d="M6 12h9v4H9l-3 3z" fill="${G}"/><rect x="14" y="9" width="26" height="8" rx="1.5" fill="${G}"/><rect x="40" y="11.5" width="9" height="3" fill="${G}"/><rect x="25" y="17" width="5" height="12" rx="1" fill="${G}"/><path d="M17 17h5l-1.5 7h-5z" fill="${G}"/><rect x="16" y="10.2" width="22" height="1.4" fill="${L}"/><rect x="33" y="17" width="5" height="3" fill="${L}"/>`,
    pistol: `<rect x="16" y="9" width="30" height="7" rx="1.2" fill="${G}"/><path d="M19 16h10l-3 12h-9z" fill="${G}"/><path d="M29 16h4l-1 4h-4z" fill="none" stroke="${G}" stroke-width="1.6"/><rect x="18" y="10" width="26" height="1.4" fill="${L}"/>`,
    revolver: `<rect x="26" y="10" width="26" height="4" rx="1" fill="${G}"/><rect x="18" y="8.5" width="11" height="9" rx="2.5" fill="${L}"/><rect x="19.5" y="10.5" width="8" height="1.2" fill="${G}"/><rect x="19.5" y="13.5" width="8" height="1.2" fill="${G}"/><path d="M14 10h5v8l-2 10H10l3-10z" fill="${Wd}"/><path d="M24 17.5h4l-1 4h-3z" fill="none" stroke="${G}" stroke-width="1.5"/>`,
    shotgun: `<path d="M2 12l12-2 2 3v4H9l-7 3z" fill="${Wd}"/><rect x="15" y="10" width="15" height="7" rx="1" fill="${G}"/><rect x="30" y="10.5" width="32" height="3" fill="${G}"/><rect x="34" y="14" width="13" height="4" rx="1.5" fill="${Wd}"/><path d="M18 17h5l-1.5 5h-5z" fill="${G}"/><rect x="47" y="14.2" width="13" height="2" fill="${L}"/>`,
    tactical: `<path d="M6 11h9v6H10l-4 2z" fill="${G}"/><rect x="15" y="9" width="18" height="8" rx="1.5" fill="${G}"/><rect x="33" y="10" width="22" height="3.4" fill="${G}"/><rect x="34" y="14" width="18" height="3.6" rx="1.4" fill="${L}"/><path d="M19 17h5l-2 8h-5z" fill="${G}"/><rect x="18" y="6.5" width="8" height="2.5" fill="${G}"/>`,
    sniper: `<path d="M1 12l13-2 2 2v5H8l-7 3z" fill="${Wd}"/><rect x="15" y="11" width="18" height="6" rx="1" fill="${G}"/><rect x="33" y="12" width="30" height="2.4" fill="${G}"/><rect x="18" y="5" width="16" height="4.6" rx="2" fill="${G}"/><rect x="16" y="6" width="3" height="2.6" fill="${L}"/><rect x="33" y="6" width="3" height="2.6" fill="${L}"/><rect x="24" y="9.5" width="3" height="1.6" fill="${G}"/><path d="M19 17h5l-1.5 5h-5z" fill="${G}"/><path d="M33 9.5l3 1.5" stroke="${L}" stroke-width="1.4"/>`,
    dmr: `<path d="M2 12h12l2 1v5H9l-7 2z" fill="${G}"/><rect x="15" y="10.5" width="22" height="6.5" rx="1" fill="${G}"/><rect x="37" y="12" width="25" height="2.6" fill="${G}"/><rect x="19" y="5.5" width="15" height="4" rx="1.8" fill="${L}"/><rect x="27" y="17" width="5" height="8" rx="1" fill="${G}"/><path d="M19 17h5l-1.5 6h-5z" fill="${G}"/>`,
    launcher: `<rect x="3" y="9" width="56" height="10" rx="4" fill="${L}"/><rect x="56" y="8" width="6" height="12" rx="2" fill="${G}"/><rect x="1" y="8.5" width="5" height="11" rx="2" fill="${G}"/><path d="M22 19h6l-2 8h-6z" fill="${G}"/><path d="M33 19h5l-1 5h-5z" fill="${G}"/><rect x="24" y="5.5" width="10" height="3.5" rx="1" fill="${G}"/><rect x="8" y="12.4" width="46" height="1.6" fill="${G}" opacity=".55"/>`,
  };
  const gunIcon = (k) => svg("0 0 64 32", GUN[k] || GUN.rifle, "ch1-gun");
  const PICKAXE = svg("0 0 32 32", `<path d="M9 29 22.5 8.5" stroke="#4b3524" stroke-width="3.2" stroke-linecap="round"/><path d="M8 7.5c5.5-4 13-4.6 20.5-.5-5.5.2-10.8 2-15.2 5.4z" fill="#d6dde3"/><path d="M8 7.5c5.5-4 13-4.6 20.5-.5l-2.4 1C20.4 5.4 14.2 5.8 9.6 8.8z" fill="#ffffff" opacity=".7"/><rect x="18" y="7" width="6" height="5.5" rx="1" transform="rotate(34 21 9.7)" fill="#59636c"/>`, "ch1-pick");
  const HEAL = svg("0 0 32 32", `<rect x="5" y="9" width="22" height="17" rx="3" fill="#f3f1ea"/><path d="M12 9V6h8v3" fill="none" stroke="#f3f1ea" stroke-width="2.4"/><path d="M14 12h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill="#e2463c"/>`, "ch1-cons");
  const SHIELD = svg("0 0 32 32", `<path d="M12 3h8v6l5 6v10c0 5-18 5-18 0V15l5-6z" fill="#bfefff" opacity=".9"/><path d="M8.6 17h14.8v8c0 3.6-14.8 3.6-14.8 0z" fill="#2e9df0"/><rect x="11.5" y="2" width="9" height="3.4" rx="1" fill="#e9f8ff"/><path d="M11 18.5v5" stroke="#d6f3ff" stroke-width="1.6" stroke-linecap="round"/>`, "ch1-cons");
  const itemIcon = (it) => (!it ? "" : it.kind === "weapon" ? gunIcon(it.weapon) : it.kind === "heal" ? HEAL : it.kind === "shield" ? SHIELD : ammoIcon("medium"));
  const MAT_ICON = {
    wood: svg("0 0 24 24", `<rect x="3" y="12" width="17" height="6.4" rx="3.2" fill="#b77a43"/><rect x="5" y="5.6" width="17" height="6.4" rx="3.2" fill="#cf9150"/><ellipse cx="19" cy="8.8" rx="2.6" ry="3.1" fill="#f1cf98"/><ellipse cx="19" cy="8.8" rx="1.1" ry="1.4" fill="#c68a4c"/><ellipse cx="17" cy="15.2" rx="2.6" ry="3.1" fill="#ecc68c"/><ellipse cx="17" cy="15.2" rx="1.1" ry="1.4" fill="#b57a40"/>`),
    stone: svg("0 0 24 24", `<path d="M3 9.5 12 5l9 4.5v7L12 21l-9-4.5z" fill="#c4562a"/><path d="M3 9.5 12 14l9-4.5L12 5z" fill="#e57a43"/><path d="M12 14v7" stroke="#8f3a19" stroke-width="1"/><path d="M5.5 12.6l4.8 2.4M13.7 15l4.8-2.4M8 9.9l4 2M12.6 8.3l3.8 1.9" stroke="#f3b089" stroke-width=".9" opacity=".8"/>`),
    metal: svg("0 0 24 24", `<path d="M4 7.5 14.5 4 20 8.5 9.5 12z" fill="#e3e9ee"/><path d="M4 7.5v8L9.5 20v-8z" fill="#9aa7b2"/><path d="M9.5 12v8L20 16.5v-8z" fill="#c2ccd4"/><path d="M11 13.5l7.5-2.6M11 16l7.5-2.6" stroke="#8b97a1" stroke-width=".9"/>`),
  };
  function ammoIcon(type) {
    const b = (x, y, w, h, c, tip) => `<rect x="${x}" y="${y + h * 0.3}" width="${w}" height="${h * 0.7}" rx="${w * 0.15}" fill="${c}"/><path d="M${x} ${y + h * 0.32}q${w / 2} -${h * 0.42} ${w} 0z" fill="${tip}"/>`;
    const body = {
      light: b(5, 6, 4, 13, "#d9e2e8", "#f2d39a") + b(10.5, 4, 4, 15, "#d9e2e8", "#f2d39a") + b(16, 6, 4, 13, "#d9e2e8", "#f2d39a"),
      medium: b(5, 4, 5, 16, "#8e9aa3", "#d7b06a") + b(13, 4, 5, 16, "#8e9aa3", "#d7b06a"),
      heavy: b(8.5, 2, 7, 20, "#5e6a74", "#c9a25c"),
      shells: `<rect x="5" y="5" width="6" height="13" rx="1.4" fill="#d9443a"/><rect x="5" y="16" width="6" height="4" fill="#d9a441"/><rect x="13" y="5" width="6" height="13" rx="1.4" fill="#d9443a"/><rect x="13" y="16" width="6" height="4" fill="#d9a441"/>`,
      rockets: `<path d="M12 2c3 2 4 5 4 8v7H8v-7c0-3 1-6 4-8z" fill="#c9d1d7"/><path d="M12 2c1.6 1 2.6 2.6 3.2 4.6H8.8C9.4 4.6 10.4 3 12 2z" fill="#e2463c"/><path d="M8 13l-3 5v3h3zM16 13l3 5v3h-3z" fill="#7d8a95"/><rect x="10" y="17" width="4" height="4" fill="#ffb347"/>`,
    }[type];
    return svg("0 0 24 24", body || "", "ch1-ammo-ico");
  }
  const PIECE_ICON = {
    wall: `<path d="M9 4.5 23 8.5v19L9 23.5z" fill="currentColor" fill-opacity=".55" stroke="#eaf8ff" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 14l14 4M16 6.5v19" stroke="#eaf8ff" stroke-width=".9" opacity=".6"/>`,
    floor: `<path d="M3.5 17 16 10.5 28.5 17 16 23.5z" fill="currentColor" fill-opacity=".55" stroke="#eaf8ff" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.7 13.7 22.2 20.2M22.2 13.7 9.7 20.2" stroke="#eaf8ff" stroke-width=".9" opacity=".6"/>`,
    ramp: `<path d="M4 24 22 7l6 3.5L10 27.5z" fill="currentColor" fill-opacity=".55" stroke="#eaf8ff" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 19.8l6 3.4M13 15.6l6 3.4M17.5 11.4l6 3.4" stroke="#eaf8ff" stroke-width="1" opacity=".75"/>`,
    roof: `<path d="M16 6 28 19 16 25 4 19z" fill="currentColor" fill-opacity=".55" stroke="#eaf8ff" stroke-width="1.4" stroke-linejoin="round"/><path d="M16 6v19M16 6 4 19M16 6l12 13" stroke="#eaf8ff" stroke-width=".9" opacity=".6"/>`,
    trap: `<path d="M5 22h22M8 22l3-9 3 9M14 22l3-9 3 9M20 22l3-9 3 9" fill="none" stroke="#eaf8ff" stroke-width="1.3" opacity=".55"/>`,
  };

  /* ------------------------------------------------------------------ construction du DOM (une fois par partie) */
  function ensure(hud) {
    if (hud.querySelector("#ch1-compass")) return;
    const add = (html) => hud.insertAdjacentHTML("beforeend", html);
    // la lunette passe en premier : tout le reste de l'interface reste lisible par-dessus, comme dans la vidéo
    const scope = hud.querySelector("#scope");
    if (scope) {
      hud.insertBefore(scope, hud.firstChild);
      scope.classList.add("ch1-scope");
      scope.innerHTML =
        '<div class="ch1-scope-lens"></div><svg class="ch1-scope-reticle" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<line x1="0" y1="500" x2="1000" y2="500" stroke="#05080b" stroke-width="2.2"/><line x1="500" y1="0" x2="500" y2="1000" stroke="#05080b" stroke-width="2.2"/>' +
        '<path d="M0 492 L58 497 L58 503 L0 508z M1000 492 L942 497 L942 503 L1000 508z M492 1000 L497 900 L503 900 L508 1000z" fill="#05080b"/>' +
        '<path d="M488 560h24M490 610h20M492 660h16" stroke="#05080b" stroke-width="2"/></svg>';
    }
    add('<div id="ch1-compass" class="ch1-compass" aria-hidden="true"><div class="ch1-compass-strip"></div><b class="ch1-compass-head"></b><i class="ch1-compass-mark">▼</i></div>');
    add('<div id="ch1-status" class="ch1-status"><span class="ch1-st-storm"></span><span class="ch1-st-alive">' + ICON.alive + '<b></b></span><span class="ch1-st-kills">' + ICON.kills + "<b></b></span></div>");
    add('<div id="ch1-squad" class="ch1-squad"><span class="ch1-squad-name"></span><i class="ch1-squad-bar"><i></i></i></div>');
    add('<div id="ch1-msg" class="ch1-msg" aria-live="polite"><span class="ch1-msg-ico"></span><b class="ch1-msg-text"></b><small class="ch1-msg-sub"></small></div>');
    // H5 — munitions puis matériaux (droite)
    add('<div id="ch1-ammo-res" class="ch1-ammo-res" aria-label="Réserves de munitions"></div>');
    add(
      '<div id="ch1-mats" class="ch1-mats" role="group" aria-label="Matériaux">' +
        MATS.map((m) => `<button type="button" class="ch1-mat" data-act="material" data-id="${m}" aria-label="${MAT_NAME[m]}"><span class="ch1-mat-ico">${MAT_ICON[m]}</span><b>0</b></button>`).join("") +
        "</div>",
    );
    // H7 — objets ramassés (droite), H6 — éliminations (gauche)
    add('<div id="ch1-pickups" class="ch1-pickups" aria-live="polite"></div>');
    add('<div id="ch1-killfeed" class="ch1-killfeed" aria-live="polite"></div>');
    // H4 — barre de construction toujours visible
    add(
      '<div id="ch1-build" class="ch1-build"><div class="ch1-build-keys" aria-hidden="true"><span class="ch1-bk-mode"></span>' +
        PIECES.map(() => "<kbd></kbd>").join("") +
        '<kbd class="ch1-bk-trap"></kbd></div><div class="ch1-build-row">' +
        '<button type="button" class="ch1-build-mode" data-act="build-mode" aria-label="Mode construction"><kbd></kbd>' + ICON.hammer + "</button>" +
        PIECES.map((k) => `<button type="button" class="ch1-piece" data-act="build-type" data-id="${k}" aria-label="${PIECE_NAME[k]}">${svg("0 0 32 32", PIECE_ICON[k])}</button>`).join("") +
        `<span class="ch1-piece trap" aria-hidden="true">${svg("0 0 32 32", PIECE_ICON.trap)}</span></div></div>`,
    );
    // H3 — barre d'objets : pioche + 5 emplacements
    add(
      '<div id="ch1-hotbar" class="ch1-hotbar"><div class="ch1-slots">' +
        '<button type="button" class="ch1-slot tool" data-act="tool" aria-label="Pioche"></button>' +
        [0, 1, 2, 3, 4].map((i) => `<button type="button" class="ch1-slot empty" data-act="slot" data-id="${i}" aria-label="Emplacement ${i + 1}"></button>`).join("") +
        '</div><div class="ch1-hotkeys" aria-hidden="true">' +
        "<kbd></kbd>".repeat(6) +
        "</div></div>",
    );
    // H8 — fiche de l'objet au sol
    add('<div id="ch1-loot" class="ch1-loot" hidden><div class="ch1-loot-prompt"></div><div class="ch1-loot-card"></div></div>');
    // H9 — récolte
    add('<div id="ch1-harvest" class="ch1-harvest" aria-hidden="true"><div class="ch1-thp" hidden><i><i></i></i><b></b></div><div class="ch1-wp" hidden><i></i></div><div class="ch1-pops"></div></div>');
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

  /* ------------------------------------------------------------------ H10 messages au centre (tempête réelle) */
  function duration(t) {
    const s = Math.max(0, Math.ceil(t)), m = Math.floor(s / 60), r = s % 60;
    const part = (n, u) => n + " " + u + (n > 1 ? "s" : "");
    if (m && r) return part(m, "minute") + " " + part(r, "seconde");
    return m ? part(m, "minute") : part(r, "seconde");
  }
  const freeMode = (w) => ["creative", "training", "event", "eventflight"].includes(w.mode);
  function stormMessage(game, w) {
    const st = w.storm;
    if (!st || w.phase !== "active" || freeMode(w) || !isFinite(st.timer)) return null;
    const state = w._stormState || "wait", key = (st.phase | 0) + state, t = now();
    if (game.__ch1StormKey !== key) { game.__ch1StormKey = key; game.__ch1StormAt = t; }
    const since = t - (game.__ch1StormAt || t), left = Math.max(0, Math.ceil(st.timer));
    if (state === "shrink") return since < 7 ? { ico: ICON.storm, cls: "storm", text: "L'ŒIL DU CYCLONE <em>RÉTRÉCIT</em>" } : null;
    // annonce au début de l'attente, à 1 minute, à 30 secondes et pendant les 10 dernières secondes
    const show = since < 8 || (left <= 60 && left > 54) || (left <= 30 && left > 25) || left <= 10;
    if (!show) return null;
    return (st.phase | 0) === 0
      ? { ico: ICON.clock, cls: "clock", text: `LA TEMPÊTE SE FORMERA DANS <em>${duration(left)}</em>` }
      : { ico: ICON.storm, cls: "storm", text: `L'ŒIL DU CYCLONE RÉTRÉCIT DANS <em>${duration(left)}</em>` };
  }
  function message(game, w, p) {
    if (!w || !p) return null;
    if (w.phase === "waiting") {
      const n = Math.max(1, Math.ceil(10 - (w.phaseTime || 0)));
      return { ico: ICON.bus, text: `LE BUS DE COMBAT DÉCOLLE DANS <em>${n}</em> ${n > 1 ? "secondes" : "seconde"}` };
    }
    if (w.phase === "transport" && !p.deployed) return { ico: ICON.bus, text: "SAUTE DU BUS QUAND TU VEUX", sub: "ESPACE · SAUTER" };
    if (p.downed) return { text: "À TERRE", sub: "UN COÉQUIPIER PEUT TE RÉANIMER" };
    const storm = stormMessage(game, w);
    if (p.falling && !p.gliding) return Object.assign({ text: "" }, storm || {}, { sub: "ESPACE · DÉPLOYER LE PLANEUR" });
    return storm;
  }

  function timerText(w) {
    const st = w && w.storm;
    if (!st) return "";
    const t = st.timer != null ? st.timer : st.nextIn != null ? st.nextIn : st.time;
    if (t == null || !isFinite(t)) return "";
    const s = Math.max(0, Math.ceil(t));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /* ------------------------------------------------------------------ H3 barre d'objets */
  function slotHTML(it, keyed) {
    if (!it) return "";
    const n = it.kind === "weapon" ? it.ammo | 0 : it.count | 0;
    const tag = it.kind === "weapon" ? ammoIcon(AMMO_OF[it.weapon] || "medium") : "";
    return `<span class="ch1-slot-ico">${itemIcon(it)}</span>${n || it.kind === "weapon" ? `<b class="ch1-slot-n">${n}${tag}</b>` : ""}${keyed || ""}`;
  }
  function renderHotbar(game, hud, w, p) {
    const bar = hud.querySelector("#ch1-hotbar");
    const btns = bar.querySelectorAll(".ch1-slot"), keys = bar.querySelectorAll(".ch1-hotkeys kbd");
    const kb = game.keybinds || {}, building = !!game.buildType;
    const selected = building ? -1 : game.harvest ? 0 : p.inventory[p.selected] ? p.selected + 1 : 0;
    const tool = btns[0], tk = "t" + (selected === 0 ? 1 : 0);
    if (tool.__k !== tk) { tool.__k = tk; tool.className = "ch1-slot tool" + (selected === 0 ? " sel" : ""); tool.innerHTML = `<span class="ch1-slot-ico">${PICKAXE}</span>`; }
    for (let i = 0; i < 5; i++) {
      const it = p.inventory[i], b = btns[i + 1];
      const k = it ? [it.kind, it.weapon, it.rarity | 0, it.gold ? 1 : 0, it.kind === "weapon" ? it.ammo : it.count, selected === i + 1 ? 1 : 0].join(":") : "-" + (selected === i + 1 ? 1 : 0);
      if (b.__k === k) continue;
      b.__k = k;
      b.className = "ch1-slot" + (it ? " r" + Math.max(0, Math.min(4, it.rarity | 0)) + (it.gold ? " gold" : "") : " empty") + (selected === i + 1 ? " sel" : "");
      b.innerHTML = slotHTML(it);
      b.setAttribute("aria-label", it ? itemName(it) + (it.kind === "weapon" ? " · " + (it.ammo | 0) + " munitions" : " ×" + (it.count | 0)) : "Emplacement " + (i + 1) + " vide");
    }
    const labels = [keyLabel(kb.tool || "Digit0"), ...[1, 2, 3, 4, 5].map((n) => keyLabel(kb["slot" + n] || "Digit" + n))];
    labels.forEach((t, i) => { if (keys[i].textContent !== t) keys[i].textContent = t; });
    bar.classList.toggle("building", building);
  }

  /* ------------------------------------------------------------------ H4 barre de construction */
  function renderBuild(game, hud) {
    const el = hud.querySelector("#ch1-build"), kb = game.keybinds || {};
    const k = [game.buildType || "", kb.build, kb.slot1, kb.slot2, kb.slot3, kb.slot4, game.material].join("|");
    if (el.__k === k) return;
    el.__k = k;
    el.classList.toggle("active", !!game.buildType);
    el.querySelectorAll(".ch1-piece[data-id]").forEach((b) => {
      const on = b.dataset.id === game.buildType;
      b.classList.toggle("sel", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const keys = el.querySelectorAll(".ch1-build-keys kbd:not(.ch1-bk-trap)");
    PIECES.forEach((_, i) => { keys[i].textContent = keyLabel(kb["slot" + (i + 1)] || "Digit" + (i + 1)); });
    el.querySelector(".ch1-build-mode kbd").textContent = keyLabel(kb.build || "KeyB");
  }

  /* ------------------------------------------------------------------ H5 munitions + matériaux */
  function ammoTotals(p) {
    const t = {};
    for (const it of p.inventory || []) if (it && it.kind === "weapon") { const a = AMMO_OF[it.weapon] || "medium"; t[a] = (t[a] || 0) + (it.reserve | 0); }
    return t;
  }
  function renderRight(game, hud, w, p) {
    const creative = w.mode === "creative";
    const tot = ammoTotals(p), it = p.inventory[p.selected], cur = !game.harvest && !game.buildType && it && it.kind === "weapon" ? AMMO_OF[it.weapon] : "";
    const ak = AMMO_ORDER.map((a) => a + (tot[a] ?? "")).join(",") + cur + creative;
    const ar = hud.querySelector("#ch1-ammo-res");
    if (ar.__k !== ak) {
      ar.__k = ak;
      ar.innerHTML = AMMO_ORDER.filter((a) => tot[a] != null)
        .map((a) => `<span class="ch1-ar${a === cur ? " cur" : ""}" title="${AMMO_NAME[a]}">${ammoIcon(a)}<b>${creative ? "∞" : tot[a]}</b></span>`)
        .join("");
    }
    const mats = hud.querySelector("#ch1-mats"), mk = MATS.map((m) => (p.mats && p.mats[m]) | 0).join(",") + game.material + creative;
    if (mats.__k !== mk) {
      mats.__k = mk;
      mats.querySelectorAll(".ch1-mat").forEach((b) => {
        const m = b.dataset.id, v = creative ? "∞" : String(Math.min(999999, (p.mats && p.mats[m]) | 0));
        b.classList.toggle("sel", (game.material || "wood") === m);
        const n = b.querySelector("b");
        if (n.textContent !== v) n.textContent = v;
      });
    }
  }

  /* ------------------------------------------------------------------ H7 objets ramassés (+ H9 « +N » qui s'envole) */
  function feedLine(box, html, key, ttl, max) {
    let line = key && box.querySelector(`[data-k="${key}"]`);
    if (!line) {
      line = doc.createElement("div");
      if (key) line.dataset.k = key;
      box.appendChild(line);
      while (box.children.length > max) box.firstElementChild.remove();
    }
    line.className = box.id === "ch1-killfeed" ? "ch1-kf" : "ch1-pk";
    line.innerHTML = html;
    line.style.animation = "none";
    void line.offsetWidth;
    line.style.animation = "";
    line.style.animationDuration = life(ttl) + "s";
    clearTimeout(line.__t);
    line.__t = setTimeout(() => line.remove(), life(ttl) * 1000);
    return line;
  }
  function invKeys(p) {
    const seen = {}, out = new Map();
    (p.inventory || []).forEach((it, i) => {
      if (!it) return;
      const base = it.id != null ? String(it.id) : it.kind + ":" + (it.weapon || "") + ":" + (it.rarity | 0) + ":" + i;
      seen[base] = (seen[base] || 0) + 1;
      out.set(base + "#" + seen[base], it);
    });
    return out;
  }
  function trackPickups(game, hud, w, p) {
    const st = game.__ch1Pick || (game.__ch1Pick = {});
    const inv = invKeys(p), mats = Object.assign({ wood: 0, stone: 0, metal: 0 }, p.mats || {});
    if (st.world !== w || st.pid !== p.id) { st.world = w; st.pid = p.id; st.inv = inv; st.mats = mats; return; }
    const box = hud.querySelector("#ch1-pickups"), creative = w.mode === "creative";
    if (!creative) {
      for (const [k, it] of inv) {
        if (st.inv.has(k)) continue;
        const r = Math.max(0, Math.min(4, it.rarity | 0));
        if (it.kind === "weapon") {
          feedLine(box, `<i class="ch1-pk-ico r${r}${it.gold ? " gold" : ""}">${gunIcon(it.weapon)}</i><span>${esc(itemName(it))}</span>`, "", 4.5, 6);
          if (it.reserve > 0) {
            const a = AMMO_OF[it.weapon] || "medium";
            feedLine(box, `<i class="ch1-pk-ico">${ammoIcon(a)}</i><b>×${it.reserve | 0}</b><span>${AMMO_NAME[a]}</span>`, "", 4.5, 6);
          }
        } else feedLine(box, `<i class="ch1-pk-ico">${itemIcon(it)}</i><b>×${Math.max(1, it.count | 0)}</b><span>${esc(itemName(it))}</span>`, "", 4.5, 6);
      }
      for (const m of MATS) {
        const d = (mats[m] | 0) - (st.mats[m] | 0);
        if (d <= 0) continue;
        const agg = st.agg || (st.agg = {}), t = now();
        const a = agg[m] && t - agg[m].t < 3 ? agg[m] : (agg[m] = { n: 0, t });
        a.n += d; a.t = t;
        feedLine(box, `<i class="ch1-pk-ico">${MAT_ICON[m]}</i><b>+${a.n}</b><span>${MAT_NAME[m]}</span>`, "mat-" + m, 4.5, 6);
        harvestPop(game, hud, p, m, d);
      }
    }
    st.inv = inv;
    st.mats = mats;
  }

  /* ------------------------------------------------------------------ H6 fil des éliminations */
  function killLine(game, e) {
    const hud = doc.querySelector("#ui .hud");
    const box = hud && hud.querySelector("#ch1-killfeed");
    const w = game.world;
    if (!box || !w) return;
    const name = (id) => { const q = id && w.players.find((x) => x.id === id); return q ? q.name || q.id : ""; };
    const victim = name(e.targetId) || "Joueur", killer = e.playerId && e.playerId !== e.targetId ? name(e.playerId) : "";
    const why = String(e.text || ""), last = (game.__ch1LastHit || {})[e.targetId];
    const mine = (id) => (id === game.myId ? " me" : "");
    const V = `<em class="v${mine(e.targetId)}">${esc(victim)}</em>`;
    let html;
    if (killer) {
      const K = `<b class="k${mine(e.playerId)}">${esc(killer)}</b>`;
      const weapon = last && last.by === e.playerId ? last.weapon : null;
      if (why === "véhicule") html = `${K} a renversé ${V}`;
      else if (why === "corps à corps") html = `${K} a éliminé ${V} à la pioche`;
      else if (why === "explosion") html = `${K} a éliminé ${V} ${WKILL[weapon] || "à l'explosif"}`;
      else html = `${K} a éliminé ${V}${weapon && WKILL[weapon] ? " " + WKILL[weapon] : ""}${why === "tir tête" ? " (tir à la tête)" : ""}`;
    } else if (why.indexOf("tempête") === 0) html = `${V} a succombé à la tempête`;
    else if (why === "hors combat") html = `${V} a succombé à ses blessures`;
    else if (why === "abandon") html = `${V} a abandonné la partie`;
    else if (why === "zeropoint") html = `${V} a été emporté par la faille`;
    else html = `${V} a été éliminé`;
    feedLine(box, html, "", 7, 5);
  }

  /* ------------------------------------------------------------------ H8 fiche de l'objet au sol */
  function lootInReach(w, p) {
    if (!w.loot || !p.alive || p.downed || p.vehicleId) return null;
    if (typeof w._downedAlly === "function") { const a = w._downedAlly(p); if (a && (a.x - p.x) ** 2 + (a.z - p.z) ** 2 < 10) return null; }
    for (const l of w.loot) if (!l.dead && (l.x - p.x) ** 2 + (l.z - p.z) ** 2 < 9 && Math.abs(p.y - l.y) < 2.5) return l; // même règle que World._interact
    return null;
  }
  function cardHTML(l) {
    const r = Math.max(0, Math.min(4, l.rarity | 0));
    let cat, stats = "", foot = "";
    if (l.kind === "weapon") {
      const d = weaponDef(l.weapon) || {}, mult = (S.rarities && S.rarities[r] && S.rarities[r].multiplier) || 1;
      const dmg = Math.round((d.damage || 0) * mult), shot = dmg * (d.pellets || 1);
      cat = l.weapon === "launcher" ? "Arme explosive" : "Arme balistique";
      stats =
        `<span><i>✦</i>Dégâts <b>${d.pellets ? d.pellets + "×" + dmg : dmg}</b><i>⟫</i>DPS <b>${Math.round(shot * (d.rate || 1))}</b></span>` +
        `<span><i>▤</i>Chargeur <b>${d.clip || 0}</b><i>↻</i>Rechargement <b>${fmtNum((d.reload || 0).toFixed(1))} s</b></span>`;
      const a = AMMO_OF[l.weapon] || "medium";
      foot = `<span class="ch1-lc-ammo">${ammoIcon(a)}${AMMO_NAME[a]}</span>`;
    } else if (l.kind === "heal" || l.kind === "shield") {
      cat = "Consommable";
      stats = l.kind === "heal" ? "<span><i>✚</i>Rend <b>45</b> PV · <b>2,7 s</b></span>" : "<span><i>⛊</i>Rend <b>35</b> de bouclier · <b>2,2 s</b></span>";
    } else cat = "Munitions";
    const qty = l.kind !== "weapon" && (l.count | 0) > 1 ? `<i class="ch1-lc-qty">×${l.count | 0}</i>` : "";
    return (
      `<div class="ch1-lc-head"><span>${RARE[r]} | ${cat}</span>${qty}</div><b class="ch1-lc-name">${esc(itemName(l).toUpperCase())}</b>` +
      `<div class="ch1-lc-stats">${stats}</div><div class="ch1-lc-foot">${foot}<span class="ch1-lc-stars">${"★".repeat(r + 1)}<i>${"★".repeat(4 - r)}</i></span></div>`
    );
  }
  function renderLoot(game, hud, w, p) {
    const box = hud.querySelector("#ch1-loot"), l = !game.modal && !game.buildType ? lootInReach(w, p) : null;
    const prompt = doc.getElementById("interaction");
    const tbtn = doc.querySelector('.touch-btn[data-act="interact"]');
    if (tbtn) tbtn.classList.toggle("ch1-ready", !!l);
    if (!l) { if (!box.hidden) box.hidden = true; box.__k = ""; return; }
    if (prompt) prompt.hidden = true;
    const full = (p.inventory || []).length >= 5, cur = p.inventory[p.selected];
    const verb = full ? (cur && cur.kind === "weapon" ? "Remplacer l'arme équipée" : "Remplacer l'objet équipé") : "Ramasser";
    const k = [l.id, l.kind, l.weapon, l.rarity, l.count, l.gold ? 1 : 0, verb, touch() ? 1 : 0, keyLabel((game.keybinds || {}).interact || "KeyE")].join("|");
    box.hidden = false;
    if (box.__k === k) return;
    box.__k = k;
    const r = Math.max(0, Math.min(4, l.rarity | 0));
    box.className = "ch1-loot r" + r + (l.gold ? " gold" : "");
    box.querySelector(".ch1-loot-prompt").innerHTML = touch()
      ? `<i class="ch1-lp-key">${ICON.hand}</i><span>${verb}</span>`
      : `<kbd class="ch1-lp-key">${esc(keyLabel((game.keybinds || {}).interact || "KeyE"))}</kbd><span>${verb}</span>`;
    box.querySelector(".ch1-loot-card").innerHTML = cardHTML(l);
  }

  /* ------------------------------------------------------------------ H9 récolte : point faible, solidité, « +N » */
  const T = root.THREE;
  const tmpV = T ? new T.Vector3() : null;
  function project(game, x, y, z) {
    const v = game.view, cam = v && v.camera, cv = v && v.renderer && v.renderer.domElement;
    if (!cam || !cv || !tmpV) return null;
    tmpV.set(x, y, z).project(cam);
    if (tmpV.z > 1 || tmpV.z < -1) return null;
    const r = cv.getBoundingClientRect();
    return { x: r.left + (tmpV.x * 0.5 + 0.5) * r.width, y: r.top + (-tmpV.y * 0.5 + 0.5) * r.height, w: r.width, h: r.height };
  }
  function harvestPop(game, hud, p, m, n) {
    const box = hud.querySelector("#ch1-harvest .ch1-pops");
    if (!box) return;
    const s = project(game, p.x, p.y + 1.3, p.z);
    const W = root.innerWidth, Hh = root.innerHeight;
    const x = s ? s.x - Math.max(54, s.w * 0.07) : W * 0.38, y = s ? s.y : Hh * 0.58;
    const el = doc.createElement("div");
    el.className = "ch1-pop";
    el.style.left = Math.round(x + (box.children.length % 3) * 6 - 6) + "px";
    el.style.top = Math.round(y) + "px";
    el.innerHTML = `<i>${MAT_ICON[m]}</i><b>+${n}</b>`;
    el.style.animationDuration = life(1.3) + "s";
    box.appendChild(el);
    while (box.children.length > 6) box.firstElementChild.remove();
    setTimeout(() => el.remove(), life(1.3) * 1000);
  }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
  const HV = { target: null, hp: 0, roll: 0, frame: 0 };
  function harvestTarget(game, w, p) {
    if (!game.harvest || game.buildType || game.modal || game.paused || !p.alive || p.downed || p.vehicleId || !p.grounded || p.swimming || typeof w._rayObstacle !== "function") return null;
    if (!p.deployed && w.phase !== "waiting") return null;
    const pitch = (p.pitch || 0) * 0.4, f = { x: -Math.sin(p.yaw || 0) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(p.yaw || 0) * Math.cos(pitch) };
    let hit = null;
    try { hit = w._rayObstacle(p.x, p.y + 1.05, p.z, f, 3.2); } catch (err) { return null; }
    const o = hit && hit.hit && hit.hit.kind === "object" ? hit.hit.object : null; // même cible que World._harvest
    if (!o || o.dead) return null;
    return { o, f, t: hit.t };
  }
  // H11 : dans la lunette on voit à travers l'optique, pas la tête de son propre personnage.
  // view.update réécrit .visible à chaque image ; on retire donc l'avatar de la couche de la caméra.
  const SCOPE_LAYER = 30;
  function scopeAvatar(game, on) {
    const v = game.view, a = v && v.actors && v.actors.get(game.myId);
    if (!a || !a.traverse) return;
    if (on && !a.__ch1Scoped) {
      a.__ch1Scoped = true;
      a.traverse((o) => { if (o.layers) { o.__ch1Mask = o.layers.mask; o.layers.set(SCOPE_LAYER); } });
    } else if (!on && a.__ch1Scoped) {
      a.__ch1Scoped = false;
      a.traverse((o) => { if (o.layers && o.__ch1Mask != null) { o.layers.mask = o.__ch1Mask; o.__ch1Mask = null; } });
    }
  }
  function harvestFrame() {
    root.requestAnimationFrame(harvestFrame);
    const game = root.AZUR;
    if (game && game.view) {
      const sc = game.screen === "game" ? doc.getElementById("scope") : null;
      scopeAvatar(game, !!(sc && !sc.hidden));
    }
    const hud = game && game.screen === "game" ? doc.querySelector("#ui .hud") : null;
    const box = hud && hud.querySelector("#ch1-harvest");
    if (!box) return;
    const wp = box.querySelector(".ch1-wp"), bar = box.querySelector(".ch1-thp");
    const w = game.world, p = game.player && game.player();
    if (!w || !p) return;
    if (++HV.frame % 2 === 0 || !HV.last) HV.last = harvestTarget(game, w, p) || 0;
    const tg = HV.last;
    if (!tg || !(tg.o.hp < (tg.o.maxHp || tg.o.hp + 1))) {
      if (!wp.hidden) wp.hidden = true;
      if (!bar.hidden) bar.hidden = true;
      if (tg) { HV.target = tg.o; HV.hp = tg.o.hp; }
      return;
    }
    const o = tg.o;
    if (HV.target !== o) { HV.target = o; HV.hp = o.hp; HV.roll = 0; }
    if (o.hp < HV.hp - 0.01) { HV.hp = o.hp; HV.roll++; wp.classList.remove("hit"); void wp.offsetWidth; wp.classList.add("hit"); }
    // point faible : sur la surface touchée, déplacé après chaque coup (repère visuel)
    const seed = String(o.id || o.x + ":" + o.z) + ":" + HV.roll;
    const dx = (hash(seed + "x") - 0.5) * 0.9, dy = (hash(seed + "y") - 0.35) * 0.9;
    const rx = Math.cos(p.yaw || 0), rz = -Math.sin(p.yaw || 0);
    const hx = p.x + tg.f.x * (tg.t - 0.05) + rx * dx, hy = p.y + 1.05 + tg.f.y * tg.t + dy, hz = p.z + tg.f.z * (tg.t - 0.05) + rz * dx;
    const s = project(game, hx, hy, hz);
    if (!s) { wp.hidden = true; bar.hidden = true; return; }
    wp.hidden = false;
    wp.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px)`;
    const max = Math.max(1, Math.round(o.maxHp || o.hp)), hp = Math.max(0, Math.ceil(o.hp));
    bar.hidden = false;
    const by = Math.max(s.h * 0.12, s.y - Math.max(64, s.h * 0.13));
    bar.style.transform = `translate(${s.x.toFixed(1)}px,${by.toFixed(1)}px)`;
    const k = hp + "/" + max;
    if (bar.__k !== k) { bar.__k = k; bar.querySelector("i i").style.width = ((hp / max) * 100).toFixed(1) + "%"; bar.querySelector("b").textContent = hp + " · " + max; }
  }
  root.requestAnimationFrame(harvestFrame);

  /* ------------------------------------------------------------------ actions : matériau précis depuis la colonne */
  const prevAction = P.action;
  P.action = function (act, id, el) {
    if (act === "material" && id && MATS.includes(id)) {
      if (this.screen !== "game" || this.modal || this.paused) return;
      this.material = id;
      this.audio && this.audio.ui && this.audio.ui();
      if (this.updateBuildBar) this.updateBuildBar();
      this.updateHUD();
      return;
    }
    return prevAction.apply(this, arguments);
  };

  /* ------------------------------------------------------------------ événements de la simulation */
  const prevEvent = P.onEvent;
  P.onEvent = function (e) {
    const r = prevEvent.apply(this, arguments);
    try {
      if (e && e.type === "hit" && e.targetId) {
        const lh = this.__ch1LastHit || (this.__ch1LastHit = {});
        lh[e.targetId] = { by: e.playerId, weapon: e.weapon || null };
      } else if (e && e.type === "elimination" && this.screen === "game") {
        killLine(this, e);
        if (this.__ch1LastHit) delete this.__ch1LastHit[e.targetId];
      }
    } catch (err) {
      if (!P.__ch1EvWarned) { P.__ch1EvWarned = true; console.warn("[ch1-hud]", err); }
    }
    return r;
  };

  /* ------------------------------------------------------------------ mise à jour (après l'updateHUD d'origine) */
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
      const forming = !bus && w.phase === "active" && w.storm && (w.storm.phase | 0) === 0 && (w._stormState || "wait") === "wait";
      const key = (bus ? "b" : forming ? "c" : "s") + stormT;
      if (st.__k !== key) {
        st.__k = key;
        const sp = st.querySelector(".ch1-st-storm");
        sp.className = "ch1-st-storm" + (forming ? " clock" : "");
        sp.innerHTML = (bus ? ICON.bus : forming ? ICON.clock : ICON.storm) + "<b>" + esc(stormT) + "</b>";
      }
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
          box.className = "ch1-msg" + (m.cls ? " " + m.cls : "");
          box.querySelector(".ch1-msg-ico").innerHTML = m.ico || "";
          box.querySelector(".ch1-msg-text").innerHTML = m.text || "";
          box.querySelector(".ch1-msg-sub").textContent = m.sub || "";
        }
      }
      // barres du bas et colonne de droite
      renderHotbar(this, hud, w, p);
      renderBuild(this, hud);
      renderRight(this, hud, w, p);
      trackPickups(this, hud, w, p);
      renderLoot(this, hud, w, p);
      const scope = doc.getElementById("scope");
      doc.body.classList.toggle("ch1-scoped", !!(scope && !scope.hidden));
    } catch (err) {
      if (!P.__ch1HudWarned) { P.__ch1HudWarned = true; console.warn("[ch1-hud]", err); }
    }
    return r;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
