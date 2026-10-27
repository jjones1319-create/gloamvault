import type { CustomHandler, HookContext } from './types.ts'

function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

/**
 * Vanish (Shade, Larceny II; docs/classes/shade.md §4.3): the holder's next `amount` skill(s) of this skill's school
 * cost 0. The hook answers `costPercent` −100 for an active of the school and `onSkillUsed` spends one per such
 * skill — never for the cast that installed it (same action). Note: the AI's and the command check's "can afford"
 * tests read the raw cost, so a hero below the raw cost will not pick the free skill.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const school = schoolOf(ctx) ?? 'school'
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, counter: Math.max(1, ctx.line.amount ?? 1), data: { action: ctx.holder.tally.actions } })
    ctx.fx.log('free', `${ctx.holder.name}'s next ${school} skill costs nothing`, { actorId: ctx.holder.id })
  },
  costPercent: (ctx, skill) => {
    const hook = ctx.hook
    const school = schoolOf(ctx)
    if (!hook || hook.counter <= 0 || !school || skill.school !== school || skill.isUltimate || skill.type !== 'active') return 0
    return -100
  },
  onSkillUsed: (ctx, skill) => {
    const hook = ctx.hook
    const school = schoolOf(ctx)
    if (!hook || hook.counter <= 0 || hook.data.action === ctx.holder.tally.actions) return
    if (!school || skill.school !== school || skill.isUltimate || skill.type !== 'active') return
    hook.counter -= 1
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
  },
}
export default handler
