import { roundHalfUp } from '../../stats.ts'
import type { DamageType } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/** The target's element multiplier in percent (monsters only; heroes read 100), so a pre-mitigated amount can be fed back through the pipeline unchanged. */
function typePercent(ctx: HookContext, target: Actor, type: DamageType): number {
  const m = target.monster
  if (!m) return 100
  const e = ctx.t.combat.elements
  if (m.immune.includes(type)) return e.immuneMultiplier * 100
  if (m.weak.includes(type)) return e.weakMultiplier * 100
  if (m.resist.includes(type)) return e.resistMultiplier * 100
  return 100
}

/**
 * Venom Burst (Shade, Venom III; docs/classes/shade.md §4.2): consumes the target's `status` DoT and deals its
 * remaining ticks × `multiplier` at once, ignoring Defense as the DoT does. Remaining ticks = turns left × the tick
 * per stack × stacks (per-stack from max HP or the stored hit damage, as the status record says). The burst never
 * misses or crits; the rank scaling of the cast applies to the multiplier (Reading). DoT ticks ignore element
 * multipliers, so the burst is pre-scaled by the target's multiplier to land the same number; an immune target
 * loses the DoT and takes nothing.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target || !ctx.line.status) return
    const s = target.statuses.find((x) => x.id === ctx.line.status)
    const def = ctx.content.statuses.get(ctx.line.status)
    if (!s || !def || def.kind !== 'dot') return
    const perStack = def.magnitudeOf === 'maxHp' ? roundHalfUp((target.maxHp * s.magnitude) / 100) : s.magnitude
    const ticks = Math.max(1, s.turnsLeft ?? 1)
    const type = def.tickDamageType ?? 'poison'
    const burst = roundHalfUp((perStack * s.stacks * ticks * (ctx.line.multiplier ?? 1) * scale) / 100)
    target.statuses = target.statuses.filter((x) => x !== s)
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    ctx.fx.log('burst', `${skill?.name ?? 'Burst'} draws the ${def.name} out of ${target.name}`, { actorId: ctx.holder.id, targetId: target.id, amount: burst })
    const pct = typePercent(ctx, target, type)
    if (burst <= 0 || pct <= 0) return
    ctx.fx.strike(ctx.holder, target, { amount: roundHalfUp((burst * 100) / pct), damageType: type, label: `${skill?.name ?? 'Burst'} (burst)`, canMiss: false, canCrit: false, isMelee: false, ignoresDefense: def.ignoresDefense })
  },
}
export default handler
