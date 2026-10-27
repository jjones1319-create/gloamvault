import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Hallowed Ground (Mender, Sanctity III; docs/classes/mender.md §4.2): for `duration` turns any enemy that attacks
 * the party's front row takes `multiplier` × the caster's spell Attack as `damageType` (Holy). `apply` installs a
 * hook (sourceId = the caster) on every ally; a hook answers `afterHit` while its holder stands in the front row,
 * once per enemy action (an AoE on two front heroes is one attack), while the caster is up. Reading: "Undead cannot
 * be raised or revived while it holds" has no joint — the fight owns summons — and is not implemented here.
 */
const handler: CustomHandler = {
  apply: (ctx, _target, scale) => {
    const caster = ctx.holder
    const duration = ctx.line.duration ?? 3
    for (const ally of ctx.fx.alliesOf(caster)) ctx.fx.installHook(ally, ctx.line, caster.id, { sourceSkillId: ctx.sourceId, turnsLeft: duration, data: { scale } })
    ctx.fx.log('hallowedGround', `${caster.name} hallows the ground`, { actorId: caster.id, data: { turns: duration } })
  },
  afterHit: (ctx, incoming) => {
    const hook = ctx.hook
    const holder = ctx.holder
    const attacker = incoming.attacker
    if (!hook || !attacker || holder.row !== 'front' || incoming.isDot || attacker.side === holder.side || !ctx.fx.isActive(attacker)) return
    const caster = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!caster || !ctx.fx.isActive(caster)) return
    const key = `hallowed-ground:${caster.id}:${attacker.id}`
    if (ctx.state.flags[key] === attacker.tally.actions) return
    ctx.state.flags[key] = attacker.tally.actions
    const scale = Number(hook.data.scale ?? 100)
    const amount = roundHalfUp((ctx.fx.statOf(caster, 'attackSpell') * (ctx.line.multiplier ?? 0.5) * scale) / 100)
    if (amount <= 0) return
    ctx.fx.strike(caster, attacker, { amount, damageType: ctx.line.damageType ?? 'holy', label: 'hallowed ground', canMiss: false, canCrit: false, isMelee: false })
  },
}
export default handler
