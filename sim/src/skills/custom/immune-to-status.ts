import type { CustomHandler, HookContext } from './types.ts'

/**
 * Lantern of the Mind (Arcanist, Arcana III; arcanist.md §4.3) and Ward of Faith (Mender): the target cannot
 * receive `status` for `duration` turns. Reading: statuses.ts has no immunity joint but its resist roll reads
 * `status-resist-bonus` hooks on the target, so the line installs one with `percent` 100 for the duration — every
 * attempt to apply the status is resisted (a resisted roll also trains Willpower, which an immune hero would not).
 * Two immunities from one cast (Blind and Fear) must both stand, so the hooks stack instead of replacing.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    const status = ctx.line.status
    if (!status) return
    const ward: HookContext['line'] = { kind: 'custom', customId: 'status-resist-bonus', status, percent: 100, note: 'immune-to-status: a full resist for the duration' }
    ctx.fx.installHook(who, ward, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3, replace: false })
    ctx.fx.log('ward', `${who.name} is warded against ${status}`, { actorId: ctx.holder.id, targetId: who.id })
  },
}
export default handler
