import type { CustomHandler } from './types.ts'

/**
 * Aimed Shot (Ranger, Marksman I; docs/classes/ranger.md §4.1): +`amount` Accuracy for this action only. The line
 * (before the damage line) installs a hook for the current action (the holder's action count); `accuracyBonus`
 * answers while it is current and `onSkillUsed` consumes it when the skill resolves.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { action: ctx.holder.tally.actions } })
  },
  accuracyBonus: (ctx) => {
    const hook = ctx.hook
    if (!hook) return 0
    if (Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return 0
    }
    return ctx.line.amount ?? 0
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
