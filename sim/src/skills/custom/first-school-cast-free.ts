import type { CustomHandler, HookContext } from './types.ts'

/**
 * Kindling (Arcanist, Evocation I; docs/classes/arcanist.md §4.1): the holder's first cast of this skill's school
 * each fight costs 0 pool. `costPercent` answers −100 until a cast of the school resolves; `onSkillUsed` marks it in
 * `state.flags`. The Ultimate costs Momentum, not pool, and neither takes nor spends the free cast.
 */
function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
  },
  costPercent: (ctx, skill) => {
    const school = schoolOf(ctx)
    if (!school || skill.school !== school || skill.isUltimate) return 0
    return ctx.state.flags[`firstCastFree:${ctx.holder.id}:${school}`] ? 0 : -100
  },
  onSkillUsed: (ctx, skill) => {
    const school = schoolOf(ctx)
    if (!school || skill.school !== school || skill.isUltimate || skill.type !== 'active') return
    const key = `firstCastFree:${ctx.holder.id}:${school}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('freeCast', `${ctx.holder.name}'s first ${school} cast costs nothing`, { actorId: ctx.holder.id })
  },
}
export default handler
