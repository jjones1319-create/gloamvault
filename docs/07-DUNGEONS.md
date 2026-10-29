# 07 — Dungeons

*Last updated 2026-10-28 · rev. 7 (Phase 7, pass C2: §2.8 as built — the four arenas as data and rules, the tells and their hints, the arena events and records, the HUD and the 3D arena, the boss rewards; open questions 18–23) · rev. 6 (Phase 7, pass C1: §2.1–§2.7, §2.9–§2.10 and §8.3 as built — the Crypts and the Drowned Vault in data, the eight floors and their Waystones, Dunmore's cart and the R bands as tuning, the sixteen curios, twelve traps and six secrets with their hooks, when an unrevealed trap fires, the hunters and the Leech Jar, the boss floors' grammar, the zone deep link) · rev. 5 (Phase 7, pass D: §6 the presets and the twelve Pacts as built — every knob and flag live, the Oath and the chest shift, Hard and Dread opening on the final boss, the Waystone menu; §7 the Quest Board as built — dailies and the weekly, progress, claims and the key caps; open questions 11–14) · rev. 4 (Phase 6: §2.2's kits as built — the extra pieces, the 4 m doorway, detail as geometry, the gallery — D-110, D-114) · rev. 3 (Phase 7 prep: Gravehollow at 8 floors — §2.3 rebuilt with the band levels, the Vault folded to F7–8, a merchant on the floor before every boss floor, no hunter on the Vault's two boss floors, Naesa's chapel on F7 and the throne on F8, the arena tells' two-word hints — D-098, D-099, D-104) · rev. 2 (checkpoint 1: open questions answered by delegation; the Nightmare difficulty preset renamed Dread — D-095, D-099) · rev. 1 2026-10-26 · numbers are tuning starting points*

*Companion to `03-GAME-DESIGN.md` §1, §4, §8, §11, §12 (the rules) and `06-MONSTERS.md` (the creatures). This file owns the places: the overworld, each dungeon's zones, floors, kits, room templates, curios, traps, secrets, arenas and the floor-generation grammar. Monster names used in encounter tables are the shared names from the bestiary brief; creature names were reconciled against the bestiary on 2026-10-26. Gold amounts are written in **R** (the median gold of one delve at the player's band, `03` §8.1; R ≈ 300 at floors 1–3).*

---

## 1. The overworld and travel

### 1.1 The map at the Waystone

The Waystone stands in Emberfall's square between the Lantern Inn (Brannock) and the Quest Board, with Hesper Vane's smithy, Master Orrin's Skill Hall, Mab's curio stall, Tomas Reed's stables and Lysa Quill's bank counter around it (`03` §8.2). Touching it opens the **overworld map**: a painted parchment with Emberfall at its centre and four dungeon sites around it, each with a lamp that is lit when the site is open. No travel time, no overworld encounters — the map is a menu that looks like a place.

| Site | Where on the map | One-line lore | Opens when |
|---|---|---|---|
| **Gravehollow Keep** | north, on the moor road, a half-sunk tower | A border keep that sank into its own catacombs; the Grinning Company squats in its cellars, the dead still keep their own vigil below, and something older waits in the drowned vault. | from the start |
| **The Fungal Deep** | east, under the Mirewood, a cave mouth ringed with pale caps | The caverns under the forest have grown a mind: the Sporemother dreams, and everything that breathes her spores dreams with her. | the Hollow King is dead |
| **Emberforge** | south, in the Cinder Hills, a chimney that still smokes | The deep dwarves' great foundry was never abandoned — it was taken over by what they were forging. | the Sporemother is dead |
| **Frostmarch Citadel** | north-west, on the Teeth, a white fortress on a glacier | The last stand of a frozen court, its walls manned by the dead, its roost held by wyrms, its throne by the Pale Dragon. | the Forge-Tyrant is dead |

- **Unlock rule.** A dungeon opens on a player's map when they have killed the previous final boss, *or* when they join a party whose host has. Progress is per player, so a guest who clears the Sporemother in a friend's party has the Fungal Deep open afterwards (the kill is theirs by participation, `03` §5.3).
- **Waystones per zone.** The first zone's Waystone is lit from the start; each later zone's *rises* in the zone boss's arena when the boss dies and stays lit for that player. A site shows its zones as a column of lamps; a lit lamp can be delved from. Gravehollow's three stand in the entry rooms of F1, F4 and F7 (lit by Vexa's and the Warden's deaths); Sister Naesa's death raises none — the Waystone's floor memory (D-083) offers the King's floor instead.
- **A delve** is one zone (D-098): three floors ending in a zone boss (Gravehollow F1–3, F4–6), or two when the zone carries the final floor (the Drowned Vault F7–8: Sister Naesa on F7, the Hollow King on F8). 20–40 minutes; pausable in any room; resumable from the Inn (a delve save is seed + command log, `03` §10.1).
- **After the boss.** When the boss of a zone's last floor dies the party teleports out from its room (D-083) and the Waystone remembers the next zone, so the next delve can start there. Sister Naesa is the one zone boss who is not on her zone's last floor: she falls on F7, her drained altar opens the stair to the throne, and the party goes on to F8 in the same delve or teleports out from her chapel — either way the Waystone now offers F8 (D-083; there is no separate Throne delve, D-099). A delve is one zone (D-098, by delegation at checkpoint 1); the whole tower in one sitting is not offered. There is no banking in the dungeon; the Bank is a town building, which is the point. *(Rev. 1's "Descend past the boss" is superseded.)*
- **Retreat** (D-083, James — `03` §12.3 owns it): the party leaves only by **walking out of a floor's entrance room** or **teleporting out at the floor's end** (the stairs room, or the boss's room once the boss is down); free on Normal (Hard 15%, Dread 25% of the unbanked gold, the preset table below); never from a fight. Keeps every item, part, Tome and XP. In co-op a vote (majority, leader breaks ties, 15 s). *(Rev. 1's "from any room, 10% toll" is superseded.)*
- **Wipe** (`03` §12.2): the party wakes at the Lantern Inn, the delve's gold is gone, equipped items −10% durability; Waystone progress stands.

### 1.2 Dungeon-select UI copy

Tapping a site opens its card. The copy is deliberately plain so the balance runner can fill it from data.

```
GRAVEHOLLOW KEEP · the Cellars (floors 1–3)
Recommended level 1–4 · Monsters L1–L4 · Vermin & the Grinning Company
Party 1–4 · encounters scale to party size
Difficulty: [Normal] [Hard] [Dread]          Pacts: 0 selected (+0% gold, +0% XP)
Expected: 20–30 min · ~1.0 R gold · boss: Captain Vexa Marrow
Hunter on this zone: Old Gnaw (enters at 40 ticks)
Your best: cleared 3× · fastest 22:40 · lowest light at the stairs 14
[ Begin delve ]
```

- **Recommended level** is the zone's monster-level range (F1–3 reads 1–4, F4–6 reads 5–8, F7–8 reads 11–13). Below it the card turns amber ("Hard for your level"); more than 10 above, grey ("No XP here"), because the gate (`03` §5.1) zeroes gains against enemies 10+ levels below.
- **Party size** shows the scaling line so four players is not mistaken for easy mode: count ×0.6 / 0.8 / 1.0 / 1.6, HP ×0.5 / 0.85 / 1.0 / 1.6, damage ×0.8 / 1.0 / 1.0 / 1.0, and against a boss HP ×0.4 / 0.8 / 1.2 / 2.0, damage ×0.7 / 1.2 / 1.3 / 1.3 (the Phase 3 runner's values, D-084, as tuned in Phase 7 — D-128; `tuning.json` → `dungeon.partyScaling`).
- **Modifiers** list the preset and Pacts (§6) with their total reward. The host sets them; guests see them in the lobby before accepting.
- **Hunter line** names the zone's hunter and when it enters; the Drowned Vault's reads *"Hunter on this zone: none on the clock (the Vault Leech waits in the Leech Jar)"* — both Vault floors carry a boss and no hunter stalks a boss floor (§2.9).

---

## 2. Gravehollow Keep in full

### 2.1 Lore

Gravehollow was a border keep that stood for three hundred years on the moor road until the ground under it, riddled with the catacombs of the families it had buried, gave way; the keep sank a storey into its own dead and the garrison walked out. The **Grinning Company**, a bandit crew whose captain paints a grin on every face she leaves behind, squats in the cellars now and taxes the road. Beneath them the **Barrow Warden**, the last sexton of the keep, still keeps the dead in their niches — the dead do not keep themselves, and he has not slept in a century. And beneath *him* the keep's treasury flooded when the river found the catacombs, and the **Tidebound**, a cult of the drowned led by Sister Naesa, have opened the sluices on purpose: they are drowning the vault to wake what the keep was built to hold down. The **Hollow King** sits in the throne room on the eighth floor, the bottom of the tower, under eight feet of black water, and has started to remember his name.

**As built (Phase 7, pass C1).** The three zones are records in `content/dungeons/gravehollow-keep/dungeon.json`: `the-cellars` (F1–3, Vermin & the Grinning Company, Old Gnaw, Captain Vexa), `the-crypts` (F4–6, the Restless Dead, the Warden's Hound, the Barrow Warden) and `the-drowned-vault` (F7–8, the Tidebound, the Vault Leech with no clock, Sister Naesa and the Hollow King). Each names its kit (`cel`, `cry`, `vlt` — its templates wear the prefix, lint rule 45) and has a Waystone (§1.1).

### 2.2 Biome kits

Three Blender kits, one per zone, plus a **shared kit**. Conventions (for `11-ART-PIPELINE.md`): grid **cell = 8 m × 8 m**; floor tile **2 × 2 m**; wall segment **2 m long × 3.5 m high**; doorway **2 m wide** at a cell's mid-edge; origin at floor-level centre, Y up on export, a `socket_*` empty where the next piece meets. Tri counts are base-LOD targets; a room template stays at **≤ 40k tris and ≤ 40 draw calls** after instancing (the same bar as `11-ART-PIPELINE.md` §9). One 2 k albedo + one 2 k normal/roughness atlas per kit.

#### Shared kit (`shr_`) — 10 pieces

| Piece | What it is | Tris |
|---|---|---|
| `shr_chest_small` | iron-banded chest, lid animated (open / locked-shake / trapped-spring) | 300 |
| `shr_chest_large` | double-wide chest with two hasps; same three animations | 520 |
| `shr_stairs_down` | a 4 m stair block descending into a black fade plane; the Stairs room's centrepiece | 400 |
| `shr_waystone` | a 2.5 m standing stone with a carved spiral that glows when lit (emissive channel) | 800 |
| `shr_campfire` | ring of stones, logs, a flame sprite and a cook-pot hook; the Rest room's centrepiece | 180 |
| `shr_torch_sconce` | wall sconce with flame sprite; the only dynamic light besides the party's torch | 90 |
| `shr_trap_plate` | a 1 m pressure plate, flush; swapped for a kit-specific skin by material only | 24 |
| `shr_lore_tablet` | a 1.2 m stone tablet on a plinth, inscribed (a decal) | 160 |
| `shr_gold_pile` | coins decal plane + 3 small heaps; scales with the gold amount | 60 |
| `shr_door_frame_fx` | the lit-door marker: an emissive rim that outlines a doorway the party can take | 40 |

#### Zone 1 — the Cellars kit (`cel_`) — 24 pieces

| Piece | What it is | Tris |
|---|---|---|
| `cel_floor_flag_a` | 2 m flagstone tile, clean | 2 |
| `cel_floor_flag_b` | flagstone tile, cracked with a raised corner | 12 |
| `cel_floor_dirt` | packed earth tile for the kennels and cisterns | 2 |
| `cel_floor_puddle` | decal plane, wet reflection | 2 |
| `cel_floor_grate` | iron drain grate over a black hole | 60 |
| `cel_wall_brick_2m` | brick wall segment, 3.5 m high | 24 |
| `cel_wall_brick_dmg` | collapsed segment with a rubble skirt | 180 |
| `cel_wall_shelf` | wall segment with built-in wine racks (empty bottles are a decal) | 320 |
| `cel_wall_corner_in` | inside corner post | 80 |
| `cel_wall_low` | 1 m half wall for kennel pens | 40 |
| `cel_door_arch` | open brick arch, 2 m | 220 |
| `cel_door_wood` | arch + plank door, hinge animated | 480 |
| `cel_door_portcullis` | iron portcullis for Locked doors, lift animated | 650 |
| `cel_door_secret` | brick panel that slides aside; identical to `cel_wall_brick_2m` until found | 120 |
| `cel_pillar_brick` | 0.6 m square brick pillar, 3.5 m | 48 |
| `cel_beam_timber` | 8 m ceiling beam with hooks | 36 |
| `cel_barrel` | oak barrel; also the kickable cover prop in the tap-room | 160 |
| `cel_cask_large` | 2 m wine cask on a cradle; the Sealed Cask curio | 320 |
| `cel_crate_stack` | three crates, nailed; cover mark for enemy back rows | 36 |
| `cel_table_long` | 4 m trestle table with benches | 200 |
| `cel_rat_nest` | straw, bones and rags; the Rat-King's Nest curio | 260 |
| `cel_cage_hanging` | iron cage on a chain, prisoner mesh optional; the Hanging Cage curio | 420 |
| `cel_banner_grin` | torn cloth banner with the Company's painted grin | 60 |
| `cel_merchant_cart` | the pedlar's handcart with awning and lamp | 900 |

- **Palette:** brick ochre `#7A5230` · mortar grey `#5B5650` · damp green `#3F5A3A` · accent lantern amber `#E8A33C`.
- **Light sources:** `shr_torch_sconce` ×2–4 per room (warm 2,700 K, slow flicker); a brazier (`shr_campfire` on an iron stand, +15 light when lit) in guardposts; the party's torch.
- **Fog / ambience:** warm brown depth fog 10–40 m; dust motes; drips in cisterns; distant Company laughter and a barking dog as one-shots; rat squeaks scale with Vermin on the floor.
- **Music mood:** lute and bowed bass in a loping 6/8, Mixolydian with a sliding flattened sixth over a dropped-tuning drone; hand drums and a cracked trumpet motif for the Company; fights go to 4/4 at 112 bpm with a snare roll; the boss theme is the trumpet motif in a drunken 3/4.

**Cellars room templates (10).** Camera notation: the compass side the camera sits on (relative to the template's north), pitch, distance to the centre mark, vertical FOV; landscape phone. Marks: heroes on **HF1 HF2 / HB1 HB2** 2 m inside the entered door, pets on **P1–P4** behind them; enemies on **EF1–EF3 / EB1–EB3** 6 m away. A template lists its legal *fight axes*; the engine mirrors the marks to the entered door.

| Template | Footprint | Sockets | Hosts | Fixed props | Camera | Marks / notes |
|---|---|---|---|---|---|---|
| `cel_t_storeroom` | 1×1 | N E S W | Entry, Fight, Curio | 3 crate stacks, 4 barrels, 2 sconces | S · 38° · 13 m · 40° | any axis; two crate stacks are cover marks for EB enemies |
| `cel_t_wine_vault` | 2×1 | W E, N on the east cell | Fight, Elite, Treasure | shelves N and S, 3 large casks, a Sealed Cask socket | W · 30° · 16 m · 38° | axis W↔E; casks cover the enemy back row |
| `cel_t_cistern` | 1×1 | N S | Fight, Gauntlet, Curio | floor grate centre, puddles, hanging chain | E · 45° · 12 m · 42° | axis N↔S; the grate is the Loose Flagstone socket |
| `cel_t_guardpost` | 1×1 | N E S W | Fight, Elite, Merchant | long table, 4 stools, brazier, banner | N · 35° · 13 m · 40° | the brazier is a +15 light curio; the cart parks on the W wall |
| `cel_t_kennels` | 2×1 | W E | Fight, Elite, Gauntlet | 4 pens of low walls, 2 rat nests, a hanging cage | S · 40° · 17 m · 40° | axis W↔E; the pens add 2 *kennel* enemy marks (6 enemies without crowding) |
| `cel_t_cold_hearth` | 1×1 | S, optional E | Rest | campfire, sack piles, bone pile, cook-pot | N · 30° · 10 m · 36° | no fight; four seats around the fire |
| `cel_t_stairwell` | 1×1 | one, any side | Stairs, Entry | stairs block, sconce, the entry lantern | faces the stairs · 32° · 11 m | the Entry variant holds the Waystone on F1 |
| `cel_t_strongroom` | 1×1 | one, any side | Treasure, Secret | 1–2 chests, gold pile, portcullis skin | S · 45° · 11 m · 42° | — |
| `cel_t_gallery` | 3×1 | W E | Gauntlet, Fight | timber beams, chains, a tripwire rail each third | N · 28° · 22 m · 36° | three trap sockets in a row; fights use the middle cell's marks |
| `cel_t_tap_room` | 2×2 | S (party), E and W (crew) | Boss F3 | dais and the Captain's chair, long table, 6 lantern hooks, 8 barrels, banners | S · 32° · 20 m · 44° | Vexa on EB2 on the dais, crew on EF1–3; E/W doors are add spawns |

#### Zone 2 — the Crypts kit (`cry_`) — 22 pieces

| Piece | What it is | Tris |
|---|---|---|
| `cry_floor_slab` | 2 m grave slab tile, names worn off (decal) | 4 |
| `cry_floor_slab_open` | slab tile with the lid pushed aside, a dark hole | 40 |
| `cry_floor_bonegrate` | iron grate over a pit of bones (the bones are a decal plane 1 m down) | 70 |
| `cry_floor_mist` | translucent floor-hugging mist plane, scrolls | 2 |
| `cry_wall_niche_2m` | wall segment with three burial niches, two filled | 140 |
| `cry_wall_plain_2m` | dressed stone wall, 3.5 m | 24 |
| `cry_wall_bone_2m` | ossuary wall: skulls and long bones stacked (a repeating texture on a relief mesh) | 260 |
| `cry_wall_corner_in` | corner post with a carved mourner | 160 |
| `cry_door_arch` | pointed stone arch, open | 240 |
| `cry_door_iron` | arch + barred iron gate, swing animated | 520 |
| `cry_door_portcullis` | the Falling Portcullis trap and the Locked-door skin | 650 |
| `cry_door_secret` | a niche wall whose middle niche swings; identical to `cry_wall_niche_2m` until found | 180 |
| `cry_pillar_cluster` | clustered column, 3.5 m, with a candle shelf | 220 |
| `cry_vault_rib` | ceiling rib, 8 m, so the top of frame is not flat | 48 |
| `cry_sarcophagus` | stone sarcophagus, lid animated (the Sealed Sarcophagus curio) | 480 |
| `cry_coffin_wood` | plain wooden coffin; stacks; the Coffin Catapult projectile | 120 |
| `cry_urn_row` | five funerary urns on a shelf (the Funeral Urns curio); each urn breaks separately | 300 |
| `cry_candle_ring` | twelve corpse-candles on an iron ring, each with its own emissive flag | 360 |
| `cry_statue_weeping` | a hooded mourner statue, 2.4 m, with a basin (the Weeping Statue curio) | 900 |
| `cry_bell_grave` | a small bell on a gallows frame with a rope (the Grave Bell curio) | 240 |
| `cry_web_sheet` | a translucent web plane with a tear; spider rooms get 3–6 | 20 |
| `cry_bier_stone` | the Warden's bier: a raised slab with a shrouded figure | 420 |

- **Palette:** bone `#D9CBB0` · slate `#3C4048` · grave-moss teal `#2F5F5A` · accent corpse-candle green `#8FE3A1`.
- **Light sources:** corpse-candles (cold green, slow pulse) on pillar shelves and in the candle ring; one moon shaft through a grate on F4 only; the party's torch. No braziers: the only +light here is torches and the Mourner's Candles curio.
- **Fog / ambience:** cold grey-green depth fog 6–28 m; floor mist everywhere; wind in unseen vents; the Warden's far bell every 90–150 s; bone-clicks when Restless Dead are adjacent (scouting feedback).
- **Music mood:** Dorian at 60 bpm; bowed double bass on long tones, bone-rattle and frame drum on the off-beats, a wordless choir in whole-tone clusters that resolves only at rest rooms; the Warden's theme a slow descending tetrachord on reed organ, in canon with itself at 72 bpm for the Vigil; tremolo harp in spider rooms.

**Crypts room templates (10).**

| Template | Footprint | Sockets | Hosts | Fixed props | Camera | Marks / notes |
|---|---|---|---|---|---|---|
| `cry_t_ossuary` | 1×1 | N E S W | Fight, Curio, Entry | bone walls on two sides, urn row, 2 candle brackets | S · 36° · 13 m · 40° | any axis; the urn row is a curio socket |
| `cry_t_catacomb_run` | 2×1 | W E | Fight, Gauntlet | niche walls both long sides, 4 coffins, mist | N · 28° · 17 m · 38° | axis W↔E; Bone Scythe socket at the midline |
| `cry_t_chapel` | 2×2 | S, N | Elite, Curio, Treasure | altar step, weeping statue, candle ring, 2 clustered pillars | S · 34° · 20 m · 44° | axis S↔N; pillars are cover; an elite stands on the altar step (EB2, raised 0.6 m) |
| `cry_t_sextons_cell` | 1×1 | one, any side | Rest | hearth niche with campfire, a cot, the sexton's tools, a shuttered window | N · 30° · 10 m · 36° | no fight; Field Repair +1 rank here |
| `cry_t_crossing` | 1×1 | N E S W | Fight, Merchant, Entry | a sarcophagus in each corner, vault ribs, central bracket | SE · 40° · 14 m · 42° | the sarcophagi are cover marks; the barrow parks on one |
| `cry_t_well_of_bones` | 1×1 | N S | Fight, Gauntlet | bone-grate floor over a pit, 2 brackets, portcullis frames | E · 48° · 12 m · 42° | axis N↔S; Falling Portcullis socket on the N door; Grave Breath vent under the grate |
| `cry_t_reliquary` | 1×1 | one, any side | Treasure, Secret | chests on a shelf, a reliquary niche (curio), iron gate skin | S · 45° · 11 m · 42° | — |
| `cry_t_stair_shaft` | 1×1 | one, any side | Stairs, Entry | a spiral stair around a central pillar | faces the stair · 30° · 11 m | the Entry variant holds the Waystone on F4 |
| `cry_t_spider_gallery` | 3×1 | W E | Fight, Elite | 6 web sheets, 3 cocoons (wrapped coffins), vault ribs | N · 26° · 22 m · 36° | the enemy back-row marks are *ceiling* marks 2.5 m up: Tomb Spiders drop from them |
| `cry_t_wardens_vigil` | 2×2 | S (party), secret doors E and W | Boss F6 | the bier centre, candle ring, 4 clustered pillars, niche walls | S · 30° · 21 m · 44° | the Warden on EB2 beside the bier; the secret doors are add spawns, open at phase 2 |

#### Zone 3 — the Drowned Vault kit (`vlt_`) — 23 pieces

| Piece | What it is | Tris |
|---|---|---|
| `vlt_floor_basalt` | 2 m wet black-stone tile, high roughness variation | 4 |
| `vlt_floor_water_knee` | water plane tile, 0.5 m deep, caustic-scrolling shader; characters wade | 2 |
| `vlt_floor_water_deep` | black water plane, 2 m deep, impassable; a fog volume sits on it | 2 |
| `vlt_floor_channel` | a 1 m sluice channel through the tile, water flowing | 36 |
| `vlt_floor_anemone` | tile with a cluster of glowing anemones (emissive, the Anemone Floor trap skin) | 180 |
| `vlt_wall_vault_2m` | dressed vault wall with a tide-line decal and verdigris drips | 30 |
| `vlt_wall_shelf_2m` | treasury shelf wall with empty strongboxes | 280 |
| `vlt_wall_breach` | a wall burst inward by water, rubble and a waterfall sheet | 400 |
| `vlt_wall_corner_in` | corner post with a chained ring | 90 |
| `vlt_door_arch_iron` | iron-bound vault arch, open | 300 |
| `vlt_door_vault` | a round vault door on a hinge, the Locked-door skin, swing animated | 1,100 |
| `vlt_door_sluice` | a sluice gate that lifts, the Tide Gate trap skin | 500 |
| `vlt_door_secret` | a shelf wall that pivots | 300 |
| `vlt_pillar_chained` | square pillar wrapped in chain, 3.5 m | 140 |
| `vlt_plinth_sentinel` | a plinth with a kneeling construct (dormant Vault Sentinel mesh is the bestiary's) | 260 |
| `vlt_altar_tide` | a black altar with a shell basin and three cult lamps (the Tide Altar curio) | 700 |
| `vlt_lamp_cult` | an oil lamp with a blue flame on an iron stand | 110 |
| `vlt_wheel_sluice` | a 2 m iron wheel on a post, turn animated (the Rusted Sluice Wheel curio and the arena control) | 380 |
| `vlt_cage_thrall` | a half-submerged cage with a slumped figure (the Thrall's Cage curio) | 460 |
| `vlt_chest_drowned` | a `shr_chest_large` variant lying on its side in the shallows, weed-wrapped | 560 |
| `vlt_jar_leech` | a glass jar of black leeches on a shelf (the Leech Jar curio) | 120 |
| `vlt_raft_merchant` | the pedlar's raft, poled, with a lamp | 800 |
| `vlt_throne_hollow` | the Hollow King's throne on a dais of eight steps, half submerged; the gallery behind it | 2,400 |

- **Palette:** wet basalt `#23303A` · verdigris `#3F8C7E` · brine foam `#A9C5CC` · accent deep-lantern cyan `#58D3E0`.
- **Light sources:** bioluminescent anemones (cyan, decorative, no +light); cult lamps (blue oil flame) in merchant and curio rooms; caustics projected on the walls (an animated texture, not a light); the party's torch. The darkest zone by design: lowest entry light, no braziers.
- **Fog / ambience:** dense teal depth fog 4–20 m; a fog volume over deep water; constant dripping; sloshing on wading tiles; a chant that grows a floor at a time; a sub-bass boom when the tide rises.
- **Music mood:** Phrygian; tremolo strings under a submerged bell and a waterphone; the cult chant in parallel fifths, wordless; 3/4 at 54 bpm that turns 7/8 under Naesa. The Throne theme is a four-note leitmotif heard once in each zone's mode, then on pipe organ and bass drum at 72 bpm, with the Company's trumpet, the Warden's reed organ and the cult's bell each returning as that zone's hunter enters.

**Drowned Vault room templates (10).**

| Template | Footprint | Sockets | Hosts | Fixed props | Camera | Marks / notes |
|---|---|---|---|---|---|---|
| `vlt_t_sluice_hall` | 2×1 | W E | Fight, Gauntlet | a channel down the middle, the sluice wheel at one end, chained pillars | N · 28° · 17 m · 38° | axis W↔E; the channel is the Sluice Surge socket; enemies stand across it |
| `vlt_t_flooded_cell` | 1×1 | N S | Fight, Curio | knee-deep water, a drowned chest socket, a tide-line | E · 44° · 12 m · 42° | axis N↔S; *wading*: −5 Speed for everyone in fights here (on the door preview) |
| `vlt_t_sentinel_hall` | 2×2 | S N E W | Elite, Fight | 4 sentinel plinths, shelf walls, 2 cult lamps | S · 34° · 20 m · 44° | plinths are the enemy back-row marks; dormant Sentinels wake for Elite fights; the Sentinel Eye socket is the centre |
| `vlt_t_dry_ledge` | 1×1 | one, any side | Rest | a dry shelf above the water, campfire, cult lamp, rope ladder | N · 30° · 10 m · 36° | no fight; the camera pulls back over the water |
| `vlt_t_cult_dock` | 2×1 | W E, S | Merchant, Curio, Treasure | a stone dock, mooring rings, raft socket, Tide Altar socket | S · 36° · 16 m · 40° | — |
| `vlt_t_anemone_grotto` | 1×1 | N E S W | Fight, Curio | 6 anemone tiles, a breach wall with waterfall, leech jar shelf | SW · 40° · 13 m · 42° | any axis; the Anemone Floor socket; light never drops below 10 here |
| `vlt_t_strong_vault` | 1×1 | one, any side | Treasure, Secret | round vault door skin, shelf walls, 2 chests, gold pile | S · 45° · 11 m · 42° | — |
| `vlt_t_stair_well` | 1×1 | one, any side | Stairs, Entry | a stair descending into water, water pouring down it | faces the stair · 30° · 11 m | the Entry variant holds the Waystone on F7 |
| `vlt_t_drowned_chapel` | 2×2 | S (party) | Boss F7 | a sunken nave: pews half under water, the Tide Altar on a dais, the sluice wheel on the W wall, 3 tentacle marks at the N edge | S · 30° · 21 m · 44° | heroes on a dry step; Naesa on EB2; the water level (0–4) is an arena state |
| `vlt_t_throne` | 3×2 | S (party), gallery N (no door) | Boss F8 | the throne on 8 half-submerged steps, a gallery with 6 cult lamps, 6 chained pillars, the breach wall | S · 28° · 26 m · 46° | the King on the throne (EB2, raised 2 m) until phase 2, then EF2; adds enter at the E/W water edges; the gallery lamps are the Silence tell |

**As built (Phase 6, 2026-10-28 — D-110, D-114).** The four kits are built by script (`tools/blender/env/`), one rigid
`.glb` each with its manifest (`client/public/models/env/<zone>.json`). The 2 k atlases above became the zone palette with
ambient occlusion baked into the vertex colours (D-110), so the floor tile and the plain wall carry their joints as
geometry and exceed the triangle figures above (the Cellars floor 52, the Crypts floor 38 and wall 66, the Vault floor
10); every other piece is at or under its figure. A **doorway piece is 4 m wide** (the 2 m opening + 1 m of wall each
side) so that it sits on the 2 m wall grid; each zone also has **cut-away** shell pieces (a low wall, doorway and
corner) for the camera side, where wall-hung props are hidden. Template ids are kebab-case in content
(`cel-t-storeroom` is the `cel_t_storeroom` above). **Pieces the templates needed that the tables above do not list**
(Proposed): shared `shr_brazier`, `shr_stairs_up`; Cellars `cel_stool`, `cel_sack_pile`, `cel_bone_pile`,
`cel_chain_hanging`, `cel_lantern`, `cel_lantern_hook`, `cel_tripwire_rail`, `cel_dais`, `cel_chair_captain` and the curio
looks `cel_dice_table`, `cel_larder`, `cel_toll_shrine`, `cel_gallows_beam`; Crypts `cry_vault_rib_half`,
`cry_candle_bracket`, `cry_candle_crown`, `cry_altar_step`, `cry_hearth_niche`, `cry_cot`, `cry_sexton_tools`,
`cry_window_shuttered`, `cry_shelf_stone`, `cry_reliquary_niche`, `cry_stair_spiral`, `cry_cocoon`, `cry_bone_pile`,
`cry_merchant_barrow`, `cry_embalmer_table`, `cry_ledger_lectern`; Vault `vlt_floor_basalt_wet`, `vlt_floor_water_edge`,
`vlt_wall_pipes_2m`, `vlt_brazier`, `vlt_pew`, `vlt_banner_tide`, `vlt_quay_edge_2m`, `vlt_rope_ladder`,
`vlt_stairs_flooded`. The Vault's palette lifts the wet basalt to `#34444E` (floors) and `#4D6372` (walls) so its rooms
read on the phone. The Crypts and Vault templates are written (`cry-t-*.json.later`, `vlt-t-*.json.later`; the phone's
gallery shows them: title → **Monsters & rooms** → **Rooms**) and switch on with their zones in Phase 7 (D-113).

**As built (Phase 7, pass C1).** The client dresses the new curios with the kits' own pieces (`client/src/scene/room/dress.ts` `curioPiece`): the Bone Reliquary on `cry_reliquary_niche`, the Embalmer's Table on `cry_embalmer_table`, the Warden's Ledger on `cry_ledger_lectern`, the Sentinel Plinth on `vlt_plinth_sentinel`, the Priestess's Hymnal on the shared `shr_lore_tablet`; the Brine Pool is a grey-box pool (the Vault's water pieces are floor tiles, not props). The Mourner's Candles now draw their candle ring — the urn row's match had caught them ("mo*urn*ers"). **The Waystone** stands only in the entry room of a zone's first floor (F1, F4, F7; `sim/src/explore.ts` `isWaystoneFloor`): on the far side, or — when the template's own stairs already stand there — beside them a step into the room, where the landscape HUD cannot hide it. Every other entry room without stairs shows the stairs up the party came down (`shr_stairs_up`). The room panel names the Waystone ("a later delve can start on this floor") and the floor-long effects of two curios: the Mourner's Candles' quiet rooms and a turned sluice wheel.

### 2.3 Floor by floor

Light at entry is what the floor's entry lantern *sets* if the party's light is below it (never lowers). Rooms include Entry and Stairs. Traps band is the difficulty range rolled for the floor (Detection = Perception + light bonus [Radiant +4, Dim +2, Shadowy 0, Dark −3, Pitch −6] + skills + pet). Secrets: chance of a secret room · its door's difficulty. Elite affix counts follow `03` §11.1; the pool is `06` §2.

| Floor | Zone | Monster level | Rooms (min–max) | Light at entry | Encounter table | Elite affixes | Fixed rooms | Traps band | Secrets | Notable curios | Merchant? | Hunter clock | Boss |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | Cellars | 1 | 5–7 (first ever delve: a fixed 3-room tutorial) | 100 | Rat Pack · Cellar Dusting · Toll Collectors (`06` §3.1) | 1 | Entry, Rest, Stairs | 8–12 | 10% · diff 10 | Sealed Cask, Lost Lantern | no | Old Gnaw at 40 | — |
| F2 | Cellars | 2 | 8–10 | 90 | Rat Pack · Cellar Dusting · Toll Collectors · Dog Handlers · Alpha's Warren · Broodmother's Larder (Monster, max one) | 1 | Entry, Rest, Merchant, Stairs | 10–14 | 25% · diff 12 | Company's Dice Table, Hanging Cage, Rat-King's Nest | **yes** (floor before the boss) | Old Gnaw at 40 | — |
| F3 | Cellars | 4 | 8–11 | 85 → arena sets 60 | Cellar Dusting · Dog Handlers · Alpha's Warren · Hexer's Circle · Broodmother's Larder (Monster, max one); Elite room: a champion of the floor's encounter (`06` §2), e.g. the Grinning Bruiser of Hexer's Circle | 2 | Entry, Rest (anteroom), Boss | 12–16 | 25% · diff 14 | Toll Shrine, Gallows Beam | no | none (boss floor) | **Captain Vexa Marrow** |
| F4 | Crypts | 5 | 9–12 | 75 | Grave Watch · Belfry · Shamblers (`06` §3.2); Waystone room | 2 | Entry (Waystone), Rest, Stairs | 16–20 | 25% · diff 18 | Sealed Sarcophagus, Weeping Statue | no | Warden's Hound at 40 | — |
| F5 | Crypts | 7 | 9–12 | 70 | Grave Watch · Belfry · Shamblers · Ghoul Pack · The Sexton's Vigil · Spider's Larder · The Charnel Pit (Monster, max one) | 2 | Entry, Rest, Merchant, Stairs | 18–22 | 25% · diff 20 | Grave Bell, Funeral Urns, Embalmer's Table | **yes** | Warden's Hound at 40 | — |
| F6 | Crypts | 8 | 9–12 | 65 → arena sets 50 | Belfry · Ghoul Pack · The Sexton's Vigil · Spider's Larder · The Charnel Pit (Monster, max one); Elite room: e.g. the Bone Knight of The Sexton's Vigil as champion | 2 | Entry, Merchant, Rest (anteroom), Boss | 20–24 | 25% · diff 22 | The Warden's Ledger, Mourner's Candles | **yes** (on the spine before the anteroom: Naesa's floor follows — rule 13) | none | **the Barrow Warden** |
| F7 | Drowned Vault | 11 | 10–14 | 60 → arena sets 40 | Tide Procession · Drowned Choir · Penance · Sentinel Post · Hag's Salt Circle · From the Deep · The Maw (Monster, max one) (`06` §3.3; a Pearl Ooze joins any Vault fight at 5%); Elite room: e.g. the Vault Sentinel of Sentinel Post as champion; Waystone room | 3 | Entry (Waystone), Merchant, Rest (anteroom), Boss | 26–34 | 25% · diff 30 | the Vault's eight (§2.4) | **yes** (on the spine before the anteroom; the last before the throne, so it always stocks **four Torches** — D-099) | none (boss floor — D-055; the Leech Jar can still bring the Leech, §2.9) | **Sister Naesa** |
| F8 | Drowned Vault (the throne) | 13 | 4 (fixed: Entry, Antechamber fight, Rest, Throne) | throne sets 70 | Antechamber: From the Deep at ×1.2 count; the Throne | 3 | Entry, Antechamber, Rest, Boss | none | none | none | no | none | **the Hollow King** |

Notes: **encounter tables** are `06`'s (§3, written for three players and scaled, `03` §11.2; the names above are its encounter names and their floor ranges); a floor draws from the encounters legal on it with `06`'s weights, never the same encounter twice in a row, and the generator re-rolls the last Fight until the floor meets `06` §8.2's role mix (≥ 2 Fodder-only packs, ≥ 1 Special, ≥ 1 role-Elite from F2, at most one Monster room). **Elite affix bias** (proposed; `06` decides): Cellars speed and theft, Crypts shielding and necrotic auras, Vault lightning and grab. **Expected gold per floor** (runner targets; R ≈ 300 at F1–3, ×1.6 per band): F1 80 · F2 100 · F3 120 · F4 140 · F5 160 · F6 180 · F7 370 · F8 400 — the Vault delve's two floors carry the D band's R ≈ 770 (`08`'s R table), the throne keeping rev. 1's 400.

**Eight floors (D-098; this table is D-104).** The Cellars (F1–3) stay as built and balanced. The Crypts keep F4–6 and their levels; F6 gains a guaranteed merchant because Sister Naesa's floor now follows it (`03` §11.1, lint rule 13). **F7 folds rev. 1's three Vault floors (F7–9) into one:** F7's Waystone entry and entry light 60; every Vault encounter (rev. 1's F7 table and F8–9's); the eight Vault curios (the notable lists of F7–9); the trap band 26–34 (the union of the three; the Hag's Snare moves from 36 to 34, §2.5, since no band ever reached 36); secrets at diff 30 (the band's middle, as on every floor); F9's 10–14 rooms; F8's merchant, moved before Naesa's anteroom and given D-099's four Torches; F9's chapel and its arena light 40. **F8 is rev. 1's F10**, the fixed throne floor, unchanged in shape. Band levels step 1·2·4 | 5·7·8 | 11·13: the Vault's monsters sit at rev. 1's Vault average (L10–13 → L11), the King one level under rev. 1's L14 and one above the Fungal Deep's first floor (L12), the last step +2 as in every dungeon (Open question 4). **Dropped:** rev. 1's F8 and F9 as separate floors; the Vault Leech's 40-tick clock and its moving through rests (no hunter stalks a boss floor, D-055, and both Vault floors carry one — §2.9); the Vault Waystone rising from Naesa's altar (the floor memory does that job, D-083); the Throne Waystone as a delve start (no Throne delve, D-099). The levels, gold and merges are Proposed for the runner and checkpoint 2.

**As built (Phase 7, pass C1).** `dungeon.json` carries the table: levels 1·2·4 | 5·7·8 | 11·13 (`levelRange` 1–13; lint rule 45 keeps the levels from falling and the ends on the range), the rooms, entry and arena lights, trap bands, secret odds and difficulties, elite affix counts, the merchants on F2, F5, F6 and F7, and the hunter clock on F1–2 and F4–5 only. Encounters are drawn by table: the Crypts' `crypts-a` (Grave Watch, Shamblers — F4–5), `crypts-b` (Belfry — F4–6), `crypts-c` (Ghoul Pack, the Sexton's Vigil, Spider's Larder — F5–6), `crypts-e` (the Charnel Pit, Monster — F5–6); the Vault's `vault-a` (its six fights), `vault-e` (the Maw) and `vault-throne` (F8's antechamber). **F8** is G3's fixed four rooms at light 70, with no trap and no secret; its antechamber is **From the Deep at ×1.2 count**, read as 2 Deep Tentacles + 2 Tidebound Drowners (3 × 1.2 = 3.6 → 4; the extra body is a Drowner because a throne encounter keeps at most two Specials — `throne-antechamber`, Proposed). The Vault's **Pearl Ooze** joins any Vault encounter fight at 5%, in the back row (`zone.joiners`; the Cellars' and the Crypts' draws are unchanged). **Waystones (Proposed):** every zone has one; the town offers the floor memory (D-083) *and* the first floor of each zone whose stone is lit — the floor before it finished, or the previous zone's last boss dead (`sim/src/town.ts` `litWaystones`, `waystoneFloors`). **The role mix (Proposed):** G14 asks only for the roles the floor's own encounters can give (F4's Grave Watch, Belfry and Shamblers hold no role-Elite, so F4 is never re-rolled for one; `explore.ts` `meetsRoleMix`). **Tuning, not code:** the floors' numbers the dungeon file does not carry are `tuning.json` → `floors` (a room's 25% trap chance, a gauntlet's 2–3 traps, one Monster room per floor, the Funeral Urns' odds, the row each class stands in out of combat), and `08`'s R table is `bands` (F 1–3 · E 4–6 · D 7–8 · C 9–13 · B 14–20 · A 21–28 · S 29–32 · SS 33–38, R 300 → 8,060; a chest's band capped at A) — read by `sim/src/economy.ts` `rForFloor` and `chestBandGrade`, with a pinned copy in `sim/src/grades.ts` (a test holds it equal) for the town helpers that take no tuning yet. The deep link `#delve=gravehollow&zone=2` opens F4 and `zone=3` F7, at the zone's recommended level (§8.3 link 1; it used to read the zone as a floor number).

### 2.4 Curios

One tap, two or three choices; outcomes roll on the host's RNG and show as a result card. The **safe item** turns the gamble into a purchase and is consumed. A used curio is inert (`03` §5.1). "Ambush" = a fight that begins with the party surprised.

#### The Cellars (8)

| Curio | Looks like | Choices → outcomes | Safe item |
|---|---|---|---|
| **Sealed Cask** | a 2 m cask on a cradle, bunged and wax-sealed, something scratching inside | *Open* → 60% gold 0.05 R / 25% Plague Rat ambush / 15% a Fine (D) item · *Leave* | **Torch** (consumed): smoke them out → 100% gold 0.05 R |
| **The Company's Dice Table** | a barrel-head with three dice and a chalk tally | *Stake 0.05 R* → 45% win 0.10 R / 40% lose the stake / 15% a Cutpurse ambush that steals 0.05 R first · *Walk away* | **Loaded Dice** (Cutpurse rare part): 100% win |
| **Rat-King's Nest** | straw, rags and bones with a dozen tails knotted together | *Dig* → 50% 3 Rawhide / 35% Plague Rat swarm ambush / 15% Poison 3 turns on the digger · *Burn* (consumes a Torch) → 70% a rare part / 30% nothing | **Foraging rank 3+** (a skill, not an item): *Dig* → 100% 3 Rawhide + a rare part roll at 20% |
| **Hanging Cage** | an iron cage on a chain with a prisoner who says he is not with the Company | *Free him* (Lockpicking vs 12) → 60% he draws the floor map (all rooms revealed) / 30% he is a Company plant: ambush / 10% he gives a Tier I Tome · *Leave him* | **Skeleton Key**: 100% the map |
| **Mouldering Larder** | shelves of cheese and sausage, mostly green | *Eat* → 50% Regen for the next 2 fights / 30% Poison 3 turns on everyone / 20% +1 Cooking ingredient · *Leave* | **Cooking rank 2+**: *Eat* → 100% Regen + 1 ingredient |
| **Toll Shrine** | a crude shrine to the Grinning Captain: a painted grin, coins in a bowl | *Pay 0.10 R* → 100% +10% gold found this floor · *Deface* → 50% Fortify in the next fight / 50% Curse for the rest of the floor · *Leave* | **Holy Water**: cleanse → 100% +10 light and Fear immunity this floor |
| **Lost Lantern** | a Company lantern, still lit, dropped in a hurry | *Pick up* → 70% +15 light / 30% it gutters: −10 light and a Cellar Spider ambush · *Leave* | **Flint & Oil** (merchant): relight → 100% +25 light |
| **Gallows Beam** | a beam with a noose and a pair of good boots still in it | *Search* → 55% gold 0.08 R / 30% a Cellar Spider ambush / 15% Boots (E grade) · *Leave* | **Detection ≥ 14** reveals the Tripwire under it; disarmed → *Search* is 100% boots or gold (50/50) |

#### The Crypts (8)

| Curio | Looks like | Choices → outcomes | Safe item |
|---|---|---|---|
| **Sealed Sarcophagus** | a stone sarcophagus with its lid chained; the chains are warm | *Open* → 45% gold 0.10 R / 35% a Ghoul rises (fight, not ambush) / 20% a Fine (D) relic · *Leave* | **Holy Water**: 100% treasure, lid opens clean |
| **Bone Reliquary** | a niche of finger bones around a saint's skull | *Pray* → 40% Holy blessing (+15% Holy damage, Fear immunity this floor) / 40% nothing / 20% Curse 1 floor · *Take the skull* → 100% 0.06 R and the floor's hunter clock +10 · *Leave* | **Candle of Vigil** (merchant): 100% blessing |
| **Weeping Statue** | a hooded mourner whose basin fills with tears | *Drink* → 50% heal 30% HP to all / 30% Chill 3 turns on all / 20% a Mourner's Tear (rare Mender ingredient) · *Leave* | **Empty Vial**: bottle it → 100% a Mourner's Tear and the heal |
| **Grave Bell** | a small bell on a gallows frame, its rope frayed | *Ring* → 100% a Large chest appears here, **and** the hunter clock +20 (the Hound hears) · *Leave* | **a Cloth unit** (Burlap/Linen): muffle → 100% a Small chest, no clock cost |
| **Funeral Urns** | five urns on a shelf, sealed with pitch | *Smash all* → per urn: 60% 0.04 R / 25% grave dust: Blind 2 turns on the smasher / 15% a Tomb Spider egg hatches (ambush) · *Leave* | **Grave Salt** (merchant): 100% gold from every urn |
| **Embalmer's Table** | a stone table with hooks, jars and a drawer | *Take the tools* → 100% a Field Repair use without material (one item, +10%) · *Search the drawer* → 50% Honing Oil / 30% a poisoned needle: Poison 4 turns / 20% a Tier II Tome · *Leave* | **Trap Disarm rank 3+**: *Search* → 100% Oil or Tome (50/50) |
| **The Warden's Ledger** | a stone book on a lectern, the pages carved | *Read* → 60% the floor's secret door and Key are marked on the minimap / 25% Fear on the reader for 2 fights / 15% an Insight roll at ×3 for the reader · *Leave* | **Reading Glass** (merchant): 100% the map |
| **Mourner's Candles** | a ring of twelve unlit corpse-candles | *Light them* (consumes a Torch) → 100% +20 light and no ambushes for the next 4 rooms · *Snuff and take* → 100% 3 Burlap | the Torch is the item; no gamble |

#### The Drowned Vault (8)

| Curio | Looks like | Choices → outcomes | Safe item |
|---|---|---|---|
| **Tide Altar** | a black altar with a shell basin and three blue lamps | *Offer 0.10 R* → 70% Shield for 30% max HP at the start of the next 3 fights / 30% the cult hears: Tidebound ambush · *Leave* | **Brine Pearl** (Tidebound rare part): 100% the Shield and +15 light |
| **Drowned Chest** | a large chest on its side in the shallows, weed-wrapped | *Haul it out* (Strength ≥ 14 on the hauler) → 65% a Large chest / 20% a Deep Tentacle has it: Grab on the hauler + fight / 15% rusted through, nothing · *Leave* | **Rope & Hook** (merchant): 100% the chest |
| **Thrall's Cage** | a half-sunk cage with a slumped drowned thrall | *Open* → 50% the thrall wakes free and gives a rare part / 35% it attacks (fight) / 15% it dissolves, nothing · *Leave* | **Holy Water**: 100% it wakes free |
| **Sentinel Plinth** | a kneeling construct on a plinth, its chest-core glowing faintly | *Pry the core* (Lockpicking vs 24) → 60% a Construct Core (affix stone) / 40% it wakes: an Elite Vault Sentinel fight · *Leave* | **Field Repair rank 4+**: 100% the core |
| **Brine Pool** | a still black pool with coins on the bottom | *Wade* → 50% gold 0.12 R / 30% Chill and Poison 3 turns on the wader / 20% a Brine Ooze ambush · *Leave* | **Oilskin Cloak** (merchant): 100% gold |
| **The Priestess's Hymnal** | a book chained to a lectern, open, the ink running | *Read* → 50% Silence immunity this floor for the reader / 30% Fear for 2 fights / 20% a Tier II–III Tome of a Mender or Arcanist school · *Leave* | **Wax Plugs** (merchant): 100% immunity (no Tome) |
| **Rusted Sluice Wheel** | a 2 m iron wheel on a post, seized | *Turn* (Strength ≥ 12) → 70% drains the next flooded room (its wading penalty gone, and 0.10 R in the silt) / 30% floods this room: Slow on the party in the next fight · *Leave* | **Field Repair rank 3+**: 100% drain |
| **Leech Jar** | a glass jar of black leeches on a shelf, one of them very large | *Smash* → 55% a rare part / 30% the Vault Leech comes for its brood: a fight with it in this room (not an ambush; it cannot be fled; killed here, it sits out the Hollow King's last phase this delve) / 15% Bleed 3 turns on the smasher · *Leave* | **Torch** (consumed): burn it → 100% a rare part |

**As built (Phase 7, pass C1).** The Crypts' and the Vault's sixteen are `curios` in `dungeon.json`: each choice a list of requirements (an item it consumes — a material or part the delve carries counts — a field-skill rank, an attribute, gold) and an outcome table; an outcome may carry **`also`** lines resolved after its effect (the Reliquary's skull: 0.06 R *and* the clock +10). Their delve-side effects resolve in `sim/src/delve.ts` (`resolveCryptVaultLine`), each documented in `sim/src/skills/custom/` and registered by `_group-crypts.ts` and `_group-vault.ts`. The line of a curio falls on the party's first standing hero — the opener, reader, wader or smasher, as on the Cellars' curios. **Readings (Proposed):** the Sarcophagus under **Holy Water** opens clean on its two good outcomes in their ratio (70% the gold, 30% the D relic); the Grave Bell's Cloth unit is two choices, Linen or Burlap; the **Funeral Urns** roll each of the five (`tuning.json` → `floors.funeralUrns`: 60% 0.04 R, 25% Blind 2 on the smasher, 15% a Tomb Spider hatching — one ambush however many hatch) and Grave Salt pays all five (0.20 R); the Embalmer's tools mend the opener's most worn item by 10%; the Hymnal's Tome is Tier II or Tier III at 10% each; the **Mourner's Candles**' "no ambushes for the next 4 rooms" counts new rooms entered (`FloorRun.quietRooms`); the Drowned Chest's 20% is a Deep Tentacle fight; the **Sentinel Plinth**'s "Lockpicking vs 24" is a rank-3 requirement — the first rank whose roll beats even odds, as the Hanging Cage reads vs 12 — and its 40% wakes an Elite Vault Sentinel; the **Sluice Wheel**'s drain lasts the floor (`FloorRun.sluiceDrained`: the next Tide Gate floods nothing; the silt pays 0.10 R at once); the **Leech Jar**'s 30% is the Vault Leech's own hunter fight in the room — it cannot be fled and never surprises — and a Leech killed there is written into the delve's `huntersKilled`, which the Hollow King's phase 3 reads (§2.9). The contracts name two of these by id: `sealed-sarcophagus` (Keeper's Peace) and `leech-jar`.

### 2.5 Traps

A trap is revealed on entering if the party's best Detection ≥ its difficulty (or by a critical scout from the previous room); revealed, it can be disarmed (Trap Disarm: 50% + 2% × (skill − difficulty / 2), `03` §4.3; fail = it fires on the disarmer at half damage) or walked around unless it blocks a door. Unrevealed, it fires on the lowest-Perception hero unless the trigger says otherwise. *F* = floor number.

#### The Cellars (6)

| Trap | Difficulty | Trigger | Effect | Disarm reward | Revealed by |
|---|---|---|---|---|---|
| **Tripwire Bell** | 8 | crossing the room's midline | the floor clock +4 and the next fight on this floor is an ambush (+30% surprise) | 2 Rawhide, 0.01 R | Detection ≥ 8; any scout |
| **Loose Flagstone** | 10 | stepping on the `cel_floor_flag_b` tile by the grate | the lowest-Perception hero drops 2 m: 8% max HP and Daze | 3 Copper | Detection ≥ 10; a Cellar Hound pet always |
| **Rat Cage Drop** | 12 | opening a specific door (shown on the door once revealed) | a Plague Rat swarm ambush (6 rats at ×1.0, fodder only) | 2 Rawhide, 0.02 R | Detection ≥ 12 |
| **Spring Spikes** | 12 | opening a trapped chest | Pierce 12 + 4F to the opener, Bleed 3 turns | 2 Copper | Detection ≥ 12; a **Skeleton Key** opens it safely |
| **Greased Stairs** | 14 | taking the stairs down | every hero is Slowed for the first 2 turns of the next floor's first fight | Flint & Oil (the grease) | Detection ≥ 14; Cartography rank 2+ (the map shows the stair's wear) |
| **Tar Pot** | 16 | a tripline by the brazier | Burn 3 turns (6 + 2F per tick) on both front-row heroes; +10 light (it burns bright) | Flint & Oil, 0.02 R | Detection ≥ 16 |

#### The Crypts (6)

| Trap | Difficulty | Trigger | Effect | Disarm reward | Revealed by |
|---|---|---|---|---|---|
| **Grave Breath Vent** | 16 | entering the room | Poison 3 turns (5 + 2F per tick) on everyone | Grave Salt | Detection ≥ 16; a Crypt Bat pet always |
| **Falling Portcullis** | 18 | the whole party crossing the N doorway | the back row is caught behind it: HB1, HB2 and the pets cannot act for the first 2 turns of the fight that follows (the room always holds a fight when this trap rolls) | 3 Iron | Detection ≥ 18 |
| **Bone Scythe** | 18 | the midline of `cry_t_catacomb_run` | Slash 15 + 5F to both front-row heroes, Bleed 3 turns | 2 Iron, 0.03 R | Detection ≥ 18; a critical scout |
| **Candle Snuffer** | 20 | touching any candle in the room (curios here are bait) | light −20 | 1 Torch | Detection ≥ 20 |
| **Warding Glyph** | 22 | a casting-class hero (Arcanist, Mender) stepping into the centre | Silence 3 turns on every caster, Shock 2 turns on everyone else | 10% an affix stone, else Honing Oil | an Arcanist in the party always reads it; else Detection ≥ 22 |
| **Coffin Catapult** | 24 | opening a niche in the room | a coffin falls: Blunt 20 + 6F and Stun 1 turn on the lowest-Perception hero | 3 Oak | Detection ≥ 24; Cartography rank 3+ |

#### The Drowned Vault (6)

| Trap | Difficulty | Trigger | Effect | Disarm reward | Revealed by |
|---|---|---|---|---|---|
| **Tide Gate** | 26 | entering a flooded cell | the room floods over 3 ticks: the fight here (if any) is fought wading at −10 Speed and −10 Accuracy for everyone, both sides | 2 Steel | Detection ≥ 26 |
| **Sluice Surge** | 28 | crossing the channel in `vlt_t_sluice_hall` | Blunt 20 + 6F to the front row, Grab 1 turn (the current) | 3 Steel, 0.05 R | Detection ≥ 28; Field Repair rank 3+ (the wheel's set) |
| **Anemone Floor** | 30 | stepping on a glowing tile | Poison 4 turns (6 + 2F per tick) on the stepper; light −5 (the anemones close) | 10% a Brine Pearl, else 2 Wolf Hide | Detection ≥ 30; a Brine Crab pet always |
| **Sentinel Eye** | 32 | the party standing in the room's centre for 1 tick (i.e., opening a curio or chest here) | two Vault Sentinels wake: an Elite fight | a Construct part | Detection ≥ 32; a critical scout |
| **Drowning Bell** | 34 | the room's light being Shadowy or worse when the party enters | Fear on the party for the next fight; light −10 (the bell drowns the lamps; the Vault has no hunter clock to feed, §2.9) | 2 Silk | Detection ≥ 34; inert if light ≥ 51 (a Torch before the door is the counter) |
| **Hag's Snare** | 34 | picking up the room's treasure | Web 2 turns on the picker and a Brine Hag ambush | 0.08 R | Detection ≥ 34; Foraging rank 5+ (the smell of brine-weed) |

**As built (Phase 7, pass C1).** **When an unrevealed trap fires** (`sim/src/delve.ts` `springTraps`; a rule fix — before it, only the *entering* traps ever fired): `enter` on entering the room; `step` when the party crosses it (leaves by a door or the stairs); `open` on the door it blocks, else on opening a chest or curio in its room; `loot` on taking the room's gold or opening its chest; `time` on entering when it reads the light (the Drowning Bell), else on opening a chest or curio there. **Only a revealed trap shuts its door** ("walked around unless it blocks a door" — an unrevealed one used to lock the party in, F2 seed 101); an unrevealed one fires when its door is opened and the party goes on. A trap line with no target lands on the victim — the lowest-Perception hero — alone; `partyFront` and `partyBack` are the heroes' rows, out of combat the row each class stands in (`tuning.json` → `floors.frontRowClasses`: Warden, Blade, Shade, Beast-tamer in front). A status a trap lays outside a fight lands at the start of the next one. Traps may carry a **`placement`** (template ids, room kinds) and a **`condition`** (`lightBelow`, `partyClassIds`). **Readings (Proposed):** the **Falling Portcullis** rolls only in rooms that hold a fight (Fight, Elite, the Key room), fires on entering and Stuns the back-row heroes *and every pet* for 2 turns of that fight; the **Bone Scythe** lies only in `cry-t-catacomb-run`, the **Tide Gate** in `vlt-t-flooded-cell`, the **Sluice Surge** in `vlt-t-sluice-hall`, the **Anemone Floor** in `vlt-t-anemone-grotto`; the **Candle Snuffer** fires as the party crosses the room (its candles line the way); the **Warding Glyph** waits for a caster — it fires only with an Arcanist or a Mender in the party — and Silences the back row and Shocks the front; the **Coffin Catapult**'s niche is the room's curio or chest, so it sits in Curio and Treasure rooms; the **Sluice Surge**'s Grab is the current's hold, read as Stun 1 (a Grab needs a grabber); the **Sentinel Eye**'s "standing in the centre for a tick" is opening a curio or chest in its room, and wakes two Vault Sentinels; the **Drowning Bell** fires on entering only at Shadowy light or worse (`condition.lightBelow` 51); the **Hag's Snare** sits in Treasure rooms and fires on the gold or the chest.

### 2.6 Secret rooms

A secret door is revealed when the party's best Detection ≥ the floor's secret difficulty (§2.3); Shades and Rangers add +10% to the 25% roll that a floor has one. Secrets **reward, never gate**: no key, no path, no boss ever sits behind one.

| Zone | Secret | What it holds |
|---|---|---|
| Cellars | **Smuggler's Cache** | 0.15 R, 2 Torches, a Small chest; 30% a Fine (D) item on the shelf |
| Cellars | **Hearth Shrine** | a cold hearth that lights for the party: blessing *Warm Hands* — Regen for every fight on this floor and +10 light |
| Cellars | **The Company's Bolt-hole** | a crawlway that comes out in the Stairs room: the stairs are revealed and the route marked; taking it costs 0 ticks |
| Crypts | **Ossuary Shrine** | a saint's niche: blessing *Vigil* — +15% Holy damage and Fear immunity for the floor; 20% a Candle of Vigil on the shelf |
| Crypts | **The Warden's Tablet** | a lore tablet (one of five that tell the keep's story); reading it reveals the whole floor map and grants Cartography rank XP ×5 |
| Crypts | **Sexton's Passage** | a shortcut: a stair in the wall to the Stairs room; the floor clock does not tick for the rooms skipped |
| Drowned Vault | **Pearl Cache** | a locked Large chest (Lockpicking vs 30 or a Skeleton Key), 3 units of the zone's material, 0.20 R |
| Drowned Vault | **The Drowned Shrine** | an altar the cult never found: blessing *Undertow* — Shield for 20% max HP at the start of every fight on this floor |
| Drowned Vault | **The Tidebound Confession** | a lore tablet (the cult's own account of what they are waking); reading it before her chapel (F7) marks Naesa's tell on screen and she opens the fight at −10% HP |

**As built (Phase 7, pass C1).** The six are `secrets` in `dungeon.json`: the **Ossuary Shrine**'s *Vigil* and the **Drowned Shrine**'s *Undertow* are blessings for the floor (the Shield is 20% of each hero's own max HP at the start of every fight); the **Warden's Tablet** reveals the floor and gives Cartography XP; **Sexton's Passage** is the shortcut to the Stairs room; the **Pearl Cache**'s Large chest is locked (`chestLocked`) and its 0.20 R is written as gold at the D band's R (154); the **Tidebound Confession** sets the delve's `tidebound-confession` flag, which pass C2's chapel reads (Naesa's tell marked, the fight opened at −10% HP).

### 2.7 Rest, merchant and treasure rooms

**Rest rooms** (one per floor; the anteroom on boss floors): heal **30% HP and pool** for heroes and pets; **loadout swap**; **Cooking** (one meal per rest, +5% to one attribute for the next floor); the pet's once-per-delve **treat**; **Field Repair** (+10% to one item per material unit); **First Aid** on anyone still fallen (revive at 30% without spending the floor's budget); the **floor clock +5**. Per zone: the Cellars' *cold hearth* (a storeroom with a fire you light); the Crypts' *sexton's cell* (his tools give Field Repair +1 rank; a shuttered window shows the moor on F4); the Vault's *dry ledge* above the water — Naesa's anteroom on F7 and the last rest before the throne on F8. *(Rev. 1's Leech that kept moving through a rest went with its clock: no hunter stalks the Vault's two boss floors, §2.9.)*

**Merchant rooms.** The pedlar **Dunmore Quist** holds one Merchant room per floor where one rolls (always on the floor before each boss floor — F2, F5, F6 and F7, lint rule 13; on F6 and F7 the room stands on the spine just before the anteroom): a handcart in the Cellars, a barrow in the Crypts, a poled raft in the Vault; his lamp gives +15 light while the party is there. The Vault's raft on F7 is the last merchant before the throne and **always stocks four Torches** instead of three — one per brazier in the throne room (`06` §3.4), which has no torch rack (D-099). **Stock** (seeded per floor; prices 1.5× town, Haggling applies; he buys at 40% + 0.5% per Haggling rank): 4 Healing Draughts · 3 Torches · 2 Repair Kits · 1 Skeleton Key (0.3 R) · 2 of the zone's safe items (Flint & Oil, Grave Salt, Candle of Vigil, Reading Glass, Oilskin Cloak, Wax Plugs, Rope & Hook, Empty Vial) · 2–3 gear pieces at the floor's centre grade, one for a class in the party · 10% an affix stone. Sold-out lines stay sold out on that floor. Never Tomes.

**Treasure rooms.** A strongroom with **2–4 gold piles** (two fights' gold), **one guaranteed Small chest and a Large chest 20% of the time**, a consumable bundle and a hidden-treasure find (`08` §11 owns the table); chest shapes per `08` §10.3: a Small chest is **locked 20% / trapped 15%**, a Large chest **locked 40% / trapped 25%**. **Locked** needs Lockpicking vs the floor's trap-band top or a Skeleton Key. The trap a trapped chest carries is the zone's: Cellars Spring Spikes / Crypts a Grave Breath puff (Poison 2 turns) / Vault Hag's Snare; a revealed trap shows a red hasp and a Skeleton Key makes any chest safe. Treasure rooms are usually **branch caps** (§2.10): the push-your-luck is the clock ticks it costs to reach them.

**As built (Phase 7, pass C1).** Dunmore's cart is data (`tuning.json` → `merchant`; lint rule 46). Its stock lines are priced in town R before his markup (`economy.merchantMarkup`, 1.5×) and Haggling: 4 Healing Draughts (the small potion), 3 Torches, 2 Repair Kits, 1 Skeleton Key (0.2 R in town, so 0.3 R on the cart), and — read in, Proposed — 2 bundles of Arrows and 1 of Bolts, so a bow or crossbow is never dry before a boss; then 2 each of 2 of the zone's safe items drawn by tag (`safe-item` and `zone:<zone>`; pass B's eight: the Cellars' Flint & Oil; the Crypts' Grave Salt, Candle of Vigil, Reading Glass, Empty Vial; the Vault's Oilskin Cloak, Wax Plugs, Rope & Hook), 2–3 gear pieces at the floor's centre grade (one for a class in the party) and a 10% affix stone. On the floor before a final boss — the next floor is the dungeon's last and carries a boss (`explore.ts` `isBeforeFinalBoss`: F7) — the Torch line is `merchant.beforeFinalBoss`'s four (D-099). His lamp's +15 is `merchant.lightBonus`. On a boss floor (F6, F7) his room is the last spine room before the anteroom (§2.10).

### 2.8 Boss arenas

The bestiary owns attacks, HP and resistances; this file owns the room, the **arena rule**, add timing and the **tell** (the visible cue one turn before the dangerous thing). No ambush roll, no Flee. Phases, attacks, add compositions and first-kill drops are the bestiary's (`06` §3) and are repeated below verbatim; repeats drop the stack at half and normal rolls.

**F3 — Captain Vexa Marrow · `cel_t_tap_room`, light set to 60.** Vexa in her chair on the dais behind a barricade of kegs and the long table: while the barricade stands, melee cannot reach her back row (bows, spells and spears can); shooting a keg (3 hits) spills it and the front floor is *slick* — Slow (1) on any monster that changes rows. With her: **2 Grinning Cutpurses + 1 Grinning Crossbowman** (`06`). *Arena rule — Lights out:* every 3rd round the crew shoots out a lantern (light −10, announced on the timeline strip); below Shadowy her Cutpurses flank (+15% to hit the back row). An Item action with a Torch relights (+25). *Phase 1 (100–50%):* her laugh and raised hat is the tell — next round the fallen adds re-enter by the E/W doors; every 4 rounds, once. *Phase 2 (≤ 50%):* she kicks the barricade over (Blunt to the front row, Daze), steps forward with the cutlass and Haste, and **1 Grinning Netter** enters at the back; light set to 40. **First kill (`06`):** Copper ×8 + Rawhide ×8, a Tier III Tome, one D-grade item, the **Grinning Mask** (C Relic), 1 Standard chest key, title *Toll-breaker*. The **Cellar Waystone** rises through the dais; the stairs to F4 open behind her chair.

**F6 — the Barrow Warden · `cry_t_wardens_vigil`, light set to 50; the lantern drains it −20 when Phase 2 begins.** The bier at the centre inside a ring of twelve candles; four bone piles line the walls (Holy or Fire, 3 hits, burns one out for good); the Warden beside the bier with his lantern and **2 Skeleton Footmen** raised at the start (`06`). *Arena rule — the Warden's Oath:* he never strikes a hero who has not struck him; the first to damage him holds his attention (Mark, 3 rounds, refreshed by each hit), and a Warden-class Taunt is honoured absolutely. A candle goes out each round; at six out his lantern turns green (the tell) and the secret doors open. *Phase 1 (100–50%):* his Toll raises 2 more Footmen from live piles (the bell lifted the turn before is the tell) — with his Hound at heel (a second actor at 60% HP) if the hunter is still alive this delve. *Phase 2 (≤ 50%):* the lantern turns (light −20) and **2 Wraiths** drift in through the secret doors; the lantern swinging toward a hero for one turn is Verdict's tell. **First kill (`06`):** Iron ×8 + Wool ×8 + Bone Shards ×10, a Tier III Tome, one A-grade item, the **Barrow Bell** (D Relic), 1 Grand chest key, title *Keeper's Peace*. The **Crypt Waystone** rises from the bier; the open slab is the stair to F7.

**F7 — Sister Naesa · `vlt_t_drowned_chapel`, light set to 40.** The party on a dry step at the S end; Naesa at the Tide Altar with **2 Tidebound Acolytes + 1 Tidebound Blade** (`06`); three tentacle marks under black water at the N edge. *Arena rule — the Tide:* a water level 0–4 rises one step every 3 rounds (the sub-bass boom is the tell). Step 2: the back row wades (Slow). Step 3: every Lightning attack chains to both rows. Step 4: the three Deep Tentacles rise and Grab a front-row hero each until freed. The **sluice wheel** on the W wall is an Item action (Strength ≥ 12): the tide drops one step. *Phase 1 (100–50%):* Naesa's chant is a 2-round charge; a heavy hit that beats her concentration interrupts it (`03` §3.1); her Tidal Call (the raised conch is the tell) brings a Deep Tentacle up early; fallen adds re-enter once, 4 rounds after they fall. *Phase 2 (≤ 50%):* she walks into the water (Large, the Silence aura) and the tide jumps to step 3; under 20% it rises every 2 rounds. **First kill (`06`):** Steel ×10 + Silk ×10 + Brine Pearl ×3, a Tier III Tome, one A-grade item, the **Tidebound Idol** (C Relic), 1 Grand chest key, title *Tide-turner*. The altar drains and the dry sluice channel opens — the stair to F8: the party goes on to the throne in the same delve or teleports out from the chapel (D-083), and either way the Waystone now offers F8. No Waystone rises here: Gravehollow's stand on F1, F4 and F7, and there is no Throne delve (D-099).

**F8 — the Hollow King · `vlt_t_throne`, light set to 70.** Eight steps rise out of black water to the throne; a gallery of six cult lamps behind it. *Arena rule — the Keep remembers:* on each phase change the room's light drops 25 (70 → 45 Shadowy → 20 Dark), so monster Accuracy and Damage climb with the band (`03` §4.2) and Torches are the counter — a party carrying six fights the last phase in Dim; the F7 merchant always stocks four (§2.7) and the throne has no rack (D-099). *Phase 1 (100–60%):* the King on his throne, out of melee reach (reach, ranged and spells only; Taunt works this phase only); his Court Call brings the Cellars' adds — **2 Giant Rats + 1 Grinning Crossbowman** (`06`) — up the steps. *Phase 2 (60–25%):* he descends to the front row; the gallery lamps flare (the tell) and a Silence pulse hits every caster every 3 rounds; the Crypts answer: **2 Skeleton Footmen + 1 Wraith**, re-called once at 40%. *Phase 3 (≤ 25%):* the water reaches the fourth step and the Vault answers: **2 Deep Tentacles** rise, Naesa's shade appears at 10%, and the three **hunters return** at phase rounds +2, +4, +6 (Old Gnaw, the Warden's Hound, the Vault Leech) — **except any hunter the party killed this delve** — in a Vault delve that can only be the Leech, at the Leech Jar (§2.4); Old Gnaw and the Warden's Hound always answer, since a delve is one zone (D-098). **First kill (`06`):** one **Divine Shard**, Steel ×12 + Silk ×12 + Iron ×12, one S-grade item, a **Tier IV Tome**, the **Hollow Coin** (C Relic), 2 Grand keys, **+1 permanent Luck** (`03` §2 open question 2, proposed), title *Hollow-crowned*, and the **Throne Waystone**, which lights the Fungal Deep's lamp on the map (it starts no Gravehollow delve: there is no Throne delve, D-099). Repeats: the stack at half, a Divine Shard 10%, his three God items at 1% (2% Hard, 4% Dread; `08` §7), no Luck.

**Arena tells and their hints** (D-099). Each tell above also shows a **two-word hint** the first time it fires in a delve — the discipline `06` §8.10 sets for attacks ("Netter reloading") — and never a line of boss dialogue. The hint sits on the timeline strip beside the cue for the one turn before what it warns of.

| Arena | The tell (one turn before) | Hint | What follows |
|---|---|---|---|
| F3 Vexa | a lantern's icon on the timeline strip | "Lantern targeted" | *Lights out*: the crew shoots it out (light −10) |
| F3 Vexa | her laugh and raised hat | "Crew rallying" | the fallen adds re-enter by the E/W doors |
| F6 the Warden | the bell lifted | "Bell lifting" | *Toll*: 2 Footmen rise from live piles |
| F6 the Warden | the sixth candle out, his lantern turning green | "Lantern greening" | the secret doors open |
| F6 the Warden | the lantern swinging toward a hero | "Lantern swinging" | *Verdict* on that hero |
| F7 Naesa | the sub-bass boom | "Tide rising" | the water climbs one step |
| F7 Naesa | the raised conch | "Conch raised" | *Tidal Call*: a Deep Tentacle rises early |
| F8 the King | water lining the floor | "Tide pulling" | the throne's tide pulls the rows (`06` §3.4) |
| F8 the King | the gallery lamps flaring | "Lamps flaring" | a Silence pulse on every caster |
| F8 the King | a hunter's ring at the water's edge | "Hunter returning" | Old Gnaw, the Hound or the Leech enters (phase 3) |

**As built (Phase 7, pass C2).** Each arena is data in its boss's monster file — `boss.arena` (the room, this table's rows as `tells`, the `rules`) and per-phase `light`, `speed`, `row`, `size`, `opener`, `tide` and `hooks` — run by `sim/src/arena.ts` from a closed vocabulary of eighteen rule kinds (`content/README.md` "Boss arenas"; lint rules 50–54). Every arena moment is a fight-log event `{ kind: 'arena', data: { what, boss, … } }` and every tell `{ kind: 'tell', data: { hint, cue, source, ref, first, boss } }`; a boss is met once a delve, so a hint's first time in the fight is its first in the delve. The delve keeps one row per boss fight in `stats.bossArenas` (§8.2's lanterns out, candles, tide step 4, the third Throne hunter). The room **sets** the floor's `lightAtArena`, up or down.
- **Vexa.** The barricade (two kegs, three shots each — Proposed) keeps a non-reach melee blow off her back row; a spilled keg makes the floor slick (Slow 1 on a monster that changes rows); she kicks it over as her telegraphed phase-2 opener ("Boot raised"). The barricade, like the throne below, binds melee only while someone in the party can reach past it (a bow, a spell, a spear, a reach skill): an all-melee party is never locked out (Proposed). Lights out every 3rd round while her crew stands (−10, "Lantern targeted" the round before); in Dark or Pitch her Cutpurses reach the back row at +15; her fallen crew re-enter every 4 rounds of phase 1, each once ("Crew rallying"); phase 2 sets the light to 40 and brings the Netter; under 20% she drops the coin and attacks twice a turn. Parts: the grin-mask (Blunt, 6%), the coin (a Pierce crit, 6%).
- **The Barrow Warden.** The Oath: he never strikes a hero who has not struck him (with nobody, he tolls, braces or guards); the striker is Marked 3, refreshed by each of their blows; a Warden-class Taunt binds him in both phases. A candle goes out each round; at the sixth his lantern greens and the next round the secret doors open with 06's two Wraiths — or phase 2 opens them first; the Wraiths come once (Proposed). Toll tops his raised Footmen up to two, and only from live bone piles (four; Holy or Fire three times burns one out). The Hound stands at heel at 60% HP unless killed this delve. Phase 2's lantern drains 20 unless the lantern is broken. Parts: the bell (Blunt, 8% — no Toll), the lantern (Holy or Fire, 5% — the light stops dropping, Verdict loses its Mark).
- **Sister Naesa.** The tide rises a step every 3 rounds ("Tide rising"), every 2 under 20%; from step 2 the back row is Slowed each round; from step 3 half of a single-target Lightning blow runs through the water into everyone else on that side (Proposed); at step 4 up to three Deep Tentacles rise and Grab a front-row hero each. The sluice wheel is an Arena action (Strength 12, an Item's weight): the water drops a step. Phase 2: Large, the front row, the tide at 3, the Silence aura. Fallen adds return once, 4 rounds after they fall. Tidal Call ("Conch raised") raises one half-HP tentacle — at most one standing — that Grabs the weakest arm unless that hero guards. Her chant is the Hymn, telegraphed ("Chant rising"). Parts: the conch (any 5% blow — no Tidal Call), a tentacle arm (Slash 10%, from phase 2 — no Embrace, Lash ×1.0).
- **The Hollow King.** Out of melee reach on his throne in phase 1 (the no-lock rule above). Each phase change snuffs 25. A Torch as an Item action relights one of four braziers for a Torch's worth (`torchValue`: 25, Dread 20, the Candle Pact 15), once each per phase; the Torch is greyed when all four are lit. Shadowy or darker his Gaze takes the back row; Dark or Pitch +20 crit; Radiant: his Shadow ×0.75 and his adds Feared. The tide pulls every 3 rounds, every 2 in phase 3 ("Tide pulling"): a hero who swapped rows since the tell is spared, the front is Slowed 1 and owes his next Blade ×1.5, the back is Chilled 2. Court Call tops his court up to 2 Giant Rats and a Crossbowman. Phase 2: Huge, the lamps' Silence pulse at every caster every 3 rounds ("Lamps flaring"), the fallen Crypt adds re-called at 40%. Phase 3: Speed 120, the water at the fourth step, 2 Deep Tentacles, Naesa's shade (1 HP) at 10%, the three hunters at phase rounds +2, +4, +6 ("Hunter returning") at the throne's level (Proposed), never one killed this delve. Parts: the crown (Holy or Blunt, 8% — the Gaze loses Fear), the sword arm (Slash, 10% — the Blade ×1.3), the throne's chain (Lightning, 5% — the tide stops). His Snuff is the phase change's step, never a rolled move.
- **Telegraphs** (`06` §8.10). Any monster's attack with a `tell` winds up on its turn (a normal weight, tuning `arena.tell`) and lands on its next, unless a Daze, Stun, Silence, Freeze or Petrify lands on it in between; the target named at the tell keeps the blow while it can still be reached. The HUD rings the actor's chip on the strip, badges its card and shows the hint.
- **On auto** (tuning `arena.auto`): a Torch when the light falls below 51 (back to Dim), a brazier unless the throne is Radiant, the sluice wheel from step 2 once a round, a bone pile burnt while the bell is lifted. Swapping on the pull is off (`swapOnPull`): a party that swaps every pull turns its rows inside out (Proposed).
- **On the phone.** The fight HUD shows the arena under the turn banner — the phase, the light and its band, the tide's steps, the braziers relit, the candles, the barricade, the bone piles — and each tell as a pill whose words show the first time; the Arena sheet takes Flee's place, which no boss fight allows; the Torch's line in the throne says what it lights. In 3D: Naesa's phase 2 wears the tentacle arms, the Bursting Corpse swells on its tell, the candle ring goes out counter-clockwise, the water rises as a sheet, Vexa, Naesa and the King stand on raised marks, the King's throne rises on its column and a lamp lights him, and the braziers burn or smoulder. Deep link: `#delve=gravehollow&floor=8&seed=4242&party=warden,blade,ranger,mender&room=boss&auto=1` walks into the arena (links 2 and 7's `room=boss`).
- **Rewards.** Every kill's lines, then the first kill's (`DelveOptions.bossKills`, the profile's when the delve began). A boss's own fight gold is `08` §11's Gold; the first kill adds twice that (`06`'s ×3; Proposed). Chest keys and the Divine Shard count in materials; the title and +1 Luck reach the heroes standing when the town settles the delve. The King's God-item lines wait for Phase 11's God items (Proposed).

### 2.9 Hunters on this dungeon

| Hunter | Zone | Enters | Moves | Above band by | Drops | If killed |
|---|---|---|---|---|---|---|
| **Old Gnaw** | Cellars F1–2 | 40 ticks | 1 room / 2 ticks | +3 levels (`06`: level = floor +3), elite body | guaranteed rare part (Loaded Dice 25%) | gone for that delve; he still answers the Hollow King, whom no Cellars delve reaches (a delve is one zone, D-098) |
| **the Warden's Hound** | Crypts F4–5 | 40 ticks | 1 room / 2 ticks | +3 levels, elite body | guaranteed rare part | absent from the Warden's side on F6 that delve; it still answers the King |
| **the Vault Leech** | the Drowned Vault: no floor clock (F7 and F8 both carry a boss — D-055) | only when the Leech Jar rolls it (§2.4, F7): a fight in that room | — (it never stalks) | +3 levels (L14 on F7), elite body | guaranteed rare part (Brine Pearl 25%) | sits out the King's phase 3 that delve |

A hunter shows on the minimap as a pulsing ring two rooms out; its arrival is a fight that cannot be fled and never ambushes the party (it is loud). The stairs end it. None on a boss floor (D-055): F3, F6, F7 and F8 — so the Drowned Vault, whose two floors both carry a boss, has no hunter on the clock; its Leech is met at the Leech Jar (§2.4) or in the throne room (§2.8), and the Pacts that move the hunter cannot be chosen for a Vault delve (§6.2).

**As built (Phase 7, pass C1).** The **Warden's Hound** (`wardens-hound`) and the **Vault Leech** (`vault-leech`) are monsters with hunter blocks (+3 levels, in at tick 40, a room per 2 ticks, never fled, a guaranteed rare part, never through a rest). The Crypts' clock runs on F4–5 (`hunterClock` is null on F3 and F6–8). The Vault keeps `hunterId: vault-leech` with no clock on either floor; its one way in is the Leech Jar, whose fight is the hunter's (`asHunter`: no fleeing, no surprise). Every hunter killed in a delve — stalking, or at the Jar — is written into the delve's `huntersKilled` (`DelveState`, optional, absent = none), which pass C2's Hollow King reads for his phase 3.

### 2.10 The floor-generation grammar for Gravehollow Keep

Floor seed = `hash(matchSeed, dungeonId, floorNumber)` from the host's 64-bit seed (`03` §11.1); integer PRNG only; sorted iteration; identical on every phone. The grammar makes a **mission graph**, then **lays it out** on the 8×6 grid with templates, then **decorates**.

**Start symbol and rewrite rules** (`{a–b}` = repeat a to b times, chosen by the seed; `|` = alternatives; `?` = optional; weights in brackets):

```
G1   Floor(normal)   → Entry · Spine · Stairs
G2   Floor(zoneBoss) → Entry · Spine · Anteroom(Rest) · Boss
G3   Floor(throne)   → Entry · Antechamber(Fight) · Rest · Boss              (F8: fixed, no further rules)
G4   Spine           → Seg{3–5}
G5   Seg             → Room  |  Room · Fork                                   (Fork on 45% of segments, at most 3 Forks per floor)
G6   Fork            → Branch{1–2}
G7   Branch          → Room{0–2} · Cap
G8   Cap             → Treasure [40] | Curio [30] | Fight [20] | Elite [10]
G9   Room            → Fight [50] | Elite [8] | Rest [10] | Merchant [5] | Treasure [7] | Curio [15] | Gauntlet [5]
G10  Rest            : exactly one per floor — if G9 rolled none, the Spine's middle Room becomes Rest; a second Rest re-rolls as Fight
G11  Merchant        : on the floor before each boss floor (F2, F5, F6, F7) exactly one — if none rolled, the last Spine Room before Stairs (on a boss floor: before the Anteroom) becomes Merchant; on other floors at most one; F7's stocks four Torches (§2.7)
G12  KeyLock (30%)   : choose a Spine edge after the Rest; mark its door Locked; place the Key as the loot of a room on a Branch rooted *before* the lock
                       (if no such Branch exists, insert Fork → Branch(Fight·Cap(Fight)) at the Room before the lock and put the Key in the Cap)
G13  Secret (25%)    : attach Secret to a random Room with a free socket; its door difficulty = the floor's secret difficulty (§2.3)
G14  Roles           : re-roll the last Fight room's encounter until the floor meets `06` §8.2's role mix for its floor (≥ 2 Fodder-only packs, ≥ 1 Special, ≥ 1 role-Elite from F2, ≤ 1 Monster room)
G15  Farthest        : after layout, BFS from Entry; if Stairs/Boss is not the unique farthest room by hop count, swap it with the farthest leaf and re-lay out
```

**Room-count clamp:** under 8 rooms (F2+), append a Seg before Stairs (before the Anteroom on a boss floor); over 14, cut the last Branch; F1 clamps to 5–7; F8 is fixed at 4 (G3).

**Template selection:** every template declares `footprint`, `sockets`, `hosts`, `fightAxes`. For a node of kind *k* with graph degree *d*, candidates are the zone's templates whose `hosts` contains *k* with socket count ≥ *d*; weight = 10, −6 if used in the previous two rooms, +4 if it carries a curio or trap socket the floor still needs, ×0 if its footprint cannot fit the remaining grid. Boss templates are fixed. The pick is seeded; no template three times on one floor.

**Layout:** greedy DFS over the graph on the 8×6 grid. Entry goes on a seeded border cell; each child is placed adjacent to its parent through a socket pair that meets (socket rotations tried in seeded order, multi-cell footprints in both orientations); on collision, backtrack (budget 200 placements). Budget exhausted → floor seed +1 and regenerate, logged with the original seed (target < 2% of floors). Positions are integer cells; corridors are implicit (doors meet across a shared edge; the walk is a 2-second camera move).

**Decoration:** a seeded 15% tile-variation pass (`flag_b`, puddle, mist), the template's fixed props, prop sockets filled from the zone list, the trap on its trap socket (or the door), the curio on its curio socket; instanced pieces merged per room.

**Worked example — Gravehollow F2, seed 17, three players.** 11 rooms; a Key-and-Lock pair; one secret; one Fork of two Branches and one single Branch.

```
col→    1      2      3      4      5      6      7      8
row 1   .      .      .      .      .      .      .      .
row 2   .      .     [K]     .      .      .      .     [S]
                      |                                  |
row 3  [E]----[F]----[C]----[F]----[M]----[R]--#--[L=========L]
                              |             |
row 4   .      .      .     [C]     .     [X]     .      .
                              |
row 5   .      .      .     [T]     .      .      .      .
row 6   .      .      .      .      .      .      .      .

E Entry · F Fight · C Curio · M Merchant · R Rest · L Elite (2×1) · S Stairs
K the Key room (a Fight whose loot holds the key) · # Locked door · X Secret room · T Treasure
```

| # | Room | Kind | Template | Cell(s) | Doors | Contents |
|---|---|---|---|---|---|---|
| 0 | E | Entry | `cel_t_stairwell` | (1,3) | E | entry lantern sets light 90 |
| 1 | F | Fight | `cel_t_storeroom` | (2,3) | W E | Rat Pack: 3 Giant Rats + 1 Plague Rat; a Loose Flagstone (diff 10) by the grate |
| 2 | C | Curio | `cel_t_wine_vault` | (3,3) | W E N | the Sealed Cask; the Fork root |
| 3 | K | Fight (key) | `cel_t_guardpost` | (3,2) | S | Dog Handlers: 2 Cellar Hounds + 1 Grinning Netter; the Key drops here |
| 4 | F | Fight | `cel_t_cistern` | (4,3) | W E S | Toll Collectors: 2 Grinning Cutpurses + 1 Grinning Crossbowman; Tripwire Bell (diff 8) |
| 5 | C | Curio | `cel_t_storeroom` | (4,4) | N S | the Hanging Cage |
| 6 | T | Treasure | `cel_t_strongroom` | (4,5) | N | a Small chest (F centre 75 / E 25), two fights' gold in piles; locked 20% / trapped 15% → rolled *open, untrapped* |
| 7 | M | Merchant | `cel_t_guardpost` | (5,3) | W E | Dunmore Quist's cart; the brazier curio (+15 light) |
| 8 | R | Rest | `cel_t_cold_hearth` | (6,3) | W E S | the floor's rest; the Secret's door on its S wall (diff 12) |
| 9 | X | Secret | `cel_t_strongroom` | (6,4) | N | Smuggler's Cache |
| 10 | L | Elite | `cel_t_kennels` | (7,3)+(8,3) | W N | Alpha's Warren: a Warren Alpha champion with 1 affix + 3 Giant Rats in the pens; the **Locked** door is its W door |
| 11 | S | Stairs | `cel_t_stairwell` | (8,2) | S | Greased Stairs (diff 14) rolled *present* |

Checks: Entry→Stairs = 7 hops, the unique maximum (T 5, X 6, K 3) ✔ · one Rest ✔ · Merchant on F2 ✔ · Key room (hop 3) before the lock (edge 8→10) ✔ · 11 rooms ✔ · roles (`06` §8.2): two Fodder-only packs (Rat Pack, Toll Collectors), a Special (the Netter of Dog Handlers), a role-Elite (the Warren Alpha), no Monster room rolled (at most one is allowed, none required) ✔ · clock: opening every room costs ≥ 12 room ticks + ~5 fights × 4 rounds ≈ 32, so Old Gnaw arrives only if the party rests (+5) and dawdles — the intended pressure on F2.

**As built (Phase 7, pass C1).** `generator.minRooms` is 4, for the throne floor: F8 lays out G3's four rooms. **A boss pins its room**: the Boss node takes the template its boss's arena names (`boss.arena.room` → `FloorSpec.bossTemplateId`: `cel-t-tap-room` on F3, `cry-t-wardens-vigil` on F6, `vlt-t-drowned-chapel` on F7, `vlt-t-throne` on F8 — 300 seeds of 300 each). **G11 on a boss floor** (F6, F7): the merchant is the last spine room before the anteroom; a Merchant rolled elsewhere on that floor becomes a Fight, and the room-count clamp inserts its new segments before the merchant so he stays there (300 of 300 seeds). **G14**, as written, re-rolls only the last Fight, and the role mix still goes unmet on a share of seeds (300 seeds each: F2 44%, F5 54%, F7 36%) — a fuller re-roll is a design change, left for checkpoint 2 and the balance runner. Layout retries stay low (at most 3 on F7, 0.26 a floor).

---

## 3. Dungeon 2 — The Fungal Deep (L12–26)

**Lore.** Under the Mirewood the roots go down into caverns that have been growing one organism for a thousand years. The **Sporemother** is not a monster in the caverns; the caverns are her. The capfolk that tend her gardens were the cave-folk who lived there; the trolls who dug the warrens were hired to hollow out her lungs and never left; anyone who breathes long enough in the Spore Heart begins to hear her, kindly, asking them to lie down. The Hollow King's death shook the roots, and her gardens have started to flower upward, toward Emberfall.

**Zones, families, levels.** (Families, creatures, hunters and bosses are `06` §4's names; this file adds the places, arena rules and mechanics. Per-floor levels step inside `06`'s zone bands.)

| Zone | Floors | Monster level | Family | Hunter | Zone boss |
|---|---|---|---|---|---|
| **the Mycelium Gardens** | F1–3 | 12 · 14 · 16 | capfolk & cave beasts (Sporecaps, Cave Lurchers, Dusk Owls, Shriekcaps, Capfolk Warders, a Mossback Tortoise) | the Rootwalker (a walking root-mass that regrows unless Burned; it leaves spore clouds behind it) | **the Shepherd of Caps** — on a dais of caps; arena rule: the caps burst in sequence, each a cloud that drains light −10 and Blinds a row; a torch burns a cloud away |
| **the Troll Warrens** | F4–6 | 17 · 19 · 21 | trolls & slimes (Troll Whelps, Acid Slimes, Warren Trolls, Troll Snatchers, Great Cave Owls, a Gelatinous Mound) | Gristle (a one-eyed troll with a chain flail; tracks by scent: unslowed by Dark) | **Mawgrum the Warren-King** — behind a wall of whelps; arena rule: every troll Regens unless Burning, so Fire is the key (the F5 merchant sells Firepots) |
| **the Spore Heart** | F7–10 | 22 · 23 · 24 · 26 | the spore-touched (Spore-touched Miners, Spore Husks, Sporeling Swarms, Fungal Hierophants, Blight Stags, the Bloom) | the Pale Walker (a spore-touched giant that walks through fungal walls: it ignores the room graph, 1 room per tick) | F9 **the Hierarch of Blooms** — grown into the wall; arena rule: it tears free at half HP and the wall's Spore Husks burst in sequence; F10 **the Sporemother** |

**Biome kit at a glance.** *Gardens:* cave floor with cap-clusters, bioluminescent wall fungus as the main light, hanging roots for pillars, giant caps as cover; moss `#4A6B2F` · pale cap `#D8D0B8` · loam `#3A2E22` · accent spore violet `#B07CFF`. *Warrens:* dug tunnels shored with bone and timber, middens, cage pens, cook-fires as the only warm light; clay `#8A5A3C` · bone `#D9CBB0` · soot `#2B2622` · accent cook-fire orange `#F08C3C`. *Spore Heart:* soft breathing walls (vertex-animated), pulsing violet veins, bone-white spore towers, pools of clear fluid; flesh-pale `#C9A9A6` · vein violet `#6E3FA3` · bone `#EDE6D6` · accent magenta `#FF5FA2`. Music: Gardens, hang drum and bowed vibraphone in Lydian at 70 bpm; Warrens, tribal toms and a didgeridoo drone in a 5/4 stomp; Heart, a breathing whole-tone pad and a children's choir on one note at 48 bpm, the Sporemother's theme a lullaby in 3/4 that never resolves.

**Signature mechanic — Spore load.** Some rooms are **sporebound** (a violet haze on the door preview; 30% of Gardens rooms, 20% of Warrens, 50% of the Heart). A sporebound room drains light **−10 instead of −5** and gives every hero **+10 Spore load** (0–100), +5 more per Poison tick taken anywhere in the dungeon. At 50 a hero is **Weakened**; at 100 **Sporebound**: −20% max HP for the floor (and Fear immunity — she is kind). Load drops 30 at a rest room, 100 with a **Clean Mask** (merchant, 0.1 R). The trade: sporebound rooms give **Foraging +2 ranks** for herbs and ingredients (Glowcap Stew: +10% Poison resistance for a floor) and their curios roll items +1 grade. The Sporemother's arena uses the meter: heroes enter F10 with the load they carry, and at 100 she *commands* them (one skipped action per 4 rounds).

**Final boss — the Sporemother.** F10 is one enormous chamber (a 3×3 template) in which the Sporemother is the *ceiling*: caps and veins, her face hanging on a stalk over the party. Three phases (`06` §4): *the Garden* (she is out of reach while the party kills four Spore Nodes under a rain of Sporeling Swarms; the light meter *rises* per node), *the Stalk* (her stalk drops into the front row; Blunt crits stagger her, Poison Rain every 3rd round, Blight Stag and Hierophant adds), and *the Heart* (the cap falls: light set to 0, Pitch-band loot rules on her drops — the darkest fight in the game is the richest; a Torch relights the hall for 2 rounds). First kill (`06`): a Divine Shard, Blacksteel ×12 + Wolf Hide ×12, an S-grade item, the **Sporemother's Breath** (A Relic), a Tier IV Tome, +1 Luck, the Emberforge lamp.

**Economy.** Grades **C and B** centre the drop shape (Steel/Blacksteel, Wolf/Wyvern Hide, Silk/Glyphweave, Yew/Ironwood; regional variants Bluesteel and Spidersilk); Honing Oil first drops here; Small chests centre on C, Large on B; the Curio Merchant's band moves to B after F6 here; Foraging contracts join the Quest Board; pet eggs Sporeling, Moss Tortoise, Cave Owl (`06` §9). R ≈ 1,230 at the Gardens (300 × 1.6⁴, runner-rounded).

---

## 4. Dungeon 3 — Emberforge (L24–38)

**Lore.** The deep dwarves of the Cinder Hills built the greatest foundry under the mountains and forged in it the one thing no one should: a mind for the fire. The **Forge-Tyrant** was meant to be an engine that never slept; it learned that the dwarves did, and took the Foundry on the night shift. The Ash Halls are what is left of their home — the Hold's cindered remnant still works the bellows because the Tyrant keeps their children in the slag pits. Below, the Foundry's golems make more golems; below that, the Magma Throat is where the salamanders came up when the Tyrant opened the mountain's veins to feed itself. The Sporemother's roots were plugging the Throat's vents; with her dead, the hills smoke again.

**Zones, families, levels.**

| Zone | Floors | Monster level | Family | Hunter | Zone boss |
|---|---|---|---|---|---|
| **the Ash Halls** | F1–3 | 24 · 26 · 28 | the Cinderborn, the deep dwarves (Pickers, Shieldwalls, Chainers, Ember Foxes, Forge Beetles, a Warbeast) | the Smelter (a Cinderborn in a furnace-suit; can be paid 0.2 R to leave, once) | **Thane Brakka Ashbrand** — the last thane; arena rule: the Thane's shield-wall must be broken (Blunt) before the Thane can be hit from the front row; the secret room's lore tablet lets the party *talk the Thane down*, skipping phase 2 |
| **the Foundry** | F4–6 | 29 · 31 · 33 | forge-golems & constructs (Scrap Golems, Anvil Golems, Chain Sentinels, Furnace Hounds, Rune Keepers, a Bellows Engine) | the Unfinished (a half-built golem that assembles from each room's scrap; +15 Heat per tick it is on the floor) | **the Foundry Master** — arena rule: the forges hammer every 3 rounds (Blunt to the front row, Stun unless Guarding) and the mould channels flood with Fire on alternating rows; a Frost skill quenches a forge for 3 rounds |
| **the Magma Throat** | F7–10 | 34 · 35 · 36 · 38 | salamanders & fire elementals (Salamanders and Hatchlings, Cinder Wisps, Flame Dancers, Magma Elementals, a Pyre Serpent) | the Ember Hart (a burning stag that leaves a Burn trail on the minimap; 1 room per tick where Heat > 50) | F9 **Ignatha, the Salamander Queen** — arena rule: the lava rises like Naesa's tide but it is *light* that climbs (Radiant: no loot bonus, no monster ambush, Fire +25%); F10 **the Forge-Tyrant** |

**Biome kit at a glance.** *Ash Halls:* dwarven dressed stone under ash, great square pillars, chain-lamps, half-burned murals; ash grey `#8B8680` · dark basalt `#2A2826` · dwarf-bronze `#8C6A3C` · accent ember red `#E8442C`. *Foundry:* iron gantries, chain hoists, forges as glowing blocks, molten channels (the Vault's water tiles reskinned as lava), machinery from 3–4 modular blocks; iron `#4A4C52` · soot `#1C1B1A` · heated steel `#D87A3A` · accent white-hot `#FFF0C4`. *Magma Throat:* a lava tube, obsidian floors, basalt columns, lava pools as impassable deep tiles, sulphur crusts; obsidian `#1A1418` · basalt `#3E3A3C` · sulphur `#D8C04A` · accent lava `#FF6A1A`. Music: Ash Halls, low male choir and hammered dulcimer in Aeolian at 66 bpm with an anvil on 2 and 4; Foundry, industrial percussion in 7/8, brass clusters, a steam-whistle motif; Throat, double-bass drone, taiko, a solo soprano for the Queen; the Tyrant's theme the anvil motif at 140 bpm under a full brass choir in Locrian.

**Signature mechanic — Heat.** A **Heat meter** (0–100) beside the light dial. Door previews show a room's rating: cool (0), warm (+10 on entry), hot (+20), molten (+30); Heat decays 5 per cool room and resets at rest rooms and *quench pools* (a curio). At Heat ≥ 50, **hide and cloth armour wear ×1.5** and each Healing Draught has a 10% chance to boil away; at ≥ 80, wear ×2 and every hero starts fights with Burn 1 turn; at 100, *Heat-struck*: −10 Speed until cooled. **Fireblood** cancels it: the Draconid trait, a **Fireblood Draught** (merchant, 0.15 R, one floor) or a Frost talisman affix. The trade: molten rooms roll chests +1 grade step, and the Foundry's light drains only −3 per room (forges are bright) while Fire-family monsters see perfectly in Dark. Plate and Mail are nearly immune: this is the Warden's and Blade's dungeon as the Deep was the Ranger's.

**Final boss — the Forge-Tyrant.** F10 is the Great Forge (3×2): the Tyrant a seated colossus of Blacksteel whose furnace-heart is the room's only light. Three phases (`06` §5): *the Anvil* (it does not move; Stun hammer from the dais, Shieldwall adds, Burn floor on alternating rows; the great bellows — 4 hits — blow the forge out for 2 rounds), *the Casting* (four mould channels flood in a shown order, a Magma Elemental rising from each while Chain Sentinels pull heroes toward them; Heat +10 a round; Frost cools a flooded channel), and *Unbound* (it sheds the golem body, which fights on for 3 rounds; Fire-element and weak to Frost, Heat set to 100 — Fireblood Draughts are this fight's torches). First kill (`06`): a Divine Shard, Skysteel ×12 + Glyphweave ×12, an S-grade item, the **Forge Sigil** (S Relic), a Tier IV Tome, +1 Luck, the Frostmarch lamp.

**Economy.** Grades **B and A** at the centre (Blacksteel/Skysteel, Wyvern/Basilisk, Glyphweave/Moonweave, Ironwood/Ebony; regional variants Hearthsteel and Cinderweave); Divine Shards enter the game (the Tyrant, and Grand chests at 5%); Large chests centre on A; the Foundry's rest rooms are anvils (Field Repair +20% there); part-break contracts on the Quest Board; pet eggs Ember Fox, Forge Beetle, Salamander Hatchling (`06` §9). R ≈ 1,970 at the Ash Halls.

---

## 5. Dungeon 4 — Frostmarch Citadel (L36–50)

**Lore.** On the Teeth, above the glacier, the Frostmarch Citadel was the seat of a court that refused to die when the winter came and stayed. The **Pale Dragon** did not conquer it; she was invited, by a chamberlain who thought a dragon could be bargained with and a king who thought the cold could. The Outer Walls are manned by the Frostmarch Host, giants' thralls and wall-wights two hundred years at their posts; the Frozen Court still holds audiences, Queen Isrevel on the throne and her Pale Chamberlains presiding over courtiers frozen mid-bow; and in the Roost above, the brood nest in the throne room's rafters over a throne buried in rime. The Forge-Tyrant's death lets the passes thaw enough to reach the gates.

**Zones, families, levels.**

| Zone | Floors | Monster level | Family | Hunter | Zone boss |
|---|---|---|---|---|---|
| **the Outer Walls** | F1–3 | 36 · 38 · 40 | frost giants & winter wolves (Winter Wolves, a Wolf Matriarch, Giant Hurlers, Rime Raiders, Frost Giant Reavers, a Rime Mammoth) | the White Hunter (a giant whose wolf pack grows a wolf every 4 ticks; Chills every room it passes: −3 extra light on entry there) | **Jarl Varrek Coldhand** — a frost giant on the gate-tower; arena rule: every 3 rounds the gale swaps the party's rows unless Rooted or Fortified |
| **the Frozen Court** | F4–6 | 41 · 43 · 45 | ice wights & the Pale Court (Court Wights, the Frozen Choir, Pale Courtiers, Pale Knights, Pale Chamberlains, a Glacier Revenant) | the Pale Executioner (a headsman-wight whose hit on a Fallen hero removes a revive from the floor's budget) | **Queen Isrevel of the Pale Court** — arena rule *the audience*: a hero who acts twice in a row is *noticed* (Mark); the Queen strikes only the Marked |
| **the Roost** | F7–10 | 46 · 47 · 48 · 50 | wyrms & drakes (Drakelings, Rime Drakes, Ember Drakes, Wyrm Broodguards, Roost Harriers, a Snow Wyrm) | the Roost Mother (an elder drake circling the floor: 2 rooms per 2 ticks, ignores locked doors) | F9 **Skaldrath the Elder Wyrm** — coiled around the aerie on the open ledge; the gale again, and Cold (below) at double rate; F10 **the Pale Dragon** |

**Biome kit at a glance.** *Outer Walls:* battlement sections with crenels, wall-walks over a fog void, guard towers as 1×1 rooms, frozen siege gear; rime white `#E6EEF2` · wet granite `#4F5660` · frozen oak `#6B5A48` · accent beacon blue `#5FB7FF`. *Frozen Court:* a palace frozen mid-evening — marble pillars under ice, chandeliers as stalactites, a black-ice ballroom floor, courtiers as statues that are also enemy spawns; ice marble `#D6E2EA` · court crimson `#7A2230` · gilt `#C9A24E` · accent candle-ice cyan `#9FE8FF`. *Roost:* rafters and roofs open to the sky, bone-strewn nests, the throne room's broken dome, aurora light; bone `#EDE6D6` · night sky `#141C2E` · rime `#CFE3EE` · accent aurora green `#6CF5B2`. Music: Outer Walls, war drums and a horn call in Dorian at 92 bpm with wind as an instrument; Frozen Court, a waltz on detuned harpsichord and glass harmonica in 3/4 at 84 bpm, conducted by the Chamberlain; Roost, a solo cello against a wind-choir, then only the dragon's theme — a single rising fourth on full brass at 56 bpm, the game's one major-key theme.

**Signature mechanic — Cold.** **Cold stacks** (0–5) on the party. Every room entered while light is **below Dim** adds one; the Roost's wind drains light **−8 per room**, so the Roost is a race to keep the torch up. At 2 stacks heroes are **Slowed** in fights; at 3 Frost resistance halves; at 5 a hero starts each fight **Frozen** for one turn. Stacks clear at a brazier curio, a rest room, or with a **Homestone** (merchant; held by one hero, warms the party for 4 rooms). The familiar trade turned up: darkness pays its loot bonus and here also *costs* Speed, so Dwarves and Elves (one band brighter) and the Mender's warmth skills are the answer, while Orcs are the citadel's best scouts and its worst sufferers.

**Final boss — the Pale Dragon.** F10 is the Throne of Rime: the throne room with its dome broken open to the aurora, the dragon coiled around the throne (3×3, the only exterior-lit arena). Three phases (`06` §6): *the Descent* (she fights from the sky — ranged and spells only — Frost Breath on alternating rows every 2 rounds, Fear on landing; the tell is the aurora dimming; the roost's four chained spires, 5 hits each, ground her one state per chain), *Grounded* (Front and Huge: Bite Grab, Tail Sweep on both rows, Freeze on all Chilled, Wyrm Broodguard adds; a wing part-break keeps her grounded for the phase), and *the Cold Heart* (every Breath snuffs the light 25 and in Pitch her Freeze is instant; no braziers up here, only Torches; a hero at 5 Cold Frozen twice is Petrified for the fight). **Dragon Scale (SS) drops here: 1–3 on the first kill, 1 on every later kill, guaranteed (`06`).** First kill (`06`): a Divine Shard, Adamantine ×12 + Moonweave ×12, an SS-grade item at 25% (else S), the **Pale Mirror** (SS Relic), a Tier V Tome (the only Tier V source at launch besides Shards), +1 Luck (the cap of +4), title *Pale-slayer*.

**Economy.** Grades **S and SS**: Adamantine/Drake Scale/Phoenix Weave/Elderwood centre the Roost's drop shape and **Dragon Scale** is the one SS material that drops rather than rolls; Star Grit first drops here; **God** items become reachable (ten Divine Shards forge one at Hesper Vane's); Large chests centre on S; a Pale-slayer's Grand chest carries a 1% named-S line; the weekly contract is always a Dragon kill at launch; pet eggs Frost Kit, Drakeling (`06` §9). R ≈ 5,040 at the Outer Walls (global floors 29–31 are `08`'s S band, counted after Gravehollow's 8 — D-104).

---

## 6. Difficulty presets and Pacts

### 6.1 Presets

Each is a set of scalars the sim multiplies in (`03` §11.2); the runner sweeps them. Hard and Dread unlock per dungeon when its final boss is dead on the preset below.

| Knob | Normal | Hard | Dread |
|---|---|---|---|
| Enemy HP | 100% | 125% | 150% |
| Enemy damage | 100% | 120% | 145% |
| Enemy count (after party scaling, rounded, min 1) | 100% | 110% | 125% |
| Enemy Speed | 100% | 105% | 112% |
| Elite room weight | 8 | 11 | 14 |
| Elite affixes | floor rule | floor rule +0 | floor rule +1 (cap 4) |
| Hunter clock | 40 ticks | 32 ticks | 24 ticks |
| Light at delve start | 100 | 80 | 60 |
| Torch value | +25 | +25 | +20 |
| Revives per floor | 3 | 1 | 0 |
| Trap difficulty | band | band +4 | band +8 |
| Retreat toll | 0% (D-083) | 15% | 25% |
| Gold multiplier | ×1.00 | ×1.25 | ×1.60 |
| XP multiplier (before the D curve) | ×1.00 | ×1.15 | ×1.30 |
| Chest grade shift (in-dungeon chests) | 0 | +10 pp toward +1 | centre +1 |
| Boss first-kill extras | — | +1 rare part | +1 rare part, +1 Divine Shard on final bosses |

**As built (Phase 7).** The presets are `presets` in `dungeon.json` and every knob is live (`sim/src/pacts.ts`): the enemy scalars, the elite weight and affixes, the hunter clock, the light at the start and a Torch's worth, the revives per floor (under Sheltered — Mortal has none), trap difficulty, the toll, gold and XP, and the **chest shift**: on Hard 10 points of every in-dungeon chest's lowest line move one grade up (a Small chest's 75 / 25 becomes 65 / 35), on Dread the chest's centre is a grade higher. The **first-kill extras** land when the party comes home: a boss's first kill *on Hard or Dread* adds 1 of its rare part, and on Dread a final boss also gives 1 Divine Shard (a boss is "first-killed" per preset — every Cellars boss has died on Normal before Hard opens). **Hard and Dread open per dungeon**: Hard once its final boss (the Hollow King) is dead — any kill counts, since every kill before Hard opens is on Normal — and Dread once he is dead on Hard or Dread; the save keeps kills by preset (`progress.bossKillsByDifficulty`). The Waystone shows the three presets, a shut one locked with its reason ("Defeat the Hollow King on Normal to open Hard"), and a line on what the chosen one changes.

### 6.2 Pacts

Optional modifiers a party stacks before a delve (Hades' Pact of Punishment, `03` §11.2); each costs something concrete and pays in gold, XP or chest grade. Each has a **weight** (1–3); the total is the party's **Oath**. Rewards sum; at Oath ≥ 6 in-dungeon chests shift +10 pp toward +1 grade, at ≥ 12 their centre moves +1. Phase 7 (Segment 2) in the roadmap (`12-ROADMAP.md`), but every Pact is a scalar or rule flag the sim can run from day one.

| # | Pact | Effect | Weight | Reward |
|---|---|---|---|---|
| 1 | **Candle Pact** | light starts at 25; Torches give +15 | 2 | +20% gold |
| 2 | **Hungry Hunter** | the hunter enters at 20 ticks | 2 | +15% gold, +10% XP |
| 3 | **Brittle** | durability wears ×1.5 | 1 | +25% gold |
| 4 | **Thin Line** | revives per floor −2 (min 0) | 2 | +15% XP |
| 5 | **Loud Boots** | the party is ambushed +15% more often; monsters are never ambushed | 1 | +10% gold, +5% XP |
| 6 | **Grinning Odds** | Elite room weight 16; elites +1 affix | 2 | +20% XP, +5 pp chest shift |
| 7 | **Every Door Locked** | a Key-and-Lock pair on every floor; locked chests 30% | 1 | +10% gold |
| 8 | **Blind Map** | no minimap, no scouting, Cartography does nothing | 2 | +15% gold, +10% XP |
| 9 | **Long Night** | light drains −8 per new room | 1 | +15% gold |
| 10 | **Pack Hunters** | enemy count ×1.25 | 2 | +20% XP |
| 11 | **Iron Oath** | no retreat; a wipe also costs the Waystone progress of this delve | 3 | +40% gold, +10% XP |
| 12 | **Twin Hunter** | two hunters enter at 40 ticks from opposite ends of the floor | 3 | +25% gold, +15% XP, +10 pp chest shift |

**No hunter, no hunter Pact.** Hungry Hunter and Twin Hunter only change a floor that has a hunter clock, so the Pact menu greys them out for a Drowned Vault delve (both of its floors carry a boss, §2.9) — a Pact never pays for nothing.

Rule of thumb for new Pacts: +10% gold per expected extra fight-round of damage per floor; +10% XP per tool removed; weight 3 only for a Pact that can end the delve by itself.

**As built (Phase 7).** The twelve Pacts are `pacts` in `dungeon.json`: knobs where a number says it, rule flags where none can (`sim/src/pacts.ts` `PACT_RULE_FLAGS`; lint rule 55 fails a flag the sim does not know), and `needsHunter`. A Pact's knob meets the preset's this way: a **percent knob multiplies** (Pack Hunters on Hard: 110% × 125% = 138%), a **bonus knob adds** (Grinning Odds' +1 affix on Dread's +1 = +2, cap 4), **every other knob replaces** (every Pact is harsher than every preset on the knob it moves). Each effect, where it lands:
- **Candle Pact** — the delve starts at light 25; a Torch gives +15 (in a fight too, C2's arena Torches read the same knob).
- **Hungry Hunter** — the clock is 20 on every floor that has one.
- **Brittle** — every wear event counts ×1.5 (`wearPercent`); a wipe's −10% is not wear and stays −10%.
- **Thin Line** — two fewer revives than the preset leaves, never below 0 (`revivesPerFloorDelta`: Normal 1, Hard and Dread 0).
- **Loud Boots** — +15 points on the party's chance to be ambushed; monsters are never caught unawares.
- **Grinning Odds** — Elite room weight 16; elites +1 affix on top of the preset's.
- **Every Door Locked** — a Key-and-Lock pair on every floor; a chest that would be open is locked 30% of the time (one more roll; a locked chest stays locked).
- **Blind Map** — no scouting of any kind (a drawn map or Scout Ahead included); the map keeps no memory of the floor — only the room the party stands in and the doors out of it, so it can still move — and Cartography does nothing (its ring reveal, built in Phase 7 — `09` §5 — is switched off under the Pact).
- **Long Night** — a new room drains 8 instead of 5 (open question 11).
- **Pack Hunters** — enemy count ×1.25 on the preset's.
- **Iron Oath** — no walking out of an entrance and no teleporting out of a floor's end: the zone's end (Finish the delve) is the only way home; a wipe keeps none of this delve's Waystone progress (the floors it reached are not remembered).
- **Twin Hunter** — on a floor with a hunter, a second one enters when the first does (40 ticks on Normal; 32 on Hard; 20 with Hungry Hunter — open question 12) in the room farthest from where the first enters, never the party's own; either one in the party's room starts the hunter's fight, and both fight when both are there. Killing one leaves the other.

**The Oath** is the weights summed, its tiers in `tuning.json` → `pacts.oathTiers`; the highest tier reached applies, as the presets do (open question 13): **6–11** moves 10 points of every in-dungeon chest one grade up, **12 or more** makes their centre a grade higher. A delve's whole chest shift is the preset's, plus the Pacts' own chest rewards (Grinning Odds +5, Twin Hunter +10), plus the Oath's tier. **No hunter, no hunter Pact**: the Waystone greys out a `needsHunter` Pact for a zone with no hunter clock (the Drowned Vault) and `startDelve` refuses one. **The menu** is the Waystone's Difficulty and Pacts: twelve toggles with their weight (◆), effect and reward, the Oath on the section's head, what the Pacts taken pay and what the next tier would; Enter says the floor, the preset and the Oath.

---

## 7. Daily and weekly contracts (the Quest Board)

The board posts **three dailies** (reset 04:00 local) and **one weekly** (Monday), templated with the player's band filled in so they stay relevant from F1 to Frostmarch. A **Standard Key** opens one Standard chest free; a **Grand Key** one Grand chest. Progress counts in any party on any difficulty; no contract needs a specific class.

| # | Contract | Cadence | Condition | Reward |
|---|---|---|---|---|
| 1 | **Rat-catcher** | daily | kill 30 Vermin in the Cellars | 0.20 R + 1 Standard Key |
| 2 | **Lights On** | daily | reach the stairs of any floor in your band with light ≥ 50 | 0.25 R + 1 Standard Key |
| 3 | **Toll Road** | daily | kill 12 of the Grinning Company without any hero being Fallen | 0.30 R + 1 Standard Key |
| 4 | **The Hound's Hunt** | daily | kill the zone's hunter (Old Gnaw / the Warden's Hound / the Vault Leech — at the Leech Jar or in the throne room, §2.9) | 0.50 R + 1 Grand Key |
| 5 | **Pedlar's Friend** | daily | sell Dunmore Quist 20 parts in one delve | 0.15 R + 2 Torches + 1 Standard Key |
| 6 | **Keeper's Peace** | daily | clear a Crypts floor without opening a Sealed Sarcophagus | 0.25 R + 1 Standard Key |
| 7 | **Dark Harvest** | daily | open 3 chests on one floor while the light is Dark or Pitch | 0.40 R + 1 Standard Key + 1 Skeleton Key |
| 8 | **Bank Run** | daily | return to town with ≥ 1.5 R unbanked gold in one delve | 0.30 R + 1 Standard Key |
| 9 | **The Grinning Captain** | weekly (band 1) | kill Captain Vexa Marrow on Hard or above with a party of 2+ | 1.00 R + 1 Grand Key + 1 Material Crate (Standard) |
| 10 | **Tide-turner** | weekly (band 3) | kill Sister Naesa without the tide reaching step 4 | 1.50 R + 1 Grand Key + 1 Skill Tome chest (Standard) |

The weekly is always a boss kill with one arena condition, rotating through later dungeons (the Shepherd of Caps with no hero Sporebound; the Foundry Master with every forge quenched once; Queen Isrevel with no hero Marked twice; the Pale Dragon, any kill). Keys are the real prize: capped at 3 Standard and 1 Grand per week per player.

**As built (Phase 7).** The board lives on the save (`contracts`; `sim/src/contracts.ts`). **Posting**: each board day the three dailies are drawn from the contracts the party can do now — its zone open at the Waystone, its preset open, a hunter somewhere it can reach — the same draw for every player that day; the weekly turns through the weeklies the party can do by the week's number, and there is none until one is doable (the Grinning Captain needs Hard, so a new save's board shows the weekly slot empty with why). The day turns at 04:00 and the week on Monday at 04:00 by the phone's clock, which the client hands the sim (`contracts.resetHour`, `weekStartsOn`). **Templated with the band**: a contract keeps the band it was posted at — the band of the deepest floor finished — and pays its gold at that band's R; "any floor in your band" counts that band's floors and deeper. **Progress** counts when a delve comes home, from its log: each won fight's kills and whether a hero fell in it, each floor's way down reached and the light then, each chest opened and the light then, the curios used, the parts sold, and C2's boss-arena rows (Tide-turner: Sister Naesa beaten with the tide never at step 4); "in one delve" and "on one floor" keep the best single figure. Readings: **Rat-catcher**'s Vermin are the rats and spiders (Old Gnaw among them; the Company's hounds are dogs); **Toll Road** counts the Company's bandits killed in fights where no hero fell; **Lights On** counts the stairs, or a beaten boss's room, reached at light 50+; **Keeper's Peace** is a Crypts floor whose way down is reached with no Sealed Sarcophagus opened (its Leave is not an opening); **Pedlar's Friend** — Dunmore now buys parts: a merchant room offers to sell each material the delve found, at 40% + 0.5% per Haggling rank (§2.7); **Bank Run** counts only the gold the delve itself brought home, never the purse carried in. **Claims**: the gold into the purse; chest keys into the materials (pass B's Standard and Grand Keys open a chest of their tier free), at most 3 Standard and 1 Grand a week — past the cap the gold and the items still pay; items into the first party hero's bag; a chest reward is opened at once, free, for the hero picked on the board. Keeper's Peace and Tide-turner are live; lint rule 56 checks every contract (`content/README.md`).

---

## 8. Testing hooks

### 8.1 What the generator must guarantee

Assertions the runner checks on every generated floor; a failure prints the seed.

1. **Solvable:** every room reachable from Entry; Stairs/Boss reachable without passing a Locked door whose Key is behind it; the Key room's hop count is less than the lock's.
2. **Farthest:** Stairs (or Boss) is the unique room at maximum BFS hop count from Entry.
3. **Exactly one Rest** per floor; on boss floors adjacent to the Boss.
4. **Merchant before every boss floor:** F2, F5, F6 and F7 (and their equivalents) have exactly one; on F6 and F7 it stands on the spine before the anteroom, and F7's stock holds four Torches.
5. **Shape:** 8–14 rooms (F1 5–7; F8 4); ≤ 3 Forks; no template three times; every socket pair meets; no overlapping cells.
6. **Roles:** every floor meets `06` §8.2's role mix; no encounter twice in a row.
7. **Secrets never gate:** removing every Secret room leaves reachability unchanged.
8. **Light budget:** opening every room with no torch reaches the stairs at light ≥ 1 on F1–3 (Pitch is possible only from F4 on).
9. **Determinism:** the same (seed, dungeon, floor, partySize, preset, pacts) yields the same graph hash; compared across clients at floor start.
10. **Retry rate:** seed-bumping layout failures under 2% of floors.

### 8.2 What the balance runner prints per floor

For each (dungeon, floor, partySize, preset) over N seeds with the scripted policies (`03` §3.6): rooms (mean, min, max) · fights and elites · ticks to the stairs for the *clear-everything* and *straight-line* policies · hunter arrivals (% of runs, mean room) · ambush rate both ways · expected gold (mean, p10, p90) against §2.3's targets · damage taken per hero as % of max HP, and downs · torches used and light at the stairs (mean; % of runs in Dark or Pitch) · traps triggered / disarmed / revealed · curio outcome mix · chest grade distribution · wipes per 100 runs · Key-and-Lock backtrack ticks · for boss floors, rounds to kill and the % of runs in which each arena mechanic fired (lanterns out, six candles, tide step 4, the third Throne hunter). One row each in a dated markdown report plus the JSON Phase 2 of the roadmap expects.

### 8.3 Deep links the client supports

`#`-fragment links the web client parses at load, opening the game in the named state with the named seed for screenshots, bug reports and the runner's visual checks. Omitted parameters take defaults (Normal, no Pacts, light 100).

| # | Link | Opens |
|---|---|---|
| 1 | `#delve=gravehollow&zone=2&seed=17&party=warden,mender` | the Crypts delve from F4 with two heroes at the zone's recommended level, seed 17 |
| 2 | `#delve=gravehollow&floor=3&seed=4242&party=blade,ranger,shade,mender&difficulty=hard&room=boss` | F3 on Hard, the party already standing at the tap-room door with the floor cleared |
| 3 | `#delve=gravehollow&zone=1&seed=9&party=arcanist&pacts=candle,hungry-hunter&light=25` | a solo Arcanist on F1 with two Pacts, for testing the hunter's approach |
| 4 | `#room=gravehollow&template=cel_t_kennels&kind=elite&light=40&camera=1` | the room viewer: one template, decorated for an Elite fight at Shadowy light, with the camera and marks drawn (for kit review) |
| 5 | `#gen=gravehollow&floor=7&seeds=100-199&print=ascii` | the generator alone, 100 floors of F7 (the Vault: its merchant before Naesa's anteroom, the chapel farthest) as ASCII maps and the §8.1 assertion results, no rendering |
| 6 | `#delve=fungaldeep&zone=1&seed=77&party=beast-tamer,warden,ranger&level=14&spore=60` | the Fungal Deep's Gardens with a three-hero party at L14 and a preset Spore load, for the meter's UI |
| 7 | `#delve=gravehollow&floor=8&seed=4242&party=warden,blade,ranger,mender&room=boss` | F8 with the antechamber cleared, the party at the throne-room door: the Hollow King's three phases, the light steps and the returning hunters, for screenshots and the runner's visual check |

An eighth form, `#replay=<matchId>&to=room:6`, replays a logged match (seed + command log) up to a room index; it is the bug-report link and belongs to `10-TECH-PLAN.md`.

**As built (Phase 7, pass C1).** Link 1's `zone=N` is the dungeon's N-th zone: the delve starts on its first floor (Gravehollow: 1 → F1, 2 → F4, 3 → F7) with the heroes at its recommended level — the first floor's monster level — unless `&level=` names one; `floor=N` still names a floor (`client/src/game/session.ts` `startDeepDelve`).

---

## Open questions (for James)

1. ~~**The Vault delve is four floors (F7–10).** Should F10 instead be its own one-floor Throne delve from the Vault Waystone — a short, repeatable unit for farming the Crown — or stay attached so the first kill ends a long run? *Proposed: attached for the first kill; afterwards the Throne Waystone offers F10 alone.*~~ *Checkpoint 1 (D-098): Gravehollow has 8 floors — the Vault is F7–8 with Sister Naesa on F7 and the Hollow King on F8, and a delve is one zone; the Waystone remembers the floor (D-083), so after the first visit a party can start on the King's floor alone to farm the Crown.*
2. ~~**Hunters returning in the Hollow King's third phase** rewards parties that fought them. Right incentive, or a punishment for fast parties who never see a hunter? *Proposed: keep; a fast party arrives with more light and torches.*~~ *Checkpoint 1 (D-099): keep — a fast party arrives with more light and torches, and a hunter killed this delve never returns.*
3. ~~**Light at entry** falls from 100 (F1) to 50 (F9). Alternative: every floor sets 100 and the per-room drain rises. The first makes torches a planning purchase; the second makes floors feel alike. *Proposed: falling entry light.*~~ *Checkpoint 1 (D-099): falling entry light, as built for the Cellars (100 / 90 / 85); torches stay a planning purchase.*
4. ~~**Monster-level steps** in dungeons 2–4 end +2 on the final floor (24 → 26, 36 → 38, 48 → 50) to land on the briefed ranges; Gravehollow ends +1. Keep the ranges, or make every last step +1 and end a level short?~~ *Checkpoint 1 (D-099): keep the briefed ranges and the +2 last steps, so the deepest floor stays the deadliest (D-092); Gravehollow's steps are re-set for 8 floors in Phase 7 (D-098).*
5. ~~**A merchant on F1** as a tutorial (potions and a torch), or does the first floor stay pure?~~ *Checkpoint 1 (D-099): F1 stays pure, as built — the starter kit carries potions and torches, the town shop sells more, and the first merchant is on F2.*
6. ~~**+1 Luck per final-boss first kill** (cap +4) — assumed here from `03` §2's proposal. Confirm, or strike the Luck line from the four rewards.~~ *Checkpoint 1 (D-098): confirmed — +1 permanent Luck for each final boss's first kill, up to +4 (D-037).*
7. ~~**Pacts in Phase 7, or ship Candle Pact, Hungry Hunter and Brittle already in Segment 1**, since they are scalars the presets already use?~~ *Checkpoint 1 (D-099): Phase 7, with the preset menu (D-044) — the sim already runs all twelve from the dungeon data (D-076), so the balance runner can sweep them before the menu ships.*
8. ~~**Arena tells** are visual (lanterns, candles, the boom, the gallery lamps). Should each also be a line of boss dialogue, owned by the monsters doc?~~ *Checkpoint 1 (D-099): no boss dialogue — each arena tell also shows a two-word hint the first time per delve (as `06` §8.10 does for attacks, e.g. "Lamps flaring"), written with the arena in §2.8 when Phase 7 builds it.*
9. **The Drowned Vault has no stalking hunter.** Both of its floors carry a boss and no hunter stalks a boss floor (D-055), so the Vault Leech is met only at the Leech Jar and in the Hollow King's last phase. Keep, or let the Leech stalk F7 until the party reaches Naesa's anteroom (the one boss floor with a clock)? *Proposed: keep — the Vault delve already holds two bosses back to back, and the darkest light in the tower is its clock (D-104).*
10. **A second merchant in the Crypts.** F6 now carries a guaranteed merchant because Naesa's floor follows it (`03` §11.1, lint rule 13), so a Crypts delve meets Dunmore on F5 and F6. Keep, or change the rule so a boss on its zone's first floor brings its own merchant and F6 goes back to none? *Proposed: keep — no rule change, and the Warden's floor mirrors Naesa's, a merchant before the anteroom (D-104).*
11. **Long Night** says "light drains −8 per new room". Built as a new room draining 8 instead of the usual 5 (weight 1, +15% gold — a mild Pact), not 8 more (13 a room would plunge a floor into Pitch in eight rooms, a weight-3 cost). *Proposed: 8 instead of 5.*
12. **Twin Hunter** says "two hunters enter at 40 ticks". Built as two hunters entering at the floor's clock — 40 on Normal, 32 on Hard, 20 with Hungry Hunter — so the Pacts and the presets stack, rather than a fixed 40 that would make Twin Hunter *later* than Hard's or Hungry Hunter's clock. *Proposed: the floor's clock.*
13. **The Oath's two tiers** (≥ 6: +10 pp; ≥ 12: centre +1). Built as the highest tier reached applying alone, as Hard (+10 pp) and Dread (centre +1) do — not both at 12. *Proposed: the highest tier.*
14. **Iron Oath's "no retreat"**. Built as no walking out of an entrance and no teleporting out of a floor's end: the zone's end is the only way home, so a death far from the stairs is carried forward, not back. *Proposed: both ways out shut.*
15. **The role mix (G14) often misses.** The grammar re-rolls only the last Fight, so on 300 seeds each F2 misses `06` §8.2's mix 44% of the time, F5 54%, F7 36% (usually a second Fodder-only pack or the role-Elite). Re-roll the Fights from the last backwards until the mix holds (a bounded number of tries), or keep the rule as written? *Proposed: re-roll backwards, once the balance runner shows what a miss costs.*
16. **The Warding Glyph's "every caster".** Built with the rows: the back row is Silenced and the front row Shocked, so a back-row Ranger is Silenced and a front-row caster would be Shocked. Name the casting classes exactly instead? *Proposed: keep the rows — today's casters (Arcanist, Mender) stand in the back.*
17. **Arrows and Bolts on Dunmore's cart.** §2.7's stock has no ammunition; built with 2 bundles of Arrows and 1 of Bolts so a bow or crossbow is never dry before a boss. *Proposed: keep.*
18. **The barricade and the throne never lock a party out.** §2.8 keeps melee off Vexa's back row and off the King on his throne. Built so the rule binds a melee hero only while someone in the party can reach past it (a bow, a spell, a spear, a reach skill): an all-melee party fights on (pass C2). Keep, or make such a party bring a bow?
19. **The Warden's Wraiths come once.** The sixth candle opens the doors and phase 2 brings 06's two Wraiths "through the secret doors". Built as one pair, at whichever comes first. Keep, or a pair at each?
20. **The returning hunters stand at the throne's level** (L13), not their own +3, so the King's last phase stays a test of the arena rather than a wall; tuning `arena.hunters.levelOffset`. Keep?
21. **Every telegraphed attack costs its monster a turn.** 06 §8.10 says none lands on the turn its tell shows. Built as a tell turn (a normal weight) before the blow, for every monster with a `tell` — the Cellars' too. Keep, or a shorter wind-up?
22. **The King's first phase is long.** On his throne only bows, spells and spears reach him, so half a usual party works on his court while 40% of his ×30 HP comes off. The runner's first throne fights (pass F) will say whether his HP or the throne rule should give.
23. **The textbook player takes the throne's pull** rather than swap rows on every tell (swapping every pull turns a party's rows inside out); the swap stays the player's counter. Keep for the runner?

---

*Creature names in this file were reconciled against `06-MONSTERS.md` on 2026-10-26 (D-035: Company Dog → Cellar Hound, Grave Knight → Bone Knight, Drowned Champion → Tidebound Blade, Hollow Guards → Vault Sentinels, Crypt Spiders → Tomb Spiders, Bone Priest → Crypt Sexton, Barrow Wight → Charnel Hulk, Cultist → Acolyte; Naesa's adds are now `06`'s Acolytes and Blade) and again for Dungeons 2–4 and the encounter tables; the bestiary owns every creature. Kit piece ids are the names the build scripts will use (`11-ART-PIPELINE.md`); templates are the generator's `content/dungeons/gravehollow/templates/<id>.json`, the dungeon itself `content/dungeons/gravehollow/dungeon.json`.*
