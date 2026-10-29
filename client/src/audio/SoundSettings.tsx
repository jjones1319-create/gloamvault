import { Toggle } from '../ui/components/Toggle.tsx'
import { settings, updateSettings } from '../ui/store/settings.ts'
import type { Settings } from '../save/settings.ts'
import { audioEffect } from './index.ts'
import './sound-settings.css'

type VolumeKey = 'masterVolume' | 'musicVolume' | 'sfxVolume'

/** One volume row: the label, the value and a 48-px slider in steps of 5. */
function Volume({ label, hint, field, value, disabled }: { label: string; hint: string; field: VolumeKey; value: number; disabled: boolean }) {
  return (
    <label class={`row snd-row ${disabled ? 'snd-row--off' : ''}`}>
      <span class="toggle__text">
        <span class="toggle__label">
          {label} <span class="snd-row__value">{value}%</span>
        </span>
        <span class="toggle__hint">{hint}</span>
      </span>
      <input
        class="snd-row__slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        aria-label={label}
        data-testid={`snd-${field}`}
        onInput={(e) => updateSettings({ [field]: Number((e.currentTarget as HTMLInputElement).value) } as Partial<Settings>)}
        onChange={() => audioEffect(field === 'musicVolume' ? 'ui-confirm' : 'heal')}
      />
    </label>
  )
}

/**
 * Settings → Sound (Phase 8, pass A): the mute switch and three volumes — master, music, and effects (with the
 * ambience). The sound starts with the first tap anywhere in the game (Android Chrome needs a gesture).
 */
export function SoundGroup() {
  const s = settings.value
  return (
    <section class="group" data-testid="settings-sound">
      <h2 class="group__title">Sound</h2>
      <Toggle label="Sound" hint="Music, effects and the dungeon's ambience" on={!s.muted} onChange={(on) => updateSettings({ muted: !on })} testId="toggle-sound" />
      <Volume label="Master volume" hint="Everything at once" field="masterVolume" value={s.masterVolume} disabled={s.muted} />
      <Volume label="Music" hint="Emberfall, the zones, the fights and the bosses" field="musicVolume" value={s.musicVolume} disabled={s.muted} />
      <Volume label="Effects" hint="Blows, doors, coins, taps and the ambience" field="sfxVolume" value={s.sfxVolume} disabled={s.muted} />
    </section>
  )
}
