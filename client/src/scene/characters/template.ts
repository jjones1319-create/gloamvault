import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BodyFrame } from '../../../../sim/src/types/enums.ts'

/**
 * A loaded hero file read into what the assembler clones from (the body, its skeleton and inverse bind matrices, the
 * species parts, the sockets' and bones' rest matrices). No loading here, so node tests can parse a .glb themselves.
 */
/** One body frame's file, read into what the assembler clones from. */
export interface FrameTemplate {
  frame: BodyFrame
  /** The armature's root node (`Rig`); its children are the Hips bone and the meshes. */
  rig: THREE.Object3D
  hips: THREE.Bone
  body: THREE.SkinnedMesh
  /** Skeleton bone names in skin order (the body's joints). */
  boneNames: string[]
  boneInverses: THREE.Matrix4[]
  /** Every other mesh in the file by name: species parts, hair and brow styles. */
  parts: Map<string, THREE.Mesh>
  /** Rest world matrices (the file's bind space) of the sockets and of every bone, by name. */
  rest: Map<string, THREE.Matrix4>
  /** A socket's parent bone, by socket name. */
  socketBone: Map<string, string>
  hipsRest: THREE.Vector3
  /** The left ankle's rest height above the floor (feet stay on the floor when the legs are rescaled). */
  ankleRestY: number
}

export function frameTemplate(frame: BodyFrame, gltf: GLTF): FrameTemplate | null {
  const scene = gltf.scene
  scene.updateMatrixWorld(true)
  let body: THREE.SkinnedMesh | null = null
  const meshes: THREE.Mesh[] = []
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (m.isSkinnedMesh && (m.name === 'Body' || m.name.startsWith('Body'))) body ??= m
    else if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  if (!body) return null
  const b = body as THREE.SkinnedMesh
  const bones = b.skeleton.bones
  const hips = bones.find((x) => x.name === 'Hips') ?? bones[0]
  if (!hips) return null
  const rig = hips.parent ?? scene
  const rest = new Map<string, THREE.Matrix4>()
  const socketBone = new Map<string, string>()
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.name.startsWith('Socket_')) rest.set(o.name, o.matrixWorld.clone())
    if (o.name.startsWith('Socket_') && o.parent) socketBone.set(o.name, o.parent.name)
  })
  const ankle = bones.find((x) => x.name === 'LeftFoot')
  const ankleRestY = ankle ? new THREE.Vector3().setFromMatrixPosition(ankle.matrixWorld).y : 0.08
  return {
    frame,
    rig,
    hips,
    body: b,
    boneNames: bones.map((x) => x.name),
    boneInverses: b.skeleton.boneInverses.map((m) => m.clone()),
    parts: new Map(meshes.filter((m) => !m.name.startsWith('Socket_')).map((m) => [m.name, m])),
    rest,
    socketBone,
    hipsRest: hips.position.clone(),
    ankleRestY,
  }
}

/** Every mesh of a file by node name (gear pieces, weapons). */
export function meshesOf(gltf: GLTF): Map<string, THREE.Mesh> {
  const out = new Map<string, THREE.Mesh>()
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !out.has(o.name)) out.set(o.name, o as THREE.Mesh)
  })
  return out
}

