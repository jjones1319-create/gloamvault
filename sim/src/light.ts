import { clamp } from './stats.ts'
import type { Tuning } from './tuning.ts'

/** The light meter (03-GAME-DESIGN §4.2, D-016): one dial, five bands, every number from tuning.json. */
export type LightBandId = 'radiant' | 'dim' | 'shadowy' | 'dark' | 'pitch'

export type LightBandRow = Tuning['exploration']['light']['bands'][number]

export function lightBand(t: Tuning, light: number): LightBandRow {
  const l = clamp(light, 0, t.exploration.light.max)
  for (const band of t.exploration.light.bands) if (l >= band.min && l <= band.max) return band
  return t.exploration.light.bands[t.exploration.light.bands.length - 1] as LightBandRow
}

/** The band an actor reads, shifted by darkvision (−1 = one band brighter); the loot bonus stays at the true band. */
export function shiftedBand(t: Tuning, band: LightBandRow, shift: number): LightBandRow {
  const bands = t.exploration.light.bands
  const index = bands.findIndex((b) => b.id === band.id)
  const next = clamp(index + shift, 0, bands.length - 1)
  return bands[next] as LightBandRow
}

export function addLight(t: Tuning, light: number, amount: number): number {
  return clamp(light + amount, 0, t.exploration.light.max)
}

/** Entering a room: −5 new, −1 revisited. */
export function lightAfterRoom(t: Tuning, light: number, revisited: boolean): number {
  return addLight(t, light, revisited ? t.exploration.light.perRevisitedRoom : t.exploration.light.perNewRoom)
}

/** A floor's entry lantern sets the light when the party's is below it; it never lowers it (07 §2.3). */
export function lightAtEntry(t: Tuning, light: number, lanternSets: number): number {
  return Math.max(clamp(light, 0, t.exploration.light.max), lanternSets)
}
