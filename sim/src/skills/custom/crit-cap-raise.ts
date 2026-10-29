import type { CustomHandler } from './types.ts'

/**
 * Apex Hunter (Ranger, Marksman V) and Death's Whisper (Shade, Shadow V): the holder's Crit Rate cap is `amount`%
 * instead of tuning `derived.critRate.cap` (45).
 * Stub (Tier V, locked until Segment 3): the cap is a clamp inside `deriveStats` (sim/src/stats.ts), applied before a
 * fight builds the actor, so a fight hook cannot lift it — the joint is a `critCapPercent` input to deriveStats that
 * hero.ts `heroLoad` fills from the loadout passives' `crit-cap-raise` lines (the highest `amount`). Logs `hookStub`
 * once per fight so the balance runner counts it.
 */
export const STUB = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:crit-cap-raise:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', `crit-cap-raise: the Crit Rate cap of ${ctx.line.amount ?? 45}% waits for a stats.ts joint`, { actorId: ctx.holder.id })
  },
}
export default handler
