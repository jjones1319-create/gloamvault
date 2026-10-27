import type { CustomHandler } from './types.ts'

/**
 * Smoke Pellet (Shade, Larceny I; docs/classes/shade.md §4.3): the party's Flee chance is +`amount` pp for `duration`
 * turns. The line installs the hook on every ally; fight.ts doFlee adds the best single bonus among the party's hooks.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 1 })
  },
}
export default handler
