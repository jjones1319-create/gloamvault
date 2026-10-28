# Blade — class sheet

*Last updated 2026-10-27 · rev. 2 (checkpoint 1: open questions answered by delegation; the Nightmare preset renamed Dread — D-095, D-099) · rev. 1 2026-10-26 · numbers are tuning starting points*

*Every number below (costs, multipliers, durations, the Cellars monster stats in §8) is a starting point for the simulator and the balance runner, not a commitment. Rules referenced are `03-GAME-DESIGN.md` (§2 stats, §3 timeline, §5 level-by-use, §6 gear, §7 skills). Status numbers quoted in skill lines (Bleed 25% of the applying hit per turn for 3 turns, ignores Defense · Poison 3% of max HP per turn, ignores Defense · Weaken −20% Attack · Fortify +20% Defense · Mark +20% damage taken · Slow ×0.67 Speed · Haste ×1.5 · Daze −500 energy · Petrify −1,000 energy) belong to `content/statuses/<id>.json` (`03` §3.5 is the table) and are repeated here only so the lines read on their own.*

---

## 1. Identity

The Blade is the party's damage, paid for in Defense. It is two classes in one body: the dual-wielder who takes light 800-weight actions and fills the Momentum bar with a hundred small cuts, and the greatsword carrier who takes heavy 1,400-weight swings that decide a fight in one hit. Both stand in the front row and both bleed — Mail is thinner than Plate and the Blade has no shield. On the timeline a dual Blade at Speed 108 taking 800-weight actions gets about 1.6 actions for every one of a Warden's; the heavy Blade gets fewer turns than anyone and makes each one count with execute thresholds and crits. Bloodletter is the third way: trade HP for damage and drink it back.

| Pros | Cons |
|---|---|
| Highest sustained single-target damage of the four (Twin Cut ~54 at L4 where a Warden's Slam does ~46) | Mail is weak to Blunt — maces, sentinel fists and ogre clubs hit it ×1.25 (`08` §2) |
| Two tempos in one class: 800-weight dual strikes or 1,400-weight executes | No ranged answer at all; a spider in the back row is untouchable until the front row is dead |
| Momentum engine: Iron Dance adds Momentum on every hit, so the Ultimate comes every 3–4 turns | Front-row only; if the Warden falls, the Blade is the wall, with Defense 24 |
| Bloodletter sustain (Red Thirst, Drink Deep) lets a solo Blade clear floors without potions | Pays Defense for Attack by design: at creation 103 HP and no Block |
| Execute thresholds (30–40% HP) turn the party's chip damage into kills | Two weapons wear twice as fast as one; a dual Blade repairs two blades every delve |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | +2 Strength · +2 Agility (plus species, plus 6 free points) |
| Pool | **Stamina** = 30 + 3 × End → **60** at End 10 |
| Armor family | **Mail** (metal ladder Copper → Starmetal); speed penalty **−10**, relieved 1 point per Strength above the set's requirement (Crude Mail requires Str 10) |
| Allowed weapons | Sword (1h · Slash · normal 1,000) · Axe (1h · Slash · normal 1,000 · +5% Crit Damage) · **Greatsword** (2h · Slash · heavy 1,400) · **Great Axe** (2h · Slash · heavy 1,400 · +10% Crit Damage) · **Dual** (any two 1h: basic attack is **light 800** and strikes twice at 0.5× each) |
| Weapon handling (`08-ITEMS.md` §1 owns it) | Dual: weaponAttack = main + 0.5 × off; basic = 2 × 0.5× at 800. Two-hander: basic = **1.0×** at 1,400 — the weight is paid back by the higher Base Attack (Greatsword 20 vs Longsword 12) and **Cleave** (a basic also hits a second front-row enemy for 50%); a Crude Greatsword requires Str 14. Iron Dance skills require dual; Executioner skills require a two-hander; Bloodletter works with either |
| Starter kit (F-grade, Crude; `08` §12) | Copper Longsword (Attack 12, req Str 10) · Copper Dagger (Attack 8, req Str 6; off hand adds 50%) · Copper Coif / Hauberk / Chausses / Treads / Mitts (Defense 2 / 6 / 4 / 2 / 1 = 15) · Ring of Might (+2 Attack) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg. A Crude Greatsword (Attack 20, req Str 14) is sold by Hesper for 0.05 R |
| Derived at creation (class modifiers only, all else 10) | HP 103 · Attack **46** dual (12 + 4 + 2 × 12 + 2 × 2 spare Str + 2 ring) or 46 greatsword (20 + 24 + 2; Str 12 is 2 under the Greatsword's requirement: −10 Speed until trained) · Defense 25 (15 + 10) · Speed **102** (100 + 10 − 10 + 2) · Stamina 60 · Crit 5% · Crit Damage 154% · Accuracy 90% · Dodge 1% · Carry 56 kg · Detection 10 |
| Recommended Tier I starter picks | **Twin Cut** (Iron Dance) · **Open Vein** (Bloodletter) · **Flowing Guard** (Iron Dance) — hits, a DoT that keeps working while the Blade is Dazed, and the only Dodge it will see for a while. A greatsword starter takes **Cleaving Blow · Wind-up · Headsman's Eye** instead |

---

## 3. The Ultimate — *Crimson Crescendo*

| Field | Value |
|---|---|
| Unlock | Tier III (level 12); Skill Hall 1.0 R or the first zone-boss Tome. Own button, outside the 4 + 2 loadout |
| Cost | 100 Momentum, no Stamina |
| Weight | 1,000 (any weapon) |
| Target | One enemy any row, then every other enemy — never misses |
| Effect | 3.5× Slash to the target, then 1.0× Slash to every other enemy in both rows · Bleed 2 turns on everything hit · heal 15% max HP · if the main target dies, Momentum resets to 30 instead of 0 |
| Mastery (rank 10 bonus) | 4.0× / 1.2×; heal 25% |

The Blade's Ultimate is the only time it hits the back row. Iron Dance builds reach it every three or four turns; Executioner builds save it for the execute window.

---

## 4. The three schools

*Reading the tables.* Cost is Stamina. Weight is energy subtracted after the action (light 800 · normal 1,000 · heavy 1,400). Multipliers are of Attack; heavy 1,400-weight skills carry about ×1.3 on their multiplier to pay for the weight. "Front" = the enemy front row. Each Tier II–V skill names exactly one Tier N−1 skill of its own school as prerequisite. Rank 1–10 grows by use (+4% effect, −2% cost per rank); Mastery is the rank-10 line. Insight sweet spots by tier (enemy level ≈ tier × 6): Tier II at L9–15 (the Crypts, the Vault), Tier III at L15–21 (the Fungal Deep), Tier IV at L21–27 (Emberforge). **Monster techniques** only Insight while the named monster uses the move; proposed flat 10% per witnessed use, pity at 10 (see §10).

### 4.1 Iron Dance — dual-wield, light strikes, many hits, Momentum

*Every strike is a step; the dance ends when the bar is full.* All actives are weight 800 and require two one-handed weapons.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Twin Cut | Active | 9 | 800 | Single front | Two hits of 0.6× Slash (1.2×); +5 extra Momentum | — | A third hit at 0.4× |
| I | Quickstep | Active | 8 | 800 | Self | Your next action, whatever it is, has weight 800; +10 Momentum | — | Also +10% Dodge for 1 turn |
| I | Flowing Guard | Passive | — | — | Passive | After each 800-weight action, +5% Dodge until your next turn (stacks to 15%) | — | +8% per stack (cap 24%) |
| II | Flurry | Active | 14 | 800 | Single front | Three hits of 0.55× Slash (1.65×); each hit that lands +3 Momentum | Twin Cut | Four hits |
| II | Blade Rhythm | Passive | — | — | Passive | Each consecutive Iron Dance skill +8% damage (max 3 stacks); a basic attack or a non-Iron-Dance action resets it | Quickstep | Max 5 stacks |
| II | Mirror Step | Active | 12 | 800 | Self | Dodge +30% for 1 turn; the first attack you dodge is answered with a 1.0× riposte | Flowing Guard | Riposte 1.5× |
| III | Crescent Flurry | Active | 20 | 800 | Enemy front row | Two hits of 0.6× Slash to each front-row enemy (1.2× each) | Flurry | Three hits |
| III | Momentum Surge | Active | 18 | 800 | Self | +30 Momentum; Haste 1 turn | Blade Rhythm | +40 Momentum |
| III | Thousand Steps | Passive | — | — | Passive | Iron Dance skills cost −2 Stamina per Blade Rhythm stack; dodging an attack grants +10 Momentum | Mirror Step | −3 per stack |
| IV | Tempest Dance | Active | 30 | 800 | Random enemies, any row | Five hits of 0.6× Slash spread over random enemies in both rows (3.0× total) — the dual Blade's only reach | Crescent Flurry | Seven hits |
| IV | Quicksilver | Active | 28 | 800 | Self | Act again immediately: refund 800 energy to your accumulator; once per fight | Momentum Surge | Twice per fight |
| IV | Perfect Tempo | Passive | — | — | Passive | Every third Iron Dance action in a fight costs no Stamina | Thousand Steps | Every second |
| V | Hundred Cuts | Active | 45 | 800 | Single front | Eight hits of 0.5× Slash (4.0×); each hit that lands +4 Momentum; Bleed 2 turns | Tempest Dance | Ten hits |
| V | Unending Rhythm | Active | 40 | 800 | Self | Haste 3 turns; Blade Rhythm's cap is 6 stacks for the rest of the fight | Quicksilver | Haste 4 turns |
| V | Edge of the Dance | Passive | — | — | Passive | Your Dodge cap is 40%; every dodge is answered by a free 0.8× riposte | Perfect Tempo | Riposte 1.2× |

### 4.2 Executioner — two-handed heavy strikes, execute thresholds, crits

*One swing, decided before it starts.* Heavy actives are weight 1,400 and require a greatsword or great axe; Wind-up is the exception.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Cleaving Blow | Active | 12 | 1,400 | Single front | 1.8× Slash | — | Weaken 1 turn |
| I | Wind-up | Active | 8 | 800 | Self | Your next Executioner skill deals +40% and cannot be interrupted (no energy push-back from hits while charging); +10 Momentum | — | +60% |
| I | Headsman's Eye | Passive | — | — | Passive | +10% Crit Rate against enemies below 40% HP | — | +20% |
| II | Execute | Active | 16 | 1,400 | Single front | 1.7× Slash; against a target below 30% HP, 3.4× | Cleaving Blow | Threshold 35% |
| II | Sundering Swing | Active | 18 | 1,400 | Enemy front row | 1.1× Slash to each; Weaken 2 turns | Wind-up | Also strips Fortify |
| II | Heavy Hands | Passive | — | — | Passive | Crit Damage +20%; your heavy swings cannot be Dodged by Dazed, Rooted or Grabbed targets | Headsman's Eye | +35% |
| III | Skull Splitter | Active | 24 | 1,400 | Single front | 2.4× Slash; Stun 1 turn on a crit | Execute | Stun on any hit against a target below 40% HP |
| III | Breaker's Arc | Active | 26 | 1,400 | Single front | 2.0× Blunt (the flat and pommel — the anti-Mail swing); **part-break**: marks a limb, doubling that monster's rare-part roll (§6.5); in the corridor, forces a door or chest at +5 to the Strength check | Sundering Swing | Rare-part roll ×3 |
| III | Grim Harvest | Passive | — | — | Passive | A kill with an Executioner skill refunds its Stamina and grants +20 Momentum | Heavy Hands | +30 Momentum |
| IV | Guillotine | Active | 35 | 1,400 | Single front | 2.6× Slash; below 40% HP, 5.2×; never misses a Marked target | Skull Splitter | Threshold 45% |
| IV | Bone Knight's Cleave | Active | 32 | 1,400 | Enemy front row | **(monster technique: bone knight)** 1.6× Slash to each front-row enemy; Fear 1 turn | Breaker's Arc | 2.0× |
| IV | Death's Ledger | Passive | — | — | Passive | All Executioner execute thresholds +10%; crits against a target below its threshold deal +50% Crit Damage | Grim Harvest | Thresholds +15% |
| V | Final Verdict | Active | 50 | 1,400 | Single front | 4.0× Slash; if it kills, you gain Haste 2 turns and the next ally action deals +30% | Guillotine | 4.5× |
| V | Mountain Cleaver | Active | 45 | 1,400 | Front row + behind | 2.2× Slash to every front-row enemy and to the enemy directly behind each (cleaves through to the back row) | Bone Knight's Cleave | 2.6× |
| V | Reaper's Patience | Passive | — | — | Passive | If your previous action was Guard, your next heavy skill has weight 1,000 and crits automatically | Death's Ledger | Also +20% damage |

### 4.3 Bloodletter — bleed, lifesteal, berserk at low HP

*Blood out is blood in.* Works with any weapon; the sustain school and the solo Blade's school.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Open Vein | Active | 10 | 1,000 | Single front | 1.2× Slash; Bleed 3 turns | — | Bleed 4 turns |
| I | Reckless Swing | Active | 9 | 1,000 | Single front | 1.5× Slash; you take 5% max HP (tags Vitality, +10 Momentum) | — | No self-damage above 50% HP |
| I | Red Thirst | Passive | — | — | Passive | Basic attacks heal you for 8% of damage dealt | — | 15% |
| II | Hemorrhage | Active | 15 | 1,000 | Single front | 1.4× Slash; consumes the target's Bleed and deals all its remaining ticks at once | Open Vein | Also re-applies Bleed 2 turns |
| II | Pain Threshold | Passive | — | — | Passive | Below 50% HP: +15% Attack; below 25%: +30% Attack and +10 Speed | Reckless Swing | +25% / +45% |
| II | Drink Deep | Active | 14 | 1,000 | Single front | 1.3× Slash; heal 50% of damage dealt | Red Thirst | Heal 75% |
| III | Crimson Field | Active | 24 | 1,000 | Enemy front row | 0.9× Slash to each; Bleed 2 turns on each; heal 10% of the total | Hemorrhage | Bleed 3 turns |
| III | Berserk | Active | 20 | 800 | Self | For 3 turns: +25% Attack, +15 Speed, −20% Defense, Momentum gain ×1.5; you cannot Guard | Pain Threshold | 4 turns; −10% Defense |
| III | Ghoul's Grasp | Active | 22 | 1,000 | Single front | **(monster technique: ghoul)** 1.6× Pierce; Grab 1 turn (the target cannot act until an ally frees it); heal 30% of damage dealt | Drink Deep | Heal 50% |
| IV | Exsanguinate | Active | 32 | 1,000 | Single front | 2.4× Slash, +50% per turn of Bleed remaining on the target (cap +150%); removes the Bleed | Crimson Field | Cap +200% |
| IV | Undying Rage | Passive | — | — | Passive | Once per fight, a hit that would down you while Berserk leaves you at 1 HP with Regen 10% max HP for 2 turns | Berserk | Works outside Berserk too |
| IV | Blood Price | Active | 28 | 800 | Self | Spend 25% max HP: restore 40% Stamina and +30 Momentum | Ghoul's Grasp | Spend 15% |
| V | Red Tide | Active | 45 | 1,400 | All enemies | 2.0× Slash to every enemy in both rows; Bleed 3 turns; heal 20% of the total | Exsanguinate | 2.4× |
| V | Deathless | Passive | — | — | Passive | Pain Threshold's bonuses are doubled; Undying Rage triggers twice per fight | Undying Rage | Regen lasts 3 turns |
| V | Sanguine Pact | Active | 40 | 800 | Party | Every ally heals 15% of their damage dealt for 3 turns; you Bleed 3 turns | Blood Price | 4 turns; no self-Bleed |

---

## 5. Field-skill affinities

| Field skill | Starting rank bonus |
|---|---|
| Lockpicking | 0 |
| Trap Disarm | 0 |
| Foraging | 0 |
| Field Repair | **+2** (two blades to keep — the Blade learns the whetstone first) |
| First Aid | 0 |
| Haggling | 0 |
| Cooking | **+2** (the camp cook; a Bloodletter needs the meals) |
| Cartography | 0 |

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Play pattern |
|---|---|---|---|---|
| **Dancer** (L1–12, dual swords) | Twin Cut · Flurry · Quickstep · Mirror Step | Flowing Guard · Blade Rhythm | Fierce (Cellar Hound) | Twin Cut, Flurry, Twin Cut — every action is 800 and the Rhythm stacks climb to +24%; Mirror Step when the strip shows two enemies acting before you; the Ultimate lands every fourth turn. Watch Stamina: Flurry twice in a row drains 28 of 60. |
| **Headsman** (L5+, greatsword) | Cleaving Blow · Execute · Wind-up · Sundering Swing | Headsman's Eye · Heavy Hands | Guard (Moss Tortoise) | Wind-up (800), then a 1,400-weight swing at +40%; let the Warden and Ranger bring an elite to 30% and Execute it for 3.4×. Sunder the front row when three fodder stand there. Fewest turns of any build — each one is a decision. |
| **Red Mist** (L20+, solo or Dread) | Open Vein · Hemorrhage · Berserk · Exsanguinate | Pain Threshold · Undying Rage | Mend (Wisp) | Open Vein on everything, Berserk at 50% HP, Exsanguinate the thing with three Bleed turns left for 2.4× +150%. The pet heals; Red Thirst (swap it in for Undying Rage below L20) pays the Berserk tax. Dangerous and self-sufficient. |

---

## 7. How it grows by use

| Attribute | Tagged by (per §2.1 / §5.2) | Typical Blade rate |
|---|---|---|
| **Strength** | landing melee hits, forcing doors and chests | fastest — a dual Blade lands 2–3 hits per action |
| **Agility** | attacking, dodging | fast — every attack tags it; Flowing Guard and Mirror Step add dodges |
| **Vitality** | damage taken per 10% max HP, surviving under 25% | fast for Bloodletter (Reckless Swing's self-damage counts), moderate otherwise |
| **Endurance** | taking hits (armor-absorbed counts) | moderate — front row, but less often targeted than a Taunting Warden |
| **Perception** | landing crits | slow-moderate for Executioner (Headsman's Eye crits tag it) |
| **Willpower** | resisting a status | slow |
| **Luck** | not trainable | — |

**A level-20 Blade** (160 skill ranks, ~3,000 hits landed) looks like: Str **24** · Agi **22** · Vit 16 · End 14 · Wis 10 · Per 13 · Will 11 · Luck 10. In C-grade Steel Mail (Defense ~34 + 14 = 48) with two C-grade Steel swords (Attack 24.5 each → 37 + 2 × 24 + 2 × 14 spare = **113**), Speed 100 + 60 − 10 + 10 (relief is capped at the penalty) = **160** — the dual Blade now takes two 800-weight actions for every one of a Speed-80 enemy's. Crit 5% + 40 × 3 / 83 = 6.4% (still low without Luck gear — the Executioner leans on Headsman's Eye). HP 30 + 7 × 16 + 60 = 202. The level-20 Blade is a buzzsaw with 200 HP; it still cannot reach the back row and still dies to a Grab in a bad spot.

---

## 8. Worked example — floor 3, level 4, the Cellars

**Setup.** 3-player party; only the Blade's and the monsters' lines are shown, allies elided (…). Blade L4: Str 13 · Agi 13 · Vit 11 · End 11; two Common (E) Bronze Swords Attack 14 each (req Str 10) → weaponAttack 14 + 7 = 21; Crude Mail Defense 14. Derived: **Attack 53** (21 + 2 × 13 + 2 × 3 spare Str) · **Defense 25** · HP 119 · Speed **108** · Stamina 63 · Crit 5%. Loadout Dancer. Jitter ignored.

**Monsters (L4, placeholder stats pending `06-MONSTERS.md`).** Giant Rat — front, HP 38, Def 6, Speed 130, Attack 18, Bite 1.0× Pierce. Cellar Spider — back, HP 44, Def 10, Speed 115, Attack 20, Web Spit (Web 1 turn, either row) / Venom Bite 0.9× + Poison 3 turns. Grinning Cutpurse — front, HP 56, Def 14, Speed 105, Attack 24, Slash 1.0× / Dirty Trick (Blind 1 turn).

**Initiative (0–400):** Rat 250 · Spider 120 · Cutpurse 300 · Blade 400 · pet 60.

| Tick | Actor | Action · cost | Arithmetic | Result |
|---|---|---|---|---|
| 6 | **Blade** (1,048) | **Twin Cut** on Cutpurse · 9 Sta · 800 | Per hit: Attack 53 × skill 0.6 × (1 + 0) × element 1.0 × 100 / (100 + 14) × crit 1.0 × variance 0.96 = 31.8 × 0.877 × 0.96 = **27**; two hits = **54** | Cutpurse 56 → 2 · Sta 63 → 54 · Momentum 25 (20 + 5) · Flowing Guard +5% Dodge · accumulator 248 |
| 6 | Giant Rat (1,030) | Bite on Blade | 18 × 100 / (100 + 25) = 14.4 × 0.95 = **14** | Blade 119 → 105 · Momentum 35 |
| 7 | Cutpurse (1,035) | Slash on Blade | 24 × 100 / 125 = 19.2 × 0.97 = **19** (Dodge 6% fails) | Blade 105 → 86 · Momentum 45 |
| 8 | Spider (1,040) | Web Spit on the back-row ally | — | ally Webbed 1 turn |
| 13 | **Blade** (1,004; +6 Sta regen) | **Twin Cut** on Rat · 9 Sta · 800 | 53 × 0.6 × (1 + 0.08 Blade Rhythm, second consecutive Iron Dance skill) × 100 / (100 + 6) × 0.96 = 34.3 × 0.943 × 0.96 = **31** × 2 = **62** | Rat dead (38) · Sta 51 · Momentum 70 (+ally actions) · accumulator 204 |
| 17 | Spider (1,075) | Venom Bite on Blade | 20 × 0.9 × 100 / 125 = 14.4 → **14** + Poison 3 turns (3% of max HP ≈ 4 per tick) | Blade 86 → 72 |
| 21 | **Blade** (1,068) | **Basic attack** on Cutpurse (2 HP) · free · 800 | 53 × 0.5 × 100 / 114 × 0.95 = **22** per hit | Cutpurse dead · Sta 51 + 6 + 15% = 66 → 63 cap · Momentum 90 · Rhythm resets |
| 28 | **Blade** (1,024) | **Twin Cut** on Spider — front row empty, melee now reaches the back · 9 Sta | 53 × 0.6 × 100 / 110 × 0.96 = 27.7 → **28** × 2 = **56** | Spider dead (44) · Momentum 100 — Ultimate would be ready at level 12 |

Four Blade actions in 28 ticks against the Warden's two in 20: that is the Speed difference (108 vs 82) and the 800 weight. The Blade killed all three monsters itself and took 47 damage plus 12 of Poison — half its HP for one ordinary room, which is why Bloodletter exists and why the Blade wants a Warden in front of it.

---

## 9. Visual brief — the Blade gear set (shared humanoid rig, Blender)

- **Silhouette:** an X — two sword hilts crossed above the shoulders (dual) or one long diagonal from hip to shoulder (greatsword); narrow waist, high mail collar, bare forearms. The leanest of the two metal-armor classes.
- **Modular meshes (five armor pieces + weapons):** Helmet (open coif with a nasal bar; a hoodless variant for Draconid horns) · Chest (hauberk to mid-thigh with a leather chest strap and a single spaulder on the lead shoulder) · Legs (mail chausses under leather thigh straps) · Boots (riding boots, buckled) · Gloves (half-gauntlets, open palm) · Sword / Axe on each hand bone, with a back-scabbard pair mesh on the spine bone for dual · Greatsword / Great Axe as a two-hand pose set with a back-carry mesh.
- **Palette:** charcoal mail (base) · russet leather straps · bleached-linen under-tunic · metal: **dull iron**.
- **Must read at 200 px:** the crossed hilts above the shoulders (or the long two-hander diagonal), the single spaulder, the bare forearm — the Blade must read as "two weapons, no shield" against the Warden's "one shield" at a glance.
- **F-grade vs S-grade (same mesh set):** F (Crude/Copper) — rust-flecked rings, a cracked leather strap, plain wrapped hilts. S (Legendary/Adamantine) — blued-steel rings with a bronze-ringed hem band, the spaulder etched, hilts wrapped in red cord with an emissive fuller line on the blades. Mesh set unchanged; the ring-normal map and trim textures change.
- **Species notes:** Human baseline. Dwarf: 0.85 height / 1.15 width — hauberk hem lifts (shape key *hem_short*) so it clears the knees. Elf: 1.05 / 0.9, spaulder scales to 0.9. Orc: 1.10 / 1.2, coif opens for tusks. Halfling: 0.70 height, greatsword capped at 85% scale, back-carry mesh raised on the spine bone. Draconid: chausses split for the tail, hoodless helmet variant with horn sockets.

---

## 10. Open questions (for James)

1. ~~**Two-hander basics.** Settled by `08-ITEMS.md` §1 (D-041 superseded): two-handers hit at 1.0× with a higher Base Attack plus Cleave, dual is 2 × 0.5× at 800. Remaining question: is Cleave at 50% enough to make the Greatsword a real alternative to two Longswords on the sim?~~ *Checkpoint 1 (D-099): keep Cleave at 50% for now; Phase 7's class-damage pass compares greatsword and dual Blades on the runner and tunes the number.*
2. ~~**Greatsword from level 1?** The starter kit is two Copper swords; a Crude Greatsword is sold for 0.05 R. Should the creation screen offer the greatsword as an alternative kit so an Executioner starter does not need a shop trip?~~ *Checkpoint 1 (D-099): yes — from Phase 7, New hero offers a greatsword kit (a Copper Greatsword instead of the two swords), because the town sells no weapons; `08` §12 gains the row.*
3. ~~**Monster-technique Insight rule.** Ghoul's Grasp (Tier III) comes from Crypts ghouls at L5–10, far below the Tier III sweet spot of L18. Proposed: a flat 10% per witnessed use, pity at 10 — confirm?~~ *Checkpoint 1 (D-028): confirmed — a flat 10% per witnessed use, pity at 10.*
4. ~~**Berserk + Undying Rage on Dread.** A Blade that cannot die below 25% HP twice a fight (Deathless) is the strongest solo line here; should Undying Rage be once per *floor* instead of once per fight?~~ *Checkpoint 1 (D-099): once per floor (Deathless: twice per floor) — under the Mortal rule a once-per-fight cheat-death would make solo Blades too safe for the tower James asked for (D-084).*
5. ~~**Quicksilver** (act again immediately) is the only energy-refund skill in the four sheets; is a free turn acceptable at Tier IV, or should it refund 400 (half a light action)?~~ *Checkpoint 1 (D-099): keep the free turn, once per fight — it reads plainly on the strip, and a 400 refund on an 800-weight skill would cost more than it gives.*
