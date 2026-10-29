import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * A part whose move it was breaks (06 §3.3: the Acolyte's conch → "no Hymn", the Brine Hag's salt-pouch → "no Hex",
 * the Flagellant's chain arm → "no pull", the Vault Sentinel's chest core → "no Tide Ward, Def ×1.2"). Runs with the
 * monster as holder and target: every attack that applies `status` (Fortify, Petrify, Root) leaves `attackIds`, and a
 * hook strips it again at each turn start. With `stat` and `percent` the monster also keeps a modifier for the rest of
 * the fight (the Sentinel's Defense ×2.0 → ×1.2 is −40%). The line's `damageType`, when set, is the break's type.
 */
function strip(holder: Actor, status: string): string[] {
  const m = holder.monster
  if (!m) return []
  const applies = (id: string) => m.attacks.find((a) => a.id === id)?.effects.some((l) => l.kind === 'applyStatus' && l.status === status) ?? false
  const removed = m.attackIds.filter(applies)
  if (removed.length) m.attackIds = m.attackIds.filter((id) => !applies(id))
  return removed
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const status = ctx.line.status
    if (!status) return
    const holder = ctx.holder
    const removed = strip(holder, status)
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
    if (ctx.line.stat && ctx.line.percent) holder.modifiers.push({ stat: ctx.line.stat, amount: 0, percent: ctx.line.percent, turnsLeft: 999, sourceId: 'part-break' })
    const names = removed.map((id) => holder.monster?.attacks.find((a) => a.id === id)?.name ?? id)
    ctx.fx.log('partBreakEffect', `${holder.name} loses ${names.length ? names.join(', ') : 'nothing it still had'}`, { actorId: holder.id, data: { removed: removed.join(',') } })
  },
  onTurnStart: (ctx) => {
    if (ctx.line.status) strip(ctx.holder, ctx.line.status)
  },
}
export default handler
