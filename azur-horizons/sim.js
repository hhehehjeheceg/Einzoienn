/* AZUR deterministic game simulation — no DOM or renderer dependency. */
(function(root){
'use strict';
var TAU=Math.PI*2, SEA=-2;
/* v94 — île « saison 8/9 » : si map-s8-data.js est chargé (navigateur), le contour, la neige,
 * le désert, les forêts et la lave viennent des masques tirés de la carte de référence
 * (tools/azur/map-s8.py). Sinon (test Node), l'ancienne île procédurale reste en place. */
var MAPD=null;
(function(){var D=root.AZMapS8;if(!D||!D.sdf)return;try{
 var dec=function(t){if(typeof atob==='function'){var b=atob(t),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}return new Uint8Array(Buffer.from(t,'base64'));};
 var sd=dec(D.sdf);MAPD={n:D.n,cell:D.cell,half:D.half,sdf:new Int8Array(sd.buffer,sd.byteOffset,sd.length),snow:dec(D.snow),desert:dec(D.desert),forest:dec(D.forest),lava:dec(D.lava)};
}catch(e){MAPD=null;}})();
function mapSample(a,x,z){var n=MAPD.n,c=MAPD.cell,fx=(x+MAPD.half)/c-.5,fz=(z+MAPD.half)/c-.5;if(fx<0)fx=0;else if(fx>n-1.001)fx=n-1.001;if(fz<0)fz=0;else if(fz>n-1.001)fz=n-1.001;var ix=fx|0,iz=fz|0,tx=fx-ix,tz=fz-iz,i=iz*n+ix;return (a[i]*(1-tx)+a[i+1]*tx)*(1-tz)+(a[i+n]*(1-tx)+a[i+n+1]*tx)*tz;}
/* Lieux fixes de l'île v94 : rivière (de Loot Lake à la côte sud), cratère de la météorite près de
 * la Méga Galerie, base de lancement de la fusée, pic enneigé, point de vue de l'événement. */
var RIVER=[{x:-100,z:-150},{x:-94,z:-106},{x:-133,z:0},{x:-94,z:157},{x:-124,z:263},{x:-115,z:344},{x:-94,z:417},{x:-30,z:492},{x:12,z:543},{x:27,z:643},{x:33,z:760}];
var METEOR_SITE={x:180,z:44,r:20},LAUNCH_SITE={x:-20,z:108,r:42,h:10},PEAK={x:-400,z:330,r:210,h:95},SPOT_S8={px:60,pz:290};
var FORDS=[];
function riverDist(x,z){if(x<-175||x>75||z<-190||z>800)return 1e9;var m=1e9;for(var i=1;i<RIVER.length;i++){var a=RIVER[i-1],b=RIVER[i],dx=b.x-a.x,dz=b.z-a.z,t=((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz);t=t<0?0:t>1?1:t;var e=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);if(e<m)m=e;}return m;}
function riverFord(x,z){for(var i=0;i<FORDS.length;i++)if(Math.abs(x-FORDS[i].x)<9&&Math.abs(z-FORDS[i].z)<9)return true;return false;}
/* Île v68 : un grand cœur arrondi (les villes) prolongé de quatre péninsules
 * aux biomes marqués — volcan au nord-ouest, pics enneigés au nord-est, jungle
 * à l'ouest, canyon désertique au sud-est — plus un cap au nord, et creusé de
 * quatre baies. La même métrique fait foi pour le relief, l'eau et la carte. */
var MAP={halfSize:880,landRadius:800,shoreStart:720,shoreEnd:775,
 waiting:{x:1180,z:-1090,radius:82},
 transport:{duration:38,startX:-700,startZ:420,velocityX:37,velocityZ:-22,altitude:1500}};
var LOBES=[{x:-610,z:-540,r:185,zone:'volcano'},{x:590,z:-580,r:160,zone:'snow'},{x:-700,z:290,r:150,zone:'jungle'},{x:575,z:575,r:175,zone:'desert'},{x:30,z:-690,r:115,zone:'meadow'}];
var BAYS=[[-90,700,230],[715,40,200],[-725,-120,185],[255,-715,165]];
var VOLCANO=MAPD?{x:411,z:-344,r:185,h:120,crater:76}:{x:-640,z:-560,r:250,h:175,crater:40};
/* Lac des Reflets : eau douce au sud, avec un îlot et sa maison. */
var LAKE=MAPD?{x:-105,z:-218,r:72,isle:20}:{x:-115,z:465,r:52,isle:11};
var WORLD=MAP.halfSize, ISLAND=MAP.landRadius, MATCH_PARTICIPANTS=100;
/* Metres/second; shared by local and LAN simulation, HUDs and behavior tests.
 * Looking down only adds a small controlled descent bias; sprint accelerates
 * horizontal travel and never turns into a vertical plunge. Ordinary jumps
 * keep their own 18 m/s² gravity. No new input packet keys are required. */
var FLIGHT=Object.freeze({freefallSpeed:26,diveSpeed:30,gravity:16,diveGravity:20,
 freefallControlSpeed:26,diveControlSpeed:32,glideSpeed:36,glideFastSpeed:42,
 glideSink:4.6,glideFastSink:5.4,autoGliderHeight:135,busInitialSink:4,
 divePitchStart:.35,divePitchRange:.75});
var EMOTE_STYLES=Object.freeze(['salut','danse','victoire','robot','etoile','toupie']);
function smin(a,b,k){var h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
function coastDistance(x,z){
 if(MAPD){var sdm=mapSample(MAPD.sdf,x,z)*4,wob=4*Math.sin(x*.043-z*.031)+3*Math.sin((x+z)*.071)+2*Math.sin(x*.13+z*.09);return Math.max(0,MAP.shoreEnd-1.15*(sdm+wob));}
 var ax=Math.abs(x),az=Math.abs(z)*1.02,p=4.5,i,q;
 var d=Math.pow(Math.pow(ax,p)+Math.pow(az,p),1/p)*720/628;
 for(i=0;i<LOBES.length;i++)d=smin(d,Math.hypot(x-LOBES[i].x,z-LOBES[i].z)/LOBES[i].r*720,110);
 for(i=0;i<BAYS.length;i++){q=Math.max(0,1-Math.hypot(x-BAYS[i][0],z-BAYS[i][1])/BAYS[i][2]);d+=q*q*430;}
 return Math.max(0,d+11*Math.sin(x*.011)*Math.cos(z*.009)+7*Math.sin((x+z)*.017)+4*Math.sin(x*.043-z*.031));
}
var rarities=[
 {name:'Commun',color:'#aab8c8',multiplier:1},
 {name:'Peu commun',color:'#58c983',multiplier:1.12},
 {name:'Rare',color:'#3f9cff',multiplier:1.25},
 {name:'Épique',color:'#a56bff',multiplier:1.42},
 {name:'Légendaire',color:'#ffad31',multiplier:1.6}
];
/* Building durability is deliberately material-led rather than cosmetic: a wood
 * screen buys a short reposition, while stone/metal can sustain a real fight. */
var BUILD_DURABILITY={wood:220,stone:380,metal:520};
function buildHP(material){return BUILD_DURABILITY[material]||BUILD_DURABILITY.wood;}
var weapons={
 pistol:{name:'Pistolet',damage:19,rate:3.5,range:105,spread:.025,clip:12,reserve:48,reload:1.28},
 revolver:{name:'Revolver',damage:34,rate:2.1,range:125,spread:.018,clip:6,reserve:36,reload:1.45},
 rifle:{name:'Fusil d’assaut',damage:17,rate:8,range:150,spread:.016,clip:30,reserve:90,reload:1.68},
 burst:{name:'Fusil rafale',damage:20,rate:4.8,range:155,spread:.02,clip:24,reserve:72,reload:1.68,burst:3},
 smg:{name:'SMG',damage:12,rate:11,range:75,spread:.04,clip:30,reserve:120,reload:1.58},
 shotgun:{name:'Fusil à pompe',damage:10,pellets:8,rate:1.05,range:34,spread:.12,clip:6,reserve:30,reload:1.85},
 tactical:{name:'Fusil tactique',damage:27,pellets:3,rate:1.8,range:62,spread:.065,clip:8,reserve:32,reload:1.9},
 sniper:{name:'Fusil de précision',damage:74,rate:.72,range:240,spread:.003,clip:5,reserve:25,reload:2.08},
 dmr:{name:'DMR',damage:46,rate:1.7,range:210,spread:.008,clip:10,reserve:40,reload:1.8},
 launcher:{name:'Lanceur',damage:78,rate:.65,range:105,spread:.018,clip:1,reserve:8,reload:2.4}
};
var regionsV68=[
 {name:'Port Corail',x:-350,z:350,color:'#f27865',biome:'sand',style:'port',padW:78,padD:76},
 {name:'Forêt d’Opale',x:-330,z:-225,color:'#44a882',biome:'grass',style:'forest',padW:72,padD:66},
 {name:'Dunes d’Or',x:115,z:350,color:'#e7b84d',biome:'desert',style:'desert',padW:76,padD:66},
 {name:'Citadelle Azur',x:15,z:20,color:'#4d91d4',biome:'grass',style:'citadel',padW:88,padD:82},
 {name:'Falaises Saphir',x:365,z:-315,color:'#657ddd',biome:'snow',style:'cliff',padW:62,padD:54},
 {name:'Lagune Teal',x:390,z:185,color:'#27b9b1',biome:'sand',style:'lagoon',padW:62,padD:54},
 {name:'Ferme Aurore',x:-80,z:-390,color:'#c77a52',biome:'grass',style:'farm',padW:64,padD:54},
 {name:'Observatoire',x:295,z:-35,color:'#b36ac8',biome:'snow',style:'observatory',padW:62,padD:54},
 /* Keep the first eight region indices and all cosmetic/progression style IDs.
  * New settlements reuse authored architecture, not unrecognised skin names. */
 {name:'Val des Lucioles',x:-355,z:-420,color:'#a0bb65',biome:'grass',style:'farm',padW:64,padD:54},
 {name:'Bourg des Brises',x:-330,z:40,color:'#df987b',biome:'grass',style:'forest',padW:72,padD:66},
 {name:'Bastide Mandarine',x:-115,z:305,color:'#eea34f',biome:'grass',style:'desert',padW:76,padD:66},
 {name:'Sources Turquoise',x:145,z:-300,color:'#54c8b9',biome:'grass',style:'lagoon',padW:62,padD:54},
 {name:'Hameau des Pins',x:-225,z:-360,color:'#6cb88a',biome:'grass',style:'forest',padW:55,padD:45},
 {name:'Crique des Brumes',x:420,z:20,color:'#46b7b3',biome:'sand',style:'lagoon',padW:54,padD:50},
 {name:'Plateau des Aigles',x:270,z:430,color:'#d89c49',biome:'desert',style:'desert',padW:76,padD:58},
 {name:'Clairière des Sources',x:150,z:-430,color:'#78ad69',biome:'grass',style:'farm',padW:64,padD:54},
 {name:'Quartier des Marées',x:-430,z:155,color:'#4bb8c5',biome:'sand',style:'port',padW:66,padD:58},
 {name:'Ville des Cascades',x:-5,z:-235,color:'#579ac2',biome:'grass',style:'citadel',padW:78,padD:72},
 {name:'Belvédère du Levant',x:430,z:-145,color:'#c58b67',biome:'grass',style:'observatory',padW:64,padD:56},
 /* v71 : hameaux de la grande île (anneau extérieur et péninsules). */
 {name:'Ranch Écarlate',x:500,z:360,color:'#e0763a',biome:'desert',style:'desert',layout:'hamlet',padW:50,padD:42},
 {name:'Moulins du Couchant',x:-540,z:-320,color:'#d9a441',biome:'grass',style:'farm',layout:'hamlet',padW:50,padD:42},
 {name:'Phare du Nord',x:-20,z:-700,color:'#ff5d6c',biome:'grass',style:'port',layout:'hamlet',padW:50,padD:42},
 {name:'Oasis Dorée',x:60,z:520,color:'#f2c14e',biome:'desert',style:'lagoon',layout:'hamlet',padW:50,padD:42},
 {name:'Village des Lianes',x:-760,z:280,color:'#3fbf6a',biome:'grass',style:'forest',layout:'hamlet',padW:50,padD:42},
 {name:'Chalets du Givre',x:540,z:-320,color:'#9fd8ff',biome:'snow',style:'cliff',layout:'hamlet',padW:50,padD:42},
 {name:'Anse aux Mouettes',x:-320,z:540,color:'#2fb7b0',biome:'sand',style:'lagoon',layout:'hamlet',padW:50,padD:42},
 {name:'Station des Neiges',x:380,z:-520,color:'#8a9cff',biome:'snow',style:'observatory',layout:'hamlet',padW:50,padD:42},
 {name:'Fort du Canyon',x:580,z:680,color:'#c4673a',biome:'desert',style:'desert',layout:'hamlet',padW:50,padD:42}
];
/* v94 : les lieux de la carte de référence (noms originaux). Les huit premiers gardent les styles
 * des index 0 à 7 (cosmétiques, progression, entraînement). */
var regions=MAPD?[
 {name:'Entrepôts du Centre',x:140,z:-92,color:'#f27865',biome:'grass',style:'port',mix:'depot',padW:66,padD:58},
 {name:'Bourg Plaisance',x:-353,z:-356,color:'#44a882',biome:'grass',style:'forest',mix:'suburb',padW:72,padD:66},
 {name:'Palmes Dorées',x:509,z:365,color:'#e7b84d',biome:'desert',style:'desert',mix:'palms',padW:76,padD:66},
 {name:'Citadelle Azur',x:-270,z:-20,color:'#4d91d4',biome:'grass',style:'citadel',padW:88,padD:82},
 {name:'Pic Polaire',x:-400,z:330,color:'#9fd8ff',biome:'snow',style:'cliff',layout:'hamlet',peak:true,padW:50,padD:42},
 {name:'Rivage Chic',x:-600,z:-55,color:'#27b9b1',biome:'grass',style:'lagoon',layout:'hamlet',mix:'villa',padW:50,padD:42},
 {name:'Champs du Fermier',x:169,z:414,color:'#c77a52',biome:'grass',style:'farm',padW:64,padD:54},
 {name:'Centrale du Volcan',x:411,z:-344,color:'#b36ac8',biome:'grass',style:'observatory',layout:'hamlet',crater:true,padW:50,padD:42},
 {name:'Méga Galerie',x:450,z:57,color:'#44a882',biome:'grass',style:'forest',mix:'mall',padW:72,padD:66},
 {name:'Sources Poivrées',x:127,z:178,color:'#44a882',biome:'grass',style:'forest',mix:'suburb',padW:72,padD:66},
 {name:'Casse du Nord',x:-450,z:-605,color:'#f27865',biome:'grass',style:'port',layout:'hamlet',mix:'depot',padW:50,padD:42},
 {name:'Collines Hantées',x:-520,z:-445,color:'#44a882',biome:'grass',style:'forest',layout:'hamlet',mix:'haunted',padW:50,padD:42},
 {name:'Le Bloc',x:-202,z:-525,color:'#b36ac8',biome:'grass',style:'observatory',layout:'hamlet',mix:'block',padW:50,padD:42},
 {name:'Anse Corsaire',x:250,z:-405,color:'#f27865',biome:'grass',style:'port',layout:'hamlet',mix:'harbor',padW:50,padD:42},
 {name:'Marches du Soleil',x:546,z:-458,color:'#27b9b1',biome:'grass',style:'lagoon',layout:'hamlet',mix:'sunny',padW:50,padD:42},
 {name:'Chalet Solitaire',x:620,z:-101,color:'#44a882',biome:'grass',style:'forest',layout:'hamlet',mix:'cabin',padW:50,padD:42},
 {name:'Mines du Givre',x:-222,z:203,color:'#9fd8ff',biome:'snow',style:'cliff',layout:'hamlet',padW:50,padD:42},
 {name:'Base Aérienne du Givre',x:-545,z:385,color:'#b36ac8',biome:'snow',style:'observatory',layout:'hamlet',padW:50,padD:42},
 {name:'Chalets Joyeux',x:-281,z:556,color:'#9fd8ff',biome:'snow',style:'cliff',layout:'hamlet',padW:50,padD:42},
 {name:'Pagode Lotus',x:135,z:623,color:'#27b9b1',biome:'grass',style:'lagoon',layout:'hamlet',mix:'pagoda',padW:50,padD:42},
 {name:'Fort du Canyon',x:330,z:520,color:'#e7b84d',biome:'desert',style:'desert',layout:'hamlet',padW:50,padD:42}
]:regionsV68;
var streets=[];
/* Each district grid has road lanes between every house row/column.  Keeping
 * this data separate from render geometry makes minimaps and decorations agree
 * with the authoritative house layout. */
function makeDistrictStreets(r,cols,rows,sx,sz){
 var firstX=r.x-(cols-1)*sx/2,lastX=r.x+(cols-1)*sx/2,firstZ=r.z-(rows-1)*sz/2,lastZ=r.z+(rows-1)*sz/2;
 var left=firstX-sx/2,right=lastX+sx/2,top=firstZ-sz/2,bottom=lastZ+sz/2;
 for(var c=0;c<=cols;c++){var xx=left+c*sx;streets.push([{x:xx,z:top},{x:xx,z:bottom}]);}
 for(var row=0;row<=rows;row++){var zz=top+row*sz;streets.push([{x:left,z:zz},{x:right,z:zz}]);}
}
/* Polylines are deliberately data, not colliders: the renderer can draw roads cheaply. */
var roadsV68=[
 [{x:-416.5,z:350},{x:-440,z:200},{x:-200,z:110},{x:-61,z:20}],
 [{x:-390,z:-225},{x:-430,z:-140},{x:-185,z:-70},{x:-61,z:-56}],
 [{x:115,z:303},{x:150,z:230},{x:100,z:102},{x:91,z:20}],
 [{x:91,z:20},{x:150,z:0},{x:238,z:-35},{x:238,z:-100},{x:450,z:-100},{x:450,z:-360},{x:365,z:-360}],
 [{x:115,z:303},{x:230,z:280},{x:333,z:185}],
 [{x:-61,z:20},{x:-160,z:-150},{x:-160,z:-437.5},{x:-132.5,z:-437.5}],
 /* Connect to grid edges via open countryside; never cut across a house row. */
 [{x:-407.5,z:-420},{x:-455,z:-345},{x:-390,z:-272.5}],
 [{x:-390,z:40},{x:-440,z:80},{x:-440,z:200}],
 [{x:-55,z:257.5},{x:-5,z:235},{x:55,z:265},{x:55,z:302.5}],
 [{x:88,z:-300},{x:10,z:-300},{x:-27.5,z:-342.5}],
 [{x:202,z:-300},{x:250,z:-245},{x:285,z:-230},{x:308,z:-270}],
 [{x:-160,z:-437.5},{x:-220,z:-420},{x:-285,z:-420},{x:-285,z:-360}],
 [{x:450,z:-100},{x:480,z:-75},{x:480,z:20}],
 [{x:230,z:280},{x:230,z:340},{x:350,z:360},{x:350,z:430}],
 [{x:-132.5,z:-437.5},{x:50,z:-500},{x:207,z:-500},{x:207,z:-430}],
 /* Three new urban links extend the 1.8 road network without changing its
  * combat, inventory, construction or control systems. */
 [{x:-440,z:200},{x:-430,z:155}],
 [{x:-61,z:-56},{x:-5,z:-160},{x:-5,z:-235}],
 [{x:450,z:-100},{x:430,z:-145}]
];
var roads=MAPD?[]:roadsV68;
/* v94 : réseau routier de l'île de référence. Arbre couvrant de longueur minimale entre les villes
 * (plus un second lien pour les villes isolées), routes courbes qui évitent la mer, le lac, le cratère
 * du volcan et les autres villes ; un gué là où une route franchit la rivière. */
function genRoadsS8(){
 var nodes=regions.map(function(r){var g=districtGrid[r.layout||r.style],n=districtDensity[r.layout||r.style],rows=Math.ceil(n/g.cols);return {r:r,x:r.x,z:r.z,hw:g.cols*g.sx/2,hd:rows*g.sz/2};});
 nodes.push({r:null,x:LAUNCH_SITE.x,z:LAUNCH_SITE.z,hw:LAUNCH_SITE.r,hd:LAUNCH_SITE.r});
 function exitPt(a,tx,tz){var dx=tx-a.x,dz=tz-a.z;if(Math.abs(dx)/a.hw>Math.abs(dz)/a.hd)return {x:a.x+(dx>0?a.hw:-a.hw),z:a.z+clamp(dz/Math.max(1,Math.abs(dx))*a.hw,-a.hd*.6,a.hd*.6)};return {x:a.x+clamp(dx/Math.max(1,Math.abs(dz))*a.hd,-a.hw*.6,a.hw*.6),z:a.z+(dz>0?a.hd:-a.hd)};}
 function okPt(x,z,a,b){if(coastDistance(x,z)>MAP.shoreStart-14)return false;if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.3)return false;var vr=Math.hypot(x-VOLCANO.x,z-VOLCANO.z);if(vr<VOLCANO.crater*1.15&&!((a.r&&a.r.crater)||(b.r&&b.r.crater)))return false;if(Math.hypot(x-METEOR_SITE.x,z-METEOR_SITE.z)<METEOR_SITE.r+8)return false;
  for(var i=0;i<nodes.length;i++){var q=nodes[i];if(q===a||q===b)continue;if(Math.abs(x-q.x)<q.hw+6&&Math.abs(z-q.z)<q.hd+6)return false;}return true;}
 function curve(p0,c,p1){var pts=[];for(var k=0;k<=6;k++){var t=k/6,u=1-t;pts.push({x:u*u*p0.x+2*u*t*c.x+t*t*p1.x,z:u*u*p0.z+2*u*t*c.z+t*t*p1.z});}return pts;}
 function tryPath(a,b){var p0=exitPt(a,b.x,b.z),p1=exitPt(b,a.x,a.z),dx=p1.x-p0.x,dz=p1.z-p0.z,L=Math.hypot(dx,dz)||1,offs=[0,.18,-.18,.32,-.32];
  for(var o=0;o<offs.length;o++){var c={x:(p0.x+p1.x)/2-dz/L*offs[o]*L,z:(p0.z+p1.z)/2+dx/L*offs[o]*L},pts=curve(p0,c,p1),good=true;
   for(var k=1;k<pts.length&&good;k++){var s0=pts[k-1],s1=pts[k],n=Math.max(1,Math.ceil(Math.hypot(s1.x-s0.x,s1.z-s0.z)/10));for(var j=0;j<=n;j++){var t=j/n;if(!okPt(s0.x+(s1.x-s0.x)*t,s0.z+(s1.z-s0.z)*t,a,b)){good=false;break;}}}
   if(good)return pts;}return null;}
 var cand=[];for(var i=0;i<nodes.length;i++)for(var j=i+1;j<nodes.length;j++){var d=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);if(d<560)cand.push({i:i,j:j,d:d});}
 cand.sort(function(p,q){return p.d-q.d;});
 var par=nodes.map(function(_,k){return k;}),deg=nodes.map(function(){return 0;}),linked={};
 function find(k){while(par[k]!==k)k=par[k]=par[par[k]];return k;}
 function add(e,pts){roads.push(pts);deg[e.i]++;deg[e.j]++;linked[e.i+','+e.j]=true;}
 for(var c=0;c<cand.length;c++){var e=cand[c],ri=find(e.i),rj=find(e.j);if(ri===rj)continue;var pts=tryPath(nodes[e.i],nodes[e.j]);if(!pts)continue;par[ri]=rj;add(e,pts);}
 for(c=0;c<cand.length;c++){e=cand[c];if(linked[e.i+','+e.j]||e.d>430||(deg[e.i]>=2&&deg[e.j]>=2))continue;pts=tryPath(nodes[e.i],nodes[e.j]);if(pts)add(e,pts);}
 // gués : intersections des routes et de la rivière
 for(var ri2=0;ri2<roads.length;ri2++)for(var k=1;k<roads[ri2].length;k++){var A=roads[ri2][k-1],B=roads[ri2][k];for(var m=1;m<RIVER.length;m++){var C=RIVER[m-1],D2=RIVER[m],den=(B.x-A.x)*(D2.z-C.z)-(B.z-A.z)*(D2.x-C.x);if(Math.abs(den)<1e-9)continue;var t1=((C.x-A.x)*(D2.z-C.z)-(C.z-A.z)*(D2.x-C.x))/den,t2=((C.x-A.x)*(B.z-A.z)-(C.z-A.z)*(B.x-A.x))/den;if(t1>=0&&t1<=1&&t2>=0&&t2<=1)FORDS.push({x:A.x+(B.x-A.x)*t1,z:A.z+(B.z-A.z)*t1});}}
}
/* Layout parameters are data too: map generation and street lines use exactly
 * the same lattice, leaving clear roads between non-overlapping houses. */
var districtDensity={hamlet:12,port:42,citadel:48,forest:30,desert:30,cliff:26,lagoon:26,farm:25,observatory:27};
var districtGrid={hamlet:{cols:4,sx:19,sz:18},port:{cols:7,sx:19,sz:19},citadel:{cols:8,sx:19,sz:19},forest:{cols:6,sx:20,sz:19},desert:{cols:6,sx:20,sz:19},cliff:{cols:6,sx:19,sz:18},lagoon:{cols:6,sx:19,sz:18},farm:{cols:5,sx:21,sz:19},observatory:{cols:6,sx:19,sz:18}};
for(var _si=0;_si<regions.length;_si++){var _sr=regions[_si],_sg=districtGrid[_sr.layout||_sr.style],_sn=districtDensity[_sr.layout||_sr.style],_srows=Math.ceil(_sn/_sg.cols);makeDistrictStreets(_sr,_sg.cols,_srows,_sg.sx,_sg.sz);}
if(MAPD)genRoadsS8();
/* v71 : chaque hameau est relié au réseau existant par une route de campagne. */
if(!MAPD)(function(){var base=roads.slice();for(var hi=0;hi<regions.length;hi++){var hr=regions[hi];if(hr.layout!=='hamlet')continue;
 var best=null;for(var ri=0;ri<base.length;ri++)for(var rj=1;rj<base[ri].length;rj++){var a=base[ri][rj-1],b=base[ri][rj],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((hr.x-a.x)*dx+(hr.z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+dx*t,pz=a.z+dz*t,dd=Math.hypot(hr.x-px,hr.z-pz);if(!best||dd<best.d)best={x:px,z:pz,d:dd};}
 if(!best)continue;var g=districtGrid.hamlet,rows=Math.ceil(districtDensity.hamlet/g.cols),hw=g.cols*g.sx/2,hd=rows*g.sz/2;
 var ex=clamp(best.x,hr.x-hw,hr.x+hw),ez=clamp(best.z,hr.z-hd,hr.z+hd);if(Math.abs(best.x-hr.x)/hw>Math.abs(best.z-hr.z)/hd)ex=hr.x+(best.x>hr.x?hw:-hw);else ez=hr.z+(best.z>hr.z?hd:-hd);
 roads.push([{x:ex,z:ez},{x:(ex+best.x)/2+(best.z-ez)*.12,z:(ez+best.z)/2-(best.x-ex)*.12},{x:best.x,z:best.z}]);}})();
function routeDistance(x,z,a,b){var dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);}
function nearRoute(x,z,margin){var all=roads.concat(streets);for(var ri=0;ri<all.length;ri++)for(var rj=1;rj<all[ri].length;rj++)if(routeDistance(x,z,all[ri][rj-1],all[ri][rj])<margin)return true;return false;}
/* v93 : distance aux routes précalculée sur une grille de 4 m (bornée à 24 m).
 * Sert au placement de la flore et des maisons sans reparcourir chaque segment. */
var ROUTE_CELL=4,ROUTE_N=Math.ceil(MAP.halfSize*2/ROUTE_CELL),routeGrid=null;
function routeDist(x,z){
 if(!routeGrid){routeGrid=new Uint8Array(ROUTE_N*ROUTE_N);routeGrid.fill(24);var all=roads.concat(streets);
  for(var ri=0;ri<all.length;ri++)for(var rj=1;rj<all[ri].length;rj++){var a=all[ri][rj-1],b=all[ri][rj],x0=Math.floor((Math.min(a.x,b.x)-24+MAP.halfSize)/ROUTE_CELL),x1=Math.floor((Math.max(a.x,b.x)+24+MAP.halfSize)/ROUTE_CELL),z0=Math.floor((Math.min(a.z,b.z)-24+MAP.halfSize)/ROUTE_CELL),z1=Math.floor((Math.max(a.z,b.z)+24+MAP.halfSize)/ROUTE_CELL);
   for(var gx=Math.max(0,x0);gx<=Math.min(ROUTE_N-1,x1);gx++)for(var gz=Math.max(0,z0);gz<=Math.min(ROUTE_N-1,z1);gz++){var d=routeDistance((gx+.5)*ROUTE_CELL-MAP.halfSize,(gz+.5)*ROUTE_CELL-MAP.halfSize,a,b);if(d<routeGrid[gz*ROUTE_N+gx])routeGrid[gz*ROUTE_N+gx]=Math.floor(d);}}}
 var ix=Math.floor((x+MAP.halfSize)/ROUTE_CELL),iz=Math.floor((z+MAP.halfSize)/ROUTE_CELL);if(ix<0||iz<0||ix>=ROUTE_N||iz>=ROUTE_N)return 24;return routeGrid[iz*ROUTE_N+ix];
}
function townPad(x,z,margin){for(var i=0;i<regions.length;i++){var r=regions[i];if(Math.abs(x-r.x)<(r.padW||40)+margin&&Math.abs(z-r.z)<(r.padD||40)+margin)return r;}return null;}
/* Champ de forêt (-2..2) : les massifs boisés de l'île, partagé avec le rendu. */
function forestField(x,z){if(MAPD)return mapSample(MAPD.forest,x,z)/255*3.4-1.3+.25*Math.sin(x*.05)*Math.cos(z*.047);return Math.sin(x*.0113+1.7)*Math.cos(z*.0127-.4)+Math.sin((x*.6-z)*.0071+2.1)*.8+Math.sin((x+z*.7)*.0231)*.35;}
function RNG(seed){ this.s=(seed>>>0)||123456789; }
RNG.prototype.next=function(){ var t=this.s+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
RNG.prototype.range=function(a,b){ return a+(b-a)*this.next(); };
RNG.prototype.int=function(n){ return Math.floor(this.next()*n); };
function noise(x,z){ return Math.sin(x*.009+z*.006)*13+Math.cos(z*.014-x*.004)*9+Math.sin((x+z)*.026)*4; }
function lobeWeight(i,x,z){var L=LOBES[i];return 1-smoothRangeRaw(.5,1.05,Math.hypot(x-L.x,z-L.z)/L.r);}
function smoothRangeRaw(a,b,v){var t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);}
/* Poids des zones (0..1) : sert au relief, aux couleurs et aux décors. */
function zoneWeights(x,z){
 if(MAPD){var land0=1-smoothRangeRaw(MAP.shoreEnd,MAP.shoreEnd+60,coastDistance(x,z)),vr0=Math.hypot(x-VOLCANO.x,z-VOLCANO.z);
  return {volcano:(1-smoothRangeRaw(VOLCANO.crater*.85,VOLCANO.crater*1.45,vr0))*land0,snow:mapSample(MAPD.snow,x,z)/255*land0,jungle:0,desert:mapSample(MAPD.desert,x,z)/255*land0,meadow:0,lava:mapSample(MAPD.lava,x,z)/255*land0};}
 /* Frontières ondulées : les zones se fondent les unes dans les autres. */
 var wx=x+38*Math.sin(z*.012+1.3)+18*Math.sin(z*.031),wz=z+38*Math.sin(x*.011-.7)+16*Math.sin(x*.029);
 var oldSnow=smoothRangeRaw(215,295,wx)*(1-smoothRangeRaw(-150,-50,wz)),oldDesert=smoothRangeRaw(-80,0,wx)*smoothRangeRaw(215,305,wz);
 var band=(1-smoothRangeRaw(-570,-460,wx))*smoothRangeRaw(-80,30,wz)*(1-smoothRangeRaw(450,570,wz));
 /* Hors de l'île (mer, île d'attente), aucune zone : plus de neige sur l'île de départ. */
 var land=1-smoothRangeRaw(MAP.shoreEnd,MAP.shoreEnd+60,coastDistance(x,z));
 return {volcano:lobeWeight(0,x,z)*land,snow:Math.max(lobeWeight(1,x,z),oldSnow)*land,jungle:Math.max(lobeWeight(2,x,z),band)*land,desert:Math.max(lobeWeight(3,x,z),oldDesert)*land,meadow:lobeWeight(4,x,z)*land};
}
function zoneAt(x,z){
 var d=coastDistance(x,z);if(d>=MAP.shoreEnd)return 'water';if(d>=MAP.shoreStart)return 'beach';
 var w=zoneWeights(x,z),best='grass',bw=.5;for(var k in w)if(w[k]>bw){bw=w[k];best=k;}return best;
}
function biomeAt(x,z){
 var d=coastDistance(x,z); if(d>=MAP.shoreEnd)return 'water';
 if(d>=MAP.shoreStart)return 'sand';
 var zn=zoneAt(x,z);
 if(zn==='snow'||zn==='desert'||zn==='volcano')return zn;
 if(zn==='lava')return 'volcano';
 return 'grass';
}
function smoothRange(a,b,v){var t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
function rawHeight(x,z){
 if(MAPD)return rawHeightS8(x,z);
 var d=coastDistance(x,z), land=12+noise(x,z), w=zoneWeights(x,z);
 /* Pics enneigés : l'ancienne crête du nord-est et la nouvelle péninsule. */
 var ridge=Math.abs(Math.sin(x*.021+Math.sin(z*.017)*1.6))*.6+Math.abs(Math.sin(z*.026-x*.009))*.4;
 land+=w.snow*(35+Math.max(0,(x-280-z*.18)/26)+lobeWeight(1,x,z)*(40+ridge*70));
 /* Canyon désertique : dunes basses et mésas à sommet plat. */
 var mesa=smoothRange(.58,.66,(Math.sin(x*.031)*Math.cos(z*.027)+1)*.5)*lobeWeight(3,x,z)*26;
 land=land*(1-w.desert)+(8+noise(x,z)*.38+mesa)*w.desert;
 /* Jungle : collines douces et un peu plus hautes, coupées de ravines. */
 land+=w.jungle*(6+Math.sin(x*.05)*Math.cos(z*.043)*5);
 /* Volcan : un cône qui monte à 175 m, cratère de lave au sommet. */
 var vr=Math.hypot(x-VOLCANO.x,z-VOLCANO.z),cone=Math.pow(Math.max(0,1-vr/VOLCANO.r),1.3)*VOLCANO.h;
 if(vr<VOLCANO.crater)cone-=Math.pow(1-vr/VOLCANO.crater,1.6)*48;
 land=land*(1-w.volcano*.6)+cone*Math.max(w.volcano,smoothRange(VOLCANO.r,VOLCANO.r*.7,vr));
 land+=Math.max(0,1-Math.hypot(x-80,z-30)/330)*25;
 var lr=Math.hypot(x-LAKE.x,z-LAKE.z),lq=lr/LAKE.r;
 if(lq<1.75){var lakeH=SEA-3.6+7*smoothRange(.55,1.3,lq),isle=lr<LAKE.isle*1.6?SEA+2.2-smoothRange(LAKE.isle*.8,LAKE.isle*1.6,lr)*5.5:-99;
  lakeH=Math.max(lakeH,isle);land=land+(Math.min(land,lakeH)-land)*(1-smoothRange(1.3,1.75,lq));}
 if(d<=MAP.shoreStart)return land;
 if(d>=MAP.shoreEnd)return SEA-3-Math.min(30,(d-MAP.shoreEnd)*.04);
 var t=(d-MAP.shoreStart)/(MAP.shoreEnd-MAP.shoreStart);t=t*t*(3-2*t);return land*(1-t)+(SEA-3)*t;
}
function rawHeightS8(x,z){
 var d=coastDistance(x,z),w=zoneWeights(x,z),land=12+noise(x,z)*.5,ff=mapSample(MAPD.forest,x,z)/255;
 /* l'intérieur des terres ne descend jamais sous la mer (seuls le lac et la rivière y descendent) */
 if(land<5)land=5-(5-land)*.15;
 /* collines boisées, plus hautes au nord-ouest (Collines Hantées, Bourg Plaisance) */
 land+=ff*(4+5*Math.sin(x*.027+.4)*Math.cos(z*.024));
 land+=Math.max(0,1-Math.hypot(x+480,z+450)/340)*15*(.65+.35*Math.sin(x*.021)*Math.sin(z*.019));
 /* neige : relief accidenté et le Pic Polaire */
 var ridge=Math.abs(Math.sin(x*.021+Math.sin(z*.017)*1.6))*.6+Math.abs(Math.sin(z*.026-x*.009))*.4;
 land+=w.snow*(8+ridge*26);
 var pp=Math.hypot(x-PEAK.x,z-PEAK.z);land+=Math.pow(Math.max(0,1-pp/PEAK.r),1.5)*PEAK.h*Math.max(.35,w.snow);
 /* désert : dunes basses et mésas à sommet plat */
 var mesa=smoothRange(.58,.66,(Math.sin(x*.031)*Math.cos(z*.027)+1)*.5)*22;
 land=land*(1-w.desert)+(7+noise(x,z)*.35+mesa)*w.desert;
 /* volcan : cône, cratère au fond plat où se trouve la centrale */
 var vr=Math.hypot(x-VOLCANO.x,z-VOLCANO.z);
 if(vr<VOLCANO.r){var hc=VOLCANO.h*Math.pow(1-VOLCANO.crater/VOLCANO.r,1.25),cone=vr>VOLCANO.crater?VOLCANO.h*Math.pow(1-vr/VOLCANO.r,1.25):hc-22*(1-smoothRange(VOLCANO.crater*.6,VOLCANO.crater,vr));land=land*(1-smoothRange(VOLCANO.r,VOLCANO.r*.55,vr)*.55)+cone;}
 /* coulée de lave : lit légèrement creusé */
 land-=w.lava*1.8;
 /* colline du point de vue de l'événement, au sud de la base de lancement */
 var sp=Math.hypot(x-SPOT_S8.px,z-SPOT_S8.pz);if(sp<80)land+=Math.pow(1-sp/80,2)*11;
 /* cratère de la météorite */
 var mr=Math.hypot(x-METEOR_SITE.x,z-METEOR_SITE.z);if(mr<METEOR_SITE.r*2){land+=Math.exp(-Math.pow((mr-METEOR_SITE.r)/7,2))*2.4-Math.pow(Math.max(0,1-mr/METEOR_SITE.r),1.6)*6;}
 /* base de lancement : plate-forme plane */
 var lr0=Math.hypot(x-LAUNCH_SITE.x,z-LAUNCH_SITE.z);if(lr0<LAUNCH_SITE.r+30){var tl=smoothRange(LAUNCH_SITE.r,LAUNCH_SITE.r+30,lr0);land=LAUNCH_SITE.h*(1-tl)+land*tl;}
 /* Loot Lake et son îlot */
 var lr=Math.hypot(x-LAKE.x,z-LAKE.z),lq=lr/LAKE.r;
 if(lq<1.75){var lakeH=SEA-3.6+7*smoothRange(.55,1.3,lq),isle=lr<LAKE.isle*1.6?SEA+2.2-smoothRange(LAKE.isle*.8,LAKE.isle*1.6,lr)*5.5:-99;
  lakeH=Math.max(lakeH,isle);land=land+(Math.min(land,lakeH)-land)*(1-smoothRange(1.3,1.75,lq));}
 /* rivière, avec un gué à chaque route */
 var rd=riverDist(x,z);if(rd<26){var bed=riverFord(x,z)?SEA+.55:SEA-2.4;land=land+(Math.min(land,bed)-land)*(1-smoothRange(9,26,rd));}
 if(d<=MAP.shoreStart)return land;
 if(d>=MAP.shoreEnd)return SEA-3-Math.min(30,(d-MAP.shoreEnd)*.04);
 var t=(d-MAP.shoreStart)/(MAP.shoreEnd-MAP.shoreStart);t=t*t*(3-2*t);return land*(1-t)+(SEA-3)*t;
}
function heightAt(x,z){
 var wx=MAP.waiting.x,wz=MAP.waiting.z;
 if((x-wx)*(x-wx)+(z-wz)*(z-wz)<10000)return 5+noise(x,z)*.06;
 var h=rawHeight(x,z);
 for(var i=0;i<regions.length;i++){var r=regions[i],dx=Math.abs(x-r.x),dz=Math.abs(z-r.z),hw=r.padW||76,hd=r.padD||42;if(dx<hw+28&&dz<hd+28){/* Full street lattice stays flat; feather into countryside outside the pad, not through the outer carriageway. */var t=smoothRange(0,28,Math.max(0,dx-hw,dz-hd));return Math.max(3,rawHeight(r.x,r.z))*(1-t)+h*t;}}
 return h;
}
/* The outer part of the smooth beach is shallow water even before its bed reaches -2. */
function isWater(x,z){ if(coastDistance(x,z)>=MAP.shoreEnd)return true; if(MAPD&&riverDist(x,z)<10&&!riverFord(x,z))return rawHeight(x,z)<SEA-.35; return Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.1&&rawHeight(x,z)<SEA-.35; }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function normAng(a){ while(a>Math.PI)a-=TAU; while(a<-Math.PI)a+=TAU; return a; }
function finite(v){ return typeof v==='number'&&isFinite(v); }
function forward(y,p){ return {x:-Math.sin(y)*Math.cos(p),y:Math.sin(p),z:-Math.cos(y)*Math.cos(p)}; }
/* Keep the simulation eye point in lockstep with the third-person posture.  The
 * old fixed 1.4m origin made crouched shots/LOS appear to pass over cover. */
function eyeHeight(p){ return p.crouching?1.05:1.4; }
function dist2(a,b){ var x=a.x-b.x,z=a.z-b.z; return x*x+z*z; }
function uid(w,p){ return p+(++w._ids); }
/* Midas : une arme tenue par Midas devient dorée et le reste une fois posée. */
function goldOf(p,it){return !!(it&&it.gold)||!!(p&&p.equipment&&p.equipment.character==='char-midas');}
function makeInv(key,rarity){
 var q=weapons[key], r=clamp(rarity|0,0,4);
 return {kind:'weapon',weapon:key,rarity:r,ammo:q.clip,reserve:q.reserve,id:key+'-'+r,_damage:q.damage*rarities[r].multiplier};
}
function local(o,x,z){ var c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0),dx=x-o.x,dz=z-o.z; return {x:dx*c-dz*s,z:dx*s+dz*c}; }
function worldPoint(o,x,z){ var c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0); return {x:o.x+x*c+z*s,z:o.z-x*s+z*c}; }
function inRect(x,z,cx,cz,hw,hd,pad){ return Math.abs(x-cx)<=hw+pad&&Math.abs(z-cz)<=hd+pad; }
function rayBox(ox,oy,oz,dx,dy,dz,cx,cy,cz,hx,hy,hz,max){
 /* Hot path: the same slab test as before, but without per-call arrays. */
 var t0=0,t1=max,t,u,w;
 if(Math.abs(dx)<1e-8){if(ox<cx-hx||ox>cx+hx)return null;}
 else{t=(cx-hx-ox)/dx;u=(cx+hx-ox)/dx;if(t>u){w=t;t=u;u=w;}if(t>t0)t0=t;if(u<t1)t1=u;if(t0>t1)return null;}
 if(Math.abs(dy)<1e-8){if(oy<cy-hy||oy>cy+hy)return null;}
 else{t=(cy-hy-oy)/dy;u=(cy+hy-oy)/dy;if(t>u){w=t;t=u;u=w;}if(t>t0)t0=t;if(u<t1)t1=u;if(t0>t1)return null;}
 if(Math.abs(dz)<1e-8){if(oz<cz-hz||oz>cz+hz)return null;}
 else{t=(cz-hz-oz)/dz;u=(cz+hz-oz)/dz;if(t>u){w=t;t=u;u=w;}if(t>t0)t0=t;if(u<t1)t1=u;if(t0>t1)return null;}
 return t0>=0&&t0<=max?t0:null;
}
function rayLocalBox(o,ox,oy,oz,d,box,max){
 var a=local(o,ox,oz), c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0);
 var dx=d.x*c-d.z*s,dz=d.x*s+d.z*c;
 return rayBox(a.x,oy,a.z,dx,d.y,dz,box.x,box.y,box.z,box.w,box.h,box.d,max);
}
function player(w,id,name,bot,team,equipment){
 return {id:id,name:name||id,bot:!!bot,team:team,x:MAP.waiting.x+w.rng.range(-55,55),y:heightAt(MAP.waiting.x,MAP.waiting.z),z:MAP.waiting.z+w.rng.range(-55,55),yaw:0,pitch:0,hp:100,shield:0,alive:true,downed:false,downTimer:0,reviveProgress:0,revivingId:null,revives:0,timesRevived:0,grounded:true,gliding:false,falling:false,swimming:false,crouching:false,fishing:0,deployed:false,airborneFromBus:false,autoGlider:false,jumping:false,vehicleId:null,inventory:[],selected:0,mats:{wood:0,stone:0,metal:0},kills:0,damage:0,weaponDamage:{},distance:0,chests:0,gathered:0,built:0,regions:[],reload:0,useTime:0,emote:0,emoteDuration:6,emoteStyle:'salut',aim:false,equipment:equipment||{character:'char-ambre',glider:'glider-azur',tool:'tool-coral',back:'',variant:''},result:null,_input:{},_edge:[],_cool:0,_vx:0,_vz:0,_coyote:0,_jumpBuffer:0,_recoil:0,_burstLeft:0,_burstTimer:0,_botBurstPause:0,_ai:0,_aiTarget:null,_aiGoal:null,_aiStrafe:1,_aiLastThink:-1,_aiLastSeen:-Infinity,_aiLastDamage:-Infinity,_aiLastX:MAP.waiting.x,_aiLastZ:MAP.waiting.z,_combatAt:-Infinity,_lastShot:-Infinity,_rosterIndex:null,flying:false,_vy:0,_useId:null,_useX:0,_useZ:0,_lastShotAt:-Infinity,_harvestCool:0,_consumeFireHeld:false};
}
function nearestRegion(x,z){ var q=0,bd=Infinity; for(var i=0;i<regions.length;i++){var dx=x-regions[i].x,dz=z-regions[i].z,d=dx*dx+dz*dz;if(d<bd){bd=d;q=i;}} return q; }
function World(opts){
 opts=opts||{}; this.eventVariant=opts.mode==='eventflight'?'flight':'crash'; this.mode=opts.mode==='eventflight'?'event':opts.mode||'solo'; this.seed=opts.seed==null?123:opts.seed; this.rng=new RNG(this.seed); this._transportTime=0;
 this.phase=(this.mode==='training'||this.mode==='creative')?'active':'waiting'; this.phaseTime=0; this.elapsed=0; this.tick=0;
 this.players=[];this.objects=[];this.loot=[];this.builds=[];this.vehicles=[];this.events=[];
 this.storm={x:0,z:0,radius:Math.ceil(MAP.shoreEnd*Math.SQRT2),nextX:0,nextZ:0,nextRadius:MAP.halfSize,phase:0,timer:75,damage:1};
 this.aircraft={x:MAP.transport.startX,y:MAP.transport.altitude,z:MAP.transport.startZ,yaw:-1.07};this.results={};this._ids=0;this._event=0;this._stormState='wait';this._stormDuration=50;this._stormFrom=this.storm.radius;this._matchId='match-'+this.seed;this.trainingItems=this.mode==='training'?this._trainingCatalog():[];this._finishedAt=null;
 /* v54 : Point Zéro en VRAIE PARTIE (pas en event) — détruit parfois des
  * bâtiments ou fissure le sol. */
 /* v93 : retiré de la bataille royale « Chapitre 1 » (l'île n'a plus de Point
  * Zéro) ; le mode événement garde son propre spectacle. */
 this.zeroPoint=null;
 this._createMap();
 /* A BR always has exactly 100 total roster slots. addHuman replaces an IA slot,
  * so private/local participants never make the match exceed its ruleset. */
 var n=(this.mode==='creative')?1:this.mode==='training'?12:MATCH_PARTICIPANTS,size=this.mode==='duo'?2:this.mode==='squad'?4:1,pOpt=opts.player||{};
 for(var i=0;i<n;i++){var human=i===0,p=player(this,human?(pOpt.id||'p0'):'bot-'+i,human?(pOpt.name||'Pilote'):'IA '+String(i).padStart(2,'0'),!human,Math.floor(i/size),human?pOpt.equipment:null);p._rosterIndex=i;var a=this.rng.next()*TAU,d=Math.sqrt(this.rng.next())*58;p.x=MAP.waiting.x+Math.cos(a)*d;p.z=MAP.waiting.z+Math.sin(a)*d;p.y=heightAt(p.x,p.z);p._lastX=p.x;p._lastZ=p.z;this.players.push(p);}
 this.players[0].bot=false;
 /* Battle-royale starts are intentionally empty: weapons/materials come from
  * the island.  This also applies to bots and to the transport transition. */
 if(this.mode!=='training'&&this.mode!=='creative')for(i=0;i<this.players.length;i++){/* BR inventories stay empty until equipment is picked up on the warm-up island. */this.players[i]._jumpAt=2+(i/Math.max(1,this.players.length-1))*33+this.rng.range(-.45,.45);}
 if(this.mode==='training'){
  var h=this.players[0];h.x=regions[3].x;h.z=regions[3].z+regions[3].padD+8;h.y=heightAt(h.x,h.z);h.deployed=true;h.inventory=[makeInv('rifle',2),makeInv('shotgun',1),makeInv('sniper',2),{kind:'heal',count:3,id:'heal-start'},{kind:'shield',count:3,id:'shield-start'}];h.mats={wood:1000,stone:1000,metal:1000};
  for(i=1;i<this.players.length;i++)this._spawnActive(this.players[i]);
  this._createTrainingRange();
 }
 /* Mode event : même flux que le BR (salon 10 s -> bus 38 s -> saut),
  * pas de spectateur pré-déployé. Tempête et fin de partie déjà désactivées. */
 if(this.mode==='creative'){
  var c=this.players[0];c.x=80;c.z=30;c.y=heightAt(c.x,c.z);c.deployed=true;c.inventory=[makeInv('rifle',4),makeInv('shotgun',4),makeInv('sniper',4),makeInv('launcher',4),{kind:'heal',count:99,id:'creative-heal'}];c.mats={wood:999999,stone:999999,metal:999999};
 }
}
World.prototype._emit=function(type,x,y,z,more){ var e={id:++this._event,type:type,x:x||0,y:y||0,z:z||0};if(more)for(var k in more)e[k]=more[k];this.events.push(e);if(this.events.length>100)this.events.shift();return e; };
World.prototype._object=function(type,x,z,w,h,material,yaw){
 var hp=type==='tree'?85:type==='rock'?150:type==='house'?420:type==='container'||type==='silo'?220:120;
 var o={id:uid(this,'o'),type:type,x:x,y:heightAt(x,z),z:z,w:w||2,h:h||3,d:w||2,yaw:yaw||0,hp:hp,maxHp:hp,material:material||(type==='rock'?'stone':type==='container'||type==='silo'?'metal':'wood'),opened:false,dead:false,windows:type==='house',region:nearestRegion(x,z),seed:this.rng.int(99999)};this.objects.push(o);return o;
};
World.prototype._dropLoot=function(x,y,z,chest){
 var ks=['pistol','revolver','rifle','burst','shotgun','tactical','smg','sniper','dmr','launcher'],k=ks[this.rng.int(ks.length)],r=this.rng.int(5);
 this.loot.push({id:uid(this,'l'),kind:'weapon',weapon:k,rarity:r,ammo:weapons[k].clip,reserve:weapons[k].reserve,count:0,x:x+this.rng.range(-1,1),y:y,z:z+this.rng.range(-1,1),dead:false});
 this.loot.push({id:uid(this,'l'),kind:this.rng.next()<.5?'heal':'shield',rarity:0,ammo:0,reserve:0,count:1,x:x+this.rng.range(-2,2),y:y,z:z+this.rng.range(-2,2),dead:false});
};
World.prototype._createMap=function(){
 var i,r,h,t,a,d,x,z,house;
 /* Dense, real town buildings (waiting island excluded), all on the same
  * lattice as streets. Human-scale skylines cap at eight 4 m floors. */
 var density=districtDensity;
 for(i=0;i<regions.length;i++){
  r=regions[i]; var count=density[r.layout||r.style]||22,g=districtGrid[r.layout||r.style],cols=g.cols,sx=g.sx,sz=g.sz,rows=Math.ceil(count/cols);
  for(h=0;h<count;h++){
   var row=Math.floor(h/cols),col=h%cols;
   x=r.x+(col-(cols-1)/2)*sx;
   z=r.z+(row-(rows-1)/2)*sz;
   /* v71 : des villes moins quadrillées. Quelques parcelles deviennent des
    * squares arborés, les bâtiments ont des emprises variées et le centre-ville
    * monte en gratte-ciel tandis que les faubourgs restent bas. */
   var urban=r.style==='citadel'||r.style==='port',skip=urban?.08:r.style==='desert'?.16:.2;
   var ring=Math.hypot((col-(cols-1)/2)/Math.max(1,(cols-1)/2),(row-(rows-1)/2)/Math.max(1,(rows-1)/2))/1.42;
   if(this.rng.next()<skip&&h!==0){for(t=0;t<3;t++)this._object('tree',x+this.rng.range(-4,4),z+this.rng.range(-4,4),this.rng.range(1.3,2),this.rng.range(3,6));this._dropLoot(x,heightAt(x,z)+.2,z);continue;}
   var tower=urban&&(ring<.45||h%8===0),floors=tower?(4+this.rng.int(urban&&ring<.3?6:4)):(1+this.rng.int(urban?3:2));
   if(r.style==='citadel'&&ring<.25)floors=Math.min(10,floors+2);
   var hw=urban?this.rng.range(4.6,6.2):this.rng.range(4.3,5.9),hd=urban?this.rng.range(4.6,6.2):this.rng.range(4.3,5.6);
   house=this._object('house',x,z,hw,floors*4,'wood',0);house.d=hd;house.style=r.style;house.floors=floors;house.h=floors*4;house.door={x:x,z:z-hd,side:'north'};
   this._object('chest',x,z+1,.8,1,'wood',0);
  }
  /* Props are outside road corridors and pads, thus cannot obstruct doors. */
  for(t=0;t<Math.max(16,Math.round(count*.7));t++){a=this.rng.next()*TAU;d=this.rng.range(Math.max(r.padW,r.padD)+13,Math.min(118,Math.max(r.padW,r.padD)+35));x=r.x+Math.cos(a)*d;z=r.z+Math.sin(a)*d;if(coastDistance(x,z)<MAP.shoreStart-16&&!nearRoute(x,z,6.5)&&!regions.some(function(q){return Math.abs(x-q.x)<q.padW+9&&Math.abs(z-q.z)<q.padD+9;}))this._object(this.rng.next()<.68?'tree':'rock',x,z,this.rng.range(1.4,2.8),this.rng.range(3,8));}
  /* Dense rings of trees/rocks are deliberately kept out of carriageways and
   * doors.  Loot crates remain lightweight/non-solid and live with houses. */
  for(var l=0;l<18;l++){
   /* Ground loot lies in clear street corridors, not random wall/stair shells.
    * The <=2 m pickup scatter still stays inside the 8+ m house-row gap. */
   var lane=1+this.rng.int(cols-1),lx=r.x-cols*sx/2+lane*sx,lz=r.z+(this.rng.next()-.5)*(rows-1)*sz;
   this._dropLoot(lx,heightAt(lx,lz)+.2,lz);
  }
 }
 if(MAPD)this._object('dock',200,-405,12,1.4,'wood');else this._object('dock',660,240,12,1.4,'wood');
 this._createFlora();
 var wx=MAP.waiting.x,wz=MAP.waiting.z,wait=[[-28,-15],[0,-15],[28,-15],[-14,18],[14,18]];
 for(i=0;i<wait.length;i++){var q=wait[i],wh=this._object('house',wx+q[0],wz+q[1],8,4.5,'wood');this._object('chest',wh.x,wh.z+1,.8,1,'wood');}
 for(i=0;i<20;i++){var aa=this.rng.next()*TAU,dd=this.rng.range(10,73),xx=wx+Math.cos(aa)*dd,zz=wz+Math.sin(aa)*dd;this._object(i%3?'tree':'crate',xx,zz,i%3?1.8:1.2,i%3?4:1.2,'wood');if(i<9)this._dropLoot(xx,heightAt(xx,zz)+.2,zz);}
 /* Compact warm-up racks make waiting useful without silently granting a BR
  * loadout. Supplies remain physical pickups and are purged at transport. */
 var warmWeapons=['pistol','revolver','rifle','burst','smg','shotgun','tactical','sniper','dmr','launcher'];
 for(i=0;i<warmWeapons.length;i++){var wcol=i%5,wrow=Math.floor(i/5),wl=makeInv(warmWeapons[i],i%5);this.loot.push({id:uid(this,'warmup'),kind:'weapon',weapon:warmWeapons[i],rarity:i%5,ammo:wl.ammo,reserve:wl.reserve,count:0,x:wx-34+wcol*17,y:heightAt(wx-34+wcol*17,wz+48+wrow*7)+.45,z:wz+48+wrow*7,dead:false});}
 for(i=0;i<4;i++){var wk=i%2?'shield':'heal',sx=wx-28+i*18,sz=wz+64;this.loot.push({id:uid(this,'warmup'),kind:wk,rarity:0,ammo:0,reserve:0,count:3,x:sx,y:heightAt(sx,sz)+.45,z:sz,dead:false});}
 this._object('rock',wx-57,wz+42,1.7,3.2,'stone');this._object('container',wx+57,wz+42,1.5,2.5,'metal');
 for(i=0;i<2;i++){var px=wx-20+i*40,pz=wz+25,py=heightAt(px,pz)+1;this.builds.push({id:uid(this,'platform'),owner:'waiting-island',type:'floor',material:'wood',x:px,y:py,z:pz,yaw:0,hp:999,maxHp:999,edited:false,editMask:511,dead:false});}
 for(i=0;i<this.loot.length;i++)this.loot[i].y=heightAt(this.loot[i].x,this.loot[i].z)+.45;
 /* One ready-to-drive car in every town, two in Port/Citadelle: 14 road
  * vehicles + the boat, leaving room under the existing 20-vehicle craft cap.
  * Deterministic lane candidates are validated with the driving footprint. */
 var types=['car','buggy','van','sport'];
 for(i=0;i<regions.length;i++){
  r=regions[i];var grid=districtGrid[r.style],nr=Math.ceil(density[r.style]/grid.cols),want=(r.style==='port'||r.style==='citadel')?2:1,added=0;
  for(var laneIndex=1;laneIndex<grid.cols&&added<want;laneIndex++){
   var vx=r.x-grid.cols*grid.sx/2+laneIndex*grid.sx,vz=r.z+(1-(nr-1)/2)*grid.sz;
   var car={type:types[(i+added)%types.length],x:vx,y:heightAt(vx,vz)+.35,z:vz,yaw:0,speed:0,fuel:100,hp:350,maxHp:350,driver:null,owner:null,paint:r.color};
   if(this._vehicleSpace(car,null,false)){car.id=uid(this,'v');this.vehicles.push(car);added++;}
  }
 }
 this.vehicles.push({id:uid(this,'v'),type:'boat',x:565,y:SEA,z:185,yaw:0,speed:0,fuel:100,hp:350,maxHp:350,driver:null,owner:null,paint:'#4d91d4'}); 
 this._bumpBuilds(); /* Platforms above were pushed directly: refresh the build index. */
};
/* Waiting is deliberately a safe, compact warm-up with physical pickups. The
 * transport transition clears every carried item, making BR insertion clean. */
World.prototype._normalLoadout=function(p){ p.inventory=[];p.shield=0;p.mats={wood:0,stone:0,metal:0};p.selected=0;p.reload=0;p.useTime=0;p._useId=null;p._consumeFireHeld=false;p.revivingId=null;p.reviveProgress=0;p._burstLeft=0;p._burstTimer=0;p._recoil=0;p._jumpBuffer=0;p._coyote=0;p._vx=0;p._vz=0; };
World.prototype._trainingLoadout=function(p){ p.inventory=[makeInv('rifle',2),makeInv('shotgun',1),makeInv('sniper',2),{kind:'heal',count:3,id:uid(this,'heal')},{kind:'shield',count:3,id:uid(this,'shield')}];p.shield=0;p.mats={wood:1000,stone:1000,metal:1000};p.selected=0; };
World.prototype._trainingCatalog=function(){var list=[],k;for(k in weapons)list.push({key:k,kind:'weapon',name:weapons[k].name});list.push({key:'heal',kind:'heal',name:'Soin'});list.push({key:'shield',kind:'shield',name:'Bouclier'});return list;};
World.prototype._createTrainingRange=function(){
 /* The training range reuses the central island instead of expanding the map.
  * Every weapon/consumable can be picked up, while trainingGive is the quick UI API. */
 var keys=this.trainingItems||[],i;for(i=0;i<keys.length;i++){var col=i%4,row=Math.floor(i/4),x=regions[3].x-9+col*6,z=regions[3].z+regions[3].padD+row*6,item=keys[i],l;if(item.kind==='weapon'){l=makeInv(item.key,2);this.loot.push({id:uid(this,'training'),kind:'weapon',weapon:item.key,rarity:2,ammo:l.ammo,reserve:l.reserve,count:0,x:x,y:heightAt(x,z)+.45,z:z,dead:false});}else this.loot.push({id:uid(this,'training'),kind:item.key,rarity:0,ammo:0,reserve:0,count:3,x:x,y:heightAt(x,z)+.45,z:z,dead:false});}
 var types=['car','buggy','van'];for(i=0;i<types.length;i++){var vx=regions[3].x+(i-1)*19,vz=regions[3].z+19;this.vehicles.push({id:uid(this,'training-v'),type:types[i],x:vx,y:heightAt(vx,vz)+.35,z:vz,yaw:-Math.PI/2,speed:0,fuel:100,hp:350,maxHp:350,driver:null,owner:'training-range',paint:'#4d91d4'});}
};
/* Fixed street intersections provide walkable deployment goals.  The 112-slot
 * permutation gives every BR roster position a different goal (and spreads
 * 100 actors over all 16 settlements) without using non-deterministic retries.
 * Training uses the same map-safe lattice rather than spawning its dummies in
 * a tight ring around the player. */
World.prototype._safeSpawnGoal=function(p){
 var index=p&&p._rosterIndex!=null?p._rosterIndex:this.players.indexOf(p),perRegion=7,total=regions.length*perRegion;
 var slot=((index*37+((this.seed>>>0)%total))%total+total)%total,ri=slot%regions.length,order=Math.floor(slot/regions.length),r=regions[ri],g=districtGrid[r.style],rows=Math.ceil((districtDensity[r.style]||22)/g.cols);
 /* These seven pairs remain distinct in every authored district grid and lie
  * on road intersections, at least one house-lane apart. */
 var pairs=[[1,1],[2,3],[3,5],[4,0],[1,4],[3,2],[2,0]],pair=pairs[order],lane=1+(pair[0]%(g.cols-1)),row=pair[1]%(rows+1),left=r.x-g.cols*g.sx/2,top=r.z-(rows-1)*g.sz/2-g.sz/2;
 return {x:Math.round((left+lane*g.sx)*2)/2,z:Math.round((top+row*g.sz)*2)/2,region:ri,slot:slot};
};
World.prototype._spawnActive=function(p){
 var goal=this._safeSpawnGoal(p),y=heightAt(goal.x,goal.z);
 /* The lattice is authored in the clear; retain a deterministic central
  * fallback in case a future map decoration occupies a slot. */
 if(this._blocked(goal.x,goal.z,.6,y)){goal={x:regions[3].x,z:regions[3].z+regions[3].padD+8,region:3,slot:-1};y=heightAt(goal.x,goal.z);}
 p._spawnGoal={x:goal.x,z:goal.z,region:goal.region,slot:goal.slot};p.x=goal.x;p.z=goal.z;p.y=y;p.grounded=true;p.gliding=false;p.falling=false;p.jumping=false;p.autoGlider=false;p.swimming=false;p.deployed=true;p._lastX=p.x;p._lastZ=p.z;if(!p.inventory.length&&(this.mode==='training'||this.mode==='creative'))this._trainingLoadout(p);
};
World.prototype.addHuman=function(o){
 o=o||{};if(typeof o.id!=='string'||!o.id||typeof o.name!=='string'||!o.name)return null;
 for(var i=0;i<this.players.length;i++)if(this.players[i].id===o.id)return null;
 var target=null;for(i=0;i<this.players.length;i++)if(this.players[i].bot){target=this.players[i];break;}if(!target)return null;
 if(o.equipment!=null){if(typeof o.equipment!=='object')return null;for(var ek in o.equipment)if(typeof o.equipment[ek]!=='string')return null;target.equipment=o.equipment;}target.id=o.id;target.name=o.name.slice(0,32);target.bot=false;return target;
};
World.prototype.removeHuman=function(id){ for(var i=0;i<this.players.length;i++){var p=this.players[i];if(p.id===id&&!p.bot){p.id='bot-'+uid(this,'r');p.name='IA';p.bot=true;p._input={};return true;}}return false; };
World.prototype.command=function(id,input){
 var p=this._find(id);if(!p||!input||typeof input!=='object')return false;var q={},invalid=false;
 if('moveX'in input){if(finite(input.moveX))q.moveX=clamp(input.moveX,-1,1);else invalid=true;}if('moveZ'in input){if(finite(input.moveZ))q.moveZ=clamp(input.moveZ,-1,1);else invalid=true;}
 if('yaw'in input){if(finite(input.yaw))q.yaw=normAng(input.yaw);else invalid=true;}if('pitch'in input){if(finite(input.pitch))q.pitch=clamp(input.pitch,-1.35,1.35);else invalid=true;}if('moveY'in input){if(finite(input.moveY))q.moveY=clamp(input.moveY,-1,1);else invalid=true;}if('emoteStyle'in input){if(input.emote!==true||typeof input.emoteStyle!=='string'||EMOTE_STYLES.indexOf(input.emoteStyle)<0)invalid=true;}
 for(var sk of ['shotYaw','shotPitch'])if(sk in input){if(finite(input[sk]))q[sk]=sk==='shotYaw'?normAng(input[sk]):clamp(input[sk],-1.35,1.35);else invalid=true;}
 ['fire','sprint','aim','fly','crouch'].forEach(function(k){if(k in input){if(typeof input[k]==='boolean')q[k]=input[k];else invalid=true;}});if(invalid)return false;
 if('yaw'in q && !('shotYaw'in q)){delete p._input.shotYaw;delete p._input.shotPitch;}
 for(var k in q)p._input[k]=q[k];
 var edge={},allowed=['jump','deploy','interact','reload','use','drop','edit','emote','harvest','surrender','shoot','demolish','fly','fish','melee'];
 for(var j=0;j<allowed.length;j++){if(input[allowed[j]]===true)edge[allowed[j]]=true;else if(input[allowed[j]]!==undefined&&allowed[j]==='fish')invalid=true;}if(input.emote===true&&input.emoteStyle!==undefined)edge.emoteStyle=input.emoteStyle;
 if(Number.isInteger(input.slot)&&input.slot>=0&&input.slot<5)edge.slot=input.slot;
 if(Array.isArray(input.swap)&&input.swap.length===2&&Number.isInteger(input.swap[0])&&Number.isInteger(input.swap[1]))edge.swap=input.swap.slice();
 if(['wall','floor','ramp','roof'].indexOf(input.build)>=0)edge.build=input.build;
 if(['wood','stone','metal'].indexOf(input.material)>=0)edge.material=input.material;
 if('buildLevel'in input){if(Number.isInteger(input.buildLevel)&&input.buildLevel>=-1&&input.buildLevel<=1)edge.buildLevel=input.buildLevel;else invalid=true;}
 if('craftVehicle'in input){if(['car','buggy','sport'].indexOf(input.craftVehicle)>=0)edge.craftVehicle=input.craftVehicle;else invalid=true;}
 if('paint'in input){if(typeof input.paint==='string'&&/^#[0-9a-fA-F]{6}$/.test(input.paint))edge.paint=input.paint.toLowerCase();else invalid=true;}
 if('trainingItem'in input){if(this.mode==='training'&&typeof input.trainingItem==='string'&&input.trainingItem.length<=32)edge.trainingItem=input.trainingItem;else invalid=true;}
 if('trainingRarity'in input){if(this.mode==='training'&&'trainingItem'in input&&Number.isInteger(input.trainingRarity)&&input.trainingRarity>=0&&input.trainingRarity<=4)edge.trainingRarity=input.trainingRarity;else invalid=true;}
 if('rotation'in input){if(Number.isInteger(input.rotation)&&input.rotation>=0&&input.rotation<4)edge.rotation=input.rotation;else invalid=true;}if('editId'in input||'editMask'in input){if(typeof input.editId==='string'&&Number.isInteger(input.editMask)&&input.editMask>=0&&input.editMask<=511){edge.editId=input.editId;edge.editMask=input.editMask;}else invalid=true;}if(invalid)return false;
 if(Object.keys(edge).length){if(p._edge.length>=12)p._edge.shift();p._edge.push(edge);}return true;
};
World.prototype._find=function(id){ for(var i=0;i<this.players.length;i++)if(this.players[i].id===id)return this.players[i];return null; };
World.prototype._transition=function(phase){
 this.phase=phase;this.phaseTime=0;this._emit('phase',0,0,0,{text:phase});
 if(phase==='transport'){for(var i=0;i<this.players.length;i++){var p=this.players[i];this._normalLoadout(p);/* Lobby practice never contaminates BR quests/results. */p.hp=100;p.downed=false;p.downTimer=0;p.reviveProgress=0;p.revives=0;p.timesRevived=0;p.kills=0;p.damage=0;p.weaponDamage={};p.distance=0;p.chests=0;p.gathered=0;p.built=0;p.regions=[];p.deployed=false;p.airborneFromBus=false;p.autoGlider=false;p.jumping=false;p.falling=false;p.gliding=false;p.grounded=false;p.emote=0;p.emoteStyle='salut';p.emoteDuration=6;}}
 if(phase==='active')for(i=0;i<this.players.length;i++){p=this.players[i];if(!p.deployed)this._deployFromBus(p,true); }
};
World.prototype._deployFromBus=function(p,forced){
 if(p.deployed)return false;
 var override=this._azBusOverride;
 if(override&&override.lockId===p.id&&!override.release)return false;
 if(forced&&!p.bot&&!(override&&override.release))return false;
 p.deployed=true;p.airborneFromBus=true;p.autoGlider=false;p.jumping=false;p.falling=true;p.gliding=false;p.grounded=false;p.x=this.aircraft.x;p.y=this.aircraft.y;p.z=this.aircraft.z;p._lastX=p.x;p._lastZ=p.z;p._vy=-FLIGHT.busInitialSink;p._vx=0;p._vz=0;p._coyote=0;p._jumpBuffer=0;
 if(p.bot){var goal=this._safeSpawnGoal(p);p._airGoal={x:goal.x,z:goal.z,region:goal.region,slot:goal.slot};}
 this._emit('jump',p.x,p.y,p.z,{playerId:p.id,fromBus:true,forced:!!forced});return true;
};
World.prototype.step=function(dt){
 dt=clamp(finite(dt)?dt:0,0,.05);if(!dt)return this;this.tick++;this.phaseTime+=dt;this._clock=(this._clock||0)+dt;
 if(this.phase==='waiting'&&this.phaseTime>=10)this._transition('transport');
 if(this.phase==='transport'||(this.phase==='active'&&this.mode!=='training'&&this.mode!=='creative')){
  this._transportTime+=dt;
  var busOverride=this._azBusOverride;
  this.aircraft.x=busOverride?busOverride.x:MAP.transport.startX+this._transportTime*MAP.transport.velocityX;
  this.aircraft.z=busOverride?busOverride.z:MAP.transport.startZ+this._transportTime*MAP.transport.velocityZ;
  this.aircraft.y=busOverride?busOverride.y:MAP.transport.altitude;
  if(this.phase==='transport'&&this.phaseTime>=MAP.transport.duration&&!busOverride&&!this.players.some(function(p){return !p.bot&&p.alive&&!p.deployed;}))this._transition('active');
 }
 if(this.phase==='ended')return this;if(this.phase==='active')this.elapsed+=dt;
 for(var i=0;i<this.players.length;i++){var p=this.players[i];if(p.bot)this._bot(p,dt);this._updatePlayer(p,dt);}
 if(this.phase==='active'&&this.mode!=='training'&&this.mode!=='creative'&&this.mode!=='event')this._storm(dt);
 if(this.phase==='active'&&this.zeroPoint)this._zeroPointUpdate(dt);
 if(this.phase==='active')this._checkEnd();return this;
};
/* v54 : le Point Zéro frappe parfois en vraie partie — détruit des
 * bâtiments proches ou fissure le sol (secousse + dégâts de zone). */
World.prototype._zeroPointUpdate=function(dt){
 var zp=this.zeroPoint;if(!zp)return;
 if(this.elapsed<zp.nextEvent)return;
 zp.nextEvent=this.elapsed+100+this.rng.next()*100;
 var zx=zp.x,zz=zp.z;
 // 50% : détruit 1-2 bâtiments proches. 50% : fissure le sol.
 if(this.rng.next()<0.5){
   var near=[];
   for(var i=0;i<this.objects.length;i++){var o=this.objects[i];
     if(o.dead||o.type!=='house')continue;
     var d=Math.hypot(o.x-zx,o.z-zz);if(d<140)near.push({o:o,d:d});}
   near.sort(function(a,b){return a.d-b.d;});
   var n=Math.min(near.length,1+Math.floor(this.rng.next()*2));
   for(var k=0;k<n;k++){var o2=near[k].o;o2.dead=true;o2.hp=0;
     this._emit('zeropoint:destroy',o2.x,o2.y,o2.z,{houseId:o2.id});}
   if(n>0)this._emit('zeropoint:shock',zx,0,zz,{radius:120});
 }else{
   this._emit('zeropoint:crack',zx,0,zz,{radius:90});
   // Dégâts légers aux joueurs proches de la fissure.
   for(var j=0;j<this.players.length;j++){var p=this.players[j];
     if(!p.alive||p.downed)continue;
     var pd=Math.hypot(p.x-zx,p.z-zz);
     if(pd<90){this._damage(p,null,15,'zeropoint');}}
 }
};
World.prototype._bot=function(p,dt){
 if(!p.alive)return;
 /* A rescuer must hold still for the full authoritative revive duration. */
 if(p.revivingId){p._input={moveX:0,moveZ:0,fire:false,aim:false};return;}
 /* Deployment is a scheduler, not a think decision: never delay a jump until
  * the next AI burst (which was the source of clustered departures). */
 if(this.phase==='transport'&&p._jumpAt!=null&&!p.deployed&&this.phaseTime>=p._jumpAt)this._deployFromBus(p,false);
 p._ai-=dt;if(p._ai>0)return;
 /* Think in bursts rather than running LOS/path work every simulation tick.  A
  * little jitter prevents 100 bots from making the same decision frame. */
 p._ai=.28+this.rng.next()*.22;p._aiLastThink=this.elapsed;
 if(this.phase==='waiting'){p._input={moveZ:.35,moveX:(this.rng.next()-.5)*.7,sprint:false,fire:false,aim:false};if(this.rng.next()<.08)p._edge.push({harvest:true});return;}
 if(this.phase==='transport'){if(p._jumpAt!=null&&this.phaseTime>=p._jumpAt)this._deployFromBus(p,false);if(!p.deployed)return;}
 if(!p.deployed)return;
 var inp=p._input={},target=this._nearestEnemy(p,260),goal=null,panic=false;
 /* An unarmed bot does not lock onto nearby enemies: it seeks loot first. */
 if(target&&!p.inventory.some(function(it){return it&&it.kind==='weapon'&&((it.ammo||0)+(it.reserve||0)>0);}))target=null;
 /* During descent bots pursue their preselected region rather than all
  * converging on the aircraft or making identical random turns. */
 if((p.falling||p.gliding)&&p._airGoal){var agx=p._airGoal.x-p.x,agz=p._airGoal.z-p.z;p.yaw=inp.yaw=Math.atan2(-agx,-agz);inp.moveZ=1;inp.moveX=this._aiSteer(p,agx,agz);inp.fire=false;inp.aim=false;return;}
 if(target){if(p._aiTarget!==target.id)p._engageAt=(this._clock||0)+1.25+this.rng.next()*1.25;p._aiTarget=target.id;p._aiLastSeen=this.elapsed;}
 else if(p._aiTarget&&this.elapsed-p._aiLastSeen<1.2)for(var ti=0;ti<this.players.length;ti++)if(this.players[ti].id===p._aiTarget&&this.players[ti].alive&&!this.players[ti].downed){target=this.players[ti];break;}
 if(target&&!p.inventory.some(function(it){return it&&it.kind==='weapon'&&((it.ammo||0)+(it.reserve||0)>0);}))target=null;
 /* Storm escape has priority over chasing a remembered target. */
 if(this.mode!=='training'&&this.mode!=='creative'){
  var sd=Math.hypot(p.x-this.storm.x,p.z-this.storm.z);
  var future=this._stormState==='shrink',cx=future?this.storm.nextX:this.storm.x,cz=future?this.storm.nextZ:this.storm.z,rad=future?this.storm.nextRadius:this.storm.radius;
  panic=Math.hypot(p.x-cx,p.z-cz)>rad-85;if(panic){var angle=(p.team*2.399963)%TAU;goal={x:cx+Math.cos(angle)*Math.max(0,rad-110)*.35,z:cz+Math.sin(angle)*Math.max(0,rad-110)*.35};}
 }
 var visibleTarget=target&&this._lineClear(p.x,p.y+eyeHeight(p),p.z,target.x,target.y+eyeHeight(target),target.z);
 /* Use consumables only when not actively pressured.  Selecting the item and
  * issuing one edge keeps use/reload timing authoritative in _updatePlayer. */
 if(!panic&&p.hp<48&&!visibleTarget){for(var hi=0;hi<p.inventory.length;hi++)if(p.inventory[hi].kind==='heal'&&p.inventory[hi].count){p.selected=hi;inp.moveZ=0;inp.moveX=0;inp.fire=false;inp.aim=false;p._edge.push({use:true});return;}}
 if(!panic&&p.shield<45&&!visibleTarget&&p.hp>70&&p._aiLastDamage>-Infinity){for(hi=0;hi<p.inventory.length;hi++)if(p.inventory[hi].kind==='shield'&&p.inventory[hi].count){p.selected=hi;inp.moveZ=0;inp.moveX=0;inp.fire=false;inp.aim=false;p._edge.push({use:true});return;}}
 if(target&&!panic){
  var dx=target.x-p.x,dz=target.z-p.z,di=Math.hypot(dx,dz),best=-1,score=-1;
  for(var wi=0;wi<p.inventory.length;wi++){var it=p.inventory[wi],ww=it&&weapons[it.weapon];if(!ww||it.ammo<=0&&it.reserve<=0)continue;var sc=(di<=ww.range?3:0)+ww.damage/100-(ww.pellets&&di>40?1:0)+(it.ammo>0?.2:0);if(sc>score){score=sc;best=wi;}}
  if(best>=0)p.selected=best;var sel=p.inventory[p.selected];
  if(sel&&sel.kind==='weapon'&&sel.ammo===0&&sel.reserve>0){p._edge.push({reload:true});inp.fire=false;inp.aim=false;}
  else {
   p.yaw=Math.atan2(-dx,-dz);p.pitch=clamp((target.y+eyeHeight(target)-(p.y+eyeHeight(p)))/Math.max(di,1),-.5,.5);inp.yaw=p.yaw;inp.pitch=p.pitch;inp.aim=!!visibleTarget;
   /* Strafe direction is held for several decisions, producing readable
    * dodges instead of random left/right jitter each frame. */
   if(this.rng.next()<.25)p._aiStrafe*=-1;
   inp.moveZ=di>42?1:di<15?-.65:0;inp.moveX=di<65?p._aiStrafe*.55:0;inp.sprint=di>75;inp.fire=!!visibleTarget&&di<Math.min(220,weapons[sel?.weapon]?.range||0)&&(this.mode==='training'||this.mode==='creative'||(this._clock||0)>=(p._engageAt||0));
   /* Recently hit bots seek the nearest useful piece of cover. */
   if(p._aiLastDamage>0&&this.elapsed-p._aiLastDamage<1.8&&target&&visibleTarget){var cover=this._coverGoal(p,target);if(cover){goal=cover;inp.fire=false;inp.aim=false;}}
  }
  if(p.mats.wood>=10&&this.rng.next()<.09)p._edge.push({build:'wall',material:'wood',rotation:Math.round(p.yaw/(Math.PI/2))&3});
 } else if(!panic) {
  var near=null,nd=100*100;for(var li=0;li<this.loot.length;li++){var l=this.loot[li],ld=dist2(p,l);if(!l.dead&&ld<nd&&Math.abs(l.y-p.y)<3&&this._lootWorthwhile(p,l)){near=l;nd=ld;}}
  if(!near){for(var oi=0;oi<this.objects.length;oi++){var o=this.objects[oi],od=dist2(p,o);if(o.type==='chest'&&!o.opened&&!o.dead&&od<nd){near=o;nd=od;}}}
  goal=near||(regions[(p.team+Math.floor(this.elapsed/18))%regions.length]);
  /* Chests are interior points. Approach the authoritative north doorway so
   * wall shells do not strand loot-seeking bots on a random side. */
  if(near&&near.type==='chest')goal={x:near.x,z:near.z};
  if(near&&Math.sqrt(nd)<3)p._edge.push({interact:true});if(!near&&this.rng.next()<.11)p._edge.push({harvest:true});
 }
 var ally=this._downedAlly(p);if(ally&&!panic&&!visibleTarget){var ax=ally.x-p.x,az=ally.z-p.z,ad=Math.hypot(ax,az);goal={x:ally.x,z:ally.z};inp.fire=false;inp.aim=false;if(ad<3)p._edge.push({interact:true});}
 var spacing=this._botSpacing(p,target?6:13);
 if(target&&(spacing.x||spacing.z)){var sf=forward(p.yaw,0),srx=Math.cos(p.yaw),srz=-Math.sin(p.yaw);inp.moveZ=clamp((inp.moveZ||0)+spacing.x*sf.x/6+spacing.z*sf.z/6,-1,1);inp.moveX=clamp((inp.moveX||0)+spacing.x*srx/6+spacing.z*srz/6,-1,1);}
 if(goal){goal={x:goal.x+spacing.x,z:goal.z+spacing.z};goal=this._routeGoal(p,goal);var gx=goal.x-p.x,gz=goal.z-p.z,gd=Math.hypot(gx,gz);p.yaw=inp.yaw=Math.atan2(-gx,-gz);inp.moveZ=gd>.75?1:0;inp.moveX=gd>.75?this._aiSteer(p,gx,gz):0;inp.sprint=gd>18;}
 else if(!inp.moveX&&!inp.moveZ){inp.moveX=p._aiStrafe*.25;inp.moveZ=0;}
 if(p._aiLastX!=null&&Math.hypot(p.x-p._aiLastX,p.z-p._aiLastZ)<.08&&this.rng.next()<.7)p._edge.push({jump:true});p._aiLastX=p.x;p._aiLastZ=p.z;
};

World.prototype._routeGoal=function(p,goal){
 var candidates=this._objectsAt(goal.x,goal.z).concat(this._objectsAt(p.x,p.z));
 for(var o of candidates){if(o.dead||o.type!=='house'||Math.abs(p.y-o.y)>2)continue;
  var a=local(o,p.x,p.z),g=local(o,goal.x,goal.z),insideA=Math.abs(a.x)<o.w-.5&&Math.abs(a.z)<o.d-.5,insideG=Math.abs(g.x)<o.w-.5&&Math.abs(g.z)<o.d-.5;
  if(insideA===insideG)continue;
  if(insideA){if(Math.abs(a.x)>1.1)return worldPoint(o,0,-o.d+1.5);return worldPoint(o,0,-o.d-2.2);}
  if(a.z>-o.d-1.5&&Math.abs(a.x)>o.w-.5)return worldPoint(o,(a.x<0?-1:1)*(o.w+1.6),-o.d-2.2);
  if(Math.abs(a.x)>1.1||a.z<-o.d-3)return worldPoint(o,0,-o.d-2);
 }
 return goal;
};
World.prototype._aiSteer=function(p,gx,gz){
 var d=Math.hypot(gx,gz)||1,f={x:gx/d,z:gz/d},rx=Math.cos(p.yaw||0),rz=-Math.sin(p.yaw||0),probe=1.15;
 if(!this._blocked(p.x+f.x*probe,p.z+f.z*probe,.48,p.y))return 0;
 var side=p._aiStrafe||1;
 if(!this._blocked(p.x+(f.x*.7+rx*side)*probe,p.z+(f.z*.7+rz*side)*probe,.48,p.y))return side*.85;
 if(!this._blocked(p.x+(f.x*.7-rx*side)*probe,p.z+(f.z*.7-rz*side)*probe,.48,p.y))return -side*.85;
 return side;
};
/* Steering-only local separation: no position correction or teleport is ever
 * applied.  The force is deliberately smaller in a fight, where closing and
 * strafing must remain possible, but it prevents idle/loot bots from forming
 * a single unreadable pile. */
World.prototype._botSpacing=function(p,range){
 var sx=0,sz=0,seen=0;
 for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q===p||!q.bot||!q.alive||!q.deployed||q.downed)continue;var dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);if(d>=range)continue;if(d<.01){var a=((p._rosterIndex||0)*2.399963+(q._rosterIndex||0)*.618034);dx=Math.cos(a);dz=Math.sin(a);d=1;}var weight=(range-d)/range;sx+=dx/d*weight;sz+=dz/d*weight;seen++;}
 if(!seen)return {x:0,z:0};var len=Math.hypot(sx,sz);if(!len)return {x:0,z:0};var scale=range*(range<=7?.42:.72);return {x:sx/len*scale,z:sz/len*scale};
};
World.prototype._coverGoal=function(p,target){
 var dx=p.x-target.x,dz=p.z-target.z,d=Math.hypot(dx,dz);if(d<8)return null;var ux=dx/d,uz=dz/d,best=null,score=Infinity;
 for(var i=0;i<this.objects.length;i++){
  var o=this.objects[i];if(o.dead||['tree','rock','container','silo','house'].indexOf(o.type)<0)continue;
  var ox=o.x-target.x,oz=o.z-target.z,along=ox*ux+oz*uz,side=Math.abs(ox*uz-oz*ux);if(along<5||along>d-3||side>(o.w||2)+2.5)continue;
  var gx=o.x+ux*((o.w||2)+1.4),gz=o.z+uz*((o.w||2)+1.4),gd=Math.hypot(gx-p.x,gz-p.z);
  if(gd<score&&!this._blocked(gx,gz,.48,p.y)){score=gd;best={x:gx,z:gz};}
 }
 for(i=0;i<this.builds.length;i++){var b=this.builds[i];if(b.dead||b.type!=='wall')continue;var bx=b.x-target.x,bz=b.z-target.z,ba=bx*ux+bz*uz,bs=Math.abs(bx*uz-bz*ux);if(ba<5||ba>d-3||bs>4)continue;var bgx=b.x+ux*3,bgz=b.z+uz*3,bgd=Math.hypot(bgx-p.x,bgz-p.z);if(bgd<score&&!this._blocked(bgx,bgz,.48,p.y)){score=bgd;best={x:bgx,z:bgz};}}
 return best;
};
World.prototype._nearestEnemy=function(p,max){
 var list=[];for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q.alive&&!q.downed&&q.deployed&&q.team!==p.team){var d=dist2(p,q);if(d<max*max)list.push({p:q,d:d});}}
 list.sort(function(a,b){return a.d-b.d;});for(i=0;i<Math.min(6,list.length);i++){q=list[i].p;if(this._lineClear(p.x,p.y+eyeHeight(p),p.z,q.x,q.y+eyeHeight(q),q.z))return q;}return null;
};
World.prototype._downedAlly=function(p){for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q!==p&&q.team===p.team&&q.downed&&q.alive)return q;}return null;};
World.prototype._fishable=function(p){
 var d=coastDistance(p.x,p.z);
 /* Fishing is a on-foot shore activity: never from a vehicle. */
 return p.deployed&&!p.vehicleId&&p.grounded&&!p.swimming&&!p.flying&&!p.gliding&&!p.falling&&d>=MAP.shoreStart-28&&d<=MAP.shoreEnd+4&&p.y>SEA+.2;
};
World.prototype._cancelFishing=function(p,text){
 if(p.fishing>0){p.fishing=0;this._emit('splash',p.x,p.y,p.z,{playerId:p.id,cancelled:true});if(text)this._say(p,text);return true;}return false;
};
World.prototype._fish=function(p){
 if(p.fishing>0){this._cancelFishing(p,'Pêche annulée');return false;}
 if(this.phase==='transport'||!this._fishable(p)){this._say(p,'Impossible de pêcher ici');return false;}
 p.fishing=4;this._emit('splash',p.x,p.y,p.z,{playerId:p.id});this._say(p,'Ligne lancée');return true;
};
World.prototype._finishFishing=function(p){
 if(!this._fishable(p)){p.fishing=0;this._say(p,'La prise s’est échappée');return;}
 var item;if(this.rng.next()<.5){item={kind:this.rng.next()<.5?'heal':'shield',count:1,id:uid(this,'fish')};}
 else {var ks=['pistol','revolver','rifle','burst','shotgun','tactical','smg','sniper','dmr','launcher'];item=makeInv(ks[this.rng.int(ks.length)],this.rng.int(4));item.id=uid(this,'fish');}
 var slot=-1;for(var i=0;i<p.inventory.length;i++)if(!p.inventory[i]){slot=i;break;}
 if(p.inventory.length<5)p.inventory.push(item);else {this.loot.push({id:uid(this,'l'),kind:item.kind,weapon:item.weapon,rarity:item.rarity||0,ammo:item.ammo||0,reserve:item.reserve||0,count:item.count||0,gold:item.kind==='weapon'&&goldOf(p,item),x:p.x,y:p.y+.2,z:p.z,dead:false});}
 p.fishing=0;this._emit('fish',p.x,p.y,p.z,{playerId:p.id,kind:item.kind,weapon:item.weapon,rarity:item.rarity||0});this._say(p,'Prise attrapée');
};
World.prototype._cancelEmote=function(p){if(p.emote>0){p.emote=0;return true;}return false;};
World.prototype._startEmote=function(p,style){
 if(!p.alive||p.downed||!p.grounded||p.swimming||p.flying||p.falling||p.gliding||p.jumping||p.vehicleId||p.reload>0||p.useTime>0||p._cool>0||((this._clock||0)-p._combatAt)<1)return false;
 p.emoteStyle=style||'salut';p.emoteDuration=6;p.emote=6;this._emit('emote',p.x,p.y,p.z,{playerId:p.id,style:p.emoteStyle,duration:6});return true;
};
World.prototype._updatePlayer=function(p,dt){
 if(!p.alive)return;if(p.equipment&&p.equipment.character==='char-midas')for(var gi=0;gi<p.inventory.length;gi++){var gIt=p.inventory[gi];if(gIt&&gIt.kind==='weapon')gIt.gold=true;}if(p._cool>0)p._cool-=dt;if(p._botBurstPause>0)p._botBurstPause=Math.max(0,p._botBurstPause-dt);if(p.emote>0)p.emote=Math.max(0,p.emote-dt);if(p._harvestCool>0)p._harvestCool-=dt;if(p._jumpBuffer>0)p._jumpBuffer-=dt;if(p._recoil>0)p._recoil=Math.max(0,p._recoil-dt*1.2);if(p.reload>0){p.reload-=dt;if(p.reload<=0)this._finishReload(p);}
 if(p.fishing>0){p.fishing=Math.max(0,p.fishing-dt);if(p.fishing<1e-6)p.fishing=0;var fi=p._input||{};if(Math.abs(+fi.moveX||0)>.01||Math.abs(+fi.moveZ||0)>.01){this._cancelFishing(p,'Pêche annulée');}else if(p.fishing<=0)this._finishFishing(p);}
 if(p.useTime>0){var useInput=p._input||{};if(p._useId!==((p.inventory[p.selected]||{}).id)||Math.hypot(p.x-p._useX,p.z-p._useZ)>.08||Math.abs(+useInput.moveX||0)>.08||Math.abs(+useInput.moveZ||0)>.08||useInput.jump||!p.grounded){p.useTime=0;p._useId=null;}else {p.useTime-=dt;if(p.useTime<=0)this._finishUse(p);}}
 if(p.downed){p.downTimer-=dt;if(p.downTimer<=0)this._eliminate(p,null,'hors combat');return;}
 if(p.revivingId&&this._updateRevive(p,dt))return;
 /* A human burst rifle finishes its 3-round burst even after the trigger is
  * released, unless the weapon is gone, reloaded or swapped. */
 if(p._burstLeft>0){p._burstTimer-=dt;if(p._burstTimer<=0){var bIt=p.inventory[p.selected];if(!p.downed&&!p.vehicleId&&p.grounded&&!p.jumping&&!p.falling&&!p.gliding&&!p.swimming&&bIt&&bIt.kind==='weapon'&&bIt.ammo>0){var bW=weapons[bIt.weapon];if(this.mode!=='creative')bIt.ammo--;var bDir=this._aimAssistDir(p,(p._input.shotYaw??p.yaw),(p._input.shotPitch??p.pitch),bW);this._shootOnce(p,bIt,bW,bDir);p._burstLeft--;p._burstTimer=.09;}else p._burstLeft=0;}}
 while(p._edge.length)this._edge(p,p._edge.shift());
 if(this.phase==='transport'&&!p.deployed){p.x=this.aircraft.x;p.y=this.aircraft.y;p.z=this.aircraft.z;return;}
 var i=p._input||{};if(i.yaw!=null)p.yaw=i.yaw;if(i.pitch!=null)p.pitch=i.pitch;if(p.emote>0&&(Math.abs(+i.moveX||0)>.01||Math.abs(+i.moveZ||0)>.01||i.sprint))this._cancelEmote(p);
 if(root.AZEvent&&root.AZEvent.active&&root.AZEvent.stepMeteorRider&&root.AZEvent.stepMeteorRider(p,dt))return;
 var held=p.inventory[p.selected],consumable=held&&(held.kind==='heal'||held.kind==='shield');
 /* Fire is the normal trigger for a selected consumable too.  A held trigger
  * gets one rising-edge consumption, rather than cancelling or restarting the
  * timer every tick; explicit `use` remains accepted for older clients. */
 if(!i.fire)p._consumeFireHeld=false;
 if(consumable&&i.fire&&!p._consumeFireHeld){if(p.useTime<=0)this._startUse(p);p._consumeFireHeld=true;}
 if(i.fire&&p.useTime>0&&!consumable){p.useTime=0;p._useId=null;}
 p.crouching=!!i.crouch&&!p.flying&&!p.gliding&&!p.falling&&!p.jumping&&!p.swimming&&!p.vehicleId&&!p.downed;
 p.aim=!!(i.aim&&held&&held.kind==='weapon'&&!p.flying&&!p.gliding&&!p.falling&&!p.jumping&&!p.swimming&&!p.vehicleId&&!p.downed);
 /* Waiting actors share normal movement/building but cannot take damage. */
 if(this.phase==='waiting'){if(p.gliding||p.falling)this._airMove(p,dt,true);else if(p.jumping)this._jumpMove(p,dt,true);else this._walk(p,dt,true);return;}
 if(!p.deployed)return;
 if(p.vehicleId){this._drive(p,dt);return;}
 if(p.flying&&this.mode==='creative'){this._flyMove(p,dt);return;}
 if(p.gliding||p.falling){this._airMove(p,dt,false);return;}
 if(p.jumping){this._jumpMove(p,dt);return;}
 if(p.swimming){this._swimMove(p,dt);return;}
 this._walk(p,dt,false);
 if(i.fire&&p._cool<=0&&p.reload<=0&&p.useTime<=0)this._fire(p);
};
World.prototype._jumpMove=function(p,dt,waiting){
 var i=p._input||{},mx=clamp(+i.moveX||0,-1,1),mz=clamp(+i.moveZ||0,-1,1),f=forward(p.yaw,0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw);
 /* Air control: steer the jump with a softer acceleration, keeping momentum. */
 var maxSp=(i.sprint?8.8:5.4),dvx=(f.x*mz+rx*mx)*maxSp,dvz=(f.z*mz+rz*mx)*maxSp,hasInput=(mx!==0||mz!==0),stepA=(hasInput?30:26)*dt;
 p._vx+=clamp(dvx-p._vx,-stepA,stepA);p._vz+=clamp(dvz-p._vz,-stepA,stepA);
 var dx=p._vx*dt,dz=p._vz*dt,nx=p.x+dx,nz=p.z+dz;
 if(!this._blocked(nx,nz,.46,p.y)){p.x=nx;p.z=nz;}else if(!this._blocked(p.x+dx,p.z,.46,p.y)){p.x+=dx;p._vz=0;}else if(!this._blocked(p.x,p.z+dz,.46,p.y)){p.z+=dz;p._vx=0;}else{p._vx*=.5;p._vz*=.5;}
 if(waiting){p.x=clamp(p.x,MAP.waiting.x-75,MAP.waiting.x+75);p.z=clamp(p.z,MAP.waiting.z-75,MAP.waiting.z+75);}
 /* Coyote time: a jump pressed just after leaving a ledge still counts. */
 if(p._coyote>0){p._coyote-=dt;if(p._jumpBuffer>0){p._jumpBuffer=0;p._coyote=0;p._vy=7.4;p._jumpTime=0;this._cancelEmote(p);this._cancelFishing(p,'Pêche annulée');this._emit('jump',p.x,p.y,p.z,{playerId:p.id,ordinary:true});}}
 /* v47: gravity is integrated exactly once per tick. A leftover duplicate
  * integration moved the feet below the ground BEFORE prevY was captured, so
  * the swept landing test failed on fast descents (high jumps) and the actor
  * tunnelled through the terrain. Terminal velocity also bounds the sweep. */
 p.distance+=Math.hypot(p.x-p._lastX,p.z-p._lastZ);p._lastX=p.x;p._lastZ=p.z;p._jumpTime+=dt;
 var prevY=p.y;
 p._vy=Math.max(-55,p._vy-21*dt);p.y+=p._vy*dt;var prevVy=p._vy;
 /* Landing surface: the highest support at or below the feet when the tick
  * started. Querying with prevY-.75 caps the look-ahead at prevY+.05, so a
  * ceiling above can never be mistaken for ground: jumping up through a floor
  * (or cresting its edge at the apex) no longer teleports the actor on top. */
 var ground=this.supportAt(p.x,p.z,prevY-.75);
 /* Landing in water must swim, not stand on the seabed. Land only while truly
  * falling onto a surface the feet have reached. */
 if(prevVy<=0&&prevY>=ground-.05&&p.y<=ground+.05){var wj=playerWater(p.x,p.z);p.y=wj?SEA-.72:ground;p._vy=0;p.jumping=false;p.grounded=!wj;p.swimming=wj;this._emit(wj?'splash':'land',p.x,p.y,p.z,{playerId:p.id,ordinary:true,entry:wj});return;}
 /* Terrain is never permeable: whatever the speed or frame hitch, feet that end
  * the tick below the island surface are put back on it. */
 var terrain=heightAt(p.x,p.z);
 if(p.y<terrain-.02&&p._vy<=0){var wt=playerWater(p.x,p.z);p.y=wt?SEA-.72:Math.max(terrain,ground);p._vy=0;p.jumping=false;p.grounded=!wt;p.swimming=wt;this._emit(wt?'splash':'land',p.x,p.y,p.z,{playerId:p.id,ordinary:true,entry:wt});}
};
/* Creative flight has no artificial map wall or altitude ceiling. Coordinates stay
 * finite through finite input and a bounded per-frame speed, while the renderer
 * follows the player no matter how high the construction session goes. */
World.prototype._flyMove=function(p,dt){var i=p._input||{},mx=clamp(+i.moveX||0,-1,1),mz=clamp(+i.moveZ||0,-1,1),my=clamp(+i.moveY||0,-1,1),f=forward(p.yaw,0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),speed=(i.sprint?20:11)*dt;p.x+= (f.x*mz+rx*mx)*speed;p.z+=(f.z*mz+rz*mx)*speed;p.y=Math.max(-20,p.y+my*speed);p.grounded=false;p.swimming=false;};
function playerWater(x,z){return isWater(x,z)||heightAt(x,z)<SEA-.38;}
World.prototype._swimMove=function(p,dt){
 var i=p._input||{},mx=clamp(+i.moveX||0,-1,1),mz=clamp(+i.moveZ||0,-1,1),len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;}
 var f=forward(p.yaw,0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),boost=Math.max(0,p._swimBoost||0),speed=(i.sprint?7:4.6)*(1+boost*.34)*dt,dx=(f.x*mz+rx*mx)*speed,dz=(f.z*mz+rz*mx)*speed;
 var nx=!p.bot||this.mode==='creative'?p.x+dx:clamp(p.x+dx,-MAP.halfSize,MAP.halfSize),nz=!p.bot||this.mode==='creative'?p.z+dz:clamp(p.z+dz,-MAP.halfSize,MAP.halfSize),moved=false;
 if(!this._blocked(nx,nz,.43,SEA-.65,null,true)){moved=true;}else if(!this._blocked(nx,p.z,.43,SEA-.65,null,true)){nz=p.z;moved=true;}else if(!this._blocked(p.x,nz,.43,SEA-.65,null,true)){nx=p.x;moved=true;}
 if(moved){p.x=nx;p.z=nz;p.distance+=Math.hypot(p.x-p._lastX,p.z-p._lastZ);p._lastX=p.x;p._lastZ=p.z;}
 p._swimBoost=Math.max(0,boost-dt*1.65);p._swimPhase=(p._swimPhase||0)+dt*(i.sprint?7.4:5.1);
 var ground=this.supportAt(p.x,p.z,SEA+2);
 if(!playerWater(p.x,p.z)&&ground>=SEA-.38){p.swimming=false;p.grounded=true;p.y=ground;p._swimBoost=0;this._emit('splash',p.x,SEA,p.z,{playerId:p.id,exit:true});this._region(p);return;}
 p.swimming=true;p.grounded=false;p.jumping=false;p._vy=0;p.y=SEA-.72+Math.sin(p._swimPhase*1.35)*.045;
};
World.prototype._walk=function(p,dt,waiting){
 var i=p._input||{},mx=clamp(+i.moveX||0,-1,1),mz=clamp(+i.moveZ||0,-1,1),len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;}
 /* Buffered jump: a press issued just before landing fires on the first
  * grounded tick, so jumps never feel eaten. */
 if(p._jumpBuffer>0&&!p.downed){p._jumpBuffer=0;p._vy=7.4;p.grounded=false;p.jumping=true;p._jumpTime=0;p.crouching=false;this._cancelEmote(p);this._cancelFishing(p,'Pêche annulée');this._emit('jump',p.x,p.y,p.z,{playerId:p.id,ordinary:true});return;}
 /* Velocity with acceleration and friction instead of instant speed: movement
  * stays snappy but gains a readable weight. */
 var f=forward(p.yaw,0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),maxSp=(i.sprint?8.8:5.4)*(p.aim?.68:1)*(p.crouching?.5:1);
 var dvx=(f.x*mz+rx*mx)*maxSp,dvz=(f.z*mz+rz*mx)*maxSp,hasInput=(mx!==0||mz!==0),stepA=(hasInput?46:40)*dt;
 p._vx+=clamp(dvx-p._vx,-stepA,stepA);p._vz+=clamp(dvz-p._vz,-stepA,stepA);
 var dx=p._vx*dt,dz=p._vz*dt;
 var nx=p.x+dx,nz=p.z+dz;
 if(waiting){nx=clamp(nx,MAP.waiting.x-75,MAP.waiting.x+75);nz=clamp(nz,MAP.waiting.z-75,MAP.waiting.z+75);if(Math.hypot(nx-MAP.waiting.x,nz-MAP.waiting.z)>MAP.waiting.radius){var an=Math.atan2(nz-MAP.waiting.z,nx-MAP.waiting.x);nx=MAP.waiting.x+Math.cos(an)*MAP.waiting.radius;nz=MAP.waiting.z+Math.sin(an)*MAP.waiting.radius;}}
 /* Slide along a wall instead of dropping the whole input vector.  This also
  * makes jump-land and aim movement feel continuous beside cover. Blocked
  * velocity is zeroed on that axis so pressure never builds up against walls. */
 var moved=false;if(!this._blocked(nx,nz,.48,p.y)){moved=true;}else {nx=p.x+dx;if(!this._blocked(nx,p.z,.48,p.y)){nz=p.z;moved=true;p._vz=0;}else {nx=p.x;nz=p.z+dz;if(!this._blocked(nx,nz,.48,p.y)){moved=true;p._vx=0;}else{p._vx=0;p._vz=0;}}}
 /* The staging island is a safe lobby, not a combat collider course. If a
  * decorative tree/crate traps an actor at spawn, preserve input responsiveness
  * there; active-map movement still respects all colliders. */
 if(waiting&&!moved){nx=clamp(p.x+dx,MAP.waiting.x-75,MAP.waiting.x+75);nz=clamp(p.z+dz,MAP.waiting.z-75,MAP.waiting.z+75);moved=true;}
 if(waiting&&moved&&Math.hypot(nx-MAP.waiting.x,nz-MAP.waiting.z)>MAP.waiting.radius){var limitAng=Math.atan2(nz-MAP.waiting.z,nx-MAP.waiting.x);nx=MAP.waiting.x+Math.cos(limitAng)*MAP.waiting.radius;nz=MAP.waiting.z+Math.sin(limitAng)*MAP.waiting.radius;}
 if(moved){p.x=waiting||!p.bot||this.mode==='creative'?nx:clamp(nx,-MAP.halfSize,MAP.halfSize);p.z=waiting||!p.bot||this.mode==='creative'?nz:clamp(nz,-MAP.halfSize,MAP.halfSize);p.distance+=Math.hypot(p.x-p._lastX,p.z-p._lastZ);p._lastX=p.x;p._lastZ=p.z;}
 var water=!waiting&&playerWater(p.x,p.z);
 p.swimming=water;if(water){p.y=SEA-.72;p.grounded=false;p._swimPhase=p._swimPhase||0;this._emit('splash',p.x,SEA,p.z,{playerId:p.id,entry:true});return;}
 var support=this.supportAt(p.x,p.z,p.y);if(p.y-support>1.1){p.grounded=false;p.jumping=true;p._jumpTime=0;p._vy=-1;return;}p.y=support;p.grounded=true;p._coyote=.12;this._region(p);
 if((i.fire&&p._cool<=0&&p.reload<=0&&p.useTime<=0))this._fire(p);
};
World.prototype._airMove=function(p,dt,waiting){
 var i=p._input||{},f=forward(p.yaw,0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),mx=clamp(+i.moveX||0,-1,1),mz=clamp(+i.moveZ||0,-1,1);
 var dive=clamp((-(p.pitch||0)-FLIGHT.divePitchStart)/FLIGHT.divePitchRange,0,1);
 var glideSink=i.sprint?FLIGHT.glideFastSink:FLIGHT.glideSink;
 /* Neutral means neutral: the canopy only descends when both movement axes are
  * released.  Steering remains normalized so diagonal input never adds speed. */
 var travelZ=mz,len=Math.hypot(mx,travelZ);if(len>1){mx/=len;travelZ/=len;}
 /* Pitching down with the glider trades height for speed: more fun, same canopy. */
 var speed=p.gliding?(i.sprint?FLIGHT.glideFastSpeed:FLIGHT.glideSpeed+(FLIGHT.glideFastSpeed-FLIGHT.glideSpeed)*dive*.6):FLIGHT.freefallControlSpeed+(FLIGHT.diveControlSpeed-FLIGHT.freefallControlSpeed)*(i.sprint?1:dive);
 var dx=(f.x*travelZ+rx*mx)*speed*dt,dz=(f.z*travelZ+rz*mx)*speed*dt,nx=p.x+dx,nz=p.z+dz;
 if(!this._blocked(nx,nz,.46,p.y)){p.x=nx;p.z=nz;}else if(!this._blocked(p.x+dx,p.z,.46,p.y)){p.x+=dx;}else if(!this._blocked(p.x,p.z+dz,.46,p.y)){p.z+=dz;}
 var eventFloat=!!(p._eventFloat&&root.AZEvent&&root.AZEvent.active&&!p.gliding);
 if(eventFloat)p._vy=Number.isFinite(p._eventVerticalVelocity)?p._eventVerticalVelocity:0;
 else if(p.gliding)p._vy=-glideSink;else p._vy=Math.max(-(FLIGHT.freefallSpeed+(FLIGHT.diveSpeed-FLIGHT.freefallSpeed)*dive),p._vy-(FLIGHT.gravity+(FLIGHT.diveGravity-FLIGHT.gravity)*dive)*dt);
 if(waiting){p.x=clamp(p.x,MAP.waiting.x-75,MAP.waiting.x+75);p.z=clamp(p.z,MAP.waiting.z-75,MAP.waiting.z+75);if(Math.hypot(p.x-MAP.waiting.x,p.z-MAP.waiting.z)>MAP.waiting.radius){var wa=Math.atan2(p.z-MAP.waiting.z,p.x-MAP.waiting.x);p.x=MAP.waiting.x+Math.cos(wa)*MAP.waiting.radius;p.z=MAP.waiting.z+Math.sin(wa)*MAP.waiting.radius;}}else if(p.bot&&this.mode!=='creative'){p.x=clamp(p.x,-MAP.halfSize,MAP.halfSize);p.z=clamp(p.z,-MAP.halfSize,MAP.halfSize);}
 p.distance+=Math.hypot(p.x-p._lastX,p.z-p._lastZ);p._lastX=p.x;p._lastZ=p.z;
 /* Query support before descending to avoid tunnelling through roofs. Split a
  * threshold-crossing tick so the safety canopy opens at its shared altitude. */
 var ground=this.supportAt(p.x,p.z,p.y),nextY=p.y+p._vy*dt,openY=ground+FLIGHT.autoGliderHeight;
 if(p.airborneFromBus&&p.falling&&!p.gliding&&nextY<=openY){
  var fallTime=clamp((p.y-openY)/Math.max(.001,-p._vy),0,dt);
  nextY=p.y+p._vy*fallTime-glideSink*(dt-fallTime);p.gliding=true;p.falling=false;p.autoGlider=true;p._vy=-glideSink;
  this._emit('glide',p.x,nextY,p.z,{playerId:p.id,automatic:true});
 }
 p.y=nextY;
 if(p.y<=ground+.1){var water=playerWater(p.x,p.z);p.y=water?SEA-.72:ground;p._vy=0;p.falling=false;p.gliding=false;p.jumping=false;p.grounded=!water;p.swimming=water;p.airborneFromBus=false;p.autoGlider=false;this._emit(water?'splash':'land',p.x,p.y,p.z,{playerId:p.id,entry:water});}
};
World.prototype._drive=function(p,dt){
 var v=null;for(var vi=0;vi<this.vehicles.length;vi++)if(this.vehicles[vi].id===p.vehicleId)v=this.vehicles[vi];if(!v||v.driver!==p.id||v.hp<=0){p.vehicleId=null;return;}
 var spec=vehicleSpecs[v.type]||vehicleSpecs.car,i=p._input||{},vin=clamp(+i.moveZ||0,-1,1),target=vin>=0?vin*spec.maxSpeed:vin*spec.reverseSpeed;
 /* Steering belongs to the vehicle, not the camera; A/D or the joystick turns
  * the front axle. Camera dragging no longer teleports its heading. */
 var steering=clamp(+i.moveX||0,-1,1),turn=Math.max(clamp(Math.abs(v.speed)/5,0,1),vin?.35:0);
 v.steer=steering;v.yaw=normAng(v.yaw-steering*turn*1.35*dt*(v.speed<0?-1:1));p.yaw=v.yaw;
 var accel=(vin&&Math.sign(v.speed)!==Math.sign(target)?spec.brake:spec.accel)*dt;v.speed+=clamp(target-v.speed,-accel,accel);if(!vin)v.speed*=Math.max(0,1-spec.drag*dt);v.fuel=Math.max(0,v.fuel-Math.abs(v.speed)*.018*dt);if(!v.fuel)v.speed*=.92;
 var f=forward(v.yaw,0),nx=p.bot?clamp(v.x+f.x*v.speed*dt,-MAP.halfSize,MAP.halfSize):v.x+f.x*v.speed*dt,nz=p.bot?clamp(v.z+f.z*v.speed*dt,-MAP.halfSize,MAP.halfSize):v.z+f.z*v.speed*dt,boat=v.type==='boat',water=isWater(nx,nz);
 if((boat&&!water)||(!boat&&water)||!this._vehicleSpace({x:nx,z:nz,y:boat?SEA:heightAt(nx,nz)+.35,yaw:v.yaw},v.id,boat)){/* Crash damage is per second, not per tick: a wall tap must not one-shot a 350 HP vehicle. */v.hp=Math.max(0,v.hp-Math.abs(v.speed)*1.5*dt);v.speed*=-.25;}else {v.x=nx;v.z=nz;v.y=boat?SEA:heightAt(nx,nz)+.35;}
 /* One impact per victim per second: without the cooldown a single pass applies the per-tick damage ~10 times. (last==null, never ||, because a stored timestamp of 0 is falsy.) */
 var now=this._clock||0;v._runCd=v._runCd||{};
 for(var j=0;j<this.players.length;j++){var q=this.players[j];if(q!==p&&q.alive&&q.team!==p.team&&Math.hypot(q.x-v.x,q.z-v.z)<1.8&&Math.abs(v.speed)>7){var last=v._runCd[q.id];if(last==null||now-last>1){v._runCd[q.id]=now;this._damage(q,p,Math.abs(v.speed)*2.2,'véhicule');}}}
 p.x=v.x;p.z=v.z;p.y=v.y;p._lastX=p.x;p._lastZ=p.z;p.grounded=true;p.distance+=Math.abs(v.speed)*dt;
};
World.prototype._edge=function(p,e){
 if(!p.alive)return;if(e.fish)this._fish(p);if(e.surrender&&this.phase==='active'&&this.mode!=='training'&&this.mode!=='creative'){this._eliminate(p,null,'abandon');return;}
 if(e.fly&&this.mode==='creative'){p.flying=!p.flying;p.grounded=!p.flying;p.falling=false;p.gliding=false;p.jumping=false;p.airborneFromBus=false;p.autoGlider=false;p.crouching=false;p._vy=0;p._jumpTime=0;this._emit('message',p.x,p.y,p.z,{playerId:p.id,text:p.flying?'Vol activé':'Vol désactivé'});}
 if((e.deploy||e.jump)&&this.phase==='transport'&&!p.deployed){this._deployFromBus(p,false);return;}
 if(e.jump&&p.vehicleId)return;
 if(e.jump){this._cancelEmote(p);this._cancelFishing(p,'Pêche annulée');p.crouching=false;if(p.swimming){p._swimBoost=.8;this._emit('splash',p.x,SEA,p.z,{playerId:p.id,stroke:true});}else if(p.falling){p.gliding=true;p.falling=false;p.autoGlider=false;p._vy=-(p._input.sprint?FLIGHT.glideFastSink:FLIGHT.glideSink);this._emit('glide',p.x,p.y,p.z,{playerId:p.id,automatic:false});}else if(p.gliding){if(p.y-this.supportAt(p.x,p.z,p.y)<=FLIGHT.autoGliderHeight){p.autoGlider=true;this._say(p,'Planeur de sécurité : atterrissage en cours');}else{p.gliding=false;p.falling=true;p.autoGlider=false;}}else if(p.grounded&&!p.flying&&!p.jumping){p._vy=7.4;p.grounded=false;p.jumping=true;p._jumpTime=0;this._emit('jump',p.x,p.y,p.z,{playerId:p.id,ordinary:true});}else if(!p.flying&&!p.vehicleId){/* Not jumpable right now (mid-air): buffer the press. */p._jumpBuffer=.15;}return;}
 if(e.trainingItem)this.trainingGive(p.id,e.trainingItem,e.trainingRarity);
 if(e.slot!=null){p.selected=e.slot;p.useTime=0;p._useId=null;p._consumeFireHeld=false;p.reload=0;p._burstLeft=0;p._burstTimer=0;}if(e.reload)this._startReload(p);if(e.use)this._startUse(p);if(e.interact)this._interact(p);if(e.drop)this._drop(p);
 if(e.swap){var a=e.swap[0],b=e.swap[1];if(a>=0&&b>=0&&a<p.inventory.length&&b<p.inventory.length){var x=p.inventory[a];p.inventory[a]=p.inventory[b];p.inventory[b]=x;p.useTime=0;p._useId=null;p._consumeFireHeld=false;p.reload=0;p._burstLeft=0;p._burstTimer=0;}}
 if(e.build)this._build(p,e.build,e.material||'wood',e.rotation||0,e.buildLevel||0);if(e.craftVehicle)this._craftVehicle(p,e.craftVehicle,e.paint);if(e.editId)this._setEdit(p,e.editId,e.editMask);else if(e.edit)this._edit(p);if(e.demolish)this._demolish(p);if(e.emote)this._startEmote(p,e.emoteStyle||'salut');if(e.harvest)this._harvest(p);if(e.melee)this._melee(p);if(e.shoot&&p._cool<=0&&p.reload<=0&&p.useTime<=0&&(p.deployed||this.phase==='waiting')&&p.grounded&&!p.jumping&&!p.falling&&!p.gliding&&!p.swimming)this._fire(p);
};
World.prototype._houseBlocked=function(o,x,z,r,y){
 if(y!=null&&y>=o.y+o.h-.05)return false;var q=local(o,x,z),t=.42,door=1.8;
 /* Four thin shell walls: north is split around the doorway; the interior is never solid. */
 if(inRect(q.x,q.z,-(o.w+0)*0,-o.d,o.w, t,r)&&Math.abs(q.x)>door)return true;
 if(inRect(q.x,q.z,0,o.d,o.w,t,r))return true;
 if(inRect(q.x,q.z,-o.w,0,t,o.d,r)||inRect(q.x,q.z,o.w,0,t,o.d,r))return true;
 return false;
};
function buildCell(b,x,z){var q=local(b,x,z);if(b.type==='floor')return 1<<((q.z<0?0:6)+(q.x<0?0:2));var col=clamp(Math.floor((q.x+2)/(4/3)),0,2),row=clamp(Math.floor((q.z+2)/(4/3)),0,2);return 1<<(row*3+col);}
function roofTriangles(b){
 var mask=b.editMask==null?511:b.editMask,full=mask===511,bits=[0,2,8,6],corners=[[-2,0,-2],[2,0,-2],[2,0,2],[-2,0,2]];
 for(var i=0;i<4;i++)corners[i][1]=full?0:((mask&(1<<bits[i]))?0:4);
 var center=[0,full?2:corners.reduce(function(sum,c){return sum+c[1];},0)/4,0],triangles=[];
 for(i=0;i<4;i++)triangles.push([center,corners[(i+1)%4],corners[i]]);return triangles;
}
function roofHeight(b,x,z){
 var triangles=roofTriangles(b);
 for(var i=0;i<triangles.length;i++){var a=triangles[i][0],c=triangles[i][1],d=triangles[i][2],den=(c[2]-d[2])*(a[0]-d[0])+(d[0]-c[0])*(a[2]-d[2]);
 var u=((c[2]-d[2])*(x-d[0])+(d[0]-c[0])*(z-d[2]))/den,v=((d[2]-a[2])*(x-d[0])+(a[0]-d[0])*(z-d[2]))/den;
 if(u>=-.00001&&v>=-.00001&&u+v<=1.00001)return u*a[1]+v*c[1]+(1-u-v)*d[1];}return null;
}
function buildSurface(b,x,z){var q=local(b,x,z);if(b.dead||Math.abs(q.x)>2||Math.abs(q.z)>2)return null;
 if(b.type==='roof')return b.y+roofHeight(b,q.x,q.z);
 if(!((b.editMask==null?511:b.editMask)&buildCell(b,x,z)))return null;
 return b.type==='floor'?b.y:b.type==='ramp'?b.y+2-q.z:null;
}

World.prototype._spatialIndex=function(){
 if(this._staticRef===this.objects&&this._staticCount===this.objects.length)return;
 this._staticRef=this.objects;this._staticCount=this.objects.length;this._cells=new Map();
 for(var o of this.objects){var ext=(o.type==='house'?Math.hypot(o.w||1,o.d||o.w||1):(o.w||1))+2;
  for(var x=Math.floor((o.x-ext)/32);x<=Math.floor((o.x+ext)/32);x++)for(var z=Math.floor((o.z-ext)/32);z<=Math.floor((o.z+ext)/32);z++){var key=x+','+z,a=this._cells.get(key);if(!a)this._cells.set(key,a=[]);a.push(o);}}
};
World.prototype._objectsAt=function(x,z){this._spatialIndex();return this._cells.get(Math.floor(x/32)+','+Math.floor(z/32))||[];};
/* Builds change at runtime (placed, demolished, destroyed): the index rebuilds
 * only when the revision counter moves, so hot movement/collision/support
 * queries scan one cell instead of the whole build list. Results are identical. */
World.prototype._bumpBuilds=function(){this._buildsRev=(this._buildsRev|0)+1;};
World.prototype._buildIndex=function(){
 if(this._buildRef===this.builds&&this._buildRev===(this._buildsRev|0))return;
 this._buildRef=this.builds;this._buildRev=(this._buildsRev|0);this._buildCells=new Map();
 for(var b of this.builds){if(b.dead)continue;var ext=3;
  for(var x=Math.floor((b.x-ext)/16);x<=Math.floor((b.x+ext)/16);x++)for(var z=Math.floor((b.z-ext)/16);z<=Math.floor((b.z+ext)/16);z++){var key=x+','+z,a=this._buildCells.get(key);if(!a)this._buildCells.set(key,a=[]);a.push(b);}}
};
World.prototype._buildsAt=function(x,z){this._buildIndex();var c=this._buildCells.get(Math.floor(x/16)+','+Math.floor(z/16));return c||[];};
World.prototype._blocked=function(x,z,r,y,ignoreOwner,allowSea){
 
 var near=this._objectsAt(x,z);for(var i=0;i<near.length;i++){var o=near[i];if(o.dead||y!=null&&(y>=o.y+(o.h||2)+.2||y+1.8<o.y))continue;if(o.type==='house'){if(this._houseBlocked(o,x,z,r,y))return true;continue;}if(o.type==='chest'||o.type==='crate'||o.type==='lamp'||o.type==='fence'||o.type==='dock'||o.type==='prop')continue;if(Math.hypot(x-o.x,z-o.z)<(o.w||1)+r)return true;}
 /* v93 : troncs et rochers de la flore (un rocher se franchit par-dessus). */
 if(this.flora){var fl=this._floraAt(x,z);for(i=0;i<fl.length;i++){var f=fl[i];if(f.dead||y!=null&&(y>=f.y+(f.k===2?f.top-.35:f.top)||y+1.8<f.y))continue;var fr=f.k===2?f.r*.82:f.r;if((x-f.x)*(x-f.x)+(z-f.z)*(z-f.z)<(fr+r)*(fr+r))return true;}}
 var nearB=this._buildsAt(x,z);
 for(i=0;i<nearB.length;i++){var b=nearB[i];if(b.owner===ignoreOwner)continue;var q=local(b,x,z);if(b.type==='floor')continue;if(b.type==='ramp'){/* ramp is support, not a solid upright blocker */continue;}if(b.type==='wall'){if(y!=null&&(y>=b.y+4||y+1.8<=b.y))continue;if(inRect(q.x,q.z,0,0,2,.28,r)){var mask=b.editMask==null?511:b.editMask;for(var row=0;row<3;row++)for(var col=0;col<3;col++){var lo=b.y+(2-row)*4/3,hi=lo+4/3;if((y==null||y<hi-.03&&y+1.65>lo+.03)&&Math.abs(q.x-(-4/3+col*4/3))<2/3+r&&(mask&(1<<(row*3+col))))return true;}}}else if(b.type==='roof'&&y!=null&&inRect(q.x,q.z,0,0,2,2,r)){/* A roof is a walkable surface, not a wall: only block actors whose feet are below its local surface (walking under or into it). Someone standing on top must stay free to move. A roof far overhead must never block: it only collides when its surface is within body reach. */var surf=b.y+roofHeight(b,clamp(q.x,-2,2),clamp(q.z,-2,2));if(y<surf-.25&&y+1.8>surf-.25)return true;}}
 return false;
};
/* Public support query. Floors are flat; a ramp rises four units from local +Z to local -Z. */
World.prototype.supportAt=function(x,z,currentY){
 var best=heightAt(x,z),limit=currentY==null?Infinity:currentY+.8,near=this._objectsAt(x,z);
 for(var i=0;i<near.length;i++){var o=near[i];if(o.dead||o.type!=='house')continue;var q=local(o,x,z);if(Math.abs(q.x)>=o.w-.25||Math.abs(q.z)>=o.d-.25)continue;
  var floors=o.floors||1,deck=o.y+Math.max(0,Math.min(floors-1,Math.floor((limit-o.y)/4)))*4;
  if(deck<=limit&&deck>best)best=deck;
  var flat=['citadel','port','desert','observatory'].indexOf(o.style)>=0;
  var roof=o.y+o.h+(flat?.24:1.27+(o.w/2-Math.abs(q.x))*Math.tan(.28));if(roof<=limit&&roof>best)best=roof;
 }
 var nearB=this._buildsAt(x,z);
 for(i=0;i<nearB.length;i++){var h=buildSurface(nearB[i],x,z);if(h!=null&&h<=limit&&h>best)best=h;}
 /* v93 : on peut se tenir sur le dôme d'un rocher. */
 if(this.flora){var fl=this._floraAt(x,z);for(i=0;i<fl.length;i++){var f=fl[i];if(f.k!==2||f.dead)continue;var fq=Math.hypot(x-f.x,z-f.z)/(f.r*.85);if(fq<1){var fh=f.y+f.top*(1-.45*fq*fq);if(fh<=limit&&fh>best)best=fh;}}}
 return best;
};
function supportAt(x,z,builds,ground){
 var best=ground==null?heightAt(x,z):ground;for(var b of builds||[]){var h=buildSurface(b,x,z);if(h!=null&&h>best)best=h;}return best;
}
/* v93 : flore « Chapitre 1 ». Pins étagés (k=0), arbres ronds (k=1) et rochers
 * (k=2) couvrent l'île hors des villes et des routes. Ce sont de vrais obstacles :
 * collision des troncs, balles, récolte à la pioche (bois / pierre). Ils vivent
 * hors de world.objects (le rendu les instancie par morceaux) et sont indexés sur
 * une grille de 16 m. Tirage avec this.rng : identique pour une même graine. */
var FLORA_CELL=16;
function floraKey(ix,iz){return (ix+512)*1024+(iz+512);}
World.prototype._floraSpot=function(x,z,pad){
 if(coastDistance(x,z)>MAP.shoreStart-16||isWater(x,z)||heightAt(x,z)<SEA+.6)return false;
 if(routeDist(x,z)<(pad||7))return false;if(townPad(x,z,10))return false;
 if(LAKE&&Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.45)return false;
 return true;
};
World.prototype._addFlora=function(k,x,z,s,yaw){
 var y=heightAt(x,z),f;
 if(k===2)f={k:2,type:'rock',x:x,y:y,z:z,s:s,yaw:yaw,r:s*.9,top:s*1.05,hp:220,maxHp:220,material:'stone',dead:false,_flora:true};
 else if(k===0)f={k:0,type:'tree',x:x,y:y,z:z,s:s,yaw:yaw,r:.42*s,top:11*s,hp:150,maxHp:150,material:'wood',dead:false,_flora:true};
 else f={k:1,type:'tree',x:x,y:y,z:z,s:s,yaw:yaw,r:.5*s,top:8*s,hp:120,maxHp:120,material:'wood',dead:false,_flora:true};
 f.i=this.flora.length;this.flora.push(f);return f;
};
World.prototype._createFlora=function(){
 this.flora=[];this.floraRev=0;var step=11,H=MAP.halfSize,rng=this.rng;
 for(var gx=-H;gx<H;gx+=step)for(var gz=-H;gz<H;gz+=step){
  var x=gx+rng.next()*step,z=gz+rng.next()*step,roll=rng.next(),kind=rng.next(),size=rng.next(),yaw=rng.next()*TAU;
  var n=forestField(x,z),dens=.07+smoothRange(.1,1.1,n)*.62,rock=.016+smoothRange(14,40,heightAt(x,z))*.03;
  if(roll<rock){if(this._floraSpot(x,z,6))this._addFlora(2,x,z,1.1+size*size*2.6,yaw);continue;}
  if(roll>rock+dens||!this._floraSpot(x,z,7))continue;
  var pine=n>.55?kind<.74:kind<.42;
  this._addFlora(pine?0:1,x,z,pine?.85+size*.55:.8+size*.5,yaw);
 }
 this._floraIndex();
};
World.prototype._floraIndex=function(){
 var cells=this._floraCells=new Map();
 for(var i=0;i<this.flora.length;i++){var f=this.flora[i],ext=f.r+1.2;
  for(var ix=Math.floor((f.x-ext)/FLORA_CELL);ix<=Math.floor((f.x+ext)/FLORA_CELL);ix++)for(var iz=Math.floor((f.z-ext)/FLORA_CELL);iz<=Math.floor((f.z+ext)/FLORA_CELL);iz++){var key=floraKey(ix,iz),a=cells.get(key);if(!a)cells.set(key,a=[]);a.push(f);}}
};
World.prototype._floraAt=function(x,z){if(!this._floraCells){if(!this.flora)return [];this._floraIndex();}return this._floraCells.get(floraKey(Math.floor(x/FLORA_CELL),Math.floor(z/FLORA_CELL)))||[];};
World.prototype._floraRay=function(ox,oy,oz,d,max,take){
 if(!this.flora||!this.flora.length)return;var stamp=this._floraStamp=(this._floraStamp|0)+1,len=Math.min(max,260);
 for(var t=0;t<=len+8;t+=7){var px=ox+d.x*Math.min(t,len),pz=oz+d.z*Math.min(t,len),list=this._floraAt(px,pz);
  for(var i=0;i<list.length;i++){var f=list[i];if(f.dead||f._rs===stamp)continue;f._rs=stamp;
   var hw=f.k===2?f.r*.8:f.r,hh=f.k===2?f.top*.5:f.top*.5;take(rayBox(ox,oy,oz,d.x,d.y,d.z,f.x,f.y+hh,f.z,hw,hh,hw,max),{kind:'object',object:f});}}
};
World.prototype._rayObstacle=function(ox,oy,oz,d,max){
 var best=max,hit=null;
 function take(t,target){if(t!=null&&t>=0&&t<best){best=t;hit=target;}}
 for(var i=0;i<this.objects.length;i++){
  var o=this.objects[i];if(o.dead||o.type==='chest'||o.type==='lamp'||o.type==='fence'||o.type==='dock')continue;
  var hlen=d.x*d.x+d.z*d.z,nearT=hlen>1e-8?clamp(((o.x-ox)*d.x+(o.z-oz)*d.z)/hlen,0,best):0;
  var bx=o.x-ox-d.x*nearT,bz=o.z-oz-d.z*nearT,extent=Math.hypot(o.w||1,o.d||o.w||1)+1;
  if(bx*bx+bz*bz>extent*extent||Math.min(oy,oy+d.y*best)>o.y+(o.h||2)+3||Math.max(oy,oy+d.y*best)<o.y-.5)continue;
  if(o.type==='house'){
   /* Collision panels are static per house: built once, reused for every ray
    * instead of being reallocated per shot. */
   var panels=o._panels;
   if(!panels){
    panels=[{x:-(o.w+1.8)/2,y:o.y+o.h/2,z:-o.d,w:(o.w-1.8)/2,h:o.h/2,d:.42},{x:(o.w+1.8)/2,y:o.y+o.h/2,z:-o.d,w:(o.w-1.8)/2,h:o.h/2,d:.42},{x:0,y:o.y+o.h/2,z:o.d,w:o.w,h:o.h/2,d:.42}];
    /* Side walls retain collision but have two visual/LOS window openings at chest height. */
    for(var side=-1;side<=1;side+=2){panels.push({x:side*o.w,y:o.y+.55,z:0,w:.42,h:.55,d:o.d},{x:side*o.w,y:o.y+(o.h+2.6)/2,z:0,w:.42,h:Math.max(.1,(o.h-2.6)/2),d:o.d},{x:side*o.w,y:o.y+1.85,z:-(o.d+1.1)/2,w:.42,h:.75,d:(o.d-1.1)/2},{x:side*o.w,y:o.y+1.85,z:(o.d+1.1)/2,w:.42,h:.75,d:(o.d-1.1)/2});}
    panels.push({x:0,y:o.y+(o.h+2.8)/2,z:-o.d,w:1.8,h:Math.max(.05,(o.h-2.8)/2),d:.42});
    for(var fl=1;fl<=(o.floors||1);fl++)panels.push({x:0,y:o.y+Math.min(o.h,fl*4),z:0,w:o.w,h:.11,d:o.d});
    o._panels=panels;
   }
   for(var a=0;a<panels.length;a++)take(rayLocalBox(o,ox,oy,oz,d,panels[a],best),{kind:'object',object:o});
  } else {var t=rayBox(ox,oy,oz,d.x,d.y,d.z,o.x,o.y+(o.h||2)/2,o.z,o.w||1,(o.h||2)/2,o.w||1,best);take(t,{kind:'object',object:o});}
 }
 for(i=0;i<this.builds.length;i++){var b=this.builds[i];if(b.dead)continue;var mask=b.editMask==null?511:b.editMask;
  if(b.type==='wall'){for(var rr=0;rr<3;rr++)for(var cc=0;cc<3;cc++)if(mask&(1<<(rr*3+cc)))take(rayLocalBox(b,ox,oy,oz,d,{x:-4/3+cc*4/3,y:b.y+(2.5-rr)*4/3,z:0,w:2/3,h:2/3,d:.18},best),{kind:'build',build:b});}
  else if(b.type==='roof') {
   var q=local(b,ox,oz),cos=Math.cos(b.yaw||0),sin=Math.sin(b.yaw||0),rd=[d.x*cos-d.z*sin,d.y,d.x*sin+d.z*cos],ro=[q.x,oy-b.y,q.z];
   for(var triangle of roofTriangles(b)) {
    var a=triangle[0],bb=triangle[1],cc=triangle[2],e1=bb.map(function(v,i){return v-a[i];}),e2=cc.map(function(v,i){return v-a[i];});
    var cross=[rd[1]*e2[2]-rd[2]*e2[1],rd[2]*e2[0]-rd[0]*e2[2],rd[0]*e2[1]-rd[1]*e2[0]],det=e1[0]*cross[0]+e1[1]*cross[1]+e1[2]*cross[2];if(Math.abs(det)<1e-8)continue;
    var v=ro.map(function(value,i){return value-a[i];}),u=(v[0]*cross[0]+v[1]*cross[1]+v[2]*cross[2])/det;if(u<0||u>1)continue;
    var cr=[v[1]*e1[2]-v[2]*e1[1],v[2]*e1[0]-v[0]*e1[2],v[0]*e1[1]-v[1]*e1[0]],vv=(rd[0]*cr[0]+rd[1]*cr[1]+rd[2]*cr[2])/det;if(vv<0||u+vv>1)continue;
    take((e2[0]*cr[0]+e2[1]*cr[1]+e2[2]*cr[2])/det,{kind:'build',build:b});
   }
  } else {var q=local(b,ox,oz),c=Math.cos(b.yaw||0),ss=Math.sin(b.yaw||0),dx=d.x*c-d.z*ss,dz=d.x*ss+d.z*c;
   for(var sdi=0;sdi<(b.type==='roof'?2:1);sdi++){var side=b.type==='roof'?(sdi===0?-1:1):0,slope=b.type==='roof'?-side*.5:0,den=d.y+(b.type==='ramp'?dz:0)-slope*dx;
    if(Math.abs(den)<1e-8)continue;var hh=b.y+(b.type==='ramp'?2-q.z:b.type==='roof'?1+slope*q.x:0),tt=(hh-oy)/den;
    if(tt<0||tt>best)continue;var xx=q.x+dx*tt,zz=q.z+dz*tt;if(Math.abs(xx)<=2&&Math.abs(zz)<=2&&(side===0||xx*side>=0)){
     var wp=worldPoint(b,xx,zz);if(mask&buildCell(b,wp.x,wp.z))take(tt,{kind:'build',build:b});}}
  }
 }
 for(i=0;i<this.vehicles.length;i++){var v=this.vehicles[i];if(v.hp<=0)continue;take(rayBox(ox,oy,oz,d.x,d.y,d.z,v.x,v.y+1,v.z,1.35,1,2.2,best),{kind:'vehicle',vehicle:v});}
 this._floraRay(ox,oy,oz,d,best,take);
 return hit?{t:best,hit:hit}:null;
};
World.prototype._lineClear=function(x,y,z,tx,ty,tz){var dx=tx-x,dy=ty-y,dz=tz-z,L=Math.hypot(dx,dy,dz);if(!L)return true;var d={x:dx/L,y:dy/L,z:dz/L};return !this._rayObstacle(x,y,z,d,L-.05);};
/* Coarse bracket plus bisection is only used for fired projectiles, never AI LOS. */
World.prototype._terrainHit=function(x,y,z,d,max){
 var last=0,lastAbove=y-heightAt(x,z);for(var n=1;n<=12;n++){var t=max*n/12,above=y+d.y*t-heightAt(x+d.x*t,z+d.z*t);if(above<=0&&lastAbove>0){for(var j=0;j<7;j++){var mid=(last+t)/2,ma=y+d.y*mid-heightAt(x+d.x*mid,z+d.z*mid);if(ma>0)last=mid;else t=mid;}return t;}last=t;lastAbove=above;}return null;
};
World.prototype._fire=function(p){
 if(p.vehicleId)return;
 if(p._consumeFireHeld&&(p._input||{}).fire&&['heal','shield'].indexOf((p.inventory[p.selected]||{}).kind)<0)return;
 if(p.bot&&p._botBurstPause>0)return;
 this._cancelEmote(p);p._combatAt=this._clock||0;p._lastShotAt=this._clock||0;
 if(!p.grounded||p.jumping||p.falling||p.gliding||p.swimming)return;
 this._cancelFishing(p,'Pêche annulée');
 var it=p.inventory[p.selected];if(it&&(it.kind==='heal'||it.kind==='shield')){var heldFire=!!(p._input||{}).fire;if(!heldFire||!p._consumeFireHeld)this._startUse(p);if(heldFire)p._consumeFireHeld=true;return;}
 if(!it||it.kind!=='weapon'){p._cool=.2;this._harvest(p);return;}
 if(it.ammo<=0){this._startReload(p);p._cool=.15;return;}var w=weapons[it.weapon];p._cool=(w.burst&&!p.bot)?.55:1/w.rate;if(p.bot&&w.burst)p._botBurstPause=.22+this.rng.next()*.12;if(this.mode!=='creative')it.ammo--;p.useTime=0;
 var dir=this._aimAssistDir(p,(p._input.shotYaw??p.yaw),(p._input.shotPitch??p.pitch),w);
 this._shootOnce(p,it,w,dir);
 /* The burst rifle actually bursts for humans: 3 rounds, 90 ms apart. */
 if(w.burst&&!p.bot){if(it.ammo>0){p._burstLeft=w.burst-1;p._burstTimer=.09;}else p._burstLeft=0;}
};
/* Soft aim assist for human players only: bends the aim a fraction toward the
 * closest visible enemy inside a small cone (wider while aiming). This is
 * magnetism, never auto-aim: the player still has to point at the target. */
World.prototype._aimAssistDir=function(p,yaw,pitch,w){
 if(p.bot)return {yaw:yaw,pitch:pitch};
 var eye=eyeHeight(p),ex=p.x,ey=p.y+eye,ez=p.z,cone=p.aim?.14:.09,factor=p.aim?.35:.22,best=null,bestAng=cone,range=(w&&w.range||150)*1.1;
 for(var i=0;i<this.players.length;i++){var q=this.players[i];
  if(q===p||!q.alive||q.downed||q.team===p.team||!q.deployed)continue;
  var dx=q.x-ex,dy=q.y+eyeHeight(q)-ey,dz=q.z-ez,d=Math.hypot(dx,dy,dz);
  if(d>range||d<1.2)continue;
  var yawTo=Math.atan2(-dx,-dz),pitchTo=Math.asin(clamp(dy/d,-1,1)),ang=Math.hypot(normAng(yawTo-yaw),pitchTo-pitch);
  if(ang<bestAng&&this._lineClear(ex,ey,ez,q.x,q.y+eyeHeight(q),q.z)){bestAng=ang;best={yawTo:yawTo,pitchTo:pitchTo};}
 }
 if(!best)return {yaw:yaw,pitch:pitch};
 return {yaw:yaw+normAng(best.yawTo-yaw)*factor,pitch:pitch+(best.pitchTo-pitch)*factor};
};
/* One trigger pull: pellets, obstacles, players, damage and events. */
World.prototype._shootOnce=function(p,it,w,dir){
 var pellets=w.pellets||1,shotHits={},eye=eyeHeight(p);
 /* Recoil bloom: sustained fire spreads more; it decays while not firing. */
 p._recoil=clamp((p._recoil||0)+(pellets>1?.5:.22),0,1.6);
 var bloom=1+p._recoil*.55;
 for(var a=0;a<pellets;a++){
  var spread=(w.spread+(p.bot?.055:0))*(p.aim&&!w.pellets?.5:1)*(p.crouching?.8:1)*bloom,yaw=dir.yaw+(this.rng.next()-.5)*spread,pitch=dir.pitch+(this.rng.next()-.5)*spread,cy=Math.cos(pitch),d={x:-Math.sin(yaw)*cy,y:Math.sin(pitch),z:-Math.cos(yaw)*cy},range=w.range,ob=this._rayObstacle(p.x,p.y+eye,p.z,d,range),bt=ob?ob.t:range,terrain=this._terrainHit(p.x,p.y+eye,p.z,d,bt),hit=null;
  if(terrain!=null){bt=terrain;ob=null;}
  for(var j=0;j<this.players.length;j++){var q=this.players[j];if(!q.alive||q.downed||q.team===p.team||!q.deployed)continue;var qeye=eyeHeight(q),ox=q.x-p.x,oy=q.y+qeye-p.y-eye,oz=q.z-p.z,t=ox*d.x+oy*d.y+oz*d.z;if(t<0||t>bt)continue;var px=p.x+d.x*t,py=p.y+eye+d.y*t,pz=p.z+d.z*t;if(Math.hypot(px-q.x,pz-q.z)<.52&&py>=q.y&&py<q.y+(q.crouching?1.4:1.9)){bt=t;hit={player:q,x:px,y:py,z:pz,head:py>q.y+(q.crouching?1.05:1.45)};}}
  var ex=p.x+d.x*bt,ey=p.y+eye+d.y*bt,ez=p.z+d.z*bt,damage=weapons[it.weapon].damage*rarities[clamp(it.rarity|0,0,4)].multiplier;
  if(hit){if(it.weapon==='launcher')this._explode(ex,ey,ez,p,damage,it.weapon);else {var key=hit.player.id;if(!shotHits[key])shotHits[key]={player:hit.player,amount:0,headshot:false};shotHits[key].amount+=damage*(hit.head?1.8:1);shotHits[key].headshot=shotHits[key].headshot||!!hit.head;}}
  else {if(ob)this._damageHit(ob.hit,p,damage,ex,ey,ez);if(it.weapon==='launcher')this._explode(ex,ey,ez,p,damage,it.weapon);}
  this._emit('shot',p.x,p.y+eye,p.z,{playerId:p.id,weapon:it.weapon,pellet:a,endX:ex,endY:ey,endZ:ez});
 }
 for(var hk in shotHits){var sh=shotHits[hk];this._damage(sh.player,p,sh.amount,sh.headshot?'tir tête':'tir',{headshot:sh.headshot,shotgun:pellets>1,weapon:it.weapon});}
};
World.prototype._damageHit=function(hit,src,amount,x,y,z){
 var t=hit.object||hit.build||hit.vehicle;if(!t||(t.dead||t.hp<=0))return;t.hp-=amount;this._emit('hit',x,y,z,{playerId:src&&src.id,amount:amount,shieldDamage:0,hpDamage:amount,headshot:false});if(t.hp<=0){t.hp=0;if(hit.vehicle){if(t.driver){var rider=this._find(t.driver);if(rider)rider.vehicleId=null;}t.driver=null;}else {t.dead=true;if(hit.build)this._bumpBuilds();if(t._flora)this.floraRev=(this.floraRev|0)+1;}this._emit('destroy',t.x,t.y,t.z,{playerId:src&&src.id,flora:t._flora?t.i:undefined,objectId:t.id});}
};
World.prototype._damage=function(v,src,amount,why,meta){
 meta=meta||{};this._cancelFishing(v,'Pêche interrompue');this._cancelEmote(v);v._combatAt=this._clock||0;/* Bot duels are paced, not protected: 34% damage keeps their 100 HP meaningful
  * long enough for movement, cover, loot and storm decisions to matter. */
 if(src&&src.bot&&v.bot&&(meta.weapon||/tir|explosion|véhicule|corps à corps/.test(why||'')))amount*=.20;
 else if(src&&!src.bot&&v.bot&&meta.weapon)amount*=.30;
 else if(!src&&v.bot)amount*=.72;
 /* Feedback (including training/creative target practice) always interrupts a
  * timed use before any mode-specific damage rule returns early. */
 v.useTime=0;v._useId=null;
 if(!v.alive||this.phase==='waiting'||(this.mode==='training'&&!v.bot)||this.mode==='creative')return;if(src&&src.bot&&!v.bot)amount*=.48;v._aiLastDamage=this.elapsed;if(v.revivingId)this._cancelRevive(v,'Réanimation interrompue');var remain=amount,shieldDamage=0;if(v.shield){shieldDamage=Math.min(v.shield,remain);v.shield-=shieldDamage;remain-=shieldDamage;}var hpDamage=Math.min(Math.max(0,v.hp),remain);amount=shieldDamage+hpDamage;v.hp-=hpDamage;if(src){src.damage+=amount;if(meta.weapon&&weapons[meta.weapon])src.weaponDamage[meta.weapon]=(src.weaponDamage[meta.weapon]||0)+amount;this._emit('hit',v.x,v.y+1,v.z,{playerId:src.id,targetId:v.id,amount:amount,shieldDamage:shieldDamage,hpDamage:hpDamage,headshot:!!meta.headshot,weapon:meta.weapon||null});}
 if(v.hp<=0){if(this.mode==='training'&&!v.bot){v.hp=100;v.shield=0;return;}if(this.mode!=='solo'&&this._allyAlive(v)){v.hp=1;v.downed=true;v.downTimer=22;this._emit('message',v.x,v.y,v.z,{playerId:v.id,text:'À terre'});}else this._eliminate(v,src,why);}
};
World.prototype._explode=function(x,y,z,src,damage,weapon){
 this._emit('explosion',x,y,z,{playerId:src&&src.id,amount:damage});for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q.alive&&q.deployed&&(!src||q.team!==src.team)){var d=Math.hypot(q.x-x,q.y+1-y,q.z-z);if(d<8&&this._lineClear(x,y,z,q.x,q.y+1,q.z))this._damage(q,src,damage*(1-d/8),'explosion',{headshot:false,weapon:weapon});}}
 for(i=0;i<this.objects.length;i++){var o=this.objects[i];if(!o.dead&&Math.hypot(o.x-x,o.y-y,o.z-z)<7)this._damageHit({object:o},src,damage*.6,o.x,o.y,o.z);}for(i=0;i<this.builds.length;i++){var b=this.builds[i];if(!b.dead&&Math.hypot(b.x-x,b.y-y,b.z-z)<7)this._damageHit({build:b},src,damage*.6,b.x,b.y,b.z);}for(i=0;i<this.vehicles.length;i++){var v=this.vehicles[i];if(v.hp>0&&Math.hypot(v.x-x,v.y-y,v.z-z)<7)this._damageHit({vehicle:v},src,damage*.6,v.x,v.y,v.z);}
};
World.prototype._allyAlive=function(p){for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q!==p&&q.team===p.team&&q.alive&&!q.downed)return true;}return false;};
World.prototype._cancelRevive=function(p,text){if(!p||!p.revivingId)return false;var ally=this._find(p.revivingId);if(ally)ally.reviveProgress=0;p.revivingId=null;p.reviveProgress=0;if(text)this._say(p,text);return true;};
World.prototype._startRevive=function(p,ally){if(!p||!ally||p.downed||!p.alive||!ally.alive||!ally.downed||p.team!==ally.team||dist2(p,ally)>10)return false;if(p.revivingId===ally.id)return true;this._cancelRevive(p);p.revivingId=ally.id;p.reviveProgress=0;ally.reviveProgress=0;this._emit('reviveStart',ally.x,ally.y,ally.z,{playerId:p.id,targetId:ally.id,duration:3});return true;};
World.prototype._updateRevive=function(p,dt){var ally=this._find(p.revivingId),i=p._input||{};if(!ally||!ally.alive||!ally.downed||ally.team!==p.team||dist2(p,ally)>11||i.fire||Math.abs(+i.moveX||0)>.18||Math.abs(+i.moveZ||0)>.18){this._cancelRevive(p,'Réanimation annulée');return false;}p.reviveProgress=clamp(p.reviveProgress+dt/3,0,1);ally.reviveProgress=p.reviveProgress;if(p.reviveProgress<1)return true;ally.downed=false;ally.hp=35;ally.downTimer=0;ally.reviveProgress=0;ally.timesRevived++;p.revives++;var target=ally.id;p.revivingId=null;p.reviveProgress=0;this._emit('revive',ally.x,ally.y,ally.z,{playerId:p.id,targetId:target});return true;};
/* Data-only team marker contract for HUDs/network bridges. No fake presence is
 * inferred: it only reports actual roster members in this deterministic world. */
World.prototype.teamMarkers=function(id){var p=this._find(id),out=[];if(!p)return out;for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q===p||q.team!==p.team)continue;out.push({id:q.id,name:q.name,team:q.team,alive:q.alive,downed:q.downed,hp:q.hp,shield:q.shield,x:q.x,y:q.y,z:q.z,distance:Math.round(Math.hypot(q.x-p.x,q.z-p.z)),reviveProgress:q.reviveProgress||0});}return out;};
World.prototype._eliminate=function(p,killer,reason){
 if(!p.alive)return;this._cancelRevive(p);for(var ri=0;ri<this.players.length;ri++)if(this.players[ri].revivingId===p.id)this._cancelRevive(this.players[ri]);
 /* A dead driver must not lock their vehicle forever: free the seat so the vehicle stays boardable. */
 if(p.vehicleId){for(var vi=0;vi<this.vehicles.length;vi++){var vv=this.vehicles[vi];if(vv.id===p.vehicleId&&vv.driver===p.id)vv.driver=null;}p.vehicleId=null;}
 p.alive=false;p.downed=false;p.reviveProgress=0;p.gliding=false;p.falling=false;if(killer&&killer!==p)killer.kills++;this._dropAll(p);this._emit('elimination',p.x,p.y,p.z,{playerId:killer&&killer.id,targetId:p.id,text:reason||'éliminé'});this._makeResult(p,false);
};
World.prototype._dropAll=function(p){for(var i=0;i<p.inventory.length;i++){var it=p.inventory[i];this.loot.push({id:uid(this,'l'),kind:it.kind,weapon:it.weapon,rarity:it.rarity||0,ammo:it.ammo||0,reserve:it.reserve||0,count:it.count||0,gold:it.kind==='weapon'&&goldOf(p,it),x:p.x+this.rng.range(-1,1),y:p.y+.2,z:p.z+this.rng.range(-1,1),dead:false});}p.inventory=[];};
World.prototype._startReload=function(p){this._cancelEmote(p);this._cancelFishing(p,'Pêche annulée');p._burstLeft=0;p._burstTimer=0;var it=p.inventory[p.selected];if(it&&it.kind==='weapon'&&it.ammo<weapons[it.weapon].clip&&it.reserve>0&&p.reload<=0){p.reload=weapons[it.weapon].reload;p.useTime=0;this._emit('reload',p.x,p.y,p.z,{playerId:p.id,weapon:it.weapon});}};
World.prototype._finishReload=function(p){var it=p.inventory[p.selected];if(!it||it.kind!=='weapon')return;var n=Math.min(weapons[it.weapon].clip-it.ammo,it.reserve);it.ammo+=n;it.reserve-=n;};
World.prototype._startUse=function(p){if(!p.alive||p.downed||!p.grounded||p.jumping||p.falling||p.gliding||p.swimming||p.flying||p.vehicleId)return false;this._cancelEmote(p);var it=p.inventory[p.selected];if(it&&((it.kind==='heal'&&p.hp>=100)||(it.kind==='shield'&&p.shield>=100))){this._say(p,it.kind==='heal'?'Santé déjà au maximum':'Bouclier déjà au maximum');return false;}if(it&&(it.kind==='heal'||it.kind==='shield')&&it.count>0&&p.useTime<=0){this._cancelFishing(p,'Pêche annulée');p.useTime=it.kind==='heal'?2.7:2.2;p._useId=it.id;p._useX=p.x;p._useZ=p.z;this._emit('use',p.x,p.y,p.z,{playerId:p.id,kind:it.kind,duration:p.useTime});return true;}return false;};
World.prototype._finishUse=function(p){var it=p.inventory[p.selected];if(!it||it.id!==p._useId||!it.count)return;p.useTime=0;p._useId=null;it.count--;if(it.kind==='heal')p.hp=Math.min(100,p.hp+45);else p.shield=Math.min(100,p.shield+35);this._emit('heal',p.x,p.y,p.z,{playerId:p.id});if(!it.count)p.inventory.splice(p.selected,1);/* A consumed last-slot item must not leave the selection pointing past the end. */p.selected=Math.min(p.selected,Math.max(0,p.inventory.length-1));};
World.prototype._has=function(p,k){return p.inventory.some(function(x){return x.kind===k&&x.count>0;});};
World.prototype._lootWorthwhile=function(p,it){
 if(it.kind==='weapon')return !p.inventory.some(function(x){return x&&x.kind==='weapon'&&x.weapon===it.weapon&&(x.rarity||0)>=(it.rarity||0);});
 return !p.inventory.some(function(x){return x&&x.kind===it.kind&&x.count>0;});
};
var vehicleSpecs={
 car:{name:'Berline',maxSpeed:24,reverseSpeed:7,accel:22,brake:31,drag:.8},
 van:{name:'Fourgon',maxSpeed:18,reverseSpeed:6,accel:15,brake:25,drag:.9},
 buggy:{name:'Buggy',maxSpeed:29,reverseSpeed:9,accel:30,brake:34,drag:.65},
 boat:{name:'Bateau',maxSpeed:25,reverseSpeed:7,accel:17,brake:24,drag:.45},
 sport:{name:'Coupé sport',maxSpeed:34,reverseSpeed:10,accel:36,brake:40,drag:.6}
};
World.prototype._vehicleSpace=function(v,ignoreId,boat){
 var samples=[[0,0],[-1,0],[1,0],[-1,-1.8],[1,-1.8],[-1,1.8],[1,1.8]];
 for(var i=0;i<samples.length;i++){
  var q=worldPoint(v,samples[i][0],samples[i][1]);
  if(isWater(q.x,q.z)!==!!boat||this._blocked(q.x,q.z,.4,v.y,null,boat))return false;
 }
 for(i=0;i<this.vehicles.length;i++){var other=this.vehicles[i];if(other.id!==ignoreId&&other.hp>0&&Math.hypot(other.x-v.x,other.z-v.z)<2.8)return false;}
 return true;
};
World.prototype.canCraftVehicle=function(p,type){
 var f=p&&forward(p.yaw||0,0),placement=p?{x:Math.round((p.x+f.x*7)*2)/2,z:Math.round((p.z+f.z*7)*2)/2,y:0,yaw:p.yaw||0}:null,cost=80;
 if(!p||['car','buggy','sport'].indexOf(type)<0)return {ok:false,reason:'type',placement:placement,cost:cost};
 if(!p.alive||p.downed||!p.deployed||!p.grounded||p.swimming||p.jumping||p.falling||p.gliding||p.flying||p.vehicleId)return {ok:false,reason:'grounded',placement:placement,cost:cost};
 if(coastDistance(placement.x,placement.z)>=MAP.shoreEnd)return {ok:false,reason:'water',placement:placement,cost:cost};
 placement.y=heightAt(placement.x,placement.z)+.35;
 if(this.mode!=='creative'&&(!p.mats||p.mats.metal<cost))return {ok:false,reason:'materials',placement:placement,cost:cost};
 if(this.vehicles.filter(function(v){return v.hp>0;}).length>=20)return {ok:false,reason:'limit',placement:placement,cost:cost};
 if((this._clock||0)<(p._craftAt||0))return {ok:false,reason:'cooldown',placement:placement,cost:cost};
 if(!this._vehicleSpace(placement,null,false)||this.vehicles.some(function(v){return v.hp>0&&Math.hypot(v.x-placement.x,v.z-placement.z)<4;}))return {ok:false,reason:'blocked',placement:placement,cost:cost};
 return {ok:true,reason:'ok',placement:placement,cost:cost};
};
World.prototype._craftVehicle=function(p,type,paint){
 var check=this.canCraftVehicle(p,type);if(!check.ok){this._say(p,{materials:'Métal insuffisant',water:'Garage requis sur la terre',limit:'Limite de véhicules atteinte',cooldown:'Garage en cours'}[check.reason]||'Véhicule impossible');return false;}
 if(this.mode!=='creative')p.mats.metal-=check.cost;p._craftAt=(this._clock||0)+1.2;var b=check.placement,v={id:uid(this,'v'),type:type,x:b.x,y:b.y,z:b.z,yaw:b.yaw,speed:0,fuel:100,hp:350,maxHp:350,driver:null,owner:p.id,paint:/^#[0-9a-f]{6}$/i.test(paint||'')?paint.toLowerCase():'#4d91d4'};this.vehicles.push(v);this._emit('craftVehicle',v.x,v.y,v.z,{playerId:p.id,vehicleId:v.id,vehicleType:type,paint:v.paint,cost:this.mode==='creative'?0:check.cost});return true;
};
World.prototype._exitVehicle=function(p,v){
 var offsets=[{x:2.6,z:0},{x:-2.6,z:0},{x:0,z:3.1},{x:0,z:-3.1}],boat=v.type==='boat';
 for(var i=0;i<offsets.length;i++){var q=worldPoint(v,offsets[i].x,offsets[i].z),y=heightAt(q.x,q.z),water=isWater(q.x,q.z),clearVehicle=this.vehicles.every(function(other){return other===v||other.hp<=0||Math.hypot(other.x-q.x,other.z-q.z)>2.2;});
  /* A boat may always be abandoned in open water: the driver swims out. Land vehicles still require solid ground. */
  if((!water||boat)&&clearVehicle&&!this._blocked(q.x,q.z,.48,y)){v.driver=null;p.vehicleId=null;p.x=q.x;p.z=q.z;p.y=water?SEA-.72:y;p._lastX=q.x;p._lastZ=q.z;p.swimming=water&&boat;p.grounded=!p.swimming;p._vy=0;p._vx=0;p._vz=0;return true;}}
 this._say(p,'Sortie bloquée');return false;
};
World.prototype._interact=function(p){
 if(p.vehicleId){for(var vi=0;vi<this.vehicles.length;vi++)if(this.vehicles[vi].id===p.vehicleId)return this._exitVehicle(p,this.vehicles[vi]);p.vehicleId=null;return;}
 var ally=this._downedAlly(p);if(ally&&dist2(p,ally)<10){return this._startRevive(p,ally);}
 for(var i=0;i<this.loot.length;i++){var l=this.loot[i];if(!l.dead&&dist2(p,l)<9&&Math.abs(p.y-l.y)<2.5){var got=l.kind==='weapon'?makeInv(l.weapon,l.rarity):{kind:l.kind,rarity:l.rarity,ammo:0,reserve:0,count:l.count,id:l.id};if(got.kind==='weapon'){got.ammo=l.ammo;got.reserve=l.reserve;got.id=l.id;got.gold=goldOf(p,l);got._damage=weapons[got.weapon].damage*rarities[got.rarity].multiplier;}if(p.bot&&p.inventory.length>=5&&!this._lootWorthwhile(p,got))continue;if(p.inventory.length<5)p.inventory.push(got);else {var old=p.inventory[p.selected];p.inventory[p.selected]=got;p._burstLeft=0;p._burstTimer=0;this.loot.push({id:uid(this,'l'),kind:old.kind,weapon:old.weapon,gold:old.kind==='weapon'&&goldOf(p,old),rarity:old.rarity||0,ammo:old.ammo||0,reserve:old.reserve||0,count:old.count||0,x:p.x,y:p.y+.2,z:p.z,dead:false});}l.dead=true;this._emit('loot',l.x,l.y,l.z,{playerId:p.id});return;}}
 for(i=0;i<this.objects.length;i++){var o=this.objects[i];if(o.type==='chest'&&!o.opened&&!o.dead&&dist2(p,o)<12&&Math.abs(p.y-o.y)<2.5&&this._lineClear(p.x,p.y+1.2,p.z,o.x,o.y+1,o.z)){o.opened=true;p.chests++;this._dropLoot(o.x,o.y+.4,o.z,true);this._emit('loot',o.x,o.y,o.z,{playerId:p.id});return;}}
 for(i=0;i<this.vehicles.length;i++){var v=this.vehicles[i];if(!v.driver&&v.hp>0&&dist2(p,v)<12&&Math.abs(p.y-v.y)<2.5){v.driver=p.id;p.vehicleId=v.id;p.yaw=v.yaw;p.jumping=p.falling=p.gliding=p.flying=false;p._vy=0;p._vx=0;p._vz=0;return;}}
};
World.prototype._drop=function(p){var it=p.inventory[p.selected];if(!it)return;p.useTime=0;p._useId=null;p._consumeFireHeld=false;p._burstLeft=0;p._burstTimer=0;this.loot.push({id:uid(this,'l'),kind:it.kind,weapon:it.weapon,rarity:it.rarity||0,ammo:it.ammo||0,reserve:it.reserve||0,count:it.count||0,gold:it.kind==='weapon'&&goldOf(p,it),x:p.x,y:p.y+.2,z:p.z,dead:false});p.inventory.splice(p.selected,1);p.selected=Math.min(p.selected,Math.max(0,p.inventory.length-1));};
World.prototype._harvest=function(p){
 /* Harvesting is an on-foot activity: never from the driver seat. */
 if(p.vehicleId||(!p.deployed&&this.phase!=='waiting')||!p.grounded||p.jumping||p.falling||p.gliding||p.swimming||p._harvestCool>0)return;
 this._cancelFishing(p,'Pêche annulée');p._harvestCool=.42;this._emit('harvest',p.x,p.y+1,p.z,{playerId:p.id});
 if(this._meleeTarget(p,20))return;
 var f=forward(p.yaw,p.pitch*.4),hit=this._rayObstacle(p.x,p.y+1.05,p.z,f,3.2),o=hit&&hit.hit.object;
 if(!o||o.dead)return;this._damageHit({object:o},p,24,p.x+f.x*hit.t,p.y+1,p.z+f.z*hit.t);
 var mat=o.material||'wood';p.gathered+=8;p.mats[mat]=(p.mats[mat]||0)+8;if(o.dead)p.mats[mat]+=16;
};
World.prototype._meleeTarget=function(p,damage){var f=forward(p.yaw,0),best=null,bd=2.7;
 for(var q of this.players){if(!q.alive||q.downed||q.team===p.team||!q.deployed||Math.abs(q.y-p.y)>1.8)continue;var dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);if(d<bd&&(dx*f.x+dz*f.z)/(d||1)>.2&&this._lineClear(p.x,p.y+1,p.z,q.x,q.y+1,q.z)){best=q;bd=d;}}
 if(best){this._damage(best,p,damage,'corps à corps');return true;}return false;
};
World.prototype._melee=function(p){this._cancelEmote(p);this._cancelFishing(p,'Pêche annulée');if(p.vehicleId||!p.grounded||!p.deployed||p._harvestCool>0)return;p._harvestCool=.6;this._emit('melee',p.x,p.y+1,p.z,{playerId:p.id});this._meleeTarget(p,25);};
function buildPlacement(p,type,rotation,level){
 var r=((rotation|0)%4+4)%4,relative=Number.isInteger(level)&&level>=-1&&level<=1?level:0,base=Math.round((p.yaw||0)/(Math.PI/2))*Math.PI/2,yaw=normAng(base+r*Math.PI/2),f=forward(p.yaw||0,0),reach=(type==='ramp'||type==='floor'||type==='roof')?2:4,x=Math.round((p.x+f.x*reach)/2)*2,z=Math.round((p.z+f.z*reach)/2)*2;
 /* p.y is authoritative support (including the top of an existing ramp), never
  * raw ground. A forward ramp therefore begins under the player's feet and
  * rises four metres over its four metre length. */
 return {x:x,y:Math.round((p.y+relative*4)*2)/2,z:z,yaw:yaw,rotation:r,type:type,buildLevel:relative};
}
World.prototype._say=function(p,text){if(!p.bot)this._emit('message',p.x,p.y,p.z,{playerId:p.id,text:text});};
World.prototype.buildPlacement=function(p,type,rotation,level){
 var b=buildPlacement(p,type,rotation,level),relative=Number.isInteger(level)?level:0;
 if(!p.grounded)return b;
 /* Prefer the piece that physically supports the player. This turns a loose
  * world grid into a structural snap: walls land on an edge, ramps start at an
  * edge and flat pieces continue on the same four-metre module. */
 var support=null,best=Infinity,surface=0;
 for(var i=0;i<this.builds.length;i++){
  var q=this.builds[i];if(q.dead)continue;
  var at=local(q,p.x,p.z),top=q.type==='ramp'?q.y+2-at.z:q.y,inside=Math.abs(at.x)<=2.2&&Math.abs(at.z)<=2.2;
  var delta=Math.abs(p.y-top);if(inside&&delta<.9&&delta<best){support=q;best=delta;surface=top;}
 }
 if(support){
  var face=forward(b.yaw,0),targetX=b.x,targetZ=b.z;
  if(type==='wall'){
   b.x=support.x+face.x*2;b.z=support.z+face.z*2;b.y=support.y+relative*4;b.snap='edge';
  }else if(type==='ramp'){
   b.x=support.x+face.x*2;b.z=support.z+face.z*2;b.y=support.y+relative*4;b.snap='edge';
  }else if(relative){
   b.x=support.x;b.z=support.z;b.y=support.y+relative*4;b.snap='level';
  }else{
   var axes=[[4,0],[-4,0],[0,4],[0,-4]],pick=axes[0],pickD=Infinity;
   for(var a=0;a<axes.length;a++){var cx=support.x+axes[a][0],cz=support.z+axes[a][1],d=(cx-targetX)*(cx-targetX)+(cz-targetZ)*(cz-targetZ);if(d<pickD){pickD=d;pick=axes[a];}}
   b.x=support.x+pick[0];b.z=support.z+pick[1];b.y=support.y;b.snap='module';
  }
 }
 /* A ramp can also continue another ramp cleanly from its exact high edge. */
 if(type==='ramp'&&support&&support.type==='ramp'&&!relative){
  var uphill=forward(support.yaw,0),facing=forward(p.yaw,0),aligned=uphill.x*facing.x+uphill.z*facing.z>.6;
  if(aligned&&Math.abs(normAng(b.yaw-support.yaw))<.1){b.x=support.x+uphill.x*4;b.z=support.z+uphill.z*4;b.y=support.y+4;b.snap='ramp-chain';}
 }
 b.x=Math.round(b.x*2)/2;b.z=Math.round(b.z*2)/2;b.y=Math.round(b.y*2)/2;
 return b;
};
World.prototype._buildOverlap=function(b){
 for(var i=0;i<this.builds.length;i++){
  var q=this.builds[i];if(q.dead)continue;
  var dx=Math.abs(q.x-b.x),dz=Math.abs(q.z-b.z),dy=Math.abs(q.y-b.y);
  /* Floor/wall/ramp combinations are intentional; only like pieces duplicate.
   * A previous broad AABB veto prevented an ordinary wall beside a floor. */
  if(q.type!==b.type)continue;
  if(b.type==='wall'){
   if(dy<2.9&&Math.abs(normAng((q.yaw||0)-(b.yaw||0)))%Math.PI<.05){var at=local(q,b.x,b.z);if(Math.abs(at.x)<3.95&&Math.abs(at.z)<.35)return true;}
  }else if(dx<3.9&&dz<3.9&&dy<(b.type==='ramp'?3.9:.2))return true;
 }
 return false;
};
World.prototype.canBuild=function(p,type,mat,rotation,level){
 var placement=p&&this.buildPlacement(p,type,rotation,level);if(!p||['wall','floor','ramp','roof'].indexOf(type)<0)return {ok:false,reason:'type',placement:placement};
 if(!Number.isInteger(level==null?0:level)||(level!=null&&(level<-1||level>1)))return {ok:false,reason:'level',placement:placement};
 if(['wood','stone','metal'].indexOf(mat)<0)return {ok:false,reason:'material',placement:placement};
 if(!p.deployed&&this.phase!=='waiting')return {ok:false,reason:'not-deployed',placement:placement};
 if((!p.alive||p.downed||p.vehicleId||!p.grounded||p.jumping||p.falling||p.gliding||p.swimming)&&!(this.mode==='creative'&&p.flying&&p.alive&&!p.downed&&!p.vehicleId))return {ok:false,reason:'airborne',placement:placement};
 if(this.mode!=='creative'&&(!p.mats||p.mats[mat]<10))return {ok:false,reason:'materials',placement:placement};
 if(this.mode!=='creative'&&coastDistance(placement.x,placement.z)>MAP.shoreStart+20)return {ok:false,reason:'outside-island',placement:placement};
 if(this._buildOverlap(placement))return {ok:false,reason:'duplicate',placement:placement};
 /* _blocked catches object shells and walls; _buildOverlap above handles flat
  * floors/ramps which intentionally do not block movement. */
 if(Math.abs(placement.y-p.y)>4.2||this._blocked(placement.x,placement.z,.1,placement.y,p.id))return {ok:false,reason:'blocked',placement:placement};
 return {ok:true,reason:'ok',placement:placement};
};
World.prototype._build=function(p,type,mat,rotation,level){
 this._cancelEmote(p);this._cancelFishing(p,'Pêche annulée');var check=this.canBuild(p,type,mat,rotation,level);if(!check.ok){var msg={type:'materials',materials:'Ressources insuffisantes','outside-island':'Construction hors de l’île',duplicate:'Pièce déjà construite',level:'Étage invalide'}[check.reason]||'Construction impossible';return this._say(p,msg);}
 var b=check.placement;if(this.mode!=='creative')p.mats[mat]-=10;p._harvestCool=.05;var hp=buildHP(mat);this.builds.push({id:uid(this,'b'),owner:p.id,type:type,material:mat,x:b.x,y:b.y,z:b.z,yaw:b.yaw,rotation:b.rotation,buildLevel:b.buildLevel,hp:hp,maxHp:hp,edited:false,editMask:511,dead:false});this._bumpBuilds();p.built++;this._emit('build',b.x,b.y,b.z,{playerId:p.id,type:type,rotation:b.rotation,buildLevel:b.buildLevel});
};
/* `editId` + `editMask` is both the exact 3x3 edit contract and the repair
 * action: an all-on mask repairs the owned, damaged piece using the same
 * material (up to the original 10-unit build price). */
World.prototype._setEdit=function(p,id,mask){for(var i=0;i<this.builds.length;i++){var b=this.builds[i];if(b.id===id){var owner=this._find(b.owner),allied=b.owner===p.id||owner&&owner.team===p.team;if(!allied||b.dead||p.vehicleId||!Number.isInteger(mask)||mask<0||mask>511||dist2(p,b)>625||Math.abs((p.y||0)-b.y)>8){this._say(p,'Édition impossible');return false;}/* Une modification, y compris le rétablissement à 511, ne soigne jamais la pièce et ne coûte aucune ressource. */b.editMask=mask;b.edited=mask!==511;this._emit('edit',b.x,b.y,b.z,{playerId:p.id,buildId:b.id,editMask:mask,type:b.type});return true;}}this._say(p,'Pièce introuvable');return false;};
World.prototype._edit=function(p){if(p.vehicleId){this._say(p,'Édition impossible');return;}
 /* Prefer the owned piece the player is actually facing: distance plus an
  * aim penalty, so editing picks the intended piece instead of the closest. */
 var best=null,bestScore=Infinity,f=forward(p.yaw,0);
 for(var i=0;i<this.builds.length;i++){var b=this.builds[i];if(b.owner!==p.id||b.dead)continue;var d2=dist2(p,b);if(d2>=25||Math.abs((p.y||0)-b.y)>=8)continue;var d=Math.sqrt(d2)||1,dot=((b.x-p.x)*f.x+(b.z-p.z)*f.z)/d,score=d2+(1-clamp(dot,-1,1))*30;if(score<bestScore){bestScore=score;best=b;}}
 if(!best){this._say(p,'Aucune pièce à éditer');return;}
 this._setEdit(p,best.id,best.editMask===511?(511 & ~(1<<4) & ~(1<<7)):511);};
World.prototype._demolish=function(p){if(p.vehicleId){this._say(p,'Aucune pièce à démolir');return false;}var best=null,bd=64;for(var i=0;i<this.builds.length;i++){var b=this.builds[i],d=dist2(p,b);if(b.owner===p.id&&!b.dead&&d<bd){best=b;bd=d;}}if(!best){this._say(p,'Aucune pièce à démolir');return false;}best.dead=true;this._bumpBuilds();this._emit('demolish',best.x,best.y,best.z,{playerId:p.id,buildId:best.id});return true;};
World.prototype._region=function(p){var r=nearestRegion(p.x,p.z);if(Math.hypot(p.x-regions[r].x,p.z-regions[r].z)<115&&p.regions.indexOf(regions[r].name)<0)p.regions.push(regions[r].name);};
World.prototype._storm=function(dt){
 var s=this.storm;s.timer-=dt;
 if(this._stormState==='shrink'){var progress=clamp(1-s.timer/this._stormDuration,0,1);s.radius=this._stormFrom+(s.nextRadius-this._stormFrom)*progress;s.x=this._stormStartX+(s.nextX-this._stormStartX)*progress;s.z=this._stormStartZ+(s.nextZ-this._stormStartZ)*progress;}
 if(s.timer<=0){
  if(this._stormState==='wait'){
   this._stormState='shrink';this._stormDuration=65;s.timer=65;this._stormFrom=s.radius;this._stormStartX=s.x;this._stormStartZ=s.z;var nr=s.phase>=5?0:Math.max(0,s.radius-(s.phase===0?220:180));var room=Math.max(0,s.radius-nr-8),a=this.rng.next()*TAU,rr=this.rng.range(0,room);s.nextX=s.x+Math.cos(a)*rr;s.nextZ=s.z+Math.sin(a)*rr;s.nextRadius=nr;this._emit('phase',s.x,0,s.z,{text:'Contraction '+(s.phase+1)});
  } else {s.x=s.nextX;s.z=s.nextZ;s.radius=s.nextRadius;s.phase++;s.damage=Math.min(18,s.damage+1.7);this._stormState='wait';this._stormDuration=s.phase>=6?15:55;s.timer=this._stormDuration;this._emit('phase',s.x,0,s.z,{text:'Tempête '+s.phase});}
 }
 for(var i=0;i<this.players.length;i++){var p=this.players[i],outside=Math.hypot(p.x-s.x,p.z-s.z)>s.radius;/* A zero-radius final eye is lethal even at its mathematical centre, so a stalled end is impossible. */if(p.alive&&(outside||(s.phase>=6&&s.radius<=0)))this._damage(p,null,s.damage*dt,s.phase>=6?'tempête finale':'tempête');}
};
World.prototype._checkEnd=function(){
 if(this.mode==='training'||this.mode==='creative'||this.mode==='event')return;var active={};for(var i=0;i<this.players.length;i++){var p=this.players[i];if(p.alive&&!p.downed)active[p.team]=1;}
 /* A fully downed team is wiped before determining the surviving-team count. */
 for(i=0;i<this.players.length;i++){p=this.players[i];if(p.alive&&p.downed&&!active[p.team])this._eliminate(p,null,'équipe éliminée');}
 active={};for(i=0;i<this.players.length;i++)if(this.players[i].alive)active[this.players[i].team]=1;var teams=Object.keys(active);if(teams.length<=1){if(!this._finishedAt)this._finishedAt=new Date().toISOString();for(i=0;i<this.players.length;i++)if(this.players[i].alive)this._makeResult(this.players[i],true);this.phase='ended';this.phaseTime=0;this._emit('phase',0,0,0,{text:'ended'});}
};
World.prototype._makeResult=function(p,won){
 if(p.result)return p.result;var rank=1,seen={};for(var i=0;i<this.players.length;i++){var q=this.players[i];if(q.alive&&q.team!==p.team&&!seen[q.team]){seen[q.team]=1;rank++;}}
 var finishedAt=this._finishedAt||new Date().toISOString(),r={id:this._matchId+'-'+p.id,rank:rank,kills:p.kills,duration:Math.round(this.elapsed*100)/100,finishedAt:finishedAt,date:finishedAt.slice(0,10),xp:Math.round(50+p.kills*40+Math.max(0,100-rank)*2),won:!!won,mode:this.mode,damage:Math.round(p.damage),weaponDamage:Object.assign({},p.weaponDamage),distance:Math.round(p.distance),chests:p.chests,gathered:p.gathered,built:p.built,regions:p.regions.length,regionNames:p.regions.slice(),revived:p.revives,timesRevived:p.timesRevived};p.result=r;this.results[p.id]=r;return r;
};

World.prototype.setCreativeBots=function(count){if(this.mode!=='creative')return {ok:false,count:0,message:'Mode créatif requis'};count=Number.isInteger(count)?clamp(count,0,100):-1;if(count<0)return {ok:false,count:0,message:'Nombre invalide'};var bots=this.players.filter(function(p){return p.bot;});while(bots.length<count){var p=player(this,'creative-bot-'+uid(this,'cb'),'IA créative',true,bots.length+1);this._spawnActive(p);this.players.push(p);bots.push(p);}while(bots.length>count){var b=bots.pop(),ix=this.players.indexOf(b);if(ix>=0)this.players.splice(ix,1);}return {ok:true,count:bots.length,message:'Bots créatifs réglés'};};
World.prototype.creativeGive=function(id,key,rarity){if(this.mode!=='creative')return false;var p=this._find(id),r=clamp(rarity==null?4:rarity,0,4),wk;if(!p||typeof key!=='string')return false;for(wk in weapons)if(weapons[wk].name===key)key=wk;if(key==='soin')key='heal';if(key==='bouclier')key='shield';var it;if(weapons[key])it=makeInv(key,r);else if(key==='heal'||key==='shield')it={kind:key,count:99,id:'creative-'+key+'-'+uid(this,'g')};else return false;p.inventory[p.selected]=it;return true;};
/* Training-only quick item API. It replaces the selected one of the five
 * inventory slots; it never appends a hidden sixth slot or affects BR/creative. */
World.prototype.trainingGive=function(id,key,rarity){if(this.mode!=='training')return false;var p=this._find(id),r=rarity==null?2:rarity,alias={soin:'heal',bouclier:'shield'};if(!p||!p.alive||typeof key!=='string'||!Number.isInteger(r)||r<0||r>4)return false;key=alias[key.toLowerCase()]||key.toLowerCase();for(var wk in weapons)if(weapons[wk].name.toLowerCase()===key)key=wk;var it;if(weapons[key])it=makeInv(key,r);else if(key==='heal'||key==='shield')it={kind:key,count:3,id:'training-'+key+'-'+uid(this,'g')};else return false;var slot=Number.isInteger(p.selected)&&p.selected>=0&&p.selected<5?p.selected:0;/* Never leave null holes: an out-of-range selection appends instead of creating sparse slots that crash swap/_has. */if(slot>p.inventory.length)slot=p.inventory.length;p.inventory[slot]=it;if(p.inventory.length>5)p.inventory.length=5;this._emit('trainingItem',p.x,p.y,p.z,{playerId:p.id,key:key,rarity:r,slot:slot});return true;};
World.prototype.exportBuilds=function(id){var p=this._find(id);if(!p)return null;return {version:1,owner:id,builds:this.builds.filter(function(b){return !b.dead&&b.owner===id;}).map(function(b){return {type:b.type,material:b.material,x:b.x,y:b.y,z:b.z,yaw:b.yaw,rotation:b.rotation||0,buildLevel:b.buildLevel||0,editMask:b.editMask==null?511:b.editMask};})};};
World.prototype.importBuilds=function(id,data){if(this.mode!=='creative')return {ok:false,count:0,message:'Mode créatif requis'};var p=this._find(id),arr=data&&data.version===1&&Array.isArray(data.builds)?data.builds:null;if(!p||!arr||arr.length>1500)return {ok:false,count:0,message:'Plan invalide'};var add=[];for(var i=0;i<arr.length;i++){var q=arr[i];if(!q||['wall','floor','ramp','roof'].indexOf(q.type)<0||['wood','stone','metal'].indexOf(q.material)<0||!finite(q.x)||!finite(q.y)||!finite(q.z)||!finite(q.yaw)||Math.abs(q.yaw)>TAU*2||q.rotation!=null&&(!Number.isInteger(q.rotation)||q.rotation<0||q.rotation>3)||q.buildLevel!=null&&(!Number.isInteger(q.buildLevel)||q.buildLevel<-1||q.buildLevel>1)||!Number.isInteger(q.editMask)||q.editMask<0||q.editMask>511||q.y<-20)return {ok:false,count:0,message:'Plan invalide'};add.push(q);}for(i=0;i<add.length;i++){q=add[i];this.builds.push({id:uid(this,'b'),owner:id,type:q.type,material:q.material,x:Math.round(q.x*2)/2,y:Math.round(q.y*2)/2,z:Math.round(q.z*2)/2,yaw:q.yaw,rotation:q.rotation||0,buildLevel:q.buildLevel||0,hp:buildHP(q.material),maxHp:buildHP(q.material),edited:q.editMask!==511,editMask:q.editMask,dead:false});}this._bumpBuilds();return {ok:true,count:add.length,message:'Plan importé'};};
World.prototype.clearBuilds=function(id){if(this.mode!=='creative')return false;var n=0;for(var i=0;i<this.builds.length;i++)if(this.builds[i].owner===id&&!this.builds[i].dead){this.builds[i].dead=true;n++;}if(n>0)this._bumpBuilds();return n;};
World.prototype.teleport=function(id,x,z){
 var p=this._find(id);if(this.mode!=='creative'||!p||!finite(x)||!finite(z)||Math.abs(x)>MAP.halfSize||Math.abs(z)>MAP.halfSize)return false;
 this._cancelFishing(p,'Pêche annulée');
 if(p.vehicleId)for(var v of this.vehicles)if(v.id===p.vehicleId&&v.driver===p.id)v.driver=null;
 p.vehicleId=null;p.x=x;p.z=z;p.y=heightAt(x,z);p._lastX=x;p._lastZ=z;
 /* A ground teleport must not retain a jump, glider, or flight from the old location. */
 p.flying=false;p.jumping=false;p.falling=false;p.gliding=false;p.airborneFromBus=false;p.autoGlider=false;p.crouching=false;
 p.swimming=playerWater(x,z);if(p.swimming)p.y=SEA-.72;p.grounded=!p.swimming;p._vy=0;p._jumpTime=0;p._input={};p.useTime=0;p._useId=null;
 p._vx=0;p._vz=0;p._coyote=0;p._jumpBuffer=0;p._recoil=0;p._burstLeft=0;p._burstTimer=0;
 return true;
};

World.prototype.snapshot=function(){function clean(a){return a.map(function(o){var q={};for(var k in o)if(k.charAt(0)!=='_')q[k]=o[k];return q;});}return {mode:this.mode,seed:this.seed,phase:this.phase,phaseTime:this.phaseTime,elapsed:this.elapsed,tick:this.tick,players:clean(this.players),objects:clean(this.objects),loot:clean(this.loot),builds:clean(this.builds),vehicles:clean(this.vehicles),storm:Object.assign({},this.storm),aircraft:Object.assign({},this.aircraft),results:Object.assign({},this.results),events:this.events.slice()};};
var api={World:World,MATCH_PARTICIPANTS:MATCH_PARTICIPANTS,FLIGHT:FLIGHT,EMOTE_STYLES:EMOTE_STYLES,MAP:MAP,heightAt:heightAt,biomeAt:biomeAt,zoneAt:zoneAt,zoneWeights:zoneWeights,VOLCANO:VOLCANO,LOBES:LOBES,LAKE:LAKE,isWater:isWater,coastDistance:coastDistance,regions:regions,roads:roads,streets:streets,districts:districtDensity,districtGrid:districtGrid,vehicleSpecs:vehicleSpecs,weapons:weapons,rarities:rarities,BUILD_DURABILITY:BUILD_DURABILITY,buildPlacement:buildPlacement,supportAt:supportAt,buildSurface:buildSurface,roofTriangles:roofTriangles,forestField:forestField,routeDist:routeDist,townPad:townPad,s8:MAPD?{river:RIVER,fords:FORDS,meteor:METEOR_SITE,launch:LAUNCH_SITE,peak:PEAK,spot:SPOT_S8,riverDist:riverDist}:null};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AZSim=api;
})(typeof globalThis!=='undefined'?globalThis:this);
