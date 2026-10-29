import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

const ID = 'field-trap-front-action'

/** Trapmaster's trap damage bonus (Ranger, Trapper V): the percent on the Ranger's own `trapmaster` passive, else 0. */
function trapBonus(ranger: HookContext['holder']): number {
  return ranger.hooks.find((h) => h.customId === 'trapmaster' && h.sourceId === ranger.id)?.line.percent ?? 0
}

function fire(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook) return
  const enemy = ctx.holder
  const ranger = ctx.state.actors.find((a) => a.id === hook.sourceId)
  // One jaw: the first enemy to trip it springs it for everyone.
  for (const a of ctx.state.actors) for (const h of a.hooks.filter((x) => x.customId === ID && x.sourceId === hook.sourceId)) ctx.fx.removeHook(a, h)
  if (!ranger) return
  ctx.fx.log('trap', `${enemy.name} steps into ${ranger.name}'s bear jaw`, { actorId: ranger.id, targetId: enemy.id })
  const type = ctx.line.damageType ?? 'pierce'
  const amount = roundHalfUp((ctx.fx.attackFor(ranger, type) * (ctx.line.multiplier ?? 2.5) * Number(hook.data.scale ?? 100) * (100 + trapBonus(ranger))) / 10_000)
  let dealt = 0
  if (amount > 0) dealt = ctx.fx.strike(ranger, enemy, { amount, damageType: type, label: 'bear jaw', canMiss: false, canCrit: false, isMelee: false }).dealt
  if (!ctx.fx.isActive(enemy)) return
  if (dealt > 0) ctx.fx.applyStatus(enemy, { status: 'bleed', duration: Math.max(1, ctx.line.amount ?? 3), magnitude: dealt }, ranger.id)
  ctx.fx.applyStatus(enemy, { status: ctx.line.status ?? 'root', duration: Math.max(1, ctx.line.duration ?? 2) }, ranger.id)
}

/**
 * Bear Jaw (Ranger, Trapper IV; docs/classes/ranger.md §4.2): a trap laid on the enemy front row fires on the next
 * enemy action taken from the front row — `multiplier` × Attack of `damageType`, Bleed `amount` turns (ticking a share
 * of that blow, 03 §3.5) and `status` (Root) for `duration` turns.
 * Reading: the fight has no joint on an enemy's choice of action, so — as Tripwire does — the cast puts a hook on
 * every enemy, and the jaw springs at the turn start of the first enemy that begins a turn standing in the front row
 * (before it can act); then every copy of the jaw is gone. A second cast re-lays it. Trapmaster's +% applies.
 */
const handler: CustomHandler = {
  apply: (ctx, _target, scale) => {
    const ranger = ctx.holder
    for (const e of ctx.fx.enemiesOf(ranger)) ctx.fx.installHook(e, ctx.line, ranger.id, { sourceSkillId: ctx.sourceId, data: { scale } })
    ctx.fx.log('trap', `${ranger.name} sets a bear jaw before the front row`, { actorId: ranger.id })
  },
  onTurnStart: (ctx) => {
    if (ctx.hook && ctx.holder.row === 'front' && ctx.fx.isActive(ctx.holder)) fire(ctx)
  },
}
export default handler
