import { effect } from '@preact/signals'
import { useEffect, useRef, useState } from 'preact/hooks'
import { MonsterCardScene } from '../../scene/monsters/cardScene.ts'
import { Stage } from '../../scene/stage.ts'
import { settings } from '../store/settings.ts'

/**
 * A monster's 3D card (the codex; Phase 8, pass B): one small canvas with the monster turning on a plinth
 * (scene/monsters/cardScene.ts). Without WebGL, or before the model arrives, the card says so in words and the screen
 * works without it. The stage is built once per mount and freed when the card goes.
 */
export function MonsterCanvas({ monsterId, testid }: { monsterId: string; testid?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<MonsterCardScene | null>(null)
  const [state, setState] = useState<'loading' | 'shown' | 'none'>('loading')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let stage: Stage | null = null
    try {
      stage = new Stage(canvas, { frameMode: settings.value.frameMode, reduceMotion: settings.value.reduceMotion })
      const scene = new MonsterCardScene(stage, { reduceMotion: settings.value.reduceMotion })
      scene.onShown = (shown) => setState(shown ? 'shown' : 'none')
      sceneRef.current = scene
      stage.start()
    } catch (err) {
      console.warn('monster card unavailable', err)
      stage?.dispose()
      stage = null
      setState('none')
    }
    const stop = effect(() => {
      stage?.setFrameMode(settings.value.frameMode)
      stage?.setReduceMotion(settings.value.reduceMotion)
      sceneRef.current?.setReduceMotion(settings.value.reduceMotion)
    })
    const host = canvas.parentElement
    const ro = host && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => sceneRef.current?.frame()) : null
    if (host) ro?.observe(host)
    return () => {
      ro?.disconnect()
      stop()
      sceneRef.current = null
      stage?.dispose()
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    setState('loading')
    void scene.show(monsterId)
  }, [monsterId])

  return (
    <div class="cx-card3d" data-testid={testid} data-state={state}>
      <canvas ref={canvasRef} class="stage" aria-hidden="true" />
      {state !== 'shown' && <span class="cx-card3d__note">{state === 'loading' ? 'Bringing it out…' : 'No model yet'}</span>}
    </div>
  )
}
