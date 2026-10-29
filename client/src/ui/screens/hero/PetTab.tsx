import type { Content } from '../../../../../sim/src/content.ts'
import { petLevelCost } from '../../../../../sim/src/progress.ts'
import { hatchEgg, setPetStance, swapPet, type Profile } from '../../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../../sim/src/types/content.ts'
import { STANCES } from '../../../../../sim/src/types/enums.ts'
import { act } from '../../../game/session.ts'
import { Btn, Empty, Grade, Meter, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { STANCE_NAME, stanceLine } from './labels.ts'
import { petActives } from './progress.ts'
import { TraitRank } from '../town/Stables.tsx'

/** Pet (03 §9): the hero's pet, its stance, the stables (swap) and the eggs (hatch). */
export function PetTab({ c, p, hero }: { c: Content; p: Profile; hero: HeroRecord }) {
  const t = c.tuning
  const pet = hero.petInstance
  const def = pet ? c.pets.get(pet.petId) : undefined
  const starMax = t.economy.dupes.bondStarMax
  return (
    <div class="hr-pet">
      <div class="hr-col">
        <Section title="Pet">
          {pet && def ? (
            <div class="hr-petcard" data-testid="hr-pet">
              <p class="hr-petcard__name">
                {pet.name} <Grade grade={pet.grade} />
              </p>
              <p class="hr-petcard__line">
                {pet.name === def.name ? '' : `${def.name} · `}Lv {pet.level} ·{' '}
                <span class="hr-stars" title={`Bond stars: ${pet.bondStars} of ${starMax}`}>
                  {'★'.repeat(pet.bondStars)}
                  <span class="hr-stars__off">{'★'.repeat(Math.max(0, starMax - pet.bondStars))}</span>
                </span>
              </p>
              {pet.level < hero.level ? <Meter compact tone="xp" value={pet.xp} max={petLevelCost(pet.level + 1)} label="Pet XP" /> : <p class="hr-petcard__line hr-dim">Level with {hero.name}: grows when {hero.name} does.</p>}
              <p class="hr-petcard__line">
                <b>{def.trait.name}</b>. {def.trait.description}
              </p>
              {/* 03 §9: the trait grows by use — its rank and the way to the next (pass D). */}
              <p class="hr-petcard__line">
                <TraitRank c={c} pet={pet} />
              </p>
              <ul class="hr-petcard__actives">
                {petActives(c, t, def, pet).map((a) => (
                  <li key={a.skillId} class={a.state === 'ready' ? '' : 'hr-dim'} title={a.description}>
                    <b>{a.name}</b> · {a.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty>No pet with {hero.name}. Hatch an egg or take one from the stables.</Empty>
          )}
        </Section>
      </div>
      <div class="hr-col">
        <Section title="Stance">
          <div class="hr-stances">
            {STANCES.map((s) => (
              <button
                key={s}
                class={`hr-stance ${pet?.stance === s ? 'hr-stance--on' : ''}`}
                data-testid={`hr-stance-${s}`}
                disabled={!pet}
                aria-pressed={pet?.stance === s}
                onClick={() => {
                  buzz()
                  if (pet && pet.stance !== s) act((_c, q) => setPetStance(q, hero.id, s), `${pet.name}: ${STANCE_NAME[s]}`)
                }}
              >
                <span class="hr-stance__name">{STANCE_NAME[s]}</span>
                <span class="hr-stance__line">{stanceLine(t, s)}</span>
              </button>
            ))}
          </div>
          <p class="hr-note">You can also change it once per fight, for free.</p>
        </Section>
      </div>
      <div class="hr-col">
        <Section title={`Stables (${p.stables.length})`}>
          {p.stables.length === 0 ? (
            <Empty>No other pets yet.</Empty>
          ) : (
            <div class="list">
              {p.stables.map((sp, i) => {
                const sd = c.pets.get(sp.petId)
                return (
                  <div key={`${sp.petId}-${i}`} class="list__row">
                    <span class="list__main">
                      {sp.name} <Grade grade={sp.grade} />
                      <span class="list__sub">
                        {sd?.name ?? sp.petId} · Lv {sp.level} · leans {STANCE_NAME[sp.stance]}
                      </span>
                    </span>
                    <Btn testid={`hr-swap-${i}`} onClick={() => act((_c, q) => swapPet(q, hero.id, i), `${sp.name} goes with ${hero.name}`)}>
                      Swap
                    </Btn>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
        <Section title={`Eggs (${p.eggs.length})`}>
          {p.eggs.length === 0 ? (
            <Empty>No eggs. The Curio Merchant sells Pet Egg chests.</Empty>
          ) : (
            <div class="list">
              {p.eggs.map((egg, i) => {
                const ed = c.pets.get(egg.petId)
                return (
                  <div key={`${egg.petId}-${i}`} class="list__row">
                    <span class="list__main">
                      {ed?.name ?? egg.petId} egg <Grade grade={egg.grade} />
                      <span class="list__sub">{pet ? `Hatches for ${hero.name}; ${pet.name} goes to the stables` : `Hatches for ${hero.name}`}</span>
                    </span>
                    <Btn tone="primary" testid={`hr-hatch-${i}`} onClick={() => act((cc, q) => hatchEgg(cc, q, i, hero.id), `The egg hatched: ${ed?.name ?? 'a pet'}!`)}>
                      Hatch
                    </Btn>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
