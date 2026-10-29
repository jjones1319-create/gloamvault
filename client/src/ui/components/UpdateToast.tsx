import { useEffect } from 'preact/hooks'
import { delve, profile } from '../../game/session.ts'
import { buzz } from '../lib/haptics.ts'
import { route } from '../router.ts'
import { updateQuiet } from '../store/updateRules.ts'
import { applyUpdate, dismissUpdate, needRefresh, offlineReady, reloadWanted } from '../store/updates.ts'

/**
 * The update toast (CLAUDE.md gotchas: never auto-reload mid-fight; the toast only in town; Phase 8, pass B): it shows
 * on the title and in town while no delve is in progress (updateRules.ts). A new build that took over from another
 * window waits here too, and reloads the page at the first quiet moment.
 */
export function UpdateToast() {
  const delveInProgress = delve.value !== null || (profile.value?.activeDelve ?? null) !== null
  const quiet = updateQuiet(route.value.screen, delveInProgress)
  const reload = reloadWanted.value
  useEffect(() => {
    if (reload && quiet) window.location.reload()
  }, [reload, quiet])
  if (needRefresh.value && quiet) {
    return (
      <div class="toast" role="status" data-testid="update-toast">
        <span>Update ready.</span>
        <button
          class="btn btn--small btn--primary"
          onClick={() => {
            buzz()
            void applyUpdate()
          }}
        >
          Restart
        </button>
        <button class="btn btn--small" onClick={dismissUpdate}>
          Later
        </button>
      </div>
    )
  }
  if (offlineReady.value && quiet) {
    return (
      <div class="toast" role="status">
        <span>Ready to play offline.</span>
      </div>
    )
  }
  return null
}
