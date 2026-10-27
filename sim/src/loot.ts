import type { Content } from './content.ts'
import { hiddenFindChance } from './detection.ts'
import { buildGradeTable, rollGrade, type ShapeLine } from './grades.ts'
import { createItemInstance, stoneFamilyFor, type StoneFamily } from './items.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { GradeShape, IntRange, ItemDef, ItemInstance, ItemSetDef, LootTableDef, MonsterDef } from './types/content.ts'
import { GRADES, gradeIndex, gradeShift, isMember, type Grade, type ItemKind, type LightBand } from './types/enums.ts'

/**
 * What a fight, a strongroom and an in-dungeon chest give (03-GAME-DESIGN §6.2, §8.3; 06-MONSTERS §1, §8.5;
 * 07-DUNGEONS §2.7; 08-ITEMS §10.3, §11). Every roll comes from the loot table of the floor band plus tuning.json;
 * the few per-fight constants 06/08 state in prose and tuning.json does not yet carry sit in LOOT_RULES below,
 * named so they can move into tuning without a formula change.
 */

/** Prose constants not yet in content/tuning.json (06 §8.5, 06 §1, 08 §10.1, 08 §11). Tuning starting points. */
export const LOOT_RULES = {
  /** The table's gold range is per fight; one monster's baseline is a third of it (an ordinary pack is three). */
  encounterTypicalSize: 3,
  /** +10% fight gold per elite affix in the room (06 §8.5). */
  goldPercentPerAffix: 10,
  /** ×1.25 fight gold in a Monster room (06 §8.5). */
  monsterRoomGoldPercent: 125,
  /** A champion with no elite affix on file still pays its gold as one would (06 §2: ×3). */
  championGoldMultiplierDefault: 3,
  /** Affixed elites roll parts twice (06 §1). */
  championPartRolls: 2,
  /** Named uniques are 10% of any roll at a grade that has them (08 §10.1). */
  namedUniquePercent: 10,
  /** The Skeleton Key's item id (08 §4, 07 §2.7). */
  skeletonKeyItemId: 'skeleton-key',
} as const

/** The item kinds a fight's gear item, a chest's item and a dupe check mean by "gear". */
export const GEAR_KINDS = ['weapon', 'armor', 'shield', 'focus', 'ring', 'talisman', 'relic'] as const satisfies readonly ItemKind[]

// ---------------------------------------------------------------------------------------------------------------
// Tables and shapes
// ---------------------------------------------------------------------------------------------------------------

/** The loot table of a dungeon whose `floorBand` covers the floor; throws when the dungeon's tables do not tile it. */
export function lootTableForFloor(content: Content, dungeonId: string, floor: number): LootTableDef {
  for (const table of content.lootTables.values()) {
    if (table.dungeonId === dungeonId && table.floorBand.min <= floor && floor <= table.floorBand.max) return table
  }
  throw new Error(`loot: no loot table of "${dungeonId}" covers floor ${floor}`)
}

/** A loot table's five-number shape as grade-table lines (the fold of a missing lower grade is already in `centre`). */
export function shapeLinesOf(shape: GradeShape): ShapeLine[] {
  return [
    { offset: -1, weight: shape.minus1 },
    { offset: 0, weight: shape.centre },
    { offset: 1, weight: shape.plus1 },
    { offset: 2, weight: shape.plus2 },
    { offset: 3, weight: shape.plus3 },
  ]
}

/** Rolls a grade on the floor-drop shape around `centreGrade`, Luck shifting the upper lines; God never rolls. */
export function rollDropGrade(t: Tuning, rng: Rng, shape: GradeShape, centreGrade: Grade, luck: number): Grade {
  const table = buildGradeTable(t, centreGrade, shapeLinesOf(shape), { luck })
  return rollGrade(rng, table) as Grade
}

// ---------------------------------------------------------------------------------------------------------------
// Picking a gear item
// ---------------------------------------------------------------------------------------------------------------

export type ItemFilter = (def: ItemDef) => boolean

function setCovers(set: ItemSetDef, grade: Grade): boolean {
  const g = gradeIndex(grade)
  return gradeIndex(set.gradeMin) <= g && (set.gradeMax === null || g <= gradeIndex(set.gradeMax))
}

function classAllowed(def: ItemDef, classId: string | undefined): boolean {
  return classId === undefined || def.classLock.length === 0 || def.classLock.includes(classId)
}

/**
 * A random gear item of a grade (08 §10.1, §11): set pieces first at their set's `dropChance` (sets covering the
 * grade and open to the class), named uniques 10% at grades that have them, else an ordinary piece uniformly. When
 * no item of the grade passes a filter the grade steps down until one does; the filters are tried strictest first
 * (a slot-and-family armor filter, then its relaxations). God items never come out of here. null when nothing fits.
 */
export function pickGearItem(content: Content, rng: Rng, grade: Grade, filters: readonly ItemFilter[] = [], classId?: string): ItemDef | null {
  const tried: readonly ItemFilter[] = filters.length === 0 ? [() => true] : filters
  for (const filter of tried) {
    for (let g = Math.min(gradeIndex(grade), gradeIndex('SS')); g >= 0; g--) {
      const at = GRADES[g] as Grade
      const candidates: ItemDef[] = []
      for (const kind of GEAR_KINDS) {
        for (const def of content.itemsByKind.get(kind) ?? []) {
          if (def.grade === at && classAllowed(def, classId) && filter(def)) candidates.push(def)
        }
      }
      if (candidates.length === 0) continue
      const setPieces = candidates.filter((d) => {
        if (d.setId === null) return false
        const set = content.sets.get(d.setId)
        return set !== undefined && setCovers(set, at) && (classId === undefined || set.classIds.length === 0 || set.classIds.includes(classId))
      })
      const uniques = candidates.filter((d) => d.unique && d.setId === null)
      const ordinary = candidates.filter((d) => !d.unique && d.setId === null)
      if (setPieces.length > 0) {
        const setIds = [...new Set(setPieces.map((d) => d.setId as string))].sort()
        const set = content.sets.get(rng.pick(setIds))
        if (set !== undefined && rng.pct(set.dropChance)) return rng.pick(setPieces.filter((d) => d.setId === set.id))
      }
      if (uniques.length > 0 && rng.pct(LOOT_RULES.namedUniquePercent)) return rng.pick(uniques)
      if (ordinary.length > 0) return rng.pick(ordinary)
      return rng.pick(candidates)
    }
  }
  return null
}

/** The first consumable of the band's list, by id, that exists; the table's `itemIds` are rolled uniformly. */
function pickConsumable(content: Content, rng: Rng, table: LootTableDef): ItemInstance | null {
  const ids = table.consumableDrop.itemIds.filter((id) => content.items.has(id))
  if (ids.length === 0) return null
  return createItemInstance(content, rng, rng.pick(ids))
}

function kebab(family: StoneFamily): string {
  return family.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/** The +N stone item of a grade's family: by id (`whetstone`, `honing-oil`, `star-grit`) or by the stone's own grade sitting in the family's range; the first match in id order. */
export function stoneItemFor(content: Content, t: Tuning, grade: Grade): ItemDef | null {
  const family = stoneFamilyFor(t, grade)
  const id = kebab(family)
  const grades: readonly string[] = t.equipment.plusN.stonesByGrade[family]
  const stones = content.itemsByKind.get('stone') ?? []
  return stones.find((s) => s.id === id || s.id.startsWith(`${id}-`)) ?? stones.find((s) => grades.includes(s.grade)) ?? null
}

// ---------------------------------------------------------------------------------------------------------------
// Fight loot (06 §1, §8.5; 08 §11)
// ---------------------------------------------------------------------------------------------------------------

export interface FightMonster {
  def: MonsterDef
  level: number
  champion: boolean
  eliteAffixIds: readonly string[]
  /** Its marked limb was broken in the fight: the rare roll doubles. */
  partBroken: boolean
}

export interface FightLootInput {
  dungeonId: string
  floor: number
  monsters: readonly FightMonster[]
  lightBand: LightBand
  /** The best Luck in the party (the roller). */
  luck: number
  knobs?: { goldPercent?: number }
  isMonsterRoom?: boolean
}

export interface PartDrop {
  /** A material item id (common) or a rare part's item id. */
  itemId: string
  quantity: number
  rare: boolean
}

export interface FightLoot {
  gold: number
  items: ItemInstance[]
  parts: PartDrop[]
  consumables: ItemInstance[]
  stones: ItemInstance[]
  /** A hunter's kill drops a Large chest (08 §10.3). */
  hunterChest: DungeonChest | null
  table: LootTableDef
}

function championGoldMultiplier(content: Content, m: FightMonster): number {
  if (!m.champion) return 1
  let best = 0
  for (const id of m.eliteAffixIds) best = Math.max(best, content.eliteAffixes.get(id)?.goldMultiplier ?? 0)
  return best > 0 ? best : LOOT_RULES.championGoldMultiplierDefault
}

/** Gold per fight (06 §8.5): Σ(baseline × gold×) × (1 + 0.1 per affix) × 1.25 in a Monster room × the preset's gold knob. */
export function fightGold(content: Content, rng: Rng, table: LootTableDef, input: FightLootInput): number {
  const fightRoll = rng.range(table.goldRange.min, table.goldRange.max)
  let multiplierSum = 0
  let affixes = 0
  for (const m of input.monsters) {
    multiplierSum += m.def.goldMultiplier * championGoldMultiplier(content, m)
    affixes += m.eliteAffixIds.length
  }
  const affixPct = 100 + LOOT_RULES.goldPercentPerAffix * affixes
  const roomPct = input.isMonsterRoom ? LOOT_RULES.monsterRoomGoldPercent : 100
  const knobPct = input.knobs?.goldPercent ?? 100
  return roundHalfUp((((((fightRoll * multiplierSum) / LOOT_RULES.encounterTypicalSize) * affixPct) / 100) * roomPct * knobPct) / 10_000)
}

function rollDrop(rng: Rng, chance: number, quantity: IntRange, rolls: number): number {
  let total = 0
  for (let i = 0; i < rolls; i++) if (rng.pct(chance)) total += rng.range(quantity.min, quantity.max)
  return total
}

/**
 * Parts per monster (06 §1): the record's common and rare rolls (the band's `partChance` is the baseline the
 * records are written to), twice each for an affixed champion, the rare chance doubled by a part break, a hunter's
 * rare part guaranteed. One entry per monster per kind, quantities summed.
 */
export function rollParts(t: Tuning, rng: Rng, monsters: readonly FightMonster[]): PartDrop[] {
  const out: PartDrop[] = []
  for (const m of monsters) {
    const rolls = m.champion ? LOOT_RULES.championPartRolls : 1
    const common = m.def.parts.common
    const commonId = common.materialId ?? common.itemId
    if (commonId !== undefined) {
      const q = rollDrop(rng, common.chance, common.quantity, rolls)
      if (q > 0) out.push({ itemId: commonId, quantity: q, rare: false })
    }
    const rare = m.def.parts.rare
    const rareId = rare.itemId ?? rare.materialId
    if (rareId !== undefined) {
      const guaranteed = m.def.hunter?.guaranteedRarePart ?? false
      const chance = guaranteed ? 100 : m.partBroken ? rare.chance * t.equipment.parts.partBreakRareMultiplier : rare.chance
      const q = rollDrop(rng, chance, rare.quantity, rolls)
      if (q > 0) out.push({ itemId: rareId, quantity: q, rare: true })
    }
  }
  return out
}

/** Everything a won fight drops; the order of draws is fixed (gold, gear, parts, consumable, stone) so replays agree. */
export function rollFightLoot(content: Content, t: Tuning, rng: Rng, input: FightLootInput): FightLoot {
  const table = lootTableForFloor(content, input.dungeonId, input.floor)
  const gold = fightGold(content, rng, table, input)

  const items: ItemInstance[] = []
  const bonus = table.darknessItemBonus[input.lightBand] ?? 0
  const itemChance = (table.itemChance * (100 + bonus)) / 100
  const anyChampion = input.monsters.some((m) => m.champion)
  if (anyChampion || rng.pct(itemChance)) {
    const grade = rollDropGrade(t, rng, table.gradeShape, table.gradeShape.centreGrade, input.luck)
    const def = pickGearItem(content, rng, grade)
    if (def !== null) items.push(createItemInstance(content, rng, def.id, { rollAffixes: true }))
  }

  const parts = rollParts(t, rng, input.monsters)

  const consumables: ItemInstance[] = []
  if (rng.pct(table.consumableDrop.chance)) {
    const c = pickConsumable(content, rng, table)
    if (c !== null) consumables.push(c)
  }

  const stones: ItemInstance[] = []
  if (rng.pct(table.stoneChance)) {
    const stone = stoneItemFor(content, t, table.gradeShape.centreGrade)
    if (stone !== null) stones.push(createItemInstance(content, rng, stone.id))
  }

  const hunterDied = input.monsters.some((m) => m.def.role === 'hunter')
  const hunterChest: DungeonChest | null = hunterDied ? { size: 'large', locked: false, trapped: false, trapId: null, opened: false } : null
  return { gold, items, parts, consumables, stones, hunterChest, table }
}

// ---------------------------------------------------------------------------------------------------------------
// Treasure rooms (07 §2.7, 08 §11)
// ---------------------------------------------------------------------------------------------------------------

export interface DungeonChest {
  size: 'small' | 'large'
  locked: boolean
  trapped: boolean
  trapId: string | null
  opened: boolean
}

export type TreasureHiddenFind = { kind: 'none' } | { kind: 'item'; item: ItemInstance } | { kind: 'skeletonKey'; item: ItemInstance }

export interface TreasureRoomInput {
  luck: number
  /** The party's best Detection in the room, for the hidden find. */
  bestDetection: number
}

export interface TreasureRoomLoot {
  /** 2–4 piles that together hold `goldFightsWorth` fights' gold. */
  goldPiles: number[]
  /** The guaranteed Small chest (null only when the table's chance is below 100 and the roll fails). */
  smallChest: DungeonChest | null
  largeChest: DungeonChest | null
  /** The consumable bundle: `consumableBundle` items of the floor's list. */
  bundle: ItemInstance[]
  hidden: TreasureHiddenFind
}

function splitGold(total: number, piles: number): number[] {
  const n = Math.max(1, piles)
  const base = Math.floor(total / n)
  let rest = total - base * n
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    out.push(base + (rest > 0 ? 1 : 0))
    if (rest > 0) rest--
  }
  return out
}

/** Builds a chest with the table's lock and trap odds: a Small chest locks at half the Large rate (08 §10.3: 20% vs 40%) and traps at the table's rate. */
function rollChest(rng: Rng, table: LootTableDef, size: 'small' | 'large'): DungeonChest {
  const tr = table.treasureRoom
  const lockedChance = size === 'large' ? tr.largeLockedChance : roundHalfUp(tr.largeLockedChance / 2)
  const locked = rng.pct(lockedChance)
  const trapped = rng.pct(tr.trappedChance)
  return { size, locked, trapped, trapId: trapped ? tr.trapId : null, opened: false }
}

/** The strongroom: gold piles, the chests, the bundle and the Detection find (an item at +1 shape or a Skeleton Key). */
export function rollTreasureRoom(content: Content, t: Tuning, rng: Rng, table: LootTableDef, input: TreasureRoomInput): TreasureRoomLoot {
  const tr = table.treasureRoom
  const oneFight = rng.range(table.goldRange.min, table.goldRange.max)
  const piles = rng.range(tr.goldPiles.min, tr.goldPiles.max)
  const goldPiles = splitGold(oneFight * tr.goldFightsWorth, piles)

  const smallChest = rng.pct(tr.smallChestChance) ? rollChest(rng, table, 'small') : null
  const largeChest = rng.pct(tr.largeChestChance) ? rollChest(rng, table, 'large') : null

  const bundle: ItemInstance[] = []
  for (let i = 0; i < tr.consumableBundle; i++) {
    const c = pickConsumable(content, rng, table)
    if (c !== null) bundle.push(c)
  }

  let hidden: TreasureHiddenFind = { kind: 'none' }
  if (rng.pct(hiddenFindChance(t, input.bestDetection))) {
    const keyDef = content.items.get(LOOT_RULES.skeletonKeyItemId)
    const keyWeight = keyDef === undefined ? 0 : tr.hiddenFind.skeletonKeyChance
    const itemWeight = tr.hiddenFind.itemAtPlusOneChance
    const pickKey = keyDef !== undefined && keyWeight + itemWeight > 0 && rng.int(keyWeight + itemWeight) < keyWeight
    if (pickKey && keyDef !== undefined) {
      hidden = { kind: 'skeletonKey', item: createItemInstance(content, rng, keyDef.id) }
    } else {
      const grade = rollDropGrade(t, rng, table.gradeShape, gradeShift(table.gradeShape.centreGrade, 1), input.luck)
      const def = pickGearItem(content, rng, grade)
      if (def !== null) hidden = { kind: 'item', item: createItemInstance(content, rng, def.id, { rollAffixes: true }) }
    }
  }
  return { goldPiles, smallChest, largeChest, bundle, hidden }
}

// ---------------------------------------------------------------------------------------------------------------
// In-dungeon chests (03 §8.3, 08 §10.3)
// ---------------------------------------------------------------------------------------------------------------

export interface OpenDungeonChestInput {
  /** The floor's loot table (consumable list and stone band). */
  table: LootTableDef
  /** The floor's centre grade. */
  centreGrade: Grade
  luck: number
  /** One fight's gold on this floor (a Small chest holds one, a Large two). */
  fightGold: number
  /** A Skeleton Key: makes it safe, opens it, upgrades a Small to Large and gives a Large a second item. */
  withKey: boolean
}

export interface DungeonChestLoot {
  chest: DungeonChest
  /** The size it opened as (a keyed Small opens as Large). */
  size: 'small' | 'large'
  items: ItemInstance[]
  gold: number
  consumables: ItemInstance[]
  stone: ItemInstance | null
}

function dungeonChestLines(t: Tuning, size: 'small' | 'large'): ShapeLine[] {
  const d = t.economy.dungeonChests
  return size === 'small'
    ? [
        { offset: 0, weight: d.small.centre },
        { offset: 1, weight: d.small.plus1 },
      ]
    : [
        { offset: 0, weight: d.large.centre },
        { offset: 1, weight: d.large.plus1 },
        { offset: 2, weight: d.large.plus2 },
      ]
}

/** Small: centre 75 / +1 25, 1 item + 1 fight's gold + 1 consumable · Large: +1 75 / +2 25, 1 item + 2 fights' gold + 2 consumables + 1 stone. */
export function openDungeonChest(content: Content, t: Tuning, rng: Rng, chest: DungeonChest, input: OpenDungeonChestInput): DungeonChestLoot {
  const size: 'small' | 'large' = chest.size === 'small' && input.withKey ? 'large' : chest.size
  const itemCount = 1 + (chest.size === 'large' && input.withKey ? 1 : 0)
  const table = buildGradeTable(t, input.centreGrade, dungeonChestLines(t, size), { luck: input.luck })
  const items: ItemInstance[] = []
  for (let i = 0; i < itemCount; i++) {
    const grade = rollGrade(rng, table)
    const def = pickGearItem(content, rng, isMember(GRADES, grade) ? grade : input.centreGrade)
    if (def !== null) items.push(createItemInstance(content, rng, def.id, { rollAffixes: true }))
  }
  const fights = size === 'small' ? 1 : 2
  const consumables: ItemInstance[] = []
  for (let i = 0; i < fights; i++) {
    const c = pickConsumable(content, rng, input.table)
    if (c !== null) consumables.push(c)
  }
  let stone: ItemInstance | null = null
  if (size === 'large') {
    const def = stoneItemFor(content, t, input.centreGrade)
    if (def !== null) stone = createItemInstance(content, rng, def.id)
  }
  return {
    chest: { ...chest, opened: true, trapped: input.withKey ? false : chest.trapped, locked: false },
    size,
    items,
    gold: input.fightGold * fights,
    consumables,
    stone,
  }
}
