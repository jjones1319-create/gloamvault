import { describe, expect, it } from 'vitest'
import { advanceToward, BOSS_STANDOFF_M, BOSS_STANDOFF_PER_M, type Mark } from './layout.ts'

const marks = (pts: [string, number, number][]) => new Map<string, Mark>(pts.map(([id, x, z]) => [id, { x, z, yaw: 0.3 }]))
// The camera looks toward −z (it stands at +z): "into the picture" is −z.
const camDir = { x: 0, z: 1 }

describe('the fight comes to a boss on an arena mark at the back (Phase 8)', () => {
  it('every mark moves the same way straight into the picture until the middle stands the standoff before him', () => {
    const before = marks([
      ['hero-0', -2, 1],
      ['hero-1', -3, -1],
      ['adds-0', 2, 0],
    ])
    const out = advanceToward(before, { x: 0, z: -7 }, camDir)
    const mid = [...out.values()].reduce((s, m) => s + m.z, 0) / out.size
    expect(mid).toBeCloseTo(-7 + BOSS_STANDOFF_M, 6)
    for (const [id, m] of out) {
      expect(m.x).toBe(before.get(id)!.x)
      expect(m.yaw).toBe(0.3)
      expect(m.z - before.get(id)!.z).toBeCloseTo(-7 + BOSS_STANDOFF_M, 6)
    }
  })

  it('a raised mark keeps the fight further off (the dais before the throne)', () => {
    const before = marks([['hero-0', 0, 0]])
    const flat = advanceToward(before, { x: 0, z: -9 }, camDir).get('hero-0')!.z
    const raised = advanceToward(before, { x: 0, y: 1, z: -9 }, camDir).get('hero-0')!.z
    expect(raised - flat).toBeCloseTo(BOSS_STANDOFF_PER_M, 6)
  })

  it('a boss already close, or in front of the fight, leaves it where it is', () => {
    const before = marks([['hero-0', 0, -1]])
    expect(advanceToward(before, { x: 0, z: -2 }, camDir).get('hero-0')).toEqual(before.get('hero-0'))
    expect(advanceToward(before, { x: 0, z: 4 }, camDir).get('hero-0')).toEqual(before.get('hero-0'))
    expect(advanceToward(new Map(), { x: 0, z: -9 }, camDir).size).toBe(0)
  })

  it('works along any camera direction', () => {
    const out = advanceToward(marks([['a', 0, 0]]), { x: 10, z: 0 }, { x: -1, z: 0 })
    expect(out.get('a')!.x).toBeCloseTo(10 - BOSS_STANDOFF_M, 6)
    expect(out.get('a')!.z).toBeCloseTo(0, 6)
  })
})
