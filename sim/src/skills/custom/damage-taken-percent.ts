import type { CustomHandler } from './types.ts'

/** Mark and Smite (03 §3.5): damage taken +X% (the line's percent). */
const handler: CustomHandler = {
  incomingDamagePercent: (ctx) => ctx.line.percent ?? 0,
}
export default handler
