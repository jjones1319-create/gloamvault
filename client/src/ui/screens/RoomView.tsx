import { useEffect, useRef, useState } from 'preact/hooks'
import { findViewTemplate, normaliseTemplateId } from '../../content/viewTemplates.ts'
import { content } from '../../game/session.ts'
import { roomInfo, RoomScene } from '../../scene/room.ts'
import { Stage } from '../../scene/stage.ts'
import { stageReady } from '../components/StageView.tsx'
import { buzz } from '../lib/haptics.ts'
import { navigate, type Route } from '../router.ts'
import { settings } from '../store/settings.ts'
import { galleryParams, galleryRooms, roomTitle, templateZone } from './viewer/gallery.ts'
import './viewer.css'

/**
 * The room viewer (Phase 6; 07 §8.3 link 4): `#room=<templateId>` shows one room template from its own camera, built
 * from its zone's kit (the grey box for any piece the kit lacks), every door open, its chests and gold on their
 * sockets. `&monsters=giant-rat,cellar-spider` stands monsters on the enemy marks, `&heroes=2` the starter party on
 * theirs, `&light=40` dims the room as the light meter would, `&kind=rest` dresses it as that kind of room. The
 * Crypts and Vault templates written ahead of Phase 7 (`*.json.later`) open here too. Nothing is saved. Opened from the
 * gallery (`&from=gallery`), it steps through every template with Prev / Next and Back returns to the monster lineup.
 */

const ZONE_NAMES: Readonly<Record<string, string>> = { cellars: 'Cellars', crypts: 'Crypts', vault: 'Drowned Vault' }

export function RoomViewScreen({ route }: { route: Route }) {
  const p = route.params
  const raw = p.room && p.room !== '1' && p.room !== 'gravehollow' ? p.room : (p.template ?? 'cel-t-storeroom')
  const id = normaliseTemplateId(raw)
  const monsters = (p.monsters ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const heroes = Math.max(0, Math.min(4, Number(p.heroes ?? 0) || 0))
  const light = Math.max(0, Math.min(100, Number(p.light ?? 100)))
  const kind = p.kind && /^[a-z]+$/i.test(p.kind) ? p.kind : null
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [missing, setMissing] = useState(false)
  const info = roomInfo.value

  useEffect(() => {
    stageReady.value = false
    const canvas = canvasRef.current
    const c = content.value
    if (!canvas || !c) {
      stageReady.value = true
      return
    }
    let stage: Stage | null = null
    let scene: RoomScene | null = null
    let alive = true
    try {
      stage = new Stage(canvas, { frameMode: settings.value.frameMode, reduceMotion: settings.value.reduceMotion })
      scene = new RoomScene(stage, c, { reduceMotion: settings.value.reduceMotion })
      stage.start()
      const s = scene
      void findViewTemplate(c, id).then(async (t) => {
        if (!alive) return
        if (!t) {
          setMissing(true)
          stageReady.value = true
          return
        }
        s.showTemplate(t, { monsters, heroes, light: Number.isFinite(light) ? light : 100, kind })
        // Ready when the kit, the monster table and the models have arrived (never more than a few seconds).
        await Promise.race([s.actorsReady(), new Promise<void>((res) => setTimeout(res, 9000))])
        if (alive) stageReady.value = true
      })
    } catch (err) {
      console.warn('room viewer stage unavailable', err)
      stage?.dispose()
      stage = null
      stageReady.value = true
    }
    return () => {
      alive = false
      stage?.dispose()
    }
  }, [id, monsters.join(','), heroes, light, kind])

  const inGallery = p.from === 'gallery'
  const rooms = inGallery && content.value ? galleryRooms(content.value) : []
  const at = rooms.indexOf(id)
  const step = (by: number) => {
    if (!rooms.length) return
    buzz()
    navigate('room', galleryParams(rooms[(at + by + rooms.length) % rooms.length]!))
  }

  const caption = missing
    ? `No template called ${id}`
    : info
      ? `${ZONE_NAMES[info.zone] ?? info.zone} · ${info.kit === 'kit' ? 'kit' : info.kit === 'mixed' ? 'kit + grey box' : 'grey box (kit not landed)'}${info.drawCalls ? ` · ${info.drawCalls} kit draws · ${Math.round(info.triangles / 100) / 10}k tris` : ''}`
      : 'Lighting the lanterns…'

  return (
    <main class="screen matrix room-view" data-screen="room-view">
      <div class="matrix__host" ref={hostRef}>
        <canvas ref={canvasRef} class="stage" />
      </div>
      <header class="matrix__top lineup__top">
        <button
          class="btn btn--icon matrix__back"
          aria-label="Back"
          data-testid="back"
          onClick={() => {
            buzz()
            if (inGallery) navigate('viewer', { viewer: 'monsters', zone: templateZone(id) })
            else navigate('title')
          }}
        >
          ‹
        </button>
        <span class="matrix__title lineup__title" data-testid="room-view-title">
          {inGallery ? `${roomTitle(id)} (${at + 1} of ${rooms.length}) · ${caption}` : `${id} · ${caption}`}
          {!inGallery && monsters.length ? ` · ${monsters.join(', ')}` : ''}
        </span>
        {inGallery && (
          <nav class="lineup__zones">
            <button class="chip lineup__zone" data-testid="room-prev" onClick={() => step(-1)}>
              ‹ Prev
            </button>
            <button class="chip lineup__zone" data-testid="room-next" onClick={() => step(1)}>
              Next ›
            </button>
          </nav>
        )}
      </header>
    </main>
  )
}
