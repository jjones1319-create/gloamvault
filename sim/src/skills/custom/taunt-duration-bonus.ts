import type { CustomHandler } from './types.ts'

/** Loud Voice (Warden, Warcry I; docs/classes/warden.md §4.3): Taunts the holder applies last `amount` more turns. */
const handler: CustomHandler = {
  statusDurationBonus: (ctx, status) => (status === 'taunt' ? (ctx.line.amount ?? 0) : 0),
}
export default handler
