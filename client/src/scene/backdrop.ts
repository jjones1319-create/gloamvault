import * as THREE from 'three'
import type { Stage } from './stage.ts'

/**
 * The title backdrop: a torch-lit stone hall in the Cellars palette (11-ART-PIPELINE §1: warm browns and rust),
 * built from boxes with toon materials. Cheap on purpose (about a dozen draw calls, two dynamic lights, fog) so
 * the first thing the phone renders is also the first thing the performance overlay can measure.
 */
const PALETTE = {
  fog: 0x120f14,
  floor: 0x2b2730,
  pillar: 0x4a4650,
  arch: 0x3b3742,
  wood: 0x6b4a2b,
  flame: 0xffb347,
  torchLight: 0xffa040,
  skyLight: 0x3a3550,
  groundLight: 0x1a1418,
} as const

export function buildTitleBackdrop(stage: Stage): void {
  const { scene, camera } = stage
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.055)

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const keep = <T extends THREE.BufferGeometry>(g: T): T => (geometries.push(g), g)
  const mat = (color: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => {
    const m = new THREE.MeshToonMaterial({ color, ...extra })
    materials.push(m)
    return m
  }

  // Floor and a low back wall.
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(40, 40)), mat(PALETTE.floor))
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  const back = new THREE.Mesh(keep(new THREE.BoxGeometry(14, 5, 0.6)), mat(PALETTE.arch))
  back.position.set(0, 2.5, -9)
  scene.add(back)

  // Two rows of pillars, instanced.
  const pillarGeo = keep(new THREE.BoxGeometry(0.9, 4.2, 0.9))
  const pillars = new THREE.InstancedMesh(pillarGeo, mat(PALETTE.pillar), 8)
  const m4 = new THREE.Matrix4()
  let i = 0
  for (const z of [-7, -4, -1, 2]) {
    for (const x of [-3.2, 3.2]) {
      m4.makeTranslation(x, 2.1, z)
      pillars.setMatrixAt(i++, m4)
    }
  }
  pillars.instanceMatrix.needsUpdate = true
  scene.add(pillars)

  // An arch at the far end: two posts and a lintel.
  const postGeo = keep(new THREE.BoxGeometry(0.7, 3.6, 0.7))
  const archMat = mat(PALETTE.arch)
  for (const x of [-1.6, 1.6]) {
    const post = new THREE.Mesh(postGeo, archMat)
    post.position.set(x, 1.8, -8.6)
    scene.add(post)
  }
  const lintel = new THREE.Mesh(keep(new THREE.BoxGeometry(4, 0.6, 0.7)), archMat)
  lintel.position.set(0, 3.9, -8.6)
  scene.add(lintel)

  // Two torches on the nearest pillars: a wooden stub, a flame, a point light.
  const torchGeo = keep(new THREE.BoxGeometry(0.12, 0.7, 0.12))
  const flameGeo = keep(new THREE.OctahedronGeometry(0.22, 0))
  const woodMat = mat(PALETTE.wood)
  const flameMat = mat(PALETTE.flame, { emissive: PALETTE.flame, emissiveIntensity: 1.6 })
  const lights: { light: THREE.PointLight; flame: THREE.Mesh; phase: number }[] = []
  for (const x of [-2.6, 2.6]) {
    const stub = new THREE.Mesh(torchGeo, woodMat)
    stub.position.set(x, 2.3, 2.5)
    stub.rotation.z = x < 0 ? -0.35 : 0.35
    scene.add(stub)
    const flame = new THREE.Mesh(flameGeo, flameMat)
    flame.position.set(x * 1.06, 2.78, 2.5)
    scene.add(flame)
    const light = new THREE.PointLight(PALETTE.torchLight, 14, 10, 2)
    light.position.copy(flame.position)
    scene.add(light)
    lights.push({ light, flame, phase: x })
  }
  const hemi = new THREE.HemisphereLight(PALETTE.skyLight, PALETTE.groundLight, 1.1)
  scene.add(hemi)

  // Dust motes drifting in the torchlight.
  const MOTES = 80
  const positions = new Float32Array(MOTES * 3)
  for (let n = 0; n < MOTES; n++) {
    positions[n * 3] = (Math.random() - 0.5) * 8
    positions[n * 3 + 1] = Math.random() * 3.5
    positions[n * 3 + 2] = -6 + Math.random() * 10
  }
  const moteGeo = keep(new THREE.BufferGeometry())
  moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const moteTex = emberTexture()
  const moteMat = new THREE.PointsMaterial({
    color: PALETTE.flame,
    map: moteTex,
    size: 0.09,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  materials.push(moteMat)
  stage.own(() => moteTex.dispose())
  const motes = new THREE.Points(moteGeo, moteMat)
  scene.add(motes)

  camera.position.set(0, 1.7, 7.5)
  camera.lookAt(0, 1.3, -2)

  stage.addUpdater((t) => {
    for (const { light, flame, phase } of lights) {
      const flicker = Math.sin(t * 0.011 + phase * 7) * 0.9 + Math.sin(t * 0.037 + phase * 3) * 0.6
      light.intensity = 13 + flicker
      const s = 1 + flicker * 0.06
      flame.scale.set(s, 1 + flicker * 0.12, s)
      flame.rotation.y = t * 0.002 + phase
    }
    camera.position.x = Math.sin(t * 0.00025) * 0.35
    camera.position.y = 1.7 + Math.sin(t * 0.0004) * 0.06
    camera.lookAt(0, 1.3, -2)
    const p = moteGeo.getAttribute('position') as THREE.BufferAttribute
    const arr = p.array as Float32Array
    for (let n = 0; n < MOTES; n++) {
      const y = arr[n * 3 + 1] ?? 0
      arr[n * 3 + 1] = y > 3.6 ? 0 : y + 0.0012 * 16
      arr[n * 3] = (arr[n * 3] ?? 0) + Math.sin(t * 0.0007 + n) * 0.0015
    }
    p.needsUpdate = true
  })

  stage.own(() => {
    for (const g of geometries) g.dispose()
    for (const m of materials) m.dispose()
  })
}

/** A soft round sprite so the motes read as embers, not squares. */
function emberTexture(): THREE.Texture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// The motes use Math.random for their start positions: this is the client's scenery, never the sim (CLAUDE.md).
