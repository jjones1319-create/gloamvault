import { signal } from '@preact/signals'
import type { FunctionalComponent } from 'preact'
import { useEffect } from 'preact/hooks'
import type { Content } from '../../../../sim/src/content.ts'
import { canChooseHero, chestPrice, partyHeroes, pendingChosenLegacy, repairAllQuote, skillHallOffers, waystoneFloors, type Profile } from '../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../sim/src/types/content.ts'
import { content, loadNotes, profile } from '../../game/session.ts'
import { Btn, Empty, Page, Tile } from '../kit/kit.tsx'
import { buzz } from '../lib/haptics.ts'
import { navigate, type Route } from '../router.ts'
import { Bank } from './town/Bank.tsx'
import { Blacksmith } from './town/Blacksmith.tsx'
import { CurioMerchant } from './town/CurioMerchant.tsx'
import { Inn } from './town/Inn.tsx'
import { QuestBoard } from './town/QuestBoard.tsx'
import { HeroXp, PLACES, className, isPlaceId, type PlaceId } from './town/shared.tsx'
import { Shrine } from './town/Shrine.tsx'
import { SkillHall } from './town/SkillHall.tsx'
import { Stables } from './town/Stables.tsx'
import { delveGrowth, delveLosses, delveSummaryParts, namesList, outcomeTitle } from './town/text.ts'
import { Waystone, openDungeons } from './town/Waystone.tsx'
import './town.css'

/**
 * Emberfall (03 §1, §8.2; 07 §1): the hub at dusk — the party, what needs the player (a chosen hero to choose, the
 * dead at the Shrine), the last delve, and the nine places as a 3 × 3 grid of tiles — and each place at
 * `#town&place=<id>` with back to the hub. Everything goes through the session's `act`, so a refusal (not enough gold,
 * a locked tier) is a toast and every success is saved.
 */

/** Each place's screen. A new place goes here, in `PLACES` (town/shared.tsx) and in `placeLines()` below. */
const VIEWS: Record<PlaceId, FunctionalComponent> = {
  waystone: Waystone,
  blacksmith: Blacksmith,
  skills: SkillHall,
  curio: CurioMerchant,
  stables: Stables,
  bank: Bank,
  board: QuestBoard,
  inn: Inn,
  shrine: Shrine,
}

export function TownScreen({ route }: { route: Route }) {
  const c = content.value
  const p = profile.value
  if (!c || !p) {
    return (
      <Page name="town" title="Emberfall">
        <Empty>Lighting the lanterns…</Empty>
      </Page>
    )
  }
  const place = route.params.place
  if (place && isPlaceId(place)) {
    const View = VIEWS[place]
    return <View />
  }
  return <Hub c={c} p={p} />
}

/* ---------- the hub ---------- */

/** One line under each place's name: the thing worth knowing before you walk in. */
function placeLines(c: Content, p: Profile): Record<PlaceId, string> {
  const party = partyHeroes(p)
  const dungeon = openDungeons(c, p)[0]
  const floors = dungeon ? waystoneFloors(c, p, dungeon.id) : []
  const deepest = floors[floors.length - 1] ?? 1
  const repairs = party.reduce((sum, h) => sum + repairAllQuote(c, p, h.id).gold, 0)
  const learnable = party.reduce((n, h) => n + skillHallOffers(c, p, h.id).filter((o) => !o.locked).length, 0)
  const cheapest = Math.min(...[...c.chests.keys()].map((id) => chestPrice(c, p, id)))
  const eggs = p.eggs.length
  const dead = p.dead.length
  // 07 §7 (pass D): a finished contract waiting to be claimed is worth the walk.
  const toClaim = [...(p.contracts?.dailies ?? []), ...(p.contracts?.weekly ? [p.contracts.weekly] : [])].filter((x) => !x.claimed && x.progress >= x.goal).length
  return {
    waystone: p.activeDelve ? 'Your delve waits' : `Enter on floor ${deepest}`,
    blacksmith: repairs > 0 ? `Repairs: ${repairs} gold` : 'Repair and upgrade',
    skills: learnable > 0 ? `${learnable} skill${learnable === 1 ? '' : 's'} to learn` : 'Skills by level',
    curio: Number.isFinite(cheapest) ? `Chests from ${cheapest} gold` : 'Chests for gold',
    stables: eggs > 0 ? `${eggs} egg${eggs === 1 ? '' : 's'} to hatch` : 'Pets and stances',
    bank: p.bank > 0 ? `${p.bank} gold safe` : 'Keep gold safe',
    board: toClaim > 0 ? `${toClaim} contract${toClaim === 1 ? '' : 's'} to claim` : 'Dailies and the weekly',
    inn: canChooseHero(c, p) ? 'Choose a new hero' : `${p.heroes.length} / ${c.tuning.coop.rosterMax} heroes`,
    shrine: dead > 0 ? `${dead} lie${dead === 1 ? 's' : ''} here` : p.legacies.length > 0 ? `${p.legacies.length} legac${p.legacies.length === 1 ? 'y waits' : 'ies wait'}` : 'Raise or remember',
  }
}

const SEEN_KEY = 'gloamvault/town-last-delve-seen'

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

/** The delve count whose summary card the player dismissed (so the card returns after the next delve). */
const seenDelve = signal<string | null>(readSeen())

function dismissLastDelve(p: Profile): void {
  const key = String(p.progress.delves)
  seenDelve.value = key
  try {
    localStorage.setItem(SEEN_KEY, key)
  } catch {
    /* private mode: the card just comes back next time */
  }
}

function Hub({ c, p }: { c: Content; p: Profile }) {
  const party = partyHeroes(p)
  const lines = placeLines(c, p)
  const canChoose = canChooseHero(c, p)
  const legacy = canChoose ? pendingChosenLegacy(p) : null
  const deadNames = p.dead.map((d) => p.heroes.find((h) => h.id === d.heroId)?.name).filter((n): n is string => !!n)
  const notes = loadNotes.value
  const last = p.lastDelve && seenDelve.value !== String(p.progress.delves) ? p.lastDelve : null
  // What the save loader repaired is shown once: leaving the hub (or OK) clears it.
  useEffect(
    () => () => {
      if (loadNotes.value.length > 0) loadNotes.value = []
    },
    [],
  )

  return (
    <Page name="town" title="Emberfall" back="title" bodyClass="tw-hub">
      <div class="tw-hub__wrap">
        <Scene />
        <div class="tw-hub__top" aria-label="Your party and what needs you">
          {party.map((h) => (
            <PartyHero key={h.id} c={c} hero={h} />
          ))}
          {canChoose && (
            <button
              class="tw-hero tw-hero--call"
              data-testid="town-new-hero"
              onClick={() => {
                buzz()
                navigate('new-hero')
              }}
            >
              <span class="tw-hero__name">Your chosen hero is gone</span>
              <span class="tw-hero__kind">
                Choose a new one ›{legacy ? ` ${legacy.name}’s legacy (+${legacy.xp} XP) waits for them` : ''}
              </span>
            </button>
          )}
          {deadNames.length > 0 && (
            <button
              class="tw-hero tw-hero--shrine"
              data-testid="town-shrine-note"
              onClick={() => {
                buzz()
                navigate('town', { place: 'shrine' })
              }}
            >
              <span class="tw-hero__name">🕯️ {namesList(deadNames)}</span>
              <span class="tw-hero__kind">{deadNames.length === 1 ? 'lies' : 'lie'} at the Shrine · raise or lay to rest ›</span>
            </button>
          )}
          {notes.length > 0 && (
            <div class="tw-notice" role="status" data-testid="town-load-notes">
              <div class="tw-notice__text">
                <b>While loading your save</b>
                {notes.map((n, i) => (
                  <span key={i} class="tw-notice__line">
                    {n}
                  </span>
                ))}
              </div>
              <Btn class="tw-btn44" onClick={() => (loadNotes.value = [])}>
                OK
              </Btn>
            </div>
          )}
          {last && <LastDelve p={p} last={last} />}
        </div>
        <nav class="tw-places" aria-label="Places in Emberfall">
          {PLACES.map((pl) => (
            <Tile key={pl.id} testid={`town-place-${pl.id}`} icon={pl.icon} title={pl.name} sub={lines[pl.id]} onClick={() => navigate('town', { place: pl.id })} />
          ))}
        </nav>
      </div>
    </Page>
  )
}

function LastDelve({ p, last }: { p: Profile; last: NonNullable<Profile['lastDelve']> }) {
  const growth = delveGrowth(p.heroes, last)
  const losses = delveLosses(last)
  return (
    <div class={`tw-notice tw-notice--${last.outcome} ${losses.length > 0 ? 'tw-notice--grief' : ''}`} role="status" data-testid="town-last-delve">
      <div class="tw-notice__text">
        <span>
          <b>Last delve · {outcomeTitle(last.outcome)}</b> <span class="tw-notice__line">· {delveSummaryParts(last).join(' · ')}</span>
        </span>
        {growth.length > 0 && <span class="tw-notice__line">{growth.join(' · ')}</span>}
        {losses.length > 0 && <span class="tw-notice__line tw-notice__line--loss">{losses.join(' · ')}</span>}
      </div>
      <button class="btn btn--icon tw-notice__close" aria-label="Dismiss" data-testid="town-last-delve-close" onClick={() => dismissLastDelve(p)}>
        ×
      </button>
    </div>
  )
}

function PartyHero({ c, hero }: { c: Content; hero: HeroRecord }) {
  return (
    <button
      class="tw-hero"
      data-testid={`town-hero-${hero.id}`}
      onClick={() => {
        buzz()
        navigate('hero', { hero: hero.id, tab: 'status' })
      }}
    >
      <span class="tw-hero__top">
        <span class="tw-hero__name">{hero.name}</span>
        <span class="tw-hero__lv">Lv {hero.level}</span>
      </span>
      <span class="tw-hero__bottom">
        <span class="tw-hero__kind">{className(c, hero.classId)}</span>
        <HeroXp c={c} hero={hero} />
      </span>
    </button>
  )
}

/**
 * Emberfall at dusk, painted in CSS: a violet-to-ember sky with a few stars, the moor and Gravehollow's half-sunk
 * tower on the horizon, two rows of rooftops with chimneys, and warm windows. No images, no three.js.
 */
function Scene() {
  return (
    <div class="tw-scene" aria-hidden="true">
      <div class="tw-scene__sky" />
      <div class="tw-scene__stars" />
      <div class="tw-scene__moor" />
      <div class="tw-scene__keep">
        <span class="tw-scene__keep-light" />
      </div>
      <div class="tw-scene__roofs tw-scene__roofs--back" />
      <div class="tw-scene__roofs tw-scene__roofs--front" />
      <div class="tw-scene__windows">
        {WINDOWS.map((w, i) => (
          <span key={i} class={`tw-scene__window ${w.flicker ? 'tw-scene__window--flicker' : ''}`} style={{ left: `${w.x}%`, top: `${w.y}%`, width: `${w.w}px`, height: `${w.h}px` }} />
        ))}
      </div>
      <div class="tw-scene__street" />
    </div>
  )
}

/** Lit windows on the front rooftops (percent of the scene; px sizes). */
const WINDOWS: readonly { x: number; y: number; w: number; h: number; flicker?: boolean }[] = [
  { x: 9.8, y: 40.5, w: 6, h: 8 },
  { x: 24.5, y: 42, w: 5, h: 7, flicker: true },
  { x: 32.2, y: 40.5, w: 6, h: 8 },
  { x: 35.4, y: 40.5, w: 6, h: 8 },
  { x: 47.8, y: 41.5, w: 5, h: 7 },
  { x: 54.6, y: 42.5, w: 7, h: 9 },
  { x: 57.4, y: 42.5, w: 7, h: 9, flicker: true },
  { x: 63.4, y: 40.5, w: 5, h: 7 },
  { x: 76.6, y: 42.5, w: 6, h: 8 },
  { x: 86.6, y: 40.5, w: 5, h: 7, flicker: true },
  { x: 92.8, y: 42, w: 6, h: 8 },
]
