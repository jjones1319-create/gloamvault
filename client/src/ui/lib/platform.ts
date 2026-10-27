import { signal } from '@preact/signals'

/**
 * The phone: install prompt capture, "am I installed", fullscreen + landscape lock on the first tap (CLAUDE.md
 * gotchas), and an orientation signal for the rotate hint. The pure parts take arguments so they can be tested.
 */
export type Platform = 'android' | 'ios' | 'other'

export function platformOf(userAgent: string, maxTouchPoints = 0): Platform {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'other'
}

export function currentPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  return platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0)
}

export function isTouchDevice(): boolean {
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0
}

/** True when opened from the home-screen icon (fullscreen or standalone display mode). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const nav = navigator as Navigator & { standalone?: boolean }
    if (nav.standalone === true) return true
    return (
      (window.matchMedia?.('(display-mode: fullscreen)').matches ?? false) ||
      (window.matchMedia?.('(display-mode: standalone)').matches ?? false)
    )
  } catch {
    return false
  }
}

/* ---------- install prompt ---------- */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
export const installPromptAvailable = signal(false)

export function installPromptCapture(target: Window): void {
  target.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    installPromptAvailable.value = true
  })
  target.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installPromptAvailable.value = false
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const p = deferredPrompt
  if (!p) return 'unavailable'
  try {
    await p.prompt()
    const choice = await p.userChoice
    if (choice.outcome === 'accepted') {
      deferredPrompt = null
      installPromptAvailable.value = false
    }
    return choice.outcome
  } catch {
    return 'unavailable'
  }
}

/* ---------- fullscreen and orientation ---------- */

export const isPortrait = signal(false)
export const isFullscreen = signal(false)

export function installOrientationWatch(win: Window): void {
  try {
    const mq = win.matchMedia('(orientation: portrait)')
    isPortrait.value = mq.matches
    mq.addEventListener('change', (e) => {
      isPortrait.value = e.matches
    })
  } catch {
    /* no matchMedia: assume landscape */
  }
  win.document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = win.document.fullscreenElement !== null
  })
}

/** Fullscreen first, then the landscape lock (which only works inside fullscreen on Android Chrome). Never throws. */
export async function enterFullscreenLandscape(): Promise<void> {
  if (typeof document === 'undefined') return
  try {
    const root = document.documentElement
    if (!document.fullscreenElement && root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    /* denied or unsupported */
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    if (orientation?.lock) await orientation.lock('landscape')
  } catch {
    /* the browser tab cannot lock; the installed app is locked by the manifest */
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* ignore */
  }
}
