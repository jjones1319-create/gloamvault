# 03 — Game Design (the rulebook)

*Last updated 2026-10-28 · rev. 8a (Phase 7, pass A: §7 as built — Tiers IV–V in the content with Tier V locked, monster techniques learned by witnessing and certain by the 10th, the Insight pity kept on the hero, Skill Tomes as items read in town, the second starter kits) · rev. 8 (Phase 7, pass D: as built — §8.3 chest keys from the Quest Board and the presets' and Pacts' chest shift, §8.4 Dunmore buys parts and stocks arrows, §9 traits grow by use and at most 3 summons, §12.3 the Iron Oath and §12.6 Hard and Dread) · rev. 7 (Phase 7 prep: Gravehollow's 8 floors written in — the band levels in §11.2; a merchant on the floor before every boss floor and the Boss on each boss floor in §4.6, §8 and §11.1; the global floor ranges in §6.2; a delve of 2–4 floors in §1; no hunter clock in the Drowned Vault in §4.5 — D-104) · rev. 6 (checkpoint 1: the open questions of §1–§11 answered by delegation — D-099) · rev. 5 (checkpoint 1, James's answers: **Nightmare**, the third death rule; battle XP split through the party and scaled by the level gap to the party's average; each level costs more; every open question answered by delegation; the Nightmare difficulty preset renamed Dread — D-095–D-099; §2.2, §5, §11.2, §12, §13) · rev. 4 (James's direction during Phase 4: the Mortal and Sheltered death rules, raising the dead, the chosen hero and legacies, party members from the Wayfarer Chest, the threat read — D-088–D-093; §5.3, §8.2, §8.3, §10.3–§10.4, §12, §13) · rev. 3 (James's direction of 2026-10-27: Final Fantasy-style levels, leaving by the entrance or a floor's end, a very difficult tower best taken with a party, turn-based combat — D-082–D-085; and the Phase 3 balance pass, D-077–D-084) · rev. 2 (Claude, from James's brief of 2026-10-26 and the three research reports in `docs/research/`; rev. 2 after the independent review — ownership table, status table, promotion counts, First Aid, Pacts). Every number in this document is a **tuning starting point**, never a commitment; the simulator and the balance runner decide the final values. Each section ends with **Open questions** for James.*

**Who owns what (when two docs disagree, the owner wins and the other is fixed):**

| Fact | Owner |
|---|---|
| Rules, formulas, the status table, grades, slots, ladders, learning paths, death, co-op pacing | this file (`03`) |
| A class's skills (names, numbers, techniques it can learn), its attribute modifiers, armor family, weapons, starter picks | `docs/classes/<class>.md` (`04` is the index) |
| A species' modifiers, traits, restrictions, body brief | `05-SPECIES.md` |
| Monsters, hunters, bosses (phases, attacks, first-kill drops), encounter tables, monster techniques (which monster teaches which sheet skill), pets, every creature name in every dungeon | `06-MONSTERS.md` |
| Places: the overworld, floors, kits, room templates, curios, traps, secrets, boss **arenas** (room, arena rule, adds timing, tells, light), presets, Pacts, contracts, the generator | `07-DUNGEONS.md` |
| Items (every number), starter kits, affixes, sets, uniques, God items, materials and promotion costs, durability constants, chest odds, loot tables | `08-ITEMS.md` |
| Field skills' rank effects | `09-SKILLS.md` §5 |
| Stack, budgets, file layout | `10-TECH-PLAN.md` |

Content JSON is written from the owner. Where this file restates an owned fact it is a summary; if the summary and the owner disagree, fix the summary.

**How to read this file.** §1 is the loop. §2 the stats (the same eight attributes as Project Ascend, re-pointed at a dungeon). §3 combat on the speed timeline. §4 exploring a floor. §5 how everything levels with use. §6 equipment: slots, the nine grades F → God, durability, materials. §7 skills and how they are learned. §8 the town economy and chests. §9 pets. §10 playing together. §11 dungeons, floors and bosses (the rules; the content is `07-DUNGEONS.md` and `06-MONSTERS.md`). §12 death and difficulty. §13 the first thirty minutes.

---

## 1. Core loop

**Gloamvault** is a party dungeon crawler: you make a hero (species + class), descend into a dungeon floor by floor with up to three friends, fight monsters on a speed-driven timeline, find gold, gear and materials, and come back up to the town of **Emberfall** to repair, upgrade, learn, and buy chests. Everything you use gets better: your skills, your stats, your weapons, your pet.

```
TOWN (Emberfall) ──► choose dungeon & zone at the Waystone ──► DELVE (2–4 floors)
  ▲  repair · upgrade · learn skills · open chests · stables · bank      │
  │                                                                      │
  └──────────── return by Waystone (or wipe: lose unbanked gold) ◄───────┘
```

- **A delve** is one trip: a zone of 2–4 floors ending in its boss (Gravehollow's zones are 3, 3 and 2 floors — D-098), 20–40 minutes, pausable at any room. A floor is 5–10 minutes — the mobile session unit (GameAnalytics 2025: median session 5–6 min).
- **A dungeon** is a tower of floors in three zones (Gravehollow: **8 floors**, D-098), each zone with its own monster family, its own boss, and a **Waystone** that lets you start the next delve from that zone once its boss is dead. The final boss sits on the last floor. Beating it opens the next dungeon on the overworld map.
- **Gold** is found only in the dungeon and spent only in town. It is the stake: a party wipe loses the gold carried in that delve, never your gear, XP or skills.
- **Four verbs** carry the game: *Delve* (explore and fight), *Tend* (repair, upgrade, feed the pet), *Learn* (skills by use, by shop, by Insight), *Open* (chests).

**Pillars** (from `01-VISION.md`): 1. *Stats you can feel* — faster means more turns, perception means fewer ambushes. 2. *Everything grows by use.* 3. *Care for your things.* 4. *Better together, fine alone.* 5. *Readable on a phone.*

**Open questions**
1. ~~Delve length: 3–4 floors per delve (recommended) or whole-dungeon runs with Waystones only at zone bosses? *Proposed: zones of 3–4 floors; a party can keep going past a zone boss without returning (the Waystone is optional).*~~ *Checkpoint 1 (D-098): a delve is one zone — Gravehollow's F1–3, F4–6 or F7–8 — ending at its boss, and the Waystone remembers the deepest floor finished so the next delve can start below it (D-083).*

---

## 2. Characters: attributes and derived stats

A hero is **species × class × what you have done**. Species sets the body and the starting attribute shape; class sets the kit, the weapons and armor; use does the rest.

### 2.1 The eight attributes (Project Ascend's, re-pointed at a dungeon)

Attributes are integers. **10 is an ordinary adult**; heroes start between 6 and 15 by species and class; 30 is heroic; 50+ is legendary. Every attribute has **one headline effect you can feel**, then minor effects. They grow by use (§5), never by placing points after creation.

| Attribute | Headline (what you feel) | Minor effects | How it trains (§5.2) |
|---|---|---|---|
| **Strength** | physical Attack (melee and bows) | carry capacity; cancels heavy-armor and heavy-weapon speed penalties; door/chest forcing | land melee hits; carry over 50% capacity; force things |
| **Agility** | **Speed → more turns, sooner** | Dodge, ranged accuracy, trap-disarm speed | attack, dodge, disarm |
| **Vitality** | HP | bleed/poison resistance, HP regen at rests | take damage; survive at low HP |
| **Endurance** | Defense and the **Stamina** pool (physical classes) | block value, armor wear slows, exhaustion resistance | take hits (armor-absorbed counts); block; march under load |
| **Wisdom** | spell Attack, healing, and the **Mana** pool (casting classes) | **learning rate** (skill XP and Insight chance), identify items | cast; heal; read; identify |
| **Perception** | **ambush chance down, traps/secrets/treasure found** | Accuracy, Crit Rate, first-strike, scouting adjacent rooms | find traps/secrets/treasure; scout; land crits |
| **Willpower** | Resistance to status and mental effects | Momentum gain, concentration (casts are not interrupted), Fear resistance | resist a status; hold a cast under a hit; stand against Fear |
| **Luck** | Crit Rate and **loot quality** | damage variance floor, Fortune (free skill), pity luck | **not trainable** (a trainable Luck is a grind magnet); only species, gear and blessings move it |

**Why these eight and not seven.** James asked for the stats "like the ones in this folder" — Project Ascend's eight. The systems research proposed Charisma for shop prices; here that job goes to the **Haggling** field skill (§7.6), which levels by use like everything else, so the attribute list stays Ascend's.

### 2.2 Derived stats (what the card shows)

Starting formulas at an ordinary adult (all 10s) with no gear. The sim owns these; the card shows the result.

| Derived | Formula (starting point) | At all 10s | Bound |
|---|---|---|---|
| **HP** | 30 + 7 × Vit + 3 × Level | 103 at L1 | — |
| **Attack (phys)** | weaponAttack + 2 × Str (Str above the weapon's requirement counts double) | weapon + 20 | — |
| **Attack (spell)** | focusPower + 2 × Wis | focus + 20 | — |
| **Defense** | armorDefense + 1 × End; damage taken × 100 / (100 + Def) | armor + 10 | diminishing by formula |
| **Speed** | 100 + 5 × (Agi − 10) − armorPenalty − weaponPenalty + Str relief | 100 | floor 40, cap 300 |
| **Stamina** (physical classes) | 30 + 3 × End; regen 10%/own turn; a basic attack restores 15% | 60 | — |
| **Mana** (casting classes) | 30 + 3 × Wis; regen 8%/own turn; a basic attack restores 10% | 60 | — |
| **Momentum** (0–100) | +20 when you act, +10 when hit, +5 per ally action; × (1 + 1% × (Will − 10)); Ultimate costs 100 | — | — |
| **Crit Rate** | 5% + 40 × x / (x + 80), x = (Per − 10) + (Luck − 10), min 0 | 5% | cap 45% |
| **Crit Damage** | 150% + 2% × (Per − 10) + 2% × (Str or Wis − 10) | 150% | — |
| **Accuracy** | 90% + 1% × (Per − 10) | 90% | 50%–100% |
| **Dodge** | 30 × y / (y + 60), y = (Agi − 10) + 0.5 × (Luck − 10), min 0 | 0% | cap 30% |
| **Resistance** | 40 × z / (z + 50), z = (Will − 10) + 0.5 × (End − 10) | 0% | cap 40% |
| **Detection** | Per + light bonus + skill/pet bonuses (compared with a trap's or secret's difficulty) | 10 | — |
| **Variance** | damage × U(floor, 1.05); floor = 0.90 + 0.01 × (Luck − 10) | 0.90–1.05 | floor ≤ 1.00 |
| **Fortune** | chance a skill costs nothing: 0.5% × Luck | 5% | cap 25% |
| **Carry** | 20 + 3 × Str kg; each 10% over capacity = −10% Speed | 50 kg | — |

- **Hit** = roll < Accuracy − targetDodge (never below 50%); Ultimates and most AoE never miss.
- **Damage** = Attack × skillMultiplier × (1 + Σ bonuses) × elementMod × 100 / (100 + effectiveDefense) × critMod × variance. Same shape as Ascend §4.3 so the two sims stay cousins.
- **Levels (Final Fantasy style, D-082 — James, 2026-10-27).** A hero's **level** comes from **battle XP**: the heroes standing at the end of a won fight **split** its XP equally, and each monster's XP is scaled by the **level gap** between that monster and the **party's average level** (D-096 — James, checkpoint 1: ×2 for a monster 5 levels above the party, ×0.25 for one 5 below; §5.1). Level N costs 60 × 1.28^(N−2) battle XP — **each level costs more than the one before** (D-097: L1→2 60, 2→3 77, 3→4 98, L9→10 432; `tuning.json` → `xp.heroLevel`). Each level-up adds **+1 to the class's bonus attributes in turn** (the Blade: Str, Agi, Str …) and **+1 Vitality on every even level**, plus the HP line above (+3 per level). Level unlocks skill tiers (§7.2) and sets the soft caps (§5.3). Skills, attributes, items and pets **still grow by use** (§5): the level is the second road, not a replacement. *(Rev. 2's "level = total skill ranks ÷ 8" is superseded.)*

### 2.3 Creation

Name · species (`05-SPECIES.md`) · class (`04-CLASSES.md`, `docs/classes/`) · appearance (skin, hair, eyes, a face preset — tints on the species body, see `11-ART-PIPELINE.md`) · **6 free attribute points** placed at creation (max +3 to any one) · a starter kit of F-grade gear in the class's armor family · one F-grade pet egg chosen from three.

Starting attributes = 10 + species modifiers + class modifiers + free points (`05-SPECIES.md` §2, `04-CLASSES.md` §2). A total of **92** across the eight (80 base + 4 class + 2 species net + 6 free).

### 2.4 The card

Species · class · level · the eight attributes with a small "+" when one grew this delve · derived stats · the four active skills + two passives equipped (§7.3) · pet and stance · eleven gear slots with wear pips (§6) · titles · AI rule (one gambit line, used when you are AFK or delegate — §10.3).

**Open questions**
1. ~~Six free creation points (recommended) or none at all, pure species + class?~~ *Checkpoint 1 (D-099): six points, as built (creation total 92, D-044).*
2. ~~Should Luck have *any* training path (e.g., +1 per dungeon final boss first-kill)? *Proposed: a permanent +1 Luck per dungeon's final boss first kill, capped at +4.*~~ *Checkpoint 1 (D-098, D-037): yes — +1 permanent Luck for each dungeon's final boss first kill, up to +4.*

---

## 3. Combat: the speed timeline

### 3.1 Who acts when — the accumulator

- Every actor (heroes, pets, monsters) has an **energy accumulator**. Each tick it gains its Speed; at **1,000** it acts, and the action's **weight** is subtracted: *light* 800 (daggers, quick skills), *normal* 1,000, *heavy* 1,400 (two-handers, big spells). So Speed 150 acts 1.5× as often as Speed 100, and a dagger user with Speed 150 against a greatsword user with Speed 100 gets **2.6 actions for every one** — "faster means more attacks" literally (ToME / Caves of Qud / DCSS lineage).
- Each cost carries **±10% seeded jitter** (Caves of Qud's rule) so order is not a lockstep.
- Haste × 1.5 Speed, Slow × 0.67. A heavy hit on an actor who is **charging** a cast pushes its accumulator back 300 (Grandia's cancel) unless its Willpower concentration check passes (§2.1).
- **The timeline strip** shows the next 8 actors in order, so waiting is planning (FFX's CTB window).
- An encounter begins with an **initiative roll**: everyone starts at a random 0–400; an *ambushed* side starts at 0 while the other side starts with +500 (§4.4).

**Why a timeline, not rounds (Ascend uses rounds).** Ascend's PvP needed predictable rounds; this game's brief says speed should mean *more* attacks, which only an energy queue makes literally true, and co-op needs grouped decision windows (§10.2) that a queue gives naturally. Logged as D-004.

### 3.2 Resources and actions

| Resource | Rule |
|---|---|
| HP | 0 = **downed** (§12.1) |
| Stamina / Mana | one pool per hero by class family; skills cost pool; regen at the start of your own turn; basic attacks restore some |
| Momentum | fills by acting and being hit; the class **Ultimate** costs 100 and no pool; never misses |
| Action | **Basic** (free; weapon weight) · **Skill** (pool cost; its own weight) · **Ultimate** (100 Momentum) · **Guard** (half damage until your next turn, +10 Momentum, restores 10% pool; weight 600) · **Item** (potion, kit, torch; weight 600) · **Swap row** (weight 400) · **Flee** (party vote, §12.1) |
| Pet stance | changing stance is free once per fight (§9) |

### 3.3 Rows and reach

Two rows per side: **Front** and **Back**. Melee hits the front row unless the front row is empty or the skill says *reach/flank*; bows, thrown weapons and spells hit either row. Front-row heroes take the hits; back-row heroes are safe until the front falls. A hero's row is set in the formation screen and can be swapped for a cheap action. Enemies have the same rows; a monster family's taxonomy (§11.3) says who stands where.

### 3.4 Damage types and elements

- **Physical:** Slash, Pierce, Blunt — armor materials have a weak type (Mail is weak to Blunt, Plate to Pierce at the joints, Hide to Slash; `08-ITEMS.md`).
- **Elements:** Fire, Frost, Lightning, Poison, Holy, Shadow. Every monster has resistances (×0.5), weaknesses (×1.5) and sometimes immunity (×0). Elemental marks: Fire → *Burn* (DoT), Frost → *Chill* (−Speed) → *Freeze* on a second application, Lightning → *Shock* (−Accuracy, chains), Poison → *Poison* (DoT, ignores armor), Holy → *Smite* (bonus vs Undead/Shadow), Shadow → *Wither* (−healing).

### 3.5 Status effects

The sim owns these in `content/statuses/<id>.json`, written from this table (starting numbers). Durations count down at the holder's turn end; DoTs and HoTs tick at the holder's turn start. **Every debuff has a cleanse and every buff has a strip**, so support skills matter. Re-applying refreshes duration; stacking statuses add a stack up to their cap.

| Status | Kind | Starting rule | Duration | Stacks | Notes |
|---|---|---|---|---|---|
| **Bleed** | DoT (physical, ignores Defense) | 25% of the applying hit's damage per turn | 3 | 3 | cleansed by Bandage/First Aid; Undead and constructs immune |
| **Poison** | DoT (ignores Defense) | 3% of max HP per turn | 4 | 5 | Antidote; Dwarf +30% resist; constructs immune |
| **Burn** | DoT (Fire) | 20% of the applying hit's damage per turn | 3 | 3 | removed by Chill; Draconid immune |
| **Chill** | debuff (Frost) | Speed ×0.75 | 3 | — | a second application becomes **Freeze** |
| **Freeze** | control (Frost) | cannot act (energy −1,000); the next physical hit deals ×1.5 and ends it | 1 | — | bosses: Chill only |
| **Shock** | debuff (Lightning) | Accuracy −15%; 50% of the hit chains to one other enemy | 2 | — | wet targets (Vault) +1 turn |
| **Stun** | control | skip the next action (energy −1,000) | 1 | — | bosses take **Daze** instead |
| **Daze** | control | energy −500 | — | — | instant |
| **Blind** | debuff | Accuracy −30% | 2 | — | |
| **Silence** | control | no skills or Ultimate; basic attacks and items only | 2 | — | |
| **Taunt** | control | must target the taunter | 2 | — | bosses: phase 1 only |
| **Shield** | buff | absorbs X damage (the skill sets X) | 3 or until broken | — | |
| **Regen** | HoT | +X% max HP per turn (the skill sets X, Tier I ≈ 5%) | 3 | — | halved by Wither |
| **Haste** | buff | Speed ×1.5 | 3 | — | strip removes |
| **Slow** | debuff | Speed ×0.67 | 3 | — | |
| **Weaken** | debuff | Attack −20% | 3 | — | |
| **Fortify** | buff | Defense +20% | 3 | — | |
| **Mark** | debuff | damage taken +20% | 3 | — | Rangers' and Beast Tamers' signature |
| **Fear** | control | 50% chance to Guard instead of acting | 2 | — | Orc Intimidating +20% duration; Will resists |
| **Grab / Net** | control (the co-op disabler, §11.3) | cannot act until the grabber takes ≥ 10% of its HP or an ally spends a free action to free | until freed | — | Stonefoot and Huge immune |
| **Root** | control | cannot swap rows or flee | 2 | — | Dwarf immune |
| **Web** | control | Root + Speed −30% | 2 | — | burned off by Fire |
| **Curse** | debuff | all attributes −10% | 3 | — | Holy Water, Mender cleanse |
| **Petrify** | control | energy −1,000; Defense +50% while petrified | 1 | — | bosses immune |
| **Smite** | mark (Holy) | damage taken +20% (+40% if Undead or Shadow) | 2 | — | the Holy element's mark |
| **Wither** | mark (Shadow) | healing received −50% | 3 | — | the Shadow element's mark |
| **Veil** | state (Shade only) | the next single-target attack against the Veiled hero misses; ends when the Shade attacks | until used | — | Ultimates, AoE and DoTs ignore it |

Elite affixes (`06` §2) are not statuses; they are rules on the monster.

### 3.6 Length, pacing, auto

- Target **3–6 "rounds"** (a round = every living hero has acted once) for ordinary fights; elites 6–8; bosses 10–15 with phases. Hard cap 30 rounds (the fight ends as a retreat).
- Animation budget: an action resolves in ≤ 1.5 s at 1×; 2× and 3× speed toggles; "skip to result" when every hero is on auto.
- **Auto:** each hero carries one **AI rule** line (a gambit: *IF ally HP < 40% THEN Skill 2 on lowest ally; ELSE basic attack nearest*). Auto uses it; so does a disconnected or timed-out player's hero (§10.2). The same scripted policies drive the balance runner.

**Open questions**
1. ~~Weights 800 / 1,000 / 1,400 and jitter ±10% — tune on the sim; is ±10% enough for the order to feel alive?~~ *Checkpoint 1 (D-099): keep 800 / 1,000 / 1,400 and ±10%, as built; the runner and James's play at checkpoint 2 decide any change.*
2. ~~Should Guard also parry (reflect 10%) for shield users? *Proposed: a Warden passive, not a global rule.*~~ *Checkpoint 1 (D-099): a Warden passive, not a global rule — Spiked Rim (Tier II) reflects 15% on a block, as built.*

---

## 4. Exploring a floor

### 4.1 The party moves as one

A floor is a **graph of 8–14 rooms** (§11.1; the first-ever floor is a shorter fixed tutorial and the final throne floor is fixed — `07` owns each floor's count). The party stands in one room; the room is a 3D set piece with a fixed cinematic camera; the doors you can take are lit. Pick a door → the party walks through (a short real-time walk, interruptible by what is found) → the next room resolves: a fight, a trap, a curio, a treasure, a rest, a merchant, the stairs, the boss. No joystick, no one gets lost, and every move is one command — which is what makes co-op and testing cheap (D-005).

The **minimap** shows explored rooms; **scouting** (§4.3) may reveal what is behind the next doors; secret doors appear when found. The **floor clock** (§4.5) ticks per room entered.

### 4.2 Light

One dial, read at a glance (Darkest Dungeon's torch, re-tuned). Light 0–100 falls **−5 per new room** (−1 per revisited room); a Torch item restores +25; braziers in some rooms restore +15; some curios and all boss rooms set it.

| Band | Light | Scouting | Heroes ambushed | Monsters ambushed | Extra loot | Monster Accuracy / Damage | Species note |
|---|---|---|---|---|---|---|---|
| Radiant | 76–100 | +15% | — | +20% | — | — | — |
| Dim | 51–75 | +5% | +5% | +10% | +10% | — | — |
| Shadowy | 26–50 | — | +15% | — | +25% | +5% / +5% | Dwarf & Elf see one band brighter |
| Dark | 1–25 | −10% | +25% | — | +50% | +10% / +10% | Orc & Draconid unaffected on Accuracy |
| Pitch | 0 | −20% | +40% | — | +75% and a rare-slot roll | +10% / +20% | — |

Push your luck: darkness pays in loot and costs in ambushes. Dwarves and Elves (darkvision) read one band brighter for their own rolls.

### 4.3 Perception: traps, secrets, treasure, scouting

**Detection** = Perception + light bonus + skills + pet (§2.2). Passive, never a "search" button (Shattered PD / NetHack auto-search lesson):

- **Traps** have a difficulty 8–60 by floor band. On entering a room, every trap whose difficulty ≤ the party's **best** Detection is revealed; a revealed trap can be **disarmed** (Trap Disarm field skill: chance = 50% + 2% × (skill − difficulty/2), fail = it triggers on the disarmer at half damage) or walked around (some block a door). An unrevealed trap triggers on the hero with the lowest Perception.
- **Secret doors** are revealed when best Detection ≥ difficulty; they lead to secret rooms that **reward, never gate** (extra treasure, a shrine, a shortcut). About 25% of floors have one; Shades and Rangers raise that.
- **Hidden treasure** (a niche, a false floor): same check plus a *find* roll = 60 × (Det − 10) / (Det + 30) %.
- **Scouting:** on entering a room, chance 25% (+light bonus, +5% per Ranger, +pet Forage) to reveal the contents of all adjacent rooms. A critical scout (half of successes) also reveals the room beyond.

### 4.4 Ambush

Each encounter rolls **surprise**: base 15% + light band modifier (§4.2) + monster family modifier (ambushers +15%) − the party's best Perception bonus (Per 10 → 0, Per 20 → −10%, Per 30 → −15%, rational curve 20 × (Per − 10) / (Per + 10)). *Ambushed* = enemies start at +500 energy and heroes at 0; the first enemy action lands before anyone can react. The reverse roll — the party surprising the monsters — uses the same curve on the party's lowest Speed penalty and gives heroes +500. Orcs are noisy (+5% to be ambushed); Shades in the party −5%.

### 4.5 The floor clock, and the hunter

No hunger (DCSS removed food as featuritis; Darkest Dungeon's hunger was tolerated, not loved). Instead a visible **floor clock**: it ticks once per room entered and once per fight round. At **40 ticks** a floor's **hunter** (a unique stalking monster of that family, e.g. Gravehollow's *Warden's Hound*) enters the floor and moves one room toward the party every 2 ticks; it is beatable but above the floor's band, and it drops a guaranteed rare part. Taking the stairs ends the chase (Barony's Minotaur, made fair and visible). No hunter stalks a boss floor (open question 1, D-055), so Gravehollow's Drowned Vault — both of whose floors carry a boss — has none on the clock (`07` §2.9).

### 4.6 Rooms and curios

Room kinds and their weights per floor (§11.1): Fight 50% · Elite 8% · Rest/campfire 10% · Merchant 5% · Treasure 7% · Curio 15% · Trap gauntlet 5%; fixed: Entry, Stairs, and on a boss floor the Boss (each zone's last floor, and both of the Drowned Vault's). **Curios** are interactable objects with a choice (a sealed sarcophagus: open / leave / use a Holy Water — outcomes from a table; Darkest Dungeon's curios, with the item key that turns a gamble into a purchase). **Rest rooms** restore 30% HP and pool, let you swap loadouts and feed the pet; one per floor; sleeping advances the floor clock 5.

**Open questions**
1. ~~Torch −5 per new room and 40-tick hunter — tune on the generator; should the hunter also stalk on boss floors? *Proposed: no hunter on boss floors.*~~ *Checkpoint 1 (D-055): keep −5 a room and the hunter at 40 ticks, with no hunter on boss floors, as built.*
2. ~~Should there be a hard inventory limit per delve (Etrian's cap, which forces trips home) or only the carry-weight speed penalty? *Proposed: weight penalty only, plus a 40-slot bag.*~~ *Checkpoint 1 (D-055): no hard limit — the carry-weight penalty plus a 40-slot bag, as built.*

---

## 5. Everything levels with use

### 5.1 The one rule that prevents grinding exploits

XP is granted only for **meaningful actions**: an action that resolves against a hostile at or above your **gate** (enemy level ≥ your level − 10), or resolves a dungeon event (trap, lock, curio, treasure). Hitting allies, walls, corpses, empty tiles; casting with no target; re-using a resolved curio — **zero**. (Every Elder Scrolls exploit comes from rewarding the action instead of the challenge; UO, Kenshi and DCSS show the fixes — `docs/research/…systems…` §2.)

**Difficulty curve D** (Kenshi/UO shape): the gain is multiplied by D(enemyLevel − yourLevel): 0.1× at −10 or lower · 1.0× at 0 · 2.0× at +5 · **3.0× cap at +10**. Fighting above your weight is the fast route.

**Battle XP and the level gap (D-096 — James, checkpoint 1).** James: *"Experience is split though the party and level disparity give more or less experience so if you beat an enemy 5 levels higher you get a lot of experience multiplier 5 lower you get diminished. If you have a party it is the average level of the party that decides the multiplier so weaker members do help with experience but it takes longer to grind them up."* The XP that fills the level bar (§2.2) follows its own curve. A won fight's **XP pool** is the sum, over its defeated monsters, of each monster's XP (`06`: xp class × the level's XP unit) × the **level-gap multiplier** of that monster's level against the **party's level** — the average of the heroes who fought, rounded down: the same two numbers the threat chip compares (§12.6), so a monster's level here counts +1 per champion affix and +3 for a boss or the hunter. The pool × 3 (the encounter table's party size) is **split equally among the heroes standing** at the end; Wisdom and the Human bonus apply to each share; a pet takes half its owner's share by participation (§9).

| Monster level − party level | −10 or lower | −5 | 0 | +5 | +10 or higher |
|---|---|---|---|---|---|
| Battle-XP multiplier | ×0.05 | ×0.25 | ×1.0 | ×2.0 | ×3.0 |

Linear between the columns (−2 → ×0.70, +2 → ×1.40, +4 → ×1.80; `tuning.json` → `xp.heroLevel.levelGap`). A weaker hero lowers the party's average, so the whole party earns more from the same fight; they take an equal share, though, not the multiplier they would earn alone against those monsters, so a low-level wayfarer catches up steadily rather than at once. The **D curve above** still drives skills, attributes and items, which grow by use against the enemy in front of each hero.

**Per-delve use budget** (UO's rate-over-time, per delve rather than per clock): per skill, the first 20 meaningful uses pay full, uses 21–60 pay 50%, later uses 10%. It resets in town.

### 5.2 Skills, attributes, items

| What | Earns from | Growth | Cap |
|---|---|---|---|
| **Skill rank** (1–10 per skill) | each meaningful use: 10 × D | rank N needs 100 × 1.5^(N−1) XP; each rank +4% effect, −2% cost; rank 10 unlocks the skill's **Mastery** line (`09-SKILLS.md`) | — |
| **Attributes** | tagged actions (§2.1), 1 × D per tag; Vitality from damage taken (per 10% of max HP) | point N needs 20 × 1.12^(N−10) XP (point 20 ≈ 62, point 30 ≈ 193, point 40 ≈ 600) | soft cap = creation value + 2 × Level; above it gains are ÷4 |
| **Weapon / armor instance** (item level 1–10) | hits landed (weapons) or absorbed (armor, shield blocks) on gated enemies: 2 × D | +2% own base per level; at levels 3 / 6 / 9 an **affinity** line: +5% vs the family it has fought most (never decreases — no weapon-swap grind); level 10 = **Awakened**: eligible for promotion with full XP carried (§6.5) or salvage into a successor at 60% | per grade |
| **Pet** | 50% of the owner's fight XP by participation + its stance's tagged actions | `09` §9 | owner's level |
| **Field skills** (§7.6) | each successful use: lockpick, disarm, forage, repair, haggle, first aid, cook, map | same rank curve | — |

**Hero level** = battle XP (§2.2, D-082: Final Fantasy style). The results screen reads like a status screen: *"Level 4! +1 Strength · +1 Vitality · Blade Dance → rank 4 · +1 Agility · Longsword → Lv 3 (affinity: Undead)"*.

### 5.3 Co-op fairness and death

- Kill credit is by **participation** (damage, healing, buffs, tanking) never last hit; budgets are per player.
- **Under Sheltered, death never costs XP** (Valheim's 5% is its most-hated rule); death costs durability (§6.4) and unbanked gold (§12.2). **Under Mortal** (D-088, James), the dead stay dead: a raise costs levels (§12.4) and a hero lost for good leaves a legacy of half their battle XP (§12.5). **Under Nightmare** (D-095, James) the chosen hero's death ends the save (§12.0).
- Wisdom raises all XP by 1% per point above 10 (the learning stat); the Human species adds +10%.

**Open questions**
1. ~~Rank curve 100 × 1.5^(N−1) (rank 10 ≈ 3,800 XP ≈ 380 full-value uses) — right length for a 40-hour game?~~ *Checkpoint 1 (D-099): keep it, as built (D-056: rank 10 at 3,844 XP ≈ 384 full uses); the runner and Segment 2's play judge the length.*
2. ~~Should attributes also get a tiny trickle from *any* kill (so the status screen moves every fight)? *Proposed: +0.2 to the class's two affinity attributes per gated kill.*~~ *Checkpoint 1 (D-055): yes — +0.2 to the class's two affinity attributes per gated kill, as built.*

---

## 6. Equipment

### 6.1 Slots (Ascend's eleven, plus the pet)

| Slot | Main stat | Lock | Visible on the body |
|---|---|---|---|
| **Main Hand** | Attack | class weapon types | yes — weapon mesh on the hand bone |
| **Off Hand** | Attack (second weapon) · Block/Defense (shield) · spell Attack (focus) | class | yes |
| **Helmet** | HP / Resistance | armor family | yes |
| **Chest** | Defense / HP | armor family | yes |
| **Legs** | Defense / Speed | armor family | yes |
| **Boots** | Speed / Dodge | armor family | yes |
| **Gloves** | Crit / Accuracy | armor family | yes |
| **Ring ×2** | any one derived stat | universal | yes (small) |
| **Talisman** | Resistance / Momentum gain / Detection | universal | yes — neck or belt |
| **Relic** | an **active** effect, once per fight (Ascend's Treasure) | universal | yes — belt or back |
| **Pet** | — | the hero's pet (§9) | yes — follows the hero |

- **The hand rule:** a two-handed weapon (greatsword, maul, longbow, staff) fills both hands and carries two slots' budget; one-handed leaves the off hand for a shield, a focus, or a second weapon (Shade's paired daggers). Equal budget, different shape.
- **Armor families** (which is also the material ladder, §6.5): **Plate** (metal; Warden), **Mail** (metal; Blade, Beast Tamer), **Leather** (hide; Ranger, Shade), **Robes** (cloth; Arcanist, Mender). Shields and bows/staves are wood + metal.
- **Requirements:** heavy gear has a Strength requirement; below it, each missing point costs −5 Speed; above it, each spare point relieves the family's speed penalty (Plate −20, Mail −10, Leather −3, Robes 0).
- Gear belongs to the player's **armory**; swapping between a player's heroes is free in town. "Auto-equip best" is one tap.

### 6.2 The nine grades: F → God

Grade is *what the item is*; +N and item level are *what you did to it* (every system that works keeps those axes apart — D4, PoE, Monster Hunter, Souls).

| Grade | Colour | Name | Base × | Affix slots | Max +N | Where it comes from |
|---|---|---|---|---|---|---|
| **F** | grey | Crude | 1.00 | 0 | +3 | floors 1–3, starter kits, shop |
| **E** | white | Common | 1.35 | 1 | +4 | floors 1–6, shop |
| **D** | green | Fine | 1.80 | 1 | +5 | floors 4–8, shop |
| **C** | blue | Superior | 2.45 | 2 | +6 | floors 7–13, shop (last grade shops sell) |
| **B** | purple | Masterwork | 3.30 | 2 | +7 | floors 10–20, chests |
| **A** | orange | Heroic | 4.45 | 3 | +8 | floors 16–28, chests, zone bosses |
| **S** | red | Legendary | 6.00 | 3 | +9 | floors 24–38, Grand chests, final bosses |
| **SS** | gold | Mythic | 8.10 | 4 | +10 | floors 33+, endgame bosses, pity only |
| **God** | white-gold, animated | Divine | 11.0 | 4 + a **unique power** | +10 | endgame bosses and **Divine Shards** (10 forge one); never in a random table |

- *Floors* in the table are global floors: Gravehollow's 8, then each later dungeon's in order (`08`'s R table; D-104).
- ×1.35 per grade is an 11× spread over nine steps — enough for four dungeons without six-digit numbers.
- **+N** costs gold and generic stones (Whetstone F–C, Honing Oil B–A, Star Grit S–God) and adds **+5% of the item's own base per level**, so a +10 A-grade (×1.5) beats a +0 S (×1.35) and loses to a +3 S — a cared-for weapon is a real choice against a fresh find. +N never adds affix lines.
- **Affixes** roll from the pool in `08-ITEMS.md` §5 (attribute points, derived stats, element damage, on-hit effects, "+10% gold found"). One line can be locked and the rest re-rolled at the blacksmith for gold and a stone.
- **Drop shape** per floor band: centre grade 56% · one below 25% · one above 14% · two above 4% · three above 1%; Luck shifts +0.5 pp per point above 10 toward higher grades (cap +15 pp). God never rolls.
- **Sets:** 2-piece and 4-piece bonuses on the five armor pieces and the ring pair, themed by family and class (`08-ITEMS.md` §6).
- **Named uniques:** each grade from B up has a few named pieces with a fixed signature line; **God** items are one per slot at launch (eleven), each boss-bound or forged from ten Divine Shards.

### 6.3 Weapon types and classes

Swords (1h, Slash) · Greatswords (2h, Slash) · Axes (1h/2h, Slash, +crit dmg) · Maces/Mauls (Blunt, vs Mail) · Spears (Pierce, reach: hits the back row from the front) · Daggers (Pierce, light weight 800, dual) · Bows (Pierce, 2h, either row) · Crossbows (Pierce, heavy 1,400, high base) · Staves (2h, spell focus, +Mana) · Wands (1h, spell focus, light) · Censers (Mender: a 1h Blunt main-hand weapon that also counts as a spell focus) · Holy symbols (Mender off-hand focus) · Whips (Beast Tamer, reach) · Shields (off hand: Block = chance to halve a physical hit; Bucklers light, Tower heavy). `04-CLASSES.md` lists each class's allowed types.

### 6.4 Durability: care for your things

Two numbers per item: **durability** 0–100% and **maxDurability** (starts 100; erodes only with neglect).

- **Wear:** weapons lose 1% per *k* meaningful hits; armor per hit taken (weighted Chest 3, Helmet 2, Legs 2, Boots 1, Gloves 1 — Diablo 2's weights); shields on blocks. Spells and arrows do not wear the weapon (D2 rule; bows wear on draw at half rate). *k* is tuned so a fully used item spends **25–35% per delve** at its band — about three delves from full to broken with no care. Each material grade multiplies *k* by 1.25 (so a Skysteel blade lasts ~3× a Copper one).
- **Stat bands, no sudden death:** 100–60% full effect · 60–20% linear falloff to −30% stats (weapons also −10% Accuracy) · 20–1% **Damaged**: −50% and a red pip · **0% Broken**: 0 stats, still equipped, never destroyed by wear. The pip on the slot icon is green / amber / red; a toast at 20%.
- **Neglect erodes the ceiling:** each time an item **reaches 0**, maxDurability drops 5, permanently (so a maxDurability 100 item survives twenty neglect cycles). At maxDurability 0 the item is **destroyed into salvage** (§6.5) with warnings at 20 and 10. A careful player never sees it; a careless one loses the thing they neglected — which is the brief.
- **Repair:** town blacksmith **"Repair all"** — one tap, 0.5% of item value per point (a delve's gold covers a full party repair with ≥ 70% left) · **Repair Kit** (common drop, shop item): +25% to one item out of combat · **Field Repair** skill (§7.6): +10% to one item at a rest room for one material unit. Repair never lowers maxDurability.
- **Death:** every equipped item takes an extra **−10%** on a party wipe (D3). That, plus unbanked gold, is the whole death penalty.
- Pets have no durability; their equivalent is being downed (§9).

### 6.5 Materials: upgrade what you have

An armor piece's **material is its grade**. Upgrading it with the next material **promotes** it one grade: same item, same affixes (one line re-rolls), item XP and affinities kept, +N resets to +0 (Minecraft's Netherite logic: the item you cared for is the item you keep). Weapons promote through the metal/wood ladders the same way. **Promotion is deterministic** — fixed material count, fixed gold, no failure roll: chance never touches crafting.

| Grade | Metal (weapons, Plate, Mail) | Hide (Leather) | Cloth (Robes) | Wood (bows, staves, shields) |
|---|---|---|---|---|
| F | Copper | Rawhide | Burlap | Pine |
| E | Bronze | Leather | Linen | Ash |
| D | Iron | Boiled Leather | Wool | Oak |
| C | Steel | Wolf Hide | Silk | Yew |
| B | Blacksteel | Wyvern Hide | Glyphweave | Ironwood |
| A | Skysteel | Basilisk Scale | Moonweave | Ebony |
| S | Adamantine | Drake Scale | Phoenix Weave | Elderwood |
| SS | Orichalcum | **Dragon Scale** | Voidcloth | World-tree Bough |
| God | Starmetal | Ancient Dragon Scale | Celestial Thread | Godwood |

- **Counts per promotion**: F→E 6 · E→D 8 · D→C 10 · C→B 12 · B→A 16 · A→S 20 · S→SS 30 · SS→God 50 units, plus gold = 25% of the target grade's value; forging a fresh F piece at the blacksmith costs 4 units (D-031 accepted).
- **Where materials come from:** every monster family maps to one material family and a floor band (`06-MONSTERS.md` §1). A kill rolls a **common part** (35%) and a **rare part** (4%, an affix stone or a special); a **part break** in combat (hit a marked limb) doubles the rare roll; bosses drop a **guaranteed stack** (5–10 units) and a rare part on first kill. Dragons (SS) drop 1–3 scales *guaranteed*. Material Crates (§8.3) and the blacksmith's weekly stock fill the gaps. Each dungeon picks one of two **regional variants** per grade (Steel / Bluesteel; Silk / Spidersilk) with identical numbers — Terraria's pairs, variety for free.
- **Salvage:** any item → 25% of its promotion cost in its own material; an item destroyed by neglect salvages at 50%. Dupes from chests auto-salvage.
- **Generic stones** for +N are a separate drop family (§6.2).

**Open questions**
1. ~~Dragon Scale at SS with Ancient Dragon Scale at God (recommended) — or should dragon scale be the very top?~~ *Checkpoint 1 (D-099): as recommended — Dragon Scale at SS, Ancient Dragon Scale at God (D-010).*
2. ~~25–35% wear per delve (≈3 delves to broken) — too harsh for a phone? The sim reports "delves to broken" per item.~~ *Checkpoint 1 (D-099): not too harsh — keep the target, since Repair all is one tap; the short Cellars delves wear about 8–18% today, and the runner tunes toward the target on the full tower in Phase 7.*
3. ~~Should promotion keep +N instead of resetting it? *Proposed: reset, with the stones refunded at 50%.*~~ *Checkpoint 1 (D-055): reset, with the stones refunded at 50%, as built.*

---

## 7. Skills

### 7.1 The shape of a class's list

Each class has **45 skills**: three **schools** × five **tiers** × three skills per tier. Tier is fixed; **rank** 1–10 grows by use (§5.2). A school is a way of playing the class (the Warden: *Bulwark* · *Vanguard* · *Warcry*). Each Tier N skill has **one prerequisite** at Tier N−1 in its school, so the skill screen is three readable columns, not a web. Every class also has one **Ultimate** (Momentum 100) at Tier III and a handful of **monster techniques** (§7.5). The lists live in `docs/classes/<class>.md` and `content/skills/<class>/<id>.json`; `09-SKILLS.md` is the index and the rules.

### 7.2 Tiers and when they open

| Tier | Opens at level | How you get it |
|---|---|---|
| I | 1 | Skill Hall (gold), Insight, starter picks (3 at creation) |
| II | 5 | Skill Hall (gold), Insight |
| III | 12 | Skill Hall (gold), Insight; the Ultimate is here |
| IV | 20 | **Insight only**, boss Tomes, Skill Chests — never sold |
| V | 30 | endgame bosses and Divine Shards only (written in the content since Phase 7, locked until Segment 3 — D-099) |

### 7.3 Loadout

**4 active skills + 2 passives + 1 pet stance** (between Guild Wars' eight and Darkest Dungeon's four; four buttons fit a thumb). Swapping is free in town and at rest rooms. A skill you have not equipped still keeps its rank.

### 7.4 Learning, path A — the Skill Hall (deterministic)

Town sells Tiers I–III for gold. Prices in units of **R** (median gold from one delve at the player's band, §8.1): Tier I 0.1 R · II 0.3 R · III 1.0 R, +20% per purchase within a tier, capped at ×3 (Guild Wars). Tier IV is never sold.

### 7.5 Learning, path B — Insight (random, in the dungeon)

After a meaningful use of a school-X skill, roll an **Insight** for one tier-adjacent skill of X whose prerequisite you have:

```
chance = 4% × S(enemyLevel − targetTier × 6) × (1 + 1% × (Wis − 10))
S = 1.0 at 0 · 0.5 at ±3 · 0.25 at ±6 · 0 beyond ±10        (SaGa's spark curve, flattened)
pity: one guaranteed Insight per 60 qualifying uses
```

An Insight teaches **that player** and drops a **Skill Tome** of that skill into the **party's** loot — a spark is personal, the party gets a tradeable copy (SaGa's "moves to the dojo"). Fighting the *right* enemy with the *right* school is therefore the strategy, not fighting the strongest thing. **Monster techniques** (a few Tier III–IV per class, e.g. the Blade's *Ghoul's Grasp*) can only Insight while that monster uses the move in the fight (FFV's Blue Magic).

Duplicate Tomes become rank XP for that skill (never dead loot). Tomes also come from bosses (guaranteed Tier III+ on first kill) and Skill Chests (§8.3).

*As built (Phase 7).* **Techniques** are learned only by witnessing: each use of the move in a won fight the hero stood in rolls a flat 10%, the 10th witnessed use is certain (D-028, D-099; `tuning.json` → `techniques`), the count is kept on the hero; the hero must be of the skill's class and know its prerequisite (the Mender sheet's worked example), and a learned technique drops no Tome (it is never sold and never in a Tome). **The Insight pity** (one per 60 qualifying uses) is counted on the hero across delves. **A Skill Tome is an item** — one def, the skill on the instance (`08` §4): an Insight drops a copy on the party's pile; a boss's, a curio's or a secret's Tome is drawn from the bag of a random hero's class for the tier; a Skill Tome chest puts one in the armory. A hero of the skill's class **reads** it in town: an unknown skill is learned at rank 1, a known one gains a full rank's XP (`skills.tomes.duplicateRanks`); a mastered skill cannot read it. Tomes are banked and sold at the Skill Hall's price of their tier (Tier IV at 3 R). No Tier V, technique, field, pet or monster skill is ever a Tome.

### 7.6 Field skills (universal, every class)

Eight non-combat skills, all level-by-use, all shown on the card: **Lockpicking** (chests, doors; Shade bonus) · **Trap Disarm** (Ranger bonus) · **Foraging** (torches, herbs, cooking ingredients in rest rooms) · **Field Repair** (§6.4; Dwarf bonus) · **First Aid** (revive a downed ally out of combat at any rank; from rank 5 also in combat as a weight-1,000 action; bandages Bleed; Mender bonus) · **Haggling** (shop prices: 130% − 1% per rank → floor 85%; sell 40% + 0.5%/rank) · **Cooking** (rest-room meals: +5% to a stat for the next floor) · **Cartography** (the minimap reveals one extra ring of rooms per 3 ranks). Rank effects are owned by `09-SKILLS.md` §5; class and species starting bonuses by the class sheets and `05`.

**Open questions**
1. ~~4 + 2 loadout (recommended) vs 5 + 2?~~ *Checkpoint 1 (D-027): 4 + 2, with the Ultimate on its own button.*
2. ~~Insight base 4% and pity at 60 uses — tune on the sim so a 40-floor game yields roughly 60% of a class's Tier IV skills.~~ *Checkpoint 1 (D-099): keep 4% and the pity at 60, as built; the runner measures the Tier IV yield when Tier IV ships in Phase 7 and tunes the numbers, not the formula.*
3. ~~Should Tier V exist at launch or be the first content patch? *Proposed: designed now, built in Segment 3.*~~ *Checkpoint 1 (D-099): at launch — from endgame bosses and Divine Shards, built in Segment 3.*

---

## 8. Economy: gold, town, chests

### 8.1 Gold

Found in the dungeon only: on monsters, in treasure rooms, in curios, from selling parts and gear. **R** = the median gold one delve yields at the player's band; the runner tunes R, prices are written in R so the economy keeps its shape when R moves. Starting point: R ≈ 300 at floors 1–3, ×1.6 per band.

- Gold carried in a delve is **unbanked** until you return to town; a wipe loses it (§12.2). The **Bank** also lets you deposit *before* a delve so a run starts "insured" — the only protection from the death rule.
- A delve, after a full repair, should leave about **one Standard chest** of gold; a Grand chest every three delves (Hades' 1.5-rooms-per-boon cadence, stretched to delves).

### 8.2 Emberfall (the town)

| Building | What it does |
|---|---|
| **Blacksmith** (Hesper Vane) | Repair all · material promotion (§6.5) · +N with stones · affix lock-and-re-roll · salvage · weekly material stock (F–C only) |
| **Skill Hall** (Master Orrin) | sells Tier I–III skills; shows each school as a column; "Recommended loadout" per school |
| **Curio Merchant** (Mab) | the chest vendor (§8.3); odds and pity on screen |
| **Stables** (Tomas Reed) | hatch eggs, bond, stance training, treats; later the **Ranch Shrine** that imports Wildsong Ranch monsters (`14-IDEAS.md`) |
| **Bank** | deposit/withdraw gold; the delve's "insurance" |
| **Quest Board** | daily/weekly contracts (kill X of family Y, clear floor Z with light ≥ 50) paying gold and chest keys |
| **The Lantern Inn** | rest (free full heal), save, the roster (up to 12 heroes) and the party of four, the AI-rule editor, party lobby and invite codes (§10); **Choose a new hero** when the chosen hero is gone (§12.5) |
| **The Ember Shrine** (Mother Cendra) | raise the dead carried home, for gold and two levels; lay them to rest and pass their legacy on; the Memorial of the lost (§12.4–§12.5, D-089–D-090) |
| **Waystone** | choose dungeon → zone → start a delve; the overworld map (`07-DUNGEONS.md` §1) |

### 8.3 Chests (gold only — no real money anywhere)

| Chest | Standard (0.5 R) | Grand (2.5 R) | Contents |
|---|---|---|---|
| **Gear Chest** — Weapon / Armor / Trinket | one item | one item, one grade up | slot-targeted: choose the sub-type so dupes halve |
| **Pet Egg** | 1.5 R | 6 R | one egg of the band's species pool (§9) |
| **Material Crate** | 0.3 R | 1.2 R | a stack of your band's material + a 10% rare part |
| **Skill Tome** | 0.8 R | 3 R | one Tome of your class from a **bag without replacement** per tier (Marvel Snap's rule) — Standard draws Tier I–III, Grand Tier II–IV |
| **Wayfarer Chest** | 1.2 R | — | a sealed writ that calls one **wayfarer** of the cast to the Lantern Inn: a new party member (§10.4, D-091); odds by grade on the Odds sheet; a wayfarer already with you is never drawn |

- **Odds** (Standard Gear Chest at band B): B 56% · A 25% · S 14% · SS 5% · God 0%. Grand chests use the table in `08` §10 (one grade up, plus a **Divine Shard** line). Band-relative, so a chest never sells an outgrown item.
- **Pity, two layers:** (1) a ≥ +1-grade item within every 10 Standard chests and a ≥ +2 within 40 (Hearthstone's shape), counters **shown**; (2) Tomes draw from a bag, so a class's Tier III list completes in a known number of chests.
- **Dupes:** gear → salvage; pet → +1 **bond star** (to 5, +5% pet stats each); Tome → rank XP.
- **Transparency:** every chest has an **Odds** button with the exact table, the pity counters and the Tome bag's remaining contents. No stamina, no timers, no purchases: nothing here is bought with money, which closes the Google Play loot-box question before it opens (`10-TECH-PLAN.md` §8).
- **In-dungeon chests** follow Slay the Spire: Small 75% centre / 25% +1; Large 0 / 75 / 25; a locked chest needs Lockpicking or a **Skeleton Key** (a Perception find, or 0.2 R in town), which also makes a trapped chest safe (Darkest Dungeon's key rule).
- *As built (Phase 7):* the delve's preset and Pacts move every in-dungeon chest (`07` §6): Hard's +10 points and the Pacts' chest rewards shift points from a chest's lowest line one grade up, Dread and an Oath of 12 raise its centre a grade, an Oath of 6 adds 10 points; Every Door Locked locks a chest that would be open 30% of the time. The Quest Board pays **Standard and Grand Keys** (`07` §7), counted with the materials, at most 3 Standard and 1 Grand a week; a key opens a chest of its tier at the Curio Merchant free (pass B).

### 8.4 Dungeon shops

A wandering merchant appears in one Merchant room per floor (always on the floor before a boss floor — Gravehollow's F2, F5, F6 and F7, `07` §2.7): potions, torches, repair kits, a few F–C pieces at 1.5× town price, and he buys parts. Haggling applies.

*As built (Phase 7):* he **buys parts** — a merchant room offers to sell each material the delve found, all of it, at 40% + 0.5% of its value per the party's best Haggling rank (Pedlar's Friend counts the parts sold, `07` §7). His stock carries **arrows and bolts** (pass C1); a stack bought or found goes into the quiver of the hero whose bow or crossbow draws it (`08` §4, D-099: a bow spends an arrow a shot, Repair all refills the quiver).

**Open questions**
1. ~~R ≈ 300 at floors 1–3 — set by the runner once monsters carry gold values.~~ *Checkpoint 1 (D-099): R stays 300 at the Cellars band, ×1.6 per band (`tuning.json` → `economy.R`); Phase 4's runner finds about 150–460 gold per delve around it.*
2. ~~Should daily contracts exist at launch (a reason to come back) or wait for Segment 3? *Proposed: a simple board in Segment 2.*~~ *Checkpoint 1 (D-099): yes — the Quest Board already offers the Cellars' contracts (Phase 4); the daily and weekly rotation goes live in Phase 7 (Segment 2).*

---

## 9. Pets

One pet per player, always present — in solo and in co-op (Monster Hunter's online rule; never Diablo 3's "followers are solo-only").

- **A timeline actor**: its own Speed, HP, one action per turn, auto-resolved — no menu, so eight actors keep a human cadence.
- **Stances** are the whole control surface (set between fights or as a free action once per fight): **Fierce** (attack the owner's target) · **Guard** (intercept 30% of hits aimed at the owner; taunt small enemies) · **Mend** (heal/cleanse the lowest ally for a small amount) · **Forage** (no attacks; adds its Perception to scouting, trap reveals and treasure finds, and +10% gold).
- **Kit:** one bloodline **trait** (+10% gold found · ambushes −15% · +5 Detection …) and **two actives** unlocked at pet levels 5 and 15 from the species' list, fed by a **stamina** pool that refills between fights (Temtem's rule: the best move cannot be spammed).
- **Downed, never dead:** at 0 HP the pet retreats for the fight and returns at 50% next fight. No hunger, no lifespan (WoW removed happiness for a reason). "Care" is a **treat** once per delve for +10% pet XP — a bonus, never a penalty.
- **Grades:** the same nine; grade sets base stats (×1.35), how many actives (1 / 2 / 3 at F–C / B–A / S+) and trait strength. **Grade never changes** — a better pet is a new egg or a drop, so the pet hunt is a loot loop; breeding and fusion belong to **Wildsong Ranch**.
- **Leveling:** 50% of the owner's fight XP by participation (cap: owner's level), +2% stats per level; traits also grow **by use** (a Forage pet's Perception trait grows by finding things).
- **Species at launch:** ~16 in `06-MONSTERS.md` §9 (Cellar Hound, Ember Fox, Crypt Bat, Moss Tortoise, Brine Crab, Wisp …), each with two actives and a trait, drawn from the dungeon families so eggs feel of the place.
- **Wildsong Ranch import** (future, `14-IDEAS.md`): a Wildsong share code maps the monster's LIF/POW/INT/SKI/SPD/DEF onto the nearest grade's budget (never above **A** at import; SS/God are dungeon-only), tagged *Ranch-raised* with a unique trait slot. One-way; the ranch owns breeding.
- *As built (Phase 7) — traits grow by use:* the species' `trait.growsBy` tag names what counts (`tuning.json` → `pets.traitGrowth`): a Perception trait grows by what the party finds in a delve — traps revealed, secret doors, monsters caught unawares; ×2 while the pet forages — at 3 uses each; an Endurance or Vitality trait by the hits the pet takes; a Strength trait by the hits it lands; an Agility trait by its turns. Rank 2–5 need 30 / 90 / 200 / 400 uses, and each rank above 1 adds 10% to the trait's numbers (a Spiderling's +5 Detection is +7 at rank 5; a Cellar Hound's −15% ambush −21%). The traits' stat lines now work in fights too: a pet's own (a Brine Crab's Block) on itself, a party line (a Bone Pup's +5 Resistance) on every ally, the best single pet's per stat (D-069). The Stables and the pet card show the rank and the way to the next.
- *As built (Phase 7) — summons:* at most **3 summons** stand with the party at once (D-099; `pets.summonsPartyMax`); a call past the cap fizzles and a summoning skill greys out (the Beast Tamer's, Segment 3).

**Open questions**
1. ~~One pet per player in co-op (8 actors on the party side) — or a party cap of two pets? *Proposed: one each; the sim measures fight length with 4 + 4.*~~ *Checkpoint 1 (D-099): one each, no party cap — as built, every hero may bring one pet (wayfarers take theirs from the Stables, D-091), so a full party is 4 + 4, solo or in co-op; the runner watches fight length.*

---

## 10. Playing together (1–4)

### 10.1 The model

The sim is a pure, deterministic, integer function `step(state, command, rng) → state'` with a seeded RNG. One phone is the **host**; it sequences every command (door choice, action, stance, item) and broadcasts `{seq, command}`; every client — host included — applies commands only when received, in order. A match is **seed + command log**: replays, desync detection (state hash every N commands), save-and-resume, host migration and late rejoin all fall out of it. Messages are tens of bytes; latency is hidden by a game that already waits for decisions. Transport by phase: offline → WebRTC peer-to-peer → relay (`10-TECH-PLAN.md` §5).

### 10.2 Pacing rules

- **Grouped decision windows:** when the next ready actors on the timeline are allies, their owners decide **at the same time**; actions resolve in timeline order (Baldur's Gate 3's grouped turns — the documented cure for co-op idle time).
- **20-second timer** per decision; on expiry the hero runs its AI rule. A disconnected player's hero runs its AI rule until they return (90 s grace before "X dropped" is shown).
- **Doors:** any player may propose a door; the **leader** (rotates each floor; host by default) confirms; 15 s auto-confirms the proposal with the most taps.
- **Drop-in** at any room, never mid-fight; a joiner's hero arrives at the party's room.
- **Loot:** gold is split evenly at banking; items drop to a **shared pile** at the end of each fight with a round-robin **pick order** (the player with the lowest total item value picks first); materials and Tomes are duplicated for everyone (parts to all, Tomes to all) so nobody fights over consumables.

### 10.3 Solo

Solo is a party of one hero and one pet against encounters sized for the party count (§11.2). Nothing is gated behind co-op. A player who wants a party alone fills it with **wayfarers** from the Wayfarer Chest (§10.4); rev. 2's hired companions are superseded (D-091).

### 10.4 Party members: the chosen hero and wayfarers (D-090, D-091 — James, 2026-10-27)

James: *"I think the only way to get new party members is through the chests. You get your initial hero from selection … You keep all party members you got through chests and they continue to grow but can also die."*

- **The chosen hero** is made at the selection (§2.3) — the save's first hero, or a new one after the chosen hero is gone (§12.5).
- **Wayfarers** are named adventurers of a fixed cast (`content/wayfarers/`, the list in `04-CLASSES.md` §7): 18 in Segment 1, three per class across the six species, graded **D, C, B or A** (+1 creation point per grade above D). The **Wayfarer Chest** (1.2 R) rolls a grade (D 50 · C 30 · B 15 · A 5), then a wayfarer of that grade who is not already with you; a grade with nobody left re-rolls among the grades that have someone; pity as the egg chest, read from D (a C or better within 10 chests, a B or better within 40).
- A wayfarer arrives at the **level of your lowest-level living hero** with their class's starter kit, joins the party if it has room, and from then on is a hero in every way: levels (D-082), growth by use, gear, a pet from the Stables, death.
- The **Lantern Inn** holds up to **12** heroes; the party has **four** places from the start (no unlocks — D-084's schedule is superseded). Co-op (Segment 3) lets friends bring their heroes into the same four places.

**Open questions**
1. ~~Loot pick order vs. host decides vs. roll — pick order (recommended) is fair and needs no UI dialog.~~ *Checkpoint 1 (D-026): pick order by lowest total item value, as recommended and as in `tuning.json`.*
2. ~~Hired companions in solo — launch or later? *Proposed: Segment 3.*~~ *Checkpoint 1 (D-091): no hired companions — a solo player fills the party with wayfarers from the Wayfarer Chest.*

---

## 11. Dungeons, floors and bosses (the rules)

### 11.1 Floor generation

Seeded by the host's 64-bit match seed; integer-only; identical on every phone.

1. **Mission graph** (small grammar): Entry → … → Stairs, with a guaranteed path, 8–14 rooms (tutorial and throne floors excepted, `07` §2), up to 3 side branches, one Key-and-Lock pair on 30% of floors, a secret room on 25%. **Boss rooms are farthest from the entry by room count** (Darkest Dungeon's rule).
2. **Room kinds** by weight (§4.6) with fixed slots: Entry, Stairs, one Rest per floor, a Merchant on the floor before every boss floor, the Boss on each boss floor (a zone's last, and both of the Drowned Vault's — `07` §2.3); Elite rooms carry 1 affix on floors 1–2, 2 on 3–6, 3 on 7+ (Diablo 3's scaling) from a pool of 12 (`06-MONSTERS.md` §2).
3. **Layout** on a coarse grid from room templates (door sockets must meet; backtracking on collision), decorated by a tile-variation pass.
4. **Encounter tables** per floor band from the zone's family: 2–6 monsters sized by party count (§11.2) with at least one of each role across a floor (fodder / armored elite / disabler special / monster / boss — Vermintide's taxonomy keeps every co-op role relevant).

### 11.2 Scaling

- **Monster level** = floor band level. Gravehollow's eight (`07` §2.3 owns them; D-104, Proposed for the runner): **F1 L1 · F2 L2 · F3 L4 · F4 L5 · F5 L7 · F6 L8 · F7 L11 · F8 L13** — rev. 2's ten floors ran L1–14; dungeon 2 starts at L12, one level under the Hollow King. Everything about a monster derives from its level and its template.
- **Party size:** encounter tables are written for three heroes; for 1 / 2 / 3 / 4 heroes the monster *count* scales, then monster *HP*, then monster *damage* (minimum 1 monster; a Special or Monster is never removed). Rev. 2's starting values were count ×0.6 / ×0.8 / ×1.0 / ×1.2 and HP ×0.7 / ×0.85 / ×1.0 / ×1.15; the runner's Phase 3 values are **count ×0.6 / 0.8 / 1.0 / 1.6, HP ×0.5 / 1.0 / 1.0 / 1.6, damage ×0.8 / 1.0 / 1.0 / 1.0** (`tuning.json` → `dungeon.partyScaling`; D-080, D-084). *As tuned in Phase 7 (D-128): a pair's HP ×0.85, and a **boss row** for a boss, its adds and its arena's adds — HP ×0.4 / 0.8 / 1.2 / 2.0 and damage ×0.7 / 1.2 / 1.3 / 1.3 — because the shared row left fours walking through bosses and solos unable to pass them (`docs/balance/2026-10-28-gravehollow-round2.md`).* The runner tunes so solo and 4-hero fights land on the same 3–6 rounds, and so the tower is **very difficult**: not soloable the first time without levels and gear, possible solo after a lot of grinding, best taken with a party (D-084, James).
- **Difficulty knobs** (a menu of scalars like Hades' Pact, each sweepable by the runner): enemy HP %, damage %, count %, speed %, hunter clock, light start, revives per floor. Normal is the baseline; **Hard** and **Dread** presets (Dread was called Nightmare until checkpoint 1; the word now names the death rule, D-095) and the modifier menu ("Pacts", `07` §6) ship in Phase 7.

### 11.3 Monster families and bosses

Each zone has one family of 8–12 monsters with every role present; each dungeon a hunter per zone, a **zone boss** per zone with 2 phases, and a **final boss** with 3 phases and an arena rule. Elites gain affixes; bosses gain the floor. The content is `06-MONSTERS.md`; the dungeons `07-DUNGEONS.md`.

### 11.4 Dungeons at launch

Four dungeons are designed; one is built in Segment 1–2, two more in Segment 3, the fourth after launch:

1. **Gravehollow Keep** (8 floors, D-098): the Cellars F1–3 (vermin and the Grinning Company bandits) → the Crypts F4–6 (undead and spiders) → the Drowned Vault F7–8 (the Tidebound cult, constructs, oozes; Sister Naesa on F7); final boss **the Hollow King** on F8.
2. **The Fungal Deep** (L12–26): capfolk, trolls, slimes, cave beasts; final boss **the Sporemother**.
3. **Emberforge** (L24–38): salamanders, fire elementals, forge-golems, the deep dwarves; final boss **the Forge-Tyrant**.
4. **Frostmarch Citadel** (L36–50): frost giants, wights, ice wyrms; final boss **the Pale Dragon** — the dungeon where Dragon Scale (SS) drops.

Travel: the overworld map at the Waystone; a dungeon unlocks when the previous final boss is dead (solo or in a party where the host has it).

**Open questions**
1. ~~10 floors per dungeon in three zones (recommended) or 15 floors in five?~~ *Checkpoint 1 (D-098): neither — Gravehollow has 8 floors in three zones (Cellars F1–3, Crypts F4–6, the Drowned Vault F7–8); each later dungeon keeps three zones and gets its floor count in `07` when it is built.*
2. ~~Monster level per floor and party scaling — runner.~~ *Checkpoint 1 (D-099): the runner's values stand (§11.2, D-084); Phase 7 re-runs monster levels and party scaling for the 8-floor tower.*

---

## 12. Death, retreat, difficulty

### 12.0 The death rule (D-088 — James, 2026-10-27)

James: *"if your hero dies in the dungeon they die for good. This adds danger which I like (maybe make this a difficulty level choice)."* Every save chooses at New game:

| Rule | What a death means | For whom |
|---|---|---|
| **Mortal** (recommended) | A hero who dies in the dungeon is **dead**. The living carry the body; a powerful healer can raise it in the dungeon, the Ember Shrine can raise it in town, both for levels (§12.4). If the **whole party** falls, nobody carries anyone: they are **lost for good** (§12.2). | the game James asked for |
| **Nightmare** (James, checkpoint 1: *"make a 3rd nightmare mode … if you die you lose everything"*) | The Mortal rules, and the **chosen hero is your life**: they lead every delve (the Waystone opens only with them in the party), and if they **die** — past the downed window, or in a wipe — **the save ends** at once. Everything is lost: every hero and wayfarer, pets and eggs, the armory and materials, the purse and the bank, the tower's progress, the Memorial, and the save's backups. What remains is a line in the **Hall of Nightmares** on the title (the chosen hero's name, species, class and level, the deepest floor, the delves, how they fell). Wayfarers who die are carried, raised or laid to rest as under Mortal. | players who want every fight to matter |
| **Sheltered** | The rev. 3 rules: the fallen get back up after the fight from the floor's revive budget, at a rest room or by First Aid; a wipe wakes the party at the Lantern Inn; nobody is ever lost. | a gentler game, friends new to it |

Settings may **lower** the rule — Nightmare → Mortal → Sheltered — never raise it, and only in town, never during a delve (D-095). The title's Continue line shows the rule. The rest of this section says which rule a line belongs to when it matters.

### 12.1 In a fight

- **Downed** at 0 HP (both rules). An ally can **revive** within **3 of the downed hero's turns** (a Mender revive skill, a Phoenix Feather, or First Aid at rank ≥ 5 as a weight-1,000 action) at 30% HP — under Mortal this is the last chance and costs nothing. A downed hero still inside the window when the fight is **won** gets up at 30%.
- Past the window the hero has **fallen**. *Sheltered:* fallen heroes revive at 30% HP after the fight if anyone survived, spending one of **three party revives per floor** on Normal (Hard 1, Dread 0); at 0 budget a fallen hero stays down until a rest room or town. *Mortal:* the fallen hero is **dead**; there is no revive budget, rest rooms and First Aid do not raise the dead, and the party carries the body (§12.4).
- **Flee** (both rules; James: *"You obviously will … need to flee battles as well"*): a party vote; chance = 50% + the party's average Speed − the enemies' average Speed, + the best Smoke Pellet bonus, clamped 5–95%; the Flee button shows it (D-092). Failure costs everyone a turn. Not from bosses. The fled room keeps its monsters; the downed come out at 10% HP, the dead are carried.
- A status carried by an attack lands only if the attack hits (D-093).

### 12.2 A wipe

All heroes fallen = **wipe**. Both rules lose the delve's **unbanked gold** (the purse carried in and the gold found) and every equipped item takes **−10% durability**; gear found in the delve still reaches the armory.

- **Sheltered:** the party wakes at the Lantern Inn and keeps every XP point and Insight. *(Rogue Legacy / Moonlighter gold loss + Diablo 3's durability hit; Children of Morta's kept progress.)*
- **Nightmare:** the chosen hero is in every party, so a wipe ends the save (§12.0).
- **Mortal:** every hero in the party is **lost for good**. The Lantern Inn's bearers bring back what the Vault leaves — the heroes' worn gear (to the armory) and their pets (to the Stables) — never the heroes. Each lost hero leaves a **legacy** and a line on the **Memorial** (§12.5).

The per-hero Hardcore badge of rev. 2 is superseded by the Mortal rule.

### 12.3 Retreat

**Leaving (D-083 — James, 2026-10-27):** the party leaves only by **walking out of a floor's entrance room** or **teleporting out at the floor's end** (the stairs room, or the boss's room once the boss is down). Both keep everything carried and are free on Normal (Hard and Dread keep a 15% / 25% toll). Reaching a floor's way down records it, and the next delve may **start on the floor below** — the tower remembers. Not from a fight. Under Mortal, a party that loses a hero far from both exits must decide whether to push on to the floor's end or walk the body back. *(Rev. 2's "from any room, 10% toll" is superseded.)* *As built (Phase 7):* under the **Iron Oath** Pact (`07` §6.2) neither way is open — the zone's end is the only way home — and a wipe also forgets the floors this delve reached.

### 12.4 Raising the dead (D-089 — James: *"You can resurrect them … if you have a powerful enough healer or take them to a shrine, but they will lose levels either way"*)

| Where | Who | Cost | Limits |
|---|---|---|---|
| **In the dungeon** | a living hero who knows a **revive** skill (the Mender's Breath of Life or Dawnbreak; Rebirth and Miracle with Tiers IV–V) and has reached **level 10** | half the healer's pool; the floor clock +3; the raised hero **loses 1 level** and stands at 30% HP | out of a fight; once per healer per floor |
| **In town: the Ember Shrine** (Mother Cendra) | anyone carried home dead | **0.3 R + 0.05 R per level** in gold; the raised hero **loses 2 levels** | always; the dead cannot join a party until raised or laid to rest |

Losing a level takes back exactly what the level gave (D-082: +1 to the class's attributes in turn, +1 Vitality on even levels, +3 HP); battle XP drops to the start of the new level; skills, ranks, gear and attributes grown by use stay; never below level 1. `tuning.json` → `death.raise`, `death.shrine`.

### 12.5 The chosen hero, legacies and the Memorial (D-090)

- The hero made at New game is the player's **chosen hero**. One chosen hero lives at a time; the selection (species, class, three skills, points, name) opens again only when the chosen hero is gone. Only the save's first hero brings a creation egg; later chosen heroes take a pet from the Stables.
- Every other party member is a **wayfarer** from the Wayfarer Chest (§10.4).
- A hero lost for good (a wipe under Mortal, or **laid to rest** at the Shrine) leaves a **legacy** of **50%** of their battle XP. A wayfarer's legacy goes to a living hero the player picks; the chosen hero's goes to the **next chosen hero** when they are made (James: *"When/if your character dies you can choose a new character and can gain some of their experience back"*), or to a living hero if the player prefers.
- The Shrine's **Memorial** keeps each lost hero's name, class, level and where they fell. A lost wayfarer returns to the Wayfarer Chest's pool (*"hopefully redraw them"*) and starts over if drawn again.

### 12.6 Danger you can read (D-092 — James: *"Encounters should feel threatening and dangerous if you go too far"*)

An encounter's **threat** compares its level — its highest monster level, +1 per champion affix, +3 for a boss or the hunter — with the **party's level** (the average of the living heroes, rounded down):

| Band | Encounter level − party level |
|---|---|
| **Easy** | −2 or lower |
| **Even** | −1 to +1 |
| **Dangerous** | +2 to +3 |
| **Deadly** | +4 or higher |

It shows on the fight's opening banner, on scouted rooms and the map, on the Waystone's floors and at the stairs; under Mortal a Dangerous or Deadly floor adds *"Heroes who die here stay dead."* Going too far is deadly by construction: floors climb in level faster than a party that dives without grinding, champions gain affixes with depth (§11.1), the floor clock brings the hunter (§4.5), and under Mortal a wipe deep in the tower loses the party. `tuning.json` → `dungeon.threat`.

**Harder presets, as built (Phase 7).** The **Hard** and **Dread** presets (`07` §6.1) open per dungeon: Hard once its final boss is dead (any kill — before Hard opens every kill is on Normal), Dread once he is dead on Hard or Dread; the save counts kills by preset. Each preset's knobs are live, its revives per floor apply under Sheltered (Mortal has none), its toll applies to leaving, and the first kill of a boss on a preset pays that preset's extras when the party comes home. The **Pacts** stack on the preset (`07` §6.2: percent knobs multiply, bonus knobs add, the rest replace); `sim/src/pacts.ts` combines them and the systems that own each effect read the result.

---

### 12.7 Open questions from James's direction of 2026-10-27

1. ~~**The party-member unlock schedule** (D-084, Proposed).~~ *Answered by James on 2026-10-27: party members come only from chests (D-091).*
2. ~~**Gravehollow at 8 floors** instead of 10 (D-085, Proposed): Cellars F1–3, Crypts F4–6, Drowned Vault F7–8 with the Hollow King on F8?~~ *Checkpoint 1 (D-098): yes — 8 floors; Sister Naesa is the Vault's zone boss on F7, the Hollow King on F8.*
3. ~~**Battle XP shared or whole** (D-082 reading)?~~ *James, checkpoint 1: split through the party, scaled by the level gap to the party's average level (D-096, §5.1).*
4. ~~**The names Mortal and Sheltered**, and whether Settings may lower Mortal (D-088).~~ *Checkpoint 1: the names stay, James added **Nightmare** (D-095); a rule may be lowered in town, never raised.*
5. ~~**The raise costs** (D-089).~~ *Checkpoint 1 (D-098): kept; the runner and James's play decide any change.*
6. ~~**A Mortal wipe's gear and pets** (D-088).~~ *Checkpoint 1 (D-098): the bearers bring them home under Mortal; under Nightmare everything is lost (D-095).*
7. ~~**The legacy** at 50% of battle XP (D-090).~~ *Checkpoint 1 (D-098): kept.*
8. ~~**The Wayfarer Chest** (D-091).~~ *Checkpoint 1 (D-098): kept; the cast grows with each dungeon (S grades and the Grand Wayfarer Chest in Phase 7).*
9. ~~**The threat bands** (D-092).~~ *Checkpoint 1 (D-098): kept.*

## 13. The first thirty minutes

1. Title → **New game**: choose how death works — **Sheltered**, **Mortal** (recommended: the dead stay dead) or **Nightmare** (your chosen hero's death ends the save) (D-088, D-095) — then **New hero**: pick a species (six cards, pros and cons in one line each), a class (six cards; the seventh arrives later), three Tier I skills, a pet egg of three, six points and a name. Two minutes.
2. Emberfall at dusk; Hesper the blacksmith hands you a Crude sword and says the Keep's cellars are paying bounties. The Waystone offers **Gravehollow Keep — the Cellars**.
3. Floor 1: three rooms, the first fight teaches the timeline strip (a rat is faster than you; your Warden pet is slower), the second a trap your Perception reveals, the third the stairs. Floor 2 adds a curio and a Dim-light ambush. Floor 3 ends with **the Grinning Captain**.
4. Back in town with ~R gold: Repair all (watch the pips go green), buy one Tier I skill, open one Standard chest, hatch the egg. The status screen shows what grew. A **Wayfarer Chest** (1.2 R) is the first goal after that: the first party member (D-091). The threat chips on the Waystone say how far the party can safely go (D-092).

---

*Decisions this file rests on are logged in `13-DECISIONS.md` (D-001 … D-040). Numbers here feed `content/` and the balance runner (`12-ROADMAP.md`, Phase 2).*
