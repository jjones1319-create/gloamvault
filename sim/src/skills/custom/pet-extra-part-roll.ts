import type { CustomHandler } from './types.ts'

/**
 * Rat Prince's Scavenge (pet active, 06 §9): at the fight's end, `amount` extra common/rare part rolls over the
 * fight's kills; once per fight. Reading: parts are rolled by loot.ts after the fight, so the fight only records the
 * promise — `state.flags.extraPartRolls` (a count the loot roll must add to its part rolls; the lead wires it into
 * rollParts) and `pet-extra-part-roll:<pet>` for the once-per-fight.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const key = `pet-extra-part-roll:${ctx.holder.id}`
    if (ctx.state.flags[key] === true) {
      ctx.fx.log('scavengeSpent', `${ctx.holder.name} has already scavenged this fight`, { actorId: ctx.holder.id })
      return
    }
    ctx.state.flags[key] = true
    const extra = Math.max(0, ctx.line.amount ?? 1)
    ctx.state.flags.extraPartRolls = Number(ctx.state.flags.extraPartRolls ?? 0) + extra
    ctx.fx.log('scavenge', `${ctx.holder.name} marks the spoils (+${extra} part roll)`, { actorId: ctx.holder.id, amount: extra })
  },
}
export default handler
