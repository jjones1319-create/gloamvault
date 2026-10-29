import type { CustomHandler, HookContext } from './types.ts'

/**
 * Paradox (Arcanist passive, Arcana V; docs/classes/arcanist.md §4.3): the holder's heavy casts weigh `amount` (1,000)
 * and cannot be interrupted (Mastery `percent` 80: normal casts weigh 800 too).
 * Stub: fight.ts `execute` charges a Mana skill whose own weight is heavy before any hook is asked, and the charged
 * cast's weight is paid at resolution without `modifyWeight`; the joint is a hook query there ("does this actor charge
 * this skill, at what weight") and one in the interrupt roll. Tier V is locked until Segment 3 (D-099). Logs
 * `hookStub` once per fight, at the fight's start (a passive is never cast, so `apply` alone would never say so).
 */
export const STUB = true

function say(ctx: HookContext): void {
  const key = 'stub:heavy-casts-uninterrupted'
  if (ctx.state.flags[key]) return
  ctx.state.flags[key] = true
  ctx.fx.log('hookStub', 'heavy-casts-uninterrupted: heavy casts still charge (no charge joint in fight.ts)', { actorId: ctx.holder.id })
}

const handler: CustomHandler = {
  apply: (ctx) => say(ctx),
  onFightStart: (ctx) => say(ctx),
}
export default handler
