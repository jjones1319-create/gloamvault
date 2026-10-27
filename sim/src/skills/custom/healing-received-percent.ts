import type { CustomHandler } from './types.ts'

/** Wither (03 §3.5): healing received −50% (the line's percent, signed). */
const handler: CustomHandler = {
  incomingHealingPercent: (ctx) => ctx.line.percent ?? 0,
}
export default handler
