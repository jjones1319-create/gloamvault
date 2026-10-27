import * as THREE from 'three'

/**
 * Merges many small primitives into one geometry (10-TECH-PLAN §4: "merge static kit meshes per room"): every
 * piece is transformed into room space and painted with a vertex colour, so a whole room's props are one draw
 * call. `box` UVs project by the face's main axis in metres / `uvScale`, so a brick texture tiles at the same size
 * on every wall whatever its length.
 */
export type UvMode = 'none' | 'keep' | 'box'

const tmpV = new THREE.Vector3()
const tmpN = new THREE.Vector3()
const tmpC = new THREE.Color()
const normalMatrix = new THREE.Matrix3()

export type Tint = (x: number, y: number, z: number, out: THREE.Color) => void

export class MeshBuilder {
  private readonly pos: number[] = []
  private readonly nor: number[] = []
  private readonly col: number[] = []
  private readonly uv: number[] = []
  private readonly idx: number[] = []
  private count = 0
  private readonly uvMode: UvMode
  private readonly uvScale: number

  constructor(uvMode: UvMode = 'none', uvScale = 2) {
    this.uvMode = uvMode
    this.uvScale = uvScale
  }

  get empty(): boolean {
    return this.count === 0
  }

  /** Adds `geo` transformed by `m`, every vertex coloured `color` (then `tint`, given the room-space position). */
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.ColorRepresentation, tint?: Tint): void {
    const p = geo.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!p) return
    const n = geo.getAttribute('normal') as THREE.BufferAttribute | undefined
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined
    normalMatrix.getNormalMatrix(m)
    const base = new THREE.Color(color)
    const start = this.count
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i).applyMatrix4(m)
      this.pos.push(tmpV.x, tmpV.y, tmpV.z)
      if (n) tmpN.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize()
      else tmpN.set(0, 1, 0)
      this.nor.push(tmpN.x, tmpN.y, tmpN.z)
      tmpC.copy(base)
      if (tint) tint(tmpV.x, tmpV.y, tmpV.z, tmpC)
      this.col.push(tmpC.r, tmpC.g, tmpC.b)
      if (this.uvMode === 'keep') this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0)
      else if (this.uvMode === 'box') {
        const ax = Math.abs(tmpN.x)
        const ay = Math.abs(tmpN.y)
        const az = Math.abs(tmpN.z)
        const s = this.uvScale
        if (ay >= ax && ay >= az) this.uv.push(tmpV.x / s, tmpV.z / s)
        else if (ax >= az) this.uv.push(tmpV.z / s, tmpV.y / s)
        else this.uv.push(tmpV.x / s, tmpV.y / s)
      }
    }
    const index = geo.getIndex()
    if (index) for (let i = 0; i < index.count; i++) this.idx.push(start + index.getX(i))
    else for (let i = 0; i < p.count; i++) this.idx.push(start + i)
    // A mirrored transform flips the winding; keep faces pointing outward.
    if (m.determinant() < 0) {
      for (let i = this.idx.length - (index ? index.count : p.count); i < this.idx.length; i += 3) {
        const a = this.idx[i + 1]!
        this.idx[i + 1] = this.idx[i + 2]!
        this.idx[i + 2] = a
      }
    }
    this.count += p.count
  }

  build(): THREE.BufferGeometry | null {
    if (this.count === 0) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    if (this.uvMode !== 'none') g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1))
    g.computeBoundingSphere()
    return g
  }
}

const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpP = new THREE.Vector3()
const tmpS = new THREE.Vector3()

/** A transform: position, yaw (about y), then pitch (x) and roll (z), then scale. */
export function trs(x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0): THREE.Matrix4 {
  tmpE.set(pitch, yaw, roll, 'YXZ')
  tmpQ.setFromEuler(tmpE)
  return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz))
}

/** `parent × local`: a piece placed inside a prop placed in the room. */
export function within(parent: THREE.Matrix4, local: THREE.Matrix4): THREE.Matrix4 {
  return new THREE.Matrix4().multiplyMatrices(parent, local)
}
