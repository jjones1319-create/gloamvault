import { effect } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { content, delve, delveVersion, legalActions } from '../../game/session.ts'
import { RoomScene } from '../../scene/room.ts'
import type { Insets } from '../../scene/room/fit.ts'
import { onCue } from '../../scene/sceneBus.ts'
import { Stage } from '../../scene/stage.ts'
import { fightFinale } from '../screens/delve/FightHud.tsx'
import { held } from '../screens/delve/fight/prefs.ts'
import { settings } from '../store/settings.ts'
import { stageReady } from './StageView.tsx'

/**
 * The delve's 3D stage (Phase 4): one renderer for the whole delve screen — rooms, fights, results — that follows
 * the delve signals and the fight HUD's cues. `insets` is the part of the screen the overlay covers (CSS px); the
 * scene frames the room or the fight in what is left. Without WebGL the screen still works: `stageReady` is set
 * and the overlay carries on over a dark background.
 */
export function RoomStage({ insets }: { insets: Insets }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RoomScene | null>(null)
  const insetsRef = useRef(insets)
  insetsRef.current = insets

  useEffect(() => {
    stageReady.value = false
    const canvas = canvasRef.current
    const c = content.value
    if (!canvas || !c) {
      stageReady.value = true
      return
    }
    let stage: Stage | null = null
    let room: RoomScene | null = null
    try {
      stage = new Stage(canvas, {
        frameMode: settings.value.frameMode,
        reduceMotion: settings.value.reduceMotion,
        onFirstFrame: () => {
          // Phase 5: the ready flag also waits for the heroes' 3D characters (never more than a few seconds).
          const r = room
          const done = () => {
            stageReady.value = true
          }
          if (!r) return done()
          void Promise.race([r.actorsReady(), new Promise<void>((res) => setTimeout(res, 6000))]).then(done, done)
        },
      })
      room = new RoomScene(stage, c, { reduceMotion: settings.value.reduceMotion })
      room.setInsets(insetsRef.current)
      room.onRoomBuilt = () => {
        // A short fade into the new room (skipped with Reduce motion by the CSS).
        const el = hostRef.current
        if (!el) return
        el.classList.remove('dv-stage--in')
        void el.offsetWidth
        el.classList.add('dv-stage--in')
      }
      sceneRef.current = room
    } catch (err) {
      // No WebGL (an old browser, a blocked GPU): the delve is played from the overlay alone.
      console.warn('room stage unavailable', err)
      stage?.dispose()
      stage = null
      room = null
      stageReady.value = true
    }
    const stopSettings = effect(() => {
      const s = settings.value
      stage?.setFrameMode(s.frameMode)
      stage?.setReduceMotion(s.reduceMotion)
      room?.setReduceMotion(s.reduceMotion)
      room?.setPalette(s.palette)
    })
    const stopDelve = effect(() => {
      void delveVersion.value
      const d = delve.value
      const legal = legalActions.value
      // While the fight HUD plays a finished fight's last blows, the scene keeps that fight on stage.
      const finale = fightFinale.value
      if (!d || !room) return
      try {
        room.sync(d, legal, !d.fight && finale ? held.fight : null)
      } catch (e) {
        console.error('room scene sync failed', e)
      }
    })
    const offCue = onCue((cue) => room?.cue(cue))
    try {
      stage?.start()
    } catch (e) {
      console.warn('room stage did not start', e)
      stageReady.value = true
    }
    return () => {
      offCue()
      stopDelve()
      stopSettings()
      sceneRef.current = null
      stage?.dispose()
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setInsets(insets)
  }, [insets.top, insets.right, insets.bottom, insets.left])

  return (
    <div class="stage-host dv-stage" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} class="stage" />
    </div>
  )
}
