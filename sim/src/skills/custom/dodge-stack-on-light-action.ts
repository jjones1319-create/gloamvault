import type { CustomHandler } from './types.ts'

/**
 * Flowing Guard (Blade, Iron Dance I; docs/classes/blade.md §4.1): after each 800-weight action +`amount` Dodge,
 * stacking up to `percent`; any heavier (or lighter) action drops the stacks.
 * Reading: a hook cannot buff its own holder's stats, so the stacks sit on the holder as one StatModifier (sourceId
 * `flowing-guard:<skill>`) rebuilt in `modifyWeight`, the moment the action's weight is spent; it lasts two
 * count-downs so it covers the enemy phase until the holder's next turn ends. The weight read is the action's own
 * before other hooks (Quickstep) change it.
 */
const handler: CustomHandler = {
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    const per = ctx.line.amount ?? 5
    const cap = ctx.line.percent ?? 15
    const maxStacks = per > 0 ? Math.floor(cap / per) : 0
    const stacks = weight === ctx.t.combat.weights.light ? Math.min(maxStacks, Number(hook.data.stacks ?? 0) + 1) : 0
    hook.data.stacks = stacks
    const src = `flowing-guard:${hook.sourceSkillId ?? hook.sourceId}`
    const holder = ctx.holder
    holder.modifiers = holder.modifiers.filter((m) => m.sourceId !== src)
    if (stacks > 0) holder.modifiers.push({ stat: 'dodge', amount: Math.min(cap, stacks * per), percent: 0, turnsLeft: 2, sourceId: src })
    return weight
  },
}
export default handler
