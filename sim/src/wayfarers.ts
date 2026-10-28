import type { ChestOddsLine, ChestPityState } from './chests.ts'
import type { Content } from './content.ts'
import { createHero, heroAtLevel } from './hero.ts'
import type { Rng } from './rng.ts'
import type { Tuning } from './tuning.ts'
import type { ChestDef, HeroRecord, WayfarerDef } from './types/content.ts'
import { WAYFARER_GRADES, type Grade, type WayfarerGrade } from './types/enums.ts'

/**
 * The Wayfarer Chest (D-091, James: "the only way to get new party members is through the chests"): a sealed writ
 * that calls one named wayfarer of the cast (content/wayfarers/, owned by 04 §7) to the Lantern Inn. Every wayfarer
 * is unique — one already with the player cannot be drawn, one who dies for good returns to the pool ("hopefully
 * redraw them", D-090). Pure and deterministic from the stream.
 */

/** Creation points above the six of 03 §2.3: +1 per grade above D. */
export function wayfarerBonusPoints(grade: WayfarerGrade): number {
  return Math.max(0, WAYFARER_GRADES.indexOf(grade))
}

/** The wayfarers who can still answer: the cast minus those already with the player, in id order. */
export function wayfarerPool(content: Content, owned: ReadonlySet<string>): WayfarerDef[] {
  return [...content.wayfarers.values()].filter((w) => !owned.has(w.id))
}

/** The chest's table for the band (an exact row, else the nearest lower, else the lowest — chests.ts's rule) in hundredths. */
function tableFor(chest: ChestDef, bandGrade: Grade): Map<WayfarerGrade, number> {
  const order: readonly string[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'God']
  const band = order.indexOf(bandGrade)
  let row = chest.oddsByBand.find((r) => r.centreGrade === bandGrade) ?? null
  if (!row) {
    const lower = chest.oddsByBand.filter((r) => order.indexOf(r.centreGrade) < band).sort((a, b) => order.indexOf(b.centreGrade) - order.indexOf(a.centreGrade))
    row = lower[0] ?? [...chest.oddsByBand].sort((a, b) => order.indexOf(a.centreGrade) - order.indexOf(b.centreGrade))[0] ?? null
  }
  if (!row) throw new Error(`wayfarers: "${chest.id}" has no oddsByBand row`)
  const out = new Map<WayfarerGrade, number>()
  for (const g of WAYFARER_GRADES) {
    const pct = row.table[g] ?? 0
    if (pct > 0) out.set(g, Math.round(pct * 100))
  }
  return out
}

/**
 * The Odds sheet: each grade's chance as written, and whether anyone of that grade is left to draw. A grade with
 * nobody left re-rolls among the grades that have someone, so the live chances are the written ones renormalised.
 */
export function wayfarerOddsTable(content: Content, chest: ChestDef, bandGrade: Grade, owned: ReadonlySet<string>): (ChestOddsLine & { left: number; liveChance: number })[] {
  const table = tableFor(chest, bandGrade)
  const pool = wayfarerPool(content, owned)
  const left = (g: WayfarerGrade) => pool.filter((w) => w.grade === g).length
  const liveTotal = [...table].reduce((s, [g, w]) => s + (left(g) > 0 ? w : 0), 0)
  return [...table].map(([g, w]) => ({ grade: g, percent: w / 100, left: left(g), liveChance: liveTotal > 0 && left(g) > 0 ? Math.round((w * 10_000) / liveTotal) / 100 : 0 }))
}

export interface WayfarerDraw {
  wayfarerId: string
  grade: WayfarerGrade
  pityGrade: boolean
  pity: ChestPityState
}

/**
 * One draw: the grade by the band's table among the grades with someone left, then the egg chest's pity read from
 * D (a ≥ C forced on the `plusOneWithin`-th chest without one, a ≥ B on the `plusTwoWithin`-th, D-091), then a
 * wayfarer of that grade uniformly. Null when the whole cast is already with the player.
 */
export function drawWayfarer(content: Content, rng: Rng, chest: ChestDef, bandGrade: Grade, pity: ChestPityState, owned: ReadonlySet<string>): WayfarerDraw | null {
  const pool = wayfarerPool(content, owned)
  if (pool.length === 0) return null
  const table = tableFor(chest, bandGrade)
  const has = (g: WayfarerGrade) => pool.some((w) => w.grade === g)
  const live = [...table].filter(([g]) => has(g))
  // A cast grade the table never names (or a table with nobody left) still draws: evenly among the grades left.
  const choices = live.length > 0 ? live : WAYFARER_GRADES.filter(has).map((g) => [g, 1] as [WayfarerGrade, number])
  let grade = rng.weighted(choices, ([, w]) => w)[0]
  const plusOne = pity.plusOneCounter + 1
  const plusTwo = pity.plusTwoCounter + 1
  let offset = WAYFARER_GRADES.indexOf(grade)
  let pityGrade = false
  const forceAtLeast = (min: number): void => {
    const better = WAYFARER_GRADES.filter((g, i) => i >= min && has(g))
    if (better.length === 0) return
    // The lowest grade that clears the bar and has someone left.
    grade = better[0]!
    offset = WAYFARER_GRADES.indexOf(grade)
    pityGrade = true
  }
  if (offset < 1 && plusOne >= chest.pity.plusOneWithin) forceAtLeast(1)
  if (offset < 2 && plusTwo >= chest.pity.plusTwoWithin) forceAtLeast(2)
  const ofGrade = pool.filter((w) => w.grade === grade)
  const pick = rng.pick(ofGrade)
  return {
    wayfarerId: pick.id,
    grade,
    pityGrade,
    pity: { plusOneCounter: offset >= 1 ? 0 : plusOne, plusTwoCounter: offset >= 2 ? 0 : plusTwo },
  }
}

/**
 * The wayfarer as a hero record (D-091): created like any hero (03 §2.3) with their own points, skills and AI rule,
 * the class's starter kit and no pet, then raised to `level` by battle XP (D-082's level gains).
 */
export function heroFromWayfarer(content: Content, t: Tuning, rng: Rng, def: WayfarerDef, heroId: string, level: number): HeroRecord {
  const hero = createHero(content, t, rng, {
    id: heroId,
    name: def.name,
    speciesId: def.speciesId,
    classId: def.classId,
    freePoints: def.freePoints,
    bonusFreePoints: wayfarerBonusPoints(def.grade),
    starterSkillIds: def.starterSkillIds,
    eggPetId: null,
    ...(def.aiRule ? { aiRule: def.aiRule } : {}),
    ...(def.look ? { look: def.look } : {}),
  })
  return level > 1 ? heroAtLevel(content, t, hero, level) : hero
}
