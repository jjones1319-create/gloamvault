import { buzz } from '../lib/haptics.ts'

interface ToggleProps {
  label: string
  hint?: string
  on: boolean
  onChange: (on: boolean) => void
  testId?: string
}

/** A 48-px switch row (CLAUDE.md: tap targets ≥ 44 px). */
export function Toggle({ label, hint, on, onChange, testId }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      class={`toggle ${on ? 'toggle--on' : ''}`}
      data-testid={testId}
      onClick={() => {
        buzz()
        onChange(!on)
      }}
    >
      <span class="toggle__text">
        <span class="toggle__label">{label}</span>
        {hint && <span class="toggle__hint">{hint}</span>}
      </span>
      <span class="toggle__track" aria-hidden="true">
        <span class="toggle__knob" />
      </span>
    </button>
  )
}

interface ChoiceProps<T extends string> {
  label: string
  hint?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** A segmented choice row. */
export function Choice<T extends string>({ label, hint, value, options, onChange }: ChoiceProps<T>) {
  return (
    <div class="choice">
      <span class="toggle__text">
        <span class="toggle__label">{label}</span>
        {hint && <span class="toggle__hint">{hint}</span>}
      </span>
      <div class="choice__options" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            class={`chip ${o.value === value ? 'chip--on' : ''}`}
            onClick={() => {
              buzz()
              onChange(o.value)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
