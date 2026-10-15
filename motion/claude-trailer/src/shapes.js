// Geometry built from the real Claude symbol and real Inter Tight outlines.
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { GLYPHS, UPM, SYMBOL_PATH } from "./glyphs.js";

const loader = new SVGLoader();
const shapesOf = (d) => loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`).paths.flatMap((p) => SVGLoader.createShapes(p));

// ---------------------------------------------------------------- the Claude symbol
// Outline in symbol units: centred, y up, outer radius about 1.
export function symbolOutline() {
  const shape = shapesOf(SYMBOL_PATH)[0];
  const raw = shape.extractPoints(10).shape.map((p) => new THREE.Vector2((p.x - 12) / 12, -(p.y - 12) / 12));
  // area centroid
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length], c = a.x * b.y - b.x * a.y;
    A += c; cx += (a.x + b.x) * c; cy += (a.y + b.y) * c;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  const pts = raw.map((p) => new THREE.Vector2(p.x - cx, p.y - cy));
  return pts;
}

// Split the star-shaped outline into its rays: one closed polygon per ray (centre + outline between two valleys).
export function symbolRays(pts) {
  const n = pts.length;
  const r = pts.map((p) => p.length());
  const rmax = Math.max(...r);
  // tips: local maxima of radius over a +-k window, far enough out
  const k = Math.max(3, Math.floor(n / 60));
  const tips = [];
  for (let i = 0; i < n; i++) {
    if (r[i] < rmax * 0.42) continue;
    let best = true;
    for (let j = -k; j <= k; j++) if (r[(i + j + n) % n] > r[i]) { best = false; break; }
    if (best && (!tips.length || i - tips[tips.length - 1] > k)) tips.push(i);
  }
  if (tips.length > 1 && tips[0] + n - tips[tips.length - 1] <= k) tips.pop();
  // valleys: minimum radius between consecutive tips
  const valleys = tips.map((t0, i) => {
    const t1 = tips[(i + 1) % tips.length] + (i + 1 === tips.length ? n : 0);
    let bi = t0, bv = Infinity;
    for (let j = t0; j <= t1; j++) { const v = r[j % n]; if (v < bv) { bv = v; bi = j % n; } }
    return bi;
  });
  const rays = [];
  for (let i = 0; i < valleys.length; i++) {
    const a = valleys[(i - 1 + valleys.length) % valleys.length], b = valleys[i];
    const poly = [new THREE.Vector2(0, 0)];
    for (let j = a; ; j = (j + 1) % n) { poly.push(pts[j].clone()); if (j === b) break; }
    rays.push(poly);
  }
  return rays;
}

export function rayGeometries(rays, depth = 0.16) {
  return rays.map((poly) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly), {
      depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.012, bevelSegments: 3, curveSegments: 4,
    });
    g.translate(0, 0, -depth / 2);
    // pivot at the ray's own centroid so it can tumble in flight
    const c = new THREE.Vector2();
    poly.forEach((p) => c.add(p));
    c.divideScalar(poly.length);
    g.translate(-c.x, -c.y, 0);
    g.computeVertexNormals();
    return { geo: g, home: new THREE.Vector3(c.x, c.y, 0), angle: Math.atan2(c.y, c.x) };
  });
}

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// n points: 70 % inside the symbol, 30 % on its outline
export function sampleSymbol(pts, n, rnd) {
  const out = [];
  const nEdge = Math.floor(n * 0.3);
  let per = 0;
  const seg = pts.map((p, i) => { const l = p.distanceTo(pts[(i + 1) % pts.length]); per += l; return l; });
  for (let i = 0; i < nEdge; i++) {
    let d = rnd() * per, j = 0;
    while (d > seg[j]) { d -= seg[j]; j++; }
    const a = pts[j], b = pts[(j + 1) % pts.length], f = d / seg[j];
    out.push([a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f]);
  }
  while (out.length < n) {
    const x = rnd() * 2.2 - 1.1, y = rnd() * 2.2 - 1.1;
    if (pointInPoly(x, y, pts)) out.push([x, y]);
  }
  return out;
}

// ---------------------------------------------------------------- 3D letters
// Returns per-letter geometries (pivot at each letter's baseline centre) and the layout.
export function wordGeometries(word = "CLAUDE", capH = 0.9, tracking = 0.09, depth = 0.24) {
  const s = capH / (UPM * 0.727);
  const letters = [];
  let x = 0;
  for (const ch of word) {
    const g = GLYPHS[ch];
    const shapes = shapesOf(g.d);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: depth / s, bevelEnabled: true, bevelThickness: 0.03 / s, bevelSize: 0.016 / s, bevelSegments: 4, curveSegments: 10,
    });
    geo.scale(s, s, s);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    geo.translate(-cx, 0, -depth / 2);
    geo.computeVertexNormals();
    const holes = shapes.flatMap((sh) => sh.holes.map((h) => h.getPoints(24).map((p) => new THREE.Vector2(p.x * s - cx, p.y * s))));
    letters.push({ ch, geo, x: x + cx, holes });
    x += g.adv * UPM * s + tracking * capH;
  }
  const width = x - tracking * capH;
  letters.forEach((l) => (l.x -= width / 2));
  return { letters, width };
}
