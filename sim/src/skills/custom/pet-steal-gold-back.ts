import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Rat Prince's Nibble (pet active, 06 §9), second line: returns `percent` of the gold the target has stolen from
 * the party this fight; nothing against a target holding none. Reading: the fight tracks stolen gold as one net
 * counter (`state.counters.goldStolen`, what the bandits still hold), not per thief, so the nibble takes `percent`
 * of that net back whenever the target is a monster and anything is held.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target?.monster) return
    const held = ctx.state.counters.goldStolen
    if (held <= 0) return
    const back = roundHalfUp((held * (ctx.line.percent ?? 0)) / 100)
    if (back <= 0) return
    ctx.state.counters.goldStolen = held - back
    ctx.fx.log('goldBack', `${ctx.holder.name} nibbles ${back} gold back from ${target.name}`, { actorId: ctx.holder.id, targetId: target.id, amount: back })
  },
}
export default handler
