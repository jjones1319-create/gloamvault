import type { CustomHandler } from './types.ts'

/**
 * Bone Knight's Stand (Warden, Bulwark III; docs/classes/warden.md §4.1): immune to `status` (Daze, Stun, Grab —
 * one line each) until your next turn.
 * Reading: statuses.ts rolls the applier's chance against `status-resist-bonus` hooks on the target by that id, so
 * the line installs such a hook with `percent` 100 for the status, dropping at the holder's next turn start. The
 * immunity hooks never replace each other (one per status).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    if (!ctx.line.status) return
    ctx.fx.installHook(holder, { kind: 'custom', customId: 'status-resist-bonus', status: ctx.line.status, percent: 100, note: 'status-immunity: a 100% resist until your next turn' }, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, replace: false })
    ctx.fx.log('immune', `${holder.name} shrugs off ${ctx.line.status} until its next turn`, { actorId: holder.id, data: { status: ctx.line.status } })
  },
}
export default handler
