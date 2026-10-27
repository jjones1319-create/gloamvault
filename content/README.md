# content/ — the game as data

*Last updated 2026-10-26 · rev. 2 (Claude, after the independent review; from `docs/03-GAME-DESIGN.md` rev. 2 and the owning files it names). Every number in an example is a tuning starting point.*

**Content is data.** Every class, species, skill, item, affix, set, monster, elite affix, dungeon, encounter, pet, chest, loot table, contract and status is one JSON file validated against a JSON Schema (draft 2020-12) by the Node linter (`npm run lint`, ajv) and loaded by the deterministic TypeScript sim. The schemas are the contract between the rulebook and the code: if an owning doc (the ownership table at the top of `03`) can say it, a schema can express it; if a schema cannot express it, the doc has not decided it yet. **The schema set grows as content needs it** (D-020 as amended: "the schemas in `content/schemas/`, added as content kinds need them, each with an example and linter rules") — rev. 2 added `elite-affix`, `contract`, `item-set` and `loot-table`; Phase 1 added `tuning` (the shape of `tuning.json`) and shipped the first real content, `statuses/` and `tuning.json`.

## Layout

```
content/
  schemas/                       one JSON Schema per content kind, $id https://gloamvault.dev/schemas/<kind>.schema.json
    common.schema.json             shared $defs: id pattern, every closed enum, the effect DSL, requirement, reward, tuningNumber
    class.schema.json              species.schema.json      skill.schema.json        item.schema.json       affix.schema.json
    item-set.schema.json           monster.schema.json      elite-affix.schema.json  dungeon.schema.json    encounter.schema.json
    pet.schema.json                chest.schema.json        loot-table.schema.json   contract.schema.json   status.schema.json
    hero.schema.json               (the save-side hero, not content)
    tuning.schema.json             the shape of tuning.json: sections of tuningNumber leaves (added in Phase 1, D-049)
  examples/                      one valid example per schema, <kind>.example.json (a variant: <kind>-<variant>.example.json)
  classes/<id>.json
  species/<id>.json
  skills/<class>/<id>.json       <class> is the skill's classId: warden/, blade/, …, and field/, pet/, monster/
  items/<kind>/<id>.json         <kind> is the item's `kind` value, spelled exactly: weapon/, armor/, shield/, focus/, ring/,
                                 talisman/, relic/, consumable/, material/, stone/, tome/, key/, ammo/, egg/, treat/
  affixes/<id>.json
  sets/<id>.json
  monsters/<id>.json
  elite-affixes/<id>.json
  dungeons/<dungeon>/dungeon.json  zones, floors, the generator, curios, traps, secrets, Pacts, presets
  dungeons/<dungeon>/templates/<id>.json
  encounters/<id>.json
  pets/<id>.json
  chests/<id>.json
  loot-tables/<id>.json
  contracts/<id>.json
  statuses/<id>.json
  tuning.json                    the balance runner's tables of tuningNumber (R per band, baselines, curves)
```

- **One file per record**, named by its `id`: `content/<kind>/<id>.json`, with skills under their class folder, items under their kind folder, and a dungeon's room templates beside its `dungeon.json` (each template file validates against `dungeon.schema.json#/$defs/template` and is merged into `templates[]` by the loader). The file name must equal the `id` inside it.
- **Ids are kebab-case** (`^[a-z0-9]+(-[a-z0-9]+)*$`) and unique within their kind. Skills are prefixed with their class (`warden-shield-slam`); pet actives with `pet-`; sub-ids inside a record (schools, attacks, traits, choices) only need to be unique within that record.
- **Properties are camelCase.** Closed sets are enums in `common.schema.json`; nothing else in a schema repeats them. Numbers are integers wherever the sim is integer-only (percent points, stat points, energy, gold, XP); multipliers on an Attack or a baseline are decimals; prices and stakes in R are decimals.
- **Every object is `additionalProperties: false`.** A typo is a lint error, not a silently ignored field.
- **Cross-file references** are plain ids (`classId`, `skillId`, `monsterId`, `affixId`, `setId`, `tableId`, reward and requirement `id`s …). The schema checks the shape; the linter checks the target exists.
- `hero.schema.json` describes a **save record**, not content. It reuses `item.schema.json#/$defs/itemInstance` and `pet.schema.json#/$defs/petInstance`; the loader migrates by `saveVersion`.
- **Deferred records** end in `.json.later` (the ten-floor `dungeon.full.json.later`, the two Phase 7 contracts): the loader and the linter ignore them, so a record that references content from a later phase can wait beside the shipped one without dangling (D-072, D-076). Renaming it to `.json` ships it.
- **Generators**: the six classes and their skills (`tools/content/gen-class-<class>.ts`) and every item, affix, set and the loot table (`tools/content/gen-items.ts`) are written by re-runnable scripts; a sheet or table change is a re-run, never a hand edit of that JSON (CLAUDE.md "re-runnable builds"). The species, pets, monsters, dungeon, encounters, chests and contracts are hand-kept JSON.

## The effect DSL

Skills, monster attacks, statuses, traits, elite affixes, set bonuses, curios, traps, relics and consumables all describe what they do as a list of `effect` lines (`common.schema.json#/$defs/effect`), resolved in order:

| kind | required fields | meaning |
|---|---|---|
| `damage` | `multiplier`, `damageType` | Attack × multiplier through the §2.2 damage formula |
| `heal` / `shield` | one of `multiplier`, `percent`, `amount` | heal or absorb |
| `applyStatus` / `removeStatus` | `status` (+ `chance`, `duration`) | a status from the standard set |
| `buffStat` / `debuffStat` | `stat` + `amount` or `percent` | move a derived stat for `duration` turns |
| `momentum` / `light` | `amount` | move the Momentum bar or the light dial |
| `pool` | `amount` or `percent` | restore or drain stamina/mana |
| `timeline` | `energy` | push (negative) or pull the accumulator |
| `rowSwap`, `taunt`, `dispel` | — | act on `target` |
| `summon` | `summonId` | add a monster to the acting side |
| `revive` | `percent` | revive a downed ally at that HP |
| `loot` | `amount` or `percent` | gold or drop-odds change |
| `custom` | `customId`, optionally `itemId` | a hand-written sim hook, named so the linter can list them; `itemId` names the item or material the hook grants or consumes (rule 2 resolves it) |

`target` on a line overrides the owner's target; `scalesWith` names the attribute whose points above 10 add to the line; `note` is for the designer and ignored by the sim. The `target` enum covers rows on both sides (`partyFront`, `partyBack`, `allyRow`, `enemyRow`, `enemyRowBack`), `enemyRandom`, `summon`, `downedAlly`/`allDowned` (within the revive window) and `fallenAlly` (past it); "single + behind" is two lines, `enemy` then `enemyRowBack`.

Two more shared shapes live beside it. A **`requirement`** (`{kind, id?, min?, amount?, consumed?}`, kinds `item · fieldSkillRank · attribute · detection · gold · light · classId · speciesId`) gates a curio choice, a door or a kit; a list is an AND. A **`reward`** (`{kind, id?, amount?, chance?, grade?, tier?, difficultyMin?}`, kinds `item · material · tome · shard · gold · luck · title · waystone`) is one drop line on a boss, a trap disarm or a contract; chest keys are items.

## What the linter checks that the schema cannot

`npm run lint` runs ajv on every file, then these cross-file rules. Each failure prints `<file>: <rule>` and the run exits 1.

**Ids and references**
1. The file name equals the record's `id`; ids are unique within a kind; a skill sits in the folder of its `classId`, an item in the folder of its `kind`, a template under its dungeon.
2. Every reference resolves: `classId`, `speciesId`, `skillId`, `prerequisiteId`, `ultimateSkillId`, `starterSkillIds`, `starterKit`, `monsterTechniqueIds`, `monsterTechniqueSkillIds`, `innateSkillId`, `itemId`, `affixId`, `setId`, `pieces`, `safeItemId`, `materialId`, `monsterId`, `summonId`, `familyId`, `dungeonId`, `zoneId`, `hunterId`, `bossIds`/`bossId`, `bossFirstKill`, `encounterTableIds` ↔ `tableId`, `petId`, `speciesFamilyId`, `upgradesTo`, `bossBecomes`, `trapId`, `chestId`, `elitePool` ids, **every reward `id`** (an item, material, skill, title or zone by its `kind`) and **every requirement `id`** (an item, class or species id, or a fieldSkill/attribute name by its `kind`), and a skill's `school` against its class's `schools[].id`. A `familyId` resolves when at least one monster carries it; a title resolves when some reward line or hero carries it.
3. A status file's `id` is one of the `status` enum and every enum value has a file (`content/statuses/` holds all 27).

**Classes and skills**
4. Every class has exactly **3 non-Ultimate skills per school in each tier it ships** (3 schools × 5 tiers × 3 = the 45 of `04`; the Ultimate is the 46th, `03` §7.1); Tiers I–III are required, IV–V warn until Phase 7 (D-070).
5. Each Tier II–V skill's `prerequisiteId` is a Tier N−1 skill of the **same class and school**; Tier I skills have `null`.
6. Exactly **one** skill per class has `isUltimate: true`, it is at **Tier III**, and it is the class's `ultimateSkillId`.
7. `starterSkillIds` are three Tier I skills of that class. **Monster techniques:** every id in a class's `monsterTechniqueIds` is a skill file of that class at **Tier III or IV** with a non-null `monsterTechniqueOf`; that monster's `monsterTechniqueSkillIds` contains the skill; and every id in any monster's `monsterTechniqueSkillIds` points back the same way (a monster may teach several classes). A class should meet two or more techniques per dungeon (`06` §8.8) — a warning, not a failure.
8. A class's `attributeMods` sum to **+4**; a species' net to **+2**.
9. Field skills (`classId: "field"`) exist for all eight `fieldSkill` values and no more; pet actives (`classId: "pet"`) are only referenced from `pet.actives`.

**Monsters, elite affixes, dungeons, encounters**
10. Every monster family has **all five roles** (fodder, elite, special, monster, boss) across its monsters; every zone's `hunterId` (when not null) is a monster with `role: hunter` and **every id in `bossIds` exists** and is a monster with `role: boss` and `zoneId` of that zone.
11. A boss's phases are in descending `atHpPercent` starting at 100; every phase `attacks[]` id and every behavior `then` that is not `flee`/`guard`/`swap row` is one of the monster's `attacks[].id`; a zone boss has 2 phases, a final boss 3 — "final" meaning the boss of the last floor of a dungeon with all three zones written (a partial dungeon's last boss is a zone boss and warns; D-072); each `adds[].monsterId` exists. Every reward line in `everyKill`/`firstKill` resolves (rule 2); a God item appears only as a chance line with `chance ≤ 4`.
12. `generator.roomWeights` sum to **100** over the rolled kinds; `bossFarthest` is true; `minRooms ≤ maxRooms` and every floor's `roomsMin/Max` sit inside them.
13. Floors are numbered 1..n without gaps, each inside its zone's `floors` range; zones tile the dungeon's floors; every zone's `bossIds` each appear as exactly one floor's `bossId` inside the zone, in order, the last on the zone's last floor; a floor with a `bossId` has `hunterClock: null` and the floor before it has `merchant: true`; a zone with `hunterId: null` has `hunterClock: null` on every floor.
14. `eliteAffixCount` follows the band (1 on floors 1–2, 2 on 3–6, 3 on 7+; dungeons 2–4 one higher); every `elitePool` id resolves to a `content/elite-affixes/` file whose `floorMin` ≤ the monster's lowest floor; a monster's pool holds at most one `defensive` and one `control` affix beyond the count the sim will draw; a boss, hunter or Monster-role template has an empty `elitePool`. Exactly **12** elite affixes exist.
15. Every id in a floor's `encounterTableIds` is carried by at least one encounter whose `floorBand` covers that floor and whose `dungeonId` matches; a composition totals 2–6 monsters with at most 2 Specials and 1 Monster; each monster's `row` is one of its `rows`.
16. Each curio choice's `outcomes[].chance` sum to **100** (or the list is empty); a curio with a `safeItemId` has exactly one choice whose `requires` is that single item; a `requires` line of kind `fieldSkillRank`/`attribute` names a real field skill/attribute (the schema does this), of kind `classId`/`speciesId` a real class/species. A trap's `difficulty` lies within some floor's `trapBand` of that dungeon, its `revealedBy.detection` ≤ its `difficulty`, and its `disarmReward` lines resolve.
17. A template's `doors[].offset` is inside its footprint on that side; `kinds` contains at least one rolled kind or one fixed kind; `triBudget ≤ 30000` and `drawCallBudget ≤ 60` (`07` §2.2). A dungeon's loot tables tile its floors by `floorBand`; `bossFirstKill` names the boss on the band's last floor.
18. Presets: `hard` and `nightmare` set every knob `normal` sets; a Pact's `weight` is 1–3 and the 12 launch Pacts exist on the first dungeon.

**Items, affixes, sets, chests, loot tables**
19. `affixSlots` matches the grade (F 0 · E 1 · D 1 · C 2 · B 2 · A 3 · S 3 · SS 4 · God 4) and `maxPlusN` the grade (F 3 · E 4 · D 5 · C 6 · B 7 · A 8 · S 9 · SS 10 · God 10).
20. `affixes.length ≤ affixSlots`; each rolled `value` lies within the affix line whose band covers the item's grade; the affix lists the item's `slot`; a set piece spends one slot on its set line.
21. `durability ≤ maxDurability`.
22. `materialRung` equals the grade's index on the ladder (F 0 … God 8) and is null exactly when `materialLadder` is null; across items that share a `visual.meshId`, `baseStats` scale by the grade multipliers (F 1.00 · E 1.35 · D 1.80 · C 2.45 · B 3.30 · A 4.45 · S 6.00 · SS 8.10 · God 11.0) relative to the F piece, rounded to integers; a line equal to the F piece's is a **flat** line and passes (percentages and penalties do not ride the ladder, `08`), and a shield's `block` may step +`equipment.shields.blockStepPerGrade` pp per grade (`08` §2.3; D-072).
23. God items are `unique: true` with a `uniquePower`, one per slot, and **never appear in any random table**: no chest `table` gives God above 0, no loot table's `gradeShape` reaches God from its centre, no encounter or curio `loot` names a God item; a boss's `everyKill` may name one only as a chance line (rule 11).
24. An affix's `lines[]` bands do not overlap and run in ladder order.
25. A set's `pieces` all exist, carry its `setId`, sit in the five armor slots of its `family` (or the two ring slots of a `ringPair`), and share the set's `classIds` lock; `gradeMin ≤ gradeMax` when both are set.
26. Each chest `oddsByBand[].table` sums to **100** and contains no grade below `centreGrade`; a Grand **gear or egg** chest's table is `08` §10's shape **+1 45 · +2 35 · +3 15 · +4 5** with any God share folded into SS (crates and tomes carry no shape; D-072); `pity.plusOneWithin < plusTwoWithin`.
27. **A loot table's `gradeShape` sums to 100** (`centre + minus1 + plus1 + plus2 + plus3`); `minus1` is 0 when the centre is F (the fold goes into `centre`); `partChance` and `itemChance` match the band rows of `08` §11 unless a note says why not.

**Pets and heroes**
28. **Pet actives by grade:** a species lists 1–3 actives in unlock order; a hatched pet may use the first *N* for its grade — **F–C 1, B–A 2, S+ 3** — so a species lists at least as many as `gradeBand.max` allows and never more than 3 (a species whose band reaches S needs a third). The first unlocks at **5**, the second at **15**; all resolve to skills with `classId: "pet"`. `gradeBand.min ≤ max` and both ≤ A for a `creationChoice` pet (creation offers F eggs).
29. **Loadout presets by species:** a hero's `loadoutPresets.length` ≤ its species' `loadoutPresets` rule (default 2; Humans 3; the schema's ceiling is 4). `naturalArmor` is non-null exactly when the species sets `naturalArmorBase`; `freePointsSpent` ≤ 6 and `creationValues` = 10 + species + class + the free points.
30. A hero record (only checked in `npm run lint -- --saves`): skills' `classId` matches the hero's class or is `field`; loadout ids are known skills of the right `type`; equipped items' `slot` matches the equipment key and `classLock` allows the class; `ring` holds ring items; `level` ≤ the level its total skill ranks allow; `titles` resolve to title ids some reward line grants.

**Custom hooks and tuning**
31. Every `customId` used in any effect line anywhere in the content has a handler file `sim/src/skills/custom/<customId>.ts` (`09` §6; the handler contract is `sim/src/skills/custom/README.md`); checked once that folder exists (Phase 2 creates it).
32. `content/tuning.json` validates against `tuning.schema.json`: every section carries its `source`; every leaf is a number, a `{value, note}` pair (a non-empty `note` and nothing else), a boolean, a string of at most 240 characters or null; an object with a `value` key is always read as such a pair, never as a table.
33. Each dungeon's `secrets[]` (07 §2.6) have unique ids, a `zoneId` that is one of the dungeon's zones or null, reward ids that resolve, and each grants something (rewards, a chest, a blessing with effect lines, a shortcut, a map reveal or light); an item reward names an id or a grade.

Rules 11, 14, 19, 22, 23 and 27 are implemented as far as the content can be checked (`tools/lint/rules.ts` says in each what it reads); rule 27's `partChance`/`itemChance` band comparison waits for the loot tables of Phase 3.

**The Phase 2 fixture set.** `sim/test/fixtures/content/` mirrors this layout with test content (one class, two species, seven Cellars monsters, one zone); `sim/test/fixtures/assemble.ts` merges it with the real schemas, statuses and `tuning.json` into a temporary root that `lintCorpus(root, { skipRules: [4, 10, 14] })` and the sim's loader both read. It is not shipped; Phase 3 promoted its records into `content/` (D-068) and keeps it as the sim's small, stable test corpus.

**Gating (D-049).** The rules that demand a *complete* set — rule 3 (all 27 statuses), rule 9 (all eight field skills), rule 14's "exactly 12 elite affixes" and rule 18's "the 12 launch Pacts" — apply only once at least one file of that kind exists; an empty kind is a Phase 1 state, not an error. Every other rule applies to whatever files exist, and a dangling reference always fails, even when the referenced kind has no files yet.

## `npm run lint`

`tools/lint/index.ts`, run by Node 24 directly (`npm run lint` = `node tools/lint/index.ts`; Node strips the types, no build step, no `tsx`), exit code is the result. `npm run lint -- --saves [path]` also lints hero save records: `content/saves/*.json`, or the file or folder given. The pure core is `lintCorpus(rootDir)` in `tools/lint/lint.ts`, which the tests run on temporary copies of `content/`.

1. Loads `content/schemas/*.schema.json` into **ajv 2020-12** (`Ajv2020` from `ajv/dist/2020`) with `strict: true`, `allErrors: true`, `allowUnionTypes: false` and `strictRequired: false` — the last because ajv evaluates `allOf`/`if`/`then` before `properties` and so cannot see a parent's property list from inside a `then`; every other strict check (unknown keywords, union types, tuple shape, number formats, missing `type` beside an applicator) is on. No `format` keyword is used, so `ajv-formats` is not needed; if one is added, add `ajv-formats` and register it here.
2. Checks each schema's `$id` is `https://gloamvault.dev/schemas/<file>` and `$schema` is draft 2020-12; `addSchema` for all of them **first**, then `compile` each — cross-file `$ref`s (`hero` → `item`, `pet`; everything → `common`) resolve lazily, so compile order must not matter.
3. Validates every content file against its kind's schema (the kind is the folder: `skills/<class>/` and `items/<kind>/` are still `skill` and `item`; `dungeons/<dungeon>/dungeon.json` is `dungeon` and `dungeons/<dungeon>/templates/*.json` are `dungeon.schema.json#/$defs/template`; `content/tuning.json` is `tuning`) and every `content/examples/<kind>[-variant].example.json` likewise, matching the longest schema name the file name starts with (`elite-affix`, `item-set`, `loot-table`, `tuning` are kinds; `monster-boss` is a variant of `monster`). A schema with no example is an error (`common` excepted: nothing validates against it directly). `content/saves/*.json` validate against `hero.schema.json` only with `--saves`.
4. Runs the cross-reference and arithmetic rules above over the whole corpus.
5. Prints one line per file (`ok`/`FAIL`) and each ajv error as `<instancePath> <message> <params>`; a cross-file failure prints as `<file>: <rule number>. <what failed>` (a failure with no file to blame, such as a missing status, names the kind's folder, `content/statuses`); rule 7's techniques-per-dungeon check prints as `warning <file>: 7. …` and never fails the run; ends with `ALL GOOD: N schemas, M files` or `K failure(s)` and **exits 0 only when every file passed**. No file is written. CI runs it on every push; the sim never validates at runtime — it trusts a linted corpus and refuses to start on a `saveVersion` mismatch.

The reference implementation of steps 1–3 is the validator used to check this folder: load schemas, register all, compile all, validate every example, exit code. It ran clean on rev. 2 (17 schemas compiled, 18 examples valid; 18 and 19 since `tuning`) and rejected 113 deliberately broken variants (a passive with a weight, an Ultimate at Tier I, a weapon with no weapon type, a boss without a boss block, a hunter without `levelOffset`, a reward of kind `key`, a Luck XP line, a four-piece armor set, a grade-shape line above 100, …).

## Representation choices

Where the owning doc is silent, the schemas take the simplest reading. Each is a **Proposed** decision for James; change the schema and the example together.

- **Class `role` is a free one-line string**, not an enum: the rulebook never names a closed set of party roles. The monster `role` enum is the taxonomy of §11.1 and is closed.
- **Field skills, pet actives and monster-only skills are skill records** with `classId` one of the literals `"field"` / `"pet"` / `"monster"`, `school` the same literal, `tier: 1` and `prerequisiteId: null`, filed under `content/skills/field/`, `pet/`, `monster/`. The literals are ordinary ids, so no class may be named `field`, `pet` or `monster`. The 45-per-class count ignores all three.
- **`school` on a skill is the school's id** from its class's `schools[]`; the linter joins them.
- **`rankScaling` is signed**: `effectPerRank: 4`, `costPerRank: -2` (§5.2's +4% / −2%), so the sim adds without knowing the sign.
- **Ultimates** carry `cost: 0`; the 100-Momentum price is a rule of `isUltimate`, not a field.
- **Skill `requirements`** (`shield`, `weaponTypes`, `dualWield`, `twoHanded`) is optional and only present when a skill needs something in hand (Shield Slam, Iron Dance, Executioner).
- **Skill `tags` are a closed enum** (aoe, singleTarget, control, mobility, momentum, light, scouting, heal, cleanse, buff, debuff, dot, shield, taunt, reach, summon, revive, utility, field) so the Skill Hall's "Recommended loadout" can rely on them; extend the enum in `skill.schema.json` when a new tag is needed.
- **Monster techniques are a list on both ends**: `class.monsterTechniqueIds` (skill ids) and `monster.monsterTechniqueSkillIds` (the same skill ids, from the monster's side), because one monster teaches up to two classes (`06` §3 "Technique:" lines) and rule 7 lints the pair.
- **`weaponType` keeps the generic `bow`** for class lists and adds `longbow`/`shortbow` for items and species locks (`05`: "Longbows locked, shortbows and crossbows fine"); `shortSpear` is the 1h spear, `spear` the 2h reach spear; `lantern` and `horn` are the Beast Tamer's off-hands.
- **`materialRung` is the ladder index 0–8**, redundant with `grade` on purpose: it is the field the blacksmith's promotion reads, and the linter checks the two agree. Regional variants (Steel/Bluesteel) are the material item's own `name`; the ladder has nine rungs, not eighteen.
- **An item file carries instance-shaped fields** (`durability`, `plusN`, `itemLevel`, `affixes` …) as its starting values, so a shop item, a starter-kit piece and a pre-rolled drop are all plain item files. A hero's copy is `item.schema.json#/$defs/itemInstance`: the item id plus only what use and care change.
- **Sets are their own record** (`item-set.schema.json`): the pieces are ordinary items with `setId`; `bonuses` holds `"2"` and `"4"` effect lists (a `ringPair` only `"2"`), `bonusText` the card lines, because `08` §6's bonuses do not ride the ladder and so cannot live on a piece.
- **Pet grade lives on `petInstance`**, not the species; the species carries a `gradeBand` and lists actives in unlock order; a hatched pet uses the first N by grade (rule 28). The stamina cost of an active is the pet skill's `cost`.
- **`petInstance.name`** (the player's name for it) and **`stance`** are stored on the instance; §9 makes the stance the pet's whole control surface, so it belongs in the save.
- **A floor carries `encounterTableIds`**, several tables drawn with equal weight (`07` §2.3: "Cellars A, B; Cellars C"); an encounter carries one `tableId`. §11.1 speaks of "encounter tables per floor band" without saying how a table is keyed.
- **Elite affixes are records** (`elite-affix.schema.json`, `06` §2's twelve) with an `affixClass` for the composition rule, the champion's multipliers (`hpMultiplier` 2.5, `goldMultiplier` 3, `xpClassBonus` 2) and a `floorMin` for the F1–2 teaching pool; monsters list the ones they may roll in `elitePool` and rule 14 resolves them.
- **Monster `rows`** is an array of `front`/`back` (which rows it may stand in); the common `row` enum's `either` is for targets, not placement. A monster's `ambushModifier` is its individual surprise modifier (`06` §8.3); the encounter's is the family's.
- **Monster `statusImmune`** is separate from `immune` (damage types) because the rulebook treats elements and statuses as different tables; a boss's `boss.immunities` is the `06` §7 list on top.
- **Boss drops are two reward lists**: `everyKill` (the stack, the grade-rolled item, stones, the God item as a `chance` line per `difficultyMin`) and `firstKill` (the Relic, the Tome, keys as items, `title`, `waystone`, `luck`). `06` owns phases, attacks and first-kill drops; `08` §11 owns the per-kill rows; where they still differ the example follows `06` and the loot table's `bossFirstKill` only names the monster.
- **Boss `cannotFlee: true`** is stored even though §12.1 makes it universal, so the sim reads one field for bosses and hunters alike.
- **Hunter `levelOffset`** (default 3, `06`: level = floor + 3) and **`roomsPerTick`** (a decimal: 0.5 = one room every 2 ticks; the sim keeps ticks-per-room internally) are on the hunter block. `07` §2.9's "+2 levels" is the open question on `06`; the field takes either.
- **Behavior lines and hero `aiRule`** are strings in the gambit language of §3.6 (`IF … THEN …; ELSE …`); the parser owns the grammar. The linter only checks that a `then` naming an attack resolves.
- **A zone has `bossIds[]` and a nullable `hunterId`** so the Vault can carry Naesa on F9 and the Hollow King on F10 (or the throne floor can be a hunter-less fourth zone); a floor still names its one `bossId`, its `lightAtArena`, and `hunterClock: null` on boss floors.
- **Curio choices carry `requires[]`** (`common.requirement`): a consumed Torch, "Foraging rank 3+", "Detection ≥ 14", "Strength ≥ 14", "Lockpicking vs 12", a 0.05 R stake, a class in the party. `safeItemId` stays on the curio as the item that makes the good outcome certain; the choice that needs only that item is the purchase. Outcomes with an empty list mean "nothing happens" (the Leave choice).
- **Traps carry `trigger`** (`enter · step · open · loot · time`) with the designer's exact `triggerNote`, **`revealedBy`** (`detection`, plus an always-reveal `classId`, `petId`, `fieldSkillRank` or `criticalScout`), **`effects[]`** in order, and **`disarmReward[]`** as reward lines, so "2 Rawhide, 0.01 R" is two lines; field-skill XP for the disarm is a rule, not data.
- **Room templates** use cardinal door sides with a cell offset, a `[x, y, z]` camera with a vertical FOV, props flagged `lightSource` for the braziers of §4.2, and the `07` §2.2 budgets (`triBudget`, `drawCallBudget`); the `11` art file's figures are the owner if they differ.
- **Difficulty knobs** are every row of `07` §6.1 (`enemyHpPercent` … `finalBossExtraShards`), all optional inside a Pact and a preset; absent means Normal. The three launch presets are required on every dungeon; a Pact adds `weight` (its Oath contribution) and `ruleFlags` for what no knob can say.
- **Contracts** (`contract.schema.json`) are templates the board fills with the band: `kind` + `target` for the condition, `reward` in R plus `keys[]` (standard/grand), an optional `chestId`, and `items[]` for Torches or a Skeleton Key. The weekly key caps are a rule.
- **Loot tables** (`loot-table.schema.json`) are one record per floor band and dungeon: `gradeShape` is the drop shape of §6.2 — **centre 56 · one below 25 · one above 14 · two above 4 · three above 1**, summing to 100 — with a missing lower grade folded into the centre (the Cellars: F 81 · E 14 · D 4 · C 1); `treasureRoom` holds `07` §2.7's chest, lock and trap odds; `bossFirstKill` points at the boss monster.
- **Chest odds**: the rulebook's Standard Gear Chest at band B reads **B 56 · A 25 · S 14 · SS 5 · God 0**, which sums to 100 and is what the example carries; Grand shifts one grade up and adds the 5% Divine Shard line. `08` §10.1's fold rule (a God point moves to SS) is the same table written from the +4 line.
- **`tomeTiers`** on a chest is the tier range in a Skill Tome bag (Standard I–III, Grand II–IV) and null on other chests.
- **Status records carry their magnitude** as `magnitudeOf` (`hitDamage · maxHp · attack · fixed`) + `percent`, written from the §3.5 table: Bleed is 25% of the applying hit per turn, 3 turns, 3 stacks; Poison 3% of max HP; Regen's X is `fixed` by the skill. `kind` adds `mark` (Mark, Smite, Wither) and `state` (Veil); `element` names the element whose hits apply it; `endsWhen` carries an until-condition (Grab, Veil) with `durationDefault: null`; `bossBecomes` is `06` §7's Stun → Daze / Freeze → Chill. `upgradesTo` (Chill → Freeze), `skipsActionChance` (Fear, Stun) and a `visual` block are there because §3.4–§3.5 state them and nothing else owns them.
- **Species rules are typed knobs** (`species.schema.json#/$defs/rule`), one object per trait, covering every "Exact rule" and "Cons" line of `05`: `speedBase`, `hpMultiplier`, `manaMultiplier`, `xpMultiplier`, `carryMultiplier`, `dodgeBonus`/`dodgeCap`, `fortuneBonus`, `detectionBonus`, `lightBandShift`, `armorPenaltyMultiplier` per family, `shopPriceMultiplier`, `promotionCostMultiplier`, `ambushModifier`, `immunities[]` (statuses), `forcedRowMoveImmune`, `resist{}`/`weak{}` by damage type, `statusResist{}`, `enemyAccuracyBySize{}`, `fieldSkillBonus{}`, `fieldSkillStartRank`, `loadoutPresets`, `innateSkillId`, `naturalArmorBase` and the Orc's and Halfling's one-offs. A species' con line is a trait too, so the card can print it.
- **Species restrictions** are one of three shapes by `kind` (`weaponType`, `slot`, `shieldType` with `buckler · kite · tower · all`), each with an optional `reason` for the card.
- **The hero keeps `loadoutPresets`** (named saved loadouts, ≤ 4; rule 29 applies the species count), **`naturalArmor`** (the Draconid's Scales: `defense`, `itemLevel`, `xp`, `affinities`; null otherwise) and **`freePointsSpent`** (the six creation points).
- **Luck is never trainable** at the schema level: `skill.xpTags` and `hero.attributeXp` use `trainableAttribute`, the seven without Luck; a boss's `luck` reward is the one way it moves after creation.
- **Gold on the hero** is the delve's unbanked stake only; banked gold is a profile field the hero schema does not own.
- **`tuningNumber`** (`common`) is the shape of `content/tuning.json`, the balance runner's tables; no content schema uses it.

## Wayfarers (D-091) and lint rule 34

- `content/wayfarers/<id>.json` (schema `wayfarer.schema.json`): the Wayfarer Chest's cast, owned by `docs/04-CLASSES.md` §7 and written by `node tools/content/gen-wayfarers.ts` (edit the table, never the JSON). A chest of kind `wayfarer` (`chests/standard-wayfarer-chest.json`) has `dupeRule: "none"`, no sub-types, no Tome tiers and no Divine Shard.
- **Rule 34:** each wayfarer's species and class exist; its three starter skills are Tier I skills of its class, not an Ultimate, at least one active and at most two passives; its creation points add up to 6 + 1 per grade above D; names are unique across the cast; and every grade a wayfarer chest's table gives a chance to has at least one wayfarer.
