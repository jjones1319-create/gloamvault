import { describe, expect, it } from 'vitest'
import { memoryStore } from '../save/db.ts'
import { DEFAULT_SETTINGS, readSettings, validateSettings, writeSettings } from '../save/settings.ts'
import TUNING from './tuning.json'

/** Phase 8 (pass A): the four sound settings are optional, defaulted and clamped; a record from before reads as it was. */
describe('the sound settings (master, music and effects volume, mute)', () => {
  it('default to the tuning\'s volumes, unmuted', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ masterVolume: TUNING.defaultVolume.master, musicVolume: TUNING.defaultVolume.music, sfxVolume: TUNING.defaultVolume.sfx, muted: false })
  })

  it('a record saved before Phase 8 keeps every field and gains the sound defaults', () => {
    const old = { version: 1, perfOverlay: true, frameMode: 'battery', textSize: 'large', reduceMotion: true, haptics: false, installCardDismissed: true }
    const s = validateSettings(old)
    expect(s).toMatchObject({ perfOverlay: true, frameMode: 'battery', textSize: 'large', reduceMotion: true, haptics: false, installCardDismissed: true })
    expect(s).toMatchObject({ masterVolume: TUNING.defaultVolume.master, musicVolume: TUNING.defaultVolume.music, sfxVolume: TUNING.defaultVolume.sfx, muted: false })
  })

  it('volumes are clamped to 0–100 and rounded; a broken one is the default and leaves the others alone', () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, masterVolume: 150, musicVolume: -20, sfxVolume: 42.6 })).toMatchObject({ masterVolume: 100, musicVolume: 0, sfxVolume: 43 })
    const s = validateSettings({ ...DEFAULT_SETTINGS, musicVolume: 'loud', muted: 'yes', sfxVolume: 30 })
    expect(s.musicVolume).toBe(TUNING.defaultVolume.music)
    expect(s.muted).toBe(false)
    expect(s.sfxVolume).toBe(30)
    expect(validateSettings({ ...DEFAULT_SETTINGS, masterVolume: Number.NaN }).masterVolume).toBe(TUNING.defaultVolume.master)
  })

  it('round-trip through storage', async () => {
    const store = memoryStore()
    await writeSettings(store, { ...DEFAULT_SETTINGS, masterVolume: 55, muted: true })
    expect(await readSettings(store)).toMatchObject({ masterVolume: 55, muted: true })
  })
})
