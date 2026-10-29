import type { CustomHandler } from './types.ts'

/**
 * Barrow Warden's Vigil, four pieces (08 §6): "Guard also Taunts every enemy and grants Fortify 1 round". The hook
 * sits on the wearer (hero.ts). Reading: the fight calls no hook when a hero Guards, but a Guard spends its weight
 * right after setting `guarding` (fight.ts doGuard → spendWeight), so `modifyWeight` sees a Guard as the action whose
 * weight is spent while `holder.guarding` is set (it is cleared at every turn start). It Taunts every enemy onto the
 * holder and Fortifies them for `duration` (1) turns, and leaves the weight alone. A Fear-forced Guard counts too.
 */
const handler: CustomHandler = {
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!ctx.holder.guarding || (hook && hook.data.guardAction === ctx.holder.tally.actions)) return weight
    if (hook) hook.data.guardAction = ctx.holder.tally.actions
    const turns = ctx.line.duration ?? 1
    ctx.fx.applyLine(ctx.holder, { kind: 'taunt', duration: turns, target: 'allEnemies' }, 'allEnemies', null, { kind: 'trait', id: hook?.sourceId ?? 'set', label: "the Barrow Warden's Vigil", neverMisses: true })
    ctx.fx.applyStatus(ctx.holder, { status: 'fortify', duration: turns }, ctx.holder.id)
    ctx.fx.log('setBonus', `${ctx.holder.name} keeps the Vigil: every enemy turns to face them`, { actorId: ctx.holder.id })
    return weight
  },
}
export default handler
