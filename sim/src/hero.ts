import type { Content } from './content.ts'
import type { Actor, EquippedItem, FightRow, HeroActorData, HeroEquipment } from './fight-types.ts'
import { installHook } from './hooks.ts'
import { canHoldOffHand, createItemInstance, effectiveItemStats, setBonusLoad } from './items.ts'
import { clampLook, defaultLook } from './look.ts'
import type { Rng } from './rng.ts'
import { linesAtRank, rankEffectPercent } from './skill-lines.ts'
import { battleXpForLevel, heroLevelForXp } from './xp.ts'
import { ALL_TENS, deriveStats, roundHalfUp, type ArmorPieceLoad, type AttributeValues, type SpeciesStatRules, type StatBonuses, type StatInputs } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { ClassDef, Effect, Equipment, HeroLook, HeroRecord, ItemDef, ItemInstance, Loadout, PetInstance, SpeciesDef, SpeciesRule } from './types/content.ts'
import { ATTRIBUTES, FIELD_SKILLS, type Attribute, type DerivedStat, type FieldSkill, type Slot } from './types/enums.ts'

/**
 * Heroes (03-GAME-DESIGN §2.3, §6.1, §7.3): creation from species × class × six free points, the starter kit and
 * the three starter skills; and the hero record → fight actor step, which reads every worn item through the item
 * module so wear, +N and affixes all count.
 */
/** The hero record's schema version: 2 adds `look` (Phase 5). The profile's version is town.ts's PROFILE_VERSION. */
export const SAVE_VERSION = 2

/** Every trait's typed knobs folded into one: numbers add, multipliers multiply, maps merge, flags OR. */
export function speciesRules(species: SpeciesDef): SpeciesRule {
  const out: Record<string, unknown> = {}
  const mult = new Set(['hpMultiplier', 'manaMultiplier', 'xpMultiplier', 'carryMultiplier', 'shopPriceMultiplier', 'promotionCostMultiplier'])
  for (const trait of species.traits) {
    const rule = trait.rule
    if (!rule) continue
    for (const [key, value] of Object.entries(rule)) {
      const prev = out[key]
      if (value === undefined) continue
      if (typeof value === 'number') out[key] = mult.has(key) ? ((prev as number | undefined) ?? 1) * value : ((prev as number | undefined) ?? 0) + value
      else if (typeof value === 'boolean') out[key] = Boolean(prev) || value
      else if (Array.isArray(value)) out[key] = [...((prev as unknown[] | undefined) ?? []), ...value]
      else if (typeof value === 'object' && value !== null) out[key] = { ...((prev as Record<string, unknown> | undefined) ?? {}), ...(value as Record<string, unknown>) }
      else out[key] = value
    }
  }
  return out as SpeciesRule
}

export interface CreateHeroInput {
  id: string
  name: string
  speciesId: string
  classId: string
  /** The six free creation points, at most 3 on one attribute (03 §2.3). */
  freePoints?: Partial<Record<Attribute, number>>
  /** Points beyond the six: a wayfarer's grade (D-091, +1 per grade above D). */
  bonusFreePoints?: number
  /** Three Tier I skills; the chosen kit's recommended three (else the class's) when omitted. */
  starterSkillIds?: readonly string[]
  /** One of the class's starterKitOptions (D-099: the Warden's spear kit, the Blade's greatsword kit); the default kit when omitted or unknown. */
  starterKitId?: string
  /** The creation egg (03 §2.3: one of three at F); null for none yet. */
  eggPetId?: string | null
  petName?: string
  aiRule?: string
  /** How the hero looks (Phase 5); clamped to the species, or a look from a hash of the id when omitted. */
  look?: HeroLook
}

function requireClass(content: Content, id: string): ClassDef {
  const c = content.classes.get(id)
  if (!c) throw new Error(`unknown class ${id}`)
  return c
}

function requireSpecies(content: Content, id: string): SpeciesDef {
  const s = content.species.get(id)
  if (!s) throw new Error(`unknown species ${id}`)
  return s
}

export function creationAttributes(t: Tuning, species: SpeciesDef, cls: ClassDef, freePoints: Partial<Record<Attribute, number>> = {}, bonusPoints = 0): AttributeValues {
  const out: Record<Attribute, number> = { ...ALL_TENS }
  let spent = 0
  for (const a of ATTRIBUTES) {
    const free = freePoints[a] ?? 0
    if (free < 0 || free > t.attributes.creation.maxFreePerAttribute) throw new Error(`free points on ${a} must be 0–${t.attributes.creation.maxFreePerAttribute}`)
    spent += free
    out[a] = t.attributes.base + (species.attributeMods[a] ?? 0) + (cls.attributeMods[a] ?? 0) + free
  }
  if (spent > t.attributes.creation.freePoints + bonusPoints) throw new Error(`only ${t.attributes.creation.freePoints + bonusPoints} free points`)
  return out
}

const EMPTY_EQUIPMENT: Equipment = { mainHand: null, offHand: null, helmet: null, chest: null, legs: null, boots: null, gloves: null, ring: [null, null], talisman: null, relic: null }

/** Puts a kit item where it goes: an equipment slot when it has one and the slot is free, else the bag (stacking). */
function placeItem(equipment: Equipment, bag: ItemInstance[], def: ItemDef, inst: ItemInstance, classId: string): Equipment {
  const slot = def.slot
  // 08 §1: a second dual weapon (the Blade's kit dagger) is held in the off hand.
  if (slot === 'mainHand' && equipment.mainHand !== null && equipment.offHand === null && canHoldOffHand(def, classId)) return { ...equipment, offHand: inst }
  if (slot && slot !== 'pet') {
    if (slot === 'ring') {
      if (equipment.ring[0] === null) return { ...equipment, ring: [inst, equipment.ring[1]] }
      if (equipment.ring[1] === null) return { ...equipment, ring: [equipment.ring[0], inst] }
    } else if (equipment[slot] === null) return { ...equipment, [slot]: inst }
  }
  const existing = bag.findIndex((b) => b.itemId === inst.itemId && def.kind !== 'weapon' && def.kind !== 'armor' && def.kind !== 'shield')
  if (existing >= 0) bag[existing] = { ...bag[existing]!, quantity: bag[existing]!.quantity + inst.quantity }
  else bag.push(inst)
  return equipment
}

export function createHero(content: Content, t: Tuning, rng: Rng, input: CreateHeroInput): HeroRecord {
  const species = requireSpecies(content, input.speciesId)
  const cls = requireClass(content, input.classId)
  const rules = speciesRules(species)
  const attributes = creationAttributes(t, species, cls, input.freePoints, Math.max(0, input.bonusFreePoints ?? 0))
  const kitOption = input.starterKitId ? cls.starterKitOptions?.find((k) => k.id === input.starterKitId) : undefined
  const starters = input.starterSkillIds ?? kitOption?.starterSkillIds ?? cls.starterSkillIds
  if (starters.length !== 3) throw new Error('three starter skills')
  for (const id of starters) {
    const s = content.skills.get(id)
    if (!s || s.classId !== cls.id || s.tier !== 1) throw new Error(`${id} is not a Tier I ${cls.name} skill`)
  }
  let equipment: Equipment = EMPTY_EQUIPMENT
  const bag: ItemInstance[] = []
  const kitTable = t.equipment.starterKitQuantities as unknown as Record<string, number | string>
  const kitQuantities: Record<string, number> = {}
  for (const [k, v] of Object.entries(kitTable)) if (typeof v === 'number') kitQuantities[k] = v
  for (const itemId of kitOption?.starterKit ?? cls.starterKit) {
    const def = content.items.get(itemId)
    if (!def) throw new Error(`starter kit item ${itemId} is missing`)
    // The kit is a unique id list; 08 §12's "2 Small HP Potions, 2 Torches" come from tuning's quantities (D-069).
    const quantity = def.consumable ? (kitQuantities[itemId] ?? 1) : 1
    equipment = placeItem(equipment, bag, def, createItemInstance(content, rng, itemId, { quantity }), cls.id)
  }
  const startRank = rules.fieldSkillStartRank ?? 1
  const fieldSkills = Object.fromEntries(
    FIELD_SKILLS.map((f) => {
      const affinity = cls.fieldSkillAffinities.find((a) => a.fieldSkill === f)?.rankBonus ?? 0
      return [f, { rank: Math.min(10, Math.max(startRank, 1 + affinity)), xp: 0 }]
    }),
  ) as Record<FieldSkill, { rank: number; xp: number }>
  let petInstance: PetInstance | null = null
  if (input.eggPetId) {
    const pet = content.pets.get(input.eggPetId)
    if (!pet) throw new Error(`unknown pet ${input.eggPetId}`)
    petInstance = { petId: pet.id, name: input.petName ?? pet.name, grade: 'F', level: 1, xp: 0, bondStars: 0, traitRank: 1, stance: pet.roleLean, ranchImport: null }
  }
  // 03 §7.3: four active slots and two passive slots; a starter passive (the Blade's Flowing Guard, the Ranger's Keen
  // Eyes) goes to a passive slot, the actives keep their order.
  const starterActives = starters.filter((id) => content.skills.get(id)?.type !== 'passive')
  const starterPassives = starters.filter((id) => content.skills.get(id)?.type === 'passive')
  const loadout: Loadout = { actives: [starterActives[0] ?? null, starterActives[1] ?? null, starterActives[2] ?? null, null], passives: [starterPassives[0] ?? null, starterPassives[1] ?? null], stance: petInstance?.stance ?? 'fierce' }
  const skills = starters.map((skillId) => ({ skillId, rank: 1, xp: 0 }))
  if (rules.innateSkillId) skills.push({ skillId: rules.innateSkillId, rank: 1, xp: 0 })
  return {
    saveVersion: SAVE_VERSION,
    id: input.id,
    name: input.name,
    speciesId: species.id,
    classId: cls.id,
    level: 1,
    battleXp: 0,
    attributes,
    attributeXp: {},
    creationValues: attributes,
    freePointsSpent: Object.values(input.freePoints ?? {}).reduce((s, v) => s + (v ?? 0), 0),
    skills,
    loadout,
    loadoutPresets: [],
    fieldSkills,
    equipment,
    naturalArmor: rules.naturalArmorBase ? { defense: rules.naturalArmorBase, itemLevel: 1, xp: 0, affinities: [] } : null,
    bag,
    gold: 0,
    petInstance,
    aiRule: input.aiRule ?? cls.aiRuleDefault,
    titles: [],
    hardcore: false,
    stats: { kills: 0, delves: 0, deaths: 0 },
    look: input.look ? clampLook(input.look, species, input.id) : defaultLook(input.id, species),
  }
}

/* ---------- hero record → stat inputs → actor ---------- */

const RANGED_TYPES = new Set(['bow', 'longbow', 'shortbow', 'crossbow', 'throwingKnife'])
const REACH_TYPES = new Set(['spear', 'whip'])
const FOCUS_TYPES = new Set(['staff', 'wand', 'focus'])

export interface HeroLoadView {
  inputs: StatInputs
  equipment: HeroEquipment
  weapon: HeroActorData['weapon']
  shieldBlock: number
  relicUses: number
  /** Custom lines from worn gear (affixes, unique powers): hooks on the fight actor; sourceId = the affix id or the item id. */
  hookLines: { line: Effect; sourceId: string; itemId: string; slot: string }[]
}

function equipped(content: Content, inst: ItemInstance | null): EquippedItem | null {
  if (!inst) return null
  const def = content.items.get(inst.itemId)
  return def ? { def, inst } : null
}

function addInto(target: Record<string, number>, lines: Partial<Record<string, number>>): void {
  for (const [k, v] of Object.entries(lines)) if (v) target[k] = (target[k] ?? 0) + v
}

/** Everything the derived-stat formulas need, read from the hero's gear through the item module. */
export function heroLoad(content: Content, t: Tuning, hero: HeroRecord): HeroLoadView {
  const species = requireSpecies(content, hero.speciesId)
  const cls = requireClass(content, hero.classId)
  const rules = speciesRules(species)
  const eq = hero.equipment
  const main = equipped(content, eq.mainHand)
  const off = equipped(content, eq.offHand)
  const armorSlots = ['helmet', 'chest', 'legs', 'boots', 'gloves'] as const
  const flat: Record<string, number> = {}
  const percent: Record<string, number> = {}
  const attributeBonus: Record<string, number> = {}
  const pieces: ArmorPieceLoad[] = []
  let armorDefense = 0
  const equipment: HeroEquipment = { ring: [equipped(content, eq.ring[0]), equipped(content, eq.ring[1])] }
  const onHit: Effect[] = []
  const hookLines: HeroLoadView['hookLines'] = []
  const consider = (item: EquippedItem | null, slot: Slot) => {
    if (!item) return
    const s = effectiveItemStats(content, t, item.def, item.inst)
    for (const h of s.hookLines) hookLines.push({ line: h.line, sourceId: h.affixId ?? item.def.id, itemId: item.def.id, slot })
    addInto(percent, s.percentStats)
    addInto(attributeBonus, s.attributeBonuses)
    if (slot !== 'ring') equipment[slot as Exclude<Slot, 'ring' | 'pet'>] = item
    if (slot === 'mainHand' || slot === 'offHand') onHit.push(...s.onHit)
    const stats = { ...s.stats }
    if (slot === 'mainHand' || slot === 'offHand') {
      // The weapon's attack and penalty are the formula's own terms; its other lines are flat bonuses.
      if (slot === 'mainHand') {
        delete stats.attackPhys
        delete stats.attackSpell
        delete stats.speed
      }
      if (slot === 'offHand') {
        delete stats.block
        if (item.def.kind === 'weapon') delete stats.attackPhys
      }
      if (s.accuracyPenalty) flat.accuracy = (flat.accuracy ?? 0) - s.accuracyPenalty
    }
    if ((armorSlots as readonly string[]).includes(slot)) {
      armorDefense += stats.defense ?? 0
      delete stats.defense
      // A piece's Speed line below zero is its share of the family penalty; absent, the 08 §2 share table applies (D-057).
      const speedLine = stats.speed ?? 0
      delete stats.speed
      const family = (item.def.armorFamily ?? cls.armorFamily) as keyof Tuning['equipment']['armorSpeedPenaltyShares']
      const shares = t.equipment.armorSpeedPenaltyShares[family]
      const tableShare = shares && typeof shares === 'object' ? ((shares as Record<string, number>)[slot] ?? 0) : 0
      pieces.push({ penaltyShare: speedLine < 0 ? -speedLine : tableShare, strengthRequirement: item.def.requirements.strength })
      if (speedLine > 0) flat.speed = (flat.speed ?? 0) + speedLine
    }
    addInto(flat, stats)
  }
  consider(main, 'mainHand')
  consider(off, 'offHand')
  for (const slot of armorSlots) consider(equipped(content, eq[slot]), slot)
  consider(equipment.ring[0] ?? null, 'ring')
  consider(equipment.ring[1] ?? null, 'ring')
  consider(equipped(content, eq.talisman), 'talisman')
  consider(equipped(content, eq.relic), 'relic')
  // Set bonuses (08 §6; pass B, Phase 7): stat lines join the gear's, custom lines become hooks like a unique power's.
  const sets = setBonusLoad(content, t, [eq.mainHand, eq.offHand, eq.helmet, eq.chest, eq.legs, eq.boots, eq.gloves, eq.ring[0], eq.ring[1], eq.talisman, eq.relic])
  addInto(flat, sets.stats)
  addInto(percent, sets.percentStats)
  addInto(attributeBonus, sets.attributeBonuses)
  for (const sl of sets.hookLines) hookLines.push({ line: sl.line, sourceId: sl.setId, itemId: sl.setId, slot: 'set' })
  if (hero.naturalArmor) flat.defense = (flat.defense ?? 0) + hero.naturalArmor.defense

  const mainStats = main ? effectiveItemStats(content, t, main.def, main.inst) : null
  const offStats = off ? effectiveItemStats(content, t, off.def, off.inst) : null
  const mainIsFocus = main ? FOCUS_TYPES.has(main.def.weaponType ?? '') || main.def.kind === 'focus' : false
  const censer = main?.def.weaponType === 'censer'
  const weaponAttack = mainStats?.stats.attackPhys ?? (mainIsFocus ? 0 : 0)
  const focusPower = (mainStats?.stats.attackSpell ?? (mainIsFocus || censer ? (mainStats?.stats.attackPhys ?? 0) : 0)) + (off?.def.kind === 'focus' ? (offStats?.stats.attackSpell ?? offStats?.stats.attackPhys ?? 0) : 0)
  const weaponSpeedLine = mainStats?.stats.speed ?? 0
  const mainWeight = main?.def.weight ?? 1000
  const offIsWeapon = off?.def.kind === 'weapon'
  const offAttack = offIsWeapon ? (offStats?.stats.attackPhys ?? 0) : 0
  const attributes: Record<Attribute, number> = { ...hero.attributes }
  for (const a of ATTRIBUTES) attributes[a] += attributeBonus[a] ?? 0

  const speciesStats: SpeciesStatRules = {
    speedBase: rules.speedBase,
    hpMultiplier: rules.hpMultiplier,
    manaMultiplier: rules.manaMultiplier,
    carryMultiplier: rules.carryMultiplier,
    dodgeBonus: rules.dodgeBonus,
    dodgeCap: rules.dodgeCap,
    fortuneBonus: rules.fortuneBonus,
    detectionBonus: rules.detectionBonus,
    armorPenaltyMultiplier: rules.armorPenaltyMultiplier?.[cls.armorFamily],
    heavyWeaponStrengthExtra: rules.heavyWeaponStrengthExtra,
  }
  const inputs: StatInputs = {
    attributes,
    level: hero.level,
    pool: cls.pool,
    offenseAttribute: cls.pool === 'mana' ? 'wisdom' : 'strength',
    weapon: {
      attack: weaponAttack,
      focusPower,
      speedPenalty: Math.max(0, -weaponSpeedLine) + Math.max(0, -(offStats?.stats.speed ?? 0)),
      strengthRequirement: main?.def.requirements.strength ?? 0,
      wisdomRequirement: main?.def.requirements.wisdom ?? 0,
      heavy: mainWeight === t.combat.weights.heavy,
    },
    armor: { defense: armorDefense, pieces },
    shieldBlock: off?.def.kind === 'shield' ? (offStats?.stats.block ?? 0) : 0,
    flat: flat as StatBonuses,
    percent: percent as StatBonuses,
    species: speciesStats,
  }
  const attackForOff = Math.max(1, weaponAttack + 2 * attributes.strength)
  const weapon: HeroActorData['weapon'] = {
    type: main?.def.weaponType ?? null,
    damageType: main?.def.damageType ?? 'blunt',
    weight: mainWeight,
    hands: main?.def.hands ?? 1,
    dual: Boolean(main && offIsWeapon && main.def.hands === 1),
    offHandAttackPercent: offIsWeapon ? roundHalfUp((offAttack * 50) / attackForOff) : 0,
    heavy: mainWeight === t.combat.weights.heavy,
    ranged: RANGED_TYPES.has(main?.def.weaponType ?? '') || mainIsFocus,
    reach: REACH_TYPES.has(main?.def.weaponType ?? ''),
    onHit,
  }
  const relic = equipped(content, eq.relic)
  return { inputs, equipment, weapon, shieldBlock: inputs.shieldBlock, relicUses: relic?.def.active?.usesPerFight ?? 0, hookLines }
}

export interface BuildHeroOptions {
  id: string
  row: FightRow
  /** HP carried into the fight (percent of max); 100 when fresh. */
  hpPercent?: number
  poolPercent?: number
  aiRule?: string
  /**
   * Floor-limited passives (D-099: Undying Rage once per floor, Deathless twice): skill id → times its limited effect
   * has fired earlier on this floor (progress.ts floorUsesFor). The passive's hook reads it as data.floorUsed.
   */
  floorUses?: Readonly<Record<string, number>>
}

export function buildHeroActor(content: Content, t: Tuning, hero: HeroRecord, opts: BuildHeroOptions): Actor {
  const species = requireSpecies(content, hero.speciesId)
  const cls = requireClass(content, hero.classId)
  const rules = speciesRules(species)
  const load = heroLoad(content, t, hero)
  const base = deriveStats(t, load.inputs)
  const ranks: Record<string, number> = {}
  for (const s of hero.skills) ranks[s.skillId] = s.rank
  const knowsUltimate = hero.skills.some((s) => s.skillId === cls.ultimateSkillId)
  const poolMax = cls.pool === 'stamina' ? base.stamina : base.mana
  const hp = Math.max(1, roundHalfUp((base.hp * (opts.hpPercent ?? 100)) / 100))
  const data: HeroActorData = {
    heroId: hero.id,
    classId: cls.id,
    speciesId: species.id,
    pool: cls.pool,
    actives: [...hero.loadout.actives],
    passives: [...hero.loadout.passives],
    ultimateId: knowsUltimate ? cls.ultimateSkillId : null,
    ranks,
    weapon: load.weapon,
    armorFamily: cls.armorFamily,
    shieldBlock: load.shieldBlock,
    equipment: load.equipment,
    bag: [...hero.bag],
    aiRule: opts.aiRule ?? hero.aiRule,
    relicUsesLeft: load.relicUses,
    stanceChangeUsed: false,
    species: {
      darkAccuracyImmune: rules.darkAccuracyImmune ?? false,
      lightBandShift: rules.lightBandShift ?? 0,
      immunities: [...(rules.immunities ?? [])],
      statusResist: { ...(rules.statusResist ?? {}) },
      statusDurationDelta: { ...(rules.statusDurationDelta ?? {}) },
      appliedDurationMultiplier: { ...(rules.appliedDurationMultiplier ?? {}) },
      resist: { ...(rules.resist ?? {}) },
      weak: { ...(rules.weak ?? {}) },
      forcedRowMoveImmune: rules.forcedRowMoveImmune ?? false,
      damageMultiplierBelowHpPercent: rules.damageMultiplierBelowHpPercent ?? null,
      enemyAccuracyBySize: { ...(rules.enemyAccuracyBySize ?? {}) },
    },
  }
  const actor: Actor = {
    id: opts.id,
    name: hero.name,
    side: 'party',
    kind: 'hero',
    row: opts.row,
    level: hero.level,
    hp,
    maxHp: base.hp,
    pool: roundHalfUp((poolMax * (opts.poolPercent ?? 100)) / 100),
    poolMax,
    poolKind: cls.pool,
    momentum: 0,
    attributes: { ...load.inputs.attributes },
    base,
    energy: 0,
    charging: null,
    statuses: [],
    modifiers: [],
    hooks: [],
    guarding: false,
    downed: false,
    downedTurnsLeft: 0,
    fallen: false,
    fled: false,
    gone: false,
    grabbedBy: null,
    grabDamage: 0,
    actedThisRound: false,
    lastTargetId: null,
    tally: { actions: 0, hitsLanded: 0, hitsTaken: 0, blocks: 0, damageDealt: 0, damageTaken: 0, healingDone: 0, kills: 0, skillUses: {} },
    hero: data,
  }
  applyPassives(content, actor, opts.floorUses)
  // Worn gear's custom lines (Spined, of Renewal, a unique power) and the species' trait lines (Breath, Thick Hide) ride on the actor (D-071).
  for (const h of load.hookLines) installHook(actor, h.line, h.sourceId, { replace: false, data: { itemId: h.itemId, slot: h.slot } })
  for (const trait of species.traits) {
    for (const line of trait.effects ?? []) {
      if (line.kind === 'custom' && line.customId) installHook(actor, line, species.id, { replace: false, data: { trait: trait.id } })
      else if ((line.kind === 'buffStat' || line.kind === 'debuffStat') && line.stat) actor.modifiers.push({ stat: line.stat, amount: line.amount ?? 0, percent: line.percent ?? 0, turnsLeft: 9999, sourceId: trait.id })
    }
  }
  return actor
}

/**
 * Loadout passives (03 §7.2: two passive slots): their stat lines sit on the actor for the whole fight and their
 * custom lines become persistent hooks (hooks.ts), both at the passive's rank. Other line kinds on a passive are
 * ignored here (a passive that applies a status is a design error the linter should catch).
 */
export function applyPassives(content: Content, actor: Actor, floorUses: Readonly<Record<string, number>> = {}): void {
  const h = actor.hero
  if (!h) return
  for (const id of h.passives) {
    if (!id) continue
    const skill = content.skills.get(id)
    if (!skill || skill.type !== 'passive') continue
    const rank = h.ranks[id] ?? 1
    const pct = rankEffectPercent(skill, rank)
    for (const line of linesAtRank(skill, rank)) {
      if ((line.kind === 'buffStat' || line.kind === 'debuffStat') && line.stat) actor.modifiers.push({ stat: line.stat, amount: roundHalfUp(((line.amount ?? 0) * pct) / 100), percent: roundHalfUp(((line.percent ?? 0) * pct) / 100), turnsLeft: 9999, sourceId: skill.id })
      // replace: false — two passives (or two lines of one) may share a customId (Kindling and Permafrost's school-damage-percent) and both hold.
      else if (line.kind === 'custom' && line.customId) installHook(actor, line, actor.id, { sourceSkillId: skill.id, replace: false, ...(floorUses[skill.id] ? { data: { floorUsed: floorUses[skill.id]! } } : {}) })
    }
  }
}

/** The card's derived stats for a hero record. */
export function heroStats(content: Content, t: Tuning, hero: HeroRecord): Record<DerivedStat, number> {
  return deriveStats(t, heroLoad(content, t, hero).inputs)
}

/**
 * A hero's Detection with the loadout passives' `buffStat detection` lines at their rank (Keen Eyes, Snare-Sense), as
 * the fight applies them (applyPassives) and the delve counts them out of combat (delve.ts partyDetection): the flat
 * lines on the derived stat, then the percent lines. `base` is the derived Detection (heroStats) when given.
 */
export function heroDetection(content: Content, t: Tuning, hero: HeroRecord, base = heroStats(content, t, hero).detection): number {
  let flat = 0
  let pct = 0
  for (const id of hero.loadout.passives) {
    const skill = id ? content.skills.get(id) : undefined
    if (!skill || skill.type !== 'passive') continue
    const rank = hero.skills.find((k) => k.skillId === skill.id)?.rank ?? 1
    const scale = rankEffectPercent(skill, rank)
    for (const line of linesAtRank(skill, rank)) {
      if (line.kind !== 'buffStat' || line.stat !== 'detection') continue
      flat += roundHalfUp(((line.amount ?? 0) * scale) / 100)
      pct += roundHalfUp(((line.percent ?? 0) * scale) / 100)
    }
  }
  return roundHalfUp(((base + flat) * (100 + pct)) / 100)
}

/**
 * The hero card's numbers (03 §2.4): the derived stats, with Detection read as the delve reads it — the loadout
 * passives counted (heroDetection) — so the card and the traps agree (Phase 8; the card used to leave passives out).
 */
export function heroCardStats(content: Content, t: Tuning, hero: HeroRecord): Record<DerivedStat, number> {
  const stats = heroStats(content, t, hero)
  return { ...stats, detection: heroDetection(content, t, hero, stats.detection) }
}

/** Total skill ranks → level (03 §2.2). */
/**
 * Final Fantasy-style level-ups (D-082): reaching level L adds `attributePointsPerLevel` points to the class's bonus
 * attributes in turn (largest bonus first, then the attribute order), and +1 Vitality on every level divisible by
 * `vitalityEveryLevels`. The gains raise the creation values too, so the use soft cap (§5.3) moves with them.
 * HP also grows by derived.hp.perLevel through the level itself.
 */
export function levelUpGains(content: Content, t: Tuning, classId: string, fromLevel: number, toLevel: number): Partial<Record<Attribute, number>> {
  const cls = content.classes.get(classId)
  const order = ATTRIBUTES.filter((a) => (cls?.attributeMods[a] ?? 0) > 0).sort((a, b) => (cls?.attributeMods[b] ?? 0) - (cls?.attributeMods[a] ?? 0))
  const gains: Partial<Record<Attribute, number>> = {}
  const per = t.xp.heroLevel.attributePointsPerLevel.value
  const vitEvery = t.xp.heroLevel.vitalityEveryLevels.value
  for (let level = fromLevel + 1; level <= toLevel; level++) {
    for (let k = 0; k < per && order.length > 0; k++) {
      const a = order[((level - 2) * per + k) % order.length]!
      gains[a] = (gains[a] ?? 0) + 1
    }
    if (vitEvery > 0 && level % vitEvery === 0) gains.vitality = (gains.vitality ?? 0) + 1
  }
  return gains
}

/** Applies battle XP already added to `hero.battleXp`: the new level and its attribute growth (D-082). */
export function applyBattleXpLevel(content: Content, t: Tuning, hero: HeroRecord): HeroRecord {
  const level = heroLevelForXp(t, hero.battleXp)
  if (level <= hero.level) return hero
  const gains = levelUpGains(content, t, hero.classId, hero.level, level)
  const attributes = { ...hero.attributes }
  const creationValues = { ...hero.creationValues }
  for (const [a, v] of Object.entries(gains) as [Attribute, number][]) {
    attributes[a] += v
    creationValues[a] += v
  }
  return { ...hero, level, attributes, creationValues }
}

/** A hero raised to a level with its growth applied (the balance runner's "grinded" heroes; a debug deep link). */
export function heroAtLevel(content: Content, t: Tuning, hero: HeroRecord, level: number): HeroRecord {
  return applyBattleXpLevel(content, t, { ...hero, battleXp: Math.max(hero.battleXp, battleXpForLevel(t, level)) })
}

/**
 * Takes levels back (D-089: a raise from the dead costs levels): exactly what those levels gave comes off — the
 * class's attribute gains and the even-level Vitality, from the attributes and the creation values alike — and
 * battle XP drops to the start of the new level. Skills and ranks, gear and use-grown attributes stay. Never below
 * level 1 (a level-1 hero loses the XP toward level 2).
 */
export function loseLevels(content: Content, t: Tuning, hero: HeroRecord, levels: number): HeroRecord {
  const to = Math.max(1, hero.level - Math.max(0, Math.floor(levels)))
  const gains = to < hero.level ? levelUpGains(content, t, hero.classId, to, hero.level) : {}
  const attributes = { ...hero.attributes }
  const creationValues = { ...hero.creationValues }
  for (const [a, v] of Object.entries(gains) as [Attribute, number][]) {
    attributes[a] = Math.max(1, attributes[a] - v)
    creationValues[a] = Math.max(1, creationValues[a] - v)
  }
  return { ...hero, level: to, battleXp: battleXpForLevel(t, to), attributes, creationValues }
}

/** Adds battle XP (a legacy, D-090) and applies the levels it reaches. */
export function addBattleXp(content: Content, t: Tuning, hero: HeroRecord, xp: number): HeroRecord {
  return applyBattleXpLevel(content, t, { ...hero, battleXp: hero.battleXp + Math.max(0, Math.floor(xp)) })
}

/** Superseded by D-082 (the level follows battle XP); the ranks' milestone reading of 03 §2.2 rev. 1. */
export function heroLevelFromSkills(t: Tuning, hero: HeroRecord): number {
  const total = hero.skills.reduce((s, k) => s + k.rank, 0)
  return Math.max(1, Math.floor(total / t.derived.level.skillRanksPerLevel))
}
