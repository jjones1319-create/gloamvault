/**
 * Seeded RNG (10-TECH-PLAN §2): xoshiro128** over four u32 words, seeded by splitmix32 from a 64-bit match seed
 * given as two u32 halves. The state is four plain numbers so it serialises into the save and a command log replays
 * bit-for-bit on every phone. 32-bit integer math only; no Math.random anywhere in sim/ (CLAUDE.md).
 */
export interface RngState {
  a: number
  b: number
  c: number
  d: number
}

const TWO_32 = 4294967296

function splitmix32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x9e3779b9) >>> 0
    let z = s
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
    return (z ^ (z >>> 16)) >>> 0
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

/** FNV-1a 32-bit over a string. Used for labels, floor seeds and state hashes. */
export function hashString(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Fold any list of ids and numbers into a 64-bit seed pair, e.g. seedFor(matchSeedHi, matchSeedLo, 'gravehollow-keep', 2). */
export function seedFor(...parts: (string | number)[]): [hi: number, lo: number] {
  let hi = 0x811c9dc5
  let lo = 0x9747b28c
  for (const p of parts) {
    const text = typeof p === 'number' ? `#${p}` : p
    hi = hashString(text, hi)
    lo = hashString(text, (lo ^ 0x5bd1e995) >>> 0)
  }
  return [hi >>> 0, lo >>> 0]
}

export function seedState(hi: number, lo: number): RngState {
  // Both halves feed every word: xoshiro128**'s first output depends on `b` alone, so a word seeded from one half
  // would make every stream sharing that half open with the same draw (found by the generator and loot agents).
  const mixed = (lo ^ Math.imul(hi >>> 0, 0x9e3779b1) ^ 0x6a09e667) >>> 0
  const g = splitmix32(mixed)
  const h = splitmix32((hi ^ Math.imul(lo >>> 0, 0x85ebca6b) ^ 0xbb67ae85) >>> 0)
  const state = { a: (g() ^ h()) >>> 0, b: (g() ^ h()) >>> 0, c: (g() ^ h()) >>> 0, d: (g() ^ h()) >>> 0 }
  if ((state.a | state.b | state.c | state.d) === 0) state.a = 1
  return state
}

export class Rng {
  private s: RngState

  constructor(state: RngState) {
    this.s = { ...state }
  }

  /** A fresh stream from a 64-bit seed (two u32 halves); a single safe integer is split for convenience. */
  static fromSeed(hi: number, lo?: number): Rng {
    if (lo === undefined) {
      const n = Math.abs(Math.trunc(hi))
      return new Rng(seedState(Math.floor(n / TWO_32) >>> 0, n >>> 0))
    }
    return new Rng(seedState(hi, lo))
  }

  /** The serialisable state (a copy). */
  get state(): RngState {
    return { ...this.s }
  }

  set state(next: RngState) {
    this.s = { ...next }
  }

  clone(): Rng {
    return new Rng(this.s)
  }

  /** The next u32. */
  next(): number {
    const s = this.s
    const result = Math.imul(rotl(Math.imul(s.b, 5) >>> 0, 7), 9) >>> 0
    const t = (s.b << 9) >>> 0
    s.c = (s.c ^ s.a) >>> 0
    s.d = (s.d ^ s.b) >>> 0
    s.b = (s.b ^ s.c) >>> 0
    s.a = (s.a ^ s.d) >>> 0
    s.c = (s.c ^ t) >>> 0
    s.d = rotl(s.d, 11)
    return result
  }

  /** A float in [0, 1) with 32 bits of entropy. Deterministic across engines (IEEE double). */
  float(): number {
    return this.next() / TWO_32
  }

  /** An integer in [0, n). n ≤ 0 returns 0. */
  int(n: number): number {
    if (n <= 1) return 0
    return Math.floor(this.float() * n)
  }

  /** An integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    if (max <= min) return min
    return min + this.int(max - min + 1)
  }

  /** True with the given percentage chance (fractions of a point allowed: 0.5 = half a percent). */
  pct(chance: number): boolean {
    if (chance <= 0) return false
    if (chance >= 100) return true
    return this.int(10000) < Math.round(chance * 100)
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('rng.pick: empty list')
    return items[this.int(items.length)] as T
  }

  /** A shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }

  /** Picks by integer weight; zero-weight items never win. Throws when every weight is 0. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0
    for (const item of items) total += Math.max(0, weightOf(item))
    if (total <= 0) throw new Error('rng.weighted: no positive weight')
    let roll = this.int(total)
    for (const item of items) {
      const w = Math.max(0, weightOf(item))
      if (roll < w) return item
      roll -= w
    }
    return items[items.length - 1] as T
  }

  /** ±pct jitter on an integer amount, e.g. jitter(1000, 10) ∈ [900, 1100] (§3.1). */
  jitter(amount: number, pct: number): number {
    if (pct <= 0) return amount
    const span = Math.round((amount * pct) / 100)
    return amount + this.range(-span, span)
  }

  /** A child stream for a named sub-system, so one draw there never shifts the main stream. */
  fork(label: string): Rng {
    const hi = hashString(label, this.next())
    const lo = hashString(label, this.next() ^ 0x27d4eb2f)
    return new Rng(seedState(hi, lo))
  }
}
