import { Choice, Toggle } from '../components/Toggle.tsx'
import { TopBar } from '../components/TopBar.tsx'
import { buzz } from '../lib/haptics.ts'
import { enterFullscreenLandscape, exitFullscreen, installPromptAvailable, isFullscreen, isStandalone, promptInstall } from '../lib/platform.ts'
import { resetSettings, settings, updateSettings } from '../store/settings.ts'
import { checkForUpdate, lastCheck, needRefresh } from '../store/updates.ts'

const CHECK_TEXT = {
  checking: 'Checking…',
  upToDate: 'You have the latest build.',
  updateFound: 'Update found. Restart from the toast.',
  failed: 'Could not check (offline, or not installed).',
} as const

export function SettingsScreen() {
  const s = settings.value
  return (
    <main class="screen screen--panel" data-screen="settings">
      <TopBar title="Settings" />
      <div class="panel">
        <section class="group">
          <h2 class="group__title">Display</h2>
          <Toggle
            label="Performance overlay"
            hint="fps, frame time, draw calls, triangles, memory in the corner"
            on={s.perfOverlay}
            onChange={(on) => updateSettings({ perfOverlay: on })}
            testId="toggle-perf"
          />
          <Choice
            label="Frame rate"
            hint="Smooth aims for 60 fps; Battery caps at 30 and runs cooler"
            value={s.frameMode}
            options={[
              { value: 'smooth', label: 'Smooth 60' },
              { value: 'battery', label: 'Battery 30' },
            ]}
            onChange={(frameMode) => updateSettings({ frameMode })}
          />
          <Choice
            label="Text size"
            value={s.textSize}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
            ]}
            onChange={(textSize) => updateSettings({ textSize })}
          />
          <Toggle label="Reduce motion" hint="Still scenery, no sway" on={s.reduceMotion} onChange={(on) => updateSettings({ reduceMotion: on })} />
          <Toggle label="Haptics" hint="A short buzz on taps" on={s.haptics} onChange={(on) => updateSettings({ haptics: on })} />
        </section>

        <section class="group">
          <h2 class="group__title">Phone</h2>
          <div class="row">
            <span class="toggle__text">
              <span class="toggle__label">Full screen, landscape</span>
              <span class="toggle__hint">{isStandalone() ? 'Installed: already full screen.' : isFullscreen.value ? 'On.' : 'Hides the browser bars.'}</span>
            </span>
            {!isStandalone() && (
              <button
                class="btn"
                onClick={() => {
                  buzz()
                  void (isFullscreen.value ? exitFullscreen() : enterFullscreenLandscape())
                }}
              >
                {isFullscreen.value ? 'Exit' : 'Go full screen'}
              </button>
            )}
          </div>
          {!isStandalone() && (
            <div class="row">
              <span class="toggle__text">
                <span class="toggle__label">Install the app</span>
                <span class="toggle__hint">{installPromptAvailable.value ? 'Chrome can install it now.' : 'Chrome menu ⋮ → Add to Home screen.'}</span>
              </span>
              {installPromptAvailable.value && (
                <button
                  class="btn btn--primary"
                  onClick={() => {
                    buzz()
                    void promptInstall()
                  }}
                >
                  Install
                </button>
              )}
            </div>
          )}
          <div class="row">
            <span class="toggle__text">
              <span class="toggle__label">Updates</span>
              <span class="toggle__hint" data-testid="update-status">
                {needRefresh.value ? CHECK_TEXT.updateFound : lastCheck.value ? CHECK_TEXT[lastCheck.value] : 'Checked when you open the game.'}
              </span>
            </span>
            <button
              class="btn"
              onClick={() => {
                buzz()
                void checkForUpdate()
              }}
            >
              Check now
            </button>
          </div>
        </section>

        <section class="group">
          <h2 class="group__title">About</h2>
          <div class="row">
            <span class="toggle__text">
              <span class="toggle__label">Gloamvault v{__APP_VERSION__}</span>
              <span class="toggle__hint">An original game. No accounts, no ads, no purchases. Everything is saved on this phone.</span>
            </span>
            <button
              class="btn"
              onClick={() => {
                buzz()
                resetSettings()
              }}
            >
              Reset settings
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
