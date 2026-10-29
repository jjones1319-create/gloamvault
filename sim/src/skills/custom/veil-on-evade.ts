import type { CustomHandler } from './types.ts'

/**
 * Second Shadow (Shade, Shadow IV; docs/classes/shade.md §4.1): whenever an attack on the holder misses or is dodged,
 * the holder gains Veil until its next action.
 * Reading: "misses or is dodged" is the attacker's hit roll failing (`onDodge`: Dodge, Blind and the Accuracy floor
 * all land there); a blow a Veil or a decoy turned away was never a failed roll. The Veil lasts 1 turn — gained on an
 * enemy's turn it ends at the holder's next turn end, and the holder's attack ends it sooner (the status's rule), so
 * the next attack is a strike from Veil. (The Mastery's +10 Momentum is `momentum-on-dodge`.)
 */
const handler: CustomHandler = {
  onDodge: (ctx) => {
    const holder = ctx.holder
    if (!ctx.fx.isActive(holder) || ctx.fx.hasStatus(holder, 'veil')) return
    const r = ctx.fx.applyStatus(holder, { status: 'veil', duration: 1 }, holder.id)
    if (r === 'applied') ctx.fx.log('secondShadow', `${holder.name} slips into the shadow the miss left`, { actorId: holder.id })
  },
}
export default handler
