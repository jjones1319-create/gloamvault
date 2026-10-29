import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
}

/**
 * Death's Whisper (Shade, Shadow V; docs/classes/shade.md §4.1): a crit from Veil applies Fear for `duration` turns to
 * every other enemy. (Its Crit Rate cap is `crit-cap-raise`.)
 * Reading: the passive notes at each of the holder's turn starts whether it begins the turn Veiled (the fight ends
 * Veil the moment the holder attacks, before any line resolves); the crit is known only once the fight logs the hit,
 * so it settles when the action has resolved — in the fight's `modifyWeight` call, which every action makes once it is
 * done: a Veiled turn whose action landed a crit Fears every enemy it did not crit (the usual resist roll; bosses are
 * immune by role).
 */
const handler: CustomHandler = {
  onTurnStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.veiledAction = ctx.fx.hasStatus(ctx.holder, 'veil') ? ctx.holder.tally.actions : -1
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook || hook.data.veiledAction !== ctx.holder.tally.actions || hook.data.fearedAction === ctx.holder.tally.actions) return weight
    const crits = new Set(
      ctx.state.log
        .slice(actionStart(ctx))
        .filter((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.data?.crit === true && e.targetId)
        .map((e) => e.targetId as string),
    )
    if (crits.size === 0) return weight
    hook.data.fearedAction = ctx.holder.tally.actions
    ctx.fx.log('deathsWhisper', `${ctx.holder.name}'s strike from the dark chills the room`, { actorId: ctx.holder.id })
    for (const e of ctx.fx.enemiesOf(ctx.holder)) if (!crits.has(e.id)) ctx.fx.applyStatus(e, { status: 'fear', duration: Math.max(1, ctx.line.duration ?? 1) }, ctx.holder.id)
    return weight
  },
}
export default handler
