import type { DamageType, Status } from '../../types/enums.ts'
import type { CustomHandler } from './types.ts'

/**
 * Shadow Oil (Shade, Venom III; docs/classes/shade.md §4.2): for `duration` turns the holder's attacks (basic and
 * skill damage lines) deal `damageType`, apply its mark (Shadow → Wither) and do +`percent`%.
 * Reading: the element rides the weapon — the rewritten line's multiplier is rescaled by Attack(phys)/Attack(spell)
 * so a Shade's oiled dagger keeps its physical Attack base and only its type, mark and bonus change. The hook
 * counts down at the holder's turn end like a self-buff.
 */
const MARK: Partial<Record<DamageType, Status>> = { fire: 'burn', frost: 'chill', lightning: 'shock', poison: 'poison', holy: 'smite', shadow: 'wither' }

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3, data: { action: -1 } })
    ctx.fx.log('oil', `${holder.name}'s weapons run with ${ctx.line.damageType ?? 'shadow'}`, { actorId: holder.id })
  },
  modifyLine: (ctx, line, source) => {
    const type = ctx.line.damageType
    if (!type || line.kind !== 'damage' || (source.kind !== 'basic' && source.kind !== 'skill')) return null
    if (ctx.hook) ctx.hook.data.action = ctx.holder.tally.actions
    if (line.damageType === type) return null
    const phys = ctx.fx.statOf(ctx.holder, 'attackPhys')
    const spell = ctx.fx.statOf(ctx.holder, 'attackSpell')
    const wasPhysical = line.damageType === undefined || line.damageType === 'slash' || line.damageType === 'pierce' || line.damageType === 'blunt'
    const multiplier = wasPhysical && spell > 0 ? ((line.multiplier ?? 1) * phys) / spell : (line.multiplier ?? 1)
    return { ...line, damageType: type, multiplier }
  },
  outgoingDamagePercent: (ctx, _target, incoming) => (!incoming.isDot && incoming.damageType === ctx.line.damageType && ctx.hook?.data.action === ctx.holder.tally.actions ? (ctx.line.percent ?? 0) : 0),
  onDealtDamage: (ctx, target, dealt, incoming) => {
    if (incoming.isDot || incoming.damageType !== ctx.line.damageType || ctx.hook?.data.action !== ctx.holder.tally.actions) return
    const mark = MARK[incoming.damageType]
    if (!mark || !ctx.fx.isActive(target)) return
    ctx.fx.applyStatus(target, mark === 'burn' ? { status: mark, magnitude: dealt } : { status: mark }, ctx.holder.id)
  },
}
export default handler
