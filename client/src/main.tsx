import { render } from 'preact'
import './ui/styles/base.css'
import { App } from './ui/app.tsx'
import { enterFullscreenLandscape, installOrientationWatch, installPromptCapture, isStandalone, isTouchDevice } from './ui/lib/platform.ts'
import { bootSession, startDeepDelve, startDemoTown } from './game/session.ts'
import { installRouter, route } from './ui/router.ts'
import { bootSettings, installSettingsEffects } from './ui/store/settings.ts'
import { installUpdates } from './ui/store/updates.ts'

installRouter(window)
installOrientationWatch(window)
installPromptCapture(window)
installSettingsEffects(document)
installUpdates(document)
void bootSettings()

// The game: a deep link with a seed plays an ephemeral delve (shots, e2e, a debug link); `&demo=1` on any screen an
// ephemeral demo profile (a level-1 Warden with gold and an egg); everything else loads the save.
{
  const r = route.value
  const p = r.params
  if (r.screen === 'delve' && p.seed !== undefined) {
    void startDeepDelve({
      dungeonId: p.delve && p.delve !== '1' ? p.delve : 'gravehollow-keep',
      floor: Math.max(1, Number(p.floor ?? p.zone ?? 1) || 1),
      seed: Math.max(1, Number(p.seed) || 17),
      classes: (p.party ?? 'warden').split(',').filter(Boolean),
      species: (p.species ?? '').split(','),
      level: Math.max(1, Number(p.level ?? 1) || 1),
      auto: p.auto === '1',
      deathRule: p.death === 'sheltered' ? 'sheltered' : p.death === 'nightmare' ? 'nightmare' : 'mortal',
      learn: (p.learn ?? '').split(',').filter(Boolean),
      toEnd: p.end === '1',
    })
  } else if (p.demo === '1') void startDemoTown()
  else void bootSession()
}

// Landscape: lock after the first tap (CLAUDE.md gotchas). Only on touch devices, and only in a browser tab.
if (isTouchDevice() && !isStandalone()) {
  document.addEventListener(
    'pointerdown',
    () => {
      void enterFullscreenLandscape()
    },
    { once: true },
  )
}

render(<App />, document.getElementById('app')!)
