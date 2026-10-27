import type { CustomHandler } from './types.ts'

/**
 * Blade Rhythm (Blade, Iron Dance II; docs/classes/blade.md §4.1): each consecutive active of the owner's school
 * deals +`percent` per stack of the actives before it (the second gets one stack), up to `amount` stacks; a basic
 * attack or any other action resets the count. `modifyLine` reads the action's source (and scales its damage lines
 * by the stacks held), `modifyWeight` closes the action and moves the count. Thousand Steps reads `data.stacks`.
 */
const handler: CustomHandler = {
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    if (!hook) return null
    const school = ctx.content.skills.get(hook.sourceSkillId ?? '')?.school ?? ''
    const actionSchool = source.kind === 'skill' ? (ctx.content.skills.get(source.id)?.school ?? '') : ''
    hook.data.actionNo = ctx.holder.tally.actions
    hook.data.actionSchool = actionSchool
    const stacks = Number(hook.data.stacks ?? 0)
    if (line.kind !== 'damage' || !school || actionSchool !== school || stacks <= 0) return null
    return { ...line, multiplier: (line.multiplier ?? 1) * (1 + (stacks * (ctx.line.percent ?? 0)) / 100) }
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    const school = ctx.content.skills.get(hook.sourceSkillId ?? '')?.school ?? ''
    const inSchool = Number(hook.data.actionNo ?? -1) === ctx.holder.tally.actions && hook.data.actionSchool === school && school !== ''
    hook.data.stacks = inSchool ? Math.min(ctx.line.amount ?? 3, Number(hook.data.stacks ?? 0) + 1) : 0
    return weight
  },
}
export default handler
