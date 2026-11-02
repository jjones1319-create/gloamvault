/**
 * The bridge (D-139, Phase 10): the one surface the Unity app calls. The sim runs inside the app's JavaScript engine
 * (Jint) as one bundle built from this file (tools/unity/bundle.ts → `GV`); every call takes and returns strings or
 * numbers, and a delve's state stays here behind an integer handle, so a step never copies the whole state across.
 *
 * Calls throw on bad input; the app turns a throw into a readable error (unity/…/Runtime/Sim/JintSim.cs). Fight
 * events and the town's calls join this file in the phases that need them (12 §3: Phases 19 and 23–24).
 */
import { buildContent, contentSummary, type Content, type RawContentFile } from './content.ts'
import { createDelve as createDelveState, delveSummary, hashDelve, legalDelveActions, stepDelve } from './delve.ts'
import type { DelveCommand, DelveOptions, DelveState } from './delve-types.ts'
import { createHero } from './hero.ts'
import type { PolicyName } from './policies.ts'
import { lightBand } from './light.ts'
import { Rng } from './rng.ts'
import type { HeroRecord } from './types/content.ts'
import type { Difficulty } from './types/enums.ts'

/** Raised when a call's arguments or the bridge's own rules change shape; the app checks it after loading. */
export const BRIDGE_VERSION = 1

/** One hero of a party by class (the species defaults to human, the name to "<Class> <n>"). */
export interface PartyMember {
  readonly classId: string
  readonly speciesId?: string
  readonly name?: string
}

/** What `createDelve` takes: a delve's options without the party records, and the party by class. */
export interface DelveRequest {
  readonly dungeonId: string
  readonly zone?: number
  readonly floor?: number
  /** Phase 17 (D-150): play this hand-laid floor (content/dungeons/<d>/floors/<id>.json). */
  readonly floorLayoutId?: string
  /** The last floor of the delve (Phase 17: a walked floor plays alone until the floors after it exist). */
  readonly lastFloor?: number
  readonly seed: number
  readonly difficulty?: Difficulty
  readonly pactIds?: readonly string[]
  readonly auto?: boolean
  readonly policy?: PolicyName
  readonly party: readonly PartyMember[]
}

/** What `step` returns: enough for a caller to know where the delve is without asking for more. */
export interface StepResult {
  readonly phase: DelveState['phase']['kind']
  readonly commands: number
  readonly over: boolean
}

/**
 * A party built the way `npm run sim` builds one: hero i from the seed + i, two free points each in Endurance,
 * Vitality and Strength, the first creation egg. Shared by the CLI and the bridge so both play the same heroes.
 */
export function createParty(content: Content, seed: number, spec: readonly PartyMember[]): HeroRecord[] {
  const egg = [...content.pets.values()].find((p) => p.creationChoice)
  return spec.map((m, i) => {
    const cls = content.classes.get(m.classId)
    if (!cls) throw new Error(`no class "${m.classId}" (have: ${[...content.classes.keys()].join(', ')})`)
    return createHero(content, content.tuning, Rng.fromSeed(seed + i), {
      id: `h${i + 1}`,
      name: m.name ?? `${cls.name} ${i + 1}`,
      speciesId: m.speciesId ?? 'human',
      classId: cls.id,
      freePoints: { endurance: 2, vitality: 2, strength: 2 },
      eggPetId: egg?.id ?? null,
    })
  })
}

let content: Content | null = null
const delves = new Map<number, DelveState>()
let nextHandle = 1

function loaded(): Content {
  if (!content) throw new Error('the bridge has no content: call init first')
  return content
}

function delveOf(handle: number): DelveState {
  const state = delves.get(handle)
  if (!state) throw new Error(`no delve with handle ${handle}`)
  return state
}

function parse<T>(json: string, what: string): T {
  try {
    return JSON.parse(json) as T
  } catch (e) {
    throw new Error(`${what}: invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Builds the content from the raw files (`tools/sim/loadContent.ts` `readContentFiles`, as one JSON array); forgets every delve. */
export function init(contentJson: string): string {
  const files = parse<RawContentFile[]>(contentJson, 'content')
  if (!Array.isArray(files)) throw new Error('content: expected an array of raw content files')
  content = buildContent(files)
  delves.clear()
  return JSON.stringify({ bridge: BRIDGE_VERSION, files: files.length, ...contentSummary(content) })
}

/** Starts a delve from a `DelveRequest`; returns its handle. */
export function createDelve(requestJson: string): number {
  const c = loaded()
  const r = parse<DelveRequest>(requestJson, 'delve request')
  if (!c.dungeons.has(r.dungeonId)) throw new Error(`no dungeon "${r.dungeonId}"`)
  if (!Array.isArray(r.party) || r.party.length === 0) throw new Error('a delve needs a party')
  const options: DelveOptions = {
    dungeonId: r.dungeonId,
    zone: r.floor === undefined ? (r.zone ?? 1) : undefined,
    floor: r.floor,
    ...(r.floorLayoutId ? { floorLayoutId: r.floorLayoutId } : {}),
    ...(r.lastFloor ? { lastFloor: r.lastFloor } : {}),
    seed: r.seed,
    difficulty: r.difficulty ?? 'normal',
    pactIds: r.pactIds ?? [],
    auto: r.auto ?? false,
    policy: r.policy ?? 'textbook',
  }
  const handle = nextHandle++
  delves.set(handle, createDelveState(c, options, createParty(c, r.seed, r.party)))
  return handle
}

/** Plays one command (`{"kind":"auto"}` lets the delve's scripted player choose). */
export function step(handle: number, commandJson: string): string {
  const state = delveOf(handle)
  stepDelve(loaded(), state, parse<DelveCommand>(commandJson, 'command'))
  const result: StepResult = { phase: state.phase.kind, commands: state.commandLog.length, over: state.phase.kind === 'over' }
  return JSON.stringify(result)
}

/** The commands open now, with their labels and why a closed one is closed. */
export function legal(handle: number): string {
  return JSON.stringify(legalDelveActions(loaded(), delveOf(handle)))
}

/** The desync hash (`hashDelve`): equal hashes, equal futures. */
export function hash(handle: number): string {
  return hashDelve(delveOf(handle))
}

export function summary(handle: number): string {
  return JSON.stringify(delveSummary(delveOf(handle)))
}

/**
 * What the walking client shows between steps (Phase 17): the phase, the light and its band, the floor clock, the
 * hunter, the room, the key, the walk clock, the party's health, the gold, the fights so far, the fight. Flat and
 * never null — Unity's JsonUtility reads it (an absent object would come back as an empty one, a null as a crash).
 */
export function snapshot(handle: number): string {
  const state = delveOf(handle)
  const c = loaded()
  const fl = state.floor
  const walk = fl.walk
  const ph = state.phase
  const enemies = state.fight ? state.fight.actors.filter((a) => a.side === 'enemy').map((a) => ({ id: a.id, name: a.name, level: a.level, hp: a.hp, maxHp: a.maxHp, alive: a.hp > 0 })) : []
  return JSON.stringify({
    phase: ph.kind,
    outcome: ph.kind === 'over' ? ph.outcome : '',
    summary: ph.kind === 'over' ? ph.summary : '',
    resultTitle: ph.kind === 'result' ? ph.title : '',
    resultLines: ph.kind === 'result' ? ph.lines : [],
    curioId: ph.kind === 'curio' ? ph.curioId : '',
    curioName: ph.kind === 'curio' ? (c.dungeons.get(state.options.dungeonId)?.curios.find((x) => x.id === ph.curioId)?.name ?? ph.curioId) : '',
    light: state.light,
    band: lightBand(c.tuning, state.light).id,
    clock: fl.clock,
    hunterEntered: fl.hunter?.entered ?? false,
    hunterRoomId: fl.hunter?.roomId ?? '',
    hunterKilled: fl.hunter?.killed ?? false,
    hunterName: fl.hunter ? (c.monsters.get(fl.hunter.monsterId)?.name ?? fl.hunter.monsterId) : '',
    roomId: fl.currentRoomId,
    hasKey: fl.hasKey,
    monsterLevel: fl.monsterLevel,
    walkSeconds: walk?.seconds ?? 0,
    walkBudget: Math.round(walk?.budget ?? 0),
    walkGrace: walk?.grace ?? 0,
    smokeKind: walk?.smoke?.kind ?? '',
    smokeSecondsLeft: walk?.smoke?.secondsLeft ?? 0,
    randomFights: walk?.randomFights ?? 0,
    gold: state.gold,
    fights: state.stats.fights,
    rooms: state.stats.rooms,
    heroes: state.heroes.map((h) => ({ name: h.record.name, classId: h.record.classId, level: h.record.level, hpPercent: h.hpPercent, poolPercent: h.poolPercent, fallen: h.fallen, downed: h.downed, battleXp: h.record.battleXp })),
    fightOver: state.fight?.over ?? false,
    fightRound: state.fight?.round ?? 0,
    enemies,
    log: state.log.length,
  })
}

/**
 * One room as the rules see it (Phase 17): what waits there — the monsters (the encounter and its first monster, for
 * the figure at the spot), the chests, the curio, the traps the party has spotted, the gold, the rest — so the walked
 * floor can place its things and the prompts. Flat and never null, for JsonUtility.
 */
export function room(handle: number, roomId: string): string {
  const state = delveOf(handle)
  const c = loaded()
  const rs = state.floor.rooms[roomId]
  const g = state.floor.graph.rooms.find((r) => r.id === roomId)
  if (!rs || !g) throw new Error(`no room "${roomId}"`)
  const dungeon = c.dungeons.get(state.options.dungeonId)
  const encounter = rs.encounterId ? c.encounters.get(rs.encounterId) : undefined
  const firstSlot = encounter?.composition[0]
  const curio = rs.curioId ? dungeon?.curios.find((x) => x.id === rs.curioId) : undefined
  // The disarm chance of each spotted trap, from the legal actions (the current room only; the first hero's hand).
  const chances = new Map<number, number>()
  if (roomId === state.floor.currentRoomId && state.phase.kind === 'room') {
    for (const a of legalDelveActions(c, state)) {
      if (a.command.kind !== 'disarm' || a.command.heroIndex !== 0) continue
      chances.set(a.command.trapIndex, Number(/(\d+)%\)\s*$/.exec(a.label)?.[1] ?? 0))
    }
  }
  return JSON.stringify({
    roomId,
    kind: g.kind,
    visited: rs.visited,
    cleared: rs.cleared,
    encounterId: rs.encounterId ?? '',
    encounterName: encounter?.name ?? '',
    monsterId: firstSlot?.monsterId ?? '',
    monsterName: firstSlot ? (c.monsters.get(firstSlot.monsterId)?.name ?? firstSlot.monsterId) : '',
    monsterCount: encounter ? encounter.composition.reduce((n, sl) => n + sl.count, 0) : 0,
    curioId: rs.curioId ?? '',
    curioName: curio?.name ?? '',
    curioUsed: rs.curioUsed,
    restUsed: rs.restUsed,
    keyHere: g.hasKey && !state.floor.hasKey,
    goldPiles: rs.goldPiles.length,
    chests: rs.chests.map((ch, index) => ({ index, size: ch.size, locked: ch.locked, opened: ch.opened })),
    traps: rs.traps.map((tr, index) => ({ index, trapId: tr.trapId, name: dungeon?.traps.find((x) => x.id === tr.trapId)?.name ?? tr.trapId, revealed: tr.revealed, disarmed: tr.disarmed, triggered: tr.triggered, chance: chances.get(index) ?? 0, blocks: tr.blocksDoorTo !== null, blocksTo: tr.blocksDoorTo ?? '' })),
  })
}

/** The commands open now (Phase 17), each with its command pre-serialised: the card's buttons send them back as they are. */
export function actions(handle: number): string {
  const items = legalDelveActions(loaded(), delveOf(handle)).map((a) => ({ kind: a.command.kind, label: a.label, enabled: a.enabled, reason: a.reason ?? '', command: JSON.stringify(a.command) }))
  return JSON.stringify({ items })
}

export function phase(handle: number): string {
  return JSON.stringify(delveOf(handle).phase)
}

/** The delve's log from entry `from` on. */
export function logSince(handle: number, from: number): string {
  return JSON.stringify(delveOf(handle).log.slice(from))
}

export function dispose(handle: number): void {
  delves.delete(handle)
}
