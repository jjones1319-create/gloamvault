# Arcanist — class sheet

*Last updated 2026-10-28 · rev. 4 (Phase 7 class-damage pass: the tuned multipliers in §4 and "As tuned" under it) · rev. 3 (Phase 7: Tiers IV–V built — Tier V designed and locked until Segment 3; the monster techniques learned only by witnessing, a flat 10% per witnessed use and certain by the 10th; the stale Blacksmith and sweet-spot lines fixed — D-028, D-099; "As built (Phase 7)" under §4) · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26 · numbers are tuning starting points*

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
| F-grade starter kit (`08` §12) | Pine Wand (focusPower 9) · Pine Orb (off-hand focus: +4 spell Attack, +5 Mana) · Burlap Cowl · Burlap Robe · Burlap Leggings · Burlap Slippers · Burlap Wraps (Defense 4) · Ring of the Mind (+2 spell Attack) · 2 Small HP Potions · 2 Torches · 1 Repair Kit · 1 Bandage · one F-grade pet egg. The town sells no weapons (D-099): a player who wants the two-handed build finds a Pine Staff in a chest or a drop. |
| Recommended Tier I starter picks | **Ember Lance** (Evocation) · **Frostbolt** (Rime) · **Arcane Ward** (Arcana). One damage-and-Burn, one damage-and-Chill, one Shield: every school's line is open on floor 1. |

Free-point advice shown on the creation card: +3 Wisdom, +2 Willpower, +1 Vitality (a 15 / 13 / 11 Arcanist holds casts 39% of the time and has 110 HP).

---

## 3. The Ultimate

**Prismatic Ruin** — Tier III · 100 Momentum · weight 1,400 but **cannot be interrupted** · never misses.

All enemies, both rows, take **2.4× spell Attack** as the element each one is weakest to among Fire, Frost and Lightning (if a target has no weakness among the three, Fire; immunities are respected — the sim picks the best legal element per target). Each target is then marked with **Burn 2, Chill 1 and Shock 2**. The Arcanist refunds **30% of max Mana** on resolution. Momentum × (1 + 1% × (Will − 10)) means a Will-20 Arcanist charges it in about four own actions plus incoming hits.

---

## 4. The four branches

> **Re-cut in Phase 18 (D-154 — James, 2026-10-30; built 2026-11-02):** four branches — **Fire · Frost · Storm · Summoning** — instead of the three schools of rev. 1 (Evocation, Rime, Arcana). Evocation's fire half is Fire; its lightning half, with Quicken, Blink Step, Mass Haste and Paradox, is Storm; Rime with Time Slip is Frost; Arcana's binding arts (the Wards, Dispel, the lantern, the Mana economy) with **six summons** are Summoning. Rewind and Frozen Tomb are gone; seventeen rows are new (marked *new*). **These tables are written from the content** (`tools/content/gen-class-arcanist.ts` → `content/skills/arcanist/`): the content is the source for this class. Every skill keeps its tier and one prerequisite in its branch (03 §7.1); a skill costs points by tier (03 §7, D-153).

### 4.1 Fire — *Fire: the room is the target. Burn down a row, make the next hit bigger; the biggest single numbers the class has.*

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Cinder Snap *(new)* | Active | 7 Mana | 800 | Single enemy, either row | 0.8× Fire to one enemy, either row; Burn 1. Light cast. | — | Burn 2. |
| I | Ember Lance | Active | 10 Mana | 1,000 | Single enemy, either row | 1.1× Fire to one enemy in either row; Burn 3 turns. | — | Burn 4 turns. |
| I | Kindling | Passive | — | — | — | Fire and Lightning skills +8%; the first Evocation cast of each fight costs 0 Mana. | — | +12%. |
| II | Firewave | Active | 16 Mana | 1,400 | Front row enemies | 0.9× Fire to every front-row enemy; Burn 2 turns. Heavy cast: declared at 1,000 energy, resolves 400 later, and a hit in the window can cancel it. | Ember Lance | 1.0× each. |
| II | Flame Ward *(new)* | Active | 14 Mana | 1,000 | Single ally | Shield 15% of the target’s max HP for 2 turns; while it holds, a melee attacker whose hit lands on the ally gets Burn 1. | Cinder Snap | Shield 20%. |
| II | Backdraft | Passive | — | — | — | When a Burning enemy dies, its Burn jumps to a random living enemy and you gain +10 Momentum. | Kindling | +15 Momentum. |
| III | Heat Haze *(new)* | Active | 18 Mana | 1,000 | All allies | The air shimmers: every ally gains +15% Dodge for 2 turns. | Flame Ward | +20% Dodge. |
| III | Meteor | Active | 26 Mana | 1,400 | All enemies | 1.2× Fire to every enemy in both rows; Burn 3 turns; any target already Burning is also Dazed (−500 energy). Heavy cast. | Firewave | 1.35× each. |
| III | Ember Heart *(new)* | Passive | — | — | — | Fire skills +8%; Burn you apply lasts +1 turn. | Backdraft | +12%. |
| IV | Hag’s Cauldron *(monster technique)* | Active | 30 Mana | 1,400 | Single enemy, either row | 2.6× Fire to one enemy in either row; Poison 3 turns (ignores armor); Weaken 2 turns. Heavy cast. Monster technique: learned only by witnessing a Brine Hag use it. | Heat Haze | 3.0×. |
| IV | Pyroclasm | Active | 36 Mana | 1,400 | All enemies | 1.5× Fire to every enemy in both rows; every Burn on them is consumed and deals all its remaining ticks at once. Heavy cast. | Meteor | 1.7× each. |
| IV | Ashen Mantle *(new)* | Passive | — | — | — | Fire resistance +25%; your Fire damage heals you for 5% of what it deals. | Ember Heart | Heals 8%. |
| V | Phoenix Crown *(new)* | Active | 46 Mana | 1,400 | All enemies | 1.6× Fire to every enemy in both rows; Burn 3. Heavy cast. | Pyroclasm | 1.8× each. |
| V | Sunflare | Active | 48 Mana | 1,400 | All enemies | 2.0× Fire to every enemy in both rows; Burn 4 turns; Blind 2 turns; your next action weighs 800 whatever its own weight. Heavy cast. | Pyroclasm | Blind 3 turns. |
| V | Conflagration | Passive | — | — | — | Burn and Shock you apply last +1 turn. Burn already stacks on a target (up to three, each stack a full tick), which covers the stacking. | Ashen Mantle | Stack three times: Burn’s own record already allows three stacks (03 §3.5), so the Mastery adds nothing further. |

### 4.2 Frost — *Frost: slow them, stop them, break them. Chill costs enemies turns, a second Chill is a Freeze, and a Frozen enemy is glass for the whole party; Time Slip and the walls buy the front row time.*

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Frost Floor | Active | 12 Mana | 1,000 | Front row enemies | 0.7× Frost to every front-row enemy; Chill 1 turn. | — | 0.8× each. |
| I | Frostbolt | Active | 10 Mana | 1,000 | Single enemy, either row | 1.05× Frost to one enemy in either row; Chill 2 turns. | — | Chill 3 turns. |
| I | Shatter | Passive | — | — | — | Any hit from any ally on a Frozen enemy deals +30% and crits; the Freeze ends and the enemy is pushed back 300 energy as it breaks free. | — | +40%. |
| II | Glacier Spike | Active | 16 Mana | 1,400 | Single enemy, either row | 1.9× Frost to one enemy in either row; Chill 2 turns, and a target already Chilled is Frozen at once. Heavy cast. | Frostbolt | 2.1×. |
| II | Ice Wall | Active | 18 Mana | 1,000 | Party front row | A wall with HP equal to 25% of your max HP absorbs melee hits aimed at the party’s front row until it breaks or 2 turns pass; an enemy that strikes it is Chilled 1 turn. | Frost Floor | Wall HP 35%. |
| II | Permafrost | Passive | — | — | — | Chill you apply lasts +1 turn and takes a further −10% Speed; Frost skills +8%. | Shatter | Frost skills +12%. |
| III | Avalanche | Active | 26 Mana | 1,400 | All enemies | 1.2× Frost to every enemy in both rows; Chill 2 turns; Frozen targets are shattered by this hit even without the Shatter passive. Heavy cast. | Glacier Spike | 1.35× each. |
| III | Time Slip | Active | 24 Mana | 1,000 | Single enemy, either row | One enemy in either row is Slowed 2 turns and pushed back 300 energy; a charging caster loses its cast. | Ice Wall | Pushback 500. |
| III | Hoarfrost | Passive | — | — | — | At fight start every enemy in the front row is Chilled 1 turn; Chilled enemies also lose 10% Accuracy. | Permafrost | Both rows. |
| IV | Absolute Zero | Active | 38 Mana | 1,400 | All enemies | 1.4× Frost to every enemy in both rows; every target already Chilled is Frozen 1 turn (Large and Huge foes and bosses take Chill instead, as the status rules say). Heavy cast. | Avalanche | 1.6× each. |
| IV | Winter’s Breath | Active | 30 Mana | 1,000 | Back row enemies | 1.3× Frost to every back-row enemy; Chill 2 turns; Slow 2 turns (the back row is where the casters stand). | Time Slip | Silence 1 turn as well. |
| IV | Deep Cold | Passive | — | — | — | Every Freeze you cause lasts +1 turn; whenever an ally shatters a Frozen enemy, you restore 15% of max Mana. | Hoarfrost | Restore 20%. |
| V | Endless Winter | Active | 50 Mana | 1,400 | All enemies | 1.8× Frost to every enemy in both rows; Chill 3 turns; for 3 turns every enemy that acts is Chilled 1 turn. Heavy cast. | Absolute Zero | 2.0× each. |
| V | Glass Heart | Active | 40 Mana | 1,000 | Single enemy, either row | 3.5× Frost to one enemy in either row; against a Frozen target it cannot miss and always crits; a kill gives the whole party +15 Momentum. | Winter’s Breath | +25 Momentum. |
| V | Rimeborn | Passive | — | — | — | You are immune to Chill, Freeze and Slow; a melee attacker that hits you is Chilled 1 turn; Rime skills cost −20%. | Deep Cold | Cost −30%. |

### 4.3 Storm — *Lightning and the timeline: Shock that chains, Haste for the party, energy moved up and down the strip. The branch that decides who acts when.*

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Quicken | Active | 12 Mana | 800 | Single ally | One ally gains Haste 1 turn and +200 energy at once (they jump up the strip). | — | +300 energy. |
| I | Spark | Active | 8 Mana | 800 | Single enemy, either row | 0.95× Lightning to one enemy in either row; Shock 2 turns. If the target was already Shocked, the bolt chains 0.5× to one adjacent enemy. | — | Chains to two. |
| I | Static Charge *(new)* | Passive | — | — | — | Shock you apply lasts +1 turn; Lightning damage +5%. | — | Lightning +10%. |
| II | Arc Chain | Active | 15 Mana | 1,000 | Single enemy, either row | 1.5× Lightning to one enemy in either row, then 0.7× to up to 2 other enemies; all of them Shock 2 turns; Shocked targets take +15% from this skill. | Spark | Chains to 3 others. |
| II | Blink Step | Active | 8 Mana | 800 | Single ally | You or one ally swap rows at once, ignoring Root, Web and Grab, and gain +15% Dodge until the target’s next turn. | Quicken | Also breaks Taunt. |
| II | Conductor *(new)* | Passive | — | — | — | Your hits on a Shocked enemy deal +10%. | Static Charge | +15%. |
| III | Galvanize *(new)* | Active | 20 Mana | 1,000 | All allies | Every ally jumps +200 energy up the strip and gains Haste 1. | Blink Step | Haste 2. |
| III | Thunderhead | Active | 22 Mana | 1,000 | All enemies | 1.0× Lightning to every enemy in both rows; every target already Shocked has a 30% chance of Stun 1 turn. | Arc Chain | Stun chance 45%. |
| III | Overcharge | Passive | — | — | — | Evocation crits deal +30% Crit Damage and refund 10% of the skill’s Mana cost. | Conductor | Refund 20%. |
| IV | Mass Haste | Active | 34 Mana | 1,000 | All allies | Every ally and pet gains Haste 2 turns. | Galvanize | Haste 3 turns. |
| IV | Stormcall | Active | 32 Mana | 1,000 | All enemies | 1.3× Lightning to every enemy in both rows; every target already Shocked is pushed back 200 energy; you gain Haste 1 turn. | Thunderhead | Pushback 300. |
| IV | Lightning Rod *(new)* | Passive | — | — | — | A melee attacker whose hit lands on you gets Shock 1; Lightning resistance +30%. | Overcharge | Shock 2. |
| V | Tempest *(new)* | Active | 46 Mana | 1,400 | All enemies | 1.5× Lightning to every enemy in both rows; Shock 2. Heavy cast. | Mass Haste | 1.7× each. |
| V | Vaultbreaker | Active | 45 Mana | 1,400 | Single enemy, either row | 3.8× Lightning to one enemy in either row; Stun 1 turn; the bolt then chains 1.2× to every other enemy that is Shocked. Heavy cast. | Stormcall | 4.2×. |
| V | Paradox | Passive | — | — | — | Your heavy casts weigh 1,000 and cannot be interrupted. | Lightning Rod | Normal casts weigh 800. |

### 4.4 Summoning — *The binding arts: Wards and Shields, Dispel, the lantern, the Mana economy — and the summons, each a creature called for one great strike and gone (D-154).*

| Tier | Skill | Type | Cost | Weight | Target | Effect | Prerequisite | Mastery (rank 10 bonus) |
|---|---|---|---|---|---|---|---|---|
| I | Arcane Ward | Active | 10 Mana | 800 | Single ally | Shield one ally for 18% of their max HP for 3 turns. | — | Shield 22%. |
| I | Call: Ember Imp *(new)* *(summon: Ember Imp, fire)* | Active | 18 Mana | 1,400 | Single enemy, either row | An imp of cinders leaps from the Arcanist’s hand and bursts on one enemy: 1.7× Fire; Burn 2. Heavy cast. | — | 2.0×. |
| I | Attune | Passive | — | — | — | Mana regen 8% → 11% per own turn; items are identified on pickup; the party’s Light falls 1 less per new room. | — | Regen 13%. |
| II | Call: Rime Stag *(new)* *(summon: Rime Stag, frost)* | Active | 24 Mana | 1,400 | All enemies | A stag of hoarfrost charges the length of the room: 0.9× Frost to every enemy; Chill 2. Heavy cast. | Call: Ember Imp | 1.05× each. |
| II | Mirror Ward | Active | 16 Mana | 1,000 | All allies | Every ally gains a Shield of 12% max HP for 2 turns; 20% of the damage it absorbs is returned to the attacker as Lightning. | Arcane Ward | Return 30%. |
| II | Siphon | Active | 0 Mana | 1,000 | Single enemy, either row | Costs no Mana. You restore 25% of max Mana from one enemy in either row; if the target is a caster it is Silenced 1 turn. | Attune | Restore 35%. |
| III | Call: Storm Hawk *(new)* *(summon: Storm Hawk, lightning)* | Active | 30 Mana | 1,400 | All enemies | A hawk of forked lightning stoops on the whole room: 1.1× Lightning to every enemy; Shock 2. Heavy cast. | Call: Rime Stag | 1.25× each. |
| III | Dispel | Active | 18 Mana | 800 | Single enemy, either row | On an enemy in either row: strip every buff (Fortify, Shield, Haste, Regen, Taunt). On an ally instead: cleanse 2 debuffs. | Mirror Ward | Ally: cleanse every debuff. |
| III | Lantern of the Mind | Active | 14 Mana | 800 | All allies | Out of combat: +20 Light, once per room. In combat: every ally is immune to Blind and Fear for 3 turns and Shadow enemies take +15% damage for 3 turns. | Siphon | +30 Light. |
| IV | Call: Bog Serpent *(new)* *(summon: Bog Serpent, poison)* | Active | 34 Mana | 1,400 | Single enemy, either row | A serpent of black water rises and bites one enemy: 2.6× Poison; Poison 3. Heavy cast. | Call: Storm Hawk | 3.0×. |
| IV | Sentinel Pulse *(monster technique)* | Active | 30 Mana | 1,400 | All enemies | Every enemy loses every buff, then takes 1.2× Lightning; every ally gains a Shield of 10% of their max HP for 2 turns. Heavy cast. Monster technique: learned only by witnessing a Vault Sentinel use it. | Dispel | 1.4× each. |
| IV | Font of Mana | Passive | — | — | — | Once per fight, when your Mana reaches 0 it refills to 50%; Fortune (the free-cast chance) +5 points. | Lantern of the Mind | Refill 70%. |
| V | Call: Dawn Warden *(new)* *(summon: Dawn Warden, holy)* | Active | 46 Mana | 1,400 | All enemies | A warden of first light descends: 1.5× Holy to every enemy, and every ally is Shielded for 12% of the Arcanist’s max HP for 2 turns. Heavy cast. | Call: Bog Serpent | 1.7× each. |
| V | Call: Night Maw *(new)* *(summon: Night Maw, shadow)* | Active | 44 Mana | 1,400 | Single enemy, either row | A maw opens in the dark beneath one enemy: 3.4× Shadow; Fear 1; Weaken 2. Heavy cast. | Font of Mana | 3.8×. |
| V | Nullfield | Active | 40 Mana | 1,400 | All enemies | For 2 turns no enemy can use a skill: Silence 2 turns on every enemy (a boss holds it 1, as the status rules shorten its statuses); every Shield on an ally is doubled. Heavy cast. | Sentinel Pulse | Bosses 2 turns. |

**Skill-line note.** Each branch reads as three columns — a damage or summon line, a control-or-defence line, a passive line — and every Tier N skill has one prerequisite at Tier N−1 in its branch, so the tree screen (Phase 18) draws four readable columns. The two monster techniques (Hag's Cauldron, Sentinel Pulse) are leaves. A **summon** (D-154) is a heavy (1,400) Mana cast that calls its creature for one strike and is gone — never a body that stays on the field; the client stages the entrance from the skill's `summon` block.

**As built (Phase 7; the Tier IV–V readings below still hold where the rows survive the re-cut).** The eighteen Tier IV–V rows are content (`tools/content/gen-class-arcanist.ts`); Tier V is designed and locked until Segment 3's endgame (no Insight, no Tome, no Hall — D-099). Readings where the table was silent:
- **Pyroclasm** hits first, then consumes each target's Burn (`consume-dot-burst`: the remaining ticks × stacks at once, as the DoT would). **Stormcall** reads the Shock a target held *before* the cast (`timeline-if-status`). **Hag's Cauldron**'s "ignores armor" is Poison's own rule.
- **Absolute Zero** freezes after its hit (`freeze-if-chilled`), so the cast never shatters its own Freeze; a Large or Huge foe and a boss take Chill instead, by the status rules. **Winter's Breath** follows the convention for row spells: the row of the chosen enemy (a Taunt can turn it to the front row).
- **Deep Cold** lengthens every Freeze the Arcanist causes in an action, a second Chill turning into one included (`freeze-duration-bonus`), and pays its Mana for every shatter by the party when the Arcanist next acts or starts a turn (`pool-on-party-shatter`).
- **Sentinel Pulse** strips the enemies' buffs, then hits them, then shields the allies (10% of each one's own max HP). **Mass Haste** reaches pets. **Font of Mana**'s Fortune is +50 in the sim's tenths of a point (+5 points).
- **Sunflare**'s light next cast (`next-action-weight`) cannot stop a heavy Mana cast from charging (fight.ts decides the charge from the skill's weight). **Vaultbreaker** chains to every other Shocked enemy (`damage-others-with-status`). **Conflagration** adds the turn to Burn and Shock (`status-duration-bonus`); its "stack twice" is already Burn's own record (three stacks, each a full tick), so the Mastery adds nothing more. **Endless Winter** puts a three-turn hook on each enemy that Chills it whenever it acts (`status-on-own-action`). **Glass Heart** cannot miss and crits against a Frozen target (`sure-hit-vs-status`, `guaranteed-crit-vs-status`), then pays the party's Momentum on a kill (`party-momentum-on-kill`). **Rimeborn**'s immunities are sure resists (`status-resist-bonus` 100), its cold answer `status-on-melee-attacker`. **Nullfield** silences for 2 (a boss holds it 1, as every boss status is a turn shorter; the Mastery's `apply-if-boss` gives a boss 2) and doubles every Shield on the party's side (`double-ally-shields`).
- **Stubs** (Tier V, each a joint in fight.ts): **Rewind** (`rewind-ally`: no turn-start snapshot to return to) and **Paradox** (`heavy-casts-uninterrupted`: the charge is decided before any hook is asked). Both log `hookStub` once per fight.


**As tuned (Phase 7, the class-damage pass).** `tools/balance/class-damage.ts` measures each class alone against every zone’s standard monsters at its own level, as single-target damage per round (10 timeline ticks: one normal action of a Speed-100 hero), at levels 1, 5, 8 and 13; the brief is that no damage dealer outdoes another by more than about 1.5×. Before the pass the spread was 2.6× / 2.5× / 3.1× / 2.5×; after it, 1.41× / 1.28× / 1.49× / 1.49×. On the first numbers the Arcanist's Tier I bolts led level 1 (79 against the Ranger's 30). Ember Lance is now 1.1×, Spark 0.95× and Frostbolt 1.05×; the area spells and Tiers II–III keep their numbers, since the area is the Arcanist's job. Tier IV–V keep the sheet's numbers until Dungeon 2.

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

1. ~~**The charge window.** This sheet reads §3.1's "charging a cast" as *declare at 1,000, resolve 400 energy later, interruptible in between*. The alternative is no window at all (the spell lands at once, the 1,400 weight is the only price). The window makes Willpower matter and gives tanks a job; it also makes heavy casts feel bad at low level. Which?~~ *Checkpoint 1 (D-029): the window, as built — declared at 1,000, resolved 400 later; a hit in between pushes it back 300 unless the concentration check passes.*
2. ~~**Staff vs wand.** As written the weapon only changes the basic attack, focusPower and Mana (`08` §1). Should the staff also make casts heavier (+200) and the wand lighter (−100) so the choice is felt on every turn?~~ *Checkpoint 1 (D-099): no — skills keep their own weights (`04` §8 q4); staff and wand still differ in focusPower, Mana and the basic attack (`08` §1).*
3. ~~**Monster techniques and the Insight sweet spot.** The formula's Tier IV sweet spot is enemy level 24; Gravehollow tops out at 14. Proposed: for monster techniques only, S = 1.0 whenever the monster is using the move in the fight. Otherwise Hag's Cauldron and Sentinel Pulse move to Dungeon 2 monsters.~~ *Checkpoint 1 (D-028): techniques skip the curve — a flat 10% per witnessed use, pity at 10 — so Hag's Cauldron and Sentinel Pulse stay in Gravehollow.*
4. ~~**Shatter for everyone.** Shatter (Tier I passive) grants the +30% to *every* ally's hit on a Frozen target. That makes Rime a party school rather than a selfish one — but it means a Blade benefits from a passive it did not equip. Keep, or make it Arcanist-only hits?~~ *Checkpoint 1 (D-099): keep it party-wide, as built — Rime is a party school.*
5. ~~**Prismatic Ruin's refund.** 30% Mana back on the Ultimate turns it into a resource reset as well as a nuke. Drop the refund if the sim shows Arcanists never running dry.~~ *Checkpoint 1 (D-099): keep the 30% refund, as built; Phase 7's class-damage pass drops it if the runner shows Arcanists never running dry.*
