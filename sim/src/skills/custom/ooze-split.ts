import type { CustomHandler } from './types.ts'

/**
 * Brine Ooze (06 §3.3): "a Slash hit that does not kill it splits it into two Oozes at half HP (max 4)". A passive
 * trigger (a zero-weight attack, armed at spawn and on every ooze a split makes): after a hit of `damageType` (Slash)
 * that leaves it standing with at least 2 HP, and while fewer than `amount` (4) oozes of its kind stand on its side,
 * its HP halves and a second ooze of the same kind takes the other half (HookFx.summon) in its row.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ooze = target ?? ctx.holder
    if (ooze.side !== ctx.holder.side || !ooze.monster) return
    ctx.fx.installHook(ooze, ctx.line, ooze.id, { sourceSkillId: ctx.sourceId })
  },
  afterHit: (ctx, incoming) => {
    const ooze = ctx.holder
    const kind = ooze.monster?.monsterId
    if (!kind || incoming.damageType !== (ctx.line.damageType ?? 'slash') || !ctx.fx.isActive(ooze) || ooze.hp < 2) return
    const standing = ctx.state.actors.filter((a) => a.side === ooze.side && a.monster?.monsterId === kind && ctx.fx.isActive(a)).length
    if (standing >= (ctx.line.amount ?? 4)) return
    const half = Math.floor(ooze.hp / 2)
    const twin = ctx.fx.summon(ooze, kind, { row: ooze.row })
    if (!twin) return
    ooze.hp -= half
    twin.hp = Math.max(1, Math.min(twin.maxHp, half))
    ctx.fx.log('split', `${ooze.name} splits in two`, { actorId: ooze.id, targetId: twin.id, amount: twin.hp })
  },
}
export default handler
