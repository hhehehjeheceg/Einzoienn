/* AZUR v92 — ch1-chars-v92.js : nouveaux personnages "Chapitre 1" (design/azur-reference-spec.md §7).
 *
 * Tous les anciens modèles (têtes peintes, contours noirs) sont remplacés par des personnages neufs,
 * modelés ici en volumes lisses : proportions de héros (épaules larges, grandes mains, tête réaliste
 * stylisée), matériaux propres sans contour. Le soldat par défaut des vidéos (débardeur, gilet
 * tactique, pantalon cargo, genouillères, rangers) habille le joueur par défaut et les bots, en
 * plusieurs teintes de peau / coiffures ; les 26 tenues du catalogue deviennent de nouveaux
 * personnages originaux (commandos, mascotte en peluche, dino, chevalier, astronaute, agent…).
 *
 * Technique : on garde le squelette existant (limbs = [hancheG, épauleG, hancheD, épauleD], knees,
 * elbows, torso, head, pelvis, gun, tool, glider…) pour que toutes les animations, la visée, la
 * pioche et le planeur continuent de marcher ; on masque les anciens maillages et on accroche à
 * chaque os UN maillage fusionné à couleurs de sommets (≈ 11 appels de dessin par personnage).
 * Les identifiants du catalogue sont conservés (sauvegardes, passe, bots) : seuls leur nom, leur
 * description, leurs couleurs et leur modèle changent. */
(function (root) {
  "use strict";
  const T = root.THREE, A = root.AZArt, M = root.AZMeta;
  if (!T || !A || typeof A.avatar !== "function" || A.__ch1Chars) return;
  A.__ch1Chars = true;

  /* ================================================================== palettes */
  const SKIN = {
    light: "#f2c6a0", fair: "#e9b48c", tan: "#d39a6c", olive: "#b97d50", brown: "#8d5a3b", dark: "#5e3a26",
  };
  const HAIR = { black: "#1d1a19", brown: "#4a2f1f", chestnut: "#6b3f22", red: "#a6421f", blond: "#d6a54f", grey: "#9a958f", white: "#e8e4dc" };

  /* Le soldat par défaut (silhouette des vidéos), décliné pour les bots. */
  const RECRUITS = [
    { body: "m", skin: SKIN.tan, hair: "short", hairC: HAIR.brown, beard: false },
    { body: "f", skin: SKIN.fair, hair: "bun", hairC: HAIR.red },
    { body: "m", skin: SKIN.dark, hair: "buzz", hairC: HAIR.black },
    { body: "m", skin: SKIN.light, hair: "short", hairC: HAIR.blond },
    { body: "f", skin: SKIN.brown, hair: "pony", hairC: HAIR.black },
    { body: "m", skin: SKIN.olive, hair: "short", hairC: HAIR.black, beard: true },
    { body: "f", skin: SKIN.light, hair: "pony", hairC: HAIR.chestnut },
    { body: "m", skin: SKIN.brown, hair: "mohawk", hairC: HAIR.black },
  ];
  const RECRUIT_CLOTHES = { top: "#6f7a43", vest: "#3f4a2c", vestD: "#2f3820", pants: "#b59a68", pantsD: "#8f774d", boots: "#4a3527", sole: "#231a14", glove: "#2a2622", belt: "#5a4630", pad: "#3a3f2a" };

  /* Nouvelles tenues : chaque id existant reçoit un nouveau personnage. rarity : 1 peu commun, 2 rare, 3 épique, 4 légendaire. */
  const LOOKS = {
    "char-kai": { name: "Recrue, l'éclaireur", desc: "La tenue réglementaire de l'île. Prêt à sauter.", rarity: 1, kind: "recruit", recruit: 0 },
    "char-ambre": { name: "Recrue, la vigie", desc: "Chignon serré, gilet bouclé.", rarity: 1, kind: "recruit", recruit: 1 },
    "char-azur": { name: "Commando Kaki", desc: "Casquette vissée, barbe de trois jours.", rarity: 1, kind: "soldier", body: "m", skin: SKIN.olive, hair: "short", hairC: HAIR.black, beard: true, hat: "cap", clothes: { top: "#556b3a", vest: "#2e3b24", pants: "#6e6a4c", boots: "#3a2b20", hatC: "#3d4a2a" } },
    "char-sauge": { name: "Sergente Rouille", desc: "Béret rouge et gilet usé par le terrain.", rarity: 1, kind: "soldier", body: "f", skin: SKIN.fair, hair: "bun", hairC: HAIR.red, hat: "beret", clothes: { top: "#7d3b2c", vest: "#4b3a2a", pants: "#7a6a52", boots: "#3a2b20", hatC: "#b0352a" } },
    "char-nacre": { name: "Ourson Bleu", desc: "Mascotte en peluche, câlins non garantis.", rarity: 3, kind: "plush", fur: "#5aa6ff", fur2: "#e8f3ff", eyeC: "#16233d" },
    "char-cuivre": { name: "Dino Néon", desc: "Un costume de dinosaure qui brille dans la nuit.", rarity: 3, kind: "dino", fur: "#8a4dff", fur2: "#3ee0c4", eyeC: "#ffe94a" },
    "char-onyx": { name: "Ranger Nocturne", desc: "Cagoule, lunettes de vision, aucun bruit.", rarity: 2, kind: "soldier", body: "m", skin: SKIN.brown, hair: "buzz", hairC: HAIR.black, hat: "balaclava", goggles: true, clothes: { top: "#22282e", vest: "#151a1f", pants: "#2a3138", boots: "#121518", hatC: "#1a1e22", lens: "#53ff9a" } },
    "char-faille": { name: "Agent Ombre", desc: "Combinaison furtive à liserés cyan.", rarity: 4, kind: "suit", body: "f", skin: SKIN.light, hair: "pony", hairC: HAIR.black, suit: "#151a2e", line: "#2ee6ff", trim: "#2b3352" },
    "char-midas": { name: "Héros Doré", desc: "Tout ce qu'il touche brille. Vraiment tout.", rarity: 4, kind: "armor", body: "m", skin: SKIN.tan, hair: "short", hairC: HAIR.blond, plate: "#e7b53b", plate2: "#b9862a", under: "#2b2418", helm: false },
    "char-corail": { name: "Masque Rouge", desc: "Capuche, bandana et poings bandés.", rarity: 2, kind: "street", body: "m", skin: SKIN.tan, hair: "short", hairC: HAIR.black, hoodie: "#c3322b", hoodie2: "#7b1f1b", pants: "#2c2f36", boots: "#e8e6e1", mask: "#1b1b1f" },
    "char-brume": { name: "Fermière Hayday", desc: "Salopette, chapeau de paille et bonne humeur.", rarity: 1, kind: "farmer", body: "f", skin: SKIN.fair, hair: "pony", hairC: HAIR.blond, overall: "#3b6db5", shirt: "#d9443a", hatC: "#e8c26a" },
    "char-iroise": { name: "Explorateur Brousse", desc: "Chapeau de safari et chemise aux mille poches.", rarity: 2, kind: "explorer", body: "m", skin: SKIN.light, hair: "short", hairC: HAIR.chestnut, beard: true, shirt: "#c9b27b", shirt2: "#a68f5a", pants: "#6b5a3e", hatC: "#d8c08a" },
    "char-silex": { name: "Commando Sable", desc: "Foulard et lunettes pour les tempêtes de sable.", rarity: 1, kind: "soldier", body: "m", skin: SKIN.dark, hair: "buzz", hairC: HAIR.black, hat: "helmet", goggles: true, clothes: { top: "#a8875a", vest: "#7a6340", pants: "#c2a676", boots: "#5a4330", hatC: "#9c8257", lens: "#ffb347" } },
    "char-lumen": { name: "Astro Pionnière", desc: "Combinaison spatiale et casque à bulle.", rarity: 3, kind: "astro", body: "f", skin: SKIN.olive, hair: "bun", hairC: HAIR.black, suit: "#eef1f5", trim: "#ff7a1a", visor: "#7fd0ff" },
    "char-mistral": { name: "Rave Arc-en-ciel", desc: "Néons, paillettes et cheveux en pétard.", rarity: 3, kind: "raver", body: "m", skin: SKIN.fair, hair: "spikes", hairC: "#ff3fb4", top: "#1a1a24", pants: "#2a2a38", boots: "#ffffff" },
    "char-argile": { name: "Bâtisseuse Casque-Jaune", desc: "Casque de chantier, gilet fluo, prête à construire.", rarity: 1, kind: "soldier", body: "f", skin: SKIN.brown, hair: "pony", hairC: HAIR.black, hat: "hardhat", clothes: { top: "#4a5866", vest: "#ff8a1f", pants: "#3a4b6a", boots: "#4a3527", hatC: "#ffd42a" } },
    "char-aster": { name: "Chevalier d'Azur", desc: "Armure polie, panache bleu, honneur intact.", rarity: 4, kind: "armor", body: "m", skin: SKIN.light, hair: "short", hairC: HAIR.brown, plate: "#c9d2dc", plate2: "#8b97a6", under: "#24426e", helm: true, plume: "#2f7cff" },
    "char-ecume": { name: "Sauveteuse Récif", desc: "Combinaison de plongée et bonnet rouge.", rarity: 2, kind: "soldier", body: "f", skin: SKIN.tan, hair: "pony", hairC: HAIR.brown, hat: "beanie", clothes: { top: "#1f2a38", vest: "#d8352a", pants: "#1f2a38", boots: "#222831", hatC: "#d8352a" } },
    "char-lichen": { name: "Squelette Fêtard", desc: "Un costume d'os qui ne quitte jamais la piste.", rarity: 3, kind: "skeleton", suit: "#141418", bone: "#f1ede2" },
    "char-sentinelle": { name: "Sentinelle d'Acier", desc: "Armure tactique lourde et visière opaque.", rarity: 4, kind: "armor", body: "m", skin: SKIN.dark, hair: "buzz", hairC: HAIR.black, plate: "#5f6b78", plate2: "#3a434d", under: "#1f2329", helm: true, visorC: "#ff4d2e" },
    "char-eclipse": { name: "Éclipse, ninja du vide", desc: "Masque, foulard violet et lames dans le dos.", rarity: 4, kind: "street", body: "f", skin: SKIN.light, hair: "pony", hairC: HAIR.white, hoodie: "#2a1d4a", hoodie2: "#7a4dff", pants: "#1a1530", boots: "#1a1530", mask: "#7a4dff" },
    "char-aurore": { name: "Aurore, chevalière solaire", desc: "Armure blanche et or, plume de feu.", rarity: 4, kind: "armor", body: "f", skin: SKIN.fair, hair: "bun", hairC: HAIR.blond, plate: "#f4f1e8", plate2: "#e0b23f", under: "#7a2e1f", helm: false, plume: "#ff6a2a" },
    "char-recif": { name: "Requin Malin", desc: "Un costume de requin avec des dents de feutre.", rarity: 3, kind: "dino", fur: "#5b7d99", fur2: "#eef3f6", eyeC: "#151515", shark: true },
    "char-lyra": { name: "Lyra, pilote d'élite", desc: "Combinaison de vol et casque à visière.", rarity: 4, kind: "suit", body: "f", skin: SKIN.tan, hair: "bun", hairC: HAIR.chestnut, suit: "#e6e9ef", line: "#ff4d7a", trim: "#2b3352", helmet: true },
    "char-kai-nuit": { name: "Recrue « Nuit »", desc: "La tenue réglementaire, version opérations de nuit.", rarity: 2, kind: "recruit", recruit: 2, clothes: { top: "#2c3138", vest: "#1a1e23", vestD: "#121519", pants: "#3a4049", pantsD: "#2b3038", boots: "#15181b", pad: "#22262b" } },
    "char-lyra-corail": { name: "Ourson Corail", desc: "La mascotte en peluche, édition corail.", rarity: 3, kind: "plush", fur: "#ff7a6b", fur2: "#fff1e6", eyeC: "#2a1414" },
  };

  /* ================================================================== matériaux */
  const MAT = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0.04 });
  const GLOW = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, emissive: new T.Color("#ffffff"), emissiveIntensity: 0.9 });
  const GLASS = new T.MeshStandardMaterial({ color: "#9fdcff", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.38, depthWrite: false });
  const METAL = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.65 });
  [MAT, GLOW, GLASS, METAL].forEach((m) => {
    m.userData.azRigid = true;
    m.userData.ch1 = true;
  });
  GLOW.emissive.set("#000000");
  GLOW.onBeforeCompile = (sh) => {
    // l'émission reprend la couleur de sommet : un seul matériau pour tous les liserés lumineux
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n totalEmissiveRadiance = vColor.rgb * 0.95;",
    );
  };

  /* ================================================================== géométrie */
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
  function mtx(x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    _p.set(x || 0, y || 0, z || 0);
    _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
    return new T.Matrix4().compose(_p, _q, _s);
  }
  const BASE = {};
  function base(key, make) {
    return BASE[key] || (BASE[key] = make());
  }
  /** Un « Lot » fusionne plusieurs primitives (position, normale, couleur) en une seule géométrie. */
  class Lot {
    constructor(lo) {
      this.lo = lo;
      this.p = [];
      this.n = [];
      this.c = [];
    }
    add(geo, color, m) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (m) g.applyMatrix4(m);
      const pa = g.attributes.position.array, na = g.attributes.normal.array, col = new T.Color(color);
      for (let i = 0; i < pa.length; i += 3) {
        this.p.push(pa[i], pa[i + 1], pa[i + 2]);
        this.n.push(na[i], na[i + 1], na[i + 2]);
        this.c.push(col.r, col.g, col.b);
      }
      g.dispose();
      return this;
    }
    sphere(color, x, y, z, sx, sy, sz, rx, ry, rz) {
      const seg = this.lo ? [10, 8] : [20, 14];
      return this.add(base("s" + seg, () => new T.SphereGeometry(1, seg[0], seg[1])), color, mtx(x, y, z, rx, ry, rz, sx, sy, sz));
    }
    hemi(color, x, y, z, sx, sy, sz, rx, ry, rz, frac) {
      const seg = this.lo ? [10, 5] : [20, 9];
      const f = frac || 0.5;
      return this.add(base("h" + seg + f, () => new T.SphereGeometry(1, seg[0], seg[1], 0, Math.PI * 2, 0, Math.PI * f)), color, mtx(x, y, z, rx, ry, rz, sx, sy, sz));
    }
    cyl(color, x, y, z, rt, rb, h, rx, ry, rz, sz) {
      const seg = this.lo ? 8 : 16;
      const g = new T.CylinderGeometry(rt, rb, h, seg, 1, false);
      this.add(g, color, mtx(x, y, z, rx, ry, rz, 1, 1, sz == null ? 1 : sz));
      g.dispose();
      return this;
    }
    box(color, x, y, z, w, h, d, rx, ry, rz) {
      return this.add(base("b", () => new T.BoxGeometry(1, 1, 1)), color, mtx(x, y, z, rx, ry, rz, w, h, d));
    }
    /** Boîte aux arêtes arrondies (sphère très aplatie = coussin) pour poches, semelles, plaques. */
    pad(color, x, y, z, w, h, d, rx, ry, rz) {
      const seg = this.lo ? [8, 6] : [14, 10];
      const g = base("pad" + seg, () => {
        const s = new T.SphereGeometry(1, seg[0], seg[1]);
        const a = s.attributes.position;
        for (let i = 0; i < a.count; i++) {
          // super-ellipsoïde : aplatit la sphère vers une boîte douce
          const k = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.45);
          a.setXYZ(i, k(a.getX(i)), k(a.getY(i)), k(a.getZ(i)));
        }
        s.computeVertexNormals();
        return s;
      });
      return this.add(g, color, mtx(x, y, z, rx, ry, rz, w / 2, h / 2, d / 2));
    }
    torus(color, x, y, z, r, tube, rx, ry, rz, sx, sz) {
      const g = base("t" + (this.lo ? 1 : 0) + r + "|" + tube, () => new T.TorusGeometry(r, tube, this.lo ? 6 : 10, this.lo ? 14 : 28));
      return this.add(g, color, mtx(x, y, z, rx == null ? Math.PI / 2 : rx, ry, rz, sx == null ? 1 : sx, sz == null ? 1 : sz, 1)); // échelle locale avant rotation : y local → profondeur
    }
    /** Volume de révolution à section elliptique (torse, bassin) : prof = [[y, demi-largeur], …]. */
    lathe(color, prof, depth, zOff, colorAt) {
      const seg = this.lo ? 12 : 26;
      const pts = prof.map(([y, r]) => new T.Vector2(Math.max(0.001, r), y));
      const g = new T.LatheGeometry(pts, seg);
      g.scale(1, 1, depth);
      if (zOff) g.translate(0, 0, zOff);
      g.computeVertexNormals(); // normales lissées (géométrie indexée) avant de dé-indexer
      if (colorAt) {
        // couleur variable selon la hauteur / la face (débardeur + peau, gilet…)
        const ng = g.toNonIndexed();
        const pa = ng.attributes.position.array, na = ng.attributes.normal.array, c = new T.Color();
        for (let i = 0; i < pa.length; i += 9) {
          const cx = (pa[i] + pa[i + 3] + pa[i + 6]) / 3, cy = (pa[i + 1] + pa[i + 4] + pa[i + 7]) / 3, cz = (pa[i + 2] + pa[i + 5] + pa[i + 8]) / 3;
          c.set(colorAt(cx, cy, cz) || color);
          for (let v = 0; v < 3; v++) {
            this.p.push(pa[i + v * 3], pa[i + v * 3 + 1], pa[i + v * 3 + 2]);
            this.n.push(na[i + v * 3], na[i + v * 3 + 1], na[i + v * 3 + 2]);
            this.c.push(c.r, c.g, c.b);
          }
        }
        g.dispose();
        ng.dispose();
        return this;
      }
      this.add(g, color);
      g.dispose();
      return this;
    }
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      g.computeBoundingSphere();
      return this.p.length ? g : null;
    }
  }

  const shade = (hex, k) => {
    const c = new T.Color(hex);
    if (k < 0) c.lerp(new T.Color("#000000"), -k);
    else c.lerp(new T.Color("#ffffff"), k);
    return "#" + c.getHexString();
  };

  /* ================================================================== résolution d'une tenue */
  function resolve(id, eq) {
    let L = LOOKS[id];
    if (!L) L = LOOKS["char-kai"];
    if (L.kind === "recruit") {
      let r = RECRUITS[L.recruit || 0];
      if (eq && eq.__ch1Variant != null) r = RECRUITS[eq.__ch1Variant % RECRUITS.length];
      return Object.assign({ kind: "recruit" }, r, { clothes: Object.assign({}, RECRUIT_CLOTHES, L.clothes || {}), id: id + (eq && eq.__ch1Variant != null ? "#" + eq.__ch1Variant : "") });
    }
    return Object.assign({ id }, L, { clothes: Object.assign({}, RECRUIT_CLOTHES, L.clothes || {}) });
  }

  /* ================================================================== modélisation par os */
  // Repères du squelette (unités du modèle, avant l'échelle 1.22 du personnage) :
  // hanches y 0.94 (x ±0.132), genoux -0.42 sous la hanche, épaules y 1.45 (x ±0.255), coudes -0.32,
  // tête centrée y 1.74 (os de la tête), avant = -Z.
  function isF(L) {
    return L.body === "f";
  }

  function headLot(L, lo) {
    const G = new Lot(lo), Gg = new Lot(lo);
    const f = isF(L), sk = L.skin || SKIN.tan, hc = L.hairC || HAIR.brown;
    const costumeHead = L.kind === "plush" || L.kind === "dino" || L.kind === "skeleton";
    if (L.kind === "plush") {
      // tête de mascotte : grosse boule, oreilles, museau, yeux brillants
      G.sphere(L.fur, 0, 0.03, 0, 0.19, 0.18, 0.18);
      G.sphere(L.fur, -0.13, 0.17, 0.02, 0.055, 0.055, 0.035);
      G.sphere(L.fur, 0.13, 0.17, 0.02, 0.055, 0.055, 0.035);
      G.sphere(L.fur2, -0.13, 0.17, -0.005, 0.034, 0.034, 0.02);
      G.sphere(L.fur2, 0.13, 0.17, -0.005, 0.034, 0.034, 0.02);
      G.sphere(L.fur2, 0, -0.04, -0.15, 0.085, 0.065, 0.06);
      G.sphere("#2a1d1d", 0, -0.01, -0.205, 0.024, 0.018, 0.014);
      G.sphere(L.eyeC, -0.065, 0.06, -0.155, 0.028, 0.034, 0.016);
      G.sphere(L.eyeC, 0.065, 0.06, -0.155, 0.028, 0.034, 0.016);
      G.sphere("#ffffff", -0.058, 0.07, -0.168, 0.008, 0.009, 0.004);
      G.sphere("#ffffff", 0.072, 0.07, -0.168, 0.008, 0.009, 0.004);
      G.box("#3a2424", 0, -0.085, -0.19, 0.05, 0.008, 0.01);
      return { main: G.geometry() };
    }
    if (L.kind === "dino") {
      // capuche de dino / requin : la tête du costume coiffe le joueur, le visage apparaît sous la mâchoire
      G.sphere(L.fur, 0, 0.075, 0.03, 0.15, 0.13, 0.16);
      G.sphere(L.fur, 0, 0.1, -0.13, 0.12, 0.085, 0.16);
      G.sphere(L.fur2, 0, 0.055, -0.17, 0.105, 0.025, 0.13);
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * 0.3;
        G.add(base("cone", () => new T.ConeGeometry(1, 1, 8)), "#ffffff", mtx(Math.sin(a) * 0.1, 0.035, -0.17 - Math.cos(a) * 0.1, Math.PI, 0, 0, 0.012, 0.03, 0.012));
      }
      for (const s2 of [-1, 1]) {
        G.sphere("#ffffff", s2 * 0.075, 0.19, -0.1, 0.034, 0.036, 0.03);
        G.sphere(L.eyeC, s2 * 0.078, 0.195, -0.128, 0.016, 0.018, 0.01);
        G.sphere(shade(L.fur, -0.2), s2 * 0.035, 0.13, -0.285, 0.012, 0.008, 0.01);
      }
      if (L.shark) G.box(L.fur, 0, 0.26, 0.05, 0.016, 0.14, 0.11, -0.55, 0, 0);
      else for (let i = 0; i < 4; i++) G.sphere(L.fur2, 0, 0.2 - i * 0.03, 0.06 + i * 0.05, 0.016, 0.04, 0.03);
      // visage du joueur sous la gueule
      G.sphere(SKIN.fair, 0, -0.045, -0.035, 0.084, 0.085, 0.072);
      for (const s2 of [-1, 1]) {
        G.sphere("#f7f4ef", s2 * 0.032, -0.025, -0.096, 0.016, 0.011, 0.009);
        G.sphere("#20140f", s2 * 0.032, -0.025, -0.103, 0.008, 0.009, 0.006);
      }
      G.box("#a0574a", 0, -0.08, -0.098, 0.03, 0.006, 0.006);
      G.torus(L.fur, 0, -0.06, -0.01, 0.1, 0.03, Math.PI / 2 + 0.25, 0, 0, 1.0, 1.0);
      return { main: G.geometry() };
    }
    if (L.kind === "skeleton") {
      G.sphere(L.bone, 0, 0.02, 0, 0.105, 0.125, 0.11);
      G.sphere(L.bone, 0, -0.07, -0.01, 0.078, 0.06, 0.08);
      G.sphere("#0c0c10", -0.04, 0.015, -0.088, 0.026, 0.03, 0.02);
      G.sphere("#0c0c10", 0.04, 0.015, -0.088, 0.026, 0.03, 0.02);
      G.sphere("#0c0c10", 0, -0.035, -0.1, 0.012, 0.016, 0.01);
      for (let i = 0; i < 6; i++) G.box("#0c0c10", -0.04 + i * 0.016, -0.085, -0.084, 0.004, 0.02, 0.01);
      G.sphere(L.suit, 0, 0.06, 0.02, 0.118, 0.12, 0.12);
      return { main: G.geometry() };
    }
    // ---- visage humain stylisé
    const jw = f ? 0.9 : 1;
    G.sphere(sk, 0, 0.015, 0, 0.1 * jw, 0.12, 0.106);
    G.sphere(sk, 0, -0.062, -0.012, 0.086 * jw, 0.072, 0.09);
    G.sphere(sk, 0, -0.098, -0.03, 0.05 * jw, 0.035, 0.05);
    G.sphere(shade(sk, -0.06), 0, -0.012, -0.111, 0.017, 0.026, 0.02, 0.15, 0, 0);
    G.sphere(sk, -0.1 * jw, -0.008, 0.008, 0.016, 0.03, 0.024);
    G.sphere(sk, 0.1 * jw, -0.008, 0.008, 0.016, 0.03, 0.024);
    // yeux
    for (const s of [-1, 1]) {
      G.sphere("#f7f4ef", s * 0.036, 0.018, -0.092, 0.019, 0.013, 0.012);
      G.sphere("#3a2a1e", s * 0.036, 0.018, -0.101, 0.009, 0.0105, 0.006);
      G.sphere("#0a0a0a", s * 0.036, 0.018, -0.104, 0.0045, 0.0055, 0.004);
      G.box(shade(hc, -0.15), s * 0.037, 0.046, -0.1, 0.038, 0.008, 0.012, 0, 0, s * (f ? 0.1 : 0.06));
      if (f) G.box("#1a1412", s * 0.04, 0.027, -0.1, 0.03, 0.004, 0.008, 0, 0, s * -0.1);
    }
    G.box(f ? "#b8564e" : shade(sk, -0.28), 0, -0.064, -0.101, f ? 0.034 : 0.036, f ? 0.009 : 0.006, 0.008);
    if (L.beard) {
      G.sphere(shade(hc, 0.05), 0, -0.088, -0.03, 0.082 * jw, 0.05, 0.078);
      G.sphere(shade(hc, 0.05), 0, -0.05, -0.088, 0.04, 0.012, 0.02);
    }
    // ---- cheveux
    const hs = L.hair || "short";
    const hatCovers = L.hat === "balaclava" || L.hat === "helmet" || L.hat === "hardhat" || L.helmet;
    if (!hatCovers) {
      if (hs === "short" || hs === "mohawk" || hs === "spikes") G.hemi(hc, 0, 0.03, 0.006, 0.107 * jw, 0.122, 0.113, 0.38, 0, 0, 0.5);
      if (hs === "short") G.sphere(hc, 0.012, 0.105, -0.07, 0.062, 0.032, 0.042, 0.35, 0, -0.2);
      if (hs === "buzz") G.hemi(hc, 0, 0.03, 0.004, 0.103 * jw, 0.118, 0.109, 0.35, 0, 0, 0.5);
      if (hs === "mohawk") for (let i = 0; i < 5; i++) G.sphere(hc, 0, 0.13 - i * 0.005, -0.06 + i * 0.04, 0.018, 0.045, 0.03);
      if (hs === "spikes") for (let i = 0; i < 7; i++) {
        const a = -1.2 + i * 0.4;
        G.add(base("cone", () => new T.ConeGeometry(1, 1, 8)), i % 2 ? hc : "#3fd7ff", mtx(Math.sin(a) * 0.06, 0.15, Math.cos(a) * 0.05 - 0.01, 0.4 * Math.cos(a), 0, -0.6 * Math.sin(a), 0.026, 0.09, 0.026));
      }
      if (hs === "bun" || hs === "pony") {
        G.hemi(hc, 0, 0.028, 0.006, 0.109 * jw, 0.126, 0.115, 0.32, 0, 0, 0.55);
        G.sphere(hc, -0.045, 0.085, -0.078, 0.055, 0.03, 0.035, 0.3, 0, 0.45);
      }
      if (hs === "bun") G.sphere(hc, 0, 0.115, 0.08, 0.05, 0.05, 0.05);
      if (hs === "pony") {
        G.sphere(hc, 0, 0.07, 0.11, 0.035, 0.04, 0.035);
        G.cyl(hc, 0, -0.03, 0.135, 0.028, 0.012, 0.18, 0.25, 0, 0);
      }
    }
    // ---- couvre-chefs
    const cl = L.clothes || {};
    const hatC = cl.hatC || L.hatC || "#444";
    switch (L.hat) {
      case "cap":
        G.hemi(hatC, 0, 0.04, 0.004, 0.112, 0.105, 0.118, -0.05, 0, 0, 0.5);
        G.pad(shade(hatC, -0.1), 0, 0.045, -0.13, 0.15, 0.012, 0.09, 0.12, 0, 0);
        G.sphere(shade(hatC, 0.2), 0, 0.15, 0.004, 0.012, 0.008, 0.012);
        break;
      case "beret":
        G.sphere(hatC, 0.025, 0.1, 0.01, 0.12, 0.035, 0.115, 0.05, 0, -0.18);
        break;
      case "beanie":
        G.hemi(hatC, 0, 0.03, 0.004, 0.113, 0.13, 0.118, -0.08, 0, 0, 0.52);
        G.torus(shade(hatC, -0.15), 0, 0.045, 0.004, 0.105, 0.014, Math.PI / 2 - 0.08, 0, 0, 1.06, 1.1);
        break;
      case "helmet":
        G.hemi(hatC, 0, 0.035, 0.004, 0.128, 0.13, 0.135, -0.06, 0, 0, 0.55);
        G.torus(shade(hatC, -0.12), 0, 0.03, 0.004, 0.122, 0.012, Math.PI / 2 - 0.06, 0, 0, 1.05, 1.1);
        break;
      case "hardhat":
        G.hemi(hatC, 0, 0.045, 0.004, 0.122, 0.12, 0.128, -0.05, 0, 0, 0.5);
        G.cyl(hatC, 0, 0.04, -0.012, 0.15, 0.15, 0.012, 0, 0, 0, 1.05);
        G.box(shade(hatC, -0.1), 0, 0.15, 0.004, 0.02, 0.03, 0.22);
        break;
      case "balaclava":
        G.sphere(hatC, 0, 0.02, 0.004, 0.108 * jw, 0.128, 0.114);
        G.sphere(hatC, 0, -0.065, -0.012, 0.09 * jw, 0.075, 0.094);
        break;
      default:
        break;
    }
    if (L.goggles) {
      const lens = cl.lens || "#7fd0ff";
      G.torus("#1d1d1d", 0, 0.03, 0.004, 0.112, 0.01, Math.PI / 2, 0, 0, 1.0, 1.06);
      for (const s of [-1, 1]) {
        G.cyl("#262626", s * 0.038, 0.022, -0.108, 0.026, 0.026, 0.026, Math.PI / 2, 0, 0);
        Gg.cyl(lens, s * 0.038, 0.022, -0.123, 0.021, 0.021, 0.006, Math.PI / 2, 0, 0);
      }
    }
    if (L.kind === "street") {
      // capuche + bandana
      G.hemi(L.hoodie, 0, 0.03, 0.02, 0.125, 0.14, 0.13, -0.25, 0, 0, 0.62);
      G.sphere(L.mask, 0, -0.07, -0.03, 0.09 * jw, 0.06, 0.088);
    }
    if (L.kind === "armor" && L.helm) {
      G.sphere(L.plate, 0, 0.02, 0, 0.122, 0.142, 0.128);
      G.box(L.visorC || "#101318", 0, 0.012, -0.118, 0.13, 0.024, 0.03);
      G.box(L.plate2, 0, -0.05, -0.122, 0.02, 0.07, 0.02);
      if (L.plume) for (let i = 0; i < 6; i++) G.sphere(L.plume, 0, 0.15 + Math.sin(i * 0.5) * 0.02, -0.05 + i * 0.035, 0.022, 0.03, 0.03);
    }
    if (L.kind === "armor" && !L.helm && L.plume) {
      G.torus(L.plate2, 0, 0.07, 0.004, 0.1, 0.012, Math.PI / 2 - 0.15, 0, 0, 1.0, 1.1);
    }
    if (L.kind === "farmer") {
      G.cyl(L.hatC, 0, 0.075, 0.004, 0.23, 0.23, 0.012);
      G.cyl(L.hatC, 0, 0.12, 0.004, 0.09, 0.105, 0.09);
      G.torus("#c0392b", 0, 0.088, 0.004, 0.1, 0.012);
    }
    if (L.kind === "explorer") {
      G.cyl(L.hatC, 0, 0.07, 0.004, 0.2, 0.2, 0.01);
      G.hemi(L.hatC, 0, 0.07, 0.004, 0.11, 0.1, 0.116, 0, 0, 0, 0.5);
      G.torus(shade(L.hatC, -0.35), 0, 0.085, 0.004, 0.106, 0.012);
    }
    if (L.kind === "astro") {
      Gg.sphere(L.trim, 0, -0.13, 0, 0.13, 0.03, 0.13);
      G.torus(L.trim, 0, -0.12, 0, 0.13, 0.018);
    }
    if (L.kind === "suit" && L.helmet) {
      G.sphere(L.suit, 0, 0.025, 0.004, 0.124, 0.142, 0.128);
      Gg.box(L.line, 0, 0.015, -0.118, 0.15, 0.05, 0.03);
    }
    if (L.kind === "raver") {
      Gg.box("#ff3fb4", 0, 0.018, -0.112, 0.13, 0.03, 0.01);
    }
    return { main: G.geometry(), glow: Gg.geometry(), glass: L.kind === "astro" };
  }

  /** Torse (os du torse = repère de la racine). */
  function torsoLot(L, lo, back) {
    const G = new Lot(lo), Gg = new Lot(lo), Gm = new Lot(lo);
    const f = isF(L), sk = L.skin || SKIN.tan, c = L.clothes || {};
    const w = f ? 0.9 : 1;
    const prof = [
      [1.0, 0.165 * w], [1.06, 0.165 * w], [1.14, 0.172 * w], [1.22, 0.188 * w], [1.3, 0.206 * w], [1.37, 0.218 * w],
      [1.42, 0.222 * w], [1.465, 0.214 * w], [1.5, 0.19 * w], [1.53, 0.14 * w], [1.55, 0.09], [1.56, 0.04],
    ];
    const plush = L.kind === "plush", dino = L.kind === "dino";
    if (plush || dino) {
      const profP = [[0.98, 0.2], [1.05, 0.23], [1.15, 0.25], [1.27, 0.25], [1.38, 0.235], [1.46, 0.21], [1.52, 0.16], [1.56, 0.09], [1.58, 0.03]];
      G.lathe(L.fur, profP, 0.86, 0.01);
      G.sphere(L.fur2, 0, 1.2, -0.17, 0.14, 0.17, 0.06); // ventre ovale
      if (dino && !L.shark) for (let i = 0; i < 4; i++) G.box(L.fur2, 0, 1.48 - i * 0.12, 0.2, 0.02, 0.07, 0.06, -0.3, 0, 0);
      if (L.shark) G.box(L.fur, 0, 1.36, 0.24, 0.02, 0.16, 0.12, -0.6, 0, 0);
      G.cyl(L.fur, 0, 1.6, 0, 0.07, 0.08, 0.1);
      return { main: G.geometry() };
    }
    let colorAt = null;
    const neck = () => G.cyl(sk, 0, 1.6, 0.004, 0.052, 0.058, 0.14);
    switch (L.kind) {
      case "recruit":
      case "soldier": {
        // débardeur : peau sur les épaules et le haut de la poitrine, tissu ailleurs
        colorAt = (x, y) => (y > 1.505 ? sk : c.top); // encolure du débardeur
        G.lathe(c.top, prof, 0.66, 0.0, colorAt);
        neck();
        // gilet tactique
        const vp = prof.filter((p) => p[0] >= 1.06 && p[0] <= 1.44).map(([y, r]) => [y, r + 0.018]);
        G.lathe(c.vest, vp, 0.7, -0.002, (x, y, z) => (z > 0.02 && Math.abs(x) < 0.05 ? shade(c.vest, -0.08) : c.vest));
        for (const s of [-1, 1]) {
          G.pad(c.vest, s * 0.1, 1.475, 0.0, 0.05, 0.07, 0.27, 0, 0, s * 0.18);
          G.pad(c.vestD || shade(c.vest, -0.12), s * 0.085, 1.15, -0.165, 0.07, 0.09, 0.05);
          G.pad(c.vestD || shade(c.vest, -0.12), s * 0.16, 1.2, -0.12, 0.05, 0.08, 0.05, 0, s * 0.5, 0);
          G.box(shade(c.vest, 0.15), s * 0.085, 1.198, -0.188, 0.06, 0.012, 0.012);
        }
        G.pad(c.vestD || shade(c.vest, -0.12), 0, 1.3, -0.172, 0.09, 0.07, 0.04);
        G.box("#c9b27a", -0.06, 1.36, -0.17, 0.05, 0.03, 0.01);
        break;
      }
      case "farmer": {
        colorAt = (x, y, z) => (y > 1.25 && (z < -0.02 || z > 0.02) && Math.abs(x) < 0.09 ? L.overall : L.shirt);
        G.lathe(L.shirt, prof, 0.66, 0, (x, y, z) => (y < 1.26 ? L.overall : y < 1.4 && Math.abs(x) < 0.1 ? L.overall : L.shirt));
        neck();
        for (const s of [-1, 1]) G.box(L.overall, s * 0.08, 1.42, 0, 0.035, 0.14, 0.27, 0, 0, s * 0.08);
        G.pad(shade(L.overall, -0.1), 0, 1.25, -0.15, 0.12, 0.09, 0.03);
        for (const s of [-1, 1]) G.sphere("#e6c35c", s * 0.07, 1.36, -0.155, 0.012, 0.012, 0.008);
        break;
      }
      case "explorer": {
        G.lathe(L.shirt, prof, 0.67, 0, (x, y, z) => (z < -0.12 && Math.abs(x) < 0.012 ? shade(L.shirt, -0.2) : L.shirt));
        neck();
        for (const s of [-1, 1]) {
          G.pad(L.shirt2, s * 0.09, 1.34, -0.152, 0.075, 0.07, 0.03);
          G.box(shade(L.shirt2, -0.2), s * 0.09, 1.372, -0.168, 0.075, 0.015, 0.01);
        }
        G.box("#5b3b24", 0.02, 1.27, 0, 0.03, 0.62, 0.3, 0, 0, -0.7);
        G.torus("#d8c08a", 0, 1.52, -0.02, 0.07, 0.02, Math.PI / 2 - 0.4);
        break;
      }
      case "street": {
        G.lathe(L.hoodie, prof.map(([y, r]) => [y, r + 0.012]), 0.7, 0, (x, y, z) => (z < -0.1 && y < 1.2 && Math.abs(x) < 0.12 ? L.hoodie2 : L.hoodie));
        neck();
        G.pad(L.hoodie2, 0, 1.13, -0.165, 0.2, 0.09, 0.04);
        G.torus(L.hoodie2, 0, 1.53, 0.03, 0.09, 0.03, Math.PI / 2 - 0.3, 0, 0, 1.05, 1.1);
        for (const s of [-1, 1]) G.cyl("#e8e6e1", s * 0.04, 1.36, -0.16, 0.004, 0.004, 0.16);
        break;
      }
      case "suit":
      case "astro": {
        const sc = L.suit;
        G.lathe(sc, prof, 0.67, 0);
        G.cyl(sc, 0, 1.6, 0.004, 0.056, 0.06, 0.14);
        Gg.box(L.line || L.trim, 0, 1.25, -0.152, 0.012, 0.42, 0.012);
        for (const s of [-1, 1]) {
          Gg.box(L.line || L.trim, s * 0.13, 1.3, -0.11, 0.01, 0.3, 0.012, 0, s * -0.6, s * 0.15);
          Gg.box(L.line || L.trim, s * 0.15, 1.05, 0, 0.012, 0.012, 0.25, 0, 0, 0);
        }
        if (L.kind === "astro") {
          G.pad(L.trim, 0, 1.28, -0.155, 0.13, 0.09, 0.04);
          Gg.box("#3cff8f", -0.03, 1.29, -0.178, 0.02, 0.02, 0.005);
          Gg.box("#ff3c3c", 0.03, 1.29, -0.178, 0.02, 0.02, 0.005);
          G.pad("#d8dde5", 0, 1.3, 0.19, 0.3, 0.38, 0.16);
          G.cyl(L.trim, -0.08, 1.3, 0.28, 0.035, 0.035, 0.3);
          G.cyl(L.trim, 0.08, 1.3, 0.28, 0.035, 0.035, 0.3);
        }
        break;
      }
      case "armor": {
        G.lathe(L.under, prof, 0.66, 0);
        neck();
        const cp = prof.filter((p) => p[0] >= 1.1 && p[0] <= 1.47).map(([y, r]) => [y, r + 0.03]);
        Gm.lathe(L.plate, cp, 0.74, -0.01, (x, y, z) => (Math.abs(y - 1.3) < 0.012 || (z < -0.15 && Math.abs(x) < 0.01) ? L.plate2 : L.plate));
        Gm.torus(L.plate2, 0, 1.08, 0, 0.18, 0.025, Math.PI / 2, 0, 0, 1.0, 0.72);
        Gm.sphere(L.plate2, 0, 1.33, -0.21, 0.04, 0.04, 0.012);
        break;
      }
      case "raver": {
        const stripes = ["#ff3fb4", "#ffb32c", "#fff23a", "#3dff8a", "#2ee6ff", "#9a5cff"];
        G.lathe(L.top, prof, 0.66, 0, (x, y, z) => (z < 0 ? stripes[Math.max(0, Math.min(5, Math.floor((1.45 - y) / 0.075)))] : L.top));
        neck();
        Gg.torus("#2ee6ff", 0, 1.56, 0, 0.065, 0.008);
        break;
      }
      case "skeleton": {
        G.lathe(L.suit, prof, 0.66, 0);
        G.cyl(L.suit, 0, 1.6, 0.004, 0.052, 0.058, 0.14);
        for (let i = 0; i < 5; i++) {
          const y = 1.4 - i * 0.065, r = 0.17 - i * 0.008;
          for (const s of [-1, 1]) G.box(L.bone, s * r * 0.55, y, -0.13 + i * 0.004, r * 0.75, 0.022, 0.02, 0, s * 0.35, s * -0.15);
        }
        G.box(L.bone, 0, 1.24, -0.145, 0.03, 0.36, 0.02);
        G.sphere(L.bone, 0, 1.06, -0.12, 0.08, 0.04, 0.03);
        break;
      }
      default:
        G.lathe(c.top || "#777", prof, 0.66, 0);
        neck();
    }
    // sac à dos cosmétique
    if (back && L.kind !== "astro") {
      const c1 = back.color || "#b5874f", c2 = back.secondary || "#5b3a24";
      G.pad(c1, 0, 1.26, 0.185, 0.27, 0.34, 0.15);
      G.pad(c2, 0, 1.4, 0.2, 0.25, 0.08, 0.15);
      G.pad(shade(c1, -0.12), 0, 1.16, 0.27, 0.18, 0.12, 0.05);
      G.cyl(c2, 0, 1.47, 0.18, 0.045, 0.045, 0.3, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) G.box(c2, s * 0.1, 1.34, 0.11, 0.03, 0.34, 0.02);
    }
    return { main: G.geometry(), glow: Gg.geometry(), metal: Gm.geometry() };
  }

  function pelvisLot(L, lo) {
    const G = new Lot(lo), Gm = new Lot(lo);
    const f = isF(L), c = L.clothes || {};
    const pants = pantsColor(L);
    const prof = [[0.83, 0.05], [0.86, 0.13], [0.9, 0.168 * (f ? 1.03 : 1)], [0.96, 0.174], [1.02, 0.168], [1.06, 0.164]];
    if (L.kind === "plush" || L.kind === "dino") {
      G.lathe(L.fur, [[0.78, 0.08], [0.84, 0.18], [0.92, 0.215], [1.0, 0.22], [1.06, 0.21]], 0.86, 0.01);
      if (L.kind === "dino") {
        for (let i = 0; i < 6; i++) {
          const t = i / 5;
          G.sphere(i % 2 && !L.shark ? L.fur : L.fur, 0, 0.9 - t * 0.55, 0.18 + t * 0.42, 0.11 * (1 - t * 0.75), 0.1 * (1 - t * 0.7), 0.12);
        }
        if (L.shark) G.box(L.fur, 0, 0.42, 0.62, 0.015, 0.22, 0.14, 0.2, 0, 0);
      } else G.sphere(L.fur, 0, 0.9, 0.2, 0.05, 0.05, 0.05);
      return { main: G.geometry() };
    }
    G.lathe(pants, prof, 0.7, 0.0);
    if (L.kind === "armor") Gm.torus(L.plate2, 0, 1.03, 0, 0.172, 0.02, Math.PI / 2, 0, 0, 1, 0.72);
    else {
      G.torus(c.belt || "#4b3a2a", 0, 1.025, 0, 0.17, 0.016, Math.PI / 2, 0, 0, 1, 0.72);
      G.box("#c9b27a", 0, 1.025, -0.125, 0.04, 0.03, 0.012);
    }
    if (L.kind === "recruit" || L.kind === "soldier") {
      G.pad(c.vestD || shade(c.vest || "#444", -0.1), 0.15, 0.98, 0.05, 0.05, 0.08, 0.07, 0, 0.6, 0);
    }
    if (L.kind === "farmer") G.lathe(L.overall, prof, 0.72, 0);
    return { main: G.geometry(), metal: Gm.geometry() };
  }

  function pantsColor(L) {
    if (L.kind === "farmer") return L.overall;
    if (L.kind === "suit" || L.kind === "astro") return L.suit;
    if (L.kind === "armor") return L.under;
    if (L.kind === "skeleton") return L.suit;
    if (L.kind === "street" || L.kind === "raver" || L.kind === "explorer") return L.pants;
    return (L.clothes && L.clothes.pants) || "#777";
  }
  function bootColor(L) {
    if (L.kind === "street" || L.kind === "raver") return L.boots;
    if (L.kind === "suit") return L.trim || "#222";
    if (L.kind === "astro") return "#d8dde5";
    if (L.kind === "armor") return L.plate2;
    if (L.kind === "skeleton") return "#1d1d22";
    if (L.kind === "farmer") return "#6b4a2a";
    if (L.kind === "explorer") return "#5b3b24";
    return (L.clothes && L.clothes.boots) || "#3a2b20";
  }

  /** Bras : os de l'épaule (le coude est à -0.32). */
  function upperArmLot(L, lo, s) {
    const G = new Lot(lo), Gm = new Lot(lo), Gg = new Lot(lo);
    const f = isF(L), k = f ? 0.88 : 1, sk = L.skin || SKIN.tan;
    if (L.kind === "plush" || L.kind === "dino") {
      G.sphere(L.fur, 0, -0.02, 0, 0.085, 0.085, 0.085);
      G.cyl(L.fur, 0, -0.17, 0, 0.082, 0.07, 0.3);
      return { main: G.geometry() };
    }
    let col = sk, top = sk;
    if (L.kind === "farmer") col = top = L.shirt;
    if (L.kind === "explorer") col = top = L.shirt;
    if (L.kind === "street") col = top = L.hoodie;
    if (L.kind === "suit" || L.kind === "astro") col = top = L.suit;
    if (L.kind === "armor") col = top = L.under;
    if (L.kind === "skeleton") col = top = L.suit;
    if (L.kind === "raver") col = top = sk;
    G.sphere(top, 0, -0.02, 0, 0.086 * k, 0.088, 0.08 * k);
    G.cyl(col, 0, -0.16, 0, 0.074 * k, 0.06 * k, 0.29);
    G.sphere(col, 0, -0.13, -0.022, 0.06 * k, 0.09, 0.055 * k);
    if (L.kind === "recruit" || L.kind === "soldier") {
      // bretelle du débardeur visible sur l'épaule, brassard
      G.cyl(shade((L.clothes || {}).top || "#555", -0.05), 0, -0.2, 0, 0.058 * k, 0.058 * k, 0.025);
    }
    if (L.kind === "armor") {
      Gm.sphere(L.plate, s * 0.012, 0.0, 0, 0.1 * k, 0.07, 0.095 * k);
      Gm.sphere(L.plate2, s * 0.02, -0.04, 0, 0.098 * k, 0.025, 0.092 * k);
    }
    if (L.kind === "suit") Gg.box(L.line, s * 0.058 * k, -0.15, 0, 0.008, 0.26, 0.012);
    if (L.kind === "skeleton") G.box(L.bone, 0, -0.16, -0.05, 0.03, 0.26, 0.018);
    if (L.kind === "raver") Gg.torus("#3dff8a", 0, -0.22, 0, 0.058, 0.009);
    return { main: G.geometry(), metal: Gm.geometry(), glow: Gg.geometry() };
  }

  /** Avant-bras + main : os du coude (poignet ≈ -0.25). */
  function foreArmLot(L, lo, s) {
    const G = new Lot(lo), Gm = new Lot(lo), Gg = new Lot(lo);
    const f = isF(L), k = f ? 0.88 : 1, sk = L.skin || SKIN.tan;
    if (L.kind === "plush" || L.kind === "dino") {
      G.cyl(L.fur, 0, -0.12, 0, 0.068, 0.06, 0.24);
      G.sphere(L.fur2, 0, -0.29, -0.005, 0.06, 0.07, 0.055);
      return { main: G.geometry() };
    }
    let col = sk, hand = sk, glove = null;
    if (L.kind === "recruit" || L.kind === "soldier") glove = (L.clothes || {}).glove || "#2a2622";
    if (L.kind === "street") { col = L.hoodie; glove = "#e8e6e1"; }
    if (L.kind === "suit" || L.kind === "astro") { col = L.suit; hand = L.kind === "astro" ? L.trim : "#202434"; }
    if (L.kind === "armor") { col = L.under; hand = L.plate2; }
    if (L.kind === "skeleton") { col = L.suit; hand = L.bone; }
    if (L.kind === "farmer") col = L.shirt;
    G.sphere(col, 0, 0, 0, 0.06 * k, 0.06, 0.06 * k);
    G.cyl(col, 0, -0.12, 0, 0.064 * k, 0.047 * k, 0.24);
    G.sphere(col, 0, -0.07, -0.01, 0.062 * k, 0.08, 0.058 * k);
    if (glove) G.cyl(glove, 0, -0.235, 0, 0.049 * k, 0.049 * k, 0.05);
    if (L.kind === "explorer" || L.kind === "farmer") G.cyl(shade(col, -0.08), 0, -0.04, 0, 0.06 * k, 0.06 * k, 0.05);
    if (L.kind === "armor") Gm.cyl(L.plate, 0, -0.15, 0, 0.064 * k, 0.056 * k, 0.17);
    // main : paume, doigts recourbés, pouce
    const hc = glove && (L.kind === "street") ? glove : hand;
    G.pad(hc, 0, -0.305, -0.005, 0.066 * k, 0.1, 0.1 * k);
    G.pad(glove && L.kind !== "street" ? sk : hc, 0, -0.37, -0.012, 0.058 * k, 0.06, 0.094 * k, 0.28, 0, 0);
    G.sphere(hc, -s * 0.026, -0.29, -0.056, 0.02, 0.042, 0.02, 0.5, 0, s * 0.3);
    if (glove && L.kind !== "street") G.pad(glove, 0, -0.295, -0.005, 0.07 * k, 0.078, 0.104 * k);
    if (L.kind === "suit") Gg.box(L.line, 0, -0.12, -0.05 * k, 0.012, 0.2, 0.008);
    if (L.kind === "skeleton") G.box(L.bone, 0, -0.12, -0.045, 0.024, 0.2, 0.016);
    if (L.kind === "raver") Gg.torus("#ff3fb4", 0, -0.22, 0, 0.05, 0.009);
    return { main: G.geometry(), metal: Gm.geometry(), glow: Gg.geometry() };
  }

  /** Cuisse : os de la hanche (genou à -0.42). */
  function thighLot(L, lo, s) {
    const G = new Lot(lo), Gm = new Lot(lo), Gg = new Lot(lo);
    const f = isF(L);
    if (L.kind === "plush" || L.kind === "dino") {
      G.cyl(L.fur, 0, -0.2, 0, 0.11, 0.09, 0.42);
      return { main: G.geometry() };
    }
    const p = pantsColor(L);
    G.sphere(p, 0, -0.01, 0, 0.098 * (f ? 1.02 : 1), 0.1, 0.098);
    G.cyl(p, 0, -0.21, 0, 0.096 * (f ? 1.0 : 1), 0.074, 0.42);
    if (L.kind === "recruit" || L.kind === "soldier" || L.kind === "explorer") {
      const pc = (L.clothes && L.clothes.pantsD) || shade(p, -0.12);
      G.pad(pc, s * 0.085, -0.2, 0.0, 0.035, 0.12, 0.1);
      G.box(shade(pc, -0.1), s * 0.098, -0.15, 0.0, 0.012, 0.012, 0.1);
    }
    if (L.kind === "armor") Gm.sphere(L.plate, 0, -0.16, -0.05, 0.085, 0.13, 0.05);
    if (L.kind === "suit") Gg.box(L.line, s * 0.085, -0.2, 0, 0.01, 0.36, 0.012);
    if (L.kind === "skeleton") G.box(L.bone, 0, -0.2, -0.08, 0.035, 0.32, 0.02);
    if (L.kind === "raver") Gg.box("#fff23a", s * 0.088, -0.2, 0, 0.01, 0.36, 0.012);
    return { main: G.geometry(), metal: Gm.geometry(), glow: Gg.geometry() };
  }

  /** Jambe + chaussure : os du genou (le sol est à -0.52 quand la jambe est tendue). */
  function shinLot(L, lo, s) {
    const G = new Lot(lo), Gm = new Lot(lo), Gg = new Lot(lo);
    if (L.kind === "plush" || L.kind === "dino") {
      G.cyl(L.fur, 0, -0.2, 0, 0.09, 0.085, 0.4);
      G.sphere(L.fur2, 0, -0.47, -0.05, 0.085, 0.06, 0.13);
      return { main: G.geometry() };
    }
    const p = pantsColor(L), b = bootColor(L);
    G.sphere(p, 0, 0, 0, 0.075, 0.075, 0.075);
    G.cyl(p, 0, -0.17, 0, 0.074, 0.062, 0.32);
    if (L.kind === "recruit" || L.kind === "soldier") G.pad((L.clothes && L.clothes.pad) || "#3a3f2a", 0, -0.02, -0.06, 0.12, 0.13, 0.05);
    if (L.kind === "armor") Gm.pad(L.plate, 0, -0.18, -0.045, 0.11, 0.24, 0.05);
    if (L.kind === "suit") Gg.box(L.line, s * 0.068, -0.18, 0, 0.01, 0.3, 0.012);
    if (L.kind === "skeleton") G.box(L.bone, 0, -0.18, -0.066, 0.03, 0.28, 0.018);
    // chaussure : tige, empeigne, semelle, lacets
    const sole = L.kind === "raver" ? "#ff3fb4" : (L.clothes && L.clothes.sole) || "#231a14";
    G.cyl(b, 0, -0.38, 0, 0.068, 0.07, 0.13);
    G.pad(b, 0, -0.455, -0.05, 0.12, 0.09, 0.25);
    G.pad(sole, 0, -0.505, -0.05, 0.128, 0.03, 0.262);
    if (L.kind === "recruit" || L.kind === "soldier") for (let i = 0; i < 3; i++) G.box("#1a1410", 0, -0.39 + i * 0.03 - 0.03 * (i === 0 ? 0 : 0), -0.068, 0.05, 0.007, 0.008);
    return { main: G.geometry(), metal: Gm.geometry(), glow: Gg.geometry() };
  }

  /* ================================================================== cache + habillage */
  const GEO = {};
  function cached(key, fn) {
    return GEO[key] || (GEO[key] = fn());
  }
  function attach(parent, parts, tag) {
    if (!parts) return;
    const add = (geo, mat) => {
      if (!geo) return;
      const m = new T.Mesh(geo, mat);
      m.userData.ch1 = tag;
      m.userData.shared = true;
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
    };
    add(parts.main, MAT);
    add(parts.metal, METAL);
    add(parts.glow, GLOW);
  }
  function hideOld(node) {
    node.traverse((o) => {
      if (o.isMesh && !o.userData.ch1) o.visible = false;
    });
  }

  /* Les bots arrivent avec `bot` = leur numéro (view.js) : variante stable, présentation seulement. */
  const BOT_COSTUMES = ["char-azur", "char-sauge", "char-onyx", "char-silex", "char-corail", "char-argile", "char-nacre", "char-cuivre", "char-iroise", "char-brume", "char-ecume", "char-mistral"];

  function dress(avatar, eq, detail) {
    const u = avatar.userData;
    if (!u || !u.torso || !u.head || !u.limbs || !u.knees || !u.elbows) return avatar;
    const lo = detail === "low";
    const id = (eq && eq.character) || "char-kai";
    let e2 = eq, lookId = LOOKS[id] ? id : "char-kai";
    if (eq && eq.bot != null) {
      // bots : 4 sur 5 en recrue (8 variantes), 1 sur 5 avec un costume du catalogue
      const n = Math.abs(eq.bot | 0);
      if (n % 5 === 4) lookId = BOT_COSTUMES[Math.floor(n / 5) % BOT_COSTUMES.length];
      else {
        lookId = "char-kai";
        e2 = Object.assign({}, eq, { __ch1Variant: n % RECRUITS.length });
      }
    }
    const L = resolve(lookId, e2);
    const backId = eq && eq.back;
    let back = null;
    if (backId) {
      const bc = A.cosmetic ? A.cosmetic(backId, { color: "#b5874f", secondary: "#5b3a24" }) : null;
      back = { color: (bc && /^#[0-9a-f]{6}$/i.test(bc.color || "") && bc.color) || "#b5874f", secondary: (bc && /^#[0-9a-f]{6}$/i.test(bc.secondary || "") && bc.secondary) || "#5b3a24" };
    }
    const K = L.id + "|" + (lo ? "lo" : "hi") + "|";
    // anciens maillages masqués (arme, outil, planeur, canne, effets restent : ils ne sont pas sous ces os)
    hideOld(u.torso);
    u.limbs.forEach(hideOld);
    u.knees.forEach(hideOld);
    u.elbows.forEach(hideOld);
    if (u.pelvis) {
      if (u.pelvis.isMesh) {
        u.pelvis.visible = false;
        const pel = new T.Group();
        pel.userData.ch1 = "pelvis";
        avatar.add(pel);
        u.pelvis = pel;
      } else hideOld(u.pelvis);
    } else {
      const pel = new T.Group();
      pel.userData.ch1 = "pelvis";
      avatar.add(pel);
      u.pelvis = pel;
    }
    if (u.lids) hideOld(u.lids);
    attach(u.torso, cached(K + "torso|" + (back ? back.color + back.secondary : "-"), () => torsoLot(L, lo, back)), "torso");
    attach(u.pelvis, cached(K + "pelvis", () => pelvisLot(L, lo)), "pelvis");
    const head = cached(K + "head", () => headLot(L, lo));
    attach(u.head, head, "head");
    // tête un peu plus grande, proportions de héros de la vidéo
    u.head.children.forEach((m) => {
      if (m.userData.ch1 === "head") m.scale.setScalar(1.09);
    });
    if (head.glass) {
      const dome = new T.Mesh(cached("dome" + (lo ? 1 : 0), () => new T.SphereGeometry(0.19, lo ? 14 : 28, lo ? 10 : 20)), GLASS);
      dome.position.set(0, 0.01, -0.005);
      dome.userData.ch1 = "dome";
      dome.userData.shared = true;
      u.head.add(dome);
    }
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      attach(u.limbs[i * 2 + 1], cached(K + "arm" + s, () => upperArmLot(L, lo, s)), "arm");
      attach(u.elbows[i], cached(K + "fore" + s, () => foreArmLot(L, lo, s)), "fore");
      attach(u.limbs[i * 2], cached(K + "thigh" + s, () => thighLot(L, lo, s)), "thigh");
      attach(u.knees[i], cached(K + "shin" + s, () => shinLot(L, lo, s)), "shin");
    }
    // paupières pour le clignement (characters-v67 bascule u.lids.visible)
    if (u.lids && L.kind !== "plush" && L.kind !== "dino" && L.kind !== "skeleton" && L.hat !== "balaclava" && !(L.kind === "armor" && L.helm) && !L.helmet) {
      attach(
        u.lids,
        cached(K + "lids", () => {
          const G = new Lot(lo);
          for (const s of [-1, 1]) G.sphere(L.skin || SKIN.tan, s * 0.036, 0.02, -0.097, 0.021, 0.015, 0.01);
          return { main: G.geometry() };
        }),
        "lids",
      );
    }
    u.ch1Look = L.id;
    return avatar;
  }

  /* ================================================================== catalogue + défaut */
  if (M && Array.isArray(M.catalog)) {
    const RAR = { 1: 1, 2: 2, 3: 3, 4: 4 };
    for (const item of M.catalog) {
      if (item.type !== "character") continue;
      const L = LOOKS[item.id];
      if (!L) continue;
      item.name = L.name;
      item.description = L.desc;
      item.rarity = RAR[L.rarity] || item.rarity;
      const main = L.kind === "recruit" ? "#6f7a43" : L.fur || L.plate || L.suit || L.hoodie || L.overall || L.shirt || (L.clothes && (L.clothes.vest || L.clothes.top)) || item.color;
      const sec = L.kind === "recruit" ? "#b59a68" : L.fur2 || L.plate2 || L.line || L.trim || L.hoodie2 || L.hatC || (L.clothes && L.clothes.pants) || item.secondary;
      item.color = main;
      item.secondary = sec;
      item.ch1 = true;
    }
  }

  /* ================================================================== branchement */
  const baseAvatar = A.avatar;
  A.avatar = function (eq, detail) {
    const g = baseAvatar.apply(this, arguments);
    try {
      dress(g, eq || {}, detail || (eq && eq.detail));
    } catch (err) {
      console.error("[ch1-chars]", err);
    }
    return g;
  };
  if (root.AZView) root.AZView.avatar = A.avatar;
  root.AZCh1Chars = { LOOKS, RECRUITS, dress, resolve };
})(typeof globalThis !== "undefined" ? globalThis : this);
