import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Pickpocket (Grinning Cutpurse, 06 §3.1): "steals `percent` of the party's unbanked gold; returned on its death".
 * The thief holds at most `percent` of the gold the party carried into the fight (`state.options.partyGold`); a
 * second Pickpocket by the same thief only tops that up. What it holds sits in a hook on the thief (`data.stolen`)
 * and in `state.counters.goldStolen`, the net the delve settles after the fight (delve.ts `finishFight`); a thief
 * that dies gives its take back, one that flees keeps it. The purse part-break (`drop-stolen-gold`) returns it early.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const thief = ctx.holder
    const cap = Math.max(0, roundHalfUp((ctx.state.options.partyGold * (ctx.line.percent ?? 5)) / 100))
    const existing = thief.hooks.find((h) => h.customId === 'steal-party-gold' && h.sourceId === thief.id) ?? null
    const held = Number(existing?.data.stolen ?? 0)
    const amount = Math.max(0, cap - held)
    if (amount <= 0) {
      ctx.fx.log('steal', `${thief.name} finds nothing more to take`, { actorId: thief.id, targetId: target?.id })
      return
    }
    ctx.state.counters.goldStolen += amount
    const hook = existing ?? ctx.fx.installHook(thief, ctx.line, thief.id, { sourceSkillId: ctx.sourceId, data: { stolen: 0 } })
    hook.data.stolen = held + amount
    ctx.fx.log('steal', `${thief.name} pockets ${amount} gold`, { actorId: thief.id, targetId: target?.id, amount })
  },
  onDeath: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    const stolen = Number(hook.data.stolen ?? 0)
    if (stolen <= 0) return
    ctx.state.counters.goldStolen = Math.max(0, ctx.state.counters.goldStolen - stolen)
    hook.data.stolen = 0
    ctx.fx.log('goldReturned', `${ctx.holder.name} drops ${stolen} stolen gold`, { actorId: ctx.holder.id, amount: stolen })
  },
}
export default handler
