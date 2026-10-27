import type { CustomHandler } from './types.ts'

/**
 * Net Throw (Ranger, Trapper II; docs/classes/ranger.md §4.2): the target is Grabbed for `duration` turn(s) — it
 * cannot act, swap rows or flee — until an ally's hit frees it; the Ranger's own shots never do, and the Grab
 * survives `amount` ally hits (Mastery: 1). Reading: a Grab status would make the Ranger the grabber (only it could
 * target the enemy; hurting the Ranger would free it), so the line first asks the status machinery whether a Grab
 * lands at all (role and size immunities, the resist roll), then swaps that Grab for this hook, which counts ally
 * hits in `counter`. Snare-Sense, Spring Trap and Heavy Hands read the hook as "held".
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ranger = ctx.holder
    if (!target || target.side === ranger.side || !ctx.fx.isActive(target)) return
    const r = ctx.fx.applyStatus(target, { status: 'grab', duration: ctx.line.duration ?? 1 }, ranger.id)
    if (r !== 'applied') {
      ctx.fx.log('netMiss', `${target.name} shrugs off the net (${r})`, { actorId: ranger.id, targetId: target.id })
      return
    }
    if (!ctx.fx.hasStatus(target, 'grab')) return
    ctx.fx.removeStatus(target, 'grab')
    target.grabbedBy = null
    ctx.fx.installHook(target, ctx.line, ranger.id, { sourceSkillId: ctx.sourceId, turnsLeft: Math.max(1, ctx.line.duration ?? 1), counter: 0 })
    ctx.fx.log('status', `${target.name} is netted`, { actorId: ranger.id, targetId: target.id, data: { status: 'net' } })
  },
  canAct: () => false,
  canSwapRow: () => false,
  canFlee: () => false,
  afterHit: (ctx, incoming) => {
    const hook = ctx.hook
    const a = incoming.attacker
    if (!hook || !a || a.side === ctx.holder.side || a.id === hook.sourceId) return
    hook.counter += 1
    if (hook.counter <= (ctx.line.amount ?? 0)) return
    ctx.fx.removeHook(ctx.holder, hook)
    ctx.fx.log('freed', `${ctx.holder.name} tears free of the net`, { actorId: ctx.holder.id, targetId: a.id })
  },
}
export default handler
