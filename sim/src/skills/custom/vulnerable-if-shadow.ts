import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/** The same reading of "Undead or Shadow" as Smite's hook (damage-taken-percent-vs-undead-shadow). */
const SHADOW_FAMILIES = new Set(['the-restless-dead', 'ice-wights-pale-court'])

function shadowKin(target: Actor): boolean {
  const m = target.monster
  if (!m) return false
  return SHADOW_FAMILIES.has(m.familyId) || /shadow|wraith|hollow/.test(m.familyId) || (m.resist.includes('shadow') && m.weak.includes('holy'))
}

/**
 * Lantern of the Mind (Arcanist, Arcana III; docs/classes/arcanist.md §4.3): Shadow-family enemies take +`percent`%
 * damage for `duration` turns. The line resolves on every enemy; a Shadow-kin one gets a hook that answers
 * `incomingDamagePercent` and counts down at its turn end.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !shadowKin(target)) return
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3 })
    ctx.fx.log('lantern', `the light finds ${target.name}`, { actorId: ctx.holder.id, targetId: target.id })
  },
  incomingDamagePercent: (ctx) => ctx.line.percent ?? 0,
}
export default handler
