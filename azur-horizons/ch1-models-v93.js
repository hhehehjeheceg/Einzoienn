/* AZUR v93 — ch1-models-v93.js : vrais personnages 3D.
 * Corps skinnés CC0 (Quaternius, Universal Base Characters), habillés à la volée :
 *  - vêtements peints sur le corps par un shader (t-shirt, débardeur, pantalon, gants, ceinture, cagoule…),
 *  - vêtements 3D teintés (pantalon cargo, bottes, gilet, capuche, épaulière),
 *  - cheveux (6 coupes en maillage + crête, queue de cheval, pics, chignon en accessoires),
 *  - accessoires rigides attachés aux os (casques, casquettes, têtes de mascotte, sacs…).
 * Animations capturées CC0 (Universal Animation Library) pilotées depuis l'état du joueur ;
 * les mains rejoignent l'arme, la pioche et le planeur gérés par les anciennes couches.
 * Tant que les fichiers ne sont pas chargés, l'ancien personnage reste affiché. */
(function (root) {
  "use strict";
  const T = root.THREE;
  if (!T || !T.GLTFLoader || root.AZCh1Models) return;
  const BASE = "assets/ch1/chars/";
  const VER = "?v=93";
  const EXT = root.AZ_CH1_EXT || ".glb"; // hébergeurs sans .glb : copie glTF JSON (tools/azur/glb2json.py)
  const loader = new T.GLTFLoader();
  const files = {};
  // ".glb.js" : chaque modèle arrive dans une balise <script> (hébergeurs qui refusent .glb et fetch data:)
  function loadPacked(n, res, rej) {
    const done = () => {
      const pack = root.AZCh1Pack && root.AZCh1Pack[n];
      if (!pack) return rej(new Error("pack manquant " + n));
      try {
        const bin = atob(pack), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        delete root.AZCh1Pack[n];
        loader.parse(buf.buffer, BASE, res, rej);
      } catch (e) { rej(e); }
    };
    if (root.AZCh1Pack && root.AZCh1Pack[n]) return done();
    const sc = root.document.createElement("script");
    sc.src = BASE + n + ".glb.js" + VER;
    sc.async = true;
    sc.onload = done;
    sc.onerror = () => rej(new Error("chargement impossible " + sc.src));
    root.document.head.appendChild(sc);
  }
  const load = (n) => files[n] || (files[n] = new Promise((res, rej) => (EXT === ".glb.js" ? loadPacked(n, res, rej) : loader.load(BASE + n + EXT + VER, res, undefined, rej))));

  /* ============================================================ couleurs */
  const SKIN = { light: "#f2c6a0", fair: "#e9b48c", tan: "#d39a6c", olive: "#b97d50", brown: "#8d5a3b", dark: "#5e3a26" };
  const HAIR = { black: "#1c1816", brown: "#4a2f1f", chestnut: "#6b3f22", red: "#a6421f", blond: "#e0b25a", grey: "#9a958f", white: "#ece8de" };
  const lin = (hex) => new T.Color(hex);
  const TEX_SKIN = { m: [0.385, 0.175, 0.082], f: [0.398, 0.184, 0.085] };

  /* ============================================================ zones du corps */
  const ARM = /^(upperarm|lowerarm|hand|index|middle|pinky|ring|thumb)_/;
  const LEG = /^(thigh|calf|foot|ball)_/;
  const HEAD = /^(Head|neck_01)$/;
  function zoneAttribute(mesh) {
    const g = mesh.geometry;
    if (g.attributes.aZone) return;
    const bones = mesh.skeleton.bones;
    const cls = bones.map((b) => (ARM.test(b.name) ? 0 : LEG.test(b.name) ? 1 : HEAD.test(b.name) ? 2 : 3));
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (!w) continue;
        const c = cls[si.getComponent(i, k)];
        if (c < 3) out[i * 4 + c] += w;
      }
    }
    g.setAttribute("aZone", new T.BufferAttribute(out, 4));
  }

  /* ============================================================ shader de peinture */
  const PAINT_DECL = `
uniform vec3 cSkin,cTopA,cTopB,cTopC,cBotA,cBotB,cBotC,cShoe,cSole,cGlove,cBelt,cBuckle,cHead,cGlow;
uniform vec4 pTop,pTop2,pBot,pShoe,pGlove,pBelt,pHead,pHide,pGlow,bodyL,bodyL2;
varying vec3 vBind; varying vec4 vZone;
float ch1Metal; float ch1Rough; vec3 ch1Emit;
float h31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float band(float v,float a,float b){return step(a,v)*step(v,b);}
vec3 ch1Pat(float id,vec3 A,vec3 B,vec3 C,vec3 P,float sc){
 if(id<.5)return A;
 if(id<1.5){float n=vn(P*7.*sc)*.65+vn(P*17.*sc)*.35;return n<.42?A:(n<.58?B:C);}           // camouflage
 if(id<2.5)return fract(P.y*11.*sc)<.5?A:B;                                                   // rayures
 if(id<3.5){float l=max(step(fract(P.y*9.*sc),.18),step(fract(abs(P.x)*9.*sc+P.z*3.),.18));     // carreaux
   float f=max(step(abs(fract(P.y*9.*sc)-.6),.03),step(abs(fract(abs(P.x)*9.*sc+P.z*3.)-.6),.03));
   return mix(mix(A,B,l*.85),C,f);}
 if(id<4.5)return A*(.86+.28*vn(P*55.));                                                      // fourrure
 if(id<7.5){float b=band(P.y,1.28,1.31)+band(P.y,1.16,1.19);return b>0.?B:A;}                     // gilet fluo
 return A;
}
`;
  const PAINT_FRAG = `
{
 vec3 P=vBind; float ax=abs(P.x); float a=ax-bodyL.x; float y=P.y;
 vec3 tex=diffuseColor.rgb;
 float lum=dot(tex,vec3(.2126,.7152,.0722));
 float rel=clamp(lum/.21,.55,1.5); float relc=clamp(lum/.21,.8,1.2);
 float cloth=mix(1.,relc,pTop2.z);
 bool arm=a>.015&&y>1.2;
 bool headZ=(ax<bodyL2.z&&y>bodyL2.w)||y>bodyL2.w+.075;
 vec3 col=tex*cSkin; ch1Metal=0.; ch1Rough=.62; ch1Emit=vec3(0.);
 float edge=1.;
 if(pHide.x>0.&&y<pHide.x&&y>pHide.y&&!arm)discard;
 if(pHide.w>.5&&headZ&&!arm)discard;
 // bas
 if(pBot.x>.5&&y<pBot.w&&y>pBot.z&&!arm){
   col=ch1Pat(pBot.y,cBotA,cBotB,cBotC,P,1.)*cloth;
   edge=min(smoothstep(0.,.012,abs(y-pBot.z)),smoothstep(0.,.008,abs(y-pBot.w)));
   if(pBot.y>4.5&&pBot.y<5.5){ // salopette : bavette devant
   }
 }
 // haut
 if(pTop.x>.5&&y>=pTop.w&&!headZ&&(a<pTop.z)){
   float neck=bodyL2.w-.012+max(0.,ax-.065)*1.6;
   if(pTop2.x>.5&&pTop2.x<1.5&&P.z>0.)neck-=max(0.,.075-ax)*1.1;          // col en V
   if(pTop2.x>1.5)neck+=.06;                                             // col montant
   if(y<neck||pTop2.x>1.5||arm){
     vec3 c=ch1Pat(pTop.y,cTopA,cTopB,cTopC,P,pTop2.y);
     if(pTop2.w>.5&&!arm&&P.z>0.&&ax<.006)c=cTopC;                         // fermeture éclair
     if(pTop2.w>1.5&&!arm&&P.z>0.&&ax<max(.004,(y-1.2)*.22)&&y>1.2)c=cTopB;  // plastron / chemise ouverte
     col=c*cloth;
     float e1=arm?smoothstep(0.,.01,abs(a-pTop.z)):1.;
     edge=min(edge,min(e1,smoothstep(0.,.01,abs(y-pTop.w))));
     if(!arm)edge=min(edge,smoothstep(0.,.008,abs(y-neck)));
   }
 }
 // ceinture
 if(pBelt.x>.5&&abs(y-pBelt.y)<pBelt.z&&!arm){
   col=cBelt*mix(1.,rel,.3);
   if(ax<.03&&P.z>0.){col=cBuckle;ch1Metal=.8;ch1Rough=.3;}
   edge=min(edge,smoothstep(0.,.004,pBelt.z-abs(y-pBelt.y)));
 }
 // chaussures
 if(pShoe.x>.5&&y<pShoe.y&&!arm){
   col=(y<pShoe.z?cSole:cShoe)*mix(1.,rel,.35);
   edge=min(edge,smoothstep(0.,.01,abs(y-pShoe.y)));
 }
 // gants
 if(pGlove.x>.5&&arm&&a>pGlove.y){
   bool fingers=a>bodyL.y+.1;
   if(!(pGlove.z>.5&&fingers)){
     col=cGlove*mix(1.,rel,.45);
     edge=min(edge,smoothstep(0.,.008,abs(a-pGlove.y)));
     if(pGlove.w>.5){ // or de Midas : métal qui « coule » le long de l'avant-bras
       ch1Metal=.92;ch1Rough=.26;
     }
   }
 }
 if(pGlove.w>.5&&arm&&a>pGlove.y-.12&&a<=pGlove.y){ // gouttes d'or au-dessus du poignet
   float d=vn(P*vec3(9.,38.,38.))-.55+(a-pGlove.y+.12)*4.;
   if(d>.0){col=cGlove;ch1Metal=.92;ch1Rough=.26;}
 }
 // tête
 if(headZ&&!arm){
   float m=pHead.x;
   if(m>.5&&m<1.5){ // cagoule : seule la bande des yeux reste visible
     bool eyes=abs(y-bodyL.z)<.024&&P.z>bodyL.w-.05&&ax<.07;
     if(!eyes){col=cHead*cloth;}
   } else if(m>1.5&&m<2.5){ // foulard sur le bas du visage
     if(y<bodyL.z-.045&&P.z>-.03){col=cHead*cloth;edge=smoothstep(0.,.006,abs(y-(bodyL.z-.045)));}
   } else if(m>2.5&&m<3.5){ // crâne
     col=cTopB;
     vec2 e=vec2(ax-.032,y-bodyL.z);
     if(P.z>bodyL.w-.06&&length(e*vec2(1.,1.25))<.022)col=vec3(.01);
     if(P.z>bodyL.w-.02&&ax<.012&&y<bodyL.z-.025&&y>bodyL.z-.055)col=vec3(.01);
     if(P.z>bodyL.w-.05&&y<bodyL.z-.07&&y>bodyL.z-.09&&fract(P.x*95.)<.18&&ax<.04)col=vec3(.01);
   } else if(m>3.5&&m<4.5){ // peinture de guerre / visage coloré (bandeau)
     if(abs(y-bodyL.z)<.02&&P.z>bodyL.w-.06)col=cHead;
   }
 }
 // squelette sur combinaison
 if(pGlow.x>2.5&&pGlow.x<3.5&&!headZ){
   bool bone=false;
   if(arm){bone=abs(y-1.455)<.02&&a<bodyL.y;if(a>bodyL.y)bone=fract(P.z*40.)<.5;}
   else if(y<pTop.w){bone=abs(ax-.114)<.024&&P.z>-.02&&y>.12;if(abs(y-.54)<.035&&abs(ax-.114)<.04&&P.z>0.)bone=true;}
   else if(P.z>0.){bone=(ax<.013&&y>1.1&&y<1.43)||(ax>.02&&ax<.13&&y>1.12&&y<1.4&&fract((y+ax*.3)*21.)<.42)||(y>.9&&y<1.0&&ax>.03&&ax<.13);}
   else bone=ax<.014&&y>1.0&&y<1.5&&fract(y*28.)<.6;
   if(bone)col=cTopB*mix(1.,rel,.3);
 }
 // lignes néon
 if(pGlow.x>.5&&pGlow.x<2.5&&!headZ){
   float l=0.;
   if(arm)l=step(abs(y-(1.455+.05)),.005)*step(a,pTop.z);
   else if(y>pBot.z+.02){
     l=step(abs(ax-.075),.005)*step(0.,P.z)*step(y,1.42);
     if(y<pTop.w)l=max(l,step(abs(ax-.165),.005));
     if(pGlow.x>1.5)l=max(l,step(abs(fract(y*6.)-.5),.012)*step(0.,P.z)*step(ax,.15));
   }
   if(l>0.){col=cGlow;ch1Emit=cGlow*pGlow.y;}
 }
 // armure
 if(pTop.y>5.5&&pTop.y<6.5&&!headZ&&y>pBot.z){
   ch1Metal=.75;ch1Rough=.32;
   float s=arm?a*9.:y*8.;
   if(fract(s)<.07){col*=.55;}
 }
 diffuseColor.rgb=col*mix(.62,1.,edge);
}
`;
  function paintMaterial(map, U) {
    const m = new T.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 });
    m.userData.shared = true;
    m.userData.azRigid = true;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 aZone; varying vec3 vBind; varying vec4 vZone;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBind = position; vZone = aZone;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + PAINT_DECL)
        .replace("#include <map_fragment>", "#include <map_fragment>\n" + PAINT_FRAG)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = ch1Rough;")
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = ch1Metal;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += ch1Emit;");
    };
    m.customProgramCacheKey = () => "ch1paint-v1";
    return m;
  }

  /* ============================================================ vêtements 3D teintés */
  const GARM_FRAG = `
{
 vec3 t=diffuseColor.rgb; float l=dot(t,vec3(.2126,.7152,.0722));
 float mx=max(t.r,max(t.g,t.b)),mn=min(t.r,min(t.g,t.b));float ch=(mx-mn)/max(mx,1e-4);
 vec3 c;
 if(gMode<.5){c=gA*clamp(l/gRef.x,.35,1.7);}
 else{
   float wG=smoothstep(.0,.04,t.g-max(t.r,t.b));
   float wM=(1.-smoothstep(.12,.3,ch))*smoothstep(.06,.16,l);
   c=mix(gB*clamp(l/gRef.y,.35,1.7),gA*clamp(l/gRef.x,.35,1.7),wG);
   c=mix(c,gC*clamp(l/gRef.z,.5,1.5),wM);
   gMetalOut=wM*gMetal;
 }
 diffuseColor.rgb=c;
}
`;
  function garmentMaterial(map, mode, a, b, c, metal, ref) {
    const U = {
      gMode: { value: mode }, gA: { value: lin(a) }, gB: { value: lin(b || a) }, gC: { value: lin(c || "#9aa0a6") },
      gRef: { value: new T.Vector3(...(ref || [0.06, 0.06, 0.24])) }, gMetal: { value: metal || 0 },
    };
    const m = new T.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0 });
    m.userData.shared = true;
    m.userData.azRigid = true;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float gMode,gMetal; uniform vec3 gA,gB,gC,gRef; float gMetalOut;")
        .replace("#include <map_fragment>", "#include <map_fragment>\ngMetalOut=0.;\n" + GARM_FRAG)
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = max(metalnessFactor, gMetalOut);");
    };
    m.customProgramCacheKey = () => "ch1garm-v1";
    return m;
  }

  /* ============================================================ accessoires (primitives fusionnées) */
  const MATS = {
    main: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.02 }),
    metal: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.8 }),
    glow: new T.MeshBasicMaterial({ vertexColors: true }),
    glass: new T.MeshStandardMaterial({ color: "#a8dcff", roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }),
    fur: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  };
  for (const k in MATS) { MATS[k].userData.shared = true; MATS[k].userData.azRigid = true; }
  const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3();
  class Kit {
    constructor() { this.parts = {}; }
    add(bone, mat, geo, color, pos, rot, scl) {
      _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
      _q.setFromEuler(_e);
      _m4.compose(_v.set(pos[0], pos[1], pos[2]), _q, scl ? _s.set(scl[0], scl[1], scl[2]) : _s.set(1, 1, 1));
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(_m4);
      g.deleteAttribute("uv");
      const c = new T.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute("color", new T.BufferAttribute(col, 3));
      const key = bone + "|" + mat;
      (this.parts[key] || (this.parts[key] = [])).push(g);
      return this;
    }
    sph(bone, mat, c, r, pos, scl, rot, seg) { return this.add(bone, mat, new T.SphereGeometry(r, seg || 18, Math.max(8, (seg || 18) >> 1) + 2), c, pos, rot, scl); }
    hemi(bone, mat, c, r, pos, scl, rot) { return this.add(bone, mat, new T.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c, pos, rot, scl); }
    box(bone, mat, c, sz, pos, rot) { return this.add(bone, mat, new T.BoxGeometry(sz[0], sz[1], sz[2]), c, pos, rot); }
    cyl(bone, mat, c, rt, rb, h, pos, rot, seg, scl) { return this.add(bone, mat, new T.CylinderGeometry(rt, rb, h, seg || 16), c, pos, rot, scl); }
    cone(bone, mat, c, r, h, pos, rot, seg) { return this.add(bone, mat, new T.ConeGeometry(r, h, seg || 10), c, pos, rot); }
    tor(bone, mat, c, R, r, pos, rot, scl, arc) { return this.add(bone, mat, new T.TorusGeometry(R, r, 8, 24, arc || Math.PI * 2), c, pos, rot, scl); }
    cap(bone, mat, c, r, len, pos, rot, scl) { return this.add(bone, mat, new T.CapsuleGeometry(r, len, 4, 10), c, pos, rot, scl); }
    build() {
      const out = [];
      for (const key in this.parts) {
        const [bone, mat] = key.split("|");
        const list = this.parts[key];
        let total = 0;
        for (const g of list) total += g.attributes.position.count;
        const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
        let o = 0;
        for (const g of list) {
          pos.set(g.attributes.position.array, o * 3);
          nor.set(g.attributes.normal.array, o * 3);
          col.set(g.attributes.color.array, o * 3);
          o += g.attributes.position.count;
          g.dispose();
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(pos, 3));
        geo.setAttribute("normal", new T.BufferAttribute(nor, 3));
        geo.setAttribute("color", new T.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        geo.userData.ch1Keep = true;
        out.push({ bone, mat, geo });
      }
      return out;
    }
  }

  /* Repères de la tête et du corps (pose de liaison, mètres, avant = +Z). */
  function headFrame(L) {
    return { x: 0, y: L.headY, z: L.headZ, top: L.headTop, rx: L.headRX, front: L.headFront, back: L.headBack, eyeY: L.eyeY, eyeZ: L.eyeZ };
  }

  const ACC = {
    cap(k, H, c, c2) {
      k.hemi("Head", "main", c, 1, [H.x, H.top - 0.085, H.z - 0.005], [H.rx * 1.12, 0.115, H.rx * 1.2]);
      k.cyl("Head", "main", c2 || c, H.rx * 1.12, H.rx * 1.12, 0.012, [H.x, H.top - 0.085, H.z - 0.005], [0, 0, 0], 20, [1, 1, 1.08]);
      k.box("Head", "main", c2 || c, [0.15, 0.012, 0.1], [H.x, H.top - 0.09, H.front + 0.03], [0.12, 0, 0]);
      k.sph("Head", "main", c2 || c, 0.012, [H.x, H.top + 0.025, H.z]);
    },
    beret(k, H, c) {
      k.sph("Head", "main", c, 1, [H.x - 0.02, H.top - 0.035, H.z - 0.01], [H.rx * 1.25, 0.045, H.rx * 1.3], [0, 0, 0.18]);
      k.tor("Head", "main", "#2a2420", H.rx * 1.02, 0.009, [H.x, H.top - 0.07, H.z], [Math.PI / 2, 0, 0.12]);
    },
    beanie(k, H, c, c2) {
      k.hemi("Head", "main", c, 1, [H.x, H.top - 0.1, H.z - 0.008], [H.rx * 1.13, 0.13, H.rx * 1.22]);
      k.tor("Head", "main", c2 || c, H.rx * 1.1, 0.022, [H.x, H.top - 0.1, H.z - 0.008], [Math.PI / 2, 0, 0], [1, 1.1, 1]);
      k.sph("Head", "main", c2 || c, 0.032, [H.x, H.top + 0.035, H.z - 0.01]);
    },
    helmet(k, H, c, c2) {
      k.hemi("Head", "main", c, 1, [H.x, H.top - 0.1, H.z - 0.01], [H.rx * 1.3, 0.15, H.rx * 1.38]);
      k.cyl("Head", "main", c2 || c, H.rx * 1.36, H.rx * 1.4, 0.02, [H.x, H.top - 0.1, H.z - 0.01], [0, 0, 0], 22, [1, 1, 1.06]);
      k.box("Head", "main", "#2b2a26", [0.012, 0.11, 0.012], [H.x + H.rx * 1.05, H.top - 0.16, H.z], [0, 0, 0.1]);
      k.box("Head", "main", "#2b2a26", [0.012, 0.11, 0.012], [H.x - H.rx * 1.05, H.top - 0.16, H.z], [0, 0, -0.1]);
    },
    hardhat(k, H, c) {
      k.hemi("Head", "main", c, 1, [H.x, H.top - 0.075, H.z - 0.01], [H.rx * 1.14, 0.12, H.rx * 1.22]);
      k.cyl("Head", "main", c, H.rx * 1.32, H.rx * 1.36, 0.012, [H.x, H.top - 0.075, H.z + 0.012], [0, 0, 0], 24, [1, 1, 1.1]);
      k.box("Head", "main", c, [0.026, 0.022, 0.18], [H.x, H.top + 0.04, H.z - 0.01], [0, 0, 0]);
    },
    safari(k, H, c, c2) {
      k.hemi("Head", "main", c, 1, [H.x, H.top - 0.08, H.z - 0.005], [H.rx * 1.18, 0.12, H.rx * 1.26]);
      k.cyl("Head", "main", c, H.rx * 2.05, H.rx * 2.1, 0.012, [H.x, H.top - 0.075, H.z], [0, 0, 0], 26);
      k.cyl("Head", "main", c2 || "#6b5a3e", H.rx * 1.2, H.rx * 1.2, 0.025, [H.x, H.top - 0.06, H.z - 0.005], [0, 0, 0], 22, [1, 1, 1.07]);
    },
    straw(k, H, c, c2) {
      k.cyl("Head", "main", c, H.rx * 0.95, H.rx * 1.15, 0.1, [H.x, H.top - 0.02, H.z - 0.005], [0, 0, 0], 20);
      k.cyl("Head", "main", c, H.rx * 2.5, H.rx * 2.55, 0.012, [H.x, H.top - 0.07, H.z], [0.06, 0, 0], 28);
      k.cyl("Head", "main", c2 || "#c0392b", H.rx * 1.16, H.rx * 1.16, 0.025, [H.x, H.top - 0.05, H.z - 0.005], [0, 0, 0], 20);
    },
    goggles(k, H, c, lens, up) {
      const y = up ? H.top - 0.07 : H.eyeY, z = up ? H.front - 0.02 : H.eyeZ + 0.03;
      k.tor("Head", "main", "#1d1d1f", H.rx * 1.13, 0.009, [H.x, y, H.z + 0.005], [Math.PI / 2, 0, 0], [1, 1.12, 1]);
      for (const s of [-1, 1]) {
        k.cyl("Head", "main", c, 0.026, 0.028, 0.03, [H.x + s * 0.034, y, z], [Math.PI / 2, 0, 0], 14);
        k.cyl("Head", "glow", lens, 0.021, 0.021, 0.006, [H.x + s * 0.034, y, z + 0.016], [Math.PI / 2, 0, 0], 14);
      }
    },
    nvg(k, H, lens) {
      ACC.goggles(k, H, "#202326", lens, false);
      k.box("Head", "main", "#2a2d31", [0.05, 0.035, 0.05], [H.x, H.top - 0.04, H.front - 0.01], [0.3, 0, 0]);
      for (const s of [-1, 1]) k.cyl("Head", "main", "#202326", 0.016, 0.018, 0.05, [H.x + s * 0.034, H.eyeY + 0.03, H.eyeZ + 0.055], [Math.PI / 2 - 0.25, 0, 0], 12);
    },
    knight(k, H, c, c2, plume) {
      k.cyl("Head", "metal", c, H.rx * 1.25, H.rx * 1.25, 0.2, [H.x, H.top - 0.11, H.z - 0.005], [0, 0, 0], 22, [1, 1, 1.12]);
      k.hemi("Head", "metal", c, 1, [H.x, H.top - 0.012, H.z - 0.005], [H.rx * 1.25, 0.06, H.rx * 1.4]);
      k.box("Head", "main", "#0b0d10", [0.12, 0.016, 0.02], [H.x, H.eyeY + 0.005, H.front + 0.02], [0, 0, 0]);
      k.box("Head", "metal", c2 || c, [0.016, 0.16, 0.03], [H.x, H.eyeY - 0.03, H.front + 0.025], [0, 0, 0]);
      k.tor("Head", "metal", c2 || c, H.rx * 1.27, 0.012, [H.x, H.top - 0.21, H.z], [Math.PI / 2, 0, 0], [1, 1.12, 1]);
      if (plume) for (let i = 0; i < 6; i++) k.sph("Head", "main", plume, 0.04, [H.x, H.top + 0.03 + Math.sin(i * 0.5) * 0.03, H.z - 0.05 * i + 0.06], [0.6, 1, 1.4]);
    },
    visorhelm(k, H, c, visor) {
      k.sph("Head", "main", c, 1, [H.x, H.y + 0.06, H.z - 0.01], [H.rx * 1.32, 0.15, H.rx * 1.4]);
      k.sph("Head", "metal", visor, 1, [H.x, H.eyeY - 0.01, H.front - 0.03], [H.rx * 1.12, 0.055, 0.07]);
      k.box("Head", "main", c, [0.02, 0.05, 0.12], [H.x, H.top + 0.025, H.z - 0.02], [0, 0, 0]);
    },
    bubble(k, H, c) {
      k.sph("Head", "glass", "#ffffff", H.rx * 2.2, [H.x, H.y + 0.09, H.z + 0.01]);
      k.tor("Head", "main", c, H.rx * 1.6, 0.025, [H.x, H.y - 0.06, H.z], [Math.PI / 2, 0, 0], [1, 1.1, 1]);
    },
    bear(k, H, c, c2, eye) {
      k.sph("Head", "fur", c, 1, [H.x, H.y + 0.05, H.z + 0.01], [0.18, 0.18, 0.17], null, 24);
      for (const s of [-1, 1]) {
        k.sph("Head", "fur", c, 0.055, [H.x + s * 0.12, H.top + 0.08, H.z - 0.01], [1, 1, 0.55]);
        k.sph("Head", "fur", c2, 0.034, [H.x + s * 0.12, H.top + 0.08, H.z + 0.012], [1, 1, 0.4]);
        k.sph("Head", "main", eye, 0.026, [H.x + s * 0.06, H.eyeY + 0.025, H.front + 0.045]);
        k.sph("Head", "glow", "#ffffff", 0.007, [H.x + s * 0.055, H.eyeY + 0.035, H.front + 0.069]);
      }
      k.sph("Head", "fur", c2, 1, [H.x, H.eyeY - 0.04, H.front + 0.045], [0.085, 0.06, 0.06]);
      k.sph("Head", "main", "#2a1a1a", 0.022, [H.x, H.eyeY - 0.02, H.front + 0.1], [1.3, 0.9, 1]);
      k.box("Head", "main", "#2a1a1a", [0.05, 0.006, 0.01], [H.x, H.eyeY - 0.07, H.front + 0.1], [0, 0, 0]);
    },
    dino(k, H, c, c2, eye) {
      k.sph("Head", "fur", c, 1, [H.x, H.y + 0.1, H.z - 0.01], [0.16, 0.16, 0.17], null, 22);
      k.sph("Head", "fur", c, 1, [H.x, H.eyeY - 0.03, H.front + 0.09], [0.12, 0.085, 0.13]);
      k.sph("Head", "fur", c2, 1, [H.x, H.eyeY - 0.075, H.front + 0.085], [0.11, 0.04, 0.12]);
      for (let i = -3; i <= 3; i++) k.cone("Head", "main", "#ffffff", 0.011, 0.03, [H.x + i * 0.025, H.eyeY - 0.065, H.front + 0.17 - Math.abs(i) * 0.012], [Math.PI, 0, 0], 6);
      for (const s of [-1, 1]) {
        k.sph("Head", "main", eye, 0.03, [H.x + s * 0.085, H.eyeY + 0.035, H.front + 0.03]);
        k.sph("Head", "main", "#101010", 0.013, [H.x + s * 0.09, H.eyeY + 0.035, H.front + 0.056]);
      }
      for (let i = 0; i < 5; i++) k.cone("Head", "main", c2, 0.03, 0.08, [H.x, H.top + 0.07 - i * 0.012, H.z + 0.06 - i * 0.06], [-0.3 - i * 0.25, 0, 0], 8);
    },
    shark(k, H, c, c2) {
      k.sph("Head", "fur", c, 1, [H.x, H.top - 0.02, H.z - 0.02], [0.16, 0.13, 0.19], null, 22);
      k.cone("Head", "fur", c, 0.06, 0.16, [H.x, H.top + 0.13, H.z - 0.05], [-0.4, 0, 0], 10);
      for (let i = -4; i <= 4; i++) k.cone("Head", "main", "#ffffff", 0.012, 0.035, [H.x + i * 0.024, H.eyeY + 0.06, H.front + 0.03 - Math.abs(i) * 0.008], [Math.PI, 0, 0], 6);
      for (const s of [-1, 1]) {
        k.sph("Head", "main", "#111111", 0.025, [H.x + s * 0.13, H.eyeY + 0.09, H.front - 0.03]);
        k.sph("Head", "glow", "#ffffff", 0.006, [H.x + s * 0.135, H.eyeY + 0.1, H.front - 0.008]);
      }
      k.sph("Head", "fur", c2, 1, [H.x, H.eyeY + 0.075, H.front + 0.01], [0.13, 0.03, 0.05]);
    },
    // coiffures en accessoires
    mohawk(k, H, c) {
      for (let i = 0; i < 7; i++) k.box("Head", "main", c, [0.026, 0.07 + Math.sin(i * 0.45) * 0.03, 0.035], [H.x, H.top + 0.01, H.front - 0.04 - i * 0.03], [-0.2 + i * 0.05, 0, 0]);
    },
    spikes(k, H, c) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = H.rx * 0.6;
        k.cone("Head", "main", c, 0.035, 0.12, [H.x + Math.cos(a) * r, H.top + 0.02, H.z + Math.sin(a) * r], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], 6);
      }
      k.cone("Head", "main", c, 0.04, 0.14, [H.x, H.top + 0.04, H.z], [0, 0, 0], 6);
    },
    pony(k, H, c) {
      k.sph("Head", "main", c, 0.04, [H.x, H.top - 0.05, H.back - 0.015]);
      k.cap("Head", "main", c, 0.032, 0.15, [H.x, H.top - 0.17, H.back - 0.045], [0.25, 0, 0]);
      k.tor("Head", "main", "#2a2a2a", 0.03, 0.008, [H.x, H.top - 0.07, H.back - 0.025], [Math.PI / 2 - 0.4, 0, 0]);
    },
    bun(k, H, c) {
      k.sph("Head", "main", c, 0.055, [H.x, H.top - 0.005, H.back + 0.02]);
    },
    // haut du corps
    vest(k, c, c2, L) {
      const y = L.chestY, zf = L.chestZ, zb = L.backZ;
      k.box("spine_03", "main", c, [0.3, 0.3, 0.05], [0, y, zf + 0.012], [0.06, 0, 0]);
      k.box("spine_03", "main", c, [0.3, 0.32, 0.05], [0, y, zb - 0.01], [-0.04, 0, 0]);
      for (const s of [-1, 0, 1]) k.box("spine_03", "main", c2, [0.075, 0.09, 0.04], [s * 0.085, y - 0.08, zf + 0.05], [0.06, 0, 0]);
      for (const s of [-1, 1]) k.box("spine_03", "main", c2, [0.05, 0.04, 0.3], [s * 0.1, y + 0.17, (zf + zb) / 2], [0, 0, s * 0.25]);
    },
    hivis(k, c, stripe, L) {
      const y = L.chestY, zf = L.chestZ, zb = L.backZ;
      k.box("spine_03", "main", c, [0.31, 0.32, 0.035], [0, y - 0.02, zf + 0.008], [0.06, 0, 0]);
      k.box("spine_03", "main", c, [0.31, 0.34, 0.035], [0, y - 0.02, zb - 0.004], [-0.04, 0, 0]);
      for (const dy of [-0.08, 0.05]) {
        k.box("spine_03", "glow", stripe, [0.312, 0.025, 0.037], [0, y + dy, zf + 0.012], [0.06, 0, 0]);
        k.box("spine_03", "glow", stripe, [0.312, 0.025, 0.037], [0, y + dy, zb - 0.008], [-0.04, 0, 0]);
      }
    },
    chestplate(k, c, c2, L) {
      k.sph("spine_03", "metal", c, 1, [0, L.chestY - 0.01, L.chestZ - 0.045], [0.165, 0.17, 0.065]);
      k.sph("spine_03", "metal", c, 1, [0, L.chestY, L.backZ + 0.035], [0.16, 0.18, 0.05]);
      k.box("spine_03", "metal", c2, [0.018, 0.22, 0.012], [0, L.chestY - 0.01, L.chestZ + 0.018], [0.08, 0, 0]);
      for (const s of [-1, 1]) {
        k.sph("upperarm_" + (s > 0 ? "l" : "r"), "metal", c, 1, [s * (L.shoulderX + 0.03), L.shoulderY + 0.03, L.shoulderZ], [0.075, 0.055, 0.085]);
        k.sph("upperarm_" + (s > 0 ? "l" : "r"), "metal", c2, 1, [s * (L.shoulderX + 0.035), L.shoulderY + 0.04, L.shoulderZ], [0.08, 0.016, 0.09]);
      }
      for (let i = 0; i < 4; i++) {
        const s = i < 2 ? 1 : -1, f = i % 2 ? 1 : -1;
        k.box("pelvis", "metal", c, [0.12, 0.13, 0.03], [s * 0.09, L.waistY - 0.1, f > 0 ? L.chestZ - 0.01 : L.backZ + 0.01], [f * 0.18, 0, s * 0.12]);
      }
    },
    backpack(k, c, c2, L) {
      k.box("spine_03", "main", c, [0.26, 0.3, 0.13], [0, L.chestY - 0.03, L.backZ - 0.07], [0, 0, 0]);
      k.box("spine_03", "main", c2, [0.22, 0.12, 0.05], [0, L.chestY - 0.1, L.backZ - 0.15], [0, 0, 0]);
      k.cyl("spine_03", "main", c2, 0.05, 0.05, 0.27, [0, L.chestY + 0.14, L.backZ - 0.08], [0, 0, Math.PI / 2], 12);
    },
    tank(k, c, c2, L) {
      for (const s of [-1, 1]) {
        k.cap("spine_03", "metal", c, 0.06, 0.24, [s * 0.075, L.chestY, L.backZ - 0.08]);
        k.cyl("spine_03", "main", c2, 0.03, 0.03, 0.05, [s * 0.075, L.chestY + 0.19, L.backZ - 0.08], [0, 0, 0], 10);
      }
    },
    blades(k, c, L) {
      for (const s of [-1, 1]) {
        k.box("spine_03", "metal", c, [0.026, 0.46, 0.008], [s * 0.01, L.chestY - 0.06, L.backZ - 0.035], [0, 0, s * 0.5]);
        k.box("spine_03", "main", "#222", [0.03, 0.1, 0.018], [s * 0.13, L.chestY + 0.13, L.backZ - 0.035], [0, 0, s * 0.5]);
      }
    },
    fin(k, c, L) {
      k.cone("spine_03", "fur", c, 0.09, 0.26, [0, L.chestY + 0.05, L.backZ - 0.1], [-1.1, 0, 0], 4);
    },
    tail(k, c, c2, L) {
      for (let i = 0; i < 6; i++) {
        const r = 0.09 - i * 0.013;
        k.sph("pelvis", "fur", c, 1, [0, L.waistY - 0.08 - i * 0.045, L.backZ - 0.07 - i * 0.075], [r, r, r * 1.3]);
        if (c2 && i < 5) k.cone("pelvis", "main", c2, 0.025, 0.06, [0, L.waistY - 0.08 - i * 0.045 + r, L.backZ - 0.07 - i * 0.075], [0, 0, 0], 6);
      }
    },
    spinespikes(k, c, L) {
      for (let i = 0; i < 4; i++) k.cone("spine_03", "main", c, 0.03, 0.08, [0, L.chestY + 0.15 - i * 0.1, L.backZ - 0.03], [-1.3, 0, 0], 6);
    },
    scarf(k, c, L) {
      k.tor("spine_03", "main", c, 0.085, 0.032, [0, L.neckY - 0.02, L.neckZ], [Math.PI / 2, 0, 0], [1, 1.1, 1]);
      k.box("spine_03", "main", c, [0.06, 0.18, 0.02], [0.05, L.neckY - 0.12, L.backZ - 0.01], [0.1, 0, 0.15]);
    },
    kneepads(k, c, L) {
      for (const s of ["l", "r"]) k.sph("calf_" + s, "main", c, 1, [(s === "l" ? 1 : -1) * L.legX, L.kneeY + 0.01, L.kneeZ + 0.045], [0.05, 0.06, 0.03]);
    },
    holster(k, c, L) {
      k.box("thigh_r", "main", c, [0.04, 0.16, 0.1], [-L.legX - 0.075, L.waistY - 0.2, 0], [0, 0, 0.05]);
      k.box("thigh_r", "main", "#202020", [0.045, 0.03, 0.105], [-L.legX - 0.075, L.waistY - 0.13, 0], [0, 0, 0.05]);
    },
    pouches(k, c, L) {
      for (const s of [-1, 1]) k.box("pelvis", "main", c, [0.07, 0.075, 0.05], [s * 0.15, L.waistY - 0.02, L.chestZ - 0.04], [0, s * 0.5, 0]);
    },
    medallion(k, c, L) {
      k.tor("spine_03", "metal", c, 0.075, 0.004, [0, L.neckY - 0.06, L.neckZ + 0.02], [1.2, 0, 0], [1, 1.25, 1]);
      k.cyl("spine_03", "metal", c, 0.028, 0.028, 0.008, [0, L.chestY + 0.08, L.chestZ + 0.035], [Math.PI / 2, 0, 0], 16);
    },
    rings(k, c, L) {
      for (const s of ["l", "r"]) k.tor("hand_" + s, "metal", c, 0.012, 0.004, [(s === "l" ? 1 : -1) * (L.wristX + 0.13), L.shoulderY - 0.005, L.handZ + 0.005], [0, Math.PI / 2, 0]);
    },
  };

  /* ============================================================ catalogue des tenues */
  // Raccourcis : t = haut, b = bas, s = chaussures, g = gants, belt, head, glow, gear (vêtements 3D), acc (accessoires)
  const TEE = (c, extra) => Object.assign({ c, sleeve: "short" }, extra);
  const RECRUITS = [
    { body: "m", skin: SKIN.tan, hair: "parted", hairC: HAIR.brown, t: TEE("#5d6b3c"), b: { c: "#b7a074" }, s: { c: "#3d2c20" }, g: { c: "#2a2622", fingerless: true }, belt: "#4b3a28", gear: ["pants", "boots"], acc: ["kneepads:#4a5233"] },
    { body: "f", skin: SKIN.fair, hair: "buns", hairC: HAIR.red, t: TEE("#7d8288"), b: { c: "#5c6640" }, s: { c: "#232323" }, belt: "#2a2a2a", gear: ["pants", "boots"], acc: ["holster:#3b3b35"] },
    { body: "m", skin: SKIN.dark, hair: "buzz", hairC: HAIR.black, t: TEE("#2f3f5c", { sleeve: "tank" }), b: { c: "#6f747a", c2: "#4c5156", c3: "#8d9298", pat: "camo" }, s: { c: "#1d1d1d" }, g: { c: "#202020" }, belt: "#222", gear: ["pants", "boots"] },
    { body: "m", skin: SKIN.light, hair: "parted", hairC: HAIR.blond, t: TEE("#e9e6df"), b: { c: "#4d5b6e" }, s: { c: "#5a3f2a" }, belt: "#3a2a1c", gear: ["pants", "boots"], acc: ["backpack:#5a6242:#3f452e"] },
    { body: "f", skin: SKIN.brown, hair: "long", hairC: HAIR.black, t: TEE("#4f5a36", { sleeve: "tank" }), b: { c: "#c2a676" }, s: { c: "#4a3527" }, g: { c: "#2a2622", fingerless: true }, belt: "#4b3a28", gear: ["pants", "boots"] },
    { body: "m", skin: SKIN.olive, hair: "parted", hairC: HAIR.black, beard: true, t: TEE("#22262b"), b: { c: "#5d6640", c2: "#3e4630", c3: "#7d7552", pat: "camo" }, s: { c: "#2b2018" }, belt: "#2a2a2a", gear: ["pants", "boots", "vest:#3e4a2c"] },
    { body: "f", skin: SKIN.light, hair: "long", hairC: HAIR.chestnut, t: TEE("#6e2f33"), b: { c: "#a8875a" }, s: { c: "#3a2b20" }, belt: "#3a2a1c", gear: ["pants", "boots"], acc: ["pony:" + HAIR.chestnut] },
    { body: "m", skin: SKIN.brown, hair: "buzz", hairC: HAIR.black, t: TEE("#7a7f72"), b: { c: "#3d4450" }, s: { c: "#1e1e1e" }, g: { c: "#262626" }, belt: "#222", gear: ["pants", "boots", "vest:#30343a"], acc: ["mohawk:" + HAIR.black] },
  ];

  const LOOKS = {
    "char-kai": { recruit: 0 },
    "char-ambre": { recruit: 1 },
    "char-kai-nuit": { body: "m", skin: SKIN.tan, hair: "parted", hairC: HAIR.black, t: TEE("#2c3138"), b: { c: "#3a4049" }, s: { c: "#121417" }, g: { c: "#15181b", fingerless: true }, belt: "#15181b", gear: ["pants", "boots", "vest:#1a1e23"], acc: ["kneepads:#22262b"] },
    "char-azur": { body: "m", skin: SKIN.olive, hair: "buzz", hairC: HAIR.black, beard: true, t: TEE("#556b3a"), b: { c: "#6e6a4c", c2: "#4b4a33", c3: "#8a7d55", pat: "camo" }, s: { c: "#3a2b20" }, g: { c: "#2b2a24", fingerless: true }, belt: "#3a2b20", gear: ["pants", "boots", "vest:#2e3b24"], acc: ["cap:#3d4a2a:#2e3820", "holster:#2b2a24"] },
    "char-sauge": { body: "f", skin: SKIN.fair, hair: "buns", hairC: HAIR.red, t: TEE("#7d3b2c"), b: { c: "#7a6a52" }, s: { c: "#3a2b20" }, belt: "#3a2b20", gear: ["pants", "boots", "vest:#5a4632"], acc: ["beret:#b0352a"] },
    "char-onyx": { body: "m", skin: SKIN.brown, hair: null, t: TEE("#22282e", { sleeve: "long" }), b: { c: "#2a3138" }, s: { c: "#121518" }, g: { c: "#15181b" }, belt: "#111", head: { mode: "balaclava", c: "#1a1e22" }, gear: ["pants", "boots", "vest:#151a1f"], acc: ["nvg:#53ff9a", "kneepads:#1a1e22"] },
    "char-faille": { body: "f", skin: SKIN.light, hair: "long", hairC: HAIR.black, t: { c: "#151a2e", sleeve: "long", neck: "high", zip: true, c3: "#2ee6ff" }, b: { c: "#151a2e" }, s: { c: "#0e1120", sole: "#2ee6ff" }, g: { c: "#0e1120" }, glow: { c: "#2ee6ff", pat: 1, k: 1.2 }, gear: [], acc: ["pony:" + HAIR.black] },
    "char-midas": { body: "m", skin: SKIN.tan, hair: "parted", hairC: HAIR.blond, brows: "#8a6a2a",
      t: { c: "#16161a", c2: "#f0f0ea", sleeve: "long", neck: "v", open: true }, b: { c: "#15151a" }, s: { c: "#0d0d0f", sole: "#c99a2e" },
      g: { c: "#f2c14e", len: 0.29, midas: true }, belt: "#101012", buckle: "#f2c14e", gear: ["boots"], acc: ["medallion:#f2c14e", "rings:#f2c14e"], midas: true },
    "char-corail": { body: "m", skin: SKIN.tan, hair: "parted", hairC: HAIR.black, t: { c: "#c3322b", c3: "#7b1f1b", sleeve: "long", zip: true }, b: { c: "#2c2f36" }, s: { c: "#e8e6e1", sole: "#bdbab4" }, g: { c: "#efe9dc", len: 0.1 }, head: { mode: "bandana", c: "#1b1b1f" }, gear: ["hood:#c3322b", "pants"] },
    "char-brume": { body: "f", skin: SKIN.fair, hair: "long", hairC: HAIR.blond, t: { c: "#d9443a", c2: "#8f1f1a", c3: "#f2e3c8", pat: "plaid", sleeve: "elbow" }, b: { c: "#3b6db5", hem: 1.32, bib: true }, s: { c: "#5a3a22" }, belt: "#3b6db5", buckle: "#d9d9d9", gear: ["boots"], acc: ["straw:#e8c26a:#c0392b"] },
    "char-iroise": { body: "m", skin: SKIN.light, hair: "parted", hairC: HAIR.chestnut, beard: true, t: { c: "#c9b27b", c2: "#a68f5a", sleeve: "elbow", neck: "v" }, b: { c: "#6b5a3e" }, s: { c: "#4a3527" }, belt: "#4a3527", gear: ["pants", "boots"], acc: ["safari:#d8c08a:#6b5a3e", "pouches:#8a7650", "backpack:#7a6a45:#5a4c30"] },
    "char-silex": { body: "m", skin: SKIN.dark, hair: "buzz", hairC: HAIR.black, t: TEE("#a8875a"), b: { c: "#c2a676", c2: "#a48a5e", c3: "#8a7048", pat: "camo" }, s: { c: "#5a4330" }, g: { c: "#6b5236" }, belt: "#5a4330", head: { mode: "bandana", c: "#c9a877" }, gear: ["pants", "boots", "vest:#7a6340"], acc: ["helmet:#9c8257:#7f6a46", "goggles:#3a3a3a:#ffb347:up"] },
    "char-lumen": { body: "f", skin: SKIN.olive, hair: "buns", hairC: HAIR.black, t: { c: "#eef1f5", c3: "#ff7a1a", sleeve: "long", neck: "high", zip: true }, b: { c: "#eef1f5" }, s: { c: "#d7dbe0", sole: "#ff7a1a" }, g: { c: "#ff7a1a", len: 0.12 }, belt: "#ff7a1a", buckle: "#d7dbe0", gear: [], acc: ["bubble:#ff7a1a", "tank:#d7dbe0:#ff7a1a"] },
    "char-mistral": { body: "m", skin: SKIN.fair, hair: "buzz", hairC: "#ff3fb4", t: { c: "#1a1a24", sleeve: "short" }, b: { c: "#2a2a38" }, s: { c: "#ffffff", sole: "#ff3fb4" }, glow: { c: "#ff3fb4", pat: 2, k: 1.4 }, gear: ["pants"], acc: ["spikes:#ff3fb4", "goggles:#ffffff:#3ee0ff:up"] },
    "char-argile": { body: "f", skin: SKIN.brown, hair: "long", hairC: HAIR.black, t: { c: "#ff7a1a", c2: "#e8eef0", sleeve: "short", pat: "hivis" }, b: { c: "#3a4b6a" }, s: { c: "#4a3527" }, g: { c: "#d9b23a" }, belt: "#3a2b20", gear: ["pants", "boots"], acc: ["hardhat:#ffd42a", "pony:" + HAIR.black] },
    "char-aster": { body: "m", skin: SKIN.light, hair: null, t: { c: "#c9d2dc", c2: "#8b97a6", sleeve: "long", pat: "armor" }, b: { c: "#c9d2dc", pat: "armor" }, s: { c: "#8b97a6" }, g: { c: "#8b97a6" }, belt: "#24426e", gear: [], acc: ["knight:#c9d2dc:#8b97a6:#2f7cff", "chestplate:#c9d2dc:#24426e"] },
    "char-ecume": { body: "f", skin: SKIN.tan, hair: "long", hairC: HAIR.brown, t: { c: "#1f2a38", c3: "#d8352a", sleeve: "long", neck: "high", zip: true }, b: { c: "#1f2a38" }, s: { c: "#222831" }, glow: { c: "#d8352a", pat: 1, k: 0.15 }, gear: [], acc: ["beanie:#d8352a:#b02a20", "tank:#e3e7ea:#d8352a"] },
    "char-lichen": { body: "m", skin: SKIN.light, hair: null, t: { c: "#141418", c2: "#f1ede2", sleeve: "long" }, b: { c: "#141418" }, s: { c: "#141418" }, g: { c: "#141418" }, head: { mode: "skull" }, glow: { pat: 3 }, gear: [] },
    "char-sentinelle": { body: "m", skin: SKIN.dark, hair: null, t: { c: "#5f6b78", c2: "#3a434d", sleeve: "long", pat: "armor" }, b: { c: "#3a434d" }, s: { c: "#1f2329" }, g: { c: "#1f2329" }, belt: "#1f2329", gear: ["boots"], acc: ["visorhelm:#5f6b78:#ff4d2e", "chestplate:#5f6b78:#3a434d", "kneepads:#3a434d"] },
    "char-eclipse": { body: "f", skin: SKIN.light, hair: "long", hairC: HAIR.white, t: { c: "#2a1d4a", c3: "#7a4dff", sleeve: "long", zip: true }, b: { c: "#1a1530" }, s: { c: "#1a1530" }, g: { c: "#1a1530" }, head: { mode: "bandana", c: "#7a4dff" }, glow: { c: "#7a4dff", pat: 1, k: 0.9 }, gear: ["hood:#2a1d4a"], acc: ["blades:#c9ccd8"] },
    "char-aurore": { body: "f", skin: SKIN.fair, hair: "buns", hairC: HAIR.blond, t: { c: "#f4f1e8", c2: "#e0b23f", sleeve: "long", pat: "armor" }, b: { c: "#f4f1e8", pat: "armor" }, s: { c: "#e0b23f" }, g: { c: "#e0b23f" }, belt: "#7a2e1f", buckle: "#e0b23f", gear: [], acc: ["chestplate:#f4f1e8:#e0b23f", "scarf:#7a2e1f"] },
    "char-lyra": { body: "f", skin: SKIN.tan, hair: null, t: { c: "#e6e9ef", c3: "#ff4d7a", sleeve: "long", neck: "high", zip: true }, b: { c: "#e6e9ef" }, s: { c: "#2b3352" }, g: { c: "#2b3352" }, belt: "#2b3352", glow: { c: "#ff4d7a", pat: 1, k: 0.5 }, gear: ["boots"], acc: ["visorhelm:#e6e9ef:#ff8fb0"] },
    "char-nacre": { mascot: "bear", fur: "#5aa6ff", fur2: "#e8f3ff", eye: "#16233d" },
    "char-lyra-corail": { mascot: "bear", fur: "#ff7a6b", fur2: "#fff1e6", eye: "#2a1414" },
    "char-cuivre": { mascot: "dino", fur: "#8a4dff", fur2: "#3ee0c4", eye: "#ffe94a" },
    "char-recif": { mascot: "shark", fur: "#5b7d99", fur2: "#eef3f6", eye: "#151515" },
  };

  function expandMascot(L) {
    const f = L.fur, f2 = L.fur2;
    const acc = L.mascot === "bear" ? ["bear:" + f + ":" + f2 + ":" + L.eye] : L.mascot === "dino" ? ["dino:" + f + ":" + f2 + ":" + L.eye, "tail:" + f + ":" + f2, "spinespikes:" + f2] : ["shark:" + f + ":" + f2, "fin:" + f, "tail:" + f];
    return { body: "m", skin: SKIN.tan, hair: null, hideHead: L.mascot !== "shark", t: { c: f, c2: f2, sleeve: "long", pat: "fur", neck: "high" }, b: { c: f, pat: "fur" }, s: { c: f2 }, g: { c: f }, belly: f2, gear: [], acc, head: L.mascot === "shark" ? { mode: "face" } : null };
  }

  function lookSpec(id, variant) {
    let L = LOOKS[id] || LOOKS["char-kai"];
    if (variant != null) return RECRUITS[variant % RECRUITS.length];
    if (L.recruit != null) return RECRUITS[L.recruit];
    if (L.mascot) return expandMascot(L);
    return L;
  }

  /* ============================================================ modèles */
  const PATS = { solid: 0, camo: 1, stripes: 2, plaid: 3, fur: 4, armor: 6, hivis: 7 };
  const SLEEVE = { tank: -0.03, short: 0.13, elbow: 0.24, long: 0.47 };
  const GEAR = {
    m: { pants: ["peasant_m", /Peasant_Legs/], boots: ["peasant_m", /Peasant_Feet/], tallboots: ["ranger_m", /Feet_Boots/], hood: ["ranger_m", /Head_Hood/], vest: ["ranger_m", /Ranger_Body/] },
    f: { pants: ["peasant_f", /Peasant_Legs/], boots: ["peasant_f", /Peasant_Feet/], tallboots: ["ranger_f", /Ranger_Feet/], hood: ["ranger_f", /Head_Hood/], vest: ["ranger_f", /Ranger_Body/] },
  };
  let anims = null;
  const bodies = {};

  async function bodyInfo(sex) {
    if (bodies[sex]) return bodies[sex];
    const g = await load(sex === "f" ? "body_f" : "body_m");
    const meshes = {};
    g.scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const mn = o.material && o.material.name;
      if (/Eyes/.test(mn)) meshes.eyes = o;
      else if (/Hair/.test(mn)) meshes.brows = o;
      else meshes.body = o;
    });
    zoneAttribute(meshes.body);
    const geo = meshes.body.geometry;
    // repères de la pose de liaison
    const bonesW = {};
    g.scene.updateMatrixWorld(true);
    for (const b of meshes.body.skeleton.bones) bonesW[b.name] = b.getWorldPosition(new T.Vector3());
    const pos = geo.attributes.position, zone = geo.attributes.aZone;
    const hb = new T.Box3();
    let chestZ = -1, backZ = 1;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (zone.getZ(i) > 0.7 && y > bonesW.Head.y - 0.02) hb.expandByPoint(_v.set(x, y, z));
      if (Math.abs(x) < 0.05 && Math.abs(y - bonesW.spine_03.y - 0.04) < 0.03) { chestZ = Math.max(chestZ, z); backZ = Math.min(backZ, z); }
    }
    meshes.eyes.geometry.computeBoundingBox();
    const eb = meshes.eyes.geometry.boundingBox;
    const L = {
      sex, shoulderX: bonesW.upperarm_l.x, shoulderY: bonesW.upperarm_l.y, shoulderZ: bonesW.upperarm_l.z,
      wristA: bonesW.hand_l.x - bonesW.upperarm_l.x, wristX: bonesW.hand_l.x, handZ: bonesW.hand_l.z,
      neckY: bonesW.neck_01.y - 0.015, neckZ: bonesW.neck_01.z + 0.01, neckR: 0.078,
      waistY: bonesW.spine_01.y - 0.075, kneeY: bonesW.calf_l.y, kneeZ: bonesW.calf_l.z, ankleY: bonesW.foot_l.y, legX: bonesW.thigh_l.x,
      chestY: bonesW.spine_03.y + 0.04, chestZ, backZ,
      eyeY: (eb.min.y + eb.max.y) / 2, eyeZ: eb.max.z,
      headY: (hb.min.y + hb.max.y) / 2 - 0.03, headZ: (hb.min.z + hb.max.z) / 2, headTop: hb.max.y, headRX: (hb.max.x - hb.min.x) / 2,
      headFront: hb.max.z, headBack: hb.min.z, pelvisRest: meshes.body.skeleton.bones.find((b) => b.name === "pelvis").position.clone(),
    };
    meshes.body.geometry.userData.ch1Keep = true;
    meshes.eyes.geometry.userData.ch1Keep = true;
    meshes.brows.geometry.userData.ch1Keep = true;
    // sphère englobante large : les animations sortent de la pose de liaison
    const sphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.35);
    bodies[sex] = { gltf: g, meshes, L, sphere };
    return bodies[sex];
  }

  const hairMats = {};
  function hairMaterial(src, hex) {
    const key = src.uuid + hex;
    if (hairMats[key]) return hairMats[key];
    const m = src.clone();
    const c = lin(hex);
    m.color.setRGB(c.r / 0.28, c.g / 0.28, c.b / 0.28);
    m.roughness = 0.55;
    m.metalness = 0;
    m.userData.shared = true;
    m.userData.azRigid = true;
    return (hairMats[key] = m);
  }

  function paintUniforms(S, B) {
    const L = B.L, U = {};
    const col = (k, hex) => (U[k] = { value: lin(hex || "#000000") });
    const v4 = (k, a, b, c, d) => (U[k] = { value: new T.Vector4(a || 0, b || 0, c || 0, d || 0) });
    const ts = TEX_SKIN[L.sex], sk = lin(S.skin || SKIN.tan);
    U.cSkin = { value: new T.Color(sk.r / ts[0], sk.g / ts[1], sk.b / ts[2]) };
    const t = S.t, b = S.b, s = S.s, g = S.g;
    col("cTopA", t && t.c); col("cTopB", (t && (t.c2 || t.c)) || "#000"); col("cTopC", (t && (t.c3 || t.c2 || t.c)) || "#000");
    col("cBotA", b && b.c); col("cBotB", (b && (b.c2 || b.c)) || "#000"); col("cBotC", (b && (b.c3 || b.c2 || b.c)) || "#000");
    col("cShoe", s && s.c); col("cSole", (s && s.sole) || "#1a1714"); col("cGlove", g && g.c);
    col("cBelt", S.belt || "#2a2a2a"); col("cBuckle", S.buckle || "#b9b9b9"); col("cHead", (S.head && S.head.c) || "#111111");
    col("cGlow", (S.glow && S.glow.c) || "#ffffff");
    const neck = t && t.neck === "v" ? 1 : t && t.neck === "high" ? 2 : 0;
    const hem = (b && b.hem) || L.waistY - 0.02;
    v4("pTop", t ? 1 : 0, t ? PATS[t.pat || "solid"] : 0, t ? SLEEVE[t.sleeve || "short"] : 0, t ? L.waistY - 0.035 : 0);
    v4("pTop2", neck, 1, t && t.pat === "fur" ? 0.5 : 0.7, t ? (t.open ? 2 : t.zip ? 1 : 0) : 0);
    const hasPantsGear = (S.gear || []).some((x) => x.split(":")[0] === "pants");
    v4("pBot", b ? 1 : 0, b ? PATS[b.pat || "solid"] : 0, s ? 0.02 : L.ankleY + 0.04, b ? hem : 0);
    v4("pShoe", s ? 1 : 0, s ? (s.h || ((S.gear || []).some((x) => x.startsWith("boots")) ? 0.32 : 0.14)) : 0, 0.022, 0);
    v4("pGlove", g ? 1 : 0, g ? L.wristA - (g.len || 0.025) : 0, g && g.fingerless ? 1 : 0, g && g.midas ? 1 : 0);
    v4("pBelt", S.belt ? 1 : 0, L.waistY - 0.015, 0.022, 0);
    const hm = S.head ? { face: 0, balaclava: 1, bandana: 2, skull: 3, paint: 4 }[S.head.mode] || 0 : 0;
    v4("pHead", hm, 0, 0, 0);
    const hasBoots = (S.gear || []).some((x) => /boots/.test(x));
    v4("pHide", hasPantsGear ? L.waistY - 0.07 : 0, hasPantsGear && !hasBoots ? 0.4 : 0, 0, S.hideHead ? 1 : 0);
    v4("pGlow", S.glow ? S.glow.pat : 0, S.glow ? S.glow.k || 1 : 0, 0, 0);
    v4("bodyL", L.shoulderX, L.wristA, L.eyeY, L.eyeZ);
    v4("bodyL2", L.waistY, L.kneeY, L.neckR, L.neckY);
    if (S.belly && t) U.cTopB.value = lin(S.belly);
    return U;
  }

  /* Gabarit d'une tenue : un squelette, tous les maillages liés dessus. Cloné par avatar. */
  const templates = {};
  function templateKey(id, variant) { return variant != null ? "recruit#" + (variant % RECRUITS.length) : id; }
  function getTemplate(id, variant) {
    const key = templateKey(id, variant);
    return templates[key] || (templates[key] = buildTemplate(lookSpec(id, variant)).catch((e) => { console.warn("[ch1-models]", key, e); delete templates[key]; throw e; }));
  }

  function bindTo(src, skel, parent, mat) {
    const m = new T.SkinnedMesh(src.geometry, mat || src.material);
    m.name = src.name;
    m.geometry.userData.ch1Keep = true;
    const bones = src.skeleton.bones.map((b) => skel.bones.find((x) => x.name === b.name));
    // même squelette quand les matrices inverses coïncident (un seul calcul par image)
    let same = bones.every((b, i) => b === skel.bones[i]);
    if (same) {
      for (let i = 0; i < bones.length && same; i++) {
        const a = src.skeleton.boneInverses[i].elements, c = skel.boneInverses[i].elements;
        for (let j = 0; j < 16; j++) if (Math.abs(a[j] - c[j]) > 2e-4) { same = false; break; }
      }
    }
    parent.add(m);
    m.bind(same ? skel : new T.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
    return m;
  }

  async function buildTemplate(S) {
    const B = await bodyInfo(S.body || "m");
    if (!anims) anims = await load("anims");
    const L = B.L;
    const root0 = new T.Group();
    root0.name = "ch1Model";
    const armature = T.SkeletonUtils.clone(B.gltf.scene);
    root0.add(armature);
    let body = null, eyes = null, brows = null;
    armature.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (o.geometry === B.meshes.body.geometry) body = o;
      else if (o.geometry === B.meshes.eyes.geometry) eyes = o;
      else if (o.geometry === B.meshes.brows.geometry) brows = o;
    });
    const skel = body.skeleton;
    // les clones partagent un seul squelette
    eyes.bind(skel, eyes.bindMatrix);
    brows.bind(skel, brows.bindMatrix);
    const parent = body.parent;
    body.material = paintMaterial(B.meshes.body.material.map, paintUniforms(S, B));
    const browC = S.brows || (S.hairC ? new T.Color(S.hairC).multiplyScalar(0.8).getStyle() : "#2a2018");
    brows.material = hairMaterial(B.meshes.brows.material, S.hairC === HAIR.white ? "#cfc9bd" : browC);
    if (S.hideHead) { eyes.visible = false; brows.visible = false; }
    // cheveux
    const HAIRS = { parted: "hair_parted", buzz: S.body === "f" ? "hair_buzz_f" : "hair_buzz", long: "hair_long", buns: "hair_buns" };
    if (S.hair && HAIRS[S.hair]) {
      const hg = await load(HAIRS[S.hair]);
      hg.scene.traverse((o) => { if (o.isSkinnedMesh) bindTo(o, skel, parent, hairMaterial(o.material, S.hairC || HAIR.brown)); });
    }
    if (S.beard) {
      const bg = await load("hair_beard");
      bg.scene.traverse((o) => { if (o.isSkinnedMesh) bindTo(o, skel, parent, hairMaterial(o.material, S.hairC || HAIR.brown)); });
    }
    // vêtements 3D
    for (const spec of S.gear || []) {
      const [kind, hex] = spec.split(":");
      const def = GEAR[S.body || "m"][kind];
      if (!def) continue;
      const gg = await load(def[0]);
      let tint, mode = 0, ref = [0.062, 0.06, 0.24];
      if (kind === "pants") tint = (S.b && S.b.c) || "#b7a074";
      else if (kind === "boots" || kind === "tallboots") { tint = (S.s && S.s.c) || "#3d2c20"; mode = 0; ref = [0.05, 0.05, 0.24]; }
      else if (kind === "hood") tint = hex || (S.t && S.t.c) || "#555";
      else if (kind === "vest") { tint = hex || "#3e4a2c"; mode = 1; }
      gg.scene.traverse((o) => {
        if (!o.isSkinnedMesh || !def[1].test(o.name)) return;
        const mat = garmentMaterial(o.material.map, mode, tint, mode ? new T.Color(tint).multiplyScalar(0.7).getStyle() : tint, mode ? "#5a5e62" : S.buckle || "#9aa0a6", mode ? 0.5 : 0, ref);
        bindTo(o, skel, parent, mat);
      });
    }
    // accessoires rigides
    const kit = new Kit(), H = headFrame(L);
    for (const spec of S.acc || []) {
      const [kind, ...args] = spec.split(":");
      const f = ACC[kind];
      if (!f) continue;
      if (["cap", "beret", "beanie", "helmet", "hardhat", "safari", "straw", "knight", "visorhelm", "bubble", "bear", "dino", "shark", "mohawk", "spikes", "pony", "bun"].includes(kind)) f(kit, H, ...args);
      else if (kind === "goggles") f(kit, H, args[0], args[1], args[2] === "up");
      else if (kind === "nvg") f(kit, H, args[0]);
      else if (["vest", "hivis", "chestplate", "backpack", "tank"].includes(kind)) f(kit, args[0], args[1], L);
      else if (kind === "tail") f(kit, args[0], args[1], L);
      else f(kit, args[0], L);
    }
    const boneIdx = {};
    skel.bones.forEach((b, i) => (boneIdx[b.name] = i));
    for (const part of kit.build()) {
      const bone = skel.bones[boneIdx[part.bone]];
      if (!bone) continue;
      const mesh = new T.Mesh(part.geo, MATS[part.mat]);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(skel.boneInverses[boneIdx[part.bone]]);
      mesh.castShadow = true;
      mesh.userData.ch1Acc = true;
      bone.add(mesh);
    }
    root0.traverse((o) => {
      if (o.isSkinnedMesh) { o.boundingSphere = B.sphere.clone(); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true; }
      if (o.isMesh) o.userData.shared = true;
    });
    // tête et mains un peu plus grandes : proportions des personnages de la vidéo
    const head = skel.bones[boneIdx.Head];
    if (head && !S.hideHead) head.scale.setScalar(1.06);
    return { root: root0, spec: S, L, sex: S.body || "m" };
  }

  /* Clone d'un gabarit : os neufs, un squelette par squelette source, géométries et matériaux partagés. */
  function instantiate(tpl) {
    const src = tpl.root, dst = src.clone();
    const map = new Map();
    (function walk(a, b) { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); })(src, dst);
    const skMap = new Map();
    for (const [a, b] of map) {
      if (!a.isSkinnedMesh) continue;
      let sk = skMap.get(a.skeleton);
      if (!sk) { sk = new T.Skeleton(a.skeleton.bones.map((x) => map.get(x)), a.skeleton.boneInverses); skMap.set(a.skeleton, sk); }
      b.bind(sk, a.bindMatrix);
    }
    dst.userData.ch1Skeletons = [...skMap.values()];
    const bones = {};
    dst.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    return { model: dst, bones, tpl };
  }

  /* ============================================================ animations */
  const LOWER = /^(root|pelvis|spine_01|thigh_.|calf_.|foot_.|ball_.|ball_leaf_.)$/;
  const clipCache = {};
  function clip(name, part) {
    const key = name + "|" + (part || "full");
    if (clipCache[key] !== undefined) return clipCache[key];
    const c = anims && anims.animations.find((a) => a.name === name);
    if (!c) return (clipCache[key] = null);
    if (!part) return (clipCache[key] = c);
    const tracks = c.tracks.filter((t) => {
      const bone = t.name.split(".")[0];
      return part === "lower" ? LOWER.test(bone) : !LOWER.test(bone);
    });
    return (clipCache[key] = new T.AnimationClip(name + "_" + part, c.duration, tracks));
  }
  const ONCE = /^(Jump_Start|Jump_Land|Roll|BackFlip|Celebration|Interact|PickUp_Kneeling|Pistol_Shoot|Pistol_Reload|Sword_Attack|Punch_Jab|Melee_Hook|Chest_Open|Consume|Drink|Surprise|Yes|KipUp|OverhandThrow|Hit_Chest|Death01)/;
  // vitesse naturelle des cycles (m/s pour le modèle à l'échelle 1)
  const SPEED = { Walk_Loop: 1.45, Jog_Fwd_Loop: 3.7, Jog_Bwd_Loop: 3.0, Jog_Left_Loop: 3.2, Jog_Right_Loop: 3.2, Jog_Fwd_L_Loop: 3.6, Jog_Fwd_R_Loop: 3.6, Jog_Bwd_L_Loop: 3.0, Jog_Bwd_R_Loop: 3.0, Sprint_Loop: 6.2, Crouch_Fwd_Loop: 1.35, Crouch_Bwd_Loop: 1.2, Crouch_Left_Loop: 1.2, Crouch_Right_Loop: 1.2, Crawl_Fwd_Loop: 0.9, Swim_Fwd_Loop: 1.6 };
  const EMOTES = { salut: "Idle_Loop", danse: "Dance_Loop", victoire: "Celebration", robot: "Idle_Loop", etoile: "BackFlip", toupie: "KipUp" };

  class Animator {
    constructor(inst) {
      this.inst = inst;
      this.mixer = new T.AnimationMixer(inst.model);
      this.layers = { base: null, upper: null };
      this.lastX = null; this.lastZ = null; this.speed = 0; this.dirA = 0; this.air = false; this.airT = 0; this.landT = 0; this.swingT = 0; this.prevHarvest = 0;
      this.pelvisDelta = new T.Vector3();
      const ualPelvis = anims.scene.getObjectByName("pelvis");
      if (ualPelvis && inst.bones.pelvis) this.pelvisDelta.copy(inst.tpl.L.pelvisRest).sub(ualPelvis.position);
    }
    action(name, part) {
      const c = clip(name, part);
      if (!c) return null;
      const a = this.mixer.clipAction(c);
      if (ONCE.test(name)) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; }
      return a;
    }
    set(layer, name, part, fade, scale) {
      const cur = this.layers[layer];
      const key = name ? name + "|" + (part || "") : null;
      if (cur && cur.key === key) { if (scale != null) cur.action.timeScale = scale; return cur.action; }
      if (cur) cur.action.fadeOut(fade);
      if (!key) { this.layers[layer] = null; return null; }
      const a = this.action(name, part);
      if (!a) { this.layers[layer] = null; return null; }
      a.reset().setEffectiveTimeScale(scale != null ? scale : 1).setEffectiveWeight(1).fadeIn(fade).play();
      this.layers[layer] = { key, action: a };
      return a;
    }
    playing(layer) { const l = this.layers[layer]; return l ? l.key.split("|")[0] : null; }
    finished(layer) { const l = this.layers[layer]; if (!l) return true; const a = l.action; return a.loop === T.LoopOnce && a.time >= a.getClip().duration - 0.02; }
  }

  function pickLocomotion(an, p, st, armed, dt, menu) {
    const x = +p.x || 0, z = +p.z || 0, yaw = +p.yaw || 0;
    const dx = an.lastX === null || menu ? 0 : x - an.lastX, dz = an.lastZ === null || menu ? 0 : z - an.lastZ;
    an.lastX = x; an.lastZ = z;
    const raw = dt > 0 ? Math.min(16, Math.hypot(dx, dz) / dt) : 0;
    an.speed += (raw - an.speed) * (1 - Math.exp(-dt * 10));
    if (raw > 0.4) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const fwd = dx * fx + dz * fz, right = dx * rx + dz * rz;
      let ang = Math.atan2(right, fwd);
      let d = ang - an.dirA; d = Math.atan2(Math.sin(d), Math.cos(d));
      an.dirA += d * (1 - Math.exp(-dt * 12));
    }
    const sp = an.speed, scaleW = 1.22;
    const part = armed ? "lower" : null;
    const crouch = !!p.crouching;
    if (sp < 0.45) return [crouch ? "Crouch_Idle_Loop" : armed ? "Idle_Loop" : "Idle_Loop", part, 1];
    const a = an.dirA, ad = Math.abs(a);
    let name;
    if (crouch) name = ad < 0.8 ? "Crouch_Fwd_Loop" : ad > 2.35 ? "Crouch_Bwd_Loop" : a > 0 ? "Crouch_Right_Loop" : "Crouch_Left_Loop";
    else if (sp > 7.1 && ad < 0.5) name = "Sprint_Loop";
    else if (sp < 2.4) name = ad > 2.35 ? "Jog_Bwd_Loop" : "Walk_Loop";
    else if (ad < 0.39) name = "Jog_Fwd_Loop";
    else if (ad < 1.18) name = a > 0 ? "Jog_Fwd_R_Loop" : "Jog_Fwd_L_Loop";
    else if (ad < 1.96) name = a > 0 ? "Jog_Right_Loop" : "Jog_Left_Loop";
    else if (ad < 2.75) name = a > 0 ? "Jog_Bwd_R_Loop" : "Jog_Bwd_L_Loop";
    else name = "Jog_Bwd_Loop";
    const nat = (SPEED[name] || 3.5) * scaleW;
    return [name, part, Math.max(0.65, Math.min(1.7, sp / nat))];
  }

  /* ------------------------------------------------------------ IK bras (espace monde) */
  const _A = new T.Vector3(), _B = new T.Vector3(), _C = new T.Vector3(), _D = new T.Vector3(), _E = new T.Vector3(), _P = new T.Vector3();
  const _qa = new T.Quaternion(), _qb = new T.Quaternion(), _qc = new T.Quaternion();
  function aim(bone, childPos, want) {
    bone.getWorldPosition(_P);
    const v1 = _D.copy(childPos).sub(_P), v2 = _E.copy(want).sub(_P);
    if (v1.lengthSq() < 1e-8 || v2.lengthSq() < 1e-8) return;
    _qa.setFromUnitVectors(v1.normalize(), v2.normalize());
    bone.getWorldQuaternion(_qb);
    bone.parent.getWorldQuaternion(_qc);
    bone.quaternion.copy(_qc.invert().multiply(_qa).multiply(_qb));
    bone.updateMatrixWorld(true);
  }
  function solveArm(up, lo, hand, target, pole, weight) {
    if (!up || !lo || !hand) return;
    up.getWorldPosition(_A); lo.getWorldPosition(_B); hand.getWorldPosition(_C);
    const l1 = _A.distanceTo(_B), l2 = _B.distanceTo(_C);
    const goal = new T.Vector3().copy(_C).lerp(target, weight == null ? 1 : weight);
    const dir = goal.clone().sub(_A);
    let d = dir.length();
    if (d < 1e-4) return;
    dir.divideScalar(d);
    d = Math.min(d, (l1 + l2) * 0.999);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const bend = pole.clone().sub(_A);
    bend.sub(dir.clone().multiplyScalar(bend.dot(dir)));
    if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0);
    bend.normalize();
    const elbow = _A.clone().add(dir.clone().multiplyScalar(x)).add(bend.multiplyScalar(h));
    aim(up, _B, elbow);
    lo.getWorldPosition(_B); hand.getWorldPosition(_C);
    aim(lo, _C, _A.clone().add(dir.multiplyScalar(d)));
  }

  /* ============================================================ branchement sur l'avatar du jeu */
  const BOT_COSTUMES = ["char-azur", "char-sauge", "char-onyx", "char-silex", "char-corail", "char-argile", "char-nacre", "char-cuivre", "char-iroise", "char-brume", "char-ecume", "char-mistral"];
  function resolveEq(eq) {
    const id = (eq && eq.character) || "char-kai";
    if (eq && eq.bot != null) {
      const n = Math.abs(eq.bot | 0);
      if (n % 5 === 4) return { id: BOT_COSTUMES[Math.floor(n / 5) % BOT_COSTUMES.length], variant: null };
      return { id: "char-kai", variant: n % RECRUITS.length };
    }
    return { id: LOOKS[id] ? id : "char-kai", variant: null };
  }

  function hideOld(u) {
    const hide = (n) => { if (n && n !== u.ch1) n.visible = false; };
    hide(u.torso);
    if (u.limbs) { hide(u.limbs[0]); hide(u.limbs[2]); }
    if (u.pelvis) hide(u.pelvis);
    if (u.limbs && u.torso) for (const i of [1, 3]) if (u.limbs[i] && u.limbs[i].parent !== u.torso) hide(u.limbs[i]);
  }

  function attach(group) {
    const u = group.userData;
    if (!u || u.ch1 || !u.ch1Req) return false;
    const key = templateKey(u.ch1Req.id, u.ch1Req.variant);
    const tp = templates[key];
    if (!tp || !tp.ready) return false;
    const inst = instantiate(tp.ready);
    inst.model.matrixAutoUpdate = false;
    group.add(inst.model);
    u.ch1 = inst;
    inst.anim = new Animator(inst);
    hideOld(u);
    return true;
  }
  function request(group, eq) {
    const u = group.userData;
    if (!u || !u.torso) return;
    const r = resolveEq(eq || {});
    u.ch1Req = r;
    const key = templateKey(r.id, r.variant);
    const p = getTemplate(r.id, r.variant);
    if (!p.ready) p.then((t) => { p.ready = t; }).catch(() => {});
    attach(group);
    void key;
  }

  const _gm = new T.Matrix4(), _gi = new T.Matrix4(), _yaw = new T.Quaternion(), _pi = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI), _one = new T.Vector3(1, 1, 1), _zero = new T.Vector3();
  const _tw = new T.Vector3(), _pole = new T.Vector3(), _tm = new T.Matrix4(), _hq = new T.Quaternion();
  const _hx = new T.Vector3(), _hy = new T.Vector3(), _hz = new T.Vector3(), _tmpv = new T.Vector3();
  const CARRY_GRIP = 0.6; // la main tient le manche un peu au-dessus du milieu

  function drive(view, group, p, dt, options) {
    const u = group.userData, inst = u.ch1;
    if (!inst) {
      // avatar créé avant le chargement de cette couche (salon au démarrage) : on le rattrape
      if (!u.ch1Req && u.torso && typeof u.equipment === "string") { try { request(group, JSON.parse(u.equipment)); } catch (e) { u.ch1Req = resolveEq({}); } }
      if (u.ch1Req) attach(group);
      return;
    }
    hideOld(u);
    const an = inst.anim, B = inst.bones, st = u.v67 || {};
    dt = Math.min(0.1, Math.max(0, +dt || 0));
    const menu = !!options.menu;
    const armed = !!(u.gun && u.gun.visible);
    const harvesting = !!(u.tool && u.tool.visible);
    const highAir = !!(p.gliding || p.flying || (p.falling && p.airborneFromBus));
    const airborne = !!(p.jumping || p.falling || p.gliding || p.flying);
    // compense les inclinaisons/écrasements appliqués à l'ancien groupe (accroupi, nage, à terre)
    let pitch = 0;
    if (p.falling && p.airborneFromBus && !p.gliding) pitch = -1.3;
    else if (p.gliding) pitch = -0.18;
    _yaw.setFromAxisAngle(_tw.set(0, 1, 0), 0);
    _gi.compose(_zero, group.quaternion, group.scale).invert();
    const s = group.scale.x;
    _yaw.setFromEuler(_e.set(pitch, group.rotation.y, 0, "YXZ"));
    _gm.compose(_zero, _yaw, _tw.set(s, s, s)).premultiply(_gi);
    _gm.multiply(_tm.makeRotationFromQuaternion(_pi));
    inst.model.matrix.copy(_gm);
    // choix de l'animation
    let base = null, part = null, scale = 1, fade = 0.18, upper = null;
    if (!airborne && an.air) { if (an.airT > 0.35) an.landT = 0.32; }
    if (airborne) an.airT += dt; else an.airT = 0;
    an.air = airborne;
    an.landT = Math.max(0, an.landT - dt);
    const emote = p.emote > 0 && !p.gliding && !p.falling;
    if (p.downed) { base = an.speed > 0.3 ? "Crawl_Fwd_Loop" : "Crawl_Idle_Loop"; pickLocomotion(an, p, st, false, dt, menu); }
    else if (p.swimming) { const r = pickLocomotion(an, p, st, false, dt, menu); base = an.speed > 0.4 ? "Swim_Fwd_Loop" : "Swim_Idle_Loop"; scale = an.speed > 0.4 ? Math.min(1.6, Math.max(0.7, an.speed / 2)) : 1; void r; }
    else if (emote) { base = EMOTES[p.emoteStyle] || "Dance_Loop"; fade = 0.25; }
    else if (p.gliding) { base = "Jump_Loop"; scale = 0.5; }
    else if (highAir) { base = "Jump_Loop"; scale = 0.55; fade = 0.3; } // chute libre : bras écartés, corps à plat (inclinaison plus haut)
    else if (airborne) {
      base = an.airT < 0.22 && an.playing("base") !== "Jump_Loop" ? "Jump_Start" : "Jump_Loop"; fade = 0.1;
      if (an.playing("base") === "Jump_Start" && !an.finished("base")) base = "Jump_Start";
      part = armed ? "lower" : null;
      pickLocomotion(an, p, st, armed, dt, menu);
    } else if (an.landT > 0) { base = "Jump_Land"; fade = 0.06; part = armed ? "lower" : null; pickLocomotion(an, p, st, armed, dt, menu); if (an.speed > 2) an.landT = 0; }
    else {
      const r = pickLocomotion(an, p, st, armed, dt, menu);
      base = r[0]; part = r[1]; scale = r[2];
      if (p.useTime > 0) { const it = (p.inventory || [])[p.selected] || {}; upper = /shield|potion|bouclier|soda|fizz|fiole/i.test(it.item || it.id || it.kind || "") ? "Drink" : "Bandage_Loop"; part = "lower"; }
    }
    if (armed && !emote && !p.downed && !p.swimming && !highAir) { upper = upper || (p.aim ? "Pistol_Aim_Neutral" : "Pistol_Idle_Loop"); if (!part) part = "lower"; }
    // coup de pioche : le geste vient de anim-v67 (frappe à deux mains), le buste suit
    const swinging = harvesting && st.swing >= 0;
    if (emote) { upper = null; part = null; }
    an.set("base", base, part, fade, scale);
    an.set("upper", upper, upper ? "upper" : null, 0.12, 1);
    // pose
    if (B.pelvis) B.pelvis.position.copy(B.pelvis.position);
    an.mixer.update(dt);
    if (B.pelvis) B.pelvis.position.add(an.pelvisDelta);
    // la tête suit la visée
    const look = Math.max(-0.9, Math.min(0.9, +p.pitch || 0));
    if (!emote && !p.downed && !p.swimming && !highAir && (armed || options.local)) {
      if (B.spine_03) B.spine_03.rotateX(-look * 0.35);
      if (B.neck_01) B.neck_01.rotateX(-look * 0.25);
    }
    group.updateMatrixWorld(true);
    // mains sur l'arme / le planeur / le plan de construction
    const right = [B.upperarm_r, B.lowerarm_r, B.hand_r], left = [B.upperarm_l, B.lowerarm_l, B.hand_l];
    const toWorld = (arr) => group.localToWorld(_tw.fromArray(arr)).clone();
    const poleFor = (sideSign) => {
      group.localToWorld(_pole.set(sideSign * 0.55, 0.4, 0.35));
      return _pole.clone();
    };
    if (armed && u.handTargets && !emote) {
      solveArm(...right, toWorld(u.handTargets.weaponPrimary), poleFor(1), 1);
      solveArm(...left, toWorld(u.handTargets.weaponSupport), poleFor(-1), 1);
    } else if (p.gliding && u.glider && u.glider.visible && u.handTargets) {
      solveArm(...left, toWorld(u.handTargets.gliderLeft), poleFor(-1).add(_tw.set(0, 0.4, 0)), 1);
      solveArm(...right, toWorld(u.handTargets.gliderRight), poleFor(1).add(_tw.set(0, 0.4, 0)), 1);
    } else if (u.blueprint && u.blueprint.visible) {
      u.blueprint.updateMatrix();
      const t = _tw.set(-0.16, -0.05, 0).applyMatrix4(u.blueprint.matrix);
      solveArm(...left, group.localToWorld(t).clone(), poleFor(-1), 1);
    } else if (emote && (p.emoteStyle === "salut" || p.emoteStyle === "robot")) {
      // gestes absents de la bibliothèque : salut de la main et danse du robot
      const et = Math.max(0, (+p.emoteDuration || 6) - (+p.emote || 0));
      const w = Math.min(1, et * 6);
      if (p.emoteStyle === "salut") {
        solveArm(...right, group.localToWorld(_tw.set(0.3 + Math.sin(et * 9) * 0.13, 1.98, -0.1)).clone(), poleFor(1).add(_tw.set(0.3, -0.6, 0)), w);
      } else {
        const beat = Math.floor(et * 2.4) % 4, lift = (k) => (beat === k ? 0.22 : 0);
        solveArm(...right, group.localToWorld(_tw.set(0.24, 1.12 + lift(0) + lift(2), -0.36)).clone(), poleFor(1), w);
        solveArm(...left, group.localToWorld(_tw.set(-0.24, 1.12 + lift(1) + lift(3), -0.36)).clone(), poleFor(-1), w);
        if (B.spine_03) { B.spine_03.rotateY((beat < 2 ? 1 : -1) * 0.22 * w); B.spine_03.updateMatrixWorld(true); }
        if (B.Head) { B.Head.rotateY((beat % 2 ? -1 : 1) * 0.35 * w); }
      }
    }
    // pioche : portée droite devant l'épaule comme dans la vidéo (main droite à hauteur de poitrine,
    // manche presque vertical, tête au-dessus de l'épaule) ; pendant la frappe, le geste de anim-v67.
    if (harvesting && u.tool) {
      const tool = u.tool;
      if (!swinging) {
        const run = Math.min(1, an.speed / 6.2), ph = st.phase || 0;
        _tw.set(0.27, 1.13 + Math.abs(Math.sin(ph)) * 0.035 * run, -0.2 + Math.sin(ph) * 0.03 * run);
        _hy.set(0.3 + Math.sin(ph) * 0.05 * run, 1, -0.34).normalize();
        _hz.set(0, 0, -1);
        _hz.sub(_tmpv.copy(_hy).multiplyScalar(_hz.dot(_hy))).normalize();
        _hx.crossVectors(_hy, _hz);
        _tm.makeBasis(_hx, _hy, _hz);
        tool.quaternion.setFromRotationMatrix(_tm);
        tool.position.copy(_tw).sub(_tmpv.set(0, CARRY_GRIP, 0).applyQuaternion(tool.quaternion).multiply(tool.scale));
        tool.updateMatrix();
        solveArm(...right, group.localToWorld(_tw.clone()), poleFor(1).add(_tmpv.set(0, -0.3, 0)), 1);
      } else {
        tool.updateMatrix();
        const g = (tool.userData.grips && tool.userData.grips.primary) || [0, 0, 0], sp = (tool.userData.grips && tool.userData.grips.support) || [0, 0.4, 0];
        solveArm(...right, group.localToWorld(_tw.fromArray(g).applyMatrix4(tool.matrix)).clone(), poleFor(1), 1);
        solveArm(...left, group.localToWorld(_tw.fromArray(sp).applyMatrix4(tool.matrix)).clone(), poleFor(-1), 1);
        if (B.spine_02) B.spine_02.rotateY(Math.sin(st.swing * Math.PI * 2) * 0.25);
      }
    }
  }
  // repère « poing fermé » de la main droite : manche vers le haut du poing, tête vers l'avant
  const TOOL_OFFSET = new T.Matrix4().compose(new T.Vector3(-0.03, 0.085, 0.0), new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2 - 0.7, 0, 0)), new T.Vector3(1, 1, 1));

  const API = (root.AZCh1Models = {
    LOOKS, RECRUITS, load, bodyInfo, getTemplate, instantiate, Animator, clip, lookSpec, resolveEq, request, attach, drive, templates,
    TOOL_OFFSET, preload() {
      return Promise.all([load("anims"), bodyInfo("m"), bodyInfo("f")]).then(() => {
        getTemplate("char-kai").then((t) => (templates["char-kai"].ready = t));
        for (let i = 0; i < RECRUITS.length; i++) getTemplate("char-kai", i).then((t) => (templates[templateKey("char-kai", i)].ready = t));
      });
    },
  });

  /* ------------------------------------------------------------ crochets dans le jeu */
  const A = root.AZArt, V = root.AZView && root.AZView.View;
  if (A && typeof A.avatar === "function" && !A.__ch1Models) {
    A.__ch1Models = true;
    const baseAvatar = A.avatar;
    A.avatar = function (eq) {
      const g = baseAvatar.apply(this, arguments);
      try { request(g, eq || {}); } catch (err) { console.warn("[ch1-models]", err); }
      return g;
    };
    if (root.AZView) root.AZView.avatar = A.avatar;
  }
  if (V && V.prototype && !V.prototype.__ch1Models) {
    const P = V.prototype;
    P.__ch1Models = true;
    const prevAnim = P.animateAvatar;
    P.animateAvatar = function (model, player, dt, options) {
      const r = prevAnim.apply(this, arguments);
      try { if (model && model.userData && player) drive(this, model, player, dt, options || {}); } catch (err) { if (!P.__ch1Warned) { P.__ch1Warned = true; console.warn("[ch1-models] animation", err); } }
      return r;
    };
    const prevDispose = P.disposeTree;
    P.disposeTree = function (g) {
      if (g && g.traverse) {
        const kept = [];
        g.traverse((o) => {
          if (o.geometry && o.geometry.userData && o.geometry.userData.ch1Keep) { kept.push([o, o.geometry]); o.geometry = null; }
          if (o.userData && o.userData.ch1Skeletons) for (const sk of o.userData.ch1Skeletons) sk.dispose();
          if (o.userData && o.userData.ch1 && o.userData.ch1.anim) o.userData.ch1.anim.mixer.stopAllAction();
        });
        const r = prevDispose.call(this, g);
        for (const [o, geo] of kept) o.geometry = geo;
        return r;
      }
      return prevDispose.apply(this, arguments);
    };
  }
  if (A || V) API.preload().catch((e) => console.warn("[ch1-models] chargement", e));
})(typeof globalThis !== "undefined" ? globalThis : this);
