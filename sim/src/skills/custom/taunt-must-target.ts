import type { CustomHandler } from './types.ts'

/** Taunt (03 §3.5): the holder must target the taunter. Bosses honour it in phase 1 only (06 §7). */
const handler: CustomHandler = {
  mustTarget: (ctx) => {
    const m = ctx.holder.monster
    if (m?.isBoss && m.phaseIndex > 0) return null
    return ctx.status?.sourceId ?? null
  },
}
export default handler
