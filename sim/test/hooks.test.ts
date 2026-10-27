import { describe, expect, it } from 'vitest'
import { applyLine, dealDamage, type EffectContext } from '../src/effects.ts'
import { createFight } from '../src/fight.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import { linesAtRank } from '../src/skill-lines.ts'
import { countDownStatuses } from '../src/statuses.ts'
import type { Effect, MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

const tuning = exactTuning(loadTuning())
const content = makeContent([example('monster', 'monster')])
const ratDef = content.monsters.get('giant-rat') as MonsterDef

function setup(heroes: ReturnType<typeof makeHeroActor>[], seed = 7) {
  const rat = buildMonsterActor(content, tuning, ratDef, { id: 'rat', level: 1, row: 'front', hpPercent: 100 })
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets: [], monsters: [rat], surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  const ctx: EffectContext = { content, t: tuning, state, rng }
  return { ctx, rat, state }
}

const SOURCE = { kind: 'skill' as const, id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: true }
const RAT_BITE = { kind: 'attack' as const, id: 'bite', label: 'bite', isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: true }

describe('persistent hooks', () => {
  it('Counter Stance answers the first melee hit until the next turn, then drops', () => {
    const hero = makeHeroActor(tuning, { id: 'w', attributes: { strength: 14 }, flat: { accuracy: 100 } })
    const { ctx, rat } = setup([hero])
    const line: Effect = { kind: 'custom', customId: 'counter-stance', multiplier: 1, amount: 1, target: 'self' }
    applyLine(ctx, hero, line, 'self', hero, SOURCE)
    expect(hero.hooks.map((h) => h.customId)).toEqual(['counter-stance'])
    const before = rat.hp
    dealDamage(ctx, rat, hero, { amount: 10, damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: false, sourceLabel: 'bite' })
    expect(rat.hp).toBeLessThan(before)
    expect(hero.hooks).toEqual([])
    // A second bite is not answered.
    const after = rat.hp
    dealDamage(ctx, rat, hero, { amount: 10, damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: false, sourceLabel: 'bite' })
    expect(rat.hp).toBe(after)
    expect(ctx.state.log.some((e) => e.kind === 'damage' && e.text.includes('counter'))).toBe(true)
  })

  it('Intercept moves a single-target hit from the ally onto the Warden at −10%', () => {
    const warden = makeHeroActor(tuning, { id: 'w', flatHp: 100 })
    const ally = makeHeroActor(tuning, { id: 'a', row: 'back' })
    const { ctx, rat } = setup([warden, ally])
    applyLine(ctx, warden, { kind: 'custom', customId: 'intercept-single-target', duration: 2, percent: -10 }, 'ally', ally, SOURCE)
    expect(ally.hooks[0]?.sourceId).toBe('w')
    const allyHp = ally.hp
    const out = applyLine(ctx, rat, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', ally, { ...RAT_BITE, reach: true })
    expect(out.targets).toEqual(['w'])
    expect(ally.hp).toBe(allyHp)
    expect(warden.hp).toBeLessThan(warden.maxHp)
    expect(ctx.state.log.some((e) => e.kind === 'intercept')).toBe(true)
  })

  it('Vampiric heals the attacker for 30% of the damage dealt, halved against Burn', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 200 })
    const { ctx, rat } = setup([hero])
    installHook(rat, { kind: 'custom', customId: 'lifesteal-percent', percent: 30 }, rat.id)
    rat.hp = 10
    const out = applyLine(ctx, rat, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', hero, RAT_BITE)
    const dealt = out.results[0]?.dealt ?? 0
    expect(dealt).toBeGreaterThan(0)
    expect(rat.hp).toBe(10 + Math.round((dealt * 30) / 100))
  })

  it('hooks with a duration count down at the holder\'s turn end and expire', () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    setup([hero])
    installHook(hero, { kind: 'custom', customId: 'lifesteal-percent', percent: 10 }, hero.id, { turnsLeft: 2 })
    expect(hero.hooks).toHaveLength(1)
    countDownStatuses(hero)
    expect(hero.hooks).toHaveLength(1)
    countDownStatuses(hero)
    expect(hero.hooks).toHaveLength(0)
  })
})

describe('Mastery merging', () => {
  const base: SkillDef = {
    id: 'x',
    classId: 'warden',
    school: 'bulwark',
    tier: 1,
    name: 'X',
    description: 'x',
    type: 'active',
    cost: 5,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 0.6 },
      { kind: 'damage', multiplier: 0.6 },
      { kind: 'custom', customId: 'school-cost-multiplier', percent: -20, target: 'self' },
    ],
    prerequisiteId: null,
    isUltimate: false,
    monsterTechniqueOf: null,
    rankScaling: { effectPerRank: 4, costPerRank: -2 },
    mastery: {
      text: 'three hits; momentum on shout',
      effects: [
        { kind: 'damage', multiplier: 0.6 },
        { kind: 'damage', multiplier: 0.6 },
        { kind: 'damage', multiplier: 0.4 },
        { kind: 'custom', customId: 'momentum-on-shout', amount: 10, target: 'self' },
      ],
    },
    tags: [],
    xpTags: ['strength'],
    aiHints: { role: 'attack', priority: 50 },
  }
  it('replaces the i-th line of the same signature and adds the rest', () => {
    const lines = linesAtRank(base, 10)
    expect(lines.filter((l) => l.kind === 'damage')).toHaveLength(3)
    expect(lines.filter((l) => l.kind === 'custom').map((l) => l.customId)).toEqual(['school-cost-multiplier', 'momentum-on-shout'])
  })
  it('leaves ranks below 10 alone', () => {
    expect(linesAtRank(base, 9)).toEqual(base.effects)
  })
})
