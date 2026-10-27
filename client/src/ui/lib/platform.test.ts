import { describe, expect, it } from 'vitest'
import { platformOf } from './platform.ts'

describe('platformOf', () => {
  it('recognises the S25 Ultra as Android', () => {
    expect(platformOf('Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 Chrome/142.0 Mobile Safari/537.36', 5)).toBe('android')
  })
  it('recognises iPhones and iPads', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe('ios')
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
  })
  it('a desktop is other', () => {
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0', 0)).toBe('other')
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other')
  })
})
