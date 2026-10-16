/* AZUR v92 — ch1-flow-v92.js : déroulé de partie "Chapitre 1" (voir design/azur-reference-spec.md §3).
 * Contenu actuel :
 *  - roue d'émotes circulaire comme sur l'île d'attente de la vidéo (titre "TOUTES LES ÉMOTES [n/n]",
 *    disque bleu nuit, émotes réparties en cercle, centre "Annuler" + nom de l'émote survolée,
 *    sélection à la souris, au doigt ou aux touches 1-9). Elle remplace l'ancienne grille mais garde
 *    exactement les mêmes actions (data-act="emote-play" / "resume"), donc la simulation et les
 *    autres couches ne voient aucune différence. */
(function (root) {
  "use strict";
  const H = root.AZURHorizons, S = root.AZSim;
  if (!H || !S || H.prototype.__ch1Flow) return;
  const P = H.prototype;
  P.__ch1Flow = true;
  const doc = root.document;

  const LABELS = {
    salut: ["☀", "Salut"],
    danse: ["♫", "Disco"],
    victoire: ["★", "Victoire"],
    robot: ["▦", "Robot"],
    etoile: ["✦", "Sauts étoile"],
    toupie: ["↻", "Breakdance"],
  };
  const label = (style) => LABELS[style] || ["♪", style.charAt(0).toUpperCase() + style.slice(1)];
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const CSS = `
.ch1-wheel-shade{position:fixed;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 52%,rgba(0,0,0,.05),rgba(0,0,0,.25))!important;backdrop-filter:none!important;z-index:60;pointer-events:auto}
.ch1-wheel{position:relative;width:min(440px,78vmin);aspect-ratio:1;font-family:"Ch1 Condensed","Barlow Condensed",sans-serif;color:#fff}
.ch1-wheel-title{position:absolute;left:50%;top:-46px;transform:translateX(-50%);white-space:nowrap;padding:6px 18px;background:linear-gradient(180deg,#1d2f6b,#101c46);border:1px solid rgba(255,255,255,.3);font-weight:800;font-size:18px;letter-spacing:.02em}
.ch1-wheel-title kbd{display:inline-grid;place-items:center;min-width:22px;height:20px;margin:0 6px;border-radius:4px;background:#3d4f8a;font:700 12px system-ui,sans-serif}
.ch1-wheel-disc{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(16,26,62,.9) 0 28%,rgba(10,18,48,.86) 29% 100%);box-shadow:0 0 0 2px rgba(255,255,255,.12) inset,0 10px 40px rgba(0,0,0,.45)}
.ch1-wheel-center{position:absolute;left:50%;top:50%;width:30%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;text-align:center;background:rgba(0,0,0,.35);border:0;color:#fff;cursor:pointer;font:inherit}
.ch1-wheel-center b{display:block;font-size:20px;font-weight:800}
.ch1-wheel-center i{display:block;width:70%;margin:6px auto;border-top:2px dotted rgba(255,255,255,.7)}
.ch1-wheel-center span{display:block;font-size:15px;font-weight:800;opacity:.85}
.ch1-wheel-slot{position:absolute;width:24%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:0;background:transparent;color:#fff;cursor:pointer;display:grid;place-items:center;font:inherit;transition:transform .12s ease}
.ch1-wheel-slot .ico{display:grid;place-items:center;width:58%;aspect-ratio:1;border-radius:50%;font-size:30px;background:radial-gradient(circle at 35% 30%,#ffffff33,#ffffff08);text-shadow:0 2px 4px #0008}
.ch1-wheel-slot b{display:block;margin-top:2px;font-size:15px;font-weight:800;text-shadow:0 2px 3px #000a}
.ch1-wheel-slot kbd{position:absolute;right:6%;top:6%;font:700 11px system-ui,sans-serif;opacity:.7}
.ch1-wheel-slot:hover,.ch1-wheel-slot:focus-visible{transform:translate(-50%,-50%) scale(1.12);outline:none}
.ch1-wheel-slot:hover b,.ch1-wheel-slot:focus-visible b{color:#ffe62e}
@media (max-height:520px){.ch1-wheel{width:min(320px,74vmin)}.ch1-wheel-slot .ico{font-size:22px}.ch1-wheel-slot b{font-size:12px}.ch1-wheel-title{font-size:14px;top:-34px}}
`;
  function injectCss() {
    if (doc.getElementById("ch1-flow-css")) return;
    const st = doc.createElement("style");
    st.id = "ch1-flow-css";
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function wheelHTML(styles) {
    const n = styles.length;
    const slots = styles
      .map((style, i) => {
        // première émote en haut, puis sens horaire, comme la roue de la vidéo
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const x = 50 + Math.cos(a) * 36;
        const y = 50 + Math.sin(a) * 36;
        const [ico, name] = label(style);
        return (
          `<button type="button" class="ch1-wheel-slot" data-act="emote-play" data-id="${esc(style)}" data-name="${esc(name)}" ` +
          `style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%"><span><span class="ico" aria-hidden="true">${ico}</span><b>${esc(name)}</b></span>` +
          `${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}</button>`
        );
      })
      .join("");
    return (
      `<div class="modal-shade ch1-wheel-shade v8-emote-shade" role="dialog" aria-modal="true" aria-label="Toutes les émotes">` +
      `<div class="ch1-wheel"><div class="ch1-wheel-title">TOUTES LES ÉMOTES [${n}/${n}]</div><div class="ch1-wheel-disc"></div>` +
      `<button type="button" class="ch1-wheel-center" data-act="resume"><span><b class="ch1-wheel-name">${esc(label(styles[0])[1])}</b><i></i><span>Annuler</span></span></button>` +
      slots +
      `</div></div>`
    );
  }

  const prevOpen = P.openEmotes;
  P.openEmotes = function () {
    const r = prevOpen.apply(this, arguments);
    if (this.modal !== "emotes" || !this.overlay) return r;
    try {
      injectCss();
      const styles = (S.EMOTE_STYLES || []).slice(0, 12);
      if (!styles.length) return r;
      this.overlay.innerHTML = wheelHTML(styles);
      const name = this.overlay.querySelector(".ch1-wheel-name");
      this.overlay.querySelectorAll(".ch1-wheel-slot").forEach((b) => {
        const show = () => {
          if (name) name.textContent = b.dataset.name;
        };
        b.addEventListener("pointerenter", show);
        b.addEventListener("focus", show);
      });
      this.overlay.querySelector(".ch1-wheel-slot")?.focus();
    } catch (err) {
      console.warn("[ch1-flow] roue d'émotes", err);
    }
    return r;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
