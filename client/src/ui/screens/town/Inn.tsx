import { canChooseHero, isDead, pendingChosenLegacy, setParty } from '../../../../../sim/src/town.ts'
import { act, content, ephemeral, profile, toast } from '../../../game/session.ts'
import { Btn, Grade, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { navigate } from '../../router.ts'
import { DownloadSaveButton, ImportSaveButton } from './save-controls.tsx'
import { HeroXp, PlacePage, heroKind, wayfarerGrade } from './shared.tsx'

/**
 * The Lantern Inn, Brannock's (03 §8.2, D-090, D-091): the roster (up to `coop.rosterMax`) with who goes into the tower
 * and in what order (up to `coop.maxPlayers`, never the dead), the chosen hero, the wayfarers and the dead at the
 * Shrine; a new chosen hero when the selection is open; and the save by hand.
 */
export function Inn() {
  const c = content.value!
  const p = profile.value!
  const max = c.tuning.coop.maxPlayers
  const rosterMax = c.tuning.coop.rosterMax
  const canChoose = canChooseHero(c, p)
  const legacy = pendingChosenLegacy(p)
  const party = p.partyIds.filter((id) => !isDead(p, id))

  const toggle = (id: string) => {
    const inParty = party.includes(id)
    if (inParty && party.length === 1) {
      toast('A party needs at least one living hero.', 'bad')
      return
    }
    if (!inParty && party.length >= max) {
      toast(`The party is full (${max}).`, 'bad')
      return
    }
    act((_c, pp) => setParty(pp, inParty ? party.filter((x) => x !== id) : [...party, id]))
  }

  const moveUp = (id: string) => {
    const i = party.indexOf(id)
    if (i <= 0) return
    const ids = [...party]
    ids.splice(i - 1, 2, ids[i]!, ids[i - 1]!)
    act((_c, pp) => setParty(pp, ids))
  }

  return (
    <PlacePage id="inn">
      <div class="split split--wide-left">
        <Section title={`The roster (${p.heroes.length} / ${rosterMax})`}>
          <div class="list">
            {p.heroes.map((h) => {
              const dead = isDead(p, h.id)
              const at = party.indexOf(h.id)
              const going = at >= 0
              const grade = wayfarerGrade(c, p, h.id)
              return (
                <div key={h.id} class={`list__row tw-roster ${going ? 'list__row--on' : ''} ${dead ? 'tw-roster--dead' : ''}`}>
                  {dead ? (
                    <span class="tw-check tw-check--dead" aria-hidden="true">
                      🕯️
                    </span>
                  ) : (
                    <button
                      role="checkbox"
                      aria-checked={going}
                      class={`tw-check ${going ? 'tw-check--on' : ''}`}
                      data-testid={`inn-party-${h.id}`}
                      aria-label={`${h.name} in the party`}
                      onClick={() => {
                        buzz()
                        toggle(h.id)
                      }}
                    >
                      <span class="tw-check__box" aria-hidden="true">
                        {going ? at + 1 : ''}
                      </span>
                    </button>
                  )}
                  <button
                    class="tw-roster__main"
                    data-testid={dead ? `inn-dead-${h.id}` : `inn-hero-${h.id}`}
                    onClick={() => {
                      buzz()
                      if (dead) navigate('town', { place: 'shrine' })
                      else navigate('hero', { hero: h.id, tab: 'status' })
                    }}
                    aria-label={dead ? `${h.name} lies at the Shrine` : `Open ${h.name}`}
                  >
                    <span class="tw-roster__name">
                      <b>{h.name}</b> <span class="tw-dim">· Lv {h.level}</span>
                      {p.chosenId === h.id && <span class="tw-pill tw-pill--chosen">Chosen</span>}
                      {grade && (
                        <span class="tw-pill">
                          Wayfarer <Grade grade={grade} />
                        </span>
                      )}
                      {dead && <span class="tw-pill tw-pill--bad">Dead · at the Shrine</span>}
                    </span>
                    <span class="list__sub">
                      {heroKind(c, h)} · {dead ? 'tap to go to the Shrine' : going ? `in the party, ${ordinal(at + 1)}` : 'resting at the inn'}
                    </span>
                    {!dead && <HeroXp c={c} hero={h} />}
                  </button>
                  {going && party.length > 1 && (
                    <Btn class="tw-btn44 tw-up" testid={`inn-up-${h.id}`} disabled={at === 0} title="Move up in the order" onClick={() => moveUp(h.id)}>
                      ↑
                    </Btn>
                  )}
                </div>
              )
            })}
          </div>
          <p class="tw-note">
            Tick who goes into the tower (1 to {max}); the number is their place in the line. Tap a name for the hero’s sheet.
          </p>
        </Section>

        <div>
          <Section title="New heroes">
            {canChoose ? (
              <>
                <p class="tw-note">
                  Your chosen hero is gone. Choose a new one
                  {legacy ? `: ${legacy.name}’s legacy (+${legacy.xp} XP) goes to them` : ''}.
                </p>
                <Btn tone="primary" testid="inn-new-hero" onClick={() => navigate('new-hero')}>
                  Choose a new hero
                </Btn>
              </>
            ) : (
              <>
                <p class="tw-note" data-testid="inn-wayfarer-note">
                  New party members come from the Wayfarer Chest at the Curio Merchant.
                </p>
                <Btn testid="inn-to-curio" onClick={() => navigate('town', { place: 'curio' })}>
                  To the Curio Merchant ›
                </Btn>
              </>
            )}
            {p.heroes.length >= rosterMax && <p class="tw-note">The Inn is full: {rosterMax} heroes.</p>}
          </Section>
          <Section title="Your save">
            <p class="tw-note">{ephemeral.value ? 'This is a demo: nothing here is saved.' : 'Saved automatically after everything you do.'}</p>
            <div class="tw-row-buttons">
              <DownloadSaveButton />
              <ImportSaveButton />
            </div>
          </Section>
        </div>
      </div>
    </PlacePage>
  )
}

function ordinal(n: number): string {
  return n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : n === 4 ? 'fourth' : `#${n}`
}
