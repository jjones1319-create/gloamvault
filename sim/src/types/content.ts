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
  BodyFrame,
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

/** A second (third …) starter kit a class offers at New hero (D-099; 08 §12). */
export interface StarterKitOption {
  readonly id: ContentId
  readonly name: string
  readonly description: string
  readonly starterKit: readonly ContentId[]
  /** The three Tier I picks the kit recommends. */
  readonly starterSkillIds: readonly ContentId[]
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
  /** What New hero calls the default kit when the class offers others ("Sword and shield"). */
  readonly starterKitName?: string
  /** Other starter kits New hero offers (D-099: the Warden's spear kit, the Blade's greatsword kit). */
  readonly starterKitOptions?: readonly StarterKitOption[]
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
  /** The attack ids of monsterTechniqueOf that count as "the move"; absent: any of its attacks (09 §4, Phase 7). */
  readonly monsterTechniqueMoveIds?: readonly ContentId[]
  /** A technique whose monster's dungeon is not in the content yet (Troll's Regrowth): unobtainable until linked. */
  readonly monsterTechniqueLater?: ContentId
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
  /** Attribute lines a buffStat line cannot name (08 §7: the Emberheart Ring's "+2 Vitality"); Phase 7, optional. */
  readonly attributes?: Readonly<Partial<Record<Attribute, number>>>
}

/** A relic's once-per-fight active. */
export interface RelicActive {
  readonly effects: readonly Effect[]
  readonly usesPerFight: number
  readonly target: Target
  /** 08 §3's Effect column for the card (Phase 7, optional). */
  readonly text?: string
  /** "(instant)": no Item action, the hero acts again (Phase 7, optional; absent: an Item action). */
  readonly instant?: boolean
  /** A once-per-floor relic (the Hollow Coin; Phase 7, optional). */
  readonly usesPerFloor?: number
  /** In a fight (the default) or after a won fight (the Hollow Coin; Phase 7, optional). */
  readonly timing?: 'fight' | 'afterFight'
}

/** What a consumable does when used. */
export interface ConsumableUse {
  readonly effects: readonly Effect[]
  readonly stackMax: number
  readonly target: Target
  /** What the card says it is for: a safe item's curio (Phase 7, optional). */
  readonly text?: string
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
  /** Item tags (Phase 7, optional): 'safe-item' + 'zone:<id>', 'boss-only', 'chest-key:<tier>', 'skeleton-key', 'regional'. */
  readonly tags?: readonly string[]
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
  /** A Skill Tome (kind 'tome'): the skill it teaches (03 §7.5, 08 §4; Phase 7). Absent on every other item. */
  readonly skillId?: ContentId
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
  /** A telegraphed attack's cue (06 §8.10): shown on the monster's turn before the blow, which lands on its next turn. */
  readonly tell: string | null
  /** The tell's two-word hint ("Netter reloading", D-099); the attack's name when absent. */
  readonly hint?: string
  /** Whom a single-target attack picks among the heroes it can reach (06: "the hero with the lowest HP %"). */
  readonly aim?: AttackAim
}

/** 06's target phrases for single-target attacks (fight.ts aimTarget). */
export type AttackAim = 'lowestHp' | 'mostMomentum' | 'lowestStrength' | 'marked' | 'markedOrChilled' | 'backRow' | 'mostGold' | 'fullestPool' | 'caster'

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
  /** 06's name for the phase ("the Captain's Table"). */
  readonly name?: string
  /** The arena light when the phase begins (07 §2.8): set to a value, or stepped by an amount (the King's snuff −25). */
  readonly light?: BossPhaseLight
  /** The boss's Speed from this phase on (06 §3.4: the King's phase 3, 120). */
  readonly speed?: number
  /** The row the boss moves to (Vexa steps down, Naesa walks into the water, the King descends). */
  readonly row?: PlacementRow
  /** The boss's size from this phase on (Naesa Medium → Large, the King Large → Huge). */
  readonly size?: Size
  /** The boss's first move of the phase (Vexa kicks the barricade over). */
  readonly opener?: ContentId
  /** The arena's water jumps to at least this step (Naesa's phase 2: 3; the throne's phase 3: 4). */
  readonly tide?: number
  /** Statuses the boss shrugs off from this phase on (06 §3.4 phase 3: Petrify, Grab, Fear). */
  readonly statusImmune?: readonly Status[]
  /** Custom lines installed on the boss when the phase begins (Naesa's Silence aura). */
  readonly hooks?: readonly Effect[]
}

export interface BossPhaseLight {
  readonly set?: number
  readonly add?: number
}

/** A row of 07 §2.8's tells table: the cue and its two-word hint (D-099). */
export interface ArenaTellDef {
  readonly id: ContentId
  readonly hint: string
  readonly cue: string
}

/**
 * One rule of a boss arena (07 §2.8), from a closed vocabulary arena.ts implements; every number is the arena's own.
 * `kind` picks the rule; the other fields are that rule's parameters (content/README.md "Boss arenas").
 */
export interface ArenaRuleDef {
  readonly kind: ArenaRuleKind
  /** Phases (1-based) the rule runs in; absent: every phase. */
  readonly phases?: readonly number[]
  /** The tell (an id of arena.tells) shown the round before the rule fires. */
  readonly tell?: ContentId
  /** A rule on a clock: fires every N rounds of its phase. */
  readonly every?: number
  /** A faster clock below an HP percent or from a phase on (the tide under 20%, the throne's pulls in phase 3). */
  readonly fastEvery?: number
  readonly fastBelowHpPercent?: number
  readonly fastFromPhase?: number
  /** A light step or a percent. */
  readonly amount?: number
  readonly percent?: number
  /** Light bands the rule reads (the King's Dark and Pitch, his Radiant). */
  readonly bands?: readonly LightBandId[]
  /** Counts: kegs, piles, candles, braziers, the tide's top step; hits to break a keg or a pile. */
  readonly count?: number
  readonly hits?: number
  readonly max?: number
  /** The rule's attack(s) (the call rules, the King's Gaze), monsters (the flank), adds. */
  readonly attack?: ContentId
  readonly attacks?: readonly ContentId[]
  readonly monsters?: readonly ContentId[]
  readonly adds?: readonly BossAdd[]
  /** A status the rule puts on heroes or adds (the wade, the pull, the pulse, the Radiant Fear) and its turns. */
  readonly status?: Status
  readonly duration?: number
  /** Damage types a pile burns to. */
  readonly damageTypes?: readonly DamageType[]
  /** The attribute and minimum the sluice wheel needs. */
  readonly attribute?: Attribute
  readonly min?: number
  /** At-HP rules (the King's re-call at 40%, Naesa's shade at 10%). */
  readonly atHpPercent?: number
  /** Rounds into the phase (the hunters: +2, +4, +6); rounds after an add fell (Naesa's returns). */
  readonly rounds?: readonly number[]
  readonly afterRounds?: number
  /** A rule's named knobs (content/README.md "Boss arenas": hpPercent, accuracy, critBonus, chainPercent …). */
  readonly params?: Readonly<Record<string, number | string | boolean>>
  readonly note?: string
}

export type ArenaRuleKind =
  | 'lightsOut'
  | 'flank'
  | 'barricade'
  | 'reenter'
  | 'frenzy'
  | 'oath'
  | 'candles'
  | 'piles'
  | 'call'
  | 'heel'
  | 'tide'
  | 'outOfReach'
  | 'braziers'
  | 'lightBand'
  | 'pull'
  | 'pulse'
  | 'addAt'
  | 'hunters'

export type LightBandId = 'radiant' | 'dim' | 'shadowy' | 'dark' | 'pitch'

/** A boss arena (07 §2.8): the room, its tells and its rules. */
export interface ArenaDef {
  /** The room template (07 §2.8). */
  readonly room: ContentId
  readonly tells: readonly ArenaTellDef[]
  readonly rules: readonly ArenaRuleDef[]
}

/**
 * One of a boss's breakable parts (06 §3 "Part-breaks"): one blow of at least `hpPercent` of the boss's max HP, of one
 * of `damageTypes` (any type when empty), a critical hit when `crit`, breaks it once; `effect` says what it costs him.
 */
export interface BossPartDef {
  readonly id: ContentId
  readonly name: string
  readonly hpPercent: number
  readonly damageTypes: readonly DamageType[]
  readonly crit: boolean
  /** The part exists from this phase on (Naesa's tentacle arms come in phase 2). */
  readonly fromPhase?: number
  readonly effect: BossPartEffect
}

/** What a broken part changes (arena.ts): attacks lost, an attack weakened, an attack's statuses lost, a mechanic stopped, a line. */
export interface BossPartEffect {
  readonly removeAttacks?: readonly ContentId[]
  /** Attack id → its new multiplier. */
  readonly attackMultiplier?: Readonly<Record<string, number>>
  /** Attack id → statuses its lines no longer apply. */
  readonly removeStatuses?: Readonly<Record<string, readonly Status[]>>
  /** The light stops dropping (the Warden's lantern). */
  readonly stopLight?: boolean
  /** The tide stops (the throne's chain). */
  readonly stopTide?: boolean
  /** A DSL or custom line applied to the boss (the grin-mask's lost Fear immunity and Riposte). */
  readonly line?: Effect
}

/** Boss rules (03 §11.3; 06; 07 §2.8). */
export interface BossDef {
  /** 2 for a zone boss, 3 for a final boss, in descending atHpPercent. */
  readonly phases: readonly BossPhase[]
  readonly everyKill: readonly Reward[]
  readonly firstKill: readonly Reward[]
  readonly immunities: readonly Status[]
  readonly cannotFlee: boolean
  /** The arena (07 §2.8): optional so a boss without one fights in a plain room. */
  readonly arena?: ArenaDef
  /** The boss's breakable parts (06 §3); the monster's `parts.breakLimb` stays the single-limb rule of everything else. */
  readonly parts?: readonly BossPartDef[]
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
  /** A Waystone stands in the entry room of the zone's first floor (07 §1.1: Gravehollow F1, F4, F7). */
  readonly waystone: boolean
  readonly biomeKitId: ContentId
  /** Rare monsters that join any fight of the zone at a chance (06 §3.3: the Pearl Ooze, 5%). Optional (C1, Phase 7). */
  readonly joiners?: readonly ZoneJoiner[]
}

/** One rare joiner of a zone's fights (dungeon.schema.json#/$defs/zone joiners). */
export interface ZoneJoiner {
  readonly monsterId: ContentId
  readonly chancePercent: number
  readonly row: PlacementRow
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
  /** More lines resolved after `effect`, in order (07 §2.4's two-part outcomes). Optional (C1, Phase 7). */
  readonly also?: readonly Effect[]
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
  /** The secret's chest is locked (07 §2.6 Pearl Cache). Optional (C1, Phase 7). */
  readonly chestLocked?: boolean
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
  /** Where it may be placed (07 §2.5's "the midline of cry_t_catacomb_run"). Optional (C1, Phase 7). */
  readonly placement?: TrapPlacement
  /** When an unrevealed trap fires at all (the Drowning Bell's low light, the Warding Glyph's caster). Optional (C1, Phase 7). */
  readonly condition?: TrapCondition
}

export interface TrapPlacement {
  readonly templateIds?: readonly ContentId[]
  readonly roomKinds?: readonly RoomKind[]
}

export interface TrapCondition {
  /** Fires only while the party's light is below this. */
  readonly lightBelow?: number
  /** Fires only when the party holds a hero of one of these classes. */
  readonly partyClassIds?: readonly ContentId[]
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
  /** Pacts (07 §6.2, Phase 7): durability wear in percent of Normal (Brittle 150). */
  readonly wearPercent?: number
  /** Added to the revive budget the preset leaves, never below 0 (Thin Line −2). */
  readonly revivesPerFloorDelta?: number
  /** Points added to the party's ambush chance (Loud Boots 15). */
  readonly ambushBonusPercent?: number
  /** The light a new room drains, replacing tuning's perNewRoom (Long Night −8). */
  readonly lightPerNewRoom?: number
  /** A chest that would be unlocked locks this often (Every Door Locked 30). */
  readonly lockedChestPercent?: number
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
  /** The Pact changes the hunter (its clock, a second hunter): greyed out where the zone has no hunter clock (07 §6.2). */
  readonly needsHunter?: boolean
  readonly reward: PactReward
}

/** The three launch presets as knob sets; Normal is the baseline. */
export type PresetSet = Readonly<Record<Difficulty, DifficultyKnobs>>

/**
 * The fixed lesson floor of a profile's first delve (D-038, 03 §13; Phase 8, pass B): dungeon.schema.json `tutorial`.
 * The generator lays the floor out as Entry · Fight · Trap room · Stairs; this block says what stands in it, so nothing
 * on it is rolled: the first fight, the trap room's traps and chest, the hunter and the surprise roll.
 */
export interface TutorialDef {
  /** The floor the lesson replaces on a profile's first delve (Gravehollow: 1). */
  readonly floor: number
  /** The first fight (03 §13: "a rat is faster than you"). */
  readonly encounterId: ContentId
  /** The trap room's traps, in order: ones a starting hero's Perception reveals. */
  readonly trapIds: readonly ContentId[]
  /** The chest in the trap room, or null. */
  readonly chest: 'small' | 'large' | null
  /** Whether the zone's hunter stalks the lesson floor. */
  readonly hunter: boolean
  /** Whether the first fight may open with a surprise either way. */
  readonly surprise: boolean
}

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
  /** The first delve's fixed lesson floor (D-038; Phase 8). Optional: without it a first delve's floor 1 keeps the lesson's layout with rolled contents (as built in Phase 4). */
  readonly tutorial?: TutorialDef
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
  /** Weighted uses of the trait so far (03 §9: it grows by use; tuning pets.traitGrowth). Optional; absent = 0 (Phase 7). */
  readonly traitXp?: number
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
  /** The lowest chest band it is sold at (the Grand Wayfarer Chest, from band E; Phase 7, optional): every band when absent. */
  readonly minBand?: Grade
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
  /** How they look (Phase 5); a look from a hash of the hero id when absent. */
  readonly look?: HeroLook
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
  /** Several monsters counted together ("the Grinning Company"): any of them counts (Phase 7). */
  readonly monsterIds?: readonly ContentId[]
  /** A curio the condition watches ('no-curio-opened': Keeper's Peace's Sealed Sarcophagus). */
  readonly curioId?: ContentId
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
/**
 * A hero's look (Phase 5, hero.schema.json `look`): the body frame, a skin tone and a face preset of the species, and
 * a hair colour. Cosmetic only: no rule reads it.
 */
export interface HeroLook {
  readonly frame: BodyFrame
  /** Index into the species' `body.skinTones`. */
  readonly skin: number
  /** Index into the species' face presets (`body.facePresets`). */
  readonly face: number
  /** Index into the species' hair colours (the hero manifest); the client wraps it to the palette it has. */
  readonly hair: number
}

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
  /** How the hero looks (Phase 5). Optional for records made before save 3; createHero always writes one. */
  readonly look?: HeroLook
  /**
   * Monster techniques witnessed and not yet learned (09 §4, Phase 7): skill id → qualifying witnessed uses so far.
   * The Nth (tuning techniques.guaranteedByUse) teaches the skill. Optional; absent = none witnessed.
   */
  readonly techniqueWitness?: Readonly<Record<string, number>>
  /** Qualifying uses since the last Insight, kept between delves so 03 §7.5's pity (one per 60) can land (Phase 7). Optional; absent = 0. */
  readonly insightPity?: number
  /**
   * Arrows and bolts left by ammo item id (08 §4, D-099; Phase 7). A missing entry is a full quiver
   * (tuning ammo.quiverMax), so a hero made before Phase 7 starts with one; Repair all refills it.
   */
  readonly quiver?: Readonly<Record<string, number>>
}
