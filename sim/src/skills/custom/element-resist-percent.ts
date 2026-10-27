import type { CustomHandler } from './types.ts'

/**
 * of Fire (Frost, Lightning, Poison, Holy, Shadow) Warding (08 §5): "+10–15% / 15–25% / 25–40% resistance to that
 * element". The hook sits on the wearer (hero.ts); `incomingDamagePercent` takes `percent` off every hit of the
 * line's `damageType`. Several wardings add.
 */
const handler: CustomHandler = {
  incomingDamagePercent: (ctx, incoming) => (incoming.damageType === ctx.line.damageType ? -(ctx.line.percent ?? 0) : 0),
}
export default handler
