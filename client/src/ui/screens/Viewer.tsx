import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Content } from '../../../../sim/src/content.ts'
import type { BodyFrame } from '../../../../sim/src/types/enums.ts'
import { content } from '../../game/session.ts'
import { heroLibrary } from '../../scene/characters/assets.ts'
import type { HeroManifest } from '../../scene/characters/manifest.ts'
import { hairChoices, hairIsHorn, skinTones, starterSpec } from '../../scene/characters/outfit.ts'
import { MATRIX_CLASSES, MATRIX_SPECIES, MatrixScene, matrixLayout } from '../../scene/characters/matrixScene.ts'
import { VIEWER_DEFAULTS } from '../../scene/characters/viewerScene.ts'
import { Stage } from '../../scene/stage.ts'
import { CharacterCanvas } from '../components/CharacterCanvas.tsx'
import { stageReady } from '../components/StageView.tsx'
import { settings } from '../store/settings.ts'
import { buzz } from '../lib/haptics.ts'
import { navigate, type Route } from '../router.ts'
import { matrixOptions, parseViewerParams, type ViewerState } from './viewer/params.ts'
import './viewer.css'

/**
 * The character viewer (Phase 5, `#viewer=dwarf,warden,S`): one hero full screen on a plinth — drag to turn, pinch
 * to zoom down to the close-up's minimum distance — with pickers for species, class, body frame, gear tier, face,
 * skin, hair and the clip, and gear on or off. A look at the art as it lands from the Blender passes; nothing here is
 * saved.
 */

const PANEL_PX = 380
/** The order the docs list them in (05 §3, 04 §1). */
const SPECIES_ORDER = ['human', 'dwarf', 'elf', 'orc', 'halfling', 'draconid']
const CLASS_ORDER = ['warden', 'blade', 'ranger', 'shade', 'arcanist', 'mender', 'beast-tamer']

/** 11 §3's order: the loops, the fight, the rest; the species specials only for their species. */
const CLIP_ORDER = ['Idle', 'Walk', 'Run', 'Attack_Light', 'Attack_Heavy', 'Attack_Dual', 'Shoot', 'Cast', 'Guard', 'Guard_Shield', 'Hit', 'Dodge', 'Downed', 'Revive', 'Victory', 'Defeat', 'Interact', 'SitRest', 'Breath', 'Roar']
const SPECIES_CLIP: Readonly<Record<string, string>> = { Breath: 'draconid', Roar: 'orc' }

function ordered(ids: readonly string[], order: readonly string[]): string[] {
  const rank = (id: string) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id))
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** Back to the hero screen that opened the viewer (`&from=hero:<id>`), else the title. */
function goBack(route: Route): void {
  const from = route.params.from ?? ''
  if (from.startsWith('hero:')) navigate('hero', { hero: from.slice(5) })
  else navigate('title')
}

export function ViewerScreen({ route }: { route: Route }) {
  const c = content.value
  if (!c) {
    return (
      <main class="screen screen--panel loading" data-screen="viewer">
        <p class="loading__text">Lighting the lanterns…</p>
      </main>
    )
  }
  return route.params.viewer === 'matrix' ? <Matrix c={c} route={route} /> : <Viewer c={c} route={route} />
}

/** The acceptance matrix (Phase 5): all 36 species × class heroes on one camera, one clip, one instant. */
function Matrix({ c, route }: { c: Content; route: Route }) {
  const opts = useMemo(() => matrixOptions(route.params), [route.params])
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 892, h: 412 })
  const [built, setBuilt] = useState<number | null>(null)

  useEffect(() => {
    stageReady.value = false
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) {
      stageReady.value = true
      return
    }
    let stage: Stage | null = null
    let scene: MatrixScene | null = null
    const measure = () => {
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      setSize({ w, h })
      scene?.place(w, h)
    }
    try {
      stage = new Stage(canvas, { frameMode: settings.value.frameMode, reduceMotion: settings.value.reduceMotion })
      scene = new MatrixScene(stage, c, opts)
      measure()
      stage.start()
      void scene.build().then((n) => {
        measure()
        setBuilt(n)
        stageReady.value = true
      })
    } catch (err) {
      console.warn('matrix stage unavailable', err)
      stage?.dispose()
      stage = null
      stageReady.value = true
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(host)
    return () => {
      ro?.disconnect()
      stage?.dispose()
    }
  }, [opts])

  const L = matrixLayout(size.w, size.h)
  const when = opts.at !== null ? ` at ${opts.at}` : opts.t !== null ? ` at ${Math.round(opts.t * 100)}%` : ''
  return (
    <main class="screen matrix" data-screen="viewer-matrix">
      <div class="matrix__host" ref={hostRef}>
        <canvas ref={canvasRef} class="stage" />
      </div>
      <header class="matrix__top" style={{ height: `${L.headerH}px` }}>
        <button
          class="btn btn--icon matrix__back"
          aria-label="Back"
          data-testid="back"
          onClick={() => {
            buzz()
            goBack(route)
          }}
        >
          ‹
        </button>
        <span class="matrix__title" data-testid="matrix-title">
          {opts.clip.replace(/_/g, ' ')}
          {when} · tier {opts.tier} · {opts.frame}
          {built !== null && built < 36 ? ` · ${built}/36 built` : ''}
        </span>
        {MATRIX_CLASSES.map((id, i) => (
          <span key={id} class="matrix__col" style={{ left: `${L.labelW + (i + 0.5) * L.cellW}px` }}>
            {c.classes.get(id)?.name ?? id}
          </span>
        ))}
      </header>
      {MATRIX_SPECIES.map((id, i) => (
        <span key={id} class="matrix__row" style={{ top: `${L.headerH + (i + 0.5) * L.cellH}px`, width: `${L.labelW}px` }}>
          {c.species.get(id)?.name ?? id}
        </span>
      ))}
    </main>
  )
}

/** The species' face presets by name (the manifest's), or "Face 1–3". */
function presetNames(manifest: HeroManifest | null, c: Content, speciesId: string): string[] {
  const m = manifest?.species.get(speciesId)?.presets
  if (m && m.length) return m.map((p) => p.name)
  const n = c.species.get(speciesId)?.body.facePresets ?? 3
  return Array.from({ length: n }, (_, i) => `Face ${i + 1}`)
}

function Viewer({ c, route }: { c: Content; route: Route }) {
  const speciesIds = useMemo(() => ordered([...c.species.keys()], SPECIES_ORDER), [c])
  const classIds = useMemo(() => ordered([...c.classes.keys()], CLASS_ORDER), [c])
  const initial = useMemo(() => parseViewerParams(route.params, speciesIds, classIds), [])
  const [st, setSt] = useState<ViewerState>(initial)
  const [manifest, setManifest] = useState<HeroManifest | null>(null)
  const [clips, setClips] = useState<string[]>([])
  const [near, setNear] = useState(initial.zoom === 'min')
  const set = (patch: Partial<ViewerState>) => {
    buzz()
    setSt((s) => ({ ...s, ...patch }))
  }

  useEffect(() => {
    void heroLibrary.manifest().then(setManifest)
  }, [])

  const species = c.species.get(st.speciesId)
  const tones = skinTones(manifest, species)
  const hairs = hairChoices(manifest, st.speciesId)
  const faces = presetNames(manifest, c, st.speciesId)
  const look = { frame: st.frame, skin: Math.min(st.skin, tones.length - 1), face: Math.min(st.face, faces.length - 1), hair: st.hair }
  const spec = useMemo(() => starterSpec(c, { speciesId: st.speciesId, classId: st.classId, look, tier: st.tier, gear: st.gear }), [c, st.speciesId, st.classId, st.frame, look.skin, look.face, st.hair, st.tier, st.gear])
  const startDistance = st.zoom === 'min' ? VIEWER_DEFAULTS.minDistance : st.zoom === 'max' ? VIEWER_DEFAULTS.maxDistance : typeof st.zoom === 'number' ? st.zoom : null
  const options = useMemo(() => ({ distance: startDistance, ...(st.yaw !== null ? { yaw: st.yaw } : {}) }), [])
  const [distance, setDistance] = useState<number | null | undefined>(undefined)

  const summary = `${species?.name ?? st.speciesId} ${c.classes.get(st.classId)?.name ?? st.classId} · ${st.frame === 'broad' ? 'Broad' : 'Slight'} · ${st.gear ? `tier ${st.tier}` : 'no gear'}`

  return (
    <main class="screen viewer" data-screen="viewer">
      <CharacterCanvas spec={spec} clip={st.clip} options={options} distance={distance} rightInset={PANEL_PX} ready onClips={setClips} testid="viewer-canvas" class="viewer__canvas" />
      <header class="viewer__top">
        <button
          class="btn btn--icon"
          aria-label="Back"
          data-testid="back"
          onClick={() => {
            buzz()
            goBack(route)
          }}
        >
          ‹
        </button>
        <div class="viewer__heading">
          <h1 class="viewer__title">Character viewer</h1>
          <span class="viewer__summary" data-testid="viewer-summary">
            {summary}
          </span>
        </div>
        <button
          class="btn btn--small viewer__zoom"
          data-testid="viewer-zoom"
          onClick={() => {
            buzz()
            setNear(!near)
            setDistance(near ? null : VIEWER_DEFAULTS.minDistance)
          }}
        >
          {near ? 'Full body' : 'Close-up'}
        </button>
      </header>
      <aside class="viewer__panel" style={{ width: `${PANEL_PX}px` }}>
        <Row label="Species">
          {speciesIds.map((id) => (
            <Pick key={id} on={id === st.speciesId} testid={`vw-species-${id}`} onClick={() => set({ speciesId: id })}>
              {c.species.get(id)?.name ?? id}
            </Pick>
          ))}
        </Row>
        <Row label="Class">
          {classIds.map((id) => (
            <Pick key={id} on={id === st.classId} testid={`vw-class-${id}`} onClick={() => set({ classId: id })}>
              {c.classes.get(id)?.name ?? id}
            </Pick>
          ))}
        </Row>
        <Row label="Body">
          {(['broad', 'slight'] as BodyFrame[]).map((f) => (
            <Pick key={f} on={st.frame === f} testid={`vw-frame-${f}`} onClick={() => set({ frame: f })}>
              {f === 'broad' ? 'Broad' : 'Slight'}
            </Pick>
          ))}
        </Row>
        <Row label="Gear">
          {(['F', 'S'] as const).map((t) => (
            <Pick key={t} on={st.tier === t && st.gear} testid={`vw-tier-${t}`} onClick={() => set({ tier: t, gear: true })}>
              {t === 'F' ? 'Crude (F)' : 'Fine (S)'}
            </Pick>
          ))}
          <Pick on={!st.gear} testid="vw-gear" onClick={() => set({ gear: !st.gear })}>
            {st.gear ? 'Off' : 'On'}
          </Pick>
        </Row>
        <Row label="Face">
          {faces.map((name, i) => (
            <Pick key={name} on={look.face === i} testid={`vw-face-${i + 1}`} onClick={() => set({ face: i })}>
              {name}
            </Pick>
          ))}
        </Row>
        <Row label="Skin">
          {tones.map((hex, i) => (
            <Swatch key={hex} hex={hex} on={look.skin === i} label={`Skin tone ${i + 1}`} testid={`vw-skin-${i + 1}`} onClick={() => set({ skin: i })} />
          ))}
        </Row>
        <Row label={hairIsHorn(manifest, st.speciesId) ? 'Horns' : 'Hair'}>
          {hairs.map((hex, i) => (
            <Swatch key={`${hex}-${i}`} hex={hex} on={st.hair % hairs.length === i} label={`Colour ${i + 1}`} testid={`vw-hair-${i + 1}`} onClick={() => set({ hair: i })} />
          ))}
        </Row>
        <Row label="Clip">
          {clips.length === 0 ? (
            <span class="viewer__note" data-testid="vw-no-clips">
              Breathing idle: the clips arrive with the animation pass.
            </span>
          ) : (
            ordered(clips, CLIP_ORDER).filter((name) => !SPECIES_CLIP[name] || SPECIES_CLIP[name] === st.speciesId).map((name) => (
              <Pick key={name} on={(st.clip ?? 'Idle') === name} testid={`vw-clip-${name}`} onClick={() => set({ clip: name })}>
                {name.replace(/_/g, ' ')}
              </Pick>
            ))
          )}
        </Row>
      </aside>
    </main>
  )
}

function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="vw-row">
      <span class="vw-row__label">{label}</span>
      <div class="vw-row__picks">{children}</div>
    </div>
  )
}

function Pick({ on, onClick, testid, children }: { on: boolean; onClick: () => void; testid: string; children: ComponentChildren }) {
  return (
    <button class={`chip vw-pick ${on ? 'chip--on' : ''}`} aria-pressed={on} data-testid={testid} onClick={onClick}>
      {children}
    </button>
  )
}

function Swatch({ hex, on, label, testid, onClick }: { hex: string; on: boolean; label: string; testid: string; onClick: () => void }) {
  return <button class={`vw-swatch ${on ? 'vw-swatch--on' : ''}`} aria-label={label} aria-pressed={on} data-testid={testid} style={{ background: hex }} onClick={onClick} />
}
