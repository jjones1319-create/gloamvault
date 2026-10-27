import { describe, expect, it } from 'vitest'
import { applyLine, dealDamage, hookCtx, statOf, type EffectContext, type LineSource } from '../src/effects.ts'
import { createFight } from '../src/fight.ts'
import type { Actor, FightEvent } from '../src/fight-types.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import nextAttacksElement from '../src/skills/custom/next-attacks-element.ts'
import nextSchoolSkillFree from '../src/skills/custom/next-school-skill-free.ts'
import schoolCritRefundPercent from '../src/skills/custom/school-crit-refund-percent.ts'
import veilStrikeBonus from '../src/skills/custom/veil-strike-bonus.ts'
import { mitigate, roundHalfUp } from '../src/stats.ts'
import { applyStatus, hasStatus } from '../src/statuses.ts'
import type { MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor, type HeroSpec } from './helpers.ts'

const tuning = exactTuning(loadTuning())
const K = tuning.derived.defense.mitigationK

function skill(over: Partial<SkillDef> & Pick<SkillDef, 'id' | 'classId' | 'school'>): SkillDef {
  return {
    tier: 1,
    name: over.id,
    description: over.id,
    type: 'active',
    cost: 10,
    weight: 800,
    target: 'enemy',
    effects: [],
    prerequisiteId: null,
    isUltimate: false,
    monsterTechniqueOf: null,
    rankScaling: { effectPerRank: 4, costPerRank: -2 },
    mastery: { text: '', effects: [] },
    tags: [],
    xpTags: ['strength'],
    aiHints: { role: 'attack', priority: 50 },
    ...over,
  }
}

const SKILLS: SkillDef[] = [
  skill({ id: 'shade-veil', classId: 'shade', school: 'shadow', cost: 10, target: 'self' }),
  skill({ id: 'shade-backstab', classId: 'shade', school: 'shadow', cost: 12, effects: [{ kind: 'damage', multiplier: 1.5, damageType: 'pierce' }, { kind: 'custom', customId: 'veil-strike-bonus', percent: 100, amount: 30 }] }),
  skill({ id: 'shade-vital-point', classId: 'shade', school: 'shadow', cost: 20, effects: [{ kind: 'damage', multiplier: 1.9, damageType: 'pierce' }, { kind: 'custom', customId: 'execute-multiplier', multiplier: 3.8, percent: 25 }] }),
  skill({ id: 'shade-vanish', classId: 'shade', school: 'larceny', cost: 15, target: 'self' }),
  skill({ id: 'shade-pickpocket', classId: 'shade', school: 'larceny', cost: 8 }),
  skill({ id: 'arcanist-spark', classId: 'arcanist', school: 'evocation', cost: 20 }),
  skill({ id: 'arcanist-overcharge', classId: 'arcanist', school: 'evocation', type: 'passive', cost: 0, weight: null, target: 'self' }),
  skill({ id: 'arcanist-shatter', classId: 'arcanist', school: 'rime', type: 'passive', cost: 0, weight: null, target: 'self' }),
  skill({ id: 'arcanist-hoarfrost', classId: 'arcanist', school: 'rime', type: 'passive', cost: 0, weight: null, target: 'self' }),
]
const content = makeContent([example('monster', 'monster'), ...SKILLS.map((s) => ({ kind: 'skill' as const, path: `skills/${s.classId}/${s.id}.json`, json: s }))])
const ratDef = content.monsters.get('giant-rat') as MonsterDef

/** A hero that never misses and never crits on its own, so every number below is exact. */
function hero(id: string, extra: Partial<HeroSpec> = {}): Actor {
  return makeHeroActor(tuning, { id, flat: { accuracy: 100, critRate: -100 }, ...extra })
}

function rat(id: string, row: 'front' | 'back' = 'front', hp = 1000): Actor {
  const r = buildMonsterActor(content, tuning, ratDef, { id, level: 1, row, hpPercent: 100 })
  r.maxHp = hp
  r.hp = hp
  return r
}

function setup(party: Actor[], monsters: Actor[], seed = 7) {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes: party, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  const ctx: EffectContext = { content, t: tuning, state, rng }
  return { ctx, state }
}

function src(id: string, kind: LineSource['kind'] = 'skill', isMelee = true): LineSource {
  return { kind, id, label: id, isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee }
}

function push(ctx: EffectContext, e: Partial<FightEvent> & { kind: string }): void {
  ctx.state.log.push({ tick: 0, round: 1, text: '', ...e })
}

/** What one plain hit of `mult` × Attack(phys) deals to `target` (no crit, no variance, neutral type). */
function physHit(ctx: EffectContext, attacker: Actor, target: Actor, mult: number): number {
  return mitigate(roundHalfUp(statOf(ctx, attacker, 'attackPhys') * mult), statOf(ctx, target, 'defense'), K)
}

const FREEZE = { id: 'freeze' as const, stacks: 1, turnsLeft: 1, magnitude: 0, sourceId: null, counter: 0 }
const CHILL = { id: 'chill' as const, stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: null, counter: 0 }

describe('Shade and Arcanist hooks', () => {
  it('next-attacks-element turns the next attack Shadow (on the weapon Attack), applies Wither, then spends itself', () => {
    const w = hero('w')
    const r1 = rat('r1')
    const r2 = rat('r2')
    const { ctx } = setup([w], [r1, r2])
    applyLine(ctx, w, { kind: 'custom', customId: 'next-attacks-element', damageType: 'shadow', status: 'wither', duration: 2, amount: 1, target: 'self' }, 'self', w, src('shade-wraith-step'))
    expect(w.hooks.map((h) => h.customId)).toEqual(['next-attacks-element'])
    const out = applyLine(ctx, w, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', r1, src('basic', 'basic'))
    expect(out.line.damageType).toBe('shadow')
    expect(out.results[0]?.dealt).toBe(physHit(ctx, w, r1, 1))
    expect(hasStatus(r1, 'wither')).toBe(true)
    expect(r1.statuses.find((s) => s.id === 'wither')?.turnsLeft).toBe(2)
    const hook = w.hooks[0]!
    expect(nextAttacksElement.modifyWeight!(hookCtx(ctx, w, null, hook.line, hook), 800)).toBe(800)
    expect(w.hooks).toEqual([])
    const again = applyLine(ctx, w, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', r2, src('basic', 'basic'))
    expect(again.line.damageType).toBe('pierce')
    expect(hasStatus(r2, 'wither')).toBe(false)
  })

  it('chain-damage hits the other enemies for 0.7× spell Attack as Lightning and Shocks them, leaving the main target alone', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    const r1 = rat('r1')
    const r2 = rat('r2')
    const { ctx } = setup([arc], [r1, r2])
    applyLine(ctx, arc, { kind: 'custom', customId: 'chain-damage', multiplier: 0.7, damageType: 'lightning', amount: 2, status: 'shock', duration: 2 }, 'enemy', r1, src('arcanist-arc-chain'))
    const expected = mitigate(roundHalfUp(statOf(ctx, arc, 'attackSpell') * 0.7), statOf(ctx, r2, 'defense'), K)
    expect(expected).toBeGreaterThan(0)
    expect(r2.maxHp - r2.hp).toBe(expected)
    expect(hasStatus(r2, 'shock')).toBe(true)
    expect(r1.hp).toBe(r1.maxHp)
    expect(hasStatus(r1, 'shock')).toBe(false)
  })

  it('consume-dot-burst removes the Poison and deals its remaining ticks ×1.5 at once, past Defense and resistance', () => {
    const w = hero('w')
    const r = rat('r', 'front', 300)
    const { ctx } = setup([w], [r])
    expect(applyStatus(content, tuning, ctx.rng, r, { status: 'poison', duration: 3, sourceId: 'w' }).outcome).toBe('applied')
    const perTick = roundHalfUp((300 * 3) / 100)
    const burst = roundHalfUp(perTick * 3 * 1.5)
    applyLine(ctx, w, { kind: 'custom', customId: 'consume-dot-burst', status: 'poison', multiplier: 1.5 }, 'enemy', r, src('shade-venom-burst'))
    expect(hasStatus(r, 'poison')).toBe(false)
    expect(r.hp).toBe(300 - burst)
    // Nothing to consume: nothing happens.
    applyLine(ctx, w, { kind: 'custom', customId: 'consume-dot-burst', status: 'poison', multiplier: 1.5 }, 'enemy', r, src('shade-venom-burst'))
    expect(r.hp).toBe(300 - burst)
  })

  it('execute-multiplier doubles the hit below 25% HP and leaves a healthier target alone', () => {
    const w = hero('w')
    const low = rat('low')
    const high = rat('high')
    low.hp = 200
    high.hp = 600
    const { ctx } = setup([w], [low, high])
    const dmg = { kind: 'damage' as const, multiplier: 1.9, damageType: 'pierce' as const }
    const exec = { kind: 'custom' as const, customId: 'execute-multiplier', multiplier: 3.8, percent: 25 }
    const first = applyLine(ctx, w, dmg, 'enemy', low, src('shade-vital-point'))
    const dealt = first.results[0]!.dealt
    expect(dealt).toBe(physHit(ctx, w, low, 1.9))
    applyLine(ctx, w, exec, 'enemy', low, src('shade-vital-point'))
    expect(low.hp).toBe(200 - 2 * dealt)
    applyLine(ctx, w, dmg, 'enemy', high, src('shade-vital-point'))
    applyLine(ctx, w, exec, 'enemy', high, src('shade-vital-point'))
    expect(high.hp).toBe(600 - dealt)
  })

  it('guaranteed-crits forces exactly the first damage line to crit', () => {
    const w = hero('w')
    const r = rat('r')
    const { ctx } = setup([w], [r])
    applyLine(ctx, w, { kind: 'custom', customId: 'guaranteed-crits', amount: 1 }, 'enemy', r, src('shade-last-light-out'))
    expect(w.hooks[0]?.counter).toBe(1)
    const dmg = { kind: 'damage' as const, multiplier: 0.9, damageType: 'pierce' as const }
    const a = applyLine(ctx, w, dmg, 'enemy', r, src('shade-last-light-out'))
    expect(a.results[0]!.crit).toBe(true)
    const critAmount = roundHalfUp((roundHalfUp(statOf(ctx, w, 'attackPhys') * 0.9) * statOf(ctx, w, 'critDamage')) / 100)
    expect(a.results[0]!.dealt).toBe(mitigate(critAmount, statOf(ctx, r, 'defense'), K))
    expect(w.hooks).toEqual([])
    const b = applyLine(ctx, w, dmg, 'enemy', r, src('shade-last-light-out'))
    expect(b.results[0]!.crit).toBe(false)
    expect(b.results[0]!.dealt).toBe(physHit(ctx, w, r, 0.9))
  })

  it('free-on-first-action refunds the cost on the first action only', () => {
    const w = hero('w')
    const { ctx } = setup([w], [rat('r')])
    w.pool = w.poolMax - 10
    applyLine(ctx, w, { kind: 'custom', customId: 'free-on-first-action', target: 'self' }, 'self', w, src('shade-veil'))
    expect(w.pool).toBe(w.poolMax)
    w.tally.actions = 1
    w.pool = w.poolMax - 10
    applyLine(ctx, w, { kind: 'custom', customId: 'free-on-first-action', target: 'self' }, 'self', w, src('shade-veil'))
    expect(w.pool).toBe(w.poolMax - 10)
  })

  it('next-school-skill-free makes the next Larceny skill cost 0, not a Shadow one, and never the cast that set it up', () => {
    const w = hero('w')
    const { ctx } = setup([w], [rat('r')])
    applyLine(ctx, w, { kind: 'custom', customId: 'next-school-skill-free', amount: 1, target: 'self' }, 'self', w, src('shade-vanish'))
    const hook = w.hooks[0]!
    const hc = () => hookCtx(ctx, w, null, hook.line, hook)
    const pickpocket = content.skills.get('shade-pickpocket')!
    const veil = content.skills.get('shade-veil')!
    const vanish = content.skills.get('shade-vanish')!
    expect(nextSchoolSkillFree.costPercent!(hc(), pickpocket)).toBe(-100)
    expect(nextSchoolSkillFree.costPercent!(hc(), veil)).toBe(0)
    nextSchoolSkillFree.onSkillUsed!(hc(), vanish)
    expect(w.hooks).toHaveLength(1)
    w.tally.actions += 1
    nextSchoolSkillFree.onSkillUsed!(hc(), pickpocket)
    expect(w.hooks).toEqual([])
  })

  it('party-shatter-bonus: an ally hitting a Frozen enemy crits, deals +30% on top of the Freeze ×1.5, ends the Freeze and pushes it −300', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    const w = hero('w')
    const r = rat('r')
    installHook(arc, { kind: 'custom', customId: 'party-shatter-bonus', percent: 30, energy: -300, target: 'self' }, 'arc', { sourceSkillId: 'arcanist-shatter' })
    const { ctx } = setup([arc, w], [r])
    expect(w.hooks.some((h) => h.customId === 'party-shatter-bonus' && h.sourceId === 'arc')).toBe(true)
    r.energy = 0
    r.statuses.push({ ...FREEZE })
    const out = applyLine(ctx, w, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', r, src('test'))
    const res = out.results[0]!
    expect(res.crit).toBe(true)
    let amount = roundHalfUp((roundHalfUp(statOf(ctx, w, 'attackPhys')) * statOf(ctx, w, 'critDamage')) / 100)
    amount = roundHalfUp((amount * 130) / 100)
    amount = roundHalfUp((amount * 150) / 100)
    expect(res.dealt).toBe(mitigate(amount, statOf(ctx, r, 'defense'), K))
    expect(hasStatus(r, 'freeze')).toBe(false)
    expect(r.energy).toBe(-300)
    // Without the Arcanist standing, a plain hit.
    arc.downed = true
    r.statuses.push({ ...FREEZE })
    const plain = applyLine(ctx, w, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', r, src('test'))
    expect(plain.results[0]!.crit).toBe(false)
    expect(plain.results[0]!.dealt).toBe(mitigate(roundHalfUp((roundHalfUp(statOf(ctx, w, 'attackPhys')) * 150) / 100), statOf(ctx, r, 'defense'), K))
  })

  it('fight-start-apply-status Chills the enemy front row as the fight begins, with Permafrost adding a turn', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    const front = rat('front')
    const back = rat('back', 'back')
    installHook(arc, { kind: 'custom', customId: 'fight-start-apply-status', status: 'chill', duration: 1, target: 'enemyFront' }, 'arc', { sourceSkillId: 'arcanist-hoarfrost' })
    setup([arc], [front, back])
    expect(front.statuses.find((s) => s.id === 'chill')?.turnsLeft).toBe(1)
    expect(hasStatus(back, 'chill')).toBe(false)

    const arc2 = hero('arc2', { pool: 'mana', row: 'back' })
    const both = rat('both')
    installHook(arc2, { kind: 'custom', customId: 'fight-start-apply-status', status: 'chill', duration: 1, target: 'allEnemies' }, 'arc2', { sourceSkillId: 'arcanist-hoarfrost' })
    installHook(arc2, { kind: 'custom', customId: 'chill-duration-bonus', amount: 1, target: 'self' }, 'arc2', { sourceSkillId: 'arcanist-permafrost' })
    setup([arc2], [both])
    expect(both.statuses.find((s) => s.id === 'chill')?.turnsLeft).toBe(2)
  })

  it('school-crit-refund-percent returns 10% of an Evocation skill\'s cost when it crit', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    installHook(arc, { kind: 'custom', customId: 'school-crit-refund-percent', percent: 10, target: 'self' }, 'arc', { sourceSkillId: 'arcanist-overcharge' })
    const { ctx } = setup([arc], [rat('r')])
    const spark = content.skills.get('arcanist-spark')!
    const hook = arc.hooks[0]!
    const hc = () => hookCtx(ctx, arc, null, hook.line, hook)
    arc.pool = arc.poolMax - 20
    push(ctx, { kind: 'action', actorId: 'arc' })
    push(ctx, { kind: 'damage', actorId: 'arc', targetId: 'r', amount: 7, data: { crit: true } })
    schoolCritRefundPercent.onSkillUsed!(hc(), spark)
    expect(arc.pool).toBe(arc.poolMax - 18)
    expect(ctx.state.log.at(-1)?.kind).toBe('poolRefund')
    // No crit, no refund; another school, no refund.
    push(ctx, { kind: 'action', actorId: 'arc' })
    push(ctx, { kind: 'damage', actorId: 'arc', targetId: 'r', amount: 7, data: { crit: false } })
    schoolCritRefundPercent.onSkillUsed!(hc(), spark)
    expect(arc.pool).toBe(arc.poolMax - 18)
    push(ctx, { kind: 'action', actorId: 'arc' })
    push(ctx, { kind: 'damage', actorId: 'arc', targetId: 'r', amount: 7, data: { crit: true } })
    schoolCritRefundPercent.onSkillUsed!(hc(), content.skills.get('shade-pickpocket')!)
    expect(arc.pool).toBe(arc.poolMax - 18)
  })

  it('immune-to-status makes every Blind attempt fail for the duration while other statuses still land', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    const w = hero('w')
    const { ctx } = setup([arc, w], [rat('r')])
    applyLine(ctx, arc, { kind: 'custom', customId: 'immune-to-status', status: 'blind', duration: 3 }, 'allAllies', null, src('arcanist-lantern-of-the-mind'))
    applyLine(ctx, arc, { kind: 'custom', customId: 'immune-to-status', status: 'fear', duration: 3 }, 'allAllies', null, src('arcanist-lantern-of-the-mind'))
    expect(w.hooks.filter((h) => h.customId === 'status-resist-bonus').map((h) => h.line.status)).toEqual(['blind', 'fear'])
    expect(w.hooks[0]?.turnsLeft).toBe(3)
    expect(applyStatus(content, tuning, ctx.rng, w, { status: 'blind', sourceId: null }).outcome).toBe('resisted')
    expect(applyStatus(content, tuning, ctx.rng, w, { status: 'fear', sourceId: null }).outcome).toBe('resisted')
    expect(applyStatus(content, tuning, ctx.rng, w, { status: 'chill', sourceId: null }).outcome).toBe('applied')
    expect(hasStatus(w, 'blind')).toBe(false)
    expect(hasStatus(w, 'chill')).toBe(true)
  })

  it('veil-strike-bonus: the first Backstab from Veil pays the difference; later ones double the line as it resolves', () => {
    const w = hero('w')
    const r = rat('r')
    const { ctx } = setup([w], [r])
    // Last turn: Veil. This turn: Backstab.
    push(ctx, { kind: 'action', actorId: 'w' })
    push(ctx, { kind: 'status', targetId: 'w', data: { status: 'veil' } })
    push(ctx, { kind: 'action', actorId: 'w' })
    const dmg = { kind: 'damage' as const, multiplier: 1.5, damageType: 'pierce' as const }
    const first = applyLine(ctx, w, dmg, 'enemy', r, src('shade-backstab'))
    const dealt = first.results[0]!.dealt
    applyLine(ctx, w, { kind: 'custom', customId: 'veil-strike-bonus', percent: 100, amount: 30 }, 'enemy', r, src('shade-backstab'))
    expect(r.hp).toBe(1000 - 2 * dealt)
    expect(w.hooks.map((h) => h.customId)).toEqual(['veil-strike-bonus'])
    // From now on the hook knows the Veil as the turn begins.
    w.statuses.push({ id: 'veil', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: 'w', counter: 0 })
    w.tally.actions = 1
    const hook = w.hooks[0]!
    veilStrikeBonus.onTurnStart!(hookCtx(ctx, w, null, hook.line, hook))
    expect(hook.data.veiled).toBe(true)
    const second = applyLine(ctx, w, dmg, 'enemy', r, src('shade-backstab'))
    expect(second.line.multiplier).toBe(3)
    expect(veilStrikeBonus.critRateBonus!(hookCtx(ctx, w, null, hook.line, hook), r, { amount: 1, damageType: 'pierce', attacker: w, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: true })).toBe(30)
    // Another skill of the same turn is not a Backstab.
    const other = applyLine(ctx, w, dmg, 'enemy', r, src('shade-vital-point'))
    expect(other.line.multiplier).toBe(1.5)
  })

  it('ice-wall soaks melee hits on the front row from one shared pool and Chills the attacker; ranged hits pass', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    const w = hero('w')
    const r = rat('r')
    const { ctx } = setup([arc, w], [r])
    applyLine(ctx, arc, { kind: 'custom', customId: 'ice-wall', percent: 25, duration: 2, status: 'chill' }, 'partyFront', null, src('arcanist-ice-wall'))
    const wallHp = roundHalfUp((arc.maxHp * 25) / 100)
    expect(ctx.state.flags['iceWall:arc']).toBe(wallHp)
    expect(w.hooks.map((h) => h.customId)).toEqual(['ice-wall'])
    expect(arc.hooks).toEqual([])
    const hp = w.hp
    const bite = { amount: 5, damageType: 'blunt' as const, canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'bite' }
    dealDamage(ctx, r, w, bite)
    expect(w.hp).toBe(hp)
    expect(ctx.state.flags['iceWall:arc']).toBe(wallHp - 5)
    expect(hasStatus(r, 'chill')).toBe(true)
    dealDamage(ctx, r, w, { ...bite, isMelee: false })
    expect(w.hp).toBe(hp - 5)
    expect(ctx.state.flags['iceWall:arc']).toBe(wallHp - 5)
  })

  it('steal-gold-per-level records the steal once per enemy as a log event the delve can total', () => {
    const w = hero('w')
    const r = rat('r')
    const { ctx } = setup([w], [r])
    applyLine(ctx, w, { kind: 'custom', customId: 'steal-gold-per-level', amount: 5 }, 'enemyFront', r, src('shade-pickpocket'))
    applyLine(ctx, w, { kind: 'custom', customId: 'steal-gold-per-level', amount: 5 }, 'enemyFront', r, src('shade-pickpocket'))
    const events = ctx.state.log.filter((e) => e.kind === 'goldStolenByHero')
    expect(events).toHaveLength(1)
    expect(events[0]?.amount).toBe(5 * r.level)
    expect(ctx.state.flags['goldStolenByHeroes']).toBe(5 * r.level)
    expect(ctx.state.counters.goldStolen).toBe(0)
  })

  it('damage-bonus-vs-status as a passive adds +15% against any target under a status', () => {
    const w = hero('w')
    const marked = rat('marked')
    const clean = rat('clean')
    installHook(w, { kind: 'custom', customId: 'damage-bonus-vs-status', percent: 15, target: 'self' }, 'w', { sourceSkillId: 'shade-opportunist' })
    const { ctx } = setup([w], [marked, clean])
    marked.statuses.push({ ...CHILL })
    const a = applyLine(ctx, w, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', marked, src('test'))
    const b = applyLine(ctx, w, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', clean, src('test'))
    const base = roundHalfUp(statOf(ctx, w, 'attackPhys'))
    expect(b.results[0]!.dealt).toBe(mitigate(base, statOf(ctx, clean, 'defense'), K))
    expect(a.results[0]!.dealt).toBe(mitigate(roundHalfUp((base * 115) / 100), statOf(ctx, marked, 'defense'), K))
  })

  it('chain-if-shocked chains 0.5× to a neighbour only when the target was Shocked before the cast', () => {
    const arc = hero('arc', { pool: 'mana', row: 'back' })
    const r1 = rat('r1')
    const r2 = rat('r2')
    const { ctx } = setup([arc], [r1, r2])
    const spark = { kind: 'custom' as const, customId: 'chain-if-shocked', multiplier: 0.5, damageType: 'lightning' as const, amount: 1 }
    // Not Shocked before: nothing chains.
    push(ctx, { kind: 'action', actorId: 'arc' })
    applyLine(ctx, arc, spark, 'enemy', r1, src('arcanist-spark'))
    expect(r2.hp).toBe(r2.maxHp)
    // Shocked last turn: the hit chains.
    push(ctx, { kind: 'status', targetId: 'r1', data: { status: 'shock' } })
    push(ctx, { kind: 'action', actorId: 'arc' })
    applyLine(ctx, arc, spark, 'enemy', r1, src('arcanist-spark'))
    expect(r2.maxHp - r2.hp).toBe(mitigate(roundHalfUp(statOf(ctx, arc, 'attackSpell') * 0.5), statOf(ctx, r2, 'defense'), K))
    expect(r1.hp).toBe(r1.maxHp)
  })
})
