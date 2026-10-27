import type { DelveCommand, DelveState, LegalDelveAction } from './delve-types.ts'
import type { Rng } from './rng.ts'

/**
 * Scripted players (03-GAME-DESIGN §3.6; 12 Phase 2): the balance runner's and the AI fallback's door and room
 * choices. Heroes' turns inside a fight are their AI rules (sim/src/ai.ts); this is the delve layer.
 *   textbook: explores, rests when hurt, takes safe curio choices, descends once the floor is done.
 *   cautious: rests sooner, never gambles, retreats when a hero is down without revives.
 *   greedy:   opens everything, gambles every curio, never retreats.
 *   random:   a random legal action.
 */
export type PolicyName = 'textbook' | 'cautious' | 'greedy' | 'random'

export function choosePolicyCommand(policy: PolicyName, state: DelveState, actions: readonly LegalDelveAction[], rng: Rng): DelveCommand | null {
  const enabled = actions.filter((a) => a.enabled)
  if (enabled.length === 0) return null
  if (policy === 'random') return rng.pick(enabled).command
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
    if (policy === 'greedy') return (gamble ?? leave ?? curioChoices[0]!).command
    if (policy === 'cautious') return (safe ?? leave ?? curioChoices[0]!).command
    // A hurt party does not gamble (07 §2.4: the gamble's bad outcome is usually an ambush).
    if (worst < 70) return (safe ?? leave ?? curioChoices[0]!).command
    return (safe ?? gamble ?? leave ?? curioChoices[0]!).command
  }

  const restAt = policy === 'cautious' ? 75 : policy === 'greedy' ? 40 : 60
  if (worst < restAt || anyFallen) {
    const rest = find((a) => a.command.kind === 'rest')
    if (rest) return rest
    const aid = find((a) => a.command.kind === 'firstAid')
    if (aid) return aid
  }
  const potion = find((a) => a.command.kind === 'useItem' && /potion/i.test(a.label))
  if (potion && worst < (policy === 'greedy' ? 30 : policy === 'cautious' ? 50 : 45)) return potion
  // Spent (hurt, no rest here, no potion): cautious and textbook head home — out of the entrance or the floor's end,
  // whichever is nearer (D-083: only those two ways out).
  const spent = worst < (policy === 'cautious' ? 35 : 25) && !potion && !find((a) => a.command.kind === 'rest')
  if (policy !== 'greedy' && (spent || (policy === 'cautious' && anyFallen && state.floor.revivesLeft === 0))) {
    const retreat = find((a) => a.command.kind === 'retreat')
    if (retreat) return retreat
    const moves0 = enabled.filter((a) => a.command.kind === 'move')
    const way = doorToward(state, moves0, new Set([state.floor.graph.entryId, state.floor.graph.exitId]))
    if (way) return way
  }
  const torch = find((a) => a.command.kind === 'useItem' && /torch/i.test(a.label))
  if (torch && state.light < (policy === 'greedy' ? 15 : 40)) return torch

  const gold = find((a) => a.command.kind === 'takeGold')
  if (gold) return gold
  // Disarm with the party's best hand, and only at fair odds (a fumble springs the trap: 07 §2.5); a trap blocking a
  // door the party does not need is simply left alone.
  const disarms = enabled.filter((a) => a.command.kind === 'disarm').map((a) => ({ a, chance: Number(/\((?:[^,]*), (\d+)%\)/.exec(a.label)?.[1] ?? 0) }))
  const bestDisarm = disarms.reduce<{ a: LegalDelveAction; chance: number } | null>((b, d) => (b === null || d.chance > b.chance ? d : b), null)
  const fairOdds = policy === 'greedy' ? 0 : policy === 'cautious' ? 75 : 55
  if (bestDisarm && bestDisarm.chance >= fairOdds) return bestDisarm.a.command
  const around = find((a) => a.command.kind === 'walkAround')
  const chestKey = find((a) => a.command.kind === 'openChest' && a.command.useKey)
  const chest = find((a) => a.command.kind === 'openChest' && !a.command.useKey)
  if (policy === 'greedy' || policy === 'textbook') {
    if (chestKey) return chestKey
    if (chest && !/trapped/i.test(actions.find((a) => a.command === chest)?.label ?? '')) return chest
    if (chest && policy === 'greedy') return chest
  }
  const buyTorch = find((a) => a.command.kind === 'buy' && /torch/i.test(a.label))
  if (buyTorch && state.light < 50) return buyTorch

  // Doors: unexplored first (fights before the stairs for textbook/greedy), the stairs when the floor is done.
  const moves = enabled.filter((a) => a.command.kind === 'move')
  const unexplored = moves.filter((a) => a.command.kind === 'move' && !state.floor.rooms[a.command.toRoomId]?.visited)
  const descend = find((a) => a.command.kind === 'descend')
  // A hurt party takes the stairs it has found rather than clearing every room (the floor's rest is behind it).
  if (descend && policy !== 'greedy' && worst < (policy === 'cautious' ? 60 : 50)) return descend
  if (unexplored.length) {
    // Prefer rooms on the spine toward the exit for cautious; treasure/curio first for greedy.
    const pick = policy === 'greedy' ? (unexplored.find((a) => /treasure|curio|secret/i.test(a.label)) ?? unexplored[0]!) : unexplored[0]!
    return pick.command
  }
  // Everything next door is known: walk toward the nearest unexplored room, else toward the exit.
  const unvisited = new Set(state.floor.graph.rooms.filter((r) => !state.floor.rooms[r.id]?.visited).map((r) => r.id))
  const toward = doorToward(state, moves, unvisited) ?? (descend ? null : doorToward(state, moves, new Set([state.floor.graph.exitId])))
  if (toward) return toward
  if (descend) return descend
  if (moves.length) return rng.pick(moves).command
  // Boxed in by a trap: try the best disarm, else set it off.
  if (bestDisarm && bestDisarm.chance >= 40) return bestDisarm.a.command
  if (around) return around
  if (bestDisarm) return bestDisarm.a.command
  const retreat = find((a) => a.command.kind === 'retreat')
  if (retreat) return retreat
  return enabled[0]!.command
}

/** The legal door that starts the shortest walk to any of `targets`, over doors the party can pass right now. */
function doorToward(state: DelveState, moves: readonly LegalDelveAction[], targets: ReadonlySet<string>): DelveCommand | null {
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
      if (prev.has(d.to)) continue
      if (d.locked && !state.floor.hasKey) continue
      if (d.secret && !state.floor.rooms[id]?.secretRevealed) continue
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
  return moves.find((m) => m.command.kind === 'move' && m.command.toRoomId === step)?.command ?? null
}
