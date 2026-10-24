/* AZUR — numéro de la version en cours, affiché discrètement dans le menu principal (coin bas droit), pour savoir d'un coup
 * d'œil quelle version tourne (hébergeur, cache du navigateur). À changer à chaque version livrée. */
(function (root) {
  "use strict";
  var BUILD = "v120"; // réglage : la version livrée
  root.AZ_BUILD = BUILD;
  if (root.console && console.info) console.info("[AZUR] version " + BUILD);
  var el = null;
  function tick() {
    var g = root.AZUR, onMenu = !!(g && g.screen === "menu");
    if (!el && root.document && document.body) {
      el = document.createElement("div"); el.id = "az-build-tag"; el.textContent = "AZUR " + BUILD;
      el.style.cssText = "position:fixed;right:calc(10px + env(safe-area-inset-right,0px));bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:9999;pointer-events:none;font:600 11px/1 system-ui,sans-serif;letter-spacing:.08em;color:rgba(255,255,255,.55);text-shadow:0 1px 2px rgba(0,0,0,.6)";
      document.body.appendChild(el);
    }
    if (el) el.style.display = onMenu ? "block" : "none";
  }
  setInterval(tick, 500);
})(typeof globalThis !== "undefined" ? globalThis : this);
