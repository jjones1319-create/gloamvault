# 04 — Classes

*Last updated 2026-10-28 · rev. 4 (Phase 7, pass A: Tiers IV–V in the content, Tier V locked until Segment 3; techniques learned only by witnessing and may be prerequisites, as the sheets have them; the second starter kits; the class-damage pass and the bands note — D-028, D-099) · rev. 3 (checkpoint 1: open questions answered by delegation — D-099) · rev. 2 (§7 the Wayfarer Chest's cast, James's direction of 2026-10-27, D-091) · rev. 1 2026-10-26 · numbers are tuning starting points*

Seven classes, one sheet each in `docs/classes/`. This file is the index: the rule every sheet follows, the seven at a glance, what each one covers, what parties they make, and what all of them share. The rulebook is `03-GAME-DESIGN.md`; the skill rules are its §7.

## 1. The design rule

**Every class has pros *and* cons, and both are mechanical.** A Warden is slow (Plate −20 Speed) and does little damage; an Arcanist has the biggest AoE in the game and the lowest Defense; a Mender is the earliest in-combat revive and kills nothing outside the Crypts. Each con is a number on the sheet the simulator can measure, and each is something another class fixes. That is what makes a party.

**Roles are soft.** Nobody owns a role outright: a Warden's Warcry school buffs, a Shade's Larceny is utility, a Beast Tamer's Lash is control without a spell, a Mender in the Crypts is a striker. Any three classes can finish Gravehollow Keep; the recipes below make it *easy*.

**Forty-five skills each**: three schools × five tiers × three skills. Tier is fixed and opens at level 1 / 5 / 12 / 20 / 30; rank 1–10 grows by use (+4% effect, −2% cost per rank; rank 10 unlocks the Mastery line). Each Tier II–V skill has one prerequisite at the tier below in its school, so a school reads as three columns. Monster techniques (exactly two per class, Tier III–IV, learned only by witnessing the monster use the move — a flat 10% each time, certain by the 10th; `06-MONSTERS.md` says which monster teaches each) may stand in a school's chain where the sheet puts them: the Warden's Rampart follows Bone Knight's Stand, the Ranger's Spiked Net follows Deep Tentacle's Drag (the sheets own their trees; *Phase 7 reading* — the old "leaves" line was this index's, not the sheets'). Loadout: 4 actives + 2 passives + 1 pet stance. The Ultimate sits at Tier III, costs 100 Momentum and never misses.

> **Skill trees (D-153, D-154 — James, 2026-10-30; Unity, Phase 18):** each class's three schools become the branches of its skill tree, unlocked with skill points earned by levelling (`03` §7); the **Arcanist** is re-cut into four branches — Fire · Frost · Storm · Summoning — with summons in the Final Fantasy way (one great attack, then gone): 60 skills, written in Phase 18.

**Shared bands per tier** (the sheets stay inside these; the runner tunes the edges):

| Tier | Opens at | Cost (pool points) | Single-target × Attack | AoE × per target | Heal (% of target max HP) |
|---|---|---|---|---|---|
| I | L1 | 8–14 | 1.2–1.5 | 0.7–0.9 | 15–20 |
| II | L5 | 12–20 | 1.6–1.9 | 0.9–1.1 | 22–28 |
| III | L12 | 18–30 | 2.0–2.4 | 1.1–1.4 | 30–38 |
| IV | L20 | 25–40 | 2.5–3.0 | 1.4–1.7 | 40–50 |
| V | L30 | 35–50 | 3.2–4.0 | 1.8–2.2 | 55–70 |

Action weights: light 800 · normal 1,000 · heavy 1,400 (§3.1). Pools start near 60 (Stamina 30 + 3 × End; Mana 30 + 3 × Wis).

*As tuned (Phase 7, the class-damage pass).* The bands read "× Attack", and physical Attack grows only with Strength (`03` §2.2). The Ranger and the Shade barely train Strength and the Crypts halve Pierce, so on the bands' numbers they dealt a third to a half of the Blade and the Arcanist. Their Tier I–III multipliers now sit above the bands (the Ranger's Tier I–II ×1.5 — Aimed Shot 2.1× — and Tier III ×1.1; the Shade's Tier I–III ×1.35), and the Blade's, the Arcanist's Tier I and the Mender's single-target spells came down, so that no damage dealer outdoes another by more than about 1.5× at levels 1, 5, 8 and 13 (`tools/balance/class-damage.ts`; each sheet's "As tuned" note lists the numbers). Tiers IV–V keep the sheets' numbers until Dungeon 2 makes them measurable.

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
- **A second starter kit** (D-099, `08` §12): New hero offers the Warden a spear kit (a Copper Spear in both hands instead of the sword and buckler; starts with Reaching Thrust · Provoke · Brace) and the Blade a greatsword kit (a Copper Greatsword instead of the longsword and dagger; Cleaving Blow · Wind-up · Headsman's Eye), because the town sells no weapons. A wayfarer arrives with the default kit.
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

## 7. Wayfarers: the party members a chest calls (D-091)

James (2026-10-27): *"I think the only way to get new party members is through the chests … You keep all party members you got through chests and they continue to grow but can also die."* A **wayfarer** is a named adventurer of a fixed cast that the **Wayfarer Chest** (Curio Merchant, 1.2 R; `08-ITEMS.md` §10.2) calls to the Lantern Inn. Once called, a wayfarer is a hero in every way (`03` §10.4): levels, growth by use, gear, a pet from the Stables, and death under the save's rule (`03` §12). Every wayfarer is unique: one already with the player is never drawn; one lost for good returns to the pool and starts over if drawn again.

This section **owns the cast** (names, species, class, grade, points, starter skills, AI rule, a line of who they are); `tools/content/gen-wayfarers.ts` transcribes it to `content/wayfarers/<id>.json` and lint rule 34 checks it. **Grade** sets the draw odds (D 50 · C 30 · B 15 · A 5) and the creation points (6 + 1 per grade above D, at most 3 on one attribute). A wayfarer arrives at the level of the player's lowest-level living hero with the class's starter kit.

| Wayfarer | Species | Class | Grade | Points | Starter skills | Who they are |
|---|---|---|---|---|---|---|
| Bram Ostler | Human | Warden | D | End 3 · Vit 2 · Str 1 | Shield Slam · Provoke · Brace | A stablehand who once held a gate against wolves and never quite stopped standing in doorways. |
| Murza Kettlebrand | Orc | Warden | C | Str 3 · Vit 2 · End 2 | Shield Slam · Provoke · Rallying Shout | Carries a grandmother's dented shield and every grudge it ever earned. |
| Hilde Stonevow | Dwarf | Warden | A | End 3 · Vit 3 · Wil 3 | Shield Slam · Counter Stance · Wall Stance | Swore to hold the Keep's lower gate. The Keep fell; the vow did not. |
| Rokk Halfmoon | Orc | Blade | D | Str 3 · Vit 2 · Agi 1 | Twin Cut · Reckless Swing · Red Thirst | Fights with two blades because the first one kept getting stuck in things. |
| Saphrel Vey | Draconid | Blade | C | Agi 3 · Str 2 · Per 2 | Twin Cut · Open Vein · Flowing Guard | A duelist from the ash-coasts who counts scars the way merchants count coins. |
| Ilvane Thorne | Elf | Blade | B | Agi 3 · Per 3 · Str 2 | Twin Cut · Quickstep · Headsman's Eye | Moves like a falling leaf and cuts like the wind that drops it. |
| Pip Marrowby | Halfling | Ranger | D | Per 3 · Agi 2 · Lck 1 | Aimed Shot · Hunter's Mark · Keen Eyes | Can hit a rat at forty paces, and will tell you about it all the way home. |
| Sereth Moss | Elf | Ranger | C | Per 3 · Agi 3 · Wis 1 | Aimed Shot · Snare · Steady Draw | Reads tracks the way scholars read books, and trusts them more. |
| Edric Ashdown | Human | Ranger | B | Per 3 · Agi 2 · End 2 · Wis 1 | Aimed Shot · Caltrop Toss · Hunter's Mark | A poacher turned bounty-tracker: the Keep's rats pay better than the lord's deer ever did. |
| Lirien Quill | Elf | Shade | D | Agi 3 · Lck 2 · Per 1 | Backstab · Pickpocket · Light Fingers | Picks locks to stay in practice and pockets to stay in bread. |
| Tansy Brightfinger | Halfling | Shade | C | Agi 3 · Lck 2 · Per 2 | Veil · Backstab · Toxic Jab | Nobody watches the halfling. That is the whole trick. |
| Vesk Umber | Draconid | Shade | B | Agi 3 · End 2 · Per 2 · Wil 1 | Toxic Jab · Crippling Dust · Steeped Blades | Smoke-scaled and silent; a cult in the deep Vault still keeps a price on that head. |
| Orla Cinderhelm | Dwarf | Arcanist | D | Wis 3 · Wil 2 · Vit 1 | Ember Lance · Spark · Kindling | Learned fire at the forge before learning it from books, and still prefers the forge. |
| Aldous Fenwick | Human | Arcanist | C | Wis 3 · Per 2 · Wil 2 | Frostbolt · Frost Floor · Shatter | A failed tutor with three unpaid debts and one very good frost spell. |
| Wrenna Mapple | Halfling | Arcanist | A | Wis 3 · Wil 3 · Lck 3 | Ember Lance · Arcane Ward · Quicken | The smallest scholar of the Ember Academy, and the only one who came back from the Crypts. |
| Varra Dawnscale | Draconid | Mender | D | Wis 3 · Wil 2 · Vit 1 | Mend · Smite · Gentle Hands | Keeps a candle lit for every patient lost, and has not run out of candles yet. |
| Bruni Hearthward | Dwarf | Mender | C | Wis 3 · Vit 2 · Wil 2 | Mend · Soothing Word · Blessing | Sets bones, patches heads and makes a stew that has raised at least one man from the dead, he says. |
| Uldra Greythorn | Orc | Mender | B | Wis 3 · Str 2 · Wil 2 · Vit 1 | Smite · Radiance · Mend | Traded the war-drum for the prayer-bell, and hits just as hard with either. |
| Vorrin Scalehold | Draconid | Warden | S | End 3 · Vit 3 · Str 2 · Wil 2 | Shield Slam · Provoke · Brace | Held the bridge at Saltmere for a night and a day; the river remembers, and so does he. |
| Ysolde Marrick | Human | Blade | S | Str 3 · Agi 3 · Per 2 · Vit 2 | Twin Cut · Open Vein · Flowing Guard | Retired from the sword twice, and came back both times because nothing else felt like being awake. |
| Brenna Coalbrook | Dwarf | Ranger | S | Per 3 · Agi 3 · End 2 · Str 2 | Aimed Shot · Hunter's Mark · Keen Eyes | Hunts with the crossbow her grandfather built and the patience her grandmother taught. |
| Zhurra Velk | Orc | Shade | S | Agi 3 · Str 3 · Per 2 · Lck 2 | Veil · Backstab · Toxic Jab | The loudest family in the clans raised the quietest daughter, and she has made a living of it. |
| Ithiel Vantor | Elf | Arcanist | S | Wis 3 · Wil 3 · Per 2 · Lck 2 | Ember Lance · Frostbolt · Arcane Ward | Three hundred years of study, two hundred of them in the Ember Academy's library, and still taking notes. |
| Hazel Thimblewick | Halfling | Mender | S | Wis 3 · Wil 3 · Lck 2 · Vit 2 | Mend · Smite · Cleanse | Bakes bread, binds wounds and has buried no one in forty years of walking behind adventurers. |

Each species appears four times and each class four times; six are D, six C, four B, two A and six S. **The S grade (Phase 7, pass B — Proposed):** "S-grade wayfarers for deeper bands" (`12` Phase 7) are called only by the **Grand Wayfarer Chest** (5 R, sold from chest band E — once a Crypts floor is finished; odds C 45 · B 35 · A 15 · S 5, the Grand shape one grade up from the Standard's D; the same pity counters, a Grand counting three); the Standard chest keeps D-091's D 50 · C 30 · B 15 · A 5 at every band of Gravehollow. An S wayfarer has 6 + 4 creation points and the class's own starter picks. A wayfarer whose starter skills differ from the class's picks carries an AI rule that uses them (the generator's table); the others use the class default. Every starter skill works with the class's starter kit (`node tools/balance/check-starters.ts`). The cast grows with the dungeons (Phase 7 and Segment 3: S-grade wayfarers, the Beast Tamer's).

**Open questions**
1. ~~Eighteen wayfarers for Segment 1, graded D–A — enough variety to make "hopefully redraw them" matter?~~ *Checkpoint 1 (D-098): enough for Segment 1; the cast grows with each dungeon (S-grade wayfarers in Phase 7, Beast Tamers in Segment 3).*
2. ~~Should higher grades bring more than points (a personal trait, a better starting kit)?~~ *Checkpoint 1 (D-099): not now — a grade brings creation points and rarity only, as built; every wayfarer already differs by species, class, starter skills and AI rule.*

## 8. Open questions (for James)

1. ~~**Which classes to build first.** Proposed: **Warden, Blade, Ranger, Shade, Arcanist and Mender in Segments 1–2** (every armor family, both pools, every column of §3 covered) and **the Beast Tamer in Segment 3**, once pets are timeline actors and the summon rules have something to summon. If Segment 1 needs fewer, start with Warden, Blade and Mender — the three the first thirty minutes (§13) teach the timeline with.~~ *Checkpoint 1 (D-099): as proposed and built — the six in Segments 1–2, the Beast Tamer in Segment 3.*
2. ~~**Monster techniques and the Insight sweet spot.** The Tier IV Insight formula peaks at enemy level 24; Gravehollow Keep ends at 14. Proposed: for monster techniques only, the sweet spot is the monster's own level — if it is using the move in front of you, the roll is at full strength. Otherwise every Tier IV technique must come from Dungeon 2 or later.~~ *Checkpoint 1 (D-028): techniques skip the curve — a flat 10% per witnessed use of the move, with a pity at 10 uses (the class sheets' proposal) — so every Gravehollow technique can be learned in Gravehollow.*
3. ~~**Tier V at launch** (the rulebook's §7 question) — all 45 are designed now; the proposal stands to build Tier V in Segment 3.~~ *Checkpoint 1 (D-099): Tier V is in the game at launch — from endgame bosses and Divine Shards, built in Segment 3.*
4. ~~**Weights by weapon vs by skill.** The sheets give every skill its own weight regardless of weapon. The alternative — the weapon shifts every action's weight (staff +200, dagger −200) — is felt every turn but doubles the tuning surface. Decide before `content/skills/*.json` is generated.~~ *Checkpoint 1 (D-099): by skill, as built — the weapon sets only the basic attack's weight (`08` §1).*
