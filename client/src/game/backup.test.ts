import { describe, expect, it } from 'vitest'
import type { Profile } from '../../../sim/src/town.ts'
import { backupDue, countPlayDay, lastBackupWords, localDay, markBackedUp, remindLater } from './backup.ts'

/** The few profile fields the reminder reads. */
function profile(extra: Partial<Profile> = {}): Profile {
  return { heroes: [{ id: 'hero-1' }], activeDelve: null, ...extra } as unknown as Profile
}

describe('the backup reminder (10 §6: about every 7 days of play)', () => {
  it('counts each local day of play once', () => {
    expect(localDay(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03')
    let p = profile()
    p = countPlayDay(p, '2026-10-01')
    const same = countPlayDay(p, '2026-10-01')
    expect(same).toBe(p)
    p = countPlayDay(p, '2026-10-05')
    expect(p.backup).toEqual({ playDays: 2, lastPlayDay: '2026-10-05', lastBackupAt: null })
  })

  it('is due after seven days of play, never in a delve and never with no hero', () => {
    let p = profile()
    for (let d = 1; d <= 6; d++) p = countPlayDay(p, `2026-10-0${d}`)
    expect(backupDue(p, 7)).toBe(false)
    p = countPlayDay(p, '2026-10-09')
    expect(backupDue(p, 7)).toBe(true)
    expect(backupDue({ ...p, activeDelve: {} as Profile['activeDelve'] }, 7)).toBe(false)
    expect(backupDue({ ...p, heroes: [] }, 7)).toBe(false)
  })

  it('starts again after a backup or a "not now", and says when the last one was', () => {
    let p = profile({ backup: { playDays: 9, lastPlayDay: '2026-10-20', lastBackupAt: null } })
    const now = new Date('2026-10-28T12:00:00Z')
    expect(lastBackupWords(p, now)).toBe('You have not kept a backup of this save yet.')
    p = markBackedUp(p, new Date('2026-10-19T12:00:00Z'))
    expect(p.backup).toEqual({ playDays: 0, lastPlayDay: '2026-10-20', lastBackupAt: '2026-10-19T12:00:00.000Z' })
    expect(lastBackupWords(p, now)).toBe('Your last backup was 9 days ago.')
    expect(lastBackupWords(p, new Date('2026-10-20T13:00:00Z'))).toBe('Your last backup was yesterday.')
    const later = remindLater({ ...p, backup: { ...p.backup!, playDays: 8 } })
    expect(later.backup!.playDays).toBe(0)
    expect(later.backup!.lastBackupAt).toBe('2026-10-19T12:00:00.000Z')
  })
})
