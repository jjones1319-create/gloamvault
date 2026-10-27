import type { CustomHandler } from './types.ts'

/** Curse (03 §3.5): all attributes −10% (the line's percent, signed). */
const handler: CustomHandler = {
  attributePercent: (ctx) => ctx.line.percent ?? 0,
}
export default handler
