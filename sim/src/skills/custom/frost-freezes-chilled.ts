import type { CustomHandler } from './types.ts'

/**
 * Drowned Choir's Vestments, four pieces (08 §6): "a Chilled target hit by your Frost spell Freezes at once". The hook
 * sits on the wearer (hero.ts). Reading: `modifyLine` notes whether the holder's current action is a skill (a spell;
 * basic attacks and items are not), and `onDealtDamage` turns a Frost hit of that skill on a target already Chilled
 * into the line's `status` (Freeze; a boss takes Chill instead, 06 §7, through the status rules).
 */
const handler: CustomHandler = {
  modifyLine: (ctx, _line, source) => {
    if (ctx.hook) {
      ctx.hook.data.spell = source.kind === 'skill'
      ctx.hook.data.action = ctx.holder.tally.actions
    }
    return null
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (incoming.isDot || incoming.damageType !== 'frost') return
    const hook = ctx.hook
    if (hook && (hook.data.spell !== true || hook.data.action !== ctx.holder.tally.actions)) return
    if (!ctx.fx.isActive(target) || !ctx.fx.hasStatus(target, 'chill')) return
    const r = ctx.fx.applyStatus(target, { status: ctx.line.status ?? 'freeze' }, ctx.holder.id)
    if (r === 'applied') ctx.fx.log('setBonus', `The Drowned Choir's hymn freezes ${target.name} solid`, { actorId: ctx.holder.id, targetId: target.id })
  },
}
export default handler
