import type { Content } from './content.ts'
import type { DelveState } from './delve-types.ts'
import type { FightState } from './fight-types.ts'
import type { Tuning } from './tuning.ts'
import type { ThreatBand } from './types/enums.ts'

/**
 * Danger you can read (D-092, James: "Encounters should feel threatening and dangerous if you go too far"): an
 * encounter's level — its highest monster level, +1 per champion affix, +3 for a boss or the hunter — against the
 * party's level (the average of the living heroes, rounded down): Easy (2 or more below), Even (within 1), Dangerous
 * (2–3 above), Deadly (4 or more above). Numbers in `tuning.json` → `dungeon.threat`. Pure; the screens show it.
 */
export interface ThreatRead {
  band: ThreatBand
  encounterLevel: number
  partyLevel: number
  /** encounterLevel − partyLevel. */
  diff: number
}

export interface ThreatMonster {
  level: number
  championAffixes: number
  isBoss: boolean
  isHunter: boolean
}

/** The party's level: the average of the living heroes' levels, rounded down (1 with nobody). */
export function partyLevelOf(levels: readonly number[]): number {
  if (levels.length === 0) return 1
  return Math.max(1, Math.floor(levels.reduce((s, l) => s + l, 0) / levels.length))
}

export function threatBand(t: Tuning, encounterLevel: number, partyLevel: number): ThreatBand {
  const th = t.dungeon.threat
  const diff = encounterLevel - partyLevel
  if (diff >= th.deadlyFrom) return 'deadly'
  if (diff >= th.dangerousFrom) return 'dangerous'
  if (diff <= th.easyAtOrBelow) return 'easy'
  return 'even'
}

/** One encounter's level from its monsters (the strongest one sets it). */
export function encounterLevelOf(t: Tuning, monsters: readonly ThreatMonster[]): number {
  const th = t.dungeon.threat
  let best = 1
  for (const m of monsters) {
    const level = m.level + m.championAffixes * th.perChampionAffix + (m.isBoss ? th.bossBonus : 0) + (m.isHunter ? th.hunterBonus : 0)
    best = Math.max(best, level)
  }
  return best
}

export function threatRead(t: Tuning, monsters: readonly ThreatMonster[], partyLevel: number): ThreatRead {
  const encounterLevel = encounterLevelOf(t, monsters)
  return { band: threatBand(t, encounterLevel, partyLevel), encounterLevel, partyLevel, diff: encounterLevel - partyLevel }
}

/** The party level of a delve: its living (not fallen) heroes. */
export function delvePartyLevel(state: DelveState): number {
  return partyLevelOf(state.heroes.filter((h) => !h.fallen).map((h) => h.record.level))
}

/** A fight's threat from its actors: the enemy monsters against the party's heroes still standing at the start. */
export function fightThreat(t: Tuning, fight: FightState): ThreatRead {
  const monsters: ThreatMonster[] = fight.actors
    .filter((a) => a.side !== 'party' && a.kind === 'monster' && !a.monster?.summonedBy)
    .map((a) => ({ level: a.level, championAffixes: a.monster?.champion?.affixIds.length ?? 0, isBoss: a.monster?.isBoss ?? false, isHunter: a.monster?.isHunter ?? false }))
  const heroes = fight.actors.filter((a) => a.side === 'party' && a.kind === 'hero' && !a.fallen).map((a) => a.level)
  return threatRead(t, monsters, partyLevelOf(heroes))
}

/**
 * A room's threat before the party goes in, when its fight is known (visited, or scouted from a neighbour, 03 §4.3):
 * the encounter's monsters at the floor's level, its champion affixes, the boss of a boss room. Null when the room
 * holds no fight the party knows of.
 */
export function roomThreat(content: Content, state: DelveState, roomId: string): ThreatRead | null {
  const rs = state.floor.rooms[roomId]
  if (!rs || rs.cleared || !(rs.scouted || rs.visited)) return null
  const level = state.floor.monsterLevel
  const partyLevel = delvePartyLevel(state)
  // A boss stands at the floor's level (monsters.ts); the +3 is the threat's boss bonus.
  if (rs.kind === 'boss') return threatRead(content.tuning, [{ level, championAffixes: 0, isBoss: true, isHunter: false }], partyLevel)
  if (!rs.encounterId) return null
  const encounter = content.encounters.get(rs.encounterId)
  if (!encounter) return null
  return threatRead(content.tuning, [{ level, championAffixes: rs.championAffixIds.length, isBoss: false, isHunter: false }], partyLevel)
}

/** A floor's threat at the Waystone and the stairs: its monsters' level, and its boss when it has one. */
export function floorThreat(content: Content, dungeonId: string, floor: number, partyLevel: number): { floor: ThreatRead; boss: ThreatRead | null } | null {
  const dungeon = content.dungeons.get(dungeonId)
  const fd = dungeon?.floors.find((f) => f.floor === floor)
  if (!dungeon || !fd) return null
  const t = content.tuning
  return {
    floor: threatRead(t, [{ level: fd.monsterLevel, championAffixes: 0, isBoss: false, isHunter: false }], partyLevel),
    boss: fd.bossId ? threatRead(t, [{ level: fd.monsterLevel, championAffixes: 0, isBoss: true, isHunter: false }], partyLevel) : null,
  }
}
