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
      // 07 §8.3: `floor=N` names a floor; `zone=N` the N-th zone, started on its first floor (startDeepDelve).
      floor: Math.max(1, Number(p.floor ?? 1) || 1),
      ...(p.floor === undefined && p.zone !== undefined ? { zone: Math.max(1, Number(p.zone) || 1) } : {}),
      seed: Math.max(1, Number(p.seed) || 17),
      classes: (p.party ?? 'warden').split(',').filter(Boolean),
      species: (p.species ?? '').split(','),
      ...(p.level !== undefined ? { level: Math.max(1, Number(p.level) || 1) } : {}),
      auto: p.auto === '1',
      deathRule: p.death === 'sheltered' ? 'sheltered' : p.death === 'nightmare' ? 'nightmare' : 'mortal',
      learn: (p.learn ?? '').split(',').filter(Boolean),
      toEnd: p.end === '1',
      // 07 §8.3: the preset and the Pacts (`&difficulty=hard&pacts=candle,hungry-hunter`).
      difficulty: p.difficulty === 'hard' || p.difficulty === 'dread' ? p.difficulty : 'normal',
      pacts: (p.pacts ?? '').split(',').filter(Boolean),
      // 07 §8.3 links 2 and 7: `&room=boss` stands the party at the boss's door, the floor cleared (with `auto=1` it walks in).
      ...(p.room === 'boss' ? { room: 'boss' as const } : {}),
    })
  } else if (r.screen === 'autoplay') {
    // Phase 6: the soak (10 §4) — a party that plays delve after delve by itself, logging the frame rate each minute.
    void import('./ui/screens/delve/autoplay.ts').then((m) =>
      m.startAutoplay({
        minutes: Math.max(1, Number(p.minutes ?? 30) || 30),
        classes: (p.party ?? 'warden,blade,mender,arcanist').split(',').filter(Boolean),
        species: (p.species ?? 'dwarf,orc,elf,draconid').split(','),
        level: Math.max(1, Number(p.level ?? 4) || 4),
        floor: Math.max(1, Number(p.floor ?? 1) || 1),
      }),
    )
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
