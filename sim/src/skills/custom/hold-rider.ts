import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * What a hold does to the held each of the holder's turns (06 §3.3: the Deep Tentacle's Drag Under — "the grabbed
 * hero also takes Chill each of the tentacle's turns"; the Deep Maw's Swallow — "they take ×0.5 Frost per Maw turn").
 * The grabbing attack's rider installs this on the holder; at each of its turn starts every enemy it holds (Grab
 * from it) takes `status` (`duration`) and/or `multiplier` × its Attack of `damageType` (no miss, no crit). It does
 * nothing while the holder holds no one.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    if (holder.hooks.some((h) => h.customId === 'hold-rider' && h.sourceId === holder.id && h.line.status === ctx.line.status && h.line.multiplier === ctx.line.multiplier)) return
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId, replace: false })
  },
  onTurnStart: (ctx) => {
    const holder = ctx.holder
    for (const held of ctx.state.actors.filter((a) => a.grabbedBy === holder.id && ctx.fx.isActive(a))) {
      if (ctx.line.multiplier) {
        const type = ctx.line.damageType ?? 'frost'
        ctx.fx.strike(holder, held, { amount: roundHalfUp(ctx.fx.attackFor(holder, type) * ctx.line.multiplier), damageType: type, label: 'the hold', canMiss: false, canCrit: false, isMelee: false })
      }
      if (ctx.line.status && ctx.fx.isActive(held)) ctx.fx.applyStatus(held, { status: ctx.line.status, duration: ctx.line.duration }, holder.id)
    }
  },
}
export default handler
