import type { CustomHandler } from './types.ts'

/**
 * Guillotine (Blade, Executioner IV; docs/classes/blade.md §4.2): "never misses a Marked target" — this action cannot
 * miss a target holding `status` (Mark). The line (first in the skill) installs a hook for the current action (the
 * holder's action count); `accuracyBonus` answers +1,000 against a target holding the status (the hit chance is
 * clamped to 100) and `onSkillUsed` consumes the hook when the skill resolves.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { action: ctx.holder.tally.actions } })
  },
  accuracyBonus: (ctx, target) => {
    const hook = ctx.hook
    if (!hook) return 0
    if (Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return 0
    }
    return ctx.line.status !== undefined && ctx.fx.hasStatus(target, ctx.line.status) ? 1000 : 0
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
