import type { CustomHandler } from './types.ts'

/**
 * The Cutpurse's purse breaks (06 §3.1 part-break: "drops its gold at once"). Runs with the monster as holder and
 * target: every `steal-party-gold` take it holds goes back to the party now (`state.counters.goldStolen` falls by
 * it) and the hooks are removed, so a thief that flees afterwards leaves with nothing.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const thief = ctx.holder
    let returned = 0
    for (const hook of thief.hooks.filter((h) => h.customId === 'steal-party-gold')) {
      returned += Number(hook.data.stolen ?? 0)
      ctx.fx.removeHook(thief, hook)
    }
    if (returned > 0) ctx.state.counters.goldStolen = Math.max(0, ctx.state.counters.goldStolen - returned)
    ctx.fx.log('goldReturned', `${thief.name}'s purse spills${returned > 0 ? `: ${returned} gold` : ''}`, { actorId: thief.id, amount: returned })
  },
}
export default handler
