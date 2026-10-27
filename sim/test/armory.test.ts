import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { armoryCandidates, autoEquipBest, bestHands, blockedSkills, itemScore, wearBlocker, wornIn } from '../src/armory.ts'
import { createItemInstance } from '../src/items.ts'
import { Rng } from '../src/rng.ts'
import { addHero, heroOf, newProfile, setLoadoutSlot, type Profile } from '../src/town.ts'
import type { HeroRecord, ItemInstance } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))

function heroProfile(speciesId: string, classId: string): Profile {
  return addHero(content, newProfile(7), { name: 'Test', speciesId, classId, eggPetId: 'cellar-hound' }).profile
}

/** An armory copy of a content item with a fixed instance id (and any instance fields patched). */
function give(p: Profile, itemId: string, instanceId: string, patch: Partial<ItemInstance> = {}): Profile {
  const inst = { ...createItemInstance(content, Rng.fromSeed(1), itemId, { instanceId }), ...patch }
  return { ...p, armory: [...p.armory, inst] }
}

function hero(p: Profile): HeroRecord {
  return p.heroes[0]!
}

function patchHero(p: Profile, f: (h: HeroRecord) => HeroRecord): Profile {
  return { ...p, heroes: p.heroes.map((h, i) => (i === 0 ? f(h) : h)) }
}

describe('auto-equip best (03 §6.1)', () => {
  it('a better armory sword replaces the worn one; the old sword goes back to the armory', () => {
    const start = give(heroProfile('dwarf', 'warden'), 'iron-shortsword', 'it-iron')
    const worn = hero(start).equipment.mainHand!
    expect(worn.itemId).toBe('copper-shortsword')
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.instanceId).toBe('it-iron')
    expect(p.armory.map((i) => i.instanceId)).toEqual([worn.instanceId])
    // The shield stays: Shield Slam needs it and sword + shield outscores the sword alone.
    expect(hero(p).equipment.offHand?.itemId).toBe('pine-buckler')
  })

  it('ignores an item locked to another class, however good', () => {
    const start = give(heroProfile('dwarf', 'warden'), 'steel-sabre', 'it-sabre')
    expect(wearBlocker(content, hero(start), content.items.get('steel-sabre')!)).toMatch(/Blade/)
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.itemId).toBe('copper-shortsword')
    expect(p.armory.map((i) => i.instanceId)).toEqual(['it-sabre'])
  })

  it('ties keep what is worn', () => {
    const start = give(give(heroProfile('dwarf', 'warden'), 'copper-shortsword', 'it-twin'), 'copper-helm', 'it-helm-twin')
    const before = hero(start).equipment
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.instanceId).toBe(before.mainHand!.instanceId)
    expect(hero(p).equipment.helmet?.instanceId).toBe(before.helmet!.instanceId)
    expect(p.armory.map((i) => i.instanceId).sort()).toEqual(['it-helm-twin', 'it-twin'])
  })

  it('a broken item is replaced by a working one', () => {
    let start = heroProfile('dwarf', 'warden')
    start = patchHero(start, (h) => ({ ...h, equipment: { ...h.equipment, helmet: { ...h.equipment.helmet!, durability: 0 } } }))
    const broken = hero(start).equipment.helmet!
    expect(itemScore(content, hero(start), content.items.get(broken.itemId)!, broken)).toBe(0)
    start = give(start, 'copper-helm', 'it-helm')
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.helmet?.instanceId).toBe('it-helm')
    expect(p.armory.some((i) => i.instanceId === broken.instanceId)).toBe(true)
  })

  it('wear and +N count: a worn-out copy loses to a fresh one, a +3 copy beats a plain one', () => {
    const worn = give(heroProfile('dwarf', 'warden'), 'copper-helm', 'it-plus', { plusN: 3 })
    expect(hero(autoEquipBest(content, worn, hero(worn).id)).equipment.helmet?.instanceId).toBe('it-plus')
    const damaged = give(heroProfile('dwarf', 'warden'), 'copper-helm', 'it-damaged', { durability: 10 })
    expect(hero(autoEquipBest(content, damaged, hero(damaged).id)).equipment.helmet?.instanceId).not.toBe('it-damaged')
  })

  it('a two-hander that beats the pair takes both hands and the off-hand item goes back', () => {
    // A Blade starts with a longsword and the kit dagger in the off hand (08 §1: daggers are dual); a buckler is not
    // in the Blade's weapon list, so it counts a quarter and never beats the dagger.
    let start = give(heroProfile('orc', 'blade'), 'pine-buckler', 'it-buckler')
    start = autoEquipBest(content, start, hero(start).id)
    expect(hero(start).equipment.offHand?.itemId).toBe('copper-dagger')
    const dagger = hero(start).equipment.offHand!.instanceId
    // Twin Cut needs two weapons, and a pair that keeps a loadout skill usable always wins: take it out of the loadout.
    start = setLoadoutSlot(content, start, hero(start).id, 'active', 0, null)
    start = give(start, 'copper-zweihander', 'it-zwei')
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.instanceId).toBe('it-zwei')
    expect(hero(p).equipment.offHand).toBeNull()
    expect(p.armory.map((i) => i.instanceId).sort()).toEqual(['it-buckler', dagger, hero(start).equipment.mainHand!.instanceId].sort())
  })

  it('a Warden keeps sword and shield over a maul (the pair, and Shield Slam needs the shield)', () => {
    const start = give(heroProfile('dwarf', 'warden'), 'copper-maul', 'it-maul')
    const h = hero(start)
    expect(blockedSkills(content, h, content.items.get('copper-maul')!, null).map((s) => s.id)).toContain('warden-shield-slam')
    const p = autoEquipBest(content, start, h.id)
    expect(hero(p).equipment.mainHand?.itemId).toBe('copper-shortsword')
    expect(hero(p).equipment.offHand?.itemId).toBe('pine-buckler')
  })

  it('a Ranger keeps a bow over a stronger spear (its shots need a bow) but takes a better bow', () => {
    let start = give(heroProfile('human', 'ranger'), 'steel-spear', 'it-spear')
    let p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.itemId).toBe('pine-shortbow')
    start = give(p, 'oak-shortbow', 'it-oak-bow')
    p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.instanceId).toBe('it-oak-bow')
  })

  it('species restrictions hold: a Dwarf Ranger never takes a longbow, a Human Ranger does', () => {
    const dwarf = give(heroProfile('dwarf', 'ranger'), 'pine-longbow', 'it-long')
    expect(wearBlocker(content, hero(dwarf), content.items.get('pine-longbow')!)).not.toBeNull()
    expect(armoryCandidates(content, dwarf, hero(dwarf), 'mainHand')).toEqual([])
    expect(hero(autoEquipBest(content, dwarf, hero(dwarf).id)).equipment.mainHand?.itemId).toBe('pine-shortbow')
    const human = give(heroProfile('human', 'ranger'), 'pine-longbow', 'it-long')
    expect(hero(autoEquipBest(content, human, hero(human).id)).equipment.mainHand?.instanceId).toBe('it-long')
  })

  it('the two ring slots end with the two best rings', () => {
    let start = heroProfile('dwarf', 'warden')
    expect(wornIn(hero(start), 'ring0')?.itemId).toBe('ring-of-vigor')
    expect(wornIn(hero(start), 'ring1')).toBeNull()
    start = give(give(start, 'ring-of-might', 'it-might'), 'superior-ring-of-vigor', 'it-sup')
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.ring.map((r) => r?.itemId)).toEqual(['superior-ring-of-vigor', 'ring-of-vigor'])
    expect(p.armory.map((i) => i.instanceId)).toEqual(['it-might'])
  })

  it('a Mana class reads spell Attack: a Mender keeps the censer and holy symbol over a mace', () => {
    const start = give(heroProfile('human', 'mender'), 'iron-mace', 'it-mace')
    const p = autoEquipBest(content, start, hero(start).id)
    expect(hero(p).equipment.mainHand?.itemId).toBe('copper-censer')
    expect(hero(p).equipment.offHand?.itemId).toBe('copper-holy-symbol')
    expect(bestHands(content, start, hero(start)).main?.def.id).toBe('copper-censer')
  })

  it('is pure: the input profile is untouched and nothing to do returns the same profile', () => {
    const start = give(heroProfile('dwarf', 'warden'), 'iron-shortsword', 'it-iron')
    const snapshot = JSON.stringify(start)
    autoEquipBest(content, start, hero(start).id)
    expect(JSON.stringify(start)).toBe(snapshot)
    const settled = autoEquipBest(content, start, hero(start).id)
    expect(autoEquipBest(content, settled, hero(settled).id)).toBe(settled)
    expect(heroOf(settled, hero(settled).id).equipment.mainHand?.instanceId).toBe('it-iron')
  })
})
