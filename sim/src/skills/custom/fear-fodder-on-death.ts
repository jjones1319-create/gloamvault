import type { CustomHandler } from './types.ts'

/**
 * Commander (elite affix, 06 §2), second line: killing the champion applies `status` (Fear) for `duration` to every
 * fodder-role ally still standing. Installed on the champion at spawn (explore.ts).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onDeath: (ctx) => {
    const status = ctx.line.status ?? 'fear'
    const fodder = ctx.fx.alliesOf(ctx.holder).filter((a) => a !== ctx.holder && a.monster?.role === 'fodder')
    if (fodder.length === 0) return
    ctx.fx.log('commanderFalls', `${ctx.holder.name} falls and the rabble quails`, { actorId: ctx.holder.id })
    for (const a of fodder) ctx.fx.applyStatus(a, { status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
