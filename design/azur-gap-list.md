# AZUR Horizons — what still differs from the reference videos

Checked frame by frame against the three reference videos (contact sheets in the session scratchpad,
`frames/v1_sheet_*.jpg`, `frames/v3_sheet_*.jpg`, `frames/v2_sheet_1.jpg`) and against the game as it
runs now (desktop 1280×720 and iPhone 13 landscape 844×390). Positions are fractions of the screen.
Names stay original (no Epic names, logos or assets), the layout and behaviour follow the videos.

Status: ✅ done · 🟡 partly · ❌ missing

## World (the biggest gap)
| # | In the videos | In the game now | Status |
|---|---|---|---|
| W1 | Chapter-1 island outline and POI layout (see `azur-reference-spec.md` §5) | old island, city street grids | ❌ |
| W2 | Towns of suburban houses: pitched roofs, siding, porches, doors, windows, real interiors (kitchen, bathroom with tub/toilet, bedroom, wardrobes, dressers) | empty street grids, no houses visible | ❌ |
| W3 | Lush saturated green grass with texture, rolling hills, dirt paths | flat pale green, asphalt roads with markings | ❌ |
| W4 | Tall pine trees and round deciduous trees everywhere, bushes, rocks | few tiny trees | ❌ |
| W5 | Farms: wooden fences, crop fields, barns, silos; industrial: warehouses, containers; Tomato-Town-like tunnel; sports field | none | ❌ |
| W6 | Bright blue sky with soft clouds, warm sun; sunset purple variant | dark saturated blue, black dome of the old "The End" event over the island | ❌ |
| W7 | Storm: purple translucent striped wall, purple tint outside, minimap purple outside the circle | old storm | 🟡 |
| W8 | Water: blue-green sea around the island, lake in the middle (Loot-Lake-like) | sea ok, lakes small | 🟡 |

## HUD (match)
| # | In the videos | Now | Status |
|---|---|---|---|
| H1 | Compass with degrees, top centre | done | ✅ |
| H2 | Square minimap top right, status row (storm, alive, kills) under it | done | ✅ |
| H3 | Hotbar bottom right: 6 slots, rarity gradient backgrounds, ammo count in slot, key hints | flat dark slots | 🟡 |
| H4 | Build bar above the hotbar: wall / floor / stairs / roof (+ trap), light blue | only in build mode | ❌ |
| H5 | Ammo reserves row + materials column on the right (wood / brick / metal with counts) | single dark pill | 🟡 |
| H6 | Kill feed bottom left ("X a éliminé Y au fusil") | missing | ❌ |
| H7 | Pickup feed on the right ("+30 Bois", "×10 Munitions moyennes") | missing | ❌ |
| H8 | Loot item card next to the crosshair: rarity colour panel, name, stats, stars, "Remplacer l'arme équipée" | missing | ❌ |
| H9 | Harvest: blue weak-point ring on the target, target HP bar "400 · 450", floating "+4" with wood icon | missing | ❌ |
| H10 | Storm messages in magenta: "L'ŒIL DU CYCLONE RÉTRÉCIT DANS 1 minute 30 secondes" | partly | 🟡 |
| H11 | Sniper scope: blue circle overlay with cross-hair | old scope | 🟡 |
| H12 | Vitals bottom centre, mag/reserve above | done | ✅ |

## Characters, camera, animation
| # | In the videos | Now | Status |
|---|---|---|---|
| C1 | Real-looking stylised soldiers and costumes | done (CC0 skinned bodies, clothes, hair) | ✅ |
| C2 | Over-the-right-shoulder camera: character lower-left of centre, about a third of the screen high | character centred and large | 🟡 |
| C3 | Skydive spread-eagle, glider hang, landing | old poses on new body | 🟡 |
| C4 | Pickaxe carry and swing | done | ✅ |
| C5 | Emotes from the wheel play real dances | mapped to library clips | 🟡 |

## Objects and effects
| # | In the videos | Now | Status |
|---|---|---|---|
| O1 | Building pieces: wood planks (orange-brown), brick, green rusty metal; blue ghost blueprint | old pieces | 🟡 |
| O2 | Chests: gold glowing chest with "Fouiller" prompt and sparkles | old chests | 🟡 |
| O3 | Floor loot: weapon on the ground with rarity glow + beam | partly | 🟡 |
| O4 | Weapon models: assault rifle, pump/tactical shotgun, SMG, sniper, pistol, rocket launcher in the game's style | blocky oversized | 🟡 |
| O5 | Battle bus under a balloon, route over the island at a sane height | done look, route/altitude off | 🟡 |

## Lobby, loading, shop
| # | Item | Status |
|---|---|---|
| L1 | Lobby layout (desktop + iPhone) | ✅ |
| L2 | Loading screen "Solo / Battle Royale / ACCÈS ANTICIPÉ" | ✅ |
| L3 | Shop + locker | ✅ |
| L4 | Full-screen island map (M) with POI names on the Chapter-1 outline | ❌ (needs W1) |
