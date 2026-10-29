import type { CustomHandler, HookContext } from './types.ts'

/**
 * Perfect Tempo (Blade, Iron Dance IV passive; docs/classes/blade.md §4.1): every `amount`-th (third; Mastery second)
 * active of the owner's school (Iron Dance) in a fight costs no pool. The hook counts the school's actives resolved
 * this fight (`data.count`, from `onSkillUsed`); `costPercent` answers −100 when the next one would be an
 * `amount`-th. The Ultimate is not an Iron Dance action. Note: the AI's and the command check's "can afford" tests read
 * the raw cost, so a hero below the raw cost will not pick the free action (as Vanish's free skill).
 */
function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

const handler: CustomHandler = {
  costPercent: (ctx, skill) => {
    const hook = ctx.hook
    const school = schoolOf(ctx)
    const every = Math.max(1, ctx.line.amount ?? 3)
    if (!hook || !school || skill.school !== school || skill.isUltimate || skill.type !== 'active') return 0
    return (Number(hook.data.count ?? 0) + 1) % every === 0 ? -100 : 0
  },
  onSkillUsed: (ctx, skill) => {
    const hook = ctx.hook
    const school = schoolOf(ctx)
    if (!hook || !school || skill.school !== school || skill.isUltimate || skill.type !== 'active') return
    const count = Number(hook.data.count ?? 0) + 1
    hook.data.count = count
    if (count % Math.max(1, ctx.line.amount ?? 3) === 0) ctx.fx.log('free', `${ctx.holder.name} finds the tempo: ${skill.name} costs nothing`, { actorId: ctx.holder.id })
  },
}
export default handler
