import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'apex-mark-percent'

/** Seeds a mirror of the line (sourceId = the Ranger) on every enemy that lacks one: adds and summons included. */
function seed(ctx: HookContext, owner: Actor): void {
  for (const e of ctx.fx.enemiesOf(owner)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(e, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? null, data: { mirror: true } })
  }
}

/**
 * Apex Hunter (Ranger, Marksman V; docs/classes/ranger.md §4.1): Marked enemies take +`percent`% damage from the whole
 * party instead of the Mark's own +20%. Reading: the Ranger's passive seeds a mirror on every enemy (at the fight's
 * start and each of its turn starts, for adds); while the Ranger stands, a Marked holder of a mirror takes the
 * difference between `percent` and the Mark it already carries (the status's +20, or a Hunter's Mark Mastery's +25 —
 * `mark-damage-percent`), so the strongest Mark wins rather than adding. Two Apex Rangers count once (the higher).
 * DoT ticks are not scaled (Mark is a hit modifier).
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook && ctx.hook.data.mirror !== true) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    if (ctx.hook && ctx.hook.data.mirror !== true) seed(ctx, ctx.holder)
  },
  incomingDamagePercent: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror !== true || incoming.isDot || !ctx.fx.hasStatus(ctx.holder, 'mark')) return 0
    // Only the strongest standing Apex mirror on this holder answers.
    const mirrors = ctx.holder.hooks.filter((h) => h.customId === ID && h.data.mirror === true && ctx.state.actors.some((a) => a.id === h.sourceId && ctx.fx.isActive(a)))
    const best = mirrors.reduce<typeof hook | null>((b, h) => (b === null || (h.line.percent ?? 0) > (b.line.percent ?? 0) ? h : b), null)
    if (best !== hook) return 0
    const base = ctx.content.statuses.get('mark')?.effects.find((e) => e.kind === 'custom' && e.customId === 'damage-taken-percent')?.percent ?? 20
    const mastery = ctx.holder.hooks.filter((h) => h.customId === 'mark-damage-percent').reduce((m, h) => Math.max(m, h.line.percent ?? base), base)
    return Math.max(0, (ctx.line.percent ?? base) - mastery)
  },
}
export default handler
