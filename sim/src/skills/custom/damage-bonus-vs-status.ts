import { roundHalfUp } from '../../stats.ts'
import type { DamageType, Status } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/** Log kinds that open an actor's own action (the fight logs one per turn taken). */
const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])
/** Log kinds that show an actor's turn arrived (its own action, a lost turn, its DoT ticks). */
const TURN_KINDS = new Set([...STARTS, 'skip', 'held', 'dot', 'hot'])

/** Index of the holder's current action marker in the log (0 when none). */
function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
}

/** Daze is instant (03 §3.5) and never sits in `statuses`. Reading: a target counts as Dazed from the Daze until its next turn arrives. */
function dazedNow(ctx: HookContext, target: Actor): boolean {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (!e) continue
    if (e.actorId === target.id && TURN_KINDS.has(e.kind)) return false
    if (e.kind === 'status' && e.targetId === target.id && e.data?.status === 'daze') return true
  }
  return false
}

function holds(ctx: HookContext, target: Actor, status: Status | undefined): boolean {
  if (!status) return target.statuses.length > 0
  if (status === 'daze') return dazedNow(ctx, target)
  return target.statuses.some((s) => s.id === status)
}

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
 * +`percent`% damage against a target under `status` — any status when none is named.
 * - Opportunist (Shade, Shadow II; shade.md §4.2): a passive hook; every non-DoT hit by the holder is scaled.
 * - Arc Chain (Arcanist; arcanist.md §4.1) and Throat Cut (Shade; shade.md §4.1): a line of the skill. Resolving
 *   before the damage line, `apply` installs a one-cast hook on the caster that scales the skill's own hits;
 *   resolving after it, `apply` reads this action's damage events in the log and pays the difference as an extra
 *   Defense-ignoring strike (pre-scaled by the target's element multiplier so the total matches). Reading: Throat
 *   Cut's "Dazed" target is read from the log (Daze is instant), see `dazedNow`.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    const hits = ctx.state.log.slice(actionStart(ctx)).filter((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && (e.amount ?? 0) > 0)
    if (hits.length === 0) {
      ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, data: { temp: true, inSkill: true } })
      return
    }
    const type = skill?.effects.find((l) => l.kind === 'damage')?.damageType ?? 'pierce'
    for (const hit of hits) {
      const tgt = ctx.state.actors.find((a) => a.id === hit.targetId)
      if (!tgt || !ctx.fx.isActive(tgt) || (target && tgt !== target) || !holds(ctx, tgt, ctx.line.status)) continue
      const pct = typePercent(ctx, tgt, type)
      if (pct <= 0) continue
      const extra = roundHalfUp(((hit.amount ?? 0) * (ctx.line.percent ?? 0)) / pct)
      if (extra > 0) ctx.fx.strike(ctx.holder, tgt, { amount: extra, damageType: type, label: `${skill?.name ?? 'strike'} (opening)`, canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
    }
  },
  modifyLine: (ctx, _line, source) => {
    if (ctx.hook?.data.temp) ctx.hook.data.inSkill = source.id === ctx.hook.sourceSkillId
    return null
  },
  outgoingDamagePercent: (ctx, target, incoming) => {
    if (incoming.isDot) return 0
    if (ctx.hook?.data.temp && ctx.hook.data.inSkill !== true) return 0
    return holds(ctx, target, ctx.line.status) ? (ctx.line.percent ?? 0) : 0
  },
  onSkillUsed: (ctx, skill) => {
    if (ctx.hook?.data.temp && skill.id === ctx.hook.sourceSkillId) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
