import { render } from 'preact'
import './ui/styles/base.css'
import { App } from './ui/app.tsx'
import { enterFullscreenLandscape, installOrientationWatch, installPromptCapture, isStandalone, isTouchDevice } from './ui/lib/platform.ts'
import { installRouter } from './ui/router.ts'
import { bootSettings, installSettingsEffects } from './ui/store/settings.ts'
import { installUpdates } from './ui/store/updates.ts'

installRouter(window)
installOrientationWatch(window)
installPromptCapture(window)
installSettingsEffects(document)
installUpdates(document)
void bootSettings()

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
