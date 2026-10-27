/**
 * The Cellars hooks (06 §3.1 monsters, 07 §2.4–§2.6 curios/traps/secrets, 08 §4–§5 items): the fight-side handlers
 * through the real pipeline, and the delve side (pending statuses, a secret room's record) on the fixture corpus.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, hashDelve, legalDelveActions, runDelveAuto, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { applyLine, dealDamage, hookCtx, type EffectContext } from '../src/effects.ts'
import { installPassiveAttackHooks } from '../src/explore.ts'
import { createFight } from '../src/fight.ts'
import type { Actor, HookInstance } from '../src/fight-types.ts'
import { createHero } from '../src/hero.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import alliesFocusMarked from '../src/skills/custom/allies-focus-marked.ts'
import answerNextMeleeHit from '../src/skills/custom/answer-next-melee-hit.ts'
import cannotNet from '../src/skills/custom/cannot-net.ts'
import vanishOneTurn from '../src/skills/custom/vanish-one-turn.ts'
import { resistChance, statusDef } from '../src/statuses.ts'
import type { Effect, HeroRecord, MonsterDef } from '../src/types/content.ts'
import { assembleFixtureCorpus } from './fixtures/assemble.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

const tuning = exactTuning(loadTuning())
const ratDef = example('monster', 'monster').json as MonsterDef
const cutpurseDef: MonsterDef = {
  ...ratDef,
  id: 'grinning-cutpurse',
  name: 'Grinning Cutpurse',
  size: 'medium',
  attacks: [
    { id: 'shank', name: 'Shank', damageType: 'pierce', weight: 800, multiplier: 0.9, target: 'enemyFront', effects: [], aiWeight: 60, tell: null },
    { id: 'pickpocket', name: 'Pickpocket', damageType: 'pierce', weight: 800, multiplier: 0.5, target: 'enemyFront', effects: [{ kind: 'custom', customId: 'steal-party-gold', percent: 5 }], aiWeight: 30, tell: null },
  ],
  parts: { ...ratDef.parts, breakLimb: { name: 'purse', effect: { kind: 'custom', customId: 'drop-stolen-gold' } } },
}
const netterDef: MonsterDef = {
  ...ratDef,
  id: 'grinning-netter',
  name: 'Grinning Netter',
  size: 'medium',
  rows: ['back'],
  attacks: [
    { id: 'net-throw', name: 'Net Throw', damageType: 'blunt', weight: 1000, multiplier: 0, target: 'enemy', effects: [{ kind: 'applyStatus', status: 'grab' }], aiWeight: 50, tell: null },
    { id: 'gaff', name: 'Gaff', damageType: 'pierce', weight: 800, multiplier: 1, target: 'enemy', effects: [], aiWeight: 35, tell: null },
    { id: 'reload', name: 'Reload', damageType: 'blunt', weight: 800, multiplier: 0, target: 'self', effects: [], aiWeight: 15, tell: null },
  ],
  parts: { ...ratDef.parts, breakLimb: { name: 'net hand', effect: { kind: 'custom', customId: 'cannot-net' } } },
}
const content = makeContent([example('monster', 'monster'), { kind: 'monster', path: 'monsters/grinning-cutpurse.json', json: cutpurseDef }, { kind: 'monster', path: 'monsters/grinning-netter.json', json: netterDef }])

const ATTACK = { kind: 'attack' as const, id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: true }

function monster(def: MonsterDef, id: string, row: 'front' | 'back' = 'front'): Actor {
  return buildMonsterActor(content, tuning, def, { id, level: 1, row, hpPercent: 100 })
}

function setup(heroes: Actor[], monsters: Actor[], seed = 7, partyGold = 0) {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1, partyGold }, rng })
  const ctx: EffectContext = { content, t: tuning, state, rng }
  return { ctx, state }
}

function hit(ctx: EffectContext, attacker: Actor | null, target: Actor, amount: number, melee = true, damageType: Effect['damageType'] & string = 'pierce', crit = false) {
  // A crit is forced by a +100 Crit Rate modifier for the one hit (an untyped limb breaks only on a crit: D-078).
  if (crit && attacker) attacker.modifiers.push({ stat: 'critRate', amount: 100, percent: 0, turnsLeft: 1, sourceId: 'test-crit' })
  const r = dealDamage(ctx, attacker, target, { amount, damageType, canMiss: false, canCrit: crit, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: melee, ignoresDefense: true, sourceLabel: 'test' })
  if (crit && attacker) attacker.modifiers = attacker.modifiers.filter((m) => m.sourceId !== 'test-crit')
  return r
}

/** The context a rule hook sees while held, as the fight builds it. */
function held(ctx: EffectContext, holder: Actor, hook: HookInstance) {
  return hookCtx(ctx, holder, null, hook.line, hook)
}

describe('the Grinning Company (06 §3.1)', () => {
  it('Pickpocket steals 5% of the party gold once, and the thief gives it back when it dies', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 500 })
    const thief = monster(cutpurseDef, 'thief')
    const { ctx, state } = setup([hero], [thief], 7, 400)
    const line = cutpurseDef.attacks[1]!.effects[0]!
    applyLine(ctx, thief, line, 'enemyFront', hero, { ...ATTACK, id: 'pickpocket' })
    expect(state.counters.goldStolen).toBe(20)
    expect(thief.hooks.find((h) => h.customId === 'steal-party-gold')?.data.stolen).toBe(20)
    // A second Pickpocket by the same thief finds its purse full.
    applyLine(ctx, thief, line, 'enemyFront', hero, { ...ATTACK, id: 'pickpocket' })
    expect(state.counters.goldStolen).toBe(20)
    // Killing it returns the take.
    const r = hit(ctx, hero, thief, thief.hp + 50)
    expect(r.killed).toBe(true)
    expect(state.counters.goldStolen).toBe(0)
    expect(state.log.some((e) => e.kind === 'goldReturned' && e.amount === 20)).toBe(true)
  })

  it('the purse part-break drops the stolen gold at once', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 500 })
    const thief = monster(cutpurseDef, 'thief')
    const { ctx, state } = setup([hero], [thief], 7, 200)
    applyLine(ctx, thief, cutpurseDef.attacks[1]!.effects[0]!, 'enemyFront', hero, { ...ATTACK, id: 'pickpocket' })
    expect(state.counters.goldStolen).toBe(10)
    // One critical blow of ≥ 6% max HP breaks the (untyped) purse (effects.ts breakPart, D-078); a plain blow does not.
    hit(ctx, hero, thief, Math.ceil(thief.maxHp * 0.1))
    expect(thief.monster?.partBroken).toBe(false)
    hit(ctx, hero, thief, Math.ceil(thief.maxHp * 0.1), true, 'pierce', true)
    expect(thief.monster?.partBroken).toBe(true)
    expect(state.counters.goldStolen).toBe(0)
    expect(thief.hooks.some((h) => h.customId === 'steal-party-gold')).toBe(false)
  })

  it('Grin: every bandit prefers the Marked hero', () => {
    const marked = makeHeroActor(tuning, { id: 'a' })
    const other = makeHeroActor(tuning, { id: 'b' })
    const captain = monster(cutpurseDef, 'captain', 'back')
    const bandit = monster(cutpurseDef, 'bandit')
    const { ctx } = setup([other, marked], [captain, bandit])
    applyLine(ctx, captain, { kind: 'applyStatus', status: 'mark', duration: 2 }, 'enemy', marked, { ...ATTACK, id: 'grin' })
    applyLine(ctx, captain, { kind: 'custom', customId: 'allies-focus-marked', target: 'allAllies' }, 'enemy', marked, { ...ATTACK, id: 'grin' })
    expect(bandit.hooks.map((h) => h.customId)).toEqual(['allies-focus-marked'])
    const hc = held(ctx, bandit, bandit.hooks[0]!)
    expect(alliesFocusMarked.preferredTarget!(hc, [other, marked])?.id).toBe('a')
    marked.statuses = []
    expect(alliesFocusMarked.preferredTarget!(hc, [other, marked])).toBeNull()
  })

  it('the net hand break removes Net Throw from the Netter for the rest of the fight', () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    const netter = monster(netterDef, 'netter', 'back')
    const { ctx } = setup([hero], [netter])
    expect(netter.monster?.attackIds).toContain('net-throw')
    hit(ctx, hero, netter, Math.ceil(netter.maxHp * 0.1), true, 'pierce', true)
    expect(netter.monster?.partBroken).toBe(true)
    expect(netter.monster?.attackIds).toEqual(['gaff', 'reload'])
    expect(netter.hooks.map((h) => h.customId)).toEqual(['cannot-net'])
    // A phase change that re-added it is undone at the next turn start.
    netter.monster!.attackIds.push('net-throw')
    cannotNet.onTurnStart!(held(ctx, netter, netter.hooks[0]!))
    expect(netter.monster?.attackIds).toEqual(['gaff', 'reload'])
  })

  it('Riposte answers the next melee hit on her once per 2 turns, never a ranged one', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 400 })
    const captain = monster({ ...cutpurseDef, attacks: [...cutpurseDef.attacks, { id: 'riposte', name: 'Riposte', damageType: 'slash', weight: 800, multiplier: 1.2, target: 'enemy', effects: [{ kind: 'custom', customId: 'answer-next-melee-hit' }], aiWeight: 30, tell: null }] }, 'captain')
    const { ctx } = setup([hero], [captain])
    applyLine(ctx, captain, { kind: 'custom', customId: 'answer-next-melee-hit' }, 'enemy', hero, { ...ATTACK, id: 'riposte' })
    const hook = captain.hooks.find((h) => h.customId === 'answer-next-melee-hit')!
    expect(hook.counter).toBe(0)
    const before = hero.hp
    hit(ctx, hero, captain, 5, false)
    expect(hero.hp).toBe(before)
    hit(ctx, hero, captain, 5, true)
    expect(hero.hp).toBeLessThan(before)
    expect(hook.counter).toBe(2)
    const after = hero.hp
    hit(ctx, hero, captain, 5, true)
    expect(hero.hp).toBe(after)
    const hc = held(ctx, captain, hook)
    answerNextMeleeHit.onTurnStart!(hc)
    answerNextMeleeHit.onTurnStart!(hc)
    expect(hook.counter).toBe(0)
    hit(ctx, hero, captain, 5, true)
    expect(hero.hp).toBeLessThan(after)
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.text.includes('Riposte'))).toHaveLength(2)
  })

  it('Coin Flip: the next damage roll crits and the hook is spent', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 400 })
    const captain = monster(cutpurseDef, 'captain')
    const { ctx } = setup([hero], [captain])
    applyLine(ctx, captain, { kind: 'custom', customId: 'next-attack-guaranteed-crit', target: 'self' }, 'self', captain, { ...ATTACK, id: 'coin-flip' })
    expect(captain.hooks.map((h) => h.customId)).toEqual(['next-attack-guaranteed-crit'])
    const r = dealDamage(ctx, captain, hero, { amount: 10, damageType: 'pierce', canMiss: false, canCrit: true, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'knife' })
    expect(r.crit).toBe(true)
    expect(captain.hooks).toEqual([])
  })
})

describe('Old Gnaw and the vermin (06 §3.1)', () => {
  it('Bolt-hole: untargetable for a turn, then back in the other row', () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    const gnaw = monster(ratDef, 'gnaw', 'front')
    const { ctx } = setup([hero], [gnaw])
    applyLine(ctx, gnaw, { kind: 'custom', customId: 'vanish-one-turn', target: 'self' }, 'self', gnaw, { ...ATTACK, id: 'bolt-hole' })
    expect(gnaw.hooks.map((h) => h.customId)).toEqual(['vanish-one-turn'])
    // Nobody can target it: a hero's single-target line finds no one.
    const out = applyLine(ctx, hero, { kind: 'damage', multiplier: 1, damageType: 'slash' }, 'enemy', gnaw, { ...ATTACK, kind: 'basic', id: 'basic' })
    expect(out.targets).toEqual([])
    vanishOneTurn.onTurnStart!(held(ctx, gnaw, gnaw.hooks[0]!))
    expect(gnaw.row).toBe('back')
    expect(gnaw.hooks).toEqual([])
    expect(applyLine(ctx, hero, { kind: 'damage', multiplier: 1, damageType: 'slash' }, 'enemy', gnaw, { ...ATTACK, kind: 'basic', id: 'basic' }).targets).toEqual(['gnaw'])
  })

  it('the swarm turns: a dying rat hastes its rat allies (hooks armed at spawn by explore.ts)', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 400 })
    const swarmRat: MonsterDef = { ...ratDef, attacks: [...ratDef.attacks, { id: 'swarm-turns', name: 'The Swarm Turns', damageType: 'blunt', weight: 800, multiplier: 0, target: 'allAllies', effects: [{ kind: 'custom', customId: 'swarm-haste-on-death', status: 'haste', duration: 1, target: 'allAllies' }], aiWeight: 0, tell: null }] }
    const a = monster(swarmRat, 'rat-a')
    const b = monster(swarmRat, 'rat-b')
    installPassiveAttackHooks(a)
    installPassiveAttackHooks(b)
    expect(a.hooks.map((h) => h.customId)).toEqual(['swarm-haste-on-death'])
    const { ctx } = setup([hero], [a, b])
    hit(ctx, hero, a, a.hp + 10)
    expect(a.gone).toBe(true)
    expect(b.statuses.map((s) => s.id)).toEqual(['haste'])
  })
})

describe('items and affixes (08 §4–§6)', () => {
  it('an Antidote raises the Poison resist roll by 50% for 3 turns', () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    const rat = monster(ratDef, 'rat')
    const { ctx } = setup([hero], [rat])
    const poison = statusDef(content, 'poison')
    const before = resistChance(hero, poison)
    applyLine(ctx, hero, { kind: 'custom', customId: 'status-resist-bonus', status: 'poison', percent: 50, duration: 3 }, 'ally', hero, { ...ATTACK, kind: 'item', id: 'antidote' })
    expect(resistChance(hero, poison)).toBe(before + 50)
    expect(resistChance(hero, statusDef(content, 'bleed'))).toBe(before)
    expect(hero.hooks[0]?.turnsLeft).toBe(3)
  })

  it('of Fire Warding takes its percent off Fire hits only', () => {
    const hero = makeHeroActor(tuning, { id: 'w', flatHp: 400 })
    const rat = monster(ratDef, 'rat')
    const { ctx } = setup([hero], [rat])
    installHook(hero, { kind: 'custom', customId: 'element-resist-percent', damageType: 'fire', target: 'self', percent: 25 }, 'of-fire-warding', { data: { itemId: 'x', slot: 'chest' } })
    const fire = hit(ctx, rat, hero, 100, false, 'fire')
    expect(fire.dealt).toBe(75)
    const frost = hit(ctx, rat, hero, 100, false, 'frost')
    expect(frost.dealt).toBe(100)
  })

  it('Steadfast arms Fear and Stun resist hooks at the fight start', () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    installHook(hero, { kind: 'custom', customId: 'fear-stun-resist-percent', target: 'self', percent: 20 }, 'steadfast')
    const rat = monster(ratDef, 'rat')
    setup([hero], [rat])
    expect(resistChance(hero, statusDef(content, 'fear'))).toBe(hero.base.resistance + 20)
    expect(resistChance(hero, statusDef(content, 'stun'))).toBe(hero.base.resistance + 20)
    expect(resistChance(hero, statusDef(content, 'poison'))).toBe(hero.base.resistance)
  })

  it('Deep adds flat pool at the fight start; the set bonus crits the first attack only', () => {
    const hero = makeHeroActor(tuning, { id: 'w' })
    installHook(hero, { kind: 'custom', customId: 'max-pool-flat', target: 'self', percent: 5 }, 'deep')
    installHook(hero, { kind: 'custom', customId: 'first-attack-each-fight-crits' }, 'grinning-companys-cut')
    const poolMax = hero.poolMax
    const rat = monster(ratDef, 'rat')
    const { ctx } = setup([hero], [rat])
    expect(hero.poolMax).toBe(poolMax + 5)
    const first = dealDamage(ctx, hero, rat, { amount: 1, damageType: 'slash', canMiss: false, canCrit: true, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'cut' })
    expect(first.crit).toBe(true)
    let crits = 0
    for (let i = 0; i < 20; i++) if (dealDamage(ctx, hero, rat, { amount: 1, damageType: 'slash', canMiss: false, canCrit: true, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'cut' }).crit) crits++
    expect(crits).toBeLessThan(20)
  })

  it('Verminbane adds its percent against the Cellars family, not elsewhere', () => {
    const vermin = makeContent([example('monster', 'monster'), { kind: 'affix', path: 'affixes/verminbane.json', json: { id: 'verminbane', name: 'Verminbane', position: 'prefix', slots: ['mainHand'], weight: 2, tags: ['offensive', 'bane', 'family:vermin'], lines: [{ bandMin: 'F', bandMax: 'God', effect: { kind: 'custom', customId: 'damage-vs-family-percent', target: 'enemy' }, min: 10, max: 10 }] } }])
    const hero = makeHeroActor(tuning, { id: 'w' })
    installHook(hero, { kind: 'custom', customId: 'damage-vs-family-percent', target: 'enemy', percent: 10 }, 'verminbane')
    const rat = buildMonsterActor(vermin, tuning, ratDef, { id: 'rat', level: 1, row: 'front', hpPercent: 100 })
    const ghoul = buildMonsterActor(vermin, tuning, { ...ratDef, id: 'ghoul', familyId: 'restless-dead' }, { id: 'ghoul', level: 1, row: 'front', hpPercent: 100 })
    const rng = new Rng(seedState(3, 4))
    const state = createFight(vermin, tuning, { heroes: [hero], pets: [], monsters: [rat, ghoul], surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
    const ctx: EffectContext = { content: vermin, t: tuning, state, rng }
    expect(hit(ctx, hero, rat, 100).dealt).toBe(110)
    expect(hit(ctx, hero, ghoul, 100).dealt).toBe(100)
  })
})

describe('the delve side (07 §2.4–§2.6)', () => {
  let root = ''
  let fixture: Content
  beforeAll(() => {
    root = assembleFixtureCorpus()
    // The fixture dungeon has no secrets: add the Smuggler's Cache from the example so the secret path is exercised.
    const dungeonPath = path.join(root, 'content', 'dungeons', 'gravehollow-keep', 'dungeon.json')
    const dungeon = JSON.parse(fs.readFileSync(dungeonPath, 'utf8')) as Record<string, unknown>
    const exampleDungeon = JSON.parse(fs.readFileSync(path.join('content', 'examples', 'dungeon.example.json'), 'utf8')) as { secrets: unknown[] }
    fs.writeFileSync(dungeonPath, JSON.stringify({ ...dungeon, secrets: exampleDungeon.secrets }, null, 2))
    fixture = loadContentDir(path.join(root, 'content'))
  })
  afterAll(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  const warden = (id = 'w1'): HeroRecord => createHero(fixture, fixture.tuning, Rng.fromSeed(1), { id, name: 'Hesper', speciesId: 'human', classId: 'warden', freePoints: { strength: 1, endurance: 2, vitality: 3 } })
  const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', ...over })

  /** A delve whose entry room has a door to a fight room, from the first seed that gives one. */
  function delveWithFightNextDoor(): { state: DelveState; fightRoom: string } {
    for (let seed = 1; seed < 200; seed++) {
      const state = createDelve(fixture, options({ seed }), [warden()])
      const entry = state.floor.graph.rooms.find((r) => r.id === state.floor.graph.entryId)!
      const door = entry.doors.find((d) => !d.secret && !d.locked && state.floor.rooms[d.to]?.kind === 'fight' && state.floor.rooms[d.to]?.encounterId)
      if (door && state.floor.rooms[door.to]!.traps.length === 0) return { state, fightRoom: door.to }
    }
    throw new Error('no seed with a fight next door')
  }

  it('a pending status lands on the party at the next fight start, then is spent', () => {
    const { state, fightRoom } = delveWithFightNextDoor()
    state.pendingStatuses.push({ kind: 'status', status: 'regen', target: 'allAllies', fightsLeft: 1, sourceId: 'mouldering-larder' })
    state.pendingStatuses.push({ kind: 'resist', status: 'fear', target: 'allAllies', percent: 100, fightsLeft: null, sourceId: 'toll-shrine' })
    stepDelve(fixture, state, { kind: 'move', toRoomId: fightRoom })
    expect(state.phase.kind).toBe('fight')
    const heroes = state.fight!.actors.filter((a) => a.kind === 'hero')
    expect(heroes.length).toBe(1)
    expect(heroes[0]!.statuses.some((s) => s.id === 'regen' && s.sourceId === 'mouldering-larder')).toBe(true)
    expect(heroes[0]!.hooks.some((h) => h.customId === 'status-resist-bonus' && h.line.status === 'fear' && h.line.percent === 100)).toBe(true)
    expect(resistChance(heroes[0]!, statusDef(fixture, 'fear'))).toBeGreaterThanOrEqual(100)
    expect(state.pendingStatuses.map((p) => p.sourceId)).toEqual(['toll-shrine'])
    expect(state.fight!.log.some((e) => e.kind === 'status' && e.text.includes('regen'))).toBe(true)
  })

  it('a secret room pays its record: gold, the torches and the chest of the Smuggler\'s Cache', () => {
    let found: DelveState | null = null
    for (let seed = 1; seed < 400 && !found; seed++) {
      const state = createDelve(fixture, options({ seed }), [warden()])
      if (state.floor.graph.secretId && state.floor.secretId === 'smugglers-cache') found = state
    }
    expect(found, 'a floor with a secret room').not.toBeNull()
    const state = found!
    const secretId = state.floor.graph.secretId!
    const host = state.floor.graph.rooms.find((r) => r.doors.some((d) => d.to === secretId && d.secret))!
    // Stand in the host room with the door found, then walk through.
    state.floor.currentRoomId = host.id
    state.floor.rooms[host.id]!.visited = true
    state.floor.rooms[host.id]!.secretRevealed = true
    state.phase = { kind: 'room' }
    const gold = state.gold
    const torchesBefore = state.heroes[0]!.record.bag.find((b) => b.itemId === 'torch')?.quantity ?? 0
    expect(legalDelveActions(fixture, state).some((a) => a.command.kind === 'move' && a.command.toRoomId === secretId)).toBe(true)
    stepDelve(fixture, state, { kind: 'move', toRoomId: secretId })
    expect(state.gold).toBe(gold + 45)
    expect(state.heroes[0]!.record.bag.find((b) => b.itemId === 'torch')?.quantity).toBe(torchesBefore + 2)
    expect(state.floor.rooms[secretId]!.chests).toEqual([{ size: 'small', locked: false, trapped: false, trapId: null, opened: false }])
    expect(state.log.some((e) => e.kind === 'secret' && e.text.startsWith("Smuggler's Cache"))).toBe(true)
  })

  it('a replayed delve with pending statuses hashes the same', () => {
    const a = createDelve(fixture, options({ seed: 23, auto: true }), [warden()])
    a.pendingStatuses.push({ kind: 'status', status: 'fortify', target: 'allAllies', fightsLeft: 2, sourceId: 'test' })
    runDelveAuto(fixture, a)
    const b = createDelve(fixture, options({ seed: 23, auto: true }), [warden()])
    b.pendingStatuses.push({ kind: 'status', status: 'fortify', target: 'allAllies', fightsLeft: 2, sourceId: 'test' })
    for (const c of a.commandLog) stepDelve(fixture, b, c)
    expect(hashDelve(b)).toBe(hashDelve(a))
  })
})
