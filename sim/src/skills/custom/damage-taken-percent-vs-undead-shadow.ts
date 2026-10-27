import type { CustomHandler } from './types.ts'

/** Smite's extra (03 §3.5): a further +X% when the holder is Undead or Shadow-aligned (resists Shadow, weak to Holy). */
const UNDEAD_FAMILIES = new Set(['the-restless-dead', 'ice-wights-pale-court'])
const handler: CustomHandler = {
  incomingDamagePercent: (ctx) => {
    const m = ctx.holder.monster
    if (!m) return 0
    const shadow = m.resist.includes('shadow') && m.weak.includes('holy')
    return UNDEAD_FAMILIES.has(m.familyId) || shadow ? (ctx.line.percent ?? 0) : 0
  },
}
export default handler
