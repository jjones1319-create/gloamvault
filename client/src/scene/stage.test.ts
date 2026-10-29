import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { MAX_PINNED_PROGRAMS, Stage } from './stage.ts'

/**
 * The stage's shader work (Phase 8) against a stand-in renderer (no WebGL in node): programs kept for the stage's life,
 * and a model's shaders compiled before it shows — its fading materials' see-through variant first.
 */
interface FakeProgram {
  usedTimes: number
}

function fakeStage(programs: FakeProgram[]) {
  const compiled: { transparent: boolean[] }[] = []
  const stage = Object.create(Stage.prototype) as Stage
  Object.assign(stage, {
    disposed: false,
    pinned: new Set(),
    camera: new THREE.PerspectiveCamera(),
    scene: new THREE.Scene(),
    renderer: {
      info: { programs },
      compileAsync: async (object: THREE.Object3D) => {
        const mats: THREE.Material[] = []
        object.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined
          if (m) mats.push(m)
        })
        compiled.push({ transparent: mats.map((m) => m.transparent) })
        return object
      },
    },
  })
  return { stage, compiled }
}

describe('the stage keeps its shader programs (Phase 8)', () => {
  it('each program is kept once (three.js frees a program with its last material; a monster met again recompiled)', () => {
    const programs: FakeProgram[] = [{ usedTimes: 1 }, { usedTimes: 2 }]
    const { stage } = fakeStage(programs)
    stage.pinPrograms()
    stage.pinPrograms()
    expect(programs.map((p) => p.usedTimes)).toEqual([2, 3])
  })

  it('no more than the cap', () => {
    const programs: FakeProgram[] = Array.from({ length: MAX_PINNED_PROGRAMS + 5 }, () => ({ usedTimes: 1 }))
    const { stage } = fakeStage(programs)
    stage.pinPrograms()
    expect(programs.filter((p) => p.usedTimes === 2)).toHaveLength(MAX_PINNED_PROGRAMS)
  })
})

describe('a model’s shaders compile before it shows (Phase 8)', () => {
  it('the fading materials compile see-through first, then as they are; the others as they are', async () => {
    const body = new THREE.MeshToonMaterial()
    body.name = 'gv-palette'
    const outline = new THREE.MeshBasicMaterial()
    outline.name = 'gv-outline'
    const other = new THREE.MeshBasicMaterial()
    const root = new THREE.Group()
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), body), new THREE.Mesh(new THREE.BoxGeometry(), outline), new THREE.Mesh(new THREE.BoxGeometry(), other))
    const versions = [body.version, outline.version]
    const { stage, compiled } = fakeStage([])
    await stage.warm(root, { fades: (m) => m.name === 'gv-palette' || m.name === 'gv-outline' })
    expect(compiled).toEqual([{ transparent: [true, true, false] }, { transparent: [false, false, false] }])
    expect(body.transparent).toBe(false)
    expect(body.version).toBeGreaterThan(versions[0]!)
    expect(outline.version).toBeGreaterThan(versions[1]!)
  })

  it('without fades it compiles once; a disposed stage compiles nothing', async () => {
    const root = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    const a = fakeStage([])
    await a.stage.warm(root)
    expect(a.compiled).toHaveLength(1)
    const b = fakeStage([])
    Object.assign(b.stage, { disposed: true })
    await b.stage.warm(root)
    expect(b.compiled).toHaveLength(0)
  })
})
