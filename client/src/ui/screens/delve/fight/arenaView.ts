import type { Content } from '../../../../../../sim/src/content.ts'
import type { Actor, FightEvent, FightState, LegalFightAction } from '../../../../../../sim/src/fight-types.ts'

/**
 * The boss arena's HUD, its pure side (Phase 7; 07 §2.8, 06 §8.10, D-099): the chips the fight shows for the arena
 * (the phase, the light, the tide, the braziers, the candles, the barricade, the bone piles), the tells on show with
 * their two-word hints, and the Arena actions' rows. No DOM: Arena.tsx draws what this computes.
 */

export interface ArenaChip {
  key: string
  label: string
  value: string
  /** A colour family for the chip (the light's band, the water, a warning). */
  tone: string
  /** The one-line detail a tap shows. */
  title: string
  /** Steps to draw as pips (the tide's, the braziers'). */
  pips?: { on: number; of: number }
}

export interface TellPill {
  key: string
  /** Who shows it: an actor id, or null for the room itself. */
  actorId: string | null
  /** The two-word hint (D-099). */
  hint: string
  /** The words show the first time the hint fires; afterwards the cue alone (D-099). */
  words: boolean
  /** The detail a tap shows: who, the cue, what follows. */
  title: string
}

export interface ArenaRow {
  propId: string
  label: string
  enabled: boolean
  reason?: string
}

const BAND_NAMES: Readonly<Record<string, string>> = { radiant: 'Radiant', dim: 'Dim', shadowy: 'Shadowy', dark: 'Dark', pitch: 'Pitch' }

/** The light band of a light value, from tuning's bands (03 §4.2). */
export function bandOf(c: Content, light: number): string {
  for (const b of c.tuning.exploration.light.bands) if (light >= b.min && light <= b.max) return b.id
  return 'pitch'
}

/** The arena's chips, in reading order; empty outside a boss arena. */
export function arenaChips(c: Content, fight: FightState): ArenaChip[] {
  const arena = fight.arena
  if (!arena) return []
  const out: ArenaChip[] = []
  const def = c.monsters.get(arena.bossId)
  const phases = def?.boss?.phases ?? []
  const phase = phases[arena.phase - 1]
  if (phases.length > 1) out.push({ key: 'phase', label: 'Phase', value: `${arena.phase}/${phases.length}`, tone: 'phase', title: phase?.name ? `${def?.name ?? 'The boss'}: ${phase.name}` : `${def?.name ?? 'The boss'}: phase ${arena.phase} of ${phases.length}` })
  const band = bandOf(c, fight.light)
  out.push({ key: 'light', label: 'Light', value: `${fight.light} · ${BAND_NAMES[band] ?? band}`, tone: `light-${band}`, title: `The arena's light: ${fight.light} (${BAND_NAMES[band] ?? band}). In the dark the monsters hit harder and surer (03 §4.2).` })
  const tideRule = def?.boss?.arena?.rules.some((r) => r.kind === 'tide') ?? false
  if (arena.tide && (tideRule || arena.tide.level > 0)) {
    out.push({
      key: 'tide',
      label: 'Tide',
      value: arena.tide.stopped ? 'stopped' : `${arena.tide.level}/${arena.tide.max}`,
      tone: 'tide',
      title: tideRule ? `The water stands at step ${arena.tide.level} of ${arena.tide.max}: at 2 the back row wades, at 3 Lightning runs through it, at 4 the deep rises. The sluice wheel lowers it.` : `The water stands at step ${arena.tide.level} of ${arena.tide.max}.`,
      pips: { on: arena.tide.level, of: arena.tide.max },
    })
  }
  const braziers = arena.props.filter((p) => p.kind === 'brazier')
  if (braziers.length > 0) {
    const lit = braziers.filter((p) => p.done).length
    out.push({ key: 'braziers', label: 'Braziers', value: `${lit}/${braziers.length}`, tone: 'fire', title: `${lit} of ${braziers.length} braziers relit this phase. A Torch (Item) relights one: more light, once each per phase.`, pips: { on: lit, of: braziers.length } })
  }
  if (arena.candles) out.push({ key: 'candles', label: 'Candles', value: `${arena.candles.lit}/${arena.candles.of}`, tone: arena.candles.of - arena.candles.lit >= 6 ? 'warn' : 'fire', title: `${arena.candles.lit} of ${arena.candles.of} candles still lit. One goes out each round; at six out the secret doors open.` })
  if (arena.doorsOpen) out.push({ key: 'doors', label: 'Doors', value: 'open', tone: 'warn', title: 'The secret doors stand open.' })
  if (arena.barricade) {
    const kegs = arena.props.filter((p) => p.kind === 'keg' && !p.done).length
    out.push({ key: 'barricade', label: 'Barricade', value: `${kegs} keg${kegs === 1 ? '' : 's'}`, tone: 'warn', title: 'While the barricade stands, melee cannot reach her back row (bows, spells and spears can). Shoot a keg (Arena) to spill it: monsters that change rows on the wet floor slip.' })
  }
  const piles = arena.props.filter((p) => p.kind === 'pile')
  if (piles.length > 0) {
    const live = piles.filter((p) => !p.done).length
    out.push({ key: 'piles', label: 'Bone piles', value: `${live}/${piles.length}`, tone: live > 0 ? 'warn' : 'calm', title: `${live} bone piles the bell can raise Footmen from. Holy or Fire burns one out (Arena).` })
  }
  return out
}

/** The latest tell event for a ref (and actor), for its `first` flag. */
function lastTell(log: readonly FightEvent[], ref: string, actorId: string | null): FightEvent | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!
    if (e.kind === 'tell' && e.data?.ref === ref && (actorId === null || e.actorId === actorId)) return e
  }
  return undefined
}

/** Every tell on show now: the arena's (the boom, the lamps, a hunter's ring) and each monster's wound-up blow. */
export function tellPills(fight: FightState): TellPill[] {
  const out: TellPill[] = []
  for (const t of fight.arena?.tells ?? []) {
    const e = lastTell(fight.log, t.id, null)
    out.push({ key: `arena-${t.id}`, actorId: t.actorId, hint: t.hint, words: e?.data?.first === true, title: `${t.hint}: ${t.cue}` })
  }
  for (const a of fight.actors) {
    const w = a.monster?.windup
    if (!w || a.gone || a.fled) continue
    const e = lastTell(fight.log, w.attackId, a.id)
    const cue = typeof e?.data?.cue === 'string' ? e.data.cue : w.hint
    const target = w.targetId ? fight.actors.find((x) => x.id === w.targetId)?.name : undefined
    out.push({ key: `windup-${a.id}`, actorId: a.id, hint: w.hint, words: e?.data?.first === true, title: `${a.name} — ${w.hint}${target ? ` (at ${target})` : ''}: ${cue}` })
  }
  return out
}

/** Actors winding a blow up now (the strip and the cards mark them). */
export function tellingIds(fight: FightState): Set<string> {
  return new Set(fight.actors.filter((a: Actor) => a.monster?.windup && !a.gone).map((a) => a.id))
}

/** The pending hero's Arena actions (kegs, piles, the sluice wheel) as sheet rows. */
export function arenaRows(legal: readonly LegalFightAction[]): ArenaRow[] {
  const out: ArenaRow[] = []
  for (const l of legal) {
    if (l.command.kind !== 'arena') continue
    out.push({ propId: l.command.propId, label: l.label, enabled: l.enabled, ...(l.reason ? { reason: l.reason } : {}) })
  }
  return out
}

/** The Torch's line in the item sheet in a throne: what it does there (06 §3.4). */
export function torchNote(fight: FightState, torchValue: number): string | null {
  const braziers = fight.arena?.props.filter((p) => p.kind === 'brazier') ?? []
  if (braziers.length === 0) return null
  const lit = braziers.filter((p) => p.done).length
  return `Relights a brazier: +${torchValue} light (${lit} of ${braziers.length} relit this phase)`
}
