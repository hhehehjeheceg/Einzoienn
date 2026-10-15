// Canvas-drawn interfaces and labels, redrawn from time only (no state between frames).
import * as THREE from "three";
import { clamp, prog, out3, out5, io, smooth } from "./lib.js";

export const PAL = {
  ink: "#0a0c14", panel: "#10131f", panel2: "#161a29", line: "rgba(255,255,255,0.10)",
  text: "#f3efe9", dim: "rgba(243,239,233,0.55)", faint: "rgba(243,239,233,0.28)",
  coral: "#e8825f", coralHi: "#ff9a74", amber: "#ffb547", gold: "#f2c27b",
  teal: "#41d3c4", sky: "#62c6ff", violet: "#a492ff", rose: "#ff7fae",
};

const SANS = "InterTight", MONO = "JBM";

export function canvasTex(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { canvas, ctx, tex, w, h };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function frame(c, title, accent) {
  const { ctx, w, h } = c;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(28,32,50,0.96)"); g.addColorStop(1, "rgba(12,14,24,0.96)");
  rr(ctx, 4, 4, w - 8, h - 8, 34); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.stroke();
  // header
  ctx.fillStyle = "rgba(255,255,255,0.035)"; rr(ctx, 4, 4, w - 8, 78, 34); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(4, 82, w - 8, 2);
  ["#ff6b5c", "#ffbd3e", "#3ccf6e"].forEach((col, i) => { ctx.beginPath(); ctx.arc(46 + i * 30, 43, 9, 0, 7); ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; });
  ctx.font = `600 26px ${SANS}`; ctx.fillStyle = PAL.text; ctx.textBaseline = "middle";
  ctx.fillText(title, 150, 44);
  ctx.beginPath(); ctx.arc(w - 50, 43, 8, 0, 7); ctx.fillStyle = accent; ctx.fill();
}

function typed(ctx, str, x, y, n) {
  const s = str.slice(0, Math.max(0, Math.floor(n)));
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

// ---------------------------------------------------------------- the five interfaces of scene 3
// p: seconds since the panel appeared
export function drawWriting(c, p) {
  const { ctx, w } = c;
  frame(c, "Note de lancement", PAL.coral);
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 44px ${SANS}`; ctx.fillStyle = PAL.text;
  typed(ctx, "Lancement du projet Atlas", 64, 168, p * 60);
  const lines = [
    "Objectif : présenter le projet en trois points",
    "clairs, avec un ton direct et chaleureux.",
    "• Le problème que nous résolvons",
    "• Ce qui change pour l’équipe",
    "• Les prochaines étapes",
  ];
  ctx.font = `400 30px ${SANS}`;
  let chars = Math.max(0, (p - 0.3) * 75), lastX = 64, lastY = 240;
  lines.forEach((l, i) => {
    const y = 240 + i * 52 + (i >= 2 ? 18 : 0);
    ctx.fillStyle = i >= 2 ? PAL.text : PAL.dim;
    const n = clamp(chars, 0, l.length);
    if (chars > 0) { lastX = 64 + typed(ctx, l, 64, y, n); lastY = y; }
    chars -= l.length;
  });
  if (Math.floor(p * 2.5) % 2 === 0) { ctx.fillStyle = PAL.coralHi; ctx.fillRect(lastX + 4, lastY - 28, 3, 34); }
  // suggestion chip
  const a = smooth((p - 1.2) / 0.4);
  if (a > 0) {
    ctx.globalAlpha = a;
    rr(ctx, 64, 560, 560, 70, 20); ctx.fillStyle = "rgba(232,130,95,0.14)"; ctx.fill();
    ctx.strokeStyle = "rgba(232,130,95,0.6)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `600 26px ${SANS}`; ctx.fillStyle = PAL.coralHi; ctx.fillText("Suggestion · Raccourcir l’introduction", 90, 604);
    ctx.globalAlpha = 1;
  }
}

export const CODE_PANEL = [
  [["k", "const "], ["v", "idea"], ["p", " = "], ["f", "describe"], ["p", "("], ["s", "\"une tour torsadée\""], ["p", ");"]],
  [["k", "const "], ["v", "plan"], ["p", " = "], ["f", "structure"], ["p", "(idea, { "], ["v", "floors"], ["p", ": "], ["n", "36"], ["p", " });"]],
  [["c", "// chaque étage tourne un peu plus"]],
  [["k", "for "], ["p", "("], ["k", "const "], ["v", "floor "], ["k", "of "], ["v", "plan"], ["p", ".floors) {"]],
  [["p", "  "], ["v", "floor"], ["p", ".twist = "], ["v", "floor"], ["p", ".k * "], ["n", "0.9"], ["p", " * Math.PI;"]],
  [["p", "  "], ["f", "build"], ["p", "(floor);"]],
  [["p", "}"]],
  [["f", "render"], ["p", "(plan);"]],
];
const SYN = { k: "#c792ea", v: "#f3efe9", f: "#62c6ff", s: "#ffcf8a", n: "#ff9a74", p: "rgba(243,239,233,0.6)", c: "rgba(243,239,233,0.38)" };

function codeLines(ctx, lines, x, y, lh, chars, size, lineNo = true) {
  ctx.font = `500 ${size}px ${MONO}`;
  let left = chars, lastX = x, lastY = y;
  lines.forEach((ln, i) => {
    const yy = y + i * lh;
    if (lineNo) { ctx.fillStyle = "rgba(243,239,233,0.22)"; ctx.fillText(String(i + 1).padStart(2, " "), x - size * 2.2, yy); }
    let xx = x;
    for (const [k, s] of ln) {
      if (left <= 0) break;
      const n = Math.min(s.length, Math.floor(left));
      ctx.fillStyle = SYN[k]; ctx.fillText(s.slice(0, n), xx, yy);
      xx += ctx.measureText(s.slice(0, n)).width; left -= n;
      lastX = xx; lastY = yy;
    }
    left -= 1;
  });
  return [lastX, lastY];
}

export function drawCode(c, p) {
  const { ctx, w } = c;
  frame(c, "scene.js", PAL.sky);
  ctx.fillStyle = "rgba(98,198,255,0.12)"; rr(ctx, 150, 104, 170, 46, 12); ctx.fill();
  ctx.font = `600 22px ${MONO}`; ctx.fillStyle = PAL.sky; ctx.textBaseline = "middle"; ctx.fillText("scene.js", 172, 128);
  ctx.fillStyle = PAL.faint; ctx.fillText("idea.md", 350, 128);
  ctx.textBaseline = "alphabetic";
  const [lx, ly] = codeLines(ctx, CODE_PANEL, 120, 220, 56, p * 95, 28);
  if (Math.floor(p * 2.5) % 2 === 0) { ctx.fillStyle = PAL.sky; ctx.fillRect(lx + 3, ly - 26, 3, 32); }
  // status bar
  const a = smooth((p - 1.4) / 0.3);
  ctx.globalAlpha = a; ctx.fillStyle = "rgba(65,211,196,0.16)"; rr(ctx, 64, 690, w - 128, 60, 16); ctx.fill();
  ctx.font = `600 24px ${MONO}`; ctx.fillStyle = PAL.teal; ctx.fillText("✓ build terminé", 92, 729); ctx.globalAlpha = 1;
}

export function drawDesign(c, p) {
  const { ctx, w, h } = c;
  frame(c, "Composition · Atlas", PAL.rose);
  // artboard
  const ax = 64, ay = 120, aw = 760, ah = 620;
  ctx.fillStyle = "#f6f1ea"; rr(ctx, ax, ay, aw, ah, 18); ctx.fill();
  ctx.save(); rr(ctx, ax, ay, aw, ah, 18); ctx.clip();
  const e1 = out5((p - 0.15) / 0.7), e2 = out5((p - 0.35) / 0.7), e3 = out5((p - 0.55) / 0.6), e4 = out5((p - 0.8) / 0.6);
  // gradient sun
  const g = ctx.createLinearGradient(0, ay, 0, ay + 400); g.addColorStop(0, "#ff9a74"); g.addColorStop(1, "#e8825f");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ax + 520, ay + 230, 170 * e1, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffb547"; rr(ctx, ax + 70, ay + 330 + (1 - e2) * 120, 330 * e2, 170, 22); ctx.fill();
  ctx.fillStyle = "#2b2f6b"; ctx.globalAlpha = e3; rr(ctx, ax + 70, ay + 80, 300, 26, 13); ctx.fill(); rr(ctx, ax + 70, ay + 124, 210, 26, 13); ctx.fill();
  ctx.globalAlpha = e4; ctx.font = `800 64px ${SANS}`; ctx.fillStyle = "#14161f"; ctx.fillText("ATLAS", ax + 70, ay + 590 - (1 - e4) * 30);
  ctx.globalAlpha = 1; ctx.restore();
  // selection box on the sun
  const s = smooth((p - 1.2) / 0.3);
  if (s > 0) { ctx.globalAlpha = s; ctx.strokeStyle = PAL.sky; ctx.lineWidth = 3; ctx.strokeRect(ax + 350, ay + 60, 340, 340); [[350, 60], [690, 60], [350, 400], [690, 400]].forEach(([x, y]) => { ctx.fillStyle = "#fff"; ctx.fillRect(ax + x - 7, ay + y - 7, 14, 14); }); ctx.globalAlpha = 1; }
  // layers + swatches
  ctx.font = `600 24px ${SANS}`; ctx.fillStyle = PAL.dim; ctx.fillText("Calques", 870, 160);
  ["Titre", "Soleil", "Bloc", "Fond"].forEach((n, i) => {
    const a = smooth((p - 0.3 - i * 0.12) / 0.3); ctx.globalAlpha = a;
    rr(ctx, 860, 190 + i * 70, w - 924, 56, 12); ctx.fillStyle = i === 1 && p > 1.2 ? "rgba(98,198,255,0.18)" : "rgba(255,255,255,0.05)"; ctx.fill();
    ctx.fillStyle = PAL.text; ctx.font = `500 24px ${SANS}`; ctx.fillText(n, 890, 226 + i * 70);
  });
  ctx.globalAlpha = 1;
  ["#e8825f", "#ffb547", "#f6f1ea", "#2b2f6b", "#62c6ff"].forEach((col, i) => {
    const a = out3((p - 0.6 - i * 0.08) / 0.3);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(890 + i * 64, 620, 24 * a, 0, 7); ctx.fill();
  });
}

export function drawDocument(c, p) {
  const { ctx, w } = c;
  frame(c, "Document · Exemple", PAL.amber);
  // page
  const px = 64, py = 118, pw = 640, ph = 640;
  ctx.fillStyle = "#f4efe7"; rr(ctx, px, py, pw, ph, 14); ctx.fill();
  ctx.fillStyle = "#1a1c26"; ctx.font = `700 34px ${SANS}`; ctx.fillText("Plan de projet", px + 44, py + 70);
  const rows = [0.92, 0.85, 0.9, 0.6, 0, 0.95, 0.8, 0.88, 0.7, 0, 0.9, 0.84, 0.5];
  rows.forEach((r, i) => { if (!r) return; ctx.fillStyle = "rgba(26,28,38,0.18)"; rr(ctx, px + 44, py + 120 + i * 36, (pw - 88) * r, 14, 7); ctx.fill(); });
  // highlights sweep in
  [[1, 0.85, PAL.amber], [6, 0.8, PAL.coral], [11, 0.84, PAL.teal]].forEach(([i, r, col], k) => {
    const e = io((p - 0.5 - k * 0.35) / 0.4);
    if (e <= 0) return;
    ctx.fillStyle = col; ctx.globalAlpha = 0.35; rr(ctx, px + 38, py + 112 + i * 36, (pw - 76) * r * e, 30, 8); ctx.fill(); ctx.globalAlpha = 1;
  });
  // scan line
  const sy = py + 100 + ((p * 0.55) % 1) * (ph - 120);
  const sg = ctx.createLinearGradient(0, sy - 40, 0, sy); sg.addColorStop(0, "rgba(255,181,71,0)"); sg.addColorStop(1, "rgba(255,181,71,0.35)");
  ctx.fillStyle = sg; ctx.fillRect(px, sy - 40, pw, 40); ctx.fillStyle = "rgba(255,181,71,0.9)"; ctx.fillRect(px, sy, pw, 2);
  // key points
  ctx.font = `600 26px ${SANS}`; ctx.fillStyle = PAL.dim; ctx.fillText("Points clés", 750, 170);
  [["Calendrier en 3 phases", PAL.amber], ["Budget à valider", PAL.coral], ["2 risques signalés", PAL.teal]].forEach(([s, col], i) => {
    const e = out5((p - 0.75 - i * 0.35) / 0.4); if (e <= 0) return;
    ctx.globalAlpha = e;
    rr(ctx, 744 + (1 - e) * 40, 200 + i * 96, w - 808, 78, 16); ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(744 + (1 - e) * 40, 214 + i * 96, 5, 50);
    ctx.fillStyle = PAL.text; ctx.font = `500 26px ${SANS}`; ctx.fillText(s, 772 + (1 - e) * 40, 248 + i * 96);
    ctx.globalAlpha = 1;
  });
}

export function drawData(c, p) {
  const { ctx, w } = c;
  frame(c, "Activité hebdomadaire", PAL.teal);
  ctx.font = `500 22px ${MONO}`; ctx.fillStyle = PAL.faint; ctx.fillText("Exemple de données", 64, 140);
  const vals = [0.42, 0.55, 0.48, 0.7, 0.62, 0.86, 0.78];
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const x0 = 110, y0 = 690, cw = w - 200, chh = 470, step = cw / (vals.length - 1);
  for (let i = 0; i <= 4; i++) { ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x0 - 20, y0 - (i * chh) / 4, cw + 40, 2); }
  const morph = io((p - 1.0) / 0.5);
  // bars grow, then shrink to points while the line draws
  vals.forEach((v, i) => {
    const e = out5((p - 0.1 - i * 0.07) / 0.5) * (1 - morph);
    if (e <= 0) return;
    const bw = 64, x = x0 + i * step - bw / 2, hh = v * chh * e;
    const g = ctx.createLinearGradient(0, y0 - hh, 0, y0); g.addColorStop(0, PAL.teal); g.addColorStop(1, "rgba(65,211,196,0.15)");
    ctx.fillStyle = g; rr(ctx, x, y0 - hh, bw, hh, 10); ctx.fill();
  });
  if (morph > 0) {
    const n = morph * (vals.length - 1);
    ctx.beginPath();
    for (let i = 0; i <= Math.ceil(n); i++) {
      const f = Math.min(1, n - i + 1), j = Math.min(i, vals.length - 1);
      const x = x0 + Math.min(i, n) * step, vy = i <= n ? vals[j] : vals[j - 1] + (vals[j] - vals[j - 1]) * f;
      const y = y0 - vy * chh;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = PAL.sky; ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.stroke();
    ctx.lineTo(x0 + Math.min(n, vals.length - 1) * step, y0); ctx.lineTo(x0, y0); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0 - chh, 0, y0); g.addColorStop(0, "rgba(98,198,255,0.35)"); g.addColorStop(1, "rgba(98,198,255,0)");
    ctx.fillStyle = g; ctx.fill();
    vals.forEach((v, i) => { if (i > n) return; ctx.beginPath(); ctx.arc(x0 + i * step, y0 - v * chh, 9, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); });
  }
  ctx.font = `500 22px ${SANS}`; ctx.fillStyle = PAL.faint;
  days.forEach((d, i) => ctx.fillText(d, x0 + i * step - 20, y0 + 44));
}

// ---------------------------------------------------------------- scene 5 editor (the code that builds the tower)
export const TOWER_CODE = [
  [["c", "// tower.js · la structure construite dans cette scène"]],
  [["k", "export function "], ["f", "buildTower"], ["p", "(floors = "], ["n", "36"], ["p", ") {"]],
  [["p", "  "], ["k", "const "], ["v", "tower"], ["p", " = "], ["k", "new "], ["f", "THREE.Group"], ["p", "();"]],
  [["p", "  "], ["k", "for "], ["p", "("], ["k", "let "], ["v", "i"], ["p", " = "], ["n", "0"], ["p", "; i < floors; i++) {"]],
  [["p", "    "], ["k", "const "], ["v", "k"], ["p", " = i / (floors - "], ["n", "1"], ["p", ");"]],
  [["p", "    "], ["k", "const "], ["v", "r"], ["p", " = "], ["n", "1.55"], ["p", " - "], ["n", "0.5"], ["p", " * Math."], ["f", "sin"], ["p", "(k * Math.PI);"]],
  [["p", "    "], ["k", "const "], ["v", "slab"], ["p", " = "], ["f", "ringSlab"], ["p", "(r, "], ["n", "0.11"], ["p", ");"]],
  [["p", "    "], ["v", "slab"], ["p", ".position.y = i * "], ["n", "0.17"], ["p", ";"]],
  [["p", "    "], ["v", "slab"], ["p", ".rotation.y = k * Math.PI * "], ["n", "0.9"], ["p", ";"]],
  [["p", "    "], ["v", "tower"], ["p", "."], ["f", "add"], ["p", "(slab);"]],
  [["p", "  }"]],
  [["p", "  "], ["k", "return "], ["v", "tower"], ["p", ";"]],
  [["p", "}"]],
];
const SIDE_A = [
  [["k", "const "], ["v", "chrome"], ["p", " = "], ["f", "metal"], ["p", "({ roughness: "], ["n", "0.12"], ["p", " });"]],
  [["k", "const "], ["v", "glass"], ["p", " = "], ["f", "frosted"], ["p", "({ tint: "], ["s", "\"#e8825f\""], ["p", " });"]],
  [["v", "tower"], ["p", "."], ["f", "traverse"], ["p", "(m => m.material = pick(m));"]],
];
const SIDE_B = [
  [["f", "light"], ["p", "("], ["s", "\"key\""], ["p", ", { warmth: "], ["n", "0.8"], ["p", " });"]],
  [["f", "pulse"], ["p", "(tower, { from: "], ["s", "\"base\""], ["p", ", to: "], ["s", "\"top\""], ["p", " });"]],
];

export function drawEditor(c, p) {
  const { ctx, w } = c;
  frame(c, "tower.js", PAL.coral);
  ctx.textBaseline = "alphabetic";
  const [lx, ly] = codeLines(ctx, TOWER_CODE, 130, 170, 50, p * 150, 29);
  if (Math.floor(p * 2.5) % 2 === 0) { ctx.fillStyle = PAL.coralHi; ctx.fillRect(lx + 3, ly - 26, 3, 32); }
}
export function drawSide(c, p, which) {
  const { ctx, w, h } = c;
  ctx.clearRect(0, 0, w, h);
  rr(ctx, 4, 4, w - 8, h - 8, 26); ctx.fillStyle = "rgba(16,19,31,0.82)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.textBaseline = "alphabetic";
  codeLines(ctx, which ? SIDE_B : SIDE_A, 40, 70, 50, p * 110, 27, false);
}

// ---------------------------------------------------------------- labels
export function labelTex(text, color, w = 640, h = 120) {
  const c = canvasTex(w, h);
  const { ctx } = c;
  ctx.font = `700 40px ${SANS}`;
  ctx.letterSpacing = "8px";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2);
  c.tex.needsUpdate = true;
  return c;
}
