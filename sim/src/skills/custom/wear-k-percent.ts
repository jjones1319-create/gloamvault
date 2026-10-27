import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Enduring (08 §5): "wear k +10–15% / 15–25% / 25–40% (slower wear) on this item". The hook sits on the wearer
 * (hero.ts) with `data.slot` = the slot the item is in. A k that is (100 + p)% of normal means each wear event is
 * worth 100 / (100 + p) of one, so `wearPercent` returns −(p × 100 / (100 + p)) for events of the item's kind.
 * Reading: the fight's wear events carry a percent only for armor (fight.ts `wearPercentFor`), and the armor piece
 * hit is drawn after the percent, so an Enduring armor piece slows every armor event a little instead of its own a
 * lot; weapon and shield events are not scaled until fight.ts passes their percent. The exact per-item path is
 * progress.ts reading the item's own k (not this module's).
 */
const ARMOR = new Set(['helmet', 'chest', 'legs', 'boots', 'gloves'])

const handler: CustomHandler = {
  wearPercent: (ctx, kind) => {
    const slot = String(ctx.hook?.data.slot ?? '')
    const match = kind === 'armor' ? ARMOR.has(slot) : kind === 'weapon' ? slot === 'mainHand' || slot === 'offHand' : slot === 'offHand'
    if (!match) return 0
    const p = ctx.line.percent ?? 0
    return p > 0 ? -roundHalfUp((p * 100) / (100 + p)) : 0
  },
}
export default handler
