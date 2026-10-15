/* AZUR v66 — rendu cartoon.
 *  - ÉTALONNAGE : couleurs plus vives et plus contrastées (filtre du canvas,
 *    calculé par le compositeur du navigateur : aucun passage de rendu en plus) ;
 *  - LUMIÈRE : soleil plus chaud et plus franc, ciel et brume plus colorés ;
 *  - CONTOURS : chaque personnage proche reçoit un liseré sombre (coque
 *    inversée), la signature des jeux cartoon. Les personnages lointains
 *    (modèle « low ») n'en ont pas, pour garder le même coût de rendu ;
 *  - en qualité ultra, contours aussi sur tout le décor (passe de
 *    profondeur plein écran).
 * Qualité « basse » : rien n'est appliqué. */
(function (root) {
  'use strict';
  const T = root.THREE, V = root.AZView?.View?.prototype, A = root.AZArt;
  if (!T || !V) return;

  const GRADE = 'saturate(1.3) contrast(1.07) brightness(1.02)';
  let outlinesOn = true;

  // Coque inversée : mêmes sommets poussés le long de la normale, faces
  // arrière seulement, couleur encre. Un seul matériau partagé.
  const outlineMaterial = new T.MeshBasicMaterial({ color: '#141a2a', side: T.BackSide });
  outlineMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.016;');
  };
  outlineMaterial.customProgramCacheKey = () => 'azur-outline';
  function addOutlines(group) {
    const meshes = [];
    group.traverse((node) => { if (node.isMesh && !node.userData.outline && node.geometry?.attributes?.normal && !(node.material?.transparent)) meshes.push(node); });
    for (const mesh of meshes) {
      const hull = new T.Mesh(mesh.geometry, outlineMaterial);
      hull.userData.outline = true; hull.userData.shared = true; hull.castShadow = false; hull.receiveShadow = false; hull.renderOrder = -1;
      hull.raycast = () => {};
      mesh.add(hull);
    }
  }
  if (A && typeof A.avatar === 'function') {
    const baseAvatar = A.avatar;
    A.avatar = function (eq = {}, detail = eq.detail) {
      const group = baseAvatar.call(this, eq, detail);
      if (outlinesOn && detail !== 'low') {
        // Les accessoires changeants (arme, outil, planeur, plan) gardent leur rendu d'origine.
        const u = group.userData, skip = new Set([u.gun, u.tool, u.glider, u.blueprint, u.rod].filter(Boolean));
        for (const child of [...group.children]) if (!skip.has(child)) addOutlines(child);
      }
      return group;
    };
    if (root.AZView) root.AZView.avatar = A.avatar;
  }

  // Qualité « ultra » : passe plein écran qui trace aussi les
  // contours du décor (bâtiments, arbres, constructions) à partir de la
  // profondeur. La scène est rendue dans une cible multi-échantillonnée qui se
  // comporte comme l'écran (les matériaux gardent leur tonemapping).
  const postVertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const postFragment = [
    '#include <packing>',
    'varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 texel;uniform float cameraNear,cameraFar,outline;',
    'float viewZ(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,cameraNear,cameraFar);}',
    'void main(){vec4 base=texture2D(tColor,vUv);',
    ' float zc=viewZ(vUv),zl=viewZ(vUv-vec2(texel.x,0.)),zr=viewZ(vUv+vec2(texel.x,0.)),zu=viewZ(vUv+vec2(0.,texel.y)),zd=viewZ(vUv-vec2(0.,texel.y));',
    ' float zmin=min(min(min(zl,zr),min(zu,zd)),zc);',
    ' float lap=max(abs(zl+zr-2.*zc),abs(zu+zd-2.*zc))/max(zmin,.1);',
    ' float edge=clamp(lap*10.-.22,0.,1.)*(1.-smoothstep(45.,420.,zmin))*outline*.8;',
    ' gl_FragColor=vec4(mix(base.rgb,base.rgb*vec3(.16,.14,.2),edge),base.a);',
    ' #include <colorspace_fragment>',
    '}'
  ].join('\n');
  function installPost(view) {
    if (view.toonPost) return view.toonPost;
    const renderer = view.renderer, original = renderer.render, size = new T.Vector2();
    const target = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    target.isXRRenderTarget = true; target.texture.colorSpace = T.LinearSRGBColorSpace;
    target.depthTexture = new T.DepthTexture(4, 4); target.depthTexture.type = T.UnsignedIntType;
    const material = new T.ShaderMaterial({ vertexShader: postVertex, fragmentShader: postFragment, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: target.texture }, tDepth: { value: target.depthTexture }, texel: { value: new T.Vector2() }, cameraNear: { value: .1 }, cameraFar: { value: 1000 }, outline: { value: 1 } } });
    material.toneMapped = false;
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), material); quad.frustumCulled = false;
    const postScene = new T.Scene(); postScene.add(quad);
    const postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const post = view.toonPost = { enabled: false, failed: false };
    renderer.render = function (scene, camera) {
      if (!post.enabled || post.failed || scene === postScene || renderer.getRenderTarget() !== null || !camera?.isPerspectiveCamera) return original.call(this, scene, camera);
      try {
        renderer.getDrawingBufferSize(size);
        if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
        renderer.setRenderTarget(target); original.call(this, scene, camera); renderer.setRenderTarget(null);
        const u = material.uniforms; u.texel.value.set(1 / size.x, 1 / size.y); u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
        u.outline.value = scene === view.menuScene ? .85 : 1;
        original.call(this, postScene, postCamera);
      } catch (e) { post.failed = true; renderer.setRenderTarget(null); return original.call(this, scene, camera); }
    };
    return post;
  }

  function relight(view) {
    view.hemi.color.set('#cdeeff'); view.hemi.groundColor.set('#86b356'); view.hemi.intensity = 2.25;
    view.sun.color.set('#fff0c8'); view.sun.intensity = 3.1;
    view.skyFill.color.set('#8fe3ff'); view.skyFill.intensity = .42;
    view.fogDay.set('#a9dcff');
  }
  const previousConfigure = V.configure;
  V.configure = function (settings = {}) {
    const r = previousConfigure.call(this, settings);
    if (!this.toonLit) { relight(this); this.toonLit = true; }
    const on = this.quality !== 'low' && settings.cartoon !== false;
    this.canvas.style.filter = on ? GRADE : '';
    installPost(this).enabled = on && this.quality === 'ultra';
    outlinesOn = on;
    return r;
  };
})(window);
