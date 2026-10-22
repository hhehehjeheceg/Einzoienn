// =====================================================================================================
//  The spark: the one object of the film. Twelve glazed terracotta rays (slightly irregular, hand-made),
//  each on its own pivot so they can grow one after another, plus the ember it is born from.
//  Scenes place it with sparkAt(); its look is the same everywhere.
// =====================================================================================================
const SPARK = group();
const RAYS = [];
(() => {
  const r = mulberry32(1212);
  function rayShape(L, w0, w1) {   // a tapered petal along +x with round ends
    const s = new THREE.Shape();
    s.moveTo(0, -w0);
    s.bezierCurveTo(L * .32, -w0 * 1.12, L * .72, -w1 * 1.35, L - w1, -w1);
    s.absarc(L - w1, 0, w1, -Math.PI / 2, Math.PI / 2, false);
    s.bezierCurveTo(L * .72, w1 * 1.35, L * .32, w0 * 1.12, 0, w0);
    s.absarc(0, 0, w0, Math.PI / 2, Math.PI * 1.5, false);
    return s;
  }
  for (let i = 0; i < 12; i++) {
    const L = .84 + r() * .17, w0 = .1 + r() * .016, w1 = .05 + r() * .012, depth = .075;
    const g = new THREE.ExtrudeGeometry(rayShape(L, w0, w1), { depth, bevelEnabled: true, bevelThickness: .03, bevelSize: .026, bevelSegments: 5, curveSegments: 18 });
    g.translate(0, 0, -depth / 2 + (i % 3 - 1) * .006);   // tiny depth offsets: no z-fighting where the rays cross
    const m = new THREE.Mesh(g, MAT.clay);
    const pv = new THREE.Group(); pv.add(m);
    pv.rotation.z = i * TAU / 12 + (r() - .5) * .14;
    pv.rotation.x = (r() - .5) * .16;   // a little relief: the rays are not all in one plane
    SPARK.add(pv);
    RAYS.push({ pv, m, d: r() });
  }
})();
// the ember (before the rays exist) and a hot core that shows through the hub
const EMBER = new THREE.Mesh(new THREE.SphereGeometry(.12, 40, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb08a).multiplyScalar(2.2) }));
SPARK.add(EMBER);
const HUB = new THREE.Mesh(new THREE.SphereGeometry(.13, 40, 20), MAT.clay);
HUB.scale.set(1, 1, .62); SPARK.add(HUB);

// grow: 0..1 global growth, or a function i -> growth of ray i
function sparkAt(x, y, z, s, rx, ry, rz, grow = 1, ember = 0) {
  SPARK.visible = s > .0005;
  SPARK.position.set(x, y, z); SPARK.scale.setScalar(Math.max(1e-4, s));
  SPARK.rotation.set(rx, ry, rz);
  RAYS.forEach((R, i) => {
    const g = typeof grow === 'function' ? grow(i) : grow;
    R.pv.visible = g > .002;
    R.pv.scale.set(Math.max(1e-3, g), Math.max(1e-3, .55 + .45 * Math.min(1, g)), Math.max(1e-3, .55 + .45 * Math.min(1, g)));
  });
  const gAll = typeof grow === 'function' ? grow(11) : grow;
  HUB.visible = gAll > .02; HUB.scale.set(clamp(gAll * 1.5), clamp(gAll * 1.5), .62 * clamp(gAll * 1.5));
  EMBER.visible = ember > .002; EMBER.scale.setScalar(Math.max(1e-3, ember));
}
const sparkScreen = () => proj(SPARK.position.x, SPARK.position.y, SPARK.position.z);
