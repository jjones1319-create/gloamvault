import type * as THREE from 'three'
import type { Content } from '../../../../sim/src/content.ts'
import { assembleCharacter, type CharacterModel } from './assembler.ts'
import { heroLibrary, type HeroLibrary } from './assets.ts'
import type { CharacterSpec } from './outfit.ts'

/**
 * Builds a character from a spec: loads (once, shared) the frame file, the gear sets it wears, the weapons, the
 * manifest and the clips, then assembles synchronously. Null when the hero file itself is missing or something
 * fails — the caller keeps its placeholder.
 */
export async function buildCharacter(content: Content, spec: CharacterSpec, library: HeroLibrary = heroLibrary): Promise<CharacterModel | null> {
  try {
    const template = await library.frame(spec.frame)
    if (!template) return null
    const sets = new Set<string>()
    if (spec.gear) {
      for (const p of spec.outfit.pieces) {
        const set = [p.setClass, ...p.fallbacks].find((s) => library.hasGear(s, spec.frame))
        if (set) sets.add(set)
      }
    }
    const setList = [...sets]
    const [manifest, clips, weapons, ...gearMaps] = await Promise.all([
      library.manifest(),
      library.clips(),
      spec.gear && spec.outfit.weapons.length > 0 ? library.weapons() : Promise.resolve(null),
      ...setList.map((s) => library.gear(s, spec.frame)),
    ])
    const gear = new Map<string, ReadonlyMap<string, THREE.Mesh>>()
    setList.forEach((s, i) => {
      const m = gearMaps[i]
      if (m) gear.set(s, m)
    })
    return assembleCharacter(content, spec, { template, gear, weapons, manifest, clips })
  } catch (e) {
    console.warn('character assembly failed', e)
    return null
  }
}
