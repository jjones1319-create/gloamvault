import type { Status } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Sanctuary (Mender, Benediction III; docs/classes/mender.md §4.1), second line: while this skill's Shield holds
 * on the target, it cannot be Grabbed, Rooted or Webbed. Reading: no joint stops a status before it lands, but
 * statuses.ts `resistChance` adds every `status-resist-bonus` hook on the target for that status — so `apply`
 * installs one at 100% for each of the three (a sure resist, no RNG spent) for `duration` turns beside this marker
 * hook, and the marker drops them all the moment the target is found without a Shield (after a hit, at its turn
 * start). Any Shield counts as the Sanctuary's: Shield instances carry no skill id.
 */
const LOCKS: readonly Status[] = ['grab', 'root', 'web']

function lift(ctx: HookContext): void {
  const holder = ctx.holder
  if (ctx.fx.hasStatus(holder, 'shield')) return
  for (const h of holder.hooks.filter((h) => h.customId === 'status-resist-bonus' && h.sourceId.startsWith('sanctuary:'))) ctx.fx.removeHook(holder, h)
  if (ctx.hook) ctx.fx.removeHook(holder, ctx.hook)
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    if (!ctx.fx.hasStatus(who, 'shield')) return
    const duration = ctx.line.duration ?? 2
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: duration })
    for (const status of LOCKS) ctx.fx.installHook(who, { kind: 'custom', customId: 'status-resist-bonus', status, percent: 100 }, `sanctuary:${status}`, { turnsLeft: duration })
  },
  afterHit: (ctx) => lift(ctx),
  onTurnStart: (ctx) => lift(ctx),
}
export default handler
