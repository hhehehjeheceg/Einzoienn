/* AZUR sim smoke test — runs a whole local match headlessly in Node.
 * Usage: node tools/azur/sim-smoke.cjs [mode=solo] [seed=7] [maxMinutes=20]
 * Prints phase timeline, alive counts, storm radius and any exception. Exit 1 on failure.
 * It only observes: it never judges balance (see CLAUDE.md "observations, never verdicts"). */
const path = require('path');
global.window = global; // sim.js attaches to globalThis
const S = require(path.join(__dirname, '../../azur-horizons/sim.js'));
const mode = process.argv[2] || 'solo', seed = +(process.argv[3] || 7), maxMin = +(process.argv[4] || 20);
const w = new S.World({ mode, seed, player: { id: 'p0', name: 'Test' } });
const dt = 1 / 30;
let lastPhase = null, jumped = false, t = 0, errors = 0, lastLog = -999;
const me = () => w.players.find((p) => p.id === 'p0');
const t0 = Date.now();
try {
  while (t < maxMin * 60 && w.phase !== 'ended') {
    const p = me();
    const input = { moveX: 0, moveZ: p && p.grounded ? 1 : 0, yaw: Math.sin(t / 9) * 2, pitch: -0.1, sprint: true };
    if (w.phase === 'transport' && !jumped && w.phaseTime > 6) { input.jump = true; jumped = true; }
    w.command('p0', input);
    w.step(dt);
    t += dt;
    if (w.phase !== lastPhase) { console.log(`[${t.toFixed(1)}s] phase -> ${w.phase}`); lastPhase = w.phase; }
    if (t - lastLog >= 60) {
      lastLog = t;
      const alive = w.players.filter((q) => q.alive).length;
      const pl = me();
      console.log(`[${t.toFixed(0)}s] alive=${alive} storm r=${w.storm && w.storm.radius.toFixed(0)} me alive=${pl && pl.alive} pos=(${pl && pl.x.toFixed(0)},${pl && pl.y.toFixed(1)},${pl && pl.z.toFixed(0)}) builds=${w.builds.length} loot=${w.loot.filter((l) => !l.dead).length}`);
    }
  }
} catch (e) { errors++; console.error('EXCEPTION at t=' + t.toFixed(2), e && e.stack); }
const alive = w.players.filter((q) => q.alive);
console.log(`end: phase=${w.phase} simTime=${t.toFixed(0)}s alive=${alive.length} winner=${alive.length === 1 ? alive[0].name : '-'} wall=${((Date.now() - t0) / 1000).toFixed(1)}s objects=${w.objects.length}`);
process.exit(errors ? 1 : 0);
