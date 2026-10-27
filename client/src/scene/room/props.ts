import * as THREE from 'three'
import { MeshBuilder, trs, within, type Tint } from './builder.ts'
import { PALETTE, type Kit } from './kit.ts'

/**
 * Grey-box props (Phase 4): each template `meshId` becomes a few primitives in the Cellars palette, merged into
 * the room's builders. Real kit meshes from Blender replace these in Phase 6; the meshId → shape mapping is by the
 * words in the id (barrel, crate, table, stairs, campfire, sconce …) so unknown ids still draw something.
 * A prop's local frame: +y up, its front is +z, the origin on the floor under its centre.
 */
export interface Pieces {
  kit: Kit
  /** Toon, vertex-coloured: wood, iron, stone, straw, cloth without a print. */
  props: MeshBuilder
  /** Brick-textured (pillars and low pen walls share the wall material). */
  walls: MeshBuilder
  /** The banner print. */
  cloth: MeshBuilder
  /** Additive glows: flames, the lit doorways, rings. */
  glow: MeshBuilder
  rnd: () => number
}

export type PropKind =
  | 'barrel'
  | 'cask'
  | 'crate'
  | 'table'
  | 'stairs'
  | 'fire'
  | 'sconce'
  | 'banner'
  | 'grate'
  | 'puddle'
  | 'beam'
  | 'pillar'
  | 'trapPlate'
  | 'cage'
  | 'nest'
  | 'lowWall'
  | 'shelf'
  | 'chestSmall'
  | 'chestLarge'
  | 'gold'
  | 'waystone'
  | 'tablet'
  | 'other'

const KIND_WORDS: readonly [RegExp, PropKind][] = [
  [/stair/, 'stairs'],
  [/campfire|brazier|hearth|fire/, 'fire'],
  [/sconce|torch/, 'sconce'],
  [/chest_large|chest_big/, 'chestLarge'],
  [/chest/, 'chestSmall'],
  [/gold|coin/, 'gold'],
  [/cask/, 'cask'],
  [/barrel/, 'barrel'],
  [/crate|sack|box/, 'crate'],
  [/table|bench/, 'table'],
  [/banner|flag/, 'banner'],
  [/grate|drain/, 'grate'],
  [/puddle|water/, 'puddle'],
  [/beam/, 'beam'],
  [/pillar|column/, 'pillar'],
  [/trap|plate/, 'trapPlate'],
  [/cage/, 'cage'],
  [/nest/, 'nest'],
  [/wall_low|half_wall|pen/, 'lowWall'],
  [/shelf|rack/, 'shelf'],
  [/waystone/, 'waystone'],
  [/tablet|plinth/, 'tablet'],
]

/** How much floor a prop takes (a radius in metres) for keeping the party and the fights clear of it; 0 = none. */
export const PROP_FOOTPRINT: Readonly<Record<PropKind, number>> = {
  barrel: 0.5,
  cask: 1.0,
  crate: 0.95,
  table: 1.6,
  stairs: 0,
  fire: 0.75,
  sconce: 0,
  banner: 0,
  grate: 0,
  puddle: 0,
  beam: 0,
  pillar: 0.45,
  trapPlate: 0,
  cage: 0,
  nest: 0.85,
  lowWall: 0.9,
  shelf: 1.2,
  chestSmall: 0.55,
  chestLarge: 0.8,
  gold: 0,
  waystone: 0.6,
  tablet: 0.6,
  other: 0.5,
}

export function propKind(meshId: string): PropKind {
  const id = meshId.toLowerCase()
  for (const [re, kind] of KIND_WORDS) if (re.test(id)) return kind
  return 'other'
}

const v = new THREE.Vector3()
function point(m: THREE.Matrix4, x: number, y: number, z: number): THREE.Vector3 {
  return v.set(x, y, z).applyMatrix4(m).clone()
}

function jitter(p: Pieces, hex: number, amount = 0.12): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(1 - amount / 2 + p.rnd() * amount)
}

/** Darker toward the floor and in a pit: cheap ambient occlusion through the vertex colours. */
export const groundShade: Tint = (_x, y, _z, out) => {
  const k = y < 0 ? Math.max(0.18, 1 + y * 0.32) : Math.min(1, 0.72 + y * 0.28)
  out.multiplyScalar(k)
}

export function addBarrel(p: Pieces, m: THREE.Matrix4): void {
  const { cyl } = p.kit.geo
  p.props.add(cyl, within(m, trs(0, 0.5, 0, 0, 0.42, 1, 0.42)), jitter(p, PALETTE.wood), groundShade)
  for (const y of [0.2, 0.8]) p.props.add(cyl, within(m, trs(0, y, 0, 0, 0.44, 0.07, 0.44)), PALETTE.iron)
  p.props.add(cyl, within(m, trs(0, 1.005, 0, 0, 0.36, 0.02, 0.36)), PALETTE.woodDark)
}

export function addCask(p: Pieces, m: THREE.Matrix4): void {
  const { cyl, box } = p.kit.geo
  for (const x of [-0.55, 0.55]) p.props.add(box, within(m, trs(x, 0.25, 0, 0, 0.22, 0.5, 1.5)), PALETTE.woodDark, groundShade)
  p.props.add(cyl, within(m, trs(0, 1.0, 0, 0, 0.85, 1.7, 0.85, 0, Math.PI / 2)), jitter(p, PALETTE.wood), groundShade)
  for (const x of [-0.62, 0.62]) p.props.add(cyl, within(m, trs(x, 1.0, 0, 0, 0.87, 0.08, 0.87, 0, Math.PI / 2)), PALETTE.iron)
  p.props.add(cyl, within(m, trs(0.88, 0.75, 0, 0, 0.06, 0.12, 0.06, 0, Math.PI / 2)), PALETTE.ironLight)
}

export function addCrates(p: Pieces, m: THREE.Matrix4): void {
  const { box } = p.kit.geo
  const pieces: [number, number, number, number, number][] = [
    [-0.47, 0.45, 0, 0.1, 0.9],
    [0.47, 0.45, 0.05, -0.12, 0.9],
    [0.02, 1.3, 0.02, 0.25, 0.8],
  ]
  for (const [x, y, z, yaw, s] of pieces) {
    p.props.add(box, within(m, trs(x, y, z, yaw, s, s, s)), jitter(p, PALETTE.woodLight, 0.2), groundShade)
    // Nailed slats: a darker band across each face.
    p.props.add(box, within(m, trs(x, y, z, yaw, s * 1.02, s * 0.14, s * 1.02)), PALETTE.woodDark)
  }
}

export function addTable(p: Pieces, m: THREE.Matrix4): void {
  const { box, cyl } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.8, 0, 0, 4, 0.1, 1)), jitter(p, PALETTE.wood), groundShade)
  for (const x of [-1.6, 1.6]) p.props.add(box, within(m, trs(x, 0.375, 0, 0, 0.1, 0.75, 0.8)), PALETTE.woodDark, groundShade)
  for (const z of [-0.85, 0.85]) {
    p.props.add(box, within(m, trs(0, 0.45, z, 0, 3.6, 0.08, 0.32)), PALETTE.woodDark, groundShade)
    for (const x of [-1.5, 1.5]) p.props.add(box, within(m, trs(x, 0.22, z, 0, 0.08, 0.44, 0.28)), PALETTE.woodDark, groundShade)
  }
  // Mugs and a plate on the board.
  for (const [x, z] of [
    [-1.1, 0.2],
    [0.3, -0.25],
    [1.2, 0.1],
  ] as const)
    p.props.add(cyl, within(m, trs(x, 0.93, z, 0, 0.07, 0.16, 0.07)), PALETTE.ironLight)
  p.props.add(cyl, within(m, trs(-0.4, 0.86, 0.15, 0, 0.18, 0.02, 0.18)), PALETTE.bone)
}

/** The local footprint of a stair pit (07 §2.2: a 4 m stair block into a black fade). */
export const STAIRS_PIT = { x0: -2, z0: -2.5, x1: 2, z1: 1.5 } as const

export function addStairsDown(p: Pieces, m: THREE.Matrix4): void {
  const { box } = p.kit.geo
  for (let i = 0; i < 8; i++) {
    const top = -(i + 1) * 0.24
    const zc = STAIRS_PIT.z1 - 0.25 - i * 0.5
    const h = 3 + top
    p.props.add(box, within(m, trs(0, top - h / 2, zc, 0, 3.6, h, 0.5)), jitter(p, PALETTE.stone, 0.08), groundShade)
  }
  // The pit's walls, its black bottom, and a stone kerb round the top so it reads as a stairwell.
  for (const x of [-1.9, 1.9]) p.props.add(box, within(m, trs(x, -1.5, -0.5, 0, 0.2, 3, 4)), PALETTE.stoneDark, groundShade)
  p.props.add(box, within(m, trs(0, -1.5, -2.4, 0, 4, 3, 0.2)), PALETTE.stoneDark, groundShade)
  p.props.add(box, within(m, trs(0, -2.35, -0.5, 0, 3.8, 0.1, 4)), PALETTE.pit)
  for (const x of [-2.12, 2.12]) p.props.add(box, within(m, trs(x, 0.22, -0.5, 0, 0.26, 0.44, 4.1)), PALETTE.trim)
  p.props.add(box, within(m, trs(0, 0.22, -2.62, 0, 4.5, 0.44, 0.26)), PALETTE.trim)
}

/** The entrance's stairs: the way the party came down, rising to a dark opening in the wall. */
export function addStairsUp(p: Pieces, m: THREE.Matrix4): void {
  const { box } = p.kit.geo
  for (let i = 0; i < 6; i++) {
    const h = (i + 1) * 0.3
    const zc = STAIRS_PIT.z1 - 0.25 - i * 0.5
    p.props.add(box, within(m, trs(0, h / 2, zc, 0, 3, h, 0.5)), jitter(p, PALETTE.stone, 0.08), groundShade)
  }
  p.props.add(box, within(m, trs(0, 0.9, -2.05, 0, 3, 1.8, 0.9)), PALETTE.stone, groundShade)
  for (const x of [-1.62, 1.62]) p.props.add(box, within(m, trs(x, 1.1, -0.5, 0, 0.24, 2.2, 4)), PALETTE.trim, groundShade)
  p.props.add(box, within(m, trs(0, 2.6, -2.44, 0, 2.2, 1.6, 0.12)), PALETTE.pit)
}

export function addCampfire(p: Pieces, m: THREE.Matrix4): THREE.Vector3 {
  const { rock, cyl, cone } = p.kit.geo
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.props.add(rock, within(m, trs(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, a, 0.19, 0.15, 0.19)), jitter(p, PALETTE.stoneDark, 0.2))
  }
  for (const yaw of [0, Math.PI / 3, (2 * Math.PI) / 3]) p.props.add(cyl, within(m, trs(0, 0.12, 0, yaw, 0.08, 0.95, 0.08, Math.PI / 2)), PALETTE.woodDark)
  p.glow.add(cone, within(m, trs(0, 0.5, 0, 0, 0.34, 0.8, 0.34)), PALETTE.flame)
  p.glow.add(cone, within(m, trs(0, 0.42, 0, 0.5, 0.19, 0.55, 0.19)), PALETTE.flameCore)
  return point(m, 0, 1.2, 0)
}

export function addBrazier(p: Pieces, m: THREE.Matrix4): THREE.Vector3 {
  const { cyl, bowl, cone, box } = p.kit.geo
  p.props.add(cyl, within(m, trs(0, 0.5, 0, 0, 0.06, 1, 0.06)), PALETTE.iron)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    p.props.add(box, within(m, trs(Math.cos(a) * 0.22, 0.15, Math.sin(a) * 0.22, -a, 0.5, 0.05, 0.06, 0, 0)), PALETTE.iron)
  }
  p.props.add(bowl, within(m, trs(0, 1.08, 0, 0, 0.5, 0.26, 0.5)), PALETTE.iron)
  p.glow.add(cone, within(m, trs(0, 1.5, 0, 0, 0.32, 0.65, 0.32)), PALETTE.flame)
  p.glow.add(cone, within(m, trs(0, 1.42, 0, 0.6, 0.18, 0.45, 0.18)), PALETTE.flameCore)
  return point(m, 0, 1.9, 0)
}

export function addSconce(p: Pieces, m: THREE.Matrix4, showMesh: boolean): THREE.Vector3 {
  const { box, cyl, cone } = p.kit.geo
  if (showMesh) {
    p.props.add(box, within(m, trs(0, 0, 0.06, 0, 0.09, 0.09, 0.34)), PALETTE.iron)
    p.props.add(box, within(m, trs(0, 0, -0.08, 0, 0.26, 0.34, 0.05)), PALETTE.iron)
    p.props.add(cyl, within(m, trs(0, 0.13, 0.22, 0, 0.045, 0.42, 0.045, -0.35)), PALETTE.woodDark)
    p.glow.add(cone, within(m, trs(0, 0.47, 0.3, 0, 0.11, 0.3, 0.11)), PALETTE.flame)
    p.glow.add(cone, within(m, trs(0, 0.43, 0.3, 0.4, 0.06, 0.18, 0.06)), PALETTE.flameCore)
  }
  return point(m, 0, 0.5, 0.3)
}

export function addBanner(p: Pieces, m: THREE.Matrix4): void {
  p.cloth.add(p.kit.geo.plane, within(m, trs(0, 0, 0.03, 0, 1.0, 1.9, 1)), 0xffffff)
  p.props.add(p.kit.geo.cyl, within(m, trs(0, 0.98, 0.04, 0, 0.03, 1.25, 0.03, 0, Math.PI / 2)), PALETTE.iron)
}

export function addGrate(p: Pieces, m: THREE.Matrix4): void {
  const { box } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.006, 0, 0, 1.25, 0.012, 1.25)), PALETTE.pit)
  for (let i = -2; i <= 2; i++) p.props.add(box, within(m, trs(i * 0.24, 0.025, 0, 0, 0.06, 0.04, 1.25)), PALETTE.iron)
  for (const z of [-0.64, 0.64]) p.props.add(box, within(m, trs(0, 0.025, z, 0, 1.35, 0.05, 0.08)), PALETTE.ironLight)
  for (const x of [-0.64, 0.64]) p.props.add(box, within(m, trs(x, 0.025, 0, 0, 0.08, 0.05, 1.35)), PALETTE.ironLight)
}

export function addPuddle(p: Pieces, m: THREE.Matrix4): void {
  p.props.add(p.kit.geo.disc, within(m, trs(0, 0.012, 0, 0, 1.0, 0.7, 1, -Math.PI / 2)), PALETTE.water)
}

export function addBeam(p: Pieces, m: THREE.Matrix4): void {
  const { box } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0, 0, 0, 0.32, 0.32, 8)), PALETTE.woodDark)
  for (const z of [-2, 0.5, 2.6]) p.props.add(box, within(m, trs(0, -0.3, z, 0, 0.05, 0.3, 0.05)), PALETTE.iron)
}

export function addPillar(p: Pieces, m: THREE.Matrix4): void {
  p.walls.add(p.kit.geo.box, within(m, trs(0, 1.75, 0, 0, 0.6, 3.5, 0.6)), 0xffffff, groundShade)
  p.props.add(p.kit.geo.box, within(m, trs(0, 3.55, 0, 0, 0.78, 0.16, 0.78)), PALETTE.trim)
  p.props.add(p.kit.geo.box, within(m, trs(0, 0.1, 0, 0, 0.74, 0.2, 0.74)), PALETTE.trimDark)
}

export function addTrapPlate(p: Pieces, m: THREE.Matrix4): void {
  p.props.add(p.kit.geo.box, within(m, trs(0, 0.012, 0, 0, 1.0, 0.024, 1.0)), 0x5f5852)
}

export function addCage(p: Pieces, m: THREE.Matrix4, prisoner: boolean): void {
  const { cyl, ring } = p.kit.geo
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    p.props.add(cyl, within(m, trs(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 0, 0.025, 1.5, 0.025)), PALETTE.iron)
  }
  for (const y of [-0.75, 0.75]) p.props.add(ring, within(m, trs(0, y, 0, 0, 0.5, 0.5, 0.5, Math.PI / 2)), PALETTE.ironLight)
  p.props.add(cyl, within(m, trs(0, -0.76, 0, 0, 0.5, 0.04, 0.5)), PALETTE.iron)
  p.props.add(cyl, within(m, trs(0, 1.6, 0, 0, 0.03, 1.7, 0.03)), PALETTE.iron)
  if (prisoner) {
    p.props.add(p.kit.geo.ball, within(m, trs(0, -0.2, 0, 0, 0.2, 0.55, 0.2)), 0x8c8579)
    p.props.add(p.kit.geo.ball, within(m, trs(0, 0.42, 0.02, 0, 0.14, 0.15, 0.14)), 0xc9a98c)
  }
}

export function addNest(p: Pieces, m: THREE.Matrix4): void {
  const { cone, cyl, box } = p.kit.geo
  p.props.add(cone, within(m, trs(0, 0.2, 0, 0, 0.95, 0.4, 0.8)), jitter(p, PALETTE.straw), groundShade)
  p.props.add(cone, within(m, trs(0.45, 0.15, 0.3, 0.6, 0.5, 0.3, 0.45)), jitter(p, PALETTE.straw, 0.25), groundShade)
  for (let i = 0; i < 4; i++) p.props.add(cyl, within(m, trs(-0.3 + i * 0.22, 0.34, -0.1 + (i % 2) * 0.25, p.rnd() * Math.PI, 0.03, 0.5, 0.03, Math.PI / 2)), PALETTE.bone)
  p.props.add(box, within(m, trs(-0.4, 0.3, 0.25, 0.4, 0.45, 0.04, 0.3)), 0x5a3a2a)
}

export function addLowWall(p: Pieces, m: THREE.Matrix4): void {
  p.walls.add(p.kit.geo.box, within(m, trs(0, 0.5, 0, 0, 2, 1, 0.3)), 0xffffff, groundShade)
  p.props.add(p.kit.geo.box, within(m, trs(0, 1.04, 0, 0, 2.06, 0.08, 0.36)), PALETTE.trim)
}

export function addShelf(p: Pieces, m: THREE.Matrix4): void {
  const { box, cyl } = p.kit.geo
  p.props.add(box, within(m, trs(0, 1.3, -0.05, 0, 4, 2.6, 0.1)), PALETTE.woodDark, groundShade)
  for (const x of [-1.96, 1.96]) p.props.add(box, within(m, trs(x, 1.3, 0.18, 0, 0.08, 2.6, 0.46)), PALETTE.wood, groundShade)
  for (const y of [0.3, 0.9, 1.5, 2.1]) {
    p.props.add(box, within(m, trs(0, y, 0.18, 0, 3.9, 0.06, 0.46)), PALETTE.wood)
    for (let i = 0; i < 7; i++) {
      if (p.rnd() < 0.25) continue
      p.props.add(cyl, within(m, trs(-1.6 + i * 0.53, y + 0.09, 0.22, 0, 0.06, 0.34, 0.06, Math.PI / 2)), PALETTE.glass)
    }
  }
}

export function addWaystone(p: Pieces, m: THREE.Matrix4): THREE.Vector3 {
  const { cyl5, ring, rock } = p.kit.geo
  p.props.add(rock, within(m, trs(0, 0.12, 0, 0.3, 0.75, 0.22, 0.6)), PALETTE.stoneDark)
  p.props.add(cyl5, within(m, trs(0, 1.25, 0, 0.2, 0.42, 2.4, 0.3)), PALETTE.waystone, groundShade)
  p.glow.add(ring, within(m, trs(0, 1.45, 0.31, 0, 0.2, 0.2, 0.2)), PALETTE.waystoneGlow)
  p.glow.add(ring, within(m, trs(0, 1.45, 0.31, 0, 0.1, 0.1, 0.1)), PALETTE.waystoneGlow)
  return point(m, 0, 1.4, 0.4)
}

export function addTablet(p: Pieces, m: THREE.Matrix4): void {
  p.props.add(p.kit.geo.box, within(m, trs(0, 0.3, 0, 0, 0.8, 0.6, 0.5)), PALETTE.stoneDark, groundShade)
  p.props.add(p.kit.geo.box, within(m, trs(0, 1.0, 0, 0, 0.7, 0.9, 0.18)), PALETTE.stone, groundShade)
}

export function addOther(p: Pieces, m: THREE.Matrix4): void {
  p.props.add(p.kit.geo.box, within(m, trs(0, 0.3, 0, 0, 0.6, 0.6, 0.6)), PALETTE.woodLight, groundShade)
}

/* ---------- the dynamic dressing: chests, gold, curios, the merchant, the key ---------- */

export function addChest(p: Pieces, m: THREE.Matrix4, large: boolean, opened: boolean, locked: boolean): void {
  const { box } = p.kit.geo
  const w = large ? 1.5 : 0.9
  const d = large ? 0.8 : 0.6
  const h = large ? 0.6 : 0.5
  p.props.add(box, within(m, trs(0, h / 2, 0, 0, w, h, d)), PALETTE.wood, groundShade)
  const bands = large ? [-0.5, 0, 0.5] : [-0.3, 0.3]
  for (const x of bands) p.props.add(box, within(m, trs(x, h / 2, 0, 0, 0.07, h + 0.02, d + 0.02)), PALETTE.iron)
  const lid = 0.18
  if (opened) {
    // Hinged at the back edge and swung up.
    p.props.add(box, within(m, trs(0, h + d / 2 - 0.02, -d / 2 - lid / 2 + 0.02, 0, w + 0.02, d + 0.02, lid)), PALETTE.woodDark)
    p.props.add(box, within(m, trs(0, h - 0.04, 0, 0, w - 0.1, 0.02, d - 0.1)), 0x2a1c12)
  } else {
    p.props.add(box, within(m, trs(0, h + lid / 2, 0, 0, w + 0.02, lid, d + 0.02)), PALETTE.woodDark)
    for (const x of bands) p.props.add(box, within(m, trs(x, h + lid / 2, 0, 0, 0.08, lid + 0.02, d + 0.04)), PALETTE.iron)
  }
  if (locked && !opened) p.props.add(box, within(m, trs(0, h - 0.02, d / 2 + 0.03, 0, 0.14, 0.16, 0.05)), PALETTE.gold)
}

export function addGold(p: Pieces, m: THREE.Matrix4, amount: number): void {
  const { cone, disc } = p.kit.geo
  const s = Math.max(0.7, Math.min(1.5, 0.7 + amount / 120))
  const heaps: [number, number, number][] = [
    [0, 0, 0.27],
    [0.32, 0.12, 0.19],
    [-0.25, 0.2, 0.15],
  ]
  for (const [x, z, r] of heaps) p.props.add(cone, within(m, trs(x * s, (r * 0.7 * s) / 2, z * s, 0, r * s, r * 0.7 * s, r * s)), PALETTE.gold)
  for (let i = 0; i < 6; i++) p.props.add(disc, within(m, trs((p.rnd() - 0.5) * 1.1 * s, 0.015, (p.rnd() - 0.5) * 0.9 * s, 0, 0.07, 0.07, 1, -Math.PI / 2)), PALETTE.gold)
  p.glow.add(disc, within(m, trs(0, 0.02, 0, 0, 0.7 * s, 0.7 * s, 1, -Math.PI / 2)), 0x3a2a08)
}

/** A soft ring on the floor under something the party can use. */
export function addFloorRing(p: Pieces, m: THREE.Matrix4, radius: number, color: number): void {
  p.glow.add(p.kit.geo.floorRing, within(m, trs(0, 0.03, 0, 0, radius, radius, 1, -Math.PI / 2)), color)
}

export function addLantern(p: Pieces, m: THREE.Matrix4, lit: boolean): void {
  const { box, ring } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.04, 0, 0.4, 0.34, 0.08, 0.34)), PALETTE.iron)
  for (const [x, z] of [
    [-0.14, -0.14],
    [0.14, -0.14],
    [-0.14, 0.14],
    [0.14, 0.14],
  ] as const)
    p.props.add(box, within(m, trs(x, 0.28, z, 0.4, 0.03, 0.46, 0.03)), PALETTE.iron)
  p.props.add(box, within(m, trs(0, 0.53, 0, 0.4, 0.34, 0.06, 0.34)), PALETTE.iron)
  p.props.add(ring, within(m, trs(0, 0.68, 0, 0.4, 0.12, 0.12, 0.12)), PALETTE.iron)
  if (lit) p.glow.add(box, within(m, trs(0, 0.28, 0, 0.4, 0.22, 0.34, 0.22)), PALETTE.amber)
}

export function addDiceTable(p: Pieces, m: THREE.Matrix4): void {
  const { box, disc } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.75, 0, 0, 1.3, 0.08, 0.85)), PALETTE.wood, groundShade)
  for (const [x, z] of [
    [-0.55, -0.35],
    [0.55, -0.35],
    [-0.55, 0.35],
    [0.55, 0.35],
  ] as const)
    p.props.add(box, within(m, trs(x, 0.37, z, 0, 0.07, 0.74, 0.07)), PALETTE.woodDark)
  p.props.add(box, within(m, trs(-0.15, 0.84, 0.05, 0.4, 0.1, 0.1, 0.1)), PALETTE.bone)
  p.props.add(box, within(m, trs(0.1, 0.84, -0.08, 1.1, 0.1, 0.1, 0.1)), PALETTE.bone)
  for (let i = 0; i < 5; i++) p.props.add(disc, within(m, trs(0.35 + (p.rnd() - 0.5) * 0.3, 0.8, 0.15 + (p.rnd() - 0.5) * 0.3, 0, 0.06, 0.06, 1, -Math.PI / 2)), PALETTE.gold)
}

export function addShrine(p: Pieces, m: THREE.Matrix4): void {
  const { box, bowl, cone } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.5, 0, 0, 0.9, 1.0, 0.6)), PALETTE.stone, groundShade)
  p.props.add(bowl, within(m, trs(0, 1.1, 0, 0, 0.3, 0.16, 0.3)), PALETTE.ironLight)
  for (const s of [-1, 1]) p.props.add(box, within(m, trs(s * 0.32, 1.85, 0, 0, 0.75, 0.08, 0.8, 0, s * -0.6)), PALETTE.woodDark)
  for (const x of [-0.42, 0.42]) p.props.add(box, within(m, trs(x, 1.35, -0.25, 0, 0.08, 0.7, 0.08)), PALETTE.woodDark)
  p.glow.add(cone, within(m, trs(0, 1.3, 0, 0, 0.07, 0.18, 0.07)), PALETTE.flame)
}

export function addLarder(p: Pieces, m: THREE.Matrix4): void {
  const { box, ball } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.9, 0, 0, 1.4, 1.8, 0.6)), PALETTE.woodDark, groundShade)
  p.props.add(box, within(m, trs(0, 0.9, 0.31, 0, 0.04, 1.6, 0.02)), PALETTE.wood)
  for (const [x, z, s] of [
    [-0.9, 0.5, 0.32],
    [-0.45, 0.75, 0.26],
    [0.9, 0.55, 0.3],
  ] as const)
    p.props.add(ball, within(m, trs(x, s * 0.8, z, p.rnd() * 3, s, s * 0.8, s)), jitter(p, PALETTE.burlap, 0.2), groundShade)
}

export function addGallows(p: Pieces, m: THREE.Matrix4): void {
  const { box, cyl, ring } = p.kit.geo
  for (const x of [-1, 1]) p.props.add(box, within(m, trs(x, 1.5, 0, 0, 0.2, 3, 0.2)), PALETTE.woodDark, groundShade)
  p.props.add(box, within(m, trs(0, 3.0, 0, 0, 2.4, 0.2, 0.22)), PALETTE.woodDark)
  p.props.add(cyl, within(m, trs(0, 2.45, 0, 0, 0.02, 1.0, 0.02)), PALETTE.straw)
  p.props.add(ring, within(m, trs(0, 1.85, 0, 0, 0.14, 0.14, 0.14)), PALETTE.straw)
}

/** The pedlar's handcart (07 §2.7): parks against a wall; the lamp is a glow, not another light. */
export function addCart(p: Pieces, m: THREE.Matrix4): void {
  const { box, cyl } = p.kit.geo
  p.props.add(box, within(m, trs(0, 0.78, 0, 0, 1.8, 0.45, 1.0)), PALETTE.wood, groundShade)
  for (const z of [-0.6, 0.6]) p.props.add(cyl, within(m, trs(0.2, 0.45, z, 0, 0.45, 0.1, 0.45, Math.PI / 2)), PALETTE.woodDark)
  for (const z of [-0.38, 0.38]) p.props.add(box, within(m, trs(-1.4, 0.72, z, 0, 1.1, 0.06, 0.06)), PALETTE.woodDark)
  for (const [x, z] of [
    [-0.85, -0.48],
    [0.85, -0.48],
    [-0.85, 0.48],
    [0.85, 0.48],
  ] as const)
    p.props.add(box, within(m, trs(x, 1.55, z, 0, 0.05, 1.1, 0.05)), PALETTE.woodDark)
  for (let i = 0; i < 4; i++) p.props.add(box, within(m, trs(-0.75 + i * 0.5, 2.12, 0, 0, 0.5, 0.06, 1.25)), i % 2 ? 0xd8c8a0 : 0x2f5e3a)
  p.props.add(box, within(m, trs(-0.4, 1.15, 0.1, 0.3, 0.45, 0.32, 0.4)), PALETTE.woodLight)
  p.props.add(p.kit.geo.ball, within(m, trs(0.35, 1.18, -0.15, 0.5, 0.3, 0.25, 0.3)), PALETTE.burlap)
  p.glow.add(box, within(m, trs(0.9, 1.8, 0.55, 0, 0.16, 0.22, 0.16)), PALETTE.amber)
}

/** A figure that is part of the set, not of a fight (the pedlar). */
export function addFigure(p: Pieces, m: THREE.Matrix4, robe: number, skin: number): void {
  const { ball, box } = p.kit.geo
  p.props.add(ball, within(m, trs(0, 0.8, 0, 0, 0.34, 0.8, 0.3)), robe, groundShade)
  p.props.add(ball, within(m, trs(0, 1.6, 0, 0, 0.22, 0.24, 0.22)), robe)
  p.props.add(box, within(m, trs(0, 1.58, 0.17, 0, 0.2, 0.12, 0.08)), skin)
}

export function addKey(p: Pieces, m: THREE.Matrix4): void {
  const { ring, box } = p.kit.geo
  p.props.add(ring, within(m, trs(-0.18, 0.04, 0, 0, 0.09, 0.09, 0.09, Math.PI / 2)), PALETTE.gold)
  p.props.add(box, within(m, trs(0.05, 0.04, 0, 0, 0.32, 0.03, 0.03)), PALETTE.gold)
  p.props.add(box, within(m, trs(0.17, 0.04, 0.05, 0, 0.03, 0.03, 0.08)), PALETTE.gold)
  p.props.add(box, within(m, trs(0.11, 0.04, 0.05, 0, 0.03, 0.03, 0.06)), PALETTE.gold)
  addFloorRing(p, m, 0.45, 0x6a4a10)
}

/** A revealed trap: a warning glow where it waits (07 §2.5). */
export function addTrapMark(p: Pieces, m: THREE.Matrix4, state: 'armed' | 'disarmed' | 'sprung'): void {
  if (state === 'armed') {
    p.glow.add(p.kit.geo.plane, within(m, trs(0, 0.03, 0, 0, 1.1, 1.1, 1, -Math.PI / 2)), 0x5a1a08)
    addFloorRing(p, m, 0.85, PALETTE.trapGlow)
  } else {
    p.props.add(p.kit.geo.box, within(m, trs(0, 0.015, 0, 0, 1.0, 0.03, 1.0)), state === 'sprung' ? 0x1e1a18 : 0x6d6a62)
  }
}

/** A barred doorway (a locked door, 07 §2.10 G12); raised into the lintel once the key is found. */
export function addPortcullis(p: Pieces, m: THREE.Matrix4, raised: boolean, height: number): void {
  const { cyl, box } = p.kit.geo
  const lift = raised ? height - 0.35 : 0
  const h = raised ? 0.4 : height
  for (let i = 0; i < 7; i++) p.props.add(cyl, within(m, trs(-0.84 + i * 0.28, lift + h / 2, 0, 0, 0.04, h, 0.04)), PALETTE.iron)
  for (const y of raised ? [lift + 0.2] : [0.5, height * 0.5, height - 0.3]) if (y < lift + h) p.props.add(box, within(m, trs(0, y, 0, 0, 2, 0.06, 0.06)), PALETTE.ironLight)
}

/** The lit doorway (03 §4.1: "the doors you can take are lit"): a glow on the threshold fading upward. */
export function addDoorGlow(p: Pieces, m: THREE.Matrix4, color: number, height: number): void {
  const { plane } = p.kit.geo
  const dim = new THREE.Color(color).multiplyScalar(0.32)
  p.glow.add(plane, within(m, trs(0, 0.035, 0.5, 0, 1.8, 1.0, 1, -Math.PI / 2)), dim)
  if (height <= 0) return
  const fade: Tint = (_x, y, _z, out) => {
    out.multiplyScalar(Math.max(0, 0.3 - (y / Math.max(0.5, height)) * 0.3))
  }
  p.glow.add(plane, within(m, trs(0, height / 2, 0.05, 0, 1.9, height, 1)), color, fade)
}
