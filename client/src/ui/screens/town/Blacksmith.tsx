import { useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { sellPrice } from '../../../../../sim/src/economy.ts'
import { canPromote, plusNUpgrade, salvage } from '../../../../../sim/src/items.ts'
import { stoneItemFor } from '../../../../../sim/src/loot.ts'
import { itemValue, tomeName, tomeSkill } from '../../../../../sim/src/tomes.ts'
import { equippedItems, promoteItem, repairAll, repairAllQuote, salvageItem, sellItem, townR, upgradePlusN, type Profile } from '../../../../../sim/src/town.ts'
import type { HeroRecord, ItemDef, ItemInstance } from '../../../../../sim/src/types/content.ts'
import { act, content, profile } from '../../../game/session.ts'
import { Btn, Empty, Gold, Grade, Modal, Section, WearPips } from '../../kit/kit.tsx'
import { ItemDetails } from '../hero/ItemDetails.tsx'
import { GRADE_NAMES, HeroPicker, PlacePage, SLOT_NAMES, canAfford, ladderMaterial, materialName, pickedHero } from './shared.tsx'

/**
 * The Blacksmith, Hesper Vane (03 §6.4–§6.5; 08 §8–§9): Repair all for the picked hero, +N with gold and stones and
 * promotion up the material ladder on what the hero wears, and the armory's Sell and Salvage. Every price comes from
 * the sim's quote functions, so what the button says is what the action costs.
 */

function haggling(h: HeroRecord | null): number {
  return h?.fieldSkills.haggling?.rank ?? 0
}

/** The +N line: "+1: 3 gold · 1 Whetstone · you have 0", or why not. */
function plusQuote(c: Content, p: Profile, def: ItemDef, inst: ItemInstance) {
  const up = plusNUpgrade(c.tuning, def, inst)
  if (!up) return { ok: false, text: `At its +N cap (+${def.maxPlusN})`, label: `+${inst.plusN}` }
  const stone = stoneItemFor(c, c.tuning, def.grade)
  const stoneId = stone?.id ?? 'whetstone'
  const have = p.materials[stoneId] ?? 0
  const stones = `${up.stones} ${stone?.name ?? 'stone'}${up.stones === 1 ? '' : 's'}`
  const gold = canAfford(p, up.gold)
  const ok = have >= up.stones && gold
  const why = have < up.stones ? ` (you have ${have})` : !gold ? ' · not enough gold' : ''
  return { ok, text: `+${up.inst.plusN}: ${up.gold} gold · ${stones}${why}`, label: `+${up.inst.plusN}` }
}

/** The promotion line: target, material needed/owned, gold — or the reason it cannot happen. */
function promoteQuote(c: Content, p: Profile, def: ItemDef, inst: ItemInstance) {
  const q = canPromote(c, c.tuning, def, inst, new Map(Object.entries(p.materials)))
  const target = q.targetItemId ? c.items.get(q.targetItemId) : undefined
  if (!target) {
    const why = q.reason === 'no material ladder' ? 'cannot be promoted' : q.reason === 'at the top of the ladder' ? 'at the top grade' : 'no higher grade yet'
    return { ok: false, text: `Promotion: ${why}` }
  }
  const mats = q.materialIds.map((id) => materialName(c, id)).join(' or ') || 'material'
  const gold = canAfford(p, q.gold)
  const refund = q.stoneRefund > 0 ? ` · ${q.stoneRefund} stones back` : ''
  const why = q.ok && !gold ? ' · not enough gold' : ''
  return { ok: q.ok && gold, text: `Promote → ${target.name} (${target.grade}): ${q.units} ${mats} (have ${q.unitsOwned}) · ${q.gold} gold${refund}${why}` }
}

type Confirm = { kind: 'sell' | 'salvage'; inst: ItemInstance; def: ItemDef } | null

export function Blacksmith() {
  const c = content.value!
  const p = profile.value!
  const hero = pickedHero(p)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const quote = hero ? repairAllQuote(c, p, hero.id) : { gold: 0, points: 0, ammo: null }
  // D-099: Repair all refills the quiver too (the arrows or bolts the hand draws, at their own price).
  const refill = quote.ammo
  const toMend = quote.points > 0 || refill !== null
  const worn = hero ? equippedItems(hero) : []
  const haggle = haggling(hero)
  // Chest keys are counted in the materials too (07 §7); they belong to the Curio Merchant, not the forge.
  const owned = Object.entries(p.materials).filter(([id, n]) => n > 0 && c.items.get(id)?.kind !== 'key')

  // A Skill Tome sells by its skill's tier (08 §4; tomes.ts itemValue), as the sim's sellItem does.
  const sellFor = (def: ItemDef, inst: ItemInstance) => sellPrice(c.tuning, tomeSkill(c, inst) ? itemValue(c, inst, townR(p)) : def.value, haggle) * Math.max(1, inst.quantity)
  const salvageInto = (def: ItemDef, inst: ItemInstance) => {
    const r = salvage(c.tuning, def, inst)
    const mat = ladderMaterial(c, r.materialLadder, r.materialRung)
    return mat && r.units > 0 ? { units: r.units, mat } : null
  }

  return (
    <PlacePage id="blacksmith">
      <HeroPicker c={c} label="Working on" />
      <div class="split split--wide-left">
        <Section title={hero ? `${hero.name} wears` : 'Worn'}>
          <div class="tw-repair">
            <Btn
              tone="primary"
              testid="bs-repair-all"
              disabled={!hero || !toMend || !canAfford(p, quote.gold)}
              onClick={() => hero && act((cc, pp) => repairAll(cc, pp, hero.id), `${hero.name}'s gear is mended`)}
            >
              Repair all
              {toMend && <Gold amount={quote.gold} />}
            </Btn>
            <span class="tw-note" data-testid="bs-repair-note">
              {!toMend
                ? 'Everything is in good repair, and the quiver is full.'
                : !canAfford(p, quote.gold)
                  ? 'Not enough gold for the whole bill.'
                  : [quote.points > 0 ? `${quote.points} points of wear to mend` : '', refill ? `${refill.missing} ${c.items.get(refill.itemId)?.name.toLowerCase() ?? 'arrows'} to refill` : ''].filter(Boolean).join('; ') + '.'}
            </span>
          </div>
          {worn.length === 0 ? (
            <Empty>Nothing equipped.</Empty>
          ) : (
            <div class="list">
              {worn.map((inst) => {
                const def = c.items.get(inst.itemId)
                if (!def) return null
                const plus = plusQuote(c, p, def, inst)
                const promo = promoteQuote(c, p, def, inst)
                return (
                  <div key={inst.instanceId} class="list__row tw-item">
                    <div class="list__main">
                      <span class="tw-item__name">
                        <Grade grade={def.grade} /> {def.name}
                        {inst.plusN > 0 && <b class="tw-plus"> +{inst.plusN}</b>}
                      </span>
                      <span class="list__sub">
                        <WearPips durability={inst.durability} max={inst.maxDurability} /> {inst.durability <= 0 ? 'Broken' : `${inst.durability}%`}{inst.maxDurability < 100 ? ` of ${inst.maxDurability}` : ''} · {SLOT_NAMES[def.slot ?? ''] ?? def.kind}
                      </span>
                      <span class="list__sub">{plus.text}</span>
                      <span class="list__sub">{promo.text}</span>
                      <ItemDetails c={c} def={def} inst={inst} worn={worn} />
                    </div>
                    <div class="tw-item__actions">
                      <Btn
                        testid={`bs-plus-${inst.instanceId}`}
                        class="tw-btn44"
                        disabled={!plus.ok}
                        title={plus.text}
                        onClick={() => hero && act((cc, pp) => upgradePlusN(cc, pp, hero.id, inst.instanceId), `${def.name} is now ${plus.label}`)}
                      >
                        {plus.label}
                      </Btn>
                      <Btn
                        testid={`bs-promote-${inst.instanceId}`}
                        class="tw-btn44"
                        disabled={!promo.ok}
                        title={promo.text}
                        onClick={() => hero && act((cc, pp) => promoteItem(cc, pp, hero.id, inst.instanceId), `${def.name} is promoted`)}
                      >
                        Promote
                      </Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <div>
          <Section title="Materials and stones">
            {owned.length === 0 ? (
              <Empty>None yet: monsters drop parts, bosses drop stones.</Empty>
            ) : (
              <div class="tw-chips">
                {owned.map(([id, n]) => (
                  <span key={id} class="tw-mat">
                    {materialName(c, id)} <b>×{n}</b>
                  </span>
                ))}
              </div>
            )}
          </Section>
          <Section title={`Armory (${p.armory.length})`}>
            {p.armory.length === 0 ? (
              <Empty>The armory is empty. Gear found in the tower lands here.</Empty>
            ) : (
              <div class="list">
                {p.armory.map((inst) => {
                  const def = c.items.get(inst.itemId)
                  if (!def) return null
                  const into = salvageInto(def, inst)
                  return (
                    <div key={inst.instanceId} class="list__row tw-item">
                      <div class="list__main">
                        <span class="tw-item__name">
                          {tomeSkill(c, inst) ? '📖' : <Grade grade={def.grade} />} {tomeSkill(c, inst) ? tomeName(c, inst) : def.name}
                          {inst.plusN > 0 && <b class="tw-plus"> +{inst.plusN}</b>}
                          {inst.quantity > 1 && <span class="tw-dim"> ×{inst.quantity}</span>}
                        </span>
                        <span class="list__sub">
                          {tomeSkill(c, inst)
                            ? `Tier ${['', 'I', 'II', 'III', 'IV', 'V'][tomeSkill(c, inst)!.tier] ?? tomeSkill(c, inst)!.tier} · a ${c.classes.get(tomeSkill(c, inst)!.classId)?.name ?? 'hero'} reads it on the Skills tab · sells for ${sellFor(def, inst)}`
                            : `${GRADE_NAMES[def.grade]} ${(SLOT_NAMES[def.slot ?? ''] ?? def.kind).toLowerCase()} · sells for ${sellFor(def, inst)} · ${into ? `salvages to ${into.units} ${into.mat.name}` : 'no salvage'}`}
                        </span>
                      </div>
                      <div class="tw-item__actions">
                        <Btn class="tw-btn44" testid={`bs-sell-${inst.instanceId}`} onClick={() => setConfirm({ kind: 'sell', inst, def })}>
                          Sell
                        </Btn>
                        <Btn class="tw-btn44" testid={`bs-salvage-${inst.instanceId}`} disabled={!into} onClick={() => setConfirm({ kind: 'salvage', inst, def })}>
                          Salvage
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

      {confirm && (
        <Modal
          title={confirm.kind === 'sell' ? `Sell ${confirm.def.name}?` : `Salvage ${confirm.def.name}?`}
          onClose={() => setConfirm(null)}
          testid="bs-confirm"
          actions={
            <>
              <Btn onClick={() => setConfirm(null)}>Keep it</Btn>
              <Btn
                tone="primary"
                testid="bs-confirm-yes"
                onClick={() => {
                  const { kind, inst, def } = confirm
                  setConfirm(null)
                  if (kind === 'sell') {
                    act((cc, pp) => sellItem(cc, pp, inst.instanceId, haggle), `Sold ${def.name} for ${sellFor(def, inst)} gold`)
                  } else {
                    const into = salvageInto(def, inst)
                    act((cc, pp) => salvageItem(cc, pp, inst.instanceId), into ? `${def.name} became ${into.units} ${into.mat.name}` : `${def.name} was broken down`)
                  }
                }}
              >
                {confirm.kind === 'sell' ? (
                  <>
                    Sell <Gold amount={sellFor(confirm.def, confirm.inst)} />
                  </>
                ) : (
                  'Salvage'
                )}
              </Btn>
            </>
          }
        >
          <p class="tw-modal-text">{confirmText(confirm, sellFor(confirm.def, confirm.inst), salvageInto(confirm.def, confirm.inst), haggle > 0 ? hero : null)}</p>
        </Modal>
      )}
    </PlacePage>
  )
}

function confirmText(confirm: NonNullable<Confirm>, price: number, into: { units: number; mat: ItemDef } | null, haggler: HeroRecord | null): string {
  if (confirm.kind === 'sell') return `It leaves the armory for ${price} gold${haggler ? ` (${haggler.name}'s Haggling helps)` : ''}.`
  return into ? `It is broken down into ${into.units} ${into.mat.name}, the material that promotes gear of its kind.` : 'It breaks down into nothing useful.'
}
