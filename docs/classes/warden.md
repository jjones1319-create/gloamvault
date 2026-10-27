# Warden — class sheet

*Last updated 2026-10-26 · rev. 1 · numbers are tuning starting points*

*Every number below (costs, multipliers, durations, the Cellars monster stats in §9) is a starting point for the simulator and the balance runner, not a commitment. Rules referenced are `03-GAME-DESIGN.md` (§2 stats, §3 timeline, §5 level-by-use, §6 gear, §7 skills). Status numbers quoted in skill lines (Bleed 25% of the applying hit per turn for 3 turns, ignores Defense · Poison 3% of max HP per turn, ignores Defense · Weaken −20% Attack · Fortify +20% Defense · Mark +20% damage taken · Slow ×0.67 Speed · Haste ×1.5 · Daze −500 energy · Petrify −1,000 energy) belong to `content/statuses/<id>.json` (`03` §3.5 is the table) and are repeated here only so the lines read on their own.*

---

## 1. Identity

The Warden is the wall the party stands behind. In plate, with a shield or a long spear, the Warden decides who the monsters hit — by Taunting, by Intercepting, by simply being the only thing in the front row worth swinging at. On the timeline the Warden is slow (Speed ~80 at creation against a rat's 130), so each of its turns is a big, deliberate decision: Slam and Daze the thing that is about to act, or shout and pull every enemy's attention for two turns. A good Warden counts enemy turns between its own and spends each turn removing one of them. It kills things last, and it is the reason the Ranger and the Shade are still alive to kill them.

| Pros | Cons |
|---|---|
| Highest Defense and HP of the four (Plate + End + Vit); Block halves a physical hit 15–35% of the time | Speed 81 at creation: a rat gets 1.6 actions per Warden action |
| Controls targeting: Taunt (Provoke, Challenge All), Intercept, Formation Drill protect the back row | Lowest damage multipliers; a Tier I Slam does ~46 where a Blade's Twin Cut does ~54 |
| Daze and push-back skills (Shield Slam, Shove, Sentinel's Sweep) delete enemy turns from the timeline | Plate is weak to Pierce at the joints — ghoul claws and bone-knight lances hurt more than they look |
| Party buffs and cleanses from Warcry need no weapon and no wear | Almost no way to hit the back row except the spear (Reaching Thrust) — spider spitters and brine hags outlast it |
| Spear build reaches the back row and counters; shield build soaks and reflects | Plate costs the most to repair and carries the most weight (Str relieves both, slowly) |

---

## 2. Numbers at creation

| Item | Value |
|---|---|
| Attribute modifiers | +1 Strength · +2 Endurance · +1 Vitality (plus species, plus 6 free points) |
| Pool | **Stamina** = 30 + 3 × End → **66** at End 12 |
| Armor family | **Plate** (metal ladder Copper → Starmetal); speed penalty **−20**, relieved 1 point per Strength point above the set's requirement (Crude Plate requires Str 10) |
| Allowed weapons | Sword (1h · Slash · normal 1,000) · Mace (1h · Blunt · normal 1,000) · Axe (1h · Slash · normal 1,000 · +Crit Damage) · **Spear** (2h · Pierce · normal 1,000 · **reach**) · Off hand: Buckler (Block 15%, Str 6), Kite shield (Block 25%, −5 Speed, Str 11), Tower shield (Block 35%, −10 Speed, Str 15) — numbers per `08` §2.3 |
| Starter kit (F-grade, Crude; `08` §12) | Copper Shortsword (Attack 10, req Str 8) · Pine Buckler (Block 15%) · Copper Helm / Breastplate / Greaves / Sabatons / Gauntlets (Defense 3 / 8 / 5 / 2 / 2 = 20) · Ring of Vigor (+6 HP) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg |
| Derived at creation (class modifiers only, all else 10) | HP 116 (110 + 6 from the ring) · Attack 38 (10 + 2 × 11 + 2 × 3 spare Str over the Shortsword's req 8) · Defense 32 (20 + 12) · Speed **81** (100 − 20 + 1) · Stamina 66 · Crit 5% · Crit Damage 152% · Accuracy 90% · Dodge 0% · Resistance 1% · Carry 53 kg · Detection 10 |
| Recommended Tier I starter picks | **Shield Slam** (Bulwark) · **Provoke** (Warcry) · **Brace** (Bulwark) — damage, targeting control, survival; swap Brace for **Reaching Thrust** if the player takes the spear |

Shield-and-sword is the default (the Kite shield is the first Blacksmith purchase for a shield Warden). Spear is a real second build from level 1 (Vanguard needs it), not a late unlock.

---

## 3. The Ultimate — *The Gate Holds*

| Field | Value |
|---|---|
| Unlock | Tier III (level 12); Skill Hall 1.0 R or the first zone-boss Tome. Sits on its own button, outside the 4 + 2 loadout (§3.2 lists Ultimate as its own action) |
| Cost | 100 Momentum, no Stamina |
| Weight | 1,000 |
| Target | Self, party, all enemies — never misses |
| Effect | Taunt every enemy 2 turns · you gain Shield = 40% max HP and Fortify 2 turns · every ally gains Shield = 15% of **your** max HP · 2.0× Blunt to every front-row enemy, Daze 50% |
| Mastery (rank 10 bonus) | Shields last 3 turns; Daze 100% on fodder |

The whole fight looks at the Warden for two turns, and the Warden is wrapped in half its HP of absorb. In co-op it is the "reset" button when the front row is collapsing.

---

## 4. The three schools

*Reading the tables.* Cost is Stamina. Weight is energy subtracted after the action (light 800 · normal 1,000 · heavy 1,400). Multipliers are of Attack. "Front" = the enemy front row; "any row" = reach or shout. Each Tier II–V skill names exactly one Tier N−1 skill of its own school as prerequisite. Rank 1–10 grows by use (+4% effect, −2% cost per rank); Mastery is the rank-10 line. Insight sweet spots by tier (enemy level ≈ tier × 6): Tier II sparks best at L9–15 (the Crypts, the Vault), Tier III at L15–21 (the Fungal Deep), Tier IV at L21–27 (Emberforge). **Monster techniques** only Insight while the named monster uses the move in the fight; proposed flat 10% per witnessed use with pity at 10, not the S-curve (see §11).

### 4.1 Bulwark — shield, block, damage soak

*The hit that lands on you is a hit that did not land on them.* Requires a shield for Shield Slam, Shove, Spiked Rim, Crushing Rebuke; the rest work with any kit.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Shield Slam | Active | 10 | 1,000 | Single front | 1.3× Blunt; 30% Daze (−500 energy) | — | Daze 60% |
| I | Brace | Active | 8 | 800 | Self | Fortify (+20% Def) 2 turns; Block +20% until your next turn; +10 Momentum | — | Also Fortifies the lowest-HP back-row ally |
| I | Wall Stance | Passive | — | — | Passive | +5% Block; a successful block restores 5% Stamina; your armor wears 20% slower | — | +10% Block |
| II | Shove | Active | 14 | 1,000 | Single front | 1.4× Blunt; swaps the target with an enemy in the other row (pulls a spitter forward, pushes a bruiser back); +200 energy push-back | Shield Slam | Daze 40% on the swapped-in enemy too |
| II | Intercept | Active | 14 | 800 | Ally | For 2 turns, single-target attacks aimed at that ally hit you instead (front → back works); you take them at −10% | Brace | 3 turns; also covers corridor traps that trigger on that ally |
| II | Spiked Rim | Passive | — | — | Passive | A successful block reflects 15% of the halved damage as Blunt to the attacker | Wall Stance | Reflect 30% |
| III | Crushing Rebuke | Active | 22 | 1,000 | Single front | 2.0× Blunt, +100% of all damage you blocked since your last turn (cap +2.0× Attack) | Shove | Cap +3.0× |
| III | Bone Knight's Stand | Active | 24 | 1,400 | Self | **(monster technique: bone knight)** Until your next turn: immune to Daze, Stun, Grab; Block 100% against the first 2 physical hits; reflect 30% of blocked damage | Intercept | 3 hits; reflect 50% |
| III | Unbreakable | Passive | — | — | Passive | Once per fight, a hit that would down you leaves you at 1 HP and grants Shield = 20% max HP | Spiked Rim | Shield 30% and cleanse all debuffs |
| IV | Rolling Bastion | Active | 28 | 1,000 | Self + ally | Swap rows with the chosen ally as part of the action; both gain Fortify 2 turns; your next 2 incoming hits are blocked automatically | Crushing Rebuke | Weight 800 |
| IV | Rampart | Active | 30 | 1,000 | Party | Every ally gains Shield = 20% of your max HP for 2 turns; you gain Regen 5% max HP for 2 turns | Bone Knight's Stand | Shields also grant Fortify |
| IV | Iron Vigil | Passive | — | — | Passive | While any enemy is Taunted by you: +15% Defense and +5 extra Momentum when hit | Unbreakable | +25% Defense |
| V | Mountain's Verdict | Active | 40 | 1,400 | Single front | 3.2× Blunt; Petrify 1 turn (−1,000 energy) if the target is below 30% HP (bosses: Daze instead) | Rolling Bastion | Threshold 40% |
| V | Aegis of the Keep | Active | 45 | 1,400 | Party | For 3 turns, 50% of all damage to allies is redirected to you; you take −30% damage for the duration | Rampart | 4 turns |
| V | Living Wall | Passive | — | — | Passive | Block applies to elemental attacks at half your Block chance; every block +5 Momentum | Iron Vigil | Full Block chance vs elements |

### 4.2 Vanguard — spear, formation, reach, counter

*Reach lets the slow man choose the fight.* Spear skills (Reaching Thrust, Sweeping Spear, Pinning Strike, Skewer) require the spear; the formation and counter skills work with any kit.

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Reaching Thrust | Active | 10 | 1,000 | Single any row | 1.3× Pierce; hits the back row from the front | — | Also applies Mark 1 turn |
| I | Counter Stance | Active | 9 | 800 | Self | Until your next turn, the first melee attacker to hit you takes a 1.0× counter-hit | — | 2 counters |
| I | Formation Drill | Passive | — | — | Passive | Allies in your row +5 Defense; the party's row swaps cost 200 instead of 400 | — | +10 Defense |
| II | Sweeping Spear | Active | 15 | 1,000 | Enemy front row | 0.9× Pierce each; 20% Daze | Reaching Thrust | Daze 40% |
| II | Punish | Passive | — | — | Passive | Counter-hits deal +50% and apply Weaken 1 turn | Counter Stance | Weaken 2 turns |
| II | Lockstep | Active | 12 | 800 | Ally | Swap rows with the chosen ally; both gain Fortify 1 turn; the swapped ally +10 Momentum | Formation Drill | Both gain Shield = 10% your max HP |
| III | Pinning Strike | Active | 20 | 1,000 | Single any row | 1.9× Pierce; Root 2 turns (cannot swap rows, cannot flee) | Sweeping Spear | Root 3 turns; +10% damage per turn of Root remaining when struck |
| III | Spearwall | Passive | — | — | Passive | Any enemy that enters the front row (swap, pull, charge) takes a free 1.2× Pierce hit | Punish | 1.6× |
| III | Phalanx | Active | 22 | 1,000 | Party front row | Front-row allies gain Shield = 10% of your max HP and +15 Defense for 2 turns; you enter Counter Stance | Lockstep | 3 turns |
| IV | Sentinel's Sweep | Active | 32 | 1,400 | All enemies | **(monster technique: vault sentinel)** 1.4× Blunt to every enemy in both rows; −300 energy to each; Daze 30% | Pinning Strike | Daze 50% |
| IV | Unyielding Point | Passive | — | — | Passive | Counter-hits are 1.5× instead of 1.0× and can crit; you start every fight in Counter Stance | Spearwall | Counter-hits also Root 1 turn |
| IV | Bannerhold | Active | 30 | 1,000 | Party | All allies +10 Speed for 3 turns and +20 Momentum now | Phalanx | +15 Speed |
| V | Skewer | Active | 40 | 1,400 | Single + behind | 3.0× Pierce to the target and 1.5× to the enemy in the other row behind it; Bleed 3 turns on both | Sentinel's Sweep | 3.5× / 2.0× |
| V | Immovable | Passive | — | — | Passive | Immune to Grab, Root, Web and energy push-back; allies in your row are immune to Fear | Unyielding Point | Allies in your row immune to Grab too |
| V | Warden of the Pass | Active | 45 | 1,000 | Self | For 3 turns every single-target enemy action aimed at an ally in your row is intercepted by you and countered at 1.5× | Bannerhold | Counters at 2.0× |

### 4.3 Warcry — shouts: taunts, party buffs, enemy debuffs

*A shout hits everyone at once and costs no weapon wear.* Shouts are not attacks: they never miss, never wear a weapon and cannot be Dodged; they can be Silenced (until Voice of Iron).

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Provoke | Active | 8 | 800 | Single any row | Taunt 2 turns (must target you); +10 Momentum | — | Taunt 3 turns |
| I | Rallying Shout | Active | 12 | 1,000 | Party | Allies +10% Attack for 2 turns | — | +15% Attack and +5 Momentum each |
| I | Loud Voice | Passive | — | — | Passive | Warcry skills cost −20%; your Taunts last +1 turn | — | Shouts give you +10 Momentum |
| II | Challenge All | Active | 16 | 1,000 | All enemies | Taunt 1 turn on every enemy; you gain Fortify 1 turn | Provoke | Taunt 2 turns |
| II | Second Wind | Passive | — | — | Passive | Whenever you shout, allies below 50% HP gain Regen 5% max HP for 2 turns | Rallying Shout | Threshold 70% |
| II | Dread Bellow | Active | 15 | 1,000 | All enemies | Weaken 2 turns; Fear 1 turn on fodder (50% chance to Guard instead of acting, `03` §3.5) | Loud Voice | Fear also on elites |
| III | Thunderous Taunt | Active | 24 | 1,000 | All enemies | Taunt 2 turns and 30% Daze on every enemy; +20 Momentum to you | Challenge All | Daze 50% |
| III | Stand Fast | Active | 20 | 1,000 | Party | Cleanse Fear, Slow, Weaken and Curse from every ally; Fortify 2 turns | Second Wind | Also cleanses Blind and Silence |
| III | Voice of Iron | Passive | — | — | Passive | Your shouts cannot be Silenced; enemies Taunted by you deal −10% damage to you | Dread Bellow | −20% |
| IV | Mocking Roar | Active | 28 | 800 | All enemies | Taunt 2 turns and Mark 1 turn (+20% damage taken) on every enemy — the party's damage window | Thunderous Taunt | Mark 2 turns |
| IV | Warhorn | Active | 32 | 1,000 | Party | Haste (×1.5 Speed) 2 turns to every ally | Stand Fast | Also +10 Momentum each |
| IV | Ironlung | Passive | — | — | Passive | Shouts have weight 800 and give every ally +10 Momentum | Voice of Iron | +15 Momentum |
| V | Roar of Ruin | Active | 40 | 1,000 | All enemies | 1.8× Blunt (sonic, counts as physical, never misses) to every enemy; Stun 1 turn on Dazed targets | Mocking Roar | 2.2× |
| V | Oath of the Vault | Active | 50 | 1,400 | Party | For 3 turns allies cannot drop below 1 HP and gain Fortify; when it ends you take 15% max HP | Warhorn | 4 turns; no self-damage |
| V | Legend's Voice | Passive | — | — | Passive | Momentum gain +25% for the whole party; your Ultimate also Weakens every enemy 2 turns | Ironlung | +40% |

---

## 5. Field-skill affinities

| Field skill | Starting rank bonus |
|---|---|
| Lockpicking | 0 |
| Trap Disarm | 0 |
| Foraging | 0 |
| Field Repair | **+2** (the plate-wearer carries the hammer) |
| First Aid | **+2** (the one still standing drags the others out) |
| Haggling | 0 |
| Cooking | 0 |
| Cartography | 0 |

---

## 6. Three recommended loadouts

| Loadout | Actives (4) | Passives (2) | Pet stance | Play pattern |
|---|---|---|---|---|
| **Shieldwall** (L1–12, shield) | Shield Slam · Brace · Provoke · Intercept | Wall Stance · Loud Voice | Mend (Moss Tortoise) | Provoke the hardest hitter, Slam whoever is next on the strip to Daze it off the timeline, Intercept for the Ranger when a spitter shows up; Brace when Stamina runs dry. Stamina-neutral over a fight. |
| **Spear of the Line** (L5+, spear) | Reaching Thrust · Sweeping Spear · Counter Stance · Lockstep | Formation Drill · Punish | Fierce (Cellar Hound) | Open with Counter Stance, let the front row hit you, then Sweep the front and Thrust the back-row caster the Blade cannot reach. Lockstep to pull a wounded Blade back and put yourself forward. |
| **Bannerman** (L20+, co-op support) | Thunderous Taunt · Warhorn · Stand Fast · Rampart | Iron Vigil · Ironlung | Guard (Brine Crab) | Every shout now feeds the party Momentum; Taunt, Warhorn, and the strikers take three turns to your one. Rampart before a boss phase; Stand Fast the turn after the brine hag Curses. Your own damage is the basic attack between shouts. |

---

## 7. How it grows by use

| Attribute | Tagged by (per §2.1 / §5.2) | Typical Warden rate |
|---|---|---|
| **Endurance** | taking hits (armor-absorbed counts), blocks, marching over 50% carry | fastest — 3–5 tags per fight from the front row |
| **Vitality** | damage taken per 10% of max HP, surviving under 25% HP | fast |
| **Strength** | landing melee hits, forcing doors and chests | steady — one tag per basic/skill hit |
| **Willpower** | resisting a status, standing against Fear | moderate; Taunt-holders get hit with Dirty Tricks and hag Curses often |
| **Perception / Agility** | — | barely; the Warden dodges and spots little |
| **Luck** | not trainable | — |

**A level-20 Warden** (160 skill ranks, ~1,000 hits taken, soft caps creation + 40) looks like: Str 18 · Agi 10 · Vit 18 · End **25** · Wis 11 · Per 11 · Will 14 · Luck 10. In C-grade Steel Plate (Defense ~49 + 25 = 74; damage taken ×0.57), Speed 100 − 20 + 8 relief = **88** (the plate penalty is mostly gone by then), Stamina 105, HP 30 + 126 + 60 = 216. Eleven skills at rank 8+, two at rank 10 with Mastery; Tier IV open through Insight against Emberforge's L21–27 forge-golems. The level-20 Warden is still slow, but every turn it takes removes two enemy turns.

---

## 8. Worked example — floor 3, level 4, the Cellars

**Setup.** 3-player party; only the Warden's and the monsters' lines are shown, allies' turns are elided (…). Warden L4: Str 12 · Agi 10 · Vit 12 · End 14 · Will 11; Common (E) Bronze Sword Attack 14 (req Str 10); Crude Plate Defense 20; Crude Kite Shield Block 25%. Derived: **Attack 42** (14 + 2 × 12 + 2 × 2 spare Str) · **Defense 34** · HP 126 · Speed **82** · Stamina 72. Loadout Shieldwall. Jitter ignored.

**Monsters (L4, placeholder stats pending `06-MONSTERS.md`).** Giant Rat — front, HP 38, Def 6, Speed 130, Attack 18, Bite 1.0× Pierce. Cellar Spider — back, HP 44, Def 10, Speed 115, Attack 20, Web Spit (Web 1 turn, either row) / Venom Bite 0.9× + Poison 3 turns. Grinning Cutpurse — front, HP 56, Def 14, Speed 105, Attack 24, Slash 1.0× / Dirty Trick (Blind 1 turn).

**Initiative (0–400):** Rat 250 · Spider 120 · Cutpurse 300 · Warden 380 · pet 60.

| Tick | Actor | Action · cost | Arithmetic | Result |
|---|---|---|---|---|
| 6 | Giant Rat (1,030) | Bite on Warden · weight 1,000 | 18 × 1.0 × 100 / (100 + 34) = 13.4 × variance 0.95 = **13**; Block roll fails | Warden 126 → 113 · Momentum 10 |
| 7 | Cutpurse (1,035) | Slash on Warden · 1,000 | 24 × 100 / 134 = 17.9; Block (25%) succeeds → halved → **9** | Warden 113 → 104 · Momentum 20 · Wall Stance +5% Sta |
| 8 | Spider (1,040) | Web Spit on the back-row ally | — | ally Webbed 1 turn |
| 8 | **Warden** (1,036) | **Shield Slam** on Cutpurse · 10 Sta · 1,000 | Damage = Attack 42 × skill 1.3 × (1 + 0) × element 1.0 × 100 / (100 + 14) × crit 1.0 × variance 0.96 = 54.6 × 0.877 × 0.96 = **46**; Daze roll (30%) succeeds | Cutpurse 56 → 10, pushed −500 (acts at tick 22 instead of 17) · Sta 72 → 62 · Momentum 40 · accumulator 36 |
| 9 | Pet, allies | … | — | +10 Momentum (ally actions) |
| 14 | Giant Rat (1,070) | Bite on Warden | 13 | Warden 104 → 91 · Momentum 60 |
| 17 | Spider (1,075) | Venom Bite on Warden | 20 × 0.9 × 100 / 134 = 13.4 → **13** + Poison (3 turns, 3% of max HP ≈ 4/tick, ignores armor) | Warden 91 → 78 |
| 20 | **Warden** (1,020; +7 Sta regen) | **Basic attack** on the Dazed Cutpurse · free · 1,000 | 42 × 1.0 × 100 / 114 × 0.95 = **35** | Cutpurse dead (10 HP) · Sta 69 + 15% = 72 · Momentum 80 · Str tag, End tags ×3 |

Twelve ticks pass between the Warden's two actions; the Rat gets 1.6 of its own in that window. That is the class in one table: it absorbs 48 damage with Defense 34 and a block, deletes the Cutpurse's turn with a Daze, and leaves the Rat and the Spider for the two faster allies. With Provoke on the Rat at tick 20 instead, the Ranger would never have been bitten this fight.

---

## 9. Visual brief — the Warden gear set (shared humanoid rig, Blender)

- **Silhouette:** a trapezoid — wide pauldrons sloping into a tall kite shield on the left, a sloped sallet-style helm with a short crest; the broadest, squarest shape of the four classes.
- **Modular meshes (five armor pieces + weapons):** Helmet (sallet, open-face variant for Orc and Draconid) · Chest (breastplate + pauldrons + a short tabard panel, tabard is a separate cloth mesh so the Draconid tail split works) · Legs (tassets over a plate skirt, split at the back) · Boots (greaves + sabatons, one piece) · Gloves (gauntlets with a flared cuff) · Main-hand sword / mace / axe on the hand bone · Spear as a two-hand pose set · Buckler / Kite / Tower shields on the forearm bone (three scales of one mesh family).
- **Palette:** slate blue (plate base tint) · bone-white tabard · oxblood straps and crest · metal: **gunmetal**.
- **Must read at 200 px:** the shield outline, the helm crest, and the tabard's two-tone split; the Warden must be identifiable from the silhouette alone when four heroes stand in the fixed-camera room.
- **F-grade vs S-grade (same mesh set):** F (Crude/Copper) — dull matte plate, visible rivets, no crest, rawhide straps, a plain wooden kite shield. S (Legendary/Adamantine) — mirror-polished plate with an etched trim pass on chest and pauldrons, a full crest, gold-filled edge lines, a shield boss with an emissive rune. Material and trim textures change; the mesh set does not.
- **Species notes:** Human baseline. Dwarf: bone scale 0.85 height / 1.15 width — pauldrons must not clip the beard (shape key *beard_clear*). Elf: 1.05 / 0.9, narrower helm via *helm_narrow* key. Orc: 1.10 / 1.2, open-face helm variant, tusk clearance. Halfling: 0.70 height, helm scaled 0.8 on the head bone, shield capped at 70% scale so it does not cover the body. Draconid: tail cutout on the leg skirt and tabard, horn sockets on the helm, open-face variant with a snout key.

---

## 10. Open questions (for James)

1. **Spear from level 1?** The sheet lets a Warden start with the spear (Vanguard). Keep both starts, or make the shield the only starter and sell the spear at the Blacksmith for 0.05 R?
2. **Ultimate button.** The Ultimate is written as a fifth button outside the 4 + 2 loadout (it is its own action in §3.2). Should it instead occupy one of the four active slots to keep the thumb bar at four?
3. **Monster-technique Insight rule.** Bone Knight's Stand (Tier III) and Sentinel's Sweep (Tier IV) come from Gravehollow monsters at L8–14, which the normal S-curve (peak at tier × 6 = 18 / 24) would make nearly unlearnable there. Proposed: a flat 10% per witnessed use, pity at 10 — confirm, or move both techniques to later dungeons' monsters?
4. **Plate relief rate.** One Speed point per spare Strength point means the −20 penalty is mostly gone by Str 25. Fast enough, or should Plate relief be 2 per point so a Dwarf Warden feels normal-speed by level 10?
5. **Oath of the Vault** (Tier V) makes the party unkillable for 3 turns; is "cannot drop below 1 HP" acceptable on Nightmare, or should it cap at one trigger per ally?
