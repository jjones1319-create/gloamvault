import type { CustomHandler } from './types.ts'

/**
 * Predator's Patience (Ranger, Marksman III; docs/classes/ranger.md §4.1): each turn spent not attacking (Guard,
 * Item, Mark, a Pathfinder active, a row swap) adds +`percent` to the next shot, up to `amount`; the next damaging
 * skill or basic attack spends it. Reading: `modifyLine` scales every damage line of the spending action by the
 * stacks held and marks the action as an attack; `modifyWeight` closes the action — an attack empties the stacks,
 * anything else adds one.
 */
const handler: CustomHandler = {
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    if (!hook || line.kind !== 'damage' || (source.kind !== 'skill' && source.kind !== 'basic')) return null
    hook.data.attackAction = ctx.holder.tally.actions
    const stacks = Number(hook.data.stacks ?? 0)
    if (stacks <= 0) return null
    return { ...line, multiplier: (line.multiplier ?? 1) * (1 + stacks / 100) }
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    const stacks = Number(hook.data.stacks ?? 0)
    if (Number(hook.data.attackAction ?? -1) === ctx.holder.tally.actions) {
      if (stacks > 0) ctx.fx.log('patience', `${ctx.holder.name} spends +${stacks}% of patience`, { actorId: ctx.holder.id, amount: stacks })
      hook.data.stacks = 0
    } else hook.data.stacks = Math.min(ctx.line.amount ?? 75, stacks + (ctx.line.percent ?? 25))
    return weight
  },
}
export default handler
