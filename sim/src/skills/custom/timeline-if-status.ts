import type { CustomHandler } from './types.ts'

/**
 * Stormcall (Arcanist, Evocation IV; docs/classes/arcanist.md §4.1): every target already holding `status` (Shock) is
 * moved `energy` on the timeline (−200; Mastery −300). The line comes before the skill's hit so it reads the status the
 * target held before this cast. Like the DSL's own `timeline` line, the push is not rank-scaled.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const status = ctx.line.status
    const energy = ctx.line.energy ?? 0
    if (!target || !status || energy === 0 || !ctx.fx.isActive(target) || !ctx.fx.hasStatus(target, status)) return
    target.energy += energy
    ctx.fx.log('timeline', `${target.name} is ${energy < 0 ? 'thrown back' : 'pulled forward'} (${status})`, { actorId: ctx.holder.id, targetId: target.id, amount: energy })
  },
}
export default handler
