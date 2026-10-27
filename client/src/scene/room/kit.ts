import * as THREE from 'three'
import { bannerTexture, blobTexture, brickTexture, flagTexture, toonRamp } from './textures.ts'

/**
 * The grey-box kit (Phase 4): unit primitives and the handful of materials every room shares, made once for the
 * delve screen and freed with it. Rooms only build geometry; materials and textures persist across rooms, so a
 * room change compiles no shaders (the light count is fixed too).
 */
export const PALETTE = {
  fog: 0x17110e,
  brick: 0x7a5230,
  mortar: 0x5b5650,
  damp: 0x3f5a3a,
  amber: 0xe8a33c,
  trim: 0x4c433c,
  trimDark: 0x3a332e,
  stone: 0x6d655c,
  stoneDark: 0x4a443e,
  floor: 0x8a8279,
  wood: 0x6b4a2b,
  woodDark: 0x4e3520,
  woodLight: 0x8a6a42,
  iron: 0x3d3d45,
  ironLight: 0x5c5c66,
  straw: 0xa08a4a,
  bone: 0xd9d0b8,
  cloth: 0x7a2420,
  gold: 0xffc94a,
  flame: 0xffa53a,
  flameCore: 0xffe7a0,
  pit: 0x050405,
  water: 0x1d3436,
  glass: 0x2c4a32,
  burlap: 0x9a7d55,
  sky: 0x7a6a5e,
  ground: 0x1c1411,
  fireLight: 0xffa040,
  torchLight: 0xffbe70,
  waystone: 0x6c7480,
  waystoneGlow: 0x7fd4ff,
  doorGlow: 0xffb347,
  doorShut: 0x8a2f24,
  trapGlow: 0xff5a2a,
} as const

export interface Kit {
  geo: {
    box: THREE.BoxGeometry
    cyl: THREE.CylinderGeometry
    cyl5: THREE.CylinderGeometry
    bowl: THREE.CylinderGeometry
    cone: THREE.ConeGeometry
    ball: THREE.IcosahedronGeometry
    rock: THREE.DodecahedronGeometry
    plane: THREE.PlaneGeometry
    disc: THREE.CircleGeometry
    ring: THREE.TorusGeometry
    floorRing: THREE.RingGeometry
  }
  mat: {
    wall: THREE.MeshToonMaterial
    floor: THREE.MeshToonMaterial
    prop: THREE.MeshToonMaterial
    banner: THREE.MeshToonMaterial
    glow: THREE.MeshBasicMaterial
    flame: THREE.MeshBasicMaterial
  }
  tex: {
    blob: THREE.Texture
    ramp: THREE.DataTexture
  }
  dispose(): void
}

export function createKit(): Kit {
  const ramp = toonRamp()
  const brick = brickTexture()
  const flag = flagTexture()
  const banner = bannerTexture()
  const blob = blobTexture()
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
  const mat = {
    wall: new THREE.MeshToonMaterial({ map: brick, vertexColors: true, gradientMap: ramp }),
    floor: new THREE.MeshToonMaterial({ map: flag, gradientMap: ramp }),
    prop: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }),
    banner: new THREE.MeshToonMaterial({ map: banner, gradientMap: ramp, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    flame: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  }
  return {
    geo,
    mat,
    tex: { blob, ramp },
    dispose() {
      for (const g of Object.values(geo)) g.dispose()
      for (const m of Object.values(mat)) m.dispose()
      for (const t of [ramp, brick, flag, banner, blob]) t.dispose()
    },
  }
}
