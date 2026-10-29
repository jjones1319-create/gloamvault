/**
 * The balance runner's window on one delve (12 Phase 7; 07 §8.2): plays it with the scripted player through the sim's
 * own `runDelveAuto` and returns a row for the delve, one per floor it stood on and one per fight — read from the sim's
 * state, never re-derived.
 *
 * How it sees inside: a fight is created and finished within one delve step on auto, so the delve state is wrapped in a
 * Proxy whose `set` trap notes three assignments the sim makes anyway — `state.fight` (a fight starts; null when it is
 * over, its actors' tallies and log complete), `state.fightContext` (its room and kind) and `state.floor` (a new floor
 * begins: the old one is complete). The trap only reads; the delve plays exactly as it would unwrapped (a test checks
 * the hash). Arena tallies come from `stats.bossArenas` (arena.ts writes one row per boss fight).
 */
import type { Content } from '../../sim/src/content.ts'
import { createDelve, runDelveAuto } from '../../sim/src/delve.ts'
import type { BossArenaRecord, DelveOptions, DelveState, DelveStats, FloorRun } from '../../sim/src/delve-types.ts'
import { hopsFrom } from '../../sim/src/explore.ts'
import type { FightState } from '../../sim/src/fight-types.ts'
import { repairAllCost } from '../../sim/src/items.ts'
import { lightBand } from '../../sim/src/light.ts'
import { delvePartyLevel, floorThreat } from '../../sim/src/threat.ts'
import type { HeroRecord, ItemInstance } from '../../sim/src/types/content.ts'
import type { ThreatBand } from '../../sim/src/types/enums.ts'

export type DelveOutcome = 'cleared' | 'retreated' | 'wiped' | 'capped' | 'chosenDied' | 'stuck' | 'running'

/** One hero's part in one fight (the actor's tally). */
export interface HeroFightLine {
  index: number
  classId: string
  level: number
  actions: number
  damageDealt: number
  damageTaken: number
  healingDone: number
  kills: number
  maxHp: number
  /** Down or fallen when the fight ended. */
  fell: boolean
  /** Past the revive window when the fight ended: under Mortal, dead (D-088). */
  fallen: boolean
  /** Damage taken from status ticks (Poison, Bleed, Burn …: the log's 'dot' events on the hero). */
  dotTaken: number
}

export interface FightRow {
  floor: number
  kind: string
  roomId: string
  outcome: string
  rounds: number
  /** The boss's monster id on a boss fight. */
  boss: string | null
  heroes: HeroFightLine[]
  /** Damage the party's pets dealt (they are not a class). */
  petDamage: number
  /** The fight's monsters, the adds that joined included (summoned ones aside). */
  monsters: string[]
  /** Each enemy's part: its monster id, its row at the end, damage dealt and taken (a barricade's back row reads here). */
  enemies: { id: string; boss: boolean; row: string; damageDealt: number; damageTaken: number }[]
  /** Gold the fight brought (its loot and lifted gold): the delve's goldFound across the fight. */
  gold: number
}

export interface FloorRow {
  floor: number
  zoneId: string
  /** The party's level when the floor began (the living heroes' average, rounded down) and how the floor's chip read. */
  partyLevel: number
  band: ThreatBand
  bossBand: ThreatBand | null
  roomsGenerated: number
  roomsVisited: number
  /** Shortest hop count from the entry to the way down (the straight-line walk). */
  straightHops: number
  keyLock: boolean
  fights: number
  elites: number
  bosses: number
  rounds: Record<string, number[]>
  ambushedParty: number
  ambushedMonsters: number
  hunterArrived: boolean
  /** Rooms visited on this floor when the hunter came in (null when it did not). */
  hunterRoom: number | null
  goldFound: number
  goldLost: number
  /** Of goldFound, what the floor's boss fight brought (08 §11's boss purse and its loot). */
  bossGold: number
  /** Damage each hero who started the floor took, as % of their max HP, summed over the floor's fights. */
  damageTakenPct: number[]
  downs: number
  falls: number
  wipes: number
  torches: number
  /** The light at the way down, and its band (null when the party never got there). */
  lightAtStairs: number | null
  lightBandAtStairs: string | null
  ticksToStairs: number | null
  traps: [revealed: number, triggered: number, disarmed: number]
  curios: number
  curioOutcomes: string[]
  chests: number
  itemsByGrade: Record<string, number>
  insights: number
  /** How the party left the floor: down the stairs (or past its boss), or the delve's end here. */
  end: 'down' | DelveOutcome
}

export interface DelveRow {
  outcome: DelveOutcome
  summary: string
  startFloor: number
  lastFloor: number
  floorReached: number
  deepestCompleted: number
  partyLevelStart: number
  partyLevelEnd: number
  levelsGained: number
  /** Heroes still fallen when a fight ended (under Mortal each one died, D-088). */
  falls: number
  raises: number
  /** Mortal and Nightmare: heroes carried home dead (to the Shrine) and heroes lost for good in a wipe. */
  carriedHome: number
  lostForGood: number
  /** Nightmare (D-095): the chosen hero (the party's first) died, so the save would end. */
  ended: boolean
  rooms: number
  fights: number
  rounds: Record<string, number[]>
  gold: number
  goldFound: number
  repairGold: number
  wearPct: Record<string, number>
  /** The most-worn main hand in the party, % of durability lost (08 §9.4 judges a fully used weapon, not a caster's focus). */
  mainHandWearMax: number
  downs: number
  wipes: number
  ambushedParty: number
  ambushedMonsters: number
  hunter: number
  insights: number
  traps: [number, number, number]
  curios: number
  hookStubs: Record<string, number>
  chests: number
  torches: number
  light: number[]
  ticks: number[]
  commands: number
  bossArenas: BossArenaRecord[]
}

export interface PlayedDelve {
  delve: DelveRow
  floors: FloorRow[]
  fights: FightRow[]
  /** The sim's own end state (for hashes and tests). */
  state: DelveState
}

type Snapshot = Omit<DelveStats, 'roundsByKind' | 'ticksToStairs' | 'lightAtStairs' | 'hookStubs' | 'bossArenas'> & {
  rounds: Record<string, number>
  ticks: number
  light: number
  pile: number
  log: number
  fightsSeen: number
}

const NUMERIC_STATS = ['rooms', 'fights', 'eliteFights', 'bossFights', 'ambushedParty', 'ambushedMonsters', 'trapsRevealed', 'trapsTriggered', 'trapsDisarmed', 'curiosUsed', 'chestsOpened', 'torchesUsed', 'hunterArrived', 'hunterKilled', 'downs', 'wipes', 'goldFound', 'goldLost', 'itemsFound', 'partsFound', 'insights', 'secretsFound', 'fled', 'xpEvents', 'deepestFloorCompleted', 'falls', 'raises'] as const

function zeroSnapshot(): Snapshot {
  const s = { rounds: {}, ticks: 0, light: 0, pile: 0, log: 0, fightsSeen: 0 } as unknown as Snapshot
  for (const k of NUMERIC_STATS) (s as Record<string, unknown>)[k] = 0
  return s
}

function snapshot(state: DelveState, fightsSeen: number): Snapshot {
  const s = zeroSnapshot()
  for (const k of NUMERIC_STATS) (s as Record<string, unknown>)[k] = state.stats[k]
  s.rounds = Object.fromEntries(Object.entries(state.stats.roundsByKind).map(([k, v]) => [k, v.length]))
  s.ticks = state.stats.ticksToStairs.length
  s.light = state.stats.lightAtStairs.length
  s.pile = state.pile.length
  s.log = state.log.length
  s.fightsSeen = fightsSeen
  return s
}

function equippedAll(h: HeroRecord): ItemInstance[] {
  const e = h.equipment
  return [e.mainHand, e.offHand, e.helmet, e.chest, e.legs, e.boots, e.gloves, e.ring[0], e.ring[1], e.talisman, e.relic].filter((x): x is ItemInstance => x !== null)
}

function fightRow(state: DelveState, fight: FightState, ctx: { floor: number; kind: string; roomId: string; goldAtStart: number }): FightRow {
  const heroes: HeroFightLine[] = []
  let petDamage = 0
  for (const a of fight.actors) {
    if (a.side !== 'party') continue
    if (a.kind === 'hero') {
      const index = Number(a.id.replace(/^hero-/, ''))
      const dotTaken = fight.log.reduce((sum, e) => (e.kind === 'dot' && e.actorId === a.id ? sum + (e.amount ?? 0) : sum), 0)
      heroes.push({ index, classId: state.heroes[index]?.record.classId ?? '?', level: a.level, actions: a.tally.actions, damageDealt: a.tally.damageDealt, damageTaken: a.tally.damageTaken, healingDone: a.tally.healingDone, kills: a.tally.kills, maxHp: a.maxHp, fell: a.fallen || a.downed, fallen: a.fallen, dotTaken })
    } else petDamage += a.tally.damageDealt
  }
  const bossActor = fight.actors.find((a) => a.side !== 'party' && a.monster?.isBoss)
  const monsters = fight.actors.filter((a) => a.side !== 'party' && a.monster && !a.monster.summonedBy).map((a) => a.monster!.monsterId)
  const enemies = fight.actors.filter((a) => a.side !== 'party' && a.monster).map((a) => ({ id: a.monster!.monsterId, boss: a.monster!.isBoss, row: a.row, damageDealt: a.tally.damageDealt, damageTaken: a.tally.damageTaken }))
  return { floor: ctx.floor, kind: ctx.kind, roomId: ctx.roomId, outcome: fight.over?.outcome ?? 'running', rounds: fight.round, boss: bossActor?.monster?.monsterId ?? null, heroes, petDamage, monsters, enemies, gold: state.stats.goldFound - ctx.goldAtStart }
}

function outcomeOf(state: DelveState): DelveOutcome {
  if (state.phase.kind !== 'over') return 'running'
  if (state.phase.outcome === 'capped' && /^Stuck/.test(state.phase.summary)) return 'stuck'
  return state.phase.outcome
}

/**
 * Plays one delve on the scripted player (`options.policy`) to its end or `cap` commands and returns what the runner
 * reports. Pure apart from the sim's own state: the same options and party give the same rows.
 */
export function playDelve(content: Content, options: DelveOptions, party: readonly HeroRecord[], cap: number): PlayedDelve {
  const t = content.tuning
  const raw = createDelve(content, options, party)
  const fights: FightRow[] = []
  const floors: FloorRow[] = []
  const aliveNow = (s: DelveState) => s.heroes.map((h) => !h.fallen)
  let floorStart = { snap: zeroSnapshot(), partyLevel: delvePartyLevel(raw), alive: aliveNow(raw), hunterRoom: null as number | null, hunterSeen: 0 }
  let current: { fight: FightState; floor: number; kind: string; roomId: string; goldAtStart: number } | null = null

  const closeFloor = (s: DelveState, floor: FloorRun, end: FloorRow['end']): void => {
    const a = floorStart.snap
    const b = snapshot(s, fights.length)
    const d = (k: (typeof NUMERIC_STATS)[number]) => (s.stats[k] as number) - (a[k] as number)
    const rounds: Record<string, number[]> = {}
    for (const [k, v] of Object.entries(s.stats.roundsByKind)) {
      const slice = v.slice(a.rounds[k] ?? 0)
      if (slice.length) rounds[k] = slice
    }
    const dungeon = content.dungeons.get(options.dungeonId)
    const fd = dungeon?.floors.find((f) => f.floor === floor.number)
    const read = floorThreat(content, options.dungeonId, floor.number, floorStart.partyLevel)
    const light = s.stats.lightAtStairs.slice(a.light)[0] ?? null
    const items: Record<string, number> = {}
    for (const inst of s.pile.slice(a.pile)) {
      const g = content.items.get(inst.itemId)?.grade ?? '?'
      items[g] = (items[g] ?? 0) + 1
    }
    const curioOutcomes = s.log
      .slice(a.log)
      .filter((e) => e.kind === 'curio' && e.floor === floor.number && e.data && 'outcome' in e.data)
      .map((e) => `${String(e.data?.curio ?? '?')}:${String(e.data?.outcome ?? '?')}`)
    // Damage taken per hero who started the floor, as % of max HP, over the floor's fights.
    const taken = floorStart.alive.map(() => 0)
    for (const f of fights.slice(a.fightsSeen)) {
      for (const h of f.heroes) if (taken[h.index] !== undefined && h.maxHp > 0) taken[h.index]! += (100 * h.damageTaken) / h.maxHp
    }
    const damageTakenPct = taken.filter((_, i) => floorStart.alive[i])
    const hops = hopsFrom(floor.graph, floor.graph.entryId).get(floor.graph.exitId)?.hops ?? 0
    floors.push({
      floor: floor.number,
      zoneId: fd?.zoneId ?? '?',
      partyLevel: floorStart.partyLevel,
      band: read?.floor.band ?? 'even',
      bossBand: read?.boss?.band ?? null,
      roomsGenerated: floor.graph.rooms.length,
      roomsVisited: d('rooms'),
      straightHops: hops,
      keyLock: floor.graph.rooms.some((r) => r.doors.some((x) => x.locked)),
      fights: d('fights'),
      elites: d('eliteFights'),
      bosses: d('bossFights'),
      rounds,
      ambushedParty: d('ambushedParty'),
      ambushedMonsters: d('ambushedMonsters'),
      hunterArrived: d('hunterArrived') > 0,
      hunterRoom: floorStart.hunterRoom,
      goldFound: d('goldFound'),
      goldLost: d('goldLost'),
      bossGold: fights.slice(a.fightsSeen).filter((f) => f.boss !== null).reduce((sum, f) => sum + f.gold, 0),
      damageTakenPct,
      downs: d('downs'),
      falls: d('falls'),
      wipes: d('wipes'),
      torches: d('torchesUsed'),
      lightAtStairs: light,
      lightBandAtStairs: light === null ? null : lightBand(t, light).id,
      ticksToStairs: s.stats.ticksToStairs.slice(a.ticks)[0] ?? null,
      traps: [d('trapsRevealed'), d('trapsTriggered'), d('trapsDisarmed')],
      curios: d('curiosUsed'),
      curioOutcomes,
      chests: d('chestsOpened'),
      itemsByGrade: items,
      insights: d('insights'),
      end,
    })
    floorStart = { snap: b, partyLevel: delvePartyLevel(s), alive: aliveNow(s), hunterRoom: null, hunterSeen: s.stats.hunterArrived }
  }

  const tracked = new Proxy(raw, {
    set(target, prop, value) {
      if (prop === 'floor' && value !== target.floor && target.floor) {
        // beginFloor swaps in the next floor: the one the party leaves is complete.
        closeFloor(target, target.floor, 'down')
      } else if (prop === 'fight') {
        if (value === null && current) fights.push(fightRow(target, current.fight, current))
        current = value ? { fight: value as FightState, floor: target.floor.number, kind: 'fight', roomId: target.floor.currentRoomId, goldAtStart: target.stats.goldFound } : null
      } else if (prop === 'fightContext' && value && current) {
        const ctx = value as NonNullable<DelveState['fightContext']>
        current.kind = ctx.kind
        current.roomId = ctx.roomId
      }
      return Reflect.set(target, prop, value)
    },
  })
  // The floor's party level is read after the new floor's assignment (beginFloor sets it before the entry room).
  const observe = (s: DelveState): void => {
    if (s.stats.hunterArrived > floorStart.hunterSeen && floorStart.hunterRoom === null) floorStart.hunterRoom = s.stats.rooms - floorStart.snap.rooms
  }
  const state = runDelveAuto(content, tracked, cap, observe)
  const outcome = outcomeOf(state)
  closeFloor(raw, raw.floor, outcome === 'cleared' ? 'down' : outcome)

  const s = state.stats
  const repairGold = state.heroes.reduce((sum, h) => sum + repairAllCost(content, t, equippedAll(h.record)).gold, 0)
  const wearPct: Record<string, number> = {}
  for (const h of state.heroes) {
    const e = h.record.equipment
    for (const [slot, inst] of Object.entries({ mainHand: e.mainHand, offHand: e.offHand, chest: e.chest, helmet: e.helmet, legs: e.legs }) as [string, ItemInstance | null][]) {
      if (inst) wearPct[slot] = (wearPct[slot] ?? 0) + (100 - inst.durability) / state.heroes.length
    }
  }
  const mainHandWearMax = Math.max(0, ...state.heroes.map((h) => (h.record.equipment.mainHand ? 100 - h.record.equipment.mainHand.durability : 0)))
  const deadAtEnd = state.heroes.filter((h) => h.fallen).length
  const mortal = options.deathRule === 'mortal' || options.deathRule === 'nightmare'
  const leader = state.heroes.find((h) => h.record.id === options.leaderId)
  const levelsStart = party.map((h) => h.level)
  const delve: DelveRow = {
    outcome,
    summary: state.phase.kind === 'over' ? state.phase.summary : '',
    startFloor: floors[0]?.floor ?? state.floor.number,
    lastFloor: state.options.lastFloor ?? state.floor.number,
    floorReached: state.floor.number,
    deepestCompleted: s.deepestFloorCompleted,
    partyLevelStart: Math.floor(levelsStart.reduce((a, b) => a + b, 0) / Math.max(1, levelsStart.length)),
    partyLevelEnd: Math.floor(state.heroes.reduce((a, h) => a + h.record.level, 0) / Math.max(1, state.heroes.length)),
    levelsGained: state.heroes.reduce((a, h) => a + h.growth.levelsGained, 0),
    falls: s.falls,
    raises: s.raises,
    carriedHome: mortal && outcome !== 'wiped' ? deadAtEnd : 0,
    lostForGood: mortal && outcome === 'wiped' ? state.heroes.length : 0,
    ended: options.deathRule === 'nightmare' && leader !== undefined && leader.fallen,
    rooms: s.rooms,
    fights: s.fights,
    rounds: s.roundsByKind,
    gold: state.gold,
    goldFound: s.goldFound,
    repairGold,
    wearPct,
    mainHandWearMax,
    downs: s.downs,
    wipes: s.wipes,
    ambushedParty: s.ambushedParty,
    ambushedMonsters: s.ambushedMonsters,
    hunter: s.hunterArrived,
    insights: s.insights,
    traps: [s.trapsRevealed, s.trapsTriggered, s.trapsDisarmed],
    curios: s.curiosUsed,
    hookStubs: s.hookStubs,
    chests: s.chestsOpened,
    torches: s.torchesUsed,
    light: s.lightAtStairs,
    ticks: s.ticksToStairs,
    commands: state.commandLog.length,
    bossArenas: s.bossArenas ?? [],
  }
  return { delve, floors, fights, state: raw }
}
