/* AZUR v93 — ch1-props-v93.js : la vie de l'île « Chapitre 1 » (décor, sans effet sur le jeu).
 * Tout est posé de façon déterministe à partir de la carte de la simulation (villes, routes,
 * relief, flore, objets) et reste purement visuel : aucune collision, aucun objet de simulation.
 *  - villes : lampadaires, bancs, poubelles, bouches d'incendie, massifs fleuris, parkings et
 *    voitures garées, panneaux, aires de jeux, fontaines et squares, terrain de basket, haies ;
 *  - fermes : champs (blé, labours, potager, maïs, lavande, tournesols, chaume et bottes de foin),
 *    clôtures, granges, silos, moulins à vent (ailes animées), châteaux d'eau, tracteurs ;
 *  - côte : pontons et barques au port, parasols, serviettes, transats, poste de secours,
 *    planches de surf, filet de volley, palmiers ;
 *  - désert : cactus, rochers rouges, buissons secs, arches de pierre ;
 *  - forêts : campings (tentes, feu de camp, tables), tas de bûches, souches, fougères,
 *    champignons ;
 *  - routes : poteaux électriques et câbles, station-service, panneaux publicitaires (textes
 *    originaux en français), panneaux d'entrée de ville, abribus, ponts ;
 *  - observatoires : grandes paraboles et antennes ; collines : tours de guet en bois ;
 *  - sol : ruisseaux qui descendent le relief (cascades sur les pentes fortes, mares),
 *    sentiers de terre vers les lieux nommés, fleurs des prés.
 * Rendu : géométries fusionnées par morceaux de 220 m et par palier (petits objets proches,
 * grands objets lointains), un seul matériau à couleurs de sommets → peu d'appels de dessin.
 * En qualité « basse », densité réduite et distance courte. Masqué en mode événement.
 * Doit être chargé après ch1-world-v93.js (enveloppe Environment.prototype.update). */
(function (root) {
  'use strict';
  const T = root.THREE, S = root.AZSim;
  const E = root.AZEnvironment && root.AZEnvironment.Environment && root.AZEnvironment.Environment.prototype;
  if (!T || !S || !S.regions || !S.MAP || !E || E.__ch1Props) return;
  E.__ch1Props = true;
  const M = S.MAP, SEA = -2, TAU = Math.PI * 2, HALF = M.halfSize, LAKE = S.LAKE || { x: 1e5, z: 1e5, r: 1 };
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hstr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const isEventWorld = () => { const w = root.AZUR && root.AZUR.world; return !!(w && w.mode === 'event') || !!(root.AZEvent && root.AZEvent.active); };
  const colorCache = new Map();
  const C = (h) => { let c = colorCache.get(h); if (!c) colorCache.set(h, (c = new T.Color(h))); return c; };
  const PUB = root.AZCh1Props = root.AZCh1Props || {};

  /* =============================================================== géométrie */
  function bumpy(g, amp, seed) {
    const p = g.attributes.position, r = rng(seed), map = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 97) + ',' + Math.round(p.getY(i) * 97) + ',' + Math.round(p.getZ(i) * 97);
      let f = map.get(k); if (f == null) { f = 1 + (r() - .5) * amp; map.set(k, f); }
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
    }
    g.computeVertexNormals(); return g;
  }
  // prisme triangulaire (pignon) : base de -w/2 à w/2 en x, sommet à h, profondeur d en z
  function gableGeo(w, h, d) {
    const a = [-w / 2, 0], b = [w / 2, 0], c = [0, h], f = d / 2, tris = [];
    const V3 = (p, z) => [p[0], p[1], z];
    tris.push([V3(a, f), V3(b, f), V3(c, f)], [V3(a, -f), V3(c, -f), V3(b, -f)]);
    tris.push([V3(a, f), V3(c, f), V3(c, -f)], [V3(a, f), V3(c, -f), V3(a, -f)]);
    tris.push([V3(b, f), V3(b, -f), V3(c, -f)], [V3(b, f), V3(c, -f), V3(c, f)]);
    return trisGeo(tris, [0, h / 3, 0]);
  }
  // triangles → géométrie non indexée, chaque face orientée vers l'extérieur du centre donné
  function trisGeo(tris, ctr) {
    const P = [];
    for (const t of tris) {
      const [p, q, r] = t, ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (p[0] + q[0] + r[0]) / 3 - ctr[0], my = (p[1] + q[1] + r[1]) / 3 - ctr[1], mz = (p[2] + q[2] + r[2]) / 3 - ctr[2];
      if (nx * mx + ny * my + nz * mz < 0) P.push(...p, ...r, ...q); else P.push(...p, ...q, ...r);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
  }
  function flipGeo(src) {
    const g = (src.index ? src.toNonIndexed() : src.clone()), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      for (const a of [p, n]) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); }
    }
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g;
  }
  const UP = new T.Vector3(0, 1, 0), tv = new T.Vector3(), tq = new T.Quaternion();
  function rodGeo(ax, ay, az, bx, by, bz, r, seg, box) {
    tv.set(bx - ax, by - ay, bz - az); const L = tv.length() || 1e-3; tv.multiplyScalar(1 / L);
    const g = box ? new T.BoxGeometry(r, L, r) : new T.CylinderGeometry(r, r, L, seg || 6, 1, true);
    tq.setFromUnitVectors(UP, tv); g.applyQuaternion(tq); g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); return g;
  }

  /* Kit : assemble un modèle (couleurs de sommets). Repère : avant = +z, sol = y 0. */
  function Kit() { this.s = []; this.g = []; }
  const K = Kit.prototype;
  K.part = function (geo, c, o) {
    o = o || {};
    if (o.sx || o.sy || o.sz) geo.scale(o.sx || 1, o.sy || 1, o.sz || 1);
    if (o.rz) geo.rotateZ(o.rz); if (o.rx) geo.rotateX(o.rx); if (o.ry) geo.rotateY(o.ry);
    if (o.x || o.y || o.z) geo.translate(o.x || 0, o.y || 0, o.z || 0);
    (o.glow ? this.g : this.s).push({ geo, c, paint: !!o.paint, lo: o.lo == null ? .84 : o.lo, hi: o.hi == null ? 1.06 : o.hi });
    return this;
  };
  const OP = (x, y, z, o) => Object.assign({ x, y, z }, o);
  K.box = function (w, h, d, c, x, y, z, o) { return this.part(new T.BoxGeometry(w, h, d), c, OP(x, y, z, o)); };
  K.cyl = function (rt, rb, h, seg, c, x, y, z, o) { return this.part(new T.CylinderGeometry(rt, rb, h, seg, 1, !!(o && o.open)), c, OP(x, y, z, o)); };
  K.cone = function (r, h, seg, c, x, y, z, o) { return this.part(new T.ConeGeometry(r, h, seg, 1, false), c, OP(x, y, z, o)); };
  K.ico = function (r, det, c, x, y, z, o) { const g = new T.IcosahedronGeometry(r, det || 0); if (o && o.bump) bumpy(g, o.bump, o.seed || 7); return this.part(g, c, OP(x, y, z, o)); };
  K.oct = function (r, c, x, y, z, o) { return this.part(new T.OctahedronGeometry(r), c, OP(x, y, z, o)); };
  K.gable = function (w, h, d, c, x, y, z, o) { return this.part(gableGeo(w, h, d), c, OP(x, y, z, o)); };
  K.rod = function (ax, ay, az, bx, by, bz, r, c, o) { return this.part(rodGeo(ax, ay, az, bx, by, bz, r, o && o.seg), c, o); };
  K.seg = function (ax, ay, az, bx, by, bz, t, c, o) { return this.part(rodGeo(ax, ay, az, bx, by, bz, t, 4, true), c, o); };
  K.raw = function (geo, c, o) { return this.part(geo, c, o); };

  function pack(list) {
    let n = 0;
    const gs = list.map((p) => { let g = p.geo.index ? p.geo.toNonIndexed() : p.geo; if (!g.attributes.normal) g.computeVertexNormals(); n += g.attributes.position.count; return g; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3), Kk = new Float32Array(n), Mk = new Uint8Array(n);
    let o = 0;
    list.forEach((p, j) => {
      const g = gs[j], a = g.attributes.position, nn = g.attributes.normal, base = C(p.c);
      let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < a.count; i++) { const y = a.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (let i = 0; i < a.count; i++, o++) {
        P[o * 3] = a.getX(i); P[o * 3 + 1] = a.getY(i); P[o * 3 + 2] = a.getZ(i);
        N[o * 3] = nn.getX(i); N[o * 3 + 1] = nn.getY(i); N[o * 3 + 2] = nn.getZ(i);
        const k = (a.getY(i) - y0) / Math.max(1e-3, y1 - y0), sh = p.lo + (p.hi - p.lo) * k;
        Kk[o] = sh; Mk[o] = p.paint ? 1 : 0; Cc[o * 3] = base.r * sh; Cc[o * 3 + 1] = base.g * sh; Cc[o * 3 + 2] = base.b * sh;
      }
      if (g !== p.geo) g.dispose(); p.geo.dispose();
    });
    return { P, N, C: Cc, K: Kk, Mk, n };
  }
  K.done = function () { return { s: pack(this.s), g: pack(this.g) }; };

  /* ================================================================ modèles */
  const PF = {};
  const def = (name, tier, fn) => { PF[name] = { tier, fn, pk: null }; };
  const prefab = (name) => { const p = PF[name]; if (!p) throw new Error('prefab ' + name); if (!p.pk) { const k = new Kit(); p.fn(k); p.pk = k.done(); } return p; };
  const FLOWERS = ['#ff4f6d', '#ffd23f', '#ffffff', '#b46cff', '#ff8a3c', '#ff6fb5', '#5aa0ff'];
  const HPI = Math.PI / 2;

  // --- mobilier urbain
  def('lampCity', 's', (k) => k.cyl(.2, .26, .5, 6, '#3b4047', 0, .25, 0).cyl(.07, .1, 5.6, 6, '#4a5058', 0, 3.05, 0, { open: 1 }).box(.09, .09, 1.5, '#4a5058', 0, 5.8, .7).box(.44, .16, .74, '#3b4047', 0, 5.74, 1.38).box(.34, .05, .58, '#fff1c4', 0, 5.64, 1.38, { glow: 1 }));
  def('lampWood', 's', (k) => k.box(.2, 4.6, .2, '#6b4a32', 0, 2.3, 0).box(.1, .1, 1.0, '#5a3d28', 0, 4.45, .42).box(.42, .08, .42, '#2f3338', 0, 4.28, .88).box(.3, .36, .3, '#ffd27a', 0, 4.06, .88, { glow: 1 }).box(.4, .06, .4, '#2f3338', 0, 3.86, .88));
  def('lampPort', 's', (k) => k.cyl(.16, .2, .4, 6, '#24382f', 0, .2, 0).cyl(.06, .08, 3.4, 6, '#2e4a3e', 0, 2.1, 0, { open: 1 }).box(.34, .08, .34, '#24382f', 0, 3.84, 0).box(.28, .4, .28, '#ffe3a0', 0, 4.08, 0, { glow: 1 }).cone(.3, .3, 4, '#24382f', 0, 4.43, 0, { ry: Math.PI / 4 }));
  def('lampDesert', 's', (k) => k.box(.42, 2.0, .42, '#d39a62', 0, 1.0, 0).box(.52, .12, .52, '#b9824f', 0, 2.06, 0).box(.3, .34, .3, '#ffd27a', 0, 2.3, 0, { glow: 1 }).cone(.32, .28, 4, '#7a4a33', 0, 2.61, 0, { ry: Math.PI / 4 }));
  def('bench', 's', (k) => k.box(1.8, .08, .48, '#b07a44', 0, .47, .02).box(1.8, .36, .06, '#b07a44', 0, .78, -.24, { rx: -.15 }).box(.07, .47, .5, '#3b4047', -.78, .235, 0).box(.07, .47, .5, '#3b4047', .78, .235, 0).box(.07, .42, .06, '#3b4047', -.78, .7, -.24).box(.07, .42, .06, '#3b4047', .78, .7, -.24));
  def('bin', 's', (k) => k.cyl(.27, .23, .86, 8, '#3f7a4a', 0, .43, 0).cyl(.3, .3, .08, 8, '#2f3338', 0, .9, 0));
  def('hydrant', 's', (k) => k.cyl(.13, .15, .62, 6, '#d6322b', 0, .31, 0).cyl(.08, .13, .16, 6, '#c42a24', 0, .7, 0).box(.4, .09, .09, '#c42a24', 0, .45, 0));
  for (let v = 0; v < 2; v++) def('flowerBed' + v, 's', (k) => { k.box(2.4, .36, 1.1, '#b9a58a', 0, .18, 0).box(2.24, .05, .94, '#5a3d28', 0, .37, 0).box(2.0, .18, .7, '#4f9a3a', 0, .45, 0); for (let i = 0; i < 7; i++) k.oct(.15, FLOWERS[(i * 3 + v * 2) % 7], -.9 + i * .3, .62 + (i % 2) * .06, ((i % 3) - 1) * .22); });
  for (let v = 0; v < 3; v++) def('flowers' + v, 's', (k) => { k.cone(.34, .26, 5, '#5aa338', 0, .13, 0); const r = rng(40 + v); for (let i = 0; i < 5; i++) k.oct(.1, FLOWERS[(v * 2 + i * (v + 1)) % 7], (r() - .5) * .9, .28 + r() * .2, (r() - .5) * .9); });
  const pole = (k, h) => k.cyl(.04, .04, h, 5, '#9aa0a6', 0, h / 2, 0, { open: 1 });
  def('signWarn', 's', (k) => { pole(k, 2.3); k.cyl(.5, .5, .05, 3, '#d6322b', 0, 2.5, .06, { rx: -HPI }).cyl(.36, .36, .06, 3, '#ffffff', 0, 2.5, .075, { rx: -HPI }).box(.06, .2, .02, '#2f3338', 0, 2.5, .11); });
  def('signNoEntry', 's', (k) => { pole(k, 2.0); k.cyl(.42, .42, .05, 12, '#d6322b', 0, 2.2, .06, { rx: -HPI }).box(.56, .13, .03, '#ffffff', 0, 2.2, .1); });
  def('signBlue', 's', (k) => { pole(k, 2.0); k.cyl(.4, .4, .05, 12, '#2d6fc4', 0, 2.2, .06, { rx: -HPI }).box(.4, .09, .03, '#ffffff', -.05, 2.2, .1).cone(.13, .18, 3, '#ffffff', .2, 2.2, .1, { rz: -HPI }); });
  def('signpost', 's', (k) => k.box(.16, 2.8, .16, '#6b4a32', 0, 1.4, 0).box(1.3, .3, .06, '#e9dcc0', .55, 2.45, .09).box(1.2, .3, .06, '#e9dcc0', -.5, 2.0, .09).cone(.21, .2, 3, '#e9dcc0', 1.3, 2.45, .09, { rz: -HPI }).cone(.21, .2, 3, '#e9dcc0', -1.2, 2.0, .09, { rz: HPI }));
  def('townSign', 's', (k) => k.box(.12, 2.3, .12, '#5a5f66', -1.5, 1.15, 0).box(.12, 2.3, .12, '#5a5f66', 1.5, 1.15, 0).box(3.4, 1.0, .1, '#ffffff', 0, 1.8, 0).box(3.26, .86, .11, '#2d6fc4', 0, 1.8, 0));
  def('busStop', 's', (k) => k.box(3.2, .1, 1.5, '#3b4047', 0, 2.45, .3).box(.08, 2.4, .08, '#5a5f66', -1.55, 1.2, .95).box(.08, 2.4, .08, '#5a5f66', 1.55, 1.2, .95).box(.08, 2.4, .08, '#5a5f66', -1.55, 1.2, -.4).box(.08, 2.4, .08, '#5a5f66', 1.55, 1.2, -.4).box(3.1, 2.0, .05, '#9cc6dc', 0, 1.3, -.42).box(2.4, .08, .42, '#b07a44', 0, .5, -.12).box(.12, 2.6, .12, '#5a5f66', 2.2, 1.3, .8).box(.6, .6, .06, '#2d6fc4', 2.2, 2.5, .8).box(.3, .12, .07, '#ffffff', 2.2, 2.5, .84));
  const wheels = (k, x, z, r, w) => { for (const sx of [-x, x]) for (const sz of [-z, z]) k.cyl(r, r, w, 8, '#1c1e21', sx, r, sz, { rz: HPI }); };
  def('car', 's', (k) => { k.box(1.86, .6, 4.1, '#888888', 0, .62, 0, { paint: 1 }).box(1.66, .56, 2.1, '#27313b', 0, 1.18, -.15).box(1.7, .08, 1.95, '#888888', 0, 1.48, -.15, { paint: 1 }).box(1.9, .2, .14, '#2b2f34', 0, .42, 2.07).box(1.9, .2, .14, '#2b2f34', 0, .42, -2.07).box(.4, .14, .04, '#fff6d6', -.6, .72, 2.06).box(.4, .14, .04, '#fff6d6', .6, .72, 2.06).box(.4, .12, .04, '#c8261d', -.6, .74, -2.06).box(.4, .12, .04, '#c8261d', .6, .74, -2.06); wheels(k, .86, 1.3, .34, .26); });
  def('van', 's', (k) => { k.box(2.0, 1.75, 4.7, '#888888', 0, 1.22, 0, { paint: 1 }).box(1.84, .68, .05, '#27313b', 0, 1.72, 2.36).box(.05, .6, 1.2, '#27313b', -1.01, 1.72, 1.4).box(.05, .6, 1.2, '#27313b', 1.01, 1.72, 1.4).box(2.04, .22, .16, '#2b2f34', 0, .46, 2.38).box(2.04, .22, .16, '#2b2f34', 0, .46, -2.38).box(1.9, .1, 4.5, '#e8e8e8', 0, 2.14, 0); wheels(k, .92, 1.55, .38, .28); });
  def('tractor', 's', (k) => { k.box(1.1, .9, 2.2, '#c8352b', 0, 1.15, .5).box(1.0, .5, .9, '#c8352b', 0, 1.0, -.55).box(1.3, .12, 1.4, '#2b2f34', 0, 2.62, -.5); for (const sx of [-.55, .55]) for (const sz of [-1.1, .1]) k.box(.08, 1.1, .08, '#2b2f34', sx, 2.05, sz); k.cyl(.06, .06, .8, 5, '#2b2f34', .35, 2.0, 1.2); for (const sx of [-.82, .82]) { k.cyl(.78, .78, .45, 10, '#1c1e21', sx, .78, -.6, { rz: HPI }); k.cyl(.45, .45, .3, 8, '#1c1e21', sx * .82, .45, 1.15, { rz: HPI }); } });
  def('playground', 's', (k) => {
    for (const x of [-5, -1]) { k.seg(x, 0, -1.1, x, 2.6, 0, .12, '#d6322b').seg(x, 0, 1.1, x, 2.6, 0, .12, '#d6322b'); }
    k.box(4.3, .12, .12, '#d6322b', -3, 2.62, 0);
    for (const x of [-4, -2]) k.box(.03, 1.9, .03, '#9aa0a6', x - .25, 1.65, 0).box(.03, 1.9, .03, '#9aa0a6', x + .25, 1.65, 0).box(.6, .06, .25, '#2d6fc4', x, .68, 0);
    for (const dx of [-.65, .65]) for (const dz of [-.65, .65]) k.box(.1, 2.5, .1, '#2d6fc4', 3.5 + dx, 1.25, -1 + dz);
    k.box(1.4, .12, 1.4, '#ffd23f', 3.5, 1.6, -1).cone(1.15, .8, 4, '#d6322b', 3.5, 2.9, -1, { ry: Math.PI / 4 }).box(.8, .06, 3.1, '#ff8a3c', 3.5, .86, 1.15, { rx: .52 }).box(.06, .25, 3.1, '#ff8a3c', 3.1, .98, 1.15, { rx: .52 }).box(.06, .25, 3.1, '#ff8a3c', 3.9, .98, 1.15, { rx: .52 });
    for (let j = 0; j < 5; j++) k.box(.7, .05, .06, '#ffd23f', 3.5, .3 + j * .3, -1.85 - j * .06);
    k.box(3, .08, .3, '#2d6fc4', -.5, .55, 3.2, { rz: .15 }).box(.3, .5, .3, '#ffd23f', -.5, .25, 3.2);
    k.box(2.6, .3, .15, '#b07a44', 3.2, .15, 2.0 + 2.2).box(2.6, .3, .15, '#b07a44', 3.2, .15, 4.8 + 1.0).box(.15, .3, 1.75, '#b07a44', 1.95, .15, 5.05).box(.15, .3, 1.75, '#b07a44', 4.45, .15, 5.05).box(2.4, .1, 1.5, '#ead7a1', 3.2, .1, 5.05);
  });
  def('fountain', 's', (k) => k.cyl(2.6, 2.75, .55, 16, '#cfc6b4', 0, .27, 0).cyl(2.35, 2.35, .06, 16, '#58b9de', 0, .52, 0).cyl(.32, .42, 1.7, 8, '#cfc6b4', 0, 1.1, 0).cyl(.95, .45, .32, 10, '#cfc6b4', 0, 1.95, 0).cyl(.8, .8, .04, 10, '#7fd0ee', 0, 2.1, 0).cone(.16, 1.0, 6, '#d8f2ff', 0, 2.6, 0, { lo: 1, hi: 1.15 }));
  def('hoop', 's', (k) => k.cyl(.07, .08, 3.3, 6, '#5a5f66', 0, 1.65, -.45, { open: 1 }).box(.08, .08, .75, '#5a5f66', 0, 3.2, -.08).box(1.6, 1.0, .06, '#f2f2f2', 0, 3.45, .3).box(.6, .42, .07, '#d6322b', 0, 3.3, .3).box(.5, .03, .5, '#ff6a1a', 0, 3.02, .6));
  def('crates', 's', (k) => k.box(1.1, 1.1, 1.1, '#b48a5a', -.6, .55, 0).box(1.1, 1.1, 1.1, '#a87c50', .6, .55, .1, { ry: .2 }).box(1.0, 1.0, 1.0, '#b48a5a', 0, 1.6, 0, { ry: .5 }));
  def('barrels', 's', (k) => k.cyl(.33, .33, .95, 8, '#3f6f8a', -.36, .47, 0).cyl(.33, .33, .95, 8, '#c8452e', .36, .47, .1).cyl(.33, .33, .95, 8, '#3f6f8a', 0, .47, .62));
  def('fenceWhite', 's', (k) => { k.box(.12, 1.0, .12, '#f2efe6', -1.5, .5, 0).box(3, .1, .05, '#f2efe6', 0, .78, 0).box(3, .1, .05, '#f2efe6', 0, .38, 0); for (let i = 0; i < 5; i++) k.box(.14, .95, .04, '#f7f4ec', -1.2 + i * .6, .48, .05); });
  def('hedge', 's', (k) => k.box(3.1, 1.25, 1, '#3f8a2c', 0, .62, 0, { lo: .7, hi: 1.1 }).box(2.8, .26, .8, '#4f9a33', 0, 1.3, 0));

  // --- ferme
  def('barn', 'b', (k) => {
    const a = Math.atan2(3.2, 5);
    k.box(10.6, .6, 14.6, '#8b8478', 0, .3, 0).box(10, 5.6, 14, '#b8332b', 0, 3.1, 0).gable(10, 3.2, 14, '#b8332b', 0, 5.9, 0, { lo: .95, hi: 1.05 })
      .box(6.35, .25, 14.8, '#5b3a2e', -2.5, 7.62, 0, { rz: a }).box(6.35, .25, 14.8, '#5b3a2e', 2.5, 7.62, 0, { rz: -a })
      .box(4.4, 4.6, .1, '#f2efe6', 0, 2.6, 7.02).box(4, 4.3, .12, '#8e2a23', 0, 2.5, 7.03)
      .seg(-1.85, .5, 7.1, 1.85, 4.5, 7.1, .22, '#f2efe6').seg(1.85, .5, 7.1, -1.85, 4.5, 7.1, .22, '#f2efe6')
      .box(1.8, 1.4, .12, '#f2efe6', 0, 7.0, 7.02).box(1.5, 1.1, .14, '#5a2a22', 0, 7.0, 7.03).box(10.1, .2, .1, '#f2efe6', 0, 5.85, 7.03)
      .box(.1, 1.2, 1.6, '#f2efe6', 5.03, 3.2, 2).box(.12, .95, 1.35, '#5a2a22', 5.04, 3.2, 2).box(.1, 1.2, 1.6, '#f2efe6', -5.03, 3.2, -2).box(.12, .95, 1.35, '#5a2a22', -5.04, 3.2, -2);
  });
  def('silo', 'b', (k) => k.cyl(2.4, 2.4, 12, 12, '#c9ccd1', 0, 6.4, 0, { open: 1, lo: .82, hi: 1.08 }).cyl(2.55, 2.55, .4, 12, '#8b8478', 0, .2, 0).raw(new T.SphereGeometry(2.45, 12, 4, 0, TAU, 0, HPI), '#9aa3ab', { y: 12.4 }).cyl(2.44, 2.44, .25, 12, '#8a929a', 0, 4.4, 0, { open: 1 }).cyl(2.44, 2.44, .25, 12, '#8a929a', 0, 8.6, 0, { open: 1 }).box(.5, 11.6, .12, '#7b838b', 0, 6.4, 2.45));
  def('windmill', 'b', (k) => k.cyl(2.0, 3.0, 9.6, 8, '#ebe3d1', 0, 4.8, 0, { lo: .86, hi: 1.04 }).cyl(3.15, 3.15, .4, 8, '#8b8478', 0, .2, 0).cone(2.6, 2.8, 8, '#7a4a33', 0, 11.0, 0).box(1.1, 1.9, .12, '#6b4a32', 0, .95, 2.95).box(.7, .8, .1, '#5d8fae', 0, 5.2, 2.5).box(.5, .5, 1.3, '#5b3a2e', 0, 9.4, 2.1));
  def('waterTower', 'b', (k) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.seg(sx * 2.5, 0, sz * 2.5, sx * 1.9, 10.1, sz * 1.9, .3, '#7a6a58');
    for (const s of [-1, 1]) { k.seg(-2.3, 1.5, s * 2.3, 2.1, 7.5, s * 2.05, .12, '#6a5a48').seg(s * 2.3, 1.5, -2.3, s * 2.05, 7.5, 2.1, .12, '#6a5a48'); }
    k.cyl(3, 3, 4.2, 12, '#d8d2c4', 0, 12.2, 0, { lo: .85, hi: 1.05 }).cone(3.3, 1.6, 12, '#9b4a3a', 0, 15.1, 0).cyl(3.05, 3.05, .3, 12, '#9b4a3a', 0, 10.2, 0).box(1.6, .5, .1, '#2d6fc4', 0, 12.6, 3.02);
  });
  def('hayRound', 's', (k) => k.cyl(.8, .8, 1.3, 10, '#d8b24c', 0, .8, 0, { rz: HPI, lo: .9, hi: 1.04 }));
  def('hayStack', 's', (k) => k.box(1.4, .7, .9, '#dcbf5f', -.75, .35, 0).box(1.4, .7, .9, '#d6b955', .75, .35, 0).box(1.4, .7, .9, '#e0c467', 0, 1.05, 0));
  def('scarecrow', 's', (k) => k.box(.1, 2.2, .1, '#6b4a32', 0, 1.1, 0).box(1.6, .08, .08, '#6b4a32', 0, 1.75, 0).box(.6, .7, .3, '#5a7fb8', 0, 1.55, 0).box(1.5, .18, .2, '#5a7fb8', 0, 1.78, 0).ico(.2, 0, '#e8d29a', 0, 2.15, 0).cone(.4, .08, 8, '#c9a24a', 0, 2.32, 0).cone(.18, .3, 8, '#c9a24a', 0, 2.45, 0));
  def('fence', 's', (k) => k.box(.14, 1.2, .14, '#8a6440', -1.5, .6, 0).box(3, .12, .06, '#a87c50', 0, .95, 0).box(3, .12, .06, '#a87c50', 0, .5, 0));
  def('cornRow', 's', (k) => { for (let i = 0; i < 6; i++) { const z = -4.2 + i * 1.7; k.cone(.17, 2.1, 4, '#6fa53a', 0, 1.05, z, { lo: .72 }).box(.9, .04, .16, '#7fb244', 0, 1.1, z, { rz: .3, ry: i * 1.1 }).box(.09, .3, .09, '#e2c35a', 0, 2.2, z); } });
  def('sunRow', 's', (k) => { for (let i = 0; i < 5; i++) { const z = -4 + i * 2; k.box(.07, 1.7, .07, '#5f8f36', 0, .85, z).cyl(.32, .32, .08, 8, '#f2c230', 0, 1.75, z + .1, { rx: -1.2 }).cyl(.14, .14, .1, 6, '#5a3d28', 0, 1.77, z + .14, { rx: -1.2 }); } });
  def('trough', 's', (k) => k.box(2.2, .6, .8, '#8a6440', 0, .3, 0).box(2.0, .06, .6, '#58b9de', 0, .58, 0));

  // --- désert
  def('cactus', 'b', (k) => k.cyl(.36, .42, 4.2, 7, '#3f8f4a', 0, 2.1, 0, { open: 1, lo: .78, hi: 1.05 }).ico(.37, 0, '#4a9a52', 0, 4.2, 0, { sy: .8 }).cyl(.22, .22, 1.0, 6, '#3f8f4a', .6, 1.9, 0, { rz: HPI, open: 1 }).cyl(.22, .24, 1.6, 6, '#3f8f4a', 1.1, 2.7, 0, { open: 1 }).ico(.22, 0, '#4a9a52', 1.1, 3.5, 0).cyl(.2, .2, .8, 6, '#3f8f4a', -.5, 2.6, 0, { rz: HPI, open: 1 }).cyl(.2, .22, 1.2, 6, '#3f8f4a', -.9, 3.1, 0, { open: 1 }).ico(.2, 0, '#4a9a52', -.9, 3.7, 0));
  def('cactusBarrel', 's', (k) => k.ico(.6, 1, '#4e9a48', 0, .42, 0, { sy: .8, bump: .12 }).oct(.12, '#ff6fb5', 0, .9, 0));
  def('desertRock', 's', (k) => k.ico(1.3, 1, '#c47a45', 0, .5, 0, { sy: .62, bump: .3, seed: 11, lo: .72, hi: 1.08 }));
  def('desertRockBig', 'b', (k) => k.ico(3.2, 1, '#b86f3f', 0, 1.6, 0, { sy: .7, bump: .28, seed: 19, lo: .7, hi: 1.1 }).ico(1.8, 0, '#c9824c', 2.6, .7, 1, { bump: .3, seed: 5 }));
  def('deadBush', 's', (k) => { for (let i = 0; i < 5; i++) k.box(.05, .9, .05, '#8a6a48', 0, .42, 0, { rz: .45 + i * .08, ry: i * 1.26 }); });
  def('arch', 'b', (k) => { const R = 6.5; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; k.ico(2.05 - Math.sin(a) * .5, 0, i % 2 ? '#c9824c' : '#b86f3f', Math.cos(a) * R, Math.sin(a) * R * 1.15 + 1.4, 0, { bump: .2, seed: 20 + i, sz: 1.45 }); } k.ico(2.6, 0, '#b86f3f', -R, .9, 0, { bump: .2, seed: 40, sy: .8, sz: 1.3 }).ico(2.6, 0, '#c9824c', R, .9, 0, { bump: .2, seed: 41, sy: .8, sz: 1.3 }); });

  // --- forêt et camping
  def('logPile', 's', (k) => { [[-.5, .26], [0, .26], [.5, .26], [-.25, .7], [.25, .7], [0, 1.12]].forEach(([z, y]) => k.cyl(.25, .25, 3, 6, '#7a5636', 0, y, z, { rz: HPI })); k.box(.12, 1.4, .12, '#5a3d28', 1.6, .7, .9).box(.12, 1.4, .12, '#5a3d28', 1.6, .7, -.9); });
  def('stump', 's', (k) => k.cyl(.42, .52, .55, 7, '#6b4a32', 0, .27, 0).cyl(.41, .41, .03, 7, '#c9a06a', 0, .56, 0));
  def('mushrooms', 's', (k) => { [[0, 0, 1], [.25, .12, .7], [-.18, .2, .55]].forEach(([x, z, s], i) => k.cyl(.05 * s, .07 * s, .28 * s, 5, '#f2e6cf', x, .14 * s, z).cone(.22 * s, .16 * s, 6, i === 2 ? '#c98a4a' : '#d8352b', x, .34 * s, z).box(.05 * s, .03, .05 * s, '#ffffff', x + .08 * s, .38 * s, z)); });
  def('fern', 's', (k) => { for (let i = 0; i < 6; i++) { const g = new T.BoxGeometry(.3, .03, 1.05); g.translate(0, 0, .52); g.rotateX(-.55); g.rotateY(i / 6 * TAU + .2); k.raw(g, i % 2 ? '#3f8f3a' : '#4c9a40', { y: .1 }); } });
  def('tent', 's', (k) => k.gable(2.4, 1.7, 2.8, '#888888', 0, 0, 0, { paint: 1, lo: .9, hi: 1.06 }).gable(.9, 1.0, .06, '#2f3338', 0, 0, 1.41).box(2.6, .04, 3, '#5a4a36', 0, .02, 0));
  def('campfire', 's', (k) => { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.ico(.2, 0, '#8a857b', Math.cos(a) * .6, .1, Math.sin(a) * .6, { bump: .3, seed: i + 3 }); } k.cyl(.07, .07, 1, 5, '#5a3d28', 0, .15, 0, { rz: HPI, ry: .3 }).cyl(.07, .07, 1, 5, '#5a3d28', 0, .15, 0, { rz: HPI, ry: 1.9 }).cone(.35, .9, 6, '#ff8a2a', 0, .6, 0, { glow: 1 }).cone(.2, .6, 5, '#ffe08a', 0, .55, 0, { glow: 1 }); });
  def('picnic', 's', (k) => k.box(1.9, .06, .8, '#b07a44', 0, .76, 0).box(1.9, .05, .3, '#b07a44', 0, .45, .62).box(1.9, .05, .3, '#b07a44', 0, .45, -.62).seg(-.7, 0, -.75, -.7, .74, 0, .08, '#8a6440').seg(-.7, 0, .75, -.7, .74, 0, .08, '#8a6440').seg(.7, 0, -.75, .7, .74, 0, .08, '#8a6440').seg(.7, 0, .75, .7, .74, 0, .08, '#8a6440'));
  def('logSeat', 's', (k) => k.cyl(.25, .25, 1.8, 6, '#7a5636', 0, .25, 0, { rz: HPI }));
  def('campSign', 's', (k) => k.box(.14, 1.9, .14, '#6b4a32', -1.0, .95, 0).box(.14, 1.9, .14, '#6b4a32', 1.0, .95, 0).box(2.4, .7, .1, '#4a7a3a', 0, 1.6, 0));
  def('watchtower', 'b', (k) => {
    const H = 7.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.seg(sx * 2.1, 0, sz * 2.1, sx * 1.65, H + 2.4, sz * 1.65, .26, '#6b4a32');
    for (const s of [-1, 1]) { k.seg(-2.0, .8, s * 2.0, 1.75, H - .4, s * 1.75, .13, '#5a3d28').seg(s * 2.0, .8, -2.0, s * 1.75, H - .4, 1.75, .13, '#5a3d28'); }
    k.box(4.2, .25, 4.2, '#8a6440', 0, H, 0);
    for (const s of [-1, 1]) k.box(4.2, .1, .1, '#8a6440', 0, H + 1, s * 2.05).box(.1, .1, 4.2, '#8a6440', s * 2.05, H + 1, 0);
    k.cone(3.3, 1.6, 4, '#5b3a2e', 0, H + 3.2, 0, { ry: Math.PI / 4 });
    k.seg(-.4, 0, 3.1, -.4, H, 2.1, .08, '#8a6440').seg(.4, 0, 3.1, .4, H, 2.1, .08, '#8a6440');
    for (let j = 0; j < 7; j++) { const t = (j + .5) / 7; k.seg(-.4, t * H, 3.1 - t, .4, t * H, 3.1 - t, .06, '#8a6440'); }
  });

  // --- côte
  def('umbrella', 's', (k) => k.cyl(.04, .04, 2.5, 5, '#f2efe6', 0, 1.25, 0, { open: 1 }).cone(1.45, .55, 8, '#888888', 0, 2.35, 0, { paint: 1, lo: .9, hi: 1.08 }).cone(.12, .16, 8, '#f2efe6', 0, 2.7, 0));
  def('towel', 's', (k) => k.box(1, .03, 1.9, '#888888', 0, .02, 0, { paint: 1 }).box(1, .035, .25, '#ffffff', 0, .02, .6));
  def('lounger', 's', (k) => k.box(.7, .08, 1.4, '#f2efe6', 0, .32, -.3).box(.7, .08, .8, '#f2efe6', 0, .55, .65, { rx: -.6 }).box(.64, .06, 1.3, '#888888', 0, .38, -.3, { paint: 1 }).box(.06, .3, .06, '#f2efe6', -.3, .15, -.9).box(.06, .3, .06, '#f2efe6', .3, .15, -.9).box(.06, .3, .06, '#f2efe6', -.3, .15, .3).box(.06, .3, .06, '#f2efe6', .3, .15, .3));
  def('surf', 's', (k) => k.ico(1, 1, '#888888', 0, 1.05, 0, { sx: .3, sy: 1.05, sz: .06, paint: 1, rz: .12 }).box(.05, 1.6, .07, '#ffffff', .1, 1.05, 0, { rz: .12 }));
  def('volley', 's', (k) => k.cyl(.06, .06, 2.6, 6, '#f2efe6', -4.5, 1.3, 0, { open: 1 }).cyl(.06, .06, 2.6, 6, '#f2efe6', 4.5, 1.3, 0, { open: 1 }).box(9, .9, .02, '#e8e8e0', 0, 2.0, 0).box(9, .08, .04, '#ffffff', 0, 2.45, 0));
  def('lifeguard', 'b', (k) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.seg(sx * 1.25, 0, sz * 1.25, sx * 1.0, 2.4, sz * 1.0, .14, '#f2efe6'); k.box(2.6, .2, 2.6, '#f2efe6', 0, 2.45, 0).box(2, 1.6, 1.8, '#d6322b', 0, 3.35, -.2).box(1.6, .6, .05, '#27313b', 0, 3.55, .72).box(2.6, .15, 2.4, '#f2efe6', 0, 4.22, -.1).box(.9, .08, 3.2, '#c9a06a', 0, 1.2, 2.5, { rx: .75 }).box(.05, 1.6, .05, '#f2efe6', 1.1, 5.0, -.9).box(.7, .45, .03, '#ffd23f', 1.45, 5.55, -.9); });
  def('palm', 'b', (k) => {
    let x = 0, y = 0;
    for (let i = 0; i < 5; i++) { const tilt = .08 + i * .07, len = 1.9, nx = x + Math.sin(tilt) * len, ny = y + Math.cos(tilt) * len; k.rod(x, y, 0, nx, ny, 0, .3 - i * .03, i % 2 ? '#8a6a48' : '#7a5c3e', { seg: 6 }); x = nx; y = ny; }
    for (let i = 0; i < 7; i++) { const g = new T.BoxGeometry(.8, .05, 3.0); g.translate(0, 0, 1.5); g.rotateX(.3 + (i % 2) * .22); g.rotateY(i / 7 * TAU + .3); k.raw(g, i % 2 ? '#3f9a3a' : '#4fae44', { x, y: y + .1, lo: .8, hi: 1.12 }); }
    for (let i = 0; i < 3; i++) k.oct(.19, '#6b4a2a', x + Math.cos(i * 2.1) * .3, y - .2, Math.sin(i * 2.1) * .3);
  });
  def('pier', 'b', (k) => k.box(3, .22, 4.05, '#b48a5a', 0, 0, 0).box(.18, .3, 4.05, '#8a6440', -1.45, -.22, 0).box(.18, .3, 4.05, '#8a6440', 1.45, -.22, 0).cyl(.16, .16, 5, 5, '#6b5340', -1.35, -2.5, 1.8, { open: 1 }).cyl(.16, .16, 5, 5, '#6b5340', 1.35, -2.5, 1.8, { open: 1 }));
  def('boat', 'b', (k) => k.box(1.7, .75, 3.6, '#888888', 0, .2, -.4, { paint: 1 }).box(1.2, .75, 1.2, '#888888', 0, .2, 1.4, { paint: 1, ry: Math.PI / 4 }).box(1.74, .1, 3.7, '#f2efe6', 0, .62, -.35).box(1.0, .8, 1.1, '#f2efe6', 0, 1.05, -.7).box(.8, .4, .05, '#27313b', 0, 1.2, -.13).box(.3, .6, .3, '#2b2f34', 0, .4, -2.35));
  def('buoy', 's', (k) => k.cone(.45, 1.2, 6, '#e84a2a', 0, .6, 0).cyl(.5, .5, .2, 6, '#f2efe6', 0, .25, 0));

  // --- routes
  def('pylon', 'b', (k) => k.cyl(.15, .2, 9.2, 6, '#6b4a32', 0, 4.6, 0, { open: 1 }).box(3.0, .18, .18, '#5a3d28', 0, 8.6, 0).box(.1, .22, .1, '#e8e8e0', -1.3, 8.8, 0).box(.1, .22, .1, '#e8e8e0', 1.3, 8.8, 0).box(.1, .22, .1, '#e8e8e0', 0, 9.3, 0).seg(-.9, 8.6, 0, 0, 7.7, 0, .08, '#5a3d28').seg(.9, 8.6, 0, 0, 7.7, 0, .08, '#5a3d28'));
  def('billboard', 'b', (k) => k.box(.35, 6.2, .35, '#5a5f66', -2.8, 3.1, -.25).box(.35, 6.2, .35, '#5a5f66', 2.8, 3.1, -.25).box(8.6, 4.6, .3, '#3b4047', 0, 7.6, -.1).box(8.6, .1, .9, '#5a5f66', 0, 5.25, .35).box(.25, .25, .25, '#fff1c4', -2, 10.0, .3, { glow: 1 }).box(.25, .25, .25, '#fff1c4', 2, 10.0, .3, { glow: 1 }));
  def('gas', 'b', (k) => {
    k.box(12, .7, 8, '#f4f4f2', 0, 5.25, 2).box(12.1, .3, 8.1, '#d6322b', 0, 4.95, 2).box(11, .04, 7, '#fff7dc', 0, 4.88, 2, { glow: 1 });
    for (const sx of [-4.5, 4.5]) for (const sz of [-.5, 4.5]) k.box(.4, 4.8, .4, '#e8e8e8', sx, 2.4, sz);
    for (const px of [-2.5, 2.5]) k.box(1.2, .2, 4.4, '#bdb8ad', px, .1, 2).box(.7, 1.6, .45, '#d6322b', px, 1.0, .9).box(.7, 1.6, .45, '#d6322b', px, 1.0, 3.1).box(.72, .3, .47, '#f4f4f2', px, 1.9, .9).box(.72, .3, .47, '#f4f4f2', px, 1.9, 3.1);
    k.box(10, 3.8, 6, '#ece6d8', 0, 1.9, -9).box(10.4, .35, 6.4, '#d6322b', 0, 3.95, -9).box(6.4, 2.0, .06, '#5d8fae', -1, 1.4, -5.98).box(1.4, 2.3, .07, '#3f6f8a', 3.4, 1.15, -5.98).box(4.2, .7, .08, '#ffffff', -1, 3.3, -5.96);
    k.box(1.2, 1.0, .7, '#f4f4f2', -4, .5, -5.3).box(.5, 1.2, .5, '#2d6fc4', 4.6, .6, -5.4);
    k.box(.4, 7, .4, '#5a5f66', 6.8, 3.5, 6.5).box(3.2, 1.8, .35, '#d6322b', 6.8, 7.4, 6.5);
  });
  def('bridge', 'b', (k) => { for (const sx of [-4.4, 4.4]) k.box(.55, .9, 11, '#a8a196', sx, .6, 0).box(.75, .18, 11.2, '#bdb6aa', sx, 1.12, 0).box(.85, 1.5, .85, '#9a9388', sx, .7, 5.6).box(.85, 1.5, .85, '#9a9388', sx, .7, -5.6); });

  // --- observatoire
  def('dish', 'b', (k) => {
    k.box(2.4, 1.2, 2.4, '#cfd4da', 0, .6, 0).cyl(.45, .6, 4.4, 8, '#b8bec6', 0, 3.4, 0).box(1.3, 1.1, 1.3, '#9aa3ab', 0, 5.8, 0);
    const tf = (g) => { g.rotateX(-.8); g.translate(0, 6.6, 0); return g; };
    const cap = new T.SphereGeometry(6, 14, 4, 0, TAU, 0, .62); cap.rotateX(Math.PI); cap.translate(0, 6, 0);
    k.raw(tf(flipGeo(cap)), '#f2f4f6', { lo: .9, hi: 1.05 }); k.raw(tf(cap), '#aeb5bd');
    const rim = 6 * Math.sin(.62), top = 3.2;
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.raw(tf(rodGeo(Math.cos(a) * rim, 6 - 6 * Math.cos(.62), Math.sin(a) * rim, 0, top, 0, .06, 4)), '#9aa3ab'); }
    k.raw(tf(new T.BoxGeometry(.5, .6, .5).translate(0, top, 0)), '#6b737b');
  });
  def('mast', 'b', (k) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.seg(Math.cos(a) * .8, 0, Math.sin(a) * .8, Math.cos(a) * .18, 16, Math.sin(a) * .18, .09, '#c8cdd3'); } for (let j = 1; j < 6; j++) { const h = j * 2.7, r = .8 - (.62 * h / 16); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, b = (i + 1) / 3 * TAU; k.seg(Math.cos(a) * r, h, Math.sin(a) * r, Math.cos(b) * r, h, Math.sin(b) * r, .06, '#d6322b'); } } k.box(.3, .3, .3, '#ff3a2a', 0, 16.15, 0, { glow: 1 }).box(.9, .6, .08, '#e8e8e8', 0, 11, .4); });

  // ailes de moulin (maillage instancié animé)
  function sailsGeometry() {
    const k = new Kit();
    for (let i = 0; i < 4; i++) {
      const a = i * HPI;
      k.raw(new T.BoxGeometry(.18, 6.6, .14).translate(0, 3.4, 0).rotateZ(a), '#6b4a32');
      k.raw(new T.BoxGeometry(1.4, 5, .06).translate(.8, 3.9, -.05).rotateZ(a), '#efe6d2');
      for (let j = 0; j < 4; j++) k.raw(new T.BoxGeometry(1.45, .08, .1).translate(.8, 1.9 + j * 1.35, .0).rotateZ(a), '#7a5636');
    }
    k.raw(new T.CylinderGeometry(.38, .38, .5, 8).rotateX(HPI), '#5b3a2e');
    const pk = pack(k.s), g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pk.P, 3)); g.setAttribute('normal', new T.BufferAttribute(pk.N, 3)); g.setAttribute('color', new T.BufferAttribute(pk.C, 3));
    g.computeBoundingSphere(); return g;
  }

  /* ================================================== lots fusionnés (chunks) */
  function Batch() { this.l = []; this.n = 0; }
  Batch.prototype.add = function (pk, x, y, z, yaw, sx, sy, sz, paint) { if (!pk || !pk.n) return; this.l.push(pk, x, y, z, yaw, sx, sy, sz, paint); this.n += pk.n; };
  Batch.prototype.geometry = function () {
    const n = this.n; if (!n) return null;
    const P = new Float32Array(n * 3), N = new Int8Array(n * 3), Cc = new Uint8Array(n * 3), L = this.l;
    let o = 0;
    for (let q = 0; q < L.length; q += 9) {
      const pk = L[q], x = L[q + 1], y = L[q + 2], z = L[q + 3], yaw = L[q + 4], sx = L[q + 5], sy = L[q + 6], sz = L[q + 7], paint = L[q + 8];
      const c = Math.cos(yaw), s = Math.sin(yaw), ix = 1 / sx, iy = 1 / sy, iz = 1 / sz, PP = pk.P, NN = pk.N, CC = pk.C;
      for (let i = 0; i < pk.n; i++, o++) {
        const i3 = i * 3, o3 = o * 3, px = PP[i3] * sx, py = PP[i3 + 1] * sy, pz = PP[i3 + 2] * sz;
        P[o3] = x + px * c + pz * s; P[o3 + 1] = y + py; P[o3 + 2] = z - px * s + pz * c;
        let nx = NN[i3] * ix, ny = NN[i3 + 1] * iy, nz = NN[i3 + 2] * iz; const l = 127 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        nx *= l; ny *= l; nz *= l;
        N[o3] = Math.round(nx * c + nz * s); N[o3 + 1] = Math.round(ny); N[o3 + 2] = Math.round(-nx * s + nz * c);
        let r, g, b;
        if (paint && pk.Mk[i]) { const k = pk.K[i]; r = paint.r * k; g = paint.g * k; b = paint.b * k; } else { r = CC[i3]; g = CC[i3 + 1]; b = CC[i3 + 2]; }
        Cc[o3] = r >= 1 ? 255 : r * 255 + .5 | 0; Cc[o3 + 1] = g >= 1 ? 255 : g * 255 + .5 | 0; Cc[o3 + 2] = b >= 1 ? 255 : b * 255 + .5 | 0;
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3, true)); geo.setAttribute('color', new T.BufferAttribute(Cc, 3, true));
    geo.computeBoundingSphere(); this.l = null; return geo;
  };
  // segments fins (câbles) : deux quads croisés
  function wirePack(ax, ay, az, bx, by, bz, t, hex) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, px = -dz / L * t, pz = dx / L * t, P = [], N = [];
    const quad = (a, b, cc, d, nx, ny, nz) => { for (const v of [a, b, cc, a, cc, d]) { P.push(v[0], v[1], v[2]); N.push(nx, ny, nz); } };
    quad([ax - px, ay, az - pz], [bx - px, by, bz - pz], [bx + px, by, bz + pz], [ax + px, ay, az + pz], 0, 1, 0);
    quad([ax, ay - t, az], [bx, by - t, bz], [bx, by + t, bz], [ax, ay + t, az], px / t, 0, pz / t);
    const n = P.length / 3, base = C(hex), Cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { Cc[i * 3] = base.r; Cc[i * 3 + 1] = base.g; Cc[i * 3 + 2] = base.b; }
    return { P: new Float32Array(P), N: new Float32Array(N), C: Cc, K: new Float32Array(n).fill(1), Mk: new Uint8Array(n), n };
  }

  /* Rubans posés sur le sol (champs, sentiers, parkings, ruisseaux). */
  function Ribbons(uv) { this.p = []; this.c = []; this.u = uv ? [] : null; }
  Ribbons.prototype.tri = function (a, b, c, ca, cb, cc) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); this.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); };
  Ribbons.prototype.quad = function (a, b, c, d, col, col2) { const k = col2 || col; this.tri(a, b, c, col, col, k); this.tri(a, c, d, col, k, k); };
  Ribbons.prototype.mesh = function (mat) {
    if (!this.p.length) return null;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    if (this.u) g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; m.userData.shared = true; this.p = this.c = this.u = null; return m;
  };

  /* ================================================================= textes */
  const ADS = [
    { t: 'BURGER BRISE', s: 'Le plus gros de l’île !', a: '#ff9a2a', b: '#d6322b', i: 'burger' },
    { t: 'SODA CORAIL', s: 'Pétillant comme la mer', a: '#ff6f8f', b: '#2fb7b0', i: 'can' },
    { t: 'PIZZA DU PORT', s: 'Livrée en planeur en 30 min', a: '#ffd23f', b: '#c8452e', i: 'pizza' },
    { t: 'GLACES LAGUNE', s: '3 boules, 1 sourire', a: '#8fd3ff', b: '#ff7ad9', i: 'ice' },
    { t: 'RADIO MARÉE 98.4', s: 'Le son de toute l’île', a: '#6a5ad8', b: '#2d6fc4', i: 'wave' },
    { t: 'TACOS DES DUNES', s: 'Attention, ça pique !', a: '#f2c14e', b: '#c4673a', i: 'sun' },
    { t: 'CAMPING DES PINS', s: 'Des nuits sous les étoiles', a: '#4fae44', b: '#1f5f3a', i: 'pine' },
    { t: 'AZUR AUTO', s: 'Location de voitures • 2 km', a: '#f4f4f2', b: '#2d6fc4', i: 'car' }
  ];
  const EXTRA = [['STATION HORIZON', '#d6322b'], ['CAMPING DES PINS', '#3f7a3a'], ['PLAGE SURVEILLÉE', '#e8a21f'], ['ŒUFS FRAIS', '#8e5a2a']];
  const LBL = { station: S.regions.length, camping: S.regions.length + 1, plage: S.regions.length + 2, oeufs: S.regions.length + 3 };
  const AW = 1024, AH = 1536, ADH = 1024;
  const atlasCache = {};
  const FONT = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';
  function fitText(g, text, max, px, weight) { let f = px; g.font = `${weight || 800} ${f}px ${FONT}`; while (g.measureText(text).width > max && f > 10) { f -= 2; g.font = `${weight || 800} ${f}px ${FONT}`; } }
  function icon(g, kind, x, y, r) {
    g.save(); g.translate(x, y); g.lineJoin = 'round';
    const fill = (c) => { g.fillStyle = c; g.fill(); };
    g.beginPath(); g.arc(0, 0, r, 0, TAU); fill('rgba(255,255,255,.92)');
    if (kind === 'burger') { g.beginPath(); g.ellipse(0, -r * .28, r * .62, r * .3, 0, Math.PI, 0); fill('#e0943a'); g.fillStyle = '#3f8f3a'; g.fillRect(-r * .64, -r * .22, r * 1.28, r * .14); g.fillStyle = '#7a3a22'; g.fillRect(-r * .6, -r * .06, r * 1.2, r * .22); g.beginPath(); g.ellipse(0, r * .26, r * .62, r * .2, 0, 0, Math.PI); fill('#e0943a'); }
    else if (kind === 'can') { g.fillStyle = '#ff6f8f'; g.fillRect(-r * .32, -r * .6, r * .64, r * 1.2); g.fillStyle = '#fff'; g.fillRect(-r * .32, -r * .12, r * .64, r * .18); }
    else if (kind === 'pizza') { g.beginPath(); g.moveTo(-r * .6, -r * .45); g.lineTo(r * .6, -r * .45); g.lineTo(0, r * .65); g.closePath(); fill('#f2c14e'); for (const [a, b] of [[-.2, -.2], [.2, -.15], [0, .2]]) { g.beginPath(); g.arc(a * r, b * r, r * .1, 0, TAU); fill('#c8452e'); } }
    else if (kind === 'ice') { g.beginPath(); g.moveTo(-r * .3, 0); g.lineTo(r * .3, 0); g.lineTo(0, r * .7); g.closePath(); fill('#d9a25a'); for (const [a, b, c] of [[-.18, -.12, '#ff7ad9'], [.18, -.12, '#8fd3ff'], [0, -.42, '#fff2a8']]) { g.beginPath(); g.arc(a * r, b * r, r * .24, 0, TAU); fill(c); } }
    else if (kind === 'wave') { g.strokeStyle = '#2d6fc4'; g.lineWidth = r * .12; for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i <= 20; i++) { const u = -0.6 + i * .06; g.lineTo(u * r, (k - 1) * r * .3 + Math.sin(i * .9) * r * .1); } g.stroke(); } }
    else if (kind === 'sun') { g.beginPath(); g.arc(0, 0, r * .32, 0, TAU); fill('#f29a1e'); g.strokeStyle = '#f29a1e'; g.lineWidth = r * .08; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * .45, Math.sin(a) * r * .45); g.lineTo(Math.cos(a) * r * .68, Math.sin(a) * r * .68); g.stroke(); } }
    else if (kind === 'pine') { for (const [yy, w] of [[-.55, .3], [-.25, .45], [.08, .6]]) { g.beginPath(); g.moveTo(0, yy * r - r * .1); g.lineTo(w * r, yy * r + r * .32); g.lineTo(-w * r, yy * r + r * .32); g.closePath(); fill('#2f7536'); } g.fillStyle = '#6b4a32'; g.fillRect(-r * .07, r * .4, r * .14, r * .22); }
    else if (kind === 'car') { g.fillStyle = '#d6322b'; g.fillRect(-r * .62, -r * .05, r * 1.24, r * .32); g.fillRect(-r * .34, -r * .3, r * .68, r * .28); for (const a of [-.36, .36]) { g.beginPath(); g.arc(a * r, r * .3, r * .14, 0, TAU); fill('#1c1e21'); } }
    g.restore();
  }
  function atlas(low) {
    const key = low ? 'lo' : 'hi';
    if (atlasCache[key]) return atlasCache[key];
    const k = low ? .5 : 1, cv = document.createElement('canvas'); cv.width = AW * k; cv.height = AH * k;
    const g = cv.getContext('2d'); g.scale(k, k);
    ADS.forEach((ad, i) => {
      const x = (i % 2) * 512, y = Math.floor(i / 2) * 256, gr = g.createLinearGradient(x, y, x + 512, y + 256);
      gr.addColorStop(0, ad.a); gr.addColorStop(1, ad.b); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
      g.fillStyle = 'rgba(255,255,255,.12)'; for (let s = 0; s < 6; s++) g.fillRect(x + s * 96 - 40, y, 30, 256);
      g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(x + 8, y + 8, 496, 240);
      icon(g, ad.i, x + 100, y + 128, 74);
      const dark = ad.a === '#f4f4f2';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      fitText(g, ad.t, 318, 78); g.lineWidth = 8; g.strokeStyle = dark ? '#ffffff' : 'rgba(20,26,42,.75)'; g.strokeText(ad.t, x + 186, y + 104); g.fillStyle = dark ? '#2d6fc4' : '#ffffff'; g.fillText(ad.t, x + 186, y + 104);
      fitText(g, ad.s, 316, 38, 600); g.fillStyle = dark ? '#3b4047' : '#fff8e0'; g.fillText(ad.s, x + 188, y + 172);
    });
    const names = S.regions.map((r) => r.name.toLocaleUpperCase('fr-FR'));
    const labels = names.map((n) => [n, '#2d6fc4']).concat(EXTRA);
    labels.forEach(([text, bg], i) => {
      const x = (i % 4) * 256, y = ADH + Math.floor(i / 4) * 64;
      g.fillStyle = bg; g.fillRect(x, y, 256, 64); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, 248, 56);
      g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, text, 232, 40); g.fillStyle = '#ffffff'; g.fillText(text, x + 128, y + 34);
    });
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new T.MeshStandardMaterial({ map: tex, roughness: .7, metalness: 0, emissive: new T.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: .22, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    mat.userData.ch1Shared = true;
    return (atlasCache[key] = mat);
  }
  const adUV = (i) => { const x = (i % 2) * 512, y = Math.floor(i / 2) * 256; return [x / AW, 1 - (y + 256) / AH, (x + 512) / AW, 1 - y / AH]; };
  const lblUV = (i) => { const x = (i % 4) * 256, y = ADH + Math.floor(i / 4) * 64; return [x / AW, 1 - (y + 64) / AH, (x + 256) / AW, 1 - y / AH]; };

  /* ============================================================ espace libre */
  function Space(cell) { this.c = cell; this.m = new Map(); }
  Space.prototype._ins = function (e, x0, z0, x1, z1) {
    const c = this.c;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
      const k = (ix + 4096) * 8192 + (iz + 4096); let a = this.m.get(k); if (!a) this.m.set(k, (a = [])); a.push(e);
    }
  };
  Space.prototype.circle = function (x, z, r) { this._ins({ x, z, r }, x - r, z - r, x + r, z + r); };
  Space.prototype.rect = function (x, z, hw, hd, yaw) { const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), ex = Math.abs(hw * c) + Math.abs(hd * s), ez = Math.abs(hw * s) + Math.abs(hd * c); this._ins({ x, z, hw, hd, c, s }, x - ex, z - ez, x + ex, z + ez); };
  Space.prototype.hit = function (x, z, r) {
    const c = this.c;
    for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++) for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
      const a = this.m.get((ix + 4096) * 8192 + (iz + 4096)); if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const e = a[i], dx = x - e.x, dz = z - e.z;
        if (e.hw == null) { const rr = r + e.r; if (dx * dx + dz * dz < rr * rr) return true; }
        else { const lx = dx * e.c - dz * e.s, lz = dx * e.s + dz * e.c, qx = Math.max(0, Math.abs(lx) - e.hw), qz = Math.max(0, Math.abs(lz) - e.hd); if ((qx === 0 && qz === 0) || qx * qx + qz * qz < r * r) return true; }
      }
    }
    return false;
  };
  const POI_R = { lac: 95, volcan: 150, givre: 70, jade: 72, canyon: 62, parc: 46, depot: 44, carriere: 42, crater: 40, ruins: 34, camp: 26, watch: 22, wind: 40, phare: 30, epave: 30 };

  /* ===================================================== construction du décor */
  const CHUNK = 220, NCH = Math.ceil(HALF * 2 / CHUNK);
  const chunkOf = (x, z) => clamp(Math.floor((x + HALF) / CHUNK), 0, NCH - 1) * NCH + clamp(Math.floor((z + HALF) / CHUNK), 0, NCH - 1);
  const CARS = ['#d6322b', '#2d6fc4', '#f2f2f2', '#3b4047', '#ffd23f', '#4fae44', '#ff8a3c', '#8fd3ff', '#b46cff', '#1f3f6a'];
  const BOATS = ['#2f6fa6', '#c8452e', '#f2f2f2', '#2b8f6f', '#ffd23f'];
  const BEACH = ['#ff4f6d', '#2d6fc4', '#ffd23f', '#4fae44', '#ff8a3c', '#b46cff', '#2fb7b0'];
  const FIELD = {
    wheat: ['#d9b64e', '#c49a3c', 1.1, .5], plowed: ['#8a6040', '#6e4a30', .9, .6], veg: ['#4f9a3a', '#7a5638', .8, .7],
    corn: ['#5f8f36', '#7a5638', 1.0, 1.0], harvest: ['#d8c27a', '#cbb06a', 1.2, .6], lavender: ['#9a7bd0', '#5f8f46', .9, .5], sunflower: ['#e8b92a', '#5f8f36', 1.0, 1.0]
  };

  function create(env, w, quality) {
    const t0 = (root.performance && performance.now()) || 0;
    const low = quality === 'low', D = low ? .45 : 1;
    const ground = env.surfaceHeight && env.terrainPositions ? (x, z) => env.surfaceHeight(x, z) : (x, z) => S.heightAt(x, z);
    const gmin = (x, z, r) => Math.min(ground(x, z), ground(x + r, z), ground(x - r, z), ground(x, z + r), ground(x, z - r));
    const batches = new Map(), glow = new Batch(), signs = [], decal = new Ribbons(false), water = new Ribbons(true), sails = [], count = {}, where = {};
    const occ = new Space(8), solid = new Space(16), flora = new Space(16);
    const houses = new Map();
    for (const o of w.objects || []) {
      if (o.dead) continue;
      if (o.type === 'house') { solid.rect(o.x, o.z, o.w + 1.8, (o.d || o.w) + 1.8, o.yaw || 0); if (o.door) solid.circle(o.door.x, o.door.z, 3.2); if (!o.floorChest) houses.set(Math.round(o.x) + ',' + Math.round(o.z), o); }
      else if (o.type !== 'chest' || !o.floorChest) solid.circle(o.x, o.z, (o.type === 'chest' ? .8 : (o.w || 1)) + .6);
    }
    for (const f of w.flora || []) flora.circle(f.x, f.z, f.k === 2 ? f.r * 1.1 + .3 : 1.3);
    for (const v of w.vehicles || []) solid.circle(v.x, v.z, 4.2);
    for (const l of w.loot || []) if (!l.dead) solid.circle(l.x, l.z, 1.1);
    for (const p of S.pois || []) solid.circle(p.x, p.z, POI_R[p.id] || 42);
    const free = (x, z, r, noFlora) => !occ.hit(x, z, r) && !solid.hit(x, z, r) && (noFlora || !flora.hit(x, z, r));
    const take = (x, z, r) => occ.circle(x, z, r);
    const roadSegs = []; for (const line of S.roads || []) for (let i = 1; i < line.length; i++) roadSegs.push([line[i - 1], line[i]]);
    const nearestRoad = (x, z) => {
      let best = null;
      for (const [a, b] of roadSegs) { const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1), px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz); if (!best || d < best.d) { const L = Math.sqrt(L2); best = { d, x: px, z: pz, dx: dx / L, dz: dz / L }; } }
      return best || { d: Infinity, x, z, dx: 1, dz: 0 };
    };
    const roadDist = (x, z) => nearestRoad(x, z).d;
    const inland = (x, z, m) => S.coastDistance(x, z) < M.shoreStart - (m || 0) && !S.isWater(x, z) && S.heightAt(x, z) > SEA + 1 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r * 1.5;
    const flat = (x, z, r, d) => { const a = S.heightAt(x - r, z - r), b = S.heightAt(x + r, z - r), c = S.heightAt(x - r, z + r), e = S.heightAt(x + r, z + r), f = S.heightAt(x, z); return Math.max(a, b, c, e, f) - Math.min(a, b, c, e, f) < d; };
    const pad = (x, z, m) => S.townPad(x, z, m);
    const tw = (x, z, yaw, lx, lz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return { x: x + lx * c + lz * s, z: z - lx * s + lz * c }; };

    const THIN = { bench: 1, bin: 1, flowerBed0: 1, flowerBed1: 1, barrels: 1, crates: 1, towel: 1, lounger: 1, hydrant: 1, logSeat: 1 }, thin = {};
    function put(name, x, z, yaw, o) {
      o = o || {};
      if (low && THIN[name] && (thin[name] = (thin[name] | 0) + 1) % 2) return o.y != null ? o.y : ground(x, z);
      const pf = prefab(name), y = o.y != null ? o.y : (o.r ? gmin(x, z, o.r) : ground(x, z)) + (o.dy || 0);
      const s = o.s || 1, sx = o.sx || s, sy = o.sy || s, sz = o.sz || s, key = chunkOf(x, z) * 2 + (pf.tier === 'b' ? 1 : 0);
      let b = batches.get(key); if (!b) batches.set(key, (b = new Batch()));
      const paint = o.paint ? C(o.paint) : null;
      b.add(pf.pk.s, x, y, z, yaw || 0, sx, sy, sz, paint); glow.add(pf.pk.g, x, y, z, yaw || 0, sx, sy, sz, paint);
      count[name] = (count[name] || 0) + 1;
      const wl = where[name] || (where[name] = []); if (wl.length < 4) wl.push([Math.round(x), Math.round(z), +(yaw || 0).toFixed(2)]);
      return y;
    }
    function wire(ax, ay, az, bx, by, bz, sag) {
      const key = chunkOf((ax + bx) / 2, (az + bz) / 2) * 2 + 1; let b = batches.get(key); if (!b) batches.set(key, (b = new Batch()));
      let px = ax, py = ay, pz = az;
      for (let i = 1; i <= 4; i++) { const t = i / 4, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - sag * 4 * t * (1 - t); b.add(wirePack(px, py, pz, x, y, z, .035, '#2b2f34'), 0, 0, 0, 0, 1, 1, 1, null); px = x; py = y; pz = z; }
    }
    // panneau texturé : (lx,ly,lz) local au modèle posé en (x,y,z,yaw)
    function sign(uv, x, y, z, yaw, lx, ly, lz, w2, h2, back) { const p = tw(x, z, yaw, lx, lz); signs.push({ uv, x: p.x, y: y + ly, z: p.z, yaw: back ? yaw + Math.PI : yaw, w: w2, h: h2 }); }
    // décalcomanies au sol
    const dcol = new T.Color();
    const gp = (x, z, lift) => [x, ground(x, z) + lift, z];
    function patch(cx, cz, hw, hd, yaw, step, fn, lift) {
      const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => gp(cx + lx * c + lz * s, cz - lx * s + lz * c, lift);
      for (let x0 = -hw; x0 < hw - 1e-3; x0 += step) for (let z0 = -hd; z0 < hd - 1e-3; z0 += step) {
        const x1 = Math.min(hw, x0 + step), z1 = Math.min(hd, z0 + step), col = fn((x0 + x1) / 2, (z0 + z1) / 2); if (!col) continue;
        decal.quad(P(x0, z0), P(x0, z1), P(x1, z1), P(x1, z0), col);
      }
    }
    // disque posé sur le sol (anneaux de ~3 m pour suivre le relief)
    function disc(cx, cz, r, hex, lift, edgeHex) {
      const n = 20, rings = Math.max(1, Math.ceil(r / 3)), A = C(hex), B = edgeHex ? C(edgeHex) : A, P = (rr, a) => gp(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, lift);
      for (let k = 0; k < rings; k++) {
        const r0 = r * k / rings, r1 = r * (k + 1) / rings, c0 = A.clone().lerp(B, k / rings), c1 = A.clone().lerp(B, (k + 1) / rings);
        for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; if (k === 0) decal.tri(P(0, 0), P(r1, a1), P(r1, a0), c0, c1, c1); else decal.quad(P(r0, a0), P(r0, a1), P(r1, a1), P(r1, a0), c0, c1); }
      }
    }
    function stripes(cx, cz, hw, hd, yaw, ca, cb, wa, wb, lift, R) {
      const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => gp(cx + lx * c + lz * s, cz - lx * s + lz * c, lift), A = C(ca), B = C(cb);
      let x0 = -hw, alt = 0;
      while (x0 < hw - 1e-3) {
        const x1 = Math.min(hw, x0 + (alt ? wb : wa));
        for (let z0 = -hd; z0 < hd - 1e-3; z0 += 6) { const z1 = Math.min(hd, z0 + 6); dcol.copy(alt ? B : A).multiplyScalar(.93 + R() * .1); decal.quad(P(x0, z0), P(x0, z1), P(x1, z1), P(x1, z0), dcol.clone()); }
        x0 = x1; alt ^= 1;
      }
    }
    function strip(R, pts, width, hex, lift, jitter, target, uvScale) {
      const col = C(hex), tgt = target || decal; let vacc = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (L < .05) continue;
        const wa = (a.w || width) / 2, wb = (b.w || width) / 2, na = { x: -dz / L, z: dx / L };
        const A0 = gp(a.x - na.x * wa, a.z - na.z * wa, lift), A1 = gp(a.x + na.x * wa, a.z + na.z * wa, lift), B0 = gp(b.x - na.x * wb, b.z - na.z * wb, lift), B1 = gp(b.x + na.x * wb, b.z + na.z * wb, lift);
        const ca = (a.col || col).clone().multiplyScalar(1 - jitter + R() * jitter * 2), cb = (b.col || col).clone().multiplyScalar(1 - jitter + R() * jitter * 2);
        tgt.tri(A0, B1, B0, ca, cb, cb); tgt.tri(A0, A1, B1, ca, ca, cb);
        if (tgt.u) { const v0 = vacc / (uvScale || 5), v1 = (vacc + L) / (uvScale || 5); tgt.u.push(0, v0, 1, v1, 0, v1, 0, v0, 1, v0, 1, v1); }
        vacc += L;
      }
    }
    const streamInfo = [];

    /* ---------------------------------------------- ruisseaux, cascades, ponts */
    (function streams() {
      const cands = [];
      for (let x = -HALF + 50; x < HALF; x += 60) for (let z = -HALF + 50; z < HALF; z += 60) {
        const h = S.heightAt(x, z); if (h < 18 || !inland(x, z, 70)) continue;
        const zw = S.zoneWeights(x, z); if (zw.volcano > .15 || zw.desert > .3) continue;
        if (pad(x, z, 50) || roadDist(x, z) < 25 || solid.hit(x, z, 20)) continue;
        cands.push({ x, z, h: h + (zw.snow > .5 ? -40 : 0) });
      }
      cands.sort((a, b) => b.h - a.h);
      const chosen = [], maxN = low ? 4 : 7;
      for (const c0 of cands) {
        if (chosen.length >= maxN) break;
        if (chosen.some((q) => Math.hypot(q.x - c0.x, q.z - c0.z) < 230)) continue;
        const pts = trace(c0.x, c0.z); if (!pts || pts.length < 24) continue;
        chosen.push(c0); drawStream(pts); streamInfo.push([Math.round(c0.x), Math.round(c0.z), pts.length, pts.end, Math.round(pts[pts.length >> 1].x), Math.round(pts[pts.length >> 1].z)]);
      }
      function trace(x, z) {
        const pts = [{ x, z, h: S.heightAt(x, z) }]; let h = pts[0].h, dx = 0, dz = 0, end = 'pond';
        for (let i = 0; i < 170; i++) {
          let best = null;
          for (let a = 0; a < 16; a++) { const an = a / 16 * TAU, cx = Math.cos(an), cz = Math.sin(an), nx = x + cx * 5, nz = z + cz * 5, nh = S.heightAt(nx, nz), sc = nh - (dx * cx + dz * cz) * .35; if (!best || sc < best.sc) best = { x: nx, z: nz, h: nh, sc, cx, cz }; }
          if (best.h > h + .02) break;
          if (pad(best.x, best.z, 8) || solid.hit(best.x, best.z, 3)) break;
          x = best.x; z = best.z; h = best.h; dx = best.cx; dz = best.cz; pts.push({ x, z, h });
          if (S.isWater(x, z) || h < SEA + .1 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.05) { end = 'sea'; break; }
        }
        pts.end = end; return pts;
      }
      function drawStream(pts) {
        const R = rng(hstr(pts[0].x + ',' + pts[0].z)), WATER = C('#3d9fd2'), FOAM = C('#e6f6ff');
        let run = [], bank = [], crossing = false;
        const flush = () => { if (run.length > 1) { strip(R, bank, 0, '#6d7d43', .1, .05); strip(R, run, 0, '#3d9fd2', .15, 0, water, 4); } run = []; bank = []; };
        pts.forEach((p, i) => {
          const wdt = 1.8 + Math.min(2.6, i * .02), prev = pts[Math.max(0, i - 1)], slope = Math.max(0, (prev.h - p.h) / 5), foam = smooth(.22, .85, slope);
          const rr = nearestRoad(p.x, p.z);
          take(p.x, p.z, wdt / 2 + 2);
          if (rr.d < 5.5) {
            if (!crossing) { crossing = true; flush(); if (rr.d < 3) { const yy = put('bridge', rr.x, rr.z, Math.atan2(rr.dx, rr.dz), { r: 3 }); take(rr.x, rr.z, 7); void yy; } }
            return;
          }
          crossing = false;
          run.push({ x: p.x, z: p.z, w: wdt, col: WATER.clone().lerp(FOAM, foam * .8) });
          bank.push({ x: p.x, z: p.z, w: wdt + 2.4 });
        });
        flush();
        const last = pts[pts.length - 1];
        if (pts.end === 'pond') {
          const r = 6 + R() * 3;
          disc(last.x, last.z, r + 1.8, '#6d7d43', .1);
          { const n = 20, P = (rr, a) => gp(last.x + Math.cos(a) * rr, last.z + Math.sin(a) * rr, .15), A = C('#2f86bd'), B = C('#4aa6d6'); for (let k = 0; k < 3; k++) { const r0 = r * k / 3, r1 = r * (k + 1) / 3; for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, u0 = Math.cos(a0) * r0 / 4, w0 = Math.sin(a0) * r0 / 4; if (k === 0) water.tri(P(0, 0), P(r1, a1), P(r1, a0), A, B, B); else { water.tri(P(r0, a0), P(r1, a1), P(r1, a0), A, B, B); water.tri(P(r0, a0), P(r0, a1), P(r1, a1), A, A, B); } water.u.push(u0, w0, u0 + .5, w0, u0, w0 + .5); if (k) water.u.push(u0, w0, u0 + .5, w0 + .5, u0 + .5, w0); } } }
          take(last.x, last.z, r + 2.5);
          for (let i = 0; i < (low ? 2 : 5); i++) { const a = R() * TAU, d = r + 1.2; if (free(last.x + Math.cos(a) * d, last.z + Math.sin(a) * d, .8, true)) put('fern', last.x + Math.cos(a) * d, last.z + Math.sin(a) * d, R() * TAU, { s: 1.2 }); }
        }
      }
    })();

    /* ---------------------------------------------- sentiers vers les lieux nommés */
    function path(ax, az, bx, bz, seed) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / 5)), px = -(bz - az) / L, pz = (bx - ax) / L, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n, wob = Math.sin(t * Math.PI * 2.2 + seed) * Math.min(4, L * .05) * Math.sin(Math.PI * t), x = ax + (bx - ax) * t + px * wob, z = az + (bz - az) * t + pz * wob; if (pad(x, z, 4) || S.isWater(x, z)) return false; pts.push({ x, z }); }
      const R = rng(seed * 977 | 0);
      strip(R, pts, 3.6, '#86a04a', .06, .05); strip(R, pts, 2.2, '#a78558', .075, .07);
      for (const p of pts) take(p.x, p.z, 1.8);
      return true;
    }
    (S.pois || []).forEach((p, i) => {
      if (['volcan', 'givre', 'canyon'].indexOf(p.id) >= 0) return;
      const q = nearestRoad(p.x, p.z), rad = (POI_R[p.id] || 40) * .45; if (q.d < rad + 18 || q.d > 330) return;
      const ux = (q.x - p.x) / q.d, uz = (q.z - p.z) / q.d; path(p.x + ux * rad, p.z + uz * rad, q.x - ux * 3, q.z - uz * 3, i + 1);
    });

    /* ---------------------------------------------- villes */
    const LAMP = { citadel: 'lampCity', observatory: 'lampCity', port: 'lampPort', lagoon: 'lampPort', desert: 'lampDesert' };
    S.regions.forEach((r, ri) => {
      const key = r.layout || r.style, gd = S.districtGrid && S.districtGrid[key], n = S.districts && S.districts[key];
      if (!gd || !n) return;
      const cols = gd.cols, rows = Math.ceil(n / cols), sx = gd.sx, sz = gd.sz, st = r.style, hamlet = r.layout === 'hamlet';
      const left = r.x - cols * sx / 2, right = r.x + cols * sx / 2, top = r.z - rows * sz / 2, bottom = r.z + rows * sz / 2;
      const city = st === 'citadel', urban = city || st === 'port', half = city ? 5.2 : 3.8, lampK = LAMP[st] || 'lampWood';
      const R = rng(hstr(r.name) ^ 0x51ed), padH = S.heightAt(r.x, r.z);
      const level = (p) => Math.abs(S.heightAt(p.x, p.z) - padH) < .6;
      const mX = (r.padW || 40) - cols * sx / 2, mZ = (r.padD || 40) - rows * sz / 2;
      const sides = [{ ax: 'x', a: left, b: right, c: top, nx: 0, nz: -1, m: mZ }, { ax: 'x', a: left, b: right, c: bottom, nx: 0, nz: 1, m: mZ }, { ax: 'z', a: top, b: bottom, c: left, nx: -1, nz: 0, m: mX }, { ax: 'z', a: top, b: bottom, c: right, nx: 1, nz: 0, m: mX }];
      sides.forEach((sd, si) => {
        const at = (t, off) => (sd.ax === 'x' ? { x: t, z: sd.c + sd.nz * off } : { x: sd.c + sd.nx * off, z: t });
        const face = Math.atan2(-sd.nx, -sd.nz), alongX = sd.ax === 'x' ? 0 : HPI, depth = sd.m + 5 - half, step = city ? 14 : 17;
        const okRoad = (p, m) => roadDist(p.x, p.z) > (m || 6.5) && level(p);
        // parking (villes, port, observatoire, désert)
        let lot = null;
        if ((urban || st === 'observatory' || st === 'desert') && depth >= 7.5 && R() < (urban ? .8 : .5)) {
          const slots = 5 + (R() * 4 | 0), Lh = slots * 1.45, t = sd.a + Lh + 4 + R() * Math.max(1, sd.b - sd.a - 2 * Lh - 8), p = at(t, half + 4.6);
          let ok = true; for (let j = -1; j <= 1; j++) { const q = at(t + j * Lh, half + 4.6); if (!okRoad(q, 8) || !free(q.x, q.z, 2.6, true)) ok = false; }
          if (ok) {
            lot = { t, Lh };
            patch(p.x, p.z, sd.ax === 'x' ? Lh + .4 : 3.1, sd.ax === 'x' ? 3.1 : Lh + .4, 0, 3, () => C('#5b6066'), .07);
            for (let j = 0; j <= slots; j++) { const q = at(t - Lh + j * 2.9, half + 4.6); patch(q.x, q.z, sd.ax === 'x' ? .07 : 2.6, sd.ax === 'x' ? 2.6 : .07, 0, 6, () => C('#f2efe4'), .085); }
            for (let j = 0; j < slots; j++) {
              if (R() < .3) continue; const q = at(t - Lh + 1.45 + j * 2.9, half + 4.4), van = R() < .22;
              put(van ? 'van' : 'car', q.x, q.z, face + (R() < .5 ? 0 : Math.PI) + (R() - .5) * .06, { paint: CARS[(R() * CARS.length) | 0], r: 2 });
            }
            occ.rect(p.x, p.z, sd.ax === 'x' ? Lh + 1 : 3.4, sd.ax === 'x' ? 3.4 : Lh + 1, 0);
          }
        }
        let k = 0;
        for (let t = sd.a + 6; t <= sd.b - 5; t += step, k++) {
          const p = at(t, half + .7);
          if (okRoad(p) && free(p.x, p.z, .5, true)) { put(lampK, p.x, p.z, face); take(p.x, p.z, .8); }
          const tm = t + step / 2; if (tm > sd.b - 4) continue;
          const roll = R(), q = at(tm, half + 1.7);
          if (!okRoad(q)) continue;
          if (roll < .45) { if (free(q.x, q.z, 1.1, true)) { put('bench', q.x, q.z, face); take(q.x, q.z, 1.2); const b2 = at(tm + 1.6, half + 1.2); if (free(b2.x, b2.z, .4, true)) { put('bin', b2.x, b2.z, 0); take(b2.x, b2.z, .5); } } }
          else if (roll < .7 && depth > 3.2) { const f2 = at(tm, half + 2.6); if (free(f2.x, f2.z, 1.4, true)) { put('flowerBed' + (k % 2), f2.x, f2.z, alongX); take(f2.x, f2.z, 1.5); } }
          else if (urban && roll < .85) { const h2 = at(tm, half + 1.0); if (free(h2.x, h2.z, .4, true)) { put(st === 'port' ? 'barrels' : 'hydrant', h2.x, h2.z, R() * TAU); take(h2.x, h2.z, .8); } }
          else if (st === 'port' && depth > 4) { const c2 = at(tm, half + 2.6); if (free(c2.x, c2.z, 1.5, true)) { put('crates', c2.x, c2.z, R() * TAU); take(c2.x, c2.z, 1.6); } }
          else if (st === 'desert') { const c2 = at(tm, half + 2.2); if (free(c2.x, c2.z, .8, true)) { put('cactusBarrel', c2.x, c2.z, R() * TAU, { s: .8 + R() * .4 }); take(c2.x, c2.z, .8); } }
        }
        // haies / clôtures en lisière des bourgs ruraux
        const edge = st === 'forest' || st === 'cliff' || hamlet ? 'hedge' : st === 'farm' ? 'fence' : st === 'lagoon' ? 'fenceWhite' : null;
        if (edge && R() < .75) {
          const off = sd.m + 2.5;
          for (let t = sd.a - 2; t <= sd.b + 2; t += 3.05) { const p = at(t, off); if (R() < .1 || !okRoad(p, 7) || !free(p.x, p.z, 1.2)) continue; put(edge, p.x, p.z, alongX, { r: 1 }); take(p.x, p.z, 1.3); }
        }
        // panneau au coin de la ville
        const cp = sd.ax === 'x' ? { x: (si % 2 ? sd.b : sd.a) + (si % 2 ? 1 : -1) * (half + 1.2), z: sd.c + sd.nz * (half + 1.2) } : null;
        if (cp && okRoad(cp) && free(cp.x, cp.z, .5, true)) { put(['signNoEntry', 'signWarn', 'signBlue'][(ri + si) % 3], cp.x, cp.z, Math.atan2(cp.x - r.x, cp.z - r.z)); take(cp.x, cp.z, .6); }
        // aire de jeux / terrain de basket dans les grandes marges
        if (sd.m >= 14 && (urban || st === 'forest' || st === 'desert' || hamlet) && si === (ri % 2)) {
          for (let tries = 0; tries < 8; tries++) {
            const t = sd.a + 12 + R() * Math.max(1, sd.b - sd.a - 24), p = at(t, half + 8.5);
            if (!okRoad(p, 11) || !free(p.x, p.z, 7.5, true)) continue;
            patch(p.x, p.z, 7, 6, face, 2, () => C('#e3cf98'), .07);
            put('playground', p.x, p.z, face); occ.circle(p.x, p.z, 8.5);
            const bq = tw(p.x, p.z, face, 0, -7.5); if (free(bq.x, bq.z, 1.1, true)) { put('bench', bq.x, bq.z, face + Math.PI); take(bq.x, bq.z, 1.2); }
            break;
          }
        }
        if (city && sd.m >= 14 && si === 1 - (ri % 2)) {
          for (let tries = 0; tries < 8; tries++) {
            const t = sd.a + 14 + R() * Math.max(1, sd.b - sd.a - 28), p = at(t, half + 9);
            if (!okRoad(p, 12) || !free(p.x, p.z, 8.6, true)) continue;
            const yawC = sd.ax === 'x' ? 0 : HPI;
            patch(p.x, p.z, 8, 4.8, yawC, 2, () => C('#c8673a'), .07);
            patch(p.x, p.z, 7.6, .06, yawC, 16, () => C('#f2efe4'), .085); patch(p.x, p.z, .06, 4.4, yawC, 16, () => C('#f2efe4'), .085);
            for (const e of [-1, 1]) { const hq = tw(p.x, p.z, yawC, e * 7.4, 0); put('hoop', hq.x, hq.z, yawC + (e > 0 ? -HPI : HPI)); }
            occ.circle(p.x, p.z, 9.5); break;
          }
        }
      });
      // lampadaires aux carrefours intérieurs
      const cellHouse = (col, row) => houses.get(Math.round(r.x + (col - (cols - 1) / 2) * sx) + ',' + Math.round(r.z + (row - (rows - 1) / 2) * sz));
      for (let c = 1; c < cols; c++) for (let rw = 1; rw < rows; rw++) {
        if ((c + rw) % 2) continue;
        const ix = left + c * sx, iz = top + rw * sz, sgx = R() < .5 ? -1 : 1, sgz = R() < .5 ? -1 : 1;
        const hh = cellHouse(c + (sgx > 0 ? 0 : -1), rw + (sgz > 0 ? 0 : -1));
        const ox = hh ? sx / 2 - hh.w - 1.0 : 3.0, oz = hh ? sz / 2 - (hh.d || hh.w) - 1.0 : 3.0;
        if (ox < 2.1 || oz < 2.1) continue;
        const x = ix + sgx * Math.min(ox, 3.2), z = iz + sgz * Math.min(oz, 3.2);
        if (!free(x, z, .35, true)) continue;
        put(lampK, x, z, Math.atan2(-sgx, -sgz)); take(x, z, .6);
      }
      // squares (parcelles sans maison)
      let fountains = 0, plays = 0;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        if (cellHouse(col, row)) continue;
        const cx = r.x + (col - (cols - 1) / 2) * sx, cz = r.z + (row - (rows - 1) / 2) * sz;
        if (fountains < (city ? 2 : 1) && (urban || st === 'lagoon' || st === 'desert') && free(cx, cz, 3.0)) { fountains++; disc(cx, cz, 3.6, '#cfc6b4', .07); put('fountain', cx, cz, 0); take(cx, cz, 3.4); }
        else if (plays < 1 && free(cx, cz, 6.5)) { plays++; patch(cx, cz, 7, 6, 0, 2, () => C('#e3cf98'), .07); put('playground', cx, cz, (col + row) % 2 ? 0 : Math.PI); take(cx, cz, 7.5); continue; }
        for (const [dx, dz] of [[-5.6, -5.6], [5.6, 5.6], [-5.6, 5.6], [5.6, -5.6]]) { const x = cx + dx, z = cz + dz; if (free(x, z, 1.3)) { put('flowerBed' + ((col + row) % 2), x, z, (dx * dz > 0 ? Math.PI / 4 : -Math.PI / 4)); take(x, z, 1.4); } }
        for (const [dx, dz] of [[0, 6.4], [0, -6.4], [6.4, 0], [-6.4, 0]]) { const x = cx + dx, z = cz + dz; if (R() < .5 && free(x, z, 1.1)) { put('bench', x, z, Math.atan2(-dx, -dz)); take(x, z, 1.2); } }
        const lx = cx + 4.2, lz = cz - 4.2; if (free(lx, lz, .4)) { put(lampK, lx, lz, -Math.PI * .75); take(lx, lz, .5); }
      }
    });

    /* ---------------------------------------------- fermes */
    function fieldOK(x, z, hw, hd, yaw) {
      const c = Math.cos(yaw), s = Math.sin(yaw); let h0 = Infinity, h1 = -Infinity;
      for (let lx = -hw; lx <= hw + .01; lx += 4) for (let lz = -hd; lz <= hd + .01; lz += 4) {
        const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
        if (!inland(px, pz, 25) || pad(px, pz, 6) || roadDist(px, pz) < 4.5 || !free(px, pz, 1.2)) return false;
        const h = S.heightAt(px, pz); if (h < h0) h0 = h; if (h > h1) h1 = h;
      }
      return h1 - h0 < Math.max(3.5, hw * .22);
    }
    const barns = [];
    S.regions.filter((r) => r.style === 'farm').forEach((r) => {
      const R = rng(hstr(r.name) ^ 0xfa12), rad = Math.max(r.padW || 50, r.padD || 50);
      // grange, silos, foin
      for (let i = 0; i < 70; i++) {
        const a = R() * TAU, d = rad + 24 + R() * 40, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
        if (!inland(x, z, 30) || pad(x, z, 12) || roadDist(x, z) < 16 || !flat(x, z, 8, 3) || !free(x, z, 11)) continue;
        const yaw = Math.atan2(r.x - x, r.z - z);
        if (barns.some((q) => Math.hypot(q.x - x, q.z - z) < 90)) continue;
        barns.push({ x, z }); { const yd = tw(x, z, yaw, 0, 3); disc(yd.x, yd.z, 13, '#a88458', .06, '#93924f'); }
        put('barn', x, z, yaw, { r: 6 }); take(x, z, 11);
        for (const [lx, lz] of [[9, -3], [9, 2.8]]) { const p = tw(x, z, yaw, lx, lz); if (free(p.x, p.z, 2.6, true)) { put('silo', p.x, p.z, 0, { r: 2 }); take(p.x, p.z, 2.8); } }
        for (const [lx, lz, nm] of [[-8, 5, 'hayStack'], [-4.5, 11, 'tractor'], [6, 10, 'trough'], [-9, -2, 'hayRound']]) { const p = tw(x, z, yaw, lx, lz); if (free(p.x, p.z, 1.6, true)) { put(nm, p.x, p.z, yaw + (R() - .5) * .8, { r: 1 }); take(p.x, p.z, 1.8); } }
        const sg = tw(x, z, yaw, 4, 13); if (free(sg.x, sg.z, .8, true)) { put('campSign', sg.x, sg.z, yaw); sign(lblUV(LBL.oeufs), sg.x, ground(sg.x, sg.z), sg.z, yaw, 0, 1.6, .07, 2.3, .6); take(sg.x, sg.z, 1); }
        break;
      }
      // champs
      const types = ['wheat', 'plowed', 'corn', 'veg', 'harvest', 'lavender', 'wheat', 'sunflower', 'plowed'];
      let made = 0, tall = 0; const want = Math.round((r.layout === 'hamlet' ? 6 : 8) * (low ? .65 : 1)), off = hstr(r.name) % types.length;
      for (let i = 0; i < 160 && made < want; i++) {
        const a = R() * TAU, d = rad + 34 + R() * 130, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
        const hw = 12 + R() * 9, hd = 8 + R() * 6, yaw = (R() < .5 ? 0 : HPI) + (R() - .5) * .3;
        if (!fieldOK(x, z, hw, hd, yaw)) continue;
        let type = types[(made + off) % types.length];
        if ((type === 'corn' || type === 'sunflower') && (low || tall >= 2)) type = 'veg';
        const F = FIELD[type], FR = rng(hstr(r.name) + made * 31);
        patch(x, z, hw + 1.2, hd + 1.2, yaw, 4, () => C('#7f9a45'), .055);
        stripes(x, z, hw, hd, yaw, F[0], F[1], F[2], F[3], .07, FR);
        occ.rect(x, z, hw + 1.5, hd + 1.5, yaw); made++;
        if (type === 'corn' || type === 'sunflower') {
          tall++; const sp = type === 'corn' ? 2 : 2.2;
          for (let lx = -hw + 1; lx < hw - .5; lx += sp) for (let lz = -hd + 5; lz < hd - 4; lz += 10) { const p = tw(x, z, yaw, lx, lz); put(type === 'corn' ? 'cornRow' : 'sunRow', p.x, p.z, yaw, { dy: -.05 }); }
        }
        if (type === 'harvest') for (let j = 0; j < 7; j++) { const p = tw(x, z, yaw, (FR() - .5) * hw * 1.6, (FR() - .5) * hd * 1.6); put('hayRound', p.x, p.z, FR() * TAU, { r: .8 }); }
        if ((type === 'wheat' || type === 'corn') && FR() < .55) { const p = tw(x, z, yaw, (FR() - .5) * hw, (FR() - .5) * hd * .6); put('scarecrow', p.x, p.z, FR() * TAU); }
        if (type === 'plowed' && FR() < .4) { const p = tw(x, z, yaw, hw - 3, hd - 3); put('tractor', p.x, p.z, yaw + HPI, { r: 1 }); }
        if (FR() < .65) { // clôture avec un portail côté ville
          const c = Math.cos(yaw), s = Math.sin(yaw), ex = hw + .8, ez = hd + .8;
          const edges = [[-ex, -ez, ex, -ez], [ex, -ez, ex, ez], [ex, ez, -ex, ez], [-ex, ez, -ex, -ez]];
          let gate = 0, gd = Infinity; edges.forEach((e, ei) => { const m = tw(x, z, yaw, (e[0] + e[2]) / 2, (e[1] + e[3]) / 2), dd = Math.hypot(m.x - r.x, m.z - r.z); if (dd < gd) { gd = dd; gate = ei; } });
          edges.forEach((e, ei) => {
            const L = Math.hypot(e[2] - e[0], e[3] - e[1]), ns = Math.max(1, Math.round(L / 3)), ln = L / ns, ang = Math.atan2(e[2] - e[0], e[3] - e[1]) - HPI;
            for (let j = 0; j < ns; j++) {
              if (ei === gate && Math.abs(j - (ns - 1) / 2) < 1) continue;
              const t = (j + .5) / ns, p = tw(x, z, yaw, e[0] + (e[2] - e[0]) * t, e[1] + (e[3] - e[1]) * t);
              if (roadDist(p.x, p.z) < 4) continue;
              put('fence', p.x, p.z, yaw + ang, { sx: ln / 3, sy: 1, sz: 1, r: 1 });
            }
          }); void c; void s;
        }
      }
      // moulins (ailes animées) et château d'eau
      const nw = r.name.indexOf('Moulins') === 0 ? 3 : 1;
      for (let m = 0; m < nw; m++) {
        let best = null;
        for (let i = 0; i < 40; i++) { const a = R() * TAU, d = rad + 30 + R() * 110, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d; if (!inland(x, z, 30) || pad(x, z, 10) || roadDist(x, z) < 10 || !flat(x, z, 3.5, 2.5) || !free(x, z, 6)) continue; const h = S.heightAt(x, z); if (!best || h > best.h) best = { x, z, h }; }
        if (!best) continue;
        const yaw = Math.atan2(r.x - best.x, r.z - best.z) + .4, y = put('windmill', best.x, best.z, yaw, { r: 3 }); take(best.x, best.z, 7);
        const hub = tw(best.x, best.z, yaw, 0, 2.95); sails.push({ x: hub.x, y: y + 9.4, z: hub.z, yaw, sp: .55 + R() * .3, ph: R() * TAU });
      }
    });
    // châteaux d'eau près des fermes, du désert et des hameaux
    S.regions.forEach((r) => {
      if (!(r.style === 'farm' || r.style === 'desert' || (r.layout === 'hamlet' && r.style !== 'port' && r.style !== 'lagoon'))) return;
      const R = rng(hstr(r.name) ^ 0x7a7e), rad = Math.max(r.padW || 50, r.padD || 50);
      for (let i = 0; i < 40; i++) { const a = R() * TAU, d = rad + 10 + R() * 30, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d; if (!inland(x, z, 20) || pad(x, z, 5) || roadDist(x, z) < 9 || !flat(x, z, 3, 2.5) || !free(x, z, 4)) continue; put('waterTower', x, z, R() * TAU, { r: 2.5 }); take(x, z, 4.5); break; }
    });

    /* ---------------------------------------------- côte : pontons, plages, palmiers */
    const coastDir = (x0, z0) => { let best = null; for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, dx = Math.cos(a), dz = Math.sin(a); for (let d = 10; d < 330; d += 5) { const x = x0 + dx * d, z = z0 + dz * d; if (S.coastDistance(x, z) >= M.shoreEnd - 8) { if (!best || d < best.d) best = { d, dx, dz }; break; } } } return best; };
    const seaward = (x, z) => { const e = 2, gx = S.coastDistance(x + e, z) - S.coastDistance(x - e, z), gz = S.coastDistance(x, z + e) - S.coastDistance(x, z - e), L = Math.hypot(gx, gz) || 1; return { x: gx / L, z: gz / L }; };
    S.regions.forEach((r) => {
      const st = r.style; if (st !== 'port' && st !== 'lagoon') return;
      const R = rng(hstr(r.name) ^ 0xb0a7), cd = coastDir(r.x, r.z); if (!cd || cd.d > 240) return;
      const piers = st === 'port' && r.layout !== 'hamlet' ? 2 : 1;
      for (let pi = 0; pi < piers; pi++) {
        const lat = (pi - (piers - 1) / 2) * 34, ox = r.x - cd.dz * lat, oz = r.z + cd.dx * lat;
        let start = null; for (let d = 10; d < 330; d += 2) { const x = ox + cd.dx * d, z = oz + cd.dz * d; if (S.heightAt(x, z) < SEA + .9) { start = { x, z }; break; } }
        if (!start || solid.hit(start.x, start.z, 3)) continue;
        const yaw = Math.atan2(cd.dx, cd.dz), deck = SEA + 1.15, L = 26 + (R() * 3 | 0) * 4;
        for (let d = -4; d <= L; d += 4) { const x = start.x + cd.dx * d, z = start.z + cd.dz * d; put('pier', x, z, yaw, { y: deck }); take(x, z, 2.4); }
        for (const [dd, side] of [[10, 1], [18, -1], [24, 1]]) { if (R() < .25) continue; const p = tw(start.x, start.z, yaw, side * 3.3, dd); put('boat', p.x, p.z, yaw + (R() - .5) * .25, { y: SEA - .1, paint: BOATS[(R() * BOATS.length) | 0] }); }
        const e = tw(start.x, start.z, yaw, .5, L - 1); put(R() < .5 ? 'crates' : 'barrels', e.x, e.z, R() * TAU, { y: deck + .11, s: .8 });
        for (let j = 0; j < 3; j++) { const p = tw(start.x, start.z, yaw, (R() - .5) * 40, L + 12 + R() * 20); if (S.isWater(p.x, p.z)) put(j ? 'buoy' : 'boat', p.x, p.z, R() * TAU, j ? { y: SEA - .45 } : { y: SEA - .1, paint: BOATS[(R() * BOATS.length) | 0] }); }
      }
      // plage : quelques coins de plage bien garnis
      const spots = Math.max(1, Math.round((st === 'lagoon' ? 3 : 2) * (low ? .5 : 1))), done = [];
      let guard = false, volley = st !== 'lagoon';
      for (let i = 0; i < 400 && done.length < spots; i++) {
        const a = R() * TAU, d = 40 + R() * 200, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d, cdist = S.coastDistance(x, z);
        if (cdist < M.shoreStart + 4 || cdist > M.shoreEnd - 24 || S.heightAt(x, z) < SEA + .7 || roadDist(x, z) < 8 || pad(x, z, 4) || !free(x, z, 4) || done.some((q) => Math.hypot(q.x - x, q.z - z) < 45)) continue;
        done.push({ x, z });
        const sw = seaward(x, z), yawS = Math.atan2(sw.x, sw.z);
        if (!guard) { guard = true; put('lifeguard', x, z, yawS, { r: 1.4 }); take(x, z, 3.5); for (let j = 0; j < 3; j++) { const p = tw(x, z, yawS, 2.4 + j * .7, -2.2); put('surf', p.x, p.z, yawS + HPI, { paint: BEACH[(R() * BEACH.length) | 0] }); } }
        else take(x, z, 2);
        if (!volley) { const v = tw(x, z, yawS, 14, -2); if (free(v.x, v.z, 5.5)) { volley = true; put('volley', v.x, v.z, yawS + HPI); take(v.x, v.z, 6); } }
        for (let j = 0, made = 0; j < 30 && made < (low ? 3 : 6); j++) {
          const lx = (R() - .5) * 26, lz = (R() - .5) * 10 + 2, p = tw(x, z, yawS, lx, lz), cd2 = S.coastDistance(p.x, p.z);
          if (cd2 < M.shoreStart + 1 || cd2 > M.shoreEnd - 20 || S.heightAt(p.x, p.z) < SEA + .55 || roadDist(p.x, p.z) < 6 || !free(p.x, p.z, 2)) continue;
          put('umbrella', p.x, p.z, R() * TAU, { paint: BEACH[(R() * BEACH.length) | 0] }); take(p.x, p.z, 2.3); made++;
          const t1 = tw(p.x, p.z, yawS, .9, -.4); put(R() < .55 ? 'lounger' : 'towel', t1.x, t1.z, yawS + Math.PI + (R() - .5) * .4, { paint: BEACH[(R() * BEACH.length) | 0] });
          if (R() < .5) { const t2 = tw(p.x, p.z, yawS, -1.0, -.3); put('towel', t2.x, t2.z, yawS + (R() - .5) * .5, { paint: BEACH[(R() * BEACH.length) | 0] }); }
        }
        const sgp = tw(x, z, yawS, -6, -6); if (st === 'lagoon' && free(sgp.x, sgp.z, .8, true)) { const yy = put('campSign', sgp.x, sgp.z, yawS + Math.PI); sign(lblUV(LBL.plage), sgp.x, yy, sgp.z, yawS + Math.PI, 0, 1.6, .07, 2.3, .6); }
      }
    });
    // palmiers : lagunes, oasis, plages du sud
    (function palms() {
      const R = rng(4455);
      S.regions.filter((r) => r.style === 'lagoon').forEach((r) => {
        const n = Math.round(20 * D), rad = Math.max(r.padW || 50, r.padD || 50);
        for (let i = 0, made = 0; i < 200 && made < n; i++) {
          const a = R() * TAU, d = rad * .9 + R() * 110, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
          if (S.isWater(x, z) || S.heightAt(x, z) < SEA + .7 || S.coastDistance(x, z) > M.shoreEnd - 22 || pad(x, z, 2) || roadDist(x, z) < 5 || !free(x, z, 1.4)) continue;
          put('palm', x, z, R() * TAU, { s: .85 + R() * .45, dy: -.2 }); take(x, z, 1.6); made++;
        }
      });
      for (let i = 0, made = 0; i < 4000 && made < Math.round(70 * D); i++) {
        const x = (R() - .5) * HALF * 2, z = (R() - .5) * HALF * 2, cdist = S.coastDistance(x, z);
        if (z < 120 && x > -500) continue;
        if (cdist < M.shoreStart - 18 || cdist > M.shoreStart + 22 || S.heightAt(x, z) < SEA + .8 || roadDist(x, z) < 5 || pad(x, z, 4) || !free(x, z, 1.4)) continue;
        put('palm', x, z, R() * TAU, { s: .8 + R() * .5, dy: -.2 }); take(x, z, 2.5); made++;
      }
    })();

    /* ---------------------------------------------- observatoires */
    S.regions.filter((r) => r.style === 'observatory').forEach((r) => {
      const R = rng(hstr(r.name) ^ 0x0b5), rad = Math.max(r.padW || 50, r.padD || 50), nd = r.layout === 'hamlet' ? 2 : 3;
      for (let i = 0, made = 0; i < 80 && made < nd + 2; i++) {
        const a = R() * TAU, d = rad + 8 + R() * 45, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d, dish = made < nd;
        if (!inland(x, z, 20) || pad(x, z, 3) || roadDist(x, z) < 9 || !flat(x, z, 3, 3) || !free(x, z, dish ? 6.5 : 2)) continue;
        if (dish) { put('dish', x, z, Math.atan2(x - r.x, z - r.z) + (R() - .5) * .8, { r: 1.5 }); take(x, z, 6.5); patch(x, z, 3, 3, 0, 3, () => C('#a8a196'), .07); }
        else { put('mast', x, z, R() * TAU, { r: .8 }); take(x, z, 2); }
        made++;
      }
    });

    /* ---------------------------------------------- campings */
    S.regions.filter((r) => r.style === 'forest').forEach((r) => {
      const R = rng(hstr(r.name) ^ 0xca39), rad = Math.max(r.padW || 50, r.padD || 50);
      for (let i = 0; i < 90; i++) {
        const a = R() * TAU, d = rad + 28 + R() * 70, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
        if (!inland(x, z, 25) || pad(x, z, 10) || roadDist(x, z) < 14 || !flat(x, z, 7, 3) || !free(x, z, 8)) continue;
        disc(x, z, 7.8, '#9a8456', .06, '#8f9a52');
        put('campfire', x, z, 0); take(x, z, 8.5);
        for (let j = 0; j < 3; j++) { const an = j / 3 * TAU + R(), p = { x: x + Math.cos(an) * 5, z: z + Math.sin(an) * 5 }; put('tent', p.x, p.z, Math.atan2(x - p.x, z - p.z), { paint: ['#ff8a3c', '#2d6fc4', '#4fae44', '#ffd23f'][(j + i) % 4], r: 1.2 }); }
        for (let j = 0; j < 2; j++) { const an = (j + .5) / 3 * TAU + R() * .3, p = { x: x + Math.cos(an) * 2.2, z: z + Math.sin(an) * 2.2 }; put('logSeat', p.x, p.z, Math.atan2(x - p.x, z - p.z) + HPI); }
        const pt = tw(x, z, 0, 6.5, -2.5); put('picnic', pt.x, pt.z, R()); const lp = tw(x, z, 0, -6.4, 2.2); put('logPile', lp.x, lp.z, R() * TAU, { r: 1 });
        const q = nearestRoad(x, z); if (q.d < 200) { const ux = (q.x - x) / q.d, uz = (q.z - z) / q.d; path(x + ux * 8, z + uz * 8, q.x - ux * 3, q.z - uz * 3, i + 7); const sp = { x: q.x - ux * 6 + uz * 3, z: q.z - uz * 6 - ux * 3 }; if (free(sp.x, sp.z, .9, true)) { const yaw = Math.atan2(ux, uz); put('campSign', sp.x, sp.z, yaw); sign(lblUV(LBL.camping), sp.x, ground(sp.x, sp.z), sp.z, yaw, 0, 1.6, .07, 2.3, .6); } }
        break;
      }
    });

    /* ---------------------------------------------- routes */
    (function roadside() {
      const R = rng(7007), ents = [];
      // entrées de ville : panneau du nom, abribus dans les grandes villes
      (S.roads || []).forEach((line) => {
        for (const end of [0, line.length - 1]) {
          const e = line[end], r = pad(e.x, e.z, 8); if (!r) continue;
          const ri = S.regions.indexOf(r), nxt = line[end === 0 ? 1 : line.length - 2], L = Math.hypot(nxt.x - e.x, nxt.z - e.z) || 1, ux = (nxt.x - e.x) / L, uz = (nxt.z - e.z) / L;
          const dist = Math.max(r.padW || 40, r.padD || 40) * .25 + 22, bx = e.x + ux * Math.min(dist, L * .6), bz = e.z + uz * Math.min(dist, L * .6), px = -uz, pz = ux;
          const sp = { x: bx + px * 5.2, z: bz + pz * 5.2 };
          if (!free(sp.x, sp.z, 1.6, true) || ents.some((q) => Math.hypot(q.x - sp.x, q.z - sp.z) < 12)) continue;
          ents.push(sp); const yaw = Math.atan2(ux, uz), y = put('townSign', sp.x, sp.z, yaw, { r: 1.5 }); take(sp.x, sp.z, 2);
          sign(lblUV(ri), sp.x, y, sp.z, yaw, 0, 1.8, .07, 3.1, .78); sign(lblUV(ri), sp.x, y, sp.z, yaw, 0, 1.8, -.07, 3.1, .78, true);
          if (r.style === 'citadel' || (r.style === 'port' && r.layout !== 'hamlet')) { const bs = { x: bx + ux * 10 - px * 5.4, z: bz + uz * 10 - pz * 5.4 }; if (free(bs.x, bs.z, 2, true)) { put('busStop', bs.x, bs.z, Math.atan2(px, pz), { r: 1.5 }); take(bs.x, bs.z, 2.2); } }
          const ss = { x: bx + ux * 18 + px * 4.8, z: bz + uz * 18 + pz * 4.8 }; if (free(ss.x, ss.z, .5, true) && !pad(ss.x, ss.z, 0)) { put(R() < .5 ? 'signWarn' : 'signBlue', ss.x, ss.z, yaw); take(ss.x, ss.z, .6); }
        }
      });
      // poteaux électriques et câbles le long des grandes routes
      let poles = 0;
      (S.roads || []).forEach((line, li) => {
        let prev = null, acc = 0, side = li % 2 ? 1 : -1;
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1) continue; const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
          for (let s = (34 - acc) % 34; s < L; s += 34) {
            const x = a.x + ux * s - uz * 7 * side, z = a.z + uz * s + ux * 7 * side;
            if (pad(x, z, 10) || !inland(x, z, 8) || !free(x, z, 1.0) || roadDist(x, z) < 5.5) { prev = null; continue; }
            const yaw = Math.atan2(ux, uz), y = put('pylon', x, z, yaw, { dy: -.2 }); take(x, z, 1.2); poles++;
            const cur = { x, z, y: y, yaw };
            if (prev && !low && Math.hypot(prev.x - x, prev.z - z) < 48) for (const lx of [-1.3, 0, 1.3]) { const ly = lx ? 8.9 : 9.4, A = tw(prev.x, prev.z, prev.yaw, lx, 0), B = tw(x, z, yaw, lx, 0); wire(A.x, prev.y + ly, A.z, B.x, cur.y + ly, B.z, .7); }
            prev = cur;
          }
          acc = (acc + L) % 34;
        }
      });
      void poles;
      // panneaux publicitaires
      const boards = [];
      for (let li = 0; li < (S.roads || []).length; li++) {
        const line = S.roads[li];
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 30) continue; const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
          for (let s = 20; s < L - 10; s += 23) {
            if (boards.length >= Math.round(12 * (low ? .6 : 1))) break;
            const side = ((li + i) % 2 ? 1 : -1), x = a.x + ux * s + (-uz) * 13 * side, z = a.z + uz * s + ux * 13 * side;
            if (boards.some((q) => Math.hypot(q.x - x, q.z - z) < 150) || pad(x, z, 45) || !inland(x, z, 15) || !free(x, z, 5) || roadDist(x, z) < 10) continue;
            const yaw = Math.atan2(uz * side, -ux * side) + (R() < .5 ? .45 : -.45), y = put('billboard', x, z, yaw, { r: 2.5 }); take(x, z, 5.5);
            sign(adUV(boards.length % ADS.length), x, y, z, yaw, 0, 7.6, .07, 8.2, 4.2); boards.push({ x, z });
          }
        }
      }
      // stations-service
      const stations = [];
      const nR = (S.roads || []).length;
      for (let lj = 0; lj < nR * 2 && stations.length < 2; lj++) {
        const li = (lj * 5 + 3) % nR, line = S.roads[li];
        for (let i = 1; i < line.length && stations.length < 2; i++) {
          const a = line[i - 1], b = line[i], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 50) continue; const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
          for (let s = 25; s < L - 25 && stations.length < 2; s += 25) {
            const side = lj < nR ? 1 : -1, rx = a.x + ux * s, rz = a.z + uz * s, nx = -uz * side, nz = ux * side, x = rx + nx * 16, z = rz + nz * 16;
            if (stations.some((q) => Math.hypot(q.x - x, q.z - z) < 500) || pad(x, z, 50) || !inland(x, z, 30) || !flat(x, z, 10, 2.8) || !free(x, z, 13) || roadDist(x, z) < 12) continue;
            const yaw = Math.atan2(-nx, -nz), y = put('gas', x, z, yaw, { r: 6 }); take(x, z, 15);
            patch(x + nx * -3.5, z + nz * -3.5, 15, 10.5, Math.atan2(ux, uz) + HPI, 3, () => C('#8f9397'), .065);
            sign(lblUV(LBL.station), x, y, z, yaw, 6.8, 7.4, 6.5 + .19, 3.0, 1.4); sign(lblUV(LBL.station), x, y, z, yaw, 6.8, 7.4, 6.5 - .19, 3.0, 1.4, true);
            sign(lblUV(LBL.station), x, y, z, yaw, -1, 3.3, -5.91, 4.0, .62);
            stations.push({ x, z });
          }
        }
      }
    })();

    /* ---------------------------------------------- tours de guet sur les hauteurs */
    (function towers() {
      const c = [];
      for (let x = -HALF + 40; x < HALF; x += 55) for (let z = -HALF + 40; z < HALF; z += 55) {
        if (!inland(x, z, 40) || pad(x, z, 60) || roadDist(x, z) < 25) continue;
        const h = S.heightAt(x, z), around = (S.heightAt(x + 40, z) + S.heightAt(x - 40, z) + S.heightAt(x, z + 40) + S.heightAt(x, z - 40)) / 4;
        if (h - around < 1.5 || S.zoneWeights(x, z).volcano > .2) continue; c.push({ x, z, h, p: h - around });
      }
      c.sort((a, b) => b.p - a.p);
      const out = [];
      for (const q of c) {
        if (out.length >= (low ? 4 : 7)) break;
        if (out.some((o) => Math.hypot(o.x - q.x, o.z - q.z) < 260) || !flat(q.x, q.z, 3, 2.2) || !free(q.x, q.z, 4)) continue;
        put('watchtower', q.x, q.z, (q.x * 13 + q.z) % TAU, { r: 2 }); take(q.x, q.z, 4.5); out.push(q);
        const rd = nearestRoad(q.x, q.z); if (rd.d < 170) { const ux = (rd.x - q.x) / rd.d, uz = (rd.z - q.z) / rd.d; path(q.x + ux * 4, q.z + uz * 4, rd.x - ux * 3, rd.z - uz * 3, out.length * 3 + 11); }
      }
    })();

    /* ---------------------------------------------- désert */
    (function desert() {
      const R = rng(5150), want = { cactus: 170, cactusBarrel: 150, desertRock: 130, deadBush: 140, desertRockBig: 26 };
      for (const nm in want) {
        const n = Math.round(want[nm] * D);
        for (let i = 0, made = 0; i < n * 30 && made < n; i++) {
          const x = (R() - .5) * HALF * 2, z = (R() - .5) * HALF * 2, zw = S.zoneWeights(x, z);
          if (zw.desert < .55 || !inland(x, z, 12) || pad(x, z, 5) || roadDist(x, z) < 5 || !free(x, z, nm === 'desertRockBig' ? 4 : 1)) continue;
          put(nm, x, z, R() * TAU, { s: (nm === 'cactus' ? .7 : .6) + R() * .7, dy: -.1 }); take(x, z, nm === 'desertRockBig' ? 4.5 : 1.2); made++;
        }
      }
      const arches = []; // arches de pierre
      for (let i = 0; i < 6000 && arches.length < 3; i++) {
        const x = (R() - .5) * HALF * 2, z = (R() - .5) * HALF * 2, zw = S.zoneWeights(x, z);
        if ((zw.desert < .6 && zw.snow < .6) || !inland(x, z, 30) || pad(x, z, 30) || roadDist(x, z) < 16 || !flat(x, z, 7, 3.2) || !free(x, z, 9) || arches.some((q) => Math.hypot(q.x - x, q.z - z) < 260)) continue;
        put('arch', x, z, R() * TAU, { r: 5, s: .9 + R() * .4, dy: -.4 }); take(x, z, 10); arches.push({ x, z });
      }
    })();

    /* ---------------------------------------------- sous-bois et prairies */
    (function nature() {
      const R = rng(8080), list = w.flora || [];
      let mush = 0, fern = 0; const mMax = Math.round(170 * D), fMax = Math.round(300 * D);
      for (let i = 0; i < list.length && (mush < mMax || fern < fMax); i++) {
        const f = list[(i * 7919) % list.length]; if (f.k === 2 || f.dead) continue;
        const ff = S.forestField(f.x, f.z); if (ff < .25) continue;
        const a = R() * TAU, d = 1.5 + R() * 1.6, x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        if (pad(x, z, 3) || roadDist(x, z) < 4 || occ.hit(x, z, .6) || solid.hit(x, z, .6)) continue;
        if (mush < mMax && R() < .45) { put('mushrooms', x, z, R() * TAU, { s: .9 + R() * .7 }); mush++; }
        else if (fern < fMax) { put('fern', x, z, R() * TAU, { s: .8 + R() * .7 }); fern++; }
      }
      const extra = { stump: 130, logPile: 34 };
      for (const nm in extra) {
        const n = Math.round(extra[nm] * D);
        for (let i = 0, made = 0; i < n * 40 && made < n; i++) {
          const x = (R() - .5) * HALF * 2, z = (R() - .5) * HALF * 2;
          if (S.forestField(x, z) < .4 || !inland(x, z, 15) || pad(x, z, 6) || roadDist(x, z) < 5 || S.zoneWeights(x, z).desert > .4 || !free(x, z, nm === 'logPile' ? 2 : .8)) continue;
          put(nm, x, z, R() * TAU, { s: nm === 'stump' ? .8 + R() * .6 : 1, r: nm === 'logPile' ? 1.4 : 0 }); take(x, z, 1.5); made++;
        }
      }
      // fleurs des prés
      const nF = Math.round(800 * D);
      for (let i = 0, made = 0; i < nF * 12 && made < nF; i++) {
        const x = (R() - .5) * HALF * 2, z = (R() - .5) * HALF * 2;
        if (!inland(x, z, 15) || pad(x, z, 6) || S.biomeAt(x, z) !== 'grass' || S.forestField(x, z) > .5 || roadDist(x, z) < 4) continue;
        const zw = S.zoneWeights(x, z); if (zw.snow > .3 || zw.desert > .3 || zw.volcano > .2) continue;
        if (!free(x, z, .7)) continue;
        put('flowers' + (made % 3), x, z, R() * TAU, { s: .9 + R() * .6 }); made++;
        if (R() < .35) { const x2 = x + (R() - .5) * 3, z2 = z + (R() - .5) * 3; if (free(x2, z2, .6)) { put('flowers' + ((made + 1) % 3), x2, z2, R() * TAU, { s: .8 + R() * .5 }); made++; } }
      }
    })();

    /* ---------------------------------------------- assemblage */
    const group = new T.Group(); group.name = 'ch1-props-v93';
    const chunks = [];
    for (const [key, b] of batches) chunks.push({ key, b, big: key % 2 === 1, ci: (key - (key % 2)) / 2, mesh: null });
    chunks.forEach((ch) => { ch.cx = (Math.floor(ch.ci / NCH) + .5) * CHUNK - HALF; ch.cz = ((ch.ci % NCH) + .5) * CHUNK - HALF; });
    const extra = [];
    const gg = glow.geometry(); if (gg) { const m = new T.Mesh(gg, MAT.glow()); m.userData.shared = true; group.add(m); extra.push(m); }
    const dm = decal.mesh(MAT.decal()); if (dm) { dm.renderOrder = 1; group.add(dm); extra.push(dm); }
    const wm = water.mesh(MAT.water()); if (wm) { wm.renderOrder = 2; group.add(wm); extra.push(wm); }
    if (signs.length) {
      const P = [], N = [], U = [];
      for (const sg of signs) {
        const c = Math.cos(sg.yaw), s = Math.sin(sg.yaw), hw = sg.w / 2, hh = sg.h / 2, [u0, v0, u1, v1] = sg.uv;
        const V = (lx, ly) => [sg.x + lx * c, sg.y + ly, sg.z - lx * s];
        const q = [[V(-hw, -hh), u0, v0], [V(hw, -hh), u1, v0], [V(hw, hh), u1, v1], [V(-hw, -hh), u0, v0], [V(hw, hh), u1, v1], [V(-hw, hh), u0, v1]];
        for (const [p, u, v] of q) { P.push(p[0], p[1], p[2]); N.push(s, 0, c); U.push(u, v); }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.computeBoundingSphere();
      const m = new T.Mesh(g, atlas(low)); m.userData.shared = true; group.add(m); extra.push(m);
    }
    let sailMesh = null;
    if (sails.length) {
      sailMesh = new T.InstancedMesh(MAT.sailGeo(), MAT.solid(), sails.length); sailMesh.frustumCulled = false; sailMesh.userData.shared = true; sailMesh.castShadow = false; group.add(sailMesh);
    }
    let verts = 0; chunks.forEach((c) => { verts += c.b.n; });
    const stats = { buildMs: Math.round(((root.performance && performance.now()) || 0) - t0), chunks: chunks.length, tris: Math.round((verts + glow.n) / 3), signs: signs.length, sails: sails.length, count, where, streams: streamInfo, trisBy: Object.fromEntries(Object.keys(count).map((k) => [k, Math.round(count[k] * (PF[k].pk.s.n + PF[k].pk.g.n) / 3)]).sort((p, q) => q[1] - p[1]).slice(0, 14)) };
    return { world: w, low, group, chunks, extra, sails, sailMesh, stats, dummy: new T.Object3D(), t: 0 };
  }

  /* matériaux partagés (jamais détruits) */
  const MAT = (function () {
    const cache = {};
    const keep = (m) => { m.userData.ch1Shared = true; return m; };
    let streak = null;
    return {
      solid: () => cache.solid || (cache.solid = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }))),
      glow: () => cache.glow || (cache.glow = keep(new T.MeshBasicMaterial({ vertexColors: true }))),
      decal: () => cache.decal || (cache.decal = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }))),
      water: () => {
        if (cache.water) return cache.water;
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'), r = rng(321);
        g.fillStyle = '#c8d8e0'; g.fillRect(0, 0, 64, 128);
        for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${.25 + r() * .5})`; g.fillRect(r() * 64, r() * 128, 2 + r() * 6, 8 + r() * 26); }
        for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(40,80,110,${.15 + r() * .2})`; g.fillRect(r() * 64, r() * 128, 2 + r() * 4, 10 + r() * 20); }
        streak = new T.CanvasTexture(cv); streak.wrapS = streak.wrapT = T.RepeatWrapping; streak.colorSpace = T.SRGBColorSpace;
        return (cache.water = keep(new T.MeshStandardMaterial({ vertexColors: true, map: streak, roughness: .2, metalness: .1, emissive: new T.Color('#0d3550'), emissiveIntensity: .35, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
      },
      streak: () => streak,
      sailGeo: () => cache.sailGeo || (cache.sailGeo = sailsGeometry())
    };
  })();
  PUB.material = MAT;

  function disposeProps(cp) {
    if (!cp) return;
    if (cp.group.parent) cp.group.parent.remove(cp.group);
    cp.chunks.forEach((c) => { if (c.mesh) c.mesh.geometry.dispose(); });
    cp.extra.forEach((m) => m.geometry.dispose());
    if (cp.sailMesh) cp.sailMesh.dispose && cp.sailMesh.dispose();
  }

  /* ============================================================ mise à jour */
  const previousUpdate = E.update;
  E.update = function (dt, focus, day, quality) {
    const r = previousUpdate.apply(this, arguments);
    try { updateProps(this, dt || 0, focus, quality); } catch (e) { if (!E._ch1PropsErr) { E._ch1PropsErr = 1; console.warn('ch1-props', e); } }
    return r;
  };
  function updateProps(env, dt, focus, quality) {
    const cw = env.ch1World; if (!cw) return;
    if (isEventWorld()) { if (env.ch1Props) { disposeProps(env.ch1Props); env.ch1Props = null; } return; } // le mode événement garde sa mémoire
    const w = root.AZUR && root.AZUR.world; if (!w || !w.objects) return;
    const low = quality === 'low';
    let cp = env.ch1Props;
    if (!cp || cp.world !== w || cp.low !== low) {
      disposeProps(cp); cp = env.ch1Props = create(env, w, quality); cw.root.add(cp.group);
      PUB.stats = cp.stats;
    }
    const view = root.AZUR && root.AZUR.view, fx = focus ? focus.x : 0, fz = focus ? focus.z : 0, premium = quality === 'high' || quality === 'ultra';
    const ad = clamp((view && view.adaptiveDetail) || 1, .6, 1);
    const dist = (view && view.drawDistance ? Math.max(260, view.drawDistance * 1.15) : 600) * ad * (view && view.v2UltraLow ? .75 : 1);
    // en vol seulement (le bus reste en phase « transport » longtemps après le saut du joueur)
    const airborne = !!(focus && (focus.falling || focus.gliding || (w.phase === 'transport' && !focus.deployed)));
    const reach = airborne ? Math.max(dist, 900) : dist, nearR = (low ? 110 : premium ? 250 : 175) * ad;
    // construction progressive : au plus quelques morceaux par image, les plus proches d'abord
    let built = 0;
    const pend = cp.pending || (cp.pending = cp.chunks.slice());
    if (pend.length) {
      pend.sort((a, b) => Math.hypot(a.cx - fx, a.cz - fz) - Math.hypot(b.cx - fx, b.cz - fz));
      while (pend.length && built < 4) { const ch = pend.shift(); const g = ch.b.geometry(); ch.b = null; if (g) { ch.mesh = new T.Mesh(g, MAT.solid()); ch.mesh.userData.shared = true; ch.mesh.receiveShadow = true; ch.mesh.matrixAutoUpdate = false; ch.mesh.updateMatrix(); cp.group.add(ch.mesh); } built++; }
    }
    for (const ch of cp.chunks) {
      if (!ch.mesh) continue;
      const dx = Math.max(0, Math.abs(fx - ch.cx) - CHUNK / 2), dz = Math.max(0, Math.abs(fz - ch.cz) - CHUNK / 2), dd = Math.hypot(dx, dz);
      ch.mesh.visible = ch.big ? dd < reach : (!airborne && dd < nearR);
      ch.mesh.castShadow = ch.big && premium;
    }
    cp.t += dt;
    const st = MAT.streak(); if (st) st.offset.y = (st.offset.y - dt * .35) % 1;
    if (cp.sailMesh) {
      const d = cp.dummy; d.rotation.order = 'YXZ';
      cp.sails.forEach((s, i) => { d.position.set(s.x, s.y, s.z); d.rotation.set(0, s.yaw, s.ph + cp.t * s.sp); d.updateMatrix(); cp.sailMesh.setMatrixAt(i, d.matrix); });
      cp.sailMesh.instanceMatrix.needsUpdate = true;
      cp.sailMesh.visible = Math.min(...cp.sails.map((s) => Math.hypot(s.x - fx, s.z - fz))) < reach;
    }
  }
  PUB.rebuild = function () { const v = root.AZUR && root.AZUR.view, env = v && v.environment; if (env && env.ch1Props) { disposeProps(env.ch1Props); env.ch1Props = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
