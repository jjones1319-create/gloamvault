import * as THREE from 'three'
import { acquireRamp, releaseRamp } from '../characters/material.ts'
import { paletteUniform } from '../characters/palette.ts'
import { AO_FLOOR, VARIATION_RANGE } from './envData.ts'

/**
 * The environment material (Phase 6): ONE per zone, shared by every kit piece of a room, so a room's draw calls are its
 * distinct pieces. A MeshToonMaterial on the heroes' 4-step ramp (characters/material.ts) whose shader reads each
 * vertex's decoded `gv` code — the zone palette's colour for its slot, a light/dark shift for its variation, its baked
 * ambient occlusion multiplied in (envData.ts `envShade` is the same sum) — and lets the glow and crystal slots (11, 14)
 * emit. It works on plain and instanced meshes alike; the room's fog and its two torches light it.
 *
 * Two siblings per zone: `translucent` (mist and webs, see-through at a fixed opacity) and `water` (the Vault's slot-15
 * faces, see-through by their own vertex alpha, with a slow caustic shimmer in world space).
 */
export const ENV_ATTRIBUTE = 'gvEnv'
/** Water's opacity per vertex (COLOR_0.A), on the water geometry only. */
export const ENV_ALPHA = 'gvAlpha'

export interface EnvMaterial {
  material: THREE.MeshToonMaterial
  setPalette(hexes: readonly string[]): void
  /** Glow strength of the emissive slots (1 = the palette colour at full). */
  setGlow(k: number): void
  /** Seconds, for the water's shimmer (held still with Reduce motion). */
  setTime(t: number): void
  dispose(): void
}

export function createEnvMaterial(hexes: readonly string[], opts: { translucent?: boolean; water?: boolean } = {}): EnvMaterial {
  const palette = { value: paletteUniform(hexes) }
  const glow = { value: 1 }
  const time = { value: 0 }
  const water = opts.water === true
  const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: acquireRamp() })
  material.name = water ? 'gv-env-water' : opts.translucent ? 'gv-env-translucent' : 'gv-env'
  if (opts.translucent || water) {
    material.transparent = true
    material.opacity = water ? 1 : 0.42
    material.depthWrite = false
    material.side = THREE.DoubleSide
    // One pass, not three.js's back-then-front pair for see-through double-sided things (Phase 8): a mist plane, a pool
    // or a falling sheet is one layer, so the second pass only cost a draw call and its fill.
    material.forceSinglePass = true
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEnvPalette = palette
    shader.uniforms.uEnvGlow = glow
    shader.uniforms.uEnvTime = time
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 ${ENV_ATTRIBUTE};\nvarying vec3 vGvEnv;${water ? `\nattribute float ${ENV_ALPHA};\nvarying float vGvAlpha;\nvarying vec3 vGvWorld;` : ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvGvEnv = ${ENV_ATTRIBUTE};${
          water
            ? `\nvGvAlpha = ${ENV_ALPHA};
        #ifdef USE_INSTANCING
          vGvWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
        #else
          vGvWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        #endif`
            : ''
        }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uEnvPalette[16];\nuniform float uEnvGlow;\nuniform float uEnvTime;\nvarying vec3 vGvEnv;${water ? '\nvarying float vGvAlpha;\nvarying vec3 vGvWorld;' : ''}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        int gvIdx = clamp( int( vGvEnv.x + 0.5 ), 0, 15 );
        vec3 gvCol = uEnvPalette[ gvIdx ];
        float gvShade = ( 1.0 + ( clamp( vGvEnv.y, 0.0, 1.0 ) - 0.5 ) * ${VARIATION_RANGE.toFixed(3)} ) * mix( ${AO_FLOOR.toFixed(3)}, 1.0, clamp( vGvEnv.z, 0.0, 1.0 ) );
        diffuseColor.rgb *= gvCol * gvShade;
        if ( gvIdx == 11 || gvIdx == 14 ) totalEmissiveRadiance += gvCol * uEnvGlow;${
          water
            ? `
        float gvCaustic = 0.5 + 0.5 * sin( vGvWorld.x * 2.3 + uEnvTime * 1.1 ) * sin( vGvWorld.z * 2.7 - uEnvTime * 0.9 );
        diffuseColor.rgb *= 0.88 + 0.3 * gvCaustic;
        totalEmissiveRadiance += gvCol * 0.07 * gvCaustic;
        diffuseColor.a *= clamp( vGvAlpha, 0.0, 1.0 );`
            : ''
        }`,
      )
  }
  // Every zone's material compiles to the same program (only the uniforms differ); water is its own.
  material.customProgramCacheKey = () => (water ? 'gv-env-water-1' : 'gv-env-1')
  let disposed = false
  return {
    material,
    setPalette(next) {
      paletteUniform(next, palette.value)
    },
    setGlow(k) {
      glow.value = k
    },
    setTime(t) {
      time.value = t
    },
    dispose() {
      if (disposed) return
      disposed = true
      material.dispose()
      releaseRamp()
    },
  }
}
