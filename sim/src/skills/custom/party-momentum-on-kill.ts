import type { CustomHandler } from './types.ts'

/**
 * Glass Heart (Arcanist, Rime V; docs/classes/arcanist.md §4.2): if this action killed, every hero on the holder's
 * side gains `amount` Momentum (15; Mastery 25). The line follows the skill's hit (target self) and reads the holder's
 * damage events since its action marker, paying once when one of them carries `data.killed` (momentum-on-kill's
 * reading, for the whole party).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    const killed = log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.data?.killed === true)
    const amount = ctx.line.amount ?? 0
    if (!killed || amount <= 0) return
    for (const ally of ctx.fx.alliesOf(ctx.holder)) if (ally.kind === 'hero') ctx.fx.gainMomentum(ally, amount)
    ctx.fx.log('momentum', `The kill lifts the whole party (+${amount} Momentum)`, { actorId: ctx.holder.id, amount })
  },
}
export default handler
