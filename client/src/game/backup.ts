import type { BackupReminder, Profile } from '../../../sim/src/town.ts'

/**
 * The backup reminder (10 §6: "a reminder every ~7 days of play"; Phase 8, pass B). A day of play is a local calendar
 * day on which the town was opened; after `every` of them since the last backup (or since the last "not now") the town
 * offers Download save / Share save. Never during a delve. The clock is the client's: callers pass the day and the
 * time, the sim never reads one. Pure, tested in node.
 */

const EMPTY: BackupReminder = { playDays: 0, lastPlayDay: null, lastBackupAt: null }

/** "2026-10-28": a local calendar day from the client's clock. */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Counts `day` as a day of play, once (the same profile object back when it is already counted). */
export function countPlayDay(p: Profile, day: string): Profile {
  const b = p.backup ?? EMPTY
  if (b.lastPlayDay === day) return p
  return { ...p, backup: { ...b, playDays: b.playDays + 1, lastPlayDay: day } }
}

/** The reminder is due: `every` days of play since the last backup, a hero to lose, and no delve in progress. */
export function backupDue(p: Profile, every: number): boolean {
  return p.activeDelve === null && p.heroes.length > 0 && (p.backup?.playDays ?? 0) >= Math.max(1, every)
}

/** A download or a share went through: the count starts again. */
export function markBackedUp(p: Profile, now: Date): Profile {
  return { ...p, backup: { ...(p.backup ?? EMPTY), playDays: 0, lastBackupAt: now.toISOString() } }
}

/** "Not now": the count starts again without a backup. */
export function remindLater(p: Profile): Profile {
  return { ...p, backup: { ...(p.backup ?? EMPTY), playDays: 0 } }
}

/** "Your last backup was 9 days ago." / "You have not kept a backup of this save yet." */
export function lastBackupWords(p: Profile, now: Date): string {
  const at = p.backup?.lastBackupAt ? Date.parse(p.backup.lastBackupAt) : NaN
  if (!Number.isFinite(at)) return 'You have not kept a backup of this save yet.'
  const days = Math.max(0, Math.floor((now.getTime() - at) / 86_400_000))
  return days === 0 ? 'Your last backup was today.' : days === 1 ? 'Your last backup was yesterday.' : `Your last backup was ${days} days ago.`
}
