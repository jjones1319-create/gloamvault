import type { HeroActorData } from './fight-types.ts'
import type { ItemDef, SkillDef } from './types/content.ts'
import type { WeaponType } from './types/enums.ts'

/**
 * A skill's equipment requirement (the class sheets' "Needs" column: a shield, a weapon type, a two-hander, a weapon in
 * each hand) against the hands a hero holds. The fight offers a skill only when its hands meet it (D-093); the gear
 * screen and auto-equip read the same rule.
 */
export interface Hands {
  mainType: WeaponType | null
  mainHands: number
  shield: boolean
  /** A weapon in each hand. */
  dual: boolean
}

export function requirementProblemFor(skill: SkillDef, hands: Hands): string | null {
  const r = skill.requirements
  if (!r) return null
  if (r.shield && !hands.shield) return 'needs a shield'
  if (r.weaponTypes && r.weaponTypes.length > 0 && !(hands.mainType && r.weaponTypes.includes(hands.mainType))) return `needs a ${r.weaponTypes.join(' or ')}`
  if (r.twoHanded && hands.mainHands !== 2) return 'needs a two-handed weapon'
  if (r.dualWield && !hands.dual) return 'needs a weapon in each hand'
  return null
}

/** The hands two item defs make. */
export function handsOf(main: ItemDef | null, off: ItemDef | null): Hands {
  return { mainType: main?.weaponType ?? null, mainHands: main?.hands ?? 1, shield: off?.kind === 'shield', dual: main !== null && main.hands === 1 && off?.kind === 'weapon' }
}

/** A fighting hero's hands: its worn items, else the weapon and shield its actor was built with. */
export function actorHands(h: HeroActorData): Hands {
  const main = h.equipment.mainHand?.def ?? null
  const off = h.equipment.offHand?.def ?? null
  return {
    mainType: main?.weaponType ?? h.weapon.type,
    mainHands: main?.hands ?? h.weapon.hands,
    shield: off ? off.kind === 'shield' : h.shieldBlock > 0,
    dual: off ? off.kind === 'weapon' && (main?.hands ?? h.weapon.hands) === 1 : h.weapon.dual,
  }
}

export function requirementProblem(skill: SkillDef, main: ItemDef | null, off: ItemDef | null): string | null {
  return requirementProblemFor(skill, handsOf(main, off))
}

/** Whether a skill's equipment requirement holds for these hands. */
export function requirementMet(skill: SkillDef, main: ItemDef | null, off: ItemDef | null): boolean {
  return requirementProblem(skill, main, off) === null
}
