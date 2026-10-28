import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { SLOT_ATTRIBUTE } from '../characters/material.ts'
import { parseMonsterClips, parseMonsterManifest, resolveMonsterVariant, type MonsterManifest } from './manifest.ts'
import { MonsterModel, prepareVariant } from './model.ts'

/**
 * Monsters from the real base files (client/public/models/monsters/), parsed in node: a variant's parts shown or
 * hidden, its shape keys baked, the palette slot decoded, one mixer playing its own clips under the heroes' names too,
 * the Deep Maw's ring of tentacles. Skipped while the files are missing.
 */
const DIR = path.resolve('client/public/models/monsters')
const haveManifest = existsSync(path.join(DIR, 'manifest.json'))
const manifest: MonsterManifest | null = haveManifest ? parseMonsterManifest(JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'))) : null
const clips = existsSync(path.join(DIR, 'clips.json')) ? parseMonsterClips(JSON.parse(readFileSync(path.join(DIR, 'clips.json'), 'utf8'))) : new Map()

function parseGlb(file: string): Promise<GLTF> {
  const buf = readFileSync(file)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject))
}

const has = (base: string) => existsSync(path.join(DIR, `${base}.glb`))

async function build(id: string): Promise<MonsterModel> {
  const v = resolveMonsterVariant(id, manifest, undefined, has)!
  const gltf = await parseGlb(path.join(DIR, `${v.base}.glb`))
  const proto = prepareVariant(v, gltf, clips.get(v.base) ?? new Map())
  const copies = v.instances ? prepareVariant({ ...v, parts: v.instances.spots[0]?.mesh ? [v.instances.spots[0].mesh] : [], instances: null, shapes: {} }, gltf, clips.get(v.base) ?? new Map()) : null
  return MonsterModel.fromProto(v, proto, copies)
}

function visibleMeshes(m: MonsterModel): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  m.root.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh && !o.name.endsWith('-outline')) out.push(o as THREE.Mesh)
  })
  return out
}

describe.skipIf(!haveManifest || !has('leech'))('monsters from the real files', () => {
  it('the Vault Leech: one skinned body in its palette, its own clips under both names, Death held', async () => {
    const m = await build('vault-leech')
    const meshes = visibleMeshes(m)
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every((x) => x.geometry.getAttribute(SLOT_ATTRIBUTE) !== undefined)).toBe(true)
    expect(m.height).toBeGreaterThan(0.3)
    const a = m.animator
    for (const name of ['Idle', 'Move', 'Attack1', 'Attack2', 'Hit', 'Death', 'Walk', 'Run', 'Attack_Light', 'Attack_Heavy', 'Downed']) expect(a.has(name), name).toBe(true)
    expect(a.eventTime('Attack1', 'hit')).toBeCloseTo(0.55)
    expect(a.eventTime('Attack_Light', 'hit')).toBeCloseTo(0.55)
    a.setBase('Walk')
    expect(a.play('Death', { hold: true })).toBe(true)
    m.update(5000)
    expect(a.isHolding()).toBe(true)
    m.dispose()
  })

  it.skipIf(!has('tentacle'))('the Deep Maw: the plate in the middle, five tentacles round it, each with its own mixer', async () => {
    const m = await build('deep-maw')
    const names = visibleMeshes(m).map((x) => x.name.replace(/_\d+$/, ''))
    expect(names.filter((n) => n === 'tentacle_maw')).toHaveLength(1)
    expect(names.filter((n) => n === 'tentacle_body')).toHaveLength(5)
    m.animator.setBase('Walk')
    m.animator.play('Attack2')
    m.update(300)
    m.dispose()
  })

  it.skipIf(!has('tentacle'))('Naesa’s arm has its shape key baked (and no morph cost left)', async () => {
    const arm = await build('naesa-arm')
    const plain = await build('deep-tentacle')
    const a = visibleMeshes(arm)[0]!.geometry
    const b = visibleMeshes(plain)[0]!.geometry
    expect(a.morphAttributes.position ?? []).toHaveLength(0)
    const pa = a.getAttribute('position')
    const pb = b.getAttribute('position')
    let moved = 0
    for (let i = 0; i < pa.count; i++) if (Math.abs(pa.getX(i) - pb.getX(i)) + Math.abs(pa.getY(i) - pb.getY(i)) + Math.abs(pa.getZ(i) - pb.getZ(i)) > 1e-4) moved++
    expect(moved).toBeGreaterThan(0)
    arm.dispose()
    plain.dispose()
  })

  it.skipIf(!has('wisp'))('the Vault Lantern shows its cage, the pet Wisp does not (node animation, hidden parts still in the tree)', async () => {
    const lantern = await build('vault-lantern')
    expect(visibleMeshes(lantern).some((x) => /cage/.test(x.name))).toBe(true)
    const v = manifest!.pets.get('wisp')!
    const gltf = await parseGlb(path.join(DIR, 'wisp.glb'))
    const pet = MonsterModel.fromProto(v, prepareVariant(v, gltf, clips.get('wisp') ?? new Map()), null)
    expect(visibleMeshes(pet).some((x) => /cage/.test(x.name))).toBe(false)
    let cage = false
    pet.root.traverse((o) => (cage ||= /cage/.test(o.name)))
    expect(cage).toBe(true)
    pet.animator.play('Attack1')
    pet.update(500)
    lantern.dispose()
    pet.dispose()
  })
})
