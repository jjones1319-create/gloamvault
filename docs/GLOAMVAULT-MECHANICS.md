# Gloamvault — how the game works

*A plain-words description of every mechanic, written for James on 2026-11-02 after Phases 18 and 19. It says what each system does, what it feels like on the phone, and whether it is built already or still to come. The rulebook behind it is `docs/03-GAME-DESIGN.md`; the numbers quoted are the current starting points and will keep moving as the balance runs say.*

---

## 1. The game in one page

Gloamvault is a party dungeon crawler for your phone, played in landscape with a thumb on a joystick and an **A** button. You make a hero, walk into a dungeon one floor at a time, fight monsters in turn-based battles, find gold, gear and materials, and come back up to the town of **Emberfall** to repair, upgrade, learn, and open chests. Up to four people can play together, each walking their own hero; alone, your party fills up with named wayfarers you draw from a chest.

The five things the game is built around:

1. **Stats you can feel.** Faster means more turns. Sharper eyes mean fewer ambushes and more traps found.
2. **Everything grows by use.** Swing a sword and your Strength and the sword both grow. Cast and your Wisdom grows. Levels come from battle XP on RuneScape's curve.
3. **Care for your things.** Gear wears as you use it and is repaired and upgraded with materials; neglect it and it breaks.
4. **Better together, fine alone.** Co-op is the same game with friends in the party; solo is never gated.
5. **Readable on a phone.** Big targets, short fights, one screen at a time.

The loop: **Town → choose a dungeon and zone at the Waystone → a delve of a few floors → back to town** by the Waystone, by walking out, or by dying. Gold is found only in the dungeon and spent only in town, and it is the stake: die and you lose the gold you were carrying, never your gear, levels or skills.

### What is built today (version 0.19)

The game is being rebuilt as a Unity app for Android (the web version that came first still exists but is frozen). On your phone right now:

- **Floor 1 of Gravehollow Keep** as a large hand-laid level: 36 rooms and halls, a lever, secret panels, a key and a locked door, a stair down, two side exits, and a map that fills in as you walk.
- **Walking**: the joystick, a follow camera you can pan with a second finger, doors that open with A, and the four moves at marked spots — crawl under a timber, squeeze between crates, jump a pit, climb a low wall.
- **The rules of the floor**: random fights come as you walk, placed monsters stand in rooms, chests, gold, curios, traps, the hearth and the stair all work with A, the light falls and the floor clock ticks, and the hunter comes late.
- **Fights that you can see**: the party and the monsters line up where you stand, the camera swings to the side, and every blow, cast, flinch and fall plays out with floating numbers. For now the fight makes its own choices (the next phase gives you the buttons).
- **Skill trees**: every class's tree on a screen, with points to spend on a test hero.
- Everything else in this document is designed, and most of it is already running inside the rules engine from the web version; the phone gets its screens phase by phase (the list is at the end).

---

## 2. Your hero

### 2.1 Species and class

You choose a **species** (six: Human, Dwarf, Elf, Halfling, Orc, Draconid) and a **class** (six today, a seventh later): the **Warden** (shield and armour, holds the line), the **Blade** (fast two-weapon fighter), the **Mender** (healer and holy caster), the **Ranger** (bows and traps), the **Shade** (daggers, stealth, poison) and the **Arcanist** (the big spells). A **Beast Tamer** comes later.

Each species gives small stat bonuses and a trait (dwarves and elves see one light band brighter in the dark; dwarves resist poison; draconids are immune to Burn). Each class sets your attribute bonuses, your resource pool (Stamina for fighters, Mana for casters), the armour you can wear and the weapons you can use.

### 2.2 The eight attributes

Every attribute has one headline effect you can feel:

| Attribute | What you feel | Trains by |
|---|---|---|
| Strength | physical attack; carries heavy gear without slowing | landing melee hits, carrying, forcing doors |
| Agility | **Speed: more turns, sooner**; dodge | attacking, dodging, disarming |
| Vitality | HP | taking damage, surviving low |
| Endurance | Defense and the Stamina pool | taking hits, blocking |
| Wisdom | spell attack, healing, the Mana pool, learning speed | casting, healing |
| Perception | fewer ambushes; traps, secrets and treasure found | finding things, scouting, critical hits |
| Willpower | resistance to statuses; holding a cast when hit | resisting, holding casts |
| Luck | critical hits and loot quality | never trains; only species, gear and blessings |

A new hero starts around 10 in each (an ordinary adult), with six free points to place at creation (at most three in one). Thirty is heroic, fifty legendary.

### 2.3 Derived stats

From attributes, gear and level the game works out HP, physical and spell Attack, Defense, Speed, the pool size and its regeneration, Accuracy, Dodge, Crit, and Resistance. The hero card shows the results, never the formulas. A few examples at the start: HP is about 100; Speed is 100 and each point of Agility above 10 adds 5; plate armour costs 20 Speed unless your Strength carries it.

### 2.4 Levels — RuneScape's curve

Your **level** comes from battle XP, Final Fantasy style, and the curve is RuneScape's: each level costs about 10% more than the last, level 99 is the cap, and the whole ladder is scaled so that level 2 takes about 4,000 XP. A fresh hero clearing all of Floor 1 ends around level 2; a floor's worth of fighting is roughly a level and a bit early on, and far less later.

**Each monster pays XP by its hitpoints** — four points per hitpoint, as RuneScape does, plus a little more for elites and bosses — so a stronger monster is worth more. A won fight's XP is split equally among the heroes standing, and scaled by the **level gap** between the monsters and your party's average level: fight something five levels above you and you earn double; something five levels below pays a fifth, ten below almost nothing. Grinding weak floors pays less and less. Each level-up adds a point to one of your class's attributes in turn, a point of Vitality every second level, three HP — and one **skill point** (section 4).

Skills, attributes, gear and pets grow **by use** alongside levels; the level is the second road, not a replacement.

### 2.5 The one rule against grinding exploits

Use-XP is only paid for actions that resolve against a real enemy near your level or resolve a real dungeon event (a trap, a lock, a curio). Hitting walls, allies or corpses, casting at nothing, re-using a curio: nothing. The first twenty meaningful uses of a skill in a delve pay full XP, the next forty pay half, then a tenth — the budget resets in town.

---

## 3. Fights

### 3.1 Turn-based on a speed timeline

Fights are **turn-based**. Every hero, pet and monster has an energy bar that fills by its Speed each tick; at 1,000 it acts, and the action's **weight** is taken off: light actions 800, normal 1,000, heavy 1,400. So a quick dagger fighter at Speed 150 gets more than twice the turns of a slow greatsword at Speed 100. A **timeline strip** shows the next eight actors in order, so waiting is planning. Haste and Slow change Speed by half; a heavy hit on someone charging a big spell knocks them back down the strip unless their Willpower holds.

On your hero's turn you choose: a **basic attack** (free), one of your **four equipped skills** (costs Stamina or Mana), your class **Ultimate** (costs 100 Momentum, which fills as you act and get hit), **Guard** (half damage until your next turn, some pool back), an **item**, **swap row**, or **flee** (a party vote with a shown chance). Pets act on their own by their stance.

### 3.2 Rows, reach, elements

Each side has a **front row and a back row**. Melee reaches the front row; spears and whips reach either; bows, spells and thrown things reach either row. The back row is where casters and archers stand and where a Warden's shield keeps the fight.

Damage is physical (slash, pierce, crush) or elemental (Fire, Frost, Lightning, Poison, Holy, Shadow), and monsters have weaknesses and resistances: Frost cracks the undead's hides, Holy burns them, Fire takes the spiders, Lightning the wet things of the drowned vault.

### 3.3 Statuses

Every debuff has a cleanse and every buff has a strip, so support skills matter. The main ones: **Bleed, Poison, Burn** (damage over time); **Chill** (slower; a second Chill is a **Freeze**: the frozen cannot act and the next physical hit shatters them for extra damage); **Shock** (less accurate, chains to a neighbour); **Stun, Daze** (lose a turn or energy); **Blind, Silence, Weaken, Fear, Root, Web, Grab**; and the good ones **Shield, Regen, Haste, Fortify, Taunt**. Bosses shrug off the hard controls (a Freeze becomes a Chill on them).

### 3.4 How long a fight is, and auto

Ordinary fights run three to six rounds, elites six to eight, bosses ten to fifteen with phases. Every hero carries one **AI rule** (a gambit like *if an ally is under 40% HP, heal the lowest; else attack the nearest*) and can be set to **auto**; a disconnected friend's hero runs its rule. The speed can be doubled or tripled, and you can skip to the result when everyone is on auto.

### 3.5 The fight on your phone (built in Phase 19)

When a fight begins on the floor — you walk up to monsters standing in a room, or something finds you while walking — the party and the monsters line up where you stand: your hero turns to face them, the Mender who travels with you appears beside you, pets with you, the monsters in their rows ahead. The camera swings to the side, and the fight plays out one action at a time: swings, shots, casts, flinches, numbers floating up (gold on a critical, green for healing, grey for a miss), falls, and a summon's creature called for its strike. **A** hurries the rest. When it is over a card tells what happened and what dropped. The next phase (20) replaces the auto choices with your own buttons, a turn strip, targets and items.

---

## 4. Skills and skill trees

### 4.1 Each class is a tree

Every class has 45 skills in three branches (schools) of five tiers, three skills a tier — the Warden's *Bulwark · Vanguard · Warcry*, the Blade's, the Mender's, and so on. The **Arcanist** is the exception: four branches of fifteen, **Fire · Frost · Storm · Summoning** (sixty skills), because its branches are its elements. Each skill has a tier, and every tier-two-and-up skill needs one skill of the tier below it in the same branch, so a tree reads as columns you can follow down.

| Tier | Opens at level | Point cost |
|---|---|---|
| I | 1 | 1 |
| II | 5 | 1 |
| III | 12 | 2 |
| IV | 20 | 2 |
| V | 30 | 3 (endgame, locked for now) |

### 4.2 Skill points

A new hero has **three points**, spent on its three starter picks. Every level-up gives **one more**. A whole tree is 81 points, so a level-40 hero owns about half of one: you choose the branches you grow. On the tree screen you tap a skill to read it, **Learn** it if it is open (the right tier, the prerequisite known, the points in hand), and put it in one of your **four active slots or two passive slots**; the Ultimate has its own button. Points are spent and the loadout changed anywhere outside a fight.

### 4.3 Rank still grows by use

Every skill has a **rank** from 1 to 10 that grows by using it meaningfully; each rank makes it a little stronger and a little cheaper, and rank 10 is **Mastery**, a bonus line of its own.

### 4.4 The other roads (no points)

- **Insight**: using a branch's skill against the right enemy can spark a tier-adjacent skill you don't have yet — rare, more likely against enemies near the skill's level, with a pity counter so it always comes eventually. An Insight teaches you and drops a **Skill Tome** for the party.
- **Skill Tomes** are items; read one in town to learn its skill, or gain a rank if you know it. They come from Insights, bosses and the Skill Tome chest.
- **Monster techniques**: a handful of skills per class are learned only by witnessing a monster use them, certain by the tenth time.
- **The Skill Hall** in town sells Tiers I–III for gold (dearly, now that points buy the tree) and **resets a tree** for gold, giving every point back.

### 4.5 Summons (the Arcanist)

Six summons live in the Summoning branch, one a tier: **Ember Imp** (Fire, one enemy), **Rime Stag** (Frost, every enemy, Chill), **Storm Hawk** (Lightning, every enemy, Shock), **Bog Serpent** (Poison, one enemy), **Dawn Warden** (Holy to every enemy, a shield for the party) and **Night Maw** (Shadow, one enemy, fear). Each is a heavy Mana cast that calls its creature for **one great strike**, and then it is gone — never a body that stays on the field (that is what pets are). On the phone the creature appears before the caster, strikes, and vanishes.

### 4.6 Field skills

Every class also has field skills that grow by use outside fights: **Haggling** (prices), **Cartography** (the map reveals more), **Cooking** (a meal at the rest room), **First Aid** (bandage, revive in a pinch), **Lockpicking** (locked chests), **Trap Disarm**.

---

## 5. Exploring a floor

### 5.1 Walking a floor

Each floor is a large level you walk with the joystick — Floor 1 is 36 rooms and halls, about five to ten times the size of a web-version floor. The **map** fills in as you go: rooms you stood in are drawn, rooms seen through a door are outlined with a question mark, the rest is dark; it remembers what you found between visits. Doors open with A; some are **locked** (find the key on the floor), some are **gated** by a lever elsewhere, some are **secret panels** you find by facing the wall and pressing A. A floor has an **entrance**, a **stair down**, and sometimes side exits you discover from inside — and those are the only ways in and out.

Marked spots ask for a move: **crawl** under a fallen timber, **squeeze** through a crack between crate stacks, **jump** a broken floor, **climb** a low wall. Walk up, press A, and the hero does it; there is no free platforming and no missed jumps.

### 5.2 Random encounters

While you walk, a clock runs: every 25 to 50 seconds of walking at full light something finds the party and a fight begins — like the old Pokémon games, the monsters that find you are not seen first. The dark hurries the clock (in the pitch dark fights come more than twice as often); after each fight there are 20 seconds of grace. Two consumables bend it: **Hushsmoke** keeps random encounters away for minutes of walking (burning twice as fast in the dark), **Callsmoke** doubles them and skips the grace, for when you want to grind.

The floor's **placed monsters** are different: they stand in their rooms where you can see them, and the fight starts when you walk up to them (or press A). A room with monsters in it is not cleared until they are beaten.

Random encounters come at your party's level, clamped to the floor's band — a floor's monsters never outgrow it, so going back to an early floor at a high level means weak fights that pay little.

### 5.3 Light

One dial from 0 to 100. It falls as you enter new rooms (two points a room on a walked floor), and a torch or a brazier brings it back. The light bands change the odds: in the **Radiant** band you scout better and ambush monsters; in **Dim** and **Shadowy** light ambushes creep up and loot gets better; in the **Dark** and the **Pitch** you are ambushed often, monsters hit harder, and the random-encounter clock runs fast — but the loot is richest. Push your luck or carry torches. Dwarves and elves read one band brighter.

### 5.4 Perception: traps, secrets, treasure, scouting

**Detection** is Perception plus the light plus skills and your pet. Entering a room, every trap whose difficulty is under the party's best Detection is **spotted**: a plate appears, and A offers to disarm it with your hero's hand (the chance is shown; a fumble sets it off). A trap you did not spot fires when you walk over it or loot the room. Secret doors and hidden treasure work the same way. **Scouting** sometimes reveals what is in the rooms next door before you enter.

### 5.5 Ambush

Every fight rolls surprise: the light, the monster family (ambushers), and your best Perception decide whether the monsters get a free opening or you do.

### 5.6 The floor clock and the hunter

A visible clock ticks once per room entered and once per fight round. Past a threshold, the floor's **hunter** — a unique stalking monster, above the floor's level — enters the floor and comes one room closer every two ticks. It can be beaten and drops a guaranteed rare part; taking the stair ends the chase. On a walked floor the hunter comes late (the clock runs about sixty ticks longer than the web's forty), so a careful explorer meets it only on a long floor.

### 5.7 Rooms, curios, chests, the hearth

Rooms are fight rooms, treasure rooms (chests and gold), curio rooms (an object with choices: a sealed cask you can open or smoke out; a lost lantern), trap rooms, the rest room (a hearth: one rest per floor heals the party, cooks a meal, and advances the clock), a merchant on the floor before a boss, the key room, and on the last floor of a zone the **boss**. On the phone every one of these is a thing you walk up to and press A on: *Open the chest*, *Take the gold*, *Look at the cask*, *Disarm*, *Rest*, *Go down*.

---

## 6. Gear and caring for it

### 6.1 Slots and families

Eleven slots: main hand, off hand (a shield, a focus or a second weapon), helmet, chest, legs, boots, gloves, two rings, a talisman, a relic (an active effect once per fight) — plus the pet. Armour comes in four **families** that are also material ladders: Plate (metal, the Warden), Mail (metal), Leather (hide), Robes (cloth). Heavy gear has a Strength requirement; under it you lose Speed, over it the armour's speed penalty eases.

### 6.2 Nine grades, F to God

| Grade | Name | Where it comes from |
|---|---|---|
| F | Crude | early floors, starter kits, the shop |
| E | Common | early floors, the shop |
| D | Fine | floors 4–8 |
| C | Superior | floors 7–13 (the last grade shops sell) |
| B | Masterwork | floors 10–20, chests |
| A | Heroic | floors 16–28, chests, zone bosses |
| S | Legendary | floors 24–38, Grand chests, final bosses |
| SS | Mythic | floors 33+, endgame bosses |
| God | Divine | endgame bosses, or forged from ten Divine Shards; a unique power each |

Each grade is about 35% stronger than the last. **Grade is what the item is; +N and item level are what you did to it.** +N costs gold and stones and adds 5% of the item's own base per level, so a cared-for +10 Heroic beats a fresh Legendary. Affixes (extra lines: attributes, element damage, on-hit effects, gold found) roll by grade and can be locked and re-rolled at the blacksmith. Sets give two- and four-piece bonuses; named uniques and the eleven God items have signature powers.

### 6.3 Items level by use too

A weapon used on monsters near your level gains item XP and **item levels**, and an **affinity** for the family it kills most (bonus damage against them). Level 10 is *Awakened*.

### 6.4 Durability

Every item has durability 0–100% and a ceiling (maxDurability) that starts at 100. Weapons wear per meaningful hit, armour per hit taken, shields per block, about 25–35% per delve at your level. Above 60% full effect; down to 20% the stats fall off; under 20% **Damaged** (half stats, a red pip); at 0% **Broken** (no stats, still worn, never lost by wear alone). But each time an item **reaches 0**, its ceiling drops by 5 for good; at a ceiling of 0 the item is destroyed into salvage. A careful player never sees it. **Repair all** at the blacksmith is one tap; Repair Kits and the Field Repair skill patch things in the dungeon. A party wipe costs every worn item 10%.

### 6.5 Materials and promotion

An armour piece's **material is its grade** (Copper, Bronze, Iron, Steel, Blacksteel, Skysteel, Adamantine, Orichalcum, Starmetal for metal; hide, cloth and wood ladders beside it). Upgrading with the next material **promotes** the item one grade: same item, same affixes (one re-rolls), its item level and affinities kept, +N reset. Promotion is deterministic: a fixed count of material and gold, no failure roll — chance never touches crafting. Materials come from monster families (a common part on most kills, a rare part now and then, a guaranteed stack from bosses), from Material Crates, and from salvaging what you don't need.

---

## 7. Gold, the town and chests

### 7.1 Gold and the bank

Gold is found only in the dungeon — on monsters, in treasure rooms, in curios, by selling parts. It is **unbanked** until you come home; a wipe loses it. The **Bank** lets you deposit before a delve so a run starts insured. Prices in the game are written against **R**, the gold a typical delve at your level brings, so the economy keeps its shape as you go deeper.

### 7.2 Emberfall

- **Blacksmith**: repair all, promote, +N, re-roll affixes, salvage, a weekly material stock.
- **Skill Hall**: Tiers I–III for gold; resets a tree.
- **Curio Merchant**: the chests, with the odds and the pity counters on screen.
- **Stables**: hatch eggs, bond, train stances, treats.
- **Bank**, **Quest Board** (daily and weekly contracts that pay gold and chest keys), **the Lantern Inn** (rest, save, the roster of up to twelve heroes, the party of four, the AI-rule editor), **the Ember Shrine** (raise the dead, the Memorial), and **the Waystone** (choose a dungeon and a zone, start a delve).

### 7.3 Chests — gold only, never money

Gear chests (weapon, armour or trinket, by sub-type so duplicates halve), Pet Egg chests, Material Crates, Skill Tome chests (drawn from a bag without replacement, so a class's list completes in a known number), and the **Wayfarer Chest** that calls a new named party member to the Inn. Standard and Grand sizes. Odds are band-relative so a chest never sells an outgrown item, two layers of pity are counted and shown, and duplicates never go to waste (gear salvages, a duplicate pet adds a bond star, a duplicate Tome is rank XP). There are no purchases, timers or stamina anywhere in the game.

In the dungeon, small and large chests sit in treasure rooms and secret rooms; a locked one needs Lockpicking or a Skeleton Key, which also makes a trapped chest safe. A **merchant** stands on the floor before each boss with potions, torches, kits, a few pieces of gear, and he buys your parts.

---

## 8. Pets

One pet per hero, always present. A pet is its own actor on the timeline — its own Speed, HP, one action a turn, resolved on its own, so eight actors keep a human pace. You control it with a **stance**: *Fierce* (attack your target), *Guard* (intercept hits aimed at you), *Mend* (heal the lowest ally a little), *Forage* (no attacks; adds its Perception to scouting and finds, and 10% more gold). Each pet has a bloodline trait that grows by use and two actives unlocked at pet levels 5 and 15, fed by a stamina pool that refills between fights.

A pet at 0 HP retreats for the fight and returns at half health next time; it never dies. No hunger, no lifespan; a treat once per delve is a bonus. Pets come in the same nine grades, and grade never changes — a better pet is a new egg, so the pet hunt is a loot loop. About sixteen species at launch, drawn from the dungeon's families. (Breeding and fusion belong to the companion game, Wildsong Ranch, whose monsters can one day be imported.)

---

## 9. The party, alone or together

### 9.1 The chosen hero and wayfarers

The hero you make at New game is your **chosen hero**. Every other party member is a **wayfarer** — a named adventurer from a fixed cast of eighteen (three per class across the species), drawn from the Wayfarer Chest, graded D to A. A wayfarer arrives at the level of your lowest living hero with their class's starter kit and is a hero in every way from then on: they level, grow by use, wear gear, take a pet, and can die. The Inn holds twelve heroes; the party has four places from the start.

*Until the party screen arrives (Phase 22), the phone's walked floor seats your dwarf Warden and an unseen Mender who shows up for the fights; a fresh hero alone could not clear Floor 1 in the balance runs, while the pair clears it almost every time.*

### 9.2 Co-op (1–4 players, coming in the later phases)

One phone hosts, sequencing every command; everyone applies the same commands in the same order, so the game is a seed plus a command log — replays, resuming, and a friend rejoining after a drop all fall out of that. When the next actors on the timeline are allies, their owners decide **at the same time**; a 20-second timer runs each decision, after which the hero's AI rule acts. On a walked floor each player explores apart and can call the others. Loot: gold is split at banking, items go to a shared pile picked in turn (the poorest picks first), and materials and Tomes are copied to everyone.

---

## 10. Dungeons

### 10.1 Gravehollow Keep (the first)

Eight floors in three zones, each with its own monster family, hunter and boss: the **Cellars** (floors 1–3: vermin, spiders, and the Grinning Company bandits; boss: the Grinning Captain), the **Crypts** (4–6: the undead and the things that feed on them), the **Drowned Vault** (7–8: the Tidebound cult, constructs, oozes, Sister Naesa, and on the last floor the **Hollow King**). A delve is one zone, ending at its boss; the Waystone remembers the deepest floor you reached, so the next delve can start below it.

Monster levels climb by floor (1, 2, 4, 5, 7, 8, 11, 13). Elite rooms carry champions with affixes, more of them deeper. Bosses have phases and arena rules.

### 10.2 The dungeons after it

The **Fungal Deep** (capfolk, trolls, slimes; the Sporemother), **Emberforge** (salamanders, forge golems, the deep dwarves; the Forge-Tyrant) and **Frostmarch Citadel** (frost giants, wights, ice wyrms; the Pale Dragon, where Dragon Scale drops). Each unlocks when the previous final boss is dead.

### 10.3 Difficulty you can read

Every fight, scouted room and floor shows a **threat**: Easy, Even, Dangerous or Deadly, from the monsters' level against your party's. Going too deep is deadly by construction. After the first clear, **Hard** and **Dread** presets open per dungeon, and a menu of **Pacts** (chosen handicaps that pay in better chests) lets you make any delve harder on purpose.

---

## 11. Death

You choose how death works when you start a save, and may only ever make it gentler:

- **Mortal** (recommended): a hero who dies in the dungeon is dead. The living carry the body; a strong enough healer (level 10 with a revive skill) can raise it in the dungeon for a level, or the Ember Shrine can in town for gold and two levels. If the whole party falls, nobody carries anyone: they are **lost for good**, their worn gear and pets brought home, each leaving a **legacy** of half their battle XP for a living hero (the chosen hero's goes to your next chosen hero) and a line on the Memorial.
- **Nightmare**: the Mortal rules, and your chosen hero is your life — if they die, the save ends and everything is lost.
- **Sheltered**: the fallen get back up after the fight from a floor's revive budget, and a wipe wakes the party at the Inn; nobody is ever lost.

In a fight, 0 HP means **downed**: an ally has three of your turns to revive you (a Mender skill, a Phoenix Feather, First Aid at rank 5). Fleeing is a party vote with a shown chance. A wipe always loses the gold you carried and 10% durability on everything worn.

---

## 12. The first half hour

New game: pick the death rule, then a species, a class, three Tier I skills, a pet egg of three, six points and a name — two minutes. Emberfall at dusk; the blacksmith hands you a Crude sword and says the Keep's cellars are paying bounties. The Waystone offers Gravehollow's Cellars. Floor 1's first rooms teach the timeline, a trap your Perception shows you, and the stairs; a lesson floor with short coach marks. Back in town with a delve's gold: repair all, buy a skill, open a chest, hatch the egg — and save for a Wayfarer Chest, your first party member.

---

## 13. What comes next (the phases)

| Phase | What it adds |
|---|---|
| 20 — The fight HUD | your own buttons in fights: the turn strip, skills and the Ultimate, targets, items, auto and speed, flee; a review file for you |
| 21 — The delve HUD | the light and clock on screen, the full map screen, rest, the merchant, curio choices, results and end cards |
| 22 — Heroes and saves | New game, the chosen hero, the party of four, saves on the phone |
| 23 — Town | Emberfall's buildings: blacksmith, Skill Hall, chests, stables, bank, board, inn, shrine |
| 24 — Sound and polish | music, sound effects, haptics, settings |
| 25+ | the rest of Gravehollow's floors, co-op, the later dungeons, the seventh class, the summons' own creatures |

Numbers in this document are the current tuning: the balance runner (a scripted player that walks Floor 1 hundreds of times) and your play decide where they settle.
