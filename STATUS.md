# STATUS — Gloamvault checkpoint

*Claude Code keeps this file current while it works (CLAUDE.md rule 6). A fresh chat resumes from here.*

## How to run

- `npm install` once (Node 24+, npm 11+), then `npm run dev` → http://localhost:5173/gloamvault/ (add `-- --host` to open it on the phone over Wi-Fi).
- `npm run verify` before every commit (typecheck · test · lint · build · check:build). `npm run shots` writes the screenshot set to `client/shots/` (read the PNGs). `npm run e2e` runs the Playwright smoke on the built app. Both serve the build on port 4173; when another project on this machine holds that port, set `GLOAMVAULT_PORT` (e.g. `GLOAMVAULT_PORT=4183 npm run e2e`). `npm run icons` re-renders the PWA icons from `client/public/logo.svg`.
- `npm run sim -- --seed 17 --party warden,mender --ascii` plays one delve of the Cellars on the real content in the terminal (`--party warden:dwarf:Orrin`, `--zone 1`, `--policy cautious`, `--difficulty hard`, `--quiet`; `--fixture` for the Phase 2 test set). `npm run balance -- --seeds 100 --tag <tag>` writes `tools/balance/out/<date>-<tag>.json` and `docs/balance/<date>-<tag>.md` (eight recipes, fresh and levelled; ~75 s at 100 seeds).
- Content generators: `node tools/content/gen-class-<class>.ts` (six classes) and `node tools/content/gen-items.ts` rewrite their JSON from the tables; edit the tables, never the generated JSON.
- Live link: **https://jjones1319-create.github.io/gloamvault/** (deployed by GitHub Actions on every push to `main`; `gh run list` shows the status).

## Where we are

- **Segment:** 1 (Phases 1–4) — **complete 2026-10-27**: the review is `docs/feedback/SEGMENT-1-REVIEW.md`; Segment 2 waits for James's answers (checkpoint 1).
- **Phase:** 4 — the playable vertical slice — **done 2026-10-27** (v0.4.0; verify green: 478 tests, lint ALL GOOD, app JS 420 KB gzipped of 600; 27 screenshots read; the e2e smoke plays New game → Mortal → a hero → the first delve → home → a chest → reload).
- **James's direction of 2026-10-27** (mid-Phase 3) is in: Final Fantasy-style levels, leaving by a floor's entrance or its end, a very difficult tower best climbed with a party, turn-based combat (D-082–D-085; `docs/13-DECISIONS.md` §A2).
- **James's direction during Phase 4** (D-088–D-092; §A3) is in the sim and being put on screen: the **Mortal** death rule (the dead stay dead; Sheltered is the gentler choice at New game), raising the dead (a level-10 healer in the dungeon, the Ember Shrine in town, both for levels), one **chosen hero** plus **wayfarers** from the Wayfarer Chest as the only party members (18 named, D–A), **legacies** and the Memorial, the **threat** read (Easy / Even / Dangerous / Deadly) and the flee chance.
- **Last commit:** `bd42d55` P4: the playable slice (deployed 2026-10-27; the live site serves v0.4.0).
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
- 2026-10-27 — Phase 3: content pass 1 (≈ 800 records), 255 custom hooks, Final Fantasy-style levels, the exits, the second balance report. Commit `f178620`.
- 2026-10-27 — Phase 4: the playable slice — the town and the save, the new-hero, hero, town, delve and fight screens, the 3D grey-box room; James's direction during Phase 4 (Mortal / Sheltered, raising the dead, the chosen hero and the Wayfarer Chest, legacies, the threat read); the Phase 4 balance reports under both death rules; the Segment 1 review. Commit `bd42d55`, deployed (run 40579282736).

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

## Phase 4 task list (the plan) — the playable vertical slice

The lead builds the core first; four screen passes then run in parallel, each owning its own files and checking its screens with `tools/shots/dev-shot.ts` on its own dev-server port; the lead finishes with the shot set, the e2e smoke, the docs and the review.

1. [x] Core: `sim/src/town.ts` (the profile and every town action, pure, tested — the purse and the bank, the roster and party slots of D-084, the Waystone floors of D-083, start/settle a delve, Blacksmith, Skill Hall, Curio Merchant, Stables, Bank, Quest Board); `turnForecast` for the strip of 8; `client/src/save/profile.ts` (validate, repair against the loaded content, migrate, three rotating backups, export/import; tested); `client/src/game/session.ts` (signals, actions, delve stepping with the command log and replay-on-reload, deep links, a demo profile); the UI kit; routes and the app shell; the title's New game / Continue; `tools/shots/dev-shot.ts`; `client/src/scene/sceneBus.ts`.
2. [x] Pass A — New hero (species, class, three Tier I skills, the egg, six points, a name) and the hero screens (status with the XP bar, gear with eleven slots, wear pips and auto-equip best, skills in three school columns with the loadout and the AI-rule editor, pet).
3. [x] Pass B — Emberfall: the hub and its places (Waystone with the floor checkpoint, Blacksmith, Skill Hall, Curio Merchant with odds and pity, Stables, Bank, Quest Board, Lantern Inn with the roster and party slots), the Settings save section.
4. [x] Pass C — The delve: the three.js grey-box room from the template with capsule heroes and monsters, the floor map, light meter and floor clock, the room's actions (doors, traps, chests, gold, rest, merchant, curios, the stairs, Walk out / Teleport out), results and the way home.
5. [x] Pass D — The turn-based fight HUD: whose turn, the strip of 8, skills, Guard / Item / Row / Ultimate / Flee, target tap, pet stance, Auto with the rule editor, 1× / 2× / 3× playback of the fight log cued into the scene.
6. [x] James's direction during Phase 4 (D-088–D-092): the sim (`town.ts` death/Shrine/legacies/chosen hero, `wayfarers.ts`, `threat.ts`, the Mortal rule and the raise in `delve.ts`, `loseLevels`), 18 wayfarers + schema + lint rule 34, the save fields, the session, the title's death-rule choice, the new-hero selection rules, the fight HUD's threat chip, flee chance and Dead badge, 16 new sim tests; docs `03` rev. 4, `04` §7, `08` §10.2, `10` rev. 4, `12` rev. 3, `13` §A3 + D-088–D-094; the balance runner's `--death` flag and §1b (reports `2026-10-27-phase4-sheltered.md` / `-mortal.md`).
7. [x] Screen passes, round 2: Pass B — the Ember Shrine, the Inn and hub without slot unlocks, the Wayfarer Chest at the Curio, Waystone threat chips, Settings → lower the death rule, kit fixes; Pass C — the dead under Mortal, the raise action, threat chips on the map and the stairs, the over card's losses, dev-shot timeouts.
8. [x] Lead: the shot set (every screen by deep link), `npm run e2e` (new hero → first delve → town → chest), the phone-size pass, the performance overlay check, docs (`10` client map as built, `03` §13 as built, D-087), verify, the `P4` commit and deploy, the phone checklist, `docs/feedback/SEGMENT-1-REVIEW.md`.

## Decisions logged this phase

- D-070 Tiers I–III and secrets · D-071 persistent hooks and joints · D-072 linter/schema corrections (Grand chest = 08 §10, wearK number, flat ladder lines, partial-dungeon bosses, pets of later families) · D-073 class readings · D-074 species/pets/affixes/chests/contracts readings · D-075 item readings · D-076 Cellars readings · D-077 status timing and DoTs · D-078 06's monster baseline (supersedes D-061), braziers, part breaks · D-079 gambit and scripted-player readings · D-080 a damage line in party scaling · D-081 the crew flees, champion bonuses once · D-082 Final Fantasy-style levels (**Accepted**, James) · D-083 leaving the dungeon (**Accepted**, James) · D-084 difficulty and party members (**Accepted** direction, James; numbers Proposed) · D-085 turn-based and 8 floors (**Accepted** / Proposed) · D-086 the hook passes' joints · D-087 the town and the save as built · D-088 death is permanent: Mortal / Sheltered (**Accepted** direction, James) · D-089 raising the dead (**Accepted**, James; numbers Proposed) · D-090 the chosen hero and legacies (**Accepted**, James) · D-091 party members from the Wayfarer Chest, superseding D-084's unlocks (**Accepted**, James) · D-092 the threat read and fleeing (**Accepted**, James) · D-093 sim fixes found in Phase 4 · D-094 the screens as built.

## Open for James (collected for the segment review)

- The consolidated list is `docs/13-DECISIONS.md` §D (Phase 3 adds a line) and `03` §12.4: the party-member unlock schedule, Gravehollow at 8 floors, battle XP shared or whole.
- Doc conflicts the content agents resolved by the owner rule, for a yes or a change: `04` §2 omitted the Blade's Great Axe (now added); `08` §1's class columns vs the class sheets; the Warren Alpha's size and the Weaver's Web duration in `06`; the Bruiser's F2 elite pool; F9 needing a merchant before F10 (rule 13 vs `07`); the Toll Road contract wanting a sub-family; the Drakeling and Frost Kit's third active (rule 28 vs `06` §9); the Draconid's Breath as an innate skill.

## Phone checklist (Phase 4 — the playable slice)

Open **https://jjones1319-create.github.io/gloamvault/** or the installed app. If a small "Update ready" note appears on the title, tap it.

1. The title says **Phase 4** at the bottom and offers **New game**. Tap it: a box asks **How should death work?** Tap **Mortal** (heroes who die stay dead).
2. Make your hero: tap a species, **Next**, a class, **Next** (three skills are already picked), **Next**, an egg, **Next**, check the points and the name, **Next**, then **Create hero**. You should land in **Emberfall at dusk** with nine places in a 3 × 3 grid.
3. Tap **Waystone**. Floor 1 shows a threat chip (Easy or Even). Tap **Enter**. You should see a 3D room with your hero and pet as simple shapes, a light meter and a floor clock at the top left, and a small map at the top right.
4. Tap a room next to you on the small map to walk there. When a fight starts, the strip at the top shows who acts next; when it says **Your turn**, tap a skill, then tap an enemy. Try **2×**, then **Auto**.
5. In an easy fight, tap **Flee** once: the box shows your chance. Close it with **Stay and fight**.
6. Leave by walking back to the room you started in (**Walk out to town**) or by reaching the stairs (**Teleport out to town**). Tap **Back to Emberfall**.
7. The hub shows what happened on the delve. Tap **Blacksmith** → **Repair all** and watch the wear pips refill.
8. Tap **Curio Merchant** → the **Wayfarer Chest**'s **Odds**: you should see who could join you and the chance for each grade. Buy one when you have the gold (it costs more than a gear chest).
9. Tap **Lantern Inn**: your roster (up to 12), who goes in the party (up to 4), and the badges Chosen / Wayfarer.
10. Tap **Ember Shrine**: if a hero died and was carried home, **Raise** costs gold and two levels; **Lay to rest** passes half their experience to another hero. The Memorial lists the lost.
11. Tap a hero's name in the hub: **Status** (the level bar), **Gear** (tap **Auto-equip**), **Skills** (the three columns and the AI rule), **Pet**.
12. Go back into the dungeon and push to a floor whose chip says **Dangerous** or **Deadly**: the Waystone and the stairs warn that heroes who die there stay dead. If your only hero dies, the town stays yours and **Continue** offers **choose a new hero**, who gets part of the old hero's experience.
13. **Settings → Save**: **Download** a save file. The death rule line shows Mortal; **Lower to Sheltered** is there if Mortal is too harsh (it cannot be undone).
14. Close the app completely and open it again: **Continue** shows your heroes and "Mortal", and you are back where you were (a delve in progress resumes).
