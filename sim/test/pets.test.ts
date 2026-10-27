import { describe, expect, it } from 'vitest'
import { buildPetActor, petActiveIds, petGradeMultiplier, petStats, petXpShare } from '../src/pets.ts'
import type { PetDef, PetInstance } from '../src/types/content.ts'
import { example, loadTuning, makeContent } from './helpers.ts'

const t = loadTuning()
const HOUND = example('pet', 'pet')
const content = makeContent([HOUND])
const def = HOUND.json as PetDef

const inst = (over: Partial<PetInstance> = {}): PetInstance => ({ petId: 'cellar-hound', name: 'Biscuit', grade: 'F', level: 1, xp: 0, bondStars: 0, traitRank: 1, stance: 'guard', ranchImport: null, ...over })

describe('pets (03 §9, D-063)', () => {
  it('grade multiplies ×1.35 per step and actives open by level and grade', () => {
    expect(petGradeMultiplier(t, 'F')).toBe(1)
    expect(petGradeMultiplier(t, 'E')).toBeCloseTo(1.35)
    expect(petActiveIds(t, def, inst())).toEqual([])
    expect(petActiveIds(t, def, inst({ level: 5 }))).toEqual(['pet-hound-bite'])
    expect(petActiveIds(t, def, inst({ level: 15 }))).toEqual(['pet-hound-bite'])
    expect(petActiveIds(t, def, inst({ level: 15, grade: 'B' }))).toEqual(['pet-hound-bite', 'pet-hound-guard-dog'])
  })

  it('stats follow the baseline, the species multipliers, level and bond', () => {
    const f1 = petStats(t, def, inst())
    expect(f1.speed).toBe(120)
    expect(f1.detection).toBe(13)
    expect(f1.hp).toBe(Math.floor(56 * 0.8 + 0.5))
    const e5 = petStats(t, def, inst({ grade: 'E', level: 5, bondStars: 2 }))
    expect(e5.hp).toBeGreaterThan(f1.hp)
    expect(e5.attackPhys).toBeGreaterThan(f1.attackPhys)
  })

  it('builds a party-side actor capped at the owner level, at 50% when returning from a down', () => {
    const a = buildPetActor(content, t, inst({ level: 9 }), { id: 'pet1', ownerId: 'warden', ownerLevel: 4, hpPercent: 50 })
    expect(a.side).toBe('party')
    expect(a.kind).toBe('pet')
    expect(a.level).toBe(4)
    expect(a.hp).toBe(Math.floor(a.maxHp / 2 + 0.5))
    expect(a.pet?.stance).toBe('guard')
    expect(a.pet?.traitEffects[0]?.customId).toBe('party-ambush-modifier')
    expect(a.row).toBe('front')
    expect(() => buildPetActor(content, t, inst({ petId: 'nope' }), { id: 'x', ownerId: 'w', ownerLevel: 1 })).toThrow()
  })

  it('XP share is half the owner’s, a treat adds 10%', () => {
    expect(petXpShare(t, 100, false)).toBe(50)
    expect(petXpShare(t, 100, true)).toBe(55)
  })
})
