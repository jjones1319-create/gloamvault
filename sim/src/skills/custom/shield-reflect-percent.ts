import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

function shieldLeft(actor: Actor): number {
  return actor.statuses.find((s) => s.id === 'shield')?.magnitude ?? 0
}

/**
 * Mirror Ward (Arcanist, Arcana II; docs/classes/arcanist.md §4.3): `percent`% of the damage this skill's Shield
 * absorbs is returned to the attacker as `damageType` (mastery 30%). Reading: the Shield status absorbs before any
 * hook and the absorb loop stops once a hit is spent, so no joint sees the absorbed amount; the hook snapshots the
 * ally's Shield as each hit begins (`incomingDamagePercent`, which fires before mitigation) and settles the
 * difference afterwards — at `afterHit` when the hit got through, else at the next incoming hit or the ally's turn
 * start. The reflected strike is the caster's (nobody's if the caster is down), never misses or crits, and is not melee.
 */
function settle(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook) return
  const now = shieldLeft(ctx.holder)
  const absorbed = Math.max(0, Number(hook.data.mag ?? 0) - now)
  const attackerId = typeof hook.data.attacker === 'string' ? hook.data.attacker : ''
  hook.data.mag = now
  hook.data.attacker = ''
  if (absorbed <= 0 || attackerId === '') return
  const attacker = ctx.state.actors.find((a) => a.id === attackerId)
  if (!attacker || !ctx.fx.isActive(attacker)) return
  const amount = roundHalfUp((absorbed * (ctx.line.percent ?? 0)) / 100)
  if (amount <= 0) return
  const caster = ctx.state.actors.find((a) => a.id === hook.sourceId)
  const label = ctx.content.skills.get(hook.sourceSkillId ?? '')?.name ?? 'Mirror Ward'
  ctx.fx.strike(caster && ctx.fx.isActive(caster) ? caster : null, attacker, { amount, damageType: ctx.line.damageType ?? 'lightning', label: `${label} (reflect)`, canMiss: false, canCrit: false, isMelee: false })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    const duration = skill?.effects.find((l) => l.kind === 'shield')?.duration ?? 3
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: duration, data: { mag: shieldLeft(who), attacker: '' } })
  },
  incomingDamagePercent: (ctx, incoming) => {
    settle(ctx)
    if (ctx.hook) {
      ctx.hook.data.attacker = incoming.attacker?.id ?? ''
      ctx.hook.data.mag = shieldLeft(ctx.holder)
    }
    return 0
  },
  afterHit: (ctx) => settle(ctx),
  onTurnStart: (ctx) => settle(ctx),
}
export default handler
