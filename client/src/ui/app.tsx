import { useEffect } from 'preact/hooks'
import { PerfOverlay } from './components/PerfOverlay.tsx'
import { RotateHint } from './components/RotateHint.tsx'
import { stageReady } from './components/StageView.tsx'
import { UpdateToast } from './components/UpdateToast.tsx'
import { route } from './router.ts'
import { PhoneScreen } from './screens/Phone.tsx'
import { SettingsScreen } from './screens/Settings.tsx'
import { TitleScreen } from './screens/Title.tsx'
import { settingsLoaded } from './store/settings.ts'

/** Screens that mount a three.js stage; `data-ready` on <html> waits for their first frame (tools/shots). */
const HAS_STAGE = new Set(['title'])

export function App() {
  const r = route.value
  let screen
  switch (r.screen) {
    case 'settings':
      screen = <SettingsScreen />
      break
    case 'phone':
      screen = <PhoneScreen />
      break
    default:
      // Deep links to screens that arrive in later phases land on the title with a note.
      screen = <TitleScreen route={r} />
  }
  const stageScreen = r.screen === 'settings' || r.screen === 'phone' ? r.screen : 'title'
  const ready = settingsLoaded.value && (!HAS_STAGE.has(stageScreen) || stageReady.value)

  useEffect(() => {
    document.documentElement.dataset.ready = ready ? '1' : '0'
  }, [ready])

  return (
    <>
      {screen}
      <RotateHint />
      <UpdateToast />
      <PerfOverlay />
    </>
  )
}
