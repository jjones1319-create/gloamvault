import { beforeAll, describe, expect, it } from 'vitest'
import { readContentFiles } from '../../tools/sim/loadContent.ts'
import * as bridge from '../src/bridge.ts'
import { buildContent } from '../src/content.ts'
import { createDelve, hashDelve, runDelveAuto } from '../src/delve.ts'

/** The bridge the Unity app calls (D-139, Phase 10): strings in and out, the state kept behind handles. */
describe('the bridge', () => {
  const files = readContentFiles('content')
  const contentJson = JSON.stringify(files)
  const request = { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, auto: true, party: [{ classId: 'warden' }, { classId: 'mender' }] }

  beforeAll(() => {
    bridge.init(contentJson)
  })

  it('init indexes the raw files and reports the counts', () => {
    const info = JSON.parse(bridge.init(contentJson)) as Record<string, number>
    expect(info['bridge']).toBe(bridge.BRIDGE_VERSION)
    expect(info['files']).toBe(files.length)
    expect(info['class']).toBeGreaterThanOrEqual(6)
    expect(info['dungeon']).toBeGreaterThanOrEqual(1)
  })

  it('plays a delve to the same hash as the sim called directly (the CLI\'s heroes)', () => {
    const h = bridge.createDelve(JSON.stringify(request))
    let r = { over: false, commands: 0 }
    for (let i = 0; i < 500 && !r.over; i++) r = JSON.parse(bridge.step(h, '{"kind":"auto"}')) as typeof r
    expect(r.over).toBe(true)

    const content = buildContent(files)
    const state = createDelve(content, { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook' }, bridge.createParty(content, 17, request.party))
    runDelveAuto(content, state)
    expect(bridge.hash(h)).toBe(hashDelve(state))
    expect(JSON.parse(bridge.summary(h))).toMatchObject({ commands: state.commandLog.length })
    bridge.dispose(h)
  })

  it('keeps delves apart by handle, and a disposed handle is gone', () => {
    const a = bridge.createDelve(JSON.stringify(request))
    const b = bridge.createDelve(JSON.stringify({ ...request, seed: 18 }))
    expect(a).not.toBe(b)
    expect(bridge.hash(a)).not.toBe(bridge.hash(b))
    bridge.step(a, '{"kind":"auto"}')
    expect(JSON.parse(bridge.logSince(a, 0)).length).toBeGreaterThan(0)
    expect(JSON.parse(bridge.phase(b))).toHaveProperty('kind')
    bridge.dispose(a)
    expect(() => bridge.hash(a)).toThrow(/no delve with handle/)
    bridge.dispose(b)
  })

  it('offers the legal commands as JSON', () => {
    const h = bridge.createDelve(JSON.stringify(request))
    const actions = JSON.parse(bridge.legal(h)) as { command: { kind: string }; enabled: boolean }[]
    expect(actions.some((a) => a.enabled)).toBe(true)
    bridge.dispose(h)
  })

  it('says what is wrong with bad input', () => {
    expect(() => bridge.createDelve('{')).toThrow(/delve request: invalid JSON/)
    expect(() => bridge.createDelve(JSON.stringify({ ...request, dungeonId: 'nowhere' }))).toThrow(/no dungeon "nowhere"/)
    expect(() => bridge.createDelve(JSON.stringify({ ...request, party: [{ classId: 'jester' }] }))).toThrow(/no class "jester"/)
    const h = bridge.createDelve(JSON.stringify(request))
    expect(() => bridge.step(h, '{"kind":"move","toRoomId":"nowhere"}')).toThrow()
    bridge.dispose(h)
  })
})
