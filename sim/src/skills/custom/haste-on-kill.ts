import type { CustomHandler } from './types.ts'

/**
 * Tidebound Reaver's Mail, four pieces (08 §6): "Haste 1 round on a kill". The hook sits on the wearer (hero.ts);
 * each kill the holder lands gives it the line's `status` (Haste) for `duration` (1) turns.
 */
const handler: CustomHandler = {
  onKill: (ctx) => {
    const r = ctx.fx.applyStatus(ctx.holder, { status: ctx.line.status ?? 'haste', duration: ctx.line.duration ?? 1 }, ctx.holder.id)
    if (r === 'applied') ctx.fx.log('setBonus', `${ctx.holder.name} surges on the kill`, { actorId: ctx.holder.id })
  },
}
export default handler
