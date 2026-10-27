import type { CustomHandler } from './types.ts'

/** Grab (03 §3.5, 06 §7, D-047): cannot act; only the grabber may target the holder; freed by the fight's rules. */
const handler: CustomHandler = {
  canAct: () => false,
  canSwapRow: () => false,
  canFlee: () => false,
  onlyTargetableBy: (ctx) => ctx.status?.sourceId ?? null,
  grabberTurn: (ctx, grabber) => {
    const s = ctx.status
    if (!s) return true
    s.counter += 1
    const role = grabber.monster?.role ?? 'fodder'
    const cap = role === 'boss' ? 2 : role === 'special' || role === 'monster' ? 3 : 2
    return s.counter >= cap
  },
}
export default handler
