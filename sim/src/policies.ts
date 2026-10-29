import type { Content } from './content.ts'
import type { DelveCommand, DelveState, LegalDelveAction } from './delve-types.ts'
import type { Rng } from './rng.ts'
import { secretDoorKnown } from './secret-doors.ts'
import { delvePartyLevel, floorThreat, roomThreat, type ThreatRead } from './threat.ts'
import type { ThreatBand } from './types/enums.ts'

/**
 * Scripted players (03-GAME-DESIGN §3.6; 12 Phase 2 and Phase 7): the balance runner's and the AI fallback's door and
 * room choices. Heroes' turns inside a fight are their AI rules (sim/src/ai.ts); this is the delve layer.
 *   textbook: explores, rests when hurt, takes safe curio choices, descends once the floor is done.
 *   cautious: rests sooner, never gambles, retreats when a hero is down without revives.
 *   greedy:   opens everything, gambles every curio, never retreats.
 *   careful:  the textbook player who reads the threat (D-092; 12 Phase 7): it turns back from a floor that reads
 *             Deadly — at the stairs, from the next floor's chip and its boss's, or on arriving on one — and never walks
 *             into a room it knows reads Deadly. Its knobs are `tuning.json` → `runner.careful`; without the content
 *             it reads only the threat the move actions carry.
 *   random:   a random legal action.
 * Every player but random takes the shortest walk to where it is going and clears a revealed trap that shuts the
 * door on that walk (a disarm at any odds, else setting it off); with nowhere left to go and no way down it heads
 * home, and with no legal way home either it returns null — `runDelveAuto` then ends the delve as stuck instead of
 * pacing between two rooms until the command cap (the Phase 6 soak: Gravehollow F2, seed 101).
 */
export type PolicyName = 'textbook' | 'cautious' | 'greedy' | 'random' | 'careful'

export const POLICY_NAMES: readonly PolicyName[] = ['textbook', 'cautious', 'greedy', 'careful', 'random']

const BAND_ORDER: readonly ThreatBand[] = ['easy', 'even', 'dangerous', 'deadly']

/** True when `band` is `from` or worse. */
export function bandAtLeast(band: ThreatBand, from: ThreatBand): boolean {
  return BAND_ORDER.indexOf(band) >= BAND_ORDER.indexOf(from)
}

/** What the careful player reads before it moves (D-092). */
export interface CarefulRead {
  /** The floor it stands on reads at or past the turn-back band (its monsters, or its boss when the boss counts). */
  floorTooFar: boolean
  /** The floor the stairs lead to does (false on the delve's last floor). */
  nextFloorTooFar: boolean
  /** Rooms it knows read at or past the band: never entered. */
  avoid: ReadonlySet<string>
}

interface CarefulKnobs {
  turnBackFrom: ThreatBand
  bossCounts: boolean
}

function carefulKnobs(content: Content | undefined): CarefulKnobs {
  const k = (content?.tuning as { runner?: { careful?: { turnBackFrom?: string; bossCounts?: boolean } } } | undefined)?.runner?.careful
  const from = BAND_ORDER.includes(k?.turnBackFrom as ThreatBand) ? (k?.turnBackFrom as ThreatBand) : 'deadly'
  return { turnBackFrom: from, bossCounts: k?.bossCounts ?? true }
}

/** The careful player's read of the floor it is on, the next one and the rooms it knows (D-092's threat bands). */
export function carefulRead(state: DelveState, actions: readonly LegalDelveAction[], content?: Content): CarefulRead {
  const knobs = carefulKnobs(content)
  const tooFar = (r: ThreatRead | null | undefined): boolean => r !== null && r !== undefined && bandAtLeast(r.band, knobs.turnBackFrom)
  const avoid = new Set<string>()
  for (const a of actions) if (a.command.kind === 'move' && tooFar(a.threat)) avoid.add(a.command.toRoomId)
  if (!content) return { floorTooFar: false, nextFloorTooFar: false, avoid }
  const partyLevel = delvePartyLevel(state)
  const floorRead = (n: number): boolean => {
    const read = floorThreat(content, state.options.dungeonId, n, partyLevel)
    return read !== null && (tooFar(read.floor) || (knobs.bossCounts && tooFar(read.boss)))
  }
  for (const r of state.floor.graph.rooms) if (tooFar(roomThreat(content, state, r.id))) avoid.add(r.id)
  // The boss's band shows on the stairs' chip and the Waystone (D-092): a careful party never opens a Deadly boss's door.
  const here = floorThreat(content, state.options.dungeonId, state.floor.number, partyLevel)
  const exit = state.floor.rooms[state.floor.graph.exitId]
  if (knobs.bossCounts && here?.boss && tooFar(here.boss) && exit?.kind === 'boss' && !exit.cleared) avoid.add(exit.roomId)
  const last = state.options.lastFloor ?? state.floor.number
  return { floorTooFar: floorRead(state.floor.number), nextFloorTooFar: state.floor.number < last && floorRead(state.floor.number + 1), avoid }
}

export function choosePolicyCommand(policy: PolicyName, state: DelveState, actions: readonly LegalDelveAction[], rng: Rng, content?: Content): DelveCommand | null {
  // The delve's own Auto is never a choice (it would ask the policy again, forever).
  const enabled = actions.filter((a) => a.enabled && a.command.kind !== 'auto')
  if (enabled.length === 0) return null
  if (policy === 'random') return rng.pick(enabled).command
  // The careful player plays the textbook's hand and adds the threat read.
  const style: Exclude<PolicyName, 'random' | 'careful'> = policy === 'careful' ? 'textbook' : policy
  const find = (pred: (a: LegalDelveAction) => boolean) => enabled.find(pred)?.command ?? null
  const worst = Math.min(...state.heroes.filter((h) => !h.fallen).map((h) => h.hpPercent), 100)
  const anyFallen = state.heroes.some((h) => h.fallen)

  // Inside a fight: the hero's rule.
  const auto = find((a) => a.command.kind === 'fight' && a.command.command.kind === 'auto')
  if (auto) return auto
  const cont = find((a) => a.command.kind === 'continue')
  if (cont) return cont

  // Curio: the safe choice (textbook/cautious) or the gamble (greedy).
  const curioChoices = enabled.filter((a) => a.command.kind === 'curio')
  if (curioChoices.length) {
    const safe = curioChoices.find((a) => /safe|100%/i.test(a.label))
    const leave = curioChoices.find((a) => /leave|walk away/i.test(a.label))
    const gamble = curioChoices.find((a) => a !== leave)
    if (style === 'greedy') return (gamble ?? leave ?? curioChoices[0]!).command
    if (style === 'cautious') return (safe ?? leave ?? curioChoices[0]!).command
    // A hurt party does not gamble (07 §2.4: the gamble's bad outcome is usually an ambush).
    if (worst < 70) return (safe ?? leave ?? curioChoices[0]!).command
    return (safe ?? gamble ?? leave ?? curioChoices[0]!).command
  }

  // The Iron Oath (07 §6.2, rule flag no-retreat): no walking out, no teleporting out — the delve ends at its last floor
  // or in a wipe. There is no home to head for, and the careful player cannot act on its read, so it plays the textbook.
  const canLeave = !state.ruleFlags.includes('no-retreat')
  const careful = policy === 'careful' && canLeave ? carefulRead(state, actions, content) : null
  const avoid: ReadonlySet<string> = careful?.avoid ?? new Set<string>()
  const home = new Set([state.floor.graph.entryId, state.floor.graph.exitId].filter((id) => !avoid.has(id)))

  // D-089: a healer who can raise the dead does so before anything else (Mortal).
  const raise = find((a) => a.command.kind === 'raise')
  if (raise) return raise
  // D-088: under Mortal (and Nightmare, D-095) a death sends a careful party home with the body (the Shrine raises it, D-089).
  const mortalDeath = (state.options.deathRule === 'mortal' || state.options.deathRule === 'nightmare') && anyFallen
  const restAt = style === 'cautious' ? 75 : style === 'greedy' ? 40 : 60
  if (worst < restAt || anyFallen) {
    const rest = find((a) => a.command.kind === 'rest')
    if (rest) return rest
    const aid = find((a) => a.command.kind === 'firstAid')
    if (aid) return aid
  }
  // A potion heals the hero who drinks it (stepDelve 'useItem'): the most hurt hero who carries one drinks their own.
  const potion = potionFor(state, enabled, style === 'greedy' ? 30 : style === 'cautious' ? 50 : 45)
  if (potion) return potion
  // Spent (hurt, no rest here, no potion): cautious and textbook head home — out of the entrance or the floor's end,
  // whichever is nearer (D-083: only those two ways out). The careful player also leaves a floor that reads too far.
  const spent = worst < (style === 'cautious' ? 35 : 25) && !potionFor(state, enabled, worst + 1) && !find((a) => a.command.kind === 'rest')
  // On the delve's last floor the way down finishes the delve: the same trip home as teleporting out, and it counts.
  const finish = state.floor.number >= (state.options.lastFloor ?? Infinity) ? find((a) => a.command.kind === 'descend') : null
  if (style !== 'greedy' && (spent || mortalDeath || careful?.floorTooFar || (style === 'cautious' && anyFallen && state.floor.revivesLeft === 0))) {
    if (finish) return finish
    if (canLeave) {
      const retreat = find((a) => a.command.kind === 'retreat')
      if (retreat) return retreat
      const way = routeToward(state, enabled, home, avoid)
      if (way) return way
    }
  }
  const torch = find((a) => a.command.kind === 'useItem' && /torch/i.test(a.label))
  if (torch && state.light < (style === 'greedy' ? 15 : 40)) return torch

  const gold = find((a) => a.command.kind === 'takeGold')
  if (gold) return gold
  // Disarm with the party's best hand, and only at fair odds (a fumble springs the trap: 07 §2.5); a trap blocking a
  // door the party does not need is simply left alone (one on its way is cleared by `routeToward`).
  const bestDisarm = bestDisarmOf(enabled, null)
  const fairOdds = style === 'greedy' ? 0 : style === 'cautious' ? 75 : 55
  if (bestDisarm && bestDisarm.chance >= fairOdds) return bestDisarm.a.command
  const around = find((a) => a.command.kind === 'walkAround')
  const chestKey = find((a) => a.command.kind === 'openChest' && a.command.useKey)
  const chest = find((a) => a.command.kind === 'openChest' && !a.command.useKey)
  if (style === 'greedy' || style === 'textbook') {
    if (chestKey) return chestKey
    if (chest && !/trapped/i.test(actions.find((a) => a.command === chest)?.label ?? '')) return chest
    if (chest && style === 'greedy') return chest
  }
  const buyTorch = find((a) => a.command.kind === 'buy' && /torch/i.test(a.label))
  if (buyTorch && state.light < 50) return buyTorch

  // Doors: unexplored first (fights before the stairs for textbook/greedy), the stairs when the floor is done.
  const moves = enabled.filter((a) => a.command.kind === 'move' && !avoid.has(a.command.toRoomId))
  const unexplored = moves.filter((a) => a.command.kind === 'move' && !state.floor.rooms[a.command.toRoomId]?.visited)
  const descend = find((a) => a.command.kind === 'descend')
  // The careful player reads the next floor's chip at the stairs and teleports out rather than go down into it.
  const down = (): DelveCommand | null => (descend && careful?.nextFloorTooFar ? (find((a) => a.command.kind === 'retreat') ?? null) : descend)
  // A hurt party takes the stairs it has found rather than clearing every room (the floor's rest is behind it).
  if (descend && style !== 'greedy' && worst < (style === 'cautious' ? 60 : 50)) {
    const go = down()
    if (go) return go
  }
  if (unexplored.length) {
    // Prefer rooms on the spine toward the exit for cautious; treasure/curio first for greedy.
    const pick = style === 'greedy' ? (unexplored.find((a) => /treasure|curio|secret/i.test(a.label)) ?? unexplored[0]!) : unexplored[0]!
    return pick.command
  }
  // Everything next door is known: walk toward the nearest unexplored room, else toward the exit.
  const unvisited = new Set(state.floor.graph.rooms.filter((r) => !state.floor.rooms[r.id]?.visited && !avoid.has(r.id)).map((r) => r.id))
  const toward = routeToward(state, enabled, unvisited, avoid) ?? (descend ? null : routeToward(state, enabled, new Set([state.floor.graph.exitId].filter((id) => !avoid.has(id))), avoid))
  if (toward) return toward
  if (descend) {
    const go = down()
    if (go) return go
  }
  // Nothing left to see and no way down from here: head home (walk out at the entrance, teleport at the floor's end).
  const retreat = find((a) => a.command.kind === 'retreat')
  if (retreat) return retreat
  const back = canLeave ? routeToward(state, enabled, home, avoid) : null
  if (back) return back
  // Boxed in by a trap: try the best disarm, else set it off.
  if (bestDisarm && bestDisarm.chance >= 40) return bestDisarm.a.command
  if (around) return around
  if (bestDisarm) return bestDisarm.a.command
  // No legal way on: the caller ends the delve (runDelveAuto) rather than wander.
  return null
}

/** The most hurt living hero below `below` percent HP who carries a healing potion: their own potion, or null. */
function potionFor(state: DelveState, enabled: readonly LegalDelveAction[], below: number): DelveCommand | null {
  let best: { command: DelveCommand; hp: number } | null = null
  for (const a of enabled) {
    if (a.command.kind !== 'useItem' || !/potion/i.test(a.label)) continue
    const h = state.heroes[a.command.heroIndex]
    if (!h || h.fallen || h.hpPercent >= below) continue
    if (best === null || h.hpPercent < best.hp) best = { command: a.command, hp: h.hpPercent }
  }
  return best?.command ?? null
}

/** The disarm chance a label shows: "Disarm Rat Cage Drop (Warden, 43%)". */
function disarmChanceOf(label: string): number {
  return Number(/(\d+)%\)\s*$/.exec(label)?.[1] ?? 0)
}

/** The best hand on a trap (`trapIndex`), or on any trap in the room when null. */
function bestDisarmOf(enabled: readonly LegalDelveAction[], trapIndex: number | null): { a: LegalDelveAction; chance: number } | null {
  let best: { a: LegalDelveAction; chance: number } | null = null
  for (const a of enabled) {
    if (a.command.kind !== 'disarm' || (trapIndex !== null && a.command.trapIndex !== trapIndex)) continue
    const chance = disarmChanceOf(a.label)
    if (best === null || chance > best.chance) best = { a, chance }
  }
  return best
}

/**
 * The first room on the shortest walk from here to any of `targets`, over doors the party can open (a locked door with
 * the key, a secret door it has found), never through a room in `avoid`, and never through a door of this room listed in
 * `closed`. Traps in rooms further on are dealt with when the party gets there.
 */
export function firstStepToward(state: DelveState, targets: ReadonlySet<string>, avoid: ReadonlySet<string> = new Set(), closed: ReadonlySet<string> = new Set()): string | null {
  if (targets.size === 0) return null
  const graph = state.floor.graph
  const start = state.floor.currentRoomId
  const prev = new Map<string, string | null>([[start, null]])
  const queue = [start]
  let found: string | null = null
  while (queue.length && found === null) {
    const id = queue.shift() as string
    const room = graph.rooms.find((r) => r.id === id)
    for (const d of room?.doors ?? []) {
      if (prev.has(d.to) || avoid.has(d.to)) continue
      if (id === start && closed.has(d.to)) continue
      if (d.locked && !state.floor.hasKey) continue
      if (d.secret && !secretDoorKnown(state, id, d.to)) continue
      prev.set(d.to, id)
      if (targets.has(d.to)) {
        found = d.to
        break
      }
      queue.push(d.to)
    }
  }
  if (found === null) return null
  let step = found
  while (prev.get(step) !== start && prev.get(step) !== null) step = prev.get(step) as string
  return step
}

/**
 * The command that starts the shortest walk to any of `targets`: the move through the first door, or — when a revealed
 * trap in this room shuts that door — the best disarm of it (a fumble fires it at half strength, which still beats
 * setting it off at full, 07 §2.5), else setting it off. A door shut for any other reason (an unrevealed trap on it)
 * is skipped for the next shortest walk.
 */
export function routeToward(state: DelveState, enabled: readonly LegalDelveAction[], targets: ReadonlySet<string>, avoid: ReadonlySet<string> = new Set()): DelveCommand | null {
  const room = state.floor.rooms[state.floor.currentRoomId]
  const closed = new Set<string>()
  const doors = state.floor.graph.rooms.find((r) => r.id === state.floor.currentRoomId)?.doors.length ?? 0
  for (let tries = 0; tries <= doors; tries++) {
    const step = firstStepToward(state, targets, avoid, closed)
    if (step === null) return null
    const move = enabled.find((a) => a.command.kind === 'move' && a.command.toRoomId === step)
    if (move) return move.command
    const trapIndex = room?.traps.findIndex((tr) => tr.blocksDoorTo === step && tr.revealed && !tr.disarmed && !tr.triggered) ?? -1
    if (trapIndex >= 0) {
      const clear = bestDisarmOf(enabled, trapIndex)?.a ?? enabled.find((a) => a.command.kind === 'walkAround' && a.command.trapIndex === trapIndex)
      if (clear) return clear.command
    }
    closed.add(step)
  }
  return null
}
