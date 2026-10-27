import { useState } from 'preact/hooks'
import { learnSkill, skillHallOffers } from '../../../../../sim/src/town.ts'
import { act, content, profile } from '../../../game/session.ts'
import { Btn, Empty, Gold, Tabs } from '../../kit/kit.tsx'
import { navigate } from '../../router.ts'
import { HeroPicker, PlacePage, canAfford, pickedHero } from './shared.tsx'

/**
 * The Skill Hall, Master Orrin (03 §7.4): the picked hero's class skills of Tiers I–III it does not know, one column
 * per school (the doc's "each school as a column"), a tab per tier. Prices ramp +20% per purchase within a tier
 * (the sim's `skillPrice`); a tier opens with the hero's level.
 */

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

export function SkillHall() {
  const c = content.value!
  const p = profile.value!
  const hero = pickedHero(p)
  const [tierPick, setTierPick] = useState<number | null>(null)
  if (!hero) {
    return (
      <PlacePage id="skills">
        <Empty>Make a hero first.</Empty>
      </PlacePage>
    )
  }
  const cls = c.classes.get(hero.classId)
  const offers = skillHallOffers(c, p, hero.id)
  const tiers = [...new Set(offers.map((o) => c.skills.get(o.skillId)?.tier ?? 1))].sort((a, b) => a - b)
  // Open on the lowest tier with something learnable; else the first tier.
  const firstOpen = tiers.find((t) => offers.some((o) => (c.skills.get(o.skillId)?.tier ?? 1) === t && !o.locked)) ?? tiers[0] ?? 1
  const tier = tierPick !== null && tiers.includes(tierPick) ? tierPick : firstOpen
  const opensAt = c.tuning.skills.tierOpensAtLevel as Record<string, number>
  const shown = offers.filter((o) => (c.skills.get(o.skillId)?.tier ?? 1) === tier)
  const schools = cls?.schools ?? []

  return (
    <PlacePage
      id="skills"
      right={
        <Btn tone="quiet" class="tw-link" onClick={() => navigate('hero', { hero: hero.id, tab: 'skills' })}>
          Loadout ›
        </Btn>
      }
    >
      <HeroPicker c={c} label="Teaching" />
      {offers.length === 0 ? (
        <Empty>{hero.name} already knows every skill the Hall teaches. Tier IV comes only from the tower.</Empty>
      ) : (
        <>
          <Tabs
            tabs={tiers.map((t) => ({
              id: String(t),
              label: `Tier ${ROMAN[t] ?? t}${hero.level < (opensAt[String(t)] ?? 1) ? ` · level ${opensAt[String(t)]}` : ''}`,
            }))}
            value={String(tier)}
            onChange={(id) => setTierPick(Number(id))}
          />
          <div class="tw-schools">
            {schools.map((school) => {
              const list = shown.filter((o) => c.skills.get(o.skillId)?.school === school.id)
              return (
                <section key={school.id} class="tw-school">
                  <h2 class="tw-school__name">{school.name}</h2>
                  <p class="tw-school__how">{school.philosophy}</p>
                  {list.length === 0 && <p class="tw-note">Nothing new at this tier.</p>}
                  {list.map((o) => {
                    const s = c.skills.get(o.skillId)!
                    const afford = canAfford(p, o.price)
                    return (
                      <article key={o.skillId} class={`tw-skill ${o.locked ? 'tw-skill--locked' : ''}`}>
                        <div class="tw-skill__head">
                          <b class="tw-skill__name">{s.name}</b>
                          <span class={`tw-tag ${s.type === 'passive' ? 'tw-tag--passive' : ''}`}>{s.type === 'passive' ? 'Passive' : 'Active'}</span>
                        </div>
                        <p class="tw-skill__desc">{s.description}</p>
                        <div class="tw-skill__foot">
                          {o.locked ? (
                            <span class="tw-lock">{o.locked}</span>
                          ) : (
                            <>
                              <Gold amount={o.price} />
                              <Btn
                                tone="primary"
                                class="tw-btn44"
                                testid={`sh-learn-${o.skillId}`}
                                disabled={!afford}
                                title={afford ? `Learn ${s.name}` : 'Not enough gold'}
                                onClick={() => act((cc, pp) => learnSkill(cc, pp, hero.id, o.skillId), `${hero.name} learns ${s.name}. Slot it on the Skills tab.`)}
                              >
                                Learn
                              </Btn>
                            </>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </section>
              )
            })}
          </div>
          <p class="tw-note">Each skill bought within a tier raises that tier's next price by a fifth. Tier IV is never sold.</p>
        </>
      )}
    </PlacePage>
  )
}
