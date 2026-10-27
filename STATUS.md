# STATUS — Gloamvault checkpoint

*Claude Code keeps this file current while it works (CLAUDE.md rule 6). A fresh chat resumes from here.*

## How to run

- `npm install` once (Node 24+, npm 11+), then `npm run dev` → http://localhost:5173/gloamvault/ (add `-- --host` to open it on the phone over Wi-Fi).
- `npm run verify` before every commit (typecheck · test · lint · build · check:build). `npm run shots` writes the screenshot set to `client/shots/` (read the PNGs). `npm run e2e` runs the Playwright smoke on the built app. `npm run icons` re-renders the PWA icons from `client/public/logo.svg`.
- `npm run sim -- --fixture --seed 17 --party warden --ascii` plays one delve in the terminal (`--party warden,warden:dwarf:Orrin`, `--zone 1`, `--policy cautious`, `--difficulty hard`, `--quiet`). `npm run balance -- --seeds 100 --tag <tag>` writes `tools/balance/out/<date>-<tag>.json` and `docs/balance/<date>-<tag>.md`. Both use the Phase 2 fixture content until `content/` has a dungeon.
- Live link: **https://jjones1319-create.github.io/gloamvault/** (deployed by GitHub Actions on every push to `main`; `gh run list` shows the status).

## Where we are

- **Segment:** 1 (Phases 1–4) — **in progress**, started 2026-10-26.
- **Phase:** 2 — The rulebook as code (the sim) — **done 2026-10-27** (verify green; the first balance report written). **Phase 3 — Content pass 1 — next.**
- **Last commit:** see `git log` (the Phase 2 commit is `P2: the rulebook as code`).
- **Tools checked 2026-10-26:** Node 24.18.0 ✓ · npm 11.16.0 ✓ · git 2.51 ✓ · gh 2.102 signed in as `jjones1319-create` ✓ · Blender 5.2.2 LTS ✓ (needed from Segment 2) · Google Chrome ✓.

## Phase 2 task list (done)

1. [x] `sim/src/types/*`, `sim/src/content.ts`: the record types mirroring every schema, the enums, the `Content` bundle with split-template merging and sorted indexes.
2. [x] `sim/src/rng.ts`: xoshiro128** on four u32 words, splitmix32 seeding that mixes both halves (a first-draw bias found by two subagents is fixed and tested), `seedFor`, forks, jitter.
3. [x] `sim/src/stats.ts`: §2.2 in integer math; the Warden's creation card reproduces (Speed 80 with per-piece requirements, D-057).
4. [x] `sim/src/hero.ts`, `sim/src/xp.ts`: creation (species × class × 6 free points = 92; starter kit; starter skills; egg), hero → fight actor through the item module; the gate, the D curve, budgets, rank/point/item curves, soft caps, levels (D-056).
5. [x] `tools/sim/loadContent.ts` and `client/src/content/load.ts` (the client loader exists; the app wires it in Phase 4).
6. [x] `sim/src/timeline.ts`: accumulators, weights with ±10% jitter, Haste/Slow, initiative and surprise, charged casts (D-029), the strip forecast; 2.6 : 1 dagger vs greatsword verified.
7. [x] `sim/src/statuses.ts`: the 27 records, ticks, countdowns, stacking, cleanse/strip, boss and size conversions, resist rolls.
8. [x] `sim/src/effects.ts` + `sim/src/skills/custom/` (15 hook files): the effect DSL, targets, the damage pipeline (hit, Veil, crit, variance, types and family weaknesses, Mark/Smite/Freeze, Guard, Block, Defense, Shield), Guard-pet interception.
9. [x] `sim/src/fight.ts`, `ai.ts`, `monsters.ts`, `pets.ts`: the fight loop, commands and legal actions, AI heroes/monsters/pets on the gambit grammar (D-060), rounds, flee, boss phases, summons; the monster baseline (D-061), champions, pet actors (D-063).
10. [x] Tests: the worked example (Slam 48 / basic 37 at pinned variance), status rules, grabs, a full auto fight to victory with a replay-equal hash, human commands, defeat, flee.
11. [x] `sim/src/items.ts`: instances, affix rolling, effective stats through +N and the durability band, wear with sub-percent carry, repair/kits/field repair, promotion, salvage, item XP and affinities (D-067).
12. [x] `sim/src/loot.ts`, `chests.ts`: fight and treasure loot, parts, dungeon chests, the Curio Merchant's chests with two-layer pity, dupes, eggs, crates, the Tome bag.
13. [x] `sim/src/insight.ts`, `pets.ts`, field-skill rolls in `detection.ts`/`economy.ts`.
14. [x] `sim/src/generator.ts` + `generator-ascii.ts`: the 07 §2.10 grammar, layout and decoration; the ten §8.1 guarantees hold over 500 seeds per floor; retries under 1% (D-066).
15. [x] `sim/src/explore.ts`, `delve.ts`, `progress.ts`, `policies.ts`: rooms, traps, curios, merchants, the hunter, fights wired to loot and growth, revives, descend/retreat/wipe, the four scripted players (D-064, D-065).
16. [x] `createDelve / legalDelveActions / stepDelve / runDelveAuto / replayDelve / hashDelve`; a replay from the seed and the command log hashes equal (the policy draws from its own stream).
17. [x] `npm run sim` prints a delve; `npm run balance` runs 4 recipes × N seeds in seconds.
18. [x] The fixture content set (`sim/test/fixtures/content/`, 98 records, lint-clean on the merged corpus with rules 4/10/14 skipped; D-068).
19. [x] `docs/balance/2026-10-27-first-pass.md` with judgement lines; first-pass corrections logged (D-069).
20. [x] Docs: `10` rev. 3 (the sim module map), `13` §E D-056–D-069, `content/README.md` (fixture note), `README.md`, this file.

## Done

- 2026-10-26 — The design package (see `docs/`), `CLAUDE.md`, `README.md`, `PROMPT.md`, this file.
- 2026-10-26 — Phase 1: the installable title screen, the toolchain (verify · lint · shots · e2e · icons), tuning and statuses as content. Commit `bde2c59`.
- 2026-10-27 — Phase 2: the sim (above), 239 tests, the fixture content, `npm run sim`, `npm run balance`, the first balance report.

## In progress

- Phase 3 starts next: the task list goes here in plan mode.

## Next

- **Phase 3 — content pass 1** (`12` §1): the six classes with Tiers I–III (27 skills each) and Ultimates, six species, the eight field skills, the Cellars zone (12 monsters, Old Gnaw, Captain Vexa Marrow, encounter tables, 8 curios, 6 traps, 3 secret types, templates), items F–C across slots and families, starter kits, the affix pool, consumables, the Cellars loot tables, the four chest types, the sixteen pets (three creation eggs), the Cellars contracts; the custom hooks the content names (the fixture README lists 30+); lint green; the balance runner on the real content with a second report and the tuning changes.
- **What the first balance report says** (`docs/balance/2026-10-27-first-pass.md`, fixture content, 40 seeds × 4 recipes): ordinary fights 3.4–3.5 rounds (OK), elites 3.8–7 (solo low, parties OK), bosses 6–16 (solo too short because the party dies, parties too long), party ambush rate 15–19% of fights (OK); **every recipe wipes by floor 3** — solo Wardens to two rats at the monster baseline (D-061: rats bite for 13 through Plate at 1.4 bites per Warden action), three-Warden parties to the boss. Suspected causes for Phase 3 to test in order: no healer in the fixture and no healing between fights except one rest per floor; the Warden's defensive hooks (`counter-stance`, `intercept-single-target`, `pool-on-block`, …) are no-ops; the monster baseline attack (14 + 1.5L) and the boss's HP ×14; fodder Speed 115–130 against a Plate Warden's 80.

## Decisions logged this phase

- D-056 XP curve readings · D-057 per-piece Strength requirements · D-058 ambush curve constant 30 and the reverse roll · D-059 Trap Disarm formula · D-060 the gambit grammar · D-061 the monster baseline · D-062 fight readings · D-063 pet stats · D-064 exploration readings · D-065 progress readings · D-066 generator readings · D-067 item and loot readings · D-068 the fixture set's readings · D-069 first-pass corrections. All **Proposed**, in `docs/13-DECISIONS.md` §E.

## Open for James (collected for the segment review)

- The consolidated list is `docs/13-DECISIONS.md` §D; D-048–D-069 are added to it at the review.
- Schema follow-ups found by the agents, for Phase 3: `item.wearK` should be `number` (08 §9.1 gives 1.33); `loot-table` has no `note` field for rule 27; the Grand chest shape in `08` §10.1 vs README rule 26; the hero example's level (fixed to 2); the common id pattern forbids the underscores `07` §2.2 uses in template ids (`cel_t_…` → `cel-t-…`).
- The sheet's 45-skill count plus the Ultimate makes 46 (rule 4 "exactly 45" vs rule 6): decide whether the Ultimate is one of the 45 or the 46th.

## Phone checklist (current phase)

Phase 2 changed nothing on the phone: the live app is still the Phase 1 title screen (v0.1.0). The sim runs on the PC:

1. In the project folder run `npm run sim -- --fixture --seed 17 --party warden --ascii`. You should see an ASCII map of floor 1, a room-by-room log, and a summary line (outcome, rooms, fights, rounds, gold).
2. Run `npm run balance -- --seeds 20 --tag try`. It prints the judgement lines and writes `docs/balance/<today>-try.md`; open that file to read the four tables.
3. Nothing to install or update on the phone until Phase 4.
