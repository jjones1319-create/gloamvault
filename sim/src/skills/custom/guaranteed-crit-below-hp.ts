import type { CustomHandler } from './types.ts'

/**
 * Severance (Shade, Shadow V; docs/classes/shade.md §4.1, D-099): against a target below `percent`% HP this action's
 * hits are guaranteed crits — the crit D-099 gives in place of the execute above 6.0× ("Severance below 35% HP is 6.0×
 * with a sure crit"). The line (before the damage line) installs a hook for the current action; `forceCrit` reads the
 * target's HP as the blow lands (before it), and `onSkillUsed` consumes the hook.
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
    return target.hp * 100 < target.maxHp * (ctx.line.percent ?? 35)
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
