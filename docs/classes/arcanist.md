# Arcanist — class sheet

*Last updated 2026-10-26 · rev. 1 · numbers are tuning starting points*

Every number here is a **starting point for the simulator and the balance runner**, not a promise. The rules it rests on are `03-GAME-DESIGN.md` (§2 attributes, §3 the timeline, §5 level-by-use, §7 skills) and `04-CLASSES.md`, which holds the shared multiplier bands per tier. Column headers are identical across the seven sheets so the tables can become `content/skills/arcanist/<id>.json` (one record per skill).

**Shorthand.** `Burn 3` = Burn for 3 turns. Status magnitudes belong to `content/statuses/<id>.json`, written from `03` §3.5's table: Burn 20% of the applying hit per turn · Chill Speed ×0.75 (a second Chill = Freeze) · Freeze: skips its next action (energy −1,000) · Shock −15% Accuracy · Daze −500 energy · Slow ×0.67 Speed · Haste ×1.5 Speed · Shield absorbs a % of the holder's max HP · Weaken −20% Attack · Fortify +20% Defense · Mark +20% damage taken. Multipliers are of **spell Attack** (= focusPower + 2 × Wisdom). "Either row" ignores the front/back rule.

**Class rules (Arcanist only).**
- **Heavy casts are charged.** A 1,400-weight spell is declared when the Arcanist reaches 1,000 energy and *resolves 400 energy later* (about four ticks at Speed 100). A hit in that window pushes the Arcanist back 300 and cancels the cast (50% Mana refunded) unless the **concentration check** passes: 30% + 3% × (Willpower − 10). Light and normal casts resolve at once. This is the reading of §3.1's "charging a cast"; see Open questions.
- **Weapons change the basic attack, not the spells** (numbers per `08` §1). Staff: focusPower 14 at F (against the Wand's 9), +10 Mana, basic attack a Blunt swing at **normal 1,000**, front row; the Greatstaff is the heavy (1,400) option. Wand: focusPower 9, basic attack a bolt, light 800, either row; the off-hand Orb adds +4 spell Attack and +5 Mana and carries one affix line.
- **Mana class.** Mana = 30 + 3 × Wis, regen 8% per own turn; a basic attack or a Guard restores 10%.

---

## 1. Identity

The Arcanist is the party's artillery and its clock. Nobody else clears a front row in one cast, nobody else hands out Haste or pushes a boss back down the timeline, and nobody else can light a Pitch-dark room from the back row. The price is paid in cloth: Robes have the lowest Defense in the game, every big spell has a window in which it can be knocked out of the Arcanist's hands, and a Mana pool spent in the first three turns leaves a hero with a wand and a prayer.

| Pros | Cons |
|---|---|
| **Biggest AoE in the game**: Firewave (Tier II) hits a row at 0.9× each; Meteor and Avalanche (Tier III) hit both rows. | **Fragile**: Robes add 0 Defense; a Bone Knight's swing hits an Arcanist for ≈ 1.6× what it does a Warden. |
| **Biggest single burst**: Glacier Spike 1.9× (Tier II), Vaultbreaker 3.8× (Tier V); Shatter adds +30% on Frozen targets for *everyone's* hits. | **Heavy casts are interruptible**: any hit in the charge window cancels a 1,400-weight spell unless the Willpower check (30% + 3%/point) holds. |
| **Controls the timeline**: Quicken and Mass Haste pull allies forward; Time Slip and Chill push enemies back; Daze and Freeze take turns away. | **Mana runs dry if spammed**: three Tier II casts spend ~60% of a level-7 pool; the class lives on regen, Siphon and basic-attack refunds. |
| **Utility nobody else has**: Dispel strips boss buffs, Attune identifies on pickup, Lantern of the Mind lights rooms, Blink Step ignores Root and Web. | **Bad in melee**: the staff basic attack is a Blunt swing on a Str-10 body (the Greatstaff's is heavy, 1,400); a wand bolt is light but weak. |
| **Scales with the learning stat**: Wisdom also raises skill XP and Insight chance, so the Arcanist learns fastest. | **No answer to Poison, Bleed or Curse** except Dispel, two debuffs at a time. |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | **+2 Wisdom, +1 Perception, +1 Willpower** (added to the base 10s, before species and the 6 free points) |
| Pool | **Mana** = 30 + 3 × Wis → 66 at Wis 12 (before free points) |
| Armor family | **Robes** (cloth ladder: Burlap → Celestial Thread); speed penalty **0**; lowest armorDefense of the four families |
| Allowed weapons | **Staff** (2h, spell focus, normal 1,000 basic, +10 Mana; the **Greatstaff** is the heavy 1,400 one) · **Wand** (1h, spell focus, light 800 basic, either row) · **Orb** off hand (focus; no attack, one affix line) |
| Derived at all-10s + class mods, no gear | HP 103 · Speed 100 · Mana 66 · spell Attack focus + 24 · Accuracy 91% · Crit 5.5% · Resistance ~1% |
| F-grade starter kit (`08` §12) | Pine Wand (focusPower 9) · Pine Orb (off-hand focus: +4 spell Attack, +5 Mana) · Burlap Cowl · Burlap Robe · Burlap Leggings · Burlap Slippers · Burlap Wraps (Defense 4) · Ring of the Mind (+2 spell Attack) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg. A Pine Staff is the first Blacksmith purchase for a player who wants the two-handed build. |
| Recommended Tier I starter picks | **Ember Lance** (Evocation) · **Frostbolt** (Rime) · **Arcane Ward** (Arcana). One damage-and-Burn, one damage-and-Chill, one Shield: every school's line is open on floor 1. |

Free-point advice shown on the creation card: +3 Wisdom, +2 Willpower, +1 Vitality (a 15 / 13 / 11 Arcanist holds casts 39% of the time and has 110 HP).

---

## 3. The Ultimate

**Prismatic Ruin** — Tier III · 100 Momentum · weight 1,400 but **cannot be interrupted** · never misses.

All enemies, both rows, take **2.4× spell Attack** as the element each one is weakest to among Fire, Frost and Lightning (if a target has no weakness among the three, Fire; immunities are respected — the sim picks the best legal element per target). Each target is then marked with **Burn 2, Chill 1 and Shock 2**. The Arcanist refunds **30% of max Mana** on resolution. Momentum × (1 + 1% × (Will − 10)) means a Will-20 Arcanist charges it in about four own actions plus incoming hits.

---

## 4. The three schools

### 4.1 Evocation — *Fire and Lightning: the room is the target*

Philosophy: damage first, status second, Mana third. Fire burns down a row; Lightning picks a target and jumps. Every skill in the school either hits more than one thing or makes the next hit bigger.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Ember Lance | Active | 10 Mana | 1,000 | Single enemy, either row | 1.4× Fire; Burn 3 | — | Burn 4 |
| I | Spark | Active | 8 Mana | 800 | Single enemy, either row | 1.2× Lightning; Shock 2; if the target was already Shocked, chains 0.5× to one adjacent enemy | — | Chains to two |
| I | Kindling | Passive | — | — | — | Fire and Lightning skills +8%; the first Evocation cast of each fight costs 0 Mana | — | +12% |
| II | Firewave | Active | 16 Mana | 1,400 | Front row enemies | 0.9× Fire each; Burn 2 | Ember Lance | 1.0× each |
| II | Arc Chain | Active | 15 Mana | 1,000 | Single enemy + chain | 1.5× Lightning; then 0.7× to up to 2 other enemies; all three Shock 2; Shocked targets take +15% from this skill | Spark | Chains to 3 others |
| II | Backdraft | Passive | — | — | — | When a Burning enemy dies, its Burn jumps to a random living enemy and the Arcanist gains +10 Momentum | Kindling | +15 Momentum |
| III | Meteor | Active | 26 Mana | 1,400 | All enemies | 1.2× Fire each; Burn 3; any target already Burning is also Dazed (−500 energy) | Firewave | 1.35× each |
| III | Thunderhead | Active | 22 Mana | 1,000 | All enemies | 1.0× Lightning each; every target already Shocked has a 30% chance of Stun 1 | Arc Chain | Stun chance 45% |
| III | Overcharge | Passive | — | — | — | Evocation crits deal +30% Crit Damage and refund 10% of the skill's Mana cost | Backdraft | Refund 20% |
| IV | Pyroclasm | Active | 36 Mana | 1,400 | All enemies | 1.5× Fire each; consumes Burn on every target: each consumed Burn deals all its remaining ticks at once | Meteor | 1.7× each |
| IV | Stormcall | Active | 32 Mana | 1,000 | All enemies | 1.3× Lightning each; Shocked targets are pushed back 200 energy; the Arcanist gains Haste 1 | Thunderhead | Pushback 300 |
| IV | Hag's Cauldron *(monster technique: Brine Hag, the Drowned Vault)* | Active | 30 Mana | 1,400 | Single enemy, either row | 2.6× Fire; Poison 3 (ignores armor); Weaken 2. Only Insights while a Brine Hag uses it. | Overcharge | 3.0× |
| V | Sunflare | Active | 48 Mana | 1,400 | All enemies | 2.0× Fire each; Burn 4; Blind 2; the Arcanist's next cast is light weight (800) regardless of its own weight | Pyroclasm | Blind 3 |
| V | Vaultbreaker | Active | 45 Mana | 1,400 | Single enemy, either row | 3.8× Lightning; Stun 1; chains 1.2× to every other enemy that is Shocked | Stormcall | 4.2× |
| V | Conflagration | Passive | — | — | — | Burn and Shock last +1 turn and may stack twice on a target (the second application refreshes and adds +50% tick) | Stormcall | Stack three times |

### 4.2 Rime — *Frost: slow them, stop them, break them*

Philosophy: Frost is the control school. Chill costs enemies turns on the timeline; a second Chill is a Freeze; a Frozen enemy is glass, and the whole party — a Blade, a Warden's mace, a pet — gets the **Shatter** bonus. Walls buy the front row time.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Frostbolt | Active | 10 Mana | 1,000 | Single enemy, either row | 1.3× Frost; Chill 2 | — | Chill 3 |
| I | Frost Floor | Active | 12 Mana | 1,000 | Front row enemies | 0.7× Frost each; Chill 1 | — | 0.8× each |
| I | Shatter | Passive | — | — | — | Any hit from any ally on a Frozen enemy deals +30% and crits; the Freeze ends and the enemy is pushed back 300 energy as it breaks free | — | +40% |
| II | Glacier Spike | Active | 16 Mana | 1,400 | Single enemy, either row | 1.9× Frost; Chill 2; if the target was already Chilled it is Frozen 1 at once | Frostbolt | 2.1× |
| II | Ice Wall | Active | 18 Mana | 1,000 | Party front row | A wall with HP = 25% of the Arcanist's max HP absorbs melee hits aimed at the front row until broken or 2 turns pass; enemies that strike it get Chill 1 | Frost Floor | Wall HP 35% |
| II | Permafrost | Passive | — | — | — | Chill lasts +1 turn and takes a further −10% Speed; Frost skills +8% | Shatter | Frost skills +12% |
| III | Avalanche | Active | 26 Mana | 1,400 | All enemies | 1.2× Frost each; Chill 2; Frozen targets are shattered by this hit (Shatter applies even without the passive) | Glacier Spike | 1.35× each |
| III | Frozen Tomb | Active | 22 Mana | 1,000 | Single any, either row | Enemy: Freeze 2, no damage. Ally: encased — immune to all damage until their next turn, then Chill 1. Bosses: Freeze 1. | Ice Wall | Ally keeps no Chill |
| III | Hoarfrost | Passive | — | — | — | At fight start every enemy in the front row has Chill 1; Chilled enemies also lose 10% Accuracy | Permafrost | Both rows |
| IV | Absolute Zero | Active | 38 Mana | 1,400 | All enemies | 1.4× Frost each; every Chilled target is Frozen 1 | Avalanche | 1.6× each |
| IV | Winter's Breath | Active | 30 Mana | 1,000 | Back row enemies | 1.3× Frost each; Chill 2; Slow 2 (the back row is where the casters stand) | Frozen Tomb | Silence 1 as well |
| IV | Deep Cold | Passive | — | — | — | Freeze lasts +1 turn; whenever an ally shatters a Frozen enemy the Arcanist restores 15% max Mana | Hoarfrost | Restore 20% |
| V | Endless Winter | Active | 50 Mana | 1,400 | All enemies | 1.8× Frost each; Chill 3; for 3 turns every enemy action applies Chill 1 to the actor | Absolute Zero | 2.0× each |
| V | Glass Heart | Active | 40 Mana | 1,000 | Single enemy, either row | 3.5× Frost; against a Frozen target it cannot miss and always crits; a kill gives the whole party +15 Momentum | Winter's Breath | +25 Momentum |
| V | Rimeborn | Passive | — | — | — | The Arcanist is immune to Chill, Freeze and Slow; a melee attacker that hits the Arcanist gets Chill 1; Rime skills cost −20% | Deep Cold | Cost −30% |

### 4.3 Arcana — *the timeline, the Shield, the lantern*

Philosophy: Arcana never kills anything. It decides who acts when, who gets hit, what a buff is worth, and whether the party can see. It is also where the Arcanist keeps its Mana economy.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Arcane Ward | Active | 10 Mana | 800 | Single ally | Shield 18% of the target's max HP for 3 turns | — | Shield 22% |
| I | Quicken | Active | 12 Mana | 800 | Single ally | Haste 1 and +200 energy at once (the ally jumps up the strip) | — | +300 energy |
| I | Attune | Passive | — | — | — | Mana regen 8% → 11% per own turn; items are identified on pickup; the party's Light falls 1 less per new room | — | Regen 13% |
| II | Blink Step | Active | 8 Mana | 800 | Self or single ally | Swap rows at once, ignoring Root, Web and Grab; +15% Dodge until the target's next turn | Quicken | Also breaks Taunt |
| II | Mirror Ward | Active | 16 Mana | 1,000 | All allies | Shield 12% each for 2 turns; 20% of damage absorbed is returned to the attacker as Lightning | Arcane Ward | Return 30% |
| II | Siphon | Active | 0 Mana | 1,000 | Single enemy, either row | The Arcanist restores 25% of max Mana; if the target is a caster it is Silenced 1 | Attune | Restore 35% |
| III | Time Slip | Active | 24 Mana | 1,000 | Single enemy, either row | Slow 2 and pushed back 300 energy; a charging caster loses its cast | Blink Step | Pushback 500 |
| III | Dispel | Active | 18 Mana | 800 | Single any, either row | Enemy: strip every buff (Fortify, Shield, Haste, Regen, Taunt). Ally: cleanse 2 debuffs. | Mirror Ward | Ally: cleanse all |
| III | Lantern of the Mind | Active | 14 Mana | 800 | Party | Out of combat: +20 Light, once per room. In combat: all allies immune to Blind and Fear for 3 turns and Shadow enemies take +15% for 3 turns | Siphon | +30 Light |
| IV | Mass Haste | Active | 34 Mana | 1,000 | All allies + pets | Haste 2 | Time Slip | Haste 3 |
| IV | Sentinel Pulse *(monster technique: Vault Sentinel, the Drowned Vault)* | Active | 30 Mana | 1,400 | All enemies + all allies | Enemies: every buff stripped, then 1.2× Lightning each. Allies: Shield 10% for 2 turns. Only Insights while a Vault Sentinel uses it. | Dispel | 1.4× each |
| IV | Font of Mana | Passive | — | — | — | Once per fight, when Mana reaches 0 it refills to 50%; Fortune (free-cast chance) +5 pp | Lantern of the Mind | Refill 70% |
| V | Rewind | Active | 45 Mana | 1,000 | Single ally | The ally's HP, pool and statuses return to what they were at the start of that ally's previous turn. Cannot revive. | Mass Haste | Also restores Momentum |
| V | Nullfield | Active | 40 Mana | 1,400 | All | For 2 turns no enemy can use a skill (Silence 2 on every enemy, bosses 1) and every ally Shield is doubled | Font of Mana | Bosses 2 |
| V | Paradox | Passive | — | — | — | The Arcanist's heavy casts weigh 1,000 and cannot be interrupted | Mass Haste | Normal casts weigh 800 |

**Skill-line note.** Each school reads as three columns: a damage line, a control-or-defense line, a passive-and-utility line. The two monster techniques (Hag's Cauldron, Sentinel Pulse) are **leaves** — nothing requires them, so a player who never meets a Brine Hag loses nothing on the way to Tier V. Their Insight is proposed to use the *monster's* level as the sweet spot, because the Tier IV formula peak (enemy L24) is above anything in Gravehollow Keep; see Open questions.

---

## 5. Field-skill affinities

Starts at **+2 rank in Cartography** (the party's map-reader) and **+2 rank in Haggling** (Wisdom's identify minor — an Arcanist knows what a thing is worth). All other field skills start at rank 1.

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Why |
|---|---|---|---|---|
| **Cellar Fire** (levels 1–11) | Ember Lance · Frostbolt · Arcane Ward · Firewave | Kindling · Shatter | Guard | Burn the rats, Chill the bandit captain, Shield whoever the Grinning Company is hitting; the pet keeps the Arcanist off the floor until the Warden has Taunt. |
| **Glasswright** (levels 12–19) | Glacier Spike · Avalanche · Frozen Tomb · Dispel | Shatter · Permafrost | Fierce | The control build: Chill everything, Freeze the elite, let a Blade or Fierce pet shatter it for +30%; Dispel the Bone Knight's Fortify. The Crypts' wraiths resist Frost, so pack Spark on the Ultimate's turn. |
| **Storm Clock** (levels 20+) | Stormcall · Thunderhead · Mass Haste · Time Slip | Overcharge · Paradox | Mend | Lightning chains through Shocked rows and pushes them back, Mass Haste gives the party a free round, Paradox makes every cast uninterruptible. Mend stance covers the lack of self-heal. |

---

## 7. How it grows by use

Attributes train from tagged actions (§2.1 / §5.2), 1 × D per tag, D = the difficulty curve (0.1× at −10 levels … 3× at +10).

| Attribute | What an Arcanist does that tags it |
|---|---|
| **Wisdom** | every cast that resolves against a gated enemy or heals/shields a gated-fight ally; identifying an item; reading a curio. The Arcanist's main trainer — and it raises skill XP 1%/point, so it compounds. |
| **Willpower** | passing (or failing) a concentration check under a hit; resisting a status; standing against Fear. Robes make the Arcanist a frequent target, so this trains faster than it looks. |
| **Perception** | landing a crit; finding a trap or secret the Arcanist's Detection revealed (Lantern and Attune help). |
| **Vitality** | taking damage, per 10% of max HP. Fragile classes train it fastest. |
| **Agility** | dodging. Rare in Robes without Blink Step. |
| **Endurance** | taking armor-absorbed hits — almost none in Robes; expect End to stay near creation. |

**A level-20 Arcanist** (160 total skill ranks, roughly 20 skills at rank 6–10): Wis 28–32 (soft cap 15 + 40 = 55, so no throttle yet), Will 18–20, Per 14–16, Vit 13–15, the rest within a point of creation. HP ≈ 30 + 7 × 14 + 60 = 188; Mana ≈ 30 + 3 × 30 = 120 (plus the staff's +10 × 2.45 ≈ 25); spell Attack with a C-grade Yew Staff (focusPower 14 × 2.45 ≈ 34) ≈ 34 + 60 = 94; concentration ≈ 57%; Crit ≈ 8%; Momentum gain ×1.09. Four Tier III and one or two Tier IV skills equipped; the Ultimate charges every fourth action.

---

## 8. Worked example — floor 5 (the Crypts), level 7

**Ysolde**, Arcanist L7 (Human; species modifiers 0 for the arithmetic). Attributes after six floors of use: Str 10 · Agi 10 · Vit 12 · End 10 · Wis 18 · Per 12 · Will 14 · Luck 10. Gear: Ash Staff (E, focusPower 14 × 1.35 ≈ 19, +10 Mana × 1.35 ≈ +14), Linen robes (E, armorDefense 6).
Derived: HP 30 + 84 + 21 = **135** · Mana 30 + 54 + 14 = **98** · spell Attack 19 + 36 = **55** · Defense 6 + 10 = **16** · Speed **100** · Accuracy 92% · Crit 6% · Momentum gain ×1.04 · concentration 42%.
Loadout: Ember Lance, Spark, Firewave, Arcane Ward; Kindling, Shatter. Pet: Crypt Bat (E, Fierce, Speed 130, Attack 18).
Party: Bram the Warden (front, Speed 80, HP 180), Ysolde (back), the bat.
Enemies (placeholder stats until `06-MONSTERS.md`; L7): **Bone Knight** front, HP 150, Def 24, Speed 90, Fire ×1.0 · **Ghoul** front, HP 120, Def 12, Speed 105, Fire ×1.5 · **Wraith** back, HP 80, Def 6, Speed 125, Lightning ×1.0, physical ×0.5.

Damage formula once: Attack × multiplier × (1 + bonuses) × elementMod × 100 / (100 + Def) × critMod × variance (0.90–1.05).

| Tick | Actor (Speed, start energy) | Action (weight) | Pool | Arithmetic and result |
|---|---|---|---|---|
| 6 | Wraith (125, 350) | Shadow bolt at Ysolde (1,000) | — | 40 × 1.2 × 100/116 = 41 → Ysolde 135 → **94**; Ysolde Momentum +10 × 1.04 → 10 |
| 7 | Ysolde (100, 300) | **Ember Lance** → Ghoul (1,000) | 98 (Kindling: the first Evocation cast is free) | Kindling also adds +8%: 55 × 1.4 × 1.08 × 1.5 × 100/112 = 111 × 0.97 variance = **108**. Ghoul 120 → 12, Burn 3 (22/tick). Momentum 10 + 21 = 31. |
| 7 | Ghoul (105, 300) | Claws Bram (1,000) | — | Burn ticks first at its turn start: 22 → Ghoul **dies** before it swings. Backdraft is not equipped, so the Burn is lost. |
| 8 | Bat (130, 100) | Bites Bone Knight (Fierce; the owner's last target is dead, so nearest) (800) | — | 18 × 1.0 × 100/124 = 15 → Knight 135. Ysolde +5 ally action → 36. |
| 9 | Bram (80, 400) | Basic mace swing → Bone Knight, Blunt weak ×1.5 (1,000) | +15% Stamina | 34 × 1.0 × 1.5 × 100/124 = 41 → Knight **94**. Ysolde → 41 Momentum. |
| 10 | Bone Knight (90, 200) | Greatsword → Bram (1,400) | — | Bram blocks (shield): halved to 19. |
| 17 | Ysolde (second turn) | **Firewave** on the front row — declared now, resolves at tick 21 (1,400) | 98 (full, regen wasted) − 16 → **82** | The Wraith's second bolt lands at tick 19, inside the charge window → concentration roll 0.31 < 0.42, **cast holds**. Resolves on the Knight: 55 × 0.9 × 1.08 × 1.0 × 100/124 = 43.1 × 0.96 = **41**, Burn 2 (8/tick); Knight 94 → 53. Ysolde 94 − 41 = 53 HP; Momentum 41 + 10 + 21 + 5 + 5 = **82**. |
| 31 | Ysolde (third turn) | **Spark** → Wraith (800); **Prismatic Ruin** is lit the turn after | 82 + 8 regen − 8 → 82 | 55 × 1.2 × 1.08 × 1.0 × 100/106 = 67 → Wraith 80 → 13, Shock 2. The bat finishes it; the Knight dies to Burn plus the Ultimate. |

What the runner should see: the Arcanist did 64% of the damage, took 60% of the party's damage, and spent 24 of 98 Mana because Kindling paid for the opener. Without Kindling and with a miss on the Spark, the same fight costs 34 Mana and one more round.

---

## 9. Visual brief for the gear set (shared humanoid rig)

**Silhouette:** a tall narrow wedge — a long robe that flares at the hem, a high collar or hood, and a staff or wand held *out* from the body so the light source reads from across the room.

**Modular meshes (five armor pieces + weapons), one mesh per slot, skinned to the shared rig:**

| Slot | Mesh | Notes |
|---|---|---|
| Helmet | Hood / circlet | Hood up at F–C, circlet with a floating shard at B+; never hides the face preset fully |
| Chest | Robe (torso to hem, one piece) | The hem is a separate cloth-sim-free skirt mesh split front/back so the legs animate |
| Legs | Leggings under the robe | Mostly hidden; only the knee-down shows |
| Boots | Soft slippers / wrapped boots | Pointed toe at higher grades |
| Gloves | Wraps / rune gauntlets | Emissive runes from C up |
| Main hand | Staff (2h) or wand (1h) | Staff head is the grade signifier: knot of pine → crystal cage → a floating ring |
| Off hand | Tome or orb | Tome opens and glows while a heavy cast charges — the *interrupt window* must be visible |

**Palette:** deep indigo (robe) · ash grey (trim, leather straps) · ember orange (runes, staff light) · **brass** as the metal. The school in the equipped loadout tints the staff light (orange Evocation, pale blue Rime, violet Arcana).

**Must read at 200 px:** the staff light, the hood/collar shape, the charging tome glow. Nothing else needs to.

**F vs S:** F — patched burlap, a plain pine stick, the tome is a bundle of notes tied with string. S (Phoenix Weave) — a robe of layered feather-shaped panels with slow emissive scrolling, a staff whose head is a suspended burning ring, a tome bound in brass that floats beside the hand. Both share the same silhouette so the class reads in the party line-up.

**Species notes:** the robe hem and sleeves are scaled with the rig's bone scale, so a Halfling's robe does not drag and an Orc's does not become a shirt; the hood uses the species head shape key and is swapped for a circlet on Draconid (horns). Dwarves get a shorter staff mesh variant (same head) so the pose stays readable. Elf ears clip through the hood in the default pose — the hood has an ear cut-out shape key.

---

## 10. Open questions (for James)

1. **The charge window.** This sheet reads §3.1's "charging a cast" as *declare at 1,000, resolve 400 energy later, interruptible in between*. The alternative is no window at all (the spell lands at once, the 1,400 weight is the only price). The window makes Willpower matter and gives tanks a job; it also makes heavy casts feel bad at low level. Which?
2. **Staff vs wand.** As written the weapon only changes the basic attack, focusPower and Mana (`08` §1). Should the staff also make casts heavier (+200) and the wand lighter (−100) so the choice is felt on every turn?
3. **Monster techniques and the Insight sweet spot.** The formula's Tier IV sweet spot is enemy level 24; Gravehollow tops out at 14. Proposed: for monster techniques only, S = 1.0 whenever the monster is using the move in the fight. Otherwise Hag's Cauldron and Sentinel Pulse move to Dungeon 2 monsters.
4. **Shatter for everyone.** Shatter (Tier I passive) grants the +30% to *every* ally's hit on a Frozen target. That makes Rime a party school rather than a selfish one — but it means a Blade benefits from a passive it did not equip. Keep, or make it Arcanist-only hits?
5. **Prismatic Ruin's refund.** 30% Mana back on the Ultimate turns it into a resource reset as well as a nuke. Drop the refund if the sim shows Arcanists never running dry.
