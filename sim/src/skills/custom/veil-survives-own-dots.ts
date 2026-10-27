import type { CustomHandler } from './types.ts'

/**
 * Wraith-step (Shade, Shadow III; docs/classes/shade.md §4.1): the Veil this skill applies is not ended by the
 * holder's own DoT ticks. Reading: the sim's DoT ticks (fight.ts dealDot) never count as the holder attacking, so no
 * Veil is ended by its holder's DoTs today; the hook has nothing to override and records the rule in the log so the
 * HUD can say it. Should ticks ever notify `onHolderAttacks`, this is where the exemption belongs.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.log('veilSteady', `${ctx.holder.name}'s veil holds through their own poisons`, { actorId: ctx.holder.id })
  },
}
export default handler
