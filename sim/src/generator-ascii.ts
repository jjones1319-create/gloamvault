/**
 * An ASCII picture of a generated floor in the style of 07-DUNGEONS.md §2.10's worked example, grid-accurate:
 * one `[X]` per cell, `-----`/`|` for doors, `--#--`/`#` on the locked door, `--?--`/`?` on the secret door,
 * `=====`/`:` joining the cells of one multi-cell room (lower-case letters mark its continuation cells).
 * Used by the `#gen` deep link (07 §8.3 #5) and the balance runner's failure prints.
 */
import type { DoorSide, FloorGraph, FloorRoom, RoomKind } from './generator.ts'

export const ROOM_LETTERS: Readonly<Record<RoomKind, string>> = {
  entry: 'E',
  fight: 'F',
  elite: 'L',
  rest: 'R',
  merchant: 'M',
  treasure: 'T',
  curio: 'C',
  trapGauntlet: 'G',
  secret: 'X',
  stairs: 'S',
  boss: 'B',
  keyRoom: 'K',
}

export const ASCII_LEGEND =
  'E Entry · F Fight · L Elite · R Rest · M Merchant · T Treasure · C Curio · G Gauntlet · K Key room · X Secret · S Stairs · B Boss · # locked door · ? secret door · = : same room'

/** The letter a room draws with: K for the room that holds the Key, else its kind's letter. */
export function roomLetter(room: Pick<FloorRoom, 'kind' | 'hasKey'>): string {
  return room.hasKey ? 'K' : ROOM_LETTERS[room.kind]
}

/** The grid cell a room's door sits on (doors are on the room's bounding box, offset from the side's left/top). */
export function doorCell(room: FloorRoom, door: { side: DoorSide; offset: number }): { x: number; y: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of room.cells) {
    if (c.x < minX) minX = c.x
    if (c.y < minY) minY = c.y
    if (c.x > maxX) maxX = c.x
    if (c.y > maxY) maxY = c.y
  }
  switch (door.side) {
    case 'north':
      return { x: minX + door.offset, y: minY }
    case 'south':
      return { x: minX + door.offset, y: maxY }
    case 'west':
      return { x: minX, y: minY + door.offset }
    case 'east':
      return { x: maxX, y: minY + door.offset }
  }
}

export function renderFloorAscii(graph: FloorGraph): string {
  const { w, h } = graph.grid
  const at = (x: number, y: number): number => y * w + x
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h
  const cell = new Map<number, string>()
  const hLink = new Map<number, string>() // key: the left cell of a horizontal pair
  const vLink = new Map<number, string>() // key: the upper cell of a vertical pair

  for (const room of graph.rooms) {
    const letter = roomLetter(room)
    const cells = room.cells.slice().sort((a, b) => a.y - b.y || a.x - b.x)
    const own = new Set(cells.map((c) => at(c.x, c.y)))
    cells.forEach((c, i) => {
      if (!inside(c.x, c.y)) return
      cell.set(at(c.x, c.y), i === 0 ? letter : letter.toLowerCase())
      if (own.has(at(c.x + 1, c.y))) hLink.set(at(c.x, c.y), '=')
      if (own.has(at(c.x, c.y + 1))) vLink.set(at(c.x, c.y), ':')
    })
    for (const door of room.doors) {
      const mark = door.locked ? '#' : door.secret ? '?' : '-'
      const c = doorCell(room, door)
      if (!inside(c.x, c.y)) continue
      if (door.side === 'east') hLink.set(at(c.x, c.y), mark)
      else if (door.side === 'west' && c.x > 0) hLink.set(at(c.x - 1, c.y), mark)
      else if (door.side === 'south') vLink.set(at(c.x, c.y), mark)
      else if (door.side === 'north' && c.y > 0) vLink.set(at(c.x, c.y - 1), mark)
    }
  }

  const lines: string[] = []
  const rooms = graph.rooms.length
  lines.push(
    `Floor ${graph.floor} (${graph.kind}) · seed ${graph.seed[0]},${graph.seed[1]} · ${rooms} rooms · ${graph.forks} forks · retries ${graph.retries} · hash ${graph.hash.toString(16).padStart(8, '0')}`,
  )
  let header = 'col→   '
  for (let x = 0; x < w; x++) header += (x === 0 ? '' : '     ') + String(x + 1).padStart(2, ' ').padEnd(3, ' ')
  lines.push(header.trimEnd())
  for (let y = 0; y < h; y++) {
    let row = `row ${String(y + 1).padEnd(3, ' ')}`
    for (let x = 0; x < w; x++) {
      const letter = cell.get(at(x, y))
      row += letter ? `[${letter}]` : ' . '
      if (x < w - 1) {
        const link = hLink.get(at(x, y))
        row += link === undefined ? '     ' : link === '=' ? '=====' : link === '-' ? '-----' : `--${link}--`
      }
    }
    lines.push(row.trimEnd())
    if (y < h - 1) {
      let joins = '       '
      for (let x = 0; x < w; x++) {
        const link = vLink.get(at(x, y))
        joins += ` ${link === undefined ? ' ' : link === '-' ? '|' : link} ` + (x < w - 1 ? '     ' : '')
      }
      lines.push(joins.trimEnd())
    }
  }
  lines.push('')
  lines.push(ASCII_LEGEND)
  return lines.join('\n')
}
