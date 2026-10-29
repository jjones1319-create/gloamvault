import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CODEX_LIMITS } from '../../../sim/src/codex.ts'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContentDir } from '../../../tools/sim/loadContent.ts'
import { memoryStore } from './db.ts'
import { exportSave, importSave, readProfile, validateProfile, writeProfile } from './profile.ts'

/** Phase 8 pass B's optional profile fields: the codex, the lesson's coach marks and the backup reminder (no version bump). */
const content = loadContentDir(path.resolve('content'))

function profileWithHero() {
  return addHero(content, newProfile(3), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: 'cellar-hound' }).profile
}

describe('Phase 8 pass B: the codex, the coach marks and the backup reminder', () => {
  it('round-trip through the store and the export file', async () => {
    const p = {
      ...profileWithHero(),
      codex: { monsters: { 'giant-rat': { seen: 6, killed: 5, attacks: ['bite'], tells: [] } }, materials: { rawhide: 4 } },
      tutorial: { seen: ['town-first', 'delve-move'], skipped: false },
      backup: { playDays: 3, lastPlayDay: '2026-10-28', lastBackupAt: '2026-10-20T10:00:00.000Z' },
    }
    const store = memoryStore()
    await writeProfile(store, p)
    expect((await readProfile(store, content)).profile).toEqual(p)
    expect(importSave(content, exportSave(p)).profile).toEqual(p)
  })

  it('a save without them gains no keys', () => {
    const r = validateProfile(content, JSON.parse(JSON.stringify(profileWithHero())))
    expect(r.profile).not.toBeNull()
    expect('codex' in r.profile!).toBe(false)
    expect('tutorial' in r.profile!).toBe(false)
    expect('backup' in r.profile!).toBe(false)
  })

  it('clamps what does not fit instead of crashing', () => {
    const long = Array.from({ length: CODEX_LIMITS.attacksPerMonster + 9 }, (_, i) => `attack-${i}`)
    const r = validateProfile(content, {
      ...profileWithHero(),
      codex: {
        monsters: {
          'giant-rat': { seen: -4, killed: 2.5, attacks: ['bite', 'bite', ...long], tells: ['x'.repeat(200)] },
          'plague-rat': 'garbage',
        },
        materials: { rawhide: -1, copper: 1e12 },
      },
      tutorial: { seen: ['a', 'a', 'b', 7], skipped: 'yes' },
      backup: { playDays: -3, lastPlayDay: 'yesterday', lastBackupAt: 12 },
    })
    const p = r.profile!
    const rat = p.codex!.monsters['giant-rat']!
    expect(rat.seen).toBe(0)
    expect(rat.killed).toBe(0)
    expect(rat.attacks).toHaveLength(CODEX_LIMITS.attacksPerMonster)
    expect(rat.attacks.filter((a) => a === 'bite')).toHaveLength(1)
    expect(rat.tells[0]!.length).toBe(CODEX_LIMITS.tellLength)
    expect(p.codex!.monsters['plague-rat']).toEqual({ seen: 0, killed: 0, attacks: [], tells: [] })
    expect(p.codex!.materials).toEqual({ rawhide: 0, copper: CODEX_LIMITS.count })
    expect(p.tutorial).toEqual({ seen: [] })
    expect(p.backup).toEqual({ playDays: 0, lastPlayDay: null, lastBackupAt: null })
  })

  it('drops a block that is not an object (an array reads as its defaults), keeping the rest of the save', () => {
    const r = validateProfile(content, { ...profileWithHero(), codex: 'nope', tutorial: 5, backup: 'later' })
    expect(r.profile?.heroes[0]?.name).toBe('Orrin')
    expect(r.profile && 'codex' in r.profile).toBe(false)
    expect(r.profile && 'tutorial' in r.profile).toBe(false)
    expect(r.profile && 'backup' in r.profile).toBe(false)
  })
})
