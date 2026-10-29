import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PALETTES, TEXT_SIZES, validateSettings } from './settings.ts'

describe('Phase 8 accessibility settings (optional fields: no settings version bump)', () => {
  it('a record from before Phase 8 (no palette, the two old text sizes) reads as it was, the palette standard', () => {
    const old = { version: 1, perfOverlay: true, frameMode: 'battery', textSize: 'large', reduceMotion: true, haptics: false, installCardDismissed: true }
    expect(validateSettings(old)).toMatchObject({ ...old, palette: 'standard' })
  })

  it('takes the third text size and the two colour-blind palettes', () => {
    expect(TEXT_SIZES).toEqual(['normal', 'large', 'largest'])
    expect(PALETTES).toEqual(['standard', 'redGreen', 'blueYellow'])
    for (const textSize of TEXT_SIZES) for (const palette of PALETTES) expect(validateSettings({ ...DEFAULT_SETTINGS, textSize, palette })).toMatchObject({ textSize, palette })
  })

  it('an unknown palette or text size falls back to the default, keeping the rest', () => {
    const s = validateSettings({ ...DEFAULT_SETTINGS, perfOverlay: true, palette: 'sepia', textSize: 'huge' })
    expect(s.palette).toBe('standard')
    expect(s.textSize).toBe('normal')
    expect(s.perfOverlay).toBe(true)
  })
})
