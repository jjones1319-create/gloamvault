import type { CustomHandler } from './types.ts'

/**
 * Saboteur (Shade, Larceny III; docs/classes/shade.md §4.3): thrown pocketed traps deal +`percent`%. Trap Trick's
 * `pocket-trap` line records `flags['trapThrownAction:<heroId>']` = the action in which a trap was thrown; this
 * passive scales the holder's non-DoT hits during that action.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
  },
  outgoingDamagePercent: (ctx, _target, incoming) => (!incoming.isDot && ctx.state.flags[`trapThrownAction:${ctx.holder.id}`] === ctx.holder.tally.actions ? (ctx.line.percent ?? 0) : 0),
}
export default handler
