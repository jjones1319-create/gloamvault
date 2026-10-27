import * as v from 'valibot'
import { KEYS, safeGet, safeSet, type KeyValueStore } from './db.ts'

/**
 * Player settings (not the game save): stored under `gloamvault/settings`, validated with valibot, never trusted.
 * `frameMode` is 10-TECH-PLAN §4's 60 fps cap with a 30 fps battery mode; `perfOverlay` is the Settings toggle
 * James reads numbers from on the phone.
 */
export const SETTINGS_VERSION = 1

export const SettingsSchema = v.object({
  version: v.literal(SETTINGS_VERSION),
  perfOverlay: v.boolean(),
  frameMode: v.picklist(['smooth', 'battery']),
  textSize: v.picklist(['normal', 'large']),
  reduceMotion: v.boolean(),
  haptics: v.boolean(),
  installCardDismissed: v.boolean(),
})

export type Settings = v.InferOutput<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  perfOverlay: false,
  frameMode: 'smooth',
  textSize: 'normal',
  reduceMotion: false,
  haptics: true,
  installCardDismissed: false,
}

/**
 * Never throws (10 §6: validate and clamp everything loaded). A whole valid record is taken as is; otherwise each
 * field is kept when it validates on its own and defaulted when it does not, so one bad field never resets the rest.
 */
export function validateSettings(raw: unknown): Settings {
  const whole = v.safeParse(SettingsSchema, raw)
  if (whole.success) return whole.output
  const out: Settings = { ...DEFAULT_SETTINGS }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  const obj = raw as Record<string, unknown>
  for (const key of Object.keys(SettingsSchema.entries) as (keyof Settings)[]) {
    if (key === 'version') continue
    const field = SettingsSchema.entries[key]
    const r = v.safeParse(field, obj[key])
    if (r.success) Object.assign(out, { [key]: r.output })
  }
  return out
}

export async function readSettings(store: KeyValueStore): Promise<Settings> {
  return validateSettings(await safeGet(store, KEYS.settings))
}

export function writeSettings(store: KeyValueStore, settings: Settings): Promise<boolean> {
  return safeSet(store, KEYS.settings, settings)
}
