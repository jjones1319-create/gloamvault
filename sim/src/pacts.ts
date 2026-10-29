import type { ShapeLine } from './grades.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { DifficultyKnobs, DungeonDef, PactDef, ZoneDef } from './types/content.ts'
import { gradeShift, type Difficulty, type Grade } from './types/enums.ts'

/**
 * The difficulty presets and the Pacts (07 §6, 03 §11.2; Phase 7). A delve runs on one preset (Normal / Hard /
 * Dread) and any Pacts the party took at the Waystone. The knobs combine here (`combineKnobs`); the systems that own
 * each effect read the result from `state.knobs` and `state.ruleFlags`, each read marked `// Pact: <name>`.
 *
 * Readings (Proposed, pass D): a Pact's percent knob multiplies the preset's, a bonus knob adds to it, every other
 * knob replaces it (every Pact is harsher than every preset on the knob it moves); Thin Line's −2 is applied after
 * the preset and never goes below 0; the Oath's chest tiers (tuning `pacts.oathTiers`) apply the highest tier
 * reached, as the Hard and Dread presets do (Hard +10 pp, Dread the centre one up).
 */

/** The rule flags a Pact may carry that the sim implements (lint rule 55 checks every Pact against this list). */
export const PACT_RULE_FLAGS = ['loud-boots', 'every-door-locked', 'no-minimap', 'no-scouting', 'no-cartography', 'no-retreat', 'wipe-loses-waystone', 'twin-hunter'] as const
export type PactRuleFlag = (typeof PACT_RULE_FLAGS)[number]

/** Percent knobs a Pact multiplies into the preset's (Pack Hunters' 125 on Hard's 110 → 138). */
const MULTIPLY: ReadonlySet<string> = new Set(['enemyHpPercent', 'enemyDamagePercent', 'enemyCountPercent', 'enemySpeedPercent', 'goldPercent', 'xpPercent', 'wearPercent'])
/** Bonus knobs a Pact adds to the preset's (Grinning Odds' +1 affix on Dread's +1 → +2). */
const ADD: ReadonlySet<string> = new Set(['eliteAffixBonus', 'trapDifficultyBonus', 'revivesPerFloorDelta', 'ambushBonusPercent', 'chestShiftPp', 'chestCentreShift', 'bossExtraRareParts', 'finalBossExtraShards'])

export interface PactReward {
  goldPercent: number
  xpPercent: number
  chestShiftPp: number
}

export interface CombinedKnobs {
  knobs: Record<string, number>
  flags: string[]
  reward: PactReward
  /** Σ weights of the Pacts taken (07 §6.2). */
  oath: number
}

/** The preset's knobs, then each known Pact's in the order given; unknown ids are skipped (a replayed save of old content). */
export function combineKnobs(t: Tuning, dungeon: DungeonDef, difficulty: Difficulty, pactIds: readonly string[]): CombinedKnobs {
  const knobs: Record<string, number> = {}
  const apply = (k: DifficultyKnobs, pact: boolean) => {
    for (const [key, value] of Object.entries(k) as [string, number | undefined][]) {
      if (value === undefined) continue
      const prev = knobs[key]
      if (pact && prev !== undefined && MULTIPLY.has(key)) knobs[key] = roundHalfUp((prev * value) / 100)
      else if (pact && prev !== undefined && ADD.has(key)) knobs[key] = prev + value
      else knobs[key] = value
    }
  }
  apply(dungeon.presets[difficulty] ?? {}, false)
  const flags: string[] = []
  const reward: PactReward = { goldPercent: 0, xpPercent: 0, chestShiftPp: 0 }
  let oath = 0
  const seen = new Set<string>()
  for (const id of pactIds) {
    const pact = dungeon.pacts.find((p) => p.id === id)
    if (!pact || seen.has(id)) continue
    seen.add(id)
    apply(pact.knobs, true)
    for (const f of pact.ruleFlags) if (!flags.includes(f)) flags.push(f)
    reward.goldPercent += pact.reward.goldPercent
    reward.xpPercent += pact.reward.xpPercent
    reward.chestShiftPp += pact.reward.chestShiftPp
    oath += pact.weight
  }
  // Thin Line (07 §6.2): revives per floor −2 on whatever the preset leaves, never below 0.
  if (knobs.revivesPerFloorDelta !== undefined) {
    const base = knobs.revivesPerFloor ?? t.death.partyRevivesPerFloor[difficulty]
    knobs.revivesPerFloor = Math.max(0, base + knobs.revivesPerFloorDelta)
    delete knobs.revivesPerFloorDelta
  }
  return { knobs, flags, reward, oath }
}

/** The Oath of a set of Pacts: their weights summed (07 §6.2). */
export function oathOf(dungeon: DungeonDef, pactIds: readonly string[]): number {
  return [...new Set(pactIds)].reduce((s, id) => s + (dungeon.pacts.find((p) => p.id === id)?.weight ?? 0), 0)
}

/** A Pact that moves the hunter: its data says so, and its knobs and flags agree (lint rule 55). */
export function pactNeedsHunter(pact: PactDef): boolean {
  return pact.needsHunter === true || pact.knobs.hunterClock !== undefined || pact.ruleFlags.includes('twin-hunter')
}

/** A zone whose floors run a hunter clock (the Drowned Vault's two boss floors have none — 07 §2.9, D-104). */
export function zoneHasHunter(dungeon: DungeonDef, zone: ZoneDef): boolean {
  return zone.hunterId !== null && dungeon.floors.some((f) => f.zoneId === zone.id && f.hunterClock !== null)
}

/** The zone a delve starting on `floor` runs through (a delve is one zone, D-098). */
export function zoneForFloor(dungeon: DungeonDef, floor: number): ZoneDef | null {
  return dungeon.zones.find((z) => floor >= z.floors.from && floor <= z.floors.to) ?? null
}

export interface PactChoice {
  pact: PactDef
  available: boolean
  /** Why it is greyed out ("No hunter stalks the Drowned Vault"). */
  reason: string | null
}

/** The Waystone's Pact menu for a delve from `floor` (07 §6.2 "No hunter, no hunter Pact"). */
export function pactChoices(dungeon: DungeonDef, floor: number): PactChoice[] {
  const zone = zoneForFloor(dungeon, floor)
  const hunted = zone ? zoneHasHunter(dungeon, zone) : false
  return dungeon.pacts.map((pact) => {
    const greyed = pactNeedsHunter(pact) && !hunted
    return { pact, available: !greyed, reason: greyed ? `No hunter stalks ${zone?.name ?? 'these floors'}` : null }
  })
}

/** The reason a set of Pacts cannot go into a delve from `floor`, or null (startDelve's check). */
export function pactsBlocker(dungeon: DungeonDef, floor: number, pactIds: readonly string[]): string | null {
  const choices = pactChoices(dungeon, floor)
  for (const id of pactIds) {
    const c = choices.find((x) => x.pact.id === id)
    if (!c) return `no Pact called ${id}`
    if (!c.available) return `${c.pact.name}: ${c.reason ?? 'not for this delve'}`
  }
  return null
}

/* ---------- the chest shift (07 §6.1 presets, §6.2 the Oath and the Pacts' rewards) ---------- */

export interface ChestShift {
  /** Points moved toward +1 grade in an in-dungeon chest's lines. */
  shiftPp: number
  /** Grades the chest's centre moves up. */
  centreShift: number
}

/** The Oath tier the total reaches (tuning `pacts.oathTiers`: the highest `at` ≤ oath), or none. */
export function oathTier(t: Tuning, oath: number): { at: number; shiftPp: number; centreShift: number } | null {
  let best: { at: number; shiftPp: number; centreShift: number } | null = null
  for (const tier of t.pacts.oathTiers) if (oath >= tier.at && (best === null || tier.at > best.at)) best = tier
  return best
}

/** In-dungeon chests on this delve: the preset's shift, the Pacts' chestShiftPp rewards and the Oath tier, summed. */
export function chestShiftFor(t: Tuning, knobs: Readonly<Record<string, number>>, pactShiftPp: number, oath: number): ChestShift {
  const tier = oathTier(t, oath)
  return {
    shiftPp: Math.max(0, (knobs.chestShiftPp ?? 0) + pactShiftPp + (tier?.shiftPp ?? 0)),
    centreShift: Math.max(0, (knobs.chestCentreShift ?? 0) + (tier?.centreShift ?? 0)),
  }
}

/**
 * Moves `pp` points of a chest's shape one grade up: from its lowest line with weight to the line above it (a Small
 * chest's 75 / 25 at +10 pp → 65 / 35; a Large chest's +1 75 / +2 25 → 65 / 35). Never more than the line holds.
 */
export function shiftChestLines(lines: readonly ShapeLine[], pp: number): ShapeLine[] {
  const out = lines.map((l) => ({ ...l }))
  if (pp <= 0) return out
  const lowest = [...out].filter((l) => l.weight > 0).sort((a, b) => a.offset - b.offset)[0]
  if (!lowest) return out
  const move = Math.min(pp, lowest.weight)
  lowest.weight -= move
  const above = out.find((l) => l.offset === lowest.offset + 1)
  if (above) above.weight += move
  else out.push({ offset: lowest.offset + 1, weight: move })
  return out
}

/** The centre grade a chest rolls around once the delve's centre shift applies (capped by the grade order). */
export function shiftedCentre(centre: Grade, centreShift: number): Grade {
  return centreShift > 0 ? gradeShift(centre, centreShift) : centre
}

/* ---------- Every Door Locked (07 §6.2) ---------- */

/** A chest that would be open locks `lockedChestPercent` of the time (one extra roll, only under the Pact). */
export function lockForPact<C extends { locked: boolean }>(knobs: Readonly<Record<string, number>>, rng: Rng, chest: C): C {
  const pct = knobs.lockedChestPercent ?? 0
  if (pct <= 0 || chest.locked) return chest
  return rng.pct(pct) ? { ...chest, locked: true } : chest
}

/* ---------- Hard and Dread (07 §6.1: each opens per dungeon when its final boss is dead on the preset below) ---------- */

/** The boss of the dungeon's last floor (the Hollow King once Gravehollow has its eight floors). */
export function finalBossOf(dungeon: DungeonDef): string | null {
  const last = [...dungeon.floors].sort((a, b) => b.floor - a.floor)[0]
  return last?.bossId ?? null
}

/** The kill records a difficulty check reads (the profile's `progress`, Phase 7). */
export interface KillRecords {
  /** Kills by boss id on any preset (TowerProgress.bossKills). */
  bossKills: Readonly<Record<string, number>>
  /** Kills by preset and boss id (TowerProgress.bossKillsByDifficulty, Phase 7); absent in older saves. */
  bossKillsByDifficulty?: Readonly<Partial<Record<Difficulty, Readonly<Record<string, number>>>>>
}

/**
 * Is a preset open in this dungeon? Normal always; Hard once the final boss is dead (any kill counts: before Hard
 * opens, every kill was on Normal); Dread once it is dead on Hard or Dread. The reason names the boss when it is shut.
 */
export function difficultyOpen(dungeon: DungeonDef, records: KillRecords, difficulty: Difficulty, bossName?: string): { open: boolean; reason: string | null } {
  if (difficulty === 'normal') return { open: true, reason: null }
  const final = finalBossOf(dungeon)
  if (!final) return { open: false, reason: `${dungeon.name} has no final boss yet` }
  const who = bossName ?? final
  if (difficulty === 'hard') {
    const open = (records.bossKills[final] ?? 0) > 0
    return { open, reason: open ? null : `Defeat ${who} on Normal to open Hard` }
  }
  const by = records.bossKillsByDifficulty ?? {}
  const open = (by.hard?.[final] ?? 0) + (by.dread?.[final] ?? 0) > 0
  return { open, reason: open ? null : `Defeat ${who} on Hard to open Dread` }
}
