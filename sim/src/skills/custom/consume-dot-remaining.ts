import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Hemorrhage (Blade, Bloodletter II; docs/classes/blade.md §4.3): removes `status` (Bleed) from the target and
 * deals every tick it had left at once — per-tick magnitude × stacks × turns left, as the status's own damage type,
 * ignoring Defense when the status does. Reading: the burst is one non-melee hit through the pipeline that cannot
 * miss or crit; it needs the skill's own hit to have landed this action (a miss consumes nothing).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const status = ctx.line.status
    if (!target || !status) return
    const inst = target.statuses.find((s) => s.id === status)
    if (!inst) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    if (!log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId === target.id)) return
    const def = ctx.content.statuses.get(status)
    const perStack = def?.magnitudeOf === 'maxHp' ? roundHalfUp((target.maxHp * inst.magnitude) / 100) : inst.magnitude
    const turns = inst.turnsLeft ?? def?.durationDefault ?? 0
    const amount = Math.max(0, perStack * inst.stacks * turns)
    ctx.fx.removeStatus(target, status)
    ctx.fx.log('consume', `${ctx.holder.name} tears the ${status} open`, { actorId: ctx.holder.id, targetId: target.id, amount })
    if (amount <= 0 || !ctx.fx.isActive(target)) return
    ctx.fx.strike(ctx.holder, target, { amount, damageType: def?.tickDamageType ?? ctx.line.damageType ?? 'slash', label: 'hemorrhage', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: def?.ignoresDefense ?? true })
  },
}
export default handler
