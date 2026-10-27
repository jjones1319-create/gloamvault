import type { CustomHandler } from './types.ts'

/**
 * Skull Splitter, Mastery (Blade, Executioner III; docs/classes/blade.md §4.2): `status` (Stun) lands on any hit
 * against a target under `percent`% HP. Reading: the line resolves after the hit, so it reads the holder's damage
 * events on the target this action and the target's HP before them (its HP now plus what they dealt).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.isActive(target)) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    let dealt = 0
    let landed = false
    for (const e of log.slice(start + 1)) {
      if (e.kind !== 'damage' || e.actorId !== ctx.holder.id || e.targetId !== target.id) continue
      landed = true
      dealt += e.amount ?? 0
    }
    if (!landed || (target.hp + dealt) * 100 >= target.maxHp * (ctx.line.percent ?? 0)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
