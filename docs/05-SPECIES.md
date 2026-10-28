# 05 — Species

*Last updated 2026-10-28 · rev. 3 (Phase 5: §5 as built) · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26 · numbers are tuning starting points*

*Leans on `03-GAME-DESIGN.md` §2, §4.2, §4.4, §5 and §6.1. Feeds `11-ART-PIPELINE.md` and `tools/blender/hero/build_body.py`. Classes are `04-CLASSES.md`; this file only says which bodies suit which kits.*

---

## 1. Design rules

1. **Every species has pros and cons.** A trait that only helps is a stat, not a species. Each card lists four or five of each, and the creation screen shows them.
2. **Modifiers net +2.** Every species adds +2 across the eight attributes (a +2 Endurance body pays with −2 Agility elsewhere), so no species is "the strong one"; they are differently shaped.
3. **Traits are mechanical and felt in the dungeon.** Darkvision changes the ambush roll; Scales grow on the status screen; Lucky re-rolls a disarm. Nothing is flavour text only.
4. **Species never locks a class.** Any of the six can play any of the seven. Some fits are better (§4) and the card says so, but the lock is the class's armor family, never the body.
5. **Species is the body, class is the gear.** On the shared rig a species is a root scale, a few bone scales, one shape key and a few extra meshes; a class is armor meshes and props on sockets. Every species × class pair must render with no artist touching it (§5).
6. **Modifiers shift the soft cap too.** The soft cap is creation value + 2 × Level (§5.2), so a +2 Endurance Dwarf has an Endurance ceiling two points higher *for life*. That is why species still matters at level 30.

---

## 2. Summary

| Species | Modifiers | Traits (short) | Senses | Best fits | Worst fits | One-line pro | One-line con |
|---|---|---|---|---|---|---|---|
| **Human** | +1 Wis, +1 Will | Quick Study (+10% all XP) · Adaptable (3rd loadout preset, field skills start at rank 2) | none | Mender; anything | none | Learns everything faster, no hole | Nothing dramatic; no special senses |
| **Dwarf** | +2 End, +1 Vit, +1 Str, −2 Agi | Darkvision · Stonefoot (no Root, no row push, Poison res) · Forge-born (repair, cheaper promotions) | one band brighter | Warden | Shade, Ranger, Arcanist | Hardest front line in the game | Slowest body: Agi −2 and −5 Speed |
| **Elf** | +2 Agi, +1 Per, +1 Wis, −2 Vit | Darkvision · Keen Senses (+2 Detection) · Lightfoot (+5 Speed) | one band brighter, +2 Det | Ranger, Shade, Arcanist | Warden | Most turns, sees the most | Fragile; metal armor costs double Speed |
| **Orc** | +2 Str, +2 Vit, −1 Per, −1 Wis | Bloodrage (+15% dmg under half HP) · Thick Hide (+5 Def) · Intimidating | steady aim in Dark; −2 Det in Radiant | Warden, Blade | Arcanist, Mender | Hits hardest, especially when hurt | Noisy, overcharged, slow at lore |
| **Halfling** | +2 Luck, +1 Agi, +1 Per, −2 Str | Lucky (Fortune, disarm re-roll) · Small (+5% Dodge, big things miss) · Nimble Fingers | none (Per +1) | Shade, Ranger | Warden, Blade | Crits, loot and locks | Weak arms, light pack, no tower shields |
| **Draconid** | +2 End, +1 Str, +1 Will, −1 Agi, −1 Luck | Scales (+8 Def that levels) · Breath (Fire cone, once per fight) · Fireblood | steady aim in Dark | Warden, Blade | Arcanist, Shade | Armored skin and a free opener | Frost ×1.25, −10% XP, slow |

---

## 3. The six species

### 3.1 Human

**Who they are.** Emberfall is a human town: the Lantern Inn, the Waystone square and the Quest Board were raised by the families who settled the Gravehollow road after the Keep fell. Humans delve because the cellars pay and the board is on their doorstep.

**Modifiers:** +1 Wisdom, +1 Willpower.

| Trait | Exact rule |
|---|---|
| **Quick Study** | +10% to every XP gain: skill ranks, attribute points, item levels, field skills and the pet's 50% share. Multiplies after Wisdom's +1% per point (§5.3). |
| **Adaptable** | One extra **loadout preset** (a saved 4 + 2 + stance set swappable in town and rest rooms; default 2, Humans 3) and **+1 starting rank in all eight field skills** (rank 2 at creation). |

| Pros | Cons |
|---|---|
| Fastest learner, in every column | No attribute above +1 |
| No weakness line: no element, armor or weapon penalty | No Darkvision or Dark-steady aim |
| Third loadout preset, real once Tier III lists are deep | Nothing a monster is afraid of |
| Best first hero; the baseline every other card is measured against | The dullest card on the shelf |

**How it plays.** The Human is the ruler the others are held against. A Human Warden in Plate with sword and buckler sits at Speed 100 + 5 × (10 − 10) − 20 = **80**: an action every 12.5 ticks, about one per 1.5 actions of a Speed-120 cellar rat. A Human Mender in Robes is at 100 with Mana 30 + 3 × 11 = 63. Nothing on the timeline surprises a Human player, which is why the first-thirty-minutes script (§13) assumes one.

**Grows by use.** A Human reaches level 20 about 9% sooner than a same-play Dwarf (1 ÷ 1.10 uses per rank). The field-skill head start is spent by then (rank 2 is under 2% of rank-10 XP); the third preset matters most exactly then, when two schools are worth swapping between fights. Soft caps: creation + 40 like everyone, +1 on Wisdom and Willpower for life.

**Voice and flavour.** Town: *"Hesper says the cellars are paying. The cellars always say that."* Dungeon: *"Light's dropping. Torch now, or push one more room and see what the dark is holding?"* Victory: *"Write that one down. I want it on the board by morning."*

**Visual brief for Blender.**

| | |
|---|---|
| Height | **1.80 m** — the base body; every ratio below is 1.00 |
| Proportions | head 1.00 · shoulders 1.00 (≈ 2 heads wide) · legs 1.00 (half the height) · hands 1.00 |
| Silhouette | upright, neck visible, shoulders square, mid-length hair |
| Separate meshes | none; round ears are part of the body; hair from the shared `hair_*` set (6 styles) |
| Skin | Ashen Rose `#E8C4A8` · Riverclay `#B8825A` · Peatbrown `#6B4531` |
| Hair / eyes | black, dark brown, chestnut, wheat, auburn, grey / brown, hazel, green, blue, grey |
| Shape keys | none species-specific (all `spc_*` at 0); universal `body_lean`, `body_heavy`, `body_muscle` and the 12 `face_*` keys |
| Bone scale | root `spc_scale` 1.00; every bone group 1.00 |
| Face presets | `hum_a Weathered` (heavy brow, lined) · `hum_b Open` (round, young) · `hum_c Sharp` (narrow jaw, high cheekbones) |
| Reads at 200 px | the baseline: upright and middle-sized next to anyone else; readable neck and hair |
| Gear fit | every gear piece is authored on this body; no variants |

### 3.2 Dwarf

**Who they are.** Emberfall's dwarves are surface kin of the deep clans who held the Emberforge before it went quiet. They came up the old road two generations ago, built forge-row behind Hesper's smithy, and delve because every deep place is a rumour of what happened below.

**Modifiers:** +2 Endurance, +1 Vitality, +1 Strength, −2 Agility.

| Trait | Exact rule |
|---|---|
| **Darkvision** | Reads the light band **one brighter** for its own rolls: Detection light bonus, Accuracy/Damage penalty, its share of the scouting roll, and the ambush roll when it is the party's best Perception. Pitch reads as Dark; Radiant stays Radiant. The **loot** bonus is a party roll at the true band, so darkness still pays. |
| **Stonefoot** | Immune to **Root** and to every forced row move (knockback, pull, enemy-forced swap). Poison damage ×0.70; Poison status applied 30% less often. |
| **Forge-born** | Field Repair effective rank +2 (may exceed 10; Mastery opens two ranks early). Material promotions cost −10% gold. |
| Cons | **−5 base Speed** (short stride), Mana pool ×0.90, **Longbows locked** (shortbows and crossbows fine). |

| Pros | Cons |
|---|---|
| HP 110 and Defense 12 at level 1 on a body built for Plate | Agi 8 and −5 Speed: the slowest body before armor |
| Never leaves the front row; a Root or a pull is a wasted enemy turn | Mana ×0.90 makes casting classes thin |
| Darkvision turns Shadowy into Dim for your own ambush and aim | No longbows: the Ranger is a crossbow Ranger |
| −10% on every promotion; +2 Endurance cap for life | Nothing for Crit, Dodge or Detection; the timeline strip shows you last |

**How it plays.** A Dwarf Warden in F-grade Plate with a one-handed axe: 100 + 5 × (8 − 10) − 20 − 5 = **65**. An Elf Warden in the same Plate is 75; an Elf Ranger in Leather is 112 and gets 1.7 actions per Dwarf action. The Dwarf's answer is that each turn is worth more: Defense from End 12, Stamina 66, and spare Strength above the armor's requirement relieving the Plate penalty (§6.1), so a Dwarf Warden climbs back toward 80 as Strength trains. In a Shadowy room the Dwarf's own rolls read Dim: ambush-against-you +5% instead of +15%.

**Grows by use.** At level 20: Endurance cap 52 against a Human's 50, Agility cap 48. Stonefoot and Darkvision are flat and matter every floor. Forge-born's +2 ranks put Field Repair Mastery at trained rank 8; by then the promotion discount has compounded over four grade steps.

**Voice and flavour.** Town: *"Forge-row says the Keep's iron was cold-worked. Nobody cold-works iron. Somebody down there is lying."* Dungeon: *"Dark's fine. Dark's where the good stone is."* Resisting a push: *"Pushed? Me? Lad, I've been leaned on by a mountain."*

**Visual brief for Blender.**

| | |
|---|---|
| Height | **1.40 m** |
| Proportions (absolute vs human) | head 0.94 · shoulders 0.97 · legs 0.71 · hands 0.97 — a human-wide chest on legs a third shorter |
| Silhouette | a barrel on short legs with a beard-shaped chest; wider than it looks tall |
| Separate meshes | `spc_dwarf_beard` skinned to `Beard_01..02` (4 styles: full, forked, braided, short); `spc_dwarf_braids` on `Hair_*` |
| Skin | Hearth-ember `#D9A98C` · Barkhide `#A66A48` · Cindergrey `#7E6B63` |
| Hair / eyes | rust red, iron grey, black, ash blond, white (beard matches) / amber, dark brown, slate |
| Shape keys | `spc_dwarf_broad` 1.0 (barrel ribcage, thick forearms and calves, short neck, heavy brow); `beard_tuck` on the beard mesh |
| Bone scale | root 0.84; UpperLeg 0.85, LowerLeg 0.85; Shoulder 1.15, Chest/UpperChest 1.10; Hand 1.15; Head 1.12; Neck 0.85 |
| Face presets | `dwf_a Anvil` (square jaw, heavy brow) · `dwf_b Hearth` (round, ruddy) · `dwf_c Flint` (narrow eyes, scarred brow) |
| Reads at 200 px | width and beard; the shortest wide thing on screen |
| Gear fit | Helmet width comes free from Head 1.12; cheek-guard helms set `beard_tuck`; Chest and Legs carry `spc_dwarf_broad`; weapons counter-scaled to world size (§5) |

### 3.3 Elf

**Who they are.** The elves come down from the gloam-woods north of Emberfall, where the dark under the Keep has started to seep into the roots. They delve to find out why, and because an elf who has walked the Crypts can tell the town what is actually down there.

**Modifiers:** +2 Agility, +1 Perception, +1 Wisdom, −2 Vitality.

| Trait | Exact rule |
|---|---|
| **Darkvision** | Same rule as the Dwarf's: one band brighter for the Elf's own rolls; loot at the true band. |
| **Keen Senses** | +2 Detection (applies to the party's *best* Detection when the Elf holds it); scouting chance +5% (stacks with the Ranger's +5%). |
| **Lightfoot** | +5 base Speed; Web and Root durations −1 turn (minimum 1). |
| Cons | **Max HP ×0.90**; Plate and Mail speed penalties **doubled** (−40 / −20); Fear resistance −10 pp. |

| Pros | Cons |
|---|---|
| Speed 115 in Robes, 112 in Leather: the most turns in the party | HP 80 at level 1 (89 × 0.9), the lowest |
| Detection 13 at creation: traps and secrets open earlier | Plate costs 40 Speed; an Elf Warden is slower than a Dwarf one |
| Darkvision plus Detection makes Dark rooms a loot run | Fear lands more often, and Fear skips actions |
| +1 Wisdom: more Mana, more XP, more Insight; Lightfoot shortens Web and Root | −2 Vitality cap for life; the front row is not yours |

**How it plays.** An Elf Shade in Leather with paired daggers: 100 + 5 × (12 − 10) + 5 − 3 = **112**; daggers are light (800), so the Elf acts every 7.1 ticks — about 2.2 actions per Dwarf Warden action. The same Elf in Plate is 100 + 10 + 5 − 40 = 75 with 80 HP: the game is telling you something. Elves want Leather, Robes and the back row, where Detection finds the secret door and Speed means the Chill never catches them.

**Grows by use.** At level 20 the Agility cap is 52 and Perception 51; Keen Senses' +2 rides on top, so an Elf Ranger with a Forage pet reveals difficulty-40 traps on sight. Lightfoot's flat +5 matters less by then (a trained Elf is at Speed 140+), which is intended: the edge moves from the trait to the attribute.

**Voice and flavour.** Dungeon: *"Your torch is loud. Everything on this floor already knows we're here."* Scouting: *"Something moved two rooms over. Not footsteps — a door."* Formation: *"I'll take the back row. Plate is for people who like being hit."*

**Visual brief for Blender.**

| | |
|---|---|
| Height | **1.90 m** |
| Proportions (absolute vs human) | head 0.97 · shoulders 0.94 · legs 1.10 · hands 1.02 (fingers 1.12) |
| Silhouette | a tall narrow line with long legs and ears that break the head outline |
| Separate meshes | `spc_elf_ears` skinned to `Ear_L/R` (2 lengths: swept, long); the body's round ears hidden by the `ears_hide` body mask |
| Skin | Moonpale `#F0E2D6` · Birchbark `#D6B99F` · Duskwood `#8C6A52` |
| Hair / eyes | silver, raven, ash blond, moss-dark / violet, silver, green, gold |
| Shape keys | `spc_elf_lean` 1.0 (narrow ribcage, long neck, high cheekbones, almond eyes) |
| Bone scale | root 1.02; UpperLeg 1.08, LowerLeg 1.08; Neck 1.10; Head 0.95; Shoulder 0.92; Chest 0.95; fingers 1.10 |
| Face presets | `elf_a Still` (long, calm) · `elf_b Wry` (lifted brow, half smile) · `elf_c Hollow` (gaunt, deep eyes) |
| Reads at 200 px | tallest narrow silhouette; ears visible past the hair |
| Gear fit | Plate/Mail helms hide the ears (`hides_ears` flag); Leather and Robe hoods get a `hood_ear` key; Chest and Legs carry `spc_elf_lean` |

### 3.4 Orc

**Who they are.** Clan-folk from the eastern marches who came to Emberfall as caravan guards and stayed when the caravans stopped. They delve because the town pays bounties for the Keep's heads, and because an orc who has held the Cellars' front row is one the merchants stop overcharging — eventually.

**Modifiers:** +2 Strength, +2 Vitality, −1 Perception, −1 Wisdom.

| Trait | Exact rule |
|---|---|
| **Bloodrage** | +15% damage dealt while below 50% HP (checked when the action resolves). |
| **Thick Hide** | +5 Defense, counted as armorDefense (Endurance stacks on top). |
| **Intimidating** | Warcry-school and Fear-type effects the Orc applies last +20% longer; **fodder-role** enemies have a 10% chance to lose their first action in a fight the Orc opens. |
| Dark-steady aim | Whatever Accuracy penalty heroes take in Dark and Pitch (§4.2; proposed −5 / −10 pp, sim-owned), the Orc ignores. |
| Cons | **Noisy** (+5% to be ambushed, party-wide); merchants charge +10% (after Haggling); −10% XP on Wisdom-tagged actions; **Detection −2 in Radiant light**. |

| Pros | Cons |
|---|---|
| Attack +4 and HP 117 at level 1 | +5% ambush for the whole party |
| Bloodrage: the second half of every fight hits harder | Shops and promotions cost 10% more |
| Thick Hide: five free Defense that never wears | −1 Wisdom and −10% Wisdom XP: casting is uphill |
| Aim unaffected by Dark: push the torch down for loot | Bright rooms blind you: −2 Detection in Radiant |
| Warcry and Fear run long; fodder flinches | −1 Perception: more traps found by stepping on them |

**How it plays.** An Orc Blade in Mail with a greatsword: 100 + 0 − 10 = **90**, heavy weight 1,400, so one swing every 15.6 ticks — at Attack weapon + 24, ×1.15 once the fight has cost half of 117 HP. Against a Dwarf Warden the Orc is faster and hits harder; against an Elf it takes the hits the Elf cannot. Light is the Orc's lever: at Dark the party eats +25% ambush (+5% for the noise) for +50% loot, and the Orc's swings land as if it were Dim.

**Grows by use.** At level 20: Strength and Vitality caps 52; Perception and Wisdom caps 49. Bloodrage and Thick Hide are flat; Thick Hide matters less at Defense 90 than at 20, which is intended. Intimidating scales with the Warcry school's durations, so an Orc Warden in Warcry is the build where the trait keeps growing.

**Voice and flavour.** Town: *"Hesper charges me ten extra for a repair. I charge the Keep twenty."* Below half HP: *"Half dead is the best half. Watch."* Fight start: *"The little ones hesitate when I look at them. Good. More time for the big one."*

**Visual brief for Blender.**

| | |
|---|---|
| Height | **1.95 m** posed (2.00 m straightened; the idle hunches 5 cm) |
| Proportions (absolute vs human) | head 1.10 · shoulders 1.29 · legs 1.06 · hands 1.29 — legs short for the height, torso long |
| Silhouette | a wedge: the widest shoulders on screen, head set forward, long arms |
| Separate meshes | `spc_orc_tusks` rigid to `Head` (3 sizes); `spc_orc_ears` (short, pointed) on `Ear_L/R`; `spc_orc_topknot` hair variant |
| Skin | Mossgreen `#6F8A4D` · Boggrey `#6C7566` · Umber `#7A5238` |
| Hair / eyes | black, dark red, iron grey, shaved / amber, red-brown, yellow |
| Shape keys | `spc_orc_bulk` 1.0 (trapezius mass, forward neck, heavy jaw, flat nose, brow ridge, thick fingers) |
| Bone scale | root 1.12; UpperLeg 0.95, LowerLeg 0.95; Shoulder 1.15, Chest/UpperChest 1.12; UpperArm 1.10, LowerArm 1.12; Hand 1.15; Head 0.98; Neck 1.10 |
| Face presets | `orc_a Brute` (underbite, big tusks) · `orc_b Grim` (scarred, small tusks) · `orc_c Clan` (painted brow, broad nose) |
| Reads at 200 px | the widest shoulders and the forward head; tusks catch the light |
| Gear fit | full-face Plate helms get an `_orc` jaw cut-out (tusks always show); Chest and Gloves carry `spc_orc_bulk`; shoulder pads sit on Shoulder 1.15 automatically |

### 3.5 Halfling

**Who they are.** River-barge families who tie up below Emberfall's mill and have been "salvaging" from the Keep's flooded halls since before the town had a Waystone. They delve the way they fish: patiently, with a key for everything and an apology ready.

**Modifiers:** +2 Luck, +1 Agility, +1 Perception, −2 Strength.

| Trait | Exact rule |
|---|---|
| **Lucky** | Fortune +5 pp (0.5% × Luck + 5%, still capped at 25%); **one re-roll of a failed Trap Disarm per floor** (the failure does not trigger the trap). |
| **Small** | +5 pp Dodge *after* the 30% cap (effective cap 35%); **Large**-size monsters (bosses, trolls, giants — the `06-MONSTERS.md` size tag) have −10 pp Accuracy against the Halfling. |
| **Nimble Fingers** | Lockpicking effective rank +2, Haggling +1 (may exceed 10). |
| Cons | Carry capacity ×0.70; **heavy two-handers** (greatswords, mauls, two-handed axes, crossbows — weight 1,400) need **+2 Strength** over the listed requirement (bows and staves exempt); max HP ×0.90; **tower shields locked** (bucklers fine). |

| Pros | Cons |
|---|---|
| Crit from Luck + Perception; loot rolls shift up | Str 8: Attack −4 and a 31 kg pack (44 × 0.7, vs 50) |
| Big monsters miss you one time in ten more | HP 93 at level 1 |
| Locks, haggling and a free disarm retry | No tower shield: the shield Warden is a buckler Warden |
| Agi 11, +5% Dodge and 5% free skills: the back row rarely gets touched | Heavy weapons sit two Strength further away; Luck never trains, so the gift never grows |

**How it plays.** A Halfling Shade in Leather with daggers: 100 + 5 × (11 − 10) − 3 = **102**, light weight, every 7.8 ticks. Crit at creation is modest (x = 1 + 2 = 3 → 6.4%) but Luck is the one stat nobody can raise by use, and the Halfling starts +2 before gear and blessings. In a boss fight it is the hero the boss keeps missing; in a trap gauntlet, the hero who gets a second try.

**Grows by use.** Luck does not train (§2.1), so the +2 and the gap are permanent: at level 20 a Halfling with the same Luck gear as a Human sits two points higher on Crit, Fortune, Variance and loot grade. The 35% Dodge cap is reachable by a trained Shade. Nimble Fingers puts Lockpicking Mastery at trained rank 8.

**Voice and flavour.** Chest: *"Locked chests are just chests that haven't met me yet."* Trap: *"If it goes off, I'll apologise. Then I'll try again."* Boss: *"Big thing, small me. It'll swing where I was."*

**Visual brief for Blender.**

| | |
|---|---|
| Height | **1.20 m** |
| Proportions (absolute vs human) | head 0.81 · shoulders 0.67 · legs 0.63 · hands 0.74 · feet 0.81 — head large for the body, feet large for the legs |
| Silhouette | compact and round-shouldered; a big head of curls, big bare feet |
| Separate meshes | `spc_halfling_feet` (broad, hair-tufted) when the Boots slot is empty; `spc_halfling_curls` on `Hair_*` |
| Skin | Honey `#EBC59B` · Hazelnut `#C29068` · Chestnut `#8A5A3C` |
| Hair / eyes | curly brown, copper, dark blond, black / brown, green, hazel |
| Shape keys | `spc_halfling_round` 1.0 (soft belly, round cheeks, small nose, short neck) |
| Bone scale | root 0.70; UpperLeg 0.90, LowerLeg 0.90; Head 1.15; Hand 1.05; Foot 1.15, Toes 1.15; Chest 1.05; Shoulder 0.95 |
| Face presets | `hlf_a Bright` (wide eyes, freckles) · `hlf_b Shrewd` (narrow eyes, dimples) · `hlf_c Weathered` (sun lines, grey temples) |
| Reads at 200 px | the smallest figure with the biggest head; the curls |
| Gear fit | no mesh variants: root 0.70 scales every skinned piece; weapons stay world-size; tower shields never load; Boots pieces override `spc_halfling_feet` |

### 3.6 Draconid

**Who they are.** The scaleborn hatched from clutches that appeared along the Frostmarch road the winter the Pale Dragon stirred, raised by whoever found them. They are few, they are new, and Emberfall is not sure of them. They delve because below ground nothing stares.

**Modifiers:** +2 Endurance, +1 Strength, +1 Willpower, −1 Agility, −1 Luck.

| Trait | Exact rule |
|---|---|
| **Scales** | +8 natural Defense as a twelfth, unremovable armor piece with its own **item level 1–10** (XP from hits absorbed, 2 × D per hit, as armor in §5.2): +2% per level, affinity lines at 3 / 6 / 9 (+5% reduction vs the family absorbed most), level 10 **Awakened**: +12 Defense and Frost weakness softens to ×1.15. No durability. |
| **Breath** | Innate, **once per fight**, weight 1,000, no pool cost: a Fire cone, 1.0 × Attack (physical or spell, whichever is higher) to every enemy in the **front row**, applies Burn. Ranks by use like a skill (10 × D per use, about 380 fights to rank 10); Mastery line open (§7). A monster-technique-style innate for Insight. |
| **Fireblood** | Fire damage ×0.50; immune to Burn. |
| Dark-steady aim | As the Orc: ignores the hero Accuracy penalty in Dark and Pitch. |
| Cons | **Frost ×1.25** (Chill and Freeze apply normally); **−10% all XP**; −5 base Speed; Robes and Leather Boots and Gloves use the `_drc` visual variant (claws, tail). |

| Pros | Cons |
|---|---|
| Defense 20 at level 1 before armor (Scales 8 + End 12) against a Human's 10 | Frost ×1.25: Frostmarch Citadel is hostile ground |
| Breath opens every fight with a front-row hit and a Burn | −10% XP: the slowest learner |
| Fire ×0.50 and Burn immune: the Emberforge is home ground | −5 Speed and Agi 9: Speed 90 in Robes, 70 in Plate |
| Scales grow by use and never wear; +1 Willpower holds casts | −1 Luck: fewer crits, worse loot; Breath is once, and Fire-immune families ignore it |

**How it plays.** A Draconid Warden in Plate with mace and shield: 100 + 5 × (9 − 10) − 20 − 5 = **70**, between the Dwarf's 65 and the Human's 80, with the best Defense line of the six. The fight opens with Breath on the front row; then the Draconid stands there. Against a Dwarf Warden the difference is temperament: the Dwarf cannot be moved, the Draconid cannot be burned and hits first. Frost is the one thing the player is told to watch.

**Grows by use.** Scales is the growth story: at level 20 it is usually item level 7–8 (Defense ~9.2, two affinity lines — say Undead and Constructs after Gravehollow); a careful tank Awakens it near level 25. Breath at rank 5 is a 1.16 × Attack cone. A level-20 Draconid has played about 11% longer than a Dwarf and 22% longer than a Human to get there; the +2 Endurance cap (52) and +1 Willpower cap are permanent.

**Voice and flavour.** Town: *"They stare in Emberfall. Down here nothing stares for long."* Formation: *"Front row. Frost is the only thing I ask you to watch for."* After Breath: *"That was the once. The rest is steel."*

**Visual brief for Blender.**

| | |
|---|---|
| Height | **1.92 m** to the crown; 2.00 m to the horn tips |
| Proportions (absolute vs human) | head 1.06 (muzzle) · shoulders 1.11 · legs 1.03 · hands 1.14 · tail 1.10 m from the sacrum |
| Silhouette | a heavy upright figure with a crest, swept-back horns and a tail that balances the lean |
| Separate meshes | `spc_draconid_tail` skinned to `Tail_01..04`; `spc_draconid_horns` rigid to `Head` (3 sets: swept, ram, crown); `spc_draconid_crest` (neck ridge, skinned Neck/Head); `spc_draconid_claws_hand` / `_foot` (replace fingertips and toes when Gloves/Boots are empty or `_drc`); scales are a **normal + mask texture**, not a mesh |
| Skin | Ember `#B8432E` · Verdigris `#3F7D6A` · Slate `#4B4E5C`; belly plates one step lighter via the mask's G channel |
| Hair / eyes | none; horns and crest in bone ivory, obsidian, aged brass / gold, amber, white-blue, slit pupils |
| Shape keys | `spc_draconid_ridge` 1.0 (muzzle, brow ridge, no external ears, thick neck, chest plates, heel raised 2 cm) |
| Bone scale | root 1.06; Neck 1.12; Head 1.00 (the muzzle is the key, so helmets fit); Chest/UpperChest 1.08; Shoulder 1.05; LowerLeg 0.97; Hand 1.08; Foot 1.10 |
| Face presets | `drc_a Ember` (short muzzle, ram horns) · `drc_b Spire` (long muzzle, swept horns) · `drc_c Old` (chipped crown horns, pale scales) |
| Reads at 200 px | tail and horns; nothing else on the roster has either |
| Gear fit | **Legs** in all four families need a `_drc` tail port, skirted Robe **Chest** pieces too; Robes/Leather **Boots** and **Gloves** get `_drc` claw variants (Plate/Mail gauntlets and sabatons cover the claws); full-face Plate helms get a `_drc` muzzle variant |

---

## 4. Class × species fit matrix

◎ great · ○ fine · △ awkward. Nothing is locked.

| | Human | Dwarf | Elf | Orc | Halfling | Draconid |
|---|---|---|---|---|---|---|
| **Warden** (Plate) | ○ | ◎ | △ | ◎ | △ | ◎ |
| **Blade** (Mail) | ○ | ○ | ○ | ◎ | △ | ◎ |
| **Ranger** (Leather) | ○ | △ | ◎ | ○ | ◎ | ○ |
| **Shade** (Leather) | ○ | △ | ◎ | ○ | ◎ | △ |
| **Arcanist** (Robes) | ○ | △ | ◎ | △ | ○ | △ |
| **Mender** (Robes) | ◎ | ○ | ○ | △ | ○ | ○ |
| **Beast Tamer** (Mail) | ○ | ○ | ○ | ○ | ○ | ○ |

**Reasons.**

- **Human ◎ Mender** — +1 Wisdom and +1 Willpower are the healer's two needs (heal Attack, uninterrupted casts). Human has no △: that is the whole card.
- **Dwarf ◎ Warden** — End 12, Vit 11, Str 11 and Stonefoot: the one front-liner no disabler can move. **△ Ranger** — no longbows and Agi 8 on the ranged-accuracy stat; a crossbow Dwarf works but is slow. **△ Shade** — Speed 82 in Leather on a class that lives at 110+. **△ Arcanist** — Mana ×0.90, no Wisdom, fewer casts.
- **Elf ◎ Ranger / ◎ Shade** — Agi 12, Per 11, Keen Senses, Lightfoot, Leather: Speed 112 with the party's best Detection. **◎ Arcanist** — Speed 115 in Robes and +1 Wisdom: the most casts per fight of any body. **△ Warden** — Plate at −40 and 80 HP; slower than a Dwarf Warden and far squishier.
- **Orc ◎ Warden** — Vit 12, Thick Hide, and Intimidating feeding the Warcry school. **◎ Blade** — Str 12 on the Attack stat, Bloodrage on a class that trades hits. **△ Arcanist / △ Mender** — −1 Wisdom, −10% Wisdom XP, smaller Mana; playable, uphill.
- **Halfling ◎ Shade** — Luck, Agi, Small, Nimble Fingers, Leather: every trait lands. **◎ Ranger** — bows are exempt from the heavy-weapon rule; Per 11 + Luck 12 feed Crit. **△ Warden** — Str 8, no tower shield, −10% HP and a light pack under Plate. **△ Blade** — the Strength class on the −2 Strength body.
- **Draconid ◎ Warden** — Scales + End 12 + Will 11 and a Fire opener; the second tank line after the Dwarf and the only one Fire cannot touch. **◎ Blade** — Stamina 66 and Scales let a Blade hold the front row; Breath opens every fight. **△ Shade** — −1 Agi, −5 Speed and −1 Luck are the Shade's three stats. **△ Arcanist** — −10% XP on the longest learning curve, no Wisdom, and Breath is redundant with Fire spells.
- **Beast Tamer** — ○ for everyone: the pet does the specialising, and Mail at −10 is survivable for every body (the Elf is at 95, still faster than a Human in Mail).

---

## 5. Shared-rig notes

**One rig.** Every species is the same armature, built by `tools/blender/hero/build_body.py` from the bone table in `tools/blender/lib/rig.py` (the built `.blend` lands under `art/build/`), with Unity-Humanoid / Mixamo-compatible names so reference clips and any retargeter line up:

`Hips · Spine · Chest · UpperChest · Neck · Head · {Left,Right}{Shoulder, UpperArm, LowerArm, Hand} · {Left,Right}{Thumb,Index,Middle,Ring,Little}{Proximal,Intermediate,Distal} · {Left,Right}{UpperLeg, LowerLeg, Foot, Toes}` — 54 deform bones.

**Optional chains**, present on every export so the skeleton is identical everywhere (unused bones cost nothing and keep every `.glb` binding to one `Skeleton`): `Tail_01..04` (from Hips; Draconid), `Ear_L / Ear_R` (from Head; Elf, Orc), `Beard_01..02` (from Head; Dwarf), `Hair_01..03` (long styles). Total 65, under the 70-bone budget.

**Sockets** (empties): `Socket_HandR/L`, `Socket_Head`, `Socket_Back`, `Socket_Belt`, `Socket_Neck`, `Socket_Mouth` (Breath VFX), `Socket_Pet`.

**Three species knobs, in order of cost.** (1) `spc_scale`: a uniform scale on the armature root (0.70 Halfling → 1.12 Orc). (2) Per-bone-group scale, every factor within ±15% (non-uniform scale breaks at joints beyond that). (3) One `spc_*` shape key per species on the shared body topology, exported as a glTF morph target and **transferred to every skinned gear mesh** at build time (Surface Deform bound to the body at rest, `modifier_apply_as_shapekey` per key) so gear never clips. Separate meshes only for what the body cannot morph into: ears, tusks, beard, horns, crest, tail, claws, bare feet.

**Rigid props keep world size.** A socket child inherits its bone's scale, so the attach code multiplies the prop by `1 / (spc_scale × handScale)`: a Halfling holds a full-size shortsword.

**Tint.** One body material per species with a mask texture (R skin, G belly/secondary, B horn/nail/metal); per-hero colour as three uniforms on a cloned material. Gear uses the same scheme.

**The animation set every species shares** (authored once on the human-proportioned rig, exported in Actions mode from NLA tracks, retargeted by name; `11-ART-PIPELINE.md` §3 owns the list): `Idle, Walk, Run, Attack_Light, Attack_Heavy, Attack_Dual, Shoot, Cast, Guard, Hit, Dodge, Downed, Revive, Victory, Defeat, Interact, SitRest` — **17 shared clips**. **Two species specials**: `Breath` (Draconid; keys the tail and the `Socket_Mouth` flare) and `Roar` (Orc; once, when Bloodrage first engages). **Every clip is authored once and retargeted**; every other species difference is bone scale, never a clip edit. Hips position tracks are multiplied by leg factor × `spc_scale` at load so feet stay planted. Tails, ears, beards and long hair are not keyframed: a 4-link spring chain in the engine gives follow-through on every clip.

**Face presets** are data: each species' record `content/species/<id>.json` carries its 3 presets (18 in all) as weights over the 12 shared `face_*` keys plus part choices (horn set, tusk size, beard style). Skin, hair and eyes are tints.

**Export** from `tools/blender/hero/build_body.py --species <name>` (renders and builds under `art/`, `.glb` to `client/public/models/hero/` per `11` §7): `rig_base.glb` once (armature + body + the 17 shared clips + 2 species specials), `spc_<species>_<part>.glb` per extra mesh, four turntable PNGs and one 200 px thumbnail, which the agent reads before the build counts as done. Gear exports as `gear_<family>_<slot>_<tier>[_<species>].glb`, with `_drc`, `_orc` and `_elf` suffixes only where §3 says a variant exists. Budgets: hero with gear ≤ 15 k triangles, species parts ≤ 1.5 k of that, 4 bone influences, one 1024² atlas per body.


**As built (Phase 5, 2026-10-28).** The species keys and the twelve face keys are built procedurally from the skeleton
(`tools/blender/hero/build_species.py`) on both body frames (broad and slight — D-100); the round ears are folded flat by
the Elf, Orc and Draconid keys, so the ear parts need no hidden region. **Bone scales are absolute**: each bone's scale =
`root` × its group factor (an Orc's hands 1.12 × 1.15 = 1.29), never compounded down the chain. The parts are the
names in `body.parts` plus shared hair styles (crop, shaggy, long, tied, swept, bun) and brows (soft, heavy, arched); a
part carries only the species keys of the species that may wear it. The three presets per species (the names in §3)
live in `client/public/models/hero/manifest.json` with their face weights, parts and tints (skin, hair or horn, eye);
a hero's look is saved as `{ frame, skin, face, hair }` (D-105). Not reached by the script (`art/LOG.md`): freckles,
scars and painted brows (no decals in the palette material), the Draconid's slit pupils, scale texture, belly plates and
heel raise.

---

## 6. Creation screen copy

Each card: the name, a one-line blurb, three pro chips, three con chips (three words or fewer each), and a "best with" row drawn from §4.

| Species | Blurb | Pro chips | Con chips |
|---|---|---|---|
| **Human** | Emberfall's own. Learns everything a little faster and has no weak spot. | +10% all XP · No weakness · Extra loadout | No big stat · No darkvision · Nothing flashy |
| **Dwarf** | Forge-row's finest. Cannot be moved, sees in the dark, repairs anything. | Toughest body · Darkvision · Can't be pushed | Slow stride · Less Mana · No longbows |
| **Elf** | From the gloam-woods. Fastest on the timeline and first to notice anything. | Most turns · Darkvision · Finds traps | Low HP · Hates metal armor · Fear bites |
| **Orc** | Marcher clan-folk. Hits hardest, and hardest of all when hurt. | Biggest hits · Rage under half · Hide +5 Def | Noisy · Shops +10% · Blinded by light |
| **Halfling** | Barge-folk salvagers. Lucky, small, and no lock has met them. | Crits and loot · Big things miss · Opens anything | Weak arms · Light pack · No tower shield |
| **Draconid** | The scaleborn. Armored skin that grows, and one breath of fire per fight. | Living armor · Fire breath · Burn immune | Frost ×1.25 · −10% XP · Slow |

---

## 7. Open questions for James

1. ~~**Draconid tail — keep or cut?** The tail is the species' best 200 px read, but it costs a `_drc` port on every Legs mesh in four families plus skirted Robe Chests. *Cheap middle:* author every Legs piece with the port already in it and cover it on the other five species with one shared `belt_flap` mesh. Recommended: keep the tail, do the flap.~~ *Checkpoint 1 (D-099): keep the tail and do the flap — every Legs piece carries the port, and one shared `belt_flap` covers it on the other five species.*
2. ~~**Human: Adaptable or a seventh free creation point?** A point is simpler and shows on the card at once; Adaptable is felt later and keeps "generalist, not better" true. Recommended: keep Adaptable.~~ *Checkpoint 1 (D-099): keep Adaptable, as built.*
3. ~~**Hero Accuracy by light band.** §4.2 lists only the monsters' bonus; the Orc and Draconid "Dark-steady aim" needs a hero-side penalty to ignore. Proposed: heroes −5 pp Accuracy in Dark, −10 pp in Pitch, added to the §4.2 table.~~ *Checkpoint 1 (D-032): yes — heroes take −5 pp Accuracy in Dark and −10 pp in Pitch (built in `tuning.json`); Orcs and Draconids ignore it.*
4. ~~**Halfling heavy-weapon rule: do bows count?** This file says no (weight 1,400 only), which keeps the Halfling Ranger a ◎. If bows count, Ranger drops to ○.~~ *Checkpoint 1 (D-032): no — only 1,400-weight weapons; bows and staves are exempt, so the Halfling Ranger stays ◎.*
5. ~~**Two builds per species (A / B bodies)?** The creation line has no build choice. A second build doubles shape-key transfer and face work. Recommended: one build per species at launch with `body_lean` / `body_heavy` / `body_muscle` sliders; revisit after the first playable.~~ *Checkpoint 1 (D-099): one build per species at launch, with the `body_lean` / `body_heavy` / `body_muscle` sliders; revisit after the first playable.*
6. ~~**Dwarf and Elf share Darkvision verbatim.** Differentiate (Dwarf: only Pitch → Dark and Dark → Shadowy; Elf: every band) or keep identical? Recommended: identical at launch; one rule to teach.~~ *Checkpoint 1 (D-099): identical at launch — one rule to teach, as built.*
7. ~~**A seventh species later?** **Revenant** (undead, raised in the Crypts): +Will, +End, −Vit, −Luck; Poison and Bleed immune, no HP regen at rests, Holy ×1.5, Vitality never trains; the cheapest body on the rig (Human proportions, a tint, a `spc_revenant_gaunt` key) but awkward lore for a Gravehollow hero. **Beastkin** (fur, muzzle, claws): +Per, +Agi, −Wis, −End; Keen Senses, Fire ×1.25, no Plate; the most expensive body (muzzle, digitigrade legs, tail, fur cards — nearly a variant rig). If a seventh is wanted: Revenant first.~~ *Checkpoint 1 (D-099): not now — a seventh species goes to the post-launch backlog (`14-IDEAS.md`), Revenant first if one is ever made.*
8. ~~**Learning-rate spread.** Human +10% and Draconid −10% put two players in one party 22% apart in time-to-level. Fine for co-op (credit is by participation, nothing is level-gated), or cap the spread at ±5%?~~ *Checkpoint 1 (D-099): keep ±10% with no cap, as built — it is the Human's pro and the Draconid's con, and each hero's equal share of battle XP takes their own bonus (D-096).*

---

*Numbers here feed `content/species/<id>.json` (modifiers, traits, bone scales, shape keys, palettes, face presets) and the Blender build scripts under `tools/blender/hero/`. Decisions are logged in `13-DECISIONS.md` (D-018 the six species; D-032 proposed for this file).*
