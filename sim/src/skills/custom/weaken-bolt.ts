import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * The Crossbowman's crossbow arm breaks (06 §3.1 part-break: "Bolt ×0.8 and light weight for the rest of the
 * fight"). Runs with the monster as holder and target and installs a hook on it: `modifyLine` scales the damage
 * line of the monster's heaviest attack (the Bolt) by `multiplier`, and `modifyWeight` caps the weight it spends at
 * light (800, 03 §3.1). Reading: `modifyWeight` sees no attack, so every attack is capped — only the heavy Bolt
 * changes in practice (Reload-kick is already light).
 */
const LIGHT_WEIGHT = 800

function heaviest(holder: Actor): Set<string> {
  const attacks = holder.monster?.attacks ?? []
  const max = attacks.reduce((m, a) => Math.max(m, a.weight), 0)
  return new Set(attacks.filter((a) => a.weight === max && a.multiplier > 0).map((a) => a.id))
}

const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('partBreakEffect', `${ctx.holder.name}'s crossbow arm hangs limp: weaker, lighter bolts`, { actorId: ctx.holder.id })
  },
  modifyLine: (ctx, line, source) => {
    if (line.kind !== 'damage' || !heaviest(ctx.holder).has(source.id)) return null
    return { ...line, multiplier: (line.multiplier ?? 1) * (ctx.line.multiplier ?? 0.8) }
  },
  modifyWeight: (_ctx, weight) => Math.min(weight, LIGHT_WEIGHT),
}
export default handler
