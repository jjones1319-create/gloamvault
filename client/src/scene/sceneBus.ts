/**
 * The one-way channel from the screens to the 3D stage (Phase 4): the fight HUD plays the fight log and cues the
 * scene ("this actor was hit for 12", "it is this hero's turn"); the room scene listens and flashes, shakes or
 * highlights. Nothing here touches the sim; a cue with an unknown actor id is ignored by the scene.
 */
export type SceneCueKind = 'turn' | 'target' | 'hit' | 'crit' | 'miss' | 'heal' | 'status' | 'down' | 'gone' | 'revive' | 'clear' | 'anim'

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
