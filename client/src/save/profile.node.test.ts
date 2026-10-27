import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContentDir } from '../../../tools/sim/loadContent.ts'
import { KEYS, memoryStore } from './db.ts'
import { BACKUP_KEYS, exportSave, importSave, readProfile, SAVE_VERSION, validateProfile, writeBackup, writeProfile } from './profile.ts'

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
})
