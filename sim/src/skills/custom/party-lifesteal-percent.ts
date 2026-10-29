import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Sanguine Pact (Blade, Bloodletter V; docs/classes/blade.md §4.3): "Every ally heals 15% of their damage dealt for 3
 * turns" (Mastery 4). The line (target: every ally) installs a hook on each for `duration` of its own turns (one more
 * on the caster, whose casting turn's end would otherwise take one, as a fresh status keeps its full duration); each
 * hit the holder deals heals it for `percent`% of the damage dealt. Unlike the Vampiric affix (`lifesteal-percent`) it
 * is not halved against a Burned target.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    const turns = ctx.line.duration ?? 3
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns + (ctx.state.actingId === holder.id ? 1 : 0) })
  },
  onDealtDamage: (ctx, target, dealt) => {
    const amount = roundHalfUp((dealt * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(ctx.holder, ctx.holder, amount)
    if (healed > 0) ctx.fx.log('lifesteal', `${ctx.holder.name} drinks ${healed}`, { actorId: ctx.holder.id, targetId: target.id, amount: healed })
  },
}
export default handler
