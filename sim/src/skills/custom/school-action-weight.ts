import type { CustomHandler, HookContext } from './types.ts'

/**
 * Ironlung (Warden, Warcry IV passive; docs/classes/warden.md §4.3): "Shouts have weight 800" — an active of the
 * owner's school (Warcry: the shouts) weighs `amount` instead of its own; a lighter one keeps its weight. Reading: the
 * fight spends an action's weight after the skill resolves, so `onSkillUsed` marks the action (the holder's action
 * count) when it is one of the school's actives and `modifyWeight` answers for that action.
 */
function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    const hook = ctx.hook
    const school = schoolOf(ctx)
    if (!hook || !school || skill.school !== school || skill.type !== 'active' || skill.isUltimate) return
    hook.data.action = ctx.holder.tally.actions
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook || hook.data.action === undefined || Number(hook.data.action) !== ctx.holder.tally.actions) return weight
    return Math.min(weight, ctx.line.amount ?? weight)
  },
}
export default handler
