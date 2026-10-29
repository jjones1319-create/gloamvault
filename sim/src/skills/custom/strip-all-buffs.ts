import type { CustomHandler } from './types.ts'

/**
 * Black Mirror (Shade, Venom IV; docs/classes/shade.md §4.2): strips every buff from the target (a status whose record
 * lists `strip`: Fortify, Haste, Shield, Regen; never Veil, which no strip touches — D-044). With `amount` 1 (the
 * Mastery) the target's `status` (Shield) goes to the holder instead of vanishing — the line says it before the strip
 * so the base line and the Mastery share one signature (skill-lines.ts) and the Mastery replaces it.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target.side === ctx.holder.side) return
    const keep = (ctx.line.amount ?? 0) === 1 ? ctx.line.status : undefined
    const stripped: string[] = []
    for (const s of [...target.statuses]) {
      if (s.id === 'veil') continue
      const def = ctx.content.statuses.get(s.id)
      if (!def?.cleansedBy.includes('strip')) continue
      target.statuses = target.statuses.filter((x) => x !== s)
      stripped.push(s.id)
      if (keep && s.id === keep && ctx.fx.isActive(ctx.holder)) {
        const mine = ctx.holder.statuses.find((x) => x.id === s.id)
        if (mine) {
          mine.magnitude = Math.max(mine.magnitude, s.magnitude)
          mine.turnsLeft = mine.turnsLeft === null || s.turnsLeft === null ? null : Math.max(mine.turnsLeft, s.turnsLeft)
        } else ctx.holder.statuses.push({ ...s, sourceId: ctx.holder.id, counter: 0 })
        ctx.fx.log('steal', `${ctx.holder.name} takes ${target.name}'s ${def.name}`, { actorId: ctx.holder.id, targetId: target.id, data: { status: s.id, to: ctx.holder.id } })
      }
    }
    if (stripped.length > 0) ctx.fx.log('strip', `${ctx.holder.name} strips ${target.name} bare (${stripped.join(', ')})`, { actorId: ctx.holder.id, targetId: target.id, amount: stripped.length })
  },
}
export default handler
