/**
 * A small in-memory content bundle for the items, loot and chest tests: a few items across F–A (three longswords on
 * one mesh, plate on two meshes, a leather set piece, a buckler, trinkets, a stone, consumables, materials, parts,
 * the Skeleton Key), eight affixes, the example rat and hunter, the example elite affix, two loot tables, the chest
 * types, two pets, the example warden and seven of its skills. Tuning is the real content/tuning.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContent, type Content, type RawContentFile } from '../../src/content.ts'
import type { Tuning } from '../../src/tuning.ts'
import type { AffixDef, ChestDef, ItemDef, ItemSetDef, LootTableDef, MonsterDef, PetDef, SkillDef } from '../../src/types/content.ts'
import type { Grade } from '../../src/types/enums.ts'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const contentDir = path.join(repoRoot, 'content')
const examplesDir = path.join(contentDir, 'examples')

export const tuning = JSON.parse(fs.readFileSync(path.join(contentDir, 'tuning.json'), 'utf8')) as Tuning

function readExample<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, name), 'utf8')) as T
}

export function itemDef(o: Partial<ItemDef> & Pick<ItemDef, 'id' | 'kind' | 'grade'>): ItemDef {
  return {
    name: o.id,
    slot: null,
    materialLadder: null,
    materialRung: null,
    weaponType: null,
    armorFamily: null,
    hands: null,
    damageType: null,
    weight: null,
    baseStats: {},
    requirements: { strength: 0, wisdom: 0 },
    affixSlots: 0,
    affixes: [],
    plusN: 0,
    maxPlusN: 3,
    itemLevel: 1,
    itemXp: 0,
    affinities: [],
    durability: 100,
    maxDurability: 100,
    wearK: 1.33,
    value: 0,
    classLock: [],
    setId: null,
    unique: false,
    uniquePower: null,
    active: null,
    consumable: null,
    ammo: null,
    visual: { meshId: `mesh-${o.id}`, tintPrimary: '#000000', tintSecondary: '#000000', trimMetal: 'none' },
    ...o,
  }
}

const sword = (id: string, grade: Grade, rung: number, attack: number, k: number, value: number, slots: number, maxPlusN: number): ItemDef =>
  itemDef({
    id,
    kind: 'weapon',
    grade,
    slot: 'mainHand',
    materialLadder: 'metal',
    materialRung: rung,
    weaponType: 'sword',
    hands: 1,
    damageType: 'slash',
    weight: 1000,
    baseStats: { attackPhys: attack },
    requirements: { strength: 10 + rung, wisdom: 0 },
    affixSlots: slots,
    maxPlusN,
    wearK: k,
    value,
    visual: { meshId: 'weapon-longsword-01', tintPrimary: '#8a8f98', tintSecondary: '#4a3626', trimMetal: 'iron' },
  })

const greataxe = (id: string, grade: Grade, rung: number, attack: number, k: number, value: number, slots: number, maxPlusN: number): ItemDef =>
  itemDef({
    id,
    kind: 'weapon',
    grade,
    slot: 'mainHand',
    materialLadder: 'metal',
    materialRung: rung,
    weaponType: 'greataxe',
    hands: 2,
    damageType: 'slash',
    weight: 1400,
    baseStats: { attackPhys: attack },
    affixSlots: slots,
    maxPlusN,
    wearK: k,
    value,
    visual: { meshId: 'weapon-greataxe-01', tintPrimary: '#8a8f98', tintSecondary: '#4a3626', trimMetal: 'iron' },
  })

const consumable = (id: string, grade: Grade = 'F'): ItemDef =>
  itemDef({ id, kind: 'consumable', grade, consumable: { effects: [], stackMax: 10, target: 'ally', inCombat: true } })

const material = (id: string, ladder: ItemDef['materialLadder'], rung: number | null, grade: Grade): ItemDef =>
  itemDef({ id, kind: 'material', grade, materialLadder: ladder, materialRung: rung })

export const ITEMS: readonly ItemDef[] = [
  sword('copper-longsword', 'F', 0, 12, 1.33, 150, 0, 3),
  sword('bronze-longsword', 'E', 1, 16, 1.67, 240, 1, 4),
  sword('iron-longsword', 'D', 2, 22, 2.08, 380, 1, 5),
  greataxe('steel-greataxe', 'C', 3, 40, 2.6, 900, 2, 6),
  greataxe('skysteel-greataxe', 'A', 5, 70, 4.07, 2400, 3, 8),
  itemDef({
    id: 'copper-breastplate',
    kind: 'armor',
    grade: 'F',
    slot: 'chest',
    materialLadder: 'metal',
    materialRung: 0,
    armorFamily: 'plate',
    baseStats: { defense: 8 },
    wearK: 1.2,
    value: 150,
    visual: { meshId: 'armor-plate-chest-01', tintPrimary: '#8a8f98', tintSecondary: '#4a3626', trimMetal: 'copper' },
  }),
  itemDef({
    id: 'bronze-breastplate',
    kind: 'armor',
    grade: 'E',
    slot: 'chest',
    materialLadder: 'metal',
    materialRung: 1,
    armorFamily: 'plate',
    baseStats: { defense: 11 },
    affixSlots: 1,
    maxPlusN: 4,
    wearK: 1.5,
    value: 240,
    visual: { meshId: 'armor-plate-chest-02', tintPrimary: '#8a8f98', tintSecondary: '#4a3626', trimMetal: 'bronze' },
  }),
  itemDef({ id: 'copper-helm', kind: 'armor', grade: 'F', slot: 'helmet', materialLadder: 'metal', materialRung: 0, armorFamily: 'plate', baseStats: { defense: 4 }, wearK: 1.2, value: 105 }),
  itemDef({ id: 'rawhide-jerkin', kind: 'armor', grade: 'F', slot: 'chest', materialLadder: 'hide', materialRung: 0, armorFamily: 'leather', baseStats: { defense: 5 }, wearK: 0.8, value: 150 }),
  itemDef({
    id: 'grinning-companys-hood',
    kind: 'armor',
    grade: 'E',
    slot: 'helmet',
    materialLadder: 'hide',
    materialRung: 1,
    armorFamily: 'leather',
    baseStats: { defense: 4 },
    affixSlots: 1,
    maxPlusN: 4,
    wearK: 1.0,
    value: 168,
    setId: 'grinning-companys-cut',
  }),
  itemDef({ id: 'pine-buckler', kind: 'shield', grade: 'F', slot: 'offHand', materialLadder: 'wood', materialRung: 0, weaponType: 'shieldBuckler', baseStats: { block: 10 }, wearK: 1.0, value: 120 }),
  itemDef({ id: 'ring-of-vigor', kind: 'ring', grade: 'F', slot: 'ring', baseStats: { hp: 5 }, value: 90 }),
  itemDef({ id: 'bone-talisman', kind: 'talisman', grade: 'E', slot: 'talisman', baseStats: { resistance: 2 }, affixSlots: 1, maxPlusN: 4, value: 192 }),
  itemDef({ id: 'whetstone', kind: 'stone', grade: 'F' }),
  consumable('small-hp-potion'),
  consumable('bandage'),
  consumable('torch'),
  itemDef({ id: 'arrows', kind: 'ammo', grade: 'F', ammo: { stack: 50 } }),
  material('copper', 'metal', 0, 'F'),
  material('bronze', 'metal', 1, 'E'),
  material('iron', 'metal', 2, 'D'),
  material('rawhide', 'hide', 0, 'F'),
  material('leather', 'hide', 1, 'E'),
  material('pine', 'wood', 0, 'F'),
  material('rat-tail-charm', null, null, 'F'),
  material('gnaws-tooth', null, null, 'E'),
  itemDef({ id: 'skeleton-key', kind: 'key', grade: 'F' }),
]

const ALL_GEAR_SLOTS = ['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'talisman', 'relic'] as const

export function affixDef(o: Partial<AffixDef> & Pick<AffixDef, 'id' | 'position' | 'lines' | 'slots'>): AffixDef {
  return { name: o.id, weight: 3, tags: [], ...o }
}

export const AFFIXES: readonly AffixDef[] = [
  readExample<AffixDef>('affix.example.json'),
  affixDef({
    id: 'sharp',
    position: 'prefix',
    lines: [
      { bandMin: 'F', bandMax: 'D', stat: 'attackPhys', unit: 'flat', min: 1, max: 3 },
      { bandMin: 'C', bandMax: 'A', stat: 'attackPhys', unit: 'flat', min: 3, max: 8 },
      { bandMin: 'S', bandMax: 'God', stat: 'attackPhys', unit: 'flat', min: 8, max: 20 },
    ],
    slots: ['mainHand', 'offHand'],
    weight: 5,
  }),
  affixDef({
    id: 'of-the-bear',
    position: 'suffix',
    lines: [
      { bandMin: 'F', bandMax: 'D', stat: 'strength', unit: 'flat', min: 1, max: 2 },
      { bandMin: 'C', bandMax: 'A', stat: 'strength', unit: 'flat', min: 2, max: 4 },
      { bandMin: 'S', bandMax: 'God', stat: 'strength', unit: 'flat', min: 4, max: 7 },
    ],
    slots: [...ALL_GEAR_SLOTS],
    weight: 4,
  }),
  affixDef({
    id: 'fierce',
    position: 'prefix',
    lines: [
      { bandMin: 'F', bandMax: 'D', stat: 'attackPhys', unit: 'percent', min: 3, max: 5 },
      { bandMin: 'C', bandMax: 'A', stat: 'attackPhys', unit: 'percent', min: 5, max: 8 },
      { bandMin: 'S', bandMax: 'God', stat: 'attackPhys', unit: 'percent', min: 8, max: 12 },
    ],
    slots: ['mainHand', 'offHand', 'ring'],
    weight: 3,
  }),
  affixDef({
    id: 'bleeding',
    position: 'prefix',
    lines: [
      { bandMin: 'F', bandMax: 'D', effect: { kind: 'applyStatus', status: 'bleed' }, min: 5, max: 8 },
      { bandMin: 'C', bandMax: 'A', effect: { kind: 'applyStatus', status: 'bleed' }, min: 8, max: 12 },
      { bandMin: 'S', bandMax: 'God', effect: { kind: 'applyStatus', status: 'bleed' }, min: 12, max: 20 },
    ],
    slots: ['mainHand'],
    weight: 3,
    tags: ['onHit'],
  }),
  affixDef({
    id: 'flaming',
    position: 'prefix',
    lines: [
      { bandMin: 'F', bandMax: 'D', effect: { kind: 'damage', damageType: 'fire' }, min: 5, max: 8 },
      { bandMin: 'C', bandMax: 'A', effect: { kind: 'damage', damageType: 'fire' }, min: 8, max: 15 },
      { bandMin: 'S', bandMax: 'God', effect: { kind: 'damage', damageType: 'fire' }, min: 15, max: 25 },
    ],
    slots: ['mainHand', 'offHand'],
    weight: 3,
    tags: ['element'],
  }),
  affixDef({
    id: 'freezing',
    position: 'prefix',
    lines: [
      { bandMin: 'F', bandMax: 'D', effect: { kind: 'damage', damageType: 'frost' }, min: 5, max: 8 },
      { bandMin: 'C', bandMax: 'A', effect: { kind: 'damage', damageType: 'frost' }, min: 8, max: 15 },
      { bandMin: 'S', bandMax: 'God', effect: { kind: 'damage', damageType: 'frost' }, min: 15, max: 25 },
    ],
    slots: ['mainHand', 'offHand'],
    weight: 3,
    tags: ['element'],
  }),
  affixDef({
    id: 'sturdy',
    position: 'prefix',
    lines: [
      { bandMin: 'F', bandMax: 'D', stat: 'defense', unit: 'flat', min: 1, max: 2 },
      { bandMin: 'C', bandMax: 'A', stat: 'defense', unit: 'flat', min: 2, max: 5 },
      { bandMin: 'S', bandMax: 'God', stat: 'defense', unit: 'flat', min: 5, max: 12 },
    ],
    slots: ['helmet', 'chest', 'legs', 'boots', 'gloves', 'offHand'],
    weight: 5,
  }),
]

export const SET: ItemSetDef = { ...readExample<ItemSetDef>('item-set.example.json'), pieces: ['grinning-companys-hood'] }

export const GIANT_RAT = readExample<MonsterDef>('monster.example.json')
export const OLD_GNAW = readExample<MonsterDef>('monster-hunter.example.json')

export const CELLARS_TABLE = readExample<LootTableDef>('loot-table.example.json')
export const CRYPTS_TABLE: LootTableDef = {
  ...CELLARS_TABLE,
  id: 'gravehollow-crypts',
  name: 'Gravehollow Keep — the Crypts (F4–6)',
  floorBand: { min: 4, max: 6 },
  monsterLevels: { min: 5, max: 8 },
  goldRange: { min: 16, max: 32 },
  itemChance: 40,
  gradeShape: { centreGrade: 'E', centre: 56, minus1: 25, plus1: 14, plus2: 4, plus3: 1 },
  bossFirstKill: null,
}

const STANDARD_ROWS: ChestDef['oddsByBand'] = [
  { centreGrade: 'F', table: { F: 56, E: 25, D: 14, C: 4, B: 1 } },
  { centreGrade: 'E', table: { E: 56, D: 25, C: 14, B: 4, A: 1 } },
  { centreGrade: 'D', table: { D: 56, C: 25, B: 14, A: 4, S: 1 } },
  { centreGrade: 'C', table: { C: 56, B: 25, A: 14, S: 4, SS: 1 } },
  { centreGrade: 'B', table: { B: 56, A: 25, S: 14, SS: 5, God: 0 } },
  { centreGrade: 'A', table: { A: 56, S: 25, SS: 19 } },
]

const GRAND_ROWS: ChestDef['oddsByBand'] = [
  { centreGrade: 'F', table: { E: 45, D: 35, C: 15, B: 5 } },
  { centreGrade: 'E', table: { D: 45, C: 35, B: 15, A: 5 } },
  { centreGrade: 'D', table: { C: 45, B: 35, A: 15, S: 5 } },
  { centreGrade: 'C', table: { B: 45, A: 35, S: 15, SS: 5 } },
  { centreGrade: 'B', table: { A: 45, S: 35, SS: 20 } },
  { centreGrade: 'A', table: { S: 45, SS: 55 } },
]

export function chestDef(o: Partial<ChestDef> & Pick<ChestDef, 'id' | 'kind' | 'tier'>): ChestDef {
  return {
    name: o.id,
    priceR: 0.5,
    subtypes: [],
    oddsByBand: [],
    pity: { plusOneWithin: 10, plusTwoWithin: 40 },
    bagWithoutReplacement: false,
    tomeTiers: null,
    dupeRule: 'salvage',
    divineShardChance: 0,
    ...o,
  }
}

export const CHESTS: readonly ChestDef[] = [
  chestDef({ id: 'standard-gear-chest', kind: 'gear', tier: 'standard', subtypes: ['weapon', 'armor', 'trinket'], oddsByBand: STANDARD_ROWS }),
  chestDef({ id: 'grand-gear-chest', kind: 'gear', tier: 'grand', priceR: 2.5, subtypes: ['weapon', 'armor', 'trinket'], oddsByBand: GRAND_ROWS, divineShardChance: 5 }),
  { ...readExample<ChestDef>('chest.example.json'), id: 'rows-d-b-chest' },
  chestDef({ id: 'centre-only-chest', kind: 'gear', tier: 'standard', subtypes: ['weapon'], oddsByBand: [{ centreGrade: 'F', table: { F: 100 } }] }),
  chestDef({ id: 'plus-one-only-chest', kind: 'gear', tier: 'standard', subtypes: ['weapon'], oddsByBand: [{ centreGrade: 'F', table: { E: 100 } }] }),
  chestDef({ id: 'grand-plus-one-only-chest', kind: 'gear', tier: 'grand', subtypes: ['weapon'], oddsByBand: [{ centreGrade: 'F', table: { E: 100 } }] }),
  chestDef({ id: 'pet-egg-chest', kind: 'petEgg', tier: 'standard', priceR: 1.5, oddsByBand: STANDARD_ROWS, dupeRule: 'bond' }),
  chestDef({ id: 'material-crate', kind: 'materialCrate', tier: 'standard', priceR: 0.3 }),
  chestDef({ id: 'grand-material-crate', kind: 'materialCrate', tier: 'grand', priceR: 1.2 }),
  chestDef({ id: 'skill-tome-chest', kind: 'skillTome', tier: 'standard', priceR: 0.8, bagWithoutReplacement: true, tomeTiers: { min: 1, max: 3 }, dupeRule: 'rankXp' }),
  chestDef({ id: 'grand-skill-tome-chest', kind: 'skillTome', tier: 'grand', priceR: 3, bagWithoutReplacement: true, tomeTiers: { min: 2, max: 4 }, dupeRule: 'rankXp' }),
]

export const CELLAR_HOUND = readExample<PetDef>('pet.example.json')
export const CRYPT_BAT: PetDef = {
  ...CELLAR_HOUND,
  id: 'crypt-bat',
  name: 'Crypt Bat',
  speciesFamilyId: 'restless-dead',
  gradeBand: { min: 'E', max: 'D' },
  eggSource: { chestBand: 'E', familyId: 'restless-dead' },
  creationChoice: false,
}

export function skillDef(id: string, tier: number): SkillDef {
  return {
    id,
    classId: 'warden',
    school: 'bulwark',
    tier,
    name: id,
    description: '',
    type: 'active',
    cost: 10,
    weight: 1000,
    target: 'enemyFront',
    effects: [{ kind: 'damage', multiplier: 1, damageType: 'blunt' }],
    prerequisiteId: null,
    isUltimate: false,
    monsterTechniqueOf: null,
    rankScaling: { effectPerRank: 4, costPerRank: -2 },
    mastery: { text: '', effects: [] },
    tags: ['singleTarget'],
    xpTags: ['strength'],
    aiHints: { role: 'attack', priority: 50 },
  }
}

export const SKILLS: readonly SkillDef[] = [
  skillDef('warden-a', 1),
  skillDef('warden-b', 1),
  skillDef('warden-c', 1),
  skillDef('warden-d', 2),
  skillDef('warden-e', 2),
  skillDef('warden-f', 3),
  skillDef('warden-g', 4),
]

/** The raw files; tests may add to or replace entries before building. */
export function fixtureFiles(): RawContentFile[] {
  const files: RawContentFile[] = [{ kind: 'tuning', path: 'tuning.json', json: tuning }]
  for (const item of ITEMS) files.push({ kind: 'item', path: `items/${item.kind}/${item.id}.json`, json: item })
  for (const affix of AFFIXES) files.push({ kind: 'affix', path: `affixes/${affix.id}.json`, json: affix })
  files.push({ kind: 'item-set', path: `sets/${SET.id}.json`, json: SET })
  files.push({ kind: 'monster', path: `monsters/${GIANT_RAT.id}.json`, json: GIANT_RAT })
  files.push({ kind: 'monster', path: `monsters/${OLD_GNAW.id}.json`, json: OLD_GNAW })
  files.push({ kind: 'elite-affix', path: 'elite-affixes/rabid.json', json: readExample('elite-affix.example.json') })
  files.push({ kind: 'loot-table', path: `loot-tables/${CELLARS_TABLE.id}.json`, json: CELLARS_TABLE })
  files.push({ kind: 'loot-table', path: `loot-tables/${CRYPTS_TABLE.id}.json`, json: CRYPTS_TABLE })
  for (const chest of CHESTS) files.push({ kind: 'chest', path: `chests/${chest.id}.json`, json: chest })
  files.push({ kind: 'pet', path: `pets/${CELLAR_HOUND.id}.json`, json: CELLAR_HOUND })
  files.push({ kind: 'pet', path: `pets/${CRYPT_BAT.id}.json`, json: CRYPT_BAT })
  files.push({ kind: 'class', path: 'classes/warden.json', json: readExample('class.example.json') })
  for (const skill of SKILLS) files.push({ kind: 'skill', path: `skills/warden/${skill.id}.json`, json: skill })
  return files
}

export function fixtureContent(): Content {
  return buildContent(fixtureFiles())
}

export function item(content: Content, id: string): ItemDef {
  const def = content.items.get(id)
  if (def === undefined) throw new Error(`fixture: no item ${id}`)
  return def
}

export function chest(content: Content, id: string): ChestDef {
  const def = content.chests.get(id)
  if (def === undefined) throw new Error(`fixture: no chest ${id}`)
  return def
}
