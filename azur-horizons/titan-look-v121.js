/* AZUR v121 — l'apparence du Titan (mode « Gant du Titan »). Design original : un colosse à la peau de roche sombre
 * veinée d'énergie turquoise, armure de bronze (plastron, épaulières, ceinture, brassards), couronne de cristaux, éclats
 * de cristal sur les épaules, et le Gant du Titan à la main droite (bronze et obsidienne, un seul gros cristal d'énergie,
 * pointes sur les jointures). L'armure est accrochée aux os du personnage : elle suit toutes ses animations.
 * AZTitanLook.dress(inst) habille une instance de personnage (ch1-models), AZTitanLook.undress(inst) l'enlève,
 * AZTitanLook.gauntlet() fabrique le gant seul (le gant posé au sol, la météorite). */
(function (root) {
  "use strict";
  var T = root.THREE; if (!T) return;
  // réglages : couleurs
  var C = { rock: 0x3b4149, rockDeep: 0x23272d, bronze: 0xb07a3a, bronzeDark: 0x6e4a24, obsidian: 0x15171c, glow: 0x3ff2e0 };
  var M = null;
  function mats() {
    if (M) return M;
    M = {
      bronze: new T.MeshStandardMaterial({ color: C.bronze, metalness: .85, roughness: .32 }),
      bronzeDark: new T.MeshStandardMaterial({ color: C.bronzeDark, metalness: .8, roughness: .45 }),
      obsidian: new T.MeshStandardMaterial({ color: C.obsidian, metalness: .3, roughness: .25 }),
      crystal: new T.MeshStandardMaterial({ color: C.glow, emissive: C.glow, emissiveIntensity: 1.6, metalness: .1, roughness: .15, transparent: true, opacity: .92 }),
      vein: new T.MeshBasicMaterial({ color: C.glow, toneMapped: false })
    };
    return M;
  }
  var _m = new T.Matrix4(), _p = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3(), _e = new T.Euler();
  /* pose un objet sur un os, décrit dans le repère du personnage (Y haut, Z devant) relativement à l'os */
  function attach(model, bone, obj, off, rot, fwd) {
    model.updateMatrixWorld(true);
    var inv = new T.Matrix4().copy(model.matrixWorld).invert();
    var bw = new T.Matrix4().multiplyMatrices(inv, bone.matrixWorld); // os dans le repère du personnage
    var bp = new T.Vector3().setFromMatrixPosition(bw);
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    var want = new T.Matrix4().compose(new T.Vector3(bp.x + off[0], bp.y + off[1], bp.z + off[2] * fwd), _q.setFromEuler(_e), obj.scale.clone());
    var local = new T.Matrix4().copy(bw).invert().multiply(want);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    obj.userData.azTitan = true; bone.add(obj);
    return obj;
  }
  /* pose un objet le long d'un membre : son axe -Y va de l'os A vers l'os B ; t = position sur le segment (0 = A, 1 = B),
   * out = décalage perpendiculaire vers l'avant (repère du personnage) */
  function attachAlong(model, A, Bn, obj, t, out, fwd, spin) {
    model.updateMatrixWorld(true);
    var inv = new T.Matrix4().copy(model.matrixWorld).invert();
    var pa = new T.Vector3().setFromMatrixPosition(new T.Matrix4().multiplyMatrices(inv, A.matrixWorld));
    var pb = new T.Vector3().setFromMatrixPosition(new T.Matrix4().multiplyMatrices(inv, Bn.matrixWorld));
    var dir = pb.clone().sub(pa).normalize(), pos = pa.clone().lerp(pb, t);
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, -1, 0), dir);
    if (spin) q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), spin));
    if (out) { var f = new T.Vector3(0, 0, fwd); f.addScaledVector(dir, -f.dot(dir)).normalize(); pos.addScaledVector(f, out); }
    var want = new T.Matrix4().compose(pos, q, obj.scale.clone());
    var bw = new T.Matrix4().multiplyMatrices(inv, A.matrixWorld);
    new T.Matrix4().copy(bw).invert().multiply(want).decompose(obj.position, obj.quaternion, obj.scale);
    obj.userData.azTitan = true; A.add(obj); return obj;
  }
  function mesh(g, m, sx, sy, sz) { var o = new T.Mesh(g, m); if (sx != null) o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); o.castShadow = true; o.frustumCulled = false; return o; }

  /* Le Gant du Titan : repère du gant, doigts vers -Y (main pendante), dos de la main vers +Z */
  function gauntlet(scale) {
    var mt = mats(), g = new T.Group(); g.name = "titan-gauntlet";
    g.add(mesh(new T.CylinderGeometry(.058, .046, .15, 16), mt.bronze).translateY(.07));         // brassard du gant, évasé
    g.add(mesh(new T.TorusGeometry(.048, .01, 8, 20), mt.bronzeDark).rotateX(Math.PI / 2).translateZ(.005)); // bague du poignet
    var palm = mesh(new T.SphereGeometry(1, 16, 12), mt.obsidian, .052, .062, .03); palm.position.set(0, -.055, 0); g.add(palm);
    var back = mesh(new T.SphereGeometry(1, 16, 12), mt.bronze, .05, .056, .016); back.position.set(0, -.052, .022); g.add(back);
    var core = mesh(new T.OctahedronGeometry(.026, 0), mt.crystal); core.position.set(0, -.05, .038); core.scale.set(1, 1.3, .6); g.add(core); g.userData.core = core;
    for (var i = 0; i < 4; i++) { // doigts arrondis et petites pointes des jointures
      var x = -.033 + i * .022, f = mesh(new T.CapsuleGeometry(.0095, .05, 4, 8), mt.obsidian); f.position.set(x, -.135, .004); g.add(f);
      var sp = mesh(new T.ConeGeometry(.007, .022, 6), mt.bronze); sp.position.set(x, -.1, .03); sp.rotation.x = Math.PI / 2; g.add(sp);
    }
    var th = mesh(new T.CapsuleGeometry(.011, .035, 4, 8), mt.obsidian); th.position.set(.055, -.07, .012); th.rotation.z = -.6; g.add(th);
    for (var v = 0; v < 3; v++) { var ln = mesh(new T.BoxGeometry(.004, .07, .003), mt.vein); ln.position.set(-.022 + v * .022, .075, .057); ln.rotation.x = -.08; g.add(ln); }
    if (scale) g.scale.setScalar(scale);
    return g;
  }

  function dress(inst, opts) {
    opts = opts || {};
    if (!inst || !inst.model || !inst.bones || inst.model.userData.azTitan) return false;
    var B = inst.bones, model = inst.model, mt = mats();
    // sens « devant » du personnage : la pointe du pied est devant la cheville
    var fwd = 1; try { var a = new T.Vector3(), b = new T.Vector3(); B.foot_l.getWorldPosition(a); B.ball_l.getWorldPosition(b); var inv = new T.Matrix4().copy(model.matrixWorld).invert(); a.applyMatrix4(inv); b.applyMatrix4(inv); fwd = b.z >= a.z ? 1 : -1; } catch (e) {}
    var saved = [];
    model.userData.azTitanSaved = saved;
    var add = function (bone, obj, off, rot) { return B[bone] ? attach(model, B[bone], obj, off, rot, fwd) : null; };
    // le gant, main droite (il remplace la main : la main d'origine reste dessous)
    var gl = gauntlet(1); // le gant recouvre la main droite, dans l'axe de l'avant-bras, et suit la main
    if (B.lowerarm_r && B.hand_r) { attachAlong(model, B.lowerarm_r, B.hand_r, gl, 1.06, 0, fwd); B.hand_r.attach(gl); }
    model.userData.azTitan = true; model.userData.azTitanGauntlet = gl;
    return true;
  }
  function undress(inst) {
    if (!inst || !inst.model || !inst.model.userData.azTitan) return;
    var rm = []; inst.model.traverse(function (o) { if (o.userData.azTitan && o.parent && o.parent.isBone) rm.push(o); });
    rm.forEach(function (o) { o.parent.remove(o); });
    (inst.model.userData.azTitanSaved || []).forEach(function (s) { s[0].material = s[1]; });
    inst.model.userData.azTitan = false; inst.model.userData.azTitanSaved = null; inst.model.userData.azTitanGauntlet = null;
  }
  /* trois tenues de Titan (système de tenues de ch1-models-v93 : haut, bas, chaussures, gants, accessoires, lueur) */
  var LOOKS = {
    "char-titan-obsidienne": { body: "m", skin: "#5a4a40", hair: null, t: { c: "#2b3036", c2: "#1a1d21", sleeve: "long", pat: "armor" }, b: { c: "#23272c", pat: "armor" }, s: { c: "#15181b", sole: "#3ff2e0" }, g: { c: "#15181b" }, belt: "#b07a3a", buckle: "#3ff2e0", glow: { c: "#3ff2e0", pat: 1, k: 1.1 }, gear: ["boots"], acc: ["helmet:#2b3036:#b07a3a", "goggles:#2b3036:#3ff2e0", "kneepads:#b07a3a"] },
    "char-titan-bronze": { body: "m", skin: "#5a4a40", hair: null, t: { c: "#b0743a", c2: "#6e4a24", sleeve: "long", pat: "armor" }, b: { c: "#1d2440", pat: "armor" }, s: { c: "#6e4a24", sole: "#ff8a2a" }, g: { c: "#6e4a24" }, belt: "#1d2440", buckle: "#ff8a2a", glow: { c: "#ff8a2a", pat: 1, k: .8 }, gear: ["boots"], acc: ["knight:#b0743a:#6e4a24:#ff8a2a", "kneepads:#6e4a24"] },
    "char-titan-glace": { body: "m", skin: "#5a4a40", hair: null, t: { c: "#e8eef4", c2: "#9fb2c6", sleeve: "long", pat: "armor" }, b: { c: "#c9d6e2", pat: "armor" }, s: { c: "#9fb2c6", sole: "#5fd8ff" }, g: { c: "#9fb2c6" }, belt: "#2c4a6e", buckle: "#5fd8ff", glow: { c: "#5fd8ff", pat: 1, k: 1 }, gear: ["boots"], acc: ["spikes:#e8eef4", "kneepads:#9fb2c6"] }
  };
  root.AZ_EXTRA_LOOKS = Object.assign(root.AZ_EXTRA_LOOKS || {}, LOOKS);
  root.AZTitanLook = { dress: dress, undress: undress, gauntlet: gauntlet, colors: C, SCALE: 1.8 };
})(typeof globalThis !== "undefined" ? globalThis : this);
