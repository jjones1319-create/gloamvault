import type { CustomHandler } from './types.ts'

/**
 * Time Slip (Arcanist, Arcana III; docs/classes/arcanist.md §4.3): a charging caster loses its cast. The pending
 * action is dropped; the 400 energy already paid into the charge stays spent (D-029).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target?.charging) return
    target.charging = null
    ctx.fx.log('castLost', `${target.name} loses the cast`, { actorId: ctx.holder.id, targetId: target.id })
  },
}
export default handler
