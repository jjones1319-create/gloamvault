import type { CustomHandler } from './types.ts'

/**
 * of the Pack (08 §5): "+pet stats 3–5% / 5–8% / 8–12%". The hook sits on the owner (hero.ts); `auraStatPercent`
 * grants the owner's pet `percent` on Attack (phys and spell), Defense and HP while the owner stands. Reading: the
 * pet's max HP is fixed when it is built, so the HP share reads through `statOf('hp')` only.
 */
const handler: CustomHandler = {
  auraStatPercent: (ctx, ally, stat) => {
    if (ally.pet?.ownerId !== ctx.holder.id) return 0
    return stat === 'attackPhys' || stat === 'attackSpell' || stat === 'defense' || stat === 'hp' ? (ctx.line.percent ?? 0) : 0
  },
}
export default handler
