import { signal } from '@preact/signals'
import { registerSW } from 'virtual:pwa-register'

/**
 * Updates (10 §2, CLAUDE.md gotchas): the service worker is registered once here with `registerType: 'prompt'`;
 * nothing reloads on its own. The toast shows only on quiet screens (title, settings, town), never mid-fight; the
 * player taps Restart.
 */
export const needRefresh = signal(false)
export const offlineReady = signal(false)
/** The last manual check from Settings: null until one ran. */
export const lastCheck = signal<'checking' | 'upToDate' | 'updateFound' | 'failed' | null>(null)

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000
const OFFLINE_TOAST_MS = 4000

let update: ((reload?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | null = null
let installed = false

export function installUpdates(doc: Document): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  try {
    update = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh.value = true
        if (lastCheck.value === 'checking') lastCheck.value = 'updateFound'
      },
      onOfflineReady() {
        offlineReady.value = true
        setTimeout(() => {
          offlineReady.value = false
        }, OFFLINE_TOAST_MS)
      },
      onRegisteredSW(_url, reg) {
        registration = reg ?? null
        if (!reg) return
        const check = () => {
          if (doc.visibilityState === 'visible') void reg.update()
        }
        doc.addEventListener('visibilitychange', check)
        setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      },
      onRegisterError() {
        /* no service worker (dev server, or an old browser): the game still plays */
      },
    })
  } catch {
    update = null
  }
}

/** Restart with the new build. */
export async function applyUpdate(): Promise<void> {
  if (update) await update(true)
}

export function dismissUpdate(): void {
  needRefresh.value = false
}

/** Settings -> Check for updates. */
export async function checkForUpdate(): Promise<void> {
  if (needRefresh.value) {
    lastCheck.value = 'updateFound'
    return
  }
  if (!registration) {
    lastCheck.value = 'failed'
    return
  }
  lastCheck.value = 'checking'
  try {
    await registration.update()
    setTimeout(() => {
      if (lastCheck.value === 'checking') lastCheck.value = needRefresh.value ? 'updateFound' : 'upToDate'
    }, 2500)
  } catch {
    lastCheck.value = 'failed'
  }
}
