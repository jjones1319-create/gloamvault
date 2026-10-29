import type { CustomHandler } from './types.ts'

/**
 * Rolling Bastion (Warden, Bulwark IV; docs/classes/warden.md §4.1): "your next 2 incoming hits are blocked
 * automatically". The line installs a hook whose counter is the blocks left (`amount`); it lasts until spent, or for
 * `duration` turns when the line names one. Reading: a block halves a physical hit (03 §2.2: Block is a physical
 * rule), so only physical, non-DoT, non-Ultimate hits spend it; as `block-first-physical-hits` does, the hook halves
 * the hit where Block would (`incomingDamagePercent` −50), counts it in `tally.blocks`, logs it and bumps the flag
 * `autoBlock:<holder id>` so Spiked Rim, Wall Stance and Crushing Rebuke treat it as a block. Unlike Bone Knight's
 * Stand it does not drop at the holder's next turn.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    const turns = ctx.line.duration
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, {
      sourceSkillId: ctx.sourceId,
      counter: Math.max(1, ctx.line.amount ?? 1),
      // A hook counts down at its holder's turn end; the casting turn's end must not eat a turn (as a fresh status).
      turnsLeft: turns === undefined ? null : turns + (ctx.state.actingId === holder.id ? 1 : 0),
    })
    ctx.fx.log('stance', `${holder.name} sets the shield for the next ${Math.max(1, ctx.line.amount ?? 1)} blows`, { actorId: holder.id })
  },
  incomingDamagePercent: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || !incoming.physical || incoming.isDot || incoming.isUltimate) return 0
    hook.counter -= 1
    const key = `autoBlock:${ctx.holder.id}`
    ctx.state.flags[key] = Number(ctx.state.flags[key] ?? 0) + 1
    ctx.holder.tally.blocks += 1
    ctx.fx.log('block', `${ctx.holder.name} blocks`, { actorId: ctx.holder.id, targetId: incoming.attacker?.id })
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
    return -50
  },
}
export default handler
