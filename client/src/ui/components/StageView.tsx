import { effect, signal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { buildTitleBackdrop } from '../../scene/backdrop.ts'
import { Stage } from '../../scene/stage.ts'
import { settings } from '../store/settings.ts'

/** True once the current stage has rendered a frame (or failed to start); the screenshot tool waits for it. */
export const stageReady = signal(false)

export type StageContent = 'title'

const BUILDERS: Record<StageContent, (stage: Stage) => void> = {
  title: buildTitleBackdrop,
}

/** A full-bleed canvas behind the screen's UI, owned for the life of the component. */
export function StageView({ content }: { content: StageContent }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    stageReady.value = false
    const canvas = ref.current
    if (!canvas) return
    let stage: Stage | null = null
    try {
      stage = new Stage(canvas, {
        frameMode: settings.value.frameMode,
        reduceMotion: settings.value.reduceMotion,
        onFirstFrame: () => {
          stageReady.value = true
        },
      })
      BUILDERS[content](stage)
      stage.start()
    } catch (err) {
      // No WebGL (an old browser, a blocked GPU): the screens still work without the scenery.
      console.warn('stage unavailable', err)
      stageReady.value = true
    }
    const stop = effect(() => {
      stage?.setFrameMode(settings.value.frameMode)
      stage?.setReduceMotion(settings.value.reduceMotion)
    })
    return () => {
      stop()
      stage?.dispose()
    }
  }, [content])

  return (
    <div class="stage-host" aria-hidden="true">
      <canvas ref={ref} class="stage" />
    </div>
  )
}
