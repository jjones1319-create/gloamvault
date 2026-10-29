import { lessonPending, replayTutorial } from '../../game/coach.ts'
import { act, profile } from '../../game/session.ts'
import { Btn } from '../kit/kit.tsx'

/**
 * Settings → Help (Phase 8, pass B): replay the lesson (D-038). Its coach marks show again, and the next delve that
 * starts on floor 1 is the three-room lesson floor again.
 */
export function HelpGroup() {
  const p = profile.value
  const pending = p !== null && lessonPending(p)
  return (
    <section class="group" data-testid="settings-help">
      <h2 class="group__title">Help</h2>
      <div class="row">
        <span class="toggle__text">
          <span class="toggle__label">Replay the tutorial</span>
          <span class="toggle__hint">
            {p === null ? 'Start a game first.' : pending ? 'Ready: the lesson’s notes are on, and your next delve from floor 1 is the lesson floor.' : 'Shows the lesson’s notes again; your next delve from floor 1 is the three-room lesson floor.'}
          </span>
        </span>
        <Btn testid="settings-replay-tutorial" disabled={p === null} onClick={() => act((_c, q) => replayTutorial(q), 'The tutorial is ready: enter floor 1 at the Waystone.')}>
          Replay
        </Btn>
      </div>
    </section>
  )
}
