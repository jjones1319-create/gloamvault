import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Red Thirst (Blade, Bloodletter I; docs/classes/blade.md §4.3): basic attacks heal the holder for `percent` of the
 * damage dealt. Reading: `modifyLine` sees every line the holder resolves with its source, so a `basic` source marks
 * the current action (the holder's action count) and `onDealtDamage` heals while that mark is current.
 */
const handler: CustomHandler = {
  modifyLine: (ctx, _line, source) => {
    if (ctx.hook && source.kind === 'basic') ctx.hook.data.basicAction = ctx.holder.tally.actions
    return null
  },
  onDealtDamage: (ctx, target, dealt) => {
    if (!ctx.hook || ctx.hook.data.basicAction !== ctx.holder.tally.actions) return
    const amount = roundHalfUp((dealt * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(ctx.holder, ctx.holder, amount)
    if (healed > 0) ctx.fx.log('lifesteal', `${ctx.holder.name} drinks ${healed}`, { actorId: ctx.holder.id, targetId: target.id, amount: healed })
  },
}
export default handler
