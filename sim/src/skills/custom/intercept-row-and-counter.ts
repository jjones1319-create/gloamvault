import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Warden of the Pass (Warden, Vanguard V; docs/classes/warden.md §4.2): for `duration` turns every single-target enemy
 * action aimed at an ally in the caster's row is intercepted by the caster and countered at `multiplier`× (1.5;
 * Mastery 2.0). The line (target self) installs the stance on the caster for `duration` of its turns and a mirror on
 * every other ally; a mirror answers `intercept` while its ally stands in the caster's row and the caster's stance
 * holds, and marks the attacker (flag `passCounter:<caster id>`). The caster's stance counters that attacker after the
 * intercepted blow lands: `multiplier` × the caster's Attack of its weapon's type, a strike that cannot miss, can crit
 * and is never answered (`isMelee: false`). Reading: the fight intercepts damaging single-target lines only (a Grab
 * aimed at the ally is not taken over), as Intercept does; DoT ticks and Ultimates are never intercepted.
 */
function stance(ctx: HookContext): boolean {
  const caster = ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId)
  return !!caster && caster.hooks.some((h) => h.customId === 'intercept-row-and-counter' && h.data.role === 'stance')
}

const handler: CustomHandler = {
  apply: (ctx, _target, scale) => {
    const caster = ctx.holder
    const turns = ctx.line.duration ?? 3
    ctx.fx.installHook(caster, ctx.line, caster.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns + (ctx.state.actingId === caster.id ? 1 : 0), data: { role: 'stance', scale } })
    for (const ally of ctx.fx.alliesOf(caster)) {
      if (ally === caster) continue
      ctx.fx.installHook(ally, ctx.line, caster.id, { sourceSkillId: ctx.sourceId, data: { role: 'mirror' } })
    }
    ctx.fx.log('stance', `${caster.name} holds the pass: no blow reaches the ${caster.row} row`, { actorId: caster.id })
  },
  intercept: (ctx, attacker, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.role !== 'mirror' || !attacker || attacker.side === ctx.holder.side) return null
    if (!incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    const caster = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!caster || !stance(ctx)) {
      ctx.fx.removeHook(ctx.holder, hook)
      return null
    }
    if (!ctx.fx.isActive(caster) || caster.row !== ctx.holder.row) return null
    ctx.state.flags[`passCounter:${caster.id}`] = attacker.id
    return { interceptorId: caster.id, percent: 0 }
  },
  afterHit: (ctx, incoming) => {
    const hook = ctx.hook
    const key = `passCounter:${ctx.holder.id}`
    const attacker = incoming.attacker
    if (!hook || hook.data.role !== 'stance' || !attacker || ctx.state.flags[key] !== attacker.id) return
    ctx.state.flags[key] = ''
    if (!ctx.fx.isActive(attacker) || !ctx.fx.isActive(ctx.holder)) return
    const type = ctx.holder.hero?.weapon.damageType ?? 'pierce'
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1.5) * Number(hook.data.scale ?? 100)) / 100)
    if (amount > 0) ctx.fx.strike(ctx.holder, attacker, { amount, damageType: type, label: 'counter (the pass)', canMiss: false, canCrit: true, isMelee: false })
  },
  onTurnStart: (ctx) => {
    if (ctx.hook?.data.role === 'stance') ctx.state.flags[`passCounter:${ctx.holder.id}`] = ''
  },
}
export default handler
