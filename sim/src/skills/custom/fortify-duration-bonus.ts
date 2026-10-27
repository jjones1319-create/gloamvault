import type { CustomHandler } from './types.ts'

/** Steadfast (Mender passive, Vigil II; docs/classes/mender.md §4.3), second line: Fortify the holder applies lasts +`amount` turns. Installed as a hook by hero.ts. */
const handler: CustomHandler = {
  statusDurationBonus: (ctx, status) => (status === 'fortify' ? (ctx.line.amount ?? 0) : 0),
}
export default handler
