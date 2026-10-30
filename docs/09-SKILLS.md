# 09 — Skills (index and rules)

*Last updated 2026-10-29 · rev. 3b (Phase 8: field skills grow by use, Cartography trains by mapping — §5) · rev. 3a (Phase 7 joints: the delve reads the heroes' ambush lines, the passives' Detection, Wayfinder and Treasure Sense; Cartography's reveal built; revives, damage-over-time last stands and Graced casts in the fight — §7) · rev. 3 (Phase 7: Tiers IV–V in the content — Tier V present and locked until Segment 3; monster techniques learned by witnessing, certain by the 10th; Skill Tomes as items; the Insight hint; the class-damage pass; corridor skills; "As built (Phase 7)" in §7 — D-028, D-099) · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26. The rules are `03-GAME-DESIGN.md` §7 (this file restates them in one place); the lists are the seven class sheets in `docs/classes/` (45 skills each, 315 in all) and become `content/skills/<class>/<id>.json` against `content/schemas/skill.schema.json`.*

## 1. The shape (one paragraph)

> **Skill trees (D-153, D-154 — James, 2026-10-30; Unity, Phase 18):** the schools become the branches of each class's tree; skills are unlocked with **skill points** (3 at creation, +1 per level; I 1 · II 1 · III 2 · IV 2 · V 3), rank still by use; Insight, Tomes, monster techniques and the Skill Hall (dearer) teach without a point, and the Hall resets a tree; the Arcanist's branches become **Fire · Frost · Storm · Summoning**, with summons that make one great attack and are gone. The rules are `03` §7's note; the paragraph and tables below are the web version's until Phase 18.

Every class has **three schools**, each a way to play the class. Each school has **fifteen skills in five tiers** (three per tier). **Tier** is fixed and opens with hero level (I at 1, II at 5, III at 12, IV at 20, V at 30); **rank** 1–10 grows by use and tunes the skill (+4% effect, −2% cost per rank; rank 10 unlocks the **Mastery** line). Each Tier II–V skill needs **one** Tier N−1 skill of its school. The **Ultimate** (Tier III, 100 Momentum, never misses, its own button — D-027) is the class's signature. Exactly two Tier III–IV skills per class are **monster techniques**, learned only by **witnessing** that monster use the move in a fight (`06-MONSTERS.md` says which monster teaches which; a flat 10% per witnessed use, certain by the 10th). Loadout: **4 actives + 2 passives + the pet stance**. The town **Skill Hall** sells Tiers I–III; **Insight** in the dungeon teaches Tier IV (and anything below) and drops a **Skill Tome** of it for the party; Tier V comes from endgame bosses and Divine Shards (designed in the content, locked until Segment 3).

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
| Insight | any tier-adjacent skill of the school you just used, Tier IV included (never the Ultimate, a technique or Tier V) | 4% × S(enemyLevel − tier×6) × (1 + 1%·(Wis−10)); S = 1 at 0, 0.5 at ±3, 0.25 at ±6, 0 beyond ±10; pity 1 per 60 qualifying uses, counted on the hero across delves; teaches you, drops a **Tome** for the party |
| Monster technique | the marked Tier III–IV skills (`06` §8.8) | **only by witnessing**: each use of the move in a fight the hero is in rolls a flat 10%, and the 10th witnessed use is certain (D-028, D-099); the hero must be of the class and know the skill's prerequisite; never sold, never in a Tome, and its Insight drops no Tome |
| Tomes | Insights (a copy), bosses (guaranteed Tier III+ on first kill), curios, secrets, Skill Tome chests (bag without replacement per tier) | an item — one Skill Tome def with the skill on the instance; read in town by a hero of the skill's class (an unknown skill at rank 1, a known one a full rank of XP); banked, carried and sold (the Hall's price of its tier; Tier IV at 3 R) |
| Tier V | endgame | final bosses of Dungeons 2+ and Divine Shards (Segment 3); the 54 Tier V skills of the six classes are in the content and locked: no Insight, no Tome, no Hall |

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

*As built (Phase 8, pass D).* **Field skills grow by use** (`03` §5.2: "each successful use … same rank curve"). The delve had added their XP — a disarm or a First Aid revive 10, a secret's "rank XP ×5" 50 — but no code turned it into rank, so every field skill stayed at its starting rank (a bug against the rulebook's words). Every grant now goes through `sim/src/progress.ts` `gainFieldSkillXp`: rank N at 100 × 1.5^(N−1) XP, rank 10 the top, and a rank given at creation (a class's +2, a species' trait) or by a Tome counts from its own threshold, so the head start stays a head start. **Cartography trains by mapping** (Proposed): each room of a floor entered for the first time pays the hero whose rank draws the map — the best Cartography (Wayfinder's +2 counted), the first in the party on a tie — `xp.skill.xpPerUse` (10) × D(the floor's monster level − the hero's level), within the gate and the per-delve use budget (`trainCartography`); a fresh hero who maps the Cellars reaches rank 3 (one ring) within a delve or two, and an Arcanist's starting 3 reaches 4 in about a dozen new rooms. Blind Map, which turns Cartography off, trains nothing.

## 6. What the sim needs from a skill (the effect DSL)

Each skill is a list of effects from the closed set in `content/schemas/common.schema.json` (`damage`, `heal`, `shield`, `applyStatus`, `removeStatus`, `buffStat`, `debuffStat`, `momentum`, `pool`, `timeline`, `rowSwap`, `summon`, `revive`, `light`, `loot`, `taunt`, `dispel`, `custom`) with typed fields; `custom` effects name a handler in `sim/src/skills/custom/<id>.ts` and the linter requires the handler to exist. Rank scaling and Mastery are data too.

## 7. As built (Phase 7)

- **Tiers IV–V** for the six classes (108 skills, `tools/content/gen-class-*.ts` → `content/skills/<class>/`), from the sheets' rows, with about a hundred new hooks in `sim/src/skills/custom/` (the `_group-tiers45*` files). Tier V hooks whose joint lives outside the fight (a delve-side corridor or chest rule, a turn snapshot) are documented stubs until Segment 3 opens Tier V; the sheets' "As built" notes list them. The D-099 limits are in the numbers and linted (rule 36): Oath of the Vault saves each ally once per cast, Undying Rage works once per floor (twice with Deathless), Never Lost cuts ambush by at most 30, no execute above 6.0× (Severance below 35% HP is 6.0× with a sure crit).
- **Monster techniques live**: the eleven Gravehollow techniques are linked to their monsters and moves (the Mender's Troll's Regrowth waits for the Fungal Deep, marked `monsterTechniqueLater`); a won fight rolls each hero's witnessed uses (`sim/src/progress.ts`), the count shows on the hero's Skills tab.
- **Skill Tomes as items** (`sim/src/tomes.ts`, `items/tome/skill-tome.json`): Insights drop a copy; bosses, curios and secrets drop a Tome drawn from the class's bag for the tier; Skill Tome chests put one in the armory; a hero reads one on the Skills tab.
- **The Skill Hall** shows what it never sells and where it comes from (Tier IV, the Ultimate, the techniques, Tier V) and, per school, the next Insight's tier, sweet-spot level and nearest floors (`insightHint`, `sim/src/insight.ts`).
- **Corridor skills** (D-099, pass D, `sim/src/corridor.ts`): a loadout active with a corridor line — Flint & Tinder, Trailblaze, Double Time, Scout Ahead — can be used out of combat; it costs its pool cost (as a share of the pool), takes no turn and no floor-clock tick, and does not train the skill. The Tier V corridor halves (Nightwalker's light, Vault Cracker's locks) are wired when Tier V opens.
- **The shared-file joints** (pass A, after the content). Out of combat the delve now reads the heroes' ambush lines — Ambush Sense's −10 had done nothing since Phase 3; the best single hero's lines count, never past D-099's −30, beside the best pet's — and Dawn Vigil's brighter band. The passives' Detection lines (Keen Eyes, Snare-Sense) count outside a fight. Treasure Sense adds +4 Detection for secrets and hidden treasure. Wayfinder adds 10 ticks to the floor's hunter clock and 10 points to its secret chance. **Cartography** works at last: entering a room shows the rooms within one ring per 3 ranks (`skills.fieldSkills.cartography.ringPerRanks`; an Arcanist starts at rank 3, so it shows the first ring from level 1), rank 10 marks the stairs from the floor's first room (`stairsAtRank`), and Blind Map turns it off. It does not yet train by use: its XP still comes only from the Warden's Tablet. In a fight, a revive with no one to raise and a spent once-per-fight skill (Miracle, Quicksilver) are not offered. A damage-over-time tick asks the same last-stand hooks a blow does (Undying Rage, Unbreakable, the Oath, Martyr's Grace). A Graced heavy cast does not charge.
- **The class-damage pass** (`tools/balance/class-damage.ts`; the sheets' "As tuned" notes): the damage dealers' single-target damage per round now sits within 1.5× at levels 1, 5, 8 and 13 (it was 2.5–3×).

**Open questions**
1. ~~D-027 (Ultimate button outside the loadout), D-028 (monster-technique rate), D-029 (charged casts); D-041 (weapon handling) is superseded by `08` §1.~~ *Checkpoint 1 (D-098): all three Accepted as built — the Ultimate's own button, monster techniques at a flat 10% per witnessed use (with the class sheets' pity at 10), heavy Mana casts charged; D-041 stays superseded by `08` §1.*
2. ~~Should the Skill Hall show a "next Insight likely from…" hint (which monsters at which level)? *Proposed: yes, from Phase 7.*~~ *Checkpoint 1 (D-099): yes, from Phase 7, as proposed.* *Built in Phase 7: each school's column says the next Insight's tier, its sweet-spot level and the floors nearest it.*
