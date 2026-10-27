import { InstallCard } from '../components/InstallCard.tsx'
import { StageView } from '../components/StageView.tsx'
import { buzz } from '../lib/haptics.ts'
import { isStandalone } from '../lib/platform.ts'
import { navigate, type Route } from '../router.ts'

export const PHASE = 1

/** Which phase a deep-linked screen arrives in, for the "this link opens in Phase N" chip. */
const ARRIVES: Partial<Record<Route['screen'], number>> = {
  'new-hero': 4,
  town: 4,
  delve: 4,
  replay: 4,
  autoplay: 4,
  viewer: 5,
  room: 6,
  gen: 2,
}

export function TitleScreen({ route }: { route: Route }) {
  const pending = route.screen !== 'title' ? ARRIVES[route.screen] : undefined
  return (
    <main class="screen screen--title" data-screen="title">
      <StageView content="title" />
      <div class="title">
        <div class="title__left">
          <div class="title__brand">
            <h1 class="wordmark">Gloamvault</h1>
            <p class="tagline">Delve the keep. Fight on the timeline. Care for your things.</p>
          </div>
          {pending !== undefined && (
            <p class="chip chip--note" data-testid="pending-link">
              This link (#{route.screen}) opens in Phase {pending}.
            </p>
          )}
          <InstallCard />
        </div>
        <nav class="menu" aria-label="Main menu">
          <button class="btn btn--primary btn--big" disabled title="Arrives in Phase 4">
            New hero <small>Phase 4</small>
          </button>
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
        </nav>
        <p class="version" data-testid="version">
          v{__APP_VERSION__} · Phase {PHASE} · {isStandalone() ? 'installed' : 'browser tab'}
        </p>
      </div>
    </main>
  )
}
