# Package review — 2026-10-26

*An independent reviewer (an agent that had not seen the package being written) read every doc and schema and listed the contradictions below; the reconciliation that followed is logged after it. Kept so Claude Code and James can see what was fixed and what was a judgement call (D-042–D-044 in `13-DECISIONS.md`).*

## The review

# Gloamvault design package — contradiction & blocker review

Scope: `CLAUDE.md`, `README.md`, `PROMPT.md`, `docs/03`–`13` (minus research), the seven class sheets, `content/README.md`, schemas and examples. Only disagreements and gaps are listed.

## 1. Hard contradictions

1. **Monster techniques — 06 vs 09 + every class sheet.** 09 §2 and the sheets give each class exactly two techniques (Warden "Bone Knight's Stand", "Sentinel's Sweep"; Mender "Wraith's Lament", "Troll's Regrowth"; Arcanist "Hag's Cauldron", "Sentinel Pulse"; Ranger "Deep Tentacle's Drag", "Grave Bat's Screech"). 06's `Technique:` lines assign other moves and tiers — "Skull Crack — Warden, Tier II", "Grave Guard — Warden, Tier IV", "Corpse Toss — Warden, Tier IV", "Bone Ward — Mender, Tier III", "Shriek — Arcanist, Tier II", "Web Shot — Ranger, Tier III", "Evil Eye — Shade, Tier III" — and 06 §8.8 counts "Warden 5, Blade 2, Ranger 3, Shade 4, Arcanist 3, Beast Tamer 4, Mender 1". Only "Ghoul's Grasp — Blade, Tier III" agrees.
2. **Gravehollow boss arenas, phases and first-kill drops — 06 vs 07 vs 08.**
   - Barrow Warden: 06 "one A-grade item (F6 rule) … the zone Relic the Warden's Lantern … 1 Grand chest key"; 07 "the D-grade talisman Sexton's Lantern"; 08 §11 "one D item … Barrow Bell (D Relic)". Arena: 06 "four bone piles … 2 Wraiths drift in"; 07 "the Warden's Oath: he never strikes a hero who has not struck him … raises … a Bone Knight elite".
   - Hollow King: 06 "Phase 1 (100–60 %) … Light starts at 75 … one Divine Shard … one S-grade item, a Tier IV Tome … 2 Grand keys"; 07 "Phase 1 (100–66%) … light set to 70 … the three hunters return … the Hollow Crown (A-grade relic: once per fight, set the room's light to 100)"; 08 "one C item at +1 shape … Hollow Coin (C Relic) … Tier III Tome … Divine Shard on Hard (1) / Nightmare (2)" (no Shard on Normal). 06's Hollow Crown is "all enemies Fear (2), the party Fortify (2)".
   - Vexa: 06 "the Grinning Coin … 1 Standard chest key"; 07 "a D-grade weapon with the Grinning affix"; 08 "Grinning Mask (C Relic)". Naesa: 06 "Naesa's Conch"; 07 "the C-grade focus-or-shield Naesa's Shell"; 08 "Tidebound Idol (C Relic)" (and 08 still calls her "working name the Tide Priest"; 07 fields "two Cantors" although D-035 reads "Cantor → Drowner").
3. **Dungeons 2–4 — 06 §4–6 vs 07 §3–5.** 07 says "the bosses are fixed", yet every zone family, hunter and zone boss differs: 06 "the Shepherd of Caps … Mawgrum the Warren-King … the Hierarch of Blooms … Thane Brakka Ashbrand … the Foundry Master … Ignatha … Jarl Varrek Coldhand … Queen Isrevel … Skaldrath" vs 07 "the Blightcap Matriarch … Gruk Nine-Hands … the Choir of Spores … Thane Ulda Brasshand … the Ninefold Anvil … Sulphrine … Warlord Skarn … the Pale Chamberlain … the Brood-Sire". Zone levels: 06 "Warrens L17–21" vs 07 "16 · 18 · 19". Final-boss loot: 06 Forge-Tyrant "the Relic the Tyrant's Hammer (Stun one enemy; bosses Daze)" vs 07 "Tyrant's Hammer (S-grade maul, Burn on hit) … 2 Divine Shards" vs 08 "Forge-Tyrant's Hammer … 20% Stun on crit". Pet eggs: 06 "Sporeling / Cave Owl / Forge Beetle / Frost Kit / Drakeling" vs 07 "Glow Moth, Warren Pup … Cinder Salamander, Slag Beetle … Rime Fox, Wyrmling, Aurora Wisp". God items: 06 "the Drowned Crown … the Spore Heart … the Pale Dragon's Mantle" vs 08 "Crown of the Hollow King … Sporemother's Heart … Ancient Dragon's Mantle"; God chance 06 "1 % (Hard 2 %, Nightmare 3 %)" vs 08 "1% on Normal / 2% Hard / 4% Nightmare".
4. **Encounter tables — 06 §3 vs 07 §2.3.** 06: "Rat Pack | 3 Giant Rat + 1 Plague Rat | F1–2 | 20" etc. 07: "Cellars A: Plague Rat packs (3–4), Cellar Spider pairs"; "Crypts C: 2 Tomb Spiders (Web) + Ghoul" (three Specials, against 06 §8.2 "One encounter never holds more than 2 Specials"); "Crypts B: 2 Ghouls + Grave Bats" on F4 though 06 places Ghoul "F5–6"; "elite: Tidebound Blade" though 06 makes it "Fodder".
5. **Hunter level.** 06 "Hunter — Old Gnaw … (level = floor +3)" vs 07 §2.9 "Above band by +2 levels".
6. **Vault monster levels.** 08 §8.3 "the Drowned Vault (F7–9, L9–12)" and §11 "10 … 13–14" vs 06 "Vault L10–13, throne L14" and 07 "F7 | 10 … F9 | 13".
7. **Promotion counts.** 03 §6.5 "Counts per promotion (F→E … SS→God): 4 / 6 / 8 / 10 / 12 / 16 / 20 / 30 / 50" is nine numbers for eight steps; 08 §8.2 re-reads "Forge F | 4 … F → E | 6" (D-031 is only Proposed).
8. **Chest and drop odds.** 03 §8.3 "B 56% · A 25% · S 14% · SS 5% · God 0%"; D-008 "drop shape 56/25/14/4/1"; 08 §10 "centre 55 · +1 25 · +2 14 · +3 5 · +4 1" and §11 "centre 55 · −1 25 · +1 14 · +2 5 · +3 1"; `content/README.md` claims "the rulebook's Standard table at band B reads 55 / 25 / 14 / 5 / 0, which sums to 99"; D-030 "56/25/14/5 → SS 6%" sums to 101. Grand: 03 "shifts one grade up and adds a 5% Divine Shard line" vs 08 "+1 45 · +2 35 · +3 15 · +4 5".
9. **Pacts timing.** 03 §11.2 "the modifier menu ("Pacts") in Segment 3" and 07 §6.2 "Segment 3 in the roadmap" vs 12 Phase 7 (Segment 2) "the Pacts menu (Normal/Hard/Nightmare + 12 Pacts)".
10. **Weapon handling and starter kits — sheets/D-041 vs 08.** D-041 "two-hander basic = 1.4× at 1,400 … Crude gear requires Str 10" vs 08 "a Greatsword 20 / 1.4 = 14.3 plus Cleave" (1.0× basic), "Breastplate … Str requirement 12", "Greatsword … Str 14". Kits: warden.md "Pine-and-Copper Kite Shield (Block 25%)" vs 08 §12 "Pine Buckler"; blade.md "Copper Sword ×2" vs 08 "Copper Longsword | Copper Dagger"; mender.md "Copper Mace · Pine Holy Symbol" vs 08 "Copper Censer | Copper Holy Symbol" (08 makes the censer a 1h main-hand weapon; 03 §6.3 "Censers/Holy symbols (Mender foci)"); beast-tamer.md "Pine Lantern (off hand)" vs 08 "Pine Buckler". Staff weight: 04 §5 "staves 1,400" and arcanist.md "Staff … heavy 1,400" vs 08 "Staff | 2 | … | 1,000". Mail vs Blunt: blade.md "hit it ×1.5" vs 08 §2 "does ×1.25 damage". Buckler: warden.md "Block 20%" vs 08 "15%".
11. **Status magnitudes.** warden/blade/ranger/shade "Weaken −20% Attack · Fortify +20% Defense · Mark +15% damage taken" vs arcanist/mender/beast-tamer "Fortify +20 Defense · Mark +20% damage taken" vs 08 "Fortify Draught … (+30% Defense)"; Bleed "4% max HP per tick" (sheets) vs `status.example.json` "multiplier 0.2 … per stack, of the applier's Attack".
12. **Field-skill bonuses.** 04 §5 "each class starts with +2 rank in two of them" vs 09 §5's "Class +2 at start" column (Warden: Field Repair only; Blade: none; Arcanist: Cartography only) vs the sheets (Warden "First Aid +2"; Blade "Field Repair +2 … Cooking +2"; Arcanist "+2 rank in Haggling"; Beast Tamer "Field Repair" and no Cooking). Dwarf: 03 §7.6 "Cartography (… Dwarf bonus)" and 09 "Cartography … Dwarf" vs 05 "Forge-born | Field Repair effective rank +2" with no Cartography line.
13. **First Aid in combat.** 03 §12.1 "revive within 3 of the downed hero's turns (First Aid skill, a Mender skill, or a Phoenix Feather)" vs 04 §5 "Revive out of combat — First Aid; in combat only the Mender, a Phoenix Feather, or an Ultimate" vs 09 "in-combat use at rank 5 (weight 1,000)" vs 08 "Bandage … in combat with First Aid: revive at 15%" vs mender.md "Breath of Life (Tier II) is the only in-combat revive skill in the game".
14. **Treasure-room chests.** 07 §2.7 "Small 60% / Large 30% / Large locked 10% … Trapped by zone: Cellars 20% / Crypts 30% / Vault 40%" vs 08 §10.3 "Treasure rooms hold a Large chest 20% … Small … Trapped 15% … Large … 25%".
15. **Room budget and base meshes.** 07 §2.2 "a room stays under 30 k static tris and 60 draw calls" vs 11 §9 "≤ 60k tris, ≤ 25 draw calls". 06 §3.5's fourteen bases (… "wisp", "leech", "hollow-king") vs 11 §4's fourteen ("… corpse, ghoul, wraith, bat, hulk, acolyte-on-the-rig …").
16. **File and folder layout.** `content/README.md` "one file per record … content/<kind>/<id>.json … statuses/<id>.json" vs 03 §3.5 and every sheet "content/statuses.json", 03/04 "content/skills/<class>.json", 09 "content/skills/<class>/<id>.json", 08 "content/items/weapons.json, armor.json …, loot-gravehollow.json, starter-kits.json", 06 "content/encounters/<dungeon>-<zone>.json", 11 "content/dungeons/*/templates.json", 05 "content/species/faces.json". 05 §5 "prototype/blender/hero/rig_base.blend … build_species.py" vs CLAUDE.md/10/11 "tools/blender/ … hero/build_body.py" (no `prototype/` is planned in this repo).
17. **Decision ids.** 10 §5 "Model (D-010)" and §8 "(D-016)" — in 13 those are materials and the light meter; 11 "Decisions D-014–D-019" (only D-019 is art); 05 "D-041 … D-048 proposed for this file"; 06 "D-041 (roles and affix pool), D-042 (base-mesh variants), D-043 (Grab rule)" — 13's D-041 is weapon handling and nothing past it exists; 08 "D-0xx entries".

## 2. Schema vs docs gaps

- `monster.monsterTechniqueSkillId` is a single id and rule 7 wants it to "point back"; the sheets need Bone Knight, Brine Hag, Vault Sentinel, Wraith and Grave Bat to each teach two classes.
- `status` enum has no Smite or Wither (03 §3.4 marks; Mender "applies the Smite mark", Shade "Wither: −50% healing", Warden's Hound "Wither"), no Veil (shade.md keeps it out deliberately but asks), no Thorned (06 §9 "Molten Hide — Thorned (20 %)").
- `weaponType` lacks lantern and horn (04 "+ lantern / horn"; beast-tamer.md starter "Crude Pine Lantern (off hand)"), a 1h "Short spear", shortbow vs longbow (05 "Longbows locked (shortbows and crossbows fine)" — `restriction.weaponType: "bow"` locks both), reliquary, rod.
- `target` enum cannot say "Single + behind", "Random enemies, any row", "Field", "Party front row", "Party back row", "All downed allies", "Summon", "Pet + all summons", or a *fallen* hero (Rebirth). `skill.requirements` has `shield` and `weaponTypes` but no dual-wield/two-hander flag (Iron Dance "require two one-handed weapons", Executioner "require a greatsword or great axe").
- `pet.actives` is exactly two at `unlockLevel` 5/15; 03 §9 and 06 §9 say "how many actives (1 / 2 / 3 at F–C / B–A / S+)".
- `zone` needs one `bossId` "on the zone's last floor" and a `hunterId`; rule 13 wants `merchant: true` on the floor before. 07's Vault zone is "four when the zone carries the final floor (F7–10)" with Naesa on F9, the Hollow King on F10, "None on F3, F6, F9, F10" hunters and no merchant on F9 — not expressible either as one zone or as a hunter-less fourth zone.
- Curio choices carry only `requiresItemId`; 07 gates on "Foraging rank 3+", "Cooking rank 2+", "Detection ≥ 14", "Strength ≥ 14", "Lockpicking vs 12", "Stake 0.05 R". Trap has one `effect` and no trigger/"Revealed by" ("a Cellar Hound pet always", "Cartography rank 2+"); `disarmReward` is `{gold, itemId}` with no quantity ("2 Rawhide, 0.01 R").
- No schema for elite affixes (README: 06 §2 "does not exist yet" — it does), contracts (07 §7), sets (08 §6), floor loot tables (08 §11), in-dungeon Small/Large chests (`chest.kind` is gear/petEgg/materialCrate/skillTome only), boss "Every kill" and God-chance lines, chest keys (`firstKill.kind` has no key). `hero.equipment` has no Draconid "twelfth, unremovable armor piece" and no Human third "loadout preset".
- `species.rule` cannot express Dwarf "Mana pool ×0.90" or Stonefoot "Immune to Root and to every forced row move", Orc "merchants charge +10%", Halfling "Large-size monsters … −10 pp Accuracy", Elf "Fear resistance −10 pp".

## 3. Blockers for Phases 1–4

1. **Phase 2's done-when needs Phase 3's content.** 12 Phase 2: "Done when: npm test and npm run balance run green and the first balance report exists"; classes, skills and monsters only arrive in Phase 3 ("From the docs into JSON"). The roadmap is silent on placeholder content.
2. **Thirteen schemas is an Accepted decision, Phase 3 needs more.** D-020 "validated by thirteen schemas"; CLAUDE.md "never change an Accepted decision"; yet Phase 3 ships "the Cellars loot tables", "the Cellars' contracts", "the starter kits", "the four chest types" (town only in the schema) — none has a schema (see §2).
3. **Monster-technique data cannot lint.** Rule 7 plus the single `monsterTechniqueSkillId` make the sheets' pairs unsatisfiable, and 06 names different techniques (§1.1) — two readings, no owner.
4. **Two owners for encounter tables and starter kits.** 06 "encounter tables go to content/encounters" vs 07 "a floor draws from its tables" (§1.4); 08 §12 kits vs the sheets' §2 (§1.10). 08 only says "Class lists above are the proposal for 04-CLASSES.md; that file wins if it differs" — nothing for kits or numbers.
5. **No owner for status numbers.** 03 §3.5 "each owning its numbers in content/statuses.json"; the sheets only "assume" values and disagree (§1.11); Phase 2 must build "the status set with its tick rules".
6. **PROMPT.md vs CLAUDE.md.** PROMPT step 2 "If something is missing, give me step-by-step Windows instructions and wait" and step 3 "otherwise ask me" are stop conditions CLAUDE.md rule 2 ("never stop to ask inside a segment") and rule 10's list do not allow; step 2 also verifies Blender in Segment 1, which no Phase 1–4 uses. CLAUDE.md lists `npm run sim -- --delve …` and deep links `#viewer=…`, `#town` "(docs/07-DUNGEONS.md §8)" that neither 07 §8.3 nor 10 §7 define.

## 4. Originality risks

- **Hearthstone** — 07 §5 Frostmarch item ("a Hearthstone (merchant; held by one hero, warms the party for 4 rooms)") and 05 Dwarf skin tone "Hearthstone `#D9A98C`": a Blizzard title and the WoW item of the same name.
- **Runecloth** (B cloth rung, 03/08) — a WoW cloth; **Mithril** (A metal) — Tolkien's coinage (D&D deliberately uses "mithral").
- **Myconid** (06, 07, Beast Tamer) — D&D-coined creature; 06 §0 calls it "shared vocabulary".
- Elite affixes "Shielded · Vampiric · Jailer · Frenzied · Thorned · Illusionist" reproduce Diablo 3's Shielding/Vampiric/Jailer/Frenzied/Thorns/Illusionist list (06 cites "Diablo 3's").
- Low: "Lifebloom" (Mender IV), "Ironbark" (05 skin tone), "Skybreaker" (Arcanist V) are WoW names; "Hollow King" + "the Pale Court/Pale Dragon" sit close to Hollow Knight's "Pale King".

## 5. Nits (≤ 10)

1. Examples contradict the docs they illustrate: `class.example.json` Warden "+1 Str, −1 Agi, +1 Vit, +2 End, +1 Will", Ultimate "warden-unbreakable", technique "warden-ghouls-grasp"; `species.example.json` Dwarf "−1 Luck", "Deep Maps … Cartography +2", locks all bows; `dungeon.example.json` Cellars `"hunterId": "wardens-hound"`, Hard/Nightmare "130/170" vs 07 "125%/150%"; `encounter.example.json` Plague Rat in "back".
2. The Crypts pet is "Crypt Bat" in 03 §9/06 §9 but "Grave Bat" in shade.md and arcanist.md loadouts/examples.
3. Trap Disarm: 03 "50% + 2% × (skill − difficulty/2)" vs 07 "50% + 2% × (rank × 5 − difficulty / 2)"; Lockpicking 09 "+5% success" vs 08 "2% × (rank − difficulty/2)".
4. 03 §2.3 "A total of about 86–90 across the eight" — 80 + 2 + 4 + 6 = 92.
5. F armor totals: 08 Mail 15 / Leather 10 vs blade.md "= 14" / ranger-shade "= 8"; Warden 08 "Tower … −10 Speed, Str 15" vs warden.md "−5 Speed, Str req +2".
6. 03 §4.1 "8–14 rooms" vs 07 F1 "5–7", F10 "4"; 03 §8.4 "one Merchant room per floor" vs 07 "always F2, F5, F8".
7. Clip count: 05 "15 clips … Two species-specific clips … 17 clips"; 11 lists 17 (with Attack_Dual, Defeat) before species specials; 12 "17 + species specials".
8. Hollow King Phase 1 adds: 06 "2 Giant Rat + 1 Grinning Crossbowman" vs 07 "two Vault Sentinels on the steps"; light 75 vs 70.
9. Arcanist/Mender kits omit the pet egg and Repair Kit 03 §2.3/08 §12 give everyone; potions are "Minor Potion", "Lesser Healing Draughts", "Small HP Potions" across files; 08 §8.3 still says "F40" for the Pale Dragon (global floor) and 07 puts Frostmarch at "R ≈ 3,150" (A band) though floor 31 is 08's S band.
10. `content/README.md` says 06 §2 "does not exist yet"; D-011 credits the Skill Hall ramp to "Octopath" where 03 §7.4 says "(Guild Wars)"; 10 §2/12 say `net/` while 10 §3's tree puts it at `client/src/net/`.

## The reconciliation log

# Reconcile log — Gloamvault design package (2026-10-26)

Owner rule applied throughout: `03-GAME-DESIGN.md` rev. 2 ownership table. Files NOT touched: `docs/research/`, `docs/02-RESEARCH.md`, `content/`, `CLAUDE.md`, `README.md`, `PROMPT.md`, `docs/01-VISION.md`, `docs/14-IDEAS.md`. `03-GAME-DESIGN.md` touched only for the item-15 renames.

## docs/03-GAME-DESIGN.md (renames only)
- §6.4: "Mithril blade" → "Skysteel blade".
- §6.5 ladder: Runecloth → Glyphweave (B cloth); Mithril → Skysteel (A metal).
- §11.4: "myconids" → "capfolk".

## docs/06-MONSTERS.md
- §0: encounter-table path → `content/encounters/<id>.json`; added the Technique-line convention (sheets own the skill, 06 owns the teacher); "generic words" list drops "myconid".
- §1 family table: Myconids → Capfolk; Runecloth → Glyphweave; Mithril → Skysteel.
- §2: affixes Jailer → Shackler, Frenzied → Rabid, Illusionist → Mirrored (nameplate example and the F1–2 teaching pool too).
- Every `Technique:` line rewritten to the sheet skills by exact name, class and tier: Bone Knight (Bone Knight's Stand W-III; Bone Knight's Cleave B-IV), Grave Bat (Grave Bat's Screech R-IV; Grave Bat's Shriek BT-III), Ghoul (Ghoul's Grasp B-III), Wraith (Wraith-step S-III; Wraith's Lament M-III), Deep Tentacle (Deep Tentacle's Drag R-III), Vault Sentinel (Sentinel's Sweep W-IV; Sentinel Pulse A-IV), Brine Hag (Hag's Hex S-III; Hag's Cauldron A-IV). 31 invented techniques (Alpha's Howl, Web Shot, Brood Call, Hamstring, Skull Crack, Net Throw, Evil Eye, Bone Ward, Shroud, Corpse Toss, Brine Lash, Chain of Penance, Bell Toll, Drowned Light, Undertow, Tide Ward, Salt Hex, Grave Guard, Shriek, Wail, Drag Under …) removed (`Technique: —`).
- §4 outlines: Warren Troll gets `Technique: Troll's Regrowth (Mender, Tier IV)`; Capfolk Warder gets a Bloom gimmick and `Technique: Capfolk's Bloom (Beast Tamer, Tier IV)`; §4 intro says all outline light values are placeholders ("arena light per `07`").
- §3.1 Vexa: Arena bullet now defers room/rule/add timing/tells/light to `07` §2.8 ("arena light per `07`"); "Light starts at 60" removed; "Adds respawn once at 75 %" → "re-enter on `07`'s timing"; zone Relic "the Grinning Coin" → **the Grinning Mask** (C Relic, 08's effect).
- §3.2 Barrow Warden: Arena bullet defers to `07`; "Light starts at 50 … −10 per phase" removed; P2 "light −20" → "drops by `07`'s step"; "one A-grade item (F6 rule)" → "(zone-boss rule, rulebook §6.2)"; zone Relic "the Warden's Lantern" → **the Barrow Bell** (D Relic, 08's effect).
- §3.3 Naesa: Arena bullet defers the tide rule/light to `07`; "Light fixed at 40" removed; adds re-enter on 07's timing; "Under 20 % the water rises every 2 rounds" → "rises faster (`07`'s rule)"; zone Relic "Naesa's Conch" → **the Tidebound Idol** (C Relic, 08's effect).
- §3.4 Hollow King: Arena defers to `07`; "Light starts at 75" removed; Snuff and the per-phase step defer to 07; P3 notes the hunters return on 07's arena rule; Relic "the Hollow Crown" → **the Hollow Coin** (C Relic, 08's effect); added "Later kills: stack halves, Divine Shard 10 %"; God line → 1 % / 2 % / 4 % for his three 08 God items (Crown of the Hollow King, Signet of the Hollow Throne, the Last Lantern) — "the Drowned Crown" dropped.
- §4–§6 final bosses: Relics renamed to 08's (Sporemother's Veil → **Sporemother's Breath** A Relic; Tyrant's Hammer → **Forge Sigil** S Relic; the Pale Heart → **Pale Mirror** SS Relic); God items → 08 names (the Spore Heart → Sporemother's Heart; the Pale Dragon's Mantle → Ancient Dragon's Mantle); every God line now 1 % (Hard 2 %, Nightmare 4 %) incl. the Pale Dragon (was 2 %).
- §5–§6 materials: Mithril → Skysteel, Runecloth → Glyphweave in every one-liner and first-kill stack.
- §7: Web "Root + Speed ×0.5" → "Speed −30%"; Fear "skip" → "Guard instead of acting"; Petrify "Def ×2" → "Defense +50 %" (03 §3.5).
- §8.8: technique counts rewritten (Warden 2, Blade 2, Ranger 2, Shade 2, Arcanist 2, Beast Tamer 1, Mender 1 in Dungeon 1; the Fungal Deep teaches the Beast Tamer's and Mender's seconds).
- Open question 6 rewritten (Wraith's Lament / Grave Bat's Shriek; the Dungeon-2 seconds).
- Footer: paths → `content/monsters/<id>.json`, `content/encounters/<id>.json`; decision ids D-041/042/043 → D-024, D-033, D-045, D-046, D-047.

## docs/07-DUNGEONS.md
- §1.2: recommended-level note "F4–6 reads 5–9" → "5–8, F7–9 reads 10–13".
- §2.2: room budget "30 k tris, 60 draw calls" → "≤ 40k tris, ≤ 40 draw calls per room template" (same as 11 §9).
- §2.3 Encounter table column (F1–F10) rewritten to `06`'s named encounters by floor range (Rat Pack · Cellar Dusting · Toll Collectors …; Grave Watch · Belfry …; Tide Procession · Drowned Choir …); F10 antechamber "Vault E" → "From the Deep ×1.2"; "elite: Tidebound Blade" → an Elite-role champion (Vault Sentinel); notes paragraph now cites 06 §8.2's role mix (fixes the 3-Special "Crypts C" and the F4 Ghoul).
- §2.4 curios: "Barrow Ghoul" → "Ghoul"; "an Ooze ambush" → "a Brine Ooze ambush".
- §2.5: Trap Disarm formula → `50% + 2% × (skill − difficulty/2)` (03 §4.3).
- §2.7 treasure rooms: now 08's (guaranteed Small, Large 20%; Small locked 20% / trapped 15%, Large locked 40% / trapped 25%; 2–4 gold piles); zone trap kinds kept.
- §2.8 intro: first-kill drops are 06's verbatim. The four arena paragraphs: phase thresholds now 06's (Vexa 100–50/≤50; Warden 100–50/≤50; Naesa 100–50/≤50; Hollow King 100–60 / 60–25 / ≤25); add compositions now 06's (Vexa 2 Cutpurses + 1 Crossbowman, Netter in P2; Warden 2 Footmen + Toll, 2 Wraiths in P2; Naesa 2 Acolytes + 1 Blade; King: Cellars/Crypts/Vault adds per phase) with 07's own arena rules, tells, light and add timing kept (Lights out, the Warden's Oath and candles, the Tide, the Keep remembers, the returning hunters); first-kill rewards now 06's lists with 08's relic names (Grinning Mask, Barrow Bell, Tidebound Idol, Hollow Coin; Divine Shard, S-grade item, 2 Grand keys for the King); "Sexton's Lantern", "Naesa's Shell", "Hollow Crown (A relic)", "D-grade weapon with the Grinning affix" removed. "two Cantors" removed: Naesa's adds are 06's Acolytes and Blade (D-035's Cantor → Drowner rename has no remaining referent in 07; Drowners stay a Vault elite in 06).
- §2.9: hunter level "+2 levels" → "+3 levels (06: level = floor +3)" ×3.
- §2.10: G14 and the worked example use 06 encounters (Rat Pack, Dog Handlers, Toll Collectors, Alpha's Warren champion); treasure cell uses 08's Small shape and lock/trap odds; roles check line rewritten to 06 §8.2.
- §3–§5 zone tables: families, hunters and zone bosses are now 06's names (capfolk & cave beasts / the Rootwalker / the Shepherd of Caps; trolls & slimes / Gristle / Mawgrum the Warren-King; the spore-touched / the Pale Walker / the Hierarch of Blooms; the Cinderborn / the Smelter / Thane Brakka Ashbrand; forge-golems & constructs / the Unfinished / the Foundry Master; salamanders & fire elementals / the Ember Hart / Ignatha; frost giants & winter wolves / the White Hunter / Jarl Varrek Coldhand; ice wights & the Pale Court / the Pale Executioner / Queen Isrevel; wyrms & drakes / the Roost Mother / Skaldrath), 07's arena rules and mechanics kept; per-floor levels stepped inside 06's bands (12·14·16 / 17·19·21 / 22·23·24·26; 24·26·28 / 29·31·33 / 34·35·36·38; 36·38·40 / 41·43·45 / 46·47·48·50).
- §3–§5 final bosses: phases renamed to 06's (the Garden/Stalk/Heart; the Anvil/Casting/Unbound; the Descent/Grounded/Cold Heart) with 07's room/light; first kills now 06's lists with 08's relic names (Sporemother's Breath, Forge Sigil, Pale Mirror); "Mother's Eye", "Tyrant's Hammer (S maul)", "Winter's Tooth", "2 Divine Shards", "10 Wyvern Hide/Mithril/Drake Scale" removed; Dragon Scale "1–3 every kill" → "1–3 first kill, 1 later".
- §3–§5 economy lines: pet eggs → 06 §9's (Sporeling, Moss Tortoise, Cave Owl; Ember Fox, Forge Beetle, Salamander Hatchling; Frost Kit, Drakeling); Frostmarch R → 5,040 (08's S band); Mithril/Runecloth → Skysteel/Glyphweave; Frostmarch lore: Queen Isrevel holds the court.
- §5: "Hearthstone" item → **Homestone**.
- §6.2 Pacts: "Segment 3" → "Phase 7 (Segment 2)"; open question 7 reworded.
- §7: weekly rotation uses 06's boss names.
- §8.1.6: roles assertion → 06 §8.2.
- Footer: D-035 cited; templates path → `content/dungeons/gravehollow/templates/<id>.json` + `dungeon.json`.

## docs/08-ITEMS.md
- §0: tables become `content/items/<kind>/<id>.json`.
- §1: Censer → a main-hand **Blunt weapon that also counts as a focus** (Base Attack = weaponAttack and focusPower); Holy Symbol = off-hand focus, pairs with it. Naming table: Mithril → Skysteel.
- §3 Relics: count 15 → 24; added the nine 06 zone-boss relics (Shepherd's Crook, Mawgrum's Tusk, Hierarch's Eye — B; Ashbrand Horn, Master's Core, Ignatha's Scale — A; Coldhand Horn, Isrevel's Signet, Skaldrath's Fang — S) with 06's effects; Stormjar's source no longer "Fungal Deep boss"; Forge Sigil's Fortify → +20% Defense.
- §4: Fortify Draught +30% → +20% Defense; Bandage = cleanse Bleed + small heal, never a revive; Divine Shard source = every final boss's first kill (+1 on Nightmare), Hollow King 10% later.
- §7: boss-name note; "working names" removed.
- §8.1: Runecloth → Glyphweave, Mithril → Skysteel.
- §8.2: promotion intro restated from 03 §6.5 (table already matched); open question 1 marked settled (D-031).
- §8.3: Vault levels L9–12 → L10–13; boss stacks → 06's (8+8 / 8+8+10 Bone Shards / 10+10+3 Pearl / 12+12+12; Forge-Tyrant 12 Skysteel + 12 Glyphweave + Shard; Pale Dragon 1–3 scale + 12 Adamantine + 12 Moonweave + Shard); "F40" → "F10 (global floor 40)"; Hollow King row L14.
- §9.1 note: Mithril → Skysteel.
- §10: Standard shape → 56 / 25 / 14 / 4 / 1; every Standard row re-summed to 100 (band B = B 56 · A 25 · S 14 · SS 5 · God 0; band A = A 56 · S 25 · SS 19); Grand table kept; §10.4 copy 56/25/14/5/0.
- §10.3: Lockpicking success defers to 09 §5.
- §11: grade shape 56/25/14/4/1 and rows re-summed; Vault levels 10–13, F10 L14; treasure Large "locked 40%, trapped 25%"; boss guarantee rows = 06's first-kill lists (names, stacks, items, relics, keys, Shard, Luck) with 08's gold and stones.
- §12: kit intro states the Arcanist and Mender kits include the egg and consumables like the others.
- Footer: paths → `content/items/<kind>/<id>.json` etc.; decision ids D-008/D-010/D-030/D-031.

## docs/classes/*.md
- All seven: status path → `content/statuses/<id>.json`; status magnitudes → 03 §3.5 (Bleed 25% of the applying hit per turn for 3; Poison 3% of max HP; Mark +20%; Fortify +20% Defense; Chill ×0.75; Fear = Guard instead of acting; Regen = skill-set X, Tier I ≈ 5%); skill-table paths → `content/skills/<class>/<id>.json`.
- warden.md: kit = 08 §12 (Copper Shortsword, Pine Buckler, Copper Plate set 3/8/5/2/2, Ring of Vigor, 2 Small HP Potions, 2 Torches, Repair Kit, Bandage, egg); derived Attack 38 / HP 116; shield row uses 08 §2.3 numbers (Buckler 15%, Kite 25% −5 Speed Str 11, Tower 35% −10 Speed Str 15); Block "20–35%" → "15–35%"; Mocking Roar Mark +15% → +20%; Dread Bellow Fear per 03; Poison example tick → 3% max HP.
- blade.md: Mail vs Blunt ×1.5 → ×1.25; weapon-handling row → 08 §1 (two-hander 1.0× + Cleave, Greatsword 20 / Str 14); kit = 08 §12 (Copper Longsword + Copper Dagger, Mail set = 15, Ring of Might …); derived Attack 46 / Defense 25; Poison example and damage summary; open question 1 marked settled by 08 §1.
- ranger.md: ammo row (Arrows ×50 = 0.02 R); kit = 08 §12 (Pine Shortbow 13 / Str 9, Arrows ×100, Rawhide set = 10, Ring of the Hawk …); derived Attack 35 / Defense 20 / Accuracy 93%; Hunter's Mark +20% (Mastery +25%), Apex Hunter +30%/+35%; worked example re-run with Mark +20%.
- shade.md: kit = 08 §12 (one Copper Dagger + Copper Throwing Knives, Rawhide set = 10, Ring of Shadows …; Lockpicks dropped); derived Attack 40 / Defense 20 / Dodge 2.2%; pet "Grave Bat" → **Crypt Bat**; Veil open question points at 03's status table.
- arcanist.md: Skybreaker → **Vaultbreaker** (×2); staff rule → 08 §1 (Staff focusPower 14, +10 Mana, basic at normal 1,000; Greatstaff is the 1,400 one; Orb +4/+5); "staff basic is heavy 1,400" con fixed; kit = 08 §12 (Pine Wand, Pine Orb, Burlap set, Ring of the Mind, consumables, egg); level-20 and worked-example numbers re-run (Ash Staff 19 / Mana 98 / spell Attack 55); pet → Crypt Bat; Cartography note no longer "stacks with the Dwarf bonus"; open question 2 wording.
- mender.md: Lifebloom → **Verdant Pulse** (×5); revive rule → "earliest in-combat revive" (First Aid rank 5, Phoenix Feather cited), identity and pros lines likewise; weapons → censer = main-hand Blunt weapon + focus, holy symbol = off-hand focus, staff 1,000 / +10 Mana, Reliquary; kit = 08 §12 (Copper Censer, Copper Holy Symbol, Burlap set, Ring of the Well, consumables, egg); level-20 and worked-example numbers re-run (spell Attack 57); Troll's Regrowth monster "Cave Troll" → **Warren Troll** (06's name); visual-brief weapon rows.
- beast-tamer.md: Myconid's Bloom → **Capfolk's Bloom**, taught by the **Capfolk Warder**; kit = 08 §12 (Rawhide Whip 9 / Str 7, Pine Buckler, Copper Mail set, Talisman of the Drum, consumables, egg; Lantern and Treats dropped from the kit, lantern/horn stay allowed off-hands); level-20 and worked-example numbers re-run (Whip 12, Attack 42, Drag 20); "Grinning Company Bruiser" → "Grinning Bruiser".

## docs/04-CLASSES.md
- §1: monster techniques "one or two" → "exactly two per class; 06 says which monster teaches each"; "only in-combat revive" → "earliest" (§1 and §2 table); Mender weapons cell (censer main hand).
- §5: basic-attack weights (staff 1,000; greatswords, mauls, crossbows, greatstaves 1,400); field-skill bullet lists each class's two +2 skills from the sheets; Revive bullet = 03 §12.1 (First Aid any rank out of combat; rank 5 in combat as a weight-1,000 action; Mender skill; Phoenix Feather; Ultimate).
- §6: skills path → `content/skills/<class>/<id>.json`.

## docs/05-SPECIES.md
- Header and §5: `prototype/blender/…` → `tools/blender/hero/build_body.py` (+ `tools/blender/lib/rig.py`, builds/renders under `art/`, `.glb` per 11 §7); `build_species.py` → `build_body.py`.
- §3.2 Dwarf skin tones: Hearthstone → **Hearth-ember**, Ironbark → **Barkhide**.
- §5 clips: "15 clips + two species-specific" → the 17 shared clips of 11 §3 (adds Attack_Dual, Defeat) + 2 species specials; `Bloodrage_Roar` → `Roar`; export line says 17 + 2.
- §5 face presets: `content/species/faces.json` → inside `content/species/<id>.json`.
- Footer: species path `<id>.json`; decision cite "D-041 … D-048" → "D-018; D-032 proposed".

## docs/09-SKILLS.md
- §1: "a few" techniques → "exactly two per class (06 owns the teacher)".
- §2 table: header notes exactly two; Mender "Cave Troll" → "Warren Troll"; Beast Tamer "Myconid" → "Capfolk Warder".
- §5 "Class +2 at start" column now matches the seven sheets: Lockpicking Shade (+Halfling trait); Trap Disarm Ranger; Foraging Ranger, Beast Tamer; Field Repair Warden, Blade, Beast Tamer (+Dwarf trait); First Aid Warden, Mender; Haggling Shade, Arcanist (+Halfling +1); Cooking Blade, Mender; Cartography Arcanist (Ranger +1) — Dwarf/Cartography link removed; First Aid row restates 03 §12.1 (any rank out of combat, rank 5 in combat at weight 1,000, 30% HP).
- Open question 1: D-041 noted as superseded by 08 §1.

## docs/10-TECH-PLAN.md
- §2: Networking folder `net/` → `client/src/net/` (matches §3's tree).
- §5: "Model (D-010)" → D-014; §8: "(D-016)" → D-019.

## docs/11-ART-PIPELINE.md
- Header: "Decisions D-014–D-019" → "Decision D-019".
- §4: base-mesh list made identical to 06 §3.5 (rat, spider, humanoid, hound, skeleton, zombie, bat, wraith, wisp, tentacle, sentinel, ooze, leech, hollow-king).
- §7: templates path → `content/dungeons/<dungeon>/templates/<id>.json`.
- §9: room template bar "≤ 60k tris, ≤ 25 draw calls" → "≤ 40k tris, ≤ 40 draw calls".

## docs/12-ROADMAP.md
- Phase 2 "Done when": the first balance report runs on a fixture content set (one class, one species, three Cellars monsters, one floor, from `content/examples/` extended as test fixtures); Phase 3 re-runs it on real content.
- Phase 9: `net/` → `client/src/net/`. Milestone P7: "Mithril-promoted" → "Skysteel-promoted".

## docs/13-DECISIONS.md
- D-030 wording now quotes 08 §10's actual numbers (56/25/14/4/1; B 56·25·14·5·0; A 56·25·19; Grand 45/35/15/Shard 5).
- D-031 → Accepted (03 rev. 2 §6.5 states "D-031 accepted"); counts quoted.
- D-041 → **Superseded by `08` §1**, quoting 08's baselines (dual, two-hander 1.0× + Cleave, arrows, per-item Crude requirements).
- Added Proposed D-045 (monster roles and the 12-affix pool), D-046 (base-mesh variants), D-047 (the Grab rule) — the lines 06's footer cited as D-041/042/043; D-042–D-044 left reserved.
- §D consolidated questions updated (D-041 removed from Classes; D-031 from Items; D-045–047 added to Monsters).

## Final re-grep (package minus research/02/content/CLAUDE/README/PROMPT)
Zero hits for Mithril, Runecloth, Myconid/myconid, Jailer, Illusionist, Frenzied, Lifebloom, Ironbark, Skybreaker, and "Segment 3" in 07 §6. Remaining, deliberately:
- "Hearthstone": `03` §8.3 and `13` D-012 cite the real card game as the reference for the pity shape (a design citation like "Diablo 3's", not an in-game name; 03 is off-limits beyond renames and D-012 is an Accepted line).
- "Cantor": `13` D-035, the Accepted line that records the Cantor → Drowner rename itself.
- "prototype/blender": `11` §0 refers to the sister project ProjectAscend's `prototype/blender/shade/` folder, not a path in this repo.

## Residuals I could not fix (03 is off-limits except renames) — for the lead
- `03` §7.1 still says `content/skills/<class>.json` (should be `content/skills/<class>/<id>.json`).
- `03` §6.3 lists "Censers/Holy symbols (Mender foci)"; 08 now makes the Censer a main-hand weapon-and-focus (compatible but worth a word).
- `03` §4.1 "8–14 rooms" vs 07's F1 5–7 / F10 4 exceptions; `03` §8.4 "one Merchant room per floor" vs 07's F2/F5/F8 rule (07 §8.1 states both as its own guarantees).
- `content/README.md` and the examples (review §5.1, §5.10) were left to the content owner.
