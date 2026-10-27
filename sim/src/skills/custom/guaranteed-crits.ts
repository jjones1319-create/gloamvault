import type { CustomHandler } from './types.ts'

/**
 * Last Light Out (Shade Ultimate; docs/classes/shade.md §3): the first `amount` damage lines of this skill crit
 * (mastery: two). The line is the skill's first; it installs a hook on the caster whose `forceCrit` answers once per
 * damage line and counts down; the hook goes when the count is spent, when the skill finishes, or at the caster's
 * next turn start, whichever comes first.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, counter: Math.max(1, ctx.line.amount ?? 1) })
  },
  forceCrit: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0) return false
    hook.counter -= 1
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
    return true
  },
  onSkillUsed: (ctx, skill) => {
    if (ctx.hook && skill.id === ctx.hook.sourceSkillId) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
