import { useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { petTraitProgress } from '../../../../../sim/src/pets.ts'
import { hatchEgg, livingHeroes, setPetStance, swapPet } from '../../../../../sim/src/town.ts'
import type { PetInstance } from '../../../../../sim/src/types/content.ts'
import { STANCES, type Stance } from '../../../../../sim/src/types/enums.ts'
import { act, content, profile } from '../../../game/session.ts'
import { Btn, Empty, Grade, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { HeroPicker, PlacePage, pickedHero } from './shared.tsx'

/**
 * The Stables, Tomas Reed (03 §9): each living hero's pet and its stance, the eggs from chests (hatched for the picked hero,
 * with a name), and the pets resting in the stables (given back to the picked hero; theirs comes here).
 */

const STANCE_INFO: Record<Stance, { name: string; hint: string }> = {
  fierce: { name: 'Fierce', hint: 'attacks its hero’s target' },
  guard: { name: 'Guard', hint: 'takes some of the hits meant for its hero' },
  mend: { name: 'Mend', hint: 'heals the most hurt ally a little' },
  forage: { name: 'Forage', hint: 'no attacks; finds traps, treasure and gold' },
}

function Stars({ n, max }: { n: number; max: number }) {
  return (
    <span class="tw-stars" aria-label={`${n} of ${max} bond stars`} title="Bond stars: +5% pet stats each">
      {'★'.repeat(Math.max(0, n))}
      <span class="tw-stars__off">{'★'.repeat(Math.max(0, max - n))}</span>
    </span>
  )
}

/** How a trait grows (03 §9; tuning pets.traitGrowth.sources): the words for the source its growsBy tag maps to. */
const GROWS_BY: Readonly<Record<string, string>> = {
  finds: 'grows as the party finds traps, secret doors and unwary monsters',
  hitsLanded: 'grows with every hit it lands',
  hitsTaken: 'grows with every hit it takes',
  actions: 'grows with every turn it fights',
}

/** The trait's rank and its way to the next (03 §9: traits grow by use). */
export function TraitRank({ c, pet }: { c: Content; pet: PetInstance }) {
  const def = c.pets.get(pet.petId)
  if (!def) return null
  const pr = petTraitProgress(c.tuning, pet)
  const source = (c.tuning.pets.traitGrowth.sources as Readonly<Record<string, string>>)[def.trait.growsBy] ?? ''
  const pct = pr.next === null ? 100 : Math.round(((pr.xp - pr.from) * 100) / Math.max(1, pr.next - pr.from))
  return (
    <span class="tw-trait" data-testid={`st-trait-${pet.petId}`} title={GROWS_BY[source] ?? ''}>
      <b>Trait rank {pr.rank}</b>
      <span class="tw-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, pct))}>
        <span class="tw-progress__fill" style={{ display: 'block', width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </span>
      <span>{pr.next === null ? 'mastered' : `${pr.xp} / ${pr.next} to rank ${pr.rank + 1}`}</span>
    </span>
  )
}

function PetLine({ c, pet }: { c: Content; pet: PetInstance }) {
  const def = c.pets.get(pet.petId)
  const max = c.tuning.economy.dupes.bondStarMax
  return (
    <>
      <span class="tw-item__name">
        <Grade grade={pet.grade} /> <b>{pet.name}</b>
        {def && pet.name !== def.name && <span class="tw-dim"> · {def.name}</span>}
        <span class="tw-dim"> · Lv {pet.level}</span> <Stars n={pet.bondStars} max={max} />
      </span>
      {def && (
        <span class="list__sub">
          {def.trait.name}: {def.trait.description}
        </span>
      )}
      <TraitRank c={c} pet={pet} />
    </>
  )
}

export function Stables() {
  const c = content.value!
  const p = profile.value!
  const hero = pickedHero(p)
  const [names, setNames] = useState<Record<number, string>>({})

  return (
    <PlacePage id="stables">
      <HeroPicker c={c} label="For" />
      <div class="split">
        <Section title="With the heroes">
          <div class="list">
            {livingHeroes(p).map((h) =>
              h.petInstance ? (
                <div key={h.id} class="list__row tw-pet">
                  <div class="list__main">
                    <span class="tw-pet__owner">{h.name}’s pet</span>
                    <PetLine c={c} pet={h.petInstance} />
                    <div class="tw-row-buttons tw-stance" role="radiogroup" aria-label={`${h.petInstance.name}'s stance`}>
                      {STANCES.map((s) => (
                        <button
                          key={s}
                          role="radio"
                          aria-checked={h.petInstance?.stance === s}
                          class={`tw-seg ${h.petInstance?.stance === s ? 'tw-seg--on' : ''}`}
                          data-testid={`st-stance-${h.id}-${s}`}
                          onClick={() => {
                            if (h.petInstance?.stance === s) return
                            buzz()
                            act((_c, pp) => setPetStance(pp, h.id, s), `${h.petInstance?.name ?? 'The pet'}: ${STANCE_INFO[s].name}`)
                          }}
                        >
                          {STANCE_INFO[s].name}
                        </button>
                      ))}
                    </div>
                    <span class="list__sub">
                      {STANCE_INFO[h.petInstance.stance].name}: {STANCE_INFO[h.petInstance.stance].hint}.
                    </span>
                  </div>
                </div>
              ) : (
                <div key={h.id} class="list__row">
                  <div class="list__main">
                    <b>{h.name}</b>
                    <span class="list__sub">No pet yet: hatch an egg below.</span>
                  </div>
                </div>
              ),
            )}
          </div>
        </Section>

        <div>
          <Section title={`Eggs (${p.eggs.length})`}>
            {p.eggs.length === 0 ? (
              <Empty>No eggs. Pet Egg chests at the Curio Merchant hold them.</Empty>
            ) : (
              <div class="list">
                {p.eggs.map((egg, i) => {
                  const def = c.pets.get(egg.petId)
                  const name = names[i] ?? def?.name ?? 'Pet'
                  return (
                    <div key={`${egg.petId}-${i}`} class="list__row tw-egg">
                      <div class="list__main">
                        <span class="tw-item__name">
                          <Grade grade={egg.grade} /> <b>{def?.name ?? egg.petId} egg</b>
                        </span>
                        {def && (
                          <span class="list__sub">
                            {def.trait.name}: {def.trait.description}
                          </span>
                        )}
                        <label class="tw-namefield">
                          <span class="tw-dim">Name</span>
                          <input
                            class="tw-input"
                            type="text"
                            maxLength={20}
                            value={name}
                            data-testid={`st-name-${i}`}
                            onInput={(e) => {
                              const v = e.currentTarget.value
                              setNames((n) => ({ ...n, [i]: v }))
                            }}
                          />
                        </label>
                      </div>
                      <Btn
                        tone="primary"
                        class="tw-btn44"
                        testid={`st-hatch-${i}`}
                        disabled={!hero}
                        onClick={() => {
                          if (!hero) return
                          const petName = (names[i] ?? '').trim() || def?.name
                          if (act((cc, pp) => hatchEgg(cc, pp, i, hero.id, petName), `${petName ?? 'The pet'} hatched for ${hero.name}`)) setNames({})
                        }}
                      >
                        Hatch for {hero?.name ?? '…'}
                      </Btn>
                    </div>
                  )
                })}
              </div>
            )}
            {hero?.petInstance && p.eggs.length > 0 && <p class="tw-note">{hero.name}’s {hero.petInstance.name} will rest in the stables.</p>}
          </Section>

          <Section title={`In the stables (${p.stables.length})`}>
            {p.stables.length === 0 ? (
              <Empty>No pets resting here.</Empty>
            ) : (
              <div class="list">
                {p.stables.map((pet, i) => (
                  <div key={`${pet.petId}-${i}`} class="list__row tw-pet">
                    <div class="list__main">
                      <PetLine c={c} pet={pet} />
                    </div>
                    <Btn class="tw-btn44" testid={`st-swap-${i}`} disabled={!hero} onClick={() => hero && act((_c, pp) => swapPet(pp, hero.id, i), `${pet.name} goes with ${hero.name}`)}>
                      Give to {hero?.name ?? '…'}
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </PlacePage>
  )
}
