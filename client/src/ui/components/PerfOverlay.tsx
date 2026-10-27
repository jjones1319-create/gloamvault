import { perf } from '../../scene/perf.ts'
import { settings } from '../store/settings.ts'

function k(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

/** The Settings-toggled performance overlay (10-TECH-PLAN §4): fps, frame ms, draw calls, triangles, memory. */
export function PerfOverlay() {
  if (!settings.value.perfOverlay) return null
  const p = perf.value
  return (
    <div class="perf" role="status" aria-live="off" data-testid="perf-overlay">
      {p ? (
        <>
          <b class={p.fps < (settings.value.frameMode === 'battery' ? 28 : 55) ? 'perf__bad' : ''}>{p.fps} fps</b>
          <span>{p.frameMs.toFixed(1)} ms cpu</span>
          <span>{p.drawCalls} calls</span>
          <span>{k(p.triangles)} tris</span>
          <span>
            {p.geometries} geo · {p.textures} tex · ~{p.gpuMb >= 1 ? `${p.gpuMb.toFixed(1)} MB` : `${(p.gpuMb * 1024).toFixed(0)} KB`} gpu
          </span>
          {p.heapMb !== null && <span>{p.heapMb.toFixed(0)} MB js</span>}
          <span>
            {p.width}×{p.height} @{p.pixelRatio.toFixed(2)}
          </span>
        </>
      ) : (
        <span>no 3D scene on this screen</span>
      )}
    </div>
  )
}
