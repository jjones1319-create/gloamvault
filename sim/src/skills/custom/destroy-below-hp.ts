import type { CustomHandler } from './types.ts'

/**
 * Exorcism (Mender, Sanctity IV) and Banishment (Sanctity V; docs/classes/mender.md §4.2): after the skill's hit, a
 * non-boss Undead- or Shadow-family target left under `percent`% HP (20 / 35; Masteries 25 / 50) is destroyed
 * outright — a kill like any other (loot, XP, the holder's on-kill hooks). The family test is Censure's and Dawnbreak's
 * (06 §1: the Restless Dead and the Pale Court are Undead; a Shadow-aligned template resists Shadow and is weak to
 * Holy). Reading: "non-boss" also spares the hunters, as the status rules treat a hunter like a boss (statuses.ts
 * bossBecomes). The kill is one sure, uncritical, Defense-ignoring blow of `damageType` sized to finish the target.
 */
const UNDEAD_FAMILIES = new Set(['the-restless-dead', 'ice-wights-pale-court'])

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m || m.isBoss || m.isHunter || !ctx.fx.isActive(target)) return
    const shadow = m.resist.includes('shadow') && m.weak.includes('holy')
    if (!UNDEAD_FAMILIES.has(m.familyId) && !shadow) return
    if (target.hp * 100 >= target.maxHp * (ctx.line.percent ?? 20)) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'destroy'
    ctx.fx.log('destroy', `${label} destroys ${target.name}`, { actorId: ctx.holder.id, targetId: target.id })
    ctx.fx.strike(ctx.holder, target, { amount: target.hp * 10 + 1000, damageType: ctx.line.damageType ?? 'holy', label, canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  },
}
export default handler
