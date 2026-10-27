# Segment 1 review — 2026-10-27

*Written by Claude Code at the end of Segment 1 (Phases 1–4). James: play the checklist in §3, then answer the questions in §6 by pasting the Feedback prompt from `PROMPT.md` (or write under "James's answers" at the bottom). Every answer gets logged in `docs/13-DECISIONS.md` before Segment 2 starts.*

## 1. What was built (one paragraph per phase)

- **Phase 1 — Repo, skeleton, the link on the phone.** Gloamvault is a public GitHub repository that publishes itself to **https://jjones1319-create.github.io/gloamvault/** every time it changes. It installs on the phone like an app, works offline, and keeps to landscape. Behind it sit the safety nets every later phase leans on: a type checker, the tests, a content checker that reads every game file against its rules, a screenshot tool, and the build-size limits.
- **Phase 2 — The rulebook as code.** The rules in `docs/03-GAME-DESIGN.md` became a "simulator": pure, repeatable code that plays the game without a screen. It covers the speed timeline, statuses, skills, items that wear, loot and chests, the floor generator, light and ambushes, and whole delves. The same seed and the same choices always give the same result, which is what makes saves, replays and (later) co-op possible. A batch runner plays hundreds of delves and writes a balance report.
- **Phase 3 — Content pass 1.** The real game data: six classes with three tiers of skills and an Ultimate each, six species, sixteen pets, the Cellars (14 monsters including Old Gnaw and Captain Vexa Marrow, encounters, rooms, curios, traps, secrets), 384 items from F to C, and 255 special skill effects. Your direction of 2026-10-27 went in here: Final Fantasy-style levels, leaving only by a floor's entrance or its end, a tower that is very hard alone, and turn-based fights.
- **Phase 4 — The playable slice.** Everything is on the phone now:
  - **New game** asks how death works (Mortal or Sheltered), then you make your hero.
  - **Emberfall** has nine places: the Waystone (floors with a threat chip), Blacksmith, Skill Hall, Curio Merchant (including the new Wayfarer Chest), Stables, Bank, Quest Board, Lantern Inn and the Ember Shrine.
  - The **hero screens** show status with the level bar, eleven gear slots with auto-equip, the skill columns and the AI rule, and the pet.
  - The **delve** is a 3D grey-box room with simple shapes for heroes and monsters, plus the map, the light meter and the floor clock.
  - The **fight screen** is turn-based. It shows who acts next, the skills, Flee with its chance, Auto, and 1×, 2× or 3× speed.
  - The **save** keeps three backups and can be downloaded or imported.
  - Your second direction, given during this phase, is built in: permanent death, raising the dead, a chosen hero plus wayfarers from a chest, legacies, and danger you can read.

## 2. Screenshots

All in `client/shots/` (landscape, phone size):

| File | What to look at |
|---|---|
| `title.png`, `title-death-rule.png` | The title with the version, and the Mortal / Sheltered choice New game asks first |
| `new-hero.png` | The selection: species cards with pros and cons |
| `town.png` | Emberfall's hub: nine places, the party strip, the last delve |
| `town-shrine.png` | The Ember Shrine: a dead wayfarer to raise or lay to rest, a legacy to give, the Memorial |
| `town-curio-wayfarer-odds.png` | Who the Wayfarer Chest can call, by grade, and how many are left |
| `town-waystone.png` | Floors with their threat chips |
| `town-inn.png` | The roster: Chosen, Wayfarer and Dead badges, the party of four |
| `hero-gear.png`, `hero-skills.png` | Eleven slots with wear pips; the three skill columns and the AI rule |
| `delve-room.png` | The 3D room, light meter, floor clock and map |
| `delve-fight.png`, `delve-fight-four.png` | The turn-based fight: whose turn, the strip of 8, the threat chip, the action bar |

## 3. Try this on your phone (10–15 minutes)

1. Open the installed app (or the link above). If a small "Update ready" note appears, tap it. The title should show **v0.4.0 · Phase 4**.
2. Tap **New game**. A box asks **How should death work?** Tap **Mortal**. *You should see the new-hero screen.*
3. Make a hero: species → **Next** → class → **Next** → (three skills are picked) **Next** → an egg → **Next** → points and name → **Next** → **Create hero**. *You should land in Emberfall at dusk with nine places.*
4. Tap **Waystone**. *Floor 1 shows a threat chip.* Tap **Enter**. *You should see a 3D room, a light meter and floor clock, and a small map.*
5. Tap a neighbouring room on the map. When a fight starts and the banner says **Your turn**, tap a skill, then an enemy. Try **2×** and **Auto**. *Faster creatures appear more often in the strip.*
6. In an easy fight tap **Flee** once. *The box shows your chance.* Tap **Stay and fight**.
7. Leave from the room you started in (**Walk out to town**) or at the stairs (**Teleport out to town**), then **Back to Emberfall**. *The hub card says what happened.*
8. **Blacksmith → Repair all.** *The wear pips refill and gold goes down.*
9. **Curio Merchant →** the Wayfarer Chest's **Odds**. *You should see who could join you.* Buy one when you have the gold.
10. **Lantern Inn.** *Your roster, the party of up to four, the badges.*
11. **Ember Shrine.** *If a hero died and was carried home: Raise (gold and two levels) or Lay to rest (half their experience goes to another hero).*
12. Tap a hero in the hub: **Gear → Auto-equip**, then **Skills**. *The AI rule reads back in plain words.*
13. Push to a floor marked **Dangerous** or **Deadly**. *The Waystone and the stairs warn that the dead stay dead.* (If your only hero dies, **Continue** offers a new hero who inherits part of the old one's experience.)
14. **Settings → Save → Download.** *A file named gloamvault-save-….json downloads.*
15. Close the app fully and reopen it. *Continue shows your heroes and "Mortal"; a delve in progress resumes where it was.*

## 4. Numbers from the runner (so you can judge, not guess)

From `docs/balance/2026-10-27-phase4-mortal.md` and `…-phase4-sheltered.md` (100 delves per recipe, the Cellars floors 1–3 in one trip, Normal). "Fresh" heroes are level 1 with the class kit.

| Measure | Target | Mortal | Sheltered |
|---|---|---|---|
| A fresh solo hero clears the Cellars | 0–10% | 0% (lost for good in 89% of first full trips) | 0% |
| A solo hero at level 12 with D gear | 40–85% | 52% | 52% |
| A fresh party of four (Warden, Blade, Mender, Arcanist) | 40–75% | **57%** | 88% |
| Fresh three-hero parties (the crypt-breakers / the glass cannons) | 15–55% / 0–40% | 40% / 6% | 47% / 11% |
| A fresh pair (Blade, Mender) | 5–40% | 35% | 40% |
| Levelled parties (level 5, E gear) | 55–100% | 71–86% | 73–93% |
| Delves that lose a hero for good | (your call) | fresh parties of three: 23–40% · the pair: 38% · levelled: 4–5% | none |
| An ordinary fight | 3–6 rounds | 2.7–4.3 | same |
| An elite fight | 6–8 rounds | 4.2–5.9 (short) | same |
| A boss fight | 10–15 rounds | 8.8–14.2 | same |
| Weapon wear per delve | 25–35% | 8–18% (low) | same |
| The repair bill against a delve's gold | 15–35% of R | 21–42% | same |

What the numbers say:
- **The tower is as hard as you asked.** A fresh solo hero never clears the Cellars and, under Mortal, is lost in most first full trips. A solo hero who has ground to level 12 with D gear clears about half the time. A fresh party of four clears 57% under Mortal, inside the 40–75% target. Levelled parties clear 71–86% and lose a hero for good in about 1 delve in 20.
- **Still off target, for Phase 7:**
  - Elite fights end in 4–6 rounds (target 6–8).
  - Weapons wear 8–18% a delve (target 25–35).
  - A party that clears brings home about 1.4–1.7 R of gold (target about 1 R).
  - The Arcanist and Mender out-damage the Ranger at level 1.

## 5. Decisions I made this segment (Proposed — please accept, change, or say "you decide")

Ids are from `docs/13-DECISIONS.md`. My recommendation is **keep**, unless it says otherwise.

- **Your direction, turned into rules** (the direction is yours; the numbers are mine):
  - **D-082:** levels from battle XP, shared among the heroes standing. *Keep shared.* It is what makes a solo hero level faster per fight, the "you can solo, but it takes grinding" you described.
  - **D-083:** walk out at the entrance, teleport out at a floor's end; the Waystone remembers the deepest floor.
  - **D-084:** the difficulty targets. The party-unlock part is replaced by D-091.
  - **D-085:** turn-based as built, and 8 floors (see §6).
  - **D-088:** Mortal and Sheltered. Settings can lower Mortal, never raise it. The Lantern Inn's bearers bring home a lost party's gear and pets.
  - **D-089:** a level-10 healer can raise the dead in the dungeon for 1 level; the Shrine can for gold and 2 levels.
  - **D-090:** one chosen hero at a time; a lost hero leaves half their battle XP as a legacy.
  - **D-091:** the Wayfarer Chest at 1.2 R calls one of 18 named wayfarers, graded D–A. They arrive at your weakest hero's level, and the Inn holds 12.
  - **D-092:** the threat bands, and the flee chance on the button.
- **Combat:**
  - D-027 (the Ultimate has its own button) · D-029 (heavy casts are charged) · D-047 (the Grab rule) · D-050 · D-060 / D-079 (the AI-rule grammar).
  - D-062 · D-077 (status timing; a status gained on your own turn skips that turn's count) · D-080 (party scaling gains a damage line) · D-081 (a boss's crew flees when it dies).
  - D-093 (fixes found while building):
    - A missed attack carries no status.
    - All heroes down is a wipe, even if a pet wins the fight.
    - Weapons go in the off hand where `08` says so.
    - Starter passives now work.
    - Skills check their equipment: a shield, a bow, two weapons.
    - Found secret doors work both ways.
- **Progression and economy:**
  - D-037 (+1 permanent Luck per final boss) · D-051 · D-056 · D-057 · D-065 · D-067 · D-069.
  - D-030 (chests cap at band A).
  - D-072 (the Grand chest follows `08` §10).
  - D-087: the purse is at risk in a delve, the bank never is, and found gear always comes home.
- **Exploration and dungeons:**
  - D-034 (encounter draws) · D-038 (the 3-room tutorial floor) · D-045 (monster roles and the 12 elite affixes).
  - D-058 · D-059 · D-064 · D-066 · D-076 (the Cellars).
  - D-078 (`06`'s monster numbers, not mine).
- **Content:**
  - D-028 (monster techniques at 10% per witnessed use) · D-032 (species readings) · D-033 · D-036 · D-046 · D-063.
  - D-070 (Tiers I–III now, IV–V in Phase 7) · D-071 / D-086 (how special effects plug in) · D-073–D-075 (class, species and item readings).
- **Tech and screens:**
  - D-048 · D-049 · D-052 · D-053 · D-054 · D-055 · D-068.
  - D-094: the screens as built. The version is 0.<phase>.0, so the title tells you which build your phone runs.

## 6. Questions for you (from the docs' Open questions)

Each has my recommendation; "you decide" is always a fine answer. The full list is `docs/13-DECISIONS.md` §D.

1. **Gravehollow at 8 floors** (D-085)? The plan would be Cellars 1–3, Crypts 4–6 and the Drowned Vault 7–8, with the Hollow King on 8. *Recommend yes*: it matches your "maybe 8 floors", and Phase 7 builds it that way.
2. **Mortal and Sheltered**: are the names right, and should Settings be allowed to lower Mortal? *Recommend keep both.*
3. **When a whole party dies under Mortal**, should their gear and pets come home with the bearers (as built) or be lost too? *Recommend keep as built.* Losing upgraded gear as well as the heroes would erase weeks of work in one fight.
4. **The raise costs** (D-089): a healer at level 10 for 1 level; the Shrine for gold and 2 levels. *Recommend playing before changing.*
5. **The legacy at 50%** of the lost hero's battle XP (D-090)? *Recommend keep.*
6. **The Wayfarer Chest** (D-091): is 1.2 R about right (after roughly one good delve)? Should wayfarers arrive at your weakest hero's level? Are 18 named wayfarers enough? *Recommend keep for now and grow the cast with each dungeon.*
7. **The threat bands** (D-092): Deadly at 4 or more levels above the party? *Recommend keep.*
8. **Battle XP shared or whole** (D-082)? *Recommend shared* (see §5).
9. **Should a fresh party of four clear the Cellars about half the time under Mortal** (57%)? *Recommend yes*: the first boss is a wall you climb with levels.
10. **Delve length:** one zone per trip (as now), or the whole dungeon? *Recommend one zone*: the Waystone remembers your floor.
11. **+1 permanent Luck** for each final boss's first kill, up to +4 (D-037)? *Recommend yes.*
12. **The names**: Gloamvault, Emberfall, Gravehollow Keep, the six classes, the species' words, Mother Cendra and the Ember Shrine? *Recommend keep, unless one grates.*

## 7. Known issues and what the next segment does

- **Known issues:**
  - Everything you see is a placeholder shape; real characters and monsters come in Phase 5–6.
  - There is no sound yet (Phase 8).
  - Elites end early, weapons wear slowly, and gold runs high (see §4).
  - About 20 delve-side special effects are documented but not yet wired (ammo, corridor skills, pocketed traps, foraging).
  - Doorways cannot be tapped in the 3D view; you move from the map.
  - The Quest Board shows contracts but does not track them yet.
- **Segment 2 (Phases 5–8):**
  - **5:** the characters built in Blender on a shared rig.
  - **6:** the dungeon rooms and monsters in 3D.
  - **7:** Gravehollow complete (8 floors, if you agree), Tiers IV–V, the Mender's raise skills, the Grand Wayfarer Chest, and the balance pass across both death rules.
  - **8:** polish, sound and juice.

## James's answers

(leave blank; James fills in here or in chat)
