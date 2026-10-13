// =====================================================================================================
//  The frame: which scene is on screen at time t, in which order things are drawn.
// =====================================================================================================
const BURST_T = [];                 // filled by the burst scene (times of the hard cuts, used by shake / chroma)
const SUBS = [                      // [from, to, sub-frames]: motion-blur budget
  [3.4, 3.95, 12], [7.2, 7.95, 12], [9.4, 9.55, 12], [10.95, 11.5, 12], [12.45, 12.95, 12], [13.55, 14.0, 12],
  [14.0, 15.75, 8], [15.75, 16.5, 16],
  [16.5, ARR[0], 24],
];
for (let k = 0; k < 5; k++) SUBS.push([LEAVE[k] - .05, ARR[k + 1] + .05, 26]);
SUBS.push([LEAVE[5] - .05, 28.0, 24], [28.0, 28.75, 12], [30.25, 30.95, 12], [33.05, 33.7, 12], [34.6, 36.0, 12], [36.0, 37.0, 16]);

function sceneABC(t) {
  const z = camZ(t);
  auroraCream(t, z, CUR_F);
  drawEmitters(t, 'A'); drawA(t); drawB(t); drawEmitters(t, 'B'); drawC(t);
  if (t < 7.55) drawDot(t); else drawObject(t);
  drawEmitters(t, 'C');
  vignetteLight();
}
function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (t < 14.0) { sceneABC(t); drawHUD(t, false); }
  else if (t < 15.75) drawBurst(t);
  else if (t < 16.5) { drawDropIn(t); }
  else if (t < 28.0) { world3D(t); drawHUD(t, true); }
  else if (typeof drawEnding === 'function') drawEnding(t);
  else { ctx.fillStyle = '#141413'; ctx.fillRect(0, 0, W, H); }
}
