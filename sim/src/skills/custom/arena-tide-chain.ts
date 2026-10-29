import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Naesa's tide at step 3 (07 §2.8: "every Lightning attack chains to both rows"). Installed by sim/src/arena.ts on
 * every actor in the chapel. When a single-target Lightning blow lands on the holder while the water stands at the
 * `tide` rule's `params.chainAt` or higher, `params.chainPercent` of what it dealt runs through the water into every
 * other actor on the holder's side, both rows (no roll, no crit, after Defense: the blow's own mitigation stands).
 * `state.arena.flags.chaining` keeps the chain from chaining itself.
 */
const handler: CustomHandler = {
  afterHit: (ctx, incoming, dealt) => {
    const arena = ctx.state.arena
    const attacker = incoming.attacker
    if (!arena?.tide || !attacker || incoming.isDot || !incoming.isSingleTarget || incoming.damageType !== 'lightning' || arena.flags.chaining === true) return
    const rule = (ctx.content.monsters.get(arena.bossId)?.boss?.arena?.rules ?? []).find((r) => r.kind === 'tide')
    const at = typeof rule?.params?.chainAt === 'number' ? rule.params.chainAt : 99
    if (arena.tide.level < at) return
    const pct = typeof rule?.params?.chainPercent === 'number' ? rule.params.chainPercent : 50
    const amount = roundHalfUp((dealt * pct) / 100)
    if (amount <= 0) return
    arena.flags.chaining = true
    for (const other of ctx.fx.alliesOf(ctx.holder)) {
      if (other === ctx.holder) continue
      ctx.fx.strike(attacker, other, { amount, damageType: 'lightning', label: 'the chain through the water', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
    }
    delete arena.flags.chaining
  },
}
export default handler
