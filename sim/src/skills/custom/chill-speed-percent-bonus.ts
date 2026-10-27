import type { CustomHandler, HookContext } from './types.ts'

/**
 * Permafrost (Arcanist, Rime II; docs/classes/arcanist.md §4.2): Chill the holder applies moves Speed a further
 * `percent`% (−10, on top of the status's ×0.75). Reading: the sim has no joint on a status being applied, so the
 * hook keeps a Speed modifier in step with every Chill whose sourceId is the holder — synced at the holder's fight
 * start, turn start and after each of its actions. The modifier's turns match the Chill's and both count down at the
 * victim's turn end, so they expire together; a cleansed Chill drops the modifier at the next sync.
 */
function sync(ctx: HookContext): void {
  const key = `permafrost:${ctx.holder.id}`
  const percent = ctx.line.percent ?? 0
  for (const e of ctx.state.actors) {
    if (e.side === ctx.holder.side) continue
    const chill = e.statuses.find((s) => s.id === 'chill' && s.sourceId === ctx.holder.id)
    const existing = e.modifiers.find((m) => m.sourceId === key)
    if (chill) {
      const turns = Math.max(1, chill.turnsLeft ?? 1)
      if (existing) existing.turnsLeft = turns
      else e.modifiers.push({ stat: 'speed', amount: 0, percent, turnsLeft: turns, sourceId: key })
    } else if (existing) e.modifiers = e.modifiers.filter((m) => m !== existing)
  }
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
    sync({ ...ctx, holder })
  },
  onFightStart: sync,
  onTurnStart: sync,
  onSkillUsed: (ctx) => sync(ctx),
  modifyWeight: (ctx, w) => {
    sync(ctx)
    return w
  },
}
export default handler
