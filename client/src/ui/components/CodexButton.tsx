import { buzz } from '../lib/haptics.ts'
import { navigate } from '../router.ts'

/** The codex's door in a top bar (Phase 8, pass B): the town hub and a hero's screen; `from` brings the player back. */
export function CodexButton({ from }: { from: string }) {
  return (
    <button
      type="button"
      class="btn codex-btn"
      data-testid="open-codex"
      onClick={() => {
        buzz()
        navigate('codex', { from })
      }}
    >
      Codex
    </button>
  )
}
