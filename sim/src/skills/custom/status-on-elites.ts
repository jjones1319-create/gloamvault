import type { CustomHandler } from './types.ts'

/** Dread Bellow, Mastery (Warden, Warcry II; docs/classes/warden.md §4.3): `status` (Fear) also lands on elite-role enemies for `duration` turns. */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || target.monster?.role !== 'elite' || !ctx.fx.isActive(target)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
