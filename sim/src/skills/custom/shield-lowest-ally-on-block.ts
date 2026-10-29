import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * The Shieldbrother's Kite (08 §7): "on block: Shield (absorb 5% max HP) on the lowest ally". The hook sits on the
 * wearer (hero.ts); each natural block puts a Shield worth `percent` of the lowest-HP ally's own max HP (03 §3.5: a
 * Shield absorbs a share of the holder's max HP) on that ally — the wearer too, when it is the lowest.
 */
const handler: CustomHandler = {
  onBlock: (ctx) => {
    let low: typeof ctx.holder | null = null
    for (const a of ctx.fx.alliesOf(ctx.holder)) {
      if (!ctx.fx.isActive(a)) continue
      if (low === null || a.hp * low.maxHp < low.hp * a.maxHp) low = a
    }
    if (low === null) return
    const amount = roundHalfUp((low.maxHp * (ctx.line.percent ?? 5)) / 100)
    if (amount <= 0) return
    const r = ctx.fx.applyStatus(low, { status: 'shield', magnitude: amount }, ctx.holder.id)
    if (r === 'applied') ctx.fx.log('shield', `${ctx.holder.name}'s block covers ${low.name} (${amount})`, { actorId: ctx.holder.id, targetId: low.id, amount })
  },
}
export default handler
