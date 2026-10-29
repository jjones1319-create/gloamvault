import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, heroAmbushParts, partyDetection, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { heroAmbushChance } from '../src/detection.ts'
import type { EffectContext } from '../src/effects.ts'
import { applyFightCommand, createFight, decideHero, legalFightActions, runFight } from '../src/fight.ts'
import type { Actor, FightState } from '../src/fight-types.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng } from '../src/rng.ts'
import type { DungeonDef, HeroRecord } from '../src/types/content.ts'

/**
 * Pass A's shared-file joints (Phase 7): the Tier IV skills whose effect lives in the delve or the fight loop, and the
 * two bugs found on the way — the heroes' ambush lines (Ambush Sense, since Phase 3) and the passives' Detection were
 * never read outside a fight.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning

const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', floor: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', deathRule: 'sheltered', ...over })

/** A level-1 hero of the class with these passives slotted (at `rank`), and these actives. */
function hero(id: string, classId: string, passives: string[] = [], rank = 1, actives: string[] = []): HeroRecord {
  const speciesId = 'human'
  const r = createHero(content, t, Rng.fromSeed(5), { id, name: id, speciesId, classId })
  const extra = [...passives, ...actives].filter((s) => !r.skills.some((k) => k.skillId === s))
  return {
    ...r,
    skills: [...r.skills.map((k) => (passives.includes(k.skillId) ? { ...k, rank } : k)), ...extra.map((skillId) => ({ skillId, rank, xp: 0 }))],
    loadout: { ...r.loadout, passives: [...passives, null, null].slice(0, Math.max(2, passives.length)) as never, ...(actives.length ? { actives: [...actives, null, null, null, null].slice(0, 4) as never } : {}) },
  }
}

const graphRoom = (s: DelveState, id = s.floor.currentRoomId) => s.floor.graph.rooms.find((r) => r.id === id)!
const openDoor = (s: DelveState, from = s.floor.currentRoomId) => graphRoom(s, from).doors.find((d) => !d.secret && !d.locked)!

/** Makes the room behind the entry's first open door a plain fight and walks in: the side the ambush roll surprised, or 'none'. */
function surpriseAtFirstFight(party: HeroRecord[], seed: number, light = 40): string {
  const s = createDelve(content, options({ seed, light }), party)
  const to = openDoor(s).to
  const encounterId = Object.values(s.floor.rooms).find((r) => r.encounterId)?.encounterId ?? 'rat-pack'
  ;(graphRoom(s, to) as { kind: string }).kind = 'fight'
  Object.assign(s.floor.rooms[to]!, { encounterId, cleared: false, traps: [] })
  stepDelve(content, s, { kind: 'move', toRoomId: to })
  expect(s.phase.kind).toBe('fight')
  return s.fight?.surprised ?? 'none'
}

describe("the ambush roll reads the heroes' passives (fix: only the pets' traits were read)", () => {
  it('Ambush Sense: −10, Mastery −15, the best single hero; a fallen hero counts for nothing; Dawn Vigil brightens the band one step', () => {
    const plain = createDelve(content, options(), [hero('r', 'ranger')])
    expect(heroAmbushParts(content, plain)).toEqual({ cut: 0, lightShift: 0 })
    const sense = createDelve(content, options(), [hero('r', 'ranger', ['ranger-ambush-sense']), hero('r2', 'ranger', ['ranger-ambush-sense'], 10)])
    expect(heroAmbushParts(content, sense).cut).toBe(-15)
    sense.heroes[1]!.fallen = true
    expect(heroAmbushParts(content, sense).cut).toBe(-10)
    const vigil = createDelve(content, options(), [hero('m', 'mender', ['mender-dawn-vigil'])])
    expect(heroAmbushParts(content, vigil)).toEqual({ cut: 0, lightShift: 1 })
  })

  it("D-099's cap: one Ranger's Ambush Sense and Never Lost together cut no deeper than 30", () => {
    const s = createDelve(content, options(), [hero('r', 'ranger', ['ranger-ambush-sense', 'ranger-never-lost'], 10)])
    expect(heroAmbushParts(content, s).cut).toBe(-30)
  })

  it('before and after: a Ranger in Dim light, against monsters with no ambush modifier', () => {
    const r = hero('r', 'ranger', ['ranger-ambush-sense'])
    const s = createDelve(content, options({ light: 60 }), [r])
    const input = { light: 60, darkvisionShift: 0, bestPerception: r.attributes.perception, monsterModifier: 0, orcsInParty: 0, shadesInParty: 0 }
    const before = heroAmbushChance(t, { ...input, extra: 0 })
    const after = heroAmbushChance(t, { ...input, extra: heroAmbushParts(content, s).cut })
    expect(before).toBeGreaterThan(10)
    expect(after).toBe(before - 10)
    // Dawn Vigil in Shadowy light reads Dim: the band's 15 becomes 5.
    const shadowy = { ...input, light: 40, extra: 0 }
    expect(heroAmbushChance(t, shadowy) - heroAmbushChance(t, { ...shadowy, darkvisionShift: -1 })).toBe(10)
  })

  it('in the delve: with the same draws, Ambush Sense or Dawn Vigil never adds a surprise and takes some away', () => {
    for (const [withIt, without] of [
      [[hero('r', 'ranger', ['ranger-ambush-sense'], 10)], [hero('r', 'ranger')]],
      [[hero('m', 'mender', ['mender-dawn-vigil'])], [hero('m', 'mender')]],
    ] as const) {
      let fewer = 0
      for (let seed = 1; seed <= 60; seed++) {
        const a = surpriseAtFirstFight([...withIt], seed)
        const b = surpriseAtFirstFight([...without], seed)
        if (a === 'party') expect(b).toBe('party')
        if (b === 'party' && a !== 'party') fewer++
      }
      expect(fewer).toBeGreaterThan(0)
    }
  })
})

describe("the passives' Detection outside a fight (fix: heroStats leaves the loadout passives out)", () => {
  it('Keen Eyes adds its +3 to the party Detection that traps, secrets and curios read', () => {
    const without = partyDetection(content, t, createDelve(content, options({ light: 100 }), [hero('r', 'ranger')]))
    const withIt = partyDetection(content, t, createDelve(content, options({ light: 100 }), [hero('r', 'ranger', ['ranger-keen-eyes'])]))
    expect(withIt).toBe(without + 3)
    // Mastery: +6, at the rank's +4% a rank (rank 10: 6 × 136% = 8).
    expect(partyDetection(content, t, createDelve(content, options({ light: 100 }), [hero('r', 'ranger', ['ranger-keen-eyes'], 10)]))).toBe(without + 8)
  })
})

describe('Tier IV: Wayfinder in the delve', () => {
  it('the hunter comes at 50 ticks, not 40', () => {
    const tick = (s: DelveState) => {
      const to = openDoor(s).to
      Object.assign(s.floor.rooms[to]!, { encounterId: null, cleared: true, traps: [], curioId: null })
      ;(graphRoom(s, to) as { kind: string }).kind = 'empty'
      stepDelve(content, s, { kind: 'move', toRoomId: to })
    }
    const plain = createDelve(content, options(), [hero('r', 'ranger')])
    expect(plain.floor.hunter).not.toBeNull()
    plain.floor.clock = 44
    tick(plain)
    expect(plain.floor.hunter!.entered).toBe(true)
    const way = createDelve(content, options(), [hero('r', 'ranger', ['ranger-wayfinder'])])
    way.floor.clock = 44
    tick(way)
    expect(way.floor.hunter!.entered).toBe(false)
    way.floor.clock = 49
    tick(way)
    expect(way.floor.clock).toBe(50)
    expect(way.floor.hunter!.entered).toBe(true)
  })

  it('a floor holds its secret room 10 points more often (the same draws: never fewer)', () => {
    let withOnly = 0
    for (let seed = 1; seed <= 80; seed++) {
      const a = createDelve(content, options({ floor: 2, seed }), [hero('r', 'ranger', ['ranger-wayfinder'])]).floor.graph.secretId
      const b = createDelve(content, options({ floor: 2, seed }), [hero('r', 'ranger')]).floor.graph.secretId
      if (b !== null) expect(a).not.toBeNull()
      if (a !== null && b === null) withOnly++
    }
    expect(withOnly).toBeGreaterThan(0)
  })

  it("Cartography +2: a Ranger's starting 2 becomes 4, one ring of rooms around each room entered (fix: the reveal had never been built)", () => {
    const ring = (s: DelveState) => graphRoom(s).doors.filter((d) => !d.secret).map((d) => d.to)
    for (let seed = 1; seed <= 10; seed++) {
      const way = createDelve(content, options({ seed }), [hero('r', 'ranger', ['ranger-wayfinder'])])
      const plain = createDelve(content, options({ seed }), [hero('r', 'ranger')])
      for (const id of ring(way)) expect(way.floor.rooms[id]!.scouted).toBe(true)
      for (const [id, rs] of Object.entries(plain.floor.rooms)) if (rs.scouted) expect(way.floor.rooms[id]!.scouted).toBe(true)
    }
  })

  it('Cartography 10 marks the stairs from the first room; Blind Map turns Cartography off', () => {
    const cartographer = (): HeroRecord => {
      const r = hero('a', 'arcanist')
      return { ...r, fieldSkills: { ...r.fieldSkills, cartography: { ...r.fieldSkills.cartography, rank: 10 } } }
    }
    const s = createDelve(content, options(), [cartographer()])
    expect(s.floor.rooms[s.floor.graph.exitId]!.scouted).toBe(true)
    const blind = createDelve(content, options({ pactIds: ['blind-map'] }), [cartographer()])
    expect(Object.values(blind.floor.rooms).some((r) => r.scouted)).toBe(false)
  })

  it('the Coffin Catapult (Cartography 3+) is spotted by a Ranger with Wayfinder, not without', () => {
    const spotted = (party: HeroRecord[]) => {
      const s = createDelve(content, options({ floor: 4, light: 100 }), party)
      const to = openDoor(s).to
      s.floor.rooms[to]!.traps = [{ trapId: 'coffin-catapult', revealed: false, disarmed: false, triggered: false, blocksDoorTo: null }]
      stepDelve(content, s, { kind: 'move', toRoomId: to })
      return s.floor.rooms[to]!.traps[0]!.revealed
    }
    expect(spotted([hero('r', 'ranger')])).toBe(false)
    expect(spotted([hero('r', 'ranger', ['ranger-wayfinder'])])).toBe(true)
  })
})

describe('Tier IV: Treasure Sense finds a secret door the party alone would miss', () => {
  /** Content whose floor 2 secret door needs exactly `difficulty` Detection. */
  function withSecretDifficulty(difficulty: number): Content {
    const d = structuredClone(content.dungeons.get('gravehollow-keep')!) as DungeonDef & { floors: { secretDifficulty: number }[] }
    d.floors[1]!.secretDifficulty = difficulty
    const dungeons = new Map(content.dungeons)
    dungeons.set(d.id, d)
    return { ...content, dungeons }
  }
  it('Detection +4 for secrets: a door 2 above the party is found with it and missed without it', () => {
    // A floor-2 seed whose secret door is in the entry room or next to it.
    let pick: { seed: number; host: string } | null = null
    for (let seed = 1; seed <= 300 && !pick; seed++) {
      const s = createDelve(content, options({ floor: 2, seed, light: 100 }), [hero('s', 'shade')])
      const g = s.floor.graph
      if (!g.secretId) continue
      const host = g.rooms.find((r) => r.doors.some((d) => d.to === g.secretId && d.secret))!
      if (host.id === g.entryId || graphRoom(s, g.entryId).doors.some((d) => d.to === host.id && !d.secret && !d.locked)) pick = { seed, host: host.id }
    }
    expect(pick).not.toBeNull()
    const det = partyDetection(content, t, createDelve(content, options({ floor: 2, seed: pick!.seed, light: 100 }), [hero('s', 'shade')]))
    const c = withSecretDifficulty(det + 2)
    const found = (party: HeroRecord[]) => {
      const s = createDelve(c, options({ floor: 2, seed: pick!.seed, light: 100 }), party)
      if (s.floor.currentRoomId !== pick!.host) {
        Object.assign(s.floor.rooms[pick!.host]!, { encounterId: null, cleared: true, traps: [] })
        stepDelve(c, s, { kind: 'move', toRoomId: pick!.host })
      }
      return s.floor.rooms[pick!.host]!.secretRevealed
    }
    expect(found([hero('s', 'shade')])).toBe(false)
    expect(found([hero('s', 'shade', ['shade-treasure-sense'])])).toBe(true)
  })
})

/* ---------- the fight joints ---------- */

const rat = () => buildMonsterActor(content, t, content.monsters.get('giant-rat')!, { id: 'foe', level: 1, row: 'front', hpPercent: 100 })

function fightOf(heroes: Actor[], over: Partial<FightState['options']> = {}): FightState {
  return createFight(content, t, { heroes, pets: [], monsters: [rat()], surprised: 'enemy', light: 100, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1, ...over }, rng: Rng.fromSeed(3) })
}

function actor(record: HeroRecord, i: number, aiRule?: string): Actor {
  const a = buildHeroActor(content, t, record, { id: `hero-${i}`, row: i === 0 ? 'back' : 'front', ...(aiRule ? { aiRule } : {}) })
  a.pool = a.poolMax = 200
  return a
}

describe('Tier IV: revives and once-per-fight skills in the fight loop', () => {
  const mender = () => actor(hero('m', 'mender', [], 1, ['mender-rebirth', 'mender-breath-of-life', 'mender-miracle']), 0, 'ELSE rebirth on lowest ally')
  const offer = (f: FightState, id: string) => legalFightActions(content, t, f, 'hero-0').find((a) => a.command.kind === 'skill' && a.label.startsWith(id))!

  it('a revive with no one to raise is not offered; a downed ally opens both; a fallen one only Rebirth, as its target', () => {
    const m = mender()
    const ally = actor(hero('w', 'warden'), 1)
    const f = fightOf([m, ally])
    expect(offer(f, 'Rebirth')).toMatchObject({ enabled: false, reason: 'no one to raise' })
    expect(offer(f, 'Breath of Life')).toMatchObject({ enabled: false, reason: 'no one to raise' })
    expect(offer(f, 'Miracle').enabled).toBe(true)
    ally.hp = 0
    ally.downed = true
    expect(offer(f, 'Rebirth')).toMatchObject({ enabled: true, targets: ['hero-1'] })
    expect(offer(f, 'Breath of Life')).toMatchObject({ enabled: true, targets: ['hero-1'] })
    ally.downed = false
    ally.fallen = true
    expect(offer(f, 'Rebirth')).toMatchObject({ enabled: true, targets: ['hero-1'] })
    expect(offer(f, 'Breath of Life')).toMatchObject({ enabled: false, reason: 'no one to raise' })
  })

  it('the hero AI casts Rebirth only when someone is down', () => {
    const m = mender()
    const ally = actor(hero('w', 'warden'), 1)
    const f = fightOf([m, ally])
    const ctx: EffectContext = { content, t, state: f, rng: new Rng(f.rng) }
    expect(decideHero(ctx, m).kind).toBe('basic')
    ally.hp = 0
    ally.downed = true
    const r = decideHero(ctx, m)
    expect(r.kind === 'skill' && r.skill.id).toBe('mender-rebirth')
  })

  it('Miracle and Quicksilver are not offered again once spent this fight', () => {
    const f = fightOf([mender(), actor(hero('w', 'warden'), 1)])
    f.flags['once:mender-miracle:hero-0'] = true
    expect(offer(f, 'Miracle')).toMatchObject({ enabled: false, reason: 'once per fight' })
    const blade = actor(hero('b', 'blade', [], 1, ['blade-quicksilver']), 0)
    const g = fightOf([blade], { autoHeroes: false })
    runFight(content, t, g)
    expect(g.pendingActorId).toBe('hero-0')
    applyFightCommand(content, t, g, { kind: 'skill', slot: 0, targetId: null })
    expect(g.log.some((e) => e.kind === 'quicksilver')).toBe(true)
    expect(g.pendingActorId).toBe('hero-0')
    expect(legalFightActions(content, t, g, 'hero-0').find((a) => a.label.startsWith('Quicksilver'))).toMatchObject({ enabled: false, reason: 'once per fight' })
  })
})

describe('fix: a damage-over-time tick asks the heroes’ beforeDowned hooks (Undying Rage, the Oath, Unbreakable)', () => {
  function poisoned(withLastStand: boolean): FightState {
    const h = actor(hero('w', 'warden'), 0)
    h.hp = 1
    h.statuses.push({ id: 'poison', stacks: 1, turnsLeft: 1, magnitude: 3, sourceId: 'foe', counter: 0 })
    if (withLastStand) installHook(h, { kind: 'custom', customId: 'survive-lethal-once-per-fight', amount: 1, percent: 0 }, h.id, { sourceSkillId: 'test' })
    const f = fightOf([h], { autoHeroes: true, enemyDamagePercent: 0 })
    runFight(content, t, f)
    return f
  }
  it('the lethal Poison tick leaves the hero at 1 HP with the Last Stand, and downs it without', () => {
    const saved = poisoned(true)
    const firstDot = saved.log.findIndex((e) => e.kind === 'dot' && e.actorId === 'hero-0')
    expect(firstDot).toBeGreaterThan(0)
    expect(saved.log[firstDot - 1]?.kind).toBe('lastStand')
    expect(saved.counters.heroDowns).toBe(0)
    const plain = poisoned(false)
    expect(plain.counters.heroDowns).toBe(1)
  })
})

describe('fix: a Graced heavy cast is not heavy, so it does not charge (Tier IV: Grace)', () => {
  function castSpike(graced: boolean): FightState {
    const a = actor(hero('a', 'arcanist', [], 1, ['arcanist-glacier-spike']), 0)
    if (graced) installHook(a, { kind: 'custom', customId: 'grace-next-action', amount: 1 }, 'mender', { sourceSkillId: 'mender-grace', counter: 1, data: { from: 0 } })
    const f = fightOf([a], { autoHeroes: false })
    runFight(content, t, f)
    expect(f.pendingActorId).toBe('hero-0')
    applyFightCommand(content, t, f, { kind: 'skill', slot: 0, targetId: 'foe' })
    return f
  }
  it('Graced, Glacier Spike resolves at once and costs nothing; ungraced, it charges', () => {
    const graced = castSpike(true)
    expect(graced.log.some((e) => e.kind === 'charge')).toBe(false)
    expect(graced.log.some((e) => e.kind === 'action' && e.text.includes('Glacier Spike'))).toBe(true)
    expect(graced.actors.find((x) => x.id === 'hero-0')!.pool).toBe(200)
    const plain = castSpike(false)
    expect(plain.log.some((e) => e.kind === 'charge' && e.actorId === 'hero-0')).toBe(true)
  })
})

