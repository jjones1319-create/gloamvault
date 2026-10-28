import type { Content } from '../../../../../sim/src/content.ts'
import { createHero, creationAttributes } from '../../../../../sim/src/hero.ts'
import { Rng } from '../../../../../sim/src/rng.ts'
import type { Tuning } from '../../../../../sim/src/tuning.ts'
import { clampLook } from '../../../../../sim/src/look.ts'
import type { ClassDef, HeroLook, HeroRecord, PetDef, SkillDef, SpeciesDef } from '../../../../../sim/src/types/content.ts'
import { ATTRIBUTES, type Attribute } from '../../../../../sim/src/types/enums.ts'

/**
 * The new-hero stepper's state and rules (03 §2.3): species × class × three Tier I skills × an egg of three × six
 * free points (at most three on one attribute) × a name. Pure, so the rules are tested apart from the screen.
 */

export const STEPS = ['species', 'class', 'look', 'skills', 'egg', 'points', 'review'] as const
export type StepId = (typeof STEPS)[number]

export const STEP_LABEL: Readonly<Record<StepId, string>> = {
  species: 'Species',
  class: 'Class',
  look: 'Look',
  skills: 'Skills',
  egg: 'Egg',
  points: 'Points',
  review: 'Review',
}

export const NAME_MAX = 16
export const STARTER_PICKS = 3

export type FreePoints = Partial<Record<Attribute, number>>

export interface Draft {
  speciesId: string | null
  classId: string | null
  /** Phase 5: body frame, skin tone, face preset, hair colour (indexes are clamped to the species at creation). */
  look: HeroLook
  skillIds: readonly string[]
  eggPetId: string | null
  petName: string
  points: FreePoints
  name: string
}

/** The look a new hero starts from: the broad frame, the first tone and face, dark brown hair. */
export const DEFAULT_LOOK: HeroLook = { frame: 'broad', skin: 0, face: 0, hair: 1 }

export const EMPTY_DRAFT: Draft = { speciesId: null, classId: null, look: DEFAULT_LOOK, skillIds: [], eggPetId: null, petName: '', points: {}, name: '' }

/** The draft's look made valid for its species (a tone or preset the species lacks falls back to the first). */
export function draftLook(content: Content, draft: Draft): HeroLook {
  const species = draft.speciesId ? content.species.get(draft.speciesId) : undefined
  const tones = species?.body.skinTones.length ?? 1
  const faces = species?.body.facePresets ?? 1
  return clampLook({ ...draft.look, skin: draft.look.skin < tones ? draft.look.skin : 0, face: draft.look.face < faces ? draft.look.face : 0 }, species, 'draft')
}

/* ---------- names (our own inventions, a handful per species) ---------- */

const NAMES: Readonly<Record<string, readonly string[]>> = {
  human: ['Edric', 'Maren', 'Tobin', 'Wenna', 'Corlis', 'Adda'],
  dwarf: ['Orrin', 'Bramma', 'Durik', 'Hesk', 'Gundra', 'Tolvar'],
  elf: ['Sylwen', 'Aelith', 'Vaenor', 'Nimra', 'Ithren', 'Caelis'],
  orc: ['Murga', 'Brosk', 'Vargha', 'Ozzak', 'Krenna', 'Drub'],
  halfling: ['Pell', 'Tansy', 'Hollis', 'Fennow', 'Dob', 'Mirabel'],
  draconid: ['Vyrex', 'Saska', 'Ignath', 'Korrath', 'Zhenna', 'Ashkar'],
}

/** A suggested name for the species; `index` cycles through the list. */
export function suggestedName(speciesId: string | null, index = 0): string {
  const list = NAMES[speciesId ?? ''] ?? NAMES.human!
  return list[((index % list.length) + list.length) % list.length]!
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
}

/* ---------- attribute lines ---------- */

/** The species' or class's attribute modifiers as "End +2 · Vit +1 · Agi −2" parts, biggest first. */
export function modParts(mods: Readonly<Partial<Record<Attribute, number>>>): { attr: Attribute; value: number }[] {
  return ATTRIBUTES.filter((a) => (mods[a] ?? 0) !== 0)
    .map((attr) => ({ attr, value: mods[attr] ?? 0 }))
    .sort((a, b) => b.value - a.value || ATTRIBUTES.indexOf(a.attr) - ATTRIBUTES.indexOf(b.attr))
}

/** The first sentence of a blurb or description ("Forge-row's finest."). */
export function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text.trim())
  return m ? m[1]! : text.trim()
}

/** The short role before the colon ("front-line tank"). */
export function roleShort(role: string): string {
  const i = role.indexOf(':')
  return (i > 0 ? role.slice(0, i) : role).trim()
}

/* ---------- skills ---------- */

/**
 * What a new hero may start with: the class's Tier I actives (no Ultimate, no monster technique), plus a passive
 * only when the class recommends it (its starter three), in school order.
 */
export function skillOptions(content: Content, classId: string | null): SkillDef[] {
  const cls = classId ? content.classes.get(classId) : undefined
  if (!cls) return []
  const schoolOrder = cls.schools.map((s) => s.id)
  return [...(content.skillsByClass.get(cls.id) ?? [])]
    .filter((s) => s.tier === 1 && !s.isUltimate && !s.monsterTechniqueOf && (s.type === 'active' || cls.starterSkillIds.includes(s.id)))
    .sort((a, b) => schoolOrder.indexOf(a.school) - schoolOrder.indexOf(b.school) || (a.type === b.type ? 0 : a.type === 'active' ? -1 : 1) || a.name.localeCompare(b.name))
}

/** Taps a skill: picked → unpicked; unpicked → picked while there is room (null when the three are full). */
export function toggleSkill(picked: readonly string[], id: string): string[] | null {
  if (picked.includes(id)) return picked.filter((x) => x !== id)
  if (picked.length >= STARTER_PICKS) return null
  return [...picked, id]
}

/* ---------- eggs ---------- */

/** The three creation eggs (03 §2.3: one F-grade egg chosen from three). */
export function eggOptions(content: Content): PetDef[] {
  return [...content.pets.values()].filter((p) => p.creationChoice)
}

/* ---------- free points ---------- */

export function pointsSpent(points: FreePoints): number {
  return ATTRIBUTES.reduce((s, a) => s + (points[a] ?? 0), 0)
}

export function canAddPoint(t: Tuning, points: FreePoints, attr: Attribute): boolean {
  return pointsSpent(points) < t.attributes.creation.freePoints && (points[attr] ?? 0) < t.attributes.creation.maxFreePerAttribute
}

export function addPoint(t: Tuning, points: FreePoints, attr: Attribute, delta: 1 | -1): FreePoints {
  const now = points[attr] ?? 0
  if (delta > 0 && !canAddPoint(t, points, attr)) return points
  if (delta < 0 && now <= 0) return points
  const next = { ...points, [attr]: now + delta }
  if (next[attr] === 0) delete next[attr]
  return next
}

/**
 * A sensible spread for the class: one point at a time round the class's bonus attributes, biggest bonus first,
 * until the six are placed (Warden End 2 · Str 2 · Vit 2; Blade Str 3 · Agi 3).
 */
export function suggestPoints(t: Tuning, cls: ClassDef | undefined): FreePoints {
  const order = cls ? modParts(cls.attributeMods).filter((m) => m.value > 0).map((m) => m.attr) : []
  const list: Attribute[] = order.length ? order : ['vitality', 'agility', 'perception']
  let points: FreePoints = {}
  for (let guard = 0; pointsSpent(points) < t.attributes.creation.freePoints && guard < 64; guard++) {
    const attr = list[guard % list.length]!
    if (canAddPoint(t, points, attr)) points = addPoint(t, points, attr, 1)
    else if (list.every((a) => !canAddPoint(t, points, a))) break
  }
  return points
}

/** Starting attributes (03 §2.3: 10 + species + class + free), or null while the species or class is missing. */
export function startingAttributes(content: Content, draft: Draft): Record<Attribute, number> | null {
  const species = draft.speciesId ? content.species.get(draft.speciesId) : undefined
  const cls = draft.classId ? content.classes.get(draft.classId) : undefined
  if (!species || !cls) return null
  try {
    return { ...creationAttributes(content.tuning, species, cls, draft.points) }
  } catch {
    return null
  }
}

/** The value before free points: 10 + species + class. */
export function baseAttribute(t: Tuning, species: SpeciesDef | undefined, cls: ClassDef | undefined, attr: Attribute): number {
  return t.attributes.base + (species?.attributeMods[attr] ?? 0) + (cls?.attributeMods[attr] ?? 0)
}

/**
 * The hero this draft would make, with its starter kit, for the derived numbers on the points step (the sim's own
 * `createHero` on a throwaway stream, so the preview is exactly what Create will build). Null while incomplete.
 */
export function provisionalHero(content: Content, draft: Draft): HeroRecord | null {
  if (!draft.speciesId || !draft.classId) return null
  const cls = content.classes.get(draft.classId)
  if (!cls) return null
  const skills = draft.skillIds.length === STARTER_PICKS ? draft.skillIds : cls.starterSkillIds
  try {
    return createHero(content, content.tuning, Rng.fromSeed(1), {
      id: 'preview',
      name: draft.name || 'Preview',
      speciesId: draft.speciesId,
      classId: draft.classId,
      freePoints: draft.points,
      starterSkillIds: skills,
      eggPetId: draft.eggPetId,
      look: draftLook(content, draft),
    })
  } catch {
    return null
  }
}

/* ---------- validity ---------- */

export interface StepContext {
  /** The selection is shut (D-090): the chosen hero still lives, or the Lantern Inn is full. */
  closed: boolean
  /** The save's first hero brings the creation egg; later chosen heroes find pets at the Stables (D-090). */
  firstHero: boolean
}

/** Why Next is not open yet on a step, or null when the step is done. */
export function stepBlocker(content: Content, step: StepId, draft: Draft, ctx: StepContext): string | null {
  switch (step) {
    case 'species':
      if (ctx.closed) return 'Your chosen hero still lives.'
      return draft.speciesId && content.species.has(draft.speciesId) ? null : 'Choose a species.'
    case 'class':
      return draft.classId && content.classes.has(draft.classId) ? null : 'Choose a class.'
    case 'look':
      // Every pick has a default: the look never holds the player up.
      return null
    case 'skills': {
      const ok = skillOptions(content, draft.classId).map((s) => s.id)
      const valid = draft.skillIds.filter((id) => ok.includes(id))
      return valid.length === STARTER_PICKS ? null : `Pick ${STARTER_PICKS - valid.length} more.`
    }
    case 'egg':
      if (!ctx.firstHero) return null
      return draft.eggPetId && eggOptions(content).some((p) => p.id === draft.eggPetId) ? null : 'Choose an egg.'
    case 'points': {
      const left = content.tuning.attributes.creation.freePoints - pointsSpent(draft.points)
      if (left > 0) return `Place ${left} more point${left === 1 ? '' : 's'}.`
      return cleanName(draft.name) ? null : 'Give your hero a name.'
    }
    case 'review':
      return null
  }
}

/** The furthest step the player may open: every step before it is done. */
export function furthestStep(content: Content, draft: Draft, ctx: StepContext): number {
  let i = 0
  while (i < STEPS.length - 1 && stepBlocker(content, STEPS[i]!, draft, ctx) === null) i++
  return i
}
