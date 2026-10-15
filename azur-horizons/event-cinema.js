(function (root) {
'use strict';
var E = root.AZEvent, T = root.THREE;
if (!E || !T) return;
var api, renderer, originalRender, wrapper, finaleScene, finaleCamera, alive = false, bound = false;
var look = new T.Vector3(), cameraTarget = new T.Vector3(), cameraBack = new T.Vector3(), baseFov = 60;
var surfaceRay = new T.Raycaster(), surfaceOrigin = new T.Vector3(), surfaceDown = new T.Vector3(0, -1, 0), surfaceHits = [];
function setMode() {
  document.body.dataset.eventCamera = 'free';
  E.emit('camera:mode', { mode: 'free' });
}
function renderMeteorRide(renderer, render, scene, camera) {
  var p = api && api.player(), meteor = E.eventVisuals && E.eventVisuals.meteor;
  if (!p || !p._meteorRide || !meteor) return render.call(renderer, scene, camera);
  var yaw = p.yaw || 0, pitch = Math.max(-1.3, Math.min(1.3, p.pitch || 0));
  // Vue troisième personne stable : l’approche de la faille ne doit jamais
  // transformer la caméra en zoom de deuxième personne.
  var insideRift = E.riftWorld && E.riftWorld.active;
  var distance = insideRift ? 9 : 8;
  cameraTarget.set(p.x, p.y + (p.crouching ? 1.04 : 1.5), p.z);
  cameraBack.set(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camera.position.copy(cameraTarget).addScaledVector(cameraBack, distance);
  camera.position.x += Math.cos(yaw) * .5; camera.position.z -= Math.sin(yaw) * .5;
  // Keep the orbit above the actual rocky surface, even when looking upward.
  meteor.group.updateWorldMatrix(true, true);
  surfaceOrigin.set(camera.position.x, meteor.group.position.y + (E.meteorVisR || 44) * 2, camera.position.z);
  surfaceRay.set(surfaceOrigin, surfaceDown); surfaceRay.far = (E.meteorVisR || 44) * 3;
  surfaceHits.length = 0; surfaceRay.intersectObject(meteor.rock, false, surfaceHits);
  if (surfaceHits.length) camera.position.y = Math.max(camera.position.y, surfaceHits[0].point.y + .5);
  look.copy(cameraTarget).addScaledVector(cameraBack, -100); camera.lookAt(look);
  // FOV constant pour éviter l’effet de zoom quand la météorite entre dans la faille.
  var fov = insideRift ? 68 : 66;
  if (Math.abs(camera.fov - fov) > .02) { camera.fov = fov; camera.updateProjectionMatrix(); }
  var tailVisible = meteor.fireTail.visible, sheathVisible = meteor.sheath.visible, haloVisible = meteor.halo.visible;
  meteor.fireTail.visible = meteor.sheath.visible = meteor.halo.visible = false;
  try { return render.call(renderer, scene, camera); }
  finally {
    meteor.fireTail.visible = tailVisible; meteor.sheath.visible = sheathVisible; meteor.halo.visible = haloVisible;
  }
}
function init(a) {
  api = a; alive = true; renderer = a.renderer(); baseFov = a.camera().fov;
  finaleScene = new T.Scene(); finaleScene.background = new T.Color(0x000000); finaleScene.name = 'azur-final-singularity';
  finaleCamera = new T.PerspectiveCamera(48, a.camera().aspect, .1, 4000);
  originalRender = renderer.render;
  wrapper = function (scene, cam) {
    if (alive && E.active && scene === api.scene()) {
      if (E.applyEventSky) E.applyEventSky();
    }
    if (alive && E.active && E.riftWorld && E.riftWorld.active && scene === api.scene() && cam === api.camera()) {
      return E.riftWorld.render(this, originalRender, cam);
    }
    if (alive && E.active && !E.FILM_PLAY && ['allgone', 'blackhole', 'numbers', 'end'].indexOf(E.state) !== -1 && scene === api.scene() && cam === api.camera()) {
      var singularity = scene.getObjectByName('azevent-blackhole'), parent = singularity && singularity.parent;
      var at = E.anchors.blackhole || E.zeroPointPos || api.center;
      if (finaleCamera.aspect !== cam.aspect) { finaleCamera.aspect = cam.aspect; finaleCamera.updateProjectionMatrix(); }
      finaleCamera.position.set(at.x, at.y + 7, at.z + 260); finaleCamera.lookAt(at);
      if (singularity) { finaleScene.add(singularity); singularity.lookAt(finaleCamera.position); }
      try { return originalRender.call(this, finaleScene, finaleCamera); }
      finally { if (singularity && parent) parent.add(singularity); }
    }
    if (alive && E.active && scene === api.scene() && cam === api.camera()) {
      return renderMeteorRide(this, originalRender, scene, cam);
    }
    return originalRender.apply(this, arguments); };
  renderer.render = wrapper;
  if (!bound) { bound = true; E.on('camera:mode:set', function () { if (alive) setMode(); }); }
  setMode();
}
function dispose() {
  alive = false; if (renderer && renderer.render === wrapper) renderer.render = originalRender; var camera = api && api.camera(); if (camera) { camera.fov = baseFov; camera.updateProjectionMatrix(); }
  delete document.body.dataset.eventCamera; api = renderer = originalRender = wrapper = finaleScene = finaleCamera = null;
}
E.cineMode = function () { return 'free'; }; E.setCineMode = setMode;
E.renderMeteorRide = renderMeteorRide;
E.register('cinedir', { init: init, dispose: dispose });
})(window);
