# 08 — Items, materials and chests

*Last updated 2026-10-28 · rev. 5 (Phase 7 as built, pass B: grades B–S on every family; the Gravehollow sets with their bonuses applied; six named uniques; the six zone relics working; the five safe items and their tag; the Divine Shard; chest keys redeemable; the Grand Wayfarer Chest and six S-grade wayfarers; the loot tables of F4–8; the Torch in a fight — "As built (Phase 7)" notes below, Open questions 9–12) · rev. 4 (Phase 7 prep: Gravehollow at 8 floors — the floor numbers of the R table, the Vault's rows in §6, §8.3 and §11, the boss table — D-104) · rev. 3 (checkpoint 1: open questions answered by delegation; the Nightmare difficulty preset renamed Dread — D-095, D-099) · rev. 2 (§10.2 the Wayfarer Chest, D-091; §10.1 pity keys per chest family) · rev. 1 2026-10-26 · numbers are tuning starting points*

**How to read this file.** Every base number is written **for grade F**; every grade multiplies it by the ladder (F ×1.00 · E ×1.35 · D ×1.80 · C ×2.45 · B ×3.30 · A ×4.45 · S ×6.00 · SS ×8.10 · God ×11.0), rounded half up to an integer after the multiply. Percentages (Block, Crit, Dodge) do **not** ride the ladder; they step by a fixed amount per grade where the table says so. Ordinary pieces are named `<Material> <Type>` — "Iron Longsword", "Wolf Hide Jerkin", "Oak Shortbow" — where the material is the rung of the item's ladder at its grade (§8); named uniques exist from B up (§7) and keep their own names. Grade index **g** runs F 0 … God 8 and is used in requirement formulas. Each table here becomes one folder under `content/items/<kind>/`, one record per `<id>.json` (`10-TECH-PLAN.md` §3 owns the layout); column headers are the field names. Rules live in the rulebook (`03-GAME-DESIGN.md` §2, §6, §8); this file is the content.

**The R table used throughout.** R = median gold per delve at the band; prices below are written in R so they survive retuning. Bands are the chest/grade bands; R ×1.6 per band from 300. *Global floors* count Gravehollow's 8 floors, then each later dungeon's in order at its outline's 10 (D-104; they move again when those dungeons get their floor counts, `03` §11.4).

| Band | Global floors | Centre grade | R (gold) |
|---|---|---|---|
| F | 1–3 | F | 300 |
| E | 4–6 | E | 480 |
| D | 7–8 | D | 770 |
| C | 9–13 | C | 1,230 |
| B | 14–20 | B | 1,970 |
| A | 21–28 | A | 3,150 |
| S | 29–32 | S | 5,040 |
| SS | 33–38 | SS | 8,060 |

**Item value** (what repair, promotion, salvage and sell prices are computed from) = `gradeValue × slotFactor`. Grade value is 0.5 × R of the grade's own band: F 150 · E 240 · D 380 · C 600 · B 1,000 · A 1,600 · S 2,500 · SS 4,000 · God 6,500. Slot factors: Main Hand 1.0 (two-handed 1.5) · Shield 0.8 · Off-hand focus or weapon 0.6 · Chest 1.0 · Helmet 0.7 · Legs 0.7 · Boots 0.5 · Gloves 0.5 · Ring 0.6 · Talisman 0.8 · Relic 1.2. Sell price = 40% of value (+0.5% per Haggling rank).

---

## §1 Weapons

Columns: **Weight** is the action weight of a basic attack (light 800 · normal 1,000 · heavy 1,400; rulebook §3.1). **Base Attack (F)** is `weaponAttack` in the Attack formula (for foci it is `focusPower`). **Speed penalty** is the flat `weaponPenalty`. Requirements rise with grade: `req(g) = req(F) + g` for one-handed weapons and foci, `req(F) + 2g` for two-handed weapons marked heavy. Off-hand weapons add 50% of their Attack to basic attacks and bring their on-hit specials. Two-handed weapons carry two slots' budget (rulebook §6.1).

### Swords (Metal ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Shortsword | 1 | Slash | 1,000 | 10 | 0 | Str 8 | +2% Accuracy; may be held off-hand by a Blade | Warden, Blade, Ranger, Shade, Beast Tamer |
| Longsword | 1 | Slash | 1,000 | 12 | 0 | Str 10 | — | Warden, Blade, Beast Tamer |
| Sabre | 1 | Slash | 1,000 | 11 | 0 | Str 9 | +3% Crit Rate | Blade, Shade, Beast Tamer |

### Greatswords (Metal ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Greatsword | 2 (heavy) | Slash | 1,400 | 20 | −5 | Str 14 | Cleave: a basic attack also hits a second front-row enemy for 50% | Blade, Warden |
| Zweihander | 2 (heavy) | Slash | 1,400 | 23 | −8 | Str 17 | Cleave 50%; +10% Crit Damage | Blade |

### Axes (Metal ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Hand Axe | 1 | Slash | 1,000 | 13 | 0 | Str 11 | +15% Crit Damage; −3% Accuracy | Warden, Blade, Beast Tamer |
| Bearded Axe | 1 | Slash | 1,000 | 12 | 0 | Str 10 | +10% Crit Damage; 20% Bleed on crit | Blade, Beast Tamer |
| Battleaxe | 2 (heavy) | Slash | 1,400 | 22 | −5 | Str 16 | +25% Crit Damage; −3% Accuracy | Blade, Warden |

### Maces and Mauls (Metal ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Mace | 1 | Blunt | 1,000 | 12 | 0 | Str 11 | 5% Daze on hit | Warden, Mender, Beast Tamer |
| Morningstar | 1 | Blunt | 1,000 | 13 | 0 | Str 12 | 5% Daze on hit; +5% Crit Damage | Warden, Beast Tamer |
| Maul | 2 (heavy) | Blunt | 1,400 | 24 | −10 | Str 18 | 15% Daze on hit; 10% Stun on crit | Warden, Blade |

### Spears (Metal ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Spear | 2 | Pierce | 1,000 | 15 | 0 | Str 11 | Reach (hits the back row from the front) | Warden, Ranger, Beast Tamer |
| Pike | 2 | Pierce | 1,000 | 16 | −3 | Str 13 | Reach; +5% Accuracy | Warden, Beast Tamer |
| Trident | 2 | Pierce | 1,000 | 15 | 0 | Str 12 | Reach; 10% Bleed on hit | Ranger, Beast Tamer |

### Daggers (Metal ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Dagger | 1 | Pierce | 800 | 8 | 0 | Str 6 | Dual: may be held off-hand (adds 50% Attack) | Blade, Ranger, Shade, Arcanist |
| Stiletto | 1 | Pierce | 800 | 7 | 0 | Str 6 | Ignores 20% of target Defense; dual | Shade |
| Kris | 1 | Pierce | 800 | 8 | 0 | Str 7 | 10% Bleed on hit; dual | Shade, Blade |

### Bows (Wood ladder; consume arrows, §4)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Shortbow | 2 | Pierce | 1,000 | 13 | 0 | Str 9 | Either row | Ranger, Shade |
| Longbow | 2 | Pierce | 1,000 | 16 | 0 | Str 12 | Either row; +5% damage to the back row | Ranger |
| Recurve Bow | 2 | Pierce | 1,000 | 14 | 0 | Str 10 | Either row; +4% Crit Rate | Ranger |

### Crossbows (Wood ladder; consume bolts)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Hand Crossbow | 1 | Pierce | 1,000 | 11 | 0 | Str 7 | Either row; may be held off-hand | Shade, Ranger |
| Crossbow | 2 (heavy) | Pierce | 1,400 | 22 | −5 | Str 9 | Either row; ignores 10% Defense | Ranger, Warden |
| Arbalest | 2 (heavy) | Pierce | 1,400 | 26 | −10 | Str 12 | Either row; ignores 20% Defense | Ranger |

### Staves (Wood ladder with a Metal/gem accent; Base Attack = focusPower)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Staff | 2 | Spell (skill's element) | 1,000 | 14 | 0 | Wis 10 | +10 Mana | Arcanist, Mender |
| Greatstaff | 2 (heavy) | Spell | 1,400 | 18 | −3 | Wis 13 | +20 Mana; +5% Mana regen | Arcanist |
| Crook | 2 | Spell | 1,000 | 12 | 0 | Wis 9 | +10 Mana; +10% healing | Mender |

### Wands and off-hand foci (Wood ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Wand | 1 | Spell | 800 | 9 | 0 | Wis 8 | Light | Arcanist, Mender |
| Rod | 1 | Spell | 1,000 | 11 | 0 | Wis 10 | +5 Mana | Arcanist |
| Orb | Off | — | — | 4 | 0 | Wis 8 | Off-hand focus: +4 spell Attack, +5 Mana | Arcanist, Mender |

### Censers and Holy symbols (Metal ladder; Mender foci)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Censer | 1 | Blunt | 1,000 | 10 | 0 | Wis 9 | A main-hand **weapon that also counts as a focus**: its Base Attack is both weaponAttack (Blunt basic attack, strong vs Mail) and focusPower for spell Attack; +10% healing | Mender |
| Holy Symbol | Off | — | — | 5 | 0 | Wis 8 | Off-hand focus (no attack): +5 spell Attack, +3% Resistance; pairs with the Censer | Mender |
| Reliquary | 2 | Spell (Holy) | 1,000 | 14 | 0 | Wis 12 | +15 Mana; +15% healing; Smite +10% | Mender |

### Whips (Hide ladder)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Whip | 1 | Slash | 1,000 | 9 | 0 | Str 7 | Reach; pet in Fierce +5% Attack | Beast Tamer |
| Chain Whip | 1 | Slash | 1,000 | 11 | 0 | Str 10 | Reach; 10% Slow on hit | Beast Tamer |
| Bullwhip | 2 | Slash | 1,000 | 15 | 0 | Str 10 | Reach; Lash: basic attack hits one target in each row for 60% | Beast Tamer |

### Throwing knives (Metal ladder; recovered after the fight, no ammo)

| Type | Hands | Damage type | Weight | Base Attack (F) | Speed penalty | Str/Wis requirement (F) | Special | Classes |
|---|---|---|---|---|---|---|---|---|
| Throwing Knives | 1 | Pierce | 800 | 7 | 0 | Str 5 | Either row; may be held off-hand | Shade |
| Throwing Axes | 1 | Slash | 1,000 | 9 | 0 | Str 8 | Either row; +10% Crit Damage | Shade, Beast Tamer |
| Needles | 1 | Pierce | 800 | 5 | 0 | Str 4 | Either row; 15% Poison on hit | Shade |

Shields are in §2.3. Class lists above are the proposal for `04-CLASSES.md`; that file wins if it differs.

### Grade ladder, three reference weapons

Base Attack (F) × ladder, rounded half up.

| Weapon | F ×1.00 | E ×1.35 | D ×1.80 | C ×2.45 | B ×3.30 | A ×4.45 | S ×6.00 | SS ×8.10 | God ×11.0 |
|---|---|---|---|---|---|---|---|---|---|
| Longsword (12) | 12 | 16 | 22 | 29 | 40 | 53 | 72 | 97 | 132 |
| Greatsword (20) | 20 | 27 | 36 | 49 | 66 | 89 | 120 | 162 | 220 |
| Dagger (8) | 8 | 11 | 14 | 20 | 26 | 36 | 48 | 65 | 88 |

Per 1,000 energy at F, a Longsword + shield lands 12, a Greatsword 20 / 1.4 = 14.3 plus Cleave, paired Daggers (8 + 4) / 0.8 = 15 — the three shapes sit within ~20% of each other before Block, Cleave and dual on-hit effects, which is where the sim starts.

### Naming by material

| Weapon types | Ladder | F | E | D | C | B | A | S | SS | God |
|---|---|---|---|---|---|---|---|---|---|---|
| Swords, Greatswords, Axes, Maces, Spears, Daggers, Censers, Throwing, Tower shields | Metal | Copper | Bronze | Iron | Steel | Blacksteel | Skysteel | Adamantine | Orichalcum | Starmetal |
| Bows, Crossbows, Staves, Wands, Bucklers, Kite shields | Wood | Pine | Ash | Oak | Yew | Ironwood | Ebony | Elderwood | World-tree | Godwood |
| Whips | Hide | Rawhide | Leather | Boiled Leather | Wolf Hide | Wyvern Hide | Basilisk Scale | Drake Scale | Dragon Scale | Ancient Dragon Scale |

So a Metal weapon at D is an "Iron Longsword", a Wood bow at D an "Oak Shortbow", a whip at C a "Wolf Hide Whip". Staves and wands are named by their wood ("Yew Staff") and carry the Metal rung of the same grade as a ferrule or gem cap in the art (`11-ART-PIPELINE.md`): Copper cap at F, Steel at C, Starmetal at God. "World-tree" is the display short form of World-tree Bough. Regional variants (§8.1) swap the material word only.

**Carry weight (kg)** by type, for the Carry formula: Dagger / Wand / Throwing 0.5 · Shortsword / Sabre / Hand Axe / Mace / Censer / Whip 1.5 · Longsword / Bearded Axe / Morningstar / Rod / Staff / Bow 2 · Spear / Pike / Trident 3 · Greatsword / Battleaxe / Crossbow / Greatstaff 4 · Zweihander / Arbalest 5 · Maul 6. Weight never changes with grade.

**As built (Phase 7, pass B).** Every weapon, focus, armor, shield, ring and talisman family is content from F to S (`tools/content/gen-items.ts`, this file's numbers; the B–S rungs are Blacksteel · Skysteel · Adamantine, Wyvern Hide · Basilisk Scale · Drake Scale, Glyphweave · Moonweave · Phoenix Weave, Ironwood · Ebony · Elderwood): a Skysteel Longsword is Attack 53, Str 15, k 4.07, value 1,600. SS items are the chests' and the endgame's and God items Phase 11's (§7). The Beast Tamer's whips wait for the class (Segment 3).

---

## §2 Armor

Four families; the family is the material ladder (rulebook §6.1). **Speed penalty share** sums to the family penalty (Plate −20 · Mail −10 · Leather −3 · Robes 0); Strength above a piece's requirement relieves its share one point per spare point. **Str requirement** rises `req(F) + 2g` for Plate and `req(F) + g` for Mail and Leather. **Durability k** is hits-taken-by-the-wearer per 1% lost on the piece the hit lands on (rulebook §6.4: a hit picks one piece by weight Chest 3 · Helmet 2 · Legs 2 · Boots 1 · Gloves 1); k multiplies by 1.25 per grade (§9). Physical weaknesses: a hit of the family's weak type does ×1.25 damage and double wear — Plate weak to **Pierce**, Mail to **Blunt**, Leather (hide) to **Slash**; Robes have no weakness line, only low Defense.

### Plate (Metal · Warden · −20 Speed · weak to Pierce)

| Piece | Defense (F) | HP (F) | Secondary stat | Speed penalty share | Str requirement (F) | Durability k (hits per 1%) |
|---|---|---|---|---|---|---|
| Helm | 3 | 6 | +2% Resistance | −3 | 10 | 1.2 |
| Breastplate | 8 | 10 | +4 Stamina | −8 | 12 | 1.2 |
| Greaves | 5 | 4 | +1 Strength | −5 | 11 | 1.2 |
| Sabatons | 2 | 2 | +2 kg Carry | −2 | 9 | 1.2 |
| Gauntlets | 2 | 2 | +2% Accuracy | −2 | 9 | 1.2 |

### Mail (Metal · Blade, Beast Tamer · −10 Speed · weak to Blunt)

| Piece | Defense (F) | HP (F) | Secondary stat | Speed penalty share | Str requirement (F) | Durability k (hits per 1%) |
|---|---|---|---|---|---|---|
| Coif | 2 | 5 | +1% Resistance | −1 | 8 | 1.0 |
| Hauberk | 6 | 8 | +3 Stamina | −4 | 10 | 1.0 |
| Chausses | 4 | 3 | +1 Speed | −3 | 9 | 1.0 |
| Treads | 2 | 2 | +1% Dodge | −1 | 8 | 1.0 |
| Mitts | 1 | 2 | +1% Crit Rate | −1 | 8 | 1.0 |

### Leather (Hide · Ranger, Shade · −3 Speed · weak to Slash)

| Piece | Defense (F) | HP (F) | Secondary stat | Speed penalty share | Str requirement (F) | Durability k (hits per 1%) |
|---|---|---|---|---|---|---|
| Hood | 1 | 4 | +1 Detection | 0 | 6 | 0.8 |
| Jerkin | 4 | 6 | +2% Dodge | −1 | 8 | 0.8 |
| Breeches | 3 | 2 | +2 Speed | −1 | 7 | 0.8 |
| Boots | 1 | 2 | +2% Dodge | −1 | 6 | 0.8 |
| Gloves | 1 | 1 | +2% Crit Rate | 0 | 6 | 0.8 |

### Robes (Cloth · Arcanist, Mender · 0 Speed · no weakness, low Defense)

| Piece | Defense (F) | HP (F) | Secondary stat | Speed penalty share | Str requirement (F) | Durability k (hits per 1%) |
|---|---|---|---|---|---|---|
| Cowl | 1 | 3 | +2% Resistance | 0 | — | 0.5 |
| Robe | 2 | 4 | +4 Mana | 0 | — | 0.5 |
| Leggings | 1 | 2 | +1 Speed | 0 | — | 0.5 |
| Slippers | 0 | 1 | +1% Dodge | 0 | — | 0.5 |
| Wraps | 0 | 1 | +2% Accuracy | 0 | — | 0.5 |

Set totals at F: Plate Def 20 / HP 24 · Mail 15 / 20 · Leather 10 / 15 · Robes 4 / 11. A full God Plate set is Def 220, which with Endurance 30 puts damage taken at 100 / (100 + 250) = 29%.

**As built (Phase 7).** "Percentage secondaries … step +1 pp per grade from B upward (so a God Jerkin gives +6% Dodge)" is read so the Jerkin's sum holds: B keeps the F line and each grade above B adds a point (A +1, S +2 … God +4 = 6). `tuning.json → items.armorPercentStep`; lint rule 22 accepts the step (Proposed).

### Family grade ladder (Chest piece Defense)

| Family (Chest F) | F | E | D | C | B | A | S | SS | God |
|---|---|---|---|---|---|---|---|---|---|
| Plate Breastplate (8) | 8 | 11 | 14 | 20 | 26 | 36 | 48 | 65 | 88 |
| Mail Hauberk (6) | 6 | 8 | 11 | 15 | 20 | 27 | 36 | 49 | 66 |
| Leather Jerkin (4) | 4 | 5 | 7 | 10 | 13 | 18 | 24 | 32 | 44 |
| Robe (2) | 2 | 3 | 4 | 5 | 7 | 9 | 12 | 16 | 22 |

HP lines and the flat secondary stats (Stamina, Mana, Carry) ride the same ladder; percentage secondaries (Resistance, Dodge, Crit, Accuracy) step +1 pp per grade from B upward (so a God Jerkin gives +6% Dodge).

### §2.3 Shields (off hand; Block = chance to halve a physical hit)

| Shield | Ladder | Block % (F) | Defense (F) | Weight (kg) | Speed penalty | Str requirement (F) | Durability k (blocks per 1%) | Classes |
|---|---|---|---|---|---|---|---|---|
| Buckler | Wood | 15% | 1 | 2 | 0 | 6 | 1.0 | Warden, Blade, Shade, Mender, Beast Tamer |
| Kite | Wood | 25% | 3 | 5 | −5 | 11 | 1.0 | Warden, Beast Tamer |
| Tower | Metal | 35% | 5 | 9 | −10 | 15 | 1.0 | Warden |

Block steps **+2 pp per grade** (God Tower 51%, God Buckler 31%); Defense rides the ladder; Str requirement rises `req(F) + 2g` for Tower, `+ g` otherwise. A block counts as a hit absorbed for armor item XP and Endurance training. Blocked hits never wear armor, only the shield.

---

## §3 Trinkets

Universal slots, no family, no Str requirement. Rings and Talismans carry one fixed **main line** (below, at F; it rides the ladder) plus rolled affixes by grade. Trinkets do not wear in play; they lose durability only on a wipe (−10%, rulebook §12.2).

### Rings (12 types; Ring ×2, the same type may be worn twice)

| Ring | Main stat | Line (F) | God (×11.0) |
|---|---|---|---|
| Ring of Vigor | HP | +6 HP | +66 |
| Ring of Might | Attack (phys) | +2 | +22 |
| Ring of the Mind | Attack (spell) | +2 | +22 |
| Ring of the Ward | Defense | +2 | +22 |
| Ring of Quickness | Speed | +2 | +22 |
| Ring of the Eye | Crit Rate | +1% | +11% |
| Ring of the Hawk | Accuracy | +1% | +11% (cap 100%) |
| Ring of Shadows | Dodge | +1% | +11% (cap 30%) |
| Ring of Resolve | Resistance | +2% | +22% (cap 40%) |
| Ring of Finding | Detection | +1 | +11 |
| Ring of the Well | Pool (Stamina or Mana) | +5 | +55 |
| Ring of Fortune | Luck | +1 | +11 |

### Talismans (8 types)

| Talisman | Main stat | Line (F) | God (×11.0) |
|---|---|---|---|
| Talisman of Warding | Resistance | +3% | +33% (cap 40%) |
| Talisman of the Drum | Momentum gain | +4% | +44% |
| Seeker's Talisman | Detection | +2 | +22 |
| Talisman of the Deep Well | Pool | +8 | +88 |
| Talisman of the Coin | Luck | +1 | +11 |
| Talisman of the Steady Heart | Fear-ward | Fear chance −10% (immune from S) | immune |
| Talisman of Embers | Light | light falls 1 less per new room (−5 → −4); from A, −3 | −3 |
| Talisman of the Mule | Carry | +4 kg | +44 kg |

### Relics (24 named actives; once per fight unless stated)

Activating a Relic is an Item action (weight 600) unless **instant**. Numbers ride the ladder where they are flat; durations and chances do not. "First grade" is the lowest grade the relic exists at; above it the relic also rolls affix slots per its grade.

| Relic | Effect | Cooldown rule | First grade | Source |
|---|---|---|---|---|
| Lantern of the Deep | Sets light to Radiant for 3 rounds (instant) | once per fight | E | Cellars curios, Trinket chests |
| Moth Charm | Blind all enemies for 1 round | once per fight | E | Cellars |
| Hourglass Shard | Your next action weighs 0 (instant) | once per fight | D | Crypts, Trinket chests |
| Barrow Bell | Taunt every enemy onto you for 2 rounds; Fortify 1 round | once per fight | D | Crypts boss |
| Candle of the Crypt | Regen 5% HP per round on the party for 3 rounds | once per fight | D | Crypts |
| Grinning Mask | Fear the enemy front row for 1 round | once per fight | C | Grinning Captain first kill |
| Brine Pearl | Shield (absorb 25% of max HP) on the lowest ally (instant) | once per fight | C | Drowned Vault |
| Tidebound Idol | Cleanse every debuff on the party | once per fight | C | Drowned Vault boss |
| Hollow Coin | Re-roll this fight's item drop (after the fight) | once per floor | C | Hollow King |
| Ember Heart | Your next skill deals +50% damage (instant) | once per fight | B | Fungal Deep, Grand Trinket chests |
| Hound's Whistle | Your pet acts now and refills its stamina (instant) | once per fight | B | Fungal Deep |
| Stormjar | Lightning for 120% spell Attack to all enemies; Shock | once per fight | B | Fungal Deep floor drops; Grand Trinket chests |
| Shepherd's Crook | Silence one enemy for 2 rounds | once per fight | B | the Shepherd of Caps (Fungal Deep zone 1 boss, first kill) |
| Mawgrum's Tusk | Regen on the whole party for 3 rounds | once per fight | B | Mawgrum the Warren-King (Fungal Deep zone 2 boss, first kill) |
| Hierarch's Eye | Cleanse every debuff on the party | once per fight | B | the Hierarch of Blooms (Fungal Deep zone 3 boss, first kill) |
| Sporemother's Breath | Poison all enemies for 3 rounds | once per fight | A | Sporemother |
| Ashbrand Horn | Fortify 2 rounds and Haste 1 round on the party | once per fight | A | Thane Brakka Ashbrand (Emberforge zone 1 boss, first kill) |
| Master's Core | Shock immunity and Lightning +30% for the party, 3 rounds | once per fight | A | the Foundry Master (Emberforge zone 2 boss, first kill) |
| Ignatha's Scale | Fire immunity for the party, 3 rounds | once per fight | A | Ignatha, the Salamander Queen (Emberforge zone 3 boss, first kill) |
| Coldhand Horn | Fear every enemy for 2 rounds; Chilled enemies Freeze | once per fight | S | Jarl Varrek Coldhand (Frostmarch zone 1 boss, first kill) |
| Isrevel's Signet | Freeze and Petrify immunity for the party, 3 rounds | once per fight | S | Queen Isrevel of the Pale Court (Frostmarch zone 2 boss, first kill) |
| Skaldrath's Fang | Grab immunity for the party, 3 rounds | once per fight | S | Skaldrath the Elder Wyrm (Frostmarch zone 3 boss, first kill) |
| Forge Sigil | Fortify (+20% Defense) on the party 3 rounds; +5% durability to every equipped item | once per floor | S | Forge-Tyrant |
| Pale Mirror | The next enemy action aimed at you reflects back at its user (instant) | once per fight | SS | Pale Dragon, Grand chest pity |

**As built (Phase 7, pass B).** The six relics of the Crypts and the Drowned Vault are content at their first grade, and their actives work in the sim (`sim/src/relics.ts`): **Hourglass Shard** (D, instant: the next action weighs 0, hook `next-action-weightless`) · **The Barrow Bell** (D: Taunt every enemy 2 rounds, Fortify 1) · **Candle of the Crypt** (D: Regen 5% of max HP for 3 on the party) · **The Brine Pearl** (C, instant: a Shield of 25% of the lowest ally's max HP) · **The Tidebound Idol** (C: cleanse the party) · **The Hollow Coin** (C: after a won fight, re-roll its gear drop, once per floor — the delve's `relic` command). In a fight a relic is a line of the Item sheet, once per fight: an Item action (weight 600), or, when instant, no turn at all (the hero chooses again). A hero AI rule can name it like an item ("item the barrow bell"). Readings (Proposed): the relic "Brine Pearl" is written **The Brine Pearl** to read apart from the Tidebound's rare part of the same name (§8.3); a boss's own relic (the Grinning Mask, the Barrow Bell, the Tidebound Idol, the Hollow Coin) carries the tag `boss-only` and comes only from its boss, never from a random roll or a chest; the Hollow Coin re-rolls a gear drop the fight made (no drop, nothing to re-roll), and the new roll stands.

---

## §4 Consumables

Using an item is weight 600 (rulebook §3.2). Potions are percentages so one table serves every band; Small / Medium / Large are gated by where they drop and by the merchant's stock, not by level. Prices are town prices in R of the **buyer's** band; the dungeon merchant charges ×1.5; Haggling applies.

| Item | Effect | Weight (kg) | Price (R) | Where found |
|---|---|---|---|---|
| HP Potion, Small / Medium / Large | heal 25% / 40% / 60% max HP | 0.5 | 0.03 / 0.05 / 0.08 | Small floors 1–10; Medium 8–22; Large 18+; shop sells the band's size |
| Stamina Draught S / M / L | restore 30% / 50% / 80% Stamina | 0.5 | 0.03 / 0.05 / 0.08 | as HP potions |
| Mana Draught S / M / L | restore 30% / 50% / 80% Mana | 0.5 | 0.03 / 0.05 / 0.08 | as HP potions |
| Antidote | cleanse Poison and Bleed; +50% Poison resistance 3 rounds | 0.3 | 0.02 | floors 1+, Cellars vermin 10%, shop |
| Cleansing Salt | cleanse every debuff on one ally | 0.3 | 0.06 | floors 4+, Crypts, shop |
| Haste Tonic | Haste 3 rounds on one ally | 0.5 | 0.10 | floors 7+, merchant only |
| Fortify Draught | Fortify 3 rounds on one ally (+20% Defense, `03` §3.5) | 0.5 | 0.08 | floors 4+, shop |
| Torch | light +25 (out of combat; instant) | 1 | 0.02 | everywhere; Foraging makes them; shop |
| Repair Kit | +25% durability to one item, out of combat | 2 | 0.08 | common drop 8% per fight, shop, merchant |
| Whetstone | +N stone, grades F–C | 0.5 | 0.04 | floors 1–15, 8% per fight; shop |
| Honing Oil | +N stone, grades B–A | 0.5 | 0.12 (never sold in town) | floors 12–30, 8% per fight; merchant; Grand chests |
| Star Grit | +N stone, grades S–God | 0.5 | — (never sold) | floors 26+, 8% per fight; bosses; Grand chests |
| Skeleton Key | opens one locked chest or door; a trapped chest becomes safe; the chest counts as Large | 0.2 | 0.20 | Perception finds (hidden treasure), Quest Board, shop |
| Phoenix Feather | revive a downed ally at 30% HP within their 3-turn window (Item action) | 0.1 | 0.50 | 2% treasure rooms, curios, Quest Board; never more than 2 carried |
| Pet Treat | +10% pet XP this delve (once per delve); +5% bond progress | 0.2 | 0.05 | Stables, Foraging |
| Bandage | cleanse Bleed and a small heal (+15% HP) on one ally, in or out of combat (Item action); never a revive — revives are First Aid (`03` §12.1), Mender skills and the Phoenix Feather | 0.2 | 0.02 | everywhere, shop |
| Ration | rest room: +10% HP and pool to the party (one per rest) | 0.5 | 0.02 | shop, Foraging |
| Cooking Ingredient (herb, mushroom, meat, fish, salt) | with Cooking at a rest room: a meal, +5% to one stat for the next floor | 0.3 | 0.01 | Foraging in rest rooms; monster parts (meat) |
| Divine Shard | 10 forge one God item at the blacksmith, or convert 1 → 5 units of any God-rung material | 0 | never sold | Grand chests 5% from band D; every final boss's first kill (1; +1 on Dread, `07` §6.1); the Hollow King 10% on later kills (`06` §3.4) |
| Skill Tome (Tier I–V) | learn the skill; duplicate → rank XP (rulebook §7) | 0.5 | Tier I 0.1 / II 0.3 / III 1.0 (Skill Hall; IV–V never sold) | Insights, boss first kills (Tier III+), Skill Tome chests |
| Arrows ×50 | ammo for bows; one per shot | 2 | 0.02 | shop, merchant, Cellars bandits 15%, Foraging (+10 per success with a bow equipped) |
| Bolts ×50 | ammo for crossbows; one per shot | 2.5 | 0.03 | shop, merchant, Tidebound constructs 10% |

**+N stones and gold, as a formula.** Taking an item from +(N−1) to +N costs `gold = value × 2% × N` and `stones = 1 (N ≤ 6) or 2 (N ≥ 7)` of the grade's stone family (Whetstone F–C · Honing Oil B–A · Star Grit S–God). So +1 is 2% of value and +10 is 20%; the whole road to +10 is 110% of value and 14 stones; the road to an F item's +3 is 12% of value and 3 Whetstones (18 gold and 3 stones on a 150-gold Longsword). Each +N adds +5% of the item's own base (rulebook §6.2) and never an affix line.

**How a Ranger runs out.** A bow or crossbow consumes one unit per basic attack or shot skill (not per target). A delve is ~40 meaningful hits plus misses and multi-shot skills, about 60 shots, so a Ranger carries two stacks (4 kg) and tops up at the merchant or by Foraging. At 0 ammo the bow's basic attack becomes **Bash** (Blunt, 30% Attack, front row only) and shot skills are greyed; the ammo count sits on the weapon slot and turns amber at 20. Arrows do not wear the bow; the bow wears on draw at half rate (§9). Throwing knives are not ammo.

**As built (Phase 7, pass B).** The **Torch** works in a fight: an Item action, +25 light (it relights an arena brazier, `07` §2.8). The **safe items** of `07` §2.4 are consumables a curio's choice consumes; the merchant's eight — Flint & Oil; Grave Salt, Candle of Vigil, **Reading Glass**, **Empty Vial**; **Oilskin Cloak**, **Wax Plugs**, **Rope & Hook** — carry the tags `safe-item` and `zone:<zone id>`, so Dunmore stocks "two of the zone's safe items" by tag (the cooking Salt is not one); each card names the curio it answers. Holy Water and the Loaded Dice are safe items too, never merchant stock. The **Divine Shard** is a material item (`divine-shard`, never sold; its forge is Phase 11). **Chest keys** (`standard-chest-key`, `grand-chest-key`, tags `chest-key:standard` / `chest-key:grand`) are counted in the profile's materials, where boss and contract rewards land; one opens one Curio Merchant chest of its tier free (§10). **Gear stones** dropped in a delve (Whetstone, Honing Oil, Star Grit) are counted in the materials the Blacksmith spends.

---

## §5 Affix pool

~40 affixes. **Line** is the roll range by the item's grade band (F–D / C–A / S–God); within the band the roll is uniform. Weight: 5 common … 1 rarest; the pool is filtered by slot, then rolled by weight. **Prefix** goes before the material ("Keen Iron Longsword"), **Suffix** after the type ("Iron Longsword of the Bear").

| Affix | Prefix/Suffix | Line (F–D / C–A / S–God) | Slots it can roll on | Weight (rarity 1–5) |
|---|---|---|---|---|
| of the Bear | Suffix | +Strength 1–2 / 2–4 / 4–7 | any | 4 |
| of the Fox | Suffix | +Agility 1–2 / 2–4 / 4–7 | any | 4 |
| of the Ox | Suffix | +Vitality 1–2 / 2–4 / 4–7 | any | 4 |
| of the Oak | Suffix | +Endurance 1–2 / 2–4 / 4–7 | any | 4 |
| of the Owl | Suffix | +Wisdom 1–2 / 2–4 / 4–7 | any | 4 |
| of the Hawk | Suffix | +Perception 1–2 / 2–4 / 4–7 | any | 4 |
| of the Stone | Suffix | +Willpower 1–2 / 2–4 / 4–7 | any | 4 |
| of the Coin | Suffix | +Luck 1 / 1–2 / 2–4 | Ring, Talisman, Relic, Helmet | 2 |
| Vigorous | Prefix | +HP 3–5% / 5–8% / 8–12% | armor, Ring, Talisman | 5 |
| Sharp | Prefix | +Attack (phys) 1–3 / 3–8 / 8–20 | weapons | 5 |
| Arcane | Prefix | +Attack (spell) 1–3 / 3–8 / 8–20 | foci, Robes | 5 |
| Fierce | Prefix | +Attack 3–5% / 5–8% / 8–12% (phys or spell by item) | weapons, foci, Ring | 3 |
| Sturdy | Prefix | +Defense 1–2 / 2–5 / 5–12 | armor, shields | 5 |
| Swift | Prefix | +Speed 1–3 / 3–6 / 6–12 | Legs, Boots, Ring, weapons | 3 |
| Keen | Prefix | +Crit Rate 1–2% / 2–4% / 4–7% | weapons, Gloves, Ring | 3 |
| Brutal | Prefix | +Crit Damage 5–8% / 8–15% / 15–25% | weapons, Gloves | 3 |
| Precise | Prefix | +Accuracy 1–2% / 2–4% / 4–6% | weapons, Gloves, Helmet | 4 |
| Evasive | Prefix | +Dodge 1–2% / 2–4% / 4–6% | Boots, Leather, Robes, Ring | 3 |
| Warding | Prefix | +Resistance 2–3% / 3–6% / 6–10% | Helmet, Talisman, Robes, shields | 4 |
| Seeking | Prefix | +Detection 1 / 1–2 / 2–4 | Helmet, Talisman, Boots, Ring | 3 |
| Deep | Prefix | +pool 3–5 / 5–10 / 10–20 | Chest, Ring, foci, Talisman | 4 |
| Driven | Prefix | +Momentum gain 3–5% / 5–10% / 10–15% | Talisman, Gloves, weapons | 3 |
| of Renewal | Suffix | +HP regen per own turn 1% / 2% / 3% | Chest, Ring, Talisman | 2 |
| of Grace | Suffix | +healing done 3–5% / 5–10% / 10–15% | Censers, Crook, Robes, Ring | 3 |
| Flaming · Freezing · Charged · Venomous · Hallowed · Shadowed | Prefix | +5–8% / 8–15% / 15–25% of each hit as the element (Fire · Frost · Lightning · Poison · Holy · Shadow) | weapons, foci | 3 (each) |
| of Fire (Frost, Lightning, Poison, Holy, Shadow) Warding | Suffix | +10–15% / 15–25% / 25–40% resistance to that element | armor, Talisman, shields | 3 (each) |
| Bleeding | Prefix | Bleed on hit 5–8% / 8–12% / 12–20% | Slash and Pierce weapons | 3 |
| Venomed | Prefix | Poison on hit 5–8% / 8–12% / 12–20% | Pierce weapons, Whips, foci | 3 |
| Searing | Prefix | Burn on hit 5–8% / 8–12% / 12–20% | weapons, foci | 3 |
| Chilling | Prefix | Chill on hit 5–8% / 8–12% / 12–20% | weapons, foci | 3 |
| Shocking | Prefix | Shock on hit 5–8% / 8–12% / 12–20% | weapons, foci | 3 |
| Marking | Prefix | Mark on hit 5% / 5–10% / 10–15% | Bows, Crossbows, Daggers, Whips, Throwing | 2 |
| of Riposte | Suffix | on block: 10–15% / 15–25% / 25–40% chance to counter for 50% Attack | shields | 2 |
| of the Bulwark | Suffix | on block: 20% / 35% / 50% chance of Fortify 1 round | shields, Plate Chest | 2 |
| of Rending | Suffix | on crit: 20% / 35% / 50% chance to Weaken the target 2 rounds | weapons | 2 |
| of Shielding | Suffix | +Block 2–3 / 3–5 / 5–8 pp | shields | 3 |
| Spined | Prefix | reflect 5% / 10% / 15% of melee damage taken | Chest, shields | 2 |
| of Greed | Suffix | +gold found 3–5% / 5–10% / 10–15% | Boots, Ring, Talisman, Relic | 3 |
| of Plunder | Suffix | drop shape +0.5 / +1 / +2 pp toward higher grades (stacks with Luck, same cap) | Ring, Talisman | 1 |
| Enduring | Prefix | wear k +10–15% / 15–25% / 25–40% (slower wear) | weapons, armor, shields | 3 |
| of Embers | Suffix | light falls 1 / 2 / 3 less per new room | Helmet, Talisman, Relic | 2 |
| <Family>bane (Vermin, Bandit, Undead, Cultist, Construct, Ooze, Fungal, Troll, Beast, Elemental, Golem, Dwarf, Giant, Wolf, Wight, Dragon) | Prefix | +8–10% / 10–15% / 15–25% damage vs that family | weapons, foci | 2 |
| Light | Prefix | item carry weight −10–15% / 15–25% / 25–40% | armor, shields, two-handed weapons | 3 |
| Steadfast | Prefix | +Fear and Stun resistance 10% / 20% / 35% | Helmet, Talisman | 2 |
| of the Pack | Suffix | +pet stats 3–5% / 5–8% / 8–12% | Talisman, Whips, Ring | 2 |
| of the Mule | Suffix | +Carry 5 / 10 / 20 kg | Chest, Boots, Talisman | 3 |

**Roll rules.** Affix slots by grade: F 0 · E 1 · D 1 · C 2 · B 2 · A 3 · S 3 · SS 4 · God 4 (+ unique power). Slot split: 1 → either; 2 → 1 prefix + 1 suffix; 3 → 2 + 1 either way; 4 → 2 + 2. The same affix never appears twice on one item; an elemental prefix excludes a second element. A set piece (§6) spends one slot on its set line. **Lock and re-roll** at the blacksmith: lock one line (it keeps its exact number), re-roll every other line for **10% of item value + one stone** of the item's stone family; flat price, no ramp. Promotion (§8) keeps every line but re-rolls the number of one unlocked line at the new band. +N never touches affixes.

**As built (Phase 7).** The pool's three bands already reach S (C–A, S–God), so grades B–S roll from it as written; a named unique spends one slot on its signature (§7), as a set piece does on its set line.

---

## §6 Sets

Set pieces drop as named family pieces ("Barrow Warden's Helm") with the set line in one affix slot and the rest rolled. A set keeps its membership through promotion, so a D-grade set found in the Crypts can be carried to A. Bonuses do not ride the ladder.

| Set | Family | Theme (zone) | Classes | Grades | 2-piece | 4-piece |
|---|---|---|---|---|---|---|
| Barrow Warden's Vigil | Plate | the Crypts, Gravehollow F4–6 | Warden | D–B | +5 Defense; +10% Resistance to Fear and Curse | Guard also Taunts every enemy and grants Fortify 1 round |
| Cinderborn Bulwark | Plate | Emberforge deep dwarves | Warden | A–S | +15% Fire resistance; +5% Block | Burn immunity; on block 20% chance to Burn the attacker |
| Tidebound Reaver's Mail | Mail | the Drowned Vault, F7–8 | Blade, Beast Tamer | D–B | +2 Speed; +10% Poison resistance | basic attacks restore +10% Stamina; Haste 1 round on a kill |
| Wolfmarch Harness | Mail | Frostmarch winter wolves | Beast Tamer, Blade | S–SS | +10% Frost resistance; pet +5% stats | Chill immunity; the pet's Fierce attacks apply Bleed |
| Grinning Company's Cut | Leather | the Cellars bandits, F1–3 | Shade, Ranger | E–C | +5% gold found; +1 Detection | your first attack each fight is a guaranteed crit; +3% Dodge |
| Sporestalker's Weave | Leather | the Fungal Deep | Ranger, Shade | B–A | Poison immunity | +3 Detection; ambush chance −10%; Mark on crit |
| Drowned Choir's Vestments | Robes | the Tidebound cult | Arcanist | D–B | +10 Mana; +5% Frost damage | a Chilled target hit by your Frost spell Freezes at once |
| Lanternkeeper's Habit | Robes | the Crypts | Mender | D–B | +10% healing; light falls 1 less per room | Holy spells grant Regen 2 rounds; Smite +15% |
| Twin Serpents (ring pair: Ring of Venom + Ring of Antidote) | Rings | Fungal Deep slimes | any | C–A | +15% Poison damage; Poison immunity | — |
| Sun and Moon (ring pair: Ring of Dawn + Ring of Dusk) | Rings | Emberforge / Frostmarch | Mender, Arcanist | A–S | +15% Holy and Shadow damage; Wither on your Shadow spells heals you 10% of damage | — |

**As built (Phase 7, pass B).** Gravehollow's five sets are content — Grinning Company's Cut, Barrow Warden's Vigil, Tidebound Reaver's Mail (Blade; the Beast Tamer joins with the class), Drowned Choir's Vestments, Lanternkeeper's Habit — with their pieces at **every grade from the set's lowest to S**, so promotion keeps the set; a piece drops only inside the set's grades. The bonuses apply in the sim (`items.ts setBonusLoad`; the hero's stats and hooks, the delve's gold and light): distinct pieces worn and not Broken count; `buffStat` lines are stat lines, custom lines are hooks — the Vigil's Fear and Curse resistance, the Reaver's Poison resistance, the Choir's +5% Frost (`element-damage-percent`, shared with C1), the Company's gold found, the Lanternkeeper's healing and light, and five new hooks: `guard-taunts-and-fortifies`, `basic-attack-pool-restore-percent`, `haste-on-kill`, `frost-freezes-chilled`, `holy-spells-grant-regen`. The item card counts the pieces ("2 / 4") and shows which bonus is on. Readings (Proposed): the Vigil's Guard Taunts every enemy until their next turn; the Lanternkeeper's "Holy spells grant Regen 2 rounds" gives the lowest-HP ally Regen 5% for 2 turns after any skill with a Holy hit or a heal; "Smite +15%" is +15% on the wearer's hits on a Smitten target; a "Frost spell" is a skill's Frost hit; the Reaver's "+10% Stamina" is 10% of max Stamina once per basic attack.

---

## §7 Named uniques

Fixed signature line in one affix slot; the remaining slots roll normally. "Grand chest" means the Grand Gear chest of a band whose table reaches the grade (§10). Boss names are `06-MONSTERS.md`'s; "zone N boss" below means that dungeon's zone boss in `06` §4–§6.

### B — Masterwork (purple; floors 12–22)

| Name | Slot | Type / family | Signature line | Source |
|---|---|---|---|---|
| Spore-Eater | Main Hand | Hand Axe | 20% Poison on hit; +20% vs Fungal | Fungal Deep zone 1 boss; Grand chest |
| Trollgut Hauberk | Chest | Mail | Regen 2% per own turn; Burn deals ×1.5 to you | Fungal Deep trolls (rare part) |
| Lamplighter's Hood | Helmet | Leather | +3 Detection; light falls 1 less per room | Hollow King; Grand chest |
| Cave-Heart Ring | Ring | — | +8% HP; +2 Endurance | Fungal Deep cave beasts' hunter |
| Mycelial Wand | Main Hand | Wand | spells 10% Poison; +5 Mana | Fungal Deep zone 2 boss |
| Shieldbrother's Kite | Off Hand | Kite | on block: Shield (absorb 5% max HP) on the lowest ally | Grand chest; Quest Board |

### A — Heroic (orange; floors 18–30)

| Name | Slot | Type / family | Signature line | Source |
|---|---|---|---|---|
| Cinderfang | Main Hand | Greatsword | +15% of each hit as Fire; Burn on crit | Emberforge zone 1 boss |
| Anvilbreaker | Main Hand | Maul | 30% Daze on hit; +25% vs Construct and Golem | Emberforge forge-golems' hunter |
| Salamander's Breeches | Legs | Leather | Burn immunity; +4 Speed | Emberforge salamanders (rare part) |
| Deepwarden's Coif | Helmet | Mail | +8% Resistance; Blind immunity | Emberforge Cinderborn zone boss |
| Cinderborn Talisman | Talisman | — | +10% Momentum gain; your Ultimate applies Burn | Grand chest; Emberforge |
| Emberheart Ring | Ring | — | +10% Fire damage; +2 Vitality | Sporemother; Grand chest |

### S — Legendary (red; floors 26–40)

| Name | Slot | Type / family | Signature line | Source |
|---|---|---|---|---|
| Sporemother's Veil | Helmet | Robes | Poison immunity; your spells apply Poison 15% | Sporemother |
| Forge-Tyrant's Hammer | Main Hand | Maul | +30% vs Construct and Golem; 20% Stun on crit | Forge-Tyrant |
| Stillfrost | Main Hand | Longbow | arrows Chill 20%; +50% damage to Frozen targets | Frostmarch zone 1 boss |
| Giantsbane Harness | Chest | Plate | +25% vs Giant; Fortify when you first drop below 50% HP each fight | Frostmarch frost giants' hunter |
| Wyrmward Buckler | Off Hand | Buckler | Block also applies to spell and breath damage | Frostmarch wyrms (rare part); Grand chest |
| Ring of the Long Winter | Ring | — | +3 Luck; +10% gold found | Grand chest pity; Frostmarch zone 2 boss |

**As built (Phase 7, pass B).** Six named uniques ship: the B pair, **Lamplighter's Hood** and **Shieldbrother's Kite**, and the A and S uniques whose Source includes a Grand chest — the ones a Gravehollow boss's "one A-grade item" or "one S-grade item" can roll: **Cinderborn Talisman**, **Emberheart Ring**, **Wyrmward Buckler**, **Ring of the Long Winter**. The rest wait for their dungeons. Each is its family piece at its grade (or a trinket of its own) with the signature in one affix slot: a stat line, an attribute line (+2 Vitality, +3 Luck) or a hook (`light-decay-reduction`, `shield-lowest-ally-on-block`, `ultimate-applies-status`, `element-damage-percent`, `block-applies-to-spells`, `gold-found-percent`). Reading (Proposed): the Wyrmward Buckler rolls the wearer's Block against every non-physical direct hit and halves it on a success.

### SS — Mythic (gold; floors 35+)

| Name | Slot | Type / family | Signature line | Source |
|---|---|---|---|---|
| Wyrmscale Mantle | Chest | Leather (Dragon Scale) | Frost immunity; breath attacks halved | Pale Dragon 10%; Grand chest pity |
| Winter's Edge | Main Hand | Sabre | Chill on hit 25%; +10 Speed | Frostmarch zone 3 boss |
| Jarl's Helm | Helmet | Plate | +5 Strength; Stun immunity | frost giant king (hunter) |
| Wightfire Staff | Main Hand | Staff | +20% spell Attack; Shadow spells Wither 100% | ice wights' zone boss |
| Talisman of the Wyrm | Talisman | — | Fear immunity; +15% Resistance | Pale Dragon 10% |
| Pale Mirror | Relic | — | see §3 | Pale Dragon; Grand chest pity |

### God — Divine (white-gold, animated): eleven named items

Eleven items, one per slot, with Main Hand holding three class-family options; the Off Hand is covered because two of the three weapons are two-handed and fill both hands (a dedicated God shield is an open question). The Pet slot's "God item" is a God-grade egg (rulebook §9, `06-MONSTERS.md` §9), not an item in this file. God armor pieces are **family-less**: they take the wearer's class family for look, speed penalty share and requirement, so every class can wear every God armor piece. Each God item has 4 rolled affix slots plus its **unique power**. **How obtained:** each is bound to one final boss and drops from any kill of that boss at 1% on Normal / 2% Hard / 4% Dread; or **10 Divine Shards** forge any God item of the player's choice at the blacksmith (deterministic path). Never in a random table.

| # | Name | Slot | Class lock | Bound boss |
|---|---|---|---|---|
| 1 | Daybreak Edge | Main Hand (Longsword) | Warden, Blade, Beast Tamer | Forge-Tyrant |
| 2 | Wintervane | Main Hand (Longbow, 2h) | Ranger, Shade | Pale Dragon |
| 3 | Rootspire | Main Hand (Staff, 2h) | Arcanist, Mender | Sporemother |
| 4 | Crown of the Hollow King | Helmet | any | Hollow King |
| 5 | Ancient Dragon's Mantle | Chest | any | Pale Dragon |
| 6 | Greaves of the Unbroken March | Legs | any | Forge-Tyrant |
| 7 | Mycelial Treads | Boots | any | Sporemother |
| 8 | Tyrant's Gauntlets | Gloves | any | Forge-Tyrant |
| 9 | Signet of the Hollow Throne | Ring | any | Hollow King |
| 10 | Sporemother's Heart | Talisman | any | Sporemother |
| 11 | The Last Lantern | Relic | any | Hollow King |

**Daybreak Edge** (Longsword, Base Attack 132). Every third hit the wielder lands is Holy, cannot miss and Smites; when the wielder Guards, their next basic attack Cleaves both rows for full damage. A Warden who alternates Guard and strike becomes the party's rhythm; a Blade simply hits harder and more surely than anything else in the game.

**Wintervane** (Longbow, Base Attack 176). Never consumes arrows. Every hit applies Chill; a hit on a Frozen target is a guaranteed crit that shatters the Freeze (the target thaws, Dazed). Pairs with any Frost caster: Chill from the bow, Freeze from the spell, the crit from the bow again.

**Rootspire** (Staff, focusPower 154, +110 Mana). Fortune is tripled for its wielder (cap 25% stays), and every spell cast grants Regen for 2 rounds to the lowest-HP ally. An Arcanist casts more often for free; a Mender's damage spells heal by existing.

**Crown of the Hollow King** (Helmet). The wearer is immune to Fear and Curse, and once per fight, when the wearer would be downed, they instead stay at 1 HP and every enemy is Feared for 1 round. The Hollow King's own stubbornness, worn.

**Ancient Dragon's Mantle** (Chest). Immune to Burn and Chill; breath and elemental attacks against the wearer are halved; when the wearer is hit by an element, their next skill gains +25% of that element's damage. The dragon takes the blow and gives it back.

**Greaves of the Unbroken March** (Legs). The wearer cannot be Rooted, Webbed, Slowed or Grabbed, ignores the carry-weight Speed penalty entirely, and gains +1 Speed per 10% of max HP missing. The Forge-Tyrant's army marched through fire; so does the wearer.

**Mycelial Treads** (Boots). +6 Detection; the wearer's party can never be ambushed in Shadowy or brighter light; on entering a room the wearer scouts automatically (the §4.3 scouting roll always succeeds). Perception as an item.

**Tyrant's Gauntlets** (Gloves). +10% Crit Rate and +30% Crit Damage; every crit the wearer lands applies Weaken for 2 rounds and restores 10% of their pool. The forge-hammer hand.

**Signet of the Hollow Throne** (Ring). +5 Luck; gold found +25%; once per floor, the party's next item drop rolls its grade twice and keeps the better. The ring the Hollow King sealed his treasury with.

**Sporemother's Heart** (Talisman). +25% Momentum gain for the wearer; when the wearer uses their Ultimate, every ally gains +20 Momentum and the pet acts immediately. A talisman for the one who wants to be the party's engine.

**The Last Lantern** (Relic, once per floor, instant). Sets light to Radiant for the rest of the floor, cancels the hunter if it is on the floor, and gives every hero +500 energy on the timeline. The light the Hollow King kept burning in the deep; using it well is the difference between a clean boss fight and a wipe.

---

## §8 Materials

### §8.1 The four ladders with regional variants

Each dungeon picks one name of the pair per rung at generation; the two names share every number and differ in name and tint only. Promotion accepts either variant of a rung (a Steel Longsword promotes to Blacksteel with 12 Blacksteel *or* 12 Duskiron).

| Grade | Metal (weapons, Plate, Mail, Tower) | Hide (Leather, Whips) | Cloth (Robes) | Wood (Bows, Crossbows, Staves, Wands, Bucklers, Kites) |
|---|---|---|---|---|
| F | Copper / Tin | Rawhide / Pelt | Burlap / Sackcloth | Pine / Birch |
| E | Bronze / Brass | Leather / Boarhide | Linen / Hemp | Ash / Elm |
| D | Iron / Cold Iron | Boiled Leather / Lacquered Leather | Wool / Felt | Oak / Hickory |
| C | Steel / Bluesteel | Wolf Hide / Bear Hide | Silk / Spidersilk | Yew / Hazel |
| B | Blacksteel / Duskiron | Wyvern Hide / Troll Hide | Glyphweave / Sporecloth | Ironwood / Bloodwood |
| A | Skysteel / Moonsilver | Basilisk Scale / Cockatrice Scale | Moonweave / Sunweave | Ebony / Cinderwood |
| S | Adamantine / Deepsteel | Drake Scale / Salamander Scale | Phoenix Weave / Ember Weave | Elderwood / Treantheart |
| SS | Orichalcum / Sunbronze | Dragon Scale / Wyrm Scale | Voidcloth / Gloomweave | World-tree Bough / Frostroot |
| God | Starmetal / Skyiron | Ancient Dragon Scale / Elder Wyrm Scale | Celestial Thread / Seraph Thread | Godwood / Dawnwood |

Gravehollow uses the first name of each pair (Copper, Rawhide, Burlap, Pine … Steel, Wolf Hide, Silk, Yew); the Fungal Deep the second (Troll Hide, Sporecloth, Bloodwood, Duskiron); Emberforge the second (Cinderwood, Salamander Scale, Ember Weave, Deepsteel); Frostmarch the second (Frostroot, Wyrm Scale, Gloomweave, Sunbronze). The God rung is never regional: it is always the first name.

### §8.2 Promotion table

The rulebook (§6.5) gives eight promotion counts (F→E 6 · E→D 8 · D→C 10 · C→B 12 · B→A 16 · A→S 20 · S→SS 30 · SS→God 50) and sets **forging a fresh F piece** at 4 units (D-031); this table restates them with the gold. Promotion consumes the **target** rung's material; gold = 25% of the target grade's value (slot factor 1.0; scale by the item's slot factor). No failure roll. Item XP, affinities and set membership carry; one unlocked affix line re-rolls its number; +N resets to +0 with stones refunded at 50%.

| Step | Units of the target material | Gold (slot factor 1.0) | Example (Hide) |
|---|---|---|---|
| Forge F | 4 | 38 (25% of F) | 4 Rawhide → Rawhide Jerkin |
| F → E | 6 | 60 | 6 Leather |
| E → D | 8 | 95 | 8 Boiled Leather |
| D → C | 10 | 150 | 10 Wolf Hide |
| C → B | 12 | 250 | 12 Wyvern Hide |
| B → A | 16 | 400 | 16 Basilisk Scale |
| A → S | 20 | 625 | 20 Drake Scale |
| S → SS | 30 | 1,000 | 30 Dragon Scale |
| SS → God | 50 | 1,625 | 50 Ancient Dragon Scale (= 10 Divine Shards converted) |

An item promoted to God gets its fourth affix slot and one **Divine line** from a short per-slot list (weapon: "+10% damage per 25 Momentum held"; armor: "+10% of this piece's Defense as HP regen per fight") instead of a named power — the named God items (§7) stay the stronger thing.

### §8.3 Monster → material map

Every monster family maps to one common part (35% per kill) and one rare part (4% per kill). A **part break** (hitting a marked limb in combat) doubles the rare roll for that monster. A boss drops a **guaranteed stack** of 5–10 common units every kill and its rare part guaranteed on first kill. Dragons (Frostmarch wyrms and the Pale Dragon) drop 1–3 Dragon Scale guaranteed per kill. "Bone Shard" and "Brine Pearl" are not promotion materials: Bone Shards sell (0.01 R) and feed Field Repair; Brine Pearls are the Trinket affix stone (one re-roll on a Ring or Talisman).

| Dungeon · zone (floors, levels) | Family | Common part (35%) | Rare part (4%) | Boss stack |
|---|---|---|---|---|
| Gravehollow · the Cellars (F1–3, L1–4) | Vermin | Rawhide (rats, hounds); Pine (nest timber) | Whetstone; Burlap bolt ×3 | — |
| Gravehollow · the Cellars | the Grinning Company (bandits) | Copper (stolen gear); Leather; arrows ×10 | Bronze ×2; Grinning Mask (Captain, first kill) | Grinning Captain: 8 Copper + 8 Rawhide first kill, half after (`06` §3.1) |
| Gravehollow · the Crypts (F4–6, L5–8) | the Restless Dead | Bone Shard; Bronze or Iron (grave goods); Linen (shrouds) | Wool ×2; Iron ×2; Whetstone | zone boss: 8 Iron + 8 Wool + 10 Bone Shards first kill, half after; rare: Barrow Bell |
| Gravehollow · the Crypts | crypt spiders | Spidersilk (counts as Silk) | Spidersilk ×3 | — |
| Gravehollow · the Drowned Vault (F7–8, L11–13) | the Tidebound cult | Steel (blades); Silk (vestments); Ash (staves) | Brine Pearl; Yew | zone boss: 10 Steel + 10 Silk + 3 Brine Pearl first kill, half after; rare: Tidebound Idol |
| Gravehollow · the Drowned Vault | constructs | Iron; bolts ×10 | Steel ×2 | — |
| Gravehollow · the Drowned Vault | oozes | Boiled Leather (dissolved hides) | Honing Oil | — |
| Gravehollow · F8 (L13) | the Hollow King | — | — | 12 Steel + 12 Silk + 12 Iron first kill, half after; Hollow Coin and a Divine Shard first kill |
| the Fungal Deep (L12–26) | capfolk | Sporecloth (Glyphweave) | Honing Oil | bosses: 8 Glyphweave |
| the Fungal Deep | trolls | Troll Hide (Wyvern Hide) | Trollgut Hauberk | 8 Wyvern Hide |
| the Fungal Deep | slimes | Honing Oil; Bloodwood (digested timber) | Twin Serpents ring | — |
| the Fungal Deep | cave beasts | Bear Hide (Wolf Hide); Cockatrice Scale (Basilisk Scale, deep floors) | Duskiron (Blacksteel) ×2 | hunter: Cave-Heart Ring |
| Emberforge (L24–38) | salamanders | Salamander Scale (Drake Scale) | Salamander's Breeches | 6 Drake Scale |
| Emberforge | fire elementals | Ember Weave (Phoenix Weave) | Star Grit | 6 Phoenix Weave |
| Emberforge | forge-golems | Moonsilver (Skysteel); Deepsteel (Adamantine) | Star Grit ×2 | 8 Skysteel |
| Emberforge | the Cinderborn (deep dwarves) | Skysteel; Cinderwood (Ebony) | Adamantine ×2 | zone boss: 10 Adamantine; Forge-Tyrant: 12 Skysteel + 12 Glyphweave + 1 Divine Shard first kill (`06` §5) |
| Frostmarch Citadel (L36–50) | frost giants | Sunbronze (Orichalcum) | Jarl's Helm (hunter) | 8 Orichalcum |
| Frostmarch | winter wolves | Winter Wolf Pelt (counts as Drake Scale) | Wolfmarch set piece | — |
| Frostmarch | ice wights | Gloomweave (Voidcloth) | Wightfire Staff | 8 Voidcloth |
| Frostmarch | ice wyrms | Dragon Scale ×1–3 guaranteed; Frostroot (World-tree Bough) | Wyrmward Buckler | 10 Dragon Scale |
| Frostmarch · F10 (global floor 38) | the Pale Dragon | — | — | 1–3 Dragon Scale first kill, 1 every later kill; 12 Adamantine + 12 Moonweave + 1 Divine Shard first kill (`06` §6) |

God-rung materials (Starmetal, Ancient Dragon Scale, Celestial Thread, Godwood) come only from final bosses on Hard or Dread (1–2 units) and from Divine Shard conversion (1 → 5 units of one God material). A Starmetal fall (a rare curio, 2% of floors from band A) gives 3 Starmetal.

**As built (Phase 7, pass B).** The B, A and S rungs of the four ladders are material items, valued at a tenth of their grade value (B 100 · A 160 · S 250; never sold, §8.5 — Proposed). `06`'s regional names that count as a rung — *Cured Ghoulhide* (Boiled Leather, D), *Spidersilk* (Silk, C), *Sharkskin* (Wolf Hide, C) — are materials tagged `regional`: promotion takes them, while a crate, a salvage or a dupe pays the rung's first name. The Crypts' and the Vault's rare parts are stones at 0.04 R of their band: Knight's Gorget, Sexton's Bell, Grave Candle, Ghoul Claw, Wraith Ash, Tomb Spinneret, Hound's Collar; Brine Pearl, Tide Glass, Penance Chain, Diving Bell Plate, Sentinel Core (`07`'s Sentinel Plinth "Construct Core" — Proposed), Hag's Eye, Leech Heart and the SS-rated Maw Pearl (0.12 R). Bone Shards, Bat Wings, Deep Flesh, Brine Salt and the Mourner's Tear are materials that sell.

**The P7 milestone** (`12` §4: "a +N Skysteel-promoted sword"; Proposed): Skysteel is the A rung and comes from Emberforge (§8.3), so in Gravehollow the milestone is an **A-grade (Skysteel) sword from a Gravehollow boss's A-grade reward** — the Barrow Warden's or Sister Naesa's first kill, a Warden's or Blade's roll — **raised to +8 with Honing Oil** (the B–A stone; Gravehollow gives it at the Embalmer's Table and the Warding Glyph, `07` §2.4–§2.5) and gold. A Steel sword can also climb to Blacksteel and Skysteel with their rungs, which Gravehollow does not drop.

### §8.4 Salvage returns

Salvage (blacksmith, free) returns 25% of the cost to reach the item's grade, in its own material, rounded half up; an item destroyed by neglect (§9) returns 50%. Chest dupes auto-salvage at the 25% rate.

| Grade | F | E | D | C | B | A | S | SS | God |
|---|---|---|---|---|---|---|---|---|---|
| Salvage (25%) | 1 | 2 | 2 | 3 | 3 | 4 | 5 | 8 | 13 |
| Destroyed by neglect (50%) | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 15 | 25 |

### §8.5 The blacksmith's weekly stock (F–C only) and Material Crates

| Rung | Price per unit (gold) | Weekly stock per ladder |
|---|---|---|
| F (Copper, Rawhide, Burlap, Pine) | 10 | 20 |
| E (Bronze, Leather, Linen, Ash) | 20 | 18 |
| D (Iron, Boiled Leather, Wool, Oak) | 35 | 16 |
| C (Steel, Wolf Hide, Silk, Yew) | 60 | 10 |

Stock resets at the weekly reset; one promotion per ladder per week is what it is sized for. Grades B and up are never sold: those materials come from the dungeon and from **Material Crates** — Standard (0.3 R) = 6 units of the player's band rung in a ladder of their choice + 10% rare part; Grand (1.2 R) = 20 units + a guaranteed rare part. The crate's band is the chest band (§10).

### §8.6 Generic +N stones by band

| Stone | Grades it upgrades | Drops on floors | Per-fight drop chance | Boss drop | Price |
|---|---|---|---|---|---|
| Whetstone | F–C | 1–15 | 8% | 2 guaranteed | 0.04 R (shop) |
| Honing Oil | B–A | 12–30 | 8% | 2 guaranteed | 0.12 R (merchant only) |
| Star Grit | S–God | 26+ | 8% | 3 guaranteed | never sold |

---

## §9 Durability reference

### §9.1 Wear constant k

Rulebook §6.4: a fully used F weapon loses ~30% per delve of ~40 meaningful hits, so **k(F, weapon) = 40 / 30 = 1.33 hits per 1%**, and k × 1.25 per grade. Armor is calibrated to ~90 hits taken per delve by a front-row hero, split Chest 30 · Helmet 20 · Legs 20 · Boots 10 · Gloves 10 by the hit weights, so the Chest is the piece that wears (30% at Mail F) and the gloves barely do (10%). Bows wear on draw at half rate (k × 2). Trinkets do not wear. Durability is stored as basis points (0–10,000); wear per event = 100 / k basis points, rounded to the integer the sim keeps.

| Item class | F | E | D | C | B | A | S | SS | God |
|---|---|---|---|---|---|---|---|---|---|
| Weapons (melee, foci, thrown, crossbows) | 1.33 | 1.67 | 2.08 | 2.60 | 3.26 | 4.07 | 5.09 | 6.36 | 7.95 |
| Bows (half rate) | 2.67 | 3.33 | 4.17 | 5.21 | 6.51 | 8.14 | 10.17 | 12.72 | 15.89 |
| Plate | 1.20 | 1.50 | 1.88 | 2.34 | 2.93 | 3.66 | 4.58 | 5.72 | 7.15 |
| Mail · Shields (per block) | 1.00 | 1.25 | 1.56 | 1.95 | 2.44 | 3.05 | 3.81 | 4.77 | 5.96 |
| Leather | 0.80 | 1.00 | 1.25 | 1.56 | 1.95 | 2.44 | 3.05 | 3.81 | 4.77 |
| Robes | 0.50 | 0.63 | 0.78 | 0.98 | 1.22 | 1.53 | 1.91 | 2.38 | 2.98 |

A Skysteel (A) blade at 4.07 lasts 3.05× a Copper one, as the rulebook promises. Leather and Robes have lower k because their wearers are hit less; the per-delve wear lands in the same 25–30% band for a Jerkin or a Robe that is actually taking hits.

### §9.2 Stat bands

| Durability | Effect |
|---|---|
| 100–60% | full stats; green pip |
| 60–20% | linear falloff to −30% of the item's lines (weapons also −10% Accuracy); amber pip |
| 20–1% | **Damaged**: −50%; red pip; a toast at 20% |
| 0% | **Broken**: 0 stats, still equipped, never destroyed by wear |

### §9.3 Repair cost (% of value) and the delve bill

Blacksmith: **0.5% of item value per point**, so a full 30-point repair is 15% of value and a 100-point repair is 50%. Repair Kit +25% (0.08 R); Field Repair +10% for one material unit of the item's own rung or a Bone Shard. Repair never lowers maxDurability.

| Grade | Weapon value (slot 1.0) | 30-point repair (gold) | as % of R at the grade's band |
|---|---|---|---|
| F | 150 | 23 | 7.5% |
| E | 240 | 36 | 7.5% |
| D | 380 | 57 | 7.4% |
| C | 600 | 90 | 7.3% |
| B | 1,000 | 150 | 7.6% |
| A | 1,600 | 240 | 7.6% |
| S | 2,500 | 375 | 7.4% |
| SS | 4,000 | 600 | 7.4% |
| God | 6,500 | 975 | 12.1% (band SS R) |

A typical F delve bill for a Warden (weapon 30 pts, shield 25, Breastplate 25, Helm and Greaves 17 each, Sabatons and Gauntlets 8 each) is about 80 gold ≈ 27% of R, inside the rulebook's "≥ 70% left". The runner should hold this between 20% and 30%; the 0.5% per point is the knob.

### §9.4 Delves to broken (no care, fully used)

| Grade | F | E | D | C | B | A | S | SS | God |
|---|---|---|---|---|---|---|---|---|---|
| Wear per delve | 30% | 24% | 19% | 15% | 12% | 10% | 8% | 6% | 5% |
| Delves to Broken | 3.3 | 4.2 | 5.2 | 6.5 | 8.1 | 10.2 | 12.7 | 15.9 | 19.9 |

### §9.5 maxDurability erosion and destruction

Each time an item **reaches 0%**, maxDurability −5 permanently (100 → 95 …); a wipe's −10% can trigger it. Warnings at maxDurability 20 and 10 (a red frame on the slot and a town prompt). At **maxDurability 0** the item is destroyed into salvage at 50% (§8.4); its item XP is lost unless it was Awakened (level 10), in which case the salvage carries 60% of its XP into a successor of the same type (rulebook §5.2). Twenty neglect cycles separate a new item from destruction; repair at any point above 0% never counts as a cycle.

---

## §10 Chests

Bought from Mab at the Curio Merchant with gold only. A player's **chest band** is the band of the deepest floor they have *cleared* (the R table at the top of this file), capped at **A** — SS is never a chest's centre, so it stays the scarce thing. Shape: Standard = centre 56 · +1 25 · +2 14 · +3 4 · +4 1 (the rulebook's drop shape, D-008); Grand = +1 45 · +2 35 · +3 15 · +4 5. **Fold rule:** any line that would be God moves its weight to the line below it (SS). **Shard rule:** from band D up, the Grand chest's +4 line becomes a **Divine Shard 5%**; below band D it stays an item.

### §10.1 Gear chests (Weapon / Armor / Trinket), by band

| Band | Standard (0.5 R) | Grand (2.5 R) |
|---|---|---|
| F | F 56 · E 25 · D 14 · C 4 · B 1 | E 45 · D 35 · C 15 · B 5 |
| E | E 56 · D 25 · C 14 · B 4 · A 1 | D 45 · C 35 · B 15 · A 5 |
| D | D 56 · C 25 · B 14 · A 4 · S 1 | C 45 · B 35 · A 15 · Divine Shard 5 |
| C | C 56 · B 25 · A 14 · S 4 · SS 1 | B 45 · A 35 · S 15 · Divine Shard 5 |
| **B** | **B 56 · A 25 · S 14 · SS 5 · God 0** (4 + 1 folded into SS) | **A 45 · S 35 · SS 15 · Divine Shard 5** |
| A | A 56 · S 25 · SS 19 (14 + 4 + 1 folded) | S 45 · SS 50 · Divine Shard 5 |

The band-B Standard line is the rulebook's (§8.3) B 56 · A 25 · S 14 · SS 5 · God 0 — the drop shape 56 / 25 / 14 / 4 / 1 with the God point folded into SS. Every Standard line sums to 100. **Sub-type targeting:** a Weapon chest asks for a weapon type the class can use; an Armor chest for a piece; a Trinket chest for Ring / Talisman / Relic — so a dupe is a same-slot item, not a useless one. The item rolls affixes by grade; named uniques (§7) are 10% of any roll at B+ for a grade that has them; set pieces 15% at grades that have sets.

**Pity, two layers (per chest family, counters shown):** a ≥ +1-grade item within every 10 Standard chests and a ≥ +2 within every 40; Grand chests advance the same counters by 3. Luck adds +0.5 pp per point above 10 to the upper lines (cap +15 pp), taken from the centre. **Dupes:** gear of a type already in the armory at the same or lower grade and lower item level auto-salvages (§8.4) unless the player taps *Keep* within the reveal; pet → +1 bond star (to 5); Tome → rank XP.

### §10.2 Pet Egg, Material Crate, Skill Tome

| Chest | Standard | Grand | Contents and rule |
|---|---|---|---|
| Pet Egg | 1.5 R | 6 R | one egg of the band's species pool (`06-MONSTERS.md` §9); grade by the Gear tables above; same pity counters (own family) |
| Wayfarer Chest | 1.2 R | — | one **wayfarer** of the cast (`04-CLASSES.md` §7) called to the Lantern Inn: grade D 50 · C 30 · B 15 · A 5 at every band in Segment 1, then a wayfarer of that grade not already with you (a grade with nobody left re-rolls among the grades that have someone); pity read from D — a C or better within 10, a B or better within 40; refused when the Inn is full (12) or the whole cast is with you; no dupes, no Luck shift (D-091) |
| Material Crate | 0.3 R | 1.2 R | 6 / 20 units of the band rung, ladder of choice; rare part 10% / guaranteed; no pity (deterministic) |
| Skill Tome | 0.8 R | 3 R | **the Tome bag:** one bag per class per tier holding every skill of that tier the player does not own; Standard picks a tier at I 50 / II 35 / III 15 then draws from that bag without replacement; Grand picks II 40 / III 40 / IV 20; an empty bag passes its weight to the next tier up; when every eligible bag is empty the chest gives a Tome of Practice (rank XP equal to one full rank for a chosen skill) and says so before purchase |

**As built (Phase 7, pass B).** **Chest keys** open any Curio Merchant chest of their tier — gear, egg, crate, Tome or wayfarer — at the same odds and pity as buying it (`07` §7; `town.ts openChestWithKey`; Proposed: every kind, `tuning.json → chests.keyOpensKinds`). The **Grand Wayfarer Chest** (5 R, sold from chest band E — "S-grade wayfarers for deeper bands", `12` Phase 7) calls C 45 · B 35 · A 15 · **S 5** (the Grand shape one grade up from the Standard's D) on the shared pity counters, a Grand counting three; the Standard Wayfarer Chest keeps D-091's D 50 · C 30 · B 15 · A 5 at every band of Gravehollow. Six S-grade wayfarers join the cast, one per class and species (`04` §7). Proposed.

### §10.3 In-dungeon chests

| Chest | Grade shape (relative to the floor's centre) | Locked | Trapped | Contents |
|---|---|---|---|---|
| Small | centre 75 · +1 25 | 20% | 15% | 1 item + gold = 1 fight + 1 consumable |
| Large | +1 75 · +2 25 | 40% | 25% | 1 item + gold = 2 fights + 2 consumables + 1 stone of the band |

A locked chest opens with Lockpicking (success per `09-SKILLS.md` §5 — +5% per rank — against the lock's difficulty; a failed pick never breaks the chest) or a **Skeleton Key**. A trapped chest triggers its trap on the opener unless Trap Disarm or a key is used. A key makes any chest safe, opens it, and upgrades a Small to Large (a Large keyed gets a second item). Treasure rooms hold a Large chest 20% of the time; the hunter's kill drops a Large.

### §10.4 The Odds button, as the player reads it

> **Standard Weapon Chest — 985 gold (0.5 R at your band, B)**
> You will receive one weapon of a type your class can use. Grade odds: Masterwork 56% · Heroic 25% · Legendary 14% · Mythic 5% · Divine 0%. Your Luck (14) shifts 2% from Masterwork to the higher grades.
> Pity: a Heroic or better is guaranteed within 10 chests (7 to go) and a Legendary or better within 40 (23 to go).
> Duplicates of a weapon you already own at the same or lower grade are turned into materials unless you tap Keep. Nothing here is sold for money.

---

## §11 Loot tables by floor band — Gravehollow Keep

Gold is per fight, split at banking; R per delve at the band lands near the R table at the top of this file (≈15 fights per 3-floor delve + treasure + boss; the Drowned Vault's two floors hold about 8 fights and two bosses). Item chance is per fight for a gear item (weapons, armor, trinkets); elites always drop one; parts are per monster (§8.3); stones 8% per fight. **Grade shape** is the floor-drop shape (centre 56 · −1 25 · +1 14 · +2 4 · +3 1, D-008), with a missing lower grade folded into the centre; every line sums to 100.

| Floors | Monster levels | Centre | Gold per fight | Item chance | Grade shape | Part chance (per monster) | Consumable drop |
|---|---|---|---|---|---|---|---|
| 1–3 (the Cellars) | 1–4 | F | 10–20 | 35% | F 81 · E 14 · D 4 · C 1 | common 35% · rare 4% | 40%: potion S, torch, arrows, bandage |
| 4–6 (the Crypts) | 5–8 | E | 11–21 | 40% | F 25 · E 56 · D 14 · C 4 · B 1 | 35% · 4% | 40%: potion S, Cleansing Salt, Repair Kit |
| 7 (the Drowned Vault) | 11 | D | 17–33 | 45% | E 25 · D 56 · C 14 · B 4 · A 1 | 35% · 4% | 45%: potion M, Fortify, bolts |
| 8 (the Hollow King's floor) | 13 | C | 27–40 | 50% | D 25 · C 56 · B 14 · A 4 · S 1 | 35% · 4% | 50%: potion M, Haste Tonic |

*As tuned (Phase 7 balance pass, D-128): the Crypts', Vault's and throne's gold per fight cut by a third (16–32 → 11–21, 25–50 → 17–33, 40–60 → 27–40) so a floor's gold lands inside `07` §2.3's band; parties of four still find about 1.4× a solo's gold per delve — a checkpoint-2 question (`docs/balance/2026-10-28-gravehollow-round2.md` §13).* *As tuned (Phase 8 balance pass, pass D — `docs/balance/2026-10-29-segment2.md`): **a fight's gold undoes the party-size count rule** (Proposed, a formula change in `sim/src/loot.ts` `fightGold`): the Fodder and Elites the count rule scaled (×0.6 / 0.8 / 1.0 / 1.6 for 1–4 heroes) pay as the 3-hero pack the table was written for, while a Special, a Monster, a hunter or a boss — never removed or added by the rule — pays as before, and a preset's extra monsters still pay; so a four's fight pays like a trio's and a solo's no less. With it the Cellars' **gold per fight is 7–14** (from 10–20) and Captain Vexa's purse **gold ×6** (from ×10; her fight pays about 40 against the boss table's 60 below, the Barrow Warden's about 55 against 100, Sister Naesa's about 120 against 150, the Hollow King's about 300): every party now finds 0.8–1.2 R per cleared delve (target 0.7–1.3 R; fours had found about 1.4 R, the Cellars' parties 1.3–1.6 R), and every floor lands inside `07` §2.3's band — F1 58 · F2 85 · F3 159 · F4 155 · F5 156 · F6 217 · F7 403 · F8 392 gold against 80 · 100 · 120 · 140 · 160 · 180 · 370 · 400.*

**Treasure rooms** (7% of rooms): 2–4 gold piles worth two fights' gold, one guaranteed Small chest, a Large chest 20% (locked 40%, trapped 25%, §10.3), one consumable bundle (3 items of the floor's list), hidden treasure on a Detection find (an extra item at +1 shape or a Skeleton Key 10%). **Curios** pay by their own tables (`07-DUNGEONS.md`). **Darkness** multiplies item chance by the rulebook §4.2 light band bonus (+10% / +25% / +50% / +75%).

**Boss first-kill guarantees** (`06` owns these lists; this table restates them with the gold and the stones of §8.6):

| Boss (floor) | Gold | Every kill | First kill adds |
|---|---|---|---|
| Captain Vexa Marrow, the Grinning Captain (F3) | 60 | the stack — Copper ×8 + Rawhide ×8 on the first kill, Copper ×4 + Rawhide ×4 after; 2 Whetstones | a Tier III Tome (bag draw); one D-grade item; the Grinning Mask (C Relic); 1 Standard chest key |
| the Barrow Warden (F6) | 100 | the stack — Iron ×8 + Wool ×8 + Bone Shards ×10 on the first kill, half after; 2 Whetstones; after the first kill an A-grade item 10% | a Tier III Tome; one A-grade item; the Barrow Bell (D Relic); 1 Grand chest key |
| Sister Naesa, the Tidebound Priestess (F7) | 150 | the stack — Steel ×10 + Silk ×10 + Brine Pearl ×3 on the first kill, half after; 3 Whetstones; after the first kill an A-grade item 10% | a Tier III Tome; one A-grade item; the Tidebound Idol (C Relic); 1 Grand chest key |
| the Hollow King (F8) | 300 | the stack — Steel ×12 + Silk ×12 + Iron ×12 on the first kill, half after; 3 Whetstones; after the first kill: Crown / Signet / Last Lantern 1% (2% Hard, 4% Dread), a Divine Shard 10% | one Divine Shard; one S-grade item; a Tier IV Tome (bag draw); the Hollow Coin (C Relic); 2 Grand keys; +1 Luck (rulebook §2 open question) |
| the Warden's Hound (hunter, any floor) | 1 fight's gold ×2 | a rare part of the floor's family; a Large chest | — |

**As built (Phase 7, pass B).** The four tables are content: `gravehollow-cellars` (F1–3, Phase 3's), `gravehollow-crypts` (F4–6), `gravehollow-vault` (F7) and `gravehollow-throne` (F8), from the rows above; lint rule 27 checks each table's item and part chances against `tuning.json → items.lootItemChanceByCentre` and `equipment.parts`. Their strongrooms lock a Large chest 40% (the Small half that, §10.3) and trap 20%; the throne floor has no strongroom but the schema wants the block, so it carries the Vault's. A boss's "one A-grade item" and "one S-grade item" roll through `loot.ts rollRewardItem(content, rng, grade, classId)`: exactly that grade, set pieces and named uniques at their §10.1 shares, never a God item or another boss's relic.

---

## §12 Starter kits (all F-grade, Gravehollow's first-name materials)

Every kit — the Arcanist's and the Mender's included — also holds 2 Small HP Potions, 2 Torches, 1 Repair Kit, 1 Bandage, and the F pet egg chosen at creation. The class sheets' §2 kit rows restate this table. Starter gear has 0 affixes and +0; it is the item the player will promote or salvage by floor 4.

| Class | Main Hand | Off Hand | Helmet | Chest | Legs | Boots | Gloves | Trinkets |
|---|---|---|---|---|---|---|---|---|
| Warden | Copper Shortsword | Pine Buckler | Copper Helm | Copper Breastplate | Copper Greaves | Copper Sabatons | Copper Gauntlets | Ring of Vigor |
| Blade | Copper Longsword | Copper Dagger | Copper Coif | Copper Hauberk | Copper Chausses | Copper Treads | Copper Mitts | Ring of Might |
| Warden · spear kit | Copper Spear (two hands) | — | Copper Helm | Copper Breastplate | Copper Greaves | Copper Sabatons | Copper Gauntlets | Ring of Vigor |
| Blade · greatsword kit | Copper Greatsword (two hands) | — | Copper Coif | Copper Hauberk | Copper Chausses | Copper Treads | Copper Mitts | Ring of Might |
| Ranger | Pine Shortbow (+100 arrows) | — | Rawhide Hood | Rawhide Jerkin | Rawhide Breeches | Rawhide Boots | Rawhide Gloves | Ring of the Hawk |
| Shade | Copper Dagger | Copper Throwing Knives | Rawhide Hood | Rawhide Jerkin | Rawhide Breeches | Rawhide Boots | Rawhide Gloves | Ring of Shadows |
| Arcanist | Pine Wand | Pine Orb | Burlap Cowl | Burlap Robe | Burlap Leggings | Burlap Slippers | Burlap Wraps | Ring of the Mind |
| Mender | Copper Censer | Copper Holy Symbol | Burlap Cowl | Burlap Robe | Burlap Leggings | Burlap Slippers | Burlap Wraps | Ring of the Well |
| Beast Tamer | Rawhide Whip | Pine Buckler | Copper Coif | Copper Hauberk | Copper Chausses | Copper Treads | Copper Mitts | Talisman of the Drum (F) |

*As built (Phase 7, D-099).* The two kit rows after the Blade are the **second starter kits**: New hero offers the Warden a spear kit and the Blade a greatsword kit beside their default kits (`starterKitName` and `starterKitOptions` in the class JSON; lint rule 7 checks them), because the town sells no weapons. A kit comes with its own three starting skills — the spear Warden Reaching Thrust · Provoke · Brace (Shield Slam needs a shield), the greatsword Blade Cleaving Blow · Wind-up · Headsman's Eye — and the consumables above. A wayfarer arrives with the default kit.

Plate and Mail at F are both Copper; the type word tells them apart ("Copper Helm" is Plate, "Copper Coif" is Mail). No kit has a Relic: the first Relic is the Cellars' Lantern of the Deep or Moth Charm, found, not given.

---

## Open questions (for James)

1. ~~**The promotion counts** are settled (`03` §6.5 rev. 2: forge F = 4, then 6 / 8 / 10 / 12 / 16 / 20 / 30 / 50; D-031). Remaining question: should S→SS at 30 Dragon Scale stay, given Dragon Scale drops 1–3 per Pale Dragon kill?~~ *Checkpoint 1 (D-031): keep 30 — the Pale Dragon is not the only source: Frostmarch's ice wyrms drop 1–3 every kill and their boss a stack of 10 (§8.3).*
2. ~~**God items and the Off Hand.** Eleven named God items cover every slot only because the God bow and staff are two-handed. Accept that, or make the launch list twelve with a God Tower shield for the Warden?~~ *Checkpoint 1 (D-099): eleven, as written — the God bow and staff fill both hands; a God Tower shield can come with a later dungeon.*
3. ~~**Hollow King at L14 with God drops.** A 1% God chance on the first dungeon's final boss is a long-term reason to return; is a God item that early in the dungeon list right, or should Gravehollow's three God items be shard-only until Emberforge is cleared?~~ *Checkpoint 1 (D-099): keep — his three God items at 1% (Hard 2%, Dread 4%) with pity at 100, plus the 10-Shard forge, are the long-term reason to return; God stays boss-bound (D-008).*
4. ~~**Chest band cap at A.** SS is never a chest centre here (band A Grand is SS 50%). Right, or should floors 35+ open a band SS table?~~ *Checkpoint 1 (D-030): right — chest bands cap at A with no band SS table; SS comes from band A's chests (Standard 19%, Grand 50%), bosses and promotion.*
5. ~~**Repair at 0.5% per point** lands a Warden's delve bill at ~27% of R, at the edge of the "≥ 70% left" rule. Hold, or cut to 0.4%?~~ *Checkpoint 1 (D-099): hold 0.5%, as built — it is the knob the balance runner turns to keep the delve bill at 20–30% of R.*
6. ~~**Armor-less God pieces.** God armor adopting the wearer's family lets a Mender wear the Ancient Dragon's Mantle; is that the feel wanted, or should God armor pieces be family-locked (then eleven becomes more than eleven)?~~ *Checkpoint 1 (D-099): family-less, as written — any class may wear any God armor piece, and eleven stays eleven.*
7. ~~**Beast Tamer weapons.** This file gives Beast Tamers one-handed swords and maces besides whips and spears so Daybreak Edge has a third class; `04-CLASSES.md` should confirm the list.~~ *Checkpoint 1 (D-099): the class sheet owns a class's weapons (`03` ownership table), so the Beast Tamer keeps its sheet's **whip and short spear**; this file's other Beast Tamer weapon rows and Daybreak Edge's third class are corrected when the class is built in Phase 11. A whip-and-spear Tamer reads as its own class rather than a second Warden.*
8. ~~**Trinket wear.** Rings, Talismans and Relics wear only on a wipe here (−10%). Keep, or exempt trinkets from the wipe penalty entirely?~~ *Checkpoint 1 (D-099): keep, as built — trinkets wear only from a wipe's −10%, the same wear the bearers' gear takes under Mortal (D-088).*
9. **Chest keys** (Phase 7): a Standard Key opens any Standard chest — gear, egg, crate, Tome or the Wayfarer Chest — and a Grand Key any Grand one. Right, or should keys open gear chests only? *Proposed: any chest of the tier (`07` §7 names no kind).*
10. **S-grade wayfarers** come only from the Grand Wayfarer Chest (5 R, from chest band E); the Standard keeps D-091's odds through Gravehollow. Right, or should the Standard chest gain an S line at deeper bands? *Proposed: as built.*
11. **A boss's own relic** (the Grinning Mask, the Barrow Bell, the Tidebound Idol, the Hollow Coin) comes only from its boss, while the Hourglass Shard, the Candle of the Crypt and the Brine Pearl roll anywhere at their grade, chests included. Keep, or tie each zone relic to its zone's floors? *Proposed: as built.*
12. **The P7 milestone** reads "a +N Skysteel-promoted sword", but Skysteel is Emberforge's (§8.3): in Gravehollow the A-grade sword comes from a boss reward and is raised +N with Honing Oil. Is that the intent, or should Gravehollow drop a little Skysteel? *Proposed: as built.*

---

*Feeds `content/items/<kind>/<id>.json` (kinds: weapons, armor, shields, trinkets, relics, consumables, affixes, sets, uniques, materials, stones), `content/chests/<id>.json`, `content/loot/<id>.json` (one per floor band), `content/starter-kits/<id>.json` and the durability constants in `content/tuning.json` (`10-TECH-PLAN.md` §3). Decisions this file rests on: D-008 (grade ladder and drop shape), D-010 (material ladders), D-030 (chest band cap and the fold), D-031 (promotion reading) in `13-DECISIONS.md`.*
