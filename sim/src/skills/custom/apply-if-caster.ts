import { ELEMENTS } from '../../types/enums.ts'
import type { CustomHandler } from './types.ts'

/**
 * Siphon (Arcanist, Arcana II; docs/classes/arcanist.md §4.3): if the target is a caster it is Silenced 1.
 * Reading: a caster is a monster with at least one elemental attack (a spell), or a hero whose pool is Mana.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status) return
    const spellMonster = target.monster?.attacks.some((a) => (ELEMENTS as readonly string[]).includes(a.damageType)) ?? false
    if (!spellMonster && target.hero?.pool !== 'mana') return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'rider'
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: ctx.sourceId ?? 'rider', label, neverMisses: true, isMelee: false })
  },
}
export default handler
