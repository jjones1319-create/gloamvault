import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Spiked Rim (Warden, Bulwark II, a passive) and Bone Knight's Stand (Bulwark III, until your next turn;
 * docs/classes/warden.md §4.1): a block sends `percent` of the damage that still got through back to the attacker
 * as `damageType` (Blunt). Natural blocks arrive through `onBlock`; the auto-blocks of `block-first-physical-hits`
 * through the `autoBlock:<holder id>` flag; the reflect itself happens in `afterHit`, which knows what was dealt (a
 * blocked hit that dealt nothing reflects nothing). The reflected hit is never answered (`isMelee: false`) and the
 * flag `noCounter:<holder id>` marks it so Punish does not read it as a counter-hit.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, data: { seenAuto: Number(ctx.state.flags[`autoBlock:${holder.id}`] ?? 0) } })
  },
  onFightStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.seenAuto = Number(ctx.state.flags[`autoBlock:${ctx.holder.id}`] ?? 0)
  },
  incomingDamagePercent: (ctx) => {
    if (ctx.hook) ctx.hook.data.pending = false
    return 0
  },
  onBlock: (ctx) => {
    if (ctx.hook) ctx.hook.data.pending = true
  },
  afterHit: (ctx, incoming, dealt) => {
    const hook = ctx.hook
    if (!hook || !incoming.attacker || incoming.isDot) return
    const auto = Number(ctx.state.flags[`autoBlock:${ctx.holder.id}`] ?? 0)
    const blocked = hook.data.pending === true || auto > Number(hook.data.seenAuto ?? 0)
    hook.data.pending = false
    hook.data.seenAuto = auto
    if (!blocked || !ctx.fx.isActive(incoming.attacker)) return
    const amount = roundHalfUp((dealt * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const flag = `noCounter:${ctx.holder.id}`
    ctx.state.flags[flag] = true
    ctx.fx.strike(ctx.holder, incoming.attacker, { amount, damageType: ctx.line.damageType ?? 'blunt', label: 'spiked rim', canMiss: false, canCrit: false, isMelee: false })
    delete ctx.state.flags[flag]
  },
}
export default handler
