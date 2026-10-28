import * as v from 'valibot'
import type { HallRecord } from '../../../sim/src/town.ts'
import { KEY_PREFIX, safeGet, safeSet, type KeyValueStore } from './db.ts'

/**
 * The Hall of Nightmares (D-095): one line for each Nightmare save that ended when its chosen hero died. It lives
 * outside the save, because the save itself is gone; it is validated on load like everything else, newest first, and
 * keeps at most HALL_MAX lines.
 */
export const HALL_KEY = `${KEY_PREFIX}hall`
export const HALL_MAX = 50

export interface HallEntry extends HallRecord {
  /** When the run ended (ISO date; the sim never reads the clock, so the client stamps it). */
  endedAt: string
}

const int = (min = 0) => v.fallback(v.pipe(v.number(), v.integer(), v.minValue(min)), min)

const EntrySchema = v.object({
  name: v.string(),
  speciesId: v.string(),
  classId: v.string(),
  level: int(1),
  dungeonId: v.string(),
  floor: int(1),
  deepest: int(),
  delves: int(),
  wayfarers: int(),
  how: v.fallback(v.picklist(['fell', 'wipe']), 'fell'),
  endedAt: v.fallback(v.string(), ''),
})

/** Keeps the lines that read cleanly and drops the rest; never throws. */
export function validateHall(raw: unknown): HallEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HallEntry[] = []
  for (const item of raw) {
    const r = v.safeParse(EntrySchema, item)
    if (r.success) out.push(r.output as HallEntry)
  }
  return out.slice(0, HALL_MAX)
}

export async function readHall(store: KeyValueStore): Promise<HallEntry[]> {
  return validateHall(await safeGet(store, HALL_KEY))
}

/** Adds a run's line at the top and returns the Hall as it now stands. */
export async function addToHall(store: KeyValueStore, record: HallRecord, now: Date): Promise<HallEntry[]> {
  const next = [{ ...record, endedAt: now.toISOString() }, ...(await readHall(store))].slice(0, HALL_MAX)
  await safeSet(store, HALL_KEY, next)
  return next
}
