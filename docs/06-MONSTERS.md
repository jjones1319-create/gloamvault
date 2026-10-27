# 06 — Monsters

*Last updated 2026-10-26 · rev. 1 · numbers are tuning starting points*

**How to read this file.** Every monster is a template over a **per-level baseline** the simulator owns and tunes: at level L, **HP 40 + 12L · Attack 8 + 2L · Defense 2 + 1.5L · Speed 100 · gold 5 + 3L**. An entry gives multipliers of that baseline (HP× / Att× / Def× / gold×), an absolute Speed, and an **XP class** (fodder 1 · special 2 · elite 3 · monster 6 · boss 25, times the level's XP unit). Monster level is the floor's (rulebook §11.2): Gravehollow F1 L1 · F2 L2 · F3 L4 · F4 L5 · F5 L7 · F6 L8 · F7 L10 · F8 L11 · F9 L13 · F10 L14. **Roles** are Vermintide's, and every family has all five: **Fodder** (many, weak), **Elite** (armored — needs the right damage type), **Special** (a disabler — Grab / Net / Web / Stun / Fear / pull — that removes one hero until the party reacts), **Monster** (big, rare, a fight on its own), **Boss**; plus the zone's **Hunter** (§4.5) and the **Elite affixes** of §2. Attack lines read `Name — type/element — weight — multiplier — effect — AI weight %` (weights sum to 100; the behavior line overrides them). Statuses are only the rulebook's set (§3.5). Each entry becomes `content/monsters/<id>.json` with the block's field names; the visual brief becomes `art/briefs/monsters/<id>.md` (`11-ART-PIPELINE.md`); encounter tables go to `content/encounters/<id>.json` (one record per encounter; `10-TECH-PLAN.md` §3 owns the layout). A `Technique:` line names the class-sheet skill(s) a monster teaches (`docs/classes/<class>.md` owns the skill; this file owns which monster teaches it). Nothing is borrowed from another franchise; generic words (skeleton, ghoul, troll) are the only shared vocabulary.

---

## §1 Families and material map

Twelve families across four dungeons. **Materials** follow the ladder of rulebook §6.5; a natural drop that is not on the ladder (bone, pearls) is a **rare part** that sells or sockets as an affix stone. Each dungeon uses one **regional variant** name per grade with identical numbers (Steel / Bluesteel, Silk / Spidersilk). The ambush modifier adds to the surprise roll of §4.4 (+15 is the rulebook's ceiling).

| Family | Dungeon / zone | Levels | Materials dropped (common / rare) | Signature statuses | Ambush mod | Weak to | Resists |
|---|---|---|---|---|---|---|---|
| **Vermin & the Grinning Company** | Gravehollow / the Cellars (F1–3) | 1–4 | Rawhide, Copper, Burlap, Pine; Leather (E) from F2 / Rat-tail Charm, Marked Cards (affix stones), Bandit Lockpick (a Skeleton Key) | Bleed, Poison, Web, Grab (net), Fear | +15 (rats and bandits ambush) | Fire (vermin), Blunt (Bruiser) | Poison (vermin ×0.5); bandits none |
| **The Restless Dead** | Gravehollow / the Crypts (F4–6) | 5–8 | Bronze, Iron, Linen, Wool, Ash; Cured Ghoulhide (= Boiled Leather, D) / Bone Shards (sell, +Vit stone), Grave Candle (Holy stone) | Fear, Grab, Web, Curse, Blind, Daze | −5 (they shamble; bats and wraiths +10 individually) | Holy ×1.5, Fire ×1.5 (corpses), Blunt ×1.5 (bone) | Pierce ×0.5 (bone), Shadow ×0.5; immune Poison, Fear, Bleed (bone) |
| **The Tidebound** | Gravehollow / the Drowned Vault (F7–9) | 10–13 | Steel, Silk, Yew; Sharkskin (= Wolf Hide, C) / Brine Pearl (Frost stone), Tide Glass (Lightning stone), Sentinel Core | Chill, Grab, Root (pull), Silence, Curse, Petrify | +5 (tentacles +15 individually) | Lightning ×1.5 (wet), Blunt (sentinels), Fire (oozes) | Frost ×0.5; constructs immune Poison, Bleed |
| **Capfolk & cave beasts** | Fungal Deep / Mycelium Gardens | 12–16 | Boiled Leather, Oak; Iron / Spore Sac (Poison stone), Owl Feather (Detection stone) | Poison, Daze, Blind, Silence | −10 (capfolk), +15 (beasts) | Fire ×1.5 | Poison ×0.5; capfolk immune Poison |
| **Trolls & slimes** | Fungal Deep / Troll Warrens | 17–21 | Wolf Hide, Steel, Yew / Troll Marrow (Regen stone), Acid Gland (wear stone) | Grab, Weaken, Bleed, Slow | +5 | Fire ×1.5 (trolls), Frost (slimes) | Blunt ×0.5 (slimes), Slash ×0.5 (slimes split) |
| **The spore-touched** | Fungal Deep / Spore Heart | 22–26 | Wolf Hide, Silk / Blacksteel (B) seed stock / Bloom Heart (Regen stone), Hierophant's Eye | Poison, Silence, Curse, Mark | 0 | Fire ×1.5, Holy ×1.5 | Poison immune, Frost ×0.5 |
| **The Cinderborn** (deep dwarves) | Emberforge / Ash Halls | 24–28 | Blacksteel, Glyphweave, Ironwood / Ash Ingot (Fire stone), Cinderborn Seal | Burn, Grab (chain), Fortify, Stun | +5 | Frost ×1.5, Lightning | Fire ×0.5, Blunt ×0.5 (plate) |
| **Forge-golems & constructs** | Emberforge / the Foundry | 29–33 | Blacksteel, Skysteel (A) from F6; Ironwood / Golem Core (Defense stone), Rivet Pack | Stun, Daze, Fortify, Grab | −15 (they are loud) | Lightning ×1.5, Blunt ×1.5 | immune Poison, Bleed, Fear; Slash ×0.5, Pierce ×0.5 |
| **Salamanders & fire elementals** | Emberforge / Magma Throat | 34–38 | Skysteel, Glyphweave, Ebony / Ember Heart (Fire stone), Salamander Tongue | Burn, Fear, Blind, Weaken | +10 | Frost ×1.5 | immune Fire, Burn; Pierce ×0.5 (elementals) |
| **Frost giants & winter wolves** | Frostmarch / Outer Walls | 36–40 | Basilisk Scale, Adamantine, Moonweave / Giant's Tooth (Str stone), Wolf Pelt (Speed stone) | Chill, Freeze, Grab, Bleed, Fear | +10 (wolves), −10 (giants) | Fire ×1.5 | immune Frost, Chill; Blunt ×0.5 (giants) |
| **Ice wights & the Pale Court** | Frostmarch / Frozen Court | 41–45 | Adamantine, Moonweave, Drake Scale from F6 / Pale Shard (Shadow stone), Court Signet | Freeze, Fear, Silence, Curse, Petrify | 0 | Holy ×1.5, Fire ×1.5 | immune Frost, Poison, Fear; Pierce ×0.5 |
| **Wyrms & drakes** | Frostmarch / the Roost | 46–50 | Drake Scale, Adamantine, Elderwood; **Dragon Scale (SS, final boss, 1–3 guaranteed)** / Wyrm Fang (Crit stone), Drake Egg (pet) | Chill, Freeze, Grab, Fear, Burn (drakes) | +10 | Lightning ×1.5 | immune Frost; Slash ×0.5 (scale) |

Part odds everywhere: **common part 35 %**, **rare part 4 %**, a **part-break** in combat (hit the marked limb) doubles the rare roll for that monster; **bosses** drop a guaranteed stack (5–10 units) and a rare part on first kill; affixed elites roll parts twice. Materials and parts duplicate for every player (§10.2).

---

## §2 Elite affixes

An **Elite room** (8 % of rooms, §4.6) is a normal encounter of its floor with one monster promoted to **champion**: any Fodder, Elite or Special template (never a Monster) gains **HP ×2.5, gold ×3, XP class +2**, rolls parts twice, and carries affixes shown on its nameplate (*"Warren Alpha — Rabid · Shackler"*). **Scaling:** 1 affix on F1–2, 2 on F3–6, 3 on F7+ (dungeons 2–4 start at 2 and reach 4 on their F7+). Composition rule (Diablo 3's): at most **one defensive** and **one control** affix per champion; the rest offensive. Hunters never take affixes; bosses never do (they get the arena instead).

| # | Affix | Class | Rule (numbers are starting points) |
|---|---|---|---|
| 1 | **Shielded** | defensive | The first 2 hits of the fight against it are absorbed entirely; the shield icon pops on the second. Reapplies once when it drops below 50 % HP. |
| 2 | **Vampiric** | offensive | Heals 30 % of the damage it deals. Healing is halved against a Burned target. |
| 3 | **Shackler** | control | Its hits apply **Root** (2 turns) at 50 %; a Rooted hero cannot swap rows or flee. |
| 4 | **Rabid** | offensive | Speed 140 (overrides the template) and +10 % Attack. |
| 5 | **Spiteful** | offensive | On death it bursts: Blunt ×1.2 of its Attack to every front-row hero plus its family's signature element status (Vermin Poison, Dead Curse, Tidebound Chill …). A 1-turn tell: it swells. |
| 6 | **Warded** | defensive | Immune to one element, shown on the nameplate (never the template's weakness). Hitting it with that element gives it +10 Momentum-equivalent (it acts 100 energy sooner). |
| 7 | **Thorned** | offensive | Reflects 20 % of melee damage taken as Pierce to the attacker; ranged and spells are safe. |
| 8 | **Regenerating** | defensive | +5 % max HP at the start of each of its turns; suppressed for 2 turns by Burn or Bleed. |
| 9 | **Mirrored** | defensive | Starts with two decoys (same nameplate, 10 % HP, 0 damage) in the other row; the first hit on a decoy pops it. |
| 10 | **Commander** | offensive | Every Fodder in the fight gets +20 % Attack and +10 Speed while it lives; killing it applies Fear (1 turn) to them. |
| 11 | **Leech** | offensive | Each hit drains 15 % of the target's pool (Stamina or Mana) and heals the champion by the same number. |
| 12 | **Nullifier** | control | Silence aura: the hero it last hit is Silenced for 1 turn; while it lives all hero pool regen is −50 %. |

Pool per dungeon: all 12 are available from F3 of Gravehollow; F1–2 roll from {Rabid, Thorned, Vampiric, Shielded, Commander} so the first ten minutes teach one rule at a time.

---

## §3 Gravehollow Keep — the full bestiary

Ten floors, three zones, 35 regular monsters, 3 hunters, 3 zone bosses, 1 final boss. Level bands: Cellars L1–4, Crypts L5–8, Vault L10–13, throne L14. Encounter compositions are the 3-player table; §8 scales them.

### 3.1 Zone 1 — the Cellars (F1–3): Vermin & the Grinning Company

**How the family fights.** The tutorial family; it teaches rows. Rats and hounds pour into the **front** and are faster than a first-floor hero (Speed 115–130), so the strip shows three rat icons before the Warden's — "faster means more turns", literally. Behind them the **Grinning Company**, the bandit gang squatting in the Keep's cellars, holds the **back**: a Crossbowman who shoots whoever Bleeds, a Hexer who curses the healer, and the **Netter**, the zone's Special, who nets one hero (Grab) and lets the rats chew. Keep swinging at rats while the Netter reloads and a second net takes a second hero; "kill the Netter" or "free the netted" is the co-op verb this zone exists to teach. The Weaver webs the back row from the back row, so reach and bows matter. Elites: the Bruiser (chain mail — maces, not daggers) and the Warren Alpha (hide — slashes). The Monster is the Broodmother, a rare larder fight that spawns spiders every time she is hurt.

**Encounter table (3-player).**

| Encounter | Composition | Floors | Weight |
|---|---|---|---|
| Rat Pack | 3 Giant Rat + 1 Plague Rat | F1–2 | 20 |
| Cellar Dusting | 2 Cellar Spider + 1 Cellar Weaver | F1–3 | 15 |
| Toll Collectors | 2 Grinning Cutpurse + 1 Grinning Crossbowman | F1–2 | 20 |
| Dog Handlers | 2 Cellar Hound + 1 Grinning Netter | F2–3 | 15 |
| Alpha's Warren | 1 Warren Alpha + 3 Giant Rat | F2–3 | 12 |
| Hexer's Circle | 1 Grinning Hexer + 1 Grinning Bruiser + 2 Giant Rat | F3 | 10 |
| Broodmother's Larder (Monster) | 1 Broodmother + 2 Cellar Spider | F2–3 | 8 (max one per floor) |

#### Giant Rat
`giant-rat` · Fodder · Small · Front · F1–3 (L1–4) · HP ×0.7 · Att ×0.9 · Def ×0.6 · Spd 125 · XP fodder (1) · gold ×1.0
- Attacks: Bite — Pierce — light 800 — ×0.9 — 15 % Bleed (2) — 80 % · Scurry-nip — Pierce — light 800 — ×0.5 ×2 hits — — 20 %
- Resist Poison ×0.5 · weak Fire ×1.5 · immune —
- Behavior: targets the hero with the lowest HP %; when a rat dies the survivors gain Haste (1 turn, "the swarm turns"); flees at 15 % HP if it is the last rat.
- Parts: Rawhide (35 %) / Rat-tail Charm, +Luck stone (4 %) / break: tail → Speed −20
- Technique: —
- Visual: a hunched rat the size of a dog, 0.6 m at the shoulder; **rat base**, scale 1.0; palette dun fur / pink bare tail / yellow teeth; must read at 200 px: the bare tail; anims Idle/Move/Attack1/Attack2/Hit/Death/Flee; 2.5k tris.

#### Plague Rat
`plague-rat` · Fodder · Small · Front · F1–3 (L1–4) · HP ×0.8 · Att ×0.8 · Def ×0.5 · Spd 115 · XP fodder (1) · gold ×1.0
- Attacks: Foul Bite — Pierce/Poison — light 800 — ×0.8 — 60 % Poison (3) — 70 % · Retch — Poison — normal 1,000 — ×0.6 to one target, either row — Poison (2) — 30 %
- Resist — · weak Fire ×1.5 · immune Poison
- Behavior: targets the hero without Poison; dies into a Poison cloud (×0.3 to the front row).
- Parts: Rawhide (35 %) / Plague Gland, Poison stone (4 %) / break: swollen flank → no death cloud
- Technique: —
- Visual: a mangy rat with a swollen green belly, 0.6 m; rat base, scale 1.1, mange patches, belly morph; palette grey-green / sickly yellow / black eyes; must read: the glowing belly; anims as rat + Retch; 2.5k tris.

#### Warren Alpha
`warren-alpha` · Elite · Medium · Front · F2–3 (L2–4) · HP ×2.0 · Att ×1.2 · Def ×1.3 · Spd 110 · XP elite (3) · gold ×2.5
- Attacks: Rend — Slash — normal 1,000 — ×1.2 — 30 % Bleed (3) — 55 % · Alpha's Howl — — normal 1,000 — — all Vermin allies Haste (2), the Alpha Fortify (2) — 25 % · Pin — Blunt — heavy 1,400 — ×1.4 — Daze — 20 %
- Resist Pierce ×0.5 (thick hide), Poison ×0.5 · weak Slash ×1.5, Fire ×1.5 · immune —
- Behavior: howls on its first turn if 2+ Vermin are alive; otherwise targets the hero who last killed a rat.
- Parts: Leather (35 %) / Alpha Pelt, +Str stone (4 %) / break: scarred hide → loses Pierce resist
- Technique: —
- Visual: a scarred rat the size of a boar with a ridge of raised fur, 1.0 m; rat base, scale 1.6, scar decals, spine ridge; palette black-brown / scar pink / amber eyes; must read: the raised ridge; anims as rat + Howl/Pin; 5k tris.

#### Cellar Spider
`cellar-spider` · Fodder · Small · either · F1–3 (L1–4) · HP ×0.6 · Att ×1.0 · Def ×0.5 · Spd 120 · XP fodder (1) · gold ×0.8
- Attacks: Venom Bite — Pierce/Poison — light 800 — ×0.9 — 40 % Poison (2) — 70 % · Drop — Pierce — normal 1,000 — ×1.3, only from the back row, moves it to the front — — 30 %
- Resist Poison ×0.5 · weak Fire ×1.5, Blunt ×1.5 · immune —
- Behavior: starts in the back row; Drops on the hero with the lowest Perception; ambushes at +15.
- Parts: Spider Silk thread (sells; 35 %) / Spinneret, Web stone (4 %) / break: a leg → Speed −30
- Technique: —
- Visual: a flat, long-legged spider 0.8 m across; **spider base**, scale 1.0; palette dust-grey / pale stripe / red eye cluster; must read: the eight-eye cluster; anims Idle/Move/Attack1/Attack2/Hit/Death/Drop; 3k tris.

#### Cellar Weaver
`cellar-weaver` · Special · Medium · Back · F1–3 (L1–4) · HP ×1.1 · Att ×0.9 · Def ×0.7 · Spd 100 · XP special (2) · gold ×1.5
- Attacks: Web Shot — — normal 1,000 — — **Web** one hero (3), any row — 50 % · Bite — Pierce/Poison — light 800 — ×0.9 — Poison (2) — 35 % · Reel — — normal 1,000 — pulls the Webbed hero to the front row — — 15 %
- Resist Poison ×0.5 · weak Fire ×1.5 (Fire burns the Web off its target too) · immune —
- Behavior: webs the back-row hero with the highest Attack first; never webs a second hero while one is Webbed; retreats behind spiders.
- Parts: Spider Silk (35 %) / Weaver's Gland, Web stone (4 %) / break: spinnerets → cannot Web
- Technique: —
- Visual: a bulbous spider with a long striped abdomen, 1.2 m; spider base, scale 1.4, abdomen morph; palette bone-white / brown bands / blue eye cluster; must read: the swollen white abdomen; anims as spider + Web/Reel; 4k tris.

#### Broodmother
`broodmother` · Monster · Large · Front · F2–3 (L2–4) · HP ×4.5 · Att ×1.4 · Def ×1.0 · Spd 85 · XP monster (6) · gold ×4
- Attacks: Crush Bite — Pierce — heavy 1,400 — ×1.6 — Poison (3) — 45 % · Brood Call — — normal 1,000 — spawns 2 Cellar Spider (at ×0.5 HP) in the front — — 30 % · Sweep — Blunt — normal 1,000 — ×0.8 to both front heroes — Daze 30 % — 25 %
- Resist Poison ×0.5, Pierce ×0.5 (chitin) · weak Fire ×1.5, Blunt ×1.5 · immune Grab, Web
- Behavior: Brood Calls every time she loses 25 % HP (a tell: her abdomen pulses); targets the hero with the most spiderlings on them.
- Parts: Leather ×2 (35 %) / Brood Egg, Spiderling pet egg (4 %) / break: egg sac → no more Brood Calls, rare roll ×2
- Technique: —
- Visual: a cellar-filling spider with a translucent egg sac, 2.4 m across; spider base, scale 3.0, egg-sac attachment; palette oil-black / sac amber / eye red; must read: the lit sac; anims as spider + Brood/Sweep/Pulse; 7k tris.

#### Cellar Hound
`cellar-hound` · Fodder · Medium · Front · F1–3 (L1–4) · HP ×0.9 · Att ×1.0 · Def ×0.7 · Spd 130 · XP fodder (1) · gold ×0.8
- Attacks: Bite — Pierce — light 800 — ×1.0 — 25 % Bleed (2) — 65 % · Hamstring — Slash — normal 1,000 — ×0.8 — Slow (2) — 35 %
- Resist — · weak Fire ×1.5 · immune —
- Behavior: attacks whoever the nearest bandit attacked last (a handler's dog); Fear (1) when its handler dies; the fastest thing on F1–2.
- Parts: Rawhide (35 %) / Cellar Hound egg (4 %) / break: foreleg → Speed −40
- Technique: —
- Visual: a lean, ribby mastiff with a spiked collar, 0.8 m; **hound base**, scale 1.0, collar; palette brindle / rust collar / white teeth; must read: the spiked collar; anims Idle/Move/Attack1/Attack2/Hit/Death; 3k tris.

#### Grinning Cutpurse
`grinning-cutpurse` · Fodder · Medium · Front · F1–3 (L1–4) · HP ×0.9 · Att ×0.9 · Def ×0.8 · Spd 110 · XP fodder (1) · gold ×1.5
- Attacks: Shank — Pierce — light 800 — ×0.9 — 20 % Bleed (2) — 60 % · Pickpocket — Pierce — light 800 — ×0.5 — steals 5 % of the party's unbanked gold (returned on its death) — 30 % · Dirty Kick — Blunt — normal 1,000 — ×0.7 — Daze — 10 %
- Resist — · weak — · immune —
- Behavior: targets the hero carrying the most gold (shown as a coin icon); flees at 25 % HP with the stolen gold if no ally is alive — kill it before it reaches the door (2 turns).
- Parts: Copper (35 %) / Marked Cards, +Luck stone (4 %) / break: purse → drops its gold at once
- Technique: —
- Visual: a wiry bandit in a grinning wooden half-mask, 1.7 m; **humanoid base**, bandit costume set A; palette mud-brown / mask white / red sash; must read: the painted grin; anims Idle/Move/Attack1/Attack2/Hit/Death/Flee; 3.5k tris.

#### Grinning Crossbowman
`grinning-crossbowman` · Fodder · Medium · Back · F1–3 (L1–4) · HP ×0.8 · Att ×1.2 · Def ×0.6 · Spd 95 · XP fodder (1) · gold ×1.5
- Attacks: Bolt — Pierce — heavy 1,400 — ×1.5, either row — 30 % Bleed (2) — 70 % · Reload-kick — Blunt — light 800 — ×0.4 — — 30 % (used only when a hero stands in melee with it)
- Resist — · weak — · immune —
- Behavior: shoots the Bleeding hero; otherwise the lowest-Defense hero in the back row; a heavy weight means it fires about once per 1.4 hero turns — the strip shows it.
- Parts: Copper (35 %) / Bandit Lockpick, one-use Skeleton Key (4 %) / break: crossbow arm → Bolt ×0.8 and light weight
- Technique: —
- Visual: a stocky bandit kneeling behind a light crossbow, 1.7 m; humanoid base, bandit set A, crossbow prop; palette mud-brown / mask white / bolt-quiver red; must read: the crossbow; anims Idle/Move/Attack1(fire)/Attack2/Hit/Death/Reload; 3.5k tris.

#### Grinning Bruiser
`grinning-bruiser` · Elite · Large · Front · F2–3 (L2–4) · HP ×2.2 · Att ×1.3 · Def ×1.6 · Spd 90 · XP elite (3) · gold ×2.5
- Attacks: Club — Blunt — normal 1,000 — ×1.2 — — 50 % · Skull Crack — Blunt — heavy 1,400 — ×1.8 — Daze — 30 % · Shove — Blunt — normal 1,000 — ×0.6 — pushes a front hero to the back row — 20 %
- Resist Slash ×0.5, Pierce ×0.5 (chain mail) · weak Blunt ×1.5 · immune —
- Behavior: Taunts (self, 2 turns) on its first turn so the party learns to ignore it and hit the Netter; Skull Cracks whoever damaged it most.
- Parts: Copper ×2 (35 %) / Bronze ×2 (4 %) / break: mail coif → loses Slash resist
- Technique: —
- Visual: a huge bandit in rusted chain and a grinning full-face mask, 2.1 m; humanoid base, scale 1.25, bandit set B (mail); palette rust / mask white / dark leather; must read: the mask's full grin; anims Idle/Move/Attack1/Attack2/Hit/Death/Taunt; 5k tris.

#### Grinning Netter
`grinning-netter` · Special · Medium · Back · F2–3 (L2–4) · HP ×1.2 · Att ×0.8 · Def ×0.8 · Spd 100 · XP special (2) · gold ×1.5
- Attacks: Net Throw — — normal 1,000 — — **Grab** one hero (either row) until freed (§7) — 50 % · Gaff — Pierce — light 800 — ×1.0 — vs the netted hero only, Bleed (2) — 35 % · Reload — — light 800 — — must follow a Net (tell: he gathers the next net) — 15 %
- Resist — · weak — · immune —
- Behavior: nets the hero with the highest Attack; while a hero is netted every Vermin in the fight targets them; a second net needs the Reload turn — kill or stagger him then.
- Parts: Copper (35 %) / Weighted Net, Grab stone (4 %) / break: net hand → cannot Net
- Technique: —
- Visual: a lanky bandit with a coiled net on one shoulder and a gaff hook, 1.8 m; humanoid base, bandit set A, net prop; palette sea-grey net / mask white / tar-black coat; must read: the coiled net; anims as bandit + Throw/Reload; 3.5k tris.

#### Grinning Hexer
`grinning-hexer` · Special · Medium · Back · F3 (L4) · HP ×1.0 · Att ×1.1 (spell) · Def ×0.6 · Spd 105 · XP special (2) · gold ×2.0
- Attacks: Evil Eye — Shadow — normal 1,000 — ×0.8 — **Fear** (2) — 40 % · Rattle Curse — Shadow — normal 1,000 — — Curse (3) on the hero with the highest Wisdom — 35 % · Bone Dart — Pierce — light 800 — ×0.7 — — 25 %
- Resist Shadow ×0.5 · weak Holy ×1.5 · immune —
- Behavior: Curses the healer first, then Fears whoever is Guarding; stands behind a Bruiser when one is alive.
- Parts: Burlap ×2 (35 %) / Hexer's Fetish, Shadow stone (4 %) / break: fetish → no Curse
- Technique: —
- Visual: a stooped bandit hedge-witch hung with bone fetishes and a cracked grin-mask, 1.6 m; humanoid base, bandit set A + fetish rig; palette bone / soot / a single green glow; must read: the green eye in the mask; anims as bandit + Cast; 3.5k tris.

#### Hunter — Old Gnaw
`old-gnaw` · Hunter · Large · Front · F1–2 (level = floor +3) · HP ×8 · Att ×1.6 · Def ×1.2 · Spd 115 · XP monster (6) · gold ×6
- Attacks: Gnaw — Pierce — normal 1,000 — ×1.4 — Bleed (3) — 50 % · Lunge — Blunt — heavy 1,400 — ×1.8 — Daze, reaches the back row — 30 % · Bolt-hole — — light 800 — — vanishes for 1 turn, returns in the other row with Haste — 20 %
- Resist Poison, Pierce ×0.5 · weak Fire ×1.5 · immune Fear, Grab
- Behavior: targets the hero carrying the most gold; at 30 % HP it Bolt-holes every other turn.
- Parts: Leather ×3 (100 %) / **guaranteed** rare: Gnaw's Tooth (+Att stone) / break: left eye → Accuracy −20
- Technique: —
- Stalking: enters at floor clock 40, moves one room toward the party per 2 ticks (shown on the minimap), cannot be fled from in its room; stairs end the chase; never on a boss floor (F3).
- Visual: a one-eyed rat the size of a pony, back scarred bare, 1.5 m; rat base, scale 2.4, bare-skin morph; palette scar-pink / grey / one milk-white eye; must read: the bald scarred back; anims as rat + Lunge/Bolt-hole; 7k tris.

#### Zone boss — Captain Vexa Marrow, the Grinning Captain
`captain-vexa-marrow` · Boss · Medium · Back → Front · F3 (L4) · HP ×14 · Att ×1.6 · Def ×1.3 · Spd 110 · XP boss (25) · gold ×10 (×3 first kill)
- **Arena — the Wine Hall** (`cel_t_tap_room`; `07` §2.8 owns the room, the arena rule, add timing, tells and light — **arena light per `07`**). A barricade of kegs splits the room until she kicks it over in Phase 2: while it stands, melee cannot reach her back row (bows, spells and spears can). Shooting a keg (interactable, 3 hits) spills it: the front floor becomes *slick* — Slow (1) on any monster that changes rows.
- **Phase 1 (100–50 %) — the Captain's Table.** Back row, behind the barricade, with **2 Grinning Cutpurse + 1 Grinning Crossbowman**. Throwing Knife — Pierce — light 800 — ×1.1 — Bleed (2) — 45 % · Coin Flip — — light 800 — — her next attack is a guaranteed crit; **tell:** the flip, and a star on her strip icon — Guard it — 25 % · Grin — — normal 1,000 — — Mark (2) on one hero; all bandits target them — 30 %. Adds re-enter on `07`'s timing.
- **Phase 2 (50–0 %) — the Captain Steps Down.** She kicks the barricade over (Blunt ×1.0 to the front row, Daze), steps forward with a cutlass and Haste (3); **1 Grinning Netter** enters the back. Cutlass — Slash — normal 1,000 — ×1.4 — Bleed (3) — 50 % · Riposte — Slash — light 800 — ×1.2 — answers the next melee hit on her, once per 2 turns — 30 % · Coin Flip — 20 %. Under 20 % she stops flipping and attacks twice per turn.
- Part-breaks: the grin-mask (Blunt, 6 % HP) → loses Fear immunity and Riposte; the coin (a Pierce crit) → no more Coin Flips.
- First-kill drops: Copper ×8 + Rawhide ×8, a Tier III Tome (bag draw), one D-grade item, the zone Relic **the Grinning Mask** (C Relic, `08` §3: once per fight, Fear the enemy front row for 1 round), 1 Standard chest key. Later kills: stack halves, no Relic.
- Visual: a tall, rakish woman in a red coat with a lacquered grin-mask pushed up on her brow, 1.8 m; humanoid base, bandit set C (coat); palette scarlet / lacquer white / brass; must read: the red coat; anims Idle/Move/Attack1(knife)/Attack2(cutlass)/Hit/Death/CoinFlip/Riposte/Kick; 10k tris.

### 3.2 Zone 2 — the Crypts (F4–6): the Restless Dead

**How the family fights.** The Crypts teach damage types and patience. Skeletons shrug off arrows and daggers (Pierce ×0.5) and splinter under maces and Holy; corpses are slow, thick and burn. A typical fight is a **wall of bone in front** — Footmen, a Bone Knight — with Archers and a Sexton behind who keeps raising what you knock down. Three Specials, each removing a hero differently: the **Ghoul** grabs and gnaws, the **Wraith** wails through the back row (Fear, so the healer skips turns), the **Tomb Spider** webs the whole back row at once. Grave Bats are the only fast thing and they Daze (−500 on the strip), so the party learns to read the timeline for *when* the bats come. Ignore the Sexton and the fight never ends; ignore the Ghoul and the Warden's Hound finds a party already one hero down. Ambush is rare (−5) but bats and wraiths come through walls, and the rooms start Dim with corpse-candles draining the light.

**Encounter table (3-player).**

| Encounter | Composition | Floors | Weight |
|---|---|---|---|
| Grave Watch | 3 Skeleton Footman + 1 Skeleton Archer | F4–5 | 20 |
| Belfry | 3 Grave Bat + 1 Wraith | F4–6 | 15 |
| Shamblers | 3 Shambling Corpse + 1 Bursting Corpse | F4–5 | 18 |
| Ghoul Pack | 2 Ghoul + 2 Skeleton Archer | F5–6 | 15 |
| The Sexton's Vigil | 1 Crypt Sexton + 2 Skeleton Footman + 1 Bone Knight | F5–6 | 12 |
| Spider's Larder | 1 Tomb Spider + 2 Grave Bat | F5–6 | 12 |
| The Charnel Pit (Monster) | 1 Charnel Hulk + 2 Shambling Corpse | F5–6 | 8 (max one per floor) |

#### Skeleton Footman
`skeleton-footman` · Fodder · Medium · Front · F4–6 (L5–8) · HP ×0.9 · Att ×1.0 · Def ×1.0 · Spd 95 · XP fodder (1) · gold ×1.0
- Attacks: Rusted Blade — Slash — normal 1,000 — ×1.0 — — 70 % · Shield Bash — Blunt — normal 1,000 — ×0.6 — Daze 25 % — 30 %
- Resist Pierce ×0.5, Shadow ×0.5 · weak Blunt ×1.5, Holy ×1.5 · immune Poison, Bleed, Fear
- Behavior: holds the front row and attacks the nearest hero; when a Sexton is alive, a killed Footman leaves a *bone pile* that the Sexton can raise once.
- Parts: Bone Shards (35 %) / Bronze ×2 (4 %) / break: shield arm → Def ×0.6
- Technique: —
- Visual: a bowed skeleton in a rotted tabard with a round shield, 1.7 m; **skeleton base**, tabard, shield prop; palette bone / tabard faded green / rust; must read: the round shield; anims Idle/Move/Attack1/Attack2/Hit/Death/Rise; 3k tris.

#### Skeleton Archer
`skeleton-archer` · Fodder · Medium · Back · F4–6 (L5–8) · HP ×0.7 · Att ×1.2 · Def ×0.7 · Spd 100 · XP fodder (1) · gold ×1.0
- Attacks: Bone Arrow — Pierce — normal 1,000 — ×1.2, either row — — 60 % · Barbed Volley — Pierce — heavy 1,400 — ×0.7 to both back-row heroes — Bleed (2) — 40 %
- Resist Pierce ×0.5, Shadow ×0.5 · weak Blunt ×1.5, Holy ×1.5 · immune Poison, Bleed, Fear
- Behavior: targets the hero with the lowest Defense in the back row; volleys when two heroes stand there.
- Parts: Bone Shards (35 %) / Ash (wood) ×2 (4 %) / break: bow → melee only (×0.5)
- Technique: —
- Visual: a skeleton with a cracked longbow and a quiver of bone-tipped arrows, 1.7 m; skeleton base, bow prop; palette bone / quiver black / arrowheads white; must read: the longbow; anims as skeleton + Fire; 3k tris.

#### Bone Knight
`bone-knight` · Elite · Large · Front · F5–6 (L7–8) · HP ×2.4 · Att ×1.3 · Def ×1.8 · Spd 85 · XP elite (3) · gold ×2.5
- Attacks: Greatsword — Slash — heavy 1,400 — ×1.6 — — 45 % · Grave Guard — — normal 1,000 — — Fortify (3) + Taunt (2) on itself — 30 % · Cleave — Slash — heavy 1,400 — ×1.0 to both front heroes — — 25 %
- Resist Slash ×0.5, Pierce ×0.5 (plate), Shadow ×0.5 · weak Blunt ×1.5, Holy ×1.5 · immune Poison, Bleed, Fear, Grab
- Behavior: Grave Guards when an undead ally drops below 50 %; otherwise targets whoever hit the Sexton.
- Parts: Iron ×2 (35 %) / Knight's Gorget, +Def stone (4 %) / break: helm → loses Slash resist, Accuracy −10
- Technique: **Bone Knight's Stand** (Warden, Tier III); **Bone Knight's Cleave** (Blade, Tier IV)
- Visual: a towering skeleton in dented full plate with a two-handed sword, 2.1 m; skeleton base, scale 1.25, plate set; palette tarnished iron / bone / a blue grave-light in the visor; must read: the lit visor slit; anims as skeleton + Guard/Cleave; 5.5k tris.

#### Crypt Sexton
`crypt-sexton` · Elite · Medium · Back · F5–6 (L7–8) · HP ×1.8 · Att ×1.1 (spell) · Def ×1.0 · Spd 100 · XP elite (3) · gold ×2.5
- Attacks: Raise — — heavy 1,400 — — raises one Skeleton Footman from a bone pile (max 3 raises per fight); **tell:** his bell rings the turn before — 40 % · Bone Ward — — normal 1,000 — — Shield (20 % max HP) on the undead ally with the lowest HP — 30 % · Grave Chill — Shadow — normal 1,000 — ×0.9 — Weaken (2) — 30 %
- Resist Shadow ×0.5, Pierce ×0.5 · weak Holy ×1.5, Fire ×1.5 · immune Poison, Bleed, Fear
- Behavior: Raises whenever a bone pile exists; otherwise Wards the Bone Knight; never Raises if Silenced (the counter).
- Parts: Linen ×2 (35 %) / Sexton's Bell, Holy stone (4 %) / break: bell (any Blunt hit on the prop) → no Raise
- Technique: —
- Visual: a robed skeleton with a hand-bell and a lantern pole, 1.8 m; skeleton base, robe set, bell prop; palette grave-black robe / bone / green lantern; must read: the hand-bell; anims as skeleton + Cast/Ring; 4.5k tris.

#### Grave Bat
`grave-bat` · Fodder · Small · either · F4–6 (L5–8) · HP ×0.5 · Att ×0.9 · Def ×0.4 · Spd 135 · XP fodder (1) · gold ×0.6
- Attacks: Shriek — — light 800 — ×0.4 — **Daze** (pushes the target back 500) — 50 % · Blood Nip — Pierce — light 800 — ×0.8 — Bleed (2), heals the bat the Bleed amount — 50 %
- Resist Shadow ×0.5 · weak Fire ×1.5, Lightning ×1.5 · immune Fear, Web
- Behavior: flies to the row with the hero about to act next (reads the strip) and Shrieks them; ambushes at +10; Blinded bats attack a random target.
- Parts: Bat Wing, sells (35 %) / Crypt Bat egg (4 %) / break: wing → Speed 90, grounded (front row only)
- Technique: **Grave Bat's Screech** (Ranger, Tier IV); **Grave Bat's Shriek** (Beast Tamer, Tier III)
- Visual: a bat with a 1.2 m span and a skull-like face; **bat base**, scale 1.0; palette slate / bone face / red mouth; must read: the skull face; anims Idle(hover)/Move/Attack1/Attack2/Hit/Death; 2k tris.

#### Shambling Corpse
`shambling-corpse` · Fodder · Medium · Front · F4–6 (L5–8) · HP ×1.4 · Att ×1.1 · Def ×0.6 · Spd 70 · XP fodder (1) · gold ×1.0
- Attacks: Grave Maul — Blunt — normal 1,000 — ×1.1 — 30 % Poison (2) — 70 % · Lurch — Blunt — heavy 1,400 — ×1.5 — — 30 %
- Resist Pierce ×0.5, Shadow ×0.5 · weak Fire ×1.5, Holy ×1.5, Slash ×1.5 · immune Poison, Fear
- Behavior: the first time it reaches 0 HP it **gets back up** at 25 % after one turn unless the killing blow was Fire, Holy or a crit; attacks the nearest hero.
- Parts: Linen (35 %) / Cured Ghoulhide (4 %) / break: either leg → Speed 40
- Technique: —
- Visual: a swollen, grave-dirt corpse with one arm hanging, 1.8 m; **zombie base**, scale 1.0; palette grey-green / grave-brown / black blood; must read: the broken-hanging arm; anims Idle/Move/Attack1/Attack2/Hit/Death/Rise; 3k tris.

#### Bursting Corpse
`bursting-corpse` · Fodder · Medium · Front · F4–6 (L5–8) · HP ×1.0 · Att ×0.9 · Def ×0.5 · Spd 75 · XP fodder (1) · gold ×1.0
- Attacks: Claw — Slash — normal 1,000 — ×0.9 — Poison (2) — 60 % · Burst — Poison — normal 1,000 — ×1.5 to both front heroes, kills itself — Poison (3); **tell:** it swells for one turn first — 40 % (only below 50 % HP)
- Resist Pierce ×0.5, Shadow ×0.5 · weak Fire ×1.5 (a Fire kill prevents the Burst), Holy ×1.5 · immune Poison, Fear
- Behavior: walks to the front and starts swelling at 50 %; kill it from range or Fire it; a Blunt crit splatters it harmlessly.
- Parts: Linen (35 %) / Grave Candle, Holy stone (4 %) / break: belly → it bursts now, ×0.5
- Technique: —
- Visual: a distended corpse with a gas-lit belly and bloated cheeks, 1.8 m; zombie base, belly morph, green inner glow; palette bruise-purple / gas-green / bone; must read: the lit belly; anims as zombie + Swell/Burst; 3k tris.

#### Ghoul
`ghoul` · Special · Medium · Front · F5–6 (L7–8) · HP ×1.3 · Att ×1.2 · Def ×0.8 · Spd 115 · XP special (2) · gold ×1.5
- Attacks: Ghoul's Grasp — — normal 1,000 — ×0.6 — **Grab** one front hero and drag them out of the rows — 45 % · Gnaw — Pierce — light 800 — ×1.0 — vs the grabbed hero only, Bleed (2) — 40 % · Paralysing Claw — Slash — normal 1,000 — ×0.9 — Slow (2) — 15 %
- Resist Pierce ×0.5, Shadow ×0.5 · weak Holy ×1.5, Fire ×1.5 · immune Poison, Fear
- Behavior: grabs the hero with the lowest Strength (a tell: it crouches the turn before); drops the grab if Dazed or Blinded; the second Ghoul waits for the first to be freed before grabbing.
- Parts: Cured Ghoulhide (35 %) / Ghoul Claw, +Agi stone (4 %) / break: jaw → Gnaw ×0.5, no Bleed
- Technique: **Ghoul's Grasp** (Blade, Tier III — the rulebook's example)
- Visual: a long-armed, hairless corpse that runs on all fours, 1.5 m crouched; zombie base, scale 0.95, long-arm morph, quadruped move set; palette grey-white / black gums / red claws; must read: the too-long arms; anims Idle/Move(quadruped)/Attack1/Attack2/Hit/Death/Grab-hold; 4k tris.

#### Wraith
`wraith` · Special · Medium · Back · F4–6 (L5–8) · HP ×1.0 · Att ×1.2 (spell) · Def ×0.5 · Spd 110 · XP special (2) · gold ×1.5
- Attacks: Wail — Shadow — normal 1,000 — ×0.6 to the whole back row — **Fear** (2) — 45 % · Chill Touch — Shadow — light 800 — ×1.1 — drains 10 % of the target's pool — 40 % · Drift — — light 800 — — swaps row, cannot be hit until its next turn — 15 %
- Resist Slash ×0.5, Pierce ×0.5, Blunt ×0.5, Shadow ×0.5 · weak Holy ×1.5, Fire ×1.5 · immune Poison, Bleed, Fear, Grab, Web, Root
- Behavior: Wails when 2+ heroes are in the back row; Drifts when Marked; comes through walls (ambush +10); visible as a blue smear on the strip.
- Parts: Wool (35 %) / Wraith Ash, Shadow stone (4 %) / break: none (incorporeal)
- Technique: **Wraith-step** (Shade, Tier III); **Wraith's Lament** (Mender, Tier III)
- Visual: a hooded shape of torn grave-cloth with no legs and two lit points for eyes, 2.0 m floating; **wraith base**; palette grave-cloth grey / blue light / black void; must read: the two blue eyes; anims Idle(hover)/Move/Attack1/Attack2/Hit/Death/Drift; 2.5k tris.

#### Tomb Spider
`tomb-spider` · Special · Large · Front · F5–6 (L7–8) · HP ×1.8 · Att ×1.2 · Def ×1.0 · Spd 95 · XP special (2) · gold ×1.8
- Attacks: Shroud — — heavy 1,400 — — **Web** (2) on every back-row hero; **tell:** it rears — 40 % · Fang — Pierce/Poison — normal 1,000 — ×1.3 — Poison (3) — 45 % · Cocoon — — normal 1,000 — — Grab a Webbed hero (counts as Web ending) — 15 %
- Resist Pierce ×0.5, Poison ×0.5, Shadow ×0.5 · weak Fire ×1.5, Blunt ×1.5 · immune Poison, Web
- Behavior: Shrouds on its first turn, then Cocoons the Webbed hero with the highest Wisdom; Fire on the spider frees everyone it has Webbed.
- Parts: Spidersilk (= Silk, C) (35 %) / Tomb Spinneret, Web stone (4 %) / break: spinnerets → no Shroud
- Technique: —
- Visual: a grey, bone-plated spider with a skull-pattern abdomen, 2.0 m across; spider base, scale 2.4, bone-plate shells; palette bone / grave-grey / amber eyes; must read: the skull pattern; anims as spider + Rear/Shroud/Cocoon; 5k tris.

#### Charnel Hulk
`charnel-hulk` · Monster · Huge · Front · F5–6 (L7–8) · HP ×5.5 · Att ×1.6 · Def ×1.1 · Spd 80 · XP monster (6) · gold ×4
- Attacks: Corpse Toss — Blunt — heavy 1,400 — ×1.5, hits the back row — Daze — 35 % · Crush — Blunt — heavy 1,400 — ×1.8 — Grab (release after 2 of its turns) — 30 % · Shed — — normal 1,000 — — drops 1 Shambling Corpse (×0.5 HP) and heals 10 % — 20 % · Flail — Slash — normal 1,000 — ×0.8 to both front heroes — — 15 %
- Resist Pierce ×0.5, Shadow ×0.5 · weak Fire ×1.5, Holy ×1.5 · immune Poison, Fear, Grab, Web, Root, Petrify
- Behavior: Sheds every time it loses 20 % HP; Tosses the hero who is healing; Huge: melee from the back row can reach it (§7).
- Parts: Wool ×2 + Bone Shards ×2 (35 %) / Iron ×3 (4 %) / break: the second torso → no Shed, rare ×2
- Technique: —
- Visual: a stitched mass of corpses with a second torso welded to its shoulder, 3.2 m; zombie base, scale 2.2, extra torso and arms attachment; palette grave-green / bruise / black stitching; must read: the second torso; anims Idle/Move/Attack1/Attack2/Hit/Death/Toss/Shed; 8k tris.

#### Hunter — the Warden's Hound
`wardens-hound` · Hunter · Large · either · F4–5 (level = floor +3) · HP ×7 · Att ×1.8 · Def ×1.0 · Spd 130 · XP monster (6) · gold ×6
- Attacks: Spectral Bite — Pierce/Shadow — light 800 — ×1.3 — Bleed (3), Wither (−healing) — 50 % · Howl — Shadow — normal 1,000 — — Fear (2) on the whole party — 25 % · Harry — — light 800 — — swaps to the other row, next bite ×1.5 — 25 %
- Resist Slash, Pierce, Blunt ×0.5, Shadow ×0.5 · weak Holy ×1.5, Fire ×1.5 · immune Poison, Bleed, Fear, Grab, Web
- Behavior: hunts the hero with the lowest Willpower; Howls on entering; passes through walls, so the minimap shows it coming straight.
- Parts: Wool ×3 (100 %) / **guaranteed** rare: Hound's Collar (Fear-immune talisman stone) / break: none
- Technique: —
- Stalking: enters at clock 40, one room per 2 ticks regardless of doors; cannot be fled from in its room; stairs end it; never on F6.
- Visual: a translucent blue-white mastiff with a chain collar and a lantern-lit ribcage, 1.3 m; hound base, scale 1.5, ghost shader, chain prop; palette ghost-blue / chain black / ember ribs; must read: the lit ribcage; anims as hound + Howl/Harry; 7k tris.

#### Zone boss — the Barrow Warden
`barrow-warden` · Boss · Huge · Front · F6 (L8) · HP ×16 · Att ×1.8 · Def ×1.6 · Spd 90 · XP boss (25) · gold ×10 (×3 first kill)
- **Arena — the Ossuary** (`cry_t_wardens_vigil`; `07` §2.8 owns the room, the arena rule, add timing, tells and light — **arena light per `07`**). Four bone piles line the walls; the Warden's bell raises Footmen from them. Holy or Fire on a pile (3 hits) burns it out for good.
- **Phase 1 (100–50 %) — the Vigil.** Warden's Blade — Slash — heavy 1,400 — ×1.7 — — 40 % · Toll — — normal 1,000 — — raises 2 Skeleton Footman from live piles; **tell:** he lifts the bell the turn before (Silence or Daze him to skip it) — 30 % · Bulwark — — normal 1,000 — — Fortify (3) + Taunt (2) on himself — 30 %. Adds: 2 Footmen at start.
- **Phase 2 (50–0 %) — the Lantern Turns.** The lantern goes Shadow (light drops by `07`'s step), **2 Wraiths** drift in. Verdict — Shadow — heavy 1,400 — ×2.0 — Mark (3) on the hero with the lowest HP %, every undead targets them; **tell:** the lantern swings toward that hero for one turn (swap them back and Guard) — 35 % · Warden's Blade — 35 % · Toll — 15 % · Grave Grip — — normal 1,000 — — Grab the Marked hero, 2 turns — 15 %.
- Part-breaks: the bell (Blunt, 8 % HP on the prop) → no Toll; the lantern (Holy or Fire, 5 % HP) → the light stops dropping, Verdict loses Mark.
- First-kill drops: Iron ×8 + Wool ×8 + Bone Shards ×10, a Tier III Tome, **one A-grade item** (zone-boss rule, rulebook §6.2), the zone Relic **the Barrow Bell** (D Relic, `08` §3: once per fight, Taunt every enemy onto you for 2 rounds and Fortify 1 round), 1 Grand chest key. Later kills: stack halves, no Relic, A-grade 10 %.
- Visual: a three-metre skeletal knight in a bell-hung mantle, lantern on a chain in one hand, a slab-sword in the other, 3.0 m; skeleton base, scale 1.75, mantle, lantern and bell props; palette iron-black / bone / lantern green→blue; must read: the swinging lantern; anims Idle/Move/Attack1/Attack2/Hit/Death/Toll/Bulwark/Verdict/Grip/PhaseTurn; 11k tris.

### 3.3 Zone 3 — the Drowned Vault (F7–9): the Tidebound

**How the family fights.** The Vault is flooded to the knee and the cult that worships what lives under it fights as a **procession**: Blades in front with paired hooks, Acolytes behind singing Fortify into them, and the floor itself a threat — **Deep Tentacles** rise from either row and drag a hero under (Grab), while a **Flagellant** hauls your archer to the front by the ankle (pull + Root). Two elites: the **Drowner** in a diving-bell helm (plate — Lightning and maces) and the **Vault Sentinel**, a construct that ignores Poison and Bleed entirely — a Shade with only daggers has nothing here, which is the point. The **Brine Hag** Curses first, then petrifies a Cursed hero (cleanse the Curse and the Hex fails). Oozes are slow walls that split under Slash and burn. Everything is wet: Lightning ×1.5 across the family, Frost ×0.5. Ignore the Acolytes and Fortified Blades outlast the healer's Mana; ignore the Tentacle and you lose a hero every three turns.

**Encounter table (3-player).**

| Encounter | Composition | Floors | Weight |
|---|---|---|---|
| Tide Procession | 2 Tidebound Blade + 2 Tidebound Acolyte | F7–8 | 20 |
| Drowned Choir | 3 Drowned Thrall + 1 Vault Lantern | F7–9 | 15 |
| Penance | 1 Tidebound Flagellant + 2 Tidebound Blade + 1 Tidebound Acolyte | F7–9 | 15 |
| Sentinel Post | 1 Vault Sentinel + 2 Drowned Thrall | F8–9 | 12 |
| Hag's Salt Circle | 1 Brine Hag + 2 Brine Ooze | F8–9 | 12 |
| From the Deep | 2 Deep Tentacle + 1 Tidebound Drowner | F8–9 | 14 |
| The Maw (Monster) | 1 Deep Maw + 1 Deep Tentacle | F8–9 | 8 (max one per floor) |
| *Pearl Ooze* | joins any Vault fight at 5 % | F7–9 | — |

#### Tidebound Acolyte
`tidebound-acolyte` · Fodder · Medium · Back · F7–9 (L10–13) · HP ×0.8 · Att ×1.1 (spell) · Def ×0.7 · Spd 100 · XP fodder (1) · gold ×1.2
- Attacks: Brine Lash — Frost — normal 1,000 — ×1.0, either row — Chill (2) — 55 % · Hymn of the Deep — — normal 1,000 — — Fortify (2) on all Tidebound in the front — 30 % · Salt Flask — Frost — light 800 — ×0.6 to one target — Slow (1) — 15 %
- Resist Frost ×0.5 · weak Lightning ×1.5 · immune —
- Behavior: Hymns on its first turn when a Blade is alive; Lashes the hero already Chilled (a second Chill is Freeze).
- Parts: Silk (35 %) / Brine Pearl, Frost stone (4 %) / break: conch → no Hymn
- Technique: —
- Visual: a barefoot cultist in a wet grey shroud with a conch at the belt, 1.7 m; humanoid base, cult costume set A; palette wet-grey / sea-green trim / pearl white; must read: the hanging conch; anims Idle/Move/Attack1/Attack2/Hit/Death/Cast; 3.5k tris.

#### Tidebound Blade
`tidebound-blade` · Fodder · Medium · Front · F7–9 (L10–13) · HP ×1.0 · Att ×1.2 · Def ×0.9 · Spd 120 · XP fodder (1) · gold ×1.2
- Attacks: Hook Pair — Slash — light 800 — ×0.7 ×2 hits — 30 % Bleed (2) per hit — 65 % · Gut Hook — Pierce — normal 1,000 — ×1.3 — Bleed (3) — 35 %
- Resist Frost ×0.5 · weak Lightning ×1.5 · immune —
- Behavior: attacks the hero with the lowest Defense in reach; under Fortify it stops dodging and attacks twice (Haste).
- Parts: Steel (35 %) / Tide Glass, Lightning stone (4 %) / break: hook hand → one hit only
- Technique: —
- Visual: a lean cultist with two boat-hooks and a sewn-shut mouth, 1.7 m; humanoid base, cult set A + hooks; palette wet-grey / rust hooks / blue thread; must read: the paired hooks; anims as cultist + DualAttack; 3.5k tris.

#### Tidebound Flagellant
`tidebound-flagellant` · Special · Medium · Front · F7–9 (L10–13) · HP ×1.4 · Att ×1.1 · Def ×0.6 · Spd 105 · XP special (2) · gold ×1.5
- Attacks: Chain of Penance — Pierce — normal 1,000 — ×0.8 — **pulls** one back-row hero to the front and Roots (2) them — 45 % · Scourge — Slash — normal 1,000 — ×1.2, self-damage 5 % — Bleed (2) — 40 % · Ecstasy — — light 800 — — Haste (2) + Weaken (2) on itself — 15 %
- Resist Frost ×0.5 · weak Lightning ×1.5 · immune Fear, Taunt
- Behavior: pulls the hero with the highest ranged Attack; gains +10 % Attack per 10 % HP lost (shown as a rising red bar); kill it fast or heal around it.
- Parts: Silk (35 %) / Penance Chain, Root stone (4 %) / break: chain arm → no pull
- Technique: —
- Visual: a shirtless cultist wrapped in barbed chain, dragging a hooked length of it, 1.8 m; humanoid base, cult set B (chain rig); palette raw-pink / rust chain / grey water; must read: the trailing chain; anims as cultist + Throw/Pull; 4k tris.

#### Tidebound Drowner
`tidebound-drowner` · Elite · Large · Front · F8–9 (L11–13) · HP ×2.3 · Att ×1.3 · Def ×1.8 · Spd 85 · XP elite (3) · gold ×2.5
- Attacks: Anchor Maul — Blunt — heavy 1,400 — ×1.7 — Daze 30 % — 50 % · Bell Toll — — normal 1,000 — ×0.5 to the front row — Silence (1) — 25 % · Hold Under — Blunt — normal 1,000 — ×1.0 — Grab (release after 2 turns) — 25 %
- Resist Slash ×0.5, Pierce ×0.5 (plate), Frost ×0.5 · weak Lightning ×1.5 (×2.0 while standing in water: the Vault's rule), Blunt ×1.5 · immune Chill, Freeze
- Behavior: Tolls when a caster is in the back row; Holds Under whoever is Chilled.
- Parts: Steel ×2 (35 %) / Diving Bell plate, +HP stone (4 %) / break: bell helm → loses Slash/Pierce resist, Blind (2)
- Technique: —
- Visual: a huge cultist in a riveted brass diving-bell helm and lead-weighted plate, 2.2 m; humanoid base, scale 1.3, cult set C (bell plate); palette verdigris brass / lead grey / pale glass; must read: the round bell helm; anims as cultist + Maul/Toll/Hold; 5.5k tris.

#### Drowned Thrall
`drowned-thrall` · Fodder · Medium · Front · F7–9 (L10–13) · HP ×1.3 · Att ×1.1 · Def ×0.7 · Spd 75 · XP fodder (1) · gold ×1.0
- Attacks: Waterlogged Fist — Blunt — normal 1,000 — ×1.1 — Chill (2) — 65 % · Cling — — normal 1,000 — ×0.5 — Slow (2), the thrall takes ×1.5 from the target's allies while clinging — 35 %
- Resist Frost ×0.5, Fire ×0.5 (wet) · weak Lightning ×1.5, Holy ×1.5 · immune Poison, Fear, Chill
- Behavior: Clings to the hero with the highest Speed; keeps attacking the hero it Clung to; a Lightning hit on a Clinging thrall chains ×0.5 to every wet Tidebound in the front.
- Parts: Linen (35 %) / Sharkskin (4 %) / break: jaw → Chill lost
- Technique: —
- Visual: a drowned, barnacled corpse in cult rags with kelp in its hair, 1.8 m; zombie base, barnacle decals, wet shader; palette blue-grey / barnacle white / kelp green; must read: the barnacle crust; anims as zombie + Cling; 3k tris.

#### Vault Lantern
`vault-lantern` · Fodder · Small · Back · F7–9 (L10–13) · HP ×0.5 · Att ×1.0 (spell) · Def ×0.3 · Spd 120 · XP fodder (1) · gold ×0.8
- Attacks: Drowned Light — Holy/Shadow — light 800 — ×0.7 — Blind (2) — 55 % · Lure — — normal 1,000 — — the floor's light meter −10 on the fight's end if it survives; shown as a dimming icon — 25 % · Flicker — — light 800 — — Dodge 50 % until its next turn — 20 %
- Resist Holy ×0.5, Shadow ×0.5 · weak Lightning ×1.5 · immune Poison, Bleed, Grab, Web, Root, Petrify
- Behavior: Blinds the hero with the highest Perception; Flickers when Marked; dies into +5 light (a reward for killing it).
- Parts: — (35 % roll gives Tide Glass instead) / Wisp egg (4 %) / break: none
- Technique: —
- Visual: a drowned lantern wrapped in a pale will-o'-wisp, 0.5 m floating; **wisp base**, lantern cage prop; palette sea-green glow / rusted cage / white core; must read: the cage around the glow; anims Idle(hover)/Move/Attack1/Hit/Death/Flicker; 1.5k tris.

#### Deep Tentacle
`deep-tentacle` · Special · Large · either · F7–9 (L10–13) · HP ×1.6 · Att ×1.3 · Def ×0.9 · Spd 90 · XP special (2) · gold ×1.5
- Attacks: Drag Under — — normal 1,000 — ×0.5 — **Grab**; the grabbed hero also takes Chill each of the tentacle's turns — 50 % · Slam — Blunt — heavy 1,400 — ×1.6, either row — Daze 25 % — 35 % · Submerge — — light 800 — — cannot be targeted until its next turn; **tell:** ripples under a hero's row — 15 %
- Resist Frost ×0.5, Pierce ×0.5 · weak Slash ×1.5, Lightning ×1.5 · immune Fear, Grab, Web, Root, Petrify, Blind
- Behavior: rises in the row with the most heroes; Drags the hero with the lowest Strength; releases at 10 % of its HP (§7) — Slash is quickest; ambush +15.
- Parts: Deep Flesh, sells (35 %) / Brine Pearl ×2 (4 %) / break: sucker pad → Grab lasts 1 turn
- Technique: **Deep Tentacle's Drag** (Ranger, Tier III)
- Visual: a single grey-green tentacle thick as a hero, 2.5 m out of the water, ringed with pale suckers; **tentacle base**; palette kelp-green / sucker white / black tip; must read: the suckers; anims Rise/Idle/Attack1/Attack2/Hit/Death/Submerge/Grab-hold; 3.5k tris.

#### Deep Maw
`deep-maw` · Monster · Huge · Front · F8–9 (L11–13) · HP ×6 · Att ×1.5 · Def ×1.2 · Spd 80 · XP monster (6) · gold ×5
- Attacks: Undertow — Frost — heavy 1,400 — ×1.2 to every hero — Chill (2), front-row heroes also Slow (1) — 30 % · Tentacle Ring — Blunt — normal 1,000 — ×0.9 to both front heroes — 30 % · Swallow — — normal 1,000 — — Grab a Chilled front hero; they take ×0.5 Frost per Maw turn — 25 % · Spawn — — normal 1,000 — — raises 1 Deep Tentacle (×0.6 HP) — 15 %
- Resist Frost ×0.5, Pierce ×0.5 · weak Lightning ×1.5, Slash ×1.5 · immune Fear, Grab, Web, Root, Petrify, Blind, Taunt
- Behavior: Undertow every third turn (tell: the water drops); Swallows only a Chilled hero — cleanse Chill and it cannot; Huge (§7).
- Parts: Steel ×2 + Silk ×2 (35 %) / Maw Pearl, SS-rated Frost stone (4 %) / break: a ring tentacle (one of 5) → Tentacle Ring loses a hit; all five → no Undertow, rare ×2
- Technique: —
- Visual: a ring of five tentacles around a toothed throat that fills the water in front of the party, 4 m across; tentacle base ×5 instanced around a maw plate; palette kelp-green / throat pink / teeth white; must read: the ring of tentacles; anims Idle/Attack1/Attack2/Hit/Death/Undertow/Swallow/Spawn; 8k tris.

#### Vault Sentinel
`vault-sentinel` · Elite · Large · Front · F8–9 (L11–13) · HP ×2.6 · Att ×1.2 · Def ×2.0 · Spd 80 · XP elite (3) · gold ×2.5
- Attacks: Halberd — Slash — heavy 1,400 — ×1.5, reaches the back row — — 45 % · Tide Ward — — normal 1,000 — — Shield (25 % max HP) on itself, Fortify (2) on the front — 30 % · Core Pulse — Lightning — heavy 1,400 — ×1.0 to the front row — Shock (2) — 25 % (only below 50 % HP)
- Resist Slash ×0.5, Pierce ×0.5, Frost ×0.5, Fire ×0.5 · weak Lightning ×1.5, Blunt ×1.5 · immune Poison, Bleed, Fear, Chill, Freeze, Grab, Petrify
- Behavior: Wards on its first turn and every 4th; Halberds the hero with the highest Attack; its chest core glows when Core Pulse is next (tell).
- Parts: Steel ×2 (35 %) / Sentinel Core, +Def stone (4 %) / break: chest core (Blunt, 10 % HP) → no Tide Ward, Def ×1.2
- Technique: **Sentinel's Sweep** (Warden, Tier IV); **Sentinel Pulse** (Arcanist, Tier IV)
- Visual: a verdigris bronze statue-knight with a halberd and a lit crystal in its chest, water pouring from its joints, 2.4 m; **sentinel base**; palette verdigris / bronze / blue core; must read: the chest crystal; anims Idle/Move/Attack1/Attack2/Hit/Death/Ward/Pulse; 5.5k tris.

#### Brine Hag
`brine-hag` · Special · Medium · Back · F8–9 (L11–13) · HP ×1.3 · Att ×1.3 (spell) · Def ×0.7 · Spd 100 · XP special (2) · gold ×2.0
- Attacks: Salt Curse — Shadow — normal 1,000 — ×0.6 — Curse (3) — 40 % · Salt Hex — Shadow — heavy 1,400 — — **Petrify** a Cursed hero (2 turns; fails on an un-Cursed one); **tell:** she cackles the turn before — 30 % · Cackle — — light 800 — — Fear (1) on the hero with the lowest Willpower — 15 % · Brine Claw — Slash — light 800 — ×0.9 — — 15 %
- Resist Frost ×0.5, Shadow ×0.5 · weak Lightning ×1.5, Holy ×1.5 · immune Fear, Silence (she sings through it)
- Behavior: Curses the healer, Hexes the Cursed hero with the highest Attack; Silencing her does nothing but Dazing or Blinding her skips the Hex.
- Parts: Silk ×2 (35 %) / Hag's Eye, Curse stone (4 %) / break: salt-pouch → no Hex
- Technique: **Hag's Hex** (Shade, Tier III); **Hag's Cauldron** (Arcanist, Tier IV)
- Visual: a long-limbed crone of salt-crusted skin with a brine-pearl crown, 1.9 m; humanoid base, crone costume set; palette salt-white / drowned blue / pearl pink; must read: the pearl crown; anims Idle/Move/Attack1/Attack2/Hit/Death/Cast/Cackle; 4.5k tris.

#### Brine Ooze
`brine-ooze` · Fodder · Large · Front · F7–9 (L10–13) · HP ×1.6 · Att ×1.0 · Def ×0.5 · Spd 70 · XP fodder (1) · gold ×0.8
- Attacks: Engulf — Blunt/Frost — normal 1,000 — ×1.1 — Chill (2), −5 % durability on the target's chest piece — 70 % · Spit — Frost — normal 1,000 — ×0.8, either row — Slow (1) — 30 %
- Resist Blunt ×0.5, Frost ×0.5 · weak Fire ×1.5, Lightning ×1.5 · immune Pierce (×0.25), Poison, Bleed, Fear, Grab, Web, Root, Blind, Petrify
- Behavior: a Slash hit that does not kill it **splits** it into two Oozes at half HP (max 4); attacks the hero in heaviest armor.
- Parts: Brine Salt, sells (35 %) / Sharkskin ×2 (4 %) / break: none
- Technique: —
- Visual: a waist-high mound of grey-green brine with things suspended in it, 1.4 m; **ooze base**; palette sea-glass green / foam white / rust objects; must read: the objects inside; anims Idle/Move/Attack1/Attack2/Hit/Death/Split; 2.5k tris.

#### Pearl Ooze
`pearl-ooze` · Fodder (rare) · Medium · Back · F7–9 (L10–13) · HP ×1.2 · Att ×0.5 · Def ×0.4 · Spd 140 · XP fodder (1) · gold ×6
- Attacks: Spit — Frost — light 800 — ×0.5 — — 40 % · Flee — — light 800 — — leaves the fight after 3 of its turns (tell: a countdown on its nameplate) — 60 %
- Resist Frost ×0.5 · weak Fire ×1.5, Lightning ×1.5 · immune Pierce (×0.25), Poison, Bleed, Grab, Web
- Behavior: never attacks a hero that is attacking it; Root or Slow stops the countdown; a kill drops its whole stack.
- Parts: Brine Pearl ×3 (100 %) / Silk ×4 (25 %) / break: none
- Technique: —
- Visual: a translucent ooze full of pearls, shimmering, 1.0 m; ooze base, scale 0.8, pearl inclusions, iridescent shader; palette pearl white / rainbow sheen / sea-glass; must read: the pearls; anims as ooze + Flee; 2.5k tris.

#### Hunter — the Vault Leech
`vault-leech` · Hunter · Huge · Front · F7–8 (level = floor +3) · HP ×9 · Att ×1.5 · Def ×1.3 · Spd 105 · XP monster (6) · gold ×6
- Attacks: Latch — Pierce — normal 1,000 — ×1.0 — Grab; each of its turns while latched drains 15 % of the hero's pool and heals the Leech 5 % — 45 % · Bloat Slam — Blunt — heavy 1,400 — ×1.9 to the front row — Daze — 30 % · Brine Spray — Frost — normal 1,000 — ×0.9 to all — Chill (2) — 25 %
- Resist Frost ×0.5, Blunt ×0.5 · weak Lightning ×1.5, Fire ×1.5, Slash ×1.5 · immune Poison, Bleed, Fear, Grab, Web, Root, Petrify, Blind
- Behavior: Latches the hero with the fullest pool; releases on 10 % HP damage; Bloat Slams after two Latch turns.
- Parts: Steel ×3 (100 %) / **guaranteed** rare: Leech Heart (Leech stone) / break: mouth ring → no drain
- Technique: —
- Stalking: enters at clock 40 through the water, one room per 2 ticks (a slick on the minimap); cannot be fled from in its room; stairs end it; never on F9.
- Visual: a segmented leech with a ringed mouth as wide as a hero, trailing a sack of swallowed lantern-light, 4.0 m; **leech base**; palette drowned purple / mouth pink / inner glow; must read: the ringed mouth; anims Idle/Move/Attack1/Attack2/Hit/Death/Latch-hold/Bloat; 8k tris.

#### Zone boss — Sister Naesa, the Tidebound Priestess
`sister-naesa` · Boss · Medium → Large · Back → Front · F9 (L13) · HP ×15 · Att ×1.7 (spell) · Def ×1.4 · Spd 105 · XP boss (25) · gold ×10 (×3 first kill)
- **Arena — the Drowned Chapel** (`vlt_t_drowned_chapel`; `07` §2.8 owns the room, the arena rule — the rising tide and its steps — add timing, tells and light — **arena light per `07`**). What the attacks below need from it: a water level the party can see, and a way to lower it (the sluice wheel, `07`).
- **Phase 1 (100–50 %) — the Altar.** Back row, with **2 Tidebound Acolyte + 1 Tidebound Blade**. Brine Lash — Frost — normal 1,000 — ×1.3 — Chill (2) — 35 % · Hymn of the Deep — — normal 1,000 — — Fortify (2) + Regen (2) on all adds — 25 % · Tidal Call — — heavy 1,400 — — a Deep Tentacle (×0.5 HP) rises and Grabs the hero with the lowest Strength; **tell:** she raises the conch the turn before (Silence or Daze her, or Guard that hero) — 25 % · Drown — Frost — normal 1,000 — ×1.0 — Silence (1) on a caster — 15 %. Adds re-enter on `07`'s timing.
- **Phase 2 (50–0 %) — the Ascension.** Her arms become tentacles; she steps to the front (Large) with a **Silence aura** (the hero she last hit is Silenced 1 turn). Tentacle Lash — Blunt — normal 1,000 — ×1.5 to the front row — Chill (2) — 35 % · Embrace — — normal 1,000 — ×0.6 — Grab (2 turns), Frost ×0.5 per turn — 30 % · Undertow — Frost — heavy 1,400 — ×1.0 to all — Chill, pulls one back-row hero forward; **tell:** the water drops for a turn — 20 % · Tidal Call — 15 %. Under 20 % the tide rises faster (`07`'s rule).
- Part-breaks: the conch (any hit on the prop, 5 % HP) → no Tidal Call; a tentacle arm (Slash, 10 % HP) → no Embrace, Lash ×1.0.
- First-kill drops: Steel ×10 + Silk ×10 + Brine Pearl ×3, a Tier III Tome, **one A-grade item**, the zone Relic **the Tidebound Idol** (C Relic, `08` §3: once per fight, cleanse every debuff on the party), 1 Grand chest key; opens the Hollow King's stair. Later kills: stack halves, A-grade 10 %.
- Visual: P1 a gaunt priestess in a pearl-sewn shroud with a conch staff, 1.8 m; P2 the shroud torn, two tentacle arms, 2.3 m; humanoid base, cult set D + tentacle-arm attachment (tentacle base 0.6); palette pearl white / drowned blue / kelp green; must read: the conch (P1), the arms (P2); anims Idle/Move/Attack1/Attack2/Hit/Death/Cast/Call/Ascend/Embrace/Undertow; 12k tris.

### 3.4 Floor 10 — the Hollow King

`hollow-king` · Final boss · Large (seated) → Huge (risen) · Front · F10 (L14) · HP ×30 (phases 12 / 10 / 8) · Att ×2.0 · Def ×1.8 · Spd 100 (P3 120) · XP boss (25, ×2 first kill) · gold ×25 (×3 first kill)

**Who he is.** The Keep's last lord, who drowned his own vault to keep what was in it and kept ruling after he drowned with it. The three families are his memory of a household: rats and bandits his servants, the dead his guard, the Tidebound his new faith.

**Arena — the Drowned Throne** (`vlt_t_throne`; `07` §2.8 owns the room, the arena rule, add timing, tells and light — **arena light per `07`**). A long hall, the throne at the far end, **four braziers** that set light, water to the shin. **The King snuffs the light at each phase change** (the step is `07`'s). In **Dark or Pitch** his Hollow Gaze reaches the back row and crits +20 %; in **Radiant** his Shadow attacks are ×0.75 and his adds Fear. An **Item action with a Torch** relights one brazier (+25), once per brazier per phase — four torches is the preparation the F9 merchant sells. Rows: the throne's **tide** pulls every 3 rounds (tell: water lines the floor) — front-row heroes who do not swap back are Slowed (1) and his next Blade is ×1.5 against them; back-row heroes who do not swap forward are Chilled. The rhythm is "swap on the tide, relight on the snuff."

- **Phase 1 (100–60 %) — the Seated King.** He stays on the throne (Front, Large; Taunt works this phase only). Hollow Blade — Slash/Shadow — heavy 1,400 — ×1.8 — Curse (2) — 35 % · Hollow Gaze — Shadow — normal 1,000 — ×1.2, back row only in Shadowy or darker — Fear (2) — 25 % · Court Call — — normal 1,000 — — **adds from the Cellars**: 2 Giant Rat + 1 Grinning Crossbowman — 25 % · Snuff — — light 800 — — light drops by `07`'s step, phase start only — 15 %.
- **Phase 2 (60–25 %) — the Guard Wakes.** The throne rises on a column; he stands (Huge). **Adds from the Crypts:** 2 Skeleton Footman + 1 Wraith, re-called once at 40 %. Hollow Blade — 30 % · Drowned Crown — Frost — heavy 1,400 — ×1.4 to all — Chill (2) — 25 % · Verdict of the Hollow — Shadow — heavy 1,400 — ×2.2 — Mark (3) on the hero with the most Momentum; **tell:** he points for one turn — 20 % · Grave Grip — — normal 1,000 — — Grab a Marked or Chilled hero, 2 turns — 15 % · Snuff — 10 %.
- **Phase 3 (25–0 %) — the Tide Comes In.** Speed 120; light stays wherever the braziers hold it. **Adds from the Vault:** 2 Deep Tentacle; at 10 % Sister Naesa's shade (a Vault Lantern with her nameplate, 1 HP — a story beat); the dungeon's three hunters return on `07` §2.8's arena rule (never one the party killed this delve). Undertow — Frost — heavy 1,400 — ×1.3 to all — Chill, pulls the back row forward — 30 % · Hollow Blade (×2 hits) — 30 % · Hollow Gaze (both rows, any light) — 25 % · Grave Grip — 15 %. The tide pulls every 2 rounds. Petrify, Grab, Fear immune; Stun → Daze; Taunt ignored.
- Part-breaks: the crown (Holy or Blunt, 8 % HP) → Gaze loses Fear; the sword arm (Slash, 10 % HP) → Blade ×1.3; the throne's chain (Lightning on the prop) → the tide stops.
- **First-kill drops:** **one Divine Shard**, Steel ×12 + Silk ×12 + Iron ×12, one **S-grade** item, a Tier IV Tome (bag draw), the Relic **the Hollow Coin** (C Relic, `08` §3: once per floor, re-roll this fight's item drop after the fight), 2 Grand keys, +1 Luck permanent (rulebook §2 open question 2). Later kills: stack halves, Divine Shard 10 %. Opens the Fungal Deep.
- **God-item chance line:** every later kill rolls **1 %** (Hard 2 %, Nightmare 4 %; `08` §7) for one of his three God items — **the Crown of the Hollow King** (God Helmet), **the Signet of the Hollow Throne** (God Ring), **the Last Lantern** (God Relic); counter shown on the boss card, pity at 100.
- Visual: a drowned knight-king in barnacled black plate, a crown of iron and coral, water running from the visor, on a chained iron throne, 2.6 m seated / 3.6 m standing; **hollow-king base** (unique: throne, chain rig, rise animation); palette barnacle black / coral orange / drowned-blue eye-light; must read: the coral crown and lit visor; anims Idle(seated)/Attack1/Attack2/Hit/Rise/Idle(stand)/Move/Attack3/Verdict/Grip/Undertow/Snuff/Death; 12k tris + throne 4k.

### 3.5 Base meshes for Dungeon 1

Fourteen Blender builds cover 35 regulars, 3 hunters and 4 bosses. A **variant** is a scale, a morph target, a decal set or a prop on the base's rig and animation set — never a new rig. Pet babies (§9) reuse these at reduced scale.

| Base | Rig notes | Monsters (scale) |
|---|---|---|
| **rat** | quadruped, tail bone chain | Giant Rat (1.0), Plague Rat (1.1, belly morph), Warren Alpha (1.6, ridge), Old Gnaw (2.4, bald morph, one eye); pet Rat Prince (0.6) |
| **spider** | 8-leg quadruped-pair rig, abdomen bone | Cellar Spider (1.0), Cellar Weaver (1.4, abdomen), Broodmother (3.0, egg sac), Tomb Spider (2.4, bone plates); pet Spiderling (0.3) |
| **humanoid** | the hero rig itself, with costume sets A (bandit) / B (bandit mail) / C (coat) / cult A–D / crone | Cutpurse, Crossbowman, Bruiser (1.25), Netter, Hexer, Captain Vexa Marrow; Acolyte, Blade, Flagellant, Drowner (1.3), Brine Hag, Sister Naesa (+ tentacle arms) |
| **hound** | quadruped canine | Cellar Hound (1.0), the Warden's Hound (1.5, ghost shader); pets Cellar Hound (0.7), Bone Pup (0.7, bone texture) |
| **skeleton** | humanoid rig, bone meshes, no skin weights needed | Skeleton Footman, Skeleton Archer, Bone Knight (1.25, plate), Crypt Sexton (robe), the Barrow Warden (1.75, mantle + lantern + bell) |
| **zombie** | humanoid rig, loose-joint idle, quadruped move set for the Ghoul | Shambling Corpse, Bursting Corpse (belly), Ghoul (0.95, long arms), Drowned Thrall (barnacles), Charnel Hulk (2.2, extra torso) |
| **bat** | hover rig, wing bones | Grave Bat; pet Crypt Bat (0.6) |
| **wraith** | floating cloth, no legs | Wraith |
| **wisp** | a sphere with particles, no skeleton | Vault Lantern (cage prop); pet Wisp |
| **tentacle** | a single bone chain | Deep Tentacle, Deep Maw (×5 instanced around a maw plate), Naesa's arms (0.6) |
| **sentinel** | humanoid rig, stiff idle | Vault Sentinel |
| **ooze** | blob shape keys, no skeleton | Brine Ooze, Pearl Ooze (0.8, inclusions) |
| **leech** | bone chain, mouth ring | the Vault Leech |
| **hollow-king** | unique: humanoid rig + throne + chain rig | the Hollow King |

Rule of thumb for later dungeons: one base per 2.5 monsters; a Monster-role creature may own a base; a boss shares its family's base where the silhouette allows (the Barrow Warden does, the Hollow King does not).

---

## §4 Dungeon 2 — the Fungal Deep (L12–26), outlined

One-liners: `Name — role — rows — attack/gimmick — material`. Zone bands: Gardens L12–16, Warrens L17–21, Spore Heart L22–26. Full entries come in rev. 2 once Dungeon 1 is in the sim. Any light value in the outlines of §4–§6 is a placeholder: **arena light per `07`** (§3–§5 there), as for Gravehollow.

**Zone 1 — the Mycelium Gardens: capfolk & cave beasts.** A lit zone where the plants are the enemy: slow Poison-immune capfolk rings in front, fast beasts ambushing from the dark corners. Teaches **Daze and Silence** (the Shriekcap's cry pushes a hero back on the strip and calls the beasts).
- Sporecap — Fodder — Front — Spore Puff: Poison (2) to the front row on hit; dies into a Poison cloud — Boiled Leather
- Cave Lurcher — Fodder — Front — Speed 135; Pounce from the back row ×1.4 Bleed — Boiled Leather
- Dusk Owl — Fodder — Back — Blind (2) swoop; Owl Feather (Detection stone) — Oak
- Shriekcap — Special — Back — Shriek: Daze all + Silence (1) a caster; calls a Cave Lurcher if it survives 2 turns — Oak
- Capfolk Warder — Elite — Front — cap-shield: Blunt ×0.5, Slash ×1.5; Fortify the ring; Bloom: Regen (2) on the ring — Boiled Leather ×2. Technique: **Capfolk's Bloom** (Beast Tamer, Tier IV)
- Mossback Tortoise — Monster — Front — Huge; Def ×2.5 until flipped by two Blunt crits; Slam Daze — Iron ×3; Moss Tortoise egg
- *Hunter* **the Rootwalker** — a walking root-mass, regrows 10 %/turn unless Burned; Root on hit; guaranteed Spore Sac.
- *Zone boss* **the Shepherd of Caps** (F3) — P1 Sporecap rings and a Silence pulse every 3 rounds; P2 the garden blooms (light +25, every beast in the hall arrives). Relic *the Shepherd's Crook* (Silence one enemy, 2 turns).

**Zone 2 — the Troll Warrens: trolls & slimes.** Tight dark rooms; trolls regenerate 10 %/turn unless Burned and grab like Specials, slimes eat armor. Teaches **Burn as a tool** and **armor wear**.
- Troll Whelp — Fodder — Front — Regen 5 %/turn; Bite Bleed; flees to a bigger troll at 20 % — Wolf Hide
- Acid Slime — Fodder — Front — Engulf: −8 % durability on the target's chest; splits under Slash — Acid Gland
- Warren Troll — Elite — Front — Regen 10 % stopped by Burn (3); Club ×1.6 Daze; Fire ×1.5 — Wolf Hide ×2. Technique: **Troll's Regrowth** (Mender, Tier IV)
- Troll Snatcher — Special — either — Grab a hero and carry them to the back row (allies must reach); Hurl ×1.5 — Steel
- Gelatinous Mound — Monster — Front — Huge; Blunt ×0.5; swallows the Grabbed hero (Poison per turn); splits at 50 % — Yew ×3
- Great Cave Owl — Fodder — Back — Screech Daze; Far Sight: enemies +10 Accuracy for 1 turn — Yew
- *Hunter* **Gristle** — a one-eyed troll with a chain flail; Regen 15 %; Grab; must be Burned to die; guaranteed Troll Marrow.
- *Zone boss* **Mawgrum the Warren-King** (F6) — P1 Regen 10 %, hurls whelps at the back row; P2 the bone heap collapses (light −20), he eats a whelp to heal 25 % (tell: he reaches), Grab + Crush. Relic *Mawgrum's Tusk* (party Regen (3)); A-grade item.

**Zone 3 — the Spore Heart: the spore-touched.** Miners and beasts grown through with fungus, still half themselves; Poison-immune, regenerating while the Bloom lives, Marking the party. Teaches **cleansing** and **killing the source**.
- Spore-touched Miner — Fodder — Front — Pick ×1.1; Silence (1) on crit; speaks a line of the miner it was — Wolf Hide
- Spore Husk — Fodder — Front — bursts into Poison + Mark (2) on the front row — Silk
- Sporeling Swarm — Fodder — either — Speed 130, ×0.4 ×3 hits, Poison; Sporeling egg — Spore Sac
- Fungal Hierophant — Special — Back — Curse + Silence on the healer; Bloom Hymn: Regen (2) all spore-touched — Silk ×2
- Blight Stag — Elite — Front — fungal antlers: Pierce ×0.5; Gore ×1.6 Bleed + Mark; Charge reaches the back row — Wolf Hide ×2
- The Bloom — Monster — Back — Huge, immobile; all spore-touched Regen 10 % while it lives; Spore Storm Poison (3) to all — Blacksteel ×2
- *Hunter* **the Pale Walker** — a spore-touched giant that walks through fungal walls; Mark on sight; Poison aura; guaranteed Bloom Heart.
- *Zone boss* **the Hierarch of Blooms** (F9) — P1 Curse / Silence / Mark rotation with Spore Husks; P2 it tears free of the wall (Large), Grab + Poison. Relic *the Hierarch's Eye* (cleanse the party, once); A-grade item.

**Final boss — the Sporemother** (F10, L26). A cavern-filling fungal queen whose cap is the ceiling. **P1, the Garden:** unreachable; the party kills four **Spore Nodes** (Fortify, Regen) while Sporeling Swarms pour from the cap and the light meter *rises* per node; the fourth drops her stalk into the front row. **P2, the Stalk:** Blunt crits stagger her (Daze); Poison Rain to all every 3rd round, Curse on the Marked, Blight Stag and Hierophant adds; a Marked hero in front takes the Rain ×2, so Marks are spread by swapping rows. **P3, the Heart:** the cap falls (light 0), her Heart sits in the back row — bows, spells and spears only while Spore Husks burst in front; a Torch relights the hall for 2 rounds. First kill: a Divine Shard, Blacksteel ×12 + Wolf Hide ×12, an S-grade item, the Relic *the Sporemother's Breath* (A Relic, `08` §3: Poison all enemies for 3 rounds), a Tier IV Tome; God line 1 % (Hard 2 %, Nightmare 4 %) for her God items (`08` §7: **Rootspire**, **the Mycelial Treads**, **the Sporemother's Heart**). Opens Emberforge.

---

## §5 Dungeon 3 — Emberforge (L24–38), outlined

Zone bands: Ash Halls L24–28, Foundry L29–33, Magma Throat L34–38.

**Zone 1 — the Ash Halls: the Cinderborn (deep dwarves).** Shieldwalls in front, pickers and chainers behind, Burn everywhere; the first family whose own rows change on a tell (the wall opens for the charge). Teaches Frost and Lightning against plate.
- Cinderborn Picker — Fodder — Back — Throwing Pick ×1.2 Pierce, Burn (2) — Blacksteel
- Cinderborn Shieldwall — Elite — Front — pair-linked: two share a Shield (30 %); Blunt ×0.5, Lightning ×1.5 — Blacksteel ×2
- Cinderborn Chainer — Special — Back — Chain-Grab a hero and pull them behind the wall (break the wall to reach) — Glyphweave
- Ember Fox — Fodder — either — Speed 140, Burn bite; Flare Blind (1) on a row; Ember Fox egg — Ash Ingot
- Forge Beetle — Fodder — Front — armor wear ×2 on hit; Shell Slam Daze; Forge Beetle egg — Ironwood
- Cinderborn Warbeast — Monster — Front — a plated boar with a Thane rider: Charge through both rows ×1.8 Stun (1); kill the rider (part-break) and it rampages on its own side — Blacksteel ×3
- *Hunter* **the Smelter** — a Cinderborn in a furnace-suit; Burn aura; Grab and pour (×2.0 Fire); guaranteed Cinderborn Seal.
- *Zone boss* **Thane Brakka Ashbrand** (F3) — P1 behind a wall of four, hammer throws, Fortify rotation; P2 the wall breaks (tell: the horn), Haste charge, Stun hammer, Burn floor on the front row. Relic *the Ashbrand Horn* (party Fortify (2) + Haste (1)).

**Zone 2 — the Foundry: forge-golems & constructs.** Loud, slow, immune to everything organic, weak to Lightning and maces; they Stun. Teaches **Blunt and Lightning as the elite answer** and the **Shock chain**.
- Scrap Golem — Fodder — Front — Blunt ×1.2; rebuilds once at 30 % (tell: it kneels) — Blacksteel
- Anvil Golem — Elite — Front — Def ×2.2; Hammerfall ×1.8 Stun (1); Lightning breaks its Fortify — Skysteel
- Chain Sentinel — Special — Back — Grab by chain from the back row; the chain is a part (Slash) — Ironwood
- Furnace Hound — Fodder — Front — Speed 125, Burn bite; explodes on death — Ash Ingot
- Bellows Engine — Monster — Back — Huge; pumps Burn (3) to all every 3rd round; Rivet Volley to the back row; Shock stalls it a turn — Skysteel ×3
- Rune Keeper — Fodder — Back — Fortifies golems, Silences one caster; dies to one Blunt crit — Glyphweave
- *Hunter* **the Unfinished** — a half-built golem that assembles from each room's scrap as it walks; Stun hammer; guaranteed Golem Core.
- *Zone boss* **the Foundry Master** (F6) — P1 Hammerfall Stun rotation with Scrap Golems while the **mould channels** flood with Fire on alternating rows (swap on the tell); P2 core exposed (Lightning ×2.0), Rivet storm, Chain Sentinels. Relic *the Master's Core* (party Shock immunity + Lightning +30 %, 3 turns); A-grade item.

**Zone 3 — the Magma Throat: salamanders & fire elementals.** Bright lava galleries (Radiant light), Fire-immune, soft to Frost. Teaches **Fear at scale** and **Frost as the weapon**.
- Salamander — Fodder — Front — Spit Fire ×1.1 Burn (2); Molten Hide: melee attackers take ×0.3 Fire — Skysteel
- Salamander Hatchling (swarm) — Fodder — either — Speed 130, Burn nips; Hatchling egg — Salamander Tongue
- Cinder Wisp — Fodder — Back — Blind (2); Weaken (1) on Burned heroes; Pierce ×0.5 — Ember Heart
- Flame Dancer — Special — Back — Fears the whole front row, Burns the back; Frost ×1.5 — Glyphweave ×2
- Magma Elemental — Elite — Front — Def ×2.0; Lava Fist ×1.7 Burn; **cools** under Frost (Def ×0.8, Slash ×1.5) — Skysteel ×2
- Pyre Serpent — Monster — Front — Huge; Fire Breath to all; coils (Grab) one hero; a Frost crit staggers — Ebony ×3
- *Hunter* **the Ember Hart** — a burning stag that leaves a Burn trail on the minimap; Charge reaches the back row; Fear on sight; guaranteed Ember Heart.
- *Zone boss* **Ignatha, the Salamander Queen** (F9) — P1 from her lava pool (back row, no melee), Fire Breath and Burn floor; P2 she climbs out (Large), Grab + Molten Embrace, lays Hatchlings (tell: she arches). Relic *Ignatha's Scale* (Fire immunity, 3 turns); A-grade item.

**Final boss — the Forge-Tyrant** (F10, L38). A Cinderborn king who poured himself into a war-golem body. **P1, the Anvil:** Stun hammer from the dais, Burn floor alternating rows every 2 rounds, Shieldwall adds; the **great bellows** (interactable, 4 hits) blow the forge out for 2 rounds (Fire ×0.5, light −25). **P2, the Casting:** four mould channels flood in a shown order, a Magma Elemental rises from each, Chain Sentinels pull heroes toward them; Frost cools a flooded channel. **P3, Unbound:** he sheds the golem body (it fights on as a Monster for 3 rounds), Speed 130, Fire + Blunt, Fear aura, light 100 but every Burn lasts +1. First kill: a Divine Shard, Skysteel ×12 + Glyphweave ×12, an S-grade item, the Relic *the Forge Sigil* (S Relic, `08` §3: Fortify the party 3 rounds and +5 % durability to every equipped item), a Tier IV Tome; God line 1 % (Hard 2 %, Nightmare 4 %) for his God items (`08` §7: **Daybreak Edge**, **the Greaves of the Unbroken March**, **the Tyrant's Gauntlets**). Opens Frostmarch.

---

## §6 Dungeon 4 — Frostmarch Citadel (L36–50), outlined

Zone bands: Outer Walls L36–40, Frozen Court L41–45, the Roost L46–50.

**Zone 1 — the Outer Walls: frost giants & winter wolves.** Wind-blown battlements: wolves hunt in Haste packs, giants throw what they find, heroes included. Teaches **Chill → Freeze stacking** and the **Huge Grab-and-throw**.
- Winter Wolf — Fodder — Front — Speed 140; packs of 3+ Haste; Bite Chill (2) — Wolf Pelt
- Wolf Matriarch — Elite — Front — hide: Slash ×1.5; Howl Fear (1) on Chilled heroes; calls 2 wolves at 50 % — Basilisk Scale
- Giant Hurler — Special — Back — Grab a front hero and throw them to the back (Daze + Root); Boulder ×1.6 — Adamantine
- Rime Raider — Fodder — Front — giant-kin footsoldier; Axe ×1.3 Chill; Fortify while a giant lives — Moonweave
- Frost Giant Reaver — Elite — Front — Huge; Def ×2.0, Blunt ×0.5; Sweep both front heroes ×1.5 Chill; Fire ×1.5 — Adamantine ×2
- Rime Mammoth — Monster — Front — Huge; Trample both rows, Freeze on Chilled; Tusk Grab — Basilisk Scale ×3
- *Hunter* **the White Hunter** — a giant whose wolf pack grows a wolf every 4 ticks; Spear reaches the back row; guaranteed Giant's Tooth.
- *Zone boss* **Jarl Varrek Coldhand** (F3) — P1 on the gate-tower (Back; Boulder, Fear horn) with Rime Raiders; P2 he drops into the front (Huge), Grab-and-throw, Freeze stomp (tell: the raised foot). Relic *the Coldhand Horn* (Fear (2) all enemies, Freeze the Chilled).

**Zone 2 — the Frozen Court: ice wights & the Pale Court.** A silent palace of frozen nobles still holding court: undead, Frost-immune, torn by Holy and Fire, with **social** Specials (Silence, Curse, Petrify). Teaches **status layering** and light (the halls are Pitch without torches).
- Court Wight — Fodder — Front — Frost blade ×1.1 Chill; Holy ×1.5 — Adamantine
- Frozen Choir — Fodder — Back — three voices: Silence (1) on a random caster each turn it sings — Moonweave
- Pale Courtier — Special — Back — Courtesy: Curse (3); Petrify a Cursed hero (2 turns) — Pale Shard
- Pale Knight — Elite — Front — ice plate: Pierce ×0.5, Fire ×1.5; Duel: Taunt one hero and ×1.5 against them — Adamantine ×2
- Pale Chamberlain — Special — Back — Grab by Frost chain; Freezes the Grabbed hero — Moonweave ×2
- Glacier Revenant — Monster — Front — Huge; Shatter: Freeze all Chilled heroes; each Fire crit chips Def ×0.8 — Drake Scale ×2
- *Hunter* **the Pale Executioner** — a headsman-wight whose axe Petrifies on crit; Fear aura; guaranteed Pale Shard.
- *Zone boss* **Queen Isrevel of the Pale Court** (F6) — P1 from the throne: Silence / Curse / Petrify rotation with the Choir and two Courtiers; P2 she rises (Large), Frost Nova Freezes all Chilled, Grabs the Petrified. Relic *Isrevel's Signet* (party Freeze and Petrify immunity, 3 turns); A-grade item.

**Zone 3 — the Roost: wyrms & drakes.** The peak, open to the sky. Drakes breathe Frost or Fire by variant, wyrms coil and Grab, everything flies. Teaches **everything at once**: both rows under fire, Grab from either row, Fear on sight, Freeze stacks.
- Drakeling — Fodder — either — Speed 130; Frost nip Chill; Drakeling egg (S) — Drake Scale
- Rime Drake — Elite — either — scale: Slash ×0.5, Lightning ×1.5; Frost Breath on a row ×1.4 Chill — Drake Scale ×2
- Ember Drake — Elite — either — the Fire variant (Burn breath); with a Rime Drake it Freezes-then-shatters — Drake Scale ×2
- Wyrm Broodguard — Special — Front — Coil Grab; Crush Frost per turn; Fear immune — Adamantine ×2
- Roost Harrier — Fodder — Back — wyvern-kin; Tail ×1.3 Pierce Bleed; Dive Daze — Elderwood
- Snow Wyrm — Monster — Front — Huge; Burrow (untargetable), erupts under the back row ×2.0 Freeze; Swallow Grab — Drake Scale ×3
- *Hunter* **the Roost Mother** — an elder drake circling the floor (every room it passes gains Chill on entry); Dive Grab; guaranteed Wyrm Fang.
- *Zone boss* **Skaldrath the Elder Wyrm** (F9) — P1 coiled around the aerie (Front, Huge): Frost Breath, Coil Grab, Drakelings; P2 it takes wing (back row only — bows, spells, spears), Dive Freeze, Fear. Relic *Skaldrath's Fang* (party Grab immunity, 3 turns); A-grade item.

**Final boss — the Pale Dragon** (F10, L50). A white dragon so old its scales are the citadel's ice. **P1, the Descent:** it fights from the sky (back row only), Frost Breath on alternating rows every 2 rounds, Fear on landing; the roost's **four chained spires** (interactable, Lightning or Blunt, 5 hits each) ground it one state per chain; grounded, it is Front and Huge. **P2, Grounded:** Bite Grab, Tail Sweep both rows, Freeze on all Chilled, Wyrm Broodguard adds; a wing part-break (Slash, 10 %) keeps it grounded for the phase. **P3, the Cold Heart:** every Breath snuffs the light 25 and in Pitch its Freeze is instant; no braziers up here, only Torches; Speed 125, Breath on both rows, Grab the Frozen, Fear and Petrify immune. First kill: **1–3 Dragon Scale guaranteed** (SS; 1 on later kills), a Divine Shard, Adamantine ×12 + Moonweave ×12, an SS-grade item at 25 % (else S), the Relic *the Pale Mirror* (SS Relic, `08` §3: the next enemy action aimed at you reflects back at its user), a Tier V Tome (the only Tier V source besides Shards); God line 1 % (Hard 2 %, Nightmare 4 %) for her God items (`08` §7: **Wintervane**, **the Ancient Dragon's Mantle**). What comes after it is the first content patch.

---

## §7 Size and status rules

**Sizes.** Small (rats, bats, spiders, wisps) · Medium (humanoids, hounds, skeletons) · Large (Alpha, Bruiser, Bone Knight, Sentinel, Tentacle, Broodmother) · Huge (Hulk, Deep Maw, Leech, Barrow Warden, risen Hollow King).

| Rule | Small | Medium | Large | Huge |
|---|---|---|---|---|
| Can be Grabbed / Webbed / Rooted | yes | yes | Web no; Root yes; Grab only by a Huge | immune to all three (Slow instead) |
| Can be Petrified / Frozen | yes | yes | Freeze → Chill only | immune; Freeze → Chill |
| Reach | hits one row | hits its row's target | sweeps may hit both front heroes | occupies both rows: melee from the hero back row reaches it (spears not needed) |
| vs the **Halfling's Small trait** (`05-SPECIES.md`) | — | — | single-target melee −10 % Accuracy vs Small heroes | −15 % Accuracy vs Small heroes |
| Knockback / row-push on it | yes | yes | no | no |

**Grab (the disabler).** A Grabbed hero cannot act and can be targeted only by the grabber; they are freed when **(a)** the grabber takes damage ≥ **10 % of its max HP** since the Grab began, **(b)** an ally uses the **Free Ally** command (weight 600, no pool cost, never misses, Item-class so it works while Silenced), **(c)** the grabber is Dazed, Stunned, Blinded or killed, or **(d)** the cap expires (fodder 2 of the grabber's turns · special 3 · monster 3 · boss 2, then it may re-Grab). Net and Cocoon are Grabs. The same monster cannot Grab the same hero twice without one full turn free.

**Web.** Root + Speed −30% (`03` §3.5); Fire on the hero or the webber ends it. Durations: fodder 1 · special 2 · boss 3. **Root:** cannot swap rows or flee; fodder 1 · special 2 · boss 3. **Fear:** 50 % to Guard instead of acting, each turn (`03` §3.5); fodder cannot apply it; special / hunter / boss 2 turns; Willpower resists the application, not the skip. **Daze:** −500 on the timeline, once per application; the same source cannot Daze the same hero twice in 2 turns. **Petrify:** pushed to −1,000, Defense +50 % while petrified (`03` §3.5); only ever after a Curse.

**Bosses and hunters.** Stun → **Daze** (they lose 500, never a turn); **Petrify immune**; **Taunt works in phase 1 only** (zone bosses) or never (final bosses); Grab, Web, Root, Fear immune; Freeze → Chill; Slow, Weaken, Blind, Silence, Curse, Mark, Bleed, Burn, Poison and Shock all work at duration −1 — the long list is deliberate so debuff classes stay useful. Hunters: as bosses, but Taunt works. Role-Elites: as Large. Undead: Poison, Fear immune; bone also Bleed. Constructs: Poison, Bleed, Fear immune. Oozes: Pierce ×0.25; Grab, Web, Root, Blind, Petrify immune.

---

## §8 Encounter design rules

1. **Party size** (rulebook §11.2): tables are written for 3 players; monster *count* ×0.6 / ×0.8 / ×1.0 / ×1.2 for 1 / 2 / 3 / 4 (round to nearest, minimum 1, a Special or Monster never removed), monster *HP* ×0.7 / ×0.85 / ×1.0 / ×1.15. Bosses and hunters: count fixed, HP scaled; boss adds use the count rule.
2. **Role mix per floor.** A generated floor's fight rooms together hold ≥ 2 Fodder-only packs, ≥ 1 encounter with a Special, ≥ 1 with a role-Elite (F2+), and at most one Monster room (8 %, never adjacent to Entry or Boss); the generator rerolls a floor that fails. One encounter never holds more than 2 Specials or 1 Monster.
3. **Ambush** (§4.4): base 15 % + light band + the **family modifier** of §1 or the highest individual modifier in the encounter (not the sum) − the party's Perception bonus. Individual: rats, hounds, bandits, Cellar Spider, Deep Tentacle, beasts +15; Grave Bat, Wraith, wolves +10; constructs −15; giants −10. The reverse roll ignores family modifiers.
4. **Elite rooms** (8 %): the floor's encounter with one champion; affixes 1 / 2 / 3 by floor (§2), F1–2 from the five-affix teaching pool; never a Monster or a Hunter. Dungeons 2–4: 2 / 3 / 4.
5. **Gold per fight** = Σ (baseline gold × gold×) × (1 + 0.1 per affix) × 1.25 in a Monster room; the runner rescales baseline gold so a 3-floor delve lands on **R** (≈ 300 at F1–3, ×1.6 per band) with the boss worth about 25 % of R. Treasure and curios are on top.
6. **XP per fight** = Σ XP class × the level's XP unit × the difficulty curve D (§5.1), by participation. Champions +2 classes; hunters use their raised level for D.
7. **No palette swaps past floor 5.** A monster sharing a base mesh with an earlier one and appearing on F6+ must carry **one attack the earlier one lacks** and **one silhouette element** (prop, limb, morph, glow) that reads at 200 px. The lint checks base-mesh pairs in `content/monsters/*.json` (Drowned Thrall vs Shambling Corpse: Cling + barnacles passes; a grey rat on F6 fails).
8. **Techniques.** Each class has exactly two monster techniques (Tier III–IV, on its sheet); this file says which monster teaches each so Insight (§7.5) has targets. Dungeon 1 teaches: Warden 2 (Bone Knight's Stand, Sentinel's Sweep), Blade 2 (Ghoul's Grasp, Bone Knight's Cleave), Ranger 2 (Deep Tentacle's Drag, Grave Bat's Screech), Shade 2 (Wraith-step, Hag's Hex), Arcanist 2 (Hag's Cauldron, Sentinel Pulse), Beast Tamer 1 (Grave Bat's Shriek), Mender 1 (Wraith's Lament); Dungeon 2 teaches the Beast Tamer's Capfolk's Bloom (Capfolk Warder) and the Mender's Troll's Regrowth (Warren Troll) — see Open questions.
9. **Fight length** (§3.6): fodder packs 3–4 rounds, Special encounters 4–6, role-Elite 5–7, Monster 6–8, hunter 6–8, boss 10–15; the runner reports each row's mean and flags ±1.
10. **Tell discipline.** Every disabler and every boss attack that removes a hero has a one-turn tell on the strip or the model (a crouch, a raised conch, a swelling belly); none lands on the turn its tell shows; the first use per delve pops a two-word hint ("Netter reloading").

---

## §9 Pet species (16)

Eggs drop as rare parts (4 %) from the source monster and from Pet Egg chests of the band (rulebook §8.3). Grade sets stats and the number of actives; the species sets the trait, the two actives and the lean. All pets are timeline actors with the four stances of §9; the lean is the stance the AI picks when the owner has not set one.

| Species | Grade band where eggs drop | Source family | Trait | Active 1 (lvl 5) | Active 2 (lvl 15) | Base role | Visual (Blender base) |
|---|---|---|---|---|---|---|---|
| **Cellar Hound** | F–E (Cellars) | Vermin & Grinning Co. | ambushes −15 % | Bite — Pierce ×1.0, Bleed (2) | Guard Dog — intercept 50 % for 2 turns | Guard | hound base 0.7, pup proportions, rope collar |
| **Rat Prince** | F–E (Cellars) | Vermin | +10 % gold found | Nibble — Pierce ×0.8, steals 2 % gold back from a Cutpurse | Scavenge — one extra part roll at fight end | Forage | rat base 0.6, a tin crown, sleek fur |
| **Spiderling** | F–D (Cellars, Crypts) | Vermin (spiders) | +5 Detection | Web Spit — Root (1) one enemy | Venom Bite — Poison (3) | Fierce | spider base 0.3, big eye cluster |
| **Crypt Bat** | E–D (Crypts) | Restless Dead | reads light one band brighter for its own rolls | Shriek — Daze one enemy | Blood Drink — heal the lowest ally 10 % | Mend | bat base 0.6, round ears |
| **Bone Pup** | E–D (Crypts) | Restless Dead | Poison immune; party Resistance +5 % | Gnaw — Pierce ×0.9 | Rally Bones — Shield 10 % on the owner | Guard | hound base 0.7 with bone texture, blue eye-lights |
| **Wisp** | D–C (Vault Lantern, shrines) | Tidebound / shrines | light +1 band for the party's scouting; +5 Detection | Soothing Light — heal 12 % lowest ally | Cleanse — strip one debuff | Mend | wisp base, pale gold |
| **Brine Crab** | D–C (Vault) | Tidebound | blocks 20 % of hits on itself | Pinch — Grab a Small enemy (1 turn) | Tide Shell — Shield 15 % on one ally | Guard | crab base (new, 0.5 m), pearl on the shell |
| **Vault Imp** | C–B (Vault, Hag drops) | Tidebound (the Hag's familiar) | +10 % gold; Lockpicking +2 | Pilfer — steal a buff | Hex — Weaken (2) | Forage | imp base (new, 0.6 m), salt-white, pearl eyes |
| **Sporeling** | C–B (Spore Heart) | Spore-touched | Poison immune; Regen 2 %/turn | Spore Puff — Poison (2) to the front row | Regrow — Regen (3) on one ally | Mend | sporeling base (new, 0.5 m), a walking cap |
| **Moss Tortoise** | C–B (Gardens) | Cave beasts | intercept +10 % in Guard | Shell Bash — Blunt ×1.0, Daze | Bulwark — Fortify (2) on the party | Guard | tortoise base (new, 0.6 m), moss shell |
| **Cave Owl** | C–B (Gardens) | Cave beasts | scouting +15 % | Swoop — Pierce ×1.1 | Far Sight — reveal adjacent rooms on entering, once per floor | Forage | owl base (new, 0.5 m), huge eyes |
| **Ember Fox** | B–A (Ash Halls) | Cinderborn | ambushes −15 %; Fire ×0.5 | Ember Bite — Fire ×1.0, Burn (2) | Flare — Blind (1) all enemies | Fierce | fox base (new, 0.6 m), ember tail-tip |
| **Forge Beetle** | B–A (Ash Halls, Foundry) | Constructs | party armor wear −20 % | Shell Slam — Blunt ×1.2 | Rivet — +5 % durability on one item at a rest room | Guard | beetle base (new, 0.5 m), brass shell |
| **Salamander Hatchling** | B–A (Magma Throat) | Salamanders | Fire immune | Spit Fire — Fire ×1.1, Burn (2) | Molten Hide — Thorned (20 %) on one ally, 2 turns | Fierce | salamander base 0.4 of the monster, ember belly |
| **Frost Kit** | A–S (Outer Walls) | Winter wolves | Chill immune; party Crit +3 % | Frost Nip — Frost ×1.0, Chill (2) | Snowblind — Blind (2) one enemy | Fierce | fox/wolf base 0.6, white, blue eyes |
| **Drakeling** | S–SS (the Roost) | Wyrms & drakes | party damage +5 %; Fear immune | Drake Breath — Frost ×1.2 to a row | Wing Guard — intercept 40 % + Fortify (2) on the owner | Fierce / Guard | drake base 0.5 of the monster, stubby wings |

**Creation eggs** (rulebook §2.3, one of three at F-grade): **Cellar Hound** (Guard), **Rat Prince** (Forage), **Spiderling** (Fierce). A Mend-leaning starter is deliberately absent so the first Crypt Bat egg feels like a find; see Open questions. Ranch-imported pets (`14-IDEAS.md`) take a species slot by nearest silhouette.

---

## Open questions (for James)

1. **Counts.** Dungeon 1 ships 35 regulars + 3 hunters + 4 bosses on 14 base meshes. Right for Segment 1–2, or ship the Cellars' 12 first and add the rest floor by floor?
2. **Hide in Gravehollow.** The fixed map gives Rawhide/Leather to the Cellars but no D/C hide to the Crypts or Vault, so Rangers and Shades would stall at E. Proposed regional variants **Cured Ghoulhide** (= Boiled Leather, Crypts) and **Sharkskin** (= Wolf Hide, Vault), identical numbers. Accept, or leave hide to the Fungal Deep and the blacksmith's stock?
3. **Champion ×2.5 on top of role-Elite HP ×2.0–2.6.** A Bone Knight champion is ×6 HP at F6 — intended, or exclude role-Elites from promotion?
4. **Hunter level = floor +3.** Old Gnaw on F1 is L4 against L1 heroes: beatable with a party, a wipe for a careless solo. Keep, or floor +2 on F1–2?
5. **The Hollow King's torches.** Should the F9 merchant guarantee four Torches, or should the throne room start with a torch rack?
6. **Mender and Beast Tamer techniques.** Each has one in Dungeon 1 (Wraith's Lament; Grave Bat's Shriek) and its second in the Fungal Deep (Troll's Regrowth from the Warren Troll; Capfolk's Bloom from the Capfolk Warder). Acceptable, or should the sheets move both second techniques onto Gravehollow monsters (the Crypt Sexton, the Tidebound Acolyte)?
7. **Gold in play mid-fight** (Cutpurse steals, Pearl Ooze flees). A verb you want, or does it fight the bank rule?
8. **Creation eggs.** Cellar Hound / Rat Prince / Spiderling = Guard / Forage / Fierce; swap Spiderling for the Wisp so a Mend pet exists from minute one?

---

*Numbers feed `content/monsters/<id>.json`, `content/encounters/<id>.json` and the balance runner (`12-ROADMAP.md`, Phase 2). Decisions: D-024 (baseline multipliers, scaled tables), D-033 (regional hide variants), D-045 (roles and the affix pool), D-046 (base-mesh variants), D-047 (the Grab rule).*
