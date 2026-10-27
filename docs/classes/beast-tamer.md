# Beast Tamer — class sheet

*Last updated 2026-10-26 · rev. 1 · numbers are tuning starting points*

**Ships in Segment 3**, after pets exist (`12-ROADMAP.md`): the class is designed now so the pet system, the summon rules and the whip's reach are built with it in mind, but it is not in the Segment 1–2 roster of six.

Every number here is a **starting point for the simulator and the balance runner**, not a promise. The rules it rests on are `03-GAME-DESIGN.md` (§2 attributes, §3 the timeline, §5 level-by-use, §7 skills, §9 pets) and `04-CLASSES.md`, which holds the shared multiplier bands per tier. Column headers are identical across the seven sheets so the tables can become `content/skills/beast-tamer/<id>.json` (one record per skill).

**Shorthand.** `Grab 2` = Grab for 2 turns. Status magnitudes belong to `content/statuses/<id>.json`, written from `03` §3.5's table: Daze −500 energy · Grab: cannot act until freed · Root: cannot swap rows · Slow ×0.67 Speed · Haste ×1.5 Speed · Weaken −20% Attack · Fortify +20% Defense · Mark +20% damage taken · Taunt: must target the taunter · Shield absorbs a % of the holder's max HP · Regen +X% of max HP per turn where the skill sets X (Tier I ≈ 5%). Multipliers are of the Tamer's **physical Attack** (= weaponAttack + 2 × Strength) unless the skill says "pet Attack". "Either row" ignores the front/back rule (the whip's reach).

**Class rules (Beast Tamer only).**
- **Bond power** = 1 + 2% × (Willpower − 10). Every pet buff from a Bond skill and every summon's stats are multiplied by it. Willpower is the Tamer's main attribute as Wisdom is the Arcanist's.
- **Summons** (the Wild Call school). A summon is a monster of the **current zone's family** at the floor's level (never above the Tamer's), with **HP × 0.6 and Attack × 0.8**, both × Bond power. It is a **timeline actor** with the template's Speed, obeys the **pet's current stance**, counts as an ally for Momentum (+5 per action), carries its family's resistances and weaknesses, arrives at 500 energy, and leaves after **3 of its own turns** or at 0 HP (no corpse, loot or revive). Limit: **1 active summon** at Tier I–II, 2 with Pack Bond (Tier IV), 3 with Menagerie (Tier V). Gravehollow's roster: *Cellars* — Giant Rat (fodder), Cellar Spider (special: Web), Grinning Bruiser (elite); *Crypts* — Grave Bat, Ghoul (Poison claws), Bone Knight; *Drowned Vault* — Drowned Thrall, Deep Tentacle (Grab), Vault Sentinel. Monarch Call takes the zone's hunter (the Warden's Hound).
- **Holding a Grab.** While the Tamer holds a Grab (Coil, Hogtie, Puppeteer) its own actions are limited to **light weight (800)** — the whip hand is busy. Iron Grip (Tier III passive) removes the limit. The Grab ends early if the Tamer takes one hit of ≥ 10% max HP.
- **Weapons.** **Whip** (1h, Slash, reach: either row, normal 1,000, low Str requirement). **Short spear** (1h, Pierce, reach, normal 1,000). Off hand **lantern** (Detection +3; Light falls 1 less per new room) or **horn** (pet +10% Speed; Tamer +5 Momentum at fight start).
- **Stamina class.** Stamina = 30 + 3 × End, regen 10% per own turn; a basic attack restores 15%, a Guard 10%. **Mail**: −10 Speed, relieved by Strength above the piece's requirement; weak to Blunt.

---

## 1. Identity

The Beast Tamer is two bodies on the timeline: a hero with a whip that reaches the back row, and a pet that acts on its own turns and acts *again* when told. In the dungeon's own halls the Tamer calls a third — a rat, a bat, a drowned thrall — for three turns of borrowed teeth. The whip is control without magic: pull the archer forward, trip the knight, hold the hag still. Alone, with the pet on the floor, the Tamer is a Mail-wearing hero with middling damage and a long reach — and summons spend Stamina the way a Mender spends Mana.

| Pros | Cons |
|---|---|
| **Two bodies' worth of actions**: Sic 'Em makes the pet act at once for 800 weight; Two as One halves the pet's action weight for three turns. | **Weak alone if the pet is downed**: a 1.3×-per-turn whip with no self-heal; Lick Wounds (Tier III) is the only pet revive. |
| **Control without magic**: Drag pulls a back-row enemy forward; Trip is a Daze; Coil is a Grab; Disarm halves an armed humanoid's basic attack for the fight. Nothing here can be Silenced. | **Middling personal damage**: Crack is 1.3× of a weapon + 2 × Str-10 Attack — a Ranger's basic attack at best. |
| **Scales with any pet**: Kinship, Trained Instinct and Lifelong Bond make an F-grade Cellar Hound worth having and an A-grade import frightening. The class for Wildsong Ranch imports later. | **Summons cost a lot of Stamina**: Wild Call is 14 of a level-1 pool of 60; Elite Call is 38; a Swarm Call plus a Drag is most of the pool. |
| **Reach**: whip and short spear hit either row from the front, so the Tamer tanks a little and still reaches the caster. | **Mail is weak to Blunt**: bone knights with maces and vault sentinels hit the Tamer ≈ 25% harder than a Leather Ranger. |
| **Zone knowledge pays**: Familiar Ground and Bestiary turn every family summoned into a permanent party bonus against it. | **No bow**: the short spear reaches, but the class is front-row-bound against Web and Root. |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | **+2 Willpower, +1 Wisdom, +1 Agility** (added to the base 10s, before species and the 6 free points) |
| Pool | **Stamina** = 30 + 3 × End → 60 at End 10 (before free points) |
| Armor family | **Mail** (metal ladder: Copper → Starmetal); speed penalty **−10** (relieved 1 per Str point above the piece's requirement); weak to Blunt |
| Allowed weapons | **Whip** (1h, Slash, reach, normal 1,000) · **Short spear** (1h, Pierce, reach, normal 1,000) · off hand **lantern** or **horn** |
| Derived at all-10s + class mods, no gear | HP 103 · Speed 95 (Mail) · Stamina 60 · physical Attack weapon + 20 · Bond power 1.04 · Momentum gain ×1.02 · Resistance ~1% |
| F-grade starter kit (`08` §12) | Rawhide Whip (weaponAttack 9, Str req 7) · Pine Buckler (off hand, Block 15%) · Copper Coif · Copper Hauberk · Copper Chausses · Copper Treads · Copper Mitts (Defense 15) · Talisman of the Drum (+4% Momentum gain) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg. A lantern or horn for the off hand is a later purchase |
| Recommended Tier I starter picks | **Sic 'Em** (Bond) · **Wild Call** (Wild Call) · **Crack** (Lash). An extra pet action, a borrowed rat, and a whip strike that reaches the Grinning Company's crossbowman in the back row. |

Free-point advice on the creation card: +3 Willpower, +2 Endurance, +1 Agility (Will 15 / End 12 / Agi 12: Bond power 1.10, Stamina 66, Speed 100).

---

## 3. The Ultimate

**Howl of the Pack** — Tier III · 100 Momentum · weight 800 · never misses, cannot be interrupted.

The pet (returning at **50% HP** if it was downed this fight) and **every active summon** act **immediately**, in Speed order, each with **Haste 2**; each pack member's strike deals **1.5× its own Attack** and applies **Mark 1**. The Tamer gains **+10 Momentum per pack member that struck**. With a pet and two summons that is three free actions, three Marks and 30 Momentum toward the next Howl, for an 800-weight action.

---

## 4. The three schools

### 4.1 Bond — *the pet is the build*

Philosophy: a tempo line (make the pet act more), a protection line (keep the pet standing, share what you have) and a passive line (make every pet better). Every magnitude here is × Bond power.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Sic 'Em | Active | 10 Stamina | 800 | Pet | The pet acts at once (its accumulator is set to 1,000) with +15% Attack for that action | — | +25% Attack |
| I | Heel | Active | 8 Stamina | 800 | Pet | Shield 20% of the pet's max HP for 2 turns; the pet switches to Guard without using its free stance change | — | Shield 30% |
| I | Kinship | Passive | — | — | — | Pet stats +6%; the Tamer gains +5 Momentum whenever the pet acts | — | +10% |
| II | Double Time | Active | 14 Stamina | 1,000 | Pet | Haste 2 | Sic 'Em | Haste 3 |
| II | Share the Load | Active | 16 Stamina | 1,000 | Pet | For 3 turns damage to the pet is split 50/50 with the Tamer; the pet's own stamina pool refills 25% | Heel | The Tamer takes 30% |
| II | Second Skin | Passive | — | — | — | By the pet's stance: Guard — the Tamer takes −10% damage; Fierce — the Tamer's attacks +10%; Mend — the Tamer starts fights with Regen 1; Forage — the Tamer +2 Detection | Kinship | All four doubled |
| III | Pack Tactics | Active | 20 Stamina | 1,000 | Single enemy, either row | 1.2× Slash from the Tamer, then an immediate pet attack at 1.3× pet Attack; if both hit, Daze | Double Time | Pet attack 1.5× |
| III | Lick Wounds | Active | 18 Stamina | 800 | Pet | The pet heals 25% and cleanses 1 debuff; a **downed** pet instead returns at 25% HP (once per fight — the pet revive) | Share the Load | Returns at 40% |
| III | Trained Instinct | Passive | — | — | — | The pet may change stance twice per fight instead of once; stance effects +25% (Guard intercepts 40%; Mend heals +25%; Forage +25% Detection and gold) | Second Skin | Stance changes are free |
| IV | Alpha's Roar | Active | 30 Stamina | 1,000 | Pet + all summons | Haste 1; each pack member's next attack is a guaranteed crit | Pack Tactics | Haste 2 |
| IV | Soul Tether | Active | 32 Stamina | 1,000 | Pet | For 3 turns the pet cannot be downed while the Tamer is above 30% HP — damage that would down it is taken by the Tamer instead; a heal on either heals both at half | Lick Wounds | Threshold 15% |
| IV | Lifelong Bond | Passive | — | — | — | The pet's level cap is the Tamer's level +2; the pet's XP share rises from 50% to 75%; each bond star gives +7% instead of +5% | Trained Instinct | +10% per star |
| V | Two as One | Active | 45 Stamina | 1,400 | Pet | For 3 turns the pet's actions weigh 500 (it acts about twice as often) and it has Fortify 3 | Alpha's Roar | 4 turns |
| V | Undying Loyalty | Passive | — | — | — | If the Tamer is downed while the pet stands, the pet revives the Tamer at 30% HP with its next action (once per fight); if the pet is downed, the Tamer gains Fortify 2 and +30 Momentum | Soul Tether | Revive at 50% |
| V | Wild Heart | Active | 40 Stamina | 1,000 | Self + pet | Both gain Regen 3 and Fortify 3; for 3 turns the Tamer's Momentum gain is doubled | Lifelong Bond | Also Haste 1 |

### 4.2 Wild Call — *borrow the dungeon's teeth*

Philosophy: temporary summons from the family you are fighting, a Taunt line that puts them between the enemy and the party, and a passive line that makes every family you have ever called a permanent bonus.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Wild Call | Active | 14 Stamina | 1,000 | Summon | Call one **fodder** of the current family (Giant Rat · Grave Bat · Drowned Thrall) for 3 turns | — | 4 turns |
| I | Beast Tongue | Active | 10 Stamina | 800 | Single enemy, either row | Taunt 2: the target must attack the pet or a summon | — | Taunt 3 |
| I | Kennel Master | Passive | — | — | — | Summons arrive with Fortify 1 and last +1 turn; Wild Call costs −2 | — | Fortify 2 |
| II | Swarm Call | Active | 20 Stamina | 1,400 | Summon | Call two **swarmlings** of the family (HP × 0.3, Attack × 0.6 each) for 2 turns; they attack the enemy back row if one exists | Wild Call | Three swarmlings |
| II | Decoy | Active | 12 Stamina | 1,000 | One summon | Taunt on every enemy for 2 turns and Shield 30%; when the summon leaves or dies, every enemy it Taunted is Dazed | Beast Tongue | Shield 50% |
| II | Familiar Ground | Passive | — | — | — | Summons deal +15% to their own family; the Tamer's Detection +3 | Kennel Master | +25% |
| III | Greater Call | Active | 28 Stamina | 1,400 | Summon | Call one **special** of the family (Cellar Spider: Web · Ghoul: Poison claws · Deep Tentacle: Grab) for 3 turns | Swarm Call | 4 turns |
| III | Grave Bat's Shriek *(monster technique: Grave Bat, the Crypts)* | Active | 18 Stamina | 800 | All enemies | Blind 1 and −200 energy each; every Grave Bat summon in play shrieks with the Tamer for a further −100. Only Insights while a Grave Bat uses it. | Decoy | −300 energy |
| III | Bestiary | Passive | — | — | — | For every dungeon family the Tamer has ever summoned, the whole party deals +2% to that family; summons gain +4% stats per family in the Bestiary | Familiar Ground | +3% / +6% |
| IV | Elite Call | Active | 38 Stamina | 1,400 | Summon | Call one **armored elite** of the family (Grinning Bruiser · Bone Knight · Vault Sentinel) for 3 turns; only one elite at a time | Greater Call | HP × 0.8 instead of 0.6 |
| IV | Capfolk's Bloom *(monster technique: Capfolk Warder, the Fungal Deep's Mycelium Gardens)* | Active | 30 Stamina | 1,000 | All allies + pets + summons | Regen 3 and immunity to Poison for 3 turns; a summon that leaves while Bloomed heals every ally 10%. Only Insights while a Capfolk Warder blooms in the fight. | Greater Call | Heals 15% |
| IV | Pack Bond | Passive | — | — | — | Summons share the pet's bond-star bonus and take the pet's stance; the active-summon limit rises to 2 | Bestiary | Summons also get Kinship |
| V | Monarch Call | Active | 50 Stamina | 1,400 | Summon | Call the zone's **hunter** (Gravehollow: the Warden's Hound) at HP × 0.5 for 3 turns; it ignores Taunt and Fear | Elite Call | HP × 0.7 |
| V | Wild Surge | Active | 42 Stamina | 1,000 | Pet + all summons | Every pack member acts at once, in Speed order | Elite Call | And Haste 1 |
| V | Menagerie | Passive | — | — | — | The active-summon limit rises to 3; a summon that leaves refunds 20% of its Stamina cost | Pack Bond | Refund 35% |

### 4.3 Lash — *control without magic*

Philosophy: the whip's three verbs — pull, trip, hold — plus the passives that make the pet punish what the whip has caught. Nothing in Lash is a spell, so nothing in Lash is Silenced or resisted by Willpower-based Resistance except the status roll itself.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Crack | Active | 9 Stamina | 1,000 | Single enemy, either row | 1.3× Slash | — | 1.5× |
| I | Trip | Active | 11 Stamina | 1,000 | Single enemy, front row | 0.9× Slash and Daze (−500 energy) | — | Either row |
| I | Whip Hand | Passive | — | — | — | Lash skills +8%; Accuracy +5% with a whip | — | +12% |
| II | Drag | Active | 15 Stamina | 1,000 | Single enemy, back row | 1.0× Slash and the target is pulled to the front row (it swaps with a front-row enemy of the Tamer's choice); Root 1. Bosses cannot be dragged. | Crack | 1.3× |
| II | Coil | Active | 16 Stamina | 1,000 | Single enemy, either row | Grab 2 (the Tamer is holding — light actions only; see class rules) | Trip | Grab 3 |
| II | Flick | Passive | — | — | — | Lash skills against a Dazed, Grabbed or Rooted target crit automatically | Whip Hand | And +10% Crit Damage |
| III | Disarm | Active | 22 Stamina | 1,000 | Single enemy, either row | Weaken 3 and one buff stripped; an armed humanoid (the Grinning Company, Tidebound cultists) drops its weapon — its basic attack is halved for the rest of the fight | Drag | Weaken 4 |
| III | Hamstring | Active | 20 Stamina | 800 | Single enemy, either row | 1.5× Slash and Slow 2; a target that was already Slowed is also Dazed | Coil | 1.8× |
| III | Iron Grip | Passive | — | — | — | The Tamer's Grabs last +1 turn and no longer limit the Tamer to light actions; Grabbed enemies take +20% damage | Flick | +30% |
| IV | Scourge | Active | 34 Stamina | 1,400 | All enemies, both rows | 1.4× Slash each; Dazed targets take +30% | Disarm | 1.6× each |
| IV | Hogtie | Active | 32 Stamina | 1,000 | Single enemy, either row | Pulled to the front, Grab 3 and Weaken 3; counts as Dazed for Flick. Bosses: Grab 1, no pull. | Hamstring | Bosses Grab 2 |
| IV | Beastbane | Passive | — | — | — | The pet and all summons deal +25% to enemies carrying any Lash debuff (Daze, Grab, Root, Slow, Weaken) | Iron Grip | +35% |
| V | Thunderclap Lash | Active | 45 Stamina | 1,400 | All enemies, both rows | 1.2× Slash each; Daze on all; Weaken 2 | Scourge | 1.5× each |
| V | Puppeteer | Active | 48 Stamina | 1,400 | Single non-boss enemy | Grab 2; on the Tamer's next turn the Grabbed enemy makes its basic attack against an enemy of the Tamer's choice | Hogtie | It uses a skill instead |
| V | Master of the Lash | Passive | — | — | — | Lash skills weigh 800; whip basic attacks apply Weaken 1 | Beastbane | And Root 1 on a crit |

**Skill-line note.** Grave Bat's Shriek (Tier III, the Crypts) and Capfolk's Bloom (Tier IV, the Fungal Deep) are **leaves** — nothing requires them. Elite Call is the parent of both Tier V Wild Call actives so the summon line stays whole without the monster techniques. The Insight rule for monster techniques is proposed to use the monster's own level as the sweet spot (see `04-CLASSES.md`, Open questions).

---

## 5. Field-skill affinities

Starts at **+2 rank in Foraging** (the pet's nose: torches, herbs and cooking ingredients in rest rooms; stacks with the Forage stance) and **+2 rank in Field Repair** (a tamer mends tack, leather and the whip itself). All other field skills start at rank 1.

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Why |
|---|---|---|---|---|
| **Cellar Kennel** (levels 1–11) | Sic 'Em · Wild Call · Crack · Trip | Kinship · Whip Hand | Fierce | The simplest two-body build: the Hound and a borrowed rat on the bandit, the whip on the crossbowman in the back, Trip when the Bruiser winds up. Kinship feeds Momentum every time the pet bites. |
| **Ringmaster** (levels 12–19) | Pack Tactics · Greater Call · Drag · Coil | Trained Instinct · Iron Grip | Guard | The control build: Drag the wraith forward for the Blade, Coil the brine hag while the party burns her, a Ghoul summon for its Poison claws. Iron Grip lets the Tamer hold and still swing. |
| **Pack Lord** (levels 20+) | Alpha's Roar · Elite Call · Hogtie · Lick Wounds | Beastbane · Pack Bond | Fierce | A Bone Knight summon in front, pet and summon crit on command, Hogtie marks the elite for +25% from the pack, Lick Wounds keeps the pet in the fight. |

---

## 7. How it grows by use

| Attribute | What a Beast Tamer does that tags it |
|---|---|
| **Willpower** | resisting a status; standing against Fear; *proposed for this class*: a Bond skill resolved on the pet in a gated fight tags Willpower, otherwise the main attribute has no combat training path. See Open questions. |
| **Strength** | landing whip or spear hits on gated enemies; forcing doors; carrying over 50% capacity (treats and tack). |
| **Agility** | attacking; dodging. Mail's −10 makes the Tamer slower than the pet; Agility is how it catches up. |
| **Endurance** | taking armor-absorbed hits — Mail absorbs plenty — and marching under load. |
| **Vitality** | taking damage, per 10% of max HP; Share the Load adds the pet's hits. |
| **Perception** | crits; finds — the Forage stance and the lantern raise Detection, so Perception trains from what the pet finds. |

**A level-20 Beast Tamer** (160 skill ranks): Will 24–26, End 16–17, Str 14–15, Agi 14, Vit 14, Per 13. HP ≈ 30 + 98 + 60 = 188; Stamina ≈ 81; Speed ≈ 100 + 20 − 10 + 4 = 114 in C-grade Steel Mail; physical Attack with a C-grade Wolf Hide Whip (9 × 2.45 ≈ 22, Str req 9) ≈ 22 + 30 + 12 = 64; Bond power ≈ 1.30 — an E-grade pet with Kinship, Lifelong Bond and three bond stars is ≈ 1.6× its base. A B-grade pet from a Grand Egg is the real step.

---

## 8. Worked example — floor 5 (the Crypts), level 7

**Hesk**, Beast Tamer L7 (species modifiers 0 for the arithmetic). Attributes after six floors: Str 11 · Agi 13 · Vit 12 · End 14 · Wis 11 · Per 10 · Will 18 · Luck 10. Gear: Leather Whip (E, weaponAttack 9 × 1.35 ≈ 12, Str req 7), Bronze Mail (E, armorDefense 12, Str req 10), Pine Buckler.
Derived: HP 30 + 84 + 21 = **135** · Stamina 30 + 42 = **72** · physical Attack 12 + 2 × 11 + 2 × 4 (Str above the whip's requirement counts double) = **42** · Defense 12 + 14 = 26 · Speed 100 + 15 − 10 + 1 = **106** · Accuracy 90% (95% with Whip Hand) · Bond power **1.16** · Momentum gain ×1.08.
Pet: **Cellar Hound** (E, L7, Fierce): Attack 32, HP 95, Def 14, Speed 110 → with Kinship (+6% × 1.16 = +7%) Attack 34, HP 102.
Loadout: Sic 'Em, Wild Call, Crack, Drag; Kinship, Whip Hand.
Party: Hesk (front), Vell the Shade (front, Speed 135, Attack 45, Def 18, HP 125), the Hound. Two players, so the encounter is scaled: monster HP × 0.85.
Enemies (placeholder stats until `06-MONSTERS.md`; L7): **Bone Knight** front, HP 128, Def 24, Attack 40, mace (Blunt — Mail is weak to it, assumed × 1.25) · **Ghoul** front, HP 102, Def 12, Attack 36 · **Wraith** back, HP 68, Def 6, Attack 40, physical × 0.5.

Formula once: Attack × multiplier × (1 + bonuses) × elementMod × 100 / (100 + Def) × critMod × variance (0.90–1.05).

| Tick | Actor (Speed, start energy) | Action (weight) | Pool | Arithmetic and result |
|---|---|---|---|---|
| 6 | Wraith (125, 350) | Shadow bolt → Hesk (1,000) | — | 40 × 1.2 × 100/126 = 38 → Hesk 135 → 97. Momentum +10 × 1.08 → 11. |
| 6 | Vell (135, 200) | Shade skill → Ghoul (800) | — | 45 × 1.4 × 100/112 = 56 → Ghoul 102 → 46. Hesk +5 → 16. |
| 7 | Hound (110, 300) | Bite → Ghoul (Fierce: nearest, no owner target yet) (1,000) | — | 34 × 1.0 × 100/112 = 30 → Ghoul 16. Hesk +5 (ally) +5 (Kinship) → 26. |
| 7 | Ghoul (105, 300) | Claws → Vell (1,000) | — | 36 × 1.2 × 100/118 = 37 → Vell 88. |
| 8 | Hesk (106, 250) | **Wild Call** (1,000) | 72 → 58 | A **Grave Bat** summon joins at 500 energy: Speed 130, HP 60 × 0.6 × 1.16 = 42, Attack 24 × 0.8 × 1.16 = 22, 3 turns, Fierce. Momentum 26 + 22 = 48. |
| 9 | Bone Knight (90, 200) | Mace → Hesk (1,400) | — | 40 × 1.2 × 1.25 (Blunt vs Mail) × 100/126 = 48 → Hesk **49**. Momentum +11 → 59. *This is the Mail con in one line.* |
| 12 | Grave Bat summon (130, 500) | Bite → Ghoul (1,000) | — | 22 × 100/112 = 20 → Ghoul **dead**. Hesk +5 → 64. |
| 17 | Hesk (second turn) | **Drag** → Wraith (1,000) | 58 + 7 regen − 15 → 50 | 42 × 1.0 × 1.08 (Whip Hand) × 0.5 × 100/106 = 21.4 × 0.95 = **20** → Wraith 48, pulled to the **front row**, Root 1. Momentum 64 + 22 = 86. Vell's daggers can now reach it; the Hound's next bite (owner's target) is 34 × 0.5 × 0.943 = 16, and **Sic 'Em** next turn (10 Stamina) buys a second bite at +15% before the Knight swings again. |

What the runner should see: in two turns the Tamer did 20 damage itself, bought 50 from the pack, pulled the caster into dagger range, and spent 29 of 72 Stamina. The Bone Knight's one swing took 36% of the Tamer's HP — the Hound in Guard would have intercepted 30% of such hits.

---

## 9. Visual brief for the gear set (shared humanoid rig)

**Silhouette:** a lean, forward-leaning figure in short mail with a cloak thrown back, a coiled whip at the right hip, a lantern or horn in the left hand — and the pet at heel, which is half the silhouette.

**Modular meshes (five armor pieces + weapons):**

| Slot | Mesh | Notes |
|---|---|---|
| Helmet | Coif / hood with mail / crested helm | Hooded coif at F–D, open-faced helm with a small animal crest at C+ (the crest changes by equipped pet species — one swap mesh per species) |
| Chest | Short hauberk over a hide jerkin, cloak | The cloak is a single back mesh with a two-bone flap; the hauberk ends at the hip so the whip coil reads |
| Legs | Mail chausses over trousers | Mail only to the knee at low grades |
| Boots | Tall riding boots | The one piece that stays leather at every grade |
| Gloves | Whip gauntlet (right, heavy) + lantern glove (left, light) | Asymmetric on purpose: the right hand is the class |
| Main hand | Whip (coiled at the hip when idle, uncoiled in the attack pose) or short spear | The whip is a spline mesh with 8 bones; idle = coil, attack = three keyframes |
| Off hand | Lantern (hanging, emissive) or horn (slung) | The lantern is the party's visible Light bonus in the room |

**Palette:** moss green (cloak, trousers) · tan hide (jerkin, boots) · rust red (whip, trim, crest) · **bronze** as the metal. The pet's collar takes the rust red so pet and owner read as a pair.

**Must read at 200 px:** the whip coil at the hip, the lantern glow, the pet at heel. The crest is a bonus.

**F vs S:** F — copper rings on a rawhide jerkin, a plain rawhide whip, a tin lantern with a candle. S (Adamantine mail, Drake Scale whip) — dark blue-black mail with scale shoulders, a whip with a faintly glowing drake-scale lash, a lantern that burns pale green, and a crest that is a small sculpted head of the equipped pet's species.

**Species notes:** the cloak is scaled off the rig's spine length (Halfling cloaks end at the calf, Orc cloaks at the knee); the coif uses the species head shape key and is replaced by a strapped half-helm on Draconid; the whip gauntlet has a Draconid claw variant; the Dwarf hauberk is one row of rings longer to keep the hip line. The pet-at-heel pose is per pet species, not per hero species.

---

## 10. Open questions (for James)

1. **Willpower's training path.** §2.1 trains Willpower from resisting statuses, holding casts and facing Fear — a Tamer does none of those often. Proposed: Bond skills resolved on the pet in gated fights tag Willpower. Without it the class's main attribute barely moves.
2. **Summon stat scaling.** HP × 0.6 and Attack × 0.8 of the live monster, × Bond power. Should summons instead be built like pets (grade-based, the Tamer's level) so a floor-1 rat and a floor-10 sentinel feel like the same system?
3. **Holding a Grab limits the Tamer to light actions.** It is a real cost that makes Iron Grip a real reward — but it is also a rule the UI has to explain. Alternative: Coil ends when the Tamer uses any non-Lash skill.
4. **One pet per player, plus summons.** Four players × (hero + pet + up to 3 summons) is 20 actors on the party side at Tier V. The rulebook's open question (§9) already asks about 8; summons push it further. Cap summons party-wide at 3?
5. **Segment 3 only?** The class is the natural home for Wildsong Ranch imports, which are also Segment 3+. Is there a case for shipping a cut-down Beast Tamer (Bond + Lash, no summons) in Segment 2 so the pet system has a class that stresses it early?
