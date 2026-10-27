import { useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { canChooseHero, heroOf, layToRest, livingHeroes, passLegacy, raiseAtShrine, shrineFee, type Profile } from '../../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../../sim/src/types/content.ts'
import { heroLevelForXp } from '../../../../../sim/src/xp.ts'
import { act, content, profile } from '../../../game/session.ts'
import { Btn, Empty, Gold, Grade, Modal, Section } from '../../kit/kit.tsx'
import { navigate } from '../../router.ts'
import { PlacePage, canAfford, className, heroKind, wayfarerGrade } from './shared.tsx'
import { deathRuleLine, fellWhere, levelAfterRaise, memorialLine } from './text.ts'

/**
 * The Ember Shrine, Mother Cendra (D-088–D-090): the dead the party carried home lie here until they are raised (gold
 * and two levels) or laid to rest (gone for good, leaving a legacy of half their battle XP); the legacies wait for an
 * heir; the Memorial keeps the names of everyone lost.
 */

type Ask = { kind: 'raise' | 'rest'; heroId: string } | null

/** The battle XP a hero laid to rest leaves (D-090), as the sim's `loseHero` reckons it. */
function legacyXp(c: Content, hero: HeroRecord): number {
  return Math.floor((hero.battleXp * c.tuning.death.legacy.percent) / 100)
}

export function Shrine() {
  const c = content.value!
  const p = profile.value!
  const [ask, setAsk] = useState<Ask>(null)
  const living = livingHeroes(p)
  const loss = c.tuning.death.shrine.levelLoss
  const canChoose = canChooseHero(c, p)

  return (
    <PlacePage id="shrine">
      <p class="tw-rule-line" data-testid="shrine-rule">
        <span class="tw-dim">This save is</span> {deathRuleLine(p.deathRule)}
      </p>
      <div class="split">
        <Section title={`The dead (${p.dead.length})`}>
          {p.dead.length === 0 ? (
            <Empty>No one lies here. Mother Cendra hopes it stays that way.</Empty>
          ) : (
            <div class="list">
              {p.dead.map((d) => {
                const h = p.heroes.find((x) => x.id === d.heroId)
                if (!h) return null
                const fee = shrineFee(c, p, h.id)
                const afford = canAfford(p, fee)
                const grade = wayfarerGrade(c, p, h.id)
                return (
                  <div key={h.id} class="list__row tw-dead" data-testid={`shrine-dead-${h.id}`}>
                    <div class="list__main">
                      <span class="tw-item__name">
                        <b>{h.name}</b>
                        {p.chosenId === h.id && <span class="tw-pill tw-pill--chosen">Chosen</span>}
                        {grade && (
                          <span class="tw-pill">
                            Wayfarer <Grade grade={grade} />
                          </span>
                        )}
                      </span>
                      <span class="list__sub">
                        {heroKind(c, h)} · level {h.level} · fell on {fellWhere(c, d.dungeonId, d.floor)}
                      </span>
                      <span class="list__sub">
                        Raising costs {fee} gold and {loss} levels: L{h.level} → L{levelAfterRaise(h.level, loss)}
                        {afford ? '.' : ' · not enough gold.'}
                      </span>
                      <div class="tw-row-buttons tw-dead__actions">
                        <Btn tone="primary" class="tw-btn44" testid={`shrine-raise-${h.id}`} disabled={!afford} onClick={() => setAsk({ kind: 'raise', heroId: h.id })}>
                          Raise <Gold amount={fee} />
                        </Btn>
                        <Btn class="tw-btn44" testid={`shrine-rest-${h.id}`} onClick={() => setAsk({ kind: 'rest', heroId: h.id })}>
                          Lay to rest
                        </Btn>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <div>
          <Section title={`Legacies (${p.legacies.length})`}>
            {p.legacies.length === 0 ? (
              <Empty>No legacy waits for an heir.</Empty>
            ) : (
              <div class="list">
                {p.legacies.map((l) => (
                  <div key={l.id} class="list__row tw-legacy" data-testid={`shrine-legacy-${l.id}`}>
                    <div class="list__main">
                      <span class="tw-item__name">
                        <span>
                          <b>{l.name}</b>’s legacy
                        </span>
                        <span class="tw-pill tw-pill--good">+{l.xp} XP</span>
                      </span>
                      <span class="list__sub">
                        {className(c, l.classId)} · level {l.level}
                        {l.fromChosen ? ' · your chosen hero' : ''}
                      </span>
                      {l.fromChosen && <span class="list__sub">It goes to your next chosen hero when you choose one, or give it to a living hero now.</span>}
                      <div class="tw-row-buttons tw-legacy__heirs">
                        {living.map((h) => {
                          const to = Math.max(h.level, heroLevelForXp(c.tuning, h.battleXp + l.xp))
                          return (
                            <Btn
                              key={h.id}
                              class="tw-btn44"
                              testid={`shrine-give-${l.id}-${h.id}`}
                              title={`${h.name} takes ${l.xp} XP`}
                              onClick={() => act((cc, pp) => passLegacy(cc, pp, l.id, h.id), `${h.name} takes up ${l.name}’s legacy: +${l.xp} XP`)}
                            >
                              Give to {h.name}
                              {to > h.level && <span class="tw-dim tw-small"> · Lv {to}</span>}
                            </Btn>
                          )
                        })}
                        {l.fromChosen && canChoose && (
                          <Btn tone="primary" class="tw-btn44" testid="shrine-choose" onClick={() => navigate('new-hero')}>
                            Choose a new hero
                          </Btn>
                        )}
                      </div>
                      {living.length === 0 && !(l.fromChosen && canChoose) && <span class="list__sub">No living hero can take it yet.</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="The Memorial">
            {p.memorial.length === 0 ? (
              <Empty>The wall is still bare.</Empty>
            ) : (
              <ul class="tw-memorial" data-testid="shrine-memorial">
                {[...p.memorial].reverse().map((m, i) => (
                  <li key={`${m.name}-${m.delve}-${i}`} class="tw-memorial__line">
                    <b class="tw-memorial__name">
                      {m.name}
                      {m.chosen ? ' ✦' : ''}
                    </b>
                    <span class="tw-memorial__how">{memorialLine(c, m)}</span>
                  </li>
                ))}
              </ul>
            )}
            {p.memorial.some((m) => m.chosen) && <p class="tw-note">✦ a chosen hero</p>}
          </Section>
        </div>
      </div>

      {ask && <ShrineConfirm c={c} p={p} ask={ask} onClose={() => setAsk(null)} />}
    </PlacePage>
  )
}

function ShrineConfirm({ c, p, ask, onClose }: { c: Content; p: Profile; ask: NonNullable<Ask>; onClose: () => void }) {
  const h = p.heroes.find((x) => x.id === ask.heroId)
  if (!h) return null
  const loss = c.tuning.death.shrine.levelLoss
  if (ask.kind === 'raise') {
    const fee = shrineFee(c, p, h.id)
    return (
      <Modal
        title={`Raise ${h.name}?`}
        testid="shrine-confirm"
        onClose={onClose}
        actions={
          <>
            <Btn onClick={onClose}>Not now</Btn>
            <Btn
              tone="primary"
              testid="shrine-confirm-yes"
              onClick={() => {
                onClose()
                act((cc, pp) => raiseAtShrine(cc, pp, h.id), `${h.name} breathes again`)
              }}
            >
              Raise <Gold amount={fee} />
            </Btn>
          </>
        }
      >
        <p class="tw-modal-text">
          Mother Cendra calls {h.name} back for {fee} gold. The return costs {loss} levels: L{h.level} → L{levelAfterRaise(h.level, loss)}.
        </p>
        <p class="tw-modal-text tw-small tw-dim">Skills, gear and what {h.name} grew by use stay. They rejoin the party if it has room.</p>
      </Modal>
    )
  }
  const xp = legacyXp(c, heroOf(p, h.id))
  const wayfarer = p.wayfarerOf[h.id] !== undefined
  const chosen = p.chosenId === h.id
  return (
    <Modal
      title={`Lay ${h.name} to rest?`}
      testid="shrine-confirm"
      onClose={onClose}
      actions={
        <>
          <Btn onClick={onClose}>Not yet</Btn>
          <Btn
            tone="danger"
            testid="shrine-confirm-yes"
            onClick={() => {
              onClose()
              act((cc, pp) => layToRest(cc, pp, h.id), `${h.name} is laid to rest`)
            }}
          >
            Lay to rest
          </Btn>
        </>
      }
    >
      <p class="tw-modal-text">
        {h.name} is gone for good.{' '}
        {xp > 0
          ? `Their legacy, ${c.tuning.death.legacy.percent}% of their battle XP (${xp} XP), waits here for ${chosen ? 'your next chosen hero, or a living hero you pick' : 'a living hero you pick'}.`
          : 'They leave no legacy: they had no battle XP yet.'}
      </p>
      <p class="tw-modal-text tw-small tw-dim">
        Their gear goes to the armory and their pet to the Stables.
        {wayfarer ? ` As a wayfarer, ${h.name} returns to the Wayfarer Chest and may answer it again, starting over.` : ''}
        {chosen ? ' The selection opens: you choose a new hero.' : ''}
      </p>
    </Modal>
  )
}
