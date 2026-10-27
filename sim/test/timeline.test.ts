import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Rng } from '../src/rng.ts'
import { ACT_AT, advance, beginCharge, finishCharge, forecast, initialEnergy, interruptCharge, spend, ticksToReady, type TimelineActor } from '../src/timeline.ts'
import type { Tuning } from '../src/tuning.ts'

const t = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning
const noJitter: Tuning = { ...t, combat: { ...t.combat, jitterPercent: 0 } }

const actor = (id: string, speed: number, energy = 0): TimelineActor => ({ id, speed, energy, alive: true, charging: null })

describe('the speed timeline (03 §3.1)', () => {
  it('Speed 150 acts 1.5× as often as Speed 100 at equal weights', () => {
    const fast = actor('fast', 150)
    const slow = actor('slow', 100)
    const actors = [fast, slow]
    const rng = Rng.fromSeed(1)
    const counts = { fast: 0, slow: 0 }
    for (let i = 0; i < 250; i++) {
      const next = advance(actors)
      if (!next) break
      counts[next.actor.id as 'fast' | 'slow']++
      spend(noJitter, next.actor, 1000, rng)
    }
    expect(counts.fast / counts.slow).toBeCloseTo(1.5, 1)
  })

  it('a dagger user at Speed 150 gets ≈ 2.6 actions per greatsword action at Speed 100', () => {
    const dagger = actor('dagger', 150)
    const great = actor('great', 100)
    const actors = [dagger, great]
    const rng = Rng.fromSeed(2)
    const counts = { dagger: 0, great: 0 }
    for (let i = 0; i < 360; i++) {
      const next = advance(actors)
      if (!next) break
      counts[next.actor.id as 'dagger' | 'great']++
      spend(noJitter, next.actor, next.actor.id === 'dagger' ? 800 : 1400, rng)
    }
    expect(counts.dagger / counts.great).toBeGreaterThan(2.45)
    expect(counts.dagger / counts.great).toBeLessThan(2.75)
  })

  it('ticksToReady and advance move everyone by the same ticks; ties go to the higher energy then Speed', () => {
    const a = actor('a', 100, 500)
    const b = actor('b', 125, 500)
    expect(ticksToReady(a)).toBe(5)
    expect(ticksToReady(b)).toBe(4)
    const next = advance([a, b])
    expect(next?.actor.id).toBe('b')
    expect(next?.ticks).toBe(4)
    expect(a.energy).toBe(900)
    expect(b.energy).toBe(1000)
    const c = actor('c', 100, 1200)
    const d = actor('d', 90, 1200)
    expect(advance([d, c])?.actor.id).toBe('c')
    const e = actor('e', 100, 1200)
    const f = actor('f', 100, 1200)
    expect(advance([e, f])?.actor.id).toBe('e')
    expect(advance([{ ...a, alive: false }])).toBeNull()
  })

  it('jitter keeps each cost within ±10% and the order is not lockstep', () => {
    const rng = Rng.fromSeed(7)
    const x = actor('x', 100, 1000)
    const costs = new Set<number>()
    for (let i = 0; i < 50; i++) {
      x.energy = 1000
      const c = spend(t, x, 1000, rng)
      expect(c).toBeGreaterThanOrEqual(900)
      expect(c).toBeLessThanOrEqual(1100)
      costs.add(c)
    }
    expect(costs.size).toBeGreaterThan(5)
  })

  it('charged casts (D-029): −400 at declaration, the rest when it resolves; a hit pushes −300 unless concentration holds', () => {
    const caster = actor('caster', 100, 1000)
    beginCharge(noJitter, caster, 1400)
    expect(caster.energy).toBe(600)
    expect(caster.charging).toEqual({ weight: 1400, chargePaid: 400 })
    const rng = Rng.fromSeed(3)
    // Willpower 10: 30% to hold. Count outcomes over many trials.
    let held = 0
    for (let i = 0; i < 2000; i++) {
      const c = actor('c', 100, 600)
      c.charging = { weight: 1400, chargePaid: 400 }
      if (interruptCharge(t, c, 10, rng) === 'held') held++
      else expect(c.energy).toBe(300)
    }
    expect(held / 20).toBeGreaterThan(26)
    expect(held / 20).toBeLessThan(34)
    expect(interruptCharge(t, actor('n', 100), 10, rng)).toBe('notCharging')
    caster.energy = 1000
    const paid = finishCharge(noJitter, caster, rng)
    expect(paid).toBe(1400)
    expect(caster.energy).toBe(0)
    expect(caster.charging).toBeNull()
  })

  it('initiative: 0–400, the surprised side at 0, the other side +500', () => {
    const rng = Rng.fromSeed(4)
    for (let i = 0; i < 100; i++) {
      const e = initialEnergy(t, rng, 'heroes', null)
      expect(e).toBeGreaterThanOrEqual(0)
      expect(e).toBeLessThanOrEqual(400)
    }
    expect(initialEnergy(t, rng, 'heroes', 'heroes')).toBe(0)
    const m = initialEnergy(t, rng, 'monsters', 'heroes')
    expect(m).toBeGreaterThanOrEqual(500)
    expect(m).toBeLessThanOrEqual(900)
  })

  it('the strip forecasts eight actors in order without touching the real queue', () => {
    const rat = actor('rat', 125, 250)
    const warden = actor('warden', 81, 380)
    const spider = actor('spider', 115, 120)
    const strip = forecast([rat, warden, spider], 8)
    expect(strip).toHaveLength(8)
    expect(strip[0]).toBe('rat')
    expect(strip.filter((id) => id === 'rat').length).toBeGreaterThan(strip.filter((id) => id === 'warden').length)
    expect(rat.energy).toBe(250)
    expect(warden.energy).toBe(380)
    expect(ACT_AT).toBe(1000)
  })
})
