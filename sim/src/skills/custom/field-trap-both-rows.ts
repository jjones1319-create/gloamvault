import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/** Trapmaster's trap damage bonus (Ranger, Trapper V): the percent on the Ranger's own `trapmaster` passive, else 0. */
function trapBonus(ranger: HookContext['holder']): number {
  return ranger.hooks.find((h) => h.customId === 'trapmaster' && h.sourceId === ranger.id)?.line.percent ?? 0
}

/**
 * Killing Field (Ranger, Trapper V; docs/classes/ranger.md §4.2): for `duration` turns every enemy in both rows takes
 * `multiplier` × Attack of `damageType` at the start of its turn and gains `status` (Slow) for 1 turn.
 * Reading: the line resolves on every enemy (the skill targets allEnemies) and puts a hook on each lasting `duration` of
 * that enemy's turns (counted at its turn end, as Caltrop Toss's); a tick cannot miss or crit and is never answered.
 * Trapmaster's +% applies.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const ranger = ctx.holder
    ctx.fx.installHook(target, ctx.line, ranger.id, { sourceSkillId: ctx.sourceId, turnsLeft: Math.max(1, ctx.line.duration ?? 3), data: { scale } })
    const key = `killingField:${ranger.id}:action`
    if (ctx.state.flags[key] === ranger.tally.actions) return
    ctx.state.flags[key] = ranger.tally.actions
    ctx.fx.log('trap', `${ranger.name} turns the field into a killing ground`, { actorId: ranger.id })
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    const enemy = ctx.holder
    if (!hook || !ctx.fx.isActive(enemy)) return
    const ranger = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!ranger) return
    const type = ctx.line.damageType ?? 'pierce'
    const amount = roundHalfUp((ctx.fx.attackFor(ranger, type) * (ctx.line.multiplier ?? 1) * Number(hook.data.scale ?? 100) * (100 + trapBonus(ranger))) / 10_000)
    if (amount > 0) ctx.fx.strike(ranger, enemy, { amount, damageType: type, label: 'killing field', canMiss: false, canCrit: false, isMelee: false })
    if (ctx.line.status && ctx.fx.isActive(enemy)) ctx.fx.applyStatus(enemy, { status: ctx.line.status, duration: 1 }, ranger.id)
  },
}
export default handler
