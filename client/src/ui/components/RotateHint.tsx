import { isPortrait } from '../lib/platform.ts'

/** Shown in a portrait browser tab; the installed app is locked to landscape by the manifest (D-003). */
export function RotateHint() {
  if (!isPortrait.value) return null
  return (
    <div class="rotate" role="status" data-testid="rotate-hint">
      <span class="rotate__icon" aria-hidden="true">
        ⟳
      </span>
      <span>Turn your phone sideways. Gloamvault plays in landscape.</span>
    </div>
  )
}
