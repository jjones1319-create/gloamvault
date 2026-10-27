# sim/test/fixtures — the Phase 2 fixture content set

*Test content for the simulator and the balance runner, not shipped content* (`docs/12-ROADMAP.md` Phase 2 "done when": "a fixture content set — one class, one species, three Cellars monsters and one floor, taken from `content/examples/` and extended as test fixtures"). Phase 3 writes the real `content/` and may promote these files; every number here comes from the owning doc (`docs/classes/warden.md`, `05`, `06` §3.1, `07` §2, `08`, `09` §5), and the readings taken where a doc is silent are listed in the Phase 2 hand-over and logged in `docs/13-DECISIONS.md`.

## What is here

`content/` mirrors the layout of the repo's `content/` folder exactly (one record per file, named by its `id`; `content/README.md` owns the rules):

| Folder | Records |
|---|---|
| `species/` | `human`, `dwarf` |
| `classes/` | `warden` (starter kit, three starters, the Ultimate; `monsterTechniqueIds: []`) |
| `skills/warden/` | 12: Shield Slam, Provoke, Brace, Wall Stance, Rallying Shout, Reaching Thrust, Counter Stance, Loud Voice (Tier I); Shove, Intercept, Challenge All (Tier II); **The Gate Holds** (Tier III Ultimate, Bulwark, prerequisite Shove) |
| `skills/field/` | the eight field skills, `field-lockpicking` … `field-cartography` |
| `skills/pet/`, `pets/` | `pet-hound-bite`, `pet-hound-guard-dog`; `cellar-hound` |
| `monsters/` | `giant-rat`, `plague-rat`, `grinning-cutpurse`, `grinning-crossbowman`, `grinning-netter` (Special), `old-gnaw` (hunter), `captain-vexa-marrow` (boss) |
| `elite-affixes/` | the F1–2 teaching pool: `rabid`, `thorned`, `vampiric`, `shielded`, `commander` |
| `encounters/` | `rat-pack` (cellars-a), `toll-collectors` and `cutpurse-pair` (cellars-b), `netters-corner` (cellars-c) |
| `dungeons/gravehollow-keep/` | `dungeon.json` — the Cellars only (F1–3; F3 the boss floor), the generator (G1–G15), three curios, three traps, the presets, `pacts: []`; `templates/` — nine Cellars rooms (`cel-t-storeroom` … `cel-t-tap-room`) |
| `loot-tables/` | `gravehollow-cellars` |
| `chests/` | Standard and Grand Gear Chest, Pet Egg, Material Crate, Skill Tome |
| `affixes/` | `of-vigor`, `keen`, `of-the-hawk`, `sturdy` |
| `items/` | the Warden kit at F (Copper Shortsword, Pine Buckler, Copper Helm / Breastplate / Greaves / Sabatons / Gauntlets, Ring of Vigor), the E siblings (Bronze Shortsword, Bronze Helm, Bronze Breastplate), consumables (Small HP Potion, Torch, Repair Kit, Bandage, Antidote, Flint & Oil), materials (Rawhide, Copper, Leather, Bronze), the Whetstone and the Cellars' rare-part stones, Skeleton Key, Bandit Lockpick, Standard Chest Key, the Cellar Hound egg, the Grinning Mask relic |
| `contracts/` | `rat-catcher` |

Template ids are kebab-case (`cel-t-stairwell`), not the underscore names `07` §2.2 uses (`cel_t_stairwell`): the common id pattern (`^[a-z0-9]+(-[a-z0-9]+)*$`) allows no underscores.

## What it deliberately lacks

- The other six classes, four species, the Cellars' other seven monsters (so the Warden meets no monster technique here), the Crypts and the Vault, Dungeons 2–4, sets, Pacts, Tier III–V skills beyond the Ultimate, arrows and every Ranger/caster item. `classLock` lists only `warden` because no other class exists in the set.
- F3 draws only `netters-corner` because every other F3 encounter of `06` §3.1 needs monsters outside the set.
- Its own `schemas/`, `examples/`, `statuses/` and `tuning.json`: those are the repo's and are copied in at test time (below), so the fixture never drifts from them.

## Linting and loading

The linter and the sim read one folder, so the fixture is merged with the repo's content into a temporary root:

```ts
import { assembleFixtureCorpus, FIXTURE_SKIP_RULES } from './fixtures/assemble.ts'
import { lintCorpus } from '../../tools/lint/lint.ts'
const root = assembleFixtureCorpus() // <tmp>/content = schemas + examples + statuses + tuning.json + this folder
const result = lintCorpus(root, { skipRules: FIXTURE_SKIP_RULES }) // skips rules 4, 10, 14
```

`sim/test/fixtures.test.ts` does exactly this and asserts zero ajv errors, zero cross-file failures beyond the skipped rules and one known deviation, and the record counts above. From a shell the same run is `node tools/lint/index.ts` pointed at a merged copy (the CLI lints the repo's `content/`; use the test).

**Skipped rules** (`content/README.md` "Gating"): 4 (45 skills per class), 10 (all five roles per family), 14 (exactly twelve elite affixes) cannot hold on a fixture.
**Known deviations:** none since D-072 — rule 11 reads the boss of a one-zone dungeon's last floor as a zone boss (two phases) and only warns. The test asserts there are no cross-file failures beyond the skipped rules.

The merged root also loads through the sim's content layer: `loadContentDir(path.join(root, 'content'))` (`tools/sim/loadContent.ts`), which is what the balance runner should use for its Phase 2 report.
