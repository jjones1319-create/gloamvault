import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Judgement (Mender, Sanctity III; docs/classes/mender.md §4.2): the skill's damage is +1% per 1% of the target's
 * missing HP, capped at +`percent`%. The line follows the skill's damage line, so `apply` deals the difference: it
 * reads the hit this cast just landed on the target (the last damage event by the caster on it since the action
 * began), measures the HP missing before that hit, and strikes again for the bonus share in the skill's damage type.
 * The extra is a share of already-mitigated damage, so it ignores Defense; a miss or a kill leaves nothing to scale.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = ctx.holder
    if (!target || target.side === holder.side || !ctx.fx.isActive(target)) return
    let dealt = 0
    const log = ctx.state.log
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (!e) continue
      if (e.kind === 'action' && e.actorId === holder.id) break
      if (e.kind === 'damage' && e.actorId === holder.id && e.targetId === target.id) {
        dealt = e.amount ?? 0
        break
      }
    }
    if (dealt <= 0) return
    const hpBefore = Math.min(target.maxHp, target.hp + dealt)
    const missingPct = Math.floor(((target.maxHp - hpBefore) * 100) / Math.max(1, target.maxHp))
    const bonus = Math.max(0, Math.min(ctx.line.percent ?? 50, missingPct))
    const extra = roundHalfUp((dealt * bonus) / 100)
    if (extra <= 0) return
    const skill = ctx.sourceId ? ctx.content.skills.get(ctx.sourceId) : undefined
    const type = skill?.effects.find((l) => l.kind === 'damage')?.damageType ?? ctx.line.damageType ?? 'holy'
    ctx.fx.strike(holder, target, { amount: extra, damageType: type, label: `${skill?.name ?? 'judgement'} (+${bonus}%)`, canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  },
}
export default handler
