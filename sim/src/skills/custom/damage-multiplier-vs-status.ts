import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Quiver's End (Ranger Ultimate; docs/classes/ranger.md §3): the skill's damage line uses `multiplier` instead
 * against targets holding `status` (Mark). Reading: this line resolves after the damage line, so it deals the
 * difference itself — (`multiplier` − the skill's damage multiplier of the same type, read from the skill record at
 * the holder's rank) × Attack, as one non-melee strike that cannot miss and takes the base hit's crit from the log
 * (`data.crit`). It needs the base hit to have landed on the target this action. Guard and Block still apply to it.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target || !ctx.line.status || !ctx.fx.hasStatus(target, ctx.line.status) || !ctx.fx.isActive(target)) return
    const holder = ctx.holder
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === holder.id) {
        start = i
        break
      }
    }
    const hit = log.slice(start + 1).find((e) => e.actorId === holder.id && e.targetId === target.id && (e.kind === 'damage' || e.kind === 'miss'))
    if (!hit || hit.kind !== 'damage') return
    const type = ctx.line.damageType ?? 'pierce'
    const skill = ctx.sourceId ? ctx.content.skills.get(ctx.sourceId) : undefined
    const rank = holder.hero?.ranks[ctx.sourceId ?? ''] ?? 1
    const pool = skill ? (rank >= 10 ? [...skill.mastery.effects, ...skill.effects] : [...skill.effects]) : []
    const base = pool.find((e) => e.kind === 'damage' && e.damageType === type)
    const extra = (ctx.line.multiplier ?? 0) - (base?.multiplier ?? 0)
    if (extra <= 0) return
    const scaleWith = base?.scalesWith && !ctx.line.scalesWith ? Math.max(0, (holder.attributes[base.scalesWith] ?? 10) - 10) * 2 : 0
    let amount = roundHalfUp((ctx.fx.attackFor(holder, type) * extra * (scale + scaleWith)) / 100)
    if (hit.data?.crit === true) amount = roundHalfUp((amount * ctx.fx.statOf(holder, 'critDamage')) / 100)
    if (amount <= 0) return
    ctx.fx.strike(holder, target, { amount, damageType: type, label: `${skill?.name ?? 'the shot'} (${ctx.line.status})`, canMiss: false, canCrit: false, isMelee: false })
  },
}
export default handler
