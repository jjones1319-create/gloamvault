import * as THREE from 'three'
import { paletteUniform, SLOT_COUNT } from './palette.ts'

/**
 * One palette toon material per character (tools/blender/README.md §Palette) and its inverted-hull outline, so an
 * assembled hero is two draw calls. The body material is a MeshToonMaterial with a 4-step gradient (the review
 * renders' ramp, tools/blender/lib/toon.py: 0.42 · 0.68 · 0.90 · 1.06 at NdotL 0 · 0.22 · 0.50 · 0.82) whose shader
 * reads each vertex's palette slot and multiplies the slot's colour in; slots 11 (glow) and 14 (gem) also emit. The
 * outline is a BackSide basic material on the same geometry and skeleton, pushed out along the skinned normal by
 * about 1.6 px (never less than 4 mm) so it reads at the room's distance and the viewer's close-up alike.
 *
 * `color`, `emissive` and `opacity` keep their usual meaning on the body material, so the actor layer's down tint,
 * hit flash and fade work on a hero exactly as on a placeholder capsule.
 */

const RAMP_STEPS: readonly (readonly [number, number])[] = [
  [-1, 0.42],
  [0.22, 0.68],
  [0.5, 0.9],
  [0.82, 1.06],
]
const RAMP_TEXELS = 64

let ramp: THREE.DataTexture | null = null
let rampUsers = 0

/** The shared 4-step gradient (one tiny float texture for every character and room kit; freed with the last of them). */
export function acquireRamp(): THREE.DataTexture {
  if (!ramp) {
    const data = new Float32Array(RAMP_TEXELS)
    for (let i = 0; i < RAMP_TEXELS; i++) {
      const ndotl = ((i + 0.5) / RAMP_TEXELS) * 2 - 1
      let v = RAMP_STEPS[0]![1]
      for (const [at, value] of RAMP_STEPS) if (ndotl >= at) v = value
      data[i] = v
    }
    ramp = new THREE.DataTexture(data, RAMP_TEXELS, 1, THREE.RedFormat, THREE.FloatType)
    ramp.minFilter = THREE.NearestFilter
    ramp.magFilter = THREE.NearestFilter
    ramp.generateMipmaps = false
    ramp.needsUpdate = true
  }
  rampUsers++
  return ramp
}

export function releaseRamp(): void {
  rampUsers = Math.max(0, rampUsers - 1)
  if (rampUsers === 0 && ramp) {
    ramp.dispose()
    ramp = null
  }
}

/** The vertex attribute holding each vertex's palette slot (decoded from COLOR_0's R at assembly). */
export const SLOT_ATTRIBUTE = 'gvSlot'

export const OUTLINE_COLOR = 0x120c10
/** Outline width in device pixels, and its floor in metres (~5 mm at 1.8 m, 11 §1). */
export const OUTLINE_PX = 1.6
export const OUTLINE_MIN_M = 0.004

export interface CharacterMaterials {
  body: THREE.MeshToonMaterial
  outline: THREE.MeshBasicMaterial
  /** Replace the 16 colours (hex strings in slot order). */
  setPalette(hexes: readonly string[]): void
  /** Glow strength of the emissive slots (1 = the palette colour at full). */
  setGlow(k: number): void
  /** Fade both (1 = opaque). */
  setOpacity(o: number): void
  /** The drawing buffer's height in pixels (the outline's width is in pixels). */
  setViewportHeight(px: number): void
  dispose(): void
}

export function createCharacterMaterials(hexes: readonly string[], opts: { invScale: number }): CharacterMaterials {
  const palette = { value: paletteUniform(hexes) }
  const glow = { value: 0.85 }
  const body = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: acquireRamp() })
  body.name = 'gv-palette'
  body.onBeforeCompile = (shader) => {
    shader.uniforms.uPalette = palette
    shader.uniforms.uGlow = glow
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float ${SLOT_ATTRIBUTE};\nvarying float vGvSlot;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGvSlot = ${SLOT_ATTRIBUTE};`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uPalette[${SLOT_COUNT}];\nuniform float uGlow;\nvarying float vGvSlot;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        int gvIdx = clamp( int( vGvSlot + 0.5 ), 0, ${SLOT_COUNT - 1} );
        vec3 gvCol = uPalette[ gvIdx ];
        diffuseColor.rgb *= gvCol;
        if ( gvIdx == 11 || gvIdx == 14 ) totalEmissiveRadiance += gvCol * uGlow;`,
      )
  }

  const outlineUniforms = {
    uOutlinePx: { value: OUTLINE_PX },
    uOutlineMin: { value: OUTLINE_MIN_M },
    uViewportH: { value: 1000 },
    uInvScale: { value: opts.invScale },
  }
  const outline = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })
  outline.name = 'gv-outline'
  outline.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, outlineUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutlinePx;\nuniform float uOutlineMin;\nuniform float uViewportH;\nuniform float uInvScale;')
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
        #ifdef USE_SKINNING
          vec3 gvN = normalize( objectNormal );
        #else
          vec3 gvN = normalize( normal );
        #endif
        vec4 gvMv = modelViewMatrix * vec4( transformed, 1.0 );
        float gvWorldPerPx = 2.0 * max( 0.05, -gvMv.z ) / ( projectionMatrix[ 1 ][ 1 ] * uViewportH );
        transformed += gvN * ( max( uOutlineMin, uOutlinePx * gvWorldPerPx ) * uInvScale );`,
      )
  }

  return {
    body,
    outline,
    setPalette(next) {
      paletteUniform(next, palette.value)
    },
    setGlow(k) {
      glow.value = k
    },
    setOpacity(o) {
      const transparent = o < 0.999
      for (const m of [body, outline]) {
        if (m.transparent !== transparent) {
          m.transparent = transparent
          m.needsUpdate = true
        }
        m.opacity = o
        m.depthWrite = !transparent
      }
    },
    setViewportHeight(px) {
      outlineUniforms.uViewportH.value = Math.max(1, px)
    },
    dispose() {
      body.dispose()
      outline.dispose()
      releaseRamp()
    },
  }
}
