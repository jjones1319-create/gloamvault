import type { Content } from '../../../../../sim/src/content.ts'
import { laterTemplateIds } from '../../../content/viewTemplates.ts'

/**
 * The gallery (Phase 6): every room template — the game's and the Crypts and Vault ones written ahead of Phase 7 — in
 * zone order, each shown with two heroes and the monsters that belong there, so the phone can walk through all of
 * Gravehollow's rooms before their floors are playable (title → Monsters & rooms → Rooms).
 */

const ZONE_OF: Readonly<Record<string, string>> = { cel: 'cellars', cry: 'crypts', vlt: 'vault' }
const ZONE_ORDER = ['cel', 'cry', 'vlt']

/** The zone a template belongs to, by its prefix (`cel-t-…` → cellars). */
export function templateZone(id: string): string {
  return ZONE_OF[id.slice(0, 3)] ?? 'cellars'
}

/** `vlt-t-drowned-chapel` → "Drowned Chapel". */
export function roomTitle(id: string): string {
  return id
    .replace(/^[a-z]+-t-/, '')
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** The monsters a room shows: its own (boss rooms, kennels, galleries), else its zone's; rest rooms stay empty. */
const ROOM_MONSTERS: Readonly<Record<string, string>> = {
  'cel-t-tap-room': 'captain-vexa-marrow,grinning-cutpurse,grinning-bruiser',
  'cel-t-kennels': 'cellar-hound,giant-rat,warren-alpha',
  'cry-t-spider-gallery': 'tomb-spider,cellar-weaver,cellar-spider',
  'cry-t-wardens-vigil': 'barrow-warden,wardens-hound',
  'vlt-t-sentinel-hall': 'vault-sentinel,tidebound-drowner',
  'vlt-t-drowned-chapel': 'sister-naesa,tidebound-acolyte,tidebound-blade',
  'vlt-t-throne': 'hollow-king',
}
const ZONE_MONSTERS: Readonly<Record<string, string>> = {
  cellars: 'giant-rat,cellar-spider,grinning-cutpurse',
  crypts: 'skeleton-footman,bone-knight,skeleton-archer',
  vault: 'tidebound-acolyte,brine-ooze,deep-tentacle',
}
const REST_ROOMS = new Set(['cel-t-cold-hearth', 'cry-t-sextons-cell', 'vlt-t-dry-ledge'])

/** Every template id in gallery order: the Cellars, the Crypts, the Vault, each alphabetical. */
export function galleryRooms(c: Content): string[] {
  const ids = new Set<string>(laterTemplateIds())
  for (const d of c.dungeons.values()) for (const t of d.templates) ids.add(t.id)
  const rank = (id: string) => ZONE_ORDER.indexOf(id.slice(0, 3))
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** The room viewer's params for one gallery stop. */
export function galleryParams(id: string): Record<string, string> {
  const params: Record<string, string> = { room: id, heroes: '2', from: 'gallery' }
  if (REST_ROOMS.has(id)) params.kind = 'rest'
  else params.monsters = ROOM_MONSTERS[id] ?? ZONE_MONSTERS[templateZone(id)] ?? ''
  return params
}

/** The first room of a zone (the lineup's Rooms button; pets and "all" open the Cellars). */
export function firstRoomOf(c: Content, zone: string): string {
  const rooms = galleryRooms(c)
  return rooms.find((id) => templateZone(id) === zone) ?? rooms[0] ?? 'cel-t-storeroom'
}
