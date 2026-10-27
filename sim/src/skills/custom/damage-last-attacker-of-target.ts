import type { CustomHandler } from './types.ts'

/**
 * Cover Fire (Ranger, Pathfinder III; docs/classes/ranger.md §4.3): a `multiplier` × Attack shot of `damageType` at
 * the enemy that last hit the chosen ally. Reading: the last `damage` event on the ally by a standing enemy names
 * the shooter's target; with no such enemy the shot goes at the nearest enemy instead. The shot resolves as a
 * ranged damage line of the skill (it can miss, crit, be intercepted and is scaled by the holder's other hooks).
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const holder = ctx.holder
    let enemy = null
    const log = ctx.state.log
    for (let i = log.length - 1; i >= 0 && !enemy; i--) {
      const e = log[i]
      if (!e || e.kind !== 'damage' || e.targetId !== target.id || !e.actorId) continue
      const a = ctx.state.actors.find((x) => x.id === e.actorId)
      if (a && a.side !== holder.side && ctx.fx.isActive(a)) enemy = a
    }
    enemy ??= ctx.fx.enemiesOf(holder)[0] ?? null
    if (!enemy) return
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    ctx.fx.log('coverFire', `${holder.name} covers ${target.name}`, { actorId: holder.id, targetId: enemy.id })
    ctx.fx.applyLine(holder, { kind: 'damage', multiplier: ctx.line.multiplier ?? 1, damageType: ctx.line.damageType ?? 'pierce' }, 'enemy', enemy, { kind: 'skill', id: ctx.sourceId ?? 'cover-fire', label: skill?.name ?? 'cover fire', effectPercent: scale, reach: true, ranged: true, isMelee: false })
  },
}
export default handler
