import type { CustomHandler } from './types.ts'

/**
 * Hunter's Cage (Ranger, Trapper V; docs/classes/ranger.md §4.2): a Grab for `duration` turns that no damage frees, and
 * `status` (Weaken) for `duration` turns; a boss is caged `amount` turns (1; Mastery 2) and takes no Weaken. The
 * skill's own Mark line follows.
 * Reading: the cage is Net Throw's hold made unbreakable — the status machinery decides first whether a Grab lands at
 * all (resist roll, size and role immunities), then that Grab is swapped for a `net-held` hook that survives any number
 * of hits (`amount` 999), lasting the cage's turns. A boss is immune to Grab by role (03 §3.5); the sheet's "bosses:
 * 1 turn" is the cage's own exception, so a boss is caged without the roll.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ranger = ctx.holder
    if (!target || target.side === ranger.side || !ctx.fx.isActive(target)) return
    const boss = target.monster?.isBoss === true
    const turns = Math.max(1, boss ? (ctx.line.amount ?? 1) : (ctx.line.duration ?? 2))
    let caged = boss
    if (!boss) {
      const r = ctx.fx.applyStatus(target, { status: 'grab', duration: turns }, ranger.id)
      caged = r === 'applied' && ctx.fx.hasStatus(target, 'grab')
      if (!caged) ctx.fx.log('netMiss', `${target.name} slips the cage (${r})`, { actorId: ranger.id, targetId: target.id })
    }
    if (caged) {
      ctx.fx.removeStatus(target, 'grab')
      target.grabbedBy = null
      ctx.fx.installHook(target, { kind: 'custom', customId: 'net-held', amount: 999, duration: turns, note: "Hunter's Cage: no hit frees it" }, ranger.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns, counter: 0 })
      ctx.fx.log('status', `${target.name} is caged`, { actorId: ranger.id, targetId: target.id, data: { status: 'net' } })
    }
    if (!boss && ctx.line.status && ctx.fx.isActive(target)) ctx.fx.applyStatus(target, { status: ctx.line.status, duration: Math.max(1, ctx.line.duration ?? 2) }, ranger.id)
  },
}
export default handler
