/**
 * The content records as TypeScript, mirroring content/schemas/*.schema.json field for field: the same names, the
 * same optionality (`?` when a property is not in the schema's `required`) and the same nullability (`X | null` for
 * `anyOf: [X, null]`). Everything is readonly: content is immutable once loaded (the linter validated it; the sim
 * trusts it and never writes to it). Conditional per-kind requirements (an effect's `damage` needing `multiplier`,
 * an item's `weapon` needing `weaponType` …) are the linter's job and stay as optional/nullable fields here.
 *
 * Tuning is not here: sim/src/tuning.ts derives `Tuning` from content/tuning.json itself.
 */
import type {
  AffixPosition,
  AffixUnit,
  AiRole,
  ArmorFamily,
  Attribute,
  ChestKind,
  ChestSubtype,
  ChestTier,
  ContractCadence,
  ContractKind,
  DamageType,
  DerivedStat,
  Difficulty,
  DoorSide,
  DupeRule,
  EffectKind,
  Element,
  EliteAffixClass,
  FieldSkill,
  Grade,
  Hands,
  ItemKind,
  KeyKind,
  LightBand,
  MagnitudeOf,
  MaterialLadder,
  PlacementRow,
  Pool,
  RanchImportGrade,
  RequirementKind,
  RewardKind,
  Role,
  RoomKind,
  SetFamily,
  ShieldType,
  Size,
  SkillTag,
  SkillType,
  Slot,
  SpeciesRestrictionKind,
  Stacking,
  Stance,
  Status,
  StatusKind,
  Target,
  TickAt,
  TrainableAttribute,
  TrapTrigger,
  WeaponType,
  Weight,
  WayfarerGrade,
  XpClass,
} from './enums.ts'

// ---------------------------------------------------------------------------------------------------------------
// Shared shapes (common.schema.json $defs)
// ---------------------------------------------------------------------------------------------------------------

/** A content id: kebab-case, unique within its kind. */
export type ContentId = string

/** An sRGB colour as #rrggbb. */
export type HexColor = string

/** An inclusive integer range. */
export interface IntRange {
  readonly min: number
  readonly max: number
}

/** An inclusive range of grades in ladder order. */
export interface GradeRange {
  readonly min: Grade
  readonly max: Grade
}

/** An [x, y, z] position in metres, scene units. */
export type Vec3 = readonly [number, number, number]

/** attribute → signed integer modifier; attributes left out are 0. */
export type AttributeMods = Readonly<Partial<Record<Attribute, number>>>

/** derived stat → integer value. */
export type DerivedStatMap = Readonly<Partial<Record<DerivedStat, number>>>

/** derived stat → decimal multiplier (pet baseStats). */
export type DerivedStatMultipliers = Readonly<Partial<Record<DerivedStat, number>>>

/** grade → percent (a chest odds table). */
export type GradeTable = Readonly<Partial<Record<Grade, number>>>

/**
 * One line of the effect DSL (content/README.md "The effect DSL"). Only `kind` is always present; which other fields
 * a kind carries is the per-kind rule the linter enforces (damage: multiplier + damageType; applyStatus: status; …).
 */
export interface Effect {
  readonly kind: EffectKind
  /** Scale of the actor's Attack for damage, heal and shield (1.0 = a basic hit). */
  readonly multiplier?: number
  readonly damageType?: DamageType
  readonly status?: Status
  /** Chance the line applies, 0–100; omitted means 100. */
  readonly chance?: number
  /** Turns the line lasts on the holder; omitted means the status default. */
  readonly duration?: number
  /** The derived stat a buffStat/debuffStat line moves. */
  readonly stat?: DerivedStat
  /** A flat integer amount: stat points, momentum, pool points, light, gold. */
  readonly amount?: number
  /** A signed percentage: of a stat for buff/debuff, of max for pool and heal, of odds for loot. */
  readonly percent?: number
  /** Timeline energy added to the target's accumulator: negative pushes back, positive pulls forward. */
  readonly energy?: number
  /** Monster id to summon onto the acting side. */
  readonly summonId?: ContentId
  /** Name of a hand-written sim hook for a custom line (sim/src/skills/custom/<customId>.ts). */
  readonly customId?: ContentId
  /** For a custom line that grants or consumes an item or material: its id. */
  readonly itemId?: ContentId
  /** Overrides the owning skill's or attack's target for this line only. */
  readonly target?: Target
  /** Attribute whose points above 10 add to this line. */
  readonly scalesWith?: Attribute
  /** Designer's note; ignored by the sim. */
  readonly note?: string
}

/**
 * One gate on a curio choice, a trap reveal, a door or a kit; a list is an AND. `id` names the thing by kind: a
 * content id (item, classId, speciesId), a field skill name (fieldSkillRank) or an attribute name (attribute).
 */
export interface Requirement {
  readonly kind: RequirementKind
  readonly id?: ContentId | FieldSkill | Attribute
  /** Threshold: a rank 1–10, an attribute value, a Detection or a light level. */
  readonly min?: number
  /** Units consumed for an item (default 1), or the gold stake in units of R for gold. */
  readonly amount?: number
  /** For an item: whether taking the choice uses it up. */
  readonly consumed?: boolean
  readonly note?: string
}

/** One reward line, rolled on its own chance (08 §11). */
export interface Reward {
  readonly kind: RewardKind
  /** The item, material or skill (tome) id, the title id, or the zone id (waystone). */
  readonly id?: ContentId
  /** Units (materials), gold, shards, Luck points or items; omitted means 1. */
  readonly amount?: number
  /** Chance the line drops, 0–100; omitted means 100. */
  readonly chance?: number
  /** For an item line without an id: the grade rolled. */
  readonly grade?: Grade
  /** For a tome line without an id: the tier drawn. */
  readonly tier?: number
  /** The lowest preset the line applies on; omitted means every difficulty. */
  readonly difficultyMin?: Difficulty
  readonly note?: string
}

// ---------------------------------------------------------------------------------------------------------------
// class.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface ClassSchool {
  readonly id: ContentId
  readonly name: string
  readonly philosophy: string
}

export interface FieldSkillAffinity {
  readonly fieldSkill: FieldSkill
  readonly rankBonus: number
}

export interface ClassVisual {
  readonly gearSetId: ContentId
  readonly palette: readonly HexColor[]
  readonly notes?: string
}

/** A hero class (03 §2.3, §6.1, §7.1): content/classes/<id>.json. */
export interface ClassDef {
  readonly id: ContentId
  readonly name: string
  /** One free line on what the class does in a party (not an enum, README "Representation choices"). */
  readonly role: string
  readonly description: string
  /** Added to 10 + species mods at creation; sums to +4. */
  readonly attributeMods: AttributeMods
  readonly pool: Pool
  readonly armorFamily: ArmorFamily
  readonly weaponTypes: readonly WeaponType[]
  /** Exactly three. */
  readonly schools: readonly ClassSchool[]
  readonly ultimateSkillId: ContentId
  readonly starterKit: readonly ContentId[]
  /** Exactly three Tier I skills. */
  readonly starterSkillIds: readonly ContentId[]
  readonly fieldSkillAffinities: readonly FieldSkillAffinity[]
  readonly monsterTechniqueIds: readonly ContentId[]
  readonly aiRuleDefault: string
  readonly visual: ClassVisual
  readonly pros: readonly string[]
  readonly cons: readonly string[]
}

// ---------------------------------------------------------------------------------------------------------------
// species.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface HpThresholdMultiplier {
  readonly hpPercent: number
  readonly multiplier: number
}

/** Typed knobs the sim reads directly (05 "Exact rule" and "Cons" lines); a trait carries only the knobs it moves. */
export interface SpeciesRule {
  readonly speedBase?: number
  readonly hpMultiplier?: number
  readonly manaMultiplier?: number
  readonly xpMultiplier?: number
  readonly xpMultiplierByAttribute?: Readonly<Partial<Record<TrainableAttribute, number>>>
  readonly carryMultiplier?: number
  readonly dodgeBonus?: number
  readonly dodgeCap?: number
  readonly fortuneBonus?: number
  readonly detectionBonus?: number
  readonly detectionByLightBand?: Readonly<Partial<Record<LightBand, number>>>
  readonly scoutingBonus?: number
  readonly lightBandShift?: number
  readonly darkAccuracyImmune?: boolean
  readonly armorPenaltyMultiplier?: Readonly<Partial<Record<ArmorFamily, number>>>
  readonly heavyWeaponStrengthExtra?: number
  readonly shopPriceMultiplier?: number
  readonly promotionCostMultiplier?: number
  readonly ambushModifier?: number
  readonly immunities?: readonly Status[]
  readonly forcedRowMoveImmune?: boolean
  readonly resist?: Readonly<Partial<Record<DamageType, number>>>
  readonly weak?: Readonly<Partial<Record<DamageType, number>>>
  readonly statusResist?: Readonly<Partial<Record<Status, number>>>
  readonly statusDurationDelta?: Readonly<Partial<Record<Status, number>>>
  readonly appliedDurationMultiplier?: Readonly<Partial<Record<Status, number>>>
  readonly enemyAccuracyBySize?: Readonly<Partial<Record<Size, number>>>
  readonly damageMultiplierBelowHpPercent?: HpThresholdMultiplier
  readonly fieldSkillBonus?: Readonly<Partial<Record<FieldSkill, number>>>
  readonly fieldSkillStartRank?: number
  readonly trapDisarmRerollsPerFloor?: number
  readonly loadoutPresets?: number
  readonly innateSkillId?: ContentId
  readonly naturalArmorBase?: number
  readonly fodderFlinchChance?: number
}

/** An innate rule: effect lines, a typed rule object, or both. */
export interface SpeciesTrait {
  readonly id: ContentId
  readonly name: string
  readonly description: string
  readonly effects?: readonly Effect[]
  readonly rule?: SpeciesRule
}

/** Gear the species cannot use regardless of class; exactly one of the three fields by `kind`. */
export interface SpeciesRestriction {
  readonly kind: SpeciesRestrictionKind
  readonly weaponType?: WeaponType
  readonly slot?: Slot
  readonly shieldType?: ShieldType
  readonly reason?: string
}

export interface SpeciesSenses {
  readonly darkvision: boolean
}

export interface SpeciesBody {
  readonly heightM: number
  readonly shapeKeys: readonly string[]
  readonly boneScales: Readonly<Record<string, number>>
  readonly parts: readonly string[]
  readonly skinTones: readonly HexColor[]
  readonly facePresets: number
  readonly gearVariants: readonly Slot[]
}

export interface SpeciesChips {
  readonly pros: readonly string[]
  readonly cons: readonly string[]
}

/** A playable species (03 §2.3; 05): content/species/<id>.json. */
export interface SpeciesDef {
  readonly id: ContentId
  readonly name: string
  /** Added to 10 at creation; nets +2. */
  readonly attributeMods: AttributeMods
  readonly traits: readonly SpeciesTrait[]
  readonly restrictions: readonly SpeciesRestriction[]
  readonly senses: SpeciesSenses
  readonly body: SpeciesBody
  readonly creationBlurb: string
  readonly chips: SpeciesChips
}

// ---------------------------------------------------------------------------------------------------------------
// skill.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** Equipment the skill needs in hand; absent when none. */
export interface SkillRequirements {
  readonly shield?: boolean
  readonly weaponTypes?: readonly WeaponType[]
  readonly dualWield?: boolean
  readonly twoHanded?: boolean
}

/** Per-rank change as signed percentages of the rank-1 value (03 §5.2: +4 / −2). */
export interface RankScaling {
  readonly effectPerRank: number
  readonly costPerRank: number
}

/** The rank-10 Mastery line. */
export interface Mastery {
  readonly text: string
  readonly effects: readonly Effect[]
}

export interface AiHints {
  readonly role: AiRole
  readonly priority: number
}

/** One skill (03 §7, §5.2): content/skills/<classId>/<id>.json. */
export interface SkillDef {
  readonly id: ContentId
  /** A class id, or one of the literals 'field' / 'pet' / 'monster'. */
  readonly classId: ContentId
  /** A school id from the class's schools[]; the same literal as classId for field/pet/monster skills. */
  readonly school: ContentId
  readonly tier: number
  readonly name: string
  readonly description: string
  readonly type: SkillType
  readonly cost: number
  /** Required for actives; null for passives. */
  readonly weight: Weight | null
  readonly target: Target
  readonly effects: readonly Effect[]
  readonly prerequisiteId: ContentId | null
  readonly isUltimate: boolean
  readonly monsterTechniqueOf: ContentId | null
  readonly requirements?: SkillRequirements
  readonly rankScaling: RankScaling
  readonly mastery: Mastery
  readonly tags: readonly SkillTag[]
  readonly xpTags: readonly TrainableAttribute[]
  readonly aiHints: AiHints
}

// ---------------------------------------------------------------------------------------------------------------
// item.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** One rolled affix line on an item. */
export interface RolledAffix {
  readonly affixId: ContentId
  readonly value: number
  readonly locked: boolean
}

/** An affinity line gained at item levels 3/6/9. */
export interface ItemAffinity {
  readonly familyId: ContentId
  readonly percent: number
}

export interface ItemRequirements {
  readonly strength: number
  readonly wisdom: number
}

/** The signature line of a named unique or the unique power of a God item. */
export interface UniquePower {
  readonly text: string
  readonly effects: readonly Effect[]
}

/** A relic's once-per-fight active. */
export interface RelicActive {
  readonly effects: readonly Effect[]
  readonly usesPerFight: number
  readonly target: Target
}

/** What a consumable does when used. */
export interface ConsumableUse {
  readonly effects: readonly Effect[]
  readonly stackMax: number
  readonly target: Target
  readonly inCombat: boolean
}

export interface ItemAmmo {
  readonly stack: number
}

export interface ItemVisual {
  readonly meshId: string
  readonly tintPrimary: HexColor
  readonly tintSecondary: HexColor
  readonly trimMetal: string
}

/** An item as content (03 §6; 08): content/items/<kind>/<id>.json. Instance-shaped fields hold starting values. */
export interface ItemDef {
  readonly id: ContentId
  readonly name: string
  readonly slot: Slot | null
  readonly kind: ItemKind
  readonly grade: Grade
  readonly materialLadder: MaterialLadder | null
  /** 0 = F … 8 = God; null with materialLadder null. */
  readonly materialRung: number | null
  readonly weaponType: WeaponType | null
  readonly armorFamily: ArmorFamily | null
  readonly hands: Hands | null
  readonly damageType: DamageType | null
  readonly weight: Weight | null
  readonly baseStats: DerivedStatMap
  readonly requirements: ItemRequirements
  readonly affixSlots: number
  readonly affixes: readonly RolledAffix[]
  readonly plusN: number
  readonly maxPlusN: number
  readonly itemLevel: number
  readonly itemXp: number
  readonly affinities: readonly ItemAffinity[]
  readonly durability: number
  readonly maxDurability: number
  readonly wearK: number
  readonly value: number
  /** Class ids that may equip it; empty means universal. */
  readonly classLock: readonly ContentId[]
  readonly setId: ContentId | null
  readonly unique: boolean
  readonly uniquePower: UniquePower | null
  readonly active: RelicActive | null
  readonly consumable: ConsumableUse | null
  readonly ammo: ItemAmmo | null
  readonly visual: ItemVisual
}

/** An item as it sits in a hero's equipment or bag (item.schema.json#/$defs/itemInstance). */
export interface ItemInstance {
  /** Unique within the save. */
  readonly instanceId: string
  readonly itemId: ContentId
  /** Stack size; 1 for gear. */
  readonly quantity: number
  readonly affixes: readonly RolledAffix[]
  readonly plusN: number
  readonly itemLevel: number
  readonly itemXp: number
  readonly affinities: readonly ItemAffinity[]
  readonly durability: number
  readonly maxDurability: number
}

// ---------------------------------------------------------------------------------------------------------------
// affix.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** One grade band of an affix: a stat roll (`stat` + `unit`) or an effect whose magnitude rolls min–max. */
export interface AffixLine {
  readonly bandMin: Grade
  readonly bandMax: Grade
  readonly stat?: DerivedStat | Attribute
  readonly unit?: AffixUnit
  readonly effect?: Effect
  readonly min: number
  readonly max: number
}

/** An item affix from the pool (03 §6.2): content/affixes/<id>.json. */
export interface AffixDef {
  readonly id: ContentId
  readonly name: string
  readonly position: AffixPosition
  /** One entry per grade band, non-overlapping, in ladder order. */
  readonly lines: readonly AffixLine[]
  readonly slots: readonly Slot[]
  /** Roll weight in the pool, 1 rare – 5 common. */
  readonly weight: number
  readonly tags: readonly string[]
}

// ---------------------------------------------------------------------------------------------------------------
// item-set.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** Effect lines by pieces worn; a ring pair has only '2'. */
export interface SetBonuses {
  readonly '2': readonly Effect[]
  readonly '4'?: readonly Effect[]
}

export interface SetBonusText {
  readonly '2': string
  readonly '4'?: string
}

/** A gear set (03 §6.2; 08 §6): content/sets/<id>.json. */
export interface ItemSetDef {
  readonly id: ContentId
  readonly name: string
  readonly family: SetFamily
  readonly theme: string
  /** Classes the set is written for; empty means any class. */
  readonly classIds: readonly ContentId[]
  /** Five armor pieces or two rings. */
  readonly pieces: readonly ContentId[]
  readonly bonuses: SetBonuses
  readonly bonusText: SetBonusText
  readonly gradeMin: Grade
  readonly gradeMax: Grade | null
  readonly dropChance: number
}

// ---------------------------------------------------------------------------------------------------------------
// monster.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface MonsterMultipliers {
  readonly hp: number
  readonly attack: number
  readonly defense: number
}

export interface MonsterAttack {
  /** Unique within the monster; behavior lines and boss phases refer to it. */
  readonly id: ContentId
  readonly name: string
  readonly damageType: DamageType
  readonly weight: Weight
  /** Scale of the monster's Attack; 0 for a move that does not hit. */
  readonly multiplier: number
  readonly target: Target
  readonly effects: readonly Effect[]
  /** Relative pick weight when no behavior rule chooses. */
  readonly aiWeight: number
  readonly tell: string | null
}

/** A part roll: exactly one of `materialId` (a material unit) or `itemId` (a rare part). */
export interface MonsterDrop {
  readonly materialId?: ContentId
  readonly itemId?: ContentId
  readonly chance: number
  readonly quantity: IntRange
}

/** One gambit line (03 §3.6): `if` a condition, `then` an attack id, 'flee', 'guard' or 'swap row'. */
export interface MonsterBehaviorRule {
  readonly if: string
  readonly then: string
}

export interface MonsterBehavior {
  readonly rules: readonly MonsterBehaviorRule[]
  /** HP% at which it tries to leave the fight; 0 never flees. */
  readonly fleesAtPercent: number
}

export interface BreakLimb {
  readonly name: string
  readonly effect: Effect
}

export interface MonsterParts {
  readonly common: MonsterDrop
  readonly rare: MonsterDrop
  readonly breakLimb: BreakLimb | null
}

export interface BossAdd {
  readonly monsterId: ContentId
  readonly count: number
  readonly row: PlacementRow
}

export interface BossPhase {
  /** The phase begins when HP falls to this percent; the first phase is 100. */
  readonly atHpPercent: number
  /** Attack ids available in this phase. */
  readonly attacks: readonly ContentId[]
  readonly adds: readonly BossAdd[]
  readonly arenaRule: string | null
}

/** Boss rules (03 §11.3; 06; 07 §2.8). */
export interface BossDef {
  /** 2 for a zone boss, 3 for a final boss, in descending atHpPercent. */
  readonly phases: readonly BossPhase[]
  readonly everyKill: readonly Reward[]
  readonly firstKill: readonly Reward[]
  readonly immunities: readonly Status[]
  readonly cannotFlee: boolean
}

/** Floor-hunter rules (03 §4.5). */
export interface HunterDef {
  readonly levelOffset: number
  readonly entersAtTick: number
  /** Rooms moved toward the party per tick (0.5 = one room every 2 ticks). */
  readonly roomsPerTick: number
  readonly cannotFlee: boolean
  readonly guaranteedRarePart: boolean
  readonly movesDuringRest: boolean
}

export interface MonsterVisual {
  readonly baseMesh: string
  readonly scale: number
  readonly variantOf: ContentId | null
  readonly palette: readonly HexColor[]
  readonly reads200px: boolean
  readonly animations: readonly string[]
  readonly triBudget: number
}

/** A monster template (03 §11.2–§11.3; 06 §3): content/monsters/<id>.json. */
export interface MonsterDef {
  readonly id: ContentId
  readonly name: string
  readonly familyId: ContentId
  readonly dungeonId: ContentId
  readonly zoneId: ContentId
  readonly role: Role
  readonly size: Size
  readonly rows: readonly PlacementRow[]
  readonly levelBand: IntRange
  readonly multipliers: MonsterMultipliers
  readonly speed: number
  readonly xpClass: XpClass
  readonly goldMultiplier: number
  readonly ambushModifier: number
  readonly attacks: readonly MonsterAttack[]
  readonly resist: readonly DamageType[]
  readonly weak: readonly DamageType[]
  readonly immune: readonly DamageType[]
  readonly statusImmune: readonly Status[]
  readonly behavior: MonsterBehavior
  readonly parts: MonsterParts
  readonly monsterTechniqueSkillIds: readonly ContentId[]
  readonly elitePool: readonly ContentId[]
  readonly boss: BossDef | null
  readonly hunter: HunterDef | null
  readonly visual: MonsterVisual
}

// ---------------------------------------------------------------------------------------------------------------
// elite-affix.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** One of the twelve champion affixes (06 §2): content/elite-affixes/<id>.json. */
export interface EliteAffixDef {
  readonly id: ContentId
  readonly name: string
  readonly affixClass: EliteAffixClass
  readonly rule: string
  readonly effects: readonly Effect[]
  readonly hpMultiplier: number
  readonly goldMultiplier: number
  readonly xpClassBonus: number
  readonly floorMin: number
  readonly tell: string | null
  readonly excludesElement: boolean
}

// ---------------------------------------------------------------------------------------------------------------
// dungeon.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface ZoneFloors {
  readonly from: number
  readonly to: number
}

export interface ZoneDef {
  readonly id: ContentId
  readonly name: string
  readonly floors: ZoneFloors
  readonly familyId: ContentId
  readonly hunterId: ContentId | null
  /** In floor order; each sits on the floor whose bossId names it. */
  readonly bossIds: readonly ContentId[]
  readonly waystone: boolean
  readonly biomeKitId: ContentId
}

export interface FloorDef {
  readonly floor: number
  readonly zoneId: ContentId
  readonly monsterLevel: number
  readonly roomsMin: number
  readonly roomsMax: number
  readonly lightAtEntry: number
  readonly encounterTableIds: readonly ContentId[]
  readonly eliteAffixCount: number
  readonly trapBand: IntRange
  readonly secretChance: number
  readonly secretDifficulty: number
  readonly merchant: boolean
  /** Ticks before the zone's hunter enters; null for no hunter (boss floors). */
  readonly hunterClock: number | null
  readonly bossId: ContentId | null
  readonly lightAtArena: number | null
}

export interface GridSize {
  readonly w: number
  readonly h: number
}

/** The mission-graph grammar and its knobs (03 §11.1; 07 §2.10). */
export interface GeneratorDef {
  /** Roll weights for the rolled room kinds; sum to 100. Fixed kinds are left out or 0. */
  readonly roomWeights: Readonly<Partial<Record<RoomKind, number>>>
  readonly grammar: readonly string[]
  readonly keyLockChance: number
  readonly secretChance: number
  readonly minRooms: number
  readonly maxRooms: number
  readonly maxBranches: number
  readonly bossFarthest: boolean
  readonly grid: GridSize
}

export interface CurioOutcome {
  readonly chance: number
  readonly effect: Effect
}

export interface CurioChoice {
  readonly label: string
  readonly requires: readonly Requirement[]
  /** Rolled once; chances sum to 100. Empty means nothing happens. */
  readonly outcomes: readonly CurioOutcome[]
}

/** An interactable with a choice (03 §4.6; 07 §2.4). */
export interface CurioDef {
  readonly id: ContentId
  readonly name: string
  /** The zone whose floors roll it; null for any zone of the dungeon. */
  readonly zoneId: ContentId | null
  readonly description: string
  readonly choices: readonly CurioChoice[]
  readonly safeItemId: ContentId | null
}

/** A secret room's contents (03 §4.3; 07 §2.6): dungeon.schema.json#/$defs/secret. Secrets reward, never gate. */
export interface SecretDef {
  readonly id: ContentId
  readonly name: string
  readonly zoneId: ContentId | null
  readonly description: string
  readonly rewards: readonly Reward[]
  readonly chest: 'small' | 'large' | null
  readonly blessing: { readonly name: string; readonly description: string; readonly effects: readonly Effect[] } | null
  readonly shortcutToExit: boolean
  readonly revealsFloor: boolean
  readonly lightBonus: number
  readonly fieldSkillXp: FieldSkill | null
}

export interface FieldSkillRankReveal {
  readonly fieldSkill: FieldSkill
  readonly min: number
}

/** How the party sees a trap before it fires. */
export interface TrapReveal {
  readonly detection: number
  readonly classId: ContentId | null
  readonly petId: ContentId | null
  readonly fieldSkillRank: FieldSkillRankReveal | null
  readonly criticalScout: boolean
}

/** A trap (03 §4.3; 07 §2.5). */
export interface TrapDef {
  readonly id: ContentId
  readonly name: string
  readonly zoneId: ContentId | null
  readonly difficulty: number
  readonly trigger: TrapTrigger
  readonly triggerNote: string
  readonly revealedBy: TrapReveal
  readonly effects: readonly Effect[]
  readonly blocksDoor: boolean
  readonly disarmReward: readonly Reward[]
}

export interface TemplateDoor {
  readonly side: DoorSide
  /** Cells from the side's left/top corner. */
  readonly offset: number
}

/** The fixed cinematic camera (03 §4.1). */
export interface TemplateCamera {
  readonly position: Vec3
  readonly lookAt: Vec3
  /** Vertical field of view in degrees. */
  readonly fov: number
}

export interface TemplateProp {
  readonly meshId: string
  readonly position: Vec3
  /** Degrees. */
  readonly rotationY: number
  readonly lightSource?: boolean
}

/** A room set piece on the coarse grid (03 §11.1 step 3; 07 §2.2): dungeon.schema.json#/$defs/template. */
export interface TemplateDef {
  readonly id: ContentId
  readonly zoneId: ContentId
  readonly footprint: GridSize
  readonly doors: readonly TemplateDoor[]
  readonly kinds: readonly RoomKind[]
  readonly camera: TemplateCamera
  readonly props: readonly TemplateProp[]
  readonly triBudget: number
  readonly drawCallBudget: number
}

/** The difficulty scalars (03 §11.2; 07 §6.1). Percentages are of Normal (100 = unchanged); absent means Normal. */
export interface DifficultyKnobs {
  readonly enemyHpPercent?: number
  readonly enemyDamagePercent?: number
  readonly enemyCountPercent?: number
  readonly enemySpeedPercent?: number
  readonly eliteRoomWeight?: number
  readonly eliteAffixBonus?: number
  readonly hunterClock?: number
  readonly lightStart?: number
  readonly torchValue?: number
  readonly revivesPerFloor?: number
  readonly trapDifficultyBonus?: number
  readonly retreatTollPercent?: number
  readonly goldPercent?: number
  readonly xpPercent?: number
  readonly chestShiftPp?: number
  readonly chestCentreShift?: number
  readonly bossExtraRareParts?: number
  readonly finalBossExtraShards?: number
}

export interface PactReward {
  readonly goldPercent: number
  readonly xpPercent: number
  readonly chestShiftPp: number
}

/** A named modifier the party opts into for a reward (03 §11.2; 07 §6.2). */
export interface PactDef {
  readonly id: ContentId
  readonly name: string
  readonly description: string
  /** 1–3; its Oath contribution. */
  readonly weight: number
  readonly knobs: DifficultyKnobs
  /** Rule flags the sim implements by name where a knob cannot say it. */
  readonly ruleFlags: readonly ContentId[]
  readonly reward: PactReward
}

/** The three launch presets as knob sets; Normal is the baseline. */
export type PresetSet = Readonly<Record<Difficulty, DifficultyKnobs>>

/** A dungeon (03 §4, §11, §12; 07 §2, §6): content/dungeons/<id>/dungeon.json plus its templates/ files. */
export interface DungeonDef {
  readonly id: ContentId
  readonly name: string
  readonly lore: string
  readonly levelRange: IntRange
  readonly unlockedBy: ContentId | null
  readonly zones: readonly ZoneDef[]
  readonly floors: readonly FloorDef[]
  readonly generator: GeneratorDef
  readonly curios: readonly CurioDef[]
  readonly traps: readonly TrapDef[]
  /** Secret rooms (07 §2.6); optional until Phase 3 writes them. */
  readonly secrets?: readonly SecretDef[]
  /** Inline templates plus every templates/<id>.json file, merged by the loader. */
  readonly templates: readonly TemplateDef[]
  readonly pacts: readonly PactDef[]
  readonly presets: PresetSet
}

// ---------------------------------------------------------------------------------------------------------------
// encounter.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface EncounterSlot {
  readonly monsterId: ContentId
  readonly count: number
  readonly row: PlacementRow
}

/** One entry of an encounter table (03 §11.1 step 4): content/encounters/<id>.json. */
export interface EncounterDef {
  readonly id: ContentId
  readonly tableId: ContentId
  readonly dungeonId: ContentId
  /** Floors (not monster levels) this entry can appear on. */
  readonly floorBand: IntRange
  readonly name: string
  /** Monsters at three players; 2–6 in total before scaling. */
  readonly composition: readonly EncounterSlot[]
  readonly weight: number
  readonly ambushModifier: number
  readonly eliteAllowed: boolean
}

// ---------------------------------------------------------------------------------------------------------------
// pet.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface PetTrait {
  readonly id: ContentId
  readonly name: string
  readonly description: string
  readonly effects: readonly Effect[]
  /** The xp tag whose meaningful uses rank the trait up. */
  readonly growsBy: Attribute
}

export interface PetActiveRef {
  /** A skill with classId 'pet'. */
  readonly skillId: ContentId
  readonly unlockLevel: number
}

export interface PetVisual {
  readonly baseMesh: string
  readonly palette: readonly HexColor[]
}

export interface PetEggSource {
  /** Centre grade of the Pet Egg chests that carry it; null when it never comes from a chest. */
  readonly chestBand: Grade | null
  readonly familyId: ContentId | null
}

/** A pet species (03 §9; 06 §9): content/pets/<id>.json. Grade belongs to the hatched instance. */
export interface PetDef {
  readonly id: ContentId
  readonly name: string
  readonly speciesFamilyId: ContentId
  readonly gradeBand: GradeRange
  readonly trait: PetTrait
  /** In unlock order, 1–3; a hatched pet uses the first N by grade. */
  readonly actives: readonly PetActiveRef[]
  readonly stamina: number
  readonly baseStats: DerivedStatMultipliers
  readonly roleLean: Stance
  readonly visual: PetVisual
  readonly eggSource: PetEggSource
  readonly creationChoice: boolean
}

export interface RanchImport {
  readonly sourceGame: 'wildsong'
  readonly shareCode: string
  readonly mappedGrade: RanchImportGrade
}

/** A hatched pet in a hero save (pet.schema.json#/$defs/petInstance). */
export interface PetInstance {
  readonly petId: ContentId
  /** The player's name for it. */
  readonly name: string
  readonly grade: Grade
  readonly level: number
  readonly xp: number
  readonly bondStars: number
  readonly traitRank: number
  readonly stance: Stance
  readonly ranchImport: RanchImport | null
}

// ---------------------------------------------------------------------------------------------------------------
// chest.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface ChestOdds {
  readonly centreGrade: Grade
  /** grade → percent; sums to 100, God never above 0. */
  readonly table: GradeTable
}

export interface ChestPity {
  readonly plusOneWithin: number
  readonly plusTwoWithin: number
}

/** A chest sold by the Curio Merchant (03 §8.3): content/chests/<id>.json. */
export interface ChestDef {
  readonly id: ContentId
  readonly name: string
  readonly kind: ChestKind
  readonly tier: ChestTier
  /** Price in units of R. */
  readonly priceR: number
  readonly subtypes: readonly ChestSubtype[]
  readonly oddsByBand: readonly ChestOdds[]
  readonly pity: ChestPity
  readonly bagWithoutReplacement: boolean
  readonly tomeTiers: IntRange | null
  readonly dupeRule: DupeRule
  readonly divineShardChance: number
}

/**
 * A named adventurer the Wayfarer Chest can call to the Lantern Inn (D-091): content/wayfarers/<id>.json, the cast
 * list owned by 04-CLASSES §7. Made into a hero with createHero at the level of the weakest living hero.
 */
export interface WayfarerDef {
  readonly id: ContentId
  readonly name: string
  readonly speciesId: ContentId
  readonly classId: ContentId
  readonly grade: WayfarerGrade
  /** Creation points: 6 + 1 per grade above D, at most 3 on one attribute (03 §2.3). */
  readonly freePoints: Readonly<Partial<Record<Attribute, number>>>
  /** Three Tier I skills of the class. */
  readonly starterSkillIds: readonly ContentId[]
  /** Their own AI rule; the class default when null. */
  readonly aiRule: string | null
  /** One line: who they are. */
  readonly bio: string
}

// ---------------------------------------------------------------------------------------------------------------
// loot-table.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** The floor-drop shape around the band's centre grade; the five numbers sum to 100. */
export interface GradeShape {
  readonly centreGrade: Grade
  readonly centre: number
  readonly minus1: number
  readonly plus1: number
  readonly plus2: number
  readonly plus3: number
}

export interface PartChance {
  readonly common: number
  readonly rare: number
}

export interface ConsumableDrop {
  readonly chance: number
  readonly itemIds: readonly ContentId[]
}

export interface HiddenFind {
  readonly itemAtPlusOneChance: number
  readonly skeletonKeyChance: number
}

/** The strongroom (07 §2.7; 08 §11). */
export interface TreasureRoom {
  readonly goldPiles: IntRange
  readonly goldFightsWorth: number
  readonly smallChestChance: number
  readonly largeChestChance: number
  readonly largeLockedChance: number
  readonly trappedChance: number
  readonly trapId: ContentId | null
  readonly consumableBundle: number
  readonly hiddenFind: HiddenFind
}

/** The floor-band loot table of one dungeon (03 §6.2, §8.3; 08 §11): content/loot-tables/<id>.json. */
export interface LootTableDef {
  readonly id: ContentId
  readonly dungeonId: ContentId
  readonly name: string
  readonly floorBand: IntRange
  readonly monsterLevels: IntRange
  readonly goldRange: IntRange
  readonly itemChance: number
  readonly gradeShape: GradeShape
  readonly partChance: PartChance
  readonly stoneChance: number
  readonly consumableDrop: ConsumableDrop
  readonly treasureRoom: TreasureRoom
  /** Item chance × (1 + bonus) by light band, band → percent. */
  readonly darknessItemBonus: Readonly<Partial<Record<LightBand, number>>>
  readonly bossFirstKill: ContentId | null
}

// ---------------------------------------------------------------------------------------------------------------
// contract.schema.json
// ---------------------------------------------------------------------------------------------------------------

/** What a contract's condition counts; every key is optional, the linter checks the ones the kind needs. */
export interface ContractTarget {
  readonly familyId?: ContentId
  readonly monsterId?: ContentId
  readonly dungeonId?: ContentId
  readonly zoneId?: ContentId
  readonly count?: number
  readonly floor?: number
  readonly lightMin?: number
  readonly lightMax?: number
  readonly difficultyMin?: Difficulty
  readonly partyMin?: number
  /** For collect: unbanked gold in R to return with. */
  readonly goldR?: number
  /** An arena or floor condition the sim checks by name. */
  readonly condition?: string
}

export interface ContractKey {
  readonly kind: KeyKind
  readonly amount: number
}

export interface ContractItem {
  readonly itemId: ContentId
  readonly amount: number
}

export interface ContractReward {
  /** Gold in units of R at the player's band. */
  readonly goldR: number
  readonly keys: readonly ContractKey[]
  readonly chestId: ContentId | null
  readonly items: readonly ContractItem[]
}

/** A Quest Board contract (03 §8.2; 07 §7): content/contracts/<id>.json. */
export interface ContractDef {
  readonly id: ContentId
  readonly name: string
  readonly description: string
  readonly cadence: ContractCadence
  readonly kind: ContractKind
  readonly target: ContractTarget
  readonly reward: ContractReward
  /** The band the contract is written for; null for a template the board fills with the player's band. */
  readonly band: number | null
}

// ---------------------------------------------------------------------------------------------------------------
// status.schema.json
// ---------------------------------------------------------------------------------------------------------------

export interface StatusVisual {
  readonly icon: string
  readonly tint: HexColor
}

/** One status effect from the standard set (03 §3.5): content/statuses/<id>.json, one per `Status` value. */
export interface StatusDef {
  readonly id: Status
  readonly name: string
  readonly description: string
  readonly kind: StatusKind
  readonly element: Element | null
  readonly tickAt: TickAt
  readonly magnitudeOf: MagnitudeOf | null
  /** The per-tick magnitude as a percentage of magnitudeOf, per stack; null when magnitudeOf is null or fixed. */
  readonly percent: number | null
  readonly tickDamageType: DamageType | null
  readonly ignoresDefense: boolean
  readonly stacking: Stacking
  readonly maxStacks: number
  readonly durationDefault: number | null
  readonly endsWhen: string | null
  readonly effects: readonly Effect[]
  readonly upgradesTo: Status | null
  readonly cleansedBy: readonly string[]
  readonly appliesEnergyDelta: number
  readonly skipsActionChance: number
  readonly immunityRoles: readonly Role[]
  readonly bossBecomes: Status | null
  readonly visual: StatusVisual
}

// ---------------------------------------------------------------------------------------------------------------
// hero.schema.json (a save record, not content; here because the sim reads it beside the content)
// ---------------------------------------------------------------------------------------------------------------

/** All eight attributes as integers (03 §2.1: 10 is an ordinary adult). */
export type AttributeValues = Readonly<Record<Attribute, number>>

/** XP toward the next point per trainable attribute; Luck never appears. */
export type AttributeXp = Readonly<Partial<Record<TrainableAttribute, number>>>

export interface KnownSkill {
  readonly skillId: ContentId
  readonly rank: number
  readonly xp: number
}

/** 4 actives + 2 passives + the pet stance (03 §7.3). An empty slot is null. */
export interface Loadout {
  readonly actives: readonly [ContentId | null, ContentId | null, ContentId | null, ContentId | null]
  readonly passives: readonly [ContentId | null, ContentId | null]
  readonly stance: Stance
}

export interface LoadoutPreset {
  readonly name: string
  readonly loadout: Loadout
}

export interface FieldSkillState {
  readonly rank: number
  readonly xp: number
}

/** The eleven slots (03 §6.1); the pet is `petInstance`. Empty slots are null. */
export interface Equipment {
  readonly mainHand: ItemInstance | null
  readonly offHand: ItemInstance | null
  readonly helmet: ItemInstance | null
  readonly chest: ItemInstance | null
  readonly legs: ItemInstance | null
  readonly boots: ItemInstance | null
  readonly gloves: ItemInstance | null
  readonly ring: readonly [ItemInstance | null, ItemInstance | null]
  readonly talisman: ItemInstance | null
  readonly relic: ItemInstance | null
}

/** The Draconid's Scales (05 §3.6): a twelfth, unremovable armor piece with its own item level and XP. */
export interface NaturalArmor {
  readonly defense: number
  readonly itemLevel: number
  readonly xp: number
  readonly affinities: readonly ItemAffinity[]
}

export interface HeroStats {
  readonly kills: number
  readonly delves: number
  readonly deaths: number
}

/** The save-side hero (03 §2, §5, §7.3, §12.2): hero.schema.json. Migrated by `saveVersion`. */
export interface HeroRecord {
  readonly saveVersion: number
  /** Unique within the player's armory. */
  readonly id: string
  readonly name: string
  readonly speciesId: ContentId
  readonly classId: ContentId
  /** Set by battleXp (D-082). */
  readonly level: number
  /** Battle XP from won fights (D-082: Final Fantasy-style levels). */
  readonly battleXp: number
  readonly attributes: AttributeValues
  readonly attributeXp: AttributeXp
  readonly creationValues: AttributeValues
  readonly freePointsSpent: number
  readonly skills: readonly KnownSkill[]
  readonly loadout: Loadout
  /** At most 4; the species' loadoutPresets rule caps the count. */
  readonly loadoutPresets: readonly LoadoutPreset[]
  readonly fieldSkills: Readonly<Record<FieldSkill, FieldSkillState>>
  readonly equipment: Equipment
  readonly naturalArmor: NaturalArmor | null
  /** At most 40. */
  readonly bag: readonly ItemInstance[]
  /** Unbanked gold carried this delve. */
  readonly gold: number
  readonly petInstance: PetInstance | null
  readonly aiRule: string
  readonly titles: readonly string[]
  readonly hardcore: boolean
  readonly stats: HeroStats
}
