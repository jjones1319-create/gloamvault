import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'poison-spreads-on-death'

/** Spreads a dead enemy's Poison to its living allies in its row (`rows` 2: both rows), once per death. */
function spread(ctx: HookContext, owner: Actor, dead: Actor, rows: number): void {
  const key = `plague:${owner.id}:${dead.id}`
  if (ctx.state.flags[key]) return
  const poison = dead.statuses.find((s) => s.id === 'poison')
  if (!poison) return
  ctx.state.flags[key] = true
  const targets = ctx.state.actors.filter((a) => a.side === dead.side && a !== dead && ctx.fx.isActive(a) && (rows >= 2 || a.row === dead.row))
  if (targets.length === 0) return
  ctx.fx.log('plague', `${dead.name}'s poison bursts out over ${rows >= 2 ? 'the field' : `the ${dead.row} row`}`, { actorId: owner.id, targetId: dead.id })
  for (const t of targets) ctx.fx.applyStatus(t, { status: 'poison', duration: Math.max(1, poison.turnsLeft ?? 4), magnitude: poison.magnitude }, owner.id)
}

/**
 * Plague Knife (Shade, Venom IV; docs/classes/shade.md §4.2): when the knife's target dies Poisoned, its Poison spreads
 * to every enemy in its row (`amount` 2, the Mastery: both rows), with the dead one's turns left and strength.
 * Reading: the line puts a mark on the target (sourceId = the Shade) whose `onDeath` spreads at once; a death by a
 * Poison tick fires no death joint (the fight's DoT path), so the Shade also keeps a sweeper that spreads the
 * Poison of marked enemies found dead at each of its turn starts and after each of its actions (`modifyWeight`).
 * `state.flags` keeps each death to one spread.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const owner = ctx.holder
    if (!target || target.side === owner.side) return
    ctx.fx.installHook(target, ctx.line, owner.id, { sourceSkillId: ctx.sourceId, data: { mark: true, rows: Math.max(1, ctx.line.amount ?? 1) } })
    if (!owner.hooks.some((h) => h.customId === ID && h.data.sweeper === true)) ctx.fx.installHook(owner, ctx.line, owner.id, { sourceSkillId: ctx.sourceId, data: { sweeper: true } })
  },
  onDeath: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.mark !== true) return
    const owner = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (owner) spread(ctx, owner, ctx.holder, Number(hook.data.rows ?? 1))
  },
  onTurnStart: (ctx) => sweep(ctx),
  modifyWeight: (ctx, weight) => {
    sweep(ctx)
    return weight
  },
}

function sweep(ctx: HookContext): void {
  if (ctx.hook?.data.sweeper !== true) return
  const owner = ctx.holder
  for (const a of ctx.state.actors) {
    if (a.side === owner.side || !a.gone || a.fled) continue
    const mark = a.hooks.find((h) => h.customId === ID && h.sourceId === owner.id && h.data.mark === true)
    if (mark) spread(ctx, owner, a, Number(mark.data.rows ?? 1))
  }
}
export default handler
