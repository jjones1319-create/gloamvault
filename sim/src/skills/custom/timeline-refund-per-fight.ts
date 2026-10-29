import type { CustomHandler } from './types.ts'

/**
 * Quicksilver (Blade, Iron Dance IV; docs/classes/blade.md §4.1): "Act again immediately: refund 800 energy to your
 * accumulator; once per fight" (Mastery: twice). The line gives the holder `energy` (800) back on the timeline, at
 * most `amount` times per fight (flag `refund:<holder id>:<skill id>`); the 800-weight action that cast it is then
 * paid back, so the holder is next on the strip. At the limit it marks itself spent (`once:<skill>:<holder>`), so the
 * fight stops offering it (fight.ts idleSkillReason); a use past the limit still resolves and logs that nothing came back.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    const key = `refund:${holder.id}:${ctx.sourceId ?? 'skill'}`
    const used = Number(ctx.state.flags[key] ?? 0)
    if (used >= Math.max(1, ctx.line.amount ?? 1)) {
      ctx.fx.log('nothing', `${holder.name} reaches for the moment again, but it has passed`, { actorId: holder.id })
      return
    }
    ctx.state.flags[key] = used + 1
    if (used + 1 >= Math.max(1, ctx.line.amount ?? 1)) ctx.state.flags[`once:${ctx.sourceId ?? 'skill'}:${holder.id}`] = true
    holder.energy += ctx.line.energy ?? 0
    ctx.fx.log('quicksilver', `${holder.name} moves again before anyone can answer`, { actorId: holder.id, amount: ctx.line.energy ?? 0 })
  },
}
export default handler
