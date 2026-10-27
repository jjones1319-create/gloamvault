import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Hoarfrost (Arcanist, Rime III; docs/classes/arcanist.md §4.2): while the Arcanist is in the fight, Chilled enemies
 * have `amount` pp Accuracy (−10). Reading: the sim's auras reach allies only and `accuracyBonus` sits on the
 * attacker, so the Arcanist's hook seeds a companion hook (same line, sourceId = the Arcanist) on every enemy at
 * fight start and at each of its turn starts (adds, summons); the companion answers `accuracyBonus` while its holder
 * is Chilled and the Arcanist stands.
 */
const ID = 'chill-accuracy-penalty'

function seed(ctx: HookContext, owner: Actor): void {
  for (const e of ctx.fx.enemiesOf(owner)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(e, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? ctx.sourceId })
  }
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
    seed(ctx, holder)
  },
  onFightStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  accuracyBonus: (ctx) => {
    if (!ctx.hook || ctx.hook.sourceId === ctx.holder.id) return 0
    const owner = ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId)
    if (!owner || !ctx.fx.isActive(owner)) return 0
    return ctx.fx.hasStatus(ctx.holder, 'chill') ? (ctx.line.amount ?? 0) : 0
  },
}
export default handler
