/* AZUR v67 — objets au sol plus lisibles.
 * Chaque objet posé reçoit un faisceau lumineux vertical à la couleur de sa
 * rareté (or pour les armes de Midas) et les armes sont présentées plus grandes.
 * Géométrie et matériaux partagés : un seul programme GPU pour tous les faisceaux. */
(function (root) {
  'use strict';
  const T = root.THREE, V = root.AZView?.View?.prototype;
  if (!T || !V?.update) return;
  const clock = { value: 0 };
  let geo = null;
  const mats = new Map();
  function beamMaterial(color) {
    if (mats.has(color)) return mats.get(color);
    const m = new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(color) }, uTime: clock },
      vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying float vH; varying vec3 vN; varying vec3 vV;' +
        'void main(){ float edge = pow(1.0 - abs(dot(vN, vV)), 1.5); float fade = pow(1.0 - vH, 2.2);' +
        ' float flow = .75 + .25 * sin(vH * 14.0 - uTime * 4.0);' +
        ' gl_FragColor = vec4(uColor * 1.4, (.18 + edge * .55) * fade * flow); }',
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false
    });
    mats.set(color, m);
    return m;
  }
  const previous = V.update;
  V.update = function (w, p, dt, opts) {
    const out = previous.apply(this, arguments);
    clock.value = this.time || 0;
    if (!w?.loot || !this.loot?.size || this.quality === 'low') return out;
    if (!geo) { geo = new T.CylinderGeometry(.34, .26, 2.8, 14, 1, true); geo.translate(0, 1.4, 0); }
    for (const l of w.loot) {
      const m = this.loot.get(l.id);
      if (!m || m.userData.v67Beam === (l.gold ? 'g' : 'n')) continue;
      const old = m.userData.v67BeamMesh; if (old) m.remove(old);
      const rar = root.AZSim?.rarities?.[l.rarity | 0]?.color || '#aab8c8';
      const beam = new T.Mesh(geo, beamMaterial(l.gold ? '#ffd34d' : rar));
      beam.position.y = -.42; beam.renderOrder = 3; beam.frustumCulled = true;
      m.add(beam); m.userData.v67BeamMesh = beam; m.userData.v67Beam = l.gold ? 'g' : 'n';
      if (l.kind === 'weapon' && m.children[0] && !m.userData.v67Scaled) { m.children[0].scale.setScalar(1.3); m.userData.v67Scaled = true; }
    }
    return out;
  };
})(window);
