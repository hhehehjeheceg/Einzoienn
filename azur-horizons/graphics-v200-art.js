/* AZUR Horizons 2.0 — original procedural character, weapon and build art.
   Load after render-upgrades.js and before the asynchronous client boot. */
(function (root) {
  'use strict';
  const T = root.THREE, A = root.AZArt;
  if (!T || !A || !A.Model) return;
  const Model = A.Model, buildGeometry = A.buildModel;
  const INK = '#172a3a', CARBON = '#263746', STEEL = '#7994a0', IVORY = '#fff2d4', CYAN = '#72eee5', GOLD = '#ffc76a';
  const paletteFor = (eq) => {
    const c = A.cosmetic(eq.character || 'char-ambre', { color: '#ef9565', secondary: '#ffe0a2', palette: 'coral' });
    const variant = eq.variant && eq.variant !== 'variant-aube' ? A.cosmetic(eq.variant, c) : null;
    const id = eq.character || 'char-ambre', p = c.palette || 'coral';
    const data = {
      coral: { skin:'#c98968', hair:'#32242a', eye:'#316d77', suit:'#d46b56', cloth:'#27485a' },
      sky:   { skin:'#ad704d', hair:'#18334b', eye:'#54b6d8', suit:'#1876ad', cloth:'#e1f4f3' },
      sage:  { skin:'#87563c', hair:'#31271f', eye:'#779e57', suit:'#4b765b', cloth:'#d1b978' },
      pearl: { skin:'#e9b08d', hair:'#f1c9dc', eye:'#75609b', suit:'#365d86', cloth:'#f8d6ea' },
      copper:{ skin:'#9c6248', hair:'#bd5c38', eye:'#865c3d', suit:'#a95238', cloth:'#f0b55f' },
      aster: { skin:'#794f4b', hair:'#d0ccff', eye:'#aa84cf', suit:'#30334f', cloth:'#75eef2' },
      rift:  { skin:'#b98266', hair:'#eef8ff', eye:'#7ff3ff', suit:'#1f3354', cloth:'#7ff3ff' },
      midas: { skin:'#c48a62', hair:'#3a2618', eye:'#6b4a1f', suit:'#4a2370', cloth:'#f3e7c9' }
    }[p] || { skin:'#bd8063', hair:'#2e292b', eye:'#477d82', suit:c.color || '#d46b56', cloth:c.secondary || '#ffe0a2' };
    const suit = variant ? variant.color : data.suit;
    return { id, p, skin:data.skin, hair:data.hair, eye:data.eye, suit, cloth:data.cloth, accent:c.secondary || GOLD, dark:INK, variant };
  };
  const mesh = (m, material) => { const x = m.mesh(); if (material) x.material = material; return x; };
  const mat = {
    wood: new T.MeshStandardMaterial({ vertexColors:true, roughness:.88, metalness:0 }),
    stone: new T.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0 }),
    metal: new T.MeshStandardMaterial({ vertexColors:true, roughness:.31, metalness:.72 })
  };

  /* Or de Midas : un seul matériau partagé. La luminosité des couleurs d'origine
     devient une rampe d'or sombre → or clair, avec un liseré brillant et un
     reflet qui balaie la surface (pas de carte d'environnement nécessaire). */
  const goldClock = { value: 0 };
  let goldShared = null;
  function goldMaterial() {
    if (goldShared) return goldShared;
    goldShared = new T.MeshStandardMaterial({ vertexColors: true, metalness: .22, roughness: .34, emissive: '#000000' });
    goldShared.onBeforeCompile = (sh) => {
      sh.uniforms.uGoldTime = goldClock;
      sh.vertexShader = 'varying vec3 vGoldW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vGoldW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uGoldTime;\nvarying vec3 vGoldW;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
  float goldL = dot(diffuseColor.rgb, vec3(.299, .587, .114));
  diffuseColor.rgb = mix(vec3(.26, .12, .01), vec3(.93, .63, .1), smoothstep(.02, .8, sqrt(goldL)));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float goldRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
  float goldSweep = pow(max(sin((vGoldW.x + vGoldW.y * 1.7 + vGoldW.z) * 2.4 - uGoldTime * 3.2), 0.0), 22.0);
  totalEmissiveRadiance += vec3(1.0, .66, .12) * (.03 + goldRim * .3) + vec3(1.0, .85, .45) * goldSweep * .7;`);
    };
    goldShared.customProgramCacheKey = () => 'azur-gold-67';
    return goldShared;
  }

  /* Weapon axes are deliberately -Z.  The four published attachment fields are
     consumed by render-upgrades.js for IK, recoil and muzzle effects. */
  function weapon(key = 'rifle', colour = '#b3c5cb', wrap = '') {
    const m = new Model(), wrapData = wrap ? A.cosmetic(wrap, { color:colour, secondary:GOLD }) : null;
    const spec = {
      pistol:[.56,[0,-.12,.10],[0,.02,-.51],true], revolver:[.64,[0,-.12,.11],[0,.02,-.58],true],
      rifle:[1.08,[0,-.13,.14],[0,.02,-.98]], burst:[1.02,[0,-.13,.14],[0,.02,-.92]],
      smg:[.82,[0,-.13,.12],[0,.02,-.73]], shotgun:[1.00,[0,-.13,.14],[0,.01,-.90]],
      tactical:[.94,[0,-.13,.13],[0,.02,-.85]], sniper:[1.48,[0,-.13,.18],[0,.02,-1.34]],
      dmr:[1.22,[0,-.13,.16],[0,.02,-1.10]], launcher:[1.15,[0,-.14,.14],[0,.02,-1.05]]
    }[key] || [1.08,[0,-.13,.14],[0,.02,-.98]];
    const muzzle = spec[2], hand = !!spec[3], dark = '#142532', metal = '#74909a', warm = '#9a6541';
    const barrel = (r, from, col=metal) => {
      m.cyl(r,r,from-(muzzle[2]+.018),col,0,muzzle[1],(from+muzzle[2]+.018)/2,10,Math.PI/2)
       .add(new T.TorusGeometry(r*.83,r*.16,5,10),metal,0,muzzle[1],muzzle[2]+.008)
       .cyl(r*.59,r*.59,.018,dark,0,muzzle[1],muzzle[2]+.021,8,Math.PI/2);
    };
    const stock = (length, col=dark) => m.box(.10,.065,length,metal,0,.01,.12+length*.5)
      .box(.18,.19,.11,col,0,-.045,.14+length).box(.14,.05,length*.7,colour,0,.075,.16+length*.48);
    const rail = (z,len) => { m.box(.115,.026,len,dark,0,.145,z); for(let i=0;i<5;i++)m.box(.135,.018,.02,metal,0,.164,z-len*.38+i*len*.19); };
    /* grip, trigger opening, safety and receiver pins are shared but the main
       mass below is authored per weapon family rather than rescaled rifle art. */
    m.box(.082,.23,.12,hand?warm:dark,0,-.13,.115,.22).box(.025,.035,.14,metal,-.061,-.19,-.005)
      .box(.025,.035,.14,metal,.061,-.19,-.005).box(.12,.035,.025,metal,0,-.135,-.082)
      .box(.018,.067,.024,GOLD,0,-.12,-.026,-.28);
    if (key === 'pistol') {
      m.loft([[-.03,.09,.19],[.04,.105,.23],[.105,.075,.18]],colour,8)
       .box(.13,.04,.37,metal,0,.095,-.18).box(.07,.022,.075,dark,0,.137,-.14)
       .box(.04,.026,.028,CYAN,0,.141,-.37).box(.13,.03,.14,dark,0,-.24,.13); barrel(.042,-.31);
      for(const x of[-.078,.078])for(let i=0;i<4;i++)m.box(.01,.085,.014,dark,x,.035,-.10+i*.038);
    } else if (key === 'revolver') {
      m.box(.14,.1,.37,colour,0,.08,-.17).cyl(.12,.12,.20,warm,0,-.004,-.13,10,Math.PI/2)
       .box(.105,.075,.27,colour,0,-.035,-.36).box(.13,.07,.15,warm,0,-.225,.13,-.17);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;m.cyl(.022,.022,.205,dark,Math.cos(a)*.09,Math.sin(a)*.09,-.13,6,Math.PI/2);} barrel(.053,-.22);
    } else if (key === 'launcher') {
      m.cyl(.165,.19,.90,colour,0,.02,-.40,14,Math.PI/2).cyl(.215,.17,.17,metal,0,.02,.13,14,Math.PI/2)
       .box(.27,.09,.42,dark,0,-.145,-.38).box(.13,.10,.31,warm,0,-.19,-.25)
       .box(.07,.17,.23,dark,-.205,.12,-.23).box(.026,.07,.15,CYAN,-.245,.18,-.23);
      barrel(.185,-.80,colour); for(const z of[-.72,-.52])m.cyl(.196,.196,.04,GOLD,0,.02,z,12,Math.PI/2);
    } else if (key === 'smg') {
      m.box(.21,.19,.42,colour,0,.015,-.16).box(.15,.13,.24,dark,0,.005,-.46)
       .box(.10,.32,.14,metal,0,-.235,-.16,.17).box(.1,.034,.14,GOLD,0,-.40,-.13)
       .box(.1,.05,.28,dark,0,.065,.18).box(.2,.10,.13,dark,0,.19,-.23).box(.15,.035,.016,CYAN,0,.205,-.30);
      barrel(.047,-.43); rail(-.23,.32);
    } else if (key === 'shotgun') {
      m.box(.17,.15,.36,colour,0,.025,-.04).box(.14,.15,.30,warm,0,-.045,-.43)
       .cyl(.034,.034,.72,dark,0,-.075,-.40,8,Math.PI/2).box(.11,.034,.66,metal,0,.10,-.41);
      stock(.40,warm);barrel(.054,-.18);for(let i=0;i<6;i++)m.box(.15,.16,.016,dark,0,-.05,-.56+i*.04);
    } else if (key === 'tactical') {
      m.box(.24,.22,.46,colour,0,.015,-.14).cyl(.15,.15,.15,dark,0,-.19,-.15,12,Math.PI/2)
       .box(.19,.14,.31,dark,0,-.01,-.52).box(.2,.026,.25,GOLD,0,.075,-.52);
      barrel(.068,-.55);stock(.29);rail(-.25,.46);
    } else if (key === 'burst') {
      m.box(.22,.20,.70,colour,0,.006,-.06).box(.18,.23,.13,dark,0,-.035,.32)
       .box(.11,.25,.18,metal,0,-.21,.22,-.15).box(.23,.13,.27,dark,0,-.01,-.48)
       .box(.045,.09,.27,CYAN,-.125,.014,-.19).box(.045,.09,.27,CYAN,.125,.014,-.19);
      barrel(.042,-.46);rail(-.20,.46);
    } else {
      const precision = key === 'sniper' || key === 'dmr';
      m.box(.18,.17,precision?.46:.40,colour,0,.012,-.09).box(.11,.24,precision?.18:.21,dark,0,-.20,-.09,.21)
       .box(precision?.14:.18,.14,precision?.42:.34,precision?warm:metal,0,.012,-.44)
       .box(.04,.03,.09,GOLD,.115,.021,.04); stock(key==='sniper'?.47:.35);barrel(key==='sniper'?.047:.039,-.48);rail(-.21,.48);
      if(precision){const sl=key==='sniper'?.44:.28;m.cyl(.064,.064,sl,dark,0,.245,-.24,12,Math.PI/2).cyl(.08,.064,.09,metal,0,.245,-.24-sl/2+.02,12,Math.PI/2).cyl(.06,.06,.008,CYAN,0,.245,-.24-sl/2-.026,12,Math.PI/2).box(.08,.09,.07,metal,0,.17,-.12).box(.08,.09,.07,metal,0,.17,-.34);} else m.box(.12,.02,.04,metal,0,.23,-.57);
    }
    if(['rifle','dmr','burst'].includes(key))m.box(.14,.29,.14,dark,0,-.22,-.06,.17).box(.12,.034,.11,GOLD,0,-.38,-.03,.17).box(.08,.035,.23,metal,.125,.055,-.13);
    if(wrapData){ const wc=wrapData.color||colour, ws=wrapData.secondary||GOLD; for(const side of[-1,1])m.box(.014,.075,Math.min(.31,spec[0]*.36),wc,side*(key==='launcher'?.19:.11),.035,-spec[0]*.18).box(.015,.025,.075,ws,side*(key==='launcher'?.19:.11),.04,-spec[0]*.28,0,side*.12); }
    /* v19 detail pass: ejection ports, charging handles, sight posts, magazine
       ribs and launcher warning stripes give each family a mechanical read from
       the third-person play camera. All parts stay inside the authored silhouette. */
    if(['rifle','dmr','burst'].includes(key)){
      m.box(.018,.055,.13,dark,.093,.055,-.15).box(.008,.038,.10,CYAN,.103,.055,-.15)
       .box(.085,.028,.045,dark,0,.115,.03).box(.03,.05,.02,dark,0,.10,.055);
      for(let rib=0;rib<3;rib++)m.box(.148,.014,.03,metal,0,-.20-rib*.055,-.055,.17);
    }
    if(key==='smg'||key==='tactical'){
      m.box(.018,.05,.11,dark,.105,.06,-.30).box(.008,.034,.08,CYAN,.114,.06,-.30)
       .box(.02,.06,.02,dark,0,.175,-.62).box(.05,.02,.02,GOLD,0,.21,-.62);
    }
    if(key==='shotgun'){
      m.box(.02,.03,.02,GOLD,0,.075,-.86);
      for(let rib=0;rib<3;rib++)m.box(.15,.17,.02,dark,0,-.05,-.50+rib*.045);
    }
    if(key==='pistol'||key==='revolver'){
      m.box(.05,.025,.03,dark,0,.125,-.02).box(.02,.02,.014,GOLD,0,.128,-.055);
    }
    if(key==='sniper'||key==='dmr'){
      m.box(.02,.05,.02,dark,0,.175,-.60);
      for(let rib=0;rib<3;rib++)m.box(.148,.014,.03,metal,0,-.20-rib*.055,-.075,.21);
    }
    if(key==='launcher'){
      for(let s=0;s<3;s++)m.box(.20,.03,.05,s%2?GOLD:dark,0,-.06,-.05-s*.09);
      m.box(.03,.05,.10,dark,.19,.06,-.30);
    }
    /* v21 mechanical read: trigger guards, front sight posts, selector switches
       and barrel fluting. All parts stay inside the authored silhouette. */
    if(['rifle','dmr','burst','tactical'].includes(key)){
      m.box(.016,.085,.15,dark,0,-.205,.03).box(.02,.045,.02,dark,0,.185,-.80).box(.03,.02,.012,GOLD,.075,.075,.10,.3);
    }
    if(key==='sniper'){ for(let f=0;f<4;f++){ const fa=f*Math.PI/2+Math.PI/4; m.box(.014,.014,.62,'#5d767f',Math.cos(fa)*.048,.02+Math.sin(fa)*.048,-.86); } }
    if(key==='tactical')m.box(.07,.14,.09,dark,0,-.06,-.55,.12);
    if(key==='pistol')m.box(.03,.05,.03,dark,0,.10,.16,-.3);
    if(key==='shotgun'){ for(let sh=0;sh<3;sh++)m.box(.03,.03,.10,'#d9544d',-.10,.02,-.30+sh*.11); }
    m.box(.03,.035,hand?.16:key==='sniper'?.27:.21,CYAN,hand?.09:.12,.13,-.22);
    const out = mesh(m);
    out.userData = { weapon:key, wrap, grip:spec[1], supportGrip:hand?[-.025,-.11,.075]:[-.035,key==='launcher'?- .10:-.01,key==='launcher'?- .13:key==='smg'?- .16:-.20], muzzle, barrelAxis:[0,0,-1], presentation:{extension:hand?.25:.20,kick:key==='sniper'||key==='shotgun'?.066:hand?.044:.037} };
    return out;
  }

  function rigPart(detail, build) { const m = new Model(detail); build(m); return mesh(m); }
  /* A smooth indexed loft remains mergeable through Model.add(), while retaining
     shared normals after its indexed geometry is expanded.  Avatar volumes use it
     in preference to stacks of primitive balls: fewer seams, more human planes. */
  function smoothLoft(m, rings, col, segments = 14) {
    // Descending rings inverted the boot and nose normals, hiding their outer faces.
    rings = rings.slice().sort((a, b) => a[0] - b[0]);
    segments = m.detail === 'low' ? Math.max(8, Math.floor(segments * .72)) : segments;
    const pos = [], index = [];
    for (const r of rings) for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments;
      pos.push((r[3] || 0) + Math.cos(a) * r[1], r[0], (r[4] || 0) + Math.sin(a) * r[2]);
    }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
      const a = j * segments + i, b = j * segments + (i + 1) % segments;
      index.push(a, a + segments, b, b, a + segments, b + segments);
    }
    for (let end = 0; end < 2; end++) {
      const ring = end ? rings[rings.length - 1] : rings[0], base = end ? (rings.length - 1) * segments : 0, centre = pos.length / 3;
      pos.push(ring[3] || 0, ring[0], ring[4] || 0);
      for (let i = 0; i < segments; i++) {
        const a = base + i, b = base + (i + 1) % segments;
        index.push(centre, end ? b : a, end ? a : b);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(index); g.computeVertexNormals();
    m.add(g, col);
    return m;
  }
  function avatar(eq = {}, askedDetail = eq.detail) {
    const detail = askedDetail === 'low' ? 'low' : 'high', P = paletteFor(eq), group = new T.Group(), torso = new T.Group();
    group.add(torso);
    /* Modèle v68 « héros cartoon » : buste en V avec veste à capuche, col
       montant, fermeture éclair, poches et ceinture épaisse ; grosse tête ronde
       aux grands yeux expressifs, sourcils, nez, sourire, oreilles et coiffure
       volumineuse. Les pivots du squelette ne changent pas. */
    const chest = rigPart(detail, m => {
      smoothLoft(m, [[.84,.185,.13],[.93,.2,.142],[1.04,.198,.14],[1.17,.228,.158],[1.31,.262,.172],[1.42,.282,.165],[1.5,.232,.14],[1.555,.15,.11]], P.suit, 20);
      // Capuche rabattue dans le dos et col montant.
      smoothLoft(m, [[1.44,.15,.045,0,.15],[1.52,.17,.06,0,.16],[1.58,.14,.05,0,.15],[1.62,.08,.03,0,.13]], P.cloth, 16);
      m.cyl(.13,.155,.09,P.cloth,0,1.54,-.005,18);
      // Tee-shirt visible dans l'ouverture, fermeture éclair, tirette.
      m.box(.12,.32,.02,P.cloth,0,1.33,-.166).box(.016,.42,.012,INK,0,1.24,-.178).box(.03,.05,.014,GOLD,0,1.42,-.186);
      // Poches kangourou et coutures.
      for (const side of [-1,1]) m.box(.13,.11,.03,P.accent,side*.09,1.03,-.165,0,0,side*.08).box(.12,.012,.032,INK,side*.09,1.085,-.168,0,0,side*.08);
      // Ceinture épaisse avec grosse boucle.
      m.cyl(.205,.21,.075,INK,0,.9,.004,20).box(.085,.065,.03,GOLD,0,.9,-.205).box(.05,.03,.034,INK,0,.9,-.21);
      // Épaulettes rondes.
      for (const side of [-1,1]) m.ball(.1,P.suit,side*.262,1.465,0,1,.82,1,1).box(.06,.022,.07,P.accent,side*.27,1.53,0,0,0,side*.3);
      m.cyl(.07,.08,.08,P.skin,0,1.6,0,12);
    });
    const head = new T.Group(); head.position.y=1.74;
    head.add(rigPart(detail,m=>{
      const hood=P.id==='char-onyx';
      // Crâne rond et grand (style cartoon), mâchoire douce.
      smoothLoft(m, [[-.215,.06,.06,0,-.025],[-.18,.11,.105,0,-.035],[-.12,.152,.145,0,-.03],[-.04,.175,.168,0,-.012],[.05,.18,.172,0,0],[.13,.17,.162,0,.01],[.2,.135,.128,0,.015],[.25,.075,.07,0,.015],[.27,.02,.02,0,.012]], hood?'#272d42':P.skin, 20);
      if(hood){
        smoothLoft(m, [[-.14,.215,.165],[.06,.255,.2],[.23,.225,.17],[.3,.1,.08]],'#303650',16);
        m.box(.26,.06,.03,INK,0,.02,-.19).box(.07,.016,.01,CYAN,-.07,.03,-.207).box(.07,.016,.01,CYAN,.07,.03,-.207);
        return;
      }
      for (const side of [-1,1]) {
        // Oreilles.
        m.ball(.045,P.skin,side*.178,0,.01,.5,1,.75,1).ball(.022,'#c98a72',side*.188,0,.005,.4,.7,.5,1);
        // Grands yeux : blanc, iris, pupille, reflet.
        m.ball(.05,'#ffffff',side*.068,.022,-.138,1,1.18,.55,2)
         .ball(.031,P.eye,side*.066,.018,-.162,1,1.12,.42,2)
         .ball(.016,'#0b1020',side*.066,.017,-.172,1,1.1,.4,1)
         .box(.011,.011,.004,'#ffffff',side*.058+.004,.032,-.178);
        // Sourcils épais légèrement relevés.
        m.box(.075,.018,.02,P.hair,side*.07,.09,-.156,0,0,side*-.14);
        // Joues rosées.
        m.ball(.028,'#e79a88',side*.105,-.045,-.13,1,.6,.4,1);
      }
      // Nez, sourire, menton.
      m.ball(.027,P.skin,0,-.025,-.17,1,.85,.9,1).ball(.012,'#b8775f',0,-.035,-.188,1,.6,.5,1);
      m.box(.07,.014,.012,'#7a3b33',0,-.098,-.162).box(.022,.012,.012,'#7a3b33',-.038,-.09,-.16,0,0,.5).box(.022,.012,.012,'#7a3b33',.038,-.09,-.16,0,0,-.5);
      m.box(.04,.008,.006,'#ffffff',0,-.092,-.168);
      // Coiffure volumineuse : calotte, mèches avant et nuque.
      smoothLoft(m, [[.06,.19,.18,0,.02],[.15,.2,.19,0,.025],[.23,.17,.16,0,.03],[.29,.11,.1,.01,.03],[.32,.04,.04,.02,.03]],P.hair,18);
      smoothLoft(m, [[-.08,.15,.07,0,.12],[.05,.19,.1,0,.11],[.16,.17,.09,0,.09]],P.hair,14);
      // Mèches en pointes, balayées vers le haut et sur le côté (style cartoon).
      for (let k = 0; k < 6; k++) {
        const a = -.5 + k * .2, len = .12 + (k % 2) * .05;
        m.add(new T.ConeGeometry(.055, len, 7), P.hair, -.12 + k * .048, .2 + Math.cos(a) * .02, -.11 + Math.abs(a) * .03, -1.15 + Math.abs(a) * .25, 0, -a * .9 - .25, 1, 1, .75);
      }
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; m.add(new T.ConeGeometry(.05, .11, 7), P.hair, Math.cos(a) * .11, .28, .05 + Math.sin(a) * .08, .5 + Math.sin(a) * .5, 0, Math.cos(a) * -.6); }
      m.ball(.07,P.hair,.05,.25,-.08,1.4,.8,1.1,1);
      if(P.id==='char-ambre'||P.id==='char-nacre'){ m.ball(.07,P.hair,0,.02,.17,.9,1.6,.8,1).ball(.06,P.hair,0,-.12,.18,.75,1.4,.7,1); }
      else if(P.id==='char-azur') m.ball(.06,P.hair,-.15,.08,.04,.7,1.5,.9,1);
      else if(P.id==='char-sauge') m.cyl(.25,.27,.035,P.suit,0,.2,.012,18).cyl(.2,.225,.12,P.suit,0,.27,.02,16).cyl(.21,.225,.025,GOLD,0,.21,.014,16);
      else if(P.id==='char-cuivre') for (const side of [-1,1]) m.ball(.06,P.hair,side*.14,.05,.1,.8,1.3,.9,1);
    }));
    // Paupières : cachées, elles ferment les yeux le temps d'un clignement.
    const lids = new T.Group(); lids.visible = false;
    if (P.id !== 'char-onyx') lids.add(rigPart(detail, m => { for (const side of [-1,1]) m.sphere(.054,P.skin,side*.068,.026,-.14,1.04,1.16,.62).box(.07,.008,.02,'#5a3a2e',side*.068,.0,-.172); }));
    head.add(lids);
    if(eq.headwear){const h=A.cosmetic(eq.headwear,P), hc=h.color||P.accent, hs=h.secondary||INK;if(/visor|helm|casque/i.test(eq.headwear))head.add(rigPart(detail,m=>m.box(.36,.075,.23,hc,0,.04,-.17).box(.23,.03,.027,hs,0,.014,-.29)));else if(/cap|bonnet|hat|chapeau/i.test(eq.headwear))head.add(rigPart(detail,m=>m.cyl(.26,.30,.09,hc,0,.20,0,12).cyl(.18,.20,.20,hc,0,.31,0,10)));}
    const fx = new T.Group(); fx.visible=false; fx.add(rigPart(detail,m=>{for(let i=0;i<6;i++){const a=i*Math.PI/3;m.ball(.047,i%2?GOLD:CYAN,Math.cos(a)*.34,2.11+Math.sin(a)*.13,-.18,.72,1.35,.38,1);}}));
    torso.add(chest,head,fx);
    /* Faille, éclaireuse du vide (personnage de l'événement) : armure sombre
       striée de lumière de faille, visière, écharpe qui flotte et trois éclats
       de cristal en orbite. Les pièces lumineuses partagent un seul matériau. */
    let riftFx = null;
    if (P.id === 'char-faille') {
      const glow = new T.MeshBasicMaterial({ color: '#7ff3ff', toneMapped: false });
      const glowPart = (build) => { const m = new Model(detail); build(m); return mesh(m, glow); };
      torso.add(rigPart(detail, m => {
        m.box(.33,.22,.05,'#2b4a72',0,1.35,-.172,-.08).box(.24,.14,.045,'#16243a',0,1.18,-.178)
         .box(.07,.36,.05,'#16243a',0,1.30,.165).cyl(.17,.19,.07,'#2b4a72',0,1.53,0,16)
         .box(.42,.06,.08,'#101b2c',0,1.05,-.02);
        for (const side of [-1,1]) m.box(.13,.09,.20,'#2b4a72',side*.30,1.53,0,0,0,side*.35).box(.10,.05,.18,'#16243a',side*.33,1.48,0,0,0,side*.45);
      }));
      torso.add(glowPart(m => {
        m.box(.012,.30,.012,'#fff',0,1.33,-.199).box(.16,.012,.012,'#fff',-.07,1.41,-.198,0,0,.5).box(.16,.012,.012,'#fff',.07,1.41,-.198,0,0,-.5)
         .box(.40,.012,.012,'#fff',0,1.08,-.12).box(.012,.012,.20,'#fff',-.30,1.575,0).box(.012,.012,.20,'#fff',.30,1.575,0)
         .box(.012,.30,.012,'#fff',0,1.30,.193);
      }));
      head.add(glowPart(m => m.box(.30,.042,.03,'#fff',0,.03,-.168).box(.02,.06,.03,'#fff',-.16,.02,-.12).box(.02,.06,.03,'#fff',.16,.02,-.12)));
      head.add(rigPart(detail, m => m.box(.34,.075,.05,'#16243a',0,.03,-.15).box(.05,.16,.10,'#2b4a72',-.17,.0,-.06).box(.05,.16,.10,'#2b4a72',.17,.0,-.06)));
      // Écharpe : trois segments emboîtés qui ondulent selon la vitesse.
      const scarfRoot = new T.Group(); scarfRoot.position.set(0, 1.5, .14); torso.add(scarfRoot);
      const segs = []; let parent = scarfRoot;
      for (let i = 0; i < 4; i++) {
        const seg = new T.Group(); if (i) seg.position.y = -.17; parent.add(seg);
        seg.add(rigPart(detail, m => m.box(.15 - i * .015, .18, .018, i % 2 ? '#7ff3ff' : '#2fb6d9', 0, -.085, 0)));
        segs.push(seg); parent = seg;
      }
      const shards = new T.Group(); shards.position.set(0, 1.45, .3); torso.add(shards);
      for (let i = 0; i < 3; i++) { const sh = new T.Mesh(new T.OctahedronGeometry(.05 + i * .012, 0), glow); sh.scale.y = 2.2; shards.add(sh); }
      riftFx = { scarf: segs, shards, glow };
    }
    /* Midas, le roi d'or : tunique royale violette, couronne de laurier,
       plastron et gantelets d'or (le toucher d'or). Toutes les pièces dorées
       partagent le matériau d'or animé. */
    if (P.id === 'char-midas') {
      const gold = goldMaterial();
      const goldPart = (build) => { const m = new Model(detail); build(m); return mesh(m, gold); };
      torso.add(rigPart(detail, m => {
        m.box(.46,.07,.08,'#2b1240',0,.98,-.02);
      }));
      torso.add(goldPart(m => {
        smoothLoft(m, [[1.06,.17,.03,0,-.205],[1.22,.23,.045,0,-.215],[1.40,.25,.05,0,-.212],[1.50,.21,.045,0,-.2]], '#ffd34d', 18);
        m.box(.10,.10,.03,'#fff0a8',0,1.36,-.262).box(.44,.05,.09,'#e0a92a',0,1.0,-.03)
         .box(.07,.07,.04,'#fff0a8',0,1.0,-.12);
        for (const side of [-1,1]) m.ball(.10,'#ffd34d',side*.30,1.52,0,1.1,.75,1.05,1).box(.15,.035,.035,'#e0a92a',side*.30,1.47,-.09);
      }));
      head.add(goldPart(m => {
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI * .9 + i * Math.PI * 1.8 / 13, r = .172;
          m.box(.075,.03,.02,'#ffd34d',Math.sin(a)*r,.13 + Math.abs(Math.cos(a))*.014,-Math.cos(a)*r*.92,0,-a,i%2?.55:-.55);
        }
        m.box(.035,.09,.02,'#fff0a8',0,.17,-.172,0,0,.785).cyl(.18,.18,.025,'#e0a92a',0,.115,0,16);
      }));
      head.add(rigPart(detail, m => m.sphere(.085,P.hair,0,-.19,-.075,1.05,.55,.9).sphere(.03,P.hair,-.035,-.072,-.172,1.3,.45,.5).sphere(.03,P.hair,.035,-.072,-.172,1.3,.45,.5)));
    }
    /* backpack is deliberately a separate merge: it can be omitted or replaced
       without increasing limb draw calls. */
    const b=A.cosmetic(eq.back,P); torso.add(rigPart(detail,m=>{
      if(eq.back==='back-orbe')m.sphere(.21,b.color||'#dba4ed',0,1.29,.26).cyl(.235,.235,.05,GOLD,0,1.29,.26,16,Math.PI/2);
      else if(eq.back==='back-voile')m.box(.30,.42,.11,b.color||'#67d5d0',0,1.29,.23).box(.35,.46,.025,b.secondary||INK,0,1.25,.31,0,0,.08).box(.08,.34,.025,P.accent,-.17,1.25,.33).box(.08,.34,.025,P.accent,.17,1.25,.33);
      else m.box(.33,.40,.18,b.color||'#e99b57',0,1.29,.23).box(.30,.075,.20,b.secondary||'#5b3242',0,1.44,.23).box(.22,.14,.05,INK,0,1.17,.34).cyl(.055,.055,.39,'#c9dce0',-.21,1.30,.25,8);
    }));
    const limbs=[], knees=[], elbows=[]; const legwear=P.id==='char-nacre'?'#315d83':P.id==='char-cuivre'?'#3d3f4b':P.id==='char-sauge'?'#687552':P.id==='char-azur'?'#274b69':'#33485b', boot=P.id==='char-nacre'?CYAN:P.id==='char-cuivre'?'#45313a':'#243746';
    for(const s of[-1,1]){
      /* Jambes : pantalon cargo arrondi, genouillère, grosses baskets à semelle épaisse. */
      const hip=new T.Group(); hip.position.set(s*.132,.94,0); hip.add(rigPart(detail,m=>{
        smoothLoft(m, [[-.43,.085,.087],[-.3,.1,.1],[-.12,.118,.114],[.03,.108,.1]],legwear,14);
        m.box(.05,.1,.075,legwear,s*.105,-.22,0).box(.052,.016,.078,INK,s*.106,-.17,0);
      }));
      const knee=new T.Group(); knee.position.y=-.42; knee.add(rigPart(detail,m=>{
        smoothLoft(m, [[-.37,.074,.074],[-.2,.084,.086],[-.04,.094,.084]],legwear,14);
        m.ball(.06,P.accent,0,-.02,-.075,1.15,1,.55,1);
        // Basket : semelle épaisse claire, corps arrondi, languette, lacets.
        smoothLoft(m, [[-.38,.088,.1,0,-.03],[-.46,.112,.15,0,-.07],[-.52,.11,.165,0,-.1]],boot,16);
        m.box(.21,.05,.34,'#f4f1ea',0,-.535,-.1).box(.215,.012,.345,P.accent,0,-.51,-.1)
         .ball(.1,boot,0,-.48,-.2,1.05,.7,1,1).box(.09,.07,.03,P.cloth,0,-.4,-.155);
        for (let l = 0; l < 3; l++) m.box(.09,.012,.012,'#ffffff',0,-.42-l*.03,-.18-l*.018);
      }));
      hip.add(knee); group.add(hip); limbs.push(hip); knees.push(knee);
      /* Bras : manche ample, poignet, grosse main cartoon (paume, quatre doigts, pouce). */
      const shoulder=new T.Group(); shoulder.position.set(s*.255,1.45,0); shoulder.add(rigPart(detail,m=>{
        smoothLoft(m, [[-.33,.072,.07],[-.18,.088,.082],[-.03,.104,.09],[.05,.09,.08]],P.suit,16);
        m.box(.03,.12,.02,P.accent,s*.06,-.16,-.06,0,0,s*.2);
      }));
      const elbow=new T.Group(); elbow.position.y=-.32; elbow.add(rigPart(detail,m=>{
        smoothLoft(m, [[-.25,.062,.058],[-.14,.07,.066],[-.01,.074,.07]],P.suit,14);
        m.cyl(.068,.072,.05,P.cloth,0,-.255,0,14);
        // Main.
        m.ball(.058,P.skin,0,-.33,-.006,1,1.05,.62,2);
        for(let f=0;f<4;f++){ const fx=-.033+f*.022; m.sphere(.017,P.skin,fx,-.382+(f===0||f===3?.008:0),-.012,.85,1.9,.9); }
        m.ball(.026,P.skin,-s*.058,-.322,-.02,.75,1.5,.85,1);
      }));
      if (P.id === 'char-midas') {
        const gm = new Model(detail);
        smoothLoft(gm, [[-.30,.062,.060],[-.20,.072,.068],[-.11,.066,.064]], '#ffd34d', 12);
        gm.ball(.052,'#ffd34d',0,-.34,-.008,1,1.15,.82,1).box(.085,.06,.05,'#e0a92a',0,-.385,-.012);
        for (let finger = 0; finger < 4; finger++) gm.ball(.015,'#fff0a8',-.030+finger*.020,-.392,-.012,.75,1.7,.85,1);
        gm.ball(.027,'#ffd34d',-s*.056,-.332,-.009,.72,1.4,.9,1);
        elbow.add(mesh(gm, goldMaterial()));
      }
      shoulder.add(elbow); torso.add(shoulder); limbs.push(shoulder); elbows.push(elbow);
    }
    /* Bassin : un volume continu qui enveloppe le haut des cuisses, pour que la
       jambe reste rattachée au corps même en grande foulée. */
    const pelvis=rigPart(detail,m=>{smoothLoft(m,[[.76,.17,.115],[.86,.215,.135],[.97,.21,.135],[1.02,.19,.125]],legwear,14);m.box(.05,.09,.02,P.accent,0,.84,-.135);});group.add(pelvis);
    const gun=weapon('rifle',P.accent,eq.wrap);gun.position.set(.23,1.15,-.43);group.add(gun);
    /* Pioche v67 : plus grande (manche 1,36 m, tête 1,15 m), tête à double pic
       courbé, manche bois cerclé, poignée gainée, gemme d'énergie. Origine du
       groupe = la main (prise principale) ; le manche monte selon +Y et les pics
       s'étendent selon ±Z, donc la tête reste dans le plan du coup. */
    const tool=new T.Group(), tc=A.cosmetic(eq.tool,P), tA=tc.color||P.accent, tB=tc.secondary||INK;
    tool.add(rigPart(detail,m=>{
      m.cyl(.032,.038,1.36,'#6e4527',0,.55,0,10).sphere(.058,GOLD,0,-.15,0).cyl(.047,.047,.30,tB,0,.03,0,10);
      for(let i=0;i<5;i++)m.cyl(.051,.051,.016,'#2a1a10',0,-.09+i*.06,0,10);
      m.cyl(.05,.05,.05,GOLD,0,.23,0,10).cyl(.045,.045,.04,GOLD,0,.95,0,10)
       .box(.15,.24,.24,tB,0,1.17,0).box(.17,.06,.26,GOLD,0,1.30,0).box(.17,.05,.26,GOLD,0,1.04,0)
       .box(.03,.09,.09,CYAN,.085,1.17,0).box(.03,.09,.09,CYAN,-.085,1.17,0);
      for(const d of[-1,1]){
        for(let k=0;k<3;k++){
          const z=d*(.20+k*.135), y=1.17-k*.012-k*k*.03;
          m.box(.12-k*.022,.15-k*.03,.16,k===1?tA:tA,0,y,z,d*(.10+k*.17));
          m.box(.124-k*.022,.03,.16,k%2?GOLD:'#ffffff',0,y+.07-k*.016,z,d*(.10+k*.17));
        }
        m.cyl(0,.042,.17,'#e8f4f6',0,1.02,d*.58,6,d*(Math.PI/2+.62));
      }
    }));
    tool.position.set(.24,1.26,-.24);tool.rotation.set(.75,0,-.12);tool.visible=false;tool.userData.grips={primary:[0,0,0],support:[0,.40,0]};tool.userData.v67=true;group.add(tool);
    const glider=new T.Group(),gc=A.cosmetic(eq.glider,P);glider.add(rigPart(detail,m=>{m.box(.15,.12,3.9,INK,0,.16,0,0,Math.PI/2).box(2.16,.075,1.35,gc.color||P.suit,-1.10,.22,.02,0,0,-.18).box(2.16,.075,1.35,gc.color||P.suit,1.10,.22,.02,0,0,.18).box(.42,.14,1.82,gc.secondary||P.accent,0,.23,.02).cyl(.052,.075,4.55,INK,0,.25,-.47,14,0,Math.PI/2).box(.58,.22,1.26,INK,0,.20,-.04).cyl(.018,.018,1.5,'#d4e8e5',-.98,-.31,-.37,6,0,.86).cyl(.018,.018,1.5,'#d4e8e5',.98,-.31,-.37,6,0,-.86).cyl(.026,.026,.34,INK,-.43,-.82,.08,8,0,Math.PI/2).cyl(.026,.026,.34,INK,.43,-.82,.08,8,0,Math.PI/2).sphere(.055,GOLD,-.43,-.82,.08).sphere(.055,GOLD,.43,-.82,.08);for(const side of[-1,1])for(let rib=0;rib<4;rib++)m.box(.035,.09,1.1,rib%2?GOLD:'#d9eee9',side*(.54+rib*.43),.315,.01,0,0,side*(.04+rib*.03));}));
    const rotor=new T.Group();rotor.add(rigPart(detail,m=>{m.cyl(.075,.075,.12,GOLD,0,0,0,10,Math.PI/2);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;m.box(.075,.36,.024,i%2?'#d9fff7':CYAN,Math.sin(a)*.16,Math.cos(a)*.16,0,0,0,-a);}}));rotor.position.set(0,.20,-1.055);glider.add(rotor);glider.position.y=2.9;glider.visible=false;glider.userData={handles:{left:[-.43,-.82,.08],right:[.43,-.82,.08]},rotor,navLights:[],wingTips:[],ribbons:[],brakePanels:[]};group.add(glider);
    const blueprint=new T.Mesh(new T.PlaneGeometry(.47,.35),new T.MeshBasicMaterial({color:'#36cfe2',transparent:true,opacity:.72,side:T.DoubleSide}));blueprint.position.set(-.26,1.23,-.38);blueprint.rotation.x=-.5;blueprint.visible=false;group.add(blueprint);
    const rod=rigPart(detail,m=>m.cyl(.012,.024,1.65,INK,0,0,0,6).cyl(.035,.035,.06,GOLD,0,-.44,0,8,Math.PI/2));rod.position.set(.30,1.65,-.48);rod.rotation.x=-.48;rod.visible=false;group.add(rod);
    Object.assign(group.userData,{lids,riftFx,pelvis,limbs,knees,elbows,torso,head,emoteFx:fx,gun,gunKey:'rifle',gunWrap:eq.wrap||'',rigVersion:'2.2.0',restLimbPositions:limbs.map(limb=>limb.position.clone()),avatarScale:1.22,detail,tool,glider,blueprint,rod,handTargets:{weaponPrimary:[.23,1.03,-.30],weaponSupport:[.23,1.17,-.77],gliderLeft:[-.43,2.08,.08],gliderRight:[.43,2.08,.08]},equipment:JSON.stringify(eq),walk:0,anim:0,recoil:0,harvest:0});
    return group;
  }

  /* Decoration is strictly contained inside the authoritative 3x3 cells. This
     preserves every edited hole: renderer geometry never claims a collision face. */
  function buildModel(b, ghost=false){
    // Rendering and physics share the same four-zone floors and cone triangles.
    return buildGeometry(b, ghost);
  }
  /* v19 game-feel effects: pooled tracers, impact sparks, dust, explosions,
     eliminations, muzzle flashes, shell casings and build dust. Everything is
     pooled and capped (no per-shot allocation) so the game holds 60 fps on
     iPhone; FX.setMobile(true) — auto-detected from the user agent — switches
     to the light versions. The view calls FX.update(dt) once per frame.
     Suggested wiring (view.js, worker client): emit() 'shot' → FX.spawnTracer
     + FX.spawnMuzzle at the muzzle; shot-effect end → FX.spawnImpact;
     'explosion' → FX.spawnExplosion; 'elimination' → FX.spawnElimination;
     build spawn → mesh.scale.setScalar(A.buildSpawnScale(age)) + one
     FX.spawnBuildPuff at the base. */
  const FX = (() => {
    let mobile = false;
    try { mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || ''); } catch (e) { /* noop */ }
    const pools = { tracer: [], spark: [], ring: [], flash: [], casing: [], puff: [] };
    const CAPS = () => mobile
      ? { tracer: 8, spark: 5, ring: 4, flash: 5, casing: 0, puff: 5 }
      : { tracer: 22, spark: 12, ring: 8, flash: 10, casing: 14, puff: 10 };
    const tmpDir = new T.Vector3(), tmpZ = new T.Vector3(0, 0, 1);
    const additive = (color, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending });
    const easeOut = v => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3);
    function take(list, cap, make) {
      let fx = list.find(f => f.life <= 0);
      if (!fx) {
        if (list.length >= cap) return null;
        fx = make(); list.push(fx);
      }
      return fx;
    }
    function sceneAdd(scene, obj) { obj.visible = true; scene.add(obj); }
    function sceneDrop(fx, obj) { obj.visible = false; if (obj.parent) obj.parent.remove(obj); fx.life = 0; }
    /* --- delayed secondaries: a fixed ring buffer fires follow-up FX a few
       frames later (explosion echo, dirt fountain) with zero per-frame
       allocation. queueDelayed overwrites the oldest slot when full. --- */
    const delayed = [];
    for (let i = 0; i < 16; i++) delayed.push({ t: 0, type: 0, scale: 1, scene: null, pos: new T.Vector3() });
    let delayedHead = 0;
    const tmpUp = new T.Vector3();
    function queueDelayed(type, scene, pos, delay, scale) {
      const d = delayed[delayedHead]; delayedHead = (delayedHead + 1) % delayed.length;
      d.t = delay; d.type = type; d.scene = scene; d.scale = scale; d.pos.copy(pos);
    }
    function fireDelayed(d) {
      if (d.type === 1) {
        spawnRing(d.scene, d.pos, 0xff8a3c, 5 * d.scale, .5);
        spawnFlash(d.scene, d.pos, 0xffb35c, 2 * d.scale, .3);
        spawnPuff(d.scene, tmpUp.copy(d.pos).setY(d.pos.y + 1.5 * d.scale), 0x4a4a4a, mobile ? 6 : 12, .8 * d.scale, 1.0);
      } else if (d.type === 2) {
        spawnBurst(d.scene, d.pos, { count: mobile ? 6 : 12, color: 0x9a7b52, speed: 4, up: 6, size: .22, gravity: 11, life: .6, dust: true });
      }
      d.t = 0;
    }
    /* --- tracers: pooled glowing bolts, no per-shot allocation --- */
    const tracerGeo = new T.BoxGeometry(.055, .055, 1);
    function spawnTracer(scene, a, b, color = 0xffe9a8, width = 1) {
      const fx = take(pools.tracer, CAPS().tracer, () => ({ mesh: new T.Mesh(tracerGeo, additive(color)), life: 0, max: 1 }));
      if (!fx) return null;
      const dist = a.distanceTo(b);
      fx.max = Math.min(.22, Math.max(.07, dist / 900)); fx.life = fx.max;
      fx.mesh.material.color.setHex(color); fx.mesh.material.opacity = .95;
      fx.mesh.scale.set(width, width, Math.max(.3, dist * .55));
      fx.mesh.position.copy(a).lerp(b, .5);
      fx.mesh.quaternion.setFromUnitVectors(tmpZ, tmpDir.copy(b).sub(a).normalize());
      sceneAdd(scene, fx.mesh);
      return fx;
    }
    /* --- spark bursts: one pooled THREE.Points per burst --- */
    /* v83 : points ronds et doux (avant : carrés blancs visibles, ex. poussière d'atterrissage). */
    let dotTex = null;
    function softDot() {
      if (dotTex || typeof document === 'undefined') return dotTex;
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.75)'); r.addColorStop(.7, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64); dotTex = new T.CanvasTexture(c); dotTex.colorSpace = T.SRGBColorSpace; return dotTex;
    }
    function makePoints(n, size, color, isAdditive) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
      const m = new T.PointsMaterial({ color, size: size * 1.6, map: softDot(), alphaTest: .01, transparent: true, opacity: 1, depthWrite: false, blending: isAdditive ? T.AdditiveBlending : T.NormalBlending, sizeAttenuation: true });
      const p = new T.Points(g, m); p.frustumCulled = false;
      return p;
    }
    function spawnBurst(scene, pos, o = {}) {
      const { count = 14, color = 0xffd27a, speed = 5, up = 3, size = .16, gravity = 9, life = .5, dust = false } = o;
      const fx = take(pools.spark, CAPS().spark, () => {
        const n = mobile ? 10 : 22;
        return { points: makePoints(n, size, color, !dust), n, vel: new Float32Array(n * 3), life: 0, max: 1, gravity: 9, dust };
      });
      if (!fx) return null;
      const n = fx.n, parr = fx.points.geometry.attributes.position.array;
      const c = Math.min(count, n);
      for (let i = 0; i < n; i++) {
        const on = i < c;
        if (!on) { parr[i * 3 + 1] = -9999; fx.vel[i * 3] = fx.vel[i * 3 + 1] = fx.vel[i * 3 + 2] = 0; continue; }
        parr[i * 3] = pos.x; parr[i * 3 + 1] = pos.y; parr[i * 3 + 2] = pos.z;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = speed * (.35 + Math.random() * .85);
        fx.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
        fx.vel[i * 3 + 1] = Math.cos(ph) * sp * .7 + up * Math.random();
        fx.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      }
      fx.points.geometry.attributes.position.needsUpdate = true;
      fx.points.material.color.setHex(color); fx.points.material.size = size * 1.6; fx.points.material.opacity = dust ? .55 : 1;
      fx.gravity = gravity; fx.max = life; fx.life = life;
      sceneAdd(scene, fx.points);
      return fx;
    }
    /* --- shockwave rings --- */
    const ringGeo = new T.RingGeometry(.86, 1, 40);
    function spawnRing(scene, pos, color = 0xfff2c0, maxR = 3, life = .45, flat = true) {
      const fx = take(pools.ring, CAPS().ring, () => ({ mesh: new T.Mesh(ringGeo, additive(color, .9)), life: 0, max: 1, maxR: 3 }));
      if (!fx) return null;
      fx.max = life; fx.life = life; fx.maxR = maxR;
      fx.mesh.material.color.setHex(color); fx.mesh.material.opacity = .9;
      fx.mesh.position.copy(pos);
      fx.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
      fx.mesh.scale.setScalar(.2);
      sceneAdd(scene, fx.mesh);
      return fx;
    }
    /* --- core flashes --- */
    const flashGeo = new T.SphereGeometry(1, 12, 8);
    function spawnFlash(scene, pos, color = 0xfff3c0, size = 1.6, life = .22) {
      const fx = take(pools.flash, CAPS().flash, () => ({ mesh: new T.Mesh(flashGeo, additive(color)), life: 0, max: 1, size: 1 }));
      if (!fx) return null;
      fx.max = life; fx.life = life; fx.size = size;
      fx.mesh.material.color.setHex(color); fx.mesh.material.opacity = 1;
      fx.mesh.position.copy(pos); fx.mesh.scale.setScalar(.2);
      sceneAdd(scene, fx.mesh);
      return fx;
    }
    /* --- shell casings: tiny tumbling boxes, skipped on mobile --- */
    const casingGeo = new T.BoxGeometry(.035, .035, .07);
    function spawnCasing(scene, pos, dir) {
      const fx = take(pools.casing, CAPS().casing, () => ({ mesh: new T.Mesh(casingGeo, new T.MeshBasicMaterial({ color: 0xffd97a })), vel: new T.Vector3(), spin: new T.Vector3(), life: 0, max: 1 }));
      if (!fx) return null;
      fx.max = .8; fx.life = .8;
      fx.mesh.position.copy(pos);
      fx.vel.copy(dir).multiplyScalar(2.2); fx.vel.y += 1.6;
      fx.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      fx.mesh.material.opacity = 1; fx.mesh.material.transparent = true;
      sceneAdd(scene, fx.mesh);
      return fx;
    }
    /* --- dust puffs: soft normal-blended points --- */
    function spawnPuff(scene, pos, color = 0xcfc4ae, count = 10, size = .5, life = .7) {
      return spawnBurst(scene, pos, { count, color, speed: 1.6, up: 1.1, size, gravity: -1.2, life, dust: true });
    }
    /* --- composed effects --- */
    function spawnImpact(scene, pos, color = 0xffe3b4) {
      spawnBurst(scene, pos, { count: mobile ? 6 : 12, color, speed: 4.5, up: 2, size: .13, gravity: 10, life: .38 });
      spawnFlash(scene, pos, 0xfff6d8, .55, .12);
    }
    function spawnMuzzle(scene, pos, dir, scale = 1) {
      spawnFlash(scene, pos, 0xffe9a8, 1.1 * scale, .1);
      const tip = pos.clone().addScaledVector(dir, .8 * scale);
      spawnBurst(scene, tip, { count: mobile ? 3 : 6, color: 0xffc46a, speed: 3, up: .5, size: .11, gravity: 4, life: .22 });
      spawnPuff(scene, tip, 0xbfb49a, mobile ? 2 : 4, .22 * scale, .5); // powder smoke wisp
    }
    function spawnExplosion(scene, pos, scale = 1) {
      spawnFlash(scene, pos, 0xfff3c0, 2.4 * scale, .3);
      spawnFlash(scene, pos, 0xff9a3c, 3.4 * scale, .42);
      spawnRing(scene, pos, 0xffb35c, 7 * scale, .5);
      spawnBurst(scene, pos, { count: mobile ? 10 : 26, color: 0xff9a3c, speed: 11 * scale, up: 5, size: .2, gravity: 9, life: .7 });
      if (!mobile) spawnPuff(scene, pos.clone().add(new T.Vector3(0, 1.2 * scale, 0)), 0x5a5a5a, 12, .9 * scale, 1.1);
      else spawnPuff(scene, pos, 0x8a8a8a, 5, .6 * scale, .7);
    }
    function spawnElimination(scene, pos) {
      const top = pos.clone(); top.y += 3.2;
      spawnTracer(scene, pos, top, 0x7df8ff, 2.2);
      spawnRing(scene, pos, 0x7df8ff, 3.4, .55);
      spawnFlash(scene, pos.clone().add(new T.Vector3(0, 1, 0)), 0xbdfcff, 1.4, .3);
      spawnBurst(scene, pos.clone().add(new T.Vector3(0, .6, 0)), { count: mobile ? 8 : 18, color: 0x7df8ff, speed: 3.4, up: 5.5, size: .15, gravity: 2, life: .8 });
    }
    function spawnBuildPuff(scene, pos) {
      spawnPuff(scene, pos, 0xd8cbaa, mobile ? 5 : 10, .55, .6);
      spawnRing(scene, pos, 0xfff2c0, 2.2, .35);
    }
    /* Shield damage feedback: cyan burst + tight ring, distinct from health hits. */
    function spawnShieldHit(scene, pos) {
      spawnBurst(scene, pos, { count: mobile ? 6 : 12, color: 0x6fd8ff, speed: 3.5, up: 2.5, size: .13, gravity: 4, life: .4 });
      spawnFlash(scene, pos, 0xbfe9ff, .8, .14);
      spawnRing(scene, pos, 0x6fd8ff, 1.6, .3);
    }
    /* Big cinematic explosion: the base blast plus two delayed secondaries
       (fire echo, dirt fountain) scheduled through the ring buffer. */
    function spawnExplosionBig(scene, pos, scale = 1) {
      spawnExplosion(scene, pos, scale);
      queueDelayed(1, scene, pos, .18, scale);
      queueDelayed(2, scene, pos, .34, scale);
    }
    function update(dt) {
      for (const d of delayed) { if (d.t <= 0) continue; d.t -= dt; if (d.t <= 0) fireDelayed(d); }
      for (const fx of pools.tracer) {
        if (fx.life <= 0) continue;
        fx.life -= dt;
        if (fx.life <= 0) { sceneDrop(fx, fx.mesh); continue; }
        fx.mesh.material.opacity = .15 + .8 * (fx.life / fx.max);
      }
      for (const fx of pools.spark) {
        if (fx.life <= 0) continue;
        fx.life -= dt;
        if (fx.life <= 0) { sceneDrop(fx, fx.points); continue; }
        const parr = fx.points.geometry.attributes.position.array, n = fx.n, g = fx.gravity * dt;
        for (let i = 0; i < n; i++) {
          if (parr[i * 3 + 1] < -9000) continue;
          fx.vel[i * 3 + 1] -= g;
          parr[i * 3] += fx.vel[i * 3] * dt; parr[i * 3 + 1] += fx.vel[i * 3 + 1] * dt; parr[i * 3 + 2] += fx.vel[i * 3 + 2] * dt;
          if (parr[i * 3 + 1] < 0) { parr[i * 3 + 1] = 0; fx.vel[i * 3 + 1] *= -.35; fx.vel[i * 3] *= .7; fx.vel[i * 3 + 2] *= .7; }
        }
        fx.points.geometry.attributes.position.needsUpdate = true;
        fx.points.material.opacity = (fx.dust ? .55 : 1) * (fx.life / fx.max);
      }
      for (const fx of pools.ring) {
        if (fx.life <= 0) continue;
        fx.life -= dt;
        if (fx.life <= 0) { sceneDrop(fx, fx.mesh); continue; }
        const k = 1 - fx.life / fx.max;
        fx.mesh.scale.setScalar(.2 + easeOut(k) * fx.maxR);
        fx.mesh.material.opacity = .9 * (1 - k);
      }
      for (const fx of pools.flash) {
        if (fx.life <= 0) continue;
        fx.life -= dt;
        if (fx.life <= 0) { sceneDrop(fx, fx.mesh); continue; }
        const k = 1 - fx.life / fx.max;
        fx.mesh.scale.setScalar(.2 + easeOut(k) * fx.size);
        fx.mesh.material.opacity = 1 - k;
      }
      for (const fx of pools.casing) {
        if (fx.life <= 0) continue;
        fx.life -= dt;
        if (fx.life <= 0) { sceneDrop(fx, fx.mesh); continue; }
        fx.vel.y -= 9.5 * dt;
        fx.mesh.position.addScaledVector(fx.vel, dt);
        fx.mesh.rotation.x += fx.spin.x * dt; fx.mesh.rotation.y += fx.spin.y * dt; fx.mesh.rotation.z += fx.spin.z * dt;
        if (fx.mesh.position.y < .03) { fx.mesh.position.y = .03; fx.vel.set(0, 0, 0); fx.spin.multiplyScalar(.9); }
        fx.mesh.material.opacity = Math.min(1, fx.life / .3);
      }
    }
    return {
      spawnTracer, spawnImpact, spawnDust: spawnPuff, spawnExplosion, spawnExplosionBig, spawnShieldHit, spawnElimination,
      spawnMuzzle, spawnCasing, spawnBuildPuff, update,
      setMobile(b) { mobile = !!b; },
      get mobile() { return mobile; },
    };
  })();
  /* v19: constructions pop into the world with an eased overshoot instead of
     appearing instantly. Pure function: returns the uniform scale for the
     build's age in seconds — call every frame, then one FX.spawnBuildPuff at
     the base on placement. */
  const easeOutBackA = v => { v = Math.min(1, Math.max(0, v)); const c = 1.70158; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  function buildSpawnScale(age) {
    if (age >= .38) return 1;
    if (age <= 0) return .55;
    return .55 + .45 * easeOutBackA(age / .38);
  }
  A.fx = FX; A.buildSpawnScale = buildSpawnScale;
  A.v2Material = mat;
  A.avatar = avatar; A.weapon = weapon; A.buildModel = buildModel; A.goldMaterial = goldMaterial; A.goldClock = goldClock;
  if(root.AZView){ root.AZView.avatar=avatar; root.AZView.weapon=weapon; }
})(window);
