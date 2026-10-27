import { roundHalfUp } from '../../stats.ts'
import type { DamageType } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
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
 * Vital Point (Shade, Shadow III; docs/classes/shade.md §4.1): below `percent`% HP the skill's damage multiplier
 * becomes `multiplier` (1.9× → 3.8×). The line follows the damage line, so `apply` reads this action's last damage
 * event on the target, rebuilds the HP the target had before the hit (HP now + damage dealt) and, when that was
 * under the threshold, pays the difference — dealt × (multiplier / base − 1) — as an extra Defense-ignoring strike,
 * pre-scaled by the target's element multiplier so the total equals one hit at the execute multiplier. A target
 * the first hit killed needs nothing more.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.fx.isActive(target)) return
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    const dmgLine = skill?.effects.find((l) => l.kind === 'damage')
    const base = dmgLine?.multiplier ?? 1
    const mult = ctx.line.multiplier ?? base
    if (base <= 0 || mult <= base) return
    const hit = ctx.state.log
      .slice(actionStart(ctx))
      .reverse()
      .find((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId === target.id)
    const dealt = hit?.amount ?? 0
    if (dealt <= 0) return
    if ((target.hp + dealt) * 100 >= target.maxHp * (ctx.line.percent ?? 25)) return
    const type = dmgLine?.damageType ?? 'pierce'
    const pct = typePercent(ctx, target, type)
    if (pct <= 0) return
    const extra = roundHalfUp((dealt * (mult / base - 1) * 100) / pct)
    if (extra <= 0) return
    ctx.fx.strike(ctx.holder, target, { amount: extra, damageType: type, label: `${skill?.name ?? 'strike'} (vital point)`, canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  },
}
export default handler
