import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

function frozen(target: Actor): boolean {
  return target.statuses.some((s) => s.id === 'freeze')
}

/**
 * Avalanche (Arcanist, Rime III; docs/classes/arcanist.md §4.2): this skill's damage shatters Frozen targets as
 * Shatter does (+30%, crit, Freeze ends, −300 energy) even when no ally holds the passive. The line is the skill's
 * first; it installs a one-cast hook on the caster that mirrors `party-shatter-bonus` and goes when the skill
 * finishes (or at the caster's next turn start). When the caster already carries the Shatter passive, that hook pays
 * the bonus and this one only affirms the crit, so nothing doubles. The numbers fall back to the rule's 30 / −300
 * when the line names none.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true })
  },
  outgoingDamagePercent: (ctx, target, incoming) => {
    if (incoming.isDot || !frozen(target)) return 0
    if (ctx.holder.hooks.some((h) => h.customId === 'party-shatter-bonus')) return 0
    return ctx.line.percent ?? 30
  },
  forceCrit: (_ctx, target) => frozen(target),
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (incoming.isDot) return
    const freeze = target.statuses.find((s) => s.id === 'freeze')
    if (!freeze) return
    target.statuses = target.statuses.filter((s) => s !== freeze)
    target.energy += ctx.line.energy ?? -300
    ctx.fx.log('shatter', `${target.name} shatters`, { actorId: ctx.holder.id, targetId: target.id })
  },
  onSkillUsed: (ctx, skill) => {
    if (ctx.hook && skill.id === ctx.hook.sourceSkillId) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
