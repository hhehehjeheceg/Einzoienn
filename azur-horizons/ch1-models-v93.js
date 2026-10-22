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
    // repères des os et des mains, pour les retouches procédurales et les prises (pose de liaison)
    root0.updateMatrixWorld(true);
    const byName = {};
    for (const b of skel.bones) byName[b.name] = b;
    const rig = rigInfo(byName);
    if (head && !S.hideHead) head.scale.setScalar(1.06);
    return { root: root0, spec: S, L, sex: S.body || "m", rig };
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
  /* Toutes les animations sont des poids lissés, jamais des bascules : la locomotion mélange
   * repos / marche / course / sprint et 4 à 8 directions selon la vitesse et le sens réel du
   * déplacement (cycles recalés sur la pose du pied gauche), un état « corps entier » se fond
   * par-dessus (saut, chute, nage, émote…), puis une couche « haut du corps » (arme, soin, pioche).
   * Les retouches procédurales (respiration, visée, inclinaisons, IK des mains et des pieds)
   * se font après le mélange, sans allocation par image. */
  const LOWER = /^(root|pelvis|spine_01|thigh_.|calf_.|foot_.|ball_.|ball_leaf_.)$/;
  const clipCache = {};
  // part : "lower" | "upper" | null ; tag : copie distincte (deux couches qui jouent le même clip)
  function clip(name, part, tag) {
    const key = name + "|" + (part || "full") + "|" + (tag || "");
    if (clipCache[key] !== undefined) return clipCache[key];
    const c = anims && anims.animations.find((a) => a.name === name);
    if (!c) return (clipCache[key] = null);
    if (!part && !tag) return (clipCache[key] = c);
    const tracks = part ? c.tracks.filter((t) => { const bone = t.name.split(".")[0]; return part === "lower" ? LOWER.test(bone) : !LOWER.test(bone); }) : c.tracks;
    return (clipCache[key] = new T.AnimationClip(name + "_" + (part || "full") + (tag ? "_" + tag : ""), c.duration, tracks));
  }

  /* ------------------------------------------------------------ données */
  const WS = 1.22; // échelle des avatars dans le monde : les vitesses naturelles des cycles sont × WS
  const LOCO = {
    walk: { nat: 1.45, dirs: ["Walk_Fwd_Loop", "Walk_R_Loop", "Walk_Bwd_Loop", "Walk_L_Loop"] },
    jog: { nat: 3.7, dirs: ["Jog_Fwd_Loop", "Jog_Fwd_R_Loop", "Jog_Right_Loop", "Jog_Bwd_R_Loop", "Jog_Bwd_Loop", "Jog_Bwd_L_Loop", "Jog_Left_Loop", "Jog_Fwd_L_Loop"] },
    sprint: { nat: 6.2, dirs: ["Sprint_Loop"] },
    crouch: { nat: 1.35, dirs: ["Crouch_Fwd_Loop", "Crouch_Right_Loop", "Crouch_Bwd_Loop", "Crouch_Left_Loop"] },
  };
  // seuils de vitesse (m/s monde) : [début, fin] du fondu vers chaque allure
  const GAIT = { walk: [0.12, 1.25], jog: [1.9, 3.9], sprint: [6.1, 8.2], sprintArc: 0.6, crouch: [0.12, 0.9], rate: [0.6, 1.65], blend: 9 };
  const IDLE = { stand: "Idle_Loop", crouch: "Crouch_Idle_Loop" };
  const JUMP = { start: "Jump_Start", startAt: 0.08, startRate: 1.15, loop: "Jump_Loop", loopRate: 0.8, land: "Jump_Land", landAt: 0.05, landOut: 0.42, landOutMoving: 0.16, minAir: 0.22 };
  // retombée : intensité selon le temps passé en l'air, écrasement bref du corps
  const LAND = { k: [0.35, 0.6], squash: 0.11, squashT: 0.24 };
  // émotes : enchaînement de clips (durée en s ; 0 = le dernier, qui boucle) ; ik = geste ajouté pendant ikT s
  const EMOTES = {
    salut: { seq: [["Idle_Loop", 2.8], ["Yes", 0]], ik: "wave", ikT: 2.8 },
    danse: { seq: [["Dance_Loop", 0]], vary: 0.14 },
    victoire: { seq: [["Celebration", 3.7], ["Yes", 0]] },
    robot: { seq: [["Idle_Loop", 0]], ik: "robot", ikT: 99 },
    etoile: { seq: [["BackFlip", 1.85], ["Celebration", 0]] },
    toupie: { seq: [["KipUp", 1.1], ["Dance_Loop", 0]], vary: 0.1 },
  };
  // gestes ponctuels déclenchés par le jeu : [clip, début, fin (s dans le clip), vitesse, couche] à l'arrêt / en mouvement
  const ACTS = {
    pickup: { still: ["PickUp_Kneeling", 0.2, 1.5, 1.8, "full"], move: ["Interact", 0.35, 1.25, 1.9, "upper"] },
    chest: { still: ["Chest_Open", 0.0, 1.3, 1.25, "full"], move: ["Interact", 0.2, 1.4, 1.6, "upper"] },
    door: { still: ["Interact", 0.2, 1.4, 1.5, "upper"], move: ["Interact", 0.3, 1.3, 1.8, "upper"] },
    edit: { still: ["Punch_Jab", 0.08, 0.62, 1.3, "upper"], move: ["Punch_Jab", 0.08, 0.62, 1.3, "upper"] },
    healed: { still: ["Yes", 0.4, 1.5, 1.5, "upper"], move: null },
    roll: { still: ["Roll", 0.12, 1.3, 1.35, "full"], move: ["Roll", 0.12, 1.3, 1.35, "full"] },
  };
  // roulade à la réception d'une grande chute (vitesse verticale m/s, vitesse au sol m/s)
  const ROLL = { fall: 12, speed: 2.5 };
  // réanimation d'un coéquipier, soins selon l'objet
  const REVIVE = "Fixing_Kneeling";
  const HEALS = [[/shield|potion|bouclier|soda|fizz|fiole/i, "Drink"], [/heal|bandage|medkit|soin/i, "Bandage_Loop"], [/./, "Consume"]];
  // repos : petites occupations quand on ne fait rien (sans arme), inspection de l'arme (armé)
  const FIDGET = { clips: ["Idle_LookAround_Loop", "Idle_FoldArms_Loop"], after: 7, every: 15, len: 4.4, gunAfter: 6, gunEvery: 11, gunLen: 2.2 };
  // pas sur place quand on tourne à l'arrêt (rad/s)
  const TURN = { min: 0.9, k: 0.32, max: 0.6 };
  // coup de pioche à une main (clip de bûcheronnage) : progression du geste du jeu → temps du clip (déroulé)
  const SWING = { clip: "TreeChopping_Loop", map: [[0, 0.5], [0.34, 0.97], [0.56, 1.13], [1, 1.42]], fadeIn: [0, 0.12], fadeOut: [0.78, 1], grip: 0.04, carryGrip: 0.6, toolScale: 0.66 };

  /* Armes tenues. Les modèles d'arme sont dessinés ~1,8× trop grands pour un corps de 1,8 m :
   * s ramène chaque arme à sa taille réelle de jeu de tir (fusil ~0,9 m, pompe ~1 m, pistolet ~0,28 m…).
   * Points en coordonnées de l'arme d'origine (avant = -Z) : anchor = point posé sur l'épaule
   * (crosse), sup = main d'appui, mag = chargeur (rechargement). */
  const GUNS = {
    rifle: { s: 0.55, hold: "long", anchor: [0, -0.05, 0.64], sup: [0, -0.03, -0.3], lh: "under", mag: [0, -0.2, -0.12], kick: [0.035, 0.07], rl: "mag", cyc: null, cock: [0, 0.12, 0.1] },
    burst: { s: 0.55, hold: "long", anchor: [0, -0.05, 0.64], sup: [0, -0.03, -0.3], lh: "under", mag: [0, -0.18, -0.12], kick: [0.035, 0.07], rl: "mag", cyc: null, cock: [0, 0.12, 0.1] },
    smg: { s: 0.52, hold: "long", anchor: [0, 0.0, 0.55], sup: [0, -0.1, -0.47], lh: "vert", mag: [0, -0.24, -0.15], kick: [0.022, 0.04], rl: "mag", cyc: null, cock: [0, 0.12, 0.05] },
    shotgun: { s: 0.57, hold: "long", anchor: [0, -0.07, 0.66], sup: [0, -0.05, -0.33], lh: "under", mag: [0, -0.02, -0.15], kick: [0.06, 0.17], rl: "shell", cyc: "pump", cock: [0, -0.06, -0.19] },
    tactical: { s: 0.58, hold: "long", anchor: [0, -0.03, 0.49], sup: [0, 0.0, -0.4], lh: "under", mag: [0, -0.17, -0.16], kick: [0.05, 0.13], rl: "shell", cyc: "pump", cock: [0, 0.0, -0.26] },
    sniper: { s: 0.5, hold: "long", anchor: [0, -0.08, 0.86], sup: [0, -0.07, -0.2], lh: "under", mag: [0, -0.1, -0.08], kick: [0.07, 0.2], rl: "bolt", cyc: "bolt", cock: [0.09, 0.1, 0.12] },
    dmr: { s: 0.55, hold: "long", anchor: [0, -0.05, 0.64], sup: [0, -0.03, -0.35], lh: "under", mag: [0, -0.15, -0.1], kick: [0.045, 0.1], rl: "mag", cyc: null, cock: [0, 0.12, 0.1] },
    pistol: { s: 0.4, hold: "pistol", anchor: null, sup: [-0.07, -0.17, 0.1], lh: "cup", mag: [0, -0.27, 0.15], kick: [0.03, 0.14], rl: "pistol", cyc: null, cock: [0, 0.16, 0.06] },
    revolver: { s: 0.4, hold: "pistol", anchor: null, sup: [-0.075, -0.17, 0.11], lh: "cup", mag: [0, 0.05, -0.12], kick: [0.035, 0.2], rl: "revolver", cyc: null, cock: [0, 0.15, 0.05] },
    launcher: { s: 0.78, hold: "shoulder", anchor: [0, -0.17, 0.06], sup: [0, -0.22, -0.21], lh: "vert", mag: [0, 0.02, 0.3], kick: [0.06, 0.12], rl: "rocket", cyc: null, cock: [0, 0.02, 0.3] },
  };
  // poses par type de prise : décalage de la cible (repère du corps : +X droite, +Y haut, -Z avant) depuis l'épaule droite
  // twist : buste tourné vers la droite (épaule gauche en avant) pour que la main d'appui atteigne l'arme
  const HOLDS = {
    long: { ready: [-0.05, -0.15, -0.13], aim: [-0.06, -0.06, -0.2], readyPitch: -0.2, lookReady: 0.65, readyYaw: 0.08, aimYaw: 0.035, orbit: 0, twist: 0.34, protract: 0.3, poleR: [0.4, -0.5, 0.3], poleL: [-0.3, -0.7, 0.1] },
    pistol: { ready: [-0.1, -0.32, -0.3], aim: [-0.17, -0.07, -0.42], readyPitch: -0.42, lookReady: 0.5, readyYaw: 0.1, aimYaw: 0.06, orbit: 1, twist: 0.12, protract: 0.15, poleR: [0.35, -0.55, 0.15], poleL: [-0.35, -0.55, 0.15] },
    shoulder: { ready: [0.03, 0.06, 0.03], aim: [0.02, 0.08, 0.0], readyPitch: -0.08, lookReady: 0.8, readyYaw: 0.04, aimYaw: 0.02, orbit: 0, twist: 0.25, protract: 0.2, poleR: [0.35, -0.6, 0.2], poleL: [-0.3, -0.6, 0.0] },
  };
  // repères des mains sur l'arme (f = poignet → doigts, s = auriculaire → index), coordonnées de l'arme
  const GRIPS = {
    rh: { f: [-0.1, -0.12, -1], s: [0, 1, -0.12] },
    under: { f: [0.55, 0.3, -0.75], s: [-0.3, 0.1, -0.95] },
    vert: { f: [0.1, -0.1, -1], s: [0, 1, -0.1] },
    cup: { f: [0.35, -0.3, -0.9], s: [0, 1, -0.2] },
  };
  // rechargement : la main d'appui va au chargeur, le jette à la ceinture, en remet un et claque l'arme
  // rechargements par famille d'arme : clés [t, cible main gauche] (0 appui, 1 chargeur, 2 poche de ceinture,
  // 3 culasse / pompe), inclinaison de l'arme, claque finale, geste de la main droite (verrou) [début, fin]
  const MAGK = [[0, 0], [0.12, 1], [0.3, 1], [0.45, 2], [0.6, 1], [0.74, 1], [0.86, 0], [1, 0]];
  const RELOADS = {
    mag: { keys: MAGK, roll: -0.42, pitch: 0.14, lift: 0.025, slap: [0.74, 0.86] },
    pistol: { keys: [[0, 0], [0.1, 1], [0.26, 1], [0.4, 2], [0.56, 1], [0.68, 1], [0.78, 3], [0.9, 0], [1, 0]], roll: -0.25, pitch: 0.35, lift: 0.04, slap: [0.68, 0.78] },
    revolver: { keys: [[0, 0], [0.14, 1], [0.34, 1], [0.5, 2], [0.66, 1], [0.8, 1], [0.9, 0], [1, 0]], roll: -0.75, pitch: 0.45, lift: 0.03, slap: [0.8, 0.9] },
    shell: { keys: [[0, 0], [0.08, 2], [0.2, 1], [0.32, 2], [0.44, 1], [0.56, 2], [0.68, 1], [0.8, 0], [0.88, 3], [0.95, 0], [1, 0]], roll: -0.55, pitch: 0.05, lift: 0.02, slap: null },
    bolt: { keys: MAGK, roll: -0.35, pitch: 0.1, lift: 0.02, slap: [0.74, 0.86], rh: [0.86, 0.98] },
    rocket: { keys: [[0, 0], [0.15, 2], [0.42, 2], [0.62, 1], [0.78, 1], [0.9, 0], [1, 0]], roll: 0, pitch: -0.2, lift: -0.04, slap: [0.62, 0.78] },
  };
  // pouch : poche de ceinture, décalage depuis la hanche gauche (repère du corps)
  const RELOAD = { pouch: [-0.05, 0.06, -0.12] };
  // dégainer : l'arme sort du dos (armes longues) ou de la hanche (armes de poing) ; décalage depuis l'épaule droite
  const HOLSTER = { long: { off: [0.03, 0.06, 0.24], pitch: 1.15, roll: 0.35 }, pistol: { off: [0.07, -0.58, 0.06], pitch: -1.35, roll: 0 }, shoulder: { off: [0.0, 0.1, 0.28], pitch: 0.9, roll: 0.2 } };
  // geste après chaque tir : pompe (main gauche) ou verrou (main droite), durée en s
  const CYCLE = { pump: 0.42, bolt: 0.55 };
  // lévitation de « La Fin » : paramètres par mode, fondus entre eux
  const FLOAT = {
    float: { up: 0.05, fwd: 0.1, spread: 1, knee: 0.35, arch: 0.04, sway: 1, look: 0.15 },
    drift: { up: 0.0, fwd: 0.2, spread: 0.9, knee: 0.3, arch: 0.0, sway: 0.8, look: 0.05 },
    zeroshock: { up: 0.45, fwd: -0.1, spread: 1.1, knee: 0.65, arch: 0.22, sway: 1.4, look: 0.3 },
    blast: { up: 0.3, fwd: -0.3, spread: 1.15, knee: 0.7, arch: 0.3, sway: 1.8, look: 0.25 },
    suck: { up: 0.15, fwd: 0.55, spread: 0.7, knee: 0.2, arch: -0.1, sway: 0.6, look: -0.1 },
  };
  const FLOAT_KEYS = ["up", "fwd", "spread", "knee", "arch", "sway", "look"];
  const LOD_FAR = 42; // au-delà (m), les avatars des autres joueurs s'animent une image sur deux

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a || 1e-6), 0, 1); return k * k * (3 - 2 * k); };
  const fin = (v, d) => (Number.isFinite(+v) ? +v : d || 0);

  /* ------------------------------------------------------------ repères du squelette (une fois par gabarit) */
  const AXB = ["spine_01", "spine_02", "spine_03", "neck_01", "Head", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r"];
  function rigInfo(bones) {
    const R = { ax: {}, hand: {} };
    const q = new T.Quaternion(), qi = new T.Quaternion(), m = new T.Matrix4();
    for (const n of AXB) {
      const b = bones[n];
      if (!b) continue;
      b.getWorldQuaternion(q); qi.copy(q).invert();
      R.ax[n] = { x: new T.Vector3(1, 0, 0).applyQuaternion(qi), y: new T.Vector3(0, 1, 0).applyQuaternion(qi), z: new T.Vector3(0, 0, 1).applyQuaternion(qi) };
    }
    for (const s of ["l", "r"]) {
      const h = bones["hand_" + s], mid = bones["middle_01_" + s], ix = bones["index_01_" + s], pk = bones["pinky_01_" + s];
      if (!h || !mid || !ix || !pk) continue;
      const hp = h.getWorldPosition(new T.Vector3());
      const md = mid.getWorldPosition(new T.Vector3()).sub(hp);
      const ac = ix.getWorldPosition(new T.Vector3()).sub(pk.getWorldPosition(new T.Vector3()));
      h.getWorldQuaternion(q); qi.copy(q).invert();
      const f = md.clone().normalize(), sv = ac.clone().addScaledVector(f, -ac.dot(f)).normalize();
      const palm = s === "r" ? new T.Vector3().crossVectors(sv, f) : new T.Vector3().crossVectors(f, sv);
      const fist = md.clone().multiplyScalar(0.75).addScaledVector(palm, 0.03).applyQuaternion(qi);
      const fL = f.applyQuaternion(qi), sL = sv.applyQuaternion(qi);
      const QL = new T.Quaternion().setFromRotationMatrix(m.makeBasis(fL, sL, new T.Vector3().crossVectors(fL, sL)));
      // repère « outil dans le poing » : manche (Y) vers l'index, tête (Z) dans l'axe des doigts
      const QHT = new T.Quaternion().setFromRotationMatrix(m.makeBasis(new T.Vector3().crossVectors(sL, fL), sL, fL));
      R.hand[s] = { QLinv: QL.invert(), fist, QHT, QHTinv: QHT.clone().invert() };
    }
    return R;
  }

  /* ------------------------------------------------------------ calage des cycles sur le pied gauche */
  const PHASE = {};
  function measurePhase(inst, name, dirA) {
    if (PHASE[name] != null) return PHASE[name];
    const c = clip(name), B = inst.bones;
    if (!c || !B.foot_l || !B.foot_r) return (PHASE[name] = 0);
    const mx = new T.AnimationMixer(inst.model), a = mx.clipAction(c);
    a.play();
    const dx = -Math.sin(dirA), dz = Math.cos(dirA), N = 20; // repère du modèle : avant +Z, droite -X
    let best = -1e9, bk = 0;
    for (let k = 0; k < N; k++) {
      a.time = (k / N) * c.duration;
      mx.update(0);
      B.foot_l.updateWorldMatrix(true, false); B.foot_r.updateWorldMatrix(true, false);
      _A.setFromMatrixPosition(B.foot_l.matrixWorld); _B.setFromMatrixPosition(B.foot_r.matrixWorld);
      const v = (_A.x - _B.x) * dx + (_A.z - _B.z) * dz;
      if (v > best) { best = v; bk = k; }
    }
    a.stop(); mx.uncacheRoot(inst.model);
    return (PHASE[name] = bk / N);
  }
  function measureAll(inst) {
    if (measureAll.done) return;
    measureAll.done = true;
    const saved = [];
    for (const n in inst.bones) { const b = inst.bones[n]; saved.push([b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]); }
    for (const k in LOCO) {
      const dirs = LOCO[k].dirs;
      dirs.forEach((n, i) => measurePhase(inst, n, (i / dirs.length) * Math.PI * 2));
    }
    for (const [b, p0, q0, s0] of saved) { b.position.copy(p0); b.quaternion.copy(q0); b.scale.copy(s0); }
  }

  /* ------------------------------------------------------------ couches */
  // une entrée = un clip joué dans une couche (bas du corps + haut du corps), poids et temps pilotés à la main
  class Entry {
    constructor(an, name, tag) {
      this.name = name; this.tag = tag; this.c = clip(name);
      this.dur = this.c ? this.c.duration : 0; this.phase = PHASE[name] || 0;
      this.lo = null; this.up = null; this.w = 0; this.goal = 0; this.rate = 6; this.time = 0; this.ts = 1;
      this.once = false; this.manual = false; this.an = an;
    }
    act(part, w) {
      let a = part ? this.up : this.lo;
      if (w <= 1e-3 || !this.c) { if (a && a.enabled && a.isScheduled()) a.stop(); return; }
      if (!a) {
        a = this.an.mixer.clipAction(clip(this.name, part ? "upper" : "lower", this.tag));
        a.setLoop(T.LoopRepeat, Infinity);
        a.timeScale = 0;
        if (part) this.up = a; else this.lo = a;
      }
      if (!a.isScheduled()) a.play();
      a.time = this.time;
      a.weight = w;
    }
  }
  // couche à fondus enchaînés : chaque image, on « veut » un ou plusieurs clips, les autres s'effacent
  class Layer {
    constructor(an, tag, norm) { this.an = an; this.tag = tag; this.norm = !!norm; this.list = []; this.map = {}; this.sum = 0; }
    get(name) {
      let e = this.map[name];
      if (!e) { e = this.map[name] = new Entry(this.an, name, this.tag); this.list.push(e); }
      return e;
    }
    begin() { for (let i = 0; i < this.list.length; i++) this.list[i].goal = 0; }
    want(name, goal, fade, opts) {
      const e = this.get(name);
      if (!e.c) return e;
      if (e.w <= 1e-3 && e.goal <= 0) {
        // (re)départ : les clips joués une fois repartent de leur début
        e.time = opts && opts.at != null ? opts.at : e.once ? 0 : e.time;
      }
      e.goal = goal; e.rate = 1 / Math.max(0.04, fade || 0.2);
      e.ts = opts && opts.ts != null ? opts.ts : 1;
      e.once = !!(opts && opts.once); e.manual = !!(opts && opts.manual);
      if (opts && opts.time != null) e.time = opts.time;
      return e;
    }
    step(dt) {
      let sum = 0;
      for (let i = 0; i < this.list.length; i++) {
        const e = this.list[i];
        if (e.goal <= 0 && e.w <= 0) continue;
        const d = e.goal - e.w, s = e.rate * dt;
        e.w = Math.abs(d) <= s ? e.goal : e.w + Math.sign(d) * s;
        if (!e.manual && e.dur > 0) {
          e.time += dt * e.ts;
          if (e.once) e.time = Math.min(e.time, e.dur - 1e-3);
          else e.time = ((e.time % e.dur) + e.dur) % e.dur;
        }
        sum += e.w;
      }
      // jamais plus de 1 : le reste revient à la couche du dessous
      // la couche de base (locomotion) vaut toujours 1 : jamais de retour à la pose de liaison
      if (sum > 1 || (this.norm && sum > 1e-4)) { for (let i = 0; i < this.list.length; i++) this.list[i].w /= sum; sum = 1; }
      this.sum = sum;
    }
    weightOf(name) { const e = this.map[name]; return e ? e.w : 0; }
  }

  class Animator {
    constructor(inst) {
      this.inst = inst;
      this.mixer = new T.AnimationMixer(inst.model);
      this.loco = new Layer(this, "", true);
      this.full = new Layer(this, "F");
      this.upper = new Layer(this, "U");
      this.lastX = null; this.lastZ = null; this.speed = 0; this.dirA = 0; this.phase = 0; this.moveW = 0; this.crouch = 0;
      this.air = false; this.airT = 0; this.landT = 0; this.landK = 0; this.squash = 0; this.jumpT = 0;
      this.idleT = 0; this.clock = Math.random() * 10; this.seed = Math.random() * 6.283;
      this.pitchS = 0; this.leanP = 0; this.roll = 0; this.yawPrev = null; this.yawRate = 0; this.speedPrev = 0; this.accel = 0;
      this.hpPrev = null; this.hitT = 0; this.swingW = 0; this.floatW = 0; this.floatLeanP = 0; this.floatLeanR = 0;
      this.fp = {}; for (const k of FLOAT_KEYS) this.fp[k] = FLOAT.float[k];
      this.actName = null; this.actFull = false; this.actT0 = 0; this.actT1 = 0; this.actTs = 1; this.actTime = 0; this.actSeq = -1;
      this.yPrev = null; this.fallV = 0; this.cdip = 0; this.crouchPrev = false; this.glideT = 0; this.skyW = 0; this.toolDraw = 0; this.toolPrev = false;
      this.recPrev = 0; this.cycT = 0; this.inspW = 0; this.healing = false; this.dt = 0; this.ws = 1;
      this.skip = false; this.gunL = new T.Matrix4(); this.gunSaved = false; this.toolL = new T.Matrix4(); this.toolSaved = false;
      this.pelvisDelta = new T.Vector3();
      this.bodyK = clamp((inst.tpl.L.wristA || 0.494) / 0.494, 0.82, 1.12); // longueur de bras relative au corps masculin
      const ualPelvis = anims.scene.getObjectByName("pelvis");
      if (ualPelvis && inst.bones.pelvis) this.pelvisDelta.copy(inst.tpl.L.pelvisRest).sub(ualPelvis.position);
    }
    // poids finaux des actions : bas = locomotion sous l'état plein ; haut = (locomotion + état) sous la couche haute
    apply() {
      const F = this.full.sum, U = this.upper.sum, kL = 1 - F, kU = 1 - U;
      const Ll = this.loco.list, Fl = this.full.list, Ul = this.upper.list;
      for (let i = 0; i < Ll.length; i++) { const e = Ll[i]; e.act(0, e.w * kL); e.act(1, e.w * kL * kU); }
      for (let i = 0; i < Fl.length; i++) { const e = Fl[i]; e.act(0, e.w); e.act(1, e.w * kU); }
      for (let i = 0; i < Ul.length; i++) Ul[i].act(1, Ul[i].w);
    }
  }

  /* ------------------------------------------------------------ locomotion */
  function locomotion(an, p, dt, menu, allowSprint, fidget) {
    const x = +p.x || 0, z = +p.z || 0, yaw = +p.yaw || 0;
    const dx = an.lastX === null || menu ? 0 : x - an.lastX, dz = an.lastZ === null || menu ? 0 : z - an.lastZ;
    an.lastX = x; an.lastZ = z;
    let raw = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    if (raw > 30) raw = 0; // téléportation
    an.speed += (raw - an.speed) * (1 - Math.exp(-dt * 10));
    if (raw > 0.4) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      let d = ang - an.dirA; d = Math.atan2(Math.sin(d), Math.cos(d));
      an.dirA += d * (1 - Math.exp(-dt * 12));
    }
    const sp = an.speed, a = an.dirA, L = an.loco;
    an.crouch += ((p.crouching ? 1 : 0) - an.crouch) * (1 - Math.exp(-dt * 8));
    const c = an.crouch, st = 1 - c;
    const mv = smooth(GAIT.walk[0], GAIT.walk[1], sp);
    const jog = smooth(GAIT.jog[0], GAIT.jog[1], sp);
    let spr = allowSprint ? smooth(GAIT.sprint[0], GAIT.sprint[1], sp) * (1 - smooth(GAIT.sprintArc * 0.6, GAIT.sprintArc, Math.abs(a))) : 0;
    const cmv = smooth(GAIT.crouch[0], GAIT.crouch[1], sp);
    an.moveW = st * mv + c * cmv;
    // poids des allures
    const wIdle = st * (1 - mv), wWalk = st * mv * (1 - jog), wJog = st * mv * jog * (1 - spr), wSpr = st * mv * jog * spr;
    const wCIdle = c * (1 - cmv), wCMove = c * cmv;
    L.begin();
    // repos : petites occupations de temps en temps quand on ne fait rien (regarder autour, croiser les bras)
    an.idleT = sp < 0.2 && !p.crouching && Math.abs(an.yawRate) < TURN.min ? an.idleT + dt : 0;
    const fz = an.idleT - FIDGET.after, cyc = fz > 0 ? Math.floor(fz / FIDGET.every) : -1, inF = fz > 0 ? fz % FIDGET.every : 0;
    const alt = fidget && cyc >= 0 && inF < FIDGET.len ? 1 : 0, altName = FIDGET.clips[(cyc + (an.seed > 3 ? 1 : 0)) % FIDGET.clips.length] || FIDGET.clips[0];
    // pas sur place quand le corps pivote à l'arrêt
    const turn = sp < 0.35 && !p.crouching ? clamp((Math.abs(an.yawRate) - TURN.min) * TURN.k, 0, TURN.max) : 0;
    const idleE = L.want(IDLE.stand, wIdle * (1 - alt) * (1 - turn), 0.4, { manual: true });
    idleE.time = an.clock % (idleE.dur || 1);
    for (let i = 0; i < FIDGET.clips.length; i++) {
      const n = FIDGET.clips[i], on = alt && n === altName;
      if (on || L.weightOf(n) > 0) { const e = L.want(n, on ? wIdle * (1 - turn) : 0, 0.6, { manual: true }); if (on) e.time = Math.min(inF, (e.dur || 1) * 4) % (e.dur || 1); }
    }
    const ci = L.want(IDLE.crouch, wCIdle, 0.3, { manual: true }); ci.time = an.clock % (ci.dur || 1);
    // cadence : fréquence de pas mélangée, toutes les allures partagent la même phase
    _fq[0] = 0; _fq[1] = 0;
    tierRate(LOCO.walk, wWalk, sp); tierRate(LOCO.jog, wJog, sp); tierRate(LOCO.sprint, wSpr, sp); tierRate(LOCO.crouch, wCMove, sp);
    const wTurn = wIdle * turn;
    if (wTurn > 0) { const d = clip(LOCO.walk.dirs[0]); _fq[0] += wTurn * 0.8 / (d ? d.duration : 1); _fq[1] += wTurn; }
    if (_fq[1] > 0) an.phase = (an.phase + dt * _fq[0] / _fq[1]) % 1;
    // pas latéraux du pivot : vers la gauche quand le lacet augmente
    if (wTurn > 0 || L.weightOf(LOCO.walk.dirs[1]) > 0 || L.weightOf(LOCO.walk.dirs[3]) > 0) {
      setLoco(L, LOCO.walk.dirs[an.yawRate > 0 ? 3 : 1], wTurn, an.phase);
    }
    dirTier(L, LOCO.walk, wWalk, a, an.phase);
    dirTier(L, LOCO.jog, wJog, a, an.phase);
    dirTier(L, LOCO.sprint, wSpr, a, an.phase);
    dirTier(L, LOCO.crouch, wCMove, a, an.phase);
    // les directions inutilisées s'éteignent ; les poids voulus sont déjà normalisés à 1
    for (let i = 0; i < L.list.length; i++) L.list[i].rate = GAIT.blend;
  }
  const _fq = [0, 0];
  function tierRate(T0, w, sp) {
    if (w <= 1e-3) return;
    const r = clamp(sp / (T0.nat * WS), GAIT.rate[0], GAIT.rate[1]), d = clip(T0.dirs[0]);
    _fq[0] += (w * r) / (d ? d.duration : 1); _fq[1] += w;
  }
  function dirTier(L, T0, w, a, phase) {
    const n = T0.dirs.length;
    let f = (a / (Math.PI * 2)) * n; f = ((f % n) + n) % n;
    const i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, fr = n === 1 ? 0 : f - Math.floor(f);
    setLoco(L, T0.dirs[i0], w * (1 - fr), phase);
    if (n > 1) setLoco(L, T0.dirs[i1], w * fr, phase);
  }
  function setLoco(L, name, w, phase) {
    if (w <= 1e-3 && L.weightOf(name) <= 0) return;
    const e = L.get(name);
    if (!e.c) return;
    e.goal += w; e.manual = true; e.once = false;
    e.time = ((phase + e.phase) % 1) * e.dur;
  }

  /* ------------------------------------------------------------ IK à deux os (sans allocation) */
  const _A = new T.Vector3(), _B = new T.Vector3(), _C = new T.Vector3(), _D = new T.Vector3(), _E = new T.Vector3(), _P = new T.Vector3();
  const _G = new T.Vector3(), _dir = new T.Vector3(), _bend = new T.Vector3(), _elb = new T.Vector3();
  const _qa = new T.Quaternion(), _qb = new T.Quaternion(), _qc = new T.Quaternion();
  function aimBone(bone, childPos, want) {
    bone.getWorldPosition(_P);
    _D.copy(childPos).sub(_P); _E.copy(want).sub(_P);
    if (_D.lengthSq() < 1e-10 || _E.lengthSq() < 1e-10) return;
    _qa.setFromUnitVectors(_D.normalize(), _E.normalize());
    bone.getWorldQuaternion(_qb);
    bone.parent.getWorldQuaternion(_qc);
    bone.quaternion.copy(_qc.invert().multiply(_qa).multiply(_qb));
    bone.updateMatrixWorld(true);
  }
  function solveLimb(up, lo, end, target, pole, weight) {
    if (!up || !lo || !end || weight <= 1e-3) return;
    up.getWorldPosition(_A); lo.getWorldPosition(_B); end.getWorldPosition(_C);
    const l1 = _A.distanceTo(_B), l2 = _B.distanceTo(_C);
    _G.copy(_C).lerp(target, weight > 1 ? 1 : weight);
    _dir.subVectors(_G, _A);
    let d = _dir.length();
    if (d < 1e-4) return;
    _dir.divideScalar(d);
    d = clamp(d, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    _bend.subVectors(pole, _A);
    _bend.addScaledVector(_dir, -_bend.dot(_dir));
    if (_bend.lengthSq() < 1e-8) _bend.set(0, -1, 0);
    _bend.normalize();
    _elb.copy(_A).addScaledVector(_dir, x).addScaledVector(_bend, h);
    aimBone(up, _B, _elb);
    lo.getWorldPosition(_B); end.getWorldPosition(_C);
    _G.copy(_A).addScaledVector(_dir, d);
    aimBone(lo, _C, _G);
  }
  // orientation d'une main : f = poignet → doigts, s = auriculaire → index (monde)
  const _F = new T.Vector3(), _S = new T.Vector3(), _N = new T.Vector3(), _m3 = new T.Matrix4(), _qh = new T.Quaternion(), _ql = new T.Quaternion();
  function handQuat(H, f, s, out) {
    _F.copy(f).normalize();
    _S.copy(s).addScaledVector(_F, -s.dot(_F)).normalize();
    _N.crossVectors(_F, _S);
    out.setFromRotationMatrix(_m3.makeBasis(_F, _S, _N)).multiply(H.QLinv);
    return out;
  }
  function setWorldQuat(bone, qw, w) {
    bone.parent.getWorldQuaternion(_ql);
    _ql.invert().multiply(qw);
    if (w >= 0.999) bone.quaternion.copy(_ql); else bone.quaternion.slerp(_ql, w);
    bone.updateMatrixWorld(true);
  }
  // amène le poing (centre de la prise) sur target, main orientée selon (f, s)
  const _wt = new T.Vector3();
  function handTo(an, side, target, f, s, pole, w, orient) {
    const B = an.inst.bones, H = an.inst.tpl.rig.hand[side];
    if (!H) return;
    const up = B["upperarm_" + side], lo = B["lowerarm_" + side], hand = B["hand_" + side];
    if (!up || !lo || !hand) return;
    handQuat(H, f, s, _qh);
    _wt.copy(H.fist).multiplyScalar(an.ws).applyQuaternion(_qh);
    _wt.subVectors(target, _wt);
    solveLimb(up, lo, hand, _wt, pole, w);
    if (orient !== false) setWorldQuat(hand, _qh, w);
  }
  // rotation additive autour d'un axe du corps (repère de liaison) exprimé dans l'os
  function addRot(an, name, axis, angle) {
    if (!angle) return;
    const b = an.inst.bones[name], ax = an.inst.tpl.rig.ax[name];
    if (!b || !ax) return;
    b.quaternion.multiply(_qa.setFromAxisAngle(ax[axis], angle));
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

  function hideN(u, n) { if (n && n !== u.ch1) n.visible = false; }
  function hideOld(u) {
    hideN(u, u.torso);
    if (u.limbs) { hideN(u, u.limbs[0]); hideN(u, u.limbs[2]); }
    if (u.pelvis) hideN(u, u.pelvis);
    if (u.limbs && u.torso) {
      if (u.limbs[1] && u.limbs[1].parent !== u.torso) hideN(u, u.limbs[1]);
      if (u.limbs[3] && u.limbs[3].parent !== u.torso) hideN(u, u.limbs[3]);
    }
  }

  function attach(group) {
    const u = group.userData;
    if (!u || u.ch1 || !u.ch1Req) return false;
    const key = templateKey(u.ch1Req.id, u.ch1Req.variant);
    const tp = templates[key];
    if (!tp || !tp.ready) return false;
    const inst = instantiate(tp.ready);
    inst.model.matrixAutoUpdate = false;
    measureAll(inst); // une fois pour toute la partie, avant de lier le modèle à la scène
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
    const p = getTemplate(r.id, r.variant);
    if (!p.ready) p.then((t) => { p.ready = t; }).catch(() => {});
    attach(group);
  }

  /* ------------------------------------------------------------ temporaires */
  const _gm = new T.Matrix4(), _gi = new T.Matrix4(), _ginv = new T.Matrix4(), _yaw = new T.Quaternion(), _pi = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI), _zero = new T.Vector3();
  const _tw = new T.Vector3(), _tm = new T.Matrix4(), _gq = new T.Quaternion(), _gw = new T.Vector3(), _gsc = new T.Vector3();
  const _hx = new T.Vector3(), _hy = new T.Vector3(), _hz = new T.Vector3(), _tmpv = new T.Vector3(), _sh = new T.Vector3(), _off = new T.Vector3();
  const _tR = new T.Vector3(), _tL = new T.Vector3(), _pR = new T.Vector3(), _pL = new T.Vector3(), _f1 = new T.Vector3(), _s1 = new T.Vector3(), _f2 = new T.Vector3(), _s2 = new T.Vector3();
  const _r0 = new T.Vector3(), _r1 = new T.Vector3(), _r2 = new T.Vector3(), _r3 = new T.Vector3(), _qt = new T.Quaternion(), _qw = new T.Quaternion(), _qclip = new T.Quaternion();
  const _X = new T.Vector3(1, 0, 0), _ev = new T.Vector3();
  const V3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  for (const k in GRIPS) { GRIPS[k].F = V3(GRIPS[k].f).normalize(); GRIPS[k].S = V3(GRIPS[k].s).normalize(); }
  for (const k in GUNS) { const g = GUNS[k]; g.A = g.anchor ? V3(g.anchor) : null; g.SUP = V3(g.sup); g.MAG = V3(g.mag); g.COCK = V3(g.cock); }
  for (const k in HOLSTER) HOLSTER[k].O = V3(HOLSTER[k].off);
  for (const k in HOLDS) { const h = HOLDS[k]; h.R = V3(h.ready); h.M = V3(h.aim); h.PR = V3(h.poleR); h.PL = V3(h.poleL); }
  const POUCH = V3(RELOAD.pouch), GRIP0 = [0, -0.13, 0.12];

  // point du repère du groupe (avatar) → monde ; point du repère du modèle (liaison : avant +Z, gauche +X) → monde
  const gToW = (v, out) => out.copy(v).applyMatrix4(_gmw);
  // repère du corps : position et lacet du modèle (inclinaisons comprises), échelle uniforme ; avant = -Z, droite = +X.
  // Les anciennes couches penchent et écrasent le groupe de l'avatar : l'arme et l'outil sont placés dans ce repère
  // propre (matrice locale écrite directement), jamais dans celui du groupe.
  const _bm = new T.Matrix4(), _binv = new T.Matrix4(), _bq = new T.Quaternion(), _bp = new T.Vector3(), _bs = new T.Vector3(), _gbm = new T.Matrix4(), _gl = new T.Matrix4();
  const bToW = (v, out) => out.copy(v).applyMatrix4(_bm);
  // pose un objet enfant du groupe à la matrice monde W (sans cisaillement hérité du groupe)
  function setWorldMatrix(obj, W) {
    obj.matrixAutoUpdate = false;
    obj.matrix.multiplyMatrices(_ginv, W);
    obj.matrixWorldNeedsUpdate = true;
  }
  let _gmw = null;
  const mToW = (inst, x, y, z, out) => out.set(x, y, z).applyMatrix4(inst.model.matrixWorld);

  /* ------------------------------------------------------------ arme en main */
  function keyPoint(i) { return i === 0 ? _r0 : i === 1 ? _r1 : i === 2 ? _r2 : _r3; }
  function placeGun(an, u, p, t) {
    const gun = u.gun, B = an.inst.bones;
    const key = (gun.userData && gun.userData.weapon) || u.gunKey || "rifle";
    const G = GUNS[key] || GUNS.rifle, H = HOLDS[G.hold], RL = RELOADS[G.rl] || RELOADS.mag;
    const bk = an.bodyK; // bras plus courts (corps féminin) : arme et prise rapprochées d'autant
    const present = clamp(fin(u.presentationBlend), 0, 1), look = clamp(fin(p.pitch), -1.15, 1.15);
    B.upperarm_r.getWorldPosition(_sh).applyMatrix4(_binv);
    let pitch = lerp(H.readyPitch + look * H.lookReady, look, present), yaw = lerp(H.readyYaw, H.aimYaw, present), roll = 0, lift = 0;
    _off.copy(H.R).lerp(H.M, present).multiplyScalar(bk);
    if (H.orbit) _off.applyAxisAngle(_X, look * H.orbit * present);
    // recul ; geste de pompe / verrou après le tir
    const rec = clamp(fin(u.recoil), 0, 1), kick = rec * rec;
    if (rec > an.recPrev + 0.04 && G.cyc) an.cycT = 1;
    an.recPrev = rec;
    pitch += kick * G.kick[1];
    // dégainer (l'arme sort du dos ou de la hanche) et changer d'arme (plongeon + roulis)
    const swapEnv = fin(u.swapT) > 0 ? Math.sin(Math.PI * Math.min(1, fin(u.swapT))) : 0;
    const dT = clamp(fin(u.drawT), 0, 1), drawEnv = dT * dT * (3 - 2 * dT);
    const HS = HOLSTER[G.hold] || HOLSTER.long;
    if (drawEnv > 0.001) { _off.lerp(_ev.copy(HS.O).multiplyScalar(bk), drawEnv); pitch = lerp(pitch, HS.pitch, drawEnv); roll += HS.roll * drawEnv; }
    pitch -= swapEnv * 0.25; roll += swapEnv * 0.45; lift -= swapEnv * 0.1;
    // rechargement propre à l'arme
    let rk = -1;
    if (p.reload > 0 && fin(u.reloadTotal) > 0) {
      rk = clamp(1 - p.reload / u.reloadTotal, 0, 1);
      const env = smooth(0, 0.15, rk) * (1 - smooth(0.82, 1, rk));
      roll += RL.roll * env; pitch += RL.pitch * env; lift += RL.lift * env;
    }
    // inspection de l'arme quand on attend sans rien faire
    const ia = an.idleT - FIDGET.gunAfter, insp = ia > 0 && rk < 0 && present < 0.05 ? (ia % FIDGET.gunEvery) / FIDGET.gunLen : 2;
    const inspW = insp < 1 ? Math.sin(Math.PI * insp) : 0;
    an.inspW = inspW;
    roll -= 0.75 * inspW; pitch += 0.25 * inspW; yaw += 0.35 * inspW; lift += 0.05 * inspW;
    // balancement de la marche et respiration
    const mv = an.moveW * (1 - present * 0.6), ph = an.phase * Math.PI * 2;
    lift += Math.sin(ph * 2) * 0.009 * mv + Math.sin(t * 1.7 + an.seed) * 0.003;
    yaw += Math.sin(ph) * 0.03 * mv; roll += Math.sin(ph) * 0.035 * mv;
    const gs = G.s * bk;
    gun.scale.setScalar(gs);
    gun.quaternion.setFromEuler(_e.set(pitch, yaw, roll, "YXZ"));
    _tw.copy(_sh).add(_off); _tw.y += lift;
    if (G.A) _tmpv.copy(G.A); else _tmpv.fromArray(gun.userData.grip || GRIP0);
    _tmpv.multiplyScalar(gs).applyQuaternion(gun.quaternion);
    gun.position.copy(_tw).sub(_tmpv);
    gun.position.add(_tmpv.set(0, 0, kick * G.kick[0]).applyQuaternion(gun.quaternion));
    // position/quaternion = repère du corps ; matrice monde = corps × arme
    _gbm.multiplyMatrices(_bm, _gl.compose(gun.position, gun.quaternion, gun.scale));
    setWorldMatrix(gun, _gbm);
    an.gunL.copy(_gl);
    // mains : poignée, appui (ou chargeur / ceinture / culasse pendant le rechargement)
    _gq.multiplyQuaternions(_bq, gun.quaternion);
    const grip = gun.userData.grip || GRIP0;
    _tR.set(grip[0], grip[1], grip[2] + (G.hold === "long" ? 0.025 : 0.01)).applyMatrix4(_gbm);
    _tL.copy(G.SUP).applyMatrix4(_gbm);
    _f1.copy(GRIPS.rh.F).applyQuaternion(_gq); _s1.copy(GRIPS.rh.S).applyQuaternion(_gq);
    const LG = GRIPS[G.lh] || GRIPS.under;
    _f2.copy(LG.F).applyQuaternion(_gq); _s2.copy(LG.S).applyQuaternion(_gq);
    _r3.copy(G.COCK).applyMatrix4(_gbm);
    let wOrient = 1, wR = 1;
    if (rk >= 0) {
      _r0.copy(_tL); _r1.copy(G.MAG).applyMatrix4(_gbm);
      B.thigh_l.getWorldPosition(_r2).applyMatrix4(_binv).add(POUCH); bToW(_r2, _r2);
      const K = RL.keys;
      let i = 0; while (i < K.length - 2 && rk > K[i + 1][0]) i++;
      const a = K[i], b = K[i + 1], k = smooth(a[0], b[0], rk);
      _tL.copy(keyPoint(a[1])).lerp(keyPoint(b[1]), k);
      if (RL.slap && rk > RL.slap[0] && rk < RL.slap[1]) _tL.y += Math.sin(((rk - RL.slap[0]) / (RL.slap[1] - RL.slap[0])) * Math.PI) * 0.04 * an.ws;
      const away = lerp(a[1] ? 1 : 0, b[1] ? 1 : 0, k); // main loin de l'appui : on garde le geste du clip
      wOrient = 1 - 0.85 * away;
      // verrou : la main droite quitte la poignée, tire la culasse et revient
      if (RL.rh && rk > RL.rh[0] && rk < RL.rh[1]) { const e = Math.sin(((rk - RL.rh[0]) / (RL.rh[1] - RL.rh[0])) * Math.PI); _tR.lerp(_r3, e); wR = 1 - 0.7 * e; }
    } else if (an.cycT > 0) {
      // pompe (main gauche) ou verrou (main droite) après le tir
      const dur = CYCLE[G.cyc] || 0.45, e = Math.sin(Math.PI * clamp(1 - an.cycT, 0, 1));
      if (G.cyc === "pump") _tL.lerp(_r3, e);
      else { _tR.lerp(_r3, e); wR = 1 - 0.7 * e; }
      an.cycT = Math.max(0, an.cycT - an.dt / dur);
    }
    bToW(_pR.copy(_sh).add(H.PR), _pR); bToW(_pL.copy(_sh).add(H.PL), _pL);
    handTo(an, "r", _tR, _f1, _s1, _pR, 1, false);
    const Hr = an.inst.tpl.rig.hand.r, Hl = an.inst.tpl.rig.hand.l;
    if (Hr && wR > 0.01) setWorldQuat(B.hand_r, handQuat(Hr, _f1, _s1, _qw), wR);
    handTo(an, "l", _tL, _f2, _s2, _pL, 1, false);
    if (Hl && wOrient > 0.01) setWorldQuat(B.hand_l, handQuat(Hl, _f2, _s2, _qw), wOrient);
    if (root.__ch1Debug) {
      const fe = (side, tg) => { const Hh = an.inst.tpl.rig.hand[side], hb = B["hand_" + side]; hb.getWorldQuaternion(_qa); hb.getWorldPosition(_D).add(_E.copy(Hh.fist).multiplyScalar(an.ws).applyQuaternion(_qa)); return +_D.distanceTo(tg).toFixed(3); };
      const r3 = (v) => v.toArray().map((x) => +x.toFixed(3));
      an.dbg = { key, eR: fe("r", _tR), eL: fe("l", _tL), present, drawT: fin(u.drawT), swapT: fin(u.swapT), insp: +inspW.toFixed(2), pitch: +pitch.toFixed(2), rk, sh: r3(_sh), off: r3(_off), gp: r3(gun.position), bk, gs, sex: an.inst.tpl.sex, ws: an.ws };
    }
    an.gunSaved = true;
  }

  /* ------------------------------------------------------------ pioche */
  function swingTime(s) {
    const M = SWING.map;
    let i = 0; while (i < M.length - 2 && s > M[i + 1][0]) i++;
    const a = M[i], b = M[i + 1], k = clamp((s - a[0]) / (b[0] - a[0]), 0, 1);
    return lerp(a[1], b[1], k);
  }
  function placeTool(an, u, p, st, t) {
    const tool = u.tool, B = an.inst.bones, rig = an.inst.tpl.rig, Hr = rig.hand.r;
    if (!Hr || !B.hand_r) return;
    const ts = SWING.toolScale, sw = an.swingW;
    // portée : main droite devant l'épaule, manche presque vertical (vidéo), rebond au rythme des pas
    const run = Math.min(1, an.speed / 6.2), ph = an.phase * Math.PI * 2;
    B.upperarm_r.getWorldPosition(_sh).applyMatrix4(_binv);
    _tw.set(_sh.x + 0.05, _sh.y - 0.3 + Math.abs(Math.sin(ph)) * 0.03 * run, _sh.z - 0.25 + Math.sin(ph) * 0.03 * run);
    _hy.set(0.28 + Math.sin(ph) * 0.05 * run, 1, -0.36);
    // sortie de la pioche : la main la décroche du dos par-dessus l'épaule
    const dr = an.toolDraw, de = dr * dr * (3 - 2 * dr);
    if (de > 0.001) { _tw.lerp(_ev.set(_sh.x + 0.02, _sh.y + 0.1, _sh.z + 0.2), de); _hy.lerp(_ev.set(0.2, 0.4, 0.9), de); }
    _hy.normalize();
    _hz.set(0, 0, -1); _hz.addScaledVector(_hy, -_hz.dot(_hy)).normalize();
    _hx.crossVectors(_hy, _hz);
    _qt.setFromRotationMatrix(_tm.makeBasis(_hx, _hy, _hz)); // repère de la pioche portée (groupe)
    _qw.multiplyQuaternions(_bq, _qt).multiply(Hr.QHTinv);        // main voulue (monde)
    // le poing tient le manche à carryGrip : centre du poing = origine + Y·carryGrip
    bToW(_tw, _tR);
    bToW(_pR.copy(_sh).add(_ev.set(0.45, -0.75, 0.3)), _pR);
    B.hand_r.getWorldQuaternion(_qclip);
    // portée (IK) fondue avec le geste capturé du coup de pioche
    _wt.copy(Hr.fist).multiplyScalar(an.ws).applyQuaternion(_qw);
    _wt.subVectors(_tR, _wt);
    solveLimb(B.upperarm_r, B.lowerarm_r, B.hand_r, _wt, _pR, 1 - sw);
    _qclip.slerp(_qw, 1 - sw);
    setWorldQuat(B.hand_r, _qclip, 1);
    // la pioche suit le poing
    B.hand_r.getWorldQuaternion(_qh);
    B.hand_r.getWorldPosition(_tL);
    _tL.add(_wt.copy(Hr.fist).multiplyScalar(an.ws).applyQuaternion(_qh));
    _qt.multiplyQuaternions(_qh, Hr.QHT);
    const gy = lerp(SWING.carryGrip, SWING.grip, sw) * ts * an.ws;
    _tL.sub(_tmpv.set(0, gy, 0).applyQuaternion(_qt));
    _gbm.compose(_tL, _qt, _tmpv.setScalar(ts * an.ws));
    setWorldMatrix(tool, _gbm);
    an.toolL.multiplyMatrices(_binv, _gbm); an.toolSaved = true;
    if (u.v67Trail) u.v67Trail.visible = false; // l'ancienne traînée suit l'ancien bras
  }

  /* ------------------------------------------------------------ poses de vol : chute libre, planeur, lévitation */
  function limbsModel(an, wA, wL, arms, legs) {
    // arms/legs : [lx, ly, lz, rx, ry, rz] cibles en repère du modèle, pôles idem
    const B = an.inst.bones, inst = an.inst;
    if (wA > 0.01 && arms) {
      mToW(inst, arms[0], arms[1], arms[2], _tL); mToW(inst, arms[6], arms[7], arms[8], _pL);
      solveLimb(B.upperarm_l, B.lowerarm_l, B.hand_l, _tL, _pL, wA);
      mToW(inst, arms[3], arms[4], arms[5], _tR); mToW(inst, arms[9], arms[10], arms[11], _pR);
      solveLimb(B.upperarm_r, B.lowerarm_r, B.hand_r, _tR, _pR, wA);
    }
    if (wL > 0.01 && legs) {
      mToW(inst, legs[0], legs[1], legs[2], _tL); mToW(inst, legs[6], legs[7], legs[8], _pL);
      solveLimb(B.thigh_l, B.calf_l, B.foot_l, _tL, _pL, wL);
      mToW(inst, legs[3], legs[4], legs[5], _tR); mToW(inst, legs[9], legs[10], legs[11], _pR);
      solveLimb(B.thigh_r, B.calf_r, B.foot_r, _tR, _pR, wL);
    }
  }
  const _arms = new Array(12).fill(0), _legs = new Array(12).fill(0);
  function setLimbs(arr, lx, ly, lz, rx, ry, rz, plx, ply, plz, prx, pry, prz) {
    arr[0] = lx; arr[1] = ly; arr[2] = lz; arr[3] = rx; arr[4] = ry; arr[5] = rz;
    arr[6] = plx; arr[7] = ply; arr[8] = plz; arr[9] = prx; arr[10] = pry; arr[11] = prz;
    return arr;
  }

  const _gqw = new T.Quaternion(), _gqi = new T.Quaternion();
  // repères de l'image : groupe (monde ↔ local) et corps (modèle sans le demi-tour, échelle uniforme)
  function frames(group, inst) {
    group.updateWorldMatrix(true, false);
    inst.model.updateMatrixWorld(true);
    _gmw = group.matrixWorld;
    _ginv.copy(_gmw).invert();
    _gmw.decompose(_gw, _gqw, _gsc);
    _gqi.copy(_gqw).invert();
    inst.model.matrixWorld.decompose(_bp, _bq, _bs);
    _bq.multiply(_pi);
    const sc = (_bs.x + _bs.y + _bs.z) / 3;
    _bs.set(sc, sc, sc);
    _bm.compose(_bp, _bq, _bs);
    _binv.copy(_bm).invert();
  }

  /* ------------------------------------------------------------ gestes ponctuels */
  const ACTQ = {}; // dernier geste demandé par joueur : { kind, seq }
  let actSeq = 0;
  function markAct(id, kind) { if (id == null || !ACTS[kind]) return; const q = ACTQ[id] || (ACTQ[id] = { seq: 0, kind: "" }); q.kind = kind; q.seq = ++actSeq; }
  function startAct(an, kind, moving) {
    const A = ACTS[kind];
    if (!A) return;
    const d = (moving ? A.move : A.still) || null;
    if (!d || !clip(d[0])) return;
    an.actName = d[0]; an.actT0 = d[1]; an.actT1 = d[2]; an.actTs = d[3]; an.actFull = d[4] === "full"; an.actTime = d[1];
  }
  function playAct(an, dt, F, U) {
    if (!an.actName) return;
    an.actTime += dt * an.actTs;
    if (an.actTime >= an.actT1) { an.actName = null; return; }
    const span = (an.actT1 - an.actT0) / an.actTs, el = (an.actTime - an.actT0) / an.actTs;
    const w = clamp(Math.min(el / 0.12, (span - el) / 0.2), 0, 1);
    const e = (an.actFull ? F : U).want(an.actName, w, 0.05, { manual: true });
    e.w = w; e.goal = w; e.time = Math.min(an.actTime, e.dur - 1e-3);
  }
  // pôle de coude : décalage (repère du corps) depuis l'épaule du côté voulu, résultat dans _pR / _pL
  function pole(B, side, x, y, z) {
    const out = side > 0 ? _pR : _pL;
    B[side > 0 ? "upperarm_r" : "upperarm_l"].getWorldPosition(_tmpv).applyMatrix4(_binv);
    return bToW(_ev.set(side * x, y, z).add(_tmpv), out);
  }

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
    an.dt = dt;
    an.clock += dt;
    const t = an.clock;
    const menu = !!options.menu, local = !!options.local;
    const armed = !!(u.gun && u.gun.visible);
    const harvesting = !!(u.tool && u.tool.visible);
    const ev = root.AZEvent, evOn = !!(ev && ev.active && ev.v93 && local);
    const evFloat = evOn ? clamp(fin(ev.v93.floating), 0, 1) : 0;
    const busFall = !!(p.falling && p.airborneFromBus && !p.gliding) && evFloat < 0.5;
    const highAir = !!(p.gliding || p.flying || busFall);
    const airborne = !!(p.jumping || p.falling || p.gliding || p.flying);
    const emote = p.emote > 0 && !p.gliding && !p.falling;
    const evMode = evOn && ev.playerInfo ? ev.playerInfo.mode : "";
    const input = p._input || {};
    // niveau de détail : les avatars lointains des autres joueurs s'animent une image sur deux
    let far = false;
    const cam = view && view.camera;
    if (!local && !menu && cam && group.matrixWorld) {
      const me = group.matrixWorld.elements;
      far = Math.hypot(me[12] - cam.position.x, me[13] - cam.position.y, me[14] - cam.position.z) > LOD_FAR;
    }
    an.skip = far ? !an.skip : false;

    /* ---------- orientation du corps : compense le groupe de l'ancien rig, ajoute inclinaisons et écrasement */
    let pitchT = 0;
    if (busFall) pitchT = -1.3 - clamp(fin(input.moveZ), -1, 1) * 0.22;
    else if (p.gliding) pitchT = -0.18;
    an.pitchS += (pitchT - an.pitchS) * (1 - Math.exp(-dt * 6));
    const yawNow = group.rotation.y;
    if (an.yawPrev === null || menu) an.yawPrev = yawNow;
    let dy = yawNow - an.yawPrev; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); an.yawPrev = yawNow;
    an.yawRate += ((dt > 0 ? dy / dt : 0) - an.yawRate) * (1 - Math.exp(-dt * 8));
    an.accel += ((dt > 0 ? (an.speed - an.speedPrev) / dt : 0) - an.accel) * (1 - Math.exp(-dt * 6)); an.speedPrev = an.speed;
    const grounded = !airborne && !p.swimming && !p.downed && !menu;
    const vRight = Math.sin(an.dirA) * an.speed, vFwd = Math.cos(an.dirA) * an.speed;
    let rollT = 0, leanT = 0;
    if (grounded) {
      rollT = clamp(an.yawRate * an.speed * 0.012, -0.14, 0.14) - clamp(vRight * 0.012, -0.08, 0.08);
      leanT = -clamp(an.accel * 0.012, -0.06, 0.08) - clamp(vFwd * 0.004, -0.02, 0.03) * (1 - an.crouch);
    } else if (busFall) rollT = -clamp(fin(input.moveX), -1, 1) * 0.35 + Math.sin(t * 2.3 + an.seed) * 0.03;
    else if (p.gliding) rollT = -clamp(fin(u.steer), -1, 1) * 0.22 + Math.sin(t * 1.3) * 0.02;
    // lévitation : balancement et inclinaison dans le sens du déplacement voulu
    an.floatW += (evFloat - an.floatW) * (1 - Math.exp(-dt * 4));
    if (an.floatW > 0.01) {
      const want = FLOAT[evMode] || FLOAT.float;
      const kf = 1 - Math.exp(-dt * 2.5);
      for (let i = 0; i < FLOAT_KEYS.length; i++) { const k = FLOAT_KEYS[i]; an.fp[k] += (want[k] - an.fp[k]) * kf; }
      const mx = clamp(fin(input.moveX), -1, 1), mz = clamp(fin(input.moveZ), -1, 1);
      an.floatLeanP += (-mz * 0.38 - (evMode === "suck" ? 0.35 : 0) - an.floatLeanP) * (1 - Math.exp(-dt * 2.2));
      an.floatLeanR += (-mx * 0.32 - an.floatLeanR) * (1 - Math.exp(-dt * 2.2));
      const sw = an.fp.sway, f = an.floatW;
      leanT = lerp(leanT, an.floatLeanP + an.fp.arch * 0.5 + Math.sin(t * 0.47 + an.seed) * 0.05 * sw, f);
      rollT = lerp(rollT, an.floatLeanR + Math.sin(t * 0.61 + an.seed) * 0.06 * sw, f);
    }
    an.leanP += (leanT - an.leanP) * (1 - Math.exp(-dt * 5));
    an.roll += (rollT - an.roll) * (1 - Math.exp(-dt * 5));
    // retombée : écrasement bref (volume conservé)
    an.squash = Math.max(0, an.squash - dt / LAND.squashT);
    const sx = 1 - an.squash;
    let sq = an.squash > 0 ? an.landK * LAND.squash * (sx < 0.25 ? sx / 0.25 : (1 - (sx - 0.25) / 0.75) * (1 - (sx - 0.25) / 0.75)) : 0;
    if (an.cdip > 0) sq += Math.sin(Math.PI * (1 - an.cdip)) * 0.035;
    _gi.compose(_zero, group.quaternion, group.scale).invert();
    const s = group.scale.x;
    _yaw.setFromEuler(_e.set(an.pitchS + an.leanP, group.rotation.y, an.roll, "YXZ"));
    _gm.compose(_zero, _yaw, _tw.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5))).premultiply(_gi);
    _gm.multiply(_tm.makeRotationFromQuaternion(_pi));
    inst.model.matrix.copy(_gm);
    if (an.skip) {
      // image sautée : on remet l'arme et l'outil où on les avait posés
      if ((armed && an.gunSaved) || (harvesting && an.toolSaved)) {
        frames(group, inst);
        if (armed && an.gunSaved) setWorldMatrix(u.gun, _gbm.multiplyMatrices(_bm, an.gunL));
        if (harvesting && an.toolSaved) setWorldMatrix(u.tool, _gbm.multiplyMatrices(_bm, an.toolL));
      }
      return;
    }
    if (far) { dt *= 2; an.dt = dt; }

    /* ---------- états */
    const y = fin(p.y);
    if (an.yPrev !== null && dt > 0 && airborne) an.fallV = Math.max(an.fallV, (an.yPrev - y) / dt);
    an.yPrev = y;
    const landing = !airborne && an.air && an.airT > JUMP.minAir;
    if (landing) {
      an.landT = 1; an.landK = clamp(LAND.k[0] + an.airT * LAND.k[1], LAND.k[0], 1); an.squash = 1;
      // grande chute : roulade si l'on court, réception lourde sinon
      if (an.fallV > ROLL.fall && an.fallV < 60) {
        an.landK = 1;
        if (an.speed > ROLL.speed && !armed) { startAct(an, "roll", false); an.landT = 0; }
      }
    }
    if (!airborne) an.fallV = 0;
    // gestes déclenchés par le jeu (ramasser, coffre, modification…)
    const q = ACTQ[p.id];
    if (q && q.seq !== an.actSeq) { if (an.actSeq >= 0 && !menu) startAct(an, q.kind, an.speed > 1.2); an.actSeq = q.seq; }
    else if (an.actSeq < 0) an.actSeq = q ? q.seq : 0;
    // accroupi : petite flexion au changement
    if (!!p.crouching !== an.crouchPrev) { an.crouchPrev = !!p.crouching; an.cdip = 1; }
    an.cdip = Math.max(0, an.cdip - dt * 4);
    // planeur ouvert / refermé, pioche dégainée
    an.glideT = p.gliding ? an.glideT + dt : 0;
    an.skyW += ((busFall ? 1 : 0) - an.skyW) * (1 - Math.exp(-dt * 5));
    if (harvesting && !an.toolPrev) an.toolDraw = 1;
    an.toolPrev = harvesting;
    an.toolDraw = Math.max(0, an.toolDraw - dt * 3.2);
    if (airborne) an.airT += dt; else an.airT = 0;
    if (airborne && !an.air) an.jumpT = 0;
    an.jumpT += dt;
    an.air = airborne;
    const F = an.full, U = an.upper;
    F.begin(); U.begin();
    const swimming = !!p.swimming && !highAir;
    const building = !!(u.blueprint && u.blueprint.visible);
    locomotion(an, p, dt, menu, fin(u.presentationBlend) < 0.3, !armed && !harvesting && !building);
    if (evFloat > 0.02 && !p.downed) F.want(IDLE.stand, evFloat, 0.7, { ts: 0.7 });
    else if (p.downed) F.want(an.speed > 0.3 ? "Crawl_Fwd_Loop" : "Crawl_Idle_Loop", 1, 0.35, { ts: an.speed > 0.3 ? clamp(an.speed / (0.9 * WS), 0.6, 1.6) : 1 });
    else if (swimming) {
      if (an.speed > 0.6) F.want("Swim_Fwd_Loop", 1, 0.4, { ts: clamp(an.speed / (1.6 * WS * 1.6), 0.7, 1.5) });
      else F.want("Swim_Idle_Loop", 1, 0.5);
    } else if (emote) {
      const E = EMOTES[p.emoteStyle] || EMOTES.danse, et = Math.max(0, fin(p.emoteDuration, 6) - fin(p.emote));
      let acc = 0, i = 0;
      while (i < E.seq.length - 1 && et >= acc + E.seq[i][1]) { acc += E.seq[i][1]; i++; }
      const last = i === E.seq.length - 1, e = F.want(E.seq[i][0], 1, 0.3, { manual: true });
      const lt = (et - acc) * (E.vary ? 1 - E.vary * 0.5 + (an.seed / 6.283) * E.vary : 1);
      if (e.dur > 0) e.time = last ? lt % e.dur : Math.min(lt, e.dur - 1e-3);
    } else if (p.revivingId && !airborne) F.want(REVIVE, 1, 0.35);
    else if (p.gliding) F.want(IDLE.stand, 1, 0.35, { ts: 0.6 });
    else if (highAir) F.want(JUMP.loop, 1, 0.4, { ts: 0.45 });
    else if (airborne) {
      if (p.jumping && an.airT < 0.5) F.want(JUMP.start, 1, 0.08, { once: true, at: JUMP.startAt, ts: JUMP.startRate });
      else F.want(JUMP.loop, 1, 0.3, { ts: JUMP.loopRate });
    } else if (an.landT > 0) {
      const e = F.get(JUMP.land);
      const out = an.speed > 2.2 ? JUMP.landOutMoving : JUMP.landOut;
      if (e.w <= 0 || e.time < out + JUMP.landAt) F.want(JUMP.land, an.landK, 0.05, { once: true, at: JUMP.landAt });
      if (e.time >= out + JUMP.landAt && e.w > 0) { an.landT = 0; e.rate = 4; }
    }
    if (an.landT > 0 && airborne) an.landT = 0;
    // couche haute : arme, soins, coup de pioche, recul de touche
    let swingS = -1;
    if (!emote && !p.downed && !swimming && !highAir && evFloat <= 0.5) {
      if (p.useTime > 0) {
        const it = (p.inventory || [])[p.selected] || {}, tag = String(it.item || it.id || it.kind || "");
        let hc = HEALS[HEALS.length - 1][1];
        for (let i = 0; i < HEALS.length; i++) if (HEALS[i][0].test(tag)) { hc = HEALS[i][1]; break; }
        U.want(hc, 1, 0.25);
        an.healing = true;
      } else if (armed) {
        const pr = clamp(fin(u.presentationBlend), 0, 1);
        U.want("Pistol_Idle_Loop", 1 - pr, 0.2);
        U.want("Pistol_Aim_Neutral", pr, 0.15, { manual: true, time: 0 });
      } else if (harvesting) {
        swingS = st.swing >= 0 ? clamp(st.swing, 0, 1) : -1;
        const target = swingS >= 0 ? smooth(SWING.fadeIn[0], SWING.fadeIn[1], swingS) * (1 - smooth(SWING.fadeOut[0], SWING.fadeOut[1], swingS)) : 0;
        an.swingW += (target - an.swingW) * (1 - Math.exp(-dt * 30));
        if (an.swingW > 0.005 || swingS >= 0) {
          const e = U.want(SWING.clip, an.swingW, 0.05, { manual: true });
          e.goal = an.swingW; e.w = an.swingW; // poids piloté par le geste
          if (swingS >= 0) e.time = swingTime(swingS) % (e.dur || 1);
        }
      }
      // touché : petit recul du buste
      const hp = fin(p.hp, 100);
      if (an.hpPrev !== null && hp < an.hpPrev - 0.5) an.hitT = 1;
      an.hpPrev = hp;
      an.hitT = Math.max(0, an.hitT - dt * 2.6);
      if (an.hitT > 0) U.want("Hit_Chest", 0.55 * an.hitT, 0.06, { once: true, at: 0 });
    }
    if (!harvesting) an.swingW = 0;
    // soin terminé : petit hochement satisfait
    if (an.healing && !(p.useTime > 0)) { an.healing = false; if (fin(p.hp, 100) > 0 && !p.downed) startAct(an, "healed", an.speed > 1.2); }
    playAct(an, dt, F, U);
    an.loco.step(dt); F.step(dt); U.step(dt);
    an.apply();
    an.mixer.update(dt);
    if (B.pelvis) B.pelvis.position.add(an.pelvisDelta);

    /* ---------- retouches procédurales */
    const look = clamp(fin(p.pitch), -0.9, 0.9);
    const idleW = an.loco.weightOf(IDLE.stand) * (1 - F.sum);
    // respiration et report du poids (déphasés par avatar)
    if (idleW > 0.01) {
      addRot(an, "spine_03", "x", Math.sin(t * 1.75 + an.seed) * 0.018 * idleW);
      addRot(an, "spine_01", "z", Math.sin(t * 0.52 + an.seed) * 0.03 * idleW);
      addRot(an, "neck_01", "z", -Math.sin(t * 0.52 + an.seed) * 0.02 * idleW);
      addRot(an, "Head", "y", Math.sin(t * 0.31 + an.seed * 2) * 0.12 * idleW * (armed ? 0.3 : 1));
    }
    // la tête et le buste suivent la visée
    if (!emote && !p.downed && !swimming && !highAir && (armed || local)) {
      const k = armed ? 1 : 0.5;
      addRot(an, "spine_02", "x", -look * 0.14 * k);
      addRot(an, "spine_03", "x", -look * 0.22 * k);
      addRot(an, "neck_01", "x", -look * 0.2);
      addRot(an, "Head", "x", -look * 0.16);
      if (armed && fin(u.presentationBlend) > 0) { // joue contre la crosse
        const pr = fin(u.presentationBlend) * (u.gun && GUNS[u.gunKey] && GUNS[u.gunKey].hold === "long" ? 1 : 0.3);
        addRot(an, "neck_01", "z", -0.12 * pr); addRot(an, "Head", "x", 0.1 * pr);
      }
    }
    // recul de l'arme dans les épaules ; buste de profil et épaule gauche avancée pour tenir l'arme
    if (armed) {
      const r = clamp(fin(u.recoil), 0, 1), G = GUNS[(u.gun.userData && u.gun.userData.weapon) || u.gunKey] || GUNS.rifle, H = HOLDS[G.hold];
      addRot(an, "spine_03", "x", -r * r * 0.06);
      addRot(an, "spine_02", "y", -H.twist * 0.45); addRot(an, "spine_03", "y", -H.twist * 0.55); // pas de torsion à la taille (peau pincée)
      addRot(an, "neck_01", "y", H.twist * 0.5); addRot(an, "Head", "y", H.twist * 0.45);
      addRot(an, "clavicle_l", "y", -H.protract); addRot(an, "clavicle_r", "y", H.protract * 0.3);
      if (an.inspW > 0.01) { addRot(an, "Head", "y", -0.35 * an.inspW); addRot(an, "Head", "x", 0.25 * an.inspW); }
    }
    // construction : buste penché vers la pièce
    if (building) addRot(an, "spine_02", "x", 0.08 * clamp(fin(u.buildBlend, 1), 0, 1));
    // planeur : jambes pendantes qui se balancent (repliées à l'ouverture)
    if (p.gliding) {
      const sw = Math.sin(t * 1.4 + an.seed), tuck = Math.max(0, 1 - an.glideT / 0.6);
      addRot(an, "thigh_l", "x", -0.5 * tuck); addRot(an, "thigh_r", "x", -0.45 * tuck);
      addRot(an, "calf_l", "x", 0.8 * tuck); addRot(an, "calf_r", "x", 0.75 * tuck);
      addRot(an, "thigh_l", "x", -0.22 - sw * 0.06); addRot(an, "thigh_r", "x", -0.16 + sw * 0.06);
      addRot(an, "calf_l", "x", 0.3 + sw * 0.05); addRot(an, "calf_r", "x", 0.38 - sw * 0.05);
      addRot(an, "spine_03", "x", -0.1);
      addRot(an, "Head", "x", -0.15);
    }
    // lévitation : dos cambré, tête levée
    if (an.floatW > 0.01) {
      const f = an.floatW, fp = an.fp;
      addRot(an, "spine_02", "x", -fp.arch * 0.6 * f);
      addRot(an, "spine_03", "x", -fp.arch * 0.4 * f + Math.sin(t * 0.9) * 0.03 * f);
      addRot(an, "neck_01", "x", -fp.look * f);
      addRot(an, "Head", "y", Math.sin(t * 0.37 + an.seed) * 0.25 * f);
    }
    // corps entier à jour (sans parcourir l'ancien rig)
    frames(group, inst);
    an.ws = _bs.x;

    /* ---------- mains et pieds */
    if (armed && !emote) placeGun(an, u, p, t);
    else if (p.gliding && u.glider && u.glider.visible && u.handTargets) {
      const g = an.inst.tpl.rig.hand;
      gToW(_tw.fromArray(u.handTargets.gliderLeft), _tL); gToW(_tmpv.fromArray(u.handTargets.gliderRight), _tR);
      _f1.set(0, 1, 0).applyQuaternion(_bq); _s1.set(-1, 0, 0).applyQuaternion(_bq); _s2.set(1, 0, 0).applyQuaternion(_bq);
      pole(B, -1, 0.55, 0.0, 0.25); pole(B, 1, 0.55, 0.0, 0.25);
      // ouverture : les bras montent attraper les poignées (léger dépassement)
      const go = clamp(an.glideT / 0.32, 0, 1), gw = go < 1 ? 1 - Math.pow(1 - go, 3) * (1 - 2.2 * go * (1 - go)) : 1;
      if (g.l) handTo(an, "l", _tL, _f1, _s2, _pL, clamp(gw, 0, 1));
      if (g.r) handTo(an, "r", _tR, _f1, _s1, _pR, clamp(gw, 0, 1));
    } else if (building) {
      u.blueprint.updateMatrix();
      gToW(_tw.set(-0.16, -0.05, 0).applyMatrix4(u.blueprint.matrix), _tL);
      pole(B, -1, 0.4, -0.5, 0.25);
      solveLimb(B.upperarm_l, B.lowerarm_l, B.hand_l, _tL, _pL, 1);
      // main droite : prête, puis pousse la pièce en place à chaque pose
      const pp = clamp(fin(u.placePulse), 0, 1), punch = pp > 0 ? Math.sin(Math.PI * (1 - pp)) : 0;
      B.upperarm_r.getWorldPosition(_sh).applyMatrix4(_binv);
      bToW(_tw.set(_sh.x - 0.05 - punch * 0.08, _sh.y - 0.22 + punch * 0.12, _sh.z - 0.3 - punch * 0.3), _tR);
      pole(B, 1, 0.4, -0.5, 0.3);
      solveLimb(B.upperarm_r, B.lowerarm_r, B.hand_r, _tR, _pR, clamp(fin(u.buildBlend, 1), 0, 1));
    } else if (emote && EMOTES[p.emoteStyle] && EMOTES[p.emoteStyle].ik) {
      // gestes absents de la bibliothèque : salut de la main et danse du robot
      const E = EMOTES[p.emoteStyle], et = Math.max(0, (+p.emoteDuration || 6) - (+p.emote || 0));
      const w = Math.min(1, et * 6, Math.max(0, (E.ikT - et) * 4));
      if (E.ik === "wave") {
        bToW(_tw.set(0.3 + Math.sin(et * 9) * 0.13, 1.98, -0.1), _tR);
        pole(B, 1, 0.6, -1.0, 0.35);
        solveLimb(B.upperarm_r, B.lowerarm_r, B.hand_r, _tR, _pR, w);
      } else {
        const beat = Math.floor(et * 2.4) % 4, upR = beat === 0 || beat === 2 ? 0.22 : 0, upL = beat === 1 || beat === 3 ? 0.22 : 0;
        bToW(_tw.set(0.24, 1.12 + upR, -0.36), _tR); pole(B, 1, 0.55, -0.6, 0.35);
        solveLimb(B.upperarm_r, B.lowerarm_r, B.hand_r, _tR, _pR, w);
        bToW(_tw.set(-0.24, 1.12 + upL, -0.36), _tL); pole(B, -1, 0.55, -0.6, 0.35);
        solveLimb(B.upperarm_l, B.lowerarm_l, B.hand_l, _tL, _pL, w);
        if (B.spine_03) { B.spine_03.rotateY((beat < 2 ? 1 : -1) * 0.22 * w); B.spine_03.updateMatrixWorld(true); }
        if (B.Head) { B.Head.rotateY((beat % 2 ? -1 : 1) * 0.35 * w); B.Head.updateMatrixWorld(true); }
      }
    }
    if (harvesting && u.tool && !emote) placeTool(an, u, p, st, t);
    // chute libre : position cambrée bras en W ; piqué = bras le long du corps, freinage = bras en avant,
    // virage = un bras plus bas ; flottement du vent sur les membres
    if (an.skyW > 0.01 && !p.gliding) {
      const fl = Math.sin(t * 9 + an.seed) * 0.015, fl2 = Math.sin(t * 7.3 + an.seed * 2) * 0.012;
      const mx = clamp(fin(input.moveX), -1, 1), mz = clamp(fin(input.moveZ), -1, 1), kd = Math.max(0, mz), kb = Math.max(0, -mz);
      const L = an.inst.tpl.L, sy = L.shoulderY;
      const ax = lerp(lerp(0.52, 0.3, kd), 0.45, kb), ay = sy + lerp(lerp(0.12, -0.55, kd), 0.3, kb), az = lerp(lerp(-0.16, -0.12, kd), 0.08, kb);
      limbsModel(an, an.skyW, an.skyW,
        setLimbs(_arms, ax, ay + fl + mx * 0.12, az, -ax, ay - fl - mx * 0.12, az, 0.7, sy - 0.25, -0.25, -0.7, sy - 0.25, -0.25),
        setLimbs(_legs, lerp(0.2, 0.13, kd), lerp(lerp(0.42, 0.14, kd), 0.5, kb) + fl2, lerp(lerp(-0.4, -0.18, kd), -0.45, kb), -lerp(0.2, 0.13, kd), lerp(lerp(0.42, 0.14, kd), 0.5, kb) - fl2, lerp(lerp(-0.4, -0.18, kd), -0.45, kb), 0.25, 0.55, 0.6, -0.25, 0.55, 0.6));
      addRot(an, "Head", "x", -0.35 * an.skyW); addRot(an, "neck_01", "x", -0.25 * an.skyW);
    }
    // lévitation : bras écartés qui ondulent, jambes pendantes
    if (an.floatW > 0.01) {
      const f = an.floatW, fp = an.fp, L = an.inst.tpl.L, sy = L.shoulderY, sp = fp.spread;
      const wl = Math.sin(t * 0.9 + an.seed) * 0.05, wr = Math.sin(t * 0.9 + an.seed + 1.7) * 0.05;
      const ly = sy - 0.08 + fp.up * 0.35, lz = 0.08 + fp.fwd * 0.4;
      limbsModel(an, f, f,
        setLimbs(_arms, 0.6 * sp, ly + wl, lz + wr * 0.6, -0.6 * sp, ly + wr, lz + wl * 0.6, 0.55, sy - 0.45, -0.3, -0.55, sy - 0.45, -0.3),
        setLimbs(_legs,
          0.15 + 0.03 * sp, 0.1 + fp.knee * 0.22 + Math.sin(t * 0.7 + an.seed) * 0.04, -0.06 - fp.knee * 0.12 + Math.sin(t * 0.8 + an.seed) * 0.07,
          -0.15 - 0.03 * sp, 0.16 + fp.knee * 0.28 + Math.sin(t * 0.7 + an.seed + 2) * 0.04, -0.1 - fp.knee * 0.14 + Math.sin(t * 0.8 + an.seed + 2.4) * 0.07,
          0.2, 0.55, 0.7, -0.2, 0.55, 0.7));
    }
  }

  const API = (root.AZCh1Models = {
    LOOKS, RECRUITS, load, bodyInfo, getTemplate, instantiate, Animator, clip, lookSpec, resolveEq, request, attach, drive, templates,
    GUNS, HOLDS, LOCO, GAIT, SWING, FLOAT, PHASE, ACTS, EMOTES, RELOADS, preload() {
      return Promise.all([load("anims"), bodyInfo("m"), bodyInfo("f")]).then(() => {
        getTemplate("char-kai").then((t) => (templates["char-kai"].ready = t));
        for (let i = 0; i < RECRUITS.length; i++) getTemplate("char-kai", i).then((t) => (templates[templateKey("char-kai", i)].ready = t));
      });
    },
  });

  API.gesture = markAct; // ex. AZCh1Models.gesture(joueur.id, "door") pour une porte ouverte par un autre module

  /* ------------------------------------------------------------ crochets dans le jeu */
  // les événements du jeu déclenchent les gestes : objet ramassé, coffre ouvert, construction modifiée
  const ZS = root.AZSim, WP = ZS && ZS.World && ZS.World.prototype;
  if (WP && typeof WP._emit === "function" && !WP.__ch1Acts) {
    WP.__ch1Acts = true;
    const prevEmit = WP._emit;
    WP._emit = function (type, x, y, z, more) {
      const r = prevEmit.apply(this, arguments);
      if (more && more.playerId != null && (type === "loot" || type === "edit")) {
        let kind = type;
        if (type === "loot") {
          kind = "pickup";
          const o = this.objects || [];
          for (let i = 0; i < o.length; i++) if (o[i].type === "chest" && o[i].opened && Math.abs(o[i].x - x) < 0.01 && Math.abs(o[i].z - z) < 0.01) { kind = "chest"; break; }
        }
        markAct(more.playerId, kind);
      }
      return r;
    };
  }
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
