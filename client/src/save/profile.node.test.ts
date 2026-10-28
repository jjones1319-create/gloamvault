import path from 'node:path'
import { describe, expect, it } from 'vitest'
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

  it('a version-1 save migrates to version 2 and keeps its death rule (D-095)', () => {
    const fixture = { ...profileWithHero(), saveVersion: 1, deathRule: 'sheltered' }
    const r = validateProfile(content, JSON.parse(JSON.stringify(fixture)))
    expect(SAVE_VERSION).toBe(2)
    expect(r.profile?.saveVersion).toBe(2)
    expect(r.profile?.deathRule).toBe('sheltered')
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
