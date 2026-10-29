import type { CustomHandler } from './types.ts'

/**
 * Burst (Bursting Corpse, 06 §3.2): "×1.5 to both front heroes, kills itself, Poison (3); tell: it swells for one turn
 * first". The attack's own lines deal the blow and the Poison; this rider, its last line, ends the corpse through the
 * damage pipeline (a blow nobody dealt, Defense ignored, its whole HP twice over) so its death hooks and the loot
 * count it as killed. A corpse already down to nothing is left alone.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const self = ctx.holder
    if (!ctx.fx.isActive(self) || self.hp <= 0) return
    ctx.fx.log('burst', `${self.name} bursts`, { actorId: self.id })
    ctx.fx.strike(null, self, { amount: self.hp * 2 + 1, damageType: 'blunt', label: 'its own burst', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  },
}
export default handler
