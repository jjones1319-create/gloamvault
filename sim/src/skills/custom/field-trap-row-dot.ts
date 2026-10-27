import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'
import type { Status } from '../../types/enums.ts'

/**
 * Caltrop Toss (Ranger, Trapper I; docs/classes/ranger.md §4.2): a field trap on the targeted row — for `duration`
 * turns every enemy standing in it takes `multiplier` × Attack of `damageType` at its turn start. Reading: the
 * cast puts a hook (data.row) on every enemy, in the row or not, lasting `duration` of that enemy's turns; the hook
 * ticks only while its holder stands in the trapped row, so enemies that move in take it and enemies that leave
 * stop. The Mastery's `field-trap-tick-status` writes `data.tickStatus` on these hooks; a tick then applies it with
 * no extra count-down (D-077: a status gained during the holder's own turn keeps its duration through that turn, so
 * "Slow 1 turn" reaches its next move). A tick cannot miss or crit and is never answered.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const ranger = ctx.holder
    const key = `caltrops:${ranger.id}:action`
    const fresh = ctx.state.flags[key] !== ranger.tally.actions
    ctx.state.flags[key] = ranger.tally.actions
    for (const e of ctx.fx.enemiesOf(ranger)) ctx.fx.installHook(e, ctx.line, ranger.id, { sourceSkillId: ctx.sourceId, turnsLeft: Math.max(1, ctx.line.duration ?? 3), data: { row: target.row, scale } })
    if (fresh) ctx.fx.log('trap', `${ranger.name} scatters caltrops over the ${target.row} row`, { actorId: ranger.id })
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    const enemy = ctx.holder
    if (!hook || enemy.row !== hook.data.row || !ctx.fx.isActive(enemy)) return
    const ranger = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!ranger) return
    const type = ctx.line.damageType ?? 'pierce'
    const amount = roundHalfUp((ctx.fx.attackFor(ranger, type) * (ctx.line.multiplier ?? 0.5) * Number(hook.data.scale ?? 100)) / 100)
    if (amount > 0) ctx.fx.strike(ranger, enemy, { amount, damageType: type, label: 'caltrops', canMiss: false, canCrit: false, isMelee: false })
    const st = hook.data.tickStatus
    if (typeof st === 'string' && ctx.fx.isActive(enemy)) ctx.fx.applyStatus(enemy, { status: st as Status, duration: Number(hook.data.tickStatusDuration ?? 1) }, ranger.id)
  },
}
export default handler
