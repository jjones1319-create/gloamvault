# STATUS — Gloamvault checkpoint

*Claude Code keeps this file current while it works (CLAUDE.md rule 6). A fresh chat resumes from here.*

## How to run

- `npm install` once (Node 24+, npm 11+), then `npm run dev` → http://localhost:5173/gloamvault/ (add `-- --host` to open it on the phone over Wi-Fi).
- `npm run verify` before every commit (typecheck · test · lint · build · check:build). `npm run shots` writes the screenshot set to `client/shots/` (read the PNGs). `npm run e2e` runs the Playwright smoke on the built app. `npm run icons` re-renders the PWA icons from `client/public/logo.svg`.
- `npm run sim -- --seed 17 --party warden,mender --ascii` plays one delve of the Cellars on the real content in the terminal (`--party warden:dwarf:Orrin`, `--zone 1`, `--policy cautious`, `--difficulty hard`, `--quiet`; `--fixture` for the Phase 2 test set). `npm run balance -- --seeds 100 --tag <tag>` writes `tools/balance/out/<date>-<tag>.json` and `docs/balance/<date>-<tag>.md` (eight recipes, fresh and levelled; ~75 s at 100 seeds).
- Content generators: `node tools/content/gen-class-<class>.ts` (six classes) and `node tools/content/gen-items.ts` rewrite their JSON from the tables; edit the tables, never the generated JSON.
- Live link: **https://jjones1319-create.github.io/gloamvault/** (deployed by GitHub Actions on every push to `main`; `gh run list` shows the status).

## Where we are

- **Segment:** 1 (Phases 1–4) — **in progress**, started 2026-10-26.
- **Phase:** 3 — Content pass 1 — **done 2026-10-27** (verify green; the second balance report written). **Phase 4 — the playable vertical slice — next.**
- **James's direction of 2026-10-27** (mid-Phase 3) is in: Final Fantasy-style levels, leaving by a floor's entrance or its end, a very difficult tower best climbed with a party of unlockable heroes, turn-based combat (D-082–D-085; `docs/13-DECISIONS.md` §A2). Phase 4 builds the screens for it.
- **Last commit:** see `git log` (the Phase 3 commit is `P3: content pass 1 …`).
- **Tools checked 2026-10-26:** Node 24.18.0 ✓ · npm 11.16.0 ✓ · git 2.51 ✓ · gh 2.102 signed in as `jjones1319-create` ✓ · Blender 5.2.2 LTS ✓ (needed from Segment 2) · Google Chrome ✓.

## Phase 3 task list (done)

1. [x] Linter rule 4 for a Tiers I–III pass (the Ultimate is the 46th skill — D-070); `secrets` in the dungeon schema with rule 33.
2. [x] Classes Warden, Blade, Ranger and the eight field skills; generators `tools/content/gen-class-*.ts`.
3. [x] Classes Shade, Arcanist, Mender.
4. [x] Six species, sixteen pets with 34 pet skills, twelve elite affixes, eight chests, eight contracts (two more wait as `.json.later` for Phase 7).
5. [x] 384 items F–C, 71 affixes, the Cellars set and loot table; generator `tools/content/gen-items.ts`.
6. [x] The Cellars: 14 monsters (Old Gnaw, Captain Vexa Marrow), 7 encounters, 10 templates, 8 curios, 6 traps, 3 secrets, 12 Pacts, 3 presets; the ten-floor dungeon waits as `dungeon.full.json.later`.
7. [x] The sim's persistent hooks and joints (D-071, D-086); 255 custom hooks written by four handler passes against `sim/src/skills/custom/README.md` (4 documented stubs; ≈ 20 delve-side ones documented for Phase 4); lint rules 22/26/11/2 corrected (D-072); `item.wearK` a number; `effect.itemId`; secrets, pet traits, gear and passive hooks read by the delve.
8. [x] `npm run balance` on the real content: the bugs it found fixed (D-077–D-081), James's difficulty brief turned into clear-rate targets and tuning (D-084); `docs/balance/2026-10-27-content-pass-1.md` (after) beside `…-content-pass-1-raw.md` (before).
9. [x] Final Fantasy-style levels (D-082), the entrance / floor-end exits and the floor checkpoint (D-083); tests `sim/test/levels.test.ts`.
10. [x] Docs: `03` rev. 3 (levels, party scaling, leaving), `06` (baseline, champions), `12` rev. 2 (Phase 4 and 7 scope from James's direction), `13` rev. 2 (§A2, D-070–D-086), `content/README.md`, `10` (sim module map), `README.md`, this file.

## Done

- 2026-10-26 — The design package (see `docs/`), `CLAUDE.md`, `README.md`, `PROMPT.md`, this file.
- 2026-10-26 — Phase 1: the installable title screen, the toolchain (verify · lint · shots · e2e · icons), tuning and statuses as content. Commit `bde2c59`.
- 2026-10-27 — Phase 2: the sim, 239 tests, the fixture content, `npm run sim`, `npm run balance`, the first balance report. Commit `cc14fbd`.
- 2026-10-27 — Phase 3: content pass 1 (≈ 800 records), 255 custom hooks, Final Fantasy-style levels, the exits, the second balance report.

## What the second balance report says

`docs/balance/2026-10-27-content-pass-1.md` (100 seeds × 8 recipes, the Cellars F1–3, Normal):

| Recipe | Cleared | Ordinary fight rounds |
|---|---|---|
| Solo Warden, fresh | 0% | 4.3 |
| Solo Warden, ground (L12, D gear) | 40% | 3.1 |
| Classic four, fresh | 83% (target 40–75) | 3.6 |
| Crypt-breakers, fresh | 45% | 3.5 |
| Glass cannons, fresh | 6% | 4.1 |
| The pair, fresh | 32% | 3.1 |
| Crypt-breakers / the pair, levelled (L5, E gear) | 91% / 67% | 2.7 |

Ordinary fights land at 3–6 rounds for every fresh recipe and solo (the Phase 3 "done when"). Still off target, for Phase 4/7: elites run ~5 rounds (6–8), hunters 10–16 (few samples), weapons wear 9–19% a delve (25–35), parties earn 1.4–1.8 R per cleared delve, and the classic four clears too often because the Arcanist and Mender out-damage the Ranger 2–3× at level 1.

## Next — Phase 4, the playable vertical slice (plan mode first; the task list goes here)

`12` Phase 4 plus James's direction (`12` rev. 2): the Preact screens (new hero, Emberfall with the Blacksmith, Skill Hall, Curio Merchant, Stables, Bank, Quest Board, Lantern Inn with the **party roster**, Waystone with the **floor checkpoint**), the delve map, the three.js grey-box room, the **turn-based** fight HUD (whose turn, the strip of 8, skills, Guard/Item/Row/Ultimate, Auto with the rule editor), results with the **XP bar and level-up line**, inventory, skills, pet, settings; save/load (SAVE_VERSION 1 with `battleXp`, migrations, export/import); deep links; `npm run shots` and `npm run e2e`; then `docs/feedback/SEGMENT-1-REVIEW.md`.

## Decisions logged this phase

- D-070 Tiers I–III and secrets · D-071 persistent hooks and joints · D-072 linter/schema corrections (Grand chest = 08 §10, wearK number, flat ladder lines, partial-dungeon bosses, pets of later families) · D-073 class readings · D-074 species/pets/affixes/chests/contracts readings · D-075 item readings · D-076 Cellars readings · D-077 status timing and DoTs · D-078 06's monster baseline (supersedes D-061), braziers, part breaks · D-079 gambit and scripted-player readings · D-080 a damage line in party scaling · D-081 the crew flees, champion bonuses once · D-082 Final Fantasy-style levels (**Accepted**, James) · D-083 leaving the dungeon (**Accepted**, James) · D-084 difficulty and party members (**Accepted** direction, James; numbers Proposed) · D-085 turn-based and 8 floors (**Accepted** / Proposed) · D-086 the hook passes' joints.

## Open for James (collected for the segment review)

- The consolidated list is `docs/13-DECISIONS.md` §D (Phase 3 adds a line) and `03` §12.4: the party-member unlock schedule, Gravehollow at 8 floors, battle XP shared or whole.
- Doc conflicts the content agents resolved by the owner rule, for a yes or a change: `04` §2 omitted the Blade's Great Axe (now added); `08` §1's class columns vs the class sheets; the Warren Alpha's size and the Weaver's Web duration in `06`; the Bruiser's F2 elite pool; F9 needing a merchant before F10 (rule 13 vs `07`); the Toll Road contract wanting a sub-family; the Drakeling and Frost Kit's third active (rule 28 vs `06` §9); the Draconid's Breath as an innate skill.

## Phone checklist (current phase)

Phase 3 changed nothing on the phone: the live app is still the Phase 1 title screen. The new content and the levels run on the PC:

1. In the project folder run `npm run sim -- --seed 17 --party warden,mender`. You should see each floor's rooms, the fights, and at the end both heroes' **level** (they reach about level 5 in one run).
2. Open `docs/balance/2026-10-27-content-pass-1.md`: the first table shows how often each party clears the Cellars; a fresh solo Warden never does, a ground one about 40% of the time.
3. Nothing to install or update on the phone until Phase 4.
