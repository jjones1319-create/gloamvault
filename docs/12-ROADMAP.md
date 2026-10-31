# 12 — Roadmap: twelve phases in three segments

*Last updated 2026-10-29 · rev. 7 (checkpoint 2: Segment 3 becomes the Unity rebuild in small phases with a stop after each — D-135–D-140; the old Phases 9–12 kept as 25+) · rev. 6 (Phase 6 as built: its done-when follows D-113, kits with baked AO and effects in code — D-110, D-112) · rev. 5 (Phase 7 prep: Phase 7 builds Gravehollow from `07` §2.3's 8-floor table — D-104) · rev. 4 (checkpoint 1: open questions answered by delegation; Phase 11's hired companions become wayfarers and the Nightmare preset is renamed Dread — D-091, D-095, D-099) · rev. 3 (Claude: James's direction during Phase 4 — death, raising, the chosen hero and wayfarers, legacies, threat — added to Phases 4 and 7, D-088–D-092) · rev. 2 (Claude: James's direction of 2026-10-27 added to Phases 4 and 7 — D-082–D-085) · rev. 1 (Claude). James asked for the build to run in **three segments**, each a third of the phases, with all feedback gathered at the end of each segment. `PROMPT.md` holds the prompts that start each segment; `STATUS.md` at the repo root is the checkpoint Claude Code keeps while it works.*

## 0. How a segment runs

*From Phase 9 (D-137): one small phase at a time — plan mode → build with tests → verify → install on the phone over USB and read its numbers → docs and `STATUS.md` → commit `P<n>: …` and push → the phone checklist → **stop** until James says go. The steps below are how Segments 1–2 ran.*

1. James pastes the segment's prompt from `PROMPT.md` into Claude Code (VS Code, this folder open).
2. Claude Code works through the segment's four phases **autonomously**: plan mode for each phase's task list → build in small steps with tests → `npm run verify` green → update `STATUS.md` and the docs → commit `P<n>: <summary>` and push (the site redeploys) → next phase. It never stops to ask inside a segment: when the docs are silent it chooses the reading closest to the pillars, implements it, and logs it in `13-DECISIONS.md` as **Proposed** with the quote (CLAUDE.md §How this folder works). It stops only for the three things James must do himself (first GitHub push approval, the Cloudflare account in Phase 9, a payment of any kind — there is none planned).
3. At the end of the segment it writes `docs/feedback/SEGMENT-<n>-REVIEW.md` from the template: what was built, screenshots, the **"Try this on your phone" checklist** (10–15 minutes), the **questions for James** (every open question answered by a Proposed decision during the segment, plus the design questions the docs flag for him), and what the next segment will do. Then it **stops**.
4. James plays, answers in chat (or by editing the review file). Claude Code logs every answer (Accepted / Superseded in `13-DECISIONS.md`, the docs updated), fixes what James flagged, and only then James pastes the next segment's prompt.

If a Claude Code session ends mid-segment, James pastes the **Continue** prompt; `STATUS.md` says where it was.

## 1. Segment 1 — the game exists (Phases 1–4): *play a real delve on your phone, with placeholder art*

**Goal:** the rules are code, the content is data, and a solo player can make a hero, delve Gravehollow's Cellars, fight on the timeline, come back to Emberfall, repair, learn a skill, open a chest — on the phone, from the GitHub Pages link. Art is boxes and capsules with the right colours.

### Phase 1 — Repo, skeleton, the link on the phone
- Create the public repo `gloamvault` (MIT), Vite + TypeScript + Preact + three.js skeleton, `vite-plugin-pwa`, landscape manifest, GitHub Actions deploy to Pages, `npm run verify` (typecheck · test · lint · build · check:build).
- `content/` with the seventeen schemas (and any the content needs, D-020) and the linter (`tools/lint`, ajv strict + the cross-file rules in `content/README.md`); `content/tuning.json` holding every number from `03-GAME-DESIGN.md` §2–§12.
- Title screen with version; a "Try this on your phone" card; Settings with the performance overlay toggle.
- **Done when:** the link opens on the S25 Ultra, installs, shows the title full-screen in landscape, and `verify` is green in CI.

### Phase 2 — The rulebook as code (the sim)
- `sim/`: seeded RNG, attributes → derived stats (§2.2), the speed timeline with weights and jitter (§3.1), rows and reach, damage and hit formulas, the status set with its tick rules, the skill effect-DSL interpreter, items (grades, affixes, +N, durability bands and wear, item XP and affinities, promotion, salvage), loot and chests with pity, exploration (floor generator from the grammar in `07` §2, light, Detection/traps/secrets/scouting, ambush, the floor clock and hunter, curios), pets with stances, party and death rules (§12), XP by use with the gate, D-curve and per-delve budgets (§5), Insight rolls (§7.5), the field skills.
- `legalActions / step / runAuto / replay / hashState`; `policies.ts` (scripted players: textbook, cautious, greedy, random).
- Tests: every formula; the reference tables in the rulebook become test cases; determinism (same seed + log → same hash); the generator's guarantees (`07` §8).
- `tools/balance`: batch runner over seeds × parties × floors → JSON + `docs/balance/<date>-first-pass.md` with judgement lines.
- **Done when:** `npm test` and `npm run balance` run green and the first balance report exists, run on a **fixture content set** — one class, one species, three Cellars monsters and one floor, taken from `content/examples/` and extended as test fixtures (not shipped content; Phase 3 re-runs the report on the real content) — with the sim's silent-line decisions logged as Proposed in `13-DECISIONS.md`.

### Phase 3 — Content pass 1
- From the docs into JSON: the six classes (Warden, Blade, Ranger, Shade, Arcanist, Mender) with Tiers I–III (27 skills each) and their Ultimates; the six species; the eight field skills; the Cellars zone of Gravehollow (floors 1–3: 12 monsters, Old Gnaw, Captain Vexa Marrow, the zone's encounter tables, 8 curios, 6 traps, 3 secret types, templates); items F–C across every slot and family, the starter kits, the affix pool, consumables, the Cellars loot tables; the four chest types; the sixteen pet species' data (three creation eggs playable); the Cellars' contracts.
- `npm run lint` green; `npm run balance` re-run on the real content (replacing Phase 2's fixture set); a second balance report with the tuning changes made (numbers in `tuning.json` and content, never formulas, unless logged).
- **Done when:** lint and balance are green and the report's judgement lines say the Cellars fights land at 3–6 rounds for the five party recipes in `04-CLASSES.md` and for solo.

### Phase 4 — The playable vertical slice (placeholder 3D)
- Screens (Preact): New hero (species cards with pros/cons chips, class cards, three Tier I picks, egg choice, 6 free points) · Emberfall hub with the Blacksmith (Repair all, +N, promotion, salvage), Skill Hall, Curio Merchant (Odds button, pity counters), Stables (hatch, stance), Bank, Quest Board (3 contracts), the Lantern Inn (rest, save, backup), Waystone (Gravehollow → the Cellars) · the delve map (rooms, doors, light meter, floor clock, scout reveals) · the room scene (three.js: a grey-box Cellars template, capsule heroes and monsters in the right colours and sizes, fixed camera) · the fight HUD (timeline strip of 8, four skill buttons + Guard/Item/Row/Ultimate, target tap, pet stance, 2×/3× speed, Auto with the AI-rule editor) · loot and results screens (what grew, wear, gold) · inventory and equipment (eleven slots with wear pips, auto-equip best) · skills (three school columns) · pet · settings.
- **James's direction of 2026-10-27** (D-082–D-085): an **XP bar and a level-up line** on the results screen and the hero card (Final Fantasy-style levels); a **party of up to four heroes for one player**, with the roster at the Lantern Inn and members unlocking as the tower is cleared (D-084's schedule); the fight HUD says whose **turn** it is and waits for the choice (turn-based, D-085); **Walk out** in a floor's entrance and **Teleport out** at a floor's end, and the Waystone offers **the floor below the deepest one finished** (D-083).
- **James's direction during Phase 4** (D-088–D-092): New game asks for the **death rule** (Mortal: the dead stay dead; Sheltered: the Phase 3 rules); a **powerful healer** (a revive skill at level 10) can raise the dead in the dungeon and the **Ember Shrine** can in town, both for levels; the player makes one **chosen hero** and every other party member comes from the **Wayfarer Chest** (18 named wayfarers, D–A), which supersedes D-084's slot unlocks; a hero lost for good leaves a **legacy** of half their battle XP and a line on the **Memorial**; a **threat** chip (Easy / Even / Dangerous / Deadly) on fights, scouted rooms, the Waystone and the stairs; the **flee chance** on the Flee button.
- Save/load with migrations and export/import; deep links (`#delve=gravehollow&zone=1&seed=17&auto=1`); `npm run shots` and `npm run e2e`.
- **Done when:** the whole loop in `03` §13 (the first thirty minutes) works on the phone, screenshots are in `client/shots/`, and `SEGMENT-1-REVIEW.md` is written.

**Feedback checkpoint 1.** James plays the Cellars. Questions he will be asked (at least): is the timeline readable; does speed *feel* like more turns; are fights the right length; is light/ambush understandable; does repair/upgrade feel like care, not chores; which open questions in `03` §2–§8 he wants to settle; the names (game, town, dungeon, classes).

## 2. Segment 2 — the game is beautiful and whole (Phases 5–8): *all of Gravehollow, real characters, pets, chests, skills*

### Phase 5 — Characters in Blender
- `tools/blender/lib` (rig, mesh, toon, export, render — ported from Ascend's shade scripts), `hero/build_body.py` with the six species from the CC0 base meshes (shape keys, bone scales, parts, three skin tones, three face presets each), the shared clip set (17 + species specials), the six class gear sets as per-slot meshes with F/S variants, export per slot, `clips.json`.
- The client's character assembler (body + species keys + gear slots + tints), the **character viewer** screen (turntable, min camera distance), the fight scene uses real heroes.
- Review loop every round (`11` §8); `art/LOG.md`.
- **Done when:** every species × class combination renders in the viewer without clipping in Idle/Run/Attack_Heavy, the acceptance bar in `11` §9 passes, and the renders are in `art/renders/`.

### Phase 6 — Dungeon 3D and monsters
- The three Gravehollow kits and ~30 room templates (built from JSON by script), lightmaps baked, torches, fog, cameras per template; props instanced.
- The 14 monster base meshes with their variants (35 monsters, 3 hunters, 4 bosses incl. the Hollow King's throne room), each with its six clips; hit/mark/heal VFX flipbooks; the Ultimate flourishes.
- Performance pass against `10` §4 on the phone (overlay numbers in the log; soak test 30 min).
- **Done when:** a delve through all three zones renders at a sustained 60 fps (or 30 in battery mode) on the S25 Ultra with every monster present; screenshots in `client/shots/`. *(D-113: the three-zone delve moved to Phase 7, which writes the Crypts and Vault floors; Phase 6 is done when every template renders from its own camera with its monsters, every monster stands in a lineup, the Cellars delve and its fights run with the real models inside `10` §4's budgets, and a 30-minute soak holds 60 fps. As built 2026-10-28: rooms are kit pieces with ambient occlusion baked into the vertex colours rather than lightmaps — D-110 — and the effects are generated in code rather than flipbooks — D-112.)*

### Phase 7 — Gravehollow complete, systems complete
- **Gravehollow has 8 floors** (D-085, accepted at checkpoint 1 — D-098): Cellars F1–3, Crypts F4–6, the Drowned Vault F7–8 with Sister Naesa on F7 and the Hollow King on F8. A **class-damage pass** (the Arcanist and Mender out-damage the Ranger 2–3× at level 1, `docs/balance/2026-10-27-content-pass-1.md` §7) goes with Tiers IV–V.
- Floors 4–8 from `07` §2.3's 8-floor table (D-104: band levels L5·7·8 for the Crypts, L11 and L13 for the Vault; merchants on F5, F6 and F7, the F7 raft always stocking four Torches; no hunter clock on the Vault's two boss floors, the Vault Leech met at the Leech Jar and in the throne room): the Crypts and the Drowned Vault content, the Barrow Warden (F6), Sister Naesa (F7), the Hollow King (F8; 3 phases, light mechanic, returning hunters), the arena tells' two-word hints (D-099), Waystones on F1, F4 and F7, elite affixes scaling 1→3, the Pacts menu (Normal/Hard/Dread + 12 Pacts).
- Skills Tiers IV–V designed into JSON (V unobtainable until Segment 3's endgame), Insights with pity, monster techniques, Tomes; weapon XP, affinities and Awakening; promotion through every material rung available in Gravehollow; items B–A, sets, named uniques; the pets' actives and traits growing by use; chests Grand tier, Divine Shards; daily/weekly contracts live.
- From James's Phase 4 direction (D-088–D-092): the Mender's **Rebirth** (IV) and **Miracle** (V) raise the dead in a fight; the **Grand Wayfarer Chest** and S-grade wayfarers for deeper bands; the threat curve across the full tower (8 floors, D-098) so "too far" stays deadly floor by floor; the runner's scripted players read the threat (a careful player turns back from Deadly floors) and the report judges deaths per delve once James sets targets.
- Balance pass: the runner across all eight floors and party sizes 1–4, under the three death rules (Sheltered, Mortal, Nightmare — D-095); `docs/balance/<date>-gravehollow.md`.
- **Done when:** a solo hero and a 4-hero (one phone, Local transport) party can clear floors 1–8 on Normal, a delve through all three zones renders at a sustained 60 fps with every monster present (moved from Phase 6 — D-113), with the runner's judgement lines inside targets, and every content kind has a lint rule.

### Phase 8 — Polish and juice
- Audio: port Wildsong's engine; original music for Emberfall and the three zones (musical-words briefs in `07`), fight stingers, UI sounds; haptics on Android.
- Onboarding (the fixed 3-room tutorial floor), tooltips for every stat ("Speed 120: you act 1.2× as often"), the status screen's growth lines, a codex (monsters seen, materials), accessibility (text size, colour-blind safe palettes, reduce motion), backup reminders, update toast rules.
- Performance and memory polish, asset loading (room kits unloaded on transition), app icon and splash.
- **Done when:** the e2e suite, the balance report and the phone checklist all pass; `SEGMENT-2-REVIEW.md` is written.

**Feedback checkpoint 2.** James plays all of Gravehollow with real art. Questions: do the characters look good enough or should heads be commissioned; which classes feel best/worst; is durability/repair a chore; Insight rate; chest cadence; how the Nightmare rule and the party-average XP (D-095, D-096) feel. (Segment 3 builds co-op first — decided at checkpoint 1, D-099.)

## 3. Segment 3 — Gloamvault in Unity, in small phases (from Phase 9; D-135–D-140)

*Checkpoint 2 (James, 2026-10-29, `13` §A5): the game is rebuilt as a Unity app with free-roam exploration — a joystick, much larger floors, random encounters while walking, walk up and press A — in **small phases**. A phase is about one session's work; it ends with something new on James's phone (installed over USB), a commit `P<n>: …`, and a 2–3 item phone checklist in `STATUS.md`; then Claude Code **stops** until James says go (D-137). Each phase starts in plan mode. Review files (`docs/feedback/`) at Phases 14, 20 and 25. The web version stays live, frozen at v0.8.0, until the Unity version has all of Gravehollow (D-150). **Floor 1 first** (James, 2026-10-30): Phases 13–25 make Gravehollow's first floor a complete large level, adjusted from James's play, before the other floors (D-144–D-154; Phase 18, the skill trees, was added on 2026-10-30, D-153). The old Segment 3 (co-op, two dungeons, the Beast Tamer, Wildsong pets, release) follows as Phases 26+, re-planned in small phases.*

| Phase | Builds | Done when (on the phone) |
|---|---|---|
| **9 · Unity on your phone** | the docs re-planned; Unity 6.3 LTS + Android support installed; `unity/` (URP, UI Toolkit, Input System, landscape, IL2CPP ARM64, Vulkan, the release key); `tools/unity/` wrappers and `npm run unity:*`; a title screen and the speed overlay that logs to the phone log | the app opens landscape on the S25 Ultra and Claude has read its frame times and temperature over USB |
| **10 · The rules inside Unity** | `sim/src/bridge.ts`, the sim and content bundles, Jint in Unity, an EditMode test that plays seeded delves and matches Node's hashes; a *rules check* screen on the phone | seeded delves on the phone give the same hashes as Node, a step's p95 is under 30 ms and start-up under 3 s — or the fallback is chosen and logged (D-139) — **done 2026-10-30**: all five golden delves the same hashes on the phone, start-up 0.6 s, a hero's turn 3–9 ms (p95 8–32 ms over two runs; a whole fight in one step 187–236 ms); Jint kept (D-157) |
| **11 · Rooms** | FBX exports from the Blender kit scripts; the URP toon and outline shaders; a room built from a template; torches with real light and shadow; `unity:shots` | Cellars, Crypts and Vault rooms render on the phone; the shots are read — **done 2026-10-30**: the four kits as FBX, the toon shader in URP with real torch shadows, the thirty templates in a Rooms viewer; On James's S25 Edge (2026-10-30, v0 (D-158) |
| **12 · Heroes and monsters** | FBX hero, gear, weapon, clip and monster exports; the character assembler (species, face, parts, gear, tints, bone scales, hidden body faces); monsters from bases and variants; the viewer | every species × class and every monster animates in the viewer on the phone — **done 2026-10-31**: the 32 models converted from the GLBs, all 36 heroes and 52 monster entries build, the Characters viewer; On James's S25 Edge (2026-10-31, v0 (D-160) |
| **13 · Walking** | the on-screen joystick and A button, the follow camera — third person, three distances cycled by a button (D-159) — collision with walls and props; **only the hero you control is shown** — the party walks with you unseen and appears in fights (D-144); walk and run clips; doors that open with A | James walks his hero around a room and opens a door — **built 2026-10-31**, PC-checked (tests and shots); on the phone at the block's end (D-161, D-162) |
| **14 · The test level** | a huge seamless test level (5–10× today's floor: caves, tunnels, halls — D-149), areas loaded ahead and released behind, unseen areas skipped, a self-playing soak | a 10-minute soak measured over USB at 60 and at 120 fps (D-156); `10` §4's budgets rewritten from the numbers; level size and quality settings chosen; **review file** |
| **15 · Floor 1: the place** | Gravehollow's first floor as one large explorable level (cellars, caves, tunnels) from the kits, laid out by hand as data (D-150); **the map that fills in as you explore**, dark until then (D-149); doors, levers that open passages, secret passages (D-146); the entrance, the way down and one or two side exits found from inside, and the explored map kept between delves (D-151) | James explores Floor 1 and the map fills in |
| **16 · Climb, crawl, jump** | context actions at marked spots — crawl under, squeeze through, jump gaps, climb ledges and ladders (D-146): the Blender clips, the prompts, the camera | James crawls, jumps and climbs through Floor 1 |
| **17 · Floor 1: the rules** | (sim) the walked floor's rules in `03` §4 and `07`: random encounters every 45–90 s of walking, more as the light falls, a grace after each fight (D-149); Hushsmoke and Callsmoke (D-142, D-148); the monsters' level band and toughness (D-147); press-A chests, curios, traps, merchant and stairs as commands; the light and the hunter on a walked floor; rewards re-tuned for many more fights; levels slower and grinding paying less and less (D-152); the balance runner | James walks Floor 1: battles start at random, chests open with A; the balance report reads well |
| **18 · Skill trees** | (sim and a screen) skill points — 3 at creation, +1 per level — the tier costs, unlocking and the Hall's reset and dearer sale (D-153); every class's tree on a tree screen; the Arcanist re-cut into Fire · Frost · Storm · Summoning with about six one-attack summons (D-154): the sheet, the content, the hooks, the tests and the balance runner | James sees each class's tree and spends points on a test hero on the phone; the balance report reads well |
| **19 · The fight, staged** | the fight starts where you stand: the party appears, rows, animations and effects cued from the bridge's fight events; a summon's strike (its creature from the Blender scripts, D-154) | a fight plays out on the phone (on auto) |
| **20 · The fight HUD** | turn strip, skills and Ultimate, targets, cards, auto and speed, items, flee | James fights Floor 1's monsters by hand; **review file** |
| **21 · The delve HUD** | light, floor clock, the map screen, rest, merchant, curio choices, results and end cards | James plays Floor 1 from the entry to the stairs |
| **22 · Saves, title, new hero** | save files (versions, migrations, validation, rotating backups), **a closed app continues its delve where it stopped** and the explored map is kept (D-151), **import of the web version's save file**, the title, the death rules, the Hall, New hero with the 3D look step | James's web heroes are in the Unity app |
| **23 · Town 1** | Emberfall's hub, the Waystone, Inn, Bank, Stables, Shrine, Quest Board | those places work on the phone |
| **24 · Town 2** | the Blacksmith, the Curio Merchant's chests, the Skill Hall (its dearer sale and the tree reset, D-153), the hero sheet | the town is complete |
| **25 · Sound, and Floor 1 adjusted** | the web engine's music, beds and effects rendered to audio files; the music director; the changes from James's play of Floor 1 | Floor 1 and the town, with sound, as James wants them; **review file** |
| **26+** | **Gravehollow floor by floor** — Floors 2–8 as large levels (the Crypts as huge catacombs) with the four boss arenas, the tutorial, tips, codex and settings — adjusted as James plays; **the Unity version replaces the web one when all of Gravehollow is in** (D-150); upgrade passes as Phase 14's numbers allow (lighting, post-processing, more detailed characters and monsters); then, re-planned in small phases: **co-op** (D-145: each player explores on their own and joins the others' battles by choice; its networking re-decided then — the web plan's Trystero and Cloudflare relay do not carry over), **the Fungal Deep and Emberforge**, **the Beast Tamer, pets depth, Wildsong Ranch import** (a share code), **endgame**, **release and the Play Store** | as each is planned |

**Feedback.** At Phases 14, 20 and 25, Claude writes a short review file from the template; James plays and answers. Between them, each phase's phone checklist is the feedback.

### The old Segment 3 plan (Phases 9–12, as written at checkpoint 1 — superseded by D-135–D-137)

These are kept for the content they list; they become Phases 26+ above.

#### Old Phase 9 — Co-op
- `client/src/net/`: Transport interface; host sequencing, intents vs commands, desync hashes, snapshot + log-tail join, reconnect with tokens, host migration; the Lobby at the Lantern Inn (create → invite code; join → code); **Trystero** WebRTC transport; the **Cloudflare Worker relay** (James creates the free account; Claude Code deploys with `wrangler`); grouped decision windows, 20 s timers, AI fallback, door proposals, loot pick order, drop-in at rooms, revive budgets per floor in co-op.
- Tests: two browser contexts in Playwright playing a delve through both transports; a 4-phone checklist for James and three friends.
- **Done when:** two phones on different networks complete a delve together through the relay, and four browser contexts complete one in CI through Local.

#### Old Phase 10 — The Fungal Deep and Emberforge
- Dungeon 2 (L12–26) and Dungeon 3 (L24–38) from `07` §3–§4 and `06` §4–§5: kits, templates, 6–8 monsters per zone built from the one-liners into full entries first (docs), hunters, zone bosses, final bosses (the Sporemother, the Forge-Tyrant), the signature mechanics (spore load, heat), materials C–A/S rungs, items S, Grand chests at those bands, contracts, the overworld travel and unlock rules.
- Balance pass per dungeon.
- **Done when:** both dungeons clear on Normal solo and with four (Local) within targets; `docs/balance/<date>-deep-and-forge.md`.

#### Old Phase 11 — Beast Tamer, pets depth, Wildsong Ranch import, endgame
- The Beast Tamer class (gear set, 45 skills, summons as timeline actors) and its wayfarers, pet bond stars, the **Ranch Shrine** at the Stables: import a Wildsong Ranch share code → a pet of grade ≤ A tagged *Ranch-raised* (`14-IDEAS.md` has the mapping). No hired companions: wayfarers from the Wayfarer Chest fill that role for solo (D-091).
- Endgame: Tier V skills, SS items and the eleven God items, Divine Shard forging, Hard/Dread rewards, titles and the codex completion rewards; Frostmarch Citadel **designed in full** in the docs (built after launch).
- **Done when:** a Beast Tamer with a Ranch-raised pet clears Gravehollow; a God item can be forged from ten shards; lint has rules for every new kind.

#### Old Phase 12 — Release
- README for players (install, backup, co-op invite codes), `CREDITS.md`, the privacy note, the odds screen final copy, store-quality icon/screenshots in the repo, a settings "Reset" and "Export everything".
- Final balance report, the full e2e + shots set, a last performance soak, `v1.0.0` tag and GitHub Release notes.
- **Done when:** `SEGMENT-3-REVIEW.md` is written with the launch checklist and the post-launch backlog (`14-IDEAS.md`).

**Feedback checkpoint 3 (launch).** James and friends play. Questions: what to build next (Frostmarch, more classes, Wildsong two-way sync, Play Store).

## 4. Milestones and what James sees

| After | On the phone |
|---|---|
| P1 | the title screen, installed |
| P4 | a full Cellars delve with boxes and capsules; town; chests |
| P5 | his hero, in 3D, in the viewer, in every class and species |
| P6 | the Cellars, Crypts and Vault in 3D with every monster |
| P7 | the Hollow King beaten; a +N Skysteel-promoted sword (a boss's A-grade Skysteel sword raised +N with Gravehollow's Honing Oil — D-120); a Tier IV Insight |
| P8 | music, tutorial, polish — "the game" |
| P9 | the Unity app, installed over USB, with the speed overlay |
| P10 | the rules running inside the Unity app |
| P11–P12 | the rooms, heroes and monsters in Unity |
| P13–P14 | walking with a joystick; a huge test level |
| P15–P17 | Floor 1 walked: the map that fills in, climbing and crawling, random battles and the smokes |
| P18 | skill trees, and the Arcanist's summons |
| P19–P21 | a whole Floor 1 delve: the fight staged, the fight and delve HUDs |
| P22–P25 | saves (with the web heroes), title, town, sound, Floor 1 adjusted |
| P26+ | Floors 2–8 (then the Unity version replaces the web one), upgrades, co-op, two new dungeons, the Beast Tamer and Wildsong pets, release and the Play Store |

## 5. Risks to the schedule

- **The Unity rebuild** (D-135) is many small phases — Floor 1 complete by Phase 25, then Gravehollow floor by floor — before it replaces the web version; the web version stays playable throughout and every phase shows something new. **Jint on the phone** (D-139) is unproven — Phase 10 tests it before anything depends on it. Unity builds are slower than the web build (minutes per APK); phases are sized for it.

- **Phase 5–6 art** is the long pole and the quality risk; it is sequenced after the sim so the game is already playable and the review loop has something to show. If the renders do not meet the bar after three rounds per asset, the segment ships with the best round and the review lists what an artist would do (`11` §10).
- **Phase 9 networking** depends on James's friends' networks; the relay is the hedge.
- **Content volume** is mitigated by content-as-data and the linter; the docs already hold the numbers.

**Open questions**
1. ~~Segment 3 order: co-op first (recommended — it is the game's promise) or Dungeon 2 first?~~ *Checkpoint 1 (D-099): co-op first (Phase 9), then the Fungal Deep and Emberforge (Phase 10), as recommended and planned.*
2. ~~Should Frostmarch Citadel be built inside Segment 3 (stretch) or after launch (recommended)?~~ *Checkpoint 1 (D-099): after launch, as recommended — Segment 3 designs it in full (Phase 11).*
