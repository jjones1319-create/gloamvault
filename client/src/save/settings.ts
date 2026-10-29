import * as v from 'valibot'
import { KEYS, safeGet, safeSet, type KeyValueStore } from './db.ts'
import AUDIO from '../audio/tuning.json'

/**
 * Player settings (not the game save): stored under `gloamvault/settings`, validated with valibot, never trusted.
 * `frameMode` is 10-TECH-PLAN §4's 60 fps cap with a 30 fps battery mode; `perfOverlay` is the Settings toggle
 * James reads numbers from on the phone.
 */
export const SETTINGS_VERSION = 1

export const TEXT_SIZES = ['normal', 'large', 'largest'] as const
export type TextSize = (typeof TEXT_SIZES)[number]
export const PALETTES = ['standard', 'redGreen', 'blueYellow'] as const
export type Palette = (typeof PALETTES)[number]

/** Phase 8 (audio): a 0–100 slider, clamped and rounded; a missing or broken value is the default. */
const volume = (fallback: number) => v.optional(v.pipe(v.number(), v.finite(), v.transform((n) => Math.max(0, Math.min(100, Math.round(n))))), fallback)

export const SettingsSchema = v.object({
  version: v.literal(SETTINGS_VERSION),
  perfOverlay: v.boolean(),
  frameMode: v.picklist(['smooth', 'battery']),
  /** Phase 8: 100 / 115 / 130% (`largest` is new; a record from before reads as it was). */
  textSize: v.picklist(TEXT_SIZES),
  /** Phase 8: the colours that carry meaning, remapped for red–green or blue–yellow colour blindness (a11y.css). */
  palette: v.optional(v.picklist(PALETTES), 'standard'),
  reduceMotion: v.boolean(),
  haptics: v.boolean(),
  installCardDismissed: v.boolean(),
  /** Phase 8 (audio): master, music and effects volume (gain (v/100)²; the ambience rides the effects slider) and a mute. */
  masterVolume: volume(AUDIO.defaultVolume.master),
  musicVolume: volume(AUDIO.defaultVolume.music),
  sfxVolume: volume(AUDIO.defaultVolume.sfx),
  muted: v.optional(v.boolean(), false),
})

export type Settings = v.InferOutput<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  perfOverlay: false,
  frameMode: 'smooth',
  textSize: 'normal',
  palette: 'standard',
  reduceMotion: false,
  haptics: true,
  installCardDismissed: false,
  masterVolume: AUDIO.defaultVolume.master,
  musicVolume: AUDIO.defaultVolume.music,
  sfxVolume: AUDIO.defaultVolume.sfx,
  muted: false,
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
