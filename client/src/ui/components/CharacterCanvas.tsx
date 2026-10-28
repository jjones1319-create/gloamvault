import { effect } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { content } from '../../game/session.ts'
import type { CharacterSpec } from '../../scene/characters/outfit.ts'
import { ViewerScene, type ViewerSceneOptions } from '../../scene/characters/viewerScene.ts'
import { Stage } from '../../scene/stage.ts'
import { settings } from '../store/settings.ts'
import { stageReady } from './StageView.tsx'

/**
 * A 3D hero on a plinth (Phase 5): the character viewer full screen, the new hero's Look step small. Drag turns the
 * hero; pinch (or the mouse wheel) zooms between the full body and the close-up's minimum distance. `ready` makes the
 * screen's ready flag wait for the first hero (the screenshot tool waits for it). Without WebGL it shows nothing and
 * the screen still works.
 */
export function CharacterCanvas({
  spec,
  clip = null,
  options,
  distance,
  rightInset = 0,
  ready = false,
  onClips,
  testid,
  class: cls = '',
}: {
  spec: CharacterSpec | null
  clip?: string | null
  options?: Partial<ViewerSceneOptions>
  /** When it changes, the camera moves to this distance, or null for the full body (the viewer's button). */
  distance?: number | null | undefined
  rightInset?: number
  ready?: boolean
  onClips?: (names: string[]) => void
  testid?: string
  class?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ViewerScene | null>(null)
  const onClipsRef = useRef(onClips)
  onClipsRef.current = onClips

  useEffect(() => {
    const canvas = canvasRef.current
    const c = content.value
    if (ready) stageReady.value = false
    if (!canvas || !c) {
      if (ready) stageReady.value = true
      return
    }
    let stage: Stage | null = null
    let scene: ViewerScene | null = null
    try {
      stage = new Stage(canvas, { frameMode: settings.value.frameMode, reduceMotion: settings.value.reduceMotion })
      scene = new ViewerScene(stage, c, { ...options, rightInset })
      scene.onShown = (model) => {
        onClipsRef.current?.(model?.animator.names() ?? [])
        if (ready) stageReady.value = true
      }
      sceneRef.current = scene
      stage.start()
    } catch (err) {
      console.warn('character stage unavailable', err)
      stage?.dispose()
      stage = null
      scene = null
      if (ready) stageReady.value = true
    }
    const stop = effect(() => {
      stage?.setFrameMode(settings.value.frameMode)
      stage?.setReduceMotion(settings.value.reduceMotion)
    })
    const host = hostRef.current
    const ro = host && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scene?.refit()) : null
    if (host) ro?.observe(host)
    return () => {
      ro?.disconnect()
      stop()
      sceneRef.current = null
      stage?.dispose()
    }
  }, [])

  useEffect(() => {
    if (spec) void sceneRef.current?.show(spec)
  }, [spec])

  useEffect(() => {
    sceneRef.current?.setClip(clip)
  }, [clip])

  useEffect(() => {
    sceneRef.current?.setRightInset(rightInset)
  }, [rightInset])

  useEffect(() => {
    if (distance !== undefined) sceneRef.current?.setDistance(distance)
  }, [distance])

  // Drag to turn, pinch to zoom (pointer events cover touch and mouse); the wheel zooms too.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef(0)
  const down = (e: PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) pinch.current = spread(pointers.current)
  }
  const move = (e: PointerEvent) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    p.x = e.clientX
    p.y = e.clientY
    const scene = sceneRef.current
    if (!scene) return
    if (pointers.current.size >= 2) {
      const now = spread(pointers.current)
      if (pinch.current > 0 && now > 0) scene.zoomBy(pinch.current / now)
      pinch.current = now
    } else scene.turnBy(dx)
  }
  const up = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = 0
  }
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    sceneRef.current?.zoomBy(Math.exp(e.deltaY * 0.0012))
  }

  return (
    <div
      class={`char-canvas ${cls}`}
      ref={hostRef}
      data-testid={testid}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onWheel={wheel}
    >
      <canvas ref={canvasRef} class="stage" />
    </div>
  )
}

function spread(pts: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...pts.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
