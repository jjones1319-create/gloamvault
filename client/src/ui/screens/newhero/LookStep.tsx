import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import type { HeroLook } from '../../../../../sim/src/types/content.ts'
import type { BodyFrame } from '../../../../../sim/src/types/enums.ts'
import { heroLibrary } from '../../../scene/characters/assets.ts'
import type { HeroManifest } from '../../../scene/characters/manifest.ts'
import { hairChoices, hairIsHorn, skinTones, starterSpec } from '../../../scene/characters/outfit.ts'
import { CharacterCanvas } from '../../components/CharacterCanvas.tsx'
import { buzz } from '../../lib/haptics.ts'
import { draftLook, type Draft } from './draft.ts'
import '../viewer.css'

/**
 * The Look step (Phase 5): body frame, skin tone, face preset and hair colour (horn colour for the Draconid), with a
 * live 3D preview of the hero in the class's starter gear — drag it to turn. Every pick has a default, so Next is
 * always open.
 */
export function LookStep({ c, draft, onLook }: { c: Content; draft: Draft; onLook: (look: HeroLook) => void }) {
  const [manifest, setManifest] = useState<HeroManifest | null>(null)
  useEffect(() => {
    void heroLibrary.manifest().then(setManifest)
  }, [])
  const speciesId = draft.speciesId ?? 'human'
  const classId = draft.classId ?? 'warden'
  const species = c.species.get(speciesId)
  const look = draftLook(c, draft)
  const tones = skinTones(manifest, species)
  const hairs = hairChoices(manifest, speciesId)
  const presets = manifest?.species.get(speciesId)?.presets
  const faces = presets && presets.length ? presets.map((p) => p.name) : Array.from({ length: species?.body.facePresets ?? 3 }, (_, i) => `Face ${i + 1}`)
  const spec = useMemo(() => starterSpec(c, { speciesId, classId, look }), [c, speciesId, classId, look.frame, look.skin, look.face, look.hair])
  const pick = (patch: Partial<HeroLook>) => {
    buzz()
    onLook({ ...look, ...patch })
  }

  return (
    <div class="nh-look" data-testid="nh-look">
      <div class="nh-look__preview">
        <CharacterCanvas spec={spec} options={{ yaw: -22 }} testid="nh-look-preview" />
        <span class="nh-look__hint">Drag to turn · pinch to zoom</span>
      </div>
      <div class="nh-look__picks">
        <LookRow label="Body">
          {(['broad', 'slight'] as BodyFrame[]).map((f) => (
            <button key={f} class={`chip vw-pick ${look.frame === f ? 'chip--on' : ''}`} aria-pressed={look.frame === f} data-testid={`nh-look-frame-${f}`} onClick={() => pick({ frame: f })}>
              {f === 'broad' ? 'Broad' : 'Slight'}
            </button>
          ))}
        </LookRow>
        <LookRow label="Face">
          {faces.map((name, i) => (
            <button key={name} class={`chip vw-pick ${look.face === i ? 'chip--on' : ''}`} aria-pressed={look.face === i} data-testid={`nh-look-face-${i + 1}`} onClick={() => pick({ face: i })}>
              {name}
            </button>
          ))}
        </LookRow>
        <LookRow label="Skin">
          {tones.map((hex, i) => (
            <button key={hex} class={`vw-swatch ${look.skin === i ? 'vw-swatch--on' : ''}`} aria-label={`Skin tone ${i + 1}`} aria-pressed={look.skin === i} data-testid={`nh-look-skin-${i + 1}`} style={{ background: hex }} onClick={() => pick({ skin: i })} />
          ))}
        </LookRow>
        <LookRow label={hairIsHorn(manifest, speciesId) ? 'Horns' : 'Hair'}>
          {hairs.map((hex, i) => (
            <button key={`${hex}-${i}`} class={`vw-swatch ${look.hair % hairs.length === i ? 'vw-swatch--on' : ''}`} aria-label={`Colour ${i + 1}`} aria-pressed={look.hair % hairs.length === i} data-testid={`nh-look-hair-${i + 1}`} style={{ background: hex }} onClick={() => pick({ hair: i })} />
          ))}
        </LookRow>
      </div>
    </div>
  )
}

function LookRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="vw-row">
      <span class="vw-row__label">{label}</span>
      <div class="vw-row__picks">{children}</div>
    </div>
  )
}
