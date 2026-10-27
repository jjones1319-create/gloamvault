import type { CustomHandler, HookContext } from './types.ts'

function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

/**
 * Skills of this skill's school deal +`percent`%: Kindling (Evocation: Fire and Lightning), Permafrost (Rime: Frost),
 * Consecration (Mender, Sanctity: Holy). `modifyLine` sees every line's source before it resolves and notes whether
 * the current skill belongs to the school; `outgoingDamagePercent` scales the holder's non-DoT hits while it does
 * (chain strikes a skill's own hooks deal included). Basic attacks are never in a school.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
  },
  modifyLine: (ctx, _line, source) => {
    const hook = ctx.hook
    if (!hook) return null
    const school = schoolOf(ctx)
    const skill = source.kind === 'skill' ? ctx.content.skills.get(source.id) : undefined
    hook.data.inSchool = school !== null && skill?.school === school
    hook.data.action = ctx.holder.tally.actions
    return null
  },
  outgoingDamagePercent: (ctx, _target, incoming) => (!incoming.isDot && ctx.hook?.data.inSchool === true && ctx.hook.data.action === ctx.holder.tally.actions ? (ctx.line.percent ?? 0) : 0),
}
export default handler
