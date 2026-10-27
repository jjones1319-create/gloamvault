import type { Status } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Absolution (Mender, Vigil III; docs/classes/mender.md §4.3): the target cannot receive any debuff for `duration`
 * turns. Reading: no joint stops a status before it lands, but statuses.ts `resistChance` adds every
 * `status-resist-bonus` hook on the target for that status — so `apply` installs one at 100% (a sure resist, no RNG
 * spent) for every hostile status (dot, control, debuff, mark) alongside this marker hook, all for `duration`
 * turns; `afterHit` and `onTurnStart` strip any hostile status that got through another way.
 */
const HOSTILE = new Set(['dot', 'control', 'debuff', 'mark'])

function hostileStatuses(ctx: HookContext): Status[] {
  const out: Status[] = []
  for (const def of ctx.content.statuses.values()) if (HOSTILE.has(def.kind)) out.push(def.id)
  return out
}

function strip(ctx: HookContext): void {
  const holder = ctx.holder
  const hostile = new Set(hostileStatuses(ctx))
  const before = holder.statuses.length
  holder.statuses = holder.statuses.filter((s) => !hostile.has(s.id))
  if (holder.statuses.length !== before) {
    holder.grabbedBy = null
    ctx.fx.log('immune', `${holder.name} is beyond harm`, { actorId: holder.id })
  }
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    const duration = ctx.line.duration ?? 1
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: duration })
    for (const status of hostileStatuses(ctx)) ctx.fx.installHook(who, { kind: 'custom', customId: 'status-resist-bonus', status, percent: 100 }, `immune-to-debuffs:${status}`, { turnsLeft: duration })
    ctx.fx.log('absolved', `${who.name} is immune to debuffs for ${duration} turn${duration === 1 ? '' : 's'}`, { actorId: ctx.holder.id, targetId: who.id, data: { turns: duration } })
  },
  afterHit: (ctx) => strip(ctx),
  onTurnStart: (ctx) => strip(ctx),
}
export default handler
