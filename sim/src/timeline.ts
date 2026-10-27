import type { Rng } from './rng.ts'
import type { Tuning } from './tuning.ts'

/**
 * The speed timeline (03-GAME-DESIGN §3.1, D-004): every actor has an energy accumulator that gains its Speed per
 * tick; at 1,000 it acts and the action's weight (±10% seeded jitter) is subtracted. Haste and Slow scale Speed.
 * Heavy casts charge (D-029): declared at 1,000, they resolve 400 energy later; a hit pushes the caster back 300
 * unless a concentration check passes. Pure functions over a small actor record so the fight module owns the rest.
 */
export interface TimelineActor {
  id: string
  /** Effective Speed after Haste/Slow and status lines (the fight recomputes it). */
  speed: number
  energy: number
  alive: boolean
  /** A declared heavy cast waiting to resolve. */
  charging: { weight: number; chargePaid: number } | null
}

export const ACT_AT = 1000

/** Ticks until this actor reaches the act threshold at its current Speed (0 when already there). */
export function ticksToReady(actor: TimelineActor, actAt = ACT_AT): number {
  if (actor.energy >= actAt) return 0
  const speed = Math.max(1, actor.speed)
  return Math.ceil((actAt - actor.energy) / speed)
}

/**
 * Advances the whole queue to the next ready actor and returns it with the ticks spent. Ties: the highest energy,
 * then the highest Speed, then the earliest in the list, so two phones agree.
 */
export function advance(actors: TimelineActor[], actAt = ACT_AT): { actor: TimelineActor; ticks: number } | null {
  let min = Infinity
  for (const a of actors) {
    if (!a.alive) continue
    const t = ticksToReady(a, actAt)
    if (t < min) min = t
  }
  if (!Number.isFinite(min)) return null
  if (min > 0) for (const a of actors) if (a.alive) a.energy += Math.max(1, a.speed) * min
  let best: TimelineActor | null = null
  for (const a of actors) {
    if (!a.alive || a.energy < actAt) continue
    if (best === null || a.energy > best.energy || (a.energy === best.energy && a.speed > best.speed)) best = a
  }
  return best ? { actor: best, ticks: min } : null
}

/** Pays an action's weight with ±jitter% (§3.1). */
export function spend(t: Tuning, actor: TimelineActor, weight: number, rng: Rng): number {
  const cost = rng.jitter(weight, t.combat.jitterPercent)
  actor.energy -= cost
  return cost
}

/** Declares a heavy cast: pays the charge now; the cast resolves when the actor is next ready (D-029). */
export function beginCharge(t: Tuning, actor: TimelineActor, weight: number): void {
  const charge = t.combat.charge.resolveAfterEnergy
  actor.charging = { weight, chargePaid: charge }
  actor.energy -= charge
}

/** Resolves the charge and pays the rest of the weight (with jitter on the whole weight). */
export function finishCharge(t: Tuning, actor: TimelineActor, rng: Rng): number {
  const c = actor.charging
  if (!c) return 0
  actor.charging = null
  const cost = rng.jitter(c.weight, t.combat.jitterPercent)
  actor.energy -= Math.max(0, cost - c.chargePaid)
  return cost
}

/** A hit on a charging caster: −300 unless the concentration check (30% + 3% per Willpower point above 10) passes. */
export function interruptCharge(t: Tuning, actor: TimelineActor, willpower: number, rng: Rng): 'held' | 'pushed' | 'notCharging' {
  if (!actor.charging) return 'notCharging'
  const chance = t.combat.charge.concentrationBasePercent + t.combat.charge.concentrationPerWillpower * (willpower - 10)
  if (rng.pct(chance)) return 'held'
  actor.energy -= t.combat.charge.interruptPush
  return 'pushed'
}

/** Timeline pushes from effects (Daze −500, Freeze −1,000; positive pulls forward). */
export function pushEnergy(actor: TimelineActor, delta: number): void {
  actor.energy += delta
}

/** Opening energies (§3.1, §4.4): 0–400 at random; the surprised side starts at 0, the other at +500. */
export function initialEnergy(t: Tuning, rng: Rng, side: 'heroes' | 'monsters', surprised: 'heroes' | 'monsters' | null): number {
  if (surprised === side) return 0
  const roll = rng.int(t.combat.initiative.startMax + 1)
  return surprised === null ? roll : roll + t.combat.initiative.surpriseBonus
}

/**
 * The timeline strip (§3.1): the next N actors in order, assuming each pays a normal weight after acting. A pure
 * forecast on copies; the fight shows it, the sim never acts on it.
 */
export function forecast(actors: readonly TimelineActor[], count: number, normalWeight = 1000, actAt = ACT_AT): string[] {
  const sim = actors.filter((a) => a.alive).map((a) => ({ ...a }))
  const out: string[] = []
  let guard = 0
  while (out.length < count && sim.length > 0 && guard++ < 10_000) {
    const next = advance(sim, actAt)
    if (!next) break
    out.push(next.actor.id)
    next.actor.energy -= next.actor.charging ? Math.max(0, next.actor.charging.weight - next.actor.charging.chargePaid) : normalWeight
    next.actor.charging = null
  }
  return out
}
