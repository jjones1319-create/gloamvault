import { buzz } from '../lib/haptics.ts'
import { route, type Screen } from '../router.ts'
import { applyUpdate, dismissUpdate, needRefresh, offlineReady } from '../store/updates.ts'

/** Screens where an update toast may appear (CLAUDE.md gotchas: never mid-fight; the toast only in town). */
const QUIET: ReadonlySet<Screen> = new Set<Screen>(['title', 'settings', 'phone', 'town'])

export function UpdateToast() {
  const quiet = QUIET.has(route.value.screen)
  if (needRefresh.value && quiet) {
    return (
      <div class="toast" role="status">
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
