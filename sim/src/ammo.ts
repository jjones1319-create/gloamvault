import type { Content } from './content.ts'
import type { Actor, HeroActorData } from './fight-types.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { HeroRecord, ItemInstance, SkillDef } from './types/content.ts'

/**
 * Arrows and bolts (08 §4; D-099 "arrows stay a real cost"; Phase 7). A bow draws arrows and a crossbow bolts
 * (tuning `ammo.byWeaponType`); a hero's quiver is `HeroRecord.quiver[ammoItemId]`, and a missing entry is full
 * (`ammo.quiverMax`), so a hero made before Phase 7 sets out with one. A basic attack spends 1; a shot skill spends
 * the sum of its `consume-ammo` lines (Volley 3); with nothing left the bow's basic attack is a Bash (Blunt, 30%
 * Attack, front row only — `ammo.emptyBash`) and the shot skills grey out. Forager's Instinct brings back a share of
 * what a fight spent. Repair all refills the quiver at the ammo's own price; a merchant's or a drop's stack goes to the
 * hero who draws that ammo. The fight counts only what the delve hands it (`HeroActorData.ammo`): a fight built
 * without one (the sim's fight tests) does not count.
 */

/** The ammo a fight counts for one hero: the quiver at the fight's start, what is left, what was spent. */
export interface FightAmmo {
  itemId: string
  left: number
  spent: number
}

/** The ammo item a weapon type draws (bows arrows, crossbows bolts), or null (throwing knives are not ammo). */
export function ammoItemFor(t: Tuning, weaponType: string | null | undefined): string | null {
  if (!weaponType) return null
  const map = t.ammo.byWeaponType as Readonly<Record<string, string>>
  return map[weaponType] ?? null
}

/** The ammo a hero's main hand draws, or null. */
export function heroAmmoItem(content: Content, t: Tuning, hero: HeroRecord): string | null {
  const main = hero.equipment.mainHand ? content.items.get(hero.equipment.mainHand.itemId) : undefined
  return ammoItemFor(t, main?.weaponType)
}

/** What a hero's quiver holds of an ammo item (a missing entry is a full quiver). */
export function quiverCount(t: Tuning, hero: HeroRecord, itemId: string): number {
  const n = hero.quiver?.[itemId]
  return n === undefined ? t.ammo.quiverMax : Math.max(0, Math.min(t.ammo.carryMax, Math.floor(n)))
}

/** The hero with this ammo item set to `count` (0 … carryMax). */
export function withQuiver(t: Tuning, hero: HeroRecord, itemId: string, count: number): HeroRecord {
  return { ...hero, quiver: { ...(hero.quiver ?? {}), [itemId]: Math.max(0, Math.min(t.ammo.carryMax, Math.floor(count))) } }
}

/** What a hero carries for the HUD and the hero card: the ammo in hand, its count, the cap and the amber line. */
export function heroAmmo(content: Content, t: Tuning, hero: HeroRecord): { itemId: string; name: string; count: number; max: number; low: boolean } | null {
  const itemId = heroAmmoItem(content, t, hero)
  if (!itemId) return null
  const count = quiverCount(t, hero, itemId)
  return { itemId, name: content.items.get(itemId)?.name ?? itemId, count, max: t.ammo.quiverMax, low: count <= t.ammo.lowAt }
}

/** Gold for `n` arrows or bolts at the item's own price (its value buys one stack, `ammo.stack`). */
export function ammoPrice(content: Content, itemId: string, n: number): number {
  const def = content.items.get(itemId)
  if (!def || n <= 0) return 0
  return roundHalfUp((n * def.value) / Math.max(1, def.ammo?.stack ?? 1))
}

/** Repair all's refill (D-099): what the quiver of the ammo in hand is missing to `quiverMax`, and its price. */
export function quiverRefill(content: Content, t: Tuning, hero: HeroRecord): { itemId: string; missing: number; gold: number } | null {
  const itemId = heroAmmoItem(content, t, hero)
  if (!itemId) return null
  const missing = Math.max(0, t.ammo.quiverMax - quiverCount(t, hero, itemId))
  if (missing <= 0) return null
  return { itemId, missing, gold: ammoPrice(content, itemId, missing) }
}

/** The fight's count for a hero (the delve hands it over at the fight's start), or null when the hand draws none. */
export function fightAmmoFor(content: Content, t: Tuning, hero: HeroRecord): FightAmmo | null {
  const itemId = heroAmmoItem(content, t, hero)
  return itemId ? { itemId, left: quiverCount(t, hero, itemId), spent: 0 } : null
}

/** The arrows a skill's lines spend: the sum of its `consume-ammo` amounts (Volley 3, Storm of Shafts 9). */
export function skillAmmoCost(skill: SkillDef): number {
  return skill.effects.reduce((s, l) => s + (l.kind === 'custom' && l.customId === 'consume-ammo' ? Math.max(0, l.amount ?? 1) : 0), 0)
}

/** True when the hero's bow or crossbow is counted and empty: the basic attack is a Bash. */
export function emptyQuiver(h: HeroActorData | undefined): boolean {
  return h?.ammo !== undefined && h.ammo !== null && h.weapon.ranged && h.ammo.left <= 0
}

/** Whether the hero has the arrows a skill needs (always, when the fight does not count them). */
export function hasAmmoFor(h: HeroActorData | undefined, skill: SkillDef): boolean {
  if (!h?.ammo) return true
  const need = skillAmmoCost(skill)
  return need <= 0 || h.ammo.left >= need
}

/** The basic attack's reach: a reach weapon, or a bow with something to shoot (an empty one bashes the front row). */
export function basicReach(h: HeroActorData): boolean {
  return h.weapon.reach || (h.weapon.ranged && !emptyQuiver(h))
}

/** Spends `n` from the actor's counted ammo (never below 0). */
export function spendAmmo(actor: Actor, n: number): void {
  const a = actor.hero?.ammo
  if (!a || n <= 0) return
  const used = Math.min(a.left, n)
  a.left -= used
  a.spent += used
}

/**
 * The quiver after a fight: what is left, plus Forager's Instinct's share of what was spent (`recover-ammo-percent`
 * on the actor, rounded down). A fight that counted nothing changes nothing.
 */
export function quiverAfterFight(record: HeroRecord, actor: Actor): HeroRecord {
  const a = actor.hero?.ammo
  if (!a) return record
  const pct = actor.hooks.filter((h) => h.customId === 'recover-ammo-percent').reduce((best, h) => Math.max(best, h.line.percent ?? 0), 0)
  const back = Math.floor((a.spent * Math.max(0, Math.min(100, pct))) / 100)
  // left + back never passes what the fight began with (back ≤ spent), so the carry cap needs no second look.
  return { ...record, quiver: { ...(record.quiver ?? {}), [a.itemId]: Math.max(0, Math.floor(a.left + back)) } }
}

/**
 * A stack of ammo found or bought in the delve: into the quiver of the first standing hero whose hand draws it
 * (`quantity` stacks of `ammo.stack`), returning that hero's index; null when nobody draws it (it stays an item).
 */
export function stowAmmo(content: Content, t: Tuning, heroes: { record: HeroRecord; fallen: boolean }[], inst: ItemInstance): number | null {
  const def = content.items.get(inst.itemId)
  if (!def?.ammo) return null
  const i = heroes.findIndex((h) => !h.fallen && heroAmmoItem(content, t, h.record) === inst.itemId)
  if (i < 0) return null
  const h = heroes[i]!
  h.record = withQuiver(t, h.record, inst.itemId, quiverCount(t, h.record, inst.itemId) + Math.max(1, inst.quantity) * def.ammo.stack)
  return i
}
