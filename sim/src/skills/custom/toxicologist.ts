import type { CustomHandler } from './types.ts'

/**
 * Toxicologist (Shade, Venom V; docs/classes/shade.md §4.2): the holder's Poison can hold `amount` separate lines on one
 * target (2; Mastery 3) — each its own tick and its own duration — and the holder's DoTs ignore Resistance.
 * Stub (Tier V, locked until Segment 3): both halves live in sim/src/statuses.ts, which no hook reaches. Poison already
 * stacks to 5 on one shared duration (content/statuses/poison.json); separate lines need a per-source instance list in
 * `applyStatus`/`pendingTicks`, and the Resistance bypass needs an applier-side flag on `ApplyStatusInput` that
 * `resistChance` honours (effects.ts would set it from this line for the holder's dot statuses). Logs `hookStub` once
 * per fight so the balance runner counts it.
 */
export const STUB = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:toxicologist:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'toxicologist: separate Poison lines and the Resistance bypass wait for a statuses.ts joint', { actorId: ctx.holder.id })
  },
}
export default handler
