import type { CustomHandler } from './types.ts'

/**
 * Rolling Bastion, Mastery (Warden, Bulwark IV; docs/classes/warden.md §4.1): "Weight 800" — the action that carries
 * this line weighs `amount` instead of the skill's own weight. The line installs a hook for the current action (the
 * holder's action count; the fight counts an action at its turn end, after spending the weight); `modifyWeight`
 * answers once for that action and removes the hook. An action already lighter keeps its own weight.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { action: ctx.holder.tally.actions } })
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    ctx.fx.removeHook(ctx.holder, hook)
    if (Number(hook.data.action) !== ctx.holder.tally.actions) return weight
    return Math.min(weight, ctx.line.amount ?? weight)
  },
}
export default handler
