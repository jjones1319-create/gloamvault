import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import {
  GEAR_SLOTS,
  armoryCandidates,
  autoEquipBest,
  blockedSkills,
  contentSlotOf,
  itemScore,
  offHandPairScore,
  wearBlocker,
  wornIn,
  type Candidate,
  type GearSlot,
} from '../../../../../sim/src/armory.ts'
import type { Content } from '../../../../../sim/src/content.ts'
import { effectiveItemStats } from '../../../../../sim/src/items.ts'
import { equip, unequip, type Profile } from '../../../../../sim/src/town.ts'
import type { ClassDef, HeroRecord, ItemDef, ItemInstance } from '../../../../../sim/src/types/content.ts'
import { DERIVED_STATS, type DerivedStat } from '../../../../../sim/src/types/enums.ts'
import { act, profile, toast } from '../../../game/session.ts'
import { Btn, Chip, Empty, Grade, Modal, WearPips } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { route } from '../../router.ts'
import { seedItemShowcase } from './demo.ts'
import { ItemDetails } from './ItemDetails.tsx'
import { SLOT_NAME, STAT_NAME, itemKindText, itemSummary, signed } from './labels.ts'
import { heroAmmo } from '../../../../../sim/src/ammo.ts'

/** Gear (03 §6.1, §6.4): the eleven slots with grade, +N and wear pips; tap one to swap from the armory; Auto-equip best. */
export function GearTab({ c, p, hero, cls }: { c: Content; p: Profile; hero: HeroRecord; cls: ClassDef }) {
  const [open, setOpen] = useState<GearSlot | null>(null)
  // `&items=1` on a demo profile: the Phase 7 item showcase (hero/demo.ts).
  useEffect(() => {
    if (route.value.params.items === '1') seedItemShowcase(hero.id)
  }, [hero.id])
  const fitting = p.armory.filter((i) => {
    const def = c.items.get(i.itemId)
    return def !== undefined && def.slot !== null && def.slot !== 'pet' && wearBlocker(c, hero, def) === null
  }).length
  return (
    <>
      <div class="hr-gear">
        {GEAR_SLOTS.map((slot) => (
          <GearCell key={slot} c={c} hero={hero} cls={cls} slot={slot} onOpen={() => setOpen(slot)} />
        ))}
        <button
          class="hr-cell hr-cell--auto"
          data-testid="hr-autoequip"
          onClick={() => {
            buzz()
            autoEquip(hero.id)
          }}
        >
          <span class="hr-cell__top">
            <span class="hr-cell__name">Auto-equip best</span>
          </span>
          <span class="hr-cell__sub">
            {fitting} item{fitting === 1 ? '' : 's'} in the armory fit {hero.name}
          </span>
        </button>
      </div>
      {open && <GearModal c={c} p={p} hero={hero} cls={cls} slot={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function autoEquip(heroId: string): void {
  const before = profile.value?.heroes.find((h) => h.id === heroId)
  const ok = act((c, p) => autoEquipBest(c, p, heroId))
  const after = profile.value?.heroes.find((h) => h.id === heroId)
  if (!ok || !before || !after) return
  const changed = GEAR_SLOTS.filter((s) => wornIn(before, s)?.instanceId !== wornIn(after, s)?.instanceId).length
  toast(changed ? `Best gear on: ${changed} slot${changed === 1 ? '' : 's'} changed` : 'Already wearing the best', changed ? 'good' : 'info')
}

function GearCell({ c, hero, cls, slot, onOpen }: { c: Content; hero: HeroRecord; cls: ClassDef; slot: GearSlot; onOpen: () => void }) {
  const inst = wornIn(hero, slot)
  const def = inst ? c.items.get(inst.itemId) : undefined
  const s = inst && def ? effectiveItemStats(c, c.tuning, def, inst) : null
  return (
    <button
      class={`hr-cell ${def ? '' : 'hr-cell--empty'} ${s?.band === 'broken' ? 'hr-cell--broken' : ''}`}
      data-testid={`hr-slot-${slot}`}
      onClick={() => {
        buzz()
        onOpen()
      }}
    >
      <span class="hr-cell__top">
        <span class="hr-cell__name">{def ? def.name : 'Empty'}</span>
        {def && inst && (
          <>
            <Grade grade={def.grade} />
            <span class={`hr-plus ${inst.plusN > 0 ? 'hr-plus--on' : ''}`}>+{inst.plusN}</span>
            <WearPips durability={inst.durability} max={inst.maxDurability} />
          </>
        )}
      </span>
      <span class="hr-cell__sub">
        <span class="hr-cell__slot">{SLOT_NAME[slot]}</span>
        {def && s ? ` · ${itemSummary(c, def, s, cls.pool, 2)}` : ' · tap to choose'}
        {slot === 'mainHand' && <QuiverLine c={c} hero={hero} />}
      </span>
    </button>
  )
}

/** Arrows (08 §4, D-099): the quiver of the bow or crossbow in hand, amber at ammo.lowAt (pass D). */
function QuiverLine({ c, hero }: { c: Content; hero: HeroRecord }) {
  const ammo = heroAmmo(c, c.tuning, hero)
  if (!ammo) return null
  return (
    <span class={ammo.low ? 'hr-ammo hr-ammo--low' : 'hr-ammo'} data-testid="hr-quiver">
      {' '}
      · {ammo.name} {ammo.count} / {ammo.max}
    </span>
  )
}

/* ---------- the swap dialog ---------- */

type Lines = Partial<Record<DerivedStat, number>>

function linesOf(c: Content, def: ItemDef | undefined, inst: ItemInstance | null): Lines {
  if (!def || !inst) return {}
  const s = effectiveItemStats(c, c.tuning, def, inst)
  const out: Lines = { ...s.stats }
  for (const [k, v] of Object.entries(s.percentStats) as [DerivedStat, number][]) out[k] = (out[k] ?? 0) + v
  return out
}

/** What changes if the candidate replaces what is worn: [stat, difference] for every line that moves. */
function deltas(now: Lines, next: Lines): [DerivedStat, number][] {
  const out: [DerivedStat, number][] = []
  for (const stat of DERIVED_STATS) {
    const d = (next[stat] ?? 0) - (now[stat] ?? 0)
    if (d !== 0) out.push([stat, d])
  }
  return out
}

function GearModal({ c, p, hero, cls, slot, onClose }: { c: Content; p: Profile; hero: HeroRecord; cls: ClassDef; slot: GearSlot; onClose: () => void }) {
  const worn = wornIn(hero, slot)
  const wornDef = worn ? c.items.get(worn.itemId) : undefined
  const candidates = armoryCandidates(c, p, hero, slot)
  const others = p.armory.filter((i) => {
    const d = c.items.get(i.itemId)
    return d !== undefined && d.slot === contentSlotOf(slot) && wearBlocker(c, hero, d) !== null
  }).length
  const mainDef = hero.equipment.mainHand ? c.items.get(hero.equipment.mainHand.itemId) : undefined
  const handsFull = slot === 'offHand' && mainDef?.hands === 2
  const ringIndex: 0 | 1 = slot === 'ring1' ? 1 : 0
  const takeOff = () => {
    if (!worn || !wornDef) return
    if (act((_c, q) => unequip(q, hero.id, slot), `${wornDef.name} is back in the armory`)) onClose()
  }
  return (
    <Modal title={`${hero.name} · ${SLOT_NAME[slot]}`} onClose={onClose} testid="hr-gear-modal" actions={<Btn onClick={onClose}>Close</Btn>}>
      <div class="hr-modal-scroll">
        <h3 class="hr-modal__sub">Worn</h3>
        {worn && wornDef ? (
          <ItemRow c={c} cls={cls} def={wornDef} inst={worn} hero={hero}>
            <Btn testid={`hr-takeoff-${slot}`} onClick={takeOff}>
              Take off
            </Btn>
          </ItemRow>
        ) : (
          <Empty>Nothing worn here.</Empty>
        )}
        <h3 class="hr-modal__sub">From the armory</h3>
        {handsFull && <p class="hr-note">The {mainDef?.name} needs both hands: wear a one-handed weapon first.</p>}
        {candidates.length === 0 ? (
          <Empty>Nothing in the armory fits here yet{others ? ` (${others} for other classes)` : ''}. Chests and delves bring more.</Empty>
        ) : (
          <div class="list hr-cands">
            {candidates.map((cand) => (
              <CandidateRow
                key={cand.inst.instanceId}
                c={c}
                hero={hero}
                cls={cls}
                slot={slot}
                cand={cand}
                worn={worn}
                wornDef={wornDef}
                disabled={handsFull}
                onEquip={() => {
                  if (act((cc, q) => equip(cc, q, hero.id, cand.inst.instanceId, ringIndex), `${cand.def.name} on`)) onClose()
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** What a hero wears, for a set's count (items.ts setProgressOf). */
function wornBy(hero: HeroRecord): (ItemInstance | null)[] {
  const e = hero.equipment
  return [e.mainHand, e.offHand, e.helmet, e.chest, e.legs, e.boots, e.gloves, e.ring[0], e.ring[1], e.talisman, e.relic]
}

function ItemRow({ c, cls, def, inst, hero, children }: { c: Content; cls: ClassDef; def: ItemDef; inst: ItemInstance; hero: HeroRecord; children?: ComponentChildren }) {
  const s = effectiveItemStats(c, c.tuning, def, inst)
  return (
    <div class="list__row hr-item">
      <div class="list__main">
        <span class="hr-item__name">
          {def.name} <Grade grade={def.grade} /> <span class={`hr-plus ${inst.plusN > 0 ? 'hr-plus--on' : ''}`}>+{inst.plusN}</span> <WearPips durability={inst.durability} max={inst.maxDurability} />
        </span>
        <span class="list__sub">
          {itemKindText(def)} · {itemSummary(c, def, s, cls.pool, 4)}
        </span>
        <ItemDetails c={c} def={def} inst={inst} worn={wornBy(hero)} showActive={false} />
      </div>
      {children}
    </div>
  )
}

function CandidateRow({
  c,
  hero,
  cls,
  slot,
  cand,
  worn,
  wornDef,
  disabled,
  onEquip,
}: {
  c: Content
  hero: HeroRecord
  cls: ClassDef
  slot: GearSlot
  cand: Candidate
  worn: ItemInstance | null
  wornDef: ItemDef | undefined
  disabled: boolean
  onEquip: () => void
}) {
  const s = effectiveItemStats(c, c.tuning, cand.def, cand.inst)
  // The comparison: the candidate against what this slot holds (a two-hander also against the off hand it frees).
  const offInst = hero.equipment.offHand
  const offDef = offInst ? c.items.get(offInst.itemId) : undefined
  const freesOff = slot === 'mainHand' && cand.def.hands === 2 && offInst !== null && offDef !== undefined
  const nowLines = linesOf(c, wornDef, worn)
  if (freesOff) for (const [k, v] of Object.entries(linesOf(c, offDef, offInst)) as [DerivedStat, number][]) nowLines[k] = (nowLines[k] ?? 0) + v
  const moves = deltas(nowLines, linesOf(c, cand.def, cand.inst))
  const wornScore = (worn && wornDef ? itemScore(c, hero, wornDef, worn) : 0) + (freesOff && offInst && offDef ? offHandPairScore(c, hero, offDef, itemScore(c, hero, offDef, offInst)) : 0)
  // Skills these hands would stop (or start) carrying (09: a shield for Shield Slam, a bow for Aimed Shot).
  const curMain = hero.equipment.mainHand ? (c.items.get(hero.equipment.mainHand.itemId) ?? null) : null
  const curOff = offDef ?? null
  const nextMain = slot === 'mainHand' ? cand.def : curMain
  const nextOff = slot === 'offHand' ? cand.def : freesOff ? null : curOff
  const blockedNow = blockedSkills(c, hero, curMain, curOff)
  const blockedNext = blockedSkills(c, hero, nextMain, nextOff)
  const before = new Set(blockedNow.map((x) => x.id))
  const lost = blockedNext.filter((x) => !before.has(x.id))
  // The same order as Auto-equip best: the loadout's skills first, then the score.
  const verdict =
    blockedNext.length < blockedNow.length ? 'better' : blockedNext.length > blockedNow.length ? 'worse' : cand.score > wornScore ? 'better' : cand.score < wornScore ? 'worse' : 'same'
  return (
    <div class="list__row hr-item" data-testid={`hr-cand-${cand.inst.instanceId}`}>
      <div class="list__main">
        <span class="hr-item__name">
          {cand.def.name} <Grade grade={cand.def.grade} /> <span class={`hr-plus ${cand.inst.plusN > 0 ? 'hr-plus--on' : ''}`}>+{cand.inst.plusN}</span> <WearPips durability={cand.inst.durability} max={cand.inst.maxDurability} />{' '}
          <Chip tone={verdict === 'better' ? 'good' : verdict === 'worse' ? 'bad' : 'plain'}>{verdict === 'better' ? '▲ better' : verdict === 'worse' ? '▼ worse' : '= same'}</Chip>
        </span>
        <span class="list__sub">
          {itemKindText(cand.def)} · {itemSummary(c, cand.def, s, cls.pool, 4)}
        </span>
        <ItemDetails c={c} def={cand.def} inst={cand.inst} worn={wornBy(hero)} showActive={false} />
        {moves.length > 0 && (
          <span class="hr-moves">
            {moves.map(([stat, d]) => (
              <span key={stat} class={d > 0 ? 'hr-good' : 'hr-bad'}>
                {STAT_NAME[stat]} {signed(stat, d)}
              </span>
            ))}
          </span>
        )}
        {freesOff && offDef && <span class="hr-note">Takes both hands: the {offDef.name} goes back to the armory.</span>}
        {lost.length > 0 && <span class="hr-note hr-bad">{lost.map((x) => x.name).join(', ')} would stop working.</span>}
      </div>
      <Btn tone={verdict === 'better' ? 'primary' : 'plain'} testid={`hr-equip-${cand.inst.instanceId}`} disabled={disabled} onClick={onEquip}>
        Equip
      </Btn>
    </div>
  )
}
