import type { CustomHandler } from './types.ts'

/**
 * Envenom (Shade, Venom II; docs/classes/shade.md §4.2): the holder's next `amount` hits apply `status` for
 * `duration` turns (mastery: five hits). Every non-DoT hit that dealt damage counts, chain strikes included. The
 * status goes through the line interpreter so Steeped Blades' duration bonus applies.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, counter: Math.max(1, ctx.line.amount ?? 1) })
    ctx.fx.log('oil', `${holder.name} coats the blades (${ctx.line.status ?? 'poison'}, ${Math.max(1, ctx.line.amount ?? 1)} hits)`, { actorId: holder.id })
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || incoming.isDot || !ctx.line.status || !ctx.fx.isActive(target)) return
    hook.counter -= 1
    const skill = ctx.content.skills.get(hook.sourceSkillId ?? '')
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: skill?.id ?? 'envenom', label: skill?.name ?? 'Envenom', neverMisses: true, isMelee: false })
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
  },
}
export default handler
