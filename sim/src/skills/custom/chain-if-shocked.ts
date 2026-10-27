import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/** Log kinds that open an actor's own action (the fight logs one per turn taken). */
const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

/**
 * Spark (Arcanist, Evocation I; docs/classes/arcanist.md §4.1): if the target was already Shocked before this hit,
 * the hit chains `multiplier` × spell Attack as `damageType` to `amount` adjacent enemies (the target's row first,
 * then the other row, drawn at random). The chain never misses and may crit; it applies no Shock of its own.
 * Reading: the line resolves after the skill's own Shock, so "held before this hit" is read from the fight log — a
 * `status` Shock event on the target before this action's marker with no `statusEnd` after it (a cleanse logs
 * nothing and reads as still held).
 */
function heldBeforeAction(ctx: HookContext, target: Actor, status: string): boolean {
  const log = ctx.state.log
  let i = log.length - 1
  while (i >= 0 && !(log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? ''))) i--
  for (let j = i - 1; j >= 0; j--) {
    const e = log[j]
    if (!e || e.data?.status !== status) continue
    if (e.kind === 'status' && e.targetId === target.id) return true
    if (e.kind === 'statusEnd' && e.actorId === target.id) return false
  }
  return false
}

const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target || !heldBeforeAction(ctx, target, 'shock')) return
    const type = ctx.line.damageType ?? 'lightning'
    const others = ctx.fx.enemiesOf(ctx.holder).filter((e) => e !== target)
    const near = others.filter((e) => e.row === target.row)
    const far = others.filter((e) => e.row !== target.row)
    const picks: Actor[] = []
    for (let i = 0; i < (ctx.line.amount ?? 1); i++) {
      const pool = near.length > 0 ? near : far
      if (pool.length === 0) break
      const p = ctx.rng.pick(pool)
      picks.push(p)
      pool.splice(pool.indexOf(p), 1)
    }
    if (picks.length === 0) return
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'spark'
    for (const e of picks) ctx.fx.strike(ctx.holder, e, { amount, damageType: type, label: `${label} (chain)`, canMiss: false, canCrit: true, isMelee: false })
  },
}
export default handler
