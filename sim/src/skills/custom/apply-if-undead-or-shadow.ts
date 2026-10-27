import type { CustomHandler } from './types.ts'

/**
 * Censure, Wraith's Lament and Dawnbreak (Mender; docs/classes/mender.md §3, §4.2): the rider applies `status` for
 * `duration` only to Undead- or Shadow-family targets (06 §1: the Restless Dead and the Pale Court are Undead; a
 * Shadow-aligned template resists Shadow and is weak to Holy, as Smite's extra reads it).
 */
const UNDEAD_FAMILIES = new Set(['the-restless-dead', 'ice-wights-pale-court'])

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const status = ctx.line.status
    const m = target?.monster
    if (!target || !status || !m) return
    const shadow = m.resist.includes('shadow') && m.weak.includes('holy')
    if (!UNDEAD_FAMILIES.has(m.familyId) && !shadow) return
    ctx.fx.applyStatus(target, { status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
