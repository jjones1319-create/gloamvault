import type { Content } from './content.ts'
import type { Actor, EquippedItem, FightRow, HeroActorData, HeroEquipment } from './fight-types.ts'
import { createItemInstance, effectiveItemStats } from './items.ts'
import type { Rng } from './rng.ts'
import { ALL_TENS, deriveStats, roundHalfUp, type ArmorPieceLoad, type AttributeValues, type SpeciesStatRules, type StatBonuses, type StatInputs } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { ClassDef, Effect, Equipment, HeroRecord, ItemDef, ItemInstance, Loadout, PetInstance, SpeciesDef, SpeciesRule } from './types/content.ts'
import { ATTRIBUTES, FIELD_SKILLS, type Attribute, type DerivedStat, type FieldSkill, type Slot } from './types/enums.ts'

/**
 * Heroes (03-GAME-DESIGN §2.3, §6.1, §7.3): creation from species × class × six free points, the starter kit and
 * the three starter skills; and the hero record → fight actor step, which reads every worn item through the item
 * module so wear, +N and affixes all count.
 */
export const SAVE_VERSION = 1

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
  /** Three Tier I skills; the class's recommended three when omitted. */
  starterSkillIds?: readonly string[]
  /** The creation egg (03 §2.3: one of three at F); null for none yet. */
  eggPetId?: string | null
  petName?: string
  aiRule?: string
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

export function creationAttributes(t: Tuning, species: SpeciesDef, cls: ClassDef, freePoints: Partial<Record<Attribute, number>> = {}): AttributeValues {
  const out: Record<Attribute, number> = { ...ALL_TENS }
  let spent = 0
  for (const a of ATTRIBUTES) {
    const free = freePoints[a] ?? 0
    if (free < 0 || free > t.attributes.creation.maxFreePerAttribute) throw new Error(`free points on ${a} must be 0–${t.attributes.creation.maxFreePerAttribute}`)
    spent += free
    out[a] = t.attributes.base + (species.attributeMods[a] ?? 0) + (cls.attributeMods[a] ?? 0) + free
  }
  if (spent > t.attributes.creation.freePoints) throw new Error(`only ${t.attributes.creation.freePoints} free points`)
  return out
}

const EMPTY_EQUIPMENT: Equipment = { mainHand: null, offHand: null, helmet: null, chest: null, legs: null, boots: null, gloves: null, ring: [null, null], talisman: null, relic: null }

/** Puts a kit item where it goes: an equipment slot when it has one and the slot is free, else the bag (stacking). */
function placeItem(equipment: Equipment, bag: ItemInstance[], def: ItemDef, inst: ItemInstance): Equipment {
  const slot = def.slot
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
  const attributes = creationAttributes(t, species, cls, input.freePoints)
  const starters = input.starterSkillIds ?? cls.starterSkillIds
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
  for (const itemId of cls.starterKit) {
    const def = content.items.get(itemId)
    if (!def) throw new Error(`starter kit item ${itemId} is missing`)
    // The kit is a unique id list; 08 §12's "2 Small HP Potions, 2 Torches" come from tuning's quantities (D-069).
    const quantity = def.consumable ? (kitQuantities[itemId] ?? 1) : 1
    equipment = placeItem(equipment, bag, def, createItemInstance(content, rng, itemId, { quantity }))
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
  const loadout: Loadout = { actives: [starters[0] ?? null, starters[1] ?? null, starters[2] ?? null, null], passives: [null, null], stance: petInstance?.stance ?? 'fierce' }
  const skills = starters.map((skillId) => ({ skillId, rank: 1, xp: 0 }))
  if (rules.innateSkillId) skills.push({ skillId: rules.innateSkillId, rank: 1, xp: 0 })
  return {
    saveVersion: SAVE_VERSION,
    id: input.id,
    name: input.name,
    speciesId: species.id,
    classId: cls.id,
    level: 1,
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
  const consider = (item: EquippedItem | null, slot: Slot) => {
    if (!item) return
    const s = effectiveItemStats(content, t, item.def, item.inst)
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
  return { inputs, equipment, weapon, shieldBlock: inputs.shieldBlock, relicUses: relic?.def.active?.usesPerFight ?? 0 }
}

export interface BuildHeroOptions {
  id: string
  row: FightRow
  /** HP carried into the fight (percent of max); 100 when fresh. */
  hpPercent?: number
  poolPercent?: number
  aiRule?: string
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
  return {
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
}

/** The card's derived stats for a hero record. */
export function heroStats(content: Content, t: Tuning, hero: HeroRecord): Record<DerivedStat, number> {
  return deriveStats(t, heroLoad(content, t, hero).inputs)
}

/** Total skill ranks → level (03 §2.2). */
export function heroLevelFromSkills(t: Tuning, hero: HeroRecord): number {
  const total = hero.skills.reduce((s, k) => s + k.rank, 0)
  return Math.max(1, Math.floor(total / t.derived.level.skillRanksPerLevel))
}
