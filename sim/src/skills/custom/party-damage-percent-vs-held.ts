import type { CustomHandler, HookContext } from './types.ts'

/**
 * Snare-Sense (Ranger, Trapper III; docs/classes/ranger.md §4.2): every ally's damage to targets under Root, Grab,
 * Web or a Net +`percent`. Reading: the Ranger's passive keeps a marker hook (data.marker) on every enemy,
 * refreshed at the fight's start and the Ranger's turn starts; a marker's `incomingDamagePercent` adds the percent
 * to hits from the Ranger's side while its holder is held and the Ranger stands.
 */
const ID = 'party-damage-percent-vs-held'

function ensure(ctx: HookContext): void {
  if (!ctx.hook || ctx.hook.data.marker) return
  const ranger = ctx.holder
  for (const e of ctx.fx.enemiesOf(ranger)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === ranger.id)) continue
    ctx.fx.installHook(e, ctx.line, ranger.id, { sourceSkillId: ctx.hook.sourceSkillId, data: { marker: true } })
  }
}

const handler: CustomHandler = {
  onFightStart: (ctx) => ensure(ctx),
  onTurnStart: (ctx) => ensure(ctx),
  incomingDamagePercent: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook?.data.marker || incoming.isDot || !incoming.attacker) return 0
    const ranger = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!ranger || !ctx.fx.isActive(ranger) || incoming.attacker.side !== ranger.side) return 0
    const held = ctx.holder.statuses.some((s) => s.id === 'root' || s.id === 'grab' || s.id === 'web') || ctx.holder.hooks.some((h) => h.customId === 'net-held')
    return held ? (ctx.line.percent ?? 0) : 0
  },
}
export default handler
