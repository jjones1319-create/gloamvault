# Segment 2 review — 2026-10-29

*Written by Claude Code at the end of Segment 2 (Phases 5–8). James: play the checklist in §3, then answer the questions in §6 by pasting the Feedback prompt from `PROMPT.md` (or write under "James's answers" at the bottom). Every answer gets logged in `docs/13-DECISIONS.md` before Segment 3 starts.*

## 1. What was built (one paragraph per phase)

- **Phase 5 — Characters in Blender.** Your heroes are real 3D characters now. Every hero shares one skeleton and comes in two body frames (broad and slight). The six species are shape changes plus parts: a Dwarf is short and wide with a beard, an Orc is big and green with tusks, a Draconid has horns, a crest and a tail. Each of the six classes has its own armour set in a crude look (grades F–C) and a fine look (B and up). There are 46 weapons and 20 animations (walk, run, attacks, casting, shooting, guarding, being downed, victory …). The title has a **Character viewer**, a hero's screen has **View in 3D**, and making a hero has a **Look** step. Link: https://jjones1319-create.github.io/gloamvault/
- **Phase 6 — The dungeon in 3D and the monsters.** The grey boxes became real rooms: four room kits (shared, the Cellars, the Crypts, the Drowned Vault) built from about 130 pieces, with shading baked into the stone, torches and fog. Fourteen monster families cover every monster, hunter and boss of Gravehollow; they walk into fights, attack, flinch and fade when they die. Hits, heals and the six classes' Ultimates have effects. The title's **Monsters & rooms** button opens a gallery of every monster and all 30 rooms.
- **Phase 7 — Gravehollow complete, systems complete.** The whole tower is playable:
  - **The tower:** the Cellars (floors 1–3, Captain Vexa Marrow), the Crypts (4–6, the Barrow Warden) and the Drowned Vault (7, Sister Naesa; 8, the Hollow King), with 25 new monsters, 24 curios, 18 traps and 9 secrets.
  - **Boss arenas:** each boss fights with its own rules — lanterns that go out, a rising tide, candles, braziers you relight with a Torch. Every big attack shows a two-word warning the turn before ("Netter reloading").
  - **New systems:**
    - Tier IV skills (Tier V is designed but locked until Segment 3), learning moves by watching monsters use them, and Skill Tomes you can read.
    - Gear up to grade S, five sets whose bonuses now work, relics and chest keys.
    - The twelve Pacts with Hard and Dread difficulties, and the Quest Board's daily and weekly contracts.
    - Pets whose traits grow, and arrows that run out.
- **Phase 8 — Polish and juice.**
  - **Sound:** eleven original pieces of music (Emberfall's town waltz, each zone's exploring and fight music, a theme for each boss), short musical cues for victory, defeat and level-ups, about 76 sound effects, background sound for each area, and Settings → Sound.
  - **Your first floor is a guided lesson**, with tips you can skip or replay.
  - **Information:**
    - Tap any number on a hero to see what it means.
    - The Status tab shows how close each stat and skill is to growing.
    - A **Codex** lists every monster you've met and every material you've found.
    - A weekly reminder suggests saving a backup.
  - **Accessibility:** text up to 130%, two colour-blind palettes, and Reduce motion everywhere.
  - **Smoother fights:** fights no longer stutter at the start; the game was rebuilding its graphics mid-fight.
  - **Look:** a new app icon and start screen.
  - **Balance:** a final pass puts every clear-rate target inside its range.

## 2. Screenshots

All in `client/shots/` (landscape, phone size):

| File | What to look at |
|---|---|
| `viewer-dwarf-warden-F.png`, `viewer-orc-blade-S.png` | Phase 5's heroes: a Dwarf Warden in crude gear, an Orc Blade in fine gear |
| `matrix-idle-S.png` | All six species × six classes side by side |
| `room-cry-t-chapel.png`, `room-vlt-t-sluice-hall.png` | A Crypts room and a Vault room with their monsters |
| `monsters-crypts.png`, `monsters-vault.png` | The gallery's monster lineups |
| `delve-crypts-fight-perf.png`, `delve-vault-fight-perf.png` | Real fights in the Crypts and the Vault (the green numbers are the speed overlay) |
| `boss-naesa-perf.png`, `boss-king-perf.png` | Sister Naesa and the Hollow King in their arenas: the arena line, a warning chip |
| `lesson-floor.png` | The first floor's lesson, with a tip |
| `codex.png`, `hero-status-growth.png` | The Codex; a hero's "How they grow" lines |
| `settings-largest.png`, `delve-fight-largest.png`, `delve-fight-redgreen.png` | The biggest text size, and the red–green-safe colours, in Settings and in a fight |
| `fx-sheet.png` | The effects: sparks, element marks, heals and the six Ultimates |

Blender's review renders are in `art/review/` (contact sheets, lineups and 200-pixel "phone reads").

## 3. Try this on your phone (15–20 minutes)

1. Open the installed app (or the link above). If a small "Update ready" note appears, tap it. The title should show **v0.8.0 · Phase 8**. *Tap the screen: Emberfall's music starts.*
2. Tap **Character viewer**. Turn the hero by dragging; try the **Species**, **Class**, **Gear** and **Clip** buttons. *Each species and class looks different; the hero moves without going through its armour.*
3. Back on the title, tap **Monsters & rooms**, then **Rooms**, and **Next ›** through all 30 rooms. *The Cellars, the Crypts (green candlelight) and the Drowned Vault (water, the Hollow King on his throne).*
4. Start a **New game** (Mortal). Make a hero — the **Look** step has a live 3D preview. *In town a tip points to the Waystone; your first floor is a short lesson with a tip at each step.*
5. In a fight: *the fight music starts; sparks on hits; a two-word warning the turn before a big attack; winning plays a short tune.*
6. Back in town, open a hero's **Status** tab and tap any number. *A tip explains it.* Scroll to **How they grow**.
7. Tap **Codex**. *Monsters you've met with a 3D model; their weaknesses and attacks.*
8. At the **Waystone**, tick a Pact. *The Oath and the rewards change.* (Hard and Dread open once the Hollow King falls.)
9. Open the **Quest Board**. *Three daily contracts and a weekly with progress bars.* Claim one when it fills.
10. Play down past floor 3: *the Crypts, then the Drowned Vault — each with its own music.* After a boss you can teleport out and start the next delve on the floor below.
11. In a boss fight: *the arena line beside the enemy list (light, tide, braziers); when the light drops, use a **Torch** from Item.*
12. Settings → **Text size: Largest**, **Colours: Red–green safe**, **Reduce motion**, and **Sound** (sliders and Mute). *Everything stays readable; nothing is cut off.*
13. Settings → **Performance overlay** on, then a fight in the Crypts or the Vault. *Tell me the fps; the stutter at the start of fights should be gone.*
14. Put the app in the background mid-fight and come back. *The music paused; the fight is where you left it.*
15. **Settings → Save → Download**, then close the app fully and reopen it. *Continue shows your heroes; a delve in progress resumes.*

## 4. Numbers from the runner (so you can judge, not guess)

From `docs/balance/2026-10-29-segment2.md` (17,360 test delves; 100 per recipe; Normal; "Mortal" unless marked).

| Measure | Target | Now |
|---|---|---|
| A fresh solo hero clears the Cellars | 0–10% | 9% |
| A level-12 solo (D gear) clears the Cellars | 40–85% | 66% |
| A fresh classic four (Warden, Blade, Mender, Arcanist) clears the Cellars | 40–75% | 53% |
| A fresh pair clears the Cellars | 5–40% | 33% |
| Glass cannons (Arcanist, Shade, Ranger) clear the Cellars | 0–40% | 11% |
| The classic four arriving in the Crypts (L5) clears it | mirrors the Cellars | 62% |
| A ground solo clears the Crypts / Naesa's floor / the King's floor | 40–85% | 53% / 55% / 44% |
| The classic four on Naesa's floor / the King's floor | 40–75% | 55% / 50% |
| Clear-rate lines inside their targets | all | **96 of 96** |
| Boss fight length (rounds to kill, four heroes) | 10–15 | Vexa 16 · the Warden 11 · Naesa 11 · the King 13 |
| Deaths per floor arrival, by the threat chip | climb with danger | Easy 0.26 · Even 0.84 · Dangerous 1.02 · Deadly 1.59 |
| A careful player (turns back from Deadly) vs a textbook one | fewer deaths | 0.96 vs 1.20 deaths per delve |
| Gold per cleared delve inside its band | all lines | 100 of 100 |
| Under Nightmare, the classic four loses its chosen hero (Cellars) | — | 23% of first full trips |
| Dread, a strong four (L16, C gear) | not set yet | Cellars 96% · Crypts 19% · Vault 8% / 0% |

## 5. Decisions I made this segment (Proposed — please accept, change, or say "you decide")

All in `docs/13-DECISIONS.md` with the reasons; my recommendation for each group is to accept.

- **Characters and art (Phase 5):**
  - D-100: two body frames on one skeleton.
  - D-101: one draw call per hero (a colour palette instead of textures).
  - D-102: the skeleton fitted by script.
  - D-103: armour built from the body so it fits every species.
  - D-104: Gravehollow at 8 floors.
  - D-105: a hero's look in the save.
  - D-106–D-108: how the game dresses and animates heroes.
  - D-109: review renders kept small.
- **Dungeon and monsters (Phase 6):**
  - D-110: rooms from kit pieces with baked shading.
  - D-111: fourteen monster families, variants as data.
  - D-112: effects drawn in code.
  - D-113: the three-zone check moved to Phase 7.
  - D-114–D-116: how kits, monsters, rooms and fights are built and drawn (the Charnel Hulk a little smaller, so the Barrow Warden stays the biggest).
  - D-117: the later dungeons' pets come with their dungeons.
- **Gravehollow and systems (Phase 7):**
  - D-118: rules bugs fixed (monsters' row attacks hit their own side; most Cellars monsters used one attack; hidden traps never sprang).
  - D-119: Tier IV–V, learning techniques, Tomes, the class-damage pass.
  - D-120: items to S, sets, relics, keys.
  - D-121: floors 4–8.
  - D-122: boss arenas (no boss can lock a party out; warnings the turn before).
  - D-123: Pacts, Hard/Dread, contracts, pet growth, arrows.
  - D-124: the test runner's careful player.
  - D-125: the Vault's pets.
  - D-126: save version 4.
  - D-127: a frozen hero can't be frozen again before acting.
  - D-128: bosses scale by party size.
  - D-129: the game data gets its own size budget.
- **Polish (Phase 8):**
  - D-130: sound and music.
  - D-131: the lesson, tips, growth lines, the Codex, backups, and updates that wait for town.
  - D-132: accessibility, the performance fix, the icon.
  - D-133: the final balance pass (boss fights lengthened; a four's fight pays like a trio's).
  - D-134: bugs found. The big one: 3D models had never been kept for offline play.

## 6. Questions for you

From the roadmap's checkpoint 2:
1. **Do the characters look good enough, or should faces be commissioned?** Commissioning costs money, so I'd only arrange it with your yes. My view: they read well at phone size, and faces are the weakest part up close.
2. **Which classes feel best and worst to play?**
3. **Is durability and repair a chore?** (A delve costs about a quarter of a weapon's life; Repair all is one tap.)
4. **The Insight rate:** do new skills spark too often, too rarely, or about right?
5. **Chest cadence:** enough chests and keys, or too few?
6. **How do Nightmare (D-095) and the party-average XP (D-096) feel?**

New from this segment:
7. **Does any tune remind you of a song or a game you know?** Everything is written for this game; your ear is the last check.
8. **The Hollow King's throne camera.** He's fully visible but small (about 45 pixels) while seated far back. A dedicated camera for that one fight would fix it. My recommendation: yes, in Phase 10's boss pass.
9. **A party of four earns gold like a party of three** (D-133), so bigger parties don't out-earn solos. Keep it? My recommendation: keep.
10. **Bosses scale with party size on their own line** (D-128): a solo faces a weaker boss, a four a stronger one. Keep it? My recommendation: keep.
11. **The Drowned Vault is two bosses.** After Naesa you can go home and start the next delve on the King's floor (the tower remembers). Keep it as is? My recommendation: keep.
12. **The King's health.** He's ×9 now (the design said ×30, but at ×30 nobody could finish him). My recommendation: keep ×9.

Open since Segment 1:
13. **D-097:** you wrote "2 to 3 is less xp than 1 to 2". I built it as each level costing *more* (1→2 is the cheapest), which matches "It should take more exp to grow a level after each level". Confirm?
14. **Nightmare's details** (D-095): the chosen hero must lead every delve, the save's backups go too, and the Hall of Nightmares keeps a line.
15. **The Beast Tamer** keeps a whip and a short spear (its class sheet), not the wider list in the items doc.

The docs' smaller open questions — `07` Q9–Q23 (Pacts, traps, arenas) and `08` Q9–Q12 (items) — I'll decide unless you want a say.

## 7. Known issues and what the next segment does

- **Known issues:**
  - The Hollow King reads small on his throne (Q8).
  - At the largest text size the timeline's last chip is cut at the edge.
  - The Vault's elite fights run long for one or two heroes.
  - A few balance lines sit right on the edge of their target (a re-run can flip them).
  - Faces are plain up close, the creatures are smooth "clay", and chains, nets and tentacle tips don't sway.
  - Ten pets from the later dungeons are still simple shapes; they come with their dungeons.
  - Tier V skills are designed but locked.
- **Next segment (Phases 9–12):**
  - **Phase 9:** co-op over the internet (one phone hosts, friends join; the free Cloudflare account needs your one-time yes).
  - **Phase 10:** the Fungal Deep and Emberforge, two more dungeons.
  - **Phase 11:** the Beast Tamer, deeper pets, importing a Wildsong Ranch monster as a pet, and the endgame.
  - **Phase 12:** release (v1.0).

## James's answers

(leave blank; James fills in here or in chat)
