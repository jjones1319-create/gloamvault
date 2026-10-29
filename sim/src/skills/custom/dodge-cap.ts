import type { CustomHandler, HookContext } from './types.ts'

/**
 * Edge of the Dance (Blade, Iron Dance V passive; docs/classes/blade.md §4.1): "Your Dodge cap is 40%" — the holder's
 * Dodge cap becomes `amount`. Stub: the cap is applied when the hero's derived stats are built (stats.ts deriveStats
 * caps Dodge at `derived.dodge.cap` or the species' `dodgeCap`), before any passive runs, and a fight hook cannot
 * see the value the cap cut off. The joint: hero.ts `heroLoad` reading this line on a loadout passive into the
 * StatInputs' species `dodgeCap`. Tier V (locked until Segment 3, D-099). Logs `hookStub` once per fight.
 */
export const STUB = true

function note(ctx: HookContext): void {
  const key = 'stub:dodge-cap'
  if (ctx.state.flags[key]) return
  ctx.state.flags[key] = true
  ctx.fx.log('hookStub', 'dodge-cap: a raised Dodge cap is not modelled yet', { actorId: ctx.holder.id })
}

const handler: CustomHandler = {
  apply: (ctx) => note(ctx),
  onFightStart: (ctx) => note(ctx),
}
export default handler
