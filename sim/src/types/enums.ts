/**
 * Every closed set of the content schemas as a readonly tuple plus its literal union, in the order the schema lists
 * it (ladder order carries meaning for grades, light bands, roles and difficulties). The source of truth is
 * content/schemas/common.schema.json and the few enums other schemas keep to themselves; change a schema and this
 * file together (content/README.md "Representation choices").
 */

// ---------------------------------------------------------------------------------------------------------------
// common.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** The eight attributes (03 §2.1). Luck is never trained. */
export const ATTRIBUTES = ['strength', 'agility', 'vitality', 'endurance', 'wisdom', 'perception', 'willpower', 'luck'] as const
export type Attribute = (typeof ATTRIBUTES)[number]

/** The seven attributes that grow by use (03 §5.2). */
export const TRAINABLE_ATTRIBUTES = ['strength', 'agility', 'vitality', 'endurance', 'wisdom', 'perception', 'willpower'] as const
export type TrainableAttribute = (typeof TRAINABLE_ATTRIBUTES)[number]

/** The derived stats the card shows (03 §2.2). */
export const DERIVED_STATS = [
  'hp',
  'attackPhys',
  'attackSpell',
  'defense',
  'speed',
  'stamina',
  'mana',
  'momentumGain',
  'critRate',
  'critDamage',
  'accuracy',
  'dodge',
  'resistance',
  'detection',
  'variance',
  'fortune',
  'carry',
  'block',
] as const
export type DerivedStat = (typeof DERIVED_STATS)[number]

/** The six elements (03 §3.4). */
export const ELEMENTS = ['fire', 'frost', 'lightning', 'poison', 'holy', 'shadow'] as const
export type Element = (typeof ELEMENTS)[number]

/** The three physical damage types (03 §3.4). */
export const PHYS_TYPES = ['slash', 'pierce', 'blunt'] as const
export type PhysType = (typeof PHYS_TYPES)[number]

/** Any damage type: an element or a physical type. */
export const DAMAGE_TYPES = [...ELEMENTS, ...PHYS_TYPES] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]

/** The standard status set (03 §3.5 rev. 2, 27 rows); content/statuses/ holds one file per value. */
export const STATUSES = [
  'bleed',
  'poison',
  'burn',
  'chill',
  'freeze',
  'shock',
  'stun',
  'daze',
  'blind',
  'silence',
  'taunt',
  'shield',
  'regen',
  'haste',
  'slow',
  'weaken',
  'fortify',
  'mark',
  'fear',
  'grab',
  'root',
  'web',
  'curse',
  'petrify',
  'smite',
  'wither',
  'veil',
] as const
export type Status = (typeof STATUSES)[number]

/** The nine grades F → God (03 §6.2), in ladder order; the index is the material rung. */
export const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'God'] as const
export type Grade = (typeof GRADES)[number]

/** The three launch presets (03 §11.2), in order. */
export const DIFFICULTIES = ['normal', 'hard', 'dread'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** Timeline weight subtracted from the accumulator after an action (03 §3.1). */
export const WEIGHTS = [400, 600, 800, 1000, 1400] as const
export type Weight = (typeof WEIGHTS)[number]

/** A combat row (03 §3.3); 'either' is for targets, not placement. */
export const ROWS = ['front', 'back', 'either'] as const
export type Row = (typeof ROWS)[number]

/** Who an action or effect lands on (common.schema.json `target`). */
export const TARGETS = [
  'self',
  'ally',
  'allyLowest',
  'allAllies',
  'allyRow',
  'partyFront',
  'partyBack',
  'enemy',
  'enemyFront',
  'enemyBack',
  'enemyRandom',
  'allEnemies',
  'enemyRow',
  'enemyRowBack',
  'pet',
  'summon',
  'downedAlly',
  'allDowned',
  'fallenAlly',
  'room',
] as const
export type Target = (typeof TARGETS)[number]

/** The four armor families (03 §6.1). */
export const ARMOR_FAMILIES = ['plate', 'mail', 'leather', 'robes'] as const
export type ArmorFamily = (typeof ARMOR_FAMILIES)[number]

/** The four material ladders (03 §6.5). */
export const MATERIAL_LADDERS = ['metal', 'hide', 'cloth', 'wood'] as const
export type MaterialLadder = (typeof MATERIAL_LADDERS)[number]

/** The eleven gear slots plus the pet (03 §6.1). */
export const SLOTS = ['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'talisman', 'relic', 'pet'] as const
export type Slot = (typeof SLOTS)[number]

/** Weapon and off-hand types (03 §6.3, 08 §1). */
export const WEAPON_TYPES = [
  'sword',
  'greatsword',
  'axe',
  'greataxe',
  'mace',
  'maul',
  'spear',
  'shortSpear',
  'dagger',
  'bow',
  'longbow',
  'shortbow',
  'crossbow',
  'staff',
  'wand',
  'censer',
  'whip',
  'throwingKnife',
  'shieldBuckler',
  'shieldKite',
  'shieldTower',
  'focus',
  'lantern',
  'horn',
] as const
export type WeaponType = (typeof WEAPON_TYPES)[number]

/** Monster taxonomy roles (03 §11.1, §11.3, §4.5). */
export const ROLES = ['fodder', 'elite', 'special', 'monster', 'boss', 'hunter'] as const
export type Role = (typeof ROLES)[number]

/** Monster body size (06 §7). */
export const SIZES = ['small', 'medium', 'large', 'huge'] as const
export type Size = (typeof SIZES)[number]

/** Pet stances (03 §9). */
export const STANCES = ['fierce', 'guard', 'mend', 'forage'] as const
export type Stance = (typeof STANCES)[number]

/** The eight universal field skills (03 §7.6). */
export const FIELD_SKILLS = ['lockpicking', 'trapDisarm', 'foraging', 'fieldRepair', 'firstAid', 'haggling', 'cooking', 'cartography'] as const
export type FieldSkill = (typeof FIELD_SKILLS)[number]

/** Light bands (03 §4.2), brightest first: radiant 76–100, dim 51–75, shadowy 26–50, dark 1–25, pitch 0. */
export const LIGHT_BANDS = ['radiant', 'dim', 'shadowy', 'dark', 'pitch'] as const
export type LightBand = (typeof LIGHT_BANDS)[number]

/** Room kinds (03 §4.6, §11.1). */
export const ROOM_KINDS = [
  'entry',
  'fight',
  'elite',
  'rest',
  'merchant',
  'treasure',
  'curio',
  'trapGauntlet',
  'secret',
  'stairs',
  'boss',
  'keyRoom',
  'lockedDoor',
] as const
export type RoomKind = (typeof ROOM_KINDS)[number]

/** Room kinds the generator rolls by weight; the rest are placed by the grammar (dungeon.schema.json roomWeights). */
export const ROLLED_ROOM_KINDS = ['fight', 'elite', 'rest', 'merchant', 'treasure', 'curio', 'trapGauntlet'] as const
export type RolledRoomKind = (typeof ROLLED_ROOM_KINDS)[number]

/** What a curio choice, a trap reveal, a door or a kit demands (07 §2.4–§2.5). */
export const REQUIREMENT_KINDS = ['item', 'fieldSkillRank', 'attribute', 'detection', 'gold', 'light', 'classId', 'speciesId'] as const
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number]

/** What a reward line gives (08 §11). */
export const REWARD_KINDS = ['item', 'material', 'tome', 'shard', 'gold', 'luck', 'title', 'waystone'] as const
export type RewardKind = (typeof REWARD_KINDS)[number]

/** What an effect line does (content/README.md "The effect DSL"). */
export const EFFECT_KINDS = [
  'damage',
  'heal',
  'shield',
  'applyStatus',
  'removeStatus',
  'buffStat',
  'debuffStat',
  'momentum',
  'pool',
  'timeline',
  'rowSwap',
  'summon',
  'revive',
  'light',
  'loot',
  'taunt',
  'dispel',
  'custom',
] as const
export type EffectKind = (typeof EFFECT_KINDS)[number]

// ---------------------------------------------------------------------------------------------------------------
// Closed sets other schemas keep to themselves
// ---------------------------------------------------------------------------------------------------------------

/** class.schema.json `pool`: the class family's resource (03 §3.2). */
export const POOLS = ['stamina', 'mana'] as const
export type Pool = (typeof POOLS)[number]

/** species.schema.json restriction `kind`. */
export const SPECIES_RESTRICTION_KINDS = ['weaponType', 'slot', 'shieldType'] as const
export type SpeciesRestrictionKind = (typeof SPECIES_RESTRICTION_KINDS)[number]

/** species.schema.json restriction `shieldType`; 'all' locks every shield. */
export const SHIELD_TYPES = ['buckler', 'kite', 'tower', 'all'] as const
export type ShieldType = (typeof SHIELD_TYPES)[number]

/** skill.schema.json `type`. */
export const SKILL_TYPES = ['active', 'passive'] as const
export type SkillType = (typeof SKILL_TYPES)[number]

/** skill.schema.json `tags`: what a skill is for; the Skill Hall and the AI read these. */
export const SKILL_TAGS = [
  'aoe',
  'singleTarget',
  'control',
  'mobility',
  'momentum',
  'light',
  'scouting',
  'heal',
  'cleanse',
  'buff',
  'debuff',
  'dot',
  'shield',
  'taunt',
  'reach',
  'summon',
  'revive',
  'utility',
  'field',
] as const
export type SkillTag = (typeof SKILL_TAGS)[number]

/** skill.schema.json `aiHints.role`. */
export const AI_ROLES = ['attack', 'heal', 'buff', 'debuff', 'control', 'defend', 'utility'] as const
export type AiRole = (typeof AI_ROLES)[number]

/** The `classId` literals of skills that belong to no class (content/README.md: field skills, pet actives, monster-only). */
export const SKILL_OWNER_LITERALS = ['field', 'pet', 'monster'] as const
export type SkillOwnerLiteral = (typeof SKILL_OWNER_LITERALS)[number]

/** item.schema.json `kind`; also the folder under content/items/. */
export const ITEM_KINDS = [
  'weapon',
  'armor',
  'shield',
  'focus',
  'ring',
  'talisman',
  'relic',
  'consumable',
  'material',
  'stone',
  'tome',
  'key',
  'ammo',
  'egg',
  'treat',
] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

/** item.schema.json `hands` for weapons and foci. */
export const HANDS = [1, 2] as const
export type Hands = (typeof HANDS)[number]

/** The slots a weapon may equip to (item.schema.json weapon rule). */
export const WEAPON_SLOTS = ['mainHand', 'offHand'] as const
export type WeaponSlot = (typeof WEAPON_SLOTS)[number]

/** The five armor slots (item.schema.json armor rule; item-set pieces). */
export const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots', 'gloves'] as const
export type ArmorSlot = (typeof ARMOR_SLOTS)[number]

/** affix.schema.json `position`. */
export const AFFIX_POSITIONS = ['prefix', 'suffix'] as const
export type AffixPosition = (typeof AFFIX_POSITIONS)[number]

/** affix.schema.json line `unit`. */
export const AFFIX_UNITS = ['flat', 'percent'] as const
export type AffixUnit = (typeof AFFIX_UNITS)[number]

/** item-set.schema.json `family`: an armor family or a ring pair. */
export const SET_FAMILIES = ['plate', 'mail', 'leather', 'robes', 'ringPair'] as const
export type SetFamily = (typeof SET_FAMILIES)[number]

/** The rows a monster may be placed in (monster.schema.json `rows`, boss adds, encounter composition). */
export const PLACEMENT_ROWS = ['front', 'back'] as const
export type PlacementRow = (typeof PLACEMENT_ROWS)[number]

/** monster.schema.json `xpClass` (03 §5.1): 1 fodder, 2 special, 3 elite, 6 hunter/monster, 25 boss. */
export const XP_CLASSES = [1, 2, 3, 6, 25] as const
export type XpClass = (typeof XP_CLASSES)[number]

/** elite-affix.schema.json `affixClass` (06 §2). */
export const ELITE_AFFIX_CLASSES = ['offensive', 'defensive', 'control'] as const
export type EliteAffixClass = (typeof ELITE_AFFIX_CLASSES)[number]

/** dungeon.schema.json trap `trigger`. */
export const TRAP_TRIGGERS = ['enter', 'step', 'open', 'loot', 'time'] as const
export type TrapTrigger = (typeof TRAP_TRIGGERS)[number]

/** dungeon.schema.json template door `side`. */
export const DOOR_SIDES = ['north', 'east', 'south', 'west'] as const
export type DoorSide = (typeof DOOR_SIDES)[number]

/** pet.schema.json petInstance.ranchImport `mappedGrade`: never above A at import. */
export const RANCH_IMPORT_GRADES = ['F', 'E', 'D', 'C', 'B', 'A'] as const
export type RanchImportGrade = (typeof RANCH_IMPORT_GRADES)[number]

/** chest.schema.json `kind`. */
export const CHEST_KINDS = ['gear', 'petEgg', 'materialCrate', 'skillTome', 'wayfarer'] as const
export type ChestKind = (typeof CHEST_KINDS)[number]

/** chest.schema.json `tier`. */
export const CHEST_TIERS = ['standard', 'grand'] as const
export type ChestTier = (typeof CHEST_TIERS)[number]

/** chest.schema.json `subtypes`. */
export const CHEST_SUBTYPES = ['weapon', 'armor', 'trinket'] as const
export type ChestSubtype = (typeof CHEST_SUBTYPES)[number]

/** chest.schema.json `dupeRule`. */
export const DUPE_RULES = ['salvage', 'bond', 'rankXp', 'none'] as const
export type DupeRule = (typeof DUPE_RULES)[number]

/** contract.schema.json `cadence`. */
export const CONTRACT_CADENCES = ['daily', 'weekly'] as const
export type ContractCadence = (typeof CONTRACT_CADENCES)[number]

/** contract.schema.json `kind`. */
export const CONTRACT_KINDS = ['kill', 'clear', 'light', 'noWipe', 'collect'] as const
export type ContractKind = (typeof CONTRACT_KINDS)[number]

/** contract.schema.json reward key `kind` (also the chest tiers). */
export const KEY_KINDS = ['standard', 'grand'] as const
export type KeyKind = (typeof KEY_KINDS)[number]

/** status.schema.json `kind`. */
export const STATUS_KINDS = ['dot', 'hot', 'control', 'buff', 'debuff', 'mark', 'state'] as const
export type StatusKind = (typeof STATUS_KINDS)[number]

/** status.schema.json `tickAt`. */
export const TICK_ATS = ['turnStart', 'turnEnd'] as const
export type TickAt = (typeof TICK_ATS)[number]

/** status.schema.json `magnitudeOf`. */
export const MAGNITUDE_OFS = ['hitDamage', 'maxHp', 'attack', 'fixed'] as const
export type MagnitudeOf = (typeof MAGNITUDE_OFS)[number]

/** status.schema.json `stacking`. */
export const STACKINGS = ['refresh', 'stack', 'max'] as const
export type Stacking = (typeof STACKINGS)[number]

// ---------------------------------------------------------------------------------------------------------------
// Helpers where order is meaning
// ---------------------------------------------------------------------------------------------------------------

/** True when `value` is a member of the closed set `set`. */
export function isMember<const T extends readonly (string | number)[]>(set: T, value: unknown): value is T[number] {
  return (set as readonly unknown[]).includes(value)
}

/** The grade's position on the ladder: F 0 … God 8 (the item's `materialRung`). */
export function gradeIndex(grade: Grade): number {
  return GRADES.indexOf(grade)
}

/** The grade at a ladder position; undefined outside 0–8. */
export function gradeAt(index: number): Grade | undefined {
  return GRADES[index]
}

/** The grade `steps` rungs above (positive) or below (negative) `grade`, clamped to the ladder. */
export function gradeShift(grade: Grade, steps: number): Grade {
  const i = Math.min(GRADES.length - 1, Math.max(0, gradeIndex(grade) + steps))
  return GRADES[i] ?? grade
}

/** The light band's position, brightest first: radiant 0 … pitch 4. The 0–100 thresholds live in tuning.json, not here. */
export function lightBandIndex(band: LightBand): number {
  return LIGHT_BANDS.indexOf(band)
}

/** The save's death rule (D-088): Mortal, the dead stay dead; Sheltered, the Phase 3 revive rules and nobody is lost. */
/** D-088, D-095: Sheltered (nobody is lost), Mortal (the dead stay dead), Nightmare (Mortal, and the chosen hero's death ends the save). */
export const DEATH_RULES = ['mortal', 'sheltered', 'nightmare'] as const
export type DeathRule = (typeof DEATH_RULES)[number]

/** wayfarer.schema.json `grade` (D-091): the Segment 1 cast is graded D to A. */
export const WAYFARER_GRADES = ['D', 'C', 'B', 'A'] as const
export type WayfarerGrade = (typeof WAYFARER_GRADES)[number]

/** An encounter's threat against the party's level (D-092). */
export const THREAT_BANDS = ['easy', 'even', 'dangerous', 'deadly'] as const
export type ThreatBand = (typeof THREAT_BANDS)[number]
