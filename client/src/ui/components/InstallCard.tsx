import { buzz } from '../lib/haptics.ts'
import { currentPlatform, installPromptAvailable, isStandalone, promptInstall } from '../lib/platform.ts'
import { settings, updateSettings } from '../store/settings.ts'

/**
 * The install card (CLAUDE.md gotchas): Chrome's own prompt when `beforeinstallprompt` fired, otherwise the exact
 * menu steps. Hidden once installed or dismissed.
 */
export function InstallCard() {
  if (isStandalone() || settings.value.installCardDismissed) return null
  const platform = currentPlatform()
  const dismiss = () => {
    buzz()
    updateSettings({ installCardDismissed: true })
  }
  return (
    <aside class="card card--install" data-testid="install-card">
      <div class="card__body">
        <strong>Play from your home screen</strong>
        {installPromptAvailable.value ? (
          <p>Installed, Gloamvault runs full-screen in landscape, works offline and keeps its own saves.</p>
        ) : platform === 'ios' ? (
          <p>
            In Safari tap <b>Share</b>, then <b>Add to Home Screen</b>.
          </p>
        ) : (
          <p>
            In Chrome tap the <b>⋮</b> menu, then <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>.
          </p>
        )}
      </div>
      <div class="card__actions">
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
        <button class="btn" onClick={dismiss} aria-label="Dismiss the install card">
          Not now
        </button>
      </div>
    </aside>
  )
}
