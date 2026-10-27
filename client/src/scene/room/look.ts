/**
 * The party's light as the room's lighting (03 §4.2): one dial read at a glance. Radiant rooms are bright with a
 * thin haze; Pitch is a dim room with the torch out and the fog closing in. Pure numbers, tested in Node; the
 * scene tweens toward them when the light changes.
 */
export type BandId = 'radiant' | 'dim' | 'shadowy' | 'dark' | 'pitch'

export interface LightLook {
  /** Hemisphere (ambient) intensity. */
  hemi: number
  /** The party's torch: a warm point light over the party (0 when the light is out). */
  torch: number
  /** How far the torch reaches, metres. */
  torchRange: number
  /** Fog density × the camera's distance: the haze at the room's centre is 1 − e^(−k²). */
  fogK: number
  /** The room's own fire (sconces, a brazier) is steady whatever the party carries. */
  fire: number
}

export function lightLook(light: number): LightLook {
  const t = Math.max(0, Math.min(1, light / 100))
  return {
    hemi: 0.34 + 0.95 * t,
    torch: light <= 0 ? 0 : 5 + 25 * t,
    torchRange: 7 + 11 * t,
    fogK: 0.78 - 0.52 * t,
    fire: 22,
  }
}

/** The five bands' names for the light meter (D-016). */
export const BAND_NAMES: Readonly<Record<BandId, string>> = {
  radiant: 'Radiant',
  dim: 'Dim',
  shadowy: 'Shadowy',
  dark: 'Dark',
  pitch: 'Pitch',
}
