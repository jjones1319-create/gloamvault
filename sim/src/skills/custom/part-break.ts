import type { CustomHandler } from './types.ts'

/**
 * Breaker's Arc (Blade, Executioner III) and Hamstring (Ranger, Trapper II): the hit marks a limb, so the monster's
 * rare-part roll is multiplied (`multiplier`; 03 §6.5). Reading: sets `monster.partBroken` (loot.ts doubles the rare
 * roll from the tuning's `partBreakRareMultiplier`; the line's own ×2/×3 is not read yet) and logs the break; it
 * needs the skill's hit to have landed this action and does nothing on an already broken monster.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m || m.partBroken) return
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
    m.partBroken = true
    ctx.fx.log('partBreak', `${ctx.holder.name} marks a limb on ${target.name}`, { actorId: ctx.holder.id, targetId: target.id, data: { multiplier: ctx.line.multiplier ?? 2 } })
  },
}
export default handler
