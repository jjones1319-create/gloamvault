# Gloamvault — a co-op dungeon crawler for your phone

*Working title (D-001). A 1–4 player party dungeon crawler for Android (Galaxy S25 Ultra or better), built start-to-finish by Claude Code in VS Code from the design in this folder. Play link: **https://jjones1319-create.github.io/gloamvault/** — open it in Chrome on the phone, install it from Chrome's menu, and it updates itself.*

## The pitch

Four friends, one phone each, a torch, and a keep that sank into its own catacombs. Make a hero from six species and seven classes, delve **Gravehollow Keep** floor by floor, fight monsters on a **speed timeline** where a faster hero really does act more often and a perceptive one sees the trap first, and come back to the town of **Emberfall** to repair, upgrade, learn and open chests. **Everything you use grows**: skills, stats, weapons, armor, your pet. **Everything you neglect wears**: a sword with 0% durability does nothing until the blacksmith sees it, and a sword neglected twenty times is salvage. Gear runs **F → E → D → C → B → A → S → SS → God**; armor climbs its material ladder from rawhide to dragon scale; dungeon gold (never money) buys chests for gear, pets, materials and skill tomes with the odds on screen. Play alone, or with up to three friends over the internet with an invite code.

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
- [ ] **Segment 1** — ✅ P1 repo & link (2026-10-26: the title screen installs on the phone; linter, tuning, statuses, the screenshot tool) · ✅ P2 the sim (2026-10-27: the rulebook as pure TypeScript — timeline fights, statuses, the effect DSL, items and loot, the floor generator, whole delves; `npm run sim`, `npm run balance`, the first balance report on fixture content) · P3 content pass 1 · P4 playable slice → *Segment 1 review*
- [ ] **Segment 2** — P5 characters in Blender · P6 dungeon 3D & monsters · P7 Gravehollow complete · P8 polish → *Segment 2 review*
- [ ] **Segment 3** — P9 co-op · P10 Fungal Deep & Emberforge · P11 Beast Tamer, Wildsong import, endgame · P12 release → *v1.0*

## Open questions for James

Collected in `docs/13-DECISIONS.md` §D; the Segment 1 review will ask them with recommendations. The first ones that matter: the names (Gloamvault, Emberfall, Gravehollow Keep), the engine choice (web app, D-002), landscape-only, and the Proposed readings D-027–D-041.

## Glossary

**Delve** — one trip into a dungeon zone (3–4 floors), 20–40 min. **Zone** — three per dungeon, each with a family, a hunter, a boss and a Waystone. **Timeline** — the energy queue; you act at 1,000 energy; Speed is energy per tick. **Weight** — what an action costs on the timeline (800 light / 1,000 / 1,400 heavy). **Rows** — Front and Back on each side. **Light** — the torch meter 0–100 in five bands. **Detection** — Perception plus bonuses, against a trap's difficulty. **Ambush** — the surprise roll at the start of a fight. **Hunter** — the stalker that enters a floor at 40 clock ticks. **Insight** — learning a skill randomly by using its school in a fight. **Tome** — a tradeable skill copy. **Grade** — F … God, what an item is. **+N** — what you did to it with stones. **Promotion** — upgrading an item to the next material rung. **Wear / Broken / Salvage** — durability's three states. **R** — the median gold of one delve at your band; prices are written in R. **Pact** — an optional difficulty modifier for extra reward. **Waystone** — the checkpoint that starts a delve at a zone. **Bank** — gold you deposit survives a wipe; carried gold does not. **Ranch-raised** — a pet imported from Wildsong Ranch.
