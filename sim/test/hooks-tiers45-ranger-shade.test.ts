/**
 * Tiers IV–V of the Ranger and the Shade (docs/classes/ranger.md, shade.md §4; Phase 7, pass A): every new hook's
 * rule through the real damage pipeline, the D-099 limits in the generated content, and the skills' shape.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyLine, dealDamage, hookCtx, statOf, type EffectContext, type LineSource } from '../src/effects.ts'
import { applyFightCommand, createFight, runFight } from '../src/fight.ts'
import type { Actor, HookInstance } from '../src/fight-types.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import decoyEachTurn from '../src/skills/custom/decoy-each-turn.ts'
import fearOthersOnVeilCrit from '../src/skills/custom/fear-others-on-veil-crit.ts'
import fieldTrapBothRows from '../src/skills/custom/field-trap-both-rows.ts'
import fieldTrapFrontAction from '../src/skills/custom/field-trap-front-action.ts'
import nightshadeVeins from '../src/skills/custom/nightshade-veins.ts'
import poisonSpreadsOnDeath from '../src/skills/custom/poison-spreads-on-death.ts'
import trapmaster from '../src/skills/custom/trapmaster.ts'
import { mitigate, roundHalfUp } from '../src/stats.ts'
import { applyStatus, hasStatus } from '../src/statuses.ts'
import type { Effect, MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor, type HeroSpec } from './helpers.ts'

const tuning = exactTuning(loadTuning())
const K = tuning.derived.defense.mitigationK

function realSkills(classId: string): { kind: 'skill'; path: string; json: SkillDef }[] {
  const dir = `content/skills/${classId}`
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ kind: 'skill' as const, path: `${dir}/${f}`, json: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as SkillDef }))
}

function testSkill(id: string, effects: Effect[], target: SkillDef['target'] = 'enemy', weight: 800 | 1000 | 1400 = 1000): SkillDef {
  return {
    id,
    classId: 'ranger',
    school: 'trapper',
    tier: 1,
    name: id,
    description: id,
    type: 'active',
    cost: 0,
    weight,
    target,
    effects,
    prerequisiteId: null,
    isUltimate: false,
    monsterTechniqueOf: null,
    rankScaling: { effectPerRank: 4, costPerRank: -2 },
    mastery: { text: '', effects: [] },
    tags: [],
    xpTags: ['agility'],
    aiHints: { role: 'attack', priority: 50 },
  }
}

const TEST_SKILLS: SkillDef[] = [
  testSkill('t-break', [
    { kind: 'damage', multiplier: 1, damageType: 'pierce' },
    { kind: 'custom', customId: 'part-break', multiplier: 2 },
  ]),
  testSkill('t-bear-jaw', [{ kind: 'custom', customId: 'field-trap-front-action', multiplier: 2.5, damageType: 'pierce', status: 'root', duration: 2, amount: 3 }], 'enemyFront'),
  testSkill('t-poke', [{ kind: 'damage', multiplier: 1, damageType: 'pierce' }]),
]

const RANGER = realSkills('ranger')
const SHADE = realSkills('shade')
const content = makeContent([example('monster', 'monster'), ...RANGER, ...SHADE, ...TEST_SKILLS.map((s) => ({ kind: 'skill' as const, path: `skills/ranger/${s.id}.json`, json: s }))])
const ratDef = content.monsters.get('giant-rat') as MonsterDef

const SOURCE: LineSource = { kind: 'skill', id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: true }
const RANGED: LineSource = { ...SOURCE, ranged: true, isMelee: false }

function rat(id: string, row: 'front' | 'back' = 'front', hp = 5000): Actor {
  const a = buildMonsterActor(content, tuning, ratDef, { id, level: 3, row, hpPercent: 100 })
  a.maxHp = hp
  a.hp = hp
  return a
}

/** A sure-footed hero that never crits on its own (flat −100 Crit Rate) and acts first. */
function hero(id: string, extra: Partial<HeroSpec> = {}): Actor {
  return makeHeroActor(tuning, { id, attributes: { agility: 30 }, flatHp: 500, flat: { critRate: -100, accuracy: 100 }, weapon: { attack: 20, type: 'dagger', damageType: 'pierce', weight: 800, strengthRequirement: 6 }, ...extra })
}

function setup(heroes: Actor[], monsters: Actor[], seed = 11) {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  const ctx: EffectContext = { content, t: tuning, state, rng }
  return { ctx, state }
}

function pushAction(ctx: EffectContext, actor: Actor): void {
  ctx.state.log.push({ tick: ctx.state.tick, round: ctx.state.round, kind: 'action', actorId: actor.id, text: `${actor.name} acts` })
}

function lastDamage(ctx: EffectContext, actorId: string): number {
  const e = [...ctx.state.log].reverse().find((x) => x.kind === 'damage' && x.actorId === actorId)
  return e?.amount ?? 0
}

function held(ctx: EffectContext, holder: Actor, hook: HookInstance) {
  return hookCtx(ctx, holder, null, hook.line, hook)
}

describe('Ranger Tier IV–V hooks', () => {
  it('Heartseeker: ignoring 50% of the Defense lands the hit a plain shot would deal through half the Defense', () => {
    const r = hero('r')
    const thick = rat('thick')
    thick.base.defense = 60
    const thin = rat('thin')
    thin.base.defense = 30
    const { ctx } = setup([r], [thick, thin])
    pushAction(ctx, r)
    applyLine(ctx, r, { kind: 'custom', customId: 'ignore-defense-percent', percent: 50, target: 'self' }, 'self', r, SOURCE)
    applyLine(ctx, r, { kind: 'damage', multiplier: 2.8, damageType: 'pierce' }, 'enemy', thick, SOURCE)
    const ignored = lastDamage(ctx, r.id)
    // The next action: the hook is spent.
    r.tally.actions += 1
    pushAction(ctx, r)
    applyLine(ctx, r, { kind: 'damage', multiplier: 2.8, damageType: 'pierce' }, 'enemy', thin, SOURCE)
    const half = lastDamage(ctx, r.id)
    expect(Math.abs(ignored - half)).toBeLessThanOrEqual(1)
    applyLine(ctx, r, { kind: 'damage', multiplier: 2.8, damageType: 'pierce' }, 'enemy', thick, SOURCE)
    expect(lastDamage(ctx, r.id)).toBeLessThan(ignored)
    expect(r.hooks.some((h) => h.customId === 'ignore-defense-percent')).toBe(false)
  })

  it('Comet Shot: 100% ignores all of it; a kill pays +30 Momentum, a miss of the kill pays nothing', () => {
    const r = hero('r')
    const armored = rat('armored')
    armored.base.defense = 80
    const { ctx } = setup([r], [armored])
    pushAction(ctx, r)
    applyLine(ctx, r, { kind: 'custom', customId: 'ignore-defense-percent', percent: 100, target: 'self' }, 'self', r, SOURCE)
    const A = statOf(ctx, r, 'attackPhys')
    const plain = dealDamage(ctx, r, rat('control'), { amount: roundHalfUp(A * 4), damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'control' })
    applyLine(ctx, r, { kind: 'damage', multiplier: 4, damageType: 'pierce' }, 'enemy', armored, SOURCE)
    expect(Math.abs(lastDamage(ctx, r.id) - plain.dealt)).toBeLessThanOrEqual(1)
    // No kill yet: nothing.
    const m0 = r.momentum
    applyLine(ctx, r, { kind: 'custom', customId: 'momentum-on-kill', amount: 30, target: 'self' }, 'self', r, SOURCE)
    expect(r.momentum).toBe(m0)
    armored.hp = 5
    applyLine(ctx, r, { kind: 'damage', multiplier: 4, damageType: 'pierce' }, 'enemy', armored, SOURCE)
    expect(armored.gone).toBe(true)
    const m1 = r.momentum
    applyLine(ctx, r, { kind: 'custom', customId: 'momentum-on-kill', amount: 30, target: 'self' }, 'self', r, SOURCE)
    expect(r.momentum - m1).toBe(roundHalfUp((30 * statOf(ctx, r, 'momentumGain')) / 100))
  })

  it('One Shot: a crit that leaves a fodder enemy under 25% finishes it once the action resolves; an elite survives', () => {
    const run = (role: 'fodder' | 'elite') => {
      const r = hero('r', { flat: { critRate: 100, accuracy: 100 }, weapon: { attack: 20, type: 'sword', damageType: 'slash', weight: 1000, strengthRequirement: 6 } })
      installHook(r, { kind: 'custom', customId: 'one-shot-fodder', percent: 25, target: 'self' }, r.id, { sourceSkillId: 'ranger-one-shot' })
      const target = rat('mark', 'front', 1000)
      target.hp = 260
      if (target.monster) target.monster.role = role
      const { state } = setup([r], [target])
      runFight(content, tuning, state)
      expect(state.pendingActorId).toBe(r.id)
      applyFightCommand(content, tuning, state, { kind: 'basic', targetId: target.id })
      return { state, target }
    }
    const fodder = run('fodder')
    expect(fodder.target.gone).toBe(true)
    expect(fodder.state.log.some((e) => e.kind === 'oneShot')).toBe(true)
    const elite = run('elite')
    expect(elite.target.gone).toBe(false)
    expect(elite.state.log.some((e) => e.kind === 'oneShot')).toBe(false)
  })

  it('Apex Hunter: a Marked enemy takes +30% instead of +20 (and the stronger of it and a Mastery Mark)', () => {
    const blow = (apex: boolean, masteryMark: boolean): number => {
      const r = hero('r')
      if (apex) installHook(r, { kind: 'custom', customId: 'apex-mark-percent', percent: 30, target: 'self' }, r.id, { sourceSkillId: 'ranger-apex-hunter' })
      const target = rat('t')
      const { ctx } = setup([r], [target])
      applyStatus(content, tuning, ctx.rng, target, { status: 'mark', duration: 3, sourceId: r.id })
      if (masteryMark) installHook(target, { kind: 'custom', customId: 'mark-damage-percent', percent: 25 }, r.id, { turnsLeft: 3 })
      return dealDamage(ctx, r, target, { amount: 1000, damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'hit' }).dealt
    }
    const base = blow(false, false)
    expect(blow(true, false) * 120).toBe(base * 130)
    const mastery = blow(false, true)
    expect(blow(true, true) * 125).toBe(mastery * 130)
  })

  it('Bear Jaw springs on the first enemy to start a turn in the front row: 2.5×, Bleed 3, Root 2, then it is gone', () => {
    const r = hero('r')
    const front = rat('front', 'front')
    const back = rat('back', 'back')
    const { ctx } = setup([r], [front, back])
    pushAction(ctx, r)
    applyLine(ctx, r, { kind: 'custom', customId: 'field-trap-front-action', multiplier: 2.5, damageType: 'pierce', status: 'root', duration: 2, amount: 3 }, 'enemyFront', front, SOURCE)
    expect(front.hooks.some((h) => h.customId === 'field-trap-front-action')).toBe(true)
    expect(back.hooks.some((h) => h.customId === 'field-trap-front-action')).toBe(true)
    // A back-row enemy's turn: nothing springs.
    const backHook = back.hooks.find((h) => h.customId === 'field-trap-front-action')!
    fieldTrapFrontAction.onTurnStart!(held(ctx, back, backHook))
    expect(front.hp).toBe(front.maxHp)
    const frontHook = front.hooks.find((h) => h.customId === 'field-trap-front-action')!
    const A = statOf(ctx, r, 'attackPhys')
    fieldTrapFrontAction.onTurnStart!(held(ctx, front, frontHook))
    const hit = ctx.state.log.find((e) => e.kind === 'damage' && e.text.includes('bear jaw'))
    expect(hit?.amount).toBe(mitigate(roundHalfUp(A * 2.5), statOf(ctx, front, 'defense'), K))
    expect(hasStatus(front, 'bleed')).toBe(true)
    expect(hasStatus(front, 'root')).toBe(true)
    expect([...front.hooks, ...back.hooks].some((h) => h.customId === 'field-trap-front-action')).toBe(false)
  })

  it('Killing Field ticks every enemy at its turn start and Slows it; Trapmaster adds +30% to the tick', () => {
    const tick = (withTrapmaster: boolean): number => {
      const r = hero('r')
      if (withTrapmaster) installHook(r, { kind: 'custom', customId: 'trapmaster', amount: 400, percent: 30, target: 'self' }, r.id, { sourceSkillId: 'ranger-trapmaster' })
      const a = rat('a')
      const b = rat('b', 'back')
      const { ctx } = setup([r], [a, b])
      pushAction(ctx, r)
      const line: Effect = { kind: 'custom', customId: 'field-trap-both-rows', multiplier: 1, damageType: 'pierce', status: 'slow', duration: 3 }
      applyLine(ctx, r, line, 'allEnemies', null, SOURCE)
      expect(a.hooks.find((h) => h.customId === 'field-trap-both-rows')?.turnsLeft).toBe(3)
      const hb = b.hooks.find((h) => h.customId === 'field-trap-both-rows')!
      fieldTrapBothRows.onTurnStart!(held(ctx, b, hb))
      expect(hasStatus(b, 'slow')).toBe(true)
      return ctx.state.log.find((e) => e.kind === 'damage' && e.text.includes('killing field'))?.amount ?? 0
    }
    const plain = tick(false)
    const boosted = tick(true)
    expect(plain).toBeGreaterThan(0)
    expect(boosted).toBeGreaterThan(plain)
  })

  it('Trapmaster: a trap-laying skill weighs 400 once per round; a shot keeps its weight', () => {
    const r = hero('r')
    const hook = installHook(r, { kind: 'custom', customId: 'trapmaster', amount: 400, percent: 30, target: 'self' }, r.id, { sourceSkillId: 'ranger-trapmaster' })
    const { ctx } = setup([r], [rat('x')])
    const hc = held(ctx, r, hook)
    trapmaster.onSkillUsed!(hc, content.skills.get('t-bear-jaw')!)
    expect(trapmaster.modifyWeight!(hc, 1000)).toBe(400)
    // Same round, second trap: full weight.
    trapmaster.onSkillUsed!(hc, content.skills.get('t-bear-jaw')!)
    expect(trapmaster.modifyWeight!(hc, 1000)).toBe(1000)
    // Next round, a shot that lays nothing.
    ctx.state.round += 1
    r.tally.actions += 1
    trapmaster.onSkillUsed!(hc, content.skills.get('t-poke')!)
    expect(trapmaster.modifyWeight!(hc, 1000)).toBe(1000)
  })

  it("Hunter's Cage: a hold no hit breaks plus Weaken; a boss is caged 1 turn with no Weaken", () => {
    const r = hero('r')
    const a = rat('a')
    const boss = rat('boss')
    if (boss.monster) boss.monster.isBoss = true
    const { ctx } = setup([r], [a, boss])
    const line: Effect = { kind: 'custom', customId: 'hunters-cage', status: 'weaken', duration: 2, amount: 1 }
    let caged = false
    for (let i = 0; i < 20 && !caged; i++) {
      applyLine(ctx, r, line, 'enemy', a, SOURCE)
      caged = a.hooks.some((h) => h.customId === 'net-held')
    }
    expect(caged).toBe(true)
    const cage = a.hooks.find((h) => h.customId === 'net-held')!
    expect(cage.turnsLeft).toBe(2)
    // Ten ally hits do not free it.
    const ally = hero('ally')
    for (let i = 0; i < 10; i++) dealDamage(ctx, ally, a, { amount: 5, damageType: 'slash', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'hit' })
    expect(a.hooks.some((h) => h.customId === 'net-held')).toBe(true)
    applyLine(ctx, r, line, 'enemy', boss, SOURCE)
    expect(boss.hooks.find((h) => h.customId === 'net-held')?.turnsLeft).toBe(1)
    expect(hasStatus(boss, 'weaken')).toBe(false)
  })

  it('Dismantle: a part-break of the Ranger drops a guaranteed common part, once per monster', () => {
    const r = hero('r', { actives: ['t-break'], ranks: { 't-break': 1 } })
    installHook(r, { kind: 'custom', customId: 'dismantle-parts', chance: 0, target: 'self' }, r.id, { sourceSkillId: 'ranger-dismantle' })
    const target = rat('t')
    const { state } = setup([r], [target])
    runFight(content, tuning, state)
    expect(state.pendingActorId).toBe(r.id)
    applyFightCommand(content, tuning, state, { kind: 'skill', slot: 0, targetId: target.id })
    const parts = state.log.filter((e) => e.kind === 'partStolen' && e.actorId === r.id)
    expect(parts).toHaveLength(1)
    expect(parts[0]?.data?.materialId).toBe(ratDef.parts.common.materialId)
    expect(parts[0]?.data?.guaranteed).toBe(true)
  })

  it('Rearguard (melee only) and Unseen Hand (every single-target blow) turn hits into misses; an AoE still lands', () => {
    const back = hero('back', { row: 'back' })
    const m = rat('m')
    const { ctx } = setup([back], [m])
    applyLine(ctx, back, { kind: 'custom', customId: 'single-target-misses-turns', duration: 1, amount: 1 }, 'self', back, SOURCE)
    const swing = (ranged: boolean) =>
      dealDamage(ctx, m, back, { amount: 20, damageType: 'pierce', canMiss: true, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: !ranged, ignoresDefense: true, sourceLabel: 'swing' })
    m.modifiers.push({ stat: 'accuracy', amount: 500, percent: 0, turnsLeft: 99, sourceId: 'test' })
    expect(swing(false).hit).toBe(false)
    expect(swing(true).hit).toBe(true)
    const aoe = dealDamage(ctx, m, back, { amount: 20, damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: false, isMelee: true, ignoresDefense: true, sourceLabel: 'aoe' })
    expect(aoe.hit).toBe(true)
    // Unseen Hand's form (no amount): the ranged blow misses too.
    const other = hero('other', { row: 'back' })
    ctx.state.actors.push(other)
    applyLine(ctx, other, { kind: 'custom', customId: 'single-target-misses-turns', duration: 1 }, 'self', other, SOURCE)
    expect(dealDamage(ctx, m, other, { amount: 20, damageType: 'pierce', canMiss: true, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: false, ignoresDefense: true, sourceLabel: 'arrow' }).hit).toBe(false)
  })

  it('the Tier V delve-side stubs log hookStub once per fight; the Tier IV ones the delve reads (Wayfinder) say nothing', () => {
    const r = hero('r')
    for (const id of ['field-skill-bonus-cartography', 'hunter-arrival-ticks', 'secret-chance-percent', 'floor-clock-per-rooms', 'surprise-fodder-encounters', 'crit-cap-raise']) installHook(r, { kind: 'custom', customId: id, amount: 1 }, r.id, { sourceSkillId: 'x' })
    const { ctx, state } = setup([r], [rat('x')])
    const stubs = state.log.filter((e) => e.kind === 'hookStub').map((e) => e.text.split(':')[0])
    expect(stubs.sort()).toEqual(['crit-cap-raise', 'floor-clock-per-rooms', 'surprise-fodder-encounters'])
    applyLine(ctx, r, { kind: 'custom', customId: 'corridor-light-band-shift', amount: 1, duration: 1, target: 'room' }, 'self', null, SOURCE)
    applyLine(ctx, r, { kind: 'custom', customId: 'corridor-light-band-shift', amount: 1, duration: 1, target: 'room' }, 'self', null, SOURCE)
    expect(state.log.filter((e) => e.kind === 'hookStub' && e.text.startsWith('corridor-light-band-shift'))).toHaveLength(1)
  })
})

describe('Shade Tier IV–V hooks', () => {
  it('Assassinate: from Veil a guaranteed crit; without Veil neither the crit nor the Defense cut', () => {
    const strike = (veiled: boolean) => {
      const s = hero('s')
      const target = rat('t')
      target.base.defense = 50
      const { ctx } = setup([s], [target])
      if (veiled) ctx.state.log.push({ tick: 0, round: 1, kind: 'status', actorId: s.id, targetId: s.id, text: 'veiled', data: { status: 'veil' } })
      pushAction(ctx, s)
      applyLine(ctx, s, { kind: 'custom', customId: 'guaranteed-crit-from-status', status: 'veil', target: 'self' }, 'self', s, SOURCE)
      applyLine(ctx, s, { kind: 'custom', customId: 'ignore-defense-percent', percent: 50, status: 'veil', target: 'self' }, 'self', s, SOURCE)
      applyLine(ctx, s, { kind: 'damage', multiplier: 2.8, damageType: 'pierce' }, 'enemy', target, SOURCE)
      return { crit: ctx.state.log.some((e) => e.kind === 'damage' && e.data?.crit === true), hooks: s.hooks.map((h) => h.customId) }
    }
    const v = strike(true)
    expect(v.crit).toBe(true)
    expect(v.hooks).toEqual(['guaranteed-crit-from-status', 'ignore-defense-percent'])
    const plain = strike(false)
    expect(plain.crit).toBe(false)
    expect(plain.hooks).toEqual([])
  })

  it('Severance (the real skill, D-099): below 35% HP a sure crit at 6.0×; above it a plain 4.5×; a kill re-enters Veil', () => {
    const cast = (hpPercent: number) => {
      const s = hero('s', { actives: ['shade-severance'], ranks: { 'shade-severance': 1 } })
      const target = rat('t', 'front', 20_000)
      target.hp = Math.floor((target.maxHp * hpPercent) / 100)
      const { state } = setup([s], [target])
      runFight(content, tuning, state)
      expect(state.pendingActorId).toBe(s.id)
      const mark = state.log.length
      applyFightCommand(content, tuning, state, { kind: 'skill', slot: 0, targetId: target.id })
      const hits = state.log.slice(mark).filter((e) => e.kind === 'damage' && e.actorId === s.id)
      return { hits, s, state }
    }
    const low = cast(30)
    expect(low.hits[0]?.data?.crit).toBe(true)
    expect(low.hits).toHaveLength(2)
    const total = low.hits.reduce((a, e) => a + (e.amount ?? 0), 0)
    expect(Math.abs(total * 4.5 - (low.hits[0]?.amount ?? 0) * 6)).toBeLessThanOrEqual(6)
    const high = cast(90)
    expect(high.hits).toHaveLength(1)
    expect(high.hits[0]?.data?.crit).toBe(false)
    // A kill: Veil again.
    const kill = cast(1)
    expect(kill.state.log.some((e) => e.kind === 'status' && e.targetId === kill.s.id && e.data?.status === 'veil')).toBe(true)
  })

  it('Phantom Twin: the first single-target blow each turn hits the decoy; the second lands; the decoy restocks', () => {
    const s = hero('s')
    const m = rat('m')
    const { ctx } = setup([s], [m])
    m.modifiers.push({ stat: 'accuracy', amount: 500, percent: 0, turnsLeft: 99, sourceId: 'test' })
    applyLine(ctx, s, { kind: 'custom', customId: 'decoy-each-turn', duration: 2, target: 'self' }, 'self', s, SOURCE)
    const swing = () => dealDamage(ctx, m, s, { amount: 10, damageType: 'pierce', canMiss: true, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'swing' }).hit
    expect(swing()).toBe(false)
    expect(swing()).toBe(true)
    const hook = s.hooks.find((h) => h.customId === 'decoy-each-turn')!
    decoyEachTurn.onTurnStart!(held(ctx, s, hook))
    expect(swing()).toBe(false)
  })

  it('Second Shadow: a dodge Veils the Shade, and the next strike reads as one from Veil', () => {
    const s = hero('s', { flat: { critRate: -100, accuracy: 100, dodge: 95 } })
    installHook(s, { kind: 'custom', customId: 'veil-on-evade', target: 'self' }, s.id, { sourceSkillId: 'shade-second-shadow' })
    const m = rat('m')
    m.modifiers.push({ stat: 'accuracy', amount: -500, percent: 0, turnsLeft: 99, sourceId: 'test' })
    const { ctx } = setup([s], [m])
    applyLine(ctx, m, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', s, { ...SOURCE, neverMisses: false, label: 'bite' })
    expect(hasStatus(s, 'veil')).toBe(true)
    expect(ctx.state.log.some((e) => e.kind === 'miss' && e.targetId === s.id)).toBe(true)
    // The Shade attacks (the fight would end the Veil first); the strike still reads as from Veil.
    pushAction(ctx, s)
    s.statuses = s.statuses.filter((x) => x.id !== 'veil')
    applyLine(ctx, s, { kind: 'custom', customId: 'guaranteed-crit-from-status', status: 'veil', target: 'self' }, 'self', s, SOURCE)
    expect(s.hooks.some((h) => h.customId === 'guaranteed-crit-from-status')).toBe(true)
  })

  it("Death's Whisper: a Veiled turn's crit Fears every other enemy, never the one it struck", () => {
    const s = hero('s')
    const hook = installHook(s, { kind: 'custom', customId: 'fear-others-on-veil-crit', duration: 1, target: 'self' }, s.id, { sourceSkillId: 'shade-deaths-whisper' })
    const a = rat('a')
    const b = rat('b')
    const c = rat('c', 'back')
    const { ctx } = setup([s], [a, b, c])
    applyStatus(content, tuning, ctx.rng, s, { status: 'veil', duration: 2, sourceId: s.id })
    fearOthersOnVeilCrit.onTurnStart!(held(ctx, s, hook))
    pushAction(ctx, s)
    ctx.state.log.push({ tick: 0, round: 1, kind: 'damage', actorId: s.id, targetId: a.id, amount: 30, text: 'crit', data: { crit: true } })
    expect(fearOthersOnVeilCrit.modifyWeight!(held(ctx, s, hook), 800)).toBe(800)
    expect(ctx.state.log.some((e) => e.kind === 'deathsWhisper')).toBe(true)
    const feared = ctx.state.log.filter((e) => e.kind === 'status' && e.data?.status === 'fear').map((e) => e.targetId)
    expect(feared).not.toContain(a.id)
    // Not Veiled at the turn start: nothing.
    s.statuses = []
    s.tally.actions += 1
    const before = ctx.state.log.length
    fearOthersOnVeilCrit.onTurnStart!(held(ctx, s, hook))
    pushAction(ctx, s)
    ctx.state.log.push({ tick: 0, round: 1, kind: 'damage', actorId: s.id, targetId: a.id, amount: 30, text: 'crit', data: { crit: true } })
    fearOthersOnVeilCrit.modifyWeight!(held(ctx, s, hook), 800)
    expect(ctx.state.log.slice(before).some((e) => e.kind === 'deathsWhisper')).toBe(false)
  })

  it('Plague Knife: a Poisoned mark that dies spreads its Poison to its row (on a hit at once, after a tick by the sweep)', () => {
    const s = hero('s')
    const a = rat('a')
    const b = rat('b')
    const back = rat('back', 'back')
    const { ctx } = setup([s], [a, b, back])
    applyStatus(content, tuning, ctx.rng, a, { status: 'poison', duration: 4, magnitude: 3, sourceId: s.id })
    applyLine(ctx, s, { kind: 'custom', customId: 'poison-spreads-on-death', amount: 1 }, 'enemy', a, SOURCE)
    a.hp = 1
    dealDamage(ctx, s, a, { amount: 50, damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'hit' })
    expect(a.gone).toBe(true)
    expect(hasStatus(b, 'poison')).toBe(true)
    expect(hasStatus(back, 'poison')).toBe(false)
    // A death by a tick fires no death joint: the Shade's sweep spreads it at its turn start.
    const second = rat('second')
    ctx.state.actors.push(second)
    applyStatus(content, tuning, ctx.rng, second, { status: 'poison', duration: 4, magnitude: 3, sourceId: s.id })
    applyLine(ctx, s, { kind: 'custom', customId: 'poison-spreads-on-death', amount: 2 }, 'enemy', second, SOURCE)
    second.hp = 0
    second.gone = true
    const sweeper = s.hooks.find((h) => h.customId === 'poison-spreads-on-death' && h.data.sweeper === true)!
    poisonSpreadsOnDeath.onTurnStart!(held(ctx, s, sweeper))
    expect(hasStatus(back, 'poison')).toBe(true)
  })

  it('Black Mirror strips every buff; at Mastery the Shield goes to the Shade', () => {
    const s = hero('s')
    const t = rat('t')
    const { ctx } = setup([s], [t])
    applyStatus(content, tuning, ctx.rng, t, { status: 'fortify', duration: 3, sourceId: t.id })
    applyStatus(content, tuning, ctx.rng, t, { status: 'shield', duration: 3, magnitude: 40, sourceId: t.id })
    applyLine(ctx, s, { kind: 'custom', customId: 'strip-all-buffs', status: 'shield', amount: 0 }, 'enemy', t, SOURCE)
    expect(t.statuses.map((x) => x.id)).toEqual([])
    expect(hasStatus(s, 'shield')).toBe(false)
    applyStatus(content, tuning, ctx.rng, t, { status: 'shield', duration: 3, magnitude: 40, sourceId: t.id })
    applyLine(ctx, s, { kind: 'custom', customId: 'strip-all-buffs', status: 'shield', amount: 1 }, 'enemy', t, SOURCE)
    expect(hasStatus(t, 'shield')).toBe(false)
    expect(s.statuses.find((x) => x.id === 'shield')?.magnitude).toBe(40)
  })

  it('Grand Larceny: every enemy buff stripped, a Shield of 5% per buff on each ally; at Mastery stripped Haste becomes Slow', () => {
    const s = hero('s')
    const ally = hero('ally')
    const a = rat('a')
    const b = rat('b')
    const { ctx } = setup([s, ally], [a, b])
    applyStatus(content, tuning, ctx.rng, a, { status: 'fortify', duration: 3, sourceId: a.id })
    applyStatus(content, tuning, ctx.rng, a, { status: 'haste', duration: 3, sourceId: a.id })
    applyStatus(content, tuning, ctx.rng, b, { status: 'regen', duration: 3, magnitude: 5, sourceId: b.id })
    applyLine(ctx, s, { kind: 'custom', customId: 'strip-buffs-shield-allies', percent: 5, status: 'haste', amount: 1, target: 'self' }, 'self', s, SOURCE)
    expect(a.statuses.map((x) => x.id)).toEqual(['slow'])
    expect(b.statuses).toEqual([])
    expect(ally.statuses.find((x) => x.id === 'shield')?.magnitude).toBe(roundHalfUp((ally.maxHp * 5 * 3) / 100))
  })

  it('Nightshade Veins: a tick of the Shade’s Poison pays 3% Stamina, and under 20% HP it lands twice', () => {
    const s = hero('s')
    installHook(s, { kind: 'custom', customId: 'nightshade-veins', percent: 3, amount: 20, target: 'self' }, s.id, { sourceSkillId: 'shade-nightshade-veins' })
    const t = rat('t', 'front', 1000)
    const { ctx } = setup([s], [t])
    const mirror = t.hooks.find((h) => h.customId === 'nightshade-veins')!
    expect(mirror.data.mirror).toBe(true)
    applyStatus(content, tuning, ctx.rng, t, { status: 'poison', duration: 4, magnitude: 3, sourceId: s.id })
    s.pool = 10
    t.hp = 500
    ctx.state.log.push({ tick: 0, round: 1, kind: 'dot', actorId: t.id, amount: 30, text: 'tick', data: { status: 'poison' } })
    nightshadeVeins.onTurnStart!(held(ctx, t, mirror))
    expect(s.pool).toBe(10 + roundHalfUp((s.poolMax * 3) / 100))
    expect(t.hp).toBe(500)
    // Under 20%: the tick lands again (a second blow of the tick's amount).
    t.hp = 150
    ctx.state.log.push({ tick: 0, round: 1, kind: 'dot', actorId: t.id, amount: 30, text: 'tick', data: { status: 'poison' } })
    nightshadeVeins.onTurnStart!(held(ctx, t, mirror))
    expect(t.hp).toBeLessThan(150)
    expect(ctx.state.log.some((e) => e.kind === 'damage' && e.text.includes('Nightshade Veins'))).toBe(true)
  })

  it("Widow's Kiss: Petrify only a Poisoned target (any target at Mastery); a boss is Stunned (the table makes it a Daze)", () => {
    const s = hero('s')
    const plain = rat('plain')
    const poisoned = rat('poisoned')
    const boss = rat('boss')
    if (boss.monster) boss.monster.isBoss = true
    const { ctx } = setup([s], [plain, poisoned, boss])
    applyStatus(content, tuning, ctx.rng, poisoned, { status: 'poison', duration: 4, magnitude: 3, sourceId: s.id })
    const kiss = (t: Actor, amount: number) => {
      pushAction(ctx, s)
      applyLine(ctx, s, { kind: 'damage', multiplier: 1, damageType: 'shadow' }, 'enemy', t, SOURCE)
      applyLine(ctx, s, { kind: 'custom', customId: 'petrify-poisoned-stun-boss', status: 'petrify', duration: 1, amount }, 'enemy', t, SOURCE)
    }
    const energy = boss.energy
    kiss(plain, 0)
    kiss(poisoned, 0)
    kiss(boss, 0)
    expect(hasStatus(plain, 'petrify')).toBe(false)
    expect(hasStatus(poisoned, 'petrify')).toBe(true)
    expect(hasStatus(boss, 'petrify')).toBe(false)
    expect(boss.energy).toBeLessThan(energy)
    kiss(plain, 1)
    expect(hasStatus(plain, 'petrify')).toBe(true)
  })

  it('Heist and King’s Ransom: a bandit’s potion, a boss’s rare part — each once', () => {
    const s = hero('s')
    const bandit = rat('bandit')
    if (bandit.monster) bandit.monster.monsterId = 'grinning-cutpurse'
    const boss = rat('boss')
    if (boss.monster) boss.monster.isBoss = true
    const plain = rat('plain')
    const { ctx } = setup([s], [bandit, boss, plain])
    for (let i = 0; i < 2; i++) {
      applyLine(ctx, s, { kind: 'custom', customId: 'steal-bandit-item' }, 'enemy', bandit, SOURCE)
      applyLine(ctx, s, { kind: 'custom', customId: 'steal-bandit-item' }, 'enemy', plain, SOURCE)
      applyLine(ctx, s, { kind: 'custom', customId: 'steal-boss-rare-part' }, 'enemy', boss, SOURCE)
    }
    const stolen = ctx.state.log.filter((e) => e.kind === 'partStolen')
    expect(stolen.map((e) => [e.targetId, e.data?.itemId, e.data?.rare])).toEqual([
      ['bandit', 'small-hp-potion', false],
      ['boss', ratDef.parts.rare.itemId ?? null, true],
    ])
  })

  it('Vault Cracker ignores the Defense of elites and constructs only', () => {
    const blow = (role: 'fodder' | 'elite') => {
      const s = hero('s')
      const t = rat('t')
      t.base.defense = 80
      if (t.monster) t.monster.role = role
      const { ctx } = setup([s], [t])
      pushAction(ctx, s)
      applyLine(ctx, s, { kind: 'custom', customId: 'ignore-defense-vs-armored', percent: 100, target: 'self' }, 'self', s, RANGED)
      applyLine(ctx, s, { kind: 'damage', multiplier: 2, damageType: 'pierce' }, 'enemy', t, RANGED)
      return lastDamage(ctx, s.id)
    }
    expect(blow('elite')).toBeGreaterThan(blow('fodder'))
  })
})

describe('the Ranger and Shade content (Tiers IV–V, D-099)', () => {
  const all = [...RANGER, ...SHADE].map((f) => f.json)

  it('each class has 3 schools × 5 tiers × 3 skills plus its Ultimate, every Tier II–V prerequisite one tier down in its school', () => {
    for (const cls of ['ranger', 'shade']) {
      const skills = all.filter((s) => s.classId === cls && !s.isUltimate)
      expect(skills).toHaveLength(45)
      for (const tier of [1, 2, 3, 4, 5]) for (const school of new Set(skills.map((s) => s.school))) expect(skills.filter((s) => s.tier === tier && s.school === school)).toHaveLength(3)
      for (const s of skills.filter((x) => x.tier > 1)) {
        const p = all.find((x) => x.id === s.prerequisiteId)
        expect(p?.tier).toBe(s.tier - 1)
        expect(p?.school).toBe(s.school)
      }
    }
  })

  it('no execute line goes above 6.0×; Severance is 6.0× with a sure crit below the same threshold', () => {
    for (const s of all) {
      for (const line of [...s.effects, ...s.mastery.effects]) {
        if (line.customId === 'execute-multiplier' || line.customId === 'execute-multiplier-below-hp') expect(line.multiplier ?? 0).toBeLessThanOrEqual(tuning.skills.limits.executeMaxMultiplier)
      }
    }
    const sev = all.find((s) => s.id === 'shade-severance')!
    for (const lines of [sev.effects, sev.mastery.effects]) {
      const exec = lines.find((l) => l.customId === 'execute-multiplier')!
      const crit = lines.find((l) => l.customId === 'guaranteed-crit-below-hp')!
      expect(exec.multiplier).toBe(6)
      expect(crit.percent).toBe(exec.percent)
    }
  })

  it('Never Lost cuts the ambush by 30, not to zero (D-099)', () => {
    const nl = all.find((s) => s.id === 'ranger-never-lost')!
    const cut = nl.effects.find((l) => l.customId === 'party-ambush-modifier')
    expect(cut?.amount).toBe(-(tuning.skills.limits.ambushCutMaxPercent['ranger-never-lost'] ?? 0))
  })

  it("Grave Bat's Screech is the Ranger's Tier IV technique and the Shade's Tier III techniques say they come only by witnessing", () => {
    const screech = all.find((s) => s.id === 'ranger-grave-bats-screech')!
    expect(screech.tier).toBe(4)
    expect(screech.prerequisiteId).toBe('ranger-ambush-sense')
    for (const id of ['shade-wraith-step', 'shade-hags-hex']) expect(all.find((s) => s.id === id)?.description).toMatch(/learned only by witnessing/)
  })
})
