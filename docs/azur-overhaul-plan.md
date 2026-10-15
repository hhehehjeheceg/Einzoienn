# AZUR Horizons v92 — "Chapitre 1" overhaul plan

Target: `design/azur-reference-spec.md` (frame-by-frame spec of the user's videos and images).
Codebase map: `docs/azur-codebase-map/*.md` (one report per subsystem, with live vs dead code and
the wrapper chains). Read the relevant report before editing a file.

The user asked to **modify their existing game** (`azur-horizons/`), not to start a new one.
Keep French copy and original names/characters (no Epic trademarks or copied character designs);
mirror the reference's camera, HUD layout, flow, mechanics, map geography and look.

## Ground rules for every workstream
1. Only edit the files your workstream owns (table below). If you need a change elsewhere, write it
   down in your final report instead of editing.
2. Prefer the project's own layering pattern: wrap prototype methods (`const prev=P.x; P.x=function(){…}`)
   in the v92 layer files, which load last. Edit base files directly only where closures make
   wrapping impossible (sim.js terrain and constants) or where the base code is the live one.
3. Keep the DOM ids and data-act verbs listed in `docs/azur-codebase-map/client-loop.md` §3 — later
   layers query them.
4. Never use Math.random inside sim.js (seeded RNG only). Keep dt clamped.
5. Bump nothing in index.html except through the v92 tags already added (`ch1-*-v92.*`).
6. Verify before reporting:
   - `node --check <file>` for every edited JS file;
   - `node tools/azur/sim-smoke.cjs solo 7 16` must finish with `phase=ended` and no EXCEPTION
     (and `squad` mode too when the sim changed);
   - browser screenshots with `node $SCRATCH/tools/shot.mjs http://localhost:8765/index.html <out> …`
     (Playwright + SwiftShader; see the script header for the action list). Use
     `{"t":"eval","js":"…window.AZUR…"}` to fast-forward phases (e.g. set `AZUR.world.phaseTime`) or
     to read state. Report console errors from the script output.
   - Save final evidence screenshots to `production/qa/evidence/v92-<workstream>-*.png`.

## Workstreams and file ownership

| WS | Scope | Owns |
|----|-------|------|
| A1 | Island geography in the simulation: Chapter-1 coastline, hills, rivers (real water), central lake + island, swamp SE, farm fields S, forest NE; 18 POIs at the reference positions with fitting district styles; road network like the reference; spawn (waiting) island kept offshore. Remove the in-match Zero Point from BR. | `sim.js` (terrain/regions/roads/zones/MAP section + Zero Point block), `tools/azur/*` |
| B  | Camera framing, art direction (no black toon outlines, vivid saturated palette, sky, haze, lighting), crosshairs, storm wall look. | `view.js`, `render-toon.js`, `render-upgrades.js`, `environment.js`, `graphics-v200-engine.js`, `graphics-v48-hero.js`, `ch1-view-v92.js` |
| A2 | Island presentation: biome decor for the new zones (swamp, fields, forest, beaches), POI landmarks (restaurant with giant vegetable mascot, drive-in screen, depot warehouses, lodge + tower, factory, pagoda, haunted church, junkyard stacks, football field, tilted towers city), water for rivers, full map + minimap drawing with names. | `island-v68.js`, `map-poi-v67.js`, `graphics-v200-world.js`, `graphics-v200-art.js`, `graphics-v48-city.js`, `map-ui.js`, `map-v65.js` |
| C  | In-match HUD to the reference layout (compass strip, square minimap + POI label, status row, materials column, ammo reserves, 6-slot rarity hotbar with key hints, build bar, shield/health bars, mag/reserve, kill feed, center messages, prompts with key boxes, rarity item card, +N harvest pop-ups, weak-point marker, sniper scope). | `ch1-hud-v92.js`, `ch1-hud-v92.css`, `hud-v67.*`, `inventory-v67.*`, `ui-v81.*` |
| D  | Match flow: 45 s spawn-island warm-up with "LE BUS DE COMBAT PART DANS N secondes", random bus route each match, door delay, "dernier arrêt" + forced eject, bus = blue bus under teal/white hot-air balloon, bus camera, skydive pose + contrail, glider (umbrella style), landing; loading screen like the reference; radial emote wheel; Victory Royale banner. | `ch1-flow-v92.js`, `bus-v82.js`, `emotes-v67.js`, `vehicles-v74.js`; sim.js flow lines (after A1 is merged) |
| E  | Characters: default soldier archetype (tank top + vest + cargo pants + boots, varied skin/hair) for default skin and bots, clean shading without outlines, Chapter-1 proportions; original lobby skins in the same style; skydive/glide/emote poses. | `models.js`, `characters-v67.js`, `skins-v81.js`, `skins-v89.js`, `anim-v67.js` |
| F  | Main-menu lobby like image 3 (top tab bar, season/level/XP/missions panel, character on a glowing round platform, countdown panel, promo card, mode card + yellow JOUER !, bottom EMOTE / FORMATION). | `ch1-lobby-v92.js`, `ch1-lobby-v92.css`, `lobby-v66.*`, `lobby-v83.*`, `lobby-v89.js`, `lobby-v48.css` |
| G  | Gameplay feel: bandages/medkit/small+big shield with Chapter-1 values, hold-to-search chests with golden glow, ammo boxes, materials named bois/brique/métal, build HP growth + build-up animation (150/300/500), harvest weak points and amounts, grenades, damage scaling vs bots closer to 1×. | sim.js gameplay sections (after D), `construction*.js`, `build-rules.js`, `loot-v67.js`, `weapons-v67/71/84.js`, `weapons-sfx-v69.js` |

Order (2 agents at a time): A1 ∥ B → A2 ∥ C → D ∥ E → F ∥ G → adversarial QA → fixes.
