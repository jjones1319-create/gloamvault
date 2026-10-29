import type { Content } from './content.ts'
import { canHoldOffHand, effectiveItemStats, itemValueOf, setProgressOf, type SetBonusKey } from './items.ts'
import { requirementMet } from './requirements.ts'
import { equip, heroOf, unequip, type Profile } from './town.ts'
import type { ClassDef, HeroRecord, ItemDef, ItemInstance, SkillDef } from './types/content.ts'
import type { DerivedStat } from './types/enums.ts'

/**
 * The armory's judgement (03 §6.1: "Auto-equip best is one tap"): which items fit a hero's slot, how good each one
 * is for that hero, and the one-tap swap to the best set. Pure and deterministic: ties go to what is worn, then to
 * the armory's own order, never to a random draw.
 *
 * Scores are integers in quarter points (×4), so every term of 03 §6.1's "main stat" reading stays exact:
 * - main hand: the hero's offence line (Attack for a Stamina class, spell Attack for a Mana class);
 * - off hand: a shield's Block × 2 + Defense, a focus's spell Attack + Mana / 4, an off-hand weapon's offence;
 * - helmet, chest, legs, boots, gloves: Defense + HP / 4 + Resistance / 2;
 * - rings and the talisman: the sum of their lines (the other class family's pool line does not count);
 * - the relic: its value (a relic's power is its once-per-fight active, which has no line to add up).
 * Every line comes through `effectiveItemStats`, so wear and +N count; a Broken item scores 0.
 *
 * The hands are chosen as a pair, because a two-hander frees the off hand (08 §1). The pair that keeps the most of
 * the hero's loadout skills usable wins first (a Ranger keeps a bow for Aimed Shot, a Warden a shield for Shield
 * Slam), then the best total, where an off-hand item the class's own weapon list does not name (a Blade's buckler)
 * counts a quarter; then the pair that keeps what is worn.
 *
 * Sets (08 §6; Phase 8): after every slot has its best piece, auto-equip weighs the worn sets' bonuses too — a bonus is
 * worth its stat lines by the ring rule and `equipment.sets.autoEquipLineScore` for each line with no number to add up
 * (a hook: the Vigil's Guard that Taunts) — and swaps in the pieces that switch a bonus on when the bonus outweighs the
 * score the swap gives up (setBonusScore, withSets).
 */

/** The eleven gear slots in screen order (03 §6.1); the two rings are separate slots here. */
export const GEAR_SLOTS = ['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring0', 'ring1', 'talisman', 'relic'] as const
export type GearSlot = (typeof GEAR_SLOTS)[number]

const ARMOR_SLOTS: ReadonlySet<string> = new Set(['helmet', 'chest', 'legs', 'boots', 'gloves'])
const SHIELD_TYPES: Readonly<Record<string, string>> = { shieldBuckler: 'buckler', shieldKite: 'kite', shieldTower: 'tower' }

/** The item `slot` that fills a gear slot. */
export function contentSlotOf(slot: GearSlot): string {
  return slot === 'ring0' || slot === 'ring1' ? 'ring' : slot
}

/** What a hero wears in a gear slot. */
export function wornIn(hero: HeroRecord, slot: GearSlot): ItemInstance | null {
  const e = hero.equipment
  if (slot === 'ring0') return e.ring[0]
  if (slot === 'ring1') return e.ring[1]
  return e[slot]
}

/**
 * Why a hero cannot wear an item, or null when it can: the item is not gear, the class lock (08: an empty lock is
 * universal), or one of the species' restrictions (05: "gear the species cannot use regardless of class").
 */
export function wearBlocker(content: Content, hero: HeroRecord, def: ItemDef): string | null {
  if (def.slot === null || def.slot === 'pet') return `${def.name} is not worn`
  if (def.classLock.length > 0 && !def.classLock.includes(hero.classId)) {
    return `only for ${def.classLock.map((id) => content.classes.get(id)?.name ?? id).join(', ')}`
  }
  const species = content.species.get(hero.speciesId)
  for (const r of species?.restrictions ?? []) {
    const blocked =
      (r.kind === 'weaponType' && r.weaponType !== undefined && def.weaponType === r.weaponType) ||
      (r.kind === 'slot' && r.slot !== undefined && def.slot === r.slot) ||
      (r.kind === 'shieldType' && r.shieldType !== undefined && def.kind === 'shield' && (r.shieldType === 'all' || SHIELD_TYPES[def.weaponType ?? ''] === r.shieldType))
    if (blocked) return r.reason ?? `not for a ${species?.name ?? hero.speciesId}`
  }
  return null
}

export function canWear(content: Content, hero: HeroRecord, def: ItemDef): boolean {
  return wearBlocker(content, hero, def) === null
}

/** True when the item goes in the gear slot (either ring slot takes a ring). */
export function fitsSlot(def: ItemDef, slot: GearSlot): boolean {
  return def.slot === contentSlotOf(slot)
}

function offence(cls: ClassDef | undefined, stats: Partial<Record<DerivedStat, number>>): number {
  return cls?.pool === 'mana' ? (stats.attackSpell ?? 0) : (stats.attackPhys ?? 0)
}

/** An item's worth to this hero in its own slot, in quarter points (see the module note); a Broken item is 0. */
export function itemScore(content: Content, hero: HeroRecord, def: ItemDef, inst: ItemInstance): number {
  const s = effectiveItemStats(content, content.tuning, def, inst)
  if (s.band === 'broken') return 0
  const cls = content.classes.get(hero.classId)
  const st = s.stats
  if (def.slot === 'mainHand') return 4 * offence(cls, st)
  if (def.slot === 'offHand') {
    if (def.kind === 'shield') return 4 * (2 * (st.block ?? 0) + (st.defense ?? 0))
    if (def.kind === 'focus') return 4 * (st.attackSpell ?? 0) + (st.mana ?? 0)
    return 4 * offence(cls, st)
  }
  if (def.slot !== null && ARMOR_SLOTS.has(def.slot)) return 4 * (st.defense ?? 0) + (st.hp ?? 0) + 2 * (st.resistance ?? 0)
  if (def.slot === 'ring' || def.slot === 'talisman') {
    const otherPool = cls?.pool === 'mana' ? 'stamina' : 'mana'
    let sum = 0
    for (const [k, v] of Object.entries(st)) if (k !== otherPool) sum += v ?? 0
    for (const [k, v] of Object.entries(s.percentStats)) if (k !== otherPool) sum += v ?? 0
    for (const v of Object.values(s.attributeBonuses)) sum += v ?? 0
    return 4 * sum
  }
  if (def.slot === 'relic') return itemValueOf(content.tuning, def)
  return 0
}

/* ---------- loadout skills and the hands ---------- */

/** The skills in the hero's loadout (four actives, two passives), in slot order. */
export function loadoutSkills(content: Content, hero: HeroRecord): SkillDef[] {
  const out: SkillDef[] = []
  for (const id of [...hero.loadout.actives, ...hero.loadout.passives]) {
    const s = id ? content.skills.get(id) : undefined
    if (s) out.push(s)
  }
  return out
}

export { requirementMet, requirementProblem } from './requirements.ts'

/** The loadout skills these hands would leave without their equipment (for the gear screen's warning). */
export function blockedSkills(content: Content, hero: HeroRecord, main: ItemDef | null, off: ItemDef | null): SkillDef[] {
  return loadoutSkills(content, hero).filter((s) => !requirementMet(s, main, off))
}

/** True when the class's own weapon list names this off-hand item (a Warden's shields, a Mender's holy symbol). */
function classNamesOffHand(cls: ClassDef | undefined, def: ItemDef): boolean {
  if (!cls) return true
  const type = def.weaponType ?? (def.kind === 'focus' ? 'focus' : null)
  return type !== null && (cls.weaponTypes as readonly string[]).includes(type)
}

/**
 * What an off-hand item adds to a pair's total: a quarter when the class's weapon list does not name it; a weapon held
 * in the off hand adds half its Attack (08 §1, the hero load's off-hand 50%), so it counts half.
 */
export function offHandPairScore(content: Content, hero: HeroRecord, def: ItemDef, score: number): number {
  if (!classNamesOffHand(content.classes.get(hero.classId), def)) return Math.floor(score / 4)
  return def.kind === 'weapon' ? Math.floor(score / 2) : score
}

/* ---------- candidates ---------- */

export interface Candidate {
  inst: ItemInstance
  def: ItemDef
  score: number
  /** Worn in this slot now. */
  worn: boolean
  /** -1 when worn, else the index in the armory (the deterministic tie-break). */
  order: number
}

/** The armory's items that fit a gear slot and the hero (class lock, species), best first, armory order on ties. */
export function armoryCandidates(content: Content, profile: Profile, hero: HeroRecord, slot: GearSlot): Candidate[] {
  const out: Candidate[] = []
  profile.armory.forEach((inst, order) => {
    const def = content.items.get(inst.itemId)
    const fits = slot === 'offHand' ? canHoldOffHand(def ?? ({} as ItemDef), hero.classId) : def !== undefined && fitsSlot(def, slot)
    if (!def || !fits || !canWear(content, hero, def)) return
    out.push({ inst, def, score: itemScore(content, hero, def, inst), worn: false, order })
  })
  return out.sort((a, b) => b.score - a.score || a.order - b.order)
}

function wornCandidate(content: Content, hero: HeroRecord, slot: GearSlot): Candidate | null {
  const inst = wornIn(hero, slot)
  const def = inst ? content.items.get(inst.itemId) : undefined
  return inst && def ? { inst, def, score: itemScore(content, hero, def, inst), worn: true, order: -1 } : null
}

/** The best of the worn item and the candidates: higher score, then what is worn (an empty slot counts as worn). */
function bestFor(worn: Candidate | null, others: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = worn
  let bestScore = worn?.score ?? 0
  for (const c of others) {
    // Strictly better only: ties keep what is worn, and an item worth nothing never fills an empty slot.
    if (c.score > bestScore) {
      best = c
      bestScore = c.score
    }
  }
  return best
}

interface HandPair {
  main: Candidate | null
  off: Candidate | null
  usable: number
  total: number
  kept: number
}

/** The best main hand and off hand together (see the module note). */
export function bestHands(content: Content, profile: Profile, hero: HeroRecord): { main: Candidate | null; off: Candidate | null } {
  const wornMain = wornCandidate(content, hero, 'mainHand')
  const wornOff = wornCandidate(content, hero, 'offHand')
  const mains: (Candidate | null)[] = [wornMain, ...armoryCandidates(content, profile, hero, 'mainHand')]
  const offs: (Candidate | null)[] = [wornOff, ...armoryCandidates(content, profile, hero, 'offHand')]
  if (wornMain) mains.push(null)
  if (wornOff) offs.push(null)
  const skills = loadoutSkills(content, hero)
  let best: HandPair | null = null
  for (const main of mains) {
    const offOptions = main?.def.hands === 2 ? [null] : offs
    for (const off of offOptions) {
      // One item cannot fill both hands (an armory dagger is a candidate for either).
      if (off && main && off.inst.instanceId === main.inst.instanceId) continue
      const usable = skills.filter((s) => requirementMet(s, main?.def ?? null, off?.def ?? null)).length
      const total = (main?.score ?? 0) + (off ? offHandPairScore(content, hero, off.def, off.score) : 0)
      // An empty hand that was empty counts as kept (null === null).
      const kept = (main === wornMain ? 1 : 0) + (off === wornOff ? 1 : 0)
      const pair: HandPair = { main, off, usable, total, kept }
      if (!best || pair.usable > best.usable || (pair.usable === best.usable && (pair.total > best.total || (pair.total === best.total && pair.kept > best.kept)))) best = pair
    }
  }
  return best ? { main: best.main, off: best.off } : { main: wornMain, off: wornOff }
}

/* ---------- sets (08 §6) ---------- */

/** The slots a set piece can fill: the armor and the trinkets (the hands are chosen as a pair, for the loadout's skills). */
export const SET_SLOTS = ['helmet', 'chest', 'legs', 'boots', 'gloves', 'ring0', 'ring1', 'talisman', 'relic'] as const
type SetSlot = (typeof SET_SLOTS)[number]

/**
 * A set bonus's worth to a hero, in quarter points: its stat lines by the ring rule (4 × each flat or percent line, the
 * other class family's pool line left out, a debuff line negative) and `equipment.sets.autoEquipLineScore` for every
 * line with no number to add up — a hook such as the Vigil's "Guard also Taunts" (Phase 8 reading of 03 §6.1).
 */
export function setBonusScore(content: Content, hero: HeroRecord, setId: string, key: SetBonusKey): number {
  const set = content.sets.get(setId)
  if (!set) return 0
  const otherPool = content.classes.get(hero.classId)?.pool === 'mana' ? 'stamina' : 'mana'
  const lineScore = content.tuning.equipment.sets.autoEquipLineScore.value
  let sum = 0
  for (const line of set.bonuses[key] ?? []) {
    if ((line.kind === 'buffStat' || line.kind === 'debuffStat') && line.stat !== undefined) {
      if (line.stat === otherPool) continue
      const sign = line.kind === 'debuffStat' ? -1 : 1
      sum += sign * 4 * ((line.amount ?? 0) + (line.percent ?? 0))
    } else sum += lineScore
  }
  return sum
}

/** What a worn list's sets are worth together: every bonus it switches on (items.ts setProgressOf: distinct pieces, Broken ones left out). */
export function setsWorth(content: Content, hero: HeroRecord, worn: readonly (ItemInstance | null)[]): number {
  let sum = 0
  for (const p of setProgressOf(content, content.tuning, worn)) for (const key of p.active) sum += setBonusScore(content, hero, p.setId, key)
  return sum
}

/**
 * The set pass of auto-equip: from the worn pieces (each already the best of its slot alone), try every set among the
 * hero's candidates at each of its thresholds — that many of its pieces in the slots where they cost the least score —
 * and keep a change only when the slots' scores plus the sets' bonuses come out strictly higher. A few rounds, so two
 * sets can share the body (2 + 2). Deterministic: slots in screen order, ties keep what is worn.
 */
function withSets(content: Content, profile: Profile, heroId: string): Profile {
  const hero = heroOf(profile, heroId)
  const worn = Object.fromEntries(SET_SLOTS.map((slot) => [slot, wornCandidate(content, hero, slot)])) as Record<SetSlot, Candidate | null>
  const pools = Object.fromEntries(SET_SLOTS.map((slot) => [slot, armoryCandidates(content, profile, hero, slot)])) as Record<SetSlot, Candidate[]>
  const hands = [hero.equipment.mainHand, hero.equipment.offHand]
  const value = (a: Record<SetSlot, Candidate | null>): number => SET_SLOTS.reduce((sum, slot) => sum + (a[slot]?.score ?? 0), 0) + setsWorth(content, hero, [...hands, ...SET_SLOTS.map((slot) => a[slot]?.inst ?? null)])
  // The sets the hero could wear into: a set piece among the candidates, the set open to the class.
  const setIds = new Set<string>()
  for (const slot of SET_SLOTS) {
    for (const c of [worn[slot], ...pools[slot]]) {
      const set = c?.def.setId ? content.sets.get(c.def.setId) : undefined
      if (set && (set.classIds.length === 0 || set.classIds.includes(hero.classId))) setIds.add(set.id)
    }
  }
  if (setIds.size === 0) return profile
  let best = { ...worn }
  let bestValue = value(best)
  const at: readonly number[] = content.tuning.equipment.sets.bonusAt
  for (let round = 0; round < 3; round++) {
    let improved = false
    for (const setId of [...setIds].sort()) {
      const set = content.sets.get(setId)
      if (!set) continue
      for (const n of at.filter((k) => set.bonuses[String(k) as SetBonusKey] !== undefined)) {
        // Each slot's best piece of the set (worn there, or in the armory and not picked elsewhere), and its cost against the slot's current pick.
        const inUse = new Set(SET_SLOTS.map((o) => best[o]?.inst.instanceId).filter((id): id is string => id !== undefined))
        const options: { slot: SetSlot; pick: Candidate; loss: number }[] = []
        for (const slot of SET_SLOTS) {
          const current = best[slot]
          if (current?.def.setId === setId) {
            options.push({ slot, pick: current, loss: 0 })
            continue
          }
          const pick = pools[slot].find((c) => c.def.setId === setId && !inUse.has(c.inst.instanceId))
          if (pick) options.push({ slot, pick, loss: (current?.score ?? 0) - pick.score })
        }
        // The n cheapest; one instance never fills two slots (a ring set's rings).
        const chosen: typeof options = []
        const used = new Set<string>()
        for (const o of [...options].sort((x, y) => x.loss - y.loss || SET_SLOTS.indexOf(x.slot) - SET_SLOTS.indexOf(y.slot))) {
          if (chosen.length >= n) break
          if (used.has(o.pick.inst.instanceId)) continue
          used.add(o.pick.inst.instanceId)
          chosen.push(o)
        }
        if (chosen.length < n || chosen.every((o) => best[o.slot] === o.pick)) continue
        const trial = { ...best }
        for (const o of chosen) trial[o.slot] = o.pick
        const v = value(trial)
        if (v > bestValue) {
          best = trial
          bestValue = v
          improved = true
        }
      }
    }
    if (!improved) break
  }
  let p = profile
  for (const slot of SET_SLOTS) {
    const want = best[slot]
    if (!want || want.worn) continue
    p = equip(content, p, heroId, want.inst.instanceId, slot === 'ring1' ? 1 : 0)
  }
  return p
}

/* ---------- auto-equip ---------- */

const SINGLE_GEAR = ['helmet', 'chest', 'legs', 'boots', 'gloves', 'talisman', 'relic'] as const

/**
 * "Auto-equip best" (03 §6.1): every slot gets the best of what the hero wears and what the armory holds that fits
 * the slot, the class and the species; whatever is replaced goes back to the armory. Returns the same profile when
 * nothing changes.
 */
export function autoEquipBest(content: Content, profile: Profile, heroId: string): Profile {
  let p = profile
  const hero0 = heroOf(p, heroId)

  // The hands, as a pair.
  const hands = bestHands(content, p, hero0)
  const wornMainId = hero0.equipment.mainHand?.instanceId ?? null
  const wantMainId = hands.main?.inst.instanceId ?? null
  if (wantMainId !== wornMainId) p = wantMainId === null ? unequip(p, heroId, 'mainHand') : equip(content, p, heroId, wantMainId)
  const wornOffId = heroOf(p, heroId).equipment.offHand?.instanceId ?? null
  const wantOffId = hands.off?.inst.instanceId ?? null
  if (wantOffId !== wornOffId) p = wantOffId === null ? unequip(p, heroId, 'offHand') : equip(content, p, heroId, wantOffId, 0, 'off')

  // Armor, the talisman and the relic, one slot each.
  for (const slot of SINGLE_GEAR) {
    const hero = heroOf(p, heroId)
    const best = bestFor(wornCandidate(content, hero, slot), armoryCandidates(content, p, hero, slot))
    if (best && !best.worn) p = equip(content, p, heroId, best.inst.instanceId)
  }

  // The rings: slot 1 takes the best, then slot 2 the best of the rest (a ring slot 1 gives up may move to slot 2).
  for (const [slot, index] of [['ring0', 0], ['ring1', 1]] as const) {
    const hero = heroOf(p, heroId)
    const best = bestFor(wornCandidate(content, hero, slot), armoryCandidates(content, p, hero, slot))
    if (best && !best.worn) p = equip(content, p, heroId, best.inst.instanceId, index)
  }
  // Sets (08 §6): the pieces that switch a bonus on, when the bonus outweighs what the swap gives up.
  return withSets(content, p, heroId)
}
