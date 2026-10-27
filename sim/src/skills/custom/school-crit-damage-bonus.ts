import type { CustomHandler, HookContext } from './types.ts'

function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

/**
 * Overcharge (Arcanist, Evocation III; docs/classes/arcanist.md §4.1): crits by skills of this skill's school deal
 * +`amount` pp Crit Damage. Reading: there is no crit-damage joint, so while a skill of the school resolves the hook
 * keeps a one-turn Crit Damage modifier on the caster (added before the skill's first line, removed when the skill
 * finishes); the crit formula reads it and only crits feel it.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
  },
  modifyLine: (ctx, _line, source) => {
    const hook = ctx.hook
    if (!hook) return null
    const key = `overcharge:${hook.sourceSkillId ?? 'crit'}`
    const school = schoolOf(ctx)
    const skill = source.kind === 'skill' ? ctx.content.skills.get(source.id) : undefined
    const inSchool = school !== null && skill?.school === school
    const has = ctx.holder.modifiers.some((m) => m.sourceId === key)
    if (inSchool && !has) ctx.holder.modifiers.push({ stat: 'critDamage', amount: ctx.line.amount ?? 0, percent: 0, turnsLeft: 1, sourceId: key })
    else if (!inSchool && has) ctx.holder.modifiers = ctx.holder.modifiers.filter((m) => m.sourceId !== key)
    return null
  },
  onSkillUsed: (ctx) => {
    const key = `overcharge:${ctx.hook?.sourceSkillId ?? 'crit'}`
    ctx.holder.modifiers = ctx.holder.modifiers.filter((m) => m.sourceId !== key)
  },
}
export default handler
