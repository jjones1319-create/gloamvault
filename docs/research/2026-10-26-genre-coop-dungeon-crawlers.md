# Genre research for "Dungeon Crawler" — co-op dungeon crawlers, speed-timeline combat, exploration, floors & bosses, town loops, mobile

*Research date: 2026-10-26. Prepared for James's 1–4 player co-op dungeon-delving RPG (high-end Android, APK via GitHub, 6 species × 6 classes, use-based levelling, durability/material upgrades, F→God gear tiers, gold→chests, pets, large per-class skill lists, multiple multi-floor dungeons with monster families). Combat is leaning turn-based with a speed-driven timeline but is NOT decided; this report brings evidence for and against. Everything will be built by an autonomous coding agent, so designs that a deterministic simulator can test are weighted up.*

*Where a number is published it is quoted with its source; where I give a number of my own it is marked as a tuning starting point, not a commitment.*

---

## 0. Scope and method

Thirty-plus games were examined through wikis, developer blogs, reviews and store pages (Sources at the end). The report is organised by the six questions asked, then closes with crisp recommendations. Numbers from the wikis are those of the current release unless noted; several pages flag themselves as possibly outdated (NetHack 3.6.0, DRG Season 02), which I note where it matters.

---

## 1. Co-op dungeon crawlers and roguelike RPGs: runs, floors, bosses, families, co-op

### 1.1 The structural patterns, in one table

| Game | Run unit | Floors / stages per run | Boss cadence | Co-op | Death rule |
|---|---|---|---|---|---|
| Darkest Dungeon 1 | one expedition (short/medium/long) | rooms + corridors (1–8 tiles each), boss room farthest from entrance | boss expeditions only; otherwise none | none | hero permadeath, roster persists |
| Darkest Dungeon 2 | one road trip to the Mountain, 40–60 h total | regions → inns → Mountain | lair boss per region (mandatory from ch.2), Oblivion's Rampart gate fight, Mountain boss | none | death's door → permadeath for the run |
| Children of Morta | 15–30 min runs | series of dungeons each ending in a boss | 1 boss per dungeon, unlocks next | 2 local (online added later) | keep gold/XP, lose temporary Divine Graces |
| Barony | one descent of the Devil's Bastion | random floors; Minotaur becomes "significantly stronger" after floor 25 | Baron Herx at the bottom | 4 | permadeath |
| Shattered Pixel Dungeon | 25-floor descent | 5 regions × 5 floors | boss every 5th floor, shop before each | none | permadeath (with unlockable ankh revives) |
| DCSS | 15 runes, Orb of Zot | persistent main dungeon + many branches; 3 runes to enter Zot | branch ends | none | permadeath |
| Slay the Spire | 3 acts (+ Act 4) | 17 floors per act, ≤6 nodes per floor | act boss on floor 16; elite rooms 8% base | none | permadeath |
| Hades | one escape | ~12 chambers per biome × 4 biomes | 1+ boss per biome, mini-bosses mid-biome | none | death = return to House, keep meta currencies |
| Dead Cells | one run | route of biomes, 4 boss tiers | tier 1/2/3 bosses on chosen routes, Hand of the King final | none | permadeath, keep cells spent |
| Moonlighter | 1 dungeon visit | 5 dungeons × 3 floors | 1 boss per dungeon | none | KO drops all but top inventory row |
| Dungeons of Dredmor | 10-floor descent | 10 big floors, each themed | Dredmor on 10 | none | optional permadeath |
| Wizardry (2023) | one expedition | 10-level Maze, map resets per run | Werdna at the bottom | none (6-char party) | resurrection costs rise; "lose everything in a run" |
| Etrian Odyssey | repeated trips | one labyrinth of strata × floors; later floors need several trips | stratum boss | none (5-char party) | wipe = reload |
| Legend of Grimrock 1/2 | continuous | 13 levels (LoG1) / island + multi-storey dungeons (LoG2) | few, set-piece | none | reload save |
| Battle Chasers: Nightwar | dungeon visit | story dungeons, replayable at 3 difficulties | per-dungeon boss | none (3 of 6 heroes) | reload |
| Dungeon of the Endless | one escape | 12 floors, door-by-door | floor exit under attack | 4 | permadeath of heroes, crystal loss = run over |
| Minecraft Dungeons | one mission | hand-made missions, threat slider | per-mission boss on some | 4 | respawn with lives per mission |
| Diablo IV nightmare dungeons | one sigil | 1 dungeon, Tier 1–100 | end boss / final objective | 4 | 12 revives (Sacred) / 4 (Ancestral); 0 left = sigil lost |
| Diablo Immortal | dungeons, Elder Rifts, raids | bespoke 4-player dungeons, 8-player raids | per dungeon | 4 / 8 / 100-player clans | resurrect in town or at checkpoint, ally can res |
| Deep Rock Galactic | one mission (3 lengths) | one procedural cave, 6 hazard levels | Dreadnought (Elimination) only | 4 | downed → ally revive; team wipe = mission fail |
| Vermintide 2 / Darktide | one mission | linear level, AI director | lords on some maps, monsters mixed in | 4 | downed → rescue, respawn in closets |
| Gauntlet (2014) | one dungeon run | several levels per dungeon | one boss per dungeon | 4 | skull keys / revive |
| Crawl (2017) | one match ~30 min | hero levels to 10 then boss | one boss, 3 tries | 4 local | hero death swaps roles |
| For The King I/II | one campaign | hex overworld + dungeons | chapter bosses | 3 online (I), 4 (II) | lives pool, then run over |

Sources: see §Sources — Darkest Dungeon wiki (Corridor, Combat Mechanics DD2), RPGamer DD2 review, Cubed3 Children of Morta, Barony wiki, Wikipedia Pixel Dungeon/DCSS/DRG, Slay the Spire wiki, Gamepressure Hades, Dead Cells wiki, RPGamer Moonlighter, RPGFan Dredmor/Wizardry, Cubed3 Etrian, Game Informer Battle Chasers, Co-Optimus DotE/Gauntlet, Maxroll D4, Game Informer Diablo Immortal, PC Gamer Crawl, PocketGamer For The King.

### 1.2 What each family teaches

**Party turn-based crawlers (Darkest Dungeon 1/2, Battle Chasers, Etrian, Wizardry, For The King).** These are the closest cousins to the proposed game. Darkest Dungeon's dungeon is a graph of rooms joined by corridors of 1–8 tiles; every tile walked counts as one "round" for status effects and the light meter, and re-entering a cleared corridor rolls a fresh battle (5%), hunger check (7.5%) or trap (5%), with +2.5% at light 1–50 and +5% at light 0 (DD wiki, Corridor). The boss room is placed farthest from the entrance *by room count*, a simple rule that a generator can implement and a simulator can check. DD2 replaces the hamlet with a road trip of regions separated by inns; lair bosses become mandatory from chapter two because you need a lair trophy to fight the Mountain (RPGamer). Battle Chasers runs a party of three through hand-made dungeons with randomised rooms, replayable at three difficulties for better loot; the reviewer's complaint was difficulty spikes between story dungeons and sparse, under-levelled loot (Game Informer). Etrian's single labyrinth is split into strata of several floors each with later floors needing multiple trips, an inventory cap that forces trips home, and bonus XP for under-strength parties (Cubed3). Wizardry's 2023 remaster kept the ten-level Maze, six-character party and increasingly expensive resurrection; RPGFan's verdict was "gut-punching difficulty" that demands patience.

**Traditional roguelikes (DCSS, Shattered PD, NetHack, Dredmor, ToME, Caves of Qud).** These supply the best-documented *mechanics* for a stats-driven game. DCSS's design philosophy — no incentives to repeat boring actions, no illusory choices, prune features (it removed food), add automation such as auto-explore via Dijkstra — is the right compass for a phone game (Wikipedia DCSS). Shattered Pixel Dungeon's 25 floors in five themed regions with a boss every five floors and a shop before each boss remains the clearest floor rhythm in the genre and the game is the most praised turn-based crawler on Android (mobiletier.games 4.89/5; Linux Format 9/10). Dredmor is the cautionary tale: ten big floors, 30+ skill trees of which you pick seven, but palette-swapped enemies after floor five, 25+ hard-to-read stats, inventory clutter and laggy controls dragged it to 72/100 (RPGFan).

**Action roguelites (Hades, Dead Cells, Soul Knight, Children of Morta, Moonlighter).** Hades is the reference for *encounter pacing*: roughly a dozen chambers per biome, each door previewing its reward, mini-boss chambers mid-biome, a boss per biome (Gamepressure), and a difficulty ladder (Pact of Punishment) that is a menu of orthogonal modifiers with costed ranks — for example Hard Labor +20% enemy damage per rank up to +100%, Jury Summons +20% enemies per rank up to +60%, Forced Overtime +20% enemy speed per rank, Tight Deadline 9:00 per region minus 2:00 per rank (RPG Site). Dead Cells scales bosses by Boss Stem Cells: the Concierge has 24,577 HP at 0 BSC rising to 167,306 at BSC IV (Dead Cells wiki) — a multiplicative difficulty knob that is trivially simulable. Children of Morta's 15–30 minute runs keep all gold and XP on death and spend them on family-wide stat upgrades (Cubed3), the gentlest death rule in the set. Moonlighter's five dungeons × three floors and "pay gold to leave early and keep your items" loop was praised for the alternation between delving and shopkeeping, criticised for shallow combat (RPGamer).

**First-person co-op crawlers (Barony, Grimrock).** Barony is the only 4-player first-person roguelike; it is permadeath, randomly generated, and uses the *Minotaur* — a wall-breaking hunter that spawns when a party dawdles on a floor, with the Baron's voice lines as warning — as a soft floor timer (Barony wiki). Grimrock 2's lesson is that grid real-time combat degenerates into a "slow-motion circle strafe" unless monsters get ranged attacks, side-steps and adjacent-square sweeps, and that puzzle clues spread across a map need note-taking tools the game did not provide (PC Gamer).

**Loot ARPGs on mobile and PC (Minecraft Dungeons, Diablo Immortal, Diablo IV, Torchlight Infinite).** Minecraft Dungeons has no classes; the build is gear + up to three enchantments per piece + three artifact slots, and the mission threat slider's recommended value accounts for player count and level (Windows Central, PC Gamer). Diablo IV's nightmare dungeons are the cleanest published scaling: monster level = 53 + Tier (Sacred, Tiers 1–20) or 54 + Tier (Ancestral, Tiers 21–100), one positive and one negative affliction per sigil, 12 revives on Sacred and 4 on Ancestral, and failure deletes the sigil (Maxroll). Diablo Immortal's reviewer (Game Informer, 8.5/10) praised "some of the best [controls] I've used in a mobile game" — skills fired by touching near a virtual button and aimed with a thumb swipe — alongside bespoke four-player dungeons, 8-player Warbands and 100-player Clans, but condemned the legendary-gem crest gacha and reported finger ache after long sessions. Torchlight Infinite's PC reviewer found "obscene amounts of menus" and a repetitive first ten hours (GameGrin 6.5/10).

**Team co-op action (Deep Rock Galactic, Vermintide 2/Darktide, Gauntlet, Magicka).** DRG's design intent is explicit: four classes with *interlocking* tools (Engineer platforms let the Scout grapple to a vein), every class "both viable and enjoyable", and a deliberate rejection of Left 4 Dead's veteran-vs-newbie imbalance; 10 mission types, six hazard levels, three mission lengths, up to two random modifiers, 8 million+ sold by Jan 2024 (Wikipedia). Vermintide's enemy taxonomy is the template for *monster families that force cooperation*: fodder that consumes attention, armoured elites that need the right weapon, specials that single out and disable one player so the others must respond, and monsters whose arrival splits the team's attention (PCGamesN). Magicka keeps friendly fire *always on* and its reviewer called it "essential" because it drives experimentation and comedy (Co-Optimus). Gauntlet 2014's four-player sessions are remembered for gold competition and class-flavoured chaos (Co-Optimus stream recap). Crawl inverts co-op: three players as ghosts control the monsters and traps; whoever kills the hero becomes the hero; the hero must reach level 10 to fight the boss, with three tries (PC Gamer).

**Asynchronous/strategic (Slay the Spire, Dungeon of the Endless).** Slay the Spire's generator is fully published: 17 floors per act, base room weights 53% monster / 8% elite / 12% rest / 5% merchant / 22% unknown, fixed floors (1 = easy fight, 9 = treasure, 15 = rest, 16 = boss), and weight re-balancing after each unknown resolves (StS wiki). This is the model for a *deterministic, testable* floor generator. Dungeon of the Endless makes opening a door the "turn": each door spawns waves and resources, and up to four players share the decision (Co-Optimus).

### 1.3 Mobile co-op dungeon crawlers, 2024–2026

- **Soul Knight Prequel** (ChillyRoom, launched November 2023, matured through 2024–25): online and local co-op, seven classes with a hybrid secondary class, 900+ items, class-specific loot, region map with dungeon-like stages ending in bosses; praised for polished touch controls and "versatile co-op", criticised for long stages, grindy boss drops and launch server failures (DotGG).
- **Shiren the Wanderer: Serpentcoil Island** arrived on Android with a cross-play rescue system (asynchronous co-op), and **Hell Clock** (a real-time ARPG) "recently landed on Android"; **Don't Starve Together Mobile** is mobile-only multiplayer (Rogueliker, 2026 list).
- **Mobile Dungeon: RPG Crawler** (Playa Games) is a turn-based idle crawler at 500K+ installs and 4.5★; reviews criticise its stamina timer and low drop rates (Google Play).
- **Hades II** (1.0 September 25, 2025; Metacritic 94–98) has no mobile version yet but is the current state of the art in run structure: two routes (Underworld: Erebus → Oceanus → Fields of Mourning → Tartarus; Surface: Ephyra → Rift of Thessaly → Mount Olympus → Summit), each region with its own boss, three-choice boons, a God Mode that adds damage resistance after failed runs (Wikipedia).
- The mobiletier.games April 2026 Android ranking is dominated by single-player or loose-co-op real-time games (Archero, Eternium, Soul Knight, Otherworld Legends) and one turn-based roguelike (Shattered PD). There is **no polished, party-based, turn-based, 4-player co-op 3D dungeon crawler on Android** — that gap is the opportunity.

---

## 2. Turn-based combat with speed-driven timelines

### 2.1 How the reference systems compute "who acts next"

| System | Time unit | How speed converts to turns | Randomness | Action cost varies by action? |
|---|---|---|---|---|
| **Darkest Dungeon 1** | round | order = SPD + 1d8, rerolled each round (community-documented) | yes, d8 | no — one action per round |
| **Darkest Dungeon 2** | round | hidden *round speed* = Speed + random 0–6 (wiki notes "patch notes say d6 but it is 0–6"); multi-action bosses get −2 per extra turn; speed buffs apply from the next round | yes, 0–6 | no; "free actions" don't end the turn; Daze pushes to end of round, Stun skips |
| **FFX CTB** | tick | each actor has a tick-speed derived from Agility; chosen action's *rank* multiplies the wait before the next turn; Haste/Slow scale it; a CTB window shows the upcoming order (jegged) | small random element noted | yes — ranks |
| **Grandia** | continuous IP gauge | icons move along WAIT → COM → ACT by the ACT stat (Wit + gear); skills take different charge times; hits during charge knock the target back and can cancel the action (LP Archive) | no | yes — per skill |
| **Child of Light** | continuous timeline | Wait then Cast segment; hitting a unit in Cast interrupts it and pushes it back; co-op partner Igniculus slows enemies by blinding them (Co-Optimus) | no | yes — cast length |
| **Octopath** | round | order loosely by Speed; BP: +1 per turn (none if spent last turn), store 5, spend ≤3; Break stuns for a full turn and doubles damage; broken enemy acts first next round (GamerGuides) | small | no |
| **Shattered PD** | turn | 1 action ≈ 1 turn; modifiers multiply (Freerunner 1.6× movement; wand recharge 40/√(lvl+1) turns) (PD wiki) | no | yes — fractional turns |
| **DCSS** | aut (1/10 of a decaAut = 1 "turn") | weapon delay = base − ⌊skill/2⌋ down to ⌊base/2⌋ (short blades min 5, two-handers min 7, hard floor 3); Haste ÷1.5, Slow ×1.5, Finesse ÷2, never below 2; shields add min(2 rolls of 1..penalty) (Crawl wiki) | weighted rounding only | yes — per weapon/action |
| **NetHack** | turn | 12 movement points/turn = 1 action; Fast averages 16 (free move ~1/3 of turns), Very Fast 20; monsters: speed/12 guaranteed moves + remainder as chance (NetHack wiki) | yes | no (movement-centric) |
| **Tales of Maj'Eyal** | game turn | 1000 energy/turn at 100% global speed; attack costs 1000 / weapon speed / (1 + attack speed); bows 125% → 800; Rapid Shot + swiftstrike bow ≈ 424 per hit = 2.36 hits/turn (te4 wiki) | no | yes — per action |
| **Caves of Qud** | segment (100) / turn (1000) | Quickness = action points per turn (default 1000); standard action 1000, minor 100; every cost varies ±10% "to make initiative order less deterministic" (Qud wiki) | yes, ±10% | yes |
| **DOS2 Definitive** | round | round-robin: sides alternate ally/enemy, within each side by initiative (Nexus mod description of vanilla) | no | AP economy |
| **BG3** | round | consecutive allies in initiative order share a *group turn* and act in any order, "all four co-op partners… at the same time" (PC Gamer preview; shipped) | d20 initiative | action/bonus action |
| **Wildermyth** | team phase | all heroes act in any order, then enemies; 1–5 players online, drop-in/out (co-op.gg) | no | no |

Two conclusions fall out of the table. First, the *energy/priority-queue* model (ToME, Qud, DCSS, Grandia, FFX) is the one that makes "speed = more and faster attacks" literally true, which is the brief's definition of realistic stats. Second, every game that cares about *fairness in co-op* (BG3, Wildermyth, DOS2 DE) either groups allied turns or alternates sides, because strictly interleaved individual turns make three players idle. A hybrid — a continuous timeline for *when* an actor is ready, with *grouped decision windows* when several allies are ready together — gives both.

### 2.2 Keeping four players from waiting

Documented techniques, strongest first:

1. **Simultaneous allied decisions.** BG3's grouped turns were pitched explicitly as the fix for DOS2 co-op where "you spend most of a fight doing nothing, just waiting for your turn" (PC Gamer). Wildermyth's team phase does the same. For The King players begged for a "Simultaneous Turn option… like Civilization" because sequential turns plus network delay became noticeable "after many turns" (Steam thread).
2. **Visible future.** FFX's CTB window and Grandia's IP gauge let idle players plan; waiting is tolerable when it is *informative* (jegged; LP Archive).
3. **Short fights.** Darkest Dungeon encounters last a handful of rounds with one action per hero per round; most status effects last 3 turns (DD2 wiki). Crawl's whole match is ~30 min (PC Gamer). Design fights to 3–6 rounds.
4. **Decision timers with a sane default.** Not in the surveyed PC crawlers, but mobile PvP turn-based games universally use 15–45 s timers; combined with "repeat last action / basic attack" as the timeout, a disconnected phone never stalls the party.
5. **Delegation to AI.** Diablo Immortal and Torchlight ship auto-navigation/auto-battle; a turn-based game can let a player toggle "auto" for their hero and let the same scripted policy the test-suite uses take over (the Project Ascend sim already has `policies.ts` for this purpose).
6. **Asynchronous co-op** as a fallback: Shiren's rescue system and Children of Morta's shared family tree show that "co-op" can also mean leaving ghosts, rescues or shared progression when four phones aren't online at once.

### 2.3 Turn-based vs real-time action for 4-player co-op on phones

| Criterion | Speed-timeline turn-based | Real-time action (Soul Knight / Diablo Immortal style) |
|---|---|---|
| Netcode | Commands only; a host-relayed or server-validated *deterministic lockstep* needs no prediction, no rollback, tolerates 200 ms+ and late join via state snapshot (gafferongames: lockstep sends commands not state; its weakness — latency = slowest player — is invisible in a game that already waits for decisions) | Needs client-side prediction, reconciliation and interpolation; "only the local player's latency is hidden" (gafferongames); mobile radio jitter shows up as rubber-banding |
| Touch controls | Tap a target, tap a skill; fits one thumb, portrait or landscape; Darkest Dungeon's only touch complaints were tiny arrows and small text (TouchArcade) | Virtual joystick + aim swipe can be excellent (Game Informer on Diablo Immortal) but Soul Knight's auto-aim "awkward" against destructibles (TouchArcade) and Immortal caused finger ache; 3D camera + dodge + 4 skills is a lot of thumb |
| Testability by simulation | Fully deterministic given a seed; `runAuto` with scripted policies can batch 10,000 fights in seconds; balance reports are reproducible | Physics, animation timing, input latency and AI pathing make outcomes non-deterministic; balance needs human play or heavy instrumentation |
| Depth from "realistic stats" | Speed → more turns on the timeline; perception → surprise rolls; all expressible as closed-form numbers | Speed → animation rate; feel-dependent, hard to make legible |
| Hazard | Waiting (mitigated above); fewer "wow" moments | Chaos is fun (Magicka, Gauntlet) but 3D real-time on phones is the most expensive thing to build and the hardest to balance |
| Evidence of mobile fit | Shattered PD is the highest-rated crawler on Android; Darkest Dungeon iPad suits "twenty-minute sessions" (TouchArcade); Mobile Dungeon: RPG Crawler 500K+ installs | Diablo Immortal and Soul Knight are huge, but both are real-time *2.5D* with heavy publisher budgets |

The exploration layer can still be real-time 3D (walk the dungeon, open doors, trigger traps) while combat is a timeline; Etrian, Wizardry, Grimrock and Darkest Dungeon all separate "moving through the dungeon" from "resolving a fight".

---

## 3. Exploration systems

### 3.1 Light and supplies — Darkest Dungeon's torch, numerically

The light meter is a single resource that drives scouting, surprise, stress, loot and monster strength (DD wiki, Light Meter):

| Light | Scouting | Monsters surprised | Heroes surprised | Extra loot | Stress taken | Monster ACC / DMG | Hero crit |
|---|---|---|---|---|---|---|---|
| Radiant >75 | +15% | +25% | — | — | — | — | — |
| Dim 51–75 | +7.5% | +15% | — | 25% | +10% | — | — |
| Shadowy 26–50 | — | +10% | +15% | 50% | +20% | +5 / +10% | +1% |
| Dark 1–25 | — | +5% | +25% | 75% | +30% | +10 / +15% (Darkest) | +2% |
| Black as Pitch 0 | — | — | +40% | 95% & two extra loot types | +40% | +12.5 / +25% | +3% |

The torch burns 1 per tile on explored segments and 6 on new tiles; at 0 light hallway battles can become Shambler ambushes (1%/8%/12% by dungeon level). This is the best example of a *push-your-luck* dial that a phone player can read at a glance. Hunger is a hidden corridor tile; re-entering a corridor rolls 7.5–12.5% by light; eating costs 1 food per hero and heals 5% HP, refusing costs 20% max HP and +20 stress, and the whole party eats or nobody does (DD wiki, Hunger).

### 3.2 Scouting, traps, secret doors, ambush

- **Darkest Dungeon scouting**: 25% base per new room (+15% in Radiant), reveals adjacent corridors' curios, traps and battles; *scouting is the only way to reveal traps*; a critical scout (50% of successes) reveals two corridors and is the only way to find secret rooms; scouting a battle lowers surprise chance (DD wiki, Scouting). Trinkets add +10% to +25% scouting and +10% to +30% trap disarm.
- **NetHack search**: the `s` command checks the eight adjacent squares; a secret door is found if `rnl(7 − bonus)` is 0 — about 14% per search at neutral Luck, 70% at Luck 12–13; traps use `rnl(8)` ≈ 12%; ~20 searches for 95% confidence at neutral Luck; lenses +2 bonus; a ring of searching makes it automatic every turn (NetHack wiki).
- **Shattered Pixel Dungeon** redesigned secrets so they are never load-bearing: every standard room keeps a visible path to the entrance; secret rooms are deliberately placed (12 types), hold rare consumables rather than top gear, and searching costs hunger so food becomes the budget for curiosity; the Rogue gets a bigger search radius and ~25% more secret rooms (shatteredpixel.com).
- **DCSS** dropped food altogether as "featuritis" and auto-explores with Dijkstra (Wikipedia).
- **Etrian Odyssey** makes the *map itself* the exploration reward: draw walls and icons by touch; FOEs are visible stalker monsters that move when you move and are avoided "like a puzzle" (Cubed3).
- **Grimrock**: hidden buttons, distant pressure plates, riddles spread across the world; "little handholding" was praised, but clue-tracking without tools was the main complaint (PC Gamer).
- **Barony**: the Minotaur hunts slow parties and breaks walls, turning *time on a floor* into a resource (Barony wiki).

### 3.3 What makes dungeon exploration fun on a phone

From the mobile reviews and the mechanics above:

1. **One legible resource dial** (torch) that changes risk and reward on every screen — DD's table is readable at a glance; hunger as a second hidden dial was tolerated on PC but is exactly the kind of busywork DCSS removed.
2. **Perception as passive detection** (Shattered PD's radius, NetHack's automatic searching) rather than an active "search 20 times" command; the brief's "perception = fewer ambushes, more traps and treasure found" maps directly onto DD's scouting and surprise numbers.
3. **Auto-explore with interrupts** (DCSS) or tap-to-move on a visible map, so a thumb does the walking and the player makes the decisions.
4. **Secrets that reward, never gate** (Shattered PD rule).
5. **Floors short enough for a session**: GameAnalytics' 2025 benchmarks put the median mobile session at 5–6 minutes (top quartile 8–9), ~4 sessions a day, 22 minutes a day median (substack summary) — a floor should be clearable, or safely pausable, in that window.
6. **A soft clock** (Barony's Minotaur, Hades' Tight Deadline) is a better anti-dawdling tool than hunger because it is dramatic and visible.

---

## 4. Floor and boss structure

### 4.1 Floors per dungeon and boss cadence

Published rhythms: Shattered PD 5 floors per region with a boss on floor 5 (25 total); Moonlighter 3 floors per dungeon; Dredmor 10; Wizardry 10; Slay the Spire 17 per act with fixed treasure/rest/boss floors; Hades ~12 chambers per biome; Etrian strata of several floors each; DD2 one lair boss per region plus a gate fight (Oblivion's Rampart) before each inn; Dead Cells 3–4 boss tiers on a branching route. The convergent answer is **a boss every 3–5 floors, with a mid-point mini-boss or elite room, and a shop/rest/checkpoint just before the boss**.

### 4.2 Elites, champions and affixes

- **Diablo 3**: elites carry 1 affix at levels 1–29, 2 at 30–49, 3 at 50–59, 4 at 60+; always 2–3 offensive, ≤1 defensive, ≤1 crowd-control; champion packs are 3–5 identical monsters, rares are a leader + minions with some affixes inherited; the affix list is ~28 entries (Waller, Jailer, Molten, Arcane Enchanted, Frozen, Vortex, Shielding, Fast, Illusionist, Horde…) each a *positional* threat (Maxroll).
- **Diablo IV**: one positive and one negative affliction per nightmare sigil; one negative class "grants Elites a guaranteed Affix" (Maxroll).
- **Hades**: Benefits Package gives armoured enemies +1 perk per rank; Middle Management adds an elite to mini-boss fights; Extreme Measures arms bosses with new techniques; Damage Control gives one shielded hit (RPG Site).
- **Vermintide**: elite = armour that needs the right damage type; special = disabler that *removes one player from the fight* until a teammate frees them (PCGamesN). In a turn-based party game this translates to Grab/Stun/Pull effects — Darkest Dungeon's Move, Stun and Daze tokens already encode exactly this (DD2 wiki).

### 4.3 Monster family per biome

Pixel Dungeon's regions (sewer → prison → caves → dwarven city → demon halls) each carry their own roster; Hades' biomes have distinct enemy sets and a boss themed to the biome; Dead Cells' bosses sit in named biomes. Dredmor's failure — palette swaps after floor five — is the thing to avoid (RPGFan). Vermintide's taxonomy (fodder / armoured elite / disabler special / monster / lord) is the right *skeleton* for every family: each family should have at least one of each role so co-op roles keep mattering on every floor.

### 4.4 Encounter pacing

Slay the Spire's generator numbers are the best published starting point: ~53% fights, 8% elites (×1.6 at Ascension 1+), 12% rests, 5% shops, 22% unknown, with fixed treasure and rest floors before the boss. Hades previews each door's reward so pacing becomes a player choice. DD corridor re-entry rolls (5% battle, 7.5% hunger, 5% trap) show how to make backtracking slightly risky without making it a wall.

### 4.5 Checkpoints and escape

- **Diablo**: town portal scrolls/skills; D3 revives at checkpoint, at corpse after 5 s (not in boss fights, 3 in a row), in town, or by an ally channelling 3 s; Greater Rifts remove town revive and grow the corpse timer 5→30 s (Diablo wiki Death).
- **Moonlighter**: pay gold to leave early with your items, pay more to resume where you left (RPGamer).
- **DCSS**: persistent levels with stairs as the universal escape (monsters adjacent follow you) — stair-dancing is a known tactic; **Barony**: ladders down are the only way to shake the Minotaur.
- **Darkest Dungeon**: retreat is always available at a stress cost and the quest fails; camps in medium/long expeditions restore light and let heroes use camping skills.
- **Wizardry/Etrian**: return trips to town are the loop; Etrian's inventory cap is the pacing device (Cubed3).

### 4.6 Death penalties in co-op

| Rule | Where | Co-op consequence |
|---|---|---|
| Permadeath of the run | Barony, DotE, Shattered PD, DCSS | one death can end the night for four people; Barony accepts it because runs are short and chaotic |
| Permadeath of a character, roster persists | Darkest Dungeon 1/2 | the *player* loses an investment but continues; harsh on mobile |
| Downed → ally revive within a window, wipe = fail | DRG, Vermintide, Diablo IV NM dungeons (12 / 4 revives), Minecraft Dungeons lives | makes rescuing a core co-op verb; revive counts give a visible budget |
| Gold/loot loss | Moonlighter (all but top row), Rogue Legacy (Charon takes 100%, Haggle to 70%), Diablo II (corpse run) | sharp but legible; pushes a *bank* mechanic |
| Durability loss | Diablo 3 (10% per death) | fits the brief's durability system exactly |
| Keep everything, lose buffs | Children of Morta, Hades, Diablo Immortal | lowest friction; relies on time cost |

---

## 5. Town hub loops

- **Darkest Dungeon hamlet**: sanitarium, tavern, abbey, blacksmith, guild, stagecoach; the mobile reviewer singled out "upgrading the town adds a sense of permanence" (TouchArcade). DD2 swapped it for inns on the road plus the Altar of Hope where candles unlock items and hero abilities (RPGamer).
- **Hades' House**: contractor upgrades, Mirror of Night talents, relationships that pay out in keepsakes; Hades II adds resource gathering and a skill tree for summons (Wikipedia).
- **Rogue Legacy manor**: Charon's toll makes *every* coin either spent or lost before the next run; Blacksmith gear 250–6,000 gold, runes 175 → 9,625 each (269,500 total), Architect locks the layout for 40% of gold (StrategyWiki) — numbers that show how a town can absorb an entire economy.
- **Moonlighter**: the shop *is* the town; player-set prices with customer mood icons; gold funds blacksmith/witch upgrades and new shops (RPGamer).
- **Etrian / Wizardry**: inn to rest, guild for party management, shop that stocks items from the materials you sell it, resurrection at the temple with escalating cost (Cubed3, RPGFan).
- **DRG space rig**: cosmetics, weapon upgrades from credits + crafted minerals, mission select with modifiers (Wikipedia).
- **Soul Knight Prequel**: daily quests award chest keys to gear new characters (DotGG) — the gacha-chest hook the brief already has.

What keeps players coming back, in order of evidence: (1) a *sink* for the run's gold that is visible before the run (Rogue Legacy, Moonlighter); (2) persistent upgrades that change the next run's rules (DD hamlet, Hades mirror); (3) maintenance that is cheap but mandatory (repair, resurrection, resting) — Etrian's inventory cap and Wizardry's escalating resurrection both *force* trips home; (4) a daily reason (keys, quests). A town with repair (durability), a trainer (skill purchases), a chest vendor (gold→gear/pet gacha), stables (pets), a bank and a quest board covers all four.

---

## 6. Mobile-specific findings

- **Controls that reviewers praised**: Diablo Immortal's virtual stick + skill buttons with swipe-aim ("some of the best I've used in a mobile game", Game Informer); Eternium's swipe-gesture spells instead of buttons (mobiletier); Crypt of the NecroDancer's tap-grid; Soul Knight Prequel's touch controls. **Complaints**: Soul Knight's auto-aim and directional aiming for destructibles (TouchArcade 2017); Darkest Dungeon iPad's black bars, small text and tiny scroll arrows that cause accidental drags (TouchArcade); Torchlight Infinite's menu overload and "still very obviously a mobile title" (GameGrin); Dredmor's 25+ stats and input lag; Mobile Dungeon: RPG Crawler's stamina timer and drop rates (Google Play reviews); Diablo Immortal's crest gacha "disgusting" (Game Informer).
- **Session length**: Darkest Dungeon iPad "twenty-minute sessions on a single quest" (TouchArcade); Children of Morta 15–30 min runs; Crawl ~30 min matches; industry median 5–6 min sessions, ~4 per day (GameAnalytics 2025). A *floor* is the natural mobile unit; a *dungeon* is the evening unit.
- **Portrait vs landscape** (judgement, not a cited stat): every 3D or 2.5D action crawler surveyed (Diablo Immortal, Torchlight Infinite, Soul Knight Prequel, Eternium) is landscape because the camera and two-thumb controls need width; turn-based party games (Mobile Dungeon, most gacha RPGs) are portrait because one thumb reaches everything and the phone is held like a phone. A 3D exploration layer plus a party timeline argues for **landscape in the dungeon** with a one-thumb reachable action bar, and portrait-compatible town/inventory screens only if cheap.
- **Monetization signals**: Soul Knight is loved for a "generous" model and a $2 permanent revive pass; Eternium for "zero energy timers or forced ads"; Shattered PD is free and open source. For an APK distributed via GitHub none of this applies commercially, but the *expectations* do: no stamina, no paid revives.

---

## 7. Recommendations for Dungeon Crawler

Each line is a decision with the reason; numbers are tuning starting points.

**Combat model — speed-timeline turn-based with grouped allied windows.**
- Energy/priority queue: every actor has `next_t = now + cost(action) × 1000 / speed` with standard action cost 1000, light 700, heavy 1500, plus ±10% jitter on each cost (Caves of Qud's rule) so order is not a lockstep. *Reason*: ToME/Qud/DCSS show this makes "speed = more and faster attacks" literally true and it is a 20-line deterministic scheduler the simulator already resembles.
- Weapon delay reduced by weapon-skill use: `delay = base − ⌊skill/2⌋`, floor at ⌊base/2⌋ (DCSS). *Reason*: ties "everything levels with use" to a published, bounded curve.
- Show the next 8 turns as a strip (FFX CTB window); interrupts: a heavy hit on a *charging* actor pushes it back 300 (Grandia/Child of Light). *Reason*: waiting becomes planning.
- When the queue's next k actors are all players, open one shared decision window; resolve in queue order (BG3 grouped turns). *Reason*: the single documented cure for co-op idle time.
- Decision timer 20 s, default on expiry = repeat last action or basic attack; a disconnected player's hero runs the sim's scripted policy. *Reason*: a phone call must never stall three friends.
- Target 3–6 rounds per fight; statuses last 3 turns (DD2). *Reason*: short fights are the second cure for waiting.
- Keep exploration real-time 3D and third-person; combat opens as a timeline on the same scene. *Reason*: Etrian/Grimrock/DD separate movement from resolution; touch and netcode both get simpler.

**Run / floor / boss structure.**
- Dungeon = 5 floors; floor 3 mini-boss, floor 5 floor-boss, shop+rest node on floor 4 before the boss (Shattered PD rhythm + StS fixed-floor rule); final dungeon 7 floors with two mid-bosses. *Reason*: the strongest published cadence, and a floor fits a 5–10 minute session.
- Floor generator with StS-style weights: 55% fights / 8% elites / 12% rest / 5% shop / 20% unknown, boss room farthest by room count (DD rule); seed everything. *Reason*: deterministic and testable; reward previews on doors (Hades).
- Elite affixes: pool of 12 positional/interaction affixes; 1 affix on floors 1–2, 2 on 3–4, 3 on 5+ (D3 scaling); each monster family ships fodder / armoured elite / disabler special / monster / boss (Vermintide taxonomy). *Reason*: families stay distinct and co-op roles matter every floor.
- Scaling knobs as a Pact-style menu (enemy HP %, damage %, count %, speed %, floor timer), each a scalar the balance runner can sweep. *Reason*: Hades/Dead Cells show scalar knobs are enough for a hundred hours of difficulty.

**Co-op pacing rules.**
- 1–4 players; shared decision windows; 20 s timer; AI delegation toggle; drop-in before a fight, never mid-fight; host-authoritative deterministic lockstep with command log + seed so any client can replay the fight (and the test-suite can replay bug reports). *Reason*: lockstep's only weakness (slowest-player latency) is invisible in a game that already waits for decisions.
- Downed → revive by an ally within 3 of the downed hero's turns (DRG/D3 ally revive); 3 party revives per floor on normal (D4 revive budget); wipe = return to town. *Reason*: rescuing is the core co-op verb; budgets make risk legible.

**Exploration feature set.**
- Torch/light meter with DD's five bands driving surprise, scouting, loot and enemy accuracy; torch burns on new tiles only. *Reason*: one dial, read at a glance.
- Perception = passive detection radius for traps, secret doors and treasure (Shattered PD radius; NetHack auto-search), plus the surprise roll `P(ambush) = base(light) − perception bonus`. *Reason*: matches the brief without an active "search" grind.
- Secrets reward, never gate (Shattered PD rule). Auto-walk to tapped destination with interrupt on sight (DCSS auto-explore). A visible floor clock after which a "hunter" spawns (Barony Minotaur) instead of hunger. *Reason*: DCSS removed food for good reason; a hunter is dramatic and a timer is testable.

**Death rule.**
- No permadeath by default: wipe returns the party to town, unbanked gold is lost (Rogue Legacy/Moonlighter), every equipped item takes a 10% durability hit (Diablo 3), all XP and skill progress is kept (Children of Morta). Optional hardcore toggle per character. *Reason*: fits the durability system, protects a four-person evening, and still makes the bank and the blacksmith matter.

**Town loop.**
- Blacksmith (repair + material upgrades leather→dragon scale, iron→steel), Trainer (buy skills from the class list), Chest vendor (gold→gear/pet chests), Stables (pets), Bank (deposit gold before a run; the only protection from the death rule), Quest board (dungeon select + daily keys for chests). *Reason*: covers the four documented reasons players return — visible gold sink, persistent upgrades, cheap mandatory maintenance, a daily hook — and every element is a flat data table the agent can generate and the linter can check.

**What to prototype first (simulation-first).** The scheduler, the surprise/scouting roll and the StS-style floor generator are all pure functions of a seed; build them in the sim, batch 10,000 fights per class pairing, and only then put a camera on it.

---

## Sources

- Darkest Dungeon II Combat Mechanics — https://darkestdungeon.wiki.gg/wiki/Combat_Mechanics_(Darkest_Dungeon_II)
- Darkest Dungeon Light Meter — https://darkestdungeon.wiki.gg/wiki/Light_Meter
- Darkest Dungeon Hunger — https://darkestdungeon.wiki.gg/wiki/Hunger
- Darkest Dungeon Scouting — https://darkestdungeon.wiki.gg/wiki/Scouting
- Darkest Dungeon Corridor / Dungeon Map — https://darkestdungeon.wiki.gg/wiki/Corridor
- Darkest Dungeon speed/initiative discussion threads — https://steamcommunity.com/app/262060/discussions/0/490123938439644214
- RPGamer, Darkest Dungeon II review — https://rpgamer.com/review/darkest-dungeon-ii-review/
- TouchArcade, Darkest Dungeon iPad review — https://toucharcade.com/2017/09/04/darkest-dungeon-ipad-review/
- jegged.com, FFX CTB Window — https://jegged.com/Games/Final-Fantasy-X/Tips-and-Tricks/CTB-Window.html
- Let's Play Archive, Grandia Update 07 (IP gauge) — https://lparchive.org/Grandia/Update%2007
- Co-Optimus, Child of Light co-op review — https://www.co-optimus.com/review/1365/page/1/child-of-light-co-op-review.html
- GamerGuides, Octopath Traveler battle system — https://www.gamerguides.com/octopath-traveler/guide/the-basics/game-mechanics/battle-system
- Pixel Dungeon wiki, Heroes — https://pixeldungeon.fandom.com/wiki/Heroes
- Wikipedia, Pixel Dungeon — https://en.wikipedia.org/wiki/Pixel_Dungeon
- Shattered Pixel blog, "Better secrets" — https://shatteredpixel.com/blog/coming-soon-to-shattered-better-secrets.html
- CrawlWiki, Attack speed — http://crawl.chaosforge.org/Attack_speed
- Wikipedia, Dungeon Crawl Stone Soup — https://en.wikipedia.org/wiki/Dungeon_Crawl_Stone_Soup
- NetHack wiki, Speed — https://nethackwiki.com/wiki/Speed
- NetHack wiki, Search — https://www.nethackwiki.com/wiki/Search
- te4.org wiki, Speed (Tales of Maj'Eyal) — https://te4.org/wiki/Speed
- Caves of Qud wiki, Action cost — https://wiki.cavesofqud.com/wiki/Action_cost
- Nexus Mods, DOS2 DE initiative mod (describes vanilla round-robin) — https://www.nexusmods.com/divinityoriginalsin2definitiveedition/mods/270
- PC Gamer, BG3 simultaneous turn-based combat — https://www.pcgamer.com/amp/baldurs-gate-3s-simultaneous-turn-based-combat-is-a-blessing-for-multiplayer/
- co-op.gg, Wildermyth — https://www.co-op.gg/pc/game/wildermyth
- For The King Steam discussion, simultaneous turns — https://steamcommunity.com/app/527230/discussions/0/1620599015903246089
- PocketGamer, For The King — https://www.pocketgamer.com/for-the-king/for-the-king-is-a-curious-mix-of-roguelike-and-tur/
- Cubed3, Children of Morta review — https://cubed3.com/review/6165/1/children-of-morta-playstation-4.html
- Barony wiki — https://baronygame.fandom.com/ and Minotaur — https://baronygame.fandom.com/wiki/Minotaur
- Wikipedia, Deep Rock Galactic — https://en.wikipedia.org/wiki/Deep_Rock_Galactic
- DRG wiki, Field Medic — https://deeprockgalactic.wiki.gg/wiki/Field_Medic
- PCGamesN, Vermintide 2 enemy guide — https://pcgamesn.com/warhammer-vermintide-2/vermintide-2-enemy-guide
- Co-Optimus, Gauntlet 4-player stream recap — https://www.co-optimus.com/article/12330/gauntlet-4-player-co-op-stream-recap-chaos.html
- Co-Optimus, Magicka co-op review — https://www.co-optimus.com/ampfeature/678/magicka-co-op-review.html
- PC Gamer, Crawl early access review — https://www.pcgamer.com/au/crawl-review-early-access
- Co-Optimus, Dungeon of the Endless co-op overview — https://co-optimus.com/article/12631/dungeon-of-the-endless-co-op-overview.html
- PC Gamer, Minecraft Dungeons difficulty — https://www.pcgamer.com/au/minecraft-dungeons-difficulty-threat/
- Windows Central, Minecraft Dungeons guide — https://www.windowscentral.com/minecraft-dungeons-everything-you-need-know
- Maxroll, Diablo 4 Nightmare Dungeons — https://maxroll.gg/d4/resources/nightmare-dungeons
- Maxroll, Diablo 3 Elite affixes — https://maxroll.gg/d3/resources/elite-affixes
- Diablo wiki, Death — https://diablo.fandom.com/wiki/Death
- Game Informer, Diablo Immortal review — https://gameinformer.com/review/diablo-immortal/the-price-of-playing-with-the-devil
- GameGrin, Torchlight Infinite review — https://www.gamegrin.com/reviews/torchlight-infinite-review/
- TouchArcade, Soul Knight review — https://toucharcade.com/2017/03/10/soul-knight-review/
- DotGG, Soul Knight Prequel review — https://dotgg.gg/soul-knight-prequel-review/
- Gamepressure, Hades underworld structure — https://www.gamepressure.com/hades/underworld-structure-1/z4d9c4
- RPG Site, Hades Pact of Punishment — https://rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards
- Wikipedia, Hades II — https://en.wikipedia.org/wiki/Hades_II
- Dead Cells wiki, Boss — https://deadcells.wiki.gg/wiki/Boss
- Slay the Spire wiki, Map Generation — https://slaythespire.wiki.gg/wiki/Map_Generation
- RPGamer, Moonlighter review — https://rpgamer.com/review/moonlighter-review/
- StrategyWiki, Rogue Legacy NPCs — https://strategywiki.org/wiki/Rogue_Legacy/NPCs
- RPGFan, Dungeons of Dredmor review — https://www.rpgfan.com/review/dungeons-of-dredmor/
- RPGFan, Wizardry: Proving Grounds of the Mad Overlord review — https://www.rpgfan.com/review/wizardry-proving-grounds-of-the-mad-overlord/
- Cubed3, Etrian Odyssey Origins Collection review — https://www.cubed3.com/games/reviews/nintendo-switch/etrian-odyssey-origins-collection
- RPGFan, Etrian Odyssey V review — https://www.rpgfan.com/review/etrian-odyssey-v-beyond-the-myth/
- PC Gamer, Legend of Grimrock 2 review — https://www.pcgamer.com/legend-of-grimrock-2-review
- Game Informer, Battle Chasers: Nightwar review — https://gameinformer.com/games/battle_chasers_nightwar/b/playstation4/archive/2017/10/02/battle-chasers-nightwar-game-informer-review
- mobiletier.games, Best dungeon crawlers for Android (April 2026) — https://mobiletier.games/rankings/best-dungeon-crawler-games-android/
- Rogueliker, Best roguelikes on Android and iOS — https://rogueliker.com/android-roguelikes/
- Google Play, Mobile Dungeon: RPG Crawler — https://play.google.com/store/apps/details?id=com.playagames.mobile.dungeon.team.battle.rpg&hl=en_US
- GameDev Reports, GameAnalytics 2025 mobile benchmarks — https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks
- Gaffer On Games, What every programmer needs to know about game networking — https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/
