/* AZUR v94 — frame-guard-v94.js : une erreur dans une image ne doit jamais figer le jeu.
 * La boucle principale (game.js) ne relance l'image suivante qu'à la fin de la mise à jour : une seule
 * exception dans la vue arrêtait tout (personnage figé en pose T, plus de commandes). Ici la mise à jour
 * de la vue est protégée : l'image fautive est sautée, l'erreur est notée dans la console, et si elle
 * vient du rendu, graphics-v94.js coupe un effet de plus pour la session.
 * À charger en tout dernier (enveloppe la plus externe de View.update). */
(function (root) {
  "use strict";
  const VP = root.AZView && root.AZView.View && root.AZView.View.prototype;
  if (!VP || VP.__frameGuard94) return;
  VP.__frameGuard94 = true;
  const inner = VP.update;
  let count = 0, last = "";
  VP.update = function () {
    try {
      return inner.apply(this, arguments);
    } catch (e) {
      count++;
      const msg = String((e && (e.message || e)) || "erreur");
      if (count <= 3 || msg !== last) { if (root.console) console.error("[AZUR] image sautée après une erreur (" + count + ")", e); }
      last = msg;
      const G = root.AZGfx94;
      if (G && G.renderThrew) { G.renderThrew = false; if (G.panic) G.panic(msg); }
      try { if (this.renderer) this.renderer.setRenderTarget(null); } catch (_) {}
      return undefined;
    }
  };
  root.AZFrameGuard = { errors: () => count, last: () => last };
})(typeof window !== "undefined" ? window : globalThis);
