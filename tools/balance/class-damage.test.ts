import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../sim/loadContent.ts'
import { classDamageMarkdown, classDamageSpread, damageScore, measureClassDamage, measureHero, rankForLevel, setupKind, type ClassDamageRow } from './class-damage.ts'

/** The class-damage measure (12 Phase 7, pass A): deterministic rows the balance runner can fold in. */
const content = loadContentDir(path.resolve('content'))

describe('the class-damage measure', () => {
  const opts = { classIds: ['ranger', 'shade', 'blade'], levels: [1], fights: 2, kits: false } as const
  const rows = measureClassDamage(content, opts)

  it('gives one row per class × level × zone, every number real', () => {
    expect(rows).toHaveLength(3 * 3)
    for (const r of rows) {
      expect(r.singleTargetPerRound).toBeGreaterThan(0)
      expect(r.damagePerRound).toBeGreaterThan(0)
      expect(r.fights).toBe(2)
      expect(r.loadout.length).toBeGreaterThan(0)
      expect(r.monsterLevel).toBe(r.level)
    }
  })

  it('is deterministic', () => {
    expect(measureClassDamage(content, opts)).toEqual(rows)
  })

  it('spreads the damage dealers per level, over every zone first', () => {
    const lines = classDamageSpread(rows)
    const all = lines.find((l) => l.level === 1 && l.zoneId === 'all')
    expect(all).toBeDefined()
    expect(all!.ratio).toBeGreaterThanOrEqual(1)
    expect(all!.maxValue).toBeGreaterThanOrEqual(all!.minValue)
    expect(classDamageMarkdown(rows)).toMatch(/Level 1: the damage dealers run/)
  })

  it('leaves the tank and the support out of the spread', () => {
    const fake = (classId: string, role: ClassDamageRow['role'], v: number): ClassDamageRow => ({ classId, kitId: null, variant: classId, role, level: 5, zoneId: 'z', floor: 4, monsterLevel: 5, loadout: [], fights: 1, wins: 1, rounds: 1, roundsToKill: 1, damagePerRound: v, singleTargetPerRound: v, damagePerAction: v, damagePerPool: null })
    const lines = classDamageSpread([fake('blade', 'damage', 60), fake('ranger', 'damage', 50), fake('mender', 'support', 10), fake('warden', 'tank', 200)])
    expect(lines.find((l) => l.zoneId === 'all')).toMatchObject({ maxClass: 'blade', minClass: 'ranger', ratio: 1.2 })
  })

  it('scripts the hero: the setup skill opens, the loadout is the strongest it can hold, ranks grow with level', () => {
    const shade = measureHero(content, 'shade', 5, 1)
    const veil = content.skills.get('shade-veil')!
    expect(setupKind(veil)).toBe('veil')
    expect(shade.loadout.actives).toContain('shade-veil')
    // Backstab from Veil outranks its plain self.
    const backstab = content.skills.get('shade-backstab')!
    expect(damageScore(backstab, 'veil')).toBeGreaterThan(damageScore(backstab))
    expect(rankForLevel(1)).toBe(1)
    expect(rankForLevel(13)).toBe(7)
    expect(shade.skills.find((k) => k.skillId === shade.loadout.actives[0])?.rank).toBe(rankForLevel(5))
  })
})
