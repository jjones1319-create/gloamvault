import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Tripwire (Ranger, Trapper II; docs/classes/ranger.md §4.2): a trap on the enemy side with `amount` triggers; the
 * next enemy to change rows, charge or use a reach attack takes `multiplier` × Attack of `damageType` and `status`
 * (Daze). Reading: the sim has no row-change or charge joint, so the cast puts a hook on every enemy that
 * remembers its row; the trap fires at an enemy's turn start when its row changed since, or when a back-row enemy
 * attacks (a reach attack). The triggers left live in the flag `tripwire:<ranger id>`; an enemy trips it once.
 */
const ID = 'field-trap-on-movement'

function fire(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook) return
  const enemy = ctx.holder
  const ranger = ctx.state.actors.find((a) => a.id === hook.sourceId)
  const key = `tripwire:${hook.sourceId}`
  const left = Number(ctx.state.flags[key] ?? 0)
  if (!ranger || left <= 0) {
    ctx.fx.removeHook(enemy, hook)
    return
  }
  ctx.state.flags[key] = left - 1
  ctx.fx.removeHook(enemy, hook)
  const type = ctx.line.damageType ?? 'pierce'
  const amount = roundHalfUp((ctx.fx.attackFor(ranger, type) * (ctx.line.multiplier ?? 1) * Number(hook.data.scale ?? 100)) / 100)
  ctx.fx.log('trap', `${enemy.name} trips ${ranger.name}'s wire`, { actorId: ranger.id, targetId: enemy.id })
  if (amount > 0 && ctx.fx.isActive(enemy)) ctx.fx.strike(ranger, enemy, { amount, damageType: type, label: 'tripwire', canMiss: false, canCrit: true, isMelee: false })
  if (ctx.line.status && ctx.fx.isActive(enemy)) ctx.fx.applyStatus(enemy, { status: ctx.line.status, duration: ctx.line.duration }, ranger.id)
  if (left - 1 <= 0) {
    for (const a of ctx.state.actors) for (const h of a.hooks.filter((x) => x.customId === ID && x.sourceId === hook.sourceId)) ctx.fx.removeHook(a, h)
    delete ctx.state.flags[key]
  }
}

const handler: CustomHandler = {
  apply: (ctx, _target, scale) => {
    const ranger = ctx.holder
    const key = `tripwire:${ranger.id}`
    const fresh = ctx.state.flags[`${key}:action`] !== ranger.tally.actions
    ctx.state.flags[`${key}:action`] = ranger.tally.actions
    ctx.state.flags[key] = Math.max(1, ctx.line.amount ?? 1)
    for (const e of ctx.fx.enemiesOf(ranger)) ctx.fx.installHook(e, ctx.line, ranger.id, { sourceSkillId: ctx.sourceId, data: { row: e.row, scale } })
    if (fresh) ctx.fx.log('trap', `${ranger.name} lays a tripwire`, { actorId: ranger.id })
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    if (ctx.holder.row !== hook.data.row) fire(ctx)
    else hook.data.row = ctx.holder.row
  },
  onHolderAttacks: (ctx) => {
    if (ctx.hook && ctx.holder.row === 'back') fire(ctx)
  },
}
export default handler
