import { effect, signal } from '@preact/signals'
import { idbStore, type KeyValueStore } from '../../save/db.ts'
import { DEFAULT_SETTINGS, readSettings, writeSettings, type Settings } from '../../save/settings.ts'

/** The live settings. Screens read `settings.value`; `updateSettings` writes through to storage. */
export const settings = signal<Settings>(DEFAULT_SETTINGS)
export const settingsLoaded = signal(false)

let store: KeyValueStore | null = null

export async function bootSettings(s: KeyValueStore = idbStore()): Promise<void> {
  store = s
  settings.value = await readSettings(s)
  settingsLoaded.value = true
}

export function updateSettings(patch: Partial<Settings>): void {
  const next: Settings = { ...settings.value, ...patch }
  settings.value = next
  if (store) void writeSettings(store, next)
}

export function resetSettings(): void {
  updateSettings({ ...DEFAULT_SETTINGS })
}

/** Mirrors the settings the CSS reads onto <html> (text size, reduced motion). */
export function installSettingsEffects(doc: Document): () => void {
  return effect(() => {
    const s = settings.value
    doc.documentElement.dataset.textSize = s.textSize
    doc.documentElement.dataset.reduceMotion = s.reduceMotion ? '1' : '0'
  })
}
