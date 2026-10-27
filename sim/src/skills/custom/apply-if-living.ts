import type { CustomHandler } from './types.ts'

/**
 * Wraith's Lament (Mender, Sanctity III; docs/classes/mender.md §4.2): the rider applies `status` (Fear) for
 * `duration` only to living targets — neither Undead nor Shadow family (06 §1: the Restless Dead and the Pale Court
 * are Undead; a Shadow-aligned template resists Shadow and is weak to Holy, as Smite's extra reads it).
 */
const UNDEAD_FAMILIES = new Set(['the-restless-dead', 'ice-wights-pale-court'])

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const status = ctx.line.status
    if (!target || !status || target.side === ctx.holder.side) return
    const m = target.monster
    const shadow = m ? m.resist.includes('shadow') && m.weak.includes('holy') : false
    if (m && (UNDEAD_FAMILIES.has(m.familyId) || shadow)) return
    ctx.fx.applyStatus(target, { status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
