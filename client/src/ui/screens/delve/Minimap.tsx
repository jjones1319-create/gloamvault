import type { Content } from '../../../../../sim/src/content.ts'
import type { DelveCommand, DelveState } from '../../../../../sim/src/delve-types.ts'
import { roomThreat } from '../../../../../sim/src/threat.ts'
import { content, delve, delveCommand, delveVersion, legalActions, toast } from '../../../game/session.ts'
import { buzz } from '../../lib/haptics.ts'
import { Modal } from '../../kit/kit.tsx'
import { Icon } from './icons.tsx'
import { mapView, mapWindow, type MapRoomView, type MapView, type ThreatBandLike } from './mapLayout.ts'
import { KIND_SHORT, THREAT_NAMES, THREAT_SHORT } from './words.ts'

/**
 * The floor map (03 §4.1): the compact one in the top-right corner shows the rooms around the party at a size a
 * thumb can hit (44 px a cell), and taps on a neighbouring room walk there; the large one (a modal) shows the whole
 * floor. Locked or blocked doors answer a tap with the reason. A room whose fight the party knows carries its threat
 * (D-092): Easy, Even, Dangerous (amber) or Deadly (red).
 */
export const MAP_CELL = 44
export const MINI_COLS = 5
export const MINI_ROWS = 3

/** The threat band of every room whose fight the party knows (visited and not cleared, or scouted). */
function threatsOf(c: Content | null, d: DelveState): Map<string, ThreatBandLike> {
  const out = new Map<string, ThreatBandLike>()
  if (!c) return out
  for (const r of d.floor.graph.rooms) {
    try {
      const t = roomThreat(c, d, r.id)
      if (t) out.set(r.id, t.band)
    } catch {
      /* an encounter the content no longer has: no chip */
    }
  }
  return out
}

function roomTitle(r: MapRoomView): string {
  const what = r.kind ? (KIND_SHORT[r.kind] ?? r.kind) : 'Unknown room'
  const where = r.status === 'current' ? ' (you are here)' : ''
  const threat = r.threat ? ` · ${THREAT_NAMES[r.threat]}` : ''
  const move = r.move ? (r.move.enabled ? ' · tap to go' : ` · ${r.move.reason ?? 'blocked'}`) : ''
  return `${what}${where}${threat}${move}`
}

function go(r: MapRoomView, after?: () => void): void {
  if (!r.move) return
  if (!r.move.enabled) {
    buzz()
    toast(r.move.reason ? r.move.reason[0]!.toUpperCase() + r.move.reason.slice(1) : 'That way is blocked', 'bad')
    return
  }
  buzz()
  const cmd: DelveCommand = { kind: 'move', toRoomId: r.id }
  delveCommand(cmd)
  after?.()
}

function RoomCell({ r, cell, testPrefix, after }: { r: MapRoomView; cell: number; testPrefix: string; after?: () => void }) {
  // The whole cell is the tap target (44 px); the visible box is drawn 2 px inside it (CSS ::before).
  const style = { left: `${r.x * cell}px`, top: `${r.y * cell}px`, width: `${r.w * cell}px`, height: `${r.h * cell}px` }
  const cls = `dv-mroom dv-mroom--${r.status} ${r.move ? (r.move.enabled ? 'dv-mroom--go' : 'dv-mroom--blocked') : ''} ${r.hunter ? 'dv-mroom--hunter' : ''} ${r.cleared ? 'dv-mroom--cleared' : ''} ${r.threat ? `dv-mroom--${r.threat}` : ''}`
  // With a threat chip at the bottom of the cell, the icon sits a little higher.
  const lift = r.threat ? 7 : 0
  const inner = (
    <>
      <span class="dv-mroom__icon" style={{ left: `${(r.icon.x - r.x) * cell}px`, top: `${(r.icon.y - r.y) * cell - lift}px` }}>
        <Icon name={r.kind ?? 'unknown'} size={r.status === 'current' ? 20 : 17} />
      </span>
      {(r.key || r.hunter || (r.move && !r.move.enabled)) && (
        <span class="dv-mroom__marks">
          {r.key && <Icon name="key" size={12} class="dv-mark--key" />}
          {r.hunter && <Icon name="paw" size={12} class="dv-mark--hunter" />}
          {r.move && !r.move.enabled && <Icon name="lock" size={12} class="dv-mark--lock" />}
        </span>
      )}
      {r.threat && (
        <span class={`dv-threat dv-threat--${r.threat}`} style={{ left: `${(r.icon.x - r.x) * cell}px`, top: `${(r.icon.y - r.y) * cell + 9}px` }} data-testid={`dv-threat-${r.id}`}>
          {THREAT_SHORT[r.threat]}
        </span>
      )}
    </>
  )
  if (r.move)
    return (
      <button class={cls} style={style} data-testid={`${testPrefix}${r.id}`} aria-label={roomTitle(r)} title={roomTitle(r)} aria-disabled={!r.move.enabled} onClick={() => go(r, after)}>
        {inner}
      </button>
    )
  return (
    <div class={cls} style={style} title={roomTitle(r)}>
      {inner}
    </div>
  )
}

function MapGrid({ view, cell, x0, y0, cols, rows, testPrefix, after }: { view: MapView; cell: number; x0: number; y0: number; cols: number; rows: number; testPrefix: string; after?: () => void }) {
  return (
    <div class="dv-mapgrid" style={{ width: `${cols * cell}px`, height: `${rows * cell}px` }}>
      <div class="dv-mapgrid__layer" style={{ transform: `translate(${-x0 * cell}px, ${-y0 * cell}px)` }}>
        {view.rooms.map((r) => (
          <RoomCell key={r.id} r={r} cell={cell} testPrefix={testPrefix} after={after} />
        ))}
        {view.doors.map((d) => {
          const long = cell * 0.34
          const style = d.vertical
            ? { left: `${d.x * cell - 3}px`, top: `${d.y * cell - long / 2}px`, width: '6px', height: `${long}px` }
            : { left: `${d.x * cell - long / 2}px`, top: `${d.y * cell - 3}px`, width: `${long}px`, height: '6px' }
          return <span key={`${d.x},${d.y}`} class={`dv-mdoor ${d.locked ? 'dv-mdoor--locked' : ''} ${d.secret ? 'dv-mdoor--secret' : ''}`} style={style} />
        })}
      </div>
    </div>
  )
}

export function Minimap() {
  void delveVersion.value
  const d = delve.value
  if (!d) return null
  const view = mapView(d, legalActions.value, threatsOf(content.value, d))
  const { x0, y0 } = mapWindow(view, MINI_COLS, MINI_ROWS)
  return (
    <div class="dv-minimap" data-testid="dv-minimap">
      <MapGrid view={view} cell={MAP_CELL} x0={x0} y0={y0} cols={MINI_COLS} rows={MINI_ROWS} testPrefix="dv-move-" />
    </div>
  )
}

const LEGEND = ['entry', 'fight', 'elite', 'rest', 'merchant', 'treasure', 'curio', 'trapGauntlet', 'secret', 'keyRoom', 'stairs', 'boss'] as const
const BANDS = ['easy', 'even', 'dangerous', 'deadly'] as const

export function MapModal({ onClose }: { onClose: () => void }) {
  void delveVersion.value
  const d = delve.value
  if (!d) return null
  const view = mapView(d, legalActions.value, threatsOf(content.value, d))
  const shown = new Set(view.rooms.map((r) => r.kind).filter((k): k is string => k !== null))
  const bands = new Set(view.rooms.map((r) => r.threat).filter((b): b is ThreatBandLike => b !== null))
  return (
    <Modal title={`Floor ${d.floor.number}`} onClose={onClose} testid="dv-mapmodal">
      <div class="dv-bigmap">
        <MapGrid view={view} cell={MAP_CELL} x0={0} y0={0} cols={view.grid.w} rows={view.grid.h} testPrefix="dv-mapmove-" after={onClose} />
        <div class="dv-legend">
          <p class="dv-legend__hint">Tap a lit room next to yours to walk there.</p>
          <ul>
            {LEGEND.filter((k) => shown.has(k)).map((k) => (
              <li key={k}>
                <Icon name={k} size={16} /> {KIND_SHORT[k]}
              </li>
            ))}
            <li>
              <Icon name="unknown" size={16} /> Not scouted
            </li>
            {view.rooms.some((r) => r.hunter) && (
              <li class="dv-legend__hunter">
                <Icon name="paw" size={16} /> The hunter
              </li>
            )}
          </ul>
          {bands.size > 0 && (
            <ul class="dv-legend__threats" aria-label="Threat">
              {BANDS.filter((b) => bands.has(b)).map((b) => (
                <li key={b}>
                  <span class={`dv-threat dv-threat--${b} dv-threat--inline`}>{THREAT_SHORT[b]}</span> {THREAT_NAMES[b]}
                </li>
              ))}
            </ul>
          )}
          <button class="btn btn--plain dv-legend__close" data-testid="dv-mapclose" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
