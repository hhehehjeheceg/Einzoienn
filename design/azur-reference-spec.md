# AZUR Horizons — Reference Spec (from the user's videos and images)

Source material analysed frame by frame (2026-10-15):
- `copy_5FA7…mov` (117 s, 854×394): Chapter-1 style build fights, sniper scope, storm, night loot.
- `copy_6695…mov` (117 s, 1920×888): landing in a restaurant town, chest search, pickaxe harvesting in a
  suburb house, loading screen, spawn island with emote wheel, flying bus under a balloon, skydive, glider.
- `ScreenRecording…mp4` (16 s): wall/ramp building and editing next to the storm wall, shooting.
- `image 1`: third-person HUD over a town with a giant tomato mascot. `image 2`: the island map.
  `image 3`: the main-menu lobby (character on a round platform, yellow PLAY button).

Goal: the user's game AZUR Horizons must **play and look like these videos**. Rule kept from the
user's own brief (§9, §26.15): no proprietary assets — original character designs, original place
names and logos, original music. Everything else (camera, HUD layout, flow, mechanics, map geography,
colors, feel) follows the references as closely as possible.

All positions below are fractions of the 16:9 game viewport (x from left, y from top).

## 1. Camera and view
- Third person, over the right shoulder. Standing character: horizontal center ≈ 0.45, head ≈ y 0.50,
  feet ≈ y 0.95 — the character occupies ~45 % of screen height. **Not** filling the screen.
- Rig: pivot ≈ 1.65 m above feet, ≈ 3.2 m behind, shoulder offset ≈ 0.6 m right, FOV ≈ 80° horizontal
  (≈ 50° vertical at 16:9). ADS / scope zooms in. Camera pulls in smoothly when a wall is behind.
- Crosshair at exact screen center: AR = 4 small corner brackets; shotgun = ring with center dot;
  pickaxe/unarmed = small ring; sniper ADS = full black scope overlay with thin cross-hairs and range ticks.

## 2. In-match HUD (vivid, flat, white bold condensed font with soft dark shadow)
| Element | Position | Look |
|---|---|---|
| Compass | top center, x 0.37–0.62, y 0.03–0.08 | Letters N NE E SE S SW W NW bold white, degree numbers every 15° (60, 75, 105…) small white, ▼ marker at center with current bearing number above it. No panel. |
| Minimap | top right, x 0.84–0.985, y 0.02–0.285, square | Real top-down render of the island around the player, player arrow, bus route line, storm circle (purple outside / white safe circle). Current POI name bold italic white uppercase over the bottom of the map. |
| Status row | under minimap, right-aligned, y ≈ 0.31 | `[storm icon] 1:27  [person] 49  [skull] 0` — storm timer (purple storm icon / bus icon before jump), players alive, eliminations. |
| Squad / name | top left x 0.05–0.18, y 0.10–0.13 | own name with a thin green health bar (squad list). |
| Ammo reserves | right, y ≈ 0.46 | small row: ammo type icons with counts. |
| Materials | right, x 0.90–0.97, y 0.48–0.56 | 3 icons wood / brick / metal in small dark rounded squares, count below (0–999). Selected material highlighted. |
| Pickup feed | right, y 0.60–0.67 | `Tactical Shotgun`, `×5 Ammo: Shells` lines with icons, fade out. |
| Kill feed | left, x 0.03, y ≈ 0.76 | `Name eliminated Name with a rifle` white, victim in red. |
| Build bar | bottom right, x 0.82–0.98, y ≈ 0.81 | key-hint row above (F1–F5), 4 light-blue translucent piece icons: wall, floor, stairs, roof (+ trap slot). `Q` hint + hammer icon on its left. |
| Hotbar | bottom right, x 0.69–0.98, y 0.85–0.94 | 6 square slots (pickaxe + 5). Slot background = rarity gradient (common grey, uncommon green, rare blue, epic purple, legendary gold). Selected slot white frame. Ammo count bottom-right in slot. Key hints (Z 1 2 3 4 X) below. |
| Mag / reserve | center-bottom x 0.48–0.54, y ≈ 0.82 | large white `8  20 ⦀` |
| Shield bar | x 0.38–0.62, y ≈ 0.875 | dark bar, blue fill, `⛊ 0 \| 100` on the left inside the bar |
| Health bar | x 0.38–0.62, y ≈ 0.90 | bright green fill #5ad13a, `✚ 100 \| 100` |
| Center messages | y 0.22–0.30 | icon above, white caps text with magenta/purple numbers: `BATTLE BUS LAUNCHING IN 5 Seconds`, `THE DOOR WILL OPEN IN 6 Seconds`, `EVERYBODY OFF, LAST STOP IN 34 Seconds`, `STORM EYE SHRINKS IN 1 Minute 30 Seconds`, `STORM EYE SHRINKING`. (In French in AZUR.) |
| Context prompts | right of center | `[E] Search` (chest, hold), `[E] Pick up`, `[Space] To Jump` (bus), `[Space] To Deploy Glider` (skydive). |
| Item card | right of crosshair when looking at loot | panel tinted by rarity: `Uncommon \| Ballistic Weapon`, big name `TACTICAL SHOTGUN`, 2–3 stat lines, ★ rating; `[E] Swap equipped` on its left. |
| Harvest | on target | weak-point marker = white ring with blue core; target HP bar `400 · 450` green above; floating `+16` with material icon near the character. |

## 3. Match flow (exact order)
1. **Lobby** (main menu) — see §6. PLAY → loading screen.
2. **Loading screen** — key art, top-left `Solo / Battle Royale`, yellow banner top-right, `LOADING` bar
   bottom-left, tip text in a purple box bottom-right.
3. **Spawn island** (warm-up): all players (bots) gather on a separate small island, run around with
   pickaxes, dance; emote wheel (8 emotes, B key / button). Message `BATTLE BUS LAUNCHING IN N Seconds`.
   Minimap shows the whole island and the dotted bus route.
4. **Bus**: blue bus hanging under a teal/white hot-air balloon with yellow crown and a burner flame,
   flies straight across the island along a random line at ~240 m. Camera behind and above the bus,
   looking down at the island. `THE DOOR WILL OPEN IN N Seconds`, then `[Space] To Jump`, then
   `EVERYBODY OFF, LAST STOP IN N Seconds` and forced eject at the end.
5. **Skydive**: spread-eagle pose, blue glowing contrail, camera behind/above, steer with move keys,
   dive by looking down. `[Space] To Deploy Glider`; auto-deploy at low altitude.
6. **Glider**: umbrella/glider above the character, slower descent, steerable; lands on ground.
7. **Ground**: pickaxe only at start; loot, harvest, build, fight.
8. **Storm**: first circle appears after ~1 min (`STORM EYE FORMS IN…`), shrinks in phases,
   purple translucent wall with vertical streaks, purple screen tint and damage outside.
9. **End**: last alive = `#1 VICTORY ROYALE` screen; elimination = placement screen + spectate.

## 4. Gameplay rules (Chapter-1 feel)
- 100 HP + 100 shield. Fall damage on big drops. Sprint by default when moving forward, crouch slows.
- Pickaxe harvest: trees → wood, rocks → brick (stone), cars/metal → metal; weak point gives double.
  Materials cap 999. Build cost 10 each.
- Build pieces on a grid: wall, floor, stairs (ramp), roof (cone). Blue translucent preview, red when
  invalid. Wood fast / low HP, brick medium, metal slow / high HP. Build-up animation, HP grows.
  Edit mode turns tiles off (window/door/half wall).
- Weapons: assault rifle, burst rifle, pump shotgun, tactical shotgun, SMG, pistol, bolt sniper (scope),
  hunting rifle, rocket launcher, grenades. Rarity tiers grey/green/blue/purple/gold scale damage.
  Ammo types: light, medium, heavy, shells, rockets.
- Loot: chests glow gold and hum, hold `E` to open, spill loot; floor loot with rarity light; ammo boxes;
  supply drops. Consumables: bandages (+15 up to 75), medkit (100), small shield (+25 up to 50), shield
  potion (+50).

## 5. Map (geography of image 2, original names)
Same island silhouette: roughly square, NW corner junkyard, W coast beach of mansions, central lake with
a little island house, river from the north into the lake, river from the lake east to the woods, river
from the lake south-east through the depot and market down to the swamp and south coast, swamp in the
SE corner (dark green), farm fields with yellow-brown ground in the south, factory and pagoda landing on
the south coast, tilted city in the middle-west.

| Reference position (map px /554) | Role | AZUR name |
|---|---|---|
| (105, 55) | junkyard | Ferraille Junction |
| (68, 132) | haunted hill + church | Colline Hantée |
| (152, 160) | suburb + football field | Parc Plaisant (Maple Park) |
| (282, 122) | drive-in cinema | Ciné Étoile |
| (452, 158) | big forest | Bois Murmurants |
| (342, 182) | restaurant town w/ giant mascot | Bourg Tomette |
| (262, 220) | central lake + island house | Lac Lagune |
| (482, 250) | lodge + watch tower | Chalet Pinède |
| (332, 262) | warehouses / depot | Dépôt Fret |
| (40, 272) | mansions on the beach | Rivage Doré |
| (205, 282) | tilted city of towers | Tours Penchées → "Hauteurs Bancales" |
| (422, 302) | shopping street | Rue Marchande |
| (118, 352) | small town + diner | Bosquet Friteuse |
| (266, 350) | small town of houses | Sources Poivrées |
| (446, 412) | swamp | Marais Brumeux |
| (332, 432) | farm fields | Champs Fatals → "Champs du Fermier" |
| (196, 486) | factory | Usine Bulle |
| (312, 518) | pagoda town | Pagode Lotus |

## 6. Main menu lobby (image 3)
- Top bar (dark navy, full width): party icon + count, tabs `JOUER | PASSE DE COMBAT | DÉFIS | CASIER |
  BOUTIQUE | CARRIÈRE`, selected tab yellow; currency with coin icon on the right.
- Left: big title `CHAPITRE 1 / SAISON X`, `NIVEAU N` with purple XP bar, medal punch-card row,
  `MISSIONS XP` with progress bar.
- Center: the selected character on a round glowing cyan platform; background is an indoor/outdoor
  stage; event countdown panel (red digits) above.
- Right top: promo card. Right bottom: mode card `ESCOUADES / sans remplissage` + cyan `CHANGER`,
  big yellow italic `JOUER !` button.
- Bottom bar: `EMOTE`, `FORMATION`.

## 7. Characters
- Default players look like the reference default soldier archetype: tank top + tactical vest + cargo
  pants + boots, varied skin tones and hair (original look, no copied faces/outfits).
- Lobby/locker skins: original outfits in the same stylized proportions (slightly stocky hero
  proportions, big hands, clean flat colors, no black toon outlines).
- Animations: idle, run (sprint by default), crouch, jump, skydive spread-eagle, glide hang, pickaxe
  swing, gun hold/aim/recoil, build, emote dances.

## 8. Art direction
Bright, saturated, clean: vivid green grass (#5db53a → #86d150), saturated blue sky with white
cumulus, light atmospheric haze, soft sun shadows, wood/brick/metal pieces with readable textures,
night-time variants allowed. No heavy black outlines. Storm is violet (#7b2bd9) with lighter streaks.
