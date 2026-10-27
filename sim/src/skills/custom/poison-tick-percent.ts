import type { CustomHandler, HookContext } from './types.ts'

/**
 * Steeped Blades (Shade, Venom I; docs/classes/shade.md §4.2): Poison the holder applies ticks +`percent`%
 * (mastery +30%). Reading: Poison's tick is a percent of max HP kept in the instance's magnitude (3), so the hook
 * raises the magnitude of every Poison whose sourceId is the holder and still carries the record's base value —
 * synced at the holder's fight start, turn start and after each of its actions. A Poison the holder lands outside its
 * own action (a counter) is boosted at its next sync. The boosted magnitude may be fractional; the tick rounds.
 */
function sync(ctx: HookContext): void {
  const def = ctx.content.statuses.get('poison')
  const base = def?.percent ?? 3
  const boosted = (base * (100 + (ctx.line.percent ?? 0))) / 100
  for (const e of ctx.state.actors) {
    if (e.side === ctx.holder.side) continue
    for (const s of e.statuses) if (s.id === 'poison' && s.sourceId === ctx.holder.id && s.magnitude === base) s.magnitude = boosted
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
