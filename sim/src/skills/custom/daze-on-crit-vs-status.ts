import type { CustomHandler, HookContext } from './types.ts'

/**
 * Opportunist (Shade, Shadow II; docs/classes/shade.md §4.2): a crit by the holder on a target already under any
 * status Dazes it at `chance`%. Reading: no joint reports a crit at hit time, and the hit's log event is written
 * after the attacker's `onDealtDamage`, so the hook remembers each hit (target, whether it held a status, the log
 * length) and settles it at the next hit or at the action's end, reading the crit flag from the hit's own event.
 */
function settle(ctx: HookContext): void {
  const d = ctx.hook?.data
  if (!d || typeof d.pendingTarget !== 'string' || d.pendingTarget === '') return
  const id = d.pendingTarget
  const had = d.pendingHadStatus === true
  const from = typeof d.logLen === 'number' ? d.logLen : 0
  d.pendingTarget = ''
  const hit = ctx.state.log.slice(from).find((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId === id)
  if (!had || hit?.data?.crit !== true) return
  const target = ctx.state.actors.find((a) => a.id === id)
  if (!target || !ctx.fx.isActive(target) || !ctx.rng.pct(ctx.line.chance ?? 0)) return
  ctx.fx.applyStatus(target, { status: 'daze' }, ctx.holder.id)
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null, data: { pendingTarget: '' } })
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (incoming.isDot || !ctx.hook) return
    settle(ctx)
    ctx.hook.data.pendingTarget = target.id
    ctx.hook.data.pendingHadStatus = target.statuses.length > 0
    ctx.hook.data.logLen = ctx.state.log.length
  },
  onSkillUsed: (ctx) => settle(ctx),
  modifyWeight: (ctx, w) => {
    settle(ctx)
    return w
  },
}
export default handler
