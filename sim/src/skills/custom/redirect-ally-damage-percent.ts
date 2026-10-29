import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Aegis of the Keep (Warden, Bulwark V; docs/classes/warden.md §4.1): for `duration` turns, `percent`% of the damage
 * aimed at each ally is redirected to the caster. The line (target: every ally) installs a hook on each ally but the
 * caster, sourced to the caster, for `duration` of that ally's turns. Reading: at each enemy hit on the ally the hook
 * cuts the ally's share by `percent` (a target-side percent, before the ally's Guard, Block and Defense) and strikes
 * the caster for `percent`% of the blow as it left the attacker (Attack × multiplier, before crit and variance), so the
 * caster's own Defense, Block and damage cuts apply to its share. DoT ticks, hits from the party's own side and hits
 * while the caster is down are not redirected; a redirected blow is never redirected again.
 */
const BUSY = 'aegisRedirecting'

const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target === ctx.holder || target.side !== ctx.holder.side) return
    const turns = ctx.line.duration ?? 3
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns + (ctx.state.actingId === target.id ? 1 : 0) })
    ctx.fx.log('aegis', `${ctx.holder.name} stands between ${target.name} and harm`, { actorId: ctx.holder.id, targetId: target.id })
  },
  incomingDamagePercent: (ctx, incoming) => {
    const hook = ctx.hook
    const attacker = incoming.attacker
    if (!hook || incoming.isDot || !attacker || attacker.side === ctx.holder.side || ctx.state.flags[BUSY] === true) return 0
    const caster = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!caster || caster === ctx.holder || !ctx.fx.isActive(caster)) return 0
    const pct = ctx.line.percent ?? 50
    const share = roundHalfUp((incoming.amount * pct) / 100)
    if (share > 0) {
      ctx.state.flags[BUSY] = true
      ctx.fx.strike(attacker, caster, { amount: share, damageType: incoming.damageType, label: 'Aegis of the Keep', canMiss: false, canCrit: false, isMelee: false })
      ctx.state.flags[BUSY] = false
    }
    return -pct
  },
}
export default handler
