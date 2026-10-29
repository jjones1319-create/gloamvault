import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Latch (the Vault Leech, 06 §3.3): "Grab; each of its turns while latched drains 15% of the hero's pool and heals the
 * Leech 5%" — the mouth ring's break: "no drain". The Latch's Grab is a DSL line; this rider installs the hook on the
 * Leech, and at each of its turn starts every hero it holds loses `percent` of its current pool (Stamina or Mana)
 * while the Leech heals `amount`% of its max HP. Once its part is broken (the mouth ring is its only limb) it drains
 * nothing more. The release on 10% HP damage is the Grab rule (06 §7).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const leech = ctx.holder
    if (leech.hooks.some((h) => h.customId === 'latch-drain' && h.sourceId === leech.id)) return
    ctx.fx.installHook(leech, ctx.line, leech.id, { sourceSkillId: ctx.sourceId })
  },
  onTurnStart: (ctx) => {
    const leech = ctx.holder
    if (leech.monster?.partBroken) return
    for (const held of ctx.state.actors.filter((a) => a.grabbedBy === leech.id && ctx.fx.isActive(a))) {
      const drain = held.poolKind !== null && held.pool > 0 ? roundHalfUp((held.pool * (ctx.line.percent ?? 15)) / 100) : 0
      if (drain > 0) held.pool -= drain
      const healed = ctx.fx.heal(leech, leech, roundHalfUp((leech.maxHp * (ctx.line.amount ?? 5)) / 100))
      ctx.fx.log('leech', `${leech.name} drinks from ${held.name}${drain > 0 ? ` (−${drain} ${held.poolKind})` : ''}${healed > 0 ? `, healing ${healed}` : ''}`, { actorId: leech.id, targetId: held.id, amount: drain, data: { healed } })
    }
  },
}
export default handler
