/**
 * The director (Phase 8; the shape is Wildsong Ranch's director). A pure function turns the scene — the screen, the town
 * place, the delve's zone, room and fight — into a request: which piece, arrangement, layers and stem, which ambience bed
 * and reverb. `places.json` holds the tables (zones, bosses, the King's hunters, the town's stems). The stinger rules
 * live here too, so the tests can read them without an AudioContext:
 *
 * - title and New hero: Emberfall's title arrangement; the town: Emberfall with the place's stem and bed;
 * - a delve's rooms: the zone's piece (`rest` in a rest room, `spider` where spiders wait); its fights: the zone's
 *   fight piece (`tension` when the party is in trouble); a boss: the boss's piece with a layer per phase shown, and on
 *   the throne a layer for each hunter that answered the King; a wipe: silence over the zone's bed;
 * - a won fight ends on `victory` (`bossVictory` for a boss), then `levelUp` if anyone grew a level, then `rareDrop`
 *   for an A-grade find or better; a lost one on `defeat`; a boss's new phase on `bossPhase`.
 */
import PLACES from './places.json'
import type { ReverbPreset } from './engine/reverb.ts'

export interface FightScene {
  /** The fight's kind (DelveState.fightContext). */
  kind: string
  /** The boss's monster id in an arena fight, else null. */
  bossId: string | null
  /** The boss's phase as the playback has shown it (1-based). */
  phase: number
  /** The hunters that answered the King, as shown (monster ids). */
  hunters: readonly string[]
  /** A hero is down or the party's HP is low (tuning dangerHpPercent). */
  danger: boolean
}

export interface DelveScene {
  /** The zone the party is in (content zone id), or null when unknown. */
  zoneId: string | null
  phase: 'room' | 'fight' | 'result' | 'curio' | 'over'
  /** The delve's outcome once it is over. */
  outcome: string | null
  /** The current room's kind (rest, boss, …). */
  roomKind: string | null
  /** Spiders wait in this room (07 §2.2: tremolo harp in spider rooms). */
  spiders: boolean
  fight: FightScene | null
}

export interface Scene {
  screen: string
  /** `#town&place=<id>`, or null on the hub. */
  townPlace: string | null
  /** A save is loaded (the town without one shows the title). */
  hasProfile: boolean
  delve: DelveScene | null
}

export interface SongRequest {
  id: string
  arrangement: string | null
  layers: readonly string[]
  stem: string | null
  /** Seconds of crossfade when this replaces another piece. */
  crossfadeSec: number
}

export interface BedRequest {
  id: string
  /** A rest room adds its campfire. */
  campfire: boolean
}

export interface Request {
  /** `keep` leaves the music as it is (settings, the hero sheet, the gallery). */
  song: SongRequest | null | 'keep'
  bed: BedRequest | null | 'keep'
  reverb: ReverbPreset | 'keep'
}

export type ZoneMusic = { explore: string; fight: string; bed: string; reverb: string; pack: string }

const KEEP: Request = { song: 'keep', bed: 'keep', reverb: 'keep' }
const NEEDS_PROFILE = new Set(['town', 'hero', 'delve'])
const TOWN_BEDS: Readonly<Record<string, string>> = { inn: 'town-inn', blacksmith: 'town-forge', shrine: 'town-shrine' }
const INDOORS = new Set(['inn', 'blacksmith', 'skills', 'curio', 'bank', 'shrine'])

export function zoneMusic(zoneId: string | null): ZoneMusic {
  const zones = PLACES.zones as Record<string, ZoneMusic>
  return (zoneId ? zones[zoneId] : undefined) ?? zones.default!
}

function song(id: string, extra: Partial<SongRequest> = {}): SongRequest {
  return { id, arrangement: null, layers: ['main'], stem: null, crossfadeSec: 1.5, ...extra }
}

/** The layers a boss piece plays: one per phase shown, and on the throne one per hunter that answered. */
export function bossLayers(phase: number, hunters: readonly string[]): string[] {
  const out = ['base']
  if (phase >= 2) out.push('phase2')
  if (phase >= 3) out.push('phase3')
  const map = PLACES.hunterLayers as Record<string, string>
  for (const h of hunters) {
    const l = map[h]
    if (l && !out.includes(l)) out.push(l)
  }
  return out
}

function title(): Request {
  return { song: song('emberfall', { arrangement: 'title' }), bed: null, reverb: 'outdoor' }
}

export function decide(scene: Scene): Request {
  const screen = NEEDS_PROFILE.has(scene.screen) && !scene.hasProfile ? 'title' : scene.screen
  switch (screen) {
    case 'title':
    case 'new-hero':
      return title()
    case 'town': {
      const place = scene.townPlace ?? 'hub'
      const stems = PLACES.townStems as Record<string, string>
      return {
        song: song('emberfall', { stem: stems[place] ?? 'square' }),
        bed: { id: TOWN_BEDS[place] ?? 'town', campfire: false },
        reverb: INDOORS.has(place) ? 'room' : 'outdoor',
      }
    }
    case 'delve':
    case 'autoplay':
      return scene.delve ? delveRequest(scene.delve) : KEEP
    default:
      return KEEP
  }
}

function delveRequest(d: DelveScene): Request {
  const zone = zoneMusic(d.zoneId)
  const reverb = zone.reverb as ReverbPreset
  const bed = (campfire = false): BedRequest => ({ id: zone.bed, campfire })
  if (d.phase === 'over') {
    if (d.outcome === 'wiped' || d.outcome === 'chosenDied') return { song: null, bed: bed(), reverb }
    return { song: song(zone.explore, { layers: d.outcome === 'cleared' ? ['rest'] : ['main'] }), bed: bed(), reverb }
  }
  if (d.fight) {
    const f = d.fight
    const bosses = PLACES.bosses as Record<string, string>
    const boss = f.bossId ? bosses[f.bossId] : undefined
    if (boss) return { song: song(boss, { layers: bossLayers(f.phase, f.hunters), crossfadeSec: 0.6 }), bed: bed(), reverb }
    return { song: song(zone.fight, { layers: f.danger ? ['base', 'drive', 'tension'] : ['base', 'drive'], crossfadeSec: 0.6 }), bed: bed(), reverb }
  }
  const rest = d.roomKind === 'rest'
  const layers = rest ? ['rest'] : d.spiders ? ['main', 'spider'] : ['main']
  return { song: song(zone.explore, { layers }), bed: bed(rest), reverb }
}

/* ---------- the stingers ---------- */

export type StingerName = 'victory' | 'bossVictory' | 'defeat' | 'levelUp' | 'rareDrop' | 'bossPhase'

export interface FightEnd {
  outcome: string
  boss: boolean
  /** Heroes who grew at least one level in this fight. */
  levelUps: number
  /** A find of a rare grade (tuning rareGrades) came out of it. */
  rare: boolean
}

/** The chain of stingers a fight's end plays, in order (a flight or a capped fight plays none). */
export function endStingers(e: FightEnd): StingerName[] {
  if (e.outcome === 'defeat') return ['defeat']
  if (e.outcome !== 'victory') return []
  const out: StingerName[] = [e.boss ? 'bossVictory' : 'victory']
  if (e.levelUps > 0) out.push('levelUp')
  if (e.rare) out.push('rareDrop')
  return out
}

/** Is this grade rare enough for the rare-find stinger? */
export function isRareGrade(grade: string | undefined, rareGrades: readonly string[]): boolean {
  return grade !== undefined && rareGrades.includes(grade)
}
