import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Nullfield (Arcanist, Arcana V; docs/classes/arcanist.md §4.3): every Shield on the caster's side absorbs
 * +`percent`% (100: doubled) of what it has left. The line targets the caster (once per cast) and walks its allies,
 * pets and summons included; a Shield's absorb is its status magnitude (statuses.ts, shield-absorb).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const pct = ctx.line.percent ?? 100
    let n = 0
    for (const ally of ctx.fx.alliesOf(ctx.holder)) {
      for (const s of ally.statuses) {
        if (s.id !== 'shield' || s.magnitude <= 0) continue
        s.magnitude = roundHalfUp((s.magnitude * (100 + pct)) / 100)
        n += 1
      }
    }
    ctx.fx.log('nullfield', n > 0 ? `${n} Shield${n === 1 ? '' : 's'} on ${ctx.holder.name}'s side grow${n === 1 ? 's' : ''} (+${pct}%)` : 'No Shield to strengthen', { actorId: ctx.holder.id, amount: n })
  },
}
export default handler
