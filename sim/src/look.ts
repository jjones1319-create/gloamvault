import { hashString } from './rng.ts'
import type { HeroLook, SpeciesDef } from './types/content.ts'
import { BODY_FRAMES, type BodyFrame } from './types/enums.ts'

/**
 * Hero looks (Phase 5): a hero is one body frame, a skin tone and a face preset of their species, and a hair colour
 * (tools/blender/README.md: "a hero is one frame + one species + one face preset + tints"). Looks are cosmetic — no
 * rule reads them — but they live in the save, so they are deterministic (a hash of the hero id when none is given)
 * and clamped to what the species offers.
 */

/** The highest index a look's `hair` may hold (hero.schema.json); the client wraps it to the colours it has. */
export const LOOK_INDEX_MAX = 15

/** FNV-1a, then the murmur3 finaliser so neighbouring ids ("hero-1", "hero-2") spread over every bit. */
function mix(s: string): number {
  let h = hashString(s)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

function counts(species: SpeciesDef | undefined): { tones: number; faces: number } {
  return { tones: Math.max(1, species?.body.skinTones.length ?? 1), faces: Math.max(1, species?.body.facePresets ?? 1) }
}

/** The look a hero has when nobody chose one: the same id always gives the same look. */
export function defaultLook(id: string, species: SpeciesDef | undefined): HeroLook {
  const h = mix(`look:${id}`)
  const { tones, faces } = counts(species)
  return { frame: BODY_FRAMES[h & 1]!, skin: (h >>> 1) % tones, face: (h >>> 5) % faces, hair: (h >>> 9) % (LOOK_INDEX_MAX + 1) }
}

function index(v: unknown, n: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(n - 1, Math.max(0, Math.round(v))) : fallback
}

/** Anything that claims to be a look, made valid for the species: bad or missing fields take the id's default. */
export function clampLook(raw: unknown, species: SpeciesDef | undefined, id: string): HeroLook {
  const d = defaultLook(id, species)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return d
  const r = raw as Record<string, unknown>
  const { tones, faces } = counts(species)
  return {
    frame: (BODY_FRAMES as readonly unknown[]).includes(r.frame) ? (r.frame as BodyFrame) : d.frame,
    skin: index(r.skin, tones, d.skin),
    face: index(r.face, faces, d.face),
    hair: index(r.hair, LOOK_INDEX_MAX + 1, d.hair),
  }
}
