import type { StripChip } from '../../../../game/fightView.ts'
import { buzz } from '../../../lib/haptics.ts'
import type { FightSpeed } from './prefs.ts'

/**
 * The fight HUD's top and middle (Phase 4): the strip of the next turns, Auto / speed / AI rule, the turn banner
 * ("Your turn — Orrin", D-085: said in words), the tip line and the combat feed.
 */

export function TurnStrip({ chips, round }: { chips: readonly StripChip[]; round: number }) {
  return (
    <div class="fx-strip" data-testid="fx-strip" role="list" aria-label="The next turns, in order">
      <span class="fx-strip__round" title="A round ends when every hero has acted">
        Round {round}
      </span>
      {chips.map((ch, i) => (
        <span
          key={`${ch.id}-${i}`}
          role="listitem"
          class={`fx-strip__chip fx-strip__chip--${ch.side} ${ch.boss ? 'fx-strip__chip--boss' : ''} ${i === 0 ? 'fx-strip__chip--now' : ''}`}
          title={i === 0 ? `${ch.name} (acts now)` : ch.name}
          aria-label={i === 0 ? `${ch.name}, now` : ch.name}
        >
          {ch.initials}
        </span>
      ))}
    </div>
  )
}

export function Controls({ auto, speed, onAuto, onSpeed, onRule }: { auto: boolean; speed: FightSpeed; onAuto(): void; onSpeed(s: FightSpeed): void; onRule(): void }) {
  return (
    <div class="fx-controls">
      <button
        type="button"
        class={`fx-ctl fx-ctl--auto ${auto ? 'fx-ctl--on' : ''}`}
        data-testid="fx-auto"
        aria-pressed={auto}
        title="Auto: every hero acts on its AI rule (Space)"
        onClick={() => {
          buzz()
          onAuto()
        }}
      >
        {auto ? 'Auto on' : 'Auto'}
      </button>
      <div class="fx-speed" role="group" aria-label="Playback speed">
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            type="button"
            class={`fx-ctl fx-ctl--speed ${speed === s ? 'fx-ctl--on' : ''}`}
            data-testid={`fx-speed-${s}`}
            aria-pressed={speed === s}
            onClick={() => {
              buzz()
              onSpeed(s)
            }}
          >
            {s}×
          </button>
        ))}
      </div>
      <button
        type="button"
        class="fx-ctl fx-ctl--rule"
        data-testid="fx-rule"
        title="The AI rule Auto plays by"
        onClick={() => {
          buzz()
          onRule()
        }}
      >
        Rule
      </button>
    </div>
  )
}

export type BannerState = { kind: 'turn'; name: string } | { kind: 'acting'; name: string } | { kind: 'aim'; label: string } | { kind: 'auto' } | { kind: 'none' }

export function Banner({ state, onCancel }: { state: BannerState; onCancel(): void }) {
  switch (state.kind) {
    case 'turn':
      return (
        <div class="fx-banner fx-banner--turn" data-testid="fx-turn-banner" role="status" aria-live="assertive">
          Your turn — {state.name}
        </div>
      )
    case 'aim':
      return (
        <div class="fx-banner fx-banner--aim" role="status">
          <span>Choose a target — {state.label}</span>
          <button
            type="button"
            class="fx-cancel"
            data-testid="fx-cancel"
            onClick={() => {
              buzz()
              onCancel()
            }}
          >
            Cancel
          </button>
        </div>
      )
    case 'acting':
      return <div class="fx-banner fx-banner--acting">{state.name}</div>
    case 'auto':
      return <div class="fx-banner fx-banner--acting">Auto is playing</div>
    case 'none':
      return null
  }
}

export function Tip({ text, onClose }: { text: string; onClose(): void }) {
  return (
    <button type="button" class="fx-tip" data-testid="fx-tip" onClick={onClose}>
      {text}
    </button>
  )
}

export function Feed({ lines, playing, onSkip }: { lines: readonly string[]; playing: boolean; onSkip(): void }) {
  return (
    <div
      class={`fx-feed ${playing ? 'fx-feed--playing' : ''}`}
      data-testid="fx-feed"
      role="log"
      aria-live="polite"
      title={playing ? 'Tap to skip to the end' : undefined}
      onClick={() => {
        if (playing) onSkip()
      }}
    >
      {lines.length === 0 && <span class="fx-feed__line fx-feed__line--hint">The fight log shows here.</span>}
      {lines.map((l, i) => (
        <span key={`${i}-${l}`} class={`fx-feed__line ${i === lines.length - 1 ? 'fx-feed__line--new' : ''}`}>
          {l}
        </span>
      ))}
      {playing && <span class="fx-feed__skip">Tap to skip</span>}
    </div>
  )
}
