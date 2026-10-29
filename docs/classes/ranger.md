# Ranger — class sheet

*Last updated 2026-10-28 · rev. 5 (Phase 7 joints: Wayfinder, Ambush Sense and the passives' Detection read by the delve; Cartography's reveal; the corridor-skills line) · rev. 4 (Phase 7 class-damage pass: the tuned multipliers in §4 and "As tuned" under it) · rev. 3 (Phase 7: Tiers IV–V as built — §4's "As built" note; D-099's cap on Never Lost; the technique rule as accepted) · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26 · numbers are tuning starting points*

*Every number below (costs, multipliers, durations, the Cellars monster stats in §8) is a starting point for the simulator and the balance runner, not a commitment. Rules referenced are `03-GAME-DESIGN.md` (§2 stats, §3 timeline, §4 exploring, §5 level-by-use, §6 gear, §7 skills). Status numbers quoted in skill lines (Bleed 25% of the applying hit per turn for 3 turns, ignores Defense · Poison 3% of max HP per turn, ignores Defense · Weaken −20% Attack · Fortify +20% Defense · Mark +20% damage taken · Slow ×0.67 Speed · Haste ×1.5 · Daze −500 energy · Petrify −1,000 energy) belong to `content/statuses/<id>.json` (`03` §3.5 is the table) and are repeated here only so the lines read on their own.*

---

## 1. Identity

The Ranger is the party's eyes and its reach. Standing in the back row with a bow, it is the only one of the four who can choose any target in any row from the first tick — and with Steady Draw its first arrow lands before most enemies have moved. Out of combat it is the class that makes the dungeon smaller: traps revealed, secret doors found, ambushes avoided, the next room scouted, torches foraged. On the timeline it is quick (Speed 102 at creation, 107 by floor 3) and its rhythm is Mark, then shoot the Marked thing, then shoot it again. Its weakness is simple and total: if the front row falls, the Ranger is a Leather-clad archer with no shield standing in melee.

| Pros | Cons |
|---|---|
| Hits either row from either row; the only class that can kill a back-row spitter on turn one | Leather Defense 18 at creation; two Cutpurse hits are a third of its HP |
| Steady Draw: first action at weight 800 and +20% — the party's first strike, every fight | Arrows and bolts are consumed (1 per shot, 3–9 per volley) and cost gold; an empty quiver is a basic-attack-only Ranger |
| Perception 12 → Detection 12: traps, secrets, treasure, scouting, and −2% ambush for the whole party (20 × 2 / 22) | Bows wear on the draw (half rate), so the bow is the party's most repaired weapon after dual swords |
| Trapper's Net Throw and Snare are the party's disablers: a Grabbed elite is a dead elite | Low raw Attack (Str 10, bow base 12); damage comes from Marks, crits and first strike, not from the weapon |
| Pathfinder actives work in the corridor *and* in combat — never a wasted slot | Falls apart if ambushed: Dark-band fights start with enemies at +500 energy and the Ranger loses its first-strike identity |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | +2 Perception · +1 Agility · +1 Vitality (plus species, plus 6 free points) |
| Pool | **Stamina** = 30 + 3 × End → **60** at End 10 |
| Armor family | **Leather** (hide ladder Rawhide → Ancient Dragon Scale); speed penalty **−3**, relieved 1 point per Strength above the set's requirement, never below 0 (Crude Leather requires Str 10) |
| Allowed weapons | **Shortbow / Longbow** (2h · Pierce · normal 1,000 · either row · Strength counts toward Attack · wears on draw at half rate) · **Crossbow** (2h · Pierce · heavy 1,400 · either row · high base · no draw wear · bolts cost double) · **Spear** (2h · Pierce · normal 1,000 · reach — for a Ranger who ends up in the front row) |
| Ammo (`08` §4) | 1 arrow or bolt per shot; multi-shot skills state their count. Arrows ×50 cost 0.02 R; a stack of 99 is one bag slot. Forager's Instinct (Pathfinder II) recovers half of spent arrows after each fight |
| Starter kit (F-grade, Crude; `08` §12) | Pine Shortbow (Attack 13, req Str 9) · Arrows ×100 · Rawhide Hood / Jerkin / Breeches / Boots / Gloves (Defense 1 / 4 / 3 / 1 / 1 = 10) · Ring of the Hawk (+1% Accuracy) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg |
| Derived at creation (class modifiers only, all else 10) | HP 110 · Attack **35** (13 + 2 × 10 + 2 × 1 spare Str over the Shortbow's req 9) · Defense 20 (10 + 10) · Speed **102** (100 + 5 − 3) · Stamina 60 · Crit 6% · Crit Damage 154% · Accuracy **93%** (92% + 1% ring) · Dodge 0.5% · **Detection 12** · Carry 50 kg |
| Recommended Tier I starter picks | **Aimed Shot** (Marksman) · **Hunter's Mark** (Marksman) · **Keen Eyes** (Pathfinder) — a shot, the Mark that makes every later shot better, and the Detection that pays in traps and treasure from floor 1. A trap-minded player swaps Keen Eyes for **Snare** |

Shortbow is the default. The crossbow is a legitimate heavy build from level 1 (Deadeye and Comet Shot both prefer it); the spear is a fallback, not a build.

---

## 3. The Ultimate — *Quiver's End*

| Field | Value |
|---|---|
| Unlock | Tier III (level 12); Skill Hall 1.0 R or the first zone-boss Tome. Own button, outside the 4 + 2 loadout |
| Cost | 100 Momentum, no Stamina, **no arrows** |
| Weight | 1,400 |
| Target | Every enemy in both rows — never misses |
| Effect | 2.0× Pierce to every enemy; **4.0×** to every Marked enemy · Root 1 turn on everything hit · ignores Dodge and Blind |
| Mastery (rank 10 bonus) | 2.4× / 4.8×; Root 2 turns |

The Ranger's Ultimate rewards the Mark-first rhythm: a Marksman who has Marked two targets fires a 4.0× shot at each and a 2.0× shot at everything else. Apex Hunter (Marksman V) raises the party's damage to Marked targets, so late Rangers Mark everything and then empty the quiver.

---

## 4. The three schools

*Reading the tables.* Cost is Stamina. Weight is energy subtracted after the action (light 800 · normal 1,000 · heavy 1,400). Multipliers are of Attack; heavy 1,400-weight skills carry about ×1.3 on their multiplier to pay for the weight. "Any row" = the Ranger chooses. "Field" = a trap laid on the enemy side that fires on a condition. Each Tier II–V skill names exactly one Tier N−1 skill of its own school as prerequisite. Rank 1–10 grows by use (+4% effect, −2% cost per rank); Mastery is the rank-10 line. Insight sweet spots by tier (enemy level ≈ tier × 6): Tier II at L9–15 (the Crypts, the Vault), Tier III at L15–21 (the Fungal Deep), Tier IV at L21–27 (Emberforge). **Monster techniques** are learned only by witnessing the named monster use the move: a flat 10% per witnessed use, certain by the 10th (D-028, D-099; the witness also needs the technique's prerequisite). They are never sold and never come in a Tome.

### 4.1 Marksman — aimed shots, marks, either-row damage, first strike

*The first arrow decides who the fight is about.* Everything here needs a bow or crossbow; arrow counts are in the Effect column.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Aimed Shot | Active | 10 | 1,000 | Single any row | 2.1× Pierce; +10% Accuracy, +10% Crit Rate for this shot; 1 arrow | — | +20% Crit Rate |
| I | Hunter's Mark | Active | 8 | 800 | Single any row | Mark 3 turns (+20% damage taken from everyone, `03` §3.5); +5 Momentum | — | Mark 4 turns at +25% |
| I | Steady Draw | Passive | — | — | Passive | Your first action in each fight has weight 800 and deals +20% | — | Also +10 Momentum |
| II | Piercing Shot | Active | 14 | 1,000 | Single + behind | 2.25× Pierce to the target and 1.2× to the enemy directly behind it in the other row; 1 arrow | Aimed Shot | 1.2× becomes 1.65× |
| II | Quarry | Passive | — | — | Passive | +10% damage and +10% Crit Rate against Marked targets; killing a Marked target refunds the Mark's Stamina and grants +10 Momentum | Hunter's Mark | +15% / +15% |
| II | Snap Shot | Active | 12 | 800 | Single any row | 1.65× Pierce; light; 1 arrow | Steady Draw | 1.95× |
| III | Deadeye | Active | 22 | 1,400 | Single any row | 2.85× Pierce; guaranteed crit against a Marked target; 1 arrow | Piercing Shot | 3.3× |
| III | Predator's Patience | Passive | — | — | Passive | Each of your turns spent not attacking (Guard, Item, Mark, a Pathfinder active) adds +25% to your next shot (max +75%) | Quarry | Max +100% |
| III | Volley | Active | 24 | 1,000 | All enemies | 1.1× Pierce to every enemy in both rows; 3 arrows | Snap Shot | 1.3× |
| IV | Heartseeker | Active | 32 | 1,000 | Single any row | 2.8× Pierce; ignores 50% of the target's Defense (the anti-Plate shot); Bleed 2 turns; 1 arrow | Deadeye | Ignores 75% |
| IV | One Shot | Passive | — | — | Passive | A crit against a fodder-role enemy below 25% HP kills it outright (never elites or bosses); Crit Damage +10% | Predator's Patience | Threshold 35% |
| IV | Rain of Points | Active | 35 | 1,400 | All enemies | 1.5× Pierce to every enemy; Slow 1 turn; 5 arrows | Volley | 1.8× |
| V | Comet Shot | Active | 45 | 1,400 | Single any row | 4.0× Pierce; ignores Defense entirely; if it kills, +30 Momentum; 1 arrow | Heartseeker | 4.6× |
| V | Apex Hunter | Passive | — | — | Passive | Marked enemies take +30% from the whole party (replaces Mark's +20%); your Crit Rate cap is 55% | One Shot | +35% |
| V | Storm of Shafts | Active | 50 | 1,400 | All enemies | Three hits of 0.8× Pierce to every enemy (2.4× each); 9 arrows | Rain of Points | Four hits |

### 4.2 Trapper — traps, nets, disarms, snares, part-breaks

*Decide where the enemy stands before you decide where to shoot.* The control school and the co-op disabler. Traps laid on the field persist until they fire or the fight ends; a field holds at most two of your traps.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Snare | Active | 10 | 1,000 | Single any row | 1.2× Pierce; Root 2 turns (cannot swap rows, cannot flee); 1 arrow | — | Root 3 turns |
| I | Caltrop Toss | Active | 12 | 1,000 | Enemy front row (field) | For 3 turns every enemy standing in the front row takes 0.5× Pierce at its turn start | — | Also Slow 1 turn on each tick |
| I | Quick Hands | Passive | — | — | Passive | Trap Disarm +2; Trapper skills cost −10%; disarming a trap in the corridor grants +10 Momentum at the start of the next fight | — | Trap Disarm +4 |
| II | Net Throw | Active | 16 | 1,000 | Single any row | **Grab** 1 turn — the target cannot act until it is freed (any hit on it by an ally frees it; the Ranger's own shots do not); 0.9× Blunt | Snare | Grab survives one ally hit |
| II | Tripwire | Active | 14 | 800 | Field | The next enemy to change rows, charge or use a reach attack is Dazed and takes 1.0× Pierce | Caltrop Toss | Two triggers |
| II | Hamstring | Active | 13 | 1,000 | Single any row | 1.8× Pierce; Slow 2 turns; **part-break**: marks a leg, doubling that monster's rare-part roll (§6.5); 1 arrow | Quick Hands | Rare-part roll ×3 |
| III | Spring Trap | Active | 22 | 1,000 | Single any row | 2.0× Pierce; if the target is Rooted, Grabbed or Webbed, Stun 1 turn; 1 arrow | Net Throw | 2.4× |
| III | Snare-Sense | Passive | — | — | Passive | Enemies under Root, Grab or Web take +15% damage from your party; your Detection +3 | Tripwire | +25% / Detection +5 |
| III | Deep Tentacle's Drag | Active | 24 | 1,000 | Single back-row enemy | **(monster technique: deep tentacle)** Grab 1 turn and pull the target into the enemy front row, swapping it with a front-row enemy; 1.3× Blunt | Hamstring | Also Weaken 2 turns |
| IV | Bear Jaw | Active | 30 | 1,000 | Field, enemy front row | A trap that fires on the next enemy action taken from the front row: 2.5× Pierce, Bleed 3 turns, Root 2 turns | Spring Trap | 3.0× |
| IV | Dismantle | Passive | — | — | Passive | Your part-breaks drop a guaranteed common part; a failed Trap Disarm never triggers on you | Snare-Sense | Part-breaks also roll a rare part at +10% |
| IV | Spiked Net | Active | 32 | 1,000 | Enemy front row | Web 1 turn on every front-row enemy (cannot act until the Web ends); 0.8× Pierce to each | Deep Tentacle's Drag | Also the back row at 50% chance |
| V | Hunter's Cage | Active | 50 | 1,400 | Single any row | Grab 2 turns that is **not** freed by damage; Mark 2 turns; Weaken 2 turns; bosses: 1 turn and no Weaken | Bear Jaw | Bosses 2 turns |
| V | Trapmaster | Passive | — | — | Passive | Once per turn, laying a field trap (Caltrop Toss, Tripwire, Bear Jaw, Killing Field) has weight 400 instead of its own; trap damage +30% | Dismantle | Field holds three traps |
| V | Killing Field | Active | 45 | 1,400 | Both enemy rows (field) | For 3 turns every enemy takes 1.0× Pierce at turn start and is Slowed; 6 arrows | Spiked Net | 4 turns |

### 4.3 Pathfinder — scouting, light, foraging, party Speed, ambush avoidance

*Most fights are won in the corridor before them.* Every Pathfinder active has a corridor effect and a combat effect, so a scout build never carries a dead button into a fight.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Keen Eyes | Passive | — | — | Passive | Detection +3; scouting chance +10% | — | Detection +6 |
| I | Trailblaze | Active | 8 | 800 | Party | Combat: allies +10 Speed for 2 turns. Corridor: the next room's ambush roll −10% | — | +15 Speed; −15% ambush |
| I | Flint & Tinder | Active | 8 | 800 | Room | Corridor: Light +10 (no torch spent). Combat: lights the room for this fight — monsters lose their Dark-band Accuracy and Damage bonuses | — | Light +15 |
| II | Forager's Instinct | Passive | — | — | Passive | Foraging +2; rest rooms yield one extra ingredient; recover 50% of spent arrows after each fight | Keen Eyes | Recover 75% |
| II | Double Time | Active | 14 | 800 | Ally / party | Combat: Haste 1 turn on one ally (any row). Corridor: the party moves through 2 rooms for 1 floor-clock tick | Trailblaze | Haste 2 turns |
| II | Lantern Throw | Active | 12 | 800 | All enemies | Blind 1 turn on every enemy (−30% Accuracy); Light +5 | Flint & Tinder | Blind 2 turns |
| III | Scout Ahead | Active | 18 | 1,000 | Corridor / all enemies | Corridor: reveal every adjacent room and the room beyond each (a critical scout). Combat: Mark 1 turn on every enemy | Forager's Instinct | Mark 2 turns |
| III | Ambush Sense | Passive | — | — | Passive | Party ambush chance −10%; when the party surprises the monsters, every ally +10 Momentum | Double Time | −15% / +20 Momentum |
| III | Cover Fire | Active | 20 | 1,000 | Ally | Swap the chosen ally's row (pull a wounded Blade back, push a pet forward) and fire 1.2× Pierce at the enemy that last hit them; 1 arrow | Lantern Throw | Ally also gains Shield = 10% its max HP |
| IV | Wayfinder | Passive | — | — | Passive | Cartography +2; the floor's hunter arrives at 50 ticks instead of 40; secret rooms +10% per floor | Scout Ahead | Hunter at 60; secrets +15% |
| IV | Grave Bat's Screech | Active | 28 | 1,000 | All enemies | **(monster technique: grave bat)** Fear 1 turn on every enemy (50% to Guard instead of acting) and Daze 30%; your pet's accumulator +300 | Ambush Sense | Daze 50% |
| IV | Rearguard | Active | 30 | 800 | Party back row | Every back-row ally gains Shield = 20% of its max HP for 2 turns and cannot be targeted by reach attacks for 1 turn | Cover Fire | 3 turns |
| V | Nightwalker | Active | 40 | 1,000 | Party / floor | Corridor: for the rest of the floor the party reads Light one band brighter and monsters get no Dark-band bonuses (push your luck for the loot bonus at no risk). Combat: Blind 2 turns on every enemy | Wayfinder | Lasts the whole delve |
| V | Hunter's Hour | Active | 50 | 1,400 | Party | Haste 2 turns to every ally; +20 Momentum each | Grave Bat's Screech | Haste 3 turns |
| V | Never Lost | Passive | — | — | Passive | Party ambush chance −30% (D-099: a cap, not immunity, so Perception keeps its job); room entries tick the floor clock half as often; Detection +5 | Rearguard | The party always surprises fodder-only encounters |

**As built (Phase 7).** Tiers IV–V are content (`content/skills/ranger/`, written by `tools/content/gen-class-ranger.ts`). Tier V is written but locked until Segment 3's endgame (D-099: no Insight, no Tome, no Skill Hall); Tier IV comes from Insight, boss Tomes and Skill Tome chests, never the Hall. The readings where a row needed one:
- **Heartseeker** and **Comet Shot** ("ignores N% of Defense"): the shot lands as if N% of the target's Defense were gone (`ignore-defense-percent`). Comet Shot's kill pays its +30 Momentum once.
- **One Shot**: once your action resolves, a fodder-role enemy your crit left under 25% HP dies. Elites, specials, bosses and hunters never do.
- **Apex Hunter**: a Marked enemy takes +30% from the whole party in place of the Mark's +20 (the higher of it and a Mastery Mark, never both). The Crit Rate cap of 55% is a stub: the cap is a stat clamp no passive reaches yet.
- **Bear Jaw** springs on the first enemy to start a turn in the front row, before it can act, then it is gone. **Killing Field** ticks each enemy at its own turn start for 3 of its turns.
- **Dismantle**: a limb you break drops that monster's common part (a guaranteed part in the fight's loot). Its failed-disarm half is the same line as Saboteur's Mastery.
- **Hunter's Cage** is Net Throw's hold made unbreakable. A boss is caged for 1 turn even though a Grab cannot otherwise hold a boss.
- **Trapmaster**: once per round a trap-laying skill (Caltrop Toss, Tripwire, Bear Jaw, Killing Field) weighs 400. The +30% trap damage reaches Bear Jaw and Killing Field; Caltrop Toss and Tripwire do not read it yet. The Mastery's "three traps" changes nothing, because the sim caps no field.
- **Rearguard**: "reach attacks" are melee blows into the back row, so a ranged shot still lands. Its Mastery's "3 turns" is the Shield's duration.
- **Grave Bat's Screech** is the Ranger's Tier IV technique (the Grave Bat's Shriek teaches it).
- **Wayfinder** works through the delve's own reads (Phase 7 joints). Its Cartography +2 counts in the Cartography reveal — entering a room shows the rooms within one ring per 3 ranks, so a Ranger's starting 2 becomes 4 (`09` §5; the reveal itself was built with this joint) — and in the traps a Cartography rank spots (the Coffin Catapult's 3+). The hunter comes 10 ticks later than the floor's own clock (Mastery 20): 50 instead of 40 on a standard floor, and a Hard floor's 32 becomes 42, so the presets keep their bite. A floor holds its secret room 10 points more often (Mastery 15); a floor with no secret keeps none.
- **Ambush Sense**'s −10 now reaches the ambush roll — a bug since Phase 3: the delve read only the pets' traits — and the Detection lines on passives (Keen Eyes, Snare-Sense) count outside a fight. The heroes' ambush lines take the best single hero's, never past D-099's −30, and add to the best pet's.
- **Waiting for Tier V to open** (each logs a `hookStub` the runner counts): Nightwalker's corridor light (its combat Blind works); Never Lost's half-speed floor clock and its Mastery. Its −30% and Detection +5 already go through the reads above.
- **Corridor skills** (D-099, pass D, `sim/src/corridor.ts`): Flint & Tinder, Trailblaze, Double Time and Scout Ahead also work out of combat, from the delve's corridor menu. Each costs its Stamina (as a share of the pool), takes no turn and no floor-clock tick, and does not train the skill; Blind Map leaves Scout Ahead nothing to do.


**As tuned (Phase 7, the class-damage pass).** `tools/balance/class-damage.ts` measures each class alone against every zone’s standard monsters at its own level, as single-target damage per round (10 timeline ticks: one normal action of a Speed-100 hero), at levels 1, 5, 8 and 13; the brief is that no damage dealer outdoes another by more than about 1.5×. Before the pass the spread was 2.6× / 2.5× / 3.1× / 2.5×; after it, 1.41× / 1.28× / 1.49× / 1.49×. On the first numbers the Ranger dealt a third to a half of the Arcanist and the Blade (L1 30 against 79 and 72; L8 44 against 134): its Attack grows only with Strength, which it barely trains, and the Crypts halve Pierce. Its Tier I–II damage multipliers are now ×1.5 (Aimed Shot 2.1×, Snare 1.2×, Piercing Shot 2.25× + 1.2×, Snap Shot 1.65×, Hamstring 1.8×, Net Throw 0.9×) and its Tier III ones ×1.1 (Deadeye 2.85×, Spring Trap 2.0×, Volley 1.1×, Deep Tentacle's Drag 1.3×); the tables above carry them. They sit above `04` §1's bands on purpose — the bands assume an Attack built on Strength. Tier IV–V keep the sheet's numbers until a dungeon where they can be met (Dungeon 2) gives them their own measure. §8's worked example keeps its original arithmetic.

---

## 5. Field-skill affinities

| Field skill | Starting rank bonus |
|---|---|
| Lockpicking | 0 |
| Trap Disarm | **+2** (the rulebook's Ranger bonus, §7.6) |
| Foraging | **+2** (torches, herbs and arrows from the rest room) |
| Field Repair | 0 |
| First Aid | 0 |
| Haggling | 0 |
| Cooking | 0 |
| Cartography | +1 (Wayfinder adds +2 later) |

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Play pattern |
|---|---|---|---|---|
| **Longshot** (L1–12, shortbow) | Aimed Shot · Hunter's Mark · Piercing Shot · Snap Shot | Steady Draw · Quarry | Fierce (Ember Fox) | First action: Aimed Shot the back-row spitter at 800 weight and +20% — it usually dies. Then Mark the elite, Piercing Shot through it into the thing behind, Snap Shot when Stamina is under 20. About 4 arrows and 36 Stamina per ordinary fight. |
| **Snaresmith** (L5+, crossbow) | Net Throw · Snare · Hamstring · Spring Trap | Quick Hands · Snare-Sense | Guard (Brine Crab, in the front row) | The co-op control build: Net the disabler-role monster before it acts (the pet in Guard stance soaks for you), Snare the thing that wants to swap rows, Hamstring the elite for its rare part, Spring Trap anything that is already held for 1.8× and a Stun. Your damage is the party's damage at +15%. |
| **Wayfarer** (L20+, co-op scout) | Scout Ahead · Double Time · Volley · Cover Fire | Keen Eyes · Ambush Sense | Forage (Moss Tortoise) | The party goes into Dark rooms on purpose for the +50% loot: Scout Ahead every junction, Double Time past the hunter clock, Volley to Mark-and-chip, Cover Fire to pull the Blade out when a Grab lands. Lowest damage of the three; highest gold per delve. |

---

## 7. How it grows by use

| Attribute | Tagged by (per §2.1 / §5.2) | Typical Ranger rate |
|---|---|---|
| **Perception** | finding traps, secrets and treasure; scouting; landing crits | fastest — every room entry with a find tags it, and Aimed Shot crits add more |
| **Agility** | attacking (ranged accuracy counts), dodging, disarming traps | fast — every shot and every disarm |
| **Strength** | landing bow hits (bows count as physical Attack) | steady — slower than a melee class because fewer hits land per action |
| **Vitality** | damage taken | slow while the front row holds; sudden when it does not |
| **Endurance** | taking hits, marching over 50% carry | slow — a quiver of 99 arrows is light |
| **Willpower** | resisting a status | slow-moderate (Web and Fear resist checks) |
| **Luck** | not trainable | — |

**A level-20 Ranger** (160 skill ranks, ~40 floors of finds) looks like: Str 15 · Agi **21** · Vit 15 · End 12 · Wis 11 · Per **26** · Will 13 · Luck 10. With a C-grade Yew Longbow (Attack 29 + 2 × 15 + 2 × 5 spare Str = **69**) and C-grade Wolf Hide (Defense ~20 + 12 = 32), Speed 100 + 55 − 3 + 3 relief = **155**, Crit 5% + 40 × 16 / 96 = **11.7%** (Aimed Shot takes it to 22%), Accuracy 100%, **Detection 26 + 6 (Keen Eyes) + 3 (Snare-Sense) = 35** — every trap and secret on floors 1–20 is revealed on entry, and the party's ambush chance is near its floor. The level-20 Ranger has 195 HP (30 + 7 × 15 + 60) and Defense 32; it has simply stopped being hit.

---

## 8. Worked example — floor 3, level 4, the Cellars

**Setup.** 3-player party; only the Ranger's and the monsters' lines are shown, allies elided (…). Ranger L4: Str 10 · Agi 12 · Vit 11 · End 10 · Per 14; Common (E) Ash Shortbow Attack 16 (req Str 10); Crude Leather Defense 8. Derived: **Attack 36** (16 + 2 × 10) · **Defense 18** · HP 119 · Speed **107** · Stamina 60 · Crit 7% · Accuracy 94%. Back row. Loadout Longshot. Jitter ignored.

**Monsters (L4, placeholder stats pending `06-MONSTERS.md`).** Giant Rat — front, HP 38, Def 6, Speed 130, Attack 18, Bite 1.0× Pierce. Cellar Spider — back, HP 44, Def 10, Speed 115, Attack 20, Web Spit (Web 1 turn, either row) / Venom Bite 0.9× + Poison 3 turns. Grinning Cutpurse — front, HP 56, Def 14, Speed 105, Attack 24, Slash 1.0× / Dirty Trick (Blind 1 turn).

**Initiative (0–400):** Rat 250 · Spider 120 · Cutpurse 300 · Ranger 400 · pet 60.

| Tick | Actor | Action · cost | Arithmetic | Result |
|---|---|---|---|---|
| 6 | **Ranger** (1,042) | **Aimed Shot** on the Spider (back row) · 10 Sta · 1 arrow · **weight 800** (Steady Draw) | Hit: roll < 94% + 10% → cap 100%. Damage = Attack 36 × skill 1.4 × (1 + 0.20 Steady Draw) × element 1.0 × 100 / (100 + 10) × crit 1.0 × variance 0.96 = 60.5 × 0.909 × 0.96 = **53** | Spider dead (44) before it ever spits · Sta 60 → 50 · Momentum 20 · arrows 59 · accumulator 242 |
| 6 | Giant Rat (1,030) | Bite on the front-row ally | … | — |
| 7 | Cutpurse (1,035) | Slash on the front-row ally | … | Momentum +5 per ally action |
| 8–9 | Allies, pet | … | — | Momentum 35 |
| 14 | **Ranger** (1,098; +6 Sta regen) | **Hunter's Mark** on Cutpurse · 8 Sta · 800 | — | Cutpurse Marked 3 turns (+20% damage taken) · Sta 48 · Momentum 60 · accumulator 298 |
| 14 | Giant Rat (1,070) | Bite on the front-row ally | … | — |
| 21 | **Ranger** (1,047) | **Aimed Shot** on the Marked Cutpurse · 10 Sta · 1 arrow · 1,000 | 36 × 1.4 × (1 + 0.20 Mark + 0.10 Quarry) × 100 / (100 + 14) × 0.96 = 65.5 × 0.877 × 0.96 = **55**; crit roll (7% + 10% + 10% Quarry = 27%) fails | Cutpurse 56 → 1 (an ally finishes it) · Sta 44 · Momentum 85 · arrows 58 |
| 22 | Cutpurse (1,005) | Slash on the front-row ally at 1 HP | … | — |

Three actions, two arrows, 28 Stamina, zero damage taken. The Spider never acted — that is Steady Draw and either-row targeting in one line, and it is why the Warden in the sibling example took a Venom Bite and this party did not. The flip side: if the Rat had been a Grinning Company bruiser who Dazed the front ally off the timeline, the Ranger's Defense 18 would have been the party's front row by tick 14.

---

## 9. Visual brief — the Ranger gear set (shared humanoid rig, Blender)

- **Silhouette:** a hood point and a bow arc — a tall narrow figure with the bow's curve breaking the outline on one side and a quiver angled across the back on the other. The only class whose weapon shows as a curve, not a line.
- **Modular meshes (five armor pieces + weapons):** Helmet (deep hood with a leather cap under it; a hood-down variant for Draconid horns) · Chest (layered jerkin with a mantle of short overlapping leather scales on the shoulders) · Legs (fitted leggings with a thigh quiver strap) · Boots (soft knee-high boots, folded tops) · Gloves (a bracer on the bow arm, a three-finger glove on the draw hand — asymmetric, a separate mesh per hand) · Shortbow / Longbow as a two-hand pose set, carried on the back-left bone out of combat · Crossbow (chunky, a stock that reads as a block) · Quiver on the spine bone, arrow-count visible as three fill states (full / half / empty — the ammo UI on the body) · Spear fallback shares the Warden's spear mesh.
- **Palette:** moss green (hood and mantle) · bark brown (jerkin, boots) · undyed cream (under-sleeves, bow string) · metal: **brass** (buckles, arrowheads, crossbow fittings).
- **Must read at 200 px:** the hood point, the bow curve, and the quiver angle; in the back row the Ranger is drawn smaller, so the hood-and-bow outline is the whole identity.
- **F-grade vs S-grade (same mesh set):** F (Crude/Rawhide) — raw hide with visible stitching, a Pine bow with a plain string, a cloth quiver. S (Legendary/Drake Scale) — scale mantle with an iridescent edge pass, an Elderwood bow with brass-capped limbs and an emissive string glow on the draw, a tooled quiver with a red fletching fill. Mesh set unchanged; hide normal map, mantle texture and limb caps change.
- **Species notes:** Human baseline. Dwarf: 0.85 / 1.15 — bow scaled to 0.9 so the lower limb clears the ground in the idle pose. Elf: 1.05 / 0.9, hood narrowed (*hood_narrow* key), the canonical Ranger body. Orc: 1.10 / 1.2, hood widened, bracer thickened. Halfling: 0.70, shortbow only in the mesh pose set (longbow and crossbow scaled to 80%, quiver moved to the hip). Draconid: hood-down variant with horn sockets, leggings split for the tail, mantle scales recolored to the species' scale tint.

---

## 10. Open questions (for James)

1. ~~**Ammo as a real cost.** The sheet charges 1 arrow per shot and 3–9 per volley, with Forager's Instinct recovering half. Is managing a quiver fun on a phone, or should arrows be infinite and the cost live only in bow wear?~~ *Checkpoint 1 (D-099): keep the quiver — it is the Ranger's mechanical con (`04` §1) and cheap (`08` §4) — but no chore: when the sim starts counting arrows in Phase 7, Repair all also refills the quiver and the floor Merchant stocks arrows.*
2. ~~**Steady Draw's first strike.** A weight-800, +20% first action every fight is a strong Tier I passive, and with either-row targeting it routinely kills a back-row caster before it acts (§8). Keep it at Tier I as the class identity, or move the +20% to Tier II (Quarry) and leave Tier I as the weight change only?~~ *Checkpoint 1 (D-099): keep it at Tier I, as built — it is the class identity, and the runner already shows the Ranger behind on damage.*
3. ~~**Monster-technique Insight rule.** Deep Tentacle's Drag (Tier III) and Grave Bat's Screech (Tier IV) come from Gravehollow monsters at L5–14, below the S-curve sweet spots of L18 / L24. Proposed: a flat 10% per witnessed use, pity at 10 — confirm?~~ *Checkpoint 1 (D-028): confirmed — a flat 10% per witnessed use, pity at 10.*
4. ~~**Pathfinder actives in the corridor.** They are usable out of combat from the loadout without spending a turn or a floor-clock tick (except Double Time, which saves one). Should corridor uses cost Stamina (which only regenerates in fights and rests), or be free?~~ *Checkpoint 1 (D-099): they cost their Stamina (the pool carries from fight to fight, so it is a real choice) but still take no turn and no floor-clock tick.*
5. ~~**Never Lost** (Tier V) makes the party immune to ambush. That removes one of Perception's two headline effects for the whole party; acceptable at Tier V, or cap it at −30%?~~ *Checkpoint 1 (D-099): cap it at −30% ambush so Perception keeps its job; the half-speed floor clock and Detection +5 stay.*
