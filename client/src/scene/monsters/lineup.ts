/**
 * The monster lineup's pure side (Phase 6, `#viewer=monsters&zone=…`): which monsters a zone shows, in what order,
 * under what names, and where each stands. Pure, tested in node.
 */
import type { MonsterManifest, MonsterVariant } from './manifest.ts'

export type LineupZone = 'cellars' | 'crypts' | 'vault' | 'pets' | 'all'

/** 06 §3.2–3.4's Crypts and Vault monsters, in kebab case, whose content JSON arrives in Phase 7. */
const CRYPTS = ['skeleton-footman', 'skeleton-archer', 'bone-knight', 'crypt-sexton', 'grave-bat', 'shambling-corpse', 'bursting-corpse', 'ghoul', 'wraith', 'tomb-spider', 'charnel-hulk', 'wardens-hound', 'barrow-warden']
const VAULT = ['tidebound-acolyte', 'tidebound-blade', 'tidebound-flagellant', 'tidebound-drowner', 'drowned-thrall', 'vault-lantern', 'deep-tentacle', 'deep-maw', 'vault-sentinel', 'brine-hag', 'brine-ooze', 'pearl-ooze', 'vault-leech', 'sister-naesa', 'naesa-arm', 'hollow-king']

export function lineupZone(v: string | undefined): LineupZone {
  return v === 'cellars' || v === 'crypts' || v === 'vault' || v === 'pets' ? v : 'all'
}

/** A monster's zone: the manifest's word, the content's zone, else 06's lists. */
export function zoneOfMonster(id: string, variant: MonsterVariant | null, contentZone: string | undefined): Exclude<LineupZone, 'all'> {
  if (variant?.pet) return 'pets'
  const z = (variant?.zone ?? contentZone ?? '').toLowerCase()
  if (/vault|drown/.test(z)) return 'vault'
  if (/crypt/.test(z)) return 'crypts'
  if (/cellar/.test(z)) return 'cellars'
  const key = id.replace(/^the-/, '')
  if (VAULT.includes(key)) return 'vault'
  if (CRYPTS.includes(key)) return 'crypts'
  return 'cellars'
}

/** "giant-rat" → "Giant Rat"; "wardens-hound" → "Wardens Hound" (the content's name wins when there is one). */
export function titleOf(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** A name short enough for a label: a title after a comma is dropped ("Captain Vexa Marrow, the Grinning Captain"). */
export function labelName(name: string): string {
  const cut = name.indexOf(', ')
  return cut > 0 ? name.slice(0, cut) : name
}

export interface LineupEntry {
  id: string
  name: string
  variant: MonsterVariant
  zone: Exclude<LineupZone, 'all'>
}

/** The manifest's monsters (and pets) for a zone, smallest first, then by name. */
export function lineupEntries(manifest: MonsterManifest, zone: LineupZone, info: (id: string) => { name?: string; zone?: string; size?: number } | undefined): LineupEntry[] {
  const out: (LineupEntry & { size: number })[] = []
  const add = (v: MonsterVariant) => {
    const i = info(v.id)
    const z = zoneOfMonster(v.id, v, i?.zone)
    if (zone !== 'all' && z !== zone) return
    out.push({ id: v.id, name: labelName(v.name ?? i?.name ?? titleOf(v.id)), variant: v, zone: z, size: (i?.size ?? 1) * v.scale })
  }
  for (const v of manifest.monsters.values()) add(v)
  for (const v of manifest.pets.values()) add(v)
  out.sort((a, b) => a.size - b.size || a.name.localeCompare(b.name))
  return out.map(({ size: _size, ...e }) => e)
}

/**
 * Where each of `widths` stands on a line (centres, metres), with `gap` between neighbours, the line centred on 0;
 * more than `perRow` makes rows of even length, each `rowM` behind the one before.
 */
export function lineupSpots(widths: readonly number[], gap = 0.6, perRow = 8, rowM = 3.2): { x: number; z: number; row: number; col: number }[] {
  const rows = Math.max(1, Math.ceil(widths.length / perRow))
  const per = Math.ceil(widths.length / rows)
  const out: { x: number; z: number; row: number; col: number }[] = []
  for (let r = 0; r < rows; r++) {
    const ws = widths.slice(r * per, (r + 1) * per)
    const total = ws.reduce((s, w) => s + w, 0) + gap * Math.max(0, ws.length - 1)
    let x = -total / 2
    ws.forEach((w, col) => {
      out.push({ x: x + w / 2, z: r === 0 ? 0 : -r * rowM, row: r, col })
      x += w + gap
    })
  }
  return out
}
