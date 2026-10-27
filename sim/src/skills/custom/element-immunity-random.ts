import { ELEMENTS } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Warded (elite affix, 06 §2): immune to one element rolled at the fight's start — never one the template is weak
 * to — shown on the nameplate; a hit of that element deals 0 and pulls the champion `energy` forward (+100 = it
 * acts 100 energy sooner). Installed on the champion at spawn (explore.ts). The element is `hook.data.element`
 * (the HUD reads it) and is also pushed onto the monster's `immune` list so the type multiplier zeroes the hit;
 * the pull is applied in `incomingDamagePercent`, the one target-side member that runs exactly once per landed hit.
 */
function roll(ctx: HookContext): void {
  const hook = ctx.hook
  const m = ctx.holder.monster
  if (!hook || !m || typeof hook.data.element === 'string') return
  const candidates = ELEMENTS.filter((e) => !m.weak.includes(e))
  if (candidates.length === 0) return
  const element = ctx.rng.pick(candidates)
  hook.data.element = element
  if (!m.immune.includes(element)) m.immune.push(element)
  ctx.fx.log('ward', `${ctx.holder.name} is warded against ${element}`, { actorId: ctx.holder.id, data: { element } })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onFightStart: (ctx) => roll(ctx),
  incomingDamagePercent: (ctx, incoming) => {
    roll(ctx)
    const element = ctx.hook?.data.element
    if (typeof element !== 'string' || element !== incoming.damageType || incoming.isDot) return 0
    const pull = ctx.line.energy ?? 0
    if (pull) {
      ctx.holder.energy += pull
      ctx.fx.log('wardPull', `${ctx.holder.name} shrugs off the ${element} and surges forward`, { actorId: ctx.holder.id, amount: pull })
    }
    return -100
  },
}
export default handler
