import { canWear, contentSlotOf, GEAR_SLOTS } from '../../../../../sim/src/armory.ts'
import { equip, grantItem, heroOf } from '../../../../../sim/src/town.ts'
import type { Grade } from '../../../../../sim/src/types/enums.ts'
import { act, ephemeral } from '../../../game/session.ts'
import { createTome } from '../../../../../sim/src/tomes.ts'
import { Rng } from '../../../../../sim/src/rng.ts'

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

/**
 * `#hero=<id>&demo=1&tomes=1` (Phase 7, pass A): puts three Skill Tomes of the hero's class in the armory of an
 * EPHEMERAL demo profile — one new to the hero, one it already knows (a rank of practice) and one Tier IV — plus a Tome
 * of another class, and has it half-way to a technique, so the Skills tab's Tomes card and the witness count show on a
 * screenshot. Does nothing to a real save.
 */
export function seedSampleTomes(heroId: string): void {
  if (!ephemeral.value) return
  act((c, p) => {
    if (p.armory.some((i) => i.skillId !== undefined)) return p
    const hero = heroOf(p, heroId)
    const known = new Set(hero.skills.map((k) => k.skillId))
    const mine = c.skillsByClass.get(hero.classId) ?? []
    const pick = (f: (s: (typeof mine)[number]) => boolean) => mine.find((s) => f(s) && s.monsterTechniqueOf === null && !s.isUltimate)
    const ids = [pick((s) => s.tier === 2 && !known.has(s.id)), pick((s) => known.has(s.id)), pick((s) => s.tier === 4)].filter((s) => s !== undefined).map((s) => s.id)
    const other = [...c.skills.values()].find((s) => s.classId !== hero.classId && s.classId !== 'field' && s.classId !== 'pet' && s.tier === 1)
    if (other) ids.push(other.id)
    const rng = Rng.fromSeed(7)
    const technique = mine.find((s) => s.monsterTechniqueOf !== null)
    const heroes = technique ? p.heroes.map((h) => (h.id === heroId ? { ...h, techniqueWitness: { [technique.id]: 4 } } : h)) : p.heroes
    return { ...p, heroes, armory: [...p.armory, ...ids.map((id) => createTome(c, rng, id))] }
  })
}

/**
 * `#hero=<id>&demo=1&items=1` (Phase 7): dresses the hero of an EPHEMERAL demo profile in two Barrow Warden's Vigil
 * pieces, an Awakened +3 Skysteel Longsword with an affinity and the Barrow Bell, and puts the Shieldbrother's Kite in
 * the armory, so the item card's set count, growth line, unique line and relic active show on a screenshot. Does
 * nothing to a real save or a hero already dressed so.
 */
export function seedItemShowcase(heroId: string): void {
  if (!ephemeral.value) return
  act((c, p) => {
    if (heroOf(p, heroId).equipment.helmet?.itemId === 'barrow-wardens-helm') return p
    let q = p
    const wear = ['barrow-wardens-helm', 'barrow-wardens-breastplate', 'skysteel-longsword', 'the-barrow-bell'].filter((id) => c.items.has(id))
    for (const id of wear) {
      q = grantItem(c, q, id)
      const inst = q.armory[q.armory.length - 1]!
      const grown = id === 'skysteel-longsword' ? { ...inst, plusN: 3, itemLevel: c.tuning.xp.item.maxLevel, itemXp: 0, affinities: [{ familyId: 'restless-dead', percent: 10 }] } : inst
      q = { ...q, armory: q.armory.map((x) => (x === inst ? grown : x)) }
      q = equip(c, q, heroId, inst.instanceId)
    }
    if (c.items.has('shieldbrothers-kite')) q = grantItem(c, q, 'shieldbrothers-kite')
    return q
  })
}
