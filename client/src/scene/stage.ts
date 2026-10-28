import * as THREE from 'three'
import { estimateGpuBytes, heapMb, perf } from './perf.ts'

/**
 * The three.js stage: one renderer on one canvas, the 10-TECH-PLAN §4 budgets (pixel ratio capped at 2 and scaled
 * by 0.75; 60 fps cap, 30 in battery mode), a resize observer, per-frame updaters and the performance sampler.
 * Screens build their scene into `stage.scene` and register updaters; `dispose()` frees everything.
 */
export type FrameMode = 'smooth' | 'battery'

export interface StageOptions {
  frameMode: FrameMode
  reduceMotion: boolean
  onFirstFrame?: () => void
}

export const RENDER_SCALE = 0.75
export const MAX_PIXEL_RATIO = 2
const PERF_SAMPLE_MS = 500

export function pixelRatioFor(devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, MAX_PIXEL_RATIO) * RENDER_SCALE
}

export type Updater = (timeMs: number, dtMs: number) => void

export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private readonly canvas: HTMLCanvasElement
  private frameMode: FrameMode
  private reduceMotion: boolean
  private readonly onFirstFrame: (() => void) | undefined
  private readonly resizeObserver: ResizeObserver | null
  private readonly updaters = new Set<Updater>()
  private readonly disposers: (() => void)[] = []
  private lastRender = -1
  private frames = 0
  private cpuMs = 0
  private sampleStart = 0
  private firstFrameDone = false
  private running = false

  constructor(canvas: HTMLCanvasElement, opts: StageOptions) {
    this.canvas = canvas
    this.frameMode = opts.frameMode
    this.reduceMotion = opts.reduceMotion
    this.onFirstFrame = opts.onFirstFrame
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio || 1))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x120f14, 1)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.fit()
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.fit()) : null
    this.resizeObserver?.observe(canvas.parentElement ?? canvas)
  }

  setFrameMode(mode: FrameMode): void {
    this.frameMode = mode
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
  }

  addUpdater(fn: Updater): () => void {
    this.updaters.add(fn)
    return () => this.updaters.delete(fn)
  }

  /** Register something to free on dispose (geometries, materials, lights). */
  own(dispose: () => void): void {
    this.disposers.push(dispose)
  }

  private fit(): void {
    const host = this.canvas.parentElement ?? this.canvas
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.sampleStart = performance.now()
    this.renderer.setAnimationLoop((t) => this.frame(t))
  }

  private frame(t: number): void {
    // Cap at 60 (or 30): a 120 Hz panel fires requestAnimationFrame twice as often as we want to render.
    const target = this.frameMode === 'battery' ? 1000 / 30 : 1000 / 60
    if (this.lastRender >= 0 && t - this.lastRender < target - 1.5) return
    const dt = this.lastRender < 0 ? target : Math.min(t - this.lastRender, 250)
    this.lastRender = t
    // The CPU frame time counts the updaters (mixers, effects, the room) as well as the render call.
    const start = performance.now()
    if (!this.reduceMotion) for (const fn of this.updaters) fn(t, dt)
    this.renderer.render(this.scene, this.camera)
    const end = performance.now()
    this.cpuMs += end - start
    this.frames++
    if (!this.firstFrameDone) {
      this.firstFrameDone = true
      this.onFirstFrame?.()
    }
    if (end - this.sampleStart >= PERF_SAMPLE_MS) this.sample(end)
  }

  private sample(now: number): void {
    const elapsed = now - this.sampleStart
    const info = this.renderer.info
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    perf.value = {
      fps: Math.round((this.frames * 1000) / elapsed),
      frameMs: this.frames ? this.cpuMs / this.frames : 0,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      gpuMb: estimateGpuBytes(this.scene) / (1024 * 1024),
      heapMb: heapMb(),
      width: size.x,
      height: size.y,
      pixelRatio: this.renderer.getPixelRatio(),
    }
    this.frames = 0
    this.cpuMs = 0
    this.sampleStart = now
  }

  dispose(): void {
    this.running = false
    this.renderer.setAnimationLoop(null)
    this.resizeObserver?.disconnect()
    for (const d of this.disposers.splice(0)) d()
    this.scene.clear()
    this.renderer.dispose()
    perf.value = null
  }
}
