import type { Content } from '../../../../../sim/src/content.ts'
import { heroStats } from '../../../../../sim/src/hero.ts'
import type { HeroRecord } from '../../../../../sim/src/types/content.ts'

/**
 * A hero's maximum HP and pool from the card's derived stats (sim `heroStats`), cached per record: the sim replaces
 * a record when it changes, so a WeakMap keyed by the record is always current.
 */
export interface HeroMax {
  hp: number
  pool: number
  poolKind: 'stamina' | 'mana'
}

const cache = new WeakMap<HeroRecord, HeroMax>()

export function heroMax(content: Content, record: HeroRecord): HeroMax {
  const hit = cache.get(record)
  if (hit) return hit
  const poolKind = content.classes.get(record.classId)?.pool === 'mana' ? 'mana' : 'stamina'
  let out: HeroMax
  try {
    const s = heroStats(content, content.tuning, record)
    out = { hp: Math.max(1, Math.round(s.hp)), pool: Math.max(0, Math.round(poolKind === 'mana' ? s.mana : s.stamina)), poolKind }
  } catch {
    out = { hp: 100, pool: 100, poolKind }
  }
  cache.set(record, out)
  return out
}
