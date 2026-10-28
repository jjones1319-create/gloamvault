import * as THREE from 'three'
import { acquireAtlas, ATLAS_CELLS, releaseAtlas } from './atlas.ts'
import { emit, moteFor, SPRITE, type EmitOptions, type FxKind, type MoteRecipe, type Particle } from './recipes.ts'

/**
 * Every effect on stage in ONE draw call (Phase 6; 10 §4's budget): a pool of sprites from the generated atlas,
 * additive, each facing the camera (or lying flat on the floor for a ring), moved on the CPU and written to instanced
 * attributes once a frame. It also holds the room's standing flames (a halo and a flickering tongue at each `light_*`
 * point, the lit ones and the rest alike) and the dust motes and drips that drift from its `fx_*` points. Reduce
 * motion: nothing new is spawned and the flames hold still.
 */

export interface FlamePoint {
  x: number
  y: number
  z: number
  color: number
  /** The tongue's height in metres (a candle 0.15, a torch 0.45, a campfire 0.9). */
  size: number
}

/** A room's `fx_*` point and its kind (motes, drip, bubbles, fog …). */
export interface MotePoint {
  x: number
  y: number
  z: number
  kind: string
}

interface Live extends Particle {
  age: number
  px: number
  py: number
  pz: number
}

const VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute float aSize;
attribute float aRot;
attribute float aCell;
attribute vec4 aColor;
attribute float aFlat;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float c = cos(aRot);
  float s = sin(aRot);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aSize;
  vec4 mv;
  if (aFlat > 0.5) {
    // Laid on the floor facing up (x, −y → x, z keeps the quad’s winding toward the sky, so it is not culled from above).
    mv = viewMatrix * vec4(aPos + vec3(q.x, 0.0, -q.y), 1.0);
  } else {
    mv = viewMatrix * vec4(aPos, 1.0);
    // Pulled half a metre toward the eye along the line of sight, so a spark at a body’s chest is not half inside it:
    // the same place and size on screen (a flame stays on its torch), only nearer for the depth test.
    float gvDist = length(mv.xyz);
    float gvPull = max(0.05, gvDist - 0.5) / max(gvDist, 0.0001);
    mv.xyz *= gvPull;
    mv.xy += q * gvPull;
  }
  gl_Position = projectionMatrix * mv;
  float col = mod(aCell, ${ATLAS_CELLS.toFixed(1)});
  float row = floor(aCell / ${ATLAS_CELLS.toFixed(1)});
  vUv = (vec2(col, row) + position.xy + 0.5) / ${ATLAS_CELLS.toFixed(1)};
  vColor = aColor;
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb * t.rgb, a);
}
`

const tmpColor = new THREE.Color()

/** A tiny seeded roll for the effects' scatter (never the sim's RNG). */
function roller(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class VfxLayer {
  readonly mesh: THREE.Mesh
  private readonly geometry: THREE.InstancedBufferGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly capacity: number
  private readonly aPos: THREE.InstancedBufferAttribute
  private readonly aSize: THREE.InstancedBufferAttribute
  private readonly aRot: THREE.InstancedBufferAttribute
  private readonly aCell: THREE.InstancedBufferAttribute
  private readonly aColor: THREE.InstancedBufferAttribute
  private readonly aFlat: THREE.InstancedBufferAttribute
  private live: Live[] = []
  private flames: FlamePoint[] = []
  private motes: { x: number; y: number; z: number; recipe: MoteRecipe; next: number }[] = []
  private reduceMotion = false
  private time = 0
  private readonly roll = roller(0x5eed)
  private disposed = false

  constructor(capacity = 512) {
    this.capacity = capacity
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const attr = (size: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size)
      a.setUsage(THREE.DynamicDrawUsage)
      return a
    }
    this.aPos = attr(3)
    this.aSize = attr(1)
    this.aRot = attr(1)
    this.aCell = attr(1)
    this.aColor = attr(4)
    this.aFlat = attr(1)
    g.setAttribute('aPos', this.aPos)
    g.setAttribute('aSize', this.aSize)
    g.setAttribute('aRot', this.aRot)
    g.setAttribute('aCell', this.aCell)
    g.setAttribute('aColor', this.aColor)
    g.setAttribute('aFlat', this.aFlat)
    g.instanceCount = 0
    this.geometry = g
    this.material = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: acquireAtlas() } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.material.name = 'gv-vfx'
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.name = 'vfx'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
    if (on) this.live = []
    this.write()
  }

  /** The room's flames (they stand until the room changes). */
  setFlames(points: readonly FlamePoint[]): void {
    this.flames = points.map((p) => ({ ...p }))
    this.write()
  }

  /** The room's `fx_*` points: each gives its kind of mote now and then (dust, drips, bubbles, fog, vent smoke …). */
  setMotes(points: readonly MotePoint[]): void {
    this.motes = points.slice(0, 24).map((p, i) => ({ x: p.x, y: p.y, z: p.z, recipe: moteFor(p.kind), next: i * 0.37 }))
  }

  /** An effect on an actor standing at `feet`. */
  spawn(kind: FxKind, feet: THREE.Vector3, opts: EmitOptions): void {
    if (this.reduceMotion || this.disposed) return
    const ps = emit(kind, opts, this.roll)
    for (const p of ps) this.push(p, feet.x, feet.y, feet.z)
  }

  private push(p: Particle, x: number, y: number, z: number): void {
    // A full pool drops its oldest effects first.
    if (this.live.length >= this.capacity - this.flames.length * 2) this.live.shift()
    this.live.push({ ...p, age: 0, px: x + p.x, py: y + p.y, pz: z + p.z })
  }

  clear(): void {
    this.live = []
    this.write()
  }

  update(dtMs: number): void {
    if (this.disposed) return
    const dt = Math.min(0.1, dtMs / 1000)
    this.time += dt
    // Motes and drips (a slow trickle; none with Reduce motion).
    if (!this.reduceMotion) {
      for (const m of this.motes) {
        m.next -= dt
        if (m.next > 0) continue
        const [lo, hi] = m.recipe.every
        m.next = lo + this.roll() * (hi - lo)
        this.push(m.recipe.particle(this.roll), m.x, m.y, m.z)
      }
    }
    const keep: Live[] = []
    for (const p of this.live) {
      if (p.delay > 0) {
        p.delay -= dt
        keep.push(p)
        continue
      }
      p.age += dt
      if (p.age >= p.life) continue
      const k = Math.max(0, 1 - p.drag * dt)
      p.vx *= k
      p.vy = p.vy * k - p.gravity * dt
      p.vz *= k
      p.px += p.vx * dt
      p.py += p.vy * dt
      p.pz += p.vz * dt
      p.rot += p.spin * dt
      keep.push(p)
    }
    this.live = keep
    this.write()
  }

  /** Writes the flames and the live particles into the instanced attributes. */
  private write(): void {
    let n = 0
    const put = (x: number, y: number, z: number, size: number, rot: number, cell: number, color: number, alpha: number, flat: boolean) => {
      if (n >= this.capacity) return
      this.aPos.setXYZ(n, x, y, z)
      this.aSize.setX(n, size)
      this.aRot.setX(n, rot)
      this.aCell.setX(n, cell)
      tmpColor.setHex(color)
      this.aColor.setXYZW(n, tmpColor.r, tmpColor.g, tmpColor.b, alpha)
      this.aFlat.setX(n, flat ? 1 : 0)
      n++
    }
    const still = this.reduceMotion
    this.flames.forEach((f, i) => {
      const t = this.time * 7 + i * 1.7
      const flick = still ? 1 : 1 + Math.sin(t) * 0.07 + Math.sin(t * 2.3 + 1.1) * 0.05
      put(f.x, f.y + f.size * 0.3, f.z, f.size * 2.4 * flick, 0, SPRITE.glow, f.color, 0.42, false)
      put(f.x, f.y + f.size * 0.42, f.z, f.size * flick, still ? 0 : Math.sin(t * 0.6) * 0.08, SPRITE.flame, f.color, 0.95, false)
    })
    for (const p of this.live) {
      if (p.delay > 0) continue
      const t = p.age / p.life
      const ease = 1 - (1 - t) * (1 - t)
      const fadeIn = t < 0.08 ? t / 0.08 : 1
      const alpha = (p.alpha0 + (p.alpha1 - p.alpha0) * t) * fadeIn
      put(p.px, p.py, p.pz, p.size0 + (p.size1 - p.size0) * ease, p.rot, p.cell, p.color, alpha, p.flat)
    }
    this.geometry.instanceCount = n
    // Only the live part of each buffer goes to the GPU.
    for (const a of [this.aPos, this.aSize, this.aRot, this.aCell, this.aColor, this.aFlat]) {
      a.clearUpdateRanges()
      a.addUpdateRange(0, Math.max(1, n) * a.itemSize)
      a.needsUpdate = true
    }
    this.mesh.visible = n > 0
  }

  /** How many sprites are drawing (for tests and the overlay). */
  count(): number {
    return this.geometry.instanceCount
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
    releaseAtlas()
  }
}
