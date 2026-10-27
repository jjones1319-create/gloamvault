import type { CustomHandler } from './types.ts'

/**
 * Gentle Hands (Mender passive, Benediction I; docs/classes/mender.md §4.1), first line, and the "of Grace" item
 * affix (08): the holder's heals are +`percent`%. Installed as a hook by hero.ts (passives) or the item system;
 * `apply` installs it for `duration` turns when a skill casts the line.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  outgoingHealingPercent: (ctx) => ctx.line.percent ?? 0,
}
export default handler
