import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * The Plague Rat's swollen flank breaks (06 §3.1 part-break: "no death cloud"). Runs with the monster as holder and
 * target: every attack whose id or name says "cloud" (Death Cloud) leaves `attackIds` and a hook on the monster
 * keeps it out. Reading: the cloud itself ("dies into a Poison cloud") is a zero-weight attack the fight has no
 * on-death joint for yet, so today this break only stops the rare action pick; `state.flags['noDeathCloud:<id>']`
 * is set for the day the fight fires death attacks.
 */
const PATTERN = /cloud/i

function strip(holder: Actor): string[] {
  const m = holder.monster
  if (!m) return []
  const hit = (id: string) => {
    const a = m.attacks.find((x) => x.id === id)
    return PATTERN.test(id) || (a !== undefined && PATTERN.test(a.name))
  }
  const removed = m.attackIds.filter(hit)
  if (removed.length) m.attackIds = m.attackIds.filter((id) => !hit(id))
  return removed
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const removed = strip(ctx.holder)
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.state.flags[`noDeathCloud:${ctx.holder.id}`] = true
    ctx.fx.log('partBreakEffect', `${ctx.holder.name}'s flank bursts: no death cloud`, { actorId: ctx.holder.id, data: { removed: removed.join(',') } })
  },
  onTurnStart: (ctx) => {
    strip(ctx.holder)
  },
}
export default handler
