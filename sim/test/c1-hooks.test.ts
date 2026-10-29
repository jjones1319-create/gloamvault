/**
 * Pass C1 (Phase 7): the Crypts' and the Vault's fight-side hooks (06 §3.2–§3.3) through the real pipeline on the real
 * content, HookFx.summon, the monster-side `partyFront`/`partyBack` fix (03's DSL: "rows on both sides"), and the
 * behaviour fix (no monster's gambit leaves its weights dead).
 */
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { parseBehavior } from '../src/ai.ts'
import { applyLine, dealDamage, hookCtx, resolveTargets, statOf, type EffectContext, type LineSource } from '../src/effects.ts'
import { installPassiveAttackHooks } from '../src/explore.ts'
import { applyFightCommand, createFight, runFight } from '../src/fight.ts'
import type { Actor, HookInstance } from '../src/fight-types.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import { customHandler } from '../src/skills/custom/index.ts'
import type { Effect, MonsterDef } from '../src/types/content.ts'
import { exactTuning, makeHeroActor } from './helpers.ts'

const content = loadContentDir('content')
const t = exactTuning(content.tuning)
const ATTACK: LineSource = { kind: 'attack', id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: true }

function def(id: string): MonsterDef {
  const d = content.monsters.get(id)
  if (!d) throw new Error(`no monster ${id}`)
  return d
}

function monster(id: string, actorId = id, row: 'front' | 'back' = 'front', level = 8): Actor {
  const a = buildMonsterActor(content, t, def(id), { id: actorId, level, row, hpPercent: 100 })
  installPassiveAttackHooks(a)
  return a
}

function setup(heroes: Actor[], monsters: Actor[], seed = 7) {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, t, { heroes, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 5, floorLevel: 7 }, rng })
  const ctx: EffectContext = { content, t, state, rng }
  return { ctx, state }
}

function hit(ctx: EffectContext, attacker: Actor | null, target: Actor, amount: number, damageType: Effect['damageType'] & string = 'slash', crit = false) {
  if (crit && attacker) attacker.modifiers.push({ stat: 'critRate', amount: 100, percent: 0, turnsLeft: 1, sourceId: 'test-crit' })
  const r = dealDamage(ctx, attacker, target, { amount, damageType, canMiss: false, canCrit: crit, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'test' })
  if (crit && attacker) attacker.modifiers = attacker.modifiers.filter((m) => m.sourceId !== 'test-crit')
  return r
}

/** Runs one custom line's `apply` for `holder` as an attack would, and returns its hook if it installed one. */
function run(ctx: EffectContext, holder: Actor, line: Effect, target: Actor | null, sourceId = 'test'): HookInstance | undefined {
  customHandler(line.customId ?? '')?.apply?.(hookCtx(ctx, holder, null, line, null, sourceId), target, 100)
  return holder.hooks.find((h) => h.customId === line.customId)
}

function turnStart(ctx: EffectContext, actor: Actor): void {
  for (const h of [...actor.hooks]) customHandler(h.customId)?.onTurnStart?.(hookCtx(ctx, actor, null, h.line, h))
}

const hero = (id: string, row: 'front' | 'back' = 'front', hp = 5000) => makeHeroActor(t, { id, row, flatHp: hp, pool: 'mana' })

describe('partyFront and partyBack are the heroes\' rows on both sides (03 DSL: "rows on both sides")', () => {
  it('a monster\'s partyFront hits the heroes\' front row, never its own', () => {
    const front = hero('front', 'front')
    const back = hero('back', 'back')
    const knight = monster('bone-knight', 'knight')
    const archer = monster('skeleton-archer', 'archer', 'back')
    const { ctx } = setup([front, back], [knight, archer])
    expect(resolveTargets(ctx, knight, 'partyFront', null).map((a) => a.id)).toEqual(['front'])
    expect(resolveTargets(ctx, knight, 'partyBack', null).map((a) => a.id)).toEqual(['back'])
  })

  it('a hero\'s partyFront is still its own front row', () => {
    const front = hero('front', 'front')
    const back = hero('back', 'back')
    const knight = monster('bone-knight', 'knight')
    const { ctx } = setup([front, back], [knight])
    expect(resolveTargets(ctx, back, 'partyFront', null).map((a) => a.id)).toEqual(['front'])
    expect(resolveTargets(ctx, front, 'partyBack', null).map((a) => a.id)).toEqual(['back'])
  })
})

describe('the Restless Dead (06 §3.2)', () => {
  it('Raise needs a bone pile: none, and the summoned Footman is taken back; a pile, and it stands in front; one pile once', () => {
    const h = hero('w')
    const sexton = monster('crypt-sexton', 'sexton', 'back')
    const { ctx, state } = setup([h], [sexton])
    const raise = def('crypt-sexton').attacks.find((a) => a.id === 'raise')!
    const rider = raise.effects.find((l) => l.customId === 'raise-bone-pile')!
    const stand = (id: string) => {
      const f = buildMonsterActor(content, t, def('skeleton-footman'), { id, level: 8, row: 'back', hpPercent: 100, summonedBy: 'sexton' })
      state.actors.push(f)
      return f
    }
    const first = stand('raised-1')
    run(ctx, sexton, rider, null, 'raise')
    expect(first.gone && first.fled).toBe(true)
    const pile = buildMonsterActor(content, t, def('skeleton-footman'), { id: 'fallen', level: 8, row: 'front', hpPercent: 100 })
    pile.gone = true
    state.actors.push(pile)
    const second = stand('raised-2')
    run(ctx, sexton, rider, null, 'raise')
    expect(second.gone).toBe(false)
    expect(second.row).toBe('front')
    expect(state.flags['bonePile:fallen']).toBe(true)
    const third = stand('raised-3')
    run(ctx, sexton, rider, null, 'raise')
    expect(third.gone && third.fled).toBe(true)
  })

  it('the Sexton\'s bell (Blunt) and the Hulk\'s second torso take their summons away', () => {
    const h = hero('w')
    const sexton = monster('crypt-sexton', 'sexton', 'back')
    const hulk = monster('charnel-hulk', 'hulk')
    const { ctx } = setup([h], [sexton, hulk])
    hit(ctx, h, sexton, Math.ceil(sexton.maxHp * 0.1), 'slash', true)
    expect(sexton.monster?.partBroken).toBe(false)
    hit(ctx, h, sexton, Math.ceil(sexton.maxHp * 0.1), 'blunt')
    expect(sexton.monster?.partBroken).toBe(true)
    expect(sexton.monster?.attackIds).not.toContain('raise')
    hit(ctx, h, hulk, Math.ceil(hulk.maxHp * 0.07), 'slash', true)
    expect(hulk.monster?.attackIds).not.toContain('shed')
  })

  it('the Shambling Corpse gets back up once at 25% after a turn, unless the blow is Fire or Holy', () => {
    const h = hero('w')
    const a = monster('shambling-corpse', 'a')
    const b = monster('shambling-corpse', 'b')
    const { ctx } = setup([h], [a, b])
    const energy = a.energy
    const r = hit(ctx, h, a, a.hp + 100)
    expect(r.killed).toBe(false)
    expect(a.hp).toBe(1)
    expect(a.energy).toBe(energy - 1000)
    turnStart(ctx, a)
    expect(a.hp).toBe(Math.round(a.maxHp * 0.25))
    expect(hit(ctx, h, a, a.hp + 100).killed).toBe(true)
    expect(hit(ctx, h, b, b.hp + 100, 'fire').killed).toBe(true)
  })

  it('the Bursting Corpse\'s Burst kills it; its belly breaks into a half-strength burst on the front row', () => {
    const front = hero('front', 'front')
    const back = hero('back', 'back')
    const a = monster('bursting-corpse', 'a')
    const b = monster('bursting-corpse', 'b')
    const { ctx, state } = setup([front, back], [a, b])
    run(ctx, a, { kind: 'custom', customId: 'kills-self' }, null)
    expect(a.gone).toBe(true)
    expect(state.counters.monstersKilled).toBe(1)
    const before = { front: front.hp, back: back.hp }
    hit(ctx, front, b, Math.ceil(b.maxHp * 0.1), 'slash', true)
    expect(b.monster?.partBroken).toBe(true)
    expect(b.gone).toBe(true)
    expect(front.hp).toBeLessThan(before.front)
    expect(back.hp).toBe(before.back)
    expect(front.statuses.some((s) => s.id === 'poison')).toBe(true)
  })

  it('the Ghoul\'s jaw: no Bleed on its Gnaw and half its damage; the Bone Knight\'s helm: Slash bites, Accuracy −10', () => {
    const h = hero('w')
    const ghoul = monster('ghoul', 'ghoul')
    const knight = monster('bone-knight', 'knight')
    const { ctx } = setup([h], [ghoul, knight])
    hit(ctx, h, ghoul, Math.ceil(ghoul.maxHp * 0.1), 'slash', true)
    expect(ghoul.monster?.partBroken).toBe(true)
    const rider = ghoul.hooks.find((x) => x.customId === 'lose-status-rider')!
    const hc = hookCtx(ctx, ghoul, null, rider.line, rider)
    const gnaw: LineSource = { ...ATTACK, id: 'gnaw' }
    expect(customHandler('lose-status-rider')!.modifyLine!(hc, { kind: 'applyStatus', status: 'bleed', duration: 2 }, gnaw, h)).toBe('skip')
    expect(customHandler('lose-status-rider')!.modifyLine!(hc, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, gnaw, h)).toMatchObject({ multiplier: 0.5 })
    expect(customHandler('lose-status-rider')!.modifyLine!(hc, { kind: 'damage', multiplier: 0.9, damageType: 'slash' }, { ...ATTACK, id: 'paralysing-claw' }, h)).toBeNull()
    const acc = statOf(ctx, knight, 'accuracy')
    // Pierce and Slash glance off its plate (×0.5): a Blunt crit of 7% max HP clears the 6% break line.
    hit(ctx, h, knight, Math.ceil(knight.maxHp * 0.07), 'blunt', true)
    expect(knight.monster?.resist).not.toContain('slash')
    expect(knight.monster?.resist).toContain('pierce')
    expect(statOf(ctx, knight, 'accuracy')).toBe(acc - 10)
  })
})

describe('the Tidebound (06 §3.3)', () => {
  it('the Brine Ooze splits under a Slash that leaves it standing (HookFx.summon), never under Pierce, at most four', () => {
    const h = hero('w')
    const ooze = monster('brine-ooze', 'ooze', 'front', 11)
    const { ctx, state } = setup([h], [ooze])
    hit(ctx, h, ooze, 40, 'pierce')
    expect(state.actors.filter((a) => a.monster?.monsterId === 'brine-ooze')).toHaveLength(1)
    const hpAfter = ooze.hp - 40
    hit(ctx, h, ooze, 40, 'slash')
    const oozes = state.actors.filter((a) => a.monster?.monsterId === 'brine-ooze' && !a.gone)
    expect(oozes).toHaveLength(2)
    const twin = oozes.find((a) => a !== ooze)!
    expect(ooze.hp + twin.hp).toBe(hpAfter)
    expect(twin.hooks.some((x) => x.customId === 'ooze-split')).toBe(true)
    expect(state.log.some((e) => e.kind === 'summon' && e.targetId === twin.id)).toBe(true)
    for (let i = 0; i < 6; i++) for (const o of state.actors.filter((a) => a.monster?.monsterId === 'brine-ooze' && !a.gone)) if (o.hp > 10) hit(ctx, h, o, 2, 'slash')
    expect(state.actors.filter((a) => a.monster?.monsterId === 'brine-ooze' && !a.gone).length).toBe(4)
  })

  it('the Deep Maw\'s Spawn raises a Deep Tentacle at ×0.6 HP in the front row', () => {
    const h = hero('w')
    const maw = monster('deep-maw', 'maw', 'front', 11)
    maw.monster!.attackIds = ['spawn']
    maw.monster!.behavior = [{ if: 'always', then: 'spawn' }]
    const { state } = setup([h], [maw], 3)
    for (let i = 0; i < 12 && !state.actors.some((a) => a.monster?.monsterId === 'deep-tentacle'); i++) {
      runFight(content, t, state)
      if (state.over) break
      if (state.pendingActorId) applyFightCommand(content, t, state, { kind: 'guard' })
    }
    const tentacle = state.actors.find((a) => a.monster?.monsterId === 'deep-tentacle')
    expect(tentacle).toBeDefined()
    expect(tentacle!.row).toBe('front')
    expect(tentacle!.hp).toBe(Math.max(1, Math.round((tentacle!.maxHp * 60) / 100)))
  })

  it('the Pearl Ooze leaves after three of its turns; Root or Slow stops the count', () => {
    const h = hero('w')
    const pearl = monster('pearl-ooze', 'pearl', 'back', 11)
    const { ctx } = setup([h], [pearl])
    turnStart(ctx, pearl)
    turnStart(ctx, pearl)
    pearl.statuses.push({ id: 'root', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: 'test', counter: 0 })
    turnStart(ctx, pearl)
    expect(pearl.gone).toBe(false)
    pearl.statuses = []
    turnStart(ctx, pearl)
    expect(pearl.gone).toBe(false)
    turnStart(ctx, pearl)
    expect(pearl.gone && pearl.fled).toBe(true)
  })

  it('the Leech drains the latched hero\'s pool and heals; the broken mouth ring drains nothing', () => {
    const h = hero('w')
    h.pool = 100
    h.poolMax = 100
    const leech = monster('vault-leech', 'leech', 'front', 14)
    const { ctx } = setup([h], [leech])
    const latch = def('vault-leech').attacks.find((a) => a.id === 'latch')!
    applyLine(ctx, leech, latch.effects[0]!, 'enemy', h, { ...ATTACK, id: 'latch' })
    run(ctx, leech, latch.effects[1]!, h, 'latch')
    expect(h.grabbedBy).toBe('leech')
    leech.hp = leech.maxHp - 200
    turnStart(ctx, leech)
    expect(h.pool).toBe(85)
    expect(leech.hp).toBe(leech.maxHp - 200 + Math.round(leech.maxHp * 0.05))
    leech.monster!.partBroken = true
    turnStart(ctx, leech)
    expect(h.pool).toBe(85)
  })

  it('the Hag\'s Hex petrifies only a Cursed hero (and finds one); the Maw swallows only the Chilled; the Cocoon only the Webbed', () => {
    const plain = hero('plain')
    const cursed = hero('cursed')
    const hag = monster('brine-hag', 'hag', 'back', 11)
    const { ctx } = setup([plain, cursed], [hag])
    const hex: Effect = { kind: 'custom', customId: 'apply-if-curse', status: 'petrify', duration: 2 }
    run(ctx, hag, hex, plain)
    expect(plain.statuses.some((s) => s.id === 'petrify') || cursed.statuses.some((s) => s.id === 'petrify')).toBe(false)
    cursed.statuses.push({ id: 'curse', stacks: 1, turnsLeft: 3, magnitude: 0, sourceId: 'hag', counter: 0 })
    run(ctx, hag, hex, plain)
    expect(cursed.statuses.some((s) => s.id === 'petrify')).toBe(true)
    expect(plain.statuses.some((s) => s.id === 'petrify')).toBe(false)

    const front = hero('front', 'front')
    const maw = monster('deep-maw', 'maw', 'front', 11)
    const m = setup([front], [maw])
    run(m.ctx, maw, { kind: 'custom', customId: 'apply-if-chill', status: 'grab' }, front)
    expect(front.grabbedBy).toBeNull()
    front.statuses.push({ id: 'chill', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: 'maw', counter: 0 })
    run(m.ctx, maw, { kind: 'custom', customId: 'apply-if-chill', status: 'grab' }, front)
    expect(front.grabbedBy).toBe('maw')

    const back = hero('back', 'back')
    const spider = monster('tomb-spider', 'spider', 'front', 8)
    const s = setup([back], [spider])
    back.statuses.push({ id: 'web', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: 'spider', counter: 0 })
    run(s.ctx, spider, { kind: 'custom', customId: 'apply-if-web', status: 'grab' }, null)
    expect(back.statuses.some((x) => x.id === 'web')).toBe(false)
    expect(back.grabbedBy).toBe('spider')
  })

  it('a hold rides each of the holder\'s turns (the Tentacle\'s Chill); the broken sucker pad lets go after one', () => {
    const h = hero('w')
    const tentacle = monster('deep-tentacle', 'tentacle', 'front', 11)
    const { ctx } = setup([h], [tentacle])
    const drag = def('deep-tentacle').attacks.find((a) => a.id === 'drag-under')!
    applyLine(ctx, tentacle, drag.effects[0]!, 'enemyFront', h, { ...ATTACK, id: 'drag-under' })
    run(ctx, tentacle, drag.effects[1]!, h, 'drag-under')
    turnStart(ctx, tentacle)
    expect(h.statuses.some((s) => s.id === 'chill')).toBe(true)
    run(ctx, tentacle, { kind: 'custom', customId: 'short-hold' }, tentacle)
    turnStart(ctx, tentacle)
    expect(h.grabbedBy).toBe('tentacle')
    turnStart(ctx, tentacle)
    expect(h.grabbedBy).toBeNull()
  })

  it('the Flagellant pulls a back-row hero forward and grows angrier as it bleeds', () => {
    const back = hero('back', 'back')
    const flagellant = monster('tidebound-flagellant', 'flag', 'front', 11)
    const { ctx } = setup([back], [flagellant])
    run(ctx, flagellant, { kind: 'custom', customId: 'pull-to-front' }, back)
    expect(back.row).toBe('front')
    const fury = flagellant.hooks.find((x) => x.customId === 'rage-per-missing-hp')!
    const hc = hookCtx(ctx, flagellant, null, fury.line, fury)
    const incoming = { amount: 10, damageType: 'slash' as const, attacker: flagellant, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: true }
    expect(customHandler('rage-per-missing-hp')!.outgoingDamagePercent!(hc, back, incoming)).toBe(0)
    flagellant.hp = Math.floor(flagellant.maxHp / 2)
    expect(customHandler('rage-per-missing-hp')!.outgoingDamagePercent!(hc, back, incoming)).toBe(50)
  })

  it('the Sentinel\'s core breaks to Blunt: no Tide Ward and Defense −40%; the Drowner\'s helm: no plate resists, Blind', () => {
    const h = hero('w')
    const sentinel = monster('vault-sentinel', 'sentinel', 'front', 11)
    const drowner = monster('tidebound-drowner', 'drowner', 'front', 11)
    const { ctx } = setup([h], [sentinel, drowner])
    const def0 = statOf(ctx, sentinel, 'defense')
    hit(ctx, h, sentinel, Math.ceil(sentinel.maxHp * 0.1), 'slash', true)
    expect(sentinel.monster?.partBroken).toBe(false)
    hit(ctx, h, sentinel, Math.ceil(sentinel.maxHp * 0.1), 'blunt')
    expect(sentinel.monster?.attackIds).not.toContain('tide-ward')
    expect(statOf(ctx, sentinel, 'defense')).toBe(Math.round(def0 * 0.6))
    hit(ctx, h, drowner, Math.ceil(drowner.maxHp * 0.1), 'blunt', true)
    expect(drowner.monster?.resist).toEqual(['frost'])
    expect(drowner.statuses.some((s) => s.id === 'blind')).toBe(true)
  })

  it('the Vault Lantern dies into light, and a Holy blessing adds its percent to Holy hits only', () => {
    const h = hero('w')
    const lantern = monster('vault-lantern', 'lantern', 'back', 11)
    const { ctx, state } = setup([h], [lantern])
    const light = state.light
    hit(ctx, h, lantern, lantern.hp + 50, 'slash')
    expect(state.light).toBe(light + 5)
    const line: Effect = { kind: 'custom', customId: 'element-damage-percent', damageType: 'holy', percent: 15 }
    run(ctx, h, line, h)
    const hook = h.hooks.find((x) => x.customId === 'element-damage-percent')!
    const hc = hookCtx(ctx, h, null, hook.line, hook)
    const inc = (damageType: 'holy' | 'slash') => ({ amount: 10, damageType, attacker: h, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: damageType === 'slash' })
    expect(customHandler('element-damage-percent')!.outgoingDamagePercent!(hc, lantern, inc('holy'))).toBe(15)
    expect(customHandler('element-damage-percent')!.outgoingDamagePercent!(hc, lantern, inc('slash'))).toBe(0)
  })
})

describe('behaviour leaves the weights alive (C1, Phase 7)', () => {
  it('no regular monster ends in an unconditional gambit that names one of its moves', () => {
    const dead: string[] = []
    for (const m of content.monsters.values()) {
      if (m.boss) continue
      const weighted = m.attacks.filter((a) => a.aiWeight > 0)
      if (weighted.length < 2) continue
      const first = parseBehavior(m.behavior.rules).clauses.find((c) => c.conditions.length === 0)
      if (first && first.action.verb === 'named' && m.attacks.some((a) => a.id === first.action.ref)) dead.push(`${m.id}: ${first.action.ref}`)
    }
    expect(dead).toEqual([])
  })

  it('every telegraphed attack of the Crypts, the Vault and the Cellars carries a two-word hint', () => {
    const missing: string[] = []
    for (const m of content.monsters.values()) for (const a of m.attacks) if (a.tell && (!a.hint || a.hint.trim().split(/\s+/).length !== 2)) missing.push(`${m.id}.${a.id}`)
    expect(missing).toEqual([])
  })
})
