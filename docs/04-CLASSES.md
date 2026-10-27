# 04 — Classes

*Last updated 2026-10-26 · rev. 1 · numbers are tuning starting points*

Seven classes, one sheet each in `docs/classes/`. This file is the index: the rule every sheet follows, the seven at a glance, what each one covers, what parties they make, and what all of them share. The rulebook is `03-GAME-DESIGN.md`; the skill rules are its §7.

## 1. The design rule

**Every class has pros *and* cons, and both are mechanical.** A Warden is slow (Plate −20 Speed) and does little damage; an Arcanist has the biggest AoE in the game and the lowest Defense; a Mender is the earliest in-combat revive and kills nothing outside the Crypts. Each con is a number on the sheet the simulator can measure, and each is something another class fixes. That is what makes a party.

**Roles are soft.** Nobody owns a role outright: a Warden's Warcry school buffs, a Shade's Larceny is utility, a Beast Tamer's Lash is control without a spell, a Mender in the Crypts is a striker. Any three classes can finish Gravehollow Keep; the recipes below make it *easy*.

**Forty-five skills each**: three schools × five tiers × three skills. Tier is fixed and opens at level 1 / 5 / 12 / 20 / 30; rank 1–10 grows by use (+4% effect, −2% cost per rank; rank 10 unlocks the Mastery line). Each Tier II–V skill has one prerequisite at the tier below in its school, so a school reads as three columns. Monster techniques (exactly two per class, Tier III–IV, learned only while the monster uses the move; `06-MONSTERS.md` says which monster teaches each) are leaves — nothing requires them. Loadout: 4 actives + 2 passives + 1 pet stance. The Ultimate sits at Tier III, costs 100 Momentum and never misses.

**Shared bands per tier** (the sheets stay inside these; the runner tunes the edges):

| Tier | Opens at | Cost (pool points) | Single-target × Attack | AoE × per target | Heal (% of target max HP) |
|---|---|---|---|---|---|
| I | L1 | 8–14 | 1.2–1.5 | 0.7–0.9 | 15–20 |
| II | L5 | 12–20 | 1.6–1.9 | 0.9–1.1 | 22–28 |
| III | L12 | 18–30 | 2.0–2.4 | 1.1–1.4 | 30–38 |
| IV | L20 | 25–40 | 2.5–3.0 | 1.4–1.7 | 40–50 |
| V | L30 | 35–50 | 3.2–4.0 | 1.8–2.2 | 55–70 |

Action weights: light 800 · normal 1,000 · heavy 1,400 (§3.1). Pools start near 60 (Stamina 30 + 3 × End; Mana 30 + 3 × Wis).

## 2. The seven at a glance

Attribute modifiers are added to the base 10s before species and the 6 free creation points (§2.3).

| Class | Role | Attribute mods | Armor | Pool | Weapons | Schools | One-line pro | One-line con |
|---|---|---|---|---|---|---|---|---|
| **Warden** | tank | +1 Str, +2 End, +1 Vit | Plate (−20 Speed) | Stamina | 1h sword / mace / axe + shield, or spear | Bulwark · Vanguard · Warcry | Holds the front row and the enemies' attention | Slowest class in the game; low damage |
| **Blade** | melee striker | +2 Str, +2 Agi | Mail (−10) | Stamina | swords, greatswords, axes, great axes, daggers (off hand), dual swords | Iron Dance · Executioner · Bloodletter | Highest sustained melee damage; crits and Bleed | Front row with Mail; nothing for the back row |
| **Ranger** | ranged striker / scout | +2 Per, +1 Agi, +1 Vit | Leather (−3) | Stamina | bows, crossbows, spear | Marksman · Trapper · Pathfinder | Hits either row; fewest ambushes, most traps found | Weak once anything reaches the back row |
| **Shade** | assassin / rogue | +2 Agi, +1 Per, +1 Luck | Leather (−3) | Stamina | dual daggers, short sword, throwing knives | Shadow · Venom · Larceny | Fastest actor on the strip; Poison; Lockpicking | Fragile and front-row-bound with daggers |
| **Arcanist** | caster | +2 Wis, +1 Per, +1 Will | Robes (0) | Mana | staff, or wand + focus | Evocation · Rime · Arcana | Biggest AoE and burst; controls the timeline | Lowest Defense; heavy casts can be interrupted; Mana runs dry |
| **Mender** | healer / priest | +2 Wis, +1 Will, +1 Vit | Robes (0) | Mana | censer (a Blunt weapon that is also a focus) or mace, + holy symbol; or staff | Benediction · Sanctity · Vigil | Sustain, cleanses, the earliest in-combat revive; Holy vs Undead | Low damage outside Holy targets; Mana-hungry; Blunt only |
| **Beast Tamer** *(Segment 3)* | pet master / summoner | +2 Will, +1 Wis, +1 Agi | Mail (−10) | Stamina | whip, short spear, + lantern / horn | Bond · Wild Call · Lash | Two bodies' worth of actions; control without magic | Weak with the pet down; middling own damage; summons are dear |

## 3. Role coverage

● covers the role · ◐ covers it partly or in one school · ○ does not.

| Class | Tank | Melee dps | Ranged dps | Control | Heal | Utility | Pet synergy |
|---|---|---|---|---|---|---|---|
| Warden | ● | ◐ | ○ | ◐ (Taunt, Daze) | ○ | ◐ (Warcry buffs) | ○ |
| Blade | ○ | ● | ○ | ◐ (Bleed, Stun) | ○ | ○ | ○ |
| Ranger | ○ | ○ | ● | ◐ (traps, Root, Mark) | ○ | ● (scouting, Trap Disarm) | ◐ (Forage stance) |
| Shade | ○ | ● | ◐ (throwing knives) | ◐ (Blind, Poison) | ○ | ● (Lockpicking, ambush −5%) | ○ |
| Arcanist | ○ | ○ | ● | ● (Chill / Freeze, Haste / Slow, Daze) | ○ | ● (Dispel, light, identify) | ○ |
| Mender | ○ | ○ | ◐ (Holy, Undead only) | ◐ (Fear) | ● | ● (cleanse, Momentum gifts, light) | ◐ (heals reach pets) |
| Beast Tamer | ◐ (Guard pet, Decoy) | ◐ | ◐ (whip reach) | ● (Grab, Daze, pull, Weaken) | ◐ (Lick Wounds, Mend pet) | ◐ (Foraging) | ● |

Tank is the thinnest column (Warden, or a Beast Tamer's pet in Guard), heal the second (Mender, or a Mend-stance pet and potions). A party with no ● in either is playable — the game is tuned so that it is — but it is playing on harder settings.

## 4. Party recipes

1. **The classic four — Warden, Blade, Mender, Arcanist.** Every column covered, the Arcanist's Firewave behind the Warden's Taunt, the Mender's revive for when it goes wrong. The composition the encounter tables are tuned against.
2. **Crypt-breakers — Mender, Warden, Ranger.** For Zone 2: the Mender's Holy does ≈ 2× against the Restless Dead, the Ranger's Perception keeps the ambush roll down in the Shadowy band, the Warden eats the bone knights. Loses its edge in the Drowned Vault.
3. **Glass cannons — Arcanist, Shade, Ranger.** No tank, no healer, every pet in Guard. Everything dies before it acts twice, or the party does — the recipe that finds out whether the surprise roll is fair.
4. **The pair — Blade + Mender** (two players). The Blade kills, the Mender keeps it standing and cleanses the spider Poison. Two-player encounters scale to ×0.8 count and ×0.85 HP; this pair handles them with margin.
5. **Solo picks.** *Warden* with a Mend-stance pet is the safest first solo. *Beast Tamer* (Segment 3) is the natural solo — pet plus summon is a party. *Shade* with a Guard pet is the fastest and most likely to wipe. *Mender* is slow but nearly unkillable in the Crypts. *Arcanist* is the hardest: one interrupted Firewave is a lost fight.

## 5. What every class can do

- **Basic attack** — free, at the weapon's weight (daggers and wands 800; most weapons, the staff included, 1,000; greatswords, mauls, crossbows and greatstaves 1,400 — `08` §1); restores 15% Stamina or 10% Mana.
- **Guard** — half damage until your next turn, +10 Momentum, restores 10% of the pool; weight 600.
- **Item** — potion, kit, torch, Phoenix Feather; weight 600.
- **Swap row** — weight 400; some skills (Blink Step, Drag) do it for free.
- **Flee** — a party vote; not from bosses (§12.1).
- **Pet stance** — one free change per fight (§9).
- **The Ultimate** — one per class, Tier III, 100 Momentum, no pool cost, never misses, cannot be interrupted.
- **Insight** — skills learned in the dungeon by using a school against the right enemies (§7.5); monster techniques by watching the monster.
- **Field skills** — all eight, level-by-use; each class starts with +2 rank in two of them (its sheet's §5 owns the pair): Warden Field Repair + First Aid · Blade Field Repair + Cooking · Ranger Trap Disarm + Foraging (and +1 Cartography) · Shade Lockpicking + Haggling · Arcanist Cartography + Haggling · Mender First Aid + Cooking · Beast Tamer Foraging + Field Repair. Rank effects are `09-SKILLS.md` §5.
- **Revive** — out of combat: First Aid at any rank. In combat (`03` §12.1): First Aid from rank 5 as a weight-1,000 action, a Mender revive skill, a Phoenix Feather, or an Ultimate that says so.

## 6. The sheets

- [Warden](classes/warden.md) — `docs/classes/warden.md`
- [Blade](classes/blade.md) — `docs/classes/blade.md`
- [Ranger](classes/ranger.md) — `docs/classes/ranger.md`
- [Shade](classes/shade.md) — `docs/classes/shade.md`
- [Arcanist](classes/arcanist.md) — `docs/classes/arcanist.md`
- [Mender](classes/mender.md) — `docs/classes/mender.md`
- [Beast Tamer](classes/beast-tamer.md) — `docs/classes/beast-tamer.md` (Segment 3)

Every sheet has the same sections in the same order with identical table columns, so `content/skills/<class>/<id>.json` (one record per skill) can be generated from the tables and two classes can be compared section by section.

## 7. Open questions (for James)

1. **Which classes to build first.** Proposed: **Warden, Blade, Ranger, Shade, Arcanist and Mender in Segments 1–2** (every armor family, both pools, every column of §3 covered) and **the Beast Tamer in Segment 3**, once pets are timeline actors and the summon rules have something to summon. If Segment 1 needs fewer, start with Warden, Blade and Mender — the three the first thirty minutes (§13) teach the timeline with.
2. **Monster techniques and the Insight sweet spot.** The Tier IV Insight formula peaks at enemy level 24; Gravehollow Keep ends at 14. Proposed: for monster techniques only, the sweet spot is the monster's own level — if it is using the move in front of you, the roll is at full strength. Otherwise every Tier IV technique must come from Dungeon 2 or later.
3. **Tier V at launch** (the rulebook's §7 question) — all 45 are designed now; the proposal stands to build Tier V in Segment 3.
4. **Weights by weapon vs by skill.** The sheets give every skill its own weight regardless of weapon. The alternative — the weapon shifts every action's weight (staff +200, dagger −200) — is felt every turn but doubles the tuning surface. Decide before `content/skills/*.json` is generated.
