import type { Content } from '../../../../../sim/src/content.ts'
import { goldFor } from '../../../../../sim/src/economy.ts'
import type { DelveSummaryRecord, MemorialRecord } from '../../../../../sim/src/town.ts'
import type { ContractDef } from '../../../../../sim/src/types/content.ts'
import type { DeathRule, ThreatBand } from '../../../../../sim/src/types/enums.ts'

/**
 * The town's words (Phase 4): pure helpers that turn the sim's records into the plain lines the places show — a
 * contract's task and reward in gold at the player's band (07 §7), the last delve's summary with its dead and lost
 * (D-088), the Shrine's and the Memorial's lines (D-089, D-090), the threat bands (D-092), the save file's name. No
 * DOM and no signals, so they are tested in node.
 */

/** "cellar-vermin" → "Cellar Vermin". */
export function titleCase(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

/** A boss's short name: "Captain Vexa Marrow" from "Captain Vexa Marrow, the Grinning Captain"; "the Barrow Warden" for one the content does not hold yet. */
export function bossName(c: Content, monsterId: string): string {
  const m = c.monsters.get(monsterId)
  if (m) return m.name.split(',')[0]!.trim()
  return `the ${titleCase(monsterId)}`
}

/** "Varra" · "Varra and Pip" · "Varra, Pip and Orrin". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ---------- the Quest Board (07 §7) ---------- */

export const WEEK_MS = 604_800_000
const DAY_MS = 86_400_000

/** The board's week: the sim draws the three contracts from this number (it has no clock of its own). */
export function weekIndexAt(now: number): number {
  return Math.floor(now / WEEK_MS)
}

/** Whole days (at least 1) until the board changes. */
export function daysToNextBoard(now: number): number {
  return Math.max(1, Math.ceil(((weekIndexAt(now) + 1) * WEEK_MS - now) / DAY_MS))
}

/** A contract's own words with prices in R turned into gold at the player's band ("1.5 R of unbanked gold" → "450 unbanked gold"). */
export function withGold(text: string, r: number): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*R of /g, (_m, n: string) => `${goldFor(Number(n), r)} `)
    .replace(/(\d+(?:\.\d+)?)\s*R\b/g, (_m, n: string) => `${goldFor(Number(n), r)} gold`)
}

const DIFFICULTY_NAMES: Record<string, string> = { normal: 'Normal', hard: 'Hard', dread: 'Dread' }

/** The contract's target as short chips: where, how many, and the conditions. */
export function contractChips(c: Content, k: ContractDef, r: number): string[] {
  const t = k.target
  const out: string[] = []
  if (t.monsterId) out.push(bossName(c, t.monsterId))
  if (t.count !== undefined && t.count > 1) out.push(`${t.count} to do`)
  const dungeon = t.dungeonId ? c.dungeons.get(t.dungeonId) : undefined
  const zone = t.zoneId ? dungeon?.zones.find((z) => z.id === t.zoneId) : undefined
  if (zone) out.push(zone.name)
  else if (dungeon) out.push(dungeon.name)
  if (t.lightMin !== undefined) out.push(`Light ${t.lightMin} or more`)
  if (t.lightMax !== undefined) out.push(`Light ${t.lightMax} or less`)
  if (t.difficultyMin && t.difficultyMin !== 'normal') out.push(`${DIFFICULTY_NAMES[t.difficultyMin] ?? titleCase(t.difficultyMin)} or harder`)
  if (t.partyMin !== undefined && t.partyMin > 1) out.push(`Party of ${t.partyMin}+`)
  if (t.goldR !== undefined) out.push(`${goldFor(t.goldR, r)} gold`)
  return out
}

/** The reward in plain words: gold at the player's band, keys, a chest, items. */
export function contractReward(c: Content, k: ContractDef, r: number): string[] {
  const out = [`${goldFor(k.reward.goldR, r)} gold`]
  for (const key of k.reward.keys) out.push(`${key.amount} ${key.kind === 'grand' ? 'Grand' : 'Standard'} Key${key.amount === 1 ? '' : 's'}`)
  if (k.reward.chestId) out.push(c.chests.get(k.reward.chestId)?.name ?? titleCase(k.reward.chestId))
  for (const it of k.reward.items) out.push(`${it.amount} × ${c.items.get(it.itemId)?.name ?? titleCase(it.itemId)}`)
  return out
}

/* ---------- the last delve (03 §12, D-083, D-088) ---------- */

export function outcomeTitle(outcome: string): string {
  switch (outcome) {
    case 'cleared':
      return 'Zone cleared'
    case 'retreated':
      return 'Home safe'
    case 'wiped':
      return 'The party fell'
    default:
      return 'The delve ended'
  }
}

/** "Floors 1–2 · +86 gold · 3 items found · 4 fights" (a wipe shows the gold lost). */
export function delveSummaryParts(s: DelveSummaryRecord): string[] {
  const parts: string[] = []
  parts.push(s.floorFrom === s.floorTo ? `Floor ${s.floorFrom}` : `Floors ${s.floorFrom}–${s.floorTo}`)
  if (s.outcome === 'wiped') parts.push(s.goldLost > 0 ? `${s.goldLost} gold lost` : 'no gold lost')
  else parts.push(`+${s.gold} gold`)
  if (s.items > 0) parts.push(`${s.items} item${s.items === 1 ? '' : 's'} found`)
  if (s.fights > 0) parts.push(`${s.fights} fight${s.fights === 1 ? '' : 's'}`)
  return parts
}

/** Per hero who came home: "Orrin +1 level" or "Orrin +45 XP" (names from the summary's ids, so the lost are left out). */
export function delveGrowth(heroes: readonly { id: string; name: string }[], s: DelveSummaryRecord): string[] {
  const out: string[] = []
  for (const [id, levels] of Object.entries(s.levelsGained)) {
    const h = heroes.find((x) => x.id === id)
    if (!h) continue
    if (levels > 0) out.push(`${h.name} +${levels} level${levels === 1 ? '' : 's'}`)
    else if ((s.battleXp[id] ?? 0) > 0) out.push(`${h.name} +${s.battleXp[id]} XP`)
  }
  return out
}

/**
 * The delve's dead and lost (D-088) and its raises (D-089), one line each: "Varra died; the party carried the body
 * to the Shrine" · "Orrin was lost for good" · "1 hero raised in the tower". Older summaries without the fields read
 * as none.
 */
export function delveLosses(s: Partial<Pick<DelveSummaryRecord, 'died' | 'lost' | 'raises'>>): string[] {
  const out: string[] = []
  const died = s.died ?? []
  const lost = s.lost ?? []
  const raises = s.raises ?? 0
  if (died.length === 1) out.push(`${died[0]} died; the party carried the body to the Shrine`)
  else if (died.length > 1) out.push(`${namesList(died)} died; the party carried them to the Shrine`)
  if (lost.length === 1) out.push(`${lost[0]} was lost for good`)
  else if (lost.length > 1) out.push(`${namesList(lost)} were lost for good`)
  if (raises > 0) out.push(`${raises} hero${raises === 1 ? '' : 'es'} raised in the tower`)
  return out
}

/* ---------- death, the Shrine and the Memorial (D-088–D-090) ---------- */

/** "floor 1 of Gravehollow Keep". */
export function fellWhere(c: Content, dungeonId: string | null, floor: number | null): string {
  if (!dungeonId || floor === null) return 'somewhere in the tower'
  return `floor ${floor} of ${c.dungeons.get(dungeonId)?.name ?? titleCase(dungeonId)}`
}

/** The level a Shrine raise leaves (D-089: never below 1). */
export function levelAfterRaise(level: number, loss: number): number {
  return Math.max(1, level - Math.max(0, loss))
}

/** The save's death rule in plain words (D-088, D-095). */
export function deathRuleLine(rule: DeathRule): string {
  if (rule === 'nightmare') return 'Nightmare: your chosen hero leads every delve, and if they die the save ends; other heroes who die stay dead until raised.'
  return rule === 'mortal'
    ? 'Mortal: a hero who dies in the tower stays dead until raised, and a wipe loses the whole party.'
    : 'Sheltered: the fallen get up after a fight, and nobody is lost for good.'
}

/** The rule's name (D-088, D-095). */
export function deathRuleName(rule: DeathRule): string {
  return rule === 'nightmare' ? 'Nightmare' : rule === 'mortal' ? 'Mortal' : 'Sheltered'
}

/** One Memorial line after the name: "Human Warden · level 2 · laid to rest after falling on floor 1 of Gravehollow Keep". */
export function memorialLine(c: Content, m: MemorialRecord): string {
  const who = `${c.species.get(m.speciesId)?.name ?? titleCase(m.speciesId)} ${c.classes.get(m.classId)?.name ?? titleCase(m.classId)}`
  const where = fellWhere(c, m.dungeonId, m.floor)
  const how = m.how === 'wipe' ? `lost with the party on ${where}` : `laid to rest after falling on ${where}`
  return `${who} · level ${m.level} · ${how}`
}

/* ---------- threat (D-092) ---------- */

export const THREAT_NAMES: Readonly<Record<ThreatBand, string>> = { easy: 'Easy', even: 'Even', dangerous: 'Dangerous', deadly: 'Deadly' }

/** True for the bands that can kill a careless party (the Waystone's Mortal warning). */
export function isPerilous(band: ThreatBand): boolean {
  return band === 'dangerous' || band === 'deadly'
}

/* ---------- the save file ---------- */

/** `gloamvault-save-2026-10-27.json` (the local date). */
export function saveFileName(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `gloamvault-save-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}
