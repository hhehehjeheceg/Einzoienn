// One camera for the whole film: smooth splines through keyed values, every move has a reason.
import * as THREE from "three";
import { CUES } from "./cues.js";
import { clamp, prog, io, in3, out3, out5, deg, keys } from "./lib.js";
import { V, W } from "./world.js";
import { LC } from "./s12.js";

// Catmull-Rom through [t, v] keys with non-uniform knots (velocity continuous, no stop at each key)
export function spline(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  const n = ks.length;
  if (t >= ks[n - 1][0]) return ks[n - 1][1];
  let i = 0;
  while (t > ks[i + 1][0]) i++;
  const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
  const m = (j) => {
    if (j <= 0 || j >= n - 1) return ks[j][2] ?? 0;
    return (ks[j + 1][1] - ks[j - 1][1]) / (ks[j + 1][0] - ks[j - 1][0]);
  };
  const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m(i) + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m(i + 1);
}

const sph = (c, r, az, el) => V(c.x + r * Math.cos(el) * Math.sin(az), c.y + r * Math.sin(el), c.z + r * Math.cos(el) * Math.cos(az));

export function makeCamera(title, ui) {
  const C2 = CUES.s2, C3 = CUES.s3, C4 = CUES.s4, C5 = CUES.s5, C6 = CUES.s6;
  const D = title.dCenter, O3 = ui.O;
  const lab = W.lab.clone().add(V(0, 0.3, 0));
  const Ct = W.climax;

  function titleCam(t) {
    const az = t < 3 ? keys(t, [[0, deg(12)], [3, deg(32)]], (x) => x) : spline(t, [[3, deg(32), deg(13) / 1], [4.9, deg(-8)], [5.6, deg(0)], [7, deg(1)]]);
    const r = spline(t, [[0, 15.5], [3, 10.6], [5.0, 9.4], [6.75, 8.95], [7.0, 9.15]]);
    const el = spline(t, [[0, deg(7)], [3, deg(4)], [5, deg(2)], [7, deg(1.5)]]);
    const look = V(0, keys(t, [[4.5, LC.y], [5.4, 0.12]]), 0);
    const pos = sph(look, r, az, el);
    // impact shake at the shock
    const sr = t - C2.shock;
    if (sr > 0 && sr < 0.6) { const k = 0.06 * Math.exp(-sr * 7); pos.x += Math.sin(sr * 71) * k; pos.y += Math.cos(sr * 53) * k; }
    return { pos, look, fov: 35, roll: 0 };
  }

  function camAt(t) {
    // ---- scenes 1-2
    if (t < C3.dive) return titleCam(t);
    // ---- dive into the D, then arrival in the interface space
    if (t < 8.3) {
      const start = titleCam(C3.dive);
      const cross = V(D.x, D.y, D.z - 0.05);
      const arrive = O3.clone().add(V(-3.4, 0.45, 9.6));
      let pos, fov, look;
      if (t < C3.cross) {
        const e = in3(prog(t, C3.dive, C3.cross));
        pos = start.pos.clone().lerp(cross, e);
        look = start.look.clone().lerp(V(D.x, D.y, D.z - 6), smooth01(prog(t, C3.dive, C3.dive + 0.25)));
        fov = 35 + 27 * e;
      } else {
        const e = out5(prog(t, C3.cross, 8.3));
        pos = cross.clone().lerp(arrive, e);
        look = V(D.x, D.y, D.z - 6).lerp(O3.clone().add(V(-2.2, 0.2, 0)), out3(prog(t, C3.cross, 8.1)));
        fov = 62 - 20 * out3(prog(t, C3.cross, 8.1));
      }
      return { pos, look, fov, roll: deg(4) * Math.sin(Math.PI * prog(t, C3.dive, 7.9)) };
    }
    // ---- trucking along the windows
    if (t < C3.whip) {
      const x = spline(t, [[8.3, -3.4], [11.72, 6.2, 3.4]]);
      const pos = O3.clone().add(V(x, 0.45 + 0.12 * Math.sin(t * 0.9), spline(t, [[8.3, 9.6], [11.72, 8.8]])));
      const look = O3.clone().add(V(x + spline(t, [[8.3, 1.2], [9.5, 0.6], [11.72, 1.4]]), 0.2, 0));
      return { pos, look, fov: 42, roll: 0 };
    }
    const labCam = (t) => {
      const az = spline(t, [[12.0, deg(20), deg(80)], [13.9, deg(150)], [15.3, deg(215)], [16.6, deg(262)], [17.0, deg(272)]]);
      const r = spline(t, [[12.0, 11.5, -5], [13.9, 9.0], [15.3, 5.9], [16.6, 7.0], [17.0, 0.7, -40]]);
      const el = spline(t, [[12.0, deg(14)], [13.9, deg(10)], [15.3, deg(-3)], [16.6, deg(15)], [17.0, deg(5)]]);
      return { pos: sph(lab, r, az, el), look: lab.clone(), fov: 40 + 30 * in3(prog(t, 16.6, 17.0)), roll: deg(-6) * Math.sin(Math.PI * prog(t, 13.9, 15.3)) };
    };
    // ---- whip into the lab
    if (t < C4.core) {
      const a = camAt(C3.whip - 1e-4), b = labCam(C4.core);
      const e = ioExp(prog(t, C3.whip, C4.core));
      return { pos: a.pos.clone().lerp(b.pos, e), look: a.look.clone().lerp(b.look, smooth01(prog(t, C3.whip, C4.core))), fov: 42 + 16 * Math.sin(Math.PI * e), roll: deg(-8) * Math.sin(Math.PI * e) };
    }
    if (t < C5.code) return labCam(t);
    // ---- scene 5: editor, then into the tower
    const ed = W.code;
    const tw = W.tower;
    if (t < 18.0) {
      const p = prog(t, C5.code, 18.0);
      return { pos: ed.clone().add(V(-0.7 + 1.1 * p, 0.2 - 0.25 * p, 4.4 - 0.7 * io(p))), look: ed.clone().add(V(-0.4 + 0.9 * p, 0.05, 0)), fov: 38 + 10 * Math.exp(-p * 6), roll: 0 };
    }
    if (t < 19.42) {
      const pts = [[18.0, ed.clone().add(V(0.4, -0.05, 3.7))], [18.75, tw.clone().add(V(0, -1.3, 0.25))], [19.42, tw.clone().add(V(0, 6.9, 0))]];
      const pos = V(spline(t, pts.map(([k, v]) => [k, v.x])), spline(t, pts.map(([k, v]) => [k, v.y])), spline(t, pts.map(([k, v]) => [k, v.z])));
      const lk = [[18.0, ed.clone().add(V(0.5, 0, 0))], [18.55, tw.clone().add(V(0, 1.5, 0))], [18.8, pos.clone().add(V(0, 5, 0.7))], [19.42, Ct.clone().add(V(0, 6, -3))]];
      const look = V(spline(t, lk.map(([k, v]) => [k, v.x])), spline(t, lk.map(([k, v]) => [k, v.y])), spline(t, lk.map(([k, v]) => [k, v.z])));
      return { pos, look, fov: 40 + 36 * smooth01(prog(t, 18.4, 18.8)) * (1 - smooth01(prog(t, 19.25, 19.42))) + 6 * smooth01(prog(t, 19.25, 19.42)) , roll: deg(20) * prog(t, 18.8, 19.42) * (1 - prog(t, 19.3, 19.42)) };
    }
    // ---- orbit around the tower, brake, hero; climax pull-back (one continuous move)
    if (t < CUES.scene[6]) {
      const az = spline(t, [[19.42, deg(200), deg(150)], [20.55, deg(470)], [20.95, deg(492)], [22.0, deg(505)], [23.0, deg(520)], [23.55, deg(540)], [25.4, deg(560)], [26.0, deg(565)]]);
      const rad = spline(t, [[19.42, 0.25, 8], [19.8, 4.5], [20.55, 7.0], [20.95, 7.9], [22.0, 9.6], [23.0, 8.4], [23.55, 21], [25.4, 15.5], [26.0, 15]]);
      const h = spline(t, [[19.42, 3.9], [19.8, 3.0], [20.55, 0.1], [20.95, -0.3], [22.0, 0.3], [23.0, 0.6], [23.55, 4.5], [25.4, 2.6], [26.0, 2.4]]);
      const pos = V(Ct.x + rad * Math.sin(az), Ct.y + h, Ct.z + rad * Math.cos(az));
      const fwd = Ct.clone().sub(pos).setY(0).normalize();
      const right = V(fwd.z, 0, -fwd.x).multiplyScalar(-1);
      const off = spline(t, [[20.55, 0], [20.95, -1.6], [22.0, -2.3], [22.6, 0]]);
      const look = Ct.clone().addScaledVector(right, off);
      const lookIn = Ct.clone().add(V(0, 6, -3));
      look.lerp(lookIn, 1 - smooth01(prog(t, 19.42, 19.85)));
      return { pos, look, fov: spline(t, [[19.42, 46], [19.9, 44], [20.6, 40], [23.0, 40], [23.55, 44], [26.0, 40]]), roll: deg(-10) * Math.sin(Math.PI * prog(t, 19.42, 20.55)) };
    }
    // ---- signature
    const p = prog(t, 26.0, 30.0);
    return { pos: Ct.clone().add(V(0, 0.48, 8.7 - 0.45 * io(p))), look: Ct.clone().add(V(0, 0.42, 0)), fov: 33, roll: 0 };
  }
  return camAt;
}

function smooth01(x) { x = clamp(x); return x * x * (3 - 2 * x); }
function ioExp(x) {
  x = clamp(x);
  if (x <= 0) return 0; if (x >= 1) return 1;
  return x < 0.5 ? Math.pow(2, 16 * x - 8) / 2 : (2 - Math.pow(2, -16 * x + 8)) / 2;
}
