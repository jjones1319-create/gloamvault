import { useEffect, useState } from 'preact/hooks'
import type { DeathRule } from '../../../../sim/src/types/enums.ts'
import { InstallCard } from '../components/InstallCard.tsx'
import { StageView } from '../components/StageView.tsx'
import { buzz } from '../lib/haptics.ts'
import { isStandalone } from '../lib/platform.ts'
import { content, delve, hall, hasSave, profile, sessionReady, startNewGame } from '../../game/session.ts'
import { deathRuleName } from './town/text.ts'
import { Modal } from '../kit/kit.tsx'
import { navigate, type Route } from '../router.ts'

export const PHASE = 4

/** Which phase a deep-linked screen arrives in, for the "this link opens in Phase N" chip. */
const ARRIVES: Partial<Record<Route['screen'], number>> = {
  replay: 7,
  viewer: 5,
  room: 6,
  gen: 7,
}

/** The three death rules a new save chooses between (D-088, D-095), gentlest first, in the player's words. */
const DEATH_CHOICES: { rule: DeathRule; title: string; text: string }[] = [
  {
    rule: 'sheltered',
    title: 'Sheltered',
    text: 'The fallen get back up after a fight, and a beaten party wakes at the Lantern Inn. Nobody is lost for good.',
  },
  {
    rule: 'mortal',
    title: 'Mortal (recommended)',
    text: 'Heroes who die stay dead unless a healer or the Ember Shrine raises them, for levels. If the whole party falls, they are lost for good.',
  },
  {
    rule: 'nightmare',
    title: 'Nightmare',
    text: 'Mortal, and your chosen hero leads every delve. If they die, the save ends: everything is lost but their name in the Hall of Nightmares.',
  },
]

function DeathRuleChoice({ onPick, onClose }: { onPick: (rule: DeathRule) => void; onClose: () => void }) {
  return (
    <Modal title="How should death work?" onClose={onClose} testid="death-rule">
      <div class="death-choice">
        {DEATH_CHOICES.map((d) => (
          <button key={d.rule} class={`death-choice__card ${d.rule === 'mortal' ? 'death-choice__card--main' : d.rule === 'nightmare' ? 'death-choice__card--nightmare' : ''}`} data-testid={`death-${d.rule}`} onClick={() => onPick(d.rule)}>
            <b>{d.title}</b>
            <span>{d.text}</span>
          </button>
        ))}
      </div>
      <p class="death-choice__note">You can lower the rule later in Settings, never raise it.</p>
    </Modal>
  )
}

/** The Hall of Nightmares (D-095): the Nightmare saves that ended, newest first. */
function HallOfNightmares({ onClose }: { onClose: () => void }) {
  const c = content.value
  const name = (map: 'species' | 'classes', id: string) => c?.[map].get(id)?.name ?? id
  return (
    <Modal title="The Hall of Nightmares" onClose={onClose} testid="hall">
      {hall.value.length === 0 ? (
        <p class="prose">No Nightmare has ended yet.</p>
      ) : (
        <ol class="hall">
          {hall.value.map((e, i) => (
            <li key={`${e.endedAt}-${i}`} class="hall__row">
              <b>{e.name}</b>
              <span>
                {name('species', e.speciesId)} {name('classes', e.classId)} · level {e.level} · {e.how === 'wipe' ? 'fell with the whole party' : 'fell'} on floor {e.floor} of {c?.dungeons.get(e.dungeonId)?.name ?? e.dungeonId}
              </span>
              <small>
                deepest floor {e.deepest} · {e.delves} delve{e.delves === 1 ? '' : 's'} · {e.wayfarers} wayfarer{e.wayfarers === 1 ? '' : 's'}
                {e.endedAt ? ` · ${e.endedAt.slice(0, 10)}` : ''}
              </small>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}

export function TitleScreen({ route }: { route: Route }) {
  const pending = route.screen !== 'title' ? ARRIVES[route.screen] : undefined
  const [choosing, setChoosing] = useState(false)
  const [hallOpen, setHallOpen] = useState(route.params.hall === '1')
  // An ended Nightmare clears the save before the route changes, so the title may already be on screen: open on the param.
  useEffect(() => {
    if (route.params.hall === '1') setHallOpen(true)
  }, [route.params.hall])
  const p = profile.value
  const living = p ? p.heroes.filter((h) => !p.dead.some((d) => d.heroId === h.id)) : []
  return (
    <main class="screen screen--title" data-screen="title">
      <StageView content="title" />
      <div class="title">
        <div class="title__left">
          <div class="title__brand">
            <h1 class="wordmark">Gloamvault</h1>
            <p class="tagline">Delve the keep. Fight on the timeline. Care for your things.</p>
          </div>
          {route.params.needsHero === '1' && (
            <p class="chip chip--note" data-testid="needs-hero">
              Make a hero first: tap New game.
            </p>
          )}
          {pending !== undefined && (
            <p class="chip chip--note" data-testid="pending-link">
              This link (#{route.screen}) opens in Phase {pending}.
            </p>
          )}
          <InstallCard />
        </div>
        <nav class="menu" aria-label="Main menu">
          {hasSave() ? (
            <button
              class="btn btn--primary btn--big"
              data-testid="continue"
              onClick={() => {
                buzz()
                // Every hero lost (Mortal): the selection opens; the town, its gold and its pets are still yours (D-090).
                navigate(delve.value ? 'delve' : living.length === 0 ? 'new-hero' : 'town')
              }}
            >
              Continue{' '}
              <small>
                {living.length ? living.map((h) => h.name).join(', ') : 'choose a new hero'}
                {p ? ` · ${deathRuleName(p.deathRule)}` : ''}
              </small>
            </button>
          ) : (
            <button
              class="btn btn--primary btn--big"
              data-testid="new-game"
              disabled={!sessionReady.value}
              onClick={() => {
                buzz()
                if (profile.value) navigate('new-hero')
                else setChoosing(true)
              }}
            >
              New game <small>make your first hero</small>
            </button>
          )}
          <button
            class="btn btn--big"
            onClick={() => {
              buzz()
              navigate('settings')
            }}
          >
            Settings
          </button>
          <button
            class="btn btn--big"
            onClick={() => {
              buzz()
              navigate('phone')
            }}
          >
            Try this on your phone
          </button>
          {hall.value.length > 0 && (
            <button
              class="btn btn--big"
              data-testid="hall-open"
              onClick={() => {
                buzz()
                setHallOpen(true)
              }}
            >
              Hall of Nightmares <small>{hall.value.length}</small>
            </button>
          )}
        </nav>
        {hallOpen && <HallOfNightmares onClose={() => setHallOpen(false)} />}
        {choosing && (
          <DeathRuleChoice
            onClose={() => setChoosing(false)}
            onPick={(rule) => {
              buzz()
              startNewGame(rule)
              setChoosing(false)
              navigate('new-hero')
            }}
          />
        )}
        <p class="version" data-testid="version">
          v{__APP_VERSION__} · Phase {PHASE} · {isStandalone() ? 'installed' : 'browser tab'}
        </p>
      </div>
    </main>
  )
}
