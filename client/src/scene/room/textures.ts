import * as THREE from 'three'
import { scenicRandom } from './layout.ts'

/**
 * The grey-box room's few textures, drawn in code (CLAUDE.md rule 8: art is ours, built by script): Cellars brick
 * (brick ochre #7A5230 in mortar grey #5B5650, 07 §2.2), flagstones, the Grinning Company's banner and a soft blob
 * for shadows. Each is small (≤ 256²) and lives for the whole delve screen.
 */
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex)
  c.multiplyScalar(k)
  return `#${c.getHexString()}`
}

function finish(c: HTMLCanvasElement, repeat: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
  }
  t.anisotropy = 2
  return t
}

/** 2 m × 2 m of brick: eight courses of four bricks, every other course offset by half a brick. */
export function brickTexture(): THREE.CanvasTexture {
  const size = 256
  const [c, g] = canvas(size, size)
  if (g) {
    const rnd = scenicRandom(7)
    g.fillStyle = '#4f4b46'
    g.fillRect(0, 0, size, size)
    const rows = 8
    const cols = 4
    const bh = size / rows
    const bw = size / cols
    const mortar = 3
    for (let r = 0; r < rows; r++) {
      const off = r % 2 === 0 ? 0 : bw / 2
      for (let k = -1; k <= cols; k++) {
        const x = k * bw + off
        const tone = 0.78 + rnd() * 0.36
        const damp = rnd() < 0.12
        g.fillStyle = damp ? shade('#5a5a3c', tone) : shade('#7a5230', tone)
        g.fillRect(x + mortar / 2, r * bh + mortar / 2, bw - mortar, bh - mortar)
        // A darker lower lip and a lit upper edge give each brick a little depth.
        g.fillStyle = 'rgba(0,0,0,0.18)'
        g.fillRect(x + mortar / 2, r * bh + bh - mortar / 2 - 4, bw - mortar, 4)
        g.fillStyle = 'rgba(255,230,190,0.08)'
        g.fillRect(x + mortar / 2, r * bh + mortar / 2, bw - mortar, 3)
      }
    }
  }
  return finish(c, true)
}

/** One 2 m floor tile: four worn flagstones with dark joints. */
export function flagTexture(): THREE.CanvasTexture {
  const size = 256
  const [c, g] = canvas(size, size)
  if (g) {
    const rnd = scenicRandom(11)
    g.fillStyle = '#26221f'
    g.fillRect(0, 0, size, size)
    const half = size / 2
    const joint = 5
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const tone = 0.85 + rnd() * 0.3
        g.fillStyle = shade('#5d5650', tone)
        const x = i * half + joint / 2
        const y = j * half + joint / 2
        g.fillRect(x, y, half - joint, half - joint)
        // Wear: a few lighter and darker blotches.
        for (let k = 0; k < 6; k++) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,240,220,0.06)'
          const r = 6 + rnd() * 18
          g.beginPath()
          g.arc(x + rnd() * (half - joint), y + rnd() * (half - joint), r, 0, Math.PI * 2)
          g.fill()
        }
        // Bevel: dark on two edges.
        g.fillStyle = 'rgba(0,0,0,0.22)'
        g.fillRect(x, y + half - joint - 4, half - joint, 4)
        g.fillRect(x + half - joint - 4, y, 4, half - joint)
      }
    }
  }
  return finish(c, false)
}

/** The Company's banner: torn red cloth with a pale painted grin. */
export function bannerTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 128)
  if (g) {
    g.fillStyle = '#6e1f1c'
    g.fillRect(0, 0, 64, 112)
    // Torn hem.
    g.beginPath()
    g.moveTo(0, 112)
    for (let x = 0; x <= 64; x += 8) g.lineTo(x, x % 16 === 0 ? 126 : 112)
    g.lineTo(64, 0)
    g.lineTo(0, 0)
    g.fill()
    g.strokeStyle = '#e9e1d0'
    g.lineWidth = 5
    g.beginPath()
    g.arc(32, 46, 18, 0.15 * Math.PI, 0.85 * Math.PI)
    g.stroke()
    g.lineWidth = 2
    for (const x of [20, 26, 32, 38, 44]) {
      g.beginPath()
      g.moveTo(x, 58)
      g.lineTo(x, 64)
      g.stroke()
    }
    g.fillStyle = '#e9e1d0'
    g.fillRect(21, 30, 6, 6)
    g.fillRect(37, 30, 6, 6)
  }
  return finish(c, false)
}

/** A soft round spot (shadows under the actors). */
export function blobTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64)
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  return finish(c, false)
}

/** Three-step toon ramp: soft cel shading instead of the default two hard bands. */
export function toonRamp(): THREE.DataTexture {
  const data = new Uint8Array([92, 150, 210, 255])
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}
