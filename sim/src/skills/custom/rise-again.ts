import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Shambling Corpse (06 §3.2): "the first time it reaches 0 HP it gets back up at 25% after one turn unless the killing
 * blow was Fire, Holy or a crit". A passive trigger (a zero-weight attack; explore.ts arms it at spawn): the first blow
 * that would fell it leaves it lying at 1 HP instead (`beforeDowned`), its timeline pushed back one normal action
 * (`energy`, −1,000) — the turn it spends getting up — and at its next turn start it stands at `percent` of its max HP.
 * A Fire or Holy blow fells it for good, and so does any blow while it lies there. Reading: the hook point cannot
 * see a crit, so a crit does not stop the rise.
 */
const STOPS = ['fire', 'holy']

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const corpse = target ?? ctx.holder
    if (corpse.side !== ctx.holder.side || !corpse.monster) return
    ctx.fx.installHook(corpse, ctx.line, corpse.id, { sourceSkillId: ctx.sourceId })
  },
  beforeDowned: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.used === true) return false
    hook.data.used = true
    if (STOPS.includes(incoming.damageType)) return false
    hook.data.down = true
    ctx.holder.energy += ctx.line.energy ?? -1000
    ctx.fx.log('rise', `${ctx.holder.name} falls — and twitches`, { actorId: ctx.holder.id })
    return true
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.down !== true) return
    hook.data.down = false
    const who = ctx.holder
    who.hp = Math.max(who.hp, Math.max(1, roundHalfUp((who.maxHp * (ctx.line.percent ?? 25)) / 100)))
    ctx.fx.log('rise', `${who.name} gets back up at ${who.hp} HP`, { actorId: who.id, amount: who.hp })
  },
}
export default handler
