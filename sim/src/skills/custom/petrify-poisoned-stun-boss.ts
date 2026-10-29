import type { CustomHandler } from './types.ts'

/**
 * Widow's Kiss (Shade, Venom V; docs/classes/shade.md §4.2): `status` (Petrify, −1,000 energy) for `duration` turn(s)
 * if the target is Poisoned (`amount` 1, the Mastery: any target); a boss takes Stun 1 turn instead.
 * Reading: the line follows the hit and needs it to have landed this action (D-093: a status rides on its hit). A
 * boss's Stun goes through the status table, which turns a boss's Stun into a Daze (03 §3.5 owns statuses — the
 * reading D-073 took for Frozen Tomb's boss line).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target.side === ctx.holder.side || !ctx.fx.isActive(target)) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    if (!log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId === target.id)) return
    if (target.monster?.isBoss) {
      ctx.fx.applyStatus(target, { status: 'stun', duration: 1 }, ctx.holder.id)
      return
    }
    if ((ctx.line.amount ?? 0) !== 1 && !ctx.fx.hasStatus(target, 'poison')) return
    ctx.fx.applyStatus(target, { status: ctx.line.status ?? 'petrify', duration: Math.max(1, ctx.line.duration ?? 1) }, ctx.holder.id)
  },
}
export default handler
