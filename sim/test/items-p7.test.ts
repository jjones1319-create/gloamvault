import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { chestKeyItemId, chestOnSale, keyTierOf, openTownChest, EMPTY_PITY } from '../src/chests.ts'
import { buildHeroActor, createHero, heroStats } from '../src/hero.ts'
import { canPromote, createItemInstance, effectiveItemStats, nextRungItem, plusNUpgrade, promote, rollAffixes, rungMaterial, setBonusLoad, setProgressOf } from '../src/items.ts'
import { isBossOnly, pickGearItem, rollRewardItem, stoneItemFor } from '../src/loot.ts'
import { Rng } from '../src/rng.ts'
import { addHero, buyChest, chestBand, chestKeyBlocker, chestKeysHeld, equip, newProfile, openChestWithKey, promoteItem, upgradePlusN, TownError, type Profile } from '../src/town.ts'
import type { HeroRecord, ItemDef, ItemInstance } from '../src/types/content.ts'
import { GRADES, gradeIndex, type Grade } from '../src/types/enums.ts'
import { drawWayfarer, wayfarerBonusPoints } from '../src/wayfarers.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning

function warden(): HeroRecord {
  return createHero(content, t, Rng.fromSeed(5), { id: 'w', name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: null })
}

function inst(itemId: string, over: Partial<ItemInstance> = {}): ItemInstance {
  return { ...createItemInstance(content, Rng.fromSeed(1), itemId, { instanceId: `i-${itemId}` }), ...over }
}

const def = (id: string): ItemDef => {
  const d = content.items.get(id)
  if (!d) throw new Error(`no item ${id}`)
  return d
}

describe('grades B, A and S on every family (08 §1–§3, Phase 7)', () => {
  const FAMILY_KINDS = new Set(['weapon', 'armor', 'shield', 'focus', 'ring', 'talisman'])
  const families = new Map<string, ItemDef[]>()
  for (const d of content.items.values()) {
    if (!FAMILY_KINDS.has(d.kind) || d.unique || d.setId !== null) continue
    const list = families.get(d.visual.meshId) ?? []
    list.push(d)
    families.set(d.visual.meshId, list)
  }

  it('every ordinary family runs F to S, one item a grade, and none is God', () => {
    expect(families.size).toBeGreaterThan(60)
    for (const [mesh, items] of families) {
      const grades = items.map((d) => d.grade).sort((a, b) => gradeIndex(a) - gradeIndex(b))
      expect(grades, mesh).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S'])
    }
    expect([...content.items.values()].some((d) => d.grade === 'God')).toBe(false)
  })

  it('reads 08: a Skysteel Longsword is 12 × 4.45, Str 10 + 5, k 4.07, worth 1,600; the S rung is Adamantine', () => {
    const sky = def('skysteel-longsword')
    expect(sky).toMatchObject({ grade: 'A', materialLadder: 'metal', materialRung: 5, affixSlots: 3, maxPlusN: 8, wearK: 4.07, value: 1600 })
    expect(sky.baseStats.attackPhys).toBe(53)
    expect(sky.requirements.strength).toBe(15)
    expect(def('adamantine-longsword').baseStats.attackPhys).toBe(72)
    expect(def('blacksteel-greatsword').baseStats.attackPhys).toBe(66)
    expect(def('elderwood-shortbow').wearK).toBe(10.17)
  })

  it('armor secondaries: flat ones ride the ladder, percentage ones step +1 pp per grade above B (a God Jerkin +6%)', () => {
    expect(def('wolf-hide-jerkin').baseStats.dodge).toBe(2)
    expect(def('wyvern-hide-jerkin').baseStats.dodge).toBe(2)
    expect(def('basilisk-scale-jerkin').baseStats.dodge).toBe(3)
    expect(def('drake-scale-jerkin').baseStats.dodge).toBe(4)
    expect(def('skysteel-breastplate').baseStats.stamina).toBe(18)
    expect(def('skysteel-breastplate').baseStats.defense).toBe(36)
  })

  it('shields step Block +2 pp a grade; rings and talismans ride the ladder by grade name', () => {
    expect(def('elderwood-buckler').baseStats.block).toBe(15 + 12)
    expect(def('adamantine-tower-shield').baseStats.block).toBe(35 + 12)
    expect(def('legendary-ring-of-the-eye').baseStats.critRate).toBe(6)
    expect(def('heroic-talisman-of-warding').baseStats.resistance).toBe(13)
  })

  it('the B, A and S rungs of the four ladders are material items, priced on past C', () => {
    for (const [ladder, names] of Object.entries({ metal: ['blacksteel', 'skysteel', 'adamantine'], hide: ['wyvern-hide', 'basilisk-scale', 'drake-scale'], cloth: ['glyphweave', 'moonweave', 'phoenix-weave'], wood: ['ironwood', 'ebony', 'elderwood'] })) {
      names.forEach((id, i) => expect(def(id)).toMatchObject({ kind: 'material', materialLadder: ladder, materialRung: 4 + i }))
    }
    expect([def('blacksteel').value, def('skysteel').value, def('adamantine').value]).toEqual([100, 160, 250])
  })

  it('a random A roll is an A item; affixes roll from the C–A band and fill 3 slots', () => {
    const rng = Rng.fromSeed(9)
    for (let i = 0; i < 20; i++) {
      const d = pickGearItem(content, rng, 'A')
      expect(d?.grade).toBe('A')
      const rolled = rollAffixes(content, rng, d!)
      expect(rolled.length).toBeLessThanOrEqual(3 - (d!.setId ? 1 : 0) - (d!.unique ? 1 : 0))
    }
  })
})

describe('the Divine Shard, regional names and the rare parts (08 §4, §8)', () => {
  it('the Divine Shard is a material off every ladder, never sold, never God', () => {
    expect(def('divine-shard')).toMatchObject({ kind: 'material', materialLadder: null, value: 0, grade: 'SS' })
  })

  it('a regional name counts for its rung, but crates and salvage pay the first name', () => {
    expect(def('sharkskin')).toMatchObject({ materialLadder: 'hide', materialRung: 3, tags: ['regional'] })
    expect(rungMaterial(content, 'hide', 3)?.id).toBe('wolf-hide')
    expect(rungMaterial(content, 'cloth', 3)?.id).toBe('silk')
    expect(rungMaterial(content, 'hide', 2)?.id).toBe('boiled-leather')
    const crate = content.chests.get('standard-material-crate')!
    const out = openTownChest(content, t, Rng.fromSeed(4), { chest: crate, bandGrade: 'C', luck: 10, pity: EMPTY_PITY, materialLadder: 'hide' })
    expect(out.result).toMatchObject({ kind: 'materials', materialId: 'wolf-hide' })
    // Promotion still accepts the regional name: a Boiled Leather Jerkin promotes with Sharkskin.
    const jerkin = def('boiled-leather-jerkin')
    const q = canPromote(content, t, jerkin, inst(jerkin.id), new Map([['sharkskin', 10]]))
    expect(q).toMatchObject({ ok: true, targetItemId: 'wolf-hide-jerkin', units: 10 })
  })

  it('the Crypts and Vault rare parts exist as stones', () => {
    for (const id of ['knights-gorget', 'sextons-bell', 'grave-candle', 'ghoul-claw', 'wraith-ash', 'tomb-spinneret', 'hounds-collar', 'brine-pearl', 'tide-glass', 'penance-chain', 'diving-bell-plate', 'sentinel-core', 'hags-eye', 'leech-heart', 'maw-pearl']) {
      expect(def(id).kind, id).toBe('stone')
    }
    for (const id of ['bone-shard', 'bat-wing', 'deep-flesh', 'brine-salt', 'cured-ghoulhide', 'spidersilk', 'mourners-tear']) expect(def(id).kind, id).toBe('material')
  })
})

describe('safe items, the Torch and keys (07 §2.4, §2.7, §7)', () => {
  it('the merchant\'s safe items carry `safe-item` and their zone; the cooking Salt does not', () => {
    const safe = [...content.items.values()].filter((d) => (d.tags ?? []).includes('safe-item')).map((d) => d.id).sort()
    expect(safe).toEqual(['candle-of-vigil', 'empty-vial', 'flint-and-oil', 'grave-salt', 'oilskin-cloak', 'reading-glass', 'rope-and-hook', 'wax-plugs'])
    expect(def('salt').tags ?? []).not.toContain('safe-item')
    expect(def('reading-glass').tags).toContain('zone:the-crypts')
    expect(def('rope-and-hook').tags).toContain('zone:the-drowned-vault')
    expect(def('wax-plugs').consumable?.text).toMatch(/Hymnal/)
  })

  it('the Torch is usable in a fight (an Item action relighting a brazier)', () => {
    expect(def('torch').consumable).toMatchObject({ inCombat: true, effects: [{ kind: 'light', amount: 25 }] })
  })

  it('chest keys name their tier', () => {
    expect(chestKeyItemId(content, 'standard')).toBe('standard-chest-key')
    expect(chestKeyItemId(content, 'grand')).toBe('grand-chest-key')
    expect(keyTierOf(def('skeleton-key'))).toBeNull()
  })
})

describe('chest keys open the Curio Merchant\'s chests (07 §7)', () => {
  function profileWith(materials: Record<string, number>, purse = 0): { p: Profile; heroId: string } {
    const p = addHero(content, newProfile(11), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: null }).profile
    return { p: { ...p, purse, materials: { ...p.materials, ...materials } }, heroId: p.heroes[0]!.id }
  }

  it('a Standard Key opens a Standard chest free: the key goes, the gold stays, the pity moves', () => {
    const { p, heroId } = profileWith({ 'standard-chest-key': 2 })
    expect(chestKeysHeld(content, p, 'standard')).toBe(2)
    expect(chestKeyBlocker(content, p, 'standard-gear-chest')).toBeNull()
    const out = openChestWithKey(content, p, 'standard-gear-chest', heroId, { subtype: 'weapon' })
    expect(out.profile.materials['standard-chest-key']).toBe(1)
    expect(out.profile.purse).toBe(0)
    expect(out.profile.pity.gear?.plusOneCounter ?? 0).toBeGreaterThanOrEqual(0)
    expect(['item', 'salvage']).toContain(out.result.kind)
  })

  it('a Standard Key does not open a Grand chest; no key, no opening', () => {
    const { p, heroId } = profileWith({ 'standard-chest-key': 1 })
    expect(chestKeyBlocker(content, p, 'grand-gear-chest')).toMatch(/Grand Key/)
    expect(() => openChestWithKey(content, p, 'grand-gear-chest', heroId)).toThrow(TownError)
    const { p: p2, heroId: h2 } = profileWith({ 'grand-chest-key': 1 })
    const out = openChestWithKey(content, p2, 'grand-gear-chest', h2, { subtype: 'armor' })
    expect(out.profile.materials['grand-chest-key']).toBe(0)
  })

  it('a key opens any chest of its tier: a Pet Egg, a Material Crate, the Wayfarer Chest', () => {
    const { p, heroId } = profileWith({ 'standard-chest-key': 3 })
    expect(openChestWithKey(content, p, 'standard-pet-egg', heroId).result.kind).toMatch(/egg|bondStar/)
    expect(openChestWithKey(content, p, 'standard-material-crate', heroId, { materialLadder: 'metal' }).result.kind).toBe('materials')
    const w = openChestWithKey(content, p, 'standard-wayfarer-chest', null)
    expect(w.result.kind).toBe('wayfarer')
    expect(w.profile.heroes).toHaveLength(2)
  })
})

describe('the Grand Wayfarer Chest and the S-grade cast (D-091, 12 Phase 7)', () => {
  it('six S wayfarers, one per class and species, with 10 creation points', () => {
    const s = [...content.wayfarers.values()].filter((w) => w.grade === 'S')
    expect(s).toHaveLength(6)
    expect(new Set(s.map((w) => w.classId)).size).toBe(6)
    expect(new Set(s.map((w) => w.speciesId)).size).toBe(6)
    expect(wayfarerBonusPoints('S')).toBe(4)
    for (const w of s) expect(Object.values(w.freePoints).reduce((a, b) => a + (b ?? 0), 0)).toBe(10)
  })

  it('is sold from band E only; the standard chest keeps D 50 · C 30 · B 15 · A 5', () => {
    const grand = content.chests.get('grand-wayfarer-chest')!
    expect(chestOnSale(grand, 'F')).toBe(false)
    expect(chestOnSale(grand, 'E')).toBe(true)
    expect(content.chests.get('standard-wayfarer-chest')!.oddsByBand[0]!.table).toEqual({ D: 50, C: 30, B: 15, A: 5 })
    const p = addHero(content, newProfile(3), { name: 'O', speciesId: 'human', classId: 'warden', eggPetId: null }).profile
    expect(chestBand(p)).toBe('F')
    expect(() => buyChest(content, { ...p, purse: 99999 }, 'grand-wayfarer-chest', null)).toThrow(/band E/)
  })

  it('draws C or better, S at 5%, and advances the shared pity by 3', () => {
    const grand = content.chests.get('grand-wayfarer-chest')!
    const rng = Rng.fromSeed(21)
    const seen = new Map<string, number>()
    for (let i = 0; i < 400; i++) {
      const d = drawWayfarer(content, rng, grand, 'E', EMPTY_PITY, new Set(), 3)!
      seen.set(d.grade, (seen.get(d.grade) ?? 0) + 1)
      expect(d.grade).not.toBe('D')
    }
    expect(seen.get('S') ?? 0).toBeGreaterThan(5)
    expect(seen.get('C') ?? 0).toBeGreaterThan(seen.get('A') ?? 0)
    const one = drawWayfarer(content, Rng.fromSeed(2), grand, 'E', EMPTY_PITY, new Set(), 3)!
    expect(one.pity.plusTwoCounter === 0 || one.pity.plusTwoCounter === 3).toBe(true)
  })
})

describe('named uniques (08 §7)', () => {
  it('the Lamplighter\'s Hood adds +3 Detection over a B hood and carries its light line', () => {
    const hood = def('lamplighters-hood')
    expect(hood).toMatchObject({ grade: 'B', unique: true, slot: 'helmet', armorFamily: 'leather' })
    const plain = effectiveItemStats(content, t, def('wyvern-hide-hood'), inst('wyvern-hide-hood'))
    const lamp = effectiveItemStats(content, t, hood, inst('lamplighters-hood'))
    expect((lamp.stats.detection ?? 0) - (plain.stats.detection ?? 0)).toBe(3)
    expect(lamp.hookLines.map((h) => h.line.customId)).toEqual(['light-decay-reduction'])
    expect(lamp.onHit).toEqual([])
  })

  it('a unique\'s attribute lines reach the wearer; a Broken unique gives nothing', () => {
    const ring = def('emberheart-ring')
    expect(effectiveItemStats(content, t, ring, inst(ring.id)).attributeBonuses.vitality).toBe(2)
    expect(effectiveItemStats(content, t, ring, inst(ring.id, { durability: 0 })).attributeBonuses).toEqual({})
    const w = warden()
    const worn = { ...w, equipment: { ...w.equipment, ring: [inst('emberheart-ring'), w.equipment.ring[1]] as [ItemInstance | null, ItemInstance | null] } }
    expect(heroStats(content, t, worn).hp - heroStats(content, t, { ...w, equipment: { ...w.equipment, ring: [null, w.equipment.ring[1]] } }).hp).toBe(2 * t.derived.hp.perVitality)
  })

  it('a unique\'s signature fills one affix slot', () => {
    const rng = Rng.fromSeed(5)
    for (let i = 0; i < 10; i++) expect(rollAffixes(content, rng, def('ring-of-the-long-winter')).length).toBeLessThanOrEqual(2)
  })
})

describe('sets: membership through promotion, bonuses in the sim (08 §6)', () => {
  const pieces = (set: string, grade: Grade) => content.sets.get(set)!.pieces.map((id) => [...content.items.values()].find((d) => d.setId === set && d.slot === def(id).slot && d.grade === grade)!.id)

  it('Gravehollow\'s five sets, with pieces from their lowest grade to S', () => {
    expect([...content.sets.keys()].sort()).toEqual(['barrow-wardens-vigil', 'drowned-choirs-vestments', 'grinning-companys-cut', 'lanternkeepers-habit', 'tidebound-reavers-mail'])
    expect(pieces('barrow-wardens-vigil', 'D')).toEqual(['barrow-wardens-helm', 'barrow-wardens-breastplate', 'barrow-wardens-greaves', 'barrow-wardens-sabatons', 'barrow-wardens-gauntlets'])
    expect(def('barrow-wardens-helm-s').setId).toBe('barrow-wardens-vigil')
  })

  it('promotion keeps the set: a C Warden\'s Helm promotes into the B one', () => {
    const helm = def('barrow-wardens-helm-c')
    expect(nextRungItem(content, helm)?.id).toBe('barrow-wardens-helm-b')
    const r = promote(content, Rng.fromSeed(1), t, helm, inst(helm.id))
    expect(def(r.targetItemId).setId).toBe('barrow-wardens-vigil')
  })

  it('two pieces switch on the 2-piece bonus, four the 4-piece; a Broken piece does not count', () => {
    const ids = pieces('barrow-wardens-vigil', 'D')
    const worn2 = [inst(ids[0]!), inst(ids[1]!)]
    const load2 = setBonusLoad(content, t, worn2)
    expect(load2.progress).toEqual([{ setId: 'barrow-wardens-vigil', worn: 2, pieces: 5, thresholds: [2, 4], active: ['2'], next: 4 }])
    expect(load2.stats.defense).toBe(5)
    expect(load2.hookLines.map((h) => `${h.line.customId}:${h.line.status}`)).toEqual(['status-resist-bonus:fear', 'status-resist-bonus:curse'])
    const load4 = setBonusLoad(content, t, ids.slice(0, 4).map((id) => inst(id)))
    expect(load4.progress[0]!.active).toEqual(['2', '4'])
    expect(load4.hookLines.map((h) => h.line.customId)).toContain('guard-taunts-and-fortifies')
    expect(setProgressOf(content, t, [inst(ids[0]!), inst(ids[1]!, { durability: 0 })])[0]!.worn).toBe(1)
  })

  it('a hero wearing two Vigil pieces has +5 Defense on the card and the resist hooks in the fight', () => {
    const w = warden()
    const ids = pieces('barrow-wardens-vigil', 'D')
    const plain = { ...w, equipment: { ...w.equipment, helmet: inst('iron-helm'), chest: inst('iron-breastplate') } }
    const vigil = { ...w, equipment: { ...w.equipment, helmet: inst(ids[0]!), chest: inst(ids[1]!) } }
    expect(heroStats(content, t, vigil).defense - heroStats(content, t, plain).defense).toBe(5)
    const actor = buildHeroActor(content, t, vigil, { id: 'hero-0', row: 'front' })
    expect(actor.hooks.filter((h) => h.customId === 'status-resist-bonus').map((h) => h.line.status).sort()).toEqual(['curse', 'fear'])
  })
})

describe('a boss\'s graded reward (06 §3: "one A-grade item", "one S-grade item")', () => {
  it('rolls an item of exactly that grade, open to the class, never a boss\'s own relic', () => {
    const rng = Rng.fromSeed(77)
    for (const grade of ['A', 'S'] as const) {
      for (let i = 0; i < 40; i++) {
        const it = rollRewardItem(content, rng, grade, 'warden')!
        const d = def(it.itemId)
        expect(d.grade).toBe(grade)
        expect(d.classLock.length === 0 || d.classLock.includes('warden')).toBe(true)
        expect(isBossOnly(d)).toBe(false)
      }
    }
    expect(isBossOnly(def('the-barrow-bell'))).toBe(true)
  })

  it('a C roll never yields a boss\'s relic (the Grinning Mask, the Tidebound Idol, the Hollow Coin)', () => {
    const rng = Rng.fromSeed(3)
    for (let i = 0; i < 300; i++) expect(isBossOnly(pickGearItem(content, rng, 'C')!)).toBe(false)
  })
})

describe('the P7 milestone: a Skysteel sword from a Gravehollow boss, raised +N with Gravehollow\'s materials (12 §4)', () => {
  it('an A-grade sword from the boss roll, equipped, takes +1 … +8 with Honing Oil and gold', () => {
    // The boss roll: the first A-grade sword a Warden's reward gives (deterministic seeds).
    let sword: ItemInstance | null = null
    for (let seed = 1; seed < 400 && !sword; seed++) {
      const it = rollRewardItem(content, Rng.fromSeed(seed), 'A', 'warden')
      if (it && def(it.itemId).weaponType === 'sword') sword = it
    }
    expect(sword).not.toBeNull()
    const swordDef = def(sword!.itemId)
    expect(swordDef.name).toMatch(/^Skysteel /)
    let p = addHero(content, newProfile(5), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: null }).profile
    const heroId = p.heroes[0]!.id
    // Honing Oil is the B–A stone (08 §8.6); Gravehollow gives it from the Embalmer's Table and the Warding Glyph (07).
    expect(stoneItemFor(content, t, 'A')?.id).toBe('honing-oil')
    p = { ...p, purse: 100_000, armory: [...p.armory, sword!], materials: { ...p.materials, 'honing-oil': 14 } }
    p = equip(content, p, heroId, sword!.instanceId)
    const atk0 = effectiveItemStats(content, t, swordDef, p.heroes[0]!.equipment.mainHand!).stats.attackPhys!
    for (let n = 1; n <= swordDef.maxPlusN; n++) p = upgradePlusN(content, p, heroId, sword!.instanceId)
    const at8 = p.heroes[0]!.equipment.mainHand!
    expect(at8.plusN).toBe(8)
    expect(p.materials['honing-oil']).toBe(14 - 6 - 2 * 2)
    expect(plusNUpgrade(t, swordDef, at8)).toBeNull()
    expect(effectiveItemStats(content, t, swordDef, at8).stats.attackPhys).toBe(Math.floor((Math.floor((swordDef.baseStats.attackPhys! * 140) / 100 + 0.5) * 100) / 100 + 0.5))
    expect(effectiveItemStats(content, t, swordDef, at8).stats.attackPhys).toBeGreaterThan(atk0)
  })

  it('a Steel sword promotes through Blacksteel to Skysteel when the rungs are in hand', () => {
    let p = addHero(content, newProfile(6), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: null }).profile
    const heroId = p.heroes[0]!.id
    const steel = inst('steel-longsword')
    p = { ...p, purse: 100_000, armory: [...p.armory, steel], materials: { ...p.materials, blacksteel: 12, skysteel: 16 } }
    p = equip(content, p, heroId, steel.instanceId)
    p = promoteItem(content, p, heroId, steel.instanceId)
    expect(p.heroes[0]!.equipment.mainHand!.itemId).toBe('blacksteel-longsword')
    p = promoteItem(content, p, heroId, steel.instanceId)
    expect(p.heroes[0]!.equipment.mainHand!.itemId).toBe('skysteel-longsword')
    expect(p.materials.blacksteel).toBe(0)
    expect(p.materials.skysteel).toBe(0)
  })

  it('every grade of the ladder has a next rung up to S, and S is the top Gravehollow writes', () => {
    for (const g of GRADES.slice(0, 6)) {
      const sword = [...content.items.values()].find((d) => d.grade === g && d.visual.meshId === 'weapon-longsword-01')!
      expect(nextRungItem(content, sword)?.grade, g).toBe(GRADES[gradeIndex(g) + 1])
    }
    expect(nextRungItem(content, def('adamantine-longsword'))).toBeNull()
  })
})
