/* AZUR v92 — ch1-view-v92.js : rendu "Chapitre 1" des objets (voir design/azur-gap-list.md O4).
 * Armes : comme dans les vidéos, le corps d'une arme garde sa vraie teinte (acier gris, polymère noir,
 * bois, beige désert pour les fusils épiques et légendaires) ; la rareté se lit à la lueur au sol et
 * aux cases de l'inventaire, plus sur toute la carcasse. Les armes de Midas restent dorées
 * (characters-v67.js les recouvre d'or après coup). */
(function (root) {
  "use strict";
  const T = root.THREE, A = root.AZArt, S = root.AZSim;
  if (!T || !A || typeof A.weapon !== "function" || A.__ch1Weapons) return;
  A.__ch1Weapons = true;

  // teinte de carcasse par arme et par palier de rareté (0 commun … 4 légendaire)
  const BODY = {
    rifle: ["#6c737b", "#6c737b", "#5d666f", "#b59a6a", "#c2a46b"],
    burst: ["#5f676f", "#5f676f", "#56606a", "#58626c", "#4f5963"],
    smg: ["#3e444b", "#3e444b", "#454c54", "#4b525a", "#4b525a"],
    shotgun: ["#3b3f45", "#3b3f45", "#3b3f45", "#3b3f45", "#3b3f45"],
    tactical: ["#4a4f57", "#4a4f57", "#4a4f57", "#4a4f57", "#4a4f57"],
    sniper: ["#4b5a46", "#4b5a46", "#4b5a46", "#5a6152", "#6a6f5a"],
    dmr: ["#565d64", "#565d64", "#565d64", "#565d64", "#565d64"],
    pistol: ["#2f3338", "#2f3338", "#2f3338", "#3a3f46", "#3a3f46"],
    revolver: ["#8a8f96", "#8a8f96", "#8a8f96", "#8a8f96", "#8a8f96"],
    launcher: ["#55603f", "#55603f", "#55603f", "#55603f", "#55603f"],
  };
  const RAR = (S && S.rarities ? S.rarities : []).map((r) => (r.color || "").toLowerCase());
  function tierOf(colour) {
    const i = RAR.indexOf(String(colour || "").toLowerCase());
    return i < 0 ? -1 : i;
  }

  const base = A.weapon;
  A.weapon = function (key, colour, wrap) {
    const tier = tierOf(colour);
    const table = BODY[key];
    if (tier >= 0 && table) {
      const g = base.call(this, key, table[tier] || table[0], wrap);
      if (g && g.userData) g.userData.ch1Rarity = tier;
      return g;
    }
    return base.apply(this, arguments);
  };
  if (root.AZView) root.AZView.weapon = A.weapon;

  /* Tempête : mur violet-bleu translucide strié comme dans les vidéos (l'ancien était presque invisible)
   * et écran teinté de violet quand on est dedans (classe body.in-storm posée par client.js). */
  const STORM_FRAG = `
varying vec2 vUv; uniform float time;
float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
void main(){
  float u=vUv.x*420.;
  float s=vn(vec2(u*.35,vUv.y*7.-time*.55))*.6+vn(vec2(u*1.6,vUv.y*26.-time*1.35))*.4;
  float diag=smoothstep(.55,.95,fract((vUv.x*900.+vUv.y*40.-time*.9)*.5));
  float ground=1.-smoothstep(.23,.42,vUv.y);
  vec3 deep=vec3(.30,.13,.62), lite=vec3(.70,.50,1.);
  vec3 c=mix(deep,lite,s*.8+diag*.25);
  float a=.30+s*.22+diag*.08+ground*.12;
  gl_FragColor=vec4(c,clamp(a,0.,.72));
}`;
  const V = root.AZView && root.AZView.View;
  if (V && V.prototype && !V.prototype.__ch1Storm) {
    const P = V.prototype;
    P.__ch1Storm = true;
    const prevUpdate = P.update;
    P.update = function () {
      const wall = this.stormWall;
      if (wall && !wall.userData.ch1) {
        wall.userData.ch1 = true;
        const old = wall.material;
        wall.material = new T.ShaderMaterial({
          side: T.DoubleSide, transparent: true, depthWrite: false, uniforms: old.uniforms || { time: { value: 0 } },
          vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader: STORM_FRAG,
        });
        old.dispose();
        if (this.stormRing && this.stormRing.material) { this.stormRing.material.color.set("#d7b6ff"); this.stormRing.material.opacity = 0.9; }
      }
      return prevUpdate.apply(this, arguments);
    };
  }
  const doc = root.document;
  if (doc && !doc.getElementById("ch1-view-css")) {
    const st = doc.createElement("style");
    st.id = "ch1-view-css";
    st.textContent = "body.in-storm #vignette{background:radial-gradient(ellipse at center,rgba(120,60,220,.18) 0%,rgba(95,35,190,.42) 62%,rgba(70,20,150,.66) 100%)!important;opacity:1!important}";
    (doc.head || doc.documentElement).appendChild(st);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
