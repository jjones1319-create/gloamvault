import type { MapView } from './mapLayout.ts'

/**
 * The Blind Map Pact (07 §6.2: "no minimap, no scouting, Cartography does nothing"): the map keeps no memory of the
 * floor — only the room the party stands in, the rooms its doors lead to (so the party can still move) and those
 * doors. A neighbour never entered shows as an unknown door; one already walked through keeps its kind. The hunter is
 * still shown when it stands next door (03 §4.5: "made fair and visible"). Pure, tested in Node.
 */
export function blindView(view: MapView): MapView {
  const here = view.rooms.find((r) => r.status === 'current')
  if (!here) return view
  const rooms = view.rooms.filter((r) => r.status === 'current' || r.move !== null)
  const onEdge = (d: MapView['doors'][number]) =>
    (d.x >= here.x - 1e-6 && d.x <= here.x + here.w + 1e-6 && (Math.abs(d.y - here.y) < 1e-6 || Math.abs(d.y - (here.y + here.h)) < 1e-6)) ||
    (d.y >= here.y - 1e-6 && d.y <= here.y + here.h + 1e-6 && (Math.abs(d.x - here.x) < 1e-6 || Math.abs(d.x - (here.x + here.w)) < 1e-6))
  return { ...view, rooms, doors: view.doors.filter(onEdge) }
}

/** True when the delve runs under a Pact that takes the map away. */
export function isBlind(ruleFlags: readonly string[]): boolean {
  return ruleFlags.includes('no-minimap')
}
