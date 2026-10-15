/* AZUR Horizons — original procedural models, shared materials and articulated rigs. */
(function (root) {
  "use strict";
  const T = root.THREE,
    S = root.AZSim;
  const C = {
    ink: "#183348",
    dark: "#253847",
    gold: "#ffc669",
    white: "#f8f1dc",
    skin: "#c98b68",
    sea: "#31bccb",
    coral: "#f48c63",
  };
  // One shared vertex-colour material serves general procedural props. Build
  // materials are likewise cached, but use physically legible roughness/metalness
  // so timber, masonry and plated metal do not merely differ by tint.
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.06 });
  const buildMaterials = {
    wood: new T.MeshStandardMaterial({ vertexColors: true, roughness: .90, metalness: 0 }),
    stone: new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    metal: new T.MeshStandardMaterial({ vertexColors: true, roughness: .34, metalness: .64 }),
  };
  function rng(seed) {
    let a = seed | 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  class Model {
    // Avatar callers may request a low-detail mesh while retaining the exact
    // same articulation and material palette.  Default/high preserves the
    // established authored silhouettes; low only reduces round tessellation.
    constructor(detail = "high") {
      this.p = [];
      this.n = [];
      this.c = [];
      this.detail = detail === "low" ? "low" : "high";
    }
    add(g, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      if (g.index) {
        const q = g.toNonIndexed();
        g.dispose();
        g = q;
      }
      g.scale(sx, sy, sz);
      g.rotateX(rx);
      g.rotateY(ry);
      g.rotateZ(rz);
      g.translate(x, y, z);
      const p = g.attributes.position,
        n = g.attributes.normal,
        c = new T.Color(col);
      for (let i = 0; i < p.count; i++) {
        this.p.push(p.getX(i), p.getY(i), p.getZ(i));
        this.n.push(n.getX(i), n.getY(i), n.getZ(i));
        this.c.push(c.r, c.g, c.b);
      }
      g.dispose();
      return this;
    }
    box(w, h, d, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      return this.add(new T.BoxGeometry(w, h, d), col, x, y, z, rx, ry, rz);
    }
    ball(r, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 1) {
      const d = this.detail === "low" ? Math.max(0, Math.floor(detail) - 1) : Math.max(0, Math.min(2, Math.floor(detail)));
      return this.add(new T.IcosahedronGeometry(r, d), col, x, y, z, 0, 0, 0, sx, sy, sz);
    }
    sphere(r, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
      const seg = this.detail === "low" ? 10 : 16, rings = this.detail === "low" ? 8 : 12;
      return this.add(new T.SphereGeometry(r, seg, rings), col, x, y, z, 0, 0, 0, sx, sy, sz);
    }
    cyl(top, bottom, h, col, x = 0, y = 0, z = 0, segments = 12, rx = 0, rz = 0, sx = 1, sz = 1) {
      const seg = this.detail === "low" ? Math.max(6, Math.floor(segments * .72)) : segments;
      return this.add(new T.CylinderGeometry(top, bottom, h, seg), col, x, y, z, rx, 0, rz, sx, 1, sz);
    }
    // Tailored low-poly volumes, batched exactly like the primitive helpers. Each
    // ring is [height, half-width, half-depth, centre-X?, centre-Z?]. Flat normals
    // make seams/cheek planes readable without textures or per-part materials.
    loft(rings, col, segments = 10) {
      segments = this.detail === "low" ? Math.max(6, Math.floor(segments * .72)) : segments;
      const points = [], indices = [];
      for (const r of rings) for (let i = 0; i < segments; i++) {
        const a = i * Math.PI * 2 / segments;
        points.push((r[3] || 0) + Math.cos(a) * r[1], r[0], (r[4] || 0) + Math.sin(a) * r[2]);
      }
      for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
        const a = j * segments + i, b = j * segments + (i + 1) % segments;
        indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
      for (let end = 0; end < 2; end++) {
        const j = end ? rings.length - 1 : 0, r = rings[j], centre = points.length / 3;
        points.push(r[3] || 0, r[0], r[4] || 0);
        for (let i = 0; i < segments; i++) {
          const a = j * segments + i, b = j * segments + (i + 1) % segments;
          indices.push(centre, end ? b : a, end ? a : b);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(points, 3)); g.setIndex(indices);
      const flat = g.toNonIndexed(); g.dispose(); flat.computeVertexNormals();
      return this.add(flat, col);
    }
    mesh() {
      let g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      g.computeBoundingSphere();
      let m = new T.Mesh(g, material);
      m.castShadow = m.receiveShadow = true;
      return m;
    }
  }
  function cosmetic(id, fallback) {
    return root.AZMeta?.catalog.find((c) => c.id === id) || { color: fallback || C.coral, secondary: C.gold };
  }
  // Weapon axes point toward -Z.  The attachment metadata lets the view align hands
  // without baking a pose into each of the (reusable) loot meshes.
  function weapon(key = "rifle", col = "#b3c5cb", wrap = "") {
    const m = new Model(),
      dark = "#172b38",
      metal = "#5f7882",
      warm = "#a66d3f",
      glow = "#71e8ed";
    const spec = {
      pistol: { length: 0.55, grip: [0, -0.11, 0.1], muzzle: [0, 0.02, -0.5] },
      revolver: { length: 0.62, grip: [0, -0.12, 0.11], muzzle: [0, 0.02, -0.56] },
      rifle: { length: 1.02, grip: [0, -0.12, 0.13], muzzle: [0, 0.02, -0.91] },
      burst: { length: 1.04, grip: [0, -0.12, 0.13], muzzle: [0, 0.02, -0.94] },
      smg: { length: 0.82, grip: [0, -0.13, 0.11], muzzle: [0, 0.02, -0.73] },
      shotgun: { length: 0.97, grip: [0, -0.13, 0.12], muzzle: [0, 0, -0.88] },
      tactical: { length: 0.9, grip: [0, -0.13, 0.12], muzzle: [0, 0.02, -0.81] },
      sniper: { length: 1.42, grip: [0, -0.12, 0.17], muzzle: [0, 0.02, -1.28] },
      dmr: { length: 1.2, grip: [0, -0.12, 0.15], muzzle: [0, 0.02, -1.08] },
      launcher: { length: 1.12, grip: [0, -0.14, 0.12], muzzle: [0, 0.02, -1.02] },
    }[key] || { length: 1.02, grip: [0, -0.12, 0.13], muzzle: [0, 0.02, -0.91] };
    const len = spec.length, front = spec.muzzle[2], hand = key === 'pistol' || key === 'revolver';
    // Ten authored silhouettes, not the same rifle with accessories attached. All
    // barrels end at the exported muzzle (including the dark recessed bore).
    const barrel = (radius, back, colour = metal, x = 0, y = spec.muzzle[1]) => {
      const tip = front + .012;
      m.cyl(radius, radius, back - tip, colour, x, y, (back + tip) / 2, 10, Math.PI / 2)
        .add(new T.TorusGeometry(radius * .84, radius * .16, 5, 10), metal, x, y, front + .006)
        .cyl(radius * .66, radius * .66, .012, dark, x, y, front + .023, 10, Math.PI / 2);
    };
    const stock = (length = .35, colour = dark) => {
      m.box(.085, .065, length, metal, 0, .005, .12 + length / 2)
        .box(.145, .21, .085, colour, 0, -.045, .12 + length)
        .box(.12, .052, length * .67, col, 0, .07, .12 + length * .54);
    };
    const rail = (z, length) => {
      m.box(.10, .036, length, dark, 0, .12, z);
      for (let i = 0; i < 6; i++) m.box(.125, .017, .021, metal, 0, .147, z - length * .4 + i * length * .16);
    };
    // Pistol grips and trigger guards are common hardware, never a phantom stock
    // on a revolver. Split guard bars leave a real opening around the trigger.
    m.box(.079, .225, .115, hand ? warm : dark, 0, -.125, .105, .22)
      .box(.023, .028, .135, metal, -.056, -.19, -.02)
      .box(.023, .028, .135, metal, .056, -.19, -.02)
      .box(.115, .105, .022, metal, 0, -.14, -.087)
      .box(.021, .073, .023, C.gold, 0, -.12, -.032, -.24);
    if (key === 'pistol') {
      m.box(.15, .125, .43, col, 0, .026, -.17)
        .box(.128, .048, .36, metal, 0, .105, -.18)
        .box(.072, .018, .075, dark, 0, .133, -.13)
        .box(.035, .032, .032, glow, 0, .137, -.36)
        .box(.14, .035, .13, dark, 0, -.235, .13);
      for (const x of [-.077, .077]) for (let i=0;i<4;i++) m.box(.009, .095, .014, dark, x, .043, -.055 + i*.033);
      barrel(.041, -.3);
    } else if (key === 'revolver') {
      m.box(.12, .095, .37, col, 0, .092, -.18)
        .cyl(.113, .113, .19, warm, 0, -.005, -.12, 10, Math.PI / 2)
        .box(.118, .074, .15, warm, 0, -.227, .135, -.18)
        .box(.04, .075, .06, metal, 0, .104, .073, -.4)
        .box(.095, .056, .24, col, 0, -.045, -.36);
      for(let i=0;i<6;i++) { const a=i*Math.PI/3; m.cyl(.021,.021,.195,dark,Math.cos(a)*.087,Math.sin(a)*.087-.005,-.12,6,Math.PI/2); }
      barrel(.053, -.21);
    } else if (key === 'launcher') {
      // Wide recoil-less tube with a flared rear, open front ring and side optic.
      m.cyl(.16, .19, .88, col, 0, .02, -.39, 14, Math.PI / 2)
        .cyl(.215, .17, .16, metal, 0, .02, .14, 14, Math.PI / 2)
        .cyl(.164, .164, .025, dark, 0, .02, .226, 12, Math.PI / 2)
        .box(.24, .085, .4, dark, 0, -.14, -.38)
        .box(.12, .10, .3, warm, 0, -.18, -.25)
        .box(.07, .16, .23, dark, -.2, .12, -.23)
        .box(.022, .07, .15, glow, -.24, .18, -.23);
      barrel(.185, -.79, col);
      for (const z of [-.73,-.54]) m.cyl(.194,.194,.04,C.gold,0,.02,z,12,Math.PI/2);
    } else if (key === 'smg') {
      m.box(.19,.18,.4,col,0,.015,-.17)
        .box(.145,.12,.23,dark,0,.004,-.45)
        .box(.084,.32,.13,metal,0,-.23,-.17,.18)
        .box(.095,.034,.135,C.gold,0,-.394,-.14)
        .box(.085,.045,.27,dark,0,.06,.19)
        .box(.1,.16,.06,metal,0,-.005,.31)
        .box(.21,.095,.12,dark,0,.19,-.23)
        .box(.15,.044,.016,glow,0,.199,-.295);
      barrel(.047,-.44); rail(-.23,.32);
      for(const x of [-.1,.1]) for(let i=0;i<3;i++)m.box(.014,.065,.025,dark,x,.02,-.34+i*.058);
    } else if (key === 'shotgun') {
      m.box(.16,.145,.35,col,0,.025,-.04)
        .box(.135,.15,.28,warm,0,-.05,-.43)
        .cyl(.032,.032,.71,dark,0,-.075,-.39,8,Math.PI/2)
        .box(.105,.032,.64,metal,0,.096,-.4);
      barrel(.052,-.18); stock(.39,warm);
      for(let i=0;i<6;i++)m.box(.146,.158,.016,dark,0,-.05,-.545+i*.039);
      for(let i=0;i<4;i++)m.cyl(.026,.026,.1,C.coral,.103,.025,.055-i*.066,6);
    } else if (key === 'tactical') {
      m.box(.23,.22,.46,col,0,.015,-.14)
        .cyl(.15,.15,.14,dark,0,-.19,-.15,12,Math.PI/2)
        .cyl(.12,.12,.147,metal,0,-.19,-.15,12,Math.PI/2)
        .box(.18,.135,.3,dark,0,-.014,-.52)
        .box(.2,.025,.24,C.gold,0,.07,-.51);
      barrel(.068,-.55); stock(.28); rail(-.25,.46);
      m.box(.20,.10,.045,metal,0,.215,-.28).box(.12,.047,.012,glow,0,.215,-.308);
    } else if (key === 'burst') {
      // Bullpup: magazine and shoulder pad BEHIND the trigger, short ribbed fore-end.
      m.box(.21,.195,.7,col,0,.006,-.06)
        .box(.17,.225,.115,dark,0,-.035,.32)
        .box(.105,.245,.17,metal,0,-.21,.22,-.15)
        .box(.22,.13,.26,dark,0,-.015,-.47)
        .box(.045,.09,.26,glow,-.12,.014,-.18)
        .box(.045,.09,.26,glow,.12,.014,-.18)
        .box(.15,.08,.19,dark,0,.215,-.18)
        .box(.105,.05,.02,glow,0,.215,-.286);
      barrel(.041,-.46); rail(-.2,.46);
    } else {
      const precision = key === 'sniper' || key === 'dmr';
      m.box(.175,.165,precision ? .45 : .39,col,0,.012,-.09)
        .box(.105,.23,precision ? .17 : .21,dark,0,-.2,-.09,.21)
        .box(.13,.036,.17,metal,0,-.314,-.068)
        .box(precision ? .14 : .18,.14,precision ? .41 : .33,precision ? warm : metal,0,.012,-.43)
        .box(.031,.065,.11,dark,.092,.027,-.075)
        .box(.04,.025,.085,C.gold,.114,.021,.037);
      stock(key === 'sniper' ? .46 : .34); barrel(key === 'sniper' ? .046 : .038, -.48); rail(-.21,.47);
      if (precision) {
        const scope = key === 'sniper' ? .43 : .27;
        m.box(.085,.09,.07,metal,0,.172,-.13).box(.085,.09,.07,metal,0,.172,-.33)
          .cyl(.063,.063,scope,dark,0,.245,-.24,12,Math.PI/2)
          .cyl(.08,.064,.085,metal,0,.245,-.24-scope/2+.02,12,Math.PI/2)
          .cyl(.059,.059,.008,glow,0,.245,-.24-scope/2-.024,12,Math.PI/2)
          .cyl(.038,.038,.07,metal,0,.317,-.21,8)
          .box(.155,.06,.21,warm,0,.1,.3);
        if(key === 'sniper') {
          for(const side of [-1,1]) m.box(.035,.21,.04,metal,side*.083,-.117,-.7,0,0,-side*.3);
          m.cyl(.068,.068,.09,metal,0,.02,front+.066,10,Math.PI/2);
        } else for(const side of [-1,1]) m.box(.021,.043,.29,C.gold,side*.082,.01,-.45);
      } else {
        m.box(.035,.12,.034,dark,0,.17,-.57).box(.115,.02,.034,metal,0,.23,-.57);
        for(const side of [-1,1])for(let i=0;i<5;i++)m.box(.018,.08,.022,dark,side*.095,.02,-.55+i*.045);
      }
    }
    // v1.4 mechanical pass: magazines, ejection ports, fasteners and heat guards
    // stay batched while making each silhouette read from the third-person camera.
    if (['rifle','dmr','burst'].includes(key)) {
      m.box(.13,.28,.13,dark,0,-.22,-.06,.17)
        .box(.115,.034,.11,C.gold,0,-.37,-.03,.17)
        .box(.075,.035,.22,metal,.125,.055,-.13)
        .box(.035,.055,.11,dark,-.13,.10,-.18);
      for(let rib=0;rib<4;rib++) m.box(.138,.012,.025,metal,0,-.29+rib*.052,-.065+rib*.008,.17);
    }
    if (hand) {
      for(let groove=0;groove<4;groove++) m.box(.012,.055,.018,dark,-.06+groove*.04,.10,-.34);
      m.box(.035,.055,.08,metal,.10,.035,-.12).sphere(.018,C.gold,.115,.055,-.16,1,.65,1);
    }
    if (key === 'smg') m.box(.04,.07,.18,C.gold,-.115,.12,-.31).box(.028,.045,.22,glow,.118,.04,-.27);
    if (key === 'shotgun' || key === 'tactical') {
      for(let shell=0;shell<4;shell++) m.cyl(.018,.018,.09,shell%2?C.coral:C.gold,.105,.035,.02-shell*.075,7,Math.PI/2);
    }
    for (const side of [-1,1]) m.sphere(.011,C.gold,side*(hand?.058:.092),.065,-.13,1,1,.45);
    // Shared mechanical status strip: a slim illuminated bolt/charge rail gives
    // every family a readable authored detail from the play camera while remaining
    // part of the one vertex-colour batch. Silhouette-specific bodies above still
    // define the ten distinct weapon families.
    const railLength = hand ? .16 : key === 'sniper' ? .26 : key === 'launcher' ? .22 : .20;
    m.box(.028, .035, railLength, glow, hand ? .09 : .12, .13, -.22);
    // Wraps cover the receiver cheeks as well as the top: visible from the menu,
    // third-person camera and ground loot, still a single vertex-colour draw call.
    if (wrap) {
      const w = cosmetic(wrap, '#55d8d4'), width = key === 'launcher' ? .193 : key === 'tactical' ? .121 : .108;
      for (const side of [-1, 1]) {
        m.box(.012,.068,Math.min(.29,len*.38),w.color,side*width,.034,-len*.19)
          .box(.014,.027,.07,w.secondary,side*width,.035,-len*.19-.09,0,side*.08,.25);
      }
      m.box(.14,.014,.20,w.color,0,hand?.136:.106,-.1);
    }
    const mesh = m.mesh();
    mesh.userData = {
      weapon: key,
      wrap,
      // All attachment points share the authored -Z barrel convention.  The pose
      // solver in render-upgrades keeps wrists on these points rather than guessing.
      grip: spec.grip,
      supportGrip: hand ? [-.025, -.11, .075] : [-.035, key === 'launcher' ? -.10 : -.01, key === 'launcher' ? -.13 : key === 'smg' ? -.16 : -.19],
      presentation: { extension: hand ? .25 : .19, kick: key === 'shotgun' || key === 'sniper' ? .065 : hand ? .044 : .035 },
      muzzle: spec.muzzle,
      barrelAxis: [0, 0, -1],
    };
    return mesh;
  }
  function avatar(eq = {}, requestedDetail = eq.detail) {
    // Detail is optional API surface: view integration can pass its current quality
    // without altering any saved equipment/network shape.
    const detail = requestedDetail === "low" ? "low" : "high";
    const group = new T.Group(),
      torso = new T.Group();
    group.add(torso);
    const ch = eq.character || "char-ambre",
      c = cosmetic(ch),
      v = cosmetic(eq.variant),
      palette = c.palette || "coral";
    const skinByPalette = {
        coral: "#c98b68", sky: "#b77950", sage: "#865639", pearl: "#e9b293", copper: "#9c6044",
        mist: "#bd8265", iris: "#744b37", flint: "#a96c49", lumen: "#c78660", mistral: "#9b6348",
        clay: "#8f593e", aster: "#734f4c", foam: "#d59b78", lichen: "#8b593e"
      },
      hairByPalette = {
        coral: "#2c252d", sky: "#173b5b", sage: "#3e3026", pearl: "#f8d6e7", copper: "#c9653c",
        mist: "#ddd3ff", iris: "#193c3c", flint: "#4a2b25", lumen: "#f4d45a", mistral: "#2a4366",
        clay: "#432d2a", aster: "#c9c5ff", foam: "#e7fafb", lichen: "#344829"
      },
      eyeByPalette = {
        coral: "#2d807d", sky: "#5bb9df", sage: "#809a55", pearl: "#795f9e", copper: "#8e603d",
        mist: "#6f63af", iris: "#47b5a7", flint: "#9b6844", lumen: "#4a8eaf", mistral: "#6686bf",
        clay: "#7b8d54", aster: "#a57fcc", foam: "#4caab7", lichen: "#6d8b4d"
      },
      body = eq.variant && eq.variant !== "variant-aube" ? v.color : c.color,
      accent = c.secondary,
      skin = skinByPalette[palette] || (ch === "char-onyx" ? "#6f4d4a" : "#c98b68"),
      hair = hairByPalette[palette] || "#2c252d",
      hood = ch === "char-onyx" || palette === "aster",
      outfit =
        ch === "char-azur"
          ? "#236e9d"
          : ch === "char-sauge"
            ? "#557e58"
            : ch === "char-nacre"
              ? "#476a91"
              : ch === "char-cuivre"
                ? "#9b563b"
                : hood
                  ? "#303554"
                  : body,
      trim = ch === "char-nacre" ? "#f6dce6" : ch === "char-cuivre" ? "#f2b764" : accent;
    const modelRole = { "char-ambre":"scout", "char-azur":"scout", "char-nacre":"scout", "char-cuivre":"mechanic", "char-sauge":"ranger", "char-onyx":"sentinel" };
    const archetype = modelRole[c.model] || c.model || eq.model || modelRole[ch] || "scout";
    const core = new Model(detail);
    core
      .loft([[1.01,.20,.14],[1.16,.205,.155],[1.39,.273,.172],[1.50,.235,.145],[1.55,.13,.105]], outfit, 12)
      .sphere(0.23, outfit, 0, 1.08, 0, 1, 0.65, 0.72)
      .cyl(0.2, 0.23, 0.24, ch === "char-nacre" ? outfit : C.ink, 0, 0.96, 0, 10, 0, 0, 1, 0.8)
      .cyl(0.215, 0.215, 0.085, "#584533", 0, 1.045, 0, 12, 0, 0, 1, 0.83)
      .box(0.105, 0.08, 0.06, trim, 0, 1.04, -0.194)
      .box(0.058, 0.48, 0.038, "#574738", -0.155, 1.32, -0.18, 0, 0, -0.16)
      .box(0.058, 0.48, 0.038, "#574738", 0.155, 1.32, -0.18, 0, 0, 0.16)
      .box(0.14, 0.12, 0.065, accent, -0.13, 1.17, -0.196)
      .box(0.11, 0.11, 0.07, C.ink, 0.13, 1.18, -0.2)
      .cyl(0.106, 0.115, 0.15, skin, 0, 1.585, 0, 12)
      .cyl(0.17, 0.21, 0.12, accent, 0, 1.56, 0, 12, 0, 0, 1, 0.75);
    // Expedition jacket: a shaped waist, asymmetric hip flaps, raised lapels and
    // separate chest panels replace the old cylindrical mannequin silhouette.
    core.loft([[.84,.23,.165],[.99,.225,.15],[1.08,.205,.148]], outfit, 12)
      .box(.17,.19,.052,body,-.125,1.38,-.176,0,.12,-.08)
      .box(.17,.19,.052,body,.125,1.38,-.176,0,-.12,.08)
      .box(.082,.23,.048,trim,-.09,1.47,-.145,-.2,-.1,-.31)
      .box(.082,.23,.048,trim,.09,1.47,-.145,-.2,.1,.31)
      .box(.017,.34,.014,C.gold,0,1.28,-.205)
      .box(.13,.14,.09,C.ink,-.245,1.005,-.07,0,0,.12)
      .box(.09,.10,.018,trim,-.254,1.015,-.125)
      .box(.095,.19,.084,'#64513e',.24,.965,.015,0,0,-.12)
      .box(.22,.028,.038,trim,0,1.20,.174);
    // v0.8 field kit: sculpted segmented shoulder guards, radio and utility
    // stitching stay inside the existing torso batch (no new draw calls).
    for (const side of [-1, 1]) {
      core.loft([[1.44,.068,.09,side*.265,.015],[1.49,.095,.114,side*.265,.015],[1.535,.074,.09,side*.265,.015]], trim, 8)
        .box(.075,.014,.19,'#e5efcf',side*.265,1.523,.0,0,0,side*.13)
        .box(.11,.032,.018,trim,side*.123,1.345,-.278)
        .box(.023,.024,.012,C.gold,side*.124,1.288,-.282);
      for(let stitch=0;stitch<3;stitch++)core.box(.008,.011,.011,'#dcc9a3',side*.193,1.18+stitch*.05,-.252);
    }
    core.box(.085,.15,.065,C.ink,-.22,1.395,-.242)
      .box(.055,.04,.012,'#81ecd8',-.22,1.432,-.279)
      .cyl(.008,.008,.14,'#374956',-.245,1.526,-.23,6)
      .box(.04,.05,.017,'#516b77',-.22,1.371,-.286)
      .box(.19,.07,.016,trim,0,1.423,.183)
      .box(.023,.055,.02,C.ink,0,1.423,.197)
      /* v19: backpack straps over the jacket front — kit read, silhouette kept. */
      .box(.05,.32,.02,"#2c3540",-.14,1.36,.172,0,0,.05)
      .box(.05,.32,.02,"#2c3540",.14,1.36,.172,0,0,-.05);
    // v0.9 close-up read: a layered collar, compass clasp and restrained seam
    // piping refine the original stylised expedition jacket without new meshes.
    core.cyl(.145,.175,.052,trim,0,1.535,-.003,12,0,0,1,.78)
      .box(.042,.042,.025,C.gold,0,1.365,-.249)
      .box(.022,.022,.014,'#8ee8e8',0,1.365,-.266)
      .box(.018,.30,.014,trim,-.205,1.30,-.249,0,0,-.08)
      .box(.018,.30,.014,trim,.205,1.30,-.249,0,0,.08)
      .box(.19,.025,.024,C.ink,0,1.105,-.218)
      .box(.075,.026,.028,C.gold,0,1.106,-.239);
    // Close-range tailoring: layered belt hardware, pocket bellows, reinforced
    // side seams and shoulder fasteners turn the outfit into wearable equipment.
    if (detail === "high") {
      core.box(.46,.052,.072,C.ink,0,1.08,-.012)
        .box(.092,.076,.044,C.gold,0,1.08,-.216)
        .box(.052,.042,.052,"#69dbe2",0,1.08,-.243)
        .box(.132,.135,.064,body,-.15,1.205,-.222,0,.06,-.025)
        .box(.132,.135,.064,body,.15,1.205,-.222,0,-.06,.025)
        .box(.105,.018,.015,trim,-.15,1.252,-.258)
        .box(.105,.018,.015,trim,.15,1.252,-.258)
        .box(.014,.29,.018,"#e4c795",-.272,1.31,-.055,0,0,-.05)
        .box(.014,.29,.018,"#e4c795",.272,1.31,-.055,0,0,.05);
      for (const side of [-1,1]) for (let i=0;i<3;i++)
        core.ball(.018,i===1?"#80e8e5":C.gold,side*(.235+i*.012),1.45+i*.025,-.142,.72,.55,.72,1);
    }
    // Role-specific outer layers keep the same skeleton while making every expeditioner legible at play distance.
    if (ch === "char-ambre")
      core.box(0.36, 0.08, 0.055, "#815737", 0, 1.16, -0.19)
        .cyl(.225,.18,.35,"#315361",0,1.31,-.015,12,0,0,1,.83)
        .box(.018,.31,.02,"#f3be62",0,1.31,-.212)
        .box(.12,.13,.035,"#456775",-.125,1.27,-.21)
        .box(.12,.13,.035,"#456775",.125,1.27,-.21)
        .box(.11,.022,.041,"#e1ae61",-.125,1.32,-.23)
        .box(.11,.022,.041,"#e1ae61",.125,1.32,-.23)
        .box(0.11, 0.3, 0.08, trim, -0.25, 1.34, -0.08)
        .box(0.11, 0.3, 0.08, trim, 0.25, 1.34, -0.08);
    else if (ch === "char-azur")
      core.box(0.43, 0.36, 0.08, outfit, 0, 1.31, -0.19)
        .box(0.075, 0.55, 0.038, "#d9f4ff", -0.08, 1.36, -0.235, 0, 0, -0.42)
        .box(0.115, 0.11, 0.06, trim, 0.14, 1.2, -0.23);
    else if (ch === "char-sauge")
      core.box(0.46, 0.32, 0.11, outfit, 0, 1.29, -0.19)
        .box(0.13, 0.16, 0.065, "#d6bd7c", -0.16, 1.26, -0.255)
        .box(0.13, 0.16, 0.065, "#d6bd7c", 0.16, 1.26, -0.255)
        .box(0.1, 0.07, 0.08, "#f0d782", 0, 1.43, -0.255);
    else if (ch === "char-nacre")
      core.cyl(0.285, 0.225, 0.48, outfit, 0, 1.29, 0, 14, 0, 0, 1, 0.72)
        .box(0.05, 0.44, 0.055, trim, -0.19, 1.3, -0.18)
        .box(0.05, 0.44, 0.055, trim, 0.19, 1.3, -0.18)
        .sphere(0.09, "#75e7e8", 0, 1.36, -0.235, 0.72, 0.72, 0.32);
    else if (ch === "char-cuivre")
      core.box(0.4, 0.45, 0.12, outfit, 0, 1.27, -0.18)
        .box(0.06, 0.49, 0.042, "#f0b85c", -0.13, 1.35, -0.245, 0, 0, -0.18)
        .box(0.06, 0.49, 0.042, "#f0b85c", 0.13, 1.35, -0.245, 0, 0, 0.18)
        .box(0.12, 0.1, 0.06, "#3b3031", 0, 1.14, -0.25);
    else if (hood)
      core.box(0.48, 0.52, 0.13, outfit, 0, 1.29, 0.02)
        .box(0.05, 0.56, 0.04, "#76efff", -0.18, 1.3, -0.21)
        .box(0.05, 0.56, 0.04, "#76efff", 0.18, 1.3, -0.21);
    // Catalog archetypes deliberately alter silhouette while sharing the same rig.
    if (archetype === "scout") core.box(.23,.08,.08,trim,-.17,1.50,.105,0,0,-.18).box(.23,.08,.08,trim,.17,1.50,.105,0,0,.18);
    else if (archetype === "ranger") core.box(0.62, 0.1, 0.28, "#d6bd7c", 0, 1.52, 0.08).box(0.08, 0.46, 0.08, trim, -0.28, 1.31, 0);
    else if (archetype === "mechanic") core.box(0.5, 0.1, 0.36, C.ink, 0, 1.52, 0.04).box(0.08, 0.36, 0.08, C.gold, 0.28, 1.33, 0);
    else if (archetype === "sentinel") core.box(0.62, 0.42, 0.12, outfit, 0, 1.38, 0.12).box(0.06, 0.48, 0.06, trim, -0.3, 1.35, -0.2).box(0.06, 0.48, 0.06, trim, 0.3, 1.35, -0.2);
    const head = new T.Group();
    head.position.y = 1.73;
    const hm = new Model(detail)
      .loft([[-.205,.072,.078,0,-.021],[-.155,.126,.113,0,-.017],[-.074,.162,.15],[.034,.177,.161],[.137,.157,.142,0,.007],[.206,.097,.095,0,.015]], hood ? "#262d42" : skin, 12)
      .sphere(0.202, hair, 0, 0.086, 0.046, 0.91, 0.71, 0.97);
    if (hood) {
      hm.sphere(0.235, body, 0, 0.045, 0.046, 1, 1.14, 1)
        .box(0.26, 0.14, 0.07, C.ink, 0, -0.008, -0.167)
        .box(0.072, 0.02, 0.014, "#55f5ff", -0.062, 0.018, -0.208, 0, 0, -0.12)
        .box(0.072, 0.02, 0.014, "#55f5ff", 0.062, 0.018, -0.208, 0, 0, 0.12);
    } else {
      // Sculpted face planes keep the character readable from a full-body camera,
      // while the nested eye, lip and nose forms hold up in locker close-ups.
      const eye = eyeByPalette[palette] || "#35666b", lip = ch === "char-nacre" ? "#a85e78" : "#955746";
      hm.ball(.039, skin, 0, -.018, -.164, .65, 1.18, 1.23, 1)
        .ball(.071, skin, -.102, -.064, -.111, .88,.61,.43,1)
        .ball(.071, skin, .102, -.064, -.111, .88,.61,.43,1)
        .ball(.055, skin, 0, -.118, -.105, 1.32,.55,.52,1)
        .box(.058,.033,.014,'#fff9eb',-.073,.023,-.156,0,0,-.035)
        .box(.058,.033,.014,'#fff9eb',.073,.023,-.156,0,0,.035)
        .box(.067,.014,.012,hair,-.073,.062,-.176,0,0,-.10)
        .box(.067,.014,.012,hair,.073,.062,-.176,0,0,.10)
        .sphere(.019,eye,-.073,.022,-.171,1,.88,.48)
        .sphere(.019,eye,.073,.022,-.171,1,.88,.48)
        .sphere(.010,"#152530",-.073,.022,-.181,1,.95,.42)
        .sphere(.010,"#152530",.073,.022,-.181,1,.95,.42)
        .box(.006,.006,.004,"#ffffff",-.077,.028,-.187)
        .box(.006,.006,.004,"#ffffff",.069,.028,-.187)
        .box(.018,.008,.009,"#9a5d4d",-.011,-.052,-.183,0,0,-.16)
        .box(.018,.008,.009,"#9a5d4d",.011,-.052,-.183,0,0,.16)
        .box(.073,.013,.013,lip,0,-.101,-.176)
        .box(.052,.009,.010,"#c87973",0,-.091,-.182)
        .box(.035,.008,.008,"#6f3d3b",0,-.108,-.181)
        .box(.071,.022,.020,hair,-.071,.071,-.161,0,0,-.11)
        .box(.071,.022,.020,hair,.071,.071,-.161,0,0,.11)
        .sphere(.042,skin,-.181,-.015,0,.45,1,.7)
        .sphere(.042,skin,.181,-.015,0,.45,1,.7)
        .box(.015,.038,.014,trim,-.184,-.041,-.026,0,0,.1);
      if (ch === "char-sauge")
        hm.cyl(0.27, 0.28, 0.04, body, 0, 0.16, 0, 18)
          .cyl(0.19, 0.23, 0.16, body, 0, 0.24, 0, 12)
          .cyl(0.216, 0.23, 0.035, C.gold, 0, 0.19, 0, 12);
      else {
        hm.box(0.37, 0.075, 0.05, C.ink, 0, 0.105, -0.15)
          .box(0.115, 0.056, 0.018, "#91eaf2", -0.085, 0.106, -0.183)
          .box(0.115, 0.056, 0.018, "#91eaf2", 0.085, 0.106, -0.183);
      }
      if (ch === "char-ambre")
        hm.sphere(0.14, hair, 0.045, -0.025, 0.19, 0.68, 1.2, 0.9).sphere(
          0.12,
          hair,
          0.1,
          -0.13,
          0.22,
          0.66,
          1.4,
          0.9,
        );
      if (ch === "char-nacre")
        hm.sphere(0.15, hair, -0.11, 0.13, -0.034, 0.95, 0.7, 1.2)
          .box(0.11, 0.05, 0.018, "#d7f7fb", 0, 0.092, -0.19)
          .box(0.1, 0.025, 0.024, "#5cdce6", 0, -0.02, -0.19);
      if (ch === "char-azur")
        hm.sphere(0.065, hair, -0.18, -0.08, 0.1, 0.66, 2.5, 0.8)
          .sphere(0.05, hair, -0.18, -0.21, 0.1, 0.62, 1.6, 0.72)
          .box(0.33, 0.035, 0.045, "#d9f4ff", 0, 0.13, -0.17);
      if (ch === "char-sauge")
        hm.sphere(0.105, hair, 0, 0.08, 0.13, 1.15, 1.15, 0.65)
          .sphere(0.07, hair, 0.16, -0.04, 0.13, 0.75, 1.6, 0.75);
      if (ch === "char-cuivre")
        hm.sphere(0.125, hair, 0.04, 0.16, 0.13, 0.85, 1.1, 0.9)
          .sphere(0.1, hair, 0.04, 0.31, 0.13, 0.85, 0.85, 0.85)
          .cyl(0.07, 0.07, 0.36, "#42353a", -0.095, 0.07, -0.19, 10, Math.PI / 2)
          .cyl(0.07, 0.07, 0.36, "#42353a", 0.095, 0.07, -0.19, 10, Math.PI / 2)
          .box(0.22, 0.025, 0.035, "#f0b85c", 0, 0.07, -0.205);
      // Secondary explorers now keep a recognisable profile instead of inheriting
      // one generic face: braids, lenses, markings and wind-swept cuts are batched
      // into the same head mesh and remain visible in the locker thumbnails.
      if (palette === "coral") hm.ball(.074,hair,-.19,.02,.055,.55,1.7,.74,1).ball(.074,hair,.19,.02,.055,.55,1.7,.74,1).box(.18,.018,.014,"#ffd6c8",0,-.135,-.142);
      if (palette === "mist") hm.box(.31,.042,.025,"#c4b5fd",0,.105,-.185).sphere(.056,hair,.17,-.09,.07,.55,2.2,.7);
      if (palette === "iris") hm.cyl(.255,.285,.035,"#4fd1c5",0,.165,0,16).box(.12,.035,.024,"#f6d889",-.10,.02,-.192,0,0,-.08);
      if (palette === "flint") hm.box(.17,.042,.022,"#ed9a61",0,-.112,-.181).sphere(.07,hair,-.16,.13,.09,.7,1.5,.7);
      if (palette === "lumen") hm.box(.29,.065,.026,"#fde047",0,.095,-.195).box(.085,.027,.012,"#fff9c9",-.065,.096,-.214).box(.085,.027,.012,"#fff9c9",.065,.096,-.214);
      if (palette === "mistral") hm.ball(.065,hair,-.17,.12,.02,.55,.8,1.7,1).ball(.055,hair,.16,.16,.01,.55,.72,1.6,1);
      if (palette === "clay") hm.box(.29,.035,.025,"#e0a26f",0,.078,-.191).ball(.078,hair,.16,-.055,.08,.58,1.8,.68,1);
      if (palette === "foam") hm.box(.33,.035,.024,"#d8ffff",0,.118,-.189).box(.073,.028,.014,"#58d5df",-.065,.118,-.207).box(.073,.028,.014,"#58d5df",.065,.118,-.207);
      if (palette === "lichen") hm.ball(.082,hair,-.145,.14,.04,.72,.75,1.45,1).ball(.082,hair,.145,.14,.04,.72,.75,1.45,1);
      // Character-specific hair silhouettes are built from directional clumps, not
      // a helmet-like cap. High detail adds loose strands and tiny fasteners while
      // the low profile preserves the same outline for distant actors.
      if (ch === "char-ambre") {
        hm.ball(.09,hair,-.145,.09,.115,.52,1.55,.62,1)
          .ball(.085,hair,.145,.115,.105,.55,1.38,.65,1)
          .box(.034,.22,.032,hair,-.185,-.055,.095,0,0,-.12)
          .box(.034,.18,.032,hair,.185,-.035,.09,0,0,.1)
          .box(.046,.028,.038,trim,-.188,-.155,.094);
      } else if (ch === "char-azur") {
        hm.ball(.096,hair,-.105,.155,.08,.70,.75,1.22,1)
          .ball(.082,hair,.035,.19,.055,.66,.66,1.20,1)
          .box(.038,.25,.038,hair,-.194,-.06,.082,0,0,-.09)
          .box(.052,.025,.045,"#d9f4ff",-.194,-.16,.08);
      } else if (ch === "char-nacre") {
        for (let i=0;i<4;i++) hm.ball(.052,hair,-.17+i*.112,.15+Math.sin(i)*.018,.035,.65,.72,1.32,1);
        hm.box(.205,.024,.028,"#d7f7fb",0,.19,-.06,0,0,.05);
      } else if (ch === "char-cuivre") {
        hm.ball(.085,hair,-.11,.17,.10,.65,.72,1.28,1)
          .ball(.085,hair,.11,.17,.10,.65,.72,1.28,1)
          .cyl(.023,.031,.29,hair,-.105,-.055,.11,7,0,.08)
          .cyl(.023,.031,.29,hair,.105,-.055,.11,7,0,-.08)
          .box(.058,.022,.046,trim,-.105,-.185,.11)
          .box(.058,.022,.046,trim,.105,-.185,.11);
      } else if (ch === "char-sauge") {
        hm.ball(.115,hair,-.075,.155,.10,.78,.75,1.05,1)
          .ball(.092,hair,.11,.135,.11,.68,.70,1.12,1)
          .box(.032,.19,.03,hair,.184,-.04,.08,0,0,.13);
      }
      if (detail === "high") {
        for (let i=0;i<4;i++) {
          const side=i<2?-1:1, row=i%2;
          hm.box(.025,.145-row*.028,.018,hair,side*(.126+row*.042),.058-row*.055,-.115+row*.022,0,side*.08,side*(.15+row*.05));
        }
        hm.sphere(.018,C.gold,-.184,-.065,-.02,.55,1,.55)
          .box(.018,.006,.012,"#ffd9bf",-.12,-.102,-.163,0,0,-.18)
          .box(.018,.006,.012,"#ffd9bf",.12,-.102,-.163,0,0,.18);
      }
    }
    if (!hood) {
      // Sculpted swept locks follow the scalp instead of a single smooth hair ball.
      for (let i = 0; i < 5; i++) hm.ball(.074, hair, -.125+i*.059, .167+Math.sin(i*.8)*.023, -.068, .58,.67,1.58,1);
      hm.box(.058,.018,.019,trim,.14,.064,-.109,0,0,.25);
    }
    // Insets, lower eyelids and separated hair highlights improve close-ups.
    if(!hood){
      for(const side of [-1,1]){
        hm.box(.052,.009,.015,skin,side*.073,.003,-.171)
          .ball(.018,'#b77865',side*.183,-.016,-.011,.32,1,.5,1)
          .box(.008,.009,.006,'#ffffff',side*.073-.005,.028,-.185);
      }
      hm.box(.035,.008,.012,'#df9b80',0,-.086,-.181)
        .box(.056,.007,.008,skin,0,-.118,-.151);
    }else{
      hm.box(.045,.1,.025,trim,-.16,-.067,-.18,0,.25,-.1)
        .box(.045,.1,.025,trim,.16,-.067,-.18,0,-.25,.1);
    }
    head.add(hm.mesh());
    if (eq.headwear) {
      const hw = cosmetic(eq.headwear, trim), hc = hw.color || trim, hs = hw.secondary || C.ink;
      if (/visor|helm|casque/i.test(eq.headwear))
        head.add(new Model(detail).box(0.34, 0.065, 0.22, hc, 0, 0.04, -0.17).box(0.22, 0.03, 0.025, hs, 0, 0.015, -0.286).mesh());
      else if (/cap|bonnet|hat|chapeau/i.test(eq.headwear))
        head.add(new Model(detail).cyl(0.26, 0.3, 0.09, hc, 0, 0.2, 0, 12).cyl(0.18, 0.2, 0.2, hc, 0, 0.31, 0, 10).mesh());
      else
        head.add(new Model(detail).box(0.4, 0.055, 0.12, hc, 0, 0.18, -0.01).box(0.035, 0.2, 0.035, hs, -0.15, 0.11, 0).box(0.035, 0.2, 0.035, hs, 0.15, 0.11, 0).mesh());
    }
    // A single batched six-point sparkle gives emotes a readable silhouette at
    // gameplay distance without a particle system or per-point draw calls.  The
    // animation wrapper owns visibility/rotation; this mesh is deliberately
    // attached to the torso so it never changes the actor root position.
    const emoteFx = new T.Group(), fxModel = new Model(detail);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      fxModel.ball(.048, i % 2 ? C.gold : C.sea, Math.cos(a) * .34, 2.11 + Math.sin(a) * .13, -.18, .72, 1.35, .38, 1);
    }
    emoteFx.add(fxModel.mesh());
    emoteFx.visible = false;
    torso.add(core.mesh(), head, emoteFx);
    const back = cosmetic(eq.back);
    if (eq.back === "back-orbe")
      torso.add(
        new Model(detail)
          .sphere(0.21, back.color, 0, 1.29, 0.26)
          .cyl(0.235, 0.235, 0.05, C.gold, 0, 1.29, 0.26, 16, Math.PI / 2)
          .mesh(),
      );
    else
      torso.add(
        new Model(detail)
          .box(0.32, 0.39, 0.17, back.color, 0, 1.29, 0.23)
          .box(0.29, 0.075, 0.19, back.secondary, 0, 1.44, 0.23)
          .box(0.22, 0.14, 0.05, C.ink, 0, 1.17, 0.34)
          .cyl(0.065, 0.065, 0.4, "#c9dce0", -0.21, 1.3, 0.25, 8)
          .mesh(),
      );
    const limbs = [],
      knees = [],
      elbows = [],
      legwear = ch === "char-ambre" ? "#b99163" : ch === "char-azur" ? "#294c69" : ch === "char-sauge" ? "#6b7651" : ch === "char-nacre" ? "#315d83" : ch === "char-cuivre" ? "#3d3f4b" : "#24283f",
      boot = ch === "char-nacre" ? "#74dce0" : ch === "char-cuivre" ? "#463239" : ch === "char-sauge" ? "#493d2e" : "#263746";
    for (const s of [-1, 1]) {
      const hip = new T.Group();
      hip.position.set(s * 0.132, 0.94, 0);
      hip.add(
        new Model(detail)
          .loft([[-.42,.083,.09],[-.28,.098,.108],[-.11,.115,.121],[.025,.106,.101]],legwear,10)
          .box(.05,.27,.018,outfit,s*.075,-.205,.078,0,0,-s*.05)
          .box(.038,.13,.085,C.ink,s*.10,-.18,-.004)
          .box(.041,.022,.087,trim,s*.102,-.145,-.004)
          .box(0.14, 0.095, 0.052, trim, s * 0.016, -0.16, -0.105)
          .mesh(),
      );
      const knee = new T.Group();
      knee.position.y = -0.42;
      knee.add(
        new Model(detail)
          .sphere(0.10, ch === "char-ambre" ? "#315361" : trim, 0, -0.012, -0.065, 0.84, 0.94, 0.4)
          .loft([[-.37,.071,.075],[-.20,.081,.097],[-.05,.093,.086]],legwear,10)
          .box(.125,.20,.033,boot,0,-.21,-.086,-.10)
          .box(.145,.032,.04,trim,0,-.27,-.096)
          .box(.16,.065,.105,C.ink,0,-.385,-.14)
          .box(.15,.024,.085,trim,0,-.414,-.177)
          .box(0.2, 0.15, ch === "char-nacre" ? 0.38 : 0.29, boot, 0, -0.43, -0.075)
          .box(0.19, 0.034, ch === "char-nacre" ? 0.38 : 0.29, trim, 0, -0.509, -0.075)
          /* v19: bright toe cap — the boot keeps its shape, the trim reads in motion. */
          .box(.15,.05,.06,trim,0,-.44,-.225)
          .box(.145,.018,.028,"#d9e5df",0,-.385,-.225)
          .box(.145,.018,.028,"#d9e5df",0,-.418,-.235)
          .box(.145,.018,.028,"#d9e5df",0,-.451,-.245)
          .box(.208,.026,ch === "char-nacre"?.405:.315,C.ink,0,-.528,-.08)
          .box(.045,.035,.035,trim,s*.066,-.365,-.20)
          .mesh(),
      );
      if (ch === "char-nacre")
        knee.add(new Model(detail).box(0.28, 0.025, 0.22, "#9bf3ef", 0, -0.46, -0.29).mesh());
      else if (ch === "char-cuivre")
        knee.add(new Model(detail).box(0.22, 0.055, 0.035, "#f0b85c", 0, -0.32, -0.16).mesh());
      hip.add(knee);
      group.add(hip);
      limbs.push(hip);
      knees.push(knee);
      const shoulder = new T.Group();
      shoulder.position.set(s * 0.294, 1.47, 0);
      shoulder.add(
        new Model(detail)
          .ball(.143,outfit,0,-.052,0,1,.82,1.04,1)
          .ball(.14,trim,s*.025,-.015,.002,.80,.36,1.0,1)
          .box(.037,.135,.048,C.ink,s*.095,-.13,-.047,0,0,-s*.12)
          .cyl(0.1, 0.08, 0.29, ch === "char-sauge" ? skin : outfit, 0, -0.18, 0, 10)
          .box(0.1, 0.105, 0.045, trim, 0, -0.12, -0.093)
          /* v19: shoulder emblem — small distance-readable identity badge. */
          .ball(.032, trim, s * .155, -.03, -.06, 1, .7, .5, 1)
          .mesh(),
      );
      const elbow = new T.Group();
      elbow.position.y = -0.32;
      elbow.add(
        new Model(detail)
          .loft([[-.245,.057,.061],[-.125,.073,.074],[.007,.077,.07]],skin,10)
          .box(.099,.105,.046,outfit,0,-.13,-.063,-.12)
          .box(.09,.024,.049,trim,0,-.17,-.063)
          .cyl(0.078, 0.078, 0.07, C.ink, 0, -0.21, 0, 10)
          .ball(.071,C.ink,0,-.278,-.009,.89,.89,.86,1)
          .box(.033,.07,.041,C.ink,-s*.062,-.26,-.027,0,0,s*.3)
          .box(.102,.027,.018,trim,0,-.283,-.067)
          .box(.102,.025,.019,C.ink,0,-.315,-.05)
          .box(.021,.066,.018,C.ink,-.034,-.338,-.04,0,0,-.03)
          .box(.021,.071,.018,C.ink,-.011,-.341,-.042)
          .box(.021,.067,.018,C.ink,.012,-.338,-.04)
          .box(.021,.059,.018,C.ink,.035,-.332,-.038,0,0,.03)
          .box(.018,.052,.023,trim,s*.069,-.291,-.025,0,0,s*.42)
          .box(.078,.012,.014,"#6bdce0",0,-.255,-.071)
          /* v19: wristband in trim colour — identity read at play distance. */
          .box(.082,.030,.082,trim,0,-.232,-.004)
          .mesh(),
      );
      shoulder.add(elbow);
      group.add(shoulder);
      limbs.push(shoulder);
      elbows.push(elbow);
    }
    const gun = weapon("rifle", accent, eq.wrap);
    gun.position.set(0.23, 1.15, -0.43);
    group.add(gun);
    const tool = new T.Group(),
      tc = cosmetic(eq.tool);
    tool.add(
      new Model(detail)
        .cyl(0.025, 0.036, 1.02, C.ink, 0, 0, 0, 8)
        .box(0.62, 0.1, 0.115, tc.color, 0, 0.39, 0, 0, 0, -0.16)
        .box(0.1, 0.22, 0.13, tc.secondary, -0.27, 0.39, 0, 0, 0, -0.24)
        .mesh(),
    );
    tool.position.set(0.34, 1.06, -0.28);
    tool.rotation.x = -0.38;
    tool.visible = false;
    // Two real shaft targets allow a broad, two-handed harvesting arc.
    tool.userData.grips = { primary: [0.03, -0.29, 0], support: [-0.02, 0.28, 0] };
    group.add(tool);
    const glider = new T.Group(),
      gc = cosmetic(eq.glider),
      gliderKind = eq.glider || "glider-alize";
    const gm = new Model(detail)
      .box(0.15, 0.12, 3.9, C.ink, 0, 0.16, 0, 0, Math.PI / 2)
      .box(2.14, 0.075, 1.34, gc.color, -1.1, 0.22, 0.02, 0, 0, -0.18)
      .box(2.14, 0.075, 1.34, gc.color, 1.1, 0.22, 0.02, 0, 0, 0.18)
      .box(0.38, 0.14, 1.82, gc.secondary, 0, 0.23, 0.02)
      .box(0.09, 0.1, 3.98, C.gold, 0, 0.265, 0.02, 0, Math.PI / 2)
      .cyl(0.014, 0.014, 1.18, "#cadfdf", -0.36, -0.53, 0, 6, 0, 0.3)
      .cyl(0.014, 0.014, 1.18, "#cadfdf", 0.36, -0.53, 0, 6, 0, -0.3)
      .box(2.0, 0.025, 0.1, gc.secondary, -1.1, 0.275, -0.43, 0, 0, -0.18)
      .box(2.0, 0.025, 0.1, gc.secondary, 1.1, 0.275, -0.43, 0, 0, 0.18)
      // Four tension straps terminate at two tangible, separate hand grips.
      .cyl(0.018, 0.018, 1.55, "#d4e8e5", -0.98, -0.31, -0.37, 6, 0, 0.86)
      .cyl(0.018, 0.018, 1.55, "#d4e8e5", 0.98, -0.31, -0.37, 6, 0, -0.86)
      .cyl(0.018, 0.018, 1.4, "#d4e8e5", -0.82, -0.35, 0.36, 6, 0, 0.64)
      .cyl(0.018, 0.018, 1.4, "#d4e8e5", 0.82, -0.35, 0.36, 6, 0, -0.64)
      .cyl(0.026, 0.026, 0.34, C.ink, -0.43, -0.82, 0.08, 8, 0, Math.PI / 2)
      .cyl(0.026, 0.026, 0.34, C.ink, 0.43, -0.82, 0.08, 8, 0, Math.PI / 2)
      .sphere(0.055, C.gold, -0.43, -0.82, 0.08)
      .sphere(0.055, C.gold, 0.43, -0.82, 0.08)
      .box(0.56, 0.055, 0.12, C.ink, 0, -0.67, 0.16)
      // Sculpted aerofoil shells, a reinforced leading edge and visible ribs make
      // the glider read as a real machine instead of two flat boards.
      .sphere(0.82, gc.color, -1.18, 0.245, 0.02, 1.43, 0.105, 0.78, 2)
      .sphere(0.82, gc.color, 1.18, 0.245, 0.02, 1.43, 0.105, 0.78, 2)
      .cyl(0.052, 0.075, 4.55, C.ink, 0, 0.25, -0.47, 14, 0, Math.PI / 2)
      .cyl(0.035, 0.052, 3.95, gc.secondary, 0, 0.31, 0.55, 12, 0, Math.PI / 2)
      .box(0.58, 0.22, 1.26, C.ink, 0, 0.20, -0.04)
      .box(0.38, 0.14, 1.43, gc.secondary, 0, 0.31, -0.03)
      .cyl(0.19, 0.24, 0.56, "#234a5c", 0, 0.20, -0.74, 14, Math.PI / 2)
      .add(new T.TorusGeometry(0.245, 0.055, 7, 18), C.gold, 0, 0.20, -1.02)
      .box(0.055, 0.44, 0.62, gc.secondary, -1.78, 0.35, 0.23, 0, 0, -0.15)
      .box(0.055, 0.44, 0.62, gc.secondary, 1.78, 0.35, 0.23, 0, 0, 0.15)
      .box(0.32, 0.06, 0.47, C.gold, -2.05, 0.29, 0.19, 0, 0, -0.22)
      .box(0.32, 0.06, 0.47, C.gold, 2.05, 0.29, 0.19, 0, 0, 0.22);
    for (const side of [-1, 1]) {
      for (let rib = 0; rib < 4; rib++)
        gm.box(0.035, 0.095, 1.12, rib % 2 ? C.gold : "#d9eee9", side * (0.54 + rib * 0.43), 0.315, 0.01, 0, 0, side * (0.035 + rib * 0.032));
      gm.box(0.24, 0.08, 0.16, "#77eff0", side * 1.78, 0.36, -0.30);
    }
    // v1.4 aero pass: segmented pressure panels, rear stabilisers and an exposed
    // control spine give the canopy depth above and below without extra draw calls.
    gm.box(.32,.10,1.76,"#193f52",0,.11,.14)
      .box(.18,.06,1.95,C.gold,0,.35,.19)
      .box(.64,.045,.34,"#dff8ef",0,.37,-.48)
      .box(.025,.26,2.34,"#8bdedb",0,.37,.04);
    for(const side of [-1,1]){
      gm.box(.54,.055,.72,gc.secondary,side*2.26,.27,.46,0,0,side*.31)
        .box(.35,.03,.07,C.gold,side*2.39,.34,.18,0,0,side*.31)
        .cyl(.012,.012,1.76,"#d8eeea",side*.73,-.27,.08,6,0,side*.54);
      for(let panel=0;panel<3;panel++) gm.box(.56,.018,.035,panel===1?C.gold:"#b8ece8",side*(.72+panel*.55),.37,-.19+panel*.22,0,0,side*(.06+panel*.03));
    }
    if (gliderKind === "glider-raie")
      gm.ball(0.38, gc.secondary, 0, 0.31, -0.78, 1.1, 0.2, 1.75).box(0.78, 0.03, 0.08, "#a0f4e9", 0, 0.29, -0.72);
    else if (gliderKind === "glider-constellation")
      for (const x of [-1.48, -0.78, 0, 0.78, 1.48]) gm.sphere(0.045, "#fff5c2", x, 0.3, -0.23 + Math.abs(x) * 0.1);
    else gm.box(0.46, 0.04, 0.72, "#fff1ca", 0, 0.285, 0.08);
    glider.add(gm.mesh());
    // The centre fan and navigation beacons stay independent so flight animation
    // can sell airflow without rebuilding the main batched canopy.
    const gliderRotor = new T.Group();
    const rotorModel = new Model(detail).cyl(0.075, 0.075, 0.12, C.gold, 0, 0, 0, 10, Math.PI / 2);
    for (let blade = 0; blade < 5; blade++) {
      const a = blade * Math.PI * 2 / 5;
      rotorModel.box(0.075, 0.36, 0.024, blade % 2 ? "#d9fff7" : "#78e7e9", Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0, 0, 0, -a);
    }
    gliderRotor.add(rotorModel.mesh());
    gliderRotor.position.set(0, 0.20, -1.055);
    glider.add(gliderRotor);
    const gliderLights = [];
    for (const [x, color] of [[-1.78, "#ff8b72"], [1.78, "#72f4ee"]]) {
      const light = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), new T.MeshBasicMaterial({ color, transparent: true, opacity: .9 }));
      light.position.set(x, 0.36, -0.34); glider.add(light); gliderLights.push(light);
    }
    // Hinged winglets and twin air ribbons make steering and deployment legible.
    // They stay inside the glider group, so hiding the canopy also hides every effect.
    const gliderWingTips = [], gliderRibbons = [];
    for (const side of [-1, 1]) {
      const tip = new T.Group(); tip.position.set(side * 1.75, .29, .05);
      tip.add(new Model(detail)
        .box(.72, .055, .92, gc.secondary, side * .31, .015, .03, 0, 0, side * .24)
        .box(.56, .035, .08, C.gold, side * .28, .055, -.42, 0, 0, side * .24)
        .box(.055, .30, .46, C.ink, side * .48, .12, .20, 0, 0, side * .24)
        .mesh());
      glider.add(tip); gliderWingTips.push(tip);
      const ribbonGeometry = new T.BufferGeometry().setFromPoints([
        new T.Vector3(side * 2.18, .24, .48),
        new T.Vector3(side * 2.20, .20, 1.02),
        new T.Vector3(side * 2.16, .15, 1.72),
      ]);
      const ribbon = new T.Line(ribbonGeometry, new T.LineBasicMaterial({ color: side < 0 ? "#ffb08c" : "#8dffff", transparent: true, opacity: .36 }));
      glider.add(ribbon); gliderRibbons.push(ribbon);
    }
    const brakePanels=[];
    for(const side of [-1,1]){
      const flap=new T.Mesh(new T.BoxGeometry(.72,.035,.30),new T.MeshStandardMaterial({color:gc.secondary,roughness:.46,metalness:.14}));
      flap.position.set(side*1.18,.22,.67);glider.add(flap);brakePanels.push(flap);
    }
    glider.position.y = 2.9;
    glider.visible = false;
    // Local-to-glider targets; the parent group position is deliberately excluded.
    glider.userData.handles = { left: [-0.43, -0.82, 0.08], right: [0.43, -0.82, 0.08] };
    glider.userData.rotor = gliderRotor;
    glider.userData.navLights = gliderLights;
    glider.userData.wingTips = gliderWingTips;
    glider.userData.ribbons = gliderRibbons;
    glider.userData.brakePanels = brakePanels;
    group.add(glider);
    const blueprint = new T.Mesh(
      new T.PlaneGeometry(0.47, 0.35),
      new T.MeshBasicMaterial({ map: blueprintTexture(), side: T.DoubleSide, transparent: true }),
    );
    blueprint.position.set(-0.26, 1.23, -0.38);
    blueprint.rotation.x = -0.5;
    blueprint.visible = false;
    group.add(blueprint);
    const rod = new Model(detail)
      .cyl(0.012, 0.024, 1.65, C.ink, 0, 0, 0, 6)
      .cyl(0.035, 0.035, 0.06, C.gold, 0, -0.44, 0, 8, Math.PI / 2)
      .mesh();
    rod.position.set(0.3, 1.65, -0.48);
    rod.rotation.x = -0.48;
    rod.visible = false;
    group.add(rod);
    Object.assign(group.userData, {
      limbs,
      knees,
      elbows,
      torso,
      head,
      emoteFx,
      gun,
      gunKey: "rifle",
      gunWrap: eq.wrap || "",
      // Kept stable: integrations use this as the articulated-rig compatibility marker.
      rigVersion: "1.0.0",
      avatarScale: 1.065,
      detail,
      tool,
      glider,
      blueprint,
      rod,
      // Root-local targets; stable numeric arrays make them safe for serialisation/debug views.
      handTargets: {
        weaponPrimary: [0.23, 1.03, -0.3],
        weaponSupport: [0.23, 1.17, -0.77],
        gliderLeft: [-0.43, 2.08, 0.08],
        gliderRight: [0.43, 2.08, 0.08],
      },
      equipment: JSON.stringify(eq),
      walk: 0,
      anim: 0,
      recoil: 0,
      harvest: 0,
    });
    return group;
  }
  let bp;
  function blueprintTexture() {
    if (bp) return bp;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#116993";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#56b6d5";
    x.lineWidth = 1;
    for (let i = 0; i < 128; i += 12) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 128);
      x.moveTo(0, i);
      x.lineTo(128, i);
      x.stroke();
    }
    x.strokeStyle = "#dbffff";
    x.lineWidth = 3;
    x.strokeRect(24, 37, 76, 58);
    x.beginPath();
    x.moveTo(24, 37);
    x.lineTo(62, 14);
    x.lineTo(100, 37);
    x.moveTo(52, 95);
    x.lineTo(52, sixty());
    x.lineTo(74, sixty());
    x.lineTo(74, 95);
    x.stroke();
    bp = new T.CanvasTexture(c);
    bp.colorSpace = T.SRGBColorSpace;
    return bp;
  }
  function sixty() {
    return 60;
  }
  function house(o) {
    const m = new Model(),
      w = o.w,
      d = o.d,
      h = o.h,
      floors = Math.max(1, Math.min(24, o.floors || Math.round(h / 4) || 1)),
      floorHeight = h / floors,
      r = S.regions[o.region] || S.regions[0],
      rand = rng(o.seed),
      style = o.style || r.style,
      PAL = {
        port: [["#f6a38d", "#8fd3d1", "#f7d27a", "#f4efe4", "#b7d98c", "#c9b6f2"], ["#d7745a", "#2f8f9d", "#e2a13b"]],
        citadel: [["#dce5e8", "#c9d6e2", "#e8e1d3", "#b8c7d8", "#f0d8c0"], ["#d7745a", "#4d6f8f", "#8a5a8c"]],
        forest: [["#c5ab82", "#b98f6a", "#d8c39b", "#9c7b5c", "#e6d2ad"], ["#396b68", "#5b7d3a", "#7a4a3a"]],
        farm: [["#f1e4cc", "#e8b79e", "#f4d9a8", "#d97b5f", "#fff3dc"], ["#ac514c", "#c9633e", "#5f6f8f"]],
        desert: [["#e9bd82", "#e3a96c", "#f0cf9a", "#d7956a", "#f3dcb4"], ["#c88754", "#b8643e", "#3f8f9d"]],
        cliff: [["#e9eef2", "#c9d7e3", "#a7b8c8", "#d8c0a8", "#b9876a"], ["#e5f2f6", "#f4f8fa", "#e5f2f6"]],
        lagoon: [["#9fe3dc", "#ffd1a6", "#f6b2c4", "#bfe6a8", "#fff1c2", "#a9c8ff"], ["#ff8a65", "#2fb7b0", "#f2c14e"]],
        observatory: [["#d8dde8", "#c7cfe0", "#e7e4f0", "#bfd0de"], ["#e5f2f6", "#8a6fc8", "#5f7fa8"]]
      },
      pal = PAL[style] || PAL.citadel,
      colors = pal[0];
    let wall = colors[Math.floor(rand() * colors.length)],
      trim = r.color,
      roof = pal[1][Math.floor(rand() * pal[1].length)];
    // Tours de verre au centre des grandes villes.
    if ((style === "citadel" || style === "port") && floors >= 6) { wall = rand() > .5 ? "#7fb3d1" : "#9fc6d9"; trim = "#eef6fa"; }
    m.box(w * 2 + 0.3, 0.32, d * 2 + 0.3, "#899797", 0, -0.19, 0)
      .box(w - 1.8, h, 0.55, wall, -(w + 1.8) / 2, h / 2, -d)
      .box(w - 1.8, h, 0.55, wall, (w + 1.8) / 2, h / 2, -d)
      .box(3.6, h - 2.8, 0.55, wall, 0, (h + 2.8) / 2, -d)
      .box(w * 2, h, 0.55, wall, 0, h / 2, d);
    for (const side of [-1, 1]) {
      m.box(0.55, 1.1, d * 2, wall, side * w, 0.55, 0)
        .box(0.55, h - 2.6, d * 2, wall, side * w, (h + 2.6) / 2, 0)
        .box(0.55, 1.5, d - 1.1, wall, side * w, 1.85, -(d + 1.1) / 2)
        .box(0.55, 1.5, d - 1.1, wall, side * w, 1.85, (d + 1.1) / 2);
      m.box(0.7, 0.13, 2.8, trim, side * w, 1.1, 0).box(0.7, 0.13, 2.8, trim, side * w, 2.63, 0);
      for (const z of [-1.33, 1.33]) m.box(0.68, 1.55, 0.12, trim, side * w, 1.86, z);
    }
    // Ground-floor shop windows are decorative shallow reveals, not invisible openings.
    // The north-facing (-Z) entrance stays at ground level; upper floors are windows
    // and balconies only, matching the authoritative one-piece collision volume.
    for (const x of [-w * 0.62, w * 0.62]) {
      m.box(2.45, 1.8, 0.09, trim, x, 1.95, -d - 0.3)
        .box(2.16, 1.52, 0.06, "#81bed0", x, 1.95, -d - 0.365)
        .box(0.075, 1.58, 0.08, C.white, x, 1.95, -d - 0.41)
        .box(2.2, 0.075, 0.08, C.white, x, 1.97, -d - 0.41)
        .box(2.6, 0.16, 0.3, trim, x, 0.98, -d - 0.36);
    }
    for (let fl = 1; fl < floors; fl++) {
      const y0 = fl * floorHeight + floorHeight * 0.53;
      // two lit bays per facade, with a shallow sill so the wall reads at distance
      for (const x of [-w * 0.58, w * 0.58]) {
        m.box(1.65, 1.35, 0.075, trim, x, y0, -d - 0.3)
          .box(1.42, 1.12, 0.045, fl % 2 ? "#79bfd0" : "#a8d9db", x, y0, -d - 0.345)
          .box(0.07, 1.18, 0.055, C.white, x, y0, -d - 0.38)
          .box(1.48, 0.06, 0.055, C.white, x, y0, -d - 0.38);
      }
      for (const side of [-1, 1])
        for (const z of [-d * 0.55, d * 0.55])
          m.box(0.075, 1.05, 1.18, trim, side * (w + 0.3), y0, z)
            .box(0.045, 0.84, 0.9, "#7dbcc7", side * (w + 0.345), y0, z);
      m.box(w * 2 + 0.15, 0.12, d * 2 + 0.15, trim, 0, fl * floorHeight, 0);
      if (fl >= 2) m.box(w * 2 + 0.45, 0.1, 0.52, trim, 0, fl * floorHeight + 0.14, -d - 0.34);
    }
    m.box(w * 2 + 0.2, 0.22, d * 2 + 0.2, C.white, 0, h - 0.22, 0).box(
      w * 2,
      0.34,
      0.12,
      trim,
      0,
      0.35,
      -d - 0.31,
    );
    if (["citadel", "port", "desert", "observatory"].includes(style)) {
      m.box(w * 2 + 0.7, 0.28, d * 2 + 0.7, roof, 0, h + 0.1, 0);
      for (const x of [-w, w]) m.box(0.25, 0.6, d * 2, wall, x, h + 0.44, 0);
      for (const z of [-d, d]) m.box(w * 2, 0.6, 0.25, wall, 0, h + 0.44, z);
      if (style === "observatory")
        m.sphere(3.2, "#d6e3e8", 0, h + 0.22, 0, 1, 1, 1).cyl(3.3, 3.3, 0.25, trim, 0, h + 0.32, 0, 24);
      else {
        m.box(2.2, 1.1, 1.8, "#a4b5bb", w - 2, h + 0.8, d - 2).box(
          2.3,
          0.1,
          1.9,
          C.ink,
          w - 2,
          h + 1.38,
          d - 2,
        );
        for (let z = -0.65; z < 0.9; z += 0.35) m.box(2.1, 0.04, 0.1, "#688593", w - 2, h + 1.45, d - 2 + z);
      }
    } else {
      const theta = 0.28;
      m.box(w + 1, 0.26, d * 2 + 1, roof, -w / 2, h + 1.14, 0, 0, 0, theta).box(
        w + 1,
        0.26,
        d * 2 + 1,
        roof,
        w / 2,
        h + 1.14,
        0,
        0,
        0,
        -theta,
      );
      for (let z = -d; z <= d; z += 1.25) {
        m.box(w + 1, 0.045, 0.055, "#e7a17c", -w / 2, h + 1.29, z, 0, 0, theta).box(
          w + 1,
          0.045,
          0.055,
          "#e7a17c",
          w / 2,
          h + 1.29,
          z,
          0,
          0,
          -theta,
        );
      }
      m.cyl(0.13, 0.13, d * 2 + 1, roof, 0, h + 2.41, 0, 8, Math.PI / 2)
        .box(1, 2, 1, wall, w * 0.62, h + 1.2, d * 0.45)
        .box(1.3, 0.2, 1.3, C.ink, w * 0.62, h + 2.25, d * 0.45);
      // Ridge tiles step along the roof spine: same merged mesh, cheap boxes.
      for (let z = -d + 0.4; z <= d - 0.4; z += 0.62) m.box(0.36, 0.14, 0.55, roof, 0, h + 2.5, z);
    }
    for (const x of [-w, w]) for (const z of [-d, d]) m.box(0.32, h, 0.32, trim, x, h / 2, z);
    // Corner downspouts: thin verticals that break the flat wall plane.
    for (const x of [-w, w]) m.cyl(0.07, 0.07, h, "#5d6d73", x + 0.28, h / 2, d + 0.18, 7);
    m.box(4.2, 0.17, 2.1, trim, 0, 2.95, -d - 0.85, 0.04);
    for (const x of [-1.95, 1.95]) m.box(0.1, 2.85, 0.1, C.white, x, 1.42, -d - 1.68);
    for (let x = -1.75; x <= 1.75; x += 0.5) m.box(0.24, 0.02, 2.1, C.white, x, 3.055, -d - 0.85, 0.04);
    // Interior floorboards, shelving and furniture.
    for (let x = -w + 0.6; x < w; x += 1.3) m.box(0.018, 0.03, d * 2 - 1, "#d2b792", x, 0.018, 0);
    m.box(2.2, 0.12, 1, "#ac774f", -w + 2, 1.1, 1)
      .box(0.11, 1.1, 0.8, C.ink, -w + 1.2, 0.55, 1)
      .box(0.11, 1.1, 0.8, C.ink, -w + 2.8, 0.55, 1);
    m.box(2.8, 0.55, 1.3, trim, w - 2, 0.48, d - 1.5)
      .box(2.8, 0.9, 0.3, trim, w - 2, 0.85, d - 0.85)
      .box(1.4, 2.4, 0.8, "#a37c58", -w + 1.4, 1.2, d - 1);
    for (let y = 0.6; y < 2.4; y += 0.55) m.box(1.5, 0.08, 0.9, C.white, -w + 1.4, y, d - 1);
    const mesh = m.mesh();
    mesh.userData.style = style;
    return mesh;
  }
  function objectModel(o) {
    const g = new T.Group(),
      m = new Model(),
      r = rng(o.seed || 1),
      bio = S.biomeAt(o.x, o.z),
      col = S.regions[o.region]?.color || C.coral;
    if (o.type === "house") g.add(house(o));
    else if (o.type === "tree") {
      const desert = bio === "desert",
        snow = bio === "snow";
      const h = o.h * (desert ? 1.08 : 1.6),
        w = o.w;
      if (desert) {
        m.cyl(0.17, 0.29, h * 0.7, "#ad8053", 0, h * 0.35, 0, 8);
        for (let k = 0; k < 7; k++) {
          const a = (k * Math.PI * 2) / 7;
          m.add(
            new T.ConeGeometry(w * 0.48, w * 2, 4),
            "#739c5c",
            Math.sin(a) * w * 0.7,
            h * 0.76,
            Math.cos(a) * w * 0.7,
            Math.PI * 0.44,
            a,
            0,
            1,
            0.65,
            1,
          );
        }
      } else if (snow || o.region === 1) {
        m.cyl(0.15, 0.34, h * 0.85, "#795b45", 0, h * 0.4, 0, 8);
        for (let k = 0; k < 3; k++) {
          m.cyl(
            0,
            w * (1.6 - k * 0.32),
            h * 0.62,
            snow ? "#467575" : ["#448961", "#4d9c68", "#69ab70"][k],
            0,
            h * (0.45 + k * 0.2),
            0,
            9,
          );
          if (snow) m.cyl(0, w * (1.54 - k * 0.32), h * 0.42, "#e2eef2", 0, h * (0.56 + k * 0.2), 0, 9);
        }
      } else {
        m.cyl(0.23, 0.48, h * 0.65, "#8b6849", 0, h * 0.29, 0, 8).cyl(
          0.11,
          0.23,
          h * 0.35,
          "#94734f",
          0.6,
          h * 0.52,
          0,
          7,
          0,
          -0.58,
        );
        m.ball(w * 1.5, "#3f8654", 0, h * 0.7, 0, 1, 0.72, 1, 2)
          .ball(w * 1.23, "#65a74f", -w * 0.6, h * 0.79, 0.2, 1, 0.72, 1, 2)
          .ball(w * 1.1, "#8cba5c", w * 0.4, h * 0.88, -w * 0.18, 1, 0.7, 1, 2)
          .ball(w * 0.8, "#6faa52", w * 0.84, h * 0.7, w * 0.45, 1, 0.8, 1, 1);
      }
      g.add(m.mesh());
    } else if (o.type === "rock") {
      m.ball(
        o.w,
        bio === "snow" ? "#a3bdcd" : bio === "desert" ? "#c88d5b" : "#839a96",
        0,
        o.h * 0.2,
        0,
        1,
        o.h / (o.w * 2),
        0.85,
      ).ball(
        o.w * 0.6,
        bio === "snow" ? "#e7f1f4" : bio === "desert" ? "#e6b581" : "#b6c2ad",
        o.w * 0.25,
        o.h * 0.47,
        0,
        1,
        0.55,
        0.8,
      );
      g.add(m.mesh());
    } else if (o.type === "chest") {
      m.box(1.35, 0.61, 0.9, "#8c592c", 0, 0.33, 0).box(1.4, 0.09, 0.95, C.gold, 0, 0.12, 0);
      for (const x of [-0.45, 0.45]) m.box(0.12, 0.67, 0.98, C.gold, x, 0.37, 0);
      // Gold corner straps and a glowing rune: the loot chest reads at distance.
      for (const x of [-0.62, 0.62]) for (const y of [0.12, 0.55]) m.box(0.1, 0.1, 0.94, C.gold, x, y, 0);
      m.box(0.22, 0.24, 0.08, "#77f0e2", 0, 0.53, -0.49);
      g.add(m.mesh());
      let lid = new Model()
        .box(1.4, 0.23, 0.94, C.gold, 0, 0.11, -0.44)
        .box(1.06, 0.12, 0.71, "#bd8843", 0, 0.23, -0.44)
        .box(0.44, 0.03, 0.3, "#77f0e2", 0, 0.30, -0.44)
        .mesh();
      lid.position.set(0, 0.65, 0.44);
      g.add(lid);
      g.userData.lid = lid;
      let light = new T.Mesh(
        new T.CylinderGeometry(0.4, 1.1, 3.8, 12, 1, true),
        new T.MeshBasicMaterial({
          color: "#ffe6a5",
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      light.position.y = 2;
      g.add(light);
      g.userData.light = light;
    } else if (o.type === "container") {
      m.box(o.w * 2, o.h, o.d * 2, col, 0, o.h / 2, 0);
      for (let x = -o.w; x <= o.w; x += 0.45) m.box(0.08, o.h, 0.08, "#668fa0", x, o.h / 2, -o.d - 0.04);
      m.box(0.1, o.h, 0.09, C.white, 0, o.h / 2, -o.d - 0.08);
      g.add(m.mesh());
    } else if (o.type === "silo") {
      m.cyl(o.w, o.w, o.h, "#bbcac9", 0, o.h / 2, 0, 14).cyl(
        0.15,
        o.w,
        o.w * 0.75,
        col,
        0,
        o.h + o.w * 0.375,
        0,
        14,
      );
      for (let y = 1; y < o.h; y += 1.6) m.cyl(o.w + 0.035, o.w + 0.035, 0.08, "#748e96", 0, y, 0, 14);
      g.add(m.mesh());
    } else if (o.type === "lamp") {
      m.cyl(0.06, 0.14, 4.4, C.ink, 0, 2.2, 0, 8)
        .box(1.15, 0.1, 0.17, C.ink, 0.49, 4.33, 0)
        .box(0.4, 0.12, 0.36, C.gold, 0.85, 4.24, 0);
      g.add(m.mesh());
    } else if (o.type === "fence") {
      for (let x = -o.w; x <= o.w; x += 1.5) m.box(0.12, 1.5, 0.12, "#ddc294", x, 0.75, 0);
      m.box(o.w * 2, 0.15, 0.11, C.white, 0, 0.48, 0).box(o.w * 2, 0.15, 0.11, C.white, 0, 1.1, 0);
      g.add(m.mesh());
    } else if (o.type === "dock") {
      for (let z = -o.d; z < o.d; z += 0.6) m.box(o.w * 2, 0.15, 0.54, "#bc9460", 0, 0.7, z);
      for (const x of [-o.w, o.w])
        for (const z of [-o.d, o.d]) m.cyl(0.18, 0.21, 4, "#7c6853", x, -0.3, z, 7);
      g.add(m.mesh());
    } else {
      m.box(o.w * 1.6, o.h, o.d * 1.6, "#b78b53", 0, o.h / 2, 0)
        .box(o.w * 1.63, 0.1, o.d * 1.63, "#e0c294", 0, 0.16, 0)
        .box(o.w * 1.63, 0.1, o.d * 1.63, "#e0c294", 0, o.h - 0.16, 0)
        .box(0.1, o.h, o.d * 1.63, "#d9b584", 0, o.h / 2, 0);
      g.add(m.mesh());
    }
    g.position.set(o.x, o.y, o.z);
    g.rotation.y = o.yaw || 0;
    Object.assign(g.userData, { type: o.type, hp: o.hp });
    return g;
  }
  // A build is deliberately assembled only from the authoritative 3x3 occupied
  // cells. Decorative braces never cover a missing cell, so an edited doorway or
  // window remains visually as open as the collision and raycast contract.
  function buildModel(b, ghost = false) {
    const m = new Model(), materialKind = b.material === "wood" ? "wood" : b.material === "stone" ? "stone" : "metal";
    const palette = materialKind === "wood"
      ? { face: "#dca35c", shade: "#c28446", edge: "#7a4b26", accent: "#f2c47f" }
      : materialKind === "stone"
        ? { face: "#cf6b48", shade: "#ad5238", edge: "#e8dcc8", accent: "#f3e6d0" }
        : { face: "#9eabb5", shade: "#6f7d88", edge: "#3a444e", accent: "#ffd23f" };
    const mask = b.editMask == null ? (b.edited ? 367 : 511) : b.editMask;
    const occupied = (row, col) => !!(mask & (1 << (row * 3 + col)));
    const cell = 4 / 3;
    const wallCell = (x, y) => {
      if (materialKind === "wood") {
        // Three separate boards and two rails read as timber framing, while a
        // small warm grain strip makes it distinct from pale stone at a distance.
        for (let k = 0; k < 3; k++) m.box(.404, .92, .19, k === 1 ? palette.shade : palette.face, x + (k - 1) * .43, y, 0);
        m.box(1.29, .055, .245, palette.edge, x, y - .445, 0).box(1.29, .048, .245, palette.edge, x, y + .445, 0)
          .box(.034, .91, .252, palette.accent, x, y, -.018);
      } else if (materialKind === "stone") {
        // Offset courses create masonry rather than a painted flat panel.
        for (let k = 0; k < 3; k++) {
          const offset = k % 2 ? -.09 : .09;
          m.box(.60, .265, .285, k === 1 ? palette.shade : palette.face, x - .31 + offset, y - .32 + k * .32, 0);
          m.box(.60, .265, .285, k === 1 ? palette.face : palette.shade, x + .31 + offset, y - .32 + k * .32, 0);
        }
        m.box(1.29, .042, .31, palette.edge, x, y - .47, 0).box(1.29, .035, .31, palette.accent, x, y + .47, -.008);
      } else {
        // Riveted metal plates: inset panel, cross brace and seam stay within the
        // exact cell footprint (critical for edited holes).
        m.box(1.285, .95, .205, palette.face, x, y, 0)
          .box(1.16, .80, .226, palette.shade, x, y, -.018)
          .box(.038, 1.00, .245, palette.accent, x, y, -.035, 0, 0, .70)
          .box(.038, 1.00, .245, palette.edge, x, y, -.038, 0, 0, -.70)
          .box(1.28, .040, .25, palette.edge, x, y - .47, 0);
        for (const sx of [-.51, .51]) for (const sy of [-.36, .36]) m.ball(.035, palette.accent, x + sx, y + sy, -.13, 1, 1, .42, 0);
      }
    };
    if (b.type === "wall") {
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) if (occupied(row, col)) wallCell(-cell + col * cell, 2.5 - row);
      for (let i = 1; i < m.p.length; i += 3) m.p[i] *= 4 / 3;
    } else if (b.type === "roof") {
      for (const [i, triangle] of S.roofTriangles(b).entries()) {
        const [a, c, d] = triangle, bottom = triangle.map(p => [p[0], p[1] - .12, p[2]]);
        const faces = [a, c, d, bottom[2], bottom[1], bottom[0]];
        for (let edge = 0; edge < 3; edge++) {
          const next = (edge + 1) % 3;
          faces.push(triangle[edge], bottom[edge], bottom[next], triangle[edge], bottom[next], triangle[next]);
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(faces.flat(), 3)); geometry.computeVertexNormals();
        m.add(geometry, i % 2 ? palette.shade : palette.face);
      }
    } else if (b.type === "floor") {
      for (let row=0; row<2; row++) for (let col=0; col<2; col++) {
        if (!(mask & (1 << (row*6+col*2)))) continue;
        const x=col*2-1, z=row*2-1;
        for (let plank=0; plank<5; plank++) m.box(.385,.14,1.98,plank%2?palette.shade:palette.face,x+(plank-2)*.4,-.07,z);
        m.box(1.98,.08,.08,palette.edge,x,-.16,z-.92).box(1.98,.08,.08,palette.edge,x,-.16,z+.92);
      }
    } else {
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        if (!occupied(row, col)) continue;
        const x = -cell + col * cell, z = -cell + row * cell;
        if (b.type === "ramp") {
          const y = 2 - z - .07;
          if (materialKind === "wood") {
            for (let k = 0; k < 3; k++) m.box(.405, .12, cell * Math.SQRT2 - .04, k === 1 ? palette.shade : palette.face, x + (k - 1) * .43, y, z, Math.PI / 4);
          } else if (materialKind === "stone") {
            for (let k = 0; k < 3; k++) m.box(cell - .04, .12, .41, k === 1 ? palette.shade : palette.face, x, y - (k - 1) * .29, z + (k - 1) * .39, Math.PI / 4);
          } else {
            m.box(cell - .035, .13, cell * Math.SQRT2 - .035, palette.face, x, y, z, Math.PI / 4)
              .box(cell - .16, .035, cell * Math.SQRT2 - .18, palette.shade, x, y + .045, z, Math.PI / 4);
          }
          for (let k = 0; k < 3; k++) m.box(cell - .035, .045, .065, palette.edge, x, y - (k - 1) * .28 + .025, z + (k - 1) * .4, Math.PI / 4);
        } else if (b.type === "roof") {
          const tilt = x < -.1 ? Math.atan(.5) : x > .1 ? -Math.atan(.5) : 0, y = 1 - Math.abs(x) * .5 - .06;
          if (col === 1) {
            for (const side of [-1, 1]) m.box(cell / 2 + .02, .12, cell - .015, palette.face, side * cell / 4, 1 - cell / 8 - .06, z, 0, 0, -side * Math.atan(.5));
          } else m.box(cell * Math.sqrt(1.25) - .02, .12, cell - .02, palette.face, x, y, z, 0, 0, tilt);
          m.box(cell * .9, .028, .08, materialKind === "metal" ? palette.accent : palette.edge, x, y + .08, z, 0, 0, tilt);
        } else {
          if (materialKind === "wood") for (let k = 0; k < 3; k++) m.box(.405, .14, cell - .015, k === 1 ? palette.shade : palette.face, x + (k - 1) * .43, -.07, z);
          else if (materialKind === "stone") for (let k = 0; k < 2; k++) m.box(cell - .025, .14, .61, k ? palette.shade : palette.face, x, -.07, z + (k ? .32 : -.32));
          else m.box(cell - .025, .14, cell - .015, palette.face, x, -.07, z).box(cell - .16, .024, cell - .15, palette.shade, x, .013, z);
          m.box(cell - .02, .07, .06, palette.edge, x, -.145, z - .57).box(cell - .02, .07, .06, palette.edge, x, -.145, z + .57);
        }
      }
    }
    /* Full pieces receive a structural silhouette. Edited cells stay untouched so
       doors, windows and corner cuts remain exact and genuinely passable. */
    if (mask === 511) {
      if (b.type === "wall") {
        m.box(.13, 4.12, .34, palette.edge, -2, 2, 0).box(.13, 4.12, .34, palette.edge, 2, 2, 0)
          .box(4.12, .13, .34, palette.edge, 0, -.04, 0).box(4.12, .13, .34, palette.accent, 0, 4.04, 0);
      } else if (b.type === "floor") {
        m.box(4.08, .12, .13, palette.edge, 0, -.19, -2).box(4.08, .12, .13, palette.edge, 0, -.19, 2)
          .box(.13, .12, 4.08, palette.edge, -2, -.19, 0).box(.13, .12, 4.08, palette.edge, 2, -.19, 0);
      } else if (b.type === "ramp") {
        m.box(.14, .16, 5.72, palette.edge, -2, 2, 0, Math.PI / 4).box(.14, .16, 5.72, palette.edge, 2, 2, 0, Math.PI / 4);
      } else if (b.type === "roof") {
        m.box(4.08, .12, .13, palette.edge, 0, -.08, -2).box(4.08, .12, .13, palette.edge, 0, -.08, 2);
      }
      /* v19 sturdiness: full pieces get corner gussets with bolts (wall), cross
         beams under the deck (floor), cleats across the slope (ramp) and eave
         boards (roof). Edited pieces stay untouched so holes remain exact. */
      if (b.type === "wall") {
        for (const sx of [-1, 1]) for (const sy of [0, 1]) {
          m.box(.34, .34, .06, palette.edge, sx * 1.76, .66 + sy * 1.72, -.10, 0, 0, sx * (sy ? .6 : -.6));
          for (const bx of [-.09, .09]) for (const by of [-.09, .09])
            m.ball(.022, palette.accent, sx * 1.76 + bx, .66 + sy * 1.72 + by, -.135, 1, 1, .5, 0);
        }
      } else if (b.type === "floor") {
        for (const sz of [-1, 1]) m.box(3.9, .10, .14, palette.edge, 0, -.30, sz * 1.2);
        for (const sx of [-1, 1]) m.box(.14, .10, 3.9, palette.edge, sx * 1.2, -.30, 0);
      } else if (b.type === "ramp") {
        for (const z of [-1.2, 0, 1.2]) m.box(3.7, .05, .10, palette.edge, 0, 2 - z - .02, z, Math.PI / 4);
      } else if (b.type === "roof") {
        for (const sz of [-1, 1]) m.box(4.1, .09, .12, palette.edge, 0, .02, sz * 2.02);
      }
    }
    const mesh = m.mesh();
    mesh.material = buildMaterials[materialKind];
    // View.disposeTree honours this marker and retains the cached material while
    // releasing only per-piece geometry as builds stream in/out.
    mesh.userData = { artMaterial: materialKind, editMask: mask, buildType: b.type, buildId: b.id, shared: true };
    if (ghost) {
      mesh.material = new T.MeshBasicMaterial({ color: "#68eced", transparent: true, opacity: .35, depthWrite: false, blending: T.AdditiveBlending });
      // The active preview's opacity/color are animated by View, so it remains
      // per-preview and disposable; completed builds retain the shared cache.
      mesh.userData.shared = false;
      mesh.userData.preview = true;
    }
    mesh.position.set(b.x, b.y, b.z); mesh.rotation.y = b.yaw || 0;
    return mesh;
  }
  function vehicleModel(v) {
    const g = new T.Group(), m = new Model();
    const fallback = v.type === "buggy" ? "#f6c356" : v.type === "van" ? "#43b8bd" : v.type === "boat" ? "#eee0b5" : v.type === "sport" ? "#db5570" : "#ed8768";
    const col = /^#[0-9a-f]{6}$/i.test(v.paint || "") ? v.paint : fallback;
    const dark = "#172b38", glass = "#86cddd", chrome = "#d8e4df", rubber = "#17212a";
    if (v.type === "boat") {
      // A stepped hull, raised cockpit, rail and outboard give the water vehicle a
      // wholly different silhouette from the road fleet.
      m.box(2.3, .34, 4.3, dark, 0, .18, 0)
        .box(2.08, .38, 4.05, col, 0, .39, 0)
        .box(1.78, .12, 3.35, "#f4ead4", 0, .62, .08)
        .box(1.36, .54, 1.12, col, 0, .92, -.55)
        .box(1.2, .4, .055, glass, 0, 1.15, -1.125)
        .box(.06, .28, 1.08, glass, -.69, 1.15, -.55)
        .box(.06, .28, 1.08, glass, .69, 1.15, -.55)
        .box(1.88, .06, .07, chrome, 0, .86, 1.72)
        .box(.12, .48, .12, chrome, -.94, .94, 1.45)
        .box(.12, .48, .12, chrome, .94, .94, 1.45)
        .box(.56, .64, .48, dark, 0, .42, 2.28)
        .box(.34, .22, .16, chrome, 0, .12, 2.58);
      for (const x of [-.83, .83]) m.box(.055, .32, 2.5, chrome, x, .78, .2);
    } else if (v.type === "buggy") {
      // Open tubular buggy: exposed suspension and roll cage remain readable in dust.
      m.box(1.92, .3, 3.25, dark, 0, .42, 0)
        .box(1.65, .28, 1.5, col, 0, .61, -.72)
        .box(1.5, .16, 1.1, col, 0, .79, -.95)
        .box(1.44, .12, .08, glass, 0, .99, -.78)
        .box(1.76, .13, .2, col, 0, .52, 1.42)
        .box(.12, 1.1, .12, chrome, -.76, 1.05, .37, 0, 0, -.34)
        .box(.12, 1.1, .12, chrome, .76, 1.05, .37, 0, 0, .34)
        .box(1.62, .12, .12, chrome, 0, 1.52, .34)
        .box(.62, .28, .2, dark, 0, .75, .64);
    } else if (v.type === "van") {
      // Tall utilitarian fourgon with roof rack, split rear doors and broad glazing.
      m.box(2.05, .54, 4.05, col, 0, .51, 0)
        .box(1.86, 1.23, 2.48, col, 0, 1.29, .38)
        .box(1.7, .47, .055, glass, 0, 1.38, -1.18)
        .box(.055, .58, 1.17, glass, -.96, 1.43, -.02)
        .box(.055, .58, 1.17, glass, .96, 1.43, -.02)
        .box(1.66, .42, .055, "#54798b", 0, 1.35, 1.64)
        .box(.055, .82, 1.72, dark, 0, 1.24, 1.69)
        .box(1.68, .1, .08, chrome, 0, 2.0, .36)
        .box(.08, .1, 2.3, chrome, -.9, 2.0, .36)
        .box(.08, .1, 2.3, chrome, .9, 2.0, .36);
    } else if (v.type === "sport") {
      // Low coupé: long hood, compact greenhouse, spoiler and flared arches.
      m.box(2.08, .36, 3.92, dark, 0, .4, 0)
        .box(1.96, .42, 3.78, col, 0, .6, 0)
        .box(1.76, .23, 1.38, col, 0, .88, -1.0)
        .box(1.56, .58, 1.5, col, 0, 1.16, .3)
        .box(1.35, .38, .055, glass, 0, 1.23, -.34)
        .box(1.38, .38, .055, glass, 0, 1.25, .95)
        .box(.055, .38, .9, glass, -.79, 1.21, .3)
        .box(.055, .38, .9, glass, .79, 1.21, .3)
        .box(2.0, .11, .14, dark, 0, .61, -1.96)
        .box(1.05, .07, .12, dark, 0, 1.2, 1.67)
        .box(.08, .25, .08, dark, -.48, 1.08, 1.62)
        .box(.08, .25, .08, dark, .48, 1.08, 1.62);
    } else {
      // Standard sedan: separate hood/trunk, cabin, bumpers and lamp clusters.
      m.box(2.03, .5, 3.82, col, 0, .52, 0)
        .box(1.8, .26, 1.35, col, 0, .82, -1.0)
        .box(1.63, .76, 1.62, col, 0, 1.18, .23)
        .box(1.43, .45, .055, glass, 0, 1.26, -.49)
        .box(1.43, .45, .055, glass, 0, 1.26, .94)
        .box(.055, .4, .95, glass, -.83, 1.22, .2)
        .box(.055, .4, .95, glass, .83, 1.22, .2)
        .box(1.95, .13, .17, dark, 0, .45, -1.9)
        .box(1.88, .11, .15, dark, 0, .49, 1.88);
    }
    if (v.type !== "boat") {
      for (const x of [-.66, .66]) {
        m.box(.42, .14, .075, "#fff1a8", x, .72, -1.93);
        m.box(.35, .11, .07, "#e85f5f", x, .74, 1.93);
      }
      m.box(.3, .08, 3.5, chrome, 0, .76, 0);
    }
    // v21 brightwork: fin antennae, roof rails and hull striping sharpen each
    // family silhouette at distance. All parts join the single vehicle mesh.
    if (v.type === "sport") { m.box(.06, .5, .14, dark, 0, 1.62, -.5).box(2.0, .1, .5, dark, 0, .32, 0); }
    else if (v.type === "van") { for (const x of [-.7, .7]) m.box(.08, .08, 2.3, chrome, x, 2.12, .36); }
    else if (v.type === "buggy") { m.box(1.5, .08, .08, "#e85f5f", 0, 1.56, .34); }
    else if (v.type === "boat") { m.box(2.12, .1, 4.1, chrome, 0, .52, 0); }
    else { m.box(.5, .34, .16, dark, 0, 1.5, 1.55); }
    g.add(m.mesh());
    g.userData.wheels = []; g.userData.rotors = []; g.userData.type = v.type;
    if (v.type !== "boat") {
      const radius = v.type === "buggy" ? .48 : v.type === "sport" ? .4 : .43;
      const axleX = v.type === "buggy" ? 1.04 : 1.06;
      for (const x of [-axleX, axleX]) for (const z of [-1.22, 1.2]) {
        const pivot = new T.Group(); pivot.position.set(x, radius, z);
        const wheel = new Model().cyl(radius, radius, .28, rubber, 0, 0, 0, 14, 0, Math.PI / 2)
          .cyl(radius * .55, radius * .55, .295, v.type === "sport" ? "#d6dde2" : chrome, 0, 0, 0, 12, 0, Math.PI / 2)
          .cyl(radius * .18, radius * .18, .31, dark, 0, 0, 0, 10, 0, Math.PI / 2).mesh();
        pivot.add(wheel); g.add(pivot); g.userData.wheels.push(wheel);
        if (z < 0) g.userData.steeringWheels ||= [], g.userData.steeringWheels.push(pivot);
      }
    } else {
      const prop = new T.Group(); prop.position.set(0, .28, 2.58);
      prop.add(new Model().cyl(.08, .08, .35, chrome, 0, 0, 0, 8, Math.PI / 2).box(.12, .54, .05, chrome, 0, 0, 0).box(.54, .12, .05, chrome, 0, 0, 0).mesh());
      g.add(prop); g.userData.rotors.push(prop);
    }
    g.userData.seat = [0, 1.02, -.05];
    return g;
  }
  // Menu-only geometry: a compact coral-and-petrol launch terrace, deliberately
  // separate from simulated objects/colliders.  It gives the lobby a place rather
  // than a floating avatar without adding anything to the playable island.
  function launchTerrace() {
    const group = new T.Group(), base = new Model();
    base.cyl(3.95, 4.42, .32, "#17384b", 0, -.18, 0, 56)
      .cyl(3.62, 3.95, .13, "#2b6070", 0, .04, 0, 56)
      .cyl(2.06, 2.2, .085, "#f1b66b", 0, .135, 0, 48)
      .cyl(1.84, 2.02, .045, "#163146", 0, .188, 0, 48);
    // segmented solar inlay and a landing ramp build a readable expedition deck.
    for (let i=0;i<12;i++) { const a=i*Math.PI*2/12; base.box(.11,.035,1.22,i%2?"#56c8cb":"#f08767",Math.sin(a)*2.72,.14,Math.cos(a)*2.72,0,a,0); }
    base.box(2.45,.18,2.9,"#24546a",0,-.02,4.08,0,0,.12)
      .box(2.17,.03,2.62,"#4d9c9b",0,.09,4.08,0,0,.12);
    group.add(base.mesh());
    // The rebuilt lobby deck reads as a working departure dock: segmented rails,
    // navigation consoles, mooring bollards and a low holographic compass.
    const deckDetail = new Model();
    for (let i=0;i<9;i++) {
      const a=-2.45+i*.61, x=Math.sin(a)*3.55, z=Math.cos(a)*3.55;
      deckDetail.cyl(.045,.065,.72,i%2?"#63d9d5":"#f0ad68",x,.46,z,7)
        .box(.64,.045,.07,"#b9d8d2",Math.sin(a)*3.56,.80,Math.cos(a)*3.56,0,a,0);
    }
    for (const side of [-1,1]) deckDetail
      .box(.58,.46,.78,"#16384d",side*2.92,.30,1.58,0,side*.16,0)
      .box(.45,.035,.55,side<0?"#60d7d1":"#ee966f",side*2.92,.55,1.56,-.22,side*.16,0)
      .cyl(.12,.16,.34,"#f1c173",side*1.05,.26,3.50,9)
      .cyl(.075,.075,.58,"#18384a",side*1.05,.50,3.50,8,Math.PI/2);
    deckDetail.box(1.78,.08,.22,"#f0c87a",0,.19,3.04)
      .box(.10,.48,.10,"#d7ede3",-.80,.38,3.04)
      .box(.10,.48,.10,"#d7ede3",.80,.38,3.04);
    group.add(deckDetail.mesh());
    const navRings=[];
    for(const [radius,color,opacity] of [[1.16,"#6ee7df",.30],[1.46,"#efac72",.24],[1.73,"#c6f4df",.17]]){
      const ring=new T.Mesh(new T.TorusGeometry(radius,.012,6,72),new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending}));
      ring.rotation.x=Math.PI/2;ring.position.y=.225;group.add(ring);navRings.push(ring);
    }
    const portal = new T.Group(); portal.position.set(0,.2,-2.65);
    const arch = new Model().cyl(.12,.16,2.82,"#e58965",-1.48,1.35,0,10,0,0,.38,1)
      .cyl(.12,.16,2.82,"#e58965",1.48,1.35,0,10,0,0,-.38,1)
      .box(2.7,.14,.22,"#f5c26e",0,2.64,0);
    portal.add(arch.mesh());
    const veil = new T.Mesh(new T.PlaneGeometry(2.56,2.24,20,16),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:'uniform float time;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.y*8.+time*2.)*.07;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'varying vec2 vUv;void main(){float edge=smoothstep(0.,.18,vUv.x)*smoothstep(0.,.18,1.-vUv.x)*smoothstep(0.,.08,vUv.y);gl_FragColor=vec4(.16,.82,.84,edge*.19);}'}));
    veil.position.set(0,1.35,.04); portal.add(veil); group.add(portal);
    group.userData.portal = veil.material.uniforms;
    group.userData.navRings = navRings;
    const beacons=[];
    for (const a of [-2.28,-.86,.86,2.28]) { const b=new T.Mesh(new T.CylinderGeometry(.08,.13,.72,8),new T.MeshBasicMaterial({color:'#ffe0a0',transparent:true,opacity:.9}));b.position.set(a,.52,2.58);group.add(b);beacons.push(b); }
    group.userData.beacons=beacons;
    return group;
  }
  function aircraft() {
    const metalBus = () => '#7795a0';
    const g = new T.Group(),
      m = new Model();
    // A converted expedition bus rather than an aircraft fuselage: blue coachwork, window belt and roof rack.
    m.box(4.8, 2.5, 10.4, "#2779a7", 0, 0, 0)
      .box(4.9, 0.18, 10.5, C.ink, 0, -1.15, 0)
      .box(4.85, 0.22, 10.5, C.white, 0, 0.14, 0)
      .box(4.75, 0.22, 10.3, "#174d78", 0, 1.36, 0);
    for (let z = -4; z < 4.6; z += 1.45)
      for (const x of [-2.43, 2.43])
        m.box(0.06, 0.9, 1.08, "#91d7df", x, 0.65, z).box(0.1, 0.09, 1.2, C.gold, x, 0.15, z);
    // Windshield, grille, lamps, folding door, mirrors and a compact roof console make the bus readable.
    m.box(4.2, 1.1, 0.07, "#8ad1df", 0, 0.53, -5.24)
      .box(4.75, 0.3, 0.3, C.ink, 0, -0.86, -5.35)
      .box(3.25, 0.1, 0.08, C.gold, 0, 0.01, -5.3)
      .box(0.53, 0.55, 0.06, "#bcecf1", 1.66, 0.35, -5.285)
      .box(0.36, 0.13, 0.1, C.gold, -1.64, -0.12, -5.35)
      .box(0.36, 0.13, 0.1, C.gold, 1.64, -0.12, -5.35)
      .box(0.12, 1.42, 1.25, "#153f61", 2.44, 0.22, -1.8)
      .box(0.07, 0.04, 1.08, "#7edfeb", 2.505, 0.22, -1.8)
      .box(0.12, 0.1, 0.76, C.ink, -2.67, 1.12, -4.05)
      .box(0.12, 0.1, 0.76, C.ink, 2.67, 1.12, -4.05)
      .box(0.07, 0.62, 0.08, C.ink, -2.6, 1.0, -4.05, 0, 0, 0.38)
      .box(0.07, 0.62, 0.08, C.ink, 2.6, 1.0, -4.05, 0, 0, -0.38)
      .box(2.7, 0.16, 3.15, "#193d57", 0, 1.71, 0)
      .box(1.2, 0.32, 1.35, "#31bccb", 0, 2.0, 0)
      .cyl(0.19, 0.28, 0.86, "#4ee0e0", 0, 2.39, 0, 12)
      .box(0.55, 0.18, 0.15, C.gold, 0, 2.63, -0.34);
    for (const x of [-1.64, 1.64]) m.box(0.65, 0.38, 0.1, C.gold, x, -0.32, -5.28);
    for (const x of [-2.5, 2.5])
      for (const z of [-3.2, 3.2])
        m.cyl(0.78, 0.78, 0.43, C.ink, x, -1.27, z, 14, 0, Math.PI / 2).cyl(
          0.4,
          0.4,
          0.45,
          C.gold,
          x,
          -1.27,
          z,
          12,
          0,
          Math.PI / 2,
        );
    m.box(3.5, 0.25, 6.8, "#f4dfae", 0, 1.61, 0);
    for (const x of [-1.8, 1.8])
      for (const z of [-3.4, 3.4]) m.cyl(0.035, 0.035, 10.2, C.gold, x, 6.5, z, 6, 0, x * 0.028);
    m.cyl(0.2, 0.8, 1.3, "#83edec", 0, 2.5, 0, 12).cyl(0.9, 0.9, 0.45, C.ink, 0, 1.95, 0, 12);
    // AZUR expedition carrier: exposed reinforced chassis, luggage walkway,
    // segmented coach panels, front sun visor and rear service platform. All of
    // these details join the ONE coach mesh, not one mesh per bolt/window frame.
    m.box(4.9,.13,.66,'#18394e',0,1.32,-5.35,-.15)
      .box(.075,1.08,.09,C.ink,0,.59,-5.31)
      .box(4.8,.13,.46,metalBus(),0,-1.22,-5.43)
      .box(4.8,.13,.55,metalBus(),0,-1.20,5.37)
      .box(3.8,.12,1.15,C.ink,0,-.8,5.73)
      .box(1.75,.66,.66,'#1b5069',0,-.36,5.55)
      .box(1.94,.09,.73,C.gold,0,.015,5.55)
      .box(3.4,.16,8.7,'#233849',0,-1.35,0)
      .box(.18,.18,9.6,metalBus(),-1.8,-1.3,0)
      .box(.18,.18,9.6,metalBus(),1.8,-1.3,0)
      .box(3.7,.12,7.4,metalBus(),0,1.66,.3);
    for(const side of [-1,1]) {
      for(let i=0;i<7;i++) m.box(.065,.035,.64,'#142d42',side*2.475,-.44+i*.075,4.03);
      for(let z=-3.9;z<4.6;z+=1.45) {
        m.box(.075,1.06,.07,'#e7e4c7',side*2.482,.70,z-.59)
          .box(.075,.05,1.25,metalBus(),side*2.481,1.19,z)
          .box(.06,.025,1.12,'#16496a',side*2.47,-.46,z)
          .box(.067,.28,.032,metalBus(),side*2.47,-.70,z+.58)
          .box(.072,.026,.13,C.gold,side*2.477,-.60,z-.32);
      }
      // Walkway rail, cable anchors and buoyancy cradle.
      m.box(.06,.06,7.6,C.gold,side*1.95,2.10,.3);
      for(const z of [-3.5,-1.4,1.2,4.1]) m.box(.055,.50,.055,C.ink,side*1.95,1.87,z);
      m.box(.18,.2,2.6,'#326a7c',side*2.8,.23,-2.9,0,0,-side*.17)
        .box(.18,.2,2.6,'#326a7c',side*2.8,.23,2.9,0,0,-side*.17)
        .cyl(.58,.58,.56,C.ink,side*2.53,-1.28,1.72,14,0,Math.PI/2)
        .cyl(.29,.29,.58,C.gold,side*2.53,-1.28,1.72,10,0,Math.PI/2)
        .cyl(.14,.14,1.0,metalBus(),side*1.48,-1.56,2.3,10,Math.PI/2);
    }
    for(let i=0;i<6;i++) m.box(2.9,.058,.063,'#638595',0,-.42+i*.085,-5.295);
    for(let i=0;i<5;i++) m.box(.7,.045,.12,C.gold,2.77,-1.20+i*.22,-1.81);
    // Roof equipment: two luggage trunks, tied-down oxygen tanks and radiator.
    for(const x of [-1,1]) m.box(.8,.46,1.14,x<0?'#c58950':'#305d77',x,1.94,2.52)
      .box(.11,.48,1.16,C.ink,x,1.94,2.52).cyl(.19,.19,1.0,'#91b9bd',x,1.94,-2.12,10,Math.PI/2);
    for(let i=0;i<7;i++)m.box(1.3,.052,.09,metalBus(),0,1.82,-1.6+i*.17);
    // A high-contrast expedition pennant and roof-deck beacon read as authored
    // carrier identity when the enlarged bus crosses the sky; both stay in the
    // single coach batch rather than becoming extra scene objects.
    m.box(2.1,.045,.52,C.coral,0,1.79,-.18)
      .box(.12,.06,.68,C.gold,0,1.85,-.18)
      .box(.72,.07,.08,C.white,0,1.88,-.18)
      // Close-up coachwork: split windshield, working-looking wipers, armored
      // corners, rear ladder, service hatches and underbody suspension.
      .box(.075,1.04,.085,C.ink,0,.54,-5.30)
      .box(1.72,.045,.055,"#d9edf0",-.92,.36,-5.34,0,0,-.14)
      .box(1.72,.045,.055,"#d9edf0",.92,.36,-5.34,0,0,.14)
      .box(.24,2.25,.22,"#234659",-2.38,-.04,-5.17,0,0,-.08)
      .box(.24,2.25,.22,"#234659",2.38,-.04,-5.17,0,0,.08)
      .box(1.56,.58,.10,"#315f73",0,-.48,5.30)
      .box(1.32,.06,.13,C.gold,0,-.22,5.37)
      .box(.075,2.28,.10,C.gold,1.68,.14,5.36)
      .box(.075,2.28,.10,C.gold,2.10,.14,5.36)
      .box(.58,.065,.12,C.gold,1.89,-.72,5.39)
      .box(.58,.065,.12,C.gold,1.89,-.22,5.39)
      .box(.58,.065,.12,C.gold,1.89,.28,5.39)
      .box(.58,.065,.12,C.gold,1.89,.78,5.39)
      .box(3.85,.20,.48,"#172f41",0,-1.55,-3.36)
      .box(3.85,.20,.48,"#172f41",0,-1.55,3.36);
    for (const side of [-1, 1]) {
      for (let panel = 0; panel < 5; panel++)
        m.box(.035,.43,1.18,panel % 2 ? "#2c8bb0" : "#236f97",side*2.49,-.69,-3.70+panel*1.82,0,0,side*.025);
      m.box(.12,.12,8.95,C.gold,side*2.51,-1.06,.05);
    }
    // Version 1.2: reinforced flight deck, solar navigation panels, bumper guards
    // and readable service markings add depth without multiplying draw calls.
    for (const x of [-1.08, 1.08]) {
      m.box(1.72,.07,1.48,"#193f5b",x,2.23,3.55,0,0,x*.018)
        .box(1.54,.018,.045,"#75d6dd",x,2.276,3.12)
        .box(1.54,.018,.045,"#75d6dd",x,2.276,3.60)
        .box(1.54,.018,.045,"#75d6dd",x,2.276,4.08)
        .box(.045,.02,1.36,"#bdebe5",x-.48,2.28,3.55)
        .box(.045,.02,1.36,"#bdebe5",x+.48,2.28,3.55);
    }
    m.box(4.55,.16,.18,C.gold,0,-.78,-5.58)
      .box(4.05,.08,.12,"#d9edf0",0,.02,-5.39)
      .box(2.08,.06,.09,C.coral,0,-.72,-5.47)
      .cyl(.08,.08,2.25,C.gold,-2.15,-.12,-5.44,8,0,0,.22)
      .cyl(.08,.08,2.25,C.gold,2.15,-.12,-5.44,8,0,0,-.22);
    for (const z of [-4.25,-2.65,-1.05,.55,2.15,3.75])
      m.box(.035,1.72,.055,"#e8f4e7",-2.515,.62,z).box(.035,1.72,.055,"#e8f4e7",2.515,.62,z);
    // v1.4 high-altitude hardware: reinforced pressure bands, altimeter pod and
    // vented turbine feeds make the transport feel engineered for the new route.
    m.box(2.36,.32,.68,"#173c52",0,2.33,-3.46)
      .box(1.78,.06,.74,C.gold,0,2.50,-3.46)
      .box(.72,.09,.38,"#74e3e3",0,2.56,-3.52)
      .cyl(.16,.16,.72,"#d9eee9",0,2.94,-3.46,10)
      .box(.18,.18,.15,C.coral,0,3.31,-3.46);
    for(const side of [-1,1]) for(const z of [-3.9,-1.3,1.3,3.9])
      m.box(.16,.13,.62,"#365f70",side*2.66,.02,z,0,0,side*.08)
        .box(.05,.05,.48,C.gold,side*2.76,.02,z,0,0,side*.08);
    const coach = m.mesh();
    g.add(coach);
    // Independent warm cabin panes make the vehicle read as a pressurised expedition
    // gondola at range. They are rendered geometry, not UI sprites or copied art.
    const cabinGlow = new T.Group(), cabinPanes = [], paneGeometry = new T.PlaneGeometry(.88,.65);
    for (let z=-4;z<4.6;z+=1.45) for (const x of [-2.465,2.465]) {
      const pane = new T.Mesh(paneGeometry,new T.MeshBasicMaterial({color:'#91e4d9',transparent:true,opacity:.38,depthWrite:false}));
      pane.position.set(x,.67,z); pane.rotation.y=x<0?-Math.PI/2:Math.PI/2; cabinGlow.add(pane); cabinPanes.push(pane);
    }
    g.add(cabinGlow);
    // Four pivoted duct turbines, struts and navigation lamps distinguish the
    // airship from a road coach while keeping the original bus silhouette/camera.
    const turbines=[];
    for (const x of [-3.18,3.18]) for (const z of [-2.9,2.9]) {
      const turbine=new T.Group(); turbine.position.set(x,.25,z);
      turbine.add(new Model().cyl(.66,.72,.72,'#203d51',0,0,0,14,0,Math.PI/2)
        .add(new T.TorusGeometry(.56,.09,6,16),'#65cad0',Math.sign(x)*.39,0,0,0,Math.PI/2)
        .box(.78,.07,.07,C.gold,0,.67,0).box(.78,.07,.07,C.gold,0,-.67,0).mesh());
      const rotor=new T.Group(); rotor.rotation.y=Math.PI/2;
      rotor.position.x=Math.sign(x)*.40;
      const blades=new Model().cyl(.105,.105,.1,C.gold,0,0,0,10,Math.PI/2);
      for(let a=0;a<6;a++)blades.box(.13,.55,.038,'#d9f2df',Math.sin(a*Math.PI/3)*.26,Math.cos(a*Math.PI/3)*.26,0,0,0,-a*Math.PI/3+.2);
      rotor.add(blades.mesh());
      turbine.add(rotor); g.add(turbine); turbines.push(rotor);
    }
    const navLights=[];
    for (const [x,col] of [[-3.5,'#ff846b'],[3.5,'#69edf0']]) { const light=new T.Mesh(new T.SphereGeometry(.11,8,6),new T.MeshBasicMaterial({color:col})); light.position.set(x,1.4,-3.7);g.add(light);navLights.push(light); }
    const headlights=[];
    for (const x of [-1.64,1.64]) {
      const lamp=new T.Mesh(new T.CircleGeometry(.29,18),new T.MeshBasicMaterial({color:'#fff1b2',transparent:true,opacity:.92,depthWrite:false,side:T.DoubleSide}));
      lamp.position.set(x,-.31,-5.365);g.add(lamp);headlights.push(lamp);
    }
    const energyCore=new T.Group();energyCore.position.set(0,-1.72,0);
    const coreRing=new T.Mesh(new T.TorusGeometry(.72,.09,8,28),new T.MeshBasicMaterial({color:'#77f6ee'}));coreRing.rotation.x=Math.PI/2;
    const coreOrb=new T.Mesh(new T.IcosahedronGeometry(.38,1),new T.MeshBasicMaterial({color:'#fff0a8'}));energyCore.add(coreRing,coreOrb);g.add(energyCore);
    const interior = new T.Group(); interior.visible=false;
    const seats=new Model();
    for(let z=-3.4;z<=3.4;z+=1.35) for(const x of [-1.15,1.15]) seats.box(.72,.42,.55,'#d49b63',x,-.25,z).box(.72,.08,.55,'#f1d59a',x,.01,z);
    interior.add(seats.mesh());
    g.add(interior);
    const balloon = new T.Group();
    balloon.add(
      new Model()
        .sphere(6.8, "#20becd", 0, 13.2, 0, 1, 1.15, 1)
        .sphere(4.1, "#f8eac8", 0, 8.7, 0, 0.91, 0.76, 0.91)
        .cyl(3.1, 3.1, 0.11, "#f4d985", 0, 10.15, 0, 24)
        .cyl(1.2, 0.7, 1.1, "#208995", 0, 7, 0, 16)
        .cyl(1.8, 2, 0.3, C.gold, 0, 20.7, 0, 20)
        .mesh(),
    );
    // Envelope seams are one LineSegments draw instead of twelve independent
    // materials/lines. Twin tail fins and a compass insignia give it an original
    // airship silhouette; no external texture, font or branded bus is involved.
    const seamPoints=[];
    for(let a=0;a<16;a++)for(let j=0;j<24;j++)for(const k of [j,j+1]) {
      const theta=a*Math.PI/8, ph=.16+k*Math.PI*.84/24;
      seamPoints.push(Math.sin(ph)*6.85*Math.cos(theta),13.2+Math.cos(ph)*7.83,Math.sin(ph)*6.85*Math.sin(theta));
    }
    const seams=new T.BufferGeometry();seams.setAttribute('position',new T.Float32BufferAttribute(seamPoints,3));
    balloon.add(new T.LineSegments(seams,new T.LineBasicMaterial({color:'#8be7df',transparent:true,opacity:.7})));
    const envelope=new Model();
    for(const side of [-1,1])envelope.box(2.6,.13,3.4,'#f4dfae',side*2.15,12.3,6.05,0,side*.34,side*.12)
      .box(2.45,.14,.14,C.gold,side*2.15,12.36,7.45,0,side*.34,side*.12)
      .ball(.7,C.gold,side*6.4,13.1,0,.06,1.35,1.35,1)
      .box(.085,1.20,.14,'#21687d',side*6.46,13.1,0,Math.PI/4);
    envelope.box(.13,2.6,3.1,'#216f8d',0,14.0,6.1,-.24)
      .box(.15,.18,2.8,C.gold,0,15.27,6.25,-.24);
    balloon.add(envelope.mesh());
    g.add(balloon);
    // Keep the coach and balloon independently addressable for banking/bobbing.
    // Four small thruster lamps communicate motion without adding a particle system.
    const thrusters = [];
    for (const x of [-1.7, 1.7]) {
      const lamp = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 0.24, 8), new T.MeshBasicMaterial({ color: "#8df6ff" }));
      lamp.rotation.x = Math.PI / 2; lamp.position.set(x, -0.72, 4.95); g.add(lamp); thrusters.push(lamp);
    }
    g.userData.balloon = balloon;
    g.userData.body = g.children[0];
    g.userData.thrusters = thrusters;
    g.userData.turbines = turbines;
    g.userData.cabinPanes = cabinPanes;
    g.userData.navLights = navLights;
    g.userData.headlights = headlights;
    g.userData.energyCore = energyCore;
    g.userData.interior = interior;
    g.userData.baseY = 0;
    // Physical carrier size is now 2.7x, not a camera illusion. All public
    // moving subgroups retain their local pivots and the simulation still owns
    // the root.  The camera grows only ~1.2x, making the coach much more present
    // without cropping the balloon on portrait screens.
    g.scale.setScalar(2.7);
    g.userData.modelVersion = '1.4.0';
    g.userData.cameraTarget = [0, 26, 0];
    g.userData.cameraRadius = 83;
    g.userData.cameraRadiusPortrait = 103;
    // Keep immediate geometry inspection (thumbnail/tests) consistent with the
    // enlarged authored scale before the first renderer traversal.
    g.updateMatrixWorld(true);
    return g;
  }
  root.AZArt = {
    Model,
    C,
    material,
    buildMaterials,
    rng,
    avatar,
    weapon,
    objectModel,
    house,
    buildModel,
    vehicleModel,
    launchTerrace,
    aircraft,
    cosmetic,
  };
})(window);
