import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * The Broodmother's egg sac breaks (06 §3.1 part-break: "no more Brood Calls, rare roll ×2" — the doubled rare roll
 * is loot.ts's for every break). Runs with the monster as holder and target: every attack whose id or name says
 * "brood" leaves `attackIds`, and a hook on the monster strips it again at each turn start.
 */
const PATTERN = /brood/i

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
    ctx.fx.log('partBreakEffect', `${ctx.holder.name}'s egg sac bursts: no more brood calls`, { actorId: ctx.holder.id, data: { removed: removed.join(',') } })
  },
  onTurnStart: (ctx) => {
    strip(ctx.holder)
  },
}
export default handler
