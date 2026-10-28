/**
 * The one-way channel from the screens to the 3D stage (Phase 4): the fight HUD plays the fight log and cues the
 * scene ("this actor was hit for 12", "it is this hero's turn"); the room scene listens and flashes, shakes or
 * highlights. Nothing here touches the sim; a cue with an unknown actor id is ignored by the scene.
 */
export type SceneCueKind = 'turn' | 'target' | 'hit' | 'crit' | 'miss' | 'heal' | 'status' | 'down' | 'gone' | 'flee' | 'revive' | 'clear' | 'anim' | 'fx'

export interface SceneCue {
  kind: SceneCueKind
  /** A fight actor id (`hero-0`, `pet-0`, `giant-rat-1`…); empty for `clear`. */
  actorId: string
  amount?: number
  /** A status id for `status` cues. */
  status?: string
  /** Phase 5, `anim` cues: the clip a hero plays for this beat (Attack_Light, Cast, Shoot, Guard, Victory …). */
  clip?: string
  /** The playback speed (1×, 2×, 3×): clips play that much faster so they keep up with the beats. */
  speed?: number
  /** Phase 6, `anim` cues: a monster's own clips to try before `clip` (a Web, a Howl). */
  alt?: string[]
  /** Phase 6, `fx` cues: the effect (vfx/recipes.ts FxKind), its colour and shape (an Ultimate's), a crit's bigger burst. */
  fx?: string
  color?: number
  shape?: string
  crit?: boolean
  /**
   * Phase 6, `hit`/`crit`/`heal`/`revive` cues: the actor's HP (and max) once the beat has played — the bar is set to
   * it rather than moved by `amount`, so a bar that already shows the blow (a fight that opened with the monsters'
   * turns, a model that arrived mid-beat) is never knocked down twice.
   */
  hp?: number
  maxHp?: number
}

type Listener = (cue: SceneCue) => void
const listeners = new Set<Listener>()

export function cue(c: SceneCue): void {
  for (const l of listeners) {
    try {
      l(c)
    } catch (e) {
      console.warn('scene cue listener failed', e)
    }
  }
}

/** Subscribes the scene; returns the unsubscribe. */
export function onCue(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
