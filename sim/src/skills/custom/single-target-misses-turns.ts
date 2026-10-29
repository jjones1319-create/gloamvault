import type { CustomHandler } from './types.ts'

/**
 * Rearguard (Ranger, Pathfinder IV; docs/classes/ranger.md §4.3) and Unseen Hand (Shade, Shadow V; shade.md §4.1): for
 * `duration` turns single-target attacks aimed at the holder miss — an AoE, a DoT and an Ultimate still land. With
 * `amount` 1 only melee attacks miss: Rearguard's "reach attacks", the melee blows that reach the back row (03 §3.3;
 * an archer's or a caster's ranged attack still lands).
 * Reading: the fight's targeting skips an `untargetable` actor for area lines too (effects.ts resolveTargets), so the
 * line turns the blow into a miss instead (`beforeHit`, the joint Veil uses), lasting the holder's next `duration`
 * turns; a hook gained during the holder's own turn counts one more, as a status does (D-077). A status-only move
 * (a net, a hex) carries no hit to miss and still lands.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target) return
    const turns = Math.max(1, ctx.line.duration ?? 1) + (ctx.state.actingId === target.id ? 1 : 0)
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns })
    ctx.fx.log('status', `${target.name} cannot be singled out`, { actorId: ctx.holder.id, targetId: target.id, data: { status: 'unseen' } })
  },
  beforeHit: (ctx, incoming) => {
    if (!incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    if ((ctx.line.amount ?? 0) === 1 && !incoming.isMelee) return null
    return 'miss'
  },
}
export default handler
