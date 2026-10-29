import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BAR_COLOURS, reachAbove, standInBounds } from './actors.ts'

function skinned(): { mesh: THREE.SkinnedMesh; root: THREE.Group } {
  const geo = new THREE.BoxGeometry(0.6, 1.8, 0.4).translate(0, 0.9, 0)
  const n = geo.getAttribute('position').count
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4))
  const bone = new THREE.Bone()
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial())
  mesh.add(bone)
  mesh.bind(new THREE.Skeleton([bone]))
  const root = new THREE.Group()
  root.add(mesh)
  return { mesh, root }
}

describe('actors’ bounds (Phase 8)', () => {
  it('a skinned mesh gets its rest bounds and is never culled (three.js would skin every vertex on the CPU)', () => {
    const { mesh, root } = skinned()
    expect(mesh.boundingSphere).toBeNull()
    root.traverse(standInBounds)
    expect(mesh.frustumCulled).toBe(false)
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(0.9)
    expect(mesh.boundingBox!.max.y).toBeCloseTo(1.8, 5)
  })

  it('how high a model reaches above its stand, raised arms (a bone moved up) included', () => {
    const { mesh, root } = skinned()
    const stand = new THREE.Group()
    stand.position.set(3, 2, -1)
    stand.add(root)
    expect(reachAbove(root, stand)).toBeCloseTo(1.8, 1)
    mesh.skeleton.bones[0]!.position.y = 1.2
    expect(reachAbove(root, stand)).toBeCloseTo(3.0, 1)
  })

  it('the three palettes tell friend from foe on the 3D bars', () => {
    for (const p of Object.values(BAR_COLOURS)) expect(p.party).not.toBe(p.enemy)
    expect(BAR_COLOURS.redGreen.party).not.toBe(BAR_COLOURS.standard.party)
  })
})
