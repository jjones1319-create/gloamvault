import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Drink Deep, Ghoul's Grasp, Crimson Field (Blade, Bloodletter; docs/classes/blade.md §4.3): the holder heals
 * `percent` of the damage this skill dealt. Reading: sums the holder's `damage` events since its `action` entry
 * (every hit of the skill, including hits its other hooks struck).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === holder.id) {
        start = i
        break
      }
    }
    let total = 0
    for (const e of log.slice(start + 1)) if (e.kind === 'damage' && e.actorId === holder.id) total += e.amount ?? 0
    const amount = roundHalfUp((total * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(holder, holder, amount)
    if (healed > 0) ctx.fx.log('heal', `${holder.name} drinks deep for ${healed}`, { actorId: holder.id, targetId: holder.id, amount: healed })
  },
}
export default handler
