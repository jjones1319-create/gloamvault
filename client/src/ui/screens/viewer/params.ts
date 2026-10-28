import type { BodyFrame } from '../../../../../sim/src/types/enums.ts'
import type { MatrixOptions } from '../../../scene/characters/matrixScene.ts'

/**
 * The character viewer's deep link (Phase 5): `#viewer=dwarf,warden,S` is species, class and tier (F or S; a grade
 * letter works too: B and above wear the S meshes), with optional `&frame=slight`, `&preset=2` (the face, counted
 * from 1 like everything a player reads), `&skin=1`, `&hair=3`, `&clip=Run`, `&gear=0`, `&zoom=min|max|<metres>` and
 * `&yaw=<degrees>`. Unknown values fall back to the first choice. Pure, so it is tested.
 */
export interface ViewerState {
  speciesId: string
  classId: string
  tier: 'F' | 'S'
  frame: BodyFrame
  /** 0-based indexes (the look's own). */
  face: number
  skin: number
  hair: number
  clip: string | null
  gear: boolean
  zoom: 'min' | 'max' | number | null
  yaw: number | null
}

function index1(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return v !== undefined && Number.isFinite(n) ? Math.max(0, Math.round(n) - 1) : fallback
}

export function parseViewerParams(params: Readonly<Record<string, string>>, speciesIds: readonly string[], classIds: readonly string[]): ViewerState {
  const [s, k, t] = (params.viewer ?? '').split(',').map((x) => x.trim())
  const speciesId = s && speciesIds.includes(s) ? s : (speciesIds.includes('human') ? 'human' : (speciesIds[0] ?? 'human'))
  const classId = k && classIds.includes(k) ? k : (classIds[0] ?? 'warden')
  const g = (t ?? 'F').toUpperCase()
  const tier: 'F' | 'S' = ['S', 'SS', 'GOD', 'A', 'B'].includes(g) ? 'S' : 'F'
  const zoomRaw = params.zoom
  const zoom = zoomRaw === 'min' || zoomRaw === 'max' ? zoomRaw : zoomRaw !== undefined && Number.isFinite(Number(zoomRaw)) ? Number(zoomRaw) : null
  const yaw = params.yaw !== undefined && Number.isFinite(Number(params.yaw)) ? Number(params.yaw) : null
  return {
    speciesId,
    classId,
    tier,
    frame: params.frame === 'slight' ? 'slight' : 'broad',
    face: index1(params.preset ?? params.face, 0),
    skin: index1(params.skin, 0),
    hair: index1(params.hair, 1),
    clip: params.clip && /^[A-Za-z_]{2,24}$/.test(params.clip) ? params.clip : null,
    gear: params.gear !== '0',
    zoom,
    yaw,
  }
}

/** `#viewer=matrix&clip=Idle&tier=F[&frame=slight][&t=0.4 | &at=hit]`: the acceptance matrix's options. */
export function matrixOptions(params: Readonly<Record<string, string>>): MatrixOptions {
  const t = params.t !== undefined && Number.isFinite(Number(params.t)) ? Math.max(0, Math.min(1, Number(params.t))) : null
  return {
    clip: params.clip && /^[A-Za-z_]{2,24}$/.test(params.clip) ? params.clip : 'Idle',
    tier: (params.tier ?? 'F').toUpperCase() === 'S' ? 'S' : 'F',
    frame: params.frame === 'slight' ? 'slight' : 'broad',
    t,
    at: t === null && params.at && /^[A-Za-z0-9_]{1,16}$/.test(params.at) ? params.at : null,
  }
}
