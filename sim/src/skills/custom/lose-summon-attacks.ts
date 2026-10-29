import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * A part that calls help breaks (06 §3.2: the Crypt Sexton's bell → "no Raise"; the Charnel Hulk's second torso →
 * "no Shed"). Runs with the monster as holder and target: every attack with a line that names `summonId` (a summon
 * line, or a custom rider carrying it) leaves `attackIds`, and a hook on the monster strips it again at each turn
 * start so a phase change cannot bring it back. The line's `damageType`, when set, is the break's damage type (the
 * bell breaks to Blunt, effects.ts breakPart).
 */
function strip(holder: Actor, summonId: string): string[] {
  const m = holder.monster
  if (!m) return []
  const calls = (id: string) => m.attacks.find((a) => a.id === id)?.effects.some((l) => l.summonId === summonId) ?? false
  const removed = m.attackIds.filter(calls)
  if (removed.length) m.attackIds = m.attackIds.filter((id) => !calls(id))
  return removed
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const id = ctx.line.summonId
    if (!id) return
    const removed = strip(ctx.holder, id)
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('partBreakEffect', `${ctx.holder.name} can no longer call on ${ctx.content.monsters.get(id)?.name ?? id}`, { actorId: ctx.holder.id, data: { removed: removed.join(',') } })
  },
  onTurnStart: (ctx) => {
    if (ctx.line.summonId) strip(ctx.holder, ctx.line.summonId)
  },
}
export default handler
