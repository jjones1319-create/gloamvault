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
