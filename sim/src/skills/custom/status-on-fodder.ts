import type { CustomHandler } from './types.ts'

/** Dread Bellow (Warden, Warcry II; docs/classes/warden.md §4.3): `status` (Fear) lands only on fodder-role enemies, for `duration` turns. */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || target.monster?.role !== 'fodder' || !ctx.fx.isActive(target)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
