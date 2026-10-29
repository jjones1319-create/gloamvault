import type { CustomHandler } from './types.ts'

/**
 * Pearl Ooze (06 §3.3): "leaves the fight after 3 of its turns (tell: a countdown on its nameplate) … Root or Slow
 * stops the countdown; a kill drops its whole stack". A passive trigger (a zero-weight attack, armed at spawn): each
 * of its turn starts counts one unless it is Rooted or Slowed; at its turn start after `amount` (3) counted turns it
 * leaves the fight with its pearls (gone and fled: no loot). The count shows in the hook's counter for the nameplate.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ooze = target ?? ctx.holder
    if (ooze.side !== ctx.holder.side || !ooze.monster) return
    if (ooze.hooks.some((h) => h.customId === 'flee-countdown' && h.sourceId === ooze.id)) return
    ctx.fx.installHook(ooze, ctx.line, ooze.id, { sourceSkillId: ctx.sourceId, counter: 0 })
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    const ooze = ctx.holder
    if (!hook || !ctx.fx.isActive(ooze)) return
    if (ctx.fx.hasStatus(ooze, 'root') || ctx.fx.hasStatus(ooze, 'slow')) {
      ctx.fx.log('countdown', `${ooze.name} is held: its countdown stops at ${hook.counter}`, { actorId: ooze.id, amount: hook.counter })
      return
    }
    const turns = ctx.line.amount ?? 3
    if (hook.counter >= turns) {
      ooze.gone = true
      ooze.fled = true
      ctx.fx.log('monsterFlee', `${ooze.name} slips away with its pearls`, { actorId: ooze.id })
      return
    }
    hook.counter += 1
    ctx.fx.log('countdown', `${ooze.name}: ${turns - hook.counter + 1} turn${turns - hook.counter + 1 === 1 ? '' : 's'} left`, { actorId: ooze.id, amount: hook.counter })
  },
}
export default handler
