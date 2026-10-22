/* AZUR v94 — ch1-lobby-v94.js : le salon prend vie (« Falaise du Dernier Horizon »).
 * Référence : design/azur-reference-spec.md §6 (personnage sur sa plateforme ronde, décor de scène
 * extérieure, compte à rebours, carte de mode et bouton JOUER !). Tout est original : aucune
 * ressource, aucun nom ni logo d'un autre jeu.
 *
 * Décor (au-dessus des couches lobby-v66 / v89 / v83, sans les modifier) :
 *  - ciel couchant repeint et mer à l'infini dans le même shader : la mer se voit loin en contrebas
 *    de la falaise, avec le chemin de lumière du soleil qui se couche sur l'eau ;
 *  - collines en trois plans (brume de plus en plus claire), village côtier aux fenêtres qui
 *    s'allument, tour de l'horloge, grande roue qui tourne, phare sur son rocher avec son faisceau,
 *    voilier au large : un seul maillage fusionné pour tout le décor fixe ;
 *  - nuages qui dérivent (dont quelques-uns SOUS la falaise), mouettes, feuilles et pétales qui
 *    tombent, lucioles, étincelles qui montent de la plateforme : tout est animé dans les shaders
 *    (aucun calcul par image côté JavaScript) ;
 *  - le bus sous son ballon traverse le ciel régulièrement (43 maillages fusionnés en un seul),
 *    la météorite figée est replacée dans une fenêtre libre de l'interface selon l'écran ;
 *  - éclairage de studio repris : 5 lumières au lieu de 11 (principale, remplissage, deux
 *    contre-jours, ciel), arbres et îlots fusionnés : beaucoup moins d'appels de rendu sur iPhone.
 * Personnage :
 *  - émote au hasard toutes les ~15 s, réaction quand on le touche (il se tourne vers nous et
 *    salue), lancer pour le faire tourner avec de l'inertie, petit pas quand on change d'onglet,
 *    salto de joie quand on appuie sur JOUER (confettis, anneau lumineux, caméra qui s'approche),
 *    l'escouade IA fait aussi ses émotes ; le bouton EMOTE du salon fait danser le personnage.
 *  - n'utilise que le contrat public des animations : l'état du joueur passé à animateAvatar
 *    (emote / emoteStyle) — le système de ch1-models-v93.js choisit les clips.
 * Caméra : respiration lente, parallaxe à la souris, transitions douces entre les onglets.
 * Interface : voir ch1-lobby-v94.css (entrées animées, barre d'XP qui se remplit, bouton JOUER
 * vivant, chiffres du compte à rebours qui basculent, places d'escouade animées).
 * Qualité : AZUR.view.quality (low / medium / high / ultra) règle le nombre de particules et les
 * détails du ciel ; rien n'est ajouté au rendu en partie. */
(function (root) {
  "use strict";
  const T = root.THREE;
  const AV = root.AZView && root.AZView.View;
  const V = AV && AV.prototype;
  const A = root.AZArt;
  const doc = root.document;
  if (!T || !V || typeof V.drawMenu !== "function" || V.__v94Lobby) return;
  V.__v94Lobby = true;

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  const tierOf = (view) => { const q = view && view.quality; return q === "low" ? 0 : q === "medium" ? 1 : 2; };
  let warned = 0;
  const warn = (e) => { if (warned++ < 4) console.warn("[salon v94]", e); };
  const reduceMotion = () => { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };

  /* Œil de la caméra du salon (graphics-v200-world : x .10, y 1.66, z = recul selon l'écran).
   * Le décor lointain est placé en direction (azimut, hauteur en degrés) depuis cet œil. */
  const EYE = new T.Vector3(0.1, 1.66, 6.3);
  const SEA_Y = -13.4; // la mer, loin sous la falaise
  const SUN = { az: -7, el: 3.2 }; // le soleil se couche sur la mer, à gauche du personnage
  const sunDir = new T.Vector3(Math.sin(SUN.az * D2R) * Math.cos(SUN.el * D2R), Math.sin(SUN.el * D2R), -Math.cos(SUN.az * D2R) * Math.cos(SUN.el * D2R)).normalize();
  /* Fenêtres libres de l'interface selon la mise en page (bureau, téléphone en paysage, portrait) :
   * la météorite et le passage du bus y sont placés pour rester visibles. */
  const LAYOUT = {
    desk: { camZ: 6.3, meteor: [8.4, 7.2, 78, 0.5], bus: 5.4 },
    land: { camZ: 7.4, meteor: [12.5, 6.8, 78, 0.5], bus: 5.0 },
    port: { camZ: 9.2, meteor: [4.4, 12.5, 78, 0.42], bus: 9.0 },
  };
  function dirPoint(az, el, R, out, camZ) {
    const a = az * D2R;
    return out.set(EYE.x + Math.sin(a) * R, EYE.y + Math.tan(el * D2R) * R, (camZ == null ? EYE.z : camZ) - Math.cos(a) * R);
  }
  function canvasTex(w, h, draw) {
    const cv = doc.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d"), w, h);
    const t = new T.CanvasTexture(cv);
    t.generateMipmaps = true;
    t.minFilter = T.LinearMipmapLinearFilter;
    return t;
  }

  /* ================================================================ fusion de maillages
   * Rassemble les maillages statiques d'un groupe en un seul (couleur de matériau → couleur de
   * sommet). Les surfaces à facettes gardent leurs facettes (normales recalculées). */
  function bake(rootObj, accept) {
    rootObj.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(rootObj.matrixWorld).invert();
    const m4 = new T.Matrix4(), col = new T.Color(), em = new T.Color();
    const parts = [];
    rootObj.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o === rootObj) return;
      const mat = o.material;
      if (!mat || Array.isArray(mat) || !mat.color || !o.geometry || !o.geometry.attributes.position) return;
      for (let p = o; p && p !== rootObj; p = p.parent) if (!p.visible) return;
      if (accept && !accept(o, mat)) return;
      parts.push(o);
    });
    const chunks = [];
    let total = 0;
    for (const o of parts) {
      const src = o.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      m4.multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m4);
      if (o.material.flatShading || !g.attributes.normal) g.computeVertexNormals();
      const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
      const mat = o.material, vc = mat.vertexColors && g.attributes.color;
      col.copy(mat.color);
      if (mat.emissive && mat.emissiveIntensity > 0) col.add(em.copy(mat.emissive).multiplyScalar(Math.min(1, mat.emissiveIntensity) * 0.6));
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i);
        N[i * 3] = nor.getX(i); N[i * 3 + 1] = nor.getY(i); N[i * 3 + 2] = nor.getZ(i);
        C[i * 3] = col.r * (vc ? vc.getX(i) : 1); C[i * 3 + 1] = col.g * (vc ? vc.getY(i) : 1); C[i * 3 + 2] = col.b * (vc ? vc.getZ(i) : 1);
      }
      chunks.push([P, N, C]);
      total += n;
      g.dispose();
    }
    if (!total) return null;
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
    let off = 0;
    for (const [p, nn, c] of chunks) { P.set(p, off); N.set(nn, off); C.set(c, off); off += p.length; }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(P, 3));
    geo.setAttribute("normal", new T.BufferAttribute(N, 3));
    geo.setAttribute("color", new T.BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    return { geometry: geo, parts };
  }
  function bakeInPlace(group, accept, material) {
    const r = bake(group, accept);
    if (!r) return null;
    for (const o of r.parts) { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); }
    const mesh = new T.Mesh(r.geometry, material);
    mesh.name = "v94-baked";
    group.add(mesh);
    return mesh;
  }

  /* ================================================================ ciel + mer (un seul shader) */
  const SKY_FRAG = `
uniform float time; uniform vec3 sunDir; uniform float seaY; uniform float detail;
varying vec3 vW;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec3 skyCol(vec3 d){
  float y=max(d.y,0.);
  vec3 c=vec3(1.,.86,.64);
  c=mix(c,vec3(1.,.69,.45),smoothstep(.0,.07,y));
  c=mix(c,vec3(.97,.53,.53),smoothstep(.05,.17,y));
  c=mix(c,vec3(.66,.38,.67),smoothstep(.14,.33,y));
  c=mix(c,vec3(.30,.23,.55),smoothstep(.30,.58,y));
  c=mix(c,vec3(.10,.10,.29),smoothstep(.55,.95,y));
  float sa=max(dot(d,sunDir),0.);
  c+=vec3(1.,.62,.34)*(pow(sa,5.)*.32+pow(sa,42.)*.5);
  c=mix(c,vec3(1.,.97,.84),smoothstep(.99935,.99965,sa));
  return c;
}
void main(){
  vec3 d=normalize(vW-cameraPosition);
  vec3 col;
  if(d.y>-.0008){
    col=skyCol(d);
    if(detail>.5){
      float az=atan(d.x,-d.z);
      vec2 q=vec2(az*6.5+time*.003,d.y*34.);
      float n=vn(q)*.62+vn(q*vec2(2.7,1.9)+3.1)*.38;
      float band=smoothstep(.56,.86,n)*smoothstep(.035,.11,d.y)*(1.-smoothstep(.2,.38,d.y));
      vec3 lit=mix(vec3(1.,.72,.66),vec3(1.,.9,.68),pow(max(dot(d,sunDir),0.),3.));
      col=mix(col,lit,band*.42);
    }
    float st=step(.9975,h21(floor(d.xz/(d.y+.3)*160.)))*smoothstep(.34,.6,d.y);
    col+=vec3(st*(.55+.45*sin(time*2.3+d.x*400.)));
  }else{
    float hgt=max(cameraPosition.y-seaY,1.);
    float t=hgt/max(-d.y,1e-4);
    vec2 p=cameraPosition.xz+d.xz*t;
    float w=time*.55;
    vec2 g=vec2(cos(p.x*.19+w)+cos((p.x+p.y)*.11-w*.8)*.6,sin(p.y*.23+w*.9)+sin((p.x-p.y)*.15+w*.7)*.6);
    if(detail>.5)g+=vec2(cos(p.x*.9-w*2.1),sin(p.y*1.1+w*1.7))*.35;
    vec3 n=normalize(vec3(g.x*.05,1.,g.y*.05));
    vec3 r=reflect(d,n);
    float fres=pow(1.-max(dot(-d,n),0.),4.);
    vec3 sea=mix(vec3(.17,.2,.46),vec3(.38,.33,.64),smoothstep(60.,300.,t));
    col=mix(sea,skyCol(vec3(r.x,abs(r.y),r.z)),clamp(fres*.85+.08,0.,1.));
    float sa=max(dot(r,sunDir),0.);
    col+=vec3(1.,.83,.56)*(pow(sa,240.)*2.6+pow(sa,26.)*.26);
    col=mix(col,skyCol(vec3(d.x,0.,d.z)),smoothstep(110.,900.,t));
  }
  gl_FragColor=vec4(col,1.);
}`;
  function skyMaterial(u) {
    return new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false, uniforms: u,
      vertexShader: "varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
      fragmentShader: SKY_FRAG,
    });
  }

  /* ================================================================ décor lointain (un maillage) */
  class Geo {
    constructor() { this.p = []; this.c = []; }
    tri(a, b, c, ca, cb, cc) {
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      for (const k of [ca, cb, cc]) this.c.push(k.r, k.g, k.b);
    }
    quad(a, b, c, d, ca, cb, cc, cd) { this.tri(a, b, c, ca, cb, cc); this.tri(a, c, d, ca, cc, cd); }
    // boîte orientée vers l'œil (az) : façade, côtés, dessus
    box(az, R, y0, w, h, dep, cf, cs, ct, roof) {
      const a = az * D2R, ca = Math.cos(a), sa = Math.sin(a);
      const cx = EYE.x + sa * R, cz = EYE.z - ca * R;
      const P = (u, y, v) => [cx + u * ca - v * sa, y, cz + u * sa + v * ca]; // u : le long de la façade, v : vers l'œil
      const hw = w / 2, hd = dep / 2, y1 = y0 + h;
      this.quad(P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd), cf, cf, cf, cf);
      this.quad(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd), cs, cs, cs, cs);
      this.quad(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd), cs, cs, cs, cs);
      if (roof) {
        const yr = y1 + roof;
        this.tri(P(-hw, y1, hd), P(hw, y1, hd), P(0, yr, 0), ct, ct, ct);
        this.tri(P(hw, y1, hd), P(hw, y1, -hd), P(0, yr, 0), cs, cs, ct);
        this.tri(P(-hw, y1, -hd), P(-hw, y1, hd), P(0, yr, 0), cs, cs, ct);
      } else this.quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), ct, ct, ct, ct);
      return P;
    }
    cyl(x, y0, z, r0, r1, h, seg, cb, ct) {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
        this.quad([x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0], [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0],
          [x + Math.cos(a1) * r1, y0 + h, z + Math.sin(a1) * r1], [x + Math.cos(a0) * r1, y0 + h, z + Math.sin(a0) * r1], cb, cb, ct, ct);
      }
    }
    mesh(material) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      g.computeBoundingSphere();
      return new T.Mesh(g, material);
    }
  }
  const C = (h) => new T.Color(h);
  function ridge(G, R, az0, az1, step, elFn, cols) {
    const cT = C(cols[0]), cM = C(cols[1]), cB = C(cols[2]), cR = C(cols[3]), tmp = new T.Color();
    let prev = null;
    for (let az = az0; az <= az1 + 1e-6; az += step) {
      const e = elFn(az), a = az * D2R;
      const x = EYE.x + Math.sin(a) * R, z = EYE.z - Math.cos(a) * R, yT = EYE.y + Math.tan(e * D2R) * R;
      const rimH = 0.06 + R * 0.0032;
      const k = clamp(1 - Math.abs(az - SUN.az) / 55, 0.18, 1);
      const rc = tmp.copy(cT).lerp(cR, k).clone();
      const col = { t: [x, yT, z], r: [x, yT - rimH, z], m: [x, lerp(yT, SEA_Y, 0.42), z], b: [x, SEA_Y - 0.6, z], rc };
      if (prev) {
        G.quad(prev.r, col.r, col.t, prev.t, cT, cT, col.rc, prev.rc);
        G.quad(prev.m, col.m, col.r, prev.r, cM, cM, cT, cT);
        G.quad(prev.b, col.b, col.m, prev.m, cB, cB, cM, cM);
      }
      prev = col;
    }
  }
  function wave(seed) {
    const r = rng(seed), w = [];
    for (let i = 0; i < 4; i++) w.push([r() * TAU, 0.6 + r() * 0.9, 1 / (1 + i * 0.9)]);
    return (x) => { let s = 0; for (let i = 0; i < 4; i++) s += Math.sin(x * w[i][1] * (1 + i * 1.9) + w[i][0]) * w[i][2]; return s / 2.2; };
  }

  function buildVista(S) {
    const G = new Geo(), W = new Geo(), wSeeds = [];
    const r = rng(9494);
    /* plan lointain : montagnes dans la brume, de part et d'autre de la mer ouverte */
    const nC = wave(11), nB = wave(23), nA = wave(37);
    ridge(G, 132, -62, -17, 1, (az) => lerp(-7, 4.6, sstep(-17, -42, az)) + nC(az * 0.11) * 1.3 * sstep(-17, -30, az), ["#c08ea9", "#cf9eaa", "#dcaea8", "#ffd9b0"]);
    ridge(G, 132, 7, 64, 1, (az) => lerp(-7, 5.2, sstep(7, 28, az)) + nC(az * 0.12 + 4) * 1.4 * sstep(10, 26, az), ["#b98aa8", "#c99aa8", "#d7aaa6", "#ffd2ae"]);
    /* plan moyen : la côte du village (à droite) et une pointe à gauche */
    const elB = (az) => (az < 4 ? lerp(-7, -2.4, sstep(2.2, 4, az)) : az < 15 ? -2.3 + (az - 4) * 0.05 + nB(az * 0.6) * 0.18 : lerp(-1.75, 1.8, sstep(15, 30, az)) + nB(az * 0.3) * 0.9);
    ridge(G, 96, 2.2, 62, 0.5, elB, ["#7d6290", "#6a5584", "#5c4c7a", "#f2a27e"]);
    ridge(G, 96, -62, -21, 1, (az) => lerp(1.4, -7, sstep(-30, -21, az)) + nB(az * 0.4 + 9) * 0.7, ["#76608d", "#655383", "#574a78", "#f6a77f"]);
    /* premier plan : falaises boisées (petites bosses d'arbres) */
    ridge(G, 62, 15, 66, 0.35, (az) => lerp(-7, -1.2, sstep(15.5, 24, az)) + nA(az * 0.5) * 0.9 + Math.abs(Math.sin(az * 3.1)) * 0.35, ["#3c5864", "#33475d", "#2c3a55", "#e38d6e"]);
    ridge(G, 62, -66, -19, 0.35, (az) => lerp(-0.6, -7, sstep(-28, -19, az)) + nA(az * 0.5 + 3) * 0.8 + Math.abs(Math.sin(az * 2.7)) * 0.35, ["#3a5562", "#31455b", "#2a3853", "#f19a72"]);

    /* rocher du phare (pile de mer) et le phare, silhouette devant le soleil */
    {
      const az = -12.5, R = 58, a = az * D2R, x = EYE.x + Math.sin(a) * R, z = EYE.z - Math.cos(a) * R;
      const top = EYE.y + Math.tan(-3 * D2R) * R;
      const rk0 = C("#2f3352"), rk1 = C("#4a4466");
      for (let i = 0; i < 9; i++) {
        const a0 = (i / 9) * TAU, a1 = ((i + 1) / 9) * TAU, j0 = 1 + Math.sin(i * 2.3) * 0.18, j1 = 1 + Math.sin((i + 1) * 2.3) * 0.18;
        G.quad([x + Math.cos(a0) * 2.9 * j0, SEA_Y - 0.5, z + Math.sin(a0) * 2.4 * j0], [x + Math.cos(a1) * 2.9 * j1, SEA_Y - 0.5, z + Math.sin(a1) * 2.4 * j1],
          [x + Math.cos(a1) * 1.9 * j1, top, z + Math.sin(a1) * 1.6 * j1], [x + Math.cos(a0) * 1.9 * j0, top, z + Math.sin(a0) * 1.6 * j0], rk0, rk0, rk1, rk1);
      }
      G.cyl(x, top - 0.01, z, 1.95, 0.2, 0.25, 9, rk1, rk1);
      const white = C("#e9dcd8"), red = C("#c4485a"), dark = C("#2c2a44");
      const h = 4.4, bands = 5;
      for (let b = 0; b < bands; b++) {
        const y0 = top + (b / bands) * h, r0 = lerp(0.62, 0.42, b / bands), r1 = lerp(0.62, 0.42, (b + 1) / bands);
        G.cyl(x, y0, z, r0, r1, h / bands, 10, b % 2 ? red : white, b % 2 ? red : white);
      }
      G.cyl(x, top + h, z, 0.72, 0.72, 0.12, 10, dark, dark);
      G.cyl(x, top + h + 0.12, z, 0.36, 0.36, 0.55, 8, C("#fff1b8"), C("#ffe08a"));
      G.cyl(x, top + h + 0.67, z, 0.5, 0.02, 0.6, 8, red, red);
      S.lighthouse = new T.Vector3(x, top + h + 0.42, z);
    }
    /* voilier au large, sur le chemin de lumière */
    {
      const R = 205, a = -2.5 * D2R, x = EYE.x + Math.sin(a) * R, z = EYE.z - Math.cos(a) * R, y = SEA_Y;
      const hull = C("#3a2f4e"), sail = C("#ffe2c0"), sail2 = C("#f2b896");
      G.quad([x - 1.6, y + 0.05, z], [x + 1.6, y + 0.05, z], [x + 1.25, y + 0.55, z], [x - 1.4, y + 0.55, z], hull, hull, hull, hull);
      G.tri([x - 0.1, y + 0.6, z], [x + 1.2, y + 0.65, z], [x - 0.1, y + 3.4, z], sail, sail, sail);
      G.tri([x - 0.25, y + 0.6, z], [x - 1.25, y + 0.62, z], [x - 0.25, y + 2.6, z], sail2, sail2, sail2);
    }
    /* village côtier : maisons, tour de l'horloge, château d'eau, immeubles ; fenêtres à part */
    const front = C("#6c5b8c"), side = C("#53476f"), roofC = C("#8c4f73"), flat = C("#5f507e");
    const R = 93;
    const wins = (P, w, h, y0, rows, cols, seedBase) => {
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const u = (j + 0.5) / cols * w - w / 2, y = y0 + 0.45 + i * ((h - 0.7) / Math.max(1, rows - 0.4));
        if (y > y0 + h - 0.35) continue;
        const ww = Math.min(0.42, (w / cols) * 0.45), wh = 0.5, s = r();
        const a = P(u - ww / 2, y, 0.02), b = P(u + ww / 2, y, 0.02), c = P(u + ww / 2, y + wh, 0.02), d = P(u - ww / 2, y + wh, 0.02);
        const k = C("#ffffff");
        W.quad(a, b, c, d, k, k, k, k);
        for (let q = 0; q < 6; q++) wSeeds.push(s);
      }
    };
    const baseY = (az) => EYE.y + Math.tan(elB(az) * D2R) * R - 0.35;
    const town = [
      [4.6, 2.2, 2.4, 1.1], [5.6, 1.8, 3.4, 0], [6.5, 2.4, 2.0, 1.0], [7.3, 1.6, 4.6, 0], [8.2, 2.0, 2.6, 0.9],
      [10.0, 2.2, 3.0, 1.2], [10.9, 1.7, 5.4, 0], [11.8, 2.4, 2.2, 1.0], [12.7, 1.9, 3.6, 0], [13.6, 2.6, 2.4, 1.1], [14.6, 2.0, 2.0, 0.9],
    ];
    for (const [az, w, h, roof] of town) {
      const y0 = baseY(az), dep = 1.6 + r() * 0.6;
      const P = G.box(az, R + r() * 1.5, y0, w, h, dep, front, side, roof ? roofC : flat, roof);
      wins(P, w, h, y0, Math.max(1, Math.round(h / 1.1)), Math.max(1, Math.round(w / 0.8)));
    }
    { // tour de l'horloge
      const az = 9.1, y0 = baseY(az), P = G.box(az, R - 1, y0, 1.6, 7.6, 1.6, C("#7a6696"), side, roofC, 2.2);
      const cx = P(0, y0 + 6.3, 0.03), k = C("#fff0c4");
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * TAU, a1 = ((i + 1) / 12) * TAU, rr = 0.55;
        W.tri(cx, P(Math.cos(a0) * rr, y0 + 6.3 + Math.sin(a0) * rr, 0.03), P(Math.cos(a1) * rr, y0 + 6.3 + Math.sin(a1) * rr, 0.03), k, k, k);
        for (let q = 0; q < 3; q++) wSeeds.push(-1); // toujours allumée
      }
      wins(P, 1.6, 5.2, y0, 4, 1);
    }
    { // château d'eau
      const az = 6.0, y0 = baseY(az) + 0.3, a = az * D2R, x = EYE.x + Math.sin(a) * (R + 2), z = EYE.z - Math.cos(a) * (R + 2), leg = C("#3e3657");
      for (const [dx, dz] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) G.cyl(x + dx, y0, z + dz, 0.08, 0.08, 4.2, 4, leg, leg);
      G.cyl(x, y0 + 4.2, z, 1.25, 1.25, 1.6, 12, C("#8a7aa8"), C("#9a88b6"));
      G.cyl(x, y0 + 5.8, z, 1.3, 0.1, 0.7, 12, roofC, roofC);
    }
    const vistaMat = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false, side: T.DoubleSide });
    const vista = G.mesh(vistaMat);
    vista.name = "v94-vista";
    vista.renderOrder = -5;
    // fenêtres : une seule géométrie, elles s'allument et s'éteignent doucement
    const wm = W.mesh(null);
    wm.geometry.setAttribute("aSeed", new T.Float32BufferAttribute(wSeeds, 1));
    wm.material = new T.ShaderMaterial({
      uniforms: S.u, fog: false, side: T.DoubleSide,
      vertexShader: "attribute float aSeed;varying float vOn;uniform float time;void main(){float s=aSeed;float ph=floor(time*.07+s*13.);float on=step(.3,fract(sin(s*91.7+ph*17.13)*437.58));vOn=s<0.?1.:on*(.75+.25*sin(time*(1.+s*2.)+s*40.));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying float vOn;void main(){vec3 c=mix(vec3(.33,.27,.45),vec3(1.,.83,.5),vOn);gl_FragColor=vec4(c,1.);}",
    });
    wm.name = "v94-windows";
    // grande roue : tourne lentement, cabines lumineuses
    const wheel = new T.Group();
    {
      const az = 16.4, Rw = R - 2, a = az * D2R, y0 = baseY(az);
      wheel.position.set(EYE.x + Math.sin(a) * Rw, y0 + 3.6, EYE.z - Math.cos(a) * Rw);
      wheel.rotation.y = -a;
      const WG = new Geo(), rim = C("#c9a3c9"), spoke = C("#8d79a8"), hub = C("#ffe3a6");
      const rr = 3.1, seg = 32;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
        WG.quad([Math.cos(a0) * rr, Math.sin(a0) * rr, 0], [Math.cos(a1) * rr, Math.sin(a1) * rr, 0], [Math.cos(a1) * (rr - 0.14), Math.sin(a1) * (rr - 0.14), 0], [Math.cos(a0) * (rr - 0.14), Math.sin(a0) * (rr - 0.14), 0], rim, rim, rim, rim);
      }
      for (let i = 0; i < 8; i++) {
        const b = (i / 8) * TAU, cx = Math.cos(b), sx = Math.sin(b), px = -sx * 0.04, py = cx * 0.04;
        WG.quad([px, py, 0], [-px, -py, 0], [cx * rr - px, sx * rr - py, 0], [cx * rr + px, sx * rr + py, 0], spoke, spoke, spoke, spoke);
        const k = C(["#ffd36e", "#ff8fb4", "#8ff0ff", "#ffe9b0"][i % 4]), x0 = cx * rr, y0c = sx * rr;
        WG.quad([x0 - 0.22, y0c - 0.42, 0.02], [x0 + 0.22, y0c - 0.42, 0.02], [x0 + 0.22, y0c - 0.05, 0.02], [x0 - 0.22, y0c - 0.05, 0.02], k, k, k, k);
      }
      WG.quad([-0.2, -0.2, 0.03], [0.2, -0.2, 0.03], [0.2, 0.2, 0.03], [-0.2, 0.2, 0.03], hub, hub, hub, hub);
      const wmesh = WG.mesh(vistaMat);
      wheel.add(wmesh);
      wheel.userData.spin = wmesh;
      // pieds fixes, fusionnés au décor
      const P = (u, y) => [wheel.position.x + u * Math.cos(a), y, wheel.position.z + u * Math.sin(a)];
      const leg = C("#6a5a86");
      G.quad(P(-1.8, y0), P(-1.5, y0), P(0.08, y0 + 3.6), P(-0.08, y0 + 3.6), leg, leg, leg, leg);
      G.quad(P(1.5, y0), P(1.8, y0), P(0.08, y0 + 3.6), P(-0.08, y0 + 3.6), leg, leg, leg, leg);
      // on reconstruit la géométrie fixe avec les pieds
      vista.geometry.dispose();
      vista.geometry = G.mesh(null).geometry;
    }
    return { vista, windows: wm, wheel };
  }

  /* ================================================================ particules animées dans les shaders */
  function instanced(base, count, attrs) {
    const g = new T.InstancedBufferGeometry();
    g.index = base.index;
    for (const k in base.attributes) g.setAttribute(k, base.attributes[k]);
    for (const k in attrs) g.setAttribute(k, new T.InstancedBufferAttribute(attrs[k].data, attrs[k].size));
    g.instanceCount = count;
    g.userData.max = count;
    return g;
  }
  function particleMesh(geo, mat, name, order) {
    const m = new T.Mesh(geo, mat);
    m.frustumCulled = false;
    m.name = name;
    if (order != null) m.renderOrder = order;
    return m;
  }

  function cloudTexture() {
    return canvasTex(512, 512, (g) => {
      const r = rng(4242);
      for (let cell = 0; cell < 4; cell++) {
        const ox = (cell % 2) * 256, oy = Math.floor(cell / 2) * 256;
        g.save();
        g.beginPath(); g.rect(ox, oy, 256, 256); g.clip();
        const base = oy + 182, puffs = 7 + Math.floor(r() * 4);
        g.globalCompositeOperation = "source-over";
        for (let i = 0; i < puffs; i++) {
          const u = i / (puffs - 1), x = ox + 34 + u * 188 + (r() - 0.5) * 18;
          const rad = (26 + Math.sin(u * Math.PI) * (40 + r() * 26)) * (cell === 3 ? 0.8 : 1);
          const y = base - rad * (0.45 + r() * 0.35);
          const gr = g.createRadialGradient(x, y, rad * 0.15, x, y, rad);
          gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.62, "rgba(255,255,255,.92)"); gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
        }
        // base plate et ombrée : la lumière vient d'en haut
        g.globalCompositeOperation = "destination-out";
        const cut = g.createLinearGradient(0, base - 8, 0, base + 22);
        cut.addColorStop(0, "rgba(0,0,0,0)"); cut.addColorStop(1, "rgba(0,0,0,1)");
        g.fillStyle = cut; g.fillRect(ox, base - 8, 256, 90);
        g.globalCompositeOperation = "source-atop";
        const sh = g.createLinearGradient(0, oy + 40, 0, base + 10);
        sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.55, "rgba(150,150,150,.45)"); sh.addColorStop(1, "rgba(70,70,70,.9)");
        g.fillStyle = sh; g.fillRect(ox, oy, 256, 256);
        g.restore();
      }
    });
  }
  function buildClouds(S) {
    const r = rng(777), max = 18;
    const pos = new Float32Array(max * 4), info = new Float32Array(max * 4);
    // index 0..3 : nuages SOUS la falaise (au ras de la mer) ; ensuite le ciel, du plus loin au plus proche
    const list = [];
    for (let i = 0; i < max; i++) {
      const low = i < 4;
      const az = low ? -26 + i * 15 + r() * 6 : -42 + r() * 84;
      const el = low ? -3.6 + r() * 1.6 : 2.5 + Math.pow(r(), 1.4) * 15;
      const R = low ? 70 + r() * 40 : 75 + r() * 70;
      const p = dirPoint(az, el, R, new T.Vector3());
      const size = low ? 16 + r() * 10 : 14 + r() * 22;
      list.push({ p, size, idx: Math.floor(r() * 4), asp: 0.52 + r() * 0.12, sp: (0.25 + r() * 0.55) * (low ? 0.6 : 1), a: low ? 0.7 : 0.62 + r() * 0.3, R });
    }
    list.sort((a, b) => b.R - a.R);
    list.forEach((c, i) => { pos.set([c.p.x, c.p.y, c.p.z, c.size], i * 4); info.set([c.idx, c.asp, c.sp, c.a], i * 4); });
    const geo = instanced(new T.PlaneGeometry(1, 1), max, { aPos: { data: pos, size: 4 }, aInfo: { data: info, size: 4 } });
    const mat = new T.ShaderMaterial({
      uniforms: Object.assign({ map: { value: cloudTexture() }, litCol: { value: C("#ffd9c6") }, shadeCol: { value: C("#a7739f") }, sunCol: { value: C("#fff0bf") } }, S.u),
      transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec4 aPos;attribute vec4 aInfo;uniform float time;uniform vec3 sunDir;uniform vec3 litCol;uniform vec3 shadeCol;uniform vec3 sunCol;
varying vec2 vUv;varying vec3 vLit;varying vec3 vShade;varying float vA;
void main(){vec3 c=aPos.xyz;float span=150.;c.x=mod(c.x+time*aInfo.z+span,2.*span)-span;float edge=1.-smoothstep(span*.72,span,abs(c.x));
vec4 mv=viewMatrix*vec4(c,1.);mv.xy+=position.xy*vec2(aPos.w,aPos.w*aInfo.y);
vec2 cell=vec2(mod(aInfo.x,2.),floor(aInfo.x/2.));vUv=(uv+cell)*.5;
vec3 d=normalize(c-cameraPosition);float s=pow(max(dot(d,sunDir),0.),5.);
vLit=mix(litCol,sunCol,s);vShade=mix(shadeCol,vec3(.86,.55,.6),s*.6);vA=aInfo.w*edge;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D map;varying vec2 vUv;varying vec3 vLit;varying vec3 vShade;varying float vA;
void main(){vec4 t=texture2D(map,vUv);float a=t.a*vA;if(a<.01)discard;gl_FragColor=vec4(mix(vShade,vLit,t.r),a);}`,
    });
    return particleMesh(geo, mat, "v94-clouds", -2);
  }

  function buildBirds(S) {
    // mouette en « M » : racine, coude, pointe ; aW = part du battement
    const P = [], Wt = [];
    const v = (x, y, w) => { P.push(x, y, 0); Wt.push(w); };
    for (const s of [-1, 1]) {
      v(0, 0.05, 0); v(0, -0.04, 0); v(s * 0.24, 0.07, 0.45);
      v(0, -0.04, 0); v(s * 0.24, 0.0, 0.45); v(s * 0.24, 0.07, 0.45);
      v(s * 0.24, 0.07, 0.45); v(s * 0.24, 0.0, 0.45); v(s * 0.55, -0.03, 1);
    }
    const base = new T.BufferGeometry();
    base.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    base.setAttribute("aW", new T.Float32BufferAttribute(Wt, 1));
    const max = 9, r = rng(31), seed = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      seed.set([-row * 1.3 + (r() - 0.5) * 0.6, side * row * 0.45 + (r() - 0.5) * 0.4, (r() - 0.5) * 2, r()], i * 4);
    }
    const geo = instanced(base, max, { aSeed: { data: seed, size: 4 } });
    const mat = new T.ShaderMaterial({
      uniforms: Object.assign({ pA: { value: dirPoint(-55, 5.5, 44, new T.Vector3()) }, pB: { value: dirPoint(55, 7.5, 44, new T.Vector3()) } }, S.u),
      side: T.DoubleSide, fog: false,
      vertexShader: `attribute vec4 aSeed;attribute float aW;uniform float time;uniform vec3 pA;uniform vec3 pB;
void main(){float per=31.;float u=fract(time/per+.35);float k=u/.72;float dir=mod(floor(time/per+.35),2.);
vec3 a=dir>.5?pB:pA,b=dir>.5?pA:pB;vec3 base=mix(a,b,clamp(k,0.,1.));
vec3 off=aSeed.xyz;off.x*=dir>.5?-1.:1.;base+=off;base.y+=sin(k*6.2832+aSeed.w*4.)*.7+dir*1.6;
float fl=sin(time*(6.+aSeed.w*2.5)+aSeed.w*40.);float gl=smoothstep(.25,.7,sin(time*.6+aSeed.w*9.));fl=mix(fl,.25,gl);
vec3 p=position*1.35;p.y+=aW*fl*.5;vec3 w=base+p;if(k>1.)w.y-=2000.;
gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
      fragmentShader: "void main(){gl_FragColor=vec4(.2,.15,.29,1.);}",
    });
    return particleMesh(geo, mat, "v94-birds");
  }

  function buildLeaves(S) {
    // feuille en losange, deux faces ; couleurs : vert tendre, orangé, pétales roses
    const base = new T.BufferGeometry();
    base.setAttribute("position", new T.Float32BufferAttribute([0, -0.07, 0, 0.045, 0, 0, 0, 0.07, 0, 0, -0.07, 0, 0, 0.07, 0, -0.045, 0, 0], 3));
    const max = 44, r = rng(5150), seed = new Float32Array(max * 4), col = new Float32Array(max * 3);
    const pal = ["#8fd35c", "#5fb84e", "#ffb347", "#ff8c52", "#ffc4dc", "#ffd8e8", "#f6e27a"];
    for (let i = 0; i < max; i++) {
      seed.set([r(), r(), r(), r()], i * 4);
      const c = C(pal[i % pal.length]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = instanced(base, max, { aSeed: { data: seed, size: 4 }, aCol: { data: col, size: 3 } });
    const mat = new T.ShaderMaterial({
      uniforms: Object.assign({ boost: { value: 0 } }, S.u), side: T.DoubleSide, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec4 aSeed;attribute vec3 aCol;uniform float time;varying vec3 vC;varying float vA;
mat3 rot(vec3 a,float g){a=normalize(a);float s=sin(g),c=cos(g),o=1.-c;return mat3(o*a.x*a.x+c,o*a.x*a.y+a.z*s,o*a.z*a.x-a.y*s,o*a.x*a.y-a.z*s,o*a.y*a.y+c,o*a.y*a.z+a.x*s,o*a.z*a.x+a.y*s,o*a.y*a.z-a.x*s,o*a.z*a.z+c);}
void main(){float H=6.4;float sp=.22+aSeed.w*.3;float f=mod(aSeed.z*H+time*sp,H);
vec3 c=vec3(-7.+mod(aSeed.x*14.+time*sp*.9+sin(time*.8+aSeed.z*6.3)*.4,14.),5.9-f,-7.5+aSeed.y*9.5+cos(time*.6+aSeed.x*9.)*.35);
float g=time*(1.4+aSeed.w*2.2)+aSeed.z*20.;mat3 R=rot(vec3(sin(aSeed.z*13.),.7,cos(aSeed.x*17.)),g);
vec3 n=R*vec3(0.,0.,1.);vC=aCol*(.55+.45*abs(n.z));vA=smoothstep(0.,.5,f)*(1.-smoothstep(H-1.,H,f));
gl_Position=projectionMatrix*viewMatrix*vec4(c+R*position*1.3,1.);}`,
      fragmentShader: "varying vec3 vC;varying float vA;void main(){gl_FragColor=vec4(vC,vA);}",
    });
    return particleMesh(geo, mat, "v94-leaves");
  }

  const GLOW_FRAG = "varying vec2 vUv;varying float vA;varying vec3 vC;void main(){vec2 q=vUv-.5;float d=dot(q,q)*4.;float g=exp(-d*5.)+exp(-d*28.)*.6;gl_FragColor=vec4(vC*g*vA,1.);}";
  function buildFireflies(S) {
    const max = 18, r = rng(818), seed = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) seed.set([r(), r(), r(), r()], i * 4);
    const geo = instanced(new T.PlaneGeometry(1, 1), max, { aSeed: { data: seed, size: 4 } });
    const mat = new T.ShaderMaterial({
      uniforms: S.u, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      vertexShader: `attribute vec4 aSeed;uniform float time;varying vec2 vUv;varying float vA;varying vec3 vC;
void main(){float side=aSeed.x<.5?-1.:1.;vec3 c=vec3(side*(2.6+aSeed.x*5.),.35+aSeed.y*2.6,-8.2+aSeed.z*5.);
c+=vec3(sin(time*.37+aSeed.w*20.)*.7,sin(time*.53+aSeed.x*10.)*.35,cos(time*.31+aSeed.y*13.)*.5);
vec4 mv=viewMatrix*vec4(c,1.);mv.xy+=position.xy*.32;vUv=uv;vA=pow(.5+.5*sin(time*(1.1+aSeed.w*1.3)+aSeed.z*30.),3.)*.85;
vC=mix(vec3(1.,.86,.42),vec3(.62,1.,.72),step(.7,aSeed.w));gl_Position=projectionMatrix*mv;}`,
      fragmentShader: GLOW_FRAG,
    });
    return particleMesh(geo, mat, "v94-fireflies");
  }

  function buildSparkles(S) {
    const max = 28, r = rng(2808), seed = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) seed.set([r(), r(), r(), r()], i * 4);
    const geo = instanced(new T.PlaneGeometry(1, 1), max, { aSeed: { data: seed, size: 4 } });
    const mat = new T.ShaderMaterial({
      uniforms: Object.assign({ boost: S.boost }, S.u), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      vertexShader: `attribute vec4 aSeed;uniform float time;uniform float boost;varying vec2 vUv;varying float vA;varying vec3 vC;
void main(){float sp=.18+aSeed.w*.22+boost*.5;float f=fract(aSeed.z+time*sp);float a=aSeed.x*6.2832+time*.15;float rr=1.95+aSeed.y*.22;
vec3 c=vec3(cos(a)*rr,.3+f*(1.5+boost*1.6),sin(a)*rr);vec4 mv=viewMatrix*vec4(c,1.);mv.xy+=position.xy*(.09+boost*.06);
vUv=uv;vA=sin(f*3.1416)*(.75+boost);vC=mix(vec3(.45,.95,1.),vec3(1.,.85,.35),step(.62,aSeed.w));gl_Position=projectionMatrix*mv;}`,
      fragmentShader: GLOW_FRAG,
    });
    return particleMesh(geo, mat, "v94-sparkles");
  }

  function buildConfetti(S) {
    const base = new T.PlaneGeometry(0.11, 0.065);
    const max = 110, r = rng(1313), seed = new Float32Array(max * 4), col = new Float32Array(max * 3);
    const pal = ["#ffe62e", "#27d3ff", "#ff5d8f", "#9a4dff", "#5dff9b", "#ffffff", "#ff9f2e"];
    for (let i = 0; i < max; i++) {
      seed.set([r(), r(), r(), r()], i * 4);
      const c = C(pal[i % pal.length]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = instanced(base, max, { aSeed: { data: seed, size: 4 }, aCol: { data: col, size: 3 } });
    const mat = new T.ShaderMaterial({
      uniforms: Object.assign({ t0: S.confettiT0 }, S.u), side: T.DoubleSide, fog: false,
      vertexShader: `attribute vec4 aSeed;attribute vec3 aCol;uniform float time;uniform float t0;varying vec3 vC;
mat3 rot(vec3 a,float g){a=normalize(a);float s=sin(g),c=cos(g),o=1.-c;return mat3(o*a.x*a.x+c,o*a.x*a.y+a.z*s,o*a.z*a.x-a.y*s,o*a.x*a.y-a.z*s,o*a.y*a.y+c,o*a.y*a.z+a.x*s,o*a.z*a.x+a.y*s,o*a.y*a.z-a.x*s,o*a.z*a.z+c);}
void main(){float age=time-t0-aSeed.z*.25;if(age<0.||age>4.2){gl_Position=vec4(2.,2.,2.,1.);vC=vec3(0.);return;}
float a=aSeed.x*6.2832;float s=2.2+aSeed.y*3.2;vec3 v0=vec3(cos(a)*s,5.5+aSeed.w*4.,sin(a)*s*.7+1.2);
vec3 vt=vec3(sin(time*1.3+aSeed.x*20.)*.5+.35,-1.15,cos(time*1.1+aSeed.y*20.)*.4);float k=1.7;
vec3 c=vec3(0.,2.1,.2)+vt*age+(v0-vt)*(1.-exp(-k*age))/k;
mat3 R=rot(vec3(sin(aSeed.w*9.),cos(aSeed.x*7.),.5),age*(7.+aSeed.y*8.));vec3 n=R*vec3(0.,0.,1.);
vC=aCol*(.55+.45*abs(n.z));gl_Position=projectionMatrix*viewMatrix*vec4(c+R*position,1.);}`,
      fragmentShader: "varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.);}",
    });
    const m = particleMesh(geo, mat, "v94-confetti");
    m.visible = false;
    return m;
  }

  function buildBeam(S) {
    // faisceau du phare : cône ouvert additif, pivot à la lanterne
    const g = new T.ConeGeometry(2.2, 26, 14, 1, true);
    g.translate(0, -13, 0);
    g.rotateX(-Math.PI / 2); // pointe à l'origine, ouverture vers -z
    const mat = new T.ShaderMaterial({
      uniforms: S.u, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      vertexShader: "varying float vL;void main(){vL=clamp(-position.z/26.,0.,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying float vL;void main(){float a=(1.-vL)*smoothstep(0.,.08,vL)*.2;gl_FragColor=vec4(vec3(1.,.9,.62)*a,1.);}",
    });
    const beam = new T.Mesh(g, mat);
    beam.position.copy(S.lighthouse);
    beam.frustumCulled = false;
    beam.name = "v94-beam";
    const flare = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: "#ffe7a8", transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, toneMapped: false }));
    flare.position.copy(S.lighthouse);
    flare.scale.setScalar(2.2);
    return { beam, flare };
  }
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    glowTex = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    glowTex.colorSpace = T.SRGBColorSpace;
    return glowTex;
  }
  function buildShock() {
    const m = new T.Mesh(new T.RingGeometry(0.86, 1, 64), new T.MeshBasicMaterial({ color: "#fff3a0", transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.3;
    m.visible = false;
    m.name = "v94-shock";
    return m;
  }

  /* ================================================================ bus sous son ballon (fusionné) */
  function buildBus() {
    if (!A || typeof A.aircraft !== "function") return null;
    let src = null;
    try { src = A.aircraft(); } catch (e) { return null; }
    const r = bake(src, (o, m) => !m.map && (!m.transparent || m.opacity > 0.6) && !(m.blending && m.blending !== T.NormalBlending));
    src.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    if (!r) return null;
    const geo = r.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, h = Math.max(1, bb.max.y - bb.min.y);
    const mesh = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, fog: false }));
    const g = new T.Group();
    g.add(mesh);
    g.scale.setScalar(4.4 / h);
    mesh.position.y = -(bb.min.y + bb.max.y) / 2;
    g.name = "v94-bus";
    g.visible = false;
    return g;
  }

  /* ================================================================ installation */
  function upgrade(view, L) {
    const scene = view.menuScene, x = L.v66, up = L.v89;
    const S = (L.v94 = {
      u: { time: { value: view.time || 0 }, sunDir: { value: sunDir.clone() }, seaY: { value: SEA_Y }, detail: { value: 1 } },
      boost: { value: 0 }, confettiT0: { value: -99 },
      tier: -1, layout: "", ready: false, pushT: 0, flash: 0,
      pointer: { x: 0, y: 0 },
      cam: { init: false, P: new T.Vector3(), L: new T.Vector3(), off: 0, t: 0, px: 0, py: 0, push: 0, w: 0, h: 0 },
      c: { emote: null, next: (view.time || 0) + 9, yaw: 0, yawV: 0, yawT: 0, hopT: -9, hopH: 0, hopY: 0, lastTab: "", lastAct: -99, spin: 0, face: false, drag: false, bag: [], tapI: 0, bots: new WeakMap(), btnI: 0, btnT: -99 },
    });

    /* ---- lumières : 5 au lieu de 11 */
    scene.traverse((o) => {
      if (!o.isLight) return;
      if (o.isHemisphereLight) { o.color.set("#ffd9c2"); o.groundColor.set("#3c2d5e"); o.intensity = 1.15; }
      else o.visible = false;
    });
    const dl = (c, i, p) => { const l = new T.DirectionalLight(c, i); l.position.set(p[0], p[1], p[2]); l.target.position.set(0, 1.1, 0); scene.add(l, l.target); return l; };
    S.lights = {
      key: dl("#ffe6cc", 3.3, [3.4, 5.4, 6.6]),
      fill: dl("#a9c3ff", 0.95, [-4.6, 2.0, 4.6]),
      rimSun: dl("#ffa269", 2.9, [-3.6, 2.6, -6.2]),
      rimCool: dl("#78f0ff", 2.6, [5.0, 4.2, -4.6]),
    };
    S.base = { key: 3.3, rimSun: 2.9, rimCool: 2.6 };

    /* ---- ciel couchant + mer */
    const sky = L.root.children.find((c) => c.isMesh && c.geometry && c.geometry.type === "SphereGeometry" && c.material && c.material.side === T.BackSide);
    if (sky) { sky.material.dispose(); sky.material = skyMaterial(S.u); sky.renderOrder = -10; sky.frustumCulled = false; S.sky = sky; }
    if (L.cloud) L.cloud.visible = false; // l'ancienne mer de nuages : la vraie mer est désormais en contrebas
    if (L.motes) L.motes.visible = false; // remplacées par les lucioles
    if (up && up.petalMesh) up.petalMesh.visible = false; // remplacées par les feuilles/pétales animés en shader
    if (L.bulbs && L.bulbs.instanceColor) { // guirlande : tons chauds homogènes
      const warm = ["#ffd27a", "#ffe9b8", "#ffb873"].map(C);
      for (let i = 0; i < L.bulbs.count; i++) L.bulbs.setColorAt(i, warm[i % 3]);
      L.bulbs.instanceColor.needsUpdate = true;
    }

    /* ---- fusion des arbres, rochers, mâts et îlots (beaucoup moins d'appels de rendu) */
    const keep = new Set(x.flags || []);
    const island = L.root.children.find((c) => c.isGroup && c.children.some((k) => keep.has(k)));
    const meadowMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    if (island) bakeInPlace(island, (o, m) => !keep.has(o) && !m.transparent && !m.map && (m.isMeshStandardMaterial || m.isMeshLambertMaterial), meadowMat);
    for (const s of x.islets || []) bakeInPlace(s.g, (o, m) => !m.transparent && !m.map && m.isMeshStandardMaterial, meadowMat);
    if (x.bus) x.bus.visible = false; // remplacé par le bus fusionné qui passe régulièrement

    /* ---- décor lointain */
    const vista = buildVista(S);
    S.wheel = vista.wheel;
    S.parts = {
      vista: vista.vista, windows: vista.windows, wheel: vista.wheel,
      clouds: buildClouds(S), birds: buildBirds(S), leaves: buildLeaves(S), fireflies: buildFireflies(S),
      sparkles: buildSparkles(S), confetti: buildConfetti(S), shock: buildShock(),
    };
    const beam = buildBeam(S);
    S.parts.beam = beam.beam; S.parts.flare = beam.flare;
    S.bus = buildBus();
    if (S.bus) S.parts.bus = S.bus;
    S.group = new T.Group();
    S.group.name = "v94-lobby";
    for (const k in S.parts) S.group.add(S.parts[k]);
    L.root.add(S.group);
    S.meteor = x.meteor || null;
    if (S.meteor) S.meteorBase = S.meteor.scale.x;
    if (x.meteorGlow) x.meteorGlow.material.opacity = 0.45;
    if (view.menuCamera) { view.menuCamera.far = Math.max(view.menuCamera.far, 260); view.menuCamera.updateProjectionMatrix(); }

    hookRenderer(view);
    hookPointer(view);
  }

  function applyTier(S, tier) {
    S.tier = tier;
    S.u.detail.value = tier > 0 ? 1 : 0;
    const counts = { clouds: [9, 14, 18], birds: [5, 7, 9], leaves: [16, 30, 44], fireflies: [7, 12, 18], sparkles: [12, 20, 28], confetti: [45, 80, 110] };
    for (const k in counts) { const m = S.parts[k]; if (m && m.geometry) m.geometry.instanceCount = Math.min(m.geometry.userData.max, counts[k][tier]); }
    if (S.parts.beam) S.parts.beam.visible = tier > 0;
  }
  function applyLayout(S, key) {
    S.layout = key;
    const lay = LAYOUT[key];
    if (S.meteor) {
      const [az, el, R, sc] = lay.meteor;
      dirPoint(az, el, R, S.meteor.position, lay.camZ);
      S.meteor.scale.setScalar(sc);
    }
  }

  /* ================================================================ chaque image du salon */
  const _v = new T.Vector3(), _f = new T.Vector3(), _L = new T.Vector3(), _P = new T.Vector3(), _focus = new T.Vector3();
  function updateBus(S, t) {
    const bus = S.bus;
    if (!bus) return;
    const per = 44, cycle = Math.floor((t + 30) / per), k = ((t + 30) % per) / per;
    const back = cycle % 2 === 1, active = k < 0.86, kk = k / 0.86;
    bus.visible = active;
    if (!active) return;
    const lay = LAYOUT[S.layout] || LAYOUT.desk;
    const R = back ? 88 : 64, el = lay.bus + (back ? 1.6 : 0);
    const az = back ? lerp(46, -46, kk) : lerp(-46, 46, kk);
    dirPoint(az, el, R, bus.position, lay.camZ);
    bus.position.y += Math.sin(t * 0.7) * 0.3;
    const a = az * D2R, dx = (back ? -1 : 1) * Math.cos(a), dz = (back ? -1 : 1) * Math.sin(a);
    bus.rotation.set(0, Math.atan2(-dx, -dz), Math.sin(t * 0.9) * 0.04);
  }

  function beforeFrame(view, S, dt, options) {
    const t = view.time || 0;
    dt = clamp(+dt || 0, 0, 0.1);
    S.u.time.value = t;
    const tier = tierOf(view);
    if (tier !== S.tier) applyTier(S, tier);
    const cam = view.menuCamera;
    const key = cam && cam.aspect < 0.82 ? "port" : view.canvas && view.canvas.clientHeight < 520 ? "land" : "desk";
    if (key !== S.layout) applyLayout(S, key);
    updateBus(S, t);
    if (S.wheel) S.wheel.userData.spin.rotation.z = t * 0.12;
    if (S.parts.beam && S.parts.beam.visible) {
      const ang = t * 0.75;
      S.parts.beam.rotation.y = ang;
      const toward = Math.max(0, Math.cos(ang - Math.atan2(EYE.x - S.lighthouse.x, EYE.z - S.lighthouse.z) + Math.PI));
      S.parts.flare.scale.setScalar(2 + Math.pow(toward, 10) * 7);
      S.parts.flare.material.opacity = 0.55 + Math.pow(toward, 10) * 0.45;
    }
    const g = root.AZUR;
    const ready = !!(g && g.lobbyReady && g.screen === "menu");
    if (ready && !S.ready) celebrate(view, S, t);
    if (!ready && S.ready) { S.pushT = 0; if (S.c.emote && S.c.emote.kind === "ready") S.c.emote = null; }
    S.ready = ready;
    // anneau de choc, confettis, montée des étincelles
    S.flash = Math.max(0, S.flash - dt * 0.9);
    S.boost.value = lerp(S.boost.value, ready ? 1 : S.flash, damp(dt, 3));
    const shock = S.parts.shock, sa = t - (S.shockT || -99);
    shock.visible = sa >= 0 && sa < 1.2;
    if (shock.visible) { const e = 1 - Math.pow(1 - sa / 1.2, 3); shock.scale.setScalar(1.6 + e * 4.2); shock.material.opacity = (1 - sa / 1.2) * 0.8; }
    S.parts.confetti.visible = t - S.confettiT0.value < 4.6;
    const Lk = S.lights, f = S.boost.value;
    Lk.rimCool.intensity = S.base.rimCool * (1 + f * 0.6);
    Lk.rimSun.intensity = S.base.rimSun * (1 + f * 0.5);
    Lk.key.intensity = S.base.key * (1 + f * 0.12);
    director(view, S, t, dt, options);
  }

  function celebrate(view, S, t) {
    S.pushT = 0.13;
    S.flash = 1;
    S.shockT = t;
    S.confettiT0.value = t;
    play(S.c, "victoire", t, "ready", 4.2);
    S.c.yawT = 0; S.c.face = true;
  }

  /* ---------------------------------------------------------------- le personnage */
  const LEN = { salut: 3.4, danse: 5.4, victoire: 4.2, robot: 4.8, etoile: 3.9, toupie: 4.6 };
  const IDLE_BAG = ["danse", "salut", "robot", "toupie", "victoire", "etoile"];
  const TAP_BAG = ["salut", "victoire", "salut"];
  function play(Cs, style, t, kind, len) {
    const gap = Cs.emote ? 0.18 : 0; // une image sans émote pour que l'enchaînement reparte du début
    Cs.emote = { style, kind, start: t + gap, until: t + gap + (len || LEN[style] || 4), len: len || LEN[style] || 4 };
  }
  function nextIdle(Cs) {
    if (!Cs.bag.length) { Cs.bag = IDLE_BAG.slice(); for (let i = Cs.bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [Cs.bag[i], Cs.bag[j]] = [Cs.bag[j], Cs.bag[i]]; } }
    return Cs.bag.pop();
  }
  function director(view, S, t, dt, options) {
    const Cs = S.c, g = root.AZUR;
    const tab = (doc.body && doc.body.dataset.tab) || "play";
    const panel = !!options.panel;
    if (tab !== Cs.lastTab) {
      if (Cs.lastTab) {
        Cs.hopT = t; Cs.hopH = 0.07; Cs.lastAct = t;
        Cs.yawT = panel ? 0.42 : 0;
        Cs.yawV += panel ? .8 : -.8;
        if (Cs.emote && Cs.emote.kind === "idle") Cs.emote = null;
      }
      Cs.lastTab = tab;
    }
    if (!panel) Cs.yawT = 0;
    if (Cs.emote && t >= Cs.emote.until) { Cs.emote = null; Cs.next = Math.max(Cs.next, t + 13 + Math.random() * 6); }
    const busy = !!(g && (g.modal || g.lobbyReady));
    // pas d'émote automatique : le personnage ne danse que si le joueur appuie sur EMOTE
    void busy; void nextIdle;
    // ressort de rotation (petit pas, regard vers le panneau)
    Cs.yawV += ((Cs.yawT - Cs.yaw) * 42 - Cs.yawV * 8.5) * dt;
    Cs.yaw += Cs.yawV * dt;
    // petit saut
    const hu = (t - Cs.hopT) / 0.34;
    Cs.hopY = hu >= 0 && hu < 1 ? 4 * Cs.hopH * hu * (1 - hu) : 0;
    // inertie du lancer, retour face caméra
    if (!Cs.drag && Math.abs(Cs.spin) > 0.02) { view.menuRotation += Cs.spin * dt; Cs.spin *= Math.exp(-dt * 2.4); Cs.lastAct = t; }
    const rot = view.menuRotation || 0, home = Math.round(rot / TAU) * TAU;
    if (Cs.face && !Cs.drag) {
      Cs.spin = 0;
      view.menuRotation = lerp(rot, home, damp(dt, 7));
      if (Math.abs(view.menuRotation - home) < 0.01) { view.menuRotation = home; Cs.face = false; }
    } else if (tab === "play" && !panel && !Cs.drag && Math.abs(Cs.spin) < 0.05 && t - Cs.lastAct > 6 && Math.abs(rot - home) > 0.004) {
      view.menuRotation = lerp(rot, home, damp(dt, 0.9));
    }
  }

  /* L'émote passe par le contrat public : l'état du joueur fourni à animateAvatar. */
  const prevAnimate = V.animateAvatar;
  V.animateAvatar = function (model, player, dt, options) {
    const L = this.v2Lobby, S = L && L.v94;
    if (!S || S.failed || !this.__v94Frame || !options || !options.menu || !model || !player) return prevAnimate.apply(this, arguments);
    let p = player, y0 = 0, mine = false;
    try {
      const t = this.time || 0;
      if (model === this.menuAvatar) {
        const Cs = S.c;
        model.rotation.y += Cs.yaw;
        model.position.y += Cs.hopY;
        const e = Cs.emote;
        if (e && t >= e.start && t < e.until && !(player.emote > 0) && !player.gliding) {
          p = Object.assign({}, player, { emote: Math.max(0.1, e.until - t), emoteDuration: e.len, emoteStyle: e.style });
          mine = true;
        }
      } else if (this.menuTeam && this.menuTeam.some((s) => s.avatar === model)) {
        let b = S.c.bots.get(model);
        if (!b) { b = { e: null, next: t + 6 + Math.random() * 10 }; S.c.bots.set(model, b); }
        if (S.ready && (!b.e || b.e.kind !== "ready")) b.e = { style: "victoire", kind: "ready", start: t + Math.random() * 0.4, until: t + 4.2, len: 4.2 };
        if (b.e && t >= b.e.until) { b.e = null; b.next = t + 14 + Math.random() * 12; }
        if (b.e && t >= b.e.start) { p = Object.assign({}, player, { emote: Math.max(0.1, b.e.until - t), emoteDuration: b.e.len, emoteStyle: b.e.style }); mine = true; }
      }
      y0 = model.position.y;
    } catch (err) { warn(err); }
    const r = prevAnimate.call(this, model, p, dt, options);
    // l'ancien squelette faisait sautiller le groupe pendant une émote : les clips ont leur propre mouvement
    if (mine && model.position.y > y0 + 0.03) model.position.y = y0 + 0.02;
    return r;
  };

  /* Bouton EMOTE du salon (ch1-lobby-v92 appelle view.playMenuEmote) : l'émote équipée, puis les
   * suivantes à chaque nouvel appui. */
  const STYLES = ["salut", "danse", "victoire", "robot", "etoile", "toupie"];
  V.playMenuEmote = function (id) {
    const L = this.v2Lobby, S = L && L.v94;
    if (!S || S.failed) return false;
    const t = this.time || 0, Cs = S.c;
    let style = null;
    const m = /^emote-(.+)$/.exec(String(id || ""));
    if (m && STYLES.includes(m[1])) style = m[1];
    if (!style) { let h = 0; for (const ch of String(id || "danse")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; style = STYLES[h % STYLES.length]; }
    if (t - Cs.btnT < 10) { Cs.btnI = (Cs.btnI + 1) % STYLES.length; style = STYLES[(STYLES.indexOf(style) + Cs.btnI) % STYLES.length]; } else Cs.btnI = 0;
    Cs.btnT = t;
    Cs.face = true; Cs.lastAct = t; Cs.hopT = t; Cs.hopH = 0.05;
    play(Cs, style, t, "button");
    S.flash = Math.max(S.flash, 0.5);
    try { const a = root.AZUR && root.AZUR.audio; if (a && a.ui) a.ui(); } catch (e) { /* son facultatif */ }
    return true;
  };

  /* ---------------------------------------------------------------- toucher, glisser, lancer */
  function avatarHit(view, cx, cy) {
    const a = view.menuAvatar, cam = view.menuCamera, cv = view.canvas;
    if (!a || !cam || !cv) return false;
    const rect = cv.getBoundingClientRect();
    const s = a.scale.x || 1;
    const foot = _v.copy(a.position).project(cam), fx = (foot.x * 0.5 + 0.5) * rect.width + rect.left, fy = (-foot.y * 0.5 + 0.5) * rect.height + rect.top;
    const head = _v.copy(a.position).add(_P.set(0, 2.05 * s, 0)).project(cam), hy = (-head.y * 0.5 + 0.5) * rect.height + rect.top;
    const half = Math.max(28, (fy - hy) * 0.26);
    return cy > hy - 10 && cy < fy + 10 && Math.abs(cx - fx) < half;
  }
  function hookPointer(view) {
    const cv = view.canvas;
    if (!cv || cv.__v94) return;
    cv.__v94 = true;
    let down = null;
    const S = () => view.v2Lobby && view.v2Lobby.v94;
    const menu = () => root.AZUR && root.AZUR.screen === "menu";
    cv.addEventListener("pointerdown", (e) => {
      const s = S(); if (!s || !menu()) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, lt: performance.now(), moved: 0, v: 0 };
      s.c.drag = true; s.c.spin = 0; s.c.face = false; s.c.lastAct = view.time || 0;
    }, { passive: true });
    cv.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== down.id) return;
      const nowT = performance.now(), dx = e.clientX - down.lx, dtm = Math.max(1, nowT - down.lt);
      down.moved += Math.abs(dx) + Math.abs(e.clientY - down.y) * 0.2;
      down.v = lerp(down.v, (dx / dtm) * 1000 * 0.009, 0.5); // rad/s, même gain que client.js
      down.lx = e.clientX; down.lt = nowT;
    }, { passive: true });
    const up = (e) => {
      const s = S();
      if (!down || e.pointerId !== down.id) return;
      const d = down; down = null;
      if (!s) return;
      s.c.drag = false; s.c.lastAct = view.time || 0;
      const quick = performance.now() - d.t < 450;
      if (d.moved < 10 && quick && e.type === "pointerup") { if (avatarHit(view, e.clientX, e.clientY)) react(view, s); }
      else if (performance.now() - d.lt < 90) s.c.spin = clamp(d.v, -9, 9);
    };
    cv.addEventListener("pointerup", up, { passive: true });
    cv.addEventListener("pointercancel", up, { passive: true });
    doc.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const s = S(); if (!s) return;
      s.pointer.x = clamp((e.clientX / Math.max(1, root.innerWidth)) * 2 - 1, -1, 1);
      s.pointer.y = clamp((e.clientY / Math.max(1, root.innerHeight)) * 2 - 1, -1, 1);
    }, { passive: true });
  }
  function react(view, S) {
    const t = view.time || 0, Cs = S.c;
    if (S.ready) return;
    Cs.face = true; Cs.lastAct = t; Cs.hopT = t; Cs.hopH = 0.08;
    const style = TAP_BAG[Cs.tapI++ % TAP_BAG.length];
    play(Cs, style, t, "tap");
    Cs.next = Math.max(Cs.next, t + 12);
    S.shockT = t;
    try { const a = root.AZUR && root.AZUR.audio; if (a && a.ui) a.ui(); } catch (e) { /* son facultatif */ }
  }

  /* ---------------------------------------------------------------- caméra : douceur + respiration */
  function hookRenderer(view) {
    const r = view.renderer;
    if (!r || r.__v94) return;
    r.__v94 = true;
    const base = r.render;
    r.render = function (scene, camera) {
      if (view.__v94Frame && scene === view.menuScene && camera === view.menuCamera) { try { cameraRig(view, camera); } catch (e) { warn(e); } }
      return base.apply(this, arguments);
    };
  }
  function cameraRig(view, cam) {
    const S = view.v2Lobby && view.v2Lobby.v94;
    if (!S) return;
    const R = S.cam, t = view.time || 0, gap = t - R.t;
    const dt = clamp(gap, 0, 0.1);
    R.t = t;
    const W = view.canvas.clientWidth, Hh = view.canvas.clientHeight;
    const vw = cam.view && cam.view.enabled ? cam.view : null, off = vw ? vw.offsetX : 0;
    _f.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const dist = Math.max(2, cam.position.distanceTo(_focus.set(0, 1.2, 0)));
    _L.copy(cam.position).addScaledVector(_f, dist);
    if (!R.init || gap > 0.5 || gap < 0 || R.w !== W || R.h !== Hh) {
      R.P.copy(cam.position); R.L.copy(_L); R.off = off; R.init = true; R.w = W; R.h = Hh;
    } else {
      const k = damp(dt, 4.2);
      R.P.lerp(cam.position, k); R.L.lerp(_L, k); R.off += (off - R.off) * k;
    }
    const still = reduceMotion();
    R.px += (S.pointer.x - R.px) * damp(dt, 2.5);
    R.py += (S.pointer.y - R.py) * damp(dt, 2.5);
    const amp = still ? 0 : S.tier === 0 ? 0.5 : 1;
    _P.copy(R.P);
    _P.x += (Math.sin(t * 0.23) * 0.07 + Math.sin(t * 0.51 + 1.3) * 0.02) * amp + R.px * 0.2 * (still ? 0 : 1);
    _P.y += Math.sin(t * 0.31 + 0.7) * 0.04 * amp - R.py * 0.08 * (still ? 0 : 1);
    R.push += (S.pushT - R.push) * damp(dt, 1.6);
    if (R.push > 0.0005) _P.lerp(R.L, R.push);
    cam.position.copy(_P);
    cam.lookAt(R.L);
    if (vw) cam.setViewOffset(vw.fullWidth, vw.fullHeight, R.off, vw.offsetY, vw.width, vw.height);
    cam.updateMatrixWorld();
  }

  /* ---------------------------------------------------------------- crochet principal */
  const prevDraw = V.drawMenu;
  V.drawMenu = function (world, player, dt, options) {
    const L = this.v2Lobby;
    if (L && L.v66 && L.v89 && L.v83 && !L.v94) {
      try { upgrade(this, L); } catch (e) { warn(e); L.v94 = { failed: true }; }
    }
    const S = L && L.v94;
    this.__v94Frame = false;
    if (S && !S.failed) {
      try { beforeFrame(this, S, dt, options || {}); this.__v94Frame = true; } catch (e) { warn(e); }
      if (this.renderer && !this.renderer.__v94) hookRenderer(this);
    }
    try { return prevDraw.apply(this, arguments); } finally { this.__v94Frame = false; }
  };

  /* ================================================================ interface (voir le .css) */
  const H = root.AZURHorizons;
  let lastKey = "", enterTimer = 0, goTimer = 0, wasReady = false;
  function onMenuRendered(g) {
    const body = doc.body;
    if (!body) return;
    const key = g.screen + "|" + g.tab;
    if (g.screen === "menu" && key !== lastKey) {
      body.classList.remove("v94-enter");
      void body.offsetWidth; // relance les animations d'entrée
      body.classList.add("v94-enter");
      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => body.classList.remove("v94-enter"), 1500);
    }
    lastKey = key;
    const ready = !!g.lobbyReady && g.screen === "menu";
    body.classList.toggle("v94-ready", ready);
    if (ready && !wasReady) {
      body.classList.add("v94-go");
      clearTimeout(goTimer);
      goTimer = setTimeout(() => body.classList.remove("v94-go"), 1100);
    }
    wasReady = ready;
    flipCountdown();
  }
  if (H && H.prototype && typeof H.prototype.renderMenu === "function" && !H.prototype.__v94Lobby) {
    const P = H.prototype;
    P.__v94Lobby = true;
    const prevRender = P.renderMenu;
    P.renderMenu = function () {
      const r = prevRender.apply(this, arguments);
      try { onMenuRendered(this); } catch (e) { warn(e); }
      return r;
    };
  }
  /* Compte à rebours : chaque chiffre qui change bascule (le texte reste celui de ch1-lobby-v92). */
  function flipify(b) {
    const s = b.textContent;
    if (b.__v94 === s && b.firstElementChild) return;
    const prev = b.__v94 || "";
    b.__v94 = s;
    let html = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      html += ch === ":" ? '<i class="v94-cs">:</i>' : `<i class="v94-dg${prev && prev[i] !== ch ? " v94-flip" : ""}">${ch === "<" || ch === "&" ? "" : ch}</i>`;
    }
    b.innerHTML = html;
  }
  function flipCountdown() {
    const b = doc.querySelector("#ui .ch1-countdown b");
    if (!b || b.__v94obs) return;
    b.__v94obs = new MutationObserver(() => flipify(b));
    b.__v94obs.observe(b, { childList: true });
    flipify(b);
  }
  setInterval(() => { const g = root.AZUR; if (g && g.screen === "menu") flipCountdown(); }, 500);
  // iOS n'applique :active qu'avec un écouteur tactile : retour visuel du bouton JOUER au doigt
  doc.addEventListener("touchstart", () => {}, { passive: true });

  root.AZURLobbyV94 = Object.freeze({
    version: "94.0.0",
    hooks: "AZView.View.drawMenu / animateAvatar / playMenuEmote, renderer.render (caméra du salon), AZURHorizons.renderMenu",
    contract: "animations : player.emote / player.emoteStyle uniquement (ch1-models-v93 choisit les clips)",
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
