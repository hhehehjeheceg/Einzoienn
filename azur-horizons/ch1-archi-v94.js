/* AZUR v94 — ch1-archi-v94.js : l'architecture des villes, dessinée bâtiment par bâtiment.
 * ch1-buildings-v93.js donne à chaque bâtiment un type (o._arch), un toit (o._roof) et un intérieur
 * (o._inside). Cette couche les dessine, sans rien changer aux collisions :
 *  - vingt modèles différents (tour en brique, tour de bureaux en verre, immeuble à balcons, rangée de
 *    boutiques, tour de l'horloge, maison de port à pignon, entrepôt en tôle, maison de banlieue à
 *    porche, maison en brique à toit en croupe, chalet, cabane en rondins, ferme, grange, maison en
 *    adobe, diner, motel, villa de bord de mer, immeuble pastel, laboratoire, pagode) ;
 *  - vraies baies ouvertes (on voit dedans et dehors), vitres qui reflètent le ciel, volets, rideaux,
 *    jardinières, enseignes et panneaux (textes originaux), auvents rayés, porches, balcons,
 *    escaliers de secours, châteaux d'eau, cheminées, coupoles ;
 *  - matières dessinées par le shader, sans texture : brique, bardage à clins, bardeaux, tuiles,
 *    tôle ondulée, crépi, pierre, rondins, planches, béton, parquet, carrelage, moquette ;
 *  - intérieurs meublés selon le type (salon, chambre, cuisine, bureaux, boutique, entrepôt, grange,
 *    diner, labo, salon de thé), masqués au-delà de quelques dizaines de mètres ;
 *  - au loin, une silhouette par type de toit (instances) au lieu des simples boîtes.
 * Un seul matériau pour presque tout (couleurs et motifs par sommet) : un appel de dessin par
 * bâtiment pour l'extérieur, un pour les vitres, un pour l'intérieur.
 * À charger après ch1-buildings-v93.js. */
(function (root) {
  "use strict";
  const T = root.THREE, S = root.AZSim, A = root.AZArt;
  const VP = root.AZView && root.AZView.View && root.AZView.View.prototype;
  if (!T || !S || !A || !A.objectModel || A.__ch1Archi) return;
  A.__ch1Archi = true;
  const FLOOR = 4, RB = .45, TAU = Math.PI * 2;
  const hash = (n) => { let x = (n | 0) ^ 0x5bd1e995; x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39); return ((x ^ (x >>> 15)) >>> 0) / 4294967296; };
  function rng(seed) { let a = (seed | 0) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const CC = new Map();
  function col(h) { let c = CC.get(h); if (!c) { const k = new T.Color(h); c = [k.r, k.g, k.b]; CC.set(h, c); } return c; }
  // surface : couleur + motif (+ coordonnées d'atlas pour les enseignes)
  const SF = new Map();
  function sf(hex, pat) { const k = hex + "|" + (pat || 0); let s = SF.get(k); if (!s) SF.set(k, (s = { c: col(hex), p: pat || 0 })); return s; }
  const P = { plain: 0, brick: 1, siding: 2, shingle: 3, panel: 4, plank: 5, metal: 6, stucco: 7, stone: 8, tile: 9, log: 10, parquet: 11, checker: 12, carpet: 13, roller: 14, spandrel: 15, paper: 16, gravel: 17, paver: 18, lit: 20, glow: 21, sign: 22, ceil: 40 };

  /* ============================================================ atlas : enseignes, horloge */
  const SIGNS = [
    ["ÉPICERIE", "#2f8f5b", "#fff6d8"], ["BOULANGERIE", "#c9873a", "#ffffff"], ["CAFÉ AZUR", "#1f6fa8", "#ffffff"], ["PIZZA SOLEIL", "#d94a2b", "#ffe066"],
    ["LIBRAIRIE", "#6b4a8f", "#ffffff"], ["PHARMACIE", "#1d9c5a", "#ffffff"], ["QUINCAILLERIE", "#e0b43a", "#2b2b2b"], ["CINÉMA", "#9a1f3a", "#ffd76a"],
    ["BURGER BOUM", "#f2a43a", "#7a1f12"], ["TACOS TONNERRE", "#2b9a8f", "#ffef9a"], ["DINER 24/24", "#e8455e", "#ffffff"], ["MOTEL ÉTOILE", "#203a6e", "#ffd84a"],
    ["ENTREPÔT 1", "#ece6d6", "#2b2b2b"], ["ENTREPÔT 2", "#f2c14e", "#2b2b2b"], ["ENTREPÔT 3", "#ece6d6", "#9a2f1f"], ["ENTREPÔT 4", "#3a5a6a", "#ffffff"],
    ["POISSONNERIE", "#2c6fa0", "#ffffff"], ["GLACES", "#f49ac1", "#ffffff"], ["HÔTEL", "#2a2a3a", "#f4d27a"], ["BANQUE", "#3a4f63", "#e9e2c8"],
    ["LABO", "#e9eef2", "#2c6fa0"], ["SURF CLUB", "#26b0b8", "#ffffff"], ["BEIGNETS", "#f27ab0", "#ffffff"], ["FLEURS", "#7fbf5a", "#ffffff"],
    ["SODA BULLE", "#e63946", "#ffffff"], ["AZUR FM 98.4", "#1d3557", "#ffd166"], ["VISITEZ LA CITADELLE", "#ffb703", "#1d3557"], ["PNEUS & CO", "#333333", "#ffcc00"],
    ["SALON DE THÉ", "#8b2f2f", "#f4e2b8"], ["LANTERNES", "#b8372f", "#ffd76a"], ["BAZAR", "#ef8a17", "#ffffff"], ["MUSÉE", "#e9e2c8", "#3a2f2a"],
    ["GARAGE", "#c0392b", "#ffffff"], ["FERME AURORE", "#7a3a20", "#ffe6b0"], ["MARCHÉ", "#3d8b4f", "#ffffff"], ["OPTICIEN", "#2a6f97", "#ffffff"],
    ["JOUETS", "#ff6f59", "#ffffff"], ["SPORTS", "#1b998b", "#ffffff"], ["BIJOUX", "#5c3d8c", "#f6e7a8"], ["LAVERIE", "#5bc0eb", "#ffffff"],
    ["CAFÉ DU PORT", "#14506e", "#f6d365"], ["CHAMBRES", "#3b2f5c", "#ffd1e8"], ["OBSERVATOIRE", "#24324a", "#bfe3ff"], ["SNACK", "#f25c54", "#ffffff"],
  ];
  const SIGN = {}; SIGNS.forEach((s, i) => { SIGN[s[0]] = i; });
  const SHOPS = ["ÉPICERIE", "BOULANGERIE", "CAFÉ AZUR", "PIZZA SOLEIL", "LIBRAIRIE", "PHARMACIE", "QUINCAILLERIE", "CINÉMA", "BURGER BOUM", "TACOS TONNERRE", "GLACES", "BANQUE", "FLEURS", "BAZAR", "OPTICIEN", "JOUETS", "SPORTS", "BIJOUX", "LAVERIE", "SNACK", "MARCHÉ"];
  const ADS = ["SODA BULLE", "AZUR FM 98.4", "VISITEZ LA CITADELLE", "PNEUS & CO"];
  const AW = 1024, CELL_W = 256, CELL_H = 64, SQ = 192, SQ_Y = 832;
  let ATLAS = null;
  function atlas() {
    if (ATLAS) return ATLAS;
    const cv = document.createElement("canvas"); cv.width = AW; cv.height = AW;
    const x = cv.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 64, 64);
    const font = (px) => "900 " + px + "px Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
    SIGNS.forEach((s, i) => {
      const cx = (i % 4) * CELL_W, cy = CELL_H + Math.floor(i / 4) * CELL_H;
      x.fillStyle = s[1]; x.fillRect(cx + 2, cy + 2, CELL_W - 4, CELL_H - 4);
      x.strokeStyle = s[2]; x.globalAlpha = .55; x.lineWidth = 3; x.strokeRect(cx + 7, cy + 7, CELL_W - 14, CELL_H - 14); x.globalAlpha = 1;
      let px = 40; x.font = font(px);
      while (px > 14 && x.measureText(s[0]).width > CELL_W - 30) { px -= 2; x.font = font(px); }
      x.fillStyle = "rgba(0,0,0,.25)"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(s[0], cx + CELL_W / 2 + 2, cy + CELL_H / 2 + 3);
      x.fillStyle = s[2]; x.fillText(s[0], cx + CELL_W / 2, cy + CELL_H / 2 + 1);
    });
    // horloge
    let cx = 0 + SQ / 2, cy = SQ_Y + SQ / 2;
    x.fillStyle = "#3b3226"; x.fillRect(0, SQ_Y, SQ, SQ);
    x.fillStyle = "#f6efd9"; x.beginPath(); x.arc(cx, cy, 86, 0, TAU); x.fill();
    x.strokeStyle = "#3b3226"; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, 80, 0, TAU); x.stroke();
    for (let k = 0; k < 60; k++) { const a = k / 60 * TAU, r0 = k % 5 ? 72 : 62; x.lineWidth = k % 5 ? 2 : 6; x.beginPath(); x.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); x.lineTo(cx + Math.sin(a) * 77, cy - Math.cos(a) * 77); x.stroke(); }
    // croix de pharmacie, étoile, cible, soleil
    cx = SQ + SQ / 2;
    x.fillStyle = "#16a05a"; x.fillRect(SQ + 20, SQ_Y + 20, SQ - 40, SQ - 40); x.fillStyle = "#ffffff"; x.fillRect(cx - 18, cy - 62, 36, 124); x.fillRect(cx - 62, cy - 18, 124, 36);
    cx = 2 * SQ + SQ / 2; x.fillStyle = "#203a6e"; x.fillRect(2 * SQ, SQ_Y, SQ, SQ); x.fillStyle = "#ffd84a"; x.beginPath();
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, r = k % 2 ? 34 : 82; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill();
    cx = 3 * SQ + SQ / 2; ["#e63946", "#ffffff", "#e63946", "#ffffff", "#e63946"].forEach((c, k) => { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, 90 - k * 18, 0, TAU); x.fill(); });
    cx = 4 * SQ + SQ / 2; x.fillStyle = "#ffb703"; x.fillRect(4 * SQ, SQ_Y, SQ, SQ); x.fillStyle = "#fb8500"; x.beginPath(); x.arc(cx, cy, 52, 0, TAU); x.fill();
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; x.save(); x.translate(cx, cy); x.rotate(a); x.fillRect(-6, -90, 12, 30); x.restore(); }
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    ATLAS = tex; return tex;
  }
  const WHITE_UV = [32 / AW, 1 - 32 / AW];
  function signUV(i) { const cx = (i % 4) * CELL_W, cy = CELL_H + Math.floor(i / 4) * CELL_H; return [(cx + 4) / AW, 1 - (cy + CELL_H - 4) / AW, (cx + CELL_W - 4) / AW, 1 - (cy + 4) / AW]; }
  function squareUV(k) { const cx = k * SQ, cy = SQ_Y; return [(cx + 3) / AW, 1 - (cy + SQ - 3) / AW, (cx + SQ - 3) / AW, 1 - (cy + 3) / AW]; }

  /* ============================================================ matériaux */
  const U = { night: { value: 0 } };
  const PAT_GLSL = `
varying float vAzP; varying vec3 vAzW; varying vec3 vAzN;
uniform float uAzNight;
float azH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float azN2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(azH(i),azH(i+vec2(1.,0.)),f.x),mix(azH(i+vec2(0.,1.)),azH(i+vec2(1.,1.)),f.x),f.y);}
float azPx;
float azFd(float s){return 1.-smoothstep(s*.1,s*.42,azPx);}
vec3 azPattern(float id,vec3 W,vec3 N,inout float rough,inout vec3 tilt){
  if(id<.5||id>19.5)return vec3(1.);
  vec3 an=abs(N);vec2 uv;vec3 tu;
  if(an.y>.2&&an.y<.995){vec2 h=normalize(N.xz);float sn=sqrt(max(1.-N.y*N.y,.02));uv=vec2(dot(W.xz,vec2(-h.y,h.x)),W.y/sn);tu=vec3(-h.y,0.,h.x);}
  else if(an.y>=.995){uv=W.xz;tu=vec3(1.,0.,0.);}
  else if(an.x>an.z){uv=vec2(W.z,W.y);tu=vec3(0.,0.,1.);}
  else{uv=vec2(W.x,W.y);tu=vec3(1.,0.,0.);}
  vec3 tv=normalize(vec3(0.,1.,0.)-N*N.y+vec3(0.,.0001,0.));
  vec3 m=vec3(1.);float fd=1.;
  if(id<1.5){vec2 b=uv/vec2(.6,.25);float r=floor(b.y);b.x+=mod(r,2.)*.5;vec2 f=fract(b),c=floor(b);float mo=max(step(f.y,.14),step(f.x,.06));
    m=vec3(mix(.84+.26*azH(c+r*7.),.66,mo))*(.93+.12*azN2(uv*2.3));fd=azFd(.25);rough=.93;tilt=-tv*(step(f.y,.14)-.5)*.0;}
  else if(id<2.5){float y=uv.y/.26,f=fract(y);m=vec3(.82+.22*f)*mix(.72,1.,smoothstep(0.,.1,f))*(.96+.07*azH(vec2(floor(y),floor(uv.x/3.2))));tilt=tv*(f-.5)*.6;fd=azFd(.26);rough=.78;}
  else if(id<3.5){float y=uv.y/.34,r=floor(y);float x=uv.x/.42+mod(r,2.)*.5;vec2 c=vec2(floor(x),r);float fy=fract(y),fx=fract(x);
    m=vec3(.78+.28*azH(c))*mix(.62,1.,smoothstep(0.,.2,fy))*mix(.78,1.,smoothstep(0.,.06,fx));tilt=tv*(fy-.5)*.55;fd=azFd(.34);rough=.95;}
  else if(id<4.5){vec2 f=fract(uv/vec2(2.,1.333));float s=max(step(f.x,.012),step(f.y,.02));m=vec3((.94+.09*azN2(uv*1.7))*mix(1.,.7,s));fd=azFd(1.);rough=.9;}
  else if(id<5.5){float x=uv.x/.3,f=fract(x);m=vec3(.82+.22*azH(vec2(floor(x),floor(uv.y/2.7+azH(vec2(floor(x),3.))))))*mix(.58,1.,smoothstep(0.,.08,f))*(.95+.1*azN2(vec2(uv.x*8.,uv.y*.6)));tilt=tu*(f-.5)*.3;fd=azFd(.3);rough=.88;}
  else if(id<6.5){float s=sin(uv.x*41.9);m=vec3(.9+.12*s)*(.95+.08*azN2(uv*vec2(.5,2.)));tilt=tu*cos(uv.x*41.9)*.5;fd=azFd(.15);rough=.5;}
  else if(id<7.5){m=vec3(.92+.1*azN2(uv*4.)+.05*azN2(uv*17.));fd=azFd(.2);rough=.95;}
  else if(id<8.5){vec2 b=uv/vec2(.9,.45);float r=floor(b.y);b.x+=azH(vec2(r,3.))*.7;vec2 f=fract(b),c=floor(b);float mo=max(step(f.y,.08),step(f.x,.04));m=vec3(mix(.82+.24*azH(c),.6,mo))*(.92+.12*azN2(uv*3.));fd=azFd(.45);rough=.95;}
  else if(id<9.5){float x=uv.x/.36,y=uv.y/.48;float fx=fract(x),fy=fract(y);float c=cos((fx-.5)*3.14159);m=vec3(.7+.32*c)*mix(.66,1.,smoothstep(0.,.14,fy))*(.92+.14*azH(vec2(floor(x),floor(y))));tilt=tu*(fx-.5)*.8;fd=azFd(.36);rough=.85;}
  else if(id<10.5){float y=uv.y/.34,f=fract(y),c=sin(f*3.14159);m=vec3(.62+.42*c)*(.9+.12*azN2(vec2(uv.x*1.5,floor(y)*3.)));tilt=tv*(f-.5)*.9;fd=azFd(.34);rough=.9;}
  else if(id<11.5){vec2 b=uv/vec2(.2,1.2);b.y+=azH(vec2(floor(b.x),1.));vec2 f=fract(b),c=floor(b);m=vec3(.84+.22*azH(c))*mix(.74,1.,smoothstep(0.,.25,min(f.x,1.-f.x)*4.));fd=azFd(.2);rough=.55;}
  else if(id<12.5){vec2 c=floor(uv/.5);float k=mod(c.x+c.y,2.);vec2 f=fract(uv/.5);float j=max(step(f.x,.03),step(f.y,.03));m=vec3(mix(mix(.32,1.1,k),.8,j));fd=azFd(.5);rough=.3;}
  else if(id<13.5){m=vec3(.9+.14*azN2(uv*9.));fd=azFd(.1);rough=1.;}
  else if(id<14.5){float f=fract(uv.y/.22);m=vec3(.84+.2*f)*mix(.68,1.,smoothstep(0.,.12,f));tilt=tv*(f-.5)*.5;fd=azFd(.22);rough=.55;}
  else if(id<15.5){vec2 f=fract(uv/vec2(1.5,4.));float mul=max(step(f.x,.035),step(f.y,.025));m=mix(vec3(.75+.5*f.y),vec3(1.5),mul);fd=azFd(1.5);rough=.15;}
  else if(id<16.5){m=vec3(.93+.09*step(.5,fract(uv.x/.32)));fd=azFd(.32);rough=.9;}
  else if(id<17.5){m=vec3(.9+.12*azN2(uv*6.)+.07*azH(floor(uv*40.)));fd=azFd(.15);rough=1.;}
  else if(id<18.5){vec2 f=fract(uv/.8),c=floor(uv/.8);float j=max(step(f.x,.05),step(f.y,.05));m=vec3(mix(.86+.2*azH(c),.64,j));fd=azFd(.8);rough=.9;}
  tilt*=fd;
  return mix(vec3(1.),m,fd)*(.95+.09*azN2(W.xz*.07+W.y*.05));
}
vec3 azLod(vec3 W,vec3 N){
  vec3 an=abs(N);if(an.y>.6)return vec3(.92+.1*azN2(W.xz*.5));
  float u=an.x>an.z?W.z:W.x;float fy=fract(W.y/4.),fu=fract(u/2.7);
  float win=step(.24,fy)*step(fy,.7)*step(.22,fu)*step(fu,.78);
  float fd=1.-smoothstep(.25,1.,azPx);
  float lit=step(.84,azH(floor(vec2(u/2.7,W.y/4.))))*uAzNight;
  vec3 w=mix(vec3(.36,.47,.6),vec3(2.4,1.9,1.1),lit);
  return mix(vec3(.82),mix(vec3(1.),w,win),fd)*(.94+.1*azN2(W.xz*.05));
}`;
  function patch(mat, lod) {
    mat.extensions = { derivatives: true };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uAzNight = U.night;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float azPat;\nvarying float vAzP; varying vec3 vAzW; varying vec3 vAzN;")
        .replace("#include <project_vertex>", `#include <project_vertex>
  vAzP = azPat;
  vec4 azWp = vec4(transformed, 1.0);
  vec3 azNo = objectNormal;
  #ifdef USE_INSTANCING
  azWp = instanceMatrix * azWp; azNo = mat3(instanceMatrix) * azNo;
  #endif
  vAzW = (modelMatrix * azWp).xyz; vAzN = normalize(mat3(modelMatrix) * azNo);`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + PAT_GLSL)
        .replace("#include <color_fragment>", `#include <color_fragment>
  azPx = length(fwidth(vAzW));
  float azR = -1.; vec3 azT = vec3(0.);
  ${lod ? "if (vAzP > 29.5) diffuseColor.rgb *= azLod(vAzW, normalize(vAzN)); else " : ""}diffuseColor.rgb *= azPattern(vAzP, vAzW, normalize(vAzN), azR, azT);`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  if (azR >= 0.) roughnessFactor = azR;")
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n  normal = normalize(normal + (viewMatrix * vec4(azT, 0.)).xyz);")
        .replace("#include <opaque_fragment>", `if (vAzP > 19.5 && vAzP < 22.5) { float azK = vAzP > 21.5 ? .25 : vAzP > 20.5 ? 1. : .8; outgoingLight = mix(outgoingLight, diffuseColor.rgb * (vAzP > 20.5 && vAzP < 21.5 ? 1.7 : 1.3), azK * mix(.5, 1., uAzNight)); }
  else if (vAzP > 39.5) outgoingLight = diffuseColor.rgb * mix(.86, .42, uAzNight);
  #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => "azArchi" + (lod ? "L" : "");
    return mat;
  }
  let MAT = null, GLASS = null, LODMAT = null, HANDS = null;
  function mats() {
    if (MAT) return;
    MAT = patch(new T.MeshStandardMaterial({ vertexColors: true, map: atlas(), roughness: .85, metalness: 0 }), false);
    LODMAT = patch(new T.MeshStandardMaterial({ vertexColors: true, map: atlas(), roughness: .9, metalness: 0 }), true);
    GLASS = new T.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .4, roughness: .06, metalness: .25, depthWrite: false });
    GLASS.onBeforeCompile = (sh) => {
      sh.uniforms.uAzNight = U.night;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uAzNight;")
        .replace("#include <opaque_fragment>", `vec3 azV = normalize(vViewPosition); float azF = pow(1. - abs(dot(azV, normal)), 3.);
  vec3 azSky = mix(vec3(.5, .72, .9), vec3(.96, .98, 1.), azF) * mix(1., .14, uAzNight);
  outgoingLight = mix(outgoingLight, azSky * diffuseColor.rgb * 1.25, .5 + .35 * azF); diffuseColor.a = mix(.3, .86, azF);
  #include <opaque_fragment>`);
    };
    GLASS.customProgramCacheKey = () => "azGlass";
    HANDS = new T.MeshBasicMaterial({ color: 0x1e1a14 });
  }

  /* ============================================================ émetteur de triangles */
  class Geo {
    constructor(cap) { this.n = 0; this.cap = cap || 4096; this.P = new Float32Array(this.cap * 3); this.N = new Float32Array(this.cap * 3); this.C = new Float32Array(this.cap * 3); this.K = new Float32Array(this.cap); this.UV = new Float32Array(this.cap * 2); }
    need(k) {
      if (this.n + k <= this.cap) return;
      let c = this.cap * 2; while (c < this.n + k) c *= 2;
      const g = (a, s) => { const b = new Float32Array(c * s); b.set(a); return b; };
      this.P = g(this.P, 3); this.N = g(this.N, 3); this.C = g(this.C, 3); this.K = g(this.K, 1); this.UV = g(this.UV, 2); this.cap = c;
    }
    v(x, y, z, nx, ny, nz, s, u, w, sh) {
      const i = this.n++, c = s.c, k = sh == null ? 1 : sh;
      this.P[i * 3] = x; this.P[i * 3 + 1] = y; this.P[i * 3 + 2] = z;
      this.N[i * 3] = nx; this.N[i * 3 + 1] = ny; this.N[i * 3 + 2] = nz;
      this.C[i * 3] = c[0] * k; this.C[i * 3 + 1] = c[1] * k; this.C[i * 3 + 2] = c[2] * k; this.K[i] = s.p;
      this.UV[i * 2] = u == null ? WHITE_UV[0] : u; this.UV[i * 2 + 1] = w == null ? WHITE_UV[1] : w;
    }
    // quadrilatère a b c d (sens trigonométrique vu de l'extérieur), normale calculée
    quad(a, b, c, d, s, uv, sh) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      this.need(6);
      const U0 = uv ? uv[0] : null, V0 = uv ? uv[1] : null, U1 = uv ? uv[2] : null, V1 = uv ? uv[3] : null;
      this.v(a[0], a[1], a[2], nx, ny, nz, s, U0, V0, sh); this.v(b[0], b[1], b[2], nx, ny, nz, s, U1, V0, sh); this.v(c[0], c[1], c[2], nx, ny, nz, s, U1, V1, sh);
      this.v(a[0], a[1], a[2], nx, ny, nz, s, U0, V0, sh); this.v(c[0], c[1], c[2], nx, ny, nz, s, U1, V1, sh); this.v(d[0], d[1], d[2], nx, ny, nz, s, U0, V1, sh);
    }
    // quadrilatère ou triangle dont la normale est retournée si besoin pour suivre la direction ref
    oq(a, b, c, d, s, ref, uv) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) this.quad(b, a, d, c, s, uv); else this.quad(a, b, c, d, s, uv);
    }
    ot(a, b, c, s, ref) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) this.tri(a, c, b, s); else this.tri(a, b, c, s);
    }
    tri(a, b, c, s) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      this.need(3); this.v(a[0], a[1], a[2], nx, ny, nz, s); this.v(b[0], b[1], b[2], nx, ny, nz, s); this.v(c[0], c[1], c[2], nx, ny, nz, s);
    }
    poly(pts, s) { for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], s); }
    // boîte alignée ; f : surface ou tableau de 6 surfaces [+x,-x,+y,-y,+z,-z] (null = face omise)
    box(x0, y0, z0, x1, y1, z1, f, skip) {
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; } if (y0 > y1) { const t = y0; y0 = y1; y1 = t; } if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
      const F = Array.isArray(f) ? f : null, sk = skip | 0;
      const s = (i) => (sk & (1 << i) ? null : F ? F[i] : f);
      let q;
      if ((q = s(0))) this.face(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, q);
      if ((q = s(1))) this.face(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, q);
      if ((q = s(2))) this.face(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0, q);
      if ((q = s(3))) this.face(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0, q);
      if ((q = s(4))) this.face(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, q);
      if ((q = s(5))) this.face(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, q);
    }
    face(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, s) {
      this.need(6);
      this.v(ax, ay, az, nx, ny, nz, s); this.v(bx, by, bz, nx, ny, nz, s); this.v(cx, cy, cz, nx, ny, nz, s);
      this.v(ax, ay, az, nx, ny, nz, s); this.v(cx, cy, cz, nx, ny, nz, s); this.v(dx, dy, dz, nx, ny, nz, s);
    }
    // boîte orientée : centre, demi-tailles, rotation autour de Y (yaw) puis inclinaison autour de son X local (pitch)
    obox(cx, cy, cz, hx, hy, hz, yaw, pitch, f) {
      const cyw = Math.cos(yaw || 0), syw = Math.sin(yaw || 0), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
      const ex = [cyw, 0, -syw], ey = [syw * sp, cp, cyw * sp], ez = [syw * cp, -sp, cyw * cp];
      const P0 = (a, b, c) => [cx + ex[0] * a * hx + ey[0] * b * hy + ez[0] * c * hz, cy + ex[1] * a * hx + ey[1] * b * hy + ez[1] * c * hz, cz + ex[2] * a * hx + ey[2] * b * hy + ez[2] * c * hz];
      const F = Array.isArray(f) ? f : [f, f, f, f, f, f];
      if (F[0]) this.quad(P0(1, -1, 1), P0(1, -1, -1), P0(1, 1, -1), P0(1, 1, 1), F[0]);
      if (F[1]) this.quad(P0(-1, -1, -1), P0(-1, -1, 1), P0(-1, 1, 1), P0(-1, 1, -1), F[1]);
      if (F[2]) this.quad(P0(-1, 1, 1), P0(1, 1, 1), P0(1, 1, -1), P0(-1, 1, -1), F[2]);
      if (F[3]) this.quad(P0(-1, -1, -1), P0(1, -1, -1), P0(1, -1, 1), P0(-1, -1, 1), F[3]);
      if (F[4]) this.quad(P0(-1, -1, 1), P0(1, -1, 1), P0(1, 1, 1), P0(-1, 1, 1), F[4]);
      if (F[5]) this.quad(P0(1, -1, -1), P0(-1, -1, -1), P0(-1, 1, -1), P0(1, 1, -1), F[5]);
    }
    // cylindre vertical (r0 en bas, r1 en haut), normales lisses
    cyl(cx, y0, cz, r0, r1, y1, seg, s, caps) {
      seg = seg || 10; this.need(seg * 12);
      const dr = r0 - r1, hl = Math.hypot(dr, y1 - y0) || 1, ny = dr / hl, nk = (y1 - y0) / hl;
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        this.v(cx + c0 * r0, y0, cz + s0 * r0, c0 * nk, ny, s0 * nk, s); this.v(cx + c1 * r1, y1, cz + s1 * r1, c1 * nk, ny, s1 * nk, s); this.v(cx + c1 * r0, y0, cz + s1 * r0, c1 * nk, ny, s1 * nk, s);
        this.v(cx + c0 * r0, y0, cz + s0 * r0, c0 * nk, ny, s0 * nk, s); this.v(cx + c0 * r1, y1, cz + s0 * r1, c0 * nk, ny, s0 * nk, s); this.v(cx + c1 * r1, y1, cz + s1 * r1, c1 * nk, ny, s1 * nk, s);
        if (caps !== false && r1 > 0) { this.v(cx, y1, cz, 0, 1, 0, s); this.v(cx + c1 * r1, y1, cz + s1 * r1, 0, 1, 0, s); this.v(cx + c0 * r1, y1, cz + s0 * r1, 0, 1, 0, s); }
      }
    }
    // cylindre couché le long de X ou de Z
    hcyl(cx, cy, cz, r, len, axis, seg, s) {
      seg = seg || 8; this.need(seg * 12);
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p = (c, sn, t) => (axis === "x" ? [cx + t, cy + sn * r, cz + c * r] : [cx + c * r, cy + sn * r, cz + t]);
        const n = (c, sn) => (axis === "x" ? [0, sn, c] : [c, sn, 0]);
        const A0 = p(c0, s0, -len / 2), A1 = p(c1, s1, -len / 2), B0 = p(c0, s0, len / 2), B1 = p(c1, s1, len / 2), n0 = n(c0, s0), n1 = n(c1, s1);
        const V = (q, nn) => this.v(q[0], q[1], q[2], nn[0], nn[1], nn[2], s);
        if (axis === "x") { V(A0, n0); V(B1, n1); V(A1, n1); V(A0, n0); V(B0, n0); V(B1, n1); }
        else { V(A0, n0); V(A1, n1); V(B1, n1); V(A0, n0); V(B1, n1); V(B0, n0); }
      }
    }
    dome(cx, cy, cz, r, seg, rings, s) {
      seg = seg || 14; rings = rings || 6; this.need(seg * rings * 6);
      for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
        const t0 = j / rings * Math.PI / 2, t1 = (j + 1) / rings * Math.PI / 2, a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
        const P1 = (t, a) => [Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)];
        const q = [P1(t0, a0), P1(t0, a1), P1(t1, a1), P1(t1, a0)];
        const V = (k) => this.v(cx + q[k][0] * r, cy + q[k][1] * r, cz + q[k][2] * r, q[k][0], q[k][1], q[k][2], s);
        V(0); V(2); V(1); V(0); V(3); V(2);
      }
    }
    torus(cx, cy, cz, R, r, su, sv, s) {
      su = su || 18; sv = sv || 8; this.need(su * sv * 6);
      const pt = (i, j) => { const u = i / su * TAU, v = j / sv * TAU, cu = Math.cos(u), snu = Math.sin(u), cv = Math.cos(v), svv = Math.sin(v); return [[cx + (R + r * cv) * cu, cy + r * svv, cz + (R + r * cv) * snu], [cv * cu, svv, cv * snu]]; };
      for (let i = 0; i < su; i++) for (let j = 0; j < sv; j++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
        const V = (q) => this.v(q[0][0], q[0][1], q[0][2], q[1][0], q[1][1], q[1][2], s);
        V(a); V(c); V(b); V(a); V(d); V(c);
      }
    }
    geometry() {
      const n = this.n, g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(this.P.slice(0, n * 3), 3));
      g.setAttribute("normal", new T.BufferAttribute(this.N.slice(0, n * 3), 3));
      g.setAttribute("color", new T.BufferAttribute(this.C.slice(0, n * 3), 3));
      g.setAttribute("uv", new T.BufferAttribute(this.UV.slice(0, n * 2), 2));
      g.setAttribute("azPat", new T.BufferAttribute(this.K.slice(0, n), 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  }

  /* ============================================================ repère d'une façade */
  // côté : N (z = -d, vers -z), S (z = +d), E (x = +w), W (x = -w) ; u le long de la façade, n vers l'extérieur
  function sides(o) {
    const w = o.w, d = o.d;
    return [
      { k: "N", L: w + .2, out: 5, inn: 4, map: (u, n) => [u, -d - n], yaw: Math.PI, nrm: [0, -1] },
      { k: "S", L: w + .2, out: 4, inn: 5, map: (u, n) => [-u, d + n], yaw: 0, nrm: [0, 1] },
      { k: "E", L: d - .2, out: 0, inn: 1, map: (u, n) => [w + n, u], yaw: Math.PI / 2, nrm: [1, 0] },
      { k: "W", L: d - .2, out: 1, inn: 0, map: (u, n) => [-w - n, -u], yaw: -Math.PI / 2, nrm: [-1, 0] },
    ];
  }
  // boîte posée sur une façade : u0..u1 le long, v0..v1 en hauteur, n0..n1 hors du mur
  // sIn === null : face intérieure omise (pièces collées au mur)
  function sbox(g, sd, u0, u1, v0, v1, n0, n1, sOut, sIn, sEdge) {
    const a = sd.map(u0, n0), b = sd.map(u1, n1), F = [sEdge, sEdge, sEdge, sEdge, sEdge, sEdge];
    F[sd.out] = sOut; F[sd.inn] = sIn === undefined ? sEdge : sIn;
    g.box(a[0], v0, a[1], b[0], v1, b[1], F);
  }
  // quadrilatère sur une façade (vers l'extérieur), avec coordonnées d'atlas éventuelles.
  // Vu de dehors, u croît vers la gauche : on part donc de u1 pour que les textes se lisent.
  function squad(g, sd, u0, u1, v0, v1, n, s, uv) {
    const a = sd.map(u0, n), b = sd.map(u1, n);
    g.quad([b[0], v0, b[1]], [a[0], v0, a[1]], [a[0], v1, a[1]], [b[0], v1, b[1]], s, uv);
  }
  const UD = { N: [1, 0], S: [-1, 0], E: [0, 1], W: [0, -1] };
  // point sur la façade → coordonnées locales
  function spt(sd, u, v, n) { const a = sd.map(u, n); return [a[0], v, a[1]]; }

  /* ============================================================ palettes */
  const pickOf = (r, a) => a[Math.floor(r() * a.length) % a.length];
  const WOOD = "#8a5a36", DARK = "#2e3238", WHITE = "#f4f1e8", CREAM = "#efe6cf", GLASS_C = ["#9fd0e6", "#a8d8e0", "#94bfd8", "#b2dcd2"];
  const CURTAIN = ["#d9534f", "#f0ad4e", "#5bc0de", "#e6e0cf", "#9b7fc8", "#7fbf7f", "#f2a2c0"];

  /* ============================================================ styles par type */
  // Chaque fonction rend un objet style (st) lu par le constructeur générique, plus des ajouts propres.
  const STYLES = {};
  STYLES.tower = (o, r) => {
    const brick = pickOf(r, ["#9c4a3a", "#8a4a36", "#b05d3b", "#7d3f33", "#a8674a"]), trim = pickOf(r, [CREAM, "#e3d6b8", "#d8d0c0"]);
    return { wall: sf(brick, P.brick), groundWall: sf(pickOf(r, ["#b9ae9b", "#a79f90"]), P.stone), inner: sf(pickOf(r, ["#e9e2d0", "#dfe6e8", "#efe1cf"]), P.paper), jamb: sf(trim), trim, bay: 2.6,
      win: { w: 1.25, s: .95, h: 2.85, frame: WHITE, mull: "cross", sill: trim, hood: trim },
      gwin: { w: 2.1, s: .4, h: 3.0, frame: DARK, mull: "v", shop: true },
      band: { col: trim, every: 1, h: .16, out: .1 }, cornice: { col: trim, h: .7, out: .45 }, corner: { col: trim, w: .5, out: .07, pat: P.stone },
      awning: true, signs: true, fireEscape: r() < .6, tank: o.floors >= 7 && r() < .8, roofCol: "#7a7f84", plinth: sf("#8f8778", P.stone) };
  };
  STYLES.office = (o, r) => {
    const glass = pickOf(r, ["#5f9fc4", "#5c8f9a", "#7aa7b8", "#6f8fb5", "#4f8f8a"]), frame = pickOf(r, ["#d9dde0", "#2f3a44", "#c8ccd0"]);
    return { wall: sf(frame, P.panel), inner: sf("#e8ecef", P.plain), jamb: sf(frame), trim: frame, bay: 1.95, glass,
      win: { w: 1.8, s: .25, h: 3.72, frame, mull: "none", thin: true }, gwin: { w: 1.82, s: .05, h: 3.75, frame: DARK, mull: "none", thin: true },
      band: { col: pickOf(r, ["#c9ccce", "#2c3640", "#b9c2c8"]), every: 1, h: .45, out: .06, pat: P.spandrel }, cornice: { col: frame, h: .5, out: .2 },
      corner: { col: frame, w: .35, out: .05 }, canopy: true, crown: r() < .7, roofCol: "#8d9396", plinth: sf("#7d8287", P.panel) };
  };
  STYLES.apart = (o, r) => {
    const wall = pickOf(r, ["#f2d7b6", "#f6c9c0", "#cfe3d6", "#e8e0f2", "#f5e6a8", "#d6e6f2", "#f3e1d0"]), trim = pickOf(r, [WHITE, "#e8e1d0"]);
    return { wall: sf(wall, P.stucco), inner: sf(pickOf(r, ["#f1ece2", "#e4ecee"]), P.paper), jamb: sf(trim), trim, bay: 2.8,
      win: { w: 1.4, s: .9, h: 2.7, frame: trim, mull: "cross", shutter: pickOf(r, ["#3f7f6f", "#2f5f8f", "#9f4f3f", "#6f5f8f"]), sill: trim },
      gwin: { w: 1.6, s: .7, h: 2.8, frame: trim, mull: "cross" }, balcony: true, band: { col: trim, every: 1, h: .14, out: .08 }, cornice: { col: trim, h: .4, out: .25 },
      roofCol: "#8a8f94", stairHut: true, dish: r() < .6, plinth: sf("#a39a8a", P.stone) };
  };
  STYLES.shops = (o, r) => {
    const up = r() < .5, wall = up ? pickOf(r, ["#9c4a3a", "#b05d3b", "#8a4a36"]) : pickOf(r, ["#e9d8b8", "#d9e4d0", "#f0d0b8", "#cfd9e6"]), trim = pickOf(r, [CREAM, WHITE]);
    return { wall: sf(wall, up ? P.brick : P.siding), inner: sf("#ede6d8", P.paper), jamb: sf(trim), trim, bay: 2.7,
      win: { w: 1.3, s: .95, h: 2.8, frame: trim, mull: "cross", sill: trim, hood: up ? trim : null },
      gwin: { w: 2.4, s: .35, h: 3.05, frame: pickOf(r, [DARK, "#5a3a2a", "#1f4f6f"]), mull: "v", shop: true }, groundWall: sf(pickOf(r, ["#3f5a6a", "#6a3f3f", "#2f4f3f", "#5a4a6a"]), P.panel),
      awning: true, signs: true, billboard: o.d > 8 || r() < .3, band: { col: trim, every: 1, h: .16, out: .1 }, cornice: { col: trim, h: .6, out: .4 }, roofCol: "#7d8186", plinth: sf("#8f8778", P.stone) };
  };
  STYLES.clock = (o, r) => ({ wall: sf("#8f4c3d", P.brick), groundWall: sf("#b9ae9b", P.stone), lowerWall: 2, inner: sf("#e6dccb", P.paper), jamb: sf(CREAM), trim: CREAM, bay: 2.4,
    win: { w: .95, s: 1.0, h: 3.1, frame: CREAM, mull: "v", sill: CREAM, hood: CREAM }, gwin: { w: 1.4, s: .6, h: 3.0, frame: CREAM, mull: "cross" },
    band: { col: CREAM, every: 2, h: .22, out: .14 }, corner: { col: "#b9ae9b", w: .7, out: .12, pat: P.stone }, clock: true, roofCol: "#4e8f7d", roofPat: P.plank, finial: "#e8c04a", plinth: sf("#8f8778", P.stone) });
  STYLES.harbor = (o, r) => {
    const wall = pickOf(r, ["#d95f4b", "#f2a541", "#3f8fb0", "#6bb38f", "#f4efe4", "#e7c8a0", "#c25b7a"]), trim = WHITE;
    return { wall: sf(wall, r() < .4 ? P.brick : P.stucco), inner: sf("#efe8da", P.paper), jamb: sf(trim), trim, bay: 2.2,
      win: { w: 1.05, s: .7, h: 3.15, frame: trim, mull: "grid", shutter: pickOf(r, ["#2f5f8f", "#2f6f5f", "#8f2f2f", "#f2f2f2"]), sill: trim },
      gwin: { w: 2.2, s: .4, h: 3.0, frame: DARK, mull: "v", shop: true }, band: { col: trim, every: 1, h: .12, out: .08 }, roofCol: pickOf(r, ["#3a3f46", "#6b3a2e", "#2f4a5a"]), roofPat: P.tile,
      awning: true, signs: true, hoist: true, ov: .4, plinth: sf("#7f8a8f", P.stone) };
  };
  STYLES.depot = (o, r) => {
    const wall = pickOf(r, ["#6d8c8f", "#9a5b3f", "#8a9aa0", "#c4a35a", "#5f7f6a", "#b8bfc4"]);
    return { wall: sf(wall, P.metal), inner: sf("#9aa3a8", P.metal), jamb: sf("#5a6266"), trim: "#4a5257", bay: 4.2,
      win: { w: 2.6, s: 2.6, h: 3.5, frame: "#4a5257", mull: "grid", topOnly: true }, gwin: null, roofCol: pickOf(r, ["#7c8a8f", "#a0a7ab", "#8a5a40"]), roofPat: P.metal,
      roller: true, signs: true, vents: true, ov: .5, corner: { col: "#4a5257", w: .3, out: .05 }, plinth: sf("#8a8a86", P.panel) };
  };
  STYLES.suburb = (o, r) => {
    const wall = pickOf(r, ["#9cc3d5", "#b8d8a8", "#f3e3a0", "#f2f0e8", "#e7b9a3", "#c7b8e0", "#a9d3c9", "#f4cfa1"]), trim = WHITE;
    return { wall: sf(wall, P.siding), inner: sf(pickOf(r, ["#f3ece0", "#e8efe6", "#efe4ea"]), P.paper), jamb: sf(trim), trim, bay: 2.5,
      win: { w: 1.2, s: 1.0, h: 2.7, frame: trim, mull: "cross", shutter: pickOf(r, ["#2f4f6f", "#3f6f4f", "#6f2f2f", "#333a40", "#f2f2f2"]), sill: trim, flower: r() < .5 },
      roofCol: pickOf(r, ["#5a5f68", "#6e4b3a", "#3f5a4a", "#4a4f63"]), roofPat: P.shingle, porch: true, chimney: "#9c4a3a", garage: o.w >= 5.8 && r() < .7, corner: { col: trim, w: .22, out: .04 }, ov: .55, plinth: sf("#9a958c", P.stone) };
  };
  STYLES.brick = (o, r) => {
    const wall = pickOf(r, ["#a5523f", "#8e4d3c", "#b56a4f", "#9a5a48"]), trim = WHITE;
    return { wall: sf(wall, P.brick), inner: sf("#efe7da", P.paper), jamb: sf(trim), trim, bay: 2.6,
      win: { w: 1.3, s: .95, h: 2.75, frame: trim, mull: "grid", sill: "#d8d0c0", hood: "#d8d0c0" }, roofCol: pickOf(r, ["#4f545c", "#5d4a40", "#3e4650"]), roofPat: P.shingle,
      portico: true, bay3: true, chimney: wall, corner: { col: "#d8d0c0", w: .3, out: .05, pat: P.stone }, ov: .5, plinth: sf("#8f8778", P.stone) };
  };
  STYLES.cabin = (o, r) => ({ wall: sf(pickOf(r, ["#8a5a36", "#6e4a2f", "#9a6a42"]), P.log), groundWall: null, inner: sf("#c9a77c", P.plank), jamb: sf("#5a3a22"), trim: "#5a3a22", bay: 2.6,
    win: { w: 1.0, s: 1.1, h: 2.5, frame: "#4a3020", mull: "cross", sill: "#4a3020", curtainP: .6 }, roofCol: pickOf(r, ["#2f4f3a", "#4a3a2f", "#3a4048"]), roofPat: r() < .5 ? P.shingle : P.metal,
    porchLong: true, stoneChimney: true, ov: .7, plinth: sf("#8a8478", P.stone), tallPlinth: true });
  STYLES.chalet = (o, r) => ({ wall: sf("#f1ece2", P.stucco), upperWall: sf(pickOf(r, ["#7b5034", "#6a4228", "#8a5a38"]), P.plank), upperFrom: 1, inner: sf("#d9c2a0", P.plank), jamb: sf("#5a3a22"), trim: "#5a3a22", bay: 2.4,
    win: { w: 1.1, s: .9, h: 2.6, frame: "#5a3a22", mull: "cross", shutter: pickOf(r, ["#3f6f3f", "#8f2f2f", "#2f4f7f"]), sill: "#5a3a22", flower: true },
    roofCol: "#4a3a30", roofPat: P.shingle, chaletBalcony: true, ov: .95, stoneChimney: r() < .5, plinth: sf("#8a8478", P.stone) });
  STYLES.farm = (o, r) => {
    const wall = pickOf(r, ["#f4f1e6", "#f3e6b8", "#e8efe6", "#f2e0d0"]), trim = pickOf(r, ["#3e6b4a", "#2f4f6f", "#8f2f2f"]);
    return { wall: sf(wall, P.siding), inner: sf("#efe4cf", P.paper), jamb: sf(WHITE), trim: WHITE, bay: 2.5,
      win: { w: 1.1, s: .9, h: 2.8, frame: WHITE, mull: "grid", shutter: trim, sill: WHITE, flower: r() < .4 }, roofCol: pickOf(r, ["#7a3a2a", "#5a4a40", "#3e5a4a"]), roofPat: P.shingle,
      porchWrap: true, dormers: true, chimney: "#9c4a3a", corner: { col: WHITE, w: .2, out: .04 }, ov: .5, plinth: sf("#9a958c", P.stone) };
  };
  STYLES.barn = (o, r) => {
    const red = pickOf(r, ["#a8332b", "#9a2f26", "#b8442f", "#7f2f2a"]);
    return { wall: sf(red, P.plank), inner: sf("#9a6a42", P.plank), jamb: sf(WHITE), trim: WHITE, bay: 3.6,
      win: { w: .9, s: 1.2, h: 2.2, frame: WHITE, mull: "cross", sideOnly: true }, roofCol: pickOf(r, ["#4d5359", "#6a2a24", "#5a5f66"]), roofPat: P.metal,
      barnDoor: true, hayloft: true, cupola: true, corner: { col: WHITE, w: .28, out: .05 }, ov: .45, plinth: sf("#8a8478", P.stone) };
  };
  STYLES.adobe = (o, r) => {
    const wall = pickOf(r, ["#d9a878", "#c98e5e", "#e3b98a", "#d49a6a", "#e8c39a"]);
    return { wall: sf(wall, P.stucco), inner: sf("#ecd8bc", P.stucco), jamb: sf(wall, P.stucco), trim: "#3f8f9d", bay: 2.9,
      win: { w: .95, s: 1.1, h: 2.45, frame: pickOf(r, ["#3f8f9d", "#2f6f8f", "#8f4f2f"]), mull: "cross", deep: true, sill: "#a07850" },
      roofCol: "#c9a27a", vigas: true, parapetStep: true, ladder: true, pots: true, parapetCol: wall, plinth: null, soft: true };
  };
  STYLES.diner = (o, r) => {
    const band = pickOf(r, ["#e8455e", "#2aa6a0", "#f2a43a", "#3f7fd0"]);
    return { wall: sf(pickOf(r, ["#f4efe6", "#e9f2f2", "#fbe9d8"]), P.panel), groundWall: sf(band, P.roller), inner: sf("#f4e9d8", P.paper), jamb: sf("#cfd6dc"), trim: "#cfd6dc", bay: 2.4,
      win: { w: 1.6, s: 1.1, h: 2.6, frame: "#cfd6dc", mull: "v", upperNone: true }, gwin: { w: 2.15, s: .9, h: 2.7, frame: "#d8dde2", mull: "none", thin: true },
      chrome: true, bigSign: "DINER 24/24", roofToy: r() < .5 ? "donut" : "burger", roofCol: "#8a8f94", band: { col: "#cfd6dc", every: 1, h: .2, out: .12 }, plinth: sf("#7f8a8f", P.panel) };
  };
  STYLES.motel = (o, r) => {
    const wall = pickOf(r, ["#f2e2c0", "#e0f0ea", "#f6d6c8", "#dfe6f6"]), trim = pickOf(r, ["#2aa6a0", "#e8455e", "#f2a43a"]);
    return { wall: sf(wall, P.stucco), inner: sf("#efe4d6", P.paper), jamb: sf(WHITE), trim: WHITE, bay: 3.2,
      win: { w: 1.4, s: 1.0, h: 2.5, frame: WHITE, mull: "v", curtainP: .8, motelDoor: trim }, gwin: { w: 1.4, s: 1.0, h: 2.5, frame: WHITE, mull: "v", curtainP: .8, motelDoor: trim },
      walkway: true, roofCol: "#8a8f94", band: { col: trim, every: 1, h: .22, out: .1 }, pole: "MOTEL ÉTOILE", plinth: sf("#9a958c", P.panel) };
  };
  STYLES.villa = (o, r) => ({ wall: sf(pickOf(r, ["#f4f2ee", "#efeae0", "#f6f6f2"]), P.stucco), accent: sf(pickOf(r, ["#a77b52", "#8a6040", "#b98a5a"]), P.plank), inner: sf("#f4f1ea", P.plain), jamb: sf("#2e3238"), trim: "#2e3238", bay: 3.2,
    win: { w: 2.7, s: .12, h: 3.55, frame: "#2e3238", mull: "v", thin: true }, gwin: { w: 2.8, s: .05, h: 3.6, frame: "#2e3238", mull: "v", thin: true },
    slabs: true, glassRail: true, roofCol: "#d8d6d0", loungers: true, plinth: sf("#e6e1d6", P.paver) });
  STYLES.deco = (o, r) => {
    const wall = pickOf(r, ["#f7c6d0", "#a8e0dd", "#f9e3a3", "#c9d8f6", "#f6d0b0"]), trim = WHITE, neon = pickOf(r, ["#ff5fa8", "#3ff0ff", "#ffd84a"]);
    return { wall: sf(wall, P.stucco), inner: sf("#f6efe6", P.paper), jamb: sf(trim), trim, bay: 2.6,
      win: { w: 1.4, s: .8, h: 2.7, frame: trim, mull: "v", brow: true }, gwin: { w: 1.9, s: .4, h: 3.0, frame: trim, mull: "v", brow: true },
      band: { col: trim, every: 1, h: .3, out: .12 }, cornice: { col: trim, h: .5, out: .2 }, fins: true, neon, tower: true, roofCol: "#c8c2b8", plinth: sf("#e6e1d6", P.paver) };
  };
  STYLES.lab = (o, r) => {
    const acc = pickOf(r, ["#e98a3a", "#3f7fd0", "#2aa6a0", "#d04a4a"]);
    return { wall: sf(pickOf(r, ["#cfd4d8", "#dfe2e4", "#c4cacf"]), P.panel), inner: sf("#eef1f3", P.plain), jamb: sf("#9aa3a8"), trim: "#9aa3a8", bay: 2.4, glass: "#4f6f8a",
      win: { w: 2.3, s: 1.0, h: 2.75, frame: "#5a6470", mull: "v", thin: true }, gwin: { w: 2.3, s: .1, h: 3.4, frame: "#5a6470", mull: "v", thin: true },
      band: { col: acc, every: 1, h: .28, out: .04 }, roofCol: "#9aa0a6", labDome: true, antennas: true, solar: r() < .6, plinth: sf("#8f969c", P.panel) };
  };
  STYLES.pagoda = (o, r) => ({ wall: sf("#f1ece0", P.stucco), inner: sf("#e9dcc0", P.plank), jamb: sf("#8a2f24"), trim: "#8a2f24", bay: 2.4,
    win: { w: 1.4, s: .9, h: 2.9, frame: "#8a2f24", mull: "lattice" }, gwin: { w: 1.5, s: .6, h: 3.0, frame: "#8a2f24", mull: "lattice" },
    corner: { col: "#b8372f", w: .45, out: .14 }, posts: "#b8372f", eaves: pickOf(r, ["#2f5d57", "#4a5560", "#3a4a6a"]), roofCol: pickOf(r, ["#2f5d57", "#4a5560", "#3a4a6a"]), roofPat: P.tile,
    lanterns: true, finial: "#e8c04a", ov: 1.3, plinth: sf("#b9ae9b", P.stone), signs: false });

  /* ============================================================ constructeur générique */
  function build(o) {
    mats();
    const r = rng((o.seed || 1) * 31 + 7), arch = o._arch, st = (STYLES[arch] || STYLES.apart)(o, r);
    st.arch = arch; st.r = r; st.snow = S.biomeAt && S.biomeAt(o.x, o.z) === "snow";
    const g = new Geo(16384), gl = new Geo(1024), gi = new Geo(8192);
    const w = o.w, d = o.d, h = o.h, floors = o.floors || Math.max(1, Math.round(h / FLOOR));
    const SD = sides(o), ctx = { o, st, g, gl, gi, w, d, h, floors, SD, r, signsUsed: 0, shopIdx: Math.floor(r() * SHOPS.length) };
    walls(ctx);
    slabs(ctx);
    roof(ctx);
    extras(ctx);
    interior(ctx);
    return ctx;
  }

  // ---------- murs, baies et habillage des façades
  function walls(c) {
    const { o, st, g, gl, w, d, h, floors, SD, r } = c, T0 = .2, edge = st.jamb;
    for (const sd of SD) {
      const L = sd.L;
      for (let f = 0; f < floors; f++) {
        const y0 = f * FLOOR, y1 = f === floors - 1 ? h : (f + 1) * FLOOR;
        let surf = st.wall;
        if (f === 0 && st.groundWall) surf = st.groundWall;
        else if (st.lowerWall && f < st.lowerWall && st.groundWall) surf = st.groundWall;
        else if (st.upperWall && f >= st.upperFrom) surf = st.upperWall;
        if (st.accent && (sd.k === "E" || (f === floors - 1 && sd.k !== "N"))) surf = st.accent;
        const ws = f === 0 && st.gwin !== undefined ? st.gwin : st.win;
        const ops = [];
        if (ws) {
          const bays = Math.max(1, Math.round((2 * L - .6) / st.bay));
          for (let i = 0; i < bays; i++) {
            const u = -L + .3 + (i + .5) * ((2 * L - .6) / bays);
            if (sd.k === "N" && f === 0 && Math.abs(u) < 1.8 + ws.w / 2 + .3) continue;
            if (ws.topOnly && f !== floors - 1) continue;
            if (ws.sideOnly && (sd.k === "N" || sd.k === "S")) continue;
            if (ws.upperNone && f > 0 && sd.k === "N") continue;
            if (st.clock && f === floors - 1) continue;
            if (st.garage && f === 0 && sd.k === "N" && u < -1.6) continue;
            if (st.barnDoor && sd.k === "N" && f === 0) continue;
            if (st.bay3 && f === 0 && sd.k === "N" && u < -1.9 && u > -w + .8 && !c.bayDone) { c.bayDone = true; ops.push({ u0: u - 1.2, u1: u + 1.2, v0: y0 + .7, v1: y0 + 2.9, ws: { w: 2.4, s: .7, h: 2.9, frame: st.trim, mull: "grid" }, bay3: true }); continue; }
            const ww = Math.min(ws.w, (2 * L - .6) / bays - .35);
            ops.push({ u0: u - ww / 2, u1: u + ww / 2, v0: y0 + ws.s, v1: Math.min(y1 - .25, y0 + ws.h), ws, i, bays });
          }
        }
        if (sd.k === "N" && f === 0) ops.push({ u0: -1.8, u1: 1.8, v0: y0, v1: y0 + 3.05, door: true });
        ops.sort((a, b) => a.u0 - b.u0);
        // morceaux de mur autour des baies
        let cur = -L;
        for (const op of ops) {
          if (op.u0 > cur + .01) sbox(g, sd, cur, op.u0, y0, y1, -T0, T0, surf, st.inner, edge);
          if (op.v0 > y0 + .01) sbox(g, sd, op.u0, op.u1, y0, op.v0, -T0, T0, surf, st.inner, edge);
          if (op.v1 < y1 - .01) sbox(g, sd, op.u0, op.u1, op.v1, y1, -T0, T0, surf, st.inner, edge);
          cur = op.u1;
        }
        if (cur < L - .01) sbox(g, sd, cur, L, y0, y1, -T0, T0, surf, st.inner, edge);
        for (const op of ops) { if (op.door) door(c, sd, op); else dressWindow(c, sd, op, f); }
      }
      // pignons fermés sous les toits à deux pans
      gableWall(c, sd);
    }
    // soubassement
    if (st.plinth) {
      const pt = st.tallPlinth ? 1.0 : .32;
      for (const sd of SD) {
        const ext = sd.k === "N" || sd.k === "S" ? .12 : .4;
        if (sd.k === "N") { sbox(g, sd, -sd.L - ext, -1.85, -.6, pt, T0, T0 + .12, st.plinth, null, st.plinth); sbox(g, sd, 1.85, sd.L + ext, -.6, pt, T0, T0 + .12, st.plinth, null, st.plinth); }
        else sbox(g, sd, -sd.L - ext, sd.L + ext, -.6, pt, T0, T0 + .12, st.plinth, null, st.plinth);
      }
    }
    // bandeaux d'étage, corniche, pilastres d'angle (les bandeaux est/ouest se glissent sous ceux du nord et du sud)
    const ring = (y0, y1, out, s) => { for (const sd of SD) { const ext = sd.k === "N" || sd.k === "S" ? out : .4; sbox(g, sd, -sd.L - ext, sd.L + ext, y0, y1, T0, T0 + out, s, null, s); } };
    if (st.band) for (let f = 1; f < floors; f++) if (f % (st.band.every || 1) === 0) { const s = sf(st.band.col, st.band.pat || 0); ring(f * FLOOR - st.band.h / 2, f * FLOOR + st.band.h / 2, st.band.out, s); }
    if (st.cornice && isFlat(o)) { const s = sf(st.cornice.col); ring(h - st.cornice.h, h - st.cornice.h * .4, st.cornice.out * .6, s); ring(h - st.cornice.h * .4, h, st.cornice.out, s); }
    if (st.corner) {
      const s = sf(st.corner.col, st.corner.pat || 0), cw = st.corner.w, co = st.corner.out;
      for (const x of [-1, 1]) for (const z of [-1, 1]) g.box(x * (w + T0 + co) - (x > 0 ? cw : -cw) * 0, -.3, z * (d + T0 + co), x * (w + T0 - cw + co), h - (st.cornice ? .05 : 0), z * (d + T0 - cw + co), s, 1 << 3);
    }
    if (st.chrome) ring(3.55, 3.85, .16, sf("#d8dde2", P.metal));
  }
  function isFlat(o) { return !o._roof || o._roof.t === "flat"; }

  function door(c, sd, op) {
    const { st, g, gl, r } = c, fr = sf(st.trim), s = st;
    const v0 = op.v0, v1 = op.v1;
    // encadrement
    sbox(g, sd, op.u0 - .18, op.u0, v0, v1 + .18, .2, .3, fr, null, fr); sbox(g, sd, op.u1, op.u1 + .18, v0, v1 + .18, .2, .3, fr, null, fr); sbox(g, sd, op.u0 - .18, op.u1 + .18, v1, v1 + .22, .2, .32, fr, null, fr);
    // seuil
    g.box(op.u0, -.05, -c.d - .2, op.u1, .06, -c.d + .2, sf("#9a958c", P.stone));
    if (s.roller) {
      // rideau métallique relevé + second rideau fermé à côté, parvis de livraison
      sbox(g, sd, op.u0, op.u1, v1 - .55, v1, -.15, .15, sf("#8f979c", P.roller), null, sf("#6a7277"));
      const u0 = -c.w + .6, u1 = op.u0 - .8; if (u1 - u0 > 2) sbox(g, sd, u0, u1, 0, 3.2, .2, .26, sf(pickOf(r, ["#d8b84a", "#c8ccd0", "#d0563a"]), P.roller), null, sf("#6a7277"));
      g.box(-c.w * .6, -.05, -c.d - 3.2, c.w * .6, .08, -c.d - .2, sf("#8a8a86", P.panel));
      for (let k = 0; k < 6; k++) g.box(-c.w * .6 + .2 + k * c.w * .22, .08, -c.d - 3.15, -c.w * .6 + .5 + k * c.w * .22, .09, -c.d - .25, sf("#e8c84a")); // marquage
      for (const x of [-c.w * .55, c.w * .55]) g.box(x - .2, .2, -c.d - .5, x + .2, .9, -c.d - .2, sf("#2a2a2a"));
      return;
    }
    if (s.barnDoor) {
      // grands vantaux coulissants ouverts, croisillons blancs
      const red = c.st.wall, wh = sf(WHITE);
      for (const sg of [-1, 1]) {
        const a = sg < 0 ? op.u0 - 2.2 : op.u1 + .05, b = sg < 0 ? op.u0 - .05 : op.u1 + 2.2;
        sbox(g, sd, a, b, .05, 3.6, .24, .36, red, red, wh);
        for (const q of [[a, .05, b, .2], [a, 3.45, b, 3.6], [a, .05, a + .15, 3.6], [b - .15, .05, b, 3.6]]) sbox(g, sd, q[0], q[2], q[1], q[3], .36, .4, wh, null, wh);
        const p0 = spt(sd, a + .1, .2, .38), p1 = spt(sd, b - .1, 3.45, .38), p2 = spt(sd, a + .1, 3.45, .38), p3 = spt(sd, b - .1, .2, .38);
        diag(g, p0, p1, .1, wh); diag(g, p2, p3, .1, wh);
      }
      sbox(g, sd, op.u0 - 2.4, op.u1 + 2.4, 3.65, 3.8, .2, .5, sf("#5a5f66", P.metal), null, sf("#5a5f66"));
      return;
    }
    const leafC = s.door || pickOf(r, ["#8f2f2f", "#2f4f6f", "#3f6f4f", "#6a4a30", "#2e3238", "#e0b43a"]);
    const glassy = (s.gwin && s.gwin.shop) || s.arch === "office" || s.arch === "villa" || s.arch === "lab" || s.arch === "diner";
    // deux vantaux ouverts vers l'intérieur (vitrés pour les boutiques et bureaux)
    leafAt(c, sd, op.u0, 1, 1.72, v1 - .06, glassy ? sf(DARK, P.metal) : sf(leafC, P.plank), glassy);
    leafAt(c, sd, op.u1, -1, 1.72, v1 - .06, glassy ? sf(DARK, P.metal) : sf(leafC, P.plank), glassy);
    if (!glassy) {
      // numéro et applique
      sbox(g, sd, op.u1 + .35, op.u1 + .75, 2.3, 2.6, .2, .26, sf("#2e3238"), null, sf("#2e3238"));
      sbox(g, sd, op.u0 - .65, op.u0 - .35, 2.2, 2.6, .2, .34, sf("#ffe2a0", P.glow), null, sf("#2e3238"));
    }
  }
  // vantail pivoté autour de son gond (uh), ouvert à ~70° vers l'intérieur ; sgn : sens du vantail fermé le long de u
  function leafAt(c, sd, uh, sgn, hw, ht, s, glass) {
    const ud = UD[sd.k], inn = [-sd.nrm[0], -sd.nrm[1]], a = 1.22;
    const dx = sgn * Math.cos(a) * ud[0] + Math.sin(a) * inn[0], dz = sgn * Math.cos(a) * ud[1] + Math.sin(a) * inn[1];
    const H = spt(sd, uh, 0, -.1), cx = H[0] + dx * hw / 2, cz = H[2] + dz * hw / 2, yaw = Math.atan2(-dz, dx);
    if (glass) {
      c.g.obox(cx, ht / 2, cz, hw / 2, ht / 2, .05, yaw, 0, [s, s, s, s, null, null]);
      c.g.obox(cx, .2, cz, hw / 2, .2, .055, yaw, 0, s); c.g.obox(cx, ht - .1, cz, hw / 2, .1, .055, yaw, 0, s);
      c.gl.obox(cx, ht / 2 + .05, cz, hw / 2 - .08, ht / 2 - .25, .02, yaw, 0, sf("#a8d8e8"));
    } else { c.g.obox(cx, ht / 2, cz, hw / 2, ht / 2, .06, yaw, 0, s); c.g.obox(cx + dx * hw * .38, 1.1, cz + dz * hw * .38, .04, .04, .14, yaw, 0, sf("#d8c04a", P.metal)); }
  }
  // barre droite entre deux points (poutres, croisillons, câbles)
  function diag(g, a, b, t, s) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || .01;
    const yaw = Math.atan2(dx, dz), pitch = -Math.asin(dy / L);
    g.obox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, t / 2, t / 2, L / 2, yaw, pitch, s);
  }

  function dressWindow(c, sd, op, f) {
    const { st, g, gl, gi, r } = c, ws = op.ws, fr = sf(ws.frame || st.trim), ft = ws.thin ? .06 : .1, fo = ws.thin ? .24 : .28;
    const u0 = op.u0, u1 = op.u1, v0 = op.v0, v1 = op.v1;
    // cadre
    sbox(g, sd, u0 - ft, u0, v0 - ft, v1 + ft, -.05, fo, fr, null, fr); sbox(g, sd, u1, u1 + ft, v0 - ft, v1 + ft, -.05, fo, fr, null, fr);
    sbox(g, sd, u0, u1, v1, v1 + ft, -.05, fo, fr, null, fr); sbox(g, sd, u0, u1, v0 - ft, v0, -.05, fo, fr, null, fr);
    // vitre (milieu du mur)
    const gc = sf(st.glass || pickOf(r, GLASS_C));
    squad(gl, sd, u0, u1, v0, v1, ws.deep ? -.05 : .02, gc);
    // meneaux
    const mw = ws.thin ? .05 : .07, um = (u0 + u1) / 2, vm = v0 + (v1 - v0) * .58;
    if (ws.mull === "cross" || ws.mull === "v" || ws.mull === "grid") sbox(g, sd, um - mw / 2, um + mw / 2, v0, v1, -.02, .08, fr, null, fr);
    if (ws.mull === "cross" || ws.mull === "grid") sbox(g, sd, u0, u1, vm - mw / 2, vm + mw / 2, -.02, .08, fr, null, fr);
    if (ws.mull === "grid") { for (const k of [.25, .75]) sbox(g, sd, u0 + (u1 - u0) * k - mw / 2, u0 + (u1 - u0) * k + mw / 2, v0, v1, -.02, .07, fr, null, fr); sbox(g, sd, u0, u1, v0 + (v1 - v0) * .28 - mw / 2, v0 + (v1 - v0) * .28 + mw / 2, -.02, .07, fr, null, fr); }
    if (ws.mull === "lattice") { for (let k = 1; k < 5; k++) sbox(g, sd, u0 + (u1 - u0) * k / 5 - .03, u0 + (u1 - u0) * k / 5 + .03, v0, v1, -.02, .06, fr, null, fr); for (let k = 1; k < 6; k++) sbox(g, sd, u0, u1, v0 + (v1 - v0) * k / 6 - .03, v0 + (v1 - v0) * k / 6 + .03, -.02, .06, fr, null, fr); }
    // appui et linteau
    if (ws.sill) sbox(g, sd, u0 - .14, u1 + .14, v0 - .18, v0 - .06, .1, .38, sf(ws.sill), null, sf(ws.sill));
    if (ws.hood) sbox(g, sd, u0 - .2, u1 + .2, v1 + .08, v1 + .34, .1, .34, sf(ws.hood, P.stone), null, sf(ws.hood));
    if (ws.brow) sbox(g, sd, u0 - .3, u1 + .3, v1 + .1, v1 + .2, .2, .85, sf(st.trim), null, sf(st.trim));
    // volets ouverts
    if (ws.shutter && r() < .85) {
      const sw = Math.min(.62, (u1 - u0) / 2 + .05), s = sf(ws.shutter, P.roller);
      sbox(g, sd, u0 - ft - sw, u0 - ft - .02, v0, v1, .2, .27, s, null, s); sbox(g, sd, u1 + ft + .02, u1 + ft + sw, v0, v1, .2, .27, s, null, s);
    }
    // jardinière
    if (ws.flower && r() < .55) {
      sbox(g, sd, u0, u1, v0 - .42, v0 - .12, .28, .62, sf("#7a4a2f", P.plank), null, sf("#6a3a22"));
      const fc = pickOf(r, ["#e63946", "#f4a261", "#ffd166", "#f28dc0", "#ffffff"]);
      for (let k = 0; k < 4; k++) { const uu = u0 + .15 + (u1 - u0 - .3) * k / 3; sbox(g, sd, uu - .12, uu + .12, v0 - .12, v0 + .08, .32, .58, sf(k % 2 ? "#4f8f3f" : fc), null, sf("#3f7f2f")); }
    }
    // enseigne et vitrine de boutique
    if (ws.shop && sd.k !== "S" && st.signs && c.signsUsed < 6) {
      const name = SHOPS[(c.shopIdx + c.signsUsed) % SHOPS.length]; c.signsUsed++;
      const s = sf("#ffffff", P.sign);
      squad(g, sd, u0 - .1, u1 + .1, v1 + .35, v1 + .35 + Math.min(.62, (u1 - u0) / 4), .36, s, signUV(SIGN[name]));
      sbox(g, sd, u0 - .16, u1 + .16, v1 + .28, v1 + .42 + Math.min(.62, (u1 - u0) / 4), .2, .34, sf(DARK), null, sf(DARK));
    }
    if (st.awning && ws.shop && sd.k !== "S") awning(c, sd, u0 - .2, u1 + .2, v1 + .3);
    // climatiseur sous certaines fenêtres des tours
    if (st.arch === "tower" && f > 0 && r() < .07) sbox(g, sd, u0 + .2, u0 + .9, v0 - .62, v0 - .12, .2, .75, sf("#cfd4d8", P.metal), null, sf("#aab2b8"));
    // intérieur vu par la fenêtre : rideaux, stores éclairés
    const curtainP = ws.curtainP != null ? ws.curtainP : .4, k = r();
    if (!ws.shop && !ws.thin && k < .14) squad(gi, sd, u0 + .02, u1 - .02, v0 + .02, v1 - .02, -.12, sf(pickOf(r, ["#ffd98a", "#ffe6b0", "#fff0c8"]), P.lit));
    else if (!ws.shop && k < .14 + curtainP) { const cc = sf(pickOf(r, CURTAIN), P.carpet), cw = (u1 - u0) * (.18 + r() * .2); sbox(gi, sd, u0, u0 + cw, v0 - .1, v1, -.2, -.14, cc, cc, cc); sbox(gi, sd, u1 - cw, u1, v0 - .1, v1, -.2, -.14, cc, cc, cc); }
    // porte de chambre de motel à côté de la fenêtre
    if (ws.motelDoor && (sd.k === "N")) {
      const du0 = u1 + .45, du1 = du0 + 1.0;
      if (du1 < sd.L - .4) { sbox(g, sd, du0, du1, f * FLOOR, f * FLOOR + 2.4, .2, .26, sf(ws.motelDoor, P.plank), null, sf(WHITE)); sbox(g, sd, du0 + .3, du1 - .3, f * FLOOR + 2.55, f * FLOOR + 2.8, .2, .28, sf("#f4d27a", P.glow), null, sf(WHITE)); }
    }
  }
  function awning(c, sd, u0, u1, y) {
    const { g, r } = c, ca = pickOf(r, ["#d94a2b", "#2f8f5b", "#1f6fa8", "#e0b43a", "#6b4a8f", "#e8455e"]), cb = "#f4f1e8", n = Math.max(2, Math.round((u1 - u0) / .5));
    const depth = 1.25, drop = .55;
    for (let i = 0; i < n; i++) {
      const a = u0 + (u1 - u0) * i / n, b = u0 + (u1 - u0) * (i + 1) / n, s = sf(i % 2 ? cb : ca, P.plain);
      const p0 = spt(sd, a, y, .25), p1 = spt(sd, b, y, .25), p2 = spt(sd, b, y - drop, .25 + depth), p3 = spt(sd, a, y - drop, .25 + depth);
      g.quad(p0, p1, p2, p3, s); g.quad(p1, p0, p3, p2, s);
      sbox(g, sd, a, b, y - drop - .28, y - drop, .25 + depth - .03, .25 + depth + .02, s, null, s);
    }
  }

  // pignons pleins des toits à deux pans (façades nord/sud pour gz, est/ouest pour gx)
  function gableWall(c, sd) {
    const { o, st, g, w, d, h } = c, R = o._roof || {};
    const along = (R.t === "gz" && (sd.k === "N" || sd.k === "S")) || (R.t === "gx" && (sd.k === "E" || sd.k === "W")) || (R.t === "gam" && (sd.k === "N" || sd.k === "S"));
    if (!along) return;
    const half = R.t === "gx" ? d : w, s = st.upperWall || st.wall;
    const prof = R.t === "gam" ? gamProfile(half) : [[-half - .2, 0], [0, RB - .2 + half * R.s], [half + .2, 0]];
    const pts = [], back = [], out = [sd.nrm[0], 0, sd.nrm[1]], inn = [-sd.nrm[0], 0, -sd.nrm[1]];
    for (const q of prof) { pts.push(spt(sd, q[0], h + Math.max(0, q[1]), .2)); back.push(spt(sd, q[0], h + Math.max(0, q[1]), -.2)); }
    // face extérieure : éventail depuis le milieu de la base ; face intérieure (grenier) en retour
    const mid = spt(sd, 0, h, .2), midB = spt(sd, 0, h, -.2);
    for (let i = 0; i < pts.length - 1; i++) { g.ot(mid, pts[i], pts[i + 1], s, out); g.ot(midB, back[i], back[i + 1], st.inner, inn); }
    // rives : épaisseur du pignon sous la sous-face du toit
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ab = back[i], bb = back[i + 1]; g.oq(a, b, bb, ab, st.jamb, [0, 1, 0]); }
    // lucarne du grenier
    const top = prof.reduce((m, q) => Math.max(m, q[1]), 0);
    if (top > 1.6) {
      const wy = h + Math.min(top * .45, 1.6), ww = .5;
      squad(c.gl, sd, -ww, ww, wy - .45, wy + .45, .22, sf("#7fa8c0"));
      const fr = sf(st.trim);
      sbox(g, sd, -ww - .09, -ww, wy - .54, wy + .54, .2, .3, fr, null, fr); sbox(g, sd, ww, ww + .09, wy - .54, wy + .54, .2, .3, fr, null, fr);
      sbox(g, sd, -ww, ww, wy + .45, wy + .54, .2, .3, fr, null, fr); sbox(g, sd, -ww, ww, wy - .54, wy - .45, .2, .3, fr, null, fr); sbox(g, sd, -.03, .03, wy - .45, wy + .45, .2, .27, fr, null, fr);
    }
  }
  function gamProfile(half) { const a = half * .5; return [[-half - .2, 0], [-a, RB - .2 + (half - a) * 1.5], [0, RB - .2 + (half - a) * 1.5 + a * .42], [a, RB - .2 + (half - a) * 1.5], [half + .2, 0]]; }

  // ---------- planchers, plafonds et escaliers
  function slabs(c) {
    const { o, st, g, gi, w, d, h, floors } = c, s = o._stair, floorS = floorSurf(c), ceil = sf("#e9e4da", P.ceil), edge = sf("#b9b3a6");
    const F = (fs) => [edge, edge, fs, ceil, edge, edge];
    g.box(-w + .2, -.05, -d + .2, w - .2, .03, d - .2, [edge, edge, floorS(0), null, edge, edge]);
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR, fs = F(floorS(f)), iw = w - .2, id = d - .2;
      if (!s) { g.box(-iw, y - .22, -id, iw, y, id, fs); continue; }
      g.box(-iw, y - .22, -id, s.x0, y, id, fs);
      if (s.z0 - .3 > -id) g.box(s.x0, y - .22, -id, iw, y, s.z0 - .3, fs);
      if (s.z1 + .3 < id) g.box(s.x0, y - .22, s.z1 + .3, iw, y, id, fs);
      gi.box(s.x0 - .1, y, s.z0, s.x0 - .02, y + .95, s.z1, sf("#5a5f66", P.metal)); // garde-corps
    }
    // plafond du dernier étage
    g.box(-w + .2, h - .22, -d + .2, w - .2, h, d - .2, [edge, edge, isFlat(o) ? null : edge, ceil, edge, edge]);
    // escaliers : une volée par étage
    if (s) {
      const N = 10, L = s.z1 - s.z0, stepS = sf(st.arch === "office" || st.arch === "lab" ? "#9aa0a6" : "#9c8f7c", st.arch === "office" ? P.panel : P.plank), side = sf("#7d7266");
      for (let f = 0; f < floors - 1; f++) {
        for (let i = 0; i < N; i++) {
          const u = (i + .5) / N, lz = f % 2 ? s.z1 - u * L : s.z0 + u * L, top = f * FLOOR + FLOOR * (i + 1) / N;
          gi.box(s.x0 + .05, top - .26, lz - L / N / 2 - .02, s.x1 - .05, top, lz + L / N / 2 + .02, [side, side, stepS, side, side, side]);
        }
        // limon
        const y0 = f * FLOOR, z0 = f % 2 ? s.z1 : s.z0, z1 = f % 2 ? s.z0 : s.z1;
        diag(gi, [s.x0 + .02, y0 + .5, z0], [s.x0 + .02, y0 + FLOOR + .5, z1], .06, sf("#5a5f66", P.metal));
      }
    }
  }
  function floorSurf(c) {
    const { st, r } = c, kind = c.o._inside;
    return (f) => {
      if (kind === "diner") return sf("#ece6d8", P.checker);
      if (kind === "depot" || kind === "barn") return sf(kind === "barn" ? "#b08a5a" : "#9a9a94", kind === "barn" ? P.plank : P.panel);
      if (kind === "office" || kind === "lab") return sf(f % 2 ? "#6f7f8f" : "#8a8f96", P.carpet);
      if (kind === "shop" && f === 0) return sf("#e6e0d4", P.checker);
      if (kind === "pagoda") return sf("#c9a86a", P.parquet);
      const k = hash((c.o.seed || 1) * 17 + f * 5);
      return k < .55 ? sf(pickOf(r, ["#b98a5a", "#a87a4a", "#c99a6a"]), P.parquet) : k < .8 ? sf(pickOf(r, ["#e6e0d4", "#d8e0e6"]), P.checker) : sf(pickOf(r, ["#7f8fa8", "#a88f7f", "#8fa87f"]), P.carpet);
    };
  }

  // ---------- toits
  function roof(c) {
    const { o, st, g, w, d, h } = c, R = o._roof || { t: "flat" };
    const rc = st.snow ? sf("#eef4f6", P.stucco) : sf(st.roofCol || "#6a6f74", st.roofPat || P.shingle), under = sf("#6e665c"), fas = sf(st.trim || WHITE);
    const ov = st.ov != null ? st.ov : .55, th = .2;
    if (R.t === "flat") {
      g.box(-w - .2, h, -d - .2, w + .2, h + .24, d + .2, [fas, fas, sf(st.roofCol || "#8d9396", P.gravel), null, fas, fas]);
      const pc = sf(st.parapetCol || st.trim || WHITE, st.parapetCol ? P.stucco : 0), ph = st.parapetStep ? 1.0 : .85;
      const seg = (x0, z0, x1, z1, y1) => g.box(x0, h + .24, z0, x1, y1, z1, pc);
      if (st.parapetStep) {
        // acrotère en gradins (adobe)
        for (const sd of c.SD) for (let k = 0; k < 5; k++) { const u0 = -sd.L - .2 + (2 * sd.L + .4) * k / 5, u1 = -sd.L - .2 + (2 * sd.L + .4) * (k + 1) / 5, y1 = h + ph + (k === 2 ? .55 : k % 2 ? .25 : 0); sbox(g, sd, u0, u1, h + .24, y1, -.2, .2, pc, pc, pc); }
      } else {
        seg(-w - .2, -d - .2, w + .2, -d + .1, h + ph); seg(-w - .2, d - .1, w + .2, d + .2, h + ph); seg(-w - .2, -d + .1, -w + .1, d - .1, h + ph); seg(w - .1, -d + .1, w + .2, d - .1, h + ph);
        const cap = sf(st.trim || "#d8d6d0"); g.box(-w - .26, h + ph, -d - .26, w + .26, h + ph + .07, -d + .14, cap); g.box(-w - .26, h + ph, d - .14, w + .26, h + ph + .07, d + .26, cap);
        g.box(-w - .26, h + ph, -d + .14, -w + .14, h + ph + .07, d - .14, cap); g.box(w - .14, h + ph, -d + .14, w + .26, h + ph + .07, d - .14, cap);
      }
      return;
    }
    if (R.t === "gz" || R.t === "gx" || R.t === "gam") {
      // profil du dessus du toit en travers de la pente, extrudé le long du faîtage
      const alongZ = R.t !== "gx", half = alongZ ? w : d, len = (alongZ ? d : w) + ov;
      let prof;
      if (R.t === "gam") { const a = half * .5; prof = [[-half - ov, RB - ov * 1.5], [-a, RB + a * 1.5], [0, RB + a * 1.5 + a * .42], [a, RB + a * 1.5], [half + ov, RB - ov * 1.5]]; }
      else prof = [[-half - ov, RB - ov * R.s], [0, RB + half * R.s], [half + ov, RB - ov * R.s]];
      extrudeRoof(g, prof, alongZ, len, h, th, rc, under, fas);
      const peak = prof.reduce((m, q) => Math.max(m, q[1]), -1e9);
      if (alongZ) g.box(-.16, h + peak - .05, -len, .16, h + peak + .12, len, rc); else g.box(-len, h + peak - .05, -.16, len, h + peak + .12, .16, rc);
      if (R.t === "gam" && st.cupola) {
        const py = h + peak, cw = sf(WHITE, P.plank), cr = sf(st.roofCol, P.metal);
        g.box(-.9, py, -.9, .9, py + 1.5, .9, cw); g.box(-.7, py + .4, -.92, .7, py + 1.2, .92, sf("#3a3a3a")); g.box(-.92, py + .4, -.7, .92, py + 1.2, .7, sf("#3a3a3a"));
        g.cyl(0, py + 1.5, 0, 1.3, .05, py + 2.5, 4, cr);
        g.cyl(0, py + 2.5, 0, .03, .03, py + 3.4, 4, sf(DARK)); g.box(-.5, py + 3.1, -.03, .5, py + 3.16, .03, sf(DARK)); g.obox(.35, py + 3.3, 0, .25, .12, .02, 0, 0, sf(DARK));
      }
      return;
    }
    if (R.t === "hip") {
      const s = R.s, W2 = w + ov, D2 = d + ov, base = h + RB - ov * s, m = Math.min(W2, D2), peak = base + m * s;
      const rx = W2 - m, rz = D2 - m; // demi-longueur du faîtage
      const c0 = [-W2, base, -D2], c1 = [W2, base, -D2], c2 = [W2, base, D2], c3 = [-W2, base, D2], ra = [-rx, peak, -rz], rb = [rx, peak, -rz], rcc = [rx, peak, rz], rd = [-rx, peak, rz];
      const up = [0, 1, 0], dnv = [0, -1, 0], dn = (q) => [q[0], q[1] - th, q[2]];
      const planes = [[c0, c1, rb, ra, [0, 0, -1]], [c1, c2, rcc, rb, [1, 0, 0]], [c2, c3, rd, rcc, [0, 0, 1]], [c3, c0, ra, rd, [-1, 0, 0]]];
      for (const q of planes) {
        g.oq(q[0], q[1], q[2], q[3], rc, up);
        g.oq(dn(q[0]), dn(q[1]), dn(q[2]), dn(q[3]), under, dnv);
        g.oq(q[0], q[1], dn(q[1]), dn(q[0]), fas, q[4]);
      }
      if (rx > .01 || rz > .01) g.box(-rx - .1, peak - .05, -rz - .1, rx + .1, peak + .12, rz + .1, rc);
      if (st.finial) { const fc = sf(st.finial, P.metal); g.cyl(0, peak, 0, .32, .18, peak + .6, 8, fc); g.cyl(0, peak + .6, 0, .16, .02, peak + (st.clock ? 3.2 : 2.2), 6, fc); }
      // relevés aux angles (pagode)
      if (st.arch === "pagoda") for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.obox(x * (W2 - .2), base + .25, z * (D2 - .2), .14, .14, .7, Math.atan2(x, z), -.7, rc);
    }
  }
  function extrudeRoof(g, prof, alongZ, L, h, th, rc, under, fas) {
    const P3 = (a, y, b) => (alongZ ? [a, y, b] : [b, y, a]), dn = (q) => [q[0], q[1] - th, q[2]];
    const e0 = alongZ ? [0, 0, -1] : [-1, 0, 0], e1 = alongZ ? [0, 0, 1] : [1, 0, 0];
    for (let i = 0; i < prof.length - 1; i++) {
      const p0 = prof[i], p1 = prof[i + 1];
      const A = P3(p0[0], h + p0[1], -L), B = P3(p1[0], h + p1[1], -L), C = P3(p1[0], h + p1[1], L), D = P3(p0[0], h + p0[1], L);
      g.oq(A, B, C, D, rc, [0, 1, 0]);
      g.oq(dn(A), dn(B), dn(C), dn(D), under, [0, -1, 0]);
      g.oq(A, B, dn(B), dn(A), fas, e0); g.oq(D, C, dn(C), dn(D), fas, e1);
    }
    const f = prof[0], l = prof[prof.length - 1];
    const F0 = P3(f[0], h + f[1], -L), F1 = P3(f[0], h + f[1], L), L0 = P3(l[0], h + l[1], -L), L1 = P3(l[0], h + l[1], L);
    g.oq(F0, F1, dn(F1), dn(F0), fas, alongZ ? [-1, 0, 0] : [0, 0, -1]);
    g.oq(L0, L1, dn(L1), dn(L0), fas, alongZ ? [1, 0, 0] : [0, 0, 1]);
  }
  function roofTopLocal(o, lx, lz) { return S.World.prototype.__ch1RoofTop ? S.World.prototype.__ch1RoofTop(o, lx, lz) : .24; }

  // ---------- éléments propres à chaque type
  function extras(c) {
    const { o, st, g, gl, gi, w, d, h, floors, SD, r } = c, N = SD[0], E = SD[2], Wd = SD[3], Sd = SD[1];
    const metal = sf("#4a4f55", P.metal), wood = sf(WOOD, P.plank), white = sf(WHITE);
    // ---- toit-terrasse : équipements
    if (isFlat(o)) {
      const top = h + .24;
      if (floors >= 3 && !st.loungers && !st.labDome) { g.box(-w * .5, top, d * .15, -w * .5 + 1.8, top + 1.1, d * .15 + 1.3, sf("#b8bfc4", P.metal)); g.box(-w * .5 + .2, top + 1.1, d * .15 + .2, -w * .5 + 1.6, top + 1.18, d * .15 + 1.1, sf(DARK)); }
      if (st.stairHut || floors >= 6) { const s0 = o._stair; if (s0) { g.box(s0.x0 - .2, top, s0.z0 - .2, s0.x1 + .2, top + 2.6, s0.z0 + 2.4, [c.st.wall, c.st.wall, sf("#7d8186", P.gravel), null, c.st.wall, c.st.wall]); g.box(s0.x0 + .3, top, s0.z0 - .24, s0.x1 - .3, top + 2.1, s0.z0 - .2, sf("#4a4f55", P.plank)); } }
      if (st.tank) waterTank(g, -w * .35, top, -d * .35, r);
      if (st.dish) { g.cyl(w * .3, top, -d * .5, .06, .06, top + .9, 6, metal); g.obox(w * .3, top + 1.1, -d * .5 - .1, .45, .45, .06, 0, .6, white); }
      if (st.crown) { const s = sf(st.trim, P.metal); for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.box(x * w - .15, top, z * d - .15, x * w + .15, top + 3.2, z * d + .15, s); g.box(-w - .15, top + 3, -d - .15, w + .15, top + 3.3, -d + .15, s); g.box(-w - .15, top + 3, d - .15, w + .15, top + 3.3, d + .15, s); g.box(-w - .15, top + 3, -d - .15, -w + .15, top + 3.3, d + .15, s); g.box(w - .15, top + 3, -d - .15, w + .15, top + 3.3, d + .15, s); g.cyl(0, top, 0, .12, .05, top + 9, 6, metal); g.box(-.2, top + 8.7, -.2, .2, top + 9.1, .2, sf("#ff4040", P.glow)); }
      if (st.billboard) { const bw = Math.min(w * .9, 5); for (const x of [-bw * .7, bw * .7]) g.box(x - .1, top, d * .2 - .1, x + .1, top + 3.2, d * .2 + .1, metal); squad(g, N, -bw, bw, top + 2.2, top + 4.6, -(-d * .2 - .12 - d) - d - 0 + 0, sf("#ffffff", P.sign), signUV(SIGN[pickOf(r, ADS)])); g.box(-bw - .1, top + 2.1, d * .2 - .1, bw + .1, top + 4.7, d * .2 + .05, sf(DARK)); }
      if (st.labDome) { const rr = Math.min(w, d) * .5; g.cyl(w * .25, top, d * .15, rr + .1, rr + .1, top + .5, 16, sf("#b8bfc4", P.panel)); g.dome(w * .25, top + .5, d * .15, rr, 16, 6, sf("#f2f4f6", P.panel)); g.box(w * .25 - .35, top + .6, d * .15 - rr - .05, w * .25 + .35, top + .5 + rr * .98, d * .15 - rr * .2, sf("#2a3340")); }
      if (st.antennas) for (let k = 0; k < 3; k++) { const x = -w * .6 + k * .9, z = -d * .55; g.cyl(x, top, z, .05, .03, top + 3 + k, 5, metal); g.box(x - .4, top + 2.4 + k, z - .03, x + .4, top + 2.46 + k, z + .03, metal); }
      if (st.solar) for (let k = 0; k < 3; k++) g.obox(-w * .4 + k * 1.6, top + .5, d * .55, .7, .03, .5, 0, -.45, sf("#24406a", P.spandrel));
      if (st.loungers) { for (let k = 0; k < 2; k++) { const x = -w * .4 + k * 1.4; g.box(x - .35, top + .25, d * .35 - 1, x + .35, top + .45, d * .35 + .8, sf("#f4f1e8", P.carpet)); g.obox(x, top + .7, d * .35 - 1.05, .35, .05, .4, 0, -.9, sf("#f4f1e8", P.carpet)); } g.cyl(w * .4, top, d * .4, .35, .4, top + .6, 8, sf("#c97a4e")); palmTuft(g, w * .4, top + .6, d * .4, 1.2); }
      if (st.ladder) { const x = w + .55; for (const z of [-.45, .45]) diag(g, [x, 0, z + d * .2], [x - .4, h + 1.2, z + d * .2], .08, wood); for (let k = 1; k < 10; k++) { const y = k * (h + 1.2) / 10, xx = x - .4 * k / 10; g.box(xx - .04, y - .03, d * .2 - .45, xx + .04, y + .03, d * .2 + .45, wood); } }
      if (st.roofToy) roofToy(g, st.roofToy, 0, top, 0, Math.min(w, d));
    }
    // ---- auvent / marquise d'entrée
    if (st.canopy) { g.box(-2.6, 3.6, -d - 2.8, 2.6, 3.85, -d - .2, sf(DARK, P.metal)); for (const x of [-2.4, 2.4]) g.cyl(x, 0, -d - 2.6, .08, .08, 3.6, 8, metal); squad(g, N, -2.4, 2.4, 3.86, 4.6, .21, sf("#ffffff", P.sign), signUV(SIGN[st.arch === "lab" ? "LABO" : pickOf(r, ["HÔTEL", "BANQUE", "MUSÉE"])])); }
    // ---- porche de maison
    if (st.porch || st.porchLong || st.porchWrap) porch(c, st.porchLong || st.porchWrap ? w + .4 : 2.6, st.porchWrap);
    if (st.portico) { const s = sf(WHITE); g.box(-2.2, -.05, -d - 1.6, 2.2, .12, -d - .2, sf("#b9b3a6", P.stone)); for (const x of [-1.9, 1.9]) g.cyl(x, .12, -d - 1.35, .18, .16, 3.4, 10, s); g.box(-2.3, 3.4, -d - 1.7, 2.3, 3.62, -d - .2, s); g.ot([-2.3, 3.62, -d - 1.7], [2.3, 3.62, -d - 1.7], [0, 4.4, -d - 1.7], s, [0, 0, -1]); g.oq([-2.4, 3.6, -d - 1.8], [0, 4.45, -d - 1.8], [0, 4.45, -d - .2], [-2.4, 3.6, -d - .2], sf(c.st.roofCol, P.shingle), [0, 1, 0]); g.oq([0, 4.45, -d - 1.8], [2.4, 3.6, -d - 1.8], [2.4, 3.6, -d - .2], [0, 4.45, -d - .2], sf(c.st.roofCol, P.shingle), [0, 1, 0]); }
    // ---- garage
    if (st.garage) { sbox(g, N, -w + .5, -2.1, 0, 2.7, .2, .27, sf(WHITE, P.roller), null, white); sbox(g, N, -w + .35, -1.95, 2.7, 2.95, .2, .32, white, null, white); g.box(-w + .4, -.04, -d - 7, -2.2, .04, -d - .2, sf("#9a9690", P.paver)); }
    // ---- cheminées
    if (st.chimney) { const x = w * .55, s = sf(st.chimney === true ? "#9c4a3a" : st.chimney.c ? st.chimney.c : st.chimney, P.brick); const ch = chimneyH(o, x, d * .3); g.box(x - .45, h - .5, d * .3 - .45, x + .45, h + ch, d * .3 + .45, typeof st.chimney === "string" ? sf(st.chimney, P.brick) : s); g.box(x - .55, h + ch, d * .3 - .55, x + .55, h + ch + .2, d * .3 + .55, sf("#5a5550")); }
    if (st.stoneChimney) { const sdx = o._roof && o._roof.t === "gx" ? E : Sd, s = sf("#9a948a", P.stone); sbox(g, sdx, -.8, .8, -.4, h + 3.2, .2, 1.2, s, null, s); sbox(g, sdx, -.6, .6, h + 3.2, h + 3.8, .3, 1.1, s, null, s); }
    // ---- balcons (immeubles) : une dalle et une rambarde devant certaines baies
    if (st.balcony) for (const sd of [N, Sd]) for (let f = 1; f < floors; f++) {
      const bays = Math.max(1, Math.round((2 * sd.L - .6) / st.bay));
      for (let i = 0; i < bays; i++) { if ((i + f) % 2) continue; const u = -sd.L + .3 + (i + .5) * ((2 * sd.L - .6) / bays), y = f * FLOOR; balcony(c, sd, u - 1.15, u + 1.15, y, 1.2, sf(c.st.trim), false); }
    }
    if (st.chaletBalcony) for (let f = 1; f < floors; f++) balcony(c, N, -N.L + .4, N.L - .4, f * FLOOR, 1.3, sf("#6a4228", P.plank), true);
    if (st.walkway) for (let f = 1; f < floors; f++) { balcony(c, N, -N.L, N.L, f * FLOOR, 1.7, sf("#d8d6d0"), false); for (let k = 0; k < 4; k++) { const u = -N.L + .3 + k * (2 * N.L - .6) / 3, p = spt(N, u, 0, 1.75); g.box(p[0] - .1, 0, p[2] - .1, p[0] + .1, f * FLOOR, p[2] + .1, sf("#d8d6d0")); } }
    if (st.slabs) for (let f = 1; f <= floors; f++) { const y = f === floors ? h + .24 : f * FLOOR; for (const sd of [Sd, E]) { sbox(g, sd, -sd.L - .2, sd.L + .2, y - .22, y + .02, .2, 1.6, sf("#f4f2ee"), null, sf("#e0ddd6")); if (st.glassRail && f < floors) squad(gl, sd, -sd.L - .2, sd.L + .2, y, y + 1.05, 1.55, sf("#bfe6ee")); } }
    // ---- escalier de secours (tours en brique), façade ouest
    if (st.fireEscape && floors >= 4) fireEscape(c, Wd);
    // ---- pilastres, ailettes, enseigne verticale lumineuse (art déco)
    if (st.fins) { for (const u of [-N.L * .5, N.L * .5]) sbox(g, N, u - .15, u + .15, 3, h + .9, .2, .75, sf(c.st.trim), null, sf(c.st.trim)); if (st.tower) { sbox(g, N, -.9, .9, h - 2, h + 4.2, .2, .7, c.st.wall, null, sf(c.st.trim)); sbox(g, N, -.12, .12, h - 1.8, h + 4.0, .7, .78, sf(st.neon, P.lit), null, sf(st.neon, P.lit)); } for (const sd of SD) sbox(g, sd, -sd.L, sd.L, h + .7, h + .78, .2, .26, sf(st.neon, P.lit), null, sf(st.neon, P.lit)); }
    // ---- grand panneau du diner
    if (st.bigSign) { const s = sf("#ffffff", P.glow); squad(g, N, -Math.min(w - .6, 4.2), Math.min(w - .6, 4.2), 4.5, 6.6, .36, s, signUV(SIGN[st.bigSign])); sbox(g, N, -Math.min(w - .5, 4.3), Math.min(w - .5, 4.3), 4.4, 6.7, .2, .34, sf("#d8dde2", P.metal), null, sf("#d8dde2")); }
    // ---- mât d'enseigne du motel
    if (st.pole) { const p = spt(N, -N.L + .6, 0, 4.2); g.cyl(p[0], 0, p[2], .22, .18, 9.5, 8, sf("#d8d6d0", P.metal)); g.obox(p[0], 8.8, p[2], 2.1, .8, .14, N.yaw, 0, sf("#203a6e")); quadAt(g, p[0], 8.8, p[2], 2, .72, N.yaw, .16, signUV(SIGN[st.pole])); quadAt(g, p[0], 8.8, p[2], 2, .72, N.yaw + Math.PI, .16, signUV(SIGN[st.pole])); const ss = squareUV(2); quadAt(g, p[0], 10.2, p[2], .7, .7, N.yaw, .02, ss); quadAt(g, p[0], 10.2, p[2], .7, .7, N.yaw + Math.PI, .02, ss); }
    // ---- entrepôt : numéro peint, ventilateurs
    if (st.roller) { const k = 12 + Math.floor(r() * 4), s = sf("#ffffff", P.sign); squad(g, N, -2.4, 2.4, Math.min(h - 1.6, 5.2), Math.min(h - 1.6, 5.2) + 1.2, .22, s, signUV(k)); }
    if (st.vents) for (let k = 0; k < 3; k++) { const z = -d * .6 + k * d * .6, y = h + roofTopLocal(o, .9, z); g.cyl(.9, y - .3, z, .35, .35, y + .7, 10, sf("#b8bfc4", P.metal)); g.cyl(.9, y + .7, z, .5, .1, y + 1.1, 10, sf("#9aa3a8", P.metal)); }
    // ---- palan du port
    if (st.hoist && o._roof && o._roof.t === "gz") { const y = h + RB + w * o._roof.s - .6; g.box(-.12, y - .12, -d - 1.6, .12, y + .12, -d + .4, wood); g.cyl(0, y - 2.2, -d - 1.45, .02, .02, y - .1, 4, sf(DARK)); g.box(-.12, y - 2.4, -d - 1.57, .12, y - 2.15, -d - 1.33, metal); }
    // ---- grenier à foin de la grange
    if (st.hayloft && floors >= 2) { const y = (floors - 1) * FLOOR + .4; sbox(g, N, -1.1, 1.1, y, y + 2.4, .2, .3, sf("#2a1a12"), null, white); for (const q of [[-1.25, -1.1], [1.1, 1.25]]) sbox(g, N, q[0], q[1], y - .1, y + 2.55, .2, .36, white, null, white); sbox(g, N, -1.25, 1.25, y + 2.4, y + 2.55, .2, .36, white, null, white); const p = spt(N, 0, h + 1.2, .2); g.box(p[0] - .1, p[1] - .1, p[2] - 1.4, p[0] + .1, p[1] + .1, p[2] + .2, wood); }
    // ---- poutres d'adobe (vigas), pots, piments
    if (st.vigas) for (const sd of [N, Sd]) { const n = Math.floor(sd.L * 2 / 1.1); for (let k = 0; k < n; k++) { const u = -sd.L + .5 + k * 1.1, p = spt(sd, u, h - .45, .2); g.hcyl(p[0] + (sd.nrm[0] * .35), p[1], p[2] + sd.nrm[1] * .35, .13, .7, sd.k === "E" || sd.k === "W" ? "x" : "z", 6, sf("#6a4a2f", P.plank)); } }
    if (st.pots) { for (const u of [-2.6, 2.6]) { const p = spt(N, u, 0, .9); g.cyl(p[0], 0, p[2], .3, .42, .7, 9, sf("#c0683a")); palmTuft(g, p[0], .7, p[2], .5, "#5f8f3f"); } const p = spt(N, -2.15, 0, .3); for (let k = 0; k < 7; k++) g.box(p[0] - .07, 2.6 - k * .16, p[2] - .07, p[0] + .07, 2.73 - k * .16, p[2] + .07, sf("#c0302a")); }
    // ---- lucarnes de ferme (versant nord)
    if (st.dormers && o._roof && o._roof.t === "gx") for (const x of [-w * .45, w * .45]) dormer(c, x);
    // ---- pagode : avant-toits à chaque étage, poteaux, lanternes
    if (st.eaves) for (let f = 1; f < floors; f++) eaveRing(c, f * FLOOR + .1, sf(st.eaves, P.tile));
    if (st.posts) { const s = sf(st.posts); for (const sd of SD) { const n = Math.max(1, Math.round((2 * sd.L) / st.bay)); for (let k = 1; k < n; k++) { const u = -sd.L + k * 2 * sd.L / n; sbox(g, sd, u - .14, u + .14, 0, h, .2, .34, s, null, s); } } }
    if (st.lanterns) for (const u of [-2.4, 2.4]) { const p = spt(N, u, 3.2, .9); g.cyl(p[0], p[1] - .3, p[2], .02, .02, p[1] + .4, 4, sf(DARK)); g.cyl(p[0], p[1] - .75, p[2], .26, .26, p[1] - .3, 10, sf("#e8402a", P.glow)); g.cyl(p[0], p[1] - .3, p[2], .27, .12, p[1] - .2, 10, sf(DARK)); }
    // ---- tour de l'horloge : cadrans
    if (st.clock) clockFaces(c);
  }
  function chimneyH(o, x, z) { return roofTopLocal(o, x, z) + 1.4; }
  function quadAt(g, x, y, z, hw, hh, yaw, n, uv) {
    const c = Math.cos(yaw), s = Math.sin(yaw), ox = Math.sin(yaw) * n, oz = Math.cos(yaw) * n;
    const P0 = (a, b) => [x + ox + c * a, y + b, z + oz - s * a];
    g.quad(P0(-hw, -hh), P0(hw, -hh), P0(hw, hh), P0(-hw, hh), sf("#ffffff", P.sign), uv);
  }
  function waterTank(g, x, y, z, r) {
    const wood = sf("#8a6a4a", P.plank), metal = sf("#3a3f44", P.metal);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.box(x + dx * 1.1 - .1, y, z + dz * 1.1 - .1, x + dx * 1.1 + .1, y + 2.4, z + dz * 1.1 + .1, metal);
    g.box(x - 1.4, y + 2.3, z - 1.4, x + 1.4, y + 2.45, z + 1.4, metal);
    g.cyl(x, y + 2.45, z, 1.35, 1.25, y + 5.2, 14, wood);
    for (const k of [.6, 1.6, 2.5]) g.cyl(x, y + 2.45 + k, z, 1.37 - k * .03, 1.36 - k * .03, y + 2.55 + k, 14, metal, false);
    g.cyl(x, y + 5.2, z, 1.4, .1, y + 6.4, 14, sf("#5a4a3a", P.shingle));
    void r;
  }
  function palmTuft(g, x, y, z, s, colr) { const lc = sf(colr || "#3f8f4a"); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.obox(x + Math.sin(a) * .4 * s, y + .35 * s, z + Math.cos(a) * .4 * s, .14 * s, .04 * s, .55 * s, a, .55, lc); } }
  function roofToy(g, kind, x, y, z, s) {
    if (kind === "donut") {
      for (const k of [-1.2, 1.2]) g.box(x + k - .12, y, z - .12, x + k + .12, y + 1.6, z + .12, sf("#4a4f55", P.metal));
      const R = Math.min(2.4, s * .42), rr = R * .42, cy = y + 1.6 + R + rr;
      // beignet debout face à la rue (anneau vertical : tore couché le long de z)
      const tg = new Geo(2048); tg.torus(0, 0, 0, R, rr, 22, 10, sf("#e8b07a")); tg.torus(0, rr * .25, 0, R, rr * .86, 22, 10, sf("#f27ab0", P.plain));
      for (let i = 0; i < tg.n; i++) { const yy = tg.P[i * 3 + 1], zz = tg.P[i * 3 + 2], ny = tg.N[i * 3 + 1], nz = tg.N[i * 3 + 2]; tg.P[i * 3 + 1] = -zz; tg.P[i * 3 + 2] = yy; tg.N[i * 3 + 1] = -nz; tg.N[i * 3 + 2] = ny; }
      for (let i = 0; i < tg.n; i++) { g.need(1); const j = g.n++; g.P[j * 3] = tg.P[i * 3] + x; g.P[j * 3 + 1] = tg.P[i * 3 + 1] + cy; g.P[j * 3 + 2] = tg.P[i * 3 + 2] + z; g.N.set(tg.N.subarray(i * 3, i * 3 + 3), j * 3); g.C.set(tg.C.subarray(i * 3, i * 3 + 3), j * 3); g.K[j] = tg.K[i]; g.UV[j * 2] = WHITE_UV[0]; g.UV[j * 2 + 1] = WHITE_UV[1]; }
      const sprink = ["#ffffff", "#ffd84a", "#3ff0ff", "#7fd04a"];
      for (let k = 0; k < 18; k++) { const a = k / 18 * TAU, rad = R + (k % 3 - 1) * rr * .35; g.box(x + Math.cos(a) * rad - .06, cy + Math.sin(a) * rad - .06, z - rr * 1.02, x + Math.cos(a) * rad + .06, cy + Math.sin(a) * rad + .06, z - rr * .9, sf(sprink[k % 4])); }
    } else {
      // burger géant
      const R = Math.min(2.3, s * .4), y0 = y + .2;
      g.cyl(x, y0, z, R * .95, R, y0 + .5, 18, sf("#d9a05a")); g.cyl(x, y0 + .5, z, R * 1.02, R * 1.02, y0 + .9, 18, sf("#6a3a22"));
      g.cyl(x, y0 + .9, z, R * 1.08, R * 1.06, y0 + 1.05, 18, sf("#ffd03a")); g.cyl(x, y0 + 1.05, z, R * 1.1, R * 1.1, y0 + 1.2, 18, sf("#5fbf4a"));
      g.cyl(x, y0 + 1.2, z, R, R * .98, y0 + 1.5, 18, sf("#d94a2b")); g.dome(x, y0 + 1.5, z, R, 18, 6, sf("#e0a860"));
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; g.box(x + Math.cos(a) * R * .6 - .05, y0 + 1.5 + R * .7, z + Math.sin(a) * R * .6 - .05, x + Math.cos(a) * R * .6 + .05, y0 + 1.5 + R * .76, z + Math.sin(a) * R * .6 + .05, sf("#fff4d0")); }
    }
  }
  function porch(c, half, wrap) {
    const { g, d, w, st } = c, deck = sf("#a07850", P.plank), post = sf(WHITE), roofS = sf(st.roofCol || "#5a5f68", st.roofPat || P.shingle), dep = 2.4;
    g.box(-half, -.05, -d - .2 - dep, half, .14, -d - .2, [deck, deck, deck, null, deck, deck]);
    const n = Math.max(2, Math.round(half * 2 / 2.4));
    for (let k = 0; k <= n; k++) { const x = -half + .2 + k * (2 * half - .4) / n; if (Math.abs(x) < 1.2) continue; g.box(x - .11, .14, -d - .2 - dep + .1, x + .11, 3.25, -d - .2 - dep + .32, post); }
    for (const sg of [-1, 1]) { const a = sg < 0 ? -half + .2 : 1.4, b = sg < 0 ? -1.4 : half - .2; g.box(a, .14, -d - .2 - dep + .15, b, .24, -d - .2 - dep + .27, post); g.box(a, .95, -d - .2 - dep + .15, b, 1.03, -d - .2 - dep + .27, post); for (let x = a; x < b; x += .35) g.box(x - .025, .24, -d - .2 - dep + .18, x + .025, .95, -d - .2 - dep + .24, post); }
    g.oq([-half - .2, 3.25, -d - .2 - dep - .3], [half + .2, 3.25, -d - .2 - dep - .3], [half + .2, 3.75, -d - .2], [-half - .2, 3.75, -d - .2], roofS, [0, 1, 0]);
    g.oq([half + .2, 3.12, -d - .2 - dep - .3], [-half - .2, 3.12, -d - .2 - dep - .3], [-half - .2, 3.62, -d - .2], [half + .2, 3.62, -d - .2], sf("#e8e2d6"), [0, -1, 0]);
    g.box(-half - .2, 3.12, -d - .2 - dep - .32, half + .2, 3.27, -d - .2 - dep - .22, post);
    // marches
    g.box(-1.2, -.05, -d - .2 - dep - .4, 1.2, .07, -d - .2 - dep, deck);
    if (wrap) { g.box(-w - .2 - dep, -.05, -d - .2 - dep, -w - .2, .14, d * .2, deck); for (let z = -d; z < d * .2; z += 2.4) g.box(-w - .2 - dep + .1, .14, z - .11, -w - .2 - dep + .32, 3.25, z + .11, post); g.oq([-w - .2 - dep - .3, 3.25, d * .2], [-w - .2 - dep - .3, 3.25, -d - .2 - dep - .3], [-w - .2, 3.75, -d - .2], [-w - .2, 3.75, d * .2], roofS, [0, 1, 0]); g.oq([-w - .2 - dep - .3, 3.12, d * .2], [-w - .2 - dep - .3, 3.12, -d - .2 - dep - .3], [-w - .2, 3.62, -d - .2], [-w - .2, 3.62, d * .2], sf("#e8e2d6"), [0, -1, 0]); }
    // banc / balancelle
    g.box(1.8, .14, -d - .55, Math.min(half - .3, 3.4), .6, -d - .25, sf("#6a4a30", P.plank)); g.box(1.8, .78, -d - .32, Math.min(half - .3, 3.4), 1.25, -d - .22, sf("#6a4a30", P.plank));
  }
  function balcony(c, sd, u0, u1, y, dep, s, wood) {
    const { g, gl } = c, rail = wood ? sf("#6a4228", P.plank) : sf("#3a3f44", P.metal);
    u0 = Math.max(-sd.L - .2, u0); u1 = Math.min(sd.L + .2, u1);
    sbox(g, sd, u0, u1, y - .2, y + .02, .2, .2 + dep, s, null, s);
    sbox(g, sd, u0, u1, y + 1.0, y + 1.08, .2 + dep - .06, .2 + dep, rail, rail, rail);
    sbox(g, sd, u0, u0 + .06, y, y + 1.08, .2, .2 + dep, rail, rail, rail); sbox(g, sd, u1 - .06, u1, y, y + 1.08, .2, .2 + dep, rail, rail, rail);
    if (wood) { for (let u = u0 + .2; u < u1 - .1; u += .26) sbox(g, sd, u - .08, u + .08, y + .02, y + 1.0, .2 + dep - .05, .2 + dep - .01, rail, rail, rail); for (let u = u0 + .6; u < u1 - .4; u += 2.1) { sbox(g, sd, u, u + 1, y + 1.08, y + 1.32, .2 + dep - .25, .2 + dep + .05, sf("#7a4a2f", P.plank), null, sf("#6a3a22")); for (let k = 0; k < 4; k++) sbox(g, sd, u + .1 + k * .24, u + .26 + k * .24, y + 1.3, y + 1.48, .2 + dep - .2, .2 + dep, sf(k % 2 ? "#e63946" : "#4f8f3f"), null, sf("#3f7f2f")); } }
    else { for (let u = u0 + .15; u < u1 - .05; u += .16) sbox(g, sd, u - .015, u + .015, y + .02, y + 1.0, .2 + dep - .05, .2 + dep - .02, rail, rail, rail); if (c.r() < .5) { const p = spt(sd, u0 + .4, y, .2 + dep * .5); g.cyl(p[0], y, p[2], .2, .16, y + .4, 8, sf("#c0683a")); g.box(p[0] - .25, y + .4, p[2] - .25, p[0] + .25, y + .9, p[2] + .25, sf("#4f8f3f")); } }
    void gl;
  }
  function fireEscape(c, sd) {
    const { g, floors } = c, m = sf("#2f3438", P.metal), u0 = -sd.L * .6, u1 = u0 + 3.2;
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR - .1;
      sbox(g, sd, u0, u1, y - .06, y, .2, 1.3, m, m, m);
      sbox(g, sd, u0, u1, y + .95, y + 1.0, 1.25, 1.3, m, m, m); sbox(g, sd, u0, u0 + .05, y, y + 1.0, .2, 1.3, m, m, m); sbox(g, sd, u1 - .05, u1, y, y + 1.0, .2, 1.3, m, m, m);
      for (let u = u0 + .3; u < u1; u += .4) sbox(g, sd, u - .015, u + .015, y, y + .95, 1.26, 1.29, m, m, m);
      if (f < floors - 1) { const a = spt(sd, f % 2 ? u1 - .3 : u0 + .3, y, .75), b = spt(sd, f % 2 ? u0 + .4 : u1 - .4, y + FLOOR, .75); diag(g, a, b, .5, m); }
    }
  }
  function dormer(c, x) {
    const { o, g, gl, d, h, st } = c, s = o._roof.s, z0 = -d * .45, y0 = h + RB + (d - Math.abs(z0)) * s - .3, wall = st.wall, rc = sf(st.roofCol, P.shingle);
    g.box(x - .9, y0 - .6, z0 - .5, x + .9, y0 + 1.5, z0 + 1.2, [wall, wall, null, null, null, wall]);
    gl.oq([x - .5, y0, z0 - .52], [x + .5, y0, z0 - .52], [x + .5, y0 + 1.1, z0 - .52], [x - .5, y0 + 1.1, z0 - .52], sf("#9fc6d8"), [0, 0, -1]);
    g.box(x - .6, y0 - .1, z0 - .56, x + .6, y0, z0 - .5, sf(WHITE)); g.box(x - .6, y0 + 1.1, z0 - .56, x + .6, y0 + 1.2, z0 - .5, sf(WHITE));
    g.oq([x - 1.1, y0 + 1.4, z0 - .7], [x, y0 + 2.2, z0 - .7], [x, y0 + 2.2, z0 + 1.4], [x - 1.1, y0 + 1.4, z0 + 1.4], rc, [0, 1, 0]);
    g.oq([x, y0 + 2.2, z0 - .7], [x + 1.1, y0 + 1.4, z0 - .7], [x + 1.1, y0 + 1.4, z0 + 1.4], [x, y0 + 2.2, z0 + 1.4], rc, [0, 1, 0]);
    g.ot([x - .9, y0 + 1.5, z0 - .5], [x + .9, y0 + 1.5, z0 - .5], [x, y0 + 2.12, z0 - .5], wall, [0, 0, -1]);
  }
  function eaveRing(c, y, s) {
    const { g, w, d } = c, out = 1.35, th = .14, under = sf("#5a3a2a");
    const W2 = w + .2 + out, D2 = d + .2 + out, Wi = w + .2, Di = d + .2, yo = y - .55;
    const a = [[-W2, yo, -D2], [W2, yo, -D2], [W2, yo, D2], [-W2, yo, D2]], b = [[-Wi, y, -Di], [Wi, y, -Di], [Wi, y, Di], [-Wi, y, Di]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; g.oq(a[j], a[i], b[i], b[j], s, [0, 1, 0]); const dn = (q) => [q[0], q[1] - th, q[2]]; g.oq(dn(a[i]), dn(a[j]), dn(b[j]), dn(b[i]), under, [0, -1, 0]); g.oq(dn(a[j]), dn(a[i]), a[i], a[j], sf("#8a2f24"), [(a[i][0] + a[j][0]) / 2, 0, (a[i][2] + a[j][2]) / 2]); }
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.obox(x * (W2 - .15), yo + .18, z * (D2 - .15), .12, .12, .55, Math.atan2(x, z), -.75, s);
  }
  function clockFaces(c) {
    const { g, h, floors, SD } = c, y = (floors - 1) * FLOOR + 2.1, R = Math.min(1.75, c.w * .38), uv = squareUV(0);
    c.hands = [];
    for (const sd of SD) {
      squad(g, sd, -R, R, y - R, y + R, .26, sf("#ffffff", P.sign), uv);
      const fr = sf("#e8c04a", P.metal); sbox(g, sd, -R - .2, R + .2, y + R, y + R + .2, .2, .34, fr, null, fr); sbox(g, sd, -R - .2, R + .2, y - R - .2, y - R, .2, .34, fr, null, fr); sbox(g, sd, -R - .2, -R, y - R, y + R, .2, .34, fr, null, fr); sbox(g, sd, R, R + .2, y - R, y + R, .2, .34, fr, null, fr);
      const p = spt(sd, 0, y, .3); c.hands.push({ x: p[0], y: p[1], z: p[2], yaw: sd.yaw, R });
    }
    void h;
  }

  // ---------- intérieurs meublés
  function interior(c) {
    const { o, gi, w, d, floors, r } = c, kind = o._inside || "home", s = o._stair || { x0: w - 2.75, x1: w - .45, z0: -d + 1.4, z1: d - 1.1 };
    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR, k = hash((o.seed || 1) * 7 + f * 13);
      // plafonnier
      gi.box(-w * .3 - .3, y + FLOOR - .32, -.3, -w * .3 + .3, y + FLOOR - .24, .3, sf("#fff4d6", P.glow));
      const room = kind === "home" ? (f === 0 ? (k < .5 ? "living" : "kitchen") : k < .4 ? "bed" : k < .75 ? "living" : "kitchen") : kind === "shop" ? (f === 0 ? "shop" : k < .5 ? "living" : "bed") : kind;
      furnish(c, room, y, f, s);
    }
    void r;
  }
  function furnish(c, room, y, f, s) {
    const { gi: g, w, d, r } = c, X0 = -w + .35, Z1 = d - .35, Z0 = -d + .35, XS = s.x0 - .25;
    const wood = sf(pickOf(r, ["#8a5a36", "#a87a4a", "#6a4a30"]), P.plank), fab = sf(pickOf(r, ["#3f6f9f", "#9f3f4f", "#4f8f6f", "#c9a24a", "#6f5f9f", "#d9d0c0"]), P.carpet), white = sf("#f2f2ee"), dark = sf("#2a2e33");
    const avoidChest = f >= 1; // coffre d'étage au coin (-w+1.3, d-1.4)
    const zMax = avoidChest ? d - 2.4 : Z1;
    const rug = (x0, z0, x1, z1) => g.box(x0, y + .02, z0, x1, y + .05, z1, sf(pickOf(r, ["#b84a3a", "#3a6ab8", "#d8b84a", "#5a9a6a", "#9a5ab8"]), P.carpet));
    const plant = (x, z) => { g.cyl(x, y, z, .22, .17, y + .45, 8, sf("#c0683a")); g.box(x - .32, y + .45, z - .32, x + .32, y + 1.15, z + .32, sf("#3f8f4a", P.carpet)); g.box(x - .2, y + 1.1, z - .2, x + .2, y + 1.45, z + .2, sf("#5aa95a", P.carpet)); };
    if (room === "living") {
      // canapé contre le mur ouest, table basse, tapis, télé en face
      const zc = f === 0 ? Math.max(-d + 1.6, -1.7) : Math.min(zMax - 1.4, 0);
      g.box(X0, y, zc - 1.1, X0 + .9, y + .45, zc + 1.1, fab); g.box(X0, y + .45, zc - 1.1, X0 + .28, y + 1.05, zc + 1.1, fab); g.box(X0, y + .45, zc - 1.1, X0 + .9, y + .7, zc - .9, fab); g.box(X0, y + .45, zc + .9, X0 + .9, y + .7, zc + 1.1, fab);
      rug(X0 + 1.1, zc - 1.3, X0 + 3.4, zc + 1.3); g.box(X0 + 1.5, y, zc - .5, X0 + 2.5, y + .42, zc + .5, wood);
      const tx = Math.min(XS - .3, X0 + 4.2); g.box(tx, y, zc - .9, tx + .5, y + .55, zc + .9, wood); g.box(tx + .15, y + .55, zc - .75, tx + .25, y + 1.35, zc + .75, dark); g.box(tx + .1, y + .62, zc - .68, tx + .14, y + 1.28, zc + .68, sf("#5f9fd8", P.glow));
      plant(X0 + .4, zMax - .4);
      g.box(XS - 1.6, y, Z1 - .45, XS - .2, y + 1.9, Z1, wood); for (let k = 0; k < 3; k++) for (let b = 0; b < 6; b++) g.box(XS - 1.5 + b * .22, y + .25 + k * .55, Z1 - .4, XS - 1.33 + b * .22, y + .6 + k * .55, Z1 - .08, sf(pickOf(r, ["#c0392b", "#2980b9", "#27ae60", "#f1c40f", "#8e44ad", "#ecf0f1"])));
      if (f > 0) { g.cyl(X0 + 3, y, Z0 + .6, .04, .04, y + 1.6, 6, dark); g.cyl(X0 + 3, y + 1.4, Z0 + .6, .32, .2, y + 1.75, 10, sf("#fff0c8", P.glow)); }
    } else if (room === "bed") {
      const zb = Math.min(zMax - 1.2, -d + 2.6);
      g.box(X0, y, zb - 1.0, X0 + 2.1, y + .45, zb + 1.0, wood); g.box(X0 + .05, y + .45, zb - .95, X0 + 2.05, y + .7, zb + .95, white); g.box(X0 + .7, y + .7, zb - .95, X0 + 2.05, y + .78, zb + .95, fab);
      g.box(X0, y + .7, zb - .8, X0 + .5, y + .92, zb + .8, white); g.box(X0, y, zb - 1.0, X0 + .12, y + 1.2, zb + 1.0, wood);
      g.box(X0, y, zb + 1.2, X0 + .55, y + .55, zb + 1.75, wood); g.cyl(X0 + .28, y + .55, zb + 1.48, .14, .1, y + .9, 8, sf("#ffe9b0", P.glow));
      rug(X0 + 2.2, zb - .8, X0 + 3.6, zb + .8);
      g.box(XS - 1.8, y, Z1 - .65, XS - .3, y + 2.2, Z1, wood); g.box(XS - 1.06, y + .3, Z1 - .67, XS - 1.02, y + 2.0, Z1 - .64, dark);
      if (Z1 - .65 > zMax) {} else plant(X0 + .4, zMax - .3);
    } else if (room === "kitchen") {
      g.box(XS - 3.8, y, Z1 - .65, XS - .3, y + .9, Z1, white); g.box(XS - 3.8, y + .9, Z1 - .68, XS - .3, y + .96, Z1, sf("#3a3f44", P.stone));
      g.box(XS - 4.6, y, Z1 - .7, XS - 3.85, y + 1.95, Z1, sf("#e8eef2", P.metal)); g.box(XS - 2.4, y + 1.5, Z1 - .4, XS - .4, y + 2.2, Z1, white);
      g.box(XS - 2.0, y + .96, Z1 - .5, XS - 1.4, y + 1.0, Z1 - .15, sf("#2a2e33"));
      const zt = Math.min(zMax - 1.5, 0); g.box(X0 + 1.2, y + .72, zt - .8, X0 + 2.4, y + .78, zt + .8, wood); for (const zz of [zt - .9, zt + .9]) g.box(X0 + 1.55, y, zz - .2, X0 + 2.05, y + .45, zz + .2, wood); for (const xx of [X0 + 1.1, X0 + 2.5]) for (const zz of [zt - .4, zt + .4]) g.box(xx - .22, y, zz - .2, xx + .22, y + .45, zz + .2, wood);
      g.box(X0 + 1.7, y, zt - .05, X0 + 1.9, y + .72, zt + .05, wood);
      g.box(X0 + 1.55, y + .78, zt - .15, X0 + 1.85, y + .95, zt + .15, sf(pickOf(r, ["#f2c14e", "#e63946", "#7fd04a"])));
    } else if (room === "office") {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const x = X0 + .8 + i * 2.1, z = -d + 2.3 + j * 2.6; if (x > XS - 1 || z > zMax - .6) continue;
        g.box(x - .8, y + .72, z - .4, x + .8, y + .77, z + .4, sf("#e6e2da")); g.box(x - .75, y, z - .35, x - .68, y + .72, z + .35, dark); g.box(x + .68, y, z - .35, x + .75, y + .72, z + .35, dark);
        g.box(x - .3, y + .77, z + .15, x + .3, y + 1.2, z + .2, dark); g.box(x - .27, y + .8, z + .14, x + .27, y + 1.17, z + .15, sf("#7fc8f0", P.glow));
        g.box(x - .25, y, z - .9, x + .25, y + .5, z - .5, sf("#3a3f44")); g.box(x - .25, y + .5, z - .95, x + .25, y + 1.05, z - .88, sf("#3a3f44"));
      }
      g.box(X0, y, Z1 - .6, X0 + 1.6, y + 1.3, Z1, sf("#9aa3a8", P.metal)); plant(XS - .5, Z1 - .5); g.cyl(X0 + 2.2, y, Z1 - .4, .18, .18, y + 1.1, 8, white); g.cyl(X0 + 2.2, y + 1.1, Z1 - .4, .16, .14, y + 1.5, 8, sf("#7fc8f0"));
    } else if (room === "shop") {
      for (let k = 0; k < 3; k++) {
        const x = X0 + .8 + k * 1.9; if (x > XS - 1) break;
        g.box(x - .25, y, -d + 2.2, x + .25, y + 1.8, d - 2.6, sf("#d8d6d0", P.metal));
        for (let l = 0; l < 4; l++) { const yy = y + .3 + l * .42; g.box(x - .45, yy - .04, -d + 2.2, x + .45, yy, d - 2.6, sf("#cfd4d8")); for (let z = -d + 2.4; z < d - 2.8; z += .36) g.box(x - .38, yy, z - .14, x + .38, yy + .3, z + .14, sf(pickOf(r, ["#e63946", "#f1c40f", "#2980b9", "#27ae60", "#f39c12", "#ecf0f1", "#9b59b6"]))); }
      }
      g.box(XS - 2.8, y, -d + 1.0, XS - .4, y + 1.0, -d + 1.7, wood); g.box(XS - 1.4, y + 1.0, -d + 1.15, XS - .9, y + 1.35, -d + 1.55, dark); g.box(XS - 1.35, y + 1.15, -d + 1.14, XS - .95, y + 1.32, -d + 1.15, sf("#7fd0a0", P.glow));
      g.box(X0, y, Z1 - .8, X0 + 2, y + 2, Z1, sf("#e8eef2", P.metal)); g.box(X0 + .08, y + .2, Z1 - .82, X0 + 1.92, y + 1.85, Z1 - .8, sf("#bfe6ff", P.glow));
    } else if (room === "depot") {
      const crate = sf("#a07850", P.plank);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = X0 + .8 + i * 1.6, z = -d + 2.2 + j * 2.2; if (x > XS - .8 || z > zMax - .5 || r() < .25 || (f === 0 && (Math.hypot(x, z - 1) < 1.9 || (Math.abs(x) < 2.4 && z < -d + 3.6)))) continue; const hh = 1 + Math.floor(r() * 3); for (let k = 0; k < hh; k++) g.box(x - .55, y + k * 1.1, z - .55, x + .55, y + k * 1.1 + 1.05, z + .55, crate); }
      for (let k = 0; k < 4; k++) g.cyl(XS - .6, y, Z0 + .6 + k * .8, .32, .32, y + 1.0, 10, sf(pickOf(r, ["#2980b9", "#c0392b", "#27ae60"]), P.metal));
      g.box(X0, y, Z0, X0 + .5, y + 3.2, zMax, sf("#d07a2a", P.metal)); for (let l = 1; l < 4; l++) g.box(X0, y + l * .95, Z0, X0 + 1.1, y + l * .95 + .06, zMax, sf("#7d8287", P.metal));
    } else if (room === "barn") {
      const hay = sf("#e0c060", P.carpet);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) g.box(X0 + i * 1.3, y + k * .62, Z1 - 1.0 - (avoidChest ? 1.3 : 0), X0 + i * 1.3 + 1.2, y + .6 + k * .62, Z1 - .2 - (avoidChest ? 1.3 : 0), hay);
      for (let k = 0; k < 3; k++) { const z = -d + 1.5 + k * 2.2; if (z > zMax - .5) break; g.box(X0 + 2.6, y, z, X0 + 2.7, y + 1.3, z + 2.0, wood); g.box(X0, y + 1.1, z, X0 + 2.7, y + 1.2, z + .1, wood); }
      g.box(XS - .5, y + 1.0, Z0, XS - .4, y + 2.2, Z0 + 2.4, wood); for (let k = 0; k < 4; k++) g.box(XS - .45, y + 1.2 + k * .25, Z0 + .3 + k * .5, XS - .3, y + 1.9, Z0 + .4 + k * .5, sf("#5a5f66", P.metal));
    } else if (room === "diner") {
      const red = sf("#d93a3a", P.carpet), chrome = sf("#d8dde2", P.metal);
      for (let k = 0; k < 3; k++) { const z = -d + 1.4 + k * 2.4; if (z > zMax - 1) break; g.box(X0, y, z - .9, X0 + .7, y + .5, z - .45, red); g.box(X0, y + .5, z - .9, X0 + .7, y + 1.1, z - .75, red); g.box(X0, y, z + .45, X0 + .7, y + .5, z + .9, red); g.box(X0, y + .5, z + .75, X0 + .7, y + 1.1, z + .9, red); g.box(X0 + .05, y + .72, z - .4, X0 + 1.2, y + .78, z + .4, sf("#f4f4f0")); g.box(X0 + .6, y, z - .05, X0 + .7, y + .72, z + .05, chrome); }
      g.box(XS - 1.6, y, -d + 1, XS - .8, y + 1.05, d - 2.2, chrome); g.box(XS - 1.7, y + 1.05, -d + .95, XS - .7, y + 1.12, d - 2.15, sf("#e8455e"));
      for (let z = -d + 1.4; z < d - 2.4; z += .9) { g.cyl(XS - 2.1, y, z, .05, .05, y + .7, 6, chrome); g.cyl(XS - 2.1, y + .7, z, .22, .22, y + .82, 10, red); }
      g.box(XS - .7, y + 1.4, -d + 1, XS - .4, y + 1.9, d - 2.2, sf("#e8eef2", P.metal));
    } else if (room === "lab") {
      for (let i = 0; i < 2; i++) { const x = X0 + 1.2 + i * 2.6; if (x > XS - 1) break; g.box(x - .9, y, -d + 1.4, x + .9, y + .9, -d + 2.2, sf("#cfd4d8", P.metal)); g.obox(x, y + 1.1, -d + 1.7, .8, .3, .05, 0, .5, dark); g.box(x - .7, y + .95, -d + 1.62, x + .7, y + 1.25, -d + 1.66, sf("#3ff0a0", P.glow)); }
      for (let k = 0; k < 3; k++) { const z = -d + 3.4 + k * 1.0; if (z > zMax - .6) break; g.box(X0, y, z, X0 + .8, y + 2.2, z + .8, dark); for (let l = 0; l < 6; l++) g.box(X0 + .81, y + .3 + l * .3, z + .15, X0 + .83, y + .36 + l * .3, z + .25, sf(l % 2 ? "#3ff0a0" : "#ff5050", P.glow)); }
      g.box(XS - 2.4, y + .85, Z1 - 1.0, XS - .4, y + .9, Z1 - .2, white); g.box(XS - 2.3, y, Z1 - .9, XS - 2.2, y + .85, Z1 - .3, dark); g.box(XS - .6, y, Z1 - .9, XS - .5, y + .85, Z1 - .3, dark);
      g.cyl(XS - 1.4, y + .9, Z1 - .6, .12, .1, y + 1.2, 8, sf("#7fd0ff", P.glow));
    } else if (room === "pagoda") {
      const lac = sf("#7a2a20", P.plank), cush = sf(pickOf(r, ["#e8b04a", "#c0392b", "#2f5d57"]), P.carpet);
      for (let k = 0; k < 2; k++) { const z = -d + 2.2 + k * 3; if (z > zMax - 1) break; const x = X0 + 1.8; g.box(x - .8, y + .32, z - .6, x + .8, y + .38, z + .6, lac); for (const [dx, dz] of [[-.7, -.5], [.7, -.5], [.7, .5], [-.7, .5]]) g.box(x + dx - .04, y, z + dz - .04, x + dx + .04, y + .32, z + dz + .04, lac); for (const [dx, dz] of [[-1.2, 0], [1.2, 0], [0, -1], [0, 1]]) g.box(x + dx - .3, y, z + dz - .3, x + dx + .3, y + .14, z + dz + .3, cush); }
      for (let k = 0; k < 3; k++) { const x = XS - 2.4 + k * .66; g.obox(x, y + .9, Z1 - .5, .32, .9, .02, (k % 2 ? .35 : -.35), 0, sf("#f4ead0", P.paper)); }
      g.cyl(X0 + .4, y, Z1 - .5 - (avoidChest ? 1.6 : 0), .16, .2, y + .3, 8, sf("#2f5d57")); g.box(X0 + .1, y + .3, Z1 - .8 - (avoidChest ? 1.6 : 0), X0 + .7, y + .7, Z1 - .2 - (avoidChest ? 1.6 : 0), sf("#3f7f3f", P.carpet));
      g.cyl(XS - .8, y + FLOOR - 1.4, -d + 1.2, .25, .25, y + FLOOR - .9, 10, sf("#e8402a", P.glow));
    }
  }

  /* ============================================================ modèle et intégration à la vue */
  const prevModel = A.objectModel;
  A.objectModel = function (o) {
    if (!o || o.type !== "house" || !o._arch || !o._stair) return prevModel.apply(this, arguments);
    try {
      const c = build(o), grp = new T.Group();
      const ext = new T.Mesh(c.g.geometry(), MAT); ext.castShadow = true; ext.receiveShadow = true; ext.userData.shared = true;
      const glass = new T.Mesh(c.gl.geometry(), GLASS); glass.userData.shared = true; glass.renderOrder = 2; glass.castShadow = false;
      const inner = new T.Mesh(c.gi.geometry(), MAT); inner.userData.shared = true; inner.castShadow = false; inner.receiveShadow = true;
      // la caméra se heurte à une coque simple, pas aux milliers de triangles du décor
      ext.raycast = glass.raycast = inner.raycast = function () {};
      grp.add(ext, glass, inner, proxy(o));
      if (c.hands) grp.add(clockHands(c.hands));
      grp.position.set(o.x, o.y, o.z); grp.rotation.y = o.yaw || 0;
      Object.assign(grp.userData, { type: "house", hp: o.hp, ch1Arch: o._arch, inner });
      return grp;
    } catch (e) {
      if (!A.__ch1ArchiErr) { A.__ch1ArchiErr = 1; if (root.console) console.warn("[AZUR architecture]", o._arch, e); }
      return prevModel.apply(this, arguments);
    }
  };
  // coque pour les rayons de la caméra : murs (porte ouverte), planchers et toit, invisible
  let PROXY_MAT = null;
  function proxy(o) {
    const g = new Geo(512), s = sf("#ffffff"), w = o.w, d = o.d, h = o.h;
    g.box(-w - .2, 0, -d - .2, -1.8, h, -d + .2, s); g.box(1.8, 0, -d - .2, w + .2, h, -d + .2, s); g.box(-1.8, 3.05, -d - .2, 1.8, h, -d + .2, s);
    g.box(-w - .2, 0, d - .2, w + .2, h, d + .2, s); g.box(-w - .2, 0, -d + .2, -w + .2, h, d - .2, s); g.box(w - .2, 0, -d + .2, w + .2, h, d - .2, s);
    const st = o._stair;
    for (let f = 1; f < (o.floors || 1); f++) { const y = f * FLOOR; g.box(-w, y - .22, -d, st ? st.x0 : w, y, d, s); }
    g.box(-w, h - .22, -d, w, h + .24, d, s);
    if (!PROXY_MAT) PROXY_MAT = new T.MeshBasicMaterial({ visible: false });
    const m = new T.Mesh(g.geometry(), PROXY_MAT); m.visible = false; m.userData.shared = true; return m;
  }
  function clockHands(list) {
    const grp = new T.Group();
    for (const h0 of list) {
      const pivot = new T.Group(); pivot.position.set(h0.x, h0.y, h0.z); pivot.rotation.y = h0.yaw;
      const big = new T.Mesh(new T.BoxGeometry(.1, h0.R * .85, .05), HANDS); big.geometry.translate(0, h0.R * .38, 0);
      const small = new T.Mesh(new T.BoxGeometry(.16, h0.R * .55, .05), HANDS); small.geometry.translate(0, h0.R * .24, .03);
      const hub = new T.Mesh(new T.CylinderGeometry(.14, .14, .08, 10), HANDS); hub.rotation.x = Math.PI / 2;
      pivot.add(big, small, hub); grp.add(pivot);
      pivot.userData.big = big; pivot.userData.small = small;
    }
    grp.userData.clock = true;
    grp.onBeforeRender = function () {};
    grp.traverse((m) => { if (m.isMesh) m.raycast = function () {}; });
    CLOCKS.add(grp);
    return grp;
  }
  const CLOCKS = new Set();

  /* ---------------------------------------------------- silhouettes lointaines (instances) */
  function lodGeo(kind) {
    const g = new Geo(256), wl = { c: [1, 1, 1], p: 30 }, tp = { c: [1, 1, 1], p: 17 }, rf = { c: [1, 1, 1], p: 0 };
    if (kind === "body") { g.box(-.5, 0, -.5, .5, 1, .5, [wl, wl, tp, null, wl, wl]); return g.geometry(); }
    if (kind === "flat") { g.box(-.5, 0, -.5, .5, 1, .5, [rf, rf, rf, null, rf, rf]); return g.geometry(); }
    if (kind === "gz" || kind === "gx") {
      const P2 = (a, b, y) => (kind === "gz" ? [a, y, b] : [b, y, a]);
      const up = [0, 1, 0], e0 = P2(0, -1, 0), e1 = P2(0, 1, 0);
      g.oq(P2(1, -1, 0), P2(1, 1, 0), P2(0, 1, 1), P2(0, -1, 1), rf, up); g.oq(P2(-1, 1, 0), P2(-1, -1, 0), P2(0, -1, 1), P2(0, 1, 1), rf, up);
      g.ot(P2(-1, -1, 0), P2(0, -1, 1), P2(1, -1, 0), rf, e0); g.ot(P2(1, 1, 0), P2(0, 1, 1), P2(-1, 1, 0), rf, e1);
      return g.geometry();
    }
    if (kind === "hip") { const a = [-1, 0, -1], b = [1, 0, -1], c = [1, 0, 1], d = [-1, 0, 1], t = [0, 1, 0]; const up = [0, 1, 0]; g.ot(b, a, t, rf, up); g.ot(c, b, t, rf, up); g.ot(d, c, t, rf, up); g.ot(a, d, t, rf, up); return g.geometry(); }
    if (kind === "gam") { const pr = [[-1, 0], [-.5, .75], [0, 1], [.5, .75], [1, 0]]; for (let i = 0; i < 4; i++) { const p = pr[i], q = pr[i + 1]; g.oq([p[0], p[1], 1], [q[0], q[1], 1], [q[0], q[1], -1], [p[0], p[1], -1], rf, [0, 1, 0]); } for (const z of [-1, 1]) for (let i = 0; i < 4; i++) { const p = pr[i], q = pr[i + 1]; g.ot([0, 0, z], [q[0], q[1], z], [p[0], p[1], z], rf, [0, 0, z]); } return g.geometry(); }
    return null;
  }
  const LOD_KINDS = ["body", "flat", "gz", "gx", "hip", "gam"], LOD_MAX = 1000;
  function ensureLod(view) {
    if (view.__azLod) return view.__azLod;
    mats();
    const grp = new T.Group(); grp.name = "azur-archi-lod"; const meshes = {};
    for (const k of LOD_KINDS) { const m = new T.InstancedMesh(lodGeo(k), LODMAT, LOD_MAX); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.setColorAt(0, new T.Color(1, 1, 1)); m.userData.shared = true; m.raycast = function () {}; meshes[k] = m; grp.add(m); }
    (view.houseLOD && view.houseLOD.parent || view.scene).add(grp);
    view.__azLod = { grp, meshes, t: 0, key: "" };
    return view.__azLod;
  }
  const _dm = new T.Object3D(), _cl = new T.Color(), _wc = new Map();
  function wallTone(o) {
    let c = _wc.get(o.id);
    if (c) return c;
    if (o._arch) { const st = (STYLES[o._arch] || STYLES.apart)(o, rng((o.seed || 1) * 31 + 7)); const w0 = st.wall.c, rc = st.roofCol ? col(st.roofCol) : [.42, .44, .46]; c = { wall: new T.Color(w0[0], w0[1], w0[2]), roof: new T.Color(rc[0], rc[1], rc[2]) }; }
    else { const reg = S.regions[o.region] || S.regions[0]; c = { wall: new T.Color(reg.color || "#cccccc").lerp(new T.Color("#e3e2d6"), .7), roof: new T.Color("#7d8186") }; }
    _wc.set(o.id, c); return c;
  }
  function updateLod(view, w, p, dt) {
    const L = ensureLod(view);
    L.grp.visible = !view.houseLOD || view.houseLOD.visible !== false;
    L.t -= dt || 0;
    if (L.t > 0) return;
    L.t = .3;
    const airborne = p && (p.falling || p.gliding || (w && w.phase === "transport")), far = airborne ? 1700 : 1000;
    const cnt = {}; for (const k of LOD_KINDS) cnt[k] = 0;
    const M = L.meshes;
    for (const o of w.objects) {
      if (o.type !== "house" || o.dead) continue;
      const dist = Math.hypot(o.x - p.x, o.z - p.z);
      if (dist > far) continue;
      const m = view.objects.get(o.id);
      if (m && m.visible) continue;
      if (cnt.body >= LOD_MAX) break;
      const tone = wallTone(o), R = o._roof || { t: "flat" }, yaw = o.yaw || 0;
      _dm.position.set(o.x, o.y, o.z); _dm.rotation.set(0, yaw, 0); _dm.scale.set(o.w * 2 + .4, o.h, o.d * 2 + .4); _dm.updateMatrix();
      M.body.setMatrixAt(cnt.body, _dm.matrix); M.body.setColorAt(cnt.body, tone.wall); cnt.body++;
      let k = R.t === "gz" || R.t === "gx" || R.t === "hip" || R.t === "gam" ? R.t : "flat";
      if (k === "flat") { _dm.position.set(o.x, o.y + o.h, o.z); _dm.scale.set(o.w * 2 + .6, .95, o.d * 2 + .6); _cl.copy(tone.wall).multiplyScalar(.82); }
      else {
        const ov = .5, half = k === "gx" ? o.d : o.w, peak = k === "gam" ? (o.w * .5 * 1.5 + o.w * .5 * .42) : k === "hip" ? Math.min(o.w, o.d) * R.s : half * R.s;
        _dm.position.set(o.x, o.y + o.h + .25, o.z); _dm.scale.set(o.w + ov, peak + .2, o.d + ov); _cl.copy(tone.roof);
      }
      _dm.updateMatrix(); M[k].setMatrixAt(cnt[k], _dm.matrix); M[k].setColorAt(cnt[k], k === "flat" ? _cl : tone.roof); cnt[k]++;
    }
    for (const k of LOD_KINDS) { const m = M[k]; m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  if (VP && VP.update) {
    const prevUpdate = VP.update;
    VP.update = function (w, p, dt, opts) {
      const r = prevUpdate.apply(this, arguments);
      try {
        if (w && p && this.houseLOD) {
          this.houseLOD.count = 0;
          updateLod(this, w, p, dt);
          // intérieurs : seulement de près
          const lim = (this.quality === "low" ? 34 : this.quality === "high" || this.quality === "ultra" ? 70 : 52);
          for (const m of this.objects.values()) { const u = m.userData; if (u.inner && m.visible) u.inner.visible = Math.hypot(m.position.x - p.x, m.position.z - p.z) < lim + 8; }
          const tod = (opts && opts.timeOfDay) || (root.AZUR && root.AZUR.timeOfDay);
          const want = tod === "night" ? 1 : tod === "sunset" ? .45 : 0;
          U.night.value += (want - U.night.value) * Math.min(1, (dt || .016) * 2);
          if (CLOCKS.size) {
            const now = new Date(), hr = (now.getHours() % 12) + now.getMinutes() / 60, mn = now.getMinutes() + now.getSeconds() / 60;
            for (const cg of CLOCKS) { if (!cg.parent) { CLOCKS.delete(cg); continue; } for (const pv of cg.children) { pv.userData.big.rotation.z = -mn / 60 * TAU; pv.userData.small.rotation.z = -hr / 12 * TAU; } }
          }
        }
      } catch (e) { if (!A.__ch1ArchiFrameErr) { A.__ch1ArchiFrameErr = 1; if (root.console) console.warn("[AZUR architecture] vue", e); } }
      return r;
    };
  }
  root.AZArchi = { build, STYLES, version: "94" };
})(typeof globalThis !== "undefined" ? globalThis : this);
