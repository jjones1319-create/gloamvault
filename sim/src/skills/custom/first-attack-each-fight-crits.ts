import type { CustomHandler } from './types.ts'

/**
 * Grinning Company's Cut, four pieces (08 §6): "Your first attack each fight is a guaranteed crit". The set bonus
 * sits on the hero as a persistent hook (hero.ts); `onFightStart` arms it (`data.armed`) and `forceCrit` spends it
 * on the first damage roll that can crit. A hook that never saw a fight start counts as armed.
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.armed = true
  },
  forceCrit: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.armed === false) return false
    hook.data.armed = false
    ctx.fx.log('setBonus', `${ctx.holder.name}'s first cut lands true`, { actorId: ctx.holder.id })
    return true
  },
}
export default handler
