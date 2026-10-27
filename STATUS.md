# STATUS — Gloamvault checkpoint

*Claude Code keeps this file current while it works (CLAUDE.md rule 6). A fresh chat resumes from here.*

## How to run

- `npm install` once (Node 24+, npm 11+), then `npm run dev` → http://localhost:5173/gloamvault/ (add `-- --host` to open it on the phone over Wi-Fi).
- `npm run verify` before every commit (typecheck · test · lint · build · check:build). `npm run shots` writes the screenshot set to `client/shots/` (read the PNGs). `npm run e2e` runs the Playwright smoke on the built app. `npm run icons` re-renders the PWA icons from `client/public/logo.svg`.
- Live link: **https://jjones1319-create.github.io/gloamvault/** (deployed by GitHub Actions on every push to `main`; `gh run list` shows the status).

## Where we are

- **Segment:** 1 (Phases 1–4) — **in progress**, started 2026-10-26.
- **Phase:** 2 — The rulebook as code (the sim) — **in progress** (started 2026-10-26; Phase 1 done the same day, verify green locally and in CI, the link live).
- **Last commit:** `bde2c59` `P1: repo, skeleton, PWA shell, linter, tuning, statuses` on `main` (2026-10-26); repo https://github.com/jjones1319-create/gloamvault.
- **Tools checked 2026-10-26:** Node 24.18.0 ✓ · npm 11.16.0 ✓ · git 2.51 ✓ · gh 2.102 signed in as `jjones1319-create` ✓ · Blender 5.2.2 LTS ✓ (needed from Segment 2) · Google Chrome ✓.

## Phase 2 task list (the plan) — the rulebook as code

Milestones commit separately (`P2a` … `P2e`); each ends with `npm run verify` green. Subagents build the content types/loaders (P2a-1/5) and the floor generator (P2d-14) in parallel with the fight code.

**P2a — foundations**
1. [ ] `sim/src/types/content.ts`: TypeScript interfaces for every content kind (mirroring `content/schemas/*`), the enums as literal unions + runtime arrays, the `Content` bundle; `sim/src/content.ts` builds the bundle from a plain `{kind, path, json}` list (no fs, no fetch), merges split templates, indexes by id.
2. [ ] `sim/src/rng.ts`: xoshiro128** on four u32 words (state lives in the save), splitmix32 seeding from a 64-bit match seed, `next / int / pct / range / pick / shuffle / weighted / fork(label)`; golden-value and property tests.
3. [ ] `sim/src/stats.ts`: §2.2 derived stats in integer math from attributes + equipment (armor penalty, Str relief, requirements, durability bands, +N, affixes); tests against the table at all 10s and `warden.md` §2's creation numbers (HP 116 · Attack 38 · Defense 32 · Speed 81 · Stamina 66).
4. [ ] `sim/src/hero.ts`: creation (species + class + 6 free points, max +3; total 92), starter kit and skills, pet egg; `sim/src/xp.ts`: the gate, the D curve, per-delve budgets, skill rank / attribute point / item level curves, soft caps, hero level = total ranks ÷ 8; tests on §5.2's curve values (point 20 ≈ 62, 30 ≈ 193, 40 ≈ 600; rank 10 ≈ 3,800).
5. [ ] `tools/sim/loadContent.ts` (fs loader for tools and tests) and `client/src/content/load.ts` (import.meta.glob) both producing the same bundle.

**P2b — the fight**
6. [ ] `sim/src/timeline.ts`: accumulators, act at 1,000, weights 400/600/800/1,000/1,400 with ±10% seeded jitter, Haste/Slow, initiative 0–400 and the +500 surprise, charged heavy casts (D-029), deterministic tie-break; test: Speed 150 daggers vs Speed 100 greatsword ≈ 2.6 : 1.
7. [ ] `sim/src/statuses.ts`: the 27 records from content; tick at turn start, count down at turn end, stacking, cleanse/strip tags, boss conversions, size/role immunities (`06` §7), duration −1 on bosses.
8. [ ] `sim/src/effects.ts`: the effect-DSL interpreter (every kind), target resolution (rows, reach, random, lowest), hit roll, crit, variance, element and physical-weakness multipliers, Defense, Block, Guard, Veil, Taunt, Grab (D-047); `sim/src/skills/custom/<id>.ts` for every hook in D-050 (rule 31 switches on).
9. [ ] `sim/src/fight.ts`: actors (heroes, pets with stances, monsters, summons, champions with elite affixes), rows, pools and regen, Momentum, Ultimates, Items, Row swap, Flee, Free Ally, downed/revive window/fallen, part breaks, the 30-round cap; `sim/src/ai.ts`: the gambit parser for hero AI rules and monster behavior lines; `sim/src/policies.ts` (textbook, cautious, greedy, random).
10. [ ] Tests: `warden.md` §8's worked example reproduces (Slam 46, basic 35 with jitter off); every status's tick rule; fodder/elite/boss round targets on a scripted fight.

**P2c — things that grow and things that drop**
11. [ ] `sim/src/items.ts`: wear (k by class and grade, armor hit weights, bows half, shield blocks, weakness double wear), bands and Broken, neglect erosion and destruction, repair/kits/field repair, promotion, salvage, +N, item XP and affinities, Awakened; tests on `08` §9's "delves to broken" row.
12. [ ] `sim/src/loot.ts`: gold per fight (`06` §8.5), grade shape with Luck, parts, consumables, stones, treasure rooms, in-dungeon chests, town chests with the two-layer pity and the Tome bag, dupes.
13. [ ] `sim/src/insight.ts` (§7.5, pity 60, D-028), `sim/src/pets.ts` (stances, stamina, actives by grade, downed → 50%, treats), `sim/src/field.ts` (the eight field skills' rolls).

**P2d — the floor and the delve**
14. [ ] `sim/src/generator.ts`: the grammar G1–G15 of `07` §2.10 (mission graph → 8×6 layout with templates → decoration), room weights, Rest/Merchant/Key-Lock/Secret, the role-mix re-roll hook, boss farthest, clamps, retry on layout failure; `07` §8.1's ten guarantees as tests over hundreds of seeds; an ASCII printer for `#gen`.
15. [ ] `sim/src/explore.ts`: light, Detection (traps, secrets, hidden treasure, scouting), ambush both ways, the floor clock and the hunter, curios, rest rooms, merchant stock, retreat and the toll, Waystones.
16. [ ] `sim/src/delve.ts`: `createDelve / legalActions / step / runAuto / replay / hashState`, the command set, party death rules (§12), presets and Pacts as knobs; `sim/src/index.ts` exports.
17. [ ] `tools/sim/run.ts` → `npm run sim -- --delve gravehollow --zone 1 --seed 17 --party warden,mender --auto`; determinism test (same seed + log → same hash).

**P2e — the runner and the first report**
18. [ ] Fixture content under `sim/test/fixtures/content/` (not shipped): Warden (starters, Brace, Provoke, the Ultimate; count rules relaxed on fixtures) · Dwarf and Human · Giant Rat, Plague Rat, Grinning Cutpurse, Old Gnaw · Cellars F1 with four templates · the Warden starter kit, potions, torch, kit, bandage · Rat Pack and a Cutpurse pair · the Cellars loot table · the four chest types · Cellar Hound.
19. [ ] `tools/balance/run.ts` → `npm run balance`: seeds × parties × floors with the scripted policies, JSON to `tools/balance/out/` and `docs/balance/<date>-first-pass.md` with judgement lines (fight rounds vs `06` §8.9, win rate, gold per delve vs R, repair bill % of R, wear and delves-to-broken, ambush rate, hunter arrivals, Insight rate, downs, wipes).
20. [ ] Docs: `10` rev. 3 (sim module map), `13` Proposed lines for every silent-line reading, `content/README.md` fixture note, this file; `P2: …` commit; the phone checklist (nothing visible changes on the phone in Phase 2: the checklist says so).

## Phase 1 task list (done 2026-10-26)

1. [x] `package.json` (name `gloamvault`, 0.1.0, MIT), pinned stack: Vite 8 · TypeScript 6 (strict) · Preact 10 + @preact/signals · three.js 0.186 · vite-plugin-pwa 2 · idb-keyval · valibot · ajv 8 · Vitest 5 · Playwright 1.64 (installed Chrome). `LICENSE` (MIT).
2. [x] Layout per `10` §3 (as built, D-048): `sim/` (its own tsconfig, **no DOM lib**) · `client/` (Vite root) · `tools/lint`, `tools/build`, `tools/shots`, `tools/icons` · `.github/workflows/deploy.yml` (runs `npm run verify`, deploys `dist/`).
3. [x] `tools/lint`: ajv 2020-12 strict over the 18 schemas, every content file and example, then the cross-file rules of `content/README.md` (completeness rules gated per kind, D-049) with Vitest tests on deliberately broken variants.
4. [x] `content/tuning.json` (every number of `03` §2–§12, by section, with sources) + `tuning.schema.json` + example; `content/statuses/` (the 27 rows of `03` §3.5).
5. [x] Client shell (D-053): hash router with tests · title screen (version chip, live three.js torch-lit hall, menu) · Settings (performance overlay, Smooth 60 / Battery 30, text size, reduce motion, haptics, full screen, install, check for updates, reset) · the "Try this on your phone" card · install card · update toast (quiet screens only) · rotate hint · settings saved under `gloamvault/settings` with field-by-field validation.
6. [x] PWA: landscape + fullscreen manifest with `id`/`scope`/`start_url` = `/gloamvault/`, `registerType: 'prompt'`, models runtime-cached, icons rendered from the SVG logo (D-054).
7. [x] `check:build` (app JS 148 KB gz of 600; precache 0.8 MB of 8; manifest checks) · `npm run shots` (7 PNGs at the S25 Ultra viewport, D-052) — looked at; four layout defects found and fixed (tagline hidden by the install card, deep-link chip pushing the version off-screen, wordmark overflow in portrait, square dust motes) · `npm run e2e` smoke passes.
8. [x] Docs: `10` rev. 2 (§3 as-built, §7 viewport), `13` §E D-048–D-055, `README.md` link, this file. `content/README.md` lint notes.
9. [x] `npm run verify` green → `git init` → first commit `bde2c59` → `gh repo create gloamvault --public` → push `main` → Pages set to Actions → the deploy run green → the link serves the app.
10. [x] Phone checklist below; install steps given to James in the chat; on to Phase 2.

## Done

- 2026-10-26 — The design package: research (`docs/research/`), the rulebook (`03`), classes (`04`, `docs/classes/`), species (`05`), monsters (`06`), dungeons (`07`), items (`08`), skills index (`09`), tech plan (`10`), art pipeline (`11`), roadmap (`12`), decision log (`13`), ideas (`14`), the seventeen content schemas with validated examples (`content/`), `CLAUDE.md`, `README.md`, `PROMPT.md`, this file.
- 2026-10-26 — Phase 1 build (see the task list): the installable title screen, the toolchain (verify · lint · shots · e2e · icons), tuning and statuses as content.

## In progress

- Phase 2 is next; its task list is written below when it starts.

## Next

- **Phase 2 — the rulebook as code** (`12` §1): plan mode → task list here → `sim/` (rng, stats, timeline, combat, statuses, effect DSL, items, loot, exploration, pets, party, XP, Insight, field skills; `legalActions/step/runAuto/replay/hashState`; `policies.ts`) with tests on every formula and the rulebook's reference tables; `tools/balance` and the first balance report on a fixture content set; `npm run sim`. Create `sim/src/skills/custom/<id>.ts` for every hook named in D-050 (the linter's rule 31 switches on when the folder exists).

## Decisions logged this phase

- D-048 repo shape (Vite root `client/`, three TS projects, DOM-less sim, Node-direct tools) · D-049 Phase 1 content (statuses, tuning + schema; gated completeness rules; rule 31) · D-050 effect-DSL sign convention and the status hook names · D-051 item level curve 40 × 1.3^(N−1) · D-052 screenshot viewport · D-053 the Phase 1 client shell · D-054 icons via Playwright · D-055 tuning.json carries the rulebook's proposed readings. All **Proposed**, in `docs/13-DECISIONS.md` §E.

## Open for James (collected for the segment review)

- The consolidated list is `docs/13-DECISIONS.md` §D; D-048–D-055 above are added to it at the review.
- Preact 11 and TypeScript 7 are out; the build pins Preact 10 / TypeScript 6 (what `10` §2 and Wildsong Ranch use). Upgrade is a later, separate decision.

## Phone checklist (current phase)

Open **https://jjones1319-create.github.io/gloamvault/** in Chrome on the S25 Ultra.

1. The title screen shows **v0.1.0 · Phase 1**, two torches flicker on stone pillars, embers drift. Turn the phone upright: an orange "Turn your phone sideways" bar appears; turn it back.
2. Tap **⋮ → Add to Home screen → Install**. Open Gloamvault from the new icon: it is full-screen, sideways, and the version line now says **installed**.
3. **Settings → Performance overlay** on. Back on the title you should read about **60 fps** (the installed app may say 120 Hz panel but the game caps at 60).
4. Switch **Frame rate** to **Battery 30**: the fps number drops to about 30. Switch back to Smooth 60.
5. **Text size → Large**: everything grows, nothing is cut off. Set it back.
6. **Try this on your phone** opens the card with these same steps.
7. Turn Wi-Fi and mobile data off, close the app and reopen it from the icon: it still opens (offline).
8. Turn data back on. When a later phase ships, the title shows **Update ready → Restart**.
