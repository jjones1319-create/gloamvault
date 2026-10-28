/**
 * What a hero wears and looks like, as data the assembler builds from (Phase 5): the body frame, species, look and
 * class, the gear pieces (an armor item maps to its class set's slot mesh — tier F for grades F–C, S from B up) and
 * the weapons, plus the 16-colour palette (skin from the species' tone, hair, iris, the class's cloth colours, the
 * item's metal, the trim by the best grade worn, the glow by the weapon's element). Pure: the viewer, the new-hero
 * preview and the delve all go through `characterSpec` / `starterSpec`, so the same hero looks the same everywhere.
 */
import type { Content } from '../../../../sim/src/content.ts'
import { clampLook } from '../../../../sim/src/look.ts'
import type { ClassDef, Equipment, HeroLook, HeroRecord, ItemDef, SpeciesDef } from '../../../../sim/src/types/content.ts'
import type { BodyFrame, Grade } from '../../../../sim/src/types/enums.ts'
import { tierForGrade } from './geometry.ts'
import type { HeroManifest } from './manifest.ts'
import { bestGrade, DEFAULT_LEATHER, DEFAULT_METAL, ELEMENT_GLOW, GRADE_ORDER, GRADE_TRIM, HAIR_FALLBACK, IRIS_FALLBACK, METAL, mixHex, paletteHexes, wrapPick } from './palette.ts'

export type GearSlot = 'helmet' | 'chest' | 'legs' | 'boots' | 'gloves'
export const GEAR_SLOTS: readonly GearSlot[] = ['helmet', 'chest', 'legs', 'boots', 'gloves']

/**
 * When a hero's class has no gear file yet, the piece borrows the nearest set that has one, by armor family (the
 * class's own colours still paint it), so a hero is never drawn bare for want of a file.
 */
export const FAMILY_SETS: Readonly<Record<string, readonly string[]>> = {
  plate: ['warden', 'blade'],
  mail: ['blade', 'warden'],
  leather: ['ranger', 'shade', 'blade'],
  robes: ['arcanist', 'mender'],
}

export interface OutfitPiece {
  slot: GearSlot
  /** The gear set to take the mesh from (the hero's class), and the sets to borrow from, in order, when it is missing. */
  setClass: string
  fallbacks: readonly string[]
  tier: 'F' | 'S'
  grade: Grade
  itemId: string
}

export interface OutfitWeapon {
  hand: 'main' | 'off'
  kind: 'weapon' | 'shield' | 'focus'
  weaponType: string
  tier: 'F' | 'S'
  grade: Grade
  itemId: string
  /** The item's `visual.meshId` (weapons.glb lists the meshIds each mesh serves). */
  meshId?: string
}

export interface Outfit {
  pieces: OutfitPiece[]
  weapons: OutfitWeapon[]
  trimGrade: Grade
  metal: string
  leather: string
  /** The main weapon's element (fire, frost …), or null for a physical weapon. */
  element: string | null
}

export interface CharacterSpec {
  frame: BodyFrame
  speciesId: string
  classId: string
  look: HeroLook
  outfit: Outfit
  /** Show the gear (the viewer's toggle); false shows the bare body and the species' parts. */
  gear: boolean
}

export const EMPTY_OUTFIT: Outfit = { pieces: [], weapons: [], trimGrade: 'F', metal: DEFAULT_METAL, leather: DEFAULT_LEATHER, element: null }

const ELEMENTS = new Set(Object.keys(ELEMENT_GLOW))

function weaponOf(def: ItemDef, hand: 'main' | 'off', grade: Grade): OutfitWeapon | null {
  if (!def.weaponType) return null
  const kind = def.kind === 'shield' ? 'shield' : def.weaponType === 'focus' || def.kind === 'focus' ? 'focus' : 'weapon'
  return { hand, kind, weaponType: def.weaponType, tier: tierForGrade(grade), grade, itemId: def.id, meshId: def.visual.meshId }
}

/** The outfit of a set of worn items (ids, or item instances' ids), read through the content. */
export function outfitOf(content: Content, classId: string, worn: Partial<Record<'mainHand' | 'offHand' | GearSlot, string | null>>, forceGrade?: Grade): Outfit {
  const pieces: OutfitPiece[] = []
  const weapons: OutfitWeapon[] = []
  const grades: Grade[] = []
  let metal: string | null = null
  let leather: string | null = null
  let element: string | null = null
  for (const slot of GEAR_SLOTS) {
    const id = worn[slot]
    const def = id ? content.items.get(id) : undefined
    if (!def || def.kind !== 'armor') continue
    const grade = forceGrade ?? def.grade
    grades.push(grade)
    const fallbacks = (def.armorFamily ? (FAMILY_SETS[def.armorFamily] ?? []) : []).filter((s) => s !== classId)
    pieces.push({ slot, setClass: classId, fallbacks, tier: tierForGrade(grade), grade, itemId: def.id })
    if (slot === 'chest' || metal === null) metal = METAL[def.visual.trimMetal] ?? metal
    if (def.armorFamily === 'leather' && (slot === 'chest' || leather === null)) leather = def.visual.tintPrimary
  }
  for (const [slot, hand] of [
    ['mainHand', 'main'],
    ['offHand', 'off'],
  ] as const) {
    const id = worn[slot]
    const def = id ? content.items.get(id) : undefined
    if (!def) continue
    const grade = forceGrade ?? def.grade
    const w = weaponOf(def, hand, grade)
    if (!w) continue
    weapons.push(w)
    grades.push(grade)
    if (hand === 'main' && def.damageType && ELEMENTS.has(def.damageType)) element = def.damageType
    if (metal === null) metal = METAL[def.visual.trimMetal] ?? null
  }
  // The metal is the class's own raw metal (its sheet's palette: gunmetal, dull iron, brass, blackened steel, silver —
  // the fourth palette colour, else the item's), so a crude copper kit does not turn every class into one orange
  // mass; grade S and up polish it bright. The F pieces are painted in the metal slot, the S pieces in cloth1 + trim.
  const cls = content.classes.get(classId)
  const classMetal = cls?.visual.palette[3] ?? metal ?? DEFAULT_METAL
  const fine = GRADE_ORDER.indexOf(bestGrade(grades)) >= GRADE_ORDER.indexOf('S')
  const metalColour = fine ? mixHex(classMetal, FINE_METAL, 0.6) : classMetal
  return { pieces, weapons, trimGrade: bestGrade(grades), metal: metalColour, leather: leather ?? DEFAULT_LEATHER, element }
}

/** A polished metal for grade S and better (the S-grade materials have no metal name in the content yet). */
const FINE_METAL = '#e2e7f0'

/** The ids a hero record wears. */
export function wornIds(equipment: Equipment): Partial<Record<'mainHand' | 'offHand' | GearSlot, string | null>> {
  return {
    mainHand: equipment.mainHand?.itemId ?? null,
    offHand: equipment.offHand?.itemId ?? null,
    helmet: equipment.helmet?.itemId ?? null,
    chest: equipment.chest?.itemId ?? null,
    legs: equipment.legs?.itemId ?? null,
    boots: equipment.boots?.itemId ?? null,
    gloves: equipment.gloves?.itemId ?? null,
  }
}

/** A hero record as the assembler's spec (its look clamped to the species; the id's default look when it has none). */
export function characterSpec(content: Content, hero: HeroRecord, gear = true): CharacterSpec {
  const species = content.species.get(hero.speciesId)
  const look = clampLook(hero.look, species, hero.id)
  return { frame: look.frame, speciesId: hero.speciesId, classId: hero.classId, look, outfit: outfitOf(content, hero.classId, wornIds(hero.equipment)), gear }
}

/**
 * The class's starter kit as worn (the viewer and the new-hero preview): the kit's armor and hands, placed the way
 * createHero places them (a second one-hand weapon goes to the off hand). `tier` S shows the same kit at grade S.
 */
export function starterOutfit(content: Content, classId: string, tier: 'F' | 'S' = 'F'): Outfit {
  const cls = content.classes.get(classId)
  if (!cls) return EMPTY_OUTFIT
  const worn: Partial<Record<'mainHand' | 'offHand' | GearSlot, string | null>> = {}
  for (const id of cls.starterKit) {
    const def = content.items.get(id)
    if (!def?.slot) continue
    if (def.slot === 'mainHand') {
      if (!worn.mainHand) worn.mainHand = id
      else if (!worn.offHand && def.hands !== 2) worn.offHand = id
    } else if (def.slot === 'offHand') {
      if (!worn.offHand) worn.offHand = id
    } else if ((GEAR_SLOTS as readonly string[]).includes(def.slot) && !worn[def.slot as GearSlot]) worn[def.slot as GearSlot] = id
  }
  return outfitOf(content, classId, worn, tier === 'S' ? 'S' : undefined)
}

export function starterSpec(content: Content, opts: { speciesId: string; classId: string; look: HeroLook; tier?: 'F' | 'S'; gear?: boolean }): CharacterSpec {
  const species = content.species.get(opts.speciesId)
  const look = clampLook(opts.look, species, `${opts.speciesId}:${opts.classId}`)
  return { frame: look.frame, speciesId: opts.speciesId, classId: opts.classId, look, outfit: starterOutfit(content, opts.classId, opts.tier ?? 'F'), gear: opts.gear ?? true }
}

/** A stable key for a spec: two specs with the same key build the same character. */
export function specKey(spec: CharacterSpec): string {
  const l = spec.look
  const o = spec.outfit
  return [
    spec.frame,
    spec.speciesId,
    spec.classId,
    l.skin,
    l.face,
    l.hair,
    spec.gear ? 1 : 0,
    o.trimGrade,
    o.element ?? '-',
    o.metal,
    o.leather,
    ...o.pieces.map((p) => `${p.slot}:${p.setClass}:${p.tier}`),
    ...o.weapons.map((w) => `${w.hand}:${w.weaponType}:${w.tier}`),
  ].join('|')
}

/** The species' hair colours (the manifest's, else the fallback list). */
export function hairColours(manifest: HeroManifest | null, speciesId: string): readonly string[] {
  const m = manifest?.species.get(speciesId)?.hair
  return m && m.length ? m : (HAIR_FALLBACK[speciesId] ?? HAIR_FALLBACK.human!)
}

/** The species' skin tones (the manifest's, else the content's). */
export function skinTones(manifest: HeroManifest | null, species: SpeciesDef | undefined): readonly string[] {
  const m = species ? manifest?.species.get(species.id)?.skinTones : undefined
  return m && m.length ? m : (species?.body.skinTones ?? ['#e8c4a8'])
}

/** True when the species' "hair" pick is its horn colour (the Draconid: no hair colours, bone colours instead). */
export function hairIsHorn(manifest: HeroManifest | null, speciesId: string): boolean {
  const m = manifest?.species.get(speciesId)
  if (m) return m.hair.length === 0 && m.bone.length > 0
  return speciesId === 'draconid'
}

/** What the look's `hair` index picks for a species: hair colours, or horn colours (hairIsHorn). */
export function hairChoices(manifest: HeroManifest | null, speciesId: string): readonly string[] {
  if (hairIsHorn(manifest, speciesId)) return manifest?.species.get(speciesId)?.bone ?? ['#e6dcc2', '#2b2a30', '#a8874a']
  return hairColours(manifest, speciesId)
}

/** The 16 palette colours for a spec. */
export function paletteFor(spec: CharacterSpec, species: SpeciesDef | undefined, cls: ClassDef | undefined, manifest: HeroManifest | null): string[] {
  const pal = cls?.visual.palette ?? []
  const look = spec.look
  const o = spec.gear ? spec.outfit : EMPTY_OUTFIT
  const accent = pal[2] ?? '#7fe3ff'
  const ms = manifest?.species.get(spec.speciesId)
  const iris = ms?.iris
  // The eye colour is the face preset's own (its suggested tint), else picked by the preset's index.
  const eye = ms?.presets[look.face]?.tint.eye ?? look.face
  const horn = hairIsHorn(manifest, spec.speciesId)
  const boneList = ms?.bone.length ? ms.bone : ['#e6dcc2', '#2b2a30', '#a8874a']
  return paletteHexes({
    bone: horn ? wrapPick(boneList, look.hair, '#e6dcc2') : (boneList[0] ?? '#e6dcc2'),
    skin: wrapPick(skinTones(manifest, species), look.skin, '#e8c4a8'),
    hair: wrapPick(hairColours(manifest, spec.speciesId), look.hair, '#3b2618'),
    iris: wrapPick(iris && iris.length ? iris : IRIS_FALLBACK[spec.speciesId], eye, '#5a3a22'),
    cloth1: pal[0] ?? '#6b7280',
    cloth2: pal[1] ?? '#8a4b2a',
    cloth3: pal[2] ?? '#e7dfc8',
    leather: o.leather,
    metal: o.metal,
    trim: GRADE_TRIM[o.trimGrade] ?? GRADE_TRIM.F,
    glow: o.element ? (ELEMENT_GLOW[o.element] ?? accent) : accent,
  })
}
