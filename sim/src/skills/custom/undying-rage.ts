import type { CustomHandler, HookContext } from './types.ts'

/**
 * Undying Rage (Blade, Bloodletter IV passive; docs/classes/blade.md §4.3; D-099): a hit that would down the holder
 * while Berserk leaves it at 1 HP with Regen `percent`% of max HP for `duration` turns (10% for 2), `amount` time(s)
 * per FLOOR (D-099: once; Deathless, beside it, raises the limit to its own `amount`, 2, and the Regen to its own
 * `duration`). The Mastery's marker line `undying-rage-unbound` lets it work outside Berserk too.
 * The floor's count: buildHeroActor hands the passive's hook the triggers earlier on this floor as `data.floorUsed`
 * (progress.ts floorUsesFor); each trigger adds one and logs a 'floorLimit' event (data.skillId = this skill) that
 * progress.ts counts after the fight. Berserk is the Blade's own skill (`blade-berserk`): its stat lines sit on the
 * holder as modifiers sourced to it while it lasts. DoT ticks never down through the hit pipeline, so they are not
 * caught here (as Unbreakable).
 */
const BERSERK = 'blade-berserk'
const DEATHLESS = 'deathless'

function deathlessLine(ctx: HookContext): { amount?: number; duration?: number } | null {
  const h = ctx.holder.hooks.find((k) => k.customId === DEATHLESS)
  return h ? h.line : null
}

const handler: CustomHandler = {
  beforeDowned: (ctx) => {
    const hook = ctx.hook
    if (!hook) return false
    const holder = ctx.holder
    const unbound = holder.hooks.some((k) => k.customId === 'undying-rage-unbound')
    const berserk = holder.modifiers.some((m) => m.sourceId === BERSERK)
    if (!berserk && !unbound) return false
    const deathless = deathlessLine(ctx)
    const limit = Math.max(ctx.line.amount ?? 1, deathless?.amount ?? 0)
    const used = Number(hook.data.floorUsed ?? 0)
    if (used >= limit) return false
    hook.data.floorUsed = used + 1
    const skillId = hook.sourceSkillId ?? 'blade-undying-rage'
    ctx.fx.log('floorLimit', `${holder.name}'s rage will not let it fall (${used + 1} of ${limit} this floor)`, { actorId: holder.id, data: { skillId } })
    const duration = Math.max(ctx.line.duration ?? 2, deathless?.duration ?? 0)
    ctx.fx.applyStatus(holder, { status: 'regen', duration, magnitude: ctx.line.percent ?? 10 }, holder.id)
    ctx.fx.log('lastStand', `${holder.name} refuses to fall`, { actorId: holder.id })
    return true
  },
}
export default handler
