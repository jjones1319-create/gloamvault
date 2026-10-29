import type { CustomHandler, HookContext } from './types.ts'

/**
 * One Shot (Ranger, Marksman IV; docs/classes/ranger.md §4.1): a crit by the holder that leaves a fodder-role enemy
 * below `percent`% HP kills it outright — never an elite, a special, a boss or a hunter.
 * Reading: the hit's crit is known only once the fight logs it, after the damage pipeline (where `onDealtDamage` runs)
 * has finished, so the passive settles after each of the holder's actions: the fight's `modifyWeight` call, which
 * every action makes once it has resolved, sweeps the holder's critical `damage` events since the last sweep and
 * finishes each fodder target still standing under the threshold with a blow no Defense stops (logged `oneShot`).
 */
function sweep(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook) return
  const log = ctx.state.log
  const from = Math.max(0, Number(hook.data.seen ?? 0))
  const end = log.length
  const ranger = ctx.holder
  const done = new Set<string>()
  for (let i = from; i < end; i++) {
    const e = log[i]
    if (!e || e.kind !== 'damage' || e.actorId !== ranger.id || e.data?.crit !== true || !e.targetId || done.has(e.targetId)) continue
    const target = ctx.state.actors.find((a) => a.id === e.targetId)
    const m = target?.monster
    if (!target || !m || m.role !== 'fodder' || m.isBoss || m.isHunter || !ctx.fx.isActive(target)) continue
    if (target.hp * 100 >= target.maxHp * (ctx.line.percent ?? 25)) continue
    done.add(target.id)
    ctx.fx.log('oneShot', `${ranger.name}'s shot finishes ${target.name}`, { actorId: ranger.id, targetId: target.id })
    ctx.fx.strike(ranger, target, { amount: Math.max(1, target.maxHp * 10), damageType: ranger.hero?.weapon.damageType ?? 'pierce', label: 'One Shot', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  }
  hook.data.seen = log.length
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.seen = ctx.state.log.length
  },
  modifyWeight: (ctx, weight) => {
    sweep(ctx)
    return weight
  },
}
export default handler
