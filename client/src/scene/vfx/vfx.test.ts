import { describe, expect, it } from 'vitest'
import { ATLAS_CELLS, ATLAS_SIZE, atlasPixels } from './atlas.ts'
import { FX_SHEET, fxPeak } from './fxSheet.ts'
import { CLASS_FX_COLOUR, emit, FX_KINDS, fxForDamage, isFxKind, MAX_PER_EFFECT, moteFor, SCHOOL_SHAPE, SPRITE, STATUS_FX } from './recipes.ts'

function roll(seed = 1): () => number {
  let a = seed
  return () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
}

describe('the effects (generated in code, one draw call)', () => {
  it('every effect is a handful of particles that live under a second and a half', () => {
    for (const kind of FX_KINDS) {
      const ps = emit(kind, { height: 1.8 }, roll())
      expect(ps.length, kind).toBeGreaterThan(0)
      expect(ps.length, kind).toBeLessThanOrEqual(MAX_PER_EFFECT)
      for (const p of ps) {
        expect(p.life + p.delay, kind).toBeLessThan(1.6)
        expect(p.cell).toBeGreaterThanOrEqual(0)
        expect(p.cell).toBeLessThan(ATLAS_CELLS * ATLAS_CELLS)
        expect(p.size0).toBeGreaterThan(0)
      }
    }
  })

  it('a bigger actor gets a bigger effect, a crit a bigger burst; the same roll gives the same effect', () => {
    const small = emit('blunt', { height: 0.6 }, roll())
    const big = emit('blunt', { height: 3.6 }, roll())
    expect(big[0]!.size1).toBeGreaterThan(small[0]!.size1)
    expect(emit('slash', { height: 1.8, crit: true }, roll()).length).toBeGreaterThan(emit('slash', { height: 1.8 }, roll()).length)
    expect(emit('fire', { height: 1.8 }, roll(5))).toEqual(emit('fire', { height: 1.8 }, roll(5)))
  })

  it('status rings lie on the floor, buffs growing and debuffs closing in, in the colour asked for', () => {
    const buff = emit('buff', { height: 1.8, color: 0x123456 }, roll())
    const ring = buff.find((p) => p.flat)!
    expect(ring.color).toBe(0x123456)
    expect(ring.size1).toBeGreaterThan(ring.size0)
    const debuff = emit('debuff', { height: 1.8 }, roll()).find((p) => p.flat)!
    expect(debuff.size1).toBeLessThan(debuff.size0)
  })

  it('an Ultimate bursts in its class colour with its school’s shape', () => {
    const ps = emit('ultimate', { height: 1.8, color: CLASS_FX_COLOUR.warden!, shape: SCHOOL_SHAPE.bulwark! }, roll())
    expect(ps.some((p) => p.cell === SPRITE.hexagon && p.color === CLASS_FX_COLOUR.warden)).toBe(true)
    expect(Object.values(SCHOOL_SHAPE).every((s) => s in SPRITE)).toBe(true)
  })

  it('damage types map to sparks and marks; statuses to their marks', () => {
    expect(fxForDamage('slash')).toBe('slash')
    expect(fxForDamage('frost')).toBe('frost')
    expect(fxForDamage(null)).toBe('blunt')
    expect(STATUS_FX.burn!.fx).toBe('fire')
    expect(isFxKind('heal')).toBe(true)
    expect(isFxKind('nope')).toBe(false)
  })

  it('each kit fx kind has its own slow trickle: drips fall, bubbles and vent smoke rise, fog lingers', () => {
    const r = roll(3)
    expect(moteFor('drip').particle(r).gravity).toBeGreaterThan(0)
    expect(moteFor('bubbles').particle(r).vy).toBeGreaterThan(0)
    expect(moteFor('vent').particle(r).cell).toBe(SPRITE.smoke)
    expect(moteFor('fog').particle(r).life).toBeGreaterThan(3)
    expect(moteFor('glint').particle(r).cell).toBe(SPRITE.star)
    expect(moteFor('whatever').particle(r).cell).toBe(SPRITE.glow)
    for (const k of ['motes', 'embers', 'drip', 'flow', 'splash', 'bubbles', 'glint', 'fog', 'mist', 'vent', 'smoke', 'glow']) {
      const m = moteFor(k)
      expect(m.every[0], k).toBeGreaterThan(0.2)
      expect(m.every[1], k).toBeGreaterThanOrEqual(m.every[0])
    }
  })

  it('the atlas is sixteen white sprites with soft alpha and empty borders', () => {
    const px = atlasPixels()
    expect(px.length).toBe(ATLAS_SIZE * ATLAS_SIZE * 4)
    const cell = ATLAS_SIZE / ATLAS_CELLS
    for (let c = 0; c < ATLAS_CELLS * ATLAS_CELLS; c++) {
      const x0 = (c % ATLAS_CELLS) * cell
      const y0 = Math.floor(c / ATLAS_CELLS) * cell
      let lit = 0
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (px[((y0 + y) * ATLAS_SIZE + x0 + x) * 4 + 3]! > 32) lit++
      expect(lit, `cell ${c}`).toBeGreaterThan(20)
      // The cell's corner pixel is clear (no bleeding into a neighbour under mipmaps).
      expect(px[(y0 * ATLAS_SIZE + x0) * 4 + 3], `cell ${c}`).toBe(0)
    }
  })
})

describe('the effects sheet', () => {
  it('shows every kind once per entry and times each by its own peak (a still catches them all)', () => {
    expect(new Set(FX_SHEET.map((e) => e.label)).size).toBe(FX_SHEET.length)
    for (const kind of FX_KINDS) expect(FX_SHEET.some((e) => e.kind === kind), kind).toBe(true)
    expect(FX_SHEET.filter((e) => e.kind === 'ultimate').map((e) => e.color)).toEqual(Object.values(CLASS_FX_COLOUR).slice(0, 6))
    for (const e of FX_SHEET) {
      const t = fxPeak(e)
      expect(t, e.label).toBeGreaterThan(0.03)
      expect(t, e.label).toBeLessThan(0.8)
      expect(fxPeak(e), e.label).toBe(t)
    }
  })
})
