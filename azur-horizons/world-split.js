/* AZUR v71 — déformation du monde pendant THE END.
 * Chargé juste après three.js, avant toute création de matière : chaque
 * matière intégrée de three.js (sol, maisons, arbres, routes, joueurs…)
 * reçoit trois uniformes partagés qui permettent, dans le vertex shader :
 *  - de CREUSER une tranchée le long d'une ligne (le laser du Point Zéro),
 *  - d'ÉCARTER et d'incliner la moitié de l'île située d'un côté de la ligne,
 *  - d'EFFONDRER des villes entières (bâtiments écrasés, sol calciné).
 * Tant que l'événement ne l'active pas (azB.w = 0), le calcul s'arrête au
 * premier test : aucun coût visible en partie normale.
 * Les avatars, armes et contours (matières « rigides ») bougent d'un bloc avec
 * leur moitié d'île au lieu d'être déformés. */
(function (root) {
  'use strict';
  var T = root.THREE;
  if (!T || !T.Material || T.Material.prototype._azSplit) return;
  var P = T.Material.prototype;
  P._azSplit = true;

  var U = {
    azA: { value: new T.Vector4(0, 0, 1, 0) },   // centre x, z ; normale de la ligne nx, nz
    azB: { value: new T.Vector4(-1e5, 0, 0, 0) }, // avancée du laser, écart (m), inclinaison (rad), actif
    azC: { value: new T.Vector4(-1e5, 1e5, 0, 0) }, // tranchée creusée entre along min et max, temps, lueur
    azZ: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] }, // villes : x, z, rayon, effondrement
    azH: { value: new T.Vector4() },               // hauteur du sol de chaque ville
    azD: { value: new T.Vector4() }                // rotation de la moitié : angle, pivot x, pivot z
  };
  var RIGID = { 'v48-hero': 1, 'azur-outline': 1, 'azur-gold-67': 1 };

  var DECL = [
    'uniform vec4 azA; uniform vec4 azB; uniform vec4 azC; uniform vec4 azZ[4]; uniform vec4 azH; uniform vec4 azD;',
    'varying float vAzGlow; varying float vAzBurn;',
    // Effondrement des villes (dans les coordonnées d'origine).
    'vec3 azCollapse(vec3 w, out float burn){ burn=0.;',
    '  for(int i=0;i<4;i++){ vec4 z=azZ[i]; if(z.w<=0.) continue; float dd=length(w.xz-z.xy);',
    '    float f=(1.-smoothstep(z.z*.55,z.z,dd))*z.w; if(f<=0.) continue; float h0=azH[i];',
    '    float above=max(0.,w.y-h0); w.y=h0+above*(1.-f*.9)-f*1.2*step(.5,above);',
    '    w.x+=sin(w.y*1.7+w.z*.3)*f*above*.12; w.z+=cos(w.y*1.3+w.x*.3)*f*above*.12;',
    '    burn=max(burn,f*(1.-smoothstep(z.z*.9,z.z*1.15,dd))); }',
    '  return w; }',
    // Ligne de coupe + moitié qui s'écarte.
    'vec3 azSplitPos(vec3 w, bool carve, out float glow){ glow=0.;',
    '  vec2 rel=w.xz-azA.xy; float d=dot(rel,azA.zw); float a=dot(rel,vec2(-azA.w,azA.z));',
    '  float mask=(1.-smoothstep(230.,320.,w.y))*(1.-smoothstep(1150.,1350.,length(rel)));',
    '  if(mask<=0.) return w;',
    '  vec3 o=w;',
    '  if(carve){',
    '    float cut=step(azC.x,a)*step(a,azC.y)*smoothstep(26.,44.,length(rel));',
    '    float band=1.-smoothstep(5.,19.,abs(d));',
    '    float jag=sin(a*.37)*3.+sin(a*.11+1.)*5.+sin(a*.9)*1.5;',
    '    float sink=band*cut*mask;',
    '    o.y-=sink*(46.+jag);',
    '    glow=cut*mask*(1.-smoothstep(3.,26.,abs(d)))*azC.w;',
    '  }',
    '  float side=smoothstep(-1.5,1.5,d)*mask;',
    '  float py=o.y+25.; float tl=azB.z*side; float cs=cos(tl), sn=sin(tl);',
    '  float nd=d*cs-py*sn; float ny=d*sn+py*cs;',
    '  o.xz+=azA.zw*((nd-d)+azB.y*side);',
    '  o.y=mix(o.y,ny-25.,side)-side*azB.y*.06;',
    '  float yw=azD.x*side; vec2 pr=o.xz-azD.yz; float c2=cos(yw), s2=sin(yw);',
    '  o.xz=azD.yz+vec2(pr.x*c2-pr.y*s2, pr.x*s2+pr.y*c2);',
    '  return o; }'
  ].join('\n');

  var PROJ = [
    'vec4 mvPosition = vec4( transformed, 1.0 );',
    '#ifdef USE_INSTANCING',
    '  mvPosition = instanceMatrix * mvPosition;',
    '#endif',
    'vAzGlow=0.; vAzBurn=0.;',
    'if(azB.w>.5){',
    '  vec4 azW = modelMatrix * mvPosition; float gl0;',
    '  azW.xyz = azCollapse(azW.xyz, vAzBurn);',
    '  azW.xyz = azSplitPos(azW.xyz, true, gl0); vAzGlow=gl0;',
    '  mvPosition = viewMatrix * azW;',
    '} else { mvPosition = modelViewMatrix * mvPosition; }',
    'gl_Position = projectionMatrix * mvPosition;'
  ].join('\n');

  var PROJ_RIGID = [
    'vec4 mvPosition = vec4( transformed, 1.0 );',
    '#ifdef USE_INSTANCING',
    '  mvPosition = instanceMatrix * mvPosition;',
    '#endif',
    'vAzGlow=0.; vAzBurn=0.;',
    'if(azB.w>.5){',
    '  vec4 azW = modelMatrix * mvPosition; vec3 org = (modelMatrix * vec4(0.,0.,0.,1.)).xyz; float gl0;',
    '  azW.xyz += azSplitPos(org, false, gl0) - org;',
    '  mvPosition = viewMatrix * azW;',
    '} else { mvPosition = modelViewMatrix * mvPosition; }',
    'gl_Position = projectionMatrix * mvPosition;'
  ].join('\n');

  var FRAG_DECL = 'varying float vAzGlow; varying float vAzBurn; uniform vec4 azC;\n';
  var FRAG = [
    'gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb*vec3(.22,.17,.16)+vec3(.05,.01,0.), clamp(vAzBurn,0.,1.)*.88);',
    '{ float g=clamp(vAzGlow,0.,1.); float fl=.8+.2*sin(azC.z*9.+gl_FragCoord.x*.05);',
    '  gl_FragColor.rgb += (vec3(1.,.42,.12)*g*g*2.4 + vec3(.5,.85,1.)*pow(g,6.)*2.)*fl; }',
    '#include <dithering_fragment>'
  ].join('\n');

  function isRigid(mat) {
    if (mat.userData && mat.userData.azRigid) return true;
    if (Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey')) {
      try { return !!RIGID[mat.customProgramCacheKey()]; } catch (e) { return false; }
    }
    return false;
  }
  function patch(shader, mat) {
    var vs = shader.vertexShader;
    if (typeof vs !== 'string' || vs.indexOf('#include <project_vertex>') < 0) return;
    shader.uniforms.azA = U.azA; shader.uniforms.azB = U.azB; shader.uniforms.azC = U.azC;
    shader.uniforms.azZ = U.azZ; shader.uniforms.azH = U.azH; shader.uniforms.azD = U.azD;
    shader.vertexShader = DECL + '\n' + vs.replace('#include <project_vertex>', isRigid(mat) ? PROJ_RIGID : PROJ);
    var fs = shader.fragmentShader;
    if (typeof fs === 'string' && fs.indexOf('#include <dithering_fragment>') >= 0) {
      shader.fragmentShader = FRAG_DECL + fs.replace('#include <dithering_fragment>', FRAG);
    }
  }

  // onBeforeCompile devient un accesseur : la fonction d'une matière (vent de
  // l'herbe, façades, héros…) s'exécute d'abord, puis notre patch.
  Object.defineProperty(P, 'onBeforeCompile', {
    configurable: true,
    get: function () {
      if (!Object.prototype.hasOwnProperty.call(this, '_azOBC')) {
        var self = this;
        Object.defineProperty(this, '_azOBC', { value: function (shader, renderer) {
          if (self._azUser) self._azUser.call(self, shader, renderer);
          patch(shader, self);
        }, enumerable: false });
      }
      return this._azOBC;
    },
    set: function (fn) { Object.defineProperty(this, '_azUser', { value: fn, writable: true, configurable: true, enumerable: false }); }
  });
  P.customProgramCacheKey = function () {
    return (this._azUser ? this._azUser.toString() : '') + (isRigid(this) ? '|azR' : '|az');
  };

  root.AZSplit = { uniforms: U, version: 1 };
})(window);
