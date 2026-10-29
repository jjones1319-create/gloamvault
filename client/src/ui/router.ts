import { signal } from '@preact/signals'

/**
 * Hash routing only (CLAUDE.md gotchas: GitHub Pages cannot serve path routes). `#settings` names a screen; a deep
 * link is a query in the hash whose first known key names the screen: `#delve=gravehollow&zone=1&seed=17` (07 §8.3).
 * The pure parts take strings so they can be tested.
 */
export const SCREENS = ['title', 'settings', 'phone', 'town', 'new-hero', 'hero', 'delve', 'viewer', 'room', 'gen', 'replay', 'autoplay', 'codex'] as const
export type Screen = (typeof SCREENS)[number]

export interface Route {
  screen: Screen
  params: Readonly<Record<string, string>>
}

export function isScreen(s: string): s is Screen {
  return (SCREENS as readonly string[]).includes(s)
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

export function parseHash(hash: string): Route {
  let h = hash.startsWith('#') ? hash.slice(1) : hash
  h = h.trim()
  if (h === '') return { screen: 'title', params: {} }
  const params: Record<string, string> = {}
  let screen: Screen | null = null
  for (const part of h.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    const key = safeDecode(eq < 0 ? part : part.slice(0, eq))
    const value = eq < 0 ? '1' : safeDecode(part.slice(eq + 1))
    if (!key) continue
    if (screen === null && isScreen(key)) screen = key
    params[key] = value
  }
  return { screen: screen ?? 'title', params }
}

export function routeToHash(screen: Screen, params: Record<string, string> = {}): string {
  const parts: string[] = []
  const rest: Record<string, string> = { ...params }
  const own = rest[screen]
  if (own !== undefined && own !== '1') parts.push(`${screen}=${encodeURIComponent(own)}`)
  else parts.push(screen)
  delete rest[screen]
  for (const [k, v] of Object.entries(rest)) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return `#${parts.join('&')}`
}

export const route = signal<Route>({ screen: 'title', params: {} })

export function installRouter(win: Window): void {
  const apply = () => {
    route.value = parseHash(win.location.hash)
  }
  apply()
  win.addEventListener('hashchange', apply)
}

export function navigate(screen: Screen, params: Record<string, string> = {}): void {
  if (typeof window === 'undefined') return
  const next = routeToHash(screen, params)
  if (window.location.hash === next) route.value = parseHash(next)
  else window.location.hash = next
}
