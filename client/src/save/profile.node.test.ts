import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultLook } from '../../../sim/src/look.ts'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContentDir } from '../../../tools/sim/loadContent.ts'
import { KEYS, memoryStore } from './db.ts'
import { addToHall, HALL_KEY, HALL_MAX, readHall, validateHall } from './hall.ts'
import { BACKUP_KEYS, endRun, exportSave, importSave, readProfile, SAVE_VERSION, validateProfile, writeBackup, writeProfile } from './profile.ts'

const content = loadContentDir(path.resolve('content'))

function profileWithHero() {
  return addHero(content, newProfile(3), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: 'cellar-hound' }).profile
}

describe('the game save (10 §6)', () => {
  it('round-trips a profile through the store and the export file', async () => {
    const store = memoryStore()
    const p = { ...profileWithHero(), purse: 120 }
    await writeProfile(store, p)
    const back = await readProfile(store, content)
    expect(back.profile).toEqual(p)
    expect(back.notes).toEqual([])
    const file = exportSave(p, new Date('2026-10-27T12:00:00Z'))
    expect(JSON.parse(file).saveVersion).toBe(SAVE_VERSION)
    expect(importSave(content, file).profile).toEqual(p)
  })

  it('a version-1 fixture loads (the migration chain starts here)', () => {
    const fixture = { ...profileWithHero(), saveVersion: 1 }
    expect(validateProfile(content, JSON.parse(JSON.stringify(fixture))).profile?.heroes[0]?.name).toBe('Orrin')
  })

  it('clamps and repairs instead of crashing: unknown items, negative gold, a missing hero in the party', () => {
    const p = profileWithHero()
    const hero = p.heroes[0]!
    const broken = {
      ...p,
      purse: -50,
      partyIds: ['nobody', hero.id],
      armory: [{ instanceId: 'x', itemId: 'sword-of-a-removed-patch', durability: 500 }],
      heroes: [{ ...hero, equipment: { ...hero.equipment, helmet: { ...hero.equipment.helmet!, itemId: 'gone-hat' } } }],
    }
    const r = validateProfile(content, broken)
    expect(r.profile?.purse).toBe(0)
    expect(r.profile?.partyIds).toEqual([hero.id])
    expect(r.profile?.armory).toEqual([])
    expect(r.profile?.heroes[0]?.equipment.helmet).toBeNull()
    expect(r.notes.length).toBeGreaterThan(0)
  })

  it('never throws on garbage, and refuses a save from a newer version', () => {
    for (const junk of [null, 3, 'x', [], { heroes: 'no' }]) expect(validateProfile(content, junk).profile).toBeNull()
    expect(importSave(content, 'not json').profile).toBeNull()
    expect(validateProfile(content, { ...profileWithHero(), saveVersion: SAVE_VERSION + 1 }).notes[0]).toMatch(/newer version/)
  })

  it('falls back to the newest good backup when the main save is damaged', async () => {
    const store = memoryStore()
    const p = profileWithHero()
    await writeBackup(store, { ...p, purse: 1 })
    await writeBackup(store, { ...p, purse: 2 })
    await store.set(KEYS.profile, { broken: true })
    const r = await readProfile(store, content)
    expect(r.profile?.purse).toBe(2)
    expect(r.notes.some((n) => /backup/.test(n))).toBe(true)
    expect(((await store.get(BACKUP_KEYS[1]!)) as { purse: number }).purse).toBe(1)
  })

  it('a version-1 save migrates through to the current version and keeps its death rule (D-095)', () => {
    const fixture = { ...profileWithHero(), saveVersion: 1, deathRule: 'sheltered' }
    const r = validateProfile(content, JSON.parse(JSON.stringify(fixture)))
    expect(SAVE_VERSION).toBe(4)
    expect(r.profile?.saveVersion).toBe(4)
    expect(r.profile?.deathRule).toBe('sheltered')
  })

  it('a version-2 save gives every hero a look from a hash of its id, the delve party too (Phase 5)', () => {
    const p = profileWithHero()
    const second = addHero(content, p, { name: 'Pell', speciesId: 'halfling', classId: 'ranger' }).profile
    // A version-2 fixture: hero records of version 1 with no look, and a delve in progress.
    const strip = (h: (typeof second.heroes)[number]) => {
      const { look: _look, ...rest } = h
      return { ...rest, saveVersion: 1 }
    }
    const fixture = JSON.parse(
      JSON.stringify({
        ...second,
        saveVersion: 2,
        heroes: second.heroes.map(strip),
        activeDelve: { options: { dungeonId: 'gravehollow-keep', floor: 1, seed: 5 }, party: second.heroes.map(strip), commands: [] },
      }),
    )
    expect(fixture.heroes[0].look).toBeUndefined()
    const r = validateProfile(content, fixture)
    expect(r.profile?.saveVersion).toBe(4)
    for (const h of r.profile!.heroes) {
      expect(h.look).toEqual(defaultLook(h.id, content.species.get(h.speciesId)))
      expect(h.saveVersion).toBe(2)
    }
    expect(r.profile?.activeDelve?.party.map((h) => h.look)).toEqual(r.profile?.heroes.map((h) => h.look))
    // Deterministic: the same save loads to the same looks.
    expect(validateProfile(content, fixture).profile?.heroes.map((h) => h.look)).toEqual(r.profile?.heroes.map((h) => h.look))
    // New heroes get the same look the migration would give them.
    expect(second.heroes[1]!.look).toEqual(defaultLook(second.heroes[1]!.id, content.species.get('halfling')))
  })

  it('a version-3 save (Phase 6) loads into version 4 with every Phase 7 field at its default', () => {
    const p = profileWithHero()
    // A version-3 fixture: no board, no kills by preset, no quiver, no witness counts, a delve begun before the update.
    const fixture = JSON.parse(
      JSON.stringify({
        ...p,
        saveVersion: 3,
        activeDelve: { options: { dungeonId: 'gravehollow-keep', floor: 1, seed: 5 }, party: p.heroes, commands: [] },
      }),
    )
    for (const h of fixture.heroes) {
      delete h.quiver
      delete h.techniqueWitness
      delete h.insightPity
    }
    delete fixture.contracts
    if (fixture.progress) delete fixture.progress.bossKillsByDifficulty
    const r = validateProfile(content, fixture)
    expect(r.profile?.saveVersion).toBe(4)
    const hero = r.profile!.heroes[0]!
    expect(hero.name).toBe('Orrin')
    expect(hero.quiver).toBeUndefined() // a missing quiver counts as full (sim/src/ammo.ts)
    expect(hero.techniqueWitness ?? {}).toEqual({})
    expect(r.profile?.activeDelve?.options.dungeonId).toBe('gravehollow-keep')
    // Deterministic, and loading it again changes nothing.
    expect(validateProfile(content, JSON.parse(JSON.stringify(r.profile))).profile).toEqual(r.profile)
  })

  it('clamps a look to what the species has and repairs a broken one', () => {
    const p = profileWithHero()
    const hero = p.heroes[0]!
    const tones = content.species.get('dwarf')!.body.skinTones.length
    const r1 = validateProfile(content, { ...p, heroes: [{ ...hero, look: { frame: 'towering', skin: 99, face: -3, hair: 2.4 } }] })
    expect(r1.profile?.heroes[0]?.look).toEqual({ frame: defaultLook(hero.id, content.species.get('dwarf')).frame, skin: tones - 1, face: 0, hair: 2 })
    const r2 = validateProfile(content, { ...p, heroes: [{ ...hero, look: 'pretty' }] })
    expect(r2.profile?.heroes[0]?.look).toEqual(defaultLook(hero.id, content.species.get('dwarf')))
    expect(r2.profile?.heroes[0]?.name).toBe('Orrin')
  })

  it('a Nightmare save round-trips, and an unknown rule falls back to Mortal', async () => {
    const store = memoryStore()
    await writeProfile(store, { ...profileWithHero(), deathRule: 'nightmare' })
    expect((await readProfile(store, content)).profile?.deathRule).toBe('nightmare')
    expect(validateProfile(content, { ...profileWithHero(), deathRule: 'deathless' }).profile?.deathRule).toBe('mortal')
  })

  it('an ended Nightmare erases the save and every backup, and nothing brings it back', async () => {
    const store = memoryStore()
    const p = { ...profileWithHero(), deathRule: 'nightmare' as const }
    await writeProfile(store, p)
    await writeBackup(store, p)
    await writeBackup(store, p)
    await endRun(store)
    expect((await readProfile(store, content)).profile).toBeNull()
    for (const key of BACKUP_KEYS) expect(await store.get(key)).toBeUndefined()
  })
})

describe('the Hall of Nightmares (D-095)', () => {
  const line = { name: 'Orrin', speciesId: 'dwarf', classId: 'blade', level: 7, dungeonId: 'gravehollow-keep', floor: 3, deepest: 2, delves: 9, wayfarers: 2, how: 'fell' as const }

  it('keeps the newest first, at most HALL_MAX lines, outside the save', async () => {
    const store = memoryStore()
    await addToHall(store, line, new Date('2026-10-27T12:00:00Z'))
    const after = await addToHall(store, { ...line, name: 'Varra' }, new Date('2026-10-28T12:00:00Z'))
    expect(after.map((e) => e.name)).toEqual(['Varra', 'Orrin'])
    expect(after[1]?.endedAt).toBe('2026-10-27T12:00:00.000Z')
    for (let i = 0; i < HALL_MAX + 5; i++) await addToHall(store, line, new Date('2026-10-29T12:00:00Z'))
    expect((await readHall(store)).length).toBe(HALL_MAX)
    expect(HALL_KEY.startsWith('gloamvault/')).toBe(true)
  })

  it('drops lines that do not read and never throws', () => {
    expect(validateHall('junk')).toEqual([])
    expect(validateHall([null, { name: 3 }, { ...line, endedAt: 'x' }]).map((e) => e.name)).toEqual(['Orrin'])
  })
})

describe('Phase 7 pass D: the optional fields (contracts, kills by preset, the quiver, pet traits)', () => {
  it('a profile with a board, kills by preset, a quiver and a grown trait round-trips', async () => {
    const base = profileWithHero()
    const hero = base.heroes[0]!
    const p = {
      ...base,
      heroes: [{ ...hero, quiver: { arrows: 37 }, petInstance: hero.petInstance ? { ...hero.petInstance, traitXp: 95, traitRank: 3 } : null }],
      progress: { ...base.progress, bossKillsByDifficulty: { hard: { 'captain-vexa-marrow': 2 } } },
      contracts: { day: 20_000, week: 2_857, dailies: [{ contractId: 'rat-catcher', band: 1, progress: 12, goal: 30, claimed: false }], weekly: null, keysWeek: 2_857, keysStandard: 1, keysGrand: 0 },
    }
    const store = memoryStore()
    await writeProfile(store, p)
    const back = await readProfile(store, content)
    expect(back.profile).toEqual(p)
  })

  it('clamps them and drops what the content no longer has', () => {
    const base = profileWithHero()
    const hero = base.heroes[0]!
    const broken = JSON.parse(
      JSON.stringify({
        ...base,
        heroes: [{ ...hero, quiver: { arrows: 5000, 'no-such-ammo': 3, bolts: -4 }, petInstance: hero.petInstance ? { ...hero.petInstance, traitXp: -10, traitRank: 99 } : null }],
        progress: { ...base.progress, bossKillsByDifficulty: { hard: { x: 1 }, nightmare: { y: 2 } } },
        contracts: { day: 1, week: 1, dailies: [{ contractId: 'gone-contract', band: 1, progress: 2, goal: 3, claimed: false }, { contractId: 'rat-catcher', band: 1, progress: 99, goal: 30, claimed: false }], weekly: null, keysWeek: 1, keysStandard: -2, keysGrand: 0 },
      }),
    )
    const r = validateProfile(content, broken).profile!
    expect(r.heroes[0]!.quiver).toEqual({ arrows: content.tuning.ammo.carryMax, bolts: 0 })
    if (r.heroes[0]!.petInstance) {
      expect(r.heroes[0]!.petInstance.traitRank).toBe(content.tuning.pets.traitGrowth.usesForRank.length)
      expect(r.heroes[0]!.petInstance.traitXp).toBe(0)
    }
    expect(Object.keys(r.progress.bossKillsByDifficulty ?? {})).toEqual(['hard'])
    expect(r.contracts?.dailies.map((d) => [d.contractId, d.progress])).toEqual([['rat-catcher', 30]])
    expect(r.contracts?.keysStandard).toBe(0)
  })

  it('a board that does not read is dropped (the Quest Board posts a fresh one)', () => {
    const r = validateProfile(content, JSON.parse(JSON.stringify({ ...profileWithHero(), contracts: { day: 'monday' } }))).profile!
    expect(r.contracts).toBeUndefined()
  })
})

describe('Phase 7 pass A: the optional fields (techniques witnessed, the Insight pity, a Tome’s skill)', () => {
  it('a hero with witness counts, an Insight pity and a Tome in the bag round-trips', async () => {
    const p = profileWithHero()
    const hero = p.heroes[0]!
    const tome = { instanceId: 'it-tome-1', itemId: 'skill-tome', quantity: 1, affixes: [], plusN: 0, itemLevel: 1, itemXp: 0, affinities: [], durability: 100, maxDurability: 100, skillId: 'warden-intercept' }
    const withFields = { ...p, heroes: [{ ...hero, techniqueWitness: { 'warden-bone-knights-stand': 3 }, insightPity: 12, bag: [...hero.bag, tome] }], armory: [{ ...tome, instanceId: 'it-tome-2' }] }
    const store = memoryStore()
    await writeProfile(store, withFields)
    const back = await readProfile(store, content)
    expect(back.notes).toEqual([])
    expect(back.profile?.heroes[0]?.techniqueWitness).toEqual({ 'warden-bone-knights-stand': 3 })
    expect(back.profile?.heroes[0]?.insightPity).toBe(12)
    expect(back.profile?.heroes[0]?.bag.find((i) => i.instanceId === 'it-tome-1')?.skillId).toBe('warden-intercept')
    expect(back.profile?.armory.find((i) => i.instanceId === 'it-tome-2')?.skillId).toBe('warden-intercept')
  })

  it('clamps them and drops what the content no longer has', () => {
    const p = profileWithHero()
    const hero = p.heroes[0]!
    const lost = { instanceId: 'it-tome-x', itemId: 'skill-tome', quantity: 1, affixes: [], plusN: 0, itemLevel: 1, itemXp: 0, affinities: [], durability: 100, maxDurability: 100, skillId: 'warden-no-such-skill' }
    const broken = {
      ...p,
      heroes: [{ ...hero, techniqueWitness: { 'warden-bone-knights-stand': 9.6, 'no-such-skill': 4, 'warden-provoke': 2, 'warden-sentinels-sweep': 'x' }, insightPity: 9999, bag: [...hero.bag, lost] }],
    }
    const r = validateProfile(content, JSON.parse(JSON.stringify(broken)))
    const h = r.profile!.heroes[0]!
    // A count for a skill the hero already knows (Provoke) or the game lacks is dropped; the rest is a whole number.
    expect(h.techniqueWitness).toEqual({ 'warden-bone-knights-stand': 10 })
    expect(h.insightPity).toBe(content.tuning.skills.insight.pityUses)
    expect(h.bag.some((i) => i.instanceId === 'it-tome-x')).toBe(false)
    expect(r.notes.some((n) => n.includes('Skill Tome'))).toBe(true)
  })
})
