import type { CustomHandler } from './types.ts'

/**
 * Crimson Crescendo (Blade Ultimate; docs/classes/blade.md §3): if the main target dies, Momentum is set to `amount`
 * after the Ultimate instead of 0. Reading: the main target is the target of the first hit this action (the first
 * damage/miss event after the holder's `action` entry); the Ultimate's cost was already paid, so the floor is applied
 * now and the act's own Momentum gain still lands on top.
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
    const first = log.slice(start + 1).find((e) => e.actorId === holder.id && (e.kind === 'damage' || e.kind === 'miss'))
    if (!first?.targetId) return
    const main = ctx.state.actors.find((a) => a.id === first.targetId)
    const dead = first.data?.killed === true || (main !== undefined && main.side !== holder.side && (main.gone || main.hp <= 0))
    if (!dead) return
    const floor = ctx.line.amount ?? 0
    if (holder.momentum < floor) {
      holder.momentum = floor
      ctx.fx.log('momentum', `${holder.name}'s crescendo carries on (${floor} Momentum)`, { actorId: holder.id, amount: floor })
    }
  },
}
export default handler
