import type { CustomHandler } from './types.ts'

/**
 * Trap Trick (Shade, Larceny II; docs/classes/shade.md §4.3). Out of combat: pockets a trap the party disarmed,
 * holding up to `amount` (resolved by delve.ts, which keeps the count and must seed it into the fight as
 * `flags['pocketedTraps:<heroId>']`). In combat: the skill throws one — this line is the skill's first, so when the
 * pocket is seeded and empty it installs a one-cast hook whose `modifyLine` skips the skill's remaining lines; when
 * a trap is thrown it records `flags['trapThrownAction:<heroId>']` = the action for Saboteur's bonus. Reading: an
 * unseeded pocket (the delve not yet wired, the balance runner) reads as holding a trap, so the throw always lands.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    const key = `pocketedTraps:${holder.id}`
    const have = ctx.state.flags[key]
    const n = have === undefined ? 1 : Number(have)
    if (n <= 0) {
      ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, data: { skip: true } })
      ctx.fx.log('noTrap', `${holder.name} has no trap to throw`, { actorId: holder.id })
      return
    }
    if (have !== undefined) ctx.state.flags[key] = n - 1
    ctx.state.flags[`trapThrownAction:${holder.id}`] = holder.tally.actions
    ctx.fx.log('throw', `${holder.name} throws a pocketed trap`, { actorId: holder.id })
  },
  modifyLine: (ctx, _line, source) => (ctx.hook?.data.skip === true && source.id === ctx.hook.sourceSkillId ? 'skip' : null),
  onSkillUsed: (ctx, skill) => {
    if (ctx.hook?.data.skip === true && skill.id === ctx.hook.sourceSkillId) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
