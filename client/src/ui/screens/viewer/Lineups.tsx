import { useEffect, useRef, useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { KIT_ZONES, type KitZone } from '../../../scene/env/envData.ts'
import { KitLineupScene, type KitLabel } from '../../../scene/env/kitLineup.ts'
import { lineupZone, type LineupZone } from '../../../scene/monsters/lineup.ts'
import { MonsterLineupScene, type LineupLabel } from '../../../scene/monsters/lineupScene.ts'
import { Stage } from '../../../scene/stage.ts'
import { FxSheetScene } from '../../../scene/vfx/fxSheet.ts'
import { stageReady } from '../../components/StageView.tsx'
import { buzz } from '../../lib/haptics.ts'
import { navigate, type Route } from '../../router.ts'
import { settings } from '../../store/settings.ts'
import { firstRoomOf, galleryParams } from './gallery.ts'

/**
 * The Phase 6 lineups in the viewer: `#viewer=monsters[&zone=cellars|crypts|vault|pets]` — every monster of the
 * manifest for the zone under its name, playing Idle; tap one to play its next clip — and `#viewer=kit&zone=cellars` —
 * every kit piece of the zone, labelled. Both are for looking at the Blender passes' work as it lands.
 */

const ZONE_NAMES: Readonly<Record<string, string>> = { cellars: 'The Cellars', crypts: 'The Crypts', vault: 'The Drowned Vault', pets: 'Pets', all: 'Every monster' }
const CHIP_NAMES: Readonly<Record<string, string>> = { cellars: 'Cellars', crypts: 'Crypts', vault: 'Vault', pets: 'Pets', all: 'All' }

function Back({ route }: { route: Route }) {
  return (
    <button
      class="btn btn--icon matrix__back"
      aria-label="Back"
      data-testid="back"
      onClick={() => {
        buzz()
        const from = route.params.from ?? ''
        if (from.startsWith('hero:')) navigate('hero', { hero: from.slice(5) })
        else if (from === 'gallery') navigate('viewer', { viewer: 'monsters', zone: 'cellars' })
        else navigate('title')
      }}
    >
      ‹
    </button>
  )
}

/** A stage for a lineup scene: built once, measured on resize, its labels re-read when the canvas changes. */
function useLineup<S extends { place(): void; dispose(): void }, L>(make: (stage: Stage) => S, build: (scene: S) => Promise<number>, labelsOf: (scene: S) => L[], deps: unknown[]) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<S | null>(null)
  const [labels, setLabels] = useState<L[]>([])
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    stageReady.value = false
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) {
      stageReady.value = true
      return
    }
    let stage: Stage | null = null
    let scene: S | null = null
    const relabel = () => {
      if (!scene) return
      scene.place()
      setLabels(labelsOf(scene))
    }
    try {
      stage = new Stage(canvas, { frameMode: settings.value.frameMode, reduceMotion: settings.value.reduceMotion })
      scene = make(stage)
      sceneRef.current = scene
      stage.start()
      void build(scene).then((n) => {
        setCount(n)
        relabel()
        stageReady.value = true
      })
    } catch (err) {
      console.warn('lineup stage unavailable', err)
      stage?.dispose()
      stage = null
      stageReady.value = true
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(relabel) : null
    ro?.observe(host)
    return () => {
      ro?.disconnect()
      sceneRef.current = null
      stage?.dispose()
    }
  }, deps)
  return { hostRef, canvasRef, sceneRef, labels, setLabels, count }
}

export function MonsterLineup({ c, route }: { c: Content; route: Route }) {
  const zone: LineupZone = lineupZone(route.params.zone)
  const { hostRef, canvasRef, sceneRef, labels, setLabels, count } = useLineup<MonsterLineupScene, LineupLabel>(
    (stage) => new MonsterLineupScene(stage, c, zone),
    (scene) => scene.build(),
    (scene) => scene.labels(),
    [zone],
  )
  const tap = (e: PointerEvent) => {
    const scene = sceneRef.current
    const host = hostRef.current
    if (!scene || !host) return
    const r = host.getBoundingClientRect()
    const id = scene.pick(e.clientX - r.left, e.clientY - r.top)
    if (!id) return
    buzz()
    scene.cycle(id)
    setLabels(scene.labels())
  }
  return (
    <main class="screen matrix lineup" data-screen="viewer-monsters">
      <div class="matrix__host" ref={hostRef} onPointerDown={tap} data-testid="lineup-canvas">
        <canvas ref={canvasRef} class="stage" />
      </div>
      <header class="matrix__top lineup__top">
        <Back route={route} />
        <span class="matrix__title lineup__title" data-testid="lineup-title">
          {ZONE_NAMES[zone]} {count === null ? '· loading…' : count === 0 ? '· no models yet' : `· ${count} · tap one for its next clip`}
        </span>
        <nav class="lineup__zones">
          {(['cellars', 'crypts', 'vault', 'pets', 'all'] as const).map((z) => (
            <button key={z} class={`chip lineup__zone ${z === zone ? 'chip--on' : ''}`} data-testid={`lineup-zone-${z}`} onClick={() => navigate('viewer', { viewer: 'monsters', zone: z })}>
              {CHIP_NAMES[z]}
            </button>
          ))}
          <button class="chip lineup__zone lineup__go" data-testid="lineup-rooms" onClick={() => navigate('room', galleryParams(firstRoomOf(c, zone)))}>
            Rooms
          </button>
          <button class="chip lineup__zone lineup__go" data-testid="lineup-fx" onClick={() => navigate('viewer', { viewer: 'fx', from: 'gallery' })}>
            Effects
          </button>
        </nav>
      </header>
      {labels.map((l) => (
        <span key={l.id} class={`lineup__label ${l.lower ? 'lineup__label--lower' : ''}`} style={{ left: `${l.x}px`, top: `${l.y}px` }} data-testid={`lineup-${l.id}`}>
          <b>{l.name}</b>
          <i>{l.clip}</i>
        </span>
      ))}
    </main>
  )
}

/** `#viewer=fx[&still=1]`: every effect of the fight on rows of stand-ins, replayed together (or held at their peak). */
export function FxLineup({ route }: { route: Route }) {
  const still = route.params.still === '1'
  const { hostRef, canvasRef, labels } = useLineup<FxSheetScene, { id: string; x: number; y: number; lower: boolean }>(
    (stage) => new FxSheetScene(stage, { still }),
    async () => 1,
    (scene) => scene.labels(),
    [still],
  )
  return (
    <main class="screen matrix lineup" data-screen="viewer-fx">
      <div class="matrix__host" ref={hostRef}>
        <canvas ref={canvasRef} class="stage" />
      </div>
      <header class="matrix__top lineup__top">
        <Back route={route} />
        <span class="matrix__title lineup__title" data-testid="fx-title">
          Effects · sparks, element marks, heals, status rings, the death puff and the six Ultimates (Reduce motion turns them off)
        </span>
      </header>
      {labels.map((l) => (
        <span key={l.id} class={`lineup__label ${l.lower ? 'lineup__label--drop' : ''}`} style={{ left: `${l.x}px`, top: `${l.y}px` }}>
          {l.id}
        </span>
      ))}
    </main>
  )
}

export function KitLineup({ route }: { route: Route }) {
  const z = route.params.zone
  const zone: KitZone = (KIT_ZONES as readonly string[]).includes(z ?? '') ? (z as KitZone) : 'cellars'
  const { hostRef, canvasRef, labels, count } = useLineup<KitLineupScene, KitLabel>(
    (stage) => new KitLineupScene(stage, zone),
    (scene) => scene.build(),
    (scene) => scene.labels(),
    [zone],
  )
  return (
    <main class="screen matrix lineup" data-screen="viewer-kit">
      <div class="matrix__host" ref={hostRef}>
        <canvas ref={canvasRef} class="stage" />
      </div>
      <header class="matrix__top lineup__top">
        <Back route={route} />
        <span class="matrix__title lineup__title" data-testid="kit-title">
          Kit · {ZONE_NAMES[zone]} {count === null ? '· loading…' : count === 0 ? '· the kit has not landed yet' : `· ${count} pieces`}
        </span>
        <nav class="lineup__zones">
          {KIT_ZONES.map((k) => (
            <button key={k} class={`chip lineup__zone ${k === zone ? 'chip--on' : ''}`} data-testid={`kit-zone-${k}`} onClick={() => navigate('viewer', { viewer: 'kit', zone: k })}>
              {ZONE_NAMES[k]}
            </button>
          ))}
        </nav>
      </header>
      {labels.map((l) => (
        <span key={l.id} class={`lineup__label lineup__label--kit ${l.lower ? 'lineup__label--drop' : ''}`} style={{ left: `${l.x}px`, top: `${l.y}px` }}>
          {l.id}
        </span>
      ))}
    </main>
  )
}
