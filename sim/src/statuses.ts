import type { Content } from './content.ts'
import type { Actor, StatusInstance } from './fight-types.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { Effect, StatusDef } from './types/content.ts'
import type { Status } from './types/enums.ts'

/**
 * Statuses (03-GAME-DESIGN §3.5, D-023; 06 §7): the 27 records from content own their numbers. This module applies,
 * stacks, converts, resists, cleanses and counts them down. Ticks (DoT/HoT damage) are computed here and dealt by the
 * fight so the damage pipeline stays in one place.
 */
export function statusDef(content: Content, id: Status): StatusDef {
  const def = content.statuses.get(id)
  if (!def) throw new Error(`unknown status ${id}`)
  return def
}

export function hasStatus(actor: Actor, id: Status): boolean {
  return actor.statuses.some((s) => s.id === id)
}

export function findStatus(actor: Actor, id: Status): StatusInstance | undefined {
  return actor.statuses.find((s) => s.id === id)
}

export function stacksOf(actor: Actor, id: Status): number {
  return findStatus(actor, id)?.stacks ?? 0
}

export interface ApplyStatusInput {
  status: Status
  /** 0–100; omitted = 100. */
  chance?: number
  duration?: number
  /** DoT: the applying hit's damage; Shield: the absorb; Regen: percent of max HP. */
  magnitude?: number
  sourceId: string | null
  /** Species knobs of the applier (an Orc's Fear lasts longer). */
  applierDurationMultiplier?: number
  /** Applied during the target's own turn: the status skips that turn's count-down once (D-077). */
  fresh?: boolean
}

export type ApplyStatusResult =
  | { outcome: 'applied'; status: Status; upgraded: boolean }
  | { outcome: 'resisted' }
  | { outcome: 'immune' }
  | { outcome: 'missed' }

/** What a target does with a status before any roll: takes it, takes a milder one, or shrugs it off (06 §7). */
export function statusConversion(content: Content, target: Actor, id: Status, grabberSize?: string): { status: Status | null; reason: 'ok' | 'immune' | 'converted' } {
  const def = statusDef(content, id)
  const m = target.monster
  const role = m?.role
  if (m) {
    if (m.statusImmune.includes(id)) return { status: null, reason: 'immune' }
    if (role && def.immunityRoles.includes(role)) {
      if (def.bossBecomes) return { status: def.bossBecomes, reason: 'converted' }
      return { status: null, reason: 'immune' }
    }
    if (def.bossBecomes && (m.isBoss || m.isHunter)) return { status: def.bossBecomes, reason: 'converted' }
    // Size rules (06 §7).
    if (m.size === 'huge') {
      if (id === 'grab' || id === 'web' || id === 'root') return { status: 'slow', reason: 'converted' }
      if (id === 'freeze') return { status: 'chill', reason: 'converted' }
      if (id === 'petrify') return { status: null, reason: 'immune' }
    }
    if (m.size === 'large') {
      if (id === 'web') return { status: null, reason: 'immune' }
      if (id === 'grab' && grabberSize !== 'huge') return { status: null, reason: 'immune' }
      if (id === 'freeze') return { status: 'chill', reason: 'converted' }
    }
    if (m.role === 'elite' && id === 'web') return { status: null, reason: 'immune' }
  }
  const h = target.hero
  if (h && h.species.immunities.includes(id)) return { status: null, reason: 'immune' }
  return { status: id, reason: 'ok' }
}

const HOSTILE_KINDS = new Set(['dot', 'control', 'debuff', 'mark'])

/** The resist chance against a hostile status: Resistance (Willpower) plus the species' line for it. */
export function resistChance(actor: Actor, def: StatusDef, content?: Content): number {
  if (!HOSTILE_KINDS.has(def.kind)) return 0
  const species = actor.hero?.species.statusResist[def.id] ?? 0
  // An Antidote's +50% Poison resistance (08 §4): a status-resist-bonus hook on the target for its duration.
  let hooks = 0
  for (const h of actor.hooks) if (h.customId === 'status-resist-bonus' && h.line.status === def.id) hooks += h.line.percent ?? 0
  // Resistance buffs count (Fortify, a Mender's aura, a passive): the actor's modifiers and its statuses' stat lines.
  let flat = 0
  let pct = 0
  for (const m of actor.modifiers) {
    if (m.stat !== 'resistance') continue
    flat += m.amount
    pct += m.percent
  }
  if (content) {
    for (const { line, stacks } of statusStatLines(content, actor)) {
      if (line.stat !== 'resistance') continue
      flat += (line.amount ?? 0) * stacks
      pct += (line.percent ?? 0) * stacks
    }
  }
  const resistance = Math.round(((actor.base.resistance + flat) * (100 + pct)) / 100)
  return Math.max(0, resistance + species + hooks)
}

/** Applies a status with every rule of §3.5 and 06 §7. The caller rolls `chance` first through this function too. */
export function applyStatus(content: Content, t: Tuning, rng: Rng, target: Actor, input: ApplyStatusInput, grabberSize?: string): ApplyStatusResult {
  if (input.chance !== undefined && !rng.pct(input.chance)) return { outcome: 'missed' }
  const conv = statusConversion(content, target, input.status, grabberSize)
  if (!conv.status) return { outcome: 'immune' }
  let id = conv.status
  let def = statusDef(content, id)
  if (rng.pct(resistChance(target, def, content))) return { outcome: 'resisted' }

  // A second Chill becomes Freeze (unless the target only ever takes Chill).
  let upgraded = false
  if (def.upgradesTo && hasStatus(target, id)) {
    const up = statusConversion(content, target, def.upgradesTo, grabberSize)
    if (up.status && up.status !== id) {
      target.statuses = target.statuses.filter((s) => s.id !== id)
      id = up.status
      def = statusDef(content, id)
      upgraded = true
    }
  }

  // Instant statuses (Daze) only move the accumulator.
  const instant = def.durationDefault === null && (def.endsWhen ?? '').startsWith('instant')
  if (def.appliesEnergyDelta) target.energy += def.appliesEnergyDelta
  if (instant) return { outcome: 'applied', status: id, upgraded }

  // An upgrade (Chill → Freeze) takes the upgraded status's own duration, not the Chill line's (03 §3.5: Freeze 1).
  let duration: number | null = upgraded ? def.durationDefault : (input.duration ?? def.durationDefault)
  if (duration !== null) {
    const m = target.monster
    if (m && (m.isBoss || m.isHunter)) duration -= 1
    duration += target.hero?.species.statusDurationDelta[id] ?? 0
    if (input.applierDurationMultiplier) duration = roundHalfUp(duration * input.applierDurationMultiplier)
    duration = Math.max(1, duration)
  }
  const magnitude = magnitudeFor(def, input.magnitude ?? 0, t)
  const existing = findStatus(target, id)
  if (existing) {
    if (def.stacking === 'stack') existing.stacks = Math.min(def.maxStacks, existing.stacks + 1)
    if (def.stacking === 'max') existing.magnitude = Math.max(existing.magnitude, magnitude)
    else if (def.stacking === 'stack' && def.magnitudeOf === 'hitDamage') existing.magnitude = Math.max(existing.magnitude, magnitude)
    else if (def.stacking === 'refresh') existing.magnitude = magnitude
    existing.turnsLeft = duration
    existing.sourceId = input.sourceId
    existing.counter = 0
    if (input.fresh) existing.fresh = true
    return { outcome: 'applied', status: id, upgraded }
  }
  target.statuses.push({ id, stacks: 1, turnsLeft: duration, magnitude, sourceId: input.sourceId, counter: 0, ...(input.fresh ? { fresh: true } : {}) })
  return { outcome: 'applied', status: id, upgraded }
}

function magnitudeFor(def: StatusDef, given: number, t: Tuning): number {
  switch (def.magnitudeOf) {
    case 'hitDamage':
      return roundHalfUp((given * (def.percent ?? 0)) / 100)
    case 'maxHp':
      return given > 0 ? given : (def.percent ?? 0)
    case 'fixed':
      return given
    default:
      return given
  }
  // t is reserved for status numbers that may move into tuning later.
  void t
}

export function removeStatus(actor: Actor, id: Status): boolean {
  const before = actor.statuses.length
  actor.statuses = actor.statuses.filter((s) => s.id !== id)
  return actor.statuses.length !== before
}

/** Cleanses every status one of the tags can clear (Antidote: 'antidote'; a Mender cleanse: 'cleanse'). */
export function cleanse(content: Content, actor: Actor, tags: readonly string[], count = Infinity): Status[] {
  const removed: Status[] = []
  actor.statuses = actor.statuses.filter((s) => {
    if (removed.length >= count) return true
    const def = statusDef(content, s.id)
    const hit = def.cleansedBy.some((tag) => tags.includes(tag))
    if (hit) removed.push(s.id)
    return !hit
  })
  return removed
}

/** Strips buffs (every status whose cleansedBy includes 'strip'). */
export function strip(content: Content, actor: Actor, count = Infinity): Status[] {
  const removed: Status[] = []
  actor.statuses = actor.statuses.filter((s) => {
    if (removed.length >= count) return true
    const def = statusDef(content, s.id)
    if (def.cleansedBy.includes('strip')) {
      removed.push(s.id)
      return false
    }
    return true
  })
  return removed
}

/** The buff/debuff stat lines of every status the actor holds (Chill's Speed −25%, Fortify's Defense +20%). */
export function statusStatLines(content: Content, actor: Actor): { line: Effect; stacks: number }[] {
  const out: { line: Effect; stacks: number }[] = []
  for (const s of actor.statuses) {
    for (const line of statusDef(content, s.id).effects) {
      if (line.kind === 'buffStat' || line.kind === 'debuffStat') out.push({ line, stacks: s.stacks })
    }
  }
  return out
}

/** The custom hook ids active on the actor through its statuses. */
export function statusHooks(content: Content, actor: Actor): { status: StatusInstance; line: Effect }[] {
  const out: { status: StatusInstance; line: Effect }[] = []
  for (const s of actor.statuses) {
    for (const line of statusDef(content, s.id).effects) if (line.kind === 'custom' && line.customId) out.push({ status: s, line })
  }
  return out
}

export interface StatusTick {
  status: Status
  kind: 'dot' | 'hot'
  amount: number
  damageType: StatusDef['tickDamageType']
  ignoresDefense: boolean
  sourceId: string | null
}

/** DoTs and HoTs at the holder's turn start (§3.5): per stack, per tick. The fight deals them. */
export function pendingTicks(content: Content, actor: Actor): StatusTick[] {
  const out: StatusTick[] = []
  for (const s of actor.statuses) {
    const def = statusDef(content, s.id)
    if (def.tickAt !== 'turnStart' || (def.kind !== 'dot' && def.kind !== 'hot')) continue
    let perStack = 0
    if (def.magnitudeOf === 'maxHp') perStack = roundHalfUp((actor.maxHp * s.magnitude) / 100)
    else perStack = s.magnitude
    const amount = Math.max(0, perStack * s.stacks)
    if (amount <= 0) continue
    out.push({ status: s.id, kind: def.kind, amount, damageType: def.tickDamageType, ignoresDefense: def.ignoresDefense, sourceId: s.sourceId })
  }
  return out
}

/** Durations count down at the holder's turn end (§3.5); expired statuses fall off. Until-condition statuses stay. */
export function countDownStatuses(actor: Actor): Status[] {
  const expired: Status[] = []
  actor.statuses = actor.statuses.filter((s) => {
    if (s.turnsLeft === null) return true
    // A status gained during this very turn keeps its full duration through it (D-077).
    if (s.fresh) {
      delete s.fresh
      return true
    }
    s.turnsLeft -= 1
    if (s.turnsLeft <= 0) {
      expired.push(s.id)
      return false
    }
    return true
  })
  actor.modifiers = actor.modifiers.filter((m) => {
    if (m.fresh) {
      delete m.fresh
      return true
    }
    m.turnsLeft -= 1
    return m.turnsLeft > 0
  })
  // Persistent hooks with a duration (Intercept 2 turns, an Antidote's 3) count down the same way.
  actor.hooks = actor.hooks.filter((h) => {
    if (h.turnsLeft === null) return true
    h.turnsLeft -= 1
    return h.turnsLeft > 0
  })
  return expired
}

/** Stun/Freeze/Petrify/Fear: does the holder lose this action? Returns the status that took it. */
export function actionSkippedBy(content: Content, rng: Rng, actor: Actor): Status | null {
  for (const s of actor.statuses) {
    const def = statusDef(content, s.id)
    if (def.skipsActionChance > 0 && rng.pct(def.skipsActionChance)) return s.id
  }
  return null
}
