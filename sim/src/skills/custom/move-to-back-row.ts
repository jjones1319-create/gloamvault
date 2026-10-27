import type { CustomHandler } from './types.ts'

/**
 * Vanish (Shade, Larceny II; docs/classes/shade.md §4.3): moves the holder to the back row; a holder already there
 * stays (a directional move, not a swap).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    if (who.row === 'back') return
    who.row = 'back'
    ctx.fx.log('swapRow', `${who.name} slips to the back row`, { actorId: who.id })
  },
}
export default handler
