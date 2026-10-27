import { lightBand, shiftedBand, type LightBandRow } from './light.ts'
import type { Rng } from './rng.ts'
import { clamp, roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'

/**
 * Perception at work (03-GAME-DESIGN §4.3–§4.4): Detection against traps, secrets and hidden treasure, scouting,
 * and the surprise roll both ways. Pure rolls; the explore module gathers the inputs.
 */

/** Detection = Perception + the light band's bonus (07 §2.3: +4 / +2 / 0 / −3 / −6) + skills + pet. */
export function detection(t: Tuning, perception: number, light: number, darkvisionShift: number, skillAndPetBonus: number): number {
  const band = shiftedBand(t, lightBand(t, light), darkvisionShift)
  return perception + band.detection + skillAndPetBonus
}

export function trapRevealed(bestDetection: number, difficulty: number): boolean {
  return bestDetection >= difficulty
}

/** Trap Disarm: 50% + 2% × (rank × 5 − difficulty / 2), per 07 §2.5's reading of 03 §4.3 (D-059). */
export function disarmChance(t: Tuning, trapDisarmRank: number, difficulty: number): number {
  const d = t.exploration.detection.disarm
  return clamp(roundHalfUp(d.basePercent + d.perPoint * (trapDisarmRank * 5 - difficulty / d.difficultyDivisor)), 5, 95)
}

export function secretRevealed(bestDetection: number, difficulty: number): boolean {
  return bestDetection >= difficulty
}

/** Hidden treasure: the Detection check plus a find roll of 60 × (Det − 10) / (Det + 30) %. */
export function hiddenFindChance(t: Tuning, bestDetection: number): number {
  const f = t.exploration.detection.treasureFind
  const x = bestDetection - f.offset
  if (x <= 0) return 0
  return clamp(roundHalfUp((f.multiplier * x) / (bestDetection + f.k)), 0, 95)
}

/** Scouting on entering a room: 25% + light bonus + 5 per Ranger + the pet's Forage bonus; half of successes are critical. */
export function scoutChance(t: Tuning, light: number, darkvisionShift: number, rangers: number, petForageBonus: number, extra = 0): number {
  const s = t.exploration.detection.scouting
  const band = shiftedBand(t, lightBand(t, light), darkvisionShift)
  return clamp(s.basePercent + band.scouting + s.perRanger * rangers + petForageBonus + extra, 0, 95)
}

export function rollScout(t: Tuning, rng: Rng, chance: number): 'none' | 'scout' | 'critical' {
  if (!rng.pct(chance)) return 'none'
  return rng.pct(t.exploration.detection.scouting.criticalShare * 100) ? 'critical' : 'scout'
}

/** The Perception term of the surprise roll: 30 × (Per − 10) / (Per + 10) → Per 20 −10, Per 30 −15 (D-058). */
export function perceptionAmbushBonus(t: Tuning, perception: number): number {
  const c = t.exploration.ambush.perceptionCurve
  const x = perception - c.offset
  if (x <= 0) return 0
  return roundHalfUp((c.multiplier * x) / (perception + c.k))
}

export interface AmbushInputs {
  light: number
  /** The band the best-Perception hero reads (darkvision), for the hero-side roll. */
  darkvisionShift: number
  bestPerception: number
  /** The family's modifier or the highest individual modifier in the encounter, never the sum (06 §8.3). */
  monsterModifier: number
  orcsInParty: number
  shadesInParty: number
  /** Pacts, traps (the Tripwire Bell's +30) and curios. */
  extra: number
}

/** Chance the party is surprised (§4.4): 15 + band + family − Perception + noisy Orcs − stealthy Shades + extras. */
export function heroAmbushChance(t: Tuning, input: AmbushInputs): number {
  const a = t.exploration.ambush
  const band: LightBandRow = shiftedBand(t, lightBand(t, input.light), input.darkvisionShift)
  const chance =
    a.basePercent +
    band.heroesAmbushed +
    input.monsterModifier -
    perceptionAmbushBonus(t, input.bestPerception) +
    (input.orcsInParty > 0 ? a.orcNoisy : 0) +
    (input.shadesInParty > 0 ? a.shadeInParty : 0) +
    input.extra
  return clamp(chance, 0, 95)
}

/**
 * Chance the party surprises the monsters: the same shape from the monsters' side of the band and the party's
 * Perception, less the slowest hero's Speed shortfall below 100 (a plate-clad party is loud) — D-058's reading of
 * "the same curve on the party's lowest Speed penalty". Family modifiers never apply (06 §8.3).
 */
export function monsterAmbushChance(t: Tuning, light: number, bestPerception: number, lowestHeroSpeed: number, extra = 0): number {
  const a = t.exploration.ambush
  const band = lightBand(t, light)
  const speedTerm = clamp(roundHalfUp((lowestHeroSpeed - 100) / 4), -10, 10)
  return clamp(a.basePercent + band.monstersAmbushed + perceptionAmbushBonus(t, bestPerception) + speedTerm + extra, 0, 95)
}
