# Mender — class sheet

*Last updated 2026-10-26 · rev. 1 · numbers are tuning starting points*

Every number here is a **starting point for the simulator and the balance runner**, not a promise. The rules it rests on are `03-GAME-DESIGN.md` (§2 attributes, §3 the timeline, §5 level-by-use, §7 skills, §12 downed and revive) and `04-CLASSES.md`, which holds the shared multiplier bands per tier. Column headers are identical across the seven sheets so the tables can become `content/skills/mender/<id>.json` (one record per skill).

**Shorthand.** `Regen 3` = Regen for 3 turns. Status magnitudes belong to `content/statuses/<id>.json`, written from `03` §3.5's table: Regen +X% of max HP per turn where the skill sets X (Tier I ≈ 5%) · Shield absorbs a % of the holder's max HP · Fortify +20% Defense · Weaken −20% Attack · Mark +20% damage taken · Fear: 50% chance to Guard instead of acting · Daze −500 energy · Slow ×0.67 Speed · Haste ×1.5 Speed · Smite (Holy's mark): damage taken +20%, +40% if Undead or Shadow, for 2 turns. Multipliers are of **spell Attack** (= focusPower + 2 × Wisdom) unless the skill says "Blunt" (physical Attack = weaponAttack + 2 × Strength). "Either row" ignores the front/back rule.

**Class rules (Mender only).**
- **Heals are a percentage of the *target's* max HP × healing power** = 1 + 2% × (Wisdom − 10). Rank adds +4% per rank on top.
- **Revive.** A downed ally can be revived within 3 of its own turns (§12.1). **Breath of Life** (Tier II, level 5) is the **earliest in-combat revive** — First Aid reaches combat at rank 5 as a weight-1,000 action and a Phoenix Feather works at any time (`03` §12.1, §7.6) — and it does not spend the floor's post-fight revive budget. Rebirth (Tier IV) can also reach a *fallen* hero once per fight.
- **Weapons** (numbers per `08` §1). Main hand **censer** (1h, Blunt, normal 1,000 — a weapon that **also counts as a focus**: its Base Attack is weaponAttack for the Blunt basic attack and focusPower for spells; +10% healing) or a plain **mace** (1h, Blunt, no focus). Off hand **holy symbol** (focus, no attack: +5 spell Attack, +3% Resistance). Or a **staff** (2h, normal 1,000, +10 Mana, Blunt basic attack) or the **Reliquary** (2h Holy focus). Blunt is the class's only physical type, strong against Mail. Spells and heals never wear the weapon.
- **Mana class.** Mana = 30 + 3 × Wis, regen 8% per own turn; a basic attack or a Guard restores 10%.
- **Heavy casts (1,400) are charged** as on the Arcanist sheet: declared at 1,000 energy, resolved 400 later, cancelled by a hit in the window unless the concentration check (30% + 3% × (Will − 10)) passes.

---

## 1. Identity

The Mender keeps the party upright: heals that scale with the target's size, a Regen that outlasts a fight, a Shield for the one about to be hit, and the earliest, cheapest revive that works *during* the fight. In Gravehollow's Crypts the Mender is also a striker, because Holy is the element the Restless Dead are weak to and Smite stacks on top of that. Out of the Crypts the damage falls off a cliff: a mace with a Str-10 arm, Blunt only, and every real spell costs Mana the heals also want.

| Pros | Cons |
|---|---|
| **Sustain**: Mend heals 18% of the target's max HP for 10 Mana at light weight (800); Circle of Mending heals four heroes and four pets in one cast. | **Low damage outside Holy targets**: Smite against a living bandit is 1.4× of a spell Attack built for healing; the mace basic attack is weapon + 20. |
| **The earliest in-combat revive** (Breath of Life, Tier II, level 5, before First Aid rank 5): a downed ally stands at 30% HP without spending the floor's revive budget. | **Mana-hungry**: a full-party emergency (Circle + Breath of Life + Purify) is 54 Mana, most of a level-7 pool, in three turns. |
| **Cleanses everything**: Cleanse → Purify → Absolution strip any debuff on the list, including Petrify and Curse; Indomitable makes the party immune for two turns. | **A party of three Menders kills nothing**: nobody tanks, the Holy damage is 1.0–1.5× per cast, and vermin, bandits and the Tidebound have no Holy weakness. |
| **Strong vs the Crypts**: Holy ×1.5 on Undead plus the Smite mark plus Consecration ≈ 2× a neutral cast; Exorcism destroys Undead under 20% outright. | **Blunt only**: no Pierce for Plate joints, no Slash for Hide; the Mender's physical option is useful against Mail (bandits, bone knights) and nowhere else. |
| **Momentum gifts**: Rally and Hymn of Momentum feed allies' Ultimates — the Mender decides whose big turn comes first. | **Robes**: lowest Defense, so the healer is the target the moment the front row falls; no self-Shield at Tier I. |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | **+2 Wisdom, +1 Willpower, +1 Vitality** (added to the base 10s, before species and the 6 free points) |
| Pool | **Mana** = 30 + 3 × Wis → 66 at Wis 12 (before free points) |
| Armor family | **Robes** (cloth ladder: Burlap → Celestial Thread); speed penalty **0**; lowest armorDefense |
| Allowed weapons | **Censer** (1h, Blunt, normal 1,000; also a spell focus) or **Mace** (1h, Blunt) + **holy symbol** (off-hand focus) · or **staff** (2h, focus, normal 1,000 basic, +10 Mana) / **Reliquary** (2h Holy focus) |
| Derived at all-10s + class mods, no gear | HP 110 · Speed 100 · Mana 66 · spell Attack focus + 24 · physical Attack weapon + 20 · healing power 1.04 · Resistance ~1% |
| F-grade starter kit (`08` §12) | Copper Censer (Base 10: weaponAttack and focusPower, +10% healing) · Copper Holy Symbol (off-hand focus: +5 spell Attack, +3% Resistance) · Burlap Cowl · Burlap Robe · Burlap Leggings · Burlap Slippers · Burlap Wraps (Defense 4) · Ring of the Well (+5 Mana) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg |
| Recommended Tier I starter picks | **Mend** (Benediction) · **Smite** (Sanctity) · **Cleanse** (Vigil). A heal, a Holy bolt that reaches the back row, and the answer to the Cellar Spider's Poison on floor 2. |

Free-point advice on the creation card: +3 Wisdom, +2 Willpower, +1 Vitality (Wis 15 / Will 13 / Vit 12: healing power 1.10, HP 117, concentration 39%).

---

## 3. The Ultimate

**Dawnbreak** — Tier III · 100 Momentum · weight 1,000 · never misses, cannot be interrupted.

Every ally and pet **heals 40% of max HP**, loses **every debuff**, and gains **Regen 3**. Every **downed** ally stands at **30% HP** (no floor revive budget spent). Every enemy takes **1.0× spell Attack as Holy** with the Smite mark; Undead and Shadow enemies also get **Fear 1**. Dawnbreak is the Mender's answer to the moment a Crypts ambush has put two heroes on the floor — one action, the party is back.

---

## 4. The three schools

### 4.1 Benediction — *keep them standing*

Philosophy: heals, Regen, Shield and the revive. The school's lines are a heal line (single → party → emergency), a revive line (Regen → revive → mass revive → Miracle) and a passive line that turns spare healing into something.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Mend | Active | 10 Mana | 800 | Single ally | Heal 18% of the target's max HP | — | Heal 22% |
| I | Soothing Word | Active | 12 Mana | 1,000 | Single ally | Regen 3 | — | Regen 4 |
| I | Gentle Hands | Passive | — | — | — | Heals +8%; a heal on an ally below 30% HP costs half | — | Heals +12% |
| II | Circle of Mending | Active | 20 Mana | 1,400 | All allies + pets | Heal 14% each | Mend | Heal 17% each |
| II | Breath of Life | Active | 20 Mana | 1,400 | Downed ally | **Revive at 30% HP** (within the 3-turn window; no revive budget spent) | Soothing Word | Revive at 40% |
| II | Overflow | Passive | — | — | — | Healing beyond max HP becomes a Shield on the target, up to 15% of max HP, lasting 2 turns | Gentle Hands | Up to 25% |
| III | Blessed Rain | Active | 28 Mana | 1,400 | All allies + pets | Heal 30% each and cleanse 1 debuff each | Circle of Mending | Cleanse 2 each |
| III | Sanctuary | Active | 24 Mana | 1,000 | All allies | Shield 15% each for 2 turns; while a Sanctuary Shield holds, the holder cannot be Grabbed, Rooted or Webbed | Breath of Life | Shield 20% |
| III | Martyr's Grace | Passive | — | — | — | Once per fight, the first ally who would be downed survives at 1 HP instead | Overflow | Survives at 10% HP |
| IV | Verdant Pulse | Active | 30 Mana | 800 | Single ally | Heal 45% of max HP and Regen 3 — the emergency button, at light weight | Blessed Rain | Heal 55% |
| IV | Rebirth | Active | 40 Mana | 1,400 | All downed allies | Revive each at 50% HP; may also revive one **fallen** hero (past the 3-turn window), once per fight | Sanctuary | Fallen: twice per fight |
| IV | Troll's Regrowth *(monster technique: Warren Troll, the Fungal Deep's Troll Warrens)* | Passive | — | — | — | Regen on allies ticks **twice** per turn; any Fire damage on the holder removes it (as it does the troll's). Only Insights while a Warren Troll regenerates in the fight. | Martyr's Grace | Fire no longer removes it |
| V | Miracle | Active | 50 Mana | 1,400 | All allies + pets | Full heal, every debuff removed, every downed *and* fallen ally revived at 60% HP. Once per fight. | Rebirth | Allies also gain Fortify 2 |
| V | Guardian Spirit | Active | 42 Mana | 1,000 | Single ally | For 3 turns, half of all damage the ally takes is paid from the Mender's Mana at 2 Mana per HP instead of from the ally's HP; when the Mana runs out the effect ends | Verdant Pulse | 1 Mana per HP |
| V | Everflow | Passive | — | — | — | The Mender's heals also restore 5% of the target's pool; Regen on an ally below 50% HP does not count down | Verdant Pulse | Restore 8% pool |

### 4.2 Sanctity — *Holy damage, Smite, wards and Fear*

Philosophy: the Mender's offense. Holy hits either row and hits Undead and Shadow twice as hard; the school also carries the wards that make the front row safe and the Fear that takes enemy turns away.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Smite | Active | 10 Mana | 1,000 | Single enemy, either row | 1.4× Holy; applies the Smite mark | — | 1.6× |
| I | Radiance | Active | 12 Mana | 1,000 | Front row enemies | 0.7× Holy each; Smite mark | — | 0.8× each |
| I | Consecration | Passive | — | — | — | Holy skills +8%; the Mender's mace basic attack deals an extra 0.3× spell Attack as Holy | — | Extra 0.5× |
| II | Holy Lance | Active | 16 Mana | 1,400 | Single enemy, either row | 1.9× Holy; a target carrying the Smite mark is also Stunned 1 | Smite | 2.1× |
| II | Censure | Active | 14 Mana | 1,000 | Single enemy, either row | Fear 2; Undead and Shadow targets also Weaken 2 | Radiance | Fear 3 |
| II | Ward of Faith | Active | 15 Mana | 1,000 | All allies | Fortify 2 and immunity to Fear for 2 turns | Consecration | Fortify 3 |
| III | Judgement | Active | 26 Mana | 1,400 | Single enemy, either row | 2.3× Holy, +1% damage per 1% of the target's missing HP (max +50%) | Holy Lance | Max +75% |
| III | Wraith's Lament *(monster technique: Wraith, the Crypts)* | Active | 22 Mana | 1,000 | All enemies | 1.0× Shadow each; living targets Fear 1; Undead and Shadow targets are immune to the Fear but take Mark 2 instead. Only Insights while a Wraith uses it. | Censure | 1.2× each |
| III | Hallowed Ground | Active | 24 Mana | 1,000 | Party (both rows) | For 3 turns: any enemy that attacks the front row takes 0.5× Holy; Undead cannot be raised or revived while it holds; allies +10% Resistance | Ward of Faith | 4 turns |
| IV | Exorcism | Active | 36 Mana | 1,400 | All enemies | 1.5× Holy each; non-boss Undead and Shadow targets left under 20% HP are destroyed outright (loot and XP as a kill) | Judgement | Under 25% |
| IV | Dread Hymn | Active | 30 Mana | 1,000 | All enemies | Fear 2 and Slow 1 | Hallowed Ground | Also Silence 1 on casters |
| IV | Sanctified Weapon | Passive | — | — | — | Every ally's basic attack deals an extra 0.2× the Mender's spell Attack as Holy; the Mender's Holy skills ignore 20 Defense | Judgement | Extra 0.3× |
| V | Wrath of Dawn | Active | 50 Mana | 1,400 | All enemies | 2.2× Holy each; Smite mark; Blind 2; Undead and Shadow also Stun 1 | Exorcism | 2.5× each |
| V | Banishment | Active | 42 Mana | 1,000 | Single enemy, either row | 3.6× Holy; a non-boss Undead or Shadow target under 35% HP is banished (removed, counted as a kill); a living target gets Fear 2 | Dread Hymn | Under 50% |
| V | Saint's Mantle | Passive | — | — | — | When the Mender is hit, the attacker takes 0.4× Holy and Fear 1 (once per enemy per turn); the Mender's Resistance +10% | Sanctified Weapon | 0.6× Holy |

### 4.3 Vigil — *cleanse, steady, gift*

Philosophy: the school that makes the other six classes better. Debuffs come off, Fortify goes on, Momentum changes hands, and the lantern keeps the Crypts out of the Dark band.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Cleanse | Active | 8 Mana | 800 | Single ally | Remove 1 debuff (the player picks); heal 5% | — | Remove 2 |
| I | Blessing | Active | 12 Mana | 1,000 | Single ally | Fortify 3 and +10 Momentum | — | +15 Momentum |
| I | Vigil Lantern | Passive | — | — | — | The party's Light falls 1 less per new room; allies +5% Resistance | — | +8% Resistance |
| II | Purify | Active | 14 Mana | 1,000 | All allies | Remove 1 debuff each; Poison, Bleed and Curse go first | Cleanse | Remove 2 each |
| II | Rally | Active | 16 Mana | 1,000 | All allies | +10 Momentum each and Fear removed | Blessing | +15 each |
| II | Steadfast | Passive | — | — | — | Allies with Fortify also have +10% Resistance; Fortify from Mender skills lasts +1 turn | Vigil Lantern | +15% Resistance |
| III | Absolution | Active | 22 Mana | 1,000 | Single ally | Remove **every** debuff, Petrify, Curse and Silence included; immune to debuffs for 1 turn | Purify | Immune 2 turns |
| III | Hymn of Momentum | Active | 26 Mana | 1,400 | All allies | +20 Momentum each; the Mender loses 20 | Rally | The Mender loses nothing |
| III | Beacon | Active | 18 Mana | 800 | Party / all enemies | Out of combat: +20 Light, once per room. In combat: Mark 2 on every enemy | Steadfast | Mark 3 |
| IV | Indomitable | Active | 34 Mana | 1,000 | All allies | Immune to every debuff for 2 turns; Fortify 2 | Absolution | 3 turns |
| IV | Grace | Active | 30 Mana | 800 | Single ally | The ally's next action costs no pool and weighs 800 whatever its own weight | Hymn of Momentum | Next two actions |
| IV | Dawn Vigil | Passive | — | — | — | Every ally starts each fight with +10 Momentum; for ambush rolls the party counts its light band one step brighter | Beacon | +15 Momentum |
| V | Deliverance | Active | 45 Mana | 1,400 | All allies | Every debuff removed, Fortify 3, Haste 1, +20 Momentum | Indomitable | Haste 2 |
| V | Martyrdom | Active | 40 Mana | 800 | Self → allies | The Mender's Momentum drops to 0 and the amount lost is split evenly among the allies; the Mender gains Shield 30% for 2 turns | Grace | Split 1.5× the amount |
| V | Unwavering | Passive | — | — | — | While the Mender is above 50% HP no ally can be Feared, Stunned or Petrified; the Mender cannot be Silenced | Dawn Vigil | Threshold 25% HP |

**Skill-line note.** The two monster techniques — Wraith's Lament (Tier III, Gravehollow's Crypts) and Troll's Regrowth (Tier IV, the Fungal Deep) — are **leaves**: nothing requires them. A Mender who never Insights a wraith still reaches Tier V on every line. The Insight rule for monster techniques is proposed to use the monster's own level as the sweet spot (see the Arcanist sheet and `04-CLASSES.md`, Open questions).

---

## 5. Field-skill affinities

Starts at **+2 rank in First Aid** (the rulebook's Mender bonus — out-of-combat revives and bandages) and **+2 rank in Cooking** (the camp priest's stew: rest-room meals give +5% to a stat for the next floor). All other field skills start at rank 1.

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Why |
|---|---|---|---|---|
| **Cellar Chaplain** (levels 1–11) | Mend · Smite · Cleanse · Breath of Life | Gentle Hands · Consecration | Guard | Heal, cleanse the spider Poison, Smite the back-row bandit archer, and keep the revive loaded from level 5. Guard stance keeps rats off the Mender. |
| **Crypt Lantern** (levels 12–19) | Circle of Mending · Judgement · Purify · Hallowed Ground | Overflow · Steadfast | Fierce | Built for the Restless Dead: Judgement executes bone knights, Hallowed Ground punishes every ghoul that swings at the front row and stops the necromancer's raises. Overflow turns spare healing into Shields. |
| **Battle Priest** (levels 20+) | Verdant Pulse · Exorcism · Rally · Rebirth | Sanctified Weapon · Dawn Vigil | Fierce | The endgame support: one light-weight emergency heal, one AoE that deletes wounded undead, Rally to push the Blade's Ultimate, Rebirth for the wipe that almost happened. Sanctified Weapon gives the whole party Holy on every basic attack. |

---

## 7. How it grows by use

| Attribute | What a Mender does that tags it |
|---|---|
| **Wisdom** | every heal, Shield, cleanse or Holy cast that resolves in a gated fight; identifying items. The main trainer; also +1% XP per point. |
| **Willpower** | holding a heavy cast under a hit; resisting a status; standing against Fear (Ward of Faith denies the tag — immunity is not resistance). |
| **Vitality** | taking damage, per 10% of max HP. |
| **Strength** | landing mace hits on gated enemies — a Mender who swings between heals trains Strength slowly but steadily. |
| **Perception** | crits (rare at Per 10); traps and secrets the Mender's Detection reveals. |
| **Endurance** | armor-absorbed hits — negligible in Robes. |

**A level-20 Mender** (160 skill ranks): Wis 28–30, Will 18–19, Vit 16–17, Str 12–13, the rest near creation. HP ≈ 30 + 7 × 17 + 60 = 209 (the sturdiest Robes class); Mana ≈ 30 + 90 = 120; healing power ≈ 1.38 — a Tier IV Verdant Pulse heals 45% × 1.38 ≈ 62% of a Warden; spell Attack with a C-grade Steel Censer (10 × 2.45 ≈ 25) and Steel Holy Symbol (+5 × 2.45 ≈ 12) ≈ 37 + 58 = 95; concentration ≈ 55%.

---

## 8. Worked example — floor 5 (the Crypts), level 7

**Tobin**, Mender L7 (species modifiers 0 for the arithmetic). Attributes after six floors: Str 10 · Agi 10 · Vit 14 · End 10 · Wis 18 · Per 10 · Will 14 · Luck 10. Gear: Bronze Censer (E, Base 10 × 1.35 ≈ 14 — weaponAttack and focusPower), Bronze Holy Symbol (E, +5 × 1.35 ≈ 7 spell Attack), Linen robes (E, armorDefense 6).
Derived: HP 30 + 98 + 21 = **149** · Mana **84** · spell Attack 14 + 7 + 36 = **57** · physical Attack 14 + 20 = 34 · healing power **1.16** · Defense 16 · Speed 100 · Resistance 3% · Momentum gain ×1.04 · concentration 42%.
Loadout: Mend, Smite, Purify, Breath of Life; Gentle Hands, Consecration. Pet: Moss Tortoise (E, Guard, Speed 70).
Party: Bram the Warden (front, HP 180, Def 40), Kessa the Blade (front, HP 135, Def 22, Speed 115), Tobin (back).
Enemies (placeholder stats until `06-MONSTERS.md`; L7): **Bone Knight** front, HP 150, Def 24, Blunt ×1.5, Holy ×1.5 · **Ghoul** front, HP 120, Def 12, Holy ×1.5 · **Wraith** back, HP 80, Def 6, Attack 40, Holy ×1.5.

Formulas once — damage: Attack × multiplier × (1 + bonuses) × elementMod × 100 / (100 + Def) × critMod × variance (0.90–1.05). Heal: target max HP × skill% × healingPower × (1 + bonuses).

| Tick | Actor (Speed, start energy) | Action (weight) | Pool | Arithmetic and result |
|---|---|---|---|---|
| 6 | Wraith (125, 350) | **Wraith's Lament** on the party (1,000) | — | 40 × 0.8 Shadow each: Bram 100/140 → 23; Kessa 100/122 → 26; Tobin 100/116 → 28 (149 → 121). Fear 1 on all three (Tobin's 3% Resistance fails). Tobin's Momentum +10 × 1.04 → 10. *No Insight roll for Wraith's Lament: Tobin has no Censure yet.* |
| 7 | Kessa (115, 300) | Blade skill → Ghoul (1,000) | — | Fear: 50% skip — she skips. Tobin +5 → 15. |
| 7 | Tobin (100, 300) | **Purify** (1,000) | 84 → 70 | Fear removed from Bram, Kessa and Tobin. Momentum 15 + 21 = 36. |
| 7 | Ghoul (105, 300) | Claws → Kessa (1,000) | — | 36 × 1.2 × 100/122 = 35 → Kessa 109 → 74. |
| 8 | Bram (80, 400) | Taunt (Warden Tier I) (1,000) | — | Every enemy targets Bram for 2 turns. Tobin → 41. |
| 9 | Bone Knight (90, 200) | Greatsword → Bram (1,400) | — | Blocked, halved to 19 → Bram 138. |
| 17 | Tobin (second turn) | **Smite** → Wraith (1,000) | 70 + 7 regen − 10 → 67 | 57 × 1.4 × 1.08 (Consecration) × 1.5 (Holy weak) × 100/106 = 122 × 0.98 = **119** → Wraith 80 → **dead** in one cast. Momentum 41 + 21 + 5 + 5 = 72. |
| 27 | Tobin (third turn) | **Mend** → Kessa (800) | 67 + 7 − 10 → 64 | 135 × 0.18 × 1.16 × 1.08 = 30.4 → **30**; Kessa 74 → 104 (Gentle Hands' half cost did not apply: she was at 55%). Momentum 72 + 21 + 10 = 103 → **Dawnbreak** is lit for the next turn. |

What the runner should see: the Mender spent 34 of 84 Mana over three turns to remove a Fear, kill the back-row caster and top up the Blade. Against the Cellars' bandits the same Smite does 57 × 1.4 × 1.08 × 1.0 × 100/112 = 77 — about a Blade's basic attack.

---

## 9. Visual brief for the gear set (shared humanoid rig)

**Silhouette:** a broad, grounded column — a long robe under a knee-length tabard, a mace held low at the hip, and a censer on a chain or a raised holy symbol that puts a point of light at shoulder height.

**Modular meshes (five armor pieces + weapons):**

| Slot | Mesh | Notes |
|---|---|---|
| Helmet | Cowl / coif / mitre | Cowl at F–D, padded coif with a brass band at C–A, a low mitre at S+ |
| Chest | Robe + tabard (one mesh, two materials) | The tabard carries the sunburst emblem; split front/back below the belt |
| Legs | Leggings | Hidden below the robe except the shins |
| Boots | Sandals / wrapped boots | Sandals at F–E (bare toes on the Halfling and Orc feet shape keys) |
| Gloves | Wraps / bracers | A healing-glow emissive on the palm from D up |
| Main hand | Censer (1h, chain + bowl, swung as a flail) or mace (1h) or staff (2h) | The censer swings with a simple pendulum bone; its smoke is a 4-frame sprite, not a particle system; the mace head is the grade: a copper lump → a flanged silver head → a sun-disc |
| Off hand | Holy symbol (handheld disc on a short haft) | Raised during casts; its disc is the grade signifier at a glance |

**Palette:** ivory (robe) · oxblood (tabard, trim) · pale gold (emblem, light) · **silver** as the metal. Benediction skills tint the hand glow green-gold, Sanctity white-gold, Vigil amber.

**Must read at 200 px:** the tabard's sunburst, the raised symbol or swinging censer, the mace. The Mender and the Arcanist share Robes, so the tabard and the low mace are the two things that keep them apart in the party line-up.

**F vs S:** F — undyed burlap, a rope belt, a wooden disc symbol, a copper mace. S (Phoenix Weave) — the robe's panels are feathered and faintly luminous, the tabard's emblem is a raised silver sun that spins slowly, the censer is a silver cage trailing light instead of smoke, the mace head is a radiant disc.

**Species notes:** the tabard length is driven by the rig's torso bone scale (Dwarf: shorter, wider; Halfling: ends mid-thigh); the cowl uses the species head shape key and becomes a circlet-and-veil on Draconid; the Orc shoulder shape key widens the robe yoke so the tabard does not bunch; Elf ears use the same hood cut-out as the Arcanist.

---

## 10. Open questions (for James)

1. **Heal scaling.** Heals here are a % of the *target's* max HP × healing power (1 + 2%/Wis point). The alternative is a flat heal = spell Attack × multiplier, like damage. The percentage keeps a Tier I heal relevant on a level-30 Warden; the flat version makes gear matter more. Which?
2. **Breath of Life's weight.** The in-combat revive is heavy (1,400) and charged, so a Bone Knight can interrupt it. That makes the Warden's Taunt matter, but a failed revive at a 3-turn deadline is the worst feeling in the game. Make it normal weight (1,000) and uninterruptible, at a higher cost?
3. **Holy vs living targets.** Smite is 1.4× against a bandit and ≈ 2× against a skeleton. Is "the Mender is a striker only in the Crypts and the Frostmarch wights" the right shape, or should Sanctity get one living-target tool (Judgement's execute is the current one)?
4. **Momentum gifts.** Rally (+10 each) and Hymn (+20 each) let a Mender feed a Blade's Ultimate every other fight. If the sim shows the Blade's Ultimate every fight, cap gifted Momentum at 50 per fight.
5. **Three Menders.** The con "a party of three Menders kills nothing" is true by design. Should the matchmaking lobby warn when a party has no striker, or let people find out?
