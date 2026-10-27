import type { CustomHandler } from './types.ts'

/** An elite affix's Speed override (06 §2 Rabid: Speed 140 replaces the template's). Not a buff: it rewrites the base. */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    if (ctx.line.amount !== undefined) who.base.speed = ctx.line.amount
  },
}
export default handler
