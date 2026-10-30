# Gloamvault — a co-op dungeon crawler for your phone

*Working title (D-001). A 1–4 player party dungeon crawler for Android (Galaxy S25 Ultra or better), built start-to-finish by Claude Code in VS Code from the design in this folder. Play link: **https://jjones1319-create.github.io/gloamvault/** — open it in Chrome on the phone, install it from Chrome's menu, and it updates itself.*

## The pitch

Four friends, one phone each, a torch, and a keep that sank into its own catacombs. Make a hero from six species and seven classes, delve **Gravehollow Keep** floor by floor, fight monsters on a **speed timeline** where a faster hero really does act more often and a perceptive one sees the trap first, and come back to the town of **Emberfall** to repair, upgrade, learn and open chests. **Heroes level up** from every won fight, Final Fantasy style, and **everything you use grows** too: skills, stats, weapons, armor, your pet. **Everything you neglect wears**: a sword with 0% durability does nothing until the blacksmith sees it, and a sword neglected twenty times is salvage. Gear runs **F → E → D → C → B → A → S → SS → God**; armor climbs its material ladder from rawhide to dragon scale; dungeon gold (never money) buys chests for gear, pets, materials and skill tomes with the odds on screen. The tower is hard: a lone hero can climb it only after a lot of grinding, so you **unlock party members** and take up to four heroes in, or bring up to three friends over the internet with an invite code. Combat is turn-based: the fight waits on every hero's turn. Leave by walking out of a floor's entrance or teleporting out at its end, and the next delve starts where you stopped.

Full vision: `docs/01-VISION.md`. The rules: `docs/03-GAME-DESIGN.md`.

## How to start building

Open `PROMPT.md` and paste the **Segment 1 prompt** into Claude Code with this folder open in VS Code. The build runs in three segments; after each one you play on your phone and answer a short review. `CLAUDE.md` holds Claude's standing instructions; `STATUS.md` is where it keeps its place.

## Folder map

| Where | What |
|---|---|
| `CLAUDE.md` | orientation and rules for Claude Code (read automatically) |
| `PROMPT.md` | the prompts you paste: Segment 1/2/3, Continue, Feedback, follow-ups |
| `STATUS.md` | the live checkpoint |
| `docs/01-VISION.md` | pillars, audience, tone, names, art direction |
| `docs/02-RESEARCH.md` → `docs/research/` | the research digest and the three full reports (genre, systems, tech) |
| `docs/03-GAME-DESIGN.md` | **the rulebook** |
| `docs/04-CLASSES.md` → `docs/classes/` | Warden, Blade, Ranger, Shade, Arcanist, Mender, Beast Tamer — 45 skills each |
| `docs/05-SPECIES.md` | Human, Dwarf, Elf, Orc, Halfling, Draconid |
| `docs/06-MONSTERS.md` | families, elite affixes, Gravehollow's 35 monsters, 3 hunters, 4 bosses; Dungeons 2–4 outlined; 16 pets |
| `docs/07-DUNGEONS.md` | the overworld; Gravehollow floor by floor; kits, templates, curios, traps, arenas, the generator; Dungeons 2–4; difficulty and Pacts; contracts |
| `docs/08-ITEMS.md` | every item kind, affixes, sets, uniques, the eleven God items, materials, durability, chests, loot tables |
| `docs/09-SKILLS.md` | skill rules index and the eight field skills |
| `docs/10-TECH-PLAN.md` | web app on GitHub Pages, stack, architecture, phone budgets, multiplayer, saves, verify, compliance |
| `docs/11-ART-PIPELINE.md` | Blender → glTF → three.js: style, rig, bodies, gear, animation, monsters, rooms, the review loop |
| `docs/12-ROADMAP.md` | twelve phases in three segments with done-when criteria |
| `docs/13-DECISIONS.md` | the decision log and the open questions for James |
| `docs/14-IDEAS.md` | backlog, including the Wildsong Ranch crossover |
| `docs/feedback/` | the segment review template; reviews land here |
| `content/` | the seventeen JSON schemas, validated examples, and the linter rules (`content/README.md`) |

## Where we are

- [x] Research (genre · systems · tech) — 2026-10-26
- [x] Design package: rulebook, classes, species, monsters, dungeons, items, skills, tech, art, roadmap, decisions, schemas — 2026-10-26
- [x] **Segment 1** — ✅ P1 repo & link (2026-10-26: the title screen installs on the phone; linter, tuning, statuses, the screenshot tool) · ✅ P2 the sim (2026-10-27: the rulebook as pure TypeScript — timeline fights, statuses, the effect DSL, items and loot, the floor generator, whole delves; `npm run sim`, `npm run balance`, the first balance report on fixture content) · ✅ P3 content pass 1 (2026-10-27: six classes with Tiers I–III and Ultimates, six species, sixteen pets, the Cellars zone, items F–C, 255 custom skill hooks; Final Fantasy-style levels and the tower's difficulty from James's direction; the second balance report) · ✅ P4 the playable slice (2026-10-27: New game with the Mortal or Sheltered death rule, the new-hero selection, Emberfall's nine places — the Waystone with threat chips, Blacksmith, Skill Hall, Curio Merchant with the Wayfarer Chest, Stables, Bank, Quest Board, Lantern Inn, Ember Shrine — the hero screens, the 3D grey-box delve with the map, light and clock, the turn-based fight HUD, the save with backups; James's death, party and danger rules) → *Segment 1 review*
- [x] **Checkpoint 1** — 2026-10-27: James's answers logged and built — Nightmare (the third death rule), battle XP split through the party and scaled by the level gap to the party's average, every open question answered (D-095–D-099); v0.4.1
- [x] **Segment 2** — ✅ P5 characters in Blender (2026-10-28: two body frames on one rig, six species with 18 face presets, six class armour sets in crude and fine, 46 weapons, 20 animations, the character viewer and real heroes in the delve) · ✅ P6 dungeon 3D & monsters (2026-10-28: four room kits and 30 rooms, fourteen monster families with every Gravehollow monster, hunter and boss, effects, the phone gallery) · ✅ P7 Gravehollow complete (2026-10-28: 8 floors, the Crypts and the Drowned Vault, four boss arenas, Tiers IV–V, items to S, Pacts, contracts, the balance pass) · ✅ P8 polish and juice (2026-10-29: music and sound, the lesson floor, tips, growth lines, the codex, accessibility, the performance fix, the balance pass) → *Segment 2 review*
- [x] **Checkpoint 2** — 2026-10-29: James chose **Unity** and free-roam exploration — a joystick, much larger floors, random encounters while walking, press A to interact — built in **small phases with a stop after each**, installed on his phone over USB (D-135–D-140). The web version stays live, frozen at v0.8.0, until the Unity one matches it.
- [ ] **Segment 3 — Gloamvault in Unity** (`docs/12-ROADMAP.md` §3) — P9 Unity on your phone · P10 the rules inside Unity · P11 rooms · P12 heroes & monsters · P13 walking · P14 the test floor · P15–16 free-roam rules · P17–19 a whole delve · P20 saves (your web heroes come across) · P21–22 town · P23 sound · P24 bosses & polish → *the Unity version replaces the web one* · P25+ upgrades, co-op, two new dungeons, the Beast Tamer & Wildsong pets, release and the Play Store

## Open questions for James

Checkpoint 1 answered every open question (James: "I trust you to do all of the decision"; `docs/13-DECISIONS.md` §A4, D-095–D-099). New questions from Segment 2 collect in `STATUS.md` → *Open for James* and go into the Segment 2 review.

## Glossary

**Delve** — one trip into a dungeon zone (2–3 floors), 20–40 min. **Zone** — three per dungeon, each with a family, a hunter, a boss and a Waystone. **Timeline** — the energy queue; you act at 1,000 energy; Speed is energy per tick. **Weight** — what an action costs on the timeline (800 light / 1,000 / 1,400 heavy). **Rows** — Front and Back on each side. **Light** — the torch meter 0–100 in five bands. **Detection** — Perception plus bonuses, against a trap's difficulty. **Ambush** — the surprise roll at the start of a fight. **Hunter** — the stalker that enters a floor at 40 clock ticks. **Insight** — learning a skill randomly by using its school in a fight. **Tome** — a tradeable skill copy. **Grade** — F … God, what an item is. **+N** — what you did to it with stones. **Promotion** — upgrading an item to the next material rung. **Wear / Broken / Salvage** — durability's three states. **R** — the median gold of one delve at your band; prices are written in R. **Pact** — an optional difficulty modifier for extra reward. **Waystone** — the checkpoint that starts a delve at a zone. **Bank** — gold you deposit survives a wipe; carried gold does not. **Ranch-raised** — a pet imported from Wildsong Ranch.
