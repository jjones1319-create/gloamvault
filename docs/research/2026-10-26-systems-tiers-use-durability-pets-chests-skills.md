# Dungeon Crawler — Systems Research Report

**Date:** 2026-10-26 · **Scope:** eight progression/economy systems for a 1–4 player co-op, turn-based (speed-timeline) dungeon RPG on high-end Android · **Status:** research + recommendations; every number below is a **tuning starting point**, not a commitment.

How to read: each topic has (a) a survey of what shipped games actually do, with numbers where the sources give them, (b) the pitfalls those games hit, (c) a recommendation for Dungeon Crawler. Section 9 collects the decisions in one place. Sources are listed at the end; where a claim comes from general knowledge rather than a fetched source it is marked *(gk)*.

---

## 1. Tier / rarity ladders

### 1.1 Survey

**Letter grades (manhwa / LitRPG / Korean-Japanese mobile).** Solo Leveling ranks hunters and gates E → D → C → B → A → S, then names one tier above S, *National Level*, held by five people in the whole setting; nothing official sits above it. The ladder is a *power class*, not a loot roll: an S-rank is "a league of its own". Dragon Quest Monsters uses F → E → D → C → B → A → S → X (The Dark Prince adds G below F), with everything above A "almost always" requiring synthesis. Fire Emblem weapon ranks run E → S (Radiant Dawn adds SS; Three Houses adds "+" half-steps). Japanese gacha grades run N → R → SR → SSR → UR *(gk)*. The pattern: letter ladders have **6–8 steps**, S is the practical top, and anything above S is **named, scarce and narrative** ("National Level", "X", "UR").

**Colour rarities (Western ARPG / MMO / shooter).** WoW: Poor (grey) → Common (white) → Uncommon (green) → Rare (blue) → Epic (purple) → Legendary (orange) *(gk)*; Fortnite adds Mythic above Legendary *(gk)*; Genshin uses 1★–5★ with 5★ at 0.6%. Hades boons are Common → Rare → Epic → Heroic → Legendary; Artemis' True Shot does 70 / 80 / 90 at Common / Rare / Epic, roughly **+14% per step**.

**Diablo and Path of Exile — rarity = affix budget.** Diablo 4: Common (no affixes) → Magic (1) → Rare (3–5) → Legendary (4 + a Legendary Aspect) → Unique (fixed affixes + unique power), with Sacred/Ancestral *variants* at every quality and Mythic Uniques later; a Magic item's base stats can match a Legendary's, so base stat and rarity are decoupled. Path of Exile: Normal → Magic (≤1 prefix + 1 suffix) → Rare (≤3 + 3) → Unique (preset mods).

**Monster Hunter — rarity = progression gate.** World/Iceborne weapons are Rarity 1–12 and rarity sets what you can do to them: at High Rank, Rarity 6 / 7 / 8 get 3 / 2 / 1 augmentation slots (40,000 / 60,000 / 90,000 zenny each); at Master Rank, Rarity 10 / 11 / 12 get 5 / 4 / 3 default slots expandable to 10 / 8 / 6. Note the inversion: *higher* rarity means *fewer* free augments, so a maxed rarity-10 rivals a rarity-12 — rarity and investment overlap on purpose. Wilds' Artian weapons come in Rarity 6 / 7 / 8 (three parts of equal rarity, 2,000 / 5,000 / 10,000 z), only Rarity 8 gets a unique name, and every Artian weapon reinforces five times.

**Dark Souls / Elden Ring — upgrade level is a separate axis.** Dark Souls 1: Shard to +5, Large Shard to +10, Chunk to +14, Slab for +15 (armour +3 / +6 / +9 / +10); coloured titanite opens elemental side-paths; Twinkling/Demon/Dragon titanite take unique gear only to +5. Elden Ring: regular weapons to +25 through nine stone grades; "somber" uniques to +10 with one stone per level — the clearest shipped example of **two upgrade ladders normalised to the same power**.

### 1.2 What the survey says

1. There are really **two axes**, and every well-regarded system keeps them separate: *grade* (what the item fundamentally is — affix budget, base stat band, name, look) and *investment* (what you have done to it — upgrade level, materials, augments). Diablo 4 (Rarity × Sacred/Ancestral), PoE (rarity × item level), MH (rarity × augments), Souls (unique-ness × +N) all do this.
2. Letter ladders read best when **S is the realistic top** for players and anything above S is rare enough to be an event. Nine steps (F→God) is at the long end of shipped ladders; it works only if the bottom three steps go by quickly.
3. Colours carry more information at a glance on a phone than letters; most games use both (a letter in the corner, a coloured frame).

### 1.3 Recommendation

**Nine grades, letter + colour + name:**

| Grade | Colour | Flavour name | Base stat multiplier | Affix slots | Max upgrade (+N) | Where it drops |
|---|---|---|---|---|---|---|
| F | grey | Crude | 1.00 | 0 | +3 | floors 1–3, shop |
| E | white | Common | 1.35 | 1 | +4 | floors 1–6, shop |
| D | green | Fine | 1.80 | 1 | +5 | floors 4–10, shop |
| C | blue | Superior | 2.45 | 2 | +6 | floors 8–15, shop |
| B | purple | Masterwork | 3.30 | 2 | +7 | floors 12–22, chests |
| A | orange | Heroic | 4.45 | 3 | +8 | floors 18–30, chests |
| S | red | Legendary | 6.00 | 3 | +9 | floors 26–40, chests, bosses |
| SS | gold | Mythic | 8.10 | 4 | +10 | floors 35+, bosses, pity only |
| God | white-gold, animated | Divine | 11.0 | 4 + unique power | +10 | endgame bosses, never random |

- **Curve:** ×1.35 per grade (geometric). Nine steps give an 11× spread, which is enough for a 40–50-floor dungeon without needing six-digit numbers; Hades' ~+14% per rarity step is too flat for a loot game, Minecraft's 59→2031 durability spread (34×) is too steep for stats.
- **Upgrade level ≠ grade.** Each +1 adds **+5% of the item's own base** (so +10 = +50%). With a ×1.35 grade step, a maxed item of grade N (×1.50) beats a +0 of grade N+1 (×1.35) but loses to a +3 of grade N+1 (×1.35 × 1.15 = ×1.55). That overlap is the whole point: a cared-for A-tier axe is a real choice against a fresh S. Material upgrades (section 4) *change the grade* of armour; +N is spent with gold and generic stones (whetstones, oil, thread).
- **Affix slots** are the Diablo/PoE lever: grade decides how many lines an item can roll; upgrade level never adds lines (that keeps "tier" readable).
- **Drop-rate shape:** every floor band has a *centre grade* (table above). Random drops roll: centre 55% · one below 25% · one above 14% · two above 5% · three above 1%; God never rolls randomly. Luck shifts weight upward (section 8). Shops stock only F–C so town never competes with the dungeon.
- **Naming above S:** keep "SS = Mythic" as the last *findable* grade and "God = Divine" as a named, boss-bound grade with a unique power (Diablo Unique / Elden Ring somber logic). Solo Leveling's "National Level" shows that the tier above S lands best when it is countable: aim for **one God item per slot per class** at launch.

---

## 2. Level-with-use systems

### 2.1 Survey — stats and skills

**The Elder Scrolls.** Skills rise every time they are used, and the exploits are structural. Skyrim's Sneak gains from "staying undetected while crouching" and from sneak-attack damage, so players crouch against a wall near a hostile bear in Helgen or stab non-retaliating NPCs (Ralof, the Greybeards) indefinitely. The source's own diagnosis: *experience depends on the action, not on difficulty or risk*; actions are repeatable; damage-based rewards favour targets that absorb hits; quicksave removes the cost of failure. Oblivion's Armorer gives a flat 1.5 XP per repair regardless of amount, so players fire bows at the ground and repair them, cast self-targeted Disintegrate, and sell-then-buy-back 125% items to reset them.

**Ultima Online.** Use-based with a difficulty gate: "a task too easy for the character's skill level gives no chance to gain"; failed uses don't count; the **Guaranteed Gain System** forces 0.1 if nothing was gained in a window that lengthens with total skill (at 700 points, a skill in the 80s gets 0.1 about every 15 hours), and Siege shards use **Rate Over Time** above 70 (one 0.1 per 5 / 8 / 12 / 15 minutes in the 70s / 80s / 90s / 100s). A 700-point total cap forces specialisation. UO's answer to grinding was to make the *ceiling* slow, not to ban the grind.

**RuneScape.** Pure accumulation on an exponential table (each level ~10% more than the last; level 92 = 6.5M XP is half of level 99's 13.0M): grinding is the game, and the curve exists to make the last seven levels cost as much as the first ninety-two.

**Kenshi.** Difficulty-relative gains, explicitly: Toughness XP from a hit is 0.1× if the damage is 25 or more *below* your Toughness, 2× at 10 above, 6× at 50 above; armour-absorbed damage still counts. Fighting things better than you is the only fast route.

**Mount & Blade II: Bannerlord.** Use-based XP multiplied by a **learning rate** from focus and attribute points, with a **learning limit** (each focus point +30, each attribute point beyond the first +10) above which gains continue "but more slowly"; a 10-attribute/5-focus build soft-caps at 330. The cleanest shipped "use to level, but *where* you can go far is a build choice".

**Dungeon Crawl Stone Soup.** Skills train from an XP pool refilled by kills; the player points the pool at skills, and species aptitudes scale the cost (cap 27 *(gk)*). You cannot level Stealth by walking in circles, only by killing things and directing the pool.

**Final Fantasy II.** No levels: HP grows from taking damage, each weapon type and spell has its own proficiency bar, Strength rises from attacking, Evasion from being targeted. **Battle Rank** (monsters are rank 1–7; a fight's rank is their average) scales the gains — and the game is still famous for players hitting their own party to farm HP. Wizardry 8 has the same shape (spellbook thresholds at 15 / 30 / 45 … 90) and the same advice: cast Knock-Knock and Heal All out of combat to grind.

**Project Zomboid.** Use-based with **skill books** that multiply XP within a level band (×3 / ×5 / ×8 / ×12 / ×16 for Vol. 1–5; weapons ×1.5 … ×8) — a "training focus" that lets the player choose what to grind efficiently rather than removing the grind.

**Valheim.** Use-based 0–100, and death costs **5% of skill progress**; players mod this out constantly, and in co-op it is the most-complained-about part of the system.

### 2.2 Survey — weapon XP and growth

**Dark Cloud / Dark Chronicle.** Weapons have **WHP** (durability; hitting 0 halves the weapon's XP) and **ABS** (weapon XP: each kill drops 8 "grains", absorbed by the killing weapon or redirected). Cap 99; **excess ABS is lost** (needing 2 and getting 20 wastes 18). Each level grants 3–6 Synthesis Points for slotted Synth Spheres (+2 to one stat), and a weapon at +5 can be sealed into a sphere that keeps **60%** of its stats and is fused into a successor — the "evolution" loop. Attack transfers at 25% plus 75% of any gap if the sphere was stronger.

**Vagrant Story.** Each weapon tracks **class affinity** (Human, Beast, Undead, Phantom, Dragon, Evil) and **element affinity**; hitting a class raises it and lowers opposed ones; armour gains affinity from being hit. The canonical advice — one weapon per class — is also the grind: players swap weapons per enemy to farm affinity.

**Fire Emblem weapon ranks.** Weapon EXP per *hit* (GBA/Tellius; a kill doubles it; a breaking weapon gives none), 2 per round (DS/Awakening), 1 (Fates); E/D/C/B/A/S thresholds of 1 / 31 / 71 / 121 / 181 / 251 in GBA, Path of Radiance and Awakening; Three Houses runs 0 … 3,600 with "+" half-ranks. Rank gates *which* weapons you may wield rather than buffing the weapon.

**Destiny 2 crafting.** A crafted weapon gains **weapon level** through use, unlocking enhanced perks after "a long period of use". Level is per instance, not per type — you level the gun you will keep. Monster Hunter weapons never gain XP (progression is forging along a tree with monster parts); Dead Cells unlocks blueprints into the pool with Cells *(gk)*.

### 2.3 Pitfalls and the fixes that shipped

| Pitfall | Seen in | Fix that shipped |
|---|---|---|
| Grinding on walls / non-hostile targets | Skyrim sneak, Oblivion Armorer, Wizardry 8 out-of-combat casting | UO: no gain on tasks too easy; DCSS: XP comes from kills, not actions; Kenshi: gain scales with how much stronger the target is |
| Spamming cheap spells | Oblivion/Morrowind cast-and-rest, FF2 | DCSS pool model; cost the spell in a resource that only refills by progressing |
| Excess is wasted / stochastic frustration | Dark Cloud ABS overflow; UO gain RNG | UO GGS guarantee; FE flat per-hit WEx |
| Specialisation ruined by levelling everything | Oblivion level scaling; UO 700 cap | Bannerlord learning limit; UO total-skill cap; DCSS aptitudes |
| Death wipes progress | Valheim 5% | Removed by mods; don't do it in co-op |
| Swapping the farm weapon per enemy | Vagrant Story affinities, Dark Cloud grain redirection | Destiny: level the instance you keep; FE: rank per *type* so swapping is free |

### 2.4 Recommendation — "everything levels with use", with safeguards

Three XP streams, all **earned only from meaningful actions**: an action is meaningful when it resolves against a hostile at or above the actor's gate, or resolves a dungeon event (trap, lock, treasure). Attacks on allies, walls or empty tiles, casts with no target, and re-interacting with a resolved curio give **zero** XP.

1. **Skill XP (per skill).** Each use grants `base × D(enemyLevel − skillLevel)`, D borrowed from Kenshi/UO/FF2: 0.1× at −10 or lower, 1.0× at 0, 2.0× at +5, capped at 3.0× at +10. Skill cap `characterLevel + 5` (Bannerlord soft limit; ¼ gains above it). Per run each skill has a **use budget**: the first 20 meaningful uses pay full, 21–60 pay 50%, later uses 10% (UO's Rate-Over-Time, per run rather than per clock). Skill *ranks* 1–10 tune the skill (+4% effect, −2% cost per rank) and never change its tier (§7).
2. **Stat XP (derived, not direct).** Stats grow from *tagged* actions, FF2-style, through the same gated, budgeted pipeline: Strength from melee hits and carrying over 50% capacity, Endurance from damage taken (armour-absorbed counts), Agility from attacks and dodges, Perception from traps/treasure found, Intellect from casts and Insights, Charisma from shop and party actions (revives, buffs). Luck is **not** trainable (a trainable Luck is a grind magnet). Caps `10 + 2 × characterLevel` per stat. A "stats gained this run" line on the results screen makes the growth legible.
3. **Item XP (per instance).** Each equipped item earns XP from hits landed or absorbed on gated enemies, Dark-Cloud-style but with no overflow loss. Item level 1–10 within its grade: +2% base stat per level, and at 3 / 6 / 9 an **affinity line** (Vagrant Story simplified: the item records the family it has fought most and gains +5% against it per line — never decreasing, so no per-enemy swap grind). Level 10 unlocks **Awakening**: carry the item into a material promotion (§4) or sacrifice it Synth-Sphere-style for **60% of its XP** into a successor.
4. **Co-op fairness.** Kill credit is by participation (damage, heal, buff, tank), never last hit; budgets are per player.
5. **No death penalty on XP.** Death costs durability (§3), never progress.

---

## 3. Durability

### 3.1 Survey, with numbers

**Diablo 2 (the reference model).** Each melee attack has a 4% chance to remove 1 durability from the weapon; each melee hit taken has a 10% chance to remove 1 from one armour piece, chosen by weight (Body 3, Head 2, Shield 2, Waist/Feet/Hands 1). Ranged attacks, spells and blocking never cost durability. At 0 the item is **Broken** — it gives none of its stats, but it is never destroyed and a full repair restores it. Repair cost rises per missing point and partial repairs are allowed. Ethereal items cannot be repaired (+50% stats, permanently broken at 0); self-repair affixes restore 1 point per 33 / 20 seconds.

**Minecraft.** Tools last Gold 32 · Wood 59 · Stone 131 · Iron 250 · Diamond 1,561 · Netherite 2,031 uses; armour runs from Leather 55/80/75/65 to Netherite 407/592/555/481 (helm/chest/legs/boots), losing 1 point per 4 damage taken. Unbreaking gives each use a 1/(level+1) chance to cost durability; anvil repairs carry a rising "prior work" penalty that ends in "Too Expensive" *(gk)*. Items vanish at 0, accepted only because they are cheap to re-craft.

**Zelda: Breath of the Wild / Tears of the Kingdom.** No repair, no upgrade, weapons shatter; a 50-power find "sits unused in the inventory"; the complaints are hoarding, constant inventory management, losing a good weapon mid-fight. TotK's Fuse adds roughly 25 hits at the top end but there is still no repair, fusion is temporary and cannot be chained, and reviewers call it "much better and still annoying". The lesson: **no repair + sudden loss + inventory pressure** is the toxic combination, not durability itself.

**Dark Souls 2.** Durability drains within a level and restores at bonfires; the 60 fps versions tied degradation to framerate so weapons broke twice as fast, dexterity builds broke their weapons in PvP "faster than they could wear down opponents", and some broke mid-boss. Elden Ring dropped durability entirely *(gk)*.

**Fire Emblem.** Weapons have uses; Fates removed them for post-combat debuffs (Steel −Speed, kodachi 0 crit); Echoes removed them with one-item-per-unit and a blacksmith; Three Houses restored them with a *repair* economy (ore + gold); Engage removed them again. For: scarce strong weapons force choices about *when* to use them. Against: bookkeeping, and unbreakable lord weapons undercut it.

**Fallout 3 / New Vegas.** Condition reduces weapon damage and accuracy, guns jam, armour DR falls; at 0 the item is unusable until repaired. NV vendor repair costs `2 × (fraction repaired) × item value` (120 caps to restore 60% of a 100-cap item); repair kits craft at Repair 50; Jury Rigging (Repair 90) repairs with any item of the same class *(gk)*.

**Oblivion / Morrowind.** Oblivion hammers restore `Armorer + 3` points per use and break randomly; Expert (75) repairs to 125%; the grind loops are in §2. Morrowind's repair chance is `(Armorer + Str/10 + Luck/10) / (0.75 + 0.5 × fatigue fraction)`, restore `3 × hammerQuality × roll`, and "unless your skill is very low, hammers are cheaper than NPCs."

**The Witcher 3.** Gear degrades with use, a HUD icon warns at low condition, blacksmiths restore fully, and repair kits sell for 11 / 30 / 62 crowns (Amateur / Journeyman / Master). Nobody complains, because kits are cheap and the penalty is gentle.

**Animal Crossing: New Horizons.** Flimsy / regular / golden tools last 40 / 100 / 200 (axe, shovel), 10 / 30 / 90 (rod, net), 20 / 60 / 180 (can) uses; golden tools *still break*, the game's most-criticised change *(gk)*. Dead Rising weapons break with no repair and it works because scavenging is the game; Valheim repairs are free at a workbench, so durability is a "go home occasionally" timer *(gk)*.

### 3.2 Sentiment synthesis

Players **hate**: items vanishing (BotW, ACNH golden tools), breakage mid-fight without warning (DS2, BotW), no repair path at all, hoarding good items out of fear, and a repair loop that is pure bookkeeping (Fire Emblem's "which lance has 3 uses left").

Players **accept or like**: a blacksmith in town (D2, Witcher 3, Three Houses), **stat degradation before breakage** (Fallout, D2's Broken-not-destroyed), cheap field kits (Witcher 3: 11 crowns), visible wear (HUD icon; Fallout condition bar), durability as a reason to *choose* when to swing the rare weapon (FE), and durability that is *restored* at a safe point (Valheim workbench, DS2 bonfire).

### 3.3 Recommendation — "care for your items" without annoying a phone player

- **Two numbers per item:** `durability` (0–100%) and `maxDurability` (starts 100, erodes with neglect). Material grade scales how slowly durability drains, not the display, so the UI is one bar everywhere.
- **Drain:** weapons lose 1% per `k` meaningful hits, armour per hit taken, tuned so a fully used item spends **25–35% per run** at its floor band (≈3 runs from full to zero with no care). Spells and ranged attacks do not wear the weapon (D2 rule); shields wear on blocks. Each material grade multiplies `k` by 1.25 (nine grades ≈ 6×; Minecraft's 34× is too much).
- **Stat bands, no sudden death:** 100–60% full effect · 60–20% linear falloff to −30% stats (−10% accuracy for weapons) · 20–1% "Damaged": −50% and a persistent icon · 0% **Broken**: 0 stats, still equipped (D2). Drain never destroys an item.
- **Neglect erodes the ceiling:** each time an item *reaches* 0, `maxDurability` drops 5 (permanent). At 0 it is destroyed — into salvage (§4), not into nothing — with warnings at 20 and 10. Twenty neglect cycles is enough slack that a careful player never sees it.
- **Repair:** (a) town blacksmith "Repair all", one tap, cost `0.5% of item value × points restored` (a run's gold should cover a full party repair with ≥70% left; Fallout's 2× is punitive); (b) field **Repair Kit**, a common drop and shop item, +25% to one item out of combat; (c) a Tier-I **Whetstone** craft skill (§7) restoring 10% to a weapon between fights for one material unit. Repair never lowers `maxDurability` (no Minecraft "prior work" penalty).
- **Co-op:** durability is personal; death in a run costs an extra 10% on everything equipped — the only death penalty in the game.
- **UI:** a wear pip on each slot icon (green/amber/red), a toast at 20%, a "worn gear" line on the results screen, the repair button on the town hub.

---

## 4. Material upgrade chains

### 4.1 Survey

**RuneScape.** Bronze → Iron → Steel → Black → Mithril → Adamant → Rune → Dragon, gated by Attack/Defence levels 1 / 1 / 5 / 10 / 20 / 30 / 40 / 60 *(gk)*; the last rung is uncraftable and drop-only. The chain's job is to be *legible*: everyone knows a rune scimitar is "level 40".

**Terraria.** Thirteen ore tiers: Copper/Tin → Iron/Lead → Silver/Tungsten → Gold/Platinum → Meteorite → Demonite/Crimtane → Obsidian → Hellstone, then Hardmode Cobalt/Palladium → Mythril/Orichalcum → Adamantite/Titanium → Chlorophyte → Luminite. Each tier is an **alternate pair** chosen per world, only one of the pair spawns naturally, and each tier needs the previous tier's pickaxe. The pair system is the best shipped trick for making the same ladder feel different per playthrough.

**Minecraft.** Leather → Gold → Chainmail → Iron → Diamond → Netherite, with Netherite an *upgrade applied to* diamond gear (keeping enchantments) rather than a fresh craft — the clearest "upgrade the item you have" example.

**Dark Souls titanite.** Shard (+1…+5) → Large Shard (+6…+10) → Chunk (+11…+14) → Slab (+15); coloured titanite for elemental side-paths; Twinkling/Demon/Dragon for unique gear; Elden Ring's nine stone grades for +25. Materials are *generic* and gated by region.

**Monster Hunter.** Materials are monster-specific with published per-source rates. Rathalos Plate at Low Rank: 2% quest reward, 3% capture, 4% head break, 2% back break, 1% body carve, 3% tail carve; High Rank 5 / 5 / 7 / 4 / 3 / 5%. Rule of thumb: common parts 20–40% per carve, rare parts 1–8%, with **part breaks** and **capture** as deterministic levers on the odds.

**Valheim.** Eleven armour sets strictly biome-gated: Rag → Troll → Bronze (copper + tin) → Iron → Wolf (silver + pelt) → Padded (iron + linen) → Carapace / Root / Fenris → Flametal / Chaos (eitr); an upgrade adds ~+4 armour (Carapace chest 32 → 36). The materials are the map: no iron without the Swamp. Horizon Zero Dawn ties mod rarity to percentages (+21% Freeze Rare, +38% Damage Very Rare) and weapon rarity to slot count *(gk)* — "colour = slots, material = story progress".

### 4.2 Recommendation — four ladders, nine rungs, aligned to the nine grades

A piece of armour's **material is its grade**. Upgrading armour with a better material *promotes* it one grade (keeps item XP, affixes re-roll one line, +N resets to +0 — Minecraft Netherite logic, so the item you have cared for is the item you keep). Weapons promote the same way through the metal/wood ladders. Promotion is deterministic — fixed material count, fixed gold, no failure roll — so crafting never touches chance.

| Grade | Metal (weapons, mail, plate) | Hide (light armour) | Cloth (robes) | Wood (bows, staves, shields) |
|---|---|---|---|---|
| F | Copper | Rawhide | Burlap | Pine |
| E | Bronze | Leather | Linen | Ash |
| D | Iron | Boiled Leather | Wool | Oak |
| C | Steel | Wolf Hide | Silk | Yew |
| B | Blacksteel | Wyvern Hide | Runecloth | Ironwood |
| A | Mithril | Basilisk Scale | Moonweave | Ebony |
| S | Adamantine | Drake Scale | Phoenix Weave | Elderwood (treant heart) |
| SS | Orichalcum | **Dragon Scale** | Voidcloth | World-tree Bough |
| God | Starmetal | Ancient Dragon Scale | Celestial Thread | Godwood |

- **Where dragon scale sits:** SS — the last *findable* material (dragons from floor ~35); the God rung ("Ancient Dragon Scale", boss-only) leaves headroom for the endgame and the sister game. If James prefers "dragon scale = top", merge the SS/God names and keep the counts.
- **Material counts per promotion:** 4 / 6 / 8 / 10 / 12 / 16 / 20 / 30 / 50 units (F→E … SS→God) plus gold = 25% of the target grade's shop value. Thirty scales at a 5% carve rate would be ~600 dragons, so dragons must also drop *guaranteed* scales (1–3 per kill, MH capture-reward logic) and bosses drop rare parts deterministically on first kill.
- **Monster → material mapping:** every enemy family has one material family and a floor band. Each kill rolls a **common part** (35%, e.g. Wolf Hide on floors 8–15) and a **rare part** (4%, e.g. Wolf Fang → an affix stone); a *part break* in combat doubles the rare roll; bosses drop a guaranteed stack. Terraria's pairs become **regional variants**: each run picks one of two cosmetically different materials per grade (Steel/Bluesteel, Silk/Spidersilk) with identical numbers — variety without balance work.
- **Generic upgrade stones** for +N (§1) are separate: Whetstone (F–C), Honing Oil (B–A), Star Grit (S–God), dropped in their bands — Dark Souls' shard/large/chunk/slab. Materials change *what the item is*; stones change *how far you've pushed it*.
- **Salvage:** any item salvages into 25% of its promotion cost in its own material; one destroyed by neglect salvages at 50%, so neglect is a loss, not a wipe.

---

## 5. Pet / companion systems

### 5.1 Survey

**Torchlight II.** The pet fights, has its own inventory, **walks back to town to sell** unwanted loot and returns with a shopping list, learns spells, and transforms when fed fish. The sell run is the series' most-praised convenience and the model for a pet that matters *outside* combat.

**Diablo 3 followers (2.7.0).** Solo-only (bar one set), 13–14 gear slots, four skill picks from eight, power ×2.5 per main-stat point to a 25,000 cap, and **Emanate** (certain legendary powers on the follower apply to the player). Lesson: a companion that exists only in solo becomes the de-facto solo balance patch and makes co-op feel like a downgrade.

**MapleStory.** Pets auto-loot in a box around them, have **fullness** (−1…−5 per tick, food +30, at ≤5 the pet goes home), **closeness** (level ≤30 at 30,000) and **lifespans** (3 / 7 / 30 / 90 days, Water of Life +30). The hunger/lifespan layer is monetisation and players resent it.

**World of Warcraft hunter pets.** Pet level = hunter level, 100 Focus regenerating 5/s, three specialisations that since 8.0 differ only in two abilities, 5 active and 50 stabled, Feed Pet heals 50% out of combat. **Happiness/loyalty was removed in 4.1** and its bonus baked in — Blizzard concluded pet hunger was pure annoyance. Guild Wars 2 rangers swap two pets on a cooldown that lengthens when the active pet is downed *(gk; wiki offline at time of writing)*.

**Monster Hunter Rise.** Palicoes have five support types (Healer, Assist, Fight, Bombardier, Gathering) and targeting stances; support moves unlock at levels 1 / 5 / 10 / 15 / 20; skill memory slots grow at 10 / 25; Palamutes have three tactics (Basic / Pincer / Follow). **Two buddies offline, one online** — a buddy per player, not per party. Fallen buddies are knocked out and return; they never die *(gk)*. FFXIV's chocobo has Attacker/Healer/Defender stances and cannot enter dungeons at all *(gk)*.

**Pokémon / Temtem.** Temtem replaces PP with a **stamina** meter: each technique costs stamina, overuse makes the creature overexerted and self-damaging; battles are always 2v2, which is why its co-op (one creature per player) works.

**Dragon Quest Monsters.** Ranks F–X; synthesis gives the child **¼ of each parent's stats**, 25% of each parent's growth rates and up to three inherited talents; "+value" raises caps (50 base, 75 at +5, 100 at +10). "Raise two, fuse into a better one" is the loop a ranch game wants.

**Monster Rancher.** Lifespan ≈ 2,550 (~255 weeks), −10 per week, −5 more if underfed, up to −55 with stress and fatigue; six stats (LIF/POW/INT/SKI/SPD/DEF); monthly drill/rest/spar patterns; praise/scold shift discipline and reliance; tournaments E → S. Monsters *die*, and the answer is to combine them — the direct ancestor of "Wildsong Ranch".

### 5.2 Recommendation — pets in a turn-based co-op dungeon

- **One pet per player**, always present (MH's online rule, not D3's solo-only). The pet is a **timeline actor** with its own speed and one action per tick; its turns auto-resolve with no menu so eight actors keep a human cadence.
- **Stances, not menus:** the owner sets one of four between fights or as a free action: *Fierce* (attack the owner's target), *Guard* (intercept 30% of hits aimed at the owner; taunt), *Mend* (heal/cleanse the lowest ally), *Forage* (skip attacks; roll the owner's Perception for extra loot and trap reveals). Stance is the whole control surface — no F1–F4 micromanagement on a touchscreen.
- **Kit:** one bloodline trait ("+10% gold found", "ambushes −15%") + two actives unlocked at pet level 5 and 15 from the species' list, fed by a Temtem-style **stamina** pool that refills between fights so the best move cannot be spammed.
- **Downed, never dead:** at 0 HP the pet retreats for the fight (GW2/MH) and returns at 50% next fight. No lifespan, no hunger (WoW removed happiness for a reason; MapleStory's fullness is a paywall). "Care" is a treat once per run for +10% pet XP — a bonus, never a penalty.
- **Rarity:** the same nine grades as gear, setting base stats (×1.35 per grade), unlockable actives (1 / 2 / 3 at F–C / B–A / S+) and trait strength. Grade **never** changes; a better pet comes from a Pet Egg or a drop, so the hunt is a loot loop, not a fusion loop (fusion belongs to the ranch).
- **Levelling:** 50% of the owner's fight XP by participation, capped at the owner's level, +2% stats per level; traits also grow **by use** (a *Forage* pet grows its Perception trait, a *Guard* pet its Endurance).
- **Wildsong Ranch import:** an imported pet arrives with a `ranchStats` block mapped onto the nearest grade's budget (never above A at import; SS/God are dungeon-only), tagged "Ranch-raised" with a unique trait slot. Dungeon pets never die, so an import can never be lost here; sync back to the ranch is one-way (levels, affection) and the ranch owns breeding.

---

## 6. Chests / gacha with in-game currency only

### 6.1 Survey

**Genshin Impact.** 5★ base 0.6%, soft pity from ~pull 74, hard pity at 90, a 50/50 against the featured character with a guarantee after a loss (worst case 180 pulls); consolidated 5★ rate ≈1.6%; a 4★ guaranteed within 10; pity carries across banners of a type (Honkai: Star Rail likewise, 90).

**Hearthstone.** A Legendary within every 40 packs, an Epic within 10, a Rare per pack, a Legendary in the first 10 packs of an expansion; per-card odds 5.0% Legendary / 21.0% Epic. **Duplicate protection:** a new Legendary is always one you don't own; no third copy of a Common/Rare/Epic until you own two of every card of that rarity.

**Brawl Stars Starr Drops.** 50% Rare / 28% Super Rare / 15% Epic / 5% Mythic / 2% Legendary, each rarity with its own published content table (a Legendary drop is 27% a Star Power, 2% a Legendary Brawler); earned from the 1st, 4th and 8th daily wins. The in-game odds screen *is* the design document.

**Clash Royale.** Chests come from a **fixed, deterministic cycle** with Legendary/Champion chests at known positions, tracked by third-party apps; the framing is that predictability "avoids surprises" and lets free players max their cards. AFK Arena's tavern runs 51.69% Common / 43.70% Rare / 4.61% Elite, and every scroll also earns a Library Token, 100 of which buy a guaranteed Elite — pity as a *second currency*.

**Marvel Snap Spotlight Caches.** Four slots a week drawn **from a bag without replacement** (25%, then 33%, 50%, 100%), so four keys guarantee the set; owned cards convert to variants.

**Single-player chests.** Slay the Spire: Small chest relics 75% Common / 25% Uncommon / 0% Rare; Medium 35 / 50 / 15; Large 0 / 75 / 25. Hades: a chamber pays ~100 Obols and Charon sells a boon for 150, a Centaur Heart for 125, a Daedalus Hammer for 200 — a shop boon costs **1.5 rooms** of income. Risk of Rain 2: chest price = `25 × coeff^1.25` where the coefficient grows with time, stages (×1.15 each) and player count (+0.3 per extra player), and enemy gold = `2 × coeff × monsterValue`, so a chest is always "a few kills". Darkest Dungeon curios: hand-opening a treasure chest is 75% loot / 25% trap; a Skeleton Key makes it 100% and doubles the loot — the *key item* converts a gamble into a purchase.

**Google Play policy.** "Apps offering mechanisms to receive randomized virtual items from a purchase … must clearly disclose the odds of receiving those items in advance of purchase." The letter is about purchase; the industry reading is that it applies when the random item is reachable through a purchased path (the chest or the currency that buys it). A soft-currency chest with no IAP route is outside the letter, but publishing odds in-game costs nothing and pre-empts a reviewer's judgement call.

### 6.2 Recommendation

- **Four chest types, bought with dungeon gold in town:** *Gear Chest* (slot-targeted Weapon / Armour / Trinket variants — targeting halves the dupe problem), *Pet Egg*, *Material Crate* (a stack of the player's band material + a 10% rare-part roll), *Skill Tome* (§7); each in Standard and Grand.
- **Prices relative to income.** Let `R` = median gold from one run at the player's band (tune `R`, not the prices). Standard chest 0.5 R; Grand 2.5 R; Pet Egg 1.5 R / 6 R; Material Crate 0.3 R. After repairs (§3) a run should leave ≈ one Standard chest, and a Grand every three — Hades' "1.5 rooms per boon" cadence stretched to runs.
- **Odds shape (Standard Gear Chest at band B):** B 55% · A 25% · S 14% · SS 5% · God 0%; Grand shifts one grade (A 45, S 35, SS 15, "Divine shard" 5). Band-relative odds mean the chest never sells an outgrown item, and God stays boss-bound (ten Divine shards forge one — the deterministic path).
- **Pity, two layers:** (1) counter pity, Hearthstone-style and shown in the UI — a ≥+1-grade item within 10 Standard chests, ≥+2 within 40; (2) pool pity, Snap-style — Skill Tomes draw from a bag without replacement per class and tier.
- **Duplicates:** gear dupes auto-salvage to materials; pet dupes become **bond** (+1 star to 5, +5% stats each); skill dupes become rank XP (§2).
- **Transparency:** an "Odds" button on every chest with the exact table, the pity counters and the Tome bag's remaining contents. Gold is earned only in the dungeon and nothing in the loop is purchasable for money, which closes the policy question.
- **In-run chests** follow Slay the Spire (Small 75/25/0, Large 0/75/25) and a **Skeleton Key** (a Perception find or shop item) turns a trapped chest into a guaranteed one (Darkest Dungeon).

---

## 7. Skill learning

### 7.1 Survey

**Random learning in battle.** Romancing SaGa 2's *glimmer/spark*: the game lists techs of the current weapon the character's spark type allows, computes `TSI = monsterTechLevel − techSparkDifficulty`, discards anything below −6, and rolls candidates from the lowest up; the chance peaks at **20.4% at TSI 0**, is 5.1% at −1, 0.39% at −5, and plateaus at 7.8–9.8% above 0. Related techs lower the difficulty (Fillet is 19, or 15 when sparked from Knee Split). The design lesson: a sweet-spot curve makes "fight things of the right level with the right weapon" the optimal play instead of "fight the strongest thing". Once sparked, a tech moves to the Dojo and can be taught to others. FFV's **Blue Magic** (be hit by the move with Learning equipped and win the fight; some spells need Beastmaster Control to force the enemy to cast) is the shipped learn-from-enemy loop.

**Books, scrolls, shops.** Diablo 1: a book learns or levels a spell, each level raises the Magic requirement 20%, mana cost falls per level (Firebolt 6 → 3), books cost ~1,000 to 27,500 gold. Baldur's Gate scribes scrolls with an Intelligence-based chance *(gk)*; Tibia sells spells at each vocation's guild, some gated behind a 20,000-gold promotion at level 20; DCSS spellbooks grant access and memorisation costs spell levels *(gk)*.

**Trainers with budgets.** Guild Wars 1: a trainer skill costs 1 skill point + gold rising per purchase to a 1-platinum cap after the 20th; elites are only captured from dead bosses with a Signet of Capture; a bar holds **8 skills, one elite**. FF Tactics earns JP per successful action and spends it per job. Octopath: a job's skills 3–7 cost 30 / 100 / 500 / 1,000 / 3,000 JP (4,630 total), the Divine skill 5,000 only after all seven. Battle Brothers: one perk per level, 38 perks in seven tiers, "perk-starved" by design. Darkest Dungeon: seven combat skills per class, **four equipped**, bought and upgraded for gold at the Guild *(gk)*.

### 7.2 Recommendation — dual system, kept fair and manageable

**Shape of the list.** Per class ~45 skills in **five tiers** (I–V), nine per tier, in three *schools* (Warrior: Blade, Bulwark, Warcry). Tier is fixed; **rank** (1–10, from use) is what grows.

**Loadout:** 4 actives + 2 passives + 1 pet stance (between GW's eight and DD's four; a phone battle UI shows four buttons comfortably). Swapping is free in town and at campfires.

**Unlock gates:** Tier I at class level 1, II at 5, III at 12, IV at 20, V at 30; each Tier N skill has one prerequisite in its school at Tier N−1 (Three Houses' lines, not Battle Brothers' point-spend tiers — lines are legible on a phone).

**Path A — town Skill Hall (deterministic):** sells Tier I–III for gold with an Octopath ramp: Tier I 0.1 R, II 0.3 R, III 1.0 R, rising 20% per purchase within a tier and capped at ×3 (GW's rule). Tier IV is never sold.

**Path B — Insight in the dungeon (random, sweet-spotted):** after a meaningful use of a school-X skill, roll an Insight for one **tier-adjacent** skill of X whose prerequisite the player has. Chance = `4% × S(enemyLevel − targetTier×6)`, S = 1.0 at 0, 0.25 at ±6, 0 beyond ±10 (SaGa's TSI curve flattened); Intellect +0.1 pp per point; **pity** guarantees one Insight per 60 qualifying uses. An Insight teaches that player and drops a *Skill Tome* into shared loot (a spark is personal, the party gets a tradeable copy — SaGa's "moves to the Dojo"). Tier IV comes only from Insights, boss Tomes and Skill Chests; Tier V only from endgame bosses and Divine shards.

**Path C — learn-from-enemies:** a few Tier III–IV skills per class are *monster techniques* that can only Insight while the enemy uses them in the fight (FFV's "be hit by it"), making specific enemies worth seeking out.

**Fair in co-op:** Insight rolls are per player on their own actions; Tomes are party loot; shop prices are per player's own band.

**Manageable:** the skill screen shows one school column at a time with greyed prerequisites and a "Recommended" loadout per school; duplicate Tomes feed rank XP (Diablo 1 logic), so a Tome is never dead loot.

---

## 8. Stats that work "realistically"

### 8.1 Survey

**Fallout SPECIAL.** Strength → carry weight, melee; Perception → Lockpick, Explosives, Energy Weapons (and compass enemy markers *(gk)*); Endurance → HP, healing rate; Charisma → Barter, Speech; Intelligence → Science, Repair, Medicine; Agility → Action Points, Sneak, Guns; Luck → critical chance and *all* skills. Seven stats, one headline effect each — the model for "compact and readable".

**D&D 5e passive perception.** `10 + Wisdom modifier + proficiency (if proficient) ± 5 for advantage/disadvantage`; an enemy's Stealth is compared to it to decide surprise and whether traps are noticed without a roll — exactly "perception = fewer ambushes, more traps found".

**Brogue stealth.** Stealth range is 3 / 7 / 14 tiles in dark / normal / bright light, +1 per armour strength point over 12, halved after resting; monsters inside the range have a **flat 25% per turn** to notice you. Range-plus-flat-roll is cheap to compute and easy to explain.

**Speed as action economy.** FFX's CTB: higher Agility yields more turns and heavier actions push the actor's next turn further down the visible queue; Haste pulls it forward. Grandia II's IP gauge: icons travel Wait → Act, and a hit landing during the enemy's Act phase *cancels* the move and shoves the icon back. Darkest Dungeon rolls initiative each round as `speed + random`, so a speed buff lands next round.

**Diminishing returns.** WoW (9.0+) brackets percent-from-rating: 0–30% full, then −10% / −20% / −30% / −40% / −50% penalties at 30 / 39 / 47 / 54 / 66%, hard cap 126%. The alternative rational form, `pct = cap × r / (r + k)`, is what most ARPGs and MOBAs use *(gk)*.

### 8.2 Recommendation — seven stats and the formula shape

Stats range 1–60 (10 is average, caps follow level per §2). Every stat has one *headline* effect the player can feel and at most two secondary ones.

| Stat | Headline | Secondary | Formula shape (starting points) |
|---|---|---|---|
| **Strength** | melee & bow draw damage | carry capacity; heavy-armour speed penalty reduction | dmg × (1 + 0.025·STR); carry = 20 + 3·STR kg; each STR over armour requirement cancels 1 speed penalty |
| **Endurance** | HP | stamina (block/sprint pool), poison/bleed resistance | HP = 30 + 6·END per level band; stamina = 50 + 2·END; resist = 40·END/(END+40) % |
| **Agility** | **speed → more/faster turns** | dodge, ranged accuracy | speed = 100 + 4·AGI; dodge% = 45·AGI/(AGI+60) (rational, caps at 45%) |
| **Perception** | **ambush chance ↓, traps & treasure found ↑** | first-strike, crit *confirm* | ambushChance = base·30/(30+PER); trapReveal radius = 1 + PER/10 tiles; hidden-loot find% = 60·PER/(PER+40) |
| **Intellect** | mana & spell damage | skill/stat **learning rate**, Insight chance | mana = 20 + 4·INT; spell dmg × (1 + 0.025·INT); XP × (1 + 0.01·INT); Insight +0.1 pp/point |
| **Charisma** | shop prices | pet affection gain, party buff duration | priceMult = 1.30 − 0.01·CHA, floor 0.85; sell = 0.40 + 0.005·CHA; buff turns +1 per 15 CHA |
| **Luck** | crit chance | drop quality shift, Insight/pity luck | crit% = 5 + 40·LCK/(LCK+80); drop table weights shifted +0.5 pp per LCK toward higher grades (capped at +15 pp); pity counters tick +1 extra per 20 LCK |

- **Speed-driven timeline.** Each actor accumulates `speed` per tick and acts at 1,000 (FFX/Grandia). Actions carry a *weight*: light 800, normal 1,000, heavy 1,400 (a heavy swing costs 1.4 turns — FFX's rank delay). AGI 30 (speed 220) acts ~1.57× as often as AGI 10 (speed 140): "more attacks" literally. Haste ×1.5, Slow ×0.67; interrupts push the target's accumulator back 300 (Grandia's cancel); the queue is always visible.
- **Diminishing returns** are rational (`cap × x/(x+k)`) for anything that is a *percentage* (dodge, crit, resist, find%) and **linear** for *multipliers* (damage, HP, mana): linear multipliers keep use-based growth rewarding at level 40; capped percentages stop a 60-AGI build becoming unhittable. WoW's brackets are better known but harder to explain on a phone; the rational form has one number per stat to tune.
- **Ambush and traps concretely.** Base ambush 25% per encounter; the party's **highest** Perception halves it at PER 30 (D&D's "someone notices"); *ambushed* means enemies start with +500 in their accumulators. Traps have a difficulty 10–60 and are revealed when any party member enters the radius with PER ≥ difficulty (deterministic, passive-perception style); treasure niches use the same check plus the find% roll, so Perception also pays in gold.
- **Strength as carry weight:** a party over capacity moves slower on the timeline (−10% speed per 10% over) — a felt cost without a hard inventory wall.

---

## 9. Recommendations for Dungeon Crawler

1. **Tiers.** Nine grades F / E / D / C / B / A / S / SS / God, letter + colour + name, ×1.35 base stats per grade, affix slots 0/1/1/2/2/3/3/4/4+unique, +N (max +3…+10) adds 5% of own base per level so a maxed item overlaps the next grade; God is boss-bound and never in a random table — *because every system that works keeps "what it is" and "what you did to it" on separate axes.*
2. **Level-with-use.** Skills, stats and item instances all earn XP only from meaningful, difficulty-gated actions (0.1× at −10 levels, 3× at +10), with a per-run use budget, caps tied to character level, shared participation credit, and no death penalty on XP — *because the Elder Scrolls exploits all come from rewarding the action instead of the challenge, and UO/Kenshi/DCSS show the fixes.*
3. **Durability.** 0–100% with graded stat loss (full → −30% → −50% → Broken with 0 stats, never destroyed by drain), one-tap "Repair all" at ~0.5% of value per point, 25% field kits, and a `maxDurability` that erodes 5 per neglect cycle so only chronic neglect destroys (into salvage) — *because players accept D2/Witcher/Fallout-style wear and reject BotW/ACNH-style loss.*
4. **Materials.** Four nine-rung ladders aligned to the grades (Copper→Starmetal, Rawhide→Ancient Dragon Scale with Dragon Scale at SS, Burlap→Celestial Thread, Pine→Godwood); promotion is deterministic, keeps item XP, and uses monster parts at 35%/4% common/rare with guaranteed boss stacks; generic stones handle +N — *because RuneScape/Terraria legibility plus Minecraft's "upgrade the item you have" is what makes caring for gear pay off.*
5. **Pets.** One per player, always in co-op, a timeline actor controlled by four stances (Fierce/Guard/Mend/Forage), one trait + two actives with a stamina pool, downed-not-dead, no hunger or lifespan, same nine grades, 50% shared XP plus use-based trait growth, and a Wildsong Ranch import capped at grade A with a Ranch-raised trait slot — *because MH/WoW show the control surface and D3/MapleStory show what to avoid.*
6. **Chests.** Four chest types (slot-targeted Gear, Pet Egg, Material Crate, Skill Tome) in Standard/Grand at 0.5 R / 2.5 R of one run's gold, band-centred odds 55/25/14/5/0, dual pity (≥+1 grade in 10, ≥+2 in 40, plus bag-without-replacement for Tomes), dupes become salvage/bond/rank XP, odds and pity counters on screen, and no money anywhere in the loop — *because Hearthstone/Snap/Brawl Stars pity and disclosure are now the baseline players expect, and Google Play asks for it.*
7. **Skills.** ~45 per class in five tiers and three schools with one-prerequisite lines, a 4+2 loadout, Tier I–III sold in town with an Octopath price ramp, Tier IV–V only via sweet-spotted dungeon Insights (4% base, peak at matching enemy level, pity at 60 uses) that also drop a tradeable Tome, and a few Blue-Mage "monster techniques" — *because SaGa's spark curve makes fighting the right enemy the strategy, and GW/DD-style loadout limits keep a big list playable.*
8. **Stats.** Seven stats (STR, END, AGI, PER, INT, CHA, LCK), each with one headline effect; speed-accumulator timeline (act at 1,000; weights 800/1,000/1,400); linear multipliers for damage/HP/mana and rational `cap·x/(x+k)` curves for dodge/crit/resist/find; Perception as passive trap/treasure detection and ambush reduction keyed to the party's best — *because SPECIAL's one-headline-per-stat is the readable model and WoW's cap problem is solved more simply by a rational curve.*

---

## Sources

Tier ladders
- Solo Leveling hunter ranks — https://sportskeeda.com/anime/solo-leveling-s-hunter-ranking-system-explained
- Solo Leveling National Level hunters — https://www.beebom.com/solo-leveling-national-level-hunters-explained/amp/
- Diablo 4 item quality — https://www.ginx.tv/en/item-rarity-quality
- Path of Exile rarity — https://pathofexile.fandom.com/wiki/Rarity
- Monster Hunter World augmentations by rarity — https://monsterhunterworld.wiki.fextralife.com/Augmentations+and+Upgrades
- Monster Hunter Wilds Artian weapons — https://www.monsterhunterwiki.org/wiki/Artian_Weapons_(MHWilds)
- Dark Souls Remastered titanite guide — https://www.rpgsite.net/feature/7207-dark-souls-remastered-titanite-upgrade-guide
- Elden Ring smithing stones — https://www.gamespot.com/articles/elden-ring-how-to-upgrade-weapons/1100-6501026/
- Dragon Quest Monsters ranks and synthesis — https://dragon-quest.org/wiki/Monster_synthesis
- Hades boon rarity values — https://www.pcinvasion.com/hades-guide-olympian-god-boons-skills/2/
- Solo Leveling: Arise grades (SSR) — https://www.pocketgamer.com/solo-leveling-arise/tier-list

Level-with-use
- Skyrim sneak power-levelling — https://www.dualshockers.com/skyrim-power-level-sneak/
- Oblivion Armorer skill and grinding tricks — https://en.uesp.net/wiki/Oblivion:Armorer
- Ultima Online GGS / Rate Over Time — https://uo.com/?p=6342
- RuneScape experience formula — https://oldschool.runescape.wiki/w/Experience
- Kenshi Toughness XP multipliers — https://kenshi.fandom.com/wiki/Toughness
- Bannerlord skills, learning rate and limit — https://mountandblade.fandom.com/wiki/Skills_(Bannerlord)
- DCSS skill training and aptitudes — https://en.wikipedia.org/wiki/Dungeon_Crawl_Stone_Soup
- Final Fantasy II levelling — https://www.rpgsite.net/feature/11516-final-fantasy-ii-how-to-level-up-and-an-explanation-on-the-leveling-system
- Wizardry 8 skills thread — https://steamcommunity.com/app/245450/discussions/0/4738295219694804408
- Project Zomboid skills and books — https://pzfans.com/skills/
- Valheim death skill loss — https://primagames.com/tips/valheim-what-happens-when-you-die
- Dark Cloud / Dark Chronicle synthesis, ABS, WHP — https://darkcloud.fandom.com/wiki/Synthesis
- Vagrant Story affinities — https://vagrantstory.fandom.com/wiki/Physical
- Vagrant Story weapon combination — https://lparchive.org/Vagrant-Story/Mechanics
- Fire Emblem weapon experience thresholds — https://fireemblemwiki.org/wiki/Skill_experience
- Destiny 2 weapon crafting — https://www.dexerto.com/gaming/destiny-2-weapon-crafting-witch-queen-1644295

Durability
- Diablo 2 durability — https://maxroll.gg/d2/resources/durability-quantity
- Minecraft durability — https://minecraft.fandom.com/wiki/Durability
- Breath of the Wild durability critique — https://unwinnable.com/2017/04/27/weapon-durability-in-breath-of-the-wild/
- Tears of the Kingdom durability — https://www.denofgeek.com/games/tears-of-the-kingdoms-weapon-durability-explained/
- Dark Souls 2 durability bug — https://games.softpedia.com/blog/Dark-Souls-2-Scholar-of-the-First-Sin-Will-Finally-Get-the-Weapon-Durability-Loss-Bug-Fixed-478869.shtml
- Fire Emblem durability history — https://www.thegamer.com/fire-emblem-weapon-durability/
- Fallout 3 / New Vegas repair — https://fallout-archive.fandom.com/wiki/Repair
- Morrowind Armorer — https://app.uesp.net/wiki/Morrowind:Armorer
- Witcher 3 repair — https://primagames.com/tips/how-repair-your-sword-witcher-3-wild-hunt
- Animal Crossing tool durability — https://www.thonky.com/animal-crossing-new-horizons/tool-durability

Materials
- Terraria ores — https://terraria.wiki.gg/wiki/Ores
- Monster Hunter Rise Rathalos Plate drop rates — https://www.gamerguides.com/monster-hunter-rise/guide/monster-materials/rathalos/rathalos-plate
- Valheim armour progression — https://www.exitlag.com/blog/valheim-armor/
- Horizon Zero Dawn modifications — https://horizonzerodawn.wiki.fextralife.com/Modifications

Pets
- Torchlight II pets — https://www.runicgames.com/blog/2012/03/30/pets-of-torchlight-ii/
- Diablo 3 follower mechanics — https://maxroll.gg/d3/resources/follower-mechanics
- MapleStory pet formulas — https://meowdb.com/msclassic/formulas/pets
- WoW hunter pets — https://warcraft.wiki.gg/wiki/Hunter_pet
- Monster Hunter Rise buddies — https://monsterhunterrise.wiki.fextralife.com/Buddies
- MHR Palico guide — https://www.highgroundgaming.com/mhr-palico-guide/
- Temtem vs Pokémon — https://www.thegamer.com/5-main-differences-between-temtem-and-pokemon/
- Monster Rancher Advance 2 raising — https://legendcup.com/faqmra2raisinginfo.php
- (Guild Wars 2 pet wiki was offline at time of research: https://wiki.guildwars2.com/wiki/Pet)

Chests / gacha
- Genshin / HSR pity numbers — https://gurugamer.com/pc-console/gacha-pity-systems-explained-the-real-odds-behind-90-pulls-27402
- Hearthstone pack statistics and duplicate protection — https://hearthstone.wiki.gg/wiki/Card_pack_statistics
- Brawl Stars Starr Drop rates — https://www.sportskeeda.com/esports/starr-drop-rates-brawl-stars-explained
- Clash Royale chest cycle — https://www.charlieintel.com/games/clash-royale-chest-cycle-explained-how-to-get-royal-wild-and-champion-chests-230804/
- AFK Arena tavern rates — https://afk.guide/?p=558
- Marvel Snap Spotlight Caches — https://marvelsnapzone.com/spotlight-caches-details-drop-rates-and-card-acquisition-changes/
- Slay the Spire relic/chest odds — https://slaythespire.wiki.gg/wiki/Relic
- Hades shop prices and chamber rewards — https://gamerofpassion.com/hades-beginner-guide-quick-references
- Risk of Rain 2 difficulty and chest pricing — https://riskofrain2.wiki.gg/wiki/Difficulty
- Darkest Dungeon curios — https://darkestdungeon.wiki.gg/wiki/Curio
- Google Play loot-box odds disclosure — https://fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds

Skill learning
- Romancing SaGa 2 glimmer/TSI table — https://saga.fandom.com/wiki/Glimmer
- FFV Blue Magic — https://rpgsite.net/feature/11955-final-fantasy-v-blue-magic-how-to-learn-every-spell-for-the-blue-mage
- Diablo 1 spellbooks — https://diablo.fandom.com/wiki/Spellbook
- Tibia magic — https://strategywiki.org/wiki/Tibia/Magic
- Guild Wars skills, trainers, Signet of Capture — https://guildwars.fandom.com/wiki/Skill
- FF Tactics JP — https://StrategyWiki.org/wiki/Final_Fantasy_Tactics/Gameplay
- Octopath Traveler JP costs — https://octopathtraveler.fandom.com/wiki/Skills
- Battle Brothers perks — https://gamerofpassion.com/battle-brothers-perk-guide/

Stats
- Fallout SPECIAL effects (GECK) — https://geck.uesp.net/wiki/Stats_List
- D&D 5e passive perception — https://dungeonsanddragonsfan.com/what-is-passive-perception-dnd-5e/
- Brogue stealth — https://brogue.wiki/wiki/Stealth
- FFX CTB window — https://jegged.com/Games/Final-Fantasy-X/Tips-and-Tricks/CTB-Window.html
- Grandia II IP gauge — https://en.wikipedia.org/wiki/Grandia_II
- Darkest Dungeon speed/initiative thread — https://steamcommunity.com/app/262060/discussions/0/490123938439644214
- WoW combat rating diminishing returns — https://warcraft.wiki.gg/wiki/Rating
