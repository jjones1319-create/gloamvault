import type { CustomHandler } from './types.ts'

/**
 * Phantom Thief (Shade, Larceny V; docs/classes/shade.md §4.3): the holder's Fortune cap is `amount`% instead of tuning
 * `derived.fortune.cap` (25).
 * Stub (Tier V, locked until Segment 3): the cap is a clamp inside `deriveStats` (sim/src/stats.ts) — the same joint
 * `crit-cap-raise` needs (a `fortuneCapPercent` input that hero.ts `heroLoad` fills from the loadout passives). Logs
 * `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:fortune-cap-raise:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', `fortune-cap-raise: the Fortune cap of ${ctx.line.amount ?? 25}% waits for a stats.ts joint`, { actorId: ctx.holder.id })
  },
}
export default handler
