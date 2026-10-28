# STATUS — Gloamvault checkpoint

*Claude Code keeps this file current while it works (CLAUDE.md rule 6). A fresh chat resumes from here.*

## How to run

- `npm install` once (Node 24+, npm 11+), then `npm run dev` → http://localhost:5173/gloamvault/ (add `-- --host` to open it on the phone over Wi-Fi).
- `npm run verify` before every commit (typecheck · test · lint · build · check:build). `npm run shots` writes the screenshot set to `client/shots/` (read the PNGs). `npm run e2e` runs the Playwright smoke on the built app. Both serve the build on port 4173; when another project on this machine holds that port, set `GLOAMVAULT_PORT` (e.g. `GLOAMVAULT_PORT=4183 npm run e2e`). `npm run icons` re-renders the PWA icons from `client/public/logo.svg`. `node tools/shots/dev-shot.ts --port 5181 --hash "#…" --out shots-dev/x.png [--tap sel]` shoots one screen of a running `npx vite --port 5181`.
- `npm run sim -- --seed 17 --party warden,mender --ascii` plays one delve of the Cellars in the terminal. `npm run balance -- --seeds 100 --tag <tag> [--death mortal|sheltered|nightmare]` writes `tools/balance/out/<date>-<tag>.json` and `docs/balance/<date>-<tag>.md` (~25 s at 100 seeds).
- Deep links: `#delve=gravehollow-keep&floor=1&seed=17&party=warden,mender&auto=1` (`&death=nightmare`, `&end=1` plays the whole delve so the end card shows), `#town&demo=1`, `#town&place=waystone&demo=1`.
- Content generators: `node tools/content/gen-class-<class>.ts` (six classes) and `node tools/content/gen-items.ts` rewrite their JSON from the tables; edit the tables, never the generated JSON.
- Blender (from Phase 5): headless only — `& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P tools/blender/<script>.py -- <args>`; `tools/blender/README.md` holds the conventions.
- Live link: **https://jjones1319-create.github.io/gloamvault/** (deployed by GitHub Actions on every push to `main`; `gh run list` shows the status).

## Where we are

- **Segment:** 2 (Phases 5–8) — **in progress**, started 2026-10-27 when James pasted the Segment 2 prompt with his checkpoint 1 answers.
- **Checkpoint 1:** **done 2026-10-27.** James's answers are logged (`docs/13-DECISIONS.md` §A4, D-095–D-099) and built: **Nightmare**, the third death rule (the chosen hero leads every delve; their death ends the save; the Hall of Nightmares keeps a line); **battle XP split through the party and scaled by the level gap to the party's average** (×0.25 at 5 below, ×2 at 5 above); each level costs more (as built); every Proposed line of Segment 1 Accepted (C1); 107 open questions in the docs answered; the Nightmare difficulty preset renamed **Dread**. v0.4.1.
- **Phase:** 5 — Characters in Blender — **done 2026-10-28** (v0.5.0; verify green — 533 tests, lint ALL GOOD, app JS 469 KB gzipped of 600; 46 screenshots read incl. the 36-hero acceptance matrix; the e2e smoke passes). Next: Phase 6 — the dungeon in 3D and the monsters.
- **Last commit:** see `git log` (the checkpoint commit is `P4: checkpoint 1 …`).
- **Tools checked 2026-10-26:** Node 24.18.0 ✓ · npm 11.16.0 ✓ · git 2.51 ✓ · gh 2.102 signed in as `jjones1319-create` ✓ · Blender 5.2.2 LTS ✓ · Google Chrome ✓. The CC0 Human Base Meshes bundle is on this machine (`../ProjectAscend/art/ref/human-base-meshes/`, copied to `art/ref/` git-ignored); its stylized male and female bodies share one topology (12,502 vertices, 12,500 quads, UVs), so one landmark table fits the rig to both.

## Checkpoint 1 task list (done)

1. [x] §A4 with James's words; D-095 Nightmare, D-096 party-average XP, D-097 the level curve, D-098 the twelve answers + every Proposed line Accepted (C1), D-099 the docs' open questions.
2. [x] Docs: `03` rev. 5–6 (§2.2, §5.1 the level-gap table, §11, §12 Nightmare, §12.7 struck), every doc's Open questions struck with answers (two helpers), stale text fixed (`01`, `03`, `07`, `12`), `10` (save v2, the Hall key), `14` (a seventh species waits).
3. [x] Sim: `levelGapMultiplier` and `fightXpPool` (D-096); Nightmare in `delve.ts` (`isNightmare`, `deadLeader`, outcome `chosenDied`) and `town.ts` (`nightmareBlocker`, `lowerRulesFor`, `lowerDeathRule(profile, to)` in town only, the Hall record and the empty profile on an ended run); the policy treats Nightmare deaths as Mortal ones; `difficulty` `nightmare` → `dread` in content, schemas, lint and code.
4. [x] Client: save version 2 (+ migration and fixture tests), `save/hall.ts` (`gloamvault/hall`), the ended run erases the save and its backups after any write in flight; the title's three rules and the Hall; Settings lowers to either gentler rule; the Waystone's Nightmare block and warnings; the end card; `end=1` deep link.
5. [x] Tests: `sim/test/checkpoint1.test.ts` (9), save and Hall tests (5); verify green (492 tests); balance `docs/balance/2026-10-28-checkpoint1-mortal.md` and `…-nightmare.md` (a fresh four's chosen Warden dies in 34% of first trips under Nightmare; the XP change leaves clear rates within noise).

## Phase 5 task list (the plan) — characters in Blender

The lead builds the foundation and freezes its conventions in `tools/blender/README.md`; builders then run in parallel (species, clips, gear in three pairs of classes, the client), each owning its files and looking at its own renders; the lead finishes with the acceptance matrix, the docs and the commit.

1. [x] **Foundation (lead).** `tools/blender/README.md` (the shared conventions: units, axes, bone names and local axes, the region masks, morph names, material and tint scheme, sockets, file names, export settings, the review set); `lib/` ported from Ascend's shade scripts (`common.py`, `mesh.py`, `toon.py`, `rig.py`, `export.py`, `render.py`); the CC0 bundle in `art/ref/` (git-ignored) and `CREDITS.md`; `hero/build_body.py`: the **broad** frame (stylized male) and the **slight** frame (stylized female), decimated to budget, split into region meshes so gear can hide what it covers, the shared 65-bone rig fitted to each frame from landmark vertex sets, skinned; round-1 renders read and `art/LOG.md` started.
2. [x] **Species** (builder): six species as shape keys + bone scales + parts (Elf and Orc ears, tusks, Dwarf beard, Draconid horns, crest, muzzle, tail and claws, Halfling feet) + three face presets + three skin tones each, on both frames; the species' appearance data in `content/species/`; per-species renders; LOG rounds.
3. [x] **Clips** (builder): the 17 shared clips + `Breath` + `Roar` as pose tables on the rig (rotation tracks; hips height scaled at load), event frames in `clips.json`; pose sheet and joints renders; LOG.
4. [x] **Gear** (three builders, two classes each): Warden + Blade, Ranger + Shade, Arcanist + Mender — one mesh per slot, F and S tiers, fitted to both frames and every species key by Surface Deform transfer, body masks per slot; exported per class and frame; gear sheets; LOG.
5. [x] **Looks in the save:** `appearance { frame, skin, face }` on hero records (SAVE_VERSION 3, migration, fixture), the New hero screen's look step, the wayfarers' looks (schema + lint rule).
6. [x] **Client** (builder): the character assembler (frame + species morphs + bone scales + parts + gear + tints, one AnimationMixer per character), the **viewer** `#viewer=dwarf,warden,S` (turntable drag, minimum camera distance, clip buttons, F/S), real heroes in the delve room and the fight (clips cued from the fight log), loading, caching and disposal within `10` §4.
7. [x] **Acceptance (lead):** the 36 species × class combinations in Idle / Run / Attack_Heavy rendered in Blender and in the viewer by `npm run shots`, clipping fixed, `11` §9's bar, renders in `art/renders/`, LOG.
8. [x] Docs (`11` and `05` §5 as built, `10` client map, `13`), verify, the `P5` commit and deploy, the phone checklist.

**Phase 5 working notes (lead).** Built so far: `tools/blender/lib/` (common, toon, rig, fit, render, export), `hero/build_body.py` (two frames from the CC0 male/female bodies — one topology, decimated to 10.5k tris with eyes; the rig fitted by plane cuts on the full mesh; bone-heat weights; regions; eye colours; full-resolution normals; sockets), `hero/export_hero.py`, `hero/gear_lib.py` (gear = pushed body vertices + plane cuts with exact edge vertices + bound free geometry; `realize`, `export_class`), `inspect-glb.ts`, `tools/blender/README.md` (the contract), `art/LOG.md` round 1, `CREDITS.md` (the bundle). Exports so far: `client/public/models/hero/hero_broad.glb`, `hero_slight.glb` (455 KB each). Passes running (agents): species → `build_species.py`, `hero_species.blend`, morphs + parts + `manifest.json`; clips → `build_clips.py`, `hero_clips.glb`, `clips.json`; gear → `build_gear_<class>.py` ×6 classes in three passes; weapons → `build_weapons.py`, `weapons.glb`; client → `client/src/scene/characters/`, the viewer, real heroes in the room and fight, looks in the save (SAVE_VERSION 3). When they land: merge `art/log/*.md` into `art/LOG.md`, re-run the gear scripts on `hero_species.blend` if they ran before the species keys existed, run the exports, the acceptance matrix (task 7), verify, commit.

**Phase 5 result (2026-10-28).** Two body frames (broad 1.794 m, slight 1.613 m) on one 65-bone rig; the six species as shape keys + 30 parts + 18 face presets; six class armour sets (five pieces each, tiers F and S, all species keys carried); 46 weapons, shields and quivers; 20 clips (with `Guard_Shield`); the client assembles a hero into one skinned mesh (2 draw calls with its outline): the viewer (title → Character viewer, or a hero's **View in 3D**), the Look step at New hero (save version 3), real heroes in the delve and the fight (a side-on fight framing). Four-hero fight: 25 draw calls, ~80k triangles, 60 fps on desktop Chrome — the phone check is James's. Logs merged into `art/LOG.md`; curated review renders in `art/review/` (D-109); decisions D-100–D-109. Left for later rounds (in `art/LOG.md`): species variants of helmets and coats (Draconid hood-down, Orc wider mask, tail splits), cape bones, the Shade's F mask over a Dwarf beard, the Shade's dark F daggers, an Attack_Heavy for shield bearers and archers, the hand sockets' 15–20° tilt, the Warden/Blade gear files' default key weights (harmless: the client sets every weight).

## Phase 7 notes from checkpoint 1 (to do in Phase 7)

Monster techniques guaranteed by the 10th witnessed use (`09` §4; tuning + `insight.ts`) · a second starter kit (Warden spear, Blade greatsword: `08` §12, class JSON, New hero) · Breath of Life weight 1,000 at 28 Mana · arrows counted, Repair all refills the quiver, merchants stock arrows · corridor skills cost Stamina, no turn, no tick · the Tier IV–V limits in D-099 · a "No striker" hint at the Inn · at most 3 summons · the Vault's merchant before the throne stocks four Torches · arena tells as two-word hints · the class sheets' stale lines (a Blacksmith that sells gear, the Mender's Mana sums, the old technique sweet spot) · `08`'s Beast Tamer weapon rows (Phase 11).

**From the 8-floor docs pass (D-104, docs only so far):** floors F1 L1 · F2 L2 (merchant) · F3 L4 (Vexa) · F4 L5 (Waystone) · F5 L7 (merchant) · F6 L8 (Barrow Warden, new merchant) · F7 L11 (Waystone, Sister Naesa, merchant with 4 Torches, old F7–F9 merged) · F8 L13 (the Hollow King, fixed 4 rooms). The Vault has no stalking hunter (D-055: none on boss floors) — the Vault Leech comes from the Leech Jar curio (a fight; new custom handler) and the King's last phase. Content must match: rule 13 merchants on F2/F5/F6/F7, `hunterClock: null` on F3/F6/F7/F8; zones 1–3 · 4–6 · 7–8, bossIds Naesa then the King; `generator.minRooms` 4; Vault encounters band 7–7 plus a throne encounter for F8 (≤ 2 Specials); Hag's Snare difficulty 34; loot tables 1–3 · 4–6 · 7 · 8; merchant Torch stock from data, not the hard-coded 3 (`sim/src/explore.ts`); `BAND_FLOORS` (`sim/src/grades.ts`) for the new global bands (D 7–8, C 9–13 …); `levelRange` max 13; `dungeon.full.json.later` and `content/README.md` (line ~164) still say 10 floors. Checkpoint 2 questions added: 07 Q9–10 (the hunterless Vault, a second Crypts merchant).

## Done

- 2026-10-26 — The design package (see `docs/`), `CLAUDE.md`, `README.md`, `PROMPT.md`, this file.
- 2026-10-26 — Phase 1: the installable title screen, the toolchain (verify · lint · shots · e2e · icons), tuning and statuses as content. Commit `bde2c59`.
- 2026-10-27 — Phase 2: the sim, 239 tests, the fixture content, `npm run sim`, `npm run balance`, the first balance report. Commit `cc14fbd`.
- 2026-10-27 — Phase 3: content pass 1 (≈ 800 records), 255 custom hooks, Final Fantasy-style levels, the exits, the second balance report. Commit `f178620`.
- 2026-10-27 — Phase 4: the playable slice — the town and the save, the new-hero, hero, town, delve and fight screens, the 3D grey-box room; James's direction during Phase 4 (Mortal / Sheltered, raising the dead, the chosen hero and the Wayfarer Chest, legacies, the threat read); the Segment 1 review. Commit `bd42d55`, deployed.
- 2026-10-27 — Checkpoint 1: James's answers logged and built (Nightmare, party-average XP, Dread), every open question answered; v0.4.1. Commit `2e60fe9`.
- 2026-10-28 — Phase 5: the heroes in Blender and on screen (frames, rig, species, gear, weapons, clips, the assembler, the viewer, looks in the save); v0.5.0.

## Decisions logged this segment

- Phase 5: D-100 two body frames · D-101 the palette and one-draw-call heroes · D-102 the rig fitted by cuts, the sockets · D-103 gear built from the body, tiers F/S · D-104 Gravehollow at 8 floors in the docs (Phase 7 prep) · D-105 a hero's look in the save · D-106 how the client dresses a hero · D-107 fight clips · D-108 content-hashed model URLs · D-109 review renders curated.
- Checkpoint 1: D-095 Nightmare (**Accepted**, James) · D-096 battle XP split, scaled by the level gap to the party's average (**Accepted**, James) · D-097 each level costs more (**Accepted**, James) · D-098 the twelve answers; every Segment 1 Proposed line Accepted (C1) · D-099 the docs' open questions.

## Open for James (collected for the Segment 2 review)

- D-097: James wrote "It should take more exp to grow a level after each level so 2 to 3 is less xp than 1 to 2"; built as each level costing more (1→2 is the cheapest). Confirm.
- Nightmare's details (D-095): the chosen hero must lead every delve; the save's backups go too; the Hall keeps a line. A fresh party of four loses its chosen Warden in about a third of first trips under Nightmare.
- The Beast Tamer keeps whip and short spear (its sheet owns its weapons), not `08`'s wider list.

## Phone checklist (Phase 5 — the heroes)

Open **https://jjones1319-create.github.io/gloamvault/** or the installed app. If a small "Update ready" note appears on the title, tap it. The title should say **v0.5.0 · Phase 5**. The first time the heroes load, the game downloads about 6 MB of models (once; they are kept for offline play).

1. On the title, tap **Character viewer**. *A hero in armour turns on a stand.* Drag sideways to turn them; pinch to zoom; tap **Close-up**.
2. Tap through **Species** (Human, Dwarf, Elf, Orc, Halfling, Draconid) and **Class** (Warden, Blade, Ranger, Shade, Arcanist, Mender). *Each looks different: a Dwarf is short and wide with a beard, an Orc big and green with tusks, a Draconid has horns, a crest and a tail.*
3. Try **Body: Broad / Slight**, **Gear: Crude (F) / Fine (S) / Off**, the three **Face** choices, the **Skin** and **Hair** swatches.
4. Tap the **Clip** buttons (Idle, Walk, Run, the attacks, Cast, Shoot, Guard, Downed, Victory …). *The hero moves; nothing should go through the armour or the floor badly.*
5. Back on the title, start a **New game** (any death rule): the new-hero screen has a **Look** step after Class with a live 3D preview.
6. In Emberfall, tap a hero → **View in 3D**: *the viewer shows that hero as they look.* Back returns to the hero.
7. Go into the dungeon: *your heroes walk through the room in 3D* (monsters are still simple shapes until Phase 6). In a fight, *the party stands on the left, the enemies on the right, and the heroes swing, cast or shoot when they act.*
8. Settings → **Performance overlay** on, then a fight with four heroes: tell me the **fps** and **calls** numbers you see.
