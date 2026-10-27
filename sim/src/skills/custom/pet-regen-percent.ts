import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/** Sporeling's trait (06 §9): the pet heals `percent` of its max HP at the start of each of its turns. The trait hook sits on the pet (pets.ts). */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onTurnStart: (ctx) => {
    const holder = ctx.holder
    if (holder.hp <= 0) return
    const amount = roundHalfUp((holder.maxHp * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(holder, holder, amount)
    if (healed > 0) ctx.fx.log('regen', `${holder.name} regrows ${healed}`, { actorId: holder.id, amount: healed })
  },
}
export default handler
