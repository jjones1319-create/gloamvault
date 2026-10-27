import { describe, expect, it } from 'vitest'
import { memoryStore } from './db.ts'
import { DEFAULT_SETTINGS, readSettings, validateSettings, writeSettings } from './settings.ts'

describe('settings validation (10 §6: validate and clamp, never crash)', () => {
  it('nothing stored reads as the defaults', () => {
    expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(validateSettings('garbage')).toEqual(DEFAULT_SETTINGS)
    expect(validateSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })

  it('a valid record is kept whole', () => {
    const s = { ...DEFAULT_SETTINGS, perfOverlay: true, frameMode: 'battery' as const, textSize: 'large' as const }
    expect(validateSettings(s)).toEqual(s)
  })

  it('one bad field is defaulted without resetting the others', () => {
    const s = validateSettings({ version: 1, perfOverlay: true, frameMode: 'turbo', textSize: 'large', haptics: 'yes' })
    expect(s.perfOverlay).toBe(true)
    expect(s.frameMode).toBe('smooth')
    expect(s.textSize).toBe('large')
    expect(s.haptics).toBe(true)
    expect(s.reduceMotion).toBe(false)
  })

  it('unknown keys are dropped', () => {
    const s = validateSettings({ ...DEFAULT_SETTINGS, cheat: true })
    expect('cheat' in s).toBe(false)
  })

  it('round-trips through a store under the gloamvault/ prefix', async () => {
    const store = memoryStore()
    expect(await readSettings(store)).toEqual(DEFAULT_SETTINGS)
    const next = { ...DEFAULT_SETTINGS, perfOverlay: true }
    expect(await writeSettings(store, next)).toBe(true)
    expect(await readSettings(store)).toEqual(next)
    expect(await store.keys()).toEqual(['gloamvault/settings'])
  })

  it('a store that throws reads as the defaults and writes as false', async () => {
    const broken = {
      get: async () => {
        throw new Error('no idb')
      },
      set: async () => {
        throw new Error('no idb')
      },
      del: async () => {},
      keys: async () => [],
    }
    expect(await readSettings(broken)).toEqual(DEFAULT_SETTINGS)
    expect(await writeSettings(broken, DEFAULT_SETTINGS)).toBe(false)
  })
})
