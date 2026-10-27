import type { CustomHandler } from './types.ts'

/**
 * Wind-up (Blade, Executioner I; docs/classes/blade.md §4.2): the holder's next active of the owner's school deals
 * +`percent`. The line installs a hook; `modifyLine` scales every damage line of the first later action whose source
 * is such a skill, and `onSkillUsed` drops the hook when that skill has resolved. A second Wind-up replaces the
 * first (no stacking).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { since: ctx.holder.tally.actions } })
  },
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    if (!hook || line.kind !== 'damage' || source.kind !== 'skill' || Number(hook.data.since) === ctx.holder.tally.actions) return null
    const skill = ctx.content.skills.get(source.id)
    const school = ctx.content.skills.get(hook.sourceSkillId ?? '')?.school
    if (!skill || skill.type !== 'active' || !school || skill.school !== school) return null
    hook.data.spent = ctx.holder.tally.actions
    return { ...line, multiplier: (line.multiplier ?? 1) * (1 + (ctx.line.percent ?? 0) / 100) }
  },
  onSkillUsed: (ctx) => {
    const hook = ctx.hook
    if (hook && Number(hook.data.spent ?? -1) === ctx.holder.tally.actions) ctx.fx.removeHook(ctx.holder, hook)
  },
}
export default handler
