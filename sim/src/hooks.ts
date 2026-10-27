import type { Content } from './content.ts'
import type { Actor, HookInstance, StatusInstance } from './fight-types.ts'
import { statusHooks } from './statuses.ts'
import type { Effect } from './types/content.ts'

/**
 * Persistent custom hooks (09-SKILLS §6, content/README.md rule 31). A status carries its custom lines for as long
 * as it is held (statuses.ts); everything else that must outlive the line that created it — a loadout passive, a
 * champion's affix, a pet's trait, a stance "until your next turn", a broken limb — sits on the actor as a
 * HookInstance with its own small state. `activeHooks` is the one list the fight consults for both.
 */
export interface ActiveHook {
  status: StatusInstance | null
  hook: HookInstance | null
  line: Effect
}

/** Every custom line active on the actor: its statuses' lines first, then its persistent hooks. */
export function activeHooks(content: Content, actor: Actor): ActiveHook[] {
  const out: ActiveHook[] = statusHooks(content, actor).map(({ status, line }) => ({ status, hook: null, line }))
  for (const hook of actor.hooks) out.push({ status: null, hook, line: hook.line })
  return out
}

export interface InstallOptions {
  /** The skill that owns the line (a passive's school is read from it). */
  sourceSkillId?: string | null
  /** Turns left, counted down at the holder's turn end like a status; null (the default) lasts the fight. */
  turnsLeft?: number | null
  /** Drops at the holder's next turn start ("until your next turn"). */
  untilTurnStart?: boolean
  counter?: number
  data?: Record<string, number | string | boolean>
  /** Replace an earlier hook with the same customId from the same source (the default) instead of stacking. */
  replace?: boolean
}

export function installHook(actor: Actor, line: Effect, sourceId: string, opts: InstallOptions = {}): HookInstance {
  const customId = line.customId ?? 'custom'
  if (opts.replace ?? true) actor.hooks = actor.hooks.filter((h) => !(h.customId === customId && h.sourceId === sourceId))
  const hook: HookInstance = {
    customId,
    line,
    sourceId,
    sourceSkillId: opts.sourceSkillId ?? null,
    turnsLeft: opts.turnsLeft ?? null,
    untilTurnStart: opts.untilTurnStart ?? false,
    counter: opts.counter ?? 0,
    data: { ...(opts.data ?? {}) },
  }
  actor.hooks.push(hook)
  return hook
}

export function removeHook(actor: Actor, hook: HookInstance): void {
  actor.hooks = actor.hooks.filter((h) => h !== hook)
}

/** Removes every hook with the customId (from one source when given); returns how many went. */
export function removeHooksById(actor: Actor, customId: string, sourceId?: string): number {
  const before = actor.hooks.length
  actor.hooks = actor.hooks.filter((h) => !(h.customId === customId && (sourceId === undefined || h.sourceId === sourceId)))
  return before - actor.hooks.length
}

export function hooksOf(actor: Actor, customId: string): HookInstance[] {
  return actor.hooks.filter((h) => h.customId === customId)
}

/** Hooks that end at the holder's turn start fall off (Counter Stance). */
export function dropTurnStartHooks(actor: Actor): HookInstance[] {
  const dropped = actor.hooks.filter((h) => h.untilTurnStart)
  if (dropped.length) actor.hooks = actor.hooks.filter((h) => !h.untilTurnStart)
  return dropped
}
