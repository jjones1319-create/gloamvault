import type { CustomHandler } from './types.ts'

/**
 * Deadeye (Ranger, Marksman III; docs/classes/ranger.md §4.1): this action crits automatically if the target holds
 * `status` (Mark). The line (first in the skill) installs a hook for the current action (the holder's action count);
 * `forceCrit` answers for a target holding the status, and `onSkillUsed` consumes the hook when the skill resolves.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { action: ctx.holder.tally.actions } })
  },
  forceCrit: (ctx, target) => {
    const hook = ctx.hook
    if (!hook) return false
    if (Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return false
    }
    return ctx.line.status !== undefined && ctx.fx.hasStatus(target, ctx.line.status)
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
