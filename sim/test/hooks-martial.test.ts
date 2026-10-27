import { describe, expect, it } from 'vitest'
import { applyLine, canAct, dealDamage, hookCtx, statOf, type DamageInput, type EffectContext } from '../src/effects.ts'
import { applyFightCommand, createFight, runFight } from '../src/fight.ts'
import type { Actor } from '../src/fight-types.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import firstActionWeight from '../src/skills/custom/first-action-weight.ts'
import partyRowSwapWeight from '../src/skills/custom/party-row-swap-weight.ts'
import statPercentBelowHp from '../src/skills/custom/stat-percent-below-hp.ts'
import { applyStatus } from '../src/statuses.ts'
import { mitigate, roundHalfUp } from '../src/stats.ts'
import type { Effect, MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

const tuning = exactTuning(loadTuning())
const K = tuning.derived.defense.mitigationK

function skill(id: string, school: string, weight: 800 | 1000 | 1400, cost: number, target: SkillDef['target'], effects: Effect[], type: SkillDef['type'] = 'active'): SkillDef {
  return {
    id,
    classId: 'blade',
    school,
    tier: 1,
    name: id,
    description: id,
    type,
    cost,
    weight: type === 'active' ? weight : null,
    target,
    effects,
    prerequisiteId: null,
    isUltimate: false,
    monsterTechniqueOf: null,
    rankScaling: { effectPerRank: 4, costPerRank: -2 },
    mastery: { text: '', effects: [] },
    tags: [],
    xpTags: ['strength'],
    aiHints: { role: 'attack', priority: 50 },
  }
}

const SKILLS: SkillDef[] = [
  skill('t-twin-cut', 'iron-dance', 800, 9, 'enemyFront', [
    { kind: 'damage', multiplier: 0.6, damageType: 'slash' },
    { kind: 'damage', multiplier: 0.6, damageType: 'slash' },
  ]),
  skill('t-blade-rhythm', 'iron-dance', 800, 0, 'self', [{ kind: 'custom', customId: 'school-combo-damage-stacks', amount: 3, percent: 8, target: 'self' }], 'passive'),
  skill('t-patience', 'marksman', 800, 0, 'self', [{ kind: 'custom', customId: 'patience-stacks', amount: 75, percent: 25, target: 'self' }], 'passive'),
  skill('t-execute', 'executioner', 1400, 16, 'enemyFront', [
    { kind: 'damage', multiplier: 1.7, damageType: 'slash' },
    { kind: 'custom', customId: 'execute-multiplier-below-hp', multiplier: 3.4, damageType: 'slash', percent: 30 },
  ]),
  skill('t-flowing-guard', 'iron-dance', 800, 0, 'self', [{ kind: 'custom', customId: 'dodge-stack-on-light-action', amount: 5, percent: 15, target: 'self' }], 'passive'),
]
const content = makeContent([example('monster', 'monster'), ...SKILLS.map((s) => ({ kind: 'skill' as const, path: `skills/blade/${s.id}.json`, json: s }))])
const ratDef = content.monsters.get('giant-rat') as MonsterDef

const SOURCE = { kind: 'skill' as const, id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: true }
const RANGED = { ...SOURCE, reach: true, ranged: true, isMelee: false }

function rat(level = 1, id = 'rat', hp?: number): Actor {
  const a = buildMonsterActor(content, tuning, ratDef, { id, level, row: 'front', hpPercent: 100 })
  if (hp !== undefined) {
    a.maxHp = hp
    a.hp = hp
  }
  return a
}

function setup(heroes: Actor[], monsters: Actor[], seed = 7) {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  const ctx: EffectContext = { content, t: tuning, state, rng }
  return { ctx, state }
}

/** A fast, sure-footed Blade: speed 150 (acts before a rat at 125), never crits, never misses, hard to kill. */
function blade(id: string, extra: Partial<Parameters<typeof makeHeroActor>[1]> = {}): Actor {
  return makeHeroActor(tuning, { id, attributes: { agility: 20 }, flatHp: 500, flat: { critRate: -100, accuracy: 100 }, weapon: { attack: 10, type: 'sword', damageType: 'slash', weight: 800, strengthRequirement: 8 }, ...extra })
}

function sure(amount: number, damageType: DamageInput['damageType'], extra: Partial<DamageInput> = {}): DamageInput {
  return { amount, damageType, canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'hit', ...extra }
}

function heroHits(state: ReturnType<typeof setup>['state'], heroId: string, from: number): number[] {
  return state.log.slice(from).filter((e) => e.kind === 'damage' && e.actorId === heroId).map((e) => e.amount ?? 0)
}

function pushAction(ctx: EffectContext, actor: Actor): void {
  ctx.state.log.push({ tick: ctx.state.tick, round: ctx.state.round, kind: 'action', actorId: actor.id, text: `${actor.name} acts` })
}

describe('martial hooks: Blade', () => {
  it('Mirror Step ripostes the first dodged attack once, then the hook drops', () => {
    const hero = blade('b', { flat: { dodge: 95, critRate: -100 } })
    const r = rat(3)
    const { ctx } = setup([hero], [r])
    applyLine(ctx, hero, { kind: 'custom', customId: 'riposte-on-dodge', multiplier: 1, damageType: 'slash', duration: 1, amount: 1, target: 'self' }, 'self', hero, SOURCE)
    expect(hero.hooks.map((h) => h.customId)).toEqual(['riposte-on-dodge'])
    const expected = mitigate(statOf(ctx, hero, 'attackPhys'), statOf(ctx, r, 'defense'), K)
    let dodges = 0
    for (let i = 0; i < 60 && dodges < 2; i++) {
      const res = dealDamage(ctx, r, hero, sure(1, 'pierce', { canMiss: true, ignoresDefense: false }))
      if (!res.hit) dodges += 1
    }
    expect(dodges).toBe(2)
    const ripostes = ctx.state.log.filter((e) => e.kind === 'damage' && e.text.includes('riposte'))
    expect(ripostes).toHaveLength(1)
    expect(ripostes[0]?.amount).toBe(expected)
    expect(hero.hooks).toEqual([])
  })

  it('Blade Rhythm scales the second consecutive Iron Dance skill by one stack and a basic attack resets it', () => {
    const hero = blade('b', { actives: ['t-twin-cut'], ranks: { 't-twin-cut': 1 } })
    const r = rat(12, 'rat', 5000)
    const { ctx, state } = setup([hero], [r])
    installHook(hero, { kind: 'custom', customId: 'school-combo-damage-stacks', amount: 3, percent: 8, target: 'self' }, hero.id, { sourceSkillId: 't-blade-rhythm' })
    const A = statOf(ctx, hero, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    runFight(content, tuning, state)
    expect(state.pendingActorId).toBe('b')
    let mark = state.log.length
    applyFightCommand(content, tuning, state, { kind: 'skill', slot: 0, targetId: r.id })
    const plain = mitigate(roundHalfUp(A * 0.6), D, K)
    expect(heroHits(state, 'b', mark)).toEqual([plain, plain])
    expect(hero.hooks[0]?.data.stacks).toBe(1)
    mark = state.log.length
    applyFightCommand(content, tuning, state, { kind: 'skill', slot: 0, targetId: r.id })
    const stacked = mitigate(roundHalfUp(A * 0.6 * 1.08), D, K)
    expect(heroHits(state, 'b', mark)).toEqual([stacked, stacked])
    expect(hero.hooks[0]?.data.stacks).toBe(2)
    applyFightCommand(content, tuning, state, { kind: 'basic', targetId: r.id })
    expect(hero.hooks[0]?.data.stacks).toBe(0)
  })

  it('Flowing Guard stacks +5 Dodge per 800-weight action to 15 and a Guard drops the stacks', () => {
    const hero = blade('b')
    const r = rat(12, 'rat', 5000)
    const { ctx, state } = setup([hero], [r])
    installHook(hero, { kind: 'custom', customId: 'dodge-stack-on-light-action', amount: 5, percent: 15, target: 'self' }, hero.id, { sourceSkillId: 't-flowing-guard' })
    runFight(content, tuning, state)
    const base = statOf(ctx, hero, 'dodge')
    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      applyFightCommand(content, tuning, state, { kind: 'basic', targetId: r.id })
      seen.push(statOf(ctx, hero, 'dodge') - base)
    }
    expect(seen).toEqual([5, 10, 15, 15])
    applyFightCommand(content, tuning, state, { kind: 'guard' })
    expect(statOf(ctx, hero, 'dodge')).toBe(base)
    expect(hero.hooks[0]?.data.stacks).toBe(0)
  })

  it('Execute deals the 3.4× difference as a second hit only against a target under 30% HP', () => {
    const hero = blade('b', { actives: ['t-execute'], ranks: { 't-execute': 1 } })
    const r = rat(30, 'rat', 1000)
    const { ctx, state } = setup([hero], [r])
    const A = statOf(ctx, hero, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    const hit = mitigate(roundHalfUp(A * 1.7), D, K)
    runFight(content, tuning, state)
    r.hp = Math.floor(r.maxHp * 0.2)
    expect(r.hp).toBeGreaterThan(hit)
    let mark = state.log.length
    applyFightCommand(content, tuning, state, { kind: 'skill', slot: 0, targetId: r.id })
    expect(heroHits(state, 'b', mark)).toEqual([hit, hit])
    expect(state.log.some((e) => e.kind === 'damage' && e.text.includes('(execute)'))).toBe(true)
    // Healthy target: the plain 1.7× only.
    const hero2 = blade('b2', { actives: ['t-execute'], ranks: { 't-execute': 1 } })
    const r2 = rat(30, 'rat2', 1000)
    const second = setup([hero2], [r2])
    runFight(content, tuning, second.state)
    mark = second.state.log.length
    applyFightCommand(content, tuning, second.state, { kind: 'skill', slot: 0, targetId: r2.id })
    expect(heroHits(second.state, 'b2', mark)).toEqual([hit])
  })

  it('Skull Splitter stuns on a crit of this action and not otherwise', () => {
    const hero = blade('b')
    const r = rat(5)
    const { ctx } = setup([hero], [r])
    const line: Effect = { kind: 'custom', customId: 'status-on-crit', status: 'stun', duration: 1 }
    pushAction(ctx, hero)
    ctx.state.log.push({ tick: 0, round: 1, kind: 'damage', actorId: hero.id, targetId: r.id, amount: 9, text: 'hit', data: { crit: false } })
    applyLine(ctx, hero, line, 'enemyFront', r, SOURCE)
    expect(r.statuses.some((s) => s.id === 'stun')).toBe(false)
    pushAction(ctx, hero)
    ctx.state.log.push({ tick: 0, round: 1, kind: 'damage', actorId: hero.id, targetId: r.id, amount: 9, text: 'hit (crit)', data: { crit: true } })
    applyLine(ctx, hero, line, 'enemyFront', r, SOURCE)
    expect(r.statuses.some((s) => s.id === 'stun')).toBe(true)
  })

  it('Hemorrhage consumes the Bleed and deals its remaining ticks at once, ignoring Defense', () => {
    const hero = blade('b')
    const r = rat(12)
    const { ctx } = setup([hero], [r])
    expect(applyStatus(content, tuning, ctx.rng, r, { status: 'bleed', magnitude: 40, duration: 3, sourceId: hero.id }).outcome).toBe('applied')
    expect(r.statuses.find((s) => s.id === 'bleed')?.magnitude).toBe(10)
    pushAction(ctx, hero)
    applyLine(ctx, hero, { kind: 'damage', multiplier: 1.4, damageType: 'slash' }, 'enemyFront', r, SOURCE)
    const before = r.hp
    applyLine(ctx, hero, { kind: 'custom', customId: 'consume-dot-remaining', status: 'bleed' }, 'enemyFront', r, SOURCE)
    expect(r.statuses.some((s) => s.id === 'bleed')).toBe(false)
    expect(before - r.hp).toBe(30)
  })

  it('Drink Deep heals half of what the skill dealt this action', () => {
    const hero = blade('b')
    const r = rat(12)
    const { ctx } = setup([hero], [r])
    hero.hp -= 100
    pushAction(ctx, hero)
    const out = applyLine(ctx, hero, { kind: 'damage', multiplier: 1.3, damageType: 'slash' }, 'enemyFront', r, SOURCE)
    const dealt = out.results[0]?.dealt ?? 0
    expect(dealt).toBeGreaterThan(0)
    const hp = hero.hp
    applyLine(ctx, hero, { kind: 'custom', customId: 'heal-percent-of-damage-dealt', percent: 50, target: 'self' }, 'enemyFront', r, SOURCE)
    expect(hero.hp).toBe(hp + roundHalfUp(dealt / 2))
  })

  it('Pain Threshold applies only the deepest matching Attack threshold', () => {
    const hero = blade('b')
    const { ctx } = setup([hero], [rat()])
    const low = installHook(hero, { kind: 'custom', customId: 'stat-percent-below-hp', stat: 'attackPhys', amount: 50, percent: 15, target: 'self' }, hero.id, { sourceSkillId: 'blade-pain-threshold', replace: false })
    const deep = installHook(hero, { kind: 'custom', customId: 'stat-percent-below-hp', stat: 'attackPhys', amount: 25, percent: 30, target: 'self' }, hero.id, { sourceSkillId: 'blade-pain-threshold', replace: false })
    const base = statOf(ctx, hero, 'attackPhys')
    const sync = () => {
      statPercentBelowHp.onTurnStart?.(hookCtx(ctx, hero, null, low.line, low))
      statPercentBelowHp.onTurnStart?.(hookCtx(ctx, hero, null, deep.line, deep))
    }
    sync()
    expect(statOf(ctx, hero, 'attackPhys')).toBe(base)
    hero.hp = Math.floor(hero.maxHp * 0.4)
    sync()
    expect(statOf(ctx, hero, 'attackPhys')).toBe(roundHalfUp(base * 1.15))
    hero.hp = Math.floor(hero.maxHp * 0.2)
    sync()
    expect(statOf(ctx, hero, 'attackPhys')).toBe(roundHalfUp(base * 1.3))
    expect(hero.modifiers).toHaveLength(1)
  })
})

describe('martial hooks: Warden', () => {
  it('Unbreakable keeps the Warden at 1 HP once, shields it, and lets the next lethal hit through', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 100 })
    const r = rat()
    const { ctx } = setup([hero], [r])
    installHook(hero, { kind: 'custom', customId: 'survive-lethal-once-per-fight', amount: 1, percent: 20, target: 'self' }, hero.id, { sourceSkillId: 'warden-unbreakable' })
    const first = dealDamage(ctx, r, hero, sure(10_000, 'blunt'))
    expect(first.downed).toBe(false)
    expect(hero.hp).toBe(1)
    const shield = roundHalfUp(hero.maxHp * 0.2)
    expect(hero.statuses.find((s) => s.id === 'shield')?.magnitude).toBe(shield)
    const second = dealDamage(ctx, r, hero, sure(10_000, 'blunt'))
    expect(second.absorbed).toBe(shield)
    expect(second.downed).toBe(true)
    expect(hero.hp).toBe(0)
  })

  it("Bone Knight's Stand halves the first two physical hits and lets a third through", () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 400 })
    const r = rat()
    const { ctx } = setup([hero], [r])
    applyLine(ctx, hero, { kind: 'custom', customId: 'block-first-physical-hits', duration: 1, amount: 2, target: 'self' }, 'self', hero, SOURCE)
    const hit = (type: DamageInput['damageType']) => dealDamage(ctx, r, hero, sure(40, type)).dealt
    expect(hit('slash')).toBe(20)
    expect(hit('fire')).toBe(40)
    expect(hit('slash')).toBe(20)
    expect(hit('slash')).toBe(40)
    expect(hero.tally.blocks).toBe(2)
    expect(hero.hooks).toEqual([])
    expect(ctx.state.flags['autoBlock:w']).toBe(2)
  })

  it('Punish makes a counter-hit deal +50% and Weaken the attacker', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 300, flat: { critRate: -100 } })
    const r = rat(6)
    const { ctx } = setup([hero], [r])
    applyLine(ctx, hero, { kind: 'custom', customId: 'counter-stance', multiplier: 1, amount: 1, target: 'self' }, 'self', hero, SOURCE)
    installHook(hero, { kind: 'custom', customId: 'counter-hit-damage-percent', percent: 50, target: 'self' }, hero.id, { sourceSkillId: 'warden-punish' })
    installHook(hero, { kind: 'custom', customId: 'counter-hit-applies-status', status: 'weaken', duration: 1, target: 'self' }, hero.id, { sourceSkillId: 'warden-punish' })
    const A = statOf(ctx, hero, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    dealDamage(ctx, r, hero, sure(10, 'pierce'))
    const counter = ctx.state.log.find((e) => e.kind === 'damage' && e.text.includes('counter'))
    expect(counter?.amount).toBe(mitigate(roundHalfUp(A * 1.5), D, K))
    expect(r.statuses.some((s) => s.id === 'weaken')).toBe(true)
  })

  it('Voice of Iron scales damage from an enemy the Warden Taunted by −10%', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 300 })
    const r = rat()
    const { ctx } = setup([hero], [r])
    installHook(hero, { kind: 'custom', customId: 'taunted-enemies-damage-to-you-percent', percent: -10, target: 'self' }, hero.id, { sourceSkillId: 'warden-voice-of-iron' })
    expect(dealDamage(ctx, r, hero, sure(100, 'blunt')).dealt).toBe(100)
    expect(applyStatus(content, tuning, ctx.rng, r, { status: 'taunt', sourceId: hero.id }).outcome).toBe('applied')
    expect(dealDamage(ctx, r, hero, sure(100, 'blunt')).dealt).toBe(90)
  })

  it("Phalanx shields an ally for 10% of the Warden's max HP", () => {
    const warden = makeHeroActor(tuning, { id: 'w', flatHp: 200 })
    const ally = makeHeroActor(tuning, { id: 'a', row: 'back' })
    const { ctx } = setup([warden, ally], [rat()])
    applyLine(ctx, warden, { kind: 'custom', customId: 'shield-allies-percent-of-own-max-hp', duration: 2, percent: 10, target: 'ally' }, 'partyFront', ally, SOURCE)
    expect(ally.statuses.find((s) => s.id === 'shield')?.magnitude).toBe(roundHalfUp(warden.maxHp / 10))
  })

  it("Bone Knight's Stand immunities resist Stun, Daze and Grab but not Bleed", () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    const { ctx } = setup([hero], [rat()])
    for (const status of ['daze', 'stun', 'grab'] as const) applyLine(ctx, hero, { kind: 'custom', customId: 'status-immunity', status, duration: 1, target: 'self' }, 'self', hero, SOURCE)
    expect(hero.hooks.filter((h) => h.customId === 'status-resist-bonus')).toHaveLength(3)
    expect(applyStatus(content, tuning, ctx.rng, hero, { status: 'stun', sourceId: 'rat' }).outcome).toBe('resisted')
    expect(applyStatus(content, tuning, ctx.rng, hero, { status: 'grab', sourceId: 'rat' }).outcome).toBe('resisted')
    expect(applyStatus(content, tuning, ctx.rng, hero, { status: 'bleed', magnitude: 10, sourceId: 'rat' }).outcome).toBe('applied')
  })

  it('Formation Drill makes a row swap weigh 200 for the Warden and for a marked ally', () => {
    const warden = makeHeroActor(tuning, { id: 'w' })
    const ally = makeHeroActor(tuning, { id: 'a', row: 'back' })
    const line: Effect = { kind: 'custom', customId: 'party-row-swap-weight', amount: 200, target: 'allAllies' }
    const own = installHook(warden, line, warden.id, { sourceSkillId: 'warden-formation-drill' })
    const { ctx } = setup([warden, ally], [rat()])
    const marker = ally.hooks.find((h) => h.customId === 'party-row-swap-weight')
    expect(marker?.data.marker).toBe(true)
    expect(partyRowSwapWeight.modifyWeight?.(hookCtx(ctx, warden, null, line, own), 400)).toBe(200)
    expect(partyRowSwapWeight.modifyWeight?.(hookCtx(ctx, ally, null, line, marker ?? null), 400)).toBe(200)
    expect(partyRowSwapWeight.modifyWeight?.(hookCtx(ctx, ally, null, line, marker ?? null), 1000)).toBe(1000)
  })
})

describe('martial hooks: Ranger', () => {
  it("Predator's Patience banks +25% per non-attacking turn (cap 75) and the next shot spends it", () => {
    const hero = blade('r', { weapon: { attack: 12, type: 'shortbow', damageType: 'pierce', weight: 1000, strengthRequirement: 8, ranged: true }, row: 'back' })
    const r = rat(12, 'rat', 5000)
    const { ctx, state } = setup([hero], [r])
    const hook = installHook(hero, { kind: 'custom', customId: 'patience-stacks', amount: 75, percent: 25, target: 'self' }, hero.id, { sourceSkillId: 't-patience' })
    const A = statOf(ctx, hero, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    runFight(content, tuning, state)
    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      applyFightCommand(content, tuning, state, { kind: 'guard' })
      seen.push(Number(hook.data.stacks))
    }
    expect(seen).toEqual([25, 50, 75, 75])
    const mark = state.log.length
    applyFightCommand(content, tuning, state, { kind: 'basic', targetId: r.id })
    expect(heroHits(state, 'r', mark)).toEqual([mitigate(roundHalfUp(A * 1.75), D, K)])
    expect(hook.data.stacks).toBe(0)
  })

  it('Caltrop Toss ticks on every enemy in the row at its turn start and the Mastery adds Slow', () => {
    const hero = blade('r', { row: 'back' })
    const r = rat(12, 'rat', 5000)
    const { ctx, state } = setup([hero], [r])
    const A = statOf(ctx, hero, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    runFight(content, tuning, state)
    applyLine(ctx, hero, { kind: 'custom', customId: 'field-trap-row-dot', multiplier: 0.5, damageType: 'pierce', duration: 3, target: 'enemyRow' }, 'enemyFront', r, RANGED)
    applyLine(ctx, hero, { kind: 'custom', customId: 'field-trap-tick-status', status: 'slow', duration: 1, target: 'enemyRow' }, 'enemyFront', r, RANGED)
    expect(r.hooks.map((h) => h.customId)).toEqual(['field-trap-row-dot'])
    expect(r.hooks[0]?.data).toMatchObject({ row: 'front', tickStatus: 'slow', tickStatusDuration: 1 })
    const ticks = () => state.log.filter((e) => e.kind === 'damage' && e.text.includes('caltrops'))
    for (let i = 0; i < 5 && ticks().length === 0; i++) applyFightCommand(content, tuning, state, { kind: 'guard' })
    expect(ticks()).toHaveLength(1)
    expect(ticks()[0]?.amount).toBe(mitigate(roundHalfUp(A * 0.5), D, K))
    expect(r.statuses.find((s) => s.id === 'slow')?.turnsLeft).toBe(1)
    expect(r.hooks[0]?.turnsLeft).toBe(2)
  })

  it("Net Throw holds the target until an ally's hit frees it; the Ranger's own shots never do", () => {
    const ranger = makeHeroActor(tuning, { id: 'r', row: 'back', weapon: { attack: 12, type: 'shortbow', damageType: 'pierce', weight: 1000, strengthRequirement: 8, ranged: true } })
    const ally = makeHeroActor(tuning, { id: 'a' })
    const r = rat(12)
    const { ctx } = setup([ranger, ally], [r])
    const net = (amount: number) => applyLine(ctx, ranger, { kind: 'custom', customId: 'net-held', duration: 1, amount }, 'enemy', r, RANGED)
    net(0)
    expect(r.statuses.some((s) => s.id === 'grab')).toBe(false)
    expect(r.hooks.map((h) => h.customId)).toEqual(['net-held'])
    expect(canAct(ctx, r)).toBe(false)
    dealDamage(ctx, ranger, r, sure(5, 'pierce'))
    expect(canAct(ctx, r)).toBe(false)
    dealDamage(ctx, ally, r, sure(5, 'slash'))
    expect(r.hooks).toEqual([])
    expect(canAct(ctx, r)).toBe(true)
    expect(ctx.state.log.some((e) => e.kind === 'freed')).toBe(true)
    // Mastery: the Grab survives one ally hit.
    net(1)
    dealDamage(ctx, ally, r, sure(5, 'slash'))
    expect(canAct(ctx, r)).toBe(false)
    dealDamage(ctx, ally, r, sure(5, 'slash'))
    expect(canAct(ctx, r)).toBe(true)
  })

  it('Steady Draw makes only the first action weigh 800', () => {
    const hero = makeHeroActor(tuning, { id: 'r' })
    const line: Effect = { kind: 'custom', customId: 'first-action-weight', amount: 800, target: 'self' }
    const hook = installHook(hero, line, hero.id, { sourceSkillId: 'ranger-steady-draw' })
    const { ctx } = setup([hero], [rat()])
    expect(firstActionWeight.modifyWeight?.(hookCtx(ctx, hero, null, line, hook), 1000)).toBe(800)
    expect(firstActionWeight.modifyWeight?.(hookCtx(ctx, hero, null, line, hook), 400)).toBe(400)
    hero.tally.actions = 1
    expect(firstActionWeight.modifyWeight?.(hookCtx(ctx, hero, null, line, hook), 1000)).toBe(1000)
  })
})
