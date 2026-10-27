import { canWear, contentSlotOf, GEAR_SLOTS } from '../../../../../sim/src/armory.ts'
import { grantItem, heroOf } from '../../../../../sim/src/town.ts'
import type { Grade } from '../../../../../sim/src/types/enums.ts'
import { act, ephemeral } from '../../../game/session.ts'

/**
 * `#hero=<id>&demo=1&armory=1`: fills an EMPTY armory of an ephemeral (never saved) demo profile with a handful of
 * pieces this hero can wear — one grade up for each slot, a two-hander, a worn-down copy and a piece for another
 * class — so the gear dialog and Auto-equip can be seen on a screenshot. Does nothing to a real save.
 */
export function seedSampleArmory(heroId: string): void {
  if (!ephemeral.value) return
  act((c, p) => {
    if (p.armory.length > 0) return p
    const hero = heroOf(p, heroId)
    const defs = [...c.items.values()]
    const pick = (slot: string, grade: Grade, hands?: number) =>
      defs.find((d) => d.slot === slot && d.grade === grade && canWear(c, hero, d) && (hands === undefined || d.hands === hands))
    const ids: string[] = []
    for (const s of GEAR_SLOTS) {
      if (s === 'ring1' || s === 'relic') continue
      const d = pick(contentSlotOf(s), 'E')
      if (d) ids.push(d.id)
    }
    const twoHander = pick('mainHand', 'D', 2)
    if (twoHander) ids.push(twoHander.id)
    const relic = defs.find((d) => d.slot === 'relic')
    if (relic) ids.push(relic.id)
    const other = defs.find((d) => d.slot === 'mainHand' && d.grade === 'C' && !canWear(c, hero, d))
    if (other) ids.push(other.id)
    let q = p
    for (const id of ids) q = grantItem(c, q, id)
    // One worn-down piece, so the wear pips and the "worse" comparison show.
    return { ...q, armory: q.armory.map((inst, i) => (i === 1 ? { ...inst, durability: 35 } : inst)) }
  })
}
