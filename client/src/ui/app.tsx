import { useEffect } from 'preact/hooks'
import { profile, sessionReady } from '../game/session.ts'
import { PerfOverlay } from './components/PerfOverlay.tsx'
import { RotateHint } from './components/RotateHint.tsx'
import { stageReady } from './components/StageView.tsx'
import { UpdateToast } from './components/UpdateToast.tsx'
import { ToastHost } from './kit/kit.tsx'
import { route } from './router.ts'
import { DelveScreen } from './screens/Delve.tsx'
import { HeroScreen } from './screens/Hero.tsx'
import { NewHeroScreen } from './screens/NewHero.tsx'
import { PhoneScreen } from './screens/Phone.tsx'
import { SettingsScreen } from './screens/Settings.tsx'
import { TitleScreen } from './screens/Title.tsx'
import { TownScreen } from './screens/Town.tsx'
import { ViewerScreen } from './screens/Viewer.tsx'
import { settingsLoaded } from './store/settings.ts'

/** Screens that mount a three.js stage; `data-ready` on <html> waits for their first frame (tools/shots). */
const HAS_STAGE = new Set(['title', 'delve', 'viewer'])
/** Screens that need a profile; without one they fall back to the title. */
const NEEDS_PROFILE = new Set(['town', 'hero', 'delve'])

export function App() {
  const r = route.value
  const ready0 = sessionReady.value
  const needsProfile = NEEDS_PROFILE.has(r.screen)
  let screen
  if (needsProfile && !ready0) screen = <Loading />
  else if (needsProfile && !profile.value) screen = <TitleScreen route={{ screen: 'title', params: { needsHero: '1' } }} />
  else
    switch (r.screen) {
      case 'settings':
        screen = <SettingsScreen />
        break
      case 'phone':
        screen = <PhoneScreen />
        break
      case 'new-hero':
        screen = ready0 ? <NewHeroScreen /> : <Loading />
        break
      case 'town':
        screen = <TownScreen route={r} />
        break
      case 'hero':
        screen = <HeroScreen route={r} />
        break
      case 'delve':
        screen = <DelveScreen />
        break
      case 'viewer':
        screen = ready0 ? <ViewerScreen route={r} /> : <Loading />
        break
      default:
        // Deep links to screens that arrive in later phases land on the title with a note.
        screen = <TitleScreen route={r} />
    }
  const shown = screen.type === TitleScreen ? 'title' : r.screen
  const ready = settingsLoaded.value && (r.screen === 'settings' || r.screen === 'phone' || ready0) && (!HAS_STAGE.has(shown) || stageReady.value)

  useEffect(() => {
    document.documentElement.dataset.ready = ready ? '1' : '0'
  }, [ready])

  return (
    <>
      {screen}
      <ToastHost />
      <RotateHint />
      <UpdateToast />
      <PerfOverlay />
    </>
  )
}

function Loading() {
  return (
    <main class="screen screen--panel loading" data-screen="loading">
      <p class="loading__text">Lighting the lanterns…</p>
    </main>
  )
}
