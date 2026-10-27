import { signal } from '@preact/signals'
import type { ComponentChildren } from 'preact'
import type { Content } from '../../../../../sim/src/content.ts'
import { livingHeroes, partyHeroes, totalGold, type Profile } from '../../../../../sim/src/town.ts'
import type { HeroRecord, ItemDef } from '../../../../../sim/src/types/content.ts'
import type { MaterialLadder } from '../../../../../sim/src/types/enums.ts'
import { battleXpForLevel, heroLevelXpCost } from '../../../../../sim/src/xp.ts'
import { profile } from '../../../game/session.ts'
import { Meter, Page, Tabs } from '../../kit/kit.tsx'

/**
 * Shared bits of Emberfall's places (03 §8.2, 07 §1): the place list, the hero the player is serving at a counter,
 * names for grades, slots and materials, and the frame every place uses.
 */

export type PlaceId = 'waystone' | 'blacksmith' | 'skills' | 'curio' | 'stables' | 'bank' | 'board' | 'inn' | 'shrine'

export interface PlaceInfo {
  id: PlaceId
  name: string
  icon: string
  /** Who keeps it (07 §1.1; the Shrine's keeper, D-089). */
  keeper: string | null
}

/** The hub's tiles, in reading order of its 3 × 3 grid. A new place goes here, in `VIEWS` and `placeLines()` (Town.tsx). */
export const PLACES: readonly PlaceInfo[] = [
  { id: 'waystone', name: 'Waystone', icon: '🏰', keeper: null },
  { id: 'blacksmith', name: 'Blacksmith', icon: '⚒️', keeper: 'Hesper Vane' },
  { id: 'curio', name: 'Curio Merchant', icon: '🔮', keeper: 'Mab' },
  { id: 'skills', name: 'Skill Hall', icon: '📜', keeper: 'Master Orrin' },
  { id: 'stables', name: 'Stables', icon: '🐾', keeper: 'Tomas Reed' },
  { id: 'bank', name: 'Bank', icon: '💰', keeper: 'Lysa Quill' },
  { id: 'inn', name: 'Lantern Inn', icon: '🏮', keeper: 'Brannock' },
  { id: 'shrine', name: 'Ember Shrine', icon: '🕯️', keeper: 'Mother Cendra' },
  { id: 'board', name: 'Quest Board', icon: '📌', keeper: null },
]

export function isPlaceId(id: string): id is PlaceId {
  return PLACES.some((p) => p.id === id)
}

export function placeInfo(id: PlaceId): PlaceInfo {
  return PLACES.find((p) => p.id === id)!
}

/** A place's frame: back to the hub, the place's name, the gold. */
export function PlacePage({ id, children, right }: { id: PlaceId; children: ComponentChildren; right?: ComponentChildren }) {
  const info = placeInfo(id)
  return (
    <Page name={`town-${id}`} title={info.name} back="town" right={right} bodyClass={`tw-place tw-place--${id}`}>
      {children}
    </Page>
  )
}

/* ---------- names ---------- */

export const GRADE_NAMES: Readonly<Record<string, string>> = {
  F: 'Crude',
  E: 'Common',
  D: 'Fine',
  C: 'Superior',
  B: 'Masterwork',
  A: 'Heroic',
  S: 'Legendary',
  SS: 'Mythic',
  God: 'Divine',
}

export const SLOT_NAMES: Readonly<Record<string, string>> = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  helmet: 'Helmet',
  chest: 'Chest',
  legs: 'Legs',
  boots: 'Boots',
  gloves: 'Gloves',
  ring: 'Ring',
  talisman: 'Talisman',
  relic: 'Relic',
  pet: 'Pet',
}

export function className(c: Content, id: string): string {
  return c.classes.get(id)?.name ?? id
}

export function speciesName(c: Content, id: string): string {
  return c.species.get(id)?.name ?? id
}

/** "Dwarf Warden". */
export function heroKind(c: Content, h: { speciesId: string; classId: string }): string {
  return `${speciesName(c, h.speciesId)} ${className(c, h.classId)}`
}

export function materialName(c: Content, id: string): string {
  if (id === 'divine-shard') return 'Divine Shard'
  return c.items.get(id)?.name ?? id
}

/** The material item a ladder rung pays out in, found the way the sim's salvage finds it (first in content order). */
export function ladderMaterial(c: Content, ladder: MaterialLadder | null, rung: number): ItemDef | undefined {
  if (!ladder) return undefined
  for (const d of c.items.values()) if (d.kind === 'material' && d.materialLadder === ladder && d.materialRung === rung) return d
  return undefined
}

export function canAfford(p: Profile, gold: number): boolean {
  return totalGold(p) >= gold
}

/* ---------- the hero a counter is serving ---------- */

/**
 * The hero picked at a counter (the Blacksmith, the Skill Hall, the Curio Merchant, the Stables), kept between places.
 * Not the save's chosen hero (D-090): any living hero can be picked; the dead lie at the Shrine.
 */
export const pickedHeroId = signal<string | null>(null)

export function pickedHero(p: Profile): HeroRecord | null {
  const living = livingHeroes(p)
  const id = pickedHeroId.value
  return living.find((h) => h.id === id) ?? partyHeroes(p)[0] ?? living[0] ?? null
}

/** The living roster as tabs (one hero: a plain line). */
export function HeroPicker({ c, label }: { c: Content; label: string }) {
  const p = profile.value
  if (!p) return null
  const hero = pickedHero(p)
  if (!hero) return null
  const living = livingHeroes(p)
  if (living.length <= 1) {
    return (
      <p class="tw-for">
        {label} <b>{hero.name}</b>
        <span class="tw-dim">
          {' '}
          · {heroKind(c, hero)} · Lv {hero.level}
        </span>
      </p>
    )
  }
  return (
    <div class="tw-picker">
      <span class="tw-picker__label">{label}</span>
      <Tabs tabs={living.map((h) => ({ id: h.id, label: `${h.name} · Lv ${h.level}` }))} value={hero.id} onChange={(id) => (pickedHeroId.value = id)} />
    </div>
  )
}

/* ---------- battle XP (D-082) ---------- */

/** XP into the current level and the XP the next level needs. */
export function xpProgress(c: Content, h: HeroRecord): { into: number; need: number } {
  const need = heroLevelXpCost(c.tuning, h.level + 1)
  const into = Math.max(0, Math.min(need, h.battleXp - battleXpForLevel(c.tuning, h.level)))
  return { into, need }
}

export function HeroXp({ c, hero }: { c: Content; hero: HeroRecord }) {
  const { into, need } = xpProgress(c, hero)
  return (
    <span class="tw-xp">
      <Meter value={into} max={need} tone="xp" compact label={`Level ${hero.level} XP`} />
      <span class="tw-xp__text">
        {into}/{need} XP
      </span>
    </span>
  )
}

/** The wayfarer grade badge text for a roster hero, or null for the chosen hero and heroes made otherwise. */
export function wayfarerGrade(c: Content, p: Profile, heroId: string): string | null {
  const id = p.wayfarerOf[heroId]
  return id ? (c.wayfarers.get(id)?.grade ?? null) : null
}
