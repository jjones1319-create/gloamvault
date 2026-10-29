import type { Status } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Immovable (Warden, Vanguard V passive; docs/classes/warden.md §4.2): immune to Grab, Root, Web and energy push-back;
 * allies in your row are immune to Fear (Mastery, the same line with `amount` 1: to Grab too).
 * Reading: statuses.ts has no immunity joint, but its resist roll reads `status-resist-bonus` hooks on the target, so
 * the immunities are such hooks at 100% (as `status-immunity` does): on the holder for Grab, Root, Web and the two
 * statuses whose only effect is energy push-back (Daze −500, Petrify −1,000); on each ally standing in the holder's row
 * for Fear (and Grab), re-checked at the fight's start and at every turn start of the holder (an ally who swapped rows
 * keeps or loses the ward at the holder's next turn; a downed holder's wards fall away). A `timeline` line's push-back
 * (a monster's shove) has no joint a hook can answer — effects.ts adds the energy directly — so that part logs
 * `hookStub` once per fight; it needs a target-side check in effects.ts `applyLine` case 'timeline'.
 */
const SELF: readonly Status[] = ['grab', 'root', 'web', 'daze', 'petrify']

function ward(ctx: HookContext, who: Actor, status: Status, self: boolean): void {
  if (who.hooks.some((h) => h.customId === 'status-resist-bonus' && h.data.immovable === ctx.holder.id && h.line.status === status)) return
  ctx.fx.installHook(who, { kind: 'custom', customId: 'status-resist-bonus', status, percent: 100, note: 'Immovable: a full resist' }, ctx.holder.id, {
    sourceSkillId: ctx.hook?.sourceSkillId ?? null,
    replace: false,
    data: { immovable: ctx.holder.id, self },
  })
}

function unward(ctx: HookContext, who: Actor): void {
  for (const h of [...who.hooks]) if (h.customId === 'status-resist-bonus' && h.data.immovable === ctx.holder.id && h.data.self !== true) ctx.fx.removeHook(who, h)
}

function sync(ctx: HookContext): void {
  const holder = ctx.holder
  const up = ctx.fx.isActive(holder)
  const rowStatuses: Status[] = (ctx.line.amount ?? 0) >= 1 ? ['fear', 'grab'] : ['fear']
  for (const ally of ctx.state.actors) {
    if (ally === holder || ally.side !== holder.side) continue
    if (up && ally.row === holder.row && ctx.fx.isActive(ally)) for (const s of rowStatuses) ward(ctx, ally, s, false)
    else unward(ctx, ally)
  }
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    for (const s of SELF) ward(ctx, ctx.holder, s, true)
    sync(ctx)
    const key = 'stub:immovable'
    if (!ctx.state.flags[key]) {
      ctx.state.flags[key] = true
      ctx.fx.log('hookStub', 'immovable: a shove of the timeline itself (not Daze or Petrify) still pushes the Warden back', { actorId: ctx.holder.id })
    }
  },
  onTurnStart: (ctx) => sync(ctx),
}
export default handler
