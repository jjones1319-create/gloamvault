# 09 — Skills (index and rules)

*Last updated 2026-10-26 · rev. 1. The rules are `03-GAME-DESIGN.md` §7 (this file restates them in one place); the lists are the seven class sheets in `docs/classes/` (45 skills each, 315 in all) and become `content/skills/<class>/<id>.json` against `content/schemas/skill.schema.json`.*

## 1. The shape (one paragraph)

Every class has **three schools**, each a way to play the class. Each school has **fifteen skills in five tiers** (three per tier). **Tier** is fixed and opens with hero level (I at 1, II at 5, III at 12, IV at 20, V at 30); **rank** 1–10 grows by use and tunes the skill (+4% effect, −2% cost per rank; rank 10 unlocks the **Mastery** line). Each Tier II–V skill needs **one** Tier N−1 skill of its school. The **Ultimate** (Tier III, 100 Momentum, never misses, its own button — D-027 proposed) is the class's signature. Exactly two Tier III–IV skills per class are **monster techniques** that can only Insight while that monster uses the move (`06-MONSTERS.md` says which monster teaches which). Loadout: **4 actives + 2 passives + the pet stance**. The town **Skill Hall** sells Tiers I–III; **Insight** in the dungeon teaches Tier IV (and anything below); Tier V comes from endgame bosses and Divine Shards.

## 2. The seven lists

| Class | Schools | Ultimate | Monster techniques — exactly two per class, Tier III–IV (Insight only while the monster uses the move; `06` owns which monster teaches which) | Sheet |
|---|---|---|---|---|
| Warden | Bulwark · Vanguard · Warcry | *The Gate Holds* | Bone Knight (Crypts), Vault Sentinel (Vault) | `classes/warden.md` |
| Blade | Iron Dance · Executioner · Bloodletter | *Crimson Crescendo* | Ghoul (Crypts), Bone Knight (Crypts) | `classes/blade.md` |
| Ranger | Marksman · Trapper · Pathfinder | *Quiver's End* | Deep Tentacle (Vault), Grave Bat (Crypts) | `classes/ranger.md` |
| Shade | Shadow · Venom · Larceny | *Last Light Out* | Wraith (Crypts), Brine Hag (Vault) | `classes/shade.md` |
| Arcanist | Evocation · Rime · Arcana | *Prismatic Ruin* | Brine Hag (Vault), Vault Sentinel (Vault) | `classes/arcanist.md` |
| Mender | Benediction · Sanctity · Vigil | *Dawnbreak* | Wraith (Crypts), Warren Troll (Fungal Deep) | `classes/mender.md` |
| Beast Tamer (Segment 3) | Bond · Wild Call · Lash | *Howl of the Pack* | Grave Bat (Crypts), Capfolk Warder (Fungal Deep) | `classes/beast-tamer.md` |

Every sheet carries the same table columns — `Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus)` — so Phase 3's conversion to JSON is mechanical; the linter enforces the 3 × 5 × 3 shape and the prerequisite chains (`content/README.md`).

## 3. Costs, weights, numbers (starting points)

| Tier | Opens at | Cost (pool points) | Typical single-target multiplier | Typical AoE per target | Heal (% max HP) |
|---|---|---|---|---|---|
| I | 1 | 8–14 | 1.2–1.5× | 0.7–0.9× | 15–20% |
| II | 5 | 12–20 | 1.5–1.9× | 0.9–1.1× | 20–28% |
| III | 12 | 18–30 | 1.9–2.4× | 1.1–1.3× | 28–35% |
| IV | 20 | 25–40 | 2.4–3.0× | 1.3–1.6× | 35–45% |
| V | 30 | 35–50 | 3.0–4.0× | 1.6–2.0× | 45–60% |

Weights: light 800 (daggers, quick skills) · normal 1,000 · heavy 1,400 (two-handers, big casts) · Guard/Item 600 · Row swap 400. Pools start near 60 (`03` §2.2).

## 4. Learning paths

| Path | What | Rule |
|---|---|---|
| Starter | 3 Tier I picks at creation | from the class's recommended three or any Tier I |
| Skill Hall | Tiers I–III for gold | Tier I 0.1 R · II 0.3 R · III 1.0 R; +20% per purchase within a tier, capped ×3; Tier IV never sold |
| Insight | any tier-adjacent skill of the school you just used, Tier IV included | 4% × S(enemyLevel − tier×6) × (1 + 1%·(Wis−10)); S = 1 at 0, 0.5 at ±3, 0.25 at ±6, 0 beyond ±10; pity 1 per 60 qualifying uses; teaches you, drops a **Tome** for the party |
| Monster technique | the marked Tier III–IV skills | flat 10% per witnessed use of the move (D-028 proposed) |
| Tomes | from bosses (guaranteed Tier III+ on first kill), Skill Chests (bag without replacement per tier), Insights | a duplicate Tome = rank XP for that skill |
| Tier V | endgame | final bosses of Dungeons 2+ and Divine Shards (Segment 3) |

## 5. Field skills (every class, level by use)

| Skill | Headline | Per rank (1–10) | Class +2 at start |
|---|---|---|---|
| Lockpicking | open locked chests/doors without a key | +5% success, −1 floor-clock tick per attempt | Shade; Halfling trait (Nimble Fingers, `05`) |
| Trap Disarm | disarm a revealed trap | +2% success; rank 5: disarmed traps yield parts | Ranger |
| Foraging | find torches, herbs, ingredients in rest rooms and curios | +1 find per floor every 3 ranks | Ranger, Beast Tamer |
| Field Repair | +10% durability to one item at a rest room for one material unit | +1% per rank; rank 10: no material needed once per floor | Warden, Blade, Beast Tamer; Dwarf trait (Forge-born, `05`) |
| First Aid | revive a downed ally out of combat at any rank; from rank 5 also in combat as a weight-1,000 action (`03` §12.1, §7.6); bandage Bleed | out-of-combat revive HP 20% + 2%/rank; the in-combat revive (rank 5+) lands at 30% | Warden, Mender |
| Haggling | shop prices 130% − 1%/rank (floor 85%); sell 40% + 0.5%/rank | — | Shade, Arcanist; Halfling +1 |
| Cooking | rest-room meals: +5% to one stat for the next floor | +1% per 2 ranks; rank 7: two stats | Blade, Mender |
| Cartography | the minimap reveals one more ring of rooms per 3 ranks | rank 10: the stairs are marked on entry | Arcanist; Ranger +1 |

## 6. What the sim needs from a skill (the effect DSL)

Each skill is a list of effects from the closed set in `content/schemas/common.schema.json` (`damage`, `heal`, `shield`, `applyStatus`, `removeStatus`, `buffStat`, `debuffStat`, `momentum`, `pool`, `timeline`, `rowSwap`, `summon`, `revive`, `light`, `loot`, `taunt`, `dispel`, `custom`) with typed fields; `custom` effects name a handler in `sim/src/skills/custom/<id>.ts` and the linter requires the handler to exist. Rank scaling and Mastery are data too.

**Open questions**
1. D-027 (Ultimate button outside the loadout), D-028 (monster-technique rate), D-029 (charged casts); D-041 (weapon handling) is superseded by `08` §1.
2. Should the Skill Hall show a "next Insight likely from…" hint (which monsters at which level)? *Proposed: yes, from Phase 7.*
