/**
 * The pieces, one lazy chunk each (Phase 8). The runtime imports a piece when its place is first shown; the tests import
 * them all.
 */
import type { Song } from '../song.ts'

export const SONG_IDS = ['emberfall', 'cellars', 'cellars-fight', 'vexa', 'crypts', 'crypts-fight', 'warden', 'vault', 'vault-fight', 'naesa', 'throne'] as const
export type SongId = (typeof SONG_IDS)[number]

export const SONG_LOADERS: Record<SongId, () => Promise<{ default: Song }>> = {
  emberfall: () => import('./emberfall.ts'),
  cellars: () => import('./cellars.ts'),
  'cellars-fight': () => import('./cellars-fight.ts'),
  vexa: () => import('./vexa.ts'),
  crypts: () => import('./crypts.ts'),
  'crypts-fight': () => import('./crypts-fight.ts'),
  warden: () => import('./warden.ts'),
  vault: () => import('./vault.ts'),
  'vault-fight': () => import('./vault-fight.ts'),
  naesa: () => import('./naesa.ts'),
  throne: () => import('./throne.ts'),
}

export function isSongId(id: string): id is SongId {
  return (SONG_IDS as readonly string[]).includes(id)
}

const cache = new Map<SongId, Promise<Song>>()

export function loadSong(id: SongId): Promise<Song> {
  let p = cache.get(id)
  if (!p) {
    p = SONG_LOADERS[id]().then((m) => m.default)
    // A chunk that failed to load (offline before it was cached) may be tried again next time.
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

/** Every piece, for the tests. */
export async function loadAllSongs(): Promise<Record<SongId, Song>> {
  const entries = await Promise.all(SONG_IDS.map(async (id) => [id, await loadSong(id)] as const))
  return Object.fromEntries(entries) as Record<SongId, Song>
}
