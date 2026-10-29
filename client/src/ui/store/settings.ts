import { effect, signal } from '@preact/signals'
import { idbStore, KEYS, safeGet, type KeyValueStore } from '../../save/db.ts'
import { DEFAULT_SETTINGS, readSettings, writeSettings, type Settings } from '../../save/settings.ts'

/** The live settings. Screens read `settings.value`; `updateSettings` writes through to storage. */
export const settings = signal<Settings>(DEFAULT_SETTINGS)
export const settingsLoaded = signal(false)

let store: KeyValueStore | null = null

export async function bootSettings(s: KeyValueStore = idbStore()): Promise<void> {
  store = s
  const stored = (await safeGet(s, KEYS.settings)) !== undefined
  const read = await readSettings(s)
  // Phase 8: a first run follows the phone's own "remove animations" choice; Settings changes it from then on.
  settings.value = !stored && prefersReducedMotion() ? { ...read, reduceMotion: true } : read
  settingsLoaded.value = true
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  const next: Settings = { ...settings.value, ...patch }
  settings.value = next
  if (store) void writeSettings(store, next)
}

export function resetSettings(): void {
  updateSettings({ ...DEFAULT_SETTINGS })
}

/** Mirrors the settings the CSS reads onto <html> (text size, reduced motion, the colour-blind palette). */
export function installSettingsEffects(doc: Document): () => void {
  return effect(() => {
    const s = settings.value
    doc.documentElement.dataset.textSize = s.textSize
    doc.documentElement.dataset.reduceMotion = s.reduceMotion ? '1' : '0'
    doc.documentElement.dataset.palette = s.palette
  })
}
