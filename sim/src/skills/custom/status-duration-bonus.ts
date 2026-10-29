import type { CustomHandler } from './types.ts'

/**
 * Conflagration (Arcanist passive, Evocation V; docs/classes/arcanist.md §4.1): `status` the holder applies lasts
 * +`amount` turns — one line per status (Burn, Shock). A passive line, installed as a hook by hero.ts; the fight asks
 * every hook on the applier for its `statusDurationBonus` (effects.ts durationWithBonus).
 */
const handler: CustomHandler = {
  statusDurationBonus: (ctx, status) => (ctx.line.status === status ? Math.max(0, Math.round(ctx.line.amount ?? 1)) : 0),
}
export default handler
