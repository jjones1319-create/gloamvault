import { signal } from '@preact/signals'
import { useEffect, useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { buildTomeBag, CHEST_RULES, chestOddsTable, chestOnSale, EMPTY_PITY, type ChestResult } from '../../../../../sim/src/chests.ts'
import { buyChest, chestBand, chestKeyBlocker, chestKeysHeld, chestPrice, openChestWithKey, ownedWayfarerIds, wayfarerArrivalLevel, type BuyChestOptions, type Profile } from '../../../../../sim/src/town.ts'
import type { ChestDef, HeroRecord } from '../../../../../sim/src/types/content.ts'
import { CHEST_SUBTYPES, GRADES, gradeIndex, MATERIAL_LADDERS, WAYFARER_GRADES, type ChestSubtype, type Grade as GradeId, type MaterialLadder } from '../../../../../sim/src/types/enums.ts'
import { wayfarerOddsTable, wayfarerPool } from '../../../../../sim/src/wayfarers.ts'
import { act, actWith, content, ephemeral, profile } from '../../../game/session.ts'
import { Btn, Gold, Grade, Modal, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { navigate, route } from '../../router.ts'
import { GRADE_NAMES, HeroPicker, PlacePage, SLOT_NAMES, canAfford, className, heroKind, ladderMaterial, materialName, pickedHero } from './shared.tsx'
import { titleCase } from './text.ts'

/**
 * The Curio Merchant, Mab (03 §8.3; 08 §10; D-091): the Wayfarer Chests that call a new party member to the Lantern
 * Inn (the Grand one from chest band E, with S-grade wayfarers), and eight chests of gear, eggs, material and Tomes —
 * gold only, each with an Odds sheet (the exact table at the player's chest band with the hero's Luck, the pity
 * counters, the Tome bag, the wayfarers still out in the world) and a reveal that names what came out. A chest key
 * (07 §7: contracts and bosses give them) opens one chest of its tier free. The picked hero's class sets the gear and
 * Tomes, and their Luck shifts the odds; a Gear Chest can be aimed at a weapon, armor or a trinket and a Material
 * Crate at a ladder.
 */

const KIND_ORDER = ['gear', 'petEgg', 'materialCrate', 'skillTome'] as const
const KIND_NAMES: Record<string, string> = { gear: 'Gear Chest', petEgg: 'Pet Egg', materialCrate: 'Material Crate', skillTome: 'Skill Tome', wayfarer: 'Wayfarer Chest' }
const KIND_ICONS: Record<string, string> = { gear: '⚔️', petEgg: '🥚', materialCrate: '📦', skillTome: '📘', wayfarer: '🧭' }
const SUBTYPE_NAMES: Record<ChestSubtype, string> = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket' }
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

/** What a Gear Chest is aimed at (null: any of the three) and the ladder a Material Crate holds; kept between visits. */
const gearAim = signal<ChestSubtype | null>(null)
const crateLadder = signal<MaterialLadder>('metal')

function sortedChests(c: Content): ChestDef[] {
  const kindIndex = (k: string) => {
    const i = (KIND_ORDER as readonly string[]).indexOf(k)
    return i < 0 ? 99 : i
  }
  return [...c.chests.values()].filter((x) => x.kind !== 'wayfarer').sort((a, b) => kindIndex(a.kind) - kindIndex(b.kind))
}

function pct(n: number): string {
  return `${Number(n.toFixed(2))}%`
}

/** The grade `steps` above the band, capped at SS (pity never forces God). */
function gradeAbove(band: GradeId, steps: number): GradeId {
  return GRADES[Math.min(gradeIndex('SS'), gradeIndex(band) + steps)] as GradeId
}

/** Chests until each pity layer forces its grade. Counters are kept per chest family (Standard and Grand share them; a Grand counts 3). */
function pityLeft(p: Profile, chest: ChestDef): { one: number; two: number } {
  const st = p.pity[chest.kind] ?? EMPTY_PITY
  const adv = chest.tier === 'grand' ? CHEST_RULES.grandPityAdvance : 1
  return {
    one: Math.max(1, Math.ceil((chest.pity.plusOneWithin - st.plusOneCounter) / adv)),
    two: Math.max(1, Math.ceil((chest.pity.plusTwoWithin - st.plusTwoCounter) / adv)),
  }
}

const hasPity = (chest: ChestDef) => chest.kind === 'gear' || chest.kind === 'petEgg' || chest.kind === 'wayfarer'

function crateUnits(chest: ChestDef): number {
  return chest.tier === 'grand' ? CHEST_RULES.crateUnits.grand : CHEST_RULES.crateUnits.standard
}

function tomeTiers(c: Content, chest: ChestDef): { min: number; max: number } {
  return chest.tomeTiers ?? c.tuning.economy.chests.tomeTiers[chest.tier as 'standard' | 'grand']
}

/** What the gear chest is aimed at, in words: "a weapon" · "an armor piece" · "a trinket" · "a weapon, armor piece or trinket". */
function aimWords(aim: ChestSubtype | null): string {
  return aim === 'weapon' ? 'a weapon' : aim === 'armor' ? 'an armor piece' : aim === 'trinket' ? 'a trinket' : 'a weapon, armor piece or trinket'
}

/** One line on the card: what the chest gives this hero. */
function whatItGives(c: Content, chest: ChestDef, band: GradeId, hero: HeroRecord | null): string {
  const grand = chest.tier === 'grand'
  const cls = hero ? className(c, hero.classId) : 'your hero'
  switch (chest.kind) {
    case 'gear':
      return grand ? `One item a grade up: ${aimWords(gearAim.value)} for a ${cls}` : `${titleFirst(aimWords(gearAim.value))} for a ${cls}`
    case 'petEgg':
      return grand ? 'One pet egg, a grade up' : 'One pet egg from your band'
    case 'materialCrate': {
      const mat = ladderMaterial(c, crateLadder.value, gradeIndex(band))
      return `${crateUnits(chest)} ${mat?.name ?? titleCase(crateLadder.value)}${grand ? ' and a rare part' : ', maybe a rare part'}`
    }
    case 'skillTome': {
      const t = tomeTiers(c, chest)
      return `One ${cls} skill, Tier ${ROMAN[t.min] ?? t.min}–${ROMAN[t.max] ?? t.max}, never a repeat`
    }
    case 'wayfarer':
      return grand ? 'Calls a wayfarer of grade C or better (S at 5%) to the Lantern Inn' : 'Calls a wayfarer to the Lantern Inn: a new party member'
    default:
      return chest.name
  }
}

function titleFirst(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** Why a chest is not sold at the player's band yet (a chest's minBand), or null. */
function notOnSale(chest: ChestDef, band: GradeId): string | null {
  return chestOnSale(chest, band) ? null : `Sold from chest band ${chest.minBand}: finish a ${chest.minBand === 'E' ? 'Crypts' : 'deeper'} floor first`
}

/** Why the Wayfarer Chest cannot be opened right now (by gold unless `withKey`), or null. */
function wayfarerBlock(c: Content, p: Profile, chest: ChestDef, withKey = false): string | null {
  const sale = notOnSale(chest, chestBand(p))
  if (sale) return sale
  if (p.heroes.length >= c.tuning.coop.rosterMax) return `The Lantern Inn is full (${c.tuning.coop.rosterMax} heroes)`
  if (wayfarerPool(c, ownedWayfarerIds(p)).length === 0) return 'Every wayfarer is already with you'
  if (withKey) return chestKeyBlocker(c, p, chest.id)
  if (!canAfford(p, chestPrice(c, p, chest.id))) return 'Not enough gold'
  return null
}

/** "Standard Key ×2 · Grand Key ×1", or null when none are held. */
function keysLine(c: Content, p: Profile): string | null {
  const std = chestKeysHeld(c, p, 'standard')
  const grand = chestKeysHeld(c, p, 'grand')
  const parts = [std > 0 ? `Standard Key ×${std}` : null, grand > 0 ? `Grand Key ×${grand}` : null].filter((x): x is string => x !== null)
  return parts.length ? parts.join(' · ') : null
}

interface Reveal {
  chestId: string
  hero: HeroRecord | null
  result: ChestResult
  n: number
}

/** `#town&place=curio&demo=1&keys=1` (Phase 7): an EPHEMERAL demo profile gets two Standard Keys, a Grand Key and a Crypts floor finished (chest band E), so the key buttons and the Grand Wayfarer Chest show on a screenshot. */
function seedKeyShowcase(): void {
  if (!ephemeral.value) return
  act((_c, p) => ((p.materials['standard-chest-key'] ?? 0) > 0 ? p : { ...p, materials: { ...p.materials, 'standard-chest-key': 2, 'grand-chest-key': 1 }, progress: { ...p.progress, deepest: { ...p.progress.deepest, 'gravehollow-keep': Math.max(4, p.progress.deepest['gravehollow-keep'] ?? 0) } } }))
}

export function CurioMerchant() {
  useEffect(() => {
    if (route.value.params.keys === '1') seedKeyShowcase()
  }, [])
  const c = content.value!
  const p = profile.value!
  const hero = pickedHero(p)
  const [oddsFor, setOddsFor] = useState<string | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const band = chestBand(p)
  const chests = sortedChests(c)
  // The Standard Wayfarer Chest first, the Grand (Phase 7, from band E) after it.
  const wayfarerChests = [...c.chests.values()].filter((x) => x.kind === 'wayfarer').sort((a, b) => Number(a.tier === 'grand') - Number(b.tier === 'grand'))

  const buy = (chestId: string, withKey = false) => {
    const chest = c.chests.get(chestId)
    if (!chest) return
    const wayfarer = chest.kind === 'wayfarer'
    if (!wayfarer && !hero) return
    const options: BuyChestOptions = {}
    if (chest.kind === 'gear' && gearAim.value) options.subtype = gearAim.value
    if (chest.kind === 'materialCrate') options.materialLadder = crateLadder.value
    const heroId = wayfarer ? null : hero!.id
    const result = actWith<ChestResult>((cc, pp) => (withKey ? openChestWithKey(cc, pp, chestId, heroId, options) : buyChest(cc, pp, chestId, heroId, options)))
    setOddsFor(null)
    if (result) setReveal({ chestId, hero: wayfarer ? null : hero, result, n: (reveal?.n ?? 0) + 1 })
  }

  /** Why a chest's Buy (or, with a key, its Open) is off, or null. */
  const blockOf = (chest: ChestDef, withKey = false): string | null => {
    if (chest.kind === 'wayfarer') return wayfarerBlock(c, p, chest, withKey)
    if (!hero) return 'No living hero to open it for'
    const sale = notOnSale(chest, band)
    if (sale) return sale
    if (withKey) return chestKeyBlocker(c, p, chest.id)
    return canAfford(p, chestPrice(c, p, chest.id)) ? null : 'Not enough gold'
  }

  /** The "Open with a key" button, shown while a key of the chest's tier is held. */
  const keyButton = (chest: ChestDef) => {
    if (chestKeysHeld(c, p, chest.tier) <= 0) return null
    const block = blockOf(chest, true)
    return (
      <Btn class="tw-btn44 tw-chest__key" testid={`cm-key-${chest.id}`} disabled={block !== null} title={block ?? `Open with a ${chest.tier === 'grand' ? 'Grand' : 'Standard'} Key`} onClick={() => buy(chest.id, true)}>
        🗝 Key
      </Btn>
    )
  }

  const card = (chest: ChestDef) => {
    const price = chestPrice(c, p, chest.id)
    const block = blockOf(chest)
    const left = hasPity(chest) && chest.kind !== 'wayfarer' ? pityLeft(p, chest) : null
    return (
      <article key={chest.id} class={`tw-chest tw-chest--${chest.tier}`}>
        <div class="tw-chest__head">
          <span class="tw-chest__icon" aria-hidden="true">
            {KIND_ICONS[chest.kind] ?? '🎁'}
          </span>
          <b class="tw-chest__name">{KIND_NAMES[chest.kind] ?? chest.name}</b>
        </div>
        <p class="tw-chest__what">{whatItGives(c, chest, band, hero)}</p>
        {left && (
          <p class="tw-chest__pity" title="Pity: a better grade is certain within this many chests">
            Sure: a better grade within {left.one}, two better within {left.two}
          </p>
        )}
        <div class="tw-chest__foot">
          <Btn class="tw-btn44" testid={`cm-odds-${chest.id}`} onClick={() => setOddsFor(chest.id)}>
            Odds
          </Btn>
          {keyButton(chest)}
          <Btn tone="primary" class="tw-btn44 tw-chest__buy" testid={`cm-buy-${chest.id}`} disabled={block !== null} title={block ?? `Buy ${chest.name}`} onClick={() => buy(chest.id)}>
            Buy <Gold amount={price} />
          </Btn>
        </div>
      </article>
    )
  }

  const wayfarerCard = (chest: ChestDef) => {
    const price = chestPrice(c, p, chest.id)
    const block = wayfarerBlock(c, p, chest)
    const owned = ownedWayfarerIds(p)
    const left = wayfarerPool(c, owned).length
    const pity = pityLeft(p, chest)
    return (
      <article key={chest.id} class="tw-chest tw-chest--wayfarer" data-testid={`cm-card-${chest.id}`}>
        <span class="tw-chest__icon tw-chest__icon--big" aria-hidden="true">
          {KIND_ICONS.wayfarer}
        </span>
        <div class="tw-wayfarer__main">
          <b class="tw-chest__name">{chest.name}</b>
          <p class="tw-chest__what">{whatItGives(c, chest, band, hero)}.</p>
          <p class="tw-chest__what">
            {left} of {c.wayfarers.size} wayfarers still out in the world · they arrive at level {wayfarerArrivalLevel(p)}
          </p>
          <p class="tw-chest__pity">
            Sure: C or better within {pity.one}, B or better within {pity.two}
            {chest.tier === 'grand' ? ' (a Grand counts as three)' : ''}
          </p>
          {block && block !== 'Not enough gold' && <p class="tw-chest__block">{block}.</p>}
        </div>
        <div class="tw-wayfarer__buttons">
          <Btn class="tw-btn44" testid={`cm-odds-${chest.id}`} onClick={() => setOddsFor(chest.id)}>
            Odds
          </Btn>
          {keyButton(chest)}
          <Btn tone="primary" class="tw-btn44 tw-chest__buy" testid={`cm-buy-${chest.id}`} disabled={block !== null} title={block ?? `Buy ${chest.name}`} onClick={() => buy(chest.id)}>
            Buy <Gold amount={price} />
          </Btn>
        </div>
      </article>
    )
  }

  const odds = oddsFor ? c.chests.get(oddsFor) : undefined
  const revealChest = reveal ? c.chests.get(reveal.chestId) : undefined

  return (
    <PlacePage id="curio">
      <div class="tw-curio__top">
        <HeroPicker c={c} label="Opening for" />
        <span class="tw-pill" title="Your chest band is the band of the deepest floor you have finished">
          Chest band <Grade grade={band} /> {GRADE_NAMES[band]}
        </span>
        {keysLine(c, p) && (
          <span class="tw-pill" data-testid="cm-keys" title="A chest key opens one chest of its tier free: contracts and bosses give them">
            🗝 {keysLine(c, p)}
          </span>
        )}
      </div>
      {wayfarerChests.length > 0 && (
        <Section title="Party members">
          <div class="tw-wayfarers">{wayfarerChests.map(wayfarerCard)}</div>
        </Section>
      )}
      <div class="tw-choices" aria-label="What the chests hold">
        <span class="tw-choices__label">Gear chests give</span>
        <div class="tw-row-buttons" role="radiogroup" aria-label="Gear chest aim">
          {([null, ...CHEST_SUBTYPES] as (ChestSubtype | null)[]).map((s) => (
            <button
              key={s ?? 'any'}
              role="radio"
              aria-checked={gearAim.value === s}
              class={`tw-seg ${gearAim.value === s ? 'tw-seg--on' : ''}`}
              data-testid={`cm-aim-${s ?? 'any'}`}
              onClick={() => {
                buzz()
                gearAim.value = s
              }}
            >
              {s ? SUBTYPE_NAMES[s] : 'Any'}
            </button>
          ))}
        </div>
        <span class="tw-choices__label">Crates hold</span>
        <div class="tw-row-buttons" role="radiogroup" aria-label="Material crate ladder">
          {MATERIAL_LADDERS.map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={crateLadder.value === l}
              class={`tw-seg ${crateLadder.value === l ? 'tw-seg--on' : ''}`}
              data-testid={`cm-ladder-${l}`}
              onClick={() => {
                buzz()
                crateLadder.value = l
              }}
            >
              {titleCase(l)}
            </button>
          ))}
        </div>
      </div>
      <Section title="Standard">
        <div class="tw-chests">{chests.filter((x) => x.tier === 'standard').map(card)}</div>
      </Section>
      <Section title="Grand">
        <div class="tw-chests">{chests.filter((x) => x.tier === 'grand').map(card)}</div>
      </Section>
      <p class="tw-note">Gold only: nothing here is sold for money. Every chest shows its odds.</p>

      {odds && (
        <Modal
          title={`${odds.name}: the odds`}
          testid="cm-odds"
          onClose={() => setOddsFor(null)}
          actions={
            <>
              <Btn onClick={() => setOddsFor(null)}>Close</Btn>
              <Btn tone="primary" testid="cm-odds-buy" disabled={blockOf(odds) !== null} onClick={() => buy(odds.id)}>
                Buy <Gold amount={chestPrice(c, p, odds.id)} />
              </Btn>
            </>
          }
        >
          {odds.kind === 'wayfarer' ? <WayfarerOdds c={c} p={p} chest={odds} band={band} /> : hero ? <OddsSheet c={c} p={p} chest={odds} band={band} hero={hero} /> : <p class="tw-modal-text">No living hero to open it for.</p>}
        </Modal>
      )}

      {reveal && revealChest && (
        <Modal
          title={revealChest.name}
          testid="cm-reveal"
          onClose={() => setReveal(null)}
          actions={
            <>
              <Btn testid="cm-reveal-again" disabled={blockOf(revealChest) !== null} onClick={() => buy(revealChest.id)}>
                Another <Gold amount={chestPrice(c, p, revealChest.id)} />
              </Btn>
              {reveal.result.kind === 'wayfarer' && (
                <Btn testid="cm-reveal-meet" onClick={() => navigate('hero', { hero: (reveal.result as { heroId: string }).heroId, tab: 'status' })}>
                  Meet them
                </Btn>
              )}
              <Btn tone="primary" testid="cm-reveal-close" onClick={() => setReveal(null)}>
                Done
              </Btn>
            </>
          }
        >
          <div class={`tw-reveal tw-reveal--${revealTone(reveal.result)}`} key={reveal.n} data-testid="cm-reveal-result">
            <div class="tw-reveal__chest" aria-hidden="true">
              <span class="tw-reveal__lid" />
              <span class="tw-reveal__box" />
            </div>
            <div class="tw-reveal__burst" aria-hidden="true" />
            <div class="tw-reveal__result">
              <RevealResult c={c} p={p} r={reveal.result} hero={reveal.hero} />
            </div>
          </div>
        </Modal>
      )}
    </PlacePage>
  )
}

/** The grade (or a stand-in) that colours the reveal's light. */
function revealTone(r: ChestResult): string {
  switch (r.kind) {
    case 'item':
    case 'salvage':
    case 'egg':
    case 'bondStar':
    case 'wayfarer':
      return r.grade.toLowerCase()
    case 'shard':
      return 'god'
    default:
      return 'plain'
  }
}

function RevealResult({ c, p, r, hero }: { c: Content; p: Profile; r: ChestResult; hero: HeroRecord | null }) {
  const who = hero?.name ?? 'your hero'
  switch (r.kind) {
    case 'item': {
      const def = c.items.get(r.inst.itemId)
      const affixes = r.inst.affixes.map((a) => c.affixes.get(a.affixId)?.name).filter((x): x is string => !!x)
      return (
        <>
          <p class="tw-reveal__name">
            <Grade grade={r.grade} /> {def?.name ?? r.inst.itemId}
          </p>
          <p class="tw-reveal__sub">
            {GRADE_NAMES[r.grade]} {(SLOT_NAMES[def?.slot ?? ''] ?? def?.kind ?? 'item').toLowerCase()}
            {affixes.length > 0 && ` · ${affixes.join(', ')}`}
          </p>
          <p class="tw-reveal__sub">In the armory now: equip it on {who}'s Gear tab.</p>
          {r.pityGrade && <p class="tw-pill tw-pill--good">The pity counter made this grade certain</p>}
        </>
      )
    }
    case 'salvage':
      return (
        <>
          <p class="tw-reveal__name">
            <Grade grade={r.grade} /> {c.items.get(r.itemId)?.name ?? r.itemId}
          </p>
          <p class="tw-reveal__sub">
            You already own one, so it became {r.units} {ladderMaterial(c, r.materialLadder, r.materialRung)?.name ?? 'material'}.
          </p>
        </>
      )
    case 'egg':
      return (
        <>
          <p class="tw-reveal__name">
            <Grade grade={r.grade} /> {c.pets.get(r.petId)?.name ?? r.petId} egg
          </p>
          <p class="tw-reveal__sub">Hatch it at the Stables and give it to a hero.</p>
          {r.pityGrade && <p class="tw-pill tw-pill--good">The pity counter made this grade certain</p>}
        </>
      )
    case 'bondStar':
      return (
        <>
          <p class="tw-reveal__name">+1 bond star: {c.pets.get(r.petId)?.name ?? r.petId}</p>
          <p class="tw-reveal__sub">You already have this pet, so it grows closer instead: +5% to its stats.</p>
        </>
      )
    case 'materials':
      return (
        <>
          <p class="tw-reveal__name">
            {r.units} × {materialName(c, r.materialId)}
          </p>
          <p class="tw-reveal__sub">{r.rarePart ? `And a rare part: ${c.items.get(r.rarePart.itemId)?.name ?? r.rarePart.itemId}.` : 'Material for promoting gear at the Blacksmith.'}</p>
        </>
      )
    case 'shard':
      return (
        <>
          <p class="tw-reveal__name">✦ A Divine Shard</p>
          <p class="tw-reveal__sub">Ten of them forge a Divine item.</p>
        </>
      )
    case 'tome': {
      // Phase 7: the chest gives a Skill Tome (an item in the armory); a hero of its class reads it on the Skills tab.
      const s = c.skills.get(r.skillId)
      const cls = s ? c.classes.get(s.classId) : undefined
      return (
        <>
          <p class="tw-reveal__name" data-testid="cm-reveal-tome">
            📖 Skill Tome: {s?.name ?? r.skillId} <span class="tw-dim">· Tier {ROMAN[r.tier] ?? r.tier}</span>
          </p>
          <p class="tw-reveal__sub">{s?.description}</p>
          <p class="tw-reveal__sub">In the armory now: {who === 'your hero' ? `a ${cls?.name ?? 'hero'}` : who} reads it on the Skills tab (a skill already known becomes a rank of practice).</p>
        </>
      )
    }
    case 'tomeOfPractice':
      return (
        <>
          <p class="tw-reveal__name">A Tome of Practice</p>
          <p class="tw-reveal__sub">Every tome of these tiers is already yours, so {who} trains a skill a full rank instead.</p>
        </>
      )
    case 'wayfarer': {
      const def = c.wayfarers.get(r.wayfarerId)
      const h = p.heroes.find((x) => x.id === r.heroId)
      const joined = p.partyIds.includes(r.heroId)
      return (
        <div class="tw-arrival" data-testid="cm-reveal-wayfarer">
          <p class="tw-reveal__name">
            <Grade grade={r.grade} /> {def?.name ?? h?.name ?? 'A wayfarer'}
          </p>
          <p class="tw-reveal__sub">
            {def ? heroKind(c, def) : h ? heroKind(c, h) : ''} · level {h?.level ?? 1} · {joined ? 'joined the party' : 'waits at the Inn'}
          </p>
          {def?.bio && <p class="tw-arrival__bio">“{def.bio}”</p>}
          {r.pityGrade && <p class="tw-pill tw-pill--good">The pity counter made this grade certain</p>}
        </div>
      )
    }
    case 'nobodyLeft':
      return (
        <>
          <p class="tw-reveal__name">Nobody answered</p>
          <p class="tw-reveal__sub">Every wayfarer of the cast is already with you.</p>
        </>
      )
    default:
      // A result kind this screen does not know yet (a new chest family): still say something.
      return <p class="tw-reveal__name">Something new is yours.</p>
  }
}

/** The Wayfarer Chest's sheet (D-091): the grade table with who is left of each grade, the pity, and the cast still out in the world. */
function WayfarerOdds({ c, p, chest, band }: { c: Content; p: Profile; chest: ChestDef; band: GradeId }) {
  const owned = ownedWayfarerIds(p)
  const rows = wayfarerOddsTable(c, chest, band, owned)
  const pool = wayfarerPool(c, owned)
  const left = pityLeft(p, chest)
  const byGrade = [...WAYFARER_GRADES].reverse()
  return (
    <>
      <p class="tw-modal-text">A wayfarer of the cast who is not with you yet comes to the Lantern Inn at level {wayfarerArrivalLevel(p)}, your lowest-level hero’s:</p>
      <div class="tw-odds" role="table" aria-label="Grade odds">
        {rows.map((r) => (
          <div key={r.grade} class="tw-odds__row" role="row">
            <span class="tw-odds__grade" role="cell">
              <Grade grade={r.grade as GradeId} /> wayfarers
            </span>
            <span class="tw-odds__bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, r.liveChance)}%` }} />
            </span>
            <b class="tw-odds__pct" role="cell">
              {pct(r.liveChance)} · {r.left} left
            </b>
          </div>
        ))}
      </div>
      {rows.some((r) => r.liveChance !== r.percent) && <p class="tw-modal-text tw-small tw-dim">A grade with nobody left passes its chance to the grades that still have someone.</p>}
      <p class="tw-modal-text tw-small" data-testid="cm-pity">
        Pity: C or better is certain within {left.one} more chest{left.one === 1 ? '' : 's'}, and B or better within {left.two}.
      </p>
      <p class="tw-modal-text tw-small tw-dim">Wayfarers who die for good come back to this chest, and start over if they answer again.</p>
      <h3 class="tw-odds__head">Still out in the world ({pool.length})</h3>
      <ul class="tw-cast" data-testid="cm-wayfarer-pool">
        {byGrade.flatMap((g) =>
          pool
            .filter((w) => w.grade === g)
            .map((w) => (
              <li key={w.id} class="tw-cast__row">
                <Grade grade={w.grade} /> <b>{w.name}</b> <span class="tw-dim">· {heroKind(c, w)}</span>
              </li>
            )),
        )}
      </ul>
    </>
  )
}

function OddsSheet({ c, p, chest, band, hero }: { c: Content; p: Profile; chest: ChestDef; band: GradeId; hero: HeroRecord }) {
  const luck = hero.attributes.luck
  const s = c.tuning.equipment.dropShape
  const shiftPp = Math.min(s.luckCapPp, Math.max(0, (luck - 10) * s.luckPpPerPoint))
  const luckLine =
    shiftPp > 0
      ? `${hero.name}'s Luck (${luck}) moves ${Number(shiftPp.toFixed(2))}% from the lowest line to the better ones.`
      : `${hero.name}'s Luck is ${luck}: each point above 10 moves half a percent to the better lines.`

  if (chest.kind === 'gear' || chest.kind === 'petEgg') {
    const lines = chestOddsTable(c.tuning, chest, band, luck)
    const left = pityLeft(p, chest)
    const g1 = gradeAbove(band, 1)
    const g2 = gradeAbove(band, 2)
    return (
      <>
        <p class="tw-modal-text">
          {chest.kind === 'gear'
            ? `${titleFirst(chest.tier === 'grand' ? `an item a grade up (${aimWords(gearAim.value)})` : aimWords(gearAim.value))} for a ${className(c, hero.classId)}, rolled at your band ${band}:`
            : `A pet egg from the pets of your band ${band}:`}
        </p>
        <div class="tw-odds" role="table" aria-label="Grade odds">
          {lines.map((l) => (
            <div key={l.grade} class="tw-odds__row" role="row">
              <span class="tw-odds__grade" role="cell">
                {l.grade === 'shard' ? (
                  <>✦ Divine Shard</>
                ) : (
                  <>
                    <Grade grade={l.grade} /> {GRADE_NAMES[l.grade]}
                  </>
                )}
              </span>
              <span class="tw-odds__bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, l.percent)}%` }} />
              </span>
              <b class="tw-odds__pct" role="cell">
                {pct(l.percent)}
              </b>
            </div>
          ))}
        </div>
        <p class="tw-modal-text tw-small" data-testid="cm-pity">
          Pity: {GRADE_NAMES[g1]} ({g1}) or better is certain within {left.one} more chest{left.one === 1 ? '' : 's'}, and {GRADE_NAMES[g2]} ({g2}) or better within {left.two}.
          {' '}Standard and Grand {chest.kind === 'gear' ? 'gear chests' : 'eggs'} share these counters{chest.tier === 'grand' ? '; a Grand counts as three' : ''}.
        </p>
        <p class="tw-modal-text tw-small tw-dim">{luckLine}</p>
        <p class="tw-modal-text tw-small tw-dim">
          {chest.kind === 'gear' ? 'A duplicate of gear you already own is turned into materials.' : 'A pet you already have gets a bond star instead (up to five).'} Gold only: nothing here is sold for money.
        </p>
      </>
    )
  }

  if (chest.kind === 'materialCrate') {
    const mat = ladderMaterial(c, crateLadder.value, gradeIndex(band))
    return (
      <>
        <p class="tw-modal-text">
          Always {crateUnits(chest)} {mat?.name ?? titleCase(crateLadder.value)} (your band’s {crateLadder.value} rung)
          {chest.tier === 'grand' ? ' and a rare monster part.' : `, and a rare monster part ${c.tuning.economy.chests.materialCrateRarePartChance}% of the time.`}
        </p>
        <p class="tw-modal-text tw-small tw-dim">A fixed amount, so there is no pity counter. Material promotes gear at the Blacksmith; choose the ladder above the chests.</p>
      </>
    )
  }

  if (chest.kind !== 'skillTome') {
    // A chest family this sheet does not describe yet.
    return <p class="tw-modal-text">{whatItGives(c, chest, band, hero)}.</p>
  }

  // The Skill Tome bag (08 §10.2): a tier by weight, then a skill from that tier's bag without replacement.
  const tiers = tomeTiers(c, chest)
  const weights = CHEST_RULES.tomeTierWeights[chest.tier as 'standard' | 'grand']
  const known = new Set(hero.skills.map((x) => x.skillId))
  const fresh = buildTomeBag(c, hero.classId, tiers, known)
  const kept = p.tomeBags[hero.classId]
  const rows: { tier: number; weight: number; left: number }[] = []
  for (let t = tiers.min; t <= tiers.max; t++) {
    const key = String(t)
    const freshIds = fresh[key] ?? []
    const given = kept?.[key]
    const left = given === undefined ? freshIds.length : given.filter((id) => freshIds.includes(id)).length
    rows.push({ tier: t, weight: weights[t - tiers.min] ?? 0, left })
  }
  return (
    <>
      <p class="tw-modal-text">One {className(c, hero.classId)} skill {hero.name} does not know yet. First a tier, then a tome from that tier's bag:</p>
      <div class="tw-odds" role="table" aria-label="Tier odds">
        {rows.map((r) => (
          <div key={r.tier} class="tw-odds__row" role="row">
            <span class="tw-odds__grade" role="cell">
              Tier {ROMAN[r.tier] ?? r.tier}
            </span>
            <span class="tw-odds__bar" aria-hidden="true">
              <i style={{ width: `${r.weight}%` }} />
            </span>
            <b class="tw-odds__pct" role="cell">
              {r.weight}% · {r.left} left
            </b>
          </div>
        ))}
      </div>
      <p class="tw-modal-text tw-small tw-dim">No repeats: a tome leaves the bag when drawn. An empty tier passes its chance up; when every bag is empty you get a Tome of Practice.</p>
    </>
  )
}
