import { describe, expect, it } from 'vitest'
import { Rng, hashString, seedFor, seedState } from '../src/rng.ts'

describe('Rng (xoshiro128** seeded by splitmix32)', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = Rng.fromSeed(17, 4242)
    const b = Rng.fromSeed(17, 4242)
    const c = Rng.fromSeed(17, 4243)
    const seqA = Array.from({ length: 8 }, () => a.next())
    const seqB = Array.from({ length: 8 }, () => b.next())
    const seqC = Array.from({ length: 8 }, () => c.next())
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(4294967296)
    }
  })

  it('round-trips its state through plain JSON (the save holds it)', () => {
    const a = Rng.fromSeed(1, 2)
    a.next()
    a.next()
    const saved = JSON.parse(JSON.stringify(a.state)) as { a: number; b: number; c: number; d: number }
    const b = new Rng(saved)
    expect(b.next()).toBe(a.next())
    expect(b.next()).toBe(a.next())
  })

  it('int and range stay inside their bounds and spread evenly enough', () => {
    const rng = Rng.fromSeed(99)
    const counts = new Array<number>(6).fill(0)
    for (let i = 0; i < 60_000; i++) {
      const v = rng.int(6)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      counts[v]!++
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(600)
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(3, 5)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(5)
    }
    expect(rng.int(0)).toBe(0)
    expect(rng.int(1)).toBe(0)
    expect(rng.range(7, 7)).toBe(7)
  })

  it('pct lands near its chance, including fractions of a point', () => {
    const rng = Rng.fromSeed(5, 6)
    let hits = 0
    for (let i = 0; i < 20_000; i++) if (rng.pct(30)) hits++
    expect(Math.abs(hits / 200 - 30)).toBeLessThan(1.5)
    hits = 0
    for (let i = 0; i < 100_000; i++) if (rng.pct(0.5)) hits++
    expect(Math.abs(hits / 1000 - 0.5)).toBeLessThan(0.15)
    expect(rng.pct(0)).toBe(false)
    expect(rng.pct(100)).toBe(true)
  })

  it('weighted picks follow the weights and skips zero weights', () => {
    const rng = Rng.fromSeed(8)
    const items = [
      { id: 'a', w: 50 },
      { id: 'b', w: 30 },
      { id: 'c', w: 0 },
      { id: 'd', w: 20 },
    ]
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 }
    for (let i = 0; i < 10_000; i++) counts[rng.weighted(items, (x) => x.w).id]!++
    expect(counts.c).toBe(0)
    expect(Math.abs(counts.a! - 5000)).toBeLessThan(250)
    expect(Math.abs(counts.d! - 2000)).toBeLessThan(200)
    expect(() => rng.weighted(items, () => 0)).toThrow()
  })

  it('shuffle is a permutation and jitter stays within ±pct', () => {
    const rng = Rng.fromSeed(3)
    const out = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (let i = 0; i < 500; i++) {
      const j = rng.jitter(1000, 10)
      expect(j).toBeGreaterThanOrEqual(900)
      expect(j).toBeLessThanOrEqual(1100)
    }
    expect(rng.jitter(1000, 0)).toBe(1000)
  })

  it('forks are independent of the parent stream and reproducible', () => {
    const p1 = Rng.fromSeed(11, 12)
    const p2 = Rng.fromSeed(11, 12)
    const p3 = Rng.fromSeed(11, 12)
    const f1 = p1.fork('floor-2')
    const f2 = p2.fork('floor-2')
    const other = p3.fork('floor-3')
    expect(f1.next()).toBe(f2.next())
    expect(f1.next()).not.toBe(other.next())
    // The parents made the same draws, so they stay in step; the children never touched them.
    expect(p1.next()).toBe(p2.next())
  })

  it('the first draw differs across small seeds and across the hi half (no first-draw bias)', () => {
    const firsts = new Set<number>()
    for (let n = 0; n < 16; n++) firsts.add(Rng.fromSeed(n).int(10_000))
    expect(firsts.size).toBeGreaterThan(12)
    const byHi = new Set<number>()
    for (let hi = 0; hi < 16; hi++) byHi.add(Rng.fromSeed(hi, 7).int(10_000))
    expect(byHi.size).toBeGreaterThan(12)
    const pcts = new Set<boolean>()
    for (let n = 0; n < 40; n++) pcts.add(Rng.fromSeed(n * 7919).pct(30))
    expect(pcts.size).toBe(2)
  })

  it('hashString and seedFor are stable', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('gloamvault')).toBe(hashString('gloamvault'))
    expect(hashString('a')).not.toBe(hashString('b'))
    expect(seedFor(17, 'gravehollow-keep', 2)).toEqual(seedFor(17, 'gravehollow-keep', 2))
    expect(seedFor(17, 'gravehollow-keep', 2)).not.toEqual(seedFor(17, 'gravehollow-keep', 3))
    const s = seedState(0, 0)
    expect(s.a | s.b | s.c | s.d).not.toBe(0)
  })

  it('keeps a golden sequence (a change here is a save-breaking change)', () => {
    const rng = Rng.fromSeed(2026, 1026)
    const golden = Array.from({ length: 5 }, () => rng.next())
    // Recorded on 2026-10-26 from this implementation. Changing it changes every seeded replay and save.
    expect(golden).toEqual([2914712096, 3463823006, 3922959370, 940936650, 3482165898])
  })
})
