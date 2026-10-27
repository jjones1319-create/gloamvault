import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

const ID = 'ice-wall'

/**
 * Ice Wall (Arcanist, Rime II; docs/classes/arcanist.md §4.2): a wall with HP = `percent`% of the caster's max HP
 * absorbs melee hits aimed at the party's front row for `duration` turns or until broken; a melee attacker that
 * strikes it gets `status` 1. Reading: the wall is a hook on every front-row ally (installed per resolved target of
 * the partyFront line) sharing one HP pool in `state.flags['iceWall:<caster>']`; each hook counts down at its
 * holder's turn end. A hero's own Shield, being a status, absorbs before the wall.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const caster = ctx.holder
    const poolKey = `iceWall:${caster.id}`
    const castKey = `iceWallCast:${caster.id}`
    if (ctx.state.flags[castKey] !== caster.tally.actions) {
      ctx.state.flags[castKey] = caster.tally.actions
      const hp = roundHalfUp((caster.maxHp * (ctx.line.percent ?? 25) * scale) / 10_000)
      ctx.state.flags[poolKey] = hp
      ctx.fx.log('iceWall', `${caster.name} raises a wall of ice (${hp})`, { actorId: caster.id, amount: hp })
    }
    ctx.fx.installHook(target, ctx.line, caster.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 2 })
  },
  absorb: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || !incoming.isMelee || incoming.isDot) return incoming.amount
    const poolKey = `iceWall:${hook.sourceId}`
    const pool = Number(ctx.state.flags[poolKey] ?? 0)
    if (pool <= 0) {
      ctx.fx.removeHook(ctx.holder, hook)
      return incoming.amount
    }
    const take = Math.min(pool, incoming.amount)
    ctx.state.flags[poolKey] = pool - take
    if (take > 0) ctx.fx.log('iceWall', `the ice wall takes ${take} meant for ${ctx.holder.name}`, { targetId: ctx.holder.id, amount: take })
    if (incoming.attacker && ctx.line.status && ctx.fx.isActive(incoming.attacker)) ctx.fx.applyStatus(incoming.attacker, { status: ctx.line.status, duration: 1 }, hook.sourceId)
    if (pool - take <= 0) {
      for (const a of ctx.state.actors) if (a.side === ctx.holder.side) a.hooks = a.hooks.filter((h) => !(h.customId === ID && h.sourceId === hook.sourceId))
      ctx.fx.log('iceWall', 'the ice wall shatters', { targetId: ctx.holder.id })
    }
    return incoming.amount - take
  },
}
export default handler
