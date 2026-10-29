import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Tidebound Reaver's Mail, four pieces (08 §6): "basic attacks restore +10% Stamina" — on top of a basic attack's own
 * 15% (03 §2.2). The hook sits on the wearer (hero.ts). Reading: no joint names a basic attack, but every line of one
 * resolves with `source.kind === 'basic'`, so `modifyLine` restores `percent` of the holder's Stamina once per attack
 * (a paired-weapon attack's two lines count once) and leaves the line alone. A Mana user's pool is not Stamina.
 */
const handler: CustomHandler = {
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    const h = ctx.holder
    if (source.kind !== 'basic' || line.kind !== 'damage' || h.poolKind !== 'stamina') return null
    if (hook) {
      if (hook.data.basicAction === h.tally.actions) return null
      hook.data.basicAction = h.tally.actions
    }
    const amount = roundHalfUp((h.poolMax * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return null
    h.pool = clamp(h.pool + amount, 0, h.poolMax)
    ctx.fx.log('setBonus', `${h.name}'s Reaver mail drinks the swing (+${amount} Stamina)`, { actorId: h.id, amount })
    return null
  },
}
export default handler
