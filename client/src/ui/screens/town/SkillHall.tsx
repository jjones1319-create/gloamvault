import { useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { insightHint } from '../../../../../sim/src/insight.ts'
import { learnSkill, skillHallOffers } from '../../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../../sim/src/types/content.ts'
import { act, content, profile } from '../../../game/session.ts'
import { Btn, Empty, Gold, Tabs } from '../../kit/kit.tsx'
import { navigate } from '../../router.ts'
import { skillState } from '../hero/progress.ts'
import { HeroPicker, PlacePage, canAfford, pickedHero } from './shared.tsx'

/**
 * The Skill Hall, Master Orrin (03 §7.4): the picked hero's class skills it does not know, one column per school (the
 * doc's "each school as a column"), a tab per tier. Tiers I–III are for sale — prices ramp +20% per purchase within a
 * tier (the sim's `skillPrice`), a tier opens with the hero's level. What the Hall never sells is shown with where it
 * comes from (Phase 7): Tier IV (Insight, Skill Tomes), the Ultimate (a Skill Tome), the monster techniques (watching
 * the monster) and Tier V (locked until the endgame). Each school says where its next Insight is likeliest (09 §2 q2).
 */

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

/** "Gravehollow Keep F7 · F8" — the hint's floors by dungeon. */
function floorsText(c: Content, floors: readonly { dungeonId: string; floor: number }[]): string {
  const byDungeon = new Map<string, number[]>()
  for (const f of floors) byDungeon.set(f.dungeonId, [...(byDungeon.get(f.dungeonId) ?? []), f.floor])
  return [...byDungeon.entries()].map(([d, fl]) => `${c.dungeons.get(d)?.name ?? d} ${fl.sort((a, b) => a - b).map((n) => `F${n}`).join(' · ')}`).join('; ')
}

function InsightLine({ c, hero, schoolId }: { c: Content; hero: HeroRecord; schoolId: string }) {
  const hint = insightHint(c, c.tuning, hero, schoolId)
  if (!hint) return <p class="tw-note tw-insight">Nothing left to Insight in this school.</p>
  return (
    <p class="tw-note tw-insight" data-testid={`sh-hint-${schoolId}`}>
      Next Insight: Tier {ROMAN[hint.tier] ?? hint.tier}, likeliest against level-{hint.level} monsters
      {hint.floors.length ? ` (${floorsText(c, hint.floors)})` : ' — deeper than any dungeon open yet'}.
    </p>
  )
}

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
  const offerIds = new Set(offers.map((o) => o.skillId))
  const known = new Set(hero.skills.map((k) => k.skillId))
  const classSkills = c.skillsByClass.get(hero.classId) ?? []
  // Not for sale: unknown skills the Hall never offers (techniques, the Ultimate, Tier IV and up).
  const notSold = classSkills.filter((s) => !known.has(s.id) && !offerIds.has(s.id))
  const tiers = [...new Set(classSkills.map((s) => s.tier))].sort((a, b) => a - b)
  const sellable = (t: number) => offers.some((o) => (c.skills.get(o.skillId)?.tier ?? 1) === t && !o.locked)
  // Open on the lowest tier with something learnable; else the first tier.
  const firstOpen = tiers.find(sellable) ?? tiers[0] ?? 1
  const tier = tierPick !== null && tiers.includes(tierPick) ? tierPick : firstOpen
  const opensAt = c.tuning.skills.tierOpensAtLevel as Record<string, number>
  const shown = offers.filter((o) => (c.skills.get(o.skillId)?.tier ?? 1) === tier)
  const shownNotSold = notSold.filter((s) => s.tier === tier)
  const schools = cls?.schools ?? []
  const highestSold = c.tuning.skills.skillHall.highestTierSold

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
      <Tabs
        tabs={tiers.map((t) => ({
          id: String(t),
          label: `Tier ${ROMAN[t] ?? t}${t > highestSold ? ' · not sold' : hero.level < (opensAt[String(t)] ?? 1) ? ` · level ${opensAt[String(t)]}` : ''}`,
        }))}
        value={String(tier)}
        onChange={(id) => setTierPick(Number(id))}
      />
      <div class="tw-schools">
        {schools.map((school) => {
          const list = shown.filter((o) => c.skills.get(o.skillId)?.school === school.id)
          const others = shownNotSold.filter((s) => s.school === school.id)
          return (
            <section key={school.id} class="tw-school">
              <h2 class="tw-school__name">{school.name}</h2>
              <p class="tw-school__how">{school.philosophy}</p>
              <InsightLine c={c} hero={hero} schoolId={school.id} />
              {list.length === 0 && others.length === 0 && <p class="tw-note">Nothing new at this tier.</p>}
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
              {others.map((s) => {
                const st = skillState(c, c.tuning, hero, s)
                return (
                  <article key={s.id} class={`tw-skill tw-skill--notsold ${!st.known && st.locked ? 'tw-skill--sealed' : ''}`} data-testid={`sh-notsold-${s.id}`}>
                    <div class="tw-skill__head">
                      <b class="tw-skill__name">{s.name}</b>
                      <span class={`tw-tag ${s.type === 'passive' ? 'tw-tag--passive' : ''}`}>{s.isUltimate ? 'Ultimate' : s.type === 'passive' ? 'Passive' : 'Active'}</span>
                    </div>
                    <p class="tw-skill__desc">{s.description}</p>
                    <div class="tw-skill__foot">
                      <span class="tw-lock">Not sold · {st.known ? 'known' : st.where}</span>
                    </div>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
      <p class="tw-note">
        Each skill bought within a tier raises that tier's next price by a fifth. Tier IV is never sold: it comes from Insight and Skill Tomes. A monster technique comes only from watching its monster use the move. Tier V waits for the endgame of later dungeons.
      </p>
    </PlacePage>
  )
}
