import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { assembleRigged } from '../characters/assembler.ts'
import { frameTemplate, type FrameTemplate } from '../characters/template.ts'
import { parseMonsterClips, parseMonsterManifest, resolveMonsterVariant, variantKey, variantPalette, type MonsterManifest, type MonsterVariant } from './manifest.ts'
import { MonsterModel, PropModel, prepareVariant } from './model.ts'
import { attachmentFor, attachTransform, readAttach, TELL_SHAPES, tellDelta } from './wear.ts'

/**
 * What a monster wears and swells, on the real files (client/public/models/): Sister Naesa's Ascension with the
 * tentacle base's arms on her upper arms instead of the costume's sleeves, the Bursting Corpse's belly as a live morph,
 * and the Hollow King risen without his throne while the throne stands on its own. Skipped while the files are missing.
 */
const DIR = path.resolve('client/public/models/monsters')
const HERO = path.resolve('client/public/models/hero/hero_broad.glb')
const have = (base: string) => existsSync(path.join(DIR, `${base}.glb`))
const ready = existsSync(path.join(DIR, 'manifest.json')) && existsSync(HERO)
const manifest: MonsterManifest | null = ready ? parseMonsterManifest(JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'))) : null
const clips = existsSync(path.join(DIR, 'clips.json')) ? parseMonsterClips(JSON.parse(readFileSync(path.join(DIR, 'clips.json'), 'utf8'))) : new Map()

function parseGlb(file: string): Promise<GLTF> {
  const buf = readFileSync(file)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject))
}

let tpl: FrameTemplate | null = null
const glbs = new Map<string, GLTF>()
async function glb(base: string): Promise<GLTF> {
  let g = glbs.get(base)
  if (!g) glbs.set(base, (g = await parseGlb(path.join(DIR, `${base}.glb`))))
  return g
}

/** A hero-rig monster as the library assembles it (no clips in node), with `props` its rigid props or none. */
async function heroRig(v: MonsterVariant, props = true): Promise<{ model: MonsterModel; meshes: THREE.Mesh[] }> {
  const proto = prepareVariant(v, await glb(v.base), clips.get(v.base) ?? new Map())
  const inner = assembleRigged(proto.meshes, tpl!, null, { palette: variantPalette(v), morphs: v.shapes, scale: v.scale, key: variantKey(v), boneScales: v.boneScales })
  return { model: MonsterModel.fromCharacter(v, inner, props ? proto.props : []), meshes: proto.meshes }
}

async function ownRig(v: MonsterVariant): Promise<MonsterModel> {
  return MonsterModel.fromProto(v, prepareVariant(v, await glb(v.base), clips.get(v.base) ?? new Map()), null)
}

const resolve = (id: string, phase = 1) => resolveMonsterVariant(id, manifest, null, have, phase)!

describe.skipIf(!ready || !have('humanoid') || !have('tentacle'))('Sister Naesa wears her tentacle arms (06 §3.3)', () => {
  beforeAll(async () => {
    tpl = frameTemplate('broad', await parseGlb(HERO))
  })

  it('from her second phase only, and the arm says where it goes', () => {
    expect(attachmentFor('sister-naesa', 1)).toBeNull()
    expect(attachmentFor('sister-naesa', 2)?.variant).toBe('naesa-arm')
    expect(attachmentFor('barrow-warden', 2)).toBeNull()
    const spec = readAttach(resolve('naesa-arm').raw)
    expect(spec?.sockets).toEqual(['LeftUpperArm', 'RightUpperArm'])
    expect(readAttach({ attach: { sockets: [] } })).toBeNull()
    expect(readAttach(null)).toBeNull()
  })

  it('each arm hangs from its upper arm along the bone, the sleeves gone, and plays the wearer’s clips', async () => {
    const v = resolve('sister-naesa', 2)
    const worn = attachmentFor(v.id, v.phase)!
    const body = { ...v, parts: v.parts!.filter((p) => !worn.replaces.includes(p)) }
    expect(body.parts).not.toContain('humanoid_naesa2_tentacle_L')
    const { model, meshes } = await heroRig(body)
    expect(meshes.some((m) => /tentacle/.test(m.name))).toBe(false)
    const armV = resolve('naesa-arm')
    const arms = [await ownRig(armV), await ownRig(armV)]
    model.wear(arms, ['LeftUpperArm', 'RightUpperArm'])
    model.root.updateMatrixWorld(true)
    for (const [i, side] of ['Left', 'Right'].entries()) {
      const arm = arms[i]!
      expect(arm.root.parent?.name).toBe(`${side}UpperArm`)
      const bone = arm.root.parent!
      const head = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
      const tail = new THREE.Vector3().setFromMatrixPosition(bone.children.find((c) => (c as THREE.Bone).isBone)!.matrixWorld)
      const along = tail.sub(head).normalize()
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(arm.root.getWorldQuaternion(new THREE.Quaternion()))
      expect(up.dot(along)).toBeGreaterThan(0.999)
      // 0.6 × the wearer (06: "tentacle base 0.6"), the wearer at her Ascension's 1.28.
      const s = new THREE.Vector3().setFromMatrixScale(arm.root.children[0]!.matrixWorld).x
      expect(s).toBeCloseTo(0.6 * v.scale, 3)
      // The arm reaches down past her hips, as the attach render shows.
      const box = new THREE.Box3().setFromObject(arm.root)
      expect(box.min.y).toBeLessThan(head.y - 0.8)
    }
    // Her clips reach the arms (the Embrace is the arm's grab-wrap); a flash and a fade too.
    const played: string[] = []
    for (const arm of arms) {
      const play = arm.animator.play.bind(arm.animator)
      arm.animator.play = (name, opts) => {
        played.push(name)
        return play(name, opts)
      }
    }
    model.animator.play('Embrace')
    expect(played).toEqual(['Embrace', 'Embrace'])
    expect(arms[0]!.animator.has('Embrace')).toBe(true)
    model.setOpacity(0.5)
    model.update(100)
    model.dispose()
    expect(arms[0]!.root.parent).toBeNull()
  })

  it('a bone with no child cannot carry an arm', () => {
    const lone = new THREE.Bone()
    lone.updateMatrixWorld(true)
    expect(attachTransform(lone, 1)).toBeNull()
  })
})

describe.skipIf(!ready || !have('zombie'))('the Bursting Corpse swells on its tell (06 §3.2)', () => {
  beforeAll(async () => {
    tpl ??= frameTemplate('broad', await parseGlb(HERO))
  })

  it('its belly is a live morph from 1.0 to 1.35, the outline swelling with it', async () => {
    const v = resolve('bursting-corpse')
    const { model, meshes } = await heroRig(v)
    const delta = tellDelta(meshes, tpl!, v.shapes, TELL_SHAPES['bursting-corpse']!)
    expect(delta).not.toBeNull()
    model.setTellShape(delta)
    expect(model.hasTell()).toBe(true)
    const inner = (model as unknown as { inner: { mesh: THREE.SkinnedMesh; outline: THREE.SkinnedMesh } }).inner
    expect(inner.mesh.geometry.morphAttributes.position).toHaveLength(1)
    expect(inner.outline.morphTargetInfluences).toBe(inner.mesh.morphTargetInfluences)
    model.setTell(2)
    expect(inner.mesh.morphTargetInfluences![0]).toBe(1)
    model.setTell(0.5)
    expect(inner.outline.morphTargetInfluences![0]).toBe(0.5)
    // The most-moved vertex is on the belly, in front, between the hips and the chest.
    const pos = inner.mesh.geometry.getAttribute('position')
    let best = 0
    let at = 0
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(delta![i * 3]!, delta![i * 3 + 1]!, delta![i * 3 + 2]!)
      if (d > best) {
        best = d
        at = i
      }
    }
    expect(best).toBeGreaterThan(0.02)
    expect(pos.getY(at)).toBeGreaterThan(0.8)
    expect(pos.getY(at)).toBeLessThan(1.4)
    model.dispose()
  })

  it('a monster without a tell shape ignores it, and a wrong-sized shape is refused', async () => {
    const { model } = await heroRig(resolve('shambling-corpse'))
    model.setTellShape(new Float32Array(9))
    expect(model.hasTell()).toBe(false)
    model.setTell(1)
    model.dispose()
  })
})

describe.skipIf(!ready || !have('hollow-king'))('the Hollow King’s throne (06 §3.4)', () => {
  beforeAll(async () => {
    tpl ??= frameTemplate('broad', await parseGlb(HERO))
  })

  const names = (o: THREE.Object3D) => {
    const out: string[] = []
    o.traverse((x) => {
      if ((x as THREE.Mesh).isMesh && !x.name.endsWith('-outline')) out.push(x.name.replace(/_\d+$/, ''))
    })
    return out
  }

  it('seated, he carries it; risen, it stands on its own on its column and he goes without it', async () => {
    const seated = resolve('hollow-king', 1)
    const risen = resolve('hollow-king', 2)
    expect(risen.throne?.raised).toBe(true)
    const king1 = (await heroRig(seated)).model
    expect(names(king1.root)).toContain('hollow-king_throne_seat')
    const king2 = (await heroRig(risen, false)).model
    expect(names(king2.root).some((n) => /throne/.test(n))).toBe(false)
    const proto = prepareVariant({ ...risen, parts: [] }, await glb('hollow-king'), new Map())
    expect(proto.meshes).toHaveLength(0)
    const throne = PropModel.of(risen, proto.props)
    expect(names(throne.root)).toEqual(expect.arrayContaining(['hollow-king_throne_seat', 'hollow-king_throne_column']))
    expect(throne.root.scale.x).toBe(risen.scale)
    expect(throne.triangles).toBeGreaterThan(1000)
    // The seat sits on the column: lifted by its height (at the King's unscaled size).
    const seat = throne.root.children.find((c) => /throne_seat/.test(c.name))!
    expect(seat.position.y).toBeGreaterThan(0.9)
    throne.dispose()
    king1.dispose()
    king2.dispose()
  })
})
