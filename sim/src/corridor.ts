import type { Content } from './content.ts'
import type { DelveHero, DelveState } from './delve-types.ts'
import { skillCost } from './fight.ts'
import { heroStats } from './hero.ts'
import { addLight } from './light.ts'
import { linesAtRank, rankEffectPercent } from './skill-lines.ts'
import { roundHalfUp } from './stats.ts'
import type { Effect, SkillDef } from './types/content.ts'

/**
 * Corridor skills (D-099; docs/classes/ranger.md §4.3 "Pathfinder actives work in the corridor *and* in combat"): a
 * loadout active with a corridor line can be used between fights. It costs its pool (Stamina or Mana, at its rank's
 * cost) but takes no turn and no floor-clock tick. The corridor lines the delve resolves:
 *   - `light` aimed at the room (Flint & Tinder): Light + amount × the rank's effect;
 *   - `next-room-ambush-percent` (Trailblaze): the next room's ambush roll shifts by percent × the rank's effect;
 *   - `corridor-rooms-per-tick` (Double Time): the next `amount` room entries share one floor-clock tick;
 *   - `critical-scout` (Scout Ahead): every adjacent room and the rooms beyond them are scouted (not under Blind Map).
 * A skill whose only corridor line the delve does not resolve yet (Trap Trick's pocket, Breaker's Arc's force) is not
 * offered in the corridor.
 */
export const CORRIDOR_CUSTOM_IDS: ReadonlySet<string> = new Set(['next-room-ambush-percent', 'corridor-rooms-per-tick', 'critical-scout'])

/** The corridor lines of a skill at a rank. */
export function corridorLines(skill: SkillDef, rank: number): Effect[] {
  return linesAtRank(skill, rank).filter((l) => (l.kind === 'light' && l.target === 'room') || (l.kind === 'custom' && CORRIDOR_CUSTOM_IDS.has(l.customId ?? '')))
}

export function isCorridorSkill(skill: SkillDef): boolean {
  return skill.type === 'active' && !skill.isUltimate && corridorLines(skill, 1).length > 0
}

/** The pool a corridor use costs: the skill's cost at its rank, as points and as a share of the hero's pool (rounded up). */
export function corridorCost(content: Content, h: DelveHero, skill: SkillDef): { points: number; percent: number; pool: 'stamina' | 'mana' } {
  const t = content.tuning
  const rank = h.record.skills.find((k) => k.skillId === skill.id)?.rank ?? 1
  const points = skillCost(t, skill, rank)
  const pool = content.classes.get(h.record.classId)?.pool ?? 'stamina'
  const max = Math.max(1, heroStats(content, t, h.record)[pool === 'mana' ? 'mana' : 'stamina'])
  return { points, percent: Math.ceil((points * 100) / max), pool }
}

/** The loadout actives a hero can use in the corridor now, with why one cannot. */
export function corridorChoices(content: Content, state: DelveState, heroIndex: number): { skill: SkillDef; cost: ReturnType<typeof corridorCost>; reason: string | null }[] {
  const h = state.heroes[heroIndex]
  if (!h || h.fallen) return []
  const out: { skill: SkillDef; cost: ReturnType<typeof corridorCost>; reason: string | null }[] = []
  for (const id of h.record.loadout.actives) {
    const skill = id ? content.skills.get(id) : undefined
    if (!skill || !isCorridorSkill(skill) || !h.record.skills.some((k) => k.skillId === skill.id)) continue
    const cost = corridorCost(content, h, skill)
    const rank = h.record.skills.find((k) => k.skillId === skill.id)?.rank ?? 1
    const lines = corridorLines(skill, rank)
    const blind = state.ruleFlags.includes('no-scouting')
    const useless = lines.every((l) => l.kind === 'custom' && l.customId === 'critical-scout') && blind
    const reason = useless ? 'Blind Map: no scouting' : h.poolPercent < cost.percent ? `needs ${cost.points} ${cost.pool}` : null
    out.push({ skill, cost, reason })
  }
  return out
}

/**
 * Double Time's tick sharing (D-099): true when this room entry ticks the floor clock. The entries a Double Time covers
 * pay one tick between them — the first ticks, the rest are free.
 */
export function roomEntryTicks(state: DelveState): boolean {
  const r = state.floor.roomsPerTick
  if (!r || r.left <= 0) return true
  r.left -= 1
  const tick = !r.paid
  r.paid = true
  if (r.left <= 0) state.floor.roomsPerTick = undefined
  return tick
}

/** Reveals the rooms beside `roomId` and the rooms beyond them (a critical scout, 03 §4.3); secret doors stay hidden. */
function criticalScout(state: DelveState, roomId: string): number {
  const graph = state.floor.graph
  const room = graph.rooms.find((r) => r.id === roomId)
  const here = state.floor.rooms[roomId]
  let n = 0
  const mark = (id: string) => {
    const rs = state.floor.rooms[id]
    if (rs && !rs.scouted && !rs.visited) n++
    if (rs) rs.scouted = true
  }
  for (const d of room?.doors ?? []) {
    if (d.secret && !here?.secretRevealed) continue
    mark(d.to)
    for (const d2 of graph.rooms.find((r) => r.id === d.to)?.doors ?? []) if (!d2.secret) mark(d2.to)
  }
  return n
}

/**
 * Uses a corridor skill (D-099): pays its pool, resolves its corridor lines; no turn, no floor-clock tick. Returns the
 * result line for the log; throws when it cannot be used.
 */
export function useCorridorSkill(content: Content, state: DelveState, heroIndex: number, skillId: string): string {
  const t = content.tuning
  const h = state.heroes[heroIndex]
  if (!h || h.fallen) throw new Error('no such hero')
  const choice = corridorChoices(content, state, heroIndex).find((c) => c.skill.id === skillId)
  if (!choice) throw new Error('not a corridor skill in the loadout')
  if (choice.reason) throw new Error(choice.reason)
  const rank = h.record.skills.find((k) => k.skillId === skillId)?.rank ?? 1
  const effect = rankEffectPercent(choice.skill, rank)
  h.poolPercent = Math.max(0, h.poolPercent - choice.cost.percent)
  const bits: string[] = []
  for (const line of corridorLines(choice.skill, rank)) {
    if (line.kind === 'light') {
      const amount = roundHalfUp(((line.amount ?? 0) * effect) / 100)
      state.light = addLight(t, state.light, amount)
      bits.push(`light +${amount}`)
    } else if (line.customId === 'next-room-ambush-percent') {
      const shift = roundHalfUp(((line.percent ?? 0) * effect) / 100)
      state.floor.ambushShiftNext = shift
      bits.push(`the next room's ambush ${shift}%`)
    } else if (line.customId === 'corridor-rooms-per-tick') {
      const rooms = Math.max(1, line.amount ?? 2)
      state.floor.roomsPerTick = { left: rooms, paid: false }
      bits.push(`the next ${rooms} rooms for one tick`)
    } else if (line.customId === 'critical-scout') {
      if (state.ruleFlags.includes('no-scouting')) continue
      bits.push(`${criticalScout(state, state.floor.currentRoomId)} rooms scouted`)
    }
  }
  return `${h.record.name} uses ${choice.skill.name} (${choice.cost.points} ${choice.cost.pool}): ${bits.join(', ') || 'nothing'}`
}
