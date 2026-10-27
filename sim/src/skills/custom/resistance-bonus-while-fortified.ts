import type { CustomHandler } from './types.ts'

/**
 * Steadfast (Mender passive, Vigil II; docs/classes/mender.md §4.3), first line: while the holder is in the fight,
 * allies holding Fortify have +`amount` pp Resistance. Installed as a hook by hero.ts; statOf() reads the aura from
 * a living ally's hooks. Reading: the aura joint is percent-only and may not read stats, so +10 pp is granted as
 * +10% of the ally's Resistance; note statuses.ts resistChance reads `base.resistance`, so until it reads statOf()
 * the aura moves the card's number, not the resist roll.
 */
const handler: CustomHandler = {
  auraStatPercent: (ctx, ally, stat) => {
    if (stat !== 'resistance' || ally.side !== ctx.holder.side) return 0
    return ally.statuses.some((s) => s.id === 'fortify') ? (ctx.line.amount ?? 0) : 0
  },
}
export default handler
