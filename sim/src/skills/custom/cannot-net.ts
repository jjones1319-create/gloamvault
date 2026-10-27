import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * The Netter's net hand breaks (06 §3.1 part-break: "cannot Net for the rest of the fight"). Runs with the monster
 * as holder and target: every attack whose id or name says "net" (Net Throw, not Reload) leaves `attackIds`, and a
 * hook on the monster strips it again at each turn start so a phase change cannot bring it back.
 */
const PATTERN = /net/i

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
    ctx.fx.log('partBreakEffect', `${ctx.holder.name} can no longer throw the net`, { actorId: ctx.holder.id, data: { removed: removed.join(',') } })
  },
  onTurnStart: (ctx) => {
    strip(ctx.holder)
  },
}
export default handler
