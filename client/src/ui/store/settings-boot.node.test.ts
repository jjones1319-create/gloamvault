import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../../save/db.ts'
import { DEFAULT_SETTINGS, writeSettings } from '../../save/settings.ts'
import { bootSettings, settings } from './settings.ts'

function prefersReduced(on: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('prefers-reduced-motion: reduce') }))
}

describe('Phase 8: the first run follows the phone’s reduce-motion choice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('nothing saved yet and the phone asks for less motion: Reduce motion starts on', async () => {
    prefersReduced(true)
    await bootSettings(memoryStore())
    expect(settings.value.reduceMotion).toBe(true)
  })

  it('a saved choice wins over the phone’s', async () => {
    prefersReduced(true)
    const store = memoryStore()
    await writeSettings(store, { ...DEFAULT_SETTINGS, reduceMotion: false })
    await bootSettings(store)
    expect(settings.value.reduceMotion).toBe(false)
  })

  it('without the media query (or the phone not asking), the default stands', async () => {
    prefersReduced(false)
    await bootSettings(memoryStore())
    expect(settings.value.reduceMotion).toBe(false)
  })
})
