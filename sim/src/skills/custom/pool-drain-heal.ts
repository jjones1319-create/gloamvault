import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Leech (elite affix, 06 §2): each hit drains `percent` of the target's current pool (Stamina or Mana by class)
 * and heals the champion by that many HP. Installed on the champion at spawn (explore.ts). Pets and monsters have
 * no pool, so a hit on them drains nothing; DoT ticks never drain.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (incoming.isDot || target.poolKind === null || target.pool <= 0) return
    const drain = roundHalfUp((target.pool * (ctx.line.percent ?? 0)) / 100)
    if (drain <= 0) return
    target.pool -= drain
    const healed = ctx.fx.heal(ctx.holder, ctx.holder, drain)
    ctx.fx.log('leech', `${ctx.holder.name} drains ${drain} ${target.poolKind} from ${target.name}${healed > 0 ? ` and heals ${healed}` : ''}`, { actorId: ctx.holder.id, targetId: target.id, amount: drain, data: { healed } })
  },
}
export default handler
