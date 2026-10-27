import type { CustomHandler } from './types.ts'

/** Voice of Iron (Warden, Warcry III; docs/classes/warden.md §4.3): damage from an enemy the holder has Taunted is scaled by `percent` (−10). */
const handler: CustomHandler = {
  incomingDamagePercent: (ctx, incoming) => {
    const a = incoming.attacker
    if (!a || incoming.isDot) return 0
    return a.statuses.some((s) => s.id === 'taunt' && s.sourceId === ctx.holder.id) ? (ctx.line.percent ?? 0) : 0
  },
}
export default handler
