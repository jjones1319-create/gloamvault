import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Vaultbreaker (Arcanist, Evocation V; docs/classes/arcanist.md §4.1): after the main hit the bolt chains `multiplier`
 * × the holder's Attack for `damageType` (Lightning) to every other enemy holding `status` (Shock). The chain hits
 * never miss and may crit; the main target (the line's own target) is skipped.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    const status = ctx.line.status
    if (!target || !status) return
    const type = ctx.line.damageType ?? 'lightning'
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
    if (amount <= 0) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'chain'
    for (const e of ctx.fx.enemiesOf(ctx.holder)) {
      if (e === target || !ctx.fx.hasStatus(e, status)) continue
      ctx.fx.strike(ctx.holder, e, { amount, damageType: type, label: `${label} (chain)`, canMiss: false, canCrit: true, isMelee: false })
    }
  },
}
export default handler
