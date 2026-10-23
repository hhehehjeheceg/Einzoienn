/* AZUR v94 — ch1-landmarks-v94.js : les repères de la carte de référence, en partie normale.
 *  - la météorite en feu, figée au-dessus de son cratère près de la Méga Galerie (roche sombre aux
 *    fissures incandescentes, traînée de flammes, fumée, lueur au sol) ;
 *  - la base de lancement près de la Citadelle : aire de béton, tour de lancement et fusée ;
 *  - le volcan : panache de fumée et lueur rouge au-dessus du cratère.
 * Purement visuel (aucune collision). Masqué en mode événement, qui a sa propre météorite et sa base.
 * À charger après graphics-v94.js. */
(function (root) {
  "use strict";
  const T = root.THREE, S = root.AZSim, VP = root.AZView && root.AZView.View && root.AZView.View.prototype;
  if (!T || !S || !S.s8 || !VP || VP.__lm94) return;
  VP.__lm94 = true;
  const isEvent = () => { const w = root.AZUR && root.AZUR.world; return !!(w && w.mode === "event") || !!(root.AZEvent && root.AZEvent.active); };
  const TAU = Math.PI * 2;
  function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* -------------------------------------------------------------- textures douces */
  let SOFT = null;
  function soft() {
    if (SOFT) return SOFT;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.45, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    SOFT = new T.CanvasTexture(c); return SOFT;
  }

  /* -------------------------------------------------------------- météorite */
  function meteor() {
    const grp = new T.Group(), r = rng(77);
    const geo = new T.IcosahedronGeometry(9, 3), p = geo.attributes.position, col = new Float32Array(p.count * 3);
    const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * .55 + 1.3) * Math.cos(v.y * .62) * Math.sin(v.z * .48 + .7), k = 1 + n * .16 + (Math.sin(v.x * 1.7) * Math.sin(v.z * 1.9)) * .05;
      v.multiplyScalar(k); v.y *= .82; p.setXYZ(i, v.x, v.y, v.z);
      const hot = Math.max(0, Math.sin(v.x * .9 + v.y * .7) * Math.cos(v.z * .8 - v.y * .4)) > .72 ? 1 : 0;
      col[i * 3] = hot ? 2.6 : .16 + r() * .06; col[i * 3 + 1] = hot ? .9 : .12 + r() * .04; col[i * 3 + 2] = hot ? .2 : .11;
    }
    geo.setAttribute("color", new T.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const rock = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: .05, emissive: new T.Color("#ff6a1a"), emissiveIntensity: .0 }));
    rock.material.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += max(vColor.rgb - vec3(1.), vec3(0.)) * 1.4;");
    };
    rock.castShadow = true; grp.add(rock);
    // traînée de flammes figée (cône dirigé vers l'arrière de la chute)
    const fm = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { t: { value: 0 } },
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform float t;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}" +
        "void main(){float y=vUv.y;float k=n(vec2(vUv.x*9.,y*5.-t*2.2))*.6+n(vec2(vUv.x*19.,y*11.-t*3.7))*.4;float a=(1.-y)*(1.-y)*smoothstep(.15,.9,k+(1.-y)*.5);vec3 c=mix(vec3(1.,.95,.6),vec3(1.,.32,.05),y);gl_FragColor=vec4(c*a*1.6,a);}",
    });
    const flame = new T.Mesh(new T.ConeGeometry(10, 70, 24, 1, true), fm);
    flame.geometry.translate(0, 35, 0); flame.geometry.rotateX(Math.PI); // pointe vers +y après rotation du groupe
    flame.rotation.x = Math.PI; flame.position.y = 4; grp.add(flame);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: soft(), color: 0xff7a2a, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .8 }));
    halo.scale.set(60, 60, 1); grp.add(halo);
    // fumée
    const smoke = [], sm = new T.SpriteMaterial({ map: soft(), color: 0x3a3330, transparent: true, depthWrite: false, opacity: .55 });
    for (let i = 0; i < 14; i++) { const s = new T.Sprite(sm.clone()); s.userData.k = i / 14; grp.add(s); smoke.push(s); }
    grp.userData = { rock, flame, fm, halo, smoke };
    return grp;
  }

  /* -------------------------------------------------------------- base de lancement */
  function launchSite(base) {
    const grp = new T.Group(), A = root.AZArt;
    if (!A || !A.Model) return grp;
    const m = new A.Model();
    m.cyl(26, 28, 1.2, "#b9b6ae", 0, .6, 0, 32).cyl(9, 9, .4, "#3a3d42", 0, 1.3, 0, 24);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; m.box(1.2, .3, 9, "#e8c33a", Math.cos(a) * 18, 1.25, Math.sin(a) * 18, 0, -a, 0); }
    // tour de lancement en treillis
    const tx = 11;
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) m.box(.45, 46, .45, "#c0392b", tx + dx, 24, dz);
    for (let y = 3; y < 46; y += 3.5) { m.box(3.6, .25, .25, "#a93226", tx, y, -1.6).box(3.6, .25, .25, "#a93226", tx, y, 1.6).box(.25, .25, 3.6, "#a93226", tx - 1.6, y, 0).box(.25, .25, 3.6, "#a93226", tx + 1.6, y, 0); }
    for (const y of [18, 30, 42]) m.box(8, .4, 1.2, "#7f8c8d", tx - 5, y, 0);
    // fusée
    m.cyl(3.2, 3.2, 34, "#f4f6f7", 0, 19, 0, 24).cyl(3.25, 3.25, 3, "#c0392b", 0, 30, 0, 24).cyl(3.25, 3.25, 1.4, "#2c3e50", 0, 12, 0, 24);
    m.cyl(0, 3.2, 9, "#c0392b", 0, 40.5, 0, 24);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; m.box(.4, 7, 4, "#c0392b", Math.cos(a) * 3.6, 5.5, Math.sin(a) * 3.6, 0, -a, 0); }
    m.cyl(2, 3, 2.5, "#4a4f55", 0, 2.6, 0, 16);
    // réservoirs et bâtiment de contrôle
    for (const [x, z] of [[-18, 10], [-18, 16], [-12, 19]]) m.cyl(2.4, 2.4, 6, "#d5d8dc", x, 3.6, z, 16).cyl(.1, 2.4, 1.2, "#d5d8dc", x, 7.2, z, 16);
    m.box(10, 5, 7, "#95a5a6", 16, 3.1, 16).box(10.4, .4, 7.4, "#2c3e50", 16, 5.8, 16).box(6, 1.6, .2, "#5dade2", 16, 3.6, 12.4);
    const mesh = m.mesh(); mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh);
    grp.position.set(base.x, S.heightAt(base.x, base.z), base.z);
    return grp;
  }

  /* -------------------------------------------------------------- volcan */
  function volcanoFx(V) {
    const grp = new T.Group(), sm = [], top = S.heightAt(V.x + V.crater, V.z);
    const mat = new T.SpriteMaterial({ map: soft(), color: 0x4a4340, transparent: true, depthWrite: false, opacity: .5 });
    for (let i = 0; i < 18; i++) { const s = new T.Sprite(mat.clone()); s.userData.k = i / 18; grp.add(s); sm.push(s); }
    const glow = new T.Sprite(new T.SpriteMaterial({ map: soft(), color: 0xff5a1f, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .55 }));
    glow.scale.set(150, 70, 1); glow.position.set(V.x, top + 6, V.z); grp.add(glow);
    grp.userData = { sm, top, glow };
    return grp;
  }

  /* -------------------------------------------------------------- Point Zéro (v95) */
  // Saison X : le Point Zéro est à nu au milieu de Loot Lake — une sphère d'énergie bleu-violet qui palpite,
  // deux anneaux qui tournent, des éclairs et une colonne de lumière fine
  function zeroPoint(Lk) {
    const grp = new T.Group(), gy = Math.max(S.heightAt(Lk.x, Lk.z), -1);
    const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { t: { value: 0 } },
      vertexShader: "varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}",
      fragmentShader: "uniform float t;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){float f=1.-abs(dot(normalize(vN),normalize(vV)));float sw=.5+.5*sin(vP.y*1.3+t*2.)*sin(vP.x*1.1-t*1.4+vP.z*.9);vec3 c=mix(vec3(.35,.25,1.),vec3(.55,.95,1.),sw)*(pow(f,2.2)*1.4+.12)+vec3(.9,.6,1.)*pow(f,7.)*1.5;gl_FragColor=vec4(c,1.);}" });
    const orb = new T.Mesh(new T.SphereGeometry(7, 32, 20), mat); orb.position.set(Lk.x, gy + 14, Lk.z); grp.add(orb);
    const core = new T.Sprite(new T.SpriteMaterial({ map: soft(), color: 0xe8f0ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .95 })); core.scale.set(16, 16, 1); core.position.copy(orb.position); grp.add(core);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: soft(), color: 0x8a6bff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .55 })); halo.scale.set(70, 70, 1); halo.position.copy(orb.position); grp.add(halo);
    const rm = new T.MeshBasicMaterial({ color: 0xbfa8ff, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false });
    const r1 = new T.Mesh(new T.TorusGeometry(11, .25, 6, 64), rm), r2 = new T.Mesh(new T.TorusGeometry(13.5, .18, 6, 64), rm.clone());
    r1.position.copy(orb.position); r2.position.copy(orb.position); grp.add(r1, r2);
    const beam = new T.Mesh(new T.CylinderGeometry(.6, 1.8, 260, 10, 1, true), new T.MeshBasicMaterial({ color: 0x9c84ff, transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.set(Lk.x, gy + 14 + 130, Lk.z); grp.add(beam);
    const pl = new T.PointLight(0x9a7bff, 30, 120, 1.3); pl.position.copy(orb.position); grp.add(pl);
    grp.userData = { mat, orb, core, halo, r1, r2, pl };
    return grp;
  }

  /* -------------------------------------------------------------- intégration */
  const L = { grp: null, met: null, base: null, vol: null, t: 0 };
  function ensure(view) {
    if (L.grp || !view.scene) return;
    const s8 = S.s8;
    L.grp = new T.Group(); L.grp.name = "ch1-landmarks-v94";
    L.met = meteor();
    const mx = s8.meteor.x, mz = s8.meteor.z, gy = S.heightAt(mx, mz), EF = s8.eventFrame ? s8.eventFrame() : null;
    // v95 : figée au même endroit que dans « La Fin » (sim.js, eventFrame), le panache le long de sa trajectoire
    if (EF) { L.met.position.set(EF.MET.x, EF.MET.y, EF.MET.z); L.met.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-EF.MDIR.x, -EF.MDIR.y, -EF.MDIR.z)); }
    else { L.met.position.set(mx, gy + 26, mz); L.met.rotation.set(-.5, .9, .25); }
    L.met.userData.ground = gy; L.col = { x: L.met.position.x, y: L.met.position.y, z: L.met.position.z, Re: 9.2, Hy: 7.6 };
    L.grp.add(L.met);
    const ring = new T.Mesh(new T.RingGeometry(s8.meteor.r * .2, s8.meteor.r * 1.15, 40), new T.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(mx, gy + .35, mz); L.grp.add(ring); L.ring = ring;
    L.base = launchSite(s8.launch); L.grp.add(L.base);
    L.vol = volcanoFx(S.VOLCANO); L.grp.add(L.vol);
    if (S.LAKE) { L.zp = zeroPoint(S.LAKE); L.grp.add(L.zp); }
    if (view.quality === "high" || view.quality === "ultra") { const pl = new T.PointLight(0xff7a2a, 40, 160, 1.2); pl.position.set(mx, gy + 18, mz); L.grp.add(pl); L.light = pl; }
    view.scene.add(L.grp);
    installCollider();
  }
  /* v95 — on se pose sur la météorite figée (comme pendant la Saison X) et on ne la traverse pas */
  function installCollider() {
    const Wp = S.World && S.World.prototype; if (!Wp || L.hook || !Wp.supportAt || !Wp._blocked) return;
    const sup = Wp.supportAt, blk = Wp._blocked, on = () => L.col && !isEvent();
    // v95b : forme exacte de la roche (event-v95.js, AZRockShape) au lieu d'un ovale plus petit qu'elle
    const RS = root.AZRockShape;
    if (RS && L.met && L.met.userData.rock) { L.met.updateMatrix(); const q = new T.Matrix4().makeRotationFromQuaternion(L.met.quaternion); L.shape = RS.fromMesh(L.met.userData.rock, q); }
    const mySup = function (x, z, cy) {
      const best = sup.apply(this, arguments);
      try { if (!on()) return best; if (L.shape) { const ts = L.shape.support(L.col, x, z, cy); return ts != null && ts > best ? ts : best; } const c = L.col, d = Math.hypot(x - c.x, z - c.z); if (d >= c.Re) return best; const top = c.y + c.Hy * Math.sqrt(1 - (d / c.Re) ** 2); if (top > best && (cy == null || cy > top - 4)) return top; } catch (e) {}
      return best;
    };
    const myBlk = function (x, z, r, y) {
      if (blk.apply(this, arguments)) return true;
      try { if (!on() || y == null) return false; if (L.shape) return L.shape.blocks(L.col, x, z, r, y); const c = L.col, d = Math.hypot(x - c.x, z - c.z); if (d > c.Re + (r || .45)) return false; const dd = Math.min(d, c.Re - 1e-3), h = c.Hy * Math.sqrt(1 - (dd / c.Re) ** 2); return y < c.y + h - .35 && y + 1.7 > c.y - h; } catch (e) { return false; }
    };
    Wp.supportAt = mySup; Wp._blocked = myBlk; L.hook = true;
  }
  const prev = VP.update;
  VP.update = function (w, p, dt, opts) {
    const r = prev.apply(this, arguments);
    try {
      if (!(opts && opts.menu) && w) {
        ensure(this);
        if (L.grp) {
          const ev = isEvent();
          L.grp.visible = !ev;
          if (!ev) {
            L.t += Math.min(.1, Math.max(0, +dt || 0));
            const t = L.t, u = L.met.userData;
            u.fm.uniforms.t.value = t; // v95b : la roche ne tourne plus (elle bougeait sous les pieds)
            u.halo.material.opacity = .7 + Math.sin(t * 3.1) * .1;
            for (const s of u.smoke) { const k = (s.userData.k + t * .05) % 1; s.position.set(Math.sin(k * 9 + s.userData.k * 20) * (4 + k * 18), 8 + k * 80, Math.cos(k * 7) * (3 + k * 10)); const sc = 10 + k * 46; s.scale.set(sc, sc, 1); s.material.opacity = .5 * (1 - k) * Math.min(1, k * 6); }
            L.ring.material.opacity = .35 + Math.sin(t * 2.3) * .12;
            const v = L.vol.userData, V = S.VOLCANO;
            for (const s of v.sm) { const k = (s.userData.k + t * .02) % 1; s.position.set(V.x + Math.sin(k * 5 + s.userData.k * 13) * (6 + k * 50) + k * 60, v.top + 10 + k * 220, V.z + Math.cos(k * 4) * (5 + k * 30)); const sc = 30 + k * 120; s.scale.set(sc, sc, 1); s.material.opacity = .42 * (1 - k) * Math.min(1, k * 5); }
            v.glow.material.opacity = .45 + Math.sin(t * 1.3) * .1;
            if (L.zp) { const z = L.zp.userData, pul = 1 + .05 * Math.sin(t * 2.3) + .03 * Math.sin(t * 7.1); z.mat.uniforms.t.value = t; z.orb.scale.setScalar(pul); z.r1.rotation.set(t * .5, t * .3, 0); z.r2.rotation.set(-t * .35, 0, t * .45); z.core.material.opacity = .8 + .2 * Math.sin(t * 9); z.halo.material.opacity = .45 + .12 * Math.sin(t * 1.7); z.pl.intensity = 26 + 6 * Math.sin(t * 3); }
          }
        }
      }
    } catch (e) { if (!L.err) { L.err = 1; if (root.console) console.warn("[AZUR repères]", e); } }
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
