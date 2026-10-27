import { signal } from '@preact/signals'
import type * as THREE from 'three'

/**
 * The performance overlay's numbers (10-TECH-PLAN §4): fps, CPU frame time, draw calls, triangles, geometry and
 * texture counts, a GPU-memory estimate and the JS heap where Chrome exposes it. The stage updates this twice a
 * second so the overlay never re-renders per frame.
 */
export interface PerfSample {
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  gpuMb: number
  heapMb: number | null
  width: number
  height: number
  pixelRatio: number
}

export const perf = signal<PerfSample | null>(null)

/** A rough GPU memory estimate: every geometry attribute's bytes plus 4 bytes per texel of every texture. */
export function estimateGpuBytes(scene: THREE.Scene): number {
  let bytes = 0
  const seen = new Set<string>()
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined
    if (geometry && !seen.has(geometry.uuid)) {
      seen.add(geometry.uuid)
      for (const attr of Object.values(geometry.attributes)) {
        const a = attr as THREE.BufferAttribute
        bytes += a.array.byteLength
      }
      if (geometry.index) bytes += geometry.index.array.byteLength
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    const materials = Array.isArray(material) ? material : material ? [material] : []
    for (const m of materials) {
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        const tex = value as THREE.Texture | null
        if (tex && typeof tex === 'object' && 'isTexture' in tex && tex.isTexture && !seen.has(tex.uuid)) {
          seen.add(tex.uuid)
          const img = tex.image as { width?: number; height?: number } | undefined
          if (img?.width && img?.height) bytes += img.width * img.height * 4
        }
      }
    }
  })
  return bytes
}

export function heapMb(): number | null {
  const p = performance as Performance & { memory?: { usedJSHeapSize: number } }
  return p.memory ? p.memory.usedJSHeapSize / (1024 * 1024) : null
}
