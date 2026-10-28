# Shade — class sheet

*Last updated 2026-10-27 · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26 · numbers are tuning starting points*

*Every number below (costs, multipliers, durations, the Cellars monster stats in §8) is a starting point for the simulator and the balance runner, not a commitment. Rules referenced are `03-GAME-DESIGN.md` (§2 stats, §3 timeline, §4 exploring, §5 level-by-use, §6 gear, §7 skills, §8.3 chests). Status numbers quoted in skill lines (Bleed 25% of the applying hit per turn for 3 turns, ignores Defense · Poison 3% of max HP per turn, ignores Defense · Weaken −20% Attack · Fortify +20% Defense · Mark +20% damage taken · Slow ×0.67 Speed · Haste ×1.5 · Daze −500 energy · Petrify −1,000 energy · Curse −10% all stats) belong to `content/statuses/<id>.json` (`03` §3.5 is the table) and are repeated here only so the lines read on their own. **Veil** is a Shade-only state, not a global status: while Veiled the Shade cannot be chosen as the target of a single-target attack (AoE still hits), and its next attack is a backstab; Veil ends when the Shade attacks or after 2 turns.*

---

## 1. Identity

The Shade is the fastest thing on the party's side of the timeline (Speed 107 at creation, 117 by floor 3) and the most fragile. It plays in two-beat phrases: disappear, then appear exactly where it hurts — Veil then Backstab, Poison then Venom Burst, Smoke Pellet then Mug. From the front row it can flank into the back row, so the spider spitter and the brine hag are its targets, not the bone knight (Pierce versus Plate is the one wall it cannot climb without Assassinate). Outside combat it is the party's locksmith and its purse: locks opened, secrets found, gold stolen mid-fight. Everything it does needs a setup turn, and an ambush takes that turn away.

| Pros | Cons |
|---|---|
| Highest burst: Veil → Backstab is 1.5× × 2 = 3.0× at Tier I, with +30% Crit Rate on top | 103 HP and Defense 18 at creation — two Cutpurse hits are 40% of its HP, and nothing blocks |
| Flank from the front row: Backstab, Assassinate, Severance and every thrown knife choose either row | Pierce versus Plate: bone knights and vault sentinels take its daggers at ×0.67 until Assassinate (Tier IV) ignores half their Defense |
| Crit engine: Per + Luck both feed Crit Rate; Cold Read and Killer's Calm stack it, crits refund Momentum | Needs a setup action: a Shade that is ambushed (enemies at +500 energy) spends its first turn surviving, not Veiling |
| Larceny pays: +gold stolen per enemy, Lockpicking +2, Treasure Sense, chests roll a grade up | Dodge is the only defence, it caps at 30%, and the Luck that feeds it grows only with gear and blessings |
| Venom works while the Shade hides: DoTs tick on the enemy's turn, ignoring armor | Thrown knives (Attack 5) are a reach tool, not a damage source; a Shade kept out of melee range does a Ranger's job at a third of the damage |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | +2 Agility · +1 Perception · +1 Luck (plus species, plus 6 free points) |
| Pool | **Stamina** = 30 + 3 × End → **60** at End 10 |
| Armor family | **Leather** (hide ladder Rawhide → Ancient Dragon Scale); speed penalty **−3**, relieved 1 point per Strength above the set's requirement, never below 0 (Crude Leather requires Str 10) |
| Allowed weapons | **Dagger** (1h · Pierce · **light 800** · dual: basic attack strikes twice at 0.5× each) · **Short Sword** (1h · Slash · normal 1,000 · pairs with an off-hand dagger: basic at 1,000, 1.0× + 0.4×) · **Throwing Knives** (off-hand brace · Pierce · light 800 · either row · Attack 5 at F · retrieved after the fight, no ammo) |
| Weapon handling (proposed, to confirm in `08-ITEMS.md`) | Dual daggers: weaponAttack = main + 0.5 × off. Shadow skills require a dagger in the main hand; Venom and Larceny work with any kit; "any row" skills throw a knife if the Shade is in the back row and stab if it is in the front |
| Starter kit (F-grade, Crude; `08` §12) | Copper Dagger (Attack 8, req Str 6) · Copper Throwing Knives (off hand, Attack 7, req Str 5; adds 50%) · Rawhide Hood / Jerkin / Breeches / Boots / Gloves (Defense 1 / 4 / 3 / 1 / 1 = 10) · Ring of Shadows (+1% Dodge) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg. A second Copper Dagger (0.6 × 150 gold) is the first Blacksmith purchase for the dual build |
| Derived at creation (class modifiers only, all else 10) | HP 103 · Attack **40** (8 + 3.5 + 2 × 10 + 2 × 4 spare Str over the Dagger's req 6) · Defense 20 (10 + 10) · Speed **107** (100 + 10 − 3) · Stamina 60 · Crit **6%** (x = 1 + 1) · Crit Damage 152% · Accuracy 91% · Dodge 2.2% (1.2% + 1% ring) · Variance floor 0.91 · Fortune 5.5% · Detection 11 · Carry 50 kg |
| Recommended Tier I starter picks | **Veil** (Shadow) · **Backstab** (Shadow) · **Toxic Jab** (Venom) — the two-beat burst and a DoT that keeps working while the Shade is hiding. A loot-minded player takes **Pickpocket** instead of Toxic Jab |

Dual daggers are the class. The short sword exists for a Shade that keeps getting caught in the front row and wants Slash against hide-armored beasts.

---

## 3. The Ultimate — *Last Light Out*

| Field | Value |
|---|---|
| Unlock | Tier III (level 12); Skill Hall 1.0 R or the first zone-boss Tome. Own button, outside the 4 + 2 loadout |
| Cost | 100 Momentum, no Stamina |
| Weight | **800** |
| Target | One enemy, any row — never misses |
| Effect | Five hits of 0.9× Pierce (4.5×); the first hit is a guaranteed crit · Poison 3 turns and Blind 1 turn on the target · the Shade re-enters **Veil** afterwards at no cost |
| Mastery (rank 10 bonus) | Six hits; the first two crit |

The only Ultimate at light weight: the Shade acts again sooner than any other class after spending its bar, and it comes out of its Ultimate hidden, with the next Backstab already set up.

---

## 4. The three schools

*Reading the tables.* Cost is Stamina. Weight is energy subtracted after the action (light 800 · normal 1,000 · heavy 1,400). Multipliers are of Attack. "Front" = the enemy front row; "any row" = flank or throw. Each Tier II–V skill names exactly one Tier N−1 skill of its own school as prerequisite. Rank 1–10 grows by use (+4% effect, −2% cost per rank); Mastery is the rank-10 line. Insight sweet spots by tier (enemy level ≈ tier × 6): Tier II at L9–15 (the Crypts, the Vault), Tier III at L15–21 (the Fungal Deep), Tier IV at L21–27 (Emberforge). **Monster techniques** only Insight while the named monster uses the move; proposed flat 10% per witnessed use, pity at 10 (see §10).

### 4.1 Shadow — stealth, execute, crit, backstab from the front row

*Be elsewhere, then be exactly there.* Everything that says "from Veil" doubles when the Shade is Veiled; attacking ends Veil.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Veil | Active | 10 | 800 | Self | Enter Veil (untargetable by single-target attacks, max 2 turns, ends when you attack); +10 Momentum | — | Costs 0 on your first action of a fight |
| I | Backstab | Active | 12 | 800 | Single any row | 1.5× Pierce (flank: hits the back row from the front); from Veil ×2 and +30% Crit Rate | — | From Veil ×2.5 |
| I | Cold Read | Passive | — | — | Passive | Crit Rate +5%; each crit you land +5 Momentum | — | +10% Crit Rate |
| II | Shadowstep | Active | 12 | 800 | Self | Swap rows as part of the action and enter Veil for 1 turn | Veil | Veil 2 turns |
| II | Throat Cut | Active | 15 | 800 | Single front | 1.3× Pierce; Silence 2 turns (no skills); +50% against a Dazed target | Backstab | Silence 3 turns |
| II | Opportunist | Passive | — | — | Passive | +15% damage against enemies under any status; your crits against such enemies Daze 20% | Cold Read | +25% / Daze 35% |
| III | Wraith-step | Active | 22 | 800 | Self | **(monster technique: wraith)** Veil 2 turns that your own DoT ticks do not break; your next attack is Shadow element (applies Wither: −50% healing 2 turns) | Shadowstep | Also +15 Momentum |
| III | Vital Point | Active | 20 | 800 | Single front | 1.9× Pierce; below 25% HP, 3.8× | Throat Cut | Threshold 30% |
| III | Killer's Calm | Passive | — | — | Passive | Crit Damage +25%; your first crit each fight +20 Momentum | Opportunist | +40% Crit Damage |
| IV | Phantom Twin | Active | 30 | 800 | Self | For 2 turns, the first single-target attack aimed at you each turn hits a decoy and misses; +15 Momentum | Wraith-step | 3 turns |
| IV | Assassinate | Active | 35 | 1,000 | Single any row | 2.8× Pierce; from Veil: guaranteed crit and ignores 50% of the target's Defense (the anti-Plate strike) | Vital Point | Ignores 75% |
| IV | Second Shadow | Passive | — | — | Passive | Whenever an attack on you misses or is dodged, you gain Veil until your next action | Killer's Calm | Also +10 Momentum each time |
| V | Unseen Hand | Active | 40 | 800 | Party | Every ally is untargetable by single-target attacks for 1 turn (an AoE still lands); Taunts and Marks on allies are stripped | Phantom Twin | 2 turns |
| V | Severance | Active | 50 | 1,000 | Single any row | 4.5× Pierce; below 35% HP, 9.0×; if it kills, re-enter Veil for free | Assassinate | Threshold 40% |
| V | Death's Whisper | Passive | — | — | Passive | Your Crit Rate cap is 55%; a crit from Veil applies Fear 1 turn to every other enemy | Second Shadow | Fear 2 turns |

### 4.2 Venom — poison, debuffs, Shadow element

*The fight is already won; the enemy has not noticed.* Poison ticks at the holder's turn start and ignores armor — the Shade's answer to high Defense before Assassinate.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Toxic Jab | Active | 10 | 800 | Single front | 1.0× Pierce; Poison 3 turns (re-applying refreshes the duration) | — | Poison 4 turns |
| I | Crippling Dust | Active | 11 | 800 | Single any row | Blind 2 turns (−30% Accuracy) | — | Two targets |
| I | Steeped Blades | Passive | — | — | Passive | Poison you apply lasts +1 turn and ticks +15% | — | +30% |
| II | Festering Wound | Active | 15 | 800 | Single front | 1.2× Pierce; if the target is Poisoned, also Weaken 2 turns | Toxic Jab | Weaken 3 turns |
| II | Choking Cloud | Active | 16 | 1,000 | Enemy back row | Poison 2 turns and Silence 1 turn on every back-row enemy | Crippling Dust | Also Blind 1 turn |
| II | Envenom | Active | 12 | 800 | Self | Your next 3 hits apply Poison 3 turns; +5 Momentum | Steeped Blades | 5 hits |
| III | Venom Burst | Active | 24 | 1,000 | Single any row | 1.6× Shadow; consumes the target's Poison and deals its remaining ticks ×1.5 at once | Festering Wound | ×2.0 |
| III | Hag's Hex | Active | 22 | 1,000 | Single any row | **(monster technique: brine hag)** Curse 3 turns (−10% all stats) and Slow 2 turns | Choking Cloud | Curse −15% |
| III | Shadow Oil | Active | 18 | 800 | Self | For 3 turns your attacks deal Shadow element (Wither: −50% healing) and +15% damage | Envenom | 4 turns, +20% |
| IV | Plague Knife | Active | 30 | 800 | Single any row | 2.0× Pierce; Poison 4 turns; when a Poisoned target dies, its Poison spreads to every enemy in its row | Venom Burst | Spreads to both rows |
| IV | Black Mirror | Active | 28 | 800 | Single any row | Strips every buff from the target (Fortify, Haste, Shield, Regen) and applies Curse 2 turns | Hag's Hex | Stolen Shield goes to you |
| IV | Nightshade Veins | Passive | — | — | Passive | Each Poison tick on an enemy restores 3% of your Stamina; Poison on a target below 20% HP ticks double | Shadow Oil | 5% Stamina |
| V | Miasma | Active | 45 | 1,400 | All enemies | 1.2× Shadow to every enemy in both rows; Poison 4 turns; Blind 1 turn | Plague Knife | 1.5× |
| V | Widow's Kiss | Active | 40 | 800 | Single front | 3.0× Shadow; Petrify 1 turn (−1,000 energy) if the target is Poisoned; bosses: Stun 1 turn instead | Black Mirror | Petrify on any target |
| V | Toxicologist | Passive | — | — | Passive | Your Poison can hold two separate lines on one target (two tick lines, two durations); your DoTs ignore Resistance | Nightshade Veins | Three lines |

### 4.3 Larceny — lockpicking, stealing mid-fight, trap tricks, +loot

*The dungeon pays those who ask impolitely.* Steals are once per enemy per fight; a steal that would exceed the room's gold cap pays the cap (the sim keeps the economy honest).

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Pickpocket | Active | 8 | 800 | Single front | 0.6× Pierce; steal gold = 5 × enemy level (once per enemy) | — | 10 × level |
| I | Light Fingers | Passive | — | — | Passive | Lockpicking +2; a locked chest you open rolls one grade up 10% of the time | — | Lockpicking +4; 20% |
| I | Smoke Pellet | Active | 10 | 800 | Party | Every ally Dodge +15% for 1 turn; the party's Flee chance +25% this turn | — | 2 turns |
| II | Filch | Active | 14 | 800 | Single front | 0.8× Pierce; steal a **common part** from a monster or a potion from a Grinning Company bandit (once per enemy) | Pickpocket | 25% chance of a rare part instead |
| II | Trap Trick | Active | 12 | 800 | Single any row / corridor | Corridor: pocket a trap you have disarmed (hold up to 2). Combat: throw a pocketed trap — 1.2× Pierce and Root 1 turn | Light Fingers | Hold 3; thrown traps 1.6× |
| II | Vanish | Active | 15 | 800 | Self | Enter Veil and swap to the back row; your next Larceny skill costs 0 | Smoke Pellet | Also +10 Momentum |
| III | Mug | Active | 20 | 800 | Single front | 1.8× Pierce; steal gold = 15 × enemy level; against a boss, steal a guaranteed common part | Filch | 25 × level |
| III | Saboteur | Passive | — | — | Passive | Trap Disarm +2; every successful disarm pockets the trap (Trap Trick); pocketed traps deal +50% | Trap Trick | Disarm failures never trigger on you |
| III | Sleight | Active | 18 | 800 | Single any row | Steal one buff from the target (Fortify, Haste, Shield or Regen) and give it to an ally of your choice | Vanish | Steal two |
| IV | Heist | Active | 30 | 1,000 | Single front | 2.4× Pierce; the target's next part roll is made at ×2 (as a part-break); against bandits, steals their held item | Mug | Part roll ×3 |
| IV | Treasure Sense | Passive | — | — | Passive | Detection +4 for secrets and hidden treasure; the party finds +10% gold | Saboteur | +6 / +20% |
| IV | Grand Larceny | Active | 28 | 800 | All enemies | Strip every buff from every enemy; each ally gains Shield = 5% of its max HP per buff stripped | Sleight | Stripped Haste becomes Slow |
| V | King's Ransom | Active | 45 | 1,000 | Single front | 3.5× Pierce; steal gold = 50 × enemy level; against a boss, steal a guaranteed rare part | Heist | 80 × level |
| V | Phantom Thief | Passive | — | — | Passive | Locked chests open without a check and their traps are disarmed; your Fortune cap is 35%; in-dungeon chests roll a grade up twice as often for you | Treasure Sense | Also Skeleton Keys are never consumed |
| V | Vault Cracker | Active | 40 | 1,400 | Single any row / corridor | Corridor: open any locked door or chest with no check and no trap. Combat: 2.0× Pierce that ignores all Defense against constructs and armored elites (vault sentinels, bone knights, forge-golems) | Grand Larceny | 2.6× |

---

## 5. Field-skill affinities

| Field skill | Starting rank bonus |
|---|---|
| Lockpicking | **+2** (the rulebook's Shade bonus, §7.6; Light Fingers adds +2 more) |
| Trap Disarm | 0 (Saboteur adds +2 at Tier III) |
| Foraging | 0 |
| Field Repair | 0 |
| First Aid | 0 |
| Haggling | **+2** (the one who knows what things are worth) |
| Cooking | 0 |
| Cartography | 0 |

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Play pattern |
|---|---|---|---|---|
| **Knife in the Dark** (L1–12, dual daggers) | Veil · Backstab · Throat Cut · Shadowstep | Cold Read · Opportunist | Guard (Cellar Hound, in front) | Veil on turn one (free at Mastery), Backstab the back-row caster for 3.0× at +30% crit, Throat Cut the elite to Silence its technique, Shadowstep out when the strip shows two enemies before your next turn. The pet in Guard stance is the second body in the front row. |
| **Slow Death** (L5+, any kit) | Toxic Jab · Envenom · Crippling Dust · Festering Wound | Steeped Blades · Cold Read | Fierce (Crypt Bat) | Envenom, then Toxic Jab the three things on the field and Blind the one that hits hardest; the Poison does the work on the enemies' turns while you Guard for Momentum. Low burst, immune to the Plate problem (Poison ignores armor), the solo Shade's build. |
| **Cutpurse** (L12+, loot delves) | Pickpocket · Filch · Smoke Pellet · Mug | Light Fingers · Treasure Sense | Forage (Ember Fox) | Every enemy is Pickpocketed before it dies and every bandit Filched; Mug the elite for a part and the boss for a guaranteed one. Lowest damage of the three; the party ends the delve with +25–40% gold and every locked chest opened. Bring a Blade. |

---

## 7. How it grows by use

| Attribute | Tagged by (per §2.1 / §5.2) | Typical Shade rate |
|---|---|---|
| **Agility** | attacking, dodging, disarming | fastest — 800-weight actions mean more attacks per fight than any class |
| **Perception** | landing crits; finding traps, secrets, treasure; scouting | fast — Cold Read's crits plus Treasure Sense's finds |
| **Strength** | landing melee hits | steady — daggers land two hits per basic |
| **Vitality** | damage taken | moderate and spiky — the Shade is not hit often, but hard |
| **Willpower** | resisting a status | moderate — Fear and Web checks on the front row |
| **Endurance** | taking hits | slow |
| **Luck** | not trainable; gear, blessings and the proposed +1 per final-boss first kill | — |

**A level-20 Shade** (160 skill ranks, ~3,500 hits landed, ~60 finds) looks like: Str 14 · Agi **26** · Vit 14 · End 12 · Wis 11 · Per **22** · Will 14 · Luck 12 (one blessing). With two C-grade Steel Daggers (weaponAttack 14.7 + 7.4 = 22; Attack 22 + 2 × 14 + 2 × 4 spare Str = **58**), Speed 100 + 80 − 3 + 3 relief = **180** — 2.25 light actions for every normal action of a Speed-80 enemy. Crit 5% + 40 × 14 / 94 = 11% base, **16% with Cold Read, 46% from Veil** (cap 45% before Death's Whisper); Crit Damage 150 + 24 + 8 + 25 (Killer's Calm) = 207%. Dodge 30 × 17 / 77 = 6.6%. The level-20 Shade has 188 HP (30 + 7 × 14 + 60) and Defense 32; it lives by not being targeted, and its Veil → Assassinate opens a boss phase for 2.8× × 2 × 2.07 ≈ 11.6× Attack on a guaranteed crit.

---

## 8. Worked example — floor 3, level 4, the Cellars

**Setup.** 3-player party; only the Shade's and the monsters' lines are shown, allies elided (…). Shade L4: Str 10 · Agi 14 · Vit 10 · End 10 · Per 12 · Luck 11; two Common (E) Bronze Daggers Attack 8 each (req Str 10) → weaponAttack 8 + 4 = 12; Crude Leather Defense 8. Derived: **Attack 32** (12 + 2 × 10) · **Defense 18** · HP 112 · Speed **117** · Stamina 60 · Crit 6.4% + 5% (Cold Read) = **11%** · Crit Damage 154%. Front row. Loadout Knife in the Dark. Jitter ignored.

**Monsters (L4, placeholder stats pending `06-MONSTERS.md`).** Giant Rat — front, HP 38, Def 6, Speed 130, Attack 18, Bite 1.0× Pierce. Cellar Spider — back, HP 44, Def 10, Speed 115, Attack 20, Web Spit (Web 1 turn, either row) / Venom Bite 0.9× + Poison 3 turns. Grinning Cutpurse — front, HP 56, Def 14, Speed 105, Attack 24, Slash 1.0× / Dirty Trick (Blind 1 turn).

**Initiative (0–400):** Rat 250 · Spider 120 · Cutpurse 300 · Shade 400 · pet 60.

| Tick | Actor | Action · cost | Arithmetic | Result |
|---|---|---|---|---|
| 6 | **Shade** (1,102) | **Veil** · 10 Sta · 800 | — | Shade Veiled (untargetable by single-target attacks) · Sta 50 · Momentum 30 (20 act + 10) · accumulator 302 |
| 6 | Giant Rat (1,030) | Bite — cannot target the Veiled Shade, bites the pet in Guard stance | … | — |
| 7 | Cutpurse (1,035) | Slash on the front-row ally | … | Momentum 35 |
| 8 | Spider (1,040) | Web Spit on the front-row ally | — | ally Webbed 1 turn |
| 12 | **Shade** (1,004; +6 Sta regen) | **Backstab** on the Spider (flank: back row from the front) · 12 Sta · 800 | Damage = Attack 32 × skill 1.5 × Veil ×2 × (1 + 0) × element 1.0 × 100 / (100 + 10) × crit 1.0 × variance 0.97 = 96 × 0.909 × 0.97 = **85** (crit roll at 11% + 30% = 41% fails; a crit would have been 131) | Spider dead (44) · Veil ends · Sta 44 · Momentum 55 · accumulator 204 |
| 14 | Giant Rat (1,070) | Bite on the Shade, now visible | 18 × 100 / (100 + 18) = 15.3 × 0.95 = **15** (Dodge 1.6% fails) | Shade 112 → 97 · Momentum 65 |
| 19 | **Shade** (1,023) | **Throat Cut** on Cutpurse · 15 Sta · 800 | 32 × 1.3 × 100 / (100 + 14) × 0.97 = 41.6 × 0.877 × 0.97 = **35**; Silence 2 turns (no Dirty Trick) | Cutpurse 56 → 21 · Sta 35 · Momentum 85 (+ally actions) |
| 22 | Cutpurse (1,005) | Slash on the Shade (Silenced: basic only) | 24 × 100 / 118 = 20.3 × 0.98 = **20** | Shade 97 → 77 |
| 26 | **Shade** (1,046) | **Backstab** (no Veil) on Cutpurse · 12 Sta | 32 × 1.5 × 100 / 114 × 0.97 = **41** | Cutpurse dead (21) · Sta 29 · Momentum 100 — Ultimate would be ready at level 12; the Rat is left to the allies |

Four Shade actions by tick 26 against the Warden's two by tick 20 — the same count as the Blade, with a different shape: one setup turn, one 85-damage kill from a 32-Attack hero, then two ordinary stabs. It took 35 damage in the three ticks it was visible; a Shade that is seen is a Shade that is hit.

---

## 9. Visual brief — the Shade gear set (shared humanoid rig, Blender)

- **Silhouette:** a narrow blade of a figure broken by one diagonal — a short half-cloak thrown over the left shoulder — with a half-mask and the glint of knife handles along the belt. The smallest, most vertical outline of the four.
- **Modular meshes (five armor pieces + weapons):** Helmet (a half-mask over the nose and mouth with a close hood; a mask-only variant for Draconid snouts) · Chest (a fitted dark jerkin with the half-cloak as a separate cloth mesh on the left shoulder bone — the cloak is the silhouette and must simulate or at least sway) · Legs (wrapped leggings with a knife belt holding six throwing-knife handles as a single strip mesh) · Boots (soft split-toe boots) · Gloves (fingerless wraps, both hands symmetric) · Dagger on each hand bone, reversed grip in the idle pose · Short Sword variant on the main hand · Throwing-knife brace on the belt (the same strip mesh; one handle hides on each throw and returns after the fight).
- **Palette:** ink black (jerkin, hood) · dusk violet (cloak lining, mask trim) · ash grey (wraps, leggings) · metal: **blackened steel with a silver edge**.
- **Must read at 200 px:** the half-mask, the cloak diagonal, and the knife handles at the belt; when Veiled, the whole set drops to 40% opacity with a violet rim light so a hidden Shade is still findable by its own player.
- **F-grade vs S-grade (same mesh set):** F (Crude/Rawhide) — a plain cloth mask, a frayed cloak, daggers with wrapped-cord grips. S (Legendary/Drake Scale) — a scale-faced mask with a silver edge pass, a cloak lined in emissive violet, daggers with a thin emissive edge and a smoke particle on the draw. Mesh set unchanged; mask and cloak textures and the blade edge material change.
- **Species notes:** Human baseline. Dwarf: 0.85 / 1.15 — cloak shortened (*cloak_short* key) so it does not drag. Elf: 1.05 / 0.9, the canonical Shade body. Orc: 1.10 / 1.2, mask widened for tusks, knife-belt strip stretched. Halfling: 0.70, cloak and knives scaled with the torso, half-mask swapped for a scarf so the face reads. Draconid: mask-only variant with a snout key, leggings split for the tail, cloak clipped shorter at the back for the tail.

---

## 10. Open questions (for James)

1. ~~**Veil as a status or a class state.** `03` §3.5 lists Veil in the status table as a Shade-only *state* (Ultimates, AoE and DoTs ignore it; no cleanse or strip touches it), so it lives in `content/statuses/veil.json` like the rest. Should it instead be a full status so that strip rules and the status UI treat it like everything else?~~ *Checkpoint 1 (D-099): a Shade-only state in the status table, as built (`content/statuses/veil.json`, D-044); no cleanse or strip touches it.*
2. ~~**Mid-fight gold.** Pickpocket / Mug / King's Ransom steal 5 / 15 / 50 × enemy level per enemy, which at floor 3 is about +15% of a delve's R. Is that the right size for a class perk, or should steals be a share of the monster's own gold drop (say +50%) so the economy cannot be farmed with a Cutpurse party?~~ *Checkpoint 1 (D-099): keep the flat steals, as built — once per enemy per fight and capped at the room's gold, which already stops a Cutpurse party farming; the runner watches gold per delve.*
3. ~~**Monster-technique Insight rule.** Wraith-step and Hag's Hex (both Tier III) come from Gravehollow monsters at L8–14, below the Tier III sweet spot of L18. Proposed: a flat 10% per witnessed use, pity at 10 — confirm?~~ *Checkpoint 1 (D-028): confirmed — a flat 10% per witnessed use, pity at 10.*
4. ~~**Pierce versus Plate.** The Shade's armored-elite problem is solved at Tier IV (Assassinate ignores 50% Defense) and Tier V (Vault Cracker). Is a 20-level gap acceptable, or should Poison's armor-ignore be the explicit early answer and Assassinate's line moved to Tier III?~~ *Checkpoint 1 (D-099): Poison is the early answer, as built (it ignores Defense, `03` §3.5, and Venom starts at Tier I); Assassinate stays at Tier IV.*
5. ~~**Severance** (Tier V) at 9.0× below 35% HP is the largest single multiplier in the four sheets. Keep it as the Shade's identity, or cap execute multipliers at 6.0× and give the surplus to crit?~~ *Checkpoint 1 (D-099): cap every execute at 6.0× and give the rest to crit — Severance below 35% HP becomes 6.0× with a guaranteed crit.*
