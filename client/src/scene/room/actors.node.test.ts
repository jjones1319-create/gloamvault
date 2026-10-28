import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActorLayer, type ActorInput, type ActorLook, type ActorState } from './actors.ts'
import type { Kit } from './kit.ts'

/**
 * The actor layer in node (no renderer): the bars over a fight follow the HUD's cues first and the sim's word after,
 * and an actor whose look is replaced mid-fight (its monster table or model arrived, a boss changed phase) keeps the
 * bar it showed instead of taking the sim's HP at once — else the beats still to play would count their hits twice.
 */
function testKit(): Kit {
  const ramp = new THREE.DataTexture(new Uint8Array([60, 160, 255]), 3, 1, THREE.RedFormat)
  const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    cyl5: new THREE.CylinderGeometry(1, 1, 1, 6, 1),
    bowl: new THREE.CylinderGeometry(1, 0.6, 1, 12, 1),
    cone: new THREE.ConeGeometry(1, 1, 10, 1),
    ball: new THREE.IcosahedronGeometry(1, 1),
    rock: new THREE.DodecahedronGeometry(1, 0),
    plane: new THREE.PlaneGeometry(1, 1),
    disc: new THREE.CircleGeometry(1, 18),
    ring: new THREE.TorusGeometry(1, 0.08, 6, 20),
    floorRing: new THREE.RingGeometry(0.78, 1, 32),
  }
  const toon = () => new THREE.MeshToonMaterial({ gradientMap: ramp })
  return {
    geo,
    mat: { wall: toon(), floor: toon(), prop: toon(), banner: toon(), glow: new THREE.MeshBasicMaterial(), flame: new THREE.MeshBasicMaterial() },
    tex: { blob: new THREE.Texture(), ramp },
    dispose() {},
  }
}

function look(key: string): ActorLook {
  return { id: 'spider-1', side: 'enemy', kind: 'monster', height: 0.8, radius: 0.4, shape: 'spider', body: 0x6b5040, trim: 0x2a2020, face: 0, eyes: 0xff4040, model: { key, build: () => Promise.resolve(null) } }
}

const input = (key: string, hp: number): ActorInput => ({ look: look(key), state: { hp, maxHp: 31, down: false, gone: false } satisfies ActorState, mark: { x: 2, z: 0, yaw: -Math.PI / 2 } })
const bar = (layer: ActorLayer) => (layer as unknown as { views: Map<string, { hpTarget: number }> }).views.get('spider-1')!.hpTarget
const fightSet = { instant: false, stateNow: false, showBars: true, turnId: null }

describe('the actor layer in a fight', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays the hits as cues and takes the sim’s HP once they go quiet', () => {
    vi.useFakeTimers()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    layer.set([input('spider|a', 31)], { ...fightSet, instant: true, stateNow: true })
    expect(bar(layer)).toBeCloseTo(1)
    // The sim has stepped (31 → 14); the HUD plays the two hits.
    layer.set([input('spider|a', 14)], fightSet)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 9 })
    expect(bar(layer)).toBeCloseTo(22 / 31)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    vi.advanceTimersByTime(1000)
    expect(bar(layer)).toBeCloseTo(14 / 31)
    layer.dispose()
  })

  it('keeps the bar it showed when its look is replaced mid-fight (no hit counted twice)', () => {
    vi.useFakeTimers()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    layer.set([input('capsule', 31)], { ...fightSet, instant: true, stateNow: true })
    layer.set([input('capsule', 14)], fightSet)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 9 })
    // The monster table lands between the beats: the stand-in becomes the spider model.
    layer.set([input('spider|a', 14)], fightSet)
    expect(bar(layer)).toBeCloseTo(22 / 31)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    vi.advanceTimersByTime(1000)
    expect(bar(layer)).toBeCloseTo(14 / 31)
    layer.dispose()
  })

  it('starts a fight’s bars where the HUD’s meters are and lets each beat set them (the opening blows counted once)', () => {
    vi.useFakeTimers()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    // The fight opened with two blows on the spider: the sim says 14, the HUD has yet to play them (it shows 31).
    layer.set([{ ...input('spider|a', 14), shownHp: 31 }], { ...fightSet, instant: true, stateNow: true })
    expect(bar(layer)).toBeCloseTo(1)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 9, hp: 22, maxHp: 31 })
    expect(bar(layer)).toBeCloseTo(22 / 31)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8, hp: 14, maxHp: 31 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    // A cue that says where the beat leaves the bar is never counted twice, whatever the bar showed before it.
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8, hp: 14, maxHp: 31 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    vi.advanceTimersByTime(1000)
    expect(bar(layer)).toBeCloseTo(14 / 31)
    layer.dispose()
  })
})
