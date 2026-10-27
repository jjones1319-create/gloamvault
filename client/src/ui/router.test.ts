import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './router.ts'

describe('hash router', () => {
  it('an empty hash is the title', () => {
    expect(parseHash('')).toEqual({ screen: 'title', params: {} })
    expect(parseHash('#')).toEqual({ screen: 'title', params: {} })
  })

  it('a bare word is a screen', () => {
    expect(parseHash('#settings').screen).toBe('settings')
    expect(parseHash('#phone').screen).toBe('phone')
    expect(parseHash('#town').screen).toBe('town')
  })

  it('a deep link names its screen with the first known key (07 §8.3)', () => {
    const r = parseHash('#delve=gravehollow&zone=1&seed=17&party=warden,mender&auto=1')
    expect(r.screen).toBe('delve')
    expect(r.params).toEqual({ delve: 'gravehollow', zone: '1', seed: '17', party: 'warden,mender', auto: '1' })
  })

  it('an unknown word falls back to the title and keeps its params', () => {
    const r = parseHash('#nowhere=1&x=2')
    expect(r.screen).toBe('title')
    expect(r.params).toEqual({ nowhere: '1', x: '2' })
  })

  it('bad percent-encoding does not throw', () => {
    expect(parseHash('#delve=%E0%A4%A&zone=1').screen).toBe('delve')
  })

  it('round-trips through routeToHash', () => {
    const hash = routeToHash('delve', { delve: 'gravehollow', zone: '1', seed: '17' })
    expect(hash).toBe('#delve=gravehollow&zone=1&seed=17')
    expect(parseHash(hash)).toEqual({ screen: 'delve', params: { delve: 'gravehollow', zone: '1', seed: '17' } })
    expect(routeToHash('settings')).toBe('#settings')
    expect(routeToHash('autoplay', { autoplay: '1', minutes: '30' })).toBe('#autoplay&minutes=30')
    expect(parseHash('#autoplay&minutes=30')).toEqual({ screen: 'autoplay', params: { autoplay: '1', minutes: '30' } })
  })
})
